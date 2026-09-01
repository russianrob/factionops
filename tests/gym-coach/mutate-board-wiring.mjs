// Wiring mutants. The unit suite cannot see any of these: they live in the
// click router, the fetch scheduler and the render, not in the arithmetic.
import fs from "fs";
import { execSync } from "child_process";
const FILE = fs.realpathSync("gym-coach-beta.user.js");
const original = fs.readFileSync(FILE, "utf8");
const build = () => execSync("./build-harness.sh");
const E = "board.e2e.test.mjs";
const mutants = [
  ["gymtrains is not requested at all, so the train count is always zero",
    '  var BOARD_STATS = ["gymenergy", "gymtrains", "gymstrength", "gymdefense", "gymspeed", "gymdexterity"];',
    '  var BOARD_STATS = ["gymenergy", "gymstrength", "gymdefense", "gymspeed", "gymdexterity"];', [E]],
  ["the natural button stays live while the board is still loading, and silently does nothing",
    '      if (state.boardBusy) { showToast("Still reading", "The board is loading. Try again in a moment."); return; }',
    "", [E]],
  ["the Nat prompt is not offered beside the column it fills",
    '      (natKnown || state.natBusy || state.boardBusy ? "" :', '      (true ? "" :', [E]],
  ["data-board is left off the click router, so every button on the tab is dead",
    "[data-book],[data-board],#stackSw", "[data-book],#stackSw", [E]],
  ["the board loads on the poll tick instead of on tab open",
    '      if (state.tab === "board") fetchBoard(false);', "      fetchBoard(false);", [E]],
  ["the TTL is ignored, so every glance at the tab is another five requests",
    "    if (!force && Date.now() - last < BOARD_TTL) return;", "", [E]],
  ["a failed round never stamps the clock, so the retry loop feeds itself",
    "    state.boardTriedAt = Date.now();", "", [E]],
  ["the natural fan-out fires on its own rather than on request",
    '    if (what === "natural") {', '    if (false) {', [E]],
  ["the week-start reading is re-fetched every time, doubling the call count forever",
    "      if (!haveBase) jobs.push(function () { return httpGet(psUrl(id, startSec)).then(readPs); });",
    "      jobs.push(function () { return httpGet(psUrl(id, startSec)).then(readPs); });", [E]],
  ["both of a member's requests go out at once, so the gap only spaces the callbacks",
    "          return job().then(function (v) { acc.push(v); return acc; })",
    "          var started = job(); return started.then(function (v) { acc.push(v); return acc; })", [E]],
  ["the historic array shape is not read, so every natural figure silently zeroes",
    "      p.forEach(function (row) { if (row && row.name) out[row.name] = Number(row.value) || 0; });", "", [E]],
  ["your own row is not marked, so you cannot find yourself",
    '\'<div class="gcb-brow\' + (String(r.id) === String(meId) ? " me" : "") + \'">\'',
    '\'<div class="gcb-brow">\'', [E]],
  ["a refused key gets a blank tab instead of an explanation",
    "    if (state.boardError && !rows.length) {", "    if (false) {", [E]],
  // NOT listed: removing `state.boardBy = {}` / `state.natUse = {}` from the
  // rollover. It is unreachable through this harness and would sit here as a
  // permanent false red. A roll only happens when the week index changes, and
  // boardBy is only non-empty after a successful fetch -- so exercising it
  // needs a device left OPEN across Monday 00:00 TCT, which needs a stubbed
  // clock the harness does not have. board.e2e's rollover test covers the
  // across-a-reload case, where boardBy starts empty and the mutant cannot
  // show. The guard stays because it is right, not because a test proves it.
  ["members who left the faction are listed anyway",
    "    return rows.filter(function (r) { return r.in_faction !== false; });", "    return rows;", [E]],
];
let killed = 0; const survived = [];
for (const [name, from, to, suites] of mutants) {
  if (!original.includes(from)) { console.log("SKIP (no match) " + name); survived.push(name + " [NO MATCH]"); continue; }
  fs.writeFileSync(FILE, original.replace(from, to));
  build();
  let anyRed = false;
  for (const s of suites) { try { execSync("node " + s, { stdio: "pipe", timeout: 600000 }); } catch { anyRed = true; } }
  if (anyRed) { killed++; console.log("killed    " + name); }
  else { survived.push(name); console.log("SURVIVED  " + name); }
}
fs.writeFileSync(FILE, original); build();
console.log("\n" + killed + " killed, " + survived.length + " survived");
if (survived.length) { console.log("\nvacuous coverage:"); survived.forEach(s => console.log("  - " + s)); }
process.exit(survived.length ? 1 : 0);
