// Which forums RW Pricer reads.
//
// The forum halves were gated on `forums.php` alone, which is every forum
// Torn has — forty-two of them. A weapon name in Fun & Games got a badge, and
// a screenshot pasted into General Discussion was sent to the server and paid
// for. The readers only ever had a reason to run where people sell things.
//
// Trading Post is f=10. The ids come from Torn's own /v2/forum/categories;
// f=67 is Tools & Userscripts, where RW Pricer's own thread lives, and it is
// deliberately NOT in scope — a screenshot posted there is a question about
// the script, not stock for sale.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const SRC = fs.readFileSync(new URL("./public/scripts/torn-rw-pricer.user.js", import.meta.url), "utf8");

/** Lift a function out of the shipping script, brace-matched. */
function fn(name) {
  const i = SRC.indexOf("function " + name + "(");
  assert.ok(i >= 0, "not in the shipping script: " + name);
  const o = SRC.indexOf("{", i);
  let d = 0;
  for (let j = o; j < SRC.length; j++) {
    if (SRC[j] === "{") d++;
    else if (SRC[j] === "}" && --d === 0) return SRC.slice(i, j + 1);
  }
  throw new Error("unbalanced braces in " + name);
}

// The id comes out of the script as well as the function, so the two cannot
// drift apart: hardcoding 10 here would let someone change the source and
// still see green.
const IDCONST = SRC.match(/var TRADING_POST_FORUM = \d+;/);
assert.ok(IDCONST, "TRADING_POST_FORUM is not in the shipping script");

const sandbox = {};
vm.createContext(sandbox);
vm.runInContext(IDCONST[0] + "\n" + fn("forumAllowsReads") + "\nglobalThis.ok = forumAllowsReads;", sandbox);
const ok = sandbox.ok;

test("the id in the script is Torn's id for Trading Post", () => {
  // Checked against /v2/forum/categories: f=10 is Trading Post, and the board
  // the reader is meant for is https://www.torn.com/forums.php#/p=forums&f=10
  assert.match(IDCONST[0], /= 10;$/);
});

// ── The forum the readers are for ──────────────────────────────

test("a Trading Post thread is in scope", () => {
  assert.equal(ok("#/p=threads&f=10&t=16450091&b=0&a=0"), true);
});

test("the Trading Post listing is in scope too", () => {
  // Stock gets quoted in thread titles on the listing page, and pricing those
  // costs nothing — the local parsers do it without touching the server.
  // The exact link to the board: forums.php#/p=forums&f=10&b=0&a=0
  assert.equal(ok("#/p=forums&f=10&b=0&a=0"), true);
  assert.equal(ok("#/p=forums&f=10"), true);
});

// ── Everywhere else ────────────────────────────────────────────

test("an ordinary chat forum is not read", () => {
  assert.equal(ok("#/p=threads&f=2&t=16000000&b=0&a=0"), false, "General Discussion");
  assert.equal(ok("#/p=threads&f=13&t=16000000&b=0&a=0"), false, "Fun & Games");
  assert.equal(ok("#/p=threads&f=9&t=16000000&b=0&a=0"), false, "Faction Discussion");
});

test("RW Pricer's own forum is not read", () => {
  // f=67 is Tools & Userscripts. A screenshot in the support thread is someone
  // asking why a price is wrong; reading it back at them helps nobody and
  // costs a model call.
  assert.equal(ok("#/p=threads&f=67&t=16530575&b=0&a=0"), false);
});

test("a forum id that merely starts with 10 is not Trading Post", () => {
  // The bug this rules out: matching "f=10" as a substring makes f=100 and
  // f=101 read as Trading Post. Torn has no f=100 today, which is exactly why
  // a substring match would survive review and break later.
  assert.equal(ok("#/p=threads&f=100&t=1&b=0&a=0"), false);
  assert.equal(ok("#/p=threads&f=101&t=1&b=0&a=0"), false);
});

test("an id ENDING in 10 is not Trading Post either", () => {
  assert.equal(ok("#/p=threads&f=110&t=1&b=0&a=0"), false);
  assert.equal(ok("#/p=threads&f=210&t=1&b=0&a=0"), false);
});

// ── Nothing to go on ───────────────────────────────────────────

test("a hash with no forum id reads nothing", () => {
  // Fail closed. A link that omits f= could be any forum, and guessing wrong
  // in the permissive direction spends money on a thread nobody wanted read.
  assert.equal(ok("#/p=threads&t=16530575&b=0&a=0"), false);
  assert.equal(ok(""), false);
  assert.equal(ok("#"), false);
});

test("a missing hash reads nothing", () => {
  assert.equal(ok(null), false);
  assert.equal(ok(undefined), false);
});

test("the forum index itself reads nothing", () => {
  assert.equal(ok("#/p=main"), false);
});

// ── The gate is actually wired into both halves ────────────────
// A pure function nothing calls is worth nothing. Both forum readers run
// repeatedly — Torn's forums are a single-page app, so moving between threads
// changes the hash and never reloads — which means the check has to happen on
// every pass, not once at startup.

test("the text parser checks the forum on every pass", () => {
  const i = SRC.indexOf("function ensureForumTables(");
  assert.ok(i > 0);
  const body = SRC.slice(i, i + 900);
  assert.match(body, /var run = function \(\) \{\s*(\/\/[^\n]*\n\s*)*if \(!forumAllowsReads\(/,
    "forumAllowsReads is not the first thing run() does");
});

test("the screenshot reader checks the forum on every pass", () => {
  const i = SRC.indexOf("function scan() {");
  assert.ok(i > 0);
  const body = SRC.slice(i, i + 500);
  assert.match(body, /function scan\(\) \{\s*(\/\/[^\n]*\n\s*)*if \(!forumAllowsReads\(/,
    "forumAllowsReads is not the first thing scan() does");
});

test("neither half is gated only at startup", () => {
  // The shape that would pass the two tests above while still being wrong:
  // checking once outside the loop. Both entry points are reached from a
  // plain forums.php test, and that must stay the only thing they check —
  // the per-pass gate is what handles navigation between threads.
  const calls = SRC.match(/forumAllowsReads\(/g) || [];
  assert.ok(calls.length >= 3,
    "expected a definition plus a call in each half, found " + calls.length);
});
