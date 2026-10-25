# Blood-bag board: the year's history fills in a few pages each hour, and waits out ranked wars (implementation plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The board's one-year history fills in again, on the owner's key, at up to 4 pages each hourly tick and none while a ranked war is live, and the page says what the rest of the year is waiting for.

**Architecture:**
- In `server/blood-bags.js`, `tick()` reads the war list and polls, then takes up to `TICK_PAGES` = 4 backfill pages through `runBackfill(TICK_PAGES)` and waits for them. It takes none while a ranked war is live, or in an hour whose read of the war list failed.
- `backfill()` and `runBackfill()` take a page limit, `maxPages`. It defaults to all the pages, so the full runs the collector tests drive work as before. An error still ends a run, so it ends that hour's pages, and the next tick carries on from the saved place.
- The `BLOODBAGS_BACKFILL` switch goes.
- `/api/bloodbags` renames `backfillSlow` to `backfillHeld`, with the same meaning: a live war, or a war list too old to say. The page's note gets a wording for each of the three cases.

**Tech Stack:** Node 20 ES modules in the existing Express server; `node:test` and `node:assert/strict`; Python 3 for exact text edits.

**Spec:** `docs/superpowers/specs/2026-10-24-faction-blood-bag-board-design.md` (last amended in a031e18a). This plan changes decision Q14 there, and the note in Edge cases.
- On 2026-10-25 at 04:11 EDT the owner chose "1": the backfill stays off until the ranked war ends, then runs a small number of pages a day on their key.
- At 04:15 EDT they answered the follow-up questions with "recommended", which took every recommended answer:
  - Q1: 4 pages with each hourly tick, about 96 a day.
  - Q2: every live ranked war holds the pages, and so does any hour in which the war list couldn't be read.
  - Q3: the note's wording, in three cases (see Global Constraints).
  - Q4: remove `BLOODBAGS_BACKFILL`.

## Global Constraints

Repo paths are relative to `/opt/warboard`.

**From the spec and the owner's answers**
- Each hourly tick takes at most `TICK_PAGES` = 4 backfill pages, after its war-list read and its poll (Q1). The pages count across both categories together, newest gap first, the order `nextGap()` already gives.
- The tick takes no pages while a ranked war is live, nor in an hour whose read of the war list failed (Q2).
  - A live war is one in the list that has started (`start` set and `start <= now`) and has not ended (`end` is 0 or still to come).
  - That is `liveWar` in `server/blood-bags-model.js`, unchanged.
- An error on a page ends that hour's pages. The gap keeps its place, and the next tick carries on from it.
- While the backfill has work left, the note under the board is exactly one of these (Q3), with `<d Mon>` from `dayMonth(reachSec)`:
  - during a ranked war: `History so far reaches back to <d Mon>; the rest of the year fills in after the ranked war.`
  - while the war list is out of date, with no live war in the list it has: `History so far reaches back to <d Mon>; the rest of the year is on hold for now.`
  - otherwise: `History so far reaches back to <d Mon>; the rest of the year is still being filled in, a little each hour.`
- `BLOODBAGS_BACKFILL` is gone from the code, the tests and the spec (Q4).
- Unchanged:
  - Every collector call is at least `GAP_MS` = 6,000 ms after the one before.
  - While a ranked war is live, a run that is already going spaces its pages `WAR_GAP_MS` = 30,000 ms apart.
  - The board reads only with the owner's own key: the one they signed in with, else `OWNER_API_KEY`.

**Code rules**
- ES modules, 2-space indent, double quotes, present-tense `//` comments, no version numbers or "used to" history in comments. Match the code around it.
- The page script is ES5 and the whole page is ASCII.
- Tests never touch the live data folder: `blood-bags.test.js` and `blood-bags-route.test.js` already set `process.env.DATA_DIR` to a fresh `mkdtemp` folder before importing.

**Where the work happens**
- `server/` is the live tree. pm2 loads `server/blood-bags.js` only at start, so installing it changes nothing until Task 3's reload. `server/blood-bags-page.js` re-reads `server/pages/bloodbags.html` when the file changes, so installing the page puts it live at once (ruling 9).
- The work happens in an overlay, `$WS/ov`, with `WS=/opt/warboard/.superpowers/sdd/2026-10-25-blood-bag-backfill-budget`. That is the git-ignored workspace `sdd-workspace` prints for this plan. Shell state doesn't carry between commands, so each block sets `WS`.
  - Real copies in the overlay: `blood-bags.js`, `blood-bags.test.js`, `blood-bags-route.test.js`, `blood-bags-page.js`, `blood-bags-page.test.js` and `pages/bloodbags.html`.
  - Symlinks to `server/`: `node_modules`, `auth.js`, `key-usage-log.js`, `store.js`, `torn-api.js`, `routes.js`, `server.js` and `blood-bags-model.js`.
  - `blood-bags-page.js` must be a real copy. Node resolves an ES module symlink to its real path, so a symlinked copy would read `server/pages/bloodbags.html` instead of the overlay's.
- Each test goes red and then green in the overlay. Only then are its files installed into `server/` with `install -o root -g root -m 644`, run in place, and committed. That way `server/` only ever holds passing tests: another session's `deploy.sh` runs the whole suite and refuses to deploy on any failure.
- Never create `server/data/blood-bags/` or write to it: the server process owns it.
- Work is on `main`: one commit per code task, and the push in Task 3.

**Repo and box**
- The repo (factionops.git) is public. Commit no secrets, no key endings, no member data and no player ids but the owner's. This plan is committed too, so it names none of them.
- Stage only this plan's paths with `git commit -- <paths>`. Leave other sessions' changes alone, among them `server/war-history.js`, `server/data/rwp-prices.json`, `server/public/river9-watch.txt` and `server/public/s/`.
- Never print git remotes or git config in `/opt/warboard`: the remote URL holds a token. Mask push output with `sed -E 's#//[^@]*@#//***@#g'`.
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- The box is shared and live; a load of about 8 is normal.
  - Check `uptime` before the suite or a deploy, and wait if it's over 12.
  - `rm` on a variable path is blocked.
  - Run Python with `-I`.
  - Subagents use `model: "opus"`.
  - There are no foreground `sleep` loops: wait in a background command.
  - Live logs come from `pm2 logs warboard --nostream`; they are kept in `/var/log/warboard/`, not `~/.pm2/logs`.
  - `find` here is a shell function over `bfs`, whose `-newermt` takes only an ISO time such as `2026-10-25T09:06:27`.
- Times for the owner are in EDT. The box's clock is CET (UTC+1) since 2026-10-25, 5 hours ahead of EDT.

## Review Focus

These are the conditions most likely to bite once this ships. Each one has a test in the task that owns the code.

