// The arithmetic behind /bloodbags: who keeps the faction's blood supply topped
// up and who takes more than they give. Pure: no I/O and no clock of its own,
// every input passed in, so the numbers a member reads about themselves can be
// checked here rather than inferred from a page.
// Spec: docs/superpowers/specs/2026-10-24-faction-blood-bag-board-design.md

// The eight blood types, in the order the filter lists them. Anything else Torn
// writes after "Blood Bag : " (Irradiated, for one) is not a bag this counts.
export const TYPES = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

// ── Reading a line ─────────────────────────────────────────────────────────
// Torn writes each member as a profile link, and not always the same way:
// `<a href = "http://www.torn.com/profiles.php?XID=1">Name</a>`, with spaces
// around the "=", and in older lines without the quotes. So the reader asks
// only for an anchor with an XID in it.
const LINK = String.raw`<a[^>]*?XID=(\d+)[^>]*>([^<]*)<\/a>`;
const TYPE = String.raw`(AB\+|AB-|A\+|A-|B\+|B-|O\+|O-)`;
const APOS = String.raw`(?:'|&#0?39;)`;
const QTY = String.raw`(\d+)\s*x\s+`;
const END = String.raw`\s*\.?\s*$`;

const FILL_TYPED = new RegExp(String.raw`^${LINK}\s+filled one of the faction${APOS}s Empty Blood Bags to create a Blood Bag : ${TYPE}${END}`);
const FILL_PLAIN = new RegExp(String.raw`^${LINK}\s+filled one of the faction${APOS}s Empty Blood Bag items${END}`);
const USE_TYPED = new RegExp(String.raw`^${LINK}\s+used one of the faction${APOS}s Blood Bag : ${TYPE} items${END}`);
const USE_PLAIN = new RegExp(String.raw`^${LINK}\s+used one of the faction${APOS}s Blood Bag items${END}`);
const DEPOSIT = new RegExp(String.raw`^${LINK}\s+deposited ${QTY}Blood Bag : ${TYPE}${END}`);
// "to themselves" or to a second profile link, and Torn adds "from the faction
// armory" to these.
const HAND_OUT = new RegExp(String.raw`^${LINK}\s+(gave|loaned) ${QTY}Blood Bag : ${TYPE} to (?:(themselves)|${LINK})(?: from the faction armou?ry)?${END}`);
const RETURNED = new RegExp(String.raw`^${LINK}\s+returned ${QTY}Blood Bag : ${TYPE}${END}`);
const RETRIEVED = new RegExp(String.raw`^${LINK}\s+retrieved ${QTY}Blood Bag : ${TYPE} from ${LINK}${END}`);

function rec(kind, m, type, qty, toId = null, toName = null) {
  return { kind, playerId: m[1], name: m[2].trim() || m[1], type, qty, toId, toName };
}
function count(s) {
  const n = parseInt(s, 10);
  return Number.isFinite(n) && n >= 1 ? n : null;
}

/**
 * One armoury news line, as { kind, playerId, name, type, qty, toId, toName },
 * or null when it is not a blood-bag line this board counts.
 *   fill, deposit         given
 *   use, gave, loaned     used (a hand-out by whoever got the bags: toId)
 *   returned, retrieved   used cancelled (a retrieval for toId, the member it
 *                         was taken back from)
 * type is null on fills from before Torn named the type, about April 2026.
 */
export function parseLine(text) {
  const s = String(text || "").trim();
  let m;
  if ((m = s.match(FILL_TYPED))) return rec("fill", m, m[3], 1);
  if ((m = s.match(FILL_PLAIN))) return rec("fill", m, null, 1);
  if ((m = s.match(USE_TYPED))) return rec("use", m, m[3], 1);
  if ((m = s.match(USE_PLAIN))) return rec("use", m, null, 1);
  if ((m = s.match(DEPOSIT))) { const n = count(m[3]); return n && rec("deposit", m, m[4], n); }
  if ((m = s.match(HAND_OUT))) {
    const n = count(m[4]);
    if (!n) return null;
    return m[6] ? rec(m[3], m, m[5], n, m[1], m[2].trim() || m[1]) : rec(m[3], m, m[5], n, m[7], m[8].trim() || m[7]);
  }
  if ((m = s.match(RETURNED))) { const n = count(m[3]); return n && rec("returned", m, m[4], n); }
  if ((m = s.match(RETRIEVED))) { const n = count(m[3]); return n && rec("retrieved", m, m[4], n, m[5], m[6].trim() || m[5]); }
  return null;
}

