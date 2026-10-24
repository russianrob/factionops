# Blood-bag board: history loads slowly during a ranked war (implementation plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The one-year history keeps loading while a ranked war is live, at 2 calls a minute instead of stopping, so "All time" and the longer timeframes fill in during war 51418 rather than after it.

**Architecture:**
- The backfill in `server/blood-bags.js` gets its own war pace. Before each page, a new `warPace()` checks the war list. While a ranked war is live, or the list is too old or unread to say, it waits until 30 s after the previous backfill page. Otherwise it doesn't wait, and the shared `pace()` keeps every call at least 6 s apart, as now.
- The 30 s wait happens outside `pace()`, so the hourly poll's calls still go out 6 s apart, in between the backfill's pages.
- One log line marks each change of pace.
- The page's note under the board says that the history is filling in slowly during a war.

**Tech Stack:** Node 20 ES modules in the existing Express server; `node:test` and `node:assert/strict`; Python 3 for exact text edits; Torn API v2 `/faction/news` for the release check.

**Spec:** `docs/superpowers/specs/2026-10-24-faction-blood-bag-board-design.md` (last amended in fe7ab97a). This plan changes decision Q14 there.
- On 2026-10-24 at 07:12 EDT the owner chose option b: "Load history slowly during the war: about 2 calls a minute, about 11 h."
- At 11:04 EDT they said "yes" to the in-chat design and to all three recommendations:
  - Q1: a war list that can't be read counts as a war, so the backfill goes at the war pace rather than waiting.
  - Q2: the new note wording.
  - Q3: the same rule applies during every war.

## Global Constraints

Repo paths are relative to `/opt/warboard`.

**From the spec and the owner's answers**
- The backfill makes no more than 10 calls a minute: every collector call is at least `GAP_MS` = 6,000 ms after the one before.
- While a ranked war is live, backfill pages are at least `WAR_GAP_MS` = 30,000 ms apart, which is 2 a minute. That covers the action and deposit categories together.
- Once the hourly read of the war list shows the war is over, the backfill goes back to 10 a minute.
  - A live war is one in the list that has started (`start` set and `start <= now`) and has not ended (`end` is 0 or still to come).
  - That is `liveWar` in `server/blood-bags-model.js`, unchanged.
- A war list more than `WARS_FRESH_MS` (65 minutes) old, or one that was never read or couldn't be read, counts as a war (Q1).
- The hourly poll is never slowed by the war pace.
- The log lines are exactly:
  - `[blood-bags] backfill slowed to 2 calls a minute: ranked war <id> is live`
  - `[blood-bags] backfill slowed to 2 calls a minute: the ranked-war list has not been read in the last hour`
  - `[blood-bags] backfill back to 10 calls a minute: no ranked war is live`
  - One is logged each time the pace changes, or the reason for the slow pace changes; never one per page.
- The note during a war is exactly: `History so far reaches back to <d Mon>; the rest of the year is still being filled in, slowly while the ranked war is on.` Outside a war it stays `...; the rest of the year is still being filled in.` (Q2)
- The rule applies during every ranked war and to every backfill gap (Q3).

**Code rules**
- ES modules, 2-space indent, double quotes, present-tense `//` comments, no version numbers or "used to" history in comments. Match the code around it.
- The page script is ES5 and the whole page is ASCII.
- Tests never touch the live data folder: `blood-bags.test.js` already sets `process.env.DATA_DIR` to a fresh `mkdtemp` folder before importing.

**Where the work happens**
- `server/` is the live tree. pm2 loads `server/blood-bags.js` only at start, so installing it changes nothing until Task 3's reload. `server/blood-bags-page.js` re-reads `server/pages/bloodbags.html` when the file changes, so installing the page puts it live at once (ruling 7).
- The work happens in an overlay, `$WS/ov`, with `WS=/opt/warboard/.superpowers/sdd/2026-10-24-blood-bag-war-pace`. That is the git-ignored workspace `sdd-workspace` prints for this plan. Shell state doesn't carry between commands, so each block sets `WS`.
  - Real copies in the overlay: `blood-bags.js`, `blood-bags.test.js`, `blood-bags-page.js`, `blood-bags-page.test.js` and `pages/bloodbags.html`.
  - Symlinks to `server/`: `node_modules`, `auth.js`, `key-usage-log.js`, `store.js`, `torn-api.js`, `routes.js`, `server.js` and `blood-bags-model.js`.
  - `blood-bags-page.js` must be a real copy. Node resolves an ES module symlink to its real path, so a symlinked copy would read `server/pages/bloodbags.html` instead of the overlay's.
- Each test goes red and then green in the overlay. Only then are its files installed into `server/` with `install -o root -g root -m 644`, run in place, and committed. That way `server/` only ever holds passing tests: another session's `deploy.sh` runs the whole suite and refuses to deploy on any failure.
- Never create `server/data/blood-bags/` or write to it: the server process owns it.
- Work is on `main`: one commit per code task, and the push in Task 3.

**Repo and box**
- The repo (factionops.git) is public. Commit no secrets, no key endings and no member data.
- Stage only this plan's paths with `git commit -- <paths>`. Leave other sessions' changes alone, among them `server/data/rwp-prices.json`, `server/public/river9-watch.txt` and `server/public/s/`.
- Never print git remotes or git config in `/opt/warboard`: the remote URL holds a token. Mask push output with `sed -E 's#//[^@]*@#//***@#g'`.
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- The owner's key is `OWNER_API_KEY` in `server/.env`. Read it inline (`KEY=$(grep '^OWNER_API_KEY=' /opt/warboard/server/.env | cut -d= -f2-)`), send it only in the Authorization header, and never print it. Task 3's check makes about 13 Torn calls, one a second; Torn allows 100 a minute.
- The box is shared and live; a load of about 8 is normal.
  - Check `uptime` before the suite or a deploy, and wait if it's over 12.
  - `rm` on a variable path is blocked.
  - Run Python with `-I`.
  - Subagents use `model: "opus"`.
  - There are no foreground `sleep` loops: wait in a background command.
  - Live logs come from `pm2 logs warboard --nostream`; they are kept in `/var/log/warboard/`, not `~/.pm2/logs`.
