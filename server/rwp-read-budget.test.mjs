// The budget that replaces the membership gate on the AI readers.
import { test } from "node:test";
import assert from "node:assert/strict";
import { take, peek, _reset, PER_KEY_HOURLY, GLOBAL_HOURLY, budgetKey } from "./rwp-read-budget.js";

test("an ordinary caller is allowed through", () => {
  _reset();
  assert.equal(take("1.2.3.4"), null);
});

test("a caller is cut off at their hourly limit", () => {
  _reset();
  for (let i = 0; i < PER_KEY_HOURLY; i++) assert.equal(take("1.2.3.4"), null, "refused at " + i);
  const d = take("1.2.3.4");
  assert.ok(d, "no limit at all");
  assert.equal(d.scope, "ip");
});

test("and the refusal says the cached ones still work", () => {
  // The distinction matters: browsing a thread somebody has already read costs
  // nothing and keeps working. Saying only "rate limited" would read as broken.
  _reset();
  for (let i = 0; i < PER_KEY_HOURLY; i++) take("1.2.3.4");
  assert.match(take("1.2.3.4").error, /already-read/i);
});

test("one caller running out does not block another", () => {
  _reset();
  for (let i = 0; i < PER_KEY_HOURLY; i++) take("1.2.3.4");
  assert.equal(take("5.6.7.8"), null);
});

test("the window rolls", () => {
  _reset();
  const t0 = 1_000_000_000;
  for (let i = 0; i < PER_KEY_HOURLY; i++) take("1.2.3.4", t0);
  assert.ok(take("1.2.3.4", t0 + 60_000), "cut off inside the hour");
  assert.equal(take("1.2.3.4", t0 + 3_600_001), null, "still cut off after it");
});

test("the global ceiling catches what per-IP cannot", () => {
  // Many callers at once is the shape no per-IP limit can see.
  _reset();
  const t0 = 2_000_000_000;
  let refusals = 0;
  for (let n = 0; n < GLOBAL_HOURLY + 50; n++) {
    if (take("10.0." + Math.floor(n / 10) + "." + (n % 10), t0)) refusals++;
  }
  assert.ok(refusals > 0, "no global ceiling");
  assert.equal(take("99.99.99.99", t0).scope, "global");
});

test("a missing ip is still counted, not waved through", () => {
  _reset();
  for (let i = 0; i < PER_KEY_HOURLY; i++) assert.equal(take(undefined), null);
  assert.ok(take(undefined), "an unknown caller had no limit");
});

test("peek reports without spending", () => {
  _reset();
  take("1.2.3.4");
  const before = peek("1.2.3.4");
  peek("1.2.3.4");
  assert.equal(peek("1.2.3.4").ip, before.ip);
});

// ── Who a read is charged to ───────────────────────────────────
// An IP is a poor identity for this population: a faction behind one NAT, or
// anyone on mobile carrier CGNAT, shares it — nginx's own rate limit was
// raised once for exactly that reason. A signed-in caller gets charged to
// their player id so one heavy member cannot lock out their whole household.
test("a signed-in caller is charged to their player, not their address", () => {
  assert.equal(budgetKey("1.2.3.4", "137558"), budgetKey("9.9.9.9", "137558"),
    "the same player on two networks got two budgets");
});

test("two players behind one address do not share a budget", () => {
  assert.notEqual(budgetKey("1.2.3.4", "111"), budgetKey("1.2.3.4", "222"));
});

test("anonymous callers fall back to the address", () => {
  assert.equal(budgetKey("1.2.3.4", null), budgetKey("1.2.3.4", undefined));
  assert.notEqual(budgetKey("1.2.3.4", null), budgetKey("5.6.7.8", null));
});

test("a player id can never collide with an address", () => {
  // Namespaced, or a player called "1.2.3.4" would eat that network's budget.
  assert.notEqual(budgetKey(null, "1.2.3.4"), budgetKey("1.2.3.4", null));
});

test("the limit is above what real use was measured at", () => {
  // 50 uncached reads in one hour of ordinary browsing is on record. A limit
  // at or below that is not a safety margin, it is a fault.
  assert.ok(PER_KEY_HOURLY > 50, "the limit would cut off observed real use");
  assert.ok(GLOBAL_HOURLY >= PER_KEY_HOURLY * 5, "the global cap leaves no room for several readers");
});
