/**
 * In-memory data store with JSON file persistence.
 *
 * All war state lives in memory for fast access. On every mutation the
 * full state is flushed to disk so the server can resume after a restart.
 */

import fs from "node:fs";
import path from "node:path";
import { encryptMap, decryptMap } from "./key-encryption.js";

const DATA_DIR = process.env.DATA_DIR || "./data";
const WARS_FILE = path.join(DATA_DIR, "wars.json");
const PLAYER_KEYS_FILE = path.join(DATA_DIR, "player-keys.json");
const FACTION_KEYS_FILE = path.join(DATA_DIR, "faction-keys.json");
const FACTION_SETTINGS_FILE = path.join(DATA_DIR, "faction-settings.json");
const KEY_POOL_FILE = path.join(DATA_DIR, "key-pool.json");
const PLAYER_FACTIONS_FILE = path.join(DATA_DIR, "player-factions.json");
const MEMBER_BARS_FILE = path.join(DATA_DIR, "member-bars.json");
const PAYOUT_SETTINGS_FILE = path.join(DATA_DIR, "payout-settings.json");

// v5.0.68: per-war payout-calc overrides (loot total, assist weight,
// non-war weight, payout %). Set via the gear panel in the Payouts
// modal; persisted across restarts. Map key = warId, value = sparse
// object — only the fields the admin overrode are present.
const payoutSettings = new Map();
export function loadPayoutSettings() {
  try {
    const raw = fs.readFileSync(PAYOUT_SETTINGS_FILE, "utf-8");
    const data = JSON.parse(raw);
    for (const [k, v] of Object.entries(data)) payoutSettings.set(String(k), v);
    if (payoutSettings.size > 0) console.log(`[store] Loaded ${payoutSettings.size} payout-setting(s)`);
  } catch (_) { /* file missing or corrupted — proceed empty */ }
}
function savePayoutSettings() {
  try {
    const obj = Object.fromEntries(payoutSettings);
    fs.writeFileSync(PAYOUT_SETTINGS_FILE, JSON.stringify(obj, null, 2));
  } catch (e) {
    console.error(`[store] Failed to persist payout-settings: ${e.message}`);
  }
}
export function getPayoutSettings(warId) {
  return payoutSettings.get(String(warId)) || null;
}
export function setPayoutSettings(warId, settings) {
  payoutSettings.set(String(warId), { ...settings, updatedAt: Date.now() });
  savePayoutSettings();
}
// lootOverride is specific to ONE war's looted total. The live war is keyed by
// the stable war_<factionId> key (reused every war), so without this the prior
// war's custom amount goes stale on the next war. Clears only the override —
// the faction's weight / payout-% config (policy) is intentionally preserved.
export function clearPayoutLootOverride(warId) {
  const s = payoutSettings.get(String(warId));
  if (!s || s.lootOverride == null) return false;
  const next = { ...s, updatedAt: Date.now() };
  delete next.lootOverride;
  payoutSettings.set(String(warId), next);
  savePayoutSettings();
  return true;
}

const factionSettings = new Map();

// ── In-memory maps ──────────────────────────────────────────────────────

/** @type {Map<string, import("./types.js").War>} warId → War */
const wars = new Map();

/**
 * Connected players – tracks live socket sessions.
 * @type {Map<string, { socketId: string, factionId: string, warId: string, name: string }>}
 * playerId → session info
 */
const players = new Map();

/**
 * Stored Torn API keys – one per player, used for server-side API calls.
 * @type {Map<string, string>} playerId → apiKey
 */
const apiKeys = new Map();

/**
 * Faction-dedicated API keys – one per faction, used for server-side polling.
 * @type {Map<string, string>} factionId → apiKey
 */
const factionApiKeys = new Map();

/**
 * Per-player opt-in for the server-side key pool. When enabled, the
 * player's stored API key is eligible for rotation across pollers
 * (chain, war-status, attacks-feed, etc.) scoped to their faction.
 * @type {Map<string, { enabled: boolean, factionId: string }>} playerId → opt
 */
const keyPoolingOpt = new Map();

/**
 * Last-known faction id per player, persisted across restarts. Updated
 * every successful /api/auth. Used for push notifications that need to
 * reach offline/disconnected faction members (e.g. retal requests).
 * @type {Map<string, string>} playerId → factionId
 */
const lastKnownFaction = new Map();

/**
 * Per-faction aggregated bars/cooldowns. Each entry is a snapshot of
 * one member's bars reported by their own FactionOps client.
 * @type {Map<string, Map<string, { bars, cooldowns, name, updatedAt }>>}
 * factionId → playerId → report
 */
const factionBars = new Map();

// ── Persistence helpers ─────────────────────────────────────────────────

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

/** Load persisted war state from disk (called once at startup). */
export function loadState() {
  ensureDataDir();
  if (!fs.existsSync(WARS_FILE)) return;

  try {
    const raw = fs.readFileSync(WARS_FILE, "utf-8");
    const data = JSON.parse(raw);
    for (const [id, war] of Object.entries(data)) {
      // Backfill fields that may be missing in wars created before they existed
      if (!war.priorities) war.priorities = {};
      if (!war.calls) war.calls = {};
      if (!war.enemyStatuses) war.enemyStatuses = {};
      if (!war.chainData) war.chainData = { current: 0, max: 0, timeout: 0, cooldown: 0 };
      if (!war.warTarget) war.warTarget = null;
      if (!war.enemyActivityLog) war.enemyActivityLog = [];
      if (!war.strategy) war.strategy = null;
      if (!war.enemyActivityByHour) war.enemyActivityByHour = null;
      wars.set(id, war);
    }
    console.log(`[store] Loaded ${wars.size} war(s) from disk`);
  } catch (err) {
    console.error("[store] Failed to load persisted state:", err.message);
  }
}

