// The assist requests a FactionOps poll still owes a member.
//
// /api/assist-request reaches SSE clients the moment it is sent. A copy that
// polls instead (/api/poll or /api/poll-long: every Torn PDA copy, and the app
// or a desktop whenever its stream is down) shows the `lastAssistRequest` in a
// poll reply while it is under a minute old. The server stopped sending that
// field in April 2026 (e97cdf77 dropped it in a rewrite), so from then on a
// polling member never saw an assist toast.
//
// Each request goes to each member once, on whichever poll of theirs comes
// next. A war-wide field would show it again on every page load for a minute,
// and every Torn navigation is a page load. Oldest first, because FactionOps
// drops a request older than the last one it showed. Never back to the member
// who asked: they already got "Assist request sent!".
//
// Keyed on whoever polls the war rather than the server's online list: a
// long-poll never puts its member on that list.
//
// In memory only, like the requests themselves: a restart loses at most a
// minute of them.

/** FactionOps shows an assist request only while it is younger than this. */
export const ASSIST_FRESH_MS = 60 * 1000;

// Per war. More than this many requests inside a minute is noise; keep the newest.
const PER_WAR_CAP = 10;

const _byWar = new Map(); // warId → [{ request, senderId, served: Set<playerId> }]

/** Remember a request so the war's polling members can be handed it. */
export function recordAssist(warId, request, senderId) {
  if (typeof warId !== "string") return; // only a string names a war
  let list = _byWar.get(warId);
  if (!list) { list = []; _byWar.set(warId, list); }
  list.push({ request, senderId: String(senderId), served: new Set() });
  if (list.length > PER_WAR_CAP) list.splice(0, list.length - PER_WAR_CAP);
}

// The war's requests still young enough to show, dropping the rest. The id is
// looked up as it comes, never through String(): a crafted query can make it
// an object that String() throws on (Express reads warId[toString]=x as one),
// and as a key that object just finds nothing.
function fresh(warId, now) {
  const list = _byWar.get(warId);
  if (!list) return [];
  const live = list.filter((e) => now - e.request.timestamp < ASSIST_FRESH_MS);
  if (live.length) _byWar.set(warId, live); else _byWar.delete(warId);
  return live;
}

function nextFor(warId, playerId, now) {
  const pid = String(playerId);
  return fresh(warId, now).find((e) => e.senderId !== pid && !e.served.has(pid)) || null;
}

/** True when a request is waiting for this member. Hands nothing out. */
export function hasAssistFor(warId, playerId, now = Date.now()) {
  return nextFor(warId, playerId, now) !== null;
}

/** The oldest request this member has not had yet, marked as had; or null. */
export function takeAssistFor(warId, playerId, now = Date.now()) {
  const e = nextFor(warId, playerId, now);
  if (!e) return null;
  e.served.add(String(playerId));
  return e.request;
}
