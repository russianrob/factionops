// Pre-war scouting from FFScouter's activity feed.
//
// FFScouter will report ANY faction's activity, not just your own — that is
// the whole basis of this module. Bucket an opponent's last fortnight by hour
// and you get their coverage curve: when they are thin, when they surge, and
// which hours they cannot cover at all.
//
// The useful output is not their trough. It is the GAP between their curve and
// ours, because an hour they cannot cover is worth nothing if we cannot field
// people in it either. Measured against The Rifle Medics (26154), their
// weakest hour was 06:00 TCT but the best hour to declare was 07:00 — and
// 15:00, nowhere near their trough, came third because our own coverage there
// is strong.
//
// Two facts about the API that are not in its OpenAPI spec, both measured:
//
//   * `activity_score` and `active_players` are the same number under two
//     names — identical in every bucket of a 24-hour sample. Only
//     `active_ratio` is worth reading, because it normalises for roster size
//     and therefore lets two factions be compared at all.
//
//   * The activity endpoints allow TEN requests per minute, not the hundred
//     the spec documents for player-flights/batch. Exceeding it returns
//     code 20.

import fs from "fs";
import path from "path";
import { summariseWar } from "./war-window.js";

export const HOUR = 3600;
export const DAY = 86400;

// The rate limit is per FFScouter ACCOUNT and warboard holds one faction key,
// so every reader of this page draws on the same budget. Pacing has to be
// global to this process, not per request. 6000ms would sit exactly on the
// 10/min line and trip intermittently; 7s leaves room.
export const SPACING_MS = 7000;

const BASE = "https://ffscouter.com/api/v1";
const CACHE_DIR = new URL("./data/prewar-cache/", import.meta.url).pathname;

/**
 * Average `active_ratio` for each hour of the UTC day.
 *
 * UTC deliberately: Torn schedules in TCT and TCT is UTC. Reading these with
 * local getters would shift the whole curve by the host's offset, and this
 * host runs on CEST — a two-hour error in the one number the page exists to
 * produce.
 *
 * Averaging is what makes the curve trustworthy: a single dead Tuesday at
 * 03:00 should not read as a permanent hole in their coverage.
 */
export function hourCurve(buckets) {
  const sums = new Array(24).fill(0);
  const counts = new Array(24).fill(0);
  for (const b of buckets || []) {
    if (!b || typeof b.ts !== "number") continue;
    const h = new Date(b.ts * 1000).getUTCHours();
    sums[h] += Number(b.active_ratio) || 0;
    counts[h] += 1;
  }
  // An hour with no samples is 0, never NaN: NaN sorts unpredictably and would
  // quietly corrupt the edge table rather than failing visibly.
  return sums.map((s, h) => (counts[h] ? s / counts[h] : 0));
}

/**
 * Hours ranked by how much better covered we are than they are.
 *
 * Both sides are carried through so the page can show its working — an
 * unexplained ranking is one nobody acts on.
 */
export function edgeTable(ourCurve, theirCurve) {
  const n = Math.max(ourCurve.length, theirCurve.length);
  const rows = [];
  for (let h = 0; h < n; h++) {
    const us = Number(ourCurve[h]) || 0;
    const them = Number(theirCurve[h]) || 0;
    rows.push({ hour: h, us, them, gap: us - them });
  }
  return rows.sort((a, b) => b.gap - a.gap);
}

/**
 * One cached answer per faction, per window, per UTC day.
 *
 * A fortnight's average barely moves overnight, so a daily refresh is as good
 * as a live call and costs one request instead of one per page load. With a
 * 10/min ceiling shared across every reader, that difference is the whole
 * reason the page is usable.
 *
 * The result becomes a filename, so anything that could escape the directory
 * is stripped rather than escaped.
 */
export function cacheKeyFor(factionId, days, nowMs) {
  const day = new Date(nowMs).toISOString().slice(0, 10);
  const safe = String(factionId).replace(/[^0-9A-Za-z_-]/g, "");
  return `${safe || "none"}-${Number(days) || 0}d-${day}`;
}

/** How long to wait before the next call, given when the last one went out. */
export function nextDelay(lastAtMs, nowMs, spacing = SPACING_MS) {
  if (lastAtMs == null) return 0;
  return Math.max(0, spacing - (nowMs - lastAtMs));
}

// ── The paced, cached fetch ────────────────────────────────────
// Everything above is pure. Everything below is the thin shell around it.

let _lastCallAt = null;
let _chain = Promise.resolve();

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Serialise every outbound call through one chain so concurrent readers
 * cannot collectively exceed the shared per-account limit. Two admins opening
 * the page at once must queue, not race.
 */
function paced(fn) {
  const run = _chain.then(async () => {
    await sleep(nextDelay(_lastCallAt, Date.now()));
    _lastCallAt = Date.now();
    return fn();
  });
  // Keep the chain alive even when a link rejects, or one failure would
  // deadlock every later request behind it.
  _chain = run.then(() => {}, () => {});
  return run;
}

function cachePathFor(key) {
  return path.join(CACHE_DIR, `${key}.json`);
}

