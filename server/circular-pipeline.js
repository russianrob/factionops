/// Weekly grocery-circular ingestion.
///
/// A phone Shortcut POSTs the week's circular PDF URL (an unguessable CloudFront
/// link the ShopRite app hands out) to /api/circular. The server does the part it
/// is good at and the block can't stop: fetch the PDF, `pdftotext` it, and turn
/// the raw text into structured offers with the box's headless `claude`.
///
/// Why the pipeline is shaped this way, learned the hard way extracting the
/// 2026-08-02 circular by hand:
///   * Raw text is persisted BEFORE extraction. Extraction is the slow,
///     LLM-dependent, failure-prone stage; a 77 MB re-fetch (or losing the URL)
///     to retry it is not acceptable. Job goes `text-ready` the moment pdftotext
///     finishes, so a failed extract re-runs off disk.
///   * A single PDF "page" is sometimes three physical pages flattened together
///     (page 2 of the 08-02 book lost 33 offers that way). The disclaimer line
///     repeats once per physical page, so we split on it in code rather than by
///     hand-picked line numbers that won't survive next week's layout.
///   * A completeness check (Title-Case product candidates in the text vs. the
///     text of what we extracted) runs in-pipeline and surfaces under-covered
///     segments in the job status — a missed offer is the failure mode here, and
///     it must not pass silently.
///
/// Everything above the IO line is pure and unit-tested; the IO functions take
/// injected deps so the orchestration is testable without a network or a spawn.

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

// ── Pure helpers ────────────────────────────────────────────────────────────

// The endpoint fetches whatever URL it is handed, server-side, so the one real
// security edge is an open fetcher. Restrict to https on the CDN host that
// actually serves these circulars (CloudFront), plus a .pdf path.
const ALLOWED_HOST_RE = /(^|\.)cloudfront\.net$/i;
export function validateCircularUrl(url) {
  let u;
  try { u = new URL(String(url)); } catch { return { ok: false, reason: "not a URL" }; }
  if (u.protocol !== "https:") return { ok: false, reason: "must be https" };
  if (!ALLOWED_HOST_RE.test(u.hostname)) return { ok: false, reason: "host not allowed (expected *.cloudfront.net)" };
  if (!/\.pdf(\?|$)/i.test(u.pathname)) return { ok: false, reason: "path is not a .pdf" };
  return { ok: true, url: u.href };
}

// Idempotency key. A Shortcut that double-fires, or a retry, must land on the
// same job rather than re-running a multi-minute extraction. The CloudFront
// filename carries the week's millisecond timestamp, so the URL itself is a
// stable per-week key; hash it so the id is filesystem-safe.
export function jobIdForUrl(url) {
  return createHash("sha1").update(String(url)).digest("hex").slice(0, 16);
}

// "OFFERS VALID SUNDAY, AUGUST 2ND THRU SATURDAY, AUGUST 8TH, 2026" → ISO dates.
const MONTHS = { january:1,february:2,march:3,april:4,may:5,june:6,july:7,august:8,september:9,october:10,november:11,december:12 };
export function parseValidRange(rawText) {
  const t = String(rawText).replace(/\s+/g, " ");
  const m = t.match(/valid\s+\w+,\s*([a-z]+)\s+(\d+)(?:st|nd|rd|th)?\s+thru\s+\w+,\s*([a-z]+)\s+(\d+)(?:st|nd|rd|th)?,?\s*(\d{4})/i);
  if (!m) return null;
  const fromMo = MONTHS[m[1].toLowerCase()], thruMo = MONTHS[m[3].toLowerCase()], year = +m[5];
  if (!fromMo || !thruMo) return null;
  const iso = (mo, d) => `${year}-${String(mo).padStart(2, "0")}-${String(+d).padStart(2, "0")}`;
  return { validFrom: iso(fromMo, m[2]), validThru: iso(thruMo, m[4]) };
}

