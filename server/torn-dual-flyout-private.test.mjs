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

// Torn's three-bar menu button (tC in the sidebar build): while any Messages / Events /
// Awards are unread it is green, with their total (capped at 99) in a span.
function menuButtonHtml(n) {
  return `<button class="menuButton___uV5dz top_header_button${n > 0 ? ' green' : ''}" type="button" aria-label="Show sidebar" aria-controls="fly-out-panel" aria-expanded="false" id="fly-out-menu-button">` +
    '<svg id="menu-icon" width="24" height="24" viewBox="0 0 24 24"><path d="M20 18H4v-2h16v2zm0-5H4v-2h16v2zm0-5H4V6h16v2z"/></svg>' +
    (n > 0 ? `<span class="notificationsAmount___zGHim">${n}</span>` : '') + '</button>';
}
// The total that button shows for a menu: what the account links' labels say is new.
function unreadTotal(menu) {
  let n = 0;
  for (const [, c] of menu.matchAll(/aria-label="(?:Messages|Events|Awards), (\d+) new"/g)) n += +c;
  return Math.min(n, 99);
}
// Torn's unread counts change, in one React commit: each Messages / Events / Awards link
// named takes its new count the way Torn draws it (tK: positive___, the aria-label with
// the full number, the amount shortened by Torn's own rule), and the button follows.
const ACCOUNT = { messages: 'Messages', events: 'Events', awards: 'Awards' };
function tornAmount(n) {
  if (n < 1000) return String(n);
  if (n > 99000) return '99k';
  let t = Math.floor(n / 100) / 10;
  if (n > 10000) t = Math.floor(t);
  return `${t}k`;
}
function setUnread(document, counts) {
  for (const [id, n] of Object.entries(counts)) {
    const a = document.getElementById(`nav-${id}`);
    a.classList.toggle('positive___Jcxif', n > 0);
    a.setAttribute('aria-label', ACCOUNT[id] + (n > 0 ? `, ${n} new` : ''));
    let amount = a.querySelector('.amount___vyASa');
    if (n > 0 && !amount) { amount = document.createElement('span'); amount.className = 'amount___vyASa'; a.appendChild(amount); }
    if (n > 0) amount.textContent = tornAmount(n); else if (amount) amount.remove();
  }
  let total = 0;
  for (const id of Object.keys(ACCOUNT)) total += +(/, (\d+) new$/.exec(document.getElementById(`nav-${id}`).getAttribute('aria-label')) || [0, 0])[1];
  tornButton(document, Math.min(total, 99));
}
// What Torn's React does to the button for a new total: it rewrites the class only when
// the class it renders changes (React compares with its own last render, not with the
// page), and adds, updates or removes the count.
function tornButton(document, n) {
  const btn = document.getElementById('fly-out-menu-button');
  const cls = 'menuButton___uV5dz top_header_button' + (n > 0 ? ' green' : '');
  if (btn.__tornClass !== cls) { btn.setAttribute('class', cls); btn.__tornClass = cls; }
  let span = btn.querySelector('.notificationsAmount___zGHim');
  if (n > 0 && !span) { span = document.createElement('span'); span.className = 'notificationsAmount___zGHim'; btn.appendChild(span); }
  if (n > 0) span.textContent = String(n); else if (span) span.remove();
}