/** The member a line counts for: whoever got the bags, for a hand-out or a retrieval. */
export function chargedTo(line) {
  return line.kind === "gave" || line.kind === "loaned" || line.kind === "retrieved" ? line.toId : line.playerId;
}

/**
 * A line that mentions a blood bag but that parseLine does not read. Empty
 * bags, irradiated bags and Box of Medical Supplies openings are left out on
 * purpose; anything else is a wording this reader has not met yet, which the
 * collector logs so it can be added.
 */
export function isUnreadBloodLine(text) {
  const s = String(text || "");
  return /Blood Bag/.test(s) && !/Empty Blood Bag|Irradiated|Box of Medical Supplies/.test(s) && parseLine(s) === null;
}

// ── Timeframes and types ───────────────────────────────────────────────────
// Days per timeframe; "all" runs from wherever the stored history reaches.
export const WINDOWS = { "24h": 1, "7d": 7, "30d": 30, "90d": 90, all: null };
export const DEFAULT_WINDOW = "7d";
const DAY = 86400;

/** The timeframe a request asked for: 7 days when missing, null when unknown. */
export function parseWindow(raw) {
  if (raw == null || raw === "") return DEFAULT_WINDOW;
  const w = String(raw).toLowerCase();
  return Object.prototype.hasOwnProperty.call(WINDOWS, w) ? w : null;
}

/** The blood type a request asked for: "all" when missing, null when unknown. */
export function parseType(raw) {
  if (raw == null || raw === "") return "all";
  // A "+" typed into an address bar arrives as a space, so "A+" reads "A ".
  const t = String(raw).replace(/ /g, "+").toUpperCase();
  if (t === "ALL") return "all";
  return TYPES.includes(t) ? t : null;
}

/** The seconds a timeframe covers, both ends included. */
export function windowRange(window, nowSec, reachSec) {
  const days = WINDOWS[window];
  return { fromSec: days == null ? Number(reachSec) || 0 : nowSec - days * DAY, toSec: nowSec };
}

// ── Ranked wars ────────────────────────────────────────────────────────────
// A war runs from its start to its end. Torn writes end: 0 for a war still
// going, so its span runs to now; a war that has not started yet has no span.
export function warSpans(wars, nowSec) {
  const out = [];
  for (const w of wars || []) {
    const start = Number(w && w.start) || 0;
    if (!start || start > nowSec) continue;
    out.push({ start, end: Number(w.end) > 0 ? Number(w.end) : nowSec });
  }
  return out;
}

/** The ranked war going on at nowSec, as { id, start }, or null. */
export function liveWar(wars, nowSec) {
  for (const w of wars || []) {
    const start = Number(w && w.start) || 0;
    if (start && start <= nowSec && !(Number(w.end) > 0 && Number(w.end) <= nowSec)) return { id: w.id, start };
  }
  return null;
}

// ── Per member ─────────────────────────────────────────────────────────────
/**
 * { given, used, usedInWars, net } per member id, over the lines whose time is
 * in [fromSec, toSec] and whose type passes the filter. Lines with no type
 * count under "all" only. warSpans comes from warSpans().
 *
 * Use is split into outside wars and during wars, and each part stops at zero.
 * A return cancels use but is not a gift: bags lent before the window, or lent
 * during a war and returned after it, would otherwise come out as net given.
 */
