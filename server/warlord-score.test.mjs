// Whether a Warlord weapon's respect counts toward the payout share.
//
// fair_score strips the bonuses judged circumstantial rather than earned:
//
//     fairScore = respect_gain / (war * chain_bonus * warlord_bonus)
//
// war (the x2 ranked tier) and chain_bonus (where you happened to land in the
// chain) are nobody's doing. Warlord is the arguable one: unlike those two it
// is something the member went and got.
//
// It stays stripped by DEFAULT and a war opts in. Turning it on moves real
// money, so it should be a deliberate act rather than something a reader
// discovers after the fact.
//
// Measured on the war that ended 2026-09-20 before changing anything: of 5,612
// attacks, 896 carried a warlord bonus, and 31 of 59 members move by at least
// 0.05 of a percentage point. The largest single move is +0.67pp, about $26m
// of a $3.81b pool. Real, and worth being able to switch back.
import { test } from "node:test";
import assert from "node:assert/strict";
import { tallyAttacks } from "./war-payouts.js";

const OURS = "42055", ENEMY = "26154";
// ranked_war: 1 is what marks a war hit — without it the attack falls to the
// non-war branch and is scored at 0.3, which is not what these tests are about.
const hit = (id, respect, mods) => ({
  attacker_faction: OURS, attacker_id: id, attacker_name: "P" + id,
  defender_faction: ENEMY, defender_id: "9" + id, ranked_war: 1,
  respect_gain: respect, result: "Hospitalized",
  modifiers: { war: 2, chain_bonus: 1, warlord_bonus: 1, fair_fight: 2, ...mods },
});
const nonWarHit = (id, respect, mods) => {
  const h = hit(id, respect, mods);
  delete h.ranked_war;
  return h;
};
const score = (attacks, settings) =>
  tallyAttacks(attacks, { ourFid: OURS, enemyFactionId: ENEMY, mode: "dynamic", settings });

test("by default a warlord bonus is still stripped", () => {
  // respect_gain ALREADY includes the multiplier — that is what a modifier
  // does — so the same fight with warlord x2 arrives as twice the respect.
  // Dividing it back out is precisely how the two were made equal; not
  // dividing it is how the weapon starts counting.
  const plain   = score([hit("1", 20, { warlord_bonus: 1 })], {});
  const boosted = score([hit("2", 40, { warlord_bonus: 2 })], {});
  assert.equal(boosted["2"].fairScoreSum, plain["1"].fairScoreSum,
    "an untouched war must score exactly as it did before the toggle existed");
});

test("opting in makes the warlord hit worth more, which is the point of it", () => {
  // respect_gain ALREADY includes the multiplier, so the same fight with
  // warlord x2 arrives as twice the respect. Dividing it back out is what made
  // the two equal; not dividing it is what makes the weapon count.
  const plain   = score([hit("1", 20, { warlord_bonus: 1 })], { includeWarlord: true });
  const boosted = score([hit("2", 40, { warlord_bonus: 2 })], { includeWarlord: true });
  assert.ok(boosted["2"].fairScoreSum > plain["1"].fairScoreSum);
  assert.equal(boosted["2"].fairScoreSum, 20);
  assert.equal(plain["1"].fairScoreSum, 10);
});

test("the default strips it exactly, and so does saying so explicitly", () => {
  // respect 20 with war 2 and warlord 2 -> 20 / (2*2) = 5.
  for (const settings of [{}, { includeWarlord: false }]) {
    const off = score([hit("1", 20, { warlord_bonus: 2 })], settings);
    assert.equal(Math.round(off["1"].fairScoreSum * 1000) / 1000, 5, JSON.stringify(settings));
  }
});

test("with it counted, only war and chain are divided out", () => {
  // respect 20 with war 2 and warlord 2 -> 20 / 2 = 10.
  const on = score([hit("1", 20, { warlord_bonus: 2 })], { includeWarlord: true });
  assert.equal(Math.round(on["1"].fairScoreSum * 1000) / 1000, 10);
});

test("war and chain are still stripped either way", () => {
  // Those two are circumstantial and this change does not touch them.
  for (const settings of [{}, { includeWarlord: true }]) {
    const s = score([hit("1", 40, { war: 2, chain_bonus: 2, warlord_bonus: 1 })], settings);
    assert.equal(Math.round(s["1"].fairScoreSum * 1000) / 1000, 10, JSON.stringify(settings));
  }
});

test("a member with no warlord weapon is unaffected in absolute terms", () => {
  // Their score does not fall — their SHARE does, because others rose. Worth
  // pinning: the change must not quietly penalise anyone's raw score.
  const a = score([hit("1", 20, {})], {});
  const b = score([hit("1", 20, {})], { includeWarlord: true });
  assert.equal(a["1"].fairScoreSum, b["1"].fairScoreSum);
});

test("a missing warlord modifier is treated as no bonus", () => {
  const s = score([{ ...hit("1", 20, {}), modifiers: { war: 2, fair_fight: 2 } }], { includeWarlord: true });
  assert.equal(Math.round(s["1"].fairScoreSum * 1000) / 1000, 10);
});

test("a non-war hit follows the same rule", () => {
  // The non-war branch divided warlord out too. Leaving it behind would score
  // the two kinds of attack by different standards.
  const on = score([nonWarHit("1", 20, { warlord_bonus: 2, war: 1 })], { includeWarlord: true });
  const off = score([nonWarHit("1", 20, { warlord_bonus: 2, war: 1 })], {});
  assert.ok(on["1"].fairScoreSum > off["1"].fairScoreSum,
    "the non-war branch ignored the setting");
  // 20 * 0.3 = 6 with it counted; 20 * 0.3 / 2 = 3 without.
  assert.equal(Math.round(on["1"].fairScoreSum * 100) / 100, 6);
  assert.equal(Math.round(off["1"].fairScoreSum * 100) / 100, 3);
});
