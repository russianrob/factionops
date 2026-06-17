/**
 * Chain monitoring service.
 *
 * Server-side fallback: polls Torn API for chain data when no client is
 * reporting chain info (i.e. nobody has FactionOps open). Fires push
 * notifications for chain-break alerts and bonus-imminent hits.
 *
 * Only polls when:
 * - A war is active
 * - No client has reported chain data in the last CLIENT_STALE_MS
 */

import * as store from "./store.js";
import { fetchFactionChain, fetchRankedWar } from "./torn-api.js";
import * as push from "./push-notifications.js";
import * as apns from "./apns.js";
import * as liveActivityTokens from "./live-activity-tokens.js";

// Fallback interval when we can't resolve the dynamic one (e.g. no war
// context yet). Normal operation uses store.getPollInterval(factionId,
// "chain") which scales with pool size.
const POLL_INTERVAL_MS = 20_000;
const MAX_BACKOFF_MS = 120_000;   // max 2 minutes between retries on failure

const nextChain = (war) =>
  war && war.factionId
    ? store.getPollInterval(war.factionId, "chain")
    : POLL_INTERVAL_MS;
// If a client has pushed chain data within this window, the server-side
// poll skips its Torn fetch — saves the pool budget on factions where
// members already have FactionOps fetching chain client-side. Conservative
// threshold so chain-panic alerts (30s trigger) never fire late.
const CLIENT_CHAIN_FRESH_MS = 8_000;
const CHAIN_ALERT_THRESHOLD = 60; // seconds — fire warning when chain timer <= this
const CHAIN_PANIC_THRESHOLD = 30; // seconds — fire panic when chain timer <= this
// Monotonic cursor used to rotate pool keys per chain-poll call.
let _chainPollCursor = 0;
const CHAIN_MIN_HITS = 10;        // only alert when chain >= 10 (real chain)
const CHAIN_ALERT_COOLDOWN_MS = 30_000; // max one alert push per 30s per war
const CHAIN_PANIC_COOLDOWN_MS = 20_000; // max one panic push per 20s per war
const WAR_SCORE_CHECK_INTERVAL = 30_000; // check war score every 30s

/** Bonus hit thresholds in Torn chain mechanics. */
const BONUS_HITS = [
  10, 25, 50, 100, 250, 500, 1_000, 2_500, 5_000, 10_000, 25_000, 50_000, 100_000,
];

/** Active polling timeout IDs per warId so we can clean them up. */
const timeouts = new Map();
/** Current backoff delay per warId (resets on success). */
const backoffs = new Map();

/** Last time we sent a chain alert push per warId. */
const lastAlertSent = new Map();
/** Last time we sent a chain panic push per warId. */
const lastPanicSent = new Map();
/** Last time we checked war score per warId. */
const lastScoreCheck = new Map();
/** Track if we already notified war target reached per warId. */
const warTargetNotified = new Map();

/**
 * Apply a fresh chain snapshot to a war and run the alert / Live
 * Activity / war-target-evaluation pipeline. Source-agnostic — used
 * by both the server's Torn poll and the client-push endpoint. The
 * `source` arg is just for log lines so we can see in pm2 whether the
 * data came from a client or our own poll.
 */
