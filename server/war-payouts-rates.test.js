// Fixed-rate payouts: a dollar figure per hit rather than a share of a pool.
//
// Asked for: "can i change it to static instead of percentage". The pool split
// pays out loot x 80% divided by score, so what a hit is worth depends on what
// everyone else did and on how much the war looted. A faction that promises
// "$2m a war hit" cannot say that with a share model.
//
// Here the rates are the input and the pool is the OUTPUT: each member is paid
// their own counts times the rates, and the faction's bill is whatever that
// adds up to -- which may be more than the war looted, and has to say so
// rather than quietly showing a negative faction share.
import test from "node:test";
import assert from "node:assert";
import { ratePayouts, settingsSignature, recomputeArchivedResult } from "./war-payouts.js";

const member = (playerId, name, breakdown) => ({
  playerId, name, breakdown,
  attackCount: Object.values(breakdown).reduce((a, b) => a + b, 0),
  totalAttacks: Object.values(breakdown).reduce((a, b) => a + b, 0),
});
const RATES = { war_hit: 2_000_000, retal: 2_500_000, assist: 500_000 };

test("a member is paid their own counts times the rates", () => {
  const { members } = ratePayouts({
    1: member("1", "Easy", { war_hit: 18, retal: 4, assist: 6 }),
  }, RATES);
  // 18*2m + 4*2.5m + 6*0.5m
  assert.strictEqual(members[0].dollarPayout, 49_000_000);
});

test("the pool is the sum of what the members earned, not an input", () => {
  const { members, payoutPool } = ratePayouts({
    1: member("1", "Easy", { war_hit: 10 }),
    2: member("2", "Rob", { war_hit: 5, assist: 2 }),
  }, RATES);
  assert.strictEqual(payoutPool, 20_000_000 + 10_000_000 + 1_000_000);
  assert.strictEqual(members.reduce((s, m) => s + m.dollarPayout, 0), payoutPool);
});

test("a category with no rate set is worth nothing, not NaN", () => {
  const { members } = ratePayouts({
    1: member("1", "Easy", { war_hit: 1, chain_hit: 99 }),
  }, { war_hit: 1_000_000 });
  assert.strictEqual(members[0].dollarPayout, 1_000_000);
});

test("a category nobody has priced does not poison the total", () => {
  // classify() can only return six categories, but a stored breakdown from an
  // older build could carry anything. It must be ignored, not added as NaN.
  const { members, payoutPool } = ratePayouts({
    1: member("1", "Easy", { war_hit: 2, some_future_kind: 5 }),
  }, RATES);
  assert.strictEqual(members[0].dollarPayout, 4_000_000);
  assert.strictEqual(payoutPool, 4_000_000);
});

test("two members with the same hit count are paid differently on the mix", () => {
  // The whole point of per-category rates: ten retals is not ten chain hits.
  const { members } = ratePayouts({
    1: member("1", "Retals", { retal: 10 }),
    2: member("2", "Assists", { assist: 10 }),
  }, RATES);
  const by = Object.fromEntries(members.map(m => [m.name, m.dollarPayout]));
  assert.strictEqual(by.Retals, 25_000_000);
  assert.strictEqual(by.Assists, 5_000_000);
});

test("the board is ordered by what each member is owed", () => {
  const { members } = ratePayouts({
    1: member("1", "Small", { war_hit: 1 }),
    2: member("2", "Big", { war_hit: 9 }),
  }, RATES);
  assert.deepStrictEqual(members.map(m => m.name), ["Big", "Small"]);
});

test("share percentages still describe the split and still sum to 100", () => {
  const { members } = ratePayouts({
    1: member("1", "A", { war_hit: 3 }),
    2: member("2", "B", { war_hit: 1 }),
  }, RATES);
  assert.strictEqual(members[0].sharePct, 75);
  assert.strictEqual(members[1].sharePct, 25);
});

test("rates of zero pay nothing and do not divide by zero", () => {
  const { members, payoutPool } = ratePayouts({
    1: member("1", "A", { war_hit: 5 }),
  }, {});
  assert.strictEqual(payoutPool, 0);
  assert.strictEqual(members[0].dollarPayout, 0);
  assert.strictEqual(members[0].sharePct, 0);
});

test("nobody attacked, so there is nothing to pay and nothing to divide", () => {
  const { members, payoutPool } = ratePayouts({}, RATES);
  assert.deepStrictEqual(members, []);
  assert.strictEqual(payoutPool, 0);
});

test("a negative rate is refused rather than clawing money back", () => {
  // A typo in a settings box must not turn a payout into a debt.
  const { members } = ratePayouts({
    1: member("1", "A", { war_hit: 5, assist: 5 }),
  }, { war_hit: 1_000_000, assist: -9_000_000 });
  assert.strictEqual(members[0].dollarPayout, 5_000_000);
});

