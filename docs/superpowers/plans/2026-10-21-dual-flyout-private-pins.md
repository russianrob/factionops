# Torn Dual Flyout Private: pinned links. Implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task by task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** a private test build of Torn Dual Flyout, `torn-dual-flyout-private.user.js` 1.6.0. It adds a row of pinned menu links under Torn's phone header. The links are picked in the cog panel and follow the menu live.

**Architecture:** the private file is the public 1.5.16 body plus one new "Pinned links" section, in the same file and style.
- The pins are copies of Torn's own fly-out rows: href, name, icon with its computed fill, and count.
- They are drawn into `#tdf-pins`, directly before `#sidebar [class*="userInformationMobile___"]`.
- They are redrawn by a MutationObserver on `#fly-out-panel` and by the existing 800ms tick.
- A measured spacer at the top of `.content-wrapper[role="main"]` stops the page content sliding under the row, if Torn does not move it down.

**Tech stack:** a plain ES5 userscript (`@grant none`, localStorage). Tests use node:test and linkedom (`cd /opt/warboard/server && node --test`).

**Spec:** `docs/superpowers/specs/2026-10-21-dual-flyout-private-pins-design.md`

## Global constraints

- The public `server/public/scripts/torn-dual-flyout.user.js` stays byte-identical.
- @version `1.6.0` equals `window.__tdfVer = "1.6.0"`.
- Header fields:
  - @name `Torn Dual Flyout Private`
  - @namespace `RussianRob.torn-dual-flyout.private`
  - @author `RussianRob`
  - @license `All Rights Reserved`
  - no @copyright
