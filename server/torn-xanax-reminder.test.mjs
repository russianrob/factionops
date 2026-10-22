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
