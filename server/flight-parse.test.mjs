// Reading an FFScouter flight record.
//
// This logic drives landing countdowns in factionops and takeoff attribution
// for OC delays, and it was previously inline in a fetch loop where nothing
// could reach it. Extracting it is what makes the batch endpoint safe to adopt:
// batch returns `current` but NOT `recent_flights`, and the whole
// abroad-vs-home distinction lives in `recent_flights`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseFlight, needsRecentFlights } from "./flight-parse.js";

const outbound = (over = {}) => ({
  takeoff_time: 1710000000,
  status_description: "Traveling from Torn to Japan",
  earliest_arrival_time: 1710007200,
  latest_arrival_time: 1710010800,
  travel_method: "Airline",
  ...over,
});

// ── In transit ─────────────────────────────────────────────────

test("an outbound flight reports its destination", () => {
  const i = parseFlight(outbound(), []);
  assert.equal(i.destination, "Japan");
  assert.equal(i.returning, false);
  assert.equal(i.method, "Airline");
});

test("a return leg reports where they are coming FROM", () => {
  // "Traveling from Japan to Torn" — the useful label is Japan, not Torn.
  // Showing "Torn" on a war row would read as already home.
  const i = parseFlight(outbound({ status_description: "Traveling from Japan to Torn" }), []);
  assert.equal(i.destination, "Japan");
  assert.equal(i.returning, true);
});

// ── Landing time: the part that decides when someone is hittable ──

test("a confirmed book lands at the EARLIEST time", () => {
  const i = parseFlight(outbound({ book_likely_being_used: true }), []);
  assert.equal(i.landingAt, 1710007200);
});

test("a confirmed non-book lands at the LATEST time", () => {
  const i = parseFlight(outbound({ book_likely_being_used: false }), []);
  assert.equal(i.landingAt, 1710010800);
});

test("unknown book usage splits the difference", () => {
  // Neither bound is defensible when we cannot tell, and being wrong early is
  // worse than being wrong late: a caller who arrives before the target lands
  // wastes the trip.
  const i = parseFlight(outbound(), []);
  assert.equal(i.landingAt, (1710007200 + 1710010800) / 2);
});

test("one missing bound falls back to the other", () => {
  assert.equal(parseFlight(outbound({ earliest_arrival_time: 0 }), []).landingAt, 1710010800);
  assert.equal(parseFlight(outbound({ latest_arrival_time: 0 }), []).landingAt, 1710007200);
});

// ── Takeoff attribution, which OC delay reporting depends on ──

test("an outbound leg reports its own takeoff", () => {
  assert.equal(parseFlight(outbound(), []).takeoffTime, 1710000000 * 1000);
});

test("a return leg reports the OUTBOUND takeoff, not the return's", () => {
  // OC delay asks "when did they leave Torn", so on the way home the answer is
  // in the previous flight, not the current one.
  const cur = outbound({ status_description: "Traveling from Japan to Torn", takeoff_time: 1710050000 });
  const recents = [{ takeoff_time: 1710000000, status_description: "Traveling from Torn to Japan" }];
  assert.equal(parseFlight(cur, recents).takeoffTime, 1710000000 * 1000);
});

test("a return leg with no history falls back to its own takeoff", () => {
  const cur = outbound({ status_description: "Traveling from Japan to Torn", takeoff_time: 1710050000 });
  assert.equal(parseFlight(cur, []).takeoffTime, 1710050000 * 1000);
});

// ── Not in transit: abroad vs home ─────────────────────────────
// `current: null` means "not flying", which is two different situations. This
// is the distinction batch responses cannot make on their own.

test("landed abroad still reports the destination", () => {
  const recents = [{ takeoff_time: 1710000000, status_description: "Traveling from Torn to Japan", travel_method: "Airline" }];
  const i = parseFlight(null, recents);
  assert.equal(i.destination, "Japan");
  assert.equal(i.landingAt, 0, "already landed, so nothing to count down to");
  assert.equal(i.takeoffTime, 1710000000 * 1000);
});

test("back in Torn reports nothing", () => {
  const recents = [{ takeoff_time: 1710050000, status_description: "Traveling from Japan to Torn" }];
  const i = parseFlight(null, recents);
  assert.equal(i.destination, "");
  assert.equal(i.takeoffTime, 0);
});

test("no history at all is treated as home, not abroad", () => {
  // Claiming somebody is abroad on no evidence would put a phantom country on
  // a war row. Silence is the safe direction.
  const i = parseFlight(null, []);
  assert.equal(i.destination, "");
  assert.equal(i.takeoffTime, 0);
});

// ── What the batch endpoint can and cannot answer ──────────────

test("a player in transit needs no follow-up call", () => {
  // Batch gives `current` for everyone. When it is populated the record is
  // complete and the single-target endpoint has nothing to add — this is the
  // saving.
  assert.equal(needsRecentFlights(outbound()), false);
});

test("a player NOT in transit needs the single endpoint", () => {
  // Only recent_flights separates abroad from home, and batch omits it.
  assert.equal(needsRecentFlights(null), true);
  assert.equal(needsRecentFlights(undefined), true);
});

test("parsing survives a malformed description", () => {
  // FFScouter's wording is not a contract. A shape we cannot parse must
  // degrade to 'no destination', never throw into the poller.
  const i = parseFlight(outbound({ status_description: "somewhere out there" }), []);
  assert.equal(i.destination, "");
  assert.equal(i.returning, false);
  assert.ok(Number.isFinite(i.landingAt));
});
