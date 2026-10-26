# Torn User List Filter 1.0.0 - Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A new userscript, Torn User List Filter 1.0.0, that hides the people in hospital, in jail or abroad from Torn's user list search (`page.php?sid=UserList`). A slim bar above the list holds a switch for each kind and says how many rows on the page are hidden.

**Architecture:** One new script, `server/public/scripts/torn-userlist-filter.user.js`, with its `.meta.js`, tested in `server/torn-userlist-filter.test.mjs`.
- It reads each row's status icons by number (15 and 91 hospital, 16 jail, 71 abroad), or by label for a number it doesn't know. A row of a kind switched on gets a class of the script's own, which its one stylesheet hides.
- The bar goes right before the list's title bar. Its three switches are saved in GM storage.
- A MutationObserver, for rows added and removed only, checks each new page of results as Torn puts it in.
- All work happens in a git worktree on a branch, because the main checkout is the tree tornwar.com serves. The release fast-forwards main, after a read-only live check of a real results page.

**Tech Stack:** a plain-JavaScript userscript (Tampermonkey, Torn PDA, the warboard apps). Tests use node:test and linkedom, and read the script from `TULF_SRC`. The live check runs a read-only probe through the warboard iOS app's remote inspect.

**Spec:** `docs/superpowers/specs/2026-10-25-torn-userlist-filter-design.md`. The owner approved it on 2026-10-25 at 21:47 EDT: "approved, write the plan". This plan's commit sets the spec's Status line to say so. The owner's decisions are the spec's table: Page and Q1-Q6.

**Execution:** the owner, 2026-10-25 at 22:30 EDT: "yes to all, do recommended and finishbthe filter", answering a status that recommended Native. So this plan runs at once, Native: one session does every task, then one fresh Opus reviewer checks the whole branch. The release follows the review's fix pass and the live check, which needs the owner (Task 4 Step 1).

**Dry run:** all the code in this plan ran while the plan was written.
- Each task's script edits were replayed on the script as the task before leaves it, and rebuild the next stage byte for byte.
- Each task's tests ran against the stage before (the RED lines below) and the stage after (the GREEN lines).
- The mutant check (Task 3) caught 41 of 41.
- The live check's probe (Task 4) ran twice on a copy of the page, the second time after a new list had replaced the first.

## Global Constraints

- **Name and owner:** @name `Torn User List Filter`, file `torn-userlist-filter.user.js`. @namespace and @author `RussianRob`. @license `All Rights Reserved`. No @copyright.
- **Version** `1.0.0`, in three places: `// @version`, `const VERSION`, and the CHANGELOG entry `// v1.0.0  - First release.`. The console line on start carries it: `[Torn User List Filter 1.0.0] running`.
- **URLs:** @downloadURL `https://tornwar.com/scripts/torn-userlist-filter.user.js`, @updateURL `https://tornwar.com/scripts/torn-userlist-filter.meta.js`.
- **Where it runs:** @match `https://www.torn.com/page.php*`, @run-at `document-end`, gated in the code on `sid=UserList` in the address, in any letter case. On any other page it does nothing at all.
- **Grants:** @grant GM_getValue, GM_setValue. No @connect and no menu entry: the bar is the settings.
- **The `.meta.js`** is the header, byte for byte, then a newline.
- **Plain ASCII,** because PDA turns curly quotes into a syntax error.
- **Every `GM_*` call is guarded** with `typeof`.
- **No API key and no network calls,** so `###PDA-APIKEY###` never appears. No password field of any kind.
- **Storage:** one key, `tulf-switches`, a string of JSON such as `{"hospital":true,"abroad":true,"jail":true}`. Nothing saved, or a value that won't parse: all three on.
- **Torn's page:** the script adds one `<style>` (`tulf-styles`), the bar (`tulf-bar`), its class `tulf-hidden` on the rows it hides (and on TornTools' lines under them), and the mark `data-tulf` on `<html>`. It never removes, moves or clicks anything of Torn's, never loads a page and never calls the API.
- **Text:** all text in the bar is the script's own; nothing from the page goes in it.
- **Comments:** clear `//` lines in the file's own style, with no version crumbs. Version notes go only in the CHANGELOG.
- **The repo is public:** no keys, key endings, player ids or member data in code, tests, plan or commits, and nothing from the live check's output. That stays in this plan's git-ignored workspace.
- **Served files** are `warboard:warboard 644`.
- **The script and its test file reach the main checkout together,** in the release's fast-forward. The test file's default `SRC` is the served path, `/opt/warboard/server/public/scripts/torn-userlist-filter.user.js`, which doesn't exist until then.
  - In the worktree, only `T` (which sets `TULF_SRC`) runs, never a bare `node --test`: the whole suite there would fail this file for want of the served script.
  - The whole suite runs once, in `/opt/warboard/server`, after the fast-forward.
- **Commits** name only this plan's paths: `git add -- <new paths>`, then `git commit -- <paths>`. Trailer: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **Torn's rules for the live check:** it reads one page that the owner opened (with a watcher that only reads the changes Torn makes to it), and only if asked, Torn's API: at most 30 calls, 3 s apart, on the owner's key, and only while warboard's own use of that key is under 50 a minute. Nothing on Torn is clicked or loaded for it.

## Review Focus

1. **TornTools on the same page.** Its own user-list filter hides rows with `tt-hidden`. Its stats estimate and last-action lines sit under the rows, and may come after the script's check. Its filter box goes where this bar goes. A row either one hides stays hidden, TornTools' lines go and come back with their row, the count leaves TornTools' hidden rows out, and the two boxes sit one above the other. Tests: "TornTools' lines under a hidden row (its stats estimate and last action) are hidden with it; a showing row's stay" (Task 1); "rows another script hides are hidden by this one too when of a kind switched on, but never counted", "TornTools' lines come back with their row when its switch goes off" and "the bar is put in place once: a box another script puts between it and the title bar stays there" (Task 2); "a TornTools line Torn or TornTools adds later under a hidden row is hidden too" (Task 3).
2. **Torn reshaping the page:** the next page, a new search or sort order, the list or its wrapper replaced whole, the title bar redrawn with the bar in it, no wrapper, and the list not on the page yet. Every row Torn puts in is checked before the page is drawn, and the bar comes back before the title bar. Tests: Task 3's first six.
3. **Icons that mislead:** ids that start alike (`icon1`, `icon150`, `icon15x`), known numbers whose labels say hospital or jail (70 Federal jail, 82 early discharge), a number not in the table, Torn's HTML in titles, a label on a link inside the icon, and the icon that counts not being the row's first. A row is hidden only for 15, 91, 16 or 71, or for an unknown number whose label starts with the kind. Tests: Task 1's "icons 15 and 91 count as hospital, 16 as jail and 71 as abroad...", "70 (federal jail), 82 (early discharge) and other known numbers alone hide nothing, whatever their labels say", "the whole number is read, up to a _ or the end of the id...", "an icon whose number is not known counts by how its label starts..." and "every icon in the row counts, the first or the last, shown or not".
4. **Storage that misbehaves:** values that come back as strings (PDA) or as objects, that won't parse or aren't objects, a save that throws (a full localStorage), a read that throws, and no GM functions at all. All three switches read on, and a switch still works on the page. Tests: Task 2's last four.
5. **The script's own changes reaching its watcher:** hiding rows (a class), writing the count and placing the bar. None may set off another check, or the script would run on a loop. Tests: "it watches for rows added and removed only, never attribute or text changes" and "the script's own changes (hiding rows, the count, the bar) set off no more checks" (Task 3), and mutants M3 and M5.

## Rulings made at plan time

1. **Checks run in the watcher's callback, never on a timer.** A MutationObserver's callback runs after Torn's change and before the page is drawn, so a hidden row never shows for a frame. Mutant M28 (a 50 ms timer) must fail.
2. **Each check ends with `observer.takeRecords()`,** which drops the records of its own changes (the count's text, the bar put in place). With attributes not watched, this is how "the script's own changes never set off another check" holds.
3. **The script watches from one level above the list's wrapper** (or above the list's parent, when there is no wrapper), not the wrapper itself as the spec says. If Torn replaces the wrapper whole, a watcher on the old one hears nothing more and the filter goes deaf; one level up hears the new wrapper and everything under it. The spec's "If Torn replaces the whole list, the new list is checked the same way" is what this keeps. Cost: other changes in that box also set off a check, each one pass over the rows on the page.
4. **TornTools' lines go with their row.** Its stats estimate and last action (`div.tt-stats-estimate`, `div.tt-last-action`) sit right after a row, inside the list. Left showing under a hidden row, they would read as the next row's.
5. **The bar is placed once,** and again only when it is gone from the page, so it never fights another script (TornTools' filter box) for the spot.
6. **The count is blank while the page has no rows** (Torn still loading, or no results). The spec gives wording only for pages with rows.
7. **One row alone has its own wording:** "The 1 on this page is hidden." rather than "All 1 on this page are hidden."
8. **Hidden by another script** means the row's `hidden` attribute, an inline `display: none`, or TornTools' `tt-hidden` class. Another script's stylesheet rule isn't seen, because the script reads no computed styles. Such a row is still hidden by this script when it is of a kind switched on, so it stays hidden if the other script lets it go.
9. **Labels:** the `aria-label` or `title` on the icon, or else on the first thing inside it with one; tags taken out; matched at the start, in any letter case: "Hospital", "Jail", "Traveling" or "Abroad". TornTools' table has no 77 (nor 14, 69 or 88), so 77 goes by its label too.
10. **An id with "icon" and no number is no icon.**
11. **`@run-at document-end`:** the script needs the body to watch. The list may be on the page by then or come later, and both are covered.
12. **The count can go stale when another script hides a row later,** because attributes aren't watched (the spec's choice). The next change Torn makes counts again.
13. **The test harness is written whole in Task 1,** so the file reads top-down. Its MutationObserver is linkedom's, made to act as a browser's: it drops attribute records that weren't asked for, and never calls back with no records.
14. **The header, the description and the CHANGELOG are final from Task 1.** Nothing is served before Task 4.
15. **The mutant check and the live check's tools stay in this plan's git-ignored workspace,** never committed. So does the live check's output, which holds other players' names and ids.
16. **The work is in a git worktree** on branch `torn-userlist-filter`, inside this plan's workspace, because the main checkout is what tornwar.com serves. Each task commits there. Task 4 fast-forwards main.
17. **The final review runs between Task 3 and Task 4,** so nothing unreviewed is served. The live check runs after the review's fix pass, on the script as it will ship.

## Files

- Create: `server/public/scripts/torn-userlist-filter.user.js` (Task 1; edited in Tasks 2 and 3).
- Create: `server/public/scripts/torn-userlist-filter.meta.js` (Task 1).
- Create: `server/torn-userlist-filter.test.mjs` (Task 1; extended in Tasks 2 and 3).
- Modify: `docs/superpowers/specs/2026-10-25-torn-userlist-filter-design.md`, its Status line only, in this plan's own commit.
- Outside the repo, in the workspace `/opt/warboard/.superpowers/sdd/2026-10-25-torn-userlist-filter/` (git-ignored):
  - `mutants.mjs` and `mut/`: the mutant check (Task 3);
  - `live/probe.js` and `live/live.mjs`: the live check (Task 4), and `live/*.json`, what it found;
  - `suite.log`: the whole suite's output (Task 4).

## Paths and commands

- **`W` is the workspace,** `/opt/warboard/.superpowers/sdd/2026-10-25-torn-userlist-filter`. **`WT` is the worktree,** `$W/wt`. Every command sets them, because shell variables don't carry from one command to the next.
- **The superpowers scripts** (`task-start`, `task-done`, `review-package`) run from inside `$WT`, so their `git rev-parse HEAD` is the branch's. Their ledger and briefs live in the worktree's own git-ignored `.superpowers/sdd/`.
- **The symlink:** `server/node_modules` in the worktree is a symlink to the main checkout's. Git sees it as untracked (`server/.gitignore` has `node_modules/`, which matches directories only), so commits always name their paths and never use `git add -A`.
- **`T`, the test run:**

```bash
WT=/opt/warboard/.superpowers/sdd/2026-10-25-torn-userlist-filter/wt; cd "$WT/server" && TULF_SRC="$WT/server/public/scripts/torn-userlist-filter.user.js" node --test torn-userlist-filter.test.mjs 2>&1 | grep -E "^# (tests|pass|fail) " | paste -sd" " -
```

- **`C`, the source check** (it parses, and it is plain ASCII):

```bash
WT=/opt/warboard/.superpowers/sdd/2026-10-25-torn-userlist-filter/wt; F="$WT/server/public/scripts/torn-userlist-filter.user.js"; node --check "$F" && LC_ALL=C grep -c '[^ -~]' "$F" | grep -qx 0 && echo ascii-ok
```

## Setup (before Task 1)

- [ ] **Check the load and the workspace's files.** They were put there at plan time, and the hashes are theirs:

```bash
uptime; W=/opt/warboard/.superpowers/sdd/2026-10-25-torn-userlist-filter; cd "$W" && sha256sum mutants.mjs live/probe.js live/live.mjs
```

Expected: load under 12, then:

```
b0793b932df31adb5bd86198e0786194cd96b023f59c80f714b132868f62948d  mutants.mjs
df8586a3583d798267dc457dbd4e6edeca9cda8f22e8aee8863bf6a2e9b74d48  live/probe.js
ecd157e8b9f4e37876b3de2cded35fb8818eda3252519e1b277c930d42471810  live/live.mjs
```

- If the load is over 12, wait.
- If a file is missing or its hash differs, write it again from its block (Task 3 Step 5, Task 4 Step 1) and check the hash again.

- [ ] **Make the worktree** from this plan's commit on main:

