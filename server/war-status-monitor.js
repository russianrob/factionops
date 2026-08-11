/**
 * War status monitoring service.
 *
 * Periodically polls the Torn API for enemy faction member statuses and
 * broadcasts updates to the appropriate war room via socket.io.
 */

import * as store from "./store.js";
import { fetchFactionMembers, fetchRecentFactionAttacks, fetchUserProfile } from "./torn-api.js";
import { recordSample } from "./activity-heatmap.js";
import { broadcastSSE } from "./routes.js";
import * as push from "./push-notifications.js";
import { startRetalTracker, stopRetalTracker, stopAll as stopAllRetals } from "./retal-tracker.js";
import { enemyProfilePrewarDelay } from "./enemy-profile-gate.js";

// Fallback intervals used when we can't look up the dynamic value (no
// war loaded, store unavailable). Under normal operation both pollers
// call store.getPollInterval(factionId, purpose) for a value that
// scales with current pool size.
const POLL_INTERVAL_MS = 30_000;
const MAX_BACKOFF_MS = 120_000;   // max 2 minutes between retries on failure
// Our own faction is polled on a MUCH slower cadence than the enemy: the 30s
// loop exists for enemy hospital-timer freshness, which our roster doesn't need.
// This fetch only drives the online/idle counters and the overdose watch — a
// Xanax OD benches a member for hours, so 10-min resolution catches every OD
// with room to spare, and it cuts our-faction API calls ~20× during a war.
const OUR_FACTION_INTERVAL_MS = 10 * 60_000; // 10 minutes
const lastOurFactionPoll = new Map();        // warId -> ms epoch of last our-roster fetch

const nextWarStatus = (war) =>
  war && war.factionId
    ? store.getPollInterval(war.factionId, "war-status")
    : POLL_INTERVAL_MS;
const nextAttacksFeed = (war) => {
  const base = war && war.factionId
    ? store.getPollInterval(war.factionId, "attacks-feed")
    : ATTACKS_FEED_INTERVAL_MS;
  // Same pre-war throttle as the enemy-profile sweep: before a war starts
  // there are no war hospitalisations to detect, so don't burn the feed.
  return enemyProfilePrewarDelay(war && war.warStart, base, Date.now() / 1000);
};
const nextEnemyAttacks = (war) =>
  war && war.factionId
    ? store.getPollInterval(war.factionId, "enemy-attacks")
    : 30_000;
const nextEnemyProfile = (war) => {
  const base = war && war.factionId
    ? store.getPollInterval(war.factionId, "enemy-profile")
    : 2_500;
  return enemyProfilePrewarDelay(war && war.warStart, base, Date.now() / 1000);
};

// Attacks-feed watcher — near-real-time hospital detection.
// Shorter Torn cache on attacks endpoint + atomic event semantics (each
// record says who hospitalized whom) give us ~20s latency for any enemy
// hospitalized BY OUR FACTION, instead of the 30s bound of the basic poll.
// 20s matches Torn's attack-endpoint cache window — polling faster
// returns duplicates and burns the 100/min rate-limit budget we share
// with chain-monitor, war-status basic poll, WarScanner, and xanax-subs.
const ATTACKS_FEED_INTERVAL_MS = 60_000;
// If clients have refreshed enemyStatuses within this window, the
// attacks-feed poll is skipped — clients posting status updates from
// the war page already capture the hospital transitions we'd otherwise
// learn from this feed. Loose threshold because the feed is a "nice
// to have" enrichment (per-target basic poll runs every 15s anyway).
const ATTACKS_FEED_CLIENT_FRESH_MS = 30_000;
// How long an attacks-feed-derived hospital override suppresses a stale
// "Okay" from the basic poll. Torn's cache tends to settle within 30s; we
// allow a bit of margin.
const ATTACK_OVERRIDE_TTL_MS = 45_000;
// How far back to look on the very first attacks-feed poll for a war.
const ATTACKS_FEED_LOOKBACK_SEC = 60;

/** Active polling timeout IDs per warId. */
const timeouts = new Map();
/** Current backoff delay per warId (resets on success). */
const backoffs = new Map();
/** Active attacks-feed poll timers per warId. */
const attacksFeedTimeouts = new Map();
/** Last-seen attack timestamp (seconds) per warId — cursor for attacks feed. */
const attacksFeedCursors = new Map();
/** Current attacks-feed backoff per warId. */
const attacksFeedBackoffs = new Map();
/** Short-lived hospital overrides per warId: memberId -> { until, setAt }. */
const attackOverrides = new Map();

