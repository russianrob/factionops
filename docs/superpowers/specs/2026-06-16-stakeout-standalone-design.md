# Stakeout (standalone userscript) — Design

**Goal:** Port TornTools' Stakeout feature (player + faction monitoring with alerts) into a single standalone Tampermonkey/PDA userscript that needs no extension.

**Status:** Approved design (2026-06-16). Next: implementation plan.

## Identity & attribution

- File: `server/public/scripts/torn-stakeout.user.js` (served at tornwar.com, distributed via Greasy Fork).
- `@name Stakeout` · `@namespace RussianRob` · `@author RussianRob`.
- `@description` credits upstream: "... forked from TornTools".
- `@license GPL-3.0-or-later` — TornTools is GPL; a faithful port keeps the license. Retain an upstream-credit notice in the `==UserScript==` block.
- `@version` kept in sync with an in-file `SCRIPT_VERSION` constant.
- No descriptive `//` comments in the body (house rule); keep only the metadata block.

## Scope

Full TornTools parity: **both** player stakeouts and faction stakeouts.

## Architecture — five modules in one IIFE

1. **Store** — `GM_setValue`/`GM_getValue` (localStorage fallback). Persists:
   - `stakeouts`: `StakeoutData[]` (players)
   - `factionStakeouts`: `FactionStakeoutEntry[]`
   - `settings`: `{ apiKey, pollSeconds, sound, panelPos }`
   - `dedupe`: map of `${id}_${alert}` → true (notification de-dup state; faction keys prefixed `faction_`)
   CRUD helpers; small JSON.
2. **Alert engine** — pure functions, fully unit-tested:
   - `evaluatePlayer(oldInfo, newInfo, alerts)` → `string[]` of fired alert keys
   - `evaluateFaction(oldInfo, newInfo, alerts)` → `string[]`
   No DOM, no I/O — ported transition logic from TornTools `background/updates.ts`.
3. **Poller** — `setInterval(pollSeconds, default 30)`; for each enabled target, `GM_xmlhttpRequest` → Torn API v2; build a snapshot; diff against stored `info`; run the engine; persist the new snapshot.
4. **Notifier** — for each fired alert not already deduped: deliver (in-page toast + `GM_notification` when available + optional sound), set the dedupe key. Clear the dedupe key when the condition resets.
5. **UI** — floating panel + on-page quick-add toggle:
   - **Panel** (toggled by a `📍` button): consolidated list of all stakeouts with live status; per-row alert editor; add-by-ID (player or faction); settings (API key field, sound on/off, poll interval); shows approximate API call rate.
   - **On-page toggle**: a `📍 Stakeout this user/faction` control injected on profile and faction pages for one-tap add of the target being viewed.

## Alert semantics (faithful to TornTools)

**Player** (API v2 `user/<id>?selections=profile`): snapshot = `{ name, status.state, status.description, last_action.status, last_action.timestamp, life.current, life.maximum, revivable }`.

| Alert key | Type | Fires when |
|---|---|---|
| `okay` | bool | `status.state` transitions to `Okay` |
| `hospital` | bool | `status.state` transitions to `Hospital` (include description/reason) |
| `landing` | bool | `status.state` was `Traveling`, now is not |
| `online` | bool | `last_action.status` transitions to `Online` |
| `life` | number (%) | `life.current ≤ life.maximum × (life/100)` |
| `offline` | number (hours) | hours since `last_action.timestamp` ≥ threshold |
| `revivable` | bool | `revivable` transitions false → true |

**Faction** (API v2 `faction/<id>?selections=basic,chain,wars`): snapshot = `{ name, chain, respect, members.current, members.maximum, rankedWar, raid, territoryWar }`.

| Alert key | Type | Fires when |
|---|---|---|
| `chainReaches` | number \| false | chain ≥ N; **special: value `0` → fire when an active (≥10) chain *drops* to 0** |
| `memberCountDrops` | number \| false | current members < N |
| `rankedWarStarts` | bool | `wars.ranked` becomes non-null |
| `inRaid` | bool | `wars.raids.length > 0` |
| `inTerritoryWar` | bool | `wars.territory.length > 0` |

**De-dup rule:** a fired alert sets `dedupe[${id}_${alert}]`; the key is deleted once the condition is no longer true, so e.g. `online` fires once per online session, not every poll cycle.

## Data flow

```
every pollSeconds:
  for each enabled stakeout (players then factions, sequential):
    snapshot = fetch v2 (GM_xmlhttpRequest, Authorization: ApiKey <key>)
    fired    = engine(stored.info, snapshot, stored.alerts)
    for each fired alert not in dedupe: notify + set dedupe
    for each previously-deduped alert no longer true: clear dedupe
    stored.info = snapshot ; persist
    refresh panel row (and on-page readout if present)
```

## Data model (ported, trimmed)

```
StakeoutData = {
  id: number, order: number, label: string,
  info: { name, last_action:{status,timestamp,relative}, life:{current,maximum},
          status:{state,description,until,color}, isRevivable } | null,
  alerts: { okay:bool, hospital:bool, landing:bool, online:bool,
            life:number|false, offline:number|false, revivable:bool }
}
FactionStakeoutEntry = {
  id: number, order: number,
  info: { name, chain, respect, members:{current,maximum},
          rankedWar:bool, raid:bool, territoryWar:bool } | null,
  alerts: { chainReaches:number|false, memberCountDrops:number|false,
            rankedWarStarts:bool, inRaid:bool, inTerritoryWar:bool }
}
```

## Authentication

API key is entered **manually in the panel settings field** and persisted via the store. No PDA auto-key injection. `@connect api.torn.com`; all API calls go through `GM_xmlhttpRequest` (bypasses page CORS, works on PDA). If no key is set, the panel shows a "set your API key" prompt and the poller idles.

## Constraints (accepted)

- **Polls only while a Torn/PDA tab is open** — no background service worker. Acceptable: "monitor while I'm on Torn."
- **API budget** — one call per target per interval (v2 cannot multiplex IDs). Panel surfaces the approximate call rate so the user can tune the interval.

## Notifications

- In-page **toast** banner (always; works on PDA + desktop) — clickable → opens the target's profile/faction page.
- **`GM_notification`** when available (desktop OS notification, clickable).
- **Sound** (`new Audio`) — short ping, on/off toggle in settings.
- TTS is out of scope (YAGNI).

## Testing

- **TDD the alert engine** (`evaluatePlayer` / `evaluateFaction`) in a node test (`test/stakeout.test.mjs`): every player + faction condition, the transition semantics (fires on cross, not on steady-state), the `chainReaches === 0` chain-drop special case, the offline-hours and life-% thresholds, and de-dup set/clear behavior.
- Poller, notifier, and UI verified on-device.

## Out of scope

- Background/always-on polling (would require server-side warboard monitoring + push — separate project).
- Svelte management tables / extension popup dashboard (replaced by the floating panel).
- Badge/toolbar icon, offscreen audio, cross-context messaging (extension-shell concerns).
