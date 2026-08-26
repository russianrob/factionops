// Mutation gate for the war-stack waste fix.
import fs from "fs";
import { execSync } from "child_process";

const FILE = fs.realpathSync("gym-coach-beta.user.js");
const original = fs.readFileSync(FILE, "utf8");
// The source is restored from this snapshot at the end, so do NOT edit
// gym-coach-beta.user.js while this is running — the restore silently
// reverts whatever you changed (it ate a version bump once).
const build = () => execSync("./build-harness.sh");

const mutants = [
  // [name, from, to, suites that must go red]
  ["cap time is billed as waste even on stack",
    "out.wasted = stacking ? 0 : capped;", "out.wasted = capped;",
    ["ledger.test.mjs"]],
  ["the absorbed maths uses the suppressed figure (spend inflates)",
    "var absorbed = Math.max(0, elapsed / secPerE - capped);",
    "var absorbed = Math.max(0, elapsed / secPerE - out.wasted);",
    ["ledger.test.mjs"]],
  ["the ledger call site stops passing the flag",
    "prev.fullAt, !!state.warStack);", "prev.fullAt, false);",
    ["warstack.test.mjs"]],
  ["the live card bills a deliberate hold as a loss",
    "      : state.warStack\n", "      : false\n",
    ["warstack.test.mjs"]],
  ["the hold is reported with no reason given",
    '" \\u2014 held for the stack, so it is not counted as missed.</div>"',
    '"</div>"',
    ["warstack.test.mjs"]],
  ["the verdict goes back to telling you not to take one",
    'move: "War stack. " + (takeXan ? "Take a Xanax." : "Hold energy."),',
    'move: "War stack. Hold energy.",',
    ["warstack.test.mjs"]],
  ["a Xanax is advised straight through the drug cooldown",
    "var takeXan = state.drugCd <= 0 && xans > 0 && stackRoom >= 250;",
    "var takeXan = xans > 0 && stackRoom >= 250;",
    ["warstack.test.mjs"]],
  ["a Xanax is advised with none in the inventory",
    "var takeXan = state.drugCd <= 0 && xans > 0 && stackRoom >= 250;",
    "var takeXan = state.drugCd <= 0 && stackRoom >= 250;",
    ["warstack.test.mjs"]],
  ["a Xanax is advised that would spill past the ceiling",
    "var takeXan = state.drugCd <= 0 && xans > 0 && stackRoom >= 250;",
    "var takeXan = state.drugCd <= 0 && xans > 0;",
    ["warstack.test.mjs"]],
  ["the Stock row is gated on war stack again",
    "var xanOk = state.drugCd <= 0 && state.items.xanax > 0;",
    "var xanOk = state.drugCd <= 0 && !state.warStack && state.items.xanax > 0;",
    ["warstack.test.mjs"]],
];

let killed = 0; const survived = [];
for (const [name, from, to, suites] of mutants) {
  if (!original.includes(from)) { console.log("SKIP (no match) " + name); continue; }
  fs.writeFileSync(FILE, original.replace(from, to));
  build();
  let anyRed = false;
  for (const s of suites) {
    try { execSync("node " + s, { stdio: "pipe" }); } catch { anyRed = true; }
  }
  if (anyRed) { killed++; console.log("killed    " + name); }
  else { survived.push(name); console.log("SURVIVED  " + name); }
}
fs.writeFileSync(FILE, original);
build();

console.log("\n" + killed + " killed, " + survived.length + " survived");
if (survived.length) { console.log("\nvacuous coverage:"); survived.forEach(s => console.log("  - " + s)); }
process.exit(survived.length ? 1 : 0);
