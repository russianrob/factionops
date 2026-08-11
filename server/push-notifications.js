/**
 * Web Push notification management for FactionOps.
 *
 * Stores push subscriptions per player and sends notifications
 * for war events (calls, chain alerts, hospital pops, etc.).
 * Per-player notification preferences control which alerts fire.
 *
 * @author RussianRob
 */

import webPush from "web-push";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ── VAPID Configuration ──────────────────────────────────────────────────

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || "mailto:admin@tornwar.com";

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webPush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  console.log("[push] Web Push configured with VAPID keys");
} else {
  console.warn("[push] VAPID keys not set — push notifications disabled");
}

// ── Notification Types ──────────────────────────────────────────────────

/**
 * All available notification types with default enabled state.
 * This is the canonical list — the settings UI reads from this.
 */
export const NOTIFICATION_TYPES = {
  target_called:   { label: "Target Calls",         description: "When a teammate calls a target",                    default: false },
  chain_alert:     { label: "Chain Break Alerts",    description: "When chain timer drops below 30s",                  default: true  },
  hospital_pop:    { label: "Hospital Pops",         description: "When an enemy target leaves the hospital",          default: false },
  bonus_imminent:  { label: "Bonus Milestones",      description: "When a bonus hit is 1–2 attacks away",              default: true  },
  call_stolen:     { label: "Call Contested",        description: "When someone else views a target you called",       default: true  },
  war_target:      { label: "War Target Reached",    description: "When faction hits the custom war target",           default: true  },
  enemy_attacking: { label: "Enemy Attacking",        description: "When an enemy is caught mid-attack by the poller",  default: false },
  enemy_surge:     { label: "Enemy Online Surge",     description: "When the enemy faction's online count jumps sharply (rallying)", default: false },
  stakeout_alert:  { label: "Stakeout Alerts",        description: "A watched player/faction hit a trigger (online, out of hospital, landed, revivable…)", default: true },
  torn_event: {
    label: "Torn Events",
    description: "Everything that happens to you in Torn — attacks, money, items, mail.",
    default: false,
  },
  restock_alert:   { label: "Foreign Restock Alerts", description: "When a watched foreign-shop item restocks (watchlist on the server)", default: false },
  // oc: true marks a type as OC-Spawn-only. The FactionOps settings UI
  // filters these out via /api/push/types so war-overlay users don't see
  // OC-specific toggles; they're managed instead from the /notifications
  // PWA, which hard-codes its own toggle list.
  vault_request:     { label: "Vault Requests",      description: "When a faction member requests money from the vault",          default: true, oc: true },
  oc_ready_to_spawn: { label: "OC Ready to Spawn",   description: "When an organized crime is fully filled and ready to spawn",   default: true, oc: true },
  oc_completed:      { label: "OC Completed",        description: "When an organized crime finishes (success or failure)",        default: true, oc: true },
};

// ── Subscription Storage ────────────────────────────────────────────────

const SUBS_FILE = join(__dirname, "data", "push-subscriptions.json");
const PREFS_FILE = join(__dirname, "data", "push-preferences.json");

/**
 * Map of playerId → PushSubscription[].
 * A player can have multiple devices subscribed.
 */
let subscriptions = {};

/**
 * Map of playerId → { target_called: bool, chain_alert: bool, ... }.
 * Missing keys inherit from NOTIFICATION_TYPES defaults.
 */
let preferences = {};

/** Load subscriptions from disk. */
export function loadSubscriptions() {
  try {
    if (existsSync(SUBS_FILE)) {
      subscriptions = JSON.parse(readFileSync(SUBS_FILE, "utf-8"));
      const total = Object.values(subscriptions).reduce((s, a) => s + a.length, 0);
      console.log(`[push] Loaded ${total} push subscriptions for ${Object.keys(subscriptions).length} players`);
    }
  } catch (err) {
    console.error("[push] Failed to load subscriptions:", err.message);
    subscriptions = {};
  }

  try {
    if (existsSync(PREFS_FILE)) {
      preferences = JSON.parse(readFileSync(PREFS_FILE, "utf-8"));
      console.log(`[push] Loaded preferences for ${Object.keys(preferences).length} players`);
    }
  } catch (err) {
    console.error("[push] Failed to load preferences:", err.message);
    preferences = {};
  }
}

