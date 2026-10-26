// The weekly gym competition: Sunday 00:00 TCT to Saturday 23:59 TCT, scored on
// energy put through the gym.
//
// Torn reports a CUMULATIVE energy total per member and will not tell you what
// it was last Sunday — the `timestamp` parameter on contributors is a cache
// buster, not a query. So a week's score is the difference between two readings
// we took ourselves, and everything here is about picking the right two.
//
// TCT is UTC, so the week maths is plain UTC with no zone handling.

export const WEEK_MS = 7 * 86400000;

// Torn reports gym energy per STAT, and the four sum exactly to the total
// (70355 + 2310 + 15170 + 52485 = 140320, measured). Reading them separately
// costs the same four calls as reading the total plus the roster, and buys the
// split — which is the difference between "trained 580" and "trained 580, all
// dex".
export const STATS = ["str", "def", "spe", "dex"];

/**
 * "all dex", or "def 75% · dex 25%".
 *
 * Percentages are of what was trained THIS WEEK, not of anybody's lifetime, and
 * a stat that rounds to nothing is dropped rather than shown as 0%.
 */
export function splitLabel(deltas) {
  const parts = STATS.map((k) => ({ k, v: Number(deltas?.[k]) || 0 })).filter((p) => p.v > 0);
  const total = parts.reduce((n, p) => n + p.v, 0);
  if (!total) return null;
  if (parts.length === 1) return "all " + parts[0].k;
  parts.sort((a, b) => b.v - a.v);
  return parts
    .map((p) => ({ k: p.k, pct: Math.round((p.v / total) * 100) }))
    .filter((p) => p.pct > 0)
    .map((p) => p.k + " " + p.pct + "%")
    .join(" \u00b7 ");
}

/** The competition week containing `nowMs`: Sunday 00:00 → Saturday 23:59:59.999 TCT. */
export function weekWindow(nowMs) {
  const d = new Date(nowMs);
  const start = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - d.getUTCDay());
  return { start, end: start + WEEK_MS - 1 };
}

/**
 * The last reading taken at or before `atMs`.
 *
 * At or BEFORE matters for the start line: a reading taken after the window
 * opened already contains energy spent inside the window, so using it as the
 * baseline would silently subtract part of what somebody trained that week.
 */
export function latestUpTo(readings, atMs) {
  let best = null;
  for (const r of readings || []) {
    const at = Number(r.at);
    if (at <= atMs && (!best || at > Number(best.at))) best = r;
  }
  return best;
}

/**
 * The start line for a week, and whether it is a real one.
 *
 * Normally it is the last reading before the window opened. But a competition
 * that begins mid-week — or a poller that was down at midnight — has no such
 * reading, and the alternative is not "no leaderboard": it is the earliest
 * reading inside the week, with everyone measured from the same later moment.
 *
 * `late` is what stops that being a lie. Energy trained between midnight and
 * that first reading is invisible to the board, equally for everybody, and the
 * page says so rather than presenting a partial week as a whole one.
 */
export function baselineFor(readings, startMs) {
  const before = latestUpTo(readings, startMs);
  if (before) return { reading: before, late: false };
  let first = null;
  for (const r of readings || []) {
    if (!first || Number(r.at) < Number(first.at)) first = r;
  }
  return { reading: first, late: !!first };
}

/**
 * Energy trained between two readings, best first.
 *
 * A member missing from the baseline joined after the window opened. Their
 * lifetime total is NOT what they trained this week, and reporting it would put
 * a brand-new member on top with energy they spent in another faction. They are
 * listed, flagged, and scored zero rather than quietly ranked on a wrong number.
 */
export function standings(baseline, current) {
  if (!current) return [];
  const base = (baseline && baseline.members) || {};
  const rows = [];
  for (const [id, m] of Object.entries(current.members || {})) {
    const now = Number(m.energy) || 0;
    const had = base[id] ? Number(base[id].energy) : null;
    const name = m.name || String(id);
    if (had == null) { rows.push({ id: String(id), name, energy: 0, split: null, partial: true }); continue; }
    // A cumulative counter cannot fall. If it appears to, the reading is bad —
    // clamp at zero rather than showing a negative score.
    const b = base[id];
    const deltas = {};
    // Only when BOTH readings carry per-stat figures. Readings taken before the
    // split existed have none, and inventing one from a total would be a guess
    // dressed as a measurement.
    const haveSplit = STATS.every((k) => m[k] != null && b[k] != null);
    if (haveSplit) for (const k of STATS) deltas[k] = Math.max(0, (Number(m[k]) || 0) - (Number(b[k]) || 0));
    rows.push({
      id: String(id), name,
      energy: Math.max(0, now - had),
      split: haveSplit ? splitLabel(deltas) : null,
      partial: false,
    });
  }
  rows.sort((a, b) => b.energy - a.energy || String(a.name).localeCompare(String(b.name)));
  return rows;
}

/** Everyone tied at the top. Ties split the prize, so there can be more than one. */
export function winnersOf(rows) {
  const eligible = (rows || []).filter((r) => !r.partial && r.energy > 0);
  if (!eligible.length) return [];
  const top = eligible[0].energy;
  return eligible.filter((r) => r.energy === top);
}

/**
 * Freeze every week that has finished and is not recorded yet.
 *
 * Run on a schedule rather than on demand: once a week has rolled over, the
 * readings that define it are still on disk, so a late run still produces the
 * right answer — but only while they are retained, which is why this is checked
 * every poll rather than once on a Sunday somebody might miss.
 */
