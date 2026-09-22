// War win probability, from estimated firepower.
//
// The previous model started at 50 and awarded points for winning coarse
// threshold comparisons. Against war 49287 it called a rout a coin flip: Dead
// Fragment held 134.4b estimated battle stats to The Rifle Medics' 52.8b and
// five 5B+ members to their zero, and it scored 48%. The war finished 23,048
// to 7,923 — a 2.9:1 win.
//
// Two factors did the damage:
//
//   * "A-tier (1-5B)" compared HEADCOUNT INSIDE A BAND. Their 20 members at
//     ~1.1b beat our 15 at ~4b, and the five we had above the band did not
//     count at all. A faction could lose that comparison by being too strong,
//     because its heaviest members get promoted out of the tier being counted.
//
//   * Average level voted against us — a proxy for strength, outvoting the
//     strength estimates themselves.
//
// This model measures firepower instead. Total estimated stats already
// embeds roster size, so member count is no longer a separate factor; counting
// both would double it.

/**
 * How sharply the curve responds to a firepower ratio.
 *
 * BACKTESTED, not guessed. The first value here was 1.5, fitted to a single
 * observation — 2.55x firepower produced a 2.91x score in war 49287 — which
 * turned out to be twice too steep.
 *
 * Against 155 decided ranked wars (2026-09-22, 158 factions reached by walking
 * outward from our own history), the Brier-optimal value is 0.75:
 *
 *   k      0.50    0.75    1.00    1.25    1.50
 *   Brier  .2188   .2164   .2179   .2214   .2258
 *
 * Two things that sample taught, and both belong here rather than in a
 * changelog nobody reads:
 *
 *   * FIREPOWER PREDICTS, BUT WEAKLY. Brier 0.2164 against 0.25 for always
 *     saying 50%, and the direction is right 67% of the time — 71% when one
 *     side has a 2x lead, 62% in close matchups. It beats a coin and not much
 *     more, so the curve is deliberately shallow: 1.8x reads 60%, not 71%.
 *
 *   * THE OLD CURVE WAS OVERCONFIDENT AT BOTH ENDS. Wars it called at 92%
 *     were won 79% of the time; wars it called at 13% were won 36% of the
 *     time. Steepness is the knob that caused it.
 *
 * Restricting to recent wars does NOT fit better (30 days: Brier 0.2381), so
 * this is not an artefact of comparing today's stats to yesterday's wars. The
 * ceiling is real: wars are decided by turnout and coordination as much as by
 * stats, and this factor cannot see either.
 *
 *   1.0x -> 50    1.8x -> 60    2.5x -> 67    4.0x -> 74    10x -> 85
 */
export const STEEPNESS = 0.75;

/** Upsets happen. Neither end of the scale is ever certainty. */
export const FLOOR = 5;
export const CEILING = 95;

/** Below this share of a roster, the total is a guess worth flagging. */
const CONFIDENT_COVERAGE = 0.6;

/**
 * Total estimated firepower for a roster.
 *
 * Members FFScouter has no estimate for are extrapolated from the ones it
 * does, rather than counted as zero. Treating them as zero would understate a
 * faction in proportion to how little FFScouter happens to know about it,
 * which is not a property of the faction at all.
 */
export function rosterStats(estimates, rosterSize) {
  const known = (estimates || [])
    .map((e) => Number(e && e.bs_estimate))
    .filter((n) => Number.isFinite(n) && n > 0);

  const size = Number(rosterSize) || known.length;
  if (!known.length || !size) {
    return { known: 0, coverage: 0, measured: null, total: null };
  }

  const measured = known.reduce((a, b) => a + b, 0);
  const coverage = Math.min(1, known.length / size);
  // Scale the measured sum up to the whole roster.
  const total = measured * (size / known.length);
  return { known: known.length, coverage, measured, total };
}

/**
 * Win chance from two firepower totals, as a percentage.
 *
 * A logistic on the log of the ratio: symmetric by construction, so swapping
 * the sides gives the complement and the model cannot favour whoever asked.
 * Returns null when either side is unknown — answering confidently from
 * nothing was the old model's real failure.
 */
export function baseFromStats(ourTotal, theirTotal) {
  const us = Number(ourTotal), them = Number(theirTotal);
  if (!Number.isFinite(us) || !Number.isFinite(them) || us <= 0 || them <= 0) return null;
  return 100 / (1 + Math.pow(them / us, STEEPNESS));
}

/**
 * The full model: a firepower base, then adjustments, then a clamp.
 *
 * @param ours/theirs  { estimates, size }
 * @param adjustments  [{ factor, us, them, delta }] — participation, chain,
 *                     hospitalisation. Things firepower cannot see.
 *
 * Returns { probability, confidence, reason, breakdown } where breakdown is
 * the waterfall factionops renders: one row per factor with a running total,
 * and a final row carrying the clamped result.
 */
export function winProbability({ ours, theirs, adjustments = [] } = {}) {
  const o = rosterStats(ours && ours.estimates, ours && ours.size);
  const t = rosterStats(theirs && theirs.estimates, theirs && theirs.size);
  const base = baseFromStats(o.total, t.total);

  if (base == null) {
    return {
      probability: null,
      confidence: "none",
      reason: "No battle stat estimates for one or both factions, so there is nothing to compare.",
      stats: { ours: o, theirs: t },
      breakdown: [],
    };
  }

  const fmt = (n) => (n >= 1e9 ? (n / 1e9).toFixed(1) + "b" : (n / 1e6).toFixed(0) + "m");
  let running = Math.round(base);
  const breakdown = [{
    factor: "Firepower", us: fmt(o.total), them: fmt(t.total),
    delta: null, running,
  }];

  for (const a of adjustments) {
    const delta = Number(a.delta) || 0;
    running += delta;
    breakdown.push({
      factor: a.factor,
      us: a.us == null ? null : String(a.us),
      them: a.them == null ? null : String(a.them),
      delta, running,
    });
  }

  const raw = running;
  const probability = Math.max(FLOOR, Math.min(CEILING, running));
  breakdown.push({
    factor: "Win probability", us: null, them: null, delta: null,
    running: probability, clamped: probability !== raw, raw, final: true,
  });

  const coverage = Math.min(o.coverage, t.coverage);
  return {
    probability,
    confidence: coverage >= CONFIDENT_COVERAGE ? "ok" : "low",
    reason: coverage >= CONFIDENT_COVERAGE ? null
      : `Battle stats known for only ${Math.round(coverage * 100)}% of the smaller roster; the rest is extrapolated.`,
    stats: { ours: o, theirs: t, ratio: o.total / t.total },
    breakdown,
  };
}
