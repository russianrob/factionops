# Genocide Marks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On the faction info tab (`factions.php?step=your&type=1#/tab=info`), FactionOps puts a small mark next to each member: one for members who hold the Genocide honor, another for members confirmed not to hold it, and nothing for members nobody knows about.

**Architecture:** The server learns who has Genocide from two sources and serves the result:
- **Faction hits:** Torn's chain reports list each chain's bonus hits, and any bonus worth 1,000+ respect earns the honor. History comes from the daily faction-history tick. The running chain comes from the no-id `/v2/faction/chainreport` every 30 min.
- **Members' self-checks:** each member's FactionOps reads its own honors with its own key once a day and posts yes/no.

FactionOps 5.6.29 fetches the merged list and marks the rows.

**Tech Stack:** Node (ESM, Express routes, `node --test`), linkedom for DOM tests, the FactionOps userscript (Tampermonkey/PDA).

**Spec:** The owner's ask (10-28 21:51 EDT, "a script that marks it on the faction info page") and the four picks they accepted with "go":
- **Q1:** mark both members who hold Genocide and members confirmed not to.
- **Q2:** each member's FactionOps checks its own owner's honors once a day with that member's own key, and shares only yes/no with the faction. A line in FactionOps tells members what it shares.
- **Q3:** every member who runs FactionOps sees the marks.
- **Q4:** release after the war unless the owner says "ship before".

## Global Constraints

**Facts:**
- Genocide is honor 478: "Make a single hit that earns your faction 1,000 or more respect".
- Chain bonuses are fixed: the 1,000th pays 640, the 2,500th 1,280, the 5,000th 2,560 and the 10,000th 5,120.
- So `GENOCIDE_RESPECT = 1000` and `GENOCIDE_MIN_CHAIN = 2500`.

**The public repo:**
- Fixtures use made-up ids (1000001…), made-up chain ids (900001…) and made-up counts.
- No live values, no key endings, no hosting-provider names, and none of the words the pre-push sweep bans.

**Torn:**
- At most 100 calls a minute on a shared key. Server calls go through faction-history's paced `tornGet`.
- Torn stays read-only, with no non-API Torn requests.
- A member's self-check uses only that member's key: at most one success a day, and at most one try an hour.

**FactionOps:**
- `@version`, `SCRIPT_VERSION` and `factionops.meta.js` change together, and the meta file is the header verbatim.
- No changelog in the script.
- The new setting is stored as the strings `'1'`/`'0'`, because PDA hands GM values back as strings.

**Server:**
- Only the server process writes `data/genocide-<factionId>.json`.
- Tests use tmp dirs and injected fetchers, never the real key or live data, and never import `server.js`.

**Release:**
- Held until after the war (Q4) unless the owner says "ship before".
- `public/scripts` is served from main's checkout, so nothing merges to main before release.
- A probe of the info-tab DOM on the owner's device is a hard gate.

**Comments:** clear `//` comments at the surrounding density.

## Review Focus

1. **Torn's info-tab rows may not match the selector union.** Then a row gets no mark, or a wrapper gets one too. Wanted: exactly one mark per member row, never inside `.honor-text-wrap`. Task 4's probe pins the real structure into a linkedom fixture before release.
2. **A failed honors call must not post a "no".** Covers a bad key, a Torn error body, or a PDA string reply. Wanted: nothing posted, retry in an hour (Task 3 `genocideFromHonors` error cases).
3. **A self "no" older than a fresh faction hit must show "has it"** (Task 1 `genocideView`).
4. **A bonus hit in a chain's last 30 minutes,** after which the live scan only sees the next chain. Wanted: the daily scan still reads the finished chain once (Task 1 `chainsToScan`: a chain the live scan saw is not "scanned").
5. **A self-report landing while a scan awaits Torn must survive the scan's save** (Task 1 lost-update test).

---

### Task 1: server/genocide.js — holders, store and scans

