// Mutation gate for percentage builds.
import fs from "fs";
import { execSync } from "child_process";
const FILE = fs.realpathSync("gym-coach-beta.user.js");
const original = fs.readFileSync(FILE, "utf8");
const build = () => execSync("./build-harness.sh");
const U = "shares.test.mjs", E = "shares.e2e.test.mjs";
const mutants = [
  ["shares are not normalised, so 4:3:2:1 stops meaning 40/30/20/10",
    "    HIST_KEYS.forEach(function (k) { out[k] = out[k] / sum * 100; });\n", "", [U]],
  // NOT listed: removing the want>0 filter. It is provably equivalent -- see
  // the comment on shareNextStat -- and a mutant that cannot change an outcome
  // proves nothing about the tests.
  ["negatives are let into the sum, rescaling every other stat",
    "      out[k] = isFinite(v) && v > 0 ? v : 0;", "      out[k] = isFinite(v) ? v : 0;", [U]],
  ["nothing entered reads as a real build rather than no build",
    "    if (sum <= 0) return null;", "    if (sum < 0) return null;", [U]],
  ["deficit ranks the candidates again, ignoring the gym bonus",
    "      if ((p[r.k] || 1) > (p[best.k] || 1)) best = r;\n", "", [U, E]],
  ["the bonus is allowed to pick a stat that is already OVER its share",
    "    var under = rows.filter(function (r) { return r.delta > 0; });", "    var under = rows;", [U]],
  ["a build with nothing under returns nothing instead of the closest stat",
    "      return rows[0].k;", '      return "";', [U]],
  ["the next-row marker is dropped, so the top row reads as next",
    "            (r.k === nextK ? '<b class=\"ok\"> \\u00b7 next</b>' : \"\") + \"</span>\" +", "", [E]],
  ["the next stat is the biggest SURPLUS, not the biggest deficit",
    "    return { k: k, want: shares[k] || 0, have: have, delta: (shares[k] || 0) - have };",
    "    return { k: k, want: shares[k] || 0, have: have, delta: have - (shares[k] || 0) };", [U, E]],
  ["a missing total is treated as a goal of zero rather than maintain mode",
    "    if (!shares || tot <= 0) return null;", "    if (!shares) return null;", [U]],
  ["the derived targets ignore the share and split the total evenly",
    "    HIST_KEYS.forEach(function (k) { out[k] = Math.round(tot * (shares[k] || 0) / 100); });",
    "    HIST_KEYS.forEach(function (k) { out[k] = Math.round(tot / 4); });", [U, E]],
  ["shares never reach the planner, so a total goal does nothing",
    "        state.goals = derived;", "        void derived;", [E]],
  ["maintain mode stops steering the focus",
    "        var sk = shareNextStat(state.shares, state.stats, state.perks);", '        var sk = "";', [E]],
  ["the card is never rendered",
    "      sharesHtml() +\n", "", [E]],
  ["what you typed is normalised under the cursor",
    "      state.sharesRaw = raw;", "      state.sharesRaw = normalizeShares(raw);", [E]],
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
