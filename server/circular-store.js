/// Storage + orchestration for the weekly grocery circular.
///
/// The pure parsing lives in circular-pipeline.js; this is the IO glue: fetch the
/// PDF, `pdftotext` it, drive extraction, and persist. Layout of data/circular/:
///
///   data/circular/<jobId>/status.json     job state (polled by the owner)
///   data/circular/<jobId>/pN.txt          raw pdftotext per PDF page
///   data/circular/<jobId>/offers.json     final structured result
///   data/circular/latest.json             copy of the newest completed offers.json
///
/// jobId = sha1(url) — the CloudFront filename carries the week's timestamp, so
/// one URL == one week == one job. A re-POST of the same URL returns the existing
/// job rather than re-running extraction (idempotency).

import { execFile, execFileSync } from "node:child_process";
import { promisify } from "node:util";
import {
  mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync, statSync, rmSync, copyFileSync,
} from "node:fs";
import { join } from "node:path";
import {
  jobIdForUrl, parseValidRange, mergeOffers, coverageCheck, extractPage, claudeExtract,
  claudeExtractImage, extractJsonArray,
} from "./circular-pipeline.js";
import {
  findDeliPages, buildDeliVisionPrompt, matchDeliOffers, countFilled, countMatched, fillSheetXml, dateRangeLabel,
} from "./deli-form.js";

const execFileP = promisify(execFile);

const DATA_DIR = process.env.CIRCULAR_DIR || "/opt/warboard/server/data/circular";
const DELI_TEMPLATE = process.env.DELI_TEMPLATE || "/opt/warboard/server/data/deli-form-template.xlsx";
const DELI_FORM_LATEST = process.env.DELI_FORM_LATEST || "/opt/warboard/server/public/deli-form-latest.xlsx";
const XLSX_TOOL = "/opt/warboard/server/bin/xlsx-tool.py";
const DELI_MIN_MATCHED = 7;  // overwrite guard: below this many rows READ FROM THE
                             // CIRCULAR, keep the existing form. Counts real matches
                             // only — standing defaults (Pepperoni, Bologna, Cheddar,
                             // Roast Beef) fill even when the vision read returned
                             // nothing, so counting them would let a degraded run
                             // clobber the form the user has bookmarked and approved.
const MAX_PDF_BYTES = 200 * 1024 * 1024;   // circulars run ~77 MB; 200 MB is generous headroom
const KEEP_JOBS = 10;                       // prune older weeks — a book a week, ~2.5 months retained
const PAGE_CONCURRENCY = 4;

function jobDir(jobId) { return join(DATA_DIR, jobId); }
function statusPath(jobId) { return join(jobDir(jobId), "status.json"); }

function ensureDir(d) { mkdirSync(d, { recursive: true }); }

export function readStatus(jobId) {
  try { return JSON.parse(readFileSync(statusPath(jobId), "utf8")); } catch { return null; }
}

function writeStatus(jobId, patch) {
  const prev = readStatus(jobId) || {};
  const next = { ...prev, ...patch, jobId, updatedAt: new Date().toISOString() };
  writeFileSync(statusPath(jobId), JSON.stringify(next, null, 1));
  return next;
}

export function readLatest() {
  try { return JSON.parse(readFileSync(join(DATA_DIR, "latest.json"), "utf8")); } catch { return null; }
}

// Delete all but the KEEP_JOBS most-recently-touched job dirs. A 77 MB PDF a week
// otherwise accumulates without bound.
function pruneOldJobs() {
  let dirs;
  try {
    dirs = readdirSync(DATA_DIR)
      .map(n => join(DATA_DIR, n))
      .filter(p => { try { return statSync(p).isDirectory(); } catch { return false; } })
      .map(p => ({ p, m: statSync(p).mtimeMs }))
      .sort((a, b) => b.m - a.m);
  } catch { return; }
  for (const { p } of dirs.slice(KEEP_JOBS)) { try { rmSync(p, { recursive: true, force: true }); } catch {} }
}

