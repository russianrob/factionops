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
