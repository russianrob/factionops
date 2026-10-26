# Torn User List Filter 1.0.1: Hide the Fallen - Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Torn User List Filter hides fallen players too, with a fourth switch, "Fallen", after Jail.

**Architecture:**
- One script changes: `server/public/scripts/torn-userlist-filter.user.js` learns a fourth kind, `fallen`. Torn's icon 77 tells of it, and so does a label starting with "Fallen" on an icon whose number is not known. The bar builds a switch for each kind in `KINDS`, so the new kind brings its own switch. The check, the count and the stored switches work as in 1.0.0.
- `server/public/scripts` is served from the main checkout, so the served file is the repo file. All the work is done in a git worktree on a branch, and the release is a fast-forward of main. Nothing on the server changes, so there is no deploy and no pm2 reload.

**Tech Stack:** a userscript (plain JavaScript, no libraries). Tests use node:test and linkedom, and load the real script into hand-built copies of Torn's search page. One screenshot uses headless Chromium (playwright-core 1.61, from the npx cache).

**Spec:** `docs/superpowers/specs/2026-10-25-torn-userlist-filter-design.md`. The owner approved the 1.0.1 design in chat (below), and Task 1 Step 1 writes it into the spec. From then on the amended spec is the binding authority.

**The ask:**
- 18:20 EDT on 2026-10-26, the owner: "for the user filter can you include to hide the fallen".
- Facts found: TornTools 9.1.1.1's own user-list filter, on this same page, reads Torn's icon 77 as fallen (`SPECIAL_FILTER_ICONS.fallen = ["icon77"]`, behind its "Fallen" checkbox). TornTools' table of Torn's icons, which 1.0.0's numbers come from, leaves 77 out. So 1.0.0 reads 77 as an unknown number and goes by its label, and no label it knows starts with "Fallen".
- The design went to the owner in chat. At 18:37 EDT the owner said "do recommended", which approved:
  1. a fourth switch, "Fallen", after Jail;
  2. on by default, also for anyone whose switches were saved by 1.0.0;
  3. a row with icon 77 is hidden, and an icon whose number is not known counts as fallen when its label starts with "Fallen";
  4. the count unchanged, and still no API calls and no clicks;
  5. the release is a fast-forward of main with no warboard restart, because the faction is chaining. The owner checks that a fallen row is gone, and the Greasy Fork upload the owner still owes becomes 1.0.1.

**Execution:** Native, as the owner chose. One session works the tasks, and one fresh Opus reviewer checks the branch between Task 1 and Task 2.

**Dry run:** every block in this plan ran while the plan was written. The edits, scripts and commands were read back out of this file and replayed in order on copies of main's files at 54c30393:
- Task 1's tests: `# tests 47 # pass 30 # fail 17` before its code, and `# tests 47 # pass 47 # fail 0` after.
- Mutants: 7 of 7 caught: 77 left out of the numbers that tell of a kind, 77 read as an unknown number as in 1.0.0, no Fallen label, the label read anywhere or in one letter case only, Fallen first in the bar, and a kind missing from what was saved read as off.
- The screenshot script ran on the replayed script at 390 and 860 px.
- Both sweeps ran on the replayed diff.

## Global Constraints

- The page: `page.php?sid=UserList` only, in any letter case, as in 1.0.0.
- The bar: `Hide: [x] Hospital  [x] Abroad  [x] Jail  [x] Fallen`, then the count, such as `12 of 50 hidden on this page`. The count's wording is unchanged.
- Fallen: icon 77, by its number alone. An icon whose number is not known counts as fallen when its label (`aria-label` or `title`, tags taken out) starts with "Fallen", in any letter case. A known number never counts by its label.
- Stored: `tulf-switches`, `{"hospital":true,"abroad":true,"jail":true,"fallen":true}`. A kind missing from what is stored is on, so switches saved by 1.0.0 read Fallen as on.
- Version 1.0.1: `@version`, the in-file `VERSION` and the meta file (the header and a newline) agree. The CHANGELOG lists the newest version first.
- @description: `Hides people in hospital, in jail, abroad (in flight or landed) or fallen from Torn's user list search, with a switch for each above the list.`
- Still no requests of its own, no API key, no clicks, and no new @grant or @connect. The source stays plain ASCII, with every `GM_*` call guarded.
- The repo is public. Tests use made-up names only (okay, fallen, Member1 to Member4), never member names or ids.
- Release: a fast-forward of main, with the served files `warboard:warboard 644`. No `deploy.sh`, and no pm2 reload while the chain runs; pm2's warboard pid is the same before and after.
- Stage only this plan's paths: other sessions' dirty files in the main checkout stay as they are. Every commit ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Icon 77 on the live page.** Nobody here has seen a fallen player's row. 77 comes from TornTools' filter, not from a live page. If Torn draws fallen players with another number, or with none, 1.0.1 hides nothing for them. The owner's check after release settles it (Task 2 Step 8 asks for it). If a fallen row still shows, the next step is to read that row's icons, not to guess a number.
2. **Switches saved by 1.0.0.** Anyone who turned a switch off in 1.0.0 has `{"hospital":..,"abroad":..,"jail":..}` saved, with no `fallen`. Fallen must read as on for them, and nothing is saved until they flip a switch. Task 1's test "switches saved by 1.0.0, which had no Fallen switch, read Fallen as on: the fallen are hidden for them too" pins it.
3. **Known numbers and the Fallen label.** A known number whose label says "Fallen" (62, Idle) must still show. An unknown number whose label starts with "Fallen", in any case, must hide, and "Not fallen" must not. Task 1's test "an icon whose number is not known counts as fallen when its label starts with "Fallen"; a known number never does" pins it.
4. **Four switches on a phone.** At 390 px the bar wraps, and it must not push the page sideways. Task 1 Step 8's screenshot pins it (`scrollWidth` 390).
5. **No restart at release.** The faction is chaining toward 25k, and a pm2 reload drops every FactionOps client for a few seconds. Only the served file changes. Task 2 checks that pm2's warboard pid is the same before and after.

## Paths and commands

- `W=/opt/warboard/.superpowers/sdd/2026-10-26-torn-userlist-filter-fallen` is this plan's git-ignored workspace, and `WT=$W/wt` the worktree, on branch `torn-userlist-filter-fallen`.
- **Tests in the worktree always set `TULF_SRC`.** Unless `TULF_SRC` names another copy, the test file tests the served script, which is main's. A bare run in the worktree would test main's 1.0.0 against the branch's tests. Every test command below sets `TULF_SRC="$WT/server/public/scripts/torn-userlist-filter.user.js"`.
- Test runs write to `$W/t.log` and print the `# tests`, `# pass` and `# fail` lines, then any `not ok` lines.
- **Edits:** each "Replace" block's text occurs in its file exactly once, and the "With" block takes its place. Neither block holds the newline that ends its last line. Make a step's edits in the order given.

## Setup

- [ ] **Step 1: Commit this plan on main, then make the worktree:**

