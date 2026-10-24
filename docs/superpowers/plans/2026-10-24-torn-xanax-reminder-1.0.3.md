# Torn Xanax Reminder 1.0.3: a settings box, and a tap during the war - Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A long press on the Xanax icon opens a settings box, laid out like the Blood Bag Reminder's. In it you pick what a tap does during a ranked war (ask each time, the faction armoury, or your items) and enter the API key, and Save says whether it saved.

**Architecture:** One script changes: `server/public/scripts/torn-xanax-reminder.user.js`, with its `.meta.js`, tests and spec. The 24-hour war window becomes a war period that lasts until Torn gives the war an end time. A stored setting decides what a tap does in that period, and the key box becomes the settings box. All work happens in a git worktree on a branch, because the main checkout is the tree tornwar.com serves; the release fast-forwards main.

**Tech Stack:** a plain-JavaScript userscript (Tampermonkey, Torn PDA, the warboard app). Tests use node:test and linkedom, in `server/torn-xanax-reminder.test.mjs`, which reads the script from `TXR_SRC`.

**Spec:** `docs/superpowers/specs/2026-10-22-torn-xanax-reminder-design.md`, amended by Task 3. The owner approved this change on 2026-10-24 (EDT): they asked "or create a settings box like bloodbags that gives us an option if inwant to go to fac armourybdueing war", then said "yes go with your recommendations" to Q1-Q3 and the design below.

**Approved design (2026-10-24, owner: "yes go with your recommendations"):**
- Q1: the settings box offers three choices for a tap during a ranked war: Ask each time (the Armoury/Items box, the default), Faction Armoury (Drugs), Your Items (Drugs).
- Q2: the war counts from 24 hours before its start until Torn marks it over. While it is on, the box's title says "Ranked war on".
- Q3: outside a war a tap opens your items; that is not a setting.
- One settings box, laid out like Blood Bag Settings. It opens on a long press, or from the menu entry, renamed "Xanax Reminder: Settings". It holds the war list, the API key field, Cancel and Save, and a line under the key saying whether a key is saved and when the war was last checked.
- Save says "Saved." and closes, or says "Couldn't save, try again." and stays open. An empty key field keeps the saved key; Clear removes it.
- With no key, the box says the war choice needs one, and taps stay on your items.
- Version 1.0.3, tests first, spec updated, a review, then served and pushed.

**Added at plan time** (rulings 2, 3 and 13 below): the line under the key also says what Torn's last answer found ("Checked 12m ago: ranked war on."). A key saved in the box is asked about at once, even during a cooldown. Both answer the owner's first message: "the xanax icon isnt giving me an option i dont know id its saving my api key when i enter it".

## Global Constraints

- The source is plain ASCII, because PDA turns curly quotes into a syntax error.
- `###PDA-APIKEY###` appears exactly once, because a second copy breaks PDA's substitution.
- Every `GM_*` call is guarded with `typeof`.
- Values are stored as strings, because PDA hands stored values back as strings.
- The key field is a plain text field, never `type="password"`.
- The saved key is never shown. It never reaches the label, the tooltip or the console.
- The script never clicks anything itself. Every way out of the icon is a plain link you tap; the armoury setting changes where the icon's link points.
- The script has one menu entry, named for the script: `Xanax Reminder: Settings`.
- The version is 1.0.3, in three places: `// @version`, `const VERSION`, and a new CHANGELOG entry (newest first, saying why).
- The `.meta.js` is regenerated from the header.
- `@description` is one sentence on what the script does now. Version notes go only in the CHANGELOG, never in code comments.
- Times in the settings box are relative ("12m ago", "just now", "earlier"), never clock times.
- Code comments are clear `//` lines in the file's own style.
- The repo is public: no keys, key endings or member data in code, tests, spec or commits.
- Served files are `warboard:warboard 644`.
- The new script and the new test file reach the main checkout together, in the release's fast-forward. The test file's default `SRC` is the served script, so a new test file next to the old script would turn every whole-suite run red.
- Commit only this plan's paths: `git commit -- <paths>`. Trailer: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **A war that ends while every check fails** (a bad key, Torn down). The stored answer still says the war is on, so taps keep the war behaviour. A reasonable person expects to see that the answer is old: the settings box shows how long ago Torn last answered and the last error. Test: "the box says how long ago Torn answered, and keeps saying it when a later check fails" (Task 2).
2. **Torn giving an end time that is still to come.** Any end time means the war is over, as in 1.0.2. On 2026-10-24, none of the faction's 99 ended wars (the blood-bag store's list) had an end time later than when it was read, and the longest ran 108 h. Test: "a war with an end time is over, even when that time is still to come" (Task 1).
3. **A key saved during a cooldown,** when the icon isn't showing and so isn't checking. It is asked about at once. The box says "Not checked yet." until Torn answers, then what it found. Test: "a key saved while the cooldown runs is asked about at once, and the box then says what Torn found" (Task 2).
4. **Storage that refuses a write, drops it silently, or keeps the choice but not the key.** Save says "Couldn't save, try again." and the box stays open. The key saved before is kept. Test: "a save that storage refuses, drops, or keeps only in part says so, stays open and keeps the saved key" (Task 2).
5. **The armoury link mid-war** when Torn redraws the row, the setting changes, or the key goes. Each check sets the link, so it never stays on the armoury by mistake. Test: "the armoury link survives Torn redrawing the row, and goes back to your items when the setting or the key goes" (Task 1).

## Rulings made at plan time

1. **The box's id becomes `tm-xanax-reminder-settings`** (it was `tm-xanax-reminder-key`). In the long-press tests only the constant's value and the helper's name change, so their assertions stay.
2. **The status line says what Torn found.** It reads a new `okAt` in the stored war record: when Torn last answered well, in ms. `at` can't tell an answer from a call still out: a tab sets it before the call.
3. **Saving a key asks Torn at once, even during a cooldown.** That is one call. Otherwise calls still happen only while the icon shows, at most one per 30 minutes.
4. **"Saved." needs storage to give the value back** (`gmSet`, then `gmGet` equal). A save that keeps the choice but not the key counts as failed, and the box says so.
5. **There is no cap on the war period;** it ends when Torn gives an end time. The cost if wrong: if a war ends while every check fails, taps keep the war behaviour until a check succeeds. The box shows the answer's age and the error.
6. **The key field is not focused when the box opens.** The box is now mostly the war choice, and on a phone a focused field raises the keyboard over it.
7. **Clear key says "Key cleared."** and closes after the same second as Save.
8. **Tests changed on purpose,** because each pinned the 24-hour window or the key box:
   - **Task 1:**
     - "the war line runs from 24 hours before the start until the start" (its last two rows);
     - "the window opens and closes as the clock moves, without a reload" (its last step);
     - "from the war's start, a tap goes straight to your items again, and an open box closes".
   - **Task 2:**
     - the `KEYBOX` and `MENU` constants and the `keyBox`/`keyButtons` helpers;
     - "the key box: a plain text field...", "the menu opens a styled key box...", "Save keeps the key...", "Save with an empty field...", "Enter in the field saves too", "Clear forgets the key...", "Cancel, Escape and a tap on the dark area...";
     - Save found by its words in "a new key is asked about at once..." and "once storage saves again...";
     - "key box" renamed to "settings box" in the other titles.
   - **Task 3:** the header test and the console-line test.
9. **The work is in a git worktree** on branch `xanax-reminder-1.0.3`, inside this plan's git-ignored workspace, because the main checkout is what tornwar.com serves. Each task commits there. Task 4 fast-forwards main.
10. **The final review runs between Task 3 and Task 4,** so nothing unreviewed is served.
11. **After a successful save the key field empties,** so a second tap on Save, in the second before the box closes, asks Torn nothing more.
12. **The no-key note is part of the line under the key field** ("No key saved. The war choice needs one: until then, a tap always opens your items."). It is one line, and it updates after Save.
13. **A record without `okAt` that holds a war start reads "Checked earlier: ...".** Only Torn's answer sets a start, so such a record (saved by 1.0.2) did have an answer. Otherwise the owner's first look after the update, the very "is my key saving?" check, would say "Not checked yet." while the war line works.

## Files

- Modify: `server/public/scripts/torn-xanax-reminder.user.js` (Tasks 1-3) and `server/public/scripts/torn-xanax-reminder.meta.js` (Task 3, regenerated).
- Test: `server/torn-xanax-reminder.test.mjs` (Tasks 1-3).
- Modify: `docs/superpowers/specs/2026-10-22-torn-xanax-reminder-design.md` (Task 3).

## Paths and commands

- `WT` is the worktree, `/opt/warboard/.superpowers/sdd/2026-10-24-torn-xanax-reminder-1.0.3/wt`. Every command sets it, because shell variables don't carry from one command to the next.
- **The superpowers scripts** (`task-start`, `task-done`, `review-package`) run from inside `$WT`, so their `git rev-parse HEAD` is the branch's. Their ledger and briefs live in the worktree's own git-ignored `.superpowers/sdd/`.
- **The symlink:** `server/node_modules` in the worktree is a symlink to the main checkout's. Git sees it as untracked (`server/.gitignore` has `node_modules/`, which matches directories only), so commits always name their paths and never use `git add -A`.
- **`T`, the test run:**

