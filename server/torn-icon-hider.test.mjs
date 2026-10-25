// Torn Icon Hider: choose which of Torn's status icons show in the sidebar row. These tests load
// the real script into hand-built Torn pages, with the clock, timers, GM storage, the menu, the
// console and the host (Torn PDA, the warboard app) under their control.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseHTML } from 'linkedom';

// TIH_SRC lets a mutant copy be tested in place of the served file.
const SRC = process.env.TIH_SRC || '/opt/warboard/server/public/scripts/torn-icon-hider.user.js';
const META = SRC.replace(/\.user\.js$/, '.meta.js');
const STYLES = 'tm-icon-hider-styles';
const BOX = 'tm-icon-hider-settings';
const MENU = 'Icon Hider: Settings';
const HELP = 'Untick an icon to hide it. Hidden icons stay in this list, so you can bring them back. '
  + 'A long press on any icon in the row opens these settings.';
const KEEP_ONE = 'Keep one icon showing: in Torn PDA, a long press on an icon is the only way back here.';
// The test clock: 2026-10-24 22:00 UTC, in Unix seconds.
const NOW = Date.UTC(2026, 9, 24, 22) / 1000;

// Torn's real class names for the icons used here, as each sidebar's stylesheet names them
// (from Torn's own files, saved in October 2026). Some have four underscores.
const FLY = { icon4: 'icon4___y6P08', icon5: 'icon5___L_2pk', icon6: 'icon6___R1xkN', icon8: 'icon8____Cehh',
  icon9: 'icon9___c8nOV', icon27: 'icon27___AH_kQ', icon49: 'icon49___iPumB', icon50: 'icon50___xzS1U',
  icon51: 'icon51___QDV4a', icon52: 'icon52____l66f', icon53: 'icon53___MXjcG', icon68: 'icon68___PDnPQ',
  icon74: 'icon74___Sgygm', icon81: 'icon81___isa6b', icon85: 'icon85___CyVUf' };
const OLD = { icon4: 'icon4___AaDeJ', icon5: 'icon5___dEHuC', icon6: 'icon6___rVWN7', icon8: 'icon8___QjLhg',
  icon9: 'icon9___ablCG', icon27: 'icon27___XQYNI', icon49: 'icon49___N4k4a', icon50: 'icon50___XF8N8',
  icon51: 'icon51___p_Tey', icon52: 'icon52___rwwcC', icon53: 'icon53___BpaFR', icon68: 'icon68___hg6nW',
  icon74: 'icon74___OLE9U', icon81: 'icon81___nugt3', icon85: 'icon85___yu0le' };

// Torn's sidebar data for the row: statusIcons.icons, one entry per icon, in the row's order.
// Keys and fields as Torn saves them; the names and details are made up.
const ICONS = {
  maleGender: { iconID: 'icon6', title: 'Male', subtitle: '', link: '#' },
  subscriber: { iconID: 'icon4', title: 'Subscriber', subtitle: '<b>30</b> days left', link: '/membership.php' },
  married: { iconID: 'icon8', title: 'Married', subtitle: 'To Example Spouse', link: '/profiles.php?XID=1' },
  faction: { iconID: 'icon74', title: 'Faction', subtitle: 'Leader of Example Faction', link: '/factions.php' },
  book: { iconID: 'icon68', title: 'Reading Book', subtitle: 'Example Book', link: '/page.php?sid=education' },
  drug_cooldown: { iconID: 'icon53', title: 'Drug Cooldown', subtitle: 'Xanax', link: '#', timerExpiresAt: NOW + 3600 },
};
const TITLES = ['Male', 'Subscriber', 'Married', 'Faction', 'Reading Book', 'Drug Cooldown'];
// The Blood Bag and Xanax Reminders' icons, first in the row: an id each and no icon class.
const BLOODBAG = 'tm-full-life-bloodbag';
const XANAX = 'tm-xanax-reminder';
const OURS = '<li id="' + BLOODBAG + '" style="background: none;"><a href="#" aria-label="Blood bag"><img src="b.png" width="17" height="17"></a></li>'
  + '<li id="' + XANAX + '"><a href="#" aria-label="Drug cooldown over: Xanax ready"><img src="x.png" width="17" height="17"></a></li>';

