// Personal Torn-events watcher.
//
// Polls each opted-in player's own Torn events feed with THEIR OWN stored key
// and pushes anything new straight to the warboard app (APNs/FCM — no Web Push
// copy). This has to live on the server: iOS suspends the app and warboard has
// no BGTaskScheduler, so a closed app cannot notice that someone attacked you.
// Flight warnings stay on-device (a flight cannot land early, so scheduling
// ahead is safe). Hospital does NOT: meds, revives and extensions move the
// release, so it is evaluated here on every poll instead — see hospitalWarning.
//
// Cost is ~1.3 calls/min against the player's OWN key (100/min budget), so it
// never touches the faction pool and scales to faction-wide opt-in later.

import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import * as store from "./store.js";
import * as push from "./push-notifications.js";
import { pickNewEvents, buildNotifications, hospitalWarning } from "./personal-events.js";
import { isQuietHour } from "./personal-quiet-hours.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const STATE_FILE = join(__dirname, "data", "personal-events-state.json");
const WATCH_FILE = join(__dirname, "data", "personal-watch.json");

// 3 minutes, matching TornPDA — the Torn-endorsed app doing the same job. Its
// alerts.ts shards users across three staggered jobs ("0,3,6,9,…", "1,4,7,…",
// "2,5,8,…"), i.e. every user checked every 3 min, watching the same set:
// hospital, travel, energy, nerve, life, drug, events.
//
// Was 45s. That is 1,920 calls/day on the player's own key and it exhausted
// Torn's DAILY read cap at ~03:39 EDT, after which every poll failed and attack
// + hospital alerts were dead until reset — silently, for two thirds of every
// day. Trading 45s of latency for alerts that actually work around the clock is
// not a close call.
const POLL_MS = 180_000;

// Overnight quiet window. Polling every 45s round the clock exhausted Torn's
// DAILY read cap by ~04:00 EDT, after which every poll failed and attack +
// hospital alerts were dead for the rest of the day — silently. Skipping the
// hours the player is asleep preserves the budget for the hours they are not,
// and stops 3am pushes into the bargain.
//
// NOTE the cost comment at the top of this file reasons about the 100/min
// budget, which 45s never troubles. The daily cap is the limit that actually
// binds here, and it was not considered.
const QUIET = {
  enabled: process.env.PERSONAL_QUIET_DISABLED !== "1",
  startHour: Number(process.env.PERSONAL_QUIET_START ?? 22),
  endHour: Number(process.env.PERSONAL_QUIET_END ?? 6),
  timeZone: process.env.PERSONAL_QUIET_TZ || "America/New_York",
};
let _quietLogged = false;
const EVENT_LIMIT = 25;

/** playerId -> { seen: string[], firstRunDone: bool } */
let _state = {};
/** { players: ["137558", ...] } — who is watched. */
let _watch = { players: [] };
let _timer = null;
let _polling = false;

function loadState() {
  try { if (existsSync(STATE_FILE)) _state = JSON.parse(readFileSync(STATE_FILE, "utf-8")) || {}; }
  catch (e) { console.error("[personal] state load failed:", e.message); _state = {}; }
}
function saveState() {
  try {
    mkdirSync(dirname(STATE_FILE), { recursive: true });
    writeFileSync(STATE_FILE, JSON.stringify(_state));
  } catch (e) { console.error("[personal] state save failed:", e.message); }
}
function loadWatch() {
  try { if (existsSync(WATCH_FILE)) _watch = JSON.parse(readFileSync(WATCH_FILE, "utf-8")) || _watch; }
  catch (e) { console.error("[personal] watch load failed:", e.message); }
}

export function getWatchedPlayers() { loadWatch(); return _watch.players || []; }
export function setWatchedPlayers(players) {
  _watch = { players: [...new Set((players || []).map(String))].slice(0, 100) };
  try {
    mkdirSync(dirname(WATCH_FILE), { recursive: true });
    writeFileSync(WATCH_FILE, JSON.stringify(_watch, null, 2));
  } catch (e) { console.error("[personal] watch save failed:", e.message); }
  return _watch.players;
}