// A Torn page on a phone: header with the menu button, #sidebar holding the fly-out
// panel and the name/bars strip, then the page content. strip: false is a page with
// no phone strip (desktop, or Torn's top-bar mode); body adds attributes to <body>
// (dark mode, abroad); panelClass adds Torn's status classes to the panel.
function page(menu, { strip = true, body = '', panelClass = '' } = {}) {
  return `<html><head></head><body ${body}>
    <div id="header-root"><div id="header-wrapper-top" class="header-wrapper-top">${menuButtonHtml(unreadTotal(menu))}</div></div>
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
// sessionStorage. strip, body, panelClass: see page(). width: the screen's width.
// unread: Messages / Events / Awards counts the page opens with ({ messages: 1 }).
// drawn: how much of Torn's page there is when the script starts. 'all': all of it.
// 'header': Torn's header app has drawn #header-wrapper-top, but its sidebar app has not
// yet drawn the menu button into it or #sidebar into #sidebarroot. 'none': document-start,
// before even Torn's page source. drawPage(), drawHeader() and drawSidebar() bring the
// parts in as Torn draws them, Torn's counts already in them.
function load({ order = 'private', stored = null, iconsOnly = false, menu = MENU, failSave = false,
  session = null, strip = true, body = '', panelClass = '', width = 393, unread = null, drawn = 'all' } = {}) {
  const { document, Event } = parseHTML(page(menu, { strip, body, panelClass }));
  const btn = document.getElementById('fly-out-menu-button');
  btn.getClientRects = () => [{}];   // laid out: the phone header is showing
  btn.__tornClass = btn.getAttribute('class');   // what Torn's React last rendered
  const panel = document.getElementById('fly-out-panel');
  btn.__reactProps$tdfp = { onClick() { panel.classList.toggle('visible___AnarB'); } };
  if (unread) setUnread(document, unread);
  const parts = {};
  if (drawn !== 'all') {
    parts.btn = btn; parts.sidebar = document.getElementById('sidebar');
    btn.remove(); parts.sidebar.remove();
  }
  if (drawn === 'none') {
    parts.top = document.getElementById('header-wrapper-top'); parts.top.remove();
    parts.source = [...document.body.childNodes]; parts.source.forEach((n) => n.remove());
  }
  const drawPage = () => parts.source.forEach((n) => document.body.appendChild(n));
  const drawHeader = () => document.getElementById('header-root').appendChild(parts.top);
  const drawSidebar = () => {
    document.getElementById('header-wrapper-top').appendChild(parts.btn);
    document.getElementById('sidebarroot').appendChild(parts.sidebar);
  };

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
  // Records what each observer was told to watch (target and opts: the last thing). One
  // that is disconnected watches nothing and hears nothing more.
  class MO {
    constructor(cb) { this.cb = cb; this.watching = []; observers.push(this); }
    observe(target, opts) { this.target = target; this.opts = opts; this.watching.push({ target, opts }); }
    disconnect() { this.watching = []; this.target = null; if (observers.includes(this)) observers.splice(observers.indexOf(this), 1); }
  }
  const winOn = {};
  const win = { innerWidth: width, addEventListener(type, fn) { (winOn[type] = winOn[type] || []).push(fn); } };
  const fire = (type) => (winOn[type] || []).forEach((fn) => fn(new Event(type)));
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
  // Torn changed something somewhere: every observer runs, then every timer. That is more
  // than a browser would run, so it only shows that nothing changes, or sets a page up. To
  // show that a change is followed, name what Torn changed with commit(), then flush().
  const mutate = () => { observers.slice().forEach((o) => o.cb([])); flush(); };
  // Torn's React has just committed a change to the children, class or text of the nodes
  // named. Only the observers that would hear of it run, as in a browser, before the page
  // is painted again and before any timer: one watching that node, or a node it is inside
  // with subtree. A callback that disconnects another before its turn has it hear nothing.
  const commit = (...changed) => {
    const hears = (o) => o.watching.some(({ target, opts }) => changed.some((n) => target === n || (opts.subtree && target.contains(n))));
    observers.filter(hears).forEach((o) => { if (o.watching.length) o.cb([]); });
  };
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
  return { document, win, store, touch, tick, mutate, commit, fire, flush, pins, openCog, tickBox, panel, observers,
    drawPage, drawHeader, drawSidebar };
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
  assert.equal(field(h, 'version'), '1.6.4');
  assert.equal(field(h, 'author'), 'RussianRob');
  assert.equal(field(h, 'license'), 'All Rights Reserved');
  assert.equal(field(h, 'downloadURL'), 'https://tornwar.com/scripts/torn-dual-flyout-private.user.js');
  assert.equal(field(h, 'updateURL'), 'https://tornwar.com/scripts/torn-dual-flyout-private.meta.js');
  assert.equal(field(h, 'grant'), 'none');
  assert.equal(field(h, 'copyright'), null);
  assert.equal(load().win.__tdfVer, '1.6.4');
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
  assert.equal(p.win.__tdfVer, '1.6.4');
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
  assert.deepEqual(stops('green'), ['#AFC372', '#798D3C']);
  assert.deepEqual(stops('hospital-green'), ['#C9DD8C', '#9BBD36']);
});

test('a pin shows the menu\'s unread count, but not the size of a list', () => {
  const p = load({ stored: ['/events.php', TARGETS] });
  p.tick();
  const [events, targets] = p.pins();
  assert.equal(events.querySelector('.tdf-pin-badge').textContent, '4');
  assert.equal(events.querySelector('.tdf-pin-name').textContent, 'Events');   // not "Events, 4 new"
  assert.equal(targets.querySelector('.tdf-pin-badge'), null);
});

test('pins share a line the way Torn\'s bar shares it, from the left; the rest wrap onto the next line, and nothing scrolls sideways', () => {
  const p = load({ stored: ['/gym.php'] });
  p.tick();
  const row = p.document.getElementById('tdf-pins'), pin = p.pins()[0];
  assert.equal(cascade(p.document, row, 'display'), 'flex');
  assert.equal(cascade(p.document, row, 'flex-wrap'), 'wrap');
  assert.equal(cascade(p.document, row, 'justify-content'), 'flex-start');
  for (const prop of ['overflow', 'overflow-x']) assert.doesNotMatch(cascade(p.document, row, prop) || '', /auto|scroll/);
  for (const prop of ['flex', 'width', 'max-width']) assert.match(cascade(p.document, pin, prop) || '', /calc\(100% \/ var\(--tdf-cols, 9\)\)/, prop);
  assert.equal(row.style.getPropertyValue('--tdf-cols'), '9');   // a 393px phone: nine to a line
});

test('how many pins fit on a line follows Torn\'s own table for the screen width, and follows a turn of the phone', () => {
  const cols = (width) => { const p = load({ stored: ['/gym.php'], width }); p.tick(); return p.document.getElementById('tdf-pins').style.getPropertyValue('--tdf-cols'); };
  assert.deepEqual([320, 358, 375, 393, 400, 401, 414, 430, 450, 451, 768, 1024].map(cols), ['8', '8', '9', '9', '9', '10', '10', '10', '10', '11', '17', '20']);
  const p = load({ stored: ['/gym.php'] });
  p.tick();
  p.win.innerWidth = 430;   // turned, or a bigger phone's width settling
  p.tick();
  assert.equal(p.document.getElementById('tdf-pins').style.getPropertyValue('--tdf-cols'), '10');
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

test('an area\'s count is Torn\'s blue number at the top right of the icon', () => {
  const jail = areaRow('jail', '/jail.php', 'Jail').replace('Jail</span>', 'Jail</span><span class="amount___vyASa">12</span>');
  const menu = MENU.replace(areaRow('forums', '/forums.php', 'Forums'), areaRow('forums', '/forums.php', 'Forums') + jail);
  const p = load({ stored: ['/jail.php'], menu });
  p.tick();
  const badge = p.pins()[0].querySelector('.tdf-pin-badge'), c = (prop) => cascade(p.document, badge, prop);
  assert.equal(badge.parentNode.className, 'tdf-pin-row');
  assert.equal(c('color'), '#74c0fc');
  assert.equal(c('position'), 'absolute');
  assert.equal(c('top'), '-1px');
  assert.equal(c('right'), '-3px');
  assert.equal(c('font'), '700 10px/8px Arial,Helvetica,sans-serif');
});

test('an unread Messages / Events / Awards pin is Torn\'s green: name, count and icon; a read one stays grey', () => {
  const p = load({ stored: ['/events.php', '/messages.php'] });
  p.tick();
  const [events, messages] = p.pins(), c = (el, prop) => cascade(p.document, el, prop);
  assert.match(events.className, /tdf-pin-avail/);
  assert.equal(c(events, 'color'), '#85b200');
  assert.equal(c(events.querySelector('.tdf-pin-badge'), 'color'), '#85b200');
  assert.equal(c(events.querySelector('svg'), 'fill'), 'url(#tdf-g-green)');
  assert.equal(c(events.querySelector('svg'), 'filter'), 'drop-shadow(0 0 1.2px rgba(133,178,0,.44))');
  assert.doesNotMatch(messages.className, /tdf-pin-avail/);
  assert.equal(c(messages, 'color'), '#999');
  // Torn marks Messages unread: green on the next redraw.
  p.document.getElementById('nav-messages').classList.add('positive___Jcxif');
  p.commit(p.document.getElementById('nav-messages')); p.flush();
  assert.match(p.pins()[1].className, /tdf-pin-avail/);
});

test('an unread pin stays green in jail and abroad, takes Torn\'s lighter green in hospital, and is white on its own page', () => {
  // Name colour, icon fill, icon shadow and count colour of a pinned Events with 4 new.
  const ev = (opts, before) => {
    const p = load({ stored: ['/events.php'], ...opts });
    if (before) before(p);
    p.tick();
    const a = p.pins()[0], svg = a.querySelector('svg');
    return [cascade(p.document, a, 'color'), cascade(p.document, svg, 'fill'), cascade(p.document, svg, 'filter'), cascade(p.document, a.querySelector('.tdf-pin-badge'), 'color')];
  };
  const green = ['url(#tdf-g-green)', 'drop-shadow(0 0 1.2px rgba(133,178,0,.44))'];
  assert.deepEqual(ev({ panelClass: 'inJail___vh7Jg' }), ['#85b200', ...green, '#85b200']);
  assert.deepEqual(ev({ body: 'data-abroad="true"' }), ['#85b200', ...green, '#85b200']);
  assert.deepEqual(ev({ panelClass: 'inHospital___bjnEe' }), ['#a3d900', 'url(#tdf-g-hospital-green)', 'none', '#85b200']);
  const travel = MENU.replace(/defaultIcon___GnL0d mobile___nUzYc/g, 'defaultIcon___GnL0d mobile___nUzYc travel___VRg89');
  assert.deepEqual(ev({ menu: travel, body: 'data-abroad="true"' }), ['#85b200', 'url(#tdf-g-hospital-green)', 'none', '#85b200']);
  // On the Events page Torn shows the page you are on instead: white, with a blue count.
  assert.deepEqual(ev({}, (p) => p.document.getElementById('nav-events').parentNode.classList.add('active___Xsu5j')),
    ['#fff', 'url(#tdf-g-regular-on)', 'drop-shadow(0 0 1px rgba(255,255,255,.5))', '#74c0fc']);
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
  p.commit(p.panel); p.flush();
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
  p.commit(msg, p.document.getElementById('nav-gym')); p.flush();   // Torn re-drew the menu; no timer tick yet
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

test('a pin that could not be saved is not left looking ticked, and a note above the list says why', () => {
  const p = load({ failSave: true });
  const settings = p.openCog();
  p.tickBox('/gym.php', true);
  p.tickBox('/forums.php', true);
  assert.equal(settings.querySelector('input[data-key="/gym.php"]').checked, false);
  assert.equal(p.document.getElementById('tdf-pins'), null);
  const notes = settings.querySelectorAll('.tdf-pins-err');
  assert.equal(notes.length, 1);   // one note, however many ticks fail
  assert.match(notes[0].textContent, /Could not save/);
  // Above the list, not in it: the list scrolls, and a note at its top would be out of
  // sight after a tick further down.
  assert.ok(notes[0].nextElementSibling === settings.querySelector('.tdf-pins-list'), 'the note sits right above the list');
  p.openCog(); p.openCog();   // closed and opened again: a fresh list, no old note
  assert.equal(p.document.querySelectorAll('#tdf-settings .tdf-pins-err').length, 0);
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

// ---- The three-bar button ---------------------------------------------------------
// Torn's menu button counts every unread Message, Event and Award, and is green while
// there are any. One that is pinned is in the row, not behind the button, so while the
// row shows it the button counts only the ones still in the menu.
const menuBtn = (p) => p.document.getElementById('fly-out-menu-button');
const numOf = (p) => menuBtn(p).querySelector('[class*="notificationsAmount___"]');
const countShown = (p) => menuBtn(p).style.getPropertyValue('--tdf-count');   // the number drawn over Torn's ('' for none)
// The button as a page would compare it: its attributes, in any order (linkedom moves
// an attribute to the end when it is rewritten; a browser keeps its place), and contents.
const asDrawn = (p) => JSON.stringify([[...menuBtn(p).attributes].map((a) => [a.name, a.value]).sort(), menuBtn(p).innerHTML]);

test('with every unread link pinned, the three-bar button shows no number and no green', () => {
  const torn = load();                           // nothing pinned: Torn's own button says 4, in green
  assert.equal(numOf(torn).textContent, '4');
  assert.ok(menuBtn(torn).classList.contains('green'));
  const p = load({ stored: ['/events.php'] });   // Events, 4 new: all that is unread
  p.tick();
  assert.equal(menuBtn(p).classList.contains('green'), false);
  assert.equal(cascade(p.document, numOf(p), 'visibility'), 'hidden');
  assert.equal(countShown(p), '');
});

test('with some unread links pinned, the button counts only the ones still in the menu, and stays green', () => {
  const p = load({ stored: ['/messages.php'], unread: { messages: 1 } });   // Messages 1 pinned, Events 4 in the menu
  assert.equal(numOf(p).textContent, '5');
  p.tick();
  assert.ok(menuBtn(p).classList.contains('green'));
  assert.equal(cascade(p.document, numOf(p), 'visibility'), 'hidden');   // Torn's 5
  assert.equal(countShown(p), '"4"');
});

test('the button\'s number takes the place of Torn\'s, in Torn\'s own colour and size', () => {
  const p = load({ stored: ['/messages.php'], unread: { messages: 1 } });
  p.tick();
  const after = (prop) => cascade(p.document, numOf(p), prop, 'after');
  assert.equal(after('content'), 'var(--tdf-count)');
  assert.equal(after('visibility'), 'visible');
  assert.equal(after('position'), 'absolute');
  assert.equal(after('top'), '0');
  assert.equal(after('left'), '0');
  // Inherited from Torn's number: nothing of ours sets them.
  assert.equal(after('color'), undefined);
  assert.equal(after('font-size'), undefined);
});

test('with no Messages / Events / Awards in the row, the button is left as Torn drew it', () => {
  const jail = areaRow('jail', '/jail.php', 'Jail').replace('Jail</span>', 'Jail</span><span class="amount___vyASa">12</span>');
  const menu = MENU.replace(areaRow('forums', '/forums.php', 'Forums'), areaRow('forums', '/forums.php', 'Forums') + jail);
  // Nothing pinned; area and list pins; an area with a count of its own; and Events
  // pinned on a page with no row.
  for (const opts of [{}, { stored: ['/gym.php', TARGETS] }, { stored: ['/jail.php'], menu }, { stored: ['/events.php'], strip: false }]) {
    const torn = asDrawn(load({ ...opts, stored: null }));
    const p = load(opts);
    p.tick(); p.mutate();
    assert.equal(asDrawn(p), torn, JSON.stringify(opts.stored));
    assert.equal(cascade(p.document, numOf(p), 'visibility'), undefined);
  }
});

test('unpinning hands the button back to Torn exactly as Torn drew it, with the row or without it', () => {
  const torn = asDrawn(load());
  for (const stored of [['/events.php', '/gym.php'], ['/events.php']]) {
    const p = load({ stored });
    p.tick();
    assert.notEqual(asDrawn(p), torn);
    p.openCog();
    p.tickBox('/events.php', false);
    assert.equal(asDrawn(p), torn, JSON.stringify(stored));
    assert.equal(cascade(p.document, numOf(p), 'visibility'), undefined);
  }
});

test('the button follows the menu live: a new count, the green going when only pinned links are unread, and coming back', () => {
  const p = load({ stored: ['/messages.php'], unread: { messages: 1 } });
  p.tick();
  setUnread(p.document, { events: 6 }); p.commit(menuBtn(p), p.panel); p.flush();
  assert.equal(countShown(p), '"6"');
  setUnread(p.document, { events: 0 }); p.commit(menuBtn(p), p.panel); p.flush();   // only the pinned Messages is unread now
  assert.equal(menuBtn(p).classList.contains('green'), false);
  assert.equal(countShown(p), '');
  setUnread(p.document, { awards: 2 }); p.commit(menuBtn(p), p.panel); p.flush();   // an award comes in; Torn's button was green all along
  assert.ok(menuBtn(p).classList.contains('green'));
  assert.equal(countShown(p), '"2"');
});

test('a new unread for a pinned link does not light the button up, not even until the next timer', () => {
  const p = load({ stored: ['/events.php'] });
  p.tick();
  setUnread(p.document, { events: 0 }); p.mutate();   // the player reads their events
  setUnread(p.document, { events: 1 });               // and a new one comes in: Torn puts its green and number back
  assert.ok(menuBtn(p).classList.contains('green'));
  p.commit(menuBtn(p), p.panel);                      // in one commit, with the menu's Events link
  assert.equal(menuBtn(p).classList.contains('green'), false);
  assert.equal(cascade(p.document, numOf(p), 'visibility'), 'hidden');
  assert.equal(countShown(p), '');
});

test('like Torn\'s, the button\'s number stops at 99, counts in thousands included', () => {
  const p = load({ stored: ['/messages.php'], unread: { messages: 1, events: 1234 } });
  p.tick();
  assert.equal(p.document.querySelector('#nav-events .amount___vyASa').textContent, '1.2k');
  assert.equal(countShown(p), '"99"');
  const q = load({ stored: ['/messages.php'], unread: { messages: 1, events: 60, awards: 50 } });
  q.tick();
  assert.equal(countShown(q), '"99"');
});

test('a menu button Torn draws afresh is put right too, and watched like the first', () => {
  const p = load({ stored: ['/events.php'] });
  p.tick();
  const old = menuBtn(p);
  old.insertAdjacentHTML('afterend', menuButtonHtml(4));   // Torn's React mounts a new button
  old.remove();
  const fresh = menuBtn(p);
  fresh.getClientRects = () => [{}];
  fresh.__tornClass = fresh.getAttribute('class');
  assert.ok(fresh.classList.contains('green'));
  p.tick();
  assert.equal(fresh.classList.contains('green'), false);
  setUnread(p.document, { events: 0 }); p.mutate();
  setUnread(p.document, { events: 2 });
  p.commit(fresh, p.panel);
  assert.equal(fresh.classList.contains('green'), false);
});

test('the button is watched for all Torn\'s React rewrites on it: its class, its number coming and going, and the number\'s text', () => {
  const p = load({ stored: ['/messages.php'], unread: { messages: 1 } });
  p.tick();
  const o = p.observers.find((x) => x.target === menuBtn(p));
  assert.ok(o, 'an observer on the button');
  assert.deepEqual([...o.opts.attributeFilter], ['class']);
  assert.equal(o.opts.childList, true);
  assert.equal(o.opts.subtree, true);         // the number is a child of the button
  assert.equal(o.opts.characterData, true);   // and Torn rewrites its text when only the count changes
});

test('unpinning while nothing is unread hands back Torn\'s plain button: no green without Torn\'s number', () => {
  const torn = load();
  setUnread(torn.document, { events: 0 });            // Torn's own button with nothing unread
  const want = asDrawn(torn);
  const p = load({ stored: ['/events.php', '/gym.php'] });
  p.tick();
  setUnread(p.document, { events: 0 }); p.mutate();   // the player reads the pinned Events
  p.openCog();
  p.tickBox('/events.php', false);
  assert.equal(menuBtn(p).classList.contains('green'), false);
  assert.equal(asDrawn(p), want);
});

// ---- Torn drawing its header and sidebar --------------------------------------------
// Torn's sidebar app draws the menu button into the header's #header-wrapper-top and
// #sidebar into #sidebarroot, in one commit, a moment after the page starts. What the
// timer would put right is put right in that same moment, before the page is painted:
// Torn's own count on the button never shows, and the row comes in with Torn's header.
const byId = (p, id) => p.document.getElementById(id);

test('when Torn draws the menu button after the script starts, it is put right in that moment, not at the next tick', () => {
  const p = load({ stored: ['/events.php'], drawn: 'header' });   // Events, 4 new: all that is unread
  p.drawSidebar();
  assert.ok(menuBtn(p).classList.contains('green'));             // as Torn draws it
  p.commit(byId(p, 'header-wrapper-top'), byId(p, 'sidebarroot'));
  assert.equal(menuBtn(p).classList.contains('green'), false);
  assert.equal(cascade(p.document, numOf(p), 'visibility'), 'hidden');
  assert.equal(p.pins().length, 1, 'the row comes in with it');
  assert.ok(byId(p, 'tdf-cog'), 'and the cog');
});

test('a menu button Torn draws afresh is put right in that moment too', () => {
  const p = load({ stored: ['/events.php'] });   // no tick: watched from the start
  const old = menuBtn(p);
  old.insertAdjacentHTML('afterend', menuButtonHtml(4));   // Torn's React mounts a new button
  old.remove();
  const fresh = menuBtn(p);
  fresh.getClientRects = () => [{}];
  fresh.__tornClass = fresh.getAttribute('class');
  p.commit(byId(p, 'header-wrapper-top'));
  assert.equal(fresh.classList.contains('green'), false);
  assert.equal(cascade(p.document, numOf(p), 'visibility'), 'hidden');
});

test('from document-start, before Torn has even drawn its header, the button is put right the moment Torn draws it', () => {
  const p = load({ stored: ['/events.php'], drawn: 'none' });
  p.drawPage();                     // the page source: #header-root and #sidebarroot, both empty
  p.commit(p.document.body);
  p.drawHeader();                   // Torn's header app draws #header-wrapper-top
  p.commit(byId(p, 'header-root'));
  p.drawSidebar();
  p.commit(byId(p, 'header-wrapper-top'), byId(p, 'sidebarroot'));
  assert.equal(menuBtn(p).classList.contains('green'), false);
  assert.equal(p.pins().length, 1);
});

test('Torn drawing its header and its sidebar in one go is put right in that same moment', () => {
  const p = load({ stored: ['/events.php'], drawn: 'none' });
  p.drawPage(); p.drawHeader(); p.drawSidebar();   // all in one task
  p.commit(p.document.body, byId(p, 'header-root'), byId(p, 'header-wrapper-top'), byId(p, 'sidebarroot'));
  assert.equal(menuBtn(p).classList.contains('green'), false);
  assert.equal(p.pins().length, 1);
});

const watchesPage = (p) => p.observers.some((o) => o.watching.some((w) => w.target === p.document.documentElement));

test('once Torn\'s header and sidebar are there, only those two are watched, and only for their own children', () => {
  const p = load({ stored: ['/events.php'], drawn: 'none' });
  assert.ok(watchesPage(p), 'the whole page, until then');
  p.drawPage(); p.commit(p.document.body);
  assert.ok(watchesPage(p), 'still: Torn has not drawn its header yet');
  p.drawHeader(); p.commit(byId(p, 'header-root'));
  assert.equal(watchesPage(p), false);
  for (const id of ['header-wrapper-top', 'sidebarroot']) {
    assert.ok(p.observers.some((o) => o.watching.some((w) => w.target === byId(p, id) && JSON.stringify(w.opts) === '{"childList":true}')), id);
  }
});

test('when the script starts after Torn has drawn its header and sidebar, it never watches the whole page', () => {
  const p = load({ stored: ['/events.php'] });
  assert.equal(watchesPage(p), false);
});

test('on a page where Torn draws no header or sidebar, the whole-page watch stops once the page has loaded', () => {
  const p = load({ drawn: 'none' });
  assert.ok(watchesPage(p));
  p.fire('load');
  assert.equal(watchesPage(p), false);
});

test('a header Torn draws afresh is watched from the next tick', () => {
  const p = load({ stored: ['/events.php'] });
  p.tick();
  const old = byId(p, 'header-wrapper-top');   // Torn's header app draws a new one, menu button not yet in it
  old.insertAdjacentHTML('afterend', '<div id="header-wrapper-top" class="header-wrapper-top"></div>');
  old.remove();
  p.commit(byId(p, 'header-root'));
  p.tick();
  byId(p, 'header-wrapper-top').insertAdjacentHTML('beforeend', menuButtonHtml(4));   // then the sidebar app's new button
  const fresh = menuBtn(p);
  fresh.getClientRects = () => [{}];
  fresh.__tornClass = fresh.getAttribute('class');
  p.commit(byId(p, 'header-wrapper-top'));
  assert.equal(fresh.classList.contains('green'), false);
});

test('a sidebar Torn draws afresh has the row back in it in that moment', () => {
  const p = load({ stored: ['/events.php'] });
  const old = byId(p, 'sidebar'), fresh = old.cloneNode(true);
  fresh.querySelector('#tdf-pins').remove();   // Torn's own markup: no row in it
  old.after(fresh);
  old.remove();
  p.commit(byId(p, 'sidebarroot'));
  assert.equal(p.pins().length, 1);
  assert.ok(fresh.contains(byId(p, 'tdf-pins')));
});

test('the whole page stays watched until Torn has drawn both its header and #sidebarroot', () => {
  const p = load({ drawn: 'none' });
  p.document.body.insertAdjacentHTML('beforeend', '<div id="header-root"><div id="header-wrapper-top" class="header-wrapper-top"></div></div>');
  p.commit(p.document.body);
  assert.ok(watchesPage(p));
});

test('after a document-start load, the row follows the menu live, as on a page the script found already drawn', () => {
  const p = load({ stored: ['/events.php', '/gym.php'], drawn: 'none' });
  p.drawPage(); p.commit(p.document.body);
  p.drawHeader(); p.commit(byId(p, 'header-root'));
  p.drawSidebar(); p.commit(byId(p, 'header-wrapper-top'), byId(p, 'sidebarroot'));
  const gym = p.document.getElementById('nav-gym');
  gym.classList.add('attention___DT8nN');   // Torn tints Gym: a change inside the menu only
  p.commit(gym); p.flush();
  assert.match(p.pins()[1].className, /tdf-pin-attn/);
});