- Times for the owner are in EDT; the box's clock is CEST, 6 hours ahead.

## Review Focus

These are the conditions most likely to bite once this ships. Each one has a test in the task that owns the code.

1. **A war that ends during the backfill.** A run at the war pace lasts hours. Once the hourly read shows the war is over, the next pages go 6 s apart, without waiting for the run to end. Task 1 test: "while a ranked war is live the backfill takes a page every 30 seconds, and goes back to every 6 once the war list shows it over".
2. **The hourly poll beside a slow backfill.** The poll's two calls must not be held 30 s apart, or "Latest update" would lag. Task 1 test: "during a war the backfill's slower pace never holds up the hourly poll". It uses a clock that moves only when the test moves it, so the backfill's waits don't land between the poll's calls.
3. **A war list that can't be read, or comes back without its list.** The backfill goes at the war pace: it doesn't wait as before, and it doesn't go at full speed. Task 1 tests: "while the ranked-war list cannot be read, the backfill goes on at the war pace" and "a ranked-war reply without its list is a failed read, not a list of no wars".
4. **Log volume.** About 1,300 pages must not mean 1,300 log lines. That is asserted in Review Focus 1's and 3's tests: each pace line appears exactly once.
5. **The note when the war state changes.** During a war it says the history is filling in slowly; outside one it doesn't. Task 2 test: "the note says when there is no data yet, and how far back the history reaches while it fills in".

## Rulings made at plan time

1. **The war pace covers both categories together**, 2 pages a minute in all, as the owner was told. The wait belongs to the backfill alone and sits outside `pace()`.
2. **`lastPageAt` is taken after each page comes back**, not before it is asked for. `pace()` can hold a call for 6 s or more, and this way two pages' call times are never less than 30 s apart.
3. **After a restart during a war, the first page goes at once.** The backfill's own clock starts empty, so after that first page it goes every 30 s. That is one call, never a burst.
4. **A war list that was never read, can't be read, or is more than 65 minutes old counts as a war (Q1).** Its log line keeps the review fix's wording, "the ranked-war list has not been read in the last hour".
5. **A pace line is logged when the pace or the reason for the slow pace changes**, never per page.
   - The line last logged is kept in memory, so after a restart the first page logs it again.
   - "back to 10 calls a minute" only ever follows a slow stretch.
6. **Three collector tests and one page assertion change on purpose.** Each pinned the old wait or the old wording.
   - The collector tests are "the backfill waits while a ranked war is live and carries on after it", "the backfill waits while the ranked-war list cannot be read, and goes on once it can", and the last assertion of "a ranked-war reply without its list is a failed read, not a list of no wars".
   - The page assertion is the war case in the note test.
7. **The new note goes live when Task 2 installs it**, before the final review and Task 3's reload.
   - For that stretch, likely under an hour, it says the history is filling in slowly while the old code still waits for the war to end.
   - Holding it back would mean committing a file other than the one being served.
8. **The final review runs between Task 2 and Task 3**, so nothing unreviewed is deployed. Task 3 starts only after the review's fix pass.
9. **The live check reads Torn in windows that never come back full.** Actions are read 2 hours at a time, and a window that does come back full is split in two and read again. So the check shares none of the collector's page-edge logic, and checks the first day the backfill fills independently.

## Files

| File | Task | What changes |
|---|---|---|
| `server/blood-bags.js` | 1 | `WAR_GAP_MS`, `warPace()`, the backfill loop, four comments. |
| `server/blood-bags.test.js` | 1 | Three helpers, two tests replaced, one assertion changed, one test added (26 → 27 tests). |
| `server/pages/bloodbags.html` | 2 | The war wording in `noteText`. |
| `server/blood-bags-page.test.js` | 2 | The war case of the note test. |
| `docs/superpowers/specs/2026-10-24-faction-blood-bag-board-design.md` | 1, 2 | Q14 and the backfill text (Task 1), the edge case about the note (Task 2). |

---

### Task 1: The backfill's war pace

**Files:**
- Modify: `server/blood-bags.js`:
  - the header comment (lines 5–8);
  - a new constant after `GAP_MS` (line 31);
  - the `WARS_FRESH_MS` comment (lines 38–39);
  - the closure state (lines 80–81);
  - the `refreshWars` comment (lines 306–307);
  - a new `warPace()` before `backfill()` (line 330);
  - the backfill loop (lines 336–348);
  - the `runBackfill` doc comment (lines 365–368).
- Test: `server/blood-bags.test.js`
- Modify: the spec, lines 3, 29, 96, 98, 100, 158 and 167.

**Interfaces:**
- Consumes:
  - from `server/blood-bags-model.js`: `liveWar(wars, nowSec)`, which returns `{ id, start }` or null;
  - from inside the collector: `data.wars`, `data.warsAt` (ms, 0 in a new store), `WARS_FRESH_MS`, `sleepFn(ms)`, `nowFn()`, `nowSec()`, `log(msg)` and `walk(cat, from, to, maxPages)`.
- Produces: `export const WAR_GAP_MS = 30000` from `server/blood-bags.js`, imported by the tests. Nothing else changes outside the module.

