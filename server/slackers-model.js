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

// Below this many days between the oldest and newest reading, a "window" would
// be noise: two readings a day apart say nothing about ninety.
export const ENERGY_MIN_SPAN_DAYS = 7;

/**
 * Gym energy is the one metric Torn will not hand over historically.
 * /v2/faction/contributors reports a CUMULATIVE total per member and its
 * `timestamp` parameter is a cache-buster, not a query — there is no way to ask
 * what somebody's number was in June. So a windowed figure can only ever be the
 * difference between two readings we took ourselves, and until enough of those
 * exist the honest answer is the lifetime average rather than an invented one.
 *
 * Four states, and the column always says which one it is in:
 *   unknown   — this member appears in no reading at all
 *   lifetime  — under 7 days of history: total ÷ days in faction
 *   partial   — a real delta over a span shorter than the window
 *   full      — a real delta over the whole window
 *   rejoined  — the counter reset mid-history (see below)
 *
 * The reset is the trap. Contributors values are per-membership: leave the
 * faction and rejoin, and the number starts again at zero. Subtracting across
 * that boundary reports a huge negative — a member who trained hard reading as
 * having trained nothing — so a reading lower than the one before it starts the
 * window over.
 */
export function energyForMember(readings, playerId, daysInFaction, nowMs, windowDays = 90) {
  const id = String(playerId);
  const mine = (readings || [])
    .filter((r) => r && r.members && r.members[id] && Number.isFinite(Number(r.members[id].energy)))
    .map((r) => ({ at: Number(r.at), energy: Number(r.members[id].energy) }))
    .sort((a, b) => a.at - b.at);

  if (!mine.length) return { mode: "unknown", energy: null, perDay: null, spanDays: 0 };

  const latest = mine[mine.length - 1];
  const cut = nowMs - windowDays * 86400000;

  let startIdx = 0;
  let rejoined = false;
  for (let i = 1; i < mine.length; i++) {
    if (mine[i].energy < mine[i - 1].energy) { startIdx = i; rejoined = true; }
  }

  // The oldest reading still inside the window — and never one from before a
  // reset, since that belongs to a different membership.
  let base = mine[startIdx];
  for (let i = startIdx; i < mine.length; i++) {
    base = mine[i];
    if (mine[i].at >= cut) break;
  }

  const spanDays = Math.round((latest.at - base.at) / 86400000);
  const days = Number(daysInFaction) || 0;

  if (spanDays < ENERGY_MIN_SPAN_DAYS) {
    return {
      mode: "lifetime",
      energy: latest.energy,
      perDay: days > 0 ? Math.round(latest.energy / days) : null,
      spanDays,
    };
  }

  const energy = latest.energy - base.energy;
  return {
    mode: rejoined ? "rejoined" : (spanDays >= windowDays ? "full" : "partial"),
    energy,
    perDay: spanDays > 0 ? Math.round(energy / spanDays) : null,
    spanDays,
  };
}