```bash
WT=/opt/warboard/.superpowers/sdd/2026-10-25-torn-userlist-filter/wt; cd /opt/warboard && git worktree add "$WT" -b torn-userlist-filter main && ln -s /opt/warboard/server/node_modules "$WT/server/node_modules" && git -C "$WT" log --format='%h %s' -1 && git -C "$WT" status --short && cd "$WT/server" && node -e "import('linkedom').then(() => console.log('linkedom-ok'))"
```

Expected: the branch's tip is this plan's commit; status shows only `?? server/node_modules`; then `linkedom-ok`. There is no baseline run: the script and its tests don't exist yet.

---

### Task 1: Who is where, and hiding

**Files:**
- Create: `server/public/scripts/torn-userlist-filter.user.js`
- Create: `server/public/scripts/torn-userlist-filter.meta.js`
- Create (tests): `server/torn-userlist-filter.test.mjs`

**Interfaces:**
- Consumes: nothing; the script is new.
- Produces, inside the script's one function (later tasks use these names):
  - `VERSION`, `root` (`document.documentElement`), `STYLE_ID = 'tulf-styles'`, `HIDDEN_CLASS = 'tulf-hidden'`, `LIST = 'ul.user-info-list-wrap'`, `KINDS` (`['hospital', 'abroad', 'jail']`), `KNOWN`, `BY_NUMBER`, `BY_LABEL`, `TT_LINES`;
  - `iconNumber(el) -> number` (0 for none), `known(n) -> boolean`, `labelOf(el) -> string`, `kindOf(el) -> 'hospital' | 'abroad' | 'jail' | ''`, `kindsOf(row) -> Set`, `rows() -> li[]`;
  - `setHidden(row, hide)`, `isTornToolsLine(el) -> boolean`, `CSS`, `check()`, and `switches` (`{ hospital, abroad, jail }`, all `true` for now), `style`.
- Produces, in the test file (Tasks 2 and 3 add their tests at its end and use these):
  - `page(options) -> w`, the search page with the script on it: `w.run()`, `w.list()`, `w.bar()`, `w.newPage(html)`, `w.replaceList(html)`, `w.document`, `w.store`, `w.logs`, `w.observed`, `w.deliveries`;
  - `icon(n, options)`, `row(name, icons, options)`, `pageHtml(options)`, `settle()`, `attr(text)`, `matching(w, declaration)`, `rowName(li)`, `hiddenRows(w)`, `showingRows(w)`, `barOf(w)`, `count(w)`, `switchesOf(w)`, `flip(w, name, on)`;
  - `SRC`, `META`, `SEARCH`, `BAR`, `STORE`, `RUNNING`, `TITLES`, `ROWS`, `PLACEHOLDER`, `TITLE`.

- [ ] **Step 1: Write the failing tests.** Create `server/torn-userlist-filter.test.mjs`:

```js
// Torn User List Filter: hides people in hospital, in jail or abroad from Torn's user list search.
// These tests load the real script into hand-built copies of the search page, with the address,
// GM storage, the console and the MutationObserver under their control.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseHTML } from 'linkedom';

// TULF_SRC lets a mutant copy be tested in place of the served file.
const SRC = process.env.TULF_SRC || '/opt/warboard/server/public/scripts/torn-userlist-filter.user.js';
const META = SRC.replace(/\.user\.js$/, '.meta.js');
// The owner's search, as Torn's address has it.
const SEARCH = '?sid=UserList&orderBy=name&orderDirection=asc&levelFrom=75&lastAction=7&searchConditionNot=true&searchConditions=inFederalJail';
const BAR = 'tulf-bar';
const STORE = 'tulf-switches';
const RUNNING = '[Torn User List Filter 1.0.0] running';

// Text for an HTML attribute.
function attr(text) {
  return text.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// One of Torn's status icons in a row: an li whose id is "icon", its number and a hash, with
// Torn's title (which holds HTML). id, title, label (an aria-label) and inner (an aria-label on
// a link inside it) change it.
function icon(n, { id, title, label, inner } = {}) {
  const t = title === undefined ? '<b>' + (TITLES[n] || 'Icon') + '</b><br>Details' : title;
  return '<li id="' + (id || 'icon' + n + '___x7a') + '"' + (t ? ' title="' + attr(t) + '"' : '')
    + (label ? ' aria-label="' + attr(label) + '"' : '') + '>'
    + (inner ? '<a href="#" aria-label="' + attr(inner) + '"></a>' : '') + '</li>';
}
const TITLES = { 1: 'Online', 9: 'Faction member', 15: 'Hospital', 16: 'Jail', 62: 'Idle', 70: 'Federal jail',
  71: 'Traveling', 82: 'Hospital early discharge', 91: 'Hospital radiation poisoning' };

// A row of results, as Torn draws it: a name link, the level and the row's icons. The ids in
// the links are made up.
let nextId = 1000001;
function row(name, icons, { cls = '', hidden = false, style = '' } = {}) {
  return '<li' + (cls ? ' class="' + cls + '"' : '') + (hidden ? ' hidden' : '') + (style ? ' style="' + style + '"' : '') + '>'
    + '<div class="expander clearfix"><a class="user name" href="/profiles.php?XID=' + (nextId++) + '"><span>' + name + '</span></a>'
    + '<span class="level"><span class="label">Level:</span><span class="value">80</span></span>'
    + '<ul id="iconTray" class="big svg singleicon">' + icons.join('') + '</ul></div></li>';
}

// The rows most tests use: one of each, named for what they are. Online (1) comes first, so the
// icon that counts is never the row's first.
const ROWS = [
  row('okay', [icon(1), icon(9)]),
  row('hospital', [icon(1), icon(15)]),
  row('radiation', [icon(1), icon(91)]),
  row('jail', [icon(1), icon(16)]),
  row('flying', [icon(1), icon(71)]),
  row('federal', [icon(1), icon(70)]),
  row('discharge', [icon(1), icon(82)]),
].join('');
// Torn's loading placeholder, an li with no name link in it.
const PLACEHOLDER = '<li><span class="ajax-placeholder"></span></li>';
const TITLE = '<div class="users-list-title title-black top-round m-top10"><span>Name</span><span>Level</span><span>Icons</span></div>';

// The search page: Torn's wrapper, the title bar and the list. With wrapper: false the list sits in
// a plain box, and with title: false there is no title bar. list: false leaves the wrapper out
// too, as before Torn has put the results on the page.
function pageHtml({ rows = ROWS, wrapper = true, title = true, list = true } = {}) {
  if (!list) return '<div class="content-wrapper"><div class="content-title">Advanced Search</div></div>';
  const inner = (title ? TITLE : '') + '<ul class="user-info-list-wrap bottom-round cont-gray">' + rows + '</ul>';
  return '<div class="content-wrapper"><div class="content-title">Advanced Search</div>'
    + (wrapper ? '<div class="userlist-wrapper">' + inner + '</div>' : '<div class="results">' + inner + '</div>') + '</div>';
}

// Lets MutationObserver records reach the script.
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

// The search page with the script on it. The test controls the address (search), GM storage
// (store; getValue and setValue change how reads and writes go, and gm: false takes the GM
// functions away), the console (w.logs) and the MutationObserver: linkedom's, made to act as a
// browser's. It drops attribute records unless they were asked for, and never calls back with no
// records. w.observed lists what was watched and how, and w.deliveries counts the call-backs.
function page({ search = SEARCH, store = {}, getValue, setValue, gm = true, ...html } = {}) {
  const dom = parseHTML('<!doctype html><html><head></head><body>' + pageHtml(html) + '</body></html>');
  const doc = dom.document;
  const w = { document: doc, store, logs: [], observed: [], deliveries: 0 };
  class BrowserObserver {
    constructor(callback) {
      this.attributes = false;
      this.real = new dom.MutationObserver((records) => {
        const kept = records.filter((r) => r.type !== 'attributes' || this.attributes);
        if (!kept.length) return;
        w.deliveries += 1;
        callback(kept, this);
      });
    }
    observe(target, options) {
      w.observed.push({ target, options: { ...options } });
      this.attributes = !!(options.attributes || options.attributeFilter || options.attributeOldValue);
      this.real.observe(target, options);
    }
    disconnect() { this.real.disconnect(); }
    takeRecords() { return this.real.takeRecords(); }
  }
  w.run = () => {
    new Function('document', 'location', 'MutationObserver', 'GM_getValue', 'GM_setValue', 'console', readFileSync(SRC, 'utf8'))(
      doc, { search, href: 'https://www.torn.com/page.php' + search },
      BrowserObserver,
      gm ? (getValue || ((k, d) => (Object.prototype.hasOwnProperty.call(store, k) ? store[k] : d))) : undefined,
      gm ? (setValue ? (k, v) => setValue(store, k, v) : (k, v) => { store[k] = v; }) : undefined,
      { log: (...a) => w.logs.push(a.join(' ')), warn: (...a) => w.logs.push(a.join(' ')), error: (...a) => w.logs.push(a.join(' ')) });
    return w;
  };
  w.list = () => doc.querySelector('ul.user-info-list-wrap');
  w.bar = () => doc.getElementById(BAR);
  // Torn putting a new page of results in the list.
  w.newPage = (html) => { w.list().innerHTML = html; };
  // Torn replacing the whole list with a new one.
  w.replaceList = (html) => {
    const old = w.list();
    const ul = doc.createElement('ul');
    ul.className = old.className;
    ul.innerHTML = html;
    old.parentNode.replaceChild(ul, old);
  };
  return w;
}

// The selectors of the script's rules with this declaration, and every element they apply to.
function matching(w, declaration) {
  const style = w.document.getElementById('tulf-styles');
  if (!style) return new Set();
  const selectors = style.textContent.split('}').filter((rule) => rule.includes(declaration)).map((rule) => rule.split('{')[0].trim());
  return new Set(selectors.flatMap((selector) => [...w.document.querySelectorAll(selector)]));
}

// The names of the rows the script hides, and of those that show, in order.
function rowName(li) {
  return li.querySelector('.user.name').textContent;
}
function hiddenRows(w) {
  const gone = matching(w, 'display: none');
  return [...w.document.querySelectorAll('ul.user-info-list-wrap > li')].filter((li) => li.querySelector('.user.name') && gone.has(li)).map(rowName);
}
function showingRows(w) {
  const gone = matching(w, 'display: none');
  return [...w.document.querySelectorAll('ul.user-info-list-wrap > li')].filter((li) => li.querySelector('.user.name') && !gone.has(li)).map(rowName);
}

// The bar, which must be on the page.
function barOf(w) {
  const bar = w.bar();
  assert.ok(bar, 'the bar is on the page');
  return bar;
}

// The bar's count: the text after its switches.
function count(w) {
  return barOf(w).lastElementChild.textContent;
}

// The bar's switches, by name: { name: checked }.
function switchesOf(w) {
  const out = {};
  barOf(w).querySelectorAll('label').forEach((label) => { out[label.textContent.trim()] = label.querySelector('input').checked; });
  return out;
}

// Clicks a switch in the bar: it turns to on, and the change event fires, as a click does.
function flip(w, name, on) {
  const label = [...barOf(w).querySelectorAll('label')].find((l) => l.textContent.trim() === name);
  assert.ok(label, 'a switch named ' + name);
  const box = label.querySelector('input');
  box.checked = on;
  box.dispatchEvent(new w.document.defaultView.Event('change', { bubbles: true }));
}

// ---------------------------------------------------------------------------------------------
// The source
// ---------------------------------------------------------------------------------------------

test('the header is the spec\'s, and the meta file is the header and a newline', () => {
  const src = readFileSync(SRC, 'utf8');
  const end = '// ==/UserScript==';
  const header = src.slice(0, src.indexOf(end) + end.length) + '\n';
  assert.equal(readFileSync(META, 'utf8'), header);
  const tags = header.split('\n').filter((l) => l.startsWith('// @')).map((l) => l.slice(4).replace(/\s+/, ' '));
  assert.deepEqual(tags, [
    'name Torn User List Filter',
    'namespace RussianRob',
    'version 1.0.0',
    'description Hides people in hospital, in jail or abroad (in flight or landed) from Torn\'s user list search, with a switch for each above the list.',
    'author RussianRob',
    'downloadURL https://tornwar.com/scripts/torn-userlist-filter.user.js',
    'updateURL https://tornwar.com/scripts/torn-userlist-filter.meta.js',
    'license All Rights Reserved',
    'match https://www.torn.com/page.php*',
    'run-at document-end',
    'grant GM_getValue',
    'grant GM_setValue',
  ]);
  assert.match(src, /\n  const VERSION = '1\.0\.0';\n/);
  assert.match(src, /\n\/\/ CHANGELOG\n/);
  assert.match(src, /\n\/\/ v1\.0\.0  - First release\./);
});

test('the source is plain ASCII, guards every GM_* call, and has no PDA key placeholder, password field or HTML put in', () => {
  const src = readFileSync(SRC, 'utf8');
  assert.equal(/[^\x00-\x7f]/.test(src), false, 'plain ASCII');
  const lines = src.split('\n');
  lines.forEach((line, i) => {
    if (line.trim().startsWith('//')) return;
    for (const m of line.matchAll(/\b(GM_\w+)\(/g)) {
      const guard = 'typeof ' + m[1];
      assert.ok(line.includes(guard) || (lines[i - 1] || '').includes(guard), 'line ' + (i + 1) + ' guards ' + m[1]);
    }
  });
  assert.equal(src.includes('###PDA-APIKEY###'), false);
  assert.equal(/password/i.test(src), false);
  assert.equal(/innerHTML|outerHTML|insertAdjacentHTML|document\.write/.test(src), false);
});

// ---------------------------------------------------------------------------------------------
// Where it runs
// ---------------------------------------------------------------------------------------------

test('it runs on page.php?sid=UserList in any letter case, and says so once in the console', () => {
  for (const search of [SEARCH, '?sid=userlist', '?SID=USERLIST&levelFrom=75', '?levelFrom=75&sid=UserList']) {
    const w = page({ search }).run();
    assert.equal(w.document.documentElement.getAttribute('data-tulf'), '1.0.0', search);
    assert.deepEqual(hiddenRows(w), ['hospital', 'radiation', 'jail', 'flying'], search);
    assert.deepEqual(w.logs, [RUNNING], search);
  }
});

test('it does nothing on Torn\'s other page.php pages, nor on the page that loads the results (sid=UserListAjax)', () => {
  for (const search of ['?sid=UserListAjax', '?sid=UserList2', '?sid=hof', '?q=sid=UserList', '']) {
    const w = page({ search }).run();
    assert.equal(w.document.documentElement.hasAttribute('data-tulf'), false, search);
    assert.equal(w.document.querySelectorAll('style').length, 0, search);
    assert.deepEqual(hiddenRows(w), [], search);
    assert.deepEqual(w.logs, [], search);
  }
});

test('loaded twice on one page, it runs once', () => {
  const w = page().run();
  w.run();
  assert.equal(w.document.querySelectorAll('style').length, 1);
  assert.deepEqual(w.logs, [RUNNING]);
  assert.deepEqual(hiddenRows(w), ['hospital', 'radiation', 'jail', 'flying']);
});

// ---------------------------------------------------------------------------------------------
// Telling who is where
// ---------------------------------------------------------------------------------------------

test('icons 15 and 91 count as hospital, 16 as jail and 71 as abroad: with every switch on, those rows are hidden and the rest show', () => {
  const w = page().run();
  assert.deepEqual(hiddenRows(w), ['hospital', 'radiation', 'jail', 'flying']);
  assert.deepEqual(showingRows(w), ['okay', 'federal', 'discharge']);
});

test('70 (federal jail), 82 (early discharge) and other known numbers alone hide nothing, whatever their labels say', () => {
  const w = page({ rows: [
    row('federal', [icon(70, { title: '<b>Jail</b>', label: 'Jail' })]),
    row('discharge', [icon(82, { title: '<b>Hospital</b>', label: 'Hospital' })]),
    row('idle', [icon(62, { title: 'Traveling', label: 'Abroad' })]),
  ].join('') }).run();
  assert.deepEqual(hiddenRows(w), []);
  assert.deepEqual(showingRows(w), ['federal', 'discharge', 'idle']);
});

test('the whole number is read, up to a _ or the end of the id: icon1, icon150 and icon15x are not icon 15', () => {
  const w = page({ rows: [
    row('one', [icon(1, { id: 'icon1___x7a', title: '<b>Online</b>' })]),
    row('one-fifty', [icon(150, { id: 'icon150___x7a', title: '<b>Online</b>' })]),
    row('fifteen-x', [icon(15, { id: 'icon15x', title: '<b>Online</b>' })]),
    row('fifteen', [icon(15, { id: 'icon15', title: '<b>Online</b>' })]),
  ].join('') }).run();
  assert.deepEqual(hiddenRows(w), ['fifteen']);
});

test('an icon whose number is not known counts by how its label starts, in any letter case, with Torn\'s tags taken out', () => {
  const w = page({ rows: [
    row('hosp-title', [icon(14, { title: '<b>Hospital</b><br>Attacked by someone' })]),
    row('jail-label', [icon(69, { title: '', label: 'jail: 3 hours' })]),
    row('travel', [icon(88, { title: 'TRAVELING to Mexico' })]),
    row('abroad', [icon(150, { title: '<b>Abroad</b><br>In Japan' })]),
    row('inner', [icon(200, { title: '', inner: 'Hospital: 2 hours' })]),
    row('mid-word', [icon(201, { title: 'Left hospital an hour ago' })]),
    row('no-label', [icon(202, { title: '' })]),
  ].join('') }).run();
  assert.deepEqual(hiddenRows(w), ['hosp-title', 'jail-label', 'travel', 'abroad', 'inner']);
  assert.deepEqual(showingRows(w), ['mid-word', 'no-label']);
});

test('every icon in the row counts, the first or the last, shown or not', () => {
  const w = page({ rows: [
    row('last', [icon(1), icon(9), icon(62), icon(16)]),
    row('first', [icon(71), icon(1)]),
  ].join('') }).run();
  assert.deepEqual(hiddenRows(w), ['last', 'first']);
});

test('TornTools\' lines under a hidden row (its stats estimate and last action) are hidden with it; a showing row\'s stay', () => {
  const w = page({ rows: row('okay', [icon(1)]) + '<div class="tt-stats-estimate">Stats Estimate: 1</div>'
    + row('hospital', [icon(15)]) + '<div class="tt-stats-estimate">Stats Estimate: 2</div><div class="tt-last-action">Last action: 3</div>'
    + row('also-okay', [icon(1)]) + '<div class="tt-last-action">Last action: 4</div>' }).run();
  const gone = matching(w, 'display: none');
  const lines = [...w.document.querySelectorAll('.tt-stats-estimate, .tt-last-action')].map((el) => gone.has(el));
  assert.deepEqual(lines, [false, true, true, false]);
  assert.deepEqual(hiddenRows(w), ['hospital']);
});
```