```bash
uptime; cd /opt/warboard && git add -- docs/superpowers/plans/2026-10-26-torn-userlist-filter-fallen.md && git commit -q -m "plan: Torn User List Filter 1.0.1, hide the fallen" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- docs/superpowers/plans/2026-10-26-torn-userlist-filter-fallen.md && W=/opt/warboard/.superpowers/sdd/2026-10-26-torn-userlist-filter-fallen && mkdir -p "$W" && git worktree add -q "$W/wt" -b torn-userlist-filter-fallen && ln -s /opt/warboard/server/node_modules "$W/wt/server/node_modules" && git -C "$W/wt" status --short && git -C "$W/wt" log --format='%h %s' -1 | cat
```

Expected: the load under 12, then `?? server/node_modules`, then the plan's commit.

- [ ] **Step 2: The sweeps.** They live outside the repo, and Task 1 and Task 2 both use them.

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

Write `$W/sweep-names.mjs`:

```js
// Fails if any given file holds the name or the id of a member of the faction, as a whole word.
// The members are those in the latest gym reading. RussianRob, the owner's publisher name, is in
// every script's @namespace and @author, so it is let be. It prints where each hit is, never the
// name or the id.
import fs from "node:fs";
const readings = JSON.parse(fs.readFileSync("/opt/warboard/server/data/gym-comp/42055.json", "utf8")).readings;
const LET_BE = new Set(["russianrob"]);
const words = new Set();
for (const [id, m] of Object.entries(readings[readings.length - 1].members)) {
  words.add(id);
  if (m.name && m.name.length >= 3 && !LET_BE.has(m.name.toLowerCase())) words.add(m.name.toLowerCase());
}
let hits = 0;
for (const f of process.argv.slice(2)) {
  fs.readFileSync(f, "utf8").split("\n").forEach((line, i) => {
    for (const w of line.toLowerCase().split(/[^a-z0-9_-]+/)) if (words.has(w)) { console.log("HIT", f + ":" + (i + 1)); hits++; }
  });
}
console.log(hits ? "NAMES SWEEP FAILED" : `names sweep clean (${words.size} names and ids checked)`);
process.exit(hits ? 1 : 0);
```

- [ ] **Step 3: Baseline.** The script's tests, then the whole suite, in the worktree:

```bash
W=/opt/warboard/.superpowers/sdd/2026-10-26-torn-userlist-filter-fallen; WT=$W/wt; export TULF_SRC="$WT/server/public/scripts/torn-userlist-filter.user.js"; cd "$WT/server" && node --test torn-userlist-filter.test.mjs > "$W/t.log" 2>&1; command grep -E "^# (tests|pass|fail) " "$W/t.log" | paste -sd" " -; node --test > "$W/baseline.log" 2>&1; command grep -E "^# (tests|pass|fail|skipped) " "$W/baseline.log" | paste -sd" " -; command grep -E "^not ok" "$W/baseline.log" | head
```

Expected: `# tests 43 # pass 43 # fail 0`, then the whole suite with `# fail 0` and `# skipped 2`. Note its `# tests` count: Task 1 Step 9 expects 4 more. If anything fails, run `node --test` in `/opt/warboard/server` too. A failure in both is not this plan's: ledger it and go on.

---

### Task 1: The fallen

**Files:**
- Modify: `docs/superpowers/specs/2026-10-25-torn-userlist-filter-design.md` (Status, Decisions, What it does, Telling who is where, The bar, Stored, Files, Testing, Live check)
- Modify: `server/torn-userlist-filter.test.mjs` (the pins that move with 1.0.1, and a new section, "The fallen (1.0.1)", before "The bar")
- Modify: `server/public/scripts/torn-userlist-filter.user.js:4-5`, `:19`, `:26`, `:45-60`, `:99-100`, `:135`
- Regenerate: `server/public/scripts/torn-userlist-filter.meta.js`

**Interfaces:**
- Consumes: nothing from another task.
- Produces, for Task 2: the branch's script at 1.0.1 (its header, `VERSION` and meta file agree) and its 47 tests, passing with `TULF_SRC` set to the worktree's copy.

- [ ] **Step 1: Amend the spec.** It records the 1.0.1 decision (Q7) and the Fallen row, and moves the bar, the stored switches, the header and the tests to four kinds.

**Edit 1 of 11 in `docs/superpowers/specs/2026-10-25-torn-userlist-filter-design.md`.** Replace:

```md
**Script:** `server/public/scripts/torn-userlist-filter.user.js` and `.meta.js`, version 1.0.0. Tests: `server/torn-userlist-filter.test.mjs`.
```

With:

```md
**Amended for 1.0.1** on 2026-10-26: the owner asked at 18:20 EDT, "for the user filter can you include to hide the fallen", and approved the design at 18:37 EDT: "do recommended". See Q7, and the Fallen row under "Telling who is where".
**Script:** `server/public/scripts/torn-userlist-filter.user.js` and `.meta.js`, version 1.0.1. Tests: `server/torn-userlist-filter.test.mjs`.
```

**Edit 2 of 11 in `docs/superpowers/specs/2026-10-25-torn-userlist-filter-design.md`.** Replace:

```md
| Q6 | The name is "Torn User List Filter", file `torn-userlist-filter.user.js`, served on tornwar. RussianRob, All Rights Reserved, ready for the owner to upload to Greasy Fork. |
```

With:

```md
| Q6 | The name is "Torn User List Filter", file `torn-userlist-filter.user.js`, served on tornwar. RussianRob, All Rights Reserved, ready for the owner to upload to Greasy Fork. |
| Q7 | (1.0.1) Fallen players are hidden too, with a switch of their own after Jail. It starts on, also for anyone whose switches were saved by 1.0.0. Going live needs no warboard restart. The owner: "do recommended". |
```

**Edit 3 of 11 in `docs/superpowers/specs/2026-10-25-torn-userlist-filter-design.md`.** Replace:

```md
A row that shows Torn's hospital, jail or travel icon is hidden while that kind's switch is on.
```

With:

```md
A row that shows Torn's hospital, jail, travel or fallen icon is hidden while that kind's switch is on.
```

**Edit 4 of 11 in `docs/superpowers/specs/2026-10-25-torn-userlist-filter-design.md`.** Replace:

```md
| Abroad | 71 (Traveling) | Torn's list of status icons (87 kinds, as TornTools lists them) has no separate abroad icon, so the plane should cover people landed abroad as well as those in flight. The live check confirms it before release. |
```

With:

```md
| Abroad | 71 (Traveling) | Torn's list of status icons (87 kinds, as TornTools lists them) has no separate abroad icon, so the plane should cover people landed abroad as well as those in flight. The live check confirms it before release. |
| Fallen | 77 (Fallen) | Added in 1.0.1. 77 is not in TornTools' table of icons, but TornTools' own user-list filter reads it as Fallen on this same page, for its "Fallen" checkbox. We have not seen it on a live page, so the owner's check after release settles it. |
```

**Edit 5 of 11 in `docs/superpowers/specs/2026-10-25-torn-userlist-filter-design.md`.** Replace:

