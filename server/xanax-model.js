/**
 * Single source of truth for the xanax accountability model.
 *
 * Expected attacks from a member who pulled war xanax: each vial = 250 energy,
 * PLUS a flat REGEN_ENERGY credit — an active member also burns ~150e of natural
 * regen over the war, so "took a vial, did exactly 10 attacks, coasted" is still
 * a shortfall. 25 energy per attack. A member is flagged only once the shortfall
 * clears a small grace margin: 150e is an estimate and a 1-2 attack miss is
 * noise, not slacking.
 *
 * Used by routes.js (live post-war report) and war-history.js (frozen snapshot)
 * so the number a member sees is identical live and in history.
 */
export const XANAX_ENERGY = 250;
export const REGEN_ENERGY = 150;      // flat natural-regen credit added to expected
export const ENERGY_PER_ATTACK = 25;
export const DEFICIT_GRACE = 3;       // don't flag misses smaller than this (noise)

/** Expected attacks for a member who took `xanax` vials (0 when none). */
export function expectedAttacks(xanax) {
  const x = Number(xanax) || 0;
  return x > 0 ? Math.round((x * XANAX_ENERGY + REGEN_ENERGY) / ENERGY_PER_ATTACK) : 0;
}

/** Attack shortfall vs expected (0 floor). `attempts` = all attacks made (war + non-war). */
export function deficit(xanax, attempts) {
  return Math.max(0, expectedAttacks(xanax) - (Number(attempts) || 0));
}

/** Flagged when a xanax-taker's shortfall clears the grace margin. */
export function flagged(xanax, attempts) {
  return (Number(xanax) || 0) > 0 && deficit(xanax, attempts) >= DEFICIT_GRACE;
}
