import fs from "fs";
import { execSync } from "child_process";
const FILE = fs.realpathSync("gym-coach-beta.user.js");
const original = fs.readFileSync(FILE, "utf8");
const build = () => execSync("./build-harness.sh");
const U = "bookdom.test.mjs", E = "bookdom.e2e.test.mjs", B = "books.test.mjs", S = "bookstart.test.mjs";
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
  ["the log is searched for the book NAME again, which its rows never carry",
    "        if (wantId) hit = Number((e.data || {}).item) === wantId;", "", [S, E]],
  ["the id is matched against the serialised row, so faction:745 counts as a hit",
    "        if (wantId) hit = Number((e.data || {}).item) === wantId;",
    "        if (wantId) hit = JSON.stringify(e).indexOf(String(wantId)) !== -1;", [S]],
  ["the item ids are never resolved, so there is no id to match on",
    "        fetchBookIds();", "", [E]],
  ["the resolved id is not passed to the lookup",
    "        var when = bookStartFromLog([d], name, (state.bookIds || {})[k]);",
    "        var when = bookStartFromLog([d], name, 0);", [E]],
  ["the catalogue maps every book, not just the four that award a stat",
    "      if (key) out[key] = Number(it.id);", "      out[key || it.name] = Number(it.id);", [S]],
  ["resolving the ids does not let the log lookup try again",
    "          state.bookStartAt = 0;", "", [E]],
  ["the start date is guessed from the sighting again, ignoring the log",
    "      if (!(state.booksExact || {})[r.k]) fetchBookStart(r.k, r.name);", "", [E]],
  ["the log is asked for the wrong id, which returns an empty log rather than an error",
    "  var BOOK_USE_LOG = 2050;", "  var BOOK_USE_LOG = 2051;", [S, E]],
  ["only one field of the log row is searched for the book name",
    "        try { blob = JSON.stringify(e).toLowerCase(); } catch (_) { continue; }",
    "        try { blob = String((e.data || {}).title || \"\").toLowerCase(); } catch (_) { continue; }", [S, E]],
  ["the OLDEST reading of a book wins, so a re-read counts from years ago",
    "        if (ts > best) best = ts;", "        if (!best || ts < best) best = ts;", [S]],
  ["an exact date is not marked as one, so the card keeps disclaiming it",
    "          state.booksExact[k] = true;", "", [E]],
  ["the card lists every book even while one is being read",
    "    var rows = live.length", "    var rows = false", [E]],
  ["there is no way to record a book the page cannot show",
    "        '<div class=\"row\"><span class=\"muted\" style=\"font-size:11px\">Reading a different one?</span>' +",
    "        '' +", [E]],
  ["a book finishing tonight is reported as a rounded-up day",
    "        p.finishesAt - now < 172800000", "        false", [E]],
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
