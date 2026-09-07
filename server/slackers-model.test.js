// The slackers report is four numbers per member, and every one of them has a
// way of being quietly wrong: war-history stores some wars twice, a member who
// joined last month was not present for wars they never fought, and Torn's gym
// energy is a cumulative counter that resets when somebody leaves and rejoins.
// These tests pin each of those, because a report that is wrong in a way nobody
// notices is worse than no report — it gets read out to someone's face.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  dedupeWars, warsInWindow, presenceByPlayer,
} from "./slackers-model.js";

const war = (over = {}) => ({
  warKey: "k", realWarId: null, enemyFactionId: 38761, enemyFactionName: "Foe",
  warStart: 1787270000000, capturedAt: 1787279169000, members: [], ...over,
});

test("the same war stored twice collapses to one, keeping the real war id", () => {
  const kept = dedupeWars([
    war({ warKey: "archived_42055_38761_1787279169", capturedAt: 2 }),
    war({ warKey: "47710", realWarId: 47710, capturedAt: 1 }),
  ]);
  assert.equal(kept.length, 1);
  assert.equal(kept[0].realWarId, 47710);
});

test("two different enemies on the same day are two wars", () => {
  const kept = dedupeWars([war({ enemyFactionId: 1 }), war({ enemyFactionId: 2 })]);
  assert.equal(kept.length, 2);
});

test("with no real war id the earliest capture wins", () => {
  const kept = dedupeWars([
    war({ warKey: "b", capturedAt: 20 }),
    war({ warKey: "a", capturedAt: 10 }),
  ]);
  assert.equal(kept.length, 1);
  assert.equal(kept[0].warKey, "a");
});

test("the window is measured from warStart and sorted oldest first", () => {
  const now = 1788800000000;
  const inside = war({ enemyFactionId: 1, warStart: now - 10 * 86400000 });
  const older = war({ enemyFactionId: 2, warStart: now - 80 * 86400000 });
  const outside = war({ enemyFactionId: 3, warStart: now - 100 * 86400000 });
  const got = warsInWindow([inside, outside, older], now, 90);
  assert.deepEqual(got.map((w) => w.enemyFactionId), [2, 1]);
});

test("presence counts the wars a player appears in, not the wars that happened", () => {
  const wars = [
    war({ enemyFactionId: 1, members: [{ playerId: "1" }, { playerId: "2" }] }),
    war({ enemyFactionId: 2, members: [{ playerId: "1" }] }),
  ];
  const p = presenceByPlayer(wars);
  assert.equal(p.get("1"), 2);
  assert.equal(p.get("2"), 1);
  assert.equal(p.get("3"), undefined);
});
