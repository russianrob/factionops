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

// ── Torn calls ──────────────────────────────────────────────────────────
// At least 1.1 s after the run's previous call. Code 5 (too many requests)
// waits 2 s, then 1.8 times longer each time, for up to 5 retries.
async function call(ctx, path, params, timeoutMs) {
  for (let retry = 0; ; retry++) {
    const wait = ctx.lastCallAt + CALL_GAP_MS - ctx.nowFn();
    if (wait > 0) await ctx.sleep(wait);
    ctx.lastCallAt = ctx.nowFn();
    const r = await tornGet(path, params, { key: ctx.key, fetchImpl: ctx.fetchImpl, source: "hof-snapshots", timeoutMs });
    if (r.ok || r.code !== 5 || retry === 5) return r;
    await ctx.sleep(Math.round(2000 * 1.8 ** retry));
  }
}

// The snapshot's factions that the Hall of Fame leaves out. Pages the Hall of
// Fame until it covers 200 places below us (5 calls at #250), then compares it
// with the snapshot's top P + 100 by respect.
async function hiddenFor(ctx, respect) {
  const shown = new Set();
  let us = null;
  for (let page = 0; page < 20; page++) {
    const r = await call(ctx, "/torn/factionhof", { cat: "respect", limit: 100, offset: page * 100 }, 30000);
    if (!r.ok) return { ok: false, code: r.code };
    let list;
    try { list = JSON.parse(r.text).factionhof; } catch { list = null; }
    if (!Array.isArray(list)) return { ok: false, code: "bad_reply" };
    for (const row of list) {
      shown.add(String(row.id));
      if (String(row.id) === ctx.factionId) us = row.position;
    }
    if (list.length < 100) break;
    if (us !== null && (page + 1) * 100 >= us + 200) break;
  }
  if (us === null) return { ok: false, code: "not_listed" };
  const top = Object.keys(respect)
    .sort((a, b) => respect[b] - respect[a] || Number(a) - Number(b))
    .slice(0, us + 100);
  return { ok: true, position: us, hidden: top.filter((id) => !shown.has(id)).map(Number) };
}
export const detectHidden = (opts, respect) => hiddenFor(context(opts), respect);

// ── one run ─────────────────────────────────────────────────────────────
// A saved raw file stands in for a fetch. In a run, a copy that won't unzip or
// parse is deleted so it is fetched again; the digest build never deletes one.
function readRaw(ctx, day, deleteBroken) {
  const file = rawPath(ctx, day);
  if (!existsSync(file)) return null;
  try {
    return snapshotFacts(parseSnapshotCsv(gunzipSync(readFileSync(file)).toString("utf8")));
  } catch {
    if (deleteBroken) { try { unlinkSync(file); } catch {} }
    return null;
  }
}

function newestDayIn(ctx) {
  const days = savedDaysIn(ctx);
  for (let i = days.length - 1; i >= 0; i--) {
    const j = readJson(dayPath(ctx, days[i]));
    if (j && j.respect) return j;
  }
  return null;
}

