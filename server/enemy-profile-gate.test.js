import test from "node:test";
import assert from "node:assert/strict";
import {
  enemyProfilePrewarDelay,
  ENEMY_PROFILE_RAMP_SEC,
  ENEMY_PROFILE_PREWAR_MS,
  couldBeAttacking,
} from "./enemy-profile-gate.js";

const NOW = 1781800000; // unix seconds
const BASE = 2500;      // normal fast cadence (ms)

test("active war (warStart in the past) polls at full speed", () => {
  assert.equal(enemyProfilePrewarDelay(NOW - 3600, BASE, NOW), BASE);
});

test("imminent war (inside the ramp window) polls at full speed", () => {
  assert.equal(enemyProfilePrewarDelay(NOW + ENEMY_PROFILE_RAMP_SEC - 60, BASE, NOW), BASE);
});

test("exactly at the ramp boundary is full speed", () => {
  assert.equal(enemyProfilePrewarDelay(NOW + ENEMY_PROFILE_RAMP_SEC, BASE, NOW), BASE);
});

test("upcoming war just beyond the ramp window is throttled", () => {
  assert.equal(enemyProfilePrewarDelay(NOW + ENEMY_PROFILE_RAMP_SEC + 1, BASE, NOW), ENEMY_PROFILE_PREWAR_MS);
});

test("far-future war is throttled to the pre-war cadence", () => {
  assert.equal(enemyProfilePrewarDelay(NOW + 2 * 24 * 3600, BASE, NOW), ENEMY_PROFILE_PREWAR_MS);
});

test("missing warStart falls back to the base (active) cadence", () => {
  assert.equal(enemyProfilePrewarDelay(0, BASE, NOW), BASE);
  assert.equal(enemyProfilePrewarDelay(undefined, BASE, NOW), BASE);
  assert.equal(enemyProfilePrewarDelay(null, BASE, NOW), BASE);
});

test("never returns shorter than the base delay", () => {
  const big = ENEMY_PROFILE_PREWAR_MS + 999;
  assert.equal(enemyProfilePrewarDelay(NOW + 10 * 24 * 3600, big, NOW), big);
});

test("couldBeAttacking: online + okay → true", () => {
  assert.equal(couldBeAttacking({ activity: "online", status: "okay" }), true);
});

test("couldBeAttacking: online + already attacking → true (keep polling to catch the stop)", () => {
  assert.equal(couldBeAttacking({ activity: "online", status: "attacking" }), true);
});

test("couldBeAttacking: online + abroad → true (can still attack)", () => {
  assert.equal(couldBeAttacking({ activity: "online", status: "abroad" }), true);
});

test("couldBeAttacking: offline / idle → false (not currently active)", () => {
  assert.equal(couldBeAttacking({ activity: "offline", status: "okay" }), false);
  assert.equal(couldBeAttacking({ activity: "idle", status: "okay" }), false);
});

test("couldBeAttacking: online but hospital / traveling / jail / federal → false", () => {
  assert.equal(couldBeAttacking({ activity: "online", status: "hospital" }), false);
  assert.equal(couldBeAttacking({ activity: "online", status: "traveling" }), false);
  assert.equal(couldBeAttacking({ activity: "online", status: "jail" }), false);
  assert.equal(couldBeAttacking({ activity: "online", status: "federal" }), false);
});

test("couldBeAttacking: online with missing status defaults pollable; null entry → false", () => {
  assert.equal(couldBeAttacking({ activity: "online" }), true);
  assert.equal(couldBeAttacking(null), false);
});
