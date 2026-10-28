// FactionOps' chain bar (5.6.21): the pure parts lifted out of the script and
// driven with made-up chains, and the wiring checked in the text -- the
// header, the version, and the gate that stops the script off its own pages.
// 5.6.22: no frames, and FactionOps' toasts go under the bar.
// 5.6.24: Torn's phone layout, whose chain bar has no clock; 5.6.25: nor, from
// a max of 1,000, the max.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// FO_SRC points the checks at another copy (the mutants use it).
const SRC = readFileSync(process.env.FO_SRC || new URL('./public/scripts/factionops.user.js', import.meta.url), 'utf8');
const META = readFileSync(new URL('./public/scripts/factionops.meta.js', import.meta.url), 'utf8');

// The text of `function name(...) {...}`, by brace count.
function fn(name) {
  const i = SRC.indexOf('function ' + name + '(');
  assert.ok(i > 0, name + ' not found');
  let d = 0;
  for (let j = SRC.indexOf('{', i); j < SRC.length; j++) {
    if (SRC[j] === '{') d++;
    else if (SRC[j] === '}' && --d === 0) return SRC.slice(i, j + 1);
  }
  throw new Error(name + ' never closes');
}
function konst(name) {
  const m = SRC.match(new RegExp('const ' + name + ' = ([^;]+);'));
  assert.ok(m, name + ' not found');
  return 'const ' + name + ' = ' + m[1] + ';\n';
}
let lib = null;
function L() {
  if (lib) return lib;
  const names = ['isFactionOpsPage', 'readChainFromDom', 'chainCooldownFrom', 'chainNag', 'chainBarStep', 'chainBarText', 'chainBarReading'];
  lib = new Function(
    ['CHAIN_BAR_MIN_HITS', 'CHAIN_BAR_CHECK_WAIT_MS', 'CHAIN_BAR_CHECK_TTL_MS', 'CHAIN_BAR_COOLDOWN_AHEAD_S', 'FO_PAGE_PATTERNS'].map(konst).join('')
    + names.map(fn).join('\n') + '\nreturn { ' + names.join(', ') + ' };')();
  return lib;
}

// A sidebar with one chain bar under the given id. Its text runs the label,
// the count and the clock together, as textContent gives them. The clock sits
// in an element of class `cls`; a null clock means the bar has none.
function doc(count, time, id = 'barChain', cls = 'bar-timeleft___x') {
  const leaf = (t) => ({ children: [], textContent: t });
  const clock = time == null ? null : leaf(time);
  const bar = {
    textContent: 'Chain:' + count + (time == null ? '' : time),
    querySelector: (s) => (s.includes('bar-timeleft') && cls.includes('bar-timeleft') ? clock : null),
    querySelectorAll: (s) => (s === '*' ? [leaf('Chain:'), leaf(count)].concat(clock ? [clock] : []) : []),
  };
  return {
    getElementById: (x) => (x === id ? bar : null),
    querySelector: (s) => (s === '[id^="barChain"]' && id.startsWith('barChain') ? bar : null),
  };
}

// Torn's phone layout has no #barChain, and its chain bar shows the count but
// no clock. The clock comes from the chain the sidebar saves in the tab's
// sessionStorage: `saved` stands in for that storage, `chain` for its entry.
let phoneLib = null;
function P() {
  if (!phoneLib) phoneLib = new Function(fn('readChainFromPhoneBar') + '\nreturn readChainFromPhoneBar;')();
  return phoneLib;
}
function phoneDoc(text) {
  const bar = text == null ? null : { textContent: text };
  return { getElementById: () => null, querySelector: (s) => (s.includes('chainBar') ? bar : null) };
}
function saved(entries) {
  const keys = Object.keys(entries);
  return { get length() { return keys.length; }, key: (i) => keys[i], getItem: (k) => (k in entries ? entries[k] : null) };
}
const chain = (amount, end) => JSON.stringify({ bars: { chain: { name: 'Chain', amount, max: 2500, timestampToUpdate: end, timeToUpdate: 300, coolDown: 0, endCoolDownTimestamp: 0 } } });
const NOW = 1000000 * 1000;

test("the phone layout: the bar's count, and the clock from the sidebar's saved chain", () => {
  const s = saved({ sidebarDataundefined: '{}', sidebarData1000001: chain(1234, 1000042) });
  assert.deepEqual(P()(phoneDoc('Chain:1,234 / 2,500'), s, NOW), { count: 1234, left: 42 });
  assert.deepEqual(P()(phoneDoc('Chain:1,234 / 2,500'), s, NOW + 500), { count: 1234, left: 41 });
});

