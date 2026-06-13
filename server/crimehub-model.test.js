// Golden test for the ported Crimehub flowchart engine.
// Run: node server/crimehub-model.test.js
import assert from "node:assert";
import { calculateLocalOutcome } from "./crimehub-model.js";

const r = calculateLocalOutcome("Honey Trap", { Muscle2: 50, Muscle1: 50, Enforcer: 50 });
assert.ok(Math.abs(r.successChance - 0.4067) < 0.002, `honeytrap@50 success ${r.successChance}`);
assert.ok(Math.abs(r.avgReward - 7370000) / 7370000 < 0.02, `honeytrap@50 avgReward ${r.avgReward}`);

const missing = calculateLocalOutcome("Crane Reaction", { A: 50 });
assert.strictEqual(missing.missing, true, "unpublished crime returns missing:true");

console.log("OK", { success: r.successChance.toFixed(4), avgReward: Math.round(r.avgReward) });
