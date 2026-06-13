// Verifies /api/oc/outcome's local-model merge. Run: node server/oc-spawn.localOutcome.test.js
import assert from "node:assert";
import { _withLocalOutcome } from "./oc-spawn.js";

const merged = _withLocalOutcome({ successChance: 0.42, goodEnding1: 0.1 }, "Honey Trap", [50, 50, 50]);
assert.ok(typeof merged.localSuccessChance === "number", "localSuccessChance present");
assert.ok(Math.abs(merged.localSuccessChance - 0.4067) < 0.002, `local ${merged.localSuccessChance}`);
assert.ok(Math.abs(merged.delta - (merged.localSuccessChance - 0.42)) < 1e-9, "delta = local - tornprob");
assert.strictEqual(merged.successChance, 0.42, "upstream fields preserved");

const missing = _withLocalOutcome({ successChance: 0.3 }, "Crane Reaction", [50, 50]);
assert.strictEqual(missing.localSuccessChance, null, "unpublished crime -> null local");
assert.strictEqual(missing.delta, null, "no delta when local missing");

console.log("OK", { local: merged.localSuccessChance.toFixed(4), delta: merged.delta.toFixed(4) });
