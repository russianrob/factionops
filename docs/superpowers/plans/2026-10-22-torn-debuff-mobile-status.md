# Torn Debuff Mobile Status Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A new userscript that shows your own five +/-% numbers and your effect icons, with the seconds left, in a row at the top of the enemy's window on Torn's phone attack page.

**Architecture:**
- One single-file userscript, running in the page world.
- It finds Torn's Redux store through React's fiber on the players' box and subscribes to it.
- It paints one absolutely positioned row into the enemy window's layer stack. It repaints at most once per frame, and only when something the row shows has changed.
- A MutationObserver on `#attack-root` puts the row back when Torn rebuilds the window.
- A one-second timer counts the seconds down between Torn's 4-second refreshes.

**Tech Stack:** plain ES2020 userscript (Tampermonkey and Torn PDA); node:test and linkedom for tests. The warboard Express server serves the files as static files from `server/public/scripts/`.

**Spec:** `docs/superpowers/specs/2026-10-22-torn-debuff-mobile-status-design.md`

## Global Constraints

All paths are relative to the repo root `/opt/warboard`. Run tests from `/opt/warboard/server`.

**Files and header**
- Files: `server/public/scripts/torn-debuff-mobile-status.user.js` and `server/public/scripts/torn-debuff-mobile-status.meta.js`, version 1.0.0. Tests: `server/torn-debuff-mobile-status.test.mjs`.
- Header:
  - `@name Torn Debuff Mobile Status`, `@namespace RussianRob`, `@author RussianRob`, `@version 1.0.0`, `@license All Rights Reserved`, no `@copyright`;
  - `@match https://www.torn.com/page.php?sid=attack*` and `https://www.torn.com/loader.php?sid=attack*`;
  - `@run-at document-idle`, `@grant none`;
  - `@downloadURL https://tornwar.com/scripts/torn-debuff-mobile-status.user.js`, `@updateURL https://tornwar.com/scripts/torn-debuff-mobile-status.meta.js`.
- The `.meta.js` is the header block, byte for byte, plus a final newline.
- A `// CHANGELOG` block in the format of `server/public/scripts/torn-faction-offline-highlight.user.js`, with the 1.0.0 entry.

**Script rules**
- No API key, no network requests, no saved settings, no Greasemonkey API calls.
- ASCII-only source. The infinity sign is written as the escape `\u221e`, never the character itself.
- Ids are `tdms-row` and `tdms-style`. Every class starts with `tdms-`.
- The row is `position:absolute; top:4px; left:4px; right:4px; z-index:20; pointer-events:none`. Everything else about its look is exactly Task 1's CSS (the owner approved it from a live mock-up).
- The script never throws into Torn's page. An error never reaches Torn's dispatch.
- Write explanatory `//` comments; the owner wants them.

**Repo and box**
- The repo is public (factionops.git). Commit no secrets and no Torn CSS or bundles.
- Stage only this plan's paths. Other people's changes sit in the working tree: `server/data/rwp-prices.json`, `server/public/river9-watch.txt`, and deletions under `server/public/s/`.
- Never print git remotes or git config in `/opt/warboard`: the remote URL holds a token. Mask push output with `sed -E 's#//[^@]*@#//***@#g'`.
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- The box is shared and live. Run the full test suite once, in Task 5, with nothing else heavy running.

## Review Focus

1. **Turning the phone.** Torn swaps to two windows and back. The row hides, then comes back without a reload. Tested in Task 2.
2. **An unexpected shape in Torn's data during a dispatch.** The error must never reach Torn's dispatch, because Redux would then skip Torn's own listeners. Tested in Task 2.
3. **Torn's data missing for one refresh mid-fight**, with your stats absent. The row goes, then comes back on the next refresh, with no error. Tested in Task 2.
4. **Back from the background**, where phones pause timers and frames. The seconds are right at once, counted from when Torn's numbers arrived. Tested in Task 4.
5. **Starting before Torn's attack app has rendered**, which can happen because PDA can inject early. The script waits, then attaches when the fight box appears. Tested in Task 1.

---

## File map

| File | What it is |
|---|---|
| `server/public/scripts/torn-debuff-mobile-status.user.js` | The whole script, served as is. The folder is public, so the file is live the moment it is written. Nobody links to it until Task 5. |
| `server/public/scripts/torn-debuff-mobile-status.meta.js` | The header only. Tampermonkey's update check reads it. |
| `server/torn-debuff-mobile-status.test.mjs` | The tests. They load the real script into a hand-built attack page, with fake timers, frames, clock and MutationObserver. |

Tasks 1 to 4 build the script up. Each later task names the functions it replaces or adds, and says where they go.

---

### Task 1: The numbers line

Your five numbers in a row at the top of the enemy's window, shown only on the phone layout while the enemy's window is up. This task also adds the header, the meta file and start-up.

**Files:**
- Create: `server/torn-debuff-mobile-status.test.mjs`
- Create: `server/public/scripts/torn-debuff-mobile-status.user.js`
- Create: `server/public/scripts/torn-debuff-mobile-status.meta.js`

**Interfaces:**
- Consumes: nothing.
- Produces, inside the script's closure (later tasks edit these):
  - `findStore()` returns `{box, store}`; either can be null.
  - `readView()` returns `{win, stats: [{label, value}]}`, or `null` when the row shouldn't show.
  - `report(err)`, `ensureStyle()`, `el(tag, cls, text)`, `buildRow()`, `drawStats(line, stats)`, `paint()`, `schedule()`, `attach(store)`, `tryAttach()`.
  - Variables `store`, `row`, `pending`, `reported`.
- Produces in the test file, used by every later task:
  - Constants `ME`, `ENEMY`, `MODS`, `NUMBERS`, `WINDOW`.
  - `fx(over)` builds one effect.
  - `state({layout, mods, mine, theirs, effects})` builds the store state.
  - `makeStore(initial)` returns `{current, listeners, getState(), subscribe(fn), set(next)}`.
  - `attackApp(windows)` returns the attack app's HTML.
  - `hangStore(box, store, depth)` hangs a store off the players' box.
  - `load({windows, store, win})` returns the page handle:
    - fields `{document, store, clock, timers, frames, observers, logs}`;
    - methods `flush()`, `run()`, `row()`, `layers()`, `advance(ms)`, `mutate(records)`, `numbers()` and `tiles()`.

- [ ] **Step 1: Write the failing tests**

Create `server/torn-debuff-mobile-status.test.mjs`:

```js
// Torn Debuff Mobile Status: your own +/-% and effect icons in a row at the top of the
// enemy's window on Torn's phone attack page. The phone layout shows one player window at a
// time, and while the enemy's is up (where you fight from) yours isn't on the page at all.
// Spec: docs/superpowers/specs/2026-10-22-torn-debuff-mobile-status-design.md
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseHTML } from 'linkedom';

// TDMS_SRC lets a working copy be tested before it is installed over the served file.
const SRC = process.env.TDMS_SRC || '/opt/warboard/server/public/scripts/torn-debuff-mobile-status.user.js';
const META = SRC.replace(/\.user\.js$/, '.meta.js');
const ME = 137558;       // you: always the attacker on the attack page
const ENEMY = 2862329;

// Your numbers from the 2026-10-21 probes, with speed cut by a smoke.
const MODS = {
  strength: { value: 35 }, speed: { value: -66 }, dexterity: { value: 49 },
  defense: { value: 0 }, damage: { value: 12 },
};
const NUMBERS = ['+35%str', '-66%spd', '+49%dex', '+0%def', '+12%dmg'];

// An effect as Torn's attackData sends it (the Smoked from the 2026-10-21 probe, trimmed).
const fx = (over = {}) => ({
  ID: 69590765, effectID: 103, type: 2, title: 'Smoked', class: 'smoked', timeLeft: 103,
  desc: 'Speed reduced to 1/3rd', iconColor: 'red', renderMode: 'both', level: null, ...over,
});

// The parts of Torn's store state the script reads. `effects` replaces the whole
// currentTemporaryEffects map; `mine` and `theirs` fill it per player.
function state({ layout = 'attacker', mods = MODS, mine = [], theirs = [], effects } = {}) {
  return {
    attack: {
      attackerUser: { userID: ME, playername: 'RussianRob', statsModifiers: mods },
      defenderUser: { userID: ENEMY, playername: 'Winguem', statsModifiers: {} },
      currentTemporaryEffects: effects !== undefined ? effects : { [ME]: mine, [ENEMY]: theirs },
      attackStatus: 'started',
    },
    activePlayerLayout: { activePlayerLayout: layout },
  };
}

// Redux, cut down to what the script uses. set() swaps the state and calls every listener,
// as a dispatch does.
function makeStore(initial) {
  const listeners = [];
  return {
    current: initial,
    listeners,
    getState() { return this.current; },
    subscribe(fn) { listeners.push(fn); return () => {}; },
    set(next) { this.current = next; for (const fn of listeners) fn(); },
  };
}

// One player window, cut down to the layer stack the row goes into.
const WINDOW = '<div class="playerWindow___sDs7q"><div class="allLayers___YiEsY">'
  + '<div class="iconsContainer___hMap6"></div><div class="indicatorsContainer___WMBZz"></div>'
  + '</div></div>';

// Torn's attack app: both headers, your weapons, then `windows` player windows (1 on a
// phone, 2 on desktop and wide tablets).
function attackApp(windows) {
  return '<div class="coreWrap___DQKJH"><div class="playersModelWrap___NN4ZZ">'
    + '<div class="headerWrapper___AYAi6 green___t_F4D"></div>'
    + '<div class="headerWrapper___AYAi6 rose___ieKDL"></div>'
    + '<div class="playerArea___wkSjF"><div class="weaponList___OS_3o"></div>'
    + WINDOW.repeat(windows) + '</div></div></div>';
}

// React keeps the store on the Provider's props, a few fibers above the players' box.
function hangStore(box, store, depth = 3) {
  let fiber = { memoizedProps: { store }, return: null };
  for (let i = 0; i < depth; i++) fiber = { memoizedProps: { children: {} }, return: fiber };
  box.__reactFiber$tdmstest = fiber;
}

// Runs the real script on a hand-built attack page, with a fake clock, fake timers, frames
// that run only when the test flushes them, and a MutationObserver the test fires by hand.
//   windows: player windows on the page; 0 means Torn's attack app hasn't rendered yet
//   store:   hung off the players' box; leave it out for a page where Torn changed its code
//   win:     the window object, so the script can be run twice on the same one
function load({ windows = 1, store, win = {} } = {}) {
  const { document } = parseHTML('<!doctype html><html><head></head><body><div id="attack-root">'
    + (windows ? attackApp(windows) : '') + '</div></body></html>');
  if (store && windows) hangStore(document.querySelector('[class*="playersModelWrap___"]'), store);
  const clock = { now: 1_800_000_000_000 };
  const timers = new Map();
  let nextId = 1;
  const frames = [];
  const observers = [];
  const logs = [];
  class FakeObserver {
    constructor(fn) { this.fn = fn; observers.push(this); }
    observe(target, options) { this.target = target; this.options = options; }
    disconnect() {}
  }
  const run = () => new Function('window', 'document', 'setInterval', 'clearInterval',
    'requestAnimationFrame', 'MutationObserver', 'console', 'Date', readFileSync(SRC, 'utf8'))(
    win, document,
    (fn, ms) => { const id = nextId++; timers.set(id, { fn, ms, due: clock.now + ms }); return id; },
    (id) => { timers.delete(id); },
    (fn) => { frames.push(fn); return frames.length; },
    FakeObserver,
    { info: (...a) => logs.push(a.join(' ')), log() {}, warn() {}, error() {} },
    { now: () => clock.now });
  const flush = () => { while (frames.length) frames.shift()(); };
  run();
  flush();
  return {
    document, store, clock, timers, frames, observers, logs, flush, run,
    row: () => document.getElementById('tdms-row'),
    // The layer stack of the first player window: where the row belongs.
    layers: () => document.querySelector('[class*="playerWindow___"] [class*="allLayers___"]'),
    // Lets `ms` pass in 100 ms steps, running each timer that falls due, then the frames.
    advance(ms) {
      for (let t = 0; t < ms; t += 100) {
        clock.now += 100;
        for (const [id, tm] of [...timers]) {
          if (timers.has(id) && clock.now >= tm.due) { tm.due += tm.ms; tm.fn(); }
        }
        flush();
      }
    },
    // Fires the script's MutationObserver with these records, as the page would.
    mutate(records) {
      assert.equal(observers.length, 1, 'the script watches the attack app');
      observers[0].fn(records.map((r) => ({ addedNodes: [], removedNodes: [], ...r })));
    },
    // The numbers line, cell by cell: "+35%str".
    numbers: () => [...document.querySelectorAll('#tdms-row .tdms-stat')].map((c) => c.textContent),
    // The icons line's tiles: icon file, seconds shown, border colour.
    tiles: () => [...document.querySelectorAll('#tdms-row .tdms-icon')].map((t) => ({
      src: t.querySelector('img').getAttribute('src'),
      secs: t.lastChild.textContent,
      border: t.style.borderColor,
    })),
  };
}

test('the header: the attack page only, the page world, and updates from the meta file', () => {
  const src = readFileSync(SRC, 'utf8');
  const end = '// ==/UserScript==';
  const header = src.slice(0, src.indexOf(end) + end.length);
  const tag = (k) => [...header.matchAll(new RegExp('^// @' + k + '\\s+(.+)$', 'gm'))].map((m) => m[1].trim());
  assert.ok(header.startsWith('// ==UserScript=='));
  assert.deepEqual(tag('name'), ['Torn Debuff Mobile Status']);
  assert.deepEqual(tag('namespace'), ['RussianRob']);
  assert.deepEqual(tag('author'), ['RussianRob']);
  assert.deepEqual(tag('version'), ['1.0.0']);
  assert.deepEqual(tag('license'), ['All Rights Reserved']);
  assert.deepEqual(tag('copyright'), []);
  assert.deepEqual(tag('match'), ['https://www.torn.com/page.php?sid=attack*', 'https://www.torn.com/loader.php?sid=attack*']);
  assert.deepEqual(tag('run-at'), ['document-idle']);
  assert.deepEqual(tag('grant'), ['none']);
  assert.deepEqual(tag('downloadURL'), ['https://tornwar.com/scripts/torn-debuff-mobile-status.user.js']);
  assert.deepEqual(tag('updateURL'), ['https://tornwar.com/scripts/torn-debuff-mobile-status.meta.js']);
  assert.equal(readFileSync(META, 'utf8'), header + '\n', 'the meta file is the header, byte for byte');
  assert.match(src, /^\/\/ CHANGELOG$/m);
  assert.match(src, /^\/\/ v1\.0\.0  - /m, 'the changelog has the 1.0.0 entry');
});

test('the source is plain ASCII, needs no API key and makes no requests', () => {
  const src = readFileSync(SRC, 'utf8');
  assert.doesNotMatch(src, /[^\x00-\x7F]/, 'PDA breaks curly quotes, so nothing outside ASCII');
  assert.doesNotMatch(src, /\bGM_|\bGM\.|fetch\(|XMLHttpRequest|localStorage|api\.torn\.com/);
});

test('your five numbers show at the top of the enemy\'s window, in Torn\'s order', () => {
  const page = load({ store: makeStore(state()) });
  assert.equal(page.row().parentNode, page.layers(), 'in the window\'s layer stack');
  assert.equal(page.document.querySelector('#tdms-row .tdms-stats').firstChild.textContent, 'YOU');
  assert.deepEqual(page.numbers(), NUMBERS);
});

test('a number is green above 0, red below 0 and plain at 0', () => {
  const page = load({ store: makeStore(state()) });
  const classes = [...page.document.querySelectorAll('#tdms-row .tdms-stat')].map((c) => c.className);
  assert.deepEqual(classes, ['tdms-stat tdms-up', 'tdms-stat tdms-down', 'tdms-stat tdms-up', 'tdms-stat', 'tdms-stat tdms-up']);
  const css = page.document.getElementById('tdms-style').textContent;
  assert.match(css, /\.tdms-up b\{color:#8fd16a\}/);
  assert.match(css, /\.tdms-down b\{color:#ff6b5e\}/);
});

test('a stat Torn leaves out counts as 0', () => {
  const { damage, ...noDamage } = MODS;
  const page = load({ store: makeStore(state({ mods: noDamage })) });
  assert.equal(page.numbers()[4], '+0%dmg');
});

test('without your numbers there is no row', () => {
  for (const mods of [null, {}, { strength: {} }]) {
    const page = load({ store: makeStore(state({ mods })) });
    assert.equal(page.row(), null, JSON.stringify(mods));
  }
  const page = load({ store: makeStore({ attack: {}, activePlayerLayout: { activePlayerLayout: 'attacker' } }) });
  assert.equal(page.row(), null, 'no attacker at all');
});

test('with your own window up (layout "defender") there is no row', () => {
  const page = load({ store: makeStore(state({ layout: 'defender' })) });
  assert.equal(page.row(), null);
});

test('with both windows on the page (desktop, wide tablet) there is no row', () => {
  const page = load({ windows: 2, store: makeStore(state()) });
  assert.equal(page.row(), null);
});

test('taps go through the row, and it sits above the window\'s own layers', () => {
  const page = load({ store: makeStore(state()) });
  const rule = page.document.getElementById('tdms-style').textContent.match(/#tdms-row\{([^}]*)\}/)[1];
  for (const d of ['position:absolute', 'top:4px', 'left:4px', 'right:4px', 'z-index:20', 'pointer-events:none']) {
    assert.ok(rule.split(';').includes(d), d);
  }
});

test('with no fight data on the page it draws nothing, and says so once after 10 seconds', () => {
  const page = load({ store: null });
  page.advance(9000);
  assert.equal(page.logs.length, 0);
  page.advance(1500);
  assert.equal(page.row(), null);
  assert.equal(page.logs.length, 1);
  assert.match(page.logs[0], /^\[Torn Debuff Mobile Status\] /);
  assert.equal(page.timers.size, 0, 'it stops looking');
});

test('a store that turns up a moment later is picked up', () => {
  const page = load({ store: null });
  hangStore(page.document.querySelector('[class*="playersModelWrap___"]'), makeStore(state()));
  page.advance(500);
  assert.deepEqual(page.numbers(), NUMBERS);
  assert.equal(page.timers.size, 0, 'it stops looking once it has the store');
});

test('started before Torn\'s attack app has rendered, it waits for it', () => {
  const page = load({ windows: 0, store: null });
  page.advance(30000);
  assert.equal(page.logs.length, 0, 'no fight box yet is not an error');
  page.document.getElementById('attack-root').innerHTML = attackApp(1);
  hangStore(page.document.querySelector('[class*="playersModelWrap___"]'), makeStore(state()));
  page.advance(500);
  assert.equal(page.row().parentNode, page.layers());
});

test('loaded twice on the same page, it runs once', () => {
  const page = load({ store: makeStore(state()) });
  page.run();
  page.flush();
  assert.equal(page.document.querySelectorAll('#tdms-row').length, 1);
  assert.equal(page.document.querySelectorAll('#tdms-style').length, 1);
});
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `cd /opt/warboard/server && node --test torn-debuff-mobile-status.test.mjs`
Expected: `# tests 13`, `# fail 13`, each with `ENOENT: no such file or directory, open '/opt/warboard/server/public/scripts/torn-debuff-mobile-status.user.js'`.