async function _processChain(warId, war, chain, io, source) {
  const prevChain = { ...war.chainData };
  war.chainData = chain;
  war.chainDataUpdatedAt = Date.now();
  store.saveState();

  const countChanged = (prevChain.current || 0) !== (chain.current || 0);
  const cooldownFlipped = ((prevChain.cooldown || 0) > 0) !== ((chain.cooldown || 0) > 0);
  const broke = (prevChain.current || 0) > 0 && (chain.current || 0) === 0;
  const tokenCount = liveActivityTokens.listForWar(warId).length;
  console.log(`[chain/${source}] war=${warId} prev=${prevChain.current||0} curr=${chain.current||0} cooldown=${chain.cooldown} timeout=${chain.timeout} tokens=${tokenCount} willPush=${countChanged || cooldownFlipped || broke}`);
  if (countChanged || cooldownFlipped || broke) {
    broadcastChainLiveActivity(warId, war, chain, broke).catch((e) =>
      console.warn(`[chain] Live Activity broadcast failed: ${e.message}`)
    );
  }

  const isCoolingDown = chain.cooldown > 0;
  if (!isCoolingDown && chain.timeout > 0 && chain.current >= CHAIN_MIN_HITS) {
    if (chain.timeout <= CHAIN_PANIC_THRESHOLD) {
      const lastPanic = lastPanicSent.get(warId) || 0;
      if (Date.now() - lastPanic > CHAIN_PANIC_COOLDOWN_MS) {
        lastPanicSent.set(warId, Date.now());
        const warPlayers = store.getOnlinePlayersForWar(warId);
        push.notifyChainPanic(warPlayers, warId, chain.current, Math.round(chain.timeout));
        console.log(`[chain] PANIC alert: chain ${chain.current}, ${Math.round(chain.timeout)}s remaining (${source})`);
      }
    } else if (chain.timeout <= CHAIN_ALERT_THRESHOLD) {
      const lastAlert = lastAlertSent.get(warId) || 0;
      if (Date.now() - lastAlert > CHAIN_ALERT_COOLDOWN_MS) {
        lastAlertSent.set(warId, Date.now());
        const warPlayers = store.getOnlinePlayersForWar(warId);
        push.notifyChainAlert(warPlayers, warId, chain.current, chain.timeout, Math.round(chain.timeout));
        console.log(`[chain] Warning alert: chain ${chain.current}, ${Math.round(chain.timeout)}s remaining (${source})`);
      }
    }
  }
  if (!isCoolingDown && chain.current >= CHAIN_MIN_HITS) {
    const nextBonus = BONUS_HITS.find((b) => b > chain.current);
    if (nextBonus && nextBonus - chain.current <= 2 && (prevChain.current || 0) < chain.current) {
      const warPlayers = store.getOnlinePlayersForWar(warId);
      push.notifyBonusImminent(warPlayers, warId, chain.current, nextBonus);
    }
  }
}

/**
 * Public entry: ingest a client-pushed chain snapshot. Updates
 * chainDataUpdatedAt so the server-side poll's gate sees fresh
 * data and skips its Torn fetch. Rejects snapshots older than what
 * we already have so a slow client can't override fresh data.
 */
export async function recordClientChainData(warId, chain) {
  const war = store.getWar(warId);
  if (!war || war.warEnded) return false;
  if (!chain || typeof chain !== "object") return false;
  // serverTimestamp on chain (epoch seconds) — if older than what we have,
  // ignore. Avoids a stale-cached client overwriting a fresh server poll.
  const incomingTs  = Number(chain.serverTimestamp) || 0;
  const existingTs  = Number(war.chainData?.serverTimestamp) || 0;
  if (incomingTs && existingTs && incomingTs < existingTs) return false;
  await _processChain(warId, war, chain, /*io*/ null, "client");
  return true;
}

/**
 * Start chain monitoring for a war room.
 * @param {string} warId
 */
