/**
 * Chain monitoring service.
 *
 * Server-side fallback: polls Torn API for chain data when no client is
 * reporting chain info (i.e. nobody has FactionOps open). Fires push
 * notifications for chain-break alerts and bonus-imminent hits.
 *
 * Polls only when no client has reported chain data in the last
 * CLIENT_CHAIN_FRESH_MS. In a live war it alerts on chains of 10 or more,
 * at the faction's chain pace. Outside one (after the war, before kickoff)
 * it alerts on chains of 100 or more, and reads the chain every 2 minutes
 * until it reaches 100: see chain-alert-rule.js.
 */

import { bonusToAnnounce } from "./chain-bonus.js";
import * as store from "./store.js";
import { fetchFactionChain, fetchRankedWar } from "./torn-api.js";
import * as push from "./push-notifications.js";
import * as apns from "./apns.js";
import * as liveActivityTokens from "./live-activity-tokens.js";
import { normalizeChainData, chainWithLiveTimeout } from "./chain-data.js";
import {
  isWarLive, chainAlertFloor, outsideWarDelay, outsideWarChainEnded, outsideWarBadDrop,
  isBigLiveChain, isCooldown, CHAIN_END_CONFIRM_MS, OUTSIDE_WAR_MIN_CHAIN, CHAIN_CLOCK_MAX_S,
  apiChainView, pageLeadsApi, PAGE_REPORT_FRESH_MS,
} from "./chain-alert-rule.js";

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
const CHAIN_ALERT_COOLDOWN_MS = 30_000; // max one alert push per 30s per war
const CHAIN_PANIC_COOLDOWN_MS = 20_000; // max one panic push per 20s per war
const WAR_SCORE_CHECK_INTERVAL = 300_000; // normal cadence (score/ETA don't need 30s freshness)
// Endgame cadence. The score check below is the ONLY thing that detects a
// war ending, so its interval IS the delay between a war finishing on Torn
// and FactionOps saying so — at the flat 5-minute cadence an ended war kept
// showing as live for up to 5 minutes (observed 2026-08-21, war 47710).
// Speeding up only near the finish keeps the key pool untouched for the 99%
// of a war that isn't the end.
const WAR_SCORE_ENDGAME_INTERVAL = 30_000;
// Ceiling on how soon a FAILED check may be retried.
const WAR_SCORE_RETRY_INTERVAL = 60_000;
// How close the margin must come to the target to count as endgame.
const ENDGAME_MARGIN_RATIO = 0.9;

/**
 * How long to wait before the next ranked-war score check.
 *
 * Keyed off the MARGIN between the two factions rather than either raw
 * score, because a ranked war ends when one faction's LEAD reaches the
 * target. Faction 42055 finished 24169 vs 10567 against a 13900 target:
 * the winning score passed the target hours before the war ended, while
 * the margin (13602) is what actually converged on it. Reading a raw
 * score here would flip every war into endgame cadence early and hold it
 * there.
 *
 * Scope note: this picks a POLLING CADENCE only. The warEta calculations
 * elsewhere in this file still use their existing model — deliberately
 * left alone, tracked separately.
 */
export function warScoreCheckInterval(war) {
  try {
    const target = Number(war?.warEta?.currentTarget) || Number(war?.warOrigTarget) || 0;
    if (!target || !war?.warScores) return WAR_SCORE_CHECK_INTERVAL;
    const my = Number(war.warScores.myScore) || 0;
    const enemy = Number(war.warScores.enemyScore) || 0;
    return Math.abs(my - enemy) >= target * ENDGAME_MARGIN_RATIO
      ? WAR_SCORE_ENDGAME_INTERVAL
      : WAR_SCORE_CHECK_INTERVAL;
  } catch (_) {
    return WAR_SCORE_CHECK_INTERVAL;
  }
}

/** Last bonus announced per war, so one bonus yields one notification. */
const lastBonusAnnounced = new Map();

/** Active polling timeout IDs per warId so we can clean them up. */
const timeouts = new Map();
/** Current backoff delay per warId (resets on success). */
const backoffs = new Map();

/** Last time we sent a chain alert push per warId. */
const lastAlertSent = new Map();
/** Last time we sent a chain panic push per warId. */
const lastPanicSent = new Map();
/** Wall-clock (ms) of the last hit per warId (see _processChain). A hit
 * resets Torn's chain timer to ~5:00, so a recent one means a low reported
 * timeout is a stale/lagging snapshot, not a real break. */
