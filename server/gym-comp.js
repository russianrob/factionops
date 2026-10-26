// Readings for the weekly gym competition, and the record of who won.
//
// The daily slackers snapshot is too coarse for a live board: it takes one
// reading every 20 hours, so a Sunday-to-Saturday window could easily have no
// reading near either boundary. This keeps its own series at a much finer
// cadence, which also means a week's start line is within minutes of midnight
// rather than within a day of it.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as store from "./store.js";
import { weekWindow, latestUpTo, baselineFor, standings, winnersOf, finaliseWeeks, monthBoard, finaliseMonths }
  from "./gym-comp-model.js";

// Torn reports gym energy per stat, and the four sum exactly to the total.
// Reading them separately buys the split — "all dex", "def 75% \u00b7 dex 25%" —
// and costs no extra call overall: each response carries `username`, so the
// roster read this used to make for names is gone.
const STAT_FIELD = { gymstrength: "str", gymdefense: "def", gymspeed: "spe", gymdexterity: "dex" };

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Worked out at call time, as blood-bags.js does, so a test that sets DATA_DIR
// first never touches the live files. On the server, DATA_DIR names this same
// data directory, so nothing moves.
const dir = () => path.join(process.env.DATA_DIR || path.join(__dirname, "data"), "gym-comp");
const FACTION = "42055";
const POLL_MS = 5 * 60 * 1000;
// Below the poll interval, or the freshness guard would skip every scheduled
// poll and the cadence would silently stay at whatever this is instead.
const MIN_GAP_MS = 4 * 60 * 1000;
// Full resolution for two days, then one an hour. At a reading every five
// minutes an untrimmed series is 288 a day — a hundred-odd megabytes of JSON
// within a season, re-parsed on every page load. Nothing needs that: scoring
// uses the reading nearest a week boundary and the latest one, and the frozen
// weekly results live in their own file.
const FULL_MS = 2 * 86400000;
const RETAIN_MS = 45 * 86400000;

const readingsFile = (f) => path.join(dir(), `${f}.json`);
const resultsFile = (f) => path.join(dir(), `${f}-results.json`);

function readJson(file, fallback) {
  try {
    if (!fs.existsSync(file)) return fallback;
    return JSON.parse(fs.readFileSync(file, "utf-8"));
  } catch { return fallback; }
}
function writeJson(file, data) {
  fs.mkdirSync(dir(), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data));
}

/**
 * Recent readings in full, older ones hourly, nothing past the retention age.
 *
 * Thinning keeps the LAST reading in each hour rather than the first, so the
 * one nearest a week boundary — which is the one a score is measured from —
 * survives.
 */
export function thin(readings, nowMs = Date.now()) {
  const keep = [];
  const seenHour = new Set();
  const sorted = (readings || []).slice().sort((a, b) => Number(a.at) - Number(b.at));
  for (let i = sorted.length - 1; i >= 0; i--) {
    const r = sorted[i];
    const at = Number(r.at);
    if (nowMs - at > RETAIN_MS) continue;
    // An imported baseline is never thinned away: it cannot be re-fetched. Nor
    // is the reading somebody first appears in: the monthly ladder measures a
    // mid-month joiner from it, and keeping only the hour's last reading would
    // drop whatever they trained in their first hour, two days after they joined.
    if (nowMs - at <= FULL_MS || r.imported || joinedIn(sorted[i - 1], r)) { keep.push(r); continue; }
    const hour = Math.floor(at / 3600000);
    if (seenHour.has(hour)) continue;
    seenHour.add(hour);
    keep.push(r);
  }
  return keep.sort((a, b) => Number(a.at) - Number(b.at));
}

// Somebody is in this reading who was not in the one before it.
function joinedIn(prev, r) {
  if (!prev) return false;
  const had = prev.members || {};
  return Object.keys(r.members || {}).some((id) => !had[id]);
}

// Parsed once per file change. /api/gym is polled by every viewer every minute,
// and re-reading megabytes of JSON for each of them is the kind of cost that
// only shows up once the faction is actually using it.
let _cache = { mtime: 0, readings: null };

export function readReadings(factionId = FACTION) {
  const file = readingsFile(factionId);
  let mtime = 0;
  try { mtime = fs.statSync(file).mtimeMs; } catch { return []; }
  if (_cache.readings && _cache.mtime === mtime) return _cache.readings;
  const readings = readJson(file, { readings: [] }).readings || [];
  _cache = { mtime, readings };
  return readings;
}
export function readResults(factionId = FACTION) {
  return readJson(resultsFile(factionId), { weeks: [] }).weeks || [];
}
// The saved months live in the same file as the weeks. A file written before
// months existed has none, which reads as none.
export function readMonths(factionId = FACTION) {
  return readJson(resultsFile(factionId), { months: [] }).months || [];
}

