# Foreign Stocks — In-Flight & Abroad Destination Panel

**Date:** 2026-06-10
**Status:** Approved design
**Builds on:** `torn-foreign-stock.user.js` 0.8.0 (land-time verdict + sell-rate model).

## Summary

While you're **traveling** or **abroad**, Torn replaces the destination list with a
flight-status / foreign-shop view, so the script's per-destination panels vanish — you
can't watch the stock of the place you're flying to. Add a dedicated panel that, when
you're flying to (or standing in) a foreign country, shows **that one country's** live
stock + the land-time verdict + a **live arrival countdown**.

Phase 1 (this spec) detects travel state via the user's **API key**. Phase 2 (keyless,
deferred) will read the flight-page DOM once an in-flight capture is available.

## Decisions (owner-approved)

1. **Key now, keyless later** — detect via the Torn API now; add a keyless DOM path
   after an in-flight capture lands.
2. **In-flight + abroad** — show during the flight (with countdown) and while abroad.

## Detection (phase 1 — API key)

Reuse the script's existing **optional API key** (the one profit mode already uses).
Call **v1** `user?selections=travel,basic` — confirmed live to return, in one call:

```
status: { state: "Traveling", description: "Traveling from Switzerland to Torn", ... }
travel: { destination: "Torn", method: "Airstrip", timestamp: <arrival unix>,
          departed: <unix>, time_left: <seconds> }
```

(v2 `user?selections=travel` returns `{destination, method, departed_at, arrival_at,
time_left}` but does **not** combine cleanly with `status`, so v1 is used here.)
`travel.destination` is **where you are heading**.

**Pure `parseTravelState(api)`** → `{ mode, code, countryName, arrivalSec, timeLeftSec } | null`:
- `status.state === "Traveling"`:
  - `code = normalizeCountryName(travel.destination)`. If `code` (a foreign country) →
    `{ mode:"flight", code, countryName: travel.destination, arrivalSec: travel.timestamp, timeLeftSec: travel.time_left }`.
  - If `travel.destination === "Torn"` (returning home) → `null` (no foreign stock).
- `status.state === "Abroad"`: country = `status.description` match `/^In (.+)$/` →
  `normalizeCountryName`; fallback `normalizeCountryName(travel.destination)`. If `code`
  → `{ mode:"abroad", code, countryName, arrivalSec:null, timeLeftSec:null }`, else `null`.
- anything else (Okay / Hospital / Jail …) → `null`.

**`getTravelState()`** (data layer): returns `parseTravelState(api)` or `null`. Returns
`null` (quietly) when no key is set or on API error/rate-limit. Cached ~30s
(`TRAVEL_TTL = 30`). **Only fetches when the destination list is ABSENT** — if
`span[class*="country___"]` / `[class*="destinationList___"]` is present you're in Torn
picking a destination, so skip the API call entirely (no extra load when not traveling).

## Panel render

When `getTravelState()` is non-null, render a `#tfs-travel` panel injected as the first
child of `[class*="content-wrapper"]` (fallback `#mainContainer` → `body`); mobile-first,
matching the existing `.tfs-panel` styling. Reuses the already-loaded stock (keyless) +
model + prices.

**Header:**
- flight → flag + `countryName` + **live "Landing in mm:ss"** (from `timeLeftSec`).
- abroad → flag + `You're in {countryName}`.

**Rows** (that country's items, reusing the existing single-country row rendering):
- flight → each in-stock item shows the **land-time verdict** with
  `flightMinutes = timeLeftSec / 60` (so it sharpens as you approach); OOS items show the
  restock estimate (`restockDisplay`).
- abroad → stock + restock estimates only (no land-time verdict — you're already there).

**Live countdown:** a 1s ticker updates the "Landing in mm:ss" text; verdicts recompute on
each stock refresh (60s) and when the whole-minute value changes (reuse the FFS
change-detect countdown style — recompute `timeLeftSec = arrivalSec - now`). Per
`pda-webview-hidden-lies`, do **not** gate the ticker on `document.hidden` when `IS_PDA`.

## Integration

`applyAll()`: in addition to the existing `isMapLayout() ? paintTable : paintPanels`
branch, call the travel path — if `getTravelState()` returns non-null, render `#tfs-travel`
(additive: during a flight the destination list is absent, so `paintPanels` finds nothing
and renders nothing anyway). The travel-state poll piggybacks on the existing refresh loop;
while a **flight** panel is shown, a 1s `setInterval` ticks the countdown (cleared when the
panel is removed / state changes).

## Pure logic to unit-test

`parseTravelState`: traveling-to-foreign (→ flight + fields), traveling-home
(`destination:"Torn"` → null), abroad (`"In Mexico"` → abroad/mex), abroad-fallback
(no `In` match, `travel.destination:"Japan"` → abroad/jap), state Okay (→ null),
missing `status` (→ null), unknown country (`"Narnia"` → null). `landVerdict` is already
tested (0.8.0); reused with `flightMinutes` derived from `timeLeftSec`.

## Edge cases

- No key set → `getTravelState` null → no panel (phase 2 keyless will cover this).
- Returning to Torn → null (no foreign stock).
- API error / rate-limit → return null (or last cached), respect `TRAVEL_TTL`, never spam.
- `timeLeftSec` hits 0 (landed) → next poll flips `flight` → `abroad`.
- Abroad `description` not `"In X"` → fallback to `travel.destination`; still none → null.
- Destination has no stock data yet → panel shows "no stock data" rather than empty.
- `IS_PDA` → no `document.hidden` gating (PDA lies).
- Destination list reappears (back in Torn) → remove `#tfs-travel`, clear the ticker.

## Scope / versioning

- Mobile-first; travel page (`page.php?sid=travel`); `@connect api.torn.com` already present.
- **Out of scope:** keyless DOM detection (phase 2, awaiting capture); desktop.
- Version `0.8.0 → 0.9.0`; GF 581933; GPL-3.0-or-later; no comments/changelog/@copyright;
  deploy from `server/public/scripts`; surface the served URL after the bump.