```bash
WT=/opt/warboard/.superpowers/sdd/2026-10-24-torn-xanax-reminder-1.0.3/wt; cd "$WT/server" && TXR_SRC="$WT/server/public/scripts/torn-xanax-reminder.user.js" node --test torn-xanax-reminder.test.mjs 2>&1 | grep -E "^# (tests|pass|fail) " | paste -sd" " -
```

- **`C`, the source check** (it parses, and it is plain ASCII):

```bash
WT=/opt/warboard/.superpowers/sdd/2026-10-24-torn-xanax-reminder-1.0.3/wt; F="$WT/server/public/scripts/torn-xanax-reminder.user.js"; node --check "$F" && LC_ALL=C grep -c '[^ -~]' "$F" | grep -qx 0 && echo ascii-ok
```

## Setup (before Task 1)

- [ ] **Make the worktree,** from this plan's commit on main:

```bash
WT=/opt/warboard/.superpowers/sdd/2026-10-24-torn-xanax-reminder-1.0.3/wt; cd /opt/warboard && git worktree add "$WT" -b xanax-reminder-1.0.3 main && ln -s /opt/warboard/server/node_modules "$WT/server/node_modules" && git -C "$WT" log --format='%h %s' -1 && git -C "$WT" status --short
```

Expected: the branch's first commit is this plan's commit. Status shows only `?? server/node_modules`.

- [ ] **Baseline:** run `T`.

Expected: `# tests 84 # pass 84 # fail 0`.

---

### Task 1: The war period, and what a tap does in it

**Files:** `server/public/scripts/torn-xanax-reminder.user.js`, `server/torn-xanax-reminder.test.mjs`.

**Interfaces:**
- Consumes (1.0.2): `readWar()`, `apiKey()`, `gmGet()`, `untilText()`, `WINDOW_S`, `ITEMS_URL`, `ARMOURY_URL`.
- Produces:
  - `WAR_TAP_STORE = 'tm-xanax-reminder-war-tap'` and `WAR_TAPS = ['ask', 'armoury', 'items']`;
  - `warTap() -> 'ask'|'armoury'|'items'`;
  - `warPhase(nowMs) -> { left: seconds } | { on: true } | null`;
  - `phaseText(phase) -> string`;
  - `linkTarget(nowMs) -> url`;
  - each `check()` sets the icon's link.

  Task 2 uses `warTap`, `WAR_TAPS`, `WAR_TAP_STORE`, `untilText` and `check()`.

- [ ] **Step 1: Write the failing tests.** In `server/torn-xanax-reminder.test.mjs`:

Under the line `const URL = ...` add:

```js
// The settings box's choice for a tap during a ranked war.
const WAR_TAP_STORE = 'tm-xanax-reminder-war-tap';
```

Replace the test "the war line runs from 24 hours before the start until the start" with:

```js
test('the war line runs from 24 hours before the start until Torn gives the war an end time', async () => {
  const cases = [
    [NOW + 86400, 'War starts in 24h 0m: tap to pick the armoury or your items', 'exactly 24 hours before'],
    [NOW + 86401, null, 'just over 24 hours before'],
    [NOW + 5 * 3600 + 11 * 60 + 30, WAR_LINE, 'minutes round up'],
    [NOW + 45 * 60, 'War starts in 45m: tap to pick the armoury or your items', 'under an hour'],
    [NOW + 30, 'War starts in 1m: tap to pick the armoury or your items', 'under a minute: never 0m'],
    [NOW, 'Ranked war on: tap to pick the armoury or your items', 'at the start'],
    [NOW - 3600, 'Ranked war on: tap to pick the armoury or your items', 'once it has started'],
  ];
  for (const [start, line, why] of cases) {
    const w = page({ store: { [KEY_STORE]: KEY } }).run();
    answer(w.calls[0], wars(ranked(start)));
    await settle();
    w.check();
    assert.equal(w.label(), line ? LABEL + '. ' + line : LABEL, why);
  }
});
```

In "the window opens and closes as the clock moves, without a reload", replace its last three lines, from `w.clock.ms += 86400 * 1000;` to the `'the war has started'` assertion, with:

```js
  w.clock.ms += 86400 * 1000;
  w.check();
  assert.match(w.label(), /Ranked war on/, 'the war has started, and is still on');
  assert.equal(w.calls.length, 2, 'that check asked Torn again');
  answer(w.calls[1], wars(ranked(NOW + 86400 + 600, Math.floor(w.clock.ms / 1000) - 60)));
  await settle();
  w.check();
  assert.equal(w.label(), LABEL, 'Torn gave it an end time');
```

Replace the test "from the war's start, a tap goes straight to your items again, and an open box closes" with:

```js
test('from the war\'s start the box says the war is on, and once Torn gives it an end time a tap opens your items again', async () => {
  const w = page({ store: warStore() }).run();
  fire(w, w.link(), 'click');
  assert.ok(box(w));
  w.clock.ms = START * 1000;
  w.check();
  assert.equal(box(w).querySelector('b').textContent, 'Ranked war on', 'the box stays, and says so');
  w.clock.ms += 120 * 1000;
  answer(w.calls[0], wars(ranked(START, START + 60)));
  await settle();
  w.check();
  assert.equal(box(w), null, 'the box closed when the war ended');
  assert.equal(fire(w, w.link(), 'click').defaultPrevented, false);
});
```

After "the open box keeps its time current", add:

```js
test('during the war, a tap opens the box under "Ranked war on", with Armoury and Items', () => {
  const w = page({ store: warStore(NOW - 3600) }).run();
  assert.equal(fire(w, w.link(), 'click').defaultPrevented, true);
  assert.equal(box(w).querySelector('b').textContent, 'Ranked war on');
  assert.deepEqual([...box(w).querySelectorAll('a')].map((a) => [a.textContent, a.getAttribute('href')]),
    [['Armoury', ARMOURY], ['Items', ITEMS]]);
  assert.equal(w.label(), LABEL + '. Ranked war on: tap to pick the armoury or your items');
});

test('set to the armoury, the link points at the armoury from 24 hours before the war until it ends, with no box', () => {
  const w = page({ store: { ...warStore(NOW + 2 * 86400), [WAR_TAP_STORE]: 'armoury' } }).run();
  assert.equal(w.link().getAttribute('href'), ITEMS, 'two days before: your items');
  const war = (start, end = 0) => {
    w.store[WAR_STORE] = JSON.stringify({ at: w.clock.ms, start, end, error: '' });
    w.check();
  };
  war(START);
  assert.equal(w.link().getAttribute('href'), ARMOURY, 'in the 24 hours before');
  assert.equal(w.label(), LABEL + '. War starts in 5h 12m: tap to open the armoury');
  assert.equal(fire(w, w.link(), 'click').defaultPrevented, false, 'the tap follows the link');
  assert.equal(box(w), null, 'and opens no box');
  war(NOW - 3600);
  assert.equal(w.link().getAttribute('href'), ARMOURY, 'during the war');
  assert.equal(w.label(), LABEL + '. Ranked war on: tap to open the armoury');
  war(NOW - 3600, NOW - 60);
  assert.equal(w.link().getAttribute('href'), ITEMS, 'once it has an end time');
  assert.equal(w.label(), LABEL);
});

test('set to your items, a tap goes straight to your items all through the war, with no box', () => {
  const w = page({ store: { ...warStore(NOW - 3600), [WAR_TAP_STORE]: 'items' } }).run();
  assert.equal(w.link().getAttribute('href'), ITEMS);
  assert.equal(fire(w, w.link(), 'click').defaultPrevented, false);
  assert.equal(box(w), null);
  assert.equal(w.label(), LABEL + '. Ranked war on: tap to open your items');
});

test('a war with an end time is over, even when that time is still to come', () => {
  const store = { ...warStore(), [WAR_TAP_STORE]: 'armoury',
    [WAR_STORE]: JSON.stringify({ at: NOW * 1000, start: NOW - 3600, end: NOW + 3600, error: '' }) };
  const w = page({ store }).run();
  assert.equal(w.label(), LABEL);
  assert.equal(w.link().getAttribute('href'), ITEMS);
  assert.equal(fire(w, w.link(), 'click').defaultPrevented, false);
});

test('a stored tap setting the script doesn\'t know reads as ask each time', () => {
  for (const tap of ['bogus', '', 'ARMOURY', 1]) {
    const w = page({ store: { ...warStore(NOW - 3600), [WAR_TAP_STORE]: tap } }).run();
    assert.equal(fire(w, w.link(), 'click').defaultPrevented, true, String(tap));
    assert.ok(box(w), String(tap));
  }
});

test('the armoury link survives Torn redrawing the row, and goes back to your items when the setting or the key goes', () => {
  const w = page({ sidebar: 'Fly-out, desktop', store: { ...warStore(NOW - 3600), [WAR_TAP_STORE]: 'armoury' } }).run();
  assert.equal(w.link().getAttribute('href'), ARMOURY);
  const old = w.row();
  const fresh = w.document.createElement('ul');
  fresh.className = old.className;
  fresh.innerHTML = TORN_ICONS;
  old.replaceWith(fresh);
  w.check();
  assert.equal(w.icon().parentNode, fresh);
  assert.equal(w.link().getAttribute('href'), ARMOURY, 'after the redraw');
  w.store[WAR_TAP_STORE] = 'ask';
  w.check();
  assert.equal(w.link().getAttribute('href'), ITEMS, 'the setting changed');
  w.store[WAR_TAP_STORE] = 'armoury';
  w.check();
  assert.equal(w.link().getAttribute('href'), ARMOURY);
  delete w.store[KEY_STORE];
  w.check();
  assert.equal(w.link().getAttribute('href'), ITEMS, 'the key went');
});
```