/** Enemy-attacks watcher — detects when enemy faction members are
 *  actively attacking (anyone). Useful to show "busy" / "just attacked"
 *  badges on enemy rows so the faction knows they're not an immediate
 *  attackable target. */
const enemyAttacksTimeouts = new Map();
const enemyAttacksCursors = new Map();
const enemyAttacksBackoffs = new Map();

/** Per-enemy profile round-robin. Polls one enemy's /user/:id?selections=profile
 *  per tick at a dynamic interval. Catches status.state === "Attacking"
 *  (sub-30s attack-activity detection that works against any public
 *  user, unlike the faction attacks feed which is key-restricted). */
const enemyProfileTimeouts = new Map();
const enemyProfileCursors = new Map();

// Round-robin cursor per (warId, purpose) used to spread pool-key load
// across ALL opted-in keys instead of hashing each purpose to a fixed
// slot. Without this, purposes like "chain", "war-status", "attacks-feed"
// each got pinned to one specific key in the pool — that key carried the
// entire sustained poll load for that purpose and saturated at 100/min
// regardless of pool size.
const poolRotationCursors = new Map();
function nextPoolCursor(warId, purpose) {
  const k = `${warId}:${purpose}`;
  const n = (poolRotationCursors.get(k) || 0) + 1;
  poolRotationCursors.set(k, n);
  return n;
}

const MAX_ACTIVITY_LOG = 5760; // 24 hours at 15s intervals

// Legacy compat
const intervals = new Map();

/**
 * Start war status monitoring for a war room.
 * @param {import("socket.io").Server} io
 * @param {string} warId
 */