const lastChainIncreaseAt = new Map();
/** The count at the last hit and when it was read, { count, atMs } per warId:
 * while it is at most 5 minutes old, a rise counts as a hit only above it. */
const lastChainHit = new Map();
/** Wall-clock (ms) of the last reading of a running chain of 100 or more per
 * warId. Outside a war it keeps the reads at the war's pace for a while
 * after it. */
const lastBigChainAt = new Map();
/** Outside a war, the end of a 100+ chain waiting for its count to hold,
 * { count, since } per warId (see CHAIN_END_CONFIRM_MS). */
const pendingChainEnd = new Map();
/** The count of the last chain whose end was noticed per warId, so a stale
 * report from before that end can't bring a second notice. */
const lastChainEndNoticed = new Map();
/** Last time we checked war score per warId. */
const lastScoreCheck = new Map();
/** Track if we already notified war target reached per warId. */
const warTargetNotified = new Map();
/** The page report held per warId, { count, endsAtMs, atMs, playerId }: the
 * chain as a member's focused Torn page showed it (see recordPageChain). */
const pageChain = new Map();
/** Last time a page report, and a reading a page report leads, was logged
 * per warId. */
const lastPageReportLog = new Map();
const lastPageLeadLog = new Map();
/** Those two lines are logged at most this often per war. */
const PAGE_LOG_EVERY_MS = 60_000;
/** Two reports of the same count whose ends are this close are one reading. */
const PAGE_SAME_END_MS = 2_000;

/**
 * Apply a fresh chain snapshot to a war and run the alert / Live
 * Activity / war-target-evaluation pipeline. Source-agnostic — used
 * by both the server's Torn poll and the client-push endpoint. The
 * `source` arg is just for log lines so we can see in pm2 whether the
 * data came from a client or our own poll.
 */
/**
 * Audience for chain / war PUSH notifications: every faction member warboard
 * knows about — NOT store.getOnlinePlayersForWar, which lists only players with
 * a LIVE warboard session. A push notification exists to reach a LOCKED phone
 * (which by definition has no live session), so gating the audience on "online"
 * silently dropped exactly the people who needed it — the reported symptom that
 * chain alerts only arrived while factionops was open. The push layer filters
 * this list to members reachable on any transport (hasAnyPushChannel — web
 * push OR a registered warboard app device), so unreachable / departed
 * members are still skipped. It deliberately does NOT filter on web push
 * alone: that dropped every app-only member from a whole war's alerts.
 */
function pushAudience(war) {
  return war && war.factionId
    ? store.getPlayerIdsForFaction(war.factionId).map((id) => ({ id }))
    : [];
}

/**
 * The low-clock push for a chain of `count` with `timeoutS` left: CHAIN
 * DYING at CHAIN_PANIC_THRESHOLD or less, else CHAIN BREAKING at
 * CHAIN_ALERT_THRESHOLD or less, each at most once per its cooldown per war,
 * whichever reading (`source`, for the log) it comes from.
 */
function sendLowClockAlert(warId, war, count, timeoutS, source) {
  if (timeoutS <= CHAIN_PANIC_THRESHOLD) {
    const lastPanic = lastPanicSent.get(warId) || 0;
    if (Date.now() - lastPanic > CHAIN_PANIC_COOLDOWN_MS) {
      lastPanicSent.set(warId, Date.now());
      const warPlayers = pushAudience(war);
      push.notifyChainPanic(warPlayers, warId, count, Math.round(timeoutS));
      console.log(`[chain] PANIC alert: chain ${count}, ${Math.round(timeoutS)}s remaining (${source})`);
    }
  } else if (timeoutS <= CHAIN_ALERT_THRESHOLD) {
    const lastAlert = lastAlertSent.get(warId) || 0;
    if (Date.now() - lastAlert > CHAIN_ALERT_COOLDOWN_MS) {
      lastAlertSent.set(warId, Date.now());
      const warPlayers = pushAudience(war);
      push.notifyChainAlert(warPlayers, warId, count, timeoutS, Math.round(timeoutS));
      console.log(`[chain] Warning alert: chain ${count}, ${Math.round(timeoutS)}s remaining (${source})`);
    }
  }
}

