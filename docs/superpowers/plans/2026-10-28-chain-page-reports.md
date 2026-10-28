# Chain Page Reports Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When Torn's API runs behind the game, the CHAIN BREAKING / CHAIN DYING pushes follow the chain a member's focused Torn page shows; at all other times nothing changes.

**Architecture:** FactionOps 5.6.28 sends the page's chain (its count, and when its clock runs out) to a new `POST /api/chain-page`, only while the tab is focused. The server keeps reading Torn's API exactly as now. A fresh page report decides the low-clock alerts only while it is ahead of the API's reading (`pageLeadsApi` in `chain-alert-rule.js`); then the API reading's low clock is ignored and the page's clock, counted down to now, is checked instead.

**Tech Stack:** Node 20, express 4, node:test; the FactionOps userscript (Tampermonkey, Torn PDA, the iOS app).

**Spec:** the owner's approved description in chat (2026-10-28, 17:31-17:48 EDT): the API stays the source; a page report takes over only when the API is behind (its count is lower than the page's, or it says the chain is over while the page shows it running); with no page reporting, nothing changes. Reports only from a focused tab (Torn's rule; PDA is exempt). Restated here; no separate spec file. Why: on 2026-10-28 Torn's API ran behind the game for about two hours, showing the chain over while it ran on, and the server could send no chain alert at all.

## Global Constraints

- The server's API reads, the stored `war.chainData`, the poll gate, the Live Activity, the bonus alerts and the chain-ended notice are unchanged: a page report reaches only the low-clock alerts.
- Page reports are sent only while `IS_PDA || document.hasFocus()` (the chain bar's own `looking`), from every Torn page the chain bar runs on, with the token FactionOps stores (`GM_getValue('factionops_jwt', '')`), through `httpRequest` (never a page fetch). Sent whatever the member's own chain-alert setting.
- Cadence: the first reading; then at most one report per 5 s, and one when the count changes, when the clock is under 90 s, or when 60 s have gone by. A 401, 403 or 404 pauses reports for 10 minutes.
- The client sends `{ count, endsAt }` (Torn's own end, epoch seconds, from the sidebar's saved chain) when the saved chain matches the bar's count, else `{ count, left }` (the DOM clock's seconds). Never a reading in a cooldown, under 10 hits, or with more than 300 s left.
- The server: `endsAtMs = endsAt * 1000`, or `now + left * 1000`; a report must be a running clock (`now < endsAtMs <= now + 310 s`) with a whole count from 1 to 100,000, else 400. The war is `war_<token's faction>`, else 404.
- A report is fresh for 75 s (`PAGE_REPORT_FRESH_MS`). Of fresh reports the one held is the furthest ahead (a higher count, or the same count with an end no more than 2 s earlier, which refreshes it).
- `pageLeadsApi(page, api, now)`: not fresh: no. A higher count than the API's: yes; lower: no. The same count while the API shows a cooldown: yes, unless the cooldown's end is from 5 s before to 45 s after the page's end (the page is counting that cooldown down; FactionOps' `CHAIN_BAR_COOLDOWN_AHEAD_S` is 45). The same count with no cooldown: yes when the page's end is 15 s or more after the API's.
- Alerts from the page use the same thresholds (60 s warning, 30 s panic), floors (`chainAlertFloor`) and per-war cooldown maps as the API's, and log `(page)`. The July check (`timerPlausible`) is for the API's lag and does not apply to the page's clock.
- Logs: `[chain/page] war=<id> player=<id> count=<n> left=<s>s leads=<yes|no>` at most once a minute per war; `[chain] page leads: API read <n> (cooldown=<s> timeout=<s>), page <n> with <s>s left` at most once a minute per war.
- FactionOps 5.6.28: `@version`, `SCRIPT_VERSION` and `factionops.meta.js` together. The version floor stays 5.6.26.
- Public repo: made-up counts and ids only (chains 1240-1250, faction 1000, players 1000001+).

## Known limits

- A report's end is a lower bound (hits only push it later). For up to 75 s after the reporting member's tab loses focus, the server counts that end down although later hits went unreported, so it can warn early. Only while the API is also behind.
- For 75 s after a chain breaks, the broken chain's last report stays held, and a new chain's lower count waits.

## Review Focus

1. A desktop page counting a finished chain's cooldown down, with no saved sidebar chain: no alert, through the cooldown cross-check (Task 1 rule test, Task 2 monitor test).
2. One member's left-based reports at the same count, a few hundred ms apart in their implied end: each refreshes the held report (Task 2 test).
3. A page report behind the API (a stale tab): the API's own alert still goes out (Task 2 test).
4. A page alert and an API alert in the same 20 s: one panic, not two (Task 2 test).
5. A phone whose clock is wrong: the report carries Torn's end, not the phone's (Task 3 test).

## Files

