import fs from "fs";
import { execSync } from "child_process";
const FILE = fs.realpathSync("gym-coach-beta.user.js");
const original = fs.readFileSync(FILE, "utf8");
const build = () => execSync("./build-harness.sh");
const U = "fillfrom.test.mjs", B = "boot.test.mjs", F = "fullbar.e2e.test.mjs";
const mutants = [
  ["the estimate is never used, so an unwatched bar stays undated",
    "    if (est && (!since || est < since)) since = est;\n", "", [U]],
  ["the estimate overrides a LONGER observed streak",
    "    if (est && (!since || est < since)) since = est;",
    "    if (est) since = est;", [U]],
  ["the refill time is ignored, dating the bar from the spend itself",
    "    var filled = last + max * secPerE * 1000;", "    var filled = last;", [U]],
  ["a bar that cannot have refilled yet is claimed as full",
    "    return filled <= now ? filled : 0;", "    return filled;", [U]],
  ["gains date the bar too, so a xanax looks like a spend",
    "      if (!e || !(e.delta < 0) || !(e.t > 0)) continue;",
    "      if (!e || !(e.t > 0)) continue;", [U]],
  ["the FIRST spend is used instead of the last",
    "      if (e.t > last) last = e.t;", "      if (!last) last = e.t;", [U]],
  ["a missing rate divides the estimate into nonsense",
    "    if (!events || !events.length || !(max > 0) || !(secPerE > 0)) return 0;",
    "    if (!events || !events.length) return 0;", [U]],
  ["the estimate leaks into a bar that is not even full",
    "    if (!state.energyKnown || state.energy < max) return null;", "    if (false) return null;", [B, F]],
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
