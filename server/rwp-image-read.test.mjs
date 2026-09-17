// Reading an item card out of a posted screenshot.
//
// Nothing here calls the vision API. What is tested is the logic around it:
// which images are allowed, how a caption changes cache identity, and whether
// the caption is fenced off from the instructions it sits next to.
import { test } from "node:test";
import assert from "node:assert/strict";
import { hostAllowed, cacheKey, hintKey, buildPrompt, cleanHint } from "./rwp-image-read.js";

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
