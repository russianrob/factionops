import { readFileSync, existsSync } from "node:fs";
import vm from "node:vm";
import assert from "node:assert/strict";

const SCRIPT = "/opt/warboard/server/public/scripts/torn-can-energy.user.js";
const ITEMS = "/root/projects/warboard-ios/WarboardIOS/Resources/retorn/files/items.json";

function load() {
  const src = readFileSync(SCRIPT, "utf8");
  const sandbox = { module: { exports: {} }, console };
  vm.runInNewContext(src, sandbox, { filename: "drink-stats.user.js" });
  return sandbox.module.exports;
}

const ds = load();
let pass = 0, fail = 0;
function check(name, fn) {
  try { fn(); pass++; console.log("PASS " + name); }
  catch (e) { fail++; console.log("FAIL " + name + " — " + e.message); }
}

check("energy 15->25", () => assert.equal(ds.effectiveEnergy(15, 1.65, false), 25));
check("energy 20->33", () => assert.equal(ds.effectiveEnergy(20, 1.65, false), 33));
check("energy 25->41", () => assert.equal(ds.effectiveEnergy(25, 1.65, false), 41));
check("energy 30->50", () => assert.equal(ds.effectiveEnergy(30, 1.65, false), 50));
check("energy event 25->82", () => assert.equal(ds.effectiveEnergy(25, 1.65, true), 82));
check("perkMult energy 1.65", () => assert.ok(Math.abs(ds.perkMultiplier({ faction_perks: ["+ 50% energy from energy drinks"], job_perks: ["+ 10% consumable gain"], book_perks: [] }) - 1.65) < 1e-9));
check("CAN_BASE 987=15", () => assert.equal(ds.CAN_BASE[987], 15));

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