- [ ] **Step 1: Make the workspace and the overlay**

The executing-plans setup runs `sdd-workspace` for this plan from inside `/opt/warboard`. It must print `/opt/warboard/.superpowers/sdd/2026-10-24-blood-bag-war-pace`. Then:

```bash
WS=/opt/warboard/.superpowers/sdd/2026-10-24-blood-bag-war-pace
S=/opt/warboard/server
mkdir -p $WS/ov/pages $WS/tools $WS/fixes
cp $S/blood-bags.js $S/blood-bags.test.js $S/blood-bags-page.js $S/blood-bags-page.test.js $WS/ov/
cp $S/pages/bloodbags.html $WS/ov/pages/
for f in node_modules auth.js key-usage-log.js store.js torn-api.js routes.js server.js blood-bags-model.js; do ln -s $S/$f $WS/ov/$f; done
cd $WS/ov && node --test blood-bags.test.js blood-bags-page.test.js 2>&1 | grep -E '^# (tests|pass|fail)'
```

Expected: `# tests 40`, `# pass 40`, `# fail 0`.

- [ ] **Step 2: Write the failing tests**

```bash
WS=/opt/warboard/.superpowers/sdd/2026-10-24-blood-bag-war-pace
python3 -I - $WS/ov/blood-bags.test.js <<'PY'
import sys
p = sys.argv[1]
s = open(p, encoding="utf-8").read()
def rep(old, new):
    global s
    assert s.count(old) == 1, ("not exactly once", old[:70])
    s = s.replace(old, new)
def replace_test(name, new):
    global s
    head = 'test("' + name + '"'
    assert s.count(head) == 1, ("test not found once", name)
    start = s.index(head)
    end = s.index("\n});\n", start) + len("\n});\n")
    s = s[:start] + new.strip("\n") + "\n" + s[end:]

rep('const { createBloodBagCollector, GAP_MS, HEAD_MAX_PAGES } = await import("./blood-bags.js");',
    'const { createBloodBagCollector, GAP_MS, WAR_GAP_MS, HEAD_MAX_PAGES } = await import("./blood-bags.js");')

rep(r'''  .filter((e) => e.timestamp >= fromSec && /Blood Bag :/.test(e.text) && !/Irradiated/.test(e.text)).length;
''', r'''  .filter((e) => e.timestamp >= fromSec && /Blood Bag :/.test(e.text) && !/Irradiated/.test(e.text)).length;
// The backfill's own pages: they walk the year's gap, so they ask from its floor.
const backfillPages = (t) => newsCalls(t).filter((call) => call.url.searchParams.get("from") === String(CUTOFF));
// How long after the call before it each call came, in ms.
const between = (calls) => calls.slice(1).map((call, i) => call.at - calls[i].at);
''')

replace_test("the backfill waits while a ranked war is live and carries on after it", r'''
test("while a ranked war is live the backfill takes a page every 30 seconds, and goes back to every 6 once the war list shows it over", async () => {
  const torn = fakeTorn({ action: actions(1000, T0 - 60, Math.round(0.3 * DAY)), deposit: [], wars: [{ id: 51418, start: T0 - DAY, end: 0 }] });
  const { c, clock, logs } = setup({ torn });
  await c.pollOnce();
  await c.refreshWars();
  // At the third backfill page the war ends, and a read of the list says so.
  let reread = null;
  torn.fail = () => {
    if (!reread && backfillPages(torn).length === 3) {
      torn.wars[0].end = Math.floor(clock.now / 1000);
      reread = c.refreshWars();
    }
    return null;
  };
  await c.runBackfill();
  await reread;
  const pages = backfillPages(torn);
  const gaps = between(pages);
  assert.ok(pages.length >= 7, `${pages.length} backfill pages`);
  assert.ok(gaps.slice(0, 2).every((ms) => ms >= WAR_GAP_MS), `during the war: ${gaps}`);
  assert.ok(gaps.slice(-3).every((ms) => ms >= GAP_MS && ms < WAR_GAP_MS), `after it: ${gaps}`);
  const said = (text) => logs.filter((m) => m.includes(text)).length;
  assert.equal(said("backfill slowed to 2 calls a minute: ranked war 51418 is live"), 1, logs.join("\n"));
  assert.equal(said("backfill back to 10 calls a minute: no ranked war is live"), 1, logs.join("\n"));
  const snap = c.snapshot();
  assert.equal(snap.backfillDone, true);
  assert.equal(snap.lines.length, bloodIn(torn, CUTOFF));
});
''')

replace_test("the backfill waits while the ranked-war list cannot be read, and goes on once it can", r'''
test("while the ranked-war list cannot be read, the backfill goes on at the war pace", async () => {
  const torn = fakeTorn({ action: actions(1000, T0 - 60, Math.round(0.3 * DAY)), deposit: [], wars: [{ id: 51418, start: T0 - DAY, end: 0 }] });
  torn.fail = (u) => (u.pathname.endsWith("/rankedwars") ? reply({ error: { code: 5, error: "Too many requests" } }) : null);
  const { c, logs } = setup({ torn });
  await c.pollOnce();
  assert.equal(await c.refreshWars(), false);
  await c.runBackfill();
  const pages = backfillPages(torn);
  assert.ok(pages.length >= 7, `${pages.length} backfill pages: it goes on rather than waiting`);
  assert.ok(between(pages).every((ms) => ms >= WAR_GAP_MS), `a list it could not read counts as a war: ${between(pages)}`);
  const said = logs.filter((m) => m.includes("backfill slowed to 2 calls a minute: the ranked-war list has not been read in the last hour"));
  assert.equal(said.length, 1, logs.join("\n"));
  assert.equal(c.snapshot().backfillDone, true);
});
''')

rep(r'''  await c.tick(); await c.runBackfill();
  assert.equal(newsCalls(torn).length, 2, "no backfill call on a war list that was not read");
''', r'''  await c.tick(); await c.runBackfill();
  const pages = backfillPages(torn);
  assert.ok(pages.length >= 3, `${pages.length} backfill pages`);
  assert.ok(between(pages).every((ms) => ms >= WAR_GAP_MS), `taken as no wars, the list would let it run at full speed: ${between(pages)}`);
''')

s = s.rstrip("\n") + "\n" + r'''
// ── the war pace ────────────────────────────────────────────────────────────
// A clock that moves only when the test moves it, so a slow backfill and a poll
// can run side by side without one's waits counting as the other's.
function manualClock(ms) {
  const clock = { now: ms, timers: [] };
  clock.sleep = (wait) => new Promise((resolve) => clock.timers.push({ at: clock.now + wait, resolve }));
  // Wakes the earliest sleeper, again and again, until the work is done.
  clock.until = async (work) => {
    let done = false;
    work.then(() => { done = true; }, () => { done = true; });
    for (let turn = 0; ; turn++) {
      await new Promise((r) => setImmediate(r));
      if (done) return work;
      assert.ok(turn < 10000 && clock.timers.length > 0, "the work is waiting on something other than the clock");
      clock.timers.sort((a, b) => a.at - b.at);
      const next = clock.timers.shift();
      clock.now = Math.max(clock.now, next.at);
      next.resolve();
    }
  };
  return clock;
}

test("during a war the backfill's slower pace never holds up the hourly poll", async () => {
  const torn = fakeTorn({ action: actions(1000, T0 - 60, Math.round(0.3 * DAY)), deposit: [], wars: [{ id: 51418, start: T0 - DAY, end: 0 }] });
  const clock = manualClock(T0 * 1000);
  torn.clock = clock;
  const c = createBloodBagCollector({
    dataDir: mkdtempSync(join(tmpdir(), "blood-bags-")), fetchImpl: torn.fetchImpl, nowFn: () => clock.now,
    sleepFn: clock.sleep, keyFn: () => "k", log: () => {},
  });
  await clock.until(Promise.all([c.pollOnce(), c.refreshWars()]));
  const mark = torn.calls.length;
  await clock.until(Promise.all([c.runBackfill(), c.pollOnce()]));

  const pages = backfillPages(torn);
  assert.ok(pages.length >= 6, `${pages.length} backfill pages`);
  assert.ok(between(pages).every((ms) => ms >= WAR_GAP_MS), `backfill pages: ${between(pages)}`);
  assert.ok(between(torn.calls).every((ms) => ms >= GAP_MS), `every call still waits its turn: ${between(torn.calls)}`);
  const pollCalls = torn.calls.slice(mark).filter((call) => call.url.pathname === "/v2/faction/news" && call.url.searchParams.get("from") !== String(CUTOFF));
  assert.equal(pollCalls.length, 2, "one page of each category");
  assert.ok(pollCalls[1].at - pollCalls[0].at < WAR_GAP_MS, `the poll's calls came ${pollCalls[1].at - pollCalls[0].at} ms apart`);
  assert.ok(pages.at(-1).at > pollCalls[1].at, "the backfill went on after the poll was done");
});
'''
open(p, "w", encoding="utf-8").write(s)
print("ok")
PY
```

Expected: `ok`.

- [ ] **Step 3: Run the tests to see them fail**

```bash
WS=/opt/warboard/.superpowers/sdd/2026-10-24-blood-bag-war-pace
cd $WS/ov && node --test blood-bags.test.js > $WS/fixes/t1-red.txt 2>&1; grep -E '^not ok|^# (tests|pass|fail)' $WS/fixes/t1-red.txt
grep -E 'backfill pages' $WS/fixes/t1-red.txt | sort | uniq -c
```

Expected: `# tests 27`, `# pass 23`, `# fail 4`. Each of the four fails at its first assertion, because the backfill still waits for the war and makes no page:
- "while a ranked war is live the backfill takes a page every 30 seconds, and goes back to every 6 once the war list shows it over": `0 backfill pages`
- "while the ranked-war list cannot be read, the backfill goes on at the war pace": `0 backfill pages: it goes on rather than waiting`
- "a ranked-war reply without its list is a failed read, not a list of no wars": `0 backfill pages`
- "during a war the backfill's slower pace never holds up the hourly poll": `0 backfill pages`

Any other failure means a test is wrong: fix it before going on.

- [ ] **Step 4: Write the war pace**

```bash
WS=/opt/warboard/.superpowers/sdd/2026-10-24-blood-bag-war-pace
python3 -I - $WS/ov/blood-bags.js <<'PY'
import sys
p = sys.argv[1]
s = open(p, encoding="utf-8").read()
def rep(old, new):
    global s
    assert s.count(old) == 1, ("not exactly once", old[:70])
    s = s.replace(old, new)

rep('''// picks up what is new. A one-off backfill walks a year back, at no more than
// 10 calls a minute and never while a ranked war is live, so the war pollers
// keep the key's budget. Both write one store, and a line's own id decides what
// is a repeat. Spec: docs/superpowers/specs/2026-10-24-faction-blood-bag-board-design.md''',
'''// picks up what is new. A one-off backfill walks a year back, at no more than
// 10 calls a minute, and 2 a minute while a ranked war is live, so the war
// pollers keep the key's budget. Both write one store, and a line's own id
// decides what is a repeat. Spec: docs/superpowers/specs/2026-10-24-faction-blood-bag-board-design.md''')

