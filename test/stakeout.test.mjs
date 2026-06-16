import { readFileSync } from "node:fs";
import vm from "node:vm";
import assert from "node:assert/strict";
import test from "node:test";

function load() {
  const src = readFileSync("/opt/warboard/server/public/scripts/torn-stakeout.user.js", "utf8");
  const sandbox = { module: { exports: {} }, console };
  vm.runInNewContext(src, sandbox, { filename: "torn-stakeout.user.js" });
  return sandbox.module.exports;
}
const S = load();
const NOW = 1_700_000_000_000; // fixed "now" in ms for offline tests
const plain = (o) => JSON.parse(JSON.stringify(o)); // cross-realm: vm objects have a different prototype
const eq = (actual, expected) => assert.deepEqual(plain(actual), expected);

// ---- hoursSince ----
test("hoursSince: 2h ago", () => {
  assert.equal(S.hoursSince(NOW / 1000 - 2 * 3600, NOW), 2);
});

// ---- evaluatePlayer ----
const P_ALERTS = { okay: true, hospital: true, landing: true, online: true, life: 25, offline: 5, revivable: true };
function psnap(o) {
  return Object.assign({ name: "X", state: "Okay", description: "", lastAction: "Offline", lastActionTs: NOW / 1000, lifeCur: 100, lifeMax: 100, revivable: false }, o);
}
test("evaluatePlayer: null old -> baseline, no fire", () => {
  eq(S.evaluatePlayer(null, psnap({}), P_ALERTS, NOW), []);
});
test("evaluatePlayer: okay transition fires once", () => {
  const old = psnap({ state: "Hospital" });
  eq(S.evaluatePlayer(old, psnap({ state: "Okay" }), P_ALERTS, NOW), ["okay"]);
  eq(S.evaluatePlayer(psnap({ state: "Okay" }), psnap({ state: "Okay" }), P_ALERTS, NOW), []);
});
test("evaluatePlayer: hospital transition", () => {
  eq(S.evaluatePlayer(psnap({ state: "Okay" }), psnap({ state: "Hospital" }), P_ALERTS, NOW), ["hospital"]);
});
test("evaluatePlayer: landing fires only from Traveling", () => {
  eq(S.evaluatePlayer(psnap({ state: "Traveling" }), psnap({ state: "Okay" }), P_ALERTS, NOW), ["landing", "okay"]);
  eq(S.evaluatePlayer(psnap({ state: "Okay" }), psnap({ state: "Okay" }), P_ALERTS, NOW), []);
});
test("evaluatePlayer: online transition", () => {
  eq(S.evaluatePlayer(psnap({ lastAction: "Offline" }), psnap({ lastAction: "Online" }), P_ALERTS, NOW), ["online"]);
});
test("evaluatePlayer: life fires on crossing below threshold", () => {
  eq(S.evaluatePlayer(psnap({ lifeCur: 50 }), psnap({ lifeCur: 20 }), P_ALERTS, NOW), ["life"]);
  eq(S.evaluatePlayer(psnap({ lifeCur: 20 }), psnap({ lifeCur: 15 }), P_ALERTS, NOW), []);
});
test("evaluatePlayer: offline fires on crossing N hours", () => {
  const old = psnap({ lastActionTs: NOW / 1000 - 4 * 3600 });
  const snap = psnap({ lastActionTs: NOW / 1000 - 6 * 3600 });
  eq(S.evaluatePlayer(old, snap, P_ALERTS, NOW), ["offline"]);
});
test("evaluatePlayer: revivable false->true", () => {
  eq(S.evaluatePlayer(psnap({ revivable: false }), psnap({ revivable: true }), P_ALERTS, NOW), ["revivable"]);
});
test("evaluatePlayer: disabled alerts never fire", () => {
  const none = { okay: false, hospital: false, landing: false, online: false, life: false, offline: false, revivable: false };
  eq(S.evaluatePlayer(psnap({ state: "Hospital" }), psnap({ state: "Okay" }), none, NOW), []);
});

