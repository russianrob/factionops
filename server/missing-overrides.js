// Per-faction in-memory record of "Missing-list false positives" — slots
// the OC Manager UI auto-detected (or an admin manually marked) as
// "user has the item, even though Torn API says is_available=false".
//
// Why this exists: the userscript's DOM-based auto-detect (v3.1.87)
// only works when the OC slots are currently rendered on the page —
// once the admin navigates away, the DOM unloads and the same Torn API
// false-positive comes back. Storing the detection server-side keeps
// the row hidden as long as the underlying state hasn't changed, AND
// shares the override across every admin in the faction.
//
// Storage: in-memory Map<factionId, Map<"userID:itemID", expiresAt>>.
//
// TTL: bumped 2026-05-07 from 30 min → 3 days. Override now lives long
// enough to span the entire OC lifecycle (planning → execution) so a
// detected false-positive doesn't pop back up every time the admin
// reopens the Missing tab over multiple days. Optional per-entry cap
// from the client (`crimeExpiresAt` — the OC's scheduled execution
// timestamp) shortens the TTL when the crime resolves sooner than
// 3 days, so a refreshed override doesn't outlive the OC it was
// recorded against.

const DEFAULT_TTL_MS = 3 * 24 * 60 * 60 * 1000;   // 3 days

/** factionId(string) → Map<"uid:iid", expiresAt(ms)> */
const _store = new Map();

function _key(uid, iid) { return `${String(uid)}:${Number(iid)}`; }

/** Record (factionId, userID, itemID) override.
 *  Optional `crimeExpiresAtMs` (the OC's scheduled execution time) caps
 *  the entry's lifetime to whichever is sooner: now+3d or expiresAt.
 *  This is how "until that crime is executed" gets enforced — once the
 *  crime runs, the override naturally lapses on the next read. */
export function recordOverride(factionId, userID, itemID, crimeExpiresAtMs = null) {
    const fid = String(factionId);
    if (!fid || !userID || !Number.isFinite(Number(itemID))) return;
    let m = _store.get(fid);
    if (!m) { m = new Map(); _store.set(fid, m); }
    const defaultExp = Date.now() + DEFAULT_TTL_MS;
    const cap = (crimeExpiresAtMs && Number.isFinite(Number(crimeExpiresAtMs)) && Number(crimeExpiresAtMs) > Date.now())
        ? Number(crimeExpiresAtMs)
        : Infinity;
    const expiresAt = Math.min(defaultExp, cap);
    m.set(_key(userID, itemID), expiresAt);
}

/** Return active (non-expired) overrides for the faction. Lazily prunes
 *  expired entries on read so we never accumulate forever-stale state. */
export function listOverrides(factionId) {
    const fid = String(factionId);
    const m = _store.get(fid);
    if (!m) return [];
    const now = Date.now();
    const out = [];
    for (const [k, exp] of m.entries()) {
        if (exp <= now) { m.delete(k); continue; }
        const [uid, iidStr] = k.split(':');
        out.push({ userID: uid, itemID: Number(iidStr), expiresAt: exp });
    }
    return out;
}

/** Clear ALL overrides for a faction. Not currently exposed via API
 *  (admins can wait for TTL or restart warboard), but kept available
 *  for future "force-refresh" wiring. */
export function clearOverrides(factionId) {
    _store.delete(String(factionId));
}