- [ ] **Step 2: Run the tests, and watch them fail.** Run `T`.

Expected: `# tests 90 # pass 82 # fail 8`.
- The three changed tests fail on the 1.0.2 code, and so do five of the new ones. 1.0.2 has no "Ranked war on" line, no box during the war, and never points the link at the armoury.
- "a war with an end time is over, even when that time is still to come" passes already: it pins what 1.0.2 does.

- [ ] **Step 3: Write the code.** In `server/public/scripts/torn-xanax-reminder.user.js`:

Replace

```js
  // The war window: the 24 hours before the start.
  const WINDOW_S = 24 * 60 * 60;
```

with

```js
  // The war period starts this long before the war does, and lasts until Torn gives the war
  // an end time.
  const WINDOW_S = 24 * 60 * 60;
  // What a tap does in the war period, from the settings box: 'ask' opens the box with
  // Armoury and Items, 'armoury' and 'items' go straight there. Anything else reads as 'ask'.
  const WAR_TAP_STORE = 'tm-xanax-reminder-war-tap';
  const WAR_TAPS = ['ask', 'armoury', 'items'];
  // The end of the war line in the icon's label, for each setting.
  const TAP_WORDS = {
    ask: 'tap to pick the armoury or your items',
    armoury: 'tap to open the armoury',
    items: 'tap to open your items',
  };
```

Replace the whole `warSecondsLeft` function, from its comment `// Seconds until the war starts` to its closing `}`, with:

```js
  // What a tap does in the war period, as the settings box saved it.
  function warTap() {
    const saved = gmGet(WAR_TAP_STORE);
    return WAR_TAPS.indexOf(saved) >= 0 ? saved : 'ask';
  }

  // The war period: { left } in the 24 hours before the start (seconds to go), { on: true }
  // from the start until Torn gives the war an end time, or null outside it. Any end time
  // means the war is over. Needs a key: without one, the tap always opens your items.
  function warPhase(nowMs) {
    if (!apiKey()) return null;
    const war = readWar();
    const nowS = nowMs / 1000;
    if (!(war.start > 0) || war.end > 0 || nowS < war.start - WINDOW_S) return null;
    return nowS < war.start ? { left: war.start - nowS } : { on: true };
  }

  // The war period in words: "War starts in 5h 12m", or "Ranked war on".
  function phaseText(phase) {
    return phase.on ? 'Ranked war on' : 'War starts in ' + untilText(phase.left);
  }

  // Where the icon's link points: the armoury in the war period when that is the setting, your
  // items otherwise. Each check sets it, so it follows the war, the setting and the key.
  function linkTarget(nowMs) {
    return warPhase(nowMs) && warTap() === 'armoury' ? ARMOURY_URL : ITEMS_URL;
  }
```

In `labelLines`, replace

```js
    const left = warSecondsLeft(nowMs);
    if (left) lines.push('War starts in ' + untilText(left) + ': tap to pick the armoury or your items');
```

with

```js
    const phase = warPhase(nowMs);
    if (phase) lines.push(phaseText(phase) + ': ' + TAP_WORDS[warTap()]);
```

In `onTap`, replace everything from its comment `// The icon's link opens your items.` through `openChoice(left);` with:

```js
  // The icon's link opens your items, or the armoury in the war period when that is the
  // setting. With "ask each time", a tap in the war period opens the box instead, and a second
  // tap closes it. The script never clicks anything itself.
  function onTap(e) {
    if (longPressed) {
      longPressed = false;
      e.preventDefault();
      return;
    }
    if (choice) {
      e.preventDefault();
      closeChoice();
      return;
    }
    const phase = warPhase(Date.now());
    if (!phase || warTap() !== 'ask') return;
    e.preventDefault();
    openChoice(phase);
```

Replace `openChoice`'s comment and first line,

```js
  // A box under the icon: when the war starts, and two plain links, Armoury and Items.
  function openChoice(left) {
```

with

```js
  // A box under the icon: the war's time, or that it is on, and two plain links, Armoury and
  // Items.
  function openChoice(phase) {
```

and in it replace `title.textContent = 'War starts in ' + untilText(left);` with `title.textContent = phaseText(phase);`.

Replace `syncChoice` and its comment with:

```js
  // Each check: the box closes when the war period ends or the setting stops being "ask each
  // time", and its first line stays current.
  function syncChoice(nowMs) {
    if (!choice) return;
    const phase = warPhase(nowMs);
    if (!phase || warTap() !== 'ask') closeChoice();
    else choice.firstChild.textContent = phaseText(phase);
  }
```

In `check()`, replace `      maybeAsk(nowMs);` with:

```js
      maybeAsk(nowMs);
      const href = linkTarget(nowMs);
      if (icon.firstChild.getAttribute('href') !== href) icon.firstChild.setAttribute('href', href);
```

- [ ] **Step 4: Run the tests, and watch them pass.** Run `T`, then `C`.

Expected: `# tests 90 # pass 90 # fail 0`, then `ascii-ok`.

- [ ] **Step 5: Commit** in the worktree:

```bash
WT=/opt/warboard/.superpowers/sdd/2026-10-24-torn-xanax-reminder-1.0.3/wt; cd "$WT" && git commit -q -m "torn-xanax-reminder: the war counts until Torn ends it, and a setting picks the tap during it" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- server/public/scripts/torn-xanax-reminder.user.js server/torn-xanax-reminder.test.mjs && git log --format='%h %s' -1
```

---

### Task 2: The settings box

**Files:** `server/public/scripts/torn-xanax-reminder.user.js`, `server/torn-xanax-reminder.test.mjs`.

**Interfaces:**
- Consumes (Task 1): `warTap()`, `WAR_TAPS`, `WAR_TAP_STORE`, and `check()`, which sets the icon's link. From 1.0.2: `readWar()`, `writeWar()`, `parseWar()`, `maybeAsk(nowMs)`, `apiKey()`, `gmGet()`, `gmSet()`, `untilText()`, `HAS_PDA_KEY`, `KEY_STORE`.
- Produces:
  - DOM: `SETTINGS_ID = 'tm-xanax-reminder-settings'`; the list `#tm-xanax-reminder-settings-war`, the field `#tm-xanax-reminder-settings-key`; buttons `x`, `Clear key`, `Cancel`, `Save`.
  - Functions: `openSettings()`, `closeSettings()`, `saveChecked(name, value) -> boolean`, `setKey(value) -> boolean`, `keyStatus(nowMs) -> string`, `warWords(war, nowMs) -> string`, `agoText(ms) -> string`.
  - The war record gains `okAt`, when Torn last answered, in ms.
  - The menu entry `Xanax Reminder: Settings`.

- [ ] **Step 1: Write the failing tests.** In `server/torn-xanax-reminder.test.mjs`, in this order:

**(a)** Replace

```js
const KEYBOX = 'tm-xanax-reminder-key';
// The script's one menu entry. It names the script, because a host's menu may list every
// script's entries together, as the warboard app's does.
const MENU = 'Xanax Reminder: Set API key';
```

with

```js
const SETTINGS = 'tm-xanax-reminder-settings';
// The script's one menu entry. It names the script, because a host's menu may list every
// script's entries together, as the warboard app's does.
const MENU = 'Xanax Reminder: Settings';
```

and replace

```js
const keyBox = (w) => w.document.getElementById(KEYBOX);
const keyButtons = (w) => [...keyBox(w).querySelectorAll('button')];
```

with

```js
const settings = (w) => w.document.getElementById(SETTINGS);
// The settings box's key field; a tap on one of its buttons, found by its words; and a pick
// from its war list, as a tap on the list makes it. Only the picked option is set: setting one
// takes the mark off the others, as in a browser.
const keyField = (w) => settings(w).querySelector('input');
const press = (w, words) => fire(w, [...settings(w).querySelectorAll('button')].find((b) => b.textContent === words), 'click');
const pick = (w, value) => { settings(w).querySelector('option[value="' + value + '"]').selected = true; };
```

**(b)** Replace seven tests, found by their 1.0.2 titles.

Replace "the key box: a plain text field that starts empty, with Save, Clear and Cancel" with:

