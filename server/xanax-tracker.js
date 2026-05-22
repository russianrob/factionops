/**
 * Per-war xanax accountability tracker.
 *
 * Polls the faction armoury news during an active war, parses entries
 * matching "<player> took N x Xanax from the armoury", and accumulates
 * a per-(warId, playerId) count of xanax pulled during the war window.
 *
 * Combined with the per-member attack counts already produced by the
 * post-war report, lets a leader see who took war drugs without
 * delivering the expected attacks (1 xanax = ~250 energy = 10 war
 * attacks at 25 e each, so the rule of thumb the user picked is
 * `expected_attacks = xanax_taken * 10`).
 *
 * Polling cadence: every 5 minutes per active war. Uses pool keys via
 * store.getPollingKey so the load spreads across faction members.
 *
 * Persistence: writes to war.xanaxStats = {
 *   lastPolledAt: unix_seconds,
 *   taken:        { [playerId]: count },
 *   names:        { [playerId]: lastSeenPlayerName },
 *   entryCount:   total armory entries observed,
 * }
 * via store.saveState(). Survives pm2 reloads.
 */

import * as store from "./store.js";
import { fetchFactionArmouryNews, fetchFactionArmouryNewsRange } from "./torn-api.js";

const POLL_INTERVAL_MS = 5 * 60 * 1000;     // 5 min
const MAX_BACKOFF_MS   = 30 * 60 * 1000;    // 30 min cap on retry backoff
// Many factions stack xanax in the 24h before a ranked war starts
// (legitimate energy prep — you take xanax now so the energy is
// available when the war kicks off). Counting only xanax taken AFTER
// warStart would unfairly flag everyone who pre-stacked. Backfill the
// window so the deficit math credits pre-war energy too.
const PRE_WAR_LOOKBACK_SEC = 24 * 60 * 60;  // 24 hours
// And many factions keep chaining for hours after a war ends —
// finishing off a respect chain that built up during the war. Xanax
// taken in those hours is still part of the same effort. Extend the
// post-war window so it gets counted too. Post-war attack counts get
// added separately by the post-war report endpoint via the faction
// attack log so the math stays fair.
const POST_WAR_LOOKAHEAD_SEC = 24 * 60 * 60; // 24 hours

/** Per-warId timeout handles so we can cancel cleanly. */
const timers   = new Map();
/** Per-warId pool-key cursor (round-robin across faction keys). */
const cursors  = new Map();
/** Per-warId backoff in ms after consecutive failures. */
const backoffs = new Map();

/**
 * Match xanax-related armoury news. Two phrasings observed in live data:
 *
 *   <a ...XID=ID>NAME</a> used one of the faction's Xanax items
 *     → consumption, one xanax per entry
 *
 *   <a ...XID=ID>NAME</a> deposited Nx Xanax
 *     → return to armoury — N can be any positive integer. 2026-05-17:
 *       per user request, deposits subtract from the consumption count
 *       so the net 'taken from war' figure is accurate for members who
 *       took xanax but didn't end up using it (gave it back).
 *
 * Returns:
 *   { playerId, playerName, qty: 1, type: 'used' }       for consumption
 *   { playerId, playerName, qty: N, type: 'deposited' }  for deposits
 *   null                                                  for everything else
 */
const TOOK_XANAX_RE = /<a[^>]*XID=(\d+)[^>]*>([^<]+)<\/a>\s+used\s+one\s+of\s+the\s+faction's\s+Xanax\s+items/i;
const DEPOSIT_XANAX_RE = /<a[^>]*XID=(\d+)[^>]*>([^<]+)<\/a>\s+deposited\s+(\d+)\s*x?\s*Xanax/i;
function parseXanaxEntry(news) {
  if (!news || typeof news !== "string") return null;
  let m = news.match(TOOK_XANAX_RE);
  if (m) return { playerId: m[1], playerName: m[2].trim(), qty: 1, type: 'used' };
  m = news.match(DEPOSIT_XANAX_RE);
  if (m) {
    const qty = parseInt(m[3], 10);
    if (!Number.isFinite(qty) || qty <= 0) return null;
    return { playerId: m[1], playerName: m[2].trim(), qty, type: 'deposited' };
  }
  return null;
}

/**
 * Begin polling armoury news for this war. Idempotent — calling twice
 * is a no-op once the timer is registered. Stops automatically when
 * the war's warEnded flag flips true.
 */
