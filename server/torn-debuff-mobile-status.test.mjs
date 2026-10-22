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
