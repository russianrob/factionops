// Mutation gate for clearing missed-energy days.
import fs from "fs";
import { execSync } from "child_process";
const FILE = fs.realpathSync("gym-coach-beta.user.js");
const original = fs.readFileSync(FILE, "utf8");
// Restored from this snapshot at the end -- do NOT edit the script while this runs.
const build = () => execSync("./build-harness.sh");

const mutants = [
  ["the original figure is not kept, so a clear cannot be undone",
    "if (typeof hit.w0 !== \"number\") hit.w0 = hit.wasted || 0;", "",
    ["ledgeredit.test.mjs"]],
  ["a second clear overwrites the original with zero",
    "if (typeof hit.w0 !== \"number\") hit.w0 = hit.wasted || 0;", "hit.w0 = hit.wasted || 0;",
    ["ledgeredit.test.mjs"]],
  ["spend is cleared along with the waste",
    "    hit.wasted = 0;\n    storeSet(\"ledger\", state.ledger);",
    "    hit.wasted = 0;\n    hit.used = 0;\n    storeSet(\"ledger\", state.ledger);",
    ["ledgeredit.test.mjs", "ledgeredit.e2e.test.mjs"]],
  ["the edit is not written back",
    "    hit.wasted = 0;\n    storeSet(\"ledger\", state.ledger);", "    hit.wasted = 0;",
    ["ledgeredit.test.mjs"]],
  ["the cached plan keeps the cleared day",
    "    hit.wasted = 0;\n    storeSet(\"ledger\", state.ledger);\n    resetPlanCaches();",
    "    hit.wasted = 0;\n    storeSet(\"ledger\", state.ledger);",
    ["ledgeredit.test.mjs"]],
  ["days outside the calibration window are offered too",
    "if (!e || typeof e.d !== \"number\" || e.d < first || e.d > today) return;",
    "if (!e || typeof e.d !== \"number\") return;",
    ["ledgeredit.test.mjs"]],
  ["cleared days vanish instead of staying restorable",
    "      var w = cleared ? e.w0 : (e.wasted || 0);", "      var w = e.wasted || 0;",
    ["ledgeredit.test.mjs", "ledgeredit.e2e.test.mjs"]],
  ["the click router drops the buttons again",
    "[data-clearday],[data-restoreday],", "",
    ["ledgeredit.e2e.test.mjs"]],
  ["clear-all reaches days the list never showed",
    "ledgerWasteDays().forEach(function (r) { if (!r.cleared) clearLedgerDay(r.d); });",
    "(state.ledger || []).forEach(function (r) { clearLedgerDay(r.d); });",
    ["ledgeredit.e2e.test.mjs"]],
];

let killed = 0; const survived = [];
for (const [name, from, to, suites] of mutants) {
  if (!original.includes(from)) { console.log("SKIP (no match) " + name); continue; }
  fs.writeFileSync(FILE, original.replace(from, to));
  build();
  let anyRed = false;
  for (const s of suites) { try { execSync("node " + s, { stdio: "pipe" }); } catch { anyRed = true; } }
  if (anyRed) { killed++; console.log("killed    " + name); }
  else { survived.push(name); console.log("SURVIVED  " + name); }
}
fs.writeFileSync(FILE, original);
build();
console.log("\n" + killed + " killed, " + survived.length + " survived");
if (survived.length) { console.log("\nvacuous coverage:"); survived.forEach(s => console.log("  - " + s)); }
process.exit(survived.length ? 1 : 0);
