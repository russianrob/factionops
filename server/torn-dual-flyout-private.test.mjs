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
import { parse as parseSelector, stringify as stringifySelector } from 'css-what';

// TDFP_SRC lets a working copy be tested before it is installed over the served file.
const SRC = process.env.TDFP_SRC || '/opt/warboard/server/public/scripts/torn-dual-flyout-private.user.js';
const META = SRC.replace(/\.user\.js$/, '.meta.js');
const PUBLIC = '/opt/warboard/server/public/scripts/torn-dual-flyout.user.js';
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
// panel and the name/bars strip, then the page content. strip: false is a page with
// no phone strip (desktop, or Torn's top-bar mode); body adds attributes to <body>
// (dark mode, abroad); panelClass adds Torn's status classes to the panel.
function page(menu, { strip = true, body = '', panelClass = '' } = {}) {
  return `<html><head></head><body ${body}>
    <div id="header-root"><div class="header-wrapper-top"><button id="fly-out-menu-button"><svg id="menu-icon"><path d="M0 0h1v1z"/></svg></button></div></div>
    <div id="sidebarroot"><div id="sidebar" class="sidebar___c4dEc mobile___fSMgm">
      <aside id="fly-out-panel" class="flyOutPanel___Zqwqt ${panelClass}">${menu}</aside>
      ${strip ? '<div class="userInformationMobile___Aznrv"><div>name and money</div><div class="swiperWrapper___gaWYk">bars</div></div>' : ''}
    </div></div>
    <div class="content-wrapper" role="main"><h4 id="page-title">Home</h4></div>
  </body></html>`;
}

