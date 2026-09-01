import fs from "fs";
import { execSync } from "child_process";
const FILE = fs.realpathSync("gym-coach-beta.user.js");
const original = fs.readFileSync(FILE, "utf8");
const build = () => execSync("./build-harness.sh");
const U = "calmixed.test.mjs", C = "cal.test.mjs", T = "trainlog.test.mjs", E = "calmixed.e2e.test.mjs";
const mutants = [
  ["the stat is guessed from request order instead of read from the row",
    '    var t = String((e && e.title) || "").toLowerCase();', '    var t = "strength";', [U, C]],
  ["an unreadable row title is filed under strength rather than dropped",
    "    return null;\n  }\n\n  // Energy per stat per day", '    return "str";\n  }\n\n  // Energy per stat per day', [U]],
  ["the British spelling of defense stops resolving",
    '    if (t.indexOf("defense") !== -1 || t.indexOf("defence") !== -1) return "def";',
    '    if (t.indexOf("defense") !== -1) return "def";', [U]],
  ["rows whose stat cannot be read are counted anyway, under whatever came last",
    "        if (!stat) continue;", "", [U]],
  ["the per-stat map collapses every stat into one bucket",
    '        out[d][stat] = (out[d][stat] || 0) + used;', '        out[d].all = (out[d].all || 0) + used;', [U, C]],
  ["days are merged in the per-stat map",
    "        var d = dayKey(ts * 1000);\n        if (!out[d]) out[d] = {};", "        var d = 0;\n        if (!out[d]) out[d] = {};", [U]],
  ["a line with no energy figure is counted as a free session",
    "        if (!(used > 0) || !(ts > 0)) continue;\n        var stat = trainStatFromLogRow(e);", "        var stat = trainStatFromLogRow(e);", [U]],
  ["a split covering a stat that never moved is accepted",
    "      if (moved.indexOf(keys[i]) === -1) return null;", "", [U]],
  ["a stat that moved with nothing logged against it is accepted",
    "      if (!(split[moved[i]] > 0)) return null;", "", [U, C]],
  ["the split no longer has to agree with the day's recorded energy",
    "    if (Math.abs(total - (Number(used) || 0)) > MIXED_SLACK) return null;", "", [U, C]],
  ["the slack is wide enough to wave through two records of different days",
    "  var MIXED_SLACK = 25;", "  var MIXED_SLACK = 100000;", [U, C]],
  ["a mixed day is measured even when nothing recorded the split",
    "      var split = mixedDayEnergy(byStat[d], moved.map(function (m) { return m.k; }), e);\n      if (!split) continue;",
    "      var split = byStat[d] || {};", [C]],
  ["mixed days stop being measured at all -- back to the old rule",
    "      if (!split) continue;", "      if (!split) continue;\n      continue;", [C]],
  ["a mixed day's predicted gain is taken from one stat only",
    "        pSum += pm;\n        gSum += m.g;", "        pSum = pm;\n        gSum = m.g;", [C]],
  ["a stat whose gain cannot be predicted no longer disqualifies the day",
    "      if (bad || !(pSum > 0)) continue;", "      if (!(pSum > 0)) continue;", [C]],
  ["the per-stat map never reaches calibration",
    "    var byStat = (state.trainLog && state.trainLog.byDayStat) || {};", "    var byStat = {};", [C]],
  ["the per-stat map is never built from the log round",
    "                         byDayStat: trainLogByDayStat(rs),", "", [E]],
  ["the stat is taken from the log id order rather than Torn's wording",
    '    var t = String((e && e.title) || "").toLowerCase();',
    '    var t = ["strength","defense","speed","dexterity"][[5300,5301,5302,5303].indexOf(Number(e && e.log))] || "";', [E]],
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
