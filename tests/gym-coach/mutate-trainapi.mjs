// Mutation gate: Spent today from Torn's log.
import fs from "fs";
import { execSync } from "child_process";
const FILE = "gym-coach-beta.user.js";
const original = fs.readFileSync(FILE, "utf8");
// Restored from this snapshot at the end -- do NOT edit the script while this runs.
const build = () => execSync("./build-harness.sh");
const E2E = ["trainapi.e2e.test.mjs"], U = ["trainapi.test.mjs"];
const mutants = [
  ["the log is never fetched", "fetchTrainLog(kind === \"train\" || kind === \"boot\");", "", E2E],
  ["the card ignores the log and uses the bar",
    "fmt(Math.round(logged === null ? t.used : logged))", "fmt(t.used)", E2E],
  ["a missing log claims you trained nothing",
    "    if (!tl || !tl.byDay) return null;", "    if (!tl || !tl.byDay) return 0;", U.concat(E2E)],
  ["entries are bucketed by local day, not UTC",
    "      var d = dayKey(ts * 1000);", "      var d = dayKey(ts * 1000 - 4 * 3600 * 1000);", U],
  ["the timestamp is read as milliseconds",
    "      var d = dayKey(ts * 1000);", "      var d = dayKey(ts);", U.concat(E2E)],
  ["an entry with no energy figure counts as zero",
    "        if (!(used > 0) || !(ts > 0)) continue;", "        if (!(ts > 0)) continue;", U],
  ["training since the fetch never shows",
    "    return (tl.byDay[dayKey(Date.now())] || 0) + (tl.since || 0);",
    "    return tl.byDay[dayKey(Date.now())] || 0;", U],
  // E2E, not U: which ids get REQUESTED is only visible from the real page.
  ["only one of the four stat logs is read",
    "  var TRAINLOG_IDS = [5300, 5301, 5302, 5303];", "  var TRAINLOG_IDS = [5300];", E2E],
];
let killed = 0; const survived = [];
for (const [name, from, to, suites] of mutants) {
  if (!original.includes(from)) { console.log("SKIP (no match) " + name); continue; }
  fs.writeFileSync(FILE, original.replace(from, to));
  build();
  let red = false;
  for (const s of suites) { try { execSync("node " + s, { stdio: "pipe" }); } catch { red = true; } }
  if (red) { killed++; console.log("killed    " + name); }
  else { survived.push(name); console.log("SURVIVED  " + name); }
}
fs.writeFileSync(FILE, original); build();
console.log("\n" + killed + " killed, " + survived.length + " survived");
if (survived.length) { console.log("\nvacuous coverage:"); survived.forEach(s => console.log("  - " + s)); }
process.exit(survived.length ? 1 : 0);
