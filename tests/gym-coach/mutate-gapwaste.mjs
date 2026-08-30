// Mutation gate for the gap reconstruction.
import fs from "fs";
import { execSync } from "child_process";
const FILE = fs.realpathSync("gym-coach-beta.user.js");
const original = fs.readFileSync(FILE, "utf8");
const build = () => execSync("./build-harness.sh");
const G = "gapwaste.test.mjs", E = "events.test.mjs", B = "boot.test.mjs", O = "offgym.test.mjs",
      L = "gapledger.test.mjs";   // the WIRING; without it the whole gap branch could be deleted

const mutants = [
  ["a Limited key guesses the gap instead of declining",
    "    if (state.logReadable !== true) return null;\n", "", [G, L]],
  ["declining is reported as zero waste, which is a claim",
    "    if (state.logReadable !== true) return null;", "    if (state.logReadable !== true) return 0;", [G, L]],
  ["a war stack is billed for the gap",
    "    if (stacking) return 0;\n", "", [G, L]],
  ["attack events are left out of the timeline",
    "      .concat(state.attackEvents || []);", ";", [G, L]],
  ["training events are left out of the timeline",
    "    var evs = ((state.trainLog && state.trainLog.events) || [])", "    var evs = ([])", [G, L]],
  ["the gap threshold is so large no gap is ever reconstructed",
    "  var GAP_MS = 120000;", "  var GAP_MS = 999999999;", [G, B, L]],
  ["the gap threshold fires on every ordinary tick",
    "  var GAP_MS = 120000;", "  var GAP_MS = 0;", [O, L]],
  ["a declined gap is silently booked as the old guess",
    "        d.wasted = g === null ? 0 : g;", "        d.wasted = g === null ? d.wasted : g;", [G, L]],
  ["the gap path is never taken, so the old guess stands",
    "      if (now - prev.t > GAP_MS) {", "      if (false) {", [B, L]],
  ["a declined gap is not flagged, so the card claims a complete figure",
    "          todayBucket.partial = 1;\n", "", [G, L]],
  ["training events keep the daily total's rounding instead of their timestamps",
    "        out.push({ t: ts * 1000, delta: -used });", "        out.push({ t: ts, delta: -used });", [E]],
  ["an unreadable log line is counted as a free session",
    "        if (!(used > 0) || !(ts > 0)) continue;\n", "", [E]],
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
