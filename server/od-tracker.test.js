import test from "node:test";
import assert from "node:assert/strict";

import { isOverdosing, applyRoster } from "./od-tracker.js";

// A Torn OD hospitalizes the member; fetchFactionMembers surfaces state +
// description. Only "hospital state AND an overdose description" counts.
const od  = (name) => ({ name, status: "hospital", description: "In hospital for 152 mins after overdosing on Xanax" });
const hosp= (name) => ({ name, status: "hospital", description: "In hospital for 12 mins" });
const okay= (name) => ({ name, status: "okay", description: "" });

test("isOverdosing requires hospital state AND an overdose description", () => {
  assert.equal(isOverdosing(od("A")), true);
  assert.equal(isOverdosing(hosp("A")), false);              // hospital, other reason
  assert.equal(isOverdosing({ status: "okay", description: "overdosing on Xanax" }), false); // desc but not hospital
  assert.equal(isOverdosing(null), false);
});

test("a member not overdosing never enters byPlayer", () => {
  const s = applyRoster(null, { "1": okay("A"), "2": hosp("B") }, 1000);
  assert.deepEqual(s.byPlayer, {});
  assert.equal(s.lastPolledAt, 1000);
});

test("entering the OD state counts once", () => {
  const s = applyRoster(null, { "1": od("A") }, 1000);
  assert.equal(s.byPlayer["1"].count, 1);
  assert.equal(s.byPlayer["1"].active, true);
  assert.equal(s.byPlayer["1"].firstAt, 1000);
});

test("a single multi-poll OD is NOT double-counted (edge-triggered)", () => {
  let s = applyRoster(null, { "1": od("A") }, 1000);
  s = applyRoster(s, { "1": od("A") }, 1030);   // still in hospital, same OD
  s = applyRoster(s, { "1": od("A") }, 1060);
  assert.equal(s.byPlayer["1"].count, 1);
  assert.equal(s.byPlayer["1"].lastAt, 1060);
});

test("recover then OD again counts a second time", () => {
  let s = applyRoster(null, { "1": od("A") }, 1000);
  s = applyRoster(s, { "1": okay("A") }, 2000);   // out of hospital
  assert.equal(s.byPlayer["1"].active, false);
  assert.equal(s.byPlayer["1"].count, 1);
  s = applyRoster(s, { "1": od("A") }, 3000);     // ODs again
  assert.equal(s.byPlayer["1"].count, 2);
  assert.equal(s.byPlayer["1"].firstAt, 1000);    // firstAt preserved
});

test("a member absent from a later roster keeps their prior count", () => {
  let s = applyRoster(null, { "1": od("A"), "2": od("B") }, 1000);
  s = applyRoster(s, { "2": od("B") }, 1030);      // "1" not returned this poll
  assert.equal(s.byPlayer["1"].count, 1);
  assert.equal(s.byPlayer["2"].count, 1);
});