// Run tasks with a bounded concurrency pool (pages extract in parallel, but not
// all 12 at once — keeps API calls under rate limits).
async function runPool(items, limit, fn) {
  const results = new Array(items.length);
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      results[idx] = await fn(items[idx], idx);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

// Generate the filled bulk-sale deli/cheese form from a week's circular. The
// deli page's grouped/detached prices defeat text extraction, so this reads the
// deli page(s) by VISION, matches under the user's rules (deli-form.js), and
// fills the template. Runs as a follow-on step after the main extraction has
// already persisted — a failure here never loses the offers or the job.
//
// Overwrite guard: the public /bulksale file (which the user has bookmarked and
// approved) is replaced ONLY when at least DELI_MIN_MATCHED rows came from the
// CIRCULAR itself (standing defaults do not count toward it).
// A weak/garbage read writes a dated candidate and keeps the good form in place.
export async function generateDeliForm(dir, pageTexts, range, opts = {}) {
  const vision = opts.visionExtractor || ((imgs, prompt) => claudeExtractImage(imgs, prompt));
  const formLatest = opts.formLatest || DELI_FORM_LATEST;
  const template = opts.template || DELI_TEMPLATE;
  const pages = findDeliPages(pageTexts);
  if (!pages.length) return { state: "no-deli-pages" };

  // The main extraction just fired ~30 Haiku calls (concurrency 4); that burst
  // saturates the token's short-window rate limit, so the vision calls 429 if
  // they follow immediately. Wait for the window to clear first. Weekly async
  // job — the minute costs nothing. Tests pass cooldownMs:0.
  const cooldownMs = opts.cooldownMs != null ? opts.cooldownMs : 60000;
  if (cooldownMs) await new Promise(r => setTimeout(r, cooldownMs));

  // One vision call PER PAGE, a single image each. A two-image request trips a
  // per-request limit (single images succeed even at 96% of the 5h budget; two
  // 429 at 4%), so never batch them. Space the calls well apart — this token's
  // window is tight enough that 4s was not enough.
  const offersAll = [];
  let pageFailures = 0;
  for (let i = 0; i < pages.length; i++) {
    const p = pages[i];
    const srcBase = join(dir, `deli-src-${p}`);
    await execFileP("pdftoppm", ["-f", String(p), "-l", String(p), "-r", "150", "-singlefile", "-png", join(dir, "circular.pdf"), srcBase]);
    const png = join(dir, `deli-p${p}.png`);
    // ~1000px wide keeps each image small while the deli prices (large type) stay legible.
    await execFileP("convert", [srcBase + ".png", "-resize", "1000x", png]);
    const img = readFileSync(png).toString("base64");
    try {
      for (const o of extractJsonArray(await vision([img], buildDeliVisionPrompt()))) offersAll.push(o);
    } catch { pageFailures++; }
    if (i < pages.length - 1) await new Promise(r => setTimeout(r, 25000));
  }

  const fills = matchDeliOffers(offersAll);
  const filled = countFilled(fills);
  const matched = countMatched(fills);
  const dateRange = dateRangeLabel(range.validFrom, range.validThru);

  // Fill the template's Production sheet (JS, tested) then repack the xlsx (the
  // one thing Node stdlib can't do — python zip tool).
  const sheetXml = execFileSync("python3", [XLSX_TOOL, "extract", template, "xl/worksheets/sheet1.xml"]).toString();
  const filledXml = fillSheetXml(sheetXml, fills, dateRange);
  const tmpXml = join(dir, "sheet1-filled.xml");
  writeFileSync(tmpXml, filledXml);
  const dated = join(DATA_DIR, `deli-form-${range.validFrom || "latest"}.xlsx`);
  execFileSync("python3", [XLSX_TOOL, "replace", template, "xl/worksheets/sheet1.xml", tmpXml, dated]);

  const summary = fills.map(f => ({ item: f.item, brand: f.brand, price: f.price }));
  // Promote to the public /bulksale form only on a CLEAN, well-filled run. Any
  // page whose vision call failed → low-confidence, even if the surviving pages
  // filled >=8: a partial read that blanks Turkey/American must not overwrite a
  // good form.
  if (matched >= DELI_MIN_MATCHED && pageFailures === 0) {
    copyFileSync(dated, formLatest);
    return { state: "ok", filled, matched, pages, dateRange, fills: summary };
  }
  return { state: "low-confidence", filled, matched, pageFailures, pages, candidate: dated, fills: summary };
}

// The whole pipeline. Async; the route kicks this off and returns 202 without
// awaiting. Every stage updates status.json so the owner can poll. Injectable
// deps (fetchImpl, extractor) keep it drivable from a test/CLI without the real
// network — production passes neither and gets the real ones.
export async function processCircular(url, opts = {}) {
  const jobId = jobIdForUrl(url);
  const dir = jobDir(jobId);
  const extractor = opts.extractor || ((prompt) => claudeExtract(prompt));
  const fetchImpl = opts.fetchImpl || globalThis.fetch;

  ensureDir(dir);
  writeStatus(jobId, { url, state: "fetching", startedAt: new Date().toISOString(), error: null });

  try {
    // ── Fetch ────────────────────────────────────────────────────────────
    const pdfPath = join(dir, "circular.pdf");
    const resp = await fetchImpl(url, { redirect: "follow" });
    if (!resp.ok) throw new Error(`fetch ${resp.status}`);
    const buf = Buffer.from(await resp.arrayBuffer());
    if (buf.length > MAX_PDF_BYTES) throw new Error(`pdf too large (${buf.length} bytes)`);
    if (buf.length < 1000 || buf.slice(0, 5).toString() !== "%PDF-") throw new Error("not a PDF");
    writeFileSync(pdfPath, buf);

    // ── pdftotext per page (persist BEFORE extraction) ───────────────────
    const { stdout: info } = await execFileP("pdfinfo", [pdfPath]);
    const pageCount = parseInt((info.match(/Pages:\s*(\d+)/) || [])[1] || "0", 10);
    if (!pageCount) throw new Error("pdfinfo gave no page count");
    const pageTexts = [];
    for (let p = 1; p <= pageCount; p++) {
      // -raw keeps each offer tile's lines together (see circular-pipeline notes).
      const { stdout } = await execFileP("pdftotext", ["-raw", "-f", String(p), "-l", String(p), pdfPath, "-"], { maxBuffer: 32 * 1024 * 1024 });
      writeFileSync(join(dir, `p${p}.txt`), stdout);
      pageTexts.push({ page: p, text: stdout });
    }
    const range = parseValidRange(pageTexts.map(pt => pt.text).join("\n")) || {};
    writeStatus(jobId, { state: "text-ready", pageCount, validFrom: range.validFrom || null, validThru: range.validThru || null });

    // ── Extract (skip image-only pages with no text) ─────────────────────
    const worthy = pageTexts.filter(pt => pt.text.trim().length > 40);
    writeStatus(jobId, { state: "extracting", pagesToExtract: worthy.length });
    const perPage = await runPool(worthy, PAGE_CONCURRENCY, async (pt) => {
      const r = await extractPage(pt.page, pt.text, extractor);
      const cov = coverageCheck(pt.text, r.offers);
      return { ...r, missedCount: cov.missedCount, missed: cov.missed };
    });

    // ── Merge + persist ──────────────────────────────────────────────────
    const offers = mergeOffers(perPage);
    const coverage = perPage
      .filter(pp => pp.missedCount > 0)
      .map(pp => ({ page: pp.page, missedCount: pp.missedCount, missed: pp.missed.slice(0, 12) }));
    const result = {
      store: "ShopRite",
      validFrom: range.validFrom || null,
      validThru: range.validThru || null,
      sourceUrl: url,
      extractedAt: new Date().toISOString(),
      pageCount,
      offerCount: offers.length,
      offers,
    };
    writeFileSync(join(dir, "offers.json"), JSON.stringify(result, null, 1));
    writeFileSync(join(DATA_DIR, "latest.json"), JSON.stringify(result, null, 1));

    // Deli/cheese bulk-sale form — a follow-on step. The offers above are already
    // persisted, so a vision/rate-limit failure here degrades to a status note
    // and keeps the existing /bulksale form; it never sinks the job.
    let deliForm;
    try { deliForm = await generateDeliForm(dir, pageTexts, range); }
    catch (e) { deliForm = { state: "error", error: String((e && e.message) || e) }; }

    writeStatus(jobId, {
      state: "done", offerCount: offers.length,
      coverageFlags: coverage.length, coverage,
      validFrom: result.validFrom, validThru: result.validThru,
      deliForm,
    });
    pruneOldJobs();
    return { jobId, offerCount: offers.length, coverage, deliForm };
  } catch (e) {
    writeStatus(jobId, { state: "error", error: String((e && e.message) || e) });
    throw e;
  }
}

export { jobIdForUrl, DATA_DIR };