```js
test('the settings box: a war list, a plain text key field that starts empty, and x, Clear key, Cancel and Save', () => {
  const w = page({ store: { [KEY_STORE]: KEY } }).run();
  w.menu[MENU]();
  w.menu[MENU]();
  assert.equal(w.document.querySelectorAll('#' + SETTINGS).length, 1, 'never two');
  assert.equal(settings(w).querySelector('b').textContent, 'Xanax Reminder Settings');
  assert.deepEqual([...settings(w).querySelectorAll('label')].map((l) => [l.textContent, l.getAttribute('for')]),
    [['During a ranked war:', SETTINGS + '-war'], ['API key:', SETTINGS + '-key']]);
  assert.equal(settings(w).querySelector('select').id, SETTINGS + '-war');
  const field = keyField(w);
  assert.equal(field.id, SETTINGS + '-key');
  assert.equal(field.getAttribute('type'), 'text', 'a password field sets off password managers');
  assert.equal(field.value || '', '', 'the saved key is never shown');
  assert.ok(!settings(w).textContent.includes(KEY));
  assert.match(settings(w).textContent, /A Public-level key is enough\. A key is saved\./);
  assert.deepEqual([...settings(w).querySelectorAll('button')].map((b) => b.textContent), ['x', 'Clear key', 'Cancel', 'Save']);
  const src = readFileSync(SRC, 'utf8');
  assert.doesNotMatch(src, /type\s*=\s*['"]?password/i);
  assert.doesNotMatch(src, /\.focus\(/, 'nothing is focused, so a phone keeps its keyboard down');
});
```

Replace "the menu opens a styled key box even while the cooldown runs" with:

```js
test('the menu opens a styled settings box even while the cooldown runs, with 16px controls so an iPhone doesn\'t zoom', () => {
  const w = page({ icons: { drug_cooldown: drug(NOW + 3600) } }).run();
  w.menu[MENU]();
  assert.ok(settings(w));
  const css = w.document.getElementById(STYLES).textContent;
  assert.match(css, /#tm-xanax-reminder-settings \{ position: fixed;/);
  assert.match(declarations(css, '#tm-xanax-reminder-settings select, #tm-xanax-reminder-settings input').font, /^16px /);
  assert.match(settings(w).textContent, /No key saved\./);
});
```

Replace "Save keeps the key, forgets the old answer and asks Torn at once" with:

```js
test('Save keeps the key, forgets the old answer, asks Torn at once and says so', () => {
  const w = page({ store: { [WAR_STORE]: JSON.stringify({ at: NOW * 1000, start: START, end: 0, error: 'Incorrect key' }) } }).run();
  w.menu[MENU]();
  keyField(w).value = '  ' + KEY + ' ';
  press(w, 'Save');
  assert.equal(w.store[KEY_STORE], KEY, 'saved, trimmed');
  assert.equal(w.calls.length, 1, 'asked straight away');
  assert.equal(w.label(), LABEL, 'the old answer and its error are gone');
  const text = settings(w).textContent;
  assert.match(text, /Saved\./);
  assert.match(text, /A key is saved\. Not checked yet\./);
  assert.equal(keyField(w).value, '', 'the field empties');
  press(w, 'Save');
  assert.equal(w.calls.length, 1, 'so a second Save asks nothing more');
  w.advance(1000);
  assert.equal(settings(w), null, 'the box closes a second later');
});
```

Replace "Save with an empty field keeps the saved key and its answer" with:

```js
test('Save with an empty field keeps the saved key and its answer', () => {
  const w = page({ store: warStore() }).run();
  const war = w.store[WAR_STORE];
  w.menu[MENU]();
  press(w, 'Save');
  assert.match(settings(w).textContent, /Saved\./);
  assert.equal(w.store[KEY_STORE], KEY);
  assert.equal(w.store[WAR_STORE], war);
  assert.equal(w.calls.length, 0, 'nothing to ask');
  w.advance(1000);
  assert.equal(settings(w), null, 'the box closes a second later');
});
```

Replace "Enter in the field saves too" with:

```js
test('Enter in the key field saves too', () => {
  const w = page().run();
  w.menu[MENU]();
  keyField(w).value = KEY;
  fire(w, keyField(w), 'keydown', { key: 'Enter' });
  assert.equal(w.store[KEY_STORE], KEY);
  assert.match(settings(w).textContent, /Saved\./);
  w.advance(1000);
  assert.equal(settings(w), null);
});
```

Replace "Clear forgets the key and the war time" with:

```js
test('Clear key forgets the key and the war time, says so and closes a second later', () => {
  const w = page({ store: warStore() }).run();
  w.menu[MENU]();
  press(w, 'Clear key');
  assert.equal(w.store[KEY_STORE], '');
  assert.equal(JSON.parse(w.store[WAR_STORE]).start, 0);
  assert.match(settings(w).textContent, /Key cleared\./);
  assert.match(settings(w).textContent, /No key saved\./);
  w.advance(1000);
  assert.equal(settings(w), null);
  w.check();
  assert.equal(w.calls.length, 0, 'no key, no call');
  assert.equal(fire(w, w.link(), 'click').defaultPrevented, false, 'the tap opens your items');
});
```

Replace "Cancel, Escape and a tap on the dark area change nothing; a tap inside the box keeps it" with:

```js
test('Cancel, the x, Escape and a tap on the dark area change nothing; a tap inside the box keeps it', () => {
  const w = page({ store: { [KEY_STORE]: KEY } }).run();
  const ways = [
    () => press(w, 'Cancel'),
    () => press(w, 'x'),
    () => escape(w),
    () => fire(w, settings(w), 'click'),
  ];
  for (const close of ways) {
    w.menu[MENU]();
    pick(w, 'armoury');
    keyField(w).value = 'SOMETHINGELSE123';
    fire(w, settings(w).querySelector('p'), 'click');
    assert.ok(settings(w), 'a tap inside keeps it');
    close();
    assert.equal(settings(w), null);
    assert.equal(w.store[KEY_STORE], KEY);
    assert.equal(w.store[WAR_TAP_STORE], undefined, 'the war choice too');
  }
});
```

**(c)** After that last test, add:

```js
test('the war list shows the saved choice (ask each time when none is saved), and Save keeps a new one and closes the box a second later', () => {
  const fresh = page({ store: warStore() }).run();
  fresh.menu[MENU]();
  assert.equal(settings(fresh).querySelector('select').value, 'ask', 'nothing saved yet: ask each time');
  const w = page({ store: { ...warStore(), [WAR_TAP_STORE]: 'items' } }).run();
  w.menu[MENU]();
  const list = settings(w).querySelector('select');
  assert.deepEqual([...list.querySelectorAll('option')].map((o) => [o.getAttribute('value'), o.textContent]),
    [['ask', 'Ask each time'], ['armoury', 'Faction Armoury (Drugs)'], ['items', 'Your Items (Drugs)']]);
  assert.equal(list.value, 'items', 'the saved choice');
  pick(w, 'armoury');
  press(w, 'Save');
  assert.equal(w.store[WAR_TAP_STORE], 'armoury');
  assert.equal(w.store[KEY_STORE], KEY, 'an empty key field keeps the saved key');
  assert.match(settings(w).textContent, /Saved\./);
  w.advance(999);
  assert.ok(settings(w), 'still open just under a second on');
  w.advance(1);
  assert.equal(settings(w), null, 'closed a second after');
});

test('after Save, the icon\'s link and label follow the new choice at once', () => {
  const w = page({ store: warStore() }).run();
  assert.equal(w.label(), LABEL + '. ' + WAR_LINE);
  w.menu[MENU]();
  pick(w, 'armoury');
  press(w, 'Save');
  assert.equal(w.link().getAttribute('href'), ARMOURY, 'without waiting for the next check');
  assert.equal(w.label(), LABEL + '. War starts in 5h 12m: tap to open the armoury');
});

test('a key saved while the cooldown runs is asked about at once, and the box then says what Torn found', async () => {
  const w = page({ icons: { drug_cooldown: drug(NOW + 3600) } }).run();
  assert.equal(w.icon(), null, 'the cooldown runs: no icon');
  w.menu[MENU]();
  keyField(w).value = KEY;
  press(w, 'Save');
  assert.equal(w.calls.length, 1, 'asked at once');
  assert.equal(w.calls[0].url, URL);
  assert.match(settings(w).textContent, /A key is saved\. Not checked yet\./);
  answer(w.calls[0], wars(ranked(NOW - 3600)));
  await settle();
  w.advance(1000);
  assert.equal(settings(w), null);
  w.menu[MENU]();
  assert.match(settings(w).textContent, /A key is saved\. Checked just now: ranked war on\./);
  w.check();
  assert.equal(w.calls.length, 1, 'and no second call while the cooldown runs');
});

test('the box says what Torn\'s last answer means now', async () => {
  const cases = [
    [wars(ranked(START)), 'war starts in 5h 12m'],
    [wars(ranked(NOW - 3600)), 'ranked war on'],
    [wars(ranked(NOW - 7200, NOW - 60)), 'the ranked war is over'],
    [wars(null), 'no ranked war set'],
  ];
  for (const [reply, words] of cases) {
    const w = page({ store: { [KEY_STORE]: KEY } }).run();
    answer(w.calls[0], reply);
    await settle();
    w.menu[MENU]();
    assert.match(settings(w).textContent, new RegExp('A key is saved\\. Checked just now: ' + words + '\\.'), words);
  }
});

test('the box says how long ago Torn answered, and keeps saying it when a later check fails', async () => {
  const w = page({ store: { [KEY_STORE]: KEY } }).run();
  answer(w.calls[0], wars(ranked(NOW - 3600)));
  await settle();
  w.clock.ms += (3 * 3600 + 5 * 60) * 1000;
  w.menu[MENU]();
  assert.match(settings(w).textContent, /A key is saved\. Checked 3h 5m ago: ranked war on\./);
  w.check();
  noAnswer(w.calls[1]);
  await settle();
  w.menu[MENU]();
  assert.match(settings(w).textContent,
    /A key is saved\. Couldn't check the war time: no answer from Torn\. Torn last answered 3h 5m ago: ranked war on\./);
});

test('an answer kept without its time, as an older version saved it, reads as checked earlier', () => {
  const w = page({ store: warStore(NOW - 3600) }).run();
  w.menu[MENU]();
  assert.match(settings(w).textContent, /A key is saved\. Checked earlier: ranked war on\./);
});

test('a save that storage refuses, drops, or keeps only in part says so, stays open and keeps the saved key', () => {
  // GM storage that won't keep some names: it throws, or drops the write without a word.
  const refusing = (names, how) => new Proxy(warStore(), {
    set(target, k, v) {
      if (!names.includes(k)) target[k] = v;
      else if (how === 'throws') throw new Error('QuotaExceededError');
      return true;
    },
  });
  for (const [why, store] of [
    ['refused', refusing([WAR_TAP_STORE, KEY_STORE], 'throws')],
    ['dropped', refusing([WAR_TAP_STORE, KEY_STORE], 'drops')],
    ['the choice kept but not the key', refusing([KEY_STORE], 'drops')],
  ]) {
    const w = page({ store }).run();
    const war = w.store[WAR_STORE];
    w.menu[MENU]();
    pick(w, 'armoury');
    keyField(w).value = 'NEWKEY1234567890';
    press(w, 'Save');
    assert.match(settings(w).textContent, /Couldn't save, try again\./, why);
    press(w, 'Clear key');
    assert.match(settings(w).textContent, /Couldn't save, try again\./, why + ': Clear key');
    w.advance(5000);
    assert.ok(settings(w), why + ': the box stays open');
    assert.equal(w.store[KEY_STORE], KEY, why + ': the saved key is kept');
    assert.equal(w.store[WAR_STORE], war, why + ': and so is its answer');
    assert.equal(w.calls.length, 0, why + ': and Torn is not asked');
  }
});

test('a box opened again just after Save stays open', () => {
  const w = page({ store: warStore() }).run();
  w.menu[MENU]();
  press(w, 'Save');
  press(w, 'Cancel');
  assert.equal(settings(w), null);
  w.menu[MENU]();
  w.advance(2000);
  assert.ok(settings(w), 'the first box\'s timer went with it');
});

test('with no key, the box says the war choice needs one', () => {
  const w = page().run();
  w.menu[MENU]();
  assert.match(settings(w).textContent, /No key saved\. The war choice needs one: until then, a tap always opens your items\./);
});
```

