// Reading how a faction behaves DURING a war, rather than at rest.
//
// The baseline curve /prewar shipped with measured factions at rest, and
// nobody fights at rest. Checked against war 49287: both factions ran far
// above their baselines, the predicted best hour (07:00, +10pp baseline) was
// +4pp in reality, and the actual best hour (09:00, +18pp) was not in the
// baseline's top five.
//
// Worse for the original premise: Dead Fragment was out-covered in 26 of 34
// hours and won 23,048 to 7,923. Presence is not damage. So these stats
// describe a faction's SHAPE — how hard they start, whether they hold — and
// are never presented as a prediction of who wins.
import { test } from "node:test";
import assert from "node:assert/strict";
import { warWindowStats, scoreRate, summariseWar, drawCurve, aggregateByHour, warEdgeTable } from "./war-window.js";

const buckets = (ratios) =>
  ratios.map((r, i) => ({ ts: 1789736400 + i * 3600, active_ratio: r, active_players: Math.round(r * 90) }));

// ── Shape of a war ─────────────────────────────────────────────

test("peak and mean describe the overall level", () => {
  const s = warWindowStats(buckets([0.2, 0.6, 0.4]));
  assert.equal(s.peak, 0.6);
  assert.ok(Math.abs(s.mean - 0.4) < 1e-9);
  assert.equal(s.hours, 3);
});

test("a faction that spikes then fades has a negative fade", () => {
  // The question this exists to answer: The Rifle Medics closed three wars
  // inside 13 hours, then went 34 against Dead Fragment and lost. Did they
  // run out of people, or just get out-hit?
  const s = warWindowStats(buckets([0.7, 0.7, 0.7, 0.4, 0.3, 0.2]));
  assert.ok(s.fade < -0.2, `expected a clear fade, got ${s.fade}`);
  assert.ok(s.firstThird > s.lastThird);
});

test("a faction that holds has a fade near zero", () => {
  const s = warWindowStats(buckets([0.5, 0.52, 0.48, 0.5, 0.51, 0.49]));
  assert.ok(Math.abs(s.fade) < 0.05, `expected a flat war, got ${s.fade}`);
});

test("a faction that builds has a positive fade", () => {
  // Reinforcements arriving, or a timezone rolling in. Worth distinguishing
  // from fading, because it means a long war favours them.
  const s = warWindowStats(buckets([0.2, 0.3, 0.25, 0.6, 0.7, 0.65]));
  assert.ok(s.fade > 0.2, `expected a build, got ${s.fade}`);
});

test("thirds split evenly and cover the whole war", () => {
  const s = warWindowStats(buckets([0.9, 0.9, 0.9, 0, 0, 0, 0.3, 0.3, 0.3]));
  assert.ok(Math.abs(s.firstThird - 0.9) < 1e-9);
  assert.ok(Math.abs(s.lastThird - 0.3) < 1e-9);
});

// ── Degenerate inputs ──────────────────────────────────────────

test("a war too short to split reports no fade rather than a fake one", () => {
  // Two buckets cannot be divided into meaningful thirds, and inventing a
  // trend from two points is how a scouting page starts lying.
  const s = warWindowStats(buckets([0.4, 0.6]));
  assert.equal(s.fade, null);
  assert.equal(s.peak, 0.6);
});

test("no buckets is empty, not zero", () => {
  // Zero reads as "they were dead". Null reads as "we do not know", which is
  // the truth when FFScouter has no data for that window.
  const s = warWindowStats([]);
  assert.equal(s.hours, 0);
  assert.equal(s.mean, null);
  assert.equal(s.peak, null);
  assert.equal(s.fade, null);
});

// ── Score rate ─────────────────────────────────────────────────

test("points per hour normalises wars of different lengths", () => {
  // A 23,503 blowout over 27h and a 7,923 loss over 34h are not comparable
  // as totals. Per hour, they are.
  assert.ok(Math.abs(scoreRate(23503, 27.3) - 860.9) < 1);
  assert.ok(Math.abs(scoreRate(7923, 33.9) - 233.7) < 1);
});

test("a zero-length war does not divide by zero", () => {
  assert.equal(scoreRate(1000, 0), null);
  assert.equal(scoreRate(1000, null), null);
});

// ── Pulling one war together ───────────────────────────────────

const WAR_49287 = {
  id: 49287, start: 1789736400, end: 1789858465, target: 15120, winner: 42055,
  factions: [
    { id: 26154, name: "The Rifle Medics", score: 7923 },
    { id: 42055, name: "Dead Fragment", score: 23048 },
  ],
};

test("a war is summarised from the scouted faction's side", () => {
  const w = summariseWar(WAR_49287, 26154, buckets([0.7, 0.5, 0.3]));
  assert.equal(w.opponentName, "Dead Fragment");
  assert.equal(w.score, 7923);
  assert.equal(w.opponentScore, 23048);
  assert.equal(w.won, false);
  assert.ok(Math.abs(w.hours - 33.9) < 0.1);
});

