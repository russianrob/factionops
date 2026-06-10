# Foreign Stocks — Land-Time Survival Predictor — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax. Full design detail (formulas, field names, thresholds, verdict states, test cases) lives in the committed spec — read it first:
> `docs/superpowers/specs/2026-06-10-foreign-stock-land-time-predictor-design.md`.

**Goal:** Show, on each in-stock foreign item, whether it will still be in stock when the player lands (mobile travel page).

**Architecture:** Server `restock-tracker.js` measures per-item sell rate (units/min) from the 60s poll history and publishes it alongside the existing restock model. The userscript reads the flight time off the page, then combines it with the live quantity + published sell rate to render a verdict.

**Tech Stack:** Node ESM (server, `node --test`); Tampermonkey IIFE userscript (pure helpers exported + tested via the `new Function` loader).

**Two independent files → two parallel tasks** (Task A server, Task B script — different files + different test files, no overlap). Task C is controller verification + deploy after both land.

---

## Task A — Server depletion model (`server/restock-tracker.js`)

**Files:**
- Modify: `server/restock-tracker.js`
- Test: `server/restock-tracker.test.js`

Spec sections: "Depletion model (server)" and "File changes → Server". Keep everything pure/exported, matching the existing `median`/`coeffVar`/`reliabilityTier` style. Existing restock detection (`recordSample` qty-increase logic, `computeEntry` interval/last/n/rel) must remain byte-for-byte equivalent in behavior.

- [ ] **Constants** at top: `WINDOW_SEC=1800`, `SAMPLE_CAP=40`, `MIN_SAMPLES_IN_WINDOW=6`, `MIN_OBSERVED_SEC=600`, `MIN_UNITS_OBSERVED=3`, `SAFETY=1.15`, `MARGIN_SAFE_MIN=8` (reuse existing `ABSENT_MAX`).
- [ ] **TDD `percentile(nums, p)`** — value at percentile `p∈[0,1]` of a numeric array (empty → 0). Test: known arrays, p=0/0.5/0.9/1.
- [ ] **TDD `recordSample` samples array** — append `[nowSec, curQty]` on every valid numeric sample; trim entries older than `nowSec - WINDOW_SEC - 120`; cap length at `SAMPLE_CAP`; return now includes `samples`. Non-finite-qty no-op branch carries `samples` through untouched. Existing restock fields unchanged. Tests: append, trim-by-age, cap-by-length, non-finite passthrough.
- [ ] **TDD `computeSellRate(samples, nowSec)`** → `{sellRate, sumDrops, sumDropsRaw, usableIntervals, observedSec, maxDropShare}` or `null`. Walk adjacent pairs within `[nowSec-WINDOW_SEC, nowSec]`: skip `cur>prev` (restock-up) and `dt>ABSENT_MAX` (gap) intervals entirely; `cur==prev` → drop 0 but seconds count; `cur<prev` → drop counts. Winsorize per-interval drops at `p90` (floor 5) before summing. `sellRate = sumDrops/(observedSec/60)`, clamp `>=0`, require finite. `maxDropShare = largestRawDrop/sumDropsRaw`. Tests (synthetic `[t,qty]`): steady decline, restock mid-window skipped, coverage-gap skipped, whale-buy winsorized (maxDropShare high), idle (→ rate 0 / null per gating), <2 samples → null.
- [ ] **TDD `depletionReliability(usableIntervals, maxDropShare, coverage)`** → `high|med|low` per spec thresholds.
- [ ] **TDD `computeEntry(restocks, samples, nowSec)`** (extended signature) — keep `interval/last/n/rel` exactly; compute sell rate; gate on `usableIntervals>=6 && observedSec>=600 && sumDrops>=3`; attach `sellReady` + (when ready) `sellRate/srel/secToSellout/modelQty/n2/obsSec/maxDropShare/sumDrops`. Tests: restock-only (sellReady=false), sell-ready (all fields present), gating-fail variants.
- [ ] **`buildModel`** passes `samples` + `nowSec` into `computeEntry`; publish an entry if it has restock data OR a fresh sell rate. Restock-side `STALE_DROP` unchanged. Test: an item with only a sell rate (no restocks) still appears.
- [ ] **Run** `node --test server/restock-tracker.test.js` → all pass. **Do not** commit/deploy (controller does Task C).

---

## Task B — Script verdict (`server/public/scripts/torn-foreign-stock.user.js` 0.7.2 → 0.8.0)

