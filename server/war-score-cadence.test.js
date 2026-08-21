import test from "node:test";
import assert from "node:assert/strict";
import { warScoreCheckInterval } from "./chain-monitor.js";

const NORMAL = 300_000;
const ENDGAME = 30_000;

// The war that exposed the lag: 42055 vs 38761, war 47710, 2026-08-21.
// Final snapshot 24169 vs 10567 against a 13900 target. Margin 13602 is
// 97.9% of target — the war ended minutes later.
test("endgame when the margin closes on the target", () => {
  const war = { warScores: { myScore: 24169, enemyScore: 10567 }, warEta: { currentTarget: 13900 } };
  assert.equal(warScoreCheckInterval(war), ENDGAME);
});

// The discriminator. Same winning score, but the enemy is right behind, so
// the margin is tiny and the war is nowhere near over. A raw-score check
// (myScore 24169 >= 13900) would call this endgame and hold the fast
// cadence for the rest of the war.
test("raw score above target is NOT endgame when the margin is small", () => {
  const war = { warScores: { myScore: 24169, enemyScore: 23800 }, warEta: { currentTarget: 13900 } };
  assert.equal(warScoreCheckInterval(war), NORMAL);
});

test("mid-war margin stays on the normal cadence", () => {
  const war = { warScores: { myScore: 6000, enemyScore: 4000 }, warEta: { currentTarget: 13900 } };
  assert.equal(warScoreCheckInterval(war), NORMAL);
});

// A losing faction's lead reaches the target too — the war still ends.
test("endgame triggers when the ENEMY is the one closing", () => {
  const war = { warScores: { myScore: 1000, enemyScore: 14000 }, warEta: { currentTarget: 13900 } };
  assert.equal(warScoreCheckInterval(war), ENDGAME);
});

test("falls back to currentTarget's absence via warOrigTarget", () => {
  const war = { warScores: { myScore: 24169, enemyScore: 10567 }, warOrigTarget: 13900 };
  assert.equal(warScoreCheckInterval(war), ENDGAME);
});

test("missing or malformed data never speeds up the poll", () => {
  assert.equal(warScoreCheckInterval(undefined), NORMAL);
  assert.equal(warScoreCheckInterval({}), NORMAL);
  assert.equal(warScoreCheckInterval({ warScores: { myScore: 5 } }), NORMAL);
  assert.equal(warScoreCheckInterval({ warEta: { currentTarget: 0 }, warScores: { myScore: 9, enemyScore: 1 } }), NORMAL);
});