// Split one page's raw text into physical-page segments. The legal disclaimer
// ("Prices, programs and promotions effective …") is drawn once per physical
// page, so its repeats are the seams of a flattened multi-page spread. A page
// with one (or zero) disclaimer is returned whole.
const DISCLAIMER_RE = /Prices,?\s+programs\s+and\s+promotions\s+effective/i;
export function splitDisclaimerSegments(rawText) {
  const lines = String(rawText).split("\n");
  const seams = [];
  for (let i = 0; i < lines.length; i++) if (DISCLAIMER_RE.test(lines[i])) seams.push(i);
  if (seams.length <= 1) return [String(rawText)];
  // Cut just BEFORE each disclaimer after the first; the first segment keeps the
  // text above the initial disclaimer (headline, "OFFERS VALID …").
  const cuts = [0, ...seams.slice(1)];
  const segs = [];
  for (let c = 0; c < cuts.length; c++) {
    const start = cuts[c], end = c + 1 < cuts.length ? cuts[c + 1] : lines.length;
    const seg = lines.slice(start, end).join("\n").trim();
    if (seg) segs.push(seg);
  }
  return segs;
}

// Pull the first well-formed JSON array out of a model reply that may be wrapped
// in prose or ```json fences. Returns [] on nothing parseable.
export function extractJsonArray(stdout) {
  const s = String(stdout);
  const a = s.indexOf("["), b = s.lastIndexOf("]");
  if (a === -1 || b === -1 || b < a) return [];
  try { const v = JSON.parse(s.slice(a, b + 1)); return Array.isArray(v) ? v : []; }
  catch { return []; }
}