```md
The numbers come from TornTools' table of Torn's icons. A number in that table is decided by its number alone, so 70 and 82 stay as the table above says whatever their labels are. An icon whose number is not in the table (say Torn renumbers one) counts by its label (`aria-label` or `title`): one starting with "Hospital", "Jail", "Traveling" or "Abroad" counts as that kind.
```

With:

```md
The numbers come from TornTools' table of Torn's icons, and 77 from TornTools' user-list filter. A number in that table, or 77, is decided by its number alone, so 70 and 82 stay as the table above says whatever their labels are. An icon whose number is not in the table (say Torn renumbers one) counts by its label (`aria-label` or `title`): one starting with "Hospital", "Jail", "Traveling", "Abroad" or "Fallen" counts as that kind.
```

**Edit 6 of 11 in `docs/superpowers/specs/2026-10-25-torn-userlist-filter-design.md`.** Replace:

```md
- **What it says:** `Hide: [x] Hospital  [x] Abroad  [x] Jail   12 of 50 hidden on this page`.
```

With:

```md
- **What it says:** `Hide: [x] Hospital  [x] Abroad  [x] Jail  [x] Fallen   12 of 50 hidden on this page`.
```

**Edit 7 of 11 in `docs/superpowers/specs/2026-10-25-torn-userlist-filter-design.md`.** Replace:

```md
- `tulf-switches`: `{"hospital":true,"abroad":true,"jail":true}`.
- Nothing stored, or a value that won't parse: all three on.
```

With:

```md
- `tulf-switches`: `{"hospital":true,"abroad":true,"jail":true,"fallen":true}`.
- Nothing stored, or a value that won't parse: all four on. A kind missing from what is stored is on, so switches saved by 1.0.0, which had no `fallen`, read Fallen as on.
```

**Edit 8 of 11 in `docs/superpowers/specs/2026-10-25-torn-userlist-filter-design.md`.** Replace:

```md
@license All Rights Reserved, @version 1.0.0, a CHANGELOG block.
```

With:

```md
@license All Rights Reserved, @version 1.0.1, a CHANGELOG block, newest version first.
```

**Edit 9 of 11 in `docs/superpowers/specs/2026-10-25-torn-userlist-filter-design.md`.** Replace:

```md
  - @description: hides people in hospital, in jail or abroad (in flight or landed) from Torn's user list search, with a switch for each above the list.
```

With:

```md
  - @description: hides people in hospital, in jail, abroad (in flight or landed) or fallen from Torn's user list search, with a switch for each above the list.
```

**Edit 10 of 11 in `docs/superpowers/specs/2026-10-25-torn-userlist-filter-design.md`.** Replace:

```md
- **Telling who is where:** rows with icons 15, 91, 16 and 71 count as their kinds;
```

With:

```md
- **Telling who is where:** rows with icons 15, 91, 16, 71 and 77 count as their kinds;
```

**Edit 11 of 11 in `docs/superpowers/specs/2026-10-25-torn-userlist-filter-design.md`.** Replace:

```md
- PDA, if handy: the same.

## Not in this version
```

With:

```md
- PDA, if handy: the same.
- 1.0.1: a fallen player in the results is hidden while Fallen is on, and shows again when it is off.

## Not in this version
```


- [ ] **Step 2: Write the tests.** First the pins that move with 1.0.1: the version, the description, the CHANGELOG line, four switches where there were three, and `"fallen":true` in the saved JSON. Then four new tests, in a new section before "The bar". `TITLES` gains `77: 'Fallen'`, so `icon(77)` gets the title Torn's other icons get here. The `ROWS` fixture stays as it is.

**Edit 1 of 17 in `server/torn-userlist-filter.test.mjs`.** Replace:

```js
// Torn User List Filter: hides people in hospital, in jail or abroad from Torn's user list search.
```

With:

```js
// Torn User List Filter: hides people in hospital, in jail, abroad or fallen from Torn's user list search.
```

**Edit 2 of 17 in `server/torn-userlist-filter.test.mjs`.** Replace:

```js
const RUNNING = '[Torn User List Filter 1.0.0] running';
```

With:

```js
const RUNNING = '[Torn User List Filter 1.0.1] running';
```

**Edit 3 of 17 in `server/torn-userlist-filter.test.mjs`.** Replace:

```js
  71: 'Traveling', 82: 'Hospital early discharge', 91: 'Hospital radiation poisoning' };
```

With:

```js
  71: 'Traveling', 77: 'Fallen', 82: 'Hospital early discharge', 91: 'Hospital radiation poisoning' };
```

**Edit 4 of 17 in `server/torn-userlist-filter.test.mjs`.** Replace:

```js
    'version 1.0.0',
    'description Hides people in hospital, in jail or abroad (in flight or landed) from Torn\'s user list search, with a switch for each above the list.',
```

With:

```js
    'version 1.0.1',
    'description Hides people in hospital, in jail, abroad (in flight or landed) or fallen from Torn\'s user list search, with a switch for each above the list.',
```

**Edit 5 of 17 in `server/torn-userlist-filter.test.mjs`.** Replace:

```js
  assert.match(src, /\n  const VERSION = '1\.0\.0';\n/);
  assert.match(src, /\n\/\/ CHANGELOG\n/);
  assert.match(src, /\n\/\/ v1\.0\.0  - First release\./);
```

With:

```js
  assert.match(src, /\n  const VERSION = '1\.0\.1';\n/);
  assert.match(src, /\n\/\/ CHANGELOG\n/);
  assert.match(src, /\n\/\/ v1\.0\.1  - Hides fallen players too \(Torn's icon 77\)/);
  assert.match(src, /\n\/\/ v1\.0\.0  - First release\./);
  assert.ok(src.indexOf('// v1.0.1') < src.indexOf('// v1.0.0'), 'the CHANGELOG lists the newest version first');
```

**Edit 6 of 17 in `server/torn-userlist-filter.test.mjs`.** Replace:

```js
    assert.equal(w.document.documentElement.getAttribute('data-tulf'), '1.0.0', search);
```

With:

```js
    assert.equal(w.document.documentElement.getAttribute('data-tulf'), '1.0.1', search);
```

**Edit 7 of 17 in `server/torn-userlist-filter.test.mjs`.** Replace:

```js
  assert.deepEqual(switchesOf(w), { Hospital: true, Abroad: true, Jail: true });
  assert.deepEqual(Object.keys(switchesOf(w)), ['Hospital', 'Abroad', 'Jail']);
```

With:

```js
  assert.deepEqual(switchesOf(w), { Hospital: true, Abroad: true, Jail: true, Fallen: true });
  assert.deepEqual(Object.keys(switchesOf(w)), ['Hospital', 'Abroad', 'Jail', 'Fallen']);
```

**Edit 8 of 17 in `server/torn-userlist-filter.test.mjs`.** Replace:

```js
  const w = page({ rows: PLACEHOLDER }).run();
  assert.deepEqual(switchesOf(w), { Hospital: true, Abroad: true, Jail: true });
```

With:

