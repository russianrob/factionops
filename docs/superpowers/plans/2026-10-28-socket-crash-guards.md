# Socket and Crash Guards Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One bad message on warboard's Socket.IO connection, or any error nothing else catches, no longer takes the server down unlogged or loses what a restart would have saved; `join_war` joins only the signed-in player's own faction's war.

**Architecture:** `socket-guard.js` wraps every listener a connection adds, so a throw or a rejection is logged and that one message dropped. `crash-guard.js` arms process handlers once state has loaded: log, the same saves as a normal shutdown, exit 1 for pm2. `join_war` checks its message, takes the faction from the sign-in, refuses another faction's war before touching it, and calls an `onJoin` hook that replaces `server.js`'s second `join_war` listener.

**Tech Stack:** Node 20, socket.io 4.8.3, express 4, node:test; `ws` for raw Socket.IO frames in tests.

**Spec:** the owner's approved description in chat (2026-10-28, 07:13-07:17 EDT): catch errors per socket message; a last-resort handler that logs, saves and exits (never keeps running); the `join_war` fix; the faction check. Restated below; no separate spec file.

## Global Constraints

- Server only: no FactionOps or app change. Ships with a pm2 reload.
- The crash guard never carries on: it logs `[crash] uncaught exception: <stack>` or `[crash] unhandled rejection: <stack>`, saves, then `exit(1)`. Arming logs `[crash] guard armed`.
- Saves run only once state has loaded: a crash or SIGINT before then must not write an empty wars file.
- A failed socket message logs `[ws] <event> from <playerName> (<playerId>) failed: <message>`. After 5 on one connection: one line `[ws] <playerName> (<playerId>): more failed messages, no more logged for this connection`, then silence.
- `join_war`'s faction is `socket.user.factionId`, passed to the store as it is (as `/api/poll` does) and compared as strings. The other-faction check runs before `getOrCreateWar`, which can fill in a missing enemy.
- Refusals are `socket.emit("error", { message })` with: `warId is required`, `warId must be a single value`, `enemyFactionId must be a single value`, `This token carries no faction`, `You are not a member of this war's faction`.
- Tests run socket servers in a child process with `DATA_DIR` set to a temp dir, never import `server.js`, never send a `refresh_statuses` that could reach Torn, and use made-up ids (factions 1000, 2000, 3000; players 1000001-1000003).

## Review Focus

1. A crash or SIGINT before state has loaded: nothing is saved (Task 2 wiring test, `stateLoaded`).
2. A message sent with an acknowledgement callback: the guard passes the callback through (Task 1 unit test).
3. One connection sending bad messages nonstop: the log goes quiet after 5 (Task 1 unit test).
4. A throw inside a timer a listener started (outside the socket guard): the crash guard logs, saves, exits 1 (Task 2 child test).
5. A sign-in whose faction id is a number joining a war stored with a string id: let in (Task 3 test).

## Files

- Create `server/socket-guard.js`: `guardSocket(socket, { log, quietAfter })`.
- Create `server/crash-guard.js`: `installCrashGuard({ save, log, exit, proc })`.
- Create `server/socket-test-harness.mjs`: a child-process Socket.IO server for tests (its name matches no `node --test` pattern).
- Modify `server/socket-handlers.js`: `registerSocketHandlers(io, socket, { onJoin })`, `join_war`.
- Modify `server/server.js`: `guardSocket` first in the connection handler; `saveAll` + `stateLoaded`; `installCrashGuard` after the loads; `onJoin` replaces the second `join_war` listener.
- Tests: `server/socket-guard.test.mjs`, `server/crash-guard.test.mjs`, `server/socket-join-war.test.mjs`.

---

### Task 1: Socket guard

**Files:** Create `server/socket-guard.js`, `server/socket-test-harness.mjs`, `server/socket-guard.test.mjs`. Modify `server/server.js` (connection handler).

