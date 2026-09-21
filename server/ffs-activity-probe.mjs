#!/usr/bin/env node
//
// What FFScouter's /activity endpoints will and will not tell us.
//
//   node ffs-activity-probe.mjs <ffscouter-key> [ourFaction] [theirFaction]
//
// Read-only. Nothing is written, nothing is cached, and the key is never
// printed or stored — it only ever goes into a query string.
//
// Three questions the OpenAPI spec does not answer, and the whole reason this
// exists:
//
//   Q1  What is `activity_score`? The spec never defines it. In the example it
//       is 41 while `active_players` is also 41, so either they are the same
//       number under two names or they diverge somewhere the example does not
//       show. Building a report on a field nobody can define is how you ship a
//       number you cannot explain when somebody asks.
//
//   Q2  How far back does tracking go? There is an error for "start or end
//       before activity tracking began" but no stated retention. A fortnight's
//       lookback is only worth building if a fortnight exists.
//
//   Q3  Does an arbitrary faction_id work, or does it quietly restrict to your
//       own faction? Everything interesting here — reading an opponent's
//       coverage curve before declaring — rests on this one answer.
//
// The activity endpoints enforce 10 requests/min, not the 100 the spec
// documents elsewhere. Measured, not read. Paced at 7s, so a full run is a
// couple of minutes.

const BASE = "https://ffscouter.com/api/v1";
const HOUR = 3600, DAY = 86400;

// The key may come from the environment instead of argv. argv is visible to
// anyone who can run `ps`, and it lands in shell history; FFS_KEY=... in front
// of the command does neither.
const argv = process.argv.slice(2);
const KEY = process.env.FFS_KEY || argv.shift();
const [OURS = "42055", THEIRS = "26154"] = argv;
if (!KEY) {
  console.error("usage: FFS_KEY=<key> node ffs-activity-probe.mjs [ourFaction] [theirFaction]");
  console.error("   or: node ffs-activity-probe.mjs <ffscouter-key> [ourFaction] [theirFaction]");
  process.exit(1);
}

// The activity endpoints allow TEN requests per minute, not the hundred the
// spec documents for player-flights/batch. Measured, not read: at 700ms
// spacing every call after the first came back code 20. 7s leaves headroom
// without being slower than it has to be.
const SPACING_MS = 7000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let calls = 0;

/** A rate-limited answer is not an answer — it must never reach a verdict. */
const isRateLimited = (r) =>
  r.status === 429 || (r.body && (r.body.code === 20 || r.body.code === 21));

/**
 * One GET. Returns { ok, status, body } and never throws, because half the
 * point of a probe is to see the refusals clearly — a thrown error at the
 * first 400 would hide every answer after it.
 *
 * Rate limits are retried rather than returned. The first version of this
 * reported "enemy profiling NOT possible" off a code 20, which is precisely
 * the false conclusion a probe exists to prevent: a throttled call says
 * nothing whatever about permission.
 */
async function get(path, params, tries = 4) {
  const qs = new URLSearchParams({ key: KEY, ...params }).toString();
  for (let attempt = 1; ; attempt++) {
    await sleep(SPACING_MS);
    calls++;
    let r;
    try {
      const res = await fetch(`${BASE}${path}?${qs}`);
      const body = await res.json().catch(() => null);
      r = { ok: res.ok, status: res.status, body };
    } catch (e) {
      r = { ok: false, status: 0, body: { error: String(e.message) } };
    }
    if (!isRateLimited(r) || attempt >= tries) return r;
    // Back off a whole window; the limit is per minute, so a short retry
    // just spends another call to be told the same thing.
    process.stderr.write(`    (rate limited, waiting ${15 * attempt}s)\n`);
    await sleep(15000 * attempt);
  }
}

/** The API reports failure two ways: HTTP status, and a non-zero `code`. */
function failed(r) {
  return !r.ok || !r.body || (r.body.code != null && r.body.code !== 0);
}
function why(r) {
  if (!r.body) return `HTTP ${r.status}, no body`;
  return `code ${r.body.code ?? "?"} — ${r.body.error || `HTTP ${r.status}`}`;
}

const now = Math.floor(Date.now() / 1000);
/** Bucket boundaries are cleaner to read when the window is hour-aligned. */
const topOfHour = (t) => t - (t % HOUR);

async function activityFaction(fid, start, end, bucket = HOUR) {
  return get("/activity/faction", { faction_id: fid, start, end, bucket });
}

