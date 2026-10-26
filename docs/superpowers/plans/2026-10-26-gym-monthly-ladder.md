# /gym Monthly Top-25 Ladder - Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** /gym gets a monthly top-25 energy ladder. This month's top 25 shows under Standings, with "Month ends in" in its header. Each finished month's top 25 is saved by itself when the month ends and listed under Previous winners.

**Architecture:**
- The month is scored exactly like the week, from the readings warboard already takes every 5 minutes (Torn's per-stat gym-energy contributors for the faction). No new Torn calls, routes or data files.
- `server/gym-comp-model.js` (pure functions) gets the month beside the week, built on the same `standings()`, `baselineFor()` and `latestUpTo()`.
- `server/gym-comp.js` saves finished months into the results file the weeks already live in (`data/gym-comp/42055-results.json` gains `months`), and `board()`, which `/api/gym` returns, gains `month` and `months`.
- `server/pages/gym.html` gets a month card under Standings and a Previous months card under Previous winners.
- All work happens in a git worktree on a branch, because the main checkout is the tree tornwar.com serves.

**Tech Stack:** Node ESM (express under pm2), node:test. Page tests cut the page's named functions out of gym.html and run them in node:vm, as `server/gym-hof.test.mjs` already does.

**Spec:** none on disk. This is a bounded change to an existing page, and the owner approved its design in chat (below). That design is the binding authority; Global Constraints copy it.

**The ask:**
- 12:46 EDT on 2026-10-26, the owner: "for /gym can we creatw a top 25 monthly ladder". At 12:47: "we can start november 1st if you cant get the top 25 energy trained for this entire month".
- Facts found: the readings began on 2026-09-13, and one was taken at 2026-09-30 23:59:29 TCT. So October counts in full, and September cannot.
- Four questions went to the owner. At 16:14 EDT the owner said "do recommended", which approved:
  1. a ladder only, no prize; the weekly 5 x Xanax stays;
  2. members who join mid-month are ranked from their first reading in the month, and marked "joined Oct 12";
  3. each finished month's final top 25 is saved automatically when it ends, like the weeks, and shown on /gym with last month open and older months folded;
  4. a new card under Standings, with "Month ends in" in its header.

**Execution:** the owner chooses at the handoff; Native is recommended. One session works the tasks, then one fresh Opus reviewer checks the whole branch between Task 3 and Task 4.

**Dry run:** all the code in this plan ran while the plan was written, on copies of main's files at 0ae10ff7, with the three untracked gym files at the hashes in Setup. The plan's code blocks were read back out of this file and replayed in order:
- Task 1's tests: `# tests 1 # pass 0 # fail 1` before its code, `# tests 42 # pass 42 # fail 0` after (with the week's tests).
- Task 2's: `# tests 6 # pass 0 # fail 6` before, `# tests 48 # pass 48 # fail 0` after, with nothing written outside the temp directory either time.
- Task 3's: `# tests 12 # pass 0 # fail 12` before, `# tests 19 # pass 19 # fail 0` after (with the Previous-winners tests).
- All five gym test files together: `# tests 67 # pass 67 # fail 0`.
- Mutants: 17 of 17 caught. Among them: the finish line a millisecond before midnight, joiners scored zero, a joiner measured from last month, September saved, a frozen week dropping the months, a joiner's first reading thinned away, and the month's countdown stopping with the week's.
- The screenshot step's script ran on the replayed page at 390 and 860 px.
- Read-only on the live readings, the model gives October's top 25 from the 2026-09-30 23:59:29 TCT start line, not a late start. The joiner rule in `thin()` keeps no extra reading in today's file; from now on it keeps the one reading each joiner first appears in.

## Global Constraints

- The month is the calendar month in TCT, which is UTC: the 1st 00:00 to the last day 23:59:59.999.
- The score is the week's: energy trained in the gym between two of warboard's own readings (`standings()`), clamped at 0. The split ("all dex") shows only when both readings carry per-stat figures.
- Start line: the last reading at or before the 1st 00:00. Finish line: the last reading at or before the next 1st 00:00, which is the next month's start line.
- Current members only (the members in the latest reading), and only those who trained (energy above 0). At most 25 rows. A tie at #25 is broken by name, the order `standings()` already uses.
- A member missing from the start line is scored from their own first reading in the month (`joinedAt`). The page marks them "joined Oct 12": fixed English month names, UTC date.
- A month is saved only if a reading exists at or before its 1st 00:00, so September 2026 is never saved. A saved month is `{ monthStart, monthEnd, top, baselineAt, finalAt }`, newest first in `months`.
- No prize on the month. The weekly card, its prize chip and the weekly rules are unchanged.
- Same sign-in as /gym: the month comes in the existing `/api/gym` reply (signed in, Dead Fragment only). No new route.
- No new Torn API calls. Polling and retention are unchanged. Thinning changes in one way only: the reading a member first appears in is kept (Task 2).
- The repo is public. Tests use fake names only (Ada, Bo, NewGuy, Abe, Zed, M0 to M24). No member names, ids or numbers from the live data go in code, tests, commits or docs.
- Stage only this plan's paths: other sessions' dirty files in the main checkout stay as they are. Every commit ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **The new page meets the old server.** `/gym` reads gym.html from disk on every request, so the page goes live the moment the fast-forward lands. Until the pm2 reload, the running server still sends the old `/api/gym` reply, with no `month` and no `months`. The weekly board must work as before, with the month cards hidden. Task 3's test "a reply from before the server knew about months leaves the month cards out" pins it.
2. **Weeks and months share one results file.** On 1 November both freeze in the same poll, because the week and the month turn over at the same midnight. Freezing a week must not drop the saved months, and saving a month must not drop the frozen weeks. Task 2's tests "saving a month keeps the weeks already frozen" and "freezing a week keeps the months already saved" pin it.
3. **A joiner's first hour.** After two days, thinning keeps only the last reading of each hour. A member who first appears at 09:03 would then be measured from 09:58, and their score would drop two days after they joined. Task 2's test "the reading somebody first appears in is never thinned away" pins it.
4. **A counter below its start line** (a bad reading). The member scores 0 and stays off the ladder, never negative. Task 1's test "a counter below its start line scores zero and stays off the ladder" pins it.
5. **The countdowns at their ends.** After the month ends its countdown reads "scoring...", and the week ending must not stop the month's countdown (the old `countdown()` returned early once the week was over). Task 3's tests "the month's countdown reads scoring... once the month has ended" and "the month keeps counting down after the week has ended" pin it.

Also pinned: a reading at exactly 00:00 on the 1st ends one month and starts the next, so every unit of energy counts once (Task 1); a tie at #25 (Task 1); September never saved (Task 1).

## Paths and commands

- `W=/opt/warboard/.superpowers/sdd/2026-10-26-gym-monthly-ladder` is this plan's git-ignored workspace, and `WT=$W/wt` the worktree, on branch `gym-monthly-ladder`.
- Test runs write to `$W/t.log` and print the `# tests`, `# pass` and `# fail` lines, then any `not ok` lines.
- **Edits:** each "Replace" block's text occurs in its file exactly once, and the "With" block takes its place. Neither block holds the newline that ends its last line. Make a task's edits in the order given. An "Append" block goes after the file's last line, with one blank line between.

## Setup

- [ ] **Step 1: Commit this plan on main, then make the worktree:**

```bash
uptime; cd /opt/warboard && git add -- docs/superpowers/plans/2026-10-26-gym-monthly-ladder.md && git commit -q -m "plan: /gym monthly top-25 ladder" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- docs/superpowers/plans/2026-10-26-gym-monthly-ladder.md && W=/opt/warboard/.superpowers/sdd/2026-10-26-gym-monthly-ladder && mkdir -p "$W" && git worktree add -q "$W/wt" -b gym-monthly-ladder && ln -s /opt/warboard/server/node_modules "$W/wt/server/node_modules" && git -C "$W/wt" status --short && git -C "$W/wt" log --format='%h %s' -1
```

Expected: the load under 12, then `?? server/node_modules`, then the plan's commit.

- [ ] **Step 2: Adopt the three gym files main has never tracked.** `routes.js` and `server.js` have imported `./gym-comp.js` since 2026-09-13, but `gym-comp.js`, `gym-comp-model.js` and `gym-comp-model.test.mjs` were never committed. They sit untracked in the main checkout, so the worktree has none of them. Tasks 1 and 2 edit two of them, so the branch adopts all three first, byte for byte. Write the hashes they had when this plan was written, and check the main checkout's copies against them:

```bash
W=/opt/warboard/.superpowers/sdd/2026-10-26-gym-monthly-ladder; printf '%s\n' "298b8ee8906eed244df2784abba3d622cea8c5c68f78c6b0c73975f03b819e18  gym-comp.js" "a69db13c736090a84532d1cbbb5a466218243ea53891cb51f972a9f57cdb428b  gym-comp-model.js" "0a33555a5829660cd47d514e4b13b0229c3c20cd9f96e3eccdcd5c33f88189bc  gym-comp-model.test.mjs" > "$W/untracked.sha256" && cd /opt/warboard/server && sha256sum -c "$W/untracked.sha256" && cp -p gym-comp.js gym-comp-model.js gym-comp-model.test.mjs "$W/wt/server/" && cd "$W/wt/server" && sha256sum -c "$W/untracked.sha256"
```

Expected: `OK` for each of the three files, twice. If the first check fails, stop and ask: the live file changed after this plan was written, and its Replace blocks may no longer match.

- [ ] **Step 3: The secrets sweep.** It lives outside the repo, and Setup and Task 4 both use it.

Write `$W/sweep-env.mjs`:

