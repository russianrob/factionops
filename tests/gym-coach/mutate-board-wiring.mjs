// Wiring mutants. The unit suite cannot see any of these: they live in the
// click router, the fetch scheduler and the render, not in the arithmetic.
import fs from "fs";
import { execSync } from "child_process";
const FILE = fs.realpathSync("gym-coach-beta.user.js");
const original = fs.readFileSync(FILE, "utf8");
const build = () => execSync("./build-harness.sh");
const E = "board.e2e.test.mjs";
const mutants = [
  // NOT listed: inserting `if (0) return;` into boardGet's success handler.
  // Dead code that cannot execute, so it is an equivalent mutant and proves
  // nothing. The timeout itself IS covered -- "the timeout clock is removed
  // outright" below is killed by the hang test.
  ["the timeout clock is removed outright",
    "        reject(new Error(\"timed out\"));", "", [E]],
  // NOT listed: appending `void 0;` after the anchor commit. Another no-op.
  // The real version of this concern -- the draft aliasing the live baseline
  // through a shallow copy -- was a genuine bug, and is covered by
  // mutate-board.mjs's "the draft aliases the baseline" against boardDraft.
  ["a half-read round saves anyway",
    "        state.boardPartial = got;", "        state.boardPartial = 0;", [E]],
  ["the partial warning is dropped, so a short board looks complete",
    "      (!state.boardBusy && state.boardPartial", "      (false && state.boardPartial", [E]],
  ["the key's faction flag is ignored, so six refused requests go out anyway",
    "    if (!force && state.keyLevel && state.keyLevel.faction === false) return;", "", [E]],
  ["a key without faction access is BLOCKED rather than warned -- no way through",
    "    if (!force && state.keyLevel && state.keyLevel.faction === false) return;",
    "    if (state.keyLevel && state.keyLevel.faction === false) return;", [E]],
  ["a transient error is blamed on faction permissions too",
    "    return c === 7 || c === 16;", "    return true;", [E]],
  ["the natural pass loses its cooldown",
    "    if (!force && Date.now() - (state.natAt || 0) < NAT_TTL) return;", "", [E]],
  ["Refresh stays live during the natural pass, doubling the request rate",
    '      (state.natBusy || state.boardBusy ? ""\n        : \'<button type="button" class="gcb-btn ghost" data-board="refresh">Refresh</button>\') +',
    '      \'<button type="button" class="gcb-btn ghost" data-board="refresh">Refresh</button>\' +', [E]],
  ["fetchBoard stops checking natBusy, so both chains run at once",
    "    if (state.boardBusy || state.natBusy) return;\n    var last = Math.max",
    "    if (state.boardBusy) return;\n    var last = Math.max", [E]],
  ["a corrupt stored board is trusted, and a string anchor throws",
    "          isFinite(Number(bd.week))) {", "          true) {", [E]],
  // NOT listed: dropping the `stat === BOARD_STATS[0]` half of the applied
  // check. Provably equivalent as the code stands: step() rethrows, so a
  // failure at gymenergy aborts the chain and no later stat can ever reach this
  // line -- only gymenergy can set `applied` either way. It would stop being
  // equivalent the day the round tolerates a partial failure, which is exactly
  // when someone should re-add it.
  ["the raw week-start and live counts are never shown",
    "        var raw = state.playerId && state.natRaw[String(state.playerId)];", "        var raw = null;", [E]],
  ["a whole faction of identical counts passes without comment",
    "        var same = ids.length >= 3 && moved === 0;", "        var same = false;", [E]],
  ["one member buying nothing trips the API warning",
    "        var same = ids.length >= 3 && moved === 0;", "        var same = flat(raw);", [E]],
  ["the raw pair is never recorded, so there is nothing to show",
    "          if (live && haveBase) state.natRaw[id] = { now: live, then: haveBase };", "", [E]],
  ["a skewed board says nothing about it",
    "      (boardSkew(state.board) > BOARD_SKEW_MS", "      (false && boardSkew(state.board) > BOARD_SKEW_MS", [E]],
  ["re-anchoring keeps the old baselines, so it changes nothing",
    "      state.board.stats = {};\n      state.board.statsAt = {};", "", [E]],
  ["the stamps never reach storage, so a reload loses the skew",
    "                          statsAt: state.board.statsAt || {},", "", [E]],
  ["the owner's raw before-and-after is not printed",
    "      (meId && state.boardBy.gymenergy && state.boardBy.gymenergy[String(meId)]",
    "      (false && state.boardBy.gymenergy && state.boardBy.gymenergy[String(meId)]", [E]],
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
    "      if (!haveBase) jobs.push(function () { return boardGet(psUrl(id, startSec)).then(readPs); });",
    "      jobs.push(function () { return boardGet(psUrl(id, startSec)).then(readPs); });", [E]],
  ["the spacing between a member's two requests is dropped",
    "            .then(function (a) { return new Promise(function (r) { setTimeout(function () { r(a); }, BOARD_GAP_MS); }); });",
    "            .then(function (a) { return a; });", [E]],
  // Replaced below by a mutant that removes the GAP itself, which is the
  // property that actually matters. Hoisting `job()` into a variable is
  // equivalent -- it is called at the same moment either way.
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
