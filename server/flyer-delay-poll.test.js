// Unit tests for the server-side flyer-delay completion poller.
//
// The poller closes a real gap: a member who flies while their OC is ready
// racks up a "flyer delay", but that delay only ever gets baked into OC
// history when a CLIENT happens to fetch OC data around the moment the crime
// completes. If nobody has the oc-spawn panel open at that moment, the delay
// is lost. This poller fetches OC data server-side for any faction that has
// pending flyer-delay observations, so completions bake regardless of who is
// watching.
//
// Everything the poller touches is dependency-injected so these tests run
// with fakes — no live Torn API, no disk, no timers.
import { test } from "node:test";
import assert from "node:assert/strict";
import { flyerDelayFactionsNeedingPoll, createFlyerDelayPoller } from "./flyer-delay-poll.js";

function fdMap(entries) {
  // entries: { fid: [ [key, val], ... ] }
  const m = new Map();
  for (const [fid, pairs] of Object.entries(entries)) {
    m.set(String(fid), new Map(pairs));
  }
  return m;
}

test("flyerDelayFactionsNeedingPoll returns only factions with pending entries", () => {
  const flyerDelays = fdMap({
    "42055": [["1920875::1727674", { delayedSec: 15045 }]],
    "999":   [],                       // empty sub-map — nothing pending
  });
  assert.deepEqual(flyerDelayFactionsNeedingPoll(flyerDelays), ["42055"]);
});

test("tick polls a faction with a pending delay and bakes completions", async () => {
  const flyerDelays = fdMap({ "42055": [["1920875::1727674", { delayedSec: 15045 }]] });
  const calls = { ocFetch: [], collect: [], prune: [] };
  const poller = createFlyerDelayPoller({
    flyerDelays,
    getKey: () => "KEY_42055",
    getOcSpawnData: async (fid, key) => {
      calls.ocFetch.push([fid, key]);
      return { members: { "1727674": { name: "Woziwu" } } };
    },
    getCachedCompletedCrimes: () => [{ id: "1920875", status: "Failure", name: "No Reserve", slots: [] }],
    collectOcHistory: (fid, data) => calls.collect.push([fid, data.crimes.length]),
    pruneFlyerDelays: (fid) => calls.prune.push(fid),
  });

  await poller.tick();

  assert.deepEqual(calls.ocFetch, [["42055", "KEY_42055"]]);
  assert.deepEqual(calls.collect, [["42055", 1]]);          // one completed crime baked
  assert.deepEqual(calls.prune, ["42055"]);                 // orphan-prune ran for the faction
});

test("tick skips a faction with no available key (never calls the API)", async () => {
  const flyerDelays = fdMap({ "888": [["c1::m1", { delayedSec: 100 }]] });
  let fetched = false;
  const poller = createFlyerDelayPoller({
    flyerDelays,
    getKey: () => null,                                     // no pool/faction key
    getOcSpawnData: async () => { fetched = true; return {}; },
    getCachedCompletedCrimes: () => [],
    collectOcHistory: () => { throw new Error("should not bake without a fetch"); },
    pruneFlyerDelays: () => {},
  });

  await poller.tick();                                      // must not throw
  assert.equal(fetched, false);
});

test("tick does not bake when there are no completed crimes", async () => {
  const flyerDelays = fdMap({ "42055": [["c1::m1", { delayedSec: 100 }]] });
  let baked = false;
  const poller = createFlyerDelayPoller({
    flyerDelays,
    getKey: () => "K",
    getOcSpawnData: async () => ({ members: {} }),
    getCachedCompletedCrimes: () => [],                     // nothing completed yet
    collectOcHistory: () => { baked = true; },
    pruneFlyerDelays: () => {},
  });

  await poller.tick();
  assert.equal(baked, false);
});

test("tick isolates a failing faction so others still process", async () => {
  const flyerDelays = fdMap({
    "1": [["c1::m1", { delayedSec: 100 }]],
    "2": [["c2::m2", { delayedSec: 200 }]],
  });
  const baked = [];
  const poller = createFlyerDelayPoller({
    flyerDelays,
    getKey: () => "K",
    getOcSpawnData: async (fid) => { if (fid === "1") throw new Error("api down"); return { members: {} }; },
    getCachedCompletedCrimes: () => [{ id: "x", status: "Failure", slots: [] }],
    collectOcHistory: (fid) => baked.push(fid),
    pruneFlyerDelays: () => {},
  });

  await poller.tick();
  assert.deepEqual(baked, ["2"]);                           // faction 1 threw, faction 2 still baked
});
