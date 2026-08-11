/**
 * Per-war overdose detector.
 *
 * Piggybacks the war-status monitor's roster poll — NO extra API calls. During
 * an active war the monitor already fetches our faction's members with their
 * hospital status; an overdose puts a member in hospital with a description
 * containing "overdosing"/"overdosed" (Torn's OD hospital reason, confirmed
 * against TornTools' status table). We edge-detect the transition INTO that
 * state so one multi-hour OD is counted once, and accumulate a per-(warId,
 * playerId) count on war.odStats.
 *
 * Unlike xanax-tracker (armoury news), this reveals whether the war drug was
 * actually WASTED: an OD gives zero energy and benches the member for hours, so
 * a flagged xanax deficit that lines up with an OD is recklessness, not a
 * no-show.
 *
 * Shape:
 *   war.odStats = {
 *     lastPolledAt: ms epoch,
 *     byPlayer: { [playerId]: { name, count, active, firstAt, lastAt } }
 *   }
 * Only members who overdose at least once ever appear in byPlayer.
 */
import * as store from "./store.js";

// Matches "overdosing on Xanax" / "Overdosed" in the hospital description.
const OVERDOSE_RE = /overdos/i;

/** True when a member status snapshot indicates they are currently overdosing. */
export function isOverdosing(member) {
  if (!member) return false;
  const state = String(member.status || "").toLowerCase();
  const desc = String(member.description || "");
  return state === "hospital" && OVERDOSE_RE.test(desc);
}

/**
 * Pure reducer: fold a fresh roster snapshot into odStats, edge-counting new
 * overdoses. `members` is the id→{name,status,description} map returned by
 * fetchFactionMembers. `now` is ms epoch (injected for testability). Members
 * who are not overdosing and have never overdosed are left out entirely.
 */
export function applyRoster(odStats, members, now) {
  const byPlayer = { ...((odStats && odStats.byPlayer) || {}) };
  for (const [id, m] of Object.entries(members || {})) {
    const od = isOverdosing(m);
    const prev = byPlayer[id];
    if (od) {
      if (prev && prev.active) {
        // Same OD still in progress — refresh name/lastAt, do not re-count.
        byPlayer[id] = { ...prev, name: m.name || prev.name, lastAt: now };
      } else {
        // Transition into an OD (fresh, or ODs again after recovering).
        byPlayer[id] = {
          name: m.name || (prev && prev.name) || String(id),
          count: ((prev && prev.count) || 0) + 1,
          active: true,
          firstAt: (prev && prev.firstAt) || now,
          lastAt: now,
        };
      }
    } else if (prev && prev.active) {
      // Recovered — clear the active latch so the next OD counts again.
      byPlayer[id] = { ...prev, active: false, name: m.name || prev.name };
    }
    // else: not overdosing and never has — nothing to record.
  }
  return { lastPolledAt: now, byPlayer };
}

/**
 * Merge a roster snapshot into the stored war.odStats and persist. Called by
 * the war-status monitor once every ~2 min with the same roster it already
 * fetched for the online/idle counters.
 */
export function recordRoster(warId, members) {
  const war = store.getWar(warId);
  if (!war) return null;
  war.odStats = applyRoster(war.odStats, members, Date.now());
  store.saveState();
  return war.odStats;
}

/** Read accumulated OD stats for a war. Safe when none exist. */
export function getOdStats(warId) {
  const war = store.getWar(warId);
  if (!war || !war.odStats) return { lastPolledAt: 0, byPlayer: {} };
  return { lastPolledAt: war.odStats.lastPolledAt || 0, byPlayer: war.odStats.byPlayer || {} };
}
