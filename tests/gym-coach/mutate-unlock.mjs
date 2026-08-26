// Mutation gate for unlock.test.mjs.
//
// Each entry breaks the production code in a way a careless edit really could.
// If the suite still passes, the test that was supposed to cover that line is
// vacuous and needs rewriting — a green suite against broken code is worse than
// no suite, because it reads as proof.
import fs from "fs";
import { execSync } from "child_process";

const FILE = "gym-coach-beta.user.js";
const original = fs.readFileSync(FILE, "utf8");
// The source is restored from this snapshot at the end, so do NOT edit
// gym-coach-beta.user.js while this is running — the restore silently
// reverts whatever you changed (it ate a version bump once).

const mutants = [
  ["segment index off by one",
    "GYM_SEGMENT_E[gymId - 2]", "GYM_SEGMENT_E[gymId - 1]"],
  ["segment read as a cumulative difference",
    "var req = GYM_SEGMENT_E[gymId - 2];",
    "var req = GYM_SEGMENT_E[gymId - 2] - (GYM_SEGMENT_E[gymId - 3] || 0);"],
  ["perk multiplies instead of divides",
    "req = Math.round(req / expMult);", "req = Math.round(req * expMult);"],
  ["perk never applied",
    "if (expMult && expMult > 1) req = Math.round(req / expMult);", ""],
  ["scan matches locked instead of inProgress",
    '/inProgress/.test(String(n.className || ""))',
    '/locked/.test(String(n.className || ""))'],
  ["half-rendered button accepted",
    "if (!m || !pm) continue;", "if (!m) continue;"],
  ["remaining reports progress instead of what is left",
    "var remainMax = Math.round(req * (100 - p) / 100);",
    "var remainMax = Math.round(req * p / 100);"],
  ["negative remainder clamp dropped",
    "var remainMin = Math.max(0, Math.round(req * (100 - Math.min(100, p + 1)) / 100));",
    "var remainMin = Math.round(req * (100 - (p + 1)) / 100);"],
  ["range collapses to a single figure",
    "Math.round(req * (100 - Math.min(100, p + 1)) / 100)",
    "Math.round(req * (100 - p) / 100)"],
  ["exp perk matcher loosened to any gym line",
    "if (!/gym\\s+experience/i.test(s)) return;", "if (!/gym/i.test(s)) return;"],
  ["exp perk accepts any multiplier",
    "if (n && n > 1 && n < 6) mult *= n;", "if (n) mult *= n;"],
  ["percentage parsed as an integer only",
    "/(\\d+(?:\\.\\d+)?)\\s*%/", "/(\\d+)\\s*%/"],
  ["gym id taken from list position rather than the icon class",
    'var m = icon && String(icon.className || "").match(/gym-(\\d+)/);',
    "var m = [null, String(i + 1)];"],
  ["specialist gyms given an energy answer",
    "if (!req) return null;", "if (!req) req = 1;"],
];

let killed = 0, survived = [];
for (const [name, from, to] of mutants) {
  if (!original.includes(from)) { console.log("SKIP (no match) " + name); continue; }
  fs.writeFileSync(FILE, original.replace(from, to));
  let passed = true;
  try { execSync("node unlock.test.mjs", { stdio: "pipe" }); } catch { passed = false; }
  if (passed) { survived.push(name); console.log("SURVIVED  " + name); }
  else { killed++; console.log("killed    " + name); }
}
fs.writeFileSync(FILE, original);

console.log("\n" + killed + " killed, " + survived.length + " survived");
if (survived.length) { console.log("\nvacuous coverage:"); survived.forEach(s => console.log("  - " + s)); }
process.exit(survived.length ? 1 : 0);
