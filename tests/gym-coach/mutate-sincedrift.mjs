import fs from "fs";
import { execSync } from "child_process";
const FILE = fs.realpathSync("gym-coach-beta.user.js");
const original = fs.readFileSync(FILE, "utf8");
const build = () => execSync("./build-harness.sh");
const U = "sincedrift.test.mjs", L = "trainmerge.test.mjs", T = "trainlog.test.mjs", E = "gymspend.e2e.test.mjs";
const mutants = [
  ["a sub-train bar wobble is counted as training again -- the reported bug",
    "    return Math.floor(u / per) * per;", "    return u;", [U]],
  ["the remainder riding along with a real train is kept",
    "    return Math.floor(u / per) * per;", "    return Math.ceil(u / per) * per;", [U]],
  ["an unknown gym cost stops recording training altogether",
    "    if (per <= 0) return u;", "    if (per <= 0) return 0;", [U]],
  ["a negative drop becomes a credit",
    "    if (u <= 0) return 0;", "", [U]],
  ["the local count outranks the log forever again",
    "    if (at && (Number(now) || 0) - at > SINCE_GRACE_MS) return 0;", "", [U, L]],
  ["the grace window is shorter than a log round, so the figure dips every round",
    "  var SINCE_GRACE_MS = 420000;", "  var SINCE_GRACE_MS = 30000;", [U]],
  ["the carry is dropped outright, so a fresh train vanishes until the log lands",
    "    if (at && (Number(now) || 0) - at > SINCE_GRACE_MS) return 0;", "    return 0;", [U, L]],
  ["an unstamped counter is thrown away, losing a real train on upgrade",
    "    if (at && (Number(now) || 0) - at > SINCE_GRACE_MS) return 0;",
    "    if ((Number(now) || 0) - at > SINCE_GRACE_MS) return 0;", [U]],
  ["the counter is never stamped, so it can never expire",
    "    tl.sinceAt = Number(now) || 0;", "", [U]],
  ["recording a train overwrites the running total instead of adding to it",
    "    tl.since = (tl.since || 0) + Number(trained);", "    tl.since = Number(trained);", [U]],
  ["the recorded train never reaches the running count",
    "              noteGymSpend(state.trainLog, trained, Date.now());", "", [U, L, E]],
  ["the whole-trains guard is not wired into the ledger at all",
    "            var trained = gymSpend(d.used, gymFor().Energy);", "            var trained = d.used;", [U, E]],
  ["the guard is fed the wrong cost, so every drop looks like noise",
    "            var trained = gymSpend(d.used, gymFor().Energy);", "            var trained = gymSpend(d.used, 1000);", [U, E]],
  ["gym spend stops reaching the ledger bucket",
    "              b.used += trained;", "", [U, L, T]],
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