export function startChainMonitor(io, warId) {
  if (timeouts.has(warId)) return; // already monitoring

  const scheduleNext = (delay) => {
    const tid = setTimeout(poll, delay);
    timeouts.set(warId, tid);
  };

  const poll = async () => {
    const war = store.getWar(warId);
    if (!war || !war.factionId) { scheduleNext(nextChain(war)); return; }

    // Round-robin across pool keys. Needed up-front for both the
    // chain fetch (when not gated) AND the war-score check.
    _chainPollCursor = (_chainPollCursor + 1) | 0;
    const apiKey = store.getPollingKey(war.factionId, "chain", _chainPollCursor);
    if (!apiKey) { scheduleNext(nextChain(war)); return; }

    // GATE: if any client (FactionOps / iOS / Android) has pushed
    // chain data within CLIENT_CHAIN_FRESH_MS, skip the Torn fetch.
    // Alert evaluation already ran inside recordClientChainData when
    // that push landed, so there's nothing else to do for the chain
    // path on this tick. War-score check still runs.
    const updatedAt = Number(war.chainDataUpdatedAt) || 0;
    const ageMs = Date.now() - updatedAt;
    const skipChainFetch = ageMs < CLIENT_CHAIN_FRESH_MS;

    try {
      if (skipChainFetch) {
        console.log(`[chain/skip] war=${warId} client data is ${Math.round(ageMs / 1000)}s old (gate=${CLIENT_CHAIN_FRESH_MS / 1000}s)`);
        backoffs.set(warId, POLL_INTERVAL_MS);
      } else {
        const chain = await fetchFactionChain(war.factionId, apiKey);
        // Note: removed cache age compensation — it was over-correcting and
        // causing false chain alerts (e.g. 128s timeout reported as 58s).
        // Torn's chain.timeout is already the value at time of API response.
        await _processChain(warId, war, chain, io, "poll");
        backoffs.set(warId, POLL_INTERVAL_MS);
      }

      // ── War score check (every 60s) ──
      const lastCheck = lastScoreCheck.get(warId) || 0;
      if (Date.now() - lastCheck > WAR_SCORE_CHECK_INTERVAL) {
        lastScoreCheck.set(warId, Date.now());
        try {
          const rw = await fetchRankedWar(war.factionId, apiKey);
          if (!rw && war.warScores && !war.warEnded) {
            // War was active (had scores) but now returns null — war ended
            war.warEnded = true;
            war.warEndedAt = Date.now();
            // Determine winner from last known scores
            const myScore = war.warScores.myScore || 0;
            const enemyScore = war.warScores.enemyScore || 0;
            war.warResult = myScore > enemyScore ? 'victory' : myScore < enemyScore ? 'defeat' : 'draw';
            store.saveState();
            console.log(`[chain] War ended: ${war.factionId} vs ${war.enemyFactionId} — ${war.warResult.toUpperCase()} (${myScore} vs ${enemyScore})`);
            // Tell every player's service worker to dismiss any sticky
            // chain-alert / chain-panic notifications still pinned from
            // pre-end alerts. Without this, requireInteraction:true in
            // sw.js leaves chain-break notifications pinned to the OS
            // notification panel until manual swipe — surfacing
            // day-old "chain breaking" alerts at random.
            const warPlayersForClear = store.getOnlinePlayersForWar(warId);
            push.notifyClearChainAlerts(warPlayersForClear, warId, war.warResult)
              .catch((e) => console.warn(`[chain] clear-chain-alerts push failed: ${e.message}`));
            // War chat is now persistent (data/war-chat.json) and
            // accumulates across war boundaries — factions asked for
            // permanent history. Manual wipe still available via
            // chat.clearForWar() if an admin ever needs it.
            // Broadcast war-ended event to all clients
            if (io) {
              io.to(`war_${warId}`).emit('war_ended', {
                warId,
                result: war.warResult,
                myScore,
                enemyScore,
                endedAt: war.warEndedAt,
              });
            }
          }
          if (rw) {
            // Store scores on war object so clients can display them
            war.warScores = { myScore: rw.myScore, enemyScore: rw.enemyScore };

            // If war was marked as ended but we now see it active (or a new war started), clear end flags
            if (war.warEnded) {
              delete war.warEnded;
              delete war.warEndedAt;
              delete war.warResult;
              console.log(`[chain] War back active or new war detected for faction ${war.factionId}`);
              store.saveState();
            }

            // If the enemy changed, wipe old data safely through store
            if (rw.enemyFactionId && String(war.enemyFactionId) !== String(rw.enemyFactionId)) {
              console.log(`[chain] Enemy faction changed from ${war.enemyFactionId} to ${rw.enemyFactionId}`);
              store.getOrCreateWar(warId, war.factionId, rw.enemyFactionId);
            }

            // Calculate server-side war ETA
            const warStart = rw.warStart || war.warStart || 0;
            if (warStart) war.warStart = warStart;
            
            // Server-side calculation. Wait, if hoursRemaining is < 0 it was setting etaTimestamp to the past, making the client say WON.
            // Let's protect against gap <= 0
            if (warStart && rw.warTarget && rw.myScore != null) {
              const nowSec = Math.floor(Date.now() / 1000);
              const totalElapsedHours = (nowSec - warStart) / 3600;

              let hoursRemainingFloat = 0;
              
              if (totalElapsedHours > 24) {
                const dropHours = Math.floor(totalElapsedHours - 24);
                const originalTarget = rw.warTarget / (1 - (dropHours * 0.01));
                const DROP_PER_HOUR = originalTarget * 0.01;
                const lead = Math.max(rw.myScore, rw.enemyScore);
                const gap = rw.warTarget - lead;
                hoursRemainingFloat = gap / DROP_PER_HOUR;
              } else {
                // Pre-24h phase: Calculate time until decay starts (24h mark) + time to decay the gap
                const DROP_PER_HOUR = rw.warTarget * 0.01;
                const lead = Math.max(rw.myScore, rw.enemyScore);
                const gap = rw.warTarget - lead;
                const timeUntilDecayStarts = 24 - totalElapsedHours;
                hoursRemainingFloat = timeUntilDecayStarts + (gap / DROP_PER_HOUR);
              }

              war.warEta = {
                etaTimestamp: hoursRemainingFloat > 0 ? Math.floor(Date.now() + (hoursRemainingFloat * 3600000)) : 0,
                hoursRemaining: Math.max(0, hoursRemainingFloat),
                currentTarget: rw.warTarget,
                calculatedAt: Date.now(),
              };
            }

            store.saveState();

            // Broadcast updated scores to all connected clients (Socket.IO)
            if (io) {
              const pct = (war.warTarget && war.warTarget.value && war.warScores)
                ? Math.min(100, Math.floor((war.warScores.myScore / war.warTarget.value) * 100))
                : null;
              io.to(`war_${warId}`).emit('war_update', {
                warScores: war.warScores,
                warEta: war.warEta,
                warPercentage: pct,
              });
            }

            // Check if custom war target reached
            if (war.warTarget && war.warTarget.value && !war.warTarget.notifiedAt && !warTargetNotified.get(warId)) {
              if (rw.myScore >= war.warTarget.value) {
                warTargetNotified.set(warId, true);
                war.warTarget.notifiedAt = Date.now();
                store.saveState();
                const warPlayers = store.getOnlinePlayersForWar(warId);
                push.notifyWarTargetReached(warPlayers, warId, war.warTarget.value, rw.myScore);
                console.log(`[chain] War target ${war.warTarget.value} reached! Score: ${rw.myScore} (server poll)`);
              }
            }
          }
        } catch (scoreErr) {
          console.error(`[chain] War score check failed: ${scoreErr.message}`);
        }
      }

      scheduleNext(nextChain(war));
    } catch (err) {
      if (/Incorrect ID-entity relation/i.test(err.message)) {
        store.quarantinePoolKey(apiKey, war.factionId, 'chain code 7');
      } else if (/Incorrect key|\(code 2\)/i.test(err.message)) {
        // v5.0.3: code 2 = key regenerated/revoked; quarantine same as
        // code 7 so the rotation stops picking the dead key.
        store.quarantinePoolKey(apiKey, war.factionId, 'chain code 2');
      }
      // Exponential backoff on failure
      const current = backoffs.get(warId) || POLL_INTERVAL_MS;
      const next = Math.min(current * 2, MAX_BACKOFF_MS);
      backoffs.set(warId, next);
      console.error(`[chain] Poll failed for war ${warId}: ${err.message} (retry in ${Math.round(next / 1000)}s)`);
      scheduleNext(next);
    }
  };

  backoffs.set(warId, POLL_INTERVAL_MS);
  poll();
  console.log(`[chain] Started monitoring for war ${warId} (server fallback, polls every ${POLL_INTERVAL_MS / 1000}s when no client active)`);
}

