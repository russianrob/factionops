# FactionOps 5.6.36: the broadcast bar live on every page, and the role in the war-page panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A broadcast reaches a member on any Torn page within 15 s, and the war page's ⚙ panel says what role the member signed in with, whether it can broadcast, and when the sign-in failed.

**Architecture:** All of it is in the userscript. SECTION 1A's page-load ask for `GET /api/broadcast/latest` becomes a check on the bar's existing 1 s tick, held to one ask per 15 s across tabs by the key it already uses. The roles fetch moves into a function that also runs when the sign-in fails and FactionOps carries on with its saved sign-in. The panel's status row is built with DOM calls from state that the sign-in keeps: a new failed flag and the position in Torn's own wording.

**Tech Stack:** Userscript JS (Tampermonkey, Torn PDA, the iOS app), Playwright browser tests (`tests/factionops/*.e2e.test.mjs`), `node --test` unit tests.

**Spec:** the owner's approval, 10-29 ~23:03 EDT ("do recommended"), of these four items as put to them:
- Q1: "check for a broadcast every 15 s on every Torn page, not just when a page opens. One tiny request per device every 15 s to our server, no Torn calls."
- Q2: "'● Connected · Nihilus 📣' in the war-page ⚙ panel: the role in Torn's own wording, with 📣 only if that role can broadcast." (The tests use a made-up role, "Warden".)
- Q3: "when the sign-in fails, that row says 'Sign-in failed — check your key' in red."
- Q4: "fetch the broadcast roles even when the sign-in fails (a Torn rate-limit bounce mid-war does that too), so admins keep the 📣. Catch: a member with a dead key could still broadcast; the server already allows it."

## Global Constraints

- SECTION 1A never calls `log()`/`warn()` (LOG_PREFIX is not yet defined there), and every const it uses sits above the `isFactionOpsPage` gate.
- No element id starting `fo-chain`; no `title` attribute on war-page controls.
- The role, like a broadcast's message, goes into the page only through `textContent`, never concatenated into `innerHTML`.
- No new Torn API calls. The only new requests go to our server: `GET /api/broadcast/latest` and `GET /api/broadcast/roles`, each with the stored sign-in.
- PDA's GM storage hands numbers back as strings: read the throttle key through `Number()`.
- Copy, exactly: `Sign-in failed — check your key` (U+2014), the role as `· <role>` (U+00B7) and ` 📣` (U+1F4E3) after it for a broadcast role.
- 5.6.36 in `@version`, `SCRIPT_VERSION` and `factionops.meta.js`, which stays the header byte for byte.
- Tests use made-up ids, names and keys (1000001-style ids, "Tester", "Warden"). The repo is public.

## Review Focus