/** Persist current war state to disk. Called after every mutation. */
export function saveState() {
  ensureDataDir();
  try {
    const obj = Object.fromEntries(wars);
    fs.writeFileSync(WARS_FILE, JSON.stringify(obj, null, 2));
  } catch (err) {
    console.error("[store] Failed to persist state:", err.message);
  }
}

// ── War CRUD ────────────────────────────────────────────────────────────

export function getWar(warId) {
  return wars.get(warId) ?? null;
}

export function getOrCreateWar(warId, factionId, enemyFactionId = null) {
  if (wars.has(warId)) {
    const war = wars.get(warId);
    if (enemyFactionId && war.enemyFactionId !== enemyFactionId) {
      console.log(`[store] New enemy detected (${enemyFactionId}). Resetting stale war data.`);

      // ── Archive ended wars before we wipe them ──────────────────────
      // Prior bug: when a new opponent appeared, the placeholder entry
      // (key = `war_<factionId>`) was mutated in place — warEnded /
      // warEndedAt / warResult / warStart all got cleared, destroying
      // the previous war's finalized record forever. War-Payouts then
      // saw "no eligible wars" because the archive was empty.
      // Now: if the existing entry is ENDED, deep-clone it to a stable
      // archival key (real Torn war ID if we captured it; otherwise a
      // synthetic key) BEFORE we mutate. Active-war resets still wipe
      // (no historical record to preserve in that case).
      if (war.warEnded) {
        const archiveKey = pickArchiveKey(war, warId);
        if (archiveKey && archiveKey !== warId && !wars.has(archiveKey)) {
          // Deep clone — JSON is fine here; war data is plain values
          // (no Maps/Sets/Dates as values, just numbers/strings/objects).
          const archived = JSON.parse(JSON.stringify(war));
          archived.warId = archiveKey;
          archived.archivedAt = Date.now();
          archived.archivedFrom = warId;
          wars.set(archiveKey, archived);
          console.log(`[store] Archived ended war ${warId} → ${archiveKey} (vs ${war.enemyFactionName || war.enemyFactionId})`);
        } else if (archiveKey === warId) {
          console.log(`[store] Skipping archive — placeholder key already matches archive key (${warId})`);
        } else if (wars.has(archiveKey)) {
          console.log(`[store] Skipping archive — entry already exists at ${archiveKey}`);
        }
      }

      // Attempt to clear previous enemy's heatmap to prevent ghost data
      if (war.enemyFactionId) {
          import('./activity-heatmap.js').then(hm => hm.resetHeatmap(war.enemyFactionId)).catch(() => {});
      }

      war.enemyFactionId = enemyFactionId;
      war.calls = {};
      war.priorities = {};
      war.enemyStatuses = {};
      war.incomingRetals = [];
      war.warTarget = null;
      war.enemyActivityLog = [];
      war.strategy = null;
      war.enemyActivityByHour = null;
      war.chainData = { current: 0, max: 0, timeout: 0, cooldown: 0 };
      // 2026-05-17: xanaxStats was leaking across wars — when a new
      // opponent appeared, the previous war's per-member xanax counts
      // stayed on war.xanaxStats and the tracker added to them.
      // Result: post-war report for the NEW war showed combined counts
      // (previous war + current war). Wipe it on new-enemy detection
      // so each war starts clean.
      delete war.xanaxStats;
      delete war.status;
      delete war.ourScore;
      delete war.enemyScore;
      delete war.winner;
      delete war.warResult;
      delete war.warEnded;
      delete war.warEndedAt;
      delete war.warEta;
      delete war.realWarId;       // belongs to the previous opponent
      delete war.warStart;        // belongs to the previous opponent
      delete war.warScores;       // ditto
      delete war.enemyFactionName; // caller will overwrite with new name
      // New opponent = new war → reset the custom loot amount to auto so the
      // prior war's override doesn't linger on the reused war_<factionId> key.
      clearPayoutLootOverride(warId);
      saveState();
    }
    return war;
  }

  const war = {
    warId,
    factionId,
    enemyFactionId,
    calls: {},
    priorities: {},
    enemyStatuses: {},
    incomingRetals: [],
    chainData: { current: 0, max: 0, timeout: 0, cooldown: 0 },
    warTarget: null,
    enemyActivityLog: [],
    strategy: null,
    enemyActivityByHour: null,
  };
  wars.set(warId, war);
  saveState();
  return war;
}

export function getAllWars() {
  return wars;
}

/**
 * Archive-key picker for ended-war preservation. Prefers the real
 * Torn ranked-war ID (war.realWarId, captured by the war detector
 * when it sees rw.warId from the API). Falls back to a synthetic key
 * keyed by participants + end timestamp so each opponent gets its own
 * slot even if we never captured a real war ID.
 */
function pickArchiveKey(war, currentKey) {
  if (war.realWarId) return String(war.realWarId);
  if (war.warId && war.warId !== currentKey && !/^war_\d+$/.test(war.warId)) {
    return String(war.warId);
  }
  if (war.factionId && war.enemyFactionId && war.warEndedAt) {
    return `archived_${war.factionId}_${war.enemyFactionId}_${war.warEndedAt}`;
  }
  return null;
}

/**
 * Stamp the real Torn ranked-war ID onto an existing war entry so a
 * future enemy-change archive can use it as the archival key. Called
 * by the war detector after fetchRankedWar gives us rw.warId.
 */
export function recordRealWarId(warId, realWarId) {
  const war = wars.get(warId);
  if (!war || !realWarId) return false;
  if (String(war.realWarId) === String(realWarId)) return false;
  war.realWarId = String(realWarId);
  // A new ranked-war ID = a new war (covers same-opponent rematches that the
  // enemy-change reset misses) → reset the custom loot amount to auto.
  clearPayoutLootOverride(warId);
  saveState();
  return true;
}

// ── Player tracking ─────────────────────────────────────────────────────

