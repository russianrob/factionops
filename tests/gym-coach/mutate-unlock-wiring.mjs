// Mutation gate for the wiring, run against the browser suite.
//
// The unit tests call unlockScan/unlockEstimate directly, so they cannot tell
// whether anything calls them or whether the answer reaches a card. These
// mutants delete the connections one at a time; each must take the e2e suite
// down with it.
import fs from "fs";
import { execSync } from "child_process";

const FILE = "gym-coach-beta.user.js";
const original = fs.readFileSync(FILE, "utf8");
// The source is restored from this snapshot at the end, so do NOT edit
// gym-coach-beta.user.js while this is running — the restore silently
// reverts whatever you changed (it ate a version bump once).
const build = () => execSync("./build-harness.sh");

const mutants = [
  ["the page is never scanned for a percentage",
    "    var u = unlockScan(btns);", "    var u = null;"],
  ["the reading is never persisted",
    'storeSet("unlock", u);', ""],
  ["the card never reaches the tab",
    'tab === "trend" ? unlockHtml() + progHtml', 'tab === "trend" ? progHtml'],
  ["the gym exp perk is never read",
    "state.gymExpMult = gymExpMult(data);", "state.gymExpMult = 1;"],
  ["a stale reading is shown for a gym already owned",
    "if (owned.indexOf(u.gymId - 1) !== -1) return \"\";", ""],
  ["the all-unlocked case falls through to a number",
    "    if (haveAll) {", "    if (false) {"],
  ["the remaining figure reports the segment total instead",
    'fmt(est.remainMin) + "\u2013" + fmt(est.remainMax) + "e still to train"',
    'fmt(est.req) + "\u2013" + fmt(est.req) + "e still to train"'],
];

let killed = 0; const survived = [];
for (const [name, from, to] of mutants) {
  if (!original.includes(from)) { console.log("SKIP (no match) " + name); continue; }
  fs.writeFileSync(FILE, original.replace(from, to));
  build();
  let passed = true;
  try { execSync("node unlock.e2e.test.mjs", { stdio: "pipe" }); } catch { passed = false; }
  if (passed) { survived.push(name); console.log("SURVIVED  " + name); }
  else { killed++; console.log("killed    " + name); }
}
fs.writeFileSync(FILE, original);
build();

console.log("\n" + killed + " killed, " + survived.length + " survived");
if (survived.length) { console.log("\nvacuous coverage:"); survived.forEach(s => console.log("  - " + s)); }
process.exit(survived.length ? 1 : 0);