// ---- evaluateFaction ----
const F_ALERTS = { chainReaches: 100, memberCountDrops: 80, rankedWarStarts: true, inRaid: true, inTerritoryWar: true };
function fsnap(o) {
  return Object.assign({ name: "F", chain: 0, respect: 0, membersCur: 100, membersMax: 100, rankedWar: false, raid: false, territoryWar: false }, o);
}
test("evaluateFaction: null old -> no fire", () => {
  eq(S.evaluateFaction(null, fsnap({}), F_ALERTS), []);
});
test("evaluateFaction: chainReaches crossing up", () => {
  eq(S.evaluateFaction(fsnap({ chain: 90 }), fsnap({ chain: 100 }), F_ALERTS), ["chainReaches"]);
  eq(S.evaluateFaction(fsnap({ chain: 100 }), fsnap({ chain: 110 }), F_ALERTS), []);
});
test("evaluateFaction: chainReaches===0 fires when an active chain drops", () => {
  const drop = { chainReaches: 0, memberCountDrops: false, rankedWarStarts: false, inRaid: false, inTerritoryWar: false };
  eq(S.evaluateFaction(fsnap({ chain: 47 }), fsnap({ chain: 0 }), drop), ["chainReaches"]);
  eq(S.evaluateFaction(fsnap({ chain: 5 }), fsnap({ chain: 0 }), drop), []); // below 10 -> not "active"
});
test("evaluateFaction: memberCountDrops below N", () => {
  eq(S.evaluateFaction(fsnap({ membersCur: 85 }), fsnap({ membersCur: 79 }), F_ALERTS), ["memberCountDrops"]);
});
test("evaluateFaction: war/raid/territory transitions", () => {
  eq(S.evaluateFaction(fsnap({ rankedWar: false }), fsnap({ rankedWar: true }), F_ALERTS), ["rankedWarStarts"]);
  eq(S.evaluateFaction(fsnap({ raid: false }), fsnap({ raid: true }), F_ALERTS), ["inRaid"]);
  eq(S.evaluateFaction(fsnap({ territoryWar: false }), fsnap({ territoryWar: true }), F_ALERTS), ["inTerritoryWar"]);
});

// ---- response mappers ----
test("mapPlayerResponse: v2 user/profile (nested under profile) -> snapshot", () => {
  const j = { profile: { name: "Bob", life: { current: 80, maximum: 100 }, status: { state: "Hospital", description: "In hospital for 10 mins" }, last_action: { status: "Online", timestamp: 1699999000 }, revivable: 1 } };
  eq(S.mapPlayerResponse(j), { name: "Bob", state: "Hospital", description: "In hospital for 10 mins", lastAction: "Online", lastActionTs: 1699999000, lifeCur: 80, lifeMax: 100, revivable: true });
});
test("mapPlayerResponse: flat shape still maps (defensive fallback)", () => {
  const j = { name: "Bob", life: { current: 80, maximum: 100 }, status: { state: "Okay", description: "" }, last_action: { status: "Online", timestamp: 1699999000 }, revivable: 0 };
  eq(S.mapPlayerResponse(j), { name: "Bob", state: "Okay", description: "", lastAction: "Online", lastActionTs: 1699999000, lifeCur: 80, lifeMax: 100, revivable: false });
});
test("mapFactionResponse: v2 basic+chain+wars -> snapshot", () => {
  const j = { basic: { name: "Enemy", respect: 5000, members: 81, capacity: 100 }, chain: { current: 47 }, wars: { ranked: { war_id: 1 }, raids: [], territory: [{ id: 1 }] } };
  eq(S.mapFactionResponse(j), { name: "Enemy", chain: 47, respect: 5000, membersCur: 81, membersMax: 100, rankedWar: true, raid: false, territoryWar: true });
});
