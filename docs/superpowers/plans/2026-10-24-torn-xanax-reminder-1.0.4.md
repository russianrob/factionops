# Torn Xanax Reminder 1.0.4: the key's last 4 in the key field, and Torn's answer in the open box - Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** After you save an API key, the settings box's key field shows it with all but its last 4 characters hidden (`************AbCd`) instead of being blank, and the box says what Torn found the moment Torn answers. 1.0.4 also ships the two fixes from 1.0.3's final review, and two small safety changes from its leftovers.

**Architecture:** One script changes: `server/public/scripts/torn-xanax-reminder.user.js`, with its `.meta.js`, tests and spec.
- The key field's `placeholder` becomes the key in use with all but its last 4 hidden.
- The line under the key gets an id, so the war check's two answer handlers can rewrite it while the box is open.
- Those handlers also drop an answer for a key that has since been replaced.
- The war period gets a 7-day cap.
- Work continues in 1.0.3's worktree, on the branch that already holds the two review fixes. The release fast-forwards main.

**Tech Stack:** a plain-JavaScript userscript (Tampermonkey, Torn PDA, the warboard app). Tests use node:test and linkedom, in `server/torn-xanax-reminder.test.mjs`, which reads the script from `TXR_SRC`.

**Spec:** `docs/superpowers/specs/2026-10-22-torn-xanax-reminder-design.md`, amended by Task 3.

**Approved design (2026-10-24 17:19 EDT, owner: "go with recommendations"):**
- **The ask:** "once we enter the api key can it save the last 4 characters instead of it being blank?"
- **Q1 A, the hint:**
  - When a key is in use, the empty key field's grey hint is `************` followed by the key's last 4.
  - Typing a new key replaces the hint. Save with the field left alone keeps the saved key, as now.
  - The hint updates the moment you save, before the box closes.
  - The whole key stays saved, as before, because the script needs it to ask Torn.
- **Q2, PDA's key:** it shows its last 4 the same way. A key typed into the box still beats PDA's.
- **Q3, one release:** 1.0.4 ships with the two committed fixes from 1.0.3's review:
  - a0bad3fd: a save that doesn't all stick changes nothing, the war choice included;
  - 0c683455: the line under the key says what the key is used for.
- **Q4 A, the live line:** the line under the key updates the moment Torn answers, while the box is open. When the box closes doesn't change.
- **Q5 a, late answers:** an answer for a key that has since been replaced is dropped.
- **Q5 c, the cap:** the war period ends 7 days after the start at the latest, even if every check has failed. The longest of the faction's 99 wars ran 108 hours.
- **Left out (Q5 b, d):**
  - a 1.0.2 record that said "no ranked war" still reads "Not checked yet." until the next check;
  - times past a day still read "50h 3m ago", not in days;
  - the "x" and "Saved." still have no screen-reader names.
- **Also, as the executor's own tool,** three tests from the review for behaviour that is already right:
  - Save with only spaces in the field;
  - the choice box closing when the setting changes;
  - the no-key line.

## Global Constraints

- The source is plain ASCII, because PDA turns curly quotes into a syntax error.
- `###PDA-APIKEY###` appears exactly once, because a second copy breaks PDA's substitution.
- Every `GM_*` call is guarded with `typeof`.
- Values are stored as strings, because PDA hands stored values back as strings.
- The key field is a plain text field, never `type="password"`.
- Of the key in use, only its last 4 characters ever show, and only in the key field's grey hint. None of it reaches the label, the tooltip or the console.
- The script never clicks anything itself.
- The script has one menu entry, named for the script: `Xanax Reminder: Settings`.
- **Version 1.0.4** goes in three places:
  - `// @version`;
  - `const VERSION`;
  - a new CHANGELOG entry, newest first, saying why.
- The `.meta.js` is regenerated from the header.
- `@description` is one sentence on what the script does now. Version notes go only in the CHANGELOG, never in code comments.
- Times in the settings box are relative ("12m ago", "just now", "earlier"), never clock times.
- Code comments are clear `//` lines in the file's own style.
- **The repo is public:**
  - no keys, key endings or member data in code, tests, spec or commits;
  - test keys are made-up 16-character strings;
  - the spec writes the hint as `************AbCd`.
- Served files are `warboard:warboard 644`.
- The new script and the new test file reach the main checkout together, in the release's fast-forward. The test file's default `SRC` is the served script.
- Commit only this plan's paths: `git commit -- <paths>`. Trailer: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Only the last 4 ever show.**
   - For a saved key and for PDA's: in the hint attribute, in the box's text and HTML, the label, the tooltip and the console.
   - Tests: "the key field's hint shows the saved key with all but its last 4 hidden, and asks for a key when none is saved" and "with PDA's key in use the hint shows its last 4, and a saved key's last 4 take over" (Task 1). The 1.0.0 test "the key never shows in the label, the tooltip or the console" still runs.
2. **A save that fails leaves the hint on the key that is still saved,** never on the one just typed.
   - Test: "the hint follows Save and Clear key at once, and a save that fails leaves it on the key still saved" (Task 1).
3. **Torn's answer lands after the box has closed, or into a box opened again.**
   - No box comes back and nothing throws. A box opened again shows the answer, and follows it if it lands while that box is open.
   - Test: "an answer that lands after the box closes brings no box back, and one that lands in a box opened again shows there" (Task 1).
4. **Clear key while PDA's key is there.**
   - The hint switches to PDA's last 4, and PDA's key is asked about at once.
   - The cleared key's late answer is dropped.
   - Test: "Clear key with PDA's key there: the hint shows PDA's last 4, PDA's key is asked about at once, and the cleared key's late answer is dropped" (Task 2).
5. **The seven days run out** with the Armoury/Items box open, or with the armoury or ask setting.
   - At the next check the link goes back to your items, a tap follows it, and an open box closes.
   - Tests: "the war period ends seven days after the start, even when no check has worked since" and "an open Armoury/Items box closes when the seven days are up" (Task 2).

## Rulings made at plan time

