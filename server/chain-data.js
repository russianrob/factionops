// Chain data is stored by ABSOLUTE end instant, not by seconds-remaining.
//
// Torn reports the chain as `timeout` — a countdown that decrements every
// second. Storing it verbatim meant war.chainData changed on every write, so
// the long-poll section hash changed every write too, which bumped the war
// version and released the held poll of EVERY faction member. The chain timer
// was effectively broadcasting a heartbeat to every member's phone once per
// second, keeping their radios out of idle for the whole chain.
//
// Storing `chainEndsAt` instead makes the record byte-stable between real
// events (a hit landing, a reset), so the long-poll only wakes on actual news.
// Clients count the remainder down off their own clock, which is also smoother
// than nudging it from the network. `timeout` is recomputed on the way out so
// older clients that still read it keep working unchanged.

// Two writers deriving an end instant from the same chain moments apart produce
// values a few hundred ms apart. Bucketing the HASH INPUT (never the stored
// value) keeps that jitter from counting as a change.
const JITTER_BUCKET_MS = 5000;

/**
 * Convert an incoming chain record into the stored form: absolute end instant,
 * with the volatile countdown and per-write timestamp removed. Idempotent, so
 * re-normalizing an already-stored record does not shift its deadline.
 */
export function normalizeChainData(chain, nowMs) {
  if (!chain || typeof chain !== "object") return chain;
  const { timeout, timestamp, ...rest } = chain;
  // Already normalized — keep the original deadline rather than re-deriving it
  // from a countdown that has since moved.
  if (Number.isFinite(rest.chainEndsAt)) return rest;
  const secs = Number(timeout);
  if (!Number.isFinite(secs)) return rest;
  // No chain running (Torn reports timeout: 0). Deriving "now + 0" would give
  // a deadline that advances on every poll, so an idle faction would keep
  // bumping the version and waking every member for nothing. 0 is a stable
  // sentinel meaning "no deadline"; chainWithLiveTimeout still reports 0.
  if (secs <= 0) return { ...rest, chainEndsAt: 0 };
  return { ...rest, chainEndsAt: nowMs + Math.round(secs * 1000) };
}

/**
 * The subset the long-poll hashes to decide "did anything change". Excludes
 * nothing by name — the stored form is already free of volatile fields — but
 * buckets the deadline so sub-bucket clock jitter between two pushing members
 * is not mistaken for news.
 */
export function chainHashKey(chain) {
  if (!chain || typeof chain !== "object") return chain;
  // serverTimestamp is a per-push epoch-seconds stamp that recordClientChainData
  // needs for staleness ordering, so it stays in storage — but it moves every
  // second, so including it here would bump the version on every push and undo
  // the entire fix.
  const { serverTimestamp, ...out } = chain;
  if (Number.isFinite(out.chainEndsAt)) {
    out.chainEndsAt = Math.round(out.chainEndsAt / JITTER_BUCKET_MS) * JITTER_BUCKET_MS;
  }
  return out;
}

/**
 * Outbound form: re-adds `timeout` (seconds remaining, floored at 0) derived
 * from the absolute deadline, for clients that predate chainEndsAt. Never
 * mutates the stored object — keeping storage stable IS the fix.
 */
export function chainWithLiveTimeout(chain, nowMs) {
  if (!chain || typeof chain !== "object") return chain;
  if (!Number.isFinite(chain.chainEndsAt)) return chain;
  const remainingMs = chain.chainEndsAt - nowMs;
  return { ...chain, timeout: Math.max(0, Math.round(remainingMs / 1000)) };
}