**Files:**
- Modify: `server/public/scripts/torn-foreign-stock.user.js`, `server/public/scripts/torn-foreign-stock.meta.js`
- Test: `server/torn-foreign-stock.test.js`

Spec sections: "Flight time — read off the page", "Prediction logic", "File changes → Script", "UI". New pure fns exported via the existing guarded `module.exports` block; `main()` still only runs under a real `window`. Render must be idempotent (reuse node via `innerHTML`) so the existing MutationObserver + 30s interval don't duplicate.

- [ ] **Bundled fallback data**: `BASE_MIN` (mex 26 … sou 297) + `METHOD_MULT` (standard 1, airstrip 0.7, private 0.5, business 0.3) per spec.
- [ ] **TDD `parseFlightMinutes(text)`** (pure) — `"0h 18m"`→18, `"2h 39m"`→159, `"00:18"`→18, `"1:23:45"`→84 (round), junk→null. (DOM read calls this; the parser is the unit-tested part.)
- [ ] **`readFlightMinutes(destEl, code)`** (DOM, thin) — `time[datetime]` → `parseFlightMinutes`; fallback visible `aria-hidden` text → `parseFlightMinutes`; fallback `round(BASE_MIN[code]*METHOD_MULT[getTravelMethod()])`; else null.
- [ ] **`getTravelMethod()`** — `input[name="travelType"][aria-checked="true"]`.value, default `"standard"`.
- [ ] **TDD `landVerdict({qty, sellRate, srel, sellReady, flightMinutes, nextRestock, restockEntry, nowMs})`** → `{state, text, lowConf}|null`. Implements the spec formula + the four states (SAFE/RISKY/GONE/GONE_THEN_RESTOCKED) with `SAFETY=1.15`, `MARGIN_SAFE_MIN=8`; numeric margin on SAFE/RISKY (omit when `srel==="low"`); restock roll-forward for `R`, suppressed when `restockEntry.rel==="low"`; `qty<=0` restock-driven; returns null when `!sellReady` or `flightMinutes==null`. Tests: the full state matrix from the spec's "Pure logic to unit-test → Script".
- [ ] **`renderPanel()` integration** — after existing stock/cost/restock content, for an in-stock row with a non-null verdict append one `.tfs-verdict` line (`+ modifier class`); idempotent. Also wire the desktop table path is **out of scope** (mobile only) — leave `paintTable` untouched.
- [ ] **Model parsing** — extend the existing model fetch/merge so `sellRate/sellReady/srel` reach the render path.
- [ ] **CSS** — `.tfs-verdict` + `.safe/.risky/.gone/.restock/.lowconf` in `injectCss()` (small, mobile-first, fits existing panel style).
- [ ] **Version** → `0.8.0` in `@version` (`.user.js` + `.meta.js`) and `SCRIPT_VERSION`. Update `@description` only if needed (keep current style; no changelog/comments).
- [ ] **Run** `node --test server/torn-foreign-stock.test.js` → all pass; `node --check` the `.user.js`. **Do not** commit/deploy.

---

## Task C — Controller verification + deploy (after A & B)

- [ ] Full suite: `node --test server/restock-tracker.test.js server/torn-foreign-stock.test.js` green; `node --check` script.
- [ ] `pm2 reload warboard`; confirm `[restock] published model: N items` and that the published model now carries `sellRate/sellReady/srel` on at least one item.
- [ ] `curl` live script version == 0.8.0.
- [ ] Commit (script + meta + both test files + tracker) and push `origin HEAD:main`; trailer `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.
- [ ] Surface the served URL: `https://tornwar.com/scripts/torn-foreign-stock.user.js`. Note the sell-rate warm-up (≥10 min coverage + ≥3 units/item before verdicts appear).

---

## Self-review

- **Spec coverage:** flight-time read (mobile + fallback) ✓ Task B; sell-rate model + fields ✓ Task A; verdict states ✓ Task B `landVerdict`; UI render ✓ Task B `renderPanel`; gating/warm-up ✓ A gating + C note; desktop explicitly out of scope ✓.
- **Type consistency:** field names (`sellRate/sellReady/srel/secToSellout/modelQty/n2/obsSec/maxDropShare/sumDrops`) identical across A (produce) and B (consume) and the spec table. `computeEntry(restocks, samples, nowSec)` signature used consistently by `buildModel`.
- **No placeholders:** each step names the exact fn, file, and test focus; code-level detail is in the cited spec sections (committed companion).