test('a bar that shows the count without its max (Torn drops it from a max of 1,000) still reads', () => {
  for (const text of ['Chain:640', 'Chain:1,234', 'Chain:1234']) {
    const n = Number(text.replace(/[^\d]/g, ''));
    const s = saved({ sidebarData1000001: chain(n, 1000042) });
    assert.deepEqual(P()(phoneDoc(text), s, NOW), { count: n, left: 42 }, text);
  }
});

test('saved data with any other count than the bar shows is not used', () => {
  for (const n of [1233, 1235]) {
    const s = saved({ sidebarData1000001: chain(n, 1000042) });
    assert.equal(P()(phoneDoc('Chain:1,234 / 2,500'), s, NOW), null, String(n));
  }
});

test("a saved chain whose end has passed gives no reading, so the overlay's chain can stand in", () => {
  for (const end of [1000000, 999990, 0]) {
    const s = saved({ sidebarData1000001: chain(1234, end) });
    const read = () => P()(phoneDoc('Chain:1,234 / 2,500'), s, NOW);
    assert.equal(read(), null, String(end));
    const overlay = { count: 1234, left: 30, ok: true, at: NOW - 500 };
    assert.equal(L().chainBarReading(NOW, overlay, read), overlay, String(end));
  }
});

test('no phone bar, no saved chain, or saved data it cannot read: no reading', () => {
  const good = saved({ sidebarData1000001: chain(1234, 1000042) });
  const bar = phoneDoc('Chain:1,234 / 2,500');
  const cases = [
    [phoneDoc(null), good],
    [phoneDoc('Chain:'), good],
    [bar, saved({})],
    [bar, saved({ sidebarDataundefined: chain(1234, 1000042) })],
    [bar, saved({ sidebarData1000001: 'not json' })],
    [bar, saved({ sidebarData1000001: JSON.stringify({ bars: {} }) })],
    [bar, saved({ sidebarData1000001: chain(1234, undefined) })],
    [bar, { get length() { throw new Error('denied'); } }],
    [bar, null],
  ];
  cases.forEach(([d, s], i) => assert.equal(P()(d, s, NOW), null, 'case ' + i));
});

test("FactionOps runs whole on its old @match list's pages, and only the bar elsewhere", () => {
  const head = SRC.slice(0, SRC.indexOf('// ==/UserScript=='));
  const old = [...head.matchAll(/^\/\/ @match\s+(\S+)$/gm)].map((m) => m[1]).filter((u) => !u.endsWith('torn.com/*'));
  assert.equal(old.length, 9);
  for (const u of old) assert.equal(L().isFactionOpsPage(u.replace(/\*$/, 'x')), true, u);
  for (const u of ['https://www.torn.com/gym.php', 'https://www.torn.com/index.php', 'https://www.torn.com/item.php',
    'https://www.torn.com/page.php?sid=crimes', 'https://www.torn.com/loader.php?sid=racing'])
    assert.equal(L().isFactionOpsPage(u), false, u);
});

test('it reads the sidebar: the count wherever Torn puts it, the clock as parseChainFromDOM reads it', () => {
  assert.deepEqual(L().readChainFromDom(doc('1,234/2,500', '00:42')), { count: 1234, left: 42 });
  assert.deepEqual(L().readChainFromDom(doc(' 1,234 / 100,000', '1:02:03')), { count: 1234, left: 3723 });
  assert.deepEqual(L().readChainFromDom(doc('12/25', '4:21', 'barChain-x')), { count: 12, left: 261 });
  // The clock ahead of the count, run together: its digits are not the count's.
  const ahead = doc('1,234/2,500', '00:42');
  ahead.getElementById('barChain').textContent = 'Chain:00:421,234/2,500';
  assert.deepEqual(L().readChainFromDom(ahead), { count: 1234, left: 42 });
  // A clock under some other class: the element that holds nothing but a clock.
  assert.deepEqual(L().readChainFromDom(doc('1,234/2,500', '00:42', 'barChain', 'timer___x')), { count: 1234, left: 42 });
  assert.equal(L().readChainFromDom(doc('1,234/2,500', '--:--', 'barChain', 'timer___x')), null);
  assert.equal(L().readChainFromDom(doc('1,234/2,500', '00:42', 'nothing')), null);
  assert.equal(L().readChainFromDom(doc('1,234/2,500', null)), null);
  assert.equal(L().readChainFromDom(doc('1,234/2,500', '--:--')), null);
  assert.equal(L().readChainFromDom(doc('1,234/2,500', '')), null);
  assert.equal(L().readChainFromDom(doc('', '00:42')), null);
});