**(d)** Rename what is left, then check that nothing of the key box remains:

```bash
WT=/opt/warboard/.superpowers/sdd/2026-10-24-torn-xanax-reminder-1.0.3/wt; F="$WT/server/torn-xanax-reminder.test.mjs"; sed -i "s/fire(w, keyButtons(w)\[0\], 'click')/press(w, 'Save')/g; s/keyBox(w)/settings(w)/g; s/key box/settings box/g" "$F" && grep -c "keyBox\|keyButtons\|KEYBOX\|key box" "$F"
```

Expected: `0`.

- [ ] **Step 2: Run the tests, and watch them fail.** Run `T`.

Expected: `# tests 99 # pass 73 # fail 26`. The Task 1 code still registers "Xanax Reminder: Set API key" and opens `#tm-xanax-reminder-key`, so these fail:
- the 21 tests that open the box from the menu;
- the menu-name test;
- the four tests that open it with a long press and look for it: "a long press opens the settings box...", "a short press is a tap...", "a long press with the mouse..." and "a host with no menu...".

"after a long press, the next tap is a tap again" and "the phone's own long-press menu is held back on the icon" never look for the box, so they pass.

- [ ] **Step 3: Write the code.** In `server/public/scripts/torn-xanax-reminder.user.js`:

Replace `  const KEYBOX_ID = 'tm-xanax-reminder-key';` with `  const SETTINGS_ID = 'tm-xanax-reminder-settings';`.

After `  const CALL_EVERY_MS = 30 * 60 * 1000;` add:

```js
  // After a save, the settings box says so for this long, then closes.
  const SAVED_MS = 1000;
```

After the `gmSet` function, add:

```js
  // True when storage kept the value: saved, then read back the same. Some hosts drop a write
  // without throwing.
  function saveChecked(name, value) {
    return gmSet(name, value) && gmGet(name) === value;
  }
```

Replace the three-line comment above `readWar` with:

```js
  // What Torn last said about your faction's ranked war, shared by every tab: at = when a tab
  // last asked (ms), okAt = when Torn last answered (ms, 0 for not yet), start and end = the
  // war's times (Unix seconds, 0 for none), error = why the last ask failed ('' if it didn't).
```

In `parseWar`, after `      at: Number(v.at) || 0,` add `      okAt: Number(v.okAt) || 0,`.

In `maybeAsk`:
- Replace the comment's last sentence, `Only called while the icon shows.`, with `Called by each check while the icon shows, and when a key is saved.`
- In the success handler, after `      now.error = '';`, add `      now.okAt = Date.now();`.

Replace `untilText` and its comment with:

```js
  // "5h 12m", or "45m" under an hour.
  function hmText(mins) {
    const h = Math.floor(mins / 60);
    return h > 0 ? h + 'h ' + (mins % 60) + 'm' : mins + 'm';
  }

  // Time to go. Minutes round up, so it never says 0m.
  function untilText(seconds) {
    return hmText(Math.max(1, Math.ceil(seconds / 60)));
  }

  // Time since: "just now" under a minute, then "12m ago" (minutes round down).
  function agoText(ms) {
    const mins = Math.floor(ms / 60000);
    return mins < 1 ? 'just now' : hmText(mins) + ' ago';
  }
```

Replace everything from the line `  // ===== THE KEY BOX =====` up to, not including, the line `  // ===== STYLES =====` with:

