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

/** Per caller, per hour. A busy thread's first visitor legitimately wants a few dozen. */
export const PER_IP_HOURLY = 40;
/** Everyone together, per hour. */
export const GLOBAL_HOURLY = 400;

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
export function take(ip, now = Date.now()) {
  const g = roll(_global, now);
  if (g.count >= GLOBAL_HOURLY) {
    _global = g;
    return { error: "The reader is busy right now — try again shortly.", scope: "global" };
  }
  const key = String(ip || "unknown");
  const b = roll(_perIp.get(key) || { count: 0, since: now }, now);
  if (b.count >= PER_IP_HOURLY) {
    _perIp.set(key, b);
    return { error: `You have read ${PER_IP_HOURLY} new items this hour — already-read ones still work.`, scope: "ip" };
  }
  b.count += 1; b.since = b.since || now; _perIp.set(key, b);
  g.count += 1; g.since = g.since || now; _global = g;
  return null;
}

/** For diagnostics and tests. */
export function peek(ip, now = Date.now()) {
  const b = roll(_perIp.get(String(ip || "unknown")) || { count: 0, since: now }, now);
  const g = roll(_global, now);
  return { ip: b.count, global: g.count, perIpLimit: PER_IP_HOURLY, globalLimit: GLOBAL_HOURLY };
}

/** Tests only. */
export function _reset() { _perIp.clear(); _global = { count: 0, since: 0 }; }
