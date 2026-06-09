# Torn Foreign Stocks — Inline Filters Design

**Date:** 2026-06-09
**Status:** Approved design
**Builds on:** `torn-foreign-stock.user.js` (currently 0.3.0).

## Summary

Add filters to the existing inline per-country panels (not a separate table). Four
filters, in a collapsible "Filters" section of the settings bar, all persisted in
`GM` storage, re-rendering on change.

## Filters

1. **Hide out-of-stock** — toggle; drops qty-0 rows (and their restock estimates).
2. **Hide negative profit** — toggle; profit-mode only (disabled/ignored in stock
   mode); drops rows where profit < 0.
3. **Item category** — checkboxes for **Plushie · Flower · Drug · Temporary · Weapon ·
   Armor · Other** (all on by default); a row shows only if its category is checked.
4. **Country show/hide** — 11 country toggles (all on by default); an unchecked
   country's panel doesn't render.

## Category data (keyless, bundled)

YATA/Prombot give only `{id, name, quantity, cost}`. A bundled `ITEM_CATEGORY`
map (`{itemId: "Plushie"|"Flower"|"Drug"|"Temporary"|"Weapon"|"Armor"}`) is hardcoded
in the script — generated from Torn v2 `/torn/items` `type` for the foreign-stock item
set (116 categorized of 202; the rest default to **"Other"**). Keyless for users, no
extra fetch. `itemCategory(id)` returns the map value or `"Other"`. Regenerate + bump
if Torn adds foreign items (rare).

## UI

A `▶ Filters` expander appended to the settings bar (collapsed by default, like
TornTools). Expanded: the two toggles, the 7 category chips, the 11 country flag
chips. Compact, mobile-first. State keys: `tfs_hide_oos`, `tfs_hide_negprofit`,
`tfs_cats` (set of unchecked categories), `tfs_hidden_countries` (set of unchecked
codes) — storing the *excluded* set so the default (empty set) means "show all".

## Pure logic (unit-tested)

- `itemCategory(id)` → bucket string.
- `rowVisible(row, mode, filters)` → bool: false if (out-of-stock && hide_oos) OR
  (mode==="profit" && hide_negprofit && row.profit < 0) OR (itemCategory(row.id) is in
  the excluded-categories set).
- `countryVisible(code, filters)` → bool: false if code is in the hidden-countries set.

## Render

`paintPanels`/`renderPanel` consult the filters: skip a country whose `countryVisible`
is false; within a panel filter rows by `rowVisible` before building HTML; a panel that
filters to zero rows renders nothing (no empty shell).

## Scope / testing

One file (`torn-foreign-stock.user.js`) + its meta. No server / restock-model changes.
Pure filter logic tested via `node --test` (the existing `new Function` loader).
Version → 0.4.0. Defaults: everything checked/visible, Filters section collapsed.