/** Persist subscriptions to disk. */
function saveSubscriptions() {
  try {
    writeFileSync(SUBS_FILE, JSON.stringify(subscriptions, null, 2));
  } catch (err) {
    console.error("[push] Failed to save subscriptions:", err.message);
  }
}

/** Persist preferences to disk. */
function savePreferences() {
  try {
    writeFileSync(PREFS_FILE, JSON.stringify(preferences, null, 2));
  } catch (err) {
    console.error("[push] Failed to save preferences:", err.message);
  }
}

// ── Preferences API ─────────────────────────────────────────────────────

/**
 * Get a player's notification preferences (merged with defaults).
 * @param {string} playerId
 * @returns {Object} { target_called: bool, chain_alert: bool, ... }
 */
export function getPreferences(playerId) {
  const saved = preferences[playerId] || {};
  const result = {};
  for (const [type, config] of Object.entries(NOTIFICATION_TYPES)) {
    result[type] = saved[type] !== undefined ? saved[type] : config.default;
  }
  return result;
}

/**
 * Update a player's notification preferences.
 * @param {string} playerId
 * @param {Object} prefs - Partial map of type → bool
 */
export function setPreferences(playerId, prefs) {
  if (!preferences[playerId]) preferences[playerId] = {};
  for (const [type, enabled] of Object.entries(prefs)) {
    if (type in NOTIFICATION_TYPES && typeof enabled === "boolean") {
      preferences[playerId][type] = enabled;
    }
  }
  savePreferences();
}

/**
 * Check if a specific notification type is enabled for a player.
 * @param {string} playerId
 * @param {string} type - One of NOTIFICATION_TYPES keys
 * @returns {boolean}
 */
function isTypeEnabled(playerId, type) {
  const saved = preferences[playerId];
  if (saved && saved[type] !== undefined) return saved[type];
  return NOTIFICATION_TYPES[type]?.default ?? true;
}

// ── Public API ──────────────────────────────────────────────────────────

/**
 * Subscribe a player's device for push notifications.
 * @param {string} playerId
 * @param {object} subscription - PushSubscription from the browser
 */
export function subscribe(playerId, subscription) {
  if (!subscriptions[playerId]) {
    subscriptions[playerId] = [];
  }

  // Avoid duplicates (same endpoint)
  const exists = subscriptions[playerId].some((s) => s.endpoint === subscription.endpoint);
  if (!exists) {
    subscriptions[playerId].push(subscription);
    saveSubscriptions();
    console.log(`[push] Player ${playerId} subscribed (${subscriptions[playerId].length} devices)`);
  }
  return true;
}

/**
 * Unsubscribe a specific endpoint for a player.
 * @param {string} playerId
 * @param {string} endpoint - The endpoint URL to remove
 */
export function unsubscribe(playerId, endpoint) {
  if (!subscriptions[playerId]) return;
  subscriptions[playerId] = subscriptions[playerId].filter((s) => s.endpoint !== endpoint);
  if (subscriptions[playerId].length === 0) {
    delete subscriptions[playerId];
  }
  saveSubscriptions();
  console.log(`[push] Player ${playerId} unsubscribed endpoint`);
}

/**
 * Unsubscribe all endpoints for a player.
 * @param {string} playerId
 */
export function unsubscribeAll(playerId) {
  delete subscriptions[playerId];
  saveSubscriptions();
}

/**
 * Get the VAPID public key for client-side subscription.
 */
export function getPublicKey() {
  return VAPID_PUBLIC_KEY || null;
}

/**
 * Check if a player has any push subscriptions.
 * @param {string} playerId
 */
export function isSubscribed(playerId) {
  return !!(subscriptions[playerId] && subscriptions[playerId].length > 0);
}

/**
 * Get all player IDs that have active push subscriptions.
 * @returns {string[]}
 */
export function getSubscribedPlayerIds() {
  return Object.keys(subscriptions).filter((id) => subscriptions[id] && subscriptions[id].length > 0);
}

// ── Send Notifications ──────────────────────────────────────────────────

/**
 * Send a push notification to a specific player (all their devices).
 * Respects the player's notification type preference.
 * @param {string} playerId
 * @param {object} payload - { title, body, icon?, tag?, url?, data? }
 * @param {string} [notifType] - Notification type key for preference check
 * @param {object} [pushOptions] - web-push options (e.g. { urgency: 'high' })
 */