// Torn's li for one entry: the class named for its picture number (none when Torn has no class
// for it), and a link labelled with the title and the details as text.
function li(build, entry) {
  const label = entry.title + (entry.subtitle ? ': ' + entry.subtitle.replace(/<[^>]*>/g, '') : '');
  const cls = build[entry.iconID];
  return '<li' + (cls ? ' class="' + cls + '"' : '') + '><a href="' + (entry.link || '#') + '" aria-label="' + label
    + '" tabindex="0" data-is-tooltip-opened="false"></a></li>';
}

// Torn's sidebar in its four layouts, cut down to the row, inside React's root (#sidebarroot).
const LAYOUTS = {
  'Fly-out, phone': { build: FLY, html: (lis) => '<div id="sidebarroot"><div id="sidebar" class="sidebar___c4dEc mobile___fSMgm">'
    + '<div class="userInformationMobile___Aznrv"><div class="swiperWrapper___gaWYk"><div class="points-mobile___Zx867">$1.0M 1000</div>'
    + '<ul class="statusIcons___ks48M big___O1UVc mobile___IzEv7">' + lis + '</ul></div></div></div></div>' },
  'Fly-out, desktop': { build: FLY, html: (lis) => '<div id="sidebarroot"><div id="sidebar" class="sidebar___c4dEc desktop___F2V9S">'
    + '<div class="userInformation___Tkqft"><div><ul class="statusIcons___ks48M big___O1UVc">' + lis + '</ul>'
    + '<hr class="delimiter___nLMP8"></div></div></div></div>' },
  'old sidebar, phone': { build: OLD, html: (lis) => '<div id="sidebarroot"><div id="sidebar" class="sidebar___V9DPj">'
    + '<div class="user-information-mobile___I1ebJ"><div class="swiperWrapper____QQNn"><div class="points-mobile___FGMxg">$1.0M 1000</div>'
    + '<ul class="status-icons___sskG2 mobile___YGGsN big___IeUkB">' + lis + '</ul></div></div></div></div>' },
  'old sidebar, desktop': { build: OLD, html: (lis) => '<div id="sidebarroot"><div id="sidebar" class="sidebar___V9DPj">'
    + '<div class="user-information___LZ_gM"><div class="content___Ueeif"><div><ul class="status-icons___sskG2 big___IeUkB">' + lis + '</ul>'
    + '<hr class="delimiter___i8yeL"></div></div></div></div></div>' },
};
const DESKTOPS = ['Fly-out, desktop', 'old sidebar, desktop'];
const PHONES = ['Fly-out, phone', 'old sidebar, phone'];
// Torn's header menu, a list that comes before the sidebar on every page.
const HEADER = '<div id="header-wrapper-top"><ul class="menu-items"><li><a href="/">Home</a></li></ul></div>';
// Icons outside the sidebar, drawn with the row's own classes, as other parts of Torn draw them.
const TRAY = '<div id="tray"><ul class="statusIcons___ks48M small___cZqpf">' + li(FLY, ICONS.maleGender) + li(FLY, ICONS.drug_cooldown)
  + '</ul><ul class="status-icons___sskG2 big___IeUkB">' + li(OLD, ICONS.maleGender) + li(OLD, ICONS.drug_cooldown) + '</ul></div>';

// Torn's sidebar data, as both builds save it to sessionStorage.
function sidebarData(icons) {
  return JSON.stringify({ user: { name: 'Example' }, statusIcons: { visible: true, onTop: true, icons } });
}

// GM storage holding these kinds hidden, as the settings box saves them.
function hiding(...keys) {
  return { 'tih-hidden': JSON.stringify(keys) };
}