**Files:**
- Create: `server/genocide.js`
- Modify: `server/faction-history.js` (add one export beside `fetchAllChains`)
- Test: `server/genocide.test.mjs`

**Interfaces:**
- Consumes: `v2(path, key)` inside faction-history.js (paced, throws on a Torn error).
- Produces:
  - **faction-history.js:** `fetchChainReport(key, chainId) -> Promise<object|null>`. `chainId` null means the latest chain (running or last finished).
  - **genocide.js constants:** `GENOCIDE_RESPECT = 1000`, `GENOCIDE_MIN_CHAIN = 2500`, `FINISHED_GRACE_S = 3600`, `LIVE_SCAN_MS = 30 * 60 * 1000`, `LIVE_BOOT_DELAY_MS = 6 * 60 * 1000`.
  - **genocide.js functions:**
    - `bonusHolders(report) -> [{id, hit, respect, chainId, start}]`, with `id` and `chainId` as strings.
    - `foldHits(store, holders) -> number`, the members added or moved to an earlier hit.
    - `parseSelfReport(body) -> {has: true|false|null, at: number|null} | null`. `has: null` withdraws the member's report.
    - `foldSelf(store, playerId, report, nowS)`.
    - `genocideView(store) -> {[id]: {has:true, via:'hit', hit, start} | {has:true, via:'self', at} | {has:false, checkedAt}}`.
    - `chainsToScan(chains, store, nowS) -> string[]`.
    - `genocideStore(factionId, dir = DATA_DIR)`, cached per `dir|factionId`, so every writer mutates one object.
    - `saveGenocide(factionId, dir = DATA_DIR)`.
    - `recordSelfReport(factionId, playerId, report, nowS, dir = DATA_DIR)`.
    - `genocideMembers(factionId, dir = DATA_DIR)`.
    - `scanFinishedChains(fetchReport, factionId, chains, {nowS, dir, budget = 60}) -> {fetched, found}`.
    - `scanLiveChain(fetchReport, factionId, {dir}) -> found`.
    - `startGenocideSchedule()`.
  - **Store shape:** `{hits: {id: {hit, respect, chainId, start}}, scanned: {chainId: 1}, self: {id: {has, at, checkedAt}}}`.

- [ ] **Step 1: Write the failing tests** in `server/genocide.test.mjs`:

