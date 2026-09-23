// Stop re-asking Torn about a key it has already refused.
//
// One key failed 945 times and another 127 — each attempt a Torn request
// against the faction's rate limit and a line in the error log. Torn's code 2
// means "Incorrect key": the string is wrong, and retrying cannot make it
// right. Nothing was remembering that.
import { test } from "node:test";
import assert from "node:assert/strict";
import { fingerprint, note, blocked, reset, THRESHOLD, COOLDOWN_MS } from "./bad-key-gate.js";

const NOW = 1_800_000_000_000;
const KEY = "aaaaaaaaaaaaHcRk";

test.beforeEach(() => reset());

test("a fingerprint is a hash, never the key", () => {
  const fp = fingerprint(KEY);
  assert.notEqual(fp, KEY);
  assert.ok(!fp.includes(KEY));
  assert.ok(fp.length >= 16);
  assert.equal(fingerprint(KEY), fp, "same key must map to the same fingerprint");
});

test("one refusal is not enough to block", () => {
  // People mistype. A single failure is a typo, not a loop.
  note(KEY, 2, NOW);
  assert.equal(blocked(KEY, NOW).blocked, false);
});

test("repeated refusals of the SAME key block it", () => {
  for (let i = 0; i < THRESHOLD; i++) note(KEY, 2, NOW + i);
  const b = blocked(KEY, NOW + 10);
  assert.equal(b.blocked, true);
  assert.match(b.reason, /rejected/i);
});

test("a different key is unaffected, so fixing it works immediately", () => {
  // The whole point: the block follows the bad string, not the person. Paste a
  // good key and it authenticates on the first try.
  for (let i = 0; i < THRESHOLD; i++) note(KEY, 2, NOW + i);
  assert.equal(blocked("bbbbbbbbbbbbGOOD", NOW + 10).blocked, false);
});

test("transient errors never accumulate toward a block", () => {
  // Rate limits (5) and Torn backend errors (17) say nothing about the key.
  // Counting them would lock people out during a Torn outage — precisely when
  // they can least afford it.
  for (let i = 0; i < THRESHOLD * 3; i++) note(KEY, 5, NOW + i);
  for (let i = 0; i < THRESHOLD * 3; i++) note(KEY, 17, NOW + i);
  assert.equal(blocked(KEY, NOW).blocked, false);
});

test("access-level failures do not block either", () => {
  // Code 16 is a real key with the wrong permissions. The person can fix that
  // by changing the key's access level in Torn, keeping the same key string.
  for (let i = 0; i < THRESHOLD * 3; i++) note(KEY, 16, NOW + i);
  assert.equal(blocked(KEY, NOW).blocked, false);
});

test("the block expires, so nobody is locked out forever", () => {
  // The cooldown starts from the LAST refusal, which the loop places at
  // NOW + THRESHOLD - 1 — so the window is measured from there, not from NOW.
  for (let i = 0; i < THRESHOLD; i++) note(KEY, 2, NOW + i);
  const last = NOW + THRESHOLD - 1;
  assert.equal(blocked(KEY, last + COOLDOWN_MS - 1).blocked, true);
  assert.equal(blocked(KEY, last + COOLDOWN_MS + 1).blocked, false);
});

test("a success clears the record", () => {
  for (let i = 0; i < THRESHOLD - 1; i++) note(KEY, 2, NOW + i);
  note(KEY, 0, NOW + 5);
  note(KEY, 2, NOW + 6);
  assert.equal(blocked(KEY, NOW + 7).blocked, false, "the counter should have restarted");
});

test("the reason says how many times and for how long", () => {
  // A message that just says "blocked" sends somebody to ask an admin. One
  // that says what happened sends them to their API key page.
  for (let i = 0; i < THRESHOLD; i++) note(KEY, 2, NOW + i);
  const b = blocked(KEY, NOW + 10);
  assert.match(b.reason, new RegExp(String(THRESHOLD)));
  assert.match(b.reason, /new key|fresh|regenerat/i);
});

test("an empty key is not tracked", () => {
  note("", 2, NOW); note("", 2, NOW); note("", 2, NOW);
  assert.equal(blocked("", NOW).blocked, false);
});