function readCache(key) {
  try {
    return JSON.parse(fs.readFileSync(cachePathFor(key), "utf-8"));
  } catch {
    return null;
  }
}

function writeCache(key, value) {
  try {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
    fs.writeFileSync(cachePathFor(key), JSON.stringify(value));
  } catch (e) {
    // A cache that cannot be written is slow, not broken. Never fail the
    // request over it.
    console.warn(`[prewar] cache write failed: ${e.message}`);
  }
}

/**
 * A faction's hourly curve over the last `days`, cached for the UTC day.
 *
 * Returns { curve, buckets, memberCount, cached }.
 */
export async function factionCurve(ffsKey, factionId, days = 14, nowMs = Date.now()) {
  const key = cacheKeyFor(factionId, days, nowMs);
  const hit = readCache(key);
  if (hit) return { ...hit, cached: true };

  const now = Math.floor(nowMs / 1000);
  const end = now - (now % HOUR);
  const start = end - days * DAY;

  const qs = new URLSearchParams({
    key: ffsKey, faction_id: String(factionId),
    start: String(start), end: String(end), bucket: String(HOUR),
  });

  const res = await paced(() => fetch(`${BASE}/activity/faction?${qs}`));
  const body = await res.json().catch(() => null);

  // The API signals failure two ways and a non-zero `code` can ride along with
  // HTTP 200, so both are checked.
  if (!res.ok || !body || (body.code != null && body.code !== 0)) {
    const code = body?.code;
    const err = new Error(body?.error || `HTTP ${res.status}`);
    err.code = code;
    // 20/21 are throttling. They say nothing about the faction or the key, so
    // the caller must not cache or report them as "no data".
    err.retryable = code === 20 || code === 21 || res.status === 429;
    throw err;
  }

  const out = {
    curve: hourCurve(body.buckets),
    memberCount: body.meta?.member_count ?? null,
    bucketCount: (body.buckets || []).length,
    factionId: String(factionId),
    days,
  };
  writeCache(key, out);
  return { ...out, cached: false };
}

/** Both curves plus the ranked gap between them. */
export async function scout(ffsKey, ourFactionId, enemyFactionId, days = 14, nowMs = Date.now()) {
  const ours = await factionCurve(ffsKey, ourFactionId, days, nowMs);
  const theirs = await factionCurve(ffsKey, enemyFactionId, days, nowMs);
  return {
    days,
    ours: { factionId: ours.factionId, curve: ours.curve, memberCount: ours.memberCount },
    theirs: { factionId: theirs.factionId, curve: theirs.curve, memberCount: theirs.memberCount },
    edge: edgeTable(ours.curve, theirs.curve),
    cached: ours.cached && theirs.cached,
  };
}

// ── War-window activity ────────────────────────────────────────
// A faction's baseline curve turned out to be a poor guide to how they
// actually fight: measured on war 49287, both sides ran far above baseline,
// and the baseline's top-ranked hour was not the war's best. So the useful
// question is not "when are they usually online" but "what do they do once a
// war starts" — which the same endpoint answers, given the war's own
// timestamps and 730 days of retention behind it.

/**
 * Activity across one war's exact window.
 *
 * A finished war never changes, so its entry is cached permanently rather
 * than per day. An unfinished one still moves, so it is not cached at all.
 */
export async function warWindowActivity(ffsKey, factionId, war) {
  const start = Number(war.start) || 0;
  const end = Number(war.end) || 0;
  if (!start || !end) return [];          // still running; nothing settled to cache

  const safe = String(factionId).replace(/[^0-9A-Za-z_-]/g, "");
  const key = `war-${String(war.id).replace(/[^0-9A-Za-z_-]/g, "")}-${safe}`;
  const hit = readCache(key);
  if (hit) return hit.buckets || [];

  const qs = new URLSearchParams({
    key: ffsKey, faction_id: String(factionId),
    start: String(start), end: String(end), bucket: String(HOUR),
  });
  const res = await paced(() => fetch(`${BASE}/activity/faction?${qs}`));
  const body = await res.json().catch(() => null);
  if (!res.ok || !body || (body.code != null && body.code !== 0)) {
    const err = new Error(body?.error || `HTTP ${res.status}`);
    err.code = body?.code;
    err.retryable = body?.code === 20 || body?.code === 21 || res.status === 429;
    throw err;
  }
  const buckets = body.buckets || [];
  writeCache(key, { buckets });
  return buckets;
}

/**
 * Every recent war a faction fought, with how they were covered through it.
 *
 * `wars` comes from Torn (fetchRankedWarHistory); the activity for each comes
 * from FFScouter. One call per war, all cached permanently once the war has
 * ended — so a faction costs its calls once and never again.
 */
export async function warProfile(ffsKey, wars, factionId) {
  const out = [];
  for (const w of wars || []) {
    let buckets = [];
    try {
      buckets = await warWindowActivity(ffsKey, factionId, w);
    } catch (e) {
      // One unreadable window must not lose the other four wars.
      if (!e.retryable) console.warn(`[prewar] war ${w.id} activity failed: ${e.message}`);
    }
    out.push(summariseWar(w, factionId, buckets));
  }
  return out;
}
