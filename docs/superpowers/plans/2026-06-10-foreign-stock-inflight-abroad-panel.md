# Foreign Stocks — In-Flight & Abroad Panel — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Full detail (API shape, parseTravelState rules, render, edge cases) is in the committed spec — read it first:
> `docs/superpowers/specs/2026-06-10-foreign-stock-inflight-abroad-panel-design.md`.

**Goal:** While flying to / standing in a foreign country, show that country's live stock + land-time verdict + arrival countdown on the travel page.

**Architecture:** One file. Detect travel state via the user's API key (v1 `user?selections=travel,basic`), render a single-country panel reusing the existing stock/model/verdict pipeline.

**Tech Stack:** Tampermonkey IIFE; pure helpers exported + tested via the `new Function` loader (`server/torn-foreign-stock.test.js`).

**Single file → one task** (Task A). Task B is controller verify + deploy.

---

## Task A — In-flight/abroad panel (`server/public/scripts/torn-foreign-stock.user.js` 0.8.0 → 0.9.0)

**Files:**
- Modify: `server/public/scripts/torn-foreign-stock.user.js`, `server/public/scripts/torn-foreign-stock.meta.js`
- Test: `server/torn-foreign-stock.test.js`

Spec sections: "Detection", "Panel render", "Integration", "Pure logic to unit-test", "Edge cases". New pure fns exported via the existing guarded `module.exports`; `main()` still only runs under a real `window`.

- [ ] **TDD `parseTravelState(api)`** (pure) → `{mode, code, countryName, arrivalSec, timeLeftSec}|null` per the spec's Detection rules. Tests (the spec's "Pure logic" list): traveling-to-foreign, traveling-home (`destination:"Torn"`→null), abroad `"In Mexico"`→mex, abroad-fallback (`travel.destination:"Japan"`→jap), state Okay→null, missing status→null, unknown country `"Narnia"`→null. Reuses `normalizeCountryName`.
- [ ] **`getTravelState()`** (data layer) — async; returns `parseTravelState(api)` or null; null (quiet) when no key or API error; cached `TRAVEL_TTL=30`s in GM storage; **fetches only when the destination list is ABSENT** (`!document.querySelector('span[class*="country___"]')`). Uses v1 `https://api.torn.com/user/?selections=travel,basic&key=KEY` via the existing fetch seam (`_fetchJson`/`__setFetch`) so it's testable. Surface the key the same way profit mode reads it.
- [ ] **`renderTravelPanel(state, stock, model, prices, nowMs)`** (DOM) — inject/reuse `#tfs-travel` as first child of `[class*="content-wrapper"]` (fallback `#mainContainer`→`body`); idempotent (reuse node via `innerHTML`). Header: flight → flag + countryName + "Landing in mm:ss"; abroad → flag + "You're in {countryName}". Rows for `state.code`'s items: flight → `landVerdict` with `flightMinutes = timeLeftSec/60` + OOS `restockDisplay`; abroad → stock + `restockDisplay` only. "no stock data" when the country has none.
- [ ] **Countdown ticker** — when a **flight** panel is shown, a 1s `setInterval` recomputes `timeLeftSec = arrivalSec - now` and updates the "Landing in mm:ss" text; re-render verdicts on stock refresh + on whole-minute change; clear the interval when the panel is removed or state changes. No `document.hidden` gating when `IS_PDA`.
- [ ] **`applyAll()` integration** — after the existing `isMapLayout()?paintTable:paintPanels` branch, call `getTravelState()`; if non-null render `#tfs-travel`, else remove it + clear the ticker. Additive (the destination list is absent in flight, so `paintPanels` no-ops).
- [ ] **CSS** — `#tfs-travel` + `.tfs-travel-head` / `.tfs-countdown` in `injectCss()`, matching the existing panel look, mobile-first.
- [ ] **Version** → `0.9.0` in `@version` (`.user.js` + `.meta.js`) and `SCRIPT_VERSION`.
- [ ] **Run** `node --check server/public/scripts/torn-foreign-stock.user.js && node --test server/torn-foreign-stock.test.js` → all green. Do NOT commit/deploy.

HARD CONSTRAINTS: do not break the existing destination-list/table behavior; do not auto-click Torn UI; mobile-first; no descriptive comments/changelog in source; keep the `==UserScript==` block + `@license`.

---

## Task B — Controller verify + deploy

- [ ] `node --check` + `node --test server/torn-foreign-stock.test.js` green; full suite (`+ restock-tracker.test.js`) still green.
- [ ] Version 0.9.0 synced across `.user.js` (@version + SCRIPT_VERSION) + `.meta.js`.
- [ ] Commit (`.user.js` + `.meta.js` + test + spec + plan) + push `origin HEAD:main`; trailer `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.
- [ ] `curl` live version == 0.9.0; surface `https://tornwar.com/scripts/torn-foreign-stock.user.js`.
- [ ] Note: in-flight view needs the API key set (profit-mode key); keyless phase 2 awaits a capture.

---

## Self-review

- **Spec coverage:** detection (parseTravelState + getTravelState, key-gated, list-absent-gated) ✓; render flight/abroad ✓; countdown ticker ✓; applyAll integration ✓; edge cases ✓; out-of-scope (keyless/desktop) ✓.
- **Type consistency:** `{mode, code, countryName, arrivalSec, timeLeftSec}` produced by `parseTravelState`, consumed by `renderTravelPanel`/ticker. `landVerdict` reused with `flightMinutes` from `timeLeftSec/60` (0.8.0 signature). `normalizeCountryName` reused.
- **No placeholders:** each step names the fn/file/test; code-level rules live in the cited spec.