```js
// Fails if any given file holds a value from /opt/warboard/server/.env (8 chars or more).
// Prints the names of the settings it finds, never their values.
import fs from "node:fs";
const env = fs.readFileSync("/opt/warboard/server/.env", "utf8").split("\n")
  .map((l) => l.match(/^\s*([A-Za-z_0-9]+)\s*=\s*(.*)$/)).filter(Boolean)
  .map((m) => [m[1], m[2].trim().replace(/^["']|["']$/g, "")]).filter(([, v]) => v.length >= 8);
let hits = 0;
for (const f of process.argv.slice(2)) {
  const s = fs.readFileSync(f, "utf8");
  for (const [k, v] of env) if (s.includes(v)) { console.log("HIT", k, "in", f); hits++; }
}
console.log(hits ? "SWEEP FAILED" : `sweep clean (${env.length} values checked)`);
process.exit(hits ? 1 : 0);
```

- [ ] **Step 4: Sweep the three files, then commit them:**

```bash
W=/opt/warboard/.superpowers/sdd/2026-10-26-gym-monthly-ladder; cd "$W/wt/server" && grep -noE '(^|[^A-Za-z0-9])[A-Za-z0-9]{16}([^A-Za-z0-9]|$)' gym-comp.js gym-comp-model.js gym-comp-model.test.mjs; node "$W/sweep-env.mjs" gym-comp.js gym-comp-model.js gym-comp-model.test.mjs && cd "$W/wt" && git add -- server/gym-comp.js server/gym-comp-model.js server/gym-comp-model.test.mjs && git commit -q -m "gym: track the competition's server files" -m "routes.js and server.js have imported gym-comp.js since 2026-09-13, but it, its model and its tests were never committed, so a clean checkout could not start the server. Added byte for byte as they run." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- server/gym-comp.js server/gym-comp-model.js server/gym-comp-model.test.mjs && git log --format='%h %s' -1 && git status --short
```

Expected: one 16-character word, `gym-comp.js:128:.getFactionApiKey(` (a function name), then `sweep clean (<n> values checked)`, the commit, and `?? server/node_modules`.

- [ ] **Step 5: Baseline.** The gym tests, then the whole suite, in the worktree:

```bash
W=/opt/warboard/.superpowers/sdd/2026-10-26-gym-monthly-ladder; cd "$W/wt/server" && node --test gym-comp-model.test.mjs gym-hof.test.mjs > "$W/t.log" 2>&1; grep -E "^# (tests|pass|fail) " "$W/t.log" | paste -sd" " -; node --test > "$W/baseline.log" 2>&1; grep -E "^# (tests|pass|fail|skipped) " "$W/baseline.log" | paste -sd" " -; grep -E "^not ok" "$W/baseline.log" | head
```

Expected: `# tests 33 # pass 33 # fail 0`, then the whole suite with `# fail 0`. If anything fails, run `node --test` in `/opt/warboard/server` too. A failure in both is not this plan's: ledger it and go on.

---

### Task 1: The month, scored

**Files:**
- Modify: `server/gym-comp-model.js` (append after its last line)
- Create: `server/gym-comp-month.test.mjs`

**Interfaces:**
- Consumes (already in the file): `latestUpTo(readings, atMs)`, `baselineFor(readings, startMs) → { reading, late }`, `standings(baseline, current) → [{ id, name, energy, split, partial }]`.
- Produces:
  - `MONTH_TOP` = 25.
  - `monthWindow(nowMs) → { start, end }`.
  - `monthStandings(baseline, current, readings, startMs) → [{ id, name, energy, split, partial: false, joinedAt }]`, best first. `joinedAt` is the time of the member's first reading this month, or `null` if they were at the start line.
  - `monthTop(rows) → rows`: those with energy above 0, at most 25.
  - `monthBoard(readings, nowMs) → { start, end, baselineAt, lateStart, currentAt, top }`.
  - `finaliseMonths(readings, done, nowMs) → [{ monthStart, monthEnd, top, baselineAt, finalAt }]`.

- [ ] **Step 1: Write the tests.**

Create `server/gym-comp-month.test.mjs`:

