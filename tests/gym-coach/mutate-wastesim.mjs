// Mutation gate for the waste simulator.
import fs from "fs";
import { execSync } from "child_process";
const FILE = fs.realpathSync("gym-coach-beta.user.js");
const original = fs.readFileSync(FILE, "utf8");
const U = "wastesim.test.mjs";
const mutants = [
  ["time above the cap is billed as waste (a stack reads as a bleed)",
    "      if (e > max) return;\n", "", [U]],
  ["the fill time is ignored, so a climbing bar bills the whole window",
    "      var need = (max - e) * secPerE;   // seconds left to fill\n      if (dt <= need) { e += dt / secPerE; return; }",
    "      var need = 0;\n      if (dt <= need) { e += dt / secPerE; return; }", [U]],
  ["spends are not applied, so it degrades back to guessing",
    "      e += Number(evs[i].delta) || 0;", "      e += 0;", [U]],
  ["the bar is allowed to go negative, hiding later waste",
    "      if (e < 0) e = 0;   // the bar cannot go below empty\n", "", [U]],
  ["events are applied in arrival order rather than time order",
    "      .sort(function (a, b) { return a.t - b.t; });", "", [U]],
  ["events from outside the window are applied",
    "      .filter(function (v) { return v && typeof v.t === \"number\" && v.t > startT && v.t <= endT; })", "", [U]],
  ["an event exactly on the start is applied twice",
    "v.t > startT && v.t <= endT", "v.t >= startT && v.t <= endT", [U]],
  ["the trailing segment after the last event is dropped",
    "    advance(endT);\n", "", [U]],
  ["at-cap seconds are reported as energy without dividing by the rate",
    "    return { wasted: atCap / secPerE, atCapSec: atCap };", "    return { wasted: atCap, atCapSec: atCap };", [U]],
  ["a zero rate is accepted and divides by zero",
    "    if (!(secPerE > 0) || !(max > 0) || !(endT > startT)) return null;",
    "    if (!(max > 0) || !(endT > startT)) return null;", [U]],
];
let killed = 0; const survived = [];
for (const [name, from, to, suites] of mutants) {
  if (!original.includes(from)) { console.log("SKIP (no match) " + name); survived.push(name + " [NO MATCH]"); continue; }
  fs.writeFileSync(FILE, original.replace(from, to));
  let anyRed = false;
  for (const s of suites) { try { execSync("node " + s, { stdio: "pipe" }); } catch { anyRed = true; } }
  if (anyRed) { killed++; console.log("killed    " + name); }
  else { survived.push(name); console.log("SURVIVED  " + name); }
}
fs.writeFileSync(FILE, original);
console.log("\n" + killed + " killed, " + survived.length + " survived");
if (survived.length) { console.log("\nvacuous coverage:"); survived.forEach(s => console.log("  - " + s)); }
process.exit(survived.length ? 1 : 0);
