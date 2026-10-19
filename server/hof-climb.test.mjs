// The maths behind /hof (spec: docs/superpowers/specs/2026-10-19-hof-respect-climb-design.md).
// Synthetic factions only; the real-data anchors are checked outside the repo.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// No hof module may ever touch the live data directory from a test.
process.env.DATA_DIR = mkdtempSync(join(tmpdir(), "hof-climb-test-"));
const climb = await import("./hof-climb.js");

// ── number formats ──────────────────────────────────────────────────────
test("fmtNum picks its band from the rounded absolute value", () => {
  const cases = [
    [0, "0"], [188, "188"], [9876, "9,876"], [9999, "9,999"],
    [10000, "10.0k"], [74800, "74.8k"], [74850, "74.9k"], [99949, "99.9k"],
    [99950, "100k"], [99960, "100k"], [110914, "111k"], [999499, "999k"],
    [999500, "1.00M"], [1000000, "1.00M"], [1005000, "1.01M"], [3552938, "3.55M"],
    [9995000, "10.00M"],
    [-188, "-188"], [-9999, "-9,999"], [-10000, "-10.0k"], [-33882, "-33.9k"],
    [-99960, "-100k"], [-1000000, "-1.00M"],
  ];
  for (const [v, want] of cases) assert.equal(climb.fmtNum(v), want, String(v));
});

test("fmtPace rounds halves away from zero and never prints -0", () => {
  const cases = [
    [7752.032, "7,752/day"], [7752.5, "7,753/day"], [-7752.5, "-7,753/day"],
    [-1234.6, "-1,235/day"], [-0.3, "0/day"], [0, "0/day"], [NaN, "—"], [null, "—"],
  ];
  for (const [v, want] of cases) assert.equal(climb.fmtPace(v), want, String(v));
});

// ── positions, windows, paces ───────────────────────────────────────────
test("position counts only strictly greater respect, so a tie is in our favour", () => {
  const respect = { 1: 500, 2: 300, 3: 300, 42055: 300, 4: 100 };
  assert.equal(climb.positionOf(respect, [], 42055), 2);
  assert.equal(climb.positionOf(respect, [], 2), 2);
});

test("position leaves out the day's hidden factions", () => {
  const respect = { 1: 500, 2: 400, 42055: 300 };
  assert.equal(climb.positionOf(respect, [2], 42055), 2);
  assert.equal(climb.positionOf(respect, [], 99), null);
});

const daysFrom = (first, last, skip = []) => {
  const out = [];
  for (let d = first; d <= last; d = climb.addDays(d, 1)) if (!skip.includes(d)) out.push(d);
  return out;
};

test("a window with every day saved spans exactly w days", () => {
  const days = daysFrom("2026-07-01", "2026-10-19");
  assert.deepEqual(climb.resolveWindows(days, "2026-10-19"), {
    7: { base: "2026-10-12", span: 7 },
    30: { base: "2026-09-19", span: 30 },
    90: { base: "2026-07-21", span: 90 },
  });
});

test("a missing base day falls back to the nearest earlier day inside the limit", () => {
  const days = daysFrom("2026-09-01", "2026-10-19", ["2026-10-12"]);
  assert.deepEqual(climb.resolveWindows(days, "2026-10-19")[7], { base: "2026-10-11", span: 8 });
});

test("a window whose base is past its limit is not offered", () => {
  // The spike's three days: 31 days back is fine for 30 (limit 33), not for 7 (limit 9).
  const w = climb.resolveWindows(["2026-09-18", "2026-10-18", "2026-10-19"], "2026-10-19");
  assert.deepEqual(w, { 30: { base: "2026-09-18", span: 31 } });
  assert.deepEqual([7, 30, 90].map(climb.windowLimit), [9, 33, 99]);
});

test("paces are exact differences: base day, else the first saved day, else none", () => {
  const byDay = {
    "2026-09-19": { respect: { 42055: 1000, 1: 900, 2: 5000, 4: 700 }, hidden: [4] },
    "2026-10-18": { respect: { 42055: 3800, 1: 950, 2: 5000, 3: 50000, 4: 1300 }, hidden: [] },
    "2026-10-19": { respect: { 42055: 4000, 1: 960, 2: 4700, 3: 50000, 4: 1600, 5: 5000, 6: 9000 }, hidden: [6] },
  };
  const p = climb.pacesFor(byDay, "2026-10-19", { base: "2026-09-19", span: 30 });
  assert.equal(p[42055], 100);
  assert.equal(p[1], 2);
  assert.equal(p[2], -10, "a pace can be negative");
  assert.equal(p[3], 0, "first seen on 10-18 at 50,000 and flat since: 0, not 50,000 / age");
  assert.equal(p[4], 30, "hidden at the base, visible now: still measured from the base");
  assert.ok(!(5 in p), "seen only at L: no pace");
  assert.ok(!(6 in p), "hidden at L: no pace");
});

