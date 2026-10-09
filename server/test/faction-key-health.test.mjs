import { test } from "node:test";
import assert from "node:assert/strict";
import { classifyKeyError } from "../faction-key-health.js";

// classifyKeyError is the only thing that can take a faction key out of
// service, so what it calls "broken" is the part worth pinning down. A wrong
// "broken" disables a working key; a wrong "transient" leaves ~15 call sites
// hammering a dead one.

test("persistent key failures are broken", () => {
  for (const code of [1, 2, 6, 10, 13, 14, 16]) {
    assert.equal(classifyKeyError(code), "broken", `code ${code}`);
  }
});

test("Torn-side noise is transient and never quarantines", () => {
  // 17 is the backend error that mis-fired an alert once already; 5 and 8 are
  // rate limit and IP block, which say nothing about the key.
  for (const code of [5, 8, 9, 15, 17]) {
    assert.equal(classifyKeyError(code), "transient", `code ${code}`);
  }
});

test("an unrecognised code is NOT broken", () => {
  // Torn adds codes. Quarantining on one we have never seen would disable a
  // key that works, so anything unclassified falls through to transient.
  for (const code of [3, 4, 7, 11, 12, 18, 19, 99, 1234]) {
    assert.equal(classifyKeyError(code), "unknown", `code ${code}`);
  }
});

test("no code at all is broken", () => {
  // The no-code path is a decrypt failure, which will not fix itself.
  assert.equal(classifyKeyError(null), "broken");
  assert.equal(classifyKeyError(undefined), "broken");
});

test("code 0 is classified, not swallowed by falsiness", () => {
  // 0 is falsy; a `if (!code)` check would have mistaken it for "no code".
  // It is not in either set, so it must read as unknown rather than broken.
  assert.equal(classifyKeyError(0), "unknown");
});
