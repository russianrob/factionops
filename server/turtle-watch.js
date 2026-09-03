/**
 * Who needs turtling: which of our own members the enemy is farming.
 *
 * Turtling is hospitalising your own member so the enemy cannot keep hitting
 * them for points. The question it answers is "who is bleeding us", and the
 * attack ledger already knows -- it stores incoming attacks as well as ours,
 * and every incoming row carries the respect the attacker took off us.
 *
 * So the ranking is the damage itself rather than a proxy like level or hit
 * count: a member giving away 40 respect an hour wants taking off the board
 * before one who has been poked twice for nothing.
 *
 * Kept in its own module rather than added to war-payouts.js. Nothing here
 * touches money, and that file has grown to 1,200 lines of arithmetic that
 * does.
 */

// Results where the attacker WON and therefore scored. Everything else --
// Lost, Stalemate, Escape, Interrupted -- is a defence, which costs us
// nothing and is no reason to take somebody off the board.
//
// Assist is deliberately absent: the finishing blow is its own row, so
// counting the assist as well would report two members farmed when one was.
const ENEMY_WIN = new Set(["Attacked", "Hospitalized", "Mugged"]);

const DEFAULT_WINDOW_MS = 60 * 60 * 1000;

/**
 * @param attacks  ledger rows, array or the keyed object the file stores
 * @param ourFid   our faction id -- rows where we are the DEFENDER
 * @param windowMs how far back "now" reaches; default one hour
 * @param now      ms
 * @returns [{ playerId, name, hits, respectLost, lastAt, attackers }] worst first
 */
export function turtleWatch(attacks, { ourFid, windowMs = DEFAULT_WINDOW_MS, now = Date.now() } = {}) {
  const rows = Array.isArray(attacks) ? attacks : Object.values(attacks || {});
  if (!rows.length || !ourFid) return [];
  const cutoff = Math.floor((now - windowMs) / 1000);
  const byMember = new Map();

  for (const r of rows) {
    if (!r || String(r.defenderFactionId || "") !== String(ourFid)) continue;
    // Our own turtling is also an attack on our member. Counting it would put
    // the person we just protected at the top of the list of people to protect.
    if (String(r.attackerFactionId || "") === String(ourFid)) continue;
    if (!ENEMY_WIN.has(String(r.result || ""))) continue;
    const ended = Number(r.ended) || 0;
    if (ended < cutoff) continue;

    const id = String(r.defenderId || "");
    if (!id) continue;
    let m = byMember.get(id);
    if (!m) {
      m = { playerId: id, name: String(r.defenderName || `Player ${id}`),
            hits: 0, respectLost: 0, lastAt: 0, _attackers: new Set() };
      byMember.set(id, m);
    }
    m.hits += 1;
    m.respectLost += Math.max(0, Number(r.respectGain) || 0);
    if (ended > m.lastAt) m.lastAt = ended;
    if (r.attackerName) m._attackers.add(String(r.attackerName));
  }

  return [...byMember.values()]
    .map(m => ({
      playerId: m.playerId,
      name: m.name,
      hits: m.hits,
      // Rounded because respect carries two decimals and a list of them is
      // harder to read than it is precise.
      respectLost: Math.round(m.respectLost * 100) / 100,
      lastAt: m.lastAt,
      attackers: [...m._attackers],
    }))
    .sort((a, b) => b.respectLost - a.respectLost || b.hits - a.hits);
}
