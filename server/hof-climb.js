// Hall of Fame respect climb: every number /hof shows.
//
// Pure: no I/O and no clock of its own. The daily job (hof-snapshots.js) hands
// it saved snapshots and gets the digest back, so the page has no arithmetic of
// its own to get wrong. The rules, and the reasons for them, are in
// docs/superpowers/specs/2026-10-19-hof-respect-climb-design.md.

export const DIGEST_VERSION = 1;
export const WINDOWS = [7, 30, 90];
export const HORIZONS = [7, 30, 91, 182, 365];
const DAY_MS = 86400000;

export const dayMs = (day) => Date.parse(day + "T00:00:00Z");
export const utcDay = (ms) => new Date(ms).toISOString().slice(0, 10);
export const addDays = (day, n) => utcDay(dayMs(day) + n * DAY_MS);
export const daysBetween = (from, to) => Math.round((dayMs(to) - dayMs(from)) / DAY_MS);

// ── number formats ────────────────────────────────────────────────────────
// Every band rounds a scaled whole number and builds the text from integers,
// so a binary fraction never decides which side of a boundary a value lands.
const sep = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");

export function fmtNum(v) {
  const a = Math.abs(v), s = v < 0 ? "-" : "";
  const whole = Math.round(a);
  if (whole === 0) return "0";
  if (whole < 10000) return s + sep(whole);
  const tenthsK = Math.round(a / 100);
  if (tenthsK < 1000) return s + Math.floor(tenthsK / 10) + "." + (tenthsK % 10) + "k";
  const k = Math.round(a / 1000);
  if (k < 1000) return s + k + "k";
  const hundredthsM = Math.round(a / 10000);
  return s + Math.floor(hundredthsM / 100) + "." + String(hundredthsM % 100).padStart(2, "0") + "M";
}

export function fmtPace(p) {
  if (!Number.isFinite(p)) return "—";
  // Halves away from zero, and a pace that rounds to nothing is "0", never "-0".
  const r = Math.sign(p) * Math.round(Math.abs(p));
  return (r < 0 ? "-" : "") + sep(Math.abs(r)) + "/day";
}

// ── positions, windows, paces ─────────────────────────────────────────────
// 1 + the factions with strictly more respect that the Hall of Fame shows,
// so a tie counts in the faction's favour.
export function positionOf(respect, hidden, id) {
  const key = String(id), mine = respect[key];
  if (!(mine > 0)) return null;
  const hide = new Set((hidden || []).map(String));
  let ahead = 0;
  for (const k in respect) if (respect[k] > mine && k !== key && !hide.has(k)) ahead++;
  return 1 + ahead;
}

export function historyEntry(day, data, us) {
  return { day, position: positionOf(data.respect, data.hidden, us), respect: data.respect[String(us)] ?? null };
}

// A window is offered only when a saved day sits close to L − w; further back,
// "7 days" would really be measuring a longer stretch.
export const windowLimit = (w) => w + Math.max(2, Math.ceil(w / 10));

export function resolveWindows(days, latest) {
  const out = {};
  for (const w of WINDOWS) {
    const target = addDays(latest, -w);
    let base = null;
    for (const d of days) if (d <= target) base = d;
    if (base === null) continue;
    const span = daysBetween(base, latest);
    if (span <= windowLimit(w)) out[w] = { base, span };
  }
  return out;
}

// byDay holds every saved day from the window's base to `latest`. A faction
// missing at the base is measured from the first saved day it appears on, so
// every pace is an exact difference between two snapshots. One seen only at
// `latest` gets no pace. Hidden factions get none either; a faction hidden at
// the base but visible now still uses its base respect.
export function pacesFor(byDay, latest, win) {
  const L = byDay[latest], B = byDay[win.base];
  const hide = new Set((L.hidden || []).map(String));
  const between = Object.keys(byDay).filter((d) => d > win.base && d < latest).sort();
  const out = {};
  for (const id in L.respect) {
    if (hide.has(id)) continue;
    const now = L.respect[id];
    if (B.respect[id] > 0) { out[id] = (now - B.respect[id]) / win.span; continue; }
    const first = between.find((d) => byDay[d].respect[id] > 0);
    if (first) out[id] = (now - byDay[first].respect[id]) / daysBetween(first, latest);
  }
  return out;
}