1. **The owner's key at Torn's daily read cap, for hours.** Torn answers news reads with code 14 while the war list still reads. Each hour the poll fails, and the first backfill page is refused, which ends the hour: one refused call, nothing lost, no retries. Once the cap clears, the next tick carries on from the same place. Task 1 test: "a Torn error ends that hour's pages and keeps their place, and the next tick carries on from it".
2. **A server restart between ticks.** The box restarts warboard 1 to 3 times a day, and each start runs a tick at once. That tick carries on from where the last tick's pages stopped. The place is saved when each run ends, since 4 pages never reach the save every 10 pages. Task 1 test: "after a restart the first tick carries on from where the last tick's pages stopped, with no repeats and no gap".
3. **A ranked war that ends.** No pages while it is live. Then the first tick whose list shows it over takes its 4, at full speed. Task 1 test: "while a ranked war is live the hourly tick takes no backfill pages, and the first tick after it ends takes them again".
4. **A war-list read that fails an hour after a good one.** The list from the hour before is still under the 65-minute limit, so a check on its age alone would let the pages go in an hour that can't see whether a war has started. Task 1 test: "in an hour whose read of the war list failed the tick takes no backfill pages, though the last list is not 65 minutes old".
5. **The last pages of the year.** With fewer than 4 pages left, the tick takes what's left and logs `backfill done` once. Later ticks make no backfill calls. Task 1 test: "the tick that reaches the year's floor says the backfill is done, and later ticks take no pages".

## Rulings made at plan time

1. **The tick goes by its own read of the war list.** It takes pages only when that hour's `refreshWars()` succeeded and `slowReason()` finds no live war (Q2).
   - The route sees only `warsAt`. So for up to about 5 minutes after a failed read, the page can still say "a little each hour" while the tick has held that hour's pages.
   - No stored flag is added for that.
2. **The tick waits for its own pages.** That is about 24 s at 6 s a call, and a few minutes at most if Torn is slow. So `await tick()` includes them, and a test can count them. `server.js` doesn't wait on `start()`.
3. **A failed poll doesn't stop the hour's pages.** For a key at the cap, the first page is refused too. That one refused call ends the hour, which is the approved "errors end that hour's pages".
4. **A restart adds a tick's pages.** The log shows 1 to 3 server starts a day from 10-16 to 10-25, so about 4 to 12 pages a day on top of the 96. No daily counter is kept.
5. **The war pace stays.** It spaces the pages of a run that is already going when a war starts: at most 3 pages, at 2 a minute. It also paces the full runs the tests drive. Taking it out would be a separate change.
6. **`runBackfill(maxPages = Infinity)`.** The default keeps the full run that most collector tests drive directly. A call while a run is going joins that run, whatever its limit.
7. **`backfillSlow` becomes `backfillHeld`, with the same truth table.** The page is its only reader: a grep finds no other in the repo.
8. **Three tests that call `tick()` and then `runBackfill()` stay as they are.**
   - They are "the war list is read with every hourly poll, before and after the backfill is done", "a ranked-war reply without its list is a failed read, not a list of no wars" and "an hourly tick that lands while the backfill waits out its 30 seconds goes out at once, 6 s apart".
   - At each of their ticks a war is live or the war-list read failed. So the tick takes no pages, and `runBackfill()` runs the full backfill as before.
9. **The new note goes live at Task 2's install, before the reload.** Its war wording, "fills in after the ranked war", is already true: the backfill has been held since a031e18a. War 51418 is live, so that is the wording members see.
10. **The last test's message changes.** "a day of war-time news missed while the key could not read is caught up by the poll alone" said the backfill "may be off". It now says the backfill takes only a few pages an hour.
11. **The release can only see the held path.** War 51418 is live, and the owner's key may still be at the cap. The first hour of pages after the war, and a day's watch for code 14, are owed checks. They are reported as owed, not claimed.
12. **The final review runs between Task 2 and Task 3**, so nothing unreviewed is deployed or pushed. Task 3 starts only after the review's fix pass. Another session's reload could still put Tasks 1 and 2 live before the review; by then they have passed their tests.

## Files

| File | Task | What changes |
|---|---|---|
| `server/blood-bags.js` | 1, 2 | `TICK_PAGES`, the tick's check and wait, the page limit, the switch removed, eight comments (Task 1); `backfillHeld` (Task 2). |
| `server/blood-bags.test.js` | 1 | The switch's lines and its test go, six tests come in (36 → 41), one message changes. |
| `server/blood-bags-route.test.js` | 2 | `backfillHeld` in two tests (21 tests before and after). |
| `server/pages/bloodbags.html` | 2 | The three endings in `noteText`. |
| `server/blood-bags-page.test.js` | 2 | The wording in three tests (15 tests before and after). |
| `docs/superpowers/specs/2026-10-24-faction-blood-bag-board-design.md` | 1, 2 | Status, Q14, the backfill section, both Cost lines, Testing and Release (Task 1); the note in Edge cases (Task 2). |

---

### Task 1: The hourly budget

**Files:**
- Modify: `server/blood-bags.js`:
  - the header comment (lines 5–8);
  - the `WAR_GAP_MS` comment (lines 35–36);
  - a new `TICK_PAGES` after `HEAD_MAX_PAGES` (line 42);
  - the `slowReason` comment (lines 56–60);
  - the collector's options comment (lines 74–76);
  - `backfillOn` and its comment, removed (lines 97–100);
  - the head of `backfill()` (lines 383–387) and its `finally` comment (lines 404–405);
  - `runBackfill()` and its comment (lines 410–418);
  - `tick()` and its comment (lines 425–437);
  - the `start()` comment (line 461).
- Test: `server/blood-bags.test.js`
- Modify: the spec, lines 3, 29, 91, 96, 97, 101, 159 and 168.

**Interfaces:**
- Consumes, from inside the collector:
  - `refreshWars()`, which returns `true` when the list was read;
  - `pollOnce()`, `hasGaps()`, `nowFn()`, `data.wars` and `data.warsAt`;
  - `slowReason(wars, warsAt, nowMs)`, which returns a reason or null;
  - `walk()` and `warPace()`, unchanged.
- Produces:
  - `export const TICK_PAGES = 4` from `server/blood-bags.js`, imported by the tests;
  - `runBackfill(maxPages = Infinity)`;
  - `tick()`, which now resolves after the hour's pages.
  - Nothing else changes outside the module.

- [ ] **Step 1: Make the workspace and the overlay**

The executing-plans setup runs `sdd-workspace` for this plan from inside `/opt/warboard`. It must print `/opt/warboard/.superpowers/sdd/2026-10-25-blood-bag-backfill-budget`. Then:

```bash
WS=/opt/warboard/.superpowers/sdd/2026-10-25-blood-bag-backfill-budget
S=/opt/warboard/server
mkdir -p $WS/ov/pages
cp $S/blood-bags.js $S/blood-bags.test.js $S/blood-bags-route.test.js $S/blood-bags-page.js $S/blood-bags-page.test.js $WS/ov/
cp $S/pages/bloodbags.html $WS/ov/pages/
for f in node_modules auth.js key-usage-log.js store.js torn-api.js routes.js server.js blood-bags-model.js; do ln -s $S/$f $WS/ov/$f; done
cd $WS/ov && for t in blood-bags.test.js blood-bags-route.test.js blood-bags-page.test.js; do echo "$t: $(node --test $t 2>&1 | grep -E '^# (tests|pass|fail) ' | paste -sd' ')"; done
```