rep('''export const GAP_MS = 6000;
''', '''export const GAP_MS = 6000;
// While a ranked war is live, backfill pages are at least this far apart: 2 a
// minute. The wait is the backfill's own, so the poll is not slowed.
export const WAR_GAP_MS = 30000;
''')

rep('''// The backfill runs only on a ranked-war list read this recently. The list is
// read with every hourly poll, so this leaves a late tick 5 minutes.''',
'''// The backfill goes by a ranked-war list read this recently. The list is read
// with every hourly poll, so this leaves a late tick 5 minutes. With no such
// list it can't tell whether a war is on, so it goes at the war pace.''')

rep('''  let lastCallAt = -Infinity;
  let queue = Promise.resolve();
''', '''  let lastCallAt = -Infinity;
  let queue = Promise.resolve();
  // The backfill's own clock for the war pace, and what its last pace line said.
  let lastPageAt = -Infinity;
  let paceNote = null;
''')

rep('''      // Taken as no wars, a reply without its list would let the backfill run
      // through a live one.''',
'''      // Taken as no wars, a reply without its list would let the backfill run
      // through a live one at full speed.''')

rep('''        if (!next) break;
        // Only on a recent, successful read of the war list: an old or failed
        // read could miss a war that has started.
        if (!(nowFn() - data.warsAt < WARS_FRESH_MS)) {
          log("[blood-bags] backfill waiting: the ranked-war list has not been read in the last hour");
          break;
        }
        const war = liveWar(data.wars, nowSec());
        if (war) {
          log(`[blood-bags] backfill waiting: ranked war ${war.id} is live`);
          break;
        }
        const r = await walk(next.cat, next.gap.from, next.gap.to, 1);
''', '''        if (!next) break;
        await warPace();
        const r = await walk(next.cat, next.gap.from, next.gap.to, 1);
        // Taken once the page is back, since pace() may have held the call: the
        // war pace counts from here, so pages never go less than WAR_GAP_MS apart.
        lastPageAt = nowFn();
''')

