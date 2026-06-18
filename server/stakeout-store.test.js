import test from "node:test";
import assert from "node:assert/strict";
import { validateStakeoutSync } from "./stakeout-store.js";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join as pathJoin } from "node:path";
import { load, getState, _saveNow } from "./stakeout-store.js";
import { syncOwner } from "./stakeout-store.js";

test("validateStakeoutSync: strips info + apiKey, keeps id/label/alerts", () => {
  const out = validateStakeoutSync({
    players: [{ id: "2194491", label: "rob", info: { name: "x" }, apiKey: "SECRET",
                alerts: { online: true, hospital: true, life: 25, bogus: 9 } }],
    factions: [{ id: 16335, info: {}, alerts: { rankedWarStarts: true, chainReaches: 0 } }],
  });
  assert.deepEqual(out.players, [
    { id: 2194491, label: "rob", alerts: { online: true, hospital: true, life: 25 } },
  ]);
  assert.deepEqual(out.factions, [
    { id: 16335, alerts: { rankedWarStarts: true, chainReaches: 0 } },
  ]);
});

test("validateStakeoutSync: drops bad ids, defaults arrays, caps length", () => {
  const players = Array.from({ length: 130 }, (_, i) => ({ id: i + 1, alerts: { online: true } }));
  const out = validateStakeoutSync({ players });
  assert.equal(out.players.length, 100);
  assert.deepEqual(out.factions, []);
  assert.deepEqual(validateStakeoutSync({ players: [{ id: "nope", alerts: {} }] }).players, []);
});

test("validateStakeoutSync: tri-state — false stays false, number stays, junk threshold -> false", () => {
  const out = validateStakeoutSync({
    players: [{ id: 5, alerts: { online: "yes", life: "bad", offline: 5, okay: false } }],
  });
  assert.deepEqual(out.players[0].alerts, { online: true, life: false, offline: 5, okay: false });
});

test("store: load on empty dir yields {owners:{}}; save round-trips", () => {
  process.env.DATA_DIR = mkdtempSync(pathJoin(tmpdir(), "stk-"));
  load();
  assert.deepEqual(getState(), { owners: {} });
  getState().owners["137558"] = { key: "enc", players: {}, factions: {} };
  _saveNow();
  load();
  assert.deepEqual(Object.keys(getState().owners), ["137558"]);
});

test("syncOwner: stores key + targets, preserves edge-state, GCs on empty", () => {
  process.env.DATA_DIR = mkdtempSync(pathJoin(tmpdir(), "stk-"));
  load();
  syncOwner("137558", "ENC1",
    [{ id: 5, label: "", alerts: { online: true } }],
    [{ id: 99, alerts: { rankedWarStarts: true } }]);
  assert.equal(getState().owners["137558"].key, "ENC1");
  assert.equal(getState().owners["137558"].players["5"].alerts.online, true);
  assert.equal(getState().owners["137558"].players["5"].seeded, false);

  // watcher observed target 5
  getState().owners["137558"].players["5"].info = { state: "Okay" };
  getState().owners["137558"].players["5"].seeded = true;
  getState().owners["137558"].players["5"].lastFiredAt = { online: 123 };

  // re-sync with refreshed key, keep player 5, drop faction 99
  syncOwner("137558", "ENC2", [{ id: 5, label: "", alerts: { online: true, hospital: true } }], []);
  const p5 = getState().owners["137558"].players["5"];
  assert.equal(getState().owners["137558"].key, "ENC2", "key refreshed");
  assert.equal(p5.seeded, true, "edge-state preserved");
  assert.equal(p5.info.state, "Okay");
  assert.equal(p5.lastFiredAt.online, 123);
  assert.equal(p5.alerts.hospital, true, "alerts updated");
  assert.deepEqual(getState().owners["137558"].factions, {});

  // empty list deletes owner + key
  syncOwner("137558", "ENC3", [], []);
  assert.deepEqual(getState().owners, {});
});

test("syncOwner: two owners are independent (same target id, separate rows)", () => {
  process.env.DATA_DIR = mkdtempSync(pathJoin(tmpdir(), "stk-"));
  load();
  syncOwner("111", "A", [{ id: 5, label: "", alerts: { online: true } }], []);
  syncOwner("222", "B", [{ id: 5, label: "", alerts: { hospital: true } }], []);
  assert.equal(getState().owners["111"].players["5"].alerts.online, true);
  assert.equal(getState().owners["222"].players["5"].alerts.hospital, true);
  assert.notEqual(getState().owners["111"].key, getState().owners["222"].key);
});
