// Freeing a call when the caller lands their hit.
//
// This logic lived inside the attacks-feed poll, and the poll is gated: if any
// client refreshed enemy status in the last 30s the Torn fetch is skipped.
// During a live war that gate NEVER opens — 53,818 consecutive skips — so the
// auto-uncall never ran for anybody. An optimisation that skipped a fetch took
// an unrelated feature with it, because both lived behind the same gate.
//
// Extracted so the client-reported path and the poll share ONE implementation.
// Two copies of a rule is two chances to fix only one of them.
import { test } from "node:test";
import assert from "node:assert/strict";
import { shouldClearCall, SUCCESS_RESULTS } from "./call-autoclear.js";

const call = (byId) => ({ calledBy: { id: byId, name: "Caller" } });
const atk = (o = {}) => ({
  attacker_id: 100, defender_id: 200, attacker_faction: 42055, result: "Attacked", ...o,
});

test("the caller landing a hit frees the slot", () => {
  assert.equal(shouldClearCall(atk(), call(100), "42055"), true);
});

test("somebody else hitting the target does NOT free it", () => {
  // The caller may still be mid-approach. Clearing here is the bug that was
  // removed in May: the call vanished out from under them and a second person
  // could claim the same target.
  assert.equal(shouldClearCall(atk({ attacker_id: 999 }), call(100), "42055"), false);
});

test("an ENEMY hospitalising the target does NOT free it", () => {
  assert.equal(shouldClearCall(atk({ attacker_id: 777, attacker_faction: 8795 }), call(100), "42055"), false);
});

test("ids compare across string and number", () => {
  // The call stores whatever the client sent; Torn sends numbers. A strict
  // compare here silently never matches, which is indistinguishable from the
  // feature being switched off.
  assert.equal(shouldClearCall(atk({ attacker_id: "100" }), call(100), "42055"), true);
  assert.equal(shouldClearCall(atk({ attacker_id: 100 }), call("100"), 42055), true);
});

test("a failed attack leaves the call alone", () => {
  // They may retry. Losing the fight is not finishing the job.
  for (const r of ["Lost", "Stalemate", "Escape", "Timeout", "Interrupted"]) {
    assert.equal(shouldClearCall(atk({ result: r }), call(100), "42055"), false, r);
  }
});

test("every success result frees it, not just hospitalisation", () => {
  // Mugged/Looted/Attacked mean the caller landed a hit even if the target
  // stayed out of hospital.
  for (const r of SUCCESS_RESULTS) {
    assert.equal(shouldClearCall(atk({ result: r }), call(100), "42055"), true, r);
  }
});

test("no call on that target is not an error", () => {
  assert.equal(shouldClearCall(atk(), null, "42055"), false);
  assert.equal(shouldClearCall(atk(), {}, "42055"), false);
});

test("a malformed attack clears nothing", () => {
  assert.equal(shouldClearCall(null, call(100), "42055"), false);
  assert.equal(shouldClearCall(atk({ attacker_id: null }), call(100), "42055"), false);
});

test("Torn's alternate defender key is accepted", () => {
  // The poll path already tolerated defenderID; the extracted rule must too,
  // or moving it would quietly change behaviour.
  const a = { attacker_id: 100, defenderID: 200, attacker_faction: 42055, result: "Mugged" };
  assert.equal(shouldClearCall(a, call(100), "42055"), true);
});

test("the faction guard stands on its own", () => {
  // Contrived on purpose: an attacker OUTSIDE our faction whose id happens to
  // match the caller's. Every other test rejects enemy attacks on the caller
  // check, so without this one the faction guard is dead weight nobody would
  // notice deleting — and it is the last line against a mis-shaped payload
  // where attacker_id is not one of ours.
  const enemyWithSameId = atk({ attacker_id: 100, attacker_faction: 8795 });
  assert.equal(shouldClearCall(enemyWithSameId, call(100), "42055"), false);
});

test("a missing attacker faction clears nothing", () => {
  // Absent is not "ours". Treating it as a match would let any payload that
  // simply omits the field free a call.
  const noFaction = { attacker_id: 100, defender_id: 200, result: "Attacked" };
  assert.equal(shouldClearCall(noFaction, call(100), "42055"), false);
});