test('up from 10 hits with the threshold or less on the clock, and more than 0', () => {
  const r = (count, left) => ({ count, left });
  assert.deepEqual(L().chainNag(0, r(1234, 42), null, 60), { count: 1234, left: 42 });
  assert.deepEqual(L().chainNag(0, r(10, 60), null, 60), { count: 10, left: 60 });
  assert.equal(L().chainNag(0, r(1234, 61), null, 60), null);
  assert.equal(L().chainNag(0, r(1234, 0), null, 60), null);
  assert.equal(L().chainNag(0, r(9, 42), null, 60), null);
  assert.equal(L().chainNag(0, null, null, 60), null);
  assert.deepEqual(L().chainNag(0, r(1234, 85), null, 90), { count: 1234, left: 85 });
});

test('a chain in its cooldown keeps it down until the cooldown ends or the count grows', () => {
  // A sidebar counting a finished chain's cooldown down reads what is left of
  // it: 0:42 here, with the API's answer up to 30 s behind at 50 s.
  const cd = L().chainCooldownFrom({ current: 1234, cooldown: 50 }, 1000);
  assert.deepEqual(cd, { count: 1234, until: 1000 + 50 * 1000 });
  assert.equal(L().chainCooldownFrom({ current: 1234, cooldown: 0 }, 1000), null);
  assert.equal(L().chainCooldownFrom(null, 1000), null);
  const r = { count: 1234, left: 42 };
  assert.equal(L().chainNag(2000, r, cd, 60), null);
  assert.deepEqual(L().chainNag(cd.until, r, cd, 60), r);
  assert.deepEqual(L().chainNag(2000, { count: 1235, left: 42 }, cd, 60), { count: 1235, left: 42 });
});

test('a cooldown only holds it down while it agrees with the clock: Torn has reported one for a chain that ran on', () => {
  const r = { count: 1234, left: 42 };
  // The API's answer is up to about 30 s behind, so a real cooldown reads up
  // to 45 s ahead of the sidebar clock that counts it down, and never more
  // than 5 s behind it.
  const at = (cooldown) => L().chainNag(1000, r, L().chainCooldownFrom({ current: 1234, cooldown }, 1000), 60);
  assert.equal(at(42), null);
  assert.equal(at(86), null);
  assert.equal(at(38), null);
  assert.deepEqual(at(88), r);
  assert.deepEqual(at(300), r);
  assert.deepEqual(at(36), r);
});

test("one check before it first comes up; the overlay's chain needs none", () => {
  const S = L().chainBarStep;
  assert.deepEqual(S(0, { count: 1234, left: 42 }, null, 60), { show: null, start: true });
  const pending = { count: 1234, left: 42, at: 0, done: false, cd: null };
  assert.deepEqual(S(4999, { count: 1234, left: 38 }, pending, 60), { show: null, start: false });
  assert.deepEqual(S(5000, { count: 1234, left: 37 }, pending, 60), { show: { count: 1234, left: 37 }, start: false });
  const live = { ...pending, done: true };
  assert.deepEqual(S(1000, { count: 1234, left: 41 }, live, 60), { show: { count: 1234, left: 41 }, start: false });
  const cooling = { ...pending, done: true, cd: { count: 1234, until: 1000 + 50 * 1000 } };
  assert.deepEqual(S(1000, { count: 1234, left: 42 }, cooling, 60), { show: null, start: false });
  // A new count, a clock that went back up, or a minute on: check again.
  assert.deepEqual(S(1000, { count: 1240, left: 42 }, live, 60), { show: null, start: true });
  assert.deepEqual(S(1000, { count: 1234, left: 59 }, live, 60), { show: null, start: true });
  assert.deepEqual(S(60000, { count: 1234, left: 2 }, live, 60), { show: null, start: true });
  assert.deepEqual(S(0, { count: 1234, left: 42, fromOverlay: true }, null, 60), { show: { count: 1234, left: 42 }, start: false });
  assert.deepEqual(S(0, { count: 1234, left: 75 }, null, 60), { show: null, start: false });
});

test('the text: the count with commas, the clock as m:ss', () => {
  assert.equal(L().chainBarText({ count: 1234, left: 42 }), 'CHAIN DYING \u00B7 1,234 hits \u00B7 0:42 left');
  assert.equal(L().chainBarText({ count: 12, left: 75 }), 'CHAIN DYING \u00B7 12 hits \u00B7 1:15 left');
});