Expected:
```
blood-bags.test.js: # tests 36 # pass 36 # fail 0
blood-bags-route.test.js: # tests 21 # pass 21 # fail 0
blood-bags-page.test.js: # tests 15 # pass 15 # fail 0
```

- [ ] **Step 2: Write the failing tests**

The switch's lines and its test go. Six tests come in at the end of the file, each for a Review Focus line or for the budget itself.

```bash
WS=/opt/warboard/.superpowers/sdd/2026-10-25-blood-bag-backfill-budget
python3 -I - $WS/ov/blood-bags.test.js <<'PY'
import sys
p = sys.argv[1]
s = open(p, encoding="utf-8").read()
def rep(old, new):
    global s
    assert s.count(old) == 1, ("not exactly once", old[:70])
    s = s.replace(old, new)
def drop_test(name):
    global s
    head = 'test("' + name + '"'
    assert s.count(head) == 1, ("test not found once", name)
    start = s.index(head)
    end = s.index("\n});\n\n", start) + len("\n});\n\n")
    s = s[:start] + s[end:]

rep('''// The hourly tick starts the year's backfill only when BLOODBAGS_BACKFILL is 1.
// These tests are about how the backfill runs, so it is on for all but the one
// that turns it off.
process.env.BLOODBAGS_BACKFILL = "1";
const { createBloodBagCollector, GAP_MS, WAR_GAP_MS, HEAD_MAX_PAGES } = await import("./blood-bags.js");
''', '''const { createBloodBagCollector, GAP_MS, WAR_GAP_MS, HEAD_MAX_PAGES, TICK_PAGES } = await import("./blood-bags.js");
''')
drop_test("with BLOODBAGS_BACKFILL unset, the hourly tick polls and the year's backfill waits")
rep('assert.deepEqual(cat.gaps, [], "nothing left for the backfill, which may be off");',
    'assert.deepEqual(cat.gaps, [], "nothing left for the backfill, which takes only a few pages an hour");')

s = s.rstrip("\n") + "\n\n" + r'''
// ── the hourly budget ───────────────────────────────────────────────────────
test("each hourly tick takes 4 backfill pages after its poll, 6 s apart, and the next tick carries on below them", async () => {
  const torn = fakeTorn({ action: actions(1000, T0 - 60, Math.round(0.3 * DAY)), deposit: [] });
  const { c, clock } = setup({ torn });
  await c.tick();
  assert.equal(TICK_PAGES, 4);
  assert.equal(backfillPages(torn).length, TICK_PAGES, "the first tick's pages");
  const place = c.snapshot().cats.armoryAction.gaps[0].to;
  clock.now += HOUR_MS;
  await c.tick();
  const pages = backfillPages(torn);
  assert.equal(pages.length, 2 * TICK_PAGES, "as many again an hour later");
  assert.equal(pages[TICK_PAGES].url.searchParams.get("to"), String(place), "the second tick starts where the first stopped");
  assert.ok(between(pages.slice(0, TICK_PAGES)).every((ms) => ms >= GAP_MS && ms < WAR_GAP_MS), `${between(pages)}`);
  assert.ok(between(torn.calls).every((ms) => ms >= GAP_MS), "the poll and the pages share one pace");
  assert.equal(c.snapshot().backfillDone, false);
});

test("the tick that reaches the year's floor says the backfill is done, and later ticks take no pages", async () => {
  const torn = fakeTorn({ action: actions(1000, T0 - 60, Math.round(0.3 * DAY)), deposit: [] });
  const { c, clock, logs } = setup({ torn });
  // The 900 lines below the first page take 10 pages, each starting at the last
  // line of the one before: 4, 4, then the last 2.
  for (let hour = 0; hour < 3; hour++) {
    await c.tick();
    clock.now += HOUR_MS;
  }
  assert.equal(backfillPages(torn).length, 10);
  assert.equal(c.snapshot().backfillDone, true);
  assert.equal(logs.filter((m) => m.includes("backfill done")).length, 1, logs.join("\n"));
  const mark = torn.calls.length;
  await c.tick();
  assert.equal(torn.calls.length - mark, 3, "the war list and a page of each category, and no backfill page");
  assert.equal(c.snapshot().lines.length, bloodIn(torn, CUTOFF));
});

test("while a ranked war is live the hourly tick takes no backfill pages, and the first tick after it ends takes them again", async () => {
  const torn = fakeTorn({ action: actions(1000, T0 - 60, Math.round(0.3 * DAY)), deposit: [], wars: [{ id: 51418, start: T0 - DAY, end: 0 }] });
  const { c, clock } = setup({ torn });
  await c.tick();
  clock.now += HOUR_MS;
  await c.tick();
  assert.equal(torn.calls.length, 6, "each tick reads the war list and a page of each category");
  assert.equal(backfillPages(torn).length, 0, "no pages during the war");
  torn.wars[0].end = Math.floor(clock.now / 1000);
  clock.now += HOUR_MS;
  await c.tick();
  const pages = backfillPages(torn);
  assert.equal(pages.length, TICK_PAGES, "the first tick after the war takes its pages");
  assert.ok(between(pages).every((ms) => ms >= GAP_MS && ms < WAR_GAP_MS), `at full speed: ${between(pages)}`);
});

test("in an hour whose read of the war list failed the tick takes no backfill pages, though the last list is not 65 minutes old", async () => {
  const torn = fakeTorn({ action: actions(1000, T0 - 60, Math.round(0.3 * DAY)), deposit: [] });
  const { c, clock, logs } = setup({ torn });
  await c.tick();
  assert.equal(backfillPages(torn).length, TICK_PAGES);
  clock.now += HOUR_MS;
  torn.fail = (u) => (u.pathname.endsWith("/rankedwars") ? reply({ error: { code: 5, error: "Too many requests" } }) : null);
  await c.tick();
  assert.ok(logs.some((m) => m.includes("war list failed")), logs.join("\n"));
  assert.equal(backfillPages(torn).length, TICK_PAGES, "the list from an hour ago cannot say whether a war has started since");
  torn.fail = null;
  clock.now += HOUR_MS;
  await c.tick();
  assert.equal(backfillPages(torn).length, 2 * TICK_PAGES, "the pages go on once the list reads again");
});

test("a Torn error ends that hour's pages and keeps their place, and the next tick carries on from it", async () => {
  const torn = fakeTorn({ action: actions(1000, T0 - 60, Math.round(0.3 * DAY)), deposit: [] });
  const { c, clock, logs } = setup({ torn });
  // The second page is refused, as every news read is for a key at Torn's daily read cap.
  torn.fail = (u) => (u.pathname === "/v2/faction/news" && backfillPages(torn).length === 2
    ? reply({ error: { code: 14, error: "Daily read limit reached" } }) : null);
  await c.tick();
  assert.equal(backfillPages(torn).length, 2, "a page, the refusal, and no more that hour");
  assert.ok(logs.some((m) => m.includes("backfill failed: Torn API error: Daily read limit reached (code 14)")), logs.join("\n"));
  const place = c.snapshot().cats.armoryAction.gaps[0].to;
  torn.fail = null;
  clock.now += HOUR_MS;
  await c.tick();
  const pages = backfillPages(torn);
  assert.equal(pages.length, 2 + TICK_PAGES);
  assert.equal(pages[2].url.searchParams.get("to"), String(place), "it carries on from the page before the refusal");
});

test("after a restart the first tick carries on from where the last tick's pages stopped, with no repeats and no gap", async () => {
  const torn = fakeTorn({ action: actions(1000, T0 - 60, Math.round(0.3 * DAY)), deposit: [] });
  const { c, make, clock } = setup({ torn });
  await c.tick();
  const place = c.snapshot().cats.armoryAction.gaps[0].to;
  // The restart comes 20 minutes later, and its tick runs at once.
  clock.now += 20 * 60 * 1000;
  const after = make();
  await after.tick();
  const pages = backfillPages(torn);
  assert.equal(pages.length, 2 * TICK_PAGES);
  assert.equal(pages[TICK_PAGES].url.searchParams.get("to"), String(place));
  for (let hour = 0; hour < 2; hour++) {
    clock.now += HOUR_MS;
    await after.tick();
  }
  const snap = after.snapshot();
  assert.equal(snap.backfillDone, true);
  assert.equal(snap.lines.length, bloodIn(torn, CUTOFF));
});
'''.lstrip("\n")
open(p, "w", encoding="utf-8").write(s)
print("ok")
PY
```

