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

// ── the gym-energy column ────────────────────────────────────────────────
// Torn has no historical form of /v2/faction/contributors, so a windowed
// energy figure can only be a delta between two readings we took ourselves.
// These pin the four states that produces, and the one that bites: leaving
// and rejoining resets the counter, which subtracts as a collapse in training
// unless it is recognised.
import { energyForMember } from "./slackers-model.js";

const DAY = 86400000;
const reading = (at, energy) => ({ at, members: { 1: { energy, days: 500 } } });

test("with no readings at all the mode is unknown and nothing is invented", () => {
  const e = energyForMember([], "1", 500, 1788800000000);
  assert.equal(e.mode, "unknown");
  assert.equal(e.perDay, null);
});

test("under 7 days of history it is the lifetime average since joining", () => {
  const now = 1788800000000;
  const e = energyForMember([reading(now - 2 * DAY, 100000), reading(now, 101000)], "1", 500, now);
  assert.equal(e.mode, "lifetime");
  assert.equal(e.energy, 101000);
  assert.equal(e.perDay, 202); // 101000 / 500 days in faction
});

test("between 7 and 90 days it is a true delta over the real span", () => {
  const now = 1788800000000;
  const e = energyForMember([reading(now - 30 * DAY, 100000), reading(now, 130000)], "1", 500, now);
  assert.equal(e.mode, "partial");
  assert.equal(e.energy, 30000);
  assert.equal(e.spanDays, 30);
  assert.equal(e.perDay, 1000);
});

test("at 90 days or more it is the full window and older readings are ignored", () => {
  const now = 1788800000000;
  const e = energyForMember([
    reading(now - 200 * DAY, 1000),
    reading(now - 90 * DAY, 100000),
    reading(now, 190000),
  ], "1", 500, now);
  assert.equal(e.mode, "full");
  assert.equal(e.energy, 90000);
  assert.equal(e.spanDays, 90);
});

test("a drop between readings is a rejoin, and the window restarts after it", () => {
  const now = 1788800000000;
  const e = energyForMember([
    reading(now - 60 * DAY, 500000),
    reading(now - 30 * DAY, 2000),
    reading(now, 32000),
  ], "1", 500, now);
  assert.equal(e.mode, "rejoined");
  assert.equal(e.energy, 30000);
  assert.equal(e.spanDays, 30);
});

test("a member missing from a reading does not read as a reset", () => {
  const now = 1788800000000;
  const rs = [reading(now - 30 * DAY, 100000), { at: now - 15 * DAY, members: {} }, reading(now, 130000)];
  const e = energyForMember(rs, "1", 500, now);
  assert.equal(e.mode, "partial");
  assert.equal(e.energy, 30000);
});
