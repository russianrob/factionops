// Mutation gate: platform detection behind the PDA-specific wording.
import fs from "fs";
import { execSync } from "child_process";
const FILE = "gym-coach-beta.user.js";
const original = fs.readFileSync(FILE, "utf8");
// Restored from this snapshot at the end -- do NOT edit the script while this runs.
const build = () => execSync("./build-harness.sh");
const mutants = [
  ["the host row is hardcoded again",
    '(isPda() ? "Torn PDA" : "Browser")', '"Torn PDA"'],
  ["detection always says PDA", "  function isPda() {\n    if (HAS_PDA_KEY) return true;",
    "  function isPda() {\n    return true;\n    if (HAS_PDA_KEY) return true;"],
  ["detection never says PDA", "  function isPda() {\n    if (HAS_PDA_KEY) return true;",
    "  function isPda() {\n    return false;\n    if (HAS_PDA_KEY) return true;"],
  ["the flutter bridge stops counting as PDA",
    "    try { if (window.flutter_inappwebview) return true; } catch (_) {}", ""],
  ["a browser is promised notifications again",
    '        : "Pings need Torn PDA \\u2014 they go through its notification bridge, which a browser does not have, so none will arrive here however long you wait.")',
    '        : "Pings use Torn PDA notifications and open the gym when they fire.")'],
];
let killed = 0; const survived = [];
for (const [name, from, to] of mutants) {
  if (!original.includes(from)) { console.log("SKIP (no match) " + name); continue; }
  fs.writeFileSync(FILE, original.replace(from, to));
  build();
  let red = false;
  try { execSync("node pda.test.mjs", { stdio: "pipe" }); } catch { red = true; }
  if (red) { killed++; console.log("killed    " + name); }
  else { survived.push(name); console.log("SURVIVED  " + name); }
}
fs.writeFileSync(FILE, original); build();
console.log("\n" + killed + " killed, " + survived.length + " survived");
if (survived.length) { console.log("\nvacuous coverage:"); survived.forEach(s => console.log("  - " + s)); }
process.exit(survived.length ? 1 : 0);
