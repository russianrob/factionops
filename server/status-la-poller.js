/**
 * Background poll loop for Status Live Activity subscribers.
 *
 * Every POLL_INTERVAL_MS (default 5 min), iterates every registered
 * (playerId, token, apiKey) row and:
 *   1. Hits Torn's /user?selections=bars,cooldowns with that apiKey
 *   2. Builds the StatusActivityAttributes.ContentState payload
 *   3. Pushes it to that device's push token via apns.sendLiveActivity
 *
 * Failures handled gracefully:
 *   - Torn API errors (invalid key, rate-limit) → skip this row, retry
 *     next tick. Persistent failures don't kick the user out — they
 *     just see stale data until the next successful poll.
 *   - APNs BadDeviceToken / Unregistered → token is reaped via
 *     status-la-tokens.remove(). User has to re-subscribe.
 *
 * Boot: only starts when the master encryption key is configured
 * (loadable via key-encryption), so a misconfigured dev server doesn't
 * crash-loop on apiKey decryption.
 */

import * as tokens from "./status-la-tokens.js";
import * as watchTokens from "./watch-tokens.js";
import * as apns from "./apns.js";

// The watch app's bundle ID — used as the apns-topic for background
// pushes to the paired Apple Watch. Distinct from the iPhone bundle
// (env APNS_BUNDLE_ID), so we hardcode the watchOS identifier here.
// If we ever ship a separate watchOS app variant we can env-gate this.
const WATCH_BUNDLE_ID = "com.tornwar.warboard.watchkitapp";

const POLL_INTERVAL_MS = Number(process.env.STATUS_LA_POLL_MS) || 5 * 60 * 1000; // 5 min
const POLL_JITTER_MS = 30 * 1000; // spread initial start so all users don't poll the same instant

// The binding constraint is NOT the APNs push budget — it is WidgetKit's
// refresh budget of roughly 40-70 reloads PER DAY, which every push consumes
// via WatchBarsStore's reloadAllTimelines(). Exhaust it and WidgetKit stops
// redrawing the complication at all, so pushes keep being accepted while the
// watch face sits on a stale reading (it sat on one for 31h, at HTTP 200).
//
// Budget arithmetic, since both mechanisms share one allowance:
//   this push cadence  30 min -> 48/day
//   timeline policy     4 h   ->  6/day  (StatusComplication.swift)
//                             -> ~54/day total, inside the range.
// The first fix used a 15-min floor: 96/day on its own, still over. Err low —
// Apple documents a range, not a number.
const WATCH_MIN_INTERVAL_MS = 30 * 60 * 1000;
const _lastWatchPushAt = new Map(); // playerId -> ms
let _timer = null;
let _started = false;

async function fetchBars(apiKey) {
  const url = `https://api.torn.com/user?selections=bars,cooldowns&key=${encodeURIComponent(apiKey)}&comment=wb-status-la`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) return { error: `http ${res.status}` };
    const json = await res.json();
    if (json.error) return { error: json.error.error || "torn-error" };
    return { data: json };
  } catch (e) {
    return { error: e.message || "fetch-failed" };
  }
}

function buildContentState(json) {
  // Match StatusActivityAttributes.ContentState shape exactly — Apple
  // delivers the JSON straight into the ActivityKit decoder, so the
  // keys + types have to line up with the Codable struct.
  const nowMs = Date.now();
  const energy = json.energy || {};
  const nerve = json.nerve || {};
  const cd = json.cooldowns || {};
  const drugSec = Number(cd.drug) || 0;
  const boosterSec = Number(cd.booster) || 0;
  return {
    energyCurrent: Number(energy.current) || 0,
    energyMax: Number(energy.maximum) || 0,
    nerveCurrent: Number(nerve.current) || 0,
    nerveMax: Number(nerve.maximum) || 0,
    drugDeadlineMs: drugSec > 0 ? nowMs + drugSec * 1000 : 0,
    boosterDeadlineMs: boosterSec > 0 ? nowMs + boosterSec * 1000 : 0,
    writtenAtMs: nowMs,
  };
}