export async function sendToPlayer(playerId, payload, notifType, pushOptions) {
  // Check preference if a type is specified
  if (notifType && !isTypeEnabled(playerId, notifType)) return;

  // nativeOnly: deliver ONLY through FCM/APNs — i.e. as a warboard app banner —
  // and skip the Web Push channel. Without it a player subscribed to both the
  // PWA and the app gets two banners for the same event.
  if (pushOptions && pushOptions.nativeOnly) {
    await fanoutFcm([playerId], payload, notifType).catch(() => {});
    return;
  }

  // FCM/APNs fanout — independent native-app transport. Fire it BEFORE the
  // web-push early-returns below: a native-app-only user has NO web-push
  // subscription, so the `subs.length === 0` return (and the no-VAPID return)
  // would otherwise skip their banner entirely — the gap where app-only members
  // got no chain alerts. Pref/type gate already passed above; harmless no-op for
  // players without an FCM token.
  fanoutFcm([playerId], payload, notifType).catch(() => { /* logged inside */ });

  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return;

  const subs = subscriptions[playerId];
  if (!subs || subs.length === 0) return;

  const message = JSON.stringify(payload);

  // Collapse same-device duplicates. A player can be registered through
  // multiple PWAs (FactionOps + OC Spawn) on the same physical iPhone —
  // each PWA owns its own Service Worker and gets its own endpoint, but
  // both endpoints share the same push-provider hostname (e.g.
  // web.push.apple.com). Sending to both = two banners on one device,
  // which is almost never what the user wants. Group by hostname, keep
  // only the most-recently-added endpoint in each group. Genuinely
  // different devices (Apple iPhone + Mozilla Firefox + Google FCM
  // Android) live on different hostnames so each still gets its own
  // banner.
  const byHost = new Map();
  for (const sub of subs) {
    let host = '';
    try { host = new URL(sub.endpoint).host; } catch { host = sub.endpoint || ''; }
    byHost.set(host, sub);   // later entries overwrite earlier — most-recent wins
  }
  const sendList = Array.from(byHost.values());

  const expiredEndpoints = [];
  let sent = 0;
  let failed = 0;
  for (const sub of sendList) {
    try {
      await webPush.sendNotification(sub, message, pushOptions);
      sent++;
    } catch (err) {
      if (err.statusCode === 410 || err.statusCode === 404) {
        // Subscription expired (APNs/FCM returned 410 Gone or 404). Spec
        // says remove it. Log so we can tell the difference between
        // server-side removal and client-side permission revocation next
        // time a user reports "my notifications stopped."
        const shortEndpoint = (sub.endpoint || "").slice(-24);
        console.log(
          `[push] Removing expired subscription for player ${playerId} ` +
          `(endpoint …${shortEndpoint}, statusCode ${err.statusCode})`
        );
        expiredEndpoints.push(sub.endpoint);
      } else {
        failed++;
        console.error(`[push] Failed to send to ${playerId} (endpoint …${(sub.endpoint || "").slice(-24)}):`, err.message);
      }
    }
  }

  // Reap expired endpoints after the loop so we don't mutate the array
  // while iterating. Persist once.
  if (expiredEndpoints.length > 0) {
    subscriptions[playerId] = subs.filter((s) => !expiredEndpoints.includes(s.endpoint));
    if (subscriptions[playerId].length === 0) delete subscriptions[playerId];
    saveSubscriptions();
  }

  // Per-call success log. Answers "did the server actually fire that
  // notif?" the next time a missed alert gets reported. Absence of this
  // line means the pref/type/no-subs gate fired upstream — the function
  // returned without ever attempting a send. The "subs" count reflects
  // the post-collapse send list (1 per physical device), not raw
  // subscriptions[playerId].length.
  const collapsed = subs.length - sendList.length;
  console.log(
    `[push] sent ${notifType || 'no-type'} to ${playerId} ` +
    `(${sent}/${sendList.length} device(s)` +
    (collapsed > 0 ? `, ${collapsed} collapsed` : '') +
    (failed ? `, ${failed} failed` : '') +
    (expiredEndpoints.length ? `, ${expiredEndpoints.length} expired` : '') +
    `)`
  );

  // (FCM fanout now fires above, before the web-push early-returns, so
  // native-app-only users aren't skipped.)
}

