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

check("energy provider value (perks)", () => assert.equal(ds.PROVIDERS.find(p => p.key === "energy").value(15, { energyMult: 1.65 }), "25E"));
check("energy provider value (base only)", () => assert.equal(ds.PROVIDERS.find(p => p.key === "energy").value(15, null), "15E"));
check("nerve provider value (perks)", () => assert.equal(ds.PROVIDERS.find(p => p.key === "nerve").value(5, { alcFaction: 10, alcCompany: 10 }), "6 - 7 N"));
check("nerve provider value (base only)", () => assert.equal(ds.PROVIDERS.find(p => p.key === "nerve").value(5, null), "5 N"));
check("providers cover both maps", () => { assert.equal(ds.PROVIDERS.length, 2); assert.equal(ds.PROVIDERS[0].base[987], 15); assert.equal(ds.PROVIDERS[1].base[180], 1); });

const DAY = 86400000;
const CAL = [
  { title: "St Patrick's Day", start: 1773705600, end: 1773791999 },
  { title: "International Beer Day", start: 1786060800, end: 1786147199 },
  { title: "CaffeineCon 2026", start: 1792022400, end: 1792108799 },
];
check("events: St Patrick's active mid-window", () => assert.equal(ds.computeEvents(CAL, 1773705600 * 1000 + 1000).stPatricks, true));
check("events: St Patrick's inactive 3d before", () => assert.equal(ds.computeEvents(CAL, 1773705600 * 1000 - 3 * DAY).stPatricks, false));
check("events: CaffeineCon startsWith match", () => assert.equal(ds.computeEvents(CAL, 1792022400 * 1000 + 1000).caffeineCon, true));
check("events: International Beer Day active", () => assert.equal(ds.computeEvents(CAL, 1786060800 * 1000 + 1000).beerDay, true));
check("events: none active in June", () => { const e = ds.computeEvents(CAL, 1781000000000); assert.equal(e.caffeineCon || e.stPatricks || e.beerDay, false); });
check("eventActive: +-1 day padding (12h before start)", () => assert.equal(ds.eventActive(CAL, (e) => /st\.?\s*patrick/i.test(e.title), 1773705600 * 1000 - 12 * 3600 * 1000), true));
check("eventActive: outside padding (2d before)", () => assert.equal(ds.eventActive(CAL, (e) => /st\.?\s*patrick/i.test(e.title), 1773705600 * 1000 - 2 * DAY), false));
check("events: loose apostrophe match", () => assert.equal(ds.computeEvents([{ title: "St. Patrick’s Day", start: 1773705600, end: 1773791999 }], 1773705600 * 1000 + 1000).stPatricks, true));

const EP = (k) => ds.PROVIDERS.find((p) => p.key === k);
check("energy caffeineCon doubles", () => assert.equal(EP("energy").value(15, { energyMult: 1.65 }, { id: 987, events: { caffeineCon: true } }), "50E"));
check("energy no event unchanged", () => assert.equal(EP("energy").value(15, { energyMult: 1.65 }, { id: 987, events: {} }), "25E"));
check("energy value no ctx (back-compat)", () => assert.equal(EP("energy").value(15, { energyMult: 1.65 }), "25E"));
check("nerve stPatricks doubles", () => assert.equal(EP("nerve").value(5, { alcFaction: 0, alcCompany: 0 }, { id: 984, events: { stPatricks: true } }), "10 N"));
check("nerve beerDay x5 beer only (180)", () => assert.equal(EP("nerve").value(1, { alcFaction: 0, alcCompany: 0 }, { id: 180, events: { beerDay: true } }), "5 N"));
check("nerve beerDay no-op on non-beer (531)", () => assert.equal(EP("nerve").value(2, { alcFaction: 0, alcCompany: 0 }, { id: 531, events: { beerDay: true } }), "2 N"));
check("nerve stPatricks+beerDay stack on beer", () => assert.equal(EP("nerve").value(1, { alcFaction: 0, alcCompany: 0 }, { id: 180, events: { stPatricks: true, beerDay: true } }), "10 N"));
check("nerve value no ctx (back-compat)", () => assert.equal(EP("nerve").value(5, { alcFaction: 0, alcCompany: 0 }), "5 N"));

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