1. Several tabs or pages open at once: still one ask per 15 s per browser, since the throttle key is shared. The existing two-page test and Task 1's "exactly two asks in about 17 s" pin it.
2. The same broadcast coming back on every 15 s check after a tap: it must stay down (Task 1, second test).
3. A sign-in that fails for a reason other than the key (Torn's rate limit, a network error): the row says the sign-in failed, and the next sign-in that works clears it (Task 3, third test).
4. No position known (an old saved sign-in): no role and no stray separator, and the panel still opens (Task 3, first test).
5. A long custom role in the 244 px panel: it wraps inside the row, nothing runs past the panel's edge, and the subscription label stays (Task 3, fourth test).

---

### Task 1: The bar checks every 15 s on every page (Q1)

**Files:**
- Modify: `server/public/scripts/factionops.user.js` (SECTION 1A: `BCAST_CHECK_EVERY_MS`, `checkBroadcastOnLoad`, `startBroadcastBar`, the section's header comment)
- Modify: `server/routes.js` (the comment above `GET /api/broadcast/latest` only)
- Test: `tests/factionops/broadcast.e2e.test.mjs`

**Interfaces:**
- Produces: `checkLatestBroadcast(): void` (renamed from `checkBroadcastOnLoad`, same guards: a stored sign-in, the shared `factionops_bcast_next_check`, 10 min rest after a 401/403), `BCAST_CHECK_EVERY_MS = 15000`.

- [ ] **Step 1: Write the failing tests.** In `preamble`, the latest answer becomes `window.__latest !== undefined ? window.__latest : (cfg.latest || null)`, so a test can change it while the page runs. Rename the existing "...the next page within 30 s does not ask" to "...within 15 s...". Add:

```js
const EMPTY = { status: 200, body: { broadcast: null } };

await t("signed in, a broadcast sent while the page is open is up at the next check, 15 s on, with no reload", async () => {
  const { ctx, p } = await open({ cfg: { store: { factionops_jwt: "jwt-test" }, latest: EMPTY } });
  const before = await bar(p);
  await p.evaluate((a) => { window.__latest = a; }, ANSWER);
  await p.waitForTimeout(15000);
  const after = await bar(p), asked = await asks(p);
  await ctx.close();
  assert.strictEqual(before, null);
  assert.ok(after && after.text === "\u{1F4E3} Hold hits · Tester (leader)", JSON.stringify(after));
  assert.strictEqual(asked.length, 2, "asks: " + asked.length);
});

await t("a tapped broadcast stays down when the next check brings it again", async () => {
  const { ctx, p } = await open({ cfg: { store: { factionops_jwt: "jwt-test" }, latest: ANSWER } });
  await p.click("#fo-bcast-bar");
  await p.waitForTimeout(15000);
  const got = await bar(p), asked = await asks(p);
  await ctx.close();
  assert.strictEqual(asked.length, 2, "asks: " + asked.length);
  assert.strictEqual(got, null, "a tapped broadcast came back");
});
```

- [ ] **Step 2: Run them.** `node tests/factionops/broadcast.e2e.test.mjs` (alone; the box runs one browser suite at a time). Expected: both new tests FAIL with "asks: 1" (no second ask exists); the other 26 pass.

- [ ] **Step 3: Implement.** `BCAST_CHECK_EVERY_MS = 15000`; rename to `checkLatestBroadcast`; `startBroadcastBar` asks once at load as now, and its 1 s interval runs `checkLatestBroadcast()` then `broadcastBarTick()`, each in its own try. The check returns early before the throttle passes, so the tick costs a GM read. Update SECTION 1A's header comment ("Nothing polls" is no longer true) and the routes.js comment ("asks once when a Torn page loads, at most every 30 s" becomes every 15 s on every page).

- [ ] **Step 4: Run them.** Same command. Expected: 28 passed, 0 failed.

- [ ] **Step 5: Commit.** `git commit -- server/public/scripts/factionops.user.js server/routes.js tests/factionops/broadcast.e2e.test.mjs` with the message "Broadcast bar: a check every 15 s on every page, not only at page load".

### Task 2: The roles come with the saved sign-in too (Q4)

**Files:**
- Modify: `server/public/scripts/factionops.user.js` (`authenticate()`'s success branch, `main()`'s step 7 catch)
- Test: `tests/factionops/broadcast.e2e.test.mjs`

**Interfaces:**
- Produces: `fetchBroadcastRoles(): void`, which sets `state.allowedBroadcastRoles` from `GET /api/broadcast/roles` (through `getAction`, so with `state.jwtToken`) and drops errors, as the inline call did.
- Produces (rig): `warPreamble` options `cfg.authFails` (that many sign-ins answer 401 `{ error: "Torn API error: Incorrect key (code 2)" }` before they work), `cfg.roles` (the roles answer, default the four built-in ones), `"pos" in cfg` (so `pos: ""` signs in with no position); every logged request carries `auth`. A helper `savedJwt(position)` returns `"h." + base64url({ playerId: 1000002, playerName: "Tester", factionId: 1000003, factionName: "Testers", factionPosition: position }) + ".s"`.

- [ ] **Step 1: Write the failing test.**

```js
const ROLES = ["leader", "co-leader", "warden"];

await t("a refused sign-in: the saved sign-in still brings the faction's roles, and a custom broadcast role gets 📣", async () => {
  const jwt = savedJwt("Warden");
  const { ctx, p } = await openWar({ authFails: 99, roles: ROLES, store: { factionops_jwt: jwt }, wait: 1000 });
  const shown = await p.waitForSelector("#fo-wp-bcast", { timeout: 15000 }).then(() => true, () => false);
  const asked = await p.evaluate(() => window.__reqs.filter((q) => q.url.includes("/api/broadcast/roles")).map((q) => q.auth));
  await ctx.close();
  assert.ok(shown, "no 📣 Broadcast");
  assert.ok(asked.length >= 1 && asked.every((a) => a === "Bearer " + jwt), JSON.stringify(asked));
});
```

- [ ] **Step 2: Run it.** `FO_ONLY='saved sign-in still' node tests/factionops/broadcast.e2e.test.mjs`. Expected: FAIL "no 📣 Broadcast" (no roles request is made after a refused sign-in).

- [ ] **Step 3: Implement `fetchBroadcastRoles()`** beside `isLeader()`. Call it where the success branch called `getAction('/api/broadcast/roles')`, and in `main()`'s catch next to `startPolling(); connectRealtime();` when `state.jwtToken` is set.

- [ ] **Step 4: Run the whole file.** `node tests/factionops/broadcast.e2e.test.mjs`. Expected: 29 passed, 0 failed.

- [ ] **Step 5: Commit** the script and the test: "FactionOps: the broadcast roles with the saved sign-in too, so a refused sign-in keeps the 📣".

### Task 3: The ⚙ panel's status row: the role, and a failed sign-in (Q2, Q3)

**Files:**
- Modify: `server/public/scripts/factionops.user.js` (`state`, `authenticate()`, `hydrateStateFromJwt()`, `openWarSettings()` and its Save handler, the `.fo-wp-*` CSS)
- Test: `tests/factionops/broadcast.e2e.test.mjs`

**Interfaces:**
- Consumes: Task 2's rig options and `savedJwt`, `isLeader()`, `subLine()`.
- Produces: `state.authFailed` (false at start; true on any failed sign-in: 401/other non-2xx, 403, 426 and a network error; false on success), `state.myFactionPositionLabel` (Torn's wording, set beside the lowercased `myFactionPosition` in both places), `fillWarPanelStatus(row: HTMLElement): void`, the row `#fo-wp-pstat`.

- [ ] **Step 1: Write the failing tests.** A helper `pstat(p)` opens ⚙ (`#fo-wp-settings`) if it is closed and returns `{ dot, b, bColor, role, sub, rowRight, panelRight }`: the dot's classes, the `<b>`'s text and computed colour, `.fo-wp-role`'s text or null, `.fo-wp-sub`'s text or null, the right edges of the row's children and of the panel.

```js
await t("⚙ shows the role after Connected in Torn's own words, 📣 for a broadcast role; a member gets no 📣, no position no role", async () => {
  const w1 = await openWar({ pos: "Warden", roles: ROLES });
  const lead = await pstat(w1.p); await w1.ctx.close();
  const w2 = await openWar({ pos: "Member", roles: ROLES });
  const mem = await pstat(w2.p); await w2.ctx.close();
  const w3 = await openWar({ pos: "", roles: ROLES });
  const none = await pstat(w3.p); await w3.ctx.close();
  assert.strictEqual(lead.b, "Connected");
  assert.strictEqual(lead.role, "· Warden \u{1F4E3}");
  assert.strictEqual(mem.role, "· Member");
  assert.strictEqual(none.role, null);
  assert.ok(lead.sub && mem.sub && none.sub, "the subscription label went");
});

await t("the role is text, never markup", async () => {
  const { ctx, p } = await openWar({ pos: '<img src=x onerror="window.__xss=1">Boss', roles: ROLES });
  const got = await pstat(p);
  const imgs = await p.evaluate(() => document.querySelectorAll("#fo-wp-panel img").length), xss = await p.evaluate(() => window.__xss);
  await ctx.close();
  assert.ok(got.role && got.role.startsWith("· <img"), JSON.stringify(got));
  assert.strictEqual(imgs, 0);
  assert.strictEqual(xss, undefined);
});

await t("a refused sign-in: the row says so in red, and a key that works brings the role back", async () => {
  const { ctx, p } = await openWar({ authFails: 1, pos: "Warden", roles: ROLES, store: { factionops_jwt: savedJwt("Warden") } });
  const failed = await pstat(p);
  await p.fill("#fo-wp-key", "testkey5678");
  await p.click("#fo-wp-key-save");
  await p.waitForTimeout(600);
  const fixed = await pstat(p);
  await ctx.close();
  assert.deepStrictEqual([failed.b, failed.bColor, failed.role, failed.sub], ["Sign-in failed — check your key", "rgb(255, 118, 117)", null, null]);
  assert.ok(failed.dot.includes("bad"), failed.dot);
  assert.notStrictEqual(fixed.b, "Sign-in failed — check your key");
  assert.strictEqual(fixed.role, "· Warden \u{1F4E3}");
});

await t("a long role wraps inside the panel and the subscription label stays", async () => {
  const { ctx, p } = await openWar({ pos: "Supreme Commander of the Northern Fleet", roles: ROLES });
  const got = await pstat(p);
  await ctx.close();
  assert.ok(got.role && got.sub, JSON.stringify(got));
  assert.ok(got.rowRight <= got.panelRight, got.rowRight + " > " + got.panelRight);
});
```

- [ ] **Step 2: Run them.** `FO_ONLY='⚙ shows|never markup|row says so|long role' node tests/factionops/broadcast.e2e.test.mjs`. Expected: all four FAIL (no `.fo-wp-role`; the row says Connected after a refused sign-in).

- [ ] **Step 3: Implement.** `openWarSettings` writes an empty `<div class="fo-wp-prow fo-wp-pstat" id="fo-wp-pstat"></div>` and fills it with `fillWarPanelStatus`. Failed: the dot `bad`, `<b class="fo-wp-fail">` with the copy, nothing else. Otherwise: the dot and `<b>` as today, then `span.fo-wp-role` only when there is a label, then `span.fo-wp-sub`. CSS: `.fo-wp-fail { color: #ff7675; }`, `.fo-wp-role { min-width: 0; overflow-wrap: anywhere; font-weight: 400; }`. The Save handler refills the row (if the panel is still open) once `authenticate()` settles, either way.

- [ ] **Step 4: Run the whole file.** `node tests/factionops/broadcast.e2e.test.mjs`. Expected: 33 passed, 0 failed.

- [ ] **Step 5: Commit** the script and the test: "FactionOps: the war-page panel says your role, with 📣 when it can broadcast, and when the sign-in failed".

### Task 4: 5.6.36

**Files:**
- Modify: `server/public/scripts/factionops.user.js` (`@version`, `SCRIPT_VERSION`), `server/public/scripts/factionops.meta.js`
- Test: `server/factionops-chain-bar.test.mjs` (the version test)

- [ ] **Step 1: The version test asks for 5.6.36** (title and both regexes). Run `cd server && node --test factionops-chain-bar.test.mjs`. Expected: FAIL on the version test only.
- [ ] **Step 2: Bump both places in the script and write meta.js as the header** (everything through `// ==/UserScript==` plus a newline).
- [ ] **Step 3: Run** `cd server && node --test factionops-broadcast-bar.test.mjs factionops-chain-bar.test.mjs broadcast-bar.test.mjs factionops-attack-energy.test.mjs`. Expected: all pass. Then each browser file alone: broadcast, chainbar, assist, assist-toast, attack-banner, attack-energy, outdated. Expected: 0 failed in each.
- [ ] **Step 4: Commit** the three files: "FactionOps 5.6.36: the broadcast bar live on every page, and your role in the war-page panel".

## Release (after the final review, under the standing OK)

Fast-forward main to the branch; chown the served script and meta to warboard:warboard 644; run the whole suite on main (the nine tests that read main's script by path get their first real run here); check the served user.js and meta.js shas against disk; sweep the added lines and the commit messages; push. No pm2 reload: the only server-file change is a comment.
