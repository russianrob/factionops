import { createHash } from "node:crypto";

/// Cache key material for the OC analysis engines.
///
/// The engines were cached per faction on a 1h timer keyed only by faction id +
/// engine settings, so they never noticed the crime set itself changing. The
/// Failure Risk panel then showed an hour-old snapshot: it listed a crime the
/// faction no longer had while omitting six it did, including a fully-filled
/// Honey Trap — and displayed no hint that any of it was stale.
///
/// Fingerprinting the crimes fixes that without giving up caching: recompute
/// when the OCs actually change, reuse otherwise.

/// Stable digest of everything the engines actually read off a crime.
///
/// Sorted, so Torn's response ordering (which is not stable) doesn't cause a
/// spurious recompute on every poll. Filled-slot COUNT rather than the member
/// ids: a swap between two members of equal standing does not change the
/// analysis, and including ids would recompute far more often for no gain.
export function crimesFingerprint(crimes) {
  const list = Array.isArray(crimes) ? crimes : [];
  const parts = list.map((c) => {
    const slots = Array.isArray(c.slots) ? c.slots : [];
    const filled = slots.filter((s) => s && (s.user_id || (s.user && s.user.id))).length;
    return `${c.id ?? c.name}|${c.status}|${filled}/${slots.length}`;
  }).sort();
  return createHash("sha256").update(parts.join(";")).digest("hex").slice(0, 16);
}

/// Whether the cached engine output must be rebuilt.
///
/// The TTL is retained deliberately: the engines fold in OC history and
/// tornprobability role weights, both of which move without the crime set
/// changing at all. The fingerprint catches the fast-moving input, the TTL
/// catches the slow ones.
export function shouldRecompute(cached, { settingsHash, fingerprint, now, ttlMs }) {
  if (!cached) return true;
  if (cached.settingsHash !== settingsHash) return true;
  if (cached.fingerprint !== fingerprint) return true;
  return (now - cached.ts) > ttlMs;
}