// Fetch (or reuse) every wanted day, newest first, then rebuild the digest.
// Resolves to a summary and never rejects for a Torn or disk failure.
export async function runOnce(opts = {}) {
  const ctx = context(opts);
  const today = utcDay(ctx.nowFn());
  const out = { saved: [], waiting: [], hidden: null, retry: false, keyError: false, error: null, digest: null };
  const newest = newestDayIn(ctx);
  let baseline = newest ? Object.keys(newest.respect).length : null;
  let hidden = null;

  for (const day of missingIn(ctx)) {
    try {
      let facts = readRaw(ctx, day, true);
      if (!facts) {
        const r = await call(ctx, "/faction/snapshot", { timestamp: dayMs(day) / 1000 }, 120000);
        if (!r.ok) {
          if (r.code === 30) {
            out.waiting.push(day);
            if (day === today) out.retry = true;
            else recordAttempt(ctx, day, today);
            continue;
          }
          if (KEY_CODES.has(r.code)) { out.keyError = true; out.error = `key problem (code ${r.code})`; break; }
          out.error = `snapshot ${day}: ${r.code} ${r.message || ""}`.trim();
          out.retry = true;
          break;
        }
        facts = snapshotFacts(parseSnapshotCsv(r.text));
        if (baseline !== null && facts.count < 0.9 * baseline) {
          throw new Error(`only ${facts.count} factions with respect against ${baseline} on the newest saved day`);
        }
        writeAtomic(rawPath(ctx, day), gzipSync(r.text));
      }
      if (hidden === null) {
        const h = await hiddenFor(ctx, facts.respect);
        const previous = h.ok ? null : newestDayIn(ctx);
        if (h.ok) hidden = h.hidden;
        else if (previous) hidden = previous.hidden || [];
        else {
          // No list at all yet: keep the raw files, write no day files, and let
          // the next run build them without fetching again.
          out.error = `hall of fame check: ${h.code}`;
          out.retry = true;
          break;
        }
        out.hidden = hidden;
      }
      writeAtomic(dayPath(ctx, day), JSON.stringify({ day, respect: facts.respect, hidden }));
      out.saved.push(day);
      if (baseline === null) baseline = facts.count;
    } catch (e) {
      out.error = `${day}: ${e.message}`;
      out.retry = true;
      break;
    }
  }

  try {
    if (out.saved.length || digestStale(ctx)) {
      const d = buildIn(ctx);
      if (d) out.digest = { day: d.day, position: d.midnight ? d.midnight.position : null };
    }
  } catch (e) {
    out.error = out.error || `digest: ${e.message}`;
    out.retry = true;
  }
  return out;
}

// ── the digest ──────────────────────────────────────────────────────────
function digestStale(ctx) {
  const days = savedDaysIn(ctx);
  if (!days.length) return false;
  const d = readJson(digestPath(ctx));
  return !d || d.version !== DIGEST_VERSION || d.day < days[days.length - 1];
}

// A day file that won't parse is rebuilt from its raw file; with no usable raw
// file the day is left out.
function readDayFile(ctx, day, fallbackHidden) {
  const j = readJson(dayPath(ctx, day));
  if (j && j.respect) return j;
  const facts = readRaw(ctx, day, false);
  if (!facts) {
    console.warn(`[hof] ${day}: day file unreadable and no usable raw file; left out`);
    return null;
  }
  const rebuilt = { day, respect: facts.respect, hidden: fallbackHidden() };
  writeAtomic(dayPath(ctx, day), JSON.stringify(rebuilt));
  console.warn(`[hof] ${day}: day file was unreadable; rebuilt from the raw file`);
  return rebuilt;
}

function buildIn(ctx) {
  const days = savedDaysIn(ctx);
  if (!days.length) return null;
  let newestHidden = null;
  const fallbackHidden = () => {
    if (newestHidden === null) newestHidden = (newestDayIn(ctx) || {}).hidden || [];
    return newestHidden;
  };
  const keepFrom = addDays(days[days.length - 1], -KEEP_DAYS);
  const byDay = {}, history = [];
  for (const day of days) {
    const data = readDayFile(ctx, day, fallbackHidden);
    if (!data) continue;
    const h = historyEntry(day, data, ctx.factionId);
    if (h.position !== null) history.push(h);
    if (day >= keepFrom) byDay[day] = data;
  }
  const latest = Object.keys(byDay).sort().pop();
  if (!latest) return null;
  const facts = readRaw(ctx, latest, false);
  const digest = computeDigest({
    byDay, history, names: facts ? facts.names : {}, factionId: ctx.factionId, builtAt: ctx.nowFn(),
  });
  writeAtomic(digestPath(ctx), JSON.stringify(digest));
  return digest;
}
export const buildDigest = (opts) => buildIn(context(opts));