```js
const REPORT = { id: 900001, start: 1700000000, bonuses: [
  { attacker_id: 1000001, chain: 1000, respect: 640 },
  { attacker_id: 1000002, chain: 2500, respect: 1280 },
  { attacker_id: 1000003, chain: 5000, respect: 2560 } ] };
test('bonusHolders keeps the bonuses worth 1,000 respect or more', () => {
  assert.deepEqual(bonusHolders(REPORT), [
    { id: '1000002', hit: 2500, respect: 1280, chainId: '900001', start: 1700000000 },
    { id: '1000003', hit: 5000, respect: 2560, chainId: '900001', start: 1700000000 }]);
  assert.deepEqual(bonusHolders({ id: 1 }), []);
  assert.deepEqual(bonusHolders(null), []);
});
test('foldHits keeps each member\'s earliest qualifying hit', () => { /* fold a later chain for 1000002 → unchanged, returns 0; an earlier one → replaced, returns 1 */ });
test('parseSelfReport takes true, false or null and nothing else', () => {
  assert.deepEqual(parseSelfReport({ genocide: true, awardedAt: 1690000000 }), { has: true, at: 1690000000 });
  assert.deepEqual(parseSelfReport({ genocide: false, awardedAt: 1690000000 }), { has: false, at: null });
  assert.deepEqual(parseSelfReport({ genocide: null }), { has: null, at: null });
  assert.deepEqual(parseSelfReport({ genocide: true, awardedAt: 'x' }), { has: true, at: null });
  for (const b of [{}, { genocide: 'true' }, { genocide: 1 }, null]) assert.equal(parseSelfReport(b), null);
});
test('genocideView: a faction hit beats a self "no", a self "yes" counts, a "no" carries its date, a withdrawal forgets', () => { /* hit+self no → {has:true,via:'hit',hit,start}; self yes → {has:true,via:'self',at}; self no → {has:false,checkedAt}; foldSelf(..., {has:null}) → id absent */ });
test('chainsToScan: 2,500+ hits, finished over an hour ago, not yet scanned, once per id', () => {
  const now = 1800000000;
  const chains = [
    { id: 900010, chain: 2510, end: now - 7200 }, { id: 900010, chain: 2510, end: now - 7200 },
    { id: 900011, chain: 2499, end: now - 7200 }, { id: 900012, chain: 5020, end: now - 600 },
    { id: 900013, chain: 2600, end: now - 9000 }];
  const store = { hits: {}, scanned: { 900013: 1 }, self: {} };
  assert.deepEqual(chainsToScan(chains, store, now), ['900010']);
});
test('scanFinishedChains fetches due chains, marks them scanned, keeps a failed one for next time, and saves', async () => { /* tmp dir; fetcher throws for one id; file genocide-<fid>.json holds hits + scanned */ });
test('scanLiveChain folds the latest report without marking it scanned', async () => { /* fetcher(null) → REPORT; store.scanned has no 900001 */ });
test('a self-report made while a scan waits on Torn survives the scan\'s save', async () => { /* fetcher awaits a promise; recordSelfReport during it; after resolve the file holds both */ });
test('a corrupt store file loads as empty', () => { /* write "{" to genocide-<fid>.json in a tmp dir → genocideMembers → {} */ });
```

- [ ] **Step 2: Run, expect FAIL** (`cd server && node --test genocide.test.mjs`): cannot find module `./genocide.js`.
- [ ] **Step 3: Implement** `server/genocide.js` with the signatures above.
  - `DATA_DIR = process.env.DATA_DIR || "./data"`; the file is `genocide-<factionId>.json`.
  - Writers mutate the cached store and call `saveGenocide`.
  - Scans log `[genocide] chain report <id>: <message>` on a failed fetch.
  - `startGenocideSchedule()`:
    - does nothing without `OWNER_API_KEY`;
    - otherwise runs a `setTimeout(LIVE_BOOT_DELAY_MS)` and then a `setInterval(LIVE_SCAN_MS)`;
    - each run calls `scanLiveChain((id) => fetchChainReport(key, id), OWNER_FACTION_ID || "42055", {})`;
    - each run logs one line when it finds a new holder.
  - Add `fetchChainReport(key, chainId)` to faction-history.js: `chainreport?id=<id>`, or `chainreport` when the id is null. It returns `.chainreport || null`.
- [ ] **Step 4: Run, expect PASS** (all tests in the file).
- [ ] **Step 5: Commit** `server/genocide.js server/genocide.test.mjs server/faction-history.js`, with the message "Genocide marks: holders from chain reports and members' own checks".

### Task 2: server wiring — routes, the daily step, the live schedule

**Files:**
- Modify: `server/routes.js` (beside `POST /api/chain-page`)
- Modify: `server/faction-history-schedule.js` (`tick`)
- Modify: `server/server.js` (next to `startFactionHistorySchedule()`)
- Test: `server/genocide.test.mjs` (append wiring checks)

**Interfaces:**
- Consumes: Task 1's `parseSelfReport`, `recordSelfReport`, `genocideMembers`, `scanFinishedChains`, `startGenocideSchedule`, and `fh.fetchChainReport`.
- Produces:
  - `POST /api/me/honors` (requireAuth). Body `{genocide: true|false|null, awardedAt?}`. Answers `{ok:true}`, or 400 `{error}`.
  - `GET /api/genocide` (requireAuth). Answers `{members: genocideView}` for `req.user.factionId`, or `{}` without one.

