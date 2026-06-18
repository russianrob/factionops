import test from "node:test";
import assert from "node:assert/strict";
import { validateStakeoutSync } from "./stakeout-store.js";

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
