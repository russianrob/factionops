# Drink Stats — Energy + Nerve Inline — Design Spec

**Date:** 2026-06-15
**Status:** Approved (fold alcohol→nerve into Can Energy; rename to "Drink Stats")

## Goal

Evolve the existing **Can Energy** userscript (`torn-can-energy.user.js`, currently
1.0.0) into **Drink Stats**: a single "consumable values" script that shows, inline
next to items on the Torn items page, both:

- **Energy per can** (`{N}E`) for energy drinks — the existing feature, unchanged.
- **Nerve per alcohol** (`{min} - {max} N`) for alcoholic drinks — the new feature.

Both values are perk-adjusted to match TornTools, displayed inline like RW Pricer
displays prices. The two features share one file, one API key, and one set of
DOM/placement machinery.

## Why fold (not a new script)

User decision: one script for both. The nerve badge injects into the **same**
`.name-wrap` row area as the energy badge, so it reuses Can Energy's hard-won
machinery written once: the RW Pricer coexistence dance, the idempotent-write
render-loop guard, the cached `?selections=perks` fetch, and the inline ⚙ key cog.
Adding a third consumable later ("happy") becomes one more data descriptor.

## The data + formulas

### Energy (cans) — unchanged from Can Energy 1.0.0

Base map `{itemId: baseEnergy}` (the base is the first integer in the item's Torn
effect string; stable):

| 985 | 986 | 987 | 530 | 553 | 532 | 554 | 533 | 555 |
|---|---|---|---|---|---|---|---|---|
| 5 | 10 | 15 | 20 | 20 | 25 | 25 | 30 | 30 |

```
energyMult = product over [faction_perks, job_perks, book_perks] of every perk
  string matching /energy drinks/i OR /consumable gain/i, each (1 + digits(str)/100).
effectiveEnergy = Math.round(base * energyMult) * (caffeineConActive ? 2 : 1)
```

Display: `{N}E` (green). `caffeineConActive` is hard-`false` in v1 (event off).

### Nerve (alcohol) — new (extracted from TornTools 9.0.6.x `AlcoholNerveFeature`)

Base map `{itemId: baseNerve}` — every Torn item with `"type":"Alcohol"` whose
effect is "Increases nerve by N":

| itemId | item | base |
|---|---|---|
| 180 | Bottle of Beer | 1 |
| 181 | Bottle of Champagne | 1 |
| 294 | Bottle of Sake | 1 |
| 426 | Bottle of Tequila | 1 |
| 531 | Bottle of Pumpkin Brew | 2 |
| 541 | Bottle of Stinky Swamp Punch | 4 |
| 542 | Bottle of Wicked Witch | 3 |
| 550 | Bottle of Kandy Kane | 2 |
| 551 | Bottle of Minty Mayhem | 3 |
| 552 | Bottle of Mistletoe Madness | 4 |
| 638 | Bottle of Christmas Cocktail | 3 |
| 816 | Glass of Beer | 2 |
| 873 | Bottle of Green Stout | 5 |
| 924 | Bottle of Christmas Spirit | 5 |
| 984 | Bottle of Moonshine | 5 |

(This map was lifted from `retorn/files/items.json`; the implementation MUST
re-derive it by parsing that file's Alcohol `effect` strings and assert it matches —
see Testing. Treat the table as the expected fixture, not an unverified constant.)

```
alcFaction%  = digits() of the FIRST faction_perks string matching /alcohol/i        (else 0)
alcCompany%  = digits() of the FIRST job_perks string matching
                 /alcohol boost|consumable boost/i                                    (else 0)
total = base * (1 + alcFaction/100) * (1 + alcCompany/100) * eventMult
min   = Math.floor(total),  max = Math.ceil(total)
display = (min === max) ? `${min} N` : `${min} - ${max} N`
```

Display: the range badge (a distinct nerve color, e.g. rose `#e0556b`). **No book
perks** for nerve (TornTools omits them). `eventMult` is hard-`1` in v1.

Note `digits(str) = parseInt(String(str).replace(/\D+/g, ""), 10)` — the same helper
the energy parser uses. Real Torn perk strings are single-number today; multi-number
strings would concatenate digits (a known latent fragility shared with energy, not a
v1 concern).

## Components (single file, data-driven — Approach A)

Refactor `render()` to iterate a small list of **provider descriptors**, each
self-contained:

```js
PROVIDERS = [
  { key: "energy", base: {985:5,...},  cls: "ce-energy",
    value(base, perks) -> "25E"        // perks=null => base-only (mult 1) },
  { key: "nerve",  base: {180:1,...},  cls: "ce-nerve",
    value(base, perks) -> "6 - 7 N"    // perks=null => alcFaction/alcCompany 0 => "{base} N" },
]
```

1. **Base maps** — the two `{itemId: base}` objects above (hardcoded; Torn's API has
   no numeric energy/nerve field — it lives only in unstructured effect text — so a
   static map is correct + stable).

2. **Perk multiplier (cached, shared)** — one `GET
   https://api.torn.com/user/?selections=perks&key=<key>`. From the single payload
   compute and cache `{ energyMult, alcFaction, alcCompany, fetchedAt }` via
   `GM_setValue`. Refetch when stale (> 24h), on demand (cog/menu), or when the cached
   object lacks a required field (migration from Can Energy 1.0.0's `{multiplier}`
   shape — treat as stale).

3. **API key (inline ⚙ cog)** — unchanged from Can Energy: one key in `GM_setValue`,
   one inline input+Save panel (NO `prompt()`), serves both providers.