```js
  // ===== THE SETTINGS BOX =====

  // The timer that closes the settings box a second after a save.
  let savedTimer = null;

  // Opens from the menu ("Xanax Reminder: Settings") or a long press on the icon, over
  // everything else, laid out like the Blood Bag Reminder's settings: what a tap does during a
  // ranked war, and the API key. The key field is a plain text field (a password field sets off
  // password managers) that starts empty: the saved key is never shown. Nothing is focused, so
  // a phone doesn't raise its keyboard over the box.
  function openSettings() {
    closeSettings();
    closeChoice();
    hideTip();
    ensureStyles();
    const overlay = make('div');
    overlay.id = SETTINGS_ID;
    const panel = make('div', '', 'tm-xanax-panel');
    const head = make('div', '', 'tm-xanax-head');
    head.appendChild(make('b', 'Xanax Reminder Settings'));
    head.appendChild(button('x', closeSettings));
    // The war list, showing the saved choice.
    const list = make('select');
    list.id = SETTINGS_ID + '-war';
    const current = warTap();
    [['ask', 'Ask each time'], ['armoury', 'Faction Armoury (Drugs)'], ['items', 'Your Items (Drugs)']].forEach((pair) => {
      const option = make('option', pair[1]);
      option.value = pair[0];
      if (pair[0] === current) option.selected = true;
      list.appendChild(option);
    });
    const input = make('input');
    input.id = SETTINGS_ID + '-key';
    input.type = 'text';
    input.placeholder = 'Your API key';
    input.setAttribute('autocomplete', 'off');
    input.setAttribute('autocapitalize', 'off');
    input.setAttribute('spellcheck', 'false');
    const status = make('p');
    const showStatus = () => {
      status.textContent = 'A Public-level key is enough. ' + keyStatus(Date.now());
    };
    showStatus();
    const message = make('p', '', 'tm-xanax-message');
    // After Save or Clear key. When storage kept it, the icon follows at once, the field
    // empties (so a second Save asks Torn nothing more), and the box says so and closes a
    // second later. When it didn't, the box says so and stays open.
    const finish = (ok, words) => {
      message.textContent = ok ? words : 'Couldn\'t save, try again.';
      message.classList.toggle('tm-xanax-bad', !ok);
      if (!ok) return;
      input.value = '';
      showStatus();
      check();
      clearTimeout(savedTimer);
      savedTimer = setTimeout(closeSettings, SAVED_MS);
    };
    // Save keeps the war choice, and the key when one is typed: an empty field keeps the saved
    // key, and only Clear key removes it.
    const save = () => {
      const picked = WAR_TAPS.indexOf(list.value) >= 0 ? list.value : 'ask';
      const key = String(input.value || '').trim();
      finish(saveChecked(WAR_TAP_STORE, picked) && (!key || setKey(key)), 'Saved.');
    };
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') save();
    });
    const buttons = make('div', '', 'tm-xanax-buttons');
    buttons.appendChild(button('Clear key', () => finish(setKey(''), 'Key cleared.'), 'tm-xanax-clear'));
    buttons.appendChild(button('Cancel', closeSettings));
    buttons.appendChild(button('Save', save, 'tm-xanax-save'));
    const body = make('div', '', 'tm-xanax-body');
    [
      label('During a ranked war:', list), list,
      make('p', 'What a tap on the icon does from 24 hours before your faction\'s ranked war until it ends. '
        + 'The rest of the time, a tap opens your items. A long press on the icon opens these settings.'),
      label('API key:', input), input, status, message, buttons,
    ].forEach((el) => body.appendChild(el));
    panel.appendChild(head);
    panel.appendChild(body);
    overlay.appendChild(panel);
    // A tap on the dark area around the box is Cancel.
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeSettings();
    });
    document.body.appendChild(overlay);
  }

  // The line under the key field: whether a key is saved, or PDA's is in use, never the key
  // itself; then what Torn last said and how long ago, or why the last check failed. On a phone
  // the tooltip never opens, so this is where a bad key, or an answer gone stale, shows.
  function keyStatus(nowMs) {
    const saved = gmGet(KEY_STORE);
    let text = 'No key saved. The war choice needs one: until then, a tap always opens your items.';
    if (typeof saved === 'string' && saved.trim()) text = 'A key is saved.';
    else if (HAS_PDA_KEY) text = 'Using the key Torn PDA gives the script.';
    if (!apiKey()) return text;
    const war = readWar();
    // Only Torn's answer sets a war start, so a record with one but no answer time (saved before
    // the script kept that time) did have an answer: "earlier".
    const answered = war.okAt > 0 || war.start > 0;
    const when = war.okAt > 0 ? agoText(nowMs - war.okAt) : 'earlier';
    const last = answered ? when + ': ' + warWords(war, nowMs) + '.' : '';
    if (war.error) return text + ' Couldn\'t check the war time: ' + war.error + '.' + (last ? ' Torn last answered ' + last : '');
    return text + (last ? ' Checked ' + last : ' Not checked yet.');
  }

  // What Torn's last answer means now, in words for the settings box.
  function warWords(war, nowMs) {
    if (!(war.start > 0)) return 'no ranked war set';
    if (war.end > 0) return 'the ranked war is over';
    const nowS = nowMs / 1000;
    return nowS < war.start ? 'war starts in ' + untilText(war.start - nowS) : 'ranked war on';
  }

  // Saves the key ('' for none), and says whether storage kept it. A new key, or none, forgets
  // what Torn said with the old one and asks Torn at once, even while the cooldown runs, so the
  // settings box can say whether the key works.
  function setKey(value) {
    if (!saveChecked(KEY_STORE, String(value || '').trim())) return false;
    writeWar({ at: 0, okAt: 0, start: 0, end: 0, error: '' });
    askedAt = null;
    maybeAsk(Date.now());
    return true;
  }

  // An element with its text and class; either may be left out.
  function make(tag, text, className) {
    const el = document.createElement(tag);
    if (text) el.textContent = text;
    if (className) el.className = className;
    return el;
  }

  // A label for one of the box's controls.
  function label(text, control) {
    const el = make('label', text);
    el.setAttribute('for', control.id);
    return el;
  }

  function button(words, onClick, className) {
    const b = make('button', words, className);
    b.type = 'button';
    b.addEventListener('click', onClick);
    return b;
  }

  function closeSettings() {
    clearTimeout(savedTimer);
    savedTimer = null;
    const box = document.getElementById(SETTINGS_ID);
    if (box) box.remove();
  }

```

Then update the three places that still call the key box:
- In `startPress`, replace `      openKeyBox();` with `      openSettings();`.
- In `onKeyDown`, replace `    closeKeyBox();` with `    closeSettings();`.
- In the menu registration, replace `'Xanax Reminder: Set API key', openKeyBox` with `'Xanax Reminder: Settings', openSettings`.

In `BOX_CSS`, replace the six `'#' + KEYBOX_ID + ...` rules, and the `// 16px, or an iPhone zooms in when the field is tapped.` comment between them, with:

```js
    '#' + SETTINGS_ID + ' { position: fixed; top: 0; right: 0; bottom: 0; left: 0; z-index: 100000; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,.8); }',
    '#' + SETTINGS_ID + ' .tm-xanax-panel { box-sizing: border-box; width: 450px; max-width: 90%; max-height: 90%; overflow-y: auto; border-radius: 10px; background: #2e2e2e; color: #ccc; box-shadow: 0 4px 20px rgba(0,0,0,.5); font: 400 14px/18px Arial, sans-serif; text-align: left; }',
    '#' + SETTINGS_ID + ' .tm-xanax-head { display: flex; align-items: center; justify-content: space-between; padding: 15px 20px; border-radius: 10px 10px 0 0; background: linear-gradient(to bottom, #1a1a1a, #2a2a2a); }',
    '#' + SETTINGS_ID + ' .tm-xanax-head b { color: #fff; font-size: 18px; }',
    '#' + SETTINGS_ID + ' .tm-xanax-head button { width: 30px; height: 30px; padding: 0; border: none; background: none; color: #aaa; font: 24px Arial, sans-serif; cursor: pointer; }',
    '#' + SETTINGS_ID + ' .tm-xanax-body { padding: 20px; }',
    '#' + SETTINGS_ID + ' label { display: block; margin-bottom: 5px; color: #aaa; }',
    // 16px, or an iPhone zooms in when the list or the field is tapped.
    '#' + SETTINGS_ID + ' select, #' + SETTINGS_ID + ' input { box-sizing: border-box; width: 100%; padding: 10px; border: 1px solid #444; border-radius: 5px; background: #1a1a1a; color: #fff; font: 16px Arial, sans-serif; }',
    '#' + SETTINGS_ID + ' input { font-family: monospace; }',
    '#' + SETTINGS_ID + ' p { margin: 5px 0 20px; color: #888; font-size: 12px; line-height: 16px; }',
    '#' + SETTINGS_ID + ' p.tm-xanax-message { margin: 0 0 10px; color: #a3c248; font-size: 14px; }',
    '#' + SETTINGS_ID + ' p.tm-xanax-bad { color: #e8735a; }',
    '#' + SETTINGS_ID + ' .tm-xanax-buttons { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 10px; }',
    '#' + SETTINGS_ID + ' .tm-xanax-buttons button { padding: 10px 20px; border: none; border-radius: 5px; background: linear-gradient(to bottom, #555, #777); color: #fff; font: 14px Arial, sans-serif; cursor: pointer; }',
    '#' + SETTINGS_ID + ' .tm-xanax-buttons .tm-xanax-clear { margin-right: auto; padding: 10px 12px; background: none; color: #aaa; }',
    '#' + SETTINGS_ID + ' .tm-xanax-buttons .tm-xanax-save { background: linear-gradient(to bottom, #799427, #a3c248); }',
```

Last, rename the key box in the comments that are left, and check that nothing of it remains:

```bash
WT=/opt/warboard/.superpowers/sdd/2026-10-24-torn-xanax-reminder-1.0.3/wt; F="$WT/server/public/scripts/torn-xanax-reminder.user.js"; sed -i 's/the key box/the settings box/g' "$F" && grep -n -i "key box\|keybox\|saveKey" "$F"; grep -c "###PDA-APIKEY###" "$F"
```

Expected: no line from the first grep, then `1`.

- [ ] **Step 4: Run the tests, and watch them pass.** Run `T`, then `C`.

Expected: `# tests 99 # pass 99 # fail 0`, then `ascii-ok`.

- [ ] **Step 5: Commit** in the worktree:

```bash
WT=/opt/warboard/.superpowers/sdd/2026-10-24-torn-xanax-reminder-1.0.3/wt; cd "$WT" && git commit -q -m "torn-xanax-reminder: a settings box like the Blood Bag's, for the war tap and the key, that says when it saved" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- server/public/scripts/torn-xanax-reminder.user.js server/torn-xanax-reminder.test.mjs && git log --format='%h %s' -1
```

---

### Task 3: Version 1.0.3, and the spec

**Files:** `server/public/scripts/torn-xanax-reminder.user.js`, `server/public/scripts/torn-xanax-reminder.meta.js`, `server/torn-xanax-reminder.test.mjs`, `docs/superpowers/specs/2026-10-22-torn-xanax-reminder-design.md`.

**Interfaces:** none new. The header test reads `// @version`, `const VERSION` and the CHANGELOG, and the console test reads the start line.

- [ ] **Step 1: Write the failing tests.** In the header test, replace

```js
  assert.deepEqual(tag('version'), ['1.0.2']);
```

with `  assert.deepEqual(tag('version'), ['1.0.3']);`, and replace

```js
  assert.match(src, /const VERSION = '1\.0\.2';/, 'the in-file version matches @version');
  assert.match(src, /^\/\/ v1\.0\.2  - A bigger pill/m, 'the changelog has the 1.0.2 entry');
```

with

```js
  assert.match(src, /const VERSION = '1\.0\.3';/, 'the in-file version matches @version');
  assert.match(src, /^\/\/ v1\.0\.3  - A settings box/m, 'the changelog has the 1.0.3 entry');
  assert.match(src, /^\/\/ v1\.0\.2  - A bigger pill/m, 'the changelog keeps the 1.0.2 entry');
```

