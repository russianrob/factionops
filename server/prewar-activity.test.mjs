// Pre-war scouting: turning FFScouter activity buckets into a declare time.
//
// The numbers here decide when a war starts, so the arithmetic is worth
// pinning down. Everything tested is pure — the fetching and caching around it
// is thin by design.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  hourCurve, edgeTable, cacheKeyFor, nextDelay, HOUR, SPACING_MS, enemyNameFrom } from "./prewar-activity.js";

/** A bucket as FFScouter returns it. */
const b = (isoHour, ratio) => ({
  ts: Math.floor(Date.parse(isoHour) / 1000),
  active_ratio: ratio,
  active_players: Math.round(ratio * 100),
  activity_score: Math.round(ratio * 100),
});

// ── hourCurve ──────────────────────────────────────────────────

test("averages each hour-of-day across the window", () => {
  // Same hour on three different days: 20%, 40%, 60% -> 40%.
  const curve = hourCurve([
    b("2026-09-01T07:00:00Z", 0.2),
    b("2026-09-02T07:00:00Z", 0.4),
    b("2026-09-03T07:00:00Z", 0.6),
  ]);
  assert.equal(curve.length, 24);
  assert.ok(Math.abs(curve[7] - 0.4) < 1e-9);
});

test("an hour with no data reads zero, not NaN", () => {
  // A gap in the feed must not poison the curve: NaN sorts unpredictably and
  // would quietly wreck the edge table downstream.
  const curve = hourCurve([b("2026-09-01T07:00:00Z", 0.3)]);
  assert.equal(curve[8], 0);
  assert.ok(Number.isFinite(curve[8]));
});

test("hours are read in UTC, which is Torn time", () => {
  // Torn schedules in TCT and TCT is UTC. Reading these with local getters
  // would shift every hour by the server's offset — and this server runs on
  // CEST, so the whole curve would be two hours wrong.
  const curve = hourCurve([b("2026-09-01T23:00:00Z", 0.5)]);
  assert.equal(curve[23], 0.5);
  assert.equal(curve[21], 0, "hour was shifted by a local-time offset");
});

test("one quiet day does not define the trough", () => {
  // The whole reason for averaging. A single dead Tuesday at 03:00 against
  // thirteen normal ones should barely move the hour.
  const buckets = [];
  for (let d = 1; d <= 14; d++) {
    const day = String(d).padStart(2, "0");
    buckets.push(b(`2026-09-${day}T03:00:00Z`, d === 2 ? 0.0 : 0.42));
  }
  const curve = hourCurve(buckets);
  assert.ok(curve[3] > 0.38, `one dead day dragged the hour to ${curve[3]}`);
});

// ── edgeTable ──────────────────────────────────────────────────

test("edge is our ratio minus theirs, best first", () => {
  const ours = new Array(24).fill(0.30);
  const theirs = new Array(24).fill(0.30);
  ours[7] = 0.40;   // +10pp
  theirs[15] = 0.20; // +10pp too, but from their side
  ours[9] = 0.10;   // -20pp, our worst
  const t = edgeTable(ours, theirs);
  assert.equal(t.length, 24);
  assert.equal(t[0].gap > 0, true);
  // Numeric comparator: the default sort is lexicographic, so [7,15] would
  // come back as [15,7] and the assertion would fail on its own formatting.
  assert.deepEqual([t[0].hour, t[1].hour].sort((a, b) => a - b), [7, 15]);
  assert.equal(t[t.length - 1].hour, 9, "worst hour should sort last");
});

test("the best hour is not always their weakest", () => {
  // The finding from the live run: 15:00 was nowhere near The Rifle Medics'
  // trough, but our own coverage there made the gap nearly as good. A table
  // built on their minimum alone would never surface it.
  const ours =   [0.20, 0.20, 0.60];
  const theirs = [0.10, 0.19, 0.45];
  const t = edgeTable(ours, theirs);
  assert.equal(t[0].hour, 2, "picked their trough instead of the biggest gap");
  assert.ok(Math.abs(t[0].gap - 0.15) < 1e-9);
});

test("carries both sides so the page can show its working", () => {
  const t = edgeTable([0.5], [0.2]);
  assert.equal(t[0].us, 0.5);
  assert.equal(t[0].them, 0.2);
});

// ── cache key ──────────────────────────────────────────────────

test("one cache entry per faction per window per day", () => {
  const noon = Date.parse("2026-09-20T12:00:00Z");
  const later = Date.parse("2026-09-20T23:59:00Z");
  assert.equal(cacheKeyFor(26154, 14, noon), cacheKeyFor(26154, 14, later),
    "same UTC day must reuse the cached answer");
});

test("the key rolls over at UTC midnight", () => {
  const before = Date.parse("2026-09-20T23:59:59Z");
  const after = Date.parse("2026-09-21T00:00:01Z");
  assert.notEqual(cacheKeyFor(26154, 14, before), cacheKeyFor(26154, 14, after));
});

