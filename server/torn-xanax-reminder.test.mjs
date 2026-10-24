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
// one are two pages of one tab. With full, every write throws, as one with no room does.
function tabSession({ full = false } = {}) {
  return Object.create({
    getItem(k) { return Object.prototype.hasOwnProperty.call(this, k) ? this[k] : null; },
    setItem(k, v) { if (full) throw new Error('QuotaExceededError'); this[k] = String(v); },
    removeItem(k) { delete this[k]; },
  });
}

// A Torn page with the script on it. The test controls everything the script reaches for:
// - the clock (w.clock.ms), and timers (w.advance(ms) moves the clock and runs what is due);
// - the 2-second check (w.check() runs it once; the script runs it once itself on start);
// - GM storage (w.store; two pages given the same store share it, as tabs do);
// - the tab's sessionStorage (`session`, from tabSession());
// - Torn's API (w.calls, one per request, answered with answer() or noAnswer());
// - the menu (w.menu by name, and w.menuCalls, every name in the order registered) and the
//   console (w.logs).
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
    document: dom.document, Event: dom.Event, store, clock, calls: [], menu: {}, menuCalls: [], logs: [], checks: [], pollMs: null,
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
    // A scroll of the page by default, or of one element.
    scroll(target = w.document) { (winListeners.scroll || []).forEach((fn) => fn({ type: 'scroll', target })); },
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
        menu ? (name, fn) => { if (menu === 'throws') throw new Error('no menu here'); w.menu[name] = fn; w.menuCalls.push(name); } : undefined,
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
  assert.deepEqual(tag('version'), ['1.0.2']);
  assert.deepEqual(tag('license'), ['All Rights Reserved']);
  assert.deepEqual(tag('copyright'), []);
  assert.deepEqual(tag('match'), ['https://www.torn.com/*', 'https://torn.com/*']);
  assert.deepEqual(tag('run-at'), ['document-idle']);
  assert.deepEqual(tag('grant'), ['GM_getValue', 'GM_setValue', 'GM_xmlhttpRequest', 'GM_registerMenuCommand']);
  assert.deepEqual(tag('connect'), ['api.torn.com']);
  assert.deepEqual(tag('downloadURL'), ['https://tornwar.com/scripts/torn-xanax-reminder.user.js']);
  assert.deepEqual(tag('updateURL'), ['https://tornwar.com/scripts/torn-xanax-reminder.meta.js']);
  assert.equal(readFileSync(META, 'utf8'), header + '\n', 'the meta file is the header, byte for byte');
  assert.match(src, /const VERSION = '1\.0\.2';/, 'the in-file version matches @version');
  assert.match(src, /^\/\/ v1\.0\.2  - A bigger pill/m, 'the changelog has the 1.0.2 entry');
  assert.match(src, /^\/\/ v1\.0\.1  - The menu entry names the script/m, 'the changelog keeps the 1.0.1 entry');
  assert.match(src, /^\/\/ v1\.0\.0  - First release\./m, 'the changelog keeps the 1.0.0 entry');
});