export function setPlayer(playerId, info) {
  players.set(playerId, info);
}

export function getPlayer(playerId) {
  return players.get(playerId) ?? null;
}

export function removePlayerBySocket(socketId) {
  for (const [id, p] of players) {
    if (p.socketId === socketId) {
      players.delete(id);
      return { playerId: id, ...p };
    }
  }
  return null;
}

export function getOnlinePlayersForWar(warId) {
  const result = [];
  for (const [id, p] of players) {
    if (p.warId === warId) result.push({ id, name: p.name });
  }
  return result;
}

/** Set which target a player is currently viewing (attack page). */
export function setViewingTarget(playerId, targetId) {
  const p = players.get(playerId);
  if (p) {
    p.viewingTarget = targetId || null;
  }
}

/** Get a map of targetId → [{ id, name }] for all players viewing targets in a war. */
export function getViewersForWar(warId) {
  const viewers = {};
  for (const [id, p] of players) {
    if (p.warId === warId && p.viewingTarget) {
      if (!viewers[p.viewingTarget]) viewers[p.viewingTarget] = [];
      viewers[p.viewingTarget].push({ id, name: p.name });
    }
  }
  return viewers;
}

// ── API key storage ─────────────────────────────────────────────────────

export function storeApiKey(playerId, apiKey) {
  apiKeys.set(playerId, apiKey);
  savePlayerKeys();
}

/** Get any available API key for a faction (picks the first one found). */
export function getApiKeyForFaction(factionId) {
  for (const [playerId, key] of apiKeys) {
    const player = players.get(playerId);
    if (player && player.factionId === factionId) return key;
  }
  // Fallback: return any stored key for a player whose factionId we recorded
  // even if they're offline – the key is still valid.
  return apiKeys.values().next().value ?? null;
}

export function getApiKeyForPlayer(playerId) {
  return apiKeys.get(playerId) ?? null;
}

export function removeApiKey(playerId) {
  apiKeys.delete(playerId);
  savePlayerKeys();
}

/** Returns all stored player API keys as [playerId, apiKey] pairs. */
export function getAllApiKeys() {
  return [...apiKeys.entries()];
}

/** Load player API keys from disk (called once at startup). */
export function loadPlayerKeys() {
  ensureDataDir();
  if (!fs.existsSync(PLAYER_KEYS_FILE)) return;

  try {
    const raw = fs.readFileSync(PLAYER_KEYS_FILE, "utf-8");
    const data = JSON.parse(raw);
    // decryptMap is backward-compat: legacy plaintext entries pass
    // through unchanged so an in-place upgrade just works.
    const decrypted = decryptMap(data);
    for (const [playerId, key] of Object.entries(decrypted)) {
      apiKeys.set(playerId, key);
    }
    console.log(`[store] Loaded ${apiKeys.size} player API key(s) from disk`);
  } catch (err) {
    console.error("[store] Failed to load player keys:", err.message);
  }
}

/** Persist player API keys to disk (encrypted). */
function savePlayerKeys() {
  ensureDataDir();
  try {
    const obj = Object.fromEntries(apiKeys);
    const encrypted = encryptMap(obj);
    fs.writeFileSync(PLAYER_KEYS_FILE, JSON.stringify(encrypted, null, 2));
  } catch (err) {
    console.error("[store] Failed to persist player keys:", err.message);
  }
}

// ── Faction API key storage ──────────────────────────────────────────────

// ── Faction Settings ────────────────────────────────────────────────────

export function loadFactionSettings() {
  ensureDataDir();
  if (!fs.existsSync(FACTION_SETTINGS_FILE)) return;
  try {
    const raw = fs.readFileSync(FACTION_SETTINGS_FILE, "utf-8");
    const data = JSON.parse(raw);
    for (const [factionId, settings] of Object.entries(data)) {
      factionSettings.set(factionId, settings);
    }
    console.log(`[store] Loaded ${factionSettings.size} faction settings`);
  } catch (err) {
    console.error("[store] Failed to load faction settings:", err.message);
  }
}

function saveFactionSettings() {
  ensureDataDir();
  try {
    const obj = Object.fromEntries(factionSettings);
    fs.writeFileSync(FACTION_SETTINGS_FILE, JSON.stringify(obj, null, 2));
  } catch (err) {
    console.error("[store] Failed to save faction settings:", err.message);
  }
}

export function getFactionSettings(factionId) {
  return factionSettings.get(String(factionId)) || {};
}

// Shallow snapshot of every faction's settings, keyed by factionId.
// Used by enumeration paths (e.g. the OC ready-to-spawn poller needs
// to find factions whose admin configured an oc_ffs_key even if no
// admin has refreshed yet — those factions aren't in the key pool).
export function getAllFactionSettings() {
  return Object.fromEntries(factionSettings);
}

export function updateFactionSettings(factionId, newSettings) {
  const current = getFactionSettings(factionId);
  factionSettings.set(String(factionId), { ...current, ...newSettings });
  saveFactionSettings();
}

export function getAllowedBroadcastRoles(factionId) {
  const settings = getFactionSettings(factionId);
  // Default roles if not configured or empty
  if (!settings.broadcastRoles || !Array.isArray(settings.broadcastRoles) || settings.broadcastRoles.length === 0) {
    return ["leader", "co-leader", "war leader", "banker"];
  }
  return settings.broadcastRoles;
}

/**
 * Roles that can see the OC Spawn Assistance admin/manager/engines tabs.
 * Configured separately from broadcast roles via the OC settings panel —
 * leadership might want to delegate "admin tab access" to a different set
 * (e.g. trusted Sergeants) than who can shout to the war room.
 */
export function getAdminRoles(factionId) {
  const settings = getFactionSettings(factionId);
  if (!settings.adminRoles || !Array.isArray(settings.adminRoles) || settings.adminRoles.length === 0) {
    return ["leader", "co-leader"];
  }
  return settings.adminRoles;
}