// Merge per-segment offer lists, dropping exact (product, priceText) duplicates
// that a flattened spread can emit twice. Stamps each offer with its page.
export function mergeOffers(pageResults) {
  const seen = new Set();
  const out = [];
  for (const pr of pageResults) {
    for (const o of pr.offers || []) {
      const key = `${(o.product || "").trim().toLowerCase()}|${(o.priceText || "").trim().toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ ...o, page: pr.page });
    }
  }
  return out;
}

// Completeness check: does every Title-Case product-name candidate in the raw
// text appear somewhere in what we extracted? Under-coverage means the extractor
// skipped tiles — the exact page-2 failure. Returns the missed candidates so the
// job can flag them instead of reporting false success.
const COVER_NOISE = /prices, programs|additional terms|shoprite\.com|we are|limit|save|final price|sale|digital|coupon|when you buy|less or additional|per variety|offers?$|excluding|valid thru|void where|plus dep|any variety|assorted|usda|gift card|register|certificate|clip|spend|earn/i;
const COVER_CAND = /^[A-Z][A-Za-z’'&°.-]*(?:\s+[A-Za-z0-9’'&°%.-]+){0,4}$/;
export function coverageCheck(rawText, offers) {
  const hay = offers.map(o => `${o.product || ""} ${o.detail || ""}`).join(" ").toLowerCase();
  const missed = [];
  for (const rawLine of String(rawText).split("\n")) {
    const ln = rawLine.trim();
    if (ln.length < 6 || ln.length > 44 || COVER_NOISE.test(ln) || !COVER_CAND.test(ln)) continue;
    if (/\d{2,}/.test(ln)) continue;
    const words = (ln.toLowerCase().match(/[a-z']{4,}/g) || []);
    if (!words.length) continue;
    const hit = words.filter(w => hay.includes(w)).length;
    if (hit / words.length < 0.6) missed.push(ln);
  }
  const uniq = [...new Set(missed)];
  return { missed: uniq, missedCount: uniq.length };
}

// ── Installable iOS Shortcut ────────────────────────────────────────────────

// Build an (unsigned) .shortcut plist for a share-sheet action that POSTs the
// shared URL to /api/circular. The user taps a link, iOS imports it — modulo the
// one-time "Allow Untrusted Shortcuts" toggle that all unsigned shortcuts need.
//
// The one fiddly part is getting the shared URL into the JSON body: the value of
// the "url" key is not a plain string but a WFTextTokenString whose single
// object-replacement char (U+FFFC) is backed by an ExtensionInput attachment
// (i.e. "Shortcut Input" — what the share sheet handed in). WFWorkflowTypes must
// include ActionExtension and WFWorkflowInputContentItemClasses must include
// WFURLContentItem or the shortcut never appears in the share sheet at all.
const OBJ = "￼"; // object-replacement char an attachment binds to
function xmlEscape(s) { return String(s).replace(/[<>&'"]/g, c => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" }[c])); }
export function buildShortcutPlist(token, endpoint = "https://tornwar.com/api/circular") {
  const tok = xmlEscape(token);
  const url = xmlEscape(endpoint);
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>WFWorkflowActions</key>
	<array>
		<dict>
			<key>WFWorkflowActionIdentifier</key>
			<string>is.workflow.actions.downloadurl</string>
			<key>WFWorkflowActionParameters</key>
			<dict>
				<key>WFURL</key>
				<string>${url}</string>
				<key>WFHTTPMethod</key>
				<string>POST</string>
				<key>WFHTTPBodyType</key>
				<string>JSON</string>
				<key>WFHTTPHeaders</key>
				<dict>
					<key>Value</key>
					<dict>
						<key>WFDictionaryFieldValueItems</key>
						<array>
							<dict>
								<key>WFItemType</key><integer>0</integer>
								<key>WFKey</key>
								<dict><key>Value</key><dict><key>string</key><string>x-circular-token</string></dict><key>WFSerializationType</key><string>WFTextTokenString</string></dict>
								<key>WFValue</key>
								<dict><key>Value</key><dict><key>string</key><string>${tok}</string></dict><key>WFSerializationType</key><string>WFTextTokenString</string></dict>
							</dict>
						</array>
					</dict>
					<key>WFSerializationType</key><string>WFDictionaryFieldValue</string>
				</dict>
				<key>WFJSONValues</key>
				<dict>
					<key>Value</key>
					<dict>
						<key>WFDictionaryFieldValueItems</key>
						<array>
							<dict>
								<key>WFItemType</key><integer>0</integer>
								<key>WFKey</key>
								<dict><key>Value</key><dict><key>string</key><string>url</string></dict><key>WFSerializationType</key><string>WFTextTokenString</string></dict>
								<key>WFValue</key>
								<dict>
									<key>Value</key>
									<dict>
										<key>string</key><string>${OBJ}</string>
										<key>attachmentsByRange</key>
										<dict><key>{0, 1}</key><dict><key>Type</key><string>ExtensionInput</string></dict></dict>
									</dict>
									<key>WFSerializationType</key><string>WFTextTokenString</string>
								</dict>
							</dict>
						</array>
					</dict>
					<key>WFSerializationType</key><string>WFDictionaryFieldValue</string>
				</dict>
			</dict>
		</dict>
	</array>
	<key>WFWorkflowClientVersion</key><string>2605.0.5</string>
	<key>WFWorkflowMinimumClientVersion</key><integer>900</integer>
	<key>WFWorkflowMinimumClientVersionString</key><string>900</string>
	<key>WFWorkflowHasShortcutInputVariables</key><true/>
	<key>WFWorkflowName</key><string>Send Circular to Warboard</string>
	<key>WFWorkflowIcon</key>
	<dict>
		<key>WFWorkflowIconStartColor</key><integer>4292093695</integer>
		<key>WFWorkflowIconGlyphNumber</key><integer>59769</integer>
	</dict>
	<key>WFWorkflowImportQuestions</key><array/>
	<key>WFWorkflowInputContentItemClasses</key>
	<array>
		<string>WFURLContentItem</string>
		<string>WFStringContentItem</string>
		<string>WFSafariWebPageContentItem</string>
	</array>
	<key>WFWorkflowTypes</key>
	<array><string>ActionExtension</string></array>
</dict>
</plist>
`;
}

// ── Extraction prompt (proven against the 2026-08-02 book) ──────────────────

export function buildExtractPrompt(segmentText) {
  return `You are extracting grocery sale offers from one page of a weekly supermarket circular. Below is \`pdftotext -raw\` output — the text of a grid of offer tiles, in draw order, so a tile's lines can be jumbled and a price like "4 for $7" may be split across separate lines as \`4\` / \`FOR\` / \`$\` / \`7\`. Reassemble those. A \`$\` line followed by \`1999\` means $19.99; \`399\` means $3.99; a bare number after \`FOR\` is a whole-dollar amount.

Extract EVERY distinct product offer. Return ONLY a JSON array (no prose, no code fence). Each element:
{"product": string, "detail": string (size/variety/exclusions as printed), "priceText": string (as a shopper would say it: "4 for $7", "$2.99 ea", "$1.99 lb", "BUY 1 GET 1 FREE"), "unitPrice": number|null (per single unit if computable, else null), "unit": "each"|"lb"|"pkg"|null, "requiresBuy": integer|null, "limit": string|null, "save": string|null, "category": string|null, "priceConfidence": "certain"|"likely"|"unknown"}

Rules: one entry per product; never merge two products or split one. Prices per pound set unit "lb". Set priceConfidence "certain" when the digits sit next to the product, "likely" when matched to a detached price block, "unknown" when it is clearly on sale but no price can be responsibly attributed — never invent a price to avoid "unknown". Skip decoration: the legal disclaimer, store hours/addresses, page codes, "we are here." taglines, and loyalty house-ads with no product price. Re-read the text after your first pass to catch skipped tiles.

TEXT:
${segmentText}`;
}

// ── IO orchestration (deps injected) ────────────────────────────────────────

function defaultReadFile(p) { return readFileSync(p, "utf8"); }
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// Extract one chunk via the Anthropic API directly, reusing warboard's Claude
// Code OAuth token (the same token the CLI uses). Measured 5× faster than
// spawning `claude -p` — 45s vs 214s for a full page — because it skips the
// entire CLI/agent startup and just does a messages call. Returns the model's
// text (extractJsonArray then pulls the JSON out).
//
// The OAuth token requires the system prompt to begin with the Claude Code
// identity line; the extractor framing is appended after it. max_tokens is set
// high because a truncated reply loses the trailing "]" and extractJsonArray
// then returns nothing — better to overprovision than drop a whole page. 429/529
// (rate-limit / overloaded) retry with backoff.
const EXTRACT_SYSTEM = "You are Claude Code, Anthropic's official CLI for Claude. For this task you are a data-extraction function: you have no tools and take no actions — you only read the text given and return JSON.";
export async function claudeExtract(prompt, opts = {}) {
  const model = opts.model || process.env.CIRCULAR_MODEL || "claude-haiku-4-5-20251001";
  const tokenFile = opts.tokenFile || process.env.AGENT_CLAUDE_TOKEN_FILE || "/opt/warboard/server/data/.agent-claude-token";
  const maxTokens = opts.maxTokens || 16000;
  const doFetch = opts.fetchImpl || globalThis.fetch;
  let token = "";
  try { token = (opts.readFile || defaultReadFile)(tokenFile).trim(); } catch {}
  const body = JSON.stringify({
    model, max_tokens: maxTokens, system: EXTRACT_SYSTEM,
    messages: [{ role: "user", content: prompt }],
  });
  const headers = {
    "content-type": "application/json",
    "anthropic-version": "2023-06-01",
    "authorization": "Bearer " + token,
    "anthropic-beta": "oauth-2025-04-20",
  };
  let lastErr;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const r = await doFetch("https://api.anthropic.com/v1/messages", { method: "POST", headers, body });
      if (r.status === 429 || r.status === 529 || r.status >= 500) { lastErr = new Error("api " + r.status); await sleep(1500 * (attempt + 1)); continue; }
      if (!r.ok) throw new Error("api " + r.status + ": " + (await r.text()).slice(0, 200));
      const d = await r.json();
      return (d.content || []).map(c => c.text || "").join("");
    } catch (e) { lastErr = e; await sleep(1000 * (attempt + 1)); }
  }
  throw lastErr;
}

