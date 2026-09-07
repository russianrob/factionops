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

// The four columns the page shows, in order. All are RATES, not totals: a total
// rewards being in the faction longer, which is what the tenure cutoff already
// accounts for.
export const METRICS = ["warHitsPerWar", "chainHitsPerWar", "xanaxPerWar", "energyPerDay"];

// What a flag can be built from — chain hits deliberately excluded.
//
// They are the non-war attacks made during a war: keeping the chain alive by
// hitting whoever is around. As a measure of effort they run BACKWARDS. In the
// war of 2026-09-03 the four members at the top of that column had 0, 0, 0 and
// 0 war hits between them — 49, 18, 15 and 9 non-war hits and nothing aimed at
// the enemy — while the faction's best hitter sat at 0.4 a war. Flagging people
// for being low on it punished exactly the people doing the job.
//
// The column stays on the page, because "0 war hits and 49 non-war hits" is the
// most useful thing a leader can put in front of somebody. It just cannot
// decide anything. (Owner's call, 2026-09-07.)
export const FLAG_METRICS = ["warHitsPerWar", "xanaxPerWar", "energyPerDay"];
export const FLAG_FRACTION = 0.5;   // "below half the median"
export const FLAG_MIN_METRICS = 2;  // "on two or more of them"

export function median(values) {
  const v = values.filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
  if (!v.length) return 0;
  const mid = Math.floor(v.length / 2);
  return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
}

/**
 * The whole report: one row per CURRENT member, medians over the eligible
 * cohort, and a flag on anyone who is well behind on more than one front.
 *
 * Judged against the faction's own median rather than fixed numbers, because a
 * quiet month drags every absolute threshold out of date — a slow war would
 * flag the entire faction, and a heavy one would flag nobody.
 *
 * The roster is the source of truth for WHO gets a row: someone who fought and
 * has since left is counted (as `formerMembers`) but not listed, since there is
 * no conversation to have with them.
 */
export function buildReport({ wars, roster, readings, nowMs, windowDays = 90, minDays = 100 }) {
  const kept = warsInWindow(wars, nowMs, windowDays);
  const presence = presenceByPlayer(kept);

  const totals = new Map();
  for (const w of kept) {
    for (const m of w.members || []) {
      const id = String(m.playerId);
      const t = totals.get(id) || { warHits: 0, chainHits: 0, xanax: 0 };
      t.warHits += Number(m.warHits) || 0;
      // breakdown.non_war — hits during the war that were not war hits, i.e.
      // chain building. The number the factionops payout section shows.
      t.chainHits += Number(m.breakdown?.non_war) || 0;
      t.xanax += Number(m.xanaxTaken) || 0;
      totals.set(id, t);
    }
  }

  const rosterIds = new Set((roster || []).map((r) => String(r.playerId)));
  let formerMembers = 0;
  for (const id of totals.keys()) if (!rosterIds.has(id)) formerMembers++;

  const rows = (roster || []).map((r) => {
    const id = String(r.playerId);
    const t = totals.get(id) || { warHits: 0, chainHits: 0, xanax: 0 };
    const present = presence.get(id) || 0;
    // Zero wars present is a real state, not an error — it is the loudest
    // signal on the page — so it returns 0 rather than dividing by it.
    const per = (n) => (present > 0 ? Math.round((n / present) * 10) / 10 : 0);
    const energy = energyForMember(readings, id, r.daysInFaction, nowMs, windowDays);
    return {
      playerId: id,
      name: r.name,
      level: r.level ?? null,
      position: r.position ?? "",
      daysInFaction: Number(r.daysInFaction) || 0,
      eligible: (Number(r.daysInFaction) || 0) >= minDays,
      warsPresent: present,
      warHits: t.warHits,
      chainHits: t.chainHits,
      xanax: t.xanax,
      warHitsPerWar: per(t.warHits),
      chainHitsPerWar: per(t.chainHits),
      xanaxPerWar: per(t.xanax),
      energy,
      energyPerDay: energy.perDay,
      flagged: false,
      reasons: [],
    };
  });

  const cohort = rows.filter((r) => r.eligible);
  const medians = {};
  for (const k of METRICS) medians[k] = median(cohort.map((r) => r[k]));

  // A metric whose median is zero is dropped from the comparison. "Below half
  // of zero" is unreachable, so leaving it in would let a dead metric silently
  // absorb one of the two strikes a flag needs, and nobody would ever be
  // flagged on the metrics that are alive.
  const live = FLAG_METRICS.filter((k) => medians[k] > 0);
  const need = Math.min(FLAG_MIN_METRICS, live.length || 1);

  for (const r of cohort) {
    if (r.warsPresent === 0) { r.flagged = true; r.reasons = ["no-wars"]; continue; }
    const below = live.filter((k) => Number(r[k] ?? 0) < medians[k] * FLAG_FRACTION);
    r.reasons = below;
    // War hits are the axis this report exists for; the other three are how
    // somebody gets there. Without this, the faction's best hitter was landing
    // on the list for not chaining and not taking Xanax — 54 hits a war against
    // a median of 23 is not a weak link, it is someone who fights without
    // vials. Above the median on war hits, nothing else can flag you.
    const carrying = medians.warHitsPerWar > 0 && r.warHitsPerWar > medians.warHitsPerWar;
    r.flagged = !carrying && live.length > 0 && below.length >= need;
  }

  return {
    rows,
    medians,
    liveMetrics: live,
    warsCounted: kept.length,
    cohortSize: cohort.length,
    formerMembers,
    windowDays,
    minDays,
    generatedAt: nowMs,
    wars: kept.map((w) => ({
      enemyFactionId: w.enemyFactionId,
      enemyFactionName: w.enemyFactionName,
      warStart: w.warStart,
      warResult: w.warResult ?? null,
    })),
  };
}
