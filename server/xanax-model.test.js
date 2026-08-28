// The xanax accountability model had NO test, which is how a deliberate change
// to it (faf5952, 2026-08-14 — credit the 150e regen to the first ~6 attacks
// rather than adding it to expected) drifted away from war-history.test.js for
// two weeks without anything saying so.
//
// Characterisation test: it pins behaviour that already exists and is
// intentional, so it passes as written. Its job is to make the NEXT change to
// the model fail loudly here, where the arithmetic lives, instead of silently
// in a caller's fixture.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  expectedAttacks, deficit, flagged,
  XANAX_ENERGY, REGEN_ENERGY, ENERGY_PER_ATTACK, DEFICIT_GRACE, REGEN_ATTACKS,
} from "./xanax-model.js";

test("the constants are the ones the copy quotes", () => {
  assert.equal(XANAX_ENERGY, 250);
  assert.equal(REGEN_ENERGY, 150);
  assert.equal(ENERGY_PER_ATTACK, 25);
  assert.equal(REGEN_ATTACKS, 6);
  assert.equal(DEFICIT_GRACE, 3);
});

test("expected is the VIALS alone — regen is not added to it", () => {
  // This is the half that changed in Aug: expected used to be 10*x + 6.
  assert.equal(expectedAttacks(1), 10);
  assert.equal(expectedAttacks(6), 60);
  assert.equal(expectedAttacks(0), 0);
});

test("the first ~6 attacks are credited to natural regen", () => {
  // The model's own worked example: "2 vials, 6 hits" — those 6 came from the
  // member's own energy, so none of the 20 vialed attacks were delivered.
  assert.equal(deficit(2, 6), 20);
  // And the harsh 0-hit case eases: 2 vials / 0 hits is 20, not 26.
  assert.equal(deficit(2, 0), 20);
});

test("attacks beyond the regen credit count against the vials", () => {
  assert.equal(deficit(2, 16), 10);   // 20 - (16-6)
  assert.equal(deficit(2, 26), 0);    // fully delivered
  assert.equal(deficit(2, 99), 0);    // floors at 0, never negative
});

test("the case war-history freezes: 6 vials, 10 attacks", () => {
  // 60 expected, 4 attacks past the regen credit => 56 short. war-history.test
  // asserted 50 here for a month, from the pre-August formula.
  assert.equal(deficit(6, 10), 56);
});

test("taking nothing is never a deficit and never flagged", () => {
  assert.equal(deficit(0, 0), 0);
  assert.equal(flagged(0, 0), false);
  assert.equal(flagged(0, 1000), false);
});

test("flagging needs the shortfall to clear the grace margin", () => {
  // deficit(1, 13) = 10 - 7 = 3 → exactly the margin, flagged.
  assert.equal(deficit(1, 13), 3);
  assert.equal(flagged(1, 13), true);
  // deficit(1, 14) = 2 → under the margin, noise.
  assert.equal(deficit(1, 14), 2);
  assert.equal(flagged(1, 14), false);
});

test("junk inputs degrade to zero rather than NaN", () => {
  assert.equal(deficit(null, 10), 0);
  assert.equal(deficit(6, null), 60);
  assert.equal(deficit(undefined, undefined), 0);
  assert.equal(expectedAttacks("nonsense"), 0);
});
