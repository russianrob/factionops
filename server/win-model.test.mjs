// War win probability from estimated firepower.
//
// The old model started at 50 and added points for winning coarse threshold
// comparisons. Checked against war 49287 it called a rout a coin flip:
// Dead Fragment had 134.4b estimated stats to The Rifle Medics' 52.8b and five
// 5B+ members to their zero, and the model scored 48% — then the war finished
// 23,048 to 7,923, a 2.9:1 win.
//
// Two factors caused it. "A-tier (1-5B)" counted HEADCOUNT INSIDE A BAND, so
// their 20 members at ~1.1b beat our 15 at ~4b while ignoring the five we had
// above the band entirely — a faction could lose that comparison by being too
// strong, because its heavies get promoted out of the tier being counted. And
// average level voted against us on a proxy for strength while the actual
// strength estimates said the opposite.
import { test } from "node:test";
import assert from "node:assert/strict";
import { rosterStats, baseFromStats, winProbability, STEEPNESS } from "./win-model.js";

// ── reading a roster ───────────────────────────────────────────

test("totals the estimates it has", () => {
  const r = rosterStats([{ bs_estimate: 2e9 }, { bs_estimate: 3e9 }], 2);
  assert.equal(r.known, 2);
  assert.equal(r.total, 5e9);
  assert.equal(r.coverage, 1);
});

test("extrapolates over members with no estimate", () => {
  // Four members, two known averaging 2b. The roster is worth about 8b, not
  // 4b — treating unknowns as zero would understate a faction in proportion
  // to how little FFScouter knows about it, which is not a property of the
  // faction at all.
  const r = rosterStats([{ bs_estimate: 1e9 }, { bs_estimate: 3e9 }], 4);
  assert.equal(r.known, 2);
  assert.equal(r.coverage, 0.5);
  assert.equal(r.total, 8e9);
  assert.equal(r.measured, 4e9);
});

test("nulls and zeroes are absent, not evidence of weakness", () => {
  const r = rosterStats([{ bs_estimate: null }, { bs_estimate: 0 }, { bs_estimate: 4e9 }], 3);
  assert.equal(r.known, 1);
  assert.equal(r.total, 12e9, "one known member of three extrapolates to three");
});

test("an unreadable roster reports no total rather than zero", () => {
  const r = rosterStats([], 50);
  assert.equal(r.total, null);
  assert.equal(r.coverage, 0);
});

// ── the base curve ─────────────────────────────────────────────

test("equal firepower is an even fight", () => {
  assert.equal(baseFromStats(100, 100), 50);
});

test("calibrated against 155 real wars, not one", () => {
  // 1.5 was fitted to a single war and read 80% here. Backtested over 155
  // decided wars the Brier-optimal steepness is 0.75, which reads 67 — and
  // that is the honest number: firepower calls the winner 67% of the time.
  const p = baseFromStats(134.4, 52.8);
  assert.ok(p > 64 && p < 70, `got ${p}`);
});

test("a 2x lead is a lean, not a lock", () => {
  // The old curve said 74 here and wars it called at 92 were won 79% of the
  // time. Overconfidence at the top end was the specific failure.
  const p = baseFromStats(2, 1);
  assert.ok(p > 58 && p < 65, `got ${p}`);
});

test("the curve is symmetric", () => {
  // Swapping sides must give the complement, or the model favours whoever is
  // asking.
  for (const [a, b] of [[1, 3], [5, 2], [134.4, 52.8]]) {
    assert.ok(Math.abs(baseFromStats(a, b) + baseFromStats(b, a) - 100) < 1e-9);
  }
});

test("it rises with advantage but never reaches certainty", () => {
  const p1 = baseFromStats(2, 1), p2 = baseFromStats(4, 1), p3 = baseFromStats(50, 1);
  assert.ok(p1 < p2 && p2 < p3);
  assert.ok(p3 < 100, "no matchup is a certainty");
});

test("missing totals give no opinion rather than a confident 50", () => {
  assert.equal(baseFromStats(null, 100), null);
  assert.equal(baseFromStats(100, 0), null);
});

// ── the whole model ────────────────────────────────────────────

const OURS = { estimates: [{ bs_estimate: 134.4e9 }], size: 1 };
const THEIRS = { estimates: [{ bs_estimate: 52.8e9 }], size: 1 };

test("war 49287 is no longer a coin flip", () => {
  const out = winProbability({ ours: OURS, theirs: THEIRS });
  assert.ok(out.probability > 60,
    `a 2.55x firepower lead should not read ${out.probability}%`);
});

test("the waterfall still explains every step", () => {
  // factionops renders this breakdown; the shape is a contract.
  const out = winProbability({ ours: OURS, theirs: THEIRS });
  const first = out.breakdown[0], last = out.breakdown[out.breakdown.length - 1];
  assert.match(first.factor, /firepower/i);
  assert.equal(last.final, true);
  assert.equal(last.running, out.probability);
  for (const row of out.breakdown) assert.ok("running" in row && "factor" in row);
});

test("adjustments move the number without overturning firepower", () => {
  // Participation matters — a faction that does not turn out loses — but one
  // soft factor should not reverse a two-and-a-half-fold stat lead.
  const out = winProbability({
    ours: OURS, theirs: THEIRS,
    adjustments: [{ factor: "Active roster", us: 10, them: 40, delta: -10 }],
  });
  assert.ok(out.probability > 50, `got ${out.probability}`);
  assert.ok(out.probability < winProbability({ ours: OURS, theirs: THEIRS }).probability);
});

test("clamped to a range that admits upsets", () => {
  const out = winProbability({
    ours: { estimates: [{ bs_estimate: 1e12 }], size: 1 },
    theirs: { estimates: [{ bs_estimate: 1e6 }], size: 1 },
  });
  assert.ok(out.probability <= 95 && out.probability >= 5);
});

test("unknown firepower is reported as unknown, not 50", () => {
  // The old model's real failure was answering confidently from nothing.
  const out = winProbability({ ours: { estimates: [], size: 80 }, theirs: THEIRS });
  assert.equal(out.probability, null);
  assert.match(out.reason || "", /estimate/i);
});

test("low coverage is flagged so the number can be discounted", () => {
  const out = winProbability({
    ours: { estimates: [{ bs_estimate: 4e9 }], size: 80 },
    theirs: { estimates: [{ bs_estimate: 2e9 }], size: 80 },
  });
  assert.ok(out.confidence === "low", `coverage 1/80 should not be confident`);
});

test("steepness is a stated constant, not a magic number in a formula", () => {
  assert.ok(STEEPNESS > 0.4 && STEEPNESS < 2, `got ${STEEPNESS}`);
});
