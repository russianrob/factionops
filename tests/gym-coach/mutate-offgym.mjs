// Mutation gate: energy that left the bar away from the gym.
import fs from "fs";
import { execSync } from "child_process";
const FILE = "gym-coach-beta.user.js";
const original = fs.readFileSync(FILE, "utf8");
// Restored from this snapshot at the end -- do NOT edit the script while this runs.
const build = () => execSync("./build-harness.sh");
const mutants = [
  ["off-gym drops go back to counting as spent",
    "          if (onGymPage()) b.used += d.used;\n          else b.off = (b.off || 0) + d.used;",
    "          b.used += d.used;", ["offgym.test.mjs"]],
  ["skew is booked as attacking again",
    "            var hits = Math.floor(d.used / ATTACK_ENERGY);\n            if (hits > 0) b.off = (b.off || 0) + hits * ATTACK_ENERGY;",
    "            b.off = (b.off || 0) + d.used;", ["offgym.test.mjs"]],
  ["a partial attack is rounded UP instead of discarded",
    "            var hits = Math.floor(d.used / ATTACK_ENERGY);",
    "            var hits = Math.ceil(d.used / ATTACK_ENERGY);", ["offgym.test.mjs"]],
  ["the attack cost is wrong",
    "  var ATTACK_ENERGY = 25;", "  var ATTACK_ENERGY = 5;", ["offgym.test.mjs"]],
  ["off-gym drops are dropped on the floor instead",
    "            if (hits > 0) b.off = (b.off || 0) + hits * ATTACK_ENERGY;", "", ["offgym.test.mjs"]],
  ["gym training is misfiled as off-gym",
    "          if (onGymPage()) b.used += d.used;", "          if (false) b.used += d.used;",
    ["offgym.test.mjs"]],
  ["attacking stops counting against the usage figure",
    "out.usage = calClamp(out.used / (out.used + out.wasted + out.off), CAL_USAGE_LO, CAL_USAGE_HI);",
    "out.usage = calClamp(out.used / (out.used + out.wasted), CAL_USAGE_LO, CAL_USAGE_HI);",
    ["offgym.test.mjs"]],
  ["calibration never totals the off-gym column",
    "      out.off += byDay[d].off || 0;", "", ["offgym.test.mjs"]],
  ["an attack is logged as a training session again",
    "if (d.used >= 5 && !pendingTrain && onGymPage()) {", "if (d.used >= 5 && !pendingTrain) {",
    ["trainlog.test.mjs", "offgym.test.mjs", "persist.test.mjs"]],
];
let killed = 0; const survived = [];
for (const [name, from, to, suites] of mutants) {
  if (!original.includes(from)) { console.log("SKIP (no match) " + name); continue; }
  fs.writeFileSync(FILE, original.replace(from, to));
  build();
  let red = false;
  for (const s of suites) { try { execSync("node " + s, { stdio: "pipe" }); } catch { red = true; } }
  if (red) { killed++; console.log("killed    " + name); }
  else { survived.push(name); console.log("SURVIVED  " + name); }
}
fs.writeFileSync(FILE, original); build();
console.log("\n" + killed + " killed, " + survived.length + " survived");
if (survived.length) { console.log("\nvacuous coverage:"); survived.forEach(s => console.log("  - " + s)); }
process.exit(survived.length ? 1 : 0);
