// Stop re-asking Torn about a key it has already refused.
//
// The auth route called Torn on every attempt and remembered nothing, so a
// client retrying a wrong key hammered it indefinitely: one key failed 945
// times, another 127 in three days. Each attempt spent a request against the
// faction's rate limit and wrote a line to the error log, and the owner had no
// way to tell a loop from a person trying twice.
//
// Torn's code 2 is "Incorrect key" — the string itself is wrong. Retrying
// cannot make it right, so after a few refusals of the SAME key this answers
// locally instead of asking again.
//
// WHAT IT DELIBERATELY DOES NOT BLOCK:
//
//   code 5  (too many requests)  — a rate limit says nothing about the key
//   code 17 (backend error)      — Torn having a bad day
//   code 16 (access too low)     — a REAL key with the wrong permissions; the
//                                  owner fixes that in Torn without changing
//                                  the key string, and blocking it would
//                                  lock them out of the fix
//
// Counting any of those would lock people out during a Torn outage, which is
// exactly when they can least afford it.

import { createHash } from "crypto";

/** Refusals of the same key before we stop asking. People mistype once. */
export const THRESHOLD = 3;

/** How long a block lasts. Short, because it is a guess about intent. */
export const COOLDOWN_MS = 30 * 60 * 1000;

/**
 * Torn error codes that mean the key string is wrong, permanently.
 *
 * Only code 2. Everything else is either transient or fixable without
 * changing the key.
 */
const PERMANENT = new Set([2]);

const seen = new Map();   // fingerprint -> { count, until }

/**
 * A stable, non-reversible handle for a key.
 *
 * Hashed so nothing that reaches this module is holding a credential any
 * longer than the call that passed it in. Truncated because collisions across
 * a faction's worth of keys are not a realistic concern and a shorter value is
 * easier to log safely.
 */
export function fingerprint(key) {
  if (typeof key !== "string" || !key) return null;
  return createHash("sha256").update(key).digest("hex").slice(0, 24);
}

/**
 * Record the outcome of an authentication attempt.
 *
 * @param code Torn's error code, or 0/null on success.
 *
 * Success CLEARS the record: a key that works is not a key that was wrong,
 * and leaving a stale count behind would block somebody after an unrelated
 * run of failures.
 */
export function note(key, code, nowMs = Date.now()) {
  const fp = fingerprint(key);
  if (!fp) return;

  if (!code) { seen.delete(fp); return; }
  if (!PERMANENT.has(Number(code))) return;

  const rec = seen.get(fp) || { count: 0, until: 0 };
  rec.count += 1;
  if (rec.count >= THRESHOLD) rec.until = nowMs + COOLDOWN_MS;
  seen.set(fp, rec);
}

/**
 * Whether to refuse this key without asking Torn.
 *
 * The block follows the bad STRING, not the person — paste a corrected key and
 * it authenticates on the first attempt, because a different key hashes
 * differently and was never blocked.
 */
export function blocked(key, nowMs = Date.now()) {
  const fp = fingerprint(key);
  if (!fp) return { blocked: false };

  const rec = seen.get(fp);
  if (!rec || !rec.until) return { blocked: false };
  if (nowMs >= rec.until) { seen.delete(fp); return { blocked: false }; }

  const mins = Math.ceil((rec.until - nowMs) / 60000);
  return {
    blocked: true,
    count: rec.count,
    // Says what happened and what to do. A bare "blocked" sends somebody to
    // ask an admin; this sends them to their API key page.
    reason: `Torn rejected this key ${rec.count} times as incorrect. It is mistyped, or it was regenerated or deleted in Torn. Paste a fresh key from your Torn API key page — a new key works immediately. Not retrying for ${mins} more minute${mins === 1 ? "" : "s"}.`,
  };
}

/** How many keys are currently being refused locally, for diagnostics. */
export function stats(nowMs = Date.now()) {
  let active = 0;
  for (const rec of seen.values()) if (rec.until > nowMs) active += 1;
  return { tracked: seen.size, blocked: active };
}

/** Test seam. */
export function reset() { seen.clear(); }
