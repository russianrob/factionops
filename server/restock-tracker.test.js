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

test("recordSample records a restock only when qty increases", () => {
  let it = { qty: null, restocks: [] };
  it = recordSample(it, 5, 100);
  assert.deepStrictEqual(it, { qty: 5, restocks: [] });
  it = recordSample(it, 3, 160);
  assert.deepStrictEqual(it.restocks, []);
  it = recordSample(it, 9, 220);
  assert.deepStrictEqual(it.restocks, [220]);
  it = recordSample(it, 9, 280);
  assert.deepStrictEqual(it.restocks, [220]);
});

test("recordSample caps the restock history at 24", () => {
  let it = { qty: 0, restocks: [] };
  for (let i = 1; i <= 30; i++) it = recordSample({ qty: 0, restocks: it.restocks }, i, 100 + i);
  assert.strictEqual(it.restocks.length, 24);
});

test("computeEntry needs >=2 restocks and yields median interval", () => {
  assert.strictEqual(computeEntry([100]), null);
  const e = computeEntry([100, 200, 280]);
  assert.strictEqual(e.interval, 90);
  assert.strictEqual(e.last, 280);
  assert.strictEqual(e.n, 3);
  assert.strictEqual(e.rel, "low");
});

test("buildModel keeps only items with >=2 restocks", () => {
  const state = {
    mex: { "1": { qty: 0, restocks: [100, 200] }, "2": { qty: 0, restocks: [100] } }
  };
  const model = buildModel(state, 999);
  assert.strictEqual(model.updated, 999);
  assert.ok(model.items.mex["1"]);
  assert.strictEqual(model.items.mex["2"], undefined);
});
