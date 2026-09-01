import fs from "fs";
import { execSync } from "child_process";
const FILE = fs.realpathSync("gym-coach-beta.user.js");
const original = fs.readFileSync(FILE, "utf8");
const build = () => execSync("./build-harness.sh");
const U = "bookdom.test.mjs", E = "bookdom.e2e.test.mjs", B = "books.test.mjs";
const mutants = [
  ["the label is read from title instead of aria-label, which is where it is NOT",
    'n.getAttribute("aria-label") : null;', 'n.getAttribute("title") : null;', [U, E]],
  ["no strip is treated as no book, clearing a countdown on every page without a sidebar",
    "    if (!strip || !strip.length) return null;", "    if (!strip || !strip.length) return { found: false };", [U, E]],
  ["the name is parsed on a dash again, so a label without one detects nothing",
    "        if (low.indexOf(STAT_BOOKS[key].name.toLowerCase()) === 0) { k = key; break; }",
    "        if (low.split(BOOK_DASH_RE)[0].trim() === STAT_BOOKS[key].name.toLowerCase()) { k = key; break; }", [U]],
  ["the name is matched anywhere in the label rather than at the start",
    "        if (low.indexOf(STAT_BOOKS[key].name.toLowerCase()) === 0) { k = key; break; }",
    "        if (low.indexOf(STAT_BOOKS[key].name.toLowerCase()) !== -1) { k = key; break; }", [U]],
  ["the recognised book is reported under whatever the label happened to say",
    "      var name = k ? STAT_BOOKS[k].name : rest.split(BOOK_DASH_RE)[0].trim();",
    "      var name = rest;", [U]],
  ["only the em dash separates name from effect",
    "  var BOOK_DASH_RE = /\\s[\\u2014\\u2013-]\\s/;", "  var BOOK_DASH_RE = /\\s\\u2014\\s/;", [U]],
  ["the prefix becomes case-sensitive",
    "  var BOOK_LABEL_RE = /^\\s*reading\\s+book\\s*:\\s*/i;", "  var BOOK_LABEL_RE = /^\\s*reading\\s+book\\s*:\\s*/;", [U]],
  ["any label mentioning a book is taken as one being read",
    "      if (!label || !BOOK_LABEL_RE.test(label)) continue;", "      if (!label) continue;", [U]],
  ["a non-stat book is credited to a stat anyway",
    "      return { found: true, name: name, k: k, raw: String(label) };",
    '      return { found: true, name: name, k: k || "str", raw: String(label) };', [U, E]],
  ["the selector pins the volatile class hash instead of prefix-matching",
    "'ul[class*=\"status-icons\"] a[aria-label]'", "'ul.status-icons___sskG2 a[aria-label]'", [E]],
  ["detection never reaches the stored book dates",
    "        state.books[r.k] = Date.now();", "", [E]],
  ["detection overwrites a date already on record",
    "      if (!state.books[r.k]) {", "      if (true) {", [E]],
  ["an auto-detected book is not marked as one, so it can never be cleared",
    "        auto[r.k] = true;", "", [E]],
  ["a hand-tapped date is cleared by the detector too",
    "        if (auto[k] && state.books[k]) { state.books[k] = 0; auto[k] = false; changed = true; }",
    "        if (state.books[k]) { state.books[k] = 0; auto[k] = false; changed = true; }", [E]],
  ["tapping does not take the date back from the detector",
    "      if (state.booksAuto) { state.booksAuto[bkey] = false; storeSet(\"booksAuto\", state.booksAuto); }", "", [E]],
  ["the strip is never read during a paint",
    "    syncBookFromDom();", "", [E]],
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
