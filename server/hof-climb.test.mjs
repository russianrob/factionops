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

// ── the digest ──────────────────────────────────────────────────────────
test("the midnight table is 20 above, us and 5 below, in Hall of Fame order", () => {
  const respect = { 42055: 1000 };
  for (let i = 1; i <= 30; i++) respect[i] = 1000 + i * 10;  // 30 above
  for (let i = 31; i <= 40; i++) respect[i] = 1000 - (i - 30) * 10;  // 10 below
  respect[99] = 5000;  // hidden
  const t = climb.midnightTable({ respect, hidden: [99] }, { 20: "<Top> & co" }, 42055);
  assert.equal(t.position, 31);
  assert.equal(t.rows.length, 26);
  assert.deepEqual([t.rows[0].position, t.rows[20].id, t.rows[25].position], [11, 42055, 36]);
  assert.equal(t.rows[0].name, "<Top> & co", "names are data; the page escapes them");
  assert.equal(t.rows[1].name, "#19", "a missing name falls back to the id");
});

test("computeDigest puts every piece in the shape the API reads", () => {
  const byDay = {
    "2026-09-18": { respect: { 42055: 1000, 1: 2000, 2: 1500 }, hidden: [] },
    "2026-10-18": { respect: { 42055: 3900, 1: 2000, 2: 1500, 3: 5000 }, hidden: [] },
    "2026-10-19": { respect: { 42055: 4100, 1: 2000, 2: 1500, 3: 5000 }, hidden: [] },
  };
  const history = Object.keys(byDay).map((d) => climb.historyEntry(d, byDay[d], 42055));
  const dg = climb.computeDigest({ byDay, history, names: { 1: "One" }, factionId: 42055, builtAt: 123 });
  assert.equal(dg.version, climb.DIGEST_VERSION);
  assert.equal(dg.day, "2026-10-19");
  assert.deepEqual(dg.windows, { 30: { base: "2026-09-18", span: 31 } });
  assert.equal(dg.paces[42055][30], 100);
  assert.equal(dg.paces[3][30], 0, "3 first appears on 10-18");
  assert.deepEqual(dg.history.map((h) => h.position), [3, 2, 2]);
  assert.equal(dg.projection[30].length, 365);
  assert.equal(dg.notes[30], null, "climbing 1 then 0: no note");
  assert.equal(dg.midnight.position, 2);
  assert.equal(dg.midnight.rows[0].id, 3);
});

// ── long windows, estimated until the saved days reach back ─────────────
test("the long windows' limits are 99, 201 and 402 days", () => {
  assert.deepEqual(climb.WINDOWS, [7, 30, 90, 182, 365]);
  assert.deepEqual([90, 182, 365].map(climb.windowLimit), [99, 201, 402]);
});

test("a long window is estimated, w days back, only while no saved day is close enough", () => {
  const saved = daysFrom("2026-09-18", "2026-10-22");
  const estimate = daysFrom("2025-10-08", "2026-09-17");
  assert.deepEqual(climb.resolveWindows(saved, "2026-10-22", estimate), {
    7: { base: "2026-10-15", span: 7 },
    30: { base: "2026-09-22", span: 30 },
    90: { base: "2026-07-24", span: 90, estimated: true },
    182: { base: "2026-04-23", span: 182, estimated: true },
    365: { base: "2025-10-22", span: 365, estimated: true },
  });
  // On 2026-12-17 a saved day sits exactly 90 days back, and 3 months turns exact.
  const later = daysFrom("2026-09-18", "2026-12-17");
  assert.deepEqual(climb.resolveWindows(later, "2026-12-16", estimate)[90], { base: "2026-09-17", span: 90, estimated: true });
  assert.deepEqual(climb.resolveWindows(later, "2026-12-17", estimate)[90], { base: "2026-09-18", span: 90 });
  assert.equal(climb.resolveWindows(saved, "2026-10-22")[90], undefined, "no estimate, no long window");
});

test("in an estimated window a faction the estimate doesn't hold gets no pace, even with saved days in the window", () => {
  const L = { respect: { 42055: 4000, 1: 3000, 2: 9000, 3: 500 }, hidden: [3] };
  const p = climb.estimatedPacesFor(L, { 42055: 400, 2: 1800, 3: 100 }, 360);
  assert.deepEqual(p, { 42055: 10, 2: 20 }, "1 isn't in the estimate; 3 is hidden");
});

// Us at 4,000; faction 1 far above and outside the estimate; 2 just above us
// and in it. Exact days hold the last 30; the estimate holds a year back.
function longWorld({ withUs = true } = {}) {
  const byDay = {};
  for (const d of daysFrom("2026-09-18", "2026-10-22")) {
    const n = climb.daysBetween("2026-09-18", d);
    byDay[d] = { respect: { 42055: 3000 + n * 30, 1: 1000000, 2: 4100 + n }, hidden: [] };
  }
  const days = {};
  for (const d of daysFrom("2025-10-08", "2026-09-17")) days[d] = withUs ? { 42055: 350, 2: 3769 } : { 2: 3769 };
  const history = Object.keys(byDay).map((d) => climb.historyEntry(d, byDay[d], 42055));
  return { byDay, history, names: {}, factionId: 42055, builtAt: 1, estimates: { version: 1, builtAt: 77, days } };
}

test("an estimated window shows only estimated paces, and projects with the 30-day paces underneath", () => {
  const dg = climb.computeDigest(longWorld());
  assert.deepEqual(dg.windows[365], { base: "2025-10-22", span: 365, estimated: true });
  assert.equal(dg.estimatesBuiltAt, 77);
  assert.equal(dg.paces[42055][365], Math.round((4020 - 350) / 365 * 100) / 100);
  assert.equal(dg.paces[2][365], 1);
  assert.equal(dg.paces[1][365], undefined, "1 isn't estimated, so the table shows no 1-year pace for it");
  assert.equal(dg.paces[1][30], 0);
  // 1 sits 996k above us and stands still at its 30-day pace: still ahead in a year.
  assert.equal(dg.projection[365][364], 2, "1 counted ahead; 2 passed");
});

test("no estimated window without an exact one under it, or without us in the estimate", () => {
  assert.equal(climb.computeDigest(longWorld({ withUs: false })).windows[365], undefined);
  const w = longWorld();
  for (const d of Object.keys(w.byDay)) if (d !== "2026-10-22") delete w.byDay[d];
  w.history = [climb.historyEntry("2026-10-22", w.byDay["2026-10-22"], 42055)];
  assert.deepEqual(climb.computeDigest(w).windows, {});
});

test("without an estimate the digest says so, and the short windows are as before", () => {
  const w = longWorld();
  const dg = climb.computeDigest({ ...w, estimates: null });
  assert.equal(dg.estimatesBuiltAt, null);
  assert.deepEqual(Object.keys(dg.windows), ["7", "30"]);
});
