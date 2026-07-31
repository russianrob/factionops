import test from "node:test";
import assert from "node:assert/strict";
import { normalizeChainData, chainWithLiveTimeout, chainHashKey } from "./chain-data.js";

// Torn reports the chain as `timeout` — SECONDS REMAINING — which decrements
// every second. Storing that verbatim made war.chainData change on every write,
// which bumped the long-poll version every tick and released the held poll of
// every faction member at once: a faction-wide radio wakeup once per second.
// We store the ABSOLUTE end instant instead, which is stable between real
// events, and recompute `timeout` only when a payload goes out.

const T0 = 1_785_000_000_000; // fixed clock for determinism

test("normalize: timeout becomes an absolute end instant, volatile fields dropped", () => {
  const out = normalizeChainData({ current: 2, max: 10, timeout: 250, cooldown: 0, timestamp: 0 }, T0);
  assert.equal(out.chainEndsAt, T0 + 250_000);
  assert.equal(out.current, 2);
  assert.equal(out.max, 10);
  assert.equal(out.cooldown, 0);
  assert.ok(!("timeout" in out), "stored form must not carry the decrementing value");
  assert.ok(!("timestamp" in out), "stored form must not carry a per-write timestamp");
});

test("normalize: same chain one second later stores an IDENTICAL object", () => {
  // The whole point: a re-poll mid-chain must not change stored bytes.
  const a = normalizeChainData({ current: 2, max: 10, timeout: 250, cooldown: 0 }, T0);
  const b = normalizeChainData({ current: 2, max: 10, timeout: 249, cooldown: 0 }, T0 + 1000);
  assert.equal(JSON.stringify(chainHashKey(a)), JSON.stringify(chainHashKey(b)));
});

test("normalize: a real event (a hit lands) DOES change the stored form", () => {
  const a = normalizeChainData({ current: 2, max: 10, timeout: 250, cooldown: 0 }, T0);
  const b = normalizeChainData({ current: 3, max: 10, timeout: 300, cooldown: 0 }, T0 + 1000);
  assert.notEqual(JSON.stringify(chainHashKey(a)), JSON.stringify(chainHashKey(b)));
});

test("normalize: small clock jitter on the same chain does not churn the hash", () => {
  // Two members push the same chain a few hundred ms apart; their computed
  // end instants differ slightly. Without bucketing that alone would bump the
  // version for the whole faction.
  const a = normalizeChainData({ current: 5, max: 10, timeout: 200, cooldown: 0 }, T0);
  const b = normalizeChainData({ current: 5, max: 10, timeout: 200, cooldown: 0 }, T0 + 700);
  assert.equal(JSON.stringify(chainHashKey(a)), JSON.stringify(chainHashKey(b)));
});

test("normalize: passes through data that has no timeout, and tolerates junk", () => {
  assert.equal(normalizeChainData(null, T0), null);
  assert.equal(normalizeChainData(undefined, T0), undefined);
  const noTimeout = normalizeChainData({ current: 1, max: 10 }, T0);
  assert.equal(noTimeout.current, 1);
  assert.ok(!("chainEndsAt" in noTimeout), "cannot invent an end instant without a timeout");
  const junk = normalizeChainData({ current: 1, timeout: "soon" }, T0);
  assert.ok(!("chainEndsAt" in junk), "non-numeric timeout must not produce NaN");
});

test("normalize: an already-normalized object is left alone (idempotent)", () => {
  const once = normalizeChainData({ current: 2, max: 10, timeout: 250 }, T0);
  const twice = normalizeChainData(once, T0 + 5000);
  assert.equal(twice.chainEndsAt, once.chainEndsAt, "re-normalizing must not shift the deadline");
});

test("live timeout: recomputed from the absolute end so old clients still work", () => {
  const stored = normalizeChainData({ current: 2, max: 10, timeout: 250, cooldown: 0 }, T0);
  assert.equal(chainWithLiveTimeout(stored, T0).timeout, 250);
  assert.equal(chainWithLiveTimeout(stored, T0 + 100_000).timeout, 150);
  assert.equal(chainWithLiveTimeout(stored, T0 + 250_000).timeout, 0);
  assert.equal(chainWithLiveTimeout(stored, T0 + 999_000).timeout, 0, "never negative");
});