- [ ] **Step 2: Run them to see them fail.** Run `T`.

Expected: `# tests 11 # pass 0 # fail 11`. Every test fails with ENOENT, because the script doesn't exist yet.

- [ ] **Step 3: Write the script.** Create `server/public/scripts/torn-userlist-filter.user.js`:

```js
// ==UserScript==
// @name         Torn User List Filter
// @namespace    RussianRob
// @version      1.0.0
// @description  Hides people in hospital, in jail or abroad (in flight or landed) from Torn's user list search, with a switch for each above the list.
// @author       RussianRob
// @downloadURL  https://tornwar.com/scripts/torn-userlist-filter.user.js
// @updateURL    https://tornwar.com/scripts/torn-userlist-filter.meta.js
// @license      All Rights Reserved
// @match        https://www.torn.com/page.php*
// @run-at       document-end
// @grant        GM_getValue
// @grant        GM_setValue
// ==/UserScript==

// =============================================================================
// CHANGELOG
// =============================================================================
// v1.0.0  - First release. Hides people in hospital, in jail or abroad (in flight
//           or landed) from Torn's user list search, with a switch for each kind
//           and a count of the rows hidden, in a bar above the list.

(function () {
  'use strict';

  const VERSION = '1.0.0';

  // Torn's user list search only: page.php?sid=UserList, in any letter case. @match takes every
  // page.php, because hosts read a "?" in @match differently. Torn fetches each page of results
  // from page.php with sid=UserListAjax, which is not this page.
  if (!/[?&]sid=userlist(?:&|$)/i.test(location.search)) return;

  // Loaded twice on one page (two copies installed, or PDA injecting it again), it runs once.
  // The mark goes on the page itself, which every copy can see.
  const root = document.documentElement;
  if (root.hasAttribute('data-tulf')) return;
  root.setAttribute('data-tulf', VERSION);

  const STYLE_ID = 'tulf-styles';
  // A row the script hides gets this class, which its own stylesheet hides.
  const HIDDEN_CLASS = 'tulf-hidden';
  // Torn's list of results. Each row is an li straight under it.
  const LIST = 'ul.user-info-list-wrap';
  // The three kinds.
  const KINDS = ['hospital', 'abroad', 'jail'];
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
  // TornTools' lines under a row (its stats estimate and last action) go with the row.
  const TT_LINES = ['tt-stats-estimate', 'tt-last-action'];

  // ===== WHO IS WHERE =====

  // The number in an icon's id: "icon15___" and a hash is 15. Every digit is read, up to a _ or
  // the end, so icon150 is never read as icon15, nor icon15 as icon1. 0 when there is none.
  function iconNumber(el) {
    const m = /^icon(\d+)(?:_|$)/.exec(el.id);
    return m ? Number(m[1]) : 0;
  }

  function known(n) {
    return KNOWN.some(([from, to]) => n >= from && n <= to);
  }

  // An icon's label: its aria-label or title, or else those of the first thing inside it that
  // has one, with any tags taken out (Torn's titles hold HTML, such as <b>Hospital</b><br>...).
  function labelOf(el) {
    const holder = el.matches('[aria-label], [title]') ? el : el.querySelector('[aria-label], [title]');
    if (!holder) return '';
    return (holder.getAttribute('aria-label') || holder.getAttribute('title') || '').replace(/<[^>]*>/g, ' ').trim();
  }

  // The kind an icon tells of: 'hospital', 'abroad' or 'jail', or '' for none.
  function kindOf(el) {
    const n = iconNumber(el);
    if (!n) return '';
    if (known(n)) return BY_NUMBER[n] || '';
    const label = labelOf(el);
    const hit = BY_LABEL.find(([re]) => re.test(label));
    return hit ? hit[1] : '';
  }

  // The kinds a row's icons tell of. Every icon in the row counts, shown or not.
  function kindsOf(row) {
    const kinds = new Set();
    row.querySelectorAll('li[id^="icon"]').forEach((el) => {
      const kind = kindOf(el);
      if (kind) kinds.add(kind);
    });
    return kinds;
  }

  // Torn's rows of results: each li straight under the list with a name link in it. Torn's
  // loading placeholder and a "no results" line have none.
  function rows() {
    return [...document.querySelectorAll(LIST + ' > li')].filter((li) => li.querySelector('.user.name'));
  }

  // ===== HIDING =====

  // Hides or shows a row, and TornTools' lines under it with it. classList.toggle with a second
  // argument changes nothing when the class is already as asked.
  function setHidden(row, hide) {
    row.classList.toggle(HIDDEN_CLASS, hide);
    for (let next = row.nextElementSibling; next && isTornToolsLine(next); next = next.nextElementSibling) {
      next.classList.toggle(HIDDEN_CLASS, hide);
    }
  }

  function isTornToolsLine(el) {
    return TT_LINES.some((name) => el.classList.contains(name));
  }

  // ===== THE STYLESHEET =====

  // The class that hides a row.
  const CSS = [
    '.' + HIDDEN_CLASS + ' { display: none !important; }',
  ].join('\n');

  // ===== THE CHECK =====

  // Hides the rows of each kind switched on and shows the rest.
  function check() {
    try {
      rows().forEach((row) => {
        const kinds = kindsOf(row);
        setHidden(row, KINDS.some((kind) => switches[kind] && kinds.has(kind)));
      });
    } catch (e) {
      // A surprise in Torn's page stops this one check. It never breaks the page.
    }
  }

  // ===== START =====

  // For now, every kind is hidden.
  const switches = { hospital: true, abroad: true, jail: true };
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = CSS;
  (document.head || root).appendChild(style);
  check();
  console.log('[Torn User List Filter ' + VERSION + '] running');
})();
```

- [ ] **Step 4: Write the meta file:** the header, byte for byte, then a newline.

```bash
WT=/opt/warboard/.superpowers/sdd/2026-10-25-torn-userlist-filter/wt; cd "$WT/server/public/scripts" && sed -n '1,/^\/\/ ==\/UserScript==$/p' torn-userlist-filter.user.js > torn-userlist-filter.meta.js && chmod 644 torn-userlist-filter.user.js torn-userlist-filter.meta.js && wc -l torn-userlist-filter.meta.js
```

Expected: `14 torn-userlist-filter.meta.js`.

- [ ] **Step 5: Run the tests to see them pass.** Run `T`, then `C`.

Expected: `# tests 11 # pass 11 # fail 0`, then `ascii-ok`.

- [ ] **Step 6: Commit.**

```bash
WT=/opt/warboard/.superpowers/sdd/2026-10-25-torn-userlist-filter/wt; cd "$WT" && git add -- server/public/scripts/torn-userlist-filter.user.js server/public/scripts/torn-userlist-filter.meta.js server/torn-userlist-filter.test.mjs && git commit -q -m "torn-userlist-filter: a new script that hides the people in hospital, in jail or abroad from Torn's user list search" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- server/public/scripts/torn-userlist-filter.user.js server/public/scripts/torn-userlist-filter.meta.js server/torn-userlist-filter.test.mjs && git log --format='%h %s' -1 && git status --short
```

Expected: the commit, then only `?? server/node_modules`.

---

### Task 2: The bar, the switches and storage

**Files:**
- Modify: `server/public/scripts/torn-userlist-filter.user.js`
- Modify (tests): `server/torn-userlist-filter.test.mjs`

**Interfaces:**
- Consumes, from Task 1: `check()`, `rows()`, `kindsOf(row)`, `setHidden(row, hide)`, `switches`, `KINDS`, `LIST`, `CSS`, `HIDDEN_CLASS`, `STYLE_ID`, `root`, `style`, and the test file's helpers, all as named in Task 1.
- Produces, inside the script (Task 3 uses `check()`, `bar` and `safely`):
  - `BAR_ID = 'tulf-bar'`, `NAMES`, `STORE = 'tulf-switches'`;
  - `gmGet(name) -> stored value or ''`, `gmSet(name, value)`, `readJson(name) -> value or null`, `readSwitches() -> { hospital, abroad, jail }`;
  - `hiddenByOthers(row) -> boolean`, `buildBar() -> the bar`, `placeBar()`, `showCount(total, hidden)`, `flip(kind, on)`, `safely(handler) -> handler`;
  - `bar`, and a `check()` that also places the bar and writes the count.

- [ ] **Step 1: Write the failing tests.** Add at the end of `server/torn-userlist-filter.test.mjs`, after a blank line:

