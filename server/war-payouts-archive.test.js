// Payout settings on a war that has already ended.
//
// Reported: "i cant save the payout weights in settings it doesnt get saved".
// They saved fine -- payout-settings.json had them on disk minutes later. They
// were never READ. A finished war is not in wars.json (the live store is keyed
// war_<factionId> and reused), so store.getWar("48164") returns null and the
// payout code falls into serveArchivedPayout(), whose three exits all ignore
// the payout-settings store: the last one literally returns the frozen
// hw.settings from the history record.
//
// Worse, its first exit reuses any cached compute matched on faction + enemy +
// end-time -- which can be the entry stored under the reused war_42055 key,
// computed with DIFFERENT weights, with nothing saying so.
import { test } from "node:test";
import assert from "node:assert";
import { settingsSignature, membersFromTally, recomputeArchivedResult } from "./war-payouts.js";

const OUR = "42055", ENEMY = "14820";

// Two attackers: one who only assisted, one who only landed hits. Assist
// weight is then the single knob that moves the split, which is exactly what
// the gear panel is for.
const ATTACKS = [
  { attacker_id: "1", attacker_name: "Hitter", attacker_faction: OUR, defender_faction: ENEMY,
    result: "Hospitalized", respect_gain: 100, ranked_war: 1,
    modifiers: { fair_fight: 2, war: 2, chain_bonus: 1, warlord_bonus: 1 } },
  { attacker_id: "2", attacker_name: "Assister", attacker_faction: OUR, defender_faction: ENEMY,
    result: "Assist", respect_gain: 0, ranked_war: 1,
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

// ---- the fingerprint that decides whether a cached result may be reused ----

test("settings that differ produce different signatures", () => {
  assert.notStrictEqual(
    settingsSignature({ assistWeight: 0.35 }),
    settingsSignature({ assistWeight: 0 }));
});

test("the same settings produce the same signature, whatever the key order", () => {
  assert.strictEqual(
    settingsSignature({ assistWeight: 0.5, payoutPct: 0.8 }),
    settingsSignature({ payoutPct: 0.8, assistWeight: 0.5 }));
});

test("an absent setting is not the same as a zero one", () => {
  // 0 is a deliberate "pay assists nothing"; absent means "use the default of
  // 0.3". Treating them alike would reuse a cache computed under the wrong one.
  assert.notStrictEqual(settingsSignature({ assistWeight: 0 }), settingsSignature({}));
});

test("updatedAt is not part of the signature", () => {
  // Otherwise every save busts every cache for settings that did not change.
  assert.strictEqual(
    settingsSignature({ assistWeight: 0.5, updatedAt: 1 }),
    settingsSignature({ assistWeight: 0.5, updatedAt: 999 }));
});

// ---- the archived recompute actually applies the weights -------------------

test("an archived war is recomputed from its stored attacks, and the weights bite", () => {
  const paid = recomputeArchivedResult({
    hw: HW, fid: OUR, mode: "static", attacks: ATTACKS,
    settings: { assistWeight: 0.5, payoutPct: 0.8 },
  });
  const unpaid = recomputeArchivedResult({
    hw: HW, fid: OUR, mode: "static", attacks: ATTACKS,
    settings: { assistWeight: 0, payoutPct: 0.8 },
  });
  const share = (r, id) => (r.members.find(m => m.playerId === id) || {}).sharePct || 0;
  assert.ok(share(paid, "2") > 0, "assists paid nothing at assistWeight 0.5");
  assert.strictEqual(share(unpaid, "2"), 0, "assists were paid at assistWeight 0");
  assert.ok(share(paid, "1") < share(unpaid, "1"),
    "paying assists has to dilute the hitter's share");
});

test("the payout pool follows the payout percentage", () => {
  const r80 = recomputeArchivedResult({ hw: HW, fid: OUR, mode: "static", attacks: ATTACKS,
    settings: { payoutPct: 0.8 } });
  const r50 = recomputeArchivedResult({ hw: HW, fid: OUR, mode: "static", attacks: ATTACKS,
    settings: { payoutPct: 0.5 } });
  assert.strictEqual(r80.payoutPool, 800000);
  assert.strictEqual(r50.payoutPool, 500000);
  assert.strictEqual(r50.factionShare, 500000);
});

test("a loot override replaces the archived total", () => {
  const r = recomputeArchivedResult({ hw: HW, fid: OUR, mode: "static", attacks: ATTACKS,
    settings: { lootOverride: 2000000, payoutPct: 0.8 } });
  assert.strictEqual(r.lootTotal, 2000000);
  assert.strictEqual(r.payoutPool, 1600000);
});

test("the result says the settings were applied, and carries them back", () => {
  // The gear panel reads war.settings to fill its boxes. Returning the frozen
  // archive copy is what made a save look like it had not happened.
  const r = recomputeArchivedResult({ hw: HW, fid: OUR, mode: "static", attacks: ATTACKS,
    settings: { assistWeight: 0.35, payoutPct: 0.8 } });
  assert.strictEqual(r.settings.assistWeight, 0.35);
  assert.strictEqual(r.settingsApplied, true);
  assert.strictEqual(r.warId, "48164");
  assert.strictEqual(r.scoreSource, "fair");
});

test("shares add up to a hundred percent", () => {
  const r = recomputeArchivedResult({ hw: HW, fid: OUR, mode: "static", attacks: ATTACKS,
    settings: { assistWeight: 0.5, payoutPct: 0.8 } });
  const total = r.members.reduce((s, m) => s + m.sharePct, 0);
  assert.ok(Math.abs(total - 100) < 0.001, "shares summed to " + total);
});

test("with no attacks at all there is no recompute to serve", () => {
  // Returning an empty board would read as "nobody earned anything", which is
  // a claim about the war rather than about the data.
  assert.strictEqual(recomputeArchivedResult({
    hw: HW, fid: OUR, mode: "static", attacks: [], settings: {} }), null);
  assert.strictEqual(recomputeArchivedResult({
    hw: HW, fid: OUR, mode: "static", attacks: null, settings: {} }), null);
});

// ---- the share arithmetic, on its own --------------------------------------

test("members are ranked and paid in proportion to score", () => {
  const out = membersFromTally({
    a: { playerId: "a", name: "A", fairScoreSum: 75, attackCount: 3, totalAttacks: 3,
         breakdown: {}, ffSum: 6, ffSamples: 3, ffMax: 3 },
    b: { playerId: "b", name: "B", fairScoreSum: 25, attackCount: 1, totalAttacks: 1,
         breakdown: {}, ffSum: 2, ffSamples: 1, ffMax: 2 },
  }, 1000000);
  const a = out.members.find(m => m.playerId === "a");
  const b = out.members.find(m => m.playerId === "b");
  assert.strictEqual(a.sharePct, 75);
  assert.strictEqual(b.sharePct, 25);
  assert.strictEqual(a.dollarPayout, 750000);
  assert.strictEqual(b.dollarPayout, 250000);
  assert.strictEqual(out.totalScore, 100);
});

test("a zero total does not divide by zero", () => {
  const out = membersFromTally({
    a: { playerId: "a", name: "A", fairScoreSum: 0, attackCount: 0, totalAttacks: 0,
         breakdown: {}, ffSum: 0, ffSamples: 0, ffMax: 0 },
  }, 1000000);
  assert.strictEqual(out.members[0].sharePct, 0);
  assert.strictEqual(out.members[0].dollarPayout, 0);
});