export function startWarStatusMonitor(io, warId) {
  if (timeouts.has(warId)) return; // already monitoring

  // Co-start the xanax accountability tracker for this war. Polls
  // armoury news every 5 min and accumulates per-member xanax-pulled
  // counts that feed the post-war report. Idempotent.
  //
  // 2026-05-16: was temporarily disabled by mistake (user thought
  // they were disabling xanax-subscriptions.js — a different module).
  // 2026-05-17: re-enabled. The 'Incorrect ID-entity relation' errors
  // in the log are real (some pool keys lack armoury access) but the
  // pool rotates so successful polls still land. Errors are tolerable
  // because they're the only way the tracker discovers which keys
  // can hit the armoury endpoint at all.
  import("./xanax-tracker.js").then(m => m.startXanaxTracker(warId)).catch(() => {});

  const scheduleNext = (delay) => {
    const tid = setTimeout(poll, delay);
    timeouts.set(warId, tid);
  };

  const poll = async () => {
    const war = store.getWar(warId);
    if (!war || !war.enemyFactionId || war.warEnded) {
      if (war?.warEnded) {
        console.log(`[war-status] War ${warId} ended. Stopping status monitor.`);
        stopWarStatusMonitor(warId);
        return;
      }
      scheduleNext(nextWarStatus(war));
      return;
    }

    // True round-robin across opted-in pool keys via a per-(war,purpose)
    // cursor. Previously used purpose-hashed selection which pinned
    // "war-status" to one fixed key; that key carried 100% of war-status
    // polling traffic and saturated at 100/min.
    const apiKey = store.getPollingKey(war.factionId, "war-status", nextPoolCursor(warId, "war-status"));
    if (!apiKey) { scheduleNext(nextWarStatus(war)); return; }

    try {
      const freshStatuses = await fetchFactionMembers(war.enemyFactionId, apiKey);

      // Apply any fresh attacks-feed hospital overrides so a stale
      // "Okay" from Torn's cache doesn't briefly undo a hospitalization
      // we already detected via the attacks feed.
      applyAttackOverrides(warId, freshStatuses);

      war.enemyStatuses = freshStatuses;
      // v3.1.74: stamp the moment we fetched these so HTTP-polling
      // clients (warboard-native) can age the per-member `until`
      // counters by the staleness when they read them — eliminates
      // the up-to-POLL_INTERVAL_MS lag the hospital countdown was
      // showing relative to the FFS banner script's live readout.
      war.enemyStatusesFetchedAt = Date.now();
      store.saveState();

      // Success — reset backoff
      backoffs.set(warId, POLL_INTERVAL_MS);

      // ── Enemy counts (used by surge detection, activity log, and strategy) ──
      const onlineNow = Object.values(freshStatuses).filter(
        (m) => m.status?.state === "Okay" && m.activity === "online",
      ).length;
      const totalEnemies = Object.keys(freshStatuses).length;

      io.to(`war_${warId}`).emit("status_update", freshStatuses);
      // SSE clients use applyServerData which reads data.enemyStatuses.
      broadcastSSE(warId, { enemyStatuses: freshStatuses });

      // ── Enemy Activity Logging ──
      try {
        if (!war.enemyActivityLog) war.enemyActivityLog = [];
        war.enemyActivityLog.push({
          timestamp: Date.now(),
          online: onlineNow,
          idle: Object.values(freshStatuses).filter(
            (m) => m.activity === "idle",
          ).length,
          total: totalEnemies,
        });
        // Cap at ~24 hours of data
        while (war.enemyActivityLog.length > MAX_ACTIVITY_LOG) {
          war.enemyActivityLog.shift();
        }
      } catch (_) { /* non-critical */ }

      // Our own faction: online-count for the header/heatmap + the overdose
      // watch, throttled to OUR_FACTION_INTERVAL_MS (10 min) independent of the
      // 30s enemy cadence. One fetch feeds both — the OD watch adds no API call.
      const lastOur = lastOurFactionPoll.get(warId) || 0;
      if (Date.now() - lastOur >= OUR_FACTION_INTERVAL_MS) {
        lastOurFactionPoll.set(warId, Date.now());
        try {
          const ourMembers = await fetchFactionMembers(war.factionId, apiKey);
          const ourOnline = Object.values(ourMembers).filter(
            (m) => m.activity === "online",
          ).length;
          const ourIdle = Object.values(ourMembers).filter(
            (m) => m.activity === "idle",
          ).length;
          const ourTotal = Object.keys(ourMembers).length;
          recordSample(war.factionId, ourOnline + ourIdle, ourTotal);
          // Store on war for poll response
          war.ourFactionOnline = { online: ourOnline, idle: ourIdle, total: ourTotal };
          // Overdose accountability: same roster carries each member's hospital
          // status; edge-count anyone newly in an "overdosing on Xanax" state.
          import("./od-tracker.js").then(m => m.recordRoster(warId, ourMembers)).catch(() => {});
        } catch (_) {
          // Non-critical — skip silently
        }
      }

      // ── Recalculate warEta from stored scores/target so non-war-page clients stay in sync ──
      try {
        if (war.warScores && war.warStart && war.warOrigTarget) {
          const nowSec = Math.floor(Date.now() / 1000);
          const elapsedHrs = (nowSec - war.warStart) / 3600;
          const dropHrs = Math.max(0, Math.floor(elapsedHrs - 24));
          const currentTarget = Math.round(war.warOrigTarget * (1 - dropHrs * 0.01));
          const dropPerHour = war.warOrigTarget * 0.01;
          const lead = Math.max(war.warScores.myScore || 0, war.warScores.enemyScore || 0);
          const gap = currentTarget - lead;
          const hrsRemaining = dropPerHour > 0 ? Math.max(0, gap / dropPerHour) : 0;
          war.warEta = {
            etaTimestamp: Date.now() + (hrsRemaining * 3600000),
            hoursRemaining: Math.round(hrsRemaining * 100) / 100,
            currentTarget,
            calculatedAt: Date.now(),
            preDropPhase: elapsedHrs < 24,
          };
        }
      } catch (_) { /* non-critical */ }

      store.saveState();
      scheduleNext(nextWarStatus(war));
    } catch (err) {
      if (/Incorrect ID-entity relation/i.test(err.message)) {
        store.quarantinePoolKey(apiKey, war.factionId, 'war-status code 7');
      } else if (/Incorrect key|\(code 2\)/i.test(err.message)) {
        // v5.0.3: also quarantine on code 2 (key regenerated / revoked).
        // Torn rejects the OLD key forever in that case; without this
        // the pool keeps round-robining onto the dead key, spamming
        // the error log and wasting one poll slot per cycle.
        store.quarantinePoolKey(apiKey, war.factionId, 'war-status code 2');
      } else if (/Access level of this key is not high enough|\(code 16\)/i.test(err.message)) {
        // code 16 = this key can't serve the members selection even if its
        // key/info advertises it; demote it away from 'members' so the router
        // stops picking it (non-destructive — same lying-key self-heal as chain).
        store.demotePoolKeySelection(apiKey, war.factionId, 'members');
      }
      // Exponential backoff on failure
      const current = backoffs.get(warId) || POLL_INTERVAL_MS;
      const next = Math.min(current * 2, MAX_BACKOFF_MS);
      backoffs.set(warId, next);
      console.error(`[war-status] Poll failed for war ${warId}: ${err.message} (retry in ${Math.round(next/1000)}s)`);
      scheduleNext(next);
    }
  };

  // Run immediately, schedule via setTimeout chain (not setInterval)
  backoffs.set(warId, POLL_INTERVAL_MS);
  poll();

  // Companion watcher — attacks-feed polling runs on its own 10s cadence
  // alongside the 15s basic poll.
  startAttacksFeedMonitor(io, warId);

  // Incoming-retal list — viewing-gated poll of our own attack feed.
  startRetalTracker(io, warId);

  // Enemy-attacks watcher disabled: Torn's attacks endpoint only
  // accepts the owning faction's key. See note on startEnemyAttacksMonitor.
  // startEnemyAttacksMonitor(io, warId);

  // Per-enemy profile round-robin — catches status.state === "Attacking"
  // and gives sub-30s freshness on individual enemies' status.
  startEnemyProfileMonitor(io, warId);

  console.log(`[war-status] Started monitoring for war ${warId}`);
}