// Cap a segment at maxLines by cutting overlapping windows. The disclaimer split
// finds MOST physical-page seams, but some sub-pages start with a different
// header (the organic block on the 08-02 book did), leaving one oversized,
// jumbled segment — the size at which the extractor starts dropping tiles. A
// hard line cap is layout-independent where header-matching is not; the overlap
// keeps any tile whole in at least one window, and mergeOffers' dedup absorbs the
// duplicates the overlap produces.
export function chunkSegment(text, maxLines = 220, overlap = 40) {
  const lines = String(text).split("\n");
  if (lines.length <= maxLines) return [text];
  const step = maxLines - overlap;
  const out = [];
  for (let start = 0; start < lines.length; start += step) {
    out.push(lines.slice(start, start + maxLines).join("\n"));
    if (start + maxLines >= lines.length) break;
  }
  return out;
}

// Vision extraction: read one or more PNG images with the model and return its
// text. Same OAuth-token API path as claudeExtract, but the message content is
// image blocks + the prompt. Used for the deli page, whose grouped/detached
// prices pdftotext mangles — Sonnet reads the layout reliably. `images` is an
// array of base64 PNG strings.
export async function claudeExtractImage(images, prompt, opts = {}) {
  const model = opts.model || process.env.CIRCULAR_VISION_MODEL || "claude-sonnet-5";
  const tokenFile = opts.tokenFile || process.env.AGENT_CLAUDE_TOKEN_FILE || "/opt/warboard/server/data/.agent-claude-token";
  const maxTokens = opts.maxTokens || 8000;
  const doFetch = opts.fetchImpl || globalThis.fetch;
  let token = "";
  try { token = (opts.readFile || defaultReadFile)(tokenFile).trim(); } catch {}
  const content = [
    ...images.map(b64 => ({ type: "image", source: { type: "base64", media_type: "image/png", data: b64 } })),
    { type: "text", text: prompt },
  ];
  const body = JSON.stringify({
    model, max_tokens: maxTokens, system: EXTRACT_SYSTEM,
    messages: [{ role: "user", content }],
  });
  const headers = {
    "content-type": "application/json", "anthropic-version": "2023-06-01",
    "authorization": "Bearer " + token, "anthropic-beta": "oauth-2025-04-20",
  };
  // The OAuth token has a tight rate limit; vision requests are token-heavy and
  // 429 readily under any concurrent warboard API activity. This is a once-a-week
  // call, so back off generously (respecting Retry-After) rather than failing.
  const backoff = [8000, 20000, 40000, 60000];
  let lastErr;
  for (let attempt = 0; attempt < backoff.length; attempt++) {
    try {
      const r = await doFetch("https://api.anthropic.com/v1/messages", { method: "POST", headers, body });
      if (r.status === 429 || r.status === 529 || r.status >= 500) {
        lastErr = new Error("api " + r.status);
        const ra = parseInt(r.headers.get("retry-after") || "", 10);
        await sleep(Number.isFinite(ra) ? ra * 1000 : backoff[attempt]);
        continue;
      }
      if (!r.ok) throw new Error("api " + r.status + ": " + (await r.text()).slice(0, 200));
      const d = await r.json();
      return (d.content || []).map(c => c.text || "").join("");
    } catch (e) { lastErr = e; await sleep(backoff[attempt]); }
  }
  throw lastErr;
}