rep('''  async function backfill() {
''', '''  /**
   * Before each backfill page: while a ranked war is live, or the war list is
   * too old to say, wait until WAR_GAP_MS after the page before. The wait is
   * outside pace(), so the hourly poll's calls go out in between. A line is
   * logged when the pace or its reason changes, not for every page.
   */
  async function warPace() {
    const known = nowFn() - data.warsAt < WARS_FRESH_MS;
    const war = known ? liveWar(data.wars, nowSec()) : null;
    const note = !known ? "the ranked-war list has not been read in the last hour"
      : war ? `ranked war ${war.id} is live` : null;
    if (note !== paceNote) {
      log(note ? `[blood-bags] backfill slowed to 2 calls a minute: ${note}`
        : "[blood-bags] backfill back to 10 calls a minute: no ranked war is live");
      paceNote = note;
    }
    if (!note) return;
    const wait = lastPageAt + WAR_GAP_MS - nowFn();
    if (wait > 0) await sleepFn(wait);
  }

  async function backfill() {
''')

rep('''   * The backfill: fills every gap, newest first, a page per call, GAP_MS apart.
   * It stops while a ranked war is live or the war list is out of date, and on
   * any error, and the next hourly tick starts it again from where it stopped.
   * Returns the run in progress, which never rejects.''',
'''   * The backfill: fills every gap, newest first, a page per call, GAP_MS apart,
   * or WAR_GAP_MS while a ranked war is live or the war list is out of date. It
   * stops on any error, and the next hourly tick starts it again from where it
   * stopped. Returns the run in progress, which never rejects.''')
open(p, "w", encoding="utf-8").write(s)
print("ok")
PY
cd $WS/ov && node --check blood-bags.js && echo syntax-ok
```

Expected: `ok`, `syntax-ok`.

- [ ] **Step 5: Run the tests to see them pass**

```bash
WS=/opt/warboard/.superpowers/sdd/2026-10-24-blood-bag-war-pace
cd $WS/ov && node --test blood-bags.test.js 2>&1 | grep -E '^not ok|^# (tests|pass|fail)'
```

Expected: `# tests 27`, `# pass 27`, `# fail 0`. This includes "the war list is read with every hourly poll, before and after the backfill is done", unchanged: its backfill now finishes during the war, at the war pace, and every assertion still holds.

- [ ] **Step 6: Amend the spec**

```bash
cd /opt/warboard && python3 -I - docs/superpowers/specs/2026-10-24-faction-blood-bag-board-design.md <<'PY'
import sys
p = sys.argv[1]
s = open(p, encoding="utf-8").read()
def rep(old, new):
    global s
    assert s.count(old) == 1, ("not exactly once", old[:70])
    s = s.replace(old, new)
rep("Amended on 2026-10-24 (EDT) with the fixes from the final review.",
    "Amended on 2026-10-24 (EDT) with the fixes from the final review, and again that day when the owner chose to load history at 2 calls a minute during a ranked war (Q14).")
rep('| Q14 | History is filled in once, a year back, at no more than 10 calls a minute and never while a ranked war is live. "All time" means since that date. |',
    '| Q14 | History is filled in once, a year back, at no more than 10 calls a minute, and no more than 2 a minute while a ranked war is live. The owner chose this on 2026-10-24; at first it waited for the war to end. "All time" means since that date. |')
rep("- No more than 10 calls a minute.\n",
    "- No more than 10 calls a minute, and no more than 2 a minute (a page every 30 seconds) while a ranked war is live, so the war pollers keep the key's budget. The hourly poll is not slowed: its calls go out between the backfill's pages.\n")
rep("- It waits while a ranked war is live and carries on after the war. It also waits while the war list is more than 65 minutes old (an hour's poll plus 5 minutes), so a failed read of the list cannot let it run through a war.\n",
    "- Once the hourly read of the war list shows the war is over, it goes back to 10 a minute. A war list more than 65 minutes old (an hour's poll plus 5 minutes), or one that could not be read, counts as a war, so a war it cannot see costs no more than one it can. It logs a line when it slows down and when it speeds back up, not for every page.\n")
rep("- **Cost:** about 1,300 calls, a little over 2 hours at 10 a minute.",
    "- **Cost:** about 1,300 calls: a little over 2 hours at 10 a minute, or about 11 hours at the war pace.")
rep("- The backfill: its pace, waiting while a war is live, and resuming from its saved place.\n",
    "- The backfill: its pace, the slower pace while a war is live or the war list is out of date, the poll going on beside it, and resuming from its saved place.\n")
rep("- The backfill starts on its own after the reload and runs for about 2 hours, or waits for a live war to end first.\n",
    "- The backfill starts on its own after the reload and runs for about 2 hours, or about 11 at the war pace while a ranked war is live.\n")
open(p, "w", encoding="utf-8").write(s)
print("ok")
PY
git diff --stat -- docs/superpowers/specs/2026-10-24-faction-blood-bag-board-design.md
```

