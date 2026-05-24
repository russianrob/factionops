// Per-player pending-broadcast queue.
//
// Why this exists: PDA's WebView can't use SSE streaming (no
// GM_xmlhttpRequest onprogress) and Socket.IO connectivity is fragile
// in the InAppWebView, so PDA users fall back to plain HTTP polling
// of /api/poll. The poll response didn't include broadcast/shout
// events, which meant PDA users never received in-app toasts when
// other faction members shouted (only the system push notification,
// which only fires when the app is backgrounded).
//
// This module gives /api/broadcast a way to drop a copy of every
// shout into each faction member's queue, and gives /api/poll a way
// to drain that queue on every poll tick. Net effect: PDA users see
// shouts as in-app toasts within ~1 polling interval (~2s).
//
// Storage: in-memory only — broadcast events are ephemeral. If the
// server restarts mid-broadcast, in-flight messages are lost; that's
// acceptable since they were never persistent in the first place.

const QUEUE_CAP = 20;       // per-player cap to bound memory
const STALE_AFTER_MS = 5 * 60 * 1000;   // drop unread events older than 5 min

const _queues = new Map();   // playerId(string) → Array<event>

export function queueForPlayer(playerId, event) {
  const pid = String(playerId);
  let q = _queues.get(pid);
  if (!q) { q = []; _queues.set(pid, q); }
  q.push({ ...event, _queuedAt: Date.now() });
  if (q.length > QUEUE_CAP) q.splice(0, q.length - QUEUE_CAP);
}

export function queueForPlayers(playerIds, event) {
  for (const pid of (playerIds || [])) queueForPlayer(pid, event);
}

export function drainForPlayer(playerId) {
  const pid = String(playerId);
  const q = _queues.get(pid);
  if (!q || q.length === 0) return [];
  // Filter out stale entries (5+ min old) — clients shouldn't see
  // shouts that fired during a long disconnect.
  const cutoff = Date.now() - STALE_AFTER_MS;
  const fresh = q.filter(e => e._queuedAt >= cutoff);
  _queues.delete(pid);
  // Strip internal _queuedAt before returning to client.
  return fresh.map(({ _queuedAt, ...rest }) => rest);
}
