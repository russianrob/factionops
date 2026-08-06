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

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import {
  mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync, statSync, rmSync,
} from "node:fs";
import { join } from "node:path";
import {
  jobIdForUrl, parseValidRange, mergeOffers, coverageCheck, extractPage, claudeExtract,
} from "./circular-pipeline.js";

const execFileP = promisify(execFile);

const DATA_DIR = process.env.CIRCULAR_DIR || "/opt/warboard/server/data/circular";
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
    writeStatus(jobId, {
      state: "done", offerCount: offers.length,
      coverageFlags: coverage.length, coverage,
      validFrom: result.validFrom, validThru: result.validThru,
    });
    pruneOldJobs();
    return { jobId, offerCount: offers.length, coverage };
  } catch (e) {
    writeStatus(jobId, { state: "error", error: String((e && e.message) || e) });
    throw e;
  }
}

export { jobIdForUrl, DATA_DIR };