// Runs the real script(s) against that page. order: 'private' (this build alone),
// 'public-first' or 'private-first' (both copies installed, loading in that order).
// stored: what tdf_pins holds (an array, or a raw string to store as is).
// failSave: localStorage refuses to save tdf_pins (full). session: what Torn keeps in
// sessionStorage. strip, body, panelClass: see page().
function load({ order = 'private', stored = null, iconsOnly = false, menu = MENU, failSave = false,
  session = null, strip = true, body = '', panelClass = '' } = {}) {
  const { document, Event } = parseHTML(page(menu, { strip, body, panelClass }));
  const btn = document.getElementById('fly-out-menu-button');
  btn.getClientRects = () => [{}];   // laid out: the phone header is showing
  const panel = document.getElementById('fly-out-panel');
  btn.__reactProps$tdfp = { onClick() { panel.classList.toggle('visible___AnarB'); } };

  const store = new Map([['tmr_side', 'r'], ['tdf_iconsonly', iconsOnly ? '1' : '0']]);
  if (stored !== null) store.set('tdf_pins', typeof stored === 'string' ? stored : JSON.stringify(stored));
  const localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => {
      if (failSave && k === 'tdf_pins') throw new Error('QuotaExceededError');
      store.set(k, String(v));
    },
    removeItem: (k) => store.delete(k),
  };
  const sess = new Map(Object.entries(session || {}));
  const sessionStorage = {
    get length() { return sess.size; },
    key: (i) => [...sess.keys()][i] ?? null,
    getItem: (k) => (sess.has(k) ? sess.get(k) : null),
  };
  const touch = {};
  document.addEventListener = (type, fn) => { (touch[type] = touch[type] || []).push(fn); };
  const intervals = [], timeouts = [], observers = [];
  // Records what each observer was told to watch.
  class MO { constructor(cb) { this.cb = cb; observers.push(this); } observe(target, opts) { this.target = target; this.opts = opts; } disconnect() {} }
  const win = { innerWidth: 393, addEventListener() {} };
  const getComputedStyle = () => ({});   // the swipe code asks; nothing here overflows
  const run = (file) => new Function('window', 'document', 'localStorage', 'sessionStorage', 'MutationObserver', 'getComputedStyle',
    'setInterval', 'setTimeout', 'clearInterval', readFileSync(file, 'utf8'))(
    win, document, localStorage, sessionStorage, MO, getComputedStyle,
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
  return { document, win, store, touch, tick, mutate, flush, pins, openCog, tickBox, panel, observers };
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

// [ids, classes, types] for one parsed selector, counted the way the cascade counts
// them: :not(), :is() and :has() weigh as much as their weightiest argument.
const cmp = (a, b) => { for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] - b[i]; return 0; };
function specificity(tokens) {
  const s = [0, 0, 0];
  for (const t of tokens) {
    if (t.type === 'attribute') s[t.name === 'id' && t.ignoreCase === 'quirks' ? 0 : 1]++;
    else if (t.type === 'pseudo' && Array.isArray(t.data)) {
      const best = t.data.map(specificity).reduce((a, b) => (cmp(a, b) >= 0 ? a : b), [0, 0, 0]);
      for (let i = 0; i < 3; i++) s[i] += best[i];
    } else if (t.type === 'pseudo') s[1]++;
    else if (t.type === 'tag' || t.type === 'pseudo-element') s[2]++;
  }
  return s;
}
// The value a browser's cascade gives el for prop from every stylesheet on the page:
// !important first, then specificity, then the later rule. linkedom matches
// selectors but has no cascade. pseudo: 'after' reads the ::after box instead.
function cascade(document, el, prop, pseudo = null) {
  let best = null, order = 0;
  for (const sheet of document.querySelectorAll('style')) {
    for (const [, selectors, body] of sheet.textContent.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      order++;
      const decls = body.split(';').map((d) => d.trim()).filter(Boolean)
        .map((d) => [d.slice(0, d.indexOf(':')).trim(), d.slice(d.indexOf(':') + 1).trim()])
        .filter(([name]) => name === prop);
      if (!decls.length) continue;
      let parsed;
      try { parsed = parseSelector(selectors); } catch { continue; }
      for (const tokens of parsed) {
        const last = tokens[tokens.length - 1];
        const isPseudo = !!last && last.type === 'pseudo-element';
        if (pseudo ? !(isPseudo && last.name === pseudo) : isPseudo) continue;
        let hit = false;
        try { hit = el.matches(stringifySelector([isPseudo ? tokens.slice(0, -1) : tokens])); } catch { hit = false; }
        if (!hit) continue;
        for (const [, raw] of decls) {
          const key = [/!important\s*$/.test(raw) ? 1 : 0, ...specificity(tokens), order];
          if (!best || cmp(key, best.key) >= 0) best = { key, value: raw.replace(/\s*!important\s*$/, '') };
        }
      }
    }
  }
  return best ? best.value : undefined;
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
  assert.equal(field(h, 'version'), '1.6.1');
  assert.equal(field(h, 'author'), 'RussianRob');
  assert.equal(field(h, 'license'), 'All Rights Reserved');
  assert.equal(field(h, 'downloadURL'), 'https://tornwar.com/scripts/torn-dual-flyout-private.user.js');
  assert.equal(field(h, 'updateURL'), 'https://tornwar.com/scripts/torn-dual-flyout-private.meta.js');
  assert.equal(field(h, 'grant'), 'none');
  assert.equal(field(h, 'copyright'), null);
  assert.equal(load().win.__tdfVer, '1.6.1');
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
  assert.equal(p.win.__tdfVer, '1.6.1');
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

test('each pin carries its menu icon, in Torn\'s top-bar grey with Torn\'s shadow', () => {
  const p = load({ stored: ['/gym.php', '/messages.php'] });
  p.tick();
  assert.equal(p.pins().length, 2);
  for (const a of p.pins()) {
    const svg = a.querySelector('.tdf-pin-icon svg');
    assert.ok(svg, `${a.getAttribute('href')} has an icon`);
    assert.equal(a.querySelector('[id]'), null);   // the copy brings no duplicate ids
    assert.equal(cascade(p.document, svg, 'fill'), 'url(#tdf-g-regular)');
    assert.equal(cascade(p.document, svg, 'filter'), 'drop-shadow(0 0 1.3px #000)');
  }
});

test('the icon colours are Torn\'s own top-bar gradients, defined once in the page', () => {
  const p = load({ stored: ['/gym.php'] });
  p.tick(); p.tick(); p.mutate();
  assert.equal(p.document.querySelectorAll('#tdf-pins-defs').length, 1);
  const stops = (id) => [...p.document.querySelectorAll(`#tdf-g-${id} stop`)].map((s) => s.getAttribute('stop-color'));
  assert.deepEqual(stops('regular'), ['#888888', '#666666']);
  assert.deepEqual(stops('regular-on'), ['#DDDDDD', '#AAAAAA']);
  assert.deepEqual(stops('blue'), ['#74C0FC', '#1C7ED6']);
  assert.deepEqual(stops('blue-on'), ['#E7F5FF', '#74C0FC']);
  assert.deepEqual(stops('jail'), ['#BDBCAF', '#8A8973']);
  assert.deepEqual(stops('hospital'), ['#DDDDDD', '#AAAAAA']);
  assert.deepEqual(stops('travel'), ['#8FA6BC', '#5F7F9F']);
  assert.deepEqual(stops('white'), ['#FFFFFF', '#FFFFFF']);
});

test('a pin shows the menu\'s unread count, but not the size of a list', () => {
  const p = load({ stored: ['/events.php', TARGETS] });
  p.tick();
  const [events, targets] = p.pins();
  assert.equal(events.querySelector('.tdf-pin-badge').textContent, '4');
  assert.equal(events.querySelector('.tdf-pin-name').textContent, 'Events');   // not "Events, 4 new"
  assert.equal(targets.querySelector('.tdf-pin-badge'), null);
});

test('nine pins to a line from the left, the rest wrap onto the next line, and nothing scrolls sideways', () => {
  const p = load({ stored: ['/gym.php'] });
  p.tick();
  const row = p.document.getElementById('tdf-pins'), pin = p.pins()[0];
  assert.equal(cascade(p.document, row, 'display'), 'flex');
  assert.equal(cascade(p.document, row, 'flex-wrap'), 'wrap');
  assert.equal(cascade(p.document, row, 'justify-content'), 'flex-start');
  for (const prop of ['overflow', 'overflow-x']) assert.doesNotMatch(cascade(p.document, row, prop) || '', /auto|scroll/);
  for (const prop of ['flex', 'width', 'max-width']) assert.match(cascade(p.document, pin, prop) || '', /calc\(100% \/ 9\)/, prop);
});

test('the row is Torn\'s phone top bar: its dark bar, black edges and highlight lines', () => {
  const p = load({ stored: ['/gym.php'] });
  p.tick();
  const row = p.document.getElementById('tdf-pins');
  assert.equal(cascade(p.document, row, 'background'), '#333');
  assert.equal(cascade(p.document, row, 'border-top'), '1px solid #000');
  assert.equal(cascade(p.document, row, 'border-bottom'), '1px solid #000');
  assert.equal(cascade(p.document, row, 'box-shadow'), 'inset 0 1px rgba(255,255,255,.1),0 1px rgba(255,255,255,.1)');
});

test('each pin is built like Torn\'s link: 2px sides, a 40px row, a 34 x 23 icon box and a 6px capital name', () => {
  const p = load({ stored: ['/gym.php'] });
  p.tick();
  const a = p.pins()[0], c = (el, prop) => cascade(p.document, el, prop);
  assert.equal(c(a, 'padding'), '0 2px');
  assert.equal(c(a, 'font-size'), '6px');
  assert.equal(c(a, 'font-weight'), '700');
  assert.equal(c(a, 'text-transform'), 'uppercase');
  assert.equal(c(a, 'color'), '#999');
  assert.equal(c(a.querySelector('.tdf-pin-row'), 'max-width'), '40px');
  assert.equal(c(a.querySelector('.tdf-pin-link'), 'margin'), '4px 0');
  assert.equal(c(a.querySelector('.tdf-pin-icon'), 'width'), '34px');
  assert.equal(c(a.querySelector('.tdf-pin-icon'), 'height'), '23px');
  assert.equal(c(a.querySelector('.tdf-pin-name'), 'line-height'), '7px');
  assert.equal(c(a.querySelector('.tdf-pin-name'), 'white-space'), 'nowrap');
});

test('pins carry Torn\'s short names: Torn\'s own copy first, then the built-in list, then the menu name', () => {
  const extra = areaRow('hall_of_fame', '/page.php?sid=hof', 'Hall of Fame') + areaRow('education', '/page.php?sid=education', 'Education') +
    areaRow('recruit_citizens', '/recruit.php', 'Recruit Citizens');
  const menu = MENU.replace(areaRow('forums', '/forums.php', 'Forums'), areaRow('forums', '/forums.php', 'Forums') + extra);
  const stored = ['/page.php?sid=hof', '/page.php?sid=education', '/recruit.php', '/gym.php'];
  const builtIn = load({ stored, menu });
  builtIn.tick();
  assert.deepEqual(builtIn.pins().map((a) => a.querySelector('.tdf-pin-name').textContent), ['HOF', 'edu', 'Recruit Citizens', 'Gym']);
  const session = { sidebarData137558: JSON.stringify({ areas: { gym: { name: 'Gym', shortName: 'Gym!' }, recruit_citizens: { shortName: 'recruit' } } }) };
  const torn = load({ stored, menu, session });
  torn.tick();
  assert.deepEqual(torn.pins().map((a) => a.querySelector('.tdf-pin-name').textContent), ['HOF', 'edu', 'recruit', 'Gym!']);
});

test('Torn\'s saved data in a shape we do not expect just falls back to the built-in names', () => {
  // Hall of Fame is in the list: its built-in name (HOF) is not its menu name.
  const menu = MENU.replace(areaRow('forums', '/forums.php', 'Forums'),
    areaRow('forums', '/forums.php', 'Forums') + areaRow('hall_of_fame', '/page.php?sid=hof', 'Hall of Fame'));
  for (const raw of ['{oops', '[]', 'null', JSON.stringify({ areas: [{ shortName: 'X' }], lists: 5 }), JSON.stringify({ areas: { gym: { shortName: 7 } } }),
    JSON.stringify({ areas: { hall_of_fame: null, gym: { shortName: '  ' } } })]) {
    const p = load({ stored: ['/page.php?sid=hof', '/gym.php', TARGETS], menu, session: { sidebarData1: raw } });
    p.tick();
    assert.deepEqual(p.pins().map((a) => a.querySelector('.tdf-pin-name').textContent), ['HOF', 'Gym', 'Targets'], raw);
  }
});

test('a highlighted link is Torn\'s blue: name, icon and dot', () => {
  const p = load({ stored: ['/gym.php'] });
  p.document.getElementById('nav-gym').classList.add('attention___DT8nN');
  p.tick();
  const a = p.pins()[0];
  assert.equal(cascade(p.document, a, 'color'), '#74c0fc');
  assert.equal(cascade(p.document, a.querySelector('svg'), 'fill'), 'url(#tdf-g-blue)');
  assert.equal(cascade(p.document, a, 'background', 'after'), 'linear-gradient(#74c0fc,#1c7ed6)');
  assert.equal(cascade(p.document, a, 'top', 'after'), '2px');
  assert.equal(cascade(p.document, a, 'right', 'after'), '4px');
});

test('the page you are on is white', () => {
  const p = load({ stored: ['/gym.php', '/forums.php'] });
  p.document.getElementById('nav-gym').classList.add('active___xlAlO');
  p.tick();
  const [gym, forums] = p.pins();
  assert.match(gym.className, /tdf-pin-on/);
  assert.equal(cascade(p.document, gym, 'color'), '#fff');
  assert.equal(cascade(p.document, gym.querySelector('svg'), 'fill'), 'url(#tdf-g-regular-on)');
  assert.doesNotMatch(forums.className, /tdf-pin-on/);
});

test('on the Messages page its pin is white too: Torn marks the wrapper round that icon, and an open list is no page', () => {
  const p = load({ stored: ['/messages.php', '/gym.php', TARGETS] });
  p.document.getElementById('nav-messages').parentNode.classList.add('active___Xsu5j');
  p.tick();
  const [messages, gym, targets] = p.pins();
  assert.match(messages.className, /tdf-pin-on/);
  assert.doesNotMatch(gym.className, /tdf-pin-on/);
  assert.doesNotMatch(targets.className, /tdf-pin-on/);   // its row is activated___ (opened), not active___
});

test('counts are Torn\'s blue numbers at the top right of the icon', () => {
  const p = load({ stored: ['/events.php'] });
  p.tick();
  const badge = p.pins()[0].querySelector('.tdf-pin-badge'), c = (prop) => cascade(p.document, badge, prop);
  assert.equal(badge.parentNode.className, 'tdf-pin-row');
  assert.equal(c('color'), '#74c0fc');
  assert.equal(c('position'), 'absolute');
  assert.equal(c('top'), '-1px');
  assert.equal(c('right'), '-3px');
  assert.equal(c('font'), '700 10px/8px Arial,Helvetica,sans-serif');
});

test('in jail, in hospital and abroad the bar takes Torn\'s colours', () => {
  const bg = (opts) => { const p = load({ stored: ['/gym.php'], ...opts }); p.tick(); return [p, cascade(p.document, p.document.getElementById('tdf-pins'), 'background')]; };
  let [p, b] = bg({ panelClass: 'inJail___vh7Jg' });
  assert.equal(b, '#353526');
  assert.equal(cascade(p.document, p.pins()[0], 'color'), '#bdbdae');
  assert.equal(cascade(p.document, p.pins()[0].querySelector('svg'), 'fill'), 'url(#tdf-g-jail)');
  [, b] = bg({ panelClass: 'inJail___vh7Jg', body: 'class="dark-mode"' });
  assert.equal(b, '#242415');
  [p, b] = bg({ panelClass: 'inHospital___bjnEe' });
  assert.equal(b, '#3b3b3b');
  assert.equal(cascade(p.document, p.pins()[0], 'color'), '#ddd');
  assert.equal(cascade(p.document, p.pins()[0].querySelector('svg'), 'fill'), 'url(#tdf-g-hospital)');
  [, b] = bg({ body: 'data-abroad="true"' });
  assert.equal(b, '#26333f');
  [, b] = bg({ body: 'data-abroad="true"', panelClass: 'inHospital___bjnEe' });
  assert.equal(b, '#3b3b3b');
  const menu = MENU.replace(/defaultIcon___GnL0d mobile___nUzYc/g, 'defaultIcon___GnL0d mobile___nUzYc travel___VRg89');
  [p] = bg({ menu });
  assert.equal(cascade(p.document, p.pins()[0].querySelector('svg'), 'fill'), 'url(#tdf-g-travel)');
});

test('blue wins over the jail tint, icon and name alike, as on Torn\'s bar', () => {
  const p = load({ stored: ['/gym.php'], panelClass: 'inJail___vh7Jg' });
  p.document.getElementById('nav-gym').classList.add('attention___DT8nN');
  p.tick();
  const a = p.pins()[0];
  assert.equal(cascade(p.document, a.querySelector('svg'), 'fill'), 'url(#tdf-g-blue)');
  assert.equal(cascade(p.document, a.querySelector('svg'), 'filter'), 'drop-shadow(0 1px 1.3px #000)');
  assert.equal(cascade(p.document, a, 'color'), '#74c0fc');
});

// The name colour of each pin, for pins on Gym, Forums and Crimes, with Torn's classes
// added to their menu rows first.
function nameColours(opts, rows) {
  const p = load({ stored: ['/gym.php', '/forums.php', '/loader.php?sid=crimes'], ...opts });
  for (const [id, cls] of rows) p.document.getElementById(id).classList.add(...cls.split(' '));
  p.tick();
  return p.pins().map((a) => cascade(p.document, a, 'color'));
}

test('in jail or hospital only plain names take the tint: the page you are on stays white, a highlighted link blue', () => {
  // Gym: the page you are on. Forums: highlighted and the page you are on. Crimes: plain.
  const rows = [['nav-gym', 'active___t7hkr'], ['nav-forums', 'attention___DT8nN active___t7hkr']];
  assert.deepEqual(nameColours({ panelClass: 'inJail___vh7Jg' }, rows), ['#fff', '#d0ebff', '#bdbdae']);
  assert.deepEqual(nameColours({ panelClass: 'inHospital___bjnEe' }, rows), ['#fff', '#d0ebff', '#ddd']);
  assert.deepEqual(nameColours({ panelClass: 'inHospital___bjnEe' }, [['nav-forums', 'attention___DT8nN']]), ['#ddd', '#74c0fc', '#ddd']);
});

test('abroad, plain names take Torn\'s travel blue-grey, with the same exceptions; in hospital abroad, hospital wins', () => {
  const rows = [['nav-gym', 'active___t7hkr'], ['nav-forums', 'attention___DT8nN']];
  assert.deepEqual(nameColours({ body: 'data-abroad="true"' }, rows), ['#fff', '#74c0fc', '#8fa6bc']);
  assert.deepEqual(nameColours({ body: 'data-abroad="true"', panelClass: 'inHospital___bjnEe' }, []), ['#ddd', '#ddd', '#ddd']);
  assert.deepEqual(nameColours({}, []), ['#999', '#999', '#999']);
});

test('the bar follows the player\'s status live: out of jail, back to Torn\'s grey', () => {
  const p = load({ stored: ['/gym.php'], panelClass: 'inJail___vh7Jg' });
  p.tick();
  assert.match(p.document.getElementById('tdf-pins').className, /tdf-pins-jail/);
  p.panel.classList.remove('inJail___vh7Jg');
  p.mutate();
  const row = p.document.getElementById('tdf-pins');
  assert.doesNotMatch(row.className, /tdf-pins-jail/);
  assert.equal(cascade(p.document, row, 'background'), '#333');
  assert.doesNotMatch(p.pins()[0].className, /tdf-pin-jail/);
});

test('Icons only hides the names under the pins, as it does in the menu', () => {
  const on = load({ stored: ['/gym.php'], iconsOnly: true });
  on.tick();
  assert.equal(cascade(on.document, on.pins()[0].querySelector('.tdf-pin-name'), 'display'), 'none');
  const off = load({ stored: ['/gym.php'] });
  off.tick();
  assert.notEqual(cascade(off.document, off.pins()[0].querySelector('.tdf-pin-name'), 'display'), 'none');
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
  assert.equal(m.querySelector('.tdf-pin-name').textContent, 'Messages');
  assert.match(g.className, /tdf-pin-attn/);
});

// The spacer measures the page: give #sidebar, the content and the row the sizes a phone would.
function layout(p, { sidebarBottom, contentTop, rowHeight }) {
  p.document.getElementById('sidebar').getBoundingClientRect = () => ({ top: 36, bottom: sidebarBottom });
  p.document.querySelector('.content-wrapper').getBoundingClientRect = () => ({ top: contentTop, bottom: contentTop + 500 });
  Object.defineProperty(p.document.getElementById('tdf-pins'), 'offsetHeight', { value: rowHeight, configurable: true });
}
const spacer = (p) => p.document.getElementById('tdf-pins-spacer');

test('when the page content stays put under the row, a spacer of the row\'s height makes room', () => {
  const p = load({ stored: ['/gym.php'] });
  p.tick();
  layout(p, { sidebarBottom: 136, contentTop: 96, rowHeight: 40 });   // the strip ended at 96 before the row
  p.tick();
  const sp = spacer(p);
  assert.ok(sp, 'spacer added');
  assert.equal(sp.parentNode.className, 'content-wrapper');
  assert.equal(sp.parentNode.firstChild, sp);
  assert.match(sp.getAttribute('style'), /^height:\s*40px;?$/);
});

test('when the page content moves down for the row by itself, no spacer is added', () => {
  const p = load({ stored: ['/gym.php'] });
  p.tick();
  layout(p, { sidebarBottom: 136, contentTop: 136, rowHeight: 40 });
  p.tick();
  assert.equal(spacer(p), null);
});

test('the spacer never grows past the row\'s own height', () => {
  const p = load({ stored: ['/gym.php'] });
  p.tick();
  layout(p, { sidebarBottom: 400, contentTop: 96, rowHeight: 40 });
  p.tick();
  assert.match(spacer(p).getAttribute('style'), /^height:\s*40px;?$/);
});

test('the spacer is measured part-way down the page too: a row that grows while scrolled gets more room', () => {
  // Torn's header and sidebar scroll with the page (its menu only fixes itself to the
  // screen once the header has gone), so the gap reads the same at any scroll.
  const p = load({ stored: ['/gym.php'] });
  p.tick();
  layout(p, { sidebarBottom: 136, contentTop: 96, rowHeight: 40 });
  p.tick();
  p.win.scrollY = 300;
  layout(p, { sidebarBottom: -128, contentTop: -204, rowHeight: 76 });   // a second line of pins
  p.tick();
  assert.match(spacer(p).getAttribute('style'), /^height:\s*76px;?$/);
});

test('a page that opens already scrolled down still gets its spacer', () => {
  const p = load({ stored: ['/gym.php'] });
  p.win.scrollY = 500;
  p.tick();
  layout(p, { sidebarBottom: -364, contentTop: -404, rowHeight: 40 });
  p.tick();
  assert.ok(spacer(p), 'spacer added');
  assert.match(spacer(p).getAttribute('style'), /^height:\s*40px;?$/);
});

test('a spacer Torn wipes with the page content comes back, even part-way down the page', () => {
  const p = load({ stored: ['/gym.php'] });
  p.tick();
  layout(p, { sidebarBottom: 136, contentTop: 96, rowHeight: 40 });
  p.tick();
  spacer(p).remove();
  p.win.scrollY = 300;
  p.tick();
  assert.match(spacer(p).getAttribute('style'), /^height:\s*40px;?$/);
});

test('the spacer stays the first thing in the page content when Torn puts something ahead of it', () => {
  const p = load({ stored: ['/gym.php'] });
  p.tick();
  layout(p, { sidebarBottom: 136, contentTop: 96, rowHeight: 40 });
  p.tick();
  const content = p.document.querySelector('.content-wrapper');
  content.insertAdjacentHTML('afterbegin', '<div class="info-msg">A banner</div>');
  p.tick();
  assert.equal(content.firstChild, spacer(p));
  assert.equal(p.document.querySelectorAll('#tdf-pins-spacer').length, 1);
});

test('the cog panel\'s pin list gives each icon a layer of its own, as the menu does', () => {
  // The list scrolls, and WebKit leaves shadowed icons blank when they scroll into
  // view without one: the same paint bug 1.5.16 fixed in the menu.
  const p = load({ stored: ['/gym.php'] });
  const settings = p.openCog();
  const icons = [...settings.querySelectorAll('.tdf-pins-list .tdf-pin-icon svg')];
  assert.equal(icons.length, 7);
  for (const svg of icons) assert.match(cascade(p.document, svg, 'transform') || '', /translateZ\(0\)/);
  assert.match(cascade(p.document, p.pins()[0].querySelector('svg'), 'transform') || '', /translateZ\(0\)/);
});

test('a pin that could not be saved is not left looking ticked, and the list says why', () => {
  const p = load({ failSave: true });
  const settings = p.openCog();
  p.tickBox('/gym.php', true);
  assert.equal(settings.querySelector('input[data-key="/gym.php"]').checked, false);
  assert.equal(p.document.getElementById('tdf-pins'), null);
  assert.match(settings.querySelector('.tdf-pins-err').textContent, /Could not save/);
});

test('with nothing pinned, the timer does not even read the menu', () => {
  const p = load();
  let reads = 0;
  const qsa = p.panel.querySelectorAll;
  p.panel.querySelectorAll = function (...a) { reads++; return qsa.apply(this, a); };
  p.tick(); p.mutate();
  assert.equal(reads, 0);
});

test('the row follows every change in the menu: the observer watches the panel, its subtree, text, classes and labels', () => {
  const p = load({ stored: ['/gym.php'] });
  p.tick();
  const o = p.observers.find((x) => x.target === p.panel);
  assert.ok(o, 'an observer on #fly-out-panel');
  assert.equal(o.opts.subtree, true);
  assert.equal(o.opts.childList, true);
  assert.equal(o.opts.characterData, true);
  assert.deepEqual([...o.opts.attributeFilter].sort(), ['aria-label', 'class']);
});

test('the cog panel\'s pin list scrolls inside half the screen', () => {
  const p = load();
  const list = p.openCog().querySelector('.tdf-pins-list');
  const css = styledBy(p.document, list);
  assert.equal(css['max-height'], '50vh');
  assert.equal(css['overflow-y'], 'auto');
});

test('a pin reads the way Torn\'s own link does: "Events, 4 new"', () => {
  const p = load({ stored: ['/events.php', '/gym.php'] });
  p.tick();
  assert.deepEqual(p.pins().map((a) => a.getAttribute('aria-label')), ['Events, 4 new', 'Gym']);
});

test('a pin with no icon keeps its name with Icons only on, so it is never an empty box', () => {
  const menu = MENU.replace(/<svg id="forums-icon"[\s\S]*?<\/svg>/, '');
  const p = load({ stored: ['/forums.php', '/gym.php'], iconsOnly: true, menu });
  p.tick();
  const [forums, gym] = p.pins();
  assert.match(forums.className, /tdf-pin-noicon/);
  assert.notEqual(cascade(p.document, forums.querySelector('.tdf-pin-name'), 'display'), 'none');
  assert.equal(cascade(p.document, gym.querySelector('.tdf-pin-name'), 'display'), 'none');
});

test('a long press on a pin does not select its name', () => {
  const p = load({ stored: ['/gym.php'] });
  p.tick();
  assert.equal(cascade(p.document, p.pins()[0], 'user-select'), 'none');
  assert.equal(cascade(p.document, p.pins()[0], '-webkit-user-select'), 'none');
});

test('unpinning the last link takes the spacer away with the row', () => {
  const p = load({ stored: ['/gym.php'] });
  p.tick();
  layout(p, { sidebarBottom: 136, contentTop: 96, rowHeight: 40 });
  p.tick();
  assert.ok(spacer(p), 'spacer there to begin with');
  p.openCog();
  p.tickBox('/gym.php', false);
  assert.equal(p.document.getElementById('tdf-pins'), null);
  assert.equal(spacer(p), null);
});

// ---- Pinned links leave the menu ----------------------------------------------
const hidden = (p, el) => cascade(p.document, el, 'display') === 'none';
const wrapOf = (p, id) => p.document.getElementById(id).parentNode;   // the account icon's own box

test('a pinned link leaves the menu: its row is hidden, the others stay', () => {
  const p = load({ stored: ['/gym.php', TARGETS] });
  p.tick();
  assert.ok(hidden(p, p.document.getElementById('nav-gym')));
  assert.ok(hidden(p, p.document.getElementById('nav-targets_list')));
  for (const id of ['nav-crimes', 'nav-forums']) assert.ok(!hidden(p, p.document.getElementById(id)), id);
  assert.ok(!hidden(p, p.panel));
});

test('pinned Messages / Events / Awards icons leave the menu\'s icon bar one by one', () => {
  const p = load({ stored: ['/messages.php'] });
  p.tick();
  assert.ok(hidden(p, wrapOf(p, 'nav-messages')));
  assert.ok(!hidden(p, wrapOf(p, 'nav-events')));
  assert.ok(!hidden(p, p.document.querySelector('[class*="accountLinksWrap___"]')));
});

test('with all three icons pinned the empty icon bar goes too, even with Icons only on; unpin one and it is back', () => {
  for (const iconsOnly of [false, true]) {
    const p = load({ stored: ['/messages.php', '/events.php', '/awards.php'], iconsOnly });
    p.tick();
    const bar = p.document.querySelector('[class*="accountLinksWrap___"]');
    assert.ok(hidden(p, bar), `icons only ${iconsOnly}`);
    p.openCog();
    p.tickBox('/events.php', false);
    assert.ok(!hidden(p, bar), `bar back, icons only ${iconsOnly}`);
    assert.ok(!hidden(p, wrapOf(p, 'nav-events')));
    assert.ok(hidden(p, wrapOf(p, 'nav-messages')));
  }
});

test('unpinning brings the link straight back to the menu', () => {
  const p = load({ stored: ['/gym.php'] });
  p.tick();
  p.openCog();
  p.tickBox('/gym.php', false);
  assert.ok(!hidden(p, p.document.getElementById('nav-gym')));
});

test('pinned links are hidden before Torn draws the menu, so they never flash up in it', () => {
  const p = load({ stored: ['/gym.php'], menu: '' });
  p.tick();
  p.panel.innerHTML = MENU;   // Torn draws the menu; no tick or observer has run yet
  assert.ok(hidden(p, p.document.getElementById('nav-gym')));
  assert.ok(!hidden(p, p.document.getElementById('nav-crimes')));
});

test('without the row (no bars strip on this page), the menu keeps every link', () => {
  const p = load({ stored: ['/gym.php', '/messages.php'], strip: false });
  p.tick();
  assert.equal(p.document.getElementById('tdf-pins'), null);
  assert.ok(!hidden(p, p.document.getElementById('nav-gym')));
  assert.ok(!hidden(p, wrapOf(p, 'nav-messages')));
});

test('a stored value with quotes or braces hides nothing but its own link', () => {
  const p = load({ stored: ['/x"]{}#fly-out-panel *{display:none}\\', '/gym.php'], menu: '' });
  p.tick();
  p.panel.innerHTML = MENU;
  assert.ok(hidden(p, p.document.getElementById('nav-gym')));
  for (const el of p.panel.querySelectorAll('*')) {
    if (el.closest('#nav-gym')) continue;
    assert.ok(!hidden(p, el), el.id || el.className);
  }
});
