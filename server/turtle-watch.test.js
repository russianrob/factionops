// Who needs turtling: which of our own members the enemy is farming right now.
//
// Turtling is hospitalising your own member so the enemy cannot keep hitting
// them. The question it answers is "who is bleeding us points", and the attack
// ledger already knows -- 7,696 of the 20,646 rows in a real war file are
// attacks where WE are the defender, and each carries the respect the enemy
// took off us.
//
// So the ranking is the damage itself, not a proxy like level or hit count. A
// member giving away 40 respect an hour needs taking off the board before one
// who has been poked twice for nothing.
import test from "node:test";
import assert from "node:assert";
import { turtleWatch } from "./turtle-watch.js";

const OUR = "42055", ENEMY = "14820", NOW = 1_800_000_000;
const MIN = 60;
const inc = (over = {}) => ({
  defenderId: "100", defenderName: "Victim", defenderFactionId: OUR,
  attackerId: "900", attackerName: "Bully", attackerFactionId: ENEMY,
  result: "Attacked", respectGain: 10, ended: NOW - 5 * MIN, ...over,
});
const watch = (rows, opts = {}) => turtleWatch(rows, {
  ourFid: OUR, enemyFactionId: ENEMY, windowMs: 60 * 60 * 1000, now: NOW * 1000, ...opts,
});

test("a member the enemy is hitting shows up, with what it has cost", () => {
  const r = watch([inc(), inc({ respectGain: 15 })]);
  assert.strictEqual(r.length, 1);
  assert.strictEqual(r[0].playerId, "100");
  assert.strictEqual(r[0].hits, 2);
  assert.strictEqual(r[0].respectLost, 25);
});

test("the worst bleed is first, because that is who to turtle", () => {
  const r = watch([
    inc({ defenderId: "1", defenderName: "Poked", respectGain: 3 }),
    inc({ defenderId: "2", defenderName: "Farmed", respectGain: 40 }),
  ]);
  assert.deepStrictEqual(r.map(m => m.name), ["Farmed", "Poked"]);
});

test("attacks the enemy lost cost us nothing and are not counted", () => {
  // Being attacked is not the same as bleeding. A defence gives them no points
  // and is no reason to take somebody off the board.
  const r = watch([
    inc({ result: "Lost" }), inc({ result: "Stalemate" }),
    inc({ result: "Escape" }), inc({ result: "Interrupted" }),
  ]);
  assert.deepStrictEqual(r, []);
});

test("a mug and a hospitalisation both count as a win against us", () => {
  const r = watch([inc({ result: "Mugged" }), inc({ result: "Hospitalized" })]);
  assert.strictEqual(r[0].hits, 2);
});

test("an assist is not counted twice against the same member", () => {
  // The finishing blow is its own row. Counting the assist as well would say
  // two people got farmed when one did.
  const r = watch([inc({ result: "Assist", respectGain: 0 }), inc()]);
  assert.strictEqual(r[0].hits, 1);
});

test("anything older than the window is not what is happening now", () => {
  const r = watch([inc({ ended: NOW - 120 * MIN }), inc({ ended: NOW - 10 * MIN })]);
  assert.strictEqual(r[0].hits, 1);
});

test("the window is adjustable, because wars have quiet stretches", () => {
  const rows = [inc({ ended: NOW - 90 * MIN })];
  assert.deepStrictEqual(watch(rows), []);
  assert.strictEqual(watch(rows, { windowMs: 3 * 60 * 60 * 1000 })[0].hits, 1);
});

test("our own turtling does not read as the enemy farming somebody", () => {
  // A friendly hospitalisation is also an attack on our member, and counting
  // it would put the person we just protected top of the list of people to
  // protect.
  const r = watch([inc({ attackerFactionId: OUR, result: "Hospitalized" })]);
  assert.deepStrictEqual(r, []);
});

test("a third party farming us during the war still counts", () => {
  // The war enemy is the usual case, but points bled are points bled, and the
  // member needs turtling either way.
  const r = watch([inc({ attackerFactionId: "99999" })]);
  assert.strictEqual(r[0].hits, 1);
});

test("hits WE landed on the enemy are not in this list at all", () => {
  const r = watch([{ defenderFactionId: ENEMY, attackerFactionId: OUR,
                     defenderId: "900", defenderName: "Bully",
                     result: "Hospitalized", respectGain: 20, ended: NOW - MIN }]);
  assert.deepStrictEqual(r, []);
});

test("the last hit is reported, so you can see if it is still going on", () => {
  const r = watch([inc({ ended: NOW - 30 * MIN }), inc({ ended: NOW - 2 * MIN })]);
  assert.strictEqual(r[0].lastAt, NOW - 2 * MIN);
});

test("who is doing the farming is named", () => {
  // Useful on its own: one enemy hitting one member is a different problem
  // from six of them queueing up.
  const r = watch([inc({ attackerId: "900", attackerName: "Bully" }),
                   inc({ attackerId: "901", attackerName: "Mate" })]);
  assert.deepStrictEqual(r[0].attackers.sort(), ["Bully", "Mate"]);
});

test("an empty ledger is an empty list, not a crash", () => {
  assert.deepStrictEqual(watch([]), []);
  assert.deepStrictEqual(turtleWatch(null, { ourFid: OUR, now: NOW * 1000 }), []);
});
