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

import { runPoll } from "./stakeout-watcher.js";
import * as stkStore from "./stakeout-store.js";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join as pathJoin } from "node:path";

const profile = (state) => ({ profile: { name: "Bob", status: { state, description: "" }, last_action: { status: "Online", timestamp: 1 }, life: { current: 100, maximum: 100 }, revivable: false } });

test("runPoll: per-owner key, fires on transition; shared target fetched once per owner", async () => {
  process.env.DATA_DIR = mkdtempSync(pathJoin(tmpdir(), "stk-"));
  stkStore.load();
  stkStore.syncOwner("111", "ENC_A", [{ id: 5, label: "", alerts: { hospital: true } }], []);
  stkStore.syncOwner("222", "ENC_B", [{ id: 5, label: "", alerts: { hospital: true } }], []);

  const calls = [], sent = [];
  let state = "Okay";
  const fetchImpl = async (kind, id, key) => { calls.push(`${key}:${kind}:${id}`); return profile(state); };
  const sendImpl = async (ids, targetId, snap, keys) => { sent.push({ ids, keys }); };
  const decryptKey = (enc) => (enc === "ENC_A" ? "KEY_A" : "KEY_B");

  await runPoll({ fetchImpl, sendImpl, nowFn: () => 1000, decryptKey });   // seed both
  assert.deepEqual(calls.sort(), ["KEY_A:player:5", "KEY_B:player:5"], "each owner's own key, fetched per owner");
  state = "Hospital";
  await runPoll({ fetchImpl, sendImpl, nowFn: () => 2000, decryptKey });   // both fire
  assert.equal(sent.length, 2);
  assert.deepEqual(sent[0].keys, ["hospital"]);
});

test("runPoll: idle short-circuit (no owners) does zero fetches", async () => {
  process.env.DATA_DIR = mkdtempSync(pathJoin(tmpdir(), "stk-"));
  stkStore.load();
  let fetched = 0;
  const r = await runPoll({ fetchImpl: async () => { fetched++; return {}; }, sendImpl: async () => {}, nowFn: () => 1, decryptKey: () => "K" });
  assert.equal(fetched, 0);
  assert.equal(r.owners, 0);
});

test("runPoll: owner whose key won't decrypt is skipped", async () => {
  process.env.DATA_DIR = mkdtempSync(pathJoin(tmpdir(), "stk-"));
  stkStore.load();
  stkStore.syncOwner("111", "BAD", [{ id: 7, label: "", alerts: { online: true } }], []);
  let fetched = 0;
  await runPoll({ fetchImpl: async () => { fetched++; return {}; }, sendImpl: async () => {}, nowFn: () => 1, decryptKey: () => { throw new Error("bad"); } });
  assert.equal(fetched, 0);
});