- @downloadURL `https://tornwar.com/scripts/torn-dual-flyout-private.user.js` and @updateURL `https://tornwar.com/scripts/torn-dual-flyout-private.meta.js`. The `.meta.js` is the header block only.
- `@grant none`, no GM_* calls, and no curly quotes anywhere: PDA straightens them and the script stops parsing.
- Shared settings keys stay as they are: `tmr_side`, `tdf_iconsonly`, `tdf_sticky`. The one new key is `tdf_pins`, a JSON array of pin keys in tick order.
- Pins are plain `<a href>` links. Nothing is clicked on the player's behalf.
- The row never scrolls sideways: `flex-wrap:wrap`, and no `overflow:auto|scroll`.
- New code gets clear explanatory `//` comments (the owner's preference).
- Stage only the files this plan creates. The repo has unrelated dirty files (`server/data/rwp-prices.json`, `server/public/river9-watch.txt`, `server/public/s/*`).
- Commit trailer: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review focus

1. **Torn re-renders the sidebar or the menu every few seconds.** The row must come back, and must not be rebuilt under a finger when nothing changed. Covered in Task 2: "a row dropped by a Torn re-render comes back on the next tick" and "a tick with nothing new leaves the pins in place".
2. **A damaged or foreign `tdf_pins` value**, such as not JSON, not an array, or holding non-strings. It must be treated as nothing pinned, with no crash. Task 2: "a damaged pins setting is treated as nothing pinned".
3. **A pinned link Torn later drops from the menu.** It is kept and not drawn, and the other pins still show. Task 2: "a pinned link that is no longer in the menu waits, undrawn".
4. **Torn writing a link absolute instead of relative.** The pin still matches its link. Task 2: "a pin matches its menu link whether Torn writes the address absolute or relative".
5. **The menu not loaded yet at document-start.** The row appears once links arrive, and the cog list says so instead of showing nothing. Task 2: "pins appear once the menu has loaded its links". Task 3: "before the menu has loaded, the list says so".

## Files

- Create `server/public/scripts/torn-dual-flyout-private.user.js`: the private build. Served as is.
- Create `server/public/scripts/torn-dual-flyout-private.meta.js`: the header only, which update checks poll.
- Create `server/torn-dual-flyout-private.test.mjs`: the behaviour tests. `TDFP_SRC=` tests a working copy.
- Unchanged: `server/public/scripts/torn-dual-flyout.user.js`, and the existing `server/torn-dual-flyout-edge.test.mjs` and `-icons.test.mjs`. Those two re-run against the private file through `TDF_SRC=`.

All edits to the private script are exact-anchor swaps. A small node script replaces one anchor string, and refuses if the anchor does not occur exactly once:

```js
// swap.js: node swap.js FILE ANCHOR_FILE REPLACEMENT_FILE
const fs = require('fs');
const [file, a, b] = process.argv.slice(2);
const src = fs.readFileSync(file, 'utf8'), from = fs.readFileSync(a, 'utf8'), to = fs.readFileSync(b, 'utf8');
const n = src.split(from).length - 1;
if (n !== 1) { console.error('anchor found ' + n + ' times'); process.exit(1); }
fs.writeFileSync(file, src.replace(from, () => to));
```

---

### Task 1: The private build, its identity, and coexistence with the public copy

**Files:** create the private `.user.js` and `.meta.js`, and create the test file with its harness.

**Interfaces:**
- Produces:
  - The private file: public body, new header, `__tdfVer` "1.6.0", the guard `if (window.__tornMenuRight) { showBothOnNote(); return; }`, and the settings title "Torn Dual Flyout Private".
  - Test-harness helpers that every later task uses: `load({ order, stored, iconsOnly, menu })` returns `{ document, win, store, touch, tick, mutate, flush, pins, openCog, tickBox, panel }`. Also `styledBy(document, el)` and the constants `MENU`, `TARGETS`, `FILL`.

- [ ] **Step 1: Write the test file with the harness and the identity and coexistence tests**

```js
// torn-dual-flyout-private: the private test build of Torn Dual Flyout, which adds a
// row of pinned menu links under Torn's phone header.
//
// A player asked for a "both option": their most-used links (Crimes, Targets, Gym) at
// the top of the page and the rest left in Torn's fly-out sidebar, because sliding
// Torn's old top bar is finicky. The pins are ticked in the cog panel, drawn above the
// name/bars strip, and follow the menu live. Spec:
// docs/superpowers/specs/2026-10-21-dual-flyout-private-pins-design.md
//
// linkedom has no layout or cascade: these tests run the real script against Torn's
// phone markup, resolve its stylesheet with element.matches(), and stub the few
// measurements the spacer takes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseHTML } from 'linkedom';

// TDFP_SRC lets a working copy be tested before it is installed over the served file.
const SRC = process.env.TDFP_SRC || '/opt/warboard/server/public/scripts/torn-dual-flyout-private.user.js';
const META = SRC.replace(/\.user\.js$/, '.meta.js');
const PUBLIC = '/opt/warboard/server/public/scripts/torn-dual-flyout.user.js';
// What the browser reports for a menu icon's fill: Torn's CSS points it at a gradient.
const FILL = 'url("#sidebar_svg_gradient_regular_mobile")';
const TARGETS = '/page.php?sid=list&type=targets';

// One area row as Torn's sidebar build draws it (nL / nM in app.4af34ba3e31baa7e.js).
function areaRow(id, href, name) {
  return `<div class="area-mobile___AK1cR notList___jrp60" id="nav-${id}"><div class="areaRow___Eheay">` +
    `<a href="${href}" class="link___tg6eQ mobileLink___NbSV4"><span class="svgIconWrap___MDuQ8"><span class="defaultIcon___GnL0d mobile___nUzYc">` +
    `<svg id="${id}-icon" viewBox="0 0 20 20"><path d="M0 0h20v20z"/></svg></span></span>` +
    `<span class="linkName___YZMai">${name}</span></a></div></div>`;
}
// Torn's menu, cut down: the Messages / Events / Awards icons (Events with 4 unread),
// three area rows, and a Targets list row expanded to show one person.
const MENU = `
  <div class="accountLinksWrap___wnKEu mobile___hMyTx"><div class="accountLinks___GEnNc">
    <div class="wrap___zBGBU"><a href="/messages.php" class="messages___kA4RB" id="nav-messages" aria-label="Messages"><svg viewBox="0 0 24 24"><path d="M0 0h24v24z"/></svg></a></div>
    <div class="wrap___zBGBU"><a href="/events.php" class="events___wU4rv positive___Jcxif" id="nav-events" aria-label="Events, 4 new"><svg viewBox="0 0 24 24"><path d="M0 0h24v24z"/></svg><span class="amount___vyASa">4</span></a></div>
    <div class="wrap___zBGBU"><a href="/awards.php" class="awards___yD4LU" id="nav-awards" aria-label="Awards"><svg viewBox="0 0 24 24"><path d="M0 0h24v24z"/></svg></a></div>
  </div></div>
  <div class="areas___u5RJi areasMobile___CpJPd">
    ${areaRow('gym', '/gym.php', 'Gym')}
    ${areaRow('crimes', '/loader.php?sid=crimes', 'Crimes')}
    ${areaRow('forums', '/forums.php', 'Forums')}
    <div class="area-mobile___AK1cR list___biv0w" id="nav-targets_list">
      <div class="areaRow___Eheay activated___B5fHK">
        <a href="${TARGETS.replace('&', '&amp;')}" class="link___tg6eQ mobileLink___NbSV4 listLink___OocMj"><span class="svgIconWrap___MDuQ8"><span class="defaultIcon___GnL0d mobile___nUzYc"><svg viewBox="0 0 18 18"><path d="M0 0h18v18z"/></svg></span></span><span class="linkName___YZMai">Targets</span><span class="listAmount___YYmp1">12</span></a>
        <button type="button" class="toggleBtn___hJrM0 activated___B5fHK" aria-label="Toggle Targets list"><span class="arrow___TSkXC"></span></button>
      </div>
      <div class="members"><a href="/profiles.php?XID=1">Someone</a></div>
    </div>
  </div>`;

// A Torn page on a phone: header with the menu button, #sidebar holding the fly-out
// panel and the name/bars strip, then the page content.
function page(menu) {
  return `<html><head></head><body>
    <div id="header-root"><div class="header-wrapper-top"><button id="fly-out-menu-button"><svg id="menu-icon"><path d="M0 0h1v1z"/></svg></button></div></div>
    <div id="sidebarroot"><div id="sidebar" class="sidebar___c4dEc mobile___fSMgm">
      <aside id="fly-out-panel" class="flyOutPanel___Zqwqt">${menu}</aside>
      <div class="userInformationMobile___Aznrv"><div>name and money</div><div class="swiperWrapper___gaWYk">bars</div></div>
    </div></div>
    <div class="content-wrapper" role="main"><h4 id="page-title">Home</h4></div>
  </body></html>`;
}

// Runs the real script(s) against that page. order: 'private' (this build alone),
// 'public-first' or 'private-first' (both copies installed, loading in that order).
// stored: what tdf_pins holds (an array, or a raw string to store as is).
function load({ order = 'private', stored = null, iconsOnly = false, menu = MENU } = {}) {
  const { document, Event } = parseHTML(page(menu));
  const btn = document.getElementById('fly-out-menu-button');
  btn.getClientRects = () => [{}];   // laid out: the phone header is showing
  const panel = document.getElementById('fly-out-panel');
  btn.__reactProps$tdfp = { onClick() { panel.classList.toggle('visible___AnarB'); } };

  const store = new Map([['tmr_side', 'r'], ['tdf_iconsonly', iconsOnly ? '1' : '0']]);
  if (stored !== null) store.set('tdf_pins', typeof stored === 'string' ? stored : JSON.stringify(stored));
  const localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  };
  const touch = {};
  document.addEventListener = (type, fn) => { (touch[type] = touch[type] || []).push(fn); };
  const intervals = [], timeouts = [], observers = [];
  class MO { constructor(cb) { this.cb = cb; observers.push(this); } observe() {} disconnect() {} }
  const win = { innerWidth: 393, addEventListener() {} };
  const getComputedStyle = (el) => ({ fill: /^svg$/i.test(el.tagName) ? FILL : '' });
  const run = (file) => new Function('window', 'document', 'localStorage', 'MutationObserver', 'getComputedStyle',
    'setInterval', 'setTimeout', 'clearInterval', readFileSync(file, 'utf8'))(
    win, document, localStorage, MO, getComputedStyle,
    (fn) => { intervals.push(fn); return intervals.length; },
    (fn) => { timeouts.push(fn); return timeouts.length; },
    () => {});
  if (order === 'public-first') run(PUBLIC);
  run(SRC);
  if (order === 'private-first') run(PUBLIC);

  const flush = () => { while (timeouts.length) timeouts.shift()(); };
  const tick = () => { intervals.slice().forEach((fn) => fn()); flush(); };   // one round of the timers
  const mutate = () => { observers.forEach((o) => o.cb([])); flush(); };      // Torn changed the DOM
  const pins = () => [...document.querySelectorAll('#tdf-pins a')];
  function openCog() {
    tick();   // the cog is placed by the timer, beside the menu button
    document.getElementById('tdf-cog').dispatchEvent(new Event('click'));
    return document.getElementById('tdf-settings');
  }
  function tickBox(key, on) {
    const cb = document.querySelector(`#tdf-settings input[data-key="${key}"]`);
    cb.checked = on;
    cb.dispatchEvent(new Event('change'));
  }
  return { document, win, store, touch, tick, mutate, flush, pins, openCog, tickBox, panel };
}