Expected: `ok`, and 1 file changed.

- [ ] **Step 7: Install, run in place, commit**

```bash
WS=/opt/warboard/.superpowers/sdd/2026-10-24-blood-bag-war-pace
install -o root -g root -m 644 $WS/ov/blood-bags.js $WS/ov/blood-bags.test.js /opt/warboard/server/
cd /opt/warboard/server && node --test blood-bags-model.test.js blood-bags.test.js blood-bags-route.test.js blood-bags-page.test.js 2>&1 | grep -E '^not ok|^# (tests|pass|fail)'
cd /opt/warboard && git commit -q -F - -- server/blood-bags.js server/blood-bags.test.js docs/superpowers/specs/2026-10-24-faction-blood-bag-board-design.md <<'EOF'
Blood-bag board: history keeps loading during a ranked war, at 2 calls a minute

The one-year backfill waited for a live ranked war to end, so the
board's longer timeframes stayed empty for the whole war. It now goes
on at a page every 30 seconds while a war is live, or while the war
list is too old or unread to say, and back to every 6 once the hourly
read shows the war over. The wait is the backfill's own, so the hourly
poll is not slowed, and a line is logged when the pace changes.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
git log --format='%h %s' -1
```

Expected: `# tests 93`, `# pass 93`, `# fail 0`, then the new commit.

### Task 2: The note says the history is filling in slowly

**Files:**
- Modify: `server/pages/bloodbags.html` (`noteText`, line 173)
- Test: `server/blood-bags-page.test.js` (line 115)
- Modify: the spec, line 141

**Interfaces:**
- Consumes: the `/api/bloodbags` answer's `liveWar` (`{ id, start }` or null), `backfillDone` and `reachSec`, all unchanged.
- Produces: nothing new.

- [ ] **Step 1: Change the test's war case**

```bash
WS=/opt/warboard/.superpowers/sdd/2026-10-24-blood-bag-war-pace
python3 -I - $WS/ov/blood-bags-page.test.js <<'PY'
import sys
p = sys.argv[1]
s = open(p, encoding="utf-8").read()
old = '"History so far reaches back to 20 Oct; the rest of the year is still being filled in once the ranked war ends.");'
new = '"History so far reaches back to 20 Oct; the rest of the year is still being filled in, slowly while the ranked war is on.");'
assert s.count(old) == 1
open(p, "w", encoding="utf-8").write(s.replace(old, new))
print("ok")
PY
```

Expected: `ok`.

- [ ] **Step 2: Run it to see it fail**

```bash
WS=/opt/warboard/.superpowers/sdd/2026-10-24-blood-bag-war-pace
cd $WS/ov && node --test blood-bags-page.test.js 2>&1 | grep -E '^not ok|^# (tests|pass|fail)|once the ranked war ends'
```

Expected: `# tests 14`, `# pass 13`, `# fail 1`. The failure is in "the note says when there is no data yet, and how far back the history reaches while it fills in", whose actual text still ends "once the ranked war ends.".

- [ ] **Step 3: Change the note**

```bash
WS=/opt/warboard/.superpowers/sdd/2026-10-24-blood-bag-war-pace
python3 -I - $WS/ov/pages/bloodbags.html <<'PY'
import sys
p = sys.argv[1]
s = open(p, encoding="utf-8").read()
old = '(d.liveWar ? " once the ranked war ends." : "."));'
new = '(d.liveWar ? ", slowly while the ranked war is on." : "."));'
assert s.count(old) == 1
open(p, "w", encoding="utf-8").write(s.replace(old, new))
print("ok")
PY
```

Expected: `ok`.

- [ ] **Step 4: Run it to see it pass**

```bash
WS=/opt/warboard/.superpowers/sdd/2026-10-24-blood-bag-war-pace
cd $WS/ov && node --test blood-bags-page.test.js 2>&1 | grep -E '^not ok|^# (tests|pass|fail)'
```

Expected: `# tests 14`, `# pass 14`, `# fail 0`. That includes "the page is plain ASCII, asks for the key in a text field, and serves through blood-bags-page.js".

- [ ] **Step 5: Amend the spec**

