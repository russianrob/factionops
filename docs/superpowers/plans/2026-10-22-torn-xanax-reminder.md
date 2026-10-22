# Torn Xanax Reminder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A new userscript that puts a Xanax icon in Torn's row of status icons as soon as your drug cooldown is over. A tap opens your items. In the 24 hours before your faction's next ranked war, the tap offers Armoury or Items instead.

**Architecture:**
- One single-file userscript that runs on every Torn page, in Tampermonkey, Torn PDA and the warboard app.
- Every 2 seconds it reads Torn's own sidebar data from `sessionStorage`, decides whether the drug cooldown is over, and keeps exactly one icon in the row (first, or right after the Blood Bag Reminder's icon).
- While the icon shows and there is an API key, it asks Torn's API for the faction's ranked war at most once every 30 minutes, across tabs (the time of the last call is in GM storage). It works out the 24-hour window from the saved start time on every check.
- The icon is a plain link to your items. In the war window, its click handler opens a small box with two plain links instead. A long press opens a key box.

**Tech Stack:** plain ES2020 userscript; node:test and linkedom for tests. The warboard Express server serves the files as static files from `server/public/scripts/`.

**Spec:** `docs/superpowers/specs/2026-10-22-torn-xanax-reminder-design.md`

## Global Constraints

All paths are relative to the repo root `/opt/warboard`. Run tests from `/opt/warboard/server`.

**Files and header**
- Files: `server/public/scripts/torn-xanax-reminder.user.js` and `server/public/scripts/torn-xanax-reminder.meta.js`, version 1.0.0, owned `warboard:warboard`, mode 644. Tests: `server/torn-xanax-reminder.test.mjs`.
- Header:
  - `@name Torn Xanax Reminder`, `@namespace RussianRob`, `@author RussianRob`, `@version 1.0.0`, `@license All Rights Reserved`, no `@copyright`;
  - `@match https://www.torn.com/*` and `https://torn.com/*`, `@run-at document-idle`;
  - `@grant GM_getValue`, `GM_setValue`, `GM_xmlhttpRequest`, `GM_registerMenuCommand`, and `@connect api.torn.com`;
  - `@downloadURL https://tornwar.com/scripts/torn-xanax-reminder.user.js`, `@updateURL https://tornwar.com/scripts/torn-xanax-reminder.meta.js`.
- The `.meta.js` is the header block, byte for byte, plus a final newline.
- A `// CHANGELOG` block in the format of `server/public/scripts/torn-debuff-mobile-status.user.js`, with the 1.0.0 entry. The in-file `VERSION` is `'1.0.0'`, and the console line on start is `[Torn Xanax Reminder 1.0.0] running`.

**Script rules**
- Ids: `tm-xanax-reminder` (the icon), `tm-xanax-reminder-styles`, `tm-xanax-reminder-tip`, `tm-xanax-reminder-choice`, `tm-xanax-reminder-key`. Every class starts with `tm-xanax-`. GM storage names: `tm-xanax-reminder-key` and `tm-xanax-reminder-war`.
- Links: items `https://www.torn.com/item.php#drugs-items`; armoury `https://www.torn.com/factions.php?step=your&type=1#/tab=armoury&start=0&sub=drugs`.
- The one API call is `https://api.torn.com/v2/faction/wars?key=<key>&comment=xanax-reminder`. It is made only while the icon shows, and at most once every 30 minutes across tabs.
- ASCII-only source. `###PDA-APIKEY###` appears exactly once, so no comment may spell it out. No password field.
- Every `GM_*` call is guarded with `typeof`. Everything the script stores is a string.
- The script never clicks anything itself, never throws into Torn's page, and never shows or logs the key.
- Code style as in `torn-debuff-mobile-status.user.js`: 2-space indent, single quotes, `const`/`let`, and explanatory `//` comments (the owner wants them).

**Repo and box**
- The repo is public (factionops.git). Commit no secrets, no key endings, and no Torn CSS or bundles.
- Stage only this plan's paths. Other sessions' changes sit in the working tree: `server/data/rwp-prices.json`, `server/public/river9-watch.txt`, and deleted and new files under `server/public/s/`.
- `server/public/scripts/` is served as is, so a file there is live the moment it is written. Nobody gets the link until Task 5.
- Never print git remotes or git config in `/opt/warboard`: the remote URL holds a token. Mask push output with `sed -E 's#//[^@]*@#//***@#g'`.
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- `main` is ahead of `origin/main` by the spec's three commits (`bf07fc57`, `b9865b99`, `a0acb500`) and this plan's commit. They go out with this work in Task 5.
- The box is shared and live. Run the full test suite once, in Task 5, with nothing else heavy running. Subagents use `model: "opus"`.
- Torn: at most 100 API calls a minute per key (this script makes at most 2 an hour), and no automated clicks on Torn's pages.

## Review Focus

1. **Storage that misbehaves.** PDA hands GM values back as strings, a trap that has bitten the owner's scripts before. It also keeps them in `localStorage`, which throws on every write once it is full. The war time and the check time must still read, and a stored value that won't parse must read as nothing saved. With storage that won't save at all, a tab must still ask Torn at most once every 30 minutes. Tested in Task 3.
2. **A tap on an iPhone.** If a page changes when a finger "hovers", iOS turns the first tap into a hover and the tap goes nowhere. A touch, `mouseenter` or `mouseover` must open nothing, and the focus a tap gives the link must not open the tooltip either. Tested in Task 2. The test page can't tell a tap's focus from the keyboard's, so that test says which one it is. A real-browser check while writing this plan showed that a touch tap focuses the link without opening the tooltip, while keyboard focus and a mouse hover open it.
3. **The tap that opens the box also closing it.** Page-wide listeners see the opening tap too. The box must stay open through a whole tap (pointerdown, touchstart, pointerup, touchend, mousedown, mouseup, click), and a second tap on the icon must close it. Tested in Task 4.
4. **An answer from Torn in a shape nobody expected:** `{}`, `wars: null`, a start that isn't a number, or an error message that echoes the key. There must be no war line, no broken check, and no key on screen. Tested in Task 3.
5. **Sidebar data that is there but holds no status icons, or a drug cooldown with no readable end.** Neither may ever give a false "ready". Tested in Task 1.

---

## File map

| File | What it is |
|---|---|
| `server/public/scripts/torn-xanax-reminder.user.js` | The whole script, served as is. |
| `server/public/scripts/torn-xanax-reminder.meta.js` | The header only. Userscript managers' update checks read it. |
| `server/torn-xanax-reminder.test.mjs` | The tests. They load the real script into a hand-built Torn page. The test controls the clock, timers, GM storage (shareable between two "tabs"), Torn's API and the console. |

Task 1 creates all three files. Tasks 2 to 4 each append a block of tests to the end of the test file, then change the script with exact edits. Each edit shows the text to find, which occurs exactly once in the file, and the text to put in its place. Make them in the order given, as exact replacements of the text in the code blocks (the Edit tool's `old_string` and `new_string`, exactly as shown). If a find text isn't in the file exactly once, stop: an earlier step went wrong.

All the code in this plan was dry-run against its tests while the plan was written. Each task's new tests failed before its code and passed after it. The test counts in the `Expected:` lines come from that run, and the 23 mutants in Task 5 were all caught.

---

### Task 1: The icon

**Files:**
- Create: `server/torn-xanax-reminder.test.mjs`
- Create: `server/public/scripts/torn-xanax-reminder.user.js`
- Create: `server/public/scripts/torn-xanax-reminder.meta.js`

**Interfaces:**
- Consumes: nothing.
- Produces, in the script:
  - constants `VERSION`, `root`, `ICON_ID`, `STYLE_ID`, `BLOODBAG_ID`, `XANAX_PNG`, `ITEMS_URL`, `ROW_SELECTOR`, `POLL_MS`, `LABEL`, `ICON_CSS`;
  - `readIcons(): object | null`, `cooldownOver(icons: object, nowS: number): boolean`;
  - `let icon` (the `li`, or null), `buildIcon(): HTMLLIElement`, `place(row: HTMLUListElement): void`, `removeIcon(): void`;
  - `labelLines(): string[]`, `setLabel(lines: string[]): void`, `ensureStyles(): void`, `check(): void`.
  - The sections are marked `// ===== TORN'S SIDEBAR DATA =====`, `// ===== THE ICON =====`, `// ===== STYLES =====`, `// ===== THE CHECK =====` and `// ===== START =====`. Later tasks insert their sections before these markers.
- Produces, in the test file: `page(options)` (the harness, with `run`, `check`, `advance`, `scroll`, `setIcons`, `row`, `icon`, `link`, `label`, `store`, `calls`, `menu`, `logs`, `clock`), `fire(w, el, type, fields)`, `answer(call, body)`, `noAnswer(call)`, `settle()`, `order(w)`, `drug(end, title)`, `sidebarData(icons)`, and the constants `SRC`, `META`, `ICON`, `STYLES`, `ITEMS`, `XANAX_PNG`, `LABEL`, `NOW`, `TORN_ICONS`, `HEADER`, `SIDEBARS`.

- [ ] **Step 1: Write the failing tests**

Create `server/torn-xanax-reminder.test.mjs`:

```js
// Torn Xanax Reminder: a Xanax icon in Torn's row of status icons once the drug cooldown is
// over, read from Torn's own sidebar data. These tests load the real script into a hand-built
// Torn page, with the clock, timers, GM storage, Torn's API and the console under their control.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseHTML } from 'linkedom';

// TXR_SRC lets a mutant copy be tested in place of the served file.
const SRC = process.env.TXR_SRC || '/opt/warboard/server/public/scripts/torn-xanax-reminder.user.js';
const META = SRC.replace(/\.user\.js$/, '.meta.js');
const ICON = 'tm-xanax-reminder';
const STYLES = 'tm-xanax-reminder-styles';
const ITEMS = 'https://www.torn.com/item.php#drugs-items';
const XANAX_PNG = 'https://www.torn.com/images/items/206/large.png';
const LABEL = 'Drug cooldown over: Xanax ready';
// The test clock: 2026-10-22 09:48:00 UTC, in Unix seconds.
const NOW = 1792662480;

// Two of Torn's own status icons, as the row holds them.
const TORN_ICONS = '<li class="icon6___GXzRS"><a aria-label="Company"></a></li><li class="icon9___hW3Xh"><a aria-label="Faction"></a></li>';
// Torn's header menu: a list that comes before the sidebar on every page.
const HEADER = '<div id="header-wrapper-top"><ul class="menu-items"><li><a href="/">Home</a></li></ul></div>';
// Torn's sidebar, cut down to the row of status icons, in its three layouts. The Fly-out ones
// also carry the singular statusIcon___, which is not the row. On desktop the "Information"
// title bar sits beside the user block, not around it.
const SIDEBARS = {
  'Fly-out, phone': '<div id="sidebar" class="sidebar___c4dEc mobile___fSMgm"><div class="userInformationMobile___Aznrv">'
    + '<span class="userOnlineStatusIcon___ihAUC"></span><div class="statusIcon___h94cJ"></div>'
    + '<div class="swiperWrapper___gaWYk"><ul class="statusIcons___ks48M big___O1UVc mobile___IzEv7">' + TORN_ICONS + '</ul></div></div></div>',
  'Fly-out, desktop': '<div id="sidebar" class="sidebar___c4dEc desktop___F2V9S"><div class="header___IXOC8">Information</div>'
    + '<div class="userInformation___Tkqft"><span class="userOnlineStatusIcon___ihAUC"></span><div class="statusIcon___h94cJ"></div>'
    + '<ul class="statusIcons___ks48M big___O1UVc">' + TORN_ICONS + '</ul></div></div>',
  'old sidebar (Fly-out off)': '<div id="sidebar" class="sidebar___IcNKj"><div class="user-information-mobile___EaRKJ">'
    + '<div class="swiperWrapper___rBi8E"><ul class="status-icons___sskG2 mobile___YGGsN big___IeUkB">' + TORN_ICONS + '</ul></div></div></div>',
};

// Torn's sidebar data, as both builds save it to sessionStorage. `icons` is statusIcons.icons.
function sidebarData(icons) {
  return JSON.stringify({ bars: { life: { amount: 7400, max: 7500 } }, statusIcons: { icons } });
}

// A drug cooldown entry as Torn saves one, ending at `end` (Unix seconds).
function drug(end, title = 'Drug Cooldown') {
  return { title, subtitle: 'Xanax', timerExpiresAt: end, serverTimestamp: NOW - 60, factionUpgrade: '' };
}

// Answers a call the script made to Torn's API: with a JSON body, or with no answer at all.
function answer(call, body) {
  call.onload({ status: 200, responseText: JSON.stringify(body) });
}
function noAnswer(call) {
  call.onerror({});
}

// Lets the script's promise callbacks run.
const settle = () => new Promise((resolve) => setImmediate(resolve));

// Fires a DOM event at el, with extra fields (key, pointerType, button), and returns it, so a
// test can see whether the script stopped its default action.
function fire(w, el, type, fields = {}) {
  const e = new w.Event(type, { bubbles: true, cancelable: true });
  Object.assign(e, fields);
  el.dispatchEvent(e);
  return e;
}

// Ids and labels of the row's icons, in order.
function order(w) {
  return [...w.row().children].map((li) => li.id || li.querySelector('a').getAttribute('aria-label'));
}

// A Torn page with the script on it. The test controls everything the script reaches for:
// - the clock (w.clock.ms), and timers (w.advance(ms) moves the clock and runs what is due);
// - the 2-second check (w.check() runs it once; the script runs it once itself on start);
// - GM storage (w.store; two pages given the same store share it, as tabs do);
// - Torn's API (w.calls, one per request, answered with answer() or noAnswer());
// - the menu (w.menu) and the console (w.logs).
// Pass `data` for raw sidebar data (null for none), or `icons` for statusIcons.icons. `menu` is
// false for a host with no menu, or 'throws' for one whose menu throws.
function page({ sidebar = 'Fly-out, phone', icons = { drug_cooldown: drug(NOW - 1) }, data, store = {},
  clock = { ms: NOW * 1000 }, src = readFileSync(SRC, 'utf8'), gmRequest = true, menu = true } = {}) {
  const dom = parseHTML('<!doctype html><html><head></head><body>' + HEADER + SIDEBARS[sidebar] + '</body></html>');
  const session = Object.create({ getItem(k) { return Object.prototype.hasOwnProperty.call(this, k) ? this[k] : null; } });
  const saved = data !== undefined ? data : sidebarData(icons);
  if (saved !== null) session.sidebarData137558 = saved;
  const timers = [];
  let timerId = 0;
  const winListeners = {};
  const w = {
    document: dom.document, Event: dom.Event, store, clock, calls: [], menu: {}, logs: [], checks: [], pollMs: null,
    window: {
      innerWidth: 400,
      innerHeight: 800,
      addEventListener(type, fn) { (winListeners[type] = winListeners[type] || []).push(fn); },
      removeEventListener(type, fn) { winListeners[type] = (winListeners[type] || []).filter((f) => f !== fn); },
    },
    row: () => w.document.querySelector('#sidebar ul'),
    icon: () => w.document.getElementById(ICON),
    link: () => (w.icon() ? w.icon().querySelector('a') : null),
    label: () => (w.link() ? w.link().getAttribute('aria-label') : null),
    setIcons(next) { session.sidebarData137558 = sidebarData(next); },
    check() { w.checks.forEach((fn) => fn()); },
    scroll() { (winListeners.scroll || []).forEach((fn) => fn({ type: 'scroll' })); },
    advance(ms) {
      const until = clock.ms + ms;
      for (;;) {
        timers.sort((a, b) => a.at - b.at || a.id - b.id);
        if (!timers.length || timers[0].at > until) break;
        const t = timers.shift();
        clock.ms = Math.max(clock.ms, t.at);
        t.fn();
      }
      clock.ms = until;
    },
    run() {
      new Function('window', 'document', 'sessionStorage', 'GM_getValue', 'GM_setValue', 'GM_registerMenuCommand',
        'GM_xmlhttpRequest', 'fetch', 'setInterval', 'setTimeout', 'clearTimeout', 'Date', 'console', src)(
        w.window, w.document, session,
        (k, d) => (Object.prototype.hasOwnProperty.call(store, k) ? store[k] : d),
        (k, v) => { store[k] = v; },
        menu ? (name, fn) => { if (menu === 'throws') throw new Error('no menu here'); w.menu[name] = fn; } : undefined,
        gmRequest ? (opts) => { w.calls.push(opts); } : undefined,
        (url, init) => new Promise((resolve, reject) => {
          w.calls.push({ url, init, fetch: true,
            onload: (res) => resolve({ text: () => Promise.resolve(res.responseText) }),
            onerror: () => reject(new TypeError('Failed to fetch')) });
        }),
        (fn, ms) => { w.checks.push(fn); w.pollMs = ms; return w.checks.length; },
        (fn, ms) => { timers.push({ id: ++timerId, at: clock.ms + (ms || 0), fn }); return timerId; },
        (id) => { const i = timers.findIndex((t) => t.id === id); if (i >= 0) timers.splice(i, 1); },
        { now: () => clock.ms },
        { log: (...a) => w.logs.push(a.join(' ')), warn: (...a) => w.logs.push(a.join(' ')), error: (...a) => w.logs.push(a.join(' ')) });
      return w;
    },
  };
  return w;
}

// ---------------------------------------------------------------------------------------------
// The icon
// ---------------------------------------------------------------------------------------------

test('the header: the owner\'s script, served from tornwar.com, with its version in the file', () => {
  const src = readFileSync(SRC, 'utf8');
  const end = '// ==/UserScript==';
  const header = src.slice(0, src.indexOf(end) + end.length);
  const tag = (k) => [...header.matchAll(new RegExp('^// @' + k + '\\s+(.+)$', 'gm'))].map((m) => m[1].trim());
  assert.deepEqual(tag('name'), ['Torn Xanax Reminder']);
  assert.deepEqual(tag('namespace'), ['RussianRob']);
  assert.deepEqual(tag('author'), ['RussianRob']);
  assert.deepEqual(tag('version'), ['1.0.0']);
  assert.deepEqual(tag('license'), ['All Rights Reserved']);
  assert.deepEqual(tag('copyright'), []);
  assert.deepEqual(tag('match'), ['https://www.torn.com/*', 'https://torn.com/*']);
  assert.deepEqual(tag('run-at'), ['document-idle']);
  assert.deepEqual(tag('grant'), ['GM_getValue', 'GM_setValue', 'GM_xmlhttpRequest', 'GM_registerMenuCommand']);
  assert.deepEqual(tag('connect'), ['api.torn.com']);
  assert.deepEqual(tag('downloadURL'), ['https://tornwar.com/scripts/torn-xanax-reminder.user.js']);
  assert.deepEqual(tag('updateURL'), ['https://tornwar.com/scripts/torn-xanax-reminder.meta.js']);
  assert.equal(readFileSync(META, 'utf8'), header + '\n', 'the meta file is the header, byte for byte');
  assert.match(src, /const VERSION = '1\.0\.0';/, 'the in-file version matches @version');
  assert.match(src, /^\/\/ v1\.0\.0  - First release\./m, 'the changelog has the 1.0.0 entry');
});

test('the source is plain ASCII, so PDA can run it, and the console line carries the version', () => {
  assert.equal(readFileSync(SRC, 'utf8').match(/[^\x00-\x7f]/g), null);
  assert.deepEqual(page().run().logs, ['[Torn Xanax Reminder 1.0.0] running']);
});

for (const sidebar of Object.keys(SIDEBARS)) {
  test(`${sidebar}: once the drug cooldown is over, the icon goes first in the row`, () => {
    const w = page({ sidebar }).run();
    assert.ok(w.icon(), 'the icon is on the page');
    assert.equal(w.icon().parentNode, w.row(), 'in the row of status icons');
    assert.deepEqual(order(w), [ICON, 'Company', 'Faction'], 'first, so a phone shows it without swiping the strip');
    assert.equal(w.link().getAttribute('href'), ITEMS);
    assert.equal(w.label(), LABEL);
    assert.equal(w.document.querySelectorAll('#header-wrapper-top li').length, 1, 'nothing goes into Torn\'s header menu');
  });

  test(`${sidebar}: the row may grow to fit the icon, and Torn's header menu is left alone`, () => {
    const w = page({ sidebar }).run();
    const css = w.document.getElementById(STYLES).textContent;
    const block = css.split('}').find((b) => /height:\s*auto\s*!important/.test(b));
    assert.ok(block, 'a rule lets the row grow');
    const selector = block.split('{')[0].trim();
    assert.ok(w.row().matches(selector), selector);
    assert.ok(!w.document.querySelector('#header-wrapper-top ul').matches(selector), 'not the header menu');
  });
}

