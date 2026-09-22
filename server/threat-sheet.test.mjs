// Turning a war report plus stat estimates into a target sheet.
//
// Scout could say WHEN to declare and nothing about WHO you would be fighting.
// The two data sources that fix that are both readable for any faction: Torn's
// per-member ranked war report, and FFScouter's get-stats for up to 205
// players in one call.
//
// The reason this needs logic rather than a sort is that score alone is a bad
// threat signal. Measured on The Rifle Medics' war against Arcadia: Joshi was
// their SECOND highest scorer on 4.38 MILLION estimated stats, and Lykiri
// scored 690 on 1.07m. Neither was fighting — they were farming something
// soft. Eddiz, on 2.83 BILLION, is the one who would actually hurt you.
import { test } from "node:test";
import assert from "node:assert/strict";
import { classifyRoster, median, concentration } from "./threat-sheet.js";

const m = (name, score, attacks, bs, extra = {}) =>
  ({ id: name.length * 1000, name, level: 50, score, attacks, bs, ...extra });

// ── median ─────────────────────────────────────────────────────

test("median of an odd and an even set", () => {
  assert.equal(median([3, 1, 2]), 2);
  assert.equal(median([4, 1, 2, 3]), 2.5);
});

test("median ignores unknowns rather than treating them as zero", () => {
  // A roster where half the members have no estimate must not have its middle
  // dragged to nothing — that would promote everybody else to "heavy".
  assert.equal(median([null, 10, undefined, 20, NaN]), 15);
});

test("median of nothing is null", () => {
  assert.equal(median([]), null);
  assert.equal(median([null, null]), null);
});

// ── banding ────────────────────────────────────────────────────

test("bands are relative to the roster's own middle", () => {
  const rows = classifyRoster([
    m("Weak", 100, 10, 1e6),
    m("Mid", 100, 10, 1e9),
    m("Heavy", 100, 10, 8e9),
  ]).rows;
  const band = (n) => rows.find((r) => r.name === n).band;
  assert.equal(band("Heavy"), "heavy");
  assert.equal(band("Weak"), "light");
  assert.equal(band("Mid"), "mid");
});

test("a member with no estimate is unknown, never light", () => {
  // Absent data must not read as "safe to hit". That is the one error here
  // with a cost attached — somebody attacks a wall thinking it is a pushover.
  const rows = classifyRoster([m("Ghost", 500, 10, null), m("Known", 100, 10, 1e9)]).rows;
  assert.equal(rows.find((r) => r.name === "Ghost").band, "unknown");
});

test("an all-unknown roster does not band anybody", () => {
  const out = classifyRoster([m("A", 1, 1, null), m("B", 2, 1, null)]);
  assert.equal(out.medianBs, null);
  assert.ok(out.rows.every((r) => r.band === "unknown"));
});

// ── the farming flag ───────────────────────────────────────────

test("high score on low stats is flagged as farming", () => {
  // Joshi's shape: near the top of the scoreboard, nowhere near the top of the
  // roster by stats. They will keep scoring unless somebody denies them.
  const out = classifyRoster([
    m("Joshi", 1215, 56, 4.38e6),
    m("Eddiz", 914, 72, 2.83e9),
    m("Filler1", 50, 5, 1e9),
    m("Filler2", 40, 5, 1e9),
    m("Filler3", 30, 5, 1e9),
  ]);
  const row = (n) => out.rows.find((r) => r.name === n);
  assert.equal(row("Joshi").farming, true);
  assert.equal(row("Eddiz").farming, false, "a genuine heavy hitter is not a farmer");
});

test("a low scorer on low stats is not flagged", () => {
  // Being weak is not the flag. Being weak AND productive is.
  const out = classifyRoster([
    m("Big", 2000, 50, 5e9), m("Big2", 1900, 50, 5e9), m("Big3", 1800, 50, 5e9),
    m("Tiny", 5, 2, 1e6),
  ]);
  assert.equal(out.rows.find((r) => r.name === "Tiny").farming, false);
});

// ── score per attack ───────────────────────────────────────────

test("score per attack measures productivity", () => {
  const rows = classifyRoster([m("A", 1000, 50, 1e9)]).rows;
  assert.equal(rows[0].spa, 20);
});

test("zero attacks does not divide by zero", () => {
  const rows = classifyRoster([m("Idle", 0, 0, 1e9)]).rows;
  assert.equal(rows[0].spa, null);
});

// ── ordering ───────────────────────────────────────────────────

test("sorted by estimated stats, hardest first, unknowns last", () => {
  // The sheet's first question is "who will hurt us", so stats lead. Unknowns
  // sink rather than floating to the top on a null comparison.
  const rows = classifyRoster([
    m("Soft", 900, 10, 1e6), m("Unknown", 800, 10, null), m("Hard", 100, 10, 9e9),
  ]).rows;
  assert.deepEqual(rows.map((r) => r.name), ["Hard", "Soft", "Unknown"]);
});

// ── concentration ──────────────────────────────────────────────

test("concentration is the share the top N scored", () => {
  // The Rifle Medics' top five made 23% of their score — spread thin, so
  // there is no decapitation play. That is worth knowing before planning one.
  const rows = [m("a", 50, 1, 1), m("b", 30, 1, 1), m("c", 20, 1, 1)];
  assert.ok(Math.abs(concentration(rows, 2) - 0.8) < 1e-9);
});

test("concentration of an empty or scoreless roster is null", () => {
  assert.equal(concentration([], 5), null);
  assert.equal(concentration([m("a", 0, 0, 1)], 5), null);
});

// ── people who have left ───────────────────────────────────────

test("members no longer in the faction are dropped", () => {
  // A target sheet listing somebody who left is worse than a short sheet: it
  // sends a caller at a name that is not there.
  const out = classifyRoster(
    [m("Stayed", 100, 10, 1e9), m("Left", 900, 10, 1e9)],
    { currentIds: new Set([m("Stayed", 0, 0, 0).id]) });
  assert.deepEqual(out.rows.map((r) => r.name), ["Stayed"]);
  assert.equal(out.departed, 1);
});

test("no roster supplied means no filtering", () => {
  const out = classifyRoster([m("A", 1, 1, 1e9), m("B", 2, 1, 1e9)]);
  assert.equal(out.rows.length, 2);
  assert.equal(out.departed, 0);
});