```bash
cd /opt/warboard && python3 -I - docs/superpowers/specs/2026-10-24-faction-blood-bag-board-design.md <<'PY'
import sys
p = sys.argv[1]
s = open(p, encoding="utf-8").read()
old = '- While the backfill runs, the page says how far back the data reaches so far. "All time" means that far, and no shorter timeframe starts before it.\n'
new = '- While the backfill runs, the page says how far back the data reaches so far, and during a ranked war that the rest is filling in slowly. "All time" means that far, and no shorter timeframe starts before it.\n'
assert s.count(old) == 1
open(p, "w", encoding="utf-8").write(s.replace(old, new))
print("ok")
PY
```

Expected: `ok`.

- [ ] **Step 6: Install, run in place, commit**

This puts the new note live at once (ruling 7). It is the last step before the final review.

```bash
WS=/opt/warboard/.superpowers/sdd/2026-10-24-blood-bag-war-pace
install -o root -g root -m 644 $WS/ov/blood-bags-page.test.js /opt/warboard/server/
install -o root -g root -m 644 $WS/ov/pages/bloodbags.html /opt/warboard/server/pages/bloodbags.html
cd /opt/warboard/server && node --test blood-bags-model.test.js blood-bags.test.js blood-bags-route.test.js blood-bags-page.test.js 2>&1 | grep -E '^not ok|^# (tests|pass|fail)'
cd /opt/warboard && git commit -q -F - -- server/pages/bloodbags.html server/blood-bags-page.test.js docs/superpowers/specs/2026-10-24-faction-blood-bag-board-design.md <<'EOF'
Blood-bag board: the note says the history fills in slowly during a war

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
git log --format='%h %s' -1
```

Expected: `# tests 93`, `# pass 93`, `# fail 0`, then the new commit.

### Task 3: Release and the live check

This runs after the final review of Tasks 1–2 and its fix pass (ruling 8).

**Files:** none changed. It creates `$WS/reach.txt` and `$WS/tools/check-day.mjs`, which are never committed.

**Interfaces:**
- Consumes: the installed `server/blood-bags.js`, `server/pages/bloodbags.html` and `server/blood-bags-model.js` (`parseLine`, which has no imports); the store `server/data/blood-bags/42055.json` (read only); `/api/debug/key-usage-local`, which counts the collector's calls under `bySource["blood-bags"]` in memory, so it starts empty at the reload.
- Produces: the live release.

- [ ] **Step 1: Note the history's reach, then deploy**

Run this in the background: `deploy.sh` takes about a minute.

```bash
uptime
WS=/opt/warboard/.superpowers/sdd/2026-10-24-blood-bag-war-pace
python3 -I -c '
import json
g = json.load(open("/opt/warboard/server/data/blood-bags/42055.json"))["cats"]["armoryAction"]["gaps"]
print(max(x["to"] for x in g) if g else 0)' > $WS/reach.txt; echo "reach $(cat $WS/reach.txt)"
/opt/warboard/server/deploy.sh > $WS/deploy.txt 2>&1; echo "exit $?" >> $WS/deploy.txt
grep -E '^# (tests|pass|fail|skipped) |^deploy ok|UNHEALTHY|REFUSING|^\{"status|^exit ' $WS/deploy.txt
```

Expected:
- `reach 1792791635` (17:40 EDT on 2026-10-23), unless the history has moved since 10:49 EDT. It shouldn't have, since the backfill is waiting out the war.
- `# fail 0`, and `# tests 2291`, `# pass 2289`, `# skipped 2` if no other session has added tests.
- `{"status":"ok",…}`, `deploy ok`, `exit 0`.

- [ ] **Step 2: The process, the log and the page**

```bash
P=$(pm2 pid warboard); echo "pid $P user $(ps -o user= -p $P)"
pm2 logs warboard --lines 300 --nostream 2>&1 | grep -a 'blood-bags' | cut -c1-200 | tail -5
curl -s http://127.0.0.1:3000/bloodbags | grep -c 'slowly while the ranked war is on'
```

Expected:
- A new pid, user `warboard`.
- Within a minute of the reload: `[blood-bags] backfill slowed to 2 calls a minute: ranked war 51418 is live`. If war 51418 has ended by now, there is no slow line and the backfill runs at 10 a minute; say so in the report.
- No `store unreadable` and no `failed`.
- `1` for the page's new wording.

- [ ] **Step 3: The pace**

About 10 minutes after the reload:

```bash
curl -s --max-time 10 'http://127.0.0.1:3000/api/debug/key-usage-local?window=10' | python3 -I -c '
import json,sys
d = json.load(sys.stdin)
n = d["bySource"].get("blood-bags", 0)
print(n, "blood-bags calls in the last", d["windowMin"], "min, so", round(n / d["windowMin"], 2), "a minute")'
python3 -I -c '
import json,time
g = json.load(open("/opt/warboard/server/data/blood-bags/42055.json"))["cats"]["armoryAction"]["gaps"]
print("action history reaches", time.strftime("%m-%d %H:%M EDT", time.gmtime(max(x["to"] for x in g) - 4*3600)) if g else "the floor")'
```

Expected:
- About 23 calls in 10 minutes: the first tick's 3 (the war list and one page of each category), then a backfill page every 30 s. That is about 2.3 a minute; at 10 a minute it would be near 100.
- The action history should have moved back a few days. Each page is 100 lines, and the armoury logs about 360 a day, more during a war. The store is saved every 10 pages, so the reach on disk lags by up to 5 minutes.
- The owner was told "7 days within about 15 min of the deploy, 30 days within about an hour". Report the measured days per hour, and the finish time it implies, if they differ.

- [ ] **Step 4: Check the first day the backfill filled against Torn**

The first backfilled day is the 24 hours below the reach noted in Step 1. Wait, in a background command, until the store's action history has passed it:

```bash
WS=/opt/warboard/.superpowers/sdd/2026-10-24-blood-bag-war-pace
R=$(cat $WS/reach.txt); F=$((R - 86400))
for i in $(seq 1 80); do T=$(python3 -I -c 'import json; g=json.load(open("/opt/warboard/server/data/blood-bags/42055.json"))["cats"]["armoryAction"]["gaps"]; print(max(x["to"] for x in g) if g else 0)'); [ "$T" -le "$F" ] && echo "reached: $T" && break; sleep 30; done
```

Expected: `reached: <a second at or below R - 86400>`, usually 10 to 15 minutes after the reload: it is a war day, with more lines than most. If the loop ends without it, run it again, since the history is still moving.

Then write the probe and run it:

```bash
WS=/opt/warboard/.superpowers/sdd/2026-10-24-blood-bag-war-pace
cat > $WS/tools/check-day.mjs <<'JS'
// Checks one stretch of the store against Torn's own armoury news, line by
// line. Every read is a window that comes back short of a full page: actions
// are read 2 hours at a time, and a window that comes back full is split in two
// and read again. So none of the collector's page-edge logic is involved. The
// key comes in through $KEY and goes only into the Authorization header.
// Usage: KEY=... node check-day.mjs <fromSec> <toSec>
import { readFileSync } from "node:fs";
const { parseLine } = await import("/opt/warboard/server/blood-bags-model.js");

const [from, to] = process.argv.slice(2).map(Number);
const store = JSON.parse(readFileSync("/opt/warboard/server/data/blood-bags/42055.json", "utf8"));
const torn = new Map();
let calls = 0;

async function read(cat, a, b) {
  const q = new URLSearchParams({ cat, from: String(a), to: String(b), limit: "100", sort: "DESC", stripTags: "false", comment: "wb-bloodbags-check" });
  const res = await fetch(`https://api.torn.com/v2/faction/news?${q}`, { headers: { Authorization: `ApiKey ${process.env.KEY}` } });
  const body = await res.json();
  calls++;
  await new Promise((r) => setTimeout(r, 1000));
  if (body.error) throw new Error(`Torn error ${body.error.code}: ${body.error.error}`);
  if (!Array.isArray(body.news)) throw new Error("a reply without its news list");
  if (body.news.length >= 100) {
    if (b - a < 2) throw new Error(`100 or more ${cat} lines in the second ${a}`);
    const mid = Math.floor((a + b) / 2);
    await read(cat, mid, b);
    await read(cat, a, mid);
    return;
  }
  for (const e of body.news) {
    const rec = parseLine(e.text);
    if (rec) torn.set(String(e.id), rec.kind);
  }
}

for (let a = from; a < to; a += 2 * 3600) await read("armoryAction", a, Math.min(a + 2 * 3600, to));
await read("armoryDeposit", from, to);
const mine = new Map(Object.entries(store.lines).filter(([, l]) => l.ts >= from && l.ts < to).map(([id, l]) => [id, l.kind]));
const tally = (m) => [...m.values()].reduce((o, k) => ({ ...o, [k]: (o[k] || 0) + 1 }), {});
const missing = [...torn.keys()].filter((id) => !mine.has(id)).length;
const extra = [...mine.keys()].filter((id) => !torn.has(id)).length;
console.log(`window ${from}..${to} (${((to - from) / 3600).toFixed(1)} h), ${calls} Torn calls`);
console.log("torn ", JSON.stringify(tally(torn)));
console.log("store", JSON.stringify(tally(mine)));
console.log(missing || extra ? `MISMATCH: ${missing} missing from the store, ${extra} not in Torn's news` : "MATCH");
JS
R=$(cat $WS/reach.txt); F=$((R - 86400))
cd /tmp && KEY=$(grep '^OWNER_API_KEY=' /opt/warboard/server/.env | cut -d= -f2-) node $WS/tools/check-day.mjs $F $R 2>&1 | sed -E 's/[A-Za-z0-9]{16}/****************/g'
```

Expected:
- `window <F>..<R> (24.0 h), 13 Torn calls`, or a few more if a busy window was split.
- The same counts by kind on the `torn` and `store` lines.
- `MATCH`.

A mismatch is a bug in the backfill's page walk: use superpowers:systematic-debugging before going on, and don't push.

- [ ] **Step 5: Push**

```bash
cd /opt/warboard && git status -sb | head -1 && git log --format='%h %s' origin/main..main && git push origin main 2>&1 | sed -E 's#//[^@]*@#//***@#g' && git status -sb | head -1
```

Expected: the plan commit and Tasks 1–2's commits go out, and `## main...origin/main` follows.

- [ ] **Step 6: Memory**

Edit `/root/.claude/projects/-root/memory/project_blood_bag_board.md` in place, so nothing in it still says the backfill waits out a war:
- **The frontmatter `description`** (line 3): "backfill waits out live ranked wars" becomes "backfill goes at 2 calls/min during ranked wars".
- **The collector bullet** (lines 25–30): the backfill now goes at 2 calls a minute during a ranked war, or while the war list is out of date, instead of waiting. Give the three log lines, and note that the old `backfill waiting:` lines are gone.
- **The release check bullet** (lines 31–32): add this release, its commits and the live check's result.
- **The numbers paragraph** (lines 36–39): replace "while the backfill waits out war 51418" with how far back the history reached at the live check, and when it should be complete.
- **OPEN item (1)** (line 40): the owner chose b on 2026-10-24, and it is shipped, with its commits.

In `MEMORY.md`, change line 200's text in place. Never add a line: the file is at its 200-line limit.

- [ ] **Step 7: Report**

Tell the owner, in EDT:
- what changed;
- when the history should be complete, from the measured rate;
- the live check's result;
- the rulings above and any made while executing;
- the served URL, https://tornwar.com/bloodbags.