test("different factions and windows never share an entry", () => {
  const t = Date.parse("2026-09-20T12:00:00Z");
  assert.notEqual(cacheKeyFor(26154, 14, t), cacheKeyFor(42055, 14, t));
  assert.notEqual(cacheKeyFor(26154, 14, t), cacheKeyFor(26154, 30, t));
});

test("a cache key is safe as a filename", () => {
  // It becomes a path. Anything that could escape the directory must not
  // survive into the name.
  const k = cacheKeyFor("../../etc/passwd", 14, Date.now());
  assert.ok(!k.includes("/"), k);
  assert.ok(!k.includes(".."), k);
});

// ── pacing ─────────────────────────────────────────────────────
// FFScouter allows TEN requests a minute per ACCOUNT, and warboard calls with
// one faction key — so every reader of this page shares that one budget. The
// spacing is therefore global, not per-request.

test("waits the full spacing after a call that just happened", () => {
  const now = 1_000_000;
  assert.equal(nextDelay(now, now, SPACING_MS), SPACING_MS);
});

test("does not wait when the last call is already old", () => {
  const now = 1_000_000;
  assert.equal(nextDelay(now - SPACING_MS * 2, now, SPACING_MS), 0);
});

test("never returns a negative wait", () => {
  assert.equal(nextDelay(0, 5_000_000, SPACING_MS), 0);
});

test("the first call ever does not wait", () => {
  assert.equal(nextDelay(null, 1_000_000, SPACING_MS), 0);
});

test("spacing stays under ten per minute", () => {
  // 10/min is the measured ceiling. At exactly 6000ms we would sit on it and
  // trip intermittently, which is how the first probe run failed.
  assert.ok(SPACING_MS > 6000, `spacing ${SPACING_MS}ms is not under 10/min`);
  assert.equal(HOUR, 3600);
});

// ── naming the faction being scouted ───────────────────────────────────
//
// The scout header read "Faction 8795" while, two lines below, the same
// report named a past opponent as "Helvete X". Names worked for everyone
// except the subject.
//
// Two gaps caused it. The live war record carries enemyFactionId but its
// enemyFactionName is never written, so the only source the endpoint
// consulted was empty; and when an id is typed in by hand there is no war
// record at all, so that path could never produce a name. Warboard
// already knew the answer — its own war history had 8795 down as
// "The Brotherhood of Battle" from a war it recorded.

test("prefers the name on the live war record", () => {
  const got = enemyNameFrom({
    war: { enemyFactionId: "8795", enemyFactionName: "The Brotherhood of Battle" },
    history: [],
    id: "8795",
  });
  assert.equal(got, "The Brotherhood of Battle");
});

test("falls back to war history when the live record has no name", () => {
  const got = enemyNameFrom({
    war: { enemyFactionId: "8795", enemyFactionName: null },
    history: [{ enemyFactionId: "8795", enemyFactionName: "The Brotherhood of Battle", warStart: 10 }],
    id: "8795",
  });
  assert.equal(got, "The Brotherhood of Battle");
});

test("works with no war record at all — the typed-in-id case", () => {
  const got = enemyNameFrom({
    war: null,
    history: [{ enemyFactionId: "8795", enemyFactionName: "The Brotherhood of Battle", warStart: 10 }],
    id: "8795",
  });
  assert.equal(got, "The Brotherhood of Battle");
});

test("takes the most recent naming when a faction has renamed itself", () => {
  const got = enemyNameFrom({
    war: null,
    id: "8795",
    history: [
      { enemyFactionId: "8795", enemyFactionName: "Old Name", warStart: 10 },
      { enemyFactionId: "8795", enemyFactionName: "New Name", warStart: 999 },
      { enemyFactionId: "8795", enemyFactionName: "Middle Name", warStart: 500 },
    ],
  });
  assert.equal(got, "New Name");
});

test("never returns another faction's name", () => {
  const got = enemyNameFrom({
    war: null,
    id: "8795",
    history: [{ enemyFactionId: "26154", enemyFactionName: "The Rifle Medics", warStart: 10 }],
  });
  assert.equal(got, "");
});

test("ids compare loosely — history stores them as strings, wars as numbers", () => {
  const got = enemyNameFrom({
    war: null, id: 8795,
    history: [{ enemyFactionId: "8795", enemyFactionName: "The Brotherhood of Battle", warStart: 1 }],
  });
  assert.equal(got, "The Brotherhood of Battle");
});

test("returns empty rather than a placeholder, so the caller can try the API", () => {
  assert.equal(enemyNameFrom({ war: null, history: [], id: "999" }), "");
  assert.equal(enemyNameFrom({ war: null, history: null, id: null }), "");
  assert.equal(enemyNameFrom({}), "");
  // A blank or whitespace name is not a name.
  assert.equal(enemyNameFrom({ war: { enemyFactionName: "   " }, id: "1", history: [] }), "");
});
