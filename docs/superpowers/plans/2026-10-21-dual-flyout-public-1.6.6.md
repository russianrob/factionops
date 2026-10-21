# Torn Dual Flyout 1.6.6 (public) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task by task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The public Torn Dual Flyout becomes the private 1.6.6 code under its own name: pinned links row, pinned links hidden from the menu, the three-bar button's count, the bar order drag tiles. It ships at the same version number as the private build, under GPL-3.0 for Greasy Fork.

**Architecture:** The private build (`torn-dual-flyout-private.user.js` 1.6.6, `352836cb`) already contains everything in public 1.5.16. The only public lines it changes are the header, the version marker, the cog panel's title, and the code it extends. The public file is that body with three identity edits:
- the header;
- the guard: a silent step-aside instead of the private build's "both on" note;
- the panel title.

A test pins the two files to the same code apart from those lines, so they cannot drift.

**Tech Stack:** ES5 userscript (`@grant none`, `@run-at document-start`); node:test + linkedom (`server/torn-dual-flyout-private.test.mjs`, `server/torn-dual-flyout-edge.test.mjs`, `server/torn-dual-flyout-icons.test.mjs`); headless Chromium tools in the session scratchpad (`pins/tools/drag.mjs`, `pins/tools/mount.mjs`).

**Spec:**
- **Design:** approved in chat on 2026-10-21 (bounded path). The owner's answer at 16:52 EDT: "yes same versions so both scripts are same version and change it to gpl 3.0 ill update it in greasyfork".
- **Feature spec:** `docs/superpowers/specs/2026-10-21-dual-flyout-private-pins-design.md`, as amended by the 1.6.1 to 1.6.6 commits.

## Global Constraints