- [ ] **Step 3: Write the script and its meta file**

Create `server/public/scripts/torn-debuff-mobile-status.user.js`:

```js
// ==UserScript==
// @name         Torn Debuff Mobile Status
// @namespace    RussianRob
// @version      1.0.0
// @description  On Torn's phone attack page, shows your own +/-% stats and your effects (debuffs and boosts, with seconds left) in a row at the top of the enemy's window, so you can see them without leaving your weapons.
// @author       RussianRob
// @downloadURL  https://tornwar.com/scripts/torn-debuff-mobile-status.user.js
// @updateURL    https://tornwar.com/scripts/torn-debuff-mobile-status.meta.js
// @license      All Rights Reserved
// @match        https://www.torn.com/page.php?sid=attack*
// @match        https://www.torn.com/loader.php?sid=attack*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

// =============================================================================
// CHANGELOG
// =============================================================================
// v1.0.0  - First release. On the phone layout of the attack page, a row at the
//           top of the enemy's window shows your five +/-% and your effect icons
//           with the seconds left, so your own debuffs stay in view while you fight.

(function () {
  'use strict';

  // PDA can inject a script more than once; one copy is enough.
  if (window.__tdmsLoaded) return;
  window.__tdmsLoaded = true;

  const ROW_ID = 'tdms-row';
  const STYLE_ID = 'tdms-style';
  // Torn's strip order, with the short labels the row uses.
  const STATS = [['strength', 'str'], ['speed', 'spd'], ['dexterity', 'dex'], ['defense', 'def'], ['damage', 'dmg']];
  // The look the owner approved from the live mock-up (layout B). The row sits over the top
  // of the enemy's window, above Torn's own layers, and taps go straight through it.
  const CSS = [
    '#tdms-row{position:absolute;top:4px;left:4px;right:4px;z-index:20;pointer-events:none;font:11px/1.1 Arial,Helvetica,sans-serif;color:#fff}',
    '#tdms-row .tdms-stats{display:flex;align-items:stretch;gap:2px;background:rgba(0,0,0,.62);border:1px solid #6fae3f;border-radius:5px;padding:2px}',
    '#tdms-row .tdms-you{display:flex;align-items:center;padding:0 4px;background:#6fae3f;font-weight:bold;font-size:9px;border-radius:3px;letter-spacing:.5px}',
    '#tdms-row .tdms-stat{flex:1 1 0;min-width:0;display:flex;flex-direction:column;align-items:center;justify-content:center}',
    '#tdms-row .tdms-stat b{font-size:12px}',
    '#tdms-row .tdms-stat i{font-style:normal;font-size:8px;opacity:.8}',
    '#tdms-row .tdms-up b{color:#8fd16a}',
    '#tdms-row .tdms-down b{color:#ff6b5e}',
    '#tdms-row .tdms-icons{display:flex;flex-wrap:wrap;align-items:center;gap:4px;margin-top:4px}',
    '#tdms-row .tdms-icons[hidden]{display:none}',
    '#tdms-row .tdms-icon{width:34px;display:flex;flex-direction:column;align-items:center;background:rgba(0,0,0,.62);border:1px solid #888;border-radius:5px;padding:2px 0}',
    '#tdms-row .tdms-icon img{width:26px;height:26px}',
    '#tdms-row .tdms-icon i{font-style:normal;font-size:10px}',
  ].join('\n');

  let store = null;      // Torn's Redux store, once found
  let row = null;        // the row, built once and moved into whichever window Torn renders
  let pending = false;   // a repaint is booked for the next frame
  let reported = false;  // the first error has been logged

  // Torn keeps the fight in a Redux store, on the props of a React fiber a few levels above
  // the players' box. Returns the box and the store; either can be null.
  function findStore() {
    const box = document.querySelector('[class*="playersModelWrap___"]');
    if (!box) return { box: null, store: null };
    const key = Object.keys(box).find((k) => k.startsWith('__reactFiber$'));
    for (let f = key ? box[key] : null, i = 0; f && i < 40; i++, f = f.return) {
      const p = f.memoizedProps;
      if (p && p.store && typeof p.store.getState === 'function' && typeof p.store.subscribe === 'function') {
        return { box, store: p.store };
      }
    }
    return { box, store: null };
  }

  // What the row draws, or null when it shouldn't show. It shows on Torn's phone layout (one
  // player window on the page) while the enemy's window is up: layout "attacker", Torn's
  // default. Tapping your own header switches the layout to "defender" and Torn shows your
  // own window, strip and all, so the row isn't needed then. You are always the attacker on
  // this page, and your numbers are the ones Torn's strip shows in your own window.
  function readView() {
    const state = store.getState() || {};
    const attack = state.attack || {};
    const me = attack.attackerUser;
    const mods = me && me.statsModifiers;
    if (!mods || !STATS.some(([k]) => mods[k] && typeof mods[k].value === 'number')) return null;
    const layout = state.activePlayerLayout && state.activePlayerLayout.activePlayerLayout;
    if (layout !== 'attacker') return null;
    const windows = (document.getElementById('attack-root') || document).querySelectorAll('[class*="playerWindow___"]');
    if (windows.length !== 1) return null;
    return {
      win: windows[0],
      stats: STATS.map(([k, label]) => ({ label, value: mods[k] && typeof mods[k].value === 'number' ? mods[k].value : 0 })),
    };
  }

  // Logs the first error only, so a change on Torn's side shows up without flooding the console.
  function report(err) {
    if (reported) return;
    reported = true;
    console.info('[Torn Debuff Mobile Status] ' + (err && err.message ? err.message : String(err)));
  }

  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = CSS;
    (document.head || document.documentElement).appendChild(style);
  }

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  // The row has two lines: the numbers line, then the icons line under it.
  function buildRow() {
    const r = el('div');
    r.id = ROW_ID;
    r.appendChild(el('div', 'tdms-stats'));
    r.appendChild(el('div', 'tdms-icons'));
    return r;
  }

  // The numbers line: YOU, then the five values. Rebuilt only when a value changes.
  function drawStats(line, stats) {
    const key = stats.map((s) => s.value).join(',');
    if (line.getAttribute('data-key') === key) return;
    line.setAttribute('data-key', key);
    line.textContent = '';
    line.appendChild(el('span', 'tdms-you', 'YOU'));
    for (const s of stats) {
      const cell = el('span', 'tdms-stat' + (s.value > 0 ? ' tdms-up' : s.value < 0 ? ' tdms-down' : ''));
      cell.appendChild(el('b', '', (s.value < 0 ? '-' : '+') + Math.abs(s.value) + '%'));
      cell.appendChild(el('i', '', s.label));
      line.appendChild(cell);
    }
  }

  // Draws the row from Torn's current state, putting it into the enemy's window or taking it
  // out. Safe to run any number of times: it only touches the page where something differs.
  function paint() {
    pending = false;
    try {
      const view = readView();
      if (!view) {
        if (row && row.parentNode) row.parentNode.removeChild(row);
        return;
      }
      const host = view.win.querySelector('[class*="allLayers___"]') || view.win;
      if (!row) row = buildRow();
      if (row.parentNode !== host) host.appendChild(row);
      drawStats(row.firstChild, view.stats);
    } catch (err) {
      report(err);
    }
  }

  // One repaint per frame, however many things ask for one.
  function schedule() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(paint);
  }

  function attach(s) {
    store = s;
    ensureStyle();
    schedule();
  }

  // Torn's attack app renders after the page loads, and PDA can run this script before that,
  // so look for the players' box and its store every 500 ms. A page that shows an error
  // instead of a fight never gets a box and keeps looking, one selector lookup each time. A
  // box with no store means Torn has changed its page, so give up after 10 seconds.
  let waited = 0;
  function tryAttach() {
    const found = findStore();
    if (found.store) {
      clearInterval(finder);
      attach(found.store);
      return;
    }
    if (found.box && (waited += 500) >= 10000) {
      clearInterval(finder);
      console.info('[Torn Debuff Mobile Status] Torn\'s fight data was not found on this page, so there is nothing to show.');
    }
  }
  const finder = setInterval(tryAttach, 500);
  tryAttach();
})();
```

