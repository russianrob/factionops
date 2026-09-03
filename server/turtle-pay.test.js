// A flat dollar amount per turtle, paid off the top of the pool.
//
// Turtling is hospitalising your own member so the enemy cannot farm them. As
// a SCORE it was awkward: the same weight means a war hit's worth in Termed
// Mode and almost nothing in FF Mode, where a real hit scores its respect. A
// dollar figure means the same thing in both.
//
// Off the top rather than on top: the turtlers are paid first and everyone
// else splits what is left, so the pool stays what the faction decided to pay
// out and the faction share is untouched.
import test from "node:test";
import assert from "node:assert";
import { turtleDollars, tallyAttacks, recomputeArchivedResult } from "./war-payouts.js";

const m = (playerId, turtles) => ({ playerId, breakdown: turtles ? { turtle: turtles } : {} });

test("each turtle is worth the flat amount", () => {
  const r = turtleDollars([m("1", 3)], 1_000_000, 100_000_000);
  assert.strictEqual(r.byPlayer["1"], 3_000_000);
  assert.strictEqual(r.spent, 3_000_000);
});

test("members who turtled nobody are paid nothing for it", () => {
  const r = turtleDollars([m("1", 2), m("2", 0)], 1_000_000, 100_000_000);
  assert.strictEqual(r.byPlayer["2"], undefined);
  assert.strictEqual(r.spent, 2_000_000);
});

test("no rate set means no turtle money and nothing taken off the pool", () => {
  const r = turtleDollars([m("1", 5)], 0, 100_000_000);
  assert.deepStrictEqual(r.byPlayer, {});
  assert.strictEqual(r.spent, 0);
  assert.strictEqual(r.capped, false);
});

test("a negative rate is refused rather than charging people to turtle", () => {
  const r = turtleDollars([m("1", 5)], -1_000_000, 100_000_000);
  assert.strictEqual(r.spent, 0);
});

test("turtle pay cannot eat more than the pool", () => {
  // Otherwise the split below it goes negative and the faction pays out more
  // than it decided to.
  const r = turtleDollars([m("1", 100)], 1_000_000, 10_000_000);
  assert.strictEqual(r.spent, 10_000_000);
  assert.strictEqual(r.capped, true);
});

test("and when it is capped, it is shared out in proportion", () => {
  // Three turtles and one turtle, ten million to go round: 7.5m and 2.5m.
  // Paying the first member in full and the second nothing would be arbitrary.
  const r = turtleDollars([m("1", 3), m("2", 1)], 1_000_000_000, 10_000_000);
  assert.strictEqual(r.byPlayer["1"], 7_500_000);
  assert.strictEqual(r.byPlayer["2"], 2_500_000);
  assert.strictEqual(r.spent, 10_000_000);
});

test("nobody turtled, so nothing comes off the pool", () => {
  const r = turtleDollars([m("1", 0), m("2", 0)], 1_000_000, 100_000_000);
  assert.strictEqual(r.spent, 0);
  assert.strictEqual(r.capped, false);
});

test("an empty member list is not a crash", () => {
  const r = turtleDollars([], 1_000_000, 100_000_000);
  assert.strictEqual(r.spent, 0);
});

test("a pool of nothing pays no turtles", () => {
  // A war that looted nothing cannot pay a flat rate out of it.
  const r = turtleDollars([m("1", 4)], 1_000_000, 0);
  assert.strictEqual(r.spent, 0);
});

test("the rounding never spends more than the pool", () => {
  // Three-way split of an odd number: the parts must not add up to more than
  // what was there.
  const r = turtleDollars([m("1", 1), m("2", 1), m("3", 1)], 1_000_000_000, 10_000_001);
  const total = Object.values(r.byPlayer).reduce((a, b) => a + b, 0);
  assert.ok(total <= 10_000_001, "spent " + total + " out of 10,000,001");
});

// ---- and it reaches a real war ---------------------------------------------

const OUR = "42055", ENEMY = "14820";
const ATTACKS = [
  { attacker_id: "1", attacker_name: "Hitter", attacker_faction: OUR, defender_faction: ENEMY,
    result: "Hospitalized", respect_gain: 100, ranked_war: 1,
    modifiers: { fair_fight: 2, war: 2, chain_bonus: 1, warlord_bonus: 1 } },
  { attacker_id: "2", attacker_name: "Turtler", attacker_faction: OUR, defender_faction: OUR,
    result: "Hospitalized", respect_gain: 0, ranked_war: 0, modifiers: {} },
];
const HW = { warKey: "48164", enemyFactionId: ENEMY, warStart: 1787000000000,
             warEndedAt: 1787100000000, lootTotal: 100_000_000, warResult: "win" };
const recompute = settings => recomputeArchivedResult({
  hw: HW, fid: OUR, mode: "static", attacks: ATTACKS, settings });

test("a turtler is paid the flat amount and the hitter splits the rest", () => {
  const r = recompute({ payoutPct: 1, turtlePay: 5_000_000 });
  const by = Object.fromEntries(r.members.map(m => [m.name, m.dollarPayout]));
  assert.strictEqual(by.Turtler, 5_000_000);
  assert.strictEqual(by.Hitter, 95_000_000);
  assert.strictEqual(r.turtlePaid, 5_000_000);
});

test("the pool still adds up to what the faction decided to pay", () => {
  const r = recompute({ payoutPct: 1, turtlePay: 5_000_000 });
  const total = r.members.reduce((a, m) => a + m.dollarPayout, 0);
  assert.strictEqual(total, r.payoutPool);
  assert.strictEqual(r.factionShare, 0);
});

test("a flat rate replaces the score weight rather than stacking on it", () => {
  // Paying both would buy the same hospitalisation twice, once off the top and
  // again through the share.
  const t = tallyAttacks(ATTACKS, { ourFid: OUR, enemyFactionId: ENEMY, mode: "static",
                                    settings: { turtleWeight: 1, turtlePay: 5_000_000 } });
  assert.strictEqual(t["2"].fairScoreSum, 0, "turtler earned score as well as cash");
  assert.strictEqual(t["2"].breakdown.turtle, 1);
});

test("without a flat rate the score weight still works as it did", () => {
  const t = tallyAttacks(ATTACKS, { ourFid: OUR, enemyFactionId: ENEMY, mode: "static",
                                    settings: { turtleWeight: 1 } });
  assert.strictEqual(t["2"].fairScoreSum, 1);
});
