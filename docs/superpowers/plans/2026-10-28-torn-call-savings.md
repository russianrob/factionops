# Torn Call Savings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop three kinds of Torn call nobody needs: chain reports Torn will never serve, the running chain's report on quiet days, and members' daily honors reads.

**Architecture:** Three independent changes, one commit each, released in one restart. `faction-history.js` records the chains Torn refuses as too old (code 6) and never asks for them again. `genocide.js` reads the running chain's report only when the stored live chain count passes a bonus mark worth 1,000+ respect. FactionOps 5.6.30 remembers the answer the server took: it never asks Torn again after a yes, and asks again a month after a no.

**Tech Stack:** Node ESM, `node:test`, linkedom (FactionOps tests), a Tampermonkey/PDA userscript.

**Spec:** the five decisions the owner approved in chat on 2026-10-28 ("do all recommended"), copied below. There is no separate spec file.

## The approved decisions

1. A chain Torn refuses with code 6 ("Incorrect ID") is marked unavailable for good. Other errors (rate limit, network, a bad key) are still retried. Each old chain is asked one last time, then never again.
2. The run's summary counts only real reports, e.g. "chainreports +0, 200 unavailable, 37 left".
3. FactionOps stops asking Torn once a member's "yes" is saved, and asks again after a "no" only once a month. The monthly ask catches someone who earned it elsewhere and rejoined. This is FactionOps 5.6.30, and the settings hint changes from "Once a day" to "once, then monthly until you have it".
4. The server fetches the running chain's report only when the live count passes a new bonus mark (2,500, 5,000, 10,000…). A big chain costs a few calls, a quiet day none.
5. Ship all of it in one restart, with FactionOps 5.6.30.

## Global Constraints

- Code 6 is the only Torn error recorded for good. In the server's logs, every code-6 answer was for a chain older than the oldest report Torn serves (Feb 2022), and none was for a newer chain.
- Unavailable chains go under a new top-level key `unavailable` (`{ "<chainId>": 1 }`) in `data/faction-chainreports-<fid>.json`, never in `chains`. `lifetimeChainRespect` counts every `chains` entry.
- `chain-monitor.js` and `store.js` behaviour stays as it is. `genocide.js` must not import `store.js`: the tests import `genocide.js`, and `store.js` reads DATA_DIR when it loads. `server.js` passes the live count in.
- The bonus marks are `[2500, 5000, 10000, 25000, 50000, 100000]`. The 2,500th bonus pays 1,280 respect and each later one doubles it; the 1,000th pays only 640.
- FactionOps: `@version`, `SCRIPT_VERSION` and `factionops.meta.js` are all 5.6.30, and the meta file equals the script's header. No changelog goes in the script. GM values are strings, because PDA stores strings.
- The hint copy, exactly: "FactionOps reads your honors with your own key once, then monthly until you have it. Your faction sees only yes or no, on the faction info page. The switch is per device: turn it off on each one you use."
- Tests:
  - never call Torn, never write live data (DATA_DIR is a temp dir), never import `server.js`;
  - use made-up ids only: chains 900001…, players 1000001…, factions 1001….
- The repo is public: no keys, key endings, member data, real player ids or live counts in code, tests, the plan or commit messages.
- Commits:
  - stage only your own paths (`git add -- <paths>`), never `server/node_modules` (a symlink);
  - end with the trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Tests run from `server/`: `node --test <file>` for one file, `node --test` for the whole suite. The worktree's baseline (`../baseline.txt` in the workspace) has known failures; compare against it instead of chasing them.

## Review Focus

1. **Torn answers code 6 for a chain that has a report.** That chain would be missing from lifetime respect for good. Each chain recorded unavailable logs one warning with its id, and the summary shows "N unavailable", so it is visible. (Task 1 test.)
2. **A bad live count:** a member's bad 0 mid-chain, then the real count again. It costs at most one extra read and never loses a mark. (Task 2 sequence test.)
3. **Torn's running-chain report lags the count**, so the mark's bonus is not in it yet. The mark is read again at the next check rather than counted as shown, and a read that fails is retried the same way. (Task 2 test.)
4. **A member moves to another faction that also runs FactionOps after their "yes".** The new faction is asked at once, because the saved answer remembers the faction it went to. (Task 3 pure test.)
5. **A device updated from 5.6.29** has a last-answer time but no saved answer. It checks once, then follows the new rule. (Task 3 wiring test.)