/**
 * Watcher for the enemy faction's own attacks feed. When an enemy
 * attacks anyone, their row lights up with a "just attacked" marker
 * for a short window — visually signals "this enemy is currently busy
 * / just did their hit" so the faction doesn't all pile on mid-swing.
 * Updates war.enemyStatuses[attackerId].lastAttackAt (unix seconds) and
 * broadcasts a partial status_update.
 */
function startEnemyAttacksMonitor(io, warId) {
  if (enemyAttacksTimeouts.has(warId)) return;

  const scheduleNext = (delay) => {
    const tid = setTimeout(pollEnemyAttacks, delay);
    enemyAttacksTimeouts.set(warId, tid);
  };

  const pollEnemyAttacks = async () => {
    const war = store.getWar(warId);
    if (!war || !war.enemyFactionId || war.warEnded) {
      scheduleNext(nextEnemyAttacks(war));
      return;
    }
    const apiKey = store.getPollingKey(war.factionId, "enemy-attacks", nextPoolCursor(warId, "enemy-attacks"));
    if (!apiKey) { scheduleNext(nextEnemyAttacks(war)); return; }

    let cursor = enemyAttacksCursors.get(warId);
    if (!cursor) cursor = Math.floor(Date.now() / 1000) - 60;

    try {
      const attacks = await fetchRecentFactionAttacks(
        war.enemyFactionId, apiKey, cursor
      );
      enemyAttacksBackoffs.set(warId, nextEnemyAttacks(war));

      const updates = {};
      let newCursor = cursor;
      const enemyFid = String(war.enemyFactionId);

      for (const atk of attacks) {
        const ts = atk.timestamp_ended || atk.timestamp_started || 0;
        if (ts > newCursor) newCursor = ts;

        const attackerFid = String(atk.attacker_faction ?? atk.attacker_faction_id ?? "");
        if (attackerFid !== enemyFid) continue;
        const attackerId = String(atk.attacker_id ?? "");
        if (!attackerId) continue;

        const existing = (war.enemyStatuses && war.enemyStatuses[attackerId]) || {};
        const updated = { ...existing, lastAttackAt: ts };
        if (!war.enemyStatuses) war.enemyStatuses = {};
        war.enemyStatuses[attackerId] = updated;
        updates[attackerId] = updated;
      }

      enemyAttacksCursors.set(warId, newCursor);

      if (Object.keys(updates).length > 0) {
        console.log(
          `[enemy-attacks] war ${warId}: ${Object.keys(updates).length} enemy attack event(s)`
        );
        io.to(`war_${warId}`).emit("status_update", updates);
        broadcastSSE(warId, { enemyStatuses: updates });
        store.saveState();
      }
      scheduleNext(nextEnemyAttacks(war));
    } catch (err) {
      if (/Incorrect ID-entity relation/i.test(err.message)) {
        store.quarantinePoolKey(apiKey, war.factionId, 'enemy-attacks code 7');
      } else if (/Incorrect key|\(code 2\)/i.test(err.message)) {
        store.quarantinePoolKey(apiKey, war.factionId, 'enemy-attacks code 2');
      } else if (/Access level of this key is not high enough|\(code 16\)/i.test(err.message)) {
        store.demotePoolKeySelection(apiKey, war.factionId, 'attacks');
      }
      const current = enemyAttacksBackoffs.get(warId) || 30_000;
      const next = Math.min(current * 2, MAX_BACKOFF_MS);
      enemyAttacksBackoffs.set(warId, next);
      console.error(
        `[enemy-attacks] Poll failed for war ${warId}: ${err.message} (retry in ${Math.round(next/1000)}s)`
      );
      scheduleNext(next);
    }
  };

  enemyAttacksBackoffs.set(warId, 30_000);
  pollEnemyAttacks();
}

