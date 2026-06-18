# Stakeout Server-Side Push — Design

> **REVISION 2026-06-18b — isolated per-owner key model (supersedes Components 1–3 below).**
> Per RussianRob's directive, the stakeout key is a **self-contained island**: each user enters their own Torn key in the userscript, which POSTs `{apiKey, players, factions}` to an **unauthenticated** `POST /api/stakeout/sync`. The server resolves the key's owner via one Torn `/user` call, stores the key **AES-encrypted in `data/stakeout-watchers.json`** (per owner — `{ owners: { <pid>: { key, players, factions } } }`), and the watcher polls **only that owner's targets using only that owner's key**. The key is **never** put in warboard's `store`/pool, `player-keys.json`, the factionops `/api/auth` JWT, or the faction lock. Polling is **per-owner** (a target watched by two people is fetched twice, once per key); clearing a watch list **deletes the stored key**. The only warboard surface used is push **delivery** (APNs/FCM/Web Push). This replaces the original "shared subscriber row + caller's-own-key via `store.getApiKeyForPlayer` + faction-locked `/api/auth`" design in Components 1–3 and the Data-flow section. The **canonical, current build instructions live in the plan**: `docs/superpowers/plans/2026-06-18-stakeout-server-push.md` (v2). Sections below on delivery fan-out, Web Push, error handling, and testing remain accurate.

## Goal

Move Stakeout trigger detection off the user's phone/browser and onto the always-on warboard VPS, so attack-window alerts (target comes online / leaves hospital / lands / becomes revivable) fire even when the app or tab is fully closed. The userscript stays the editor of the watch list; the server mirrors it, polls Torn, edge-detects, and pushes via OS/browser channels.

## Problem

The Stakeout userscript (`torn-stakeout.user.js`) runs in page context and only evaluates triggers while a Torn tab is open and `pollOnce` is ticking. The moment the user closes the tab (desktop), backgrounds/closes the PDA app (iOS), or closes the Android fork, detection stops — there is no process left to notice that a watched target just came online. This is a platform constraint on all three surfaces:

- **iOS** (warboard PDA / app web view): page-context JS cannot fire native notifications when the app is closed; `GM_notification`/`browser.notifications` are no-ops in that runtime.
- **Android / PDA fork**: same — the userscript engine is dead once the host app is closed.
- **Desktop Chrome**: a userscript cannot register a service worker for our origin (it runs inside `torn.com`, origin-locked), so it cannot receive a tab-closed push at all.

The only way to alert a closed app is for an always-on server to do the detection and deliver through real OS/browser push channels (APNs, FCM, Web Push). That server is the warboard VPS.

## Architecture overview