/**
 * Per-faction enemy-online-surge alert config. Controls how the
 * server-side monitor decides "a meaningful number of enemies just
 * came online" — used to fire a coordinated-attack warning push
 * during active wars. Persisted in faction-settings.json so admins
 * can tune it without code changes.
 *
 * Defaults: disabled, 5-enemy jump, 60s window, 10-min cooldown.
 */
const ENEMY_SURGE_DEFAULTS = Object.freeze({
  enabled: false,
  jumpThreshold: 5,
  windowSec: 60,
  cooldownSec: 600,
});
export function getEnemySurgeConfig(factionId) {
  const s = getFactionSettings(factionId);
  const cfg = s.enemySurge || {};
  return {
    enabled:       typeof cfg.enabled === 'boolean' ? cfg.enabled : ENEMY_SURGE_DEFAULTS.enabled,
    jumpThreshold: Number.isFinite(cfg.jumpThreshold) && cfg.jumpThreshold >= 1 ? cfg.jumpThreshold : ENEMY_SURGE_DEFAULTS.jumpThreshold,
    windowSec:     Number.isFinite(cfg.windowSec)     && cfg.windowSec     >= 30  ? cfg.windowSec     : ENEMY_SURGE_DEFAULTS.windowSec,
    cooldownSec:   Number.isFinite(cfg.cooldownSec)   && cfg.cooldownSec   >= 60  ? cfg.cooldownSec   : ENEMY_SURGE_DEFAULTS.cooldownSec,
  };
}
export function setEnemySurgeConfig(factionId, partial) {
  const current = getFactionSettings(factionId);
  const merged = { ...(current.enemySurge || {}) };
  if (typeof partial.enabled === 'boolean') merged.enabled = partial.enabled;
  if (Number.isFinite(partial.jumpThreshold)) merged.jumpThreshold = Math.max(1, Math.min(50, Math.round(partial.jumpThreshold)));
  if (Number.isFinite(partial.windowSec))     merged.windowSec     = Math.max(30, Math.min(600, Math.round(partial.windowSec)));
  if (Number.isFinite(partial.cooldownSec))   merged.cooldownSec   = Math.max(60, Math.min(3600, Math.round(partial.cooldownSec)));
  factionSettings.set(String(factionId), { ...current, enemySurge: merged });
  saveFactionSettings();
  return getEnemySurgeConfig(factionId);
}

export function setAdminRoles(factionId, roles) {
  const cleaned = Array.isArray(roles)
    ? roles.map(r => String(r).trim().toLowerCase()).filter(Boolean).slice(0, 30)
    : [];
  const current = getFactionSettings(factionId);
  factionSettings.set(String(factionId), { ...current, adminRoles: cleaned });
  saveFactionSettings();
  return cleaned;
}

/**
 * Per-faction dedicated OC API key. Replaces the single-owner-key model
 * for faction-scoped tasks: auto-cleanup of vault-requests, faction crime
 * polling, any other task that needs faction-access-level API calls.
 * Only faction admins can set this (enforced at route level).
 */
export function getOcApiKey(factionId) {
  const settings = getFactionSettings(factionId);
  return settings.ocApiKey || '';
}

export function setOcApiKey(factionId, apiKey) {
  const cleaned = String(apiKey || '').trim();
  const current = getFactionSettings(factionId);
  factionSettings.set(String(factionId), { ...current, ocApiKey: cleaned });
  saveFactionSettings();
  return cleaned.length > 0;
}

/** Load faction API keys from disk (called once at startup). */
export function loadFactionKeys() {
  ensureDataDir();
  if (!fs.existsSync(FACTION_KEYS_FILE)) return;

  try {
    const raw = fs.readFileSync(FACTION_KEYS_FILE, "utf-8");
    const data = JSON.parse(raw);
    const decrypted = decryptMap(data);
    for (const [factionId, key] of Object.entries(decrypted)) {
      factionApiKeys.set(factionId, key);
    }
    console.log(`[store] Loaded ${factionApiKeys.size} faction API key(s) from disk`);
  } catch (err) {
    console.error("[store] Failed to load faction keys:", err.message);
  }
}

/** Persist faction API keys to disk (encrypted). */
export function saveFactionKeys() {
  ensureDataDir();
  try {
    const obj = Object.fromEntries(factionApiKeys);
    const encrypted = encryptMap(obj);
    fs.writeFileSync(FACTION_KEYS_FILE, JSON.stringify(encrypted, null, 2));
  } catch (err) {
    console.error("[store] Failed to persist faction keys:", err.message);
  }
}

export function getAllFactionKeys() {
  return Array.from(factionApiKeys.entries());
}

/** factionIds that have a stored API key (no plaintext exposed). */
export function listFactionApiKeyIds() {
  return Array.from(factionApiKeys.keys());
}

export function storeFactionApiKey(factionId, apiKey) {
  factionApiKeys.set(factionId, apiKey);
  saveFactionKeys();
}

export function getFactionApiKey(factionId) {
  return factionApiKeys.get(factionId) ?? null;
}

export function removeFactionApiKey(factionId) {
  factionApiKeys.delete(factionId);
  saveFactionKeys();
}

// ── Key pooling opt-in ──────────────────────────────────────────────────

export function loadKeyPoolingOpt() {
  ensureDataDir();
  if (!fs.existsSync(KEY_POOL_FILE)) return;
  try {
    const raw = fs.readFileSync(KEY_POOL_FILE, "utf-8");
    const data = JSON.parse(raw);
    for (const [playerId, opt] of Object.entries(data)) {
      keyPoolingOpt.set(String(playerId), opt);
    }
    console.log(`[store] Loaded ${keyPoolingOpt.size} key-pool opt-in(s)`);
  } catch (err) {
    console.error("[store] Failed to load key-pool opts:", err.message);
  }
}

