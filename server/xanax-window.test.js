import test from "node:test";
import assert from "node:assert/strict";

import {
  computePollWindow,
  PRE_WAR_LOOKBACK_SEC,
  POST_WAR_LOOKAHEAD_SEC,
} from "./xanax-tracker.js";

const DAY = 24 * 60 * 60;

test("upcoming war whose pre-war window has not opened yet is not pollable (the from>to flood)", () => {
  // Real numbers from the war_42055 vs 44092 war that flooded the logs:
  // warStart 2026-06-19 13:00 UTC, now 2026-06-17 ~03:23 UTC.
  const war = { factionId: 42055, warStart: 1781874000 };
  const now = 1781666628;
  const w = computePollWindow(war, now);
  assert.equal(w.open, false);
  assert.ok(w.fromTs > w.to, "fromTs should be in the future, i.e. from > to");
});

test("upcoming war inside the 24h pre-war window fetches from warStart - lookback", () => {
  const warStart = 1781874000;
  const war = { factionId: 42055, warStart };
  const now = warStart - 1000; // ~16 min before kickoff: inside the 24h window
  const w = computePollWindow(war, now);
  assert.equal(w.open, true);
  assert.equal(w.fromTs, warStart - PRE_WAR_LOOKBACK_SEC);
  assert.equal(w.to, now);
});

test("active war (warStart in the past) is pollable", () => {
  const now = 2_000_000_000;
  const war = { factionId: 42055, warStart: now - DAY };
  const w = computePollWindow(war, now);
  assert.equal(w.open, true);
  assert.equal(w.fromTs, (now - DAY) - PRE_WAR_LOOKBACK_SEC);
});

test("resumed war fetches from lastPolledAt, not warStart", () => {
  const now = 2_000_000_000;
  const war = {
    factionId: 42055,
    warStart: now - 5 * DAY,
    xanaxStats: { lastPolledAt: now - 600 },
  };
  const w = computePollWindow(war, now);
  assert.equal(w.open, true);
  assert.equal(w.fromTs, now - 600);
});

test("zero-width window (fromTs === now) is not open", () => {
  const now = 2_000_000_000;
  const war = { factionId: 42055, warStart: now + PRE_WAR_LOOKBACK_SEC };
  const w = computePollWindow(war, now);
  assert.equal(w.fromTs, now);
  assert.equal(w.open, false);
});

test("just-open boundary (fromTs === now - 1) is open", () => {
  const now = 2_000_000_000;
  const war = { factionId: 42055, warStart: now + PRE_WAR_LOOKBACK_SEC - 1 };
  const w = computePollWindow(war, now);
  assert.equal(w.fromTs, now - 1);
  assert.equal(w.open, true);
});

test("future lastPolledAt (clock skew / stale state) defers instead of fetching from>to", () => {
  const now = 2_000_000_000;
  const war = {
    factionId: 42055,
    warStart: now - 5 * DAY,
    xanaxStats: { lastPolledAt: now + 600 },
  };
  const w = computePollWindow(war, now);
  assert.equal(w.fromTs, now + 600);
  assert.equal(w.open, false);
});

test("default stats present but never polled (lastPolledAt 0) backfills from warStart", () => {
  const now = 2_000_000_000;
  const war = {
    factionId: 42055,
    warStart: now - DAY,
    xanaxStats: { lastPolledAt: 0, taken: {}, names: {}, entryCount: 0 },
  };
  const w = computePollWindow(war, now);
  assert.equal(w.fromTs, (now - DAY) - PRE_WAR_LOOKBACK_SEC);
  assert.equal(w.open, true);
});

test("missing warStart falls back to now - lookback and stays pollable", () => {
  const now = 2_000_000_000;
  const war = { factionId: 42055 };
  const w = computePollWindow(war, now);
  assert.equal(w.open, true);
  assert.equal(w.fromTs, now - PRE_WAR_LOOKBACK_SEC);
});

test("ended war computes the post-war cap from warEndedAt (ms)", () => {
  const now = 2_000_000_000;
  const endedAtMs = (now - DAY) * 1000;
  const war = {
    factionId: 42055,
    warStart: now - 3 * DAY,
    warEnded: true,
    warEndedAt: endedAtMs,
    xanaxStats: { lastPolledAt: now - 3600 },
  };
  const w = computePollWindow(war, now);
  assert.equal(w.open, true);
  assert.equal(w.warEndCapSec, Math.floor(endedAtMs / 1000) + POST_WAR_LOOKAHEAD_SEC);
});

test("active/upcoming war has no post-war cap", () => {
  const now = 2_000_000_000;
  const war = { factionId: 42055, warStart: now - DAY };
  const w = computePollWindow(war, now);
  assert.equal(w.warEndCapSec, null);
});
