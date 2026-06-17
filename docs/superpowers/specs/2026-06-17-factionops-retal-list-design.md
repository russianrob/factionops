# FactionOps Retal List — Design Spec

**Date:** 2026-06-17
**Status:** Approved design — pending implementation plan
**Author:** RussianRob (with Claude)

## Goal

Add an iOS-style **incoming retal list** to the FactionOps userscript: a live list of
recent enemy attacks on our faction, each with a 5-minute retal-bonus countdown and a
one-tap **Attack** button. Server-mediated via warboard pool keys, so it works on PDA and
for users whose own API key lacks faction-AA access.

## Background

"Retal" already means three different things in these codebases; only #1 is being built:

1. **iOS Retaliation tab** (`warboard-ios/.../WarRoomView.swift`) — the feature to port. A live
   list of recent enemy attacks on the faction with a 5-min countdown and Attack button. Fetches
   `/v2/faction/attacks` **client-direct**, filters to `attacker.faction.id === enemyFactionId`
   and `ended` within the window.
2. **FactionOps' existing "⚠ Retal" request button** (`factionops.user.js` `tryInjectRetalCard`,
   `createAssistButton`) — a manual "ask my faction to hit this target" broadcast to
   `POST /api/assist-request` (`mode:'retal'`). **Unchanged by this work** — the new list is additive.
3. A war-payout **category** (`war-payouts.js` `classify()`), based on Torn's respect
   `modifiers.retaliation`. Unrelated.

FactionOps is **server-mediated** (it sends the user's key to the warboard server, which makes the
Torn calls via pooled keys). The server already fetches our faction's attack log every ~10s in the
`attacks-feed` watcher (`war-status-monitor.js`) using attacks-capable pool keys — the same data the
iOS feature consumes.

## Decisions (locked with user)

| Decision | Choice |
|---|---|
| Scope | iOS-style incoming-attacks list (the existing manual Retal button is untouched) |
| Data source | Server-mediated via warboard pool keys |
| UI placement | Collapsible section inside the FactionOps war overlay |
| Show window | Live 5-minute windows only — rows auto-remove when the window expires |
| Alerts | List only — no toast/PDA notifications (incoming attacks are near-constant in war) |
| Fetch cadence | Viewing-gated (~20s) — only fetch while clients are active in the war room |

## Architecture

### Constants

| Name | Value | Meaning |
|---|---|---|
| `RETAL_WINDOW_SEC` | `300` | Torn's retal-bonus window (5 min); the `windowSec` arg to `computeIncomingRetals` and the client countdown base |
| `RETAL_POLL_MS` | `20000` | Server fetch cadence while a war has active viewers |
| `ACTIVE_MS` | `60000` | Max age of `lastClientPollAt` for a war to count as "being viewed" |
| `GRACE_SEC` | `120` | Extra look-back added to the fetch `fromTs` so an attack near the boundary isn't missed |

All time math is unix seconds except `lastClientPollAt`/`RETAL_POLL_MS`/`ACTIVE_MS` (ms).

### Server — `retal-tracker.js` (new module)

**Pure helper (unit-tested):**

```
computeIncomingRetals(attacks, enemyFactionId, nowSec, windowSec = 300, enemyStatuses = {}) -> RetalEntry[]
```

- `attacks`: raw v1 faction-attack objects as returned by `fetchRecentFactionAttacks(OUR factionId, ...)`
  (i.e. `Object.values(data.attacks)`).
