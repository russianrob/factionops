// Change-only broadcasting for the enemy profile sweep.
//
// The sweep broadcast every fetch, changed or not: 480 status objects a minute
// at the 2.5s cadence, nearly all identical to what the client already had. On
// a phone that keeps the radio awake continuously, which is what warms it.
//
// The trap is that two fields move on their own -- `until` counts down every
// tick and `lastAction` re-words itself -- so plain equality would call
// everything changed and suppress nothing.
import test from "node:test";
import assert from "node:assert";
import { statusChanged, changedOnly, UNTIL_JUMP_SEC } from "./enemy-status-diff.js";

const S = (over = {}) => ({
  name: "Bully", level: 80, status: "okay", description: "",
  until: 0, lastAction: "5 minutes ago", activity: "online", ...over,
});

test("an identical status is not worth a frame", () => {
  assert.strictEqual(statusChanged(S(), S()), false);
});

test("a first sighting always is", () => {
  assert.strictEqual(statusChanged(undefined, S()), true);
  assert.strictEqual(statusChanged(null, S()), true);
});

test("going into hospital is news", () => {
  assert.strictEqual(statusChanged(S(), S({ status: "hospital", until: 600 })), true);
});

test("coming out of hospital is news", () => {
  assert.strictEqual(statusChanged(S({ status: "hospital", until: 30 }), S()), true);
});

test("a hospital timer merely counting down is NOT", () => {
  // The whole point. At 2.5s this fires 24 times a minute per enemy and the
  // client is already ticking the countdown locally off an absolute time.
  const a = S({ status: "hospital", until: 600 });
  const b = S({ status: "hospital", until: 597.5 });
  assert.strictEqual(statusChanged(a, b), false);
});

test("but being re-hospitalised on top of an existing timer IS", () => {
  const a = S({ status: "hospital", until: 60 });
  const b = S({ status: "hospital", until: 900 });
  assert.strictEqual(statusChanged(a, b), true);
});

test("a small upward wobble is clock jitter, not a new timer", () => {
  const a = S({ status: "hospital", until: 600 });
  const b = S({ status: "hospital", until: 600 + UNTIL_JUMP_SEC - 1 });
  assert.strictEqual(statusChanged(a, b), false);
});

test("the countdown reaching zero is news even while the state lags", () => {
  // Torn can still say "hospital" on the tick the timer empties; the client
  // needs to know it is attackable.
  const a = S({ status: "hospital", until: 2 });
  const b = S({ status: "hospital", until: 0 });
  assert.strictEqual(statusChanged(a, b), true);
});

test("lastAction re-wording itself is not news", () => {
  // A relative string. It changes on its own every minute and tells the client
  // nothing it cannot work out.
  assert.strictEqual(statusChanged(S(), S({ lastAction: "6 minutes ago" })), false);
});

test("going offline is", () => {
  assert.strictEqual(statusChanged(S(), S({ activity: "offline" })), true);
});

test("starting to attack is", () => {
  assert.strictEqual(statusChanged(S(), S({ status: "attacking" })), true);
});

test("still attacking a tick later is not", () => {
  // lastAttackAt is restamped every tick while they attack; the state already
  // says they are attacking, so the timestamp alone is not worth a frame.
  const a = S({ status: "attacking", lastAttackAt: 1000 });
  const b = S({ status: "attacking", lastAttackAt: 1002 });
  assert.strictEqual(statusChanged(a, b), false);
});

test("a rename or a level-up is", () => {
  assert.strictEqual(statusChanged(S(), S({ name: "Bully2" })), true);
  assert.strictEqual(statusChanged(S(), S({ level: 81 })), true);
});

test("a field the client knows that has gone missing is", () => {
  const a = S({ description: "In hospital" });
  const b = S();
  delete b.description;
  assert.strictEqual(statusChanged(a, b), true);
});

test("a batch is filtered down to only the entries that moved", () => {
  const existing = { "1": S(), "2": S({ status: "hospital", until: 600 }) };
  const batch = {
    "1": S(),                                        // unchanged
    "2": S({ status: "hospital", until: 597.5 }),    // just counting down
    "3": S({ status: "hospital", until: 300 }),      // never seen before
  };
  assert.deepStrictEqual(Object.keys(changedOnly(batch, existing)), ["3"]);
});

test("a batch where nothing moved sends nothing at all", () => {
  const existing = { "1": S(), "2": S() };
  assert.deepStrictEqual(changedOnly({ "1": S(), "2": S() }, existing), {});
});

test("no stored statuses at all means everything is news", () => {
  const batch = { "1": S(), "2": S() };
  assert.deepStrictEqual(Object.keys(changedOnly(batch, {})), ["1", "2"]);
});
