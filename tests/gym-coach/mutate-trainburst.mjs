import fs from "fs";
import { execSync } from "child_process";
const FILE = fs.realpathSync("gym-coach-beta.user.js");
const original = fs.readFileSync(FILE, "utf8");
const build = () => execSync("./build-harness.sh");
const U = "trainburst.test.mjs", M = "trainmerge.test.mjs";
const mutants = [
  ["a failed round stamps nothing, so the rate limit feeds itself again",
    "    state.trainLogTriedAt = Date.now();\n", "", [U]],
  ["only successes count toward the TTL, which is the same bug",
    "    var last = Math.max((tl && tl.at) || 0, state.trainLogTriedAt || 0);",
    "    var last = (tl && tl.at) || 0;", [U]],
  ["training forces a refetch again -- eight log calls per click",
    '        fetchTrainLog(kind === "boot" || kind === "manual");',
    '        fetchTrainLog(kind === "train" || kind === "boot");', [U]],
  ["nothing forces a refetch, so boot never loads the log",
    '        fetchTrainLog(kind === "boot" || kind === "manual");',
    "        fetchTrainLog(false);", [U]],
  ["the in-flight guard is dropped, so rounds overlap",
    "    if (state.trainLogInFlight) return Promise.resolve(tl);\n", "", [U]],
  ["the TTL is ignored entirely",
    "    if (!force && Date.now() - last < TRAINLOG_TTL) return Promise.resolve(tl);\n", "", [U, M]],
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