- **Public header:**
  - `@name Torn Dual Flyout`, `@namespace RussianRob`, `@author RussianRob`;
  - `@license GPL-3.0-or-later` (the identifier the Greasy Fork #585201 copy already carries);
  - `@downloadURL` and `@updateURL` both `https://tornwar.com/scripts/torn-dual-flyout.user.js` (unchanged);
  - `@match https://www.torn.com/*`, `@run-at document-start`, `@grant none`;
  - no `@copyright`, and no "Private" or "fork" anywhere in the header.
- **Versions:** both builds carry `@version 1.6.6` and `window.__tdfVer = "1.6.6"`.
- **Private build:** `torn-dual-flyout-private.user.js` and `.meta.js` stay byte-identical to `352836cb`. It stays All Rights Reserved and keeps its note.
- **Public files:** the public build has no `.meta.js`, and none is created.
- **Changelog:** neither script has a CHANGELOG block, and none is added.
- **`@description`:** one sentence.
- **PDA:** no curly quotes in either script, and no new literal non-ASCII. The inherited `×`, `◀` and `▶` lines are old.
- **Greasy Fork:** the owner pushes it by hand. Give the tornwar URL to test.
- **Box:**
  - one heavy process at a time (the server is shared, load about 8 on 12 cores);
  - subagents on Opus;
  - push output masked with `sed -E 's#//[^@]*@#//***@#g'`;
  - never `git remote -v`, `git config --list`, or `cat .git/config` in /opt/warboard.

## Review Focus

1. **A player with both builds installed.** Whichever loads first runs alone. If the public loads first, the private shows its note. If the private loads first, the public says nothing. Pinned at Task 1, Steps 1–2.
2. **A 1.5.16 player upgrading.** Their side, Icons only and Sticky settings carry over, because the storage keys are unchanged. Covered by the same-code test: the public uses the private's keys, and the private's keys are 1.5.16's.
3. **A player running the old Greasy Fork 1.5.14 copy and the tornwar 1.6.6 copy together.** Both set and honour `window.__tornMenuRight`, so the first to load runs alone. No new test: 1.5.14's guard is the same line.
4. **The two builds drifting apart on a later bump.** The same-code test fails until both are changed together (Task 1, Step 1).
5. **PDA parsing the public file.** The curly-quote test covers both files (Task 1, Step 1).

---

### Task 1: Tests for the public build (RED)

**Files:**
- Modify: `server/torn-dual-flyout-private.test.mjs`. That means the `PUBLIC` constant (line 22), the curly-quote test (line 345), and the two load-order tests (lines 349–368).

**Interfaces:**
- Produces:
  - `PUBLIC`, overridable by `TDF_SRC` as in the edge and icons tests;
  - `sameCode(text, guardFrom, guardTo)`, which returns the body with the identity lines cut out;
  - `builtBy(p)`, which returns the title of the cog panel, telling which build drew it.

- [ ] **Step 1: Write the failing tests.** Changes and additions:

```js
// TDF_SRC, as in the edge and icons tests, tests a working copy of the public build.
const PUBLIC = process.env.TDF_SRC || '/opt/warboard/server/public/scripts/torn-dual-flyout.user.js';
```

```js
test('no curly quotes anywhere in either build: PDA straightens them and the script stops parsing', () => {
  for (const f of [SRC, PUBLIC]) assert.doesNotMatch(readFileSync(f, 'utf8'), /[‘’“”]/, f);
});

// Which build drew the cog panel: its title names it (both builds report the same version).
const builtBy = (p) => p.openCog().querySelector('h4').firstChild.textContent.trim();

test('with the public Torn Dual Flyout already running, this build stays off and says so', () => {
  const p = load({ order: 'public-first', stored: ['/gym.php'] });
  assert.equal(p.document.querySelectorAll('#torn-menu-right').length, 1);   // one copy's stylesheet
  assert.equal(p.touch.touchstart.length, 1);                                // one swipe handler
  p.tick();
  assert.equal(p.document.querySelectorAll('#tdf-pins').length, 1, 'the public copy draws the pins, once');
  const note = p.document.getElementById('tdfp-both-on');
  assert.ok(note, 'a note says why');
  assert.match(note.textContent, /public Torn Dual Flyout is also on/);
  assert.equal(builtBy(p), 'Torn Dual Flyout');
});

test('loaded first, this build keeps the public copy from starting a second time, and the public copy says nothing', () => {
  const p = load({ order: 'private-first', stored: ['/gym.php'] });
  assert.equal(p.document.querySelectorAll('#torn-menu-right').length, 1);
  assert.equal(p.touch.touchstart.length, 1);
  p.tick();
  assert.equal(p.document.querySelectorAll('#tdf-pins').length, 1);
  assert.equal(p.document.getElementById('tdfp-both-on'), null);
  assert.equal(builtBy(p), 'Torn Dual Flyout Private');
});

// ---- The public build ----
// The public Torn Dual Flyout is this build under its own name: the same code, the same
// version, its own update address, and GPL-3.0 so Greasy Fork can list it.
test('the public build names itself, keeps its own update address, carries this build\'s version, and is GPL-3.0', () => {
  const h = header(readFileSync(PUBLIC, 'utf8'));
  assert.equal(field(h, 'name'), 'Torn Dual Flyout');
  assert.equal(field(h, 'namespace'), 'RussianRob');
  assert.equal(field(h, 'version'), field(header(readFileSync(SRC, 'utf8')), 'version'));
  assert.equal(field(h, 'author'), 'RussianRob');
  assert.equal(field(h, 'license'), 'GPL-3.0-or-later');
  assert.equal(field(h, 'downloadURL'), 'https://tornwar.com/scripts/torn-dual-flyout.user.js');
  assert.equal(field(h, 'updateURL'), 'https://tornwar.com/scripts/torn-dual-flyout.user.js');
  assert.equal(field(h, 'match'), 'https://www.torn.com/*');
  assert.equal(field(h, 'run-at'), 'document-start');
  assert.equal(field(h, 'grant'), 'none');
  assert.equal(field(h, 'copyright'), null);
  assert.match(field(h, 'description'), /pinned menu links/);
  assert.doesNotMatch(h, /private|fork/i);
});

// What tells the builds apart: the header, the private build's note and its guard (the
// public one steps aside without a word), and the cog panel's title. With those cut out,
// the two must be the same code, so a change to one is a change to both.
function sameCode(text, guardFrom, guardTo) {
  const body = text.slice(text.indexOf('// ==/UserScript==') + '// ==/UserScript=='.length);
  const a = body.indexOf(guardFrom), b = body.indexOf(guardTo);
  assert.ok(a !== -1 && b >= a && body.indexOf(guardFrom, a + 1) === -1 && body.indexOf(guardTo, b + 1) === -1, 'the guard, once');
  return (body.slice(0, a) + '<guard>' + body.slice(b + guardTo.length))
    .replace('<h4>Torn Dual Flyout Private <span', '<h4>Torn Dual Flyout <span');
}
// The public build's whole guard, word for word: nothing else hides in the cut.
const GUARD = '  // Two copies of Torn Dual Flyout (this one and the private test build) would both\n' +
  '  // answer every swipe, so whichever loads first runs alone.\n' +
  '  if (window.__tornMenuRight) return;\n';
test('the public build is this build\'s code, apart from the lines that say which build it is', () => {
  const mine = sameCode(readFileSync(SRC, 'utf8'), '  // Shown instead of running', '  if (window.__tornMenuRight) { showBothOnNote(); return; }\n');
  const pub = sameCode(readFileSync(PUBLIC, 'utf8'), GUARD, GUARD);
  assert.ok(pub === mine, 'the same code');   // not assert.equal: two 66KB strings make an unreadable diff
});
```

- [ ] **Step 2: Run them against the served public 1.5.16.**

Run: `cd /opt/warboard/server && node --test torn-dual-flyout-private.test.mjs > $S/pub/red.log 2>&1; grep -E "^# (pass|fail)|^not ok" $S/pub/red.log`

Expected: FAIL for these, and these only:
- the public header test (version 1.5.16, `All Rights Reserved`, no pins in the description);
- the same-code test (no `// Two copies` comment and no pins code);
- the public-first test (no `#tdf-pins`: 1.5.16 has no pins).

### Task 2: Build the public 1.6.6 (GREEN)

**Files:**
- Create (working copy): `$S/pub/torn-dual-flyout.user.js`, where `S=/tmp/claude-0/-root/47c424fc-f532-4851-8c7f-7c18d084306c/scratchpad/pins`.

- [ ] **Step 1: Copy the served private 1.6.6 and make the three identity edits.** Make the edits with a short python script that cuts by markers. Do not type the `×` escape inside the note through a tool call: tool parameters are JSON, and the escape would arrive as the glyph.
  1. **Header:** the block from `// ==UserScript==` to `// ==/UserScript==` becomes:

```
// ==UserScript==
// @name         Torn Dual Flyout
// @namespace    RussianRob
// @version      1.6.6
// @description  Two-way swipe for Torn's mobile fly-out menu (swipe left opens it on the right, swipe right opens it on the left, with a side arrow on the menu button), plus a row of your pinned menu links under the header.
// @author       RussianRob
// @downloadURL  https://tornwar.com/scripts/torn-dual-flyout.user.js
// @updateURL    https://tornwar.com/scripts/torn-dual-flyout.user.js
// @license      GPL-3.0-or-later
// @match        https://www.torn.com/*
// @run-at       document-start
// @grant        none
// ==/UserScript==
```

  2. **Guard:** the text from `  // Shown instead of running` through `  if (window.__tornMenuRight) { showBothOnNote(); return; }\n` becomes:

```js
  // Two copies of Torn Dual Flyout (this one and the private test build) would both
  // answer every swipe, so whichever loads first runs alone.
  if (window.__tornMenuRight) return;
```

  3. **Title:** `<h4>Torn Dual Flyout Private <span` becomes `<h4>Torn Dual Flyout <span`.

- [ ] **Step 2: Run the tests on the working copy.**

Run: `cd /opt/warboard/server && TDF_SRC=$S/pub/torn-dual-flyout.user.js node --test torn-dual-flyout-private.test.mjs > $S/pub/green.log 2>&1; grep -E "^# (pass|fail)" $S/pub/green.log`

Expected: `# fail 0`, `# pass 154` (152 + the header test + the same-code test; the curly-quote and load-order tests are changed, not added).

- [ ] **Step 3: Run the edge and icons tests on the working copy.**

Run: `TDF_SRC=$S/pub/torn-dual-flyout.user.js node --test torn-dual-flyout-edge.test.mjs torn-dual-flyout-icons.test.mjs`

Expected: 8/8.

### Task 3: Verify

- [ ] **Step 1: PDA and parse checks.**
  - `node --check` on the working copy.
  - Simulate the curly-quote rewrite and re-parse.
  - `diff <(grep -nP '[^\x00-\x7F]' private) <(grep -nP '[^\x00-\x7F]' public)`: only line-number shifts.
- [ ] **Step 2: Wiring mutants.** Each must turn the suite red, with `TDF_SRC=` pointing at the mutant:
  1. `GPL-3.0-or-later` → `All Rights Reserved` (the header test fails);
  2. `if (window.__tornMenuRight) return;` → `if (window.__tornMenuRight) { return; }` (the guard is no longer word for word: the same-code test fails);
  3. `<h4>Torn Dual Flyout <span` → `<h4>Torn Dual Flyout Private <span` (the public-first test and the same-code test fail);
  4. one shared line changed: `HOLD_MS = 150` → `HOLD_MS = 200` (the same-code test fails);
  5. `@version 1.6.6` → `1.6.7` in the public only (the header test fails).
- [ ] **Step 3: Full suite.**

Run: `cd /opt/warboard/server && TDF_SRC=$S/pub/torn-dual-flyout.user.js timeout 600 npm test`

Expected: 0 fail. The total is 1958 + 2 tests. The private file's tests in this run see the public working copy through `TDF_SRC`.
- [ ] **Step 4: Chromium on the public build, one at a time.**
  - `node $S/tools/drag.mjs $S/pub/torn-dual-flyout.user.js $S/pub/drag`: the same 16 states as the private run in `$S/166/drag2/out.json`, and no errors.
  - `node $S/tools/mount.mjs /tmp/claude-0/-root/47c424fc-f532-4851-8c7f-7c18d084306c/scratchpad/review/sidebar-app.pretty.css $S/164/before.user.js $S/pub/torn-dual-flyout.user.js`: PASS.

The untick and tick checks are shared code, already run on the identical private body, and covered by the same-code test.

### Task 4: Review

- [ ] **Step 1:** Run one fresh Opus reviewer (superpowers:requesting-code-review) over:
  - public 1.5.16 → working copy;
  - the test diff;
  - this plan.

  Focus:
  - the identity edits;
  - whether `sameCode` allows more than it should;
  - load order with both builds;
  - the licence header for Greasy Fork.
- [ ] **Step 2:** Fix Critical and Important findings test-first. Defer minors, and list them for the owner.

### Task 5: Ship

- [ ] **Step 1: Install.**
  - Re-curl the served public script's `@version`; expect 1.5.16.
  - `install -o warboard -g warboard -m 644 $S/pub/torn-dual-flyout.user.js /opt/warboard/server/public/scripts/torn-dual-flyout.user.js`.
  - Run the private suite with default paths: `# fail 0`.
- [ ] **Step 2: Commit and push.**
  - Commit only these paths: `server/public/scripts/torn-dual-flyout.user.js`, `server/torn-dual-flyout-private.test.mjs`, and this plan.
  - Use the trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
  - Push to main, with the output masked.
- [ ] **Step 3: Check what is served.**
  - `curl https://tornwar.com/scripts/torn-dual-flyout.user.js?v=1.6.6` is byte-identical to the working copy.
  - The private files are unchanged: `git diff --quiet 352836cb HEAD -- server/public/scripts/torn-dual-flyout-private.*`.
- [ ] **Step 4: Memory.**
  - `project_flyout_favourites_strip.md`: the public is now 1.6.6, and the same-code test exists.
  - `reference_torn_dual_flyout_cog_sticky.md`, Distribution line: the owner chose GPL-3.0-or-later for the public build on 2026-10-21, and pushes it to Greasy Fork by hand.
  - The MEMORY.md line must not grow.
- [ ] **Step 5: Tell the owner.**
  - The URL `https://tornwar.com/scripts/torn-dual-flyout.user.js?v=1.6.6`.
  - The Greasy Fork page: https://greasyfork.org/en/scripts/585201.
  - The iPhone checks still owed.
  - The rulings made, and any deferred minors.
