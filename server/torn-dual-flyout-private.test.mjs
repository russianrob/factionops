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
// What the browser reports for a menu icon's fill and filter: Torn's CSS points the
// fill at a gradient and gives the icon a drop shadow.
const FILL = 'url("#sidebar_svg_gradient_regular_mobile")';
const SHADOW = 'drop-shadow(rgba(0, 0, 0, 0.45) 0px 1px 2px)';
const TARGETS = '/page.php?sid=list&type=targets';

// One area row as Torn's sidebar build draws it (nL / nM in app.4af34ba3e31baa7e.js).
function areaRow(id, href, name) {
  return `<div class="area-mobile___AK1cR notList___jrp60" id="nav-${id}"><div class="areaRow___Eheay">` +
    `<a href="${href}" class="link___tg6eQ mobileLink___NbSV4"><span class="svgIconWrap___MDuQ8"><span class="defaultIcon___GnL0d mobile___nUzYc">` +
    `<svg id="${id}-icon" viewBox="0 0 20 20"><path id="${id}-path" d="M0 0h20v20z"/></svg></span></span>` +
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
// fill: what the browser reports as a menu icon's computed fill.
function load({ order = 'private', stored = null, iconsOnly = false, menu = MENU, fill = FILL } = {}) {
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
  const getComputedStyle = (el) => (/^svg$/i.test(el.tagName) ? { fill, filter: SHADOW } : { fill: '', filter: 'none' });
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
  assert.equal(p.pins().length, 2);
  for (const a of p.pins()) {
    const svg = a.querySelector('.tdf-pin-icon svg');
    assert.ok(svg, `${a.getAttribute('href')} has an icon`);
    assert.equal(a.querySelector('[id]'), null);   // the copy brings no duplicate ids
    assert.match(svg.getAttribute('style') || '', /fill:url\("#sidebar_svg_gradient_regular_mobile"\)/);
    assert.match(svg.getAttribute('style') || '', /filter:drop-shadow\(rgba\(0, 0, 0, 0\.45\) 0px 1px 2px\)/);
  }
});

test('an icon fill the browser reports as a full address still points at the page\'s own gradient', () => {
  // WebKit can resolve a url() fill against the page address. Written back inline, a
  // full address stops pointing at this page's gradient once the address changes (or
  // under a <base> tag), and the gradients live in this same page: keep the #fragment.
  const p = load({ stored: ['/gym.php'], fill: 'url("https://www.torn.com/gym.php#sidebar_svg_gradient_regular_mobile")' });
  p.tick();
  assert.match(p.pins()[0].querySelector('svg').getAttribute('style'), /^fill:url\("#sidebar_svg_gradient_regular_mobile"\);/);
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
  assert.equal(p.pins().length, 1);
});

test('the row follows the bars strip when Torn draws the strip again somewhere else', () => {
  const p = load({ stored: ['/gym.php'] });
  p.tick();
  const sidebar = p.document.getElementById('sidebar');
  const strip = sidebar.querySelector('[class*="userInformationMobile___"]');
  sidebar.insertBefore(strip, sidebar.firstChild);   // now ahead of the fly-out panel
  p.tick();
  assert.equal(p.document.getElementById('tdf-pins').nextElementSibling, strip);
  assert.equal(p.document.querySelectorAll('#tdf-pins').length, 1);
});

test('a tick with nothing new leaves the pins in place, so a tap in progress is not lost', () => {
  const p = load({ stored: ['/gym.php'] });
  p.tick();
  const before = p.pins()[0];
  assert.ok(before, 'pin drawn');
  p.tick(); p.tick();
  assert.equal(p.pins()[0], before);
});

test('a damaged pins setting is treated as nothing pinned', () => {
  for (const bad of ['{oops', '"just a string"', '[1, null, {}]', '["constructor", "__proto__", "toString"]']) {
    const p = load({ stored: bad });
    p.tick();
    assert.equal(p.document.getElementById('tdf-pins'), null, bad);
  }
});

test('a link stored twice is pinned once', () => {
  const p = load({ stored: ['/gym.php', '/forums.php', '/gym.php'] });
  p.tick();
  assert.deepEqual(p.pins().map((a) => a.getAttribute('href')), ['/gym.php', '/forums.php']);
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

test('before the menu has loaded, the list says so, and reopening the panel picks the links up', () => {
  const p = load({ menu: '' });
  const settings = p.openCog();
  assert.match(settings.querySelector('.tdf-pins-list').textContent, /No menu links found yet/);
  p.panel.innerHTML = MENU;
  p.openCog();   // a second tap on the cog shuts the panel
  p.openCog();   // and a third opens it again
  assert.equal(settings.querySelectorAll('.tdf-pins-list input[data-key]').length, 7);
  assert.doesNotMatch(settings.querySelector('.tdf-pins-list').textContent, /No menu links found yet/);
});
