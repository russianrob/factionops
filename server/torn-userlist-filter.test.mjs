// Torn User List Filter: hides people in hospital, in jail or abroad from Torn's user list search.
// These tests load the real script into hand-built copies of the search page, with the address,
// GM storage, the console and the MutationObserver under their control.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseHTML } from 'linkedom';

// TULF_SRC lets a mutant copy be tested in place of the served file.
const SRC = process.env.TULF_SRC || '/opt/warboard/server/public/scripts/torn-userlist-filter.user.js';
const META = SRC.replace(/\.user\.js$/, '.meta.js');
// The owner's search, as Torn's address has it.
const SEARCH = '?sid=UserList&orderBy=name&orderDirection=asc&levelFrom=75&lastAction=7&searchConditionNot=true&searchConditions=inFederalJail';
const BAR = 'tulf-bar';
const STORE = 'tulf-switches';
const RUNNING = '[Torn User List Filter 1.0.0] running';

// Text for an HTML attribute.
function attr(text) {
  return text.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// One of Torn's status icons in a row: an li whose id is "icon", its number and a hash, with
// Torn's title (which holds HTML). id, title, label (an aria-label) and inner (an aria-label on
// a link inside it) change it.
function icon(n, { id, title, label, inner } = {}) {
  const t = title === undefined ? '<b>' + (TITLES[n] || 'Icon') + '</b><br>Details' : title;
  return '<li id="' + (id || 'icon' + n + '___x7a') + '"' + (t ? ' title="' + attr(t) + '"' : '')
    + (label ? ' aria-label="' + attr(label) + '"' : '') + '>'
    + (inner ? '<a href="#" aria-label="' + attr(inner) + '"></a>' : '') + '</li>';
}
const TITLES = { 1: 'Online', 9: 'Faction member', 15: 'Hospital', 16: 'Jail', 62: 'Idle', 70: 'Federal jail',
  71: 'Traveling', 82: 'Hospital early discharge', 91: 'Hospital radiation poisoning' };

// A row of results, as Torn draws it: a name link, the level and the row's icons. The ids in
// the links are made up.
let nextId = 1000001;
function row(name, icons, { cls = '', hidden = false, style = '' } = {}) {
  return '<li' + (cls ? ' class="' + cls + '"' : '') + (hidden ? ' hidden' : '') + (style ? ' style="' + style + '"' : '') + '>'
    + '<div class="expander clearfix"><a class="user name" href="/profiles.php?XID=' + (nextId++) + '"><span>' + name + '</span></a>'
    + '<span class="level"><span class="label">Level:</span><span class="value">80</span></span>'
    + '<ul id="iconTray" class="big svg singleicon">' + icons.join('') + '</ul></div></li>';
}

// The rows most tests use: one of each, named for what they are. Online (1) comes first, so the
// icon that counts is never the row's first.
const ROWS = [
  row('okay', [icon(1), icon(9)]),
  row('hospital', [icon(1), icon(15)]),
  row('radiation', [icon(1), icon(91)]),
  row('jail', [icon(1), icon(16)]),
  row('flying', [icon(1), icon(71)]),
  row('federal', [icon(1), icon(70)]),
  row('discharge', [icon(1), icon(82)]),
].join('');
// Torn's loading placeholder, an li with no name link in it.
const PLACEHOLDER = '<li><span class="ajax-placeholder"></span></li>';
const TITLE = '<div class="users-list-title title-black top-round m-top10"><span>Name</span><span>Level</span><span>Icons</span></div>';

// The search page: Torn's wrapper, the title bar and the list. With wrapper: false the list sits in
// a plain box, and with title: false there is no title bar. list: false leaves the wrapper out
// too, as before Torn has put the results on the page.
function pageHtml({ rows = ROWS, wrapper = true, title = true, list = true } = {}) {
  if (!list) return '<div class="content-wrapper"><div class="content-title">Advanced Search</div></div>';
  const inner = (title ? TITLE : '') + '<ul class="user-info-list-wrap bottom-round cont-gray">' + rows + '</ul>';
  return '<div class="content-wrapper"><div class="content-title">Advanced Search</div>'
    + (wrapper ? '<div class="userlist-wrapper">' + inner + '</div>' : '<div class="results">' + inner + '</div>') + '</div>';
}

// Lets MutationObserver records reach the script.
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

// The search page with the script on it. The test controls the address (search), GM storage
// (store; getValue and setValue change how reads and writes go, and gm: false takes the GM
// functions away), the console (w.logs) and the MutationObserver: linkedom's, made to act as a
// browser's. It drops attribute records unless they were asked for, and never calls back with no
// records. w.observed lists what was watched and how, and w.deliveries counts the call-backs.
function page({ search = SEARCH, store = {}, getValue, setValue, gm = true, ...html } = {}) {
  const dom = parseHTML('<!doctype html><html><head></head><body>' + pageHtml(html) + '</body></html>');
  const doc = dom.document;
  const w = { document: doc, store, logs: [], observed: [], deliveries: 0 };
  class BrowserObserver {
    constructor(callback) {
      this.attributes = false;
      this.real = new dom.MutationObserver((records) => {
        const kept = records.filter((r) => r.type !== 'attributes' || this.attributes);
        if (!kept.length) return;
        w.deliveries += 1;
        callback(kept, this);
      });
    }
    observe(target, options) {
      w.observed.push({ target, options: { ...options } });
      this.attributes = !!(options.attributes || options.attributeFilter || options.attributeOldValue);
      this.real.observe(target, options);
    }
    disconnect() { this.real.disconnect(); }
    takeRecords() { return this.real.takeRecords(); }
  }
  w.run = () => {
    new Function('document', 'location', 'MutationObserver', 'GM_getValue', 'GM_setValue', 'console', readFileSync(SRC, 'utf8'))(
      doc, { search, href: 'https://www.torn.com/page.php' + search },
      BrowserObserver,
      gm ? (getValue || ((k, d) => (Object.prototype.hasOwnProperty.call(store, k) ? store[k] : d))) : undefined,
      gm ? (setValue ? (k, v) => setValue(store, k, v) : (k, v) => { store[k] = v; }) : undefined,
      { log: (...a) => w.logs.push(a.join(' ')), warn: (...a) => w.logs.push(a.join(' ')), error: (...a) => w.logs.push(a.join(' ')) });
    return w;
  };
  w.list = () => doc.querySelector('ul.user-info-list-wrap');
  w.bar = () => doc.getElementById(BAR);
  // Torn putting a new page of results in the list.
  w.newPage = (html) => { w.list().innerHTML = html; };
  // Torn replacing the whole list with a new one.
  w.replaceList = (html) => {
    const old = w.list();
    const ul = doc.createElement('ul');
    ul.className = old.className;
    ul.innerHTML = html;
    old.parentNode.replaceChild(ul, old);
  };
  return w;
}

// The selectors of the script's rules with this declaration, and every element they apply to.
function matching(w, declaration) {
  const style = w.document.getElementById('tulf-styles');
  if (!style) return new Set();
  const selectors = style.textContent.split('}').filter((rule) => rule.includes(declaration)).map((rule) => rule.split('{')[0].trim());
  return new Set(selectors.flatMap((selector) => [...w.document.querySelectorAll(selector)]));
}

// The names of the rows the script hides, and of those that show, in order.
function rowName(li) {
  return li.querySelector('.user.name').textContent;
}
function hiddenRows(w) {
  const gone = matching(w, 'display: none');
  return [...w.document.querySelectorAll('ul.user-info-list-wrap > li')].filter((li) => li.querySelector('.user.name') && gone.has(li)).map(rowName);
}
function showingRows(w) {
  const gone = matching(w, 'display: none');
  return [...w.document.querySelectorAll('ul.user-info-list-wrap > li')].filter((li) => li.querySelector('.user.name') && !gone.has(li)).map(rowName);
}

// The bar, which must be on the page.
function barOf(w) {
  const bar = w.bar();
  assert.ok(bar, 'the bar is on the page');
  return bar;
}

// The bar's count: the text after its switches.
function count(w) {
  return barOf(w).lastElementChild.textContent;
}

// The bar's switches, by name: { name: checked }.
function switchesOf(w) {
  const out = {};
  barOf(w).querySelectorAll('label').forEach((label) => { out[label.textContent.trim()] = label.querySelector('input').checked; });
  return out;
}

// Clicks a switch in the bar: it turns to on, and the change event fires, as a click does.
function flip(w, name, on) {
  const label = [...barOf(w).querySelectorAll('label')].find((l) => l.textContent.trim() === name);
  assert.ok(label, 'a switch named ' + name);
  const box = label.querySelector('input');
  box.checked = on;
  box.dispatchEvent(new w.document.defaultView.Event('change', { bubbles: true }));
}

// ---------------------------------------------------------------------------------------------
// The source
// ---------------------------------------------------------------------------------------------

test('the header is the spec\'s, and the meta file is the header and a newline', () => {
  const src = readFileSync(SRC, 'utf8');
  const end = '// ==/UserScript==';
  const header = src.slice(0, src.indexOf(end) + end.length) + '\n';
  assert.equal(readFileSync(META, 'utf8'), header);
  const tags = header.split('\n').filter((l) => l.startsWith('// @')).map((l) => l.slice(4).replace(/\s+/, ' '));
  assert.deepEqual(tags, [
    'name Torn User List Filter',
    'namespace RussianRob',
    'version 1.0.0',
    'description Hides people in hospital, in jail or abroad (in flight or landed) from Torn\'s user list search, with a switch for each above the list.',
    'author RussianRob',
    'downloadURL https://tornwar.com/scripts/torn-userlist-filter.user.js',
    'updateURL https://tornwar.com/scripts/torn-userlist-filter.meta.js',
    'license All Rights Reserved',
    'match https://www.torn.com/page.php*',
    'run-at document-end',
    'grant GM_getValue',
    'grant GM_setValue',
  ]);
  assert.match(src, /\n  const VERSION = '1\.0\.0';\n/);
  assert.match(src, /\n\/\/ CHANGELOG\n/);
  assert.match(src, /\n\/\/ v1\.0\.0  - First release\./);
});

test('the source is plain ASCII, guards every GM_* call, and has no PDA key placeholder, password field or HTML put in', () => {
  const src = readFileSync(SRC, 'utf8');
  assert.equal(/[^\x00-\x7f]/.test(src), false, 'plain ASCII');
  const lines = src.split('\n');
  lines.forEach((line, i) => {
    if (line.trim().startsWith('//')) return;
    for (const m of line.matchAll(/\b(GM_\w+)\(/g)) {
      const guard = 'typeof ' + m[1];
      assert.ok(line.includes(guard) || (lines[i - 1] || '').includes(guard), 'line ' + (i + 1) + ' guards ' + m[1]);
    }
  });
  assert.equal(src.includes('###PDA-APIKEY###'), false);
  assert.equal(/password/i.test(src), false);
  assert.equal(/innerHTML|outerHTML|insertAdjacentHTML|document\.write/.test(src), false);
});

// ---------------------------------------------------------------------------------------------
// Where it runs
// ---------------------------------------------------------------------------------------------

test('it runs on page.php?sid=UserList in any letter case, and says so once in the console', () => {
  for (const search of [SEARCH, '?sid=userlist', '?SID=USERLIST&levelFrom=75', '?levelFrom=75&sid=UserList']) {
    const w = page({ search }).run();
    assert.equal(w.document.documentElement.getAttribute('data-tulf'), '1.0.0', search);
    assert.deepEqual(hiddenRows(w), ['hospital', 'radiation', 'jail', 'flying'], search);
    assert.deepEqual(w.logs, [RUNNING], search);
  }
});

test('it does nothing on Torn\'s other page.php pages, nor on the page that loads the results (sid=UserListAjax)', () => {
  for (const search of ['?sid=UserListAjax', '?sid=UserList2', '?sid=hof', '?q=sid=UserList', '']) {
    const w = page({ search }).run();
    assert.equal(w.document.documentElement.hasAttribute('data-tulf'), false, search);
    assert.equal(w.document.querySelectorAll('style').length, 0, search);
    assert.deepEqual(hiddenRows(w), [], search);
    assert.deepEqual(w.logs, [], search);
  }
});

test('loaded twice on one page, it runs once', () => {
  const w = page().run();
  w.run();
  assert.equal(w.document.querySelectorAll('style').length, 1);
  assert.deepEqual(w.logs, [RUNNING]);
  assert.deepEqual(hiddenRows(w), ['hospital', 'radiation', 'jail', 'flying']);
});

// ---------------------------------------------------------------------------------------------
// Telling who is where
// ---------------------------------------------------------------------------------------------

test('icons 15 and 91 count as hospital, 16 as jail and 71 as abroad: with every switch on, those rows are hidden and the rest show', () => {
  const w = page().run();
  assert.deepEqual(hiddenRows(w), ['hospital', 'radiation', 'jail', 'flying']);
  assert.deepEqual(showingRows(w), ['okay', 'federal', 'discharge']);
});

test('70 (federal jail), 82 (early discharge) and other known numbers alone hide nothing, whatever their labels say', () => {
  const w = page({ rows: [
    row('federal', [icon(70, { title: '<b>Jail</b>', label: 'Jail' })]),
    row('discharge', [icon(82, { title: '<b>Hospital</b>', label: 'Hospital' })]),
    row('idle', [icon(62, { title: 'Traveling', label: 'Abroad' })]),
  ].join('') }).run();
  assert.deepEqual(hiddenRows(w), []);
  assert.deepEqual(showingRows(w), ['federal', 'discharge', 'idle']);
});

test('the whole number is read, up to a _ or the end of the id: icon1, icon150 and icon15x are not icon 15', () => {
  const w = page({ rows: [
    row('one', [icon(1, { id: 'icon1___x7a', title: '<b>Online</b>' })]),
    row('one-fifty', [icon(150, { id: 'icon150___x7a', title: '<b>Online</b>' })]),
    row('fifteen-x', [icon(15, { id: 'icon15x', title: '<b>Online</b>' })]),
    row('fifteen', [icon(15, { id: 'icon15', title: '<b>Online</b>' })]),
  ].join('') }).run();
  assert.deepEqual(hiddenRows(w), ['fifteen']);
});

test('an icon whose number is not known counts by how its label starts, in any letter case, with Torn\'s tags taken out', () => {
  const w = page({ rows: [
    row('hosp-title', [icon(14, { title: '<b>Hospital</b><br>Attacked by someone' })]),
    row('jail-label', [icon(69, { title: '', label: 'jail: 3 hours' })]),
    row('travel', [icon(88, { title: 'TRAVELING to Mexico' })]),
    row('abroad', [icon(150, { title: '<b>Abroad</b><br>In Japan' })]),
    row('inner', [icon(200, { title: '', inner: 'Hospital: 2 hours' })]),
    row('mid-word', [icon(201, { title: 'Left hospital an hour ago' })]),
    row('no-label', [icon(202, { title: '' })]),
  ].join('') }).run();
  assert.deepEqual(hiddenRows(w), ['hosp-title', 'jail-label', 'travel', 'abroad', 'inner']);
  assert.deepEqual(showingRows(w), ['mid-word', 'no-label']);
});

test('every icon in the row counts, the first or the last, shown or not', () => {
  const w = page({ rows: [
    row('last', [icon(1), icon(9), icon(62), icon(16)]),
    row('first', [icon(71), icon(1)]),
  ].join('') }).run();
  assert.deepEqual(hiddenRows(w), ['last', 'first']);
});

test('TornTools\' lines under a hidden row (its stats estimate and last action) are hidden with it; a showing row\'s stay', () => {
  const w = page({ rows: row('okay', [icon(1)]) + '<div class="tt-stats-estimate">Stats Estimate: 1</div>'
    + row('hospital', [icon(15)]) + '<div class="tt-stats-estimate">Stats Estimate: 2</div><div class="tt-last-action">Last action: 3</div>'
    + row('also-okay', [icon(1)]) + '<div class="tt-last-action">Last action: 4</div>' }).run();
  const gone = matching(w, 'display: none');
  const lines = [...w.document.querySelectorAll('.tt-stats-estimate, .tt-last-action')].map((el) => gone.has(el));
  assert.deepEqual(lines, [false, true, true, false]);
  assert.deepEqual(hiddenRows(w), ['hospital']);
});

// ---------------------------------------------------------------------------------------------
// The bar
// ---------------------------------------------------------------------------------------------

test('the bar sits right before the list\'s title bar, with a switch for each kind, all on, and the count', () => {
  const w = page().run();
  const title = w.document.querySelector('.users-list-title');
  assert.equal(barOf(w).nextElementSibling, title);
  assert.equal(barOf(w).firstElementChild.textContent, 'Hide:');
  assert.deepEqual(switchesOf(w), { Hospital: true, Abroad: true, Jail: true });
  assert.deepEqual(Object.keys(switchesOf(w)), ['Hospital', 'Abroad', 'Jail']);
  assert.equal(count(w), '4 of 7 hidden on this page');
});

test('with no title bar, the bar sits right before the list; with no wrapper too, before the list in its box', () => {
  for (const html of [{ title: false }, { title: false, wrapper: false }]) {
    const w = page(html).run();
    assert.equal(barOf(w).nextElementSibling, w.list(), JSON.stringify(html));
    assert.equal(count(w), '4 of 7 hidden on this page');
  }
});

test('the bar is put in place once: a box another script puts between it and the title bar stays there', () => {
  const w = page().run();
  const other = w.document.createElement('div');
  other.className = 'tt-container';
  w.document.querySelector('.users-list-title').before(other);
  flip(w, 'Hospital', false);
  assert.equal(barOf(w).nextElementSibling, other);
  assert.equal(other.nextElementSibling, w.document.querySelector('.users-list-title'));
});

test('the count leaves out Torn\'s loading placeholder and a no-results line, and says 0 when nothing is hidden', () => {
  const w = page({ rows: PLACEHOLDER + row('okay', [icon(1)]) + row('jail', [icon(16)]) + '<li class="no-results">No users found</li>' }).run();
  assert.equal(count(w), '1 of 2 hidden on this page');
  const none = page({ rows: row('okay', [icon(1)]) + row('idle', [icon(62)]) }).run();
  assert.equal(count(none), '0 of 2 hidden on this page');
});

test('when every row on the page is hidden, the bar says so; one row alone gets its own wording', () => {
  const all = page({ rows: row('hospital', [icon(15)]) + row('jail', [icon(16)]) + row('flying', [icon(71)]) }).run();
  assert.equal(count(all), 'All 3 on this page are hidden.');
  const one = page({ rows: row('hospital', [icon(15)]) }).run();
  assert.equal(count(one), 'The 1 on this page is hidden.');
});

test('a page with no rows (Torn still loading them, or no results) shows the switches and no count', () => {
  const w = page({ rows: PLACEHOLDER }).run();
  assert.deepEqual(switchesOf(w), { Hospital: true, Abroad: true, Jail: true });
  assert.equal(count(w), '');
});

test('nothing from the page goes in the bar: a name with HTML in it stays out', () => {
  const w = page({ rows: row('&lt;b&gt;bold&lt;/b&gt;', [icon(15)]) + row('okay', [icon(1)]) }).run();
  assert.equal(barOf(w).querySelector('b'), null);
  assert.equal(barOf(w).textContent.includes('bold'), false);
});

// ---------------------------------------------------------------------------------------------
// The switches
// ---------------------------------------------------------------------------------------------

test('a switch takes effect at once on the rows on the page, and is saved as a string of JSON', () => {
  const w = page().run();
  flip(w, 'Hospital', false);
  assert.deepEqual(hiddenRows(w), ['jail', 'flying']);
  assert.equal(count(w), '2 of 7 hidden on this page');
  assert.equal(w.store[STORE], '{"hospital":false,"abroad":true,"jail":true}');
  flip(w, 'Abroad', false);
  flip(w, 'Jail', false);
  assert.deepEqual(hiddenRows(w), []);
  assert.equal(count(w), '0 of 7 hidden on this page');
  flip(w, 'Hospital', true);
  assert.deepEqual(hiddenRows(w), ['hospital', 'radiation']);
  assert.equal(w.store[STORE], '{"hospital":true,"abroad":false,"jail":false}');
});

test('the next page load starts from the saved switches', () => {
  const store = {};
  const first = page({ store }).run();
  flip(first, 'Abroad', false);
  const next = page({ store }).run();
  assert.deepEqual(switchesOf(next), { Hospital: true, Abroad: false, Jail: true });
  assert.deepEqual(hiddenRows(next), ['hospital', 'radiation', 'jail']);
});

test('a row of two kinds at once shows only when both its switches are off', () => {
  const w = page({ rows: row('hosp-abroad', [icon(15), icon(71)]) + row('okay', [icon(1)]) }).run();
  flip(w, 'Hospital', false);
  assert.deepEqual(hiddenRows(w), ['hosp-abroad']);
  flip(w, 'Abroad', false);
  assert.deepEqual(hiddenRows(w), []);
  flip(w, 'Hospital', true);
  assert.deepEqual(hiddenRows(w), ['hosp-abroad']);
});

test('TornTools\' lines come back with their row when its switch goes off', () => {
  const w = page({ rows: row('hospital', [icon(15)]) + '<div class="tt-stats-estimate">Stats Estimate: 2</div>' + row('okay', [icon(1)]) }).run();
  flip(w, 'Hospital', false);
  assert.equal(matching(w, 'display: none').has(w.document.querySelector('.tt-stats-estimate')), false);
});

test('rows another script hides are hidden by this one too when of a kind switched on, but never counted', () => {
  const w = page({ rows: [
    row('tt-hospital', [icon(15)], { cls: 'tt-hidden' }),
    row('tt-okay', [icon(1)], { cls: 'tt-hidden' }),
    row('attr-jail', [icon(16)], { hidden: true }),
    row('styled-okay', [icon(1)], { style: 'display: none' }),
    row('hospital', [icon(15)]),
    row('okay', [icon(1)]),
  ].join('') }).run();
  assert.deepEqual(hiddenRows(w), ['tt-hospital', 'attr-jail', 'hospital']);
  assert.equal(count(w), '1 of 2 hidden on this page');
});

// ---------------------------------------------------------------------------------------------
// Stored
// ---------------------------------------------------------------------------------------------

test('saved switches read back as a string, as PDA hands them back, or as the object itself', () => {
  for (const saved of ['{"hospital":true,"abroad":false,"jail":false}', { hospital: true, abroad: false, jail: false }]) {
    const w = page({ store: { [STORE]: saved } }).run();
    assert.deepEqual(switchesOf(w), { Hospital: true, Abroad: false, Jail: false });
    assert.deepEqual(hiddenRows(w), ['hospital', 'radiation']);
  }
});

test('nothing saved, a value that won\'t parse, or one that isn\'t an object: all three on; a kind missing from it is on', () => {
  for (const saved of [undefined, '', 'not json', '42', 'null', '"text"']) {
    const store = saved === undefined ? {} : { [STORE]: saved };
    const w = page({ store }).run();
    assert.deepEqual(switchesOf(w), { Hospital: true, Abroad: true, Jail: true }, String(saved));
  }
  const w = page({ store: { [STORE]: '{"jail":false}' } }).run();
  assert.deepEqual(switchesOf(w), { Hospital: true, Abroad: true, Jail: false });
});

test('a save that storage refuses still takes effect on this page; the next load starts from what was saved before', () => {
  const store = { [STORE]: '{"hospital":true,"abroad":true,"jail":false}' };
  const setValue = () => { throw new Error('QuotaExceededError'); };
  const w = page({ store, setValue }).run();
  assert.doesNotThrow(() => flip(w, 'Hospital', false));
  assert.deepEqual(hiddenRows(w), ['flying']);
  const next = page({ store }).run();
  assert.deepEqual(switchesOf(next), { Hospital: true, Abroad: true, Jail: false });
});

test('storage that throws on reading, or no GM functions at all: all three on, and the switches still work on the page', () => {
  const broken = page({ getValue: () => { throw new Error('no storage'); } }).run();
  assert.deepEqual(switchesOf(broken), { Hospital: true, Abroad: true, Jail: true });
  const bare = page({ gm: false }).run();
  assert.deepEqual(hiddenRows(bare), ['hospital', 'radiation', 'jail', 'flying']);
  flip(bare, 'Jail', false);
  assert.deepEqual(hiddenRows(bare), ['hospital', 'radiation', 'flying']);
});