/**
 * Stop chain monitoring for a war room.
 */
export function stopChainMonitor(warId) {
  const tid = timeouts.get(warId);
  if (tid) {
    clearTimeout(tid);
    timeouts.delete(warId);
  }
  backoffs.delete(warId);
  lastAlertSent.delete(warId);
  lastScoreCheck.delete(warId);
  warTargetNotified.delete(warId);
  console.log(`[chain] Stopped monitoring for war ${warId}`);
}

/**
 * Push a chain ContentState to every iOS Live Activity registered
 * against this warId. Reaps tokens that APNs rejects as invalid
 * (BadDeviceToken / Unregistered) so the storage doesn't accumulate
 * dead registrations.
 *
 * Mirrors the field shape of ChainActivityAttributes.ContentState in
 * the iOS app — each key here MUST match a property name there or the
 * widget will silently render stale values for missing keys.
 */
async function broadcastChainLiveActivity(warId, war, chain, broke) {
  const tokens = liveActivityTokens.listForWar(warId);
  if (tokens.length === 0) return;
  const nowMs = Date.now();
  const timeoutDeadlineMs = chain.timeout > 0
    ? nowMs + Math.round(chain.timeout * 1000)
    : 0;
  const cooldownDeadlineMs = chain.cooldown > 0
    ? nowMs + Math.round(chain.cooldown * 1000)
    : 0;
  const contentState = {
    chain: chain.current || 0,
    timeoutDeadlineMs,
    cooldownDeadlineMs,
    myScore: war.warScores?.myScore || 0,
    enemyScore: war.warScores?.enemyScore || 0,
  };
  const event = broke ? "end" : "update";
  // Stale-date is "after this point iOS should treat the widget as
  // outdated." Setting it to (timeout + 30s) gives the activity a
  // graceful fade once the deadline passes if no further push arrives.
  const staleDateUnix = timeoutDeadlineMs > 0
    ? Math.floor(timeoutDeadlineMs / 1000) + 30
    : Math.floor(nowMs / 1000) + 600;

  await Promise.all(tokens.map(async (row) => {
    const result = await apns.sendLiveActivity(row.token, contentState, {
      event,
      staleDateUnix,
      // For end events, dismiss within ~1 minute so the user isn't
      // staring at a dead chain banner forever.
      dismissalDateUnix: event === "end"
        ? Math.floor(nowMs / 1000) + 60
        : undefined,
    });
    if (!result.ok) {
      // Permanently-dead token reasons. ExpiredToken means iOS killed
      // the activity (typically the 8-hour Live Activity cap) and
      // invalidated this push token; the user must reopen the app to
      // create a new activity + register a new token. BadDeviceToken /
      // Unregistered cover earlier-stage invalidations (app uninstalled,
      // never properly registered, etc.). All three: drop the row so
      // we stop pushing into the void.
      if (result.reason === "BadDeviceToken" ||
          result.reason === "Unregistered" ||
          result.reason === "ExpiredToken") {
        liveActivityTokens.removeByToken(row.token);
        console.log(`[chain/la] dropped dead token for player ${row.playerId} (${result.reason}) — needs app reopen for re-registration`);
      } else if (result.reason !== "not-configured") {
        console.warn(`[chain/la] push failed for player ${row.playerId}: ${result.reason}`);
      }
    }
  }));
  if (event === "end") {
    liveActivityTokens.clearWar(warId);
  }
}

/**
 * Stop all chain monitors (for graceful shutdown).
 */
export function stopAll() {
  for (const [warId, tid] of timeouts) {
    clearTimeout(tid);
    console.log(`[chain] Stopped monitoring for war ${warId}`);
  }
  timeouts.clear();
  backoffs.clear();
  lastAlertSent.clear();
  lastScoreCheck.clear();
  warTargetNotified.clear();
}
