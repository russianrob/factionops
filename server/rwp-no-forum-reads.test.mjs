// RW Pricer does not send forum posts anywhere to be read.
//
// Two readers used to run on the forum's Trading Post. A post the local
// parsers could not read was sent to warboard as text, and a pasted
// screenshot was sent as an image. An AI model read both on the server, and
// every read cost money. The owner asked for both to go ("its too much"), so
// they are gone, with the warboard sign-in that existed only for them.
//
// What stays is everything that costs nothing per read: forum tables and
// lines are priced in the browser from the daily price file, and the trade
// page asks Torn's own API, with the player's key, for a weapon's bonuses.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const SRC = fs.readFileSync(new URL("./public/scripts/torn-rw-pricer.user.js", import.meta.url), "utf8");
const META = fs.readFileSync(new URL("./public/scripts/torn-rw-pricer.meta.js", import.meta.url), "utf8");
const HEAD = SRC.slice(0, SRC.indexOf("==/UserScript=="));

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

test("nothing is sent to warboard to be read", () => {
  for (const url of ["/api/rwp/read-text", "/api/rwp/read-image", "/api/auth"]) {
    assert.ok(!SRC.includes(url), "still calls " + url);
  }
});

test("the reader code is gone, not just unplugged", () => {
  // A helper left behind with no caller is what a half-done removal looks
  // like. Each of these existed only to send a post, sign in for it, or place
  // the answer that came back.
  const gone = ["askServerToRead", "warboardSignIn", "warboardToken", "WB_TOKEN_KEY",
    "textAsked", "placeReadItems", "readItemTitle", "matchReadItem", "countReadMatches",
    "readItemFits", "MAX_READ_LINE", "looksLikeStock", "stockContainerFor", "rwpf_token",
    "Forum screenshots"];
  const left = gone.filter((name) => SRC.includes(name));
  assert.deepEqual(left, [], "still in the script: " + left.join(", "));
});

test("the description no longer promises screenshots", () => {
  const d = HEAD.match(/@description\s+(.*)/)[1];
  assert.ok(!/screenshot/i.test(d), d);
});

test("the free forum badges still run on every pass", () => {
  const body = fn("ensureForumTables");
  assert.match(body, /if \(!forumAllowsReads\(location\.hash\)\) return;/);
  assert.match(body, /injectForumTables\(\)/);
  assert.match(body, /injectForumLines\(\)/);
});

test("the trade page still gets bonuses from Torn's own API", () => {
  // The add-items picker shows no bonuses, so each weapon's are fetched once
  // from Torn with the player's key. That call goes to Torn, not to warboard.
  const body = fn("fetchUidDetails");
  assert.match(body, /https:\/\/api\.torn\.com\/v2\/torn\//);
  assert.match(body, /\/itemdetails/);
  assert.ok(SRC.includes("uidBonusesFor("), "nothing asks for a weapon's bonuses any more");
});

// ── The old standalone screenshot reader ───────────────────────
// "RW Pricer — Forum Screenshots" was a separate script before it was folded
// into this one, and it stays installed on anyone's browser until they remove
// it. It stands down while it sees this script's marker on the page, so the
// marker stays: without it, anyone still running the standalone would start
// sending screenshots to be read again.

test("this script still marks forum pages for the standalone to see", () => {
  // A DOM marker, not a window flag: two userscripts get two sandboxes and
  // share one document.
  const i = SRC.indexOf("dataset.rwpForumMerged = '1'");
  assert.ok(i > 0, "the marker is gone");
  assert.match(SRC.slice(Math.max(0, i - 600), i), /location\.href\.indexOf\('forums\.php'\) !== -1/,
    "the marker is not gated to forum pages");
});

test("the standalone stands down when it sees that marker", () => {
  const OLD = fs.readFileSync(new URL("./public/scripts/torn-rwp-forum.user.js", import.meta.url), "utf8");
  assert.match(OLD, /rwpForumMerged/, "the standalone cannot tell");
  assert.match(OLD, /function scan\(\)\s*\{\s*\n\s*if \(mergedElsewhere\(\)\) return;/,
    "it checks somewhere other than the pass that does the work");
});

// ── Version ───────────────────────────────────────────────────

test("the version moved forward in all three places", () => {
  const head = HEAD.match(/@version\s+([0-9.]+)/)[1];
  const inFile = SRC.match(/SCRIPT_VERSION = '([0-9.]+)'/)[1];
  const meta = META.match(/@version\s+([0-9.]+)/)[1];
  assert.equal(inFile, head);
  assert.equal(meta, head);
  const [maj, min] = head.split(".").map(Number);
  assert.ok(maj > 3 || (maj === 3 && min >= 14),
    "taking two features out is a minor bump, not a patch; this is " + head);
});

test("the meta file mirrors the header", () => {
  // Script managers check the meta file for updates, so any drift there is an
  // update nobody is offered.
  const end = "// ==/UserScript==";
  const block = SRC.slice(SRC.indexOf("// ==UserScript=="), SRC.indexOf(end) + end.length);
  assert.equal(META.trim(), block.trim());
});