// A Torn page with the script on it. The test controls:
// - the clock (w.clock.ms), and timers (w.advance(ms) moves the clock and runs what is due);
// - the 2-second check (w.check() runs it once; the script runs it once itself on start);
// - GM storage (w.store; two pages given the same store share it, as tabs do), and how a write
//   goes (setValue);
// - Torn's sidebar data (icons, or data: null for none; w.setIcons() changes it and redraws the row
//   as Torn does);
// - the menu (w.menu), the console (w.logs), and the host: ua, pda (PDA's bridge) and warboard
//   (the warboard app's bridge).
// With start: true the script runs at document-start, before there is a <head> or a sidebar, and
// w.draw() adds them. w.reactSaw lists the clicks that reached React's root, #sidebarroot.
function page({ layout = 'Fly-out, phone', icons = ICONS, data, store = {}, clock = { ms: NOW * 1000 },
  src = readFileSync(SRC, 'utf8'), menu = true, setValue, ua = 'Mozilla/5.0 (iPhone)', pda = false,
  warboard = false, start = false } = {}) {
  const lay = LAYOUTS[layout];
  const rowHtml = (list) => OURS + Object.keys(list).filter((k) => list[k] && typeof list[k] === 'object')
    .map((k) => li(lay.build, list[k])).join('');
  const dom = parseHTML('<!doctype html><html><head></head><body></body></html>');
  const doc = dom.document;
  // As in a browser, document.head and document.body are null until the page has them (linkedom
  // would make them up).
  ['head', 'body'].forEach((tag) => Object.defineProperty(doc, tag, {
    configurable: true, get: () => doc.documentElement.querySelector(tag) }));
  const session = Object.create({ getItem(k) { return Object.prototype.hasOwnProperty.call(this, k) ? this[k] : null; } });
  const saved = data !== undefined ? data : sidebarData(icons);
  if (saved !== null) session.sidebarData137558 = saved;
  const timers = [];
  let timerId = 0;
  // linkedom has no capture phase, so the document's capture listeners are kept here and run
  // first by fire(), as a browser runs them.
  const captures = {};
  const add = doc.addEventListener.bind(doc);
  doc.addEventListener = (type, fn, opts) => {
    if (!(opts === true || (opts && opts.capture))) return add(type, fn, opts);
    (captures[type] = captures[type] || []).push({ fn, passive: !!(opts && opts.passive) });
  };
  const w = {
    document: doc, Event: dom.Event, store, clock, captures, menu: {}, logs: [], checks: [], pollMs: null, reactSaw: [],
    window: {},
    row: () => doc.querySelector('#sidebar ul'),
    box: () => doc.getElementById(BOX),
    // Torn's icon in the row with this title, or ours by id.
    icon: (name) => [...w.row().children].find((el) => el.id === name || labelOf(el) === name),
    // Draws the page: Torn's header, the sidebar and the icons elsewhere.
    draw() {
      if (!doc.head) doc.documentElement.appendChild(doc.createElement('head'));
      if (!doc.body) doc.documentElement.appendChild(doc.createElement('body'));
      doc.body.innerHTML = HEADER + lay.html(rowHtml(icons)) + TRAY;
      doc.getElementById('sidebarroot').addEventListener('click', (e) => w.reactSaw.push(e));
      return w;
    },
    // New sidebar data; Torn redraws the row from it, in the same list.
    setIcons(next) {
      session.sidebarData137558 = sidebarData(next);
      w.row().innerHTML = rowHtml(next);
    },
    // Torn replacing the whole row (a phone turning past the breakpoint, say).
    replaceRow() {
      const old = w.row();
      const ul = doc.createElement('ul');
      ul.className = old.className;
      ul.innerHTML = old.innerHTML;
      old.parentNode.replaceChild(ul, old);
      return ul;
    },
    check() { w.checks.forEach((fn) => fn()); },
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
      if (pda) w.window.flutter_inappwebview = { callHandler() {} };
      if (warboard) w.window.webkit = { messageHandlers: { gmBridge: { postMessage() {} } } };
      new Function('window', 'document', 'navigator', 'sessionStorage', 'GM_getValue', 'GM_setValue',
        'GM_registerMenuCommand', 'setInterval', 'setTimeout', 'clearTimeout', 'Date', 'Event', 'console', src)(
        w.window, doc, { userAgent: ua }, session,
        (k, d) => (Object.prototype.hasOwnProperty.call(store, k) ? store[k] : d),
        setValue ? (k, v) => setValue(store, k, v) : (k, v) => { store[k] = v; },
        menu ? (name, fn) => { if (menu === 'throws') throw new Error('no menu here'); w.menu[name] = fn; } : undefined,
        (fn, ms) => { w.checks.push(fn); w.pollMs = ms; return w.checks.length; },
        (fn, ms) => { timers.push({ id: ++timerId, at: clock.ms + (ms || 0), fn }); return timerId; },
        (id) => { const i = timers.findIndex((t) => t.id === id); if (i >= 0) timers.splice(i, 1); },
        { now: () => clock.ms },
        dom.Event,
        { log: (...a) => w.logs.push(a.join(' ')), warn: (...a) => w.logs.push(a.join(' ')), error: (...a) => w.logs.push(a.join(' ')) });
      return w;
    },
  };
  if (start) {
    // document-start: an <html> with nothing in it yet.
    doc.head.remove();
    doc.body.remove();
  } else {
    w.draw();
  }
  return w;
}

