// The fetching needs Torn; the arithmetic does not. These cover the part that
// decides what a member's chain-hit number actually is.
import { test } from "node:test";
import assert from "node:assert/strict";
import { sumHits } from "./chain-hits.js";

const DAY = 86400000;
const NOW = 1788800000000;
const chain = (startMs, byPlayer) => ({ start: Math.floor(startMs / 1000), byPlayer });

test("hits and chains joined add up across chains", () => {
  const out = sumHits([
    chain(NOW - 2 * DAY, { 1: 40, 2: 5 }),
    chain(NOW - 3 * DAY, { 1: 12 }),
  ], NOW - 90 * DAY, NOW);
  assert.deepEqual(out["1"], { hits: 52, chains: 2 });
  assert.deepEqual(out["2"], { hits: 5, chains: 1 });
});

test("a chain that started before the window is not counted", () => {
  const out = sumHits([
    chain(NOW - 100 * DAY, { 1: 500 }),
    chain(NOW - 10 * DAY, { 1: 20 }),
  ], NOW - 90 * DAY, NOW);
  assert.deepEqual(out["1"], { hits: 20, chains: 1 });
});

test("a zero-hit attacker does not count as a chain joined", () => {
  const out = sumHits([chain(NOW - DAY, { 1: 0, 2: 3 })], NOW - 90 * DAY, NOW);
  assert.equal(out["1"], undefined);
  assert.deepEqual(out["2"], { hits: 3, chains: 1 });
});

test("no chains is an empty object, not a throw", () => {
  assert.deepEqual(sumHits([], NOW - 90 * DAY, NOW), {});
  assert.deepEqual(sumHits(null, NOW - 90 * DAY, NOW), {});
});