---

### Task 1: Chains Torn refuses as too old are never asked again (decisions 1, 2)

**Files:**
- Modify: `server/faction-history.js`: `tornGet` (~line 66) and `captureChainReports` (~939), plus a new `chainReportsSummary` next to it
- Modify: `server/faction-history-schedule.js:46-48`
- Create: `server/faction-history-chainreports.test.mjs`

**Interfaces:**
- Produces:
  - An error `tornGet` throws for a Torn error body carries `err.code` (Torn's number); the message is unchanged.
  - `captureChainReports(key, factionId, chains, { budget, onProgress })` returns `{ store, fetched, unavailable, remaining }`:
    - `fetched`: reports stored this run;
    - `unavailable`: chains recorded unavailable this run;
    - `remaining`: chains still without a report or a refusal, `todo.length - fetched - unavailable`.
  - `chainReportsSummary({ fetched, unavailable, remaining })` returns `chainreports +<fetched>`, then `, <n> unavailable` and `, <n> left`, each left out when 0.
- `tools/chain-reports.mjs` destructures `store, fetched, remaining` and keeps working unchanged.

- [ ] **Step 1: Write the failing tests** in the new file.
  - Before anything else, set `process.env.DATA_DIR = mkdtempSync(...)`, then `const fh = await import("./faction-history.js")`. Static imports would load the module first.
  - Stub `globalThis.fetch` for the whole file. The stub answers by the URL's `id` and records each asked id:
    - 900002 answers `{ error: { code: 6, error: "Incorrect ID" } }`;
    - 900001 first answers `{ ok: false, status: 502 }`, then a report;
    - every other id answers `{ chainreport: { id, attackers: [{ id: 1000001, respect: { total: 12.5 }, attacks: { total: 3 } }] } }`.
  - The pacing makes 4 calls cost about 3.3 s. Keep it to these 4.

```js
test("a chain Torn refuses with code 6 is kept as unavailable and never asked again; any other failure is asked again", async () => {
  const chains = [{ id: 900003, start: 1700000300 }, { id: 900002, start: 1700000200 }, { id: 900001, start: 1700000100 }];
  // run 1 (console.warn captured)
  const r1 = await fh.captureChainReports("TESTKEY", "1001", chains, { budget: 200 });
  assert.deepEqual({ fetched: r1.fetched, unavailable: r1.unavailable, remaining: r1.remaining }, { fetched: 1, unavailable: 1, remaining: 1 });
  assert.deepEqual(asked, [900003, 900002, 900001]);
  const file = JSON.parse(readFileSync(path.join(process.env.DATA_DIR, "faction-chainreports-1001.json"), "utf8"));
  assert.deepEqual(Object.keys(file.chains), ["900003"]);
  assert.deepEqual(file.unavailable, { "900002": 1 });
  // one warning each: 900002 says it will not be asked again, 900001 does not
  assert.equal(warned.filter((m) => m.includes("900002") && m.includes("not asked again")).length, 1);
  assert.equal(warned.filter((m) => m.includes("900001") && !m.includes("not asked again")).length, 1);
  // run 2: only the chain that failed for another reason is asked
  asked.length = 0;
  const r2 = await fh.captureChainReports("TESTKEY", "1001", chains, { budget: 200 });
  assert.deepEqual({ fetched: r2.fetched, unavailable: r2.unavailable, remaining: r2.remaining }, { fetched: 1, unavailable: 0, remaining: 0 });
  assert.deepEqual(asked, [900001]);
  assert.equal(fh.lifetimeChainRespect(fh.loadChainReports("1001")).chains, 2);
});

test("the run's summary counts real reports only", () => {
  assert.equal(fh.chainReportsSummary({ fetched: 0, unavailable: 200, remaining: 37 }), "chainreports +0, 200 unavailable, 37 left");
  assert.equal(fh.chainReportsSummary({ fetched: 3, unavailable: 0, remaining: 0 }), "chainreports +3");
  assert.equal(fh.chainReportsSummary({ fetched: 1, unavailable: 0, remaining: 2 }), "chainreports +1, 2 left");
});

test("the daily tick reports with it", () => {
  const S = readFileSync(new URL("./faction-history-schedule.js", import.meta.url), "utf8");
  assert.match(S, /summary\.push\(fh\.chainReportsSummary\(await fh\.captureChainReports\(key, factionId, chains, \{ budget: 200 \}\)\)\);/);
});
```

- [ ] **Step 2: Run** `node --test faction-history-chainreports.test.mjs`.
  Expected: FAIL. `unavailable` is undefined, all four calls count as fetched, and `chainReportsSummary` is not a function.
- [ ] **Step 3: Implement.**
  - In `tornGet`, build the error, set `err.code = data.error.code`, and throw it.
  - In `captureChainReports`, `const INCORRECT_ID = 6`. `store.unavailable ||= {}`, and `todo` also skips `store.unavailable[id]`.
  - Each loop step:
    - a report: fold it, `fetched++`;
    - code 6: `store.unavailable[id] = 1`, `unavailable++`, and warn `` `[fachist] chainreport ${id}: ${e.message}, kept as unavailable and not asked again` ``;
    - anything else: the warning as today.
  - Update the doc comment.
  - Add `chainReportsSummary`, and use it in the schedule as one line, exactly as the test pins.
- [ ] **Step 4: Run** `node --test faction-history-chainreports.test.mjs faction-history.test.mjs genocide.test.mjs`. Expected: PASS.
- [ ] **Step 5: Commit**: `git add -- server/faction-history.js server/faction-history-schedule.js server/faction-history-chainreports.test.mjs`. Message: "Chain reports: a chain Torn refuses as too old is not asked again".

### Task 2: The running chain's report is read only at a new bonus mark (decision 4)

**Files:**
- Modify `server/genocide.js`:
  - the header (lines 10-13);
  - the constants (~36-42);
  - `scanLiveChain` (~225);
  - `startGenocideSchedule` (~235).
- Modify: `server/server.js:715`
- Test: `server/genocide.test.mjs`. Change the `scanLiveChain` test (~169) and the wiring test (~240).

**Interfaces:**
- Produces:
  - `GENOCIDE_MARKS`, the list above.
  - `markReached(count) → number`: the highest mark ≤ count, 0 below 2,500.
  - `liveChainWatch(fetchReport, factionId, { dir }) → async check(count) → number`: the new holders found, 0 when it did not read. It keeps in memory the highest mark a report has shown for this chain (`shown`).
- Changes:
  - `scanLiveChain(fetchReport, factionId, { dir })` returns `{ found, mark }`. `mark` is `markReached` of the report's highest `bonuses[].chain`, and 0 when there is no report.
  - `startGenocideSchedule({ chainCount })`, where `chainCount(factionId)` returns the live count. `server.js` passes `` (factionId) => store.getWar(`war_${factionId}`)?.chainData?.current `` (the field the chain monitor stores).

**The check's rule, `n = Number(count) || 0`:**
1. If `n < 2500`, set `shown = 0` (a new chain, or none) and don't read.
2. If `markReached(n) <= shown`, don't read.
3. Otherwise read, and set `shown = Math.min(markReached(n), mark)`.
   - If `shown` is still below `markReached(n)`, log `[genocide] live chain at <n>: the report does not show the <markReached(n)>th bonus yet, read again next check`.
   - A read that throws leaves `shown` as it was. The caller logs the error.

- [ ] **Step 1: Write the failing tests** (`REPORT` is the file's fixture, with bonuses up to 5,000):

```js
test("markReached: the highest bonus mark worth 1,000+ that a count has reached", () => {
  for (const [n, m] of [[0, 0], [2499, 0], [2500, 2500], [4999, 2500], [5000, 5000], [24999, 10000], [100000, 100000]]) assert.equal(g.markReached(n), m, String(n));
});
// scanLiveChain test: now { found: 2, mark: 5000 }, then { found: 0, mark: 5000 }; a null report → { found: 0, mark: 0 }
test("the live watch reads the running chain only when its count passes a new bonus mark", async () => {
  // counts → reads: 1200, 2499 none · 2500 one · 2600, 4999 none · 5000 one · 6000 none ·
  // 0 none (a new chain, or a bad 0) · 5100 one (both marks in one read) · 5200 none · 0 · 2600 one
  // total reads 4; the holders folded once
});
test("a report that does not show the mark yet is read again at the next check, and so is a read that failed", async () => {
  // a report with bonuses up to 1,000 at 2510 → read; 2520 → read again; then REPORT: 2530 → read; 2540 → none
  // a fetch that throws: check rejects, and the next check reads again
});
// wiring:
assert.match(SERVER, /^startGenocideSchedule\(\{ chainCount: \(factionId\) => store\.getWar\(`war_\$\{factionId\}`\)\?\.chainData\?\.current \}\);$/m);
```

- [ ] **Step 2: Run** `node --test genocide.test.mjs`.
  Expected: FAIL. `markReached` and `liveChainWatch` are missing, `scanLiveChain` returns a number, and the wiring regex doesn't match.
- [ ] **Step 3: Implement.**
  - `GENOCIDE_MARKS[0]` is `GENOCIDE_MIN_CHAIN`.
  - `LIVE_SCAN_MS` stays at 30 min; its comment now says it is how often the stored count is checked.
  - `startGenocideSchedule`:
    - builds one watch and runs `check(chainCount(factionId))` on the existing timers;
    - logs new holders as today;
    - without `chainCount`, logs `[genocide] no chain count — not watching the live chain` and returns.
  - The boot line becomes `[genocide] live chain checked every 30 min, its report read at each bonus mark of 2,500+`.
  - The header now says the running chain's report is read when the live count passes a bonus mark worth 1,000+.
- [ ] **Step 4: Run** `node --test genocide.test.mjs faction-history-chainreports.test.mjs`. Expected: PASS.
- [ ] **Step 5: Commit**: `git add -- server/genocide.js server/genocide.test.mjs server/server.js`. Message: "Genocide marks: read the running chain only when it passes a bonus mark".

### Task 3: FactionOps 5.6.30, a "yes" never asked again and a "no" a month on (decision 3)

**Files:**
- Modify `server/public/scripts/factionops.user.js`:
  - the header `@version` (line 4) and `SCRIPT_VERSION` (~106);
  - the hint (~8413) and the switch handler (~8710-8723);
  - the constants and `genocideCheckDue` (~9725-9750), and `selfCheckGenocide` (~9836-9871).
- Modify: `server/public/scripts/factionops.meta.js` (`@version`)
- Modify: `server/genocide.js` header ("which reads its own honors once a day")
- Test:
  - `server/factionops-genocide.test.mjs`;
  - `server/factionops-chain-bar.test.mjs:220-228` (the version test).

**Interfaces:**
- A new GM value, `factionops_genocide_has`: the answer the server last took and the faction it went to, `'1:<factionId>'` or `'0:<factionId>'`. It is `''` when there is none.
- `GENOCIDE_CHECK_MS = 30 * 24 * 60 * 60 * 1000`. The name stays, because the tests lift it by name.
- `genocideCheckDue(now, lastOk, lastTry, saved, factionId) → boolean`:
  - false within `GENOCIDE_RETRY_MS` of `lastTry`;
  - otherwise true when nothing was taken for this faction: `!lastOk`, an empty `saved`, or `saved` for another faction (a device updated from 5.6.29 is in this case);
  - otherwise false for a yes, and true for a no once `now - lastOk >= GENOCIDE_CHECK_MS`.
- `selfCheckGenocide`:
  - captures `String(state.myFactionId || '')` when it starts, reads `_has`, and passes both;
  - when the server takes the post, sets `_has = (has ? '1' : '0') + ':' + factionId`, then `_ok` as today;
  - when a post fails, saves nothing.
- Switching sharing on also sets `GM_setValue('factionops_genocide_has', '')`.

- [ ] **Step 1: Write the failing tests.**
  - The harness `state` becomes `{ jwtToken: 'jwt', myFactionId: '1001' }`.
  - Replace the old daily test, so its 23 h/25 h cases are gone rather than edited to pass:

```js
test('genocideCheckDue: a yes taken for this faction is never asked again, a no a month on, anything else now, never twice in an hour', () => {
  const H = 3600000, D = 24 * H, now = 400 * D;
  const due = (lastOk, lastTry, saved) => L().genocideCheckDue(now, lastOk, lastTry, saved, '1001');
  assert.equal(due(0, 0, ''), true);
  assert.equal(due(now - 2 * D, 0, ''), true);              // updated from 5.6.29
  assert.equal(due(now - 365 * D, 0, '1:1001'), false);
  assert.equal(due(now - 29 * D, 0, '0:1001'), false);
  assert.equal(due(now - 31 * D, 0, '0:1001'), true);
  assert.equal(due(now - 2 * D, 0, '1:1002'), true);        // taken for another faction
  assert.equal(due(0, now - 30 * 60000, ''), false);
  assert.equal(due(now - 31 * D, now - 30 * 60000, '0:1001'), false);
});
test('a yes the server took is never asked of Torn again; a no is, a month on; a failed post saves nothing', async () => {
  // T = Date.now(): _ok is stamped with the real clock. A yes: check(T), onload(HONORS), settle → _has '1:1001';
  // check(T + 2h), check(T + 400d) → still 1 request. A no ({honors: []}) → '0:1001'; T + 2d → 1 request; T + 31d → 2.
  // A post that is refused → no _has and no _ok; check(T + 2h) → a second request.
  // A device from 5.6.29 (stored _ok = T - 2h, no _has): check(T) → 1 request.
});
```

  - In the switch test, add `assert.equal(gm.get('factionops_genocide_has'), '')` after switching on.
  - In the hint test, swap `/Once a day/` for `/once, then monthly until you have it/` and add `assert.doesNotMatch(row, /Once a day/)`.
  - The version test becomes 5.6.30 in its name and in both regexes.
- [ ] **Step 2: Run** `node --test factionops-genocide.test.mjs factionops-chain-bar.test.mjs`.
  Expected: FAIL. The new rule's yes and no cases fail, and so do the hint, the `_has` and the version checks.
- [ ] **Step 3: Implement** as the Interfaces say.
  - Use the hint copy from Global Constraints.
  - Update the comments that say "once a day": the block above the constants, the `selfCheckGenocide` doc, the genocide.js header, and the test file's header.
  - Bump all three version places.
- [ ] **Step 4: Run** `node --test factionops-genocide.test.mjs factionops-chain-bar.test.mjs genocide.test.mjs`. Expected: PASS.
- [ ] **Step 5: Commit**: `git add -- server/public/scripts/factionops.user.js server/public/scripts/factionops.meta.js server/genocide.js server/factionops-genocide.test.mjs server/factionops-chain-bar.test.mjs`. Message: "FactionOps 5.6.30: ask Torn for honors once, then monthly until yes".

### Task 4: Review and release (decision 5)

- [ ] **Step 1:** Run the whole suite in the worktree. Expected: no failure that isn't in the baseline.
- [ ] **Step 2:** Ask a fresh reviewer for a whole-branch review on the most capable model. Then do one fix pass, each fix RED→GREEN, followed by the suite.
- [ ] **Step 3:** Fast-forward main to the branch.
  - The main checkout's dirty files belong to other sessions, and none of them are paths this branch touches.
  - Then `chown warboard:warboard` and `chmod 644` the two served FactionOps files.
- [ ] **Step 4:** Run the whole suite on main. Expected: 0 fail.
- [ ] **Step 5:** Read the last `[chain/poll]` line before reloading. Reload only if the chain is clearly alive, or ended 6+ min ago with its end notice logged.
- [ ] **Step 6:** Do the `pm2 reload`, then the health checks: the local `/api/health` and `/health`, and the public `/api/health`. The served FactionOps sha must match on disk, locally and publicly, at 5.6.30.
- [ ] **Step 7:** Check the logs after the boot:
  - the new `[genocide] live chain checked every 30 min…` line;
  - 5 min in, `[fachist/daily] boot: … chainreports +0, 200 unavailable, <n> left`;
  - no new errors.
- [ ] **Step 8:** Sweep the diff and the commit messages, then push main.
- [ ] **Step 9:** Remove the worktree, the branch and the workspace.
