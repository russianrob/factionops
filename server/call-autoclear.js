// Should this attack free the call on its target?
//
// The rule used to live inside the attacks-feed poll, which is gated: if any
// client refreshed enemy status within 30 seconds, the Torn fetch is skipped
// because clients already report hospital state. During a live war, with
// members sitting on the war page, that gate never opens — 53,818 consecutive
// skips — so the auto-uncall never ran for anybody, all war.
//
// The gate's reasoning is sound for HOSPITAL detection, which is what it was
// written for. It just happened to also hold the only code path that could
// free a call, and nothing said so. An optimisation that skipped a fetch took
// an unrelated feature with it.
//
// So the rule lives here now, and the client-reported attacks path drives it:
// that data already carries attacker, defender and result, it arrives
// continuously rather than every fifteen seconds, and it costs no Torn calls
// at all. The poll keeps using the same function, because two copies of a rule
// is two chances to fix only one of them.

/**
 * Results that mean the caller actually landed a hit.
 *
 * Mugged and Looted count: the target may not have gone to hospital, but the
 * job the call existed for is done.
 */
export const SUCCESS_RESULTS = new Set([
  "Attacked", "Hospitalized", "Mugged", "Looted", "Special", "Assist",
]);

/** Torn sends numbers, calls store whatever the client sent. Compare loosely. */
const sameId = (a, b) => {
  if (a == null || b == null || a === "" || b === "") return false;
  return String(a) === String(b);
};

/**
 * Whether `attack` should clear `call`.
 *
 * Deliberately narrow, and each exclusion is a bug that was fixed by it:
 *
 *   - Only the CALLER's own attack counts. Clearing on anyone's attack is the
 *     "two people calling the same target" bug removed in May: the call
 *     vanished out from under whoever placed it.
 *   - Only OUR faction attacking. An enemy hospitalising the target says
 *     nothing about whether our caller still intends to hit them.
 *   - Only a successful result. A loss means they may retry.
 */
export function shouldClearCall(attack, call, ourFactionId) {
  if (!attack || !call) return false;

  const attackerId = attack.attacker_id ?? attack.attackerId ?? null;
  const defenderId = attack.defender_id ?? attack.defenderID ?? attack.defenderId ?? null;
  const attackerFaction = attack.attacker_faction ?? attack.attacker_faction_id ?? attack.attackerFactionId ?? null;
  if (attackerId == null || defenderId == null) return false;

  if (!sameId(attackerFaction, ourFactionId)) return false;
  if (!SUCCESS_RESULTS.has(String(attack.result || ""))) return false;

  const callerId = call.calledBy && call.calledBy.id;
  if (!sameId(callerId, attackerId)) return false;

  // The hit must have happened AFTER the call was placed.
  //
  // Clients re-report their last ~100 fights every cycle, not just new ones,
  // so calling a target you hit earlier left the old attack sitting in the
  // buffer — and it cleared the fresh call instantly. Deathy called 2713731 at
  // 12:10:49 and it dropped four seconds later on a hit from minutes before.
  //
  // The poll this came from never had the problem: it carried a cursor and
  // only saw attacks newer than the last poll. Moving the rule to the client
  // feed dropped that guarantee, so the ordering is checked explicitly here.
  //
  // When the ordering cannot be established, clear nothing: dropping a fresh
  // call is worse than leaving a stale one, which expires on its own.
  const endedSec = Number(attack.timestamp_ended) || Number(attack.timestamp_started)
    || Number(attack.ended) || 0;
  const calledMs = Number(call.timestamp) || 0;
  if (!endedSec || !calledMs) return false;
  return endedSec * 1000 > calledMs;
}

/**
 * Apply the rule across a batch, returning the target ids to release.
 *
 * Returns ids rather than mutating, so the caller owns the write and the
 * broadcast — this module stays a rule and nothing more.
 */
export function callsToClear(attacks, calls, ourFactionId) {
  const out = [];
  if (!calls) return out;
  for (const attack of attacks || []) {
    const defenderId = attack && (attack.defender_id ?? attack.defenderID ?? attack.defenderId);
    if (defenderId == null) continue;
    const key = String(defenderId);
    if (!calls[key] || out.includes(key)) continue;
    if (shouldClearCall(attack, calls[key], ourFactionId)) out.push(key);
  }
  return out;
}
