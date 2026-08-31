import fs from "fs";
import { execSync } from "child_process";
const FILE = fs.realpathSync("gym-coach-beta.user.js");
const original = fs.readFileSync(FILE, "utf8");
const build = () => execSync("./build-harness.sh");
const U = "trainmerge.test.mjs", A = "trainapi.e2e.test.mjs";
const mutants = [
  ["the live figure is cleared outright again, losing a lagging session",
    "                         since: carriedSince(state.trainLog, fresh, dayKey(Date.now())),",
    "                         since: 0,", [U]],
  ["nothing is ever carried, so the fix is inert",
    "    return Math.max(0, known - fresh);", "    return 0;", [U]],
  ["the log's own total is ignored, so a caught-up session double counts",
    "    var fresh = (freshByDay && freshByDay[dayK]) || 0;", "    var fresh = 0;", [U]],
  ["already-banked training is counted as still pending",
    "    var known = ((prev.byDay && prev.byDay[dayK]) || 0) + (prev.since || 0);",
    "    var known = (prev.since || 0);", [U]],
  ["a negative carry is allowed, so a log ahead of us subtracts",
    "    return Math.max(0, known - fresh);", "    return known - fresh;", [U]],
  ["the first round carries a phantom figure",
    "    if (!prev) return 0;\n", "", [U]],
  ["the train log TTL goes back to a minute of extra requests",
    "  var TRAINLOG_TTL = 120000;", "  var TRAINLOG_TTL = 60000;", ["pollrate.test.mjs"]],
];
let killed = 0; const survived = [];
for (const [name, from, to, suites] of mutants) {
  if (!original.includes(from)) { console.log("SKIP (no match) " + name); survived.push(name + " [NO MATCH]"); continue; }
  fs.writeFileSync(FILE, original.replace(from, to));
  build();
  let anyRed = false;
  for (const s of suites) { try { execSync("node " + s, { stdio: "pipe" }); } catch { anyRed = true; } }
  if (anyRed) { killed++; console.log("killed    " + name); }
  else { survived.push(name); console.log("SURVIVED  " + name); }
}
fs.writeFileSync(FILE, original); build();
console.log("\n" + killed + " killed, " + survived.length + " survived");
if (survived.length) { console.log("\nvacuous coverage:"); survived.forEach(s => console.log("  - " + s)); }
process.exit(survived.length ? 1 : 0);