async function pollPlayer(playerId) {
  const key = store.getApiKeyForPlayer(playerId);
  if (!key) return;                       // no stored key — silently skip

  // `profile` rides along in the SAME call — status.state/until for the
  // hospital warning costs nothing extra.
  const url = `https://api.torn.com/user/?selections=events,profile&limit=${EVENT_LIMIT}` +
              `&key=${encodeURIComponent(key)}&comment=wb-personal`;
  let json;
  try {
    const r = await fetch(url);
    if (!r.ok) { console.warn(`[personal] ${playerId} http ${r.status}`); return; }
    json = await r.json();
  } catch (e) {
    console.warn(`[personal] ${playerId} fetch failed:`, e.message);
    return;                               // never mark seen on a failed fetch
  }
  if (!json || json.error) {
    console.warn(`[personal] ${playerId} api error:`, json?.error?.error || "unknown");
    return;
  }

  const prev = _state[playerId] || { seen: [], firstRunDone: false, warnedHospUntil: null };

  // Evaluated fresh every poll rather than scheduled ahead: if the player
  // medded out, state is no longer Hospital and nothing is sent. This ran
  // on-device before and fired after people had already left.
  const hw = hospitalWarning(json.status, Date.now(), prev.warnedHospUntil);
  if (hw.warn) {
    prev.warnedHospUntil = hw.until;
    _state[playerId] = { ...prev };
    saveState();
    console.log(`[personal] ${playerId} -> hospital out in ~${hw.seconds}s`);
    await push.sendToPlayer(playerId, {
      title: "Out of hospital soon 🏥",
      body: `You leave hospital in about ${hw.seconds} seconds.`,
      tag: "hospital-out",
      data: { url: "https://www.torn.com" },
    }, "torn_event", { urgency: "high", nativeOnly: true }).catch((e) =>
      console.error("[personal] hospital push failed:", e.message));
  } else if (json.status && json.status.state !== "Hospital" && prev.warnedHospUntil != null) {
    prev.warnedHospUntil = null;                 // released — arm for the next stay
  }
  const { fresh, seen } = pickNewEvents(json.events, new Set(prev.seen), !prev.firstRunDone);
  _state[playerId] = { seen: [...seen], firstRunDone: true, warnedHospUntil: prev.warnedHospUntil ?? null };
  saveState();

  if (!prev.firstRunDone) {
    console.log(`[personal] ${playerId} baseline set (${seen.size} events marked seen, none pushed)`);
    return;
  }
  if (!fresh.length) return;

  for (const n of buildNotifications(fresh)) {
    console.log(`[personal] ${playerId} -> ${n.body.slice(0, 70)}`);
    await push.sendToPlayer(playerId, {
      title: n.title,
      body: n.body,
      tag: n.tag,
      data: { url: "https://www.torn.com/events.php" },
      // Native app only: no duplicate Web Push banner.
    }, "torn_event", { urgency: "high", nativeOnly: true }).catch((e) =>
      console.error("[personal] push failed:", e.message));
  }
}

async function pollOnce() {
  if (_polling) return;
  if (isQuietHour(new Date(), QUIET)) {
    // Log the transition only — one line a night, not one every 45s.
    if (!_quietLogged) {
      console.log(`[personal] quiet hours (${QUIET.startHour}:00-${QUIET.endHour}:00 ${QUIET.timeZone}) — polling paused`);
      _quietLogged = true;
    }
    return;
  }
  if (_quietLogged) { console.log("[personal] quiet hours over — polling resumed"); _quietLogged = false; }
  _polling = true;
  try {
    loadWatch();                          // pick up watchlist edits without a reload
    for (const playerId of _watch.players || []) {
      await pollPlayer(String(playerId));
    }
  } catch (e) {
    console.error("[personal] poll failed:", e.message);
  } finally { _polling = false; }
}

export function startPersonalWatcher() {
  loadState();
  loadWatch();
  if (!(_watch.players || []).length) {
    console.log("[personal] no watched players — watcher idle");
  } else {
    console.log(`[personal] watching ${_watch.players.length} player(s) every ${POLL_MS / 1000}s`);
  }
  if (_timer) clearInterval(_timer);
  _timer = setInterval(pollOnce, POLL_MS);
  if (_timer.unref) _timer.unref();
  pollOnce();
}

export function stopPersonalWatcher() {
  if (_timer) { clearInterval(_timer); _timer = null; }
}
