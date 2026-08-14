/**
 * Single source of truth for the xanax accountability model.
 *
 * A war vial = 250 energy = 10 attacks (at 25e each). A member ALSO regenerates
 * ~150e of natural energy over a war (= ~6 attacks). That energy is the member's
 * own, so we CREDIT it to their FIRST ~6 attacks rather than adding it to the bar:
 * the expectation is a flat 10 attacks per vial, and only attacks BEYOND the first
 * ~6 count as delivering on the xanax. "Took 2 vials, made 6 attacks" ⇒ those 6
 * came from natural regen, 0 from the 20 vialed attacks ⇒ full 20 deficit. A
 * member is flagged only once the shortfall clears a small grace margin (noise).
 *
 * Used by routes.js (live post-war report) and war-history.js (frozen snapshot)
 * so the number a member sees is identical live and in history.
 */
export const XANAX_ENERGY = 250;
export const REGEN_ENERGY = 150;      // natural regen over a war — CREDITED to the first attacks, not added to expected
export const ENERGY_PER_ATTACK = 25;
export const DEFICIT_GRACE = 3;       // don't flag misses smaller than this (noise)
export const REGEN_ATTACKS = REGEN_ENERGY / ENERGY_PER_ATTACK; // 6 — natural-energy attacks, credited first

/** Attacks a member's vials alone should buy — natural regen NOT included. */
export function expectedAttacks(xanax) {
  const x = Number(xanax) || 0;
  return x > 0 ? Math.round((x * XANAX_ENERGY) / ENERGY_PER_ATTACK) : 0;
}

/**
 * Attack shortfall on the VIALS (0 floor). The member's ~150e of natural energy
 * is assumed spent on their first `REGEN_ATTACKS` attacks, so only attacks beyond
 * that count against the vials. `attempts` = all attacks made (war + non-war).
 */
export function deficit(xanax, attempts) {
  const x = Number(xanax) || 0;
  if (x <= 0) return 0;
  const vialAttacks = Math.max(0, (Number(attempts) || 0) - REGEN_ATTACKS);
  return Math.max(0, expectedAttacks(x) - vialAttacks);
}

/** Flagged when a xanax-taker's shortfall clears the grace margin. */
export function flagged(xanax, attempts) {
  return (Number(xanax) || 0) > 0 && deficit(xanax, attempts) >= DEFICIT_GRACE;
}