One server-side watcher polls only actively-watched targets (using each watch-list owner's own Torn key), edge-detects with the **exact same pure engine the userscript already ships**, and fans each fired alert out to three delivery channels through the existing canonical push path.

```
  ┌────────────────────────┐   POST /api/stakeout/sync (JWT)    ┌──────────────────────────────┐
  │ torn-stakeout.user.js  │ ─────────────────────────────────▶ │  routes.js  (requireAuth)    │
  │  (EDITOR on PDA +      │   {players[], factions[]}          │  validate + owner=req.user   │
  │   desktop Chrome)      │   on-change(2s) + heartbeat(10m)   └──────────────┬───────────────┘
  └────────────────────────┘                                                   │ replaceOwnerWatchlist
                                                                               ▼
                              data/stakeout-watchers.json   ◀────────  stakeout-watcher.js
                              { players:{<id>:{subscribers, info, seeded}},     │  setInterval ~30s
                                factions:{<id>:{...}} }                         │  poll DISTINCT targets only
                                                                               │  key = store.getApiKeyForPlayer(owner)
                                                                               ▼
                                          require('./public/scripts/torn-stakeout.user.js')
                                          engine.evaluatePlayer / evaluateFaction (edge-detect)
                                                                               │ fired keys (per subscriber)
                                                                               ▼
                                          push.sendToPlayers(subscriberIds, payload, 'stakeout_alert')
                                                   │                 │                  │
                                          ┌────────┘        ┌────────┘         ┌────────┘
                                          ▼                 ▼                  ▼
                                    Web Push (NEW       APNs (iOS,         FCM (Android/
                                    use, existing       reuse)            PDA, reuse)
                                    stack) desktop
                                    Chrome, tab closed
```

The only genuinely new delivery code is one notify helper, one `NOTIFICATION_TYPES` entry, and a `threadId` field on the payload. Web Push is an existing, live stack reused via the same `sendToPlayers` call — it is not a new transport.

## Components

### 1. Data model + sync API

**Sync endpoint:** `POST /api/stakeout/sync` (new route in `routes.js`, modeled on `/api/me/bars` at `routes.js:1883`).

- Auth via `requireAuth` (`auth.js:180`). The owner of the synced list is `String(req.user.playerId)` — resolved from the JWT, **never** from the request body. Any client-sent identity field is ignored.
- Rate-limit: reuse the existing `warRoomPerJwtLimiter` (240 req / 60s per JWT) by adding `app.use('/api/stakeout/sync', warRoomPerJwtLimiter)` in `server.js` before the router mounts (alongside the existing `server.js:213-216` lines). No new limiter instance needed; the global `/api/*` backstop (`server.js:147`) still applies.
- Body limit: `express.json({ limit: '16kb' })`. *(The auth-section draft proposed 4kb; 16kb is chosen to comfortably hold the per-owner cap below. Final value — see Open Decisions.)*

**Request body** — the per-target watch + alert config serialized from the userscript's `stakeout_players` / `stakeout_factions` arrays, with each record's cached `info` snapshot and the secret `apiKey` **stripped client-side**:

```json
{
  "players": [
    { "id": 2194491, "label": "", "alerts": {
        "okay": false, "hospital": true, "landing": true, "online": true,
        "life": false, "offline": false, "revivable": false } }
  ],
  "factions": [
    { "id": 16335, "alerts": {
        "chainReaches": false, "memberCountDrops": false,
        "rankedWarStarts": true, "inRaid": false, "inTerritoryWar": false } }
  ]
}
```

The `alerts` objects are verbatim `defaultPlayerAlerts()` / `defaultFactionAlerts()` (`torn-stakeout.user.js:358-359`) as the user edited them. The **tri-state** convention is honored exactly: `false` = OFF; a number = ON-with-threshold for `life` (percent), `offline` (hours), `chainReaches` (chain level, `0` = the special "active chain of 10+ dropped" mode), and `memberCountDrops` (member count). All other keys are plain booleans. Player records carry an optional `label` (default `""`); **faction records have no `label`** — the schema must allow it absent.

**Validation** (reject the whole request `400` on structural failure; silently drop individual malformed targets):
- `players` / `factions` each default to `[]` if absent; each must be an Array.
- Each `id` coerced to a positive integer; drop the entry otherwise.
- `alerts` must be a plain object; unknown keys dropped, missing keys left absent (engine treats absent as off). Boolean keys coerced to `true`/`false`; threshold keys accept `false` or a finite number `>= 0`, else `false`.
- All id comparisons use `String(...)` (playerId/factionId are Strings throughout — `auth.js:103/105`).
- Per-owner cap (proposed **100 players + 100 factions**, drop overflow) to bound poll fan-out.

`syncOwner` / `replaceOwnerWatchlist(ownerId, players, factions)` is a **full replace** of that owner's membership (the script is the source of truth), but it **preserves server-side edge-state** (`info`, `seeded`, `lastFiredAt`) for targets that survive the sync, so a routine heartbeat doesn't reset baselines and re-fire. It removes the owner from `subscribers` maps it no longer appears in and **garbage-collects target rows whose `subscribers` map is now empty** — an unwatched target is never polled (the cost guarantee).

> **Server owns `info`.** The script's per-target `info` is stale client cache; the sync body strips it. The server's own per-target snapshot is the only prior-state of record for edge detection.

**Where the script gets the JWT (resolved):** the standalone Stakeout userscript today holds only a Torn key (`stakeout_settings.apiKey`) and has no warboard JWT. The script must perform the `POST /api/auth` handshake with the user's Torn key to obtain a JWT. This is **required regardless**, because `/api/auth` also runs `store.storeApiKey(playerId, key)` (`routes.js:1283`), which is what gives the poller the caller's own key to poll with (per the locked "poller key = caller's own stored Torn key" decision). The sync POST then carries `Authorization: Bearer <jwt>`.

### 2. Storage shape — `data/stakeout-watchers.json`

New file written by a new `stakeout-watcher.js` module, owned by the `warboard` user. Use the `__dirname`-relative form `process.env.DATA_DIR || join(__dirname, 'data')` (robust against cwd, matching `xanax-subscriptions.js:29` — deliberately not `price-watcher.js`'s cwd-relative `./data`).

**One target row per Torn id, many subscribers** (combines the xanax subscriber-map with price-watcher per-entry edge-state). This is the chosen encoding — it co-locates membership and edge-state in one row keyed by target, which is exactly what the watcher reads each cycle, rather than the data-model draft's parallel `owners` + `playerState`/`factionState` maps. (Same information, fewer joins.)

```json
{
  "players": {
    "2194491": {
      "subscribers": {
        "137558": {
          "alerts": { "okay": false, "hospital": true, "landing": true,
                      "online": true, "life": false, "offline": false, "revivable": false },
          "label": "",
          "lastFiredAt": { "online": 0, "hospital": 0, "landing": 0, "revivable": 0 }
        }
      },
      "info": null,
      "seeded": false
    }
  },
  "factions": {
    "16335": {
      "subscribers": {
        "137558": {
          "alerts": { "chainReaches": false, "memberCountDrops": false,
                      "rankedWarStarts": true, "inRaid": false, "inTerritoryWar": false },
          "lastFiredAt": { "rankedWarStarts": 0 }
        }
      },
      "info": null,
      "seeded": false
    }
  }
}
```

- **`info`** = the prior `mapPlayerResponse` / `mapFactionResponse` snapshot fed to the engine as `old` next cycle (same field/role as the script's `record.info`). `null` = not yet observed.
- **`seeded`** = first-observation guard (price-watcher seeds `lastState`; oc-notifier uses `__seeded`/`wasEmpty`). First poll after a target appears: map the snapshot into `info`, set `seeded=true`, **do not fire** — survives a restart so we never replay backlog. The engine already returns `[]` for `old=null`; the explicit flag makes cold-boot behavior obvious and durable.
- **`subscribers`** is keyed by owner playerId (String). A target watched by N owners is fetched **once**, edge-detected once against the shared `info`, and fanned out per subscriber.
- **`lastFiredAt`** is per-subscriber **per-trigger-key** (chosen over the data-model draft's single per-target `cooldownMs`), so a cooldown on `online` doesn't suppress a `hospital` alert for the same target/subscriber.
- **Faction subscriber entries carry no `label`** (only player records do — `torn-stakeout.user.js:367` vs `:372`).

**Persistence:** `load()` reads with `|| {}` fallbacks per top-level key (forward-compatible like `xanax-subscriptions.js:53-55`); `_save()` does `mkdirSync(dir,{recursive:true})` then `writeFileSync(FILE, JSON.stringify(state, null, 2))`. Debounce writes ~1000ms (`price-watcher.js:61-64`) and **flush synchronously on shutdown** so the `info`/`seeded` baseline survives an immediate restart.

### 3. Watcher module — `stakeout-watcher.js`

The server-side detector. New file `/opt/warboard/server/stakeout-watcher.js`. No existing stakeout server module exists.

**Engine reuse (server == script).** The watcher must **not** reimplement trigger logic. It loads the exact functions the userscript exports via the CommonJS guard at `torn-stakeout.user.js:93-96` (`module.exports = {...}; return;`). The `return;` short-circuits the IIFE before any GM/DOM code runs:

```js
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const engine = require('./public/scripts/torn-stakeout.user.js');
// engine.evaluatePlayer(old, snap, alerts, nowMs) -> string[]
// engine.evaluateFaction(old, snap, alerts)       -> string[]   (3 args, NO nowMs)
// engine.mapPlayerResponse(j) / engine.mapFactionResponse(j)
```

Consequences the watcher honors (all from engine facts):
- **Player:** `evaluatePlayer(old, snap, alerts, Date.now())` against `GET /v2/user/<id>?selections=profile`, mapped via `mapPlayerResponse`.
- **Faction:** `evaluateFaction(old, snap, alerts)` — **3 args, no `nowMs`** — against `GET /v2/faction/<id>?selections=basic,chain,wars`, mapped via `mapFactionResponse`.
- Default attack-window set = engine's player keys `landing`, `okay`, `hospital`, `online`, `revivable` (plus optional `life`/`offline` thresholds).
- **Edge semantics live in the engine:** `old=null` returns `[]` (seed only). The server must persist the prior snapshot (`info`) between polls and feed it as `old`, or it never fires (always-null `old`) or spams (every poll treated as a fresh transition).
- **Tri-state thresholds** survive untouched (same code): `chainReaches===0` is the "active chain dropped" mode, not "disabled".

A **startup self-check** (mirroring `xanax-subscriptions.js parserSelfTest()`) runs a known old/snap pair through `evaluatePlayer`/`evaluateFaction` in `load()` and warns if the required keys aren't exported — a cheap guard against the script being edited in a way that breaks the CommonJS export.

**Which key it polls with.** Each target is polled with the **watch-list owner's own stored Torn key**, never the faction war pool:

```js
import * as store from './store.js';
const key = store.getApiKeyForPlayer(String(ownerPlayerId)); // already DECRYPTED in-memory; do NOT decrypt again
if (!key) continue; // owner never authenticated — skip this cycle, do not crash
```

Rationale (per auth-key findings): this is a **personal** poller. `store.getPollingKey()` draws from the shared faction war pool, burns war budget, logs noise into `key-usage-log.js`, and risks auto-quarantine (Torn code 7) on a teammate's key for a non-faction reason; it would also need a new `PURPOSE_REQUIRED_SELECTION` entry (`store.js:761`) that `/user`+`/faction` selections don't have. Auth header is the v2 style the script already uses: `Authorization: ApiKey <key>` (not legacy `&key=`). Tag every call `&comment=wb-stakeout` and instrument via `key-usage-log.logCall(...)`.

**Edge-detection + cooldown (copy price-watcher exactly).** Two non-negotiable correctness rules (`price-watcher.js:82-101`):

1. **Always update `info` every cycle** (fired or not) — the engine re-arms off the prior snapshot. Forgetting the re-arm write makes it fire once then go silent forever.
2. **Cooldown is checked at fire time**, in addition to the engine edge — `now - lastFiredAt[key] >= COOLDOWN_MS`. The engine guarantees fire-once-on-transition; the cooldown guards against status flapping on a boundary (online/idle wobble).

```js
const snap = engine.mapPlayerResponse(json);          // or mapFactionResponse
if (!target.seeded) { target.info = snap; target.seeded = true; _scheduleSave(); continue; }
const old = target.info;
const now = Date.now();
for (const [ownerId, sub] of Object.entries(target.subscribers)) {
  const fired = engine.evaluatePlayer(old, snap, sub.alerts, now); // faction: evaluateFaction(old, snap, sub.alerts)
  const deliver = fired.filter(k => now - (sub.lastFiredAt[k] || 0) >= COOLDOWN_MS);
  if (deliver.length) {
    notifyStakeoutAlert([ownerId], target, snap, deliver); // -> push.sendToPlayers
    for (const k of deliver) sub.lastFiredAt[k] = now;
  }
}
target.info = snap;          // ALWAYS — re-arm
_scheduleSave();
```

A failed/missing Torn read (non-200, error code, unparseable body) is **skipped without touching `info`** — the "no false alarm on a bad read" rule (`price-watcher.js`'s `if (!(price>0)) continue;`). `COOLDOWN_MS` is a module constant (proposed **30 min** — see Open Decisions).

**Scheduling — dedicated self-scheduled poller.** Use the oc-ready-notifier `setInterval` idiom, **not** the price-watcher `onItemValuesRefreshed` piggyback (that hook holds only one callback — `item-values.js:126-128`, last-wins — and `server.js:591` already uses it for price-watcher; re-registering would silently clobber it; the ~30s stakeout cadence is also unrelated to the 5-min item refresh).

```js
let _pollTimer = null;
export function startWatcher() {
  if (_pollTimer) return;                         // re-entry guard
  _pollTimer = setInterval(runPoll, POLL_INTERVAL_MS);
  runPoll();                                      // immediate first run
}
export function stopWatcher() {
  if (_pollTimer) { clearInterval(_pollTimer); _pollTimer = null; }
  flushSync();                                    // synchronous save on shutdown
}
```

Wire it in the **`server.js` boot block** next to `priceWatcher.load()` (`server.js:590-591`) — not at the bottom of `routes.js` — because the watcher reads its own state file and calls `store.getApiKeyForPlayer` directly (it is not dependency-injected like oc-ready-notifier). This copies the xanax start/stop pattern but **uncommented** (xanax's start at `server.js:621` is commented purely as a budget decision). Add `stakeoutWatcher.stopWatcher()` to the shutdown path. Gate the `startWatcher()` call behind an env flag (e.g. `STAKEOUT_WATCHER=1`, default **OFF**) so the sync endpoint + storage can ship and accumulate real watch lists with **zero API spend** until detection is deliberately switched on — same budget-driven pattern as the disabled xanax start.

**Idle short-circuit (cost control):** `runPoll` returns immediately when there are zero target rows. The interval keeps ticking but does no Torn I/O while the watch set is empty.

**Only poll actively-watched targets.** The poll set is exactly the keys of `state.players` and `state.factions` — rows exist only while ≥1 subscriber watches them, empty rows are GC'd on sync. No enumeration of all Torn players/factions, no speculative polling. One faction call (`basic,chain,wars`) covers all that faction's triggers; one player call (`profile`) covers all a player's. API cost is driven by the count of **distinct watched targets**, never by subscriber count or trigger count.

### 4. Delivery fan-out (APNs + FCM, reuse)

When the watcher fires, it hands subscriber playerIds to the **canonical orchestrator** — never the native sub-layer:

```js
import * as push from './push-notifications.js';
await push.sendToPlayers(subscriberIds, payload, 'stakeout_alert');
```

`push.sendToPlayers` (`push-notifications.js:347`) fans out to **both** Web Push and the native FCM/APNs layer in one call and enforces per-player preference gating — exactly what `vault-requests.js:253` and `oc-ready-notifier.js:276/359` already do.

> **Hard rule:** do NOT call `fcm-subscriptions.js:96 sendToPlayers` or `apns.js:289 sendAlert` directly from the watcher. There are two functions named `sendToPlayers`; the fcm one is the internal sub-step the orchestrator invokes via `fanoutFcm`. Calling it directly **skips Web Push entirely** (desktop/PWA users get nothing) **and skips preference gating**.

**playerId → device-token mapping is fully reused** — no new mapping code. The orchestrator resolves a playerId to all destinations across both transports: Web Push subs in `data/push-subscriptions.json`, native tokens via `fcm.listForPlayer(playerId)` in `data/fcm-subscriptions.json` (`{playerId, playerName, factionId, token, platform, appPackage, updatedAt}`; iOS matched by `platform === 'ios'`, everything else → Android/firebase). Token ownership was already verified server-side at subscribe time via `verifyTornApiKey` (`routes.js:10341/10370`), so the token tables are trustworthy. Subscriber playerIds come from authenticated sync context (`req.user.playerId`), never client input.

**Payload + the one notify helper (the only real new delivery code),** mirroring `notifyNewRequest` (`vault-requests.js:246`):

```js
export async function notifyStakeoutAlert(subscriberIds, target, snap, firedKeys) {
  if (!subscriberIds?.length) return;
  const firedKey = firedKeys[0];
  await push.sendToPlayers(subscriberIds, {
    title: 'Stakeout',
    body: `${target.name} ${humanTrigger(firedKey)}`,        // "is online", "left hospital", "landed", "is revivable"
    tag: `stakeout-${target.id}`,                            // Web Push OS-collapse: one banner per target
    threadId: 'stakeout',                                    // native iOS grouping -> aps['thread-id'] (NEW field)
    data: {
      type: 'stakeout_alert',                                // discriminator the SW reads on tap
      targetId: String(target.id),                           // PRIMITIVE — FCM coerces data values to String
      trigger: firedKey,
      url: `https://www.torn.com/profiles.php?XID=${target.id}`
    }
  }, 'stakeout_alert');
}
```

Notes (grounded):
- **Keep `data` values primitive** — the Android path stringifies `payload.data` and coerces each value to `String` (`fcm-subscriptions.js:167`); a nested object serializes as `'[object Object]'`.
- `payload.tag` collapses repeat Web Push banners per target; `payload.threadId` maps to `aps['thread-id']` (`apns.js:302`) for native iOS grouping. The existing helpers only set `tag`, so `threadId` is a **new** (trivial) addition that rides through the orchestrator untouched.
- `pushOptions` stays default — alert pushes use APNs' 300s retry window (`apns.js:318`), appropriate for time-critical attack-window alerts. Use `{ urgency:'low', TTL:n }` only for non-urgent triggers (e.g. `offline`/`life`).
- Deep-link default = target profile (`profiles.php?XID=`). The attack loader (`loader.php?sid=attack&user2ID=`) and the faction-watch URL (`factions.php?step=profile&ID=`) are Open Decisions.

**Preference gating — register the type.** Add to `NOTIFICATION_TYPES` (`push-notifications.js:38`) so the toggle is UI-visible (an unregistered type still sends — `isTypeEnabled ... ?? true` — but won't appear in the prefs UI):

```js
stakeout_alert: {
  label: 'Stakeout alerts',
  description: 'A watched player/faction hit a trigger (online, out of hospital, landed, revivable, …)',
  default: true
  // no `oc:true` — not an OC-Spawn PWA setting
},
```

**v1 uses a single `stakeout_alert` type**; the per-target alert toggles synced from the userscript do the granular filtering before delivery is ever called. Per-trigger push categories (`stakeout_online`, `stakeout_revivable`, …) are an Open Decision.

### 5. Web Push channel (desktop Chrome, tab-closed)

This is the only delivery channel new to *stakeout*, but **not new infrastructure** — a complete, live Web Push (VAPID) stack already exists and is delivered for free by the same `push.sendToPlayers(...)` call. Everything here is a reuse map.

**Why the SW must live on tornwar.com, not in the userscript.** A Push subscription is bound to a service-worker registration, and that registration is **origin-locked**: `navigator.serviceWorker.register('/sw.js')` only registers a same-origin worker. The Stakeout userscript runs inside `torn.com` pages, so any worker it registered would be a `torn.com` worker (which we don't control and can't serve) and could only push for `torn.com` tabs — never for `tornwar.com`. The userscript's sandboxed isolated world also can't mint a real `ServiceWorkerRegistration` for our origin. So the opt-in flow must be an actual page served from `tornwar.com` (`/notifications` or `index.html`), opened in the user's normal browser, where `navigator.serviceWorker`/`PushManager` operate against `tornwar.com` first-party. The userscript's only role in this feature is the watch-list sync POST.

**Reuse, do not rebuild:**
- **VAPID keypair** — already live in `/opt/warboard/server/.env` (`VAPID_PUBLIC_KEY/PRIVATE_KEY/SUBJECT`), applied at boot (`push-notifications.js:21-30`), served at `GET /api/push/vapid-key` (`routes.js:2795`). `web-push@3.6.7` already a dependency. **DO NOT regenerate** — browsers bind every existing subscription to the current `applicationServerKey`; rotating silently invalidates all live subscriptions.
- **Service worker** — `/opt/warboard/server/public/sw.js`, served same-origin at `https://tornwar.com/sw.js` via the existing static mount (`server.js:237`), root-scope, fires `push`/`notificationclick` even with no tab open. The default handler already shows `{title, body, icon, tag}` and opens `data.url` on tap. **Stakeout delta: none required** — set `data.url` and the existing handler does the right thing. A dedicated `data.type === 'stakeout_alert'` branch is only needed for custom action buttons.
- **Opt-in surface** — reuse the existing `/notifications` PWA page (`routes.js:2938`) or `index.html`. A user already subscribed for any other warboard feature is **already subscribed** and needs no new action; once subscribed, they receive all enabled types including the new stakeout type. No bespoke stakeout opt-in page required.
- **Subscription storage** — `data/push-subscriptions.json`, `Map<playerId, PushSubscription[]>`, write path `push.subscribe(playerId, sub)` (`push-notifications.js:165`), keyed by the same playerId the watcher resolves its audience to. Files owned by `warboard` `0600` — don't chown/chmod or write as root.
- **Server send** — the watcher never calls `web-push` directly; `sendToPlayer` internally does `webPush.sendNotification(...)` (`push-notifications.js:271`) and reaps `410`/`404` endpoints. The same call fans out to native — Web Push is covered automatically.

**The honest limit: Chrome must be running.** Desktop Web Push is not true always-on. The push arrives only while the Chrome process is alive (a background Chrome task counts; the tab may be fully closed). If Chrome is fully quit, the message is queued by the push service and delivered on next launch, subject to `TTL` (expired = dropped). Consequences to state in user-facing copy: tab-closed-but-browser-running → works; Chrome quit / machine asleep → late or dropped past `TTL`. For genuinely always-on coverage the user should rely on native iOS (APNs) / Android (FCM). The watcher fans out to all three, so a multi-transport user gets the most reliable reachable one. **Web Push is the desktop convenience tier, not the reliability tier.**

**Gate allowlist caveat (flag only, no action now).** The gate is currently bypassed (`WB_DISABLE_GATE === '1'`, temp since 2026-05-19), so `/sw.js`, `/notifications`, `/icon-*.png` are reachable. The allowlist (`routes.js:394-411`) does **not** exempt those static paths, and `gateMiddleware` runs before `express.static`. If the gate is ever re-enabled, add `/sw.js`, `/notifications`, `/notifications/manifest.json`, `/icon-*.png` to the allowlist or first-time desktop opt-in breaks.

## Data flow

1. **Edit** — user adds/removes a target or toggles an alert in the Stakeout userscript (works identically on PDA-iOS and desktop Chrome).
2. **Sync** — the script (with a new `@connect tornwar.com` and a `syncUp()` function) maps `getPlayers()`→`{id,label,alerts}` and `getFactions()`→`{id,alerts}`, **omitting each record's `info` and `stakeout_settings.apiKey`**, and POSTs to `https://tornwar.com/api/stakeout/sync` with `Authorization: Bearer <jwt>`. Triggers: **on-change** (debounced ~2s) for fast propagation, plus a slow **heartbeat** (proposed 10 min) so an unchanged client re-asserts membership and the server can expire stale owners. The per-poll `pollOnce` path is **not** used for sync (would burn the rate limit).
3. **Mirror** — the route validates, resolves `owner=String(req.user.playerId)`, and `replaceOwnerWatchlist` merges into `data/stakeout-watchers.json`: adds the owner to each target's `subscribers`, creates target rows lazily, preserves `info`/`seeded`/`lastFiredAt` for surviving targets, and GCs rows whose subscriber map emptied.
4. **Poll** — every ~30s `runPoll` iterates **only** the distinct target rows, fetching each once with the owner's own key (`store.getApiKeyForPlayer`). One `/user?selections=profile` per watched player, one `/faction?selections=basic,chain,wars` per watched faction.
5. **Edge-detect** — map the response, seed-and-skip on first observation (`!seeded`), else run `engine.evaluatePlayer/evaluateFaction(old=info, snap, sub.alerts[, now])` per subscriber, filter fired keys by the per-trigger cooldown, then **always** write `info = snap` to re-arm.
6. **Push** — for each subscriber with surviving fired keys, `notifyStakeoutAlert([ownerId], …)` → `push.sendToPlayers([ownerId], payload, 'stakeout_alert')` → fan-out to Web Push + APNs + FCM, gated by that player's `stakeout_alert` preference.
7. **Device** — banner arrives on the user's iOS app / Android app / desktop Chrome (tab closed), tapping opens `data.url`.

## Error handling

- **Owner never authenticated (null key):** `getApiKeyForPlayer` returns `null` for any owner who hasn't hit `/api/auth`. The poll loop **skips that owner this cycle** — never crashes, never tears down their subscription.
- **Torn API error / non-200 / unparseable body:** skip the target this cycle **without touching `info`** (no false alarm on a bad read; the re-arm write only happens on a successful poll).
- **Torn code 7 (key quarantine):** because we use the owner's **own** key (not the pool), a bad key affects only that owner's targets; there is no pool quarantine cascade. Log and skip.
- **Dead device tokens (self-reaping, inherited for free via `sendToPlayers`):** Web Push endpoints removed on `410`/`404` (`push-notifications.js:274`); iOS APNs token removed on `BadDeviceToken`/`Unregistered` (`fcm-subscriptions.js:140`); Android FCM removed on `registration-token-not-registered`/`invalid-registration-token` (`fcm-subscriptions.js:178`). `apns.js` `not-configured` is silently ignored (env not set up — not a dead token).
- **Web Push 410-Gone:** reaped by the existing send path; no watcher action needed. A user whose desktop subscription expired simply stops getting Web Push (still gets native if subscribed there).
- **Transport not provisioned:** APNs requires 5 `APNS_*` env vars + readable `.p8` or `sendAlert` returns `{ok:false, reason:'not-configured'}` (silently ignored). Android FCM is a logged dry-run no-op until `data/firebase-service-account.json` exists. Enabling the watcher lights up desktop Web Push + iOS-if-configured without breaking when Android isn't provisioned.
- **Bounded state:** all dedup/edge-state is per-target/per-subscriber, GC'd when subscribers drop — no unbounded array that would eventually re-fire old events (the 5000-cap class of bug in oc-notifier/xanax is structurally avoided here).
- **Stale watch lists:** an owner who stops syncing keeps their target rows alive (and polled). Mitigation is an Open Decision (TTL on `updatedAt` vs prune-on-zero-subscriptions).

## Testing strategy

The detection engine is already pure and already has a passing suite (`/opt/warboard/test/stakeout.test.mjs`, 18 cases, vm-loaded). The highest-value tests are **parity** (server consumes the same module the script does) plus thin units around the new seams. Server unit tests are flat `/opt/warboard/server/*.test.js` files using `node:test` + `node:assert/strict`, run via `node --test`. Every test that touches persistence points `DATA_DIR` at a `mkdtemp` temp dir; no test requires live VAPID, a real `.p8`, or `firebase-service-account.json` — all transports stubbed.

1. **`stakeout-engine-parity.test.js`** — load the engine the way the server will (`require('./public/scripts/torn-stakeout.user.js')`), assert the same five exports, and that for identical `(old, snap, alerts, nowMs)` fixtures (reused verbatim from `test/stakeout.test.mjs`) `evaluatePlayer`/`evaluateFaction` return the same fired-key arrays — script and server can never drift. Pin the gotchas: `chainReaches===0` = "active chain dropped" mode, `evaluateFaction` 3-arg arity, and `old===null` returns `[]` (the single most important property for no cold-boot spam).
2. **`stakeout-watcher.test.js`** — drive the edge-detect/cooldown bookkeeping over a snapshot sequence: fires once on off→on, does **not** re-fire while still on, **re-arms** after drop+recross (verify `info=snap` is written every cycle), and respects the per-subscriber per-trigger cooldown. Inject a fake `send` (do **not** import the real `push-notifications.js`) and assert which playerIds + which payload. Add an explicit assertion that a poll cycle issues **at most one Torn call per distinct watched target**, not one per subscriber.
3. **`stakeout-sync.test.js`** — unit-test a pure `validateStakeoutSync(body)` helper extracted from the route: rejects oversized/over-cap payloads, accepts the real record shapes (player has `label`, faction does **not**), strips `info`, normalizes tri-state alerts, and never trusts a client-sent owner id (ownership = `req.user.playerId`). A thin route test asserts `401` without a Bearer token and that the persisted subscription is keyed by `req.user.playerId` — using a hand-built `{req,res}` stub on the extracted handler (no new `supertest` dependency).
4. **`stakeout-payload.test.js`** — test the pure payload builder: shape `{title, body, data:{type:'stakeout_alert', targetId, trigger, url}, tag, threadId}`; `data.type` is the **registered** type; `data.url` is a real Torn deep link; `tag`/`threadId` set for collapse/grouping; **`data` values stay primitive** (Android coerces to String).
5. **`stakeout-delivery.test.js`** — mock the transport, assert wiring not the library: the watcher calls `push.sendToPlayers(playerIds, payload, 'stakeout_alert', pushOptions?)` and **never** calls `fcm.sendToPlayers`/`apns.sendAlert` directly. Round-trip a sample `PushSubscription.toJSON()` through `push.subscribe(playerId, sub)` against a temp `DATA_DIR` and assert reachability + endpoint dedup. Preference-gating unit: with the type registered and the player opted out, `isTypeEnabled(playerId, 'stakeout_alert')` is `false` and the watcher suppresses that player.

Widen the `package.json` `test` script from `node --test key-encryption.test.js` to `node --test` (or append the new files) so CI runs them — note this also starts running the other existing `*.test.js` files (needs sign-off, see Open Decisions).

## API cost analysis

Let **N** = distinct watched players, **M** = distinct watched factions (union across all subscribers — duplicates collapse to one row), **P** = poll interval in seconds.

Each cycle issues **exactly N + M** Torn v2 calls (one `/user?selections=profile` per watched player, one `/faction?selections=basic,chain,wars` per watched faction). Triggers and subscriber count add **zero** extra calls.

```
calls/min = (N + M) * (60 / P)
```

At the proposed P=30s: `calls/min = 2·(N+M)`, `calls/hour = 120·(N+M)`, `calls/day = 2880·(N+M)`.

| N+M watched targets | calls/min (30s) | calls/hour | calls/day |
|---|---|---|---|
| 5 | 10 | 600 | 14,400 |
| 10 | 20 | 1,200 | 28,800 |
| 25 | 50 | 3,000 | 72,000 |
| 50 | 100 | 6,000 | 144,000 |

**The per-owner key budget is the real ceiling.** Calls are charged against each subscriber's **own** Torn key (100 calls/min/key, shared with that user's normal browsing — OC spawn, link-formatter, etc.). What matters per key is `t_owner` (that owner's target count): `2·t_owner` calls/min at 30s. So an owner watching 25 targets spends 50/min of their own 100/min — fine; an owner watching 50+ at 30s contends with their own page activity. Mitigations: the idle short-circuit makes an empty watch set cost **0**; a per-owner target cap and/or back-off to 60s for large `t_owner` are proposed (Open Decisions). Cost scales strictly with distinct watched targets, never with subscriber or trigger count.

## Out of scope / YAGNI

- **No new Web Push infrastructure** — VAPID keys, service worker, opt-in pages, subscription storage, and the `web-push` send path all already exist and are reused as-is. No keypair rotation.
- **No new device-token mapping or dead-token reaping** — inherited from `sendToPlayers`.
- **No pool-key routing** for stakeout polling — personal key only; pool routing (and its `PURPOSE_REQUIRED_SELECTION` entry) is explicitly not built.
- **No in-page/server dedup in v1** — accept the overlap. When the app/tab is open the in-page userscript may also alert via `GM_notification`, so an active user could get both an in-page toast and a server push for the same edge. v1 **accepts this** (it matches the existing PWA+native dual-banner behavior; server-side edge-triggering still guarantees one push per edge, and `tag`/`threadId` collapse repeats within a transport). The optional heartbeat-suppression filter (drop a subscriber whose `lastActiveAt` is within ~90s) is **deferred past v1**.
- **No per-trigger push categories in v1** — single `stakeout_alert` type; per-target toggles do the filtering.
- **No automatic enumeration / speculative polling** — only actively-watched targets, ever.
- **No `supertest` dependency** — route tests use a hand-built `{req,res}` stub on the extracted handler.
- **No splitting the engine into a shared `.mjs`** in v1 — `require()` the `.user.js` directly (the CommonJS guard short-circuits before any browser global); the startup self-check is the safety net. A hard split would be more robust if later desired.

## Decisions (RESOLVED 2026-06-18)

RussianRob approved all proposed defaults. The four headline decisions are explicitly confirmed:
- **Scope = owner-only first**, behind the `STAKEOUT_WATCHER` env flag (faction 42055 reference impl), then widen.
- **Poll cadence = 30s** while ≥1 active watch (optional auto-backoff to 60s at 50+ targets).
- **Watch-list home = the Stakeout userscript**, syncing its full per-owner list up to the server.
- **Double-alert when app open = allowed in v1** (`tag`/`threadId` collapse repeats; suppression deferred).

All remaining items below are accepted on their **proposed defaults** unless revisited during implementation.

- **Watch-list source of truth:** *script-synced* (the Stakeout userscript stays the editor and POSTs its full per-owner list; server mirrors + watches) vs *app-managed* (edit in the warboard app). Proposed: script-synced, because it works identically from PDA-iOS and desktop Chrome and reuses the existing per-target alert config. `replaceOwnerWatchlist` is built for whole-list replacement; if sync becomes incremental, the mutators change.
- **Poller key:** the caller's **own stored Torn key** (`store.getApiKeyForPlayer`) vs the faction war pool (`store.getPollingKey`). Proposed: own key (personal poller; avoids burning war budget / quarantine cascade). Requires the script to do the `/api/auth` handshake so a key is stored.
- **Poll cadence default:** **~30s** while ≥1 active watch exists (aligned to Torn's ~30s API cache). Also undecided: a back-off to 60s when an owner's `t_owner` is large, and a per-owner target cap (proposed 100 players + 100 factions).
- **Dedup behavior when the app is open:** *allow the double-alert* (in-page toast + server push) vs *suppress* via a client-activity heartbeat. Proposed: allow it in v1 (matches existing dual-transport behavior; heartbeat suppression deferred).
- **Web-push opt-in UX:** reuse the existing `/notifications` page (any already-subscribed user needs no new action) vs a bespoke stakeout-branded opt-in surface (a copy-only clone of `routes.js:2938`). Proposed: reuse `/notifications`.
- **Scope — owner-only vs all faction members:** proposed **owner-only behind the env flag first** (faction 42055 reference impl) to prove cost and correctness, then widen. The storage shape is already multi-subscriber-per-target, so widening is config, not a rewrite.
- **Notification-type granularity:** single `stakeout_alert` type (per-target toggles filter) vs per-trigger types (`stakeout_online`, `stakeout_hospital`, `stakeout_landing`, `stakeout_revivable`, …) each individually opt-outable in the prefs UI. Proposed: single type in v1.
- **Native iOS grouping granularity:** one `threadId: 'stakeout'` for all stakeout alerts vs per-target (`stakeout-<id>`, matching the Web Push `tag`). Proposed: one thread.
- **Deep-link target:** target profile (`profiles.php?XID=`) vs the attack loader (`loader.php?sid=attack&user2ID=`) for attack-window triggers; and the faction-watch URL (proposed `factions.php?step=profile&ID=<id>`) for chain/war/raid alerts.
- **Cooldown:** `COOLDOWN_MS` default (proposed **30 min**) and whether it stays a module constant or becomes per-subscriber configurable from the script's alert object.
- **Sync timing constants:** heartbeat interval (proposed 10 min) and on-change debounce (proposed 2s); sync body limit (proposed 16kb vs the auth-section's 4kb).
- **Stale-owner / watch-list expiry policy:** TTL on `updatedAt` (expire after N missed heartbeats / N days, then GC now-unwatched targets) vs prune-a-user's-targets once they have zero live push subscriptions. Undecided; interacts with cost (a lapsed owner keeps targets polled).
- **`body` copy per trigger:** exact human-readable strings ("is online", "left hospital", "landed", "is revivable", "chain dropped", "ranked war started") need a wording pass.
- **CI test-script widening:** changing `package.json` `test` from `node --test key-encryption.test.js` to `node --test` also starts running the other existing `*.test.js` files — needs sign-off.
