/**
 * Agent turns that outlive the connection that started them.
 *
 * The agent chat used to run inside the HTTP response: the iOS app held an
 * SSE stream open for the whole turn, and `res.on("close")` aborted it. iOS
 * suspends a backgrounded app after about thirty seconds, so putting the
 * phone down destroyed the turn mid-flight — not paused, destroyed, with
 * nothing to come back to.
 *
 * A turn is now a server-side object with a replayable event log. A
 * disconnect is just nobody listening for a while; the run continues and the
 * app replays from a cursor when it returns.
 *
 * There is deliberately NO limit on how long a turn may run — the owner asked
 * for none, so an abandoned turn runs to completion and costs what it costs.
 * The only reclamation here is of FINISHED turns' event logs, which is memory
 * housekeeping rather than a cap, and a running turn is never swept.
 */

/** How long a finished turn stays replayable, so a returning app can collect it. */
export const KEEP_FINISHED_MS = 30 * 60 * 1000;

const turns = new Map();          // id -> turn
let seq = 0;

function newId() {
  seq += 1;
  return "t" + Date.now().toString(36) + seq.toString(36);
}

export function start({ sessionId = null } = {}) {
  const id = newId();
  const ac = new AbortController();
  turns.set(id, {
    id,
    sessionId,
    status: "running",
    events: [],
    startedAt: Date.now(),
    endedAt: null,
    listeners: new Set(),
    controller: ac,
    signal: ac.signal,
  });
  return id;
}

export function get(id) {
  return turns.get(id) || null;
}

/** Append an event and wake anything currently following. */
export function append(id, event) {
  const t = turns.get(id);
  if (!t) return false;
  t.events.push(event);
  for (const fn of t.listeners) {
    try { fn(); } catch { /* a dead listener must not stop the turn */ }
  }
  return true;
}

/** Events the caller has not seen, plus the cursor to ask with next time. */
export function since(id, from = 0) {
  const t = turns.get(id);
  if (!t) return null;
  const start = Math.max(0, Math.min(from | 0, t.events.length));
  return {
    events: t.events.slice(start),
    next: t.events.length,
    status: t.status,
    sessionId: t.sessionId,
  };
}

export function finish(id, { sessionId = null, status = "done" } = {}) {
  const t = turns.get(id);
  if (!t || t.status !== "running") return false;
  t.status = status;
  t.endedAt = Date.now();
  if (sessionId) t.sessionId = sessionId;
  for (const fn of t.listeners) { try { fn(); } catch {} }
  return true;
}

/**
 * A socket went away. This is NOT a reason to stop — it is the whole point of
 * the change, and the line that used to abort here is what the fix removes.
 */
export function detach(id) {
  const t = turns.get(id);
  return !!t && t.status === "running";
}

/** The only thing that stops a turn early, and it has to be asked for. */
export function cancel(id) {
  const t = turns.get(id);
  if (!t || t.status !== "running") return false;
  try { t.controller.abort(); } catch {}
  t.status = "cancelled";
  t.endedAt = Date.now();
  for (const fn of t.listeners) { try { fn(); } catch {} }
  return true;
}

/** Follow a turn live; returns an unsubscribe. */
export function listen(id, fn) {
  const t = turns.get(id);
  if (!t) return () => {};
  t.listeners.add(fn);
  return () => { t.listeners.delete(fn); };
}

/**
 * The newest turn for a session, so an app that relaunched without its turn
 * id can still find what it was in the middle of.
 */
export function latestForSession(sessionId) {
  let best = null;
  for (const t of turns.values()) {
    if (t.sessionId !== sessionId) continue;
    if (!best || t.startedAt >= best.startedAt) best = t;
  }
  return best ? best.id : null;
}

/** Drop finished turns past their grace period. Running turns are untouched. */
export function _sweep(nowMs = Date.now()) {
  for (const [id, t] of turns) {
    if (t.status === "running") continue;
    if (nowMs - (t.endedAt || 0) > KEEP_FINISHED_MS) turns.delete(id);
  }
}

export function _reset() { turns.clear(); seq = 0; }
export function _count() { return turns.size; }

// Housekeeping only; never touches a running turn.
const sweeper = setInterval(() => _sweep(), 5 * 60 * 1000);
if (typeof sweeper.unref === "function") sweeper.unref();