// Lazy-loaded FCM fan-out. Imported on first call so the module load
// path stays clean even if fcm-subscriptions.js can't be loaded.
let _fcm = null;
async function fanoutFcm(playerIds, payload, notifType) {
  try {
    if (!_fcm) _fcm = await import('./fcm-subscriptions.js').catch(() => null);
    if (!_fcm) return;
    if (playerIds.length === 0) return;
    await _fcm.sendToPlayers(playerIds, {
      title: payload.title,
      body: payload.body,
      data: { ...(payload.data || {}), type: notifType || (payload.data?.type ?? '') },
    });
  } catch (e) {
    console.warn('[push] FCM fanout failed:', e.message);
  }
}

/**
 * Send a push notification to multiple players (preference-aware).
 * @param {string[]} playerIds
 * @param {object} payload - { title, body, icon?, tag?, url?, data? }
 * @param {string} [notifType] - Notification type key for preference check
 * @param {object} [pushOptions] - web-push options (e.g. { urgency: 'high' })
 */
export async function sendToPlayers(playerIds, payload, notifType, pushOptions) {
  // sendToPlayer handles both Web Push and FCM fanout, so this is just
  // a parallel map. Per-player FCM cost is negligible (1 RPC per call
  // regardless of recipient count when batched at the firebase-admin
  // layer; even the per-player split is cheap).
  await Promise.allSettled(playerIds.map((id) => sendToPlayer(id, payload, notifType, pushOptions)));
}

/**
 * Send a push notification to all subscribed players in a war (preference-aware).
 * @param {Function} getPlayersForWar - Returns array of { id, name }
 * @param {string} warId
 * @param {object} payload
 * @param {string} [notifType] - Notification type key
 * @param {string} [excludePlayerId] - don't notify this player (the actor)
 * @param {object} [pushOptions] - web-push options (e.g. { urgency: 'high' })
 */
export async function sendToWar(getPlayersForWar, warId, payload, notifType, excludePlayerId, pushOptions) {
  const warPlayers = getPlayersForWar(warId);
  if (!warPlayers || warPlayers.length === 0) return;

  const targets = warPlayers
    .map((p) => p.playerId || p.id)
    .filter((id) => id !== excludePlayerId && isSubscribed(id));

  if (targets.length > 0) {
    await sendToPlayers(targets, payload, notifType, pushOptions);
  }
}

// ── War Event Helpers ───────────────────────────────────────────────────

/** Check if the war has officially started. */
async function hasWarStarted(warId) {
  const store = await import('./store.js');
  const war = store.getWar(warId);
  if (!war) return false;
  if (!war.warStart) return true; // fallback if start time unknown
  const nowSec = Math.floor(Date.now() / 1000);
  return nowSec >= war.warStart;
}

/** Check if the war has ended. Used to gate chain panic / alert
 *  notifications that should stop after the war is over — factions
 *  often keep chaining post-war for the bonus, but the panic urgency
 *  is gone and the push notifications become noise on PDA / FCM. */
async function hasWarEnded(warId) {
  const store = await import('./store.js');
  const war = store.getWar(warId);
  if (!war) return false;
  return war.warEnded === true;
}

/**
 * Notify war room that a target was called.
 */
export async function notifyTargetCalled(warPlayers, warId, callerName, targetName, excludePlayerId, targetId) {
  if (!(await hasWarStarted(warId))) return;
  await sendToWar(
    () => warPlayers,
    warId,
    {
      title: "🎯 Target Called",
      body: `${callerName} called ${targetName}`,
      tag: `call-${targetName}`,
      icon: "/icon-192.png",
      // targetId lets sw.js resolve the attack page on tap — without it the
      // "Attack" action button falls back to the faction war page.
      data: { type: "call", warId, targetId },
    },
    "target_called",
    excludePlayerId,
  );
}

/**
 * Notify war room about chain danger.
 */
