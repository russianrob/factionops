// The arithmetic behind /admin/slackers: who has been carrying the faction for
// the last 90 days and who has not. Pure — no IO, no clock of its own, every
// input passed in — so the numbers a leader reads out to a member can be
// checked here rather than inferred from a page.
//
// Three of the four metrics come straight out of war-history:
//   warHits              — ranked-war hits
//   breakdown.non_war    — hits during the war period that were not war hits,
//                          i.e. chain building. The same number the factionops
//                          payout section shows, and what the owner calls
//                          "chain hits".
//   xanaxTaken           — Xanax taken during the war
// The fourth, gym energy, is the one Torn will not hand over historically; see
// energyForMember.

/**
 * war-history keeps some wars TWICE — once keyed by the real war id
 * (`warKey: "47710"`, `realWarId: 47710`) and again as an archive snapshot
 * (`warKey: "archived_42055_38761_1787279169"`, `realWarId: null`). Same start,
 * same enemy, identical member figures.
 *
 * Over a 90-day window that was 19 stored entries for 13 real wars, so a naive
 * sum doubled six wars of hits, chain hits and Xanax for everyone who fought
 * them. Grouping on (enemy, start) is what makes the totals real.
 */
export function dedupeWars(wars) {
  const byPair = new Map();
  for (const w of wars || []) {
    if (!w) continue;
    const key = `${w.enemyFactionId}|${w.warStart}`;
    const prev = byPair.get(key);
    if (!prev) { byPair.set(key, w); continue; }
    const prevReal = prev.realWarId != null;
    const thisReal = w.realWarId != null;
    // The real-id entry is the canonical one; between two of the same kind,
    // the earlier capture is the one that was written while the war was live.
    if (thisReal && !prevReal) { byPair.set(key, w); continue; }
    if (thisReal === prevReal && (w.capturedAt || 0) < (prev.capturedAt || 0)) {
      byPair.set(key, w);
    }
  }
  return [...byPair.values()];
}

/** Deduped wars whose START falls inside the window, oldest first. */
export function warsInWindow(wars, nowMs, windowDays) {
  const cut = nowMs - windowDays * 86400000;
  return dedupeWars(wars)
    .filter((w) => Number(w.warStart) >= cut)
    .sort((a, b) => a.warStart - b.warStart);
}

/**
 * How many of those wars each player was actually there for. A member only
 * appears in a war's `members` array if they were in the faction when it was
 * captured, so this is a presence count without any extra data — and it is what
 * keeps a 100-day member from being judged against 13 wars they could not have
 * fought.
 */
export function presenceByPlayer(wars) {
  const seen = new Map();
  for (const w of wars || []) {
    for (const m of w.members || []) {
      const id = String(m.playerId);
      seen.set(id, (seen.get(id) || 0) + 1);
    }
  }
  return seen;
}