**Interfaces:**
- Produces: `guardSocket(socket, { log = console.error, quietAfter = 5 } = {}) -> socket`. Every `socket.on(event, listener)` after it registers a wrapper that calls `listener` with the same `this` and arguments, catches a throw, and attaches a rejection handler to a returned thenable.
- Produces: harness `DATA_DIR=<tmp> node server/socket-test-harness.mjs`, which prints `PORT <n>` once listening and `ONJOIN <warId>` for each `onJoin` call. The handshake's `auth.user` object becomes `socket.user`. It creates `war_2000` for faction `"2000"` with no enemy before listening, then for each connection runs `guardSocket(socket)` and `registerSocketHandlers(io, socket, { onJoin })`.

- [ ] **Step 1: Write the tests.** Unit tests use an `EventEmitter` with `user = { playerName: "Alpha", playerId: "1000001" }` as the socket:
  - `a listener that throws is logged and the throw stops there`: `emit("call_target")` does not throw; the log is `["[ws] call_target from Alpha (1000001) failed: boom"]`.
  - `an async listener that rejects is logged, not left unhandled`: after a tick the log holds `failed: late`; a `process` `unhandledRejection` spy saw nothing.
  - `a working listener gets its arguments, the ack and the socket as this`: arguments deep-equal, the ack function is called, `this === socket`.
  - `after 5 failures on one connection, one more line, then nothing`: 7 throws give 6 lines; the 6th is the quiet line.
  - `on still returns the socket`.
  - Child test `one empty message of each kind leaves the server up and answering`: send `42["join_war"]`, `42["join_war",null]`, `42["call_target"]`, `42["uncall_target",null]`, `42["update_status"]`, `42["refresh_statuses"]`, then `42["join_war",{"warId":"war_1000","factionId":"1000"}]`. `war_state` arrives for `war_1000`, and the child has not exited.
- [ ] **Step 2: RED.** With `guardSocket` a stub that returns the socket unchanged: `node --test server/socket-guard.test.mjs`. Expected: the unit tests fail, and the child test fails because the server exited (TypeError: Cannot destructure).
- [ ] **Step 3: Implement** `guardSocket` per the Interfaces and Global Constraints. The count is per socket.
- [ ] **Step 4: Wire** `guardSocket(socket)` as the first line of `io.on("connection", ...)` in `server.js`, before `admin_broadcast` and `registerSocketHandlers`.
- [ ] **Step 5: GREEN.** Same command; all pass.
- [ ] **Step 6: Commit** `server: one socket message that throws no longer takes the server down`.

### Task 2: Crash guard

**Files:** Create `server/crash-guard.js`, `server/crash-guard.test.mjs`. Modify `server/server.js` (`shutdown`, the load block).

**Interfaces:**
- Produces: `installCrashGuard({ save, log = console.error, exit = (code) => process.exit(code), proc = process }) -> void`. It listens to `uncaughtException` and `unhandledRejection` on `proc`. Once one fires, later ones only `exit(1)`.
- `server.js`: `let stateLoaded = false;` and `function saveAll()`, which returns at once unless `stateLoaded`, else runs `store.saveState()`, `store.saveMemberBars()`, then `warHistory.flushAll()` in a try. `shutdown` calls `saveAll()` in place of those three lines. After the last load in the load block: `stateLoaded = true; installCrashGuard({ save: saveAll });`.

- [ ] **Step 1: Write the tests** (injected `EventEmitter` as `proc`, spies for log, save and exit):
  - `arming says so`: the first log line is `[crash] guard armed`.
  - `an uncaught exception is logged, saved, then exits with 1`: the order is log, save, exit(1); the log starts `[crash] uncaught exception: Error: boom`.
  - `an unhandled rejection does the same`: `[crash] unhandled rejection: Error: lost`.
  - `a save that fails still exits`: `[crash] save failed: disk full` is logged and exit(1) is called.
  - `a second error while leaving does not save again`: save is called once, exit twice, both with 1.
  - Child tests: a script installs the real guard, whose save writes a marker in a temp dir, then throws in a `setTimeout` (and, separately, leaves `Promise.reject(new Error("lost"))` unhandled). Exit code 1, the marker exists, stderr holds the `[crash]` line.
  - Wiring (`server.js` source): `stateLoaded = true;` and `installCrashGuard({ save: saveAll })` come after `store.loadMemberBars();`; `saveAll` starts with `if (!stateLoaded) return;`; `shutdown` calls `saveAll()` and no longer calls `store.saveState()` itself.
