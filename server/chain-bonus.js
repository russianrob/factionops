// When to warn that a chain bonus is coming.
//
// The old rule fired only when the chain was OBSERVED at exactly bonus-1 or
// bonus-2, and required the count to have risen since the previous look.
// Measured across one war day, observations jump this far apart:
//
//   1 hit: 73×   2 hits: 47×   3 hits: 19×   4 hits: 24×   5+: 16×
//
// A third of the time the chain steps straight over a two-wide window — and it
// does so most often during a fast chain, which is precisely when a bonus
// warning is worth having. The warning was quietly least reliable exactly when
// it mattered.
//
// So this warns on ENTERING the approach zone rather than landing inside it,
// and the zone is wide enough to survive the observed step size.

/** Bonus hit thresholds in Torn chain mechanics. */
export const BONUS_HITS = [
  10, 25, 50, 100, 250, 500, 1_000, 2_500, 5_000, 10_000, 25_000, 50_000, 100_000,
];

/**
 * How many hits out to start warning.
 *
 * Five, not two: at four hits per observation a two-wide window is invisible,
 * and a warning nobody receives is indistinguishable from one that does not
 * exist. Five also leaves time to actually line up the hit, which is the whole
 * point of telling somebody early.
 */
export const APPROACH = 5;

/**
 * The bonus worth announcing, or null.
 *
 * @param prev          chain count at the previous observation
 * @param current       chain count now
 * @param lastAnnounced the bonus already announced for this chain, if any
 *
 * Returns null when there is nothing useful to say — including when the chain
 * has already jumped PAST the bonus. A warning after the fact is noise, and
 * worse, it implies there is still something to do about it.
 */
export function bonusToAnnounce(prev, current, lastAnnounced) {
  const p = Number(prev) || 0;
  const c = Number(current) || 0;

  // A chain never shrinks; a stale snapshot arriving late can make it look as
  // though it has. Nothing to announce either way.
  if (c <= p) return null;

  const bonus = BONUS_HITS.find((b) => b > c);
  if (!bonus) return null;
  if (bonus === Number(lastAnnounced)) return null;

  // Only once the chain is close enough for the warning to be actionable.
  return (bonus - c) <= APPROACH ? bonus : null;
}
