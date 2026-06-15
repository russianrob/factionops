# Can Energy Inline — Design Spec

**Date:** 2026-06-15
**Status:** Approved (items-page only; effective energy via cached API key)

## Goal

A standalone userscript that shows, inline next to each energy drink ("can") on
the Torn items page, **how much energy that can would give the user** — matching
the value TornTools shows. Forks the "can energy" feature out of TornTools into a
single script, displayed inline like RW Pricer displays item prices.

## Behavior

Next to each energy-drink row's name, append `{N}E` (e.g. `33E`), where `N` is the
**effective** energy that can gives this user. Re-inject on DOM changes
(MutationObserver) so it survives Torn's React re-renders, exactly like RW Pricer.

## The data + formula (extracted from TornTools 9.0.6.3, validated)

**Base energy** — static map of the 9 energy-drink item ids (the base is the first
integer in the item's `effect` string; these are stable):

| itemId | item | base |
|---|---|---|
| 985 | Can of Goose Juice | 5 |
| 986 | Can of Damp Valley | 10 |
| 987 | Can of Crocozade | 15 |
| 530 | Can of Munster | 20 |
| 553 | Can of Santa Shooters | 20 |
| 532 | Can of Red Cow | 25 |
| 554 | Can of Rockstar Rudolph | 25 |
| 533 | Can of Taurine Elite | 30 |
| 555 | Can of X-MASS | 30 |

**Effective formula** (matches TornTools' `can-energy.ts`):

```
perkMultiplier = product over [faction_perks, job_perks, book_perks] of every
  perk string matching /energy drinks/i OR /consumable gain/i, each contributing
  (1 + parseInt(digitsOnly(str)) / 100). Empty set → 1.0.

effective = Math.round(base * perkMultiplier)        // round PER can
            * (caffeineConActive ? 2 : 1)            // event ×2 AFTER rounding
```

Validated against the user's TornTools screenshot — `perkMultiplier = 1.65`
reproduces all 6 visible values exactly (15→25, 20→33, 25→41, 30→50).

**Deliberately matching TornTools:** education_perks are **excluded** (TornTools
9.0.6.3 omits them). CaffeineCon is the **only** event that affects can energy.

## Components (single file: `torn-can-energy.user.js`)

1. **Base map** — the 9-entry `{itemId: base}` object above (hardcoded; the Torn
   API has no numeric energy field — energy lives only in the unstructured
   `effect` text — so a static map is correct + stable).

2. **Perk multiplier (cached)** — `GET https://api.torn.com/user/?selections=perks&key=<key>`.
   Build `perkMultiplier` from `faction_perks` + `job_perks` + `book_perks` per the
   formula. Store `{multiplier, fetchedAt}` via `GM_setValue`. Refetch when stale
   (> 24h) or on demand (cog). Perks rarely change, so the cache is read on every
   page; the network call is occasional.

3. **API key (inline cog, RW Pricer pattern)** — key stored via `GM_setValue`.
   When no key is set, render a small ⚙ cog inline (next to where the values would
   go) that opens a prompt to paste a Torn key; on save, fetch perks → cache. Mirror
   RW Pricer's no-key cog so the UX is familiar.

4. **Injection** — find energy-drink rows by their **item id** (one of the 9),
   reusing RW Pricer's row-targeting: rows carry the item id on
   `div.img-wrap[data-itemid]` (confirm the exact attribute at build against the
   live items DOM). For each matched row, append a `<span class="ce-energy">{N}E</span>`
   into the name cell (idempotent — skip if already present). A MutationObserver on
   the items list re-runs injection on re-render.

## States / error handling

- **No key set** → show the **base** energy (`{base}E`, perkMultiplier = 1) plus the
  ⚙ cog, so the script is useful immediately and clearly upgradable to effective.
- **Key set, perks fetched** → show effective `{N}E`.
- **API error / invalid key** → keep showing base; surface the error once in the cog
  tooltip (don't spam). Never throw in a way that breaks the page.
- **Unknown item** (not in the base map) → inject nothing.

## Metadata

- `@name` Can Energy (no "fork" in the name)
- `@namespace` RussianRob · `@author` RussianRob · `@license` GPL-3.0-or-later
- `@version` 0.1.0 (+ in-file `SCRIPT_VERSION` kept in sync)
- `@match` the items page only — `https://www.torn.com/item.php*` (confirm the live
  items-page URL at build; add the `page.php?sid=…` form if Torn uses it)
- `@grant` GM_xmlhttpRequest, GM_setValue, GM_getValue, GM_addStyle,
  GM_registerMenuCommand
- `@connect` api.torn.com
- `@downloadURL` **and** `@updateURL` both → `https://tornwar.com/scripts/torn-can-energy.user.js`
  (NOT a `.meta.js` — avoids the metadata-only update truncation entirely; defensive
  even though warboard-iOS 0.11.223 fixed that path)
- No `@require`, no comments in source (house style), no changelog in source

## Testing

- Pure helper `effectiveEnergy(base, perkMultiplier, eventActive)` →
  `round(base*mult)*(eventActive?2:1)` — unit-test the 6 screenshot cases + the
  per-can round-then-double ordering. (Can be a tiny inline self-check during dev;
  the user doesn't want test ceremony, so verify by running the cases in node.)
- `perkMultiplier` parser — given sample `perks` arrays, returns the right product
  (matches "energy drinks" + "consumable gain", multiplies, ignores others).
- On-device: the inline `{N}E` appears next to each can on the items page and
  matches TornTools; survives tab/sort re-renders; cog sets the key.

## Out of scope (v1, YAGNI)

- CaffeineCon ×2 event auto-detect (next event Oct 15 — add the `torn?selections=calendar`
  check before then).
- Item Market / bazaar / abroad pages (items page only per the user).
- education_perks (excluded to match TornTools).
- Routing the perks fetch through the warboard server key pool (use the user's own
  key via the cog for v1).
