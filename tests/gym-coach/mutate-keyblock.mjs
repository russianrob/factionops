// Mutation gate for the Full-key requirement.
import fs from "fs";
import { execSync } from "child_process";
const FILE = fs.realpathSync("gym-coach-beta.user.js");
const original = fs.readFileSync(FILE, "utf8");
const build = () => execSync("./build-harness.sh");
const U = "keylevel.test.mjs", E = "keyblock.e2e.test.mjs";
const mutants = [
  ["a Limited key is let through",
    '        if (v === "limited") {', "        if (false) {", [E]],
  ["an invalid key is let through",
    '        if (v === "invalid") {', "        if (false) {", [E]],
  ["a rate-limited check REFUSES, turning a busy API into a lockout",
    '    if (!lvl) return "unknown";', '    if (!lvl) return "limited";', [U, E]],
  ["the level threshold is lowered so Limited counts as Full",
    "full: a.level >= 4 };", "full: a.level >= 3 };", [U, E]],
  ["the verdict trusts the type string instead of the level",
    "full: a.level >= 4 };", 'full: /full/i.test(String(a.type || "")) };', [U]],
  ["an invalid key is scored the same as an unreadable one",
    '    if (d && d.error && d.error.code === 2) return "invalid";\n', "", [U, E]],
  ["the key is stored BEFORE the check, so a refusal comes too late",
    "    k = k.slice(0, 16);\n", "    k = k.slice(0, 16);\n    commitKey(k);\n", [E]],
  ["the rejection is silent, so nothing explains the refusal",
    '          showToast("That key is "', '          if (false) showToast("That key is "', [E]],
  ["the rebuilt error shape is dropped, so a bad key scores unknown",
    "            function (e) { return e && e.code ? { error: { code: e.code, error: e.message } } : null; })",
    "            function () { return null; })", [E]],
  ["PDA's injected key wins again, so a typed Full key cannot be used",
    '    var own = String(storeGet("api_key", "") || "").trim();\n    if (own) return own;\n    var injected',
    '    var injected0 = String(PDA_INJECTED_KEY || "").trim();\n    if (injected0 && injected0.indexOf("###") === -1 && injected0.length > 8) return injected0;\n    var own = String(storeGet("api_key", "") || "").trim();\n    if (own) return own;\n    var injected', [U]],
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