- [ ] **Step 1: Write the failing wiring tests** (text checks, since tests never import server.js):

```js
const ROUTES = readFileSync(new URL('./routes.js', import.meta.url), 'utf8');
test('the routes: a member posts their own answer, and reads their faction\'s list', () => {
  assert.match(ROUTES, /router\.post\("\/api\/me\/honors", requireAuth,/);
  assert.match(ROUTES, /router\.get\("\/api\/genocide", requireAuth,/);
  assert.match(ROUTES, /parseSelfReport\(req\.body \|\| \{\}\)/);
  assert.match(ROUTES, /res\.status\(400\)/);
});
test('the daily faction-history tick reads finished big chains from the chain list it already fetched', () => {
  const S = readFileSync(new URL('./faction-history-schedule.js', import.meta.url), 'utf8');
  assert.match(S, /scanFinishedChains\(\(id\) => fh\.fetchChainReport\(key, id\), factionId, chains/);
});
test('the server starts the live scan', () => {
  assert.match(readFileSync(new URL('./server.js', import.meta.url), 'utf8'), /^startGenocideSchedule\(\);$/m);
});
```

- [ ] **Step 2: Run, expect FAIL** (three assertion failures).
- [ ] **Step 3: Implement.**
  - **Routes:** add both routes. The POST stores under `req.user.factionId` with `String(playerId)` and logs `[genocide] self player=<id> has=<value>`.
  - **Daily tick:** hoist `let chains = [];` above the chainreports step, then add its own try/catch step after it: `genocide +<fetched> reports, <found> holders`, or `genocide failed: <msg>`.
  - **server.js:** `import { startGenocideSchedule } from "./genocide.js";` and call it after `startFactionHistorySchedule();`.
- [ ] **Step 4: Run** `node --test genocide.test.mjs`. Expect PASS. Also run `node -e "import('./genocide.js')"` from `server/`. Expect exit 0.
- [ ] **Step 5: Commit** routes.js, faction-history-schedule.js, server.js and the test, with the message "Genocide marks: the member routes, the daily step and the live scan".

### Task 3: FactionOps 5.6.29 — the setting, the self-check, the marks

**Files:**
- Modify: `server/public/scripts/factionops.user.js`: CONFIG (~124), `setConfig` keys (~167), auth success (~7132, beside `startEnergyPoll()`), the settings row (~8391), its handler (~8681), and init (~12232). The new section sits after `startEnergyPoll`'s block.
- Modify: `server/public/scripts/factionops.meta.js`.
- Modify: `server/factionops-chain-bar.test.mjs:220-229`, the version test: 5.6.28 → 5.6.29.
- Test: `server/factionops-genocide.test.mjs`. Use the `fn()`/`konst()` text-extraction pattern from factionops-chain-bar.test.mjs, plus linkedom.

**Interfaces:**
- Consumes: `GET /api/genocide` and `POST /api/me/honors` from Task 2. Torn `/v2/user/honors?key=` answers `{honors: [{id, timestamp}]}`.
- Produces (script-internal):
  - **Constants:** `GENOCIDE_HONOR_ID = 478`, `GENOCIDE_CHECK_MS = 24h`, `GENOCIDE_RETRY_MS = 1h`, `GENOCIDE_LIST_MS = 10 min`.
  - **Setting:** `CONFIG.SHARE_GENOCIDE`, either `'1'` or `'0'`, default `'1'`.
  - **Pure functions:**
    - `genocideFromHonors(data) -> {has, at} | null`;
    - `genocideCheckDue(now, lastOk, lastTry) -> boolean`;
    - `isFactionInfoTab(loc) -> boolean`;
    - `genocideBadge(entry) -> {cls, text, title} | null`.
  - **DOM functions:**
    - `findGenocideRows(doc) -> [{row, id}]`;
    - `placeGenocideBadge(row, el)`;
    - `markGenocideRows(doc, members) -> number`;
    - `clearGenocideBadges(doc)`.
  - **Runtime:** `selfCheckGenocide(now)` and `startGenocideMarks()`.