/**
 * Start the attacks-feed watcher for a war. Polls the faction's own
 * attacks feed every ATTACKS_FEED_INTERVAL_MS and flips enemy statuses
 * to "hospital" immediately when a hospitalization event is seen. Emits
 * status_update with the partial change so clients repaint without
 * waiting for the next basic poll.
 *
 * @param {import("socket.io").Server} io
 * @param {string} warId
 */
function startAttacksFeedMonitor(io, warId) {
  if (attacksFeedTimeouts.has(warId)) return;

  const scheduleNext = (delay) => {
    const tid = setTimeout(pollAttacks, delay);
    attacksFeedTimeouts.set(warId, tid);
  };

  const pollAttacks = async () => {
    const war = store.getWar(warId);
    if (!war || !war.enemyFactionId || war.warEnded) {
      scheduleNext(nextAttacksFeed(war));
      return;
    }

    // GATE: if any client has refreshed enemy status within the last
    // ATTACKS_FEED_CLIENT_FRESH_MS, skip the Torn fetch. Clients on the
    // war/attack pages already report hospital state via /api/status.
    // The per-target basic poll (15s) is the safety net for missed pops.
    const enemyUpdatedAt = Number(war.enemyStatusesUpdatedAt) || 0;
    const ageMs = Date.now() - enemyUpdatedAt;
    if (ageMs < ATTACKS_FEED_CLIENT_FRESH_MS) {
      console.log(`[attacks-feed/skip] war=${warId} client status data is ${Math.round(ageMs / 1000)}s old (gate=${ATTACKS_FEED_CLIENT_FRESH_MS / 1000}s)`);
      attacksFeedBackoffs.set(warId, ATTACKS_FEED_INTERVAL_MS);
      scheduleNext(nextAttacksFeed(war));
      return;
    }

    const apiKey = store.getPollingKey(war.factionId, "attacks-feed", nextPoolCursor(warId, "attacks-feed"));
    if (!apiKey) {
      scheduleNext(nextAttacksFeed(war));
      return;
    }

    // First run: look back a minute so we don't miss events that
    // landed right before the war started monitoring.
    let cursor = attacksFeedCursors.get(warId);
    if (!cursor) cursor = Math.floor(Date.now() / 1000) - ATTACKS_FEED_LOOKBACK_SEC;

    try {
      const attacks = await fetchRecentFactionAttacks(war.factionId, apiKey, cursor);
      // Success → reset backoff.
      attacksFeedBackoffs.set(warId, ATTACKS_FEED_INTERVAL_MS);

      const enemyFid = String(war.enemyFactionId);
      const ourFid = String(war.factionId);
      const updates = {};
      let newCursor = cursor;
      // Successful attack outcomes that should auto-clear a call. We
      // skip Lost/Stalemate/Escape per user request: a failed swing
      // means the caller didn't actually neutralise the target, so
      // they may want to keep the lock and try again.
      const SUCCESS_RESULTS = new Set([
        'Attacked', 'Hospitalized', 'Mugged', 'Looted', 'Special', 'Assist',
      ]);
      let callsCleared = 0;

      for (const atk of attacks) {
        const ts = atk.timestamp_ended || atk.timestamp_started || 0;
        if (ts > newCursor) newCursor = ts;

        // ─── Auto-uncall on successful attack by the caller ────────────
        // Independent of the hospital-update path below — we want to
        // clear the call even if the result is Mugged/Looted/Attacked
        // (target didn't go to hospital but the caller landed a hit).
        const attackerId = String(atk.attacker_id ?? '');
        const attackerFid = String(atk.attacker_faction ?? atk.attacker_faction_id ?? '');
        const dId = String(atk.defender_id ?? atk.defenderID ?? '');
        if (
          attackerFid === ourFid &&
          attackerId &&
          dId &&
          war.calls && war.calls[dId] &&
          SUCCESS_RESULTS.has(atk.result)
        ) {
          const callerId = String(war.calls[dId].calledBy?.id ?? '');
          if (callerId === attackerId) {
            delete war.calls[dId];
            callsCleared++;
            try {
              io.to(`war_${warId}`).emit('target_uncalled', {
                targetId: dId,
                reason: 'attacked',
              });
              broadcastSSE(warId, { calls: war.calls });
            } catch (e) { /* broadcast best-effort */ }
            console.log(`[attacks-feed] auto-uncalled ${dId} — ${atk.result} by caller ${attackerId} (war ${warId})`);
          }
        }

        // Only care about attacks where our faction attacked a member of
        // the enemy faction and the result was a hospitalization.
        const defenderFid = String(atk.defender_faction ?? atk.defender_faction_id ?? '');
        if (defenderFid !== enemyFid) continue;
        if (atk.result !== 'Hospitalized') continue;

        const defenderId = String(atk.defender_id ?? atk.defenderID ?? '');
        if (!defenderId) continue;

        // Duration isn't provided in the attacks feed; use a conservative
        // placeholder. The next basic poll will refine the countdown once
        // Torn's cache catches up.
        const untilSec = 30 * 60;

        const existing = (war.enemyStatuses && war.enemyStatuses[defenderId]) || {};
        const entry = {
          name: existing.name,
          level: existing.level,
          status: 'hospital',
          description: 'Hospitalized',
          until: untilSec,
          lastAction: existing.lastAction || 'Unknown',
          activity: 'offline',
        };

        if (!war.enemyStatuses) war.enemyStatuses = {};
        war.enemyStatuses[defenderId] = entry;
        updates[defenderId] = entry;

        // Record an override so the 15s basic poll can suppress any
        // stale "Okay" that Torn's cache might still return.
        if (!attackOverrides.has(warId)) attackOverrides.set(warId, new Map());
        attackOverrides.get(warId).set(defenderId, {
          until: untilSec,
          setAt: Date.now(),
        });
      }

      attacksFeedCursors.set(warId, newCursor);

      if (Object.keys(updates).length > 0) {
        console.log(`[attacks-feed] war ${warId}: ${Object.keys(updates).length} enemy hospitalization(s) detected`);
        io.to(`war_${warId}`).emit('status_update', updates);
        store.saveState();
      } else if (callsCleared > 0) {
        // Hospitalization branch above already saves; only persist the
        // call-clearing pass when there were no hospitalizations to
        // share the save.
        store.saveState();
      }

      scheduleNext(nextAttacksFeed(war));
    } catch (err) {
      // Auto-quarantine code-7 keys: the owning player either left the
      // faction or their key dropped below the access level this call
      // needs. Either way, every future rotation onto this key will keep
      // failing — pull it out of the pool until the owner re-enables it.
      if (/Incorrect ID-entity relation/i.test(err.message)) {
        store.quarantinePoolKey(apiKey, war.factionId, 'attacks-feed code 7');
      } else if (/Incorrect key|\(code 2\)/i.test(err.message)) {
        store.quarantinePoolKey(apiKey, war.factionId, 'attacks-feed code 2');
      } else if (/Access level of this key is not high enough|\(code 16\)/i.test(err.message)) {
        store.demotePoolKeySelection(apiKey, war.factionId, 'attacks');
      }
      const current = attacksFeedBackoffs.get(warId) || ATTACKS_FEED_INTERVAL_MS;
      const next = Math.min(current * 2, MAX_BACKOFF_MS);
      attacksFeedBackoffs.set(warId, next);
      console.error(`[attacks-feed] Poll failed for war ${warId}: ${err.message} (retry in ${Math.round(next/1000)}s)`);
      scheduleNext(next);
    }
  };

  attacksFeedBackoffs.set(warId, ATTACKS_FEED_INTERVAL_MS);
  pollAttacks();
}