- For each attack:
  - `attackerFid = String(atk.attacker_faction ?? atk.attacker_faction_id ?? "")` — skip if `!== String(enemyFactionId)` (not an enemy hit on us).
  - `attackerId = String(atk.attacker_id ?? "")` — skip if empty (stealthed; can't target).
  - `endedTs = atk.timestamp_ended || atk.timestamp_started || 0` — skip if `endedTs < nowSec - windowSec` (window expired).
  - Map → `{ attackId, attackerId: Number, attackerName: atk.attacker_name, defenderId: Number(atk.defender_id), defenderName: atk.defender_name, result: atk.result, endedTs, attackerLevel }`
    where `attackId = atk.code || (attackerId + "-" + endedTs)` and
    `attackerLevel = (enemyStatuses[attackerId] && enemyStatuses[attackerId].level) ?? null`.
- Sort by `endedTs` descending. Return.

**Viewing-gated poller (self-managed, one timer per war):**

- Runs only while a war has **recent client activity** — `war.lastClientPollAt` within `ACTIVE_MS` (~60s),
  set by the `/api/poll` and `/api/stream` handlers. No active clients → poller idles (zero extra Torn calls).
- When active, every `RETAL_POLL_MS` (~20s): fetch
  `fetchRecentFactionAttacks(war.factionId, store.getPollingKey(war.factionId, "retals", cursor), fromTs)`
  with `fromTs = nowSec - (windowSec + GRACE_SEC)` to keep the payload tiny; set
  `war.incomingRetals = computeIncomingRetals(attacks, war.enemyFactionId, nowSec, RETAL_WINDOW_SEC, war.enemyStatuses)`.
- New pool-key purpose `"retals"` mapped to the `"attacks"` faction selection in
  `PURPOSE_REQUIRED_SELECTION` (`store.js`), so only attacks-capable keys are used (same pattern as
  `attacks-feed`/`enemy-attacks`/`chain`/`xanax-tracker`). If no capable key exists, the poller logs and
  skips (no crash), mirroring the existing watchers.
- On a change, emit on the socket and SSE so live clients update without waiting for their next poll.
- Immediate first fetch when viewing (re)starts, so the list is fresh on overlay open (not up to 20s stale).
- `war.incomingRetals` is **transient in-memory state** — not persisted to disk (rebuilds within one poll
  after a restart), so it adds no `store.saveState()` churn.

### Server — API surface (`routes.js`)

- Add `retals: war.incomingRetals || []` to the war-snapshot responses next to `enemyStatuses:` — the
  `/api/poll` builder (routes.js:1752), `/api/status` (:222), and the SSE/socket snapshot builders
  (:1440 / :1497 / :1588), since FactionOps reads from both polling and the realtime channel.
- In the `/api/poll` and `/api/stream` handlers, stamp `war.lastClientPollAt = Date.now()` (the
  viewing signal) and ensure the retal poller is running for that war.
- Push on change: emit a `retals` payload over Socket.IO (`io.to('war_'+warId)`) and `broadcastSSE`,
  alongside the existing `status_update` pattern.

### Client — `factionops.user.js`

- **State:** `applyServerData(data)` sets `state.retals = Array.isArray(data.retals) ? data.retals : (state.retals || [])`.
- **Realtime:** handle the `retals` socket event (and the SSE `war_state` path) → merge into `state.retals` → `renderRetalList()`.
- **Overlay section:** a collapsible `#fo-retal-section` (header `⚔ Retal (N)`) containing
  `<ul id="fo-retal-list">`, inserted next to `#fo-target-list` in the overlay skeleton (~:9202) and
  rendered by a new `renderRetalList()` called from `renderOverlay()` (~:9530, which already re-runs on
  every state change). Empty list → section shows "No incoming attacks" or hides.
- **Row** (per `RetalEntry`):
  - Name: `AttackerName [lvl]` (level omitted when `attackerLevel` is null) → link `profiles.php?XID={attackerId}`.
  - Subtitle: `→ {defenderName} · {result}`.
  - Countdown: `.fo-retal-cd` showing `m:ss` of `endedTs + RETAL_WINDOW_SEC - clientNowSec` (client-computed, so server/client clock skew is irrelevant); orange while > 0.
  - Red **Attack** anchor → `page.php?sid=attack&user2ID={attackerId}`. It is a link the user taps — no programmatic clicking of Torn UI.
- **Ticker:** a 1s interval updates every `.fo-retal-cd`; when a row's remaining `<= 0` it is removed
  (live-window-only). Reuse the existing FactionOps war-timer ticker if one is already running, else a
  dedicated `setInterval` scoped to the section.
- **CSS:** `.fo-retal-*` styles modeled on the existing `.fo-card-retal-*` / overlay-row styles.
- **Version:** bump the FactionOps `@version` and the in-file version constant together (from 5.1.30 to
  the next patch, after checking the live served version), and stamp it into a diag line for install
  confirmation.

## Data shape

`/api/poll` (and SSE/socket) addition:

```json
"retals": [
  {
    "attackId": "abc123",
    "attackerId": 2599508,
    "attackerName": "EnemyGuy",
    "attackerLevel": 75,
    "defenderId": 42,
    "defenderName": "OurGuy",
    "result": "Hospitalized",
    "endedTs": 1781700000
  }
]
```

## Edge cases

- **Stealth attacks** (no `attacker_id`) are skipped — there is no target to retaliate on.
- **Enemy change:** `store.getOrCreateWar` already wipes stale war state on a new enemy; `incomingRetals` resets with it.
- **No viewers:** poller idles, so the list can be stale until someone opens the overlay; it refreshes on the next view (immediate first fetch).
- **Clock skew:** the server sends `endedTs` (unix seconds); the client computes its own countdown.
- **Same enemy, multiple victims:** one row per attack (matches the iOS app).
- **No attacks-capable pool key:** routed out by `PURPOSE_REQUIRED_SELECTION`; poller logs and skips, no crash.
- **`attackId` fallback** `"{attackerId}-{endedTs}"` if the v1 `code` field is absent — used as the client row key / dedup.

## Testing

- **Server:** `retal-list.test.js` (`node --test`) for `computeIncomingRetals`:
  enemy-attack-in-window included; our-side attacker excluded; stealth (empty attacker) excluded;
  expired (older than window) excluded; sort newest-first; level enrichment from `enemyStatuses`;
  empty input → `[]`; `attackId` fallback when `code` missing.
- **Client:** on-device manual verification (userscript convention) — section renders, countdown ticks
  down, a row disappears at expiry, the Attack link targets the right `user2ID`. Version stamped into a
  diag line so the installed build is confirmable.

## Out of scope (YAGNI)

- Notifications / alerts (list-only was chosen).
- Greyed-out history rows (live-window-only was chosen).
- Client-direct `/v2/faction/attacks` fetch (server-mediated was chosen).
- Attacker level via extra per-attacker profile calls — use `enemyStatuses` if present, else omit.
- Any change to the existing manual "⚠ Retal" request button — this feature is additive.
- Android / warboard web-app parity — FactionOps only.

## File touch list

- **New** `server/retal-tracker.js` — pure `computeIncomingRetals` + the viewing-gated poller.
- **New** `server/retal-list.test.js` — unit tests for the pure helper.
- **Edit** `server/store.js` — add `"retals": "attacks"` to `PURPOSE_REQUIRED_SELECTION`; optional
  `war.lastClientPollAt` / `incomingRetals` helpers.
- **Edit** `server/routes.js` — add `retals` to the poll/status/stream snapshot builders; stamp
  `lastClientPollAt`; kick the retal poller; push on change.
- **Edit** `server/server.js` — wire poller startup/teardown into the war lifecycle (or keep fully
  self-managed inside `retal-tracker.js`).
- **Edit** `server/public/scripts/factionops.user.js` — `state.retals`, `applyServerData`, socket/SSE
  handling, `renderRetalList()`, overlay section, `.fo-retal-*` CSS, version bump (+ deploy copies under
  `client/` and `public/scripts/` per the existing deploy workflow).