```js
// ---------------------------------------------------------------------------------------------
// The bar
// ---------------------------------------------------------------------------------------------

test('the bar sits right before the list\'s title bar, with a switch for each kind, all on, and the count', () => {
  const w = page().run();
  const title = w.document.querySelector('.users-list-title');
  assert.equal(barOf(w).nextElementSibling, title);
  assert.equal(barOf(w).firstElementChild.textContent, 'Hide:');
  assert.deepEqual(switchesOf(w), { Hospital: true, Abroad: true, Jail: true });
  assert.deepEqual(Object.keys(switchesOf(w)), ['Hospital', 'Abroad', 'Jail']);
  assert.equal(count(w), '4 of 7 hidden on this page');
});

test('with no title bar, the bar sits right before the list; with no wrapper too, before the list in its box', () => {
  for (const html of [{ title: false }, { title: false, wrapper: false }]) {
    const w = page(html).run();
    assert.equal(barOf(w).nextElementSibling, w.list(), JSON.stringify(html));
    assert.equal(count(w), '4 of 7 hidden on this page');
  }
});

test('the bar is put in place once: a box another script puts between it and the title bar stays there', () => {
  const w = page().run();
  const other = w.document.createElement('div');
  other.className = 'tt-container';
  w.document.querySelector('.users-list-title').before(other);
  flip(w, 'Hospital', false);
  assert.equal(barOf(w).nextElementSibling, other);
  assert.equal(other.nextElementSibling, w.document.querySelector('.users-list-title'));
});

test('the count leaves out Torn\'s loading placeholder and a no-results line, and says 0 when nothing is hidden', () => {
  const w = page({ rows: PLACEHOLDER + row('okay', [icon(1)]) + row('jail', [icon(16)]) + '<li class="no-results">No users found</li>' }).run();
  assert.equal(count(w), '1 of 2 hidden on this page');
  const none = page({ rows: row('okay', [icon(1)]) + row('idle', [icon(62)]) }).run();
  assert.equal(count(none), '0 of 2 hidden on this page');
});

test('when every row on the page is hidden, the bar says so; one row alone gets its own wording', () => {
  const all = page({ rows: row('hospital', [icon(15)]) + row('jail', [icon(16)]) + row('flying', [icon(71)]) }).run();
  assert.equal(count(all), 'All 3 on this page are hidden.');
  const one = page({ rows: row('hospital', [icon(15)]) }).run();
  assert.equal(count(one), 'The 1 on this page is hidden.');
});

test('a page with no rows (Torn still loading them, or no results) shows the switches and no count', () => {
  const w = page({ rows: PLACEHOLDER }).run();
  assert.deepEqual(switchesOf(w), { Hospital: true, Abroad: true, Jail: true });
  assert.equal(count(w), '');
});

test('nothing from the page goes in the bar: a name with HTML in it stays out', () => {
  const w = page({ rows: row('&lt;b&gt;bold&lt;/b&gt;', [icon(15)]) + row('okay', [icon(1)]) }).run();
  assert.equal(barOf(w).querySelector('b'), null);
  assert.equal(barOf(w).textContent.includes('bold'), false);
});

// ---------------------------------------------------------------------------------------------
// The switches
// ---------------------------------------------------------------------------------------------

test('a switch takes effect at once on the rows on the page, and is saved as a string of JSON', () => {
  const w = page().run();
  flip(w, 'Hospital', false);
  assert.deepEqual(hiddenRows(w), ['jail', 'flying']);
  assert.equal(count(w), '2 of 7 hidden on this page');
  assert.equal(w.store[STORE], '{"hospital":false,"abroad":true,"jail":true}');
  flip(w, 'Abroad', false);
  flip(w, 'Jail', false);
  assert.deepEqual(hiddenRows(w), []);
  assert.equal(count(w), '0 of 7 hidden on this page');
  flip(w, 'Hospital', true);
  assert.deepEqual(hiddenRows(w), ['hospital', 'radiation']);
  assert.equal(w.store[STORE], '{"hospital":true,"abroad":false,"jail":false}');
});

test('the next page load starts from the saved switches', () => {
  const store = {};
  const first = page({ store }).run();
  flip(first, 'Abroad', false);
  const next = page({ store }).run();
  assert.deepEqual(switchesOf(next), { Hospital: true, Abroad: false, Jail: true });
  assert.deepEqual(hiddenRows(next), ['hospital', 'radiation', 'jail']);
});

test('a row of two kinds at once shows only when both its switches are off', () => {
  const w = page({ rows: row('hosp-abroad', [icon(15), icon(71)]) + row('okay', [icon(1)]) }).run();
  flip(w, 'Hospital', false);
  assert.deepEqual(hiddenRows(w), ['hosp-abroad']);
  flip(w, 'Abroad', false);
  assert.deepEqual(hiddenRows(w), []);
  flip(w, 'Hospital', true);
  assert.deepEqual(hiddenRows(w), ['hosp-abroad']);
});

test('TornTools\' lines come back with their row when its switch goes off', () => {
  const w = page({ rows: row('hospital', [icon(15)]) + '<div class="tt-stats-estimate">Stats Estimate: 2</div>' + row('okay', [icon(1)]) }).run();
  flip(w, 'Hospital', false);
  assert.equal(matching(w, 'display: none').has(w.document.querySelector('.tt-stats-estimate')), false);
});

test('rows another script hides are hidden by this one too when of a kind switched on, but never counted', () => {
  const w = page({ rows: [
    row('tt-hospital', [icon(15)], { cls: 'tt-hidden' }),
    row('tt-okay', [icon(1)], { cls: 'tt-hidden' }),
    row('attr-jail', [icon(16)], { hidden: true }),
    row('styled-okay', [icon(1)], { style: 'display: none' }),
    row('hospital', [icon(15)]),
    row('okay', [icon(1)]),
  ].join('') }).run();
  assert.deepEqual(hiddenRows(w), ['tt-hospital', 'attr-jail', 'hospital']);
  assert.equal(count(w), '1 of 2 hidden on this page');
});

// ---------------------------------------------------------------------------------------------
// Stored
// ---------------------------------------------------------------------------------------------

test('saved switches read back as a string, as PDA hands them back, or as the object itself', () => {
  for (const saved of ['{"hospital":true,"abroad":false,"jail":false}', { hospital: true, abroad: false, jail: false }]) {
    const w = page({ store: { [STORE]: saved } }).run();
    assert.deepEqual(switchesOf(w), { Hospital: true, Abroad: false, Jail: false });
    assert.deepEqual(hiddenRows(w), ['hospital', 'radiation']);
  }
});

test('nothing saved, a value that won\'t parse, or one that isn\'t an object: all three on; a kind missing from it is on', () => {
  for (const saved of [undefined, '', 'not json', '42', 'null', '"text"']) {
    const store = saved === undefined ? {} : { [STORE]: saved };
    const w = page({ store }).run();
    assert.deepEqual(switchesOf(w), { Hospital: true, Abroad: true, Jail: true }, String(saved));
  }
  const w = page({ store: { [STORE]: '{"jail":false}' } }).run();
  assert.deepEqual(switchesOf(w), { Hospital: true, Abroad: true, Jail: false });
});

test('a save that storage refuses still takes effect on this page; the next load starts from what was saved before', () => {
  const store = { [STORE]: '{"hospital":true,"abroad":true,"jail":false}' };
  const setValue = () => { throw new Error('QuotaExceededError'); };
  const w = page({ store, setValue }).run();
  assert.doesNotThrow(() => flip(w, 'Hospital', false));
  assert.deepEqual(hiddenRows(w), ['flying']);
  const next = page({ store }).run();
  assert.deepEqual(switchesOf(next), { Hospital: true, Abroad: true, Jail: false });
});

test('storage that throws on reading, or no GM functions at all: all three on, and the switches still work on the page', () => {
  const broken = page({ getValue: () => { throw new Error('no storage'); } }).run();
  assert.deepEqual(switchesOf(broken), { Hospital: true, Abroad: true, Jail: true });
  const bare = page({ gm: false }).run();
  assert.deepEqual(hiddenRows(bare), ['hospital', 'radiation', 'jail', 'flying']);
  flip(bare, 'Jail', false);
  assert.deepEqual(hiddenRows(bare), ['hospital', 'radiation', 'flying']);
});
```

- [ ] **Step 2: Run them to see them fail.** Run `T`.

Expected: `# tests 27 # pass 11 # fail 16`. Each of the 16 new tests fails on an AssertionError, "the bar is on the page": there is no bar yet. Task 1's 11 still pass.

- [ ] **Step 3: Edit the script.** In `server/public/scripts/torn-userlist-filter.user.js`, eight edits, in this order:

**Edit 2.1: The bar's id.** Replace:

```js
  const STYLE_ID = 'tulf-styles';
  // A row the script hides
```

With:

```js
  const STYLE_ID = 'tulf-styles';
  const BAR_ID = 'tulf-bar';
  // A row the script hides
```

**Edit 2.2: The kinds' names in the bar, and the storage key.** Replace:

```js
  // The three kinds.
  const KINDS = ['hospital', 'abroad', 'jail'];
```

With:

```js
  // The three kinds, in the bar's order, and their names there.
  const KINDS = ['hospital', 'abroad', 'jail'];
  const NAMES = { hospital: 'Hospital', abroad: 'Abroad', jail: 'Jail' };
  // GM storage: the three switches, as a string of JSON.
  const STORE = 'tulf-switches';
```

**Edit 2.3: GM storage, before "Who is where".** Replace:

```js
  // ===== WHO IS WHERE =====
```

With:

```js
  // ===== GM STORAGE =====

  // Every GM_* call is guarded, because hosts differ in what they give a script.
  function gmGet(name) {
    try {
      return typeof GM_getValue === 'function' ? GM_getValue(name, '') : '';
    } catch (e) {
      return '';
    }
  }

  // A full localStorage, where PDA keeps GM values, throws. The switch still works on this page,
  // and the next page load starts from what was saved before.
  function gmSet(name, value) {
    try {
      if (typeof GM_setValue === 'function') GM_setValue(name, value);
    } catch (e) {
      // Not saved.
    }
  }

  // A stored value, read from its JSON. PDA hands values back as strings; a host that hands back
  // the object itself works too. null when nothing is saved, or the value won't parse.
  function readJson(name) {
    const raw = gmGet(name);
    if (raw && typeof raw === 'object') return raw;
    try {
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  // The three switches: each is on unless it was saved off. With nothing saved, or a value that
  // won't parse, all three are on.
  function readSwitches() {
    const saved = readJson(STORE);
    const on = {};
    KINDS.forEach((kind) => {
      on[kind] = !(saved && typeof saved === 'object' && saved[kind] === false);
    });
    return on;
  }

  // ===== WHO IS WHERE =====
```

**Edit 2.4: Rows another script hides.** Replace:

```js
    return [...document.querySelectorAll(LIST + ' > li')].filter((li) => li.querySelector('.user.name'));
  }
```

With:

```js
    return [...document.querySelectorAll(LIST + ' > li')].filter((li) => li.querySelector('.user.name'));
  }

  // True when another script (TornTools' own filter, say) hides the row. Such rows aren't counted.
  function hiddenByOthers(row) {
    return row.hidden || row.style.display === 'none' || row.classList.contains('tt-hidden');
  }
```

**Edit 2.5: The bar's look.** Replace:

```js
  // ===== THE STYLESHEET =====

  // The class that hides a row.
  const CSS = [
    '.' + HIDDEN_CLASS + ' { display: none !important; }',
  ].join('\n');

```

With:

```js
  // ===== THE STYLESHEET =====

  // The class that hides a row, and the bar's look: small, in Torn's own font and colours, so it
  // fits Torn's light and dark modes.
  const CSS = [
    '.' + HIDDEN_CLASS + ' { display: none !important; }',
    '#' + BAR_ID + ' { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 14px; margin: 10px 0 6px; padding: 6px 10px;'
      + ' border: 1px solid rgba(128, 128, 128, 0.35); border-radius: 5px; background: rgba(128, 128, 128, 0.08);'
      + ' font: inherit; font-size: 12px; line-height: 18px; color: inherit; }',
    '#' + BAR_ID + ' label { display: inline-flex; align-items: center; gap: 4px; margin: 0; cursor: pointer; }',
    '#' + BAR_ID + ' input { margin: 0; cursor: pointer; }',
    '#' + BAR_ID + ' .tulf-count { margin-left: auto; opacity: 0.85; }',
  ].join('\n');

```

**Edit 2.6: The bar, and a check that places it and counts.** Replace:

```js
  // ===== THE CHECK =====

  // Hides the rows of each kind switched on and shows the rest.
  function check() {
    try {
      rows().forEach((row) => {
        const kinds = kindsOf(row);
        setHidden(row, KINDS.some((kind) => switches[kind] && kinds.has(kind)));
      });
```

With:

```js
  // ===== THE BAR =====

  // The bar above the list: "Hide:", a switch for each kind, then the count. All its text is the
  // script's own; nothing from the page goes in it.
  function buildBar() {
    const el = document.createElement('div');
    el.id = BAR_ID;
    const title = document.createElement('span');
    title.textContent = 'Hide:';
    el.appendChild(title);
    KINDS.forEach((kind) => {
      const label = document.createElement('label');
      const box = document.createElement('input');
      box.type = 'checkbox';
      box.checked = switches[kind];
      box.addEventListener('change', safely(() => flip(kind, box.checked)));
      label.appendChild(box);
      label.appendChild(document.createTextNode(' ' + NAMES[kind]));
      el.appendChild(label);
    });
    const count = document.createElement('span');
    count.className = 'tulf-count';
    el.appendChild(count);
    return el;
  }

  // The bar goes right before Torn's title bar over the list, where TornTools puts its own
  // filter, or right before the list when there is no title bar. It is put there once, and again
  // only when it is gone from the page, so it never fights another script for the spot.
  function placeBar() {
    if (bar.isConnected) return;
    const anchor = document.querySelector('.users-list-title') || document.querySelector(LIST);
    if (anchor) anchor.parentNode.insertBefore(bar, anchor);
  }

  // How many of the rows on this page are hidden, written only when it changes. Blank while the
  // page has no rows (Torn still loading them, or no results).
  function showCount(total, hidden) {
    let text = '';
    if (total === 1 && hidden === 1) text = 'The 1 on this page is hidden.';
    else if (total && hidden === total) text = 'All ' + total + ' on this page are hidden.';
    else if (total) text = hidden + ' of ' + total + ' hidden on this page';
    const count = bar.querySelector('.tulf-count');
    if (count.textContent !== text) count.textContent = text;
  }

  // A switch takes effect at once on the rows on the page, and is saved.
  function flip(kind, on) {
    switches[kind] = on;
    gmSet(STORE, JSON.stringify(switches));
    check();
  }

  // Every handler the script gives the page runs inside a try, so an error in one stays there.
  function safely(handler) {
    return function (e) {
      try {
        handler(e);
      } catch (err) {
        // Dropped, as an error in a check is.
      }
    };
  }

  // ===== THE CHECK =====

  // Hides the rows of each kind switched on, shows the rest, places the bar and writes the
  // count. Rows that other scripts hide aren't counted, but this one hides them too when they
  // are of a kind switched on, so a row either one hides stays hidden.
  function check() {
    try {
      let total = 0;
      let hidden = 0;
      rows().forEach((row) => {
        const kinds = kindsOf(row);
        const hide = KINDS.some((kind) => switches[kind] && kinds.has(kind));
        setHidden(row, hide);
        if (hiddenByOthers(row)) return;
        total += 1;
        if (hide) hidden += 1;
      });
      placeBar();
      showCount(total, hidden);
```

