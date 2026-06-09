import test from "node:test";
import assert from "node:assert";
import { median, coeffVar, reliabilityTier } from "./restock-tracker.js";

test("median", () => {
  assert.strictEqual(median([5]), 5);
  assert.strictEqual(median([3, 1, 2]), 2);
  assert.strictEqual(median([4, 1, 3, 2]), 2.5);
  assert.strictEqual(median([]), 0);
});

test("coeffVar", () => {
  assert.strictEqual(coeffVar([10]), 0);
  assert.strictEqual(coeffVar([10, 10, 10]), 0);
  assert.ok(coeffVar([10, 20, 30]) > 0);
});

test("reliabilityTier", () => {
  assert.strictEqual(reliabilityTier(8, 0.2), "high");
  assert.strictEqual(reliabilityTier(8, 0.5), "med");
  assert.strictEqual(reliabilityTier(4, 0.5), "med");
  assert.strictEqual(reliabilityTier(2, 0.0), "low");
  assert.strictEqual(reliabilityTier(10, 0.9), "low");
});

import { gaps, recordSample, computeEntry, buildModel } from "./restock-tracker.js";

test("recordSample records a restock only when qty increases (within freshness)", () => {
  let it = { qty: null, restocks: [], lastSeen: null };
  it = recordSample(it, 5, 100);
  assert.deepStrictEqual(it, { qty: 5, restocks: [], lastSeen: 100 });
  it = recordSample(it, 3, 160);
  assert.deepStrictEqual(it.restocks, []);
  it = recordSample(it, 9, 220);
  assert.deepStrictEqual(it.restocks, [220]);
  it = recordSample(it, 9, 280);
  assert.deepStrictEqual(it.restocks, [220]);
});

test("recordSample ignores undefined/NaN quantity without poisoning state", () => {
  let it = { qty: 5, restocks: [], lastSeen: 100 };
  it = recordSample(it, undefined, 160);
  assert.strictEqual(it.qty, 5);          // unchanged, not undefined
  assert.deepStrictEqual(it.restocks, []);
  it = recordSample(it, 9, 220);          // a real restock is still caught next poll
  assert.deepStrictEqual(it.restocks, [220]);
});

test("recordSample skips a restock when the item was absent too long", () => {
  let it = { qty: 3, restocks: [], lastSeen: 100 };
  it = recordSample(it, 9, 400);          // 300s gap > ABSENT_MAX(180) -> unreliable
  assert.deepStrictEqual(it.restocks, []);
});

test("recordSample caps the restock history at 24", () => {
  let it = { qty: 0, restocks: [] };
  for (let i = 1; i <= 30; i++) it = recordSample({ qty: 0, restocks: it.restocks }, i, 100 + i);
  assert.strictEqual(it.restocks.length, 24);
});

test("computeEntry: needs >=1 valid gap; filters sub-180s gaps; n = gap count", () => {
  assert.strictEqual(computeEntry([1000]), null);
  assert.strictEqual(computeEntry([1000, 1050]), null);            // only a 50s gap -> filtered -> null
  const e = computeEntry([1000, 2500, 4000]);                      // gaps 1500,1500
  assert.strictEqual(e.interval, 1500);
  assert.strictEqual(e.last, 4000);
  assert.strictEqual(e.n, 2);
  assert.strictEqual(e.rel, "low");
});

test("buildModel keeps only items with a valid interval and a recent last", () => {
  const now = 10000;
  const state = {
    mex: {
      "1": { qty: 0, restocks: [now - 3000, now - 1500] },         // gap 1500 ok, last recent
      "2": { qty: 0, restocks: [now - 1500] },                     // 1 restock -> null
      "3": { qty: 0, restocks: [100, 1600] }                       // last way older than 6h? last=1600, now-1600 > 21600? no
    }
  };
  const model = buildModel(state, now);
  assert.strictEqual(model.updated, now);
  assert.ok(model.items.mex["1"]);
  assert.strictEqual(model.items.mex["2"], undefined);
});