test("a win is reported as a win", () => {
  const won = { ...WAR_49287, winner: 26154 };
  assert.equal(summariseWar(won, 26154, []).won, true);
});

test("opponent strength rides along, so a record can be read honestly", () => {
  // Four wins against factions that scored 7, 362, 874 and 6,799 is not the
  // same as four wins. The opponent's score is the only cheap proxy we have,
  // and without it the page flatters everyone.
  const w = summariseWar(WAR_49287, 26154, []);
  assert.equal(w.opponentScore, 23048);
  assert.equal(w.margin, 7923 - 23048);
});

test("an unfinished war has no duration and does not crash", () => {
  const live = { ...WAR_49287, end: 0, winner: 0 };
  const w = summariseWar(live, 26154, []);
  assert.equal(w.hours, null);
  assert.equal(w.scoreRate, null);
  assert.equal(w.ongoing, true);
});

// ── Before FFScouter was tracking ──────────────────────────────
// Old windows are not refused — they come back fully bucketed with every
// ratio at zero. War 36602 (Feb 2026) returned 13 buckets, all zero, while
// the April war returned 9 with data. Reporting that as "0% coverage" says
// the faction sat out a ranked war for thirteen straight hours, which no
// faction does. It means the tracker has nothing, and the page must say so.

test("a window of all zeroes is no data, not a dead faction", () => {
  const s = warWindowStats(buckets([0, 0, 0, 0, 0, 0]));
  assert.equal(s.peak, null);
  assert.equal(s.mean, null);
  assert.equal(s.fade, null);
  assert.equal(s.untracked, true);
});

test("a genuinely quiet hour inside a real war still counts", () => {
  // One zero among real numbers is a quiet hour and must survive. Only an
  // entirely empty window is treated as untracked.
  const s = warWindowStats(buckets([0.4, 0, 0.5]));
  assert.equal(s.untracked, false);
  assert.equal(s.peak, 0.5);
  assert.ok(s.mean > 0);
});

// ── The curve itself, for drawing ──────────────────────────────
// peak/mean/fade are three numbers ABOUT a shape. The shape is what was
// actually paid for, and a sparkline shows it in the space a number takes.

test("the curve rides along so it can be drawn", () => {
  const w = summariseWar(WAR_49287, 26154, buckets([0.7, 0.5, 0.3]));
  assert.deepEqual(w.curve, [0.7, 0.5, 0.3]);
});

test("a long war is downsampled, keeping its shape", () => {
  // 34 hours into a sparkline a thumb-width wide. The peak must survive the
  // resampling or the drawing contradicts the number printed beside it.
  const long = buckets(Array.from({ length: 34 }, (_, i) => (i === 20 ? 0.9 : 0.3)));
  const w = summariseWar(WAR_49287, 26154, long);
  assert.ok(w.curve.length <= 24, `got ${w.curve.length} points`);
  assert.ok(Math.max(...w.curve) >= 0.85, "the peak was smoothed away");
});

test("an untracked war has no curve to draw", () => {
  const w = summariseWar(WAR_49287, 26154, buckets([0, 0, 0, 0]));
  assert.deepEqual(w.curve, []);
});

// ── Both sides of the same window ──────────────────────────────
// A faction's own curve says how many of them showed up. It cannot say whether
// that was more or fewer than the people they were fighting, and that
// comparison is the whole question: war 49287 had Dead Fragment out-covered in
// 26 of 34 hours and winning 3:1.

test("the opponent's curve is carried alongside", () => {
  const w = summariseWar(WAR_49287, 26154, buckets([0.7, 0.5, 0.3]), buckets([0.4, 0.4, 0.6]));
  assert.deepEqual(w.curve, [0.7, 0.5, 0.3]);
  assert.deepEqual(w.opponentCurve, [0.4, 0.4, 0.6]);
});

test("hourly gaps line up with the war's own hours", () => {
  const w = summariseWar(WAR_49287, 26154, buckets([0.7, 0.5]), buckets([0.4, 0.6]));
  assert.equal(w.hourly.length, 2);
  assert.equal(w.hourly[0].them, 0.7, "subject faction is 'them' from our side of the page");
  assert.equal(w.hourly[0].us, 0.4);
  assert.ok(Math.abs(w.hourly[0].gap - (0.4 - 0.7)) < 1e-9);
});

test("no opponent data leaves gaps null rather than inventing zeroes", () => {
  // Claiming a +70pp advantage because the other side is unknown would be the
  // most flattering possible lie.
  const w = summariseWar(WAR_49287, 26154, buckets([0.7, 0.5]), []);
  assert.deepEqual(w.opponentCurve, []);
  assert.equal(w.hourly.length, 0);
});