export async function notifyChainAlert(warPlayers, warId, current, timeout, timeLeft) {
  if (!(await hasWarStarted(warId))) return;
  if (await hasWarEnded(warId)) return;
  const playerIds = warPlayers.map((p) => p.playerId || p.id);
  await sendToPlayers(
    playerIds.filter((id) => isSubscribed(id)),
    {
      title: "🚨 CHAIN BREAKING!",
      body: `Chain ${current} — ${timeLeft}s remaining! Attack now!`,
      tag: "chain-alert",
      icon: "/icon-192.png",
      data: { type: "chain-alert", warId },
    },
    "chain_alert",
    { urgency: "high", TTL: 30 },
  );
}

/**
 * PANIC alert — chain is about to die (< 30s).
 */
export async function notifyChainPanic(warPlayers, warId, current, timeLeft) {
  if (!(await hasWarStarted(warId))) return;
  if (await hasWarEnded(warId)) return;
  const playerIds = warPlayers.map((p) => p.playerId || p.id);
  await sendToPlayers(
    playerIds.filter((id) => isSubscribed(id)),
    {
      title: `🔴 CHAIN DYING! ${timeLeft}s!`,
      body: `Chain ${current} is about to break! ${timeLeft}s left — HIT NOW!`,
      tag: "chain-panic",
      icon: "/icon-192.png",
      data: { type: "chain-panic", warId },
    },
    "chain_alert",
    { urgency: "high", TTL: 15 },
  );
}

/**
 * Notify a specific player that a target left hospital.
 */
export async function notifyHospitalPop(playerId, targetName, targetId) {
  // Hospital pops are useful regardless of war state (e.g. chaining before war)
  await sendToPlayer(playerId, {
    title: "🏥 Target Out of Hospital",
    body: `${targetName} just left the hospital — attack now!`,
    tag: `hosp-${targetId}`,
    icon: "/icon-192.png",
    data: { type: "hospital-pop", targetId },
  }, "hospital_pop");
}

/**
 * Notify war room about a bonus hit milestone approaching.
 */
export async function notifyBonusImminent(warPlayers, warId, current, nextBonus) {
  if (!(await hasWarStarted(warId))) return;
  const playerIds = warPlayers.map((p) => p.playerId || p.id);
  await sendToPlayers(
    playerIds.filter((id) => isSubscribed(id)),
    {
      title: "💥 Bonus Hit Imminent",
      body: `Chain at ${current}/${nextBonus} — bonus hit incoming!`,
      tag: "bonus-alert",
      icon: "/icon-192.png",
      data: { type: "bonus", warId },
    },
    "bonus_imminent",
  );
}

/**
 * Fired when a war ends — tells every player's service worker to
 * dismiss any sticky chain-alert / chain-panic notifications still
 * pinned from before the war ended. Without this, the
 * `requireInteraction: true` flag on chain alerts in sw.js leaves
 * notifications pinned to the OS notification panel until manually
 * dismissed, which surfaces 1-2 day old alerts at random. Service
 * worker handles `data.type === "clear-chain-alerts"` by enumerating
 * notifications and calling .close() on the chain-tagged ones.
 *
 * Always shows a brief, low-priority summary notification along with
 * the clear because iOS Web Push will revoke a subscription that
 * delivers a payload without showing anything to the user.
 */
export async function notifyClearChainAlerts(warPlayers, warId, warResult) {
  const playerIds = warPlayers.map((p) => p.playerId || p.id);
  const subtitle = warResult === 'victory' ? '🏆 Victory'
                : warResult === 'defeat'  ? '💀 Defeat'
                : '⚖️ Draw';
  await sendToPlayers(
    playerIds.filter((id) => isSubscribed(id)),
    {
      title: `${subtitle} — chain alerts cleared`,
      body: "War ended. Sticky chain notifications dismissed.",
      tag: "chain-cleared",
      icon: "/icon-192.png",
      data: { type: "clear-chain-alerts", warId },
    },
    "chain_alert", // re-use chain_alert pref so opt-outs cascade naturally
    { urgency: "low", TTL: 60 },
  );
}

/**
 * Notify the war room that the count of online enemies just jumped
 * sharply — i.e. the enemy is rallying. Suppressed post-war (matches
 * chain-panic gating) since a surge after the war's over is just
 * noise. Per-faction config (threshold/window/cooldown) is enforced
 * in enemy-surge-monitor.js, not here.
 */
