// Verification for aggregateByCrime / _aggregateScenariosByCrime.
// Run: node server/oc-checkpoint-history.aggregateByCrime.test.js
import assert from "node:assert";
import { _aggregateScenariosByCrime } from "./oc-checkpoint-history.js";

const scenarios = {
  "1": { name: "Cash Me if You Can", checkpoints: [{ outcome: "P" }, { outcome: "P" }, { outcome: "F" }] }, // fail
  "2": { name: "Cash Me if You Can", checkpoints: [{ outcome: "P" }, { outcome: "P" }, { outcome: "P" }] }, // success
  "3": { name: "Cash Me if You Can", checkpoints: [{ outcome: "P" }] },                                     // success
  "4": { name: "Honey Trap", checkpoints: [] },                                                             // excluded
};

const out = _aggregateScenariosByCrime(scenarios);
assert.deepStrictEqual(out["Cash Me if You Can"], { success: 2, fail: 1, total: 3, rate: 2 / 3 });
assert.strictEqual(out["Honey Trap"], undefined, "empty-checkpoint scenarios are excluded");
console.log("OK");