In the console-line test, replace `'[Torn Xanax Reminder 1.0.2] running'` with `'[Torn Xanax Reminder 1.0.3] running'`.

- [ ] **Step 2: Run the tests, and watch them fail.** Run `T`.

Expected: `# tests 99 # pass 97 # fail 2` (the header test and the console-line test).

- [ ] **Step 3: Bump the version.** In the script, replace `// @version      1.0.2` with `// @version      1.0.3`, and replace the `// @description` line with:

```js
// @description  A Xanax icon in Torn's row of status icons as soon as your drug cooldown is over: a tap opens your items, and during your faction's ranked war (with a Public API key) the armoury, your items or a choice of both, as set in its settings box.
```

Above the line `// v1.0.2  - A bigger pill: ...` add:

```js
// v1.0.3  - A settings box like the Blood Bag Reminder's (long press the icon, or "Xanax
//           Reminder: Settings" in the menu): choose what a tap does during a ranked war
//           (ask each time, the faction armoury, or your items) and enter the API key.
//           Save now says whether it saved, and the box says what Torn last answered.
//           The war counts until Torn gives it an end time, not just until it starts, so
//           the choice works during the war itself.
```

Replace `  const VERSION = '1.0.2';` with `  const VERSION = '1.0.3';`. Then regenerate the meta file from the header:

```bash
WT=/opt/warboard/.superpowers/sdd/2026-10-24-torn-xanax-reminder-1.0.3/wt; cd "$WT/server/public/scripts" && sed -n '1,/^\/\/ ==\/UserScript==$/p' torn-xanax-reminder.user.js > torn-xanax-reminder.meta.js && grep -E "@version|@description" torn-xanax-reminder.meta.js
```

- [ ] **Step 4: Run the tests, and watch them pass.** Run `T`, then `C`.

Expected: `# tests 99 # pass 99 # fail 0`, then `ascii-ok`.

- [ ] **Step 5: Amend the spec.** Make these replacements in `docs/superpowers/specs/2026-10-22-torn-xanax-reminder-design.md`. Each old text appears exactly once.

1. After the **Status** line's last sentence, `(see Q6, Q7).`, add: ` Amended on 2026-10-24 (EDT) for 1.0.3, a settings box and a tap setting for the war: the owner asked "or create a settings box like bloodbags that gives us an option if inwant to go to fac armourybdueing war", then approved the design with "yes go with your recommendations" (see Q9).`
2. In the **Script** line, `version 1.0.2` becomes `version 1.0.3`.
3. In the Q6, Q7 row, `There is no settings menu for where it goes.` becomes `Until 1.0.3 there was no setting for where it goes; since then this choice is the "Ask each time" setting, the default (Q9).`
4. In the Q8 row, `You enter it once, and PDA fills it in by itself.` becomes `You enter it once, in the settings box, and PDA fills it in by itself.`
5. Add a row after Q8:

```
| Q9 | 1.0.3 adds a settings box, laid out like the Blood Bag Reminder's (a long press on the icon, or "Xanax Reminder: Settings" in the menu), with the API key and a list, "During a ranked war": **Ask each time** (the Armoury/Items box, the default), **Faction Armoury (Drugs)** or **Your Items (Drugs)**. The war counts from 24 hours before its start until Torn gives it an end time; while it is on, the box's title says "Ranked war on". Outside a war a tap opens your items, and that is not a setting. Without a key a tap always opens your items. Save says "Saved." and closes a second later, or says "Couldn't save, try again." and stays open. The owner had written: "the xanax icon isnt giving me an option i dont know id its saving my api key when i enter it". |
```

6. In the Assumed row, `the window ends when the war starts;` becomes `the window ends when the war starts (until 1.0.3; since then the war period lasts until Torn gives the war an end time, Q9);`
7. In **Label**, the line `  - in the war window: "War starts in 5h 12m: tap to pick the armoury or your items";` becomes:

```
  - in the war period: "War starts in 5h 12m: <the tap>" before the start, and "Ranked war on: <the tap>" from it, where <the tap> is "tap to pick the armoury or your items", "tap to open the armoury" or "tap to open your items", as the setting says;
```

8. The **Its own ids** bullet becomes:

```
- **Its own ids:** `tm-xanax-reminder` for the icon, `tm-xanax-reminder-styles` for its stylesheet and `tm-xanax-reminder-settings` for the settings box, so it can never be mistaken for the blood bag's.
```

9. In **The tap**, replace everything from the bullet `- **Normally,** the icon is a link to your items. A tap goes straight there.` to the end of the bullet `- **A long press** ...` (just before `## The war's start time`) with:

```
- **Normally,** the icon is a link to your items. A tap goes straight there.
- **In the war period,** a tap does what the settings box says (see The settings box):
  - **Ask each time** (the default): a tap opens a small box under the icon instead. It holds the line "War starts in 5h 12m", or "Ranked war on" from the start, and two buttons, **Armoury** and **Items**, which are the two links above.
  - **Faction Armoury (Drugs):** the icon's link points at the armoury, so a tap goes straight there, with no box.
  - **Your Items (Drugs):** a tap goes straight to your items, with no box.
  - A stored setting the script doesn't know reads as Ask each time.
- **How the box works:**
  - It is styled like Torn's tooltip.
  - It closes when you tap anywhere that is neither the box nor the icon, press Escape, scroll (it would float away from the icon), tap the icon again, or tap one of its links (which still opens). It also closes when the icon goes, when the war period ends, or when the setting stops being Ask each time.
  - The tap that opens it never also closes it.
  - There is never more than one box.
  - The icon's own link still points at your items, so if anything in the box fails, a tap still gets you somewhere useful.
- **The war period** runs from 24 hours before the start until Torn gives the war an end time: `start - 86400 <= now`, with no end time, from the last answer Torn gave. Any end time means the war is over. On 2026-10-24 none of the faction's 99 ended wars had an end time later than when it was read, and the longest ran 108 hours, so the period has no cap. If a war ends while every check fails (a bad key, Torn down), the tap keeps the war behaviour until a check succeeds; the settings box shows how long ago Torn last answered and why the last check failed.
- **Every check works out the period again** and sets the icon's link, so the tap changes at the start of the period, at the war's start and at its end, and when the setting or the key changes, without a reload. A redrawn row gets the same link.
- **A long press** (500 ms, as the blood bag) opens the settings box. The tap that ends a long press doesn't open the choice box or follow the link. The phone's own long-press menu for links is held back on the icon. A right-click keeps its menu.
```

10. In **The war's start time**:
    - `  - It asks only while the icon is showing. That is the only time the answer matters.` becomes `  - It asks while the icon is showing, when the answer matters, and once when a key is saved in the settings box, even during a cooldown, so the box can say whether the key works.`
    - `  - At most 2 calls an hour, and none while you're on cooldown.` becomes `  - At most 2 calls an hour, and none while you're on cooldown, apart from one each time you save a key.`
    - The **What is kept** bullet becomes:

```
- **What is kept:** the war's `start` and `end` (0 for "no ranked war"), when a tab last asked (`at`), when Torn last answered (`okAt`), and the last error, in GM storage. Everything is stored as a string, because PDA hands stored values back as strings; numbers are read back with `Number()`, and a stored check time in the future (the clock moved back) means ask now.
```

11. Replace the whole `## The key` section, up to `## Where it runs`, with:

```
## The settings box

- **Opening it:**
  - A long press on the Xanax icon, as the blood bag's settings open. That reaches it in any app, even one with no menu.
  - Or the script's menu, where the userscript manager has one: "Xanax Reminder: Settings". It is named for the script because some menus list every script's entries together.
  - It opens over everything, even while the cooldown runs and there is no icon.
- **Its look** is the Blood Bag Reminder's settings:
  - a dark panel 450 px wide (at most 90% of the screen) on a dark overlay;
  - a header with the title "Xanax Reminder Settings" and an "x";
  - grey help text, a grey Cancel and a green Save.
  - The list and the field use 16 px text, or an iPhone zooms in when they are tapped.
  - Nothing is focused when it opens, so a phone doesn't raise its keyboard over it.
- **During a ranked war:** the list Ask each time, Faction Armoury (Drugs), Your Items (Drugs). It shows the saved choice, or Ask each time when none is saved. A line under it says what the list does and that a long press opens these settings.
- **API key:** a plain text field, never `type="password"`, which sets off password managers. It starts empty: the saved key is never shown.
- **The line under the key** says a Public-level key is enough, whether a key is saved (or PDA's is in use), and what Torn said:
  - "Not checked yet." until Torn answers.
  - "Checked 12m ago: ranked war on." The war part can also be "war starts in 5h 12m", "the ranked war is over" or "no ranked war set". Under a minute it says "just now". For an answer kept without its time (saved by 1.0.2), it says "earlier".
  - After a failed check: "Couldn't check the war time: <Torn's message>.", then "Torn last answered 3h 5m ago: ranked war on." if Torn has answered before.
  - With no key, it says the war choice needs one, and that until then a tap always opens your items.
- **Buttons:** Clear key, Cancel and Save.
  - Save keeps the war choice, and the key when one is typed (trimmed). An empty field keeps the saved key; only Clear key removes it. Enter in the field is Save.
  - Saving a key, or clearing it, forgets what Torn said with the old key and asks Torn at once, even during a cooldown.
  - A save counts only when storage gives the value back. Then:
    - the box says "Saved." (or "Key cleared.");
    - the icon's link and label follow at once;
    - the field empties, so a second Save asks Torn nothing more;
    - the box closes a second later.
  - If storage doesn't give the value back, the box says "Couldn't save, try again." and stays open, and the key saved before is kept.
  - Escape, Cancel, the "x", or a tap on the dark area around the box closes it without a change.
- **PDA:** the source carries `###PDA-APIKEY###` once and only once. PDA swaps it for your key. A second copy, or one split across strings, breaks PDA's substitution.
- **Stored:** in GM storage, as strings: the key, the war choice and the war record. A saved key beats the PDA one. An empty key means no key.