/**
 * Overlay any fresh attacks-feed hospital overrides onto a set of
 * statuses fetched from the basic poll. Expires overrides older than
 * ATTACK_OVERRIDE_TTL_MS or once Torn confirms the hospital state.
 */
function applyAttackOverrides(warId, freshStatuses) {
  const overrides = attackOverrides.get(warId);
  if (!overrides || overrides.size === 0) return;

  const now = Date.now();
  for (const [memberId, ov] of overrides) {
    if (now - ov.setAt > ATTACK_OVERRIDE_TTL_MS) {
      overrides.delete(memberId);
      continue;
    }
    const fresh = freshStatuses[memberId];
    if (!fresh) continue;
    // If Torn now agrees the target is in hospital, clear the override.
    if (fresh.status === 'hospital') {
      overrides.delete(memberId);
      continue;
    }
    // Otherwise Torn is still returning a cached "okay" — hold the line.
    freshStatuses[memberId] = {
      ...fresh,
      status: 'hospital',
      description: 'Hospitalized',
      until: Math.max(fresh.until || 0, ov.until),
      activity: 'offline',
    };
  }
}

/**
 * Stop war status monitoring for a war room.
 * @param {string} warId
 */
export function stopWarStatusMonitor(warId) {
  const tid = timeouts.get(warId);
  if (tid) {
    clearTimeout(tid);
    timeouts.delete(warId);
  }
  backoffs.delete(warId);
  lastOurFactionPoll.delete(warId);
  const id = intervals.get(warId);
  if (id) clearInterval(id);
  intervals.delete(warId);

  // Also tear down the attacks-feed watcher.
  const atid = attacksFeedTimeouts.get(warId);
  if (atid) {
    clearTimeout(atid);
    attacksFeedTimeouts.delete(warId);
  }
  attacksFeedCursors.delete(warId);
  attacksFeedBackoffs.delete(warId);
  attackOverrides.delete(warId);

  // Enemy-attacks watcher
  const eatid = enemyAttacksTimeouts.get(warId);
  if (eatid) {
    clearTimeout(eatid);
    enemyAttacksTimeouts.delete(warId);
  }
  enemyAttacksCursors.delete(warId);
  enemyAttacksBackoffs.delete(warId);

  // Enemy-profile watcher
  const eptid = enemyProfileTimeouts.get(warId);
  if (eptid) {
    clearTimeout(eptid);
    enemyProfileTimeouts.delete(warId);
  }
  enemyProfileCursors.delete(warId);

  // Retal tracker
  stopRetalTracker(warId);

  console.log(`[war-status] Stopped monitoring for war ${warId}`);
}