test('the icon is Torn\'s Xanax picture at the size of the other icons, with a thin edge, and pulses once', () => {
  const w = page().run();
  const img = w.icon().querySelector('img');
  assert.equal(img.getAttribute('src'), XANAX_PNG);
  assert.equal(img.getAttribute('width'), '17');
  assert.equal(img.getAttribute('height'), '17');
  const css = w.document.getElementById(STYLES).textContent;
  assert.match(css, /#tm-xanax-reminder img \{[^}]*object-fit: contain;[^}]*drop-shadow\(0 0 \.6px rgba\(0,0,0,\.85\)\)/);
  assert.match(css, /#tm-xanax-reminder \{ animation: tm-xanax-pulse 900ms ease-out 1; \}/);
});

test('while the drug cooldown runs, there is no icon', () => {
  assert.equal(page({ icons: { drug_cooldown: drug(NOW + 3600) } }).run().icon(), null);
});

test('with no drug cooldown in Torn\'s data at all, the icon shows', () => {
  assert.ok(page({ icons: {} }).run().icon());
});

test('other cooldowns don\'t hide the icon', () => {
  const icons = {
    medical_cooldown: { title: 'Medical Cooldown', timerExpiresAt: NOW + 3600 },
    booster_cooldown: { title: 'Booster Cooldown', timerExpiresAt: NOW + 600 },
  };
  assert.ok(page({ icons }).run().icon());
});

test('with no sidebar data, data that won\'t parse, or data without status icons, there is no icon', () => {
  const cases = [null, '{not json', JSON.stringify({ bars: {} }), JSON.stringify({ statusIcons: {} }),
    JSON.stringify({ statusIcons: { icons: null } }), JSON.stringify({ statusIcons: { icons: 'none' } })];
  for (const data of cases) assert.equal(page({ data }).run().icon(), null, String(data));
});

test('a drug cooldown with no readable end time counts as running', () => {
  for (const end of [undefined, null, 0, '', 'soon']) {
    assert.equal(page({ icons: { drug_cooldown: drug(end) } }).run().icon(), null, String(end));
  }
});

test('an end time saved as a number in a string is read as the number', () => {
  assert.equal(page({ icons: { drug_cooldown: drug(String(NOW + 600)) } }).run().icon(), null, 'still running');
  assert.ok(page({ icons: { drug_cooldown: drug(String(NOW - 600)) } }).run().icon(), 'over');
});

test('the drug cooldown is found by its title when Torn keys it differently', () => {
  assert.equal(page({ icons: { icon53: drug(NOW + 600) } }).run().icon(), null);
  assert.equal(page({ icons: { icon53: drug(NOW + 600, 'DRUG COOLDOWN') } }).run().icon(), null, 'any letter case');
  assert.ok(page({ icons: { icon53: drug(NOW - 5) } }).run().icon(), 'and once it has ended, the icon shows');
});

test('when the cooldown comes back the icon goes, and when it ends again the icon comes back', () => {
  const w = page().run();
  assert.ok(w.icon());
  w.setIcons({ drug_cooldown: drug(NOW + 6 * 3600) });   // a Xanax taken
  w.check();
  assert.equal(w.icon(), null);
  w.clock.ms = (NOW + 6 * 3600) * 1000;   // the moment the cooldown ends
  w.check();
  assert.ok(w.icon());
  assert.equal(w.document.querySelectorAll('#' + ICON).length, 1);
});

test('the icon sits right after the blood bag\'s icon, whichever script adds its icon first', () => {
  const bag = (w) => {
    const li = w.document.createElement('li');
    li.id = 'tm-full-life-bloodbag';
    li.innerHTML = '<a aria-label="Blood bag"></a>';
    w.row().insertBefore(li, w.row().firstChild);   // the blood bag puts itself first
  };
  const before = page();
  bag(before);
  before.run();
  assert.deepEqual(order(before), ['tm-full-life-bloodbag', ICON, 'Company', 'Faction'], 'the blood bag was there first');
  const after = page().run();
  bag(after);
  after.check();
  assert.deepEqual(order(after), ['tm-full-life-bloodbag', ICON, 'Company', 'Faction'], 'the blood bag came later');
});

test('repeated checks leave exactly one icon and one stylesheet', () => {
  const w = page().run();
  for (let i = 0; i < 5; i++) w.check();
  assert.equal(w.document.querySelectorAll('#' + ICON).length, 1);
  assert.equal(w.document.querySelectorAll('#' + STYLES).length, 1);
});

test('when Torn replaces the row, the icon moves into the new one', () => {
  const w = page({ sidebar: 'Fly-out, desktop' }).run();
  const old = w.row();
  const fresh = w.document.createElement('ul');
  fresh.className = old.className;
  fresh.innerHTML = TORN_ICONS;
  old.replaceWith(fresh);
  assert.equal(w.icon(), null, 'gone with the old row');
  w.check();
  assert.equal(w.icon().parentNode, fresh);
  assert.deepEqual(order(w), [ICON, 'Company', 'Faction']);
  assert.equal(w.document.querySelectorAll('#' + ICON).length, 1);
});

test('loaded twice on the same page, it runs once, checking every 2 seconds', () => {
  const w = page().run();
  w.run();
  assert.equal(w.checks.length, 1, 'one 2-second check');
  assert.equal(w.pollMs, 2000);
  assert.equal(w.document.querySelectorAll('#' + ICON).length, 1);
  assert.equal(w.logs.length, 1);
});

test('a check that meets an error stops quietly, and the next one works', () => {
  const w = page().run();
  w.icon().remove();
  w.document.querySelector = () => { throw new Error('boom'); };
  assert.doesNotThrow(() => w.check());
  delete w.document.querySelector;
  w.check();
  assert.ok(w.icon());
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `cd /opt/warboard/server && node --test torn-xanax-reminder.test.mjs 2>&1 | grep -E '^# (tests|pass|fail)'`
Expected: `# tests 22`, `# pass 0`, `# fail 22`. Every test fails with ENOENT, because the script doesn't exist yet.

- [ ] **Step 3: Write the script**

Create `server/public/scripts/torn-xanax-reminder.user.js`:

```js
// ==UserScript==
// @name         Torn Xanax Reminder
// @namespace    RussianRob
// @version      1.0.0
// @description  A Xanax icon in Torn's row of status icons as soon as your drug cooldown is over. Tap it to open your items on the Drugs tab. With a Public API key, in the 24 hours before your faction's next ranked war, the tap lets you pick the faction armoury or your items.
// @author       RussianRob
// @downloadURL  https://tornwar.com/scripts/torn-xanax-reminder.user.js
// @updateURL    https://tornwar.com/scripts/torn-xanax-reminder.meta.js
// @license      All Rights Reserved
// @match        https://www.torn.com/*
// @match        https://torn.com/*
// @run-at       document-idle
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_xmlhttpRequest
// @grant        GM_registerMenuCommand
// @connect      api.torn.com
// ==/UserScript==

// =============================================================================
// CHANGELOG
// =============================================================================
// v1.0.0  - First release. A Xanax icon in Torn's row of status icons as soon as your
//           drug cooldown is over, read from Torn's own sidebar data. A tap opens your
//           items on the Drugs tab. With an API key, in the 24 hours before your
//           faction's next ranked war, the tap lets you pick the armoury or your items.

(function () {
  'use strict';

  const VERSION = '1.0.0';

  // Loaded twice on one page (two copies installed, or PDA injecting it again), it runs once.
  // The mark goes on the page itself, which every copy can see; each copy may have its own window.
  const root = document.documentElement;
  if (root.hasAttribute('data-tm-xanax-reminder')) return;
  root.setAttribute('data-tm-xanax-reminder', VERSION);

  const ICON_ID = 'tm-xanax-reminder';
  const STYLE_ID = 'tm-xanax-reminder-styles';
  // The Blood Bag Reminder's icon. When it is in the row, the Xanax goes right after it.
  const BLOODBAG_ID = 'tm-full-life-bloodbag';
  // Torn's own Xanax picture (item 206). It is 100 x 50.
  const XANAX_PNG = 'https://www.torn.com/images/items/206/large.png';
  const ITEMS_URL = 'https://www.torn.com/item.php#drugs-items';
  // The row of status icons. Torn's old sidebar calls it status-icons___ and the Fly-out
  // Sidebar statusIcons___. Only inside #sidebar: Torn's header menu is a list too, and it
  // comes first on every page.
  const ROW_SELECTOR = '#sidebar ul[class*="status-icons"], #sidebar ul[class*="statusIcons___"]';
  const POLL_MS = 2000;
  const LABEL = 'Drug cooldown over: Xanax ready';

  // ===== TORN'S SIDEBAR DATA =====

  // statusIcons.icons from the data both of Torn's sidebars save to sessionStorage on every
  // change. null when the data isn't there, won't parse or has no icons: some pages have no
  // sidebar, and "no data" must never read as "no cooldown".
  function readIcons() {
    try {
      const key = Object.keys(sessionStorage).find((k) => /^sidebarData\d+$/.test(k));
      if (!key) return null;
      const data = JSON.parse(sessionStorage.getItem(key));
      const icons = data && data.statusIcons && data.statusIcons.icons;
      return icons && typeof icons === 'object' ? icons : null;
    } catch (e) {
      return null;
    }
  }

  // True when no drug cooldown entry is still running. An entry is the drug cooldown by its
  // key or by its title (Torn's API calls it "Drug Cooldown"). One without a readable end
  // time counts as running.
  function cooldownOver(icons, nowS) {
    return !Object.keys(icons).some((k) => {
      const entry = icons[k];
      if (!entry || typeof entry !== 'object') return false;
      if (k !== 'drug_cooldown' && !/^drug cooldown/i.test(String(entry.title || ''))) return false;
      const end = Number(entry.timerExpiresAt);
      return !(end > 0) || end > nowS;
    });
  }

  // ===== THE ICON =====

  // The icon's li. It is built once and put back whenever Torn redraws the row.
  let icon = null;

  function buildIcon() {
    const li = document.createElement('li');
    li.id = ICON_ID;
    const a = document.createElement('a');
    a.href = ITEMS_URL;
    const img = document.createElement('img');
    img.src = XANAX_PNG;
    img.alt = 'Xanax';
    img.width = 17;
    img.height = 17;
    a.appendChild(img);
    li.appendChild(a);
    return li;
  }

  // First in the row, or right after the blood bag's icon when that is in the row. The blood
  // bag puts itself first, so the order is the same whichever script adds its icon first.
  function place(row) {
    const bag = document.getElementById(BLOODBAG_ID);
    if (bag && bag.parentNode === row) bag.after(icon);
    else row.insertBefore(icon, row.firstChild);
  }

  function removeIcon() {
    if (icon && icon.parentNode) icon.remove();
  }

  // The icon's label, line by line: for the tooltip, and joined for screen readers.
  function labelLines() {
    return [LABEL];
  }

  function setLabel(lines) {
    const a = icon.firstChild;
    const text = lines.join('. ');
    if (a.getAttribute('aria-label') !== text) a.setAttribute('aria-label', text);
  }

  // ===== STYLES =====

  const ICON_CSS = [
    // Torn's desktop row is a fixed-height grid that hides what doesn't fit, and one more
    // icon can need another line. Only Torn's row, inside #sidebar.
    ROW_SELECTOR + ' { height: auto !important; overflow: visible !important; }',
    // Torn draws its own icons with a sprite and pseudo-elements; none of that on this one.
    '#' + ICON_ID + ', #' + ICON_ID + ' a, #' + ICON_ID + ' img { background: none !important; -webkit-mask: none !important; mask: none !important; box-shadow: none !important; border: none !important; }',
    '#' + ICON_ID + '::before, #' + ICON_ID + '::after, #' + ICON_ID + ' a::before, #' + ICON_ID + ' a::after { content: none !important; }',
    // One pulse when the icon is added.
    '#' + ICON_ID + ' { animation: tm-xanax-pulse 900ms ease-out 1; }',
    '@keyframes tm-xanax-pulse { 0% { transform: scale(0.9); } 60% { transform: scale(1.1); } 100% { transform: scale(1); } }',
    '#' + ICON_ID + ' a { display: block; width: 17px; height: 17px; }',
    // The 100 x 50 picture fits the 17 x 17 box as a pill, with a thin dark edge so it shows
    // in light mode. No max-width or max-height, so no page style can shrink it.
    '#' + ICON_ID + ' img { display: block; width: 17px; height: 17px; max-width: none; max-height: none; object-fit: contain; filter: drop-shadow(0 0 .6px rgba(0,0,0,.85)); }',
  ].join('\n');

  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = ICON_CSS;
    (document.head || root).appendChild(style);
  }

  // ===== THE CHECK =====

  // Every 2 seconds: is the drug cooldown over, and is the icon where it belongs? The row is
  // found afresh each time, so the icon follows Torn when it redraws the sidebar.
  function check() {
    try {
      const nowMs = Date.now();
      const icons = readIcons();
      const row = icons ? document.querySelector(ROW_SELECTOR) : null;
      if (!row || !cooldownOver(icons, nowMs / 1000)) {
        removeIcon();
        return;
      }
      ensureStyles();
      if (!icon) icon = buildIcon();
      if (icon.parentNode !== row) place(row);
      setLabel(labelLines());
    } catch (e) {
      // A bad value stops this one check. It never reaches Torn's page.
    }
  }

  // ===== START =====

  setInterval(check, POLL_MS);
  check();
  console.log('[Torn Xanax Reminder ' + VERSION + '] running');
})();
```

- [ ] **Step 4: Write the meta file and set the owner**

The meta file is the header block, byte for byte, plus a newline:

```bash
cd /opt/warboard/server/public/scripts && node -e 'const fs = require("fs"); const s = fs.readFileSync("torn-xanax-reminder.user.js", "utf8"); const end = "// ==/UserScript=="; fs.writeFileSync("torn-xanax-reminder.meta.js", s.slice(0, s.indexOf(end) + end.length) + "\n");' && chown warboard:warboard torn-xanax-reminder.user.js torn-xanax-reminder.meta.js && chmod 644 torn-xanax-reminder.user.js torn-xanax-reminder.meta.js && node --check torn-xanax-reminder.user.js && wc -l torn-xanax-reminder.meta.js
```

Expected: no output from `node --check`, and `18 torn-xanax-reminder.meta.js`.

- [ ] **Step 5: Run the tests to see them pass**

Run: `cd /opt/warboard/server && node --test torn-xanax-reminder.test.mjs 2>&1 | grep -E '^# (tests|pass|fail)'`
Expected: `# tests 22`, `# pass 22`, `# fail 0`.

- [ ] **Step 6: Commit**

```bash
cd /opt/warboard && git add server/torn-xanax-reminder.test.mjs server/public/scripts/torn-xanax-reminder.user.js server/public/scripts/torn-xanax-reminder.meta.js && git commit -m "torn-xanax-reminder: the icon (1.0.0, task 1 of 4)

A Xanax icon in Torn's row of status icons once the drug cooldown is over,
read from Torn's own sidebar data: first in the row, or after the blood bag.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: The tooltip

**Files:**
- Modify: `server/public/scripts/torn-xanax-reminder.user.js` (8 edits)
- Test: `server/torn-xanax-reminder.test.mjs` (append)

**Interfaces:**
- Consumes from Task 1: `icon`, `LABEL`, `STYLE_ID`, `buildIcon()`, `removeIcon()`, `setLabel(lines)`, `ICON_CSS`, `ensureStyles()`, the `// ===== STYLES =====` marker, and the start section's `setInterval(check, POLL_MS);` line. In the tests: `page`, `fire`, `drug`, `NOW`, `LABEL`, `STYLES`.
- Produces, in the script:
  - `TIP_ID`, `let tip` (the open tooltip, or null), `let tipLines` (the label's lines);
  - `showTip(): void`, `fillTip(): void`, `hideTip(): void`, `keyboardFocus(el: Element): boolean`;
  - `placeNear(el: HTMLElement, anchor: Element, above: boolean): void`, which Task 4's box uses too;
  - `TIP_CSS`;
  - a `// ===== THE TOOLTIP =====` section, just before `// ===== STYLES =====`.
- Produces, in the tests: the constant `TIP`.

- [ ] **Step 1: Write the failing tests**

Append this to the end of `server/torn-xanax-reminder.test.mjs`, after a blank line:

```js
// ---------------------------------------------------------------------------------------------
// The tooltip
// ---------------------------------------------------------------------------------------------

const TIP = 'tm-xanax-reminder-tip';

test('a mouse hover shows a tooltip like Torn\'s, with the label in bold, and leaving hides it', () => {
  const w = page().run();
  fire(w, w.link(), 'pointerenter', { pointerType: 'mouse' });
  const tip = w.document.getElementById(TIP);
  assert.ok(tip, 'the tooltip is open');
  assert.equal(tip.getAttribute('role'), 'tooltip');
  assert.deepEqual([...tip.children].map((el) => [el.tagName, el.textContent]), [['B', LABEL]]);
  fire(w, w.link(), 'pointerleave', { pointerType: 'mouse' });
  assert.equal(w.document.getElementById(TIP), null);
});

test('a touch opens no tooltip, so an iPhone never turns the tap into a hover', () => {
  const w = page().run();
  fire(w, w.link(), 'pointerenter', { pointerType: 'touch' });
  fire(w, w.link(), 'mouseenter');
  fire(w, w.link(), 'mouseover');
  assert.equal(w.document.getElementById(TIP), null);
  fire(w, w.link(), 'pointerenter', { pointerType: 'mouse' });
  assert.ok(w.document.getElementById(TIP), 'a mouse does open it');
});

test('focus shows the tooltip and blur hides it', () => {
  const w = page().run();
  fire(w, w.link(), 'focus');
  assert.ok(w.document.getElementById(TIP));
  fire(w, w.link(), 'blur');
  assert.equal(w.document.getElementById(TIP), null);
});

test('focus from a tap opens no tooltip, and focus from the keyboard does', () => {
  const w = page().run();
  const link = w.link();
  const real = link.matches.bind(link);
  // The test page can't tell the two apart, so the test says what the browser would: a tap's
  // focus is not :focus-visible, the keyboard's is.
  const focusVisible = (yes) => {
    link.matches = (selector) => (selector === ':focus-visible' ? yes : real(selector));
  };
  focusVisible(false);
  fire(w, link, 'focus');
  assert.equal(w.document.getElementById(TIP), null, 'a tap');
  fire(w, link, 'blur');
  focusVisible(true);
  fire(w, link, 'focus');
  assert.ok(w.document.getElementById(TIP), 'the keyboard');
});

test('scrolling hides the tooltip', () => {
  const w = page().run();
  fire(w, w.link(), 'focus');
  assert.ok(w.document.getElementById(TIP), 'open');
  w.scroll();
  assert.equal(w.document.getElementById(TIP), null);
});

test('the tooltip never doubles, and goes with the icon', () => {
  const w = page().run();
  fire(w, w.link(), 'focus');
  fire(w, w.link(), 'pointerenter', { pointerType: 'mouse' });
  assert.equal(w.document.querySelectorAll('#' + TIP).length, 1);
  w.setIcons({ drug_cooldown: drug(NOW + 3600) });
  w.check();
  assert.equal(w.document.getElementById(TIP), null);
});

test('the tooltip is placed inside the screen, with a number for each side', () => {
  const w = page().run();
  fire(w, w.link(), 'focus');
  const style = w.document.getElementById(TIP).getAttribute('style') || '';
  assert.match(style, /left:\s*\d+px/);
  assert.match(style, /top:\s*\d+px/);
  assert.doesNotMatch(style, /NaN/);
  const css = w.document.getElementById(STYLES).textContent;
  assert.match(css, /#tm-xanax-reminder-tip \{ position: fixed; z-index: 99999; pointer-events: none;/);
});
```

- [ ] **Step 2: Run them to see the new ones fail**

Run: `cd /opt/warboard/server && node --test torn-xanax-reminder.test.mjs 2>&1 | grep -E '^# (tests|pass|fail)'`
Expected: `# tests 29`, `# pass 22`, `# fail 7`. All seven new tests fail, because there is no tooltip yet.

- [ ] **Step 3: Edit the script**

**Edit 1 of 8: its id, after `STYLE_ID`.** Find:

```js
  const STYLE_ID = 'tm-xanax-reminder-styles';
```

Replace with:

```js
  const STYLE_ID = 'tm-xanax-reminder-styles';
  const TIP_ID = 'tm-xanax-reminder-tip';
```

**Edit 2 of 8: the hover and focus handlers, at the end of `buildIcon()`.** Find:

```js
    a.appendChild(img);
    li.appendChild(a);
    return li;
  }
```

Replace with:

```js
    a.appendChild(img);
    li.appendChild(a);
    // The tooltip opens on a mouse hover or on focus, never on a touch. On an iPhone, a page
    // that changes when a finger "hovers" turns the first tap into a hover, and the tap goes
    // nowhere; so there is no mouseenter or mouseover handler at all.
    a.addEventListener('pointerenter', (e) => {
      if (e.pointerType === 'mouse') showTip();
    });
    a.addEventListener('pointerleave', hideTip);
    a.addEventListener('focus', () => {
      if (keyboardFocus(a)) showTip();
    });
    a.addEventListener('blur', hideTip);
    return li;
  }
```

**Edit 3 of 8: the tooltip goes with the icon, in `removeIcon()`.** Find:

```js
  function removeIcon() {
    if (icon && icon.parentNode) icon.remove();
  }
```

Replace with:

```js
  function removeIcon() {
    hideTip();
    if (icon && icon.parentNode) icon.remove();
  }
```

**Edit 4 of 8: an open tooltip follows the label, in `setLabel()`.** Find:

```js
  function setLabel(lines) {
    const a = icon.firstChild;
    const text = lines.join('. ');
    if (a.getAttribute('aria-label') !== text) a.setAttribute('aria-label', text);
  }
```

Replace with:

```js
  function setLabel(lines) {
    tipLines = lines;
    const a = icon.firstChild;
    const text = lines.join('. ');
    if (a.getAttribute('aria-label') !== text) a.setAttribute('aria-label', text);
    if (tip) fillTip();
  }
```

**Edit 5 of 8: the tooltip section, just before the `// ===== STYLES =====` line.** Find:

```js
  // ===== STYLES =====
```

Replace with:

```js
  // ===== THE TOOLTIP =====

  // The open tooltip, if any, and the label it shows, line by line.
  let tip = null;
  let tipLines = [LABEL];

  // A tooltip like Torn's own, over the icon: the first line in bold, the others under it.
  function showTip() {
    if (!icon || !icon.parentNode) return;
    if (!tip) {
      tip = document.createElement('div');
      tip.id = TIP_ID;
      tip.setAttribute('role', 'tooltip');
      document.body.appendChild(tip);
    }
    fillTip();
  }

  function fillTip() {
    tip.textContent = '';
    tipLines.forEach((line, i) => {
      const el = document.createElement(i === 0 ? 'b' : 'div');
      el.textContent = line;
      tip.appendChild(el);
    });
    placeNear(tip, icon, true);
  }

  function hideTip() {
    if (!tip) return;
    tip.remove();
    tip = null;
  }

  // Focus from the keyboard, not from a tap: on a phone a tap focuses the link too, and the
  // tooltip would linger after it. A browser that can't tell the two apart says yes.
  function keyboardFocus(el) {
    try {
      return el.matches(':focus-visible');
    } catch (e) {
      return true;
    }
  }

  // Puts one of the script's boxes over the icon (above) or under it, inside the screen. With
  // no room above, it goes under. The arrow (a CSS ::after) points at the icon's middle.
  function placeNear(el, anchor, above) {
    try {
      const r = anchor.getBoundingClientRect();
      const width = el.offsetWidth || 0;
      const height = el.offsetHeight || 0;
      const middle = r.left + r.width / 2;
      const left = Math.max(8, Math.min(Math.round(middle - width / 2), (window.innerWidth || 0) - width - 8));
      let top = Math.round(r.top - height - 10);
      const under = !above || top < 8;
      if (under) top = Math.round(r.bottom + 10);
      el.style.left = left + 'px';
      el.style.top = top + 'px';
      el.style.setProperty('--tm-xanax-arrow', Math.round(middle - left) + 'px');
      el.classList.toggle('tm-xanax-under', under);
    } catch (e) {
      // It stays where the stylesheet puts it.
    }
  }

  // ===== STYLES =====
```

**Edit 6 of 8: its look, after `ICON_CSS`.** Find:

```js
    '#' + ICON_ID + ' img { display: block; width: 17px; height: 17px; max-width: none; max-height: none; object-fit: contain; filter: drop-shadow(0 0 .6px rgba(0,0,0,.85)); }',
  ].join('\n');
```

Replace with:

```js
    '#' + ICON_ID + ' img { display: block; width: 17px; height: 17px; max-width: none; max-height: none; object-fit: contain; filter: drop-shadow(0 0 .6px rgba(0,0,0,.85)); }',
  ].join('\n');

  // Torn's own tooltip look: dark grey, light text, a small arrow at the icon.
  const TIP_CSS = [
    '#' + TIP_ID + ' { position: fixed; z-index: 99999; pointer-events: none; box-sizing: border-box; max-width: 240px; padding: 8px; border-radius: 4px; background: #444; color: #ddd; box-shadow: 0 0 2px 0 rgba(0,0,0,.65); font: 400 12px/14px Arial, sans-serif; text-align: left; }',
    '#' + TIP_ID + ' b { display: block; font-weight: 700; }',
    '#' + TIP_ID + ' div { margin-top: 2px; }',
    '#' + TIP_ID + '::after { content: ""; position: absolute; bottom: -4px; left: var(--tm-xanax-arrow, 50%); width: 8px; height: 8px; margin-left: -4px; background: #444; transform: rotate(45deg); }',
    '#' + TIP_ID + '.tm-xanax-under::after { top: -4px; bottom: auto; }',
  ].join('\n');
```

**Edit 7 of 8: the stylesheet takes both, in `ensureStyles()`.** Find:

```js
    style.textContent = ICON_CSS;
```

Replace with:

```js
    style.textContent = ICON_CSS + '\n' + TIP_CSS;
```

**Edit 8 of 8: scrolling hides it, in the start section.** Find:

```js
  setInterval(check, POLL_MS);
```

Replace with:

```js
  // Scrolling moves the icon, and the tooltip would float away from it.
  window.addEventListener('scroll', hideTip, { capture: true, passive: true });
  setInterval(check, POLL_MS);
```

- [ ] **Step 4: Run the tests to see them pass**

Run: `cd /opt/warboard/server && node --check public/scripts/torn-xanax-reminder.user.js && node --test torn-xanax-reminder.test.mjs 2>&1 | grep -E '^# (tests|pass|fail)'`
Expected: `# tests 29`, `# pass 29`, `# fail 0`.

- [ ] **Step 5: Commit**

```bash
cd /opt/warboard && git add server/torn-xanax-reminder.test.mjs server/public/scripts/torn-xanax-reminder.user.js && git commit -m "torn-xanax-reminder: the tooltip (task 2 of 4)

A tooltip like Torn's on mouse hover or keyboard focus. A touch opens
nothing, so an iPhone never turns the tap into a hover.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: The war time and the key

**Files:**
- Modify: `server/public/scripts/torn-xanax-reminder.user.js` (5 edits)
- Test: `server/torn-xanax-reminder.test.mjs` (append)

**Interfaces:**
- Consumes from Task 1: `LABEL`, `labelLines()` (replaced here by `labelLines(nowMs)`), `check()`'s `setLabel(labelLines());` line, and the `// ===== TORN'S SIDEBAR DATA =====` and `// ===== THE ICON =====` markers. From Task 2's tests: `TIP`. From Task 1's tests: `page`, `fire`, `answer`, `noAnswer`, `settle`, `drug`, `NOW`, `LABEL`, `SRC`.
- Produces, in the script:
  - constants `KEY_STORE`, `WAR_STORE`, `CALL_EVERY_MS`, `WINDOW_S`, `PDA_KEY`, `HAS_PDA_KEY`;
  - `gmGet(name: string): any`, `gmSet(name: string, value: string): void`;
  - `apiKey(): string` (`''` for none);
  - `readWar(): { at: number, start: number, end: number, error: string }`, `writeWar(war): void`;
  - `let askedAt` (this tab's own last call in ms, or null: the 30-minute limit when storage won't save) and `maybeAsk(nowMs: number): void`;
  - `askTorn(key: string): Promise<object | null>`, which rejects with a message string;
  - `hideKey(text: string, key: string): string`;
  - `warSecondsLeft(nowMs: number): number` (0 outside the window), `untilText(seconds: number): string`;
  - `labelLines(nowMs: number): string[]`;
  - `// ===== GM STORAGE =====` and `// ===== THE WAR TIME =====` sections.
- Produces, in the tests: `KEY`, `KEY_STORE`, `WAR_STORE`, `START`, `WAR_LINE`, `URL`, `wars(ranked)`, `ranked(start, end)`.

- [ ] **Step 1: Write the failing tests**

Append this to the end of `server/torn-xanax-reminder.test.mjs`, after a blank line:

```js
// ---------------------------------------------------------------------------------------------
// The war time and the key
// ---------------------------------------------------------------------------------------------

const KEY = 'TESTKEY123456789';   // the shape of a Torn key; not a real one
const KEY_STORE = 'tm-xanax-reminder-key';
const WAR_STORE = 'tm-xanax-reminder-war';
const START = NOW + 5 * 3600 + 12 * 60;   // a ranked war starting 5h 12m after the test clock
const WAR_LINE = 'War starts in 5h 12m: tap to pick the armoury or your items';
const URL = 'https://api.torn.com/v2/faction/wars?key=' + KEY + '&comment=xanax-reminder';
// Torn's answer to /v2/faction/wars, and its ranked war (end is null until the war ends).
const wars = (ranked) => ({ pacts: [], wars: { ranked, raids: [], territory: [] } });
const ranked = (start, end = null) => ({ war_id: 51418, start, end, target: 3000, winner: null, factions: [] });

test('the source carries PDA\'s key placeholder exactly once', () => {
  assert.equal(readFileSync(SRC, 'utf8').split('###PDA-APIKEY###').length - 1, 1);
});

test('with no key there is no call, and no extra line', () => {
  const w = page().run();
  w.check();
  assert.equal(w.calls.length, 0);
  assert.equal(w.label(), LABEL);
  w.store[KEY_STORE] = KEY;
  w.check();
  assert.equal(w.calls.length, 1, 'with a key, it asks');
});

test('with a key, the check asks Torn about your faction\'s wars, without cookies', () => {
  const w = page({ store: { [KEY_STORE]: KEY } }).run();
  assert.equal(w.calls.length, 1);
  assert.equal(w.calls[0].method, 'GET');
  assert.equal(w.calls[0].url, URL);
  assert.equal(w.calls[0].anonymous, true);
});

test('no call while the drug cooldown runs, or on a page without the row', () => {
  const w = page({ icons: { drug_cooldown: drug(NOW + 3600) }, store: { [KEY_STORE]: KEY } }).run();
  w.check();
  assert.equal(w.calls.length, 0, 'on cooldown');
  w.setIcons({ drug_cooldown: drug(NOW - 1) });
  w.check();
  assert.equal(w.calls.length, 1, 'once it is over, it asks');
  const bare = page({ store: { [KEY_STORE]: KEY } });
  const row = bare.row();
  const holder = row.parentNode;
  row.remove();
  bare.run();
  assert.equal(bare.calls.length, 0, 'no row');
  holder.appendChild(row);
  bare.check();
  assert.equal(bare.calls.length, 1, 'with the row back, it asks');
});

test('in the 24 hours before the war, the label says when it starts', async () => {
  const w = page({ store: { [KEY_STORE]: KEY } }).run();
  answer(w.calls[0], wars(ranked(START)));
  await settle();
  w.check();
  assert.equal(w.label(), LABEL + '. ' + WAR_LINE);
});

test('the war line runs from 24 hours before the start until the start', async () => {
  const cases = [
    [NOW + 86400, 'War starts in 24h 0m: tap to pick the armoury or your items', 'exactly 24 hours before'],
    [NOW + 86401, null, 'just over 24 hours before'],
    [NOW + 5 * 3600 + 11 * 60 + 30, WAR_LINE, 'minutes round up'],
    [NOW + 45 * 60, 'War starts in 45m: tap to pick the armoury or your items', 'under an hour'],
    [NOW + 30, 'War starts in 1m: tap to pick the armoury or your items', 'under a minute: never 0m'],
    [NOW, null, 'at the start'],
    [NOW - 3600, null, 'once it has started'],
  ];
  for (const [start, line, why] of cases) {
    const w = page({ store: { [KEY_STORE]: KEY } }).run();
    answer(w.calls[0], wars(ranked(start)));
    await settle();
    w.check();
    assert.equal(w.label(), line ? LABEL + '. ' + line : LABEL, why);
  }
});

test('no ranked war, or one with an end time, gives no war line', async () => {
  for (const reply of [wars(null), wars(ranked(START, NOW - 60))]) {
    const w = page({ store: { [KEY_STORE]: KEY } }).run();
    answer(w.calls[0], reply);
    await settle();
    w.check();
    assert.equal(w.label(), LABEL);
  }
});

test('the window opens and closes as the clock moves, without a reload', async () => {
  const w = page({ store: { [KEY_STORE]: KEY } }).run();
  answer(w.calls[0], wars(ranked(NOW + 86400 + 600)));   // 24h 10m away
  await settle();
  w.check();
  assert.equal(w.label(), LABEL, 'not yet');
  w.clock.ms += 600 * 1000;
  w.check();
  assert.match(w.label(), /War starts in 24h 0m/, 'open');
  w.clock.ms += 86400 * 1000;
  w.check();
  assert.equal(w.label(), LABEL, 'the war has started');
});

test('at most one call per 30 minutes, even with two tabs sharing storage', () => {
  const store = { [KEY_STORE]: KEY };
  const clock = { ms: NOW * 1000 };
  const a = page({ store, clock }).run();
  const b = page({ store, clock }).run();
  assert.equal(a.calls.length + b.calls.length, 1, 'the second tab sees the first one\'s call');
  clock.ms += 29 * 60 * 1000;
  a.check();
  b.check();
  assert.equal(a.calls.length + b.calls.length, 1, 'not again within 30 minutes');
  clock.ms += 60 * 1000;
  a.check();
  b.check();
  assert.equal(a.calls.length + b.calls.length, 2, 'once more after 30 minutes');
});

test('storage that will not save, like a full localStorage in PDA, still means one call per 30 minutes', async () => {
  // Every write throws, as a full localStorage does; the saved key still reads.
  const store = new Proxy({ [KEY_STORE]: KEY }, { set() { throw new Error('QuotaExceededError'); } });
  const w = page({ store }).run();
  assert.equal(w.calls.length, 1);
  noAnswer(w.calls[0]);
  await settle();
  w.check();
  w.clock.ms += 29 * 60 * 1000;
  w.check();
  assert.equal(w.calls.length, 1, 'not again within 30 minutes');
  w.clock.ms += 60 * 1000;
  w.check();
  assert.equal(w.calls.length, 2, 'once more after 30 minutes');
});

test('a Torn error shows in the label, and the next try waits 30 minutes', async () => {
  const w = page({ store: { [KEY_STORE]: KEY } }).run();
  answer(w.calls[0], { error: { code: 2, error: 'Incorrect key' } });
  await settle();
  w.check();
  assert.equal(w.label(), LABEL + '. Couldn\'t check the war time: Incorrect key');
  w.clock.ms += 10 * 60 * 1000;
  w.check();
  assert.equal(w.calls.length, 1);
  w.clock.ms += 20 * 60 * 1000;
  w.check();
  assert.equal(w.calls.length, 2);
});

test('no answer from Torn is said as such', async () => {
  const w = page({ store: { [KEY_STORE]: KEY } }).run();
  noAnswer(w.calls[0]);
  await settle();
  w.check();
  assert.equal(w.label(), LABEL + '. Couldn\'t check the war time: no answer from Torn');
});

test('an error after a good answer keeps that answer, and a good answer clears the error', async () => {
  const w = page({ store: { [KEY_STORE]: KEY } }).run();
  answer(w.calls[0], wars(ranked(START)));
  await settle();
  w.clock.ms += 30 * 60 * 1000;
  w.check();
  noAnswer(w.calls[1]);
  await settle();
  w.check();
  assert.equal(w.label(), LABEL + '. War starts in 4h 42m: tap to pick the armoury or your items. Couldn\'t check the war time: no answer from Torn');
  w.clock.ms += 30 * 60 * 1000;
  w.check();
  answer(w.calls[2], wars(ranked(START)));
  await settle();
  w.check();
  assert.equal(w.label(), LABEL + '. War starts in 4h 12m: tap to pick the armoury or your items');
});

test('the key never shows in the label, the tooltip or the console', async () => {
  const w = page({ store: { [KEY_STORE]: KEY } }).run();
  answer(w.calls[0], { error: { code: 2, error: 'Incorrect key ' + KEY } });
  await settle();
  w.check();
  fire(w, w.link(), 'focus');
  const seen = [w.label(), w.document.getElementById(TIP).textContent, ...w.logs].join('\n');
  assert.ok(!seen.includes(KEY));
  assert.match(w.label(), /Incorrect key \*\*\*\*/);
});

test('the answer is kept for every tab', async () => {
  const store = { [KEY_STORE]: KEY };
  const clock = { ms: NOW * 1000 };
  const a = page({ store, clock }).run();
  answer(a.calls[0], wars(ranked(START)));
  await settle();
  const b = page({ store, clock }).run();
  assert.equal(b.calls.length, 0);
  assert.equal(b.label(), LABEL + '. ' + WAR_LINE);
});

test('a saved key beats PDA\'s, and PDA\'s is used when none is saved', () => {
  const src = readFileSync(SRC, 'utf8').replace('###PDA-APIKEY###', 'PDAKEY0123456789');
  assert.match(page({ src }).run().calls[0].url, /key=PDAKEY0123456789&/);
  assert.equal(page({ src, store: { [KEY_STORE]: KEY } }).run().calls[0].url, URL);
});

test('a host without GM_xmlhttpRequest asks with fetch', async () => {
  const w = page({ store: { [KEY_STORE]: KEY }, gmRequest: false }).run();
  assert.equal(w.calls.length, 1);
  assert.ok(w.calls[0].fetch);
  assert.equal(w.calls[0].url, URL);
  answer(w.calls[0], wars(ranked(START)));
  await settle();
  w.check();
  assert.equal(w.label(), LABEL + '. ' + WAR_LINE);
});

test('the open tooltip follows a new label', async () => {
  const w = page({ store: { [KEY_STORE]: KEY } }).run();
  fire(w, w.link(), 'focus');
  answer(w.calls[0], wars(ranked(START)));
  await settle();
  w.check();
  assert.deepEqual([...w.document.getElementById(TIP).children].map((el) => el.textContent), [LABEL, WAR_LINE]);
});

test('stored values that come back as strings, or as objects, still work', () => {
  // PDA hands stored values back as strings; another host might hand back the parsed object.
  const asObject = page({ store: { [KEY_STORE]: KEY, [WAR_STORE]: { at: String(NOW * 1000), start: String(START), end: '0', error: '' } } }).run();
  assert.equal(asObject.calls.length, 0, 'the check time was read');
  assert.equal(asObject.label(), LABEL + '. ' + WAR_LINE);
  const junk = page({ store: { [KEY_STORE]: KEY, [WAR_STORE]: '{"at":' } }).run();
  assert.equal(junk.calls.length, 1, 'a stored value that won\'t parse is nothing saved');
  assert.equal(junk.label(), LABEL);
});

test('a stored check time in the future (the clock moved back) means ask now', () => {
  const later = JSON.stringify({ at: (NOW + 86400) * 1000, start: 0, end: 0, error: '' });
  assert.equal(page({ store: { [KEY_STORE]: KEY, [WAR_STORE]: later } }).run().calls.length, 1);
});

test('an answer of an unexpected shape gives no war line and never breaks the check', async () => {
  for (const reply of [{}, { wars: null }, wars({ start: 'soon', end: null }), wars('x')]) {
    const w = page({ store: { [KEY_STORE]: KEY } }).run();
    answer(w.calls[0], reply);
    await settle();
    assert.doesNotThrow(() => w.check());
    assert.ok(w.icon(), JSON.stringify(reply));
    assert.doesNotMatch(w.label(), /War starts/);
  }
});
```

- [ ] **Step 2: Run them to see the new ones fail**

Run: `cd /opt/warboard/server && node --test torn-xanax-reminder.test.mjs 2>&1 | grep -E '^# (tests|pass|fail)'`
Expected: `# tests 50`, `# pass 29`, `# fail 21`. All twenty-one new tests fail, because the script never asks Torn yet.

- [ ] **Step 3: Edit the script**

**Edit 1 of 5: the storage names, timings and PDA's key, after `LABEL`.** Find:

```js
  const LABEL = 'Drug cooldown over: Xanax ready';
```

Replace with:

```js
  const LABEL = 'Drug cooldown over: Xanax ready';
  // GM storage: the key from the key box, and what Torn last said about the war.
  const KEY_STORE = 'tm-xanax-reminder-key';
  const WAR_STORE = 'tm-xanax-reminder-war';
  // Torn is asked at most this often, across all tabs.
  const CALL_EVERY_MS = 30 * 60 * 1000;
  // The war window: the 24 hours before the start.
  const WINDOW_S = 24 * 60 * 60;
  // PDA puts your API key in place of this placeholder when it loads the script. The file must
  // hold the placeholder once only: PDA finds it by its text, and a second copy breaks the swap.
  const PDA_KEY = '###PDA-APIKEY###';
  // Still the placeholder (it has the #s) means PDA didn't swap it, or this isn't PDA.
  const HAS_PDA_KEY = PDA_KEY.indexOf('##') === -1 && PDA_KEY.length > 8;
```

**Edit 2 of 5: the GM storage section, just before the `// ===== TORN'S SIDEBAR DATA =====` line.** Find:

```js
  // ===== TORN'S SIDEBAR DATA =====
```

Replace with:

```js
  // ===== GM STORAGE =====

  // Every GM_* call is guarded, because hosts differ in what they give a script. Values are
  // stored as strings, because PDA hands stored values back as strings.
  function gmGet(name) {
    try {
      return typeof GM_getValue === 'function' ? GM_getValue(name, '') : '';
    } catch (e) {
      return '';
    }
  }

  function gmSet(name, value) {
    try {
      if (typeof GM_setValue === 'function') GM_setValue(name, value);
    } catch (e) {
      // Without storage the script just asks Torn again later.
    }
  }

  // ===== TORN'S SIDEBAR DATA =====
```

**Edit 3 of 5: the war time section, just before the `// ===== THE ICON =====` line.** Find:

```js
  // ===== THE ICON =====
```

Replace with:

```js
  // ===== THE WAR TIME =====

  // The key for Torn's API: one saved in the key box beats the one PDA gives. '' means none.
  function apiKey() {
    const saved = gmGet(KEY_STORE);
    if (typeof saved === 'string' && saved.trim()) return saved.trim();
    return HAS_PDA_KEY ? PDA_KEY : '';
  }

  // What Torn last said about your faction's ranked war, shared by every tab: at = when a tab
  // last asked (ms), start and end = the war's times (Unix seconds, 0 for none), error = why
  // the last ask failed ('' if it didn't). Read with Number(), as PDA hands back strings; a
  // value that won't parse reads as nothing saved.
  function readWar() {
    let v = gmGet(WAR_STORE);
    try {
      if (typeof v === 'string') v = v ? JSON.parse(v) : null;
    } catch (e) {
      v = null;
    }
    if (!v || typeof v !== 'object') v = {};
    return {
      at: Number(v.at) || 0,
      start: Number(v.start) || 0,
      end: Number(v.end) || 0,
      error: typeof v.error === 'string' ? v.error : '',
    };
  }

  function writeWar(war) {
    gmSet(WAR_STORE, JSON.stringify(war));
  }

  // This tab's own last call (ms), or null. It keeps the 30 minutes even when storage won't
  // save: PDA keeps GM values in localStorage, and a full localStorage throws on every write.
  let askedAt = null;

  // Asks Torn about the war, at most once every 30 minutes across all tabs. The time goes into
  // storage before the call, so another tab sees it and waits. Only called while the icon shows.
  function maybeAsk(nowMs) {
    const key = apiKey();
    if (!key) return;
    const war = readWar();
    // A saved time in the future means the clock moved back: ask now rather than wait for it.
    if (war.at <= nowMs && nowMs - war.at < CALL_EVERY_MS) return;
    if (askedAt !== null && askedAt <= nowMs && nowMs - askedAt < CALL_EVERY_MS) return;
    askedAt = nowMs;
    war.at = nowMs;
    writeWar(war);
    askTorn(key).then((ranked) => {
      const now = readWar();
      now.start = ranked ? Number(ranked.start) || 0 : 0;
      now.end = ranked ? Number(ranked.end) || 0 : 0;
      now.error = '';
      writeWar(now);
    }, (message) => {
      // Keep the last good answer, and say why this one failed.
      const now = readWar();
      now.error = message;
      writeWar(now);
    });
  }

  // GET your faction's wars. Resolves with wars.ranked (null when no ranked war is set), or
  // rejects with words for the tooltip: Torn's own error text, or a fixed message. The key is
  // in the request and nowhere else.
  function askTorn(key) {
    const url = 'https://api.torn.com/v2/faction/wars?key=' + encodeURIComponent(key) + '&comment=xanax-reminder';
    return new Promise((resolve, reject) => {
      const answered = (text) => {
        let data;
        try {
          data = JSON.parse(text);
        } catch (e) {
          reject('no answer from Torn');
          return;
        }
        if (data && data.error) {
          reject(hideKey(String(data.error.error || 'error ' + data.error.code), key));
        } else if (data && data.wars && typeof data.wars === 'object') {
          resolve(data.wars.ranked && typeof data.wars.ranked === 'object' ? data.wars.ranked : null);
        } else {
          reject('unexpected answer from Torn');
        }
      };
      const failed = () => reject('no answer from Torn');
      // GM_xmlhttpRequest where the host has it: it isn't held to the page's rules on what the
      // page may fetch. fetch where it doesn't.
      if (typeof GM_xmlhttpRequest === 'function') {
        try {
          GM_xmlhttpRequest({
            method: 'GET',
            url: url,
            anonymous: true,
            timeout: 20000,
            onload: (res) => answered(res && res.responseText != null ? String(res.responseText) : ''),
            onerror: failed,
            ontimeout: failed,
            onabort: failed,
          });
          return;
        } catch (e) {
          // Fall through to fetch.
        }
      }
      try {
        fetch(url, { credentials: 'omit' }).then((res) => res.text()).then(answered, failed);
      } catch (e) {
        failed();
      }
    });
  }

  // Torn's messages don't hold the key, but the tooltip must never show it, so make sure.
  function hideKey(text, key) {
    return text.split(key).join('****');
  }

  // Seconds until the war starts, in the 24 hours before it (start - 24h <= now < start), or 0
  // outside them. Needs a key: without one, the tap always opens your items. A war with an end
  // time is over.
  function warSecondsLeft(nowMs) {
    if (!apiKey()) return 0;
    const war = readWar();
    const nowS = nowMs / 1000;
    if (!(war.start > 0) || war.end > 0) return 0;
    if (nowS < war.start - WINDOW_S || nowS >= war.start) return 0;
    return war.start - nowS;
  }

  // "5h 12m", or "45m" under an hour. Minutes round up, so it never says 0m.
  function untilText(seconds) {
    const mins = Math.max(1, Math.ceil(seconds / 60));
    const h = Math.floor(mins / 60);
    return h > 0 ? h + 'h ' + (mins % 60) + 'm' : mins + 'm';
  }

  // ===== THE ICON =====
```

**Edit 4 of 5: the war line and the error line, replacing `labelLines()`.** Find:

```js
  // The icon's label, line by line: for the tooltip, and joined for screen readers.
  function labelLines() {
    return [LABEL];
  }
```

Replace with:

```js
  // The icon's label, line by line: for the tooltip, and joined for screen readers. With no key
  // there is never a war line or an error line.
  function labelLines(nowMs) {
    const lines = [LABEL];
    const left = warSecondsLeft(nowMs);
    if (left) lines.push('War starts in ' + untilText(left) + ': tap to pick the armoury or your items');
    const error = apiKey() ? readWar().error : '';
    if (error) lines.push('Couldn\'t check the war time: ' + error);
    return lines;
  }
```

**Edit 5 of 5: the check asks Torn while the icon shows, in `check()`.** Find:

```js
      setLabel(labelLines());
```

Replace with:

```js
      maybeAsk(nowMs);
      setLabel(labelLines(nowMs));
```

- [ ] **Step 4: Run the tests to see them pass**

Run: `cd /opt/warboard/server && node --check public/scripts/torn-xanax-reminder.user.js && node --test torn-xanax-reminder.test.mjs 2>&1 | grep -E '^# (tests|pass|fail)'`
Expected: `# tests 50`, `# pass 50`, `# fail 0`.

- [ ] **Step 5: Commit**

```bash
cd /opt/warboard && git add server/torn-xanax-reminder.test.mjs server/public/scripts/torn-xanax-reminder.user.js && git commit -m "torn-xanax-reminder: the war time and the key (task 3 of 4)

While the icon shows, ask Torn for the faction's ranked war at most every 30
minutes across tabs, with the saved key or PDA's. The label says when the war
starts in the 24 hours before it, and why a check failed. The key never shows.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: The tap, the box and the key box

**Files:**
- Modify: `server/public/scripts/torn-xanax-reminder.user.js` (10 edits)
- Test: `server/torn-xanax-reminder.test.mjs` (append)

**Interfaces:**
- Consumes:
  - from Task 1: `ITEMS_URL`, `POLL_MS`, `icon`, `buildIcon()`, `removeIcon()`, `ensureStyles()`, and `check()`;
  - from Task 2: `TIP_ID`, `hideTip()`, `placeNear(el, anchor, above)`, `TIP_CSS`, and the start section's scroll line;
  - from Task 3: `gmGet`, `gmSet`, `KEY_STORE`, `HAS_PDA_KEY`, `writeWar`, `askedAt` (a new key sets it back to null, so the next check asks at once), `warSecondsLeft(nowMs)`, and `untilText(seconds)`.
  - In the tests: everything from Tasks 1 to 3.
- Produces, in the script:
  - constants `ARMOURY_URL`, `CHOICE_ID`, `KEYBOX_ID`, `LONG_PRESS_MS`, `BOX_CSS`;
  - state `let choice`, `let pressTimer`, `let longPressed`;
  - tap and press handlers `onTap(e)`, `openChoice(left: number)`, `closeChoice()`, `syncChoice(nowMs: number)`, `startPress(e)`, `cancelPress()`, `endPress(e)`, `onContextMenu(e)`;
  - page-wide handlers `onPointerDown(e)`, `onKeyDown(e)`, `onScroll()`;
  - key box functions `openKeyBox()`, `keyStatus(): string`, `saveKey(value: string)`, `setKey(value: string)`, `button(label: string, onClick: Function): HTMLButtonElement`, `closeKeyBox()`;
  - `// ===== THE TAP =====` and `// ===== THE KEY BOX =====` sections.
- Produces, in the tests: `ARMOURY`, `CHOICE`, `KEYBOX`, `warStore(start)`, `box(w)`, `keyBox(w)`, `keyButtons(w)`, `escape(w)`.

- [ ] **Step 1: Write the failing tests**

Append this to the end of `server/torn-xanax-reminder.test.mjs`, after a blank line:

```js
// ---------------------------------------------------------------------------------------------
// The tap, the box and the key box
// ---------------------------------------------------------------------------------------------

const ARMOURY = 'https://www.torn.com/factions.php?step=your&type=1#/tab=armoury&start=0&sub=drugs';
const CHOICE = 'tm-xanax-reminder-choice';
const KEYBOX = 'tm-xanax-reminder-key';
// GM storage as an earlier answer from Torn left it, checked just now: a key, and a war
// starting at `start` (in the window by default).
const warStore = (start = START) => ({ [KEY_STORE]: KEY, [WAR_STORE]: JSON.stringify({ at: NOW * 1000, start, end: 0, error: '' }) });
const box = (w) => w.document.getElementById(CHOICE);
const keyBox = (w) => w.document.getElementById(KEYBOX);
const keyButtons = (w) => [...keyBox(w).querySelectorAll('button')];
const escape = (w) => fire(w, w.document.body, 'keydown', { key: 'Escape' });

test('outside the war window, a tap follows the link to your items and opens no box', () => {
  const w = page({ store: warStore(NOW + 2 * 86400) }).run();
  assert.equal(fire(w, w.link(), 'click').defaultPrevented, false, 'the link opens your items');
  assert.equal(box(w), null);
  w.clock.ms = (NOW + 86400 + 60) * 1000;   // 24 hours before the start: the window opens
  w.store[WAR_STORE] = JSON.stringify({ at: w.clock.ms, start: NOW + 2 * 86400, end: 0, error: '' });
  w.check();
  assert.equal(fire(w, w.link(), 'click').defaultPrevented, true, 'and in the window, the box');
});

test('in the war window, a tap opens a box with Armoury and Items', () => {
  const w = page({ store: warStore() }).run();
  assert.equal(fire(w, w.link(), 'click').defaultPrevented, true, 'the box opens instead of the link');
  assert.ok(box(w));
  assert.equal(box(w).querySelector('b').textContent, 'War starts in 5h 12m');
  assert.deepEqual([...box(w).querySelectorAll('a')].map((a) => [a.textContent, a.getAttribute('href')]),
    [['Armoury', ARMOURY], ['Items', ITEMS]]);
  assert.equal(w.link().getAttribute('href'), ITEMS, 'the icon still points at your items');
});

test('from the war\'s start, a tap goes straight to your items again, and an open box closes', () => {
  const w = page({ store: warStore() }).run();
  fire(w, w.link(), 'click');
  assert.ok(box(w));
  w.clock.ms = START * 1000;
  w.check();
  assert.equal(box(w), null, 'the box closed at the start');
  assert.equal(fire(w, w.link(), 'click').defaultPrevented, false);
});

test('the open box keeps its time current', () => {
  const w = page({ store: warStore() }).run();
  fire(w, w.link(), 'click');
  w.clock.ms += 12 * 60 * 1000;
  w.check();
  assert.equal(box(w).querySelector('b').textContent, 'War starts in 5h 0m');
});

test('with no key, a tap goes straight to your items, even with a war time saved', () => {
  const store = warStore();
  delete store[KEY_STORE];
  const w = page({ store }).run();
  assert.equal(fire(w, w.link(), 'click').defaultPrevented, false);
  assert.equal(box(w), null);
  w.store[KEY_STORE] = KEY;
  assert.equal(fire(w, w.link(), 'click').defaultPrevented, true, 'with the key back, the box');
});

test('after a Torn error, with no war time from before, a tap goes straight to your items', async () => {
  const w = page({ store: { [KEY_STORE]: KEY } }).run();
  answer(w.calls[0], { error: { code: 2, error: 'Incorrect key' } });
  await settle();
  w.check();
  assert.match(w.label(), /Incorrect key/);
  assert.equal(fire(w, w.link(), 'click').defaultPrevented, false, 'the link opens your items');
  assert.equal(box(w), null);
  // Thirty minutes on, Torn answers with a war in the window: now the tap lets you pick.
  w.clock.ms += 30 * 60 * 1000;
  w.check();
  answer(w.calls[1], wars(ranked(START)));
  await settle();
  w.check();
  assert.equal(fire(w, w.link(), 'click').defaultPrevented, true, 'and once Torn gives a war time, the box');
});

test('the tap that opens the box doesn\'t close it', () => {
  const w = page({ store: warStore() }).run();
  // Everything a phone sends for one tap, in order.
  fire(w, w.link(), 'pointerdown', { pointerType: 'touch' });
  fire(w, w.link(), 'touchstart');
  fire(w, w.link(), 'pointerup', { pointerType: 'touch' });
  fire(w, w.link(), 'touchend');
  fire(w, w.link(), 'mousedown', { button: 0 });
  fire(w, w.link(), 'mouseup', { button: 0 });
  fire(w, w.link(), 'click');
  w.advance(1000);
  assert.ok(box(w), 'still open');
  assert.equal(keyBox(w), null, 'and no key box');
});

test('a tap elsewhere, Escape or scrolling closes the box', () => {
  const w = page({ store: warStore() }).run();
  fire(w, w.link(), 'click');
  assert.ok(box(w), 'open');
  fire(w, w.document.querySelector('#header-wrapper-top a'), 'pointerdown');
  assert.equal(box(w), null, 'a tap elsewhere');
  fire(w, w.link(), 'click');
  assert.ok(box(w), 'open again');
  escape(w);
  assert.equal(box(w), null, 'Escape');
  fire(w, w.link(), 'click');
  assert.ok(box(w), 'and again');
  w.scroll();
  assert.equal(box(w), null, 'scrolling');
});

test('a tap inside the box keeps it, and a tap on one of its links closes it once the link opens', () => {
  const w = page({ store: warStore() }).run();
  fire(w, w.link(), 'click');
  fire(w, box(w).querySelector('b'), 'pointerdown');
  assert.ok(box(w), 'still open');
  const armoury = box(w).querySelector('a');
  fire(w, armoury, 'pointerdown');
  assert.equal(fire(w, armoury, 'click').defaultPrevented, false, 'the link opens');
  assert.ok(box(w), 'not closed during the tap');
  w.advance(0);
  assert.equal(box(w), null, 'closed right after');
});

test('a second tap on the icon closes the box, and two taps never make two boxes', () => {
  const w = page({ store: warStore() }).run();
  fire(w, w.link(), 'click');
  fire(w, w.link(), 'pointerdown', { pointerType: 'touch' });
  assert.equal(fire(w, w.link(), 'click').defaultPrevented, true, 'the second tap doesn\'t open your items either');
  assert.equal(box(w), null);
  fire(w, w.link(), 'click');
  assert.equal(w.document.querySelectorAll('#' + CHOICE).length, 1);
});

test('the box goes when the icon goes, and opening it closes the tooltip', () => {
  const w = page({ store: warStore() }).run();
  fire(w, w.link(), 'focus');
  fire(w, w.link(), 'click');
  assert.equal(w.document.getElementById(TIP), null, 'no tooltip over the box');
  w.setIcons({ drug_cooldown: drug(NOW + 3600) });
  w.check();
  assert.equal(box(w), null);
});

test('a long press opens the key box and no choice box, and the tap that ends it goes nowhere', () => {
  const w = page({ store: warStore() }).run();
  fire(w, w.link(), 'touchstart');
  w.advance(500);
  assert.ok(keyBox(w), 'the key box is open');
  assert.equal(fire(w, w.link(), 'touchend').defaultPrevented, true, 'no click follows on a phone');
  assert.equal(fire(w, w.link(), 'click').defaultPrevented, true, 'and a click that comes anyway goes nowhere');
  assert.equal(box(w), null, 'no choice box');
});

test('after a long press, the next tap is a tap again', () => {
  const w = page({ store: warStore() }).run();
  fire(w, w.link(), 'touchstart');
  w.advance(500);
  fire(w, w.link(), 'touchend');
  escape(w);
  fire(w, w.link(), 'touchstart');
  w.advance(100);
  assert.equal(fire(w, w.link(), 'touchend').defaultPrevented, false);
  fire(w, w.link(), 'click');
  assert.ok(box(w), 'the box opens');
});

test('a short press is a tap, and a swipe along the strip is neither', () => {
  const w = page().run();
  fire(w, w.link(), 'touchstart');
  w.advance(300);
  fire(w, w.link(), 'touchend');
  w.advance(1000);
  assert.equal(keyBox(w), null, 'a short press');
  fire(w, w.link(), 'touchstart');
  fire(w, w.link(), 'touchmove');
  w.advance(1000);
  assert.equal(keyBox(w), null, 'a swipe');
  fire(w, w.link(), 'touchstart');
  w.advance(500);
  assert.ok(keyBox(w), 'a long press does open it');
});

test('a long press with the mouse opens the key box too, and a right-click keeps its menu', () => {
  const w = page().run();
  fire(w, w.link(), 'mousedown', { button: 0 });
  w.advance(500);
  assert.ok(keyBox(w));
  assert.equal(fire(w, w.link(), 'click').defaultPrevented, true);
  escape(w);
  fire(w, w.link(), 'mousedown', { button: 2 });
  w.advance(1000);
  assert.equal(keyBox(w), null, 'a right-click is no long press');
  assert.equal(fire(w, w.link(), 'contextmenu').defaultPrevented, false, 'its menu opens');
});

test('the phone\'s own long-press menu is held back on the icon', () => {
  const w = page().run();
  fire(w, w.link(), 'touchstart');
  assert.equal(fire(w, w.link(), 'contextmenu').defaultPrevented, true);
  assert.match(w.document.getElementById(STYLES).textContent, /#tm-xanax-reminder a \{ -webkit-touch-callout: none;/);
});

test('the key box: a plain text field that starts empty, with Save, Clear and Cancel', () => {
  const w = page({ store: { [KEY_STORE]: KEY } }).run();
  w.menu['Set API key']();
  w.menu['Set API key']();
  assert.equal(w.document.querySelectorAll('#' + KEYBOX).length, 1, 'never two');
  const input = keyBox(w).querySelector('input');
  assert.equal(input.getAttribute('type'), 'text', 'a password field sets off password managers');
  assert.equal(input.value || '', '', 'the saved key is never shown');
  assert.ok(!keyBox(w).textContent.includes(KEY));
  assert.match(keyBox(w).textContent, /A Public-level key is enough\./);
  assert.match(keyBox(w).textContent, /A key is saved\./);
  assert.deepEqual(keyButtons(w).map((b) => b.textContent), ['Save', 'Clear', 'Cancel']);
  assert.doesNotMatch(readFileSync(SRC, 'utf8'), /type\s*=\s*['"]?password/i);
});

test('the key box from the menu closes an open box and the tooltip', () => {
  const w = page({ store: warStore() }).run();
  fire(w, w.link(), 'click');
  fire(w, w.link(), 'focus');
  w.menu['Set API key']();
  assert.ok(keyBox(w));
  assert.equal(box(w), null);
  assert.equal(w.document.getElementById(TIP), null);
});

test('the menu opens a styled key box even while the cooldown runs', () => {
  const w = page({ icons: { drug_cooldown: drug(NOW + 3600) } }).run();
  w.menu['Set API key']();
  assert.ok(keyBox(w));
  assert.match(w.document.getElementById(STYLES).textContent, /#tm-xanax-reminder-key \{ position: fixed;/);
  assert.match(keyBox(w).textContent, /No key saved\./);
});

test('Save keeps the key, forgets the old answer and asks Torn at once', () => {
  const w = page({ store: { [WAR_STORE]: JSON.stringify({ at: NOW * 1000, start: START, end: 0, error: 'Incorrect key' }) } }).run();
  w.menu['Set API key']();
  keyBox(w).querySelector('input').value = '  ' + KEY + ' ';
  fire(w, keyButtons(w)[0], 'click');
  assert.equal(w.store[KEY_STORE], KEY, 'saved, trimmed');
  assert.equal(keyBox(w), null, 'the box closes');
  w.check();
  assert.equal(w.calls.length, 1, 'asked straight away');
  assert.equal(w.label(), LABEL, 'the old answer and its error are gone');
});

test('a new key is asked about at once, even in a tab that just asked with the old one', async () => {
  const w = page({ store: { [KEY_STORE]: 'OLDKEY123456789' } }).run();
  assert.equal(w.calls.length, 1, 'asked with the old key');
  answer(w.calls[0], { error: { code: 2, error: 'Incorrect key' } });
  await settle();
  w.menu['Set API key']();
  keyBox(w).querySelector('input').value = KEY;
  fire(w, keyButtons(w)[0], 'click');
  w.check();
  assert.equal(w.calls.length, 2, 'asked again with the new key');
  assert.equal(w.calls[1].url, URL);
});

test('Save with an empty field keeps the saved key and its answer', () => {
  const w = page({ store: warStore() }).run();
  const war = w.store[WAR_STORE];
  w.menu['Set API key']();
  fire(w, keyButtons(w)[0], 'click');
  assert.equal(keyBox(w), null, 'the box closes');
  assert.equal(w.store[KEY_STORE], KEY);
  assert.equal(w.store[WAR_STORE], war);
});

test('Enter in the field saves too', () => {
  const w = page().run();
  w.menu['Set API key']();
  const input = keyBox(w).querySelector('input');
  input.value = KEY;
  fire(w, input, 'keydown', { key: 'Enter' });
  assert.equal(w.store[KEY_STORE], KEY);
  assert.equal(keyBox(w), null);
});

test('Clear forgets the key and the war time', () => {
  const w = page({ store: warStore() }).run();
  w.menu['Set API key']();
  fire(w, keyButtons(w)[1], 'click');
  assert.equal(w.store[KEY_STORE], '');
  assert.equal(JSON.parse(w.store[WAR_STORE]).start, 0);
  w.check();
  assert.equal(w.calls.length, 0, 'no key, no call');
  assert.equal(fire(w, w.link(), 'click').defaultPrevented, false, 'the tap opens your items');
});

test('Cancel, Escape and a tap on the dark area change nothing; a tap inside the box keeps it', () => {
  const w = page({ store: { [KEY_STORE]: KEY } }).run();
  const ways = [
    () => fire(w, keyButtons(w)[2], 'click'),
    () => escape(w),
    () => fire(w, keyBox(w), 'click'),
  ];
  for (const close of ways) {
    w.menu['Set API key']();
    keyBox(w).querySelector('input').value = 'SOMETHINGELSE123';
    fire(w, keyBox(w).querySelector('p'), 'click');
    assert.ok(keyBox(w), 'a tap inside keeps it');
    close();
    assert.equal(keyBox(w), null);
    assert.equal(w.store[KEY_STORE], KEY);
  }
});

test('the key box says when PDA\'s key is in use, and never shows it', () => {
  const src = readFileSync(SRC, 'utf8').replace('###PDA-APIKEY###', 'PDAKEY0123456789');
  const w = page({ src }).run();
  w.menu['Set API key']();
  assert.match(keyBox(w).textContent, /Using the key Torn PDA gives the script\./);
  assert.ok(!keyBox(w).textContent.includes('PDAKEY0123456789'));
});

test('a host with no menu, or one whose menu throws, still gets the icon and the long press', () => {
  for (const menu of [false, 'throws']) {
    const w = page({ menu }).run();
    assert.ok(w.icon(), String(menu));
    fire(w, w.link(), 'touchstart');
    w.advance(500);
    assert.ok(keyBox(w), String(menu));
  }
});
```

- [ ] **Step 2: Run them to see the new ones fail**

Run: `cd /opt/warboard/server && node --test torn-xanax-reminder.test.mjs 2>&1 | grep -E '^# (tests|pass|fail)'`
Expected: `# tests 77`, `# pass 50`, `# fail 27`. All twenty-seven new tests fail, because a tap doesn't do anything yet.

- [ ] **Step 3: Edit the script**

**Edit 1 of 10: the armoury link, after `ITEMS_URL`.** Find:

```js
  const ITEMS_URL = 'https://www.torn.com/item.php#drugs-items';
```

Replace with:

```js
  const ITEMS_URL = 'https://www.torn.com/item.php#drugs-items';
  // The faction armoury's Drugs tab.
  const ARMOURY_URL = 'https://www.torn.com/factions.php?step=your&type=1#/tab=armoury&start=0&sub=drugs';
```

**Edit 2 of 10: the two boxes' ids, after `TIP_ID`.** Find:

```js
  const TIP_ID = 'tm-xanax-reminder-tip';
```

Replace with:

```js
  const TIP_ID = 'tm-xanax-reminder-tip';
  const CHOICE_ID = 'tm-xanax-reminder-choice';
  const KEYBOX_ID = 'tm-xanax-reminder-key';
```

**Edit 3 of 10: the long press's length, after `POLL_MS`.** Find:

```js
  const POLL_MS = 2000;
```

Replace with:

```js
  const POLL_MS = 2000;
  // A press this long opens the key box, as the blood bag's settings do.
  const LONG_PRESS_MS = 500;
```

**Edit 4 of 10: the tap and press handlers, at the end of `buildIcon()`.** Find:

```js
    a.addEventListener('blur', hideTip);
    return li;
```

Replace with:

```js
    a.addEventListener('blur', hideTip);
    // The tap, and the long press that opens the key box.
    a.addEventListener('click', onTap);
    a.addEventListener('touchstart', startPress, { passive: true });
    a.addEventListener('touchend', endPress);
    a.addEventListener('touchmove', cancelPress, { passive: true });
    a.addEventListener('touchcancel', cancelPress);
    a.addEventListener('mousedown', startPress);
    a.addEventListener('mouseup', endPress);
    a.addEventListener('mouseleave', cancelPress);
    a.addEventListener('contextmenu', onContextMenu);
    return li;
```

**Edit 5 of 10: the box goes with the icon, in `removeIcon()`.** Find:

```js
  function removeIcon() {
    hideTip();
    if (icon && icon.parentNode) icon.remove();
  }
```

Replace with:

```js
  function removeIcon() {
    hideTip();
    closeChoice();
    if (icon && icon.parentNode) icon.remove();
  }
```

**Edit 6 of 10: the tap and key box sections, just before the `// ===== STYLES =====` line.** Find:

```js
  // ===== STYLES =====
```

Replace with:

```js
  // ===== THE TAP =====

  // The open Armoury/Items box, if any.
  let choice = null;
  // A long press: its timer while the finger is down, and whether it fired, so the tap that
  // ends it goes nowhere.
  let pressTimer = null;
  let longPressed = false;

  // The icon's link opens your items. In the war window the tap opens the box instead, and a
  // second tap closes it. The script never clicks anything itself.
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
    const left = warSecondsLeft(Date.now());
    if (!left) return;
    e.preventDefault();
    openChoice(left);
  }

  // A box under the icon: when the war starts, and two plain links, Armoury and Items.
  function openChoice(left) {
    closeChoice();
    hideTip();
    choice = document.createElement('div');
    choice.id = CHOICE_ID;
    const title = document.createElement('b');
    title.textContent = 'War starts in ' + untilText(left);
    choice.appendChild(title);
    [['Armoury', ARMOURY_URL], ['Items', ITEMS_URL]].forEach((pair) => {
      const link = document.createElement('a');
      link.textContent = pair[0];
      link.href = pair[1];
      // Close once the tap has gone through, so the link still opens.
      link.addEventListener('click', () => setTimeout(closeChoice, 0));
      choice.appendChild(link);
    });
    document.body.appendChild(choice);
    placeNear(choice, icon, false);
  }

  function closeChoice() {
    if (!choice) return;
    choice.remove();
    choice = null;
  }

  // Each check: the box closes when the window does, and its time stays current.
  function syncChoice(nowMs) {
    if (!choice) return;
    const left = warSecondsLeft(nowMs);
    if (!left) closeChoice();
    else choice.firstChild.textContent = 'War starts in ' + untilText(left);
  }

  function startPress(e) {
    longPressed = false;
    // A finger, or the main mouse button. A right-click keeps its menu.
    if (e.type === 'mousedown' && e.button !== 0) return;
    clearTimeout(pressTimer);
    pressTimer = setTimeout(() => {
      pressTimer = null;
      longPressed = true;
      openKeyBox();
    }, LONG_PRESS_MS);
  }

  function cancelPress() {
    clearTimeout(pressTimer);
    pressTimer = null;
  }

  // On a phone, stopping the touchend of a long press stops its click too.
  function endPress(e) {
    cancelPress();
    if (longPressed && e.cancelable) e.preventDefault();
  }

  // The phone's own long-press menu for links would cover the key box.
  function onContextMenu(e) {
    if (pressTimer || longPressed) e.preventDefault();
  }

  function onPointerDown(e) {
    if (!choice) return;
    if (choice.contains(e.target) || (icon && icon.contains(e.target))) return;
    closeChoice();
  }

  function onKeyDown(e) {
    if (e.key !== 'Escape') return;
    closeChoice();
    closeKeyBox();
  }

  function onScroll() {
    hideTip();
    closeChoice();
  }

  // ===== THE KEY BOX =====

  // Opens from the menu ("Set API key") or a long press on the icon, over everything else. The
  // field is a plain text field (a password field sets off password managers) that starts
  // empty: the saved key is never shown.
  function openKeyBox() {
    closeKeyBox();
    closeChoice();
    hideTip();
    ensureStyles();
    const overlay = document.createElement('div');
    overlay.id = KEYBOX_ID;
    const panel = document.createElement('div');
    panel.className = 'tm-xanax-panel';
    const title = document.createElement('b');
    title.textContent = 'Torn Xanax Reminder';
    const about = document.createElement('p');
    about.textContent = 'With your API key, the script checks when your faction\'s next ranked war starts. '
      + 'In the 24 hours before it, a tap on the icon lets you pick the armoury or your items. '
      + 'A Public-level key is enough.';
    const status = document.createElement('p');
    status.textContent = keyStatus();
    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = 'Your API key';
    input.setAttribute('autocomplete', 'off');
    input.setAttribute('autocapitalize', 'off');
    input.setAttribute('spellcheck', 'false');
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') saveKey(input.value);
    });
    const buttons = document.createElement('div');
    buttons.className = 'tm-xanax-buttons';
    buttons.appendChild(button('Save', () => saveKey(input.value)));
    buttons.appendChild(button('Clear', () => setKey('')));
    buttons.appendChild(button('Cancel', closeKeyBox));
    [title, about, status, input, buttons].forEach((el) => panel.appendChild(el));
    overlay.appendChild(panel);
    // A tap on the dark area around the box is Cancel.
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeKeyBox();
    });
    document.body.appendChild(overlay);
    try {
      input.focus();
    } catch (e) {
      // Some hosts can't focus from here; the field is still there to tap.
    }
  }

  function keyStatus() {
    const saved = gmGet(KEY_STORE);
    if (typeof saved === 'string' && saved.trim()) return 'A key is saved.';
    if (HAS_PDA_KEY) return 'Using the key Torn PDA gives the script.';
    return 'No key saved.';
  }

  // Save with an empty field changes nothing: only Clear removes a key.
  function saveKey(value) {
    const key = String(value || '').trim();
    if (key) setKey(key);
    else closeKeyBox();
  }

  // Saves the key ('' for none) and forgets what Torn said with the old one, so the next check
  // asks again straight away.
  function setKey(value) {
    gmSet(KEY_STORE, String(value || '').trim());
    writeWar({ at: 0, start: 0, end: 0, error: '' });
    askedAt = null;
    closeKeyBox();
  }

  function button(label, onClick) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    b.addEventListener('click', onClick);
    return b;
  }

  function closeKeyBox() {
    const box = document.getElementById(KEYBOX_ID);
    if (box) box.remove();
  }

  // ===== STYLES =====
```

**Edit 7 of 10: their look, after `TIP_CSS`.** Find:

```js
    '#' + TIP_ID + '.tm-xanax-under::after { top: -4px; bottom: auto; }',
  ].join('\n');
```

Replace with:

```js
    '#' + TIP_ID + '.tm-xanax-under::after { top: -4px; bottom: auto; }',
  ].join('\n');

  // The Armoury/Items box in Torn's tooltip look, and the key box.
  const BOX_CSS = [
    // No text selection and no iPhone link menu on a long press of the icon.
    '#' + ICON_ID + ' a { -webkit-touch-callout: none; -webkit-user-select: none; user-select: none; }',
    '#' + CHOICE_ID + ' { position: fixed; z-index: 99999; box-sizing: border-box; padding: 8px; border-radius: 4px; background: #444; color: #ddd; box-shadow: 0 0 2px 0 rgba(0,0,0,.65); font: 400 12px/14px Arial, sans-serif; text-align: center; white-space: nowrap; }',
    '#' + CHOICE_ID + ' b { display: block; margin-bottom: 6px; font-weight: 700; }',
    '#' + CHOICE_ID + ' a { display: inline-block; margin: 0 3px; padding: 6px 12px; border: 1px solid #666; border-radius: 4px; background: #2e2e2e; color: #fff; font-weight: 700; text-decoration: none; }',
    '#' + KEYBOX_ID + ' { position: fixed; top: 0; right: 0; bottom: 0; left: 0; z-index: 100000; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,.7); }',
    '#' + KEYBOX_ID + ' .tm-xanax-panel { box-sizing: border-box; width: 320px; max-width: calc(100vw - 32px); padding: 14px; border-radius: 8px; background: #2e2e2e; color: #ddd; font: 400 13px/17px Arial, sans-serif; text-align: left; }',
    '#' + KEYBOX_ID + ' p { margin: 8px 0; }',
    // 16px, or an iPhone zooms in when the field is tapped.
    '#' + KEYBOX_ID + ' input { box-sizing: border-box; width: 100%; padding: 6px 8px; border: 1px solid #666; border-radius: 4px; background: #1d1d1d; color: #fff; font: 16px monospace; }',
    '#' + KEYBOX_ID + ' .tm-xanax-buttons { display: flex; justify-content: flex-end; gap: 8px; margin-top: 10px; }',
    '#' + KEYBOX_ID + ' button { padding: 6px 12px; border: 1px solid #666; border-radius: 4px; background: #444; color: #fff; font: 700 12px Arial, sans-serif; cursor: pointer; }',
  ].join('\n');
```

**Edit 8 of 10: the stylesheet takes all three, in `ensureStyles()`.** Find:

```js
    style.textContent = ICON_CSS + '\n' + TIP_CSS;
```

Replace with:

```js
    style.textContent = ICON_CSS + '\n' + TIP_CSS + '\n' + BOX_CSS;
```

**Edit 9 of 10: the check keeps the box current, in `check()`.** Find:

```js
      setLabel(labelLines(nowMs));
```

Replace with:

```js
      setLabel(labelLines(nowMs));
      syncChoice(nowMs);
```

**Edit 10 of 10: the menu and the page-wide handlers, replacing the scroll line in the start section.** Find:

```js
  // Scrolling moves the icon, and the tooltip would float away from it.
  window.addEventListener('scroll', hideTip, { capture: true, passive: true });
```

Replace with:

```js
  // The script's menu, where the host has one. A long press on the icon opens the key box too.
  try {
    if (typeof GM_registerMenuCommand === 'function') GM_registerMenuCommand('Set API key', openKeyBox);
  } catch (e) {
    // PDA once crashed here. Without a menu, the long press still works.
  }
  // A tap anywhere but the box or the icon closes the box. These run before the click, so the
  // tap that opens the box can't close it: the box isn't there yet.
  document.addEventListener('pointerdown', onPointerDown, true);
  document.addEventListener('touchstart', onPointerDown, { capture: true, passive: true });
  document.addEventListener('keydown', onKeyDown, true);
  // Scrolling moves the icon, and the tooltip and the box would float away from it.
  window.addEventListener('scroll', onScroll, { capture: true, passive: true });
```

- [ ] **Step 4: Run the tests to see them pass**

Run: `cd /opt/warboard/server && node --check public/scripts/torn-xanax-reminder.user.js && node --test torn-xanax-reminder.test.mjs 2>&1 | grep -E '^# (tests|pass|fail)'`
Expected: `# tests 77`, `# pass 77`, `# fail 0`.

- [ ] **Step 5: Commit**

```bash
cd /opt/warboard && git add server/torn-xanax-reminder.test.mjs server/public/scripts/torn-xanax-reminder.user.js && git commit -m "torn-xanax-reminder: the tap, the box and the key box (task 4 of 4)

In the 24 hours before a ranked war, a tap opens a box with Armoury and Items;
otherwise the link opens your items. A long press, or the menu, opens the key
box: a plain text field that never shows the saved key.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Ship and check it live

**Files:**
- Create: `.superpowers/sdd/2026-10-22-torn-xanax-reminder/mutate.mjs` (git-ignored workspace)
- Modify: nothing in the repo, unless the review or the live check finds a fault. A fault goes back through TDD in the task that owns the code.
- Memory: `/root/.claude/projects/-root/memory/project_torn_xanax_reminder.md` (new), plus an index line in `MEMORY.md`

- [ ] **Step 1: Run the whole suite once**

First check that nothing else heavy is running (`uptime`; a load near the box's usual 8 is fine).

Run: `cd /opt/warboard/server && npm test 2>&1 | tail -8`
Expected: `# fail 0`, with 2 skipped. The total should be about 2118: the 2041 counted at the Blood Bag release plus these 77. If another session has added tests since then, the total can be higher, but `# fail` must still be 0.

- [ ] **Step 2: Check that the tests catch real bugs**

Create `.superpowers/sdd/2026-10-22-torn-xanax-reminder/mutate.mjs`:

```js
// Mutation check for Torn Xanax Reminder: each mutant (one small bug put into a copy of the
// script) must make at least one test fail. Copies go to the folder given as the first
// argument, each with its own meta file, and the tests run against them through TXR_SRC.
// The real script is only read, never changed.
// Usage: node mutate.mjs <scratch folder> [script path]
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const OUT = process.argv[2];
const SCRIPT = process.argv[3] || '/opt/warboard/server/public/scripts/torn-xanax-reminder.user.js';
const TESTS = process.env.TXR_TESTS || '/opt/warboard/server/torn-xanax-reminder.test.mjs';
const SRC = readFileSync(SCRIPT, 'utf8');
const META = readFileSync(SCRIPT.replace(/\.user\.js$/, '.meta.js'), 'utf8');

const MUTANTS = [
  ['a bare ul selector',
    `const ROW_SELECTOR = '#sidebar ul[class*="status-icons"], #sidebar ul[class*="statusIcons___"]';`,
    `const ROW_SELECTOR = 'ul';`],
  ['no data reads as no cooldown',
    `return icons && typeof icons === 'object' ? icons : null;`,
    `return icons && typeof icons === 'object' ? icons : {};`],
  ['a check that adds a second icon',
    `if (!icon) icon = buildIcon();`,
    `icon = buildIcon();`],
  ['the blood bag ignored',
    `if (bag && bag.parentNode === row) bag.after(icon);`,
    `if (false) bag.after(icon);`],
  ['a second copy runs too',
    `if (root.hasAttribute('data-tm-xanax-reminder')) return;`,
    `if (false) return;`],
  ['a touch opens the tooltip',
    `if (e.pointerType === 'mouse') showTip();`,
    `showTip();`],
  ['the focus from a tap opens the tooltip',
    `if (keyboardFocus(a)) showTip();`,
    `showTip();`],
  ['an inverted window',
    `if (nowS < war.start - WINDOW_S || nowS >= war.start) return 0;`,
    `if (!(nowS < war.start - WINDOW_S || nowS >= war.start)) return 0;`],
  ['the window opens a second late',
    `if (nowS < war.start - WINDOW_S || nowS >= war.start) return 0;`,
    `if (nowS <= war.start - WINDOW_S || nowS >= war.start) return 0;`],
  ['minutes round down',
    `const mins = Math.max(1, Math.ceil(seconds / 60));`,
    `const mins = Math.max(1, Math.floor(seconds / 60));`],
  ['without a key the window still opens',
    `    if (!apiKey()) return 0;\n`,
    ``],
  ['no 30-minute limit',
    `const CALL_EVERY_MS = 30 * 60 * 1000;`,
    `const CALL_EVERY_MS = 0;`],
  ['no limit in the tab when storage will not save',
    `    if (askedAt !== null && askedAt <= nowMs && nowMs - askedAt < CALL_EVERY_MS) return;\n`,
    ``],
  ['the call time is not saved before the call',
    `    war.at = nowMs;\n    writeWar(war);\n`,
    `    war.at = nowMs;\n`],
  ['an error forgets the last good answer',
    `      // Keep the last good answer, and say why this one failed.\n      const now = readWar();`,
    `      const now = { at: readWar().at, start: 0, end: 0 };`],
  ['Torn\'s message shown with the key in it',
    `reject(hideKey(String(data.error.error || 'error ' + data.error.code), key));`,
    `reject(String(data.error.error || 'error ' + data.error.code));`],
  ['the outside tap counts the icon as outside',
    `if (choice.contains(e.target) || (icon && icon.contains(e.target))) return;`,
    `if (choice.contains(e.target)) return;`],
  ['the touchend of a long press goes through',
    `if (longPressed && e.cancelable) e.preventDefault();`,
    `if (false) e.preventDefault();`],
  ['the click after a long press goes through',
    `    if (longPressed) {\n      longPressed = false;\n      e.preventDefault();\n      return;\n    }\n`,
    ``],
  ['a password field',
    `input.type = 'text';`,
    `input.type = 'password';`],
  ['an empty Save clears the key',
    `    if (key) setKey(key);\n    else closeKeyBox();\n`,
    `    setKey(key);\n`],
  ['a new key waits out the old call',
    `    askedAt = null;\n`,
    ``],
  ['Save keeps the old answer',
    `    writeWar({ at: 0, start: 0, end: 0, error: '' });\n`,
    ``],
];

mkdirSync(OUT, { recursive: true });
let survived = 0;
MUTANTS.forEach(([name, from, to], i) => {
  const n = SRC.split(from).length - 1;
  if (n !== 1) {
    console.log(`BAD MUTANT "${name}": its text occurs ${n} times`);
    survived++;
    return;
  }
  const dir = `${OUT}/m${String(i + 1).padStart(2, '0')}`;
  mkdirSync(dir, { recursive: true });
  writeFileSync(`${dir}/torn-xanax-reminder.user.js`, SRC.replace(from, () => to));
  writeFileSync(`${dir}/torn-xanax-reminder.meta.js`, META);
  let out;
  try {
    out = execFileSync('node', ['--test', TESTS], { env: { ...process.env, TXR_SRC: `${dir}/torn-xanax-reminder.user.js` }, encoding: 'utf8' });
  } catch (e) {
    out = e.stdout || '';
  }
  const failed = Number((out.match(/^# fail (\d+)/m) || [])[1] || 0);
  if (failed > 0) console.log(`killed    ${name} (${failed} failing)`);
  else { console.log(`SURVIVED  ${name}`); survived++; }
});
console.log(survived ? `${survived} mutant(s) survived` : `all ${MUTANTS.length} mutants killed`);
process.exit(survived ? 1 : 0);
```

Run: `cd /opt/warboard/.superpowers/sdd/2026-10-22-torn-xanax-reminder && node mutate.mjs mutants`
Expected: twenty-three `killed` lines, then `all 23 mutants killed`. A `SURVIVED` line means a test is missing. Write the test, watch it fail on the mutant, and add it to the task that owns the code. `BAD MUTANT` means a review fix changed that text; update the mutant to match.

- [ ] **Step 3: Whole-branch review**

This is the final review that superpowers:executing-plans asks for; don't run a second one. Review the commits after this plan's own commit (`git log -1 --format=%h -- docs/superpowers/plans/2026-10-22-torn-xanax-reminder.md` prints it) up to Task 4's commit, with superpowers:requesting-code-review, against the spec and this plan, on `model: "opus"`. Give the reviewer the Review Focus section verbatim.

Fix every Critical and Important finding before pushing. Each fix gets a failing test first, in the task that owns the code; then rerun Steps 1 and 2.

- [ ] **Step 4: Check the files as served**

```bash
cd /opt/warboard/server/public/scripts && chown warboard:warboard torn-xanax-reminder.user.js torn-xanax-reminder.meta.js && chmod 644 torn-xanax-reminder.user.js torn-xanax-reminder.meta.js && node --check torn-xanax-reminder.user.js && for f in torn-xanax-reminder.user.js torn-xanax-reminder.meta.js; do a=$(sha256sum < $f | cut -c1-16); b=$(curl -s "https://tornwar.com/scripts/$f?v=1.0.0" | sha256sum | cut -c1-16); echo "$f local $a served $b"; done; ls -l torn-xanax-reminder.*
```

Expected: nothing from `node --check`. Each file's local and served hashes match, and both files are `warboard warboard` with `-rw-r--r--`.

- [ ] **Step 5: Push**

```bash
cd /opt/warboard && git fetch -q origin 2>&1 | sed -E 's#//[^@]*@#//***@#g'; git status -sb | head -1 && git log --oneline origin/main..HEAD
```

Expected: `## main...origin/main [ahead N]` with no `behind`. The listed commits are the three spec commits, this plan's commit, the four task commits, and any review fixes, and nothing else. If the branch is behind, stop and ask.

```bash
cd /opt/warboard && git push origin HEAD:main 2>&1 | sed -E 's#//[^@]*@#//***@#g'
```

Expected: `main -> main`.

- [ ] **Step 6: Live check with the owner**

Give the owner the install link: `https://tornwar.com/scripts/torn-xanax-reminder.user.js?v=1.0.0`. Ask them to check, with Fly-out on:
1. Once the drug cooldown is over, the icon shows first in the row (right after the blood bag, if that shows), and it goes after they take a Xanax.
2. A tap opens their items on the Drugs tab.
3. A long press opens the key box. On PDA it says "Using the key Torn PDA gives the script."
4. Opening `https://www.torn.com/factions.php?step=your&type=1#/tab=armoury&start=0&sub=drugs` shows the armoury's Drugs tab.
5. In the 24 hours before their next ranked war, the tap shows the box, and Armoury opens the Drugs tab. This can only be checked once the next war is set; note it as owed.

Then confirm the two things nobody has verified yet, with remote inspect. Ask the owner to turn remote inspect on in the warboard app.
- **The drug cooldown's key** in Torn's sidebar data. Probe while a drug cooldown runs, on any page with the sidebar.
- **The armoury's Drugs tab.** Probe on the armoury page, opened from the link in item 4.

Before each probe, check that the in-app agent isn't using the relay, because a read of `/api/inspect/result` drains every result, the agent's too:

```bash
date; grep -E "POST /api/agent/(message|inspect)" /var/log/nginx/access.log | tail -2 | sed -E 's/^[0-9a-f.:]+ /<ip> /' | cut -c1-100
```

The log's times are CEST, like `date`. If the agent was used in the last 10 minutes, ask the owner to pause it.

Save this read-only probe as `$P/xanax-live.js`, with `$P` = `/tmp/claude-0/-root/47c424fc-f532-4851-8c7f-7c18d084306c/scratchpad/attack-status/probe`:

```js
// Read-only live check of Torn Xanax Reminder: the status-icon entries in Torn's sidebar data
// (key, title, end), the Xanax icon's place and label, and on the faction armoury page, its tab
// links and the panel on show (full class names). Clicks nothing, changes nothing.
const key = Object.keys(sessionStorage).find((k) => /^sidebarData\d+$/.test(k));
let icons = null;
try { icons = ((JSON.parse(sessionStorage.getItem(key)) || {}).statusIcons || {}).icons || null; } catch (e) { icons = 'unparsable'; }
const li = document.getElementById('tm-xanax-reminder');
const onArmoury = /tab=armoury/.test(location.hash);
return {
  t: new Date().toISOString(), href: location.href, now: Math.floor(Date.now() / 1000), dataKey: key || null,
  entries: icons && typeof icons === 'object' ? Object.keys(icons).map((k) => ({ key: k, title: icons[k] && icons[k].title, ends: icons[k] && icons[k].timerExpiresAt })) : icons,
  icon: li ? { inSidebar: !!li.closest('#sidebar'), before: li.previousElementSibling ? li.previousElementSibling.id || 'torn icon' : null, label: li.querySelector('a').getAttribute('aria-label') } : null,
  armouryLinks: onArmoury ? [...new Set([...document.querySelectorAll('a[href*="sub="]')].map((a) => a.getAttribute('href') + ' | ' + a.textContent.trim().slice(0, 30)))].slice(0, 40) : null,
  armouryShown: onArmoury ? [...document.querySelectorAll('.faction-armoury [class*="-wrap"]')].filter((e) => e.offsetParent !== null).map((e) => String(e.className)).slice(0, 10) : null,
};
```

Wrap it as `{"js": ...}` and queue it with that folder's `run1.sh` (from the Debuff Mobile Status work):

```bash
P=/tmp/claude-0/-root/47c424fc-f532-4851-8c7f-7c18d084306c/scratchpad/attack-status/probe
python3 -I -c 'import json,sys; print(json.dumps({"js": open(sys.argv[1]).read()}))' $P/xanax-live.js > $P/cmd-xanax.json
bash $P/run1.sh $P/cmd-xanax.json xanax && cat $P/xanax.json
```

The token stays in its file; never print it.

Read the result:
- **The drug cooldown entry.** While a drug cooldown runs, `entries` must hold one whose `key` is `drug_cooldown` or whose `title` starts with "Drug Cooldown".
  - If neither holds, the icon would show during the cooldown.
  - Fix it as 1.0.1 through a failing test first: a fixture with the real entry in the test that matches by title. Bump `@version`, `VERSION`, the meta file and the CHANGELOG, and check the served meta first (max(source, served) + 1).
- **The armoury's Drugs tab.** On the armoury page opened from the link, `armouryLinks` must hold a Drugs link with `sub=drugs`, and `armouryShown` must be the drugs panel (the weapons panel's class is `armoury-weapons-wrap`, so expect a `drugs` in the name).
  - If the Drugs tab has another name, fix `ARMOURY_URL` and the test's `ARMOURY` the same way, as 1.0.1.
- Record both answers in the project memory.

- [ ] **Step 7: Greasy Fork, memory and the link**

- **Greasy Fork:** the owner creates the script on Greasy Fork by pasting the served file. Greasy Fork rewrites the two URL lines; nothing else may differ. Ask for the Greasy Fork id. From then on, posts link to the Greasy Fork page.
- **Memory:** write `project_torn_xanax_reminder.md` with:
  - the release (1.0.0), its commits, and the served file's sha256 (first 8);
  - the live check results: the sidebar key, the armoury tab name, and the war-window check still owed;
  - the Greasy Fork id.

  Add its line to `MEMORY.md`, shortening another line so the file stays under 24,000 bytes.
- **Finish** by giving the owner the served URL: `https://tornwar.com/scripts/torn-xanax-reminder.user.js?v=1.0.0`.