```js
// The monthly top 25: the calendar month in TCT, scored the same way as the
// week — energy trained between two of our own readings — but with the 25 best
// kept instead of one winner, and members who joined mid-month ranked from
// their first reading rather than left at zero.
import { test } from "node:test";
import assert from "node:assert/strict";
import { monthWindow, monthStandings, monthTop, monthBoard, finaliseMonths, MONTH_TOP }
  from "./gym-comp-model.js";

const T = (iso) => Date.parse(iso + "Z");
const reading = (iso, members) => ({ at: T(iso), members });
const iso = (ms) => new Date(ms).toISOString();

test("the month runs from the 1st 00:00 to the last day 23:59 TCT", () => {
  for (const t of ["2026-10-01T00:00:00", "2026-10-15T12:00:00", "2026-10-31T23:59:59"]) {
    const m = monthWindow(T(t));
    assert.equal(iso(m.start), "2026-10-01T00:00:00.000Z", t);
    assert.equal(iso(m.end), "2026-10-31T23:59:59.999Z", t);
  }
});

test("months have their own lengths, and December runs into January", () => {
  assert.equal(iso(monthWindow(T("2026-11-20T00:00:00")).end), "2026-11-30T23:59:59.999Z");
  assert.equal(iso(monthWindow(T("2027-02-10T00:00:00")).end), "2027-02-28T23:59:59.999Z");
  const dec = monthWindow(T("2026-12-31T23:00:00"));
  assert.equal(iso(dec.end + 1), "2027-01-01T00:00:00.000Z");
});

test("somebody who joined mid-month is ranked from their first reading that month", () => {
  // The weekly board scores a joiner zero; a month is long enough that doing so
  // would leave a real member off the ladder for weeks.
  const readings = [
    reading("2026-09-30T23:55:00", { "1": { energy: 1000, name: "Ada" } }),
    reading("2026-10-12T09:00:00", { "1": { energy: 2000, name: "Ada" }, "9": { energy: 4_000_000, name: "NewGuy" } }),
    reading("2026-10-20T00:00:00", { "1": { energy: 3000, name: "Ada" }, "9": { energy: 4_005_000, name: "NewGuy" } }),
  ];
  const rows = monthStandings(readings[0], readings[2], readings, T("2026-10-01T00:00:00"));
  const ng = rows.find((r) => r.name === "NewGuy");
  assert.equal(ng.energy, 5000, "from their first reading, never their lifetime total");
  assert.equal(iso(ng.joinedAt), "2026-10-12T09:00:00.000Z");
  assert.equal(rows[0].name, "NewGuy", "and ranked like anyone else");
  const ada = rows.find((r) => r.name === "Ada");
  assert.equal(ada.energy, 2000);
  assert.equal(ada.joinedAt, null, "a member at the start line has no join date");
});

test("a joiner's first reading is looked for inside the month only", () => {
  // They were here once before and left: a reading from last month is last
  // month's, and the one after the current reading is the future. Out of order
  // on purpose, since nothing guarantees the file is sorted.
  const readings = [
    reading("2026-10-20T00:00:00", { "9": { energy: 900, name: "NewGuy" } }),
    reading("2026-09-25T00:00:00", { "9": { energy: 50, name: "NewGuy" } }),
    reading("2026-09-30T23:55:00", {}),
    reading("2026-10-05T00:00:00", { "9": { energy: 100, name: "NewGuy" } }),
    reading("2026-10-25T00:00:00", { "9": { energy: 5000, name: "NewGuy" } }),
  ];
  const rows = monthStandings(readings[2], readings[0], readings, T("2026-10-01T00:00:00"));
  assert.equal(rows[0].energy, 800);
  assert.equal(iso(rows[0].joinedAt), "2026-10-05T00:00:00.000Z");
});

test("a joiner's split is measured from their first reading too", () => {
  const readings = [
    reading("2026-09-30T23:55:00", {}),
    reading("2026-10-12T09:00:00", { "9": { energy: 1000, name: "NewGuy", str: 1000, def: 0, spe: 0, dex: 0 } }),
    reading("2026-10-20T00:00:00", { "9": { energy: 1600, name: "NewGuy", str: 1000, def: 0, spe: 600, dex: 0 } }),
  ];
  const rows = monthStandings(readings[0], readings[2], readings, T("2026-10-01T00:00:00"));
  assert.equal(rows[0].split, "all spe");
});

test("the ladder keeps the 25 best who trained, and nobody who did not", () => {
  assert.equal(MONTH_TOP, 25);
  const rows = Array.from({ length: 30 }, (_, i) => ({ id: String(i), name: "M" + i, energy: 3000 - i * 100, joinedAt: null }));
  rows.push({ id: "z", name: "Idle", energy: 0, joinedAt: null });
  const top = monthTop(rows);
  assert.equal(top.length, 25);
  assert.equal(top[24].name, "M24");
  assert.equal(monthTop(rows.slice(0, 3).concat({ id: "z", name: "Idle", energy: 0 })).length, 3);
});

test("a tie at #25 is broken by name, and the ladder stays at 25", () => {
  // No 26th row: the order standings() already uses decides who is shown.
  const base = { at: T("2026-09-30T23:55:00"), members: {} };
  const now = { at: T("2026-10-20T00:00:00"), members: {} };
  for (let i = 0; i < 24; i++) {
    base.members[String(i)] = { energy: 0, name: "M" + i };
    now.members[String(i)] = { energy: 10000 - i * 100, name: "M" + i };
  }
  base.members.z = { energy: 0, name: "Zed" };
  now.members.z = { energy: 500, name: "Zed" };
  base.members.a = { energy: 0, name: "Abe" };
  now.members.a = { energy: 500, name: "Abe" };
  const top = monthTop(monthStandings(base, now, [base, now], T("2026-10-01T00:00:00")));
  assert.equal(top.length, 25);
  assert.equal(top[24].name, "Abe");
});

test("the month in progress is measured from the last reading before the 1st", () => {
  const readings = [
    reading("2026-09-30T23:59:29", { "1": { energy: 1000, name: "Ada" }, "2": { energy: 500, name: "Bo" } }),
    reading("2026-10-01T00:04:00", { "1": { energy: 1050, name: "Ada" }, "2": { energy: 500, name: "Bo" } }),
    reading("2026-10-26T12:00:00", { "1": { energy: 9000, name: "Ada" }, "2": { energy: 2500, name: "Bo" } }),
  ];
  const b = monthBoard(readings, T("2026-10-26T12:30:00"));
  assert.equal(iso(b.start), "2026-10-01T00:00:00.000Z");
  assert.equal(iso(b.end), "2026-10-31T23:59:59.999Z");
  assert.equal(iso(b.baselineAt), "2026-09-30T23:59:29.000Z");
  assert.equal(b.lateStart, false);
  assert.equal(iso(b.currentAt), "2026-10-26T12:00:00.000Z");
  assert.deepEqual(b.top.map((r) => [r.name, r.energy]), [["Ada", 8000], ["Bo", 2000]]);
});

test("a month with no reading before the 1st says it started late", () => {
  const readings = [
    reading("2026-10-03T10:00:00", { "1": { energy: 1000, name: "Ada" } }),
    reading("2026-10-26T12:00:00", { "1": { energy: 4000, name: "Ada" } }),
  ];
  const b = monthBoard(readings, T("2026-10-26T12:30:00"));
  assert.equal(b.lateStart, true);
  assert.equal(iso(b.baselineAt), "2026-10-03T10:00:00.000Z");
  assert.equal(b.top[0].energy, 3000);
});

test("no readings at all is an empty ladder, not a crash", () => {
  const b = monthBoard([], T("2026-10-26T12:30:00"));
  assert.deepEqual(b.top, []);
  assert.equal(b.baselineAt, 0);
  assert.equal(b.currentAt, 0);
});

test("a finished month is saved once, with its top 25, and not again", () => {
  const readings = [
    reading("2026-09-30T23:59:29", { "1": { energy: 1000, name: "Ada" }, "2": { energy: 0, name: "Bo" } }),
    reading("2026-10-31T23:57:00", { "1": { energy: 9000, name: "Ada" }, "2": { energy: 300, name: "Bo" } }),
    reading("2026-11-01T00:02:00", { "1": { energy: 9100, name: "Ada" }, "2": { energy: 300, name: "Bo" } }),
  ];
  const now = T("2026-11-01T00:02:30");
  const first = finaliseMonths(readings, [], now);
  assert.equal(first.length, 1);
  assert.equal(iso(first[0].monthStart), "2026-10-01T00:00:00.000Z");
  assert.equal(iso(first[0].monthEnd), "2026-10-31T23:59:59.999Z");
  assert.deepEqual(first[0].top.map((r) => [r.name, r.energy]), [["Ada", 8000], ["Bo", 300]],
    "the finish line is the last reading before midnight — November's 100 is November's");
  assert.equal(iso(first[0].baselineAt), "2026-09-30T23:59:29.000Z");
  assert.equal(iso(first[0].finalAt), "2026-10-31T23:57:00.000Z");
  assert.deepEqual(finaliseMonths(readings, first, now), []);
});

test("the month in progress is never saved early", () => {
  const readings = [
    reading("2026-09-30T23:59:29", { "1": { energy: 1000, name: "Ada" } }),
    reading("2026-10-31T23:57:00", { "1": { energy: 9000, name: "Ada" } }),
  ];
  assert.deepEqual(finaliseMonths(readings, [], T("2026-10-31T23:59:59")), []);
});

test("a month we did not watch from its first minute is never saved", () => {
  // September: the first reading was the 13th. Half a month published as a
  // month's ladder would be wrong for everyone on it.
  const readings = [
    reading("2026-09-13T00:34:00", { "1": { energy: 1000, name: "Ada" } }),
    reading("2026-09-30T23:59:29", { "1": { energy: 5000, name: "Ada" } }),
    reading("2026-10-31T23:57:00", { "1": { energy: 9000, name: "Ada" } }),
  ];
  const out = finaliseMonths(readings, [], T("2026-11-02T00:00:00"));
  assert.deepEqual(out.map((m) => iso(m.monthStart)), ["2026-10-01T00:00:00.000Z"]);
});

test("a month nobody trained in is not saved", () => {
  const readings = [
    reading("2026-09-30T23:59:29", { "1": { energy: 1000, name: "Ada" } }),
    reading("2026-10-31T23:57:00", { "1": { energy: 1000, name: "Ada" } }),
  ];
  assert.deepEqual(finaliseMonths(readings, [], T("2026-11-02T00:00:00")), []);
});

test("a reading at exactly 00:00 on the 1st ends one month and starts the next", () => {
  // Both months use the last reading at or before midnight, so energy trained
  // before it counts once, in the old month, and nothing falls between them.
  const readings = [
    reading("2026-09-30T23:55:00", { "1": { energy: 1000, name: "Ada" } }),
    reading("2026-10-31T23:55:00", { "1": { energy: 5000, name: "Ada" } }),
    reading("2026-11-01T00:00:00", { "1": { energy: 5600, name: "Ada" } }),
    reading("2026-11-02T00:00:00", { "1": { energy: 7000, name: "Ada" } }),
  ];
  const [oct] = finaliseMonths(readings, [], T("2026-11-02T00:30:00"));
  const nov = monthBoard(readings, T("2026-11-02T00:30:00"));
  assert.equal(oct.top[0].energy, 4600, "the midnight reading is October's finish");
  assert.equal(iso(nov.baselineAt), "2026-11-01T00:00:00.000Z", "and November's start line");
  assert.equal(nov.top[0].energy, 1400);
  assert.equal(oct.top[0].energy + nov.top[0].energy, 7000 - 1000, "every unit of energy counted exactly once");
});

test("a counter below its start line scores zero and stays off the ladder", () => {
  // A bad reading must not put anyone on the board with a negative score, and a
  // clamped zero is "did not train", which the ladder leaves out.
  const readings = [
    reading("2026-09-30T23:55:00", { "1": { energy: 9000, name: "Ada" }, "2": { energy: 100, name: "Bo" } }),
    reading("2026-10-20T00:00:00", { "1": { energy: 8000, name: "Ada" }, "2": { energy: 400, name: "Bo" } }),
  ];
  const b = monthBoard(readings, T("2026-10-20T01:00:00"));
  assert.deepEqual(b.top.map((r) => [r.name, r.energy]), [["Bo", 300]]);
});
```

- [ ] **Step 2: Run them, and watch them fail:**

```bash
W=/opt/warboard/.superpowers/sdd/2026-10-26-gym-monthly-ladder; cd "$W/wt/server" && node --test gym-comp-month.test.mjs > "$W/t.log" 2>&1; grep -E "^# (tests|pass|fail) " "$W/t.log" | paste -sd" " -; grep -om1 "does not provide an export named '[A-Za-z_]*'" "$W/t.log"
```

Expected: `# tests 1 # pass 0 # fail 1`, then `does not provide an export named` and one of the six new names.

- [ ] **Step 3: Write the month.**

Append to `server/gym-comp-model.js`, after its last line and one blank line:

```js
// ── The monthly ladder ──────────────────────────────────────────────────
// The calendar month in TCT, scored exactly like the week: energy trained
// between two of our own readings. It keeps the 25 best instead of a winner,
// and it carries no prize; the weekly Xanax is the only one.

export const MONTH_TOP = 25;

/** The calendar month containing `nowMs`: the 1st 00:00 → the last day 23:59:59.999 TCT. */
export function monthWindow(nowMs) {
  const d = new Date(nowMs);
  const start = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);
  return { start, end: Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1) - 1 };
}

/**
 * Energy trained this month, best first.
 *
 * The week's sums, with one difference: a member missing from the start line
 * is measured from their own first reading this month instead of being scored
 * zero. A week is short enough to sit out; a month is not, and scoring them
 * zero would leave somebody who joined on the 3rd off the ladder until the
 * next one. `joinedAt` is when that first reading was taken, so the page can
 * say so. Everyone who was at the start line has `joinedAt: null`.
 */
export function monthStandings(baseline, current, readings, startMs) {
  if (!current) return [];
  const rows = standings(baseline, current).map((r) => {
    if (!r.partial) return { ...r, joinedAt: null };
    // Their earliest reading inside the month, and never one after `current`:
    // the current reading itself if there is nothing earlier.
    let first = current;
    for (const x of readings || []) {
      const at = Number(x.at);
      if (at >= startMs && at < Number(first.at) && x.members && x.members[r.id]) first = x;
    }
    const [own] = standings({ members: { [r.id]: first.members[r.id] } },
                            { members: { [r.id]: current.members[r.id] } });
    return { ...own, joinedAt: Number(first.at) };
  });
  rows.sort((a, b) => b.energy - a.energy || String(a.name).localeCompare(String(b.name)));
  return rows;
}

/** The ladder itself: the best 25 who trained at all. Nobody is listed on zero. */
export function monthTop(rows) {
  return (rows || []).filter((r) => r.energy > 0).slice(0, MONTH_TOP);
}

/** The month in progress, as the page shows it. */
export function monthBoard(readings, nowMs) {
  const m = monthWindow(nowMs);
  // As with the week: no reading before the 1st means the month is measured
  // from its first reading instead, and `lateStart` tells the page so.
  const { reading: base, late } = baselineFor(readings, m.start);
  const now = latestUpTo(readings, nowMs);
  return {
    start: m.start, end: m.end,
    baselineAt: base ? Number(base.at) : 0,
    lateStart: late,
    currentAt: now ? Number(now.at) : 0,
    top: monthTop(monthStandings(base, now, readings, m.start)),
  };
}

/**
 * Save every month that has finished and is not saved yet.
 *
 * Unlike a week, a month is saved only if we have a reading from before its
 * 1st. A ladder measured from the 13th would be published as the month's and
 * be wrong for everyone on it. That rules out the month the readings began
 * (September 2026), and nothing after it.
 *
 * The finish line is the last reading at or before the next month's midnight,
 * which is the same reading the next month starts from. So no training falls
 * between two months, and none counts in both.
 */
export function finaliseMonths(readings, done, nowMs) {
  const out = [];
  if (!readings || !readings.length) return out;
  const seen = new Set((done || []).map((d) => Number(d.monthStart)));
  const currentStart = monthWindow(nowMs).start;
  const earliest = Math.min(...readings.map((r) => Number(r.at)));
  for (let start = monthWindow(earliest).start; start < currentStart; start = monthWindow(start).end + 1) {
    if (seen.has(start)) continue;
    const end = monthWindow(start).end;
    const base = latestUpTo(readings, start);
    const fin = latestUpTo(readings, end + 1);
    if (!base || !fin || Number(fin.at) <= Number(base.at)) continue;
    const top = monthTop(monthStandings(base, fin, readings, start));
    if (!top.length) continue;
    out.push({ monthStart: start, monthEnd: end, top, baselineAt: Number(base.at), finalAt: Number(fin.at) });
  }
  return out;
}
```