/**
 * The low-clock alerts on a page report's clock, counted down to `nowMs`,
 * for a chain at or over the floor (chainAlertFloor). The check of the
 * API's low clocks against the time since the last hit (timerPlausible in
 * _processChain) is for the API's lag: a page's clock is the game's own.
 */
function checkPageClock(warId, war, page, nowMs) {
  const leftS = Math.round((page.endsAtMs - nowMs) / 1000);
  if (leftS > 0 && page.count >= chainAlertFloor(war, nowMs)) {
    sendLowClockAlert(warId, war, page.count, leftS, "page");
  }
}

async function _processChain(warId, war, chain, io, source) {
  const prevChain = chainWithLiveTimeout({ ...war.chainData }, Date.now());
  // The age of that reading, taken before it is overwritten below: a record
  // left from before a restart must not pass for a chain that just ended.
  const prevAgeMs = Date.now() - (Number(war.chainDataUpdatedAt) || 0);
  const warLive = isWarLive(war, Date.now());
  // Outside a war, a reading under 100 while a chain of 100 or more still has
  // time on its clock is a bad one (outsideWarBadDrop), and it is not stored.
  // Nor does it count as a report: chainDataUpdatedAt stays, so the poll
  // below reads the chain itself.
  if (!warLive && outsideWarBadDrop({
    prevCurrent: prevChain.current || 0,
    prevTimeoutS: prevChain.timeout,
    current: chain.current || 0,
  })) {
    console.log(`[chain/${source}] war=${warId} ignored a reading of ${chain.current || 0}: the chain read ${prevChain.current} with ${Math.round(prevChain.timeout)}s left`);
    return false;
  }
  // Store by absolute end instant. `chain` keeps its live `timeout` for the
  // alert thresholds below; only the STORED copy is normalized, so the record
  // stops changing on every poll and the long-poll can stay held. See
  // chain-data.js for why that matters.
  war.chainData = normalizeChainData(chain, Date.now());
  war.chainDataUpdatedAt = Date.now();
  store.saveState();

  const countChanged = (prevChain.current || 0) !== (chain.current || 0);
  const cooldownFlipped = ((prevChain.cooldown || 0) > 0) !== ((chain.cooldown || 0) > 0);
  const broke = (prevChain.current || 0) > 0 && (chain.current || 0) === 0;
  // A hit, for the low-clock check below: a count above the stored record's
  // and, while the last hit is at most 5 minutes old, above that hit's
  // count. A member's bad 0 (or a lagging lower count) is stored too, and the
  // real count's next reading used to pass for a hit: the check then muted
  // the chain's real low clock until the next hit, and on 2026-09-18 a chain
  // broke that way with no alert. After a restart the stored count stands in
  // for the last hit.
  const current = Number(chain.current) || 0;
  const prevCurrent = Number(prevChain.current) || 0;
  const lastHit = lastChainHit.get(warId) || { count: prevCurrent, atMs: Date.now() };
  const lastHitRecent = Date.now() - lastHit.atMs <= CHAIN_CLOCK_MAX_S * 1000;
  if (current > prevCurrent && (!lastHitRecent || current > lastHit.count)) {
    lastChainIncreaseAt.set(warId, Date.now());
    lastChainHit.set(warId, { count: current, atMs: Date.now() });
  } else if (!lastChainHit.has(warId)) {
    lastChainHit.set(warId, lastHit);
  }
  // Chains are alerted from 10 hits in a live war, and from 100 outside one.
  const minChain = chainAlertFloor(war, Date.now());
  if (isBigLiveChain(chain)) lastBigChainAt.set(warId, Date.now());
  const tokenCount = liveActivityTokens.listForWar(warId).length;
  // The iOS Live Activity belongs to the war: the war's end ends it (in the
  // poll loop below), and a chain after the war does not raise it again.
  const willPush = !war.warEnded && (countChanged || cooldownFlipped || broke);
  console.log(`[chain/${source}] war=${warId} prev=${prevChain.current||0} curr=${chain.current||0} cooldown=${chain.cooldown} timeout=${chain.timeout} tokens=${tokenCount} willPush=${willPush}`);
  if (willPush) {
    broadcastChainLiveActivity(warId, war, chain, broke).catch((e) =>
      console.warn(`[chain] Live Activity broadcast failed: ${e.message}`)
    );
  }

  const isCoolingDown = chain.cooldown > 0;
  // While a member's page report is ahead of this reading (Torn's API runs
  // behind the game at times), the page's clock decides the low-clock
  // alerts, and this reading's is not used: see pageLeadsApi.
  const page = pageChain.get(warId);
  if (pageLeadsApi(page, apiChainView(chain, Date.now()), Date.now())) {
    if (Date.now() - (lastPageLeadLog.get(warId) || 0) >= PAGE_LOG_EVERY_MS) {
      lastPageLeadLog.set(warId, Date.now());
      console.log(`[chain] page leads: API read ${chain.current || 0} (cooldown=${chain.cooldown} timeout=${chain.timeout}), page ${page.count} with ${Math.round((page.endsAtMs - Date.now()) / 1000)}s left (${source})`);
    }
    checkPageClock(warId, war, page, Date.now());
  } else {
    // A hit resets Torn's chain timer to ~5:00, so within ~4 min of the last
    // hit (see above) the timer physically can't be near zero — reject
    // the low reading as a stale/lagging snapshot instead of pushing a false
    // "chain dying" alert to everyone. Real stalls (no hit for minutes) still fire.
    const secsSinceHit = (Date.now() - (lastChainIncreaseAt.get(warId) || 0)) / 1000;
    const timerPlausible = chain.timeout >= (300 - secsSinceHit) - 60;
    if (!isCoolingDown && !timerPlausible && chain.timeout > 0 && chain.timeout <= CHAIN_ALERT_THRESHOLD && chain.current >= minChain) {
      console.log(`[chain] SUPPRESSED stale alert: chain ${chain.current}, timeout=${Math.round(chain.timeout)}s but only ${Math.round(secsSinceHit)}s since last hit (${source})`);
    }
    if (!isCoolingDown && timerPlausible && chain.timeout > 0 && chain.current >= minChain) {
      sendLowClockAlert(warId, war, chain.current, chain.timeout, source);
    }
  }
  if (!isCoolingDown && chain.current >= minChain) {
    const already = lastBonusAnnounced.get(warId);
    const bonus = bonusToAnnounce(prevChain.current || 0, chain.current || 0, already);
    if (bonus) {
      lastBonusAnnounced.set(warId, bonus);
      const warPlayers = pushAudience(war);
      push.notifyBonusImminent(warPlayers, warId, chain.current, bonus);
      // Logged like the panic and warning branches. This was the only alert
      // with no log line, which is why "am I getting bonus notifications?"
      // could not be answered from the logs at all.
      console.log(`[chain] Bonus alert: chain ${chain.current}/${bonus} (${source})`);
    }
  }
  // Outside a war, a chain of 100 or more that ends gets one quiet notice,
  // which also takes down its pinned CHAIN BREAKING / CHAIN DYING alerts, as
  // the war's end does for a war's. outsideWarChainEnded says which reading
  // may be the end, and the notice waits for the count to hold in the
  // cooldown for CHAIN_END_CONFIRM_MS. A reading of 100+ with another
  // count, or with time on its clock, calls the wait off; one under 100, as
  // a bad 0 in the cooldown is, leaves it be.
  if (!warLive && (chain.current || 0) >= OUTSIDE_WAR_MIN_CHAIN) {
    const count = chain.current;
    const pending = pendingChainEnd.get(warId);
    if (pending && (count !== pending.count || (!(chain.cooldown > 0) && chain.timeout > 0))) {
      pendingChainEnd.delete(warId);
      console.log(`[chain] Chain end at ${pending.count} called off: read ${count}, timeout=${chain.timeout} cooldown=${chain.cooldown} (${source})`);
    } else if (pending) {
      if (isCooldown(chain.cooldown) && Date.now() - pending.since >= CHAIN_END_CONFIRM_MS) {
        pendingChainEnd.delete(warId);
        if (lastChainEndNoticed.get(warId) !== count) {
          lastChainEndNoticed.set(warId, count);
          push.notifyChainEnded(pushAudience(war), warId, count)
            .catch((e) => console.warn(`[chain] chain-ended push failed: ${e.message}`));
          console.log(`[chain] Chain ended outside a war at ${count} (${source})`);
        }
      }
    } else if (outsideWarChainEnded({
      prevCurrent: prevChain.current || 0,
      prevTimeoutS: prevChain.timeout,
      prevCooldown: prevChain.cooldown,
      prevAgeMs,
      current: count,
      cooldown: chain.cooldown,
    })) {
      pendingChainEnd.set(warId, { count, since: Date.now() });
      console.log(`[chain] Chain may have ended outside a war at ${count}: noticed if it holds ${CHAIN_END_CONFIRM_MS / 60_000} minutes (${source})`);
    }
  }
  // A broken or reset chain starts the announcements over: the next chain
  // deserves its own warning at the same milestone.
  if ((chain.current || 0) < (prevChain.current || 0)) lastBonusAnnounced.delete(warId);
}