// Fires a DOM event at el, with extra fields (touches, button, relatedTarget, key, cancelable),
// and returns it, so a test can see whether the script cancelled or stopped it. The document's
// capture listeners run first, as in a browser: stopPropagation there keeps the event from the
// target and from React's root, and preventDefault does nothing in a passive listener.
function fire(w, el, type, fields = {}) {
  const e = new w.Event(type, { bubbles: true, cancelable: fields.cancelable !== false });
  Object.assign(e, fields);
  e.target = el;
  for (const listener of w.captures[type] || []) {
    if (listener.passive) e.preventDefault = () => {};
    listener.fn.call(w.document, e);
    delete e.preventDefault;
    if (e._stopImmediatePropagationFlag) break;
  }
  if (!e.cancelBubble) el.dispatchEvent(e);
  return e;
}

// A row icon's name: ours by id, Torn's by the title in its label.
function labelOf(el) {
  return el.id || el.querySelector('a').getAttribute('aria-label').split(':')[0];
}

// The selectors of the script's rules that hold this declaration (display: none, say).
function rulesWith(w, declaration) {
  const style = w.document.getElementById(STYLES);
  if (!style) return [];
  return style.textContent.split('}').filter((rule) => rule.includes(declaration)).map((rule) => rule.split('{')[0].trim());
}

// Every element on the page that a rule with this declaration applies to.
function matching(w, declaration) {
  return new Set(rulesWith(w, declaration).flatMap((selector) => [...w.document.querySelectorAll(selector)]));
}

// The names of the row's icons that show, in order.
function showing(w) {
  const gone = matching(w, 'display: none');
  return [...w.row().children].filter((el) => !gone.has(el)).map(labelOf);
}

// What the script has learned, as stored.
function kindsIn(store) {
  return JSON.parse(store['tih-kinds']);
}

// The settings box's lines: { name, on, pos } for each switch, and the group headings and
// other text in order.
function lines(w) {
  return [...w.box().querySelectorAll('label')].map((line) => ({
    name: line.textContent.trim(),
    on: line.querySelector('input').checked,
    pos: line.querySelector('.tm-tih-pic').getAttribute('style'),
  }));
}

// A button of the settings box, by its words.
function boxButton(w, words) {
  return [...w.box().querySelectorAll('button')].find((b) => b.textContent === words);
}

