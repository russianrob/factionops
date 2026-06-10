# Foreign Stocks — Land-Time Survival Predictor

**Date:** 2026-06-10
**Status:** Approved design (pending owner review of this spec)
**Builds on:** `torn-foreign-stock.user.js` (currently 0.7.1) + `server/restock-tracker.js` (live, publishing `russianrob/torn-foreign-restock`).

## Summary

For every **in-stock** foreign item on the Torn travel page, show a one-line verdict
on whether it will **still be in stock when the player lands** (after the flight). The
travel page already shows each destination's flight time; the restock tracker already
polls stock every 60s. This feature adds (1) a server-side **sell-rate** (depletion)
model published alongside the existing restock model, and (2) a script that reads the
**flight time off the page** and combines it with the live quantity and sell rate to
produce a verdict. **Mobile/PDA only in this iteration** (desktop flight time is not
exposed in the DOM — see Out of Scope).

Originated from a faction-chat request (Bloodrein): "if I fly somewhere to buy
something in stock, will it still be in stock when I get there?"

## Decisions (owner-approved)

1. **Sell-out-then-restock-before-landing** gets its own distinct verdict
   (`🔄 Sells out, but restocks ~Nm before you land`), auto-downgraded to `GONE` when
   restock timing is low-confidence.
2. **Numeric margin is shown** (`~12m buffer` / `~2m to spare`) on SAFE & RISKY rows;
   omitted on low-confidence (`srel == "low"`) rows.
3. **Mobile-first.** Ship the confirmed mobile verdict now; desktop deferred to a
   separate investigation (needs a fresh DOM capture + new per-pin code).

---

## Flight time — read off the page

### Mobile / PDA inline list — confirmed

Each destination row (the `destination___` element that `findDestinations()` already
returns as `el`) natively contains the flight time. Verified from live
`foreign-stock-diag` captures:

```html
<div class="cell___Nlxyb duration___rGein">
  <span class="srOnly___vrc2S">flight time</span>
  <time datetime="0h 18m"><span aria-hidden="true">00:18</span>
  <span class="srOnly___vrc2S">18 minutes</span></time>
</div>
```

**Read order** (per destination row `el`):
1. `el.querySelector('[class*="duration___"] time[datetime]')` → parse `datetime`
   attr with `/(\d+)\s*h\s*(\d+)\s*m/` → `hours*60 + mins` = `flightMinutes`.
2. Fallback: the visible `time > span[aria-hidden="true"]` text disambiguated by
   colon-part count — **two parts = `h:m`** (the live DOM pairs `datetime="0h 18m"`
   with visible `"00:18"`, i.e. 18 **minutes**, not 18 seconds), **three parts =
   `h:m:s`** (`"1:23:45"` → 84 min). Parsed with
   `/^(\d{1,3}):(\d{1,2})(?::(\d{2}))?$/`.
3. If neither parses → **no flight time** → render stock/restock info but **no
   land-time verdict** for that row.

The DOM time is **already method-adjusted** (the captured 18m = Mexico's 26m standard
× 0.7 airstrip, under an "Airstrip Flights" list header), so it reflects the user's
real travel method and perks. We use it directly.

### Fallback — base-table × method multiplier (defensive only)