/**
 * Public entry: ingest a client-pushed chain snapshot. Updates
 * chainDataUpdatedAt so the server-side poll's gate sees fresh
 * data and skips its Torn fetch. Rejects snapshots older than what
 * we already have so a slow client can't override fresh data.
 * Taken after a war ends too: the chain is still watched then (from 100
 * hits), and FactionOps keeps sending it. Returns false for a snapshot not
 * taken: a stale one, or a bad reading _processChain turns away.
 */
export async function recordClientChainData(warId, chain) {
  const war = store.getWar(warId);
  if (!war) return false;
  if (!chain || typeof chain !== "object") return false;
  // serverTimestamp on chain (epoch seconds) — if older than what we have,
  // ignore. Avoids a stale-cached client overwriting a fresh server poll.
  const incomingTs  = Number(chain.serverTimestamp) || 0;
  const existingTs  = Number(war.chainData?.serverTimestamp) || 0;
  if (incomingTs && existingTs && incomingTs < existingTs) return false;
  return (await _processChain(warId, war, chain, /*io*/ null, "client")) !== false;
}

/**
 * Public entry: a page report, parsePageReport's { count, endsAtMs }, from a
 * member's focused Torn page (FactionOps 5.6.28 and later, through POST
 * /api/chain-page). Of the fresh reports the one held is the furthest
 * ahead: a lower count, or the same count with an end over PAGE_SAME_END_MS
 * earlier, is behind it and turned away (false), and the same reading again
 * refreshes it, keeping the later end. While the held report leads the last
 * reading (pageLeadsApi), its clock is checked at once. Only the low-clock
 * alerts read page reports: the stored chain, the Live Activity, the bonus
 * alerts and the chain-ended notice stay on the API's readings.
 */
