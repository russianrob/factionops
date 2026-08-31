import fs from "fs";
import { execSync } from "child_process";
const FILE = fs.realpathSync("gym-coach-beta.user.js");
const original = fs.readFileSync(FILE, "utf8");
const build = () => execSync("./build-harness.sh");
const E = "verdictfold.e2e.test.mjs", N = "nav.test.mjs";
const mutants = [
  ["the fold is ignored, so it never minimises",
    '      (tab === "now" && !state.verdictFold', '      (tab === "now"', [E]],
  // The state literal is NOT where the default lives -- boot overwrites it
  // from storage on every load, so mutating it is equivalent. The storeBool
  // fallback is the real decision.
  ["it starts expanded again, losing the compact default",
    '      state.verdictFold = storeBool("verdictFold", true);',
    '      state.verdictFold = storeBool("verdictFold", false);', [E]],
  ["the default overrides a stored choice, re-folding a panel someone opened",
    '      state.verdictFold = storeBool("verdictFold", true);',
    "      state.verdictFold = true;", [E]],
  ["the toggle does nothing",
    "      state.verdictFold = !state.verdictFold;", "      state.verdictFold = state.verdictFold;", [E]],
  ["the choice is not persisted, so it resets on every load",
    '      storeSet("verdictFold", state.verdictFold ? 1 : 0);\n', "", [E]],
  ["it is not restored at boot, so a stored choice is ignored",
    '      state.verdictFold = storeBool("verdictFold", true);\n', "", [E]],
  ["the folded bar navigates instead of expanding, so Now can never unfold",
    '? \'<button type="button" class="gcb-mini\' + (c.kind === "go" ? " go" : "") + \'" data-act="verdict">\'',
    '? \'<button type="button" class="gcb-mini\' + (c.kind === "go" ? " go" : "") + \'" data-tab="now">\'', [E]],
  ["the off-Now bar becomes a toggle, breaking the way back to Now",
    ': \'<button type="button" class="gcb-mini\' + (c.kind === "go" ? " go" : "") + \'" data-tab="now">\'',
    ': \'<button type="button" class="gcb-mini\' + (c.kind === "go" ? " go" : "") + \'" data-act="verdict">\'', [E, N]],
  ["the folded bar drops the energy figure",
    '\'<span class="gcb-minie">\' + Math.max(0, state.energy || 0) + " / " + (state.energyMax || 150) + "</span>" +\n          "</button>"\n        : ',
    '"</button>"\n        : ', [E]],
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
