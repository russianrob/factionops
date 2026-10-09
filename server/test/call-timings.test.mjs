import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CALL_EXPIRE_MS,
  DEAL_EXPIRE_MS,
  expiryFor,
  remainingFor,
} from "../call-timings.js";

const MIN = 60 * 1000;

test("a regular call runs 20 minutes, a deal call 2 hours", () => {
  assert.equal(CALL_EXPIRE_MS, 20 * MIN);
  assert.equal(DEAL_EXPIRE_MS, 120 * MIN);
  assert.equal(expiryFor({ isDeal: false }), 20 * MIN);
  assert.equal(expiryFor({ isDeal: true }), 120 * MIN);
  // Anything unrecognisable is a regular call, not an unbounded one.
  assert.equal(expiryFor(undefined), 20 * MIN);
  assert.equal(expiryFor({}), 20 * MIN);
});

test("remainingFor returns the rest of the term, not a fresh one", () => {
  const now = 1_700_000_000_000;
  // Placed 5 minutes ago: 15 left, NOT another full 20. A restart must not
  // silently extend every open claim on the board.
  assert.equal(remainingFor({ timestamp: now - 5 * MIN }, now), 15 * MIN);
  assert.equal(remainingFor({ timestamp: now - 19 * MIN }, now), 1 * MIN);
  // A deal call keeps its two hours and is measured against that.
  assert.equal(remainingFor({ isDeal: true, timestamp: now - 70 * MIN }, now), 50 * MIN);
});

test("remainingFor goes <= 0 for a call that lapsed while we were down", () => {
  const now = 1_700_000_000_000;
  assert.equal(remainingFor({ timestamp: now - 20 * MIN }, now), 0);
  assert.ok(remainingFor({ timestamp: now - 45 * MIN }, now) < 0);
  // A deal call is NOT overdue at 45 minutes — it had two hours.
  assert.ok(remainingFor({ isDeal: true, timestamp: now - 45 * MIN }, now) > 0);
});

test("an undateable call gets a full term rather than being dropped", () => {
  const now = 1_700_000_000_000;
  // Dropping a call we cannot date hands a live target to a second attacker;
  // keeping it merely means it expires a bit late.
  assert.equal(remainingFor({}, now), CALL_EXPIRE_MS);
  assert.equal(remainingFor({ timestamp: 0 }, now), CALL_EXPIRE_MS);
  assert.equal(remainingFor({ timestamp: null }, now), CALL_EXPIRE_MS);
  assert.equal(remainingFor({ timestamp: "not a number" }, now), CALL_EXPIRE_MS);
  assert.equal(remainingFor({ isDeal: true }, now), DEAL_EXPIRE_MS);
});

test("a clock that disagrees with itself does not produce an immortal call", () => {
  const now = 1_700_000_000_000;
  // A future timestamp would yield MORE than a full term. Capped by the
  // scheduler's own Math.max/term logic, but assert the shape here so a
  // future reader sees it was considered.
  const r = remainingFor({ timestamp: now + 10 * MIN }, now);
  assert.ok(r > CALL_EXPIRE_MS, "future-dated call reads as longer than a term");
  assert.ok(r <= CALL_EXPIRE_MS + 10 * MIN);
});
