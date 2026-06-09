# Foreign-Stock Restock Tracker — Design

**Date:** 2026-06-09
**Status:** Approved design, pending implementation plan
**Author:** RussianRob (with Claude)
**Builds on:** `2026-06-09-foreign-stock-travel-page-design.md` (the `torn-foreign-stock.user.js` script, currently 0.2.2).

## Summary

A 24/7 server-side poller learns each foreign item's restock cadence by watching
Prombot's stock over time, and publishes a compact restock-model JSON to a public
GitHub repo. The **Torn Foreign Stocks** userscript reads that model (keyless) and
shows an always-on restock **estimate** — `~every 25m · ~8m (low)` — for
out-of-stock items where Prombot has no live `nextRestock`, matching TornPDA's
behaviour (including its honest "low reliability" caveat).

## Goals

- Show an estimated restock time for out-of-stock items even when Prombot has no
  live prediction (~34 items at any moment).
- Confidence (high/med/low) that improves as the tracker observes more restocks.
- Keep the shipped script **keyless and tornwar-free** — it reads the model from
  GitHub raw, never from the server.
- Centralise polling on the server (one shared poll) rather than per-user.

## Non-Goals (YAGNI)

- Replacing Prombot's live `nextRestock` (that stays the confident path).
- Serving live *stock* from the model (stock stays a live Prombot fetch in the script).
- A GitHub-Actions-only tracker (rejected: 5-min cron is too coarse for restock detection).
- Predicting restock *amounts* or price changes.

## Data Source

**Prombot** `https://api.prombot.co.uk/api/travel` — `{stocks:{<code>:{update, stocks:[{id,name,quantity,cost,nextRestock}]}}}`. Full 11-country coverage, ~live. Chosen over YATA because it also carries `nextRestock` (lets the model defer to Prombot's live prediction) and is what the script already uses. Foreign stock only *decreases* through player purchases, so **any quantity increase between polls is a restock event** — a clean signal.

## Architecture

Three units, each independently testable:

### 1. `server/restock-tracker.js` (poller + model builder)
- Polls Prombot every **60 s**.
- State (persisted to `server/data/restock-state.json`, gitignored): per `country+id`,
  `{ lastQty, lastSeen, restocks: [t, …] }` (rolling, cap ~24 recent restock timestamps).
- **Detection:** if `currentQty > lastQty` → push a restock timestamp (≈ poll time).
- **Estimation (pure, unit-tested):** from `restocks[]` derive
  `interval` = median of consecutive gaps, `last` = max(restocks), `n` = gaps count,
  `rel` = reliability tier (below).
- Wired into `server.js` via the existing `setInterval` / `start…()` pattern
  (`startRestockTracker()`), like `startRwpRefresh()`.

### 2. GitHub publish
- New **dedicated public repo** `russianrob/torn-foreign-restock` (created via `gh repo create`;
  separate from rwp-prices so two writers never collide).
- Every **10 min**, build the model and publish `restock-model.json` via
  `gh api --method PUT /repos/russianrob/torn-foreign-restock/contents/restock-model.json`
  (fetch current blob SHA first; base64 the content). No local clone.
- Only include items with `n ≥ 2` (enough to have an interval).
- Raw URL `https://raw.githubusercontent.com/russianrob/torn-foreign-restock/main/restock-model.json`
  (CORS `*`, ~5 min CDN cache).

### 3. Script (`torn-foreign-stock.user.js` → 0.3.0)
- Adds a second cached fetch — the model, **~10 min** cache — plus `@connect raw.githubusercontent.com`.
- For each out-of-stock item, the **merge priority** (first match wins):
  1. Prombot `nextRestock` in the **future** → `restocks in 8m` (live, confident).
  2. Else **model entry** for that `country+id` → `~every {interval} · ~{left} ({rel})`,
     where `left = (last + interval) − now`; if `left ≤ 0` → `~restock due ({rel})`.
  3. Else Prombot `nextRestock` recently past (≤ 1 h) → `restock due` (unchanged 0.2.2 behaviour).
  4. Else → `out of stock`.

## Reliability / Confidence Model

`rel` rises with **history** in two independent ways (both required for "high"):

- **Sample count `n`** (observed restocks): more observations → more trust.
- **Consistency** — coefficient of variation `CV = stdev(gaps) / mean(gaps)`: regular
  gaps → high confidence; erratic gaps stay "low" even at large `n` (honest).

Tiers (tunable constants): `high` if `n ≥ 8` and `CV < 0.3`; `med` if `n ≥ 4` and
`CV < 0.6`; else `low`. So a metronome-regular item climbs low → med → high over
~a day; a jumpy one stays "low".

## Model JSON Shape

```json
{
  "updated": 1781020000,
  "items": {
    "uae": { "384": { "interval": 1500, "last": 1781019000, "n": 12, "rel": "low" } },
    "mex": { "232": { "interval": 2400, "last": 1781018000, "n": 9,  "rel": "med" } }
  }
}
```
`interval` & `last` in unix seconds. Keyed by YATA/Prombot country code then item id.

### 4. Monitoring / server status link (for the user)

So the user can watch the tracker learn:
- **`GET https://tornwar.com/restock-model.json`** — the current model JSON, served from
  the server's local copy (identical to what's published to GitHub).
