// Mutation gate for the in-progress-gym guard (0.9.70) and the scan provenance.
//
// Reported live: a member standing in Cha Cha's was told to switch to Atlas,
// the very next rung, "and you have it unlocked". Each entry below breaks one
// piece of the guard that now stops that. If the suite still passes, the test
// meant to cover that line is vacuous — a green suite against broken code is
// worse than no suite, because it reads as proof.
import fs from "fs";
import { execSync } from "child_process";

const FILE = "gym-coach-beta.user.js";
const original = fs.readFileSync(FILE, "utf8");
// The source is restored from this snapshot at the end, so do NOT edit
// gym-coach-beta.user.js while this is running — the restore silently
// reverts whatever you changed (it ate a version bump once).
const build = () => execSync("./build-harness.sh");

// [name, from, to, suite]. The unit suite is fast and covers the rules; the
// browser suite is the only thing that can tell whether the guard is WIRED
// into the scan at all.
const mutants = [
  ["the in-progress class reads as ownership again",
    '/locked|inProgress/i.test(String((nodes[i] && nodes[i].className) || ""))',
    '/locked/i.test(String((nodes[i] && nodes[i].className) || ""))',
    "gymreco.test.mjs"],
  ["the percentage tile is never dropped",
    'return owned.filter(function (i) { return i !== hit; });',
    "return owned;",
    "gymreco.test.mjs"],
  ["the drop is inverted — everything BUT the locked tile is discarded",
    "return i !== hit;", "return i === hit;",
    "gymreco.test.mjs"],
  ["several percentages empty the set instead of being ignored",
    "      if (hit !== -1) return owned;\n", "",
    "gymreco.test.mjs"],
  ["a tile too primitive to query is queried anyway",
    'if (!n || typeof n.querySelector !== "function") continue;',
    "if (!n) continue;",
    "gymreco.test.mjs"],
  ["the percentage selector is loosened to any class at all",
    "n.querySelector('[class*=\"percentage\"]')", "n.querySelector('[class]')",
    "gymreco.test.mjs"],
  ["every gym unlocked is trusted rather than treated as a broken selector",
    "if (owned.length >= GYMS.length) {", "if (owned.length > GYMS.length) {",
    "gymreco.test.mjs"],
  ["a scan that never happened still speaks with confidence",
    '    if (!owned.length) return { known: false, why: "the gym list has not been read on this device yet" };\n',
    "",
    "gymreco.test.mjs"],
  ["the scan age is reported as unknown even when it is known",
    "at: state.gymsOwnedAt || 0", "at: 0",
    "gymreco.test.mjs"],

  ["the guard is never wired into the scan",
    "var owned = ownedSansProgress(gymsUnlocked(btns), btns);",
    "var owned = gymsUnlocked(btns);",
    "gymreco.e2e.test.mjs"],
  ["the guard is handed no tiles to look at",
    "ownedSansProgress(gymsUnlocked(btns), btns)",
    "ownedSansProgress(gymsUnlocked(btns), [])",
    "gymreco.e2e.test.mjs"],
  ["the scan is never stamped, so the advice cannot say how old it is",
    "    state.gymsOwnedAt = Date.now();\n", "",
    "gymreco.e2e.test.mjs"],
  ["the advice drops the provenance and asserts ownership flat",
    "STAT_LABEL[k] + \" at all\" + prov + \".\"",
    "STAT_LABEL[k] + \" at all.\"",
    "gymreco.e2e.test.mjs"],
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
