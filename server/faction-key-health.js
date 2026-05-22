/**
 * Faction API key health monitor.
 *
 * Background loop probes every faction's stored API key against Torn's
 * /user?selections=basic endpoint. When a key returns code 2
 * ("Incorrect key"), it's been regenerated/revoked by its owner and is
 * silently failing every scout report + heatmap call that uses it.
 *
 * Notification gate: pushes a warning ONLY to the configured admin
 * playerId (env WB_KEY_HEALTH_ADMIN_PLAYER_ID), defaulting to 137558
 * (RussianRob, Dead Fragment owner). We don't broadcast to the whole
 * faction because most members can't update the faction key anyway —
 * surfacing it to admins keeps the noise off everyone else.
 *
 * De-duped: a given faction's "broken" state only notifies once per
 * 24h. When the key starts working again, the alert state resets so
 * a future break re-notifies.
 */

import { decrypt } from "./key-encryption.js";
import * as store from "./store.js";
import * as push from "./push-notifications.js";

const ADMIN_PLAYER_ID = String(
  process.env.WB_KEY_HEALTH_ADMIN_PLAYER_ID || "137558"
);
const POLL_INTERVAL_MS = Number(process.env.WB_KEY_HEALTH_POLL_MS) || 30 * 60 * 1000; // 30 min
const RENOTIFY_INTERVAL_MS = 24 * 3600 * 1000; // 24h
const lastNotifyAt = new Map(); // factionId → epoch ms

// Torn API error codes that mean the KEY ITSELF is broken (regenerated,
// revoked, downgraded, jailed-owner, etc) — these are the only ones
// worth waking the admin up about. Everything else is Torn-side
// transient noise (HTTP 5xx, rate limits, backend errors) that
// resolves on its own. https://www.torn.com/api.html
const PERSISTENT_BROKEN_CODES = new Set([
   1, // Empty key
   2, // Incorrect key
   6, // Incorrect ID
  10, // Key owner is in federal jail
  13, // Key temporarily disabled due to owner inactivity
  14, // Daily read limit reached
  16, // Access level of this key is not high enough
]);
// Transient — log a warning but DON'T notify. Includes code 17
// ("Backend error occurred") which is the one that mis-fired today.
const TRANSIENT_CODES = new Set([
   5, // Too many requests
   8, // IP block
   9, // API disabled
  15, // Temporary error
  17, // Backend error, please try again
]);

let _timer = null;
let _running = false;

async function probeKey(factionId) {
  const enc = store.getFactionApiKey(String(factionId));
  if (!enc) return { factionId, healthy: null, reason: "no-key-stored" };
  let plaintext;
  try { plaintext = decrypt(enc); }
  catch (e) { return { factionId, healthy: false, reason: `decrypt-failed: ${e.message}` }; }
  try {
    const url = `https://api.torn.com/user?selections=basic&key=${encodeURIComponent(plaintext)}&comment=wb-keyhealth`;
    const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
    const j = await r.json();
    if (j.error) return { factionId, healthy: false, reason: j.error.error, code: j.error.code };
    return { factionId, healthy: true, playerId: j.player_id };
  } catch (e) {
    return { factionId, healthy: null, reason: `fetch-failed: ${e.message}` };
  }
}

async function notifyBroken(factionId, reason) {
  const last = lastNotifyAt.get(String(factionId)) || 0;
  if (Date.now() - last < RENOTIFY_INTERVAL_MS) return;
  lastNotifyAt.set(String(factionId), Date.now());
  try {
    await push.sendToPlayer(ADMIN_PLAYER_ID, {
      title: "Warboard: Faction API key broken",
      body: `Faction ${factionId} key: ${reason}. Update it in faction settings.`,
      data: { type: "faction-key-health", factionId: String(factionId), reason },
    });
    console.log(`[key-health] notified admin ${ADMIN_PLAYER_ID} about faction ${factionId} (reason: ${reason})`);
  } catch (e) {
    console.warn(`[key-health] push to ${ADMIN_PLAYER_ID} failed: ${e.message}`);
  }
}

async function tick() {
  if (_running) return;
  _running = true;
  try {
    // Iterate every faction that has a stored key.
    const factionIds = store.listFactionApiKeyIds ? store.listFactionApiKeyIds() : [];
    if (factionIds.length === 0) return;
    for (const fid of factionIds) {
      const result = await probeKey(fid);
      if (result.healthy === false) {
        const code = result.code;
        // Only notify on persistent / key-actually-broken codes.
        // Transient Torn-side codes (17 etc.) get a log warning but
        // don't wake the admin — they fix themselves on the next tick.
        if (code != null && TRANSIENT_CODES.has(code)) {
          console.warn(`[key-health] faction ${fid} transient Torn error (${result.reason}, code ${code}) — not notifying`);
        } else if (code == null || PERSISTENT_BROKEN_CODES.has(code)) {
          console.warn(`[key-health] faction ${fid} key BROKEN (${result.reason}, code ${code ?? "?"})`);
          await notifyBroken(fid, `${result.reason}${code != null ? ` (code ${code})` : ""}`);
        } else {
          // Unknown code — treat as transient by default to avoid
          // alert spam from new Torn API additions, but log loudly.
          console.warn(`[key-health] faction ${fid} unclassified error (${result.reason}, code ${code}) — treating as transient`);
        }
      } else if (result.healthy === true) {
        // Reset de-dup so a future break re-notifies.
        if (lastNotifyAt.has(String(fid))) {
          lastNotifyAt.delete(String(fid));
          console.log(`[key-health] faction ${fid} key recovered`);
        }
      }
    }
  } finally {
    _running = false;
  }
}

export function start() {
  if (_timer) return;
  console.log(`[key-health] starting (interval=${POLL_INTERVAL_MS / 1000}s, admin=${ADMIN_PLAYER_ID})`);
  // First probe after 60s so server boot finishes loading first.
  _timer = setTimeout(function loop() {
    tick().catch(e => console.error("[key-health] tick error:", e.message));
    _timer = setTimeout(loop, POLL_INTERVAL_MS);
  }, 60_000);
}

export function stop() {
  if (_timer) clearTimeout(_timer);
  _timer = null;
}