- Modify `server/chain-alert-rule.js`: `PAGE_REPORT_FRESH_MS`, `PAGE_COOLDOWN_AHEAD_S`, `PAGE_COOLDOWN_BEHIND_S`, `PAGE_LEADS_BY_MS`, `PAGE_REPORT_MAX_LEFT_S`; `apiChainView`, `pageLeadsApi`, `parsePageReport`.
- Modify `server/chain-monitor.js`: `pageChain` and two log Maps; `sendLowClockAlert` (lifted from `_processChain`), `checkPageClock`, `recordPageChain`; the branch in `_processChain`; `stopChainMonitor` deletes `pageChain`.
- Modify `server/routes.js`: `POST /api/chain-page`.
- Modify `server/public/scripts/factionops.user.js` and `factionops.meta.js`: `sidebarChain`, `readChainForReport`, `pageReportDue`, `reportPageChain`, its call in `chainBarTick`, 5.6.28.
- Tests: create `server/chain-page-report.test.mjs`; add to `server/chain-outside-war.test.mjs` and `server/factionops-chain-bar.test.mjs`.

---

### Task 1: The rule

**Files:** `server/chain-alert-rule.js`; test `server/chain-page-report.test.mjs`.

**Interfaces:**
- Produces: `apiChainView(chain, readAtMs) -> { current, endsAtMs, cooldownEndsAtMs }` (a raw Torn reading with `timeout`, or a stored one with `chainEndsAt`; 0 for none); `pageLeadsApi(page, api, nowMs) -> boolean` (`page` is `{ count, endsAtMs, atMs }` or null); `parsePageReport(body, nowMs) -> { count, endsAtMs } | null`.

- [ ] **Step 1: Write the failing tests** in `chain-page-report.test.mjs`, importing `./chain-alert-rule.js`:
  - `apiChainView` of `{ current: 1240, timeout: 40, cooldown: 0 }` at T is `{ current: 1240, endsAtMs: T + 40000, cooldownEndsAtMs: 0 }`; of a stored `{ current: 1240, chainEndsAt: T + 9000, cooldown: 0 }` keeps `T + 9000`; a cooldown of 7440 read at T ends at `T + 7440000`; `chainEndsAt: 0` stays 0.
  - `pageLeadsApi`: a page at 1250 with 25 s left against an API at 1240 in a 7440 s cooldown: true. A page at 1235 against an API at 1240: false. A page 76 s old: false. The same count, the API's cooldown ending 30 s after the page's end: false; 4 s before: false; 6 s before: true; 50 s after: true. The same count, no cooldown, the page's end 15 s after the API's: true; 14 s: false. A null page: false.
  - `parsePageReport`: `{ count: 1250, endsAt: (T + 25000) / 1000 }` gives `{ count: 1250, endsAtMs: T + 25000 }`; `{ count: 1250, left: 25 }` gives `T + 25000`; an `endsAt` of now or earlier, or past `T + 310000`; a `left` of 0, -1, 311 or "abc"; a count of 0, 1.5, 100001, "x" or missing: null. A count sent as text ("1250") is taken.
- [ ] **Step 2: Run** `node --test chain-page-report.test.mjs` in `server/`. Expected: FAIL (`apiChainView is not a function`).
- [ ] **Step 3: Implement** the three functions and the five constants in `chain-alert-rule.js`, each with a doc comment in the file's style.
- [ ] **Step 4: Run** the same. Expected: PASS.
- [ ] **Step 5: Commit** `chain page reports: the rule for when a page report leads Torn's API`.

### Task 2: The server: alerts from a leading page report, and the route

**Files:** `server/chain-monitor.js`, `server/routes.js`; tests in `server/chain-outside-war.test.mjs` (new section "── A page report while the API is behind ──"; add `sendLowClockAlert`, `checkPageClock`, `recordPageChain` to `MONITOR_FNS`) and `server/chain-page-report.test.mjs` (the route, checked in the text).

**Interfaces:**
- Consumes: Task 1's three functions and constants (in the monitor through the `./chain-alert-rule.js` import).
- Produces: `recordPageChain(warId, report, playerId) -> boolean` (exported); `sendLowClockAlert(warId, war, count, timeoutS, source)`; `checkPageClock(warId, war, page, nowMs)`.

- [ ] **Step 1: Write the failing tests** (made-up chains, a live war unless named):
  - The API reads 1240 in a 7440 s cooldown; a page report of 1250 with 25 s left: one `notifyChainPanic` for 1250, logged `(page)`.
  - Then the next API reading of 1240 in the cooldown, 10 s later: the page's clock (15 s) is checked again and no second panic goes out inside 20 s.
  - The API reads 1240 with 20 s left and no hit for 5 minutes (the July check lets it through); a fresh page report of 1245 with 240 s left: no alert from that reading.
  - A page report of 1235 with 240 s left (behind) and the API at 1240 with 25 s left, no hit for 5 minutes: the API's panic goes out.
  - The same count, the API in a 60 s cooldown read just now, a page report with 50 s left (it counts the cooldown down): no alert.
  - Two left-based reports at 1250 whose ends differ by 300 ms, 70 s apart: the second refreshes the held report, so 10 s later it still leads.
  - Outside a war a page report of 99 with 25 s left: no alert (the floor of 100); of 120: a panic.
  - A page report 76 s old does not lead: the API's reading decides.
  - Text checks: `routes.js` has `router.post("/api/chain-page", requireAuth,`, calls `parsePageReport(` and `recordPageChain(` with `` `war_${factionId}` ``, and answers 400 and 404 as Global Constraints say.