test("the counts that earned the money travel with the row", () => {
  // Somebody will dispute a figure, and the answer has to be on the row rather
  // than in a recomputation nobody can see.
  const { members } = ratePayouts({
    1: member("1", "Easy", { war_hit: 18, assist: 6 }),
  }, RATES);
  assert.deepStrictEqual(members[0].breakdown, { war_hit: 18, assist: 6 });
  assert.strictEqual(members[0].attackCount, 24);
});

test("changing a rate changes the settings signature", () => {
  // The signature is what tells an archived war its numbers are stale. A rate
  // that does not reach it repeats the bug where saved weights changed nothing.
  const a = settingsSignature({ payoutRates: { war_hit: 1_000_000 } });
  const b = settingsSignature({ payoutRates: { war_hit: 2_000_000 } });
  assert.notStrictEqual(a, b);
});

test("the rate card alone is enough to change the signature", () => {
  // The basis is the war mode, which already keys the cache separately. What
  // the signature has to catch is a rate being edited within a mode.
  const a = settingsSignature({ payoutRates: { war_hit: 1_000_000 } });
  const b = settingsSignature({ payoutRates: { war_hit: 1_000_000, assist: 1 } });
  assert.notStrictEqual(a, b);
});

// ---- the mode actually reaches a recomputed war ----------------------------
//
// The pure function above can be perfect while nothing calls it. This drives
// the archive path, which is what the panel reads for a war that has ended.

const OUR = "42055", ENEMY = "14820";
const ATTACKS = [
  { attacker_id: "1", attacker_name: "Hitter", attacker_faction: OUR, defender_faction: ENEMY,
    result: "Hospitalized", respect_gain: 100, ranked_war: 1,
    modifiers: { fair_fight: 2, war: 2, chain_bonus: 1, warlord_bonus: 1 } },
  { attacker_id: "2", attacker_name: "Assister", attacker_faction: OUR, defender_faction: ENEMY,
    result: "Assist", respect_gain: 0, ranked_war: 1,
    modifiers: { fair_fight: 2, war: 2, chain_bonus: 1, warlord_bonus: 1 } },
];
const HW = {
  warKey: "48164", enemyFactionId: ENEMY, enemyFactionName: "Unbroken Legion",
  warStart: 1787000000000, warEndedAt: 1787100000000,
  lootTotal: 1000000, warResult: "win", warScores: { myScore: 1, enemyScore: 0 },
};
// FF Mode pays fixed rates, Termed Mode splits the pool. Asked for that way
// round explicitly, having been offered the reverse.
const recompute = (settings, mode = "dynamic") => recomputeArchivedResult({
  hw: HW, fid: OUR, mode, attacks: ATTACKS, settings });

test("FF Mode pays the rates, not a share of the loot", () => {
  const r = recompute({ payoutRates: { war_hit: 2_000_000, assist: 500_000 } });
  assert.strictEqual(r.payoutMode, "rates");
  const by = Object.fromEntries(r.members.map(m => [m.name, m.dollarPayout]));
  assert.strictEqual(by.Hitter, 2_000_000);
  assert.strictEqual(by.Assister, 500_000);
});

test("the pool is what the rates came to, and ignores payoutPct entirely", () => {
  const r = recompute({ payoutPct: 0.1,
                        payoutRates: { war_hit: 2_000_000, assist: 500_000 } });
  assert.strictEqual(r.payoutPool, 2_500_000);
});

test("promising more than the war looted is reported, not hidden", () => {
  // Loot is 1m and the rates come to 2.5m. A faction has to see that it is
  // 1.5m short before it starts paying people.
  const r = recompute({ payoutRates: { war_hit: 2_000_000, assist: 500_000 } });
  assert.strictEqual(r.factionShare, -1_500_000);
  assert.strictEqual(r.payoutShortfall, 1_500_000);
});

test("a war that comfortably covers its rates has no shortfall", () => {
  const r = recompute({ payoutRates: { war_hit: 100_000, assist: 50_000 } });
  assert.strictEqual(r.payoutShortfall, 0);
  assert.ok(r.factionShare > 0);
});

test("Termed Mode is untouched and still splits the pool by score", () => {
  const r = recompute({ payoutPct: 0.8, assistWeight: 0.5 }, "static");
  assert.strictEqual(r.payoutMode, "pool");
  assert.strictEqual(r.payoutPool, 800_000);
  assert.strictEqual(r.payoutShortfall, 0);
  assert.strictEqual(r.scoreSource, "fair");
});

test("the rate card travels with the result so the panel can show it", () => {
  const rates = { war_hit: 2_000_000, assist: 500_000 };
  assert.deepStrictEqual(recompute({ payoutRates: rates }).payoutRates, rates);
});