// Last failure, surfaced on the page. A poller that fails silently for four
// days is how the daily snapshot died without anyone noticing.
let lastError = null;
let lastOkAt = 0;

export function health() {
  const readings = readReadings();
  return {
    lastReadingAt: readings.length ? Number(readings[readings.length - 1].at) : 0,
    readings: readings.length,
    lastOkAt,
    lastError,
  };
}

async function fetchContributors(apiKey, stat) {
  const url = `https://api.torn.com/v2/faction/contributors?stat=${stat}&cat=current`
            + `&key=${encodeURIComponent(apiKey)}&comment=wb-gymcomp`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`contributors HTTP ${res.status}`);
  const data = await res.json();
  // Labelled by CALL, not just by code: "code 7" alone left us unable to say
  // whether it was contributors or the faction read that Torn refused.
  if (data.error) throw new Error(`${stat}: ${data.error.error} (code ${data.error.code})`);
  const c = data.contributors;
  return Array.isArray(c) ? c
    : Object.keys(c || {}).map((k) => ({ id: c[k].id ?? k, value: c[k].value, username: c[k].username }));
}

export async function pollOnce(factionId = FACTION, { force = false } = {}) {
  const readings = readReadings(factionId);
  const newest = readings.length ? Number(readings[readings.length - 1].at) : 0;
  if (!force && Date.now() - newest < MIN_GAP_MS) {
    return { ok: true, skipped: "recent", lastAt: newest };
  }

  const apiKey = store.getFactionApiKey(factionId);
  if (!apiKey) {
    lastError = "No faction API key saved. Set yours in warboard settings.";
    return { ok: false, reason: lastError };
  }

  const members = {};
  try {
    for (const [stat, field] of Object.entries(STAT_FIELD)) {
      const rows = await fetchContributors(apiKey, stat);
      for (const r of rows) {
        const id = String(r.id);
        if (!members[id]) members[id] = { energy: 0, name: r.username || id };
        const v = Number(r.value) || 0;
        members[id][field] = v;
        // The total is the sum of the four, which is what gymenergy reports —
        // verified against a live member: 70355+2310+15170+52485 = 140320.
        members[id].energy += v;
      }
    }
  } catch (err) {
    // All four or none. A partial set would record a total missing a stat, and
    // that total becomes somebody's start line for the rest of the week.
    lastError = err.message;
    console.error(`[gym-comp] ${err.message}`);
    return { ok: false, reason: err.message };
  }
  if (!Object.keys(members).length) {
    lastError = "contributors returned nobody";
    return { ok: false, reason: lastError };
  }

  readings.push({ at: Date.now(), members });
  writeJson(readingsFile(factionId), { factionId, readings: thin(readings) });
  _cache = { mtime: 0, readings: null };

  lastError = null;
  lastOkAt = Date.now();
  freeze(factionId);
  return { ok: true, members: Object.keys(members).length };
}

/**
 * Adopt Gym Coach's own baseline as our start line.
 *
 * Torn will not say what anybody's total was at midnight, so the ladder's first
 * reading defines the week — and on week one that reading landed at 01:55,
 * nearly two hours late. Gym Coach's faction board had already taken one at
 * 00:31 and kept it, so the earlier snapshot exists; it is simply on a phone
 * rather than here.
 *
 * Its `board.stats.gymenergy` is exactly the shape we store: member id to
 * cumulative energy, stamped with `board.at`. Importing it moves the start line
 * back to when that board began, and both then agree because they are reading
 * the same numbers from the same moment.
 *
 * Inserted in time order rather than appended: the readings list is assumed
 * sorted everywhere else, and a baseline belongs at the front.
 */