// Every declaration in the script's own stylesheet whose selector matches el.
function styledBy(document, el) {
  const css = document.getElementById('torn-menu-right').textContent;
  const out = {};
  for (const [, selectors, body] of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const hit = selectors.split(',').some((sel) => {
      try { return el.matches(sel.trim()); } catch { return false; }   // ::after and the like
    });
    if (!hit) continue;
    for (const decl of body.split(';')) {
      const i = decl.indexOf(':');
      if (i > 0) out[decl.slice(0, i).trim()] = decl.slice(i + 1).trim();
    }
  }
  return out;
}

function header(text) {
  const m = text.match(/\/\/ ==UserScript==[\s\S]*?\/\/ ==\/UserScript==/);
  return m ? m[0] : '';
}
function field(h, name) {
  const m = h.match(new RegExp('^// @' + name + '[ \\t]+(.+)$', 'm'));
  return m ? m[1].trim() : null;
}

test('the header names the private build, its own update address, and the version the page reports', () => {
  const h = header(readFileSync(SRC, 'utf8'));
  assert.equal(field(h, 'name'), 'Torn Dual Flyout Private');
  assert.equal(field(h, 'namespace'), 'RussianRob.torn-dual-flyout.private');
  assert.equal(field(h, 'version'), '1.6.0');
  assert.equal(field(h, 'author'), 'RussianRob');
  assert.equal(field(h, 'license'), 'All Rights Reserved');
  assert.equal(field(h, 'downloadURL'), 'https://tornwar.com/scripts/torn-dual-flyout-private.user.js');
  assert.equal(field(h, 'updateURL'), 'https://tornwar.com/scripts/torn-dual-flyout-private.meta.js');
  assert.equal(field(h, 'grant'), 'none');
  assert.equal(field(h, 'copyright'), null);
  assert.equal(load().win.__tdfVer, '1.6.0');
});

test('the .meta.js update file carries the same header as the script', () => {
  assert.equal(header(readFileSync(META, 'utf8')), header(readFileSync(SRC, 'utf8')));
});

test('no curly quotes anywhere in the script: PDA straightens them and the script stops parsing', () => {
  assert.doesNotMatch(readFileSync(SRC, 'utf8'), /[‘’“”]/);
});

test('with the public Torn Dual Flyout already running, this build stays off and says so', () => {
  const p = load({ order: 'public-first', stored: ['/gym.php'] });
  assert.equal(p.document.querySelectorAll('#torn-menu-right').length, 1);   // the public copy's stylesheet only
  assert.equal(p.touch.touchstart.length, 1);                                // one swipe handler: the public one
  assert.equal(p.win.__tdfVer, '1.5.16');
  p.tick();
  assert.equal(p.document.getElementById('tdf-pins'), null);
  const note = p.document.getElementById('tdfp-both-on');
  assert.ok(note, 'a note says why');
  assert.match(note.textContent, /public Torn Dual Flyout is also on/);
});

test('loaded first, this build keeps the public copy from starting a second time', () => {
  const p = load({ order: 'private-first' });
  assert.equal(p.document.querySelectorAll('#torn-menu-right').length, 1);
  assert.equal(p.touch.touchstart.length, 1);
  assert.equal(p.win.__tdfVer, '1.6.0');
  p.tick();
  assert.equal(p.document.getElementById('tdfp-both-on'), null);
});