Expected: `ok`.

- [ ] **Step 3: Run the tests to see them fail**

```bash
WS=/opt/warboard/.superpowers/sdd/2026-10-25-blood-bag-backfill-budget
cd $WS/ov && node --test blood-bags.test.js > $WS/red1.txt 2>&1; grep -E '^not ok|^# (tests|pass|fail) ' $WS/red1.txt
```

Expected: six `not ok` lines, one for each new test, then `# tests 41`, `# pass 35`, `# fail 6`.
- Each fails on an assertion, not on the import. `TICK_PAGES` reads as undefined. With the switch's line gone, the old tick never starts the backfill, so no tick takes a page.
- The other 35 pass on the old code. The three tests in ruling 8 never relied on the tick to start the backfill.

- [ ] **Step 4: Write the budget**

```bash
WS=/opt/warboard/.superpowers/sdd/2026-10-25-blood-bag-backfill-budget
python3 -I - $WS/ov/blood-bags.js <<'PY'
import sys
p = sys.argv[1]
s = open(p, encoding="utf-8").read()
def rep(old, new):
    global s
    assert s.count(old) == 1, ("not exactly once", old[:70])
    s = s.replace(old, new)

rep('''// picks up what is new. A one-off backfill, which the hourly tick starts only
// when BLOODBAGS_BACKFILL is 1, walks a year back, at no more than 10 calls a
// minute, and 2 a minute while a ranked war is live, so the war pollers keep the
// key's budget. Both write one store, and a line's own id
''', '''// picks up what is new. A one-off backfill walks a year back, a few pages with
// each hourly tick and none while a ranked war is live, so the war pollers keep
// the key's budget. Both write one store, and a line's own id
''')

rep('''// While a ranked war is live, backfill pages are at least this far apart: 2 a
// minute. The wait is the backfill's own, so the poll is not slowed.
''', '''// While a ranked war is live, backfill pages are at least this far apart: 2 a
// minute. The hourly tick takes no pages during a war, so this paces a run that
// is already going when one starts. The wait is the backfill's own, so the poll
// is not slowed.
''')

rep('''export const HEAD_MAX_PAGES = 30;
''', '''export const HEAD_MAX_PAGES = 30;
// The backfill pages each hourly tick takes, about 96 a day: the year fills in
// over days, on the owner's key, without using up their daily read cap.
export const TICK_PAGES = 4;
''')

rep('''/**
 * Why the backfill is at the war pace, or null at full speed: a live ranked war,
 * or a war list too old to say (a missing warsAt counts as never read). The
 * collector and the route both ask, so the log and the page never disagree.
 */
''', '''/**
 * Why the backfill waits, or null when it may go at full speed: a live ranked
 * war, or a war list too old to say (a missing warsAt counts as never read). The
 * hourly tick takes no pages while there is a reason, a run already going slows
 * to the war pace, and the route tells the page; all three ask here, so the log
 * and the page never disagree.
 */
''')

rep(''' *   dataDir, fetchImpl, nowFn() -> ms, sleepFn(ms), keyFn() -> key or null, log(msg),
 *   backfill (whether the hourly tick starts the backfill; by default, whether
 *   BLOODBAGS_BACKFILL is 1)
''', ''' *   dataDir, fetchImpl, nowFn() -> ms, sleepFn(ms), keyFn() -> key or null, log(msg)
''')

rep('''  const keyFn = opts.keyFn || ownerKey;
  // The year's backfill reads thousands of pages. On the owner's key it would use
  // up Torn's daily read cap in hours, and the owner's own alerts with it, so the
  // hourly tick starts it only when BLOODBAGS_BACKFILL is 1.
  const backfillOn = opts.backfill ?? process.env.BLOODBAGS_BACKFILL === "1";
''', '''  const keyFn = opts.keyFn || ownerKey;
''')

rep('''  async function backfill() {
    load();
    let pages = 0;
    try {
      for (;;) {
''', '''  async function backfill(maxPages) {
    load();
    let pages = 0;
    try {
      while (pages < maxPages) {
''')

rep('''      // tick starts the backfill and moves on, so a save that throws here must
      // not escape: under pm2 an unhandled rejection ends the whole server.
''', '''      // A save that throws here must not escape: under pm2 an unhandled
      // rejection ends the whole server.
''')

rep('''  /**
   * The backfill: fills every gap, newest first, a page per call, GAP_MS apart,
   * or WAR_GAP_MS while a ranked war is live or the war list is out of date. It
   * stops on any error, and the next hourly tick starts it again from where it
   * stopped. Returns the run in progress, which never rejects.
   */
  function runBackfill() {
    if (!backfilling) {
      backfilling = backfill()
''', '''  /**
   * The backfill: fills the gaps, newest first, a page per call, at most
   * maxPages pages (by default all of them), GAP_MS apart, or WAR_GAP_MS while a
   * ranked war is live or the war list is out of date. It stops on any error,
   * and the next hourly tick carries on from where it stopped. A call while a
   * run is going joins that run. Returns the run, which never rejects.
   */
  function runBackfill(maxPages = Infinity) {
    if (!backfilling) {
      backfilling = backfill(maxPages)
''')

rep('''  /**
   * Every hour: the ranked-war list, the poll, then the backfill if it is on
   * and there is work. The war list is read every time, so a war's start and
   * end reach the board within the hour, as everything else does.
   */
  async function tick() {
    if (ticking) return;
    ticking = true;
    try {
      load();
      await refreshWars();
      await pollOnce();
      if (backfillOn && hasGaps()) runBackfill();
''', '''  /**
   * Every hour: the ranked-war list, the poll, then up to TICK_PAGES pages of
   * the backfill. The war list is read every time, so a war's start and end
   * reach the board within the hour, as everything else does. No pages while a
   * ranked war is live, nor in an hour whose read of the list failed: the list
   * from the hour before still counts as fresh, but cannot say whether a war
   * has started since. Resolves once the hour's pages are done.
   */
  async function tick() {
    if (ticking) return;
    ticking = true;
    try {
      load();
      const listed = await refreshWars();
      await pollOnce();
      if (listed && hasGaps() && slowReason(data.wars, data.warsAt, nowFn()) === null) await runBackfill(TICK_PAGES);
''')

rep('''/** server.js starts the hourly poll, and the backfill when it is on, with this. */
''', '''/** server.js starts the hourly poll, and with it the backfill's pages, with this. */
''')
open(p, "w", encoding="utf-8").write(s)
print("ok")
PY
cd $WS/ov && node --check blood-bags.js && echo syntax-ok
```

