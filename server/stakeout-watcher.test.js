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

import { buildStakeoutPayload } from "./stakeout-watcher.js";

test("buildStakeoutPayload: shape, primitive data, deep link", () => {
  const p = buildStakeoutPayload(2194491, { name: "Bob" }, ["online"], "player");
  assert.equal(p.title, "Stakeout");
  assert.equal(p.body, "Bob is online");
  assert.equal(p.tag, "stakeout-2194491");
  assert.equal(p.threadId, "stakeout");
  assert.deepEqual(p.data, { type: "stakeout_alert", targetId: "2194491", trigger: "online", url: "https://www.torn.com/profiles.php?XID=2194491" });
  for (const v of Object.values(p.data)) assert.equal(typeof v, "string");
});
test("buildStakeoutPayload: faction deep link + fallback name", () => {
  const p = buildStakeoutPayload(16335, {}, ["rankedWarStarts"], "faction");
  assert.equal(p.body, "Faction 16335 started a ranked war");
  assert.equal(p.data.url, "https://www.torn.com/factions.php?step=profile&ID=16335");
});

import { NOTIFICATION_TYPES, getPreferences } from "./push-notifications.js";

test("stakeout_alert type registered, default on, in preferences", () => {
  assert.ok(NOTIFICATION_TYPES.stakeout_alert);
  assert.equal(NOTIFICATION_TYPES.stakeout_alert.default, true);
  assert.equal(NOTIFICATION_TYPES.stakeout_alert.oc, undefined);
  assert.equal(getPreferences("000")["stakeout_alert"], true);
});