**Edit 2.7: The switches, from storage.** Replace:

```js
  // For now, every kind is hidden.
  const switches = { hospital: true, abroad: true, jail: true };
```

With:

```js
  const switches = readSwitches();
```

**Edit 2.8: The bar, made at start.** Replace:

```js
  (document.head || root).appendChild(style);
  check();
```

With:

```js
  (document.head || root).appendChild(style);
  const bar = buildBar();
  check();
```

- [ ] **Step 4: Run the tests to see them pass.** Run `T`, then `C`.

Expected: `# tests 27 # pass 27 # fail 0`, then `ascii-ok`.

- [ ] **Step 5: Commit.**

```bash
WT=/opt/warboard/.superpowers/sdd/2026-10-25-torn-userlist-filter/wt; cd "$WT" && git commit -q -m "torn-userlist-filter: a bar above the list with a switch for each kind, saved, and the count of rows hidden" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- server/public/scripts/torn-userlist-filter.user.js server/torn-userlist-filter.test.mjs && git log --format='%h %s' -1 && git status --short
```

Expected: the commit, then only `?? server/node_modules`.

---

### Task 3: Checking again, and the mutant check

**Files:**
- Modify: `server/public/scripts/torn-userlist-filter.user.js`
- Modify (tests): `server/torn-userlist-filter.test.mjs`

**Interfaces:**
- Consumes, from Tasks 1 and 2: `check()`, `LIST`, `bar`, `TT_LINES`, the START block as Task 2 leaves it, and the test file's helpers (`page`, `w.observed`, `w.deliveries`, `w.newPage`, `w.replaceList`, `settle`, `count`, `hiddenRows`, `barOf`, `flip`, `matching`, `rowName`, `row`, `icon`, `ROWS`, `PLACEHOLDER`, `TITLE`, `RUNNING`).
- Produces, inside the script: `WATCH = { childList: true, subtree: true }`, `waiting`, `wrapper() -> the list's wrapper, else its parent, else null`, `watch()`, `onChanges()`, `observer`; `check()` now ends with `observer.takeRecords()`.

- [ ] **Step 1: Write the failing tests.** Add at the end of `server/torn-userlist-filter.test.mjs`, after a blank line:

```js
// ---------------------------------------------------------------------------------------------
// Checking again
// ---------------------------------------------------------------------------------------------

test('a new page of results is checked as soon as Torn puts it in', async () => {
  const w = page().run();
  w.newPage(PLACEHOLDER);
  await settle();
  assert.equal(count(w), '');
  w.newPage(row('jail2', [icon(16)]) + row('okay2', [icon(1)]) + row('flying2', [icon(71)]));
  await settle();
  assert.deepEqual(hiddenRows(w), ['jail2', 'flying2']);
  assert.equal(count(w), '2 of 3 hidden on this page');
});

test('a list Torn replaces whole is checked the same way, and the bar stays put', async () => {
  const w = page().run();
  w.replaceList(row('hospital2', [icon(15)]) + row('okay2', [icon(1)]));
  await settle();
  assert.deepEqual(hiddenRows(w), ['hospital2']);
  assert.equal(count(w), '1 of 2 hidden on this page');
  assert.equal(barOf(w).nextElementSibling, w.document.querySelector('.users-list-title'));
});

test('a wrapper Torn replaces whole is checked the same way, and so are the pages after it', async () => {
  // Watching the wrapper itself would go deaf here: the old wrapper is the one watched, and it
  // is gone from the page.
  const w = page().run();
  const old = w.document.querySelector('.userlist-wrapper');
  const fresh = w.document.createElement('div');
  fresh.className = 'userlist-wrapper';
  fresh.innerHTML = TITLE + '<ul class="user-info-list-wrap">' + row('hospital2', [icon(15)]) + row('okay2', [icon(1)]) + '</ul>';
  old.parentNode.replaceChild(fresh, old);
  await settle();
  assert.deepEqual(hiddenRows(w), ['hospital2']);
  assert.equal(barOf(w).nextElementSibling, fresh.querySelector('.users-list-title'));
  w.newPage(row('jail3', [icon(16)]) + row('okay3', [icon(1)]));
  await settle();
  assert.deepEqual(hiddenRows(w), ['jail3']);
  assert.equal(count(w), '1 of 2 hidden on this page');
});

test('when Torn redraws the title bar and the list, and the bar goes with them, the bar comes back before the new title bar', async () => {
  const w = page().run();
  const holder = w.document.querySelector('.userlist-wrapper');
  holder.innerHTML = TITLE + '<ul class="user-info-list-wrap">' + row('jail2', [icon(16)]) + '</ul>';
  await settle();
  assert.equal(barOf(w).nextElementSibling, holder.querySelector('.users-list-title'));
  assert.equal(count(w), 'The 1 on this page is hidden.');
});

test('with no wrapper, the script watches from above the list\'s parent: a new page is checked', async () => {
  const w = page({ wrapper: false }).run();
  assert.equal(w.observed[0]?.target, w.list().parentNode.parentNode);
  w.newPage(row('hospital2', [icon(15)]) + row('okay2', [icon(1)]));
  await settle();
  assert.deepEqual(hiddenRows(w), ['hospital2']);
});

test('when the list is not on the page yet, the script waits for it, then watches from above its wrapper', async () => {
  const w = page({ list: false }).run();
  assert.equal(w.bar(), null);
  assert.equal(w.observed[0]?.target, w.document.body);
  const box = w.document.querySelector('.content-wrapper');
  const holder = w.document.createElement('div');
  holder.className = 'userlist-wrapper';
  box.appendChild(holder);
  holder.appendChild(w.document.createElement('div')).className = 'users-list-title';
  const ul = w.document.createElement('ul');
  ul.className = 'user-info-list-wrap';
  holder.appendChild(ul);
  ul.innerHTML = ROWS;
  await settle();
  assert.deepEqual(hiddenRows(w), ['hospital', 'radiation', 'jail', 'flying']);
  assert.equal(barOf(w).nextElementSibling, holder.querySelector('.users-list-title'));
  assert.equal(w.observed.at(-1)?.target, box);
  w.newPage(row('jail2', [icon(16)]));
  await settle();
  assert.equal(count(w), 'The 1 on this page is hidden.');
});

test('it watches for rows added and removed only, never attribute or text changes', async () => {
  const w = page({ list: false }).run();
  const holder = w.document.createElement('div');
  holder.className = 'userlist-wrapper';
  holder.innerHTML = '<ul class="user-info-list-wrap">' + ROWS + '</ul>';
  w.document.body.appendChild(holder);
  await settle();
  assert.ok(w.observed.length >= 2);
  for (const { options } of w.observed) assert.deepEqual(options, { childList: true, subtree: true });
});

test('the script\'s own changes (hiding rows, the count, the bar) set off no more checks', async () => {
  const w = page().run();
  await settle();
  assert.equal(w.deliveries, 0, 'starting');
  w.newPage(row('jail2', [icon(16)]) + row('okay2', [icon(1)]));
  await settle();
  await settle();
  assert.equal(w.deliveries, 1, 'one for Torn\'s new page, none for the check\'s own changes');
  flip(w, 'Jail', false);
  await settle();
  assert.equal(count(w), '0 of 2 hidden on this page');
  assert.equal(w.deliveries, 1, 'a switch sets off none');
});

test('a TornTools line Torn or TornTools adds later under a hidden row is hidden too', async () => {
  const w = page().run();
  const hospital = [...w.list().children].find((li) => rowName(li) === 'hospital');
  const line = w.document.createElement('div');
  line.className = 'tt-stats-estimate';
  line.textContent = 'Stats Estimate: 9';
  hospital.after(line);
  await settle();
  assert.equal(matching(w, 'display: none').has(line), true);
});

test('an error in a check stays there: the script starts, and the next check works', async () => {
  const w = page({ rows: row('hospital', [icon(15)]) });
  // A row that throws when its classes are touched: a surprise in Torn's page.
  Object.defineProperty(w.list().firstElementChild, 'classList', { get() { throw new Error('a surprise in Torn\'s page'); } });
  assert.doesNotThrow(() => w.run());
  assert.deepEqual(w.logs, [RUNNING]);
  w.newPage(row('jail2', [icon(16)]) + row('okay2', [icon(1)]));
  await settle();
  assert.deepEqual(hiddenRows(w), ['jail2']);
  assert.equal(count(w), '1 of 2 hidden on this page');
});
```

- [ ] **Step 2: Run them to see them fail.** Run `T`.

Expected: `# tests 37 # pass 27 # fail 10`. Each of the 10 new tests fails on an AssertionError: with nothing watched, nothing Torn puts in later is checked. One of them, the title bar redrawn with the bar in it, fails on "the bar is on the page". Tasks 1 and 2's 27 still pass.

- [ ] **Step 3: Edit the script.** In `server/public/scripts/torn-userlist-filter.user.js`, three edits, in this order:

**Edit 3.1: What the script watches for.** Replace:

```js
  const TT_LINES = ['tt-stats-estimate', 'tt-last-action'];
```

With:

```js
  const TT_LINES = ['tt-stats-estimate', 'tt-last-action'];
  // What the script watches for: rows added and removed, never attribute changes.
  const WATCH = { childList: true, subtree: true };
```

**Edit 3.2: The check drops its own records, and the watching.** Replace:

```js
    } catch (e) {
      // A surprise in Torn's page stops this one check. It never breaks the page.
    }
  }

  // ===== START =====
```

With:

```js
    } catch (e) {
      // A surprise in Torn's page stops this one check. It never breaks the page.
    }
    // The check's own changes (the count, the bar) are not Torn's. Their records are dropped,
    // so they never set off another check.
    observer.takeRecords();
  }

  // ===== CHECKING AGAIN =====

  // Torn loads each page of results into the list without reloading the page, and a new page or
  // sort order replaces the rows, the whole list, or the wrapper around it. The script watches
  // from one level above the list's wrapper (or above the list's parent, when there is no
  // wrapper), so a wrapper Torn replaces whole is seen too. It watches for rows added and
  // removed, and checks again as soon as Torn has put them in, before the page is drawn, so a
  // hidden row never shows. Until the list is on the page, it watches the whole page for it.
  let waiting = false;

  // The list's wrapper, or else the list's parent. null while the list isn't on the page.
  function wrapper() {
    const list = document.querySelector(LIST);
    return document.querySelector('.userlist-wrapper') || (list && list.parentElement);
  }

  function watch() {
    const el = wrapper();
    waiting = !el;
    observer.disconnect();
    observer.observe((el && el.parentElement) || document.body, WATCH);
  }

  function onChanges() {
    try {
      if (waiting) {
        if (!wrapper()) return;
        watch();
      }
      check();
    } catch (e) {
      // Dropped, as an error in a check is.
    }
  }

  // ===== START =====
```

**Edit 3.3: The watcher, at start.** Replace:

```js
  const bar = buildBar();
  check();
```

With:

```js
  const bar = buildBar();
  const observer = new MutationObserver(onChanges);
  watch();
  check();
```

- [ ] **Step 4: Run the tests to see them pass.** Run `T`, then `C`.

Expected: `# tests 37 # pass 37 # fail 0`, then `ascii-ok`.

- [ ] **Step 5: The mutant check.** Each mutant changes the script in one place, and each must fail at least one test. It runs the test file once per mutant, so it takes a few minutes: run it in the background, or with a long timeout. `mutants.mjs` is in the workspace from plan time (Setup checked its hash). If it must be written again, this is it:

```js
// Mutant check for the Torn User List Filter, outside the repo: makes one broken copy of the
// script per mutant below, runs the script's tests on each (TULF_SRC), one at a time, and says
// which the tests catch. Every mutant must be caught.
// Usage: node mutants.mjs <script> <test file> <scratch dir>
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { spawnSync } from 'node:child_process';

const [script, tests, dir] = process.argv.slice(2);
const SRC = readFileSync(script, 'utf8');
const META = readFileSync(script.replace(/\.user\.js$/, '.meta.js'), 'utf8');

// [name, text in the script (it must be there exactly once), what replaces it]
const MUTANTS = [
  ['M1 the number read without the _ boundary', '/^icon(\\d+)(?:_|$)/', '/^icon(\\d+)/'],
  ['M2 70 counted as jail', "16: 'jail', 71: 'abroad' }", "16: 'jail', 70: 'jail', 71: 'abroad' }"],
  ['M3 watching attributes', 'const WATCH = { childList: true, subtree: true };', 'const WATCH = { childList: true, subtree: true, attributes: true };'],
  ['M4 the bar after the list', 'if (anchor) anchor.parentNode.insertBefore(bar, anchor);', 'if (anchor) anchor.parentNode.insertBefore(bar, anchor.nextSibling);'],
  ['M5 no takeRecords', '    observer.takeRecords();\n', ''],
  ['M6 labels read for known numbers', "if (known(n)) return BY_NUMBER[n] || '';", 'if (known(n) && BY_NUMBER[n]) return BY_NUMBER[n];'],
  ['M7 tags left in labels', ".replace(/<[^>]*>/g, ' ').trim()", '.trim()'],
  ['M8 hospital matched anywhere in a label', "[[/^hospital/i, 'hospital']", "[[/hospital/i, 'hospital']"],
  ['M9 TornTools lines left showing', "const TT_LINES = ['tt-stats-estimate', 'tt-last-action'];", 'const TT_LINES = [];'],
  ['M10 rows other scripts hide counted', '        if (hiddenByOthers(row)) return;\n', ''],
  ['M11 runs on UserListAjax too', "if (!/[?&]sid=userlist(?:&|$)/i.test(location.search)) return;", "if (!/sid=userlist/i.test(location.search)) return;"],
  ['M12 runs twice when loaded twice', "  if (root.hasAttribute('data-tulf')) return;\n", ''],
  ['M13 an error in a check escapes it', "      // A surprise in Torn's page stops this one check. It never breaks the page.\n", '      throw e;\n'],
  ['M14 GM_getValue unguarded', "return typeof GM_getValue === 'function' ? GM_getValue(name, '') : '';", "return GM_getValue(name, '');"],
  ['M15 a switch not saved', '    gmSet(STORE, JSON.stringify(switches));\n', ''],
  ['M16 a switch not applied at once', '    gmSet(STORE, JSON.stringify(switches));\n    check();\n', '    gmSet(STORE, JSON.stringify(switches));\n'],
  ['M17 the placeholder counted as a row', ".filter((li) => li.querySelector('.user.name'))", ''],
  ['M18 no all-hidden wording', 'else if (total && hidden === total) text', 'else if (false) text'],
  ['M19 no waiting for the list', 'observer.observe((el && el.parentElement) || document.body, WATCH);', 'if (el) observer.observe(el.parentElement, WATCH);'],
  ['M20 no list-parent fallback', "return document.querySelector('.userlist-wrapper') || (list && list.parentElement);", "return document.querySelector('.userlist-wrapper');"],
  ['M21 a kind missing from storage read as off', 'saved[kind] === false', 'saved[kind] !== true'],
  ['M22 TornTools hidden rows counted', " || row.classList.contains('tt-hidden')", ''],
  ['M23 only the first icon read', "row.querySelectorAll('li[id^=\"icon\"]')", "row.querySelectorAll('li[id^=\"icon\"]:first-child')"],
  ['M24 a stored object not read', "    if (raw && typeof raw === 'object') return raw;\n", ''],
  ['M25 no one-row wording', "    if (total === 1 && hidden === 1) text = 'The 1 on this page is hidden.';\n    else if (total && hidden === total)", '    if (total && hidden === total)'],
  ['M26 the bar moved on every check', '    if (bar.isConnected) return;\n', ''],
  ['M27 still watching the page once the list is there', '        if (!wrapper()) return;\n        watch();\n', '        if (!wrapper()) return;\n        waiting = false;\n'],
  ['M28 checks on a timer', '      check();\n    } catch (e) {\n      // Dropped, as an error in a check is.', '      setTimeout(check, 50);\n    } catch (e) {\n      // Dropped, as an error in a check is.'],
  ['M29 the hidden attribute not seen', 'return row.hidden || ', 'return '],
  ['M30 an inline display: none not seen', " || row.style.display === 'none'", ''],
  ['M31 a label inside the icon not read', "el.matches('[aria-label], [title]') ? el : el.querySelector('[aria-label], [title]')", "el.matches('[aria-label], [title]') ? el : null"],
  ['M32 aria-label not read', "holder.getAttribute('aria-label') || holder.getAttribute('title') || ''", "holder.getAttribute('title') || ''"],
  ['M33 switches drawn all on', '      box.checked = switches[kind];\n', '      box.checked = true;\n'],
  ['M34 the kinds in another order', "const KINDS = ['hospital', 'abroad', 'jail'];", "const KINDS = ['hospital', 'jail', 'abroad'];"],
  ['M35 the address read in one letter case', '/[?&]sid=userlist(?:&|$)/i', '/[?&]sid=UserList(?:&|$)/'],
  ['M36 a count with no rows', "    else if (total) text = hidden + ' of ' + total + ' hidden on this page';", "    else text = hidden + ' of ' + total + ' hidden on this page';"],
  ['M37 one TornTools line only', 'next && isTornToolsLine(next); next = next.nextElementSibling)', 'next && isTornToolsLine(next); next = null)'],
  ['M38 91 not counted as hospital', "{ 15: 'hospital', 91: 'hospital',", "{ 15: 'hospital',"],
  ['M39 abroad label words not read', "[/^(?:traveling|abroad)/i, 'abroad']", "[/^traveling/i, 'abroad']"],
  ['M40 the bar placed before the list even with a title bar', "document.querySelector('.users-list-title') || document.querySelector(LIST)", 'document.querySelector(LIST)'],
  ['M41 watching the wrapper itself', 'observer.observe((el && el.parentElement) || document.body, WATCH);', 'observer.observe(el || document.body, WATCH);'],
];

let caught = 0;
const lines = [];
rmSync(dir, { recursive: true, force: true });
for (const [name, from, to] of MUTANTS) {
  const n = SRC.split(from).length - 1;
  if (n !== 1) {
    lines.push(name + ': SETUP ERROR (found ' + n + ' times)');
    continue;
  }
  const slug = name.split(' ')[0];
  const file = join(dir, slug, 'torn-userlist-filter.user.js');
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, SRC.replace(from, to));
  writeFileSync(file.replace(/\.user\.js$/, '.meta.js'), META);
  const run = spawnSync(process.execPath, ['--test', tests], { env: { ...process.env, TULF_SRC: file }, encoding: 'utf8', timeout: 120000 });
  const out = (run.stdout || '') + (run.stderr || '');
  const fail = Number((out.match(/^# fail (\d+)/m) || [0, -1])[1]);
  if (fail > 0) caught += 1;
  lines.push(name + ': ' + (fail > 0 ? 'caught (' + fail + ' failing)' : 'SURVIVED'));
}
console.log(lines.join('\n'));
console.log(caught + ' of ' + MUTANTS.length + ' caught');
process.exit(caught === MUTANTS.length ? 0 : 1);
```

Run it:

```bash
W=/opt/warboard/.superpowers/sdd/2026-10-25-torn-userlist-filter; cd "$W" && node mutants.mjs "$W/wt/server/public/scripts/torn-userlist-filter.user.js" "$W/wt/server/torn-userlist-filter.test.mjs" "$W/mut" > "$W/mutants.log" 2>&1; echo "exit $?"; tail -2 "$W/mutants.log"
```

Expected: `exit 0`, then the last mutant's line, `M41 watching the wrapper itself: caught (3 failing)`, then `41 of 41 caught`. Any `SURVIVED` or `SETUP ERROR` is a finding: a survivor needs a test that kills it, and a setup error means the script's text differs from this plan's. Add the last line to the ledger.

- [ ] **Step 6: Commit.**

```bash
WT=/opt/warboard/.superpowers/sdd/2026-10-25-torn-userlist-filter/wt; cd "$WT" && git commit -q -m "torn-userlist-filter: each new page of results Torn puts in the list is checked before it is drawn" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- server/public/scripts/torn-userlist-filter.user.js server/torn-userlist-filter.test.mjs && git log --format='%h %s' -1 && git status --short
```

Expected: the commit, then only `?? server/node_modules`.

---

## Between Task 3 and Task 4: the final review

- The review package covers the whole branch, `git merge-base main HEAD`..HEAD, built by `review-package` from inside `$WT`.
- The reviewer is a fresh Opus agent (`model: "opus"`). It gets:
  - the package, this plan and the spec;
  - the Review Focus above, verbatim;
  - a pointer to the ledger's `Ruling:` lines and this plan's "Rulings made at plan time";
  - the mutant check's output from Task 3. It may run the tests and the check again on copies in its own scratch directory.
- Critical and Important findings go into one fix pass. Each fix is a failing test first, then the fix, then `T` green and `C` clean, committed on the branch. A fix that changes text a mutant looks for updates the mutant and runs the check again.
- Minor findings go to the ledger as deferred.

---

### Task 4: The live check, and release

**Files:** none in the repo change here, unless the live check finds something to fix (then as the fix pass says). Main fast-forwards to the branch, the two served files get their owner, and the memory notes outside the repo are updated.

**Interfaces:** consumes the branch `torn-userlist-filter` after the final review's fix pass, and the workspace's `live/probe.js` and `live/live.mjs`.

- [ ] **Step 1: The live check (a gate).** It reads a real results page in the owner's warboard iOS app, through its remote inspect, and changes nothing there. It needs the owner, so STOP here and send them this, then wait:

> The filter is built and reviewed. Before it ships I need one read-only look at a real results page. In the warboard app: Settings, "Remote inspect (owner)", turn on "Allow remote inspect", then open your search: https://www.torn.com/page.php?sid=UserList&orderBy=name&orderDirection=asc&levelFrom=75&lastAction=7&searchConditionNot=true&searchConditions=inFederalJail . Keep the app's AI chat closed for a few minutes (it shares the inspect line). Tell me when the page is open. Later I'll ask you to click Next once, and, if you don't mind, to change the sort once.

`live/probe.js` and `live/live.mjs` were written at plan time, and the final review's fix pass rewrote both (the ledger has their new hashes). If they must be written again, this is `live/probe.js`:

```js
// Read-only probe of Torn's user list search, for the Torn User List Filter's live check. It
// reads the page the owner has open and returns what it found. It changes nothing on the page
// and sends nothing.
// Two things stay on window between runs. One is a weak note of the list, its wrapper, the box
// the filter watches (the one above the wrapper), the title bar and the first row, so that a run
// after the owner clicks Next can say whether Torn kept them or put new ones in. The other is a
// watcher that only reads: it notes in short each change Torn makes to the page (where, and how
// many things went in and out; no text from the page), so that the next run can say in what
// order Torn changed things on Next, and how often it changes them when nothing is clicked. It
// keeps the last 200 notes, and stops itself 30 minutes after the first run.
const LIST = 'ul.user-info-list-wrap';
const list = document.querySelector(LIST);
const wrap = document.querySelector('.userlist-wrapper');
const title = document.querySelector('.users-list-title');
// The list's wrapper as the filter finds it: the .userlist-wrapper around the list, or else the
// list's parent. The filter watches the box above it, and looks for the title bar in it first.
const holder = list && (list.closest('.userlist-wrapper') || list.parentElement);
const box = holder && holder.parentElement;
const ownTitle = holder && holder.querySelector('.users-list-title');
const describe = (n) => (n.nodeType !== 1 ? (n.nodeType === 3 ? '#text' : '#node' + n.nodeType)
  : n.tagName.toLowerCase() + (n.id ? '#' + n.id : '')
    + (typeof n.className === 'string' && n.className.trim() ? '.' + n.className.trim().split(/\s+/).join('.') : ''));
const chain = (el) => {
  const out = [];
  for (let n = el; n && n !== document.body && out.length < 8; n = n.parentElement) out.push(describe(n));
  return out;
};
const attrs = (el) => ({ title: el.getAttribute('title'), aria: el.getAttribute('aria-label') });
const shown = (el) => (typeof getComputedStyle === 'function' ? getComputedStyle(el).display : el.style.display) !== 'none';
const rows = list ? [...list.children].filter((n) => n.tagName === 'LI').map((li) => {
  const link = li.querySelector('.user.name');
  const icons = [...li.querySelectorAll('li[id^="icon"]')].map((ic) => ({
    id: ic.id, className: String(ic.className), ...attrs(ic), shown: shown(ic),
    // The things inside the icon that carry a label, in order: the filter reads them after the
    // icon's own, and takes the first label that isn't empty.
    inner: [...ic.querySelectorAll('[aria-label], [title]')].slice(0, 4)
      .map((n) => ({ tag: n.tagName.toLowerCase(), className: String(n.className), ...attrs(n) })),
  }));
  const after = [];
  for (let n = li.nextElementSibling; n && n.tagName !== 'LI'; n = n.nextElementSibling) after.push(describe(n));
  return { tag: describe(li), hasName: !!link,
    xid: link ? ((/XID=(\d+)/.exec(link.getAttribute('href') || '') || [])[1] || null) : null,
    hidden: li.hidden, inlineDisplay: li.style.display, shown: shown(li), icons, after };
}) : [];
const firstRow = list ? [...list.children].find((n) => n.tagName === 'LI' && n.querySelector('.user.name')) || null : null;
const prev = window.__tulfProbe;
const now = () => Math.round(performance.now());

// The watcher, put on the page on the first run.
let watcher = prev && prev.watcher;
if (!watcher) {
  watcher = { started: now(), since: now(), notes: [], seen: 0, inBox: 0, stopped: false, box: box ? new WeakRef(box) : null };
  const w = watcher;
  const mo = new MutationObserver((records) => {
    if (now() - w.started > 30 * 60 * 1000) {
      mo.disconnect();
      w.stopped = true;
      return;
    }
    const watched = w.box && w.box.deref();
    for (const r of records) {
      const inside = !!(watched && watched.contains(r.target));
      w.seen += 1;
      if (inside) w.inBox += 1;
      w.notes.push({ t: now() - w.since, target: describe(r.target), inBox: inside, added: r.addedNodes.length, removed: r.removedNodes.length,
        first: r.addedNodes[0] ? '+' + describe(r.addedNodes[0]) : r.removedNodes[0] ? '-' + describe(r.removedNodes[0]) : '' });
      if (w.notes.length > 200) w.notes.shift();
    }
  });
  mo.observe(document.body, { childList: true, subtree: true });
}
// What it saw since the run before, then a fresh start for the next run. The box it counts is
// the one the filter would watch now.
const changes = prev ? { seconds: Math.round((now() - watcher.since) / 1000), records: watcher.seen, inBox: watcher.inBox,
  stopped: watcher.stopped, notes: watcher.notes } : null;
watcher.since = now();
watcher.seen = 0;
watcher.inBox = 0;
watcher.notes = [];
watcher.box = box ? new WeakRef(box) : null;

const out = {
  url: location.pathname + location.search,
  at: new Date().toISOString(),
  lists: document.querySelectorAll(LIST).length,
  wrappers: document.querySelectorAll('.userlist-wrapper').length,
  titleBars: document.querySelectorAll('.users-list-title').length,
  wrapper: !!wrap,
  titleBar: !!title,
  titleInWrapper: !!(wrap && title && wrap.contains(title)),
  listInWrapper: !!(list && list.closest('.userlist-wrapper')),
  titleInHolder: !!ownTitle,
  holder: holder ? describe(holder) : null,
  box: box ? describe(box) : null,
  listChain: list ? chain(list) : null,
  titleChain: title ? chain(title) : null,
  sameListAsBefore: prev ? prev.list.deref() === list : null,
  sameWrapperAsBefore: prev ? prev.holder.deref() === holder : null,
  sameBoxAsBefore: prev ? prev.box.deref() === box : null,
  sameTitleAsBefore: prev ? prev.title.deref() === (ownTitle || title) : null,
  sameFirstRowAsBefore: prev ? prev.firstRow.deref() === firstRow : null,
  pagination: [...document.querySelectorAll('[class*="pagination"], [class*="pager"], .page-number')].slice(0, 12).map(describe),
  placeholders: list ? list.querySelectorAll('.ajax-placeholder').length : 0,
  placeholdersOnPage: document.querySelectorAll('.ajax-placeholder').length,
  preloaders: document.querySelectorAll('.ajax-preloader').length,
  changes,
  rows,
};
const keep = (el) => (el ? new WeakRef(el) : { deref: () => null });
window.__tulfProbe = { list: keep(list), holder: keep(holder), box: keep(box), title: keep(ownTitle || title), firstRow: keep(firstRow), watcher };
return out;
```

