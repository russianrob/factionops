// Mutation gate for the API-sourced attack figure.
import fs from "fs";
import { execSync } from "child_process";
const FILE = fs.realpathSync("gym-coach-beta.user.js");
const original = fs.readFileSync(FILE, "utf8");
const build = () => execSync("./build-harness.sh");
const U = "attacksapi.test.mjs", E = "attacksapi.e2e.test.mjs";

const mutants = [
  ["an error payload reads as zero attacks instead of unknown",
    "if (!d || !Array.isArray(d.attacks)) return null;", "if (!d || !Array.isArray(d.attacks)) return { n: 0, energy: 0 };", [U, E]],
  ["yesterday's attacks are counted as today's",
    "      if (ts < dayStartSec) continue;\n", "", [U]],
  ["incoming attacks are counted as energy you spent",
    "      if (meId != null && (atk !== null ? atk !== String(meId) : def === String(meId))) continue;\n", "", [U]],
  ["a stealth attack (no attacker id) is dropped",
    "      if (meId != null && (atk !== null ? atk !== String(meId) : def === String(meId))) continue;",
    "      if (atk === null || (meId != null && atk !== String(meId))) continue;", [U]],
  ["an unknown player id drops every row",
    "      if (meId != null && (atk !== null", "      if ((atk !== null", [U]],
  ["pagination overlap is counted twice",
    "      if (seen[key]) continue;\n      seen[key] = 1;\n", "", [U]],
  ["the energy per attack is wrong",
    "var ATTACK_ENERGY = 25;", "var ATTACK_ENERGY = 20;", [U, E]],
  ["the card ignores the log and goes back to the bar",
    "var off = apiOff ? state.attacks.energy : (t.off || 0);", "var off = t.off || 0;", [E]],
  ["the card stops saying where the number came from",
    '(apiOff\n            ? \'<span class="muted"> \\u00b7 \' + state.attacks.n + " hit"', '(false\n            ? \'<span class="muted"> \\u00b7 \' + state.attacks.n + " hit"', [E]],
  ["the fetch is never called",
    '        fetchAttacksToday(kind === "boot" || kind === "manual" || kind === "train");\n', "", [E]],
  ["the day window starts at the epoch, so every attack ever counts",
    "    var dayStart = Math.floor(dayKey(Date.now()) * 86400000 / 1000);", "    var dayStart = 0;", [E]],
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