Expected: `ok`, `syntax-ok`.

- [ ] **Step 5: Run the tests to see them pass**

```bash
WS=/opt/warboard/.superpowers/sdd/2026-10-25-blood-bag-backfill-budget
cd $WS/ov && node --test blood-bags.test.js > $WS/green1.txt 2>&1; grep -E '^not ok|^# (tests|pass|fail) ' $WS/green1.txt
grep -c 'BLOODBAGS_BACKFILL\|backfillOn' $WS/ov/blood-bags.js $WS/ov/blood-bags.test.js
```

Expected:
- `# tests 41`, `# pass 41`, `# fail 0`.
- The three tests in ruling 8 pass unchanged.
- `blood-bags.js:0` and `blood-bags.test.js:0`.

- [ ] **Step 6: Amend the spec**

```bash
SPEC=/opt/warboard/docs/superpowers/specs/2026-10-24-faction-blood-bag-board-design.md
python3 -I - $SPEC <<'PY'
import sys
p = sys.argv[1]
s = open(p, encoding="utf-8").read()
def rep(old, new):
    global s
    assert s.count(old) == 1, ("not exactly once", old[:70])
    s = s.replace(old, new)

rep("and again that day when the owner chose to load history at 2 calls a minute during a ranked war (Q14).",
    "and again that day when the owner chose to load history at 2 calls a minute during a ranked war (Q14). "
    "On 2026-10-25 the owner moved the board to their own key (Q7) and chose how the backfill spends it: 4 pages each hour, none during a ranked war (Q14).")

rep('| Q14 | History is filled in once, a year back, at no more than 10 calls a minute, and no more than 2 a minute while a ranked war is live. '
    'The owner chose this on 2026-10-24; at first it waited for the war to end. Since 2026-10-25 the hourly tick starts it only when '
    '`BLOODBAGS_BACKFILL` is 1 (see The one-year backfill). "All time" means since that date. |',
    '| Q14 | History is filled in once, a year back, a little each hour: since 2026-10-25 each hourly tick takes up to 4 pages of it, about 96 a day, '
    'and none while a ranked war is live or in an hour when the war list could not be read. The owner chose this after the backfill had used up '
    "a key's daily read allowance. Before that it went at up to 10 calls a minute, and 2 a minute during a war. \"All time\" means since the date it reaches back to. |")

rep("- **Cost:** about 3 calls an hour: one page of each category, and the ranked-war list.",
    "- **Cost:** about 3 calls an hour: one page of each category, and the ranked-war list, plus up to 4 backfill pages until the year is filled in.")

rep("- The hourly tick starts it only when `BLOODBAGS_BACKFILL` is 1. On the owner's key it would use up Torn's daily read cap in hours, "
    "and the owner's own alerts with it, so since 2026-10-25 it is off until the owner chooses how much of that allowance it may spend.\n",
    "- Each hourly tick, after the war list and the poll, takes up to 4 pages of it (`TICK_PAGES`), about 96 a day, newest gap first. "
    "It takes none while a ranked war is live, and none in an hour whose read of the war list failed, even though the list from the hour before "
    "is still under 65 minutes old: that list cannot say whether a war has started since. An error ends that hour's pages, and the next tick "
    "carries on from the same place. The owner chose this on 2026-10-25: at full speed the backfill had used up a key's daily read allowance, "
    "and on the owner's key it would take the owner's alerts with it. A server start runs a tick at once, so each restart adds a tick's pages.\n")

rep("- No more than 10 calls a minute, and no more than 2 a minute (a page every 30 seconds) while a ranked war is live, so the war pollers keep "
    "the key's budget. The hourly poll is not slowed: its calls go out between the backfill's pages.\n",
    "- Its pages and the poll's go no faster than 10 calls a minute together. If a ranked war starts while a tick's pages are going, the rest "
    "go at 2 a minute (a page every 30 seconds), so the war pollers keep the key's budget. The hourly poll is not slowed: its calls go out "
    "between the backfill's pages.\n")

rep("- **Cost:** about 1,300 calls: a little over 2 hours at 10 a minute, or about 11 hours at the war pace.",
    "- **Cost:** about 1,300 calls in all. About 1,000 were left on 2026-10-25, when the hourly budget began: at 4 an hour, about 10 days of hours with no ranked war.")

rep("- The backfill: its pace, the slower pace while a war is live or the war list is out of date, the poll going on beside it, and resuming from its saved place.\n",
    "- The backfill: the hourly tick's 4 pages; none while a war is live or in an hour whose war-list read failed; an error ending the hour's pages; "
    "the next tick, or the first after a restart, carrying on from the saved place; the year's last pages; its pace, the slower pace for a run "
    "that is going when a war starts, and the poll going on beside it.\n")

rep("- The backfill starts on its own after the reload and runs for about 2 hours, or about 11 at the war pace while a ranked war is live.\n",
    "- After the reload the backfill goes on at up to 4 pages each hourly tick, outside ranked wars, until the year is done.\n")
open(p, "w", encoding="utf-8").write(s)
print("ok")
PY
cd /opt/warboard && git diff --stat -- $SPEC; grep -c BLOODBAGS_BACKFILL $SPEC
```

Expected: `ok`, 1 file changed, and `0`.

- [ ] **Step 7: Install, run in place, commit**