function saveKeyPoolingOpt() {
  ensureDataDir();
  try {
    const obj = Object.fromEntries(keyPoolingOpt);
    fs.writeFileSync(KEY_POOL_FILE, JSON.stringify(obj, null, 2));
  } catch (err) {
    console.error("[store] Failed to persist key-pool opts:", err.message);
  }
}

/**
 * v3.1.75: stamp the player's pool entry as freshly active. Called
 * from auth middleware on every authenticated request — the warboard-
 * native app's polls, userscript polls, and web UI polls all flow
 * through here, so `lastActiveAt` reflects the actual last time we
 * heard from the user regardless of surface.
 *
 * No-op when the player isn't in the pool map (e.g. opted out, or never
 * registered). Doesn't bump opt-in state — only writes a timestamp on
 * an existing entry.
 */
export function touchPoolActivity(playerId) {
  const pid = String(playerId || "");
  if (!pid) return;
  const existing = keyPoolingOpt.get(pid);
  if (!existing) return;
  // Throttle disk writes — in-memory updates every request, persist at
  // most once per minute per player so we don't churn the JSON file
  // for every poll. Dirty flag flushes opportunistically.
  const now = Date.now();
  existing.lastActiveAt = now;
  if (!existing._lastSavedAt || (now - existing._lastSavedAt) > 60_000) {
    existing._lastSavedAt = now;
    saveKeyPoolingOpt();
  }
}

/**
 * Record a player's opt-in/out decision for the key pool.
 * Stores the factionId at opt-in time so if they later switch factions
 * their key isn't used for their old faction's pool. Optional auth
 * metadata (accessLevel, factionSelections) lets the per-purpose router
 * pick a key whose access actually supports the call being made.
 */
export function setKeyPoolingOpt(playerId, enabled, factionId, meta = {}) {
  const existing = keyPoolingOpt.get(String(playerId)) || {};
  const next = {
    ...existing,
    enabled: !!enabled,
    factionId: String(factionId || ""),
  };
  // Auth metadata is captured opportunistically — when present it lets
  // the per-purpose router pick a key whose access actually supports
  // the call being made. Absent fields are preserved from the previous
  // record (so a re-opt without re-auth doesn't wipe known capabilities).
  if (meta.accessLevel != null)        next.accessLevel = Number(meta.accessLevel);
  if (Array.isArray(meta.factionSelections)) next.factionSelections = meta.factionSelections.map(String);
  if (enabled) {
    delete next.quarantinedAt;
    delete next.quarantineReason;
  }
  keyPoolingOpt.set(String(playerId), next);
  saveKeyPoolingOpt();
}

/**
 * Hard-delete a player's pool opt. Used by the weekly membership check
 * when the player has left the faction entirely — leaving their pool
 * entry around with enabled=true is harmless (getPooledKeysForFaction
 * silently skips when the apiKeys.get() lookup returns null) but it
 * accumulates and confuses anyone reading the file.
 */
export function removePoolOpt(playerId) {
  const pid = String(playerId);
  if (!keyPoolingOpt.has(pid)) return false;
  keyPoolingOpt.delete(pid);
  saveKeyPoolingOpt();
  return true;
}

/** Drop the player's last-known faction mapping. Companion to
 *  removeApiKey + removePoolOpt for full membership cleanup. */
export function removePlayerFaction(playerId) {
  const pid = String(playerId);
  if (!lastKnownFaction.has(pid)) return false;
  lastKnownFaction.delete(pid);
  savePlayerFactions();
  return true;
}

/**
 * Return the player's explicit pool opt. If they've never been recorded,
 * default to enabled: true — the pool is opt-OUT not opt-in. Users who
 * don't want to contribute can toggle it off in settings at any time.
 */
export function getKeyPoolingOpt(playerId) {
  return keyPoolingOpt.get(String(playerId)) || { enabled: true, factionId: "", defaulted: true };
}

/**
 * Ensure an eligible signed-in player's key is in the pool. Called from
 * /api/auth. Key pooling is MANDATORY (the opt-out toggle was removed): a
 * prior USER opt-out is overridden back to enabled, but a SYSTEM quarantine
 * (a key demoted for repeated errors) is preserved so a known-broken key
 * doesn't churn back in. If meta (accessLevel, factionSelections) is provided
 * and the record predates per-purpose routing, backfill the capabilities.
 */
export function ensureDefaultPoolOpt(playerId, factionId, meta = {}) {
  const pid = String(playerId);
  const existing = keyPoolingOpt.get(pid);
  if (existing) {
    let changed = false;
    const patched = { ...existing };
    // Mandatory pooling: override a prior USER opt-out (enabled:false with no
    // quarantine) back to enabled and re-point it at the faction they're now
    // authing under, so every signed-in officer's key helps even the load.
    // A SYSTEM quarantine (quarantinedAt set) is left alone.
    if (existing.enabled === false && !existing.quarantinedAt) {
      patched.enabled = true;
      patched.factionId = String(factionId || "");
      changed = true;
    }
    // Backfill auth metadata onto pre-routing entries so the per-purpose
    // router can start dispatching them correctly without a re-toggle.
    if (meta.accessLevel != null && existing.accessLevel == null) {
      patched.accessLevel = Number(meta.accessLevel); changed = true;
    }
    if (Array.isArray(meta.factionSelections) && !Array.isArray(existing.factionSelections)) {
      patched.factionSelections = meta.factionSelections.map(String); changed = true;
    }
    if (changed) {
      keyPoolingOpt.set(pid, patched);
      saveKeyPoolingOpt();
    }
    return false; // not a fresh opt-in
  }
  keyPoolingOpt.set(pid, {
    enabled: true,
    factionId: String(factionId || ""),
    ...(meta.accessLevel != null ? { accessLevel: Number(meta.accessLevel) } : {}),
    ...(Array.isArray(meta.factionSelections) ? { factionSelections: meta.factionSelections.map(String) } : {}),
  });
  saveKeyPoolingOpt();
  return true;
}