export function startXanaxTracker(warId) {
  if (!warId || timers.has(warId)) return;

  const tick = async () => {
    const war = store.getWar(warId);
    if (!war || !war.factionId || war.warEnded) {
      // 2026-05-22: keep polling for POST_WAR_LOOKAHEAD_SEC (24h)
      // AFTER warEnded flips true. Late xanax deposits (someone gives
      // back unused vials hours after the war ends) need to land in
      // the report; the original "one final flush + stop" logic was
      // dropping them even though the matching events would have
      // counted under the 24h cap. Cadence relaxed to 5 min post-war
      // since news rate is much lower then.
      if (war?.warEnded) {
        await pollOnce(warId).catch(() => {});
        const cutoffMs = (Number(war.warEndedAt) || Date.now()) + POST_WAR_LOOKAHEAD_SEC * 1000;
        if (Date.now() < cutoffMs) {
          timers.set(warId, setTimeout(tick, 5 * 60 * 1000));
          return;
        }
        stopXanaxTracker(warId);
        return;
      }
      // No war record yet — try again in a minute.
      timers.set(warId, setTimeout(tick, 60_000));
      return;
    }

    let nextDelay = POLL_INTERVAL_MS;
    try {
      await pollOnce(warId);
      backoffs.delete(warId);
    } catch (err) {
      const cur = backoffs.get(warId) || POLL_INTERVAL_MS;
      const next = Math.min(cur * 2, MAX_BACKOFF_MS);
      backoffs.set(warId, next);
      nextDelay = next;
      console.warn(`[xanax-tracker] war ${warId}: poll failed (${err.message}); retry in ${Math.round(next/1000)}s`);
    }
    timers.set(warId, setTimeout(tick, nextDelay));
  };

  // Kick off immediately so the first window of news is captured
  // without waiting 5 min — useful when a war is detected mid-flight
  // (start-of-tracker = several minutes after war start).
  timers.set(warId, setTimeout(tick, 1_000));
  console.log(`[xanax-tracker] Started for war ${warId} (poll every ${POLL_INTERVAL_MS/1000}s)`);
}

/** Cancel polling for this warId. Idempotent. */
export function stopXanaxTracker(warId) {
  const t = timers.get(warId);
  if (t) clearTimeout(t);
  timers.delete(warId);
  cursors.delete(warId);
  backoffs.delete(warId);
  console.log(`[xanax-tracker] Stopped for war ${warId}`);
}

/** Stop every active tracker (graceful shutdown). */
export function stopAll() {
  for (const [warId, t] of timers) {
    clearTimeout(t);
    console.log(`[xanax-tracker] Stopped for war ${warId}`);
  }
  timers.clear();
  cursors.clear();
  backoffs.clear();
}

/**
 * Read the current accumulated stats for a war. Empty object if the
 * war has no record or no tracker has run yet. Safe to call from the
 * post-war report endpoint regardless of whether the tracker is alive.
 */
export function getStats(warId) {
  const war = store.getWar(warId);
  if (!war || !war.xanaxStats) {
    return { lastPolledAt: 0, taken: {}, names: {}, entryCount: 0 };
  }
  return {
    lastPolledAt: war.xanaxStats.lastPolledAt || 0,
    taken:        war.xanaxStats.taken        || {},
    names:        war.xanaxStats.names        || {},
    entryCount:   war.xanaxStats.entryCount   || 0,
  };
}

/**
 * One round of polling. Fetches armoury news from `lastPolledAt`
 * onward (or from war.warStart if first run), parses xanax events,
 * and merges into war.xanaxStats. Throws on API failures so the
 * caller's backoff logic kicks in.
 */