```bash
WS=/opt/warboard/.superpowers/sdd/2026-10-25-blood-bag-backfill-budget
uptime
install -o root -g root -m 644 $WS/ov/blood-bags.js $WS/ov/blood-bags.test.js /opt/warboard/server/
cd /opt/warboard/server && node --test blood-bags-model.test.js blood-bags.test.js blood-bags-route.test.js blood-bags-page.test.js 2>&1 | grep -E '^not ok|^# (tests|pass|fail) '
cd /opt/warboard && git commit -q -F - -- server/blood-bags.js server/blood-bags.test.js docs/superpowers/specs/2026-10-24-faction-blood-bag-board-design.md <<'EOF'
blood-bags: the year backfill takes 4 pages each hourly tick, none during a ranked war

The backfill was held behind BLOODBAGS_BACKFILL after it used up a key's
daily read allowance. At the owner's choice, each hourly tick now takes up
to 4 pages of the year after its war-list read and its poll, about 96 a
day on the owner's key. It takes none while a ranked war is live, nor in
an hour whose read of the war list failed. An error ends that hour's
pages, and the next tick carries on from the same place. The tick waits
for its pages, and the switch is gone.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
git log --oneline -1; git status --short -- server/blood-bags.js server/blood-bags.test.js docs/superpowers/specs/
```

Expected:
- No `not ok`; `# tests 110`, `# pass 110`, `# fail 0` (33 model, 41 collector, 21 route, 15 page).
- One new commit. The status lines are empty.

---

### Task 2: The page says what the rest of the year waits for

**Files:**
- Modify: `server/blood-bags.js`, the `backfillSlow` line and its comment in the route's answer (lines 578–579 after Task 1).
- Modify: `server/pages/bloodbags.html`, `noteText` (lines 172–173).
- Test: `server/blood-bags-route.test.js` (lines 160, 166 and 263–275) and `server/blood-bags-page.test.js` (lines 112–115, 119–126 and 194).
- Modify: the spec's note in Edge cases (line 142).

**Interfaces:**
- Consumes: the snapshot's `backfillDone`, `wars` and `warsAt`, and `slowReason()`, unchanged by Task 1.
- Produces: `backfillHeld` in the `/api/bloodbags` answer, a boolean, in place of `backfillSlow`. The page's `noteText(d)` reads `d.liveWar` and `d.backfillHeld`.

- [ ] **Step 1: Write the failing tests**

```bash
WS=/opt/warboard/.superpowers/sdd/2026-10-25-blood-bag-backfill-budget
python3 -I - $WS/ov/blood-bags-route.test.js $WS/ov/blood-bags-page.test.js <<'PY'
import sys
def edit(p, pairs):
    s = open(p, encoding="utf-8").read()
    for old, new in pairs:
        assert s.count(old) == 1, ("not exactly once", p, old[:70])
        s = s.replace(old, new)
    open(p, "w", encoding="utf-8").write(s)
route, page = sys.argv[1], sys.argv[2]

edit(route, [
  ('"backfillDone", "backfillSlow", "fromSec",', '"backfillDone", "backfillHeld", "fromSec",'),
  ("  assert.equal(body.backfillSlow, true);\n", "  assert.equal(body.backfillHeld, true);\n"),
  ('''test("the answer says when the backfill is at the war pace: a live war, or a war list too old to say", async () => {
  const slow = async (snap) => {''',
   '''test("the answer says when the rest of the year is on hold: a live war, or a war list too old to say", async () => {
  const held = async (snap) => {'''),
  ('''    return (await get(api, token(1))).body.backfillSlow;
  };
  assert.equal(await slow({}), false, "a list read 10 minutes ago, with no war");
  assert.equal(await slow({ wars: [{ id: 51418, start: NOW - 86400, end: 0 }] }), true, "a live war");
  assert.equal(await slow({ warsAt: NOW * 1000 - 66 * MIN_MS }), true, "a list over 65 minutes old");
  assert.equal(await slow({ warsAt: 0 }), true, "a list never read");
  assert.equal(await slow({ warsAt: 0, backfillDone: true }), false, "nothing left to fill in");''',
   '''    return (await get(api, token(1))).body.backfillHeld;
  };
  assert.equal(await held({}), false, "a list read 10 minutes ago, with no war");
  assert.equal(await held({ wars: [{ id: 51418, start: NOW - 86400, end: 0 }] }), true, "a live war");
  assert.equal(await held({ warsAt: NOW * 1000 - 66 * MIN_MS }), true, "a list over 65 minutes old");
  assert.equal(await held({ warsAt: 0 }), true, "a list never read");
  assert.equal(await held({ warsAt: 0, backfillDone: true }), false, "nothing left to fill in");'''),
])

edit(page, [
  ('''    "History so far reaches back to 20 Oct; the rest of the year is still being filled in.");
  assert.equal(P.noteText({ updatedAt: 1, backfillDone: false, reachSec: reach, liveWar: { id: 1 } }),
    "History so far reaches back to 20 Oct; the rest of the year is still being filled in, slowly while the ranked war is on.");''',
   '''    "History so far reaches back to 20 Oct; the rest of the year is still being filled in, a little each hour.");
  assert.equal(P.noteText({ updatedAt: 1, backfillDone: false, reachSec: reach, liveWar: { id: 1 } }),
    "History so far reaches back to 20 Oct; the rest of the year fills in after the ranked war.");'''),
  ('''test("the note says the history fills in slowly while the war list is out of date, too", () => {
  const { P } = page();
  const reach = Date.UTC(2026, 9, 20) / 1000;
  assert.equal(P.noteText({ updatedAt: 1, backfillDone: false, reachSec: reach, liveWar: null, backfillSlow: true }),
    "History so far reaches back to 20 Oct; the rest of the year is still being filled in, slowly.");
  assert.equal(P.noteText({ updatedAt: 1, backfillDone: false, reachSec: reach, liveWar: { id: 1 }, backfillSlow: true }),
    "History so far reaches back to 20 Oct; the rest of the year is still being filled in, slowly while the ranked war is on.");''',
   '''test("the note says the rest of the year is on hold while the war list is out of date", () => {
  const { P } = page();
  const reach = Date.UTC(2026, 9, 20) / 1000;
  assert.equal(P.noteText({ updatedAt: 1, backfillDone: false, reachSec: reach, liveWar: null, backfillHeld: true }),
    "History so far reaches back to 20 Oct; the rest of the year is on hold for now.");
  assert.equal(P.noteText({ updatedAt: 1, backfillDone: false, reachSec: reach, liveWar: { id: 1 }, backfillHeld: true }),
    "History so far reaches back to 20 Oct; the rest of the year fills in after the ranked war.");'''),
  ('''    "History so far reaches back to 20 Oct; the rest of the year is still being filled in. " +''',
   '''    "History so far reaches back to 20 Oct; the rest of the year is still being filled in, a little each hour. " +'''),
])
print("ok")
PY
```

Expected: `ok`.

- [ ] **Step 2: Run them to see them fail**

```bash
WS=/opt/warboard/.superpowers/sdd/2026-10-25-blood-bag-backfill-budget
cd $WS/ov && for t in blood-bags-route.test.js blood-bags-page.test.js; do node --test $t > $WS/red2-$t.txt 2>&1; grep -E '^not ok|^# (tests|pass|fail) ' $WS/red2-$t.txt; done
```

