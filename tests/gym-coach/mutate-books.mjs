import fs from "fs";
import { execSync } from "child_process";
const FILE = fs.realpathSync("gym-coach-beta.user.js");
const original = fs.readFileSync(FILE, "utf8");
const build = () => execSync("./build-harness.sh");
const U = "books.test.mjs", G = "goals.test.mjs", S = "schedule.test.mjs";
const mutants = [
  ["the cap is dropped, so a big stat claims a huge award",
    "    return Math.min(Math.round(cur * BOOK_PCT), BOOK_CAP);",
    "    return Math.round(cur * BOOK_PCT);", [U]],
  ["the percentage is wrong",
    "  var BOOK_PCT = 0.05;", "  var BOOK_PCT = 0.10;", [U]],
  ["the cap is wrong",
    "  var BOOK_CAP = 10000000;", "  var BOOK_CAP = 5000000;", [U]],
  ["the reading time is wrong",
    "  var BOOK_DAYS = 31;", "  var BOOK_DAYS = 30;", [U]],
  ["a FINISHED book stays pending, so its award is counted twice",
    "    if (now >= finishesAt) return null;\n", "", [U]],
  // NOT listed: removing the `if (!start)` guard. Provably equivalent -- an
  // unset start dates the finish to 1970 and the now-check rejects it anyway --
  // and a mutant that cannot change an outcome proves nothing about the tests.
  ["the Defense book is named as the gym-gains one, which it is not",
    'def: { name: "Keeping Your Face Handsome" },', 'def: { name: "Get Hard Or Go Home" },', [U]],
  ["pending books stop reaching the projection",
    "      cur[k] = (state.stats[k] || 0) + pendingBookAward(k);",
    "      cur[k] = state.stats[k] || 0;", [U, G, S]],
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
