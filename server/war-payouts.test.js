// Assist accounting in the payout maths.
//
// Reported: the payout panel credited RussianRob with 13 assists for war
// 42055 while Torn's own war report said 24. Replaying the attack ledger
// for the exact payout window found the two signals are not merely
// mis-tuned, they are disjoint: across all 1084 rows in that ledger, ZERO
// rows had both `modifiers.group_attack > 1` and `result === "Assist"`.
//
// `group_attack` is Torn's GROUP ATTACK modifier — several people hitting
// one target at once, which is a full hit that earns respect. An ASSIST is
// a result: someone else landed the finishing blow, and the assister earns
// no respect at all. Scoring the first as the second both devalued 13 real
// war hits and silently dropped 23 real assists.
import { test } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import { classify, tallyAttacks } from "./war-payouts.js";

const OUR = "42055", ENEMY = "14820", ME = "137558";

// The exact payout window for war_42055: war.warStart → war.warEndedAt.
const FROM = 1787922000, TO = Math.floor(1788019369748 / 1000);
const LEDGER = "data/attack-ledger/war_war_42055.json";

// Ledger rows are the v2-ish shape; the payout path consumes the v1 shape
// normalizeV2Attack produces.
const toV1 = a => ({
  attacker_id: a.attackerId, attacker_name: a.attackerName,
  attacker_faction: a.attackerFactionId, defender_faction: a.defenderFactionId,
  result: a.result, respect_gain: a.respectGain,
  // Every respect-earning row in this window was a ranked-war attack: the
  // cached breakdown for war_42055 has no non_war bucket at all.
  ranked_war: 1,
  modifiers: {
    fair_fight: a.modifiers.fairFight, war: a.modifiers.war,
    retaliation: a.modifiers.retaliation, group_attack: a.modifiers.group,
    overseas: a.modifiers.overseas, chain_bonus: a.modifiers.chainBonus,
    warlord_bonus: a.modifiers.warlord,
  },
});

function myRows() {
  const j = JSON.parse(fs.readFileSync(LEDGER, "utf8"));
  return Object.values(j.attacks)
    .filter(a => String(a.attackerId) === ME && a.started >= FROM && a.started <= TO)
    .map(toV1);
}

const tally = (rows, settings = {}, mode = "dynamic") =>
  tallyAttacks(rows, { ourFid: OUR, enemyFactionId: ENEMY, mode, settings })[ME];

// ── classify ────────────────────────────────────────────────────────────

test("a real assist is classified as an assist", () => {
  const assist = myRows().find(r => r.result === "Assist");
  assert.ok(assist, "fixture must contain a real assist row");
  assert.strictEqual(assist.modifiers.group_attack, 1, "real assists carry no group modifier");
  assert.strictEqual(assist.respect_gain, 0, "the killer takes the respect, not the assister");
  assert.strictEqual(classify(assist, ENEMY), "assist");
});

test("a group attack is a war hit, not an assist", () => {
  // group_attack > 1 means several attackers hit one target at once. It is a
  // full hit against the enemy and must be paid as one.
  const group = myRows().find(r => r.modifiers.group_attack > 1);
  assert.ok(group, "fixture must contain a group-attack row");
  assert.ok(group.respect_gain > 0, "group attacks earn respect");
  assert.strictEqual(classify(group, ENEMY), "war_hit");
});

// ── the tally ───────────────────────────────────────────────────────────

test("assists survive the zero-respect gate and are counted", () => {
  const rows = myRows();
  const expected = rows.filter(r => r.result === "Assist").length;
  assert.strictEqual(expected, 23, "fixture drift: window should hold 23 assists");
  assert.strictEqual(tally(rows).breakdown.assist, expected);
});

test("assists are not counted as losses", () => {
  // A zero-respect row is not a failure. Only a genuine `Lost` is.
  const rows = myRows();
  assert.strictEqual(tally(rows).breakdown.failed,
    rows.filter(r => r.result === "Lost").length);
});

test("every scored category sums to attackCount", () => {
  const m = tally(myRows());
  const summed = Object.entries(m.breakdown)
    .filter(([k]) => k !== "failed" && k !== "non_war")
    .reduce((s, [, v]) => s + v, 0);
  assert.strictEqual(summed, m.attackCount);
});

test("no attack is dropped: every row lands in a bucket or is a true loss", () => {
  const rows = myRows();
  const m = tally(rows);
  assert.strictEqual(m.totalAttacks, rows.length);
  const bucketed = Object.values(m.breakdown).reduce((s, v) => s + v, 0);
  // Stalemate / Escape / Interrupted / Timeout are deliberately unbucketed.
  const excused = rows.filter(r =>
    ["Stalemate", "Escape", "Interrupted", "Timeout"].includes(r.result)).length;
  assert.strictEqual(bucketed + excused, rows.length);
});

test("assistWeight pays assists in static mode", () => {
  const rows = myRows();
  const n = rows.filter(r => r.result === "Assist").length;
  const paid = tally(rows, { assistWeight: 0.5 }, "static").fairScoreSum;
  const unpaid = tally(rows, { assistWeight: 0 }, "static").fairScoreSum;
  assert.ok(Math.abs((paid - unpaid) - n * 0.5) < 1e-9,
    `expected ${n * 0.5}, got ${paid - unpaid}`);
});

test("dynamic mode cannot pay assists — there is no respect to scale", () => {
  // Documenting a real limitation rather than hiding it. Dynamic mode
  // scores an assist as fair_score x assistWeight, and an assist's
  // fair_score is always 0 because Torn gives the respect to whoever
  // landed the killing blow. So the assistWeight dial does nothing in
  // this mode. Deliberately left alone: deciding what a respect-scaled
  // mode should pay for a zero-respect hit is the admin's policy call.
  const rows = myRows();
  assert.strictEqual(
    tally(rows, { assistWeight: 0 }, "dynamic").fairScoreSum,
    tally(rows, { assistWeight: 5 }, "dynamic").fairScoreSum);
});

test("an admin who never touches the gear panel gets the documented 0.3", () => {
  // The default is what most wars are paid at, so it needs pinning as
  // firmly as the overrides.
  const rows = myRows();
  const n = rows.filter(r => r.result === "Assist").length;
  const dflt = tally(rows, {}, "static").fairScoreSum;
  const zero = tally(rows, { assistWeight: 0 }, "static").fairScoreSum;
  assert.ok(Math.abs((dflt - zero) - n * 0.3) < 1e-9,
    `expected ${n * 0.3}, got ${dflt - zero}`);
});

test("a hit on an unrelated faction is a chain hit, not a war hit", () => {
  // The enemy gate is what separates war hits from chain hits, and the
  // whole war-42055 payout window happens to be enemy-only — so without
  // this the gate could be deleted and every test would still pass.
  const j = JSON.parse(fs.readFileSync(LEDGER, "utf8"));
  const chain = Object.values(j.attacks)
    .filter(a => String(a.attackerId) === ME && a.defenderFactionId !== ENEMY
                 && a.respectGain > 0 && a.modifiers.overseas <= 1)
    .map(toV1)[0];
  assert.ok(chain, "fixture must contain a hit on an unrelated faction");
  assert.strictEqual(classify(chain, ENEMY), "chain_hit");
});
