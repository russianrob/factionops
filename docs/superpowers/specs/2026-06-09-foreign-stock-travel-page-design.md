# Foreign Stock on Travel Page — Design

**Date:** 2026-06-09
**Status:** Approved design, pending implementation plan
**Author:** RussianRob (with Claude)

## Summary

A new standalone Torn userscript that displays current foreign (abroad) item
stock on the Torn travel agency page (`page.php?sid=travel`), inline under each
destination — like TornTools' foreign-stock feature — so the user doesn't have
to leave Torn for TornPDA's separate stock tab.

It has a **user setting** to switch between two views:

- **Stock** (default, keyless): item name, quantity in stock, abroad buy price.
- **Stock + profit** (optional API key): the above plus the item's Torn market
  value and the **per-item** profit (`market_value − abroad cost`).

## Goals

- Show all in-stock items per country on the travel agency page, inline.
- Match TornTools' stock readout (item, quantity, abroad price) with no key.
- Offer an optional profit view that needs only a Torn API key the user pastes once.
- Work in both desktop Tampermonkey and the TornPDA WebView.
- The **shipped script is self-contained** — no runtime dependency on the tornwar
  server or any other backend.

## Non-Goals (YAGNI)

- Per-trip totals or travel-capacity math (luggage/perks).
- A keyless server/GitHub-hosted price feed (rejected in favour of optional key).
- Profit/stock while already abroad (the item market on the destination page).
- Any page other than the travel agency page.

## Data Sources

### YATA travel export (stock — keyless)

- **Endpoint:** `https://yata.yt/api/v1/travel/export/` (GET, no key, ~15 KB).
- **Verified shape (2026-06-09):**
  ```json
  {
    "stocks": {
      "mex": { "update": 1781009626, "stocks": [ { "id": 99, "name": "Springfield 1911", "quantity": 49, "cost": 430 }, ... ] },
      "cay": { ... }, ...
    }
  }
  ```
- `update` = unix seconds of the country's last crowd-sourced refresh; `cost` =
  abroad buy price; `quantity` = units in stock; `id` = Torn item id (the join key
  for profit, see below).
- Fetched via `GM_xmlhttpRequest` (cross-origin); `@connect yata.yt`.

### Torn item values (profit — optional key)

- **Endpoint:** `https://api.torn.com/v2/torn?selections=items&key=<KEY>` (v2, to
  match warboard precedent). Returns an `items` collection; each item's market
  value is read as **`item.value.market_price`**, with a defensive fallback chain
  `item.value?.market_price ?? item.market_value ?? item.marketValue` in case the
  field name differs. One call returns the whole catalogue.
- Used only in profit mode, only when a key is saved. **Join is by item id**
  (YATA `id` → Torn item id), never by name.
- Key stored locally in `GM` storage; only ever sent to the Torn API.

## Country Mapping

The on-page destination names must be normalised (trimmed, lower-cased) and looked
up in a hardcoded map to YATA's country codes. Covers all 11 plus common variants:

| YATA code | On-page name variants |
|-----------|-----------------------|
| `mex` | mexico |
| `cay` | cayman islands |
| `can` | canada |
| `haw` | hawaii |
| `uni` | united kingdom, uk |
| `arg` | argentina |
| `swi` | switzerland |
| `jap` | japan |
| `chi` | china |
| `uae` | uae, united arab emirates |
| `sou` | south africa |

A destination whose normalised name isn't in the map simply gets no panel (no error).

## Architecture / Components

Four small, independently testable units:

1. **`stockData`** — fetch + cache the YATA export. `getStock()` →
   `{ code: { update, items: [{id, name, qty, cost}] } }`. Cache TTL **300 s** in
   `GM` storage (balances YATA staleness vs request overhead); refresh on
   travel-page load when stale; serve stale cache on fetch failure. A manual
   **Refresh** control in the settings bar clears the cache and forces a fetch.
2. **`priceData`** — (profit only) fetch + cache the Torn item-value map for the
   saved key. `getValue(itemId)` → number | undefined. Cache TTL **21 600 s**
   (6 h; Torn values drift slowly). No-ops without a key.
3. **`settings`** — persisted view mode (`stock` default | `profit`) and API key,
   in `GM` storage. Renders a settings bar at the top of the destination list:
   a view toggle, a Refresh control, and — when `profit` is selected — an inline
   API-key field (the OC-Spawn inline-key pattern: input + save, validation
   rejects empty/whitespace). The bar is the **canonical** settings surface on
   both PDA and desktop; `GM_registerMenuCommand` is an optional desktop-only
   convenience, never required.
4. **`injector`** — for each destination, build + insert one stock panel; resolve
   the destination name → country code; render the rows.

### Injection lifecycle (no-loop contract)

- The **settings bar is injected exactly once**, guarded by a sentinel
  (`#tfs-bar` / a `data-tfs` attribute checked before every insert).
- A **MutationObserver scoped to the destination-list container** (not the whole
  page), **debounced 200 ms**, re-applies the per-destination stock panels after
  Torn re-renders. Each panel is likewise sentinel-guarded so re-runs are no-ops
  when nothing changed. The observer never touches the settings bar.

## Data Flow

```
travel page load
  → inject settings bar once (sentinel-guarded)
  → stockData.getStock()                         (YATA, cache 300s)
  → if mode == profit and key set: priceData.ensure()  (Torn v2 items, cache 6h)
  → for each on-page destination:
        normalise name → country code (skip if unmapped)
        rows = stock items for that code
        each row: name ×qty, abroad cost; profit mode also market_price & per-item profit
        sort (see below); insert panel with "updated Xm ago" header
  → MutationObserver (destination-list, 200ms debounce) re-applies panels
```