and this is `live/live.mjs`:

```js
// The Torn User List Filter's live check, outside the repo (Task 4 Step 1). Read-only on Torn.
//   node live.mjs probe <out.json>            runs probe.js on the page the owner has open in the
//                                             warboard app (remote inspect), saves what it found
//                                             (mode 600) and prints a summary with no names or
//                                             ids in it
//   node live.mjs summary <probe.json>        prints that summary again
//   node live.mjs keyuse                      warboard's own calls on the owner's key, a minute,
//                                             over the last 5 minutes
//   node live.mjs abroad <probe.json> [--dry]  asks Torn's API where some of the people in the rows
//                                             are: the owner's key, at most 30 calls, 3 s apart
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const [cmd, file, flag] = process.argv.slice(2);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
// The script's own rules: these numbers tell of a kind; any other known number tells of none.
const KINDS = { 15: 'hospital', 91: 'hospital', 16: 'jail', 71: 'abroad' };
const KNOWN = [[1, 13], [15, 68], [70, 76], [78, 87], [89, 91]];
const BY_LABEL = [[/^hospital/i, 'hospital'], [/^jail/i, 'jail'], [/^(?:traveling|abroad)/i, 'abroad']];
const num = (id) => Number((/^icon(\d+)(?:_|$)/.exec(id || '') || [])[1] || 0);
const known = (n) => KNOWN.some(([from, to]) => n >= from && n <= to);
const plain = (text) => String(text || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
// Text from the page with its digits masked, safe to print: an icon's id keeps only its shape.
const masked = (text) => String(text || '').replace(/^icon\d+/, 'icon<n>').replace(/\d/g, '#');

// The label the script reads: the first aria-label or title that isn't empty, the icon's own
// first, then those of the things inside it, in order. With its raw text, and where it was.
function labelOf(ic) {
  const holders = [{ ...ic, where: 'on the icon' }, ...(ic.inner || []).map((h) => ({ ...h, where: 'on its ' + h.tag }))];
  for (const h of holders) {
    const raw = h.aria || h.title || '';
    const text = plain(raw);
    if (text) return { text, raw, where: (h.aria ? 'aria-label ' : 'title ') + h.where };
  }
  return { text: '', raw: '', where: 'no label' };
}

// A label's heading, safe to print: its bold start, or else what comes before its first line
// break or colon, at most two words and 24 characters. The rest of a label can name people.
function heading(raw) {
  const bold = /^\s*<b>(.*?)<\/b>/i.exec(raw);
  const head = bold ? bold[1] : String(raw).split(/<br\s*\/?>/i)[0].split(':')[0];
  return plain(head).split(' ').slice(0, 2).join(' ').slice(0, 24);
}

function kindOf(ic) {
  const n = num(ic.id);
  if (!n) return '';
  if (known(n)) return KINDS[n] || '';
  const hit = BY_LABEL.find(([re]) => re.test(labelOf(ic).text));
  return hit ? hit[1] : '';
}
const kindsOf = (row) => new Set(row.icons.map(kindOf).filter(Boolean));

// The owner's key, from the server's .env. It goes only in the Authorization header; its last
// four characters, never printed, pick it out of the key-usage diagnostic.
function ownerKey() {
  const env = readFileSync('/opt/warboard/server/.env', 'utf8');
  const key = ((/^OWNER_API_KEY=(.*)$/m.exec(env) || [])[1] || '').trim().replace(/^["']|["']$/g, '');
  if (!key) throw new Error('no OWNER_API_KEY in the .env');
  return key;
}

// warboard's own calls on the owner's key, a minute, over the last 5 minutes, from the server's
// key-usage diagnostic (localhost only). The owner's own scripts on their devices use the same
// key and are not counted in it.
async function keyUse() {
  const end = ownerKey().slice(-4);
  const res = await fetch('http://127.0.0.1:3000/api/debug/key-usage-local?window=5&keySuffix=' + encodeURIComponent(end));
  const j = await res.json();
  return (j.perKey || []).filter((k) => k.suffix === end).reduce((sum, k) => sum + (Number(k.perMin) || 0), 0);
}

async function probe() {
  // The operator token is read here and sent as a header; it is never printed.
  const token = readFileSync('/opt/warboard/server/data/.inspect-token', 'utf8').trim();
  const base = 'http://127.0.0.1:3000/api/inspect';
  const headers = { 'x-inspect-token': token, 'content-type': 'application/json' };
  const js = readFileSync(join(HERE, 'probe.js'), 'utf8');
  const queued = await (await fetch(base + '/cmd', { method: 'POST', headers, body: JSON.stringify({ js }) })).json();
  if (!queued.ok) throw new Error('the relay refused the probe: ' + JSON.stringify(queued));
  for (let i = 0; i < 30; i += 1) {
    await sleep(2000);
    const got = await (await fetch(base + '/result', { headers })).json();
    const mine = (got.results || []).find((r) => r.id === queued.id);
    if (!mine) continue;
    if (mine.error) throw new Error('the page said: ' + mine.error);
    if (mine.result === 'null') throw new Error('the probe returned nothing: probe.js must end in a return');
    const out = JSON.parse(mine.result);
    writeFileSync(file, JSON.stringify(out, null, 1), { mode: 0o600 });
    summary(out);
    return;
  }
  throw new Error('no answer in 60 s: is "Allow remote inspect" on, with the app open on the page?');
}

function summary(out) {
  const say = (line) => console.log(line);
  say('page: ' + out.url + ' at ' + out.at);
  say('ul.user-info-list-wrap: ' + out.lists + '; .userlist-wrapper: ' + out.wrappers + '; .users-list-title: ' + out.titleBars);
  say('the list inside a .userlist-wrapper: ' + out.listInWrapper + '; the filter\'s wrapper: ' + masked(out.holder)
    + ', with a title bar in it: ' + out.titleInHolder + '; the first title bar inside the first wrapper: ' + out.titleInWrapper);
  say('the list, from itself up: ' + (out.listChain || ['no list']).map(masked).join(' < '));
  say('the title bar, from itself up: ' + (out.titleChain || ['no title bar']).map(masked).join(' < '));
  if (out.sameListAsBefore === null) say('the box the filter would watch: ' + masked(out.box) + ' (first run: nothing to compare)');
  else say('the same as the run before: list ' + out.sameListAsBefore + ', wrapper ' + out.sameWrapperAsBefore
    + ', box above the wrapper (the one the filter watches, ' + masked(out.box) + ') ' + out.sameBoxAsBefore
    + ', title bar ' + out.sameTitleAsBefore + ', first row ' + out.sameFirstRowAsBefore);
  say('pagination: ' + (out.pagination.length ? out.pagination.map(masked).join(' | ') : 'none found'));
  say('loading: .ajax-placeholder in the list ' + out.placeholders + ', on the page ' + out.placeholdersOnPage
    + '; .ajax-preloader on the page ' + out.preloaders);
  if (out.changes) {
    const c = out.changes;
    say('changes since the run before: ' + c.records + ' in ' + c.seconds + ' s, ' + c.inBox + ' of them inside the box the filter watches'
      + (c.stopped ? ' (the watcher had stopped)' : ''));
    // The last 200, in order, with runs of the same change folded into one line.
    const runs = [];
    for (const n of c.notes) {
      const what = masked(n.target) + (n.inBox ? ' (in the box)' : '') + ': +' + n.added + ' -' + n.removed + (n.first ? ' ' + masked(n.first) : '');
      const last = runs[runs.length - 1];
      if (last && last.what === what) last.times += 1;
      else runs.push({ what, times: 1, t: n.t });
    }
    runs.slice(0, 40).forEach((r) => say('  at ' + (r.t / 1000).toFixed(1) + ' s ' + r.what + (r.times > 1 ? ' x' + r.times : '')));
    if (runs.length > 40) say('  and ' + (runs.length - 40) + ' more');
  }
  const named = out.rows.filter((r) => r.hasName);
  say('rows: ' + out.rows.length + ' li under the list, ' + named.length + ' with a name link');
  const numbers = {};
  for (const row of named) {
    for (const ic of row.icons) {
      const n = num(ic.id);
      const key = n ? String(n) : 'no number (' + masked(ic.id) + ')';
      const e = numbers[key] || (numbers[key] = { n, rows: 0, headings: new Set(), where: new Set(), ids: new Set(), shown: 0 });
      const label = labelOf(ic);
      e.rows += 1;
      if (ic.shown) e.shown += 1;
      e.headings.add(heading(label.raw));
      e.where.add(label.where);
      e.ids.add(masked(ic.id));
    }
  }
  const order = Object.keys(numbers).sort((a, b) => (numbers[a].n || 999) - (numbers[b].n || 999));
  for (const key of order) {
    const e = numbers[key];
    const kind = e.n && known(e.n) ? (KINDS[e.n] || 'none') : 'by label';
    say('icon ' + key + ': ' + e.rows + ' rows (' + e.shown + ' shown), kind ' + kind + ', ' + [...e.where].join(' / ')
      + ', id like ' + [...e.ids].slice(0, 2).join(' ') + '; label headings: ' + [...e.headings].slice(0, 6).map((l) => JSON.stringify(l)).join(', '));
  }
  const tally = { hospital: 0, jail: 0, abroad: 0, 'two kinds': 0, none: 0 };
  for (const row of named) {
    const kinds = kindsOf(row);
    if (kinds.size > 1) tally['two kinds'] += 1;
    if (!kinds.size) tally.none += 1;
    for (const k of kinds) tally[k] += 1;
  }
  say('rows by kind, by the script\'s rules: ' + JSON.stringify(tally));
  const tt = named.filter((r) => r.after.some((a) => /\btt-/.test(a))).length;
  const others = named.filter((r) => r.hidden || r.inlineDisplay === 'none' || /\btt-hidden\b/.test(r.tag)).length;
  say('rows with TornTools lines after them: ' + tt + '; rows hidden by another script: ' + others);
}

async function abroad(dry) {
  const out = JSON.parse(readFileSync(file, 'utf8'));
  const named = out.rows.filter((r) => r.hasName && r.xid);
  const has = (row, kind) => kindsOf(row).has(kind);
  // Whom to ask about, at most 30 in all: people the script would hide as abroad (up to 10), in
  // hospital (up to 3) and in jail (up to 3), then people it would leave showing, to make 30.
  const groups = [
    ['with an abroad icon', named.filter((r) => has(r, 'abroad')).slice(0, 10)],
    ['with a hospital icon', named.filter((r) => has(r, 'hospital') && !has(r, 'abroad')).slice(0, 3)],
    ['with a jail icon', named.filter((r) => has(r, 'jail') && !has(r, 'abroad') && !has(r, 'hospital')).slice(0, 3)],
  ];
  const taken = groups.reduce((sum, [, rows]) => sum + rows.length, 0);
  groups.push(['with no kind icon', named.filter((r) => kindsOf(r).size === 0).slice(0, 30 - taken)]);
  console.log('to ask: ' + groups.reduce((sum, [, rows]) => sum + rows.length, 0) + ' (' + groups.map(([name, rows]) => rows.length + ' ' + name).join(', ') + ')');
  if (dry) return;
  const busy = await keyUse();
  console.log('warboard\'s own calls on the owner\'s key, over the last 5 minutes: ' + busy.toFixed(1) + ' a minute');
  if (busy > 50) {
    console.log('too busy for 20 more a minute: try again later');
    return;
  }
  const key = ownerKey();
  const total = groups.reduce((sum, [, rows]) => sum + rows.length, 0);
  const seen = [];
  asking: for (const [group, rows] of groups) {
    for (const row of rows) {
      const res = await fetch('https://api.torn.com/v2/user/' + encodeURIComponent(row.xid) + '/basic?striptags=true',
        { headers: { Authorization: 'ApiKey ' + key } });
      const j = await res.json().catch(() => ({}));
      if (j.error) {
        console.log('Torn refused a call (code ' + j.error.code + '); stopped after ' + seen.length);
        break asking;
      }
      const status = j.profile && j.profile.status;
      if (!status || typeof status.state !== 'string') {
        // Not the shape this tool reads: say how it is shaped (its keys, no values), and stop.
        console.log('an answer of another shape, with keys: ' + Object.keys(j).join(', ')
          + (j.profile && typeof j.profile === 'object' ? '; and in profile: ' + Object.keys(j.profile).join(', ') : '')
          + '; stopped after ' + seen.length);
        break asking;
      }
      const kindIcon = row.icons.find((ic) => kindOf(ic));
      seen.push({ xid: row.xid, group, state: status.state, until: Number(status.until) || 0,
        numbers: row.icons.map((ic) => num(ic.id)).filter(Boolean),
        // How long the row's own icon said the stay had left, and how old the probe was then.
        left: kindIcon ? (labelOf(kindIcon).text.match(/\b\d+\s*(?:days?|d|hours?|hrs?|h|minutes?|mins?|m|seconds?|secs?|s)\b/gi) || []).join(' ') : '',
        probeAge: Math.round((Date.now() - Date.parse(out.at)) / 1000) });
      await sleep(3000);
    }
  }
  writeFileSync(file.replace(/\.json$/, '') + '.abroad.json', JSON.stringify(seen, null, 1), { mode: 0o600 });
  if (!seen.length) {
    console.log('no answers to tally');
    return;
  }
  if (seen.length < total) console.log('only ' + seen.length + ' of ' + total + ' were asked: what follows covers only those');
  const tally = (list) => list.reduce((m, s) => ((m[s.state] = (m[s.state] || 0) + 1), m), {});
  for (const [group] of groups) console.log(group + ': ' + JSON.stringify(tally(seen.filter((s) => s.group === group))));
  // The gate's two findings: people the script would leave showing who are away, and people it
  // would hide who are not.
  const missed = seen.filter((s) => s.group === 'with no kind icon' && ['Hospital', 'Jail', 'Traveling', 'Abroad'].includes(s.state));
  console.log('left showing, but Torn says Hospital, Jail, Traveling or Abroad: ' + missed.length
    + (missed.length ? ' (' + missed.map((s) => s.state + ', icons ' + s.numbers.join(' ')).join('; ') + ')' : ''));
  const okay = seen.filter((s) => s.group !== 'with no kind icon' && s.state === 'Okay');
  console.log('hidden, but Torn says Okay: ' + okay.length
    + (okay.length ? ' (' + okay.map((s) => 'icons ' + s.numbers.join(' ') + ', its label said ' + (s.left || 'no time') + ', the probe ' + s.probeAge + ' s before').join('; ') + ')' : ''));
}

if (cmd === 'probe') await probe();
else if (cmd === 'summary') summary(JSON.parse(readFileSync(file, 'utf8')));
else if (cmd === 'keyuse') console.log('warboard\'s own calls on the owner\'s key, over the last 5 minutes: ' + (await keyUse()).toFixed(1) + ' a minute');
else if (cmd === 'abroad') await abroad(flag === '--dry');
else console.log('usage: node live.mjs probe <out.json> | summary <probe.json> | keyuse | abroad <probe.json> [--dry]');
```

