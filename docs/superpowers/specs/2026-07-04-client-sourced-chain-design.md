# Client-Sourced Chain — Design

**Status:** Draft for review
**Date:** 2026-07-04
**Component:** factionops userscript (client) + warboard server (chain-monitor)

## Goal

Stop the server from polling Torn for chain data while faction members are on the war page. Instead, factionops pushes the chain it *already reads on that page* to the existing `/api/chain-update` endpoint; the server's existing freshness gate then skips its own Torn chain poll. This removes the single heaviest, most frequent draw on the shared pool keys during a war — the direct cause of the `Too many requests (code 5)` rate-limiting — with no loss of freshness or alerts.

## Background: most of this already exists (and worked)

- The server already exposes **`POST /api/chain-update`** (`routes.js`) → `recordClientChainData(warId, chain)` (`chain-monitor.js`), which runs the **same** `_processChain()` pipeline as the server poll (alerts, Live Activity, war-target eval — "source-agnostic").
- The chain poll **already skips its Torn fetch** when `Date.now() - war.chainDataUpdatedAt < CLIENT_CHAIN_FRESH_MS` (8 s), logging `[chain/skip]`.
- This **demonstrably ran** on 2026-06-27 (`[chain/client] war=war_42055 …` fills the log that day).
- **The real gap (corrected):** factionops 5.1.39 *does* contain the push (`postAction('/api/chain-update', …)` at line ~7135) — but it lives **only inside the API-poll fallback** (`pollChain` / `startDirectChainPoll`, `CHAIN_POLL_MS = 30000`), which is used **only when the DOM chain bar can't be observed**, and which first makes a **direct Torn API call on the user's own key** and bails before pushing if that call errors (`if (data.error) return` at 7108). The **primary path on the war page** is `parseChainFromDOM` (line 7318, every 2 s, reads the chain bar for the `.fo-chain-*` display) — and **it never pushes**. So while members are on the war page (DOM mode), the server receives no client chain → it polls the pool. And when the fallback *does* run, its Torn call fails whenever the user's key is maxed — a vicious cycle (the maxing it's meant to relieve prevents the push).
- The chain bar the DOM path already reads is **live and free** — pushing from there costs **zero Torn calls** and works even when the key is maxed.

So the fix is small and precise: **add a throttled push in `parseChainFromDOM`** (the DOM path), mirroring the existing `postAction('/api/chain-update', …)` body but sourced from the DOM-parsed `state.chain` instead of a Torn call.

## Design

### Client (factionops) — the change
While a member is on the war page (DOM chain mode), factionops:
- **Sources chain from the DOM path it already runs** — right after `parseChainFromDOM` (line 7318) reads the live chain bar into `state.chain` (`current` / `timeout` / `cooldown`), push that snapshot. **No Torn call** (so it works even when the user's key is maxed). `serverTimestamp` = the client's read time (`Math.floor(Date.now()/1000)`); the server's existing dedup only needs it to be monotonic-per-client to reject a lagging client overwriting fresher data.
- **POSTs to `/api/chain-update`** with `{ warId, chainData: { current, timeout, cooldown, serverTimestamp } }` — mirroring the body already at line ~7135 but sourced from `state.chain`, not a Torn response:
  - **immediately on any change** (count, timeout crossing a threshold, cooldown flip), and
  - on a **~5 s heartbeat** otherwise (comfortably under the server's 8 s skip window, so the skip stays armed).
- **All members on the war page push** (no elected reporter). The server dedups by `serverTimestamp` and only needs one fresh push per 8 s to skip — extra pushes are cheap (they hit our own server, not Torn) and give resilience when a member navigates away.

### Server — unchanged (verify only)
The endpoint, the `recordClientChainData` dedup (rejects a snapshot older than what we hold via `serverTimestamp`), and the 8 s skip gate already exist. The plan **verifies** the exact `chainData` field names the pipeline reads (`current`, `timeout`, `cooldown`, `serverTimestamp`) and that a 5 s client heartbeat reliably keeps `[chain/skip]` firing. No server redesign; at most a comment or a small widen of `CLIENT_CHAIN_FRESH_MS` if 5 s pushes prove too tight in practice.

## Data flow

`war page loads chain (Torn) → factionops reads it → POST /api/chain-update → recordClientChainData → _processChain (alerts/LA) + sets chainDataUpdatedAt → next server poll sees fresh data → [chain/skip], no Torn call`

When **no** member is on the war page (nobody pushing for > 8 s) → the server poll resumes automatically (unchanged fallback), so coverage never drops.

## Error handling / safety

- **Push fails** (network/PDA) → next heartbeat retries; if pushes stop for > 8 s the server poll takes over. No gap.
- **Stale client data** → `recordClientChainData` already rejects a snapshot with an older `serverTimestamp` than the server holds, so a lagging client can't overwrite fresher data.
- **Alerts are unaffected** — `_processChain` runs the panic/warning pipeline identically for client-sourced snapshots (it already did on 06-27). The 8 s skip is deliberately tight so a 30 s panic trigger can never fire late.
- **No behavior change when nobody's online** — the server poll is retained as the fallback, not removed.

## Non-goals

- Not removing the server chain poll — it stays as the no-members-online fallback.
- Not changing war-status/attacks-feed here (they already have a client-skip; leaning on it harder is a separate follow-up).
- Not the TornPDA transport fix (the SSE-can't-stream-on-PDA issue) — separate spec. (Though this client→server push path is the same shape a PDA data path would use.)

## Testing

- **Server:** unit/integration around `POST /api/chain-update` (accepts a valid `chainData`, rejects missing fields / wrong faction) and the skip gate (fresh client data → poll skipped). Reuse/extend existing chain-monitor tests if present.
- **factionops:** live verification (userscript) — deploy, and on the war page confirm the log shows `[chain/client]` + `[chain/skip]` rising and `[chain/poll]` (Torn fetches) dropping to ~zero while members are present; confirm a real chain warning/panic still fires; confirm the server poll resumes when everyone leaves the war page.

## Rollout

factionops version bump (`@version` + in-file `SCRIPT_VERSION` in sync) → deploy to `server/public/scripts/` → verify served version → watch pm2 logs for the `[chain/poll] → [chain/skip]/[chain/client]` shift and the code-5 rate-limit failures subsiding. Reversible: if anything regresses, the server poll is still there.