test("hours the two sides do not share are dropped", () => {
  // Mismatched lengths mean one side has a hole. Pairing by index past the
  // shorter run would compare different hours to each other.
  const w = summariseWar(WAR_49287, 26154, buckets([0.7, 0.5, 0.3]), buckets([0.4, 0.6]));
  assert.equal(w.hourly.length, 2);
});

test("an untracked window produces no hourly rows", () => {
  // Zero is a finite number, so a naive filter keeps it and renders a row of
  // empty bars with a 0pp gap — the same lie warWindowStats already rejects,
  // arriving through a different door. Leafy's Tree came back 13 such rows.
  const w = summariseWar(WAR_49287, 26154, buckets([0, 0, 0]), buckets([0, 0, 0]));
  assert.deepEqual(w.hourly, []);
});

test("one untracked side is still no comparison", () => {
  const w = summariseWar(WAR_49287, 26154, buckets([0.5, 0.4]), buckets([0, 0]));
  assert.deepEqual(w.hourly, []);
});

// ── Aggregating across war windows ─────────────────────────────
// Per-war curves answer "what did they do in that war". The question a declare
// time needs is "what do they do in wars, by hour of day" — and the same for
// us. That is the baseline table's question, answered with war data instead of
// data from factions sitting at rest.

test("averages a faction's war hours by hour of day", () => {
  // 07:00 appears in two different wars at 0.4 and 0.6 -> 0.5
  const warA = buckets([0.4]);              // ts 1789736400 = 13:00 UTC
  const shifted = (h, v) => [{ ts: Date.UTC(2026, 8, 1, h) / 1000, active_ratio: v }];
  const c = aggregateByHour([shifted(7, 0.4), shifted(7, 0.6)]);
  assert.ok(Math.abs(c[7] - 0.5) < 1e-9);
  assert.ok(warA.length);
});

test("hours with no war data are null, not zero", () => {
  // Zero would read as "they never turn out at 03:00". The truth is that no
  // war in the sample covered 03:00, which is a different claim.
  const shifted = (h, v) => [{ ts: Date.UTC(2026, 8, 1, h) / 1000, active_ratio: v }];
  const c = aggregateByHour([shifted(9, 0.5)]);
  assert.equal(c[9], 0.5);
  assert.equal(c[3], null);
});

test("untracked wars are excluded, not averaged in as zeroes", () => {
  // The Feb 2026 war returns 13 buckets of zeroes because FFScouter was not
  // collecting yet. Averaging those in would halve every hour it touches.
  const shifted = (h, v) => [{ ts: Date.UTC(2026, 8, 1, h) / 1000, active_ratio: v }];
  const dead = [0, 1, 2].map((h) => ({ ts: Date.UTC(2026, 8, 1, h) / 1000, active_ratio: 0 }));
  const c = aggregateByHour([shifted(1, 0.6), dead]);
  assert.ok(Math.abs(c[1] - 0.6) < 1e-9, `got ${c[1]}`);
});

test("a genuinely quiet hour inside a tracked war still counts", () => {
  const set = [
    { ts: Date.UTC(2026, 8, 1, 4) / 1000, active_ratio: 0.5 },
    { ts: Date.UTC(2026, 8, 1, 5) / 1000, active_ratio: 0 },
  ];
  const c = aggregateByHour([set]);
  assert.equal(c[5], 0, "a real zero inside a tracked war is data");
});

test("no data at all gives 24 nulls", () => {
  const c = aggregateByHour([]);
  assert.equal(c.length, 24);
  assert.ok(c.every((v) => v === null));
});

// ── The comparison that answers "when do we declare" ───────────

test("ranks hours where we out-turn them, skipping hours either side lacks", () => {
  const ours = new Array(24).fill(null);
  const theirs = new Array(24).fill(null);
  ours[7] = 0.50; theirs[7] = 0.30;   // +20pp
  ours[9] = 0.40; theirs[9] = 0.35;   // +5pp
  ours[11] = 0.60; theirs[11] = null; // unknown for them -> excluded
  const t = warEdgeTable(ours, theirs);
  assert.equal(t.length, 2, "an hour missing from either side is not a comparison");
  assert.equal(t[0].hour, 7);
  assert.ok(Math.abs(t[0].gap - 0.20) < 1e-9);
  assert.equal(t[1].hour, 9);
});

test("the sample size rides along so a one-war hour is not read as a pattern", () => {
  const shifted = (h, v) => [{ ts: Date.UTC(2026, 8, 1, h) / 1000, active_ratio: v }];
  const c = aggregateByHour([shifted(7, 0.4), shifted(7, 0.6), shifted(8, 0.2)], true);
  assert.equal(c.samples[7], 2);
  assert.equal(c.samples[8], 1);
  assert.equal(c.samples[3], 0);
});
