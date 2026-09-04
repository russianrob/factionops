/**
 * Is a freshly-fetched enemy status worth telling the clients about?
 *
 * The profile sweep broadcast every successful fetch, changed or not. At the
 * 30s cadence that was 40 status objects a minute; at 2.5s it is 480, and the
 * overwhelming majority are identical to what the client already holds. The
 * cost lands on phones: a frame every 2.5s keeps the radio awake continuously,
 * which is a bigger power draw than the work of handling it.
 *
 * Naive equality does not work here, because two fields move on their own:
 *
 *   until      -- seconds REMAINING, so it falls by ~2.5 every tick. Counting
 *                 down is not news; the client anchors it to an absolute time
 *                 on receipt and ticks locally.
 *   lastAction -- a relative string ("5 minutes ago") that re-words itself.
 *
 * Suppressing a frame is safe because it is not the only path: a client gets
 * the full war record when it connects, and the 15-30s war-status poll
 * rebroadcasts every member regardless. This only removes repeats.
 */

// Move by themselves; compared specially or not at all.
const VOLATILE = new Set(["until", "lastAction", "lastAttackAt"]);

// `until` rising means a NEW hospitalisation rather than the old one draining.
// Small enough to catch a re-hospitalisation, large enough to ignore the
// jitter between the server's clock and Torn's.
export const UNTIL_JUMP_SEC = 5;

export function statusChanged(prev, next) {
  if (!next) return false;
  if (!prev) return true;               // first sighting is always news

  for (const k of Object.keys(next)) {
    if (VOLATILE.has(k)) continue;
    if (prev[k] !== next[k]) return true;
  }
  // Anything the client knows that this fetch no longer reports.
  for (const k of Object.keys(prev)) {
    if (VOLATILE.has(k)) continue;
    if (!(k in next)) return true;
  }

  const a = Number(prev.until) || 0;
  const b = Number(next.until) || 0;
  // Crossing zero either way is the moment that matters: in hospital, or out.
  if ((a > 0) !== (b > 0)) return true;
  // Jumping up is a fresh timer on top of the old one.
  if (b > a + UNTIL_JUMP_SEC) return true;
  return false;
}

/** Keep only the entries a client does not already have. */
export function changedOnly(batch, existingById) {
  const out = {};
  for (const [id, next] of Object.entries(batch || {})) {
    if (statusChanged((existingById || {})[id], next)) out[id] = next;
  }
  return out;
}
