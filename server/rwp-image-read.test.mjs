// Reading an item card out of a posted screenshot.
//
// Nothing here calls the vision API. What is tested is the logic around it:
// which images are allowed, how a caption changes cache identity, and whether
// the caption is fenced off from the instructions it sits next to.
import { test } from "node:test";
import assert from "node:assert/strict";
import { hostAllowed, cacheKey, hintKey, buildPrompt, cleanHint, PROMPT_VERSION, usableRead } from "./rwp-image-read.js";

const URL1 = "https://editor.torn.com/a78795b3-1de5-4aa6-bc33-e62f2d5dc822-4154995.png";

test("only https, only known image hosts", () => {
  assert.equal(hostAllowed(URL1), true);
  assert.equal(hostAllowed("http://editor.torn.com/x.png"), false, "plain http is never allowed");
  assert.equal(hostAllowed("https://evil.example.com/x.png"), false);
});

test("a caption changes cache identity", () => {
  // Without this, the cached failure from the un-hinted read would be served
  // back forever and a hint could never take effect on the one image that
  // needed it.
  const plain = cacheKey(URL1);
  const hinted = cacheKey(URL1, "Kodachi - 53% parry");
  assert.notEqual(plain, hinted);
  assert.equal(cacheKey(URL1, "Kodachi - 53% parry"), hinted, "the same caption must hit the same slot");
  assert.equal(cacheKey(URL1, ""), plain, "an empty caption is no caption");
  assert.equal(cacheKey(URL1, "   "), plain, "whitespace is no caption");
});

test("captions that differ only in spacing share a slot", () => {
  assert.equal(hintKey("Kodachi - 53% parry"), hintKey("  Kodachi   -  53% parry "));
  assert.notEqual(hintKey("Kodachi"), hintKey("Mag 7"));
});

test("a caption is capped and stripped of control characters", () => {
  const esc = String.fromCharCode(27);
  const c = cleanHint("Kodachi " + esc + "[31m - 53% parry" + String.fromCharCode(10) + "second line");
  assert.ok(!/[\x00-\x1F]/.test(c), "control characters must not reach the prompt");
  assert.match(c, /Kodachi/);
  assert.ok(cleanHint("x".repeat(5000)).length <= 300, "a caption is capped");
});

test("the caption is fenced, marked untrusted, and cannot license a number", () => {
  const p = buildPrompt("Kodachi - 53% parry");
  assert.match(p, /Kodachi - 53% parry/, "the caption must actually be in there");
  // Forum text is written by strangers. It gets to supply a NAME and nothing
  // else, and the prompt has to say so, or a caption becomes an instruction.
  assert.match(p, /untrusted/i);
  assert.match(p, /never/i);
  assert.ok(p.indexOf("Kodachi - 53% parry") > p.indexOf("Rules:"),
    "the caption must come after the rules, not before them");
});

test("with no caption the prompt is unchanged", () => {
  const bare = buildPrompt("");
  assert.ok(!/untrusted/i.test(bare), "no caption, no caption section");
  assert.equal(bare, buildPrompt(), "absent and empty behave alike");
});

test("a reading made by an older prompt is not reused", () => {
  // The prompt gained a "buy" field so a cropped card could be identified by
  // its shop price. Every reading cached before that lacks the field, and
  // without the version in the key those stale answers would be served forever
  // and the new field would never reach the images that needed it -- the same
  // trap the caption keying already closed.
  assert.notEqual(cacheKey(URL1, "", 1), cacheKey(URL1, "", 2));
  assert.equal(cacheKey(URL1, "", 2), cacheKey(URL1, "", 2));
  assert.equal(cacheKey(URL1), cacheKey(URL1, "", PROMPT_VERSION),
    "the default must be the current prompt version");
});

test("armour statistics are ruled out as bonuses", () => {
  // An Assault Body came back carrying "46.47% Armor" and "45.55% Coverage" as
  // bonuses. Both are written as percentages and neither is a bonus.
  const p = buildPrompt("");
  assert.match(p, /Bonus:/);
  assert.match(p, /Coverage/);
  assert.match(p, /never return those as bonuses/i);
});