## Rendering & Sorting

- **Stock row:** `Xanax ×88   $830`.
- **Profit row:** `Xanax ×88   $830 → +$8,370 ea` — green if `market_price > cost`,
  dimmed otherwise. If the item id has **no Torn value** (lookup miss), the row
  still renders as a stock row with profit shown as `—` (never dropped).
- **Sort:** stock mode by abroad price desc; profit mode by **per-item profit**
  desc. Secondary sort (both modes): quantity desc, then name A→Z.
- **Toggling mode** re-renders the same single panel set with the active mode's
  sort — one render path, not two caches.
- **Per-country header:** `🇲🇽 Mexico — updated 2m ago`. Only the age-stamp text
  greys out when `update` is older than `STALE_MIN = 30` minutes (chosen to track
  YATA's crowd-sourced refresh cadence); the item rows stay full-opacity.
- All in-stock items shown in a per-country panel; the panel is scrollable if it's
  long (no truncation — matches the "show everything" choice). Mobile-first,
  Torn dark-theme styling.

## Failure Modes

- **YATA unreachable:** show a small "stock unavailable" note; keep cached data if any.
- **Profit mode, no key:** render the stock view + a one-time inline hint
  ("add a Torn API key for profit") in the settings bar.
- **Profit mode, invalid key:** Torn API returns an error → log full error to
  console, show a short "Invalid API key" / "API error" message in the settings
  bar, and fall back to stock rows. (Distinct from the no-key path above.)
- **Stale YATA data:** still rendered; greyed age stamp signals staleness.
- **Item in YATA export but not an on-page destination / not in Torn map:** silently
  skipped — only the intersection of YATA stock and on-page destinations renders.

## DOM Discovery (dev-only first step, NOT part of the shipped script)

The `page.php?sid=travel` DOM as rendered inside the **TornPDA WebView** is not yet
captured. Implementation step 1 is a **throwaway diagnostic userscript** (same
approach as the armoury diag) that captures each destination row's structure (the
anchor element, how the destination name is exposed) on the user's device. The
diag — and **only** the diag — uses the `tornwar.com/api/debug/client-log` channel
as a dev tool; it is deleted once the DOM is known. **The shipped script never
touches tornwar.** The injector is then built against the real DOM.

## Packaging / Standing Rules

- File `torn-foreign-stock.user.js`; `@name` "Foreign Stock".
- `@namespace` / `@author` RussianRob; `@license GPL-3.0-or-later`.
- Plain semver; `@version` kept in sync with an in-file `SCRIPT_VERSION`.
- No descriptive code comments, no changelog block, no `@copyright` in source.
- Distributed via Greasy Fork; `@downloadURL`/`@updateURL` point there.
- `@match https://www.torn.com/page.php?sid=travel*`; `@connect yata.yt`,
  `api.torn.com`; `@grant GM_xmlhttpRequest`, `GM_getValue`, `GM_setValue`,
  `GM_registerMenuCommand`.

## Testing / Verification

- `node --check`; YATA parse verified against the live export shape.
- Profit math + the `value.market_price` field spot-checked against a couple of
  known items with a real key during implementation.
- Manual verification on the live travel page in both Tampermonkey and TornPDA,
  covering the stale-data, no-key, and invalid-key paths.

## Open Risks

- TornPDA WebView `page.php?sid=travel` DOM is unverified → mitigated by the diag step.
- YATA freshness varies by country (crowd-sourced) → surfaced via the age stamp.
- Torn `value.market_price` is a catalogue figure, not live item-market lowest;
  acceptable for a profit *estimate* (matches how Torn shows item value). The v2
  field name is confirmed during implementation with the fallback chain as a guard.

---

## Addendum (2026-06-09): Restock ETA via Prombot

**Approved increment.** Show a restock countdown for out-of-stock (qty 0) items.

**Data source.** YATA has no restock data (confirmed: only id/name/quantity/cost). **Prombot** `https://api.prombot.co.uk/api/travel` returns the *same JSON shape as YATA plus a `nextRestock` field per item** (ISO timestamp; `null` when in stock), full 11-country coverage, live (0–2 min). It's the source TornPDA's stock timers use. → **Switch the data source to Prombot, with YATA as an automatic fallback** (if Prombot is unreachable, stock still shows, ETAs absent). Add `@connect api.prombot.co.uk`. The existing parser handles both (YATA items get `nextRestock: null`).

**Gotcha — lapsed predictions.** Many `nextRestock` values are already in the past (~42 of 69 out-of-stock items in one sample). Only render a countdown when `nextRestock` is in the **future**; past/null → just "out of stock".

**Display.** Out-of-stock rows render dimmed: "*Item* — out of stock" + (future only) "restocks in 9m" / "1h 24m". In-stock rows unchanged. **Ordering:** in-stock first (price/profit desc as before); out-of-stock grouped below, sorted by soonest future restock (no/past-ETA items last). A 30 s re-render ticks the countdown down.

**New pure logic (unit-tested):** `restockEta(nextRestock, nowMs)` → `{mins, text}` | `null` (null for missing/past); `buildRows` passes `nextRestock` through; `sortRows(rows, mode, nowMs)` groups in-stock first then out-of-stock by `restockEta` ascending.

**Version:** bump 0.1.0 → 0.2.0 on completion.
