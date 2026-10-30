# FactionOps 5.6.35: the Admin Broadcast Bar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Admins send a short message from a 📣 button on the war page, and every member sees it as a flashing bar at the top of every Torn page, built like CHAIN DYING.

**Architecture:**
- The server keeps the existing `/api/broadcast` fan-out (Socket.IO, SSE, poll queue, push). It now cleans the text, adds the sender's position, and remembers each war's latest broadcast for 10 minutes for a page-load ask.
- Quick picks are saved per faction in the faction settings, shared by every admin.
- On the client, the bar lives in SECTION 1A, the part that runs on every Torn page. It draws from one GM record, so every tab shows the same bar and a tap in one takes it down in all.
  - On FactionOps' own pages the stream and the polls write the record, so the bar is up at once.
  - Any page also asks the server once at load (at most every 30 s across tabs) when signed in.
- The war page gets the 📣 button and its box. The overlay's Shout box goes away.

**Tech Stack:** the userscript (plain JS), Express routes, `node:test`, Playwright browser tests (playwright-core from /root/.hermes).

**Spec:** none written. The owner asked in chat on 2026-10-29 and accepted the mockup:
- 20:05 EDT: flashing messages to members through the war script, like "Let chain die" or "Good work all!", for admins only;
- 20:27 EDT: on the war page instead of the overlay, a button that opens a box, visible to the broadcast roles set in the overlay;
- 20:40 EDT: a + to save a quick message; colour A (CHAIN DYING's red and white); "build it".

## Builder calls

These are mine, not the owner's. Each one goes in the final report.

- C1: the + saves what is typed in the box as a new quick pick. An × on a pick removes it. Up to 12 picks, each 1 to 150 characters. Saved per faction on the server and shared by every admin. "Let chain die", "Good work all!", "Hold hits" and "Hit now" stand when a faction has never saved any. A list emptied by × stays empty.
- C2: the bar flashes for 10 s from the moment a page shows it, then holds steady until tapped or until 10 minutes from sending. A tap takes it down on every tab. A newer broadcast replaces it. It replaces today's purple 📣 toast.
- C3: the text is `📣 <message> · <sender> (<position>)`, using Torn's own wording for the position. The bar is text, never markup.
- C4: the sender sees their own bar too: it shows them what members see. They also get the toast "📣 Sent to your faction".
- C5: no constant polling.
  - Other tabs pick a broadcast up within a second through GM storage.
  - A page asks the server once at load, at most every 30 s across tabs.
  - A refused sign-in (401/403) stops the asking for 10 minutes.
  - Without a stored sign-in a page never asks.
- C6: the server caps a broadcast at 150 characters, trimmed, with every run of spaces and newlines as one space. That cap was client-only before.
- C7: the role check compares positions trimmed and in any case of letters. Today it is an exact lowercase match against the stored roles, so this only widens it to what the client already shows.
- C8: the page-load answer is null for a member who is not on the war's roster when one is known: a member who has left still holds a sign-in. With no roster known, a member of the faction gets it.
- C9: `firePdaNotification('admin_broadcast', ...)` stays as it is in the stream handler. It does nothing, since `admin_broadcast` has no id range. Fixing it would add a PDA notification on top of the bar and the push, so it's the owner's call, reported as a sibling. The poll path's dead `lastBroadcast` block goes, with its copy.
- C10: the box doesn't focus the message on open. On a phone that would raise the keyboard over the quick picks.

## Global Constraints

- 5.6.35 goes in `// @version`, `const SCRIPT_VERSION`, `factionops.meta.js` and the version test in `server/factionops-chain-bar.test.mjs`, all together.
- No Torn API call, no Torn page request, no MutationObserver, no interval faster than 1 s.
- SECTION 1A runs before LOG_PREFIX exists: no `log()` or `warn()` there. Every const it uses is declared above the gate `if (!isFactionOpsPage(location.href)) return;`.
- Off FactionOps' pages, with no broadcast held, the page gains no node and makes no request without a stored sign-in. `chainbar.e2e` pins this.
- No element id starting `fo-chain` (Gym Coach reacts to that prefix). No `title` attributes on war-page controls.
- Broadcast text and pick text reach the page by `textContent` only.
- The repo is public: made-up ids, names and numbers only (players 1000001/1000002, faction 1000003). No owner screenshot values, no log counts.
- Clear `//` comments in the surrounding style, with no version stamps in them.

## Review Focus

1. **WebKit (iOS) and Torn PDA.** Only Chromium is on hand. PDA's GM storage is torn.com's localStorage, and whether another PDA tab's write is seen within a second is unknown. The page-load ask covers PDA either way. Test: "on Torn PDA the ask goes by PDA's own GET, with the sign-in".
2. **A device clock minutes off.** No comparison may mix the server's clock with the device's. The record's deadline is the device's own time plus what is left of the hold. Test: "a page-load answer 9 minutes old holds only the minute left".
3. **Two tabs and a tap.** A tap in one tab must not be undone by the next page-load answer carrying the same broadcast. Test: "the same broadcast again after a tap stays down".
4. **The bar over Torn's top bar.** It takes taps, unlike the chain bar. It must sit below Gym Coach's banner and the chain bar when they are up, and FactionOps' toasts go under it. Tests: the stacking pair in Task 2.
5. **Markup in a message.** A message holding `<img onerror>` must show as text. Test: "the message is text, never markup".

---

### Task 1: the server

**Files:**
- Create: `server/broadcast-bar.js`
- Modify: `server/routes.js`: import the module; `POST /api/broadcast` (~3694); a local `mayBroadcast(user)` above it; three new routes placed straight after it, before the War chat section.
- Test: `server/broadcast-bar.test.mjs` (new)

**Interfaces:**
- Produces, from `server/broadcast-bar.js`:
  - `BROADCAST_MAX_LEN = 150`, `BROADCAST_MAX_PICKS = 12`, `BROADCAST_HOLD_MS = 600000`;
  - `DEFAULT_BROADCAST_PICKS`, frozen: `["Let chain die", "Good work all!", "Hold hits", "Hit now"]`;
  - `cleanBroadcastText(s) -> string | null`: `String(s ?? "")`, trimmed, `/\s+/g` to one space; null when empty or over 150;
  - `holdsBroadcastRole(position, roles) -> boolean`: both sides trimmed and lowercased; an empty position holds none;
  - `picksFromSettings(settings) -> string[]`: a copy of `settings.broadcastPicks` when that is an array, else of the defaults;
  - `addPick(picks, text) -> { picks } | { error }`: the cleaned text at the end. A case-insensitive duplicate returns the list as it was. Errors: `"A quick pick is 1 to 150 characters."` and `"Up to 12 quick picks: remove one first."`;
  - `removePick(picks, text) -> string[]`: without the cleaned text;
  - `rememberBroadcast(warId, payload) -> void`: an in-memory Map of each war's latest;
  - `latestBroadcast(warId, now) -> ({ ...payload, age } | null)`: `age = max(0, now - payload.ts)`, null from 10 minutes on;
  - `latestBroadcastFor(warId, war, playerId, now)`: null when `war.ourMemberIds` is a non-empty array without `String(playerId)`, else `latestBroadcast`.
- Produces, routes:
  - `POST /api/broadcast` `{message, type, warId}`: 400 `"A broadcast is 1 to 150 characters."` when the cleaned text is null (after the existing missing-message 400). The payload's `message` is the cleaned text, plus `senderRole: String(factionPosition || "")`. `rememberBroadcast(warId, payload)` runs before the fan-out.
  - `GET /api/broadcast/latest`: `{ broadcast }` for `war_${factionId}` from the token. Never trust a client war id.
  - `GET /api/broadcast/picks`: `{ picks }`. `POST /api/broadcast/picks` `{add}` or `{remove}`: `{ picks }` after `updateFactionSettings(factionId, { broadcastPicks })`. 400 for neither (`"add or remove is required."`) and for addPick's errors. Both are 403 (`"Only broadcasters can change the quick picks."`) unless `mayBroadcast(req.user)`.
  - `mayBroadcast(user)`: the existing owner check, or `holdsBroadcastRole(user.factionPosition, getAllowedBroadcastRoles(user.factionId))`. The send route uses it in place of its inline check and keeps its 403 text and log line.

- [ ] **Step 1: Write the failing tests** in `server/broadcast-bar.test.mjs`.
  - The module's functions are imported directly. The routes are lifted the way `assist-poll-routes.test.mjs` does: `route('router.post("/api/broadcast",')` and the rest run in a `vm` context whose `router` records each handler. The context holds stubs for `requireAuth`, `store` (`getWar`, `getFactionSettings`, `getOnlinePlayersForWar`, `getFactionApiKey`, `getApiKeyForFaction`), `getAllowedBroadcastRoles`, `updateFactionSettings`, `io`, `broadcastSSE`, `pendingBroadcasts`, `push` and `fetchFactionMembers`, plus the module's real functions and `fn("mayBroadcast")`.
  - Each test uses its own war id, since the latest-broadcast Map is shared.
  - Tests:
    - `"a broadcast's text is trimmed, every run of spaces is one, and it holds 1 to 150 characters"`: `"  Let  chain\n die "` → `"Let chain die"`; `""`, `"   "`, `null` and 151 × `"x"` → null; 150 × `"x"` is kept.
    - `"a broadcast role matches in any case of letters, and no position holds none"`: `("War Leader", ["war leader"])` true; `(" leader ", ["Leader"])` true; `("Member", ["leader"])` false; `("", [""])` false.
    - `"a faction with no picks saved gets the four defaults, and a list emptied by × stays empty"`: `picksFromSettings({})` deep-equals the defaults and is a copy, so pushing to it leaves `DEFAULT_BROADCAST_PICKS` as it was; `picksFromSettings({ broadcastPicks: [] })` → `[]`.
    - `"+ adds the cleaned text at the end, once, up to 12"`: `addPick(["A"], " B ")` → `{ picks: ["A","B"] }`; `addPick(["Hold"], "hold")` → `{ picks: ["Hold"] }`; `""` → `{ error: "A quick pick is 1 to 150 characters." }`; 12 picks plus one → `{ error: "Up to 12 quick picks: remove one first." }`.
    - `"× removes that pick and leaves the rest in order"`: `removePick(["A","B","C"], "B")` → `["A","C"]`; `removePick(["A"], "Z")` → `["A"]`.
    - `"each war keeps its latest broadcast for 10 minutes, with its age"`: remember `{ts: T}` for `war_1000301`; `latestBroadcast("war_1000301", T + 1000).age === 1000`; null at `T + 600000`; `latestBroadcast("war_1000302", T)` is null; a second remember with `ts: T + 5` replaces the first.
    - `"a member on the roster gets the latest; one off it gets null; with no roster, any member does"`: wars `{ ourMemberIds: ["1000002"] }`, `{ ourMemberIds: [] }` and `undefined`.
    - `"a leader's broadcast goes out cleaned, with their position, and is remembered for the page-load ask"`: req.user `{ playerId: 1000001, playerName: "Tester", factionId: 1000003, factionPosition: "Leader" }`, body `{ message: " Let  chain die ", type: "warning", warId: "war_1000303" }`. The reply is `{ success: true }`. `broadcastSSE` got `message: "Let chain die"`, `senderRole: "Leader"`, `type: "global_toast"`. `latestBroadcast("war_1000303", Date.now()).message === "Let chain die"`.
    - `"a broadcast over 150 characters is refused, and nothing goes out"`: 400 with the error above, `broadcastSSE` not called, nothing remembered.
    - `"a member who is not a broadcaster is refused"`: position `"Member"` → 403 `"Only leaders and bankers can broadcast to the faction."`.
    - `"the page-load ask answers from the member's own faction's war"`: remembered for `war_1000003`; GET as `{ playerId: 1000002, factionId: 1000003 }`, with `store.getWar` returning `{ ourMemberIds: ["1000002"] }` → `broadcast.message` and a numeric `age`; as `playerId: 1000009` → `{ broadcast: null }`.
    - `"the quick picks: the defaults for a broadcaster, and none for anyone else"`: GET as Leader → `{ picks: defaults }`; as Member → 403.
    - `"+ and × save the faction's list, and a body with neither is refused"`: POST `{ add: "Push now" }` → `updateFactionSettings` called with `(1000003, { broadcastPicks: [...defaults, "Push now"] })` and the reply holds the same list; `{ remove: "Hit now" }` against saved `["Hit now"]` → `[]`; `{}` → 400 `"add or remove is required."`; `{ add: "" }` → 400; a Member → 403.
- [ ] **Step 2: Run and watch them fail.** Run: `cd server && node --test broadcast-bar.test.mjs`. Expected: FAIL, `Cannot find module './broadcast-bar.js'`.
- [ ] **Step 3: Write `server/broadcast-bar.js` and the routes.** Explain the 10-minute hold in a comment beside `BROADCAST_HOLD_MS`. It is longer than pending-broadcasts' 5-minute queue on purpose: the queue serves the polls, and the page-load ask covers the rest, so neither should be "fixed" to match the other.
- [ ] **Step 4: Run them green, plus the route neighbours.** Run: `cd server && node --test broadcast-bar.test.mjs assist-poll-routes.test.mjs war-admin-gate.test.mjs`. Expected: all pass.
- [ ] **Step 5: Commit** `server/broadcast-bar.js`, `server/broadcast-bar.test.mjs`, `server/routes.js`, and this plan with its first commit.

### Task 2: the bar on every page, and its delivery

**Files:**
- Modify: `server/public/scripts/factionops.user.js`:
  - SECTION 1A: the new block after `startChainBar`'s definition, `startBroadcastBar();` after `startChainBar();` and above the gate, and `chainBarToastTop`;
  - the stream handler (~6994);
  - `applyServerData`'s `lastBroadcast` block (~6570).
- Test: `server/factionops-broadcast-bar.test.mjs` (new; lifts the pure parts like `factionops-chain-bar.test.mjs` does) and `tests/factionops/broadcast.e2e.test.mjs` (new; the non-FactionOps page preamble from `chainbar.e2e`, the war page from `assist-toast.e2e`).

**Interfaces:**
- Consumes: Task 1's `GET /api/broadcast/latest` → `{ broadcast: { message, type, senderName, senderId, senderRole, ts, age } | null }`, and the stream's and polls' payloads, which carry the same fields without `age`.
- Produces, in SECTION 1A:
  - consts `BCAST_BAR_ID = 'fo-bcast-bar'`, `BCAST_STYLE_ID = 'fo-style-bcast-bar'`, `BCAST_HOLD_MS = 600000`, `BCAST_FLASH_MS = 10000`, `BCAST_CHECK_EVERY_MS = 30000`, `BCAST_CHECK_PAUSE_MS = 600000`;
  - GM keys `factionops_bcast` (the record as a JSON string), `factionops_bcast_dismissed` (a key) and `factionops_bcast_next_check` (ms; read with `Number(...) || 0`, since PDA hands strings back).
  - Pure functions:
    - `bcastRecord(b, now) -> { key, message, senderName, senderRole, ts, until } | null`: `key = ts + ':' + senderId`; `until = now + BCAST_HOLD_MS - min(max(age, 0), BCAST_HOLD_MS)`, where `age` is 0 unless it's a finite number; null unless `message` is a non-empty string and `ts` is finite.
    - `bcastNewer(stored, rec) -> boolean`: true when nothing is stored, or when the key differs and `rec.ts > stored.ts`.
    - `bcastText(rec) -> string`.
    - `bcastShows(rec, dismissed, now) -> boolean`.
    - `bcastTop(gcRect, chainRect) -> number`: Gym Coach's banner counts, as in renderChainBar, when `bottom > 0 && top < 50`, giving its bottom + 6, else 10; a chain bar raises that to its bottom + 6.
  - Impure functions: `readBcast()`, `takeBroadcast(b)` (stores a newer record, then runs `broadcastBarTick()`), `renderBroadcastBar(rec, now)`, `broadcastBarTick()`, `checkBroadcastOnLoad()` and `startBroadcastBar()` (top frame only; the ask, one tick, then a 1 s interval).
  - `chainBarToastTop()` then puts the toasts 6 px under the lower of the two bars.
- The bar's look:
  - It copies the chain bar's box: fixed and centred, `z-index:2147483647`, `#d50000` and white, `800 14px` Arial, padding 9 px 16 px, radius 7 px, the same shadow, `max-width:94vw`.
  - It differs from the chain bar here: `pointer-events:auto; cursor:pointer; white-space:normal; overflow-wrap:anywhere; text-align:center; width:max-content; box-sizing:border-box`.
  - The flash is the class `fo-bcast-flash`, running `@keyframes fo-bcast-flash`, the chain bar's red/white blink at 1 s. No animation under `prefers-reduced-motion: reduce`.
  - The style element goes in at first render, never at load.

- [ ] **Step 1: Write the failing unit tests** in `server/factionops-broadcast-bar.test.mjs`:
  - `"a record's key, and a deadline from the hold that is left"`: `bcastRecord({ message: "Hold hits", senderName: "Tester", senderRole: "Leader", senderId: "1000001", ts: 1700000000000, age: 540000 }, 5000)` → key `"1700000000000:1000001"`, `until === 65000`. With no age → `until === 605000`. Age -5 → `605000`. Age 900000 → `5000`. No message, or `ts: "x"` → null.
  - `"only a different, newer broadcast replaces the one held"`.
  - `"the text: the message, who sent it and their position"`: `"📣 Let chain die · Tester (Leader)"`; with no position → `"📣 Let chain die · Tester"`; with no name → `"📣 Let chain die"`.
  - `"a dismissed or expired broadcast does not show"`.
  - `"its top: under Gym Coach's banner at the top, under the chain bar, else 10 px"`: `bcastTop({top:10,bottom:46}, null) === 52`; `bcastTop(null, {bottom:44}) === 50`; `bcastTop({top:10,bottom:46}, {top:52,bottom:86}) === 92`; `bcastTop({top:300,bottom:336}, null) === 10`; `bcastTop(null, null) === 10`.
  - `"every const the bar uses sits above the gate, and it starts there"`: the index of each `const BCAST_` and of `startBroadcastBar();` is below the gate line's.
  - `"no log() or warn() in the bar's every-page functions"`: for each SECTION 1A function above, `fn(name)` has no `/\b(log|warn)\(/`.
- [ ] **Step 2: Write the failing browser tests** in `tests/factionops/broadcast.e2e.test.mjs`.
  - The preamble exposes `window.__store`. `cfg.held` builds the record with `until = Date.now() + cfg.held`.
  - Every request is logged with its Authorization header. `/api/broadcast/latest` answers `cfg.latest` (`{status, body}`).
  - On gym.php:
    - `"a broadcast this device holds is up on any page, flashing, with who sent it, and a tap takes it down"`: text `"📣 Let chain die · Tester (leader)"`, `animationName "fo-bcast-flash"`, `pointerEvents "auto"`; after a click no bar, and `factionops_bcast_dismissed` is the key.
    - `"after 10 s it stops flashing and holds"`: at ~10.5 s from load, `animationName "none"` and still up.
    - `"a dismissed or expired broadcast shows nothing and adds nothing to the page"`: no bar, and no node with an id starting `fo-bcast` or `fo-style-bcast`.
    - `"signed in, the page asks once for the latest and puts it up; the next page within 30 s does not ask"`: the store is carried to the second page from `window.__store`; one ask carrying `Bearer jwt-test`, then none.
    - `"a page-load answer 9 minutes old holds only the minute left"`: `age: 540000` → the stored `until` is within 60000 ± 2000 of now.
    - `"the same broadcast again after a tap stays down"`: tap, carry the store to a second page with `next_check` cleared, the same answer → no bar.
    - `"a refused sign-in waits 10 minutes before asking again"`: 401 → `next_check` ≥ now + 590000.
    - `"without a sign-in it never asks"`.
    - `"on Torn PDA the ask goes by PDA's own GET, with the sign-in"`: `cfg.pda` with a `PDA_httpGet` that logs the url and headers → one ask, `Authorization: Bearer jwt-test`, and the bar is up.
    - `"under the chain bar when both are up, and FactionOps' toasts under both"`: a live sidebar chain (chainbar.e2e's page) plus toasts → bcast top = chain bottom + 6, toasts' top = bcast bottom + 6.
    - `"under Gym Coach's banner when that holds the top"`: `gcBanner: 10` → top 52.
    - `"a broadcast another tab takes shows here within a second"`: GM_setValue the record after load → up within 1.2 s.
    - `"the message is text, never markup"`: message `'<img src=x onerror="window.__xss=1">Hold'` → no `img` in the bar, `window.__xss` undefined, and the text starts `"📣 <img"`.
  - On the war page (assist-toast's harness: sign-in, `/api/broadcast/roles`, polls):
    - `"a long-poll reply's broadcasts put the bar up at once"`;
    - `"the short poll's broadcasts do the same"` (`longpoll: false`);
    - `"by the stream: a global_toast puts the bar up"`: the `/api/stream?` request gets `onloadstart()`, then `onprogress({ responseText: 'data: ' + JSON.stringify(payload) + '\n\n' })`;
    - `"the same broadcast twice is one bar, and a tap holds against a later poll"`: a poll array with the same broadcast twice, a tap, then the next poll carrying it again → no bar.
- [ ] **Step 3: Run both and watch them fail.** Run: `cd server && node --test factionops-broadcast-bar.test.mjs`, then `node tests/factionops/broadcast.e2e.test.mjs`. Expected: unit FAIL with `bcastRecord not found`; browser FAIL on each test (no bar). The PDA, chain and toast tests fail for no bar, not for errors.
- [ ] **Step 4: Write the bar.**
  - The stream handler's `showToast` for `global_toast` becomes `takeBroadcast(data)`.
  - `applyServerData` replaces the `lastBroadcast` block with a loop over `data.broadcasts` when it is an array, one `takeBroadcast` each inside a try. The long-poll merge already passes `data.changed` through `applyServerData`.
  - A click on the bar writes the dismissed key, removes the bar and re-places the toasts.
- [ ] **Step 5: Run them green, with the chain bar's own files.** Run: `cd server && node --test factionops-broadcast-bar.test.mjs factionops-chain-bar.test.mjs`, then `node tests/factionops/broadcast.e2e.test.mjs`, then `node tests/factionops/chainbar.e2e.test.mjs`, one at a time. Expected: all pass, and chainbar's 17 tests are still green.
- [ ] **Step 6: Commit** the script and both test files.

### Task 3: the war page's 📣 and its box; the overlay's Shout goes; 5.6.35

**Files:**
- Modify: `server/public/scripts/factionops.user.js`:
  - CSS: `.fo-wp-bcast` and `.fo-bc-*` after the `.fo-wp-rt` rules;
  - the Shout CSS block and the war timer chip comment that names it (~1956, ~3570-3600);
  - `markCalledRows` (calls `syncWarBroadcastButton()` after `ensureWarFilterBar()`) and `teardownWarPageUi` (also removes `#fo-bc-box`);
  - the new functions beside `openWarSettings`;
  - the overlay template's `fo-broadcast-entry-bar` div (~12370), its wiring (~12697-12760), `setupShoutDelegation`, `sendShoutAction` and their call (~17101);
  - the version.
- Modify: `server/public/scripts/factionops.meta.js` (version) and `server/factionops-chain-bar.test.mjs` (the version test).
- Test: `tests/factionops/broadcast.e2e.test.mjs` (war-page tests), `server/factionops-broadcast-bar.test.mjs` (the source checks).

**Interfaces:**
- Consumes:
  - Task 1's `GET/POST /api/broadcast/picks` (`{ picks }`) and `POST /api/broadcast`;
  - the existing `isLeader()`, `getAction`, `postAction`, `deriveWarId()` and `showToast`.
- Produces:
  - `syncWarBroadcastButton()`: inside `#fo-wp-filter`, `button#fo-wp-bcast.fo-wp-bcast` "📣 Broadcast" goes after `#fo-wp-settings` when `isLeader()` and is taken out when not. It is idempotent.
  - `openBroadcastBox()` and `closeBroadcastBox()`;
  - `renderBroadcastPicks(box, picks)`, built with `createElement` and `textContent` only;
  - `bcastClean(s)`: trimmed, `/\s+/g` to one space.
- The box `#fo-bc-box` goes on `document.body`: a full-screen scrim (`z-index: 2147483646`) around a card `min(420px, 100vw - 32px)` wide, in the mockup's look:
  - the title `📣 Send to your faction`;
  - the line `Every member sees it at once, and anyone away gets a push.`;
  - the picks row: each pick is a text button and an × (`aria-label="Remove"`), then a `+` (`aria-label="Save as a quick pick"`);
  - `textarea#fo-bc-text` with `maxlength="150"` and `rows="3"`;
  - the note `#fo-bc-note` and the count `#fo-bc-count` (`0/150`);
  - `Cancel` and `Send to all members`.
- Its behaviour:
  - It opens with the picks fetched before in this page, or none, then the GET's answer.
  - A pick fills the message and is marked on.
  - `+` saves the cleaned text. With nothing typed the note says `Type a message, then + saves it.` and nothing is sent. With a pick already holding it, `Already a quick pick.`
  - Enter without Shift sends.
  - Send with nothing typed says `Type a message first.`. Otherwise it posts `{ message, type: 'warning', warId: deriveWarId() }` and reads `Sending…` while it goes. On success the box closes and `showToast('📣 Sent to your faction', 'success')` runs. On failure the box stays, the text is kept, and the note shows the error.
  - Cancel, a tap on the scrim and Escape close it.

- [ ] **Step 1: Write the failing tests.**
  - Unit, in `server/factionops-broadcast-bar.test.mjs`:
    - `"the overlay's Shout box is gone"`: the script has no `fo-input-broadcast`, `fo-btn-send-broadcast`, `setupShoutDelegation` or `sendShoutAction`, and no `.fo-broadcast-entry-bar` rule.
    - `"the box's text is trimmed and every run of spaces is one"`: `bcastClean`.
  - The version test becomes 5.6.35.
  - Browser, on the war page with `cfg.pos` in the sign-in reply's `player.factionPosition`, `/api/broadcast/roles` → `{ roles: ["leader","co-leader","war leader","banker"] }`, `/api/broadcast/picks` → `cfg.picks || ["Let chain die","Good work all!"]` on GET and the posted change on POST, and `/api/broadcast` → `cfg.send || { status: 200, body: { success: true } }`. POST bodies are logged.
    - `"a leader gets 📣 Broadcast after ⚙, and a member gets none"`: the text, `previousElementSibling.id === "fo-wp-settings"`, no `title`; with `pos: "member"`, none.
    - `"the box: the faction's quick picks and a +; a pick fills the message and counts it"`: the title text, the picks `["Let chain die","Good work all!"]`, a +, and after a tap on the first, the value `"Let chain die"` and `"13/150"`.
    - `"+ saves what is typed and × removes a pick, and the list follows the server"`: POST bodies `{ add: "Push now" }` and `{ remove: "Good work all!" }`; the row after each matches the answer.
    - `"+ with nothing typed, or a pick already there, says so and sends nothing"`.
    - `"Send to all members posts the message to the faction's war, closes the box and says it went"`: body `{ message: "Hold hits", type: "warning", warId: "war_1000003" }`, no `#fo-bc-box`, and a toast whose text holds `Sent to your faction`.
    - `"a refused send keeps the box and the message, and says why"`: 403 `{ error: "Only leaders and bankers can broadcast to the faction." }` → box up, value kept, note = that text.
    - `"Cancel, a tap outside and Escape each close it"`.
- [ ] **Step 2: Run and watch them fail.** Run: `cd server && node --test factionops-broadcast-bar.test.mjs factionops-chain-bar.test.mjs`, then `node tests/factionops/broadcast.e2e.test.mjs`. Expected: the new unit tests and the version test FAIL; the war-page browser tests FAIL (no `#fo-wp-bcast`); Task 2's tests still pass.
- [ ] **Step 3: Write the button and the box, take the Shout out, and bump to 5.6.35** in all four places. The war timer chip keeps its `z-index: 20`. Its comment drops the Shout bar and says lifting the chip keeps its tooltip over what sits under the header.
- [ ] **Step 4: Run them green**, then the whole suite. Run: the two unit files, then `broadcast.e2e`, `chainbar.e2e` and `outdated.e2e` one at a time, then `cd server && npm test > <workspace>/suite.txt 2>&1; tail -5 <workspace>/suite.txt`. Expected: all pass; the suite shows 0 failures.
- [ ] **Step 5: Commit** the script, meta.js and the test files.

## After the tasks

- One fresh review on Opus of the whole branch, then one fix pass, each fix RED→GREEN.
- **Release, under the standing OK:**
  - the sweep (16-char runs, sweep-env, sweep-names, no banned words);
  - ff main, chown the served files to warboard 644, the suite on main, and disk = local = public shas;
  - push.
- **Then the reload** (the server changed). First read the last `[chain/poll]`, and proceed only when the chain is clearly alive or ended 6+ minutes ago with its end notice logged. Then `pm2 reload warboard`, a health check, and `GET /api/broadcast/latest` answering 401 without a sign-in.
- Report with the served URL first.