Expected:
- Route: `not ok` for "the answer carries everything the page reads" and "the answer says when the rest of the year is on hold: a live war, or a war list too old to say"; `# tests 21`, `# pass 19`, `# fail 2`.
- Page: `not ok` for "the note says when there is no data yet, and how far back the history reaches while it fills in", "the note says the rest of the year is on hold while the war list is out of date" and "the note says when the first update failed, and when the member list may be out of date"; `# tests 15`, `# pass 12`, `# fail 3`.

- [ ] **Step 3: Write the field and the note**

```bash
WS=/opt/warboard/.superpowers/sdd/2026-10-25-blood-bag-backfill-budget
python3 -I - $WS/ov/blood-bags.js $WS/ov/pages/bloodbags.html <<'PY'
import sys
def edit(p, pairs):
    s = open(p, encoding="utf-8").read()
    for old, new in pairs:
        assert s.count(old) == 1, ("not exactly once", p, old[:70])
        s = s.replace(old, new)
    open(p, "w", encoding="utf-8").write(s)

edit(sys.argv[1], [
  ('''        // Whether the rest is filling in at the war pace, so the page can say "slowly".
        backfillSlow: !snap.backfillDone && slowReason(snap.wars, snap.warsAt, nowMs) !== null,
''', '''        // Whether the rest of the year is on hold, for a live war or a war list too
        // old to say, so the page can say what it waits for.
        backfillHeld: !snap.backfillDone && slowReason(snap.wars, snap.warsAt, nowMs) !== null,
'''),
])
edit(sys.argv[2], [
  ('''    notes.push("History so far reaches back to " + dayMonth(d.reachSec) + "; the rest of the year is still being filled in" +
      (d.liveWar ? ", slowly while the ranked war is on." : d.backfillSlow ? ", slowly." : "."));
''', '''    notes.push("History so far reaches back to " + dayMonth(d.reachSec) + "; the rest of the year " +
      (d.liveWar ? "fills in after the ranked war." : d.backfillHeld ? "is on hold for now." : "is still being filled in, a little each hour."));
'''),
])
print("ok")
PY
cd $WS/ov && node --check blood-bags.js && echo syntax-ok
LC_ALL=C grep -c -P '[^\x00-\x7F]' $WS/ov/pages/bloodbags.html
```

Expected: `ok`, `syntax-ok`, and `0` (the page is still all ASCII).

- [ ] **Step 4: Run them to see them pass**

```bash
WS=/opt/warboard/.superpowers/sdd/2026-10-25-blood-bag-backfill-budget
cd $WS/ov && for t in blood-bags.test.js blood-bags-route.test.js blood-bags-page.test.js; do echo "$t: $(node --test $t 2>&1 | grep -E '^# (tests|pass|fail) ' | paste -sd' ')"; done
grep -rn 'backfillSlow' $WS/ov/*.js $WS/ov/pages/bloodbags.html | grep -v node_modules
```

Expected:
```
blood-bags.test.js: # tests 41 # pass 41 # fail 0
blood-bags-route.test.js: # tests 21 # pass 21 # fail 0
blood-bags-page.test.js: # tests 15 # pass 15 # fail 0
```
and no `backfillSlow` left.

- [ ] **Step 5: Amend the spec**

```bash
SPEC=/opt/warboard/docs/superpowers/specs/2026-10-24-faction-blood-bag-board-design.md
python3 -I - $SPEC <<'PY'
import sys
p = sys.argv[1]
s = open(p, encoding="utf-8").read()
old = ('- While the backfill runs, the page says how far back the data reaches so far, and, whenever the backfill is at the war pace, '
       'that the rest is filling in slowly: "slowly while the ranked war is on" during a war, and just "slowly" while the war list is out of date. '
       '"All time" means that far, and no shorter timeframe starts before it.\n')
new = ('- While the backfill has work left, the page says how far back the data reaches so far, and when the rest comes: '
       '"the rest of the year fills in after the ranked war" during a war, "the rest of the year is on hold for now" while the war list is out of date, '
       'and otherwise "the rest of the year is still being filled in, a little each hour". '
       '"All time" means that far, and no shorter timeframe starts before it.\n')
assert s.count(old) == 1, "the note line is not there exactly once"
s = s.replace(old, new)
open(p, "w", encoding="utf-8").write(s)
print("ok")
PY
grep -c 'slowly' $SPEC
```

Expected: `ok` and `0`.

- [ ] **Step 6: Install, run in place, commit**

Installing the page puts the new note live at once (ruling 9).

```bash
WS=/opt/warboard/.superpowers/sdd/2026-10-25-blood-bag-backfill-budget
uptime
install -o root -g root -m 644 $WS/ov/blood-bags.js $WS/ov/blood-bags-route.test.js $WS/ov/blood-bags-page.test.js /opt/warboard/server/
install -o root -g root -m 644 $WS/ov/pages/bloodbags.html /opt/warboard/server/pages/
cd /opt/warboard/server && node --test blood-bags-model.test.js blood-bags.test.js blood-bags-route.test.js blood-bags-page.test.js 2>&1 | grep -E '^not ok|^# (tests|pass|fail) '
curl -s http://127.0.0.1:3000/bloodbags | grep -c 'fills in after the ranked war'
cd /opt/warboard && git commit -q -F - -- server/blood-bags.js server/blood-bags-route.test.js server/blood-bags-page.test.js server/pages/bloodbags.html docs/superpowers/specs/2026-10-24-faction-blood-bag-board-design.md <<'EOF'
blood-bags: the page says what the rest of the year waits for

While the history is still filling in, the note says the rest of the
year fills in after the ranked war, is on hold while the war list is
out of date, or is being filled in a little each hour. The API's
backfillSlow becomes backfillHeld, with the same meaning.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
git log --oneline -1; git status --short -- server/blood-bags.js server/blood-bags-route.test.js server/blood-bags-page.test.js server/pages/ docs/superpowers/specs/
```

Expected:
- No `not ok`; `# tests 110`, `# pass 110`, `# fail 0`.
- `1`: the served page already has the new wording.
- One new commit; the status lines are empty.

The final review (ruling 12) runs now, before Task 3.

---

### Task 3: Release and the live check

**Files:** none changed. It writes `$WS/gaps-before.txt`, `$WS/gaps-after.txt`, `$WS/deploy.txt` and `$WS/sweep.txt`, which are never committed.

**Interfaces:**
- Consumes:
  - the installed `server/blood-bags.js` and `server/pages/bloodbags.html`;
  - the store `server/data/blood-bags/42055.json`, read only;
  - `/api/debug/key-usage-local`, which counts the collector's calls under `bySource["blood-bags"]` in memory, so it starts empty at the reload.
- Produces: the live release.

- [ ] **Step 1: Note the store's place, check for other sessions' code, then deploy**

