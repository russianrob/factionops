// The estimate behind /hof's 3-month, 6-month and 1-year paces. Warboard's own
// snapshots start on 2026-09-18, so until they reach that far back a
// faction's respect on a past day is rebuilt from Torn's public chain and
// ranked-war records. Pure: bin/hof-estimate-build.mjs loads the records and
// writes the file. Design, and how far off it can be:
// docs/superpowers/specs/2026-10-22-hof-long-pace-windows-design.md.
import { addDays, dayMs } from "./hof-climb.js";

export const ESTIMATES_VERSION = 1;
// Our own faction's records show war losses coming to about a quarter of the
// enemy's score.
export const LOSS_PER_ENEMY_SCORE = 0.25;
const DAY_S = 86400;
const PAGE = 100;

// The share of [start, end] inside [t0, t1). Something with no length counts
// whole if it starts inside.
export function overlap(start, end, t0, t1) {
  if (!(end > start)) return start >= t0 && start < t1 ? 1 : 0;
  return Math.max(0, Math.min(end, t1) - Math.max(start, t0)) / (end - start);
}

// What the public records show faction `id` gaining in [t0, t1), in seconds:
// each chain's respect by the share of its time inside, the reward of each
// ranked war that ended inside, less a quarter of the enemy's score in each
// war by the share of the war inside. A war still running counts to openEnd.
export function publicGain({ id, chains, wars, rewards, t0, t1, openEnd }) {
  let gain = 0;
  for (const c of chains) gain += c.respect * overlap(c.start, c.end, t0, t1);
  for (const w of wars) {
    const enemy = w.factions.find((f) => String(f.id) !== String(id));
    if (enemy) gain -= LOSS_PER_ENEMY_SCORE * enemy.score * overlap(w.start, w.end || openEnd, t0, t1);
    if (w.end && w.end >= t0 && w.end < t1) gain += rewards[w.id];
  }
  return gain;
}

// Everything the records miss (organised crimes, territory, attacks outside
// chains) as one daily rate: the saved days' exact gain less what the
// records show over the same days.
export function unseenRate({ r0, rU, gain, days }) {
  return (rU - r0 - gain) / days;
}

// Why a faction's records can't be trusted for the whole range, or null when
// they can. Chain pages run newest first, so the last must be short of a full
// page, reach back to fromS, or repeat only chains already seen. The war list
// must reach back too, and every war that ended between fromS and fitS needs
// its report.
export function missingRecords({ chainPages, warList, rewards, fromS, fitS }) {
  if (!chainPages.length) return "no chain pages";
  const last = chainPages[chainPages.length - 1];
  const seen = new Set(chainPages.slice(0, -1).flat().map((c) => c.id));
  if (!(last.length < PAGE || last.some((c) => c.start <= fromS) || last.every((c) => seen.has(c.id)))) {
    return "chain pages stop short";
  }
  if (!warList) return "no war list";
  if (warList.length >= PAGE && !warList.some((w) => w.end && w.end < fromS)) return "war list stops short";
  const missing = warList.filter((w) => w.end && w.end >= fromS && w.end < fitS && !(w.id in rewards)).length;
  return missing ? `${missing} war report(s) missing` : null;
}

// est(t) = r(A0) − public(t, A0) − u × days(t, A0) for every day from `from`
// to the day before anchorDay (A0), in whole respect. u is fitted on A0 to
// fitDay, so the series meets the saved days with no step. Null when the
// records can't explain this faction: they add up to more than it gained
// over the fitted days, or a day comes out at 0 or below.
export function estimateSeries({ id, chains, wars, rewards, anchorDay, anchorRespect, fitDay, fitRespect, from }) {
  const A0 = dayMs(anchorDay) / 1000, AU = dayMs(fitDay) / 1000;
  const gain = (t0, t1) => publicGain({ id, chains, wars, rewards, t0, t1, openEnd: AU });
  const u = unseenRate({ r0: anchorRespect, rU: fitRespect, gain: gain(A0, AU), days: (AU - A0) / DAY_S });
  // Something the records don't show took respect away, and nothing says
  // when it did in the year before.
  if (u < 0) return null;
  const days = {};
  for (let d = from; d < anchorDay; d = addDays(d, 1)) {
    const t = dayMs(d) / 1000;
    const r = Math.round(anchorRespect - gain(t, A0) - u * (A0 - t) / DAY_S);
    if (!(r > 0)) return null;
    days[d] = r;
  }
  return { u, days };
}

// The file the daily job reads: each estimated day maps faction id to
// respect, the shape of a day file's `respect`, oldest day first.
export function estimatesFile({ series, builtAt, anchorDay, fitDay, band }) {
  const days = {};
  for (const id of Object.keys(series)) for (const [d, r] of Object.entries(series[id])) (days[d] ||= {})[id] = r;
  return {
    version: ESTIMATES_VERSION, builtAt, anchorDay, fittedTo: fitDay, band, factions: Object.keys(series).length,
    days: Object.fromEntries(Object.keys(days).sort().map((d) => [d, days[d]])),
  };
}