If a row has no parseable `time` node (Torn markup drift), fall back to a bundled
table (TornTools' canonical standard one-way minutes) × the method multiplier:

```
BASE_MIN = { mex:26, cay:35, can:41, haw:134, uni:159, arg:167,
             swi:175, jap:225, chi:242, uae:271, sou:297 }
METHOD_MULT = { standard:1, airstrip:0.7, private:0.5, business:0.3 }
```

Method detected from the page radio `input[name="travelType"][aria-checked="true"]`
(`.value` ∈ standard|airstrip|private|business), defaulting to `standard` if absent.
`flightMinutes = round(BASE_MIN[code] * METHOD_MULT[method])`. This is a safety net;
the DOM `time` value is primary whenever present.

---

## Depletion model (server — `restock-tracker.js`)

### Sell rate — total-drop-over-window

Walk consecutive `(t, qty)` samples in the trailing window. For each adjacent pair:

| Pair | Drop | Seconds counted? |
|---|---|---|
| `cur.qty > prev.qty` (restock jump) | — | **no** (skip interval entirely) |
| `cur.qty == prev.qty` | 0 | **yes** (real no-buy time) |
| `cur.qty < prev.qty` | `prev.qty - cur.qty` | yes |
| `dt > ABSENT_MAX` (coverage gap) | — | **no** (skip interval entirely) |

`sellRate = sumDrops / (sumSec / 60)` in **units/minute**.

Median-of-per-poll-drops is rejected: lumpy buying makes most 60s polls show drop=0,
so the median collapses to ~0 and falsely predicts SAFE. Total-drop-over-window is the
maximum-likelihood mean depletion rate and is naturally chunking-robust.

### Burst hardening

- **Winsorize** each interval's drop at the window's `p90` (with `smallFloor = 5`
  units to avoid over-clipping low-volume items) before summing — one whale-buy can't
  dominate.
- Publish `maxDropShare = largestIntervalDropRaw / sumDropsRaw`. `> 0.6` ⇒
  spiky/volatile; this lowers the depletion-reliability tier `srel` (see below),
  which de-emphasizes the verdict and omits the numeric margin. (The script does not
  consume `maxDropShare` directly — the agreed `landVerdict` signature takes `srel`, so
  volatility softening flows through `srel`, not a separate RISKY trigger.)

### Windowing, state, gating

- **Window:** trailing 30 min (`WINDOW_SEC = 1800`) — ~one foreign flight of demand.
- **New per-item state:** `samples` = compact `[t, qty]` pairs, appended every poll,
  trimmed to drop entries older than `nowSec - WINDOW_SEC - 120` and capped at
  `SAMPLE_CAP = 40`. State stays **raw/replayable** — derived rates computed in
  `buildModel`, never stored.
- **Gating (publish a rate only when ALL pass):** `usableIntervals >= 6` AND
  `observedSec >= 600` AND `sumDrops >= 3` units. Otherwise `sellReady = false` and
  the sell-rate fields are omitted (restock fields still publish).
- **Depletion reliability** `srel` (parallel to existing `rel`): **high** if
  `usableIntervals >= 12 && maxDropShare < 0.4 && coverage > 0.7`; **med** if
  `usableIntervals >= 6 && maxDropShare < 0.6`; else **low**.
  (`coverage = observedSec / WINDOW_SEC`.)

### New published-model fields (per item)

| Field | Type | Meaning |
|---|---|---|
| `sellReady` | bool | gating passed; **consumer requires this for any land-time verdict** |
| `sellRate` | number | units/min, winsorized; omitted when `sellReady=false` |
| `srel` | `high\|med\|low` | depletion-rate reliability |
| `secToSellout` | int | `round(modelQty / (sellRate*SAFETY))` — preview/sort only |
| `modelQty` | int | qty at last sample (staleness sanity check) |
| `n2` | int | usable depletion intervals (distinct from restock `n`) |
| `obsSec` | int | observed covered seconds (coverage denominator) |
| `maxDropShare` | number 0..1 | largest interval's share; `>0.6` ⇒ volatile |
| `sumDrops` | int | total units sold (post-winsorize) |

Existing restock fields (`interval`, `last`, `n`, `rel`) are **unchanged**. An item
publishes if it has restock data OR a fresh sell rate (steady depletion, no restock
seen yet).

### Constants (top of file, tunable)

`WINDOW_SEC=1800`, `SAMPLE_CAP=40`, `MIN_SAMPLES_IN_WINDOW=6`, `MIN_OBSERVED_SEC=600`,
`MIN_UNITS_OBSERVED=3`, `SAFETY=1.15`, `MARGIN_SAFE_MIN=8`; reuse existing `ABSENT_MAX`.

---

## Prediction logic (script)

**Consume-time inputs:** `current_qty` (**live** from the script's own Prombot/YATA
fetch — *not* `modelQty`, which is up to ~10 min stale), `sellRate` (from model),
`flightMinutes` (read off the page).

```
bufferedRate = sellRate * SAFETY                      // SAFETY = 1.15 (+15% demand)
M  = current_qty <= 0 ? 0 : current_qty / bufferedRate   // minutesToSellout
F  = flightMinutes
margin = M - F
R  = minutesUntilRestock   // null if unknown/unreliable
```

`R = (nextRestockSec - now) / 60`, where `nextRestockSec` is the earlier-yet-future
of: (a) the live `nextRestock` ISO from the stock feed if present and future; (b) the
model's `last + interval` rolled forward to the next future slot — **(b) used only
when `rel != "low"`**.

### Verdict states (`MARGIN_SAFE_MIN = 8`)

| State | Condition | Badge (with margin shown) |
|---|---|---|
| **SAFE** | `qty>0` && (`margin >= 8` OR `M >= 1.5*F`) | `✅ In stock when you land (~12m buffer)` |
| **RISKY** | `qty>0` && `0 <= margin < 8` | `⚠️ Cutting it close — selling fast (~2m to spare)` |
| **GONE** | `M < F` && (`R` null OR `R > F`) | `❌ Will sell out before you land` |
| **GONE_THEN_RESTOCKED** | `M < F` && `R <= F` && `R > M` | `🔄 Sells out, but restocks ~3m before you land` |

- `current_qty == 0` now → restock-driven: `R <= F` ⇒ GONE_THEN_RESTOCKED
  (`🔄 Restocks ~Nm before you land`), else GONE (`❌ Out of stock`).
- `srel == "low"` → render the verdict **de-emphasized** with a `(low confidence)`
  note, and **omit the numeric margin** (decision 2).
- No `flightMinutes` → no verdict (stock/restock info only).
- `sellReady == false` → no verdict (stock/restock info only).

---

## File changes

### Server — `server/restock-tracker.js`

1. **Constants** (above) added at top.
2. **`recordSample(item, curQty, nowSec)`**: also append `[nowSec, curQty]` to a new
   `samples` array on every valid numeric sample; trim by age + cap at `SAMPLE_CAP`;
   return `{ qty, restocks, lastSeen, samples }`. Existing restock-detection logic
   unchanged; the non-finite-qty no-op branch carries `samples` through untouched.
3. **New pure fns:**
   - `percentile(nums, p)` → value at percentile `p` (0..1) of a numeric array.
   - `computeSellRate(samples, nowSec)` → `{ sellRate, sumDrops, sumDropsRaw,
     usableIntervals, observedSec, maxDropShare }` or `null` (per the rules above:
     skip restock-up and `dt>ABSENT_MAX` intervals; winsorize drops at `p90` floor 5).
   - `depletionReliability(usableIntervals, maxDropShare, coverage)` → `high|med|low`.
4. **`computeEntry(restocks, samples, nowSec)`** (signature extended): keep
   `interval/last/n/rel` exactly; then compute the sell rate, apply gating, attach
   `sellReady` + (when ready) the new fields. Entries may exist with restock-only data.
5. **`buildModel(state, nowSec)`**: pass `samples` + `nowSec` into `computeEntry`;
   publish an entry if it has restock data OR a fresh sell rate. `STALE_DROP` behavior
   on the restock side unchanged.

No I/O change beyond the larger state object through the same atomic `saveState`.

### Script — `server/public/scripts/torn-foreign-stock.user.js` (0.7.1 → 0.8.0)

1. **`readFlightMinutes(destEl, code)`** (new pure-ish helper): DOM `time[datetime]`
   primary → visible-text fallback → base-table×method fallback → `null`.
2. **`getTravelMethod()`**: read `input[name="travelType"][aria-checked="true"]`
   `.value`, default `"standard"`.
3. **`landVerdict({ qty, sellRate, srel, flightMinutes, nextRestock, restockEntry,
   nowMs })`** (new pure fn): returns `{ state, text, lowConf } | null` per the
   prediction logic. Unit-tested.
4. **`renderPanel()`**: after the existing stock/cost/restock content, for an in-stock
   row with a verdict, append one `.tfs-verdict` line. Idempotent (reuse node via
   `innerHTML`) so the MutationObserver + 30s interval re-runs don't duplicate.
5. **CSS**: `.tfs-verdict` (+ `.safe/.risky/.gone/.restock/.lowconf` modifiers) added
   to `injectCss()`.
6. **Model parsing**: extend the existing model fetch/merge to carry the new fields
   (`sellRate`, `sellReady`, `srel`) through to render.
7. Version + `SCRIPT_VERSION` → `0.8.0`; `@version` in `.user.js` and `.meta.js` synced.

---

## Pure logic to unit-test

**Server (`restock-tracker.test.js`):** `percentile`, `computeSellRate` (synthetic
`[t,qty]` sequences: steady decline, restock mid-window, coverage gap, whale-buy
winsorized, idle, too-few-samples → null), `depletionReliability`, `computeEntry`
gating (restock-only vs sell-ready), `recordSample` sample append/trim/cap.

**Script (`torn-foreign-stock.test.js`):** `readFlightMinutes` parse cases
(`"0h 18m"`, `"2h 39m"`, `"00:18"`, `"1:23:45"`, missing → fallback table), `landVerdict`
state matrix (SAFE / RISKY / GONE / GONE_THEN_RESTOCKED, qty=0 cases, low-conf margin
omitted, no flightMinutes → null, sellReady=false → null, rel=low suppresses restock
promise).

---

## Edge cases (must hold)

- Idle item (qty 0 all window) → `sumDrops=0` → gating fails → restock-only verdict.
- Restock mid-window then heavy buying → restock interval skipped; rate reflects only
  post-restock depletion.
- Coverage gap / poll outage → `dt>ABSENT_MAX` intervals dropped from numerator AND
  denominator; too little left → gating fails.
- Single whale-buy → winsorized; `maxDropShare` high ⇒ verdict softened to RISKY.
- Phantom qty increase (Prombot rollback) → treated as restock-up, interval skipped.
- Live qty ≪ modelQty (stale model) → consumer uses **live** `current_qty`.
- `flightMinutes` unreadable → no verdict.
- `nextRestock` past/"due" → roll `last+interval` forward; `rel=="low"` ⇒ no
  GONE_THEN_RESTOCKED promise, fall back to GONE.
- New item (<6 intervals) → `sellReady=false` until window fills.
- Non-finite/negative computed rate → clamp `>= 0`, require finite, else
  `sellReady=false`.

## Warm-up

The sell rate needs ≥10 min of covered samples and ≥3 units of real demand per item
before it publishes — so verdicts appear gradually after deploy, busiest items first
(mirrors the restock-model warm-up).

## Out of scope (this iteration)

- **Desktop world-map verdict.** Map markers carry no flight time; needs a one-shot
  settling capture (select a destination, dump `destinationPanel___`) + net-new
  per-pin detection. Tracked separately. TornTools covers desktop today.
- Carry-capacity / profit-per-minute math (already partly covered by profit mode).
- Any auto-clicking of Torn UI (prohibited) — the desktop capture, if pursued, must
  ask the user to tap, never click for them.

## Versioning / distribution

Script `0.8.0`; GF id 581933; GPL-3.0-or-later; no in-file comments/changelog/@copyright;
deploy from `server/public/scripts`, `pm2 reload warboard` for the server change; surface
the served script URL after the bump.