// ── 0. Is the key usable at all? ───────────────────────────────
// Everything below is noise if it is not, and check-key says so in one call
// rather than leaving you to infer it from four different 400s.

console.log("── key ──");
const ck = await get("/check-key", {});
if (!ck.body || ck.body.is_registered !== true) {
  console.log(`  NOT REGISTERED (…${KEY.slice(-4)}) — register it at ffscouter.com first`);
  console.log(`  ${why(ck)}`);
  process.exit(1);
}
console.log(`  registered  …${KEY.slice(-4)}  faction=${ck.body.faction_id ?? "none"}  premium=${ck.body.is_premium}`);

// ── Q3. Can we read a faction that is not ours? ────────────────
// Asked first because it is one call and it decides whether the interesting
// use case exists at all. Both windows are identical so the only variable is
// which faction is named.

console.log("\n── Q3: arbitrary faction_id ──");
const win = { start: topOfHour(now - DAY), end: topOfHour(now) };
const mine = await activityFaction(OURS, win.start, win.end);
const other = await activityFaction(THEIRS, win.start, win.end);

console.log(`  own faction   ${OURS}: ${failed(mine) ? "REFUSED — " + why(mine) : "ok, " + (mine.body.buckets || []).length + " buckets"}`);
console.log(`  other faction ${THEIRS}: ${failed(other) ? "REFUSED — " + why(other) : "ok, " + (other.body.buckets || []).length + " buckets"}`);

// Three outcomes, not two. "Could not tell" is a real result and has to be
// said out loud rather than collapsed into "not possible".
const canScout = !failed(other);
if (canScout) {
  console.log("  VERDICT: enemy activity profiling is POSSIBLE");
} else if (isRateLimited(other) || isRateLimited(mine)) {
  console.log("  VERDICT: UNKNOWN — still throttled after retries, rerun in a few minutes");
} else if (!failed(mine)) {
  // Our own faction read fine and theirs did not, under identical windows.
  // That is the only shape that actually demonstrates a restriction.
  console.log("  VERDICT: own faction only — the other faction was refused on its own merits");
} else {
  console.log("  VERDICT: UNKNOWN — neither faction was readable, so nothing is proven");
}

// ── Q1. What is activity_score? ────────────────────────────────
// Compared against active_players across every bucket we hold. If they never
// differ, the two fields are one field and the report should say
// "members online" rather than inventing a meaning for "score".

console.log("\n── Q1: activity_score vs active_players ──");
const sample = failed(mine) ? other : mine;
if (failed(sample)) {
  console.log("  no readable buckets — skipped");
} else {
  const b = sample.body.buckets || [];
  const diffs = b.filter((x) => x.activity_score !== x.active_players);
  const mc = sample.body.meta?.member_count;
  console.log(`  member_count=${mc}  buckets=${b.length}  differing=${diffs.length}`);
  for (const x of b.slice(0, 5)) {
    const t = new Date(x.ts * 1000).toISOString().slice(11, 16);
    // active_ratio is the field that normalises for faction size, which is
    // what makes two factions comparable at all.
    console.log(`    ${t}  score=${String(x.activity_score).padStart(4)}  active=${String(x.active_players).padStart(4)}  ratio=${x.active_ratio}`);
  }
  if (diffs.length) {
    const d = diffs[0];
    console.log(`  VERDICT: DIFFERENT fields — e.g. score=${d.activity_score} vs active=${d.active_players}`);
    console.log(`           score is NOT a headcount; find out what it weights before reporting it`);
  } else {
    console.log(`  VERDICT: identical in every bucket — treat as one number ("members online")`);
  }
  // Does a finer bucket change the picture, or is 5-minute data just the
  // hourly number redistributed? Decides whether fine buckets are worth the
  // extra response size.
  const fine = await activityFaction(sample.body.meta.subject_id, topOfHour(now - 2 * HOUR), topOfHour(now), 300);
  if (!failed(fine)) {
    const f = fine.body.buckets || [];
    const peak = Math.max(...f.map((x) => x.active_players || 0), 0);
    console.log(`  5-min buckets over 2h: ${f.length}, peak active=${peak}`);
  }
}

// ── Q2. How far back does the data go? ─────────────────────────
// Coarse walk outwards to bracket the edge, then bisect. Error code 35 is the
// specific "before activity tracking began" refusal; anything else is a
// different problem and stops the search rather than being read as the edge.