async function tick() {
  // Union of subscribers across LA + watch — a user may have either
  // or both registered. We poll Torn ONCE per playerId regardless of
  // which channels are active, then fan out the same state to every
  // active channel for that player.
  const laRows = tokens.listAllDecrypted();
  const watchRows = watchTokens.listAllDecrypted();
  const byPlayer = new Map();
  for (const r of laRows) {
    const p = byPlayer.get(r.playerId) || { playerId: r.playerId, apiKey: r.apiKey };
    p.laToken = r.token;
    byPlayer.set(r.playerId, p);
  }
  for (const r of watchRows) {
    const p = byPlayer.get(r.playerId) || { playerId: r.playerId, apiKey: r.apiKey };
    p.watchToken = r.token;
    // Prefer the apiKey that was registered most recently — both
    // sources carry it; either should work but the watch one is more
    // likely current if the user just subscribed.
    p.apiKey = r.apiKey;
    byPlayer.set(r.playerId, p);
  }
  if (byPlayer.size === 0) return;

  for (const row of byPlayer.values()) {
    const { data, error } = await fetchBars(row.apiKey);
    if (error) continue;
    const state = buildContentState(data);

    // Channel 1: iPhone Status Live Activity.
    if (row.laToken) {
      const result = await apns.sendLiveActivity(row.laToken, state, { event: "update" });
      if (!result.ok) {
        const reason = result.reason || result.apnsStatus || "";
        if (reason === "BadDeviceToken" || reason === "Unregistered"
            || result.apnsStatus === 410) {
          tokens.remove({ token: row.laToken });
          console.log(`[status-la] reaped dead LA token for player ${row.playerId} (${reason})`);
        }
      }
    }

    // Channel 2: Apple Watch background push, rate-limited independently.
    const lastWatch = _lastWatchPushAt.get(row.playerId) || 0;
    if (row.watchToken && Date.now() - lastWatch >= WATCH_MIN_INTERVAL_MS) {
      _lastWatchPushAt.set(row.playerId, Date.now());
      // Same ContentState dict — the watch decodes it from userInfo
      // and updates WatchBarsStore which reloads StatusComplication.
      const result = await apns.sendBackgroundUpdate(row.watchToken, { bars: state }, {
        topic: WATCH_BUNDLE_ID,
      });
      // Log the OUTCOME, not just the reap. This branch used to be silent for
      // every failure except a dead token, so a push that APNs rejected — wrong
      // topic, auth error, throttling — looked identical to one that worked.
      // The watch sat on a stale reading for 31h and nothing said a word.
      const reason = result.reason || result.status || "";
      if (!result.ok) {
        console.log(`[status-la] watch push FAILED for ${row.playerId}: ${JSON.stringify(result)}`);
        if (reason === "BadDeviceToken" || reason === "Unregistered" || result.status === 410) {
          watchTokens.remove({ token: row.watchToken });
          console.log(`[status-la] reaped dead watch token for player ${row.playerId} (${reason})`);
        }
      } else {
        // Accepted by APNs. NOT proof the watch applied it — watchOS budgets
        // background pushes to a watch app and silently drops the excess — but
        // it does separate "we sent it" from "Apple refused it".
        console.log(`[status-la] watch push accepted for ${row.playerId} (E:${state.energyCurrent}/${state.energyMax})`);
      }
    }
  }
}

export function start() {
  if (_started) return;
  _started = true;
  console.log(`[status-la] poller starting (interval=${POLL_INTERVAL_MS / 1000}s)`);
  // Stagger the first run by a small jitter so server-boot stampedes
  // don't all hit Torn at once if many users are subscribed.
  const initialDelay = Math.floor(Math.random() * POLL_JITTER_MS);
  _timer = setTimeout(function loop() {
    tick().catch(e => console.error("[status-la] tick error:", e.message));
    _timer = setTimeout(loop, POLL_INTERVAL_MS);
  }, initialDelay);
}

export function stop() {
  if (_timer) clearTimeout(_timer);
  _timer = null;
  _started = false;
}