async function pollOnce(warId) {
  const war = store.getWar(warId);
  if (!war || !war.factionId) throw new Error("no war or factionId");

  const cursor = (cursors.get(warId) || 0) + 1;
  cursors.set(warId, cursor);
  const apiKey = store.getPollingKey(war.factionId, "xanax-tracker", cursor);
  if (!apiKey) throw new Error("no pool key available");

  const stats = war.xanaxStats || { lastPolledAt: 0, taken: {}, names: {}, entryCount: 0 };
  // First-ever poll for this war: walk back PRE_WAR_LOOKBACK_SEC so we
  // capture the pre-war stacking phase (faction members typically take
  // 1-3 xanax in the 24h before kickoff to bank energy). Subsequent
  // polls only fetch from lastPolledAt forward.
  const fromTs = stats.lastPolledAt
    || ((war.warStart || Math.floor(Date.now()/1000)) - PRE_WAR_LOOKBACK_SEC);
  // Cap polling at warEndedAt + POST_WAR_LOOKAHEAD_SEC for ended wars.
  // Includes the chain-finishing window where members keep xanaxing
  // to extend the chain that built up during the war. Beyond that,
  // xanax usage is normal-life consumption and not war-related.
  const warEndCapSec = war.warEnded && war.warEndedAt
    ? Math.floor(Number(war.warEndedAt) / 1000) + POST_WAR_LOOKAHEAD_SEC
    : null;
  // Torn caps results at 100 entries per call. For a busy faction this
  // can mean a single fetch only covers 1-3 hours of news, so the first
  // pull (covering 24h+ of pre-war + war-so-far) needs pagination. Walk
  // backwards in time using `to` until we either reach fromTs or get a
  // partial page (signal that we've drained the window).
  const allEntries = [];
  let to = Math.floor(Date.now()/1000);
  for (let page = 0; page < 30; page++) {
    const batch = await fetchFactionArmouryNewsRange(war.factionId, apiKey, fromTs, to);
    if (batch.length === 0) break;
    allEntries.push(...batch);
    if (batch.length < 100) break;
    // The fetcher returns sorted-ascending; use the oldest to step `to`
    // backwards by 1s for the next page so we don't double-count.
    to = batch[0].timestamp - 1;
    if (to <= fromTs) break;
  }
  // De-dup by entry id in case pages overlap (defense-in-depth).
  const seen = new Set();
  const entries = [];
  for (const e of allEntries) {
    if (seen.has(e.id)) continue;
    seen.add(e.id);
    entries.push(e);
  }
  entries.sort((a, b) => a.timestamp - b.timestamp);
  let newCount = 0;
  let highestTs = stats.lastPolledAt;
  for (const e of entries) {
    if (e.timestamp <= stats.lastPolledAt) continue;
    // Cap at warEndedAt + POST_WAR_LOOKAHEAD_SEC for ended wars —
    // events past that belong to normal-life xanax usage. Within
    // the cap (war + 24h post-war chain finish) we count it.
    if (warEndCapSec && e.timestamp > warEndCapSec) continue;
    if (e.timestamp > highestTs) highestTs = e.timestamp;
    stats.entryCount++;
    const parsed = parseXanaxEntry(e.news);
    if (!parsed) continue;
    if (parsed.type === 'deposited') {
      // 2026-05-17: deposits net against takes. Floor at 0 — a member
      // who only deposits (e.g. brought xanax from outside) shouldn't
      // show as a negative consumer.
      const cur = stats.taken[parsed.playerId] || 0;
      stats.taken[parsed.playerId] = Math.max(0, cur - parsed.qty);
      stats.names[parsed.playerId] = parsed.playerName;
      newCount -= parsed.qty; // log shows net change
    } else {
      stats.taken[parsed.playerId] = (stats.taken[parsed.playerId] || 0) + parsed.qty;
      stats.names[parsed.playerId] = parsed.playerName;
      newCount += parsed.qty;
    }
  }
  stats.lastPolledAt = highestTs || Math.floor(Date.now()/1000);
  war.xanaxStats = stats;
  store.saveState();

  if (newCount > 0) {
    console.log(`[xanax-tracker] war ${warId}: +${newCount} xanax across ${entries.length} new entry(s)`);
  }
}

// Exported for unit-style testing of the regex from elsewhere if ever
// useful. Not used by production code paths.
export const _internal = { parseXanaxEntry, TOOK_XANAX_RE };

// Exposed for admin one-time repoll endpoint — bypasses the
// startXanaxTracker timer registration. Returns the post-poll stats.
// Rotates through up to 8 pool keys so a single insufficient-access
// key doesn't fail the whole repoll (mirrors war-payouts.js pattern).
export async function repollNow(warId) {
  const MAX_TRIES = 8;
  let lastErr = null;
  for (let i = 0; i < MAX_TRIES; i++) {
    try {
      await pollOnce(warId);
      return getStats(warId);
    } catch (e) {
      lastErr = e;
      // Code 16 = access level too low, code 7 = id-entity relation.
      // Both are key-specific; retry with the next cursor.
      if (!/code 16|code 7|access level|no pool key/i.test(e.message || '')) throw e;
    }
  }
  throw lastErr || new Error("repoll exhausted pool keys");
}