- [ ] **Step 2: Run** `node --test chain-outside-war.test.mjs chain-page-report.test.mjs`. Expected: the new tests FAIL; the existing ones pass.
- [ ] **Step 3: Implement.** Lift the panic/warning sending out of `_processChain` into `sendLowClockAlert` unchanged (same pushes, arguments and log lines; `source` in the log). In `_processChain`, after the hit check: when `pageLeadsApi(pageChain.get(warId), apiChainView(chain, now), now)`, log the "page leads" line (once a minute) and `checkPageClock`; otherwise the existing SUPPRESSED log and alert, through `sendLowClockAlert`. `checkPageClock` alerts on the page's clock counted to now when it is above 0 and the count is at or over `chainAlertFloor`. `recordPageChain` holds the report (Global Constraints), logs `[chain/page]` (once a minute), and checks the page's clock when it leads `apiChainView(war.chainData, war.chainDataUpdatedAt)`. The route as Global Constraints say, beside `/api/chain-update`.
- [ ] **Step 4: Run** the same, then the whole suite (`node --test` in `server/`). Expected: PASS, no new failures.
- [ ] **Step 5: Commit** `chain page reports: the server alerts from a page report while Torn's API is behind`.

### Task 3: FactionOps 5.6.28 sends the page's chain

**Files:** `server/public/scripts/factionops.user.js`, `server/public/scripts/factionops.meta.js`; tests in `server/factionops-chain-bar.test.mjs` (a separate lifted lib for the new functions, so the existing `L()` tests stay green while they are missing).

**Interfaces:**
- Produces: `sidebarChain(storage) -> object | null` (the saved chain, the same scan as `readChainFromPhoneBar`); `readChainForReport(doc, storage, now) -> { count, endsAt } | { count, left } | null`; `pageReportDue(now, reading, last) -> boolean` (`last` is `{ at, count }` or null); `reportPageChain(now)`; constants `PAGE_REPORT_MAX_LEFT_S = 300`, `PAGE_REPORT_EVERY_MS = 60000`, `PAGE_REPORT_MIN_GAP_MS = 5000`, `PAGE_REPORT_FAST_UNDER_S = 90`, `PAGE_REPORT_PAUSE_MS = 600000`.

- [ ] **Step 1: Write the failing tests:**
  - The phone bar "Chain:1,250 / 2,500" with a saved chain of 1250 ending at `NOW/1000 + 42`: `{ count: 1250, endsAt: NOW/1000 + 42 }`, whatever `now` is passed within that minute (Torn's end, not the device clock).
  - The desktop bar "1,250/2,500" "00:42" with that saved chain: `{ count: 1250, endsAt }`; with no saved chain: `{ count: 1250, left: 42 }`.
  - A saved chain with `coolDown: 7440`, or an `endCoolDownTimestamp` ahead, on either layout: null. A desktop clock of "1:02:03": null. "Chain:9 / 10": null. No bar: null.
  - `pageReportDue`: no last: true. Same count, 2:00 left: false at 59 s, true at 60 s. A new count: false at 4.9 s, true at 5 s. 80 s left: true every 5 s. Read from `endsAt` too.
  - The wiring, in the text: `chainBarTick` calls `reportPageChain(now)` inside an `if (looking)`; `reportPageChain` reads `GM_getValue('factionops_jwt'`, never `state.`, posts to `/api/chain-page` through `httpRequest(`, and sets the pause on 401, 403 and 404.
  - The version test reads 5.6.28 in both places and the meta file is still the header.
- [ ] **Step 2: Run** `node --test factionops-chain-bar.test.mjs`. Expected: the new tests FAIL; the rest pass.
- [ ] **Step 3: Implement** the functions beside `readChainFromPhoneBar`, `reportPageChain` with module-level `pageReportLast` and `pageReportPausedUntil`, the call at the end of `chainBarTick`, and the bump (header, `SCRIPT_VERSION`, meta file = header). `node --check` the script.
- [ ] **Step 4: Run** the chain-bar tests, then the whole suite. Expected: PASS.
- [ ] **Step 5: Commit** `FactionOps 5.6.28: send the focused page's chain to the server`.

### Release (after one fresh Opus review of the branch and its fixes)

- Fast-forward main, the whole suite on main, `chown warboard:warboard` + 644 on the two served files.
- No pending "Chain may have ended" line in the log, then `pm2 reload warboard` straight after the fast-forward (the script is served from disk at once; the route needs the reload), the three health checks, one `[chain/poll]` per tick, and `POST /api/chain-page` with no token answers 401.
- The served 5.6.28: meta and script on 127.0.0.1:3000 and tornwar.com, sha against disk.
- Sweep, push, remove the worktree, the branch and the workspace.
