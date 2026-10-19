// The daily job behind /hof: saves Torn's faction snapshot for every UTC day
// and rebuilds the digest the page reads.
//
// Torn keeps each day's file for only about a month, so a day this job misses
// is gone for good. It runs at 00:05 UTC, catches up 60 s after every start,
// and retries a day Torn hasn't published yet every 15 minutes. A restart with
// nothing missing makes no calls. Design:
// docs/superpowers/specs/2026-10-19-hof-respect-climb-design.md.
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync, gzipSync } from "node:zlib";
import nodeCron from "node-cron";
import { tornGet } from "./hof-torn.js";
import { DIGEST_VERSION, addDays, computeDigest, dayMs, historyEntry, utcDay } from "./hof-climb.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const WINDOW_DAYS = 45;              // today and the 44 days before it
const KEEP_DAYS = 100;               // the 90-day window's limit is 99
const RETRY_MS = 15 * 60 * 1000;
const BOOT_DELAY_MS = 60 * 1000;
const CALL_GAP_MS = 1100;
const KEY_CODES = new Set([1, 2, 10, 13, 16, 18]);
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

// Worked out at call time, so a test that sets DATA_DIR first never touches
// the live directory.
export const defaultDataDir = () => join(process.env.DATA_DIR || join(__dirname, "data"), "hof");

function context(opts = {}) {
  return {
    dir: opts.dataDir || defaultDataDir(),
    fetchImpl: opts.fetchImpl || fetch,
    nowFn: opts.nowFn || (() => Date.now()),
    key: opts.key !== undefined ? opts.key : process.env.OWNER_API_KEY,
    factionId: String(opts.factionId || process.env.OWNER_FACTION_ID || "42055"),
    sleep: opts.sleep || ((ms) => new Promise((resolve) => setTimeout(resolve, ms))),
    lastCallAt: -Infinity,
  };
}

const rawPath = (ctx, day) => join(ctx.dir, "raw", `${day}.csv.gz`);
const dayPath = (ctx, day) => join(ctx.dir, "days", `${day}.json`);
const digestPath = (ctx) => join(ctx.dir, "digest.json");
const attemptsPath = (ctx) => join(ctx.dir, "attempts.json");

// A temporary name, then a rename: pm2 often stops warboard with SIGKILL, and
// nothing may ever read half a file.
function writeAtomic(file, data) {
  mkdirSync(dirname(file), { recursive: true });
  const tmp = `${file}.tmp-${process.pid}`;
  writeFileSync(tmp, data);
  renameSync(tmp, file);
}

function readJson(file) {
  try { return JSON.parse(readFileSync(file, "utf8")); } catch { return null; }
}

// ── parsing ─────────────────────────────────────────────────────────────
// Torn's CSV: a header row, then one row per faction. Fields may be quoted,
// quotes inside them are doubled, and member_list holds commas.
export function parseSnapshotCsv(text) {
  const rows = [];
  let row = [], field = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else quoted = false; }
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (c !== "\r") field += c;
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  const header = rows.shift() || [];
  const columns = Object.fromEntries(header.map((h, i) => [h.trim(), i]));
  const good = rows.filter((r) => r.length === header.length);
  return { columns, rows: good, skipped: rows.length - good.length };
}

// The day's id → respect for every faction with any, and id → name for all.
export function snapshotFacts(parsed) {
  const { columns: c, rows } = parsed;
  for (const col of ["id", "name", "respect"]) {
    if (!(col in c)) throw new Error(`snapshot has no ${col} column`);
  }
  const respect = {}, names = {};
  for (const r of rows) {
    const id = r[c.id].trim(), v = Number(r[c.respect]);
    if (!/^\d+$/.test(id)) continue;
    names[id] = r[c.name];
    if (v > 0) respect[id] = v;
  }
  return { respect, names, count: Object.keys(respect).length, skipped: parsed.skipped };
}

// ── which days a run wants ──────────────────────────────────────────────
function savedDaysIn(ctx) {
  let names;
  try { names = readdirSync(join(ctx.dir, "days")); } catch { return []; }
  return names.filter((n) => n.endsWith(".json") && DAY_RE.test(n.slice(0, -5))).map((n) => n.slice(0, -5)).sort();
}
export const savedDays = (opts) => savedDaysIn(context(opts));

const readAttempts = (ctx) => readJson(attemptsPath(ctx)) || {};

// A past day that answered code 30 is asked again only on a later UTC date.
function recordAttempt(ctx, day, today) {
  const attempts = readAttempts(ctx), oldest = addDays(today, -(WINDOW_DAYS - 1));
  attempts[day] = today;
  for (const d of Object.keys(attempts)) if (d < oldest) delete attempts[d];
  writeAtomic(attemptsPath(ctx), JSON.stringify(attempts));
}

// Newest first: the 45-day window minus saved days, minus past days that
// already answered code 30 today. Older days are never requested.
function missingIn(ctx) {
  const today = utcDay(ctx.nowFn()), have = new Set(savedDaysIn(ctx)), asked = readAttempts(ctx);
  const out = [];
  for (let i = 0; i < WINDOW_DAYS; i++) {
    const day = addDays(today, -i);
    if (have.has(day)) continue;
    if (i > 0 && asked[day] === today) continue;
    out.push(day);
  }
  return out;
}
export const missingDays = (opts) => missingIn(context(opts));
