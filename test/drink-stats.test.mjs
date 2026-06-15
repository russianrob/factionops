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
function plain(o) { return JSON.parse(JSON.stringify(o)); }

check("energy 15->25", () => assert.equal(ds.effectiveEnergy(15, 1.65, false), 25));
check("energy 20->33", () => assert.equal(ds.effectiveEnergy(20, 1.65, false), 33));
check("energy 25->41", () => assert.equal(ds.effectiveEnergy(25, 1.65, false), 41));
check("energy 30->50", () => assert.equal(ds.effectiveEnergy(30, 1.65, false), 50));
check("energy event 25->82", () => assert.equal(ds.effectiveEnergy(25, 1.65, true), 82));
check("perkMult energy 1.65", () => assert.ok(Math.abs(ds.perkMultiplier({ faction_perks: ["+ 50% energy from energy drinks"], job_perks: ["+ 10% consumable gain"], book_perks: [] }) - 1.65) < 1e-9));
check("CAN_BASE 987=15", () => assert.equal(ds.CAN_BASE[987], 15));

const EXPECT_NERVE = { 180: 1, 181: 1, 294: 1, 426: 1, 531: 2, 541: 4, 542: 3, 550: 2, 551: 3, 552: 4, 638: 3, 816: 2, 873: 5, 924: 5, 984: 5 };
check("NERVE_BASE matches expected", () => assert.deepEqual(plain(ds.NERVE_BASE), EXPECT_NERVE));
check("NERVE_BASE matches items.json", () => {
  if (!existsSync(ITEMS)) { console.log("  (skipped — items.json absent)"); return; }
  const items = JSON.parse(readFileSync(ITEMS, "utf8")).items;
  const derived = {};
  for (const [id, it] of Object.entries(items)) {
    if (it && it.type === "Alcohol" && typeof it.effect === "string") {
      const m = it.effect.match(/nerve by (\d+)/i);
      if (m) derived[id] = Number(m[1]);
    }
  }
  const normalized = {};
  for (const k of Object.keys(ds.NERVE_BASE)) normalized[k] = ds.NERVE_BASE[k];
  assert.deepEqual(normalized, derived);
});

check("alcoholPerks faction only", () => assert.deepEqual(plain(ds.alcoholPerks({ faction_perks: ["+ 10% nerve from alcohol"], job_perks: [], book_perks: [] })), { faction: 10, company: 0 }));
check("alcoholPerks company alcohol boost", () => assert.deepEqual(plain(ds.alcoholPerks({ faction_perks: [], job_perks: ["+ 10% alcohol boost"], book_perks: [] })), { faction: 0, company: 10 }));
check("alcoholPerks company consumable boost", () => assert.deepEqual(plain(ds.alcoholPerks({ faction_perks: [], job_perks: ["+ 5% consumable boost"], book_perks: [] })), { faction: 0, company: 5 }));
check("alcoholPerks both, ignore book+unrelated", () => assert.deepEqual(plain(ds.alcoholPerks({ faction_perks: ["+ 15% nerve from alcohol", "+ 50% energy from energy drinks"], job_perks: ["+ 10% alcohol boost"], book_perks: ["+ 100% alcohol effects"] })), { faction: 15, company: 10 }));
check("alcoholPerks none", () => assert.deepEqual(plain(ds.alcoholPerks({ faction_perks: [], job_perks: [], book_perks: [] })), { faction: 0, company: 0 }));

check("nerve 5,0,0 -> 5 N", () => assert.equal(ds.nerveRange(5, 0, 0, 1), "5 N"));
check("nerve 5,10,10 -> 6 - 7 N", () => assert.equal(ds.nerveRange(5, 10, 10, 1), "6 - 7 N"));
check("nerve 1,25,0 -> 1 - 2 N", () => assert.equal(ds.nerveRange(1, 25, 0, 1), "1 - 2 N"));
check("nerve 4,0,50 -> 6 N", () => assert.equal(ds.nerveRange(4, 0, 50, 1), "6 N"));
check("nerve default eventMult", () => assert.equal(ds.nerveRange(5, 0, 0), "5 N"));

check("computePerks energy+alc", () => {
  const c = ds.computePerks({ faction_perks: ["+ 50% energy from energy drinks", "+ 10% nerve from alcohol"], job_perks: ["+ 10% consumable gain", "+ 5% alcohol boost"], book_perks: [] });
  assert.ok(Math.abs(c.energyMult - 1.65) < 1e-9);
  assert.equal(c.alcFaction, 10);
  assert.equal(c.alcCompany, 5);
});

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