// The settings box's switch for this title.
function boxSwitch(w, name) {
  return [...w.box().querySelectorAll('label')].find((line) => line.textContent.trim() === name).querySelector('input');
}

// Counts writes to the stylesheet's text from now on.
function countWrites(w) {
  const style = w.document.getElementById(STYLES);
  let proto = style;
  let desc = null;
  while (proto && !desc) {
    desc = Object.getOwnPropertyDescriptor(proto, 'textContent');
    proto = Object.getPrototypeOf(proto);
  }
  const count = { n: 0 };
  Object.defineProperty(style, 'textContent', {
    configurable: true,
    get() { return desc.get.call(this); },
    set(v) { count.n += 1; desc.set.call(this, v); },
  });
  return count;
}

// ---------------------------------------------------------------------------------------------
// Hiding
// ---------------------------------------------------------------------------------------------

test('the header: the owner\'s script, served from tornwar.com, run at document-start, with its version in the file', () => {
  const src = readFileSync(SRC, 'utf8');
  const end = '// ==/UserScript==';
  const header = src.slice(0, src.indexOf(end) + end.length);
  const tag = (k) => [...header.matchAll(new RegExp('^// @' + k + '\\s+(.+)$', 'gm'))].map((m) => m[1].trim());
  assert.deepEqual(tag('name'), ['Torn Icon Hider']);
  assert.deepEqual(tag('namespace'), ['RussianRob']);
  assert.deepEqual(tag('author'), ['RussianRob']);
  assert.deepEqual(tag('version'), ['1.0.0']);
  assert.deepEqual(tag('license'), ['All Rights Reserved']);
  assert.deepEqual(tag('copyright'), []);
  assert.deepEqual(tag('match'), ['https://www.torn.com/*', 'https://torn.com/*']);
  assert.deepEqual(tag('run-at'), ['document-start']);
  assert.deepEqual(tag('grant'), ['GM_getValue', 'GM_setValue', 'GM_registerMenuCommand']);
  assert.deepEqual(tag('connect'), []);
  assert.deepEqual(tag('downloadURL'), ['https://tornwar.com/scripts/torn-icon-hider.user.js']);
  assert.deepEqual(tag('updateURL'), ['https://tornwar.com/scripts/torn-icon-hider.meta.js']);
  assert.equal(tag('description').length, 1);
  assert.equal(readFileSync(META, 'utf8'), header + '\n', 'the meta file is the header, byte for byte');
  assert.match(src, /const VERSION = '1\.0\.0';/, 'the in-file version matches @version');
  assert.match(src, /^\/\/ v1\.0\.0  - First release\./m, 'the changelog has the 1.0.0 entry');
});

