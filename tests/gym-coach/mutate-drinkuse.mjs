// Mutation gate for the drinks half of the pending-use machinery.
//
// Reported: "used x amount of cans but the number stayed the same until I
// refreshed". Each entry below breaks one rule that keeps the figure honest.
// If the suite still passes, the test meant to cover that line is vacuous —
// a green suite against broken code is worse than no suite, because it reads
// as proof.
import fs from "fs";
import { execSync } from "child_process";

const FILE = "gym-coach-beta.user.js";
const original = fs.readFileSync(FILE, "utf8");
// The source is restored from this snapshot at the end, so do NOT edit
// gym-coach-beta.user.js while this is running — the restore silently
// reverts whatever you changed (it ate a version bump once).
const build = () => execSync("./build-harness.sh");

const mutants = [
  // ---- the rule ----
  ["the cans list is never adjusted at all",
    "      drinks[di2].qty = Math.max(0, Number(rawD) - (byId[drinks[di2].id] || 0));\n", "",
    "drinkuse.test.mjs"],
  ["the row is subtracted from itself, so one use compounds",
    "Math.max(0, Number(rawD) - (byId[drinks[di2].id] || 0));",
    "Math.max(0, Number(drinks[di2].qty) - (byId[drinks[di2].id] || 0));",
    "drinkuse.test.mjs"],
  ["the count is allowed to go negative",
    "drinks[di2].qty = Math.max(0, Number(rawD) - (byId[drinks[di2].id] || 0));",
    "drinks[di2].qty = Number(rawD) - (byId[drinks[di2].id] || 0);",
    "drinkuse.test.mjs"],
  ["a can with no baseline is guessed at instead of left alone",
    "      if (rawD === undefined) continue;\n", "",
    "drinkuse.test.mjs"],
  ["every pending use is applied to every drink",
    "(byId[drinks[di2].id] || 0)", "(Object.keys(byId).length ? byId[Object.keys(byId)[0]] : 0)",
    "drinkuse.test.mjs"],

  // ---- the wiring ----
  ["the pre-use baseline is never recorded",
    "      state.rawDrinks[state.drinkList[di].id] = state.drinkList[di].qty;\n", "",
    "drinkuse.e2e.test.mjs"],
  ["a drink that has run out keeps its USE button",
    '(state.drinkList || []).filter(function (d) { return (d.qty || 0) > 0; })',
    "(state.drinkList || [])",
    "drinkuse.e2e.test.mjs"],
  ["the use is recorded but never re-applied after the refresh",
    "        decrementItemLocal(id);", "",
    "drinkuse.e2e.test.mjs"],
];

let killed = 0;
const survived = [];
for (const [name, from, to, suite] of mutants) {
  if (!original.includes(from)) { console.log("SKIP (no match) " + name); continue; }
  fs.writeFileSync(FILE, original.replace(from, to));
  if (suite.endsWith(".e2e.test.mjs")) build();
  let passed = true;
  try { execSync("node " + suite, { stdio: "pipe", timeout: 900000 }); } catch { passed = false; }
  if (passed) { survived.push(name); console.log("SURVIVED  " + name); }
  else { killed++; console.log("killed    " + name); }
}
fs.writeFileSync(FILE, original);
build();

console.log("\n" + killed + " killed, " + survived.length + " survived");
if (survived.length) { console.log("\nvacuous coverage:"); survived.forEach(s => console.log("  - " + s)); }
process.exit(survived.length ? 1 : 0);