// ── Per-purpose key routing ────────────────────────────────────────────
// Every server-side poller has a single faction selection it depends on.
// Mapping the poller's purpose tag to that selection lets the router
// pick from the SUBSET of pool keys that actually support the call.
// Keys with limited selections still contribute to capacity for the
// purposes they cover; they just don't get rotated onto purposes they'd
// fail at. Unknown purposes get the unfiltered pool (legacy behavior).
const PURPOSE_REQUIRED_SELECTION = {
  "attacks-feed":  "attacks",
  "enemy-attacks": "attacks",
  "war-status":    "members",
  "chain":         "chain",
  "xanax-tracker": "armorynews",
  "retals":        "attacks",
  "post-war":      "attacks",
};

/** Look up the faction selection a poller's purpose requires, if any. */
export function selectionForPurpose(purpose) {
  return PURPOSE_REQUIRED_SELECTION[purpose] || null;
}

/**
 * Pure: can a key with this pool opt serve `requiredSelection`?
 *   - null requiredSelection → yes (the unfiltered pool).
 *   - deniedSelections is a learned denylist — a key that actually returned
 *     Torn code 16 for the selection in practice — and OVERRIDES every allow
 *     path below. This catches a key whose key/info advertises a selection it
 *     can't really serve, which pure metadata routing cannot see.
 *   - Full Access (level >= 4) serves every selection implicitly.
 *   - Limited keys serve a selection iff their factionSelections grant it.
 *   - Keys with no recorded access yet (pre-verify) slip through; a real
 *     code-16 failure then demotes them via deniedSelections.
 */
export function poolOptServesSelection(opt, requiredSelection) {
  if (!requiredSelection) return true;
  if (Array.isArray(opt.deniedSelections) && opt.deniedSelections.includes(requiredSelection)) return false;
  const hasFull = Number(opt.accessLevel) >= 4;
  const hasSelection = Array.isArray(opt.factionSelections)
    && opt.factionSelections.includes(requiredSelection);
  const unknown = opt.accessLevel == null && !Array.isArray(opt.factionSelections);
  return hasFull || hasSelection || unknown;
}

/**
 * Return all keys opted into the faction's pool, optionally filtered to
 * those that support a specific faction selection (see poolOptServesSelection).
 * Stable-sorted by playerId so purpose-hash rotation is deterministic across
 * restarts.
 */
export function getPooledKeysForFaction(factionId, requiredSelection = null) {
  const fid = String(factionId);
  const out = [];
  for (const [playerId, opt] of keyPoolingOpt) {
    if (!opt.enabled) continue;
    if (String(opt.factionId) !== fid) continue;
    const key = apiKeys.get(playerId);
    if (!key) continue;
    if (!poolOptServesSelection(opt, requiredSelection)) continue;
    out.push({ playerId, key });
  }
  out.sort((a, b) => a.playerId.localeCompare(b.playerId));
  return out;
}

/**
 * Every enabled pool opt-in with its decrypted key, across all factions —
 * for the periodic access-level verification sweep (key-verify.js).
 */
export function getAllPooledKeys() {
  const out = [];
  for (const [playerId, opt] of keyPoolingOpt) {
    if (!opt.enabled) continue;
    const key = apiKeys.get(playerId);
    if (!key) continue;
    out.push({ playerId, factionId: opt.factionId, key });
  }
  return out;
}

/**
 * Auto-quarantine: when a poll using a pool key returns Torn API error
 * code 7 ("Incorrect ID-entity relation"), the key's owner is no longer
 * in the faction OR their access level dropped below what the call needs.
 * Either way, every future pick of that key for this faction will fail
 * with the same error. Flip enabled=false on their pool opt so the
 * rotation skips it. They can re-enable in settings if they fix it.
 */
export function quarantinePoolKey(apiKey, factionId, reason) {
  if (!apiKey) return false;
  let foundPid = null;
  for (const [pid, k] of apiKeys) {
    if (k === apiKey) { foundPid = pid; break; }
  }
  if (!foundPid) return false;
  const opt = keyPoolingOpt.get(foundPid);
  if (!opt || !opt.enabled) return false;     // already disabled — no-op
  if (String(opt.factionId) !== String(factionId)) return false;
  keyPoolingOpt.set(foundPid, { ...opt, enabled: false, quarantinedAt: Date.now(), quarantineReason: reason || 'unknown' });
  saveKeyPoolingOpt();
  console.log(`[store] Quarantined pool key for player ${foundPid} (faction ${factionId}): ${reason || 'unknown'}`);
  return true;
}

/**
 * Non-destructive self-heal: when a pool key returns Torn code 16 ("access
 * level not high enough") for a routed selection, the key's key/info may still
 * advertise that selection, so pure metadata routing keeps picking it. Record
 * the selection on a per-key denylist so getPooledKeysForFaction skips this key
 * for THAT selection only — it stays available for calls it can serve (e.g.
 * enemy-profile, which needs no faction selection). Unlike quarantinePoolKey
 * this never disables the key. The denylist survives the key-verify sweep;
 * clearPoolKeyDeniedSelections (on a deliberate re-opt-in) gives it a fresh start.
 */
export function demotePoolKeySelection(apiKey, factionId, selection) {
  if (!apiKey || !selection) return false;
  let foundPid = null;
  for (const [pid, k] of apiKeys) {
    if (k === apiKey) { foundPid = pid; break; }
  }
  if (!foundPid) return false;
  const opt = keyPoolingOpt.get(foundPid);
  if (!opt || !opt.enabled) return false;
  if (String(opt.factionId) !== String(factionId)) return false;
  const denied = Array.isArray(opt.deniedSelections) ? opt.deniedSelections.slice() : [];
  if (denied.includes(selection)) return false;   // already demoted — no-op
  denied.push(selection);
  keyPoolingOpt.set(foundPid, { ...opt, deniedSelections: denied });
  saveKeyPoolingOpt();
  console.log(`[store] Demoted pool key for player ${foundPid} (faction ${factionId}): can't serve '${selection}' — routed away (kept for other calls)`);
  return true;
}