1. **The hint is the field's `placeholder`:**
   - `'************' + key.slice(-4)` for the key `apiKey()` returns (a saved key, else PDA's), whatever the key's length;
   - `'Your API key'` with none.
   - The field's value stays empty.
2. **When the hint changes:**
   - It is set when the box opens, and after a Save or Clear key that storage kept.
   - A failed save leaves it as it was.
   - Torn's answer doesn't change it, because the key doesn't change then.
3. **After Clear key with PDA's key there,** the hint shows PDA's last 4 and the line says "Using the key Torn PDA gives the script." That is true: PDA's key is the one in use now.
4. **The line under the key gets the id `tm-xanax-reminder-settings-status`.**
   - `statusText(nowMs)` builds it: fix 0c683455's sentence, then "A Public-level key is enough.", then `keyStatus`.
   - `refreshSettings()` rewrites it when the box is open. maybeAsk's two handlers call it after they save Torn's answer.
   - `openSettings` keeps its local `showStatus`, because the line isn't in the page yet while the box is built.
5. **The refresh touches only that line:** not the hint, not "Saved.", and not when the box closes.
6. **A late answer is dropped** by comparing `apiKey()` when the answer lands with the key the call used. Re-saving the same key keeps an answer still out for it, because it is an answer for that key.
7. **The cap is `WAR_CAP_S = 7 * 24 * 60 * 60`, in `warPhase` only,** so the label, the link, the tap and the choice box all follow it.
   - `warWords` doesn't change. The line under the key reports Torn's last answer with its age ("Torn last answered 168h 0m ago: ranked war on." is what Torn said then).
   - Calls go on every 30 minutes while the icon shows, so a fixed key recovers.
8. **The three review tests pass from the start,** because the behaviour is already right. Each is checked instead against the mutant the reviewer found it kills: M24, M09 and M25.
9. **The work stays in 1.0.3's worktree, on branch `xanax-reminder-1.0.3`,** because that branch holds the two fixes 1.0.4 ships.
   - This plan is committed there.
   - Its ledger lives in the worktree's own `.superpowers/sdd/2026-10-24-torn-xanax-reminder-1.0.4/`.
10. **The final review runs between Task 3 and Task 4,** so nothing unreviewed is served. It covers `c7c36a02..HEAD` (main's head, serving 1.0.3), and so the two fixes too.
11. **Task 4 also finishes 1.0.3's cleanup:** its worktree, branch and workspace go after the release.

## Files

- Modify: `server/public/scripts/torn-xanax-reminder.user.js` (Tasks 1-3) and `server/public/scripts/torn-xanax-reminder.meta.js` (Task 3, regenerated).
- Test: `server/torn-xanax-reminder.test.mjs` (Tasks 1-3).
- Modify: `docs/superpowers/specs/2026-10-22-torn-xanax-reminder-design.md` (Task 3).

## Paths and commands

- **`WT`** is the worktree, `/opt/warboard/.superpowers/sdd/2026-10-24-torn-xanax-reminder-1.0.3/wt`. Every command sets it, because shell variables don't carry from one command to the next.
- **The superpowers scripts** (`task-start`, `task-done`, `review-package`, `sdd-workspace`):
  - they run from inside `$WT`, with this plan's path `docs/superpowers/plans/2026-10-24-torn-xanax-reminder-1.0.4.md`;
  - the ledger is `$WT/.superpowers/sdd/2026-10-24-torn-xanax-reminder-1.0.4/progress.md`;
  - 1.0.3's ledger sits beside it, in `.../2026-10-24-torn-xanax-reminder-1.0.3/`.
- **The symlink:** `server/node_modules` in the worktree is a symlink to the main checkout's. Git sees it as untracked, so commits always name their paths and never use `git add -A`.
- **Inserting a test "before" a title** means just above the line that starts that test, with one blank line between tests.
- **`T`, the test run:**

```bash
WT=/opt/warboard/.superpowers/sdd/2026-10-24-torn-xanax-reminder-1.0.3/wt; cd "$WT/server" && TXR_SRC="$WT/server/public/scripts/torn-xanax-reminder.user.js" node --test torn-xanax-reminder.test.mjs 2>&1 | grep -E "^# (tests|pass|fail) " | paste -sd" " -
```

- **`C`, the source check** (it parses, and it is plain ASCII):

```bash
WT=/opt/warboard/.superpowers/sdd/2026-10-24-torn-xanax-reminder-1.0.3/wt; F="$WT/server/public/scripts/torn-xanax-reminder.user.js"; node --check "$F" && LC_ALL=C grep -c '[^ -~]' "$F" | grep -qx 0 && echo ascii-ok
```

## Setup (before Task 1)

- [ ] **Check the worktree:**

```bash
WT=/opt/warboard/.superpowers/sdd/2026-10-24-torn-xanax-reminder-1.0.3/wt; git -C "$WT" log --format='%h %s' -4 && git -C "$WT" status --short && git -C /opt/warboard rev-parse --short=8 main
```

Expected:
- the newest commit is this plan's;
- under it come 0c683455 ("...says what the key is used for again"), a0bad3fd ("...a save that doesn't all stick changes nothing...") and c7c36a02;
- status shows only `?? server/node_modules`;
- main is `c7c36a02`.

- [ ] **The workspace and ledger,** from inside `$WT`:

```bash
WT=/opt/warboard/.superpowers/sdd/2026-10-24-torn-xanax-reminder-1.0.3/wt; S=/root/.claude/plugins/cache/claude-plugins-official/superpowers/6.4.1/skills; cd "$WT" && D=$("$S/subagent-driven-development/scripts/sdd-workspace" docs/superpowers/plans/2026-10-24-torn-xanax-reminder-1.0.4.md) && echo "$D" && { [ -f "$D/progress.md" ] || printf '# SDD ledger — plan: docs/superpowers/plans/2026-10-24-torn-xanax-reminder-1.0.4.md\n' > "$D/progress.md"; } && head -1 "$D/progress.md"
```

Expected: the directory `$WT/.superpowers/sdd/2026-10-24-torn-xanax-reminder-1.0.4`, and the ledger's first line naming this plan.

- [ ] **Baseline:** run `T`.

Expected: `# tests 101 # pass 101 # fail 0`.

---

### Task 1: The key's last 4 in the field, and Torn's answer in the open box

**Files:** `server/public/scripts/torn-xanax-reminder.user.js`, `server/torn-xanax-reminder.test.mjs`.

**Interfaces:**
- Consumes: `apiKey()` (the saved key, else PDA's, else `''`), `keyStatus(nowMs)`, `SETTINGS_ID`, and maybeAsk's two answer handlers.
- Produces:
  - `keyHint()`, a string: the hint;
  - `statusText(nowMs)`, a string: the whole line under the key;
  - `refreshSettings()`, no return: rewrites the open box's line;
  - the line's id, `SETTINGS_ID + '-status'` (`tm-xanax-reminder-settings-status`), which Task 2's tests read.

- [ ] **Step 1: Write the failing tests.** Insert these five before `test('the settings box says what the key is used for', () => {`:

```js
test('the key field\'s hint shows the saved key with all but its last 4 hidden, and asks for a key when none is saved', () => {
  const w = page({ store: { [KEY_STORE]: KEY } }).run();
  w.menu[MENU]();
  assert.equal(keyField(w).getAttribute('placeholder'), '************6789');
  assert.equal(keyField(w).value || '', '', 'the field itself stays empty');
  assert.ok(!settings(w).outerHTML.includes(KEY.slice(0, -4)), 'no more of the key than its last 4');
  const v = page().run();
  v.menu[MENU]();
  assert.equal(keyField(v).getAttribute('placeholder'), 'Your API key');
});

test('the hint follows Save and Clear key at once, and a save that fails leaves it on the key still saved', () => {
  const w = page({ store: { [KEY_STORE]: KEY } }).run();
  w.menu[MENU]();
  keyField(w).value = 'NEWKEY1234560000';
  press(w, 'Save');
  assert.equal(keyField(w).getAttribute('placeholder'), '************0000', 'the new key\'s last 4, before the box closes');
  w.advance(1000);
  w.menu[MENU]();
  press(w, 'Clear key');
  assert.equal(keyField(w).getAttribute('placeholder'), 'Your API key');
  // GM storage that drops writes of the key without a word.
  const store = new Proxy(warStore(), { set(target, k, v) { if (k !== KEY_STORE) target[k] = v; return true; } });
  const v = page({ store }).run();
  v.menu[MENU]();
  keyField(v).value = 'NEWKEY1234560000';
  press(v, 'Save');
  assert.match(settings(v).textContent, /Couldn't save, try again\./);
  assert.equal(keyField(v).getAttribute('placeholder'), '************6789', 'still the saved key');
});

test('with PDA\'s key in use the hint shows its last 4, and a saved key\'s last 4 take over', () => {
  const src = readFileSync(SRC, 'utf8').replace('###PDA-APIKEY###', 'PDAKEY0123454321');
  const w = page({ src }).run();
  w.menu[MENU]();
  assert.equal(keyField(w).getAttribute('placeholder'), '************4321');
  assert.ok(!settings(w).outerHTML.includes('PDAKEY'), 'no more of PDA\'s key than its last 4');
  const v = page({ src, store: { [KEY_STORE]: KEY } }).run();
  v.menu[MENU]();
  assert.equal(keyField(v).getAttribute('placeholder'), '************6789');
});

test('the open box says what Torn found the moment Torn answers, and still closes a second after Save', async () => {
  for (const [reply, words] of [
    [wars(ranked(NOW - 3600)), /A key is saved\. Checked just now: ranked war on\./],
    [{ error: { code: 2, error: 'Incorrect key' } }, /A key is saved\. Couldn't check the war time: Incorrect key\./],
  ]) {
    const w = page({ icons: { drug_cooldown: drug(NOW + 3600) } }).run();
    w.menu[MENU]();
    keyField(w).value = KEY;
    press(w, 'Save');
    assert.match(settings(w).textContent, /A key is saved\. Not checked yet\./);
    w.advance(300);
    answer(w.calls[0], reply);
    await settle();
    assert.match(settings(w).textContent, words, 'while the box is still open');
    assert.match(settings(w).textContent, /Saved\./, 'and "Saved." stays');
    w.advance(700);
    assert.equal(settings(w), null, 'it closes a second after Save, as before');
  }
});

test('an answer that lands after the box closes brings no box back, and one that lands in a box opened again shows there', async () => {
  const saved = () => {
    const w = page({ icons: { drug_cooldown: drug(NOW + 3600) } }).run();
    w.menu[MENU]();
    keyField(w).value = KEY;
    press(w, 'Save');
    w.advance(1000);
    assert.equal(settings(w), null);
    return w;
  };
  const w = saved();
  answer(w.calls[0], wars(ranked(NOW - 3600)));
  await settle();
  assert.equal(settings(w), null, 'no box comes back');
  w.menu[MENU]();
  assert.match(settings(w).textContent, /A key is saved\. Checked just now: ranked war on\./);
  const v = saved();
  v.menu[MENU]();
  assert.match(settings(v).textContent, /A key is saved\. Not checked yet\./);
  answer(v.calls[0], wars(ranked(NOW - 3600)));
  await settle();
  assert.match(settings(v).textContent, /A key is saved\. Checked just now: ranked war on\./, 'the box opened again follows the answer');
});
```

- [ ] **Step 2: Run `T`.**

Expected: `# tests 106 # pass 101 # fail 5`. Each failure is an assertion, not an error:
- the three hint tests fail because the hint is "Your API key";
- the fourth fails at "while the box is still open";
- the fifth fails at "the box opened again follows the answer".

- [ ] **Step 3: Write the code.**

(a) Insert before the line `  // Saves the key ('' for none), and says whether storage kept it. A new key, or none, forgets`:

```js
  // The key field's grey hint: the key in use with all but its last 4 hidden, so you can see a
  // key is saved (or PDA's is in use) without the rest of it showing; "Your API key" when there
  // is none.
  function keyHint() {
    const key = apiKey();
    return key ? '************' + key.slice(-4) : 'Your API key';
  }

  // The line under the key field. What the key is for comes first: someone pasting a key should
  // know what it is used for.
  function statusText(nowMs) {
    return 'With your API key, the script checks when your faction\'s ranked war starts and ends. '
      + 'A Public-level key is enough. ' + keyStatus(nowMs);
  }

  // Brings the open settings box's line up to date. Called when Torn answers, so the box says
  // what Torn found at once, even in the second before it closes after a save.
  function refreshSettings() {
    const status = document.getElementById(SETTINGS_ID + '-status');
    if (status) status.textContent = statusText(Date.now());
  }

```

(b) In `openSettings`, replace `    input.placeholder = 'Your API key';` with `    input.placeholder = keyHint();`.

(c) In `openSettings`, replace

```js
    const status = make('p');
    // What the key is for comes first: someone pasting a key should know what it is used for.
    const showStatus = () => {
      status.textContent = 'With your API key, the script checks when your faction\'s ranked war starts and ends. '
        + 'A Public-level key is enough. ' + keyStatus(Date.now());
    };
```

with

```js
    const status = make('p');
    status.id = SETTINGS_ID + '-status';
    const showStatus = () => {
      status.textContent = statusText(Date.now());
    };
```

(d) In `finish`, replace

```js
      input.value = '';
      showStatus();
```

with

```js
      input.value = '';
      input.placeholder = keyHint();
      showStatus();
```

and replace its comment

```js
    // After Save or Clear key. When storage kept it, the icon follows at once, the field
    // empties (so a second Save asks Torn nothing more), and the box says so and closes a
    // second later. When it didn't, the box says so and stays open.
```

with

```js
    // After Save or Clear key. When storage kept it, the icon follows at once, the field
    // empties (so a second Save asks Torn nothing more) and its hint shows the key now in use,
    // and the box says so and closes a second later. When it didn't, the box says so and stays
    // open, with the hint as it was.
```

(e) In the comment above `function openSettings()`, replace

```js
  // ranked war, and the API key. The key field is a plain text field (a password field sets off
  // password managers) that starts empty: the saved key is never shown. Nothing is focused, so
  // a phone doesn't raise its keyboard over the box.
```

with

```js
  // ranked war, and the API key. The key field is a plain text field (a password field sets off
  // password managers) that starts empty; its grey hint shows the key in use with all but its
  // last 4 hidden. Nothing is focused, so a phone doesn't raise its keyboard over the box.
```

(f) In `maybeAsk`, replace

```js
      now.okAt = Date.now();
      writeWar(now);
    }, (message) => {
      // Keep the last good answer, and say why this one failed.
      const now = readWar();
      now.error = message;
      writeWar(now);
    });
```

with

```js
      now.okAt = Date.now();
      writeWar(now);
      refreshSettings();
    }, (message) => {
      // Keep the last good answer, and say why this one failed.
      const now = readWar();
      now.error = message;
      writeWar(now);
      refreshSettings();
    });
```

and its comment's last line `  // icon shows, and when a key is saved.` with `  // icon shows, and when a key is saved. When Torn answers, an open settings box says so.`

- [ ] **Step 4: Run `T`, then `C`.**

Expected: `# tests 106 # pass 106 # fail 0`, then `ascii-ok`.

- [ ] **Step 5: Commit.**

```bash
WT=/opt/warboard/.superpowers/sdd/2026-10-24-torn-xanax-reminder-1.0.3/wt; cd "$WT" && git commit -q -m "torn-xanax-reminder: the key field shows the key in use with all but its last 4 hidden, and the open box follows Torn's answer" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- server/public/scripts/torn-xanax-reminder.user.js server/torn-xanax-reminder.test.mjs && git log --format='%h %s' -1
```

---

### Task 2: Late answers for a replaced key, and the 7-day cap

**Files:** `server/public/scripts/torn-xanax-reminder.user.js`, `server/torn-xanax-reminder.test.mjs`.

**Interfaces:**
- Consumes from Task 1:
  - the hint, which the PDA test reads as the field's `placeholder`;
  - `refreshSettings()` in both handlers, without which the open box's line wouldn't follow the answer;
  - the line's id `tm-xanax-reminder-settings-status`.
- Produces: `WAR_CAP_S` (seconds), and `warPhase(nowMs)` returning null from `start + WAR_CAP_S`.

- [ ] **Step 1: Write the failing tests.**

(a) Insert these two before `test('the settings box says what the key is used for', () => {`, so they land after Task 1's:

```js
test('an answer for a key that has since been replaced is dropped, whichever answer lands first', async () => {
  for (const [mine, late, says, never] of [
    [{ error: { code: 2, error: 'Incorrect key' } }, wars(ranked(NOW - 3600)), /A key is saved\. Couldn't check the war time: Incorrect key\./, /Checked just now/],
    [wars(ranked(NOW - 3600)), { error: { code: 2, error: 'Incorrect key' } }, /A key is saved\. Checked just now: ranked war on\./, /Couldn't check/],
  ]) {
    const w = page({ store: { [KEY_STORE]: 'OLDKEY1234567890' } }).run();
    assert.equal(w.calls.length, 1, 'asked with the old key');
    w.menu[MENU]();
    keyField(w).value = KEY;
    press(w, 'Save');
    assert.equal(w.calls.length, 2, 'asked with the new key');
    answer(w.calls[1], mine);
    await settle();
    answer(w.calls[0], late);   // the old key's answer lands late
    await settle();
    w.advance(1000);
    w.menu[MENU]();
    assert.match(settings(w).textContent, says);
    assert.doesNotMatch(settings(w).textContent, never);
  }
});

test('Clear key with PDA\'s key there: the hint shows PDA\'s last 4, PDA\'s key is asked about at once, and the cleared key\'s late answer is dropped', async () => {
  const src = readFileSync(SRC, 'utf8').replace('###PDA-APIKEY###', 'PDAKEY0123454321');
  const w = page({ src, store: { [KEY_STORE]: KEY } }).run();
  assert.equal(w.calls.length, 1, 'asked with the saved key');
  w.menu[MENU]();
  press(w, 'Clear key');
  assert.match(settings(w).textContent, /Key cleared\./);
  assert.equal(keyField(w).getAttribute('placeholder'), '************4321');
  assert.equal(w.calls.length, 2, 'PDA\'s key is asked about at once');
  assert.match(w.calls[1].url, /key=PDAKEY0123454321&/);
  answer(w.calls[1], wars(ranked(NOW - 3600)));
  await settle();
  answer(w.calls[0], { error: { code: 2, error: 'Incorrect key' } });   // the cleared key's answer lands late
  await settle();
  assert.match(settings(w).textContent, /Using the key Torn PDA gives the script\. Checked just now: ranked war on\./);
});
```

(b) Insert these two before `test('a stored tap setting the script doesn\'t know reads as ask each time', () => {`:

```js
test('the war period ends seven days after the start, even when no check has worked since', () => {
  const start = NOW - 3600;
  for (const tap of ['armoury', 'ask']) {
    const w = page({ store: { ...warStore(start), [WAR_TAP_STORE]: tap } }).run();
    // A key that went bad mid-war: every check since has failed, so the record still says the war is on.
    const at = (s) => {
      w.clock.ms = s * 1000;
      w.store[WAR_STORE] = JSON.stringify({ at: s * 1000, okAt: NOW * 1000, start, end: 0, error: 'Incorrect key' });
      w.check();
    };
    at(start + 7 * 86400 - 60);
    const words = tap === 'ask' ? 'tap to pick the armoury or your items' : 'tap to open the armoury';
    assert.equal(w.label(), LABEL + '. Ranked war on: ' + words + '. Couldn\'t check the war time: Incorrect key', tap + ': a minute before the seven days are up');
    at(start + 7 * 86400);
    assert.equal(w.label(), LABEL + '. Couldn\'t check the war time: Incorrect key', tap + ': seven days after the start');
    assert.equal(w.link().getAttribute('href'), ITEMS, tap);
    assert.equal(fire(w, w.link(), 'click').defaultPrevented, false, tap + ': a tap follows the link to your items');
    assert.equal(box(w), null, tap);
  }
});

test('an open Armoury/Items box closes when the seven days are up', () => {
  const start = NOW - 3600;
  const w = page({ store: warStore(start) }).run();
  w.clock.ms = (start + 7 * 86400 - 60) * 1000;
  w.store[WAR_STORE] = JSON.stringify({ at: w.clock.ms, okAt: NOW * 1000, start, end: 0, error: 'Incorrect key' });
  w.check();
  fire(w, w.link(), 'click');
  assert.ok(box(w), 'open a minute before');
  w.clock.ms += 60 * 1000;
  w.check();
  assert.equal(box(w), null);
});
```

- [ ] **Step 2: Run `T`.**

Expected: `# tests 110 # pass 106 # fail 4`, each failing on an assertion:
- the late-answer test, at its first case's "Couldn't check the war time: Incorrect key";
- the PDA test, at its last assertion, because the cleared key's error shows;
- the cap test, at "armoury: seven days after the start";
- the box test, because the box is still open.

- [ ] **Step 3: Write the code.**

(a) In `maybeAsk`, replace

```js
    askTorn(key).then((ranked) => {
      const now = readWar();
```

with

```js
    askTorn(key).then((ranked) => {
      // An answer for a key that has since been saved over or cleared says nothing about the
      // key in use now: that key has its own call.
      if (apiKey() !== key) return;
      const now = readWar();
```

and

```js
    }, (message) => {
      // Keep the last good answer, and say why this one failed.
```

with

```js
    }, (message) => {
      if (apiKey() !== key) return;
      // Keep the last good answer, and say why this one failed.
```

(b) Replace

```js
  // The war period starts this long before the war does, and lasts until Torn gives the war
  // an end time.
  const WINDOW_S = 24 * 60 * 60;
```

with

```js
  // The war period starts this long before the war does, and lasts until Torn gives the war
  // an end time, or until WAR_CAP_S after the start.
  const WINDOW_S = 24 * 60 * 60;
  // The war period ends this long after the start at the latest, even when no check has worked
  // since: without it, a key that goes bad mid-war would keep the war behaviour for good. The
  // longest of 99 wars looked at ran 108 hours.
  const WAR_CAP_S = 7 * 24 * 60 * 60;
```

(c) Replace

```js
  // The war period: { left } in the 24 hours before the start (seconds to go), { on: true }
  // from the start until Torn gives the war an end time, or null outside it. Any end time
  // means the war is over. Needs a key: without one, the tap always opens your items.
  function warPhase(nowMs) {
    if (!apiKey()) return null;
    const war = readWar();
    const nowS = nowMs / 1000;
    if (!(war.start > 0) || war.end > 0 || nowS < war.start - WINDOW_S) return null;
```

with

```js
  // The war period: { left } in the 24 hours before the start (seconds to go), { on: true }
  // from the start until Torn gives the war an end time (seven days at most), or null outside
  // it. Any end time means the war is over. Needs a key: without one, the tap always opens
  // your items.
  function warPhase(nowMs) {
    if (!apiKey()) return null;
    const war = readWar();
    const nowS = nowMs / 1000;
    if (!(war.start > 0) || war.end > 0) return null;
    if (nowS < war.start - WINDOW_S || nowS >= war.start + WAR_CAP_S) return null;
```

- [ ] **Step 4: Run `T`, then `C`.**

Expected: `# tests 110 # pass 110 # fail 0`, then `ascii-ok`.

- [ ] **Step 5: Add the review's three tests.** They pin behaviour that is already right (plan ruling 8). Insert them before `test('a host with no menu, or one whose menu throws, still gets the icon and the long press', () => {`:

```js
test('Save with only spaces in the key field keeps the saved key', () => {
  const w = page({ store: warStore() }).run();
  w.menu[MENU]();
  keyField(w).value = '   ';
  press(w, 'Save');
  assert.equal(w.store[KEY_STORE], KEY);
  assert.match(settings(w).textContent, /Saved\./);
});

test('an open Armoury/Items box closes when the setting stops being ask each time', () => {
  const w = page({ store: warStore(NOW - 3600) }).run();
  fire(w, w.link(), 'click');
  assert.ok(box(w));
  w.store[WAR_TAP_STORE] = 'armoury';   // saved in another tab
  w.check();
  assert.equal(box(w), null);
});

test('with no key, the line under the key ends with the note, and says nothing of a check', () => {
  const w = page().run();
  w.menu[MENU]();
  assert.equal(w.document.getElementById(SETTINGS + '-status').textContent,
    'With your API key, the script checks when your faction\'s ranked war starts and ends. A Public-level key is enough. '
    + 'No key saved. The war choice needs one: until then, a tap always opens your items.');
});
```

- [ ] **Step 6: Run `T`.**

Expected: `# tests 113 # pass 113 # fail 0`.

- [ ] **Step 7: Check each of the three against its mutant.** Each mutant is a copy of the script in the scratchpad, with its meta next to it:
- M24: Save without the trim;
- M09: the choice box ignoring the setting;
- M25: the no-key line going on to the check.

```bash
WT=/opt/warboard/.superpowers/sdd/2026-10-24-torn-xanax-reminder-1.0.3/wt; python3 -I - "$WT" /tmp/claude-0/-root/47c424fc-f532-4851-8c7f-7c18d084306c/scratchpad/xr/mutants-1.0.4 <<'PY'
import os, shutil, subprocess, sys
wt, out = sys.argv[1], sys.argv[2]
path = wt + '/server/public/scripts/torn-xanax-reminder.user.js'
src = open(path).read()
mutants = [
    ('M24', "      const key = String(input.value || '').trim();", "      const key = String(input.value || '');", 'Save with only spaces in the key field keeps the saved key'),
    ('M09', "    if (!phase || warTap() !== 'ask') closeChoice();", "    if (!phase) closeChoice();", 'an open Armoury/Items box closes when the setting stops being ask each time'),
    ('M25', "    if (!apiKey()) return text;\n", "", 'with no key, the line under the key ends with the note, and says nothing of a check'),
]
for name, find, repl, title in mutants:
    assert src.count(find) == 1, name
    d = os.path.join(out, name)
    os.makedirs(d, exist_ok=True)
    open(d + '/torn-xanax-reminder.user.js', 'w').write(src.replace(find, repl, 1))
    shutil.copy(path.replace('.user.js', '.meta.js'), d + '/torn-xanax-reminder.meta.js')
    r = subprocess.run(['node', '--test', 'torn-xanax-reminder.test.mjs'], cwd=wt + '/server', capture_output=True, text=True,
                       env=dict(os.environ, TXR_SRC=d + '/torn-xanax-reminder.user.js'))
    failed = [l.split(' - ', 1)[1] for l in r.stdout.splitlines() if l.startswith('not ok ')]
    print(name, 'killed by its test' if title in failed else 'SURVIVED its test', '| fails:', len(failed))
PY
```

Expected: `M24 killed by its test`, `M09 killed by its test`, `M25 killed by its test`.

- [ ] **Step 8: Commit.**

```bash
WT=/opt/warboard/.superpowers/sdd/2026-10-24-torn-xanax-reminder-1.0.3/wt; cd "$WT" && git commit -q -m "torn-xanax-reminder: an answer for a replaced key is dropped, and the war period ends seven days after the start at the latest" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- server/public/scripts/torn-xanax-reminder.user.js server/torn-xanax-reminder.test.mjs && git log --format='%h %s' -1
```

---

### Task 3: Version 1.0.4, and the spec

**Files:** `server/public/scripts/torn-xanax-reminder.user.js`, `server/public/scripts/torn-xanax-reminder.meta.js`, `server/torn-xanax-reminder.test.mjs`, `docs/superpowers/specs/2026-10-22-torn-xanax-reminder-design.md`.

**Interfaces:** none new. The header test reads `// @version`, `const VERSION` and the CHANGELOG, and the console test reads the start line.

- [ ] **Step 1: Write the failing tests.**

In the header test, replace `  assert.deepEqual(tag('version'), ['1.0.3']);` with `  assert.deepEqual(tag('version'), ['1.0.4']);`. Then replace

```js
  assert.match(src, /const VERSION = '1\.0\.3';/, 'the in-file version matches @version');
  assert.match(src, /^\/\/ v1\.0\.3  - A settings box/m, 'the changelog has the 1.0.3 entry');
```

with

```js
  assert.match(src, /const VERSION = '1\.0\.4';/, 'the in-file version matches @version');
  assert.match(src, /^\/\/ v1\.0\.4  - The key field shows the key in use/m, 'the changelog has the 1.0.4 entry');
  assert.match(src, /^\/\/ v1\.0\.3  - A settings box/m, 'the changelog keeps the 1.0.3 entry');
```

In the console test, replace `['[Torn Xanax Reminder 1.0.3] running']` with `['[Torn Xanax Reminder 1.0.4] running']`.

- [ ] **Step 2: Run `T`.**

Expected: `# tests 113 # pass 111 # fail 2`: the header test and the console test.

- [ ] **Step 3: Bump the version.**
- Replace `// @version      1.0.3` with `// @version      1.0.4`.
- Replace `  const VERSION = '1.0.3';` with `  const VERSION = '1.0.4';`.
- Insert this entry before the line `// v1.0.3  - A settings box like the Blood Bag Reminder's (long press the icon, or "Xanax`:

```js
// v1.0.4  - The key field shows the key in use with all but its last 4 hidden, so you can
//           see a key is saved. The box says what the key is used for again, and what Torn
//           found the moment it answers. A save that doesn't all stick changes nothing. An
//           answer for a key you have since replaced is dropped, and the war period ends 7
//           days after the start at the latest, even if every check fails.
```

Then regenerate the meta from the header:

```bash
WT=/opt/warboard/.superpowers/sdd/2026-10-24-torn-xanax-reminder-1.0.3/wt; cd "$WT/server/public/scripts" && sed -n '1,/^\/\/ ==\/UserScript==$/p' torn-xanax-reminder.user.js > torn-xanax-reminder.meta.js && grep -E "@version" torn-xanax-reminder.meta.js
```

Expected: `// @version      1.0.4`.

- [ ] **Step 4: Amend the spec.** Each change below replaces text that occurs once.

(a) In the status line, replace `then approved the design with "yes go with your recommendations" (see Q9).` with `then approved the design with "yes go with your recommendations" (see Q9). Amended again the same day for 1.0.4, the key's last 4 in the key field: the owner asked "once we enter the api key can it save the last 4 characters instead of it being blank?", then said "go with recommendations" (see Q10).`

(b) Replace `version 1.0.3. Tests:` with `version 1.0.4. Tests:`.

(c) In Q9, replace `The war counts from 24 hours before its start until Torn gives it an end time; while it is on,` with `The war counts from 24 hours before its start until Torn gives it an end time (since 1.0.4, 7 days after the start at the latest: Q10); while it is on,`.

(d) Insert this row before the line starting `| Assumed | These went to the owner`:

```markdown
| Q10 | 1.0.4: when a key is in use, the empty key field's grey hint shows it with all but its last 4 hidden (`************AbCd`); PDA's key shows the same way, and a saved key still beats it. The line under the key updates the moment Torn answers. An answer for a key that has since been saved over or cleared is dropped. The war period ends 7 days after the start at the latest, a safety cap for when every check fails. The owner asked "once we enter the api key can it save the last 4 characters instead of it being blank?", and said "go with recommendations" to these. 1.0.4 also ships two fixes from 1.0.3's review: a save that doesn't all stick changes nothing, and the line under the key says what the key is used for. |
```

(e) In the Assumed row, replace `(until 1.0.3; since then the war period lasts until Torn gives the war an end time, Q9)` with `(until 1.0.3; since then the war period lasts until Torn gives the war an end time, Q9, and since 1.0.4 at most 7 days after the start, Q10)`.

(f) Replace the whole bullet starting `- **The war period** runs from 24 hours before the start` with:

```markdown
- **The war period** runs from 24 hours before the start until Torn gives the war an end time, and 7 days after the start at the latest: `start - 86400 <= now < start + 604800`, with no end time, from the last answer Torn gave. Any end time means the war is over. On 2026-10-24 none of the faction's 99 ended wars had an end time later than when it was read, and the longest ran 108 hours, so the 7 days (since 1.0.4) never end a real war early. They are there for a war that ends while every check fails (a bad key, Torn down): the tap keeps the war behaviour until a check succeeds or the 7 days are up, and the settings box shows how long ago Torn last answered and why the last check failed. The line under the key still reports Torn's last answer as it was.
```

(g) Insert before the line starting `- **With no key** there is no call and no extra line in the tooltip.`:

```markdown
- **An answer for a replaced key** is dropped: when an answer comes back after the key it was asked with has been saved over or cleared, nothing of it is kept. The key in use has its own call.
```

(h) Replace `It starts empty: the saved key is never shown.` with:

```markdown
It starts empty. When a key is in use (a saved one, or PDA's), its grey hint is the key with all but its last 4 hidden, `************AbCd`; otherwise the hint is "Your API key". The rest of the key is never shown. The hint changes at once after Save or Clear key, and not after a save that failed.
```

(i) Insert after the line `  - With no key, it says the war choice needs one, and that until then a tap always opens your items.`:

```markdown
  - It updates the moment Torn answers while the box is open, so in the second before the box closes after Save it can already say what Torn found. The box still closes a second after a save.
```

(j) In Testing, replace `    - the line under the key says what Torn last said, and how long ago.` with

```markdown
    - the line under the key says what Torn last said, and how long ago, and follows Torn's answer while the box is open;
    - the key field's hint shows only the last 4 of the key in use (a saved one, or PDA's), follows Save and Clear key, and stays put after a failed save.
```

Insert after `  - At most one call per 30 minutes, even with two "tabs" sharing storage.` the line `  - An answer for a key that has since been saved over or cleared is dropped.`. Insert after `  - With no key, or an API error and nothing cached, a tap goes straight to your items.` the line `  - The war period ends 7 days after the start, even when every check has failed, and an open Armoury/Items box closes then.`.

(k) In Live check, insert after the line starting `- 1.0.3: a long press opens "Xanax Reminder Settings"`:

```markdown
- 1.0.4: after Save, the key field's grey hint shows `************` and your key's last 4, and the line under it says what Torn found (or why it failed) within a second or so, before the box closes.
```

(l) At the end of "Not in this version", add:

```markdown
- From 1.0.3's review leftovers, which the owner left out of 1.0.4: a 1.0.2 war record that said "no ranked war" reads "Not checked yet." until the next check; times past a day read "50h 3m ago", not in days; the "x" and "Saved." have no screen-reader names.
```

- [ ] **Step 5: Run `T`, then `C`, then check the spec.**

```bash
WT=/opt/warboard/.superpowers/sdd/2026-10-24-torn-xanax-reminder-1.0.3/wt; S="$WT/docs/superpowers/specs/2026-10-22-torn-xanax-reminder-design.md"; grep -c "| Q10 |" "$S"; grep -cE "never shown\.$|has no cap|version 1\.0\.3\." "$S"; grep -c "start + 604800" "$S"
```

Expected:
- `T`: `# tests 113 # pass 113 # fail 0`;
- `C`: `ascii-ok`;
- the spec check: `1`, then `0`, then `1`.

- [ ] **Step 6: Commit.**

```bash
WT=/opt/warboard/.superpowers/sdd/2026-10-24-torn-xanax-reminder-1.0.3/wt; cd "$WT" && git commit -q -m "torn-xanax-reminder 1.0.4: version, changelog, and the spec for the key's last 4" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- server/public/scripts/torn-xanax-reminder.user.js server/public/scripts/torn-xanax-reminder.meta.js server/torn-xanax-reminder.test.mjs docs/superpowers/specs/2026-10-22-torn-xanax-reminder-design.md && git log --format='%h %s' -1
```

---

## Between Task 3 and Task 4: the final review

- **The package** covers `c7c36a02..HEAD`: main's head, which serves 1.0.3, to the branch's head. It is built by `review-package` from inside `$WT`, with this plan's path.
- **The reviewer** is a fresh Opus agent (`model: "opus"`). It gets:
  - the package, this plan and the spec;
  - the Review Focus above, verbatim;
  - pointers to the `Ruling:` lines in both ledgers, 1.0.3's and 1.0.4's.
- **Critical and Important findings** go into one fix pass. Each fix is a failing test first, then the fix, then `T` green, committed on the branch.
- **Minor findings** go to the ledger as deferred.

---

### Task 4: Release

**Files:** none in the repo change here. Main fast-forwards to the branch, the served files get their owner back, and the memory notes outside the repo are updated.

**Interfaces:** consumes the branch `xanax-reminder-1.0.3` after the final review's fix pass.

- [ ] **Step 1: Pre-flight.** Check the load, that nobody has touched this script's files in the main checkout, that main hasn't moved, and that the branch changes only this plan's paths:

```bash
P="server/public/scripts/torn-xanax-reminder.user.js server/public/scripts/torn-xanax-reminder.meta.js server/torn-xanax-reminder.test.mjs docs/superpowers/specs/2026-10-22-torn-xanax-reminder-design.md docs/superpowers/plans/2026-10-24-torn-xanax-reminder-1.0.4.md"; uptime; cd /opt/warboard && [ "$(git branch --show-current)" = main ] && [ -z "$(git status --short -- $P)" ] && git merge-base --is-ancestor main xanax-reminder-1.0.3 && [ "$(git diff --name-only main..xanax-reminder-1.0.3 | sort | paste -sd' ' -)" = "$(printf '%s\n' $P | sort | paste -sd' ' -)" ] && echo fast-forward-ok
```

Expected: a load under 12, then `fast-forward-ok`.
- If the load is over 12, wait.
- If main has moved, rebase the branch first (`git -C "$WT" rebase main`), then run `T`, which must be all green.

- [ ] **Step 2: Fast-forward main.** This is the moment tornwar.com starts serving 1.0.4.

```bash
cd /opt/warboard && git merge --ff-only xanax-reminder-1.0.3 && chown warboard:warboard server/public/scripts/torn-xanax-reminder.user.js server/public/scripts/torn-xanax-reminder.meta.js && chmod 644 server/public/scripts/torn-xanax-reminder.user.js server/public/scripts/torn-xanax-reminder.meta.js && ls -l server/public/scripts/torn-xanax-reminder.user.js server/public/scripts/torn-xanax-reminder.meta.js
```

Expected: `Fast-forward`, then both files `-rw-r--r-- warboard warboard`.

- [ ] **Step 3: The whole suite, in place:**

```bash
L=/tmp/claude-0/-root/47c424fc-f532-4851-8c7f-7c18d084306c/scratchpad/xanax-1.0.4-suite.log; cd /opt/warboard/server && node --test > "$L" 2>&1; grep -E "^# (tests|pass|fail|skipped) " "$L" | paste -sd" " -
```

Expected: `# fail 0`. The last run had 2313 tests with 99 in this file, so this one should have about 2327, give or take other sessions' work.
- If a failure is this change's, serve 1.0.3 again at once: run `git revert --no-edit c7c36a02..HEAD` on main, chown the two files again, and stop.
- If a failure is another session's, name it in the report and carry on.

- [ ] **Step 4: Check what is served:**

```bash
curl -s http://127.0.0.1:3000/scripts/torn-xanax-reminder.meta.js | grep '@version'; curl -s https://tornwar.com/scripts/torn-xanax-reminder.meta.js | grep '@version'; curl -s https://tornwar.com/scripts/torn-xanax-reminder.user.js | grep -c "const VERSION = '1.0.4'"; curl -s https://tornwar.com/scripts/torn-xanax-reminder.user.js | grep -c '###PDA-APIKEY###'
```

Expected: `// @version      1.0.4` twice, then `1`, then `1`.

- [ ] **Step 5: Push main,** with the remote's credentials masked:

```bash
cd /opt/warboard && git push origin main 2>&1 | sed -E 's#//[^@]*@#//***@#g'; git status -sb | head -1
```

Expected: `main -> main`, and `## main...origin/main` with nothing ahead.

- [ ] **Step 6: Record Task 4,** from inside `$WT`. Run `task-done` with the served-version check as its test command:

```bash
bash -c "curl -s https://tornwar.com/scripts/torn-xanax-reminder.meta.js | grep -q '@version      1.0.4' && echo served-1.0.4"
```

Then copy both ledgers out of the worktree, to `xanax-1.0.3-ledger.md` and `xanax-1.0.4-ledger.md` in this session's scratchpad.

- [ ] **Step 7: Remove the worktree, the branch and 1.0.3's workspace.** The symlink goes first, because git counts it as untracked and it would block the removal.

```bash
rm /opt/warboard/.superpowers/sdd/2026-10-24-torn-xanax-reminder-1.0.3/wt/server/node_modules && cd /opt/warboard && git worktree remove /opt/warboard/.superpowers/sdd/2026-10-24-torn-xanax-reminder-1.0.3/wt && git branch -d xanax-reminder-1.0.3 && rm -r /opt/warboard/.superpowers/sdd/2026-10-24-torn-xanax-reminder-1.0.3 && git worktree list
```

Expected: `git worktree list` shows only `/opt/warboard`.

- [ ] **Step 8: Update the memory note** `project_torn_xanax_reminder.md` and its `MEMORY.md` line: 1.0.4 live, the key's last 4 in the field, and next bump 1.0.5. Still owed: the owner's phone check and the Greasy Fork id.

- [ ] **Step 9: Report** to the owner:
  - every `Ruling:` line from both ledgers, each with its cost if wrong;
  - the deferred minors;
  - the served URL, https://tornwar.com/scripts/torn-xanax-reminder.user.js;
  - the live check: after Save, the key field shows `************` and your key's last 4, and the line says what Torn found within a second or so.