// ── Both halves of the cache expire together ───────────────────
// Every reading is stored twice: once under the URL, once under the SHA-256 of
// the image bytes so a reposted screenshot does not cost a second vision call.
// readCache enforced the 90 days and the body lookup did not — it wrote a
// timestamp and never read it. So a stale URL entry triggered a re-FETCH, the
// body hash matched, and the original reading was served anyway. A reading
// effectively lived forever, and a misread card stayed misread indefinitely.
import fs from "node:fs";
import path from "node:path";
import { readBodyCache, writeBodyCache, bodyFileFor, RETAIN_MS } from "./rwp-image-read.js";

const SHA = "f".repeat(64);
const clean = () => { try { fs.unlinkSync(bodyFileFor(SHA, "")); } catch {} };

test("a fresh body-cache entry is served", (t) => {
  t.after(clean);
  writeBodyCache(SHA, { name: "SIG 552" }, "", Date.now());
  // One shape for every answer: null means "nothing usable here", and an
  // envelope means "this is the answer", even when the answer is that the
  // picture could not be read.
  assert.deepEqual(readBodyCache(SHA, ""), { item: { name: "SIG 552" } });
});

test("a body-cache entry past the retention window is not", (t) => {
  t.after(clean);
  writeBodyCache(SHA, { name: "SIG 552" }, "", Date.now() - RETAIN_MS - 1000);
  assert.equal(readBodyCache(SHA, ""), null, "an expired reading must not be reused");
});

test("the boundary is inclusive of the window, not past it", (t) => {
  t.after(clean);
  writeBodyCache(SHA, { name: "SIG 552" }, "", Date.now() - RETAIN_MS + 60000);
  assert.deepEqual(readBodyCache(SHA, ""), { item: { name: "SIG 552" } }, "still inside 90 days");
});

test("a cached null is honoured while fresh and dropped when stale", (t) => {
  // An unreadable picture is a RESULT and is cached so it is not re-read on
  // every page load. It has to expire like anything else, or a card that was
  // once unreadable never gets another chance.
  t.after(clean);
  writeBodyCache(SHA, null, "", Date.now());
  const fresh = readBodyCache(SHA, "");
  assert.ok(fresh && fresh.item === null, "a fresh null is a real answer: " + JSON.stringify(fresh));
  writeBodyCache(SHA, null, "", Date.now() - RETAIN_MS - 1000);
  assert.equal(readBodyCache(SHA, ""), null, "a stale null must not be reused");
});

test("a missing entry reads as missing, not as an error", () => {
  clean();
  assert.equal(readBodyCache("0".repeat(64), ""), null);
});

test("the prompt forbids inventing a name the card does not show", () => {
  // Two cached reads came back "Big Al's Gun Shop Katana" and "Big Al's Gun
  // Shop Adjuster" — the SELL SHOP welded to what the picture looked like,
  // both marked confident. Re-reading those under the same prompt would
  // reproduce them exactly, so clearing the cache is only worth paying for if
  // the rule that let them through is gone too.
  const p = buildPrompt("");
  assert.match(p, /Sell:/, "the sell shop is the text it keeps stealing");
  assert.match(p, /\bnull\b/);
  assert.ok(/never invent|do not invent|rather than invent/i.test(p),
    "the prompt must forbid it outright: " + p);
});

test("a nameless card is kept when its shop price can name it", () => {
  // The name rule works: a cropped card now returns name:null instead of
  // inventing one. But the reader also drops to confident:false, and the old
  // discard rule threw the whole reading away — including the buy price that
  // identifies the weapon outright. $95,000 is a Kodachi and nothing else;
  // $20,000,000 is an ArmaLite M-15A4 and nothing else.
  assert.equal(usableRead({ name: null, buy: 95000, confident: false,
    bonuses: [{ name: "Parry", pct: 53 }] }), true);
  assert.equal(usableRead({ name: "Kodachi", confident: true, bonuses: [] }), true);
});

test("a reading with neither a name nor a price is not kept", () => {
  assert.equal(usableRead({ name: null, buy: null, confident: false, bonuses: [] }), false);
  assert.equal(usableRead({ confident: false }), false);
  assert.equal(usableRead(null), false);
});

test("an explicit refusal on a named card is still a refusal", () => {
  // confident:false with a name means the reader doubted what it read, which
  // is different from having nothing to name it with.
  assert.equal(usableRead({ name: "Kodachi", confident: false, bonuses: [] }), false);
});