```js
  const w = page({ rows: PLACEHOLDER }).run();
  assert.deepEqual(switchesOf(w), { Hospital: true, Abroad: true, Jail: true, Fallen: true });
```

**Edit 9 of 17 in `server/torn-userlist-filter.test.mjs`.** Replace:

```js
  assert.equal(w.store[STORE], '{"hospital":false,"abroad":true,"jail":true}');
```

With:

```js
  assert.equal(w.store[STORE], '{"hospital":false,"abroad":true,"jail":true,"fallen":true}');
```

**Edit 10 of 17 in `server/torn-userlist-filter.test.mjs`.** Replace:

```js
  assert.equal(w.store[STORE], '{"hospital":true,"abroad":false,"jail":false}');
```

With:

```js
  assert.equal(w.store[STORE], '{"hospital":true,"abroad":false,"jail":false,"fallen":true}');
```

**Edit 11 of 17 in `server/torn-userlist-filter.test.mjs`.** Replace:

```js
  assert.deepEqual(switchesOf(next), { Hospital: true, Abroad: false, Jail: true });
```

With:

```js
  assert.deepEqual(switchesOf(next), { Hospital: true, Abroad: false, Jail: true, Fallen: true });
```

**Edit 12 of 17 in `server/torn-userlist-filter.test.mjs`.** Replace:

```js
  assert.equal(store[STORE], '{"hospital":false,"abroad":true,"jail":false}');
  const next = page({ store }).run();
  assert.deepEqual(switchesOf(next), { Hospital: false, Abroad: true, Jail: false });
```

With:

```js
  assert.equal(store[STORE], '{"hospital":false,"abroad":true,"jail":false,"fallen":true}');
  const next = page({ store }).run();
  assert.deepEqual(switchesOf(next), { Hospital: false, Abroad: true, Jail: false, Fallen: true });
```

**Edit 13 of 17 in `server/torn-userlist-filter.test.mjs`.** Replace:

```js
    assert.deepEqual(switchesOf(w), { Hospital: true, Abroad: false, Jail: false });
```

With:

```js
    assert.deepEqual(switchesOf(w), { Hospital: true, Abroad: false, Jail: false, Fallen: true });
```

**Edit 14 of 17 in `server/torn-userlist-filter.test.mjs`.** Replace:

```js
test('nothing saved, a value that won\'t parse, or one that isn\'t an object: all three on; a kind missing from it is on', () => {
  for (const saved of [undefined, '', 'not json', '42', 'null', '"text"']) {
    const store = saved === undefined ? {} : { [STORE]: saved };
    const w = page({ store }).run();
    assert.deepEqual(switchesOf(w), { Hospital: true, Abroad: true, Jail: true }, String(saved));
  }
  const w = page({ store: { [STORE]: '{"jail":false}' } }).run();
  assert.deepEqual(switchesOf(w), { Hospital: true, Abroad: true, Jail: false });
```

With:

```js
test('nothing saved, a value that won\'t parse, or one that isn\'t an object: all four on; a kind missing from it is on', () => {
  for (const saved of [undefined, '', 'not json', '42', 'null', '"text"']) {
    const store = saved === undefined ? {} : { [STORE]: saved };
    const w = page({ store }).run();
    assert.deepEqual(switchesOf(w), { Hospital: true, Abroad: true, Jail: true, Fallen: true }, String(saved));
  }
  const w = page({ store: { [STORE]: '{"jail":false}' } }).run();
  assert.deepEqual(switchesOf(w), { Hospital: true, Abroad: true, Jail: false, Fallen: true });
```

**Edit 15 of 17 in `server/torn-userlist-filter.test.mjs`.** Replace:

```js
  assert.deepEqual(switchesOf(next), { Hospital: true, Abroad: true, Jail: false });
```

With:

```js
  assert.deepEqual(switchesOf(next), { Hospital: true, Abroad: true, Jail: false, Fallen: true });
```

**Edit 16 of 17 in `server/torn-userlist-filter.test.mjs`.** Replace:

```js
test('storage that throws on reading, or no GM functions at all: all three on, and the switches still work on the page', () => {
  const broken = page({ getValue: () => { throw new Error('no storage'); } }).run();
  assert.deepEqual(switchesOf(broken), { Hospital: true, Abroad: true, Jail: true });
```

With:

```js
test('storage that throws on reading, or no GM functions at all: all four on, and the switches still work on the page', () => {
  const broken = page({ getValue: () => { throw new Error('no storage'); } }).run();
  assert.deepEqual(switchesOf(broken), { Hospital: true, Abroad: true, Jail: true, Fallen: true });
```

**Edit 17 of 17 in `server/torn-userlist-filter.test.mjs`.** Replace:

```js
// ---------------------------------------------------------------------------------------------
// The bar
// ---------------------------------------------------------------------------------------------
```

With:

```js
// ---------------------------------------------------------------------------------------------
// The fallen (1.0.1)
// ---------------------------------------------------------------------------------------------

test('icon 77 counts as fallen by its number alone: with every switch on, fallen rows are hidden whatever their labels say', () => {
  const w = page({ rows: [
    row('fallen', [icon(1), icon(77)]),
    row('fallen-no-label', [icon(77, { title: '' })]),
    row('fallen-other-label', [icon(77, { title: '<b>Online</b>' })]),
    row('okay', [icon(1), icon(9)]),
  ].join('') }).run();
  assert.deepEqual(hiddenRows(w), ['fallen', 'fallen-no-label', 'fallen-other-label']);
  assert.deepEqual(showingRows(w), ['okay']);
  assert.equal(count(w), '3 of 4 hidden on this page');
});

test('an icon whose number is not known counts as fallen when its label starts with "Fallen"; a known number never does', () => {
  const w = page({ rows: [
    row('title', [icon(150, { title: '<b>Fallen</b><br>Rest in peace' })]),
    row('aria', [icon(151, { title: '', label: 'FALLEN' })]),
    row('mid-word', [icon(152, { title: 'Not fallen' })]),
    row('idle', [icon(62, { title: '<b>Fallen</b>' })]),
  ].join('') }).run();
  assert.deepEqual(hiddenRows(w), ['title', 'aria']);
  assert.deepEqual(showingRows(w), ['mid-word', 'idle']);
});

test('the Fallen switch takes effect at once and is saved; off, the fallen show again, and the next page load keeps it off', () => {
  const store = {};
  const w = page({ store, rows: row('fallen', [icon(1), icon(77)]) + row('hospital', [icon(15)]) }).run();
  assert.deepEqual(hiddenRows(w), ['fallen', 'hospital']);
  flip(w, 'Fallen', false);
  assert.deepEqual(hiddenRows(w), ['hospital']);
  assert.equal(count(w), '1 of 2 hidden on this page');
  assert.equal(store[STORE], '{"hospital":true,"abroad":true,"jail":true,"fallen":false}');
  const next = page({ store, rows: row('fallen', [icon(77)]) }).run();
  assert.deepEqual(switchesOf(next), { Hospital: true, Abroad: true, Jail: true, Fallen: false });
  assert.deepEqual(hiddenRows(next), []);
});

test('switches saved by 1.0.0, which had no Fallen switch, read Fallen as on: the fallen are hidden for them too', () => {
  const store = { [STORE]: '{"hospital":false,"abroad":false,"jail":false}' };
  const w = page({ store, rows: row('fallen', [icon(77)]) + row('hospital', [icon(15)]) + row('flying', [icon(71)]) }).run();
  assert.deepEqual(switchesOf(w), { Hospital: false, Abroad: false, Jail: false, Fallen: true });
  assert.deepEqual(hiddenRows(w), ['fallen']);
  assert.equal(store[STORE], '{"hospital":false,"abroad":false,"jail":false}', 'nothing is saved until a switch is flipped');
});

// ---------------------------------------------------------------------------------------------
// The bar
// ---------------------------------------------------------------------------------------------
```