- **`GET https://tornwar.com/restock`** — a lightweight HTML status page rendering the
  model: per country, each tracked item with name, `~interval` (formatted), `last`
  restock (… ago), `n` samples, and `rel` tier, sorted by reliability/recency. Lets the
  user eyeball coverage and whether it's working at a glance.

This link is a server-only convenience for the user; the **shipped userscript still reads
the model from GitHub raw**, so the script stays tornwar-free.

## Data Flow

```
[server, 24/7]
  every 60s: fetch Prombot → per item: qty increased? → record restock ts → update state
             persist server/data/restock-state.json
  every 10min: build model (items with n≥2) → gh api PUT restock-model.json

[script, on page.php?sid=travel]
  fetch Prombot (live stock + nextRestock, cache 60s)        [existing 0.2.2]
  fetch GitHub restock-model.json (cache ~10min)             [new]
  per out-of-stock item: Prombot-future → live; else model → "~every X · ~Y (rel)"; else out of stock
```

## Failure Modes

- **Prombot poll fails:** skip the poll, keep prior state (a missed poll only widens
  the next detection window; no false restock recorded).
- **GitHub publish fails:** log + retry next cycle; stale model still usable.
- **Script model fetch fails / repo empty / model stale:** silently falls back to
  0.2.2 Prombot-only behaviour. The `last` timestamp ageing just makes `~left` rougher.
- **State file missing/corrupt:** start fresh; estimates rebuild over time.
- **Quantity-increase false positives** (data glitches, a deposit): rare; the median
  interval + reliability tier absorb the occasional bad sample.

## Warm-Up Caveat

The tracker only knows what it has observed. Each item needs ≥2 restocks before any
estimate and several before "med"/"high", so estimates appear gradually over the
first hours and confidence climbs over a day+. Unobserved items stay "out of stock".
This is inherent to learning from observation (and why PDA flags "low").

## Testing

- **Pure logic (Node `node --test`):** restock detection + interval/`rel` estimation
  from a synthetic `{qty,t}` sample sequence; reliability-tier boundaries; the script's
  merge/display (Prombot-live vs model vs none).
- **Operational:** verify the poller logs restock events, the published GitHub file
  updates, and the script renders estimates on the live travel page.

## Open Risks

- **Bootstrapping time** — feature is sparse until the tracker accrues history (mitigated:
  graceful fallback to Prombot/out-of-stock; confidence is shown honestly).
- **Commit volume** — ~144 commits/day to the data repo (acceptable for a data repo;
  history can be squashed periodically).
- **Prombot dependency** — single source for both the script's live data and the tracker;
  YATA remains the script's stock fallback, and the model degrades gracefully if Prombot lapses.
