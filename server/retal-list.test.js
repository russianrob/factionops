import test from "node:test";
import assert from "node:assert/strict";
import { computeIncomingRetals } from "./retal-tracker.js";

const NOW = 1781700000;
const ENEMY = 44092;

// A v1 faction-attack object as it appears in OUR faction's attack log.
function atk(o = {}) {
  const m = Object.assign({
    attacker_id: 100, attacker_name: "Foe", attacker_faction: ENEMY,
    defender_id: 5, defender_name: "Us", result: "Hospitalized",
    timestamp_ended: NOW - 60, timestamp_started: NOW - 70,
  }, o);
  if (m.code === undefined) m.code = "c" + m.attacker_id;
  return m;
}

test("includes an in-window enemy attack on us", () => {
  const r = computeIncomingRetals([atk()], ENEMY, NOW);
  assert.equal(r.length, 1);
  assert.deepEqual(r[0], {
    attackId: "c100", attackerId: 100, attackerName: "Foe",
    defenderId: 5, defenderName: "Us", result: "Hospitalized",
    endedTs: NOW - 60, attackerLevel: null,
  });
});

test("excludes attacks by non-enemy factions", () => {
  assert.equal(computeIncomingRetals([atk({ attacker_faction: 999 })], ENEMY, NOW).length, 0);
});

test("excludes stealthed attacks (no attacker id)", () => {
  assert.equal(computeIncomingRetals([atk({ attacker_id: "" })], ENEMY, NOW).length, 0);
});

test("excludes attacks older than the 5-min window", () => {
  assert.equal(computeIncomingRetals([atk({ timestamp_ended: NOW - 301 })], ENEMY, NOW).length, 0);
});

test("excludes FAILED enemy attacks (Lost/Stalemate/Escape/Interrupted/Timeout)", () => {
  for (const result of ["Lost", "Stalemate", "Escape", "Interrupted", "Timeout"]) {
    assert.equal(computeIncomingRetals([atk({ result })], ENEMY, NOW).length, 0, result + " should NOT be a retal");
  }
});

test("includes SUCCESSFUL enemy attacks (Mugged/Attacked/Arrested/Looted/Hospitalized)", () => {
  for (const result of ["Mugged", "Attacked", "Arrested", "Looted", "Hospitalized"]) {
    assert.equal(computeIncomingRetals([atk({ result })], ENEMY, NOW).length, 1, result + " should be a retal");
  }
});

test("reads attacker_faction_id when attacker_faction is absent", () => {
  const a = atk(); delete a.attacker_faction; a.attacker_faction_id = ENEMY;
  assert.equal(computeIncomingRetals([a], ENEMY, NOW).length, 1);
});

test("sorts newest-first", () => {
  const r = computeIncomingRetals(
    [atk({ attacker_id: 1, timestamp_ended: NOW - 200 }), atk({ attacker_id: 2, timestamp_ended: NOW - 30 })],
    ENEMY, NOW);
  assert.deepEqual(r.map(x => x.attackerId), [2, 1]);
});

test("enriches attacker level from enemyStatuses", () => {
  const r = computeIncomingRetals([atk({ attacker_id: 7 })], ENEMY, NOW, 300, { "7": { level: 80 } });
  assert.equal(r[0].attackerLevel, 80);
});

test("falls back to attackerId-endedTs when code missing", () => {
  const a = atk({ attacker_id: 9 }); delete a.code;
  assert.equal(computeIncomingRetals([a], ENEMY, NOW)[0].attackId, "9-" + (NOW - 60));
});

test("empty / non-array / no-enemy input returns []", () => {
  assert.deepEqual(computeIncomingRetals(null, ENEMY, NOW), []);
  assert.deepEqual(computeIncomingRetals([], ENEMY, NOW), []);
  assert.deepEqual(computeIncomingRetals([atk()], null, NOW), []);
});
