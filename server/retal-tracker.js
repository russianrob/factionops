export const RETAL_WINDOW_SEC = 300;

/**
 * Build the incoming-retal list from OUR faction's attack log: enemy-faction
 * attacks on our members still inside the retal-bonus window. Pure + tested.
 */
export function computeIncomingRetals(attacks, enemyFactionId, nowSec, windowSec = RETAL_WINDOW_SEC, enemyStatuses = {}) {
  if (!Array.isArray(attacks) || !enemyFactionId) return [];
  const enemyFid = String(enemyFactionId);
  const out = [];
  for (const a of attacks) {
    const attackerFid = String(a.attacker_faction ?? a.attacker_faction_id ?? "");
    if (attackerFid !== enemyFid) continue;
    const attackerId = String(a.attacker_id ?? "");
    if (!attackerId) continue;
    const endedTs = Number(a.timestamp_ended || a.timestamp_started || 0);
    if (!endedTs || endedTs < nowSec - windowSec) continue;
    const lvl = enemyStatuses[attackerId] && enemyStatuses[attackerId].level;
    out.push({
      attackId: String(a.code || (attackerId + "-" + endedTs)),
      attackerId: Number(attackerId),
      attackerName: a.attacker_name || "",
      defenderId: Number(a.defender_id || 0),
      defenderName: a.defender_name || "",
      result: a.result || "",
      endedTs,
      attackerLevel: lvl != null ? Number(lvl) : null,
    });
  }
  out.sort((x, y) => y.endedTs - x.endedTs);
  return out;
}
