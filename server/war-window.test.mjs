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
import { warWindowStats, scoreRate, summariseWar } from "./war-window.js";

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