/**
 * Stop all war status monitors (for graceful shutdown).
 */
export function stopAll() {
  for (const [warId, tid] of timeouts) {
    clearTimeout(tid);
    console.log(`[war-status] Stopped monitoring for war ${warId}`);
  }
  timeouts.clear();
  backoffs.clear();
  for (const [, id] of intervals) clearInterval(id);
  intervals.clear();

  for (const [, atid] of attacksFeedTimeouts) clearTimeout(atid);
  attacksFeedTimeouts.clear();
  attacksFeedCursors.clear();
  attacksFeedBackoffs.clear();
  attackOverrides.clear();

  for (const [, atid] of enemyAttacksTimeouts) clearTimeout(atid);
  enemyAttacksTimeouts.clear();
  enemyAttacksCursors.clear();
  enemyAttacksBackoffs.clear();

  for (const [, eptid] of enemyProfileTimeouts) clearTimeout(eptid);
  enemyProfileTimeouts.clear();
  enemyProfileCursors.clear();

  stopAllRetals();
}

/**
 * Rotate through the enemy faction's known members, polling one profile
 * per tick. Feeds status.state (attacking / hospital / jail / traveling
 * / okay) into war.enemyStatuses and stamps lastAttackAt when we catch
 * someone mid-attack. Uses rotating pool keys (per-call index, not
 * per-purpose hash) so the request load spreads across all pooled keys
 * instead of landing on one.
 */