```

12. In **Files**, `@version 1.0.2` becomes `@version 1.0.3`.
13. In **Testing**, under **The tap**:
    - `  - From 24h before the start, a tap opens the box with exactly two links, Armoury and Items, pointing where this spec says. From the start onward, a tap goes straight to your items again.` becomes:

```
  - From 24h before the start until Torn gives the war an end time, a tap opens the box with exactly two links, Armoury and Items, pointing where this spec says; after that, a tap goes straight to your items again.
  - With the armoury setting, the icon's link points at the armoury in that period. With the items setting, it points at your items, with no box. The link survives a redrawn row, and goes back when the setting or the key goes.
```

    - `  - A long press opens the key box, and opens no choice box. A short press is a tap.` becomes `  - A long press opens the settings box, and opens no choice box. A short press is a tap.`
    - `  - The key box: a plain text field that starts empty; Save, Clear and Cancel do what this spec says.` becomes:

```
  - The settings box:
    - the war list shows the saved choice;
    - the key field is a plain text field that starts empty;
    - Save, Clear key, Cancel and the "x" do what this spec says;
    - a save that storage refuses, drops or keeps only in part says so;
    - the line under the key says what Torn last said, and how long ago.
```

14. In **Live check**, after the `- 1.0.2: ...` line, add:

```
- 1.0.3: a long press opens "Xanax Reminder Settings", and the line under the key says "A key is saved." with what Torn last said. Choose Faction Armoury (Drugs) and Save: it says "Saved." and closes. During the war, a tap then opens the armoury on its Drugs tab (`sub=drugs`). Ask each time, back again, gives the box titled "Ranked war on".
```

15. In **Not in this version**, delete the line `- A different tap during the war itself.`
16. In **Testing**, under **The tap**, `  - Outside the window, a tap follows the link to your items, and no box opens.` becomes `  - Outside the war period, a tap follows the link to your items, and no box opens.`
17. In **Live check**, `- A long press opens the key box.` becomes `- A long press opens the settings box.`

Then check that the old wording is gone:

```bash
WT=/opt/warboard/.superpowers/sdd/2026-10-24-torn-xanax-reminder-1.0.3/wt; S="$WT/docs/superpowers/specs/2026-10-22-torn-xanax-reminder-design.md"; grep -n "key box\|Set API key\|version 1\.0\.2\|A different tap\|In the war window\|in the war window\|Outside the window" "$S"
```

Expected: no lines. The Status line keeps its 2026-10-22 words about "the war window": they are the history of the first approval.

- [ ] **Step 6: Commit** in the worktree:

```bash
WT=/opt/warboard/.superpowers/sdd/2026-10-24-torn-xanax-reminder-1.0.3/wt; cd "$WT" && git commit -q -m "torn-xanax-reminder 1.0.3: version, changelog, and the spec for the settings box" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- server/public/scripts/torn-xanax-reminder.user.js server/public/scripts/torn-xanax-reminder.meta.js server/torn-xanax-reminder.test.mjs docs/superpowers/specs/2026-10-22-torn-xanax-reminder-design.md && git log --format='%h %s' -1
```

Task 3 ends here. The review below comes before Task 4.

## Between Task 3 and Task 4: the final review

- The review package covers the whole branch, `git merge-base main HEAD`..HEAD, built by `review-package` from inside `$WT`.
- The reviewer is a fresh Opus agent (`model: "opus"`). It gets:
  - the package, this plan and the spec;
  - the Review Focus above, verbatim;
  - a pointer to the ledger's `Ruling:` lines.
- Critical and Important findings go into one fix pass. Each fix is a failing test first, then the fix, then `T` green, committed on the branch.
- Minor findings go to the ledger as deferred.

---

### Task 4: Release

**Files:** none in the repo change here. Main fast-forwards to the branch. The served files get their owner back, and the memory notes outside the repo are updated.

**Interfaces:** consumes the branch `xanax-reminder-1.0.3` after the final review's fix pass.

- [ ] **Step 1: Pre-flight.** Check that the box isn't overloaded, that nobody has changed this script's files in the main checkout, and that main hasn't moved:

```bash
uptime; cd /opt/warboard && git status --short -- server/public/scripts/torn-xanax-reminder.user.js server/public/scripts/torn-xanax-reminder.meta.js server/torn-xanax-reminder.test.mjs docs/superpowers/specs/2026-10-22-torn-xanax-reminder-design.md && git merge-base --is-ancestor main xanax-reminder-1.0.3 && echo fast-forward-ok
```

Expected: load under 12, no status lines, then `fast-forward-ok`.
- If load is over 12, wait.
- If main has moved, rebase the branch first: `git -C "$WT" rebase main`. Then run `T`, which must be all green.

- [ ] **Step 2: Fast-forward main.** This is the moment tornwar.com starts serving 1.0.3. Git writes the files as root, so their owner goes back to warboard:

```bash
cd /opt/warboard && git merge --ff-only xanax-reminder-1.0.3 && chown warboard:warboard server/public/scripts/torn-xanax-reminder.user.js server/public/scripts/torn-xanax-reminder.meta.js && chmod 644 server/public/scripts/torn-xanax-reminder.user.js server/public/scripts/torn-xanax-reminder.meta.js && ls -l server/public/scripts/torn-xanax-reminder.user.js server/public/scripts/torn-xanax-reminder.meta.js
```

Expected: `Fast-forward`, then both files `-rw-r--r-- warboard warboard`.

- [ ] **Step 3: The whole suite, in place:**

```bash
cd /opt/warboard/server && node --test > /opt/warboard/.superpowers/sdd/2026-10-24-torn-xanax-reminder-1.0.3/suite.log 2>&1; grep -E "^# (tests|pass|fail|skipped) " /opt/warboard/.superpowers/sdd/2026-10-24-torn-xanax-reminder-1.0.3/suite.log | paste -sd" " -
```

Expected: `# fail 0`. The last run had 2298 tests, so this one should have about 2312 (this plan adds 14), give or take other sessions' work.
- If a failure is this change's, serve 1.0.2 again at once with `git revert --no-edit <first>^..HEAD` on main (first = the branch's first Task 1 commit), chown the two files again, and stop.
- If a failure is another session's, name it in the report and carry on.

- [ ] **Step 4: Check what is served:**

```bash
curl -s http://127.0.0.1:3000/scripts/torn-xanax-reminder.meta.js | grep '@version'; curl -s https://tornwar.com/scripts/torn-xanax-reminder.meta.js | grep '@version'; curl -s https://tornwar.com/scripts/torn-xanax-reminder.user.js | grep -c "const VERSION = '1.0.3'"
```

Expected: `// @version      1.0.3` twice, then `1`.

- [ ] **Step 5: Push main,** with the remote's credentials masked:

```bash
cd /opt/warboard && git push origin main 2>&1 | sed -E 's#//[^@]*@#//***@#g'; git status -sb | head -1
```

Expected: `main -> main`, and `## main...origin/main` with nothing ahead.

- [ ] **Step 6: Record Task 4,** from inside `$WT`. Run `task-done` with the served-version check as its test command:

```bash
bash -c "curl -s https://tornwar.com/scripts/torn-xanax-reminder.meta.js | grep -q '@version      1.0.3' && echo served-1.0.3"
```

Then copy the ledger out of the worktree, to this session's scratchpad, before the worktree goes.

- [ ] **Step 7: Remove the worktree, the branch and the workspace.** The symlink goes first: git counts it as untracked, so it would block the removal.

```bash
rm /opt/warboard/.superpowers/sdd/2026-10-24-torn-xanax-reminder-1.0.3/wt/server/node_modules && cd /opt/warboard && git worktree remove /opt/warboard/.superpowers/sdd/2026-10-24-torn-xanax-reminder-1.0.3/wt && git branch -d xanax-reminder-1.0.3 && rm -r /opt/warboard/.superpowers/sdd/2026-10-24-torn-xanax-reminder-1.0.3 && git worktree list
```

Expected: `git worktree list` shows only `/opt/warboard`.

- [ ] **Step 8: Notes and report.**
  - Update this script's project memory, outside the repo, in place: 1.0.3 is live, with what changed; still owed: the phone check and the Greasy Fork id. Update its index line in place too.
  - Report to the owner:
    - the rulings and any deferred minors from the ledger;
    - the served URL, https://tornwar.com/scripts/torn-xanax-reminder.user.js;
    - the 1.0.3 live check from the spec.
