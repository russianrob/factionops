// Turtling: hospitalising your own member so the enemy cannot farm them.
//
// It is a deliberate service to the faction and it currently looks like
// nothing. A turtle hit is not a ranked-war attack, so it never reaches the
// classifier -- it lands in the non-war bucket beside someone mugging a random
// mid-war, paid 0.3 in Termed Mode and, since hitting your own member earns no
// respect, effectively nothing in FF Mode.
//
// Both attacker and defender being ours is a shape nothing else in a war has,
// so it can be told apart with no new data.
import test from "node:test";
import assert from "node:assert";
import { tallyAttacks, ratePayouts, PAYOUT_CATEGORIES } from "./war-payouts.js";

const OUR = "42055", ENEMY = "14820";
const hit = (over = {}) => ({
  attacker_id: "1", attacker_name: "Turtler", attacker_faction: OUR,
  defender_faction: ENEMY, result: "Hospitalized", respect_gain: 10, ranked_war: 1,
  modifiers: { fair_fight: 2, war: 2, chain_bonus: 1, warlord_bonus: 1 }, ...over,
});
// A friendly hospitalisation: ours on both ends, no respect, not a war attack.
const TURTLE = hit({ defender_faction: OUR, respect_gain: 0, ranked_war: 0 });
const tally = (attacks, settings = {}, mode = "static") =>
  tallyAttacks(attacks, { ourFid: OUR, enemyFactionId: ENEMY, mode, settings });

test("a hit on our own member is counted as turtling", () => {
  const t = tally([TURTLE]);
  assert.strictEqual(t["1"].breakdown.turtle, 1);
});

test("and is no longer filed beside people farming randoms", () => {
  const t = tally([TURTLE]);
  assert.strictEqual(t["1"].breakdown.non_war, undefined);
});

test("a hit on the enemy is untouched by any of this", () => {
  const t = tally([hit()]);
  assert.strictEqual(t["1"].breakdown.turtle, undefined);
  assert.strictEqual(t["1"].breakdown.war_hit, 1);
});

test("a non-war hit on an OUTSIDER is still a non-war hit", () => {
  // Only our own faction counts as turtling. A mug on a stranger during the
  // war is the thing the non-war bucket is actually for.
  const t = tally([hit({ defender_faction: "99999", ranked_war: 0, respect_gain: 5 })]);
  assert.strictEqual(t["1"].breakdown.non_war, 1);
  assert.strictEqual(t["1"].breakdown.turtle, undefined);
});

test("naming the category does not quietly change what anyone is paid", () => {
  // A friendly hit earns no respect, so it was already being dropped by the
  // zero-respect gate and scored nothing. It still scores nothing until a
  // turtle weight is set -- naming a category must not move money on wars that
  // have already been settled. What changes is that the hit is now COUNTED.
  for (const mode of ["static", "dynamic"]) {
    const t = tally([TURTLE], { nonWarWeight: 0.3 }, mode);
    assert.strictEqual(t["1"].fairScoreSum, 0, mode + " started paying for turtles");
    assert.strictEqual(t["1"].breakdown.turtle, 1, mode + " stopped counting them");
  }
});

test("setting a turtle weight pays it flat, whatever the respect was", () => {
  // There is no respect in a friendly hit, so a respect-scaled weight would
  // always be zero. The point of pricing it is that it pays something.
  const t = tally([TURTLE], { turtleWeight: 1.5 }, "dynamic");
  assert.strictEqual(t["1"].fairScoreSum, 1.5);
});

test("a turtle weight of zero pays nothing and still counts the hit", () => {
  const t = tally([TURTLE], { turtleWeight: 0 }, "static");
  assert.strictEqual(t["1"].fairScoreSum, 0);
  assert.strictEqual(t["1"].breakdown.turtle, 1);
});

test("two turtles are worth two", () => {
  const t = tally([TURTLE, TURTLE], { turtleWeight: 1 }, "static");
  assert.strictEqual(t["1"].breakdown.turtle, 2);
  assert.strictEqual(t["1"].fairScoreSum, 2);
});

test("the rate card can price a turtle", () => {
  assert.ok(PAYOUT_CATEGORIES.includes("turtle"), "turtle needs a rate box of its own");
  const { members } = ratePayouts({
    1: { playerId: "1", name: "Turtler", breakdown: { turtle: 3 }, attackCount: 3, totalAttacks: 3 },
  }, { turtle: 1_000_000 });
  assert.strictEqual(members[0].dollarPayout, 3_000_000);
});