- [ ] **Step 4: Run the month's tests and the week's:**

```bash
W=/opt/warboard/.superpowers/sdd/2026-10-26-gym-monthly-ladder; cd "$W/wt/server" && node --test gym-comp-month.test.mjs gym-comp-model.test.mjs > "$W/t.log" 2>&1; grep -E "^# (tests|pass|fail) " "$W/t.log" | paste -sd" " -; grep -E "^not ok" "$W/t.log"
```

Expected: `# tests 42 # pass 42 # fail 0`.

- [ ] **Step 5: Commit:**

```bash
W=/opt/warboard/.superpowers/sdd/2026-10-26-gym-monthly-ladder; cd "$W/wt" && git add -- server/gym-comp-month.test.mjs && git commit -q -m "gym: score the calendar month as a top 25" -m "Scored like the week, from the same readings: energy trained between the last reading before the 1st and the latest one. A member who joined after the 1st is measured from their own first reading of the month. A finished month is saved only if it was watched from its first minute." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- server/gym-comp-model.js server/gym-comp-month.test.mjs && git log --format='%h %s' -1
```

---

### Task 2: Save finished months, and send this month's top 25

**Files:**
- Modify: `server/gym-comp.js`
- Create: `server/gym-comp.test.mjs`

**Interfaces:**
- Consumes (Task 1): `monthBoard(readings, nowMs)`, `finaliseMonths(readings, done, nowMs)`.
- Produces:
  - `readMonths(factionId = "42055") → [{ monthStart, monthEnd, top, baselineAt, finalAt }]`, newest first; `[]` from a results file written before months existed.
  - The results file becomes `{ factionId, weeks, months }`, and every write keeps both lists.
  - `board()` (the `/api/gym` reply) gains `month` (`monthBoard()`'s shape) and `months` (`readMonths()`).
  - `thin()` also keeps any reading in which a member appears who was not in the reading before it.
  - The data directory is `$DATA_DIR/gym-comp`, worked out at call time, or `server/data/gym-comp` without `DATA_DIR`, as before.

- [ ] **Step 1: Write the tests.** They set `DATA_DIR` to a temp directory before importing the module. Every test that writes first checks that the module reads from it (`pointedAtTemp()`), so a module still pointed at the live directory stops before `freeze()` can write.

Create `server/gym-comp.test.mjs`:

```js
// The results file holds the frozen weeks and the saved months together, so
// each write has to carry the other forward. A temp DATA_DIR keeps all of this
// away from the live files.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

process.env.DATA_DIR = mkdtempSync(join(tmpdir(), "gym-comp-test-"));
const gym = await import("./gym-comp.js");

const F = "42055";
const DIR = join(process.env.DATA_DIR, "gym-comp");
const T = (iso) => Date.parse(iso + "Z");
const reading = (iso, members) => ({ at: T(iso), members });
const results = () => JSON.parse(readFileSync(join(DIR, `${F}-results.json`), "utf8"));
const writeResults = (data) =>
  writeFileSync(join(DIR, `${F}-results.json`), JSON.stringify({ factionId: F, ...data }));

// October watched from before its 1st, then the first week of November.
// 1 November 2026 is a Sunday, so the month and the week turn over at the
// same midnight.
const READINGS = [
  reading("2026-09-30T23:59:29", { "1": { energy: 1000, name: "Ada" }, "2": { energy: 500, name: "Bo" } }),
  reading("2026-10-31T23:57:00", { "1": { energy: 9000, name: "Ada" }, "2": { energy: 2500, name: "Bo" } }),
  reading("2026-11-07T23:57:00", { "1": { energy: 9500, name: "Ada" }, "2": { energy: 4500, name: "Bo" } }),
  reading("2026-11-08T00:05:00", { "1": { energy: 9600, name: "Ada" }, "2": { energy: 4500, name: "Bo" } }),
];
mkdirSync(DIR, { recursive: true });
writeFileSync(join(DIR, `${F}.json`), JSON.stringify({ factionId: F, readings: READINGS }));

// A week frozen before months existed, in the shape freeze() wrote then.
const row = (id, name, energy) => ({ id, name, energy, split: null, partial: false });
const OLD_WEEK = {
  weekStart: T("2026-09-20T00:00:00"), weekEnd: T("2026-09-26T23:59:59.999"),
  winners: [row("1", "Ada", 700)], top: [row("1", "Ada", 700)],
  baselineAt: T("2026-09-19T23:58:00"), finalAt: T("2026-09-26T23:58:00"), lateStart: false,
};
const OCTOBER = {
  monthStart: T("2026-10-01T00:00:00"), monthEnd: T("2026-10-31T23:59:59.999"),
  top: [{ ...row("1", "Ada", 8000), joinedAt: null }, { ...row("2", "Bo", 2000), joinedAt: null }],
  baselineAt: T("2026-09-30T23:59:29"), finalAt: T("2026-10-31T23:57:00"),
};

// Every test that writes asks this first. A module still pointed at the live
// directory would see the live readings here instead of these four, and the
// test stops before freeze() can write anything.
const pointedAtTemp = () => assert.equal(gym.readReadings(F).length, READINGS.length,
  "gym-comp.js is not reading from DATA_DIR");

test("the store reads from DATA_DIR, never the live files", () => {
  pointedAtTemp();
});

test("saving a month keeps the weeks already frozen", () => {
  pointedAtTemp();
  writeResults({ weeks: [OLD_WEEK] });
  gym.freeze(F, T("2026-11-01T00:10:00"));
  const r = results();
  assert.deepEqual(r.weeks.find((w) => w.weekStart === OLD_WEEK.weekStart), OLD_WEEK);
  assert.deepEqual(r.months, [OCTOBER]);
});

test("freezing a week keeps the months already saved", () => {
  pointedAtTemp();
  writeResults({ weeks: [OLD_WEEK], months: [OCTOBER] });
  gym.freeze(F, T("2026-11-08T00:10:00"));
  const r = results();
  assert.ok(r.weeks.some((w) => w.weekStart === T("2026-11-01T00:00:00")), "the week of 1 November froze");
  assert.deepEqual(r.months, [OCTOBER], "and October is exactly as it was");
});

test("the page gets this month's top 25 and the saved months", () => {
  pointedAtTemp();
  writeResults({ weeks: [], months: [OCTOBER] });
  const b = gym.board(F, T("2026-11-08T00:10:00"));
  assert.equal(b.month.start, T("2026-11-01T00:00:00"));
  assert.equal(b.month.end, T("2026-11-30T23:59:59.999"));
  assert.deepEqual(b.month.top.map((x) => [x.name, x.energy]), [["Bo", 2000], ["Ada", 600]]);
  assert.deepEqual(b.months, [OCTOBER]);
});

test("the reading somebody first appears in is never thinned away", () => {
  // The monthly ladder measures a mid-month joiner from it. Thinned to the
  // hour's last reading, whatever they trained in their first hour would drop
  // off their score two days after they joined.
  const now = T("2026-10-20T12:00:00");
  const nine = T("2026-10-12T09:00:00");
  const readings = [
    { at: nine - 2 * 60000, members: { "1": { energy: 1 } } },
    { at: nine + 3 * 60000, members: { "1": { energy: 1 }, "9": { energy: 5 } } },
    { at: nine + 30 * 60000, members: { "1": { energy: 1 }, "9": { energy: 400 } } },
    { at: nine + 58 * 60000, members: { "1": { energy: 1 }, "9": { energy: 900 } } },
  ];
  const kept = gym.thin(readings, now).map((r) => r.at);
  assert.ok(kept.includes(nine + 3 * 60000), "the reading NewGuy first appears in must survive");
  assert.ok(!kept.includes(nine + 30 * 60000), "the rest of the hour still thins");
  assert.ok(kept.includes(nine + 58 * 60000), "and the hour's last reading stays");
});

test("a results file from before months existed reads as no months", () => {
  pointedAtTemp();
  writeResults({ weeks: [OLD_WEEK] });
  assert.deepEqual(gym.readMonths(F), []);
  assert.deepEqual(gym.readResults(F), [OLD_WEEK]);
});
```

- [ ] **Step 2: Run them, and watch them fail:**

```bash
W=/opt/warboard/.superpowers/sdd/2026-10-26-gym-monthly-ladder; cd "$W/wt/server" && node --test gym-comp.test.mjs > "$W/t.log" 2>&1; grep -E "^# (tests|pass|fail) " "$W/t.log" | paste -sd" " -; grep -c "gym-comp.js is not reading from DATA_DIR" "$W/t.log"; grep -c "the reading NewGuy first appears in must survive" "$W/t.log"; ls "$W/wt/server/data/gym-comp" 2>&1
```

Expected: `# tests 6 # pass 0 # fail 6`, then `5` and `1` (the counts of the two failure messages), then `ls: cannot access ...: No such file or directory`: the failing run wrote nothing outside its temp directory.

- [ ] **Step 3: Edit `server/gym-comp.js`.**

**Edit 1 of 9 in `server/gym-comp.js`.** Replace:

```js
import { weekWindow, latestUpTo, baselineFor, standings, winnersOf, finaliseWeeks } from "./gym-comp-model.js";
```

With:

```js
import { weekWindow, latestUpTo, baselineFor, standings, winnersOf, finaliseWeeks, monthBoard, finaliseMonths }
  from "./gym-comp-model.js";
```

**Edit 2 of 9 in `server/gym-comp.js`.** Replace:

```js
const DIR = path.join(__dirname, "data", "gym-comp");
```

With:

```js
// Worked out at call time, as blood-bags.js does, so a test that sets DATA_DIR
// first never touches the live files. On the server, DATA_DIR names this same
// data directory, so nothing moves.
const dir = () => path.join(process.env.DATA_DIR || path.join(__dirname, "data"), "gym-comp");
```

**Edit 3 of 9 in `server/gym-comp.js`.** Replace:

```js
const readingsFile = (f) => path.join(DIR, `${f}.json`);
const resultsFile = (f) => path.join(DIR, `${f}-results.json`);
```

With:

```js
const readingsFile = (f) => path.join(dir(), `${f}.json`);
const resultsFile = (f) => path.join(dir(), `${f}-results.json`);
```

**Edit 4 of 9 in `server/gym-comp.js`.** Replace:

```js
  fs.mkdirSync(DIR, { recursive: true });
```

With:

```js
  fs.mkdirSync(dir(), { recursive: true });
```

**Edit 5 of 9 in `server/gym-comp.js`.** Replace:

```js
    // An imported baseline is never thinned away: it cannot be re-fetched.
    if (nowMs - at <= FULL_MS || r.imported) { keep.push(r); continue; }
```

With:

```js
    // An imported baseline is never thinned away: it cannot be re-fetched. Nor
    // is the reading somebody first appears in: the monthly ladder measures a
    // mid-month joiner from it, and keeping only the hour's last reading would
    // drop whatever they trained in their first hour, two days after they joined.
    if (nowMs - at <= FULL_MS || r.imported || joinedIn(sorted[i - 1], r)) { keep.push(r); continue; }
```

**Edit 6 of 9 in `server/gym-comp.js`.** Replace:

```js
// Parsed once per file change.
```

With:

```js
// Somebody is in this reading who was not in the one before it.
function joinedIn(prev, r) {
  if (!prev) return false;
  const had = prev.members || {};
  return Object.keys(r.members || {}).some((id) => !had[id]);
}

// Parsed once per file change.
```

**Edit 7 of 9 in `server/gym-comp.js`.** Replace:

```js
export function readResults(factionId = FACTION) {
  return readJson(resultsFile(factionId), { weeks: [] }).weeks || [];
}
```

With:

```js
export function readResults(factionId = FACTION) {
  return readJson(resultsFile(factionId), { weeks: [] }).weeks || [];
}
// The saved months live in the same file as the weeks. A file written before
// months existed has none, which reads as none.
export function readMonths(factionId = FACTION) {
  return readJson(resultsFile(factionId), { months: [] }).months || [];
}
```

**Edit 8 of 9 in `server/gym-comp.js`.** Replace:

```js
/** Record any week that has ended since the last look. */
export function freeze(factionId = FACTION, nowMs = Date.now()) {
  const done = readResults(factionId);
  const fresh = finaliseWeeks(readReadings(factionId), done, nowMs);
  if (!fresh.length) return [];
  const weeks = done.concat(fresh).sort((a, b) => b.weekStart - a.weekStart);
  writeJson(resultsFile(factionId), { factionId, weeks });
  for (const w of fresh) {
    console.log(`[gym-comp] week ${new Date(w.weekStart).toISOString().slice(0, 10)} won by `
      + w.winners.map((x) => `${x.name} (${x.energy})`).join(", "));
  }
  return fresh;
}
```

With:

```js
/** Record any week, and any month, that has ended since the last look. */
export function freeze(factionId = FACTION, nowMs = Date.now()) {
  const readings = readReadings(factionId);
  const done = readResults(factionId);
  const doneMonths = readMonths(factionId);
  const fresh = finaliseWeeks(readings, done, nowMs);
  const freshMonths = finaliseMonths(readings, doneMonths, nowMs);
  if (!fresh.length && !freshMonths.length) return [];
  // One file holds both, so every write carries the other forward: freezing a
  // week must not drop the months, and saving a month must not drop the weeks.
  const weeks = done.concat(fresh).sort((a, b) => b.weekStart - a.weekStart);
  const months = doneMonths.concat(freshMonths).sort((a, b) => b.monthStart - a.monthStart);
  writeJson(resultsFile(factionId), { factionId, weeks, months });
  for (const w of fresh) {
    console.log(`[gym-comp] week ${new Date(w.weekStart).toISOString().slice(0, 10)} won by `
      + w.winners.map((x) => `${x.name} (${x.energy})`).join(", "));
  }
  for (const m of freshMonths) {
    console.log(`[gym-comp] month ${new Date(m.monthStart).toISOString().slice(0, 7)} saved: `
      + `top ${m.top.length}, led by ${m.top[0].name} (${m.top[0].energy})`);
  }
  return fresh;
}
```

**Edit 9 of 9 in `server/gym-comp.js`.** Replace:

```js
    history: readResults(factionId),
    health: health(),
```

With:

```js
    history: readResults(factionId),
    month: monthBoard(readings, nowMs),
    months: readMonths(factionId),
    health: health(),
```

- [ ] **Step 4: Run the gym model and store tests:**

```bash
W=/opt/warboard/.superpowers/sdd/2026-10-26-gym-monthly-ladder; cd "$W/wt/server" && node --test gym-comp.test.mjs gym-comp-month.test.mjs gym-comp-model.test.mjs > "$W/t.log" 2>&1; grep -E "^# (tests|pass|fail) " "$W/t.log" | paste -sd" " -; grep -E "^not ok" "$W/t.log"; ls "$W/wt/server/data/gym-comp" 2>&1
```

Expected: `# tests 48 # pass 48 # fail 0`, then `No such file or directory` again.

- [ ] **Step 5: Commit:**

```bash
W=/opt/warboard/.superpowers/sdd/2026-10-26-gym-monthly-ladder; cd "$W/wt" && git add -- server/gym-comp.test.mjs && git commit -q -m "gym: save finished months and send this month's top 25" -m "Months are saved into the results file beside the weeks, and every write keeps both. /api/gym gains month and months. The data directory honours DATA_DIR at call time, as blood-bags.js does, so tests never touch the live files. Thinning keeps the reading a member first appears in, which a mid-month joiner is measured from." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- server/gym-comp.js server/gym-comp.test.mjs && git log --format='%h %s' -1
```

---

### Task 3: The month on /gym

**Files:**
- Modify: `server/pages/gym.html`
- Create: `server/gym-month-page.test.mjs`

**Harness:** the one `server/gym-hof.test.mjs` already uses, not linkedom. `fn(name)` cuts a named function out of gym.html, `line(name)` a one-line `var`, and they run in node:vm with a stub `document` whose elements are plain objects.

**Interfaces:**
- Consumes (Task 2): the `/api/gym` reply's `month`, `{ start, end, baselineAt, lateStart, currentAt, top: [{ id, name, energy, split, joinedAt }] }`, and `months`, `[{ monthStart, monthEnd, top, baselineAt, finalAt }]`. Either may be missing (an old server).
- Produces, in gym.html: `var MONTHS` (on one line), `joinedPill(r)`, `monthHtml(m)`, `monthsHtml(months)` and `leftText(end, now)`. `countdown()` now sets `#left` and `#mleft`. `render()` fills `#monthcard` (`#mtitle`, `#mleft`, `#monthbox`) and `#monthscard` (`#months`), and hides both when the reply has no month.

- [ ] **Step 1: Write the tests.**

Create `server/gym-month-page.test.mjs`:

```js
// The monthly ladder on /gym: this month's top 25 under Standings, with its
// own countdown, and the finished months under Previous winners. The page's
// named functions run in vm, the way gym-hof.test.mjs runs hofHtml.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const PAGE = fs.readFileSync(new URL("./pages/gym.html", import.meta.url), "utf8");

function fn(name) {
  const i = PAGE.indexOf("function " + name + "(");
  assert.ok(i >= 0, "not in gym.html: " + name);
  let p = PAGE.indexOf("(", i), depth = 0, k = p;
  for (; k < PAGE.length; k++) {
    if (PAGE[k] === "(") depth++;
    else if (PAGE[k] === ")" && --depth === 0) break;
  }
  const o = PAGE.indexOf("{", k);
  let d = 0;
  for (let j = o; j < PAGE.length; j++) {
    if (PAGE[j] === "{") d++;
    else if (PAGE[j] === "}" && --d === 0) return PAGE.slice(i, j + 1);
  }
  throw new Error("unbalanced braces in " + name);
}
// One-line `var x = ...;` statements: $, fmt and the month names.
const line = (name) => {
  const m = PAGE.match(new RegExp("^\\s*var " + name.replace("$", "\\$") + " = .*$", "m"));
  assert.ok(m, "no var " + name + " in gym.html");
  return m[0].trim();
};

// The page with a stub document. `data` is the page's own variable, so it is
// declared here and set by the test.
function page(data) {
  const els = {};
  const box = {
    encodeURIComponent,
    document: { getElementById: (id) => (els[id] ||= { innerHTML: "", textContent: "", className: "" }) },
  };
  vm.createContext(box);
  vm.runInContext([
    line("$"), line("fmt"), line("MONTHS"),
    ...["esc", "hofHtml", "joinedPill", "monthHtml", "monthsHtml", "leftText", "countdown", "render"].map(fn),
    "var data = null;",
    "globalThis.P = { monthHtml, monthsHtml, leftText, countdown, render, set: function (d) { data = d; } };",
  ].join("\n"), box);
  box.P.set(data);
  return { P: box.P, els };
}

const DAY = 86400000;
const member = (n, e, extra = {}) => ({ id: String(100 + n), name: "M" + n, energy: e, split: null, joinedAt: null, ...extra });
const TOP = Array.from({ length: 25 }, (_, i) => member(i, 30000 - i * 1000));
const OCT = Date.UTC(2026, 9, 1);

// A whole /api/gym reply as the new server sends it, with the week and the
// month still running and a reading taken a minute ago.
function reply(over = {}) {
  const now = Date.now();
  return {
    week: { start: now - 3 * DAY, end: now + 2 * DAY },
    standings: [member(1, 900)], leaders: [member(1, 900)],
    baselineAt: now - 3 * DAY, lateStart: false, currentAt: now - 60000,
    history: [],
    month: { start: OCT, end: now + 5 * DAY, baselineAt: OCT - 31000, lateStart: false, currentAt: now - 60000, top: TOP },
    months: [],
    health: { lastReadingAt: now - 60000, readings: 10, lastOkAt: now - 60000, lastError: null },
    ...over,
  };
}

test("this month's ladder lists all 25, ranked, with energy and a link to each", () => {
  const html = page(null).P.monthHtml({ top: TOP });
  for (let r = 1; r <= 25; r++) assert.match(html, new RegExp('class="rank">' + r + "<"), "no rank " + r);
  assert.match(html, /M24\b/);
  assert.match(html, />30,000</);
  assert.match(html, /profiles\.php\?XID=124/);
});

test("a member who joined mid-month says when", () => {
  const top = [member(1, 5000, { joinedAt: Date.UTC(2026, 9, 12, 9, 0) })];
  assert.match(page(null).P.monthHtml({ top }), /joined Oct 12</);
});

test("a month nobody has trained in yet says so", () => {
  assert.match(page(null).P.monthHtml({ top: [] }), /Nobody has trained yet this month/);
});

test("names on the monthly ladder are escaped", () => {
  const top = [member(1, 100, { name: "<img src=x onerror=1>" })];
  assert.ok(!/<img/.test(page(null).P.monthHtml({ top })), "unescaped name reached the markup");
});

test("finished months: last month open, older ones folded to their leader", () => {
  const html = page(null).P.monthsHtml([
    { monthStart: Date.UTC(2026, 10, 1), monthEnd: Date.UTC(2026, 11, 1) - 1, top: TOP },
    { monthStart: OCT, monthEnd: Date.UTC(2026, 10, 1) - 1, top: [member(90, 7777), member(91, 6000)] },
  ]);
  const opens = html.match(/<details( open)?>/g) || [];
  assert.deepEqual(opens, ["<details open>", "<details>"]);
  assert.match(html, /November 2026/);
  assert.match(html, /October 2026/);
  assert.match(html, /M90/, "the older month's leader still shows on its summary line");
  assert.match(html, /M24\b/, "and last month shows all 25");
});

test("no finished months yet still reads sensibly", () => {
  assert.match(page(null).P.monthsHtml([]), /No finished months yet/);
});

test("a countdown reads in days, hours and minutes, and seconds on the last day", () => {
  const { P } = page(null);
  const now = Date.UTC(2026, 9, 26, 12, 0, 0);
  assert.equal(P.leftText(now + 5 * DAY + 3 * 3600000 + 2 * 60000, now), "5d 3h 2m ");
  assert.equal(P.leftText(now + 3 * 3600000 + 2 * 60000 + 7000, now), "3h 2m 7s");
});

test("the month's countdown reads scoring… once the month has ended", () => {
  const now = Date.now();
  const { P, els } = page(reply({ month: { ...reply().month, end: now - 1000 } }));
  P.countdown();
  assert.equal(els.mleft.textContent, "scoring…");
});

test("the month keeps counting down after the week has ended", () => {
  // The week's countdown used to return early once the week was over, and the
  // month's would have stopped with it.
  const now = Date.now();
  const { P, els } = page(reply({ week: { start: now - 7 * DAY, end: now - 1000 } }));
  P.countdown();
  assert.equal(els.left.textContent, "scoring…");
  assert.match(els.mleft.textContent, /^\d+d \d+h \d+m $/);
});

test("the month card shows the month by name and its top 25", () => {
  const { P, els } = page(reply({ months: [{ monthStart: Date.UTC(2026, 8, 1), top: [member(90, 7777)] }] }));
  P.render();
  assert.equal(els.monthcard.className, "card");
  assert.equal(els.mtitle.textContent, "October · top 25");
  assert.match(els.monthbox.innerHTML, /M24\b/);
  assert.match(els.mleft.textContent, /^\d+d \d+h \d+m $/);
  assert.equal(els.monthscard.className, "card");
  assert.match(els.months.innerHTML, /September 2026/);
});

test("a reply from before the server knew about months leaves the month cards out", () => {
  // The page is read from disk on every request, so it goes live the moment
  // the files land, while the running server still sends the old reply until
  // it reloads. The weekly board must carry on as before.
  const old = reply();
  delete old.month;
  delete old.months;
  const { P, els } = page(old);
  P.render();
  assert.equal(els.monthcard.className, "card hide");
  assert.equal(els.monthscard.className, "card hide");
  assert.match(els.tablebox.innerHTML, /M1\b/, "the weekly standings still render");
  P.countdown();
  assert.notEqual(els.left.textContent, "", "and the week still counts down");
});

test("a month measured from after the 1st says so, and that it will not be saved", () => {
  const late = { ...reply().month, lateStart: true, baselineAt: Date.UTC(2026, 9, 3, 10, 0) };
  const { P, els } = page(reply({ month: late }));
  P.render();
  assert.match(els.stale.innerHTML, /This month is measured from Sat, 03 Oct 2026 10:00:00 TCT/);
  assert.match(els.stale.innerHTML, /will not be saved/);
});
```

- [ ] **Step 2: Run them, and watch them fail:**

```bash
W=/opt/warboard/.superpowers/sdd/2026-10-26-gym-monthly-ladder; cd "$W/wt/server" && node --test gym-month-page.test.mjs > "$W/t.log" 2>&1; grep -E "^# (tests|pass|fail) " "$W/t.log" | paste -sd" " -; grep -c "no var MONTHS in gym.html" "$W/t.log"
```

Expected: `# tests 12 # pass 0 # fail 12`, then `12`.

- [ ] **Step 3: Edit `server/pages/gym.html`.**

**Edit 1 of 7 in `server/pages/gym.html`.** Replace:

```html
  .empty{color:var(--mute);font-size:13px;padding:6px 2px}
```

With:

```html
  .mhead{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:baseline;gap:4px 12px}
  .mhead .mleft{color:var(--faint);letter-spacing:1.5px}
  .mhead .mleft b{color:var(--lead);letter-spacing:0;text-transform:none;font-variant-numeric:tabular-nums}
  .empty{color:var(--mute);font-size:13px;padding:6px 2px}
```

**Edit 2 of 7 in `server/pages/gym.html`.** Replace:

```html
    <div class="card">
      <h2>Previous winners</h2>
      <div class="hof" id="hof"></div>
    </div>
```

With:

```html
    <div class="card hide" id="monthcard">
      <h2 class="mhead"><span id="mtitle">This month &middot; top 25</span><span class="mleft">Month ends in <b id="mleft">—</b></span></h2>
      <div id="monthbox"></div>
    </div>

    <div class="card">
      <h2>Previous winners</h2>
      <div class="hof" id="hof"></div>
    </div>

    <div class="card hide" id="monthscard">
      <h2>Previous months</h2>
      <div class="hof" id="months"></div>
    </div>
```

**Edit 3 of 7 in `server/pages/gym.html`.** Replace:

```html
  var fmt = function (n) { return Number(n || 0).toLocaleString(); };
```

With:

```html
  var fmt = function (n) { return Number(n || 0).toLocaleString(); };
  // Fixed names, not the browser's locale, so "joined Oct 12" reads the same on every phone.
  var MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
```

**Edit 4 of 7 in `server/pages/gym.html`.** Replace:

```html
  var data = null;
```

With:

```html

  /** "joined Oct 12" for a member ranked from their first reading of the month, else nothing. */
  function joinedPill(r) {
    if (!r.joinedAt) return "";
    var j = new Date(r.joinedAt);
    return '<span class="pill">joined ' + MONTHS[j.getUTCMonth()].slice(0, 3) + " " + j.getUTCDate() + '</span>';
  }

  /**
   * This month's top 25.
   *
   * The weekly standings table, but only the people on the ladder: the server
   * sends the 25 best who trained at all, so there is no "joined mid-week" row
   * scored zero. A member who joined after the 1st is ranked from their first
   * reading this month, and the pill says when that was.
   */
  function monthHtml(m) {
    var top = (m && m.top) || [];
    if (!top.length) return '<div class="empty">Nobody has trained yet this month.</div>';
    var max = Math.max(1, top[0].energy);
    var body = top.map(function (r, i) {
      return '<tr class="' + (i === 0 ? "top1" : "") + '">' +
        '<td class="rank">' + (i + 1) + '</td>' +
        '<td><a class="nm" style="color:#cfe3ff;text-decoration:none" target="_blank" rel="noopener" ' +
        'href="https://www.torn.com/profiles.php?XID=' + encodeURIComponent(r.id) + '">' + esc(r.name) + '</a>' +
        joinedPill(r) +
        (r.split ? '<div class="split">' + esc(r.split) + '</div>' : '') +
        '<div class="bar" style="width:' + Math.round((r.energy / max) * 100) + '%"></div></td>' +
        '<td class="r">' + fmt(r.energy) + '</td></tr>';
    }).join("");
    return '<table><tr><th class="rank">#</th><th>Member</th><th class="r">Energy</th></tr>' + body + "</table>";
  }

  /**
   * The finished months, newest first, laid out like the weeks: last month
   * open with its whole top 25, older months folded to their leader's line.
   */
  function monthsHtml(months) {
    if (!months.length) return '<div class="empty">No finished months yet — this month\'s top 25 is saved when it ends.</div>';
    return months.map(function (mo, mi) {
      var d = new Date(mo.monthStart), top = mo.top || [], lead = top[0] || {};
      var head = '<div class="w"><div class="wk">' + MONTHS[d.getUTCMonth()] + " " + d.getUTCFullYear() + '</div>' +
        '<div class="nm">' + esc(lead.name) + '</div>' +
        '<div class="en">' + fmt(lead.energy) + '</div></div>';
      var rows = top.map(function (r, i) {
        return '<tr><td class="rk">' + (i + 1) + '</td>' +
          '<td><a style="color:#cfe3ff;text-decoration:none" target="_blank" rel="noopener" ' +
          'href="https://www.torn.com/profiles.php?XID=' + encodeURIComponent(r.id) + '">' +
          esc(r.name) + '</a>' + joinedPill(r) + '</td>' +
          '<td class="e">' + fmt(r.energy) + '</td></tr>';
      }).join("");
      return '<details' + (mi === 0 ? " open" : "") + '><summary>' + head + '</summary>' +
        '<table class="tt">' + rows + '</table></details>';
    }).join("");
  }
  var data = null;
```

**Edit 5 of 7 in `server/pages/gym.html`.** Replace:

```html
  // TCT is UTC, so the countdown is plain arithmetic — no zone to get wrong.
  function countdown() {
    if (!data) return;
    var left = data.week.end - Date.now();
    if (left < 0) { $("left").textContent = "scoring…"; return; }
    var d = Math.floor(left / 86400000), h = Math.floor(left / 3600000) % 24,
        m = Math.floor(left / 60000) % 60, s = Math.floor(left / 1000) % 60;
    $("left").textContent = (d ? d + "d " : "") + h + "h " + m + "m " + (d ? "" : s + "s");
  }
```

With:

```html
  // TCT is UTC, so a countdown is plain arithmetic — no zone to get wrong.
  function leftText(end, now) {
    var left = end - now;
    if (left < 0) return "scoring…";
    var d = Math.floor(left / 86400000), h = Math.floor(left / 3600000) % 24,
        m = Math.floor(left / 60000) % 60, s = Math.floor(left / 1000) % 60;
    return (d ? d + "d " : "") + h + "h " + m + "m " + (d ? "" : s + "s");
  }
  // The week and the month count down separately: one ending must not stop
  // the other.
  function countdown() {
    if (!data) return;
    var now = Date.now();
    $("left").textContent = leftText(data.week.end, now);
    if (data.month) $("mleft").textContent = leftText(data.month.end, now);
  }
```

**Edit 6 of 7 in `server/pages/gym.html`.** Replace:

```html
    $("hof").innerHTML = hofHtml(data.history || []);
```

With:

```html
    $("hof").innerHTML = hofHtml(data.history || []);

    // The page goes live the moment its file lands, but the running server
    // sends no month until it reloads. Until then the month cards stay out of
    // the way and the weekly board works as before.
    $("monthcard").className = data.month ? "card" : "card hide";
    $("monthscard").className = data.months ? "card" : "card hide";
    if (data.month) {
      $("mtitle").textContent = MONTHS[new Date(data.month.start).getUTCMonth()] + " \u00b7 top 25";
      $("monthbox").innerHTML = monthHtml(data.month);
    }
    if (data.months) $("months").innerHTML = monthsHtml(data.months);
```

**Edit 7 of 7 in `server/pages/gym.html`.** Replace:

```html
        'and both are right. From next Sunday the start line is midnight.</div>';
    }
```

With:

```html
        'and both are right. From next Sunday the start line is midnight.</div>';
    }
    // The same for the month, which is also not saved when it ends: a month
    // measured from the 3rd is not a month.
    if (data.month && data.month.lateStart && data.month.baselineAt) {
      $("stale").innerHTML += '<div class="warn"><b>This month is measured from ' +
        new Date(data.month.baselineAt).toUTCString().replace("GMT", "TCT") + '</b>, not the 1st — ' +
        'that is when the first reading was taken. Energy trained before it is not counted, for anyone, ' +
        'and this month will not be saved to Previous months.</div>';
    }
```

- [ ] **Step 4: Run the page's tests, the new ones and the Previous-winners ones:**

```bash
W=/opt/warboard/.superpowers/sdd/2026-10-26-gym-monthly-ladder; cd "$W/wt/server" && node --test gym-month-page.test.mjs gym-hof.test.mjs > "$W/t.log" 2>&1; grep -E "^# (tests|pass|fail) " "$W/t.log" | paste -sd" " -; grep -E "^not ok" "$W/t.log"
```

Expected: `# tests 19 # pass 19 # fail 0`.

- [ ] **Step 5: Look at it.** Headless Chromium works on this box (playwright-core 1.61 in the npx cache, see memory `reference_headless_engines_on_box`). Serve the worktree's page with a fake reply and screenshot both cards at 390 px and 860 px:

Write `$W/shot.mjs`:

```js
// A look at the month cards: gym.html served from 127.0.0.1 with a fake /api/gym reply
// (fake names), screenshots of both cards at phone and desktop width.
// Usage: node shot.mjs <playwright-core dir> <gym.html> <out dir>
import http from "node:http";
import fs from "node:fs";
const [pw, pagePath, out] = process.argv.slice(2);
const { chromium } = await import(pw + "/index.mjs");
const PAGE = fs.readFileSync(pagePath, "utf8");
const now = Date.now(), DAY = 86400000;
const m = (n, e, x = {}) => ({ id: String(100 + n), name: "Member" + n, energy: e,
  split: n % 3 ? "all dex" : "str 60% · def 40%", joinedAt: null, partial: false, ...x });
const top = Array.from({ length: 25 }, (_, i) => m(i, 38000 - i * 500, i === 4 ? { joinedAt: Date.UTC(2026, 9, 12, 9) } : {}));
const data = {
  week: { start: now - 5 * DAY, end: now + 2 * DAY },
  standings: [m(1, 9000), m(2, 7000), m(3, 0, { partial: true, split: null })], leaders: [m(1, 9000)],
  baselineAt: now - 5 * DAY, lateStart: false, currentAt: now - 60000,
  history: [{ weekStart: Date.UTC(2026, 9, 18), winners: [m(7, 12000)], top: [m(7, 12000), m(8, 9000)] }],
  month: { start: Date.UTC(2026, 9, 1), end: now + 5 * DAY + 3 * 3600000, baselineAt: Date.UTC(2026, 8, 30, 23, 59, 29),
    lateStart: false, currentAt: now - 60000, top },
  months: [{ monthStart: Date.UTC(2026, 8, 1), top }, { monthStart: Date.UTC(2026, 7, 1), top: top.slice(3, 9) }],
  health: { lastReadingAt: now - 60000, readings: 10, lastOkAt: now - 60000, lastError: null },
};
const srv = http.createServer((req, res) => {
  if (req.url.startsWith("/api/gym")) { res.setHeader("Content-Type", "application/json"); return res.end(JSON.stringify(data)); }
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.end(PAGE);
}).listen(0, "127.0.0.1");
await new Promise((r) => srv.on("listening", r));
const browser = await chromium.launch();
for (const w of [390, 860]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: 900 } });
  await ctx.addInitScript(() => { try { localStorage.setItem("gym_token", "t"); } catch (e) {} });
  const p = await ctx.newPage();
  await p.goto(`http://127.0.0.1:${srv.address().port}/gym`);
  await p.waitForSelector("#monthbox table");
  await (await p.$("#monthcard")).screenshot({ path: `${out}/month-${w}.png` });
  await (await p.$("#monthscard")).screenshot({ path: `${out}/months-${w}.png` });
  console.log(w, "scrollWidth", await p.evaluate(() => document.documentElement.scrollWidth),
    "title", JSON.stringify(await p.textContent("#mtitle")), "left", JSON.stringify(await p.textContent("#mleft")));
  await ctx.close();
}
await browser.close();
srv.close();
```

```bash
uptime; W=/opt/warboard/.superpowers/sdd/2026-10-26-gym-monthly-ladder; PW=$(dirname "$(grep -l '"version": "1.61' /root/.npm/_npx/*/node_modules/playwright-core/package.json | head -1)"); mkdir -p "$W/shots" && cd "$W" && timeout 90 node shot.mjs "$PW" "$W/wt/server/pages/gym.html" "$W/shots"
```

Expected: `390 scrollWidth 390 title "October · top 25" left "5d 2h 59m "` (or 3h 0m), and the same for 860: no sideways scroll at either width. Then Read the four PNGs in `$W/shots`:
- `month-390.png`: "OCTOBER · TOP 25", with "MONTH ENDS IN 5d …" wrapped under it; 25 ranked rows, each with a bar; Member4 carries "joined Oct 12".
- `month-860.png`: the same, with "MONTH ENDS IN …" on the title's line, at the right.
- `months-*.png`: "PREVIOUS MONTHS", September 2026 open with its 25 rows, August 2026 folded to its leader's line.

- [ ] **Step 6: Commit:**

```bash
W=/opt/warboard/.superpowers/sdd/2026-10-26-gym-monthly-ladder; cd "$W/wt" && git add -- server/gym-month-page.test.mjs && git commit -q -m "gym: this month's top 25 and the finished months on /gym" -m "A card under Standings with this month's top 25 and its own countdown, and Previous months under Previous winners: last month open, older months folded. A member who joined after the 1st is marked with the date. Both cards stay hidden until the server sends a month, so the page works before the reload too." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- server/pages/gym.html server/gym-month-page.test.mjs && git log --format='%h %s' -1
```

---

## Between Task 3 and Task 4: the final review

As superpowers:executing-plans says: the review package from the branch's merge base with main, one fresh Opus reviewer given this plan, its Review Focus and the ledger's `Ruling:` lines, then one fix pass for Critical and Important findings, each test-first, with the whole suite green after it. Minor findings go to the ledger and the report.

---

### Task 4: Release

- [ ] **Step 1: Pre-flight:**

```bash
uptime; W=/opt/warboard/.superpowers/sdd/2026-10-26-gym-monthly-ladder; grep -E "^Task [1-3]: complete|^Final" "$W/progress.md"; git -C "$W/wt" status --short; cd "$W/wt/server" && node --test > "$W/suite.log" 2>&1; grep -E "^# (tests|pass|fail|skipped) " "$W/suite.log" | paste -sd" " -; grep -E "^not ok" "$W/suite.log" | head
```

Expected: the three `complete` lines and the final review's lines; `?? server/node_modules`; the whole suite with `# fail 0`.

- [ ] **Step 2: The owner's go-ahead for the reload.** `deploy.sh` reloads warboard, which is offline for a few seconds, and every FactionOps client reconnects. While the faction is chaining, reload only with the owner's OK, or after the chain ends. Nothing is lost by waiting: the first poll after the new code runs saves October, as long as October's start line (the reading at 2026-09-30 23:59:29 TCT) is still on disk. Readings are kept 45 days, so that holds until 2026-11-14 23:59 TCT. Until the reload, /gym shows the weekly board only. The reload also stops war 51418's post-war Xanax tracker, which otherwise reads the armoury news hourly until 24 hours after the war ended (2026-10-27 19:59 TCT). After a reload it starts again only when a FactionOps client joins the war room (server.js resumes war monitors for unfinished wars only). Tell the owner that when asking.

- [ ] **Step 3: Fast-forward main.** The main checkout holds the three adopted files untracked, so `git merge --ff-only` would refuse to overwrite them. Check they are still the files the branch adopted, move them into the workspace, and fast-forward, all in one command, so the served tree is without `gym-comp.js` for under a second. If the merge is refused, the files go straight back:

```bash
W=/opt/warboard/.superpowers/sdd/2026-10-26-gym-monthly-ladder; cd /opt/warboard && git status --short -- server/gym-comp.js server/gym-comp-model.js server/gym-comp-model.test.mjs server/pages/gym.html && (cd server && sha256sum -c "$W/untracked.sha256") && mkdir -p "$W/untracked-before-ff" && mv server/gym-comp.js server/gym-comp-model.js server/gym-comp-model.test.mjs "$W/untracked-before-ff/" && { git merge -q --ff-only gym-monthly-ladder || { mv "$W/untracked-before-ff/"* server/; echo "FF REFUSED: the three files are back"; }; }; git log --format='%h %s' -1; git status --short -- server/gym-comp.js server/gym-comp-model.js server/gym-comp-model.test.mjs server/gym-comp-month.test.mjs server/gym-comp.test.mjs server/gym-month-page.test.mjs server/pages/gym.html
```

Expected: the three `??` lines (and nothing for gym.html), three `OK`, then the branch's last commit as main's HEAD, then nothing: every gym file is tracked and clean. If it says `FF REFUSED`, main has moved on. Then in the worktree, `git rebase main`, run the whole suite there again, and repeat this step.

- [ ] **Step 4: Deploy.** First note the readings file and the time, and check that pm2 runs warboard from the server directory, so `DATA_DIR`, as `.env` sets it, names the same `data/gym-comp` the old code used:

```bash
uptime; W=/opt/warboard/.superpowers/sdd/2026-10-26-gym-monthly-ladder; stat -c '%s bytes, %y' /opt/warboard/server/data/gym-comp/42055.json; readlink /proc/$(pm2 pid warboard)/cwd; date -u +%FT%TZ > "$W/reload-at"; cd /opt/warboard/server && ./deploy.sh > "$W/deploy.log" 2>&1; echo "exit $?"; grep -E "^# (tests|pass|fail|skipped) " "$W/deploy.log" | paste -sd" " -; tail -1 "$W/deploy.log"
```

Expected: the load under 12, the file's size and time, `/opt/warboard/server`, then `exit 0`, the suite with `# fail 0`, and `deploy ok`.

- [ ] **Step 5: Check it live.** `/api/gym` needs a signed-in token, which this box can't make, so check the parts: the served page, and the deployed model on the live readings. The probe imports only the pure model and prints no names:

```bash
cd /opt/warboard/server && curl -s http://127.0.0.1:3000/gym | grep -c 'id="monthcard"'; curl -s https://tornwar.com/gym | grep -c 'id="monthcard"'; node --input-type=module -e '
import fs from "node:fs";
const M = await import("/opt/warboard/server/gym-comp-model.js");
const r = JSON.parse(fs.readFileSync("/opt/warboard/server/data/gym-comp/42055.json", "utf8")).readings;
const b = M.monthBoard(r, Date.now());
console.log("start line", new Date(b.baselineAt).toISOString(), "late", b.lateStart, "rows", b.top.length, "months due", M.finaliseMonths(r, [], Date.now()).length);'
```

Expected: `1`, `1`, then `start line 2026-09-30T23:59:29.772Z late false rows 25 months due 0`. From 2026-11-01 00:00 TCT, `months due` reads 1 (October) until a poll saves it.

- [ ] **Step 6: Watch one poll.** Wait until the readings file has a reading newer than the reload (polls run every 5 minutes; use Monitor with an until-loop, not a foreground sleep), then check the logs:

```bash
W=/opt/warboard/.superpowers/sdd/2026-10-26-gym-monthly-ladder; node -e 'const r = JSON.parse(require("fs").readFileSync("/opt/warboard/server/data/gym-comp/42055.json", "utf8")).readings; console.log("newest reading", new Date(r[r.length - 1].at).toISOString())'; echo "reload at $(cat "$W/reload-at")"; grep -a "\[gym-comp\]" /var/log/warboard/warboard-out.log | tail -2; grep -a "\[gym-comp\]" /var/log/warboard/warboard-error.log | tail -3
```

Expected: the newest reading after the reload, so the poller still writes the same file; `[gym-comp] polling every 5 min` in the out log; no error-log line timed after the reload.

- [ ] **Step 7: Push.** Sweep the lines this push adds, then push, with the remote's URL masked:

```bash
W=/opt/warboard/.superpowers/sdd/2026-10-26-gym-monthly-ladder; cd /opt/warboard && git log --format='%h %s' origin/main..main && git diff origin/main..main | grep -E '^\+' > "$W/added.txt"; grep -oE '(^|[^A-Za-z0-9])[A-Za-z0-9]{16}([^A-Za-z0-9]|$)' "$W/added.txt" | sort | uniq -c; node "$W/sweep-env.mjs" "$W/added.txt" && git push -q origin main 2>&1 | sed -E 's#//[^@]*@#//***@#g'; git log --format='%h' -1 origin/main
```

Expected: the plan's commit, the adoption, Tasks 1 to 3 and any fix-pass commits; the only 16-character word is `getFactionApiKey`, a function name (in the adopted `gym-comp.js`, and quoted in this plan); `sweep clean (<n> values checked)`; then origin/main at main's HEAD. Any other 16-character word: stop and look at it before pushing.

- [ ] **Step 8: Clean up.** Copy the ledger, the logs and the screenshots into this session's scratchpad directory, then remove the worktree's `node_modules` link, the worktree, the branch and the workspace:

```bash
W=/opt/warboard/.superpowers/sdd/2026-10-26-gym-monthly-ladder; S="$SCRATCHPAD/gym-ladder-release"; mkdir -p "$S" && cp -r "$W/progress.md" "$W"/*.log "$W/shots" "$S/" && rm "$W/wt/server/node_modules" && cd /opt/warboard && git worktree remove "$W/wt" && git branch -d gym-monthly-ladder && rm -r /opt/warboard/.superpowers/sdd/2026-10-26-gym-monthly-ladder && git worktree list | grep -c gym-monthly-ladder
```

(`SCRATCHPAD` is the scratchpad directory the session's system prompt names.) Expected: `0`.

- [ ] **Step 9: Memory and report.**
  - A project memory for the monthly ladder: live since the reload; the first save at 2026-11-01 00:00 TCT (20:00 EDT on 31 October); the joiner rule in `thin()`. Owed: on 1 November, check that the results file's `months[0]` is October with 25 rows. Add its line to MEMORY.md, which is at its 200-line limit, so merge two related lines to make room.
  - Report to the owner: https://tornwar.com/gym, what they will see (October's top 25 under Standings; "No finished months yet" under Previous months), and when October is saved.