Then write the meta file from the header, so the two can't drift:

```bash
cd /opt/warboard/server/public/scripts && sed -n '1,/^\/\/ ==\/UserScript==$/p' torn-debuff-mobile-status.user.js > torn-debuff-mobile-status.meta.js && cat torn-debuff-mobile-status.meta.js
```

Expected: the 14 header lines, from `// ==UserScript==` to `// ==/UserScript==`.

- [ ] **Step 4: Run the tests to see them pass**

Run: `cd /opt/warboard/server && node --test torn-debuff-mobile-status.test.mjs`
Expected: `# tests 13`, `# pass 13`, `# fail 0`.

- [ ] **Step 5: Commit**

```bash
cd /opt/warboard && git add server/torn-debuff-mobile-status.test.mjs server/public/scripts/torn-debuff-mobile-status.user.js server/public/scripts/torn-debuff-mobile-status.meta.js && git commit -m "torn-debuff-mobile-status: your five +/-% at the top of the enemy's window

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Following Torn

The row follows Torn's updates. It subscribes to the store, repaints only when something it shows changed, and moves back into the window whenever Torn rebuilds it.

**Files:**
- Modify: `server/public/scripts/torn-debuff-mobile-status.user.js` (variables, `viewKey`, `paint`, `onStore`, `onMutations`, `attach`)
- Test: `server/torn-debuff-mobile-status.test.mjs` (append)

**Interfaces:**
- Consumes from Task 1: `readView()`, `report(err)`, `schedule()`, `paint()`, `row`, and the test harness.
- Produces:
  - `viewKey(view)` returns a string, or `'none'` for no view. Task 3 replaces it.
  - The variable `lastKey`.
  - `onStore()` and `onMutations(records)`.

- [ ] **Step 1: Write the failing tests**

Append to `server/torn-debuff-mobile-status.test.mjs`:

```js
test('tapping your own header hides the row, and tapping back brings it back', () => {
  const store = makeStore(state());
  const page = load({ store });
  store.set(state({ layout: 'defender' }));
  page.flush();
  assert.equal(page.row(), null);
  store.set(state({ layout: 'attacker' }));
  page.flush();
  assert.equal(page.row().parentNode, page.layers());
  assert.deepEqual(page.numbers(), NUMBERS);
});

test('new numbers from Torn show up', () => {
  const store = makeStore(state());
  const page = load({ store });
  store.set(state({ mods: { ...MODS, speed: { value: 0 } } }));
  page.flush();
  assert.equal(page.numbers()[1], '+0%spd');
});

test('it subscribes once and watches the whole attack app', () => {
  const store = makeStore(state());
  const page = load({ store });
  page.run();   // a second injection on the same page
  assert.equal(store.listeners.length, 1);
  assert.equal(page.observers.length, 1);
  assert.equal(page.observers[0].target, page.document.getElementById('attack-root'));
  assert.deepEqual(page.observers[0].options, { childList: true, subtree: true });
});