test('the source is plain ASCII with no PDA key placeholder or password field, every GM_ call is guarded, and the console line carries the version', () => {
  const src = readFileSync(SRC, 'utf8');
  assert.equal(src.match(/[^\x00-\x7f]/g), null, 'plain ASCII, or PDA breaks it');
  assert.equal(src.includes('###' + 'PDA-APIKEY###'), false, 'no key, so no placeholder');
  assert.equal(/password/i.test(src), false, 'no password field');
  const code = src.slice(src.indexOf('// ==/UserScript=='));
  // Each call has its typeof check on its own line or the line before.
  const codeLines = code.split('\n');
  const calls = codeLines.map((l, i) => [l, i]).filter(([l]) => /\bGM_\w+\s*\(/.test(l));
  assert.ok(calls.length >= 2, 'the script uses GM storage');
  for (const [l, i] of calls) {
    const name = l.match(/\b(GM_\w+)\s*\(/)[1];
    const guard = 'typeof ' + name + ' === \'function\'';
    assert.ok(l.includes(guard) || codeLines[i - 1].includes(guard), 'guarded: ' + l.trim());
  }
  assert.deepEqual(page().run().logs, ['[Torn Icon Hider 1.0.0] running']);
});

for (const layout of Object.keys(LAYOUTS)) {
  test(`${layout}: a hidden kind's icon is hidden in the row, and nothing else on the page is`, () => {
    const w = page({ layout, store: hiding('maleGender', 'married') }).run();
    assert.deepEqual(showing(w), [BLOODBAG, XANAX, 'Subscriber', 'Faction', 'Reading Book', 'Drug Cooldown']);
    const hidden = [...matching(w, 'display: none')];
    assert.equal(hidden.length, 2, 'just the two icons in the row');
    assert.ok(hidden.every((el) => el.parentNode === w.row()), 'none in the header or the icons outside the sidebar');
  });
}

test('the rule for icon5 leaves icon52 alone, and the rule for icon52 leaves icon5 alone', () => {
  const icons = { level: { iconID: 'icon5', title: 'Level 100', subtitle: '', link: '#' },
    drug_cooldown: { iconID: 'icon52', title: 'Drug Cooldown', subtitle: 'Xanax', link: '#' } };
  assert.deepEqual(showing(page({ icons, store: hiding('level') }).run()), [BLOODBAG, XANAX, 'Drug Cooldown']);
  assert.deepEqual(showing(page({ icons, store: hiding('drug_cooldown') }).run()), [BLOODBAG, XANAX, 'Level 100']);
});

test('a class name with four underscores is matched too', () => {
  const w = page({ store: hiding('married') }).run();
  assert.equal(w.icon('Married').className, 'icon8____Cehh');
  assert.ok(matching(w, 'display: none').has(w.icon('Married')));
});

test('at document-start the stylesheet goes in <html>, before Torn draws anything, and hides the icon once it is drawn', () => {
  const w = page({ start: true, store: hiding('maleGender') }).run();
  const style = w.document.getElementById(STYLES);
  assert.equal(style.parentNode, w.document.documentElement, 'in <html>: there is no <head> yet');
  assert.ok(rulesWith(w, 'display: none').length > 0, 'the rule is there before the row');
  w.draw();
  assert.deepEqual(showing(w), [BLOODBAG, XANAX, 'Subscriber', 'Married', 'Faction', 'Reading Book', 'Drug Cooldown']);
});

test('loaded twice on one page, it runs once', () => {
  const w = page().run();
  w.run();
  assert.equal(w.document.querySelectorAll('#' + STYLES).length, 1);
  assert.equal(w.logs.length, 1);
});

test('the stylesheet is written only when the hidden numbers change', () => {
  const w = page({ store: hiding('maleGender') }).run();
  const writes = countWrites(w);
  w.check();
  w.check();
  assert.equal(writes.n, 0, 'nothing changed');
  w.store['tih-hidden'] = JSON.stringify(['maleGender', 'faction']);
  w.check();
  assert.equal(writes.n, 1);
  w.check();
  assert.equal(writes.n, 1);
});

test('a stylesheet taken out of the page is put back at the next check', () => {
  const w = page({ store: hiding('maleGender') }).run();
  w.document.getElementById(STYLES).remove();
  assert.equal(showing(w).includes('Male'), true, 'with the stylesheet gone, Male shows');
  w.check();
  assert.equal(w.document.querySelectorAll('#' + STYLES).length, 1);
  assert.equal(showing(w).includes('Male'), false);
});

test('each kind is learned with its title and picture number, and only the title is stored', () => {
  const w = page().run();
  const kinds = kindsIn(w.store);
  assert.deepEqual(Object.keys(kinds), Object.keys(ICONS));
  assert.deepEqual(kinds.maleGender, { title: 'Male', ids: [6] });
  assert.deepEqual(kinds.drug_cooldown, { title: 'Drug Cooldown', ids: [53] });
  for (const detail of ['Example Spouse', 'days left', 'Xanax', 'Example Faction', 'Example Book']) {
    assert.equal(w.store['tih-kinds'].includes(detail), false, detail);
  }
});

test('a title is kept as the icon\'s label reads it: HTML dropped, entities read; no title gives the key', () => {
  const icons = { odd: { iconID: 'icon9', title: '<b>Bold</b> &amp; <i>more</i>&nbsp;here', link: '#' },
    blank: { iconID: 'icon27', title: '', link: '#' } };
  const kinds = kindsIn(page({ icons }).run().store);
  assert.equal(kinds.odd.title, 'Bold & more here');
  assert.equal(kinds.blank.title, 'blank');
});

test('an entry with no picture number is skipped, as the script couldn\'t hide it', () => {
  const icons = { a: { title: 'A' }, b: { iconID: 'icon', title: 'B' }, c: { iconID: 'iconX', title: 'C' },
    d: { iconID: 'icon6x', title: 'D' }, e: null, f: 'text', maleGender: ICONS.maleGender };
  assert.deepEqual(Object.keys(kindsIn(page({ icons }).run().store)), ['maleGender']);
});

test('a picture number belongs to the kind it was last seen with, and a kind left with none is dropped', () => {
  const store = { 'tih-kinds': JSON.stringify({ old_faction: { title: 'Faction', ids: [74] }, company: { title: 'Company', ids: [27] } }) };
  const kinds = kindsIn(page({ store }).run().store);
  assert.deepEqual(kinds.faction, { title: 'Faction', ids: [74] });
  assert.equal(kinds.old_faction, undefined, 'its only number moved to faction');
  assert.deepEqual(kinds.company, { title: 'Company', ids: [27] }, 'seen before, kept');
});

test('a hidden cooldown\'s next level is hidden before it is ever seen', () => {
  const w = page({ store: hiding('drug_cooldown') }).run();
  assert.equal(showing(w).includes('Drug Cooldown'), false);
  w.setIcons(Object.assign({}, ICONS, { drug_cooldown: Object.assign({}, ICONS.drug_cooldown, { iconID: 'icon52' }) }));
  assert.equal(showing(w).includes('Drug Cooldown'), false, 'icon52, with no check since');
  w.setIcons(Object.assign({}, ICONS, { drug_cooldown: Object.assign({}, ICONS.drug_cooldown, { iconID: 'icon49' }) }));
  assert.equal(showing(w).includes('Drug Cooldown'), false, 'icon49 too');
});

test('another hidden kind\'s new picture number shows until the next check, then stays hidden', () => {
  const w = page({ store: hiding('faction') }).run();
  assert.equal(showing(w).includes('Faction'), false);
  w.setIcons(Object.assign({}, ICONS, { faction: Object.assign({}, ICONS.faction, { iconID: 'icon81' }) }));
  assert.equal(showing(w).includes('Faction'), true, 'a new role: not known yet');
  w.check();
  assert.equal(showing(w).includes('Faction'), false, 'learned at the next check');
  assert.deepEqual(kindsIn(w.store).faction.ids, [74, 81]);
});

test('a kind that is switched on is never hidden by another kind\'s level range', () => {
  const store = Object.assign({ 'tih-kinds': JSON.stringify({ odd: { title: 'Odd', ids: [50] } }) }, hiding('drug_cooldown'));
  const w = page({ store }).run();
  const rules = rulesWith(w, 'display: none').join(' ');
  for (const n of [49, 51, 52, 53]) assert.ok(rules.includes('icon' + n + '___'), 'icon' + n);
  assert.equal(rules.includes('icon50___'), false, 'icon50 belongs to Odd, which shows');
});

test('a save in another tab reaches this one at its next check', () => {
  const store = {};
  const a = page({ store }).run();
  const b = page({ store }).run();
  b.store['tih-hidden'] = JSON.stringify(['maleGender']);
  assert.equal(showing(a).includes('Male'), true);
  a.check();
  assert.equal(showing(a).includes('Male'), false);
});

test('with no sidebar data, hidden icons stay hidden and nothing new is learned', () => {
  const kinds = JSON.stringify({ maleGender: { title: 'Male', ids: [6] } });
  const w = page({ data: null, store: Object.assign({ 'tih-kinds': kinds }, hiding('maleGender')) }).run();
  assert.equal(showing(w).includes('Male'), false);
  assert.equal(w.store['tih-kinds'], kinds);
});

test('stored values that come back as objects still work', () => {
  const store = { 'tih-kinds': { maleGender: { title: 'Male', ids: [6] } }, 'tih-hidden': ['maleGender'] };
  assert.equal(showing(page({ store }).run()).includes('Male'), false);
});

test('stored values that won\'t parse read as nothing saved: every icon shows', () => {
  const w = page({ store: { 'tih-kinds': '{oops', 'tih-hidden': 'not json' } }).run();
  assert.deepEqual(showing(w), [BLOODBAG, XANAX].concat(TITLES));
  assert.deepEqual(Object.keys(kindsIn(w.store)), Object.keys(ICONS), 'learned afresh');
});

test('the Xanax and Blood Bag icons are never learned or hidden', () => {
  const w = page({ store: hiding(...Object.keys(ICONS)) }).run();
  assert.deepEqual(showing(w), [BLOODBAG, XANAX]);
  assert.equal(Object.keys(kindsIn(w.store)).some((k) => /xanax|blood/i.test(k)), false);
});

// ---------------------------------------------------------------------------------------------
// Room
// ---------------------------------------------------------------------------------------------

for (const layout of DESKTOPS) {
  test(`${layout}: with an icon hidden, the row is spaced by a 10 px gap with no margins, and only this row`, () => {
    const w = page({ layout, store: hiding('married') }).run();
    const rows = matching(w, 'column-gap: 10px');
    assert.deepEqual([...rows], [w.row()], 'the desktop row, nothing else');
    assert.ok(rulesWith(w, 'flex-wrap: wrap').length > 0);
    const noMargin = matching(w, 'margin-right: 0');
    assert.ok([...w.row().children].every((el) => noMargin.has(el)), 'every icon in it, ours too');
    assert.equal([...noMargin].some((el) => el.parentNode !== w.row()), false);
  });
}

for (const layout of PHONES) {
  test(`${layout}: the phone strip keeps Torn's own spacing`, () => {
    const w = page({ layout, store: hiding('married') }).run();
    assert.equal(matching(w, 'column-gap: 10px').size, 0);
    assert.equal(matching(w, 'margin-right: 0').size, 0);
  });
}

test('with nothing hidden, Torn\'s spacing is left alone on desktop too', () => {
  const w = page({ layout: 'Fly-out, desktop' }).run();
  assert.equal(rulesWith(w, 'column-gap').length, 0);
});

test('after the stylesheet changes, the phone strip gets a scroll event, so Torn redraws its fade; not when nothing changed', () => {
  const w = page({ store: hiding('maleGender') });
  const strip = w.row().parentNode;
  let scrolls = 0;
  strip.addEventListener('scroll', () => { scrolls += 1; });
  w.run();
  assert.equal(scrolls, 1, 'the first stylesheet');
  w.check();
  assert.equal(scrolls, 1, 'nothing changed');
  w.store['tih-hidden'] = JSON.stringify(['maleGender', 'book']);
  w.check();
  assert.equal(scrolls, 2);
});

test('at document-start the first stylesheet, with no row yet, sends nothing and breaks nothing; a change once the row is drawn sends one', () => {
  const w = page({ start: true, store: hiding('maleGender') }).run();
  w.draw();
  let scrolls = 0;
  w.row().parentNode.addEventListener('scroll', () => { scrolls += 1; });
  w.check();
  assert.equal(scrolls, 0);
  assert.equal(showing(w).includes('Male'), false);
  w.store['tih-hidden'] = JSON.stringify(['maleGender', 'book']);
  w.check();
  assert.equal(scrolls, 1);
});
