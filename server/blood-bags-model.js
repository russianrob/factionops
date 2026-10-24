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