test("live timeout: keeps chainEndsAt so new clients can count down locally", () => {
  const stored = normalizeChainData({ current: 2, max: 10, timeout: 250 }, T0);
  const out = chainWithLiveTimeout(stored, T0 + 10_000);
  assert.equal(out.chainEndsAt, stored.chainEndsAt);
  assert.equal(out.current, 2);
});

test("live timeout: does not mutate the stored object", () => {
  const stored = normalizeChainData({ current: 2, max: 10, timeout: 250 }, T0);
  const before = JSON.stringify(stored);
  chainWithLiveTimeout(stored, T0 + 50_000);
  assert.equal(JSON.stringify(stored), before, "storage must stay stable — that IS the fix");
});

test("live timeout: legacy rows without chainEndsAt pass through untouched", () => {
  const legacy = { current: 4, max: 10, timeout: 99 };
  assert.deepEqual(chainWithLiveTimeout(legacy, T0), legacy);
  assert.equal(chainWithLiveTimeout(null, T0), null);
});

// serverTimestamp is a per-push epoch-seconds stamp used by
// recordClientChainData for staleness ordering. It must survive in storage
// (the comparison needs it) but must NOT reach the hash — it changes every
// second, which alone would keep bumping the version and defeat the fix.
test("hash key ignores serverTimestamp but storage keeps it", () => {
  const a = normalizeChainData({ current: 5, max: 10, timeout: 200, serverTimestamp: 1785000000 }, T0);
  const b = normalizeChainData({ current: 5, max: 10, timeout: 200, serverTimestamp: 1785000001 }, T0);
  assert.equal(a.serverTimestamp, 1785000000, "storage must retain it for staleness checks");
  assert.equal(
    JSON.stringify(chainHashKey(a)),
    JSON.stringify(chainHashKey(b)),
    "a one-second stamp bump must not count as a change",
  );
});

test("hash key still reacts when the chain itself moves", () => {
  const a = normalizeChainData({ current: 5, max: 10, timeout: 200, serverTimestamp: 1785000000 }, T0);
  const b = normalizeChainData({ current: 6, max: 10, timeout: 300, serverTimestamp: 1785000001 }, T0);
  assert.notEqual(JSON.stringify(chainHashKey(a)), JSON.stringify(chainHashKey(b)));
});

// With no chain running Torn reports timeout: 0. Deriving "now + 0" from that
// produced a deadline that advanced on every poll, so an IDLE faction still
// bumped the version (and woke every member) every ~10s. There is no deadline
// when there is no chain — record 0 and let the row go completely quiet.
test("no active chain records a stable sentinel, not a moving 'now'", () => {
  const a = normalizeChainData({ current: 0, max: 10, timeout: 0, cooldown: 0 }, T0);
  const b = normalizeChainData({ current: 0, max: 10, timeout: 0, cooldown: 0 }, T0 + 60_000);
  assert.equal(a.chainEndsAt, 0);
  assert.equal(JSON.stringify(a), JSON.stringify(b), "idle chain must be byte-identical over time");
  assert.equal(JSON.stringify(chainHashKey(a)), JSON.stringify(chainHashKey(b)));
});

test("no active chain still reports timeout 0 to old clients", () => {
  const idle = normalizeChainData({ current: 0, max: 10, timeout: 0 }, T0);
  assert.equal(chainWithLiveTimeout(idle, T0 + 500_000).timeout, 0);
});

test("a chain starting after idle produces a real deadline again", () => {
  const idle = normalizeChainData({ current: 0, max: 10, timeout: 0 }, T0);
  const live = normalizeChainData({ current: 1, max: 10, timeout: 300 }, T0 + 1000);
  assert.equal(live.chainEndsAt, T0 + 1000 + 300_000);
  assert.notEqual(JSON.stringify(chainHashKey(idle)), JSON.stringify(chainHashKey(live)));
});