// Extract offers from one page's raw text: split into physical-page segments,
// window any oversized segment, run each chunk through the injected extractor,
// merge (dedup absorbs window overlap). `extractor(prompt)` returns the model's
// stdout; injectable so tests never spawn.
export async function extractPage(page, rawText, extractor, opts = {}) {
  const buildPrompt = opts.buildPrompt || buildExtractPrompt;
  const parse = opts.parse || extractJsonArray;
  const segments = splitDisclaimerSegments(rawText);
  const chunks = segments.flatMap(s => chunkSegment(s, opts.maxLines, opts.overlap));
  const seen = new Set();
  const offers = [];
  let failedChunks = 0;
  for (const chunk of chunks) {
    let parsed = [];
    try {
      // One chunk timing out or erroring must NOT sink the page (and via the
      // page, the whole book). It contributes zero offers; coverageCheck then
      // surfaces the gap in the job status instead of reporting false success.
      parsed = parse(await extractor(buildPrompt(chunk)));
    } catch { failedChunks++; continue; }
    for (const o of parsed) {
      // Dedup here too: overlapping windows re-emit the same tile.
      const key = `${(o.product || "").trim().toLowerCase()}|${(o.priceText || "").trim().toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      offers.push(o);
    }
  }
  return { page, segments: segments.length, chunks: chunks.length, failedChunks, offers };
}