- [ ] **Step 1: Write the failing tests** in `server/factionops-genocide.test.mjs`:

```js
test('genocideFromHonors reads honor 478 and its date, and refuses anything else', () => {
  assert.deepEqual(L().genocideFromHonors({ honors: [{ id: 12, timestamp: 1 }, { id: 478, timestamp: 1690000000 }] }), { has: true, at: 1690000000 });
  assert.deepEqual(L().genocideFromHonors({ honors: [{ id: 12, timestamp: 1 }] }), { has: false, at: null });
  for (const d of [{ error: { code: 2 } }, {}, null, 'Unauthorized', { honors: 'x' }]) assert.equal(L().genocideFromHonors(d), null);
});
test('genocideCheckDue: a day after the last success, and never twice in an hour', () => {
  const H = 3600000, now = 100 * 24 * H;
  assert.equal(L().genocideCheckDue(now, 0, 0), true);
  assert.equal(L().genocideCheckDue(now, now - 23 * H, 0), false);
  assert.equal(L().genocideCheckDue(now, now - 25 * H, now - 30 * 60000), false);
  assert.equal(L().genocideCheckDue(now, now - 25 * H, now - 2 * H), true);
});
test('isFactionInfoTab: your faction\'s info tab only', () => {
  const t = (pathname, search, hash) => L().isFactionInfoTab({ pathname, search, hash });
  assert.equal(t('/factions.php', '?step=your&type=1', '#/tab=info'), true);
  for (const h of ['', '#', '#/']) assert.equal(t('/factions.php', '?step=your', h), true);
  assert.equal(t('/factions.php', '?step=your&type=1', '#/war/rank'), false);
  assert.equal(t('/factions.php', '?step=your', '#/tab=armoury'), false);
  assert.equal(t('/factions.php', '?step=profile&ID=1', ''), false);
  assert.equal(t('/profiles.php', '?XID=1000001', ''), false);
});
test('genocideBadge: who has it and how, who is confirmed not to, nothing for unknown', () => {
  const hit = L().genocideBadge({ has: true, via: 'hit', hit: 2500, start: 1700000000 });
  assert.equal(hit.cls, 'fo-geno fo-geno-yes'); assert.match(hit.title, /2,500th hit/); assert.match(hit.title, /2023-11-14/);
  assert.match(L().genocideBadge({ has: true, via: 'self', at: 1690000000 }).title, /awarded 2023-07-22/);
  const no = L().genocideBadge({ has: false, checkedAt: 1700000000 });
  assert.equal(no.cls, 'fo-geno fo-geno-no'); assert.match(no.title, /checked 2023-11-14/);
  assert.equal(L().genocideBadge(undefined), null);
});
test('markGenocideRows: one mark per member row, kept in step with the list, never inside the honor bar', () => {
  /* linkedom page: ul.members-list > li.table-row > div.member > (div.honor-text-wrap > a[href="/profiles.php?XID=1000001"]); a second row 1000002; a third with no XID link.
     first call → 2 marks; second call → still 2 (idempotent); entry for 1000002 → has:false → its mark's class flips; entry removed → mark removed;
     no .fo-geno inside .honor-text-wrap; clearGenocideBadges → 0 left */
});
test('the setting: stored as a string, on unless a member turns it off', () => {
  /* eval the CONFIG line's SHARE_GENOCIDE expression with GM_getValue stubbed: undefined/'1' → '1'; '0' → '0' */
  /* SRC has setConfig key SHARE_GENOCIDE: 'factionops_share_genocide', the row id wb-toggle-share-genocide with the disclosure text, and the handler writes '1'/'0' and posts {genocide: null} when turned off */
});
test('the wiring: the self-check runs on sign-in, the marks only on factions.php', () => {
  /* auth-success block contains selfCheckGenocide(Date.now()) next to startEnergyPoll(); init calls startGenocideMarks(); startGenocideMarks returns early unless location.pathname === '/factions.php' */
});
```

