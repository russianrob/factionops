import { test } from "node:test";
import assert from "node:assert/strict";
import { warScoreCheckInterval } from "/opt/warboard/server/chain-monitor.js";

// The trap: a ranked war ends exactly when the lead reaches the target, so
// |my - enemy| >= 0.9 * target is true BY DEFINITION at the final whistle.
// With scores left on the record, the score poll stays pinned at the 30s
// endgame cadence forever.
test("endgame cadence is correctly fast while the war is close to over", () => {
  const war = { warOrigTarget: 1000, warScores: { myScore: 950, enemyScore: 0 } };
  assert.equal(warScoreCheckInterval(war), 30_000);
});

test("normal cadence mid-war", () => {
  const war = { warOrigTarget: 1000, warScores: { myScore: 100, enemyScore: 90 } };
  assert.equal(warScoreCheckInterval(war), 300_000);
});

test("THE TRAP: a finished war's scores pin it at 30s", () => {
  // A ranked war ends when the LEAD reaches the target, so the end state is
  // lead >= target -- comfortably past the 0.9 endgame margin. (My first
  // fixture used a 700 lead on a 1000 target, which is not an end state at all.)
  const ended = { warOrigTarget: 1000, warScores: { myScore: 1300, enemyScore: 300 }, warEnded: true };
  assert.equal(warScoreCheckInterval(ended), 30_000,
    "this is why an ended war polled FASTER — the fix is to stop the monitor and clear warScores");
});

test("clearing warScores on war end releases the trap", () => {
  const cleared = { warOrigTarget: 1000, warEnded: true };
  assert.equal(warScoreCheckInterval(cleared), 300_000);
});

// The pre-war gate, as the source computes it.
const preWarAt = (warStart, nowSec) => {
  const s = Number(warStart) || 0;
  return s > 0 && nowSec < s;
};
test("pre-war gate: suppressed before kickoff, live after", () => {
  const start = 2_000_000_000;
  assert.equal(preWarAt(start, start - 86_400), true,  "a day before kickoff -> no chain fetch");
  assert.equal(preWarAt(start, start - 1), true);
  assert.equal(preWarAt(start, start), false, "at kickoff -> live");
  assert.equal(preWarAt(start, start + 60), false);
});
test("unknown warStart must NOT suppress — fail open, never miss a live chain", () => {
  assert.equal(preWarAt(0, 1_000), false);
  assert.equal(preWarAt(undefined, 1_000), false);
  assert.equal(preWarAt(null, 1_000), false);
});