- [ ] **Step 3: Run them, and watch them fail:**

```bash
W=/opt/warboard/.superpowers/sdd/2026-10-26-torn-userlist-filter-fallen; WT=$W/wt; cd "$WT/server" && TULF_SRC="$WT/server/public/scripts/torn-userlist-filter.user.js" node --test torn-userlist-filter.test.mjs > "$W/t.log" 2>&1; command grep -E "^# (tests|pass|fail) " "$W/t.log" | paste -sd" " -; command grep -E "^not ok" "$W/t.log"
```

Expected: `# tests 47 # pass 30 # fail 17`, failing on 1.0.0's version, its three switches and its missing fallen kind, never on a syntax error:

```
not ok 1 - the header is the spec's, and the meta file is the header and a newline
not ok 3 - it runs on page.php?sid=UserList in any letter case, and says so once in the console
not ok 5 - loaded twice on one page, it runs once
not ok 13 - icon 77 counts as fallen by its number alone: with every switch on, fallen rows are hidden whatever their labels say
not ok 14 - an icon whose number is not known counts as fallen when its label starts with "Fallen"; a known number never does
not ok 15 - the Fallen switch takes effect at once and is saved; off, the fallen show again, and the next page load keeps it off
not ok 16 - switches saved by 1.0.0, which had no Fallen switch, read Fallen as on: the fallen are hidden for them too
not ok 17 - the bar sits right before the list's title bar, with a switch for each kind, all on, and the count
not ok 23 - a page with no rows (Torn still loading them, or no results) shows the switches and no count
not ok 25 - a switch takes effect at once on the rows on the page, and is saved as a string of JSON
not ok 26 - the next page load starts from the saved switches
not ok 27 - a switch saves only its own kind, so in two tabs one flipped in the other tab since this one loaded stays as that tab saved it
not ok 31 - saved switches read back as a string, as PDA hands them back, or as the object itself
not ok 32 - nothing saved, a value that won't parse, or one that isn't an object: all four on; a kind missing from it is on
not ok 33 - a save that storage refuses still takes effect on this page; the next load starts from what was saved before
not ok 34 - storage that throws on reading, or no GM functions at all: all four on, and the switches still work on the page
not ok 47 - an error in a check stays there: the script starts, and the next check works
```

- [ ] **Step 4: Write the code.** The header, the CHANGELOG, `VERSION`, the fourth kind and its numbers and label, and the comments that counted three kinds.

**Edit 1 of 6 in `server/public/scripts/torn-userlist-filter.user.js`.** Replace:

```js
// @version      1.0.0
// @description  Hides people in hospital, in jail or abroad (in flight or landed) from Torn's user list search, with a switch for each above the list.
```

With:

```js
// @version      1.0.1
// @description  Hides people in hospital, in jail, abroad (in flight or landed) or fallen from Torn's user list search, with a switch for each above the list.
```

**Edit 2 of 6 in `server/public/scripts/torn-userlist-filter.user.js`.** Replace:

```js
// v1.0.0  - First release. Hides people in hospital, in jail or abroad (in flight
```

With:

```js
// v1.0.1  - Hides fallen players too (Torn's icon 77), with a switch of their own
//           after Jail, on by default, also for switches saved by 1.0.0.
// v1.0.0  - First release. Hides people in hospital, in jail or abroad (in flight
```

**Edit 3 of 6 in `server/public/scripts/torn-userlist-filter.user.js`.** Replace:

```js
  const VERSION = '1.0.0';
```

With:

```js
  const VERSION = '1.0.1';
```

**Edit 4 of 6 in `server/public/scripts/torn-userlist-filter.user.js`.** Replace:

```js
  // The three kinds, in the bar's order, and their names there.
  const KINDS = ['hospital', 'abroad', 'jail'];
  const NAMES = { hospital: 'Hospital', abroad: 'Abroad', jail: 'Jail' };
  // GM storage: the three switches, as a string of JSON.
  const STORE = 'tulf-switches';
  // Torn's status icons by number, as TornTools lists them: 87 kinds, every number from 1 to 91
  // but 14, 69, 77 and 88. A number in the list is decided by the number alone. Four of them
  // tell of a kind: 15 Hospital and 91 Hospital (radiation poisoning), 16 Jail, and 71
  // Traveling. Torn has no icon of its own for abroad, so the plane covers people landed abroad
  // as well as those in the air. 70 (Federal jail) and 82 (Hospital early discharge) hide
  // nothing.
  const KNOWN = [[1, 13], [15, 68], [70, 76], [78, 87], [89, 91]];
  const BY_NUMBER = { 15: 'hospital', 91: 'hospital', 16: 'jail', 71: 'abroad' };
  // An icon whose number isn't in the list (Torn renumbered one, say) counts by how its label
  // starts, in any letter case.
  const BY_LABEL = [[/^hospital/i, 'hospital'], [/^jail/i, 'jail'], [/^(?:traveling|abroad)/i, 'abroad']];
```

With:

```js
  // The four kinds, in the bar's order, and their names there.
  const KINDS = ['hospital', 'abroad', 'jail', 'fallen'];
  const NAMES = { hospital: 'Hospital', abroad: 'Abroad', jail: 'Jail', fallen: 'Fallen' };
  // GM storage: the four switches, as a string of JSON.
  const STORE = 'tulf-switches';
  // Torn's status icons by number: the 87 kinds in TornTools' table of icons (every number from
  // 1 to 91 but 14, 69, 77 and 88), and 77, which that table leaves out but TornTools' own
  // user-list filter reads as Fallen. A number in the list is decided by the number alone. Five
  // of them tell of a kind: 15 Hospital and 91 Hospital (radiation poisoning), 16 Jail, 71
  // Traveling and 77 Fallen. Torn has no icon of its own for abroad, so the plane covers people
  // landed abroad as well as those in the air. 70 (Federal jail) and 82 (Hospital early
  // discharge) hide nothing.
  const KNOWN = [[1, 13], [15, 68], [70, 87], [89, 91]];
  const BY_NUMBER = { 15: 'hospital', 91: 'hospital', 16: 'jail', 71: 'abroad', 77: 'fallen' };
  // An icon whose number isn't in the list (Torn renumbered one, say) counts by how its label
  // starts, in any letter case.
  const BY_LABEL = [[/^hospital/i, 'hospital'], [/^jail/i, 'jail'], [/^(?:traveling|abroad)/i, 'abroad'],
    [/^fallen/i, 'fallen']];
```