test('the cog panel says which build is running', () => {
  const settings = load().openCog();
  assert.match(settings.querySelector('h4').textContent, /^Torn Dual Flyout Private/);
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `cd /opt/warboard/server && node --test torn-dual-flyout-private.test.mjs`
Expected: FAIL, every test with `ENOENT ... torn-dual-flyout-private.user.js`.

- [ ] **Step 3: Create the private build from the public file**

```bash
cd /opt/warboard/server && node - <<'EOF'
const fs = require('fs');
const pub = fs.readFileSync('public/scripts/torn-dual-flyout.user.js', 'utf8');
function swap(src, from, to) {
  const n = src.split(from).length - 1;
  if (n !== 1) throw new Error('anchor found ' + n + ' times: ' + from.slice(0, 70));
  return src.replace(from, () => to);
}
const HEADER = [
  '// ==UserScript==',
  '// @name         Torn Dual Flyout Private',
  '// @namespace    RussianRob.torn-dual-flyout.private',
  '// @version      1.6.0',
  "// @description  Private test build of Torn Dual Flyout: the two-way swipe menu plus a row of pinned menu links under Torn's phone header. Run this OR the public Torn Dual Flyout, not both.",
  '// @author       RussianRob',
  '// @downloadURL  https://tornwar.com/scripts/torn-dual-flyout-private.user.js',
  '// @updateURL    https://tornwar.com/scripts/torn-dual-flyout-private.meta.js',
  '// @license      All Rights Reserved',
  '// @match        https://www.torn.com/*',
  '// @run-at       document-start',
  '// @grant        none',
  '// ==/UserScript=='
].join('\n');
const OLD_GUARD = [
  '  if (window.__tornMenuRight) return;',
  '  window.__tornMenuRight = true;',
  '  window.__tdfVer = "1.5.16";   // runtime version marker (confirm the installed build)'
].join('\n');
const NEW_GUARD = [
  '  // Shown instead of running when another copy of Torn Dual Flyout got here first.',
  '  function showBothOnNote() {',
  '    var tries = 0;',
  '    var iv = setInterval(function () {',
  '      if (++tries > 100) { clearInterval(iv); return; }        // ~20s and still no page: give up',
  '      if (!document.body) return;                              // document-start: wait for <body>',
  '      clearInterval(iv);',
  '      if (document.getElementById("tdfp-both-on")) return;',
  '      var n = document.createElement("div");',
  '      n.id = "tdfp-both-on";',
  '      n.setAttribute("style", "position:fixed;left:0;right:0;top:0;z-index:2147483002;padding:8px 34px 8px 10px;" +',
  '        "background:#3b2f00;color:#ffe08a;border-bottom:1px solid #6b5500;font:13px/1.35 -apple-system,system-ui,sans-serif;");',
  '      n.textContent = "Torn Dual Flyout Private is off because the public Torn Dual Flyout is also on. " +',
  '        "Turn the public one off to test this build.";',
  '      var x = document.createElement("span");',
  '      x.textContent = "\\u00d7";',
  '      x.setAttribute("style", "position:absolute;right:10px;top:3px;font-size:20px;cursor:pointer;");',
  '      x.addEventListener("click", function () { n.remove(); });',
  '      n.appendChild(x);',
  '      document.body.appendChild(n);',
  '    }, 200);',
  '  }',
  '  // Two copies of Torn Dual Flyout would both answer every swipe. The public copy',
  '  // already steps aside when this flag is set, so whichever loads first runs alone;',
  '  // if the public one won, this build stays off and says why.',
  '  if (window.__tornMenuRight) { showBothOnNote(); return; }',
  '  window.__tornMenuRight = true;',
  '  window.__tdfVer = "1.6.0";   // runtime version marker (confirm the installed build)'
].join('\n');
let s = pub;
s = swap(s, pub.slice(0, pub.indexOf('// ==/UserScript==') + '// ==/UserScript=='.length), HEADER);
s = swap(s, OLD_GUARD, NEW_GUARD);
s = swap(s, "d.innerHTML = '<h4>Torn Dual Flyout <span", "d.innerHTML = '<h4>Torn Dual Flyout Private <span");
fs.writeFileSync('public/scripts/torn-dual-flyout-private.user.js', s);
fs.writeFileSync('public/scripts/torn-dual-flyout-private.meta.js', HEADER + '\n');
EOF
```

- [ ] **Step 4: Run the new tests, and the old Dual Flyout tests against the private file**

Run: `cd /opt/warboard/server && node --test torn-dual-flyout-private.test.mjs && TDF_SRC=$PWD/public/scripts/torn-dual-flyout-private.user.js node --test torn-dual-flyout-edge.test.mjs torn-dual-flyout-icons.test.mjs`
Expected: PASS 6/6, then PASS 8/8.

- [ ] **Step 5: Commit**

```bash
cd /opt/warboard && git add server/public/scripts/torn-dual-flyout-private.user.js server/public/scripts/torn-dual-flyout-private.meta.js server/torn-dual-flyout-private.test.mjs && git commit -m "torn-dual-flyout-private 1.6.0: private test copy of Torn Dual Flyout

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: The pinned-links row

**Files:** modify the private `.user.js` (CSS string, a new Pinned links section, and the init/tick hooks). Add tests to the test file.

**Interfaces:**
- Consumes: from Task 1, `panel()`, the `css` string, and the 800ms `setInterval`.
- Produces, for Tasks 3 and 4:
  - `loadPins(): string[]` and `savePins(list: string[])`
  - `pinKey(href): string`
  - `menuLinks(): Array<{key, href, name, count, attn, svg}>`
  - `fillOf(link): string`
  - `iconClone(link): HTMLSpanElement` (class `tdf-pin-icon`)
  - `pinEl(link): HTMLAnchorElement`
  - `renderPins()`
  - DOM ids `#tdf-pins` and classes `tdf-pin`, `tdf-pin-name`, `tdf-pin-badge`, `tdf-pin-attn`

- [ ] **Step 1: Write the failing tests (add them to the test file)**

```js
test('with nothing pinned the page is left as Torn drew it', () => {
  const p = load();
  p.tick(); p.mutate();
  assert.equal(p.document.getElementById('tdf-pins'), null);
  assert.equal(p.document.getElementById('tdf-pins-spacer'), null);
});

test('pinned links sit above the bars strip, in the order they were ticked, as plain links', () => {
  const p = load({ stored: [TARGETS, '/gym.php', '/messages.php'] });
  p.tick();
  const row = p.document.getElementById('tdf-pins');
  assert.ok(row, 'row drawn');
  assert.equal(row.parentNode.id, 'sidebar');
  assert.match(row.nextElementSibling.className, /userInformationMobile___/);
  assert.deepEqual(p.pins().map((a) => a.getAttribute('href')), [TARGETS, '/gym.php', '/messages.php']);
  assert.deepEqual(p.pins().map((a) => a.querySelector('.tdf-pin-name').textContent), ['Targets', 'Gym', 'Messages']);
});

test('each pin carries its menu icon, coloured the way the menu colours it', () => {
  const p = load({ stored: ['/gym.php', '/messages.php'] });
  p.tick();
  for (const a of p.pins()) {
    const svg = a.querySelector('.tdf-pin-icon svg');
    assert.ok(svg, `${a.getAttribute('href')} has an icon`);
    assert.equal(svg.getAttribute('id'), null);   // the copy brings no duplicate id
    assert.match(svg.getAttribute('style') || '', /fill:url\("#sidebar_svg_gradient_regular_mobile"\)/);
  }
});

test('a pin shows the menu\'s unread count, but not the size of a list', () => {
  const p = load({ stored: ['/events.php', TARGETS] });
  p.tick();
  const [events, targets] = p.pins();
  assert.equal(events.querySelector('.tdf-pin-badge').textContent, '4');
  assert.equal(events.querySelector('.tdf-pin-name').textContent, 'Events');   // not "Events, 4 new"
  assert.equal(targets.querySelector('.tdf-pin-badge'), null);
});

test('the row wraps onto another line and never scrolls sideways', () => {
  const p = load({ stored: ['/gym.php'] });
  p.tick();
  const css = styledBy(p.document, p.document.getElementById('tdf-pins'));
  assert.equal(css['display'], 'flex');
  assert.equal(css['flex-wrap'], 'wrap');
  for (const prop of ['overflow', 'overflow-x']) assert.doesNotMatch(css[prop] || '', /auto|scroll/);
});

test('Icons only hides the names under the pins, as it does in the menu', () => {
  const on = load({ stored: ['/gym.php'], iconsOnly: true });
  on.tick();
  assert.equal(styledBy(on.document, on.pins()[0].querySelector('.tdf-pin-name')).display, 'none');
  const off = load({ stored: ['/gym.php'] });
  off.tick();
  assert.notEqual(styledBy(off.document, off.pins()[0].querySelector('.tdf-pin-name')).display, 'none');
});

test('a row dropped by a Torn re-render comes back on the next tick', () => {
  const p = load({ stored: ['/gym.php'] });
  p.tick();
  p.document.getElementById('tdf-pins').remove();
  p.tick();
  const row = p.document.getElementById('tdf-pins');
  assert.ok(row, 'row back');
  assert.match(row.nextElementSibling.className, /userInformationMobile___/);
});

test('a tick with nothing new leaves the pins in place, so a tap in progress is not lost', () => {
  const p = load({ stored: ['/gym.php'] });
  p.tick();
  const before = p.pins()[0];
  p.tick(); p.tick();
  assert.equal(p.pins()[0], before);
});

test('a damaged pins setting is treated as nothing pinned', () => {
  for (const bad of ['{oops', '"just a string"', '[1, null, {}]']) {
    const p = load({ stored: bad });
    p.tick();
    assert.equal(p.document.getElementById('tdf-pins'), null, bad);
  }
});

test('a pinned link that is no longer in the menu waits, undrawn, and the rest still show', () => {
  const p = load({ stored: ['/gone.php', '/gym.php'] });
  p.tick();
  assert.deepEqual(p.pins().map((a) => a.getAttribute('href')), ['/gym.php']);
  assert.equal(p.store.get('tdf_pins'), JSON.stringify(['/gone.php', '/gym.php']));   // still remembered
});

test('a pin matches its menu link whether Torn writes the address absolute or relative', () => {
  const menu = MENU.replace('href="/gym.php"', 'href="https://www.torn.com/gym.php"');
  const p = load({ stored: ['/gym.php'], menu });
  p.tick();
  assert.equal(p.pins().length, 1);
  assert.equal(p.pins()[0].getAttribute('href'), 'https://www.torn.com/gym.php');
});

test('pins appear once the menu has loaded its links', () => {
  const p = load({ stored: ['/gym.php'], menu: '' });
  p.tick();
  assert.equal(p.document.getElementById('tdf-pins'), null);
  p.panel.innerHTML = MENU;
  p.tick();
  assert.equal(p.pins().length, 1);
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `cd /opt/warboard/server && node --test torn-dual-flyout-private.test.mjs`
Expected: FAIL on the new row tests (`row drawn` / `Cannot read properties of null`). The "nothing pinned" and "damaged setting" tests pass already: no row exists yet.

- [ ] **Step 3: Add the row CSS.** The anchor is the last line of the `css` string:

```js
    'html.tdf-preopen #sidebar [class*="overlay___"]{display:none!important;}';
```

Replace it with:

```js
    'html.tdf-preopen #sidebar [class*="overlay___"]{display:none!important;}' +
    // Pinned links: a row under Torn's phone header. It wraps onto another line rather
    // than ever scrolling sideways (sliding strips are what the player found finicky),
    // and takes Torn's own panel colours so it suits light and dark mode alike.
    '#tdf-pins{display:flex;flex-wrap:wrap;justify-content:center;gap:2px 4px;box-sizing:border-box;width:100%;padding:3px 4px;' +
    'background:var(--default-bg-panel-color,#333);color:var(--default-color,#ddd);border-bottom:1px solid rgba(0,0,0,.35);}' +
    '#tdf-pins .tdf-pin{position:relative;display:flex;flex-direction:column;align-items:center;justify-content:center;box-sizing:border-box;' +
    'min-width:44px;min-height:32px;padding:2px 4px;border-radius:4px;color:inherit;text-decoration:none;' +
    '-webkit-touch-callout:none;-webkit-tap-highlight-color:transparent;}' +
    '#tdf-pins .tdf-pin-attn{background:rgba(34,139,230,.18);}' +
    '.tdf-pin-icon{display:inline-flex;align-items:center;justify-content:center;width:34px;height:23px;line-height:0;}' +
    '.tdf-pin-icon svg{max-width:100%;max-height:100%;}' +
    '#tdf-pins .tdf-pin-name{font:10px/12px Arial,Helvetica,sans-serif;max-width:68px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}' +
    '#tdf-pins .tdf-pin-badge{position:absolute;top:0;right:1px;font:700 10px/12px Arial,Helvetica,sans-serif;color:#a9e34b;text-shadow:0 1px rgba(0,0,0,.25);}' +
    'html.tdf-iconsonly #tdf-pins .tdf-pin-name{display:none;}';
```

- [ ] **Step 4: Add the Pinned links section.** Insert it directly before this anchor:

```js
  setInterval(function () { ensureCog(); startMenuObserver(); syncMenuOpen(); }, 800);
```

The section:

```js
  // ---- Pinned links ------------------------------------------------------------
  // A row of the menu links the player ticked in the cog panel, drawn under Torn's
  // phone header so favourites are one tap away without opening the menu. The menu
  // itself is left exactly as Torn draws it. Each pin is a plain link to the same
  // address as its menu row: tapping one is an ordinary navigation, nothing is
  // clicked on the player's behalf.
  var PINS_KEY = "tdf_pins";   // JSON array of pin keys, in the order they were ticked
  function loadPins() {
    try {
      var v = JSON.parse(localStorage.getItem(PINS_KEY) || "[]");
      return Array.isArray(v) ? v.filter(function (k) { return typeof k === "string" && k !== ""; }) : [];
    } catch (e) { return []; }
  }
  function savePins(list) { try { localStorage.setItem(PINS_KEY, JSON.stringify(list)); } catch (e) {} }
  // A pin is remembered by its link with any scheme and host taken off, so a page
  // matches whether Torn writes its address absolute or relative.
  function pinKey(href) { return String(href || "").replace(/^[a-z][a-z0-9+.-]*:\/\/[^\/]*/i, ""); }

  // Every top-level link in Torn's menu, top to bottom: the Messages / Events / Awards
  // icons, then each area and list row. The people a list row expands to show sit
  // outside the row's own link, so they are not picked up.
  var MENU_LINK_SEL = '[class*="accountLinks___"] a[href], [id^="nav-"] > [class*="areaRow___"] > a[href]';
  function menuLinks() {
    var p = panel(), out = [], seen = {}, i;
    if (!p) return out;
    var links = p.querySelectorAll(MENU_LINK_SEL);
    for (i = 0; i < links.length; i++) {
      var a = links[i], href = a.getAttribute("href"), key = pinKey(href);
      if (!key || seen[key]) continue;
      seen[key] = true;
      // Area and list rows carry their name in a span; the account icons only in
      // their aria-label ("Events, 4 new").
      var nameEl = a.querySelector('[class*="linkName___"]');
      var name = (nameEl ? nameEl.textContent : (a.getAttribute("aria-label") || "")).replace(/,\s*[\d,]+\s+new\s*$/i, "").trim();
      // An unread or waiting count. Class matching is case-sensitive: a list row's
      // member count is listAmount___, left out on purpose (a list size is not news).
      var countEl = a.querySelector('[class*="amount___"]');
      var row = a.closest('[id^="nav-"]');
      out.push({
        key: key, href: href, name: name || key,
        count: countEl ? countEl.textContent.trim() : "",
        attn: !!row && /attention___/.test(row.className),   // Torn's blue "something here" tint
        svg: a.querySelector("svg")
      });
    }
    return out;
  }
  // Torn colours its icons with rules that only reach inside the menu, so a copy
  // anywhere else would come out black: carry the colour across as an inline fill.
  // The gradients those fills point at are defined once for the whole page.
  function fillOf(link) {
    if (link.fill === undefined) {
      link.fill = "";
      try { link.fill = (link.svg && getComputedStyle(link.svg).fill) || ""; } catch (e) {}
    }
    return link.fill;
  }
  function iconClone(link) {
    var wrap = document.createElement("span");
    wrap.className = "tdf-pin-icon";
    if (link.svg) {
      var c = link.svg.cloneNode(true);
      c.removeAttribute("id");
      if (fillOf(link)) c.setAttribute("style", "fill:" + fillOf(link) + ";" + (c.getAttribute("style") || ""));
      wrap.appendChild(c);
    }
    return wrap;
  }
  function pinEl(link) {
    var a = document.createElement("a");
    a.className = "tdf-pin" + (link.attn ? " tdf-pin-attn" : "");
    a.setAttribute("href", link.href);
    a.setAttribute("aria-label", link.count ? link.name + ", " + link.count : link.name);
    a.appendChild(iconClone(link));
    var name = document.createElement("span");
    name.className = "tdf-pin-name";
    name.textContent = link.name;
    a.appendChild(name);
    if (link.count) {
      var badge = document.createElement("span");
      badge.className = "tdf-pin-badge";
      badge.textContent = link.count;
      a.appendChild(badge);
    }
    return a;
  }
  // Draw (or re-draw) the row directly above Torn's name/bars strip, the first thing
  // under the header on a phone. No strip means this is not the phone layout: no row.
  function renderPins() {
    var row = document.getElementById("tdf-pins");
    var strip = document.querySelector('#sidebar [class*="userInformationMobile___"]');
    var byKey = {}, shown = [];
    menuLinks().forEach(function (l) { byKey[l.key] = l; });
    // A pin whose link has left the menu stays remembered, just not drawn.
    loadPins().forEach(function (k) { if (byKey[k]) shown.push(byKey[k]); });
    if (!strip || !shown.length) {
      if (row) row.remove();
      return;
    }
    if (!row) {
      row = document.createElement("nav");
      row.id = "tdf-pins";
      row.setAttribute("aria-label", "Pinned links");
    }
    if (row.parentNode !== strip.parentNode || row.nextSibling !== strip) strip.parentNode.insertBefore(row, strip);
    // Rebuild only when something a pin shows has changed, so the 800ms tick never
    // swaps a pin out from under a finger mid-tap.
    var sig = JSON.stringify(shown.map(function (l) { return [l.key, l.name, l.count, l.attn, fillOf(l)]; }));
    if (row.__tdfSig !== sig) {
      row.__tdfSig = sig;
      row.textContent = "";
      shown.forEach(function (l) { row.appendChild(pinEl(l)); });
    }
  }

```

- [ ] **Step 5: Hook the row into the init and the 800ms tick.** Replace:

```js
  setInterval(function () { ensureCog(); startMenuObserver(); syncMenuOpen(); }, 800);
  ensureCog();
  startMenuObserver();
```

with:

```js
  setInterval(function () { ensureCog(); startMenuObserver(); syncMenuOpen(); renderPins(); }, 800);
  ensureCog();
  startMenuObserver();
  renderPins();
```

- [ ] **Step 6: Run the tests and watch them pass**

Run: `cd /opt/warboard/server && node --test torn-dual-flyout-private.test.mjs && TDF_SRC=$PWD/public/scripts/torn-dual-flyout-private.user.js node --test torn-dual-flyout-edge.test.mjs torn-dual-flyout-icons.test.mjs`
Expected: PASS 18/18, then PASS 8/8.

- [ ] **Step 7: Commit** with message `torn-dual-flyout-private: pinned-links row under the phone header`.

---

### Task 3: The checklist in the cog panel

**Files:** modify the private `.user.js` (`buildSettings`, `toggleSettings`, the CSS string, and two new functions). Add tests.

**Interfaces:**
- Consumes: `menuLinks`, `loadPins`, `savePins`, `iconClone` and `renderPins` from Task 2.
- Produces:
  - `fillPinList(d)` and `setPinned(key: string, on: boolean)`
  - DOM: `#tdf-settings .tdf-pins-list input[data-key]`, and `.tdf-pins-none` for the empty-menu message

- [ ] **Step 1: Write the failing tests**

```js
test('the cog panel lists every link in the menu once, and not the people a list shows', () => {
  const settings = load().openCog();
  const keys = [...settings.querySelectorAll('.tdf-pins-list input[data-key]')].map((cb) => cb.getAttribute('data-key'));
  assert.deepEqual(keys, ['/messages.php', '/events.php', '/awards.php', '/gym.php', '/loader.php?sid=crimes', '/forums.php', TARGETS]);
  const names = [...settings.querySelectorAll('.tdf-pins-list label')].map((l) => l.textContent.trim());
  assert.deepEqual(names, ['Messages', 'Events', 'Awards', 'Gym', 'Crimes', 'Forums', 'Targets']);
});

test('the list shows what is already pinned', () => {
  const settings = load({ stored: ['/gym.php'] }).openCog();
  const checked = [...settings.querySelectorAll('.tdf-pins-list input[data-key]')]
    .filter((cb) => cb.checked).map((cb) => cb.getAttribute('data-key'));
  assert.deepEqual(checked, ['/gym.php']);
});

test('ticking pins links in the order ticked, and unticking takes one off', () => {
  const p = load();
  p.openCog();
  p.tickBox('/loader.php?sid=crimes', true);
  p.tickBox('/gym.php', true);
  assert.equal(p.store.get('tdf_pins'), JSON.stringify(['/loader.php?sid=crimes', '/gym.php']));
  assert.deepEqual(p.pins().map((a) => a.getAttribute('href')), ['/loader.php?sid=crimes', '/gym.php']);
  p.tickBox('/loader.php?sid=crimes', false);
  assert.equal(p.store.get('tdf_pins'), JSON.stringify(['/gym.php']));
  assert.deepEqual(p.pins().map((a) => a.getAttribute('href')), ['/gym.php']);
  p.tickBox('/gym.php', false);
  assert.equal(p.document.getElementById('tdf-pins'), null);
});

test('before the menu has loaded, the list says so instead of showing nothing', () => {
  const settings = load({ menu: '' }).openCog();
  assert.match(settings.querySelector('.tdf-pins-list').textContent, /No menu links found yet/);
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `cd /opt/warboard/server && node --test torn-dual-flyout-private.test.mjs`
Expected: FAIL on the 4 new tests (no `.tdf-pins-list`).

- [ ] **Step 3: Add the section to the panel's HTML.** Replace:

```js
      '<label><input type="checkbox" class="tdf-sticky-cb"' + (sticky() ? " checked" : "") + "> Sticky (keep menu open across pages + scroll while open)</label>";
```

with:

```js
      '<label><input type="checkbox" class="tdf-sticky-cb"' + (sticky() ? " checked" : "") + "> Sticky (keep menu open across pages + scroll while open)</label>" +
      '<div class="tdf-pins-head">Pinned links (shown under the header)</div>' +
      '<div class="tdf-pins-list"></div>';
```

- [ ] **Step 4: Rebuild the list every time the panel opens.** Replace:

```js
  function toggleSettings() {
    buildSettings();
    var d = document.getElementById("tdf-settings");
    if (d) d.classList.toggle("tdf-hidden");
  }
```

with:

```js
  function toggleSettings() {
    buildSettings();
    var d = document.getElementById("tdf-settings");
    if (!d) return;
    d.classList.toggle("tdf-hidden");
    if (!d.classList.contains("tdf-hidden")) fillPinList(d);   // fresh from the menu each time it opens
  }
  // The cog panel's "Pinned links" list: every link in the menu with a tick box,
  // rebuilt from the menu each time the panel opens, so new or renamed rows show up.
  function fillPinList(d) {
    var box = d.querySelector(".tdf-pins-list");
    if (!box) return;
    var links = menuLinks(), pins = loadPins();
    box.textContent = "";
    if (!links.length) {
      var none = document.createElement("div");
      none.className = "tdf-pins-none";
      none.textContent = "No menu links found yet. Open the menu once, then reopen this panel.";
      box.appendChild(none);
      return;
    }
    links.forEach(function (l) {
      var label = document.createElement("label");
      var cb = document.createElement("input");
      cb.type = "checkbox";
      cb.setAttribute("data-key", l.key);
      cb.checked = pins.indexOf(l.key) !== -1;
      cb.addEventListener("change", function () { setPinned(l.key, cb.checked); });
      label.appendChild(cb);
      label.appendChild(iconClone(l));
      label.appendChild(document.createTextNode(l.name));
      box.appendChild(label);
    });
  }
  // A fresh tick goes to the end of the list: pins show in the order they were ticked.
  function setPinned(key, on) {
    var pins = loadPins().filter(function (k) { return k !== key; });
    if (on) pins.push(key);
    savePins(pins);
    renderPins();
  }
```

- [ ] **Step 5: Style the section.** Replace:

```js
    'html.tdf-iconsonly #tdf-pins .tdf-pin-name{display:none;}';
```

with:

```js
    'html.tdf-iconsonly #tdf-pins .tdf-pin-name{display:none;}' +
    // The cog panel's pin list scrolls inside the panel once it outgrows half the screen.
    '#tdf-settings .tdf-pins-head{margin:8px 0 2px;padding-top:8px;border-top:1px solid #2e333d;font-weight:700;color:#f3f4f6;}' +
    '#tdf-settings .tdf-pins-list{max-height:50vh;overflow-y:auto;}' +
    '#tdf-settings .tdf-pins-list label{padding:4px 0;}' +
    '#tdf-settings .tdf-pins-none{color:#8a8f98;padding:4px 0;}';
```

- [ ] **Step 6: Run the tests and watch them pass**

Run: `cd /opt/warboard/server && node --test torn-dual-flyout-private.test.mjs && TDF_SRC=$PWD/public/scripts/torn-dual-flyout-private.user.js node --test torn-dual-flyout-edge.test.mjs torn-dual-flyout-icons.test.mjs`
Expected: PASS 22/22, then PASS 8/8.

- [ ] **Step 7: Commit** with message `torn-dual-flyout-private: pick pinned links in the cog panel`.

---

### Task 4: Live updates, and the spacer

**Files:** modify the private `.user.js` (the Pinned links section, `renderPins`, and the init/tick hooks). Add tests.

**Interfaces:**
- Consumes: `renderPins` and `panel()`.
- Produces: `schedulePins()`, `startPinsObserver()`, `syncSpacer(row | null)`, and DOM `#tdf-pins-spacer`, the first child of `.content-wrapper[role="main"]` with `style="height:Npx"`.

- [ ] **Step 1: Write the failing tests**

```js
test('a pin follows the menu live: a new count and the attention tint reach the row', () => {
  const p = load({ stored: ['/messages.php', '/gym.php'] });
  p.tick();
  const msg = p.document.getElementById('nav-messages');
  msg.setAttribute('aria-label', 'Messages, 2 new');
  msg.insertAdjacentHTML('beforeend', '<span class="amount___vyASa">2</span>');
  p.document.getElementById('nav-gym').classList.add('attention___DT8nN');
  p.mutate();   // Torn re-drew the menu; no timer tick yet
  const [m, g] = p.pins();
  assert.equal(m.querySelector('.tdf-pin-badge').textContent, '2');
  assert.match(g.className, /tdf-pin-attn/);
});

// The spacer measures the page: give #sidebar, the content and the row the sizes a phone would.
function layout(p, { sidebarBottom, contentTop, rowHeight }) {
  p.document.getElementById('sidebar').getBoundingClientRect = () => ({ top: 36, bottom: sidebarBottom });
  p.document.querySelector('.content-wrapper').getBoundingClientRect = () => ({ top: contentTop, bottom: contentTop + 500 });
  Object.defineProperty(p.document.getElementById('tdf-pins'), 'offsetHeight', { value: rowHeight, configurable: true });
}

test('when the page content stays put under the row, a spacer of the row\'s height makes room', () => {
  const p = load({ stored: ['/gym.php'] });
  p.tick();
  layout(p, { sidebarBottom: 136, contentTop: 96, rowHeight: 40 });   // the strip ended at 96 before the row
  p.tick();
  const sp = p.document.getElementById('tdf-pins-spacer');
  assert.ok(sp, 'spacer added');
  assert.equal(sp.parentNode.className, 'content-wrapper');
  assert.equal(sp.parentNode.firstChild, sp);
  assert.equal(sp.getAttribute('style'), 'height:40px');
});

test('when the page content moves down for the row by itself, no spacer is added', () => {
  const p = load({ stored: ['/gym.php'] });
  p.tick();
  layout(p, { sidebarBottom: 136, contentTop: 136, rowHeight: 40 });
  p.tick();
  assert.equal(p.document.getElementById('tdf-pins-spacer'), null);
});

test('the spacer never grows past the row\'s own height', () => {
  const p = load({ stored: ['/gym.php'] });
  p.tick();
  layout(p, { sidebarBottom: 400, contentTop: 96, rowHeight: 40 });
  p.tick();
  assert.equal(p.document.getElementById('tdf-pins-spacer').getAttribute('style'), 'height:40px');
});

test('unpinning the last link takes the spacer away with the row', () => {
  const p = load({ stored: ['/gym.php'] });
  p.tick();
  layout(p, { sidebarBottom: 136, contentTop: 96, rowHeight: 40 });
  p.tick();
  p.openCog();
  p.tickBox('/gym.php', false);
  assert.equal(p.document.getElementById('tdf-pins'), null);
  assert.equal(p.document.getElementById('tdf-pins-spacer'), null);
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `cd /opt/warboard/server && node --test torn-dual-flyout-private.test.mjs`
Expected: FAIL on the 5 new tests. The live test's badge is still '' (or missing) because nothing watches the menu, and there is no `#tdf-pins-spacer`.

- [ ] **Step 3: Add the observer and the spacer.** Insert this directly before the line `  // Draw (or re-draw) the row directly above Torn's name/bars strip, the first thing`:

```js
  // Torn re-draws the menu as counts change: follow it within a beat, one re-draw per
  // burst of changes. The row lives outside the panel, so drawing it never feeds back here.
  var pinsTimer = null;
  function schedulePins() {
    if (pinsTimer) return;
    pinsTimer = setTimeout(function () { pinsTimer = null; renderPins(); }, 60);
  }
  function startPinsObserver() {
    var p = panel();
    if (!p || p.__tdfPinsObs) return;
    p.__tdfPinsObs = true;
    new MutationObserver(schedulePins).observe(p, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ["class", "aria-label"] });
  }
  // Measured, not assumed. TornTools pads the page content for its own phone links,
  // which suggests the content does not move down for anything added up here. If it
  // does not, a spacer at the top of the content makes up the difference, never more
  // than the row's own height; if it does, the measured overlap is 0 and no spacer is
  // added. The spacer is a height, not a margin, so it cannot collapse through.
  function syncSpacer(row) {
    var sp = document.getElementById("tdf-pins-spacer");
    var content = document.querySelector('.content-wrapper[role="main"]');
    var sb = document.getElementById("sidebar");
    var need = 0;
    if (row && content && sb && typeof sb.getBoundingClientRect === "function" && typeof content.getBoundingClientRect === "function") {
      need = Math.min(row.offsetHeight || 0, sb.getBoundingClientRect().bottom - content.getBoundingClientRect().top);
    }
    if (!(need >= 1)) { if (sp) sp.remove(); return; }
    if (!sp) { sp = document.createElement("div"); sp.id = "tdf-pins-spacer"; }
    if (content.firstChild !== sp) content.insertBefore(sp, content.firstChild);
    sp.setAttribute("style", "height:" + Math.round(need) + "px");
  }
```

- [ ] **Step 4: Call the spacer from `renderPins`.** Replace:

```js
    if (!strip || !shown.length) {
      if (row) row.remove();
      return;
    }
```

with:

```js
    if (!strip || !shown.length) {
      if (row) row.remove();
      syncSpacer(null);
      return;
    }
```

Then replace:

```js
      shown.forEach(function (l) { row.appendChild(pinEl(l)); });
    }
  }
```

with:

```js
      shown.forEach(function (l) { row.appendChild(pinEl(l)); });
    }
    syncSpacer(row);
  }
```

- [ ] **Step 5: Start the observer at init and on each tick.** Replace:

```js
  setInterval(function () { ensureCog(); startMenuObserver(); syncMenuOpen(); renderPins(); }, 800);
  ensureCog();
  startMenuObserver();
  renderPins();
```

with:

```js
  setInterval(function () { ensureCog(); startMenuObserver(); syncMenuOpen(); startPinsObserver(); renderPins(); }, 800);
  ensureCog();
  startMenuObserver();
  startPinsObserver();
  renderPins();
```

- [ ] **Step 6: Run the tests and watch them pass**

Run: `cd /opt/warboard/server && node --test torn-dual-flyout-private.test.mjs && TDF_SRC=$PWD/public/scripts/torn-dual-flyout-private.user.js node --test torn-dual-flyout-edge.test.mjs torn-dual-flyout-icons.test.mjs`
Expected: PASS 27/27, then PASS 8/8.

- [ ] **Step 7: Commit** with message `torn-dual-flyout-private: pins follow the menu live; spacer when the page would slide under`.

---

### Task 5: Ship

**Files:** none new. This task covers ownership, verification and the push.

- [ ] **Step 1: Set ownership like the other served scripts**

Run: `chown warboard:warboard /opt/warboard/server/public/scripts/torn-dual-flyout-private.user.js /opt/warboard/server/public/scripts/torn-dual-flyout-private.meta.js && chmod 644 /opt/warboard/server/public/scripts/torn-dual-flyout-private.*`
Expected: `ls -l` shows `-rw-r--r-- warboard warboard` for both.

- [ ] **Step 2: Run the full suite and check the public script is untouched**

Run: `cd /opt/warboard/server && node --test > /tmp/claude-0/-root/47c424fc-f532-4851-8c7f-7c18d084306c/scratchpad/pins/suite.log 2>&1; tail -8 /tmp/claude-0/-root/47c424fc-f532-4851-8c7f-7c18d084306c/scratchpad/pins/suite.log; cd /opt/warboard && git diff --quiet HEAD -- server/public/scripts/torn-dual-flyout.user.js && echo public-unchanged`
Expected: `fail 0` (the earlier baseline was 1806 tests with 2 skipped, plus 27 new ones), and `public-unchanged`.

- [ ] **Step 3: Check the served copies**

Run: `curl -s "https://tornwar.com/scripts/torn-dual-flyout-private.user.js?v=1.6.0" | cmp - /opt/warboard/server/public/scripts/torn-dual-flyout-private.user.js && curl -s "https://tornwar.com/scripts/torn-dual-flyout-private.meta.js?v=1.6.0" | grep '@version'`
Expected: no `cmp` output, then `// @version      1.6.0`.

- [ ] **Step 4: Final whole-branch review** (fresh reviewer, Opus) over `22f3d909..HEAD`. Then do one fix pass for Critical and Important findings, each test-first.

- [ ] **Step 5: Push**

Run: `cd /opt/warboard && git push origin main`
Expected: main and origin/main are in sync.