- [ ] **Step 2: Run, expect FAIL** (`node --test factionops-genocide.test.mjs`): `genocideFromHonors not found`.
- [ ] **Step 3: Implement**, in the script's idiom.
  - **The setting:**
    - CONFIG gets `SHARE_GENOCIDE: (String(GM_getValue('factionops_share_genocide', '1')) === '0') ? '0' : '1'`.
    - setConfig gets the key.
    - The Preferences row reads "Share whether I have Genocide with my faction", with a hint line under it: "Once a day FactionOps reads your honors with your own key. Your faction sees only yes or no, on the faction info page."
    - The handler turns it on by clearing both timestamps and checking now, and turns it off by posting `{genocide: null}`.
  - **`selfCheckGenocide(now)`:**
    - It needs `SHARE_GENOCIDE === '1'`, `CONFIG.API_KEY`, `state.jwtToken`, and `genocideCheckDue` over the GM strings `factionops_genocide_ok` and `factionops_genocide_try`.
    - It writes `try`, makes one `httpRequest` GET to `https://api.torn.com/v2/user/honors?key=…&comment=factionops-honors`, and posts only on a non-null answer.
    - It writes `ok` on the post's success.
  - **The marks:**
    - Badge text is `G`.
    - `.fo-geno-yes` is a dark-red pill and `.fo-geno-no` a green-outlined pill, about 9px bold, inline after the member cell's content.
    - Dates are `YYYY-MM-DD` TCT.
    - `findGenocideRows` takes the profile links (`a[href*="XID="]`) inside `.members-list, .faction-info-members, .members-cont`. Each row is the link's closest `li`, or else its closest `.table-row`, deduped.
    - `placeGenocideBadge` appends to `row.querySelector('.member') || row`.
  - **Startup:** `startGenocideMarks()` is idempotent and runs only on `/factions.php`. It uses a 2 s interval:
    - Off the info tab, it clears the marks.
    - Signed in, it refetches `getAction('/api/genocide')` every `GENOCIDE_LIST_MS`, one request at a time.
    - It then marks.
  - **The version:** bump to 5.6.29 in all three places, and update the chain-bar version test.
- [ ] **Step 4: Run, expect PASS:** `node --test factionops-genocide.test.mjs factionops-chain-bar.test.mjs`. Then `node --check public/scripts/factionops.user.js` should exit 0.
- [ ] **Step 5: Commit** the script, the meta file and both test files, with the message "FactionOps 5.6.29: mark who has Genocide on the faction info tab".

### Task 4: release (GATED: after the war unless the owner says "ship before")

- [ ] **Step 1: The device probe (hard gate).** With the owner's Warboard app on the faction info tab, run one read-only inspector command. It returns, for the first two member rows:
  - the row's tag and classes, and each child cell's classes;
  - where the XID links sit;
  - whether `.honor-text-wrap`, FFS chips or `.foh-badge` are present.

  Rebuild the linkedom fixture in `factionops-genocide.test.mjs` from that result, and adjust `findGenocideRows`/`placeGenocideBadge` only if it differs. RED→GREEN on any change.
- [ ] **Step 2: Merge and deploy** under the standing OK.
  - Fast-forward main and chown the served scripts to warboard:warboard 644.
  - Run the whole suite on main.
  - Run `pm2 reload warboard` and check health (local `/api/health`, `/health`, public `/api/health`).
  - Check the served 5.6.29 sha against disk.
  - Check the `[genocide]` lines after the boot delay and the `[fachist/daily]` summary.
- [ ] **Step 3: Sweep, then push.** Run the 16-char runs check, sweep-env and sweep-names over the diff and the messages, then `ls-remote` to confirm. Give the owner the served URL with the version.