test('a dispatch repaints only when something the row shows changed', () => {
  const store = makeStore(state());
  const page = load({ store });
  const hit = state();
  hit.attack.hitsLog = { [ENEMY]: [{ attackResult: 'hit', x: 120, y: 200 }] };
  store.set(hit);
  assert.equal(page.frames.length, 0, 'a hit on the enemy changes nothing the row shows');
  store.set(state({ mods: { ...MODS, speed: { value: 0 } } }));
  assert.equal(page.frames.length, 1, 'your speed changing does');
});

test('when Torn rebuilds the window, the row moves into the new one', () => {
  const page = load({ store: makeStore(state()) });
  const area = page.document.querySelector('[class*="playerArea___"]');
  const old = area.querySelector('[class*="playerWindow___"]');
  old.remove();
  area.insertAdjacentHTML('beforeend', WINDOW);
  page.mutate([{ target: area, addedNodes: [area.lastChild], removedNodes: [old] }]);
  page.flush();
  assert.equal(page.row().parentNode, page.layers());
  assert.equal(page.document.querySelectorAll('#tdms-row').length, 1);
});

test('turning the phone (two windows, then one) hides the row and brings it back', () => {
  const page = load({ store: makeStore(state()) });
  const area = page.document.querySelector('[class*="playerArea___"]');
  area.insertAdjacentHTML('beforeend', WINDOW);
  const extra = area.lastChild;
  page.mutate([{ target: area, addedNodes: [extra] }]);
  page.flush();
  assert.equal(page.row(), null);
  extra.remove();
  page.mutate([{ target: area, removedNodes: [extra] }]);
  page.flush();
  assert.equal(page.row().parentNode, page.layers());
});

test('the row\'s own changes never set the observer off', () => {
  const page = load({ store: makeStore(state()) });
  const row = page.row();
  page.mutate([{ target: row.firstChild }]);
  page.mutate([{ target: page.layers(), addedNodes: [row] }]);
  page.mutate([{ target: page.layers(), removedNodes: [row] }]);
  assert.equal(page.frames.length, 0);
});

test('repaints never add a second row or stylesheet', () => {
  const store = makeStore(state());
  const page = load({ store });
  for (let i = 1; i <= 5; i++) {
    store.set(state({ mods: { ...MODS, strength: { value: 35 + i } } }));
    page.mutate([{ target: page.document.body }]);
    page.flush();
  }
  assert.equal(page.document.querySelectorAll('#tdms-row').length, 1);
  assert.equal(page.document.querySelectorAll('#tdms-style').length, 1);
  assert.equal(page.numbers()[0], '+40%str');
});

test('if Torn\'s data goes missing for one refresh, the row goes and then comes back', () => {
  const store = makeStore(state());
  const page = load({ store });
  store.set({ attack: { attackerUser: { userID: ME } }, activePlayerLayout: { activePlayerLayout: 'attacker' } });
  page.flush();
  assert.equal(page.row(), null);
  store.set(state());
  page.flush();
  assert.deepEqual(page.numbers(), NUMBERS);
});

test('an error in the script never reaches Torn\'s dispatch', () => {
  const store = makeStore(state());
  const page = load({ store });
  const bad = state();
  Object.defineProperty(bad.attack.attackerUser, 'statsModifiers', { get() { throw new Error('shape changed'); } });
  assert.doesNotThrow(() => store.set(bad));
  assert.doesNotThrow(() => page.flush());
  assert.equal(page.logs.length, 1, 'logged once');
});
```

- [ ] **Step 2: Run the tests to see the new ones fail**

Run: `cd /opt/warboard/server && node --test torn-debuff-mobile-status.test.mjs`
Expected: `# tests 23`, `# pass 13`, `# fail 10`.
- The store tests fail because nothing listens to the store yet: the row stays, the numbers don't change, `listeners.length` is 0, the second `frames.length` is 0, and `logs.length` is 0.
- The observer tests fail at `the script watches the attack app` (0 !== 1).

- [ ] **Step 3: Implement**

In `server/public/scripts/torn-debuff-mobile-status.user.js`:

(a) Add a line under `let reported = false;`:

```js
  let lastKey = '';      // what the row last showed, so dispatches that change none of it are skipped
```

(b) Add this function directly under `readView()`:

```js
  // Everything the row shows, as one string.
  function viewKey(view) {
    return view ? JSON.stringify(view.stats.map((s) => s.value)) : 'none';
  }
```

(c) In `paint()`, add a line under `const view = readView();`:

```js
      lastKey = viewKey(view);
```

(d) Add these two functions directly above `function attach(s)`:

```js
  // Torn's store calls back on every dispatch, hits and animations included, so repaint only
  // when something the row shows has changed. Nothing may be thrown from here: an error in a
  // Redux listener stops the dispatch, and Torn's own listeners with it.
  function onStore() {
    try {
      if (viewKey(readView()) !== lastKey) schedule();
    } catch (err) {
      report(err);
    }
  }

  // Torn rebuilds the window without the store changing (the phone turning, React remounting
  // it), and the row goes with it. Book a repaint for any change in the attack app except our
  // own: changes inside the row, or the row itself being added or removed. That way this can't
  // set itself off, and the repaint changes nothing when the row is already in place.
  function onMutations(records) {
    for (const m of records) {
      if (row && (m.target === row || row.contains(m.target))) continue;
      const nodes = [...m.addedNodes, ...m.removedNodes];
      if (nodes.length && nodes.every((n) => n === row)) continue;
      schedule();
      return;
    }
  }
```

(e) Replace `attach` with:

```js
  function attach(s) {
    store = s;
    ensureStyle();
    store.subscribe(onStore);
    const root = document.getElementById('attack-root');
    if (root) new MutationObserver(onMutations).observe(root, { childList: true, subtree: true });
    schedule();
  }
```

- [ ] **Step 4: Run the tests to see them pass**

Run: `cd /opt/warboard/server && node --test torn-debuff-mobile-status.test.mjs`
Expected: `# tests 23`, `# pass 23`, `# fail 0`.

- [ ] **Step 5: Commit**

```bash
cd /opt/warboard && git add server/torn-debuff-mobile-status.test.mjs server/public/scripts/torn-debuff-mobile-status.user.js && git commit -m "torn-debuff-mobile-status: follow Torn's store, and stay in the window Torn rebuilds

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: The icons line

Your effect icons under the numbers, debuffs and boosts alike. They are the ones Torn puts in your own window's icon column, drawn with Torn's icon images and colours. For now each shows Torn's own seconds; Task 4 adds the countdown.

**Files:**
- Modify: `server/public/scripts/torn-debuff-mobile-status.user.js` (constants, `showsAsIcon`, `iconName`, `readView`, `viewKey`, `tile`, `drawIcons`, `paint`)
- Test: `server/torn-debuff-mobile-status.test.mjs` (append)

**Interfaces:**
- Consumes from Tasks 1 and 2: `el()`, `readView()`, `viewKey()`, `paint()`, and the test harness.
- Produces:
  - `showsAsIcon(e)` returns a boolean.
  - `iconName(e)` returns a string.
  - `tile(e)` returns an element.
  - `drawIcons(line, effects)`; Task 4 replaces it.
  - `readView()` now also returns `effects: [effect]`.
  - Constants `COLORS` and `ICON_DIR`.

- [ ] **Step 1: Write the failing tests**

Append to `server/torn-debuff-mobile-status.test.mjs`:

```js
test('your effect shows Torn\'s icon, the seconds left and Torn\'s colour', () => {
  const page = load({ store: makeStore(state({ mine: [fx()] })) });
  assert.deepEqual(page.tiles(), [{ src: '/images/v2/attack/effect_icons/smoked.svg', secs: '103', border: '#e0463c' }]);
  assert.equal(page.document.querySelector('#tdms-row .tdms-icons').hidden, false);
  assert.equal(page.document.querySelector('#tdms-row .tdms-icon img').getAttribute('alt'), 'Smoked');
});