export function tally(lines, { fromSec, toSec, type = "all", warSpans: spans = [] } = {}) {
  const sums = new Map();
  for (const l of lines || []) {
    if (!(l.ts >= fromSec && l.ts <= toSec)) continue;
    if (type !== "all" && l.type !== type) continue;
    const id = String(chargedTo(l));
    let s = sums.get(id);
    if (!s) sums.set(id, (s = { given: 0, out: 0, war: 0 }));
    if (l.kind === "fill" || l.kind === "deposit") { s.given += l.qty; continue; }
    const n = l.kind === "returned" || l.kind === "retrieved" ? -l.qty : l.qty;
    if (spans.some((w) => l.ts >= w.start && l.ts <= w.end)) s.war += n;
    else s.out += n;
  }
  const out = new Map();
  for (const [id, s] of sums) {
    const usedOutside = Math.max(0, s.out);
    const usedInWars = Math.max(0, s.war);
    out.set(id, { given: s.given, used: usedOutside + usedInWars, usedInWars, net: s.given - usedOutside });
  }
  return out;
}

// ── The board ──────────────────────────────────────────────────────────────
const LIST_SIZE = 10;
const ZERO = Object.freeze({ given: 0, used: 0, usedInWars: 0, net: 0 });

// Ties go by name, ignoring case, then by id, so a tie always reads the same.
function byName(a, b) {
  const x = a.name.toLowerCase(), y = b.name.toLowerCase();
  if (x !== y) return x < y ? -1 : 1;
  return a.playerId < b.playerId ? -1 : a.playerId > b.playerId ? 1 : 0;
}
function ranked(rows, key) {
  return rows.slice(0, LIST_SIZE).map((r, i) => ({ rank: i + 1, playerId: r.playerId, name: r.name, value: r[key] }));
}

/**
 * Everything the page shows for one timeframe and blood type:
 *   { window, type, fromSec, toSec, overview, topGiven, topNet, wall, you }
 * lines are stored blood lines ({ ts, kind, type, qty, playerId, toId }),
 * roster today's members ([{ playerId, name }]) and wars Torn's ranked-war list
 * ([{ id, start, end }]). The lists hold current members only; the overview
 * counts everyone, former members too, so its totals match the armoury.
 */
export function buildBoard({ lines, roster, wars, nowSec, window, type, viewerId, reachSec }) {
  const { fromSec, toSec } = windowRange(window, nowSec, reachSec);
  const per = tally(lines, { fromSec, toSec, type, warSpans: warSpans(wars, nowSec) });

  const overview = { given: 0, used: 0, usedInWars: 0, net: 0, members: (roster || []).length };
  for (const r of per.values()) {
    overview.given += r.given;
    overview.used += r.used;
    overview.usedInWars += r.usedInWars;
    overview.net += r.net;
  }

  const members = (roster || []).map((m) => {
    const id = String(m.playerId);
    return { playerId: id, name: String(m.name || id), ...(per.get(id) || ZERO) };
  });
  const topGiven = members.filter((m) => m.given > 0).sort((a, b) => b.given - a.given || byName(a, b));
  const topNet = members.filter((m) => m.net > 0).sort((a, b) => b.net - a.net || byName(a, b));
  const wall = members.filter((m) => m.net < 0).sort((a, b) => a.net - b.net || byName(a, b));

  // The viewer's own line, even outside the top ten: their place among the
  // whole roster by net. Someone not on today's roster gets no place.
  let you = null;
  const mine = per.get(String(viewerId));
  if (mine && (mine.given || mine.used)) {
    const order = members.slice().sort((a, b) => b.net - a.net || byName(a, b));
    const at = order.findIndex((m) => m.playerId === String(viewerId));
    you = { rank: at >= 0 ? at + 1 : null, of: members.length, ...mine };
  }

  return {
    window, type, fromSec, toSec, overview,
    topGiven: ranked(topGiven, "given"),
    topNet: ranked(topNet, "net"),
    wall: ranked(wall, "net"),
    you,
  };
}