console.log("\n── Q2: retention ──");
const probeAt = async (daysAgo) => {
  const s = topOfHour(now - daysAgo * DAY);
  const r = await activityFaction(sample.body?.meta?.subject_id || OURS, s, s + HOUR);
  return { ok: !failed(r), code: r.body?.code, r };
};

let lastGood = 0, firstBad = null, aborted = false;
for (const d of [7, 30, 90, 180, 365, 730]) {
  const p = await probeAt(d);
  console.log(`  ${String(d).padStart(3)}d ago: ${p.ok ? "ok" : "refused (" + why(p.r) + ")"}`);
  if (p.ok) { lastGood = d; continue; }
  // Only the retention refusal marks the edge. A rate limit or a bad key here
  // would otherwise be mistaken for "history ends at 90 days".
  if (p.code === 35) { firstBad = d; break; }
  console.log("  stopping: that refusal is not a retention limit");
  aborted = true;
  break;
}

if (aborted) {
  // Saying "at least 0 days" here would read as a finding. It is not one.
  console.log(`  VERDICT: UNKNOWN — the walk stopped on an unrelated error${lastGood ? `, but ${lastGood}d did read ok` : ""}`);
} else if (firstBad == null) {
  console.log(`  VERDICT: at least ${lastGood} days available (never hit the edge)`);
} else {
  let lo = lastGood, hi = firstBad;
  while (hi - lo > 1) {
    const mid = Math.floor((lo + hi) / 2);
    const p = await probeAt(mid);
    if (p.ok) lo = mid; else hi = mid;
  }
  console.log(`  VERDICT: history ends between ${lo} and ${hi} days back`);
}

// ── The payoff: an opponent's coverage curve ───────────────────
// Only run when Q3 said yes and Q2 left room. Averages each hour-of-day across
// the window, so a single quiet Tuesday does not read as a permanent trough.

if (canScout && lastGood >= 7) {
  const days = Math.min(14, lastGood);
  console.log(`\n── ${THEIRS} coverage, ${days}d averaged by hour (UTC) ──`);
  const r = await activityFaction(THEIRS, topOfHour(now - days * DAY), topOfHour(now), HOUR);
  if (failed(r)) {
    console.log(`  refused — ${why(r)}`);
  } else {
    const byHour = Array.from({ length: 24 }, () => []);
    for (const b of r.body.buckets || []) {
      byHour[new Date(b.ts * 1000).getUTCHours()].push(b.active_ratio ?? 0);
    }
    const avg = byHour.map((v) => (v.length ? v.reduce((a, c) => a + c, 0) / v.length : 0));
    const peak = Math.max(...avg, 0.0001);
    const BLOCKS = " ▁▂▃▄▅▆▇█";
    avg.forEach((v, h) => {
      const bar = BLOCKS[Math.round((v / peak) * 8)].repeat(28);
      console.log(`  ${String(h).padStart(2, "0")}:00 ${bar} ${(v * 100).toFixed(1)}%`);
    });
    const trough = avg.indexOf(Math.min(...avg.filter((x) => x > 0)));
    console.log(`  thinnest hour: ${String(trough).padStart(2, "0")}:00 UTC`);

    // Their trough only helps if we can field people in it. Same window, same
    // bucket, our roster — the edge is the GAP, not their low point.
    const us = await activityFaction(OURS, topOfHour(now - days * DAY), topOfHour(now), HOUR);
    if (!failed(us)) {
      const oursByHour = Array.from({ length: 24 }, () => []);
      for (const b of us.body.buckets || []) {
        oursByHour[new Date(b.ts * 1000).getUTCHours()].push(b.active_ratio ?? 0);
      }
      const ourAvg = oursByHour.map((v) => (v.length ? v.reduce((a, c) => a + c, 0) / v.length : 0));
      const edge = ourAvg.map((v, h) => ({ h, gap: v - avg[h], us: v, them: avg[h] }))
        .sort((a, b) => b.gap - a.gap);
      console.log(`\n  best hours to declare (our ratio minus theirs):`);
      for (const e of edge.slice(0, 5)) {
        console.log(`    ${String(e.h).padStart(2, "0")}:00 UTC  us ${(e.us * 100).toFixed(1)}%  them ${(e.them * 100).toFixed(1)}%  edge ${(e.gap * 100 >= 0 ? "+" : "")}${(e.gap * 100).toFixed(1)}pp`);
      }
    }
  }
}

console.log(`\n${calls} calls used (measured limit: 10/min on activity endpoints).`);