export function finaliseWeeks(readings, done, nowMs) {
  const out = [];
  if (!readings || !readings.length) return out;
  const seen = new Set((done || []).map((d) => Number(d.weekStart)));
  const currentStart = weekWindow(nowMs).start;
  const earliest = Math.min(...readings.map((r) => Number(r.at)));
  for (let start = weekWindow(earliest).start; start < currentStart; start += WEEK_MS) {
    if (seen.has(start)) continue;
    const end = start + WEEK_MS - 1;
    const fin = latestUpTo(readings, end);
    if (!fin) continue;
    // Readings from this week only: a week that began late is still scored,
    // from its first reading, rather than thrown away.
    const inWeek = readings.filter((r) => Number(r.at) >= start && Number(r.at) <= end);
    const { reading: base, late } = baselineFor(
      readings.filter((r) => Number(r.at) <= end), start);
    // Two readings are the minimum: with one, nothing happened BETWEEN
    // anything, and a winner would be invented rather than measured.
    if (!base || inWeek.length < (late ? 2 : 1) || Number(fin.at) <= Number(base.at)) continue;
    const rows = standings(base, fin);
    const winners = winnersOf(rows);
    if (!winners.length) continue;
    out.push({
      weekStart: start, weekEnd: end,
      winners, top: rows.filter((r) => !r.partial).slice(0, 10),
      baselineAt: Number(base.at), finalAt: Number(fin.at), lateStart: late,
    });
  }
  return out;
}

// ── The monthly ladder ──────────────────────────────────────────────────
// The calendar month in TCT, scored exactly like the week: energy trained
// between two of our own readings. It keeps the 25 best instead of a winner,
// and it carries no prize; the weekly Xanax is the only one.

export const MONTH_TOP = 25;

/** The calendar month containing `nowMs`: the 1st 00:00 → the last day 23:59:59.999 TCT. */
export function monthWindow(nowMs) {
  const d = new Date(nowMs);
  const start = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);
  return { start, end: Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1) - 1 };
}

/**
 * Energy trained this month, best first.
 *
 * The week's sums, with one difference: a member missing from the start line
 * is measured from their own first reading this month instead of being scored
 * zero. A week is short enough to sit out; a month is not, and scoring them
 * zero would leave somebody who joined on the 3rd off the ladder until the
 * next one. `joinedAt` is when that first reading was taken, so the page can
 * say so. Everyone who was at the start line has `joinedAt: null`.
 */
export function monthStandings(baseline, current, readings, startMs) {
  if (!current) return [];
  const rows = standings(baseline, current).map((r) => {
    if (!r.partial) return { ...r, joinedAt: null };
    // Their earliest reading inside the month, and never one after `current`:
    // the current reading itself if there is nothing earlier.
    let first = current;
    for (const x of readings || []) {
      const at = Number(x.at);
      if (at >= startMs && at < Number(first.at) && x.members && x.members[r.id]) first = x;
    }
    const [own] = standings({ members: { [r.id]: first.members[r.id] } },
                            { members: { [r.id]: current.members[r.id] } });
    return { ...own, joinedAt: Number(first.at) };
  });
  rows.sort((a, b) => b.energy - a.energy || String(a.name).localeCompare(String(b.name)));
  return rows;
}

/** The ladder itself: the best 25 who trained at all. Nobody is listed on zero. */
export function monthTop(rows) {
  return (rows || []).filter((r) => r.energy > 0).slice(0, MONTH_TOP);
}

/** The month in progress, as the page shows it. */
export function monthBoard(readings, nowMs) {
  const m = monthWindow(nowMs);
  // As with the week: no reading before the 1st means the month is measured
  // from its first reading instead, and `lateStart` tells the page so.
  const { reading: base, late } = baselineFor(readings, m.start);
  const now = latestUpTo(readings, nowMs);
  return {
    start: m.start, end: m.end,
    baselineAt: base ? Number(base.at) : 0,
    lateStart: late,
    currentAt: now ? Number(now.at) : 0,
    top: monthTop(monthStandings(base, now, readings, m.start)),
  };
}

/**
 * Save every month that has finished and is not saved yet.
 *
 * Unlike a week, a month is saved only if we have a reading from before its
 * 1st. A ladder measured from the 13th would be published as the month's and
 * be wrong for everyone on it. That rules out the month the readings began
 * (September 2026), and nothing after it.
 *
 * The finish line is the last reading at or before the next month's midnight,
 * which is the same reading the next month starts from. So no training falls
 * between two months, and none counts in both.
 */
export function finaliseMonths(readings, done, nowMs) {
  const out = [];
  if (!readings || !readings.length) return out;
  const seen = new Set((done || []).map((d) => Number(d.monthStart)));
  const currentStart = monthWindow(nowMs).start;
  const earliest = Math.min(...readings.map((r) => Number(r.at)));
  for (let start = monthWindow(earliest).start; start < currentStart; start = monthWindow(start).end + 1) {
    if (seen.has(start)) continue;
    const end = monthWindow(start).end;
    const base = latestUpTo(readings, start);
    const fin = latestUpTo(readings, end + 1);
    if (!base || !fin || Number(fin.at) <= Number(base.at)) continue;
    const top = monthTop(monthStandings(base, fin, readings, start));
    if (!top.length) continue;
    out.push({ monthStart: start, monthEnd: end, top, baselineAt: Number(base.at), finalAt: Number(fin.at) });
  }
  return out;
}