test('5.6.27 in both places, the meta file is the header, and every page joins the old list', () => {
  const end = '// ==/UserScript==';
  const head = SRC.slice(0, SRC.indexOf(end) + end.length) + '\n';
  assert.equal(META, head);
  assert.match(head, /^\/\/ @version\s+5\.6\.27$/m);
  assert.match(SRC, /const SCRIPT_VERSION = '5\.6\.27';/);
  const matches = [...head.matchAll(/^\/\/ @match\s+(\S+)$/gm)].map((m) => m[1]);
  assert.equal(matches.length, 11);
  assert.deepEqual(matches.slice(-2), ['https://www.torn.com/*', 'https://torn.com/*']);
});

test('it stays out of frames: one @noframes in the header', () => {
  const head = SRC.slice(0, SRC.indexOf('// ==/UserScript=='));
  assert.equal([...head.matchAll(/^\/\/ @noframes$/gm)].length, 1);
});

test('the gate: the bar starts, then the script stops off its own pages, above everything else', () => {
  const g = '    if (!isFactionOpsPage(location.href)) return;';
  const gate = SRC.indexOf(g);
  assert.ok(gate > 0, 'no gate');
  assert.equal(SRC.indexOf(g, gate + 1), -1, 'two gates');
  const start = SRC.indexOf('\n    startChainBar();\n');
  assert.ok(start > 0 && start < gate, 'the bar does not start above the gate');
  assert.ok(gate > SRC.indexOf('function setConfig('), 'the gate is above CONFIG');
  assert.ok(gate < SRC.indexOf('SECTION 1B: PDA-COMPATIBLE HTTP WRAPPER'), 'the gate is below the HTTP wrapper');
});

test("the bar follows Torn's sidebar while it reads, and the war overlay's chain, with the alerts' own checks, only where it does not", () => {
  const side = { count: 1234, left: 42 };
  const o = (ok, at) => ({ ok, count: 1240, left: 30, at, fromOverlay: true });
  assert.deepEqual(L().chainBarReading(5000, o(true, 4000), () => side), side);
  assert.deepEqual(L().chainBarReading(5000, null, () => side), side);
  assert.equal(L().chainBarReading(5000, o(true, 4000), () => null).count, 1240);
  assert.equal(L().chainBarReading(5000, o(false, 4000), () => null), null);
  assert.equal(L().chainBarReading(5000, o(true, 3000), () => null), null);
  assert.equal(L().chainBarReading(5000, null, () => null), null);
});

test("the war overlay's chain tick hands the bar its chain, with the alerts' own checks", () => {
  const tick = fn('startChainTimer');
  const i = tick.indexOf('const _chainFocusOK');
  const j = tick.indexOf('chainBarFromOverlay = {');
  const k = tick.indexOf('ok: chainDataFresh && chainTimeoutPlausible && state.chain.timeout > 0,');
  assert.ok(i > 0 && j > i && k > j, 'the overlay does not hand the bar its chain in the tick');
});

test('no raw curly quotes: Torn PDA straightens them and the file stops parsing', () => {
  assert.doesNotMatch(SRC, /[\u2018\u2019\u201C\u201D]/);
});

// A page for the toasts' spot: the chain bar's bottom edge (null: no bar),
// and what the script adds to it.
function toastPage(barBottom) {
  const added = {};
  const bar = barBottom == null ? null : { getBoundingClientRect: () => ({ top: 10, bottom: barBottom }) };
  return {
    getElementById: (id) => (id === 'fo-chain-bar' ? bar : added[id] || null),
    createElement: () => ({ style: {} }),
    body: { appendChild: (e) => { added[e.id] = e; } },
  };
}
// The toasts' spot and both toast stacks, on that page. `state` is as the
// script has it: nothing sets state.ui.chainBar.
function toasts(page) {
  const names = ['chainBarToastTop', 'ensureCallToastContainer', 'getToastContainer'];
  return new Function('document', 'const state = { ui: {} };\nlet toastContainer = null;\n' + konst('CHAIN_BAR_ID')
    + names.map(fn).join('\n') + '\nreturn { ' + names.join(', ') + ' };')(page);
}

test("FactionOps' toasts go 6 px under the chain bar while it is up, and at 10 px without it", () => {
  assert.equal(toasts(toastPage(45)).chainBarToastTop(), '51px');
  assert.equal(toasts(toastPage(97.6)).chainBarToastTop(), '104px');
  assert.equal(toasts(toastPage(null)).chainBarToastTop(), '10px');
});

test('both toast stacks start under the bar while it is up, and the general one keeps to it', () => {
  const up = toasts(toastPage(45));
  assert.match(up.ensureCallToastContainer().style.cssText, /top: 51px;/);
  assert.equal(up.getToastContainer().style.top, '51px');
  const none = toasts(toastPage(null));
  assert.match(none.ensureCallToastContainer().style.cssText, /top: 10px;/);
  assert.equal(none.getToastContainer().style.top, '10px');
});