// ── projection and pass days ────────────────────────────────────────────
test("projected positions count every faction at its own pace", () => {
  const respect = { 42055: 1000, 1: 1050, 2: 2000, 3: 900 };
  const paces = { 42055: 100, 1: 0, 2: 0, 3: 150 };
  const proj = climb.projectPositions(respect, paces, 42055);
  assert.equal(proj.length, 365);
  assert.equal(proj[0], 2, "d=1: passed 1, 3 not yet past us");
  assert.equal(proj[364], 2, "d=365: passed 1 and 2, overtaken by 3");
  assert.equal(climb.projectPositions(respect, { 1: 0 }, 42055), null, "no pace for us: no projection");
});

test("the horizons are entries 7, 30, 91, 182 and 365", () => {
  const proj = Array.from({ length: 365 }, (_, i) => 1000 - i);
  assert.deepEqual(climb.horizonsOf(proj), { 7: 994, 30: 971, 91: 910, 182: 819, 365: 636 });
});

test("days to pass for rows above and below us", () => {
  const above = (gap, pace, usPace) => climb.daysToPass({ above: true, gap, pace, usPace });
  const below = (gap, pace, usPace) => climb.daysToPass({ above: false, gap, pace, usPace });
  assert.equal(above(1000, 50, 150), 10);
  assert.equal(above(1000, 150, 150), null, "as fast as us: pulling away");
  assert.equal(above(1000, 200, 150), null);
  assert.equal(above(-5, 50, 150), 0, "level or already behind: today");
  assert.equal(below(-1000, 250, 150), 10);
  assert.equal(below(-1000, 100, 150), null);
  assert.equal(above(1000, NaN, 150), null);
  assert.equal(below(-1000, 250, undefined), null);
});

// ── crowding note ───────────────────────────────────────────────────────
// Us at 1,000 gaining 100 a day. Six factions sit 100–600 above and stand
// still; one at 350 above is faster than us; one is far ahead.
const CROWD = {
  latestRespect: { 42055: 1000, a1: 1100, a2: 1200, a3: 1300, a4: 1400, a5: 1500, a6: 1600, c: 1350, d: 50000 },
  paces: { 42055: 100, a1: 0, a2: 0, a3: 0, a4: 0, a5: 0, a6: 0, c: 200, d: 0 },
  hidden: [], us: 42055,
};
const note = (over) => climb.crowdingNote({ ...CROWD, ...over });

test("a crowded month gets the approved sentence, counting every faction within X", () => {
  // We pass six (gaps up to 600), and seven factions sit within 600 because c does too.
  assert.equal(note({ basePosition: 11, position: 9, projected30: 3 }),
    "We climbed 2 places last month (#11 to #9). At this pace we climb 6 in the next month, " +
    "because 7 factions are within 600 respect above us.");
});

test("the faster note after a flat or falling month, with singular forms", () => {
  const one = { latestRespect: { 42055: 1000, a1: 1100, d: 50000 }, paces: { 42055: 100, a1: 0, d: 0 } };
  assert.equal(note({ ...one, basePosition: 7, position: 9, projected30: 8 }),
    "We fell 2 places last month (#7 to #9). At this pace we climb 1 in the next month, " +
    "because 1 faction is within 100 respect above us.");
  assert.match(note({ basePosition: 9, position: 9, projected30: 6 }), /^We held #9 last month\. /);
  assert.match(note({ basePosition: 8, position: 9, projected30: 7 }), /^We fell 1 place last month \(#8 to #9\)\. /);
});

test("a sparse month gets the slower note and the nearest faction we don't reach", () => {
  // c (350 ahead, faster) and d stay ahead at d = 30; c is the nearer one.
  assert.equal(note({ basePosition: 19, position: 9, projected30: 7 }),
    "We climbed 10 places last month (#19 to #9). At this pace we climb only 2 in the next month. " +
    "The nearest faction above us that we don't reach this month is 350 respect ahead.");
  assert.match(note({ basePosition: 19, position: 9, projected30: 9 }), / At this pace we hold #9 for the next month\. /);
  assert.match(note({ basePosition: 19, position: 9, projected30: 10 }), / At this pace we fall 1 place in the next month\. /);
});

test("no note inside the 3-place margin, at #1, or without a 30-day base", () => {
  assert.equal(note({ basePosition: 10, position: 9, projected30: 7 }), null, "1 then 2: noise");
  assert.equal(note({ basePosition: 19, position: 9, projected30: 1 }), null, "we would reach #1");
  assert.equal(note({ basePosition: null, position: 9, projected30: 3 }), null);
});