export function importBaseline(board, factionId = FACTION) {
  const at = Number(board && board.at);
  const stats = board && board.stats && board.stats.gymenergy;
  if (!at || !isFinite(at) || !stats || typeof stats !== "object") {
    return { ok: false, reason: "Not a Gym Coach board: needs .at and .stats.gymenergy" };
  }

  const readings = readReadings(factionId);
  const existing = readings.find((r) => Number(r.at) === at);
  const extra = (board.stats && board.stats.perStat) || null;

  // Already imported, and now offered the per-stat detail it lacked: enrich it
  // rather than refuse. Without stats in the BASELINE there is nothing to
  // subtract from, so the split stays blank all week however many per-stat
  // readings follow it.
  if (existing) {
    if (!extra) return { ok: false, reason: "A reading already exists at that exact moment" };
    let n = 0;
    for (const [id, per] of Object.entries(extra)) {
      const m = existing.members[String(id)];
      if (!m) continue;
      for (const f of ["str", "def", "spe", "dex"]) {
        const v = Number(per[f]);
        if (isFinite(v)) m[f] = v;
      }
      n++;
    }
    if (!n) return { ok: false, reason: "None of those members are in the stored baseline" };
    writeJson(readingsFile(factionId), { factionId, readings });
    _cache = { mtime: 0, readings: null };
    return { ok: true, at, members: n, enriched: true };
  }

  // Names from whatever we have already read; the board itself carries ids.
  const names = {};
  for (const r of readings) {
    for (const [id, m] of Object.entries(r.members || {})) if (m.name) names[id] = m.name;
  }

  const members = {};
  for (const [id, v] of Object.entries(stats)) {
    const energy = Number(v);
    if (!isFinite(energy)) continue;
    const m = { energy, name: names[String(id)] || String(id) };
    const per = board.stats.perStat && board.stats.perStat[String(id)];
    if (per) for (const f of ["str", "def", "spe", "dex"]) {
      const v = Number(per[f]);
      if (isFinite(v)) m[f] = v;
    }
    members[String(id)] = m;
  }
  if (!Object.keys(members).length) return { ok: false, reason: "No usable member totals in that board" };

  readings.push({ at, members, imported: true });
  readings.sort((a, b) => Number(a.at) - Number(b.at));
  writeJson(readingsFile(factionId), { factionId, readings });
  _cache = { mtime: 0, readings: null };
  return { ok: true, at, members: Object.keys(members).length };
}

/** Record any week, and any month, that has ended since the last look. */
export function freeze(factionId = FACTION, nowMs = Date.now()) {
  const readings = readReadings(factionId);
  const done = readResults(factionId);
  const doneMonths = readMonths(factionId);
  const fresh = finaliseWeeks(readings, done, nowMs);
  const freshMonths = finaliseMonths(readings, doneMonths, nowMs);
  if (!fresh.length && !freshMonths.length) return [];
  // One file holds both, so every write carries the other forward: freezing a
  // week must not drop the months, and saving a month must not drop the weeks.
  const weeks = done.concat(fresh).sort((a, b) => b.weekStart - a.weekStart);
  const months = doneMonths.concat(freshMonths).sort((a, b) => b.monthStart - a.monthStart);
  writeJson(resultsFile(factionId), { factionId, weeks, months });
  for (const w of fresh) {
    console.log(`[gym-comp] week ${new Date(w.weekStart).toISOString().slice(0, 10)} won by `
      + w.winners.map((x) => `${x.name} (${x.energy})`).join(", "));
  }
  for (const m of freshMonths) {
    console.log(`[gym-comp] month ${new Date(m.monthStart).toISOString().slice(0, 7)} saved: `
      + `top ${m.top.length}, led by ${m.top[0].name} (${m.top[0].energy})`);
  }
  return fresh;
}

/** Everything the page needs, in one shape. */
export function board(factionId = FACTION, nowMs = Date.now()) {
  const readings = readReadings(factionId);
  const w = weekWindow(nowMs);
  // A week whose first reading lands after midnight is still scored — from
  // that reading, for everyone alike — and the page is told it started late.
  const { reading: base, late } = baselineFor(readings, w.start);
  const now = latestUpTo(readings, nowMs);
  const rows = standings(base, now);
  return {
    week: { start: w.start, end: w.end },
    standings: rows,
    leaders: winnersOf(rows),
    baselineAt: base ? Number(base.at) : 0,
    lateStart: late,
    currentAt: now ? Number(now.at) : 0,
    history: readResults(factionId),
    month: monthBoard(readings, nowMs),
    months: readMonths(factionId),
    health: health(),
  };
}

export function start() {
  pollOnce().catch((e) => console.error("[gym-comp] first poll failed:", e.message));
  setInterval(() => {
    pollOnce().catch((e) => console.error("[gym-comp] poll failed:", e.message));
  }, POLL_MS);
  console.log(`[gym-comp] polling every ${POLL_MS / 60000} min`);
}
