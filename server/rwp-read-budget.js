// How many PAID reads a caller may trigger.
//
// The readers were members-only because each miss costs a model call. Opening
// them to everyone removes the thing that bounded the bill, so something else
// has to.
//
// The budget is spent ONLY on a cache miss. Both routes check their cache
// before reaching the paid path, and every cache is keyed by content — the
// post's text, or the image URL — with no player or faction in the key. So the
// first reader of a given post or screenshot pays for it and everyone after is
// free, forever. That is what makes opening it affordable: the cost is per
// distinct thing ever read, not per reader.
//
// Two ceilings, because they fail differently. The per-IP one stops a single
// caller looping; the global one is the backstop for many callers at once,
// which no per-IP limit can see.

const HOUR_MS = 60 * 60 * 1000;

// Per caller, per hour.
//
// 40 was a guess and it was wrong: the logs show 50 uncached text reads in a
// single hour of ordinary browsing, so the first figure would have cut a real
// reader off mid-thread. 150 is three times the observed peak — room for a
// heavier session without being a blank cheque.
//
// The cache is a smaller help than it looks, which is why this number has to
// carry the load: 85 uncached against 37 cached in the same window. Post text
// is nearly always unique, so a hit only comes from somebody revisiting the
// SAME post — common for a popular thread, rare across a forum.
export const PER_KEY_HOURLY = 150;
/** Everyone together, per hour. This is the figure that actually caps spend. */
export const GLOBAL_HOURLY = 1500;

/** Back-compat for anything still reading the old name. */
export const PER_IP_HOURLY = PER_KEY_HOURLY;

const _perIp = new Map();   // ip → { count, since }
let _global = { count: 0, since: 0 };

function roll(bucket, now) {
  if (!bucket.since || now - bucket.since > HOUR_MS) return { count: 0, since: now };
  return bucket;
}

/**
 * Claim one paid read. Returns null when allowed, or a reason when refused.
 * Call this at the point of spending, never before the cache is consulted.
 */
/**
 * Who this read is charged to.
 *
 * An IP is a poor identity here. A faction behind one NAT, or anyone on mobile
 * carrier CGNAT, shares it — the nginx rate limit was already raised once for
 * exactly that reason. A signed-in caller is charged to their player id
 * instead, so one member's heavy hour cannot lock out everybody at their
 * address. Anonymous callers fall back to the IP, which is all there is.
 */
export function budgetKey(ip, playerId) {
  return playerId ? "p:" + String(playerId) : "ip:" + String(ip || "unknown");
}

export function take(ip, now = Date.now()) {
  const g = roll(_global, now);
  if (g.count >= GLOBAL_HOURLY) {
    _global = g;
    return { error: "The reader is busy right now — try again shortly.", scope: "global" };
  }
  const key = String(ip || "unknown");
  const b = roll(_perIp.get(key) || { count: 0, since: now }, now);
  if (b.count >= PER_KEY_HOURLY) {
    _perIp.set(key, b);
    return { error: `You have read ${PER_KEY_HOURLY} new items this hour — already-read ones still work.`, scope: "ip" };
  }
  b.count += 1; b.since = b.since || now; _perIp.set(key, b);
  g.count += 1; g.since = g.since || now; _global = g;
  return null;
}

/** For diagnostics and tests. */
export function peek(ip, now = Date.now()) {
  const b = roll(_perIp.get(String(ip || "unknown")) || { count: 0, since: now }, now);
  const g = roll(_global, now);
  return { ip: b.count, global: g.count, perKeyLimit: PER_KEY_HOURLY, globalLimit: GLOBAL_HOURLY };
}

/** Tests only. */
export function _reset() { _perIp.clear(); _global = { count: 0, since: 0 }; }
