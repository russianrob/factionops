// The forum-screenshot script, folded into RW Pricer.
//
// It shipped separately as "RW Pricer — Forum Screenshots" 1.5.6 on
// forums.php alone, reading the item card out of a picture somebody pasted
// into a trade thread. The main script reads TEXT — tables, lines, and the
// server fallback — so the two never overlapped in what they did, only in
// having to be installed and signed into twice.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const SRC = fs.readFileSync(new URL("./public/scripts/torn-rw-pricer.user.js", import.meta.url), "utf8");
const HEAD = SRC.slice(0, SRC.indexOf("==/UserScript=="));

test("the screenshot reader is in the main script now", () => {
  assert.match(SRC, /read-image/, "the image endpoint is not called from here");
});

test("both readers are present and still separate endpoints", () => {
  // Pictures and text are different pipelines and stay that way.
  assert.match(SRC, /\/api\/rwp\/read-image/);
  assert.match(SRC, /\/api\/rwp\/read-text/);
});

test("the screenshot half only runs on forums", () => {
  // The standalone matched forums.php alone; this file matches thirteen
  // patterns. Without a gate it would scan images on every one of them.
  const i = SRC.indexOf("── Forum screenshots ──");
  assert.ok(i > 0, "the merged block is not marked");
  const before = SRC.slice(Math.max(0, i - 200), SRC.indexOf("(function () {", i));
  assert.match(before + SRC.slice(i, i + 1200), /forums\.php/,
    "no forums.php gate around the merged block");
});

test("one sign-in serves both halves", () => {
  // It kept its own GM token key. Running under the host's identity that store
  // is empty, so without this a reader already signed in would be asked again.
  assert.match(SRC, /function token\(\)\s*\{[\s\S]{0,200}warboardToken\(\)/,
    "the merged block does not consult the host's session");
});

test("signing in or out moves both stores together", () => {
  // Otherwise the two halves disagree about who you are.
  assert.match(SRC, /sv\(TOKEN_KEY, d\.token\);\s*\n\s*try \{ safeSet\(WB_TOKEN_KEY, d\.token\)/);
  assert.match(SRC, /safeSet\(WB_TOKEN_KEY, ""\)/, "signing out leaves the host signed in");
});

test("the header still needs nothing new", () => {
  // The standalone asked for GM_xmlhttpRequest, GM_setValue, GM_getValue and
  // tornwar.com — all of which this file already had. A merge that quietly
  // needed a new grant would silently fail for anyone who did not re-approve.
  for (const g of ["GM_xmlhttpRequest", "GM_setValue", "GM_getValue"]) {
    assert.match(HEAD, new RegExp("@grant\\s+" + g), "missing grant " + g);
  }
  assert.match(HEAD, /@connect\s+tornwar\.com/);
});

test("it is a version bump, not a patch", () => {
  assert.match(HEAD, /@version\s+3\.10\./, "folding a script in is not a patch");
});

test("the in-file version matches the header", () => {
  const head = HEAD.match(/@version\s+([0-9.]+)/)[1];
  const inFile = SRC.match(/SCRIPT_VERSION = '([0-9.]+)'/)[1];
  assert.equal(inFile, head);
});

// ── Running both at once ───────────────────────────────────────
// The standalone stays installed on anyone's browser until they remove it, so
// the merged script has to be safe beside it rather than only instead of it.
test("the merged script marks the page for the standalone to see", () => {
  // A DOM marker, not a window flag: two userscripts get two sandboxes and
  // share one document.
  assert.match(SRC, /dataset\.rwpForumMerged\s*=\s*'1'/);
});

test("the standalone stands down when it sees that marker", () => {
  const OLD = fs.readFileSync(new URL("./public/scripts/torn-rwp-forum.user.js", import.meta.url), "utf8");
  assert.match(OLD, /rwpForumMerged/, "the standalone cannot tell");
  assert.match(OLD, /function scan\(\)\s*\{\s*\n\s*if \(mergedElsewhere\(\)\) return;/,
    "it checks somewhere other than the pass that does the work");
});

test("it checks every pass, not once at startup", () => {
  // Both run at document-idle and neither is guaranteed to go first, so a
  // single startup check loses the race half the time.
  const OLD = fs.readFileSync(new URL("./public/scripts/torn-rwp-forum.user.js", import.meta.url), "utf8");
  const i = OLD.indexOf("function mergedElsewhere()");
  const scanAt = OLD.indexOf("function scan()");
  assert.ok(i > 0 && scanAt > i, "the guard must be in scan(), which reruns");
});

test("the standalone says it has been superseded", () => {
  const OLD = fs.readFileSync(new URL("./public/scripts/torn-rwp-forum.user.js", import.meta.url), "utf8");
  assert.match(OLD, /@description\s+MERGED INTO RW PRICER/);
});
