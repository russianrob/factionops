// When to warn that a chain bonus is coming.
//
// The old rule fired only if the chain was OBSERVED at exactly bonus-1 or
// bonus-2. Measured over one war day, a third of observations jump 3+ hits:
//
//   1 hit: 73×   2: 47×   3: 19×   4: 24×   5+: 16×
//
// So the window was routinely stepped straight over — and most often during a
// fast chain, which is exactly when the warning is worth having.
import { test } from "node:test";
import assert from "node:assert/strict";
import { bonusToAnnounce, APPROACH } from "./chain-bonus.js";

test("warns on entering the approach zone", () => {
  // 243 -> 247 crosses into range of the 250 bonus. The old rule saw 247,
  // decided 3 > 2, and said nothing.
  assert.equal(bonusToAnnounce(243, 247, null), 250);
});

test("a big jump into the zone still warns", () => {
  assert.equal(bonusToAnnounce(240, 246, null), 250);
});

test("warns only once per bonus", () => {
  // Every hit from 246 to 249 would otherwise re-fire. Four notifications for
  // one bonus trains people to ignore them.
  assert.equal(bonusToAnnounce(246, 247, 250), null);
  assert.equal(bonusToAnnounce(247, 248, 250), null);
});

test("a chain that jumps clean past the bonus says nothing", () => {
  // 243 -> 252 means the bonus already happened. A warning after the fact is
  // noise, and worse, it implies there is still something to do.
  assert.equal(bonusToAnnounce(243, 252, null), null);
});

test("already past the zone start but below the bonus still warns once", () => {
  // Joining mid-approach: the first observation lands at 248 with no prior.
  assert.equal(bonusToAnnounce(244, 248, null), 250);
});

test("nothing to say far from a bonus", () => {
  assert.equal(bonusToAnnounce(200, 210, null), null);
});

test("the next bonus is announced after the last one passes", () => {
  // Past 250, the next target is 500 — and 253 is nowhere near it.
  assert.equal(bonusToAnnounce(250, 253, 250), null);
});

test("small chains use the small bonuses", () => {
  assert.equal(bonusToAnnounce(3, 6, null), 10);
  assert.equal(bonusToAnnounce(20, 21, null), 25);
});

test("a chain going backwards never warns", () => {
  // Chains do not shrink, but a stale snapshot arriving late can look like it.
  // These two land outside the approach zone anyway, so they do not on their
  // own prove the guard does anything.
  assert.equal(bonusToAnnounce(250, 240, null), null);
  assert.equal(bonusToAnnounce(100, 0, null), null);
});

test("a backwards step INTO the zone is still silent", () => {
  // The case that isolates the guard: 260 -> 247 puts the count three away
  // from the 250 bonus, so every other check would pass it. Only "a chain
  // cannot go backwards" rejects it — a late snapshot must not announce a
  // bonus the chain already went through.
  assert.equal(bonusToAnnounce(260, 247, null), null);
});

test("the zone is wide enough to act on", () => {
  // Two hits was not: at four hits per observation the window was invisible.
  assert.ok(APPROACH >= 4, `approach of ${APPROACH} is too narrow to observe`);
});