test('the source is plain ASCII, so PDA can run it, and the console line carries the version', () => {
  assert.equal(readFileSync(SRC, 'utf8').match(/[^\x00-\x7f]/g), null);
  assert.deepEqual(page().run().logs, ['[Torn Xanax Reminder 1.0.2] running']);
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

// Every declaration in the rules whose selector is exactly this one, as { property: value }.
function declarations(css, selector) {
  const out = {};
  for (const block of css.split('}')) {
    const [sel, body] = block.split('{');
    if (!body || sel.trim() !== selector) continue;
    for (const d of body.split(';')) {
      const i = d.indexOf(':');
      if (i > 0) out[d.slice(0, i).trim()] = d.slice(i + 1).trim();
    }
  }
  return out;
}

test('the icon is Torn\'s Xanax picture, the whole pill drawn 1.5 times its 17 px slot and centred on it, with a thin edge, and pulses once', () => {
  const w = page().run();
  const img = w.icon().querySelector('img');
  assert.equal(img.getAttribute('src'), XANAX_PNG);
  assert.equal(img.getAttribute('width'), '26');
  assert.equal(img.getAttribute('height'), '17');
  const css = w.document.getElementById(STYLES).textContent;
  // The slot stays the size of Torn's other icons, so nothing else in the row moves.
  const slot = declarations(css, '#tm-xanax-reminder a');
  assert.equal(slot.width, '17px');
  assert.equal(slot.height, '17px');
  const pic = declarations(css, '#tm-xanax-reminder img');
  assert.equal(pic.width, '26px');
  assert.equal(pic.height, '17px');
  assert.equal(pic['margin-left'], (17 - 26) / 2 + 'px', 'centred on the slot');
  // A top margin would collapse through the link and move it, the tap target, down off its slot.
  assert.equal(pic['margin-top'], undefined);
  assert.equal(pic.margin, undefined);
  assert.equal(pic['object-fit'], 'contain', 'the whole pill, ends included');
  // Nothing on the icon clips the pill back into the 17 px square.
  for (const block of css.split('}')) {
    const [sel, body] = block.split('{');
    if (body && sel.includes('#tm-xanax-reminder')) assert.doesNotMatch(body, /overflow\s*:\s*(hidden|clip|scroll|auto)/, sel.trim());
  }
  assert.equal(pic['max-width'], 'none');
  assert.equal(pic['max-height'], 'none');
  assert.equal(pic.filter, 'drop-shadow(0 0 .6px rgba(0,0,0,.85))');
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
// The settings box's choice for a tap during a ranked war.
const WAR_TAP_STORE = 'tm-xanax-reminder-war-tap';
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
  assert.match(w.label(), /Ranked war on/, 'the war has started, and is still on');
  assert.equal(w.calls.length, 2, 'that check asked Torn again');
  answer(w.calls[1], wars(ranked(NOW + 86400 + 600, Math.floor(w.clock.ms / 1000) - 60)));
  await settle();
  w.check();
  assert.equal(w.label(), LABEL, 'Torn gave it an end time');
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

test('with nowhere to save at all, a page still calls once per 30 minutes', async () => {
  // Writes throw in storage and in the tab's sessionStorage too, so only the page's own
  // memory of its last call is left to keep the 30 minutes.
  const store = new Proxy({ [KEY_STORE]: KEY }, { set() { throw new Error('QuotaExceededError'); } });
  const w = page({ store, session: tabSession({ full: true }) }).run();
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
// The tap, the box and the settings box
// ---------------------------------------------------------------------------------------------

const ARMOURY = 'https://www.torn.com/factions.php?step=your&type=1#/tab=armoury&start=0&sub=drugs';
const CHOICE = 'tm-xanax-reminder-choice';
const SETTINGS = 'tm-xanax-reminder-settings';
// The script's one menu entry. It names the script, because a host's menu may list every
// script's entries together, as the warboard app's does.
const MENU = 'Xanax Reminder: Settings';
// GM storage as an earlier answer from Torn left it, checked just now: a key, and a war
// starting at `start` (in the window by default).
const warStore = (start = START) => ({ [KEY_STORE]: KEY, [WAR_STORE]: JSON.stringify({ at: NOW * 1000, start, end: 0, error: '' }) });
const box = (w) => w.document.getElementById(CHOICE);
const settings = (w) => w.document.getElementById(SETTINGS);
// The settings box's key field; a tap on one of its buttons, found by its words; and a pick
// from its war list, as a tap on the list makes it. Only the picked option is set: setting one
// takes the mark off the others, as in a browser.
const keyField = (w) => settings(w).querySelector('input');
const press = (w, words) => fire(w, [...settings(w).querySelectorAll('button')].find((b) => b.textContent === words), 'click');
const pick = (w, value) => { settings(w).querySelector('option[value="' + value + '"]').selected = true; };
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

test('the open box keeps its time current', () => {
  const w = page({ store: warStore() }).run();
  fire(w, w.link(), 'click');
  w.clock.ms += 12 * 60 * 1000;
  w.check();
  assert.equal(box(w).querySelector('b').textContent, 'War starts in 5h 0m');
});

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
  assert.equal(settings(w), null, 'and no settings box');
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

test('a part of the page that scrolls by itself, like a chat, leaves the tooltip and the box open', () => {
  const w = page({ store: warStore() }).run();
  // A chat list scrolls itself as messages come in, and it doesn't hold the icon.
  const chat = w.document.createElement('div');
  w.document.body.appendChild(chat);
  fire(w, w.link(), 'pointerenter', { pointerType: 'mouse' });
  w.scroll(chat);
  assert.ok(w.document.getElementById(TIP), 'the tooltip stays');
  fire(w, w.link(), 'click');
  assert.ok(box(w), 'the box opens');
  w.scroll(chat);
  assert.ok(box(w), 'and stays while the chat scrolls');
  w.scroll(w.document.getElementById('sidebar'));
  assert.equal(box(w), null, 'a scroll of what holds the icon closes it');
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

test('a long press opens the settings box and no choice box, and the tap that ends it goes nowhere', () => {
  const w = page({ store: warStore() }).run();
  fire(w, w.link(), 'touchstart');
  w.advance(500);
  assert.ok(settings(w), 'the settings box is open');
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
  assert.equal(settings(w), null, 'a short press');
  fire(w, w.link(), 'touchstart');
  fire(w, w.link(), 'touchmove');
  w.advance(1000);
  assert.equal(settings(w), null, 'a swipe');
  fire(w, w.link(), 'touchstart');
  w.advance(500);
  assert.ok(settings(w), 'a long press does open it');
});

test('a long press with the mouse opens the settings box too, and a right-click keeps its menu', () => {
  const w = page().run();
  fire(w, w.link(), 'mousedown', { button: 0 });
  w.advance(500);
  assert.ok(settings(w));
  assert.equal(fire(w, w.link(), 'click').defaultPrevented, true);
  escape(w);
  fire(w, w.link(), 'mousedown', { button: 2 });
  w.advance(1000);
  assert.equal(settings(w), null, 'a right-click is no long press');
  assert.equal(fire(w, w.link(), 'contextmenu').defaultPrevented, false, 'its menu opens');
});

test('the phone\'s own long-press menu is held back on the icon', () => {
  const w = page().run();
  fire(w, w.link(), 'touchstart');
  assert.equal(fire(w, w.link(), 'contextmenu').defaultPrevented, true);
  assert.match(w.document.getElementById(STYLES).textContent, /#tm-xanax-reminder a \{ -webkit-touch-callout: none;/);
});

test('the menu entry names the script, so it stands out among other scripts\' entries', () => {
  assert.deepEqual(page().run().menuCalls, [MENU], 'one entry, registered once');
});

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

test('the settings box from the menu closes an open box and the tooltip', () => {
  const w = page({ store: warStore() }).run();
  fire(w, w.link(), 'click');
  fire(w, w.link(), 'focus');
  w.menu[MENU]();
  assert.ok(settings(w));
  assert.equal(box(w), null);
  assert.equal(w.document.getElementById(TIP), null);
});

test('the menu opens a styled settings box even while the cooldown runs, with 16px controls so an iPhone doesn\'t zoom', () => {
  const w = page({ icons: { drug_cooldown: drug(NOW + 3600) } }).run();
  w.menu[MENU]();
  assert.ok(settings(w));
  const css = w.document.getElementById(STYLES).textContent;
  assert.match(css, /#tm-xanax-reminder-settings \{ position: fixed;/);
  assert.match(declarations(css, '#tm-xanax-reminder-settings select, #tm-xanax-reminder-settings input').font, /^16px /);
  assert.match(settings(w).textContent, /No key saved\./);
});

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

test('a new key is asked about at once, even in a tab that just asked with the old one', async () => {
  const w = page({ store: { [KEY_STORE]: 'OLDKEY123456789' } }).run();
  assert.equal(w.calls.length, 1, 'asked with the old key');
  answer(w.calls[0], { error: { code: 2, error: 'Incorrect key' } });
  await settle();
  w.menu[MENU]();
  settings(w).querySelector('input').value = KEY;
  press(w, 'Save');
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
  w.menu[MENU]();
  settings(w).querySelector('input').value = KEY;
  press(w, 'Save');
  w.check();
  assert.equal(w.calls.length, 2, 'asked again with the new key');
});

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

test('the settings box says when PDA\'s key is in use, and never shows it', () => {
  const src = readFileSync(SRC, 'utf8').replace('###PDA-APIKEY###', 'PDAKEY0123456789');
  const w = page({ src }).run();
  w.menu[MENU]();
  assert.match(settings(w).textContent, /Using the key Torn PDA gives the script\./);
  assert.ok(!settings(w).textContent.includes('PDAKEY0123456789'));
});

test('the settings box says why the last check failed, so a bad key shows on a phone too', async () => {
  // On a phone the tooltip never opens, so the settings box is where a bad key can show.
  const w = page({ store: { [KEY_STORE]: KEY } }).run();
  answer(w.calls[0], { error: { code: 2, error: 'Incorrect key ' + KEY } });
  await settle();
  w.menu[MENU]();
  const text = settings(w).textContent;
  assert.match(text, /A key is saved\. Couldn't check the war time: Incorrect key \*\*\*\*/);
  assert.ok(!text.includes(KEY), 'the key never shows');
});

test('a host with no menu, or one whose menu throws, still gets the icon and the long press', () => {
  for (const menu of [false, 'throws']) {
    const w = page({ menu }).run();
    assert.ok(w.icon(), String(menu));
    fire(w, w.link(), 'touchstart');
    w.advance(500);
    assert.ok(settings(w), String(menu));
  }
});
