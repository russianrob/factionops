import test from "node:test";
import assert from "node:assert/strict";
import { evaluateTarget, COOLDOWN_MS } from "./stakeout-watcher.js";

const NOW = 1_700_000_000_000;
const psnap = (o) => Object.assign(
  { name: "X", state: "Okay", description: "", lastAction: "Online", lastActionTs: NOW / 1000, lifeCur: 100, lifeMax: 100, revivable: false }, o);
const target = () => ({ alerts: { hospital: true }, info: null, seeded: false, lastFiredAt: {} });

test("evaluateTarget: first observation seeds, never fires", () => {
  const t = target();
  assert.deepEqual(evaluateTarget(t, psnap({ state: "Okay" }), "player", NOW), []);
  assert.equal(t.seeded, true);
  assert.equal(t.info.state, "Okay");
});
test("evaluateTarget: fires once on transition, re-arms, no double-fire", () => {
  const t = target();
  evaluateTarget(t, psnap({ state: "Okay" }), "player", NOW);
  assert.deepEqual(evaluateTarget(t, psnap({ state: "Hospital" }), "player", NOW + 1000), ["hospital"]);
  assert.deepEqual(evaluateTarget(t, psnap({ state: "Hospital" }), "player", NOW + 2000), []);
  assert.equal(t.info.state, "Hospital");
});
test("evaluateTarget: cooldown blocks re-fire in window, allows after; first fire never gated", () => {
  const t = target();
  evaluateTarget(t, psnap({ state: "Okay" }), "player", NOW);
  assert.deepEqual(evaluateTarget(t, psnap({ state: "Hospital" }), "player", NOW + 1000), ["hospital"]);
  evaluateTarget(t, psnap({ state: "Okay" }), "player", NOW + 2000);
  assert.deepEqual(evaluateTarget(t, psnap({ state: "Hospital" }), "player", NOW + 3000), []);
  evaluateTarget(t, psnap({ state: "Okay" }), "player", NOW + 4000);
  assert.deepEqual(evaluateTarget(t, psnap({ state: "Hospital" }), "player", NOW + COOLDOWN_MS + 5000), ["hospital"]);
});