export async function notifyEnemySurge(warPlayers, warId, online, delta, windowSec) {
  if (!(await hasWarStarted(warId))) return;
  if (await hasWarEnded(warId)) return;
  const playerIds = warPlayers.map((p) => p.playerId || p.id);
  await sendToPlayers(
    playerIds.filter((id) => isSubscribed(id)),
    {
      title: "🚨 Enemy Online Surge",
      body: `+${delta} enemies came online in the last ${windowSec}s — ${online} now active`,
      tag: "enemy-surge",
      icon: "/icon-192.png",
      data: { type: "enemy-surge", warId, online, delta, windowSec },
    },
    "enemy_surge",
    { urgency: "high", TTL: 60 },
  );
}

/**
 * Notify a player that someone else is viewing their called target.
 */
export async function notifyCallStolen(playerId, viewerName, targetName, targetId) {
  await sendToPlayer(playerId, {
    title: "👁️ Call Contested",
    body: `${viewerName} is viewing ${targetName} — you have this target called`,
    tag: `contested-${targetId}`,
    icon: "/icon-192.png",
    data: { type: "call-contested", targetId },
  }, "call_stolen");
}

/**
 * Notify all war members that the custom war target has been reached.
 */
export async function notifyWarTargetReached(warPlayers, warId, targetValue, currentLead) {
  const playerIds = warPlayers.map((p) => p.playerId || p.id);
  await sendToPlayers(
    playerIds.filter((id) => isSubscribed(id)),
    {
      title: "🎯 War Target Reached!",
      body: `Faction hit ${currentLead.toLocaleString()} / ${targetValue.toLocaleString()} respect — hold the line!`,
      tag: "war-target-reached",
      icon: "/icon-192.png",
      data: { type: "war-target", warId },
    },
    "war_target",
    { urgency: "high", TTL: 300 },
  );
}

/**
 * Notify faction members that an enemy has been caught mid-attack
 * (via the per-enemy profile round-robin poller). Respects each
 * subscriber's enemy_attacking preference; defaults to OFF so only
 * users who explicitly opt in get pinged.
 */
export async function notifyEnemyAttacking(playerIds, warId, targetName, targetId) {
  const subscribed = playerIds
    .filter((id) => isSubscribed(id))
    .filter((id) => isTypeEnabled(id, "enemy_attacking"));
  if (subscribed.length === 0) return;
  await sendToPlayers(
    subscribed,
    {
      title: `⚠️ Enemy Attacking`,
      body: `${targetName} is mid-swing`,
      tag: `enemy_attacking_${targetId}`, // collapse duplicates on same target
      icon: "/icon-192.png",
      data: {
        type: "enemy_attacking",
        warId,
        targetId,
        url: `https://www.torn.com/page.php?sid=attack&user2ID=${targetId}`,
      },
    },
    null,
    { urgency: "normal", TTL: 120 },
  );
}

/**
 * Notify faction members that someone needs assist on an attack, or
 * wants retaliation against a specific player (profile-page retal).
 * `mode` = "assist" (default) or "retal".
 */
export async function notifyAssistRequest(playerIds, warId, playerName, targetName, targetId, mode) {
  const isRetal = mode === "retal";
  await sendToPlayers(
    playerIds.filter((id) => isSubscribed(id)),
    {
      title: isRetal ? `⚠️ Retal Requested!` : `⚔️ Assist Needed!`,
      body: isRetal
        ? `${playerName} wants retal on ${targetName}`
        : `${playerName} needs help attacking ${targetName}!`,
      tag: isRetal ? "retal_request" : "assist_request",
      icon: "/icon-192.png",
      data: {
        type: isRetal ? "retal_request" : "assist_request",
        warId,
        targetId,
        url: `https://www.torn.com/page.php?sid=attack&user2ID=${targetId}`,
      },
    },
    null, // Force delivery, bypass preferences
    { urgency: "high", TTL: 3600 },
  );
}

/**
 * Notify faction members about a broadcast.
 */
export async function notifyBroadcast(playerIds, warId, senderName, message) {
  await sendToPlayers(
    playerIds.filter((id) => isSubscribed(id)),
    {
      title: `📣 Broadcast from ${senderName}`,
      body: message,
      tag: `broadcast-${Date.now()}`,
      icon: "/icon-192.png",
      data: { type: "broadcast", warId },
    },
    null, // Force delivery, bypass preferences
    { urgency: "high", TTL: 3600 },
  );
}