/**
 * Clear a key's learned selection denylist. Called when the owner deliberately
 * re-opts into the pool (a human "try my key again" signal) so a key they've
 * since fixed can re-enter the routed pools. The 6-hourly key-verify sweep does
 * NOT clear it — only an explicit opt-in does — so a still-broken key won't
 * silently re-flood.
 */
export function clearPoolKeyDeniedSelections(playerId) {
  const pid = String(playerId);
  const opt = keyPoolingOpt.get(pid);
  if (!opt || !Array.isArray(opt.deniedSelections) || opt.deniedSelections.length === 0) return false;
  const next = { ...opt };
  delete next.deniedSelections;
  keyPoolingOpt.set(pid, next);
  saveKeyPoolingOpt();
  return true;
}

/** Tiny deterministic string hash for rotating keys by purpose. */
function stringHash(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h) + s.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

/**
 * Primary helper for server-side pollers to pick a Torn API key. Rotates
 * across opted-in pool keys by hashing the `purpose` string, so each
 * poller (chain, war-status, attacks-feed, …) consistently lands on a
 * different key as long as enough are pooled. Falls back to the faction-
 * dedicated key, then to any stored key, preserving prior behavior for
 * factions that haven't collected opt-ins yet.
 */
// ── Player ↔ faction persistence ────────────────────────────────────────

export function loadPlayerFactions() {
  ensureDataDir();
  if (!fs.existsSync(PLAYER_FACTIONS_FILE)) return;
  try {
    const raw = fs.readFileSync(PLAYER_FACTIONS_FILE, "utf-8");
    const data = JSON.parse(raw);
    for (const [playerId, factionId] of Object.entries(data)) {
      lastKnownFaction.set(String(playerId), String(factionId));
    }
    console.log(`[store] Loaded ${lastKnownFaction.size} player-faction mapping(s)`);
  } catch (err) {
    console.error("[store] Failed to load player-factions:", err.message);
  }
}

function savePlayerFactions() {
  ensureDataDir();
  try {
    const obj = Object.fromEntries(lastKnownFaction);
    fs.writeFileSync(PLAYER_FACTIONS_FILE, JSON.stringify(obj, null, 2));
  } catch (err) {
    console.error("[store] Failed to persist player-factions:", err.message);
  }
}

export function recordPlayerFaction(playerId, factionId) {
  if (!playerId || !factionId) return;
  const pid = String(playerId);
  const fid = String(factionId);
  if (lastKnownFaction.get(pid) === fid) return;
  lastKnownFaction.set(pid, fid);
  savePlayerFactions();
}

/**
 * Return every playerId we've ever seen authenticated as a member of the
 * given faction. Used for broadcast-to-faction push (e.g. retal).
 */
export function getPlayerIdsForFaction(factionId) {
  const fid = String(factionId);
  const out = [];
  for (const [pid, f] of lastKnownFaction) {
    if (f === fid) out.push(pid);
  }
  return out;
}

/**
 * Dynamic poll interval that scales with pool size. More pooled keys →
 * tighter polling (fresher data). Single-key pool → conservative
 * intervals that stay under Torn's 100/min per-key limit.
 *
 * Floor values are near Torn's endpoint cache TTLs — polling faster
 * than that just returns duplicates and burns budget with no benefit.
 */
export function getPollInterval(factionId, purpose) {
  const pool = getPooledKeysForFaction(factionId);
  const n = Math.max(1, pool.length);
  const config = {
    chain:           { min: 10_000, max: 20_000 }, // Torn cache ~15s
    // Pinned flat at 45s, 2026-09-04. Torn caches this endpoint ~30s, so 15s
    // was mostly re-reading the same data -- but 45s is PAST that cache, so it
    // is a real freshness cost, not just fewer duplicate calls: hospital
    // countdowns and online state can sit up to 45s behind.
    //
    // The attacks-feed hospital override still corrects a stale "Okay" between
    // polls, which is the case that matters -- somebody hospitalised a moment
    // ago must not read as attackable.
    //
    // min == max so a bigger key pool cannot speed it back up.
    "war-status":    { min: 45_000, max: 45_000 },
    "attacks-feed":  { min: 15_000, max: 60_000 }, // our faction's attacks feed
    "enemy-attacks": { min: 10_000, max: 30_000 }, // (unused — Torn blocks other factions' attacks)
    // Per-enemy profile round-robin. Flat 30s, min == max so a bigger key pool
    // cannot speed it back up.
    //
    // Pinned 2026-08-11, unpinned to 2.5s on 2026-08-28, RE-PINNED the same day
    // after the owner hit Torn's rate limit. The arithmetic said 480 calls/min
    // against a 3,600/min pool ceiling — 13% — and that was wrong in practice:
    // the pool's keys are not 36 independent 100/min budgets for this poller.
    // Chain, war-status, attacks-feed, WarScanner and xanax-subs draw on the
    // same keys, quarantined keys shrink the rotation, and Torn's limit is per
    // KEY per minute rather than per faction, so the rotation concentrates far
    // more than the average suggested.
    //
    // Do not unpin again on a headroom calculation alone. Measure real per-key
    // call rates first (see /api/debug/key-usage-local) — the basic war-status
    // roster poll already refreshes every enemy every ~30s in ONE call, and
    // hospital timers tick down client-side between polls, so the sweep buys
    // much less than its cost suggests.
    // Per-enemy profile round-robin. Back to a flat 30s, 2026-09-04.
    //
    // 2.5s was tried for a few hours and measured properly this time: 467
    // calls/min across 41 keys, busiest key 13.5% of its 100/min cap -- so it
    // was NOT unsafe, unlike the August attempt that prompted the pin. It was
    // reverted because the freshness it buys is unproven: Torn's cache TTL on
    // the profile endpoint is unknown, so most of those extra calls may return
    // identical data, and the sweep is a live suspect for phone lag.
    //
    // min == max so a bigger key pool cannot speed it back up.
    //
    // Do not unpin again on a headroom calculation alone. Measure real per-key
    // usage first -- /api/debug/key-usage-local?playerId=<id>&window=5, and
    // watch pctOfCap on the BUSIEST key rather than the average.
    "enemy-profile": { min: 30_000, max: 30_000 },
  };
  const c = config[purpose] || config["war-status"];
  // Divide the conservative max by pool size, floor at min.
  return Math.max(c.min, Math.round(c.max / n));
}

