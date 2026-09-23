// The sighting store: window, freshness and coverage.
import { test } from "node:test";
import assert from "node:assert/strict";
import { age, flagsFor, WINDOW_DAYS, FRESH_DAYS } from "./loadout-store.js";

const DAY = 86400000;
const NOW = Date.parse("2026-09-23T12:00:00Z");
const daysAgo = (d) => ({ seenAt: Math.floor((NOW - d * DAY) / 1000) });

test("a sighting inside the window is reported", () => {
  const a = age(daysAgo(3), NOW);
  assert.equal(a.withinWindow, true);
  assert.equal(a.fresh, true);
});

test("past the fresh mark it is still reported, but not fresh", () => {
  // Shown dimmed rather than dropped: a three-week-old EOD sighting is still
  // the best information anybody has about that player.
  const a = age(daysAgo(FRESH_DAYS + 5), NOW);
  assert.equal(a.withinWindow, true);
  assert.equal(a.fresh, false);
});

test("past the window it is not reported at all", () => {
  assert.equal(age(daysAgo(WINDOW_DAYS + 1), NOW).withinWindow, false);
});

test("the window is the 30 days the owner asked for", () => {
  assert.equal(WINDOW_DAYS, 30);
  assert.ok(FRESH_DAYS < WINDOW_DAYS);
});

test("ids with no sighting are absent, not reported as clean", () => {
  // The distinction the UI depends on: no flag means NOT SEEN, never "seen
  // carrying nothing". Returning a false row would invert that.
  const out = flagsFor([999999999], NOW);
  assert.deepEqual(out, {});
});