When the owner says the page is open, run the probe. Its first run also puts a watcher on the page that only reads: it notes in short each change Torn makes there, for the runs after it.

```bash
W=/opt/warboard/.superpowers/sdd/2026-10-25-torn-userlist-filter; cd "$W/live" && node live.mjs probe first.json
```

Expected: the summary, starting `page: /page.php?sid=UserList...`, with no names or ids in it. `first.json` (mode 600) keeps the whole answer. If it says no answer in 60 s, ask the owner whether remote inspect is on and the app is open on the page.

About a minute later, with nothing clicked, run it again, for how often Torn changes the page on its own:

```bash
W=/opt/warboard/.superpowers/sdd/2026-10-25-torn-userlist-filter; cd "$W/live" && node live.mjs probe idle.json
```

Expected: `changes since the run before: N in S s, M of them inside the box the filter watches`. Each change inside that box sets off one check of the rows on the page.

Then ask the owner to click Next once and say when the new page is there, and run it again:

```bash
W=/opt/warboard/.superpowers/sdd/2026-10-25-torn-userlist-filter; cd "$W/live" && node live.mjs probe next.json
```

If the owner is willing, they then change the sort once (a column heading, say), and it runs again as `node live.mjs probe sort.json`.

Then, to learn where the people in the rows really are, the abroad check. It asks Torn's API about up to 10 rows with an abroad icon, 3 with a hospital icon and 3 with a jail icon, then rows with no kind icon, at most 30 in all, 3 s apart, on the owner's key in the Authorization header. Before it asks, it reads warboard's own use of that key over the last 5 minutes from the server's key-usage diagnostic (localhost only), and stops if that is over 50 a minute. The diagnostic counts only what warboard sends, not the owner's own scripts on their devices, so it is a rough look, not a guard: what keeps the check well under Torn's 100 a minute is its spacing, 3 s apart, 20 a minute. `--dry` first says how many it would ask:

```bash
W=/opt/warboard/.superpowers/sdd/2026-10-25-torn-userlist-filter; cd "$W/live" && node live.mjs abroad first.json --dry && node live.mjs abroad first.json
```

Expected: `to ask: N (...)`, the key's use, then a tally of Torn's states for each group, such as `with an abroad icon: {"Traveling":3,"Abroad":2}` and `with no kind icon: {"Okay":14}`, then the gate's two counts, `left showing, but Torn says Hospital, Jail, Traveling or Abroad: 0` and `hidden, but Torn says Okay: 0`. An answer of another shape prints its keys (no values) and stops the check: make the tool read that shape, and run it again.

The gate, item by item (the spec's five, and what this plan's rulings lean on). Write each answer in the ledger as `Live: <item>: <answer>`, with counts, icon numbers and label headings, but no names or ids:

1. **Landed abroad shows the plane, and no one away is left showing.** Pass: the tally with an abroad icon has `"Abroad"` in it, and `left showing, but Torn says ...` is 0.
   - Any `"Abroad"` or `"Traveling"` among the rows with no kind icon fails it. Then STOP: the design goes back to the owner, because abroad needs another way in.
   - A row with no kind icon that Torn says is in `"Hospital"` or `"Jail"` is a finding too. The count prints its icons (a row with only 82, say); the spec leaves 82 to this check.
   - If no one on the page is abroad either way, the owner clicks Next once more and the probe and the abroad check run on that page (`next.json`), up to 3 pages in all. With still no one abroad, ask the owner whether to ship on TornTools' table.
2. **Hospital shows 15.** The summary's `icon 15` line, with label headings that start with "Hospital". Note whether 82 or 91 appear, with what headings. The rows with a hospital icon that were asked about should all be `"Hospital"`. One that Torn says is `"Okay"` is a finding, unless the time its label said was left is shorter than the probe's age: a stay can end between the probe and the call.
3. **Jail shows 16.** The `icon 16` line, and the rows with a jail icon asked about, as in item 2. If no one on the pages seen is in jail, write "not seen" and carry on: 16 comes from TornTools' table, as all the numbers do.
4. **The title bar and the wrapper.** One of each and one list (`ul.user-info-list-wrap: 1; .userlist-wrapper: 1; .users-list-title: 1`), the list inside the wrapper, and the title bar in the filter's wrapper. Without them the fallbacks work (a title bar elsewhere on the page, else before the list; the list's parent). Write which one the page uses. More than one list is a finding: the filter watches only the first one's box.
5. **The labels.** Where they sit (a title or an aria-label, on the icon or inside it) and their headings. Only a number outside TornTools' table goes by its label; write any such number (`kind by label`).
6. **Next.** From `next.json`: whether Torn kept the list, the wrapper, the box above the wrapper, the title bar and the first row, and the order of its changes. The filter watches that box (ruling 3). If Torn replaced the box too, that is a finding: watching it would go deaf after Next. From `idle.json`: how many changes land inside the box with nothing clicked; more than 10 a second is a finding, since each one is a check of the page. From `sort.json`, if run: the same as for Next.
7. **Pages by click.** The `pagination` line, and the owner's word that Next loaded a new page in place. The loading line says which of `.ajax-placeholder` and `.ajax-preloader` Torn shows while it loads.
8. **Rows.** The rows with a name link match the people on the page, and the loading placeholder, if any, has none.
9. **TornTools,** if the owner runs it in the app: its lines after the rows, and its hidden rows.

A finding that needs a code change gets a fix pass like the review's: a failing test first, then the fix, `T` green, `C` clean and the mutant check again, committed on the branch. A finding that changes something the owner decided (abroad, item 1) goes back to the owner instead: STOP.

When the gate passes, tell the owner they can turn remote inspect off.

- [ ] **Step 2: Pre-flight.** Check that the box isn't overloaded, that none of this script's files is in the main checkout (an untracked one there would stop the fast-forward), and that main hasn't moved:

```bash
uptime; cd /opt/warboard && ls server/public/scripts/torn-userlist-filter.user.js server/public/scripts/torn-userlist-filter.meta.js server/torn-userlist-filter.test.mjs 2>&1 | grep -c 'No such file'; git status --short -- server/public/scripts/torn-userlist-filter.user.js server/public/scripts/torn-userlist-filter.meta.js server/torn-userlist-filter.test.mjs docs/superpowers/specs/2026-10-25-torn-userlist-filter-design.md docs/superpowers/plans/2026-10-25-torn-userlist-filter.md && git merge-base --is-ancestor main torn-userlist-filter && echo fast-forward-ok
```

Expected: load under 12, `3`, no status lines, then `fast-forward-ok`.
- If the load is over 12, wait.
- If main has moved, rebase the branch first: `git -C "$WT" rebase main`. Then run `T`, which must be all green.

- [ ] **Step 3: Fast-forward main.** This is the moment tornwar.com starts serving 1.0.0. Git writes the files as root, so their owner goes to warboard:

```bash
cd /opt/warboard && git merge --ff-only torn-userlist-filter && chown warboard:warboard server/public/scripts/torn-userlist-filter.user.js server/public/scripts/torn-userlist-filter.meta.js && chmod 644 server/public/scripts/torn-userlist-filter.user.js server/public/scripts/torn-userlist-filter.meta.js && ls -l server/public/scripts/torn-userlist-filter.user.js server/public/scripts/torn-userlist-filter.meta.js
```

Expected: `Fast-forward`, then both files `-rw-r--r-- warboard warboard`.

- [ ] **Step 4: The whole suite, in place:**

```bash
cd /opt/warboard/server && node --test > /opt/warboard/.superpowers/sdd/2026-10-25-torn-userlist-filter/suite.log 2>&1; grep -E "^# (tests|pass|fail|skipped) " /opt/warboard/.superpowers/sdd/2026-10-25-torn-userlist-filter/suite.log | paste -sd" " -
```

Expected: `# fail 0`, with 2 skipped. The last run had 2467 tests, so this one should have about 2510 (this plan adds 43: 37 in its tasks and 6 from the final review's fix pass), give or take other sessions' work.
- If a failure is this change's, take the script down at once with `git revert --no-edit <first>^..HEAD` on main (first = the Task 1 commit), and stop.
- If a failure is another session's, name it in the report and carry on.

- [ ] **Step 5: Check what is served:**

```bash
curl -s http://127.0.0.1:3000/scripts/torn-userlist-filter.meta.js | grep '@version'; curl -s https://tornwar.com/scripts/torn-userlist-filter.meta.js | grep '@version'; curl -s https://tornwar.com/scripts/torn-userlist-filter.user.js | grep -c "const VERSION = '1.0.0'"; curl -s https://tornwar.com/scripts/torn-userlist-filter.user.js | sha256sum | cut -c1-16; sha256sum /opt/warboard/server/public/scripts/torn-userlist-filter.user.js | cut -c1-16
```

Expected: `// @version      1.0.0` twice, then `1`, then the same 16 characters twice.

- [ ] **Step 6: Push main,** with the remote's credentials masked:

```bash
cd /opt/warboard && git push origin main 2>&1 | sed -E 's#//[^@]*@#//***@#g'; git status -sb | head -1
```

Expected: `main -> main`, and `## main...origin/main` with nothing ahead.

- [ ] **Step 7: Record Task 4,** from inside `$WT`. Run `task-done` with the served-version check as its test command:

```bash
bash -c "curl -s https://tornwar.com/scripts/torn-userlist-filter.meta.js | grep -q '@version      1.0.0' && echo served-1.0.0"
```

Then copy the ledger, `mutants.log` and `suite.log` out of the workspace, to this session's scratchpad, before the workspace goes. The live check's `live/*.json` stay behind: they hold other players' names and ids, and go with the workspace.

- [ ] **Step 8: Remove the worktree, the branch and the workspace.** The symlink goes first: git counts it as untracked, so it would block the removal.

```bash
rm /opt/warboard/.superpowers/sdd/2026-10-25-torn-userlist-filter/wt/server/node_modules && cd /opt/warboard && git worktree remove /opt/warboard/.superpowers/sdd/2026-10-25-torn-userlist-filter/wt && git branch -d torn-userlist-filter && rm -r /opt/warboard/.superpowers/sdd/2026-10-25-torn-userlist-filter && git worktree list
```

Expected: `git worktree list` shows only `/opt/warboard`.

- [ ] **Step 9: Notes and report.**
  - Write this script's project memory, outside the repo: 1.0.0 is live and pushed, what it does, and the live check's answers; still owed: the owner's own check after release and the Greasy Fork upload. Add its index line. The index is at its 200-line cap, so fold an older line into its neighbour to make room.
  - Report to the owner:
    - the rulings and any deferred minors from the ledger;
    - what the live check found;
    - the served URL, https://tornwar.com/scripts/torn-userlist-filter.user.js, to install from and to paste to Greasy Fork;
    - the spec's "Live check (owner, after release)" list.
