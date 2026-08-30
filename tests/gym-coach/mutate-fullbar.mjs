// Mutation gate for the full-bar nag and the refill reminder.
import fs from "fs";
import { execSync } from "child_process";

const FILE = fs.realpathSync("gym-coach-beta.user.js");
const original = fs.readFileSync(FILE, "utf8");
// Restored from this snapshot at the end — do NOT edit the source while this
// is running.
const build = () => execSync("./build-harness.sh");
const U = "fullbar.test.mjs", E = "fullbar.e2e.test.mjs";

const mutants = [
  ["the ten-minute wait becomes one minute",
    "var FULLBAR_NAG_MS = 600000;", "var FULLBAR_NAG_MS = 60000;", [U, E]],
  ["Got it silences instead of snoozing",
    "var FULLBAR_SNOOZE_MS = 120000;", "var FULLBAR_SNOOZE_MS = 86400000;", [U, E]],
  ["Got it stops registering at all",
    "if (ackAt && now - ackAt < FULLBAR_SNOOZE_MS) return null;", "", [U, E]],
  ["a war stack gets nagged after all",
    "    if (stacking) return null;\n", "", [U, E]],
  ["a bar above the cap gets nagged (regen is paused up there)",
    "if (max && energy > max) return null;", "", [U]],
  ["seconds are read as milliseconds (fires almost immediately)",
    "if (streakSec * 1000 < FULLBAR_NAG_MS) return null;",
    "if (streakSec < FULLBAR_NAG_MS) return null;", [U, E]],
  ["a missing streak is treated as a long one",
    'if (typeof streakSec !== "number" || !isFinite(streakSec)) return null;', "", [U]],
  ["NaN slips through the type check (renders \"Bar full NaNm\")",
    'if (typeof streakSec !== "number" || !isFinite(streakSec)) return null;',
    'if (typeof streakSec !== "number") return null;', [U]],
  // The regression this whole rewrite came from: the banner reading a clock
  // of its own instead of the one the panel prints.
  ["the banner stops reading capStreak and never fires",
    "var st = capStreak();", "var st = null;", [E]],
  ["training leaves a stale acknowledgement behind",
    "    if (state.fullAckAt) {\n      state.fullAckAt = 0;", "    if (false) {\n      state.fullAckAt = 0;", [U]],
  ["the acknowledgement is never restored at boot",
    '      state.fullAckAt = Number(storeGet("fullack", 0)) || 0;\n', "", [E]],
  ["the banner is put back behind the gym-page gate",
    "          trackFullBar();\n          try { renderNag(); } catch (_) {}",
    "          if (onGymPage()) { trackFullBar(); try { renderNag(); } catch (_) {} }", [E]],
  ["the banner is never taken down again",
    "      if (el && el.parentNode) el.parentNode.removeChild(el);\n      return;",
    "      return;", [E]],
  // --- refill reminder ---
  ["an unknown refill flag is treated as unused",
    "if (state.refillUsed !== false) return null;",
    "if (state.refillUsed === true) return null;", [U]],
  ["the refill is suggested however full the bar is",
    "    if (room < max * (1 - REFILL_WORTH_PCT)) return null;\n", "", [U]],
  ["the v1 field name is misspelled (reminder silently never fires)",
    'if (typeof r.energy_refill_used === "boolean") return r.energy_refill_used;',
    'if (typeof r.energyRefillUsed === "boolean") return r.energyRefillUsed;', [U]],
  ["the v2 fallback field is dropped",
    '    if (typeof r.energy === "boolean") return r.energy;\n', "", [U]],
  ["an unreadable answer defaults to 'not used yet'",
    "  function readRefillUsed(d) {\n    var r = d && d.refills;\n    if (!r) return null;",
    "  function readRefillUsed(d) {\n    var r = d && d.refills;\n    if (!r) return false;", [U]],
  // --- Mc Smoogle ---
  ["the stock id is wrong (silently never fires)",
    "var MCS_STOCK_ID = 29;", "var MCS_STOCK_ID = 24;", [U]],
  ["the id check is dropped, so ANY ready stock reads as Mc Smoogle",
    'if (String(rows[i].id) !== String(MCS_STOCK_ID)) continue;', "", [U]],
  ["a not-ready claim is announced as ready",
    "if (!m || m.available !== true) return null;", "if (!m) return null;", [U]],
  ["increments are ignored, so two increments still read as 100e",
    "var e = MCS_ENERGY * (m.increment || 1);", "var e = MCS_ENERGY;", [U]],
  ["the energy figure is wrong",
    "var MCS_ENERGY = 100;", "var MCS_ENERGY = 150;", [U]],
  ["an unreadable bonus is treated as ready",
    'if (typeof b.available !== "boolean") return null;', "", [U]],
  ["the worth-it threshold is loosened to any room at all",
    "var REFILL_WORTH_PCT = 0.25;", "var REFILL_WORTH_PCT = 0.99;", [U]],
];

let killed = 0; const survived = [];
for (const [name, from, to, suites] of mutants) {
  if (!original.includes(from)) { console.log("SKIP (no match) " + name); survived.push(name + " [NO MATCH]"); continue; }
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