4. **Row finder** — generalize `findCanRows` → `findRows`: scan item rows
   (`ul.items-cont > li, ul.items-list > li, li.show-item-info,
   [data-category='Energy Drink']` plus the alcohol equivalent), and for each row
   match its `data-item` id against each provider's base map. A row resolves to at
   most one provider (a can OR an alcohol). Returns `{row, nameLeaf, nameWrap, provider, base}`.

5. **Placement (shared, reused verbatim)** — each badge carries class `ce-badge` plus
   its provider color class. Idempotency/placement query is `.ce-badge`. The RW Pricer
   coexistence rule is unchanged: keep the badge **outside** `.name-wrap` until the row
   has a `.rwp-base-price-tag`, then move it **inline after the `.name` leaf**. Writes
   are idempotent (`if (span.textContent !== txt) ...`) so the MutationObserver
   quiesces (no render loop). See `[[reference_torn_items_namewrap_rwpricer]]`.

6. **Styles** — energy `{N}E` green `#19b34a` (unchanged); nerve `{min} - {max} N`
   rose `#e0556b`. Both small, bold, with a leading space.

## States / error handling

- **No key set** → base values + `*` marker for both providers (energy mult 1; nerve
  perks 0 → whole-number `{base} N`), plus the ⚙ cog. Useful immediately.
- **Key set, perks fetched** → effective energy and effective nerve range.
- **API error / invalid key** → keep base; surface the error once in the cog tooltip
  (don't spam). Never throw in a way that breaks the page (try/catch around every GM
  call, the observer, and the fetch).
- **Unknown item** (in neither base map) → inject nothing.

## Identity / metadata

- `@name` "Can Energy" → **"Drink Stats"** (no "fork" in the name).
- `@description` → "Shows energy per can and nerve per alcohol inline on the items
  page (perk-adjusted; forked from TornTools)".
- `@namespace` RussianRob · `@author` RussianRob · `@license` GPL-3.0-or-later
  (unchanged; TornTools is GPL-3.0).
- `@version` **1.1.0** (+ in-file `SCRIPT_VERSION` kept in sync). 1.1.0 > 1.0.0 so the
  installed copy updates **in place**.
- **Same file** `torn-can-energy.user.js` and **same `ce_*` storage keys**
  (`ce_apikey`, `ce_mult`) so the in-place update preserves the user's API key. (The
  file MAY later be renamed to `torn-drink-stats.user.js` if desired — costs a
  one-time re-install + re-enter key; deferred, not in this spec.)
- `@match` items page only — `https://www.torn.com/item.php*` (unchanged).
- `@grant` GM_xmlhttpRequest, GM_setValue, GM_getValue, GM_addStyle,
  GM_registerMenuCommand · `@connect` api.torn.com only.
- No `@updateURL`/`@downloadURL` (Greasy Fork owns updates — set in 1.0.0).
- No comments in source (house style), no changelog in source, no `@copyright`.

## Testing

Pure helpers are node-verifiable; DOM/placement is verified on-device (same approach
as Can Energy).

- **Energy** (`effectiveEnergy`, `perkMultiplier`) — the existing 6 screenshot cases
  (15→25, 20→33, 25→41, 30→50 at mult 1.65) + round-then-double ordering (82, not 83).
- **Nerve** (`nerveRange`, alcohol perk parser):
  - base 5, no perks → `"5 N"` (min===max).
  - base 5, faction 10% + company 10% → 5×1.1×1.1 = 6.05 → `"6 - 7 N"`.
  - base 1, faction 25% → 1.25 → `"1 - 2 N"`.
  - base 4, company 50%, faction 0 → 6.0 → `"6 N"` (whole).
  - perk parse: `faction_perks:["+ 10% nerve from alcohol"]` → 10;
    `job_perks:["+ 10% alcohol boost"]` → 10; unrelated perks ignored; book perks ignored.
- **Map validation** — parse `retorn/files/items.json`: assert the 15 Alcohol items +
  nerve values equal the hardcoded nerve map, and the 9 energy-drink ids + bases equal
  the energy map. (Catches a stale/typo'd constant.)
- **On-device** — on the items page, cans show `{N}E` and alcohol shows `{min}-{max} N`
  inline, both coexisting with RW Pricer prices (price still appears), both matching
  TornTools; survive sort/tab re-renders; cog sets the key; no steady-state CPU loop.

## Added in 1.2.0 — event multipliers

- **CaffeineCon** ×2 (energy, after rounding), **St Patrick's Day** ×2 (all alcohol),
  **International Beer Day** ×5 (only Bottle of Beer 180 + Glass of Beer 816). Detection
  replicates TornTools: fetch `torn?selections=calendar` (v2) with the same cog API key
  (`ce_cal` cache, 24h TTL), match events by title (CaffeineCon `startsWith`; St
  Patrick's/Beer Day via loose regex to survive apostrophe variants), and treat an event
  active when `now` is inside its `[start−1day, end+1day]` window. No key → no calendar →
  events off (eventMult 1). `computeEvents(events, now)` → `{caffeineCon, stPatricks,
  beerDay}` is passed to each provider's `value(base, perks, {id, events})`.

## Out of scope (YAGNI)

- **Happy / other consumables** — the provider-list architecture leaves room; not built.
- **The "doubles alcohol effects" book buff** (item 781) — a consumed item, not a
  perk; not auto-detectable. TornTools doesn't auto-apply it either. Excluded.
- **Item Market / bazaar / abroad pages** — items page only, per the energy feature.
- **education_perks** — excluded for energy (match TornTools); N/A for nerve.