**Edit 5 of 6 in `server/public/scripts/torn-userlist-filter.user.js`.** Replace:

```js
  // The three switches: each is on unless it was saved off. With nothing saved, or a value that
  // won't parse, all three are on.
```

With:

```js
  // The four switches: each is on unless it was saved off, so a kind missing from what was
  // saved is on (Fallen, in switches saved by 1.0.0). With nothing saved, or a value that won't
  // parse, all four are on.
```

**Edit 6 of 6 in `server/public/scripts/torn-userlist-filter.user.js`.** Replace:

```js
  // The kind an icon tells of: 'hospital', 'abroad' or 'jail', or '' for none.
```

With:

```js
  // The kind an icon tells of: 'hospital', 'abroad', 'jail' or 'fallen', or '' for none.
```


- [ ] **Step 5: Regenerate the meta file** (the header and a newline):

```bash
W=/opt/warboard/.superpowers/sdd/2026-10-26-torn-userlist-filter-fallen; cd "$W/wt/server/public/scripts" && sed -n '1,/^\/\/ ==\/UserScript==$/p' torn-userlist-filter.user.js > torn-userlist-filter.meta.js && wc -l < torn-userlist-filter.meta.js && command grep -n '@version' torn-userlist-filter.meta.js && git -C "$W/wt" diff --stat | cat
```

Expected:

```
14
4:// @version      1.0.1
 .../2026-10-25-torn-userlist-filter-design.md      | 22 ++---
 server/public/scripts/torn-userlist-filter.meta.js |  4 +-
 server/public/scripts/torn-userlist-filter.user.js | 43 +++++-----
 server/torn-userlist-filter.test.mjs               | 94 +++++++++++++++++-----
 4 files changed, 111 insertions(+), 52 deletions(-)
```

- [ ] **Step 6: Run the tests again:**

```bash
W=/opt/warboard/.superpowers/sdd/2026-10-26-torn-userlist-filter-fallen; WT=$W/wt; cd "$WT/server" && TULF_SRC="$WT/server/public/scripts/torn-userlist-filter.user.js" node --test torn-userlist-filter.test.mjs > "$W/t.log" 2>&1; command grep -E "^# (tests|pass|fail) " "$W/t.log" | paste -sd" " -; command grep -E "^not ok" "$W/t.log"
```

Expected: `# tests 47 # pass 47 # fail 0`, and no `not ok` lines.

- [ ] **Step 7: Mutants.** Each changes one thing 1.0.1 adds, and the tests must catch every one.

Write `$W/mutants.mjs`:

```js
// Mutants of the worktree's script: each changes one thing 1.0.1 added, and the tests must fail
// on every one. Each is a copy of the script and its meta file in $W/mut, tested in place of the
// real one through TULF_SRC.
// Usage: node mutants.mjs <worktree>
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
const wt = process.argv[2];
const scripts = path.join(wt, "server/public/scripts");
const src = fs.readFileSync(path.join(scripts, "torn-userlist-filter.user.js"), "utf8");
const meta = fs.readFileSync(path.join(scripts, "torn-userlist-filter.meta.js"), "utf8");
const dir = path.join(path.dirname(wt), "mut");
fs.mkdirSync(dir, { recursive: true });
const MUTANTS = [
  ["77 left out of the numbers that tell of a kind", "71: 'abroad', 77: 'fallen' };", "71: 'abroad' };"],
  ["77 read as an unknown number, as in 1.0.0", "[70, 87]", "[70, 76], [78, 87]"],
  ["no Fallen label", ",\n    [/^fallen/i, 'fallen']];", "];"],
  ["the Fallen label read anywhere, not only at the start", "[/^fallen/i, 'fallen']", "[/fallen/i, 'fallen']"],
  ["the Fallen label in one letter case only", "[/^fallen/i, 'fallen']", "[/^Fallen/, 'fallen']"],
  ["Fallen first in the bar", "const KINDS = ['hospital', 'abroad', 'jail', 'fallen'];", "const KINDS = ['fallen', 'hospital', 'abroad', 'jail'];"],
  ["a kind missing from what was saved read as off", "saved[kind] === false", "saved[kind] !== true"],
];
let caught = 0;
MUTANTS.forEach(([name, from, to], i) => {
  if (src.split(from).length !== 2) throw new Error("not in the script exactly once: " + name);
  const file = path.join(dir, `m${i + 1}.user.js`);
  fs.writeFileSync(file, src.replace(from, to));
  fs.writeFileSync(path.join(dir, `m${i + 1}.meta.js`), meta);
  const run = spawnSync(process.execPath, ["--test", "torn-userlist-filter.test.mjs"],
    { cwd: path.join(wt, "server"), env: { ...process.env, TULF_SRC: file }, encoding: "utf8" });
  const failed = [...run.stdout.matchAll(/^not ok \d+ - (.*)$/gm)].map((m) => m[1]);
  if (failed.length) caught += 1;
  console.log(`m${i + 1} ${failed.length ? "caught by " + failed.length : "MISSED"}: ${name}`
    + (failed.length ? ` (first: ${failed[0].slice(0, 60)})` : ""));
});
console.log(`${caught} of ${MUTANTS.length} caught`);
process.exit(caught === MUTANTS.length ? 0 : 1);
```

Run it:

```bash
W=/opt/warboard/.superpowers/sdd/2026-10-26-torn-userlist-filter-fallen; node "$W/mutants.mjs" "$W/wt"
```

Expected:

```
m1 caught by 3: 77 left out of the numbers that tell of a kind (first: icon 77 counts as fallen by its number alone: with every swi)
m2 caught by 1: 77 read as an unknown number, as in 1.0.0 (first: icon 77 counts as fallen by its number alone: with every swi)
m3 caught by 1: no Fallen label (first: an icon whose number is not known counts as fallen when its )
m4 caught by 1: the Fallen label read anywhere, not only at the start (first: an icon whose number is not known counts as fallen when its )
m5 caught by 1: the Fallen label in one letter case only (first: an icon whose number is not known counts as fallen when its )
m6 caught by 4: Fallen first in the bar (first: the Fallen switch takes effect at once and is saved; off, th)
m7 caught by 4: a kind missing from what was saved read as off (first: switches saved by 1.0.0, which had no Fallen switch, read Fa)
7 of 7 caught
```

- [ ] **Step 8: Look at it.** Headless Chromium works on this box (memory `reference_headless_engines_on_box`). Serve a copy of the search page with the worktree's script in it, and screenshot the bar at 390 px and 860 px.

Write `$W/shot.mjs`:

```js
// A look at the bar with its four switches: a copy of Torn's user list, with made-up names,
// served from 127.0.0.1 with the worktree's script in the page, at phone and desktop width.
// Usage: node shot.mjs <playwright-core dir> <torn-userlist-filter.user.js> <out dir>
import http from "node:http";
import fs from "node:fs";
const [pw, scriptPath, out] = process.argv.slice(2);
const { chromium } = await import(pw + "/index.mjs");
const SCRIPT = fs.readFileSync(scriptPath, "utf8");
if (SCRIPT.includes("</script")) throw new Error("the script can't go in a script tag as it is");
const icon = (n, title) => `<li id="icon${n}___x7a" title="&lt;b&gt;${title}&lt;/b&gt;"></li>`;
const row = (name, icons) => `<li><div class="expander clearfix"><a class="user name" href="#"><span>${name}</span></a>`
  + `<span class="level"><span class="label">Level: </span><span class="value">80</span></span>`
  + `<ul id="iconTray" class="big svg singleicon">${icons.join("")}</ul></div></li>`;
const ROWS = [
  row("Member1", [icon(1, "Online")]),
  row("Member2", [icon(2, "Offline"), icon(77, "Fallen")]),
  row("Member3", [icon(1, "Online"), icon(15, "Hospital")]),
  row("Member4", [icon(62, "Idle")]),
].join("");
const PAGE = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<style>body { font: 12px Arial, sans-serif; margin: 0; padding: 10px; background: #191919; color: #ddd; }
a { color: #9cf; text-decoration: none; }
.users-list-title { display: flex; gap: 40px; padding: 6px 10px; background: #333; }
ul { list-style: none; margin: 0; padding: 0; }
.user-info-list-wrap > li { padding: 6px 10px; border-bottom: 1px solid #333; }
.expander { display: flex; gap: 20px; align-items: center; }
#iconTray li { display: inline-block; width: 16px; height: 16px; margin-right: 3px; background: #777; border-radius: 3px; }</style></head>
<body><div class="content-wrapper"><div class="content-title">Advanced Search</div><div class="userlist-wrapper">
<div class="users-list-title title-black top-round m-top10"><span>Name</span><span>Level</span><span>Icons</span></div>
<ul class="user-info-list-wrap bottom-round cont-gray">${ROWS}</ul></div></div>
<script>${SCRIPT}</script></body></html>`;
const srv = http.createServer((req, res) => {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.end(PAGE);
}).listen(0, "127.0.0.1");
await new Promise((r) => srv.on("listening", r));
const browser = await chromium.launch();
for (const w of [390, 860]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: 700 } });
  const p = await ctx.newPage();
  await p.goto(`http://127.0.0.1:${srv.address().port}/page.php?sid=UserList`);
  await p.waitForSelector("#tulf-bar");
  await (await p.$(".content-wrapper")).screenshot({ path: `${out}/bar-${w}.png` });
  const seen = await p.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    switches: [...document.querySelectorAll("#tulf-bar label")]
      .map((l) => l.textContent.trim() + (l.querySelector("input").checked ? " on" : " off")).join(", "),
    count: document.querySelector("#tulf-bar .tulf-count").textContent,
    hidden: [...document.querySelectorAll("ul.user-info-list-wrap > li")]
      .filter((li) => getComputedStyle(li).display === "none").map((li) => li.querySelector(".user.name").textContent).join(" "),
    barHeight: Math.round(document.getElementById("tulf-bar").getBoundingClientRect().height),
  }));
  console.log(w, JSON.stringify(seen));
  await ctx.close();
}
await browser.close();
srv.close();
```

Run it:

```bash
W=/opt/warboard/.superpowers/sdd/2026-10-26-torn-userlist-filter-fallen; PW=$(dirname "$(command grep -l '"version": "1.61' /root/.npm/_npx/*/node_modules/playwright-core/package.json | head -1)"); mkdir -p "$W/shots" && node "$W/shot.mjs" "$PW" "$W/wt/server/public/scripts/torn-userlist-filter.user.js" "$W/shots"
```

Expected:

```
390 {"scrollWidth":390,"switches":"Hospital on, Abroad on, Jail on, Fallen on","count":"2 of 4 hidden on this page","hidden":"Member2 Member3","barHeight":54}
860 {"scrollWidth":860,"switches":"Hospital on, Abroad on, Jail on, Fallen on","count":"2 of 4 hidden on this page","hidden":"Member2 Member3","barHeight":32}
```

Then look at `$W/shots/bar-390.png` and `$W/shots/bar-860.png`: the four switches in order, then the count, with Member1 and Member4 showing and nothing cut off.

- [ ] **Step 9: The whole suite, in the worktree:**

```bash
W=/opt/warboard/.superpowers/sdd/2026-10-26-torn-userlist-filter-fallen; WT=$W/wt; cd "$WT/server" && TULF_SRC="$WT/server/public/scripts/torn-userlist-filter.user.js" node --test > "$W/suite.log" 2>&1; command grep -E "^# (tests|pass|fail|skipped) " "$W/suite.log" | paste -sd" " -; command grep -E "^not ok" "$W/suite.log" | head
```

Expected: `# fail 0` and `# skipped 2`, with 4 more tests than the baseline in Setup Step 3.

- [ ] **Step 10: Sweep what the commit adds, then commit:**

```bash
W=/opt/warboard/.superpowers/sdd/2026-10-26-torn-userlist-filter-fallen; cd "$W/wt" && git diff | command grep -E '^\+' > "$W/added.txt"; command grep -oE '(^|[^A-Za-z0-9])[A-Za-z0-9]{16}([^A-Za-z0-9]|$)' "$W/added.txt" | sort | uniq -c; node "$W/sweep-env.mjs" "$W/added.txt" && node "$W/sweep-names.mjs" "$W/added.txt" && git add -- docs/superpowers/specs/2026-10-25-torn-userlist-filter-design.md server/torn-userlist-filter.test.mjs server/public/scripts/torn-userlist-filter.user.js server/public/scripts/torn-userlist-filter.meta.js && git commit -q -m "torn-userlist-filter 1.0.1: hides the fallen too, with a switch of their own after Jail" -m "Torn's icon 77 counts as fallen by its number, as TornTools' own user-list filter reads it, and an icon whose number is not known counts as fallen when its label starts with \"Fallen\". The switch starts on, also for switches saved by 1.0.0. The spec is amended for 1.0.1." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- docs/superpowers/specs/2026-10-25-torn-userlist-filter-design.md server/torn-userlist-filter.test.mjs server/public/scripts/torn-userlist-filter.user.js server/public/scripts/torn-userlist-filter.meta.js && git log --format='%h %s' -1 | cat && git status --short
```

Expected: no 16-character words, then `sweep clean (<n> values checked)`, `names sweep clean (<n> names and ids checked)`, the commit, and `?? server/node_modules`. Any 16-character word, or a sweep that fails: stop and look at it before committing.

---

## Between Task 1 and Task 2: the final review

As superpowers:executing-plans says: the review package from the branch's merge base with main, and one fresh Opus reviewer given this plan, the spec, its Review Focus and the ledger's `Ruling:` lines. Then one fix pass for Critical and Important findings, each test-first, with the script's tests and the whole suite green after it (both with `TULF_SRC` set). Minor findings go to the ledger and the report.

---

### Task 2: Release

- [ ] **Step 1: Pre-flight.** Note pm2's warboard pid; Step 4 checks it is unchanged.

```bash
uptime; W=/opt/warboard/.superpowers/sdd/2026-10-26-torn-userlist-filter-fallen; WT=$W/wt; command grep -E "^Task 1: complete|^Final" "$W/progress.md"; git -C "$WT" status --short; cd "$WT/server" && TULF_SRC="$WT/server/public/scripts/torn-userlist-filter.user.js" node --test torn-userlist-filter.test.mjs > "$W/t.log" 2>&1; command grep -E "^# (tests|pass|fail) " "$W/t.log" | paste -sd" " -; pm2 pid warboard | tee "$W/pid-before"; cd /opt/warboard && git log --format='%h %s' main..torn-userlist-filter-fallen | cat; git status --short -- docs/superpowers/specs/2026-10-25-torn-userlist-filter-design.md server/torn-userlist-filter.test.mjs server/public/scripts/torn-userlist-filter.user.js server/public/scripts/torn-userlist-filter.meta.js
```

Expected: the load under 12; Task 1's `complete` line and the final review's lines; `?? server/node_modules`; `# tests 47 # pass 47 # fail 0`; warboard's pid, a number other than 0; Task 1's commit and any fix-pass commits; then nothing, because main's copies of the four paths are clean.

- [ ] **Step 2: Fast-forward main.** The served script changes the moment the merge lands. Git writes the files as root, so give them back to warboard:

```bash
cd /opt/warboard && git merge -q --ff-only torn-userlist-filter-fallen && chown warboard:warboard server/public/scripts/torn-userlist-filter.user.js server/public/scripts/torn-userlist-filter.meta.js && chmod 644 server/public/scripts/torn-userlist-filter.user.js server/public/scripts/torn-userlist-filter.meta.js; git log --format='%h %s' -1 | cat; stat -c '%U:%G %a %n' server/public/scripts/torn-userlist-filter.user.js server/public/scripts/torn-userlist-filter.meta.js; git status --short -- server/public/scripts/torn-userlist-filter.user.js server/public/scripts/torn-userlist-filter.meta.js
```

Expected: the branch's last commit as main's HEAD; both files `warboard:warboard 644`; then nothing. If the merge is refused, main has moved on. Then run `git -C "$W/wt" rebase main`, run Task 1 Steps 6 and 9 again, and repeat this step.

- [ ] **Step 3: The whole suite on main.** This is the gate `deploy.sh` runs, without its reload. A bare run is right here: main's test file now tests main's script, which is 1.0.1.

```bash
uptime; W=/opt/warboard/.superpowers/sdd/2026-10-26-torn-userlist-filter-fallen; cd /opt/warboard/server && node --test > "$W/main-suite.log" 2>&1; command grep -E "^# (tests|pass|fail|skipped) " "$W/main-suite.log" | paste -sd" " -; command grep -E "^not ok" "$W/main-suite.log" | head
```

Expected: `# fail 0` and `# skipped 2`.

- [ ] **Step 4: Check what is served, and that nothing restarted:**

```bash
W=/opt/warboard/.superpowers/sdd/2026-10-26-torn-userlist-filter-fallen; F=/opt/warboard/server/public/scripts/torn-userlist-filter; T=$(date +%s); curl -s "http://127.0.0.1:3000/scripts/torn-userlist-filter.meta.js?t=$T" | command grep '@version'; curl -s "https://tornwar.com/scripts/torn-userlist-filter.meta.js?t=$T" | command grep '@version'; curl -s "https://tornwar.com/scripts/torn-userlist-filter.meta.js" | command grep '@version'; curl -s "https://tornwar.com/scripts/torn-userlist-filter.user.js?t=$T" | sha256sum | cut -c1-12; sha256sum "$F.user.js" | cut -c1-12; echo "pid before $(cat "$W/pid-before") after $(pm2 pid warboard)"
```

Expected: `// @version      1.0.1` three times. The third is the plain address, which is what Tampermonkey's update check fetches. nginx sends it with `max-age=300`, so if it still says 1.0.0, check it again after 5 minutes, and report only once it says 1.0.1. Then the same 12 hex characters twice, and the same pid before and after.

- [ ] **Step 5: Push.** Sweep the lines this push adds, then push, with the remote's URL masked:

```bash
W=/opt/warboard/.superpowers/sdd/2026-10-26-torn-userlist-filter-fallen; cd /opt/warboard && git log --format='%h %s' origin/main..main | cat && git diff origin/main..main | command grep -E '^\+' > "$W/added.txt"; command grep -oE '(^|[^A-Za-z0-9])[A-Za-z0-9]{16}([^A-Za-z0-9]|$)' "$W/added.txt" | sort | uniq -c; node "$W/sweep-env.mjs" "$W/added.txt" && node "$W/sweep-names.mjs" "$W/added.txt" && git push -q origin main 2>&1 | sed -E 's#//[^@]*@#//***@#g'; git log --format='%h' -1 origin/main
```

Expected: this plan's commit, Task 1's and any fix-pass commits, and no other session's; the 16-character check lists only `getComputedStyle` and `querySelectorAll`, function names in this plan's screenshot script and in this line; both sweeps clean; then origin/main at main's HEAD. A commit from another session: stop and ask before pushing it.

- [ ] **Step 6: Clean up.** Copy the ledger, the logs and the screenshots into this session's scratchpad directory, then remove the worktree's `node_modules` link, the worktree, the branch and the workspace:

```bash
W=/opt/warboard/.superpowers/sdd/2026-10-26-torn-userlist-filter-fallen; S="$SCRATCHPAD/tulf-fallen-release"; mkdir -p "$S" && cp -r "$W/progress.md" "$W"/*.log "$W/shots" "$S/" && rm "$W/wt/server/node_modules" && cd /opt/warboard && git worktree remove "$W/wt" && git branch -d torn-userlist-filter-fallen && rm -r /opt/warboard/.superpowers/sdd/2026-10-26-torn-userlist-filter-fallen && git worktree list | command grep -c torn-userlist-filter-fallen
```

(`SCRATCHPAD` is the scratchpad directory the session's system prompt names.) Expected: `0`.

- [ ] **Step 7: Memory.** Update `project_torn_userlist_filter.md`: 1.0.1 is live and pushed (its commit), with no restart. Owed: the owner's check that a fallen row is hidden, and the Greasy Fork upload, now of 1.0.1. The deferred minors stay as they were, except X2 ("77 is taken as a known number"), which no longer applies: 77 is known now, and a test pins it. Edit its MEMORY.md line in place.

- [ ] **Step 8: Report to the owner,** in a few short lines: Fallen is the fourth switch, on by default; https://tornwar.com/scripts/torn-userlist-filter.user.js; no warboard restart, so the chain was not touched. Ask them to check a fallen player in their results: hidden with Fallen on, back with it off. The Greasy Fork upload should be 1.0.1. Then the rulings and deferred minors, as superpowers:executing-plans lists them.