```bash
uptime
WS=/opt/warboard/.superpowers/sdd/2026-10-25-blood-bag-backfill-budget
python3 -I -c '
import json
d = json.load(open("/opt/warboard/server/data/blood-bags/42055.json"))
print(json.dumps({c: v["gaps"] for c, v in d["cats"].items()}, sort_keys=True))' > $WS/gaps-before.txt; cat $WS/gaps-before.txt
cd /opt/warboard && P=$(pm2 pid warboard); ISO=$(date -d "$(ps -o lstart= -p $P)" '+%Y-%m-%dT%H:%M:%S'); echo "running since $ISO (box time)"
find server -path server/node_modules -prune -o -path server/data -prune -o -path server/public -prune -o -type f \( -name '*.js' -o -name '*.mjs' -o -name '*.cjs' -o -name '*.html' -o -name '*.json' \) -newermt "$ISO" -print
git status --short -- server | grep -v -E ' server/(data|public)/' | grep -v '^??'
```

Expected:
- One gap for each category, both starting at the year's floor.
- `find` lists only this plan's files: `server/blood-bags.js`, `server/blood-bags.test.js`, `server/blood-bags-route.test.js`, `server/blood-bags-page.test.js` and `server/pages/bloodbags.html`. There are fewer if warboard has been reloaded since they were installed.
- `git status` shows only ` M server/war-history.js`, another session's change from 2026-09-29. It is older than the running process, so the reload changes nothing there.
- Anything else in either list is another session's newer code, which the reload would put live: stop and ask the owner first.

Then:

```bash
WS=/opt/warboard/.superpowers/sdd/2026-10-25-blood-bag-backfill-budget
echo "reload at $(TZ=America/New_York date '+%H:%M %Z')"
/opt/warboard/server/deploy.sh > $WS/deploy.txt 2>&1; echo "exit $?" >> $WS/deploy.txt
grep -E '^# (fail|skipped) |^deploy ok|UNHEALTHY|REFUSING|^\{"status|^exit ' $WS/deploy.txt | cut -c1-160
```

Expected: `# fail 0`, `{"status":"ok",…}`, `deploy ok` and `exit 0`. The whole suite's totals depend on other sessions' tests, so they are not pinned here.

- [ ] **Step 2: The process, the log and the page**

```bash
P=$(pm2 pid warboard); echo "pid $P user $(ps -o user= -p $P)"
pm2 logs warboard --lines 3000 --nostream 2>&1 | grep -a 'blood-bags' | cut -c1-200 | tail -6
curl -s http://127.0.0.1:3000/bloodbags | grep -c 'fills in after the ranked war'
```

Expected:
- A new pid, user `warboard`.
- No `backfill` line after the reload: war 51418 is live, so the start's tick takes no pages.
  - While the owner's daily cap holds, there are two `poll failed: Torn API error: Daily read limit reached (code 14)` lines, one for each category.
  - Once the cap has cleared, there is no poll line at all.
- No `store unreadable` and no `war list failed`.
- `1` for the page's wording.
- If war 51418 has ended by now, the start's tick takes 4 pages instead. A `backfill at 10 calls a minute: no ranked war is live` line shows, and Step 3 sees the gaps move. Say so in the report.

- [ ] **Step 3: The store and the call count**

A minute or two after the reload:

```bash
WS=/opt/warboard/.superpowers/sdd/2026-10-25-blood-bag-backfill-budget
python3 -I -c '
import json,time
d = json.load(open("/opt/warboard/server/data/blood-bags/42055.json"))
edt = lambda ms: time.strftime("%m-%d %H:%M EDT", time.gmtime(ms / 1000 - 4 * 3600)) if ms else None
print(json.dumps({c: v["gaps"] for c, v in d["cats"].items()}, sort_keys=True))
print("warsAt", edt(d["warsAt"]), "lastPollAt", edt(d["lastPollAt"]), "lastPollOk", d["lastPollOk"])' > $WS/gaps-after.txt
head -1 $WS/gaps-after.txt | cmp -s - $WS/gaps-before.txt && echo "gaps unchanged" || echo "gaps moved"
tail -1 $WS/gaps-after.txt
curl -s --max-time 10 'http://127.0.0.1:3000/api/debug/key-usage-local?window=5' | python3 -I -c '
import json,sys
d = json.load(sys.stdin)
print(d["bySource"].get("blood-bags", 0), "blood-bags calls in the last", d["windowMin"], "min")'
```

Expected:
- `gaps unchanged`, while war 51418 is live.
- `warsAt` within a minute of the reload.
- `lastPollOk` is `False` while the owner's cap holds. Once it clears, it is `True`, with `lastPollAt` at the reload.
- About 3 blood-bags calls: the war list and one page of each category. There are more if the cap has cleared and the poll caught up, up to 30 pages a category. None of them is a backfill page.

- [ ] **Step 4: Push**

Write the sweep patterns to `$WS/sweep.txt`, one per line. They are the four key endings and the other member's player id from the session's notes, the owner's email address, and the screenshot links' URL prefix (see the shot-upload memory). They never go into the repo. Then:

```bash
WS=/opt/warboard/.superpowers/sdd/2026-10-25-blood-bag-backfill-budget
cd /opt/warboard && git log --oneline origin/main..main
test -s $WS/sweep.txt && echo "sweep hits: $(git diff origin/main..main | grep -E '^\+' | grep -c -i -F -f $WS/sweep.txt)"
git diff origin/main..main | grep -E '^\+' | grep -n -o -E '(^|[^A-Za-z0-9_])[A-Za-z0-9]{16}([^A-Za-z0-9_]|$)' | head
```

Expected:
- The commits since the last push: this plan's commit and Tasks 1 and 2, and any review-fix commits.
- `sweep hits: 0`.
- Any 16-character word is plainly not a key, or there are none.

Then:

```bash
cd /opt/warboard && git push origin main 2>&1 | sed -E 's#//[^@]*@#//***@#g' | tail -n 3; git status -sb | head -1
```

Expected: `main -> main`, and `## main...origin/main`.

- [ ] **Step 5: Memory**

In `/root/.claude/projects/-root/memory/project_blood_bag_board.md`:
- Update the frontmatter description: the budget is live (4 pages each hourly tick, none during a ranked war or after a failed war-list read), with the commits.
- Replace the 2026-10-25 section's OPEN line about the backfill with:
  - what shipped and when (EDT);
  - the owed checks from Step 6.
- Keep its `MEMORY.md` line under 200 characters. `MEMORY.md` stays at 200 lines.

- [ ] **Step 6: Report**

Tell the owner, in EDT:
- What changed:
  - The history fills in at up to 4 pages an hour, about a month of history a day, outside ranked wars.
  - The year should be done after about 10 war-free days.
  - During war 51418 the page says the rest of the year fills in after the war.
- What the release check saw:
  - the reload;
  - the poll's state against the cap;
  - no backfill page during the war;
  - the page's wording.
- Owed, not claimed:
  - the first hour of pages after war 51418 ends: 4 backfill pages that hour, about 7 blood-bags calls, and the history's reach moving back about a day;
  - a day's watch with no code 14 from the board's own use.
- "Rulings I made" and "Deferred minors" from the ledger, as executing-plans asks.
