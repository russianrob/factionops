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

// A tab's sessionStorage. It lasts from page to page in one tab, so two pages given the same
// one are two pages of one tab.
function tabSession() {
  return Object.create({
    getItem(k) { return Object.prototype.hasOwnProperty.call(this, k) ? this[k] : null; },
    setItem(k, v) { this[k] = String(v); },
    removeItem(k) { delete this[k]; },
  });
}

// A Torn page with the script on it. The test controls everything the script reaches for:
// - the clock (w.clock.ms), and timers (w.advance(ms) moves the clock and runs what is due);
// - the 2-second check (w.check() runs it once; the script runs it once itself on start);
// - GM storage (w.store; two pages given the same store share it, as tabs do);
// - the tab's sessionStorage (`session`, from tabSession());
// - Torn's API (w.calls, one per request, answered with answer() or noAnswer());
// - the menu (w.menu) and the console (w.logs).
// Pass `data` for raw sidebar data (null for none), or `icons` for statusIcons.icons. `menu` is
// false for a host with no menu, or 'throws' for one whose menu throws.
function page({ sidebar = 'Fly-out, phone', icons = { drug_cooldown: drug(NOW - 1) }, data, store = {},
  clock = { ms: NOW * 1000 }, session = tabSession(), src = readFileSync(SRC, 'utf8'), gmRequest = true, menu = true } = {}) {
  const dom = parseHTML('<!doctype html><html><head></head><body>' + HEADER + SIDEBARS[sidebar] + '</body></html>');
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

test('with storage that will not save, the pages of one tab share one call and keep its answer', async () => {
  // Every write throws, as a full localStorage does; the saved key still reads. Torn loads a
  // new page for almost every click, and each page runs the script afresh.
  const store = new Proxy({ [KEY_STORE]: KEY }, { set() { throw new Error('QuotaExceededError'); } });
  const session = tabSession();
  const clock = { ms: NOW * 1000 };
  const first = page({ store, session, clock }).run();
  assert.equal(first.calls.length, 1);
  answer(first.calls[0], wars(ranked(START)));
  await settle();
  clock.ms += 60 * 1000;
  const next = page({ store, session, clock }).run();
  assert.equal(next.calls.length, 0, 'the next page asks nothing');
  assert.match(next.label(), /War starts in 5h 11m/);
});

test('an answer that storage has no room for still shows in this tab', async () => {
  // Storage takes the time of the call, then is full when the answer comes.
  let room = 1;
  const store = new Proxy({ [KEY_STORE]: KEY }, {
    set(target, k, v) {
      if (room-- <= 0) throw new Error('QuotaExceededError');
      target[k] = v;
      return true;
    },
  });
  const w = page({ store }).run();
  assert.equal(w.calls.length, 1);
  answer(w.calls[0], wars(ranked(START)));
  await settle();
  w.check();
  assert.equal(w.label(), LABEL + '. ' + WAR_LINE);
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

test('once storage saves again, a new key is asked about at once in a tab that kept its own copy', async () => {
  // Storage is full at first, and has room again by the time the new key is saved.
  let full = true;
  const store = new Proxy({ [KEY_STORE]: 'OLDKEY123456789' }, {
    set(target, k, v) {
      if (full) throw new Error('QuotaExceededError');
      target[k] = v;
      return true;
    },
  });
  const w = page({ store }).run();
  answer(w.calls[0], { error: { code: 2, error: 'Incorrect key' } });
  await settle();
  full = false;
  w.menu['Set API key']();
  keyBox(w).querySelector('input').value = KEY;
  fire(w, keyButtons(w)[0], 'click');
  w.check();
  assert.equal(w.calls.length, 2, 'asked again with the new key');
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

test('the key box says why the last check failed, so a bad key shows on a phone too', async () => {
  // On a phone the tooltip never opens, so the key box is where a bad key can show.
  const w = page({ store: { [KEY_STORE]: KEY } }).run();
  answer(w.calls[0], { error: { code: 2, error: 'Incorrect key ' + KEY } });
  await settle();
  w.menu['Set API key']();
  const text = keyBox(w).textContent;
  assert.match(text, /A key is saved\. Couldn't check the war time: Incorrect key \*\*\*\*/);
  assert.ok(!text.includes(KEY), 'the key never shows');
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
