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

// ── rows, medians, flags ─────────────────────────────────────────────────
// The flag is what a leader acts on, so it has to be explainable and it has to
// be hard to trip by accident. These pin both halves: what makes a flag fire,
// and what must never make one fire.
import { buildReport, METRICS } from "./slackers-model.js";

const NOW = 1788800000000;
const mkWar = (enemy, members) => ({
  warKey: String(enemy), realWarId: enemy, enemyFactionId: enemy, enemyFactionName: "E" + enemy,
  warStart: NOW - 10 * DAY, capturedAt: NOW - 9 * DAY, members,
});
const mkMember = (id, warHits, nonWar, xan) => ({
  playerId: id, name: "P" + id, warHits, xanaxTaken: xan, breakdown: { non_war: nonWar },
});
const mkRoster = (ids, days = 400) => ids.map((id) => ({
  playerId: id, name: "P" + id, level: 50, position: "Member", daysInFaction: days,
}));

test("totals are not doubled by a war stored twice", () => {
  const w = mkWar(11, [mkMember("1", 10, 2, 1)]);
  const dup = { ...w, warKey: "archived_42055_11_x", realWarId: null };
  const r = buildReport({ wars: [w, dup], roster: mkRoster(["1"]), readings: [], nowMs: NOW });
  assert.equal(r.warsCounted, 1);
  assert.equal(r.rows[0].warHits, 10);
});

test("a member who missed wars is rated per war present, not per war fought", () => {
  const wars = [
    mkWar(11, [mkMember("1", 30, 0, 3), mkMember("2", 10, 0, 1)]),
    mkWar(12, [mkMember("1", 30, 0, 3)]),
  ];
  const r = buildReport({ wars, roster: mkRoster(["1", "2"]), readings: [], nowMs: NOW });
  const two = r.rows.find((x) => x.playerId === "2");
  assert.equal(two.warsPresent, 1);
  assert.equal(two.warHits, 10);
  assert.equal(two.warHitsPerWar, 10);
});

test("someone below half the median on two metrics is flagged, on one is not", () => {
  const members = [
    mkMember("1", 100, 20, 10), mkMember("2", 100, 20, 10), mkMember("3", 100, 20, 10),
    mkMember("4", 10, 1, 10),   // war hits AND chain hits far below
    mkMember("5", 10, 20, 10),  // war hits only
  ];
  const r = buildReport({
    wars: [mkWar(11, members)], roster: mkRoster(["1", "2", "3", "4", "5"]), readings: [], nowMs: NOW,
  });
  assert.equal(r.rows.find((x) => x.playerId === "4").flagged, true);
  assert.equal(r.rows.find((x) => x.playerId === "5").flagged, false);
});

test("a metric whose median is zero cannot flag anyone", () => {
  const members = [mkMember("1", 100, 0, 10), mkMember("2", 100, 0, 10), mkMember("3", 4, 0, 10)];
  const r = buildReport({
    wars: [mkWar(11, members)], roster: mkRoster(["1", "2", "3"]), readings: [], nowMs: NOW,
  });
  const three = r.rows.find((x) => x.playerId === "3");
  assert.equal(three.reasons.includes("chainHitsPerWar"), false);
});

test("a member in no wars is flagged and never divides by zero", () => {
  const r = buildReport({
    wars: [mkWar(11, [mkMember("1", 50, 5, 5)])], roster: mkRoster(["1", "9"]), readings: [], nowMs: NOW,
  });
  const nine = r.rows.find((x) => x.playerId === "9");
  assert.equal(nine.warsPresent, 0);
  assert.equal(nine.warHitsPerWar, 0);
  assert.equal(nine.flagged, true);
  assert.ok(nine.reasons.includes("no-wars"));
});

test("under the cutoff is carried but not eligible, and not in the medians", () => {
  const members = [mkMember("1", 100, 10, 10), mkMember("2", 100, 10, 10), mkMember("3", 2, 0, 0)];
  const roster = [...mkRoster(["1", "2"]), ...mkRoster(["3"], 30)];
  const r = buildReport({ wars: [mkWar(11, members)], roster, readings: [], nowMs: NOW });
  const three = r.rows.find((x) => x.playerId === "3");
  assert.equal(three.eligible, false);
  assert.equal(three.flagged, false);
  assert.equal(r.cohortSize, 2);
  assert.equal(r.medians.warHitsPerWar, 100);
});

test("someone who fought but has left the faction is not a row", () => {
  const r = buildReport({
    wars: [mkWar(11, [mkMember("1", 50, 5, 5), mkMember("gone", 1, 0, 0)])],
    roster: mkRoster(["1"]), readings: [], nowMs: NOW,
  });
  assert.equal(r.rows.length, 1);
  assert.equal(r.formerMembers, 1);
});

test("the four metrics are the ones the page renders", () => {
  assert.deepEqual(METRICS, ["warHitsPerWar", "chainHitsPerWar", "xanaxPerWar", "energyPerDay"]);
});

test("a war hitter above the median is never flagged, whatever else is low", () => {
  const members = [
    mkMember("1", 20, 10, 5), mkMember("2", 20, 10, 5), mkMember("3", 20, 10, 5),
    mkMember("4", 60, 0, 0),   // 3x the median on war hits, nothing else
  ];
  const r = buildReport({
    wars: [mkWar(11, members)], roster: mkRoster(["1", "2", "3", "4"]), readings: [], nowMs: NOW,
  });
  const four = r.rows.find((x) => x.playerId === "4");
  assert.equal(four.warHitsPerWar > r.medians.warHitsPerWar, true);
  assert.equal(four.flagged, false);
  // The reasons still record what was low, so the table can shade those cells.
  assert.ok(four.reasons.includes("chainHitsPerWar"));
});

test("at or below the median the immunity does not apply", () => {
  const members = [
    mkMember("1", 20, 10, 5), mkMember("2", 20, 10, 5), mkMember("3", 20, 10, 5),
    mkMember("4", 20, 0, 0),   // exactly the median on war hits, low on two
  ];
  const r = buildReport({
    wars: [mkWar(11, members)], roster: mkRoster(["1", "2", "3", "4"]), readings: [], nowMs: NOW,
  });
  assert.equal(r.rows.find((x) => x.playerId === "4").flagged, true);
});