function startEnemyProfileMonitor(io, warId) {
  if (enemyProfileTimeouts.has(warId)) return;

  const scheduleNext = (delay) => {
    const tid = setTimeout(pollOne, delay);
    enemyProfileTimeouts.set(warId, tid);
  };

  async function fetchAndApply(targetId, apiKey) {
    try {
      const data = await fetchUserProfile(targetId, apiKey);
      // Re-look up the war fresh in case state changed during the
      // in-flight request (war ended, enemy faction swapped, etc.).
      const curWar = store.getWar(warId);
      if (!curWar || !curWar.enemyStatuses) return;
      const existing = curWar.enemyStatuses[targetId] || {};

      const nowSec = Date.now() / 1000;
      const state_str = String(data.status?.state || "").toLowerCase();
      const untilTs = data.status?.until ?? 0;
      const untilRemaining = untilTs > 0 ? Math.max(0, untilTs - nowSec) : 0;

      const updated = {
        ...existing,
        name: data.name ?? existing.name,
        level: data.level ?? existing.level,
        status: state_str === "okay" ? "okay" : state_str,
        description: data.status?.description ?? "",
        until: untilRemaining,
        lastAction: data.last_action?.relative ?? existing.lastAction ?? "Unknown",
        activity: String(data.last_action?.status || "offline").toLowerCase(),
      };

      // Detect transition into Attacking state. Fires push notifications
      // to faction members who've opted in (enemy_attacking pref, default
      // off). Server-side dedup: only push when wasAttacking → isAttacking,
      // so a chain-hitter doesn't generate back-to-back pushes per hit.
      const wasAttacking = existing.status === "attacking";
      if (state_str === "attacking") {
        updated.lastAttackAt = Math.floor(nowSec);
        if (!wasAttacking) {
          console.log(`[enemy-profile] ${targetId} (${updated.name || '?'}) is attacking`);
          try {
            const warPlayers = store.getPlayerIdsForFaction(curWar.factionId);
            push.notifyEnemyAttacking(
              warPlayers,
              warId,
              updated.name || `Player [${targetId}]`,
              targetId,
            );
          } catch (e) { /* push is best-effort */ }
        }
      }

      curWar.enemyStatuses[targetId] = updated;
      io.to(`war_${warId}`).emit("status_update", { [targetId]: updated });
      broadcastSSE(warId, { enemyStatuses: { [targetId]: updated } });
    } catch (err) {
      const msg = err.message || "";
      // 5xx are transient Torn-side gateway outages, not per-enemy actionable —
      // suppress the per-member spam (during a Torn 504 wave this poller logged
      // ~one line per enemy per 30s = thousands). The war-level chain/war-status
      // pollers still log 504s once per war, so outages stay visible.
      if (!/Too many requests|HTTP 5\d\d/i.test(msg)) {
        console.warn(`[enemy-profile] ${targetId}: ${msg}`);
      }
      // v5.0.3: per-enemy poller cycles through MANY pool keys per second,
      // so a single bad key spams hundreds of these per minute. Quarantine
      // on either code 7 (left faction) OR code 2 (regenerated/revoked).
      const curWar = store.getWar(warId);
      if (curWar && (/Incorrect ID-entity relation/i.test(msg) || /Incorrect key|\(code 2\)/i.test(msg))) {
        const reason = /Incorrect ID-entity relation/i.test(msg) ? 'enemy-profile code 7' : 'enemy-profile code 2';
        store.quarantinePoolKey(apiKey, curWar.factionId, reason);
      }
    }
  }

  const pollOne = async () => {
    const war = store.getWar(warId);
    if (!war || !war.enemyStatuses || war.warEnded) {
      scheduleNext(nextEnemyProfile(war));
      return;
    }
    // Poll every enemy in rotation (2026-08-11: dropped the online/free
    // pre-filter). At the 30s cadence the sweep no longer needs to be selective
    // to stay under rate limits, and covering everyone avoids depending on
    // possibly-stale online status to decide whose profile to refresh.
    const ids = Object.keys(war.enemyStatuses).sort();
    if (ids.length === 0) {
      scheduleNext(nextEnemyProfile(war));
      return;
    }

    // Concurrency scales linearly with pool size — one request per key
    // per tick, so per-key rate stays at 60/tick_sec regardless of pool
    // size. Bounded by enemy count (no point polling more users than
    // exist) and a hard safety cap to keep Node from issuing an absurd
    // burst if the pool grows huge. Cap of 20 leaves ~30% headroom
    // under Torn's 100/min per-key limit so concurrent pollers
    // (chain, war-status, attacks-feed, oc/spawn-key) can share the
    // budget without tipping into 429 cascades.
    // Request-rotation (cursor index) spreads the load evenly across keys.
    const pool = store.getPooledKeysForFaction(war.factionId);
    const concurrency = Math.max(
      1,
      Math.min(pool.length || 1, ids.length, 20),
    );

    const startCursor = (enemyProfileCursors.get(warId) || 0);
    const requests = [];
    for (let i = 0; i < concurrency; i++) {
      const c = startCursor + i;
      const targetId = ids[c % ids.length];
      const apiKey = store.getPollingKey(war.factionId, "enemy-profile", c);
      if (!apiKey) continue;
      requests.push(fetchAndApply(targetId, apiKey));
    }
    enemyProfileCursors.set(warId, startCursor + concurrency);

    try { await Promise.all(requests); } catch (_) { /* each handles its own */ }

    scheduleNext(nextEnemyProfile(war));
  };

  pollOne();
}
