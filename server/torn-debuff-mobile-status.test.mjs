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