test('boosts show as well as debuffs, like a needle you used', () => {
  // No needle has been seen in Torn's data yet, so this class name is made up. A boost is an
  // effect like any other, in Torn's green.
  const boost = fx({ ID: 7, type: 1, class: 'made_up_boost', title: 'Boost', timeLeft: 120, iconColor: 'green' });
  const page = load({ store: makeStore(state({ mine: [boost] })) });
  assert.deepEqual(page.tiles(), [{ src: '/images/v2/attack/effect_icons/made_up_boost.svg', secs: '120', border: '#5cb85c' }]);
});

test('each of Torn\'s icon colours has its border, and an unknown one is grey', () => {
  const mine = ['red', 'green', 'blue', 'yellow', 'purple'].map((c, i) => fx({ ID: i + 1, class: 'c' + i, iconColor: c }));
  const page = load({ store: makeStore(state({ mine })) });
  assert.deepEqual(page.tiles().map((t) => t.border), ['#e0463c', '#5cb85c', '#3c8be0', '#e0c03c', '#888']);
});

test('only the effects Torn shows in your own window\'s icon column', () => {
  const mine = [
    fx({ ID: 1, class: 'a', type: 1 }),
    fx({ ID: 2, class: 'b', renderMode: 'iconOnly' }),
    fx({ ID: 3, class: 'c', renderMode: undefined }),          // no mode counts as both
    fx({ ID: 4, class: 'd', renderMode: 'backgroundOnly' }),   // Torn only paints it over the model
    fx({ ID: 5, class: 'e', type: 3 }),                        // a distraction: Torn's left column
    fx({ ID: 6, class: 'f', type: 4 }),                        // a perk: Torn's left column
    fx({ ID: 7, class: 'g', timeLeft: 0 }),                    // run out
    fx({ ID: 8, class: 'h', timeLeft: null }),                 // no time: Torn leaves it out
  ];
  const page = load({ store: makeStore(state({ mine })) });
  assert.deepEqual(page.tiles().map((t) => t.src.split('/').pop()), ['a.svg', 'b.svg', 'c.svg']);
});

test('hardening effects use the kinetokinesis icon, and a level goes on the name', () => {
  const mine = [
    fx({ ID: 1, class: 'hardening_left_arm' }),
    fx({ ID: 2, class: 'weakened', level: 2 }),
    fx({ ID: 3, class: 'withered', level: 0 }),
  ];
  const page = load({ store: makeStore(state({ mine })) });
  assert.deepEqual(page.tiles().map((t) => t.src.split('/').pop()), ['kinetokinesis.svg', 'weakened_2.svg', 'withered.svg']);
});

test('over 300 seconds shows the infinity sign, where Torn shows its eternity icon', () => {
  const page = load({ store: makeStore(state({ mine: [fx({ ID: 1, timeLeft: 301 }), fx({ ID: 2, timeLeft: 300 })] })) });
  assert.deepEqual(page.tiles().map((t) => t.secs), ['\u221e', '300']);
});

test('with no effects there is no icons line, and never a sample icon', () => {
  const page = load({ store: makeStore(state({ mine: [] })) });
  assert.equal(page.document.querySelector('#tdms-row .tdms-icons').hidden, true);
  assert.equal(page.document.querySelectorAll('#tdms-row img').length, 0);
});

test('the enemy\'s effects are not shown as yours', () => {
  const page = load({ store: makeStore(state({ theirs: [fx()] })) });
  assert.deepEqual(page.tiles(), []);
  assert.equal(page.document.querySelector('#tdms-row .tdms-icons').hidden, true);
});

test('with no effects map at all, the numbers still show', () => {
  for (const effects of [null, {}, { [ME]: 'not a list' }]) {
    const page = load({ store: makeStore(state({ effects })) });
    assert.deepEqual(page.numbers(), NUMBERS, JSON.stringify(effects));
    assert.equal(page.document.querySelector('#tdms-row .tdms-icons').hidden, true);
  }
});

test('two of the same effect show as two tiles, as Torn shows them', () => {
  const page = load({ store: makeStore(state({ mine: [fx({ ID: 1 }), fx({ ID: 2, timeLeft: 40 })] })) });
  assert.deepEqual(page.tiles().map((t) => t.secs), ['103', '40']);
});

test('an effect Torn adds mid-fight shows up, and one it takes away goes', () => {
  const store = makeStore(state());
  const page = load({ store });
  store.set(state({ mine: [fx()] }));
  page.flush();
  assert.equal(page.tiles().length, 1);
  store.set(state({ mine: [] }));
  page.flush();
  assert.equal(page.tiles().length, 0);
  assert.equal(page.document.querySelector('#tdms-row .tdms-icons').hidden, true);
});
```

- [ ] **Step 2: Run the tests to see the new ones fail**

Run: `cd /opt/warboard/server && node --test torn-debuff-mobile-status.test.mjs`
Expected: `# tests 34`, `# pass 23`, `# fail 11`. No tiles are drawn yet, and the icons line is never hidden.

- [ ] **Step 3: Implement**

In `server/public/scripts/torn-debuff-mobile-status.user.js`:

(a) Add these constants directly under the `STATS` line:

```js
  // Tile borders for the colours Torn gives its effect icons.
  const COLORS = { red: '#e0463c', green: '#5cb85c', blue: '#3c8be0', yellow: '#e0c03c' };
  const ICON_DIR = '/images/v2/attack/effect_icons/';
```

(b) Add these two functions directly above the comment that opens `readView()`:

```js
  // The effects Torn puts in the right-hand icon column of your own window: types 1 and 2,
  // with time left, drawn as an icon ("iconOnly" or "both"; Torn treats a missing mode as
  // "both"). Types 3 and 4 (distractions, perks) go in Torn's left column instead.
  function showsAsIcon(e) {
    if (!e || (e.type !== 1 && e.type !== 2) || !(e.timeLeft > 0)) return false;
    const mode = e.renderMode == null ? 'both' : e.renderMode;
    return mode === 'iconOnly' || mode === 'both';
  }

  // Torn draws every hardening_* effect with the kinetokinesis icon, and adds _<level> when
  // the effect has one.
  function iconName(e) {
    const base = /^hardening_/.test(e.class) ? 'kinetokinesis' : e.class;
    return e.level ? base + '_' + e.level : base;
  }
```

(c) Replace `readView()`, keeping its comment, with:

```js
  function readView() {
    const state = store.getState() || {};
    const attack = state.attack || {};
    const me = attack.attackerUser;
    const mods = me && me.statsModifiers;
    if (!mods || !STATS.some(([k]) => mods[k] && typeof mods[k].value === 'number')) return null;
    const layout = state.activePlayerLayout && state.activePlayerLayout.activePlayerLayout;
    if (layout !== 'attacker') return null;
    const windows = (document.getElementById('attack-root') || document).querySelectorAll('[class*="playerWindow___"]');
    if (windows.length !== 1) return null;
    const list = (attack.currentTemporaryEffects || {})[me.userID];
    return {
      win: windows[0],
      stats: STATS.map(([k, label]) => ({ label, value: mods[k] && typeof mods[k].value === 'number' ? mods[k].value : 0 })),
      effects: Array.isArray(list) ? list.filter(showsAsIcon) : [],
    };
  }
```

(d) Replace `viewKey` with:

```js
  // Everything the row shows, as one string.
  function viewKey(view) {
    if (!view) return 'none';
    return JSON.stringify([view.stats.map((s) => s.value),
      view.effects.map((e) => [e.ID, e.class, e.level, e.timeLeft, e.iconColor])]);
  }
```

(e) Add these two functions directly under `drawStats`:

```js
  function tile(e) {
    const t = el('span', 'tdms-icon');
    t.style.borderColor = COLORS[e.iconColor] || '#888';
    const img = el('img');
    img.alt = e.title || e.class;
    img.src = ICON_DIR + iconName(e) + '.svg';
    t.appendChild(img);
    t.appendChild(el('i', '', ''));
    return t;
  }

  // The icons line: one tile per effect, as Torn draws them, with the seconds left under each.
  // Hidden when there is nothing to show.
  function drawIcons(line, effects) {
    const tilesKey = effects.map((e) => [e.ID, iconName(e), e.iconColor].join('/')).join('|');
    if (line.getAttribute('data-key') !== tilesKey) {
      line.setAttribute('data-key', tilesKey);
      line.textContent = '';
      for (const e of effects) line.appendChild(tile(e));
    }
    effects.forEach((e, i) => {
      const text = e.timeLeft > 300 ? '\u221e' : String(e.timeLeft);
      const secs = line.children[i].lastChild;
      if (secs.textContent !== text) secs.textContent = text;
    });
    line.hidden = effects.length === 0;
  }
```

(f) In `paint()`, add a line under `drawStats(row.firstChild, view.stats);`:

```js
      drawIcons(row.lastChild, view.effects);
```

- [ ] **Step 4: Run the tests to see them pass**

Run: `cd /opt/warboard/server && node --test torn-debuff-mobile-status.test.mjs`
Expected: `# tests 34`, `# pass 34`, `# fail 0`.

- [ ] **Step 5: Commit**

```bash
cd /opt/warboard && git add server/torn-debuff-mobile-status.test.mjs server/public/scripts/torn-debuff-mobile-status.user.js && git commit -m "torn-debuff-mobile-status: your effect icons under the numbers

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: The countdown

The seconds count down every second, the way Torn counts its own icons between its 4-second refreshes. An icon goes at 0.

**Files:**
- Modify: `server/public/scripts/torn-debuff-mobile-status.user.js` (variables, `drawIcons`, `setTicking`, `paint`)
- Test: `server/torn-debuff-mobile-status.test.mjs` (append)

**Interfaces:**
- Consumes from Tasks 1 to 3: `schedule()`, `tile(e)`, `iconName(e)`, `paint()`, and the test harness.
- Produces:
  - `setTicking(on)`.
  - Variables `ticker` and `snap` (`{key, at, list}`).
  - `drawIcons(line, effects)` with the countdown.

- [ ] **Step 1: Write the failing tests**

Append to `server/torn-debuff-mobile-status.test.mjs`:

```js
test('the seconds count down every second, and an icon goes at 0', () => {
  const page = load({ store: makeStore(state({ mine: [fx({ timeLeft: 3 })] })) });
  const secs = () => page.tiles().map((t) => t.secs);
  assert.deepEqual(secs(), ['3']);
  page.advance(1000);
  assert.deepEqual(secs(), ['2']);
  page.advance(1000);
  assert.deepEqual(secs(), ['1']);
  page.advance(1000);
  assert.deepEqual(secs(), []);
  assert.equal(page.document.querySelector('#tdms-row .tdms-icons').hidden, true);
});

test('Torn\'s refresh resets the count to its own numbers', () => {
  const store = makeStore(state({ mine: [fx({ timeLeft: 103 })] }));
  const page = load({ store });
  page.advance(2000);
  assert.deepEqual(page.tiles().map((t) => t.secs), ['101']);
  store.set(state({ mine: [fx({ timeLeft: 102 })] }));   // Torn's clock runs a second behind
  page.flush();
  assert.deepEqual(page.tiles().map((t) => t.secs), ['102']);
  page.advance(1000);
  assert.deepEqual(page.tiles().map((t) => t.secs), ['101']);
});

test('back from the background, the seconds are right straight away', () => {
  // Phones pause timers and frames while the app is in the background.
  const page = load({ store: makeStore(state({ mine: [fx({ timeLeft: 103 })] })) });
  page.clock.now += 60000;
  page.advance(1000);
  assert.deepEqual(page.tiles().map((t) => t.secs), ['42']);
});

test('the countdown timer runs only while icons show', () => {
  const store = makeStore(state({ mine: [fx({ timeLeft: 2 })] }));
  const page = load({ store });
  assert.equal(page.timers.size, 1, 'the countdown; the store finder has stopped');
  page.advance(2000);
  assert.equal(page.timers.size, 0, 'stopped when the last icon went');
  store.set(state({ layout: 'defender', mine: [fx({ timeLeft: 50 })] }));
  page.flush();
  assert.equal(page.timers.size, 0, 'none while the row is hidden');
  store.set(state({ mine: [fx({ timeLeft: 50 })] }));
  page.flush();
  assert.equal(page.timers.size, 1, 'back with the row');
});
```

- [ ] **Step 2: Run the tests to see the new ones fail**

Run: `cd /opt/warboard/server && node --test torn-debuff-mobile-status.test.mjs`
Expected: `# tests 38`, `# pass 34`, `# fail 4`. The seconds stay at Torn's number ('3', '103') and no timer is running.

- [ ] **Step 3: Implement**

In `server/public/scripts/torn-debuff-mobile-status.user.js`:

(a) Add these lines under `let lastKey = '';`:

```js
  let ticker = 0;        // the one-second countdown timer; it runs only while icons show
  // The effect list Torn last sent and when it arrived. Torn's timeLeft only changes when its
  // data refreshes (every 4 s), and Torn counts its own icons down in between; so does this.
  let snap = { key: '', at: 0, list: [] };
```

(b) Replace `drawIcons` and its comment with:

```js
  // The icons line: one tile per effect, as Torn draws them, with the seconds left under each,
  // counted down from when Torn's numbers arrived. Hidden when there is nothing to show.
  function drawIcons(line, effects) {
    const now = Date.now();
    const key = JSON.stringify(effects.map((e) => [e.ID, e.class, e.level, e.timeLeft]));
    if (key !== snap.key) snap = { key, at: now, list: effects };
    const gone = Math.floor((now - snap.at) / 1000);
    const shown = snap.list.map((e) => ({ e, left: e.timeLeft - gone })).filter((x) => x.left > 0);
    const tilesKey = shown.map((x) => [x.e.ID, iconName(x.e), x.e.iconColor].join('/')).join('|');
    if (line.getAttribute('data-key') !== tilesKey) {
      line.setAttribute('data-key', tilesKey);
      line.textContent = '';
      for (const x of shown) line.appendChild(tile(x.e));
    }
    shown.forEach((x, i) => {
      const text = x.left > 300 ? '\u221e' : String(x.left);
      const secs = line.children[i].lastChild;
      if (secs.textContent !== text) secs.textContent = text;
    });
    line.hidden = shown.length === 0;
    setTicking(shown.length > 0);
  }

  // Starts or stops the one-second countdown repaint.
  function setTicking(on) {
    if (on && !ticker) ticker = setInterval(schedule, 1000);
    if (!on && ticker) {
      clearInterval(ticker);
      ticker = 0;
    }
  }
```

(c) In `paint()`, replace the hide branch with:

```js
      if (!view) {
        if (row && row.parentNode) row.parentNode.removeChild(row);
        setTicking(false);
        return;
      }
```

- [ ] **Step 4: Run the tests to see them pass**

Run: `cd /opt/warboard/server && node --test torn-debuff-mobile-status.test.mjs`
Expected: `# tests 38`, `# pass 38`, `# fail 0`.

- [ ] **Step 5: Commit**