- [ ] **Step 2: RED.** `node --test server/crash-guard.test.mjs`. Expected: fails (module missing, wiring absent).
- [ ] **Step 3: Implement** `crash-guard.js` and the `server.js` changes.
- [ ] **Step 4: GREEN.** Same command, plus `server/socket-guard.test.mjs`.
- [ ] **Step 5: Commit** `server: an error nothing catches is logged and saved before pm2 restarts it`.

### Task 3: `join_war` checks and the `onJoin` hook

**Files:** Modify `server/socket-handlers.js`, `server/server.js`. Create `server/socket-join-war.test.mjs`.

**Interfaces:**
- Consumes: the Task 1 harness.
- Produces: `registerSocketHandlers(io, socket, { onJoin } = {})`. `onJoin(warId)` runs once after a join is let in and `war_state` has been sent.
- The checks, in order: a missing or empty `warId` (or no message object) gives `warId is required`; a `warId` that is not a string gives `warId must be a single value`; an `enemyFactionId` present but neither a string nor a number gives `enemyFactionId must be a single value`; no `socket.user.factionId` gives `This token carries no faction`; `store.getWar(warId)` existing with another faction (string compare) gives `You are not a member of this war's faction`. Then the existing join, with `user.factionId` in `setPlayer` and `getOrCreateWar`.
- `server.js`: drop its `socket.on("join_war", ...)`. Pass `onJoin: (warId) => { if (store.getWar(warId)?.enemyFactionId) startWarStatusMonitor(io, warId); }`.

- [ ] **Step 1: Write the tests** (a fresh harness child per test; Alpha 1000001 of `"1000"` unless stated):
  - `a join with no war id, or one that is not a string, is refused`: `{}`, `{"warId":{"a":1}}`, and `{"warId":"war_1000","enemyFactionId":["3000"]}` each get their message, no `war_state` and no `ONJOIN`.
  - `a sign-in with no faction is refused`: `This token carries no faction`.
  - `another faction's war is refused and left as it was`: Alpha sends `{"warId":"war_2000","factionId":"2000","enemyFactionId":"3000"}` and gets the not-a-member message. Bravo (1000002, `"2000"`) then joins `war_2000`, and its `war_state.enemyFactionId` is null.
  - `the faction is the sign-in's, not the message's`: Alpha's `{"warId":"war_1000","factionId":"2000"}` gets a `war_state` with `factionId` `"1000"`.
  - `a sign-in faction given as a number joins its own war`: after Alpha's join creates `war_1000`, Charlie (1000003, faction `1000` as a number) joins it and gets `war_state`.
  - `a join that is let in calls onJoin once`: exactly one `ONJOIN war_1000`.
- [ ] **Step 2: RED.** `node --test server/socket-join-war.test.mjs`. Expected: wrong or missing messages, another faction's war joined, no `ONJOIN`.
- [ ] **Step 3: Implement** per the Interfaces. Ruling: the old listener's 100 ms delay goes, because the war exists by the time `onJoin` runs.
- [ ] **Step 4: GREEN.** Same command, plus the Task 1 and 2 test files.
- [ ] **Step 5: Commit** `server: join_war joins only the signed-in player's own faction's war`.

### Task 4: Release

- [ ] Whole suite in the worktree; any failure beyond this worktree's baseline is a stop.
- [ ] Sweep the branch diff and messages: 16-character runs, `sweep-env.mjs`, `sweep-names.mjs`, the banned words.
- [ ] Final whole-branch review (fresh reviewer, most capable model); one fix pass, each fix RED to GREEN.
- [ ] Rebase onto main, fast-forward, whole suite on main, pm2 reload + health. The live log shows `[crash] guard armed` once after the reload. Push, with the remote URL masked.
- [ ] Remove the worktree, branch and workspace; memory; report to the owner with the siblings.
