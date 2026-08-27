// Mutation gate for the goal -> notification focus sync.
import fs from "fs";
import { execSync } from "child_process";

const FILE = fs.realpathSync("gym-coach-beta.user.js");
const original = fs.readFileSync(FILE, "utf8");
// Restored from this snapshot at the end -- do NOT edit the script while this runs.
const build = () => execSync("./build-harness.sh");

const mutants = [
  ["the sync is dropped from the notification path",
    "    applyGoalFocus();\n    if (state.warStack) {", "    if (state.warStack) {"],
  ["the derived focus is no longer persisted",
    "      storeSet(\"focus\", k);", ""],
  ["the ping names a fixed stat again",
    'pingAt(PING_ENERGY, "Energy full \u2014 train " + focusLabel(), now + toFull * 1000);',
    'pingAt(PING_ENERGY, "Energy full \u2014 train Strength", now + toFull * 1000);'],
  // Anchored on the body, because "if (!hasGoals()) return;" appears twice and
  // a bare replace mutated the wrong function -- which is why it survived.
  ["goals stop driving the focus at all",
    "    var k = plan.now ? plan.now.k : plan.next ? plan.next.k : \"\";",
    "    var k = \"\";"],
];

let killed = 0; const survived = [];
for (const [name, from, to] of mutants) {
  if (!original.includes(from)) { console.log("SKIP (no match) " + name); continue; }
  fs.writeFileSync(FILE, original.replace(from, to));
  build();
  let passed = true;
  try { execSync("node notify.test.mjs", { stdio: "pipe" }); } catch { passed = false; }
  if (passed) { survived.push(name); console.log("SURVIVED  " + name); }
  else { killed++; console.log("killed    " + name); }
}
fs.writeFileSync(FILE, original);
build();
console.log("\n" + killed + " killed, " + survived.length + " survived");
if (survived.length) { console.log("\nvacuous coverage:"); survived.forEach(s => console.log("  - " + s)); }
process.exit(survived.length ? 1 : 0);