export function recordPageChain(warId, report, playerId) {
  const war = store.getWar(warId);
  if (!war || !report) return false;
  const now = Date.now();
  const page = { count: report.count, endsAtMs: report.endsAtMs, atMs: now, playerId };
  const held = pageChain.get(warId);
  if (held && now - held.atMs <= PAGE_REPORT_FRESH_MS) {
    if (page.count < held.count) return false;
    if (page.count === held.count) {
      if (page.endsAtMs < held.endsAtMs - PAGE_SAME_END_MS) return false;
      page.endsAtMs = Math.max(page.endsAtMs, held.endsAtMs);
    }
  }
  pageChain.set(warId, page);
  const leads = pageLeadsApi(page, apiChainView(war.chainData, Number(war.chainDataUpdatedAt) || now), now);
  if (now - (lastPageReportLog.get(warId) || 0) >= PAGE_LOG_EVERY_MS) {
    lastPageReportLog.set(warId, now);
    console.log(`[chain/page] war=${warId} player=${playerId} count=${page.count} left=${Math.round((page.endsAtMs - now) / 1000)}s leads=${leads ? "yes" : "no"}`);
  }
  if (leads) checkPageClock(warId, war, page, now);
  return true;
}

/**
 * Start chain monitoring for a war room.
 * @param {string} warId
 */
