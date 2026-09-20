// The budget that replaces the membership gate on the AI readers.
import { test } from "node:test";
import assert from "node:assert/strict";
import { take, peek, _reset, PER_IP_HOURLY, GLOBAL_HOURLY } from "./rwp-read-budget.js";

test("an ordinary caller is allowed through", () => {
  _reset();
  assert.equal(take("1.2.3.4"), null);
});

test("a caller is cut off at their hourly limit", () => {
  _reset();
  for (let i = 0; i < PER_IP_HOURLY; i++) assert.equal(take("1.2.3.4"), null, "refused at " + i);
  const d = take("1.2.3.4");
  assert.ok(d, "no limit at all");
  assert.equal(d.scope, "ip");
});

test("and the refusal says the cached ones still work", () => {
  // The distinction matters: browsing a thread somebody has already read costs
  // nothing and keeps working. Saying only "rate limited" would read as broken.
  _reset();
  for (let i = 0; i < PER_IP_HOURLY; i++) take("1.2.3.4");
  assert.match(take("1.2.3.4").error, /already-read/i);
});

test("one caller running out does not block another", () => {
  _reset();
  for (let i = 0; i < PER_IP_HOURLY; i++) take("1.2.3.4");
  assert.equal(take("5.6.7.8"), null);
});

test("the window rolls", () => {
  _reset();
  const t0 = 1_000_000_000;
  for (let i = 0; i < PER_IP_HOURLY; i++) take("1.2.3.4", t0);
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
  for (let i = 0; i < PER_IP_HOURLY; i++) assert.equal(take(undefined), null);
  assert.ok(take(undefined), "an unknown caller had no limit");
});

test("peek reports without spending", () => {
  _reset();
  take("1.2.3.4");
  const before = peek("1.2.3.4");
  peek("1.2.3.4");
  assert.equal(peek("1.2.3.4").ip, before.ip);
});