```bash
cd /opt/warboard && git add server/torn-debuff-mobile-status.test.mjs server/public/scripts/torn-debuff-mobile-status.user.js && git commit -m "torn-debuff-mobile-status: count the seconds down between Torn's refreshes

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Ship and check it live

**Files:**
- Modify: nothing in the repo, unless the review or the live check finds a fault. A fault goes back through TDD in the task that owns the code.
- Memory: `/root/.claude/projects/-root/memory/project_torn_attack_my_status.md`

- [ ] **Step 1: Run the whole suite once**

First check that nothing else heavy is running (`uptime`; a load near the box's usual 8 is fine).

Run: `cd /opt/warboard/server && npm test 2>&1 | tail -8`
Expected: `# fail 0`. There are about 2000 tests: the 1962 from before plus these 38, with 2 skipped.

- [ ] **Step 2: Check the files as served**

```bash
cd /opt/warboard/server/public/scripts && chown warboard:warboard torn-debuff-mobile-status.user.js torn-debuff-mobile-status.meta.js && chmod 644 torn-debuff-mobile-status.user.js torn-debuff-mobile-status.meta.js && node --check torn-debuff-mobile-status.user.js && for f in torn-debuff-mobile-status.user.js torn-debuff-mobile-status.meta.js; do a=$(sha256sum < $f | cut -c1-16); b=$(curl -s "https://tornwar.com/scripts/$f?v=1.0.0" | sha256sum | cut -c1-16); echo "$f local $a served $b"; done
```

Expected: `node --check` prints nothing, and each file's local and served hashes match.

- [ ] **Step 3: Whole-branch review**

Review the four task commits, from the commit before Task 1 to Task 4's, with superpowers:requesting-code-review against the spec and this plan. Fix every Critical and Important finding before pushing. Each fix gets a failing test first, in the task that owns the code.

- [ ] **Step 4: Push**

```bash
cd /opt/warboard && git push origin main 2>&1 | sed -E 's#//[^@]*@#//***@#g'
```

Expected: `main -> main`, and only this plan's commits on top of the remote.

- [ ] **Step 5: Live check on the owner's phone**

The owner installs the script from `https://tornwar.com/scripts/torn-debuff-mobile-status.user.js?v=1.0.0`, turns on remote inspect in the warboard app, and starts a fight.

Before each probe, check that the in-app agent isn't using the relay. A read of `/api/inspect/result` drains every result, the agent's too. Run:

```bash
grep "POST /api/agent/inspect" /var/log/nginx/access.log | tail -1
```

If the agent was used in the last few minutes, ask the owner to pause it.

Queue this read-only probe. Save it as `$P/live.js`, where `$P` is the session's `scratchpad/attack-status/probe` folder, and run it with that folder's `run1.sh`: wrap it as `{"js": ...}` with `python3 -I -c 'import json,sys; print(json.dumps({"js": open(sys.argv[1]).read()}))' $P/live.js > $P/cmd-live.json`, then run `bash $P/run1.sh $P/cmd-live.json live` and read `$P/live.json`. The token stays in its file; never print it.

```js
// Read-only live check of Torn Debuff Mobile Status: what the row shows against Torn's own
// data, and where the row and the window's other layers sit. Clicks nothing, changes nothing.
const R = (e) => { if (!e) return null; const r = e.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)]; };
const box = document.querySelector('[class*="playersModelWrap___"]');
let st = null;
if (box) {
  const fk = Object.keys(box).find((k) => k.startsWith('__reactFiber$'));
  for (let f = fk ? box[fk] : null, i = 0; f && i < 40; i++, f = f.return) {
    const p = f.memoizedProps;
    if (p && p.store && typeof p.store.getState === 'function') { st = p.store.getState(); break; }
  }
}
const a = (st && st.attack) || {};
const me = a.attackerUser || {};
const row = document.getElementById('tdms-row');
const win = document.querySelector('[class*="playerWindow___"]');
return {
  t: new Date().toISOString(), href: location.href, attackStatus: a.attackStatus,
  layout: st && st.activePlayerLayout, row: R(row), win: R(win),
  shown: row ? [...row.querySelectorAll('.tdms-stat')].map((c) => c.textContent) : null,
  tiles: row ? [...row.querySelectorAll('.tdms-icon')].map((t) => ({ src: t.querySelector('img').getAttribute('src'), secs: t.lastChild.textContent })) : null,
  torn: Object.fromEntries(Object.entries(me.statsModifiers || {}).map(([k, v]) => [k, v && v.value])),
  mine: (((a.currentTemporaryEffects || {})[me.userID]) || []).map((e) => ({ ID: e.ID, class: e.class, type: e.type, title: e.title, timeLeft: e.timeLeft, iconColor: e.iconColor, renderMode: e.renderMode, level: e.level, isStackable: e.isStackable, stackCount: e.stackCount })),
  layers: win ? [...win.querySelectorAll(':scope > *, :scope > * > *')].map((e) => ({ cls: e.getAttribute('class') || e.id, rect: R(e), z: getComputedStyle(e).zIndex, pos: getComputedStyle(e).position })) : null,
};
```

`run1.sh` (in the probe folder, from the mock-up work) queues one command and polls for its result:

```bash
#!/bin/bash
# run1.sh CMDFILE NAME: queue one inspect command from CMDFILE and save its result to NAME.json.
P=/tmp/claude-0/-root/47c424fc-f532-4851-8c7f-7c18d084306c/scratchpad/attack-status/probe
TF=/opt/warboard/server/data/.inspect-token
CMD=$1; NAME=$2
id=$(curl -s localhost:3000/api/inspect/cmd -H "x-inspect-token: $(cat $TF)" -H 'content-type: application/json' --data-binary @$CMD | python3 -I -c 'import json,sys; print(json.load(sys.stdin).get("id",""))')
[ -n "$id" ] || { echo "queue failed"; exit 1; }
for i in $(seq 1 20); do
  sleep 2
  curl -s localhost:3000/api/inspect/result -H "x-inspect-token: $(cat $TF)" > $P/batch-$NAME-$i.json
  if python3 -I - "$P/batch-$NAME-$i.json" "$id" "$P/$NAME.json" <<'PY'
import json, sys
b = json.load(open(sys.argv[1])).get("results", [])
mine = [r for r in b if str(r.get("id")) == sys.argv[2]]
if not mine: sys.exit(1)
r = mine[0]
if r.get("error"): print("device error:", r["error"])
open(sys.argv[3], "w").write(r.get("result") or "null")
PY
  then exit 0; fi
done
exit 2
```

Check each point, with the probe and with the owner's own eyes:
1. **Numbers match.** `shown` matches `torn` (the same five numbers), and the owner sees the same numbers in Torn's strip after tapping their own header.
2. **Effects match.** After the enemy uses a temp on the owner, `tiles` match `mine`: same icons, and seconds within a second of `timeLeft`.
3. **Header taps.** The row is gone while the owner's own window is up, and back after tapping the enemy's header.
4. **Needle.** The owner uses a needle. `mine` shows its entry, and `tiles` shows it with the boost's +% in `shown`.
   - If the needle is in `mine` but has no tile, the filter is wrong for it. Stop and use superpowers:systematic-debugging, starting from the entry the probe returned.
   - Write the needle's entry shape into the project memory.
5. **Fight buttons.** The row doesn't cover the Start fight button, or the buttons at the end of the fight (`layers` gives their boxes and z-index).

- [ ] **Step 6: Greasy Fork and memory**

- **Greasy Fork:** the owner creates the script on Greasy Fork by pasting the served file. Greasy Fork rewrites the two URL lines; nothing else may differ. Ask for the Greasy Fork id. From then on, posts link to the Greasy Fork page.
- **Memory:** update `project_torn_attack_my_status.md` with:
  - the release (1.0.0), its commits, and the served file's sha256 (first 8);
  - the live check results;
  - the needle's entry shape;
  - the Greasy Fork id.

  Keep `MEMORY.md` under 24,000 bytes.
- **Finish** by giving the owner the served URL: `https://tornwar.com/scripts/torn-debuff-mobile-status.user.js?v=1.0.0`.
