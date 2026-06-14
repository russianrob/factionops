// TornTools pre-ship audit — run BEFORE deploying a NEW stock TornTools build, so
// breakage in our WKWebView runtime is caught up-front instead of after you ship.
//
//   node bin/torntools-preship-audit.mjs <newStockDir> [--update-baseline]
//
// Checks, in order:
//   1. Patch applicability — dry-package the new stock (runs all 5 patches +
//      verifyPatches). If our patches don't apply, the build FAILS here. HARD GATE.
//   2. Patch anchors — explicit presence report for each patch's stock dependency.
//   3. WKWebView risk scan — Chrome-isms that have bitten us (Response.clone(),
//      service-worker globals, chrome.offscreen, workers, …). Informational.
//   4. Risk-surface diff vs the committed baseline (bin/torntools-baseline.json):
//      which risk files / manifest fields changed since the last audited version.
//
// Exit code: 1 only if a patch won't apply (step 1/2). Risk flags + diffs are
// informational — they tell you WHAT to eyeball before deploying, not block.
// `--update-baseline` rewrites the baseline from the given stock after a pass.
import { readFileSync, writeFileSync, existsSync, rmSync, mkdtempSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { packageTornTools, verifyPatches, FETCH_ANCHOR } from "./package-torntools.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASELINE_PATH = join(__dirname, "torntools-baseline.json");

// The files our patches touch or that drive page behaviour — what to diff + scan.
const RISK_FILES = [
  "fetch--inject.js",            // patch #5 anchors here (the CF hang lived here)
  "xhr--inject.js",              // passive observer; watch for it becoming blocking
  "content-scripts/extension.js",// patch #4 appends here; the main content script
  "background.js",               // patch #1 wraps this (prelude)
  "manifest.json",               // patch #2 + injection planning (matches/run_at)
];

// Chrome-isms that DIVERGE in WKWebView and have bitten us. A change in count vs
// baseline is the signal to look. Each tied to the file(s) it matters in.
const RISK_PATTERNS = [
  { file: "fetch--inject.js", re: /\.clone\(\)/g, note: "Response.clone() — stalled the CF challenge in WKWebView; patch #5 must still guard non-Torn/cdn-cgi" },
  { file: "fetch--inject.js", re: /window\.fetch\s*=/g, note: "rewrites window.fetch — patch #5 wraps this; confirm the shape still matches FETCH_ANCHOR" },
  { file: "xhr--inject.js", re: /XMLHttpRequest\.prototype\.(open|send)\s*=/g, note: "XHR open/send overrides — should stay a PASSIVE readystatechange observer; a Promise/blocking wrapper here would hang requests like fetch did" },
  { file: "background.js", re: /chrome\.offscreen|createDocument/g, note: "chrome.offscreen — the prelude stubs it; new usage may need prelude changes" },
  { file: "background.js", re: /importScripts|self\.skipWaiting|self\.clients|registration\./g, note: "service-worker globals — prelude runs bg as a plain page; new SW APIs may break" },
  { file: "background.js", re: /chrome\.alarms|browser\.alarms/g, note: "alarms — runtime implements a real handler; check the cadence/usage" },
  { file: "content-scripts/extension.js", re: /storage\.onChanged/g, note: "storage.onChanged — runtime now delivers to bg + page + options; relied on by live toggles" },
  { file: "content-scripts/extension.js", re: /chrome\.scripting|\.executeScript|declarativeNetRequest/g, note: "MV3 scripting/DNR — NOT implemented by the runtime" },
  { file: "content-scripts/extension.js", re: /navigator\.serviceWorker|new SharedWorker|new Worker\(/g, note: "workers/SW — limited/absent in WKWebView" },
];

const C = { ok: "✓", bad: "✗", warn: "⚠", info: "ℹ" };
const sha = (p) => existsSync(p) ? createHash("sha256").update(readFileSync(p)).digest("hex") : null;

function manifestSummary(stockDir) {
  const m = JSON.parse(readFileSync(join(stockDir, "manifest.json"), "utf8"));
  const cs = (m.content_scripts || []).map((c) => ({ matches: c.matches || [], js: (c.js || []).length, run_at: c.run_at || "document_idle" }));
  return {
    version: m.version,
    permissions: (m.permissions || []).slice().sort(),
    host_permissions: (m.host_permissions || []).slice().sort(),
    content_scripts: cs,
    background: m.background || null,
    web_accessible_resources: m.web_accessible_resources || [],
    optional_permissions: (m.optional_permissions || []).slice().sort(),
  };
}

function arrDiff(a, b) {
  const sa = new Set(a), sb = new Set(b);
  return { added: [...sb].filter((x) => !sa.has(x)), removed: [...sa].filter((x) => !sb.has(x)) };
}

export function audit(newStockDir, { updateBaseline = false } = {}) {
  if (!existsSync(newStockDir)) throw new Error(`stock dir not found: ${newStockDir}`);
  const out = [];
  let hardFail = null;
  const log = (s) => out.push(s);

  const newManifest = manifestSummary(newStockDir);
  log(`TornTools pre-ship audit — ${newStockDir}  (stock version ${newManifest.version})`);
  log("");

  // [1] Patch applicability: dry-package + verifyPatches (the authoritative gate).
  log("[1/4] Patch applicability (dry-package + verifyPatches)");
  const tmp = mkdtempSync(join(tmpdir(), "tt-audit-"));
  try {
    const r = packageTornTools({ stockDir: newStockDir, outDir: tmp, version: "audit-dryrun" });
    log(`  ${C.ok} all 5 patches applied + verified (${r.fileCount} files)`);
  } catch (e) {
    hardFail = e.message;
    log(`  ${C.bad} ${e.message}`);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
  log("");

  // [2] Patch anchors: explicit presence report.
  log("[2/4] Patch anchors (stock dependencies each patch needs)");
  const anchor = (label, ok, detail) => log(`  ${ok ? C.ok : C.bad} ${label}${detail ? " — " + detail : ""}`);
  anchor("#1 background.js present", existsSync(join(newStockDir, "background.js")));
  let mok = false; try { mok = !!JSON.parse(readFileSync(join(newStockDir, "manifest.json"), "utf8")).version; } catch {}
  anchor("#2 manifest.json parseable + has version", mok, mok ? `version=${newManifest.version}` : "unparseable/no version");
  anchor("#4 content-scripts/extension.js present", existsSync(join(newStockDir, "content-scripts", "extension.js")));
  const fiPath = join(newStockDir, "fetch--inject.js");
  const fiText = existsSync(fiPath) ? readFileSync(fiPath, "utf8") : "";
  const anchorCount = fiText.split(FETCH_ANCHOR).length - 1;
  anchor(`#5 fetch wrapper anchor in fetch--inject.js`, anchorCount === 1,
    anchorCount === 1 ? `found ×1` : `found ×${anchorCount} (expected exactly 1) — patch #5 will mis-apply`);
  log("");

  // [3] WKWebView risk scan.
  log("[3/4] WKWebView risk scan (Chrome-isms that have bitten us)");
  const baseline = existsSync(BASELINE_PATH) ? JSON.parse(readFileSync(BASELINE_PATH, "utf8")) : null;
  let flagged = 0;
  for (const pat of RISK_PATTERNS) {
    const p = join(newStockDir, pat.file);
    if (!existsSync(p)) continue;
    const count = (readFileSync(p, "utf8").match(pat.re) || []).length;
    if (count === 0) continue;
    const was = baseline && baseline.risk && baseline.risk[pat.file] && baseline.risk[pat.file][pat.re.source];
    const delta = was === undefined ? "" : (count === was ? " (unchanged)" : ` (was ${was})`);
    log(`  ${C.warn} ${pat.file}: ${count}× /${pat.re.source}/${delta}`);
    log(`      ${pat.note}`);
    flagged++;
  }
  if (!flagged) log(`  ${C.ok} no known-risk patterns matched`);
  log("");

  // [4] Risk-surface diff vs baseline.
  log("[4/4] Risk-surface diff vs baseline");
  if (!baseline) {
    log(`  ${C.info} no baseline yet — run with --update-baseline to record ${newManifest.version} as the baseline`);
  } else {
    log(`  baseline = ${baseline.version}; new = ${newManifest.version}`);
    for (const f of RISK_FILES) {
      const now = sha(join(newStockDir, f));
      const before = baseline.files[f];
      const state = !now ? `${C.bad} MISSING` : !before ? `${C.info} new file` : now === before ? `${C.ok} SAME` : `${C.warn} CHANGED`;
      log(`  ${state}  ${f}`);
    }
    // manifest field-level delta
    const b = baseline.manifest;
    const perm = arrDiff(b.permissions, newManifest.permissions);
    const host = arrDiff(b.host_permissions, newManifest.host_permissions);
    if (perm.added.length || perm.removed.length) log(`  ${C.warn} permissions: +[${perm.added}] -[${perm.removed}]`);
    if (host.added.length || host.removed.length) log(`  ${C.warn} host_permissions: +[${host.added}] -[${host.removed}]`);
    const bgType = JSON.stringify(b.background) !== JSON.stringify(newManifest.background);
    if (bgType) log(`  ${C.warn} background changed: ${JSON.stringify(b.background)} -> ${JSON.stringify(newManifest.background)}`);
    const csChanged = JSON.stringify(b.content_scripts) !== JSON.stringify(newManifest.content_scripts);
    if (csChanged) log(`  ${C.warn} content_scripts matches/run_at/js-count changed — re-check injection planning`);
    if (!perm.added.length && !perm.removed.length && !host.added.length && !host.removed.length && !bgType && !csChanged)
      log(`  ${C.ok} manifest permissions / background / content_scripts unchanged`);
  }
  log("");

  // Verdict
  if (hardFail) {
    log(`VERDICT: ${C.bad} FAIL — patches do NOT apply: ${hardFail}`);
    log(`         Do NOT ship. Update package-torntools.mjs (fix the failing patch), then re-audit.`);
  } else {
    log(`VERDICT: ${C.ok} PASS — all 5 patches apply to ${newManifest.version}.`);
    log(`         Review any ${C.warn} CHANGED risk files + flags above, then package + deploy:`);
    log(`           node bin/package-torntools.mjs ${newStockDir} ${newManifest.version}`);
  }

  // Optionally record this version as the new baseline (only on a pass).
  if (updateBaseline && !hardFail) {
    const risk = {};
    for (const pat of RISK_PATTERNS) {
      const p = join(newStockDir, pat.file);
      if (!existsSync(p)) continue;
      risk[pat.file] = risk[pat.file] || {};
      risk[pat.file][pat.re.source] = (readFileSync(p, "utf8").match(pat.re) || []).length;
    }
    const files = {};
    for (const f of RISK_FILES) files[f] = sha(join(newStockDir, f));
    writeFileSync(BASELINE_PATH, JSON.stringify({ version: newManifest.version, files, manifest: newManifest, risk }, null, 2));
    log("");
    log(`${C.info} baseline updated -> ${newManifest.version} (bin/torntools-baseline.json)`);
  }

  return { report: out.join("\n"), pass: !hardFail };
}

if (process.argv[1] && process.argv[1].endsWith("torntools-preship-audit.mjs") && process.argv[2]) {
  const updateBaseline = process.argv.includes("--update-baseline");
  const { report, pass } = audit(process.argv[2], { updateBaseline });
  console.log(report);
  process.exit(pass ? 0 : 1);
}