export function startChainMonitor(io, warId) {
  if (timeouts.has(warId)) return; // already monitoring
  // Taken now, not when the first tick sets its timer: that tick reads Torn
  // first, and a start while the read was out (a member's poll right after a
  // restart, 2026-10-28) passed the check above and ran a second loop.
  timeouts.set(warId, null);

  const scheduleNext = (delay) => {
    const tid = setTimeout(poll, delay);
    timeouts.set(warId, tid);
  };

  const poll = async () => {
    const war = store.getWar(warId);
    if (!war || !war.factionId) { scheduleNext(nextChain(war)); return; }

    // A war that has ended keeps its watch. This loop used to stop at the
    // war's end, and on 2026-10-26 a chain that ran on for seven hours after
    // its war died with no alert. Outside a live war (after it, and before
    // kickoff) the chain is read every 2 minutes, and at the war's pace while
    // it reads 100 or more: see chain-alert-rule.js and the scheduling at the
    // end of this tick.
    //
    // On the first tick after the end, clear the war's scores, as the stop
    // here used to (they pinned the score check at its 30s endgame cadence:
    // a ranked war ends exactly when the lead reaches the target), and its
    // target alert, so the next war on this record gets its own.
    if (war.warEnded && war.warScores) {
      delete war.warScores;
      warTargetNotified.delete(warId);
      store.saveState();
      console.log(`[chain] war ${warId} ended — watching the chain outside the war (alerts from ${OUTSIDE_WAR_MIN_CHAIN} hits)`);
    }

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
      // Deferred, not handled here: the war-score check below is the only
      // war-end detector, and it sat downstream of this fetch in the same
      // try — so any chain API hiccup skipped end-detection for that whole
      // tick. Rethrown after the check so the outer catch still runs its
      // key quarantine/demote and backoff exactly as before.
      let chainErr = null;
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
      } catch (e) { chainErr = e; }

      // ── War score check (adaptive: 5 min normally, 30s near the finish) ──
      const scoreDueIn = warScoreCheckInterval(war);
      const lastCheck = lastScoreCheck.get(warId) || 0;
      // Not once the war has ended: the war-scanner finds the next war. Here,
      // the `if (rw)` branch below would clear the ended war's flags before
      // getOrCreateWar, which archives a war only while it is flagged ended.
      if (!war.warEnded && Date.now() - lastCheck > scoreDueIn) {
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
            const warPlayersForClear = pushAudience(war);
            push.notifyClearChainAlerts(warPlayersForClear, warId, war.warResult)
              .catch((e) => console.warn(`[chain] clear-chain-alerts push failed: ${e.message}`));
            // Dismiss any chain Live Activity island still up when the war
            // ends — the chain may not have broken to 0 (e.g. war target
            // reached), so the chain==0 broadcast path won't fire.
            broadcastChainLiveActivity(warId, war, { current: 0, timeout: 0, cooldown: 0 }, /*broke*/ true)
              .catch((e) => console.warn(`[chain] war-end Live Activity end failed: ${e.message}`));
            // War chat is now persistent (data/war-chat.json) and
            // accumulates across war boundaries — factions asked for
            // permanent history. Manual wipe still available via
            // chat.clearForWar() if an admin ever needs it.
            // Broadcast war-ended event to all clients, over BOTH transports.
            //
            // This used to emit to the Socket.IO war room only. No client has
            // joined that room since 5.1.68 (join_war was sent from the socket
            // connect handler, which stopped running when the socket stopped
            // connecting, and was removed outright in 5.1.72) — so this event
            // has been reaching nobody, and the war-ended banner never raised
            // itself from here.
            if (io) {
              io.to(`war_${warId}`).emit('war_ended', {
                warId,
                result: war.warResult,
                myScore,
                enemyScore,
                endedAt: war.warEndedAt,
              });
            }
            // NOT the same payload: the Socket.IO event's field names
            // (`result`, `myScore`, `endedAt`) are read by nothing on the
            // client. `applyServerData` keys off `warEnded` — which is what
            // raises the banner — plus `warResult` and `warScores`. Copying the
            // socket payload verbatim would deliver a message that parses fine
            // and does nothing at all.
            //
            // Dynamic import because routes.js imports THIS module (routes.js:120),
            // so a static import would close the cycle.
            import("./routes.js").then(r => r.broadcastSSE(warId, {
              warEnded: true,
              warResult: war.warResult,
              warScores: war.warScores,
            })).catch(() => {});
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

            // Broadcast updated scores to all connected clients, over BOTH
            // transports.
            //
            // This is the periodic score refresh, and it was Socket.IO-only —
            // reaching nobody since 5.1.68, for the reason above. It matters
            // more than it looks: an SSE client STOPS polling once its stream is
            // live (connectSSEStream calls stopPolling, and startPolling refuses
            // to restart while sseConnected), so in a quiet stretch — no calls,
            // no status changes to trigger broadcastWarUpdate — the score and
            // ETA on screen simply froze, with nothing underneath to backfill
            // them.
            //
            // `pct` is computed outside the `if (io)` now: SSE must get it
            // whether or not a Socket.IO server is attached.
            const pct = (war.warTarget && war.warTarget.value && war.warScores)
              ? Math.min(100, Math.floor((war.warScores.myScore / war.warTarget.value) * 100))
              : null;
            const scorePayload = {
              warScores: war.warScores,
              warEta: war.warEta,
              warPercentage: pct,
            };
            if (io) io.to(`war_${warId}`).emit('war_update', scorePayload);
            // Field names here already match what `applyServerData` reads, so
            // this one IS the same payload. Dynamic import per the note above.
            import("./routes.js").then(r => r.broadcastSSE(warId, scorePayload)).catch(() => {});

            // Check if custom war target reached
            if (war.warTarget && war.warTarget.value && !war.warTarget.notifiedAt && !warTargetNotified.get(warId)) {
              if (rw.myScore >= war.warTarget.value) {
                warTargetNotified.set(warId, true);
                war.warTarget.notifiedAt = Date.now();
                store.saveState();
                const warPlayers = pushAudience(war);
                push.notifyWarTargetReached(warPlayers, warId, war.warTarget.value, rw.myScore);
                console.log(`[chain] War target ${war.warTarget.value} reached! Score: ${rw.myScore} (server poll)`);
              }
            }
          }
          // Stamped on COMPLETION, not before the fetch. Stamping up front
          // meant a single thrown check forfeited the entire window, so one
          // transient Torn error delayed war-end detection by a further five
          // minutes on top of the cadence.
          lastScoreCheck.set(warId, Date.now());
        } catch (scoreErr) {
          // Retry sooner than the normal cadence, but never sooner than the
          // cadence itself — otherwise a Torn outage turns every chain tick
          // (~10-20s) into an extra ranked-war call against the pool.
          const retryIn = Math.min(scoreDueIn, WAR_SCORE_RETRY_INTERVAL);
          lastScoreCheck.set(warId, Date.now() - Math.max(0, scoreDueIn - retryIn));
          console.error(`[chain] War score check failed: ${scoreErr.message} (retry in ${Math.round(retryIn / 1000)}s)`);
        }
      }

      if (chainErr) throw chainErr;
      // In a live war, the war's pace. Outside one, every 2 minutes, or the
      // war's pace while the chain reads 100 or more (and for a while after),
      // and before kickoff never later than kickoff.
      const now = Date.now();
      scheduleNext(isWarLive(war, now)
        ? nextChain(war)
        : outsideWarDelay(war, now, nextChain(war), now - (lastBigChainAt.get(warId) || 0)));
    } catch (err) {
      if (/Incorrect ID-entity relation/i.test(err.message)) {
        store.quarantinePoolKey(apiKey, war.factionId, 'chain code 7');
      } else if (/Incorrect key|\(code 2\)/i.test(err.message)) {
        // v5.0.3: code 2 = key regenerated/revoked; quarantine same as
        // code 7 so the rotation stops picking the dead key.
        store.quarantinePoolKey(apiKey, war.factionId, 'chain code 2');
      } else if (/Access level of this key is not high enough|\(code 16\)/i.test(err.message)) {
        // code 16 = this key can't serve the chain selection. Its key/info may
        // still advertise 'chain', so pure metadata routing keeps round-robining
        // onto it and floods this log every poll. Demote it away from 'chain'
        // (non-destructive — it stays usable for calls it can serve); the router
        // then skips it. Owner re-opt-in clears the demotion.
        store.demotePoolKeySelection(apiKey, war.factionId, 'chain');
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
  lastPanicSent.delete(warId);
  lastChainIncreaseAt.delete(warId);
  lastChainHit.delete(warId);
  pageChain.delete(warId);
  lastPageReportLog.delete(warId);
  lastPageLeadLog.delete(warId);
  lastBigChainAt.delete(warId);
  pendingChainEnd.delete(warId);
  lastChainEndNoticed.delete(warId);
  lastBonusAnnounced.delete(warId);
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