// ── Faction member bars aggregation ─────────────────────────────────────

/**
 * Record a member's self-reported bars snapshot. Persisted to disk
 * (debounced) so the Faction Cooldowns panel keeps its last-known state
 * across server restarts. Old entries age out after 24 hours of no refresh
 * — long enough for the projection on the client to keep ticking down
 * cooldowns through an overnight window even if the member never re-opens
 * a Torn tab.
 */
export function recordMemberBars(factionId, playerId, playerName, data) {
  const fid = String(factionId);
  const pid = String(playerId);
  if (!factionBars.has(fid)) factionBars.set(fid, new Map());
  factionBars.get(fid).set(pid, {
    bars: data.bars || null,
    cooldowns: data.cooldowns || null,
    name: playerName || pid,
    updatedAt: Date.now(),
  });
  scheduleMemberBarsSave();
}

/**
 * Return all fresh bars snapshots for a faction. Snapshots older than
 * `staleMs` are filtered out so the UI never shows zombie data.
 */
export function getFactionBars(factionId, staleMs = 24 * 60 * 60 * 1000) {
  const fid = String(factionId);
  const m = factionBars.get(fid);
  if (!m) return {};
  const cutoff = Date.now() - staleMs;
  const out = {};
  for (const [pid, entry] of m) {
    if (entry.updatedAt >= cutoff) {
      out[pid] = entry;
    }
  }
  return out;
}

// Debounced persistence for factionBars. Every member poll hits this ~every
// 60s × membersCount, which could be dozens of writes/minute. Coalesce into
// at most one write per 30s.
let _memberBarsSaveTimer = null;
function scheduleMemberBarsSave() {
  if (_memberBarsSaveTimer) return;
  _memberBarsSaveTimer = setTimeout(() => {
    _memberBarsSaveTimer = null;
    saveMemberBars();
  }, 30_000);
}

/** Persist factionBars to disk. Nested-Map → plain object. */
export function saveMemberBars() {
  ensureDataDir();
  try {
    const obj = {};
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    for (const [fid, members] of factionBars) {
      const fresh = {};
      for (const [pid, entry] of members) {
        if (entry.updatedAt >= cutoff) fresh[pid] = entry;
      }
      if (Object.keys(fresh).length) obj[fid] = fresh;
    }
    fs.writeFileSync(MEMBER_BARS_FILE, JSON.stringify(obj));
  } catch (err) {
    console.error("[store] Failed to save member-bars:", err.message);
  }
}

/** Load persisted factionBars from disk (called once at startup). */
export function loadMemberBars() {
  ensureDataDir();
  if (!fs.existsSync(MEMBER_BARS_FILE)) return;
  try {
    const raw = fs.readFileSync(MEMBER_BARS_FILE, "utf-8");
    const data = JSON.parse(raw);
    let total = 0;
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    for (const [fid, members] of Object.entries(data)) {
      const m = new Map();
      for (const [pid, entry] of Object.entries(members)) {
        if (entry && entry.updatedAt >= cutoff) {
          m.set(pid, entry);
          total++;
        }
      }
      if (m.size) factionBars.set(fid, m);
    }
    console.log(`[store] Loaded ${total} member-bars snapshot(s) from disk`);
  } catch (err) {
    console.error("[store] Failed to load member-bars:", err.message);
  }
}

export function getPollingKey(factionId, purpose, index) {
  const required = selectionForPurpose(purpose);
  let pool = getPooledKeysForFaction(factionId, required);
  // Safety net: if the per-purpose filter narrowed the pool to zero
  // (e.g. every key is Limited and none have the required selection),
  // fall back to the unfiltered pool. Auto-quarantine will catch any
  // resulting failures and the next call will see one fewer doomed key.
  if (pool.length === 0 && required) {
    pool = getPooledKeysForFaction(factionId, null);
  }
  let picked = null;
  let pickedPid = null;
  if (pool.length > 0) {
    // If caller passes a numeric index, rotate request-by-request
    // across the pool (used by high-frequency pollers like per-enemy
    // profile round-robin). Otherwise fall back to the stable,
    // purpose-hashed choice so each low-frequency poller lands on the
    // same key predictably.
    const idx = typeof index === "number"
      ? Math.abs(index) % pool.length
      : stringHash(String(purpose || "default")) % pool.length;
    picked = pool[idx].key;
    pickedPid = pool[idx].playerId || null;
  } else {
    picked = factionApiKeys.get(String(factionId))
          || getApiKeyForFaction(factionId)
          || null;
  }
  // Fire-and-forget key-usage log so the debug tracker sees every pool
  // pick. Caller-side code doesn't need to log separately. Dynamic import
  // avoids a circular dep at module load time.
  if (picked) {
    import('./key-usage-log.js')
      .then(m => m.logCall(picked, `pool/${purpose || 'default'}`, `pool:${purpose || 'default'}:pid=${pickedPid || '?'}`))
      .catch(() => {});
  }
  return picked;
}
