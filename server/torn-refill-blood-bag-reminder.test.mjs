// Torn: Refill Blood Bag Reminder, the owner's patched copy of ButtChew's Greasy Fork script
// 548072: a blood-bag icon in the row of Torn's status icons while you have life to spare.
// Torn's Fly-out Sidebar renamed that row (status-icons___ -> statusIcons___), and 4.3.3 only
// looked for the old name, so with Fly-out on it showed nothing.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseHTML } from 'linkedom';

// BBR_SRC lets another copy (ButtChew's 4.3.3, say) be tested in place of the served file.
const SRC = process.env.BBR_SRC || '/opt/warboard/server/public/scripts/torn-refill-blood-bag-reminder.user.js';
const META = SRC.replace(/\.user\.js$/, '.meta.js');
const ICON = 'tm-full-life-bloodbag';

// Two of Torn's own status icons, as the row holds them.
const ICONS = '<li class="icon6___GXzRS"><a aria-label="Company"></a></li><li class="icon9___hW3Xh"><a aria-label="Faction"></a></li>';
// Torn's sidebar, cut down to the status-icon row, in its three layouts. The Fly-out ones also
// carry two classes the row's new name must not be confused with.
const SIDEBARS = {
  'Fly-out, phone': '<div id="sidebar" class="sidebar___c4dEc mobile___fSMgm"><div class="userInformationMobile___Aznrv">'
    + '<span class="userOnlineStatusIcon___ihAUC"></span><div class="statusIcon___h94cJ"></div>'
    + '<div class="swiperWrapper___gaWYk"><ul class="statusIcons___ks48M big___O1UVc mobile___IzEv7">' + ICONS + '</ul></div></div></div>',
  'Fly-out, desktop': '<div id="sidebar" class="sidebar___c4dEc desktop___F2V9S"><div class="header___IXOC8">'
    + '<div class="userInformation___Tkqft"><span class="userOnlineStatusIcon___ihAUC"></span><div class="statusIcon___h94cJ"></div>'
    + '<div><ul class="statusIcons___ks48M big___O1UVc">' + ICONS + '</ul></div></div></div></div>',
  'old sidebar (Fly-out off)': '<div id="sidebar" class="sidebar___IcNKj"><div class="user-information-mobile___EaRKJ">'
    + '<div class="swiperWrapper___rBi8E"><ul class="status-icons___sskG2 mobile___YGGsN big___IeUkB">' + ICONS + '</ul></div></div></div>',
};

// Torn's sidebar data in sessionStorage, with life at `life` of 7500 and no medical cooldown.
function sidebarData(life) {
  return JSON.stringify({ bars: { life: { amount: life, max: 7500 } }, statusIcons: { icons: {} } });
}

// Runs the script on a page with this sidebar, with frames that run when the test flushes
// them. Returns the page and its status-icon row.
function load(sidebar, { life = 7400 } = {}) {
  const { document } = parseHTML('<!doctype html><html><head></head><body>' + SIDEBARS[sidebar] + '</body></html>');
  const storage = Object.create({ getItem(k) { return Object.prototype.hasOwnProperty.call(this, k) ? this[k] : null; } });
  storage.sidebarData137558 = sidebarData(life);
  const frames = [];
  const saved = {};
  new Function('window', 'document', 'sessionStorage', 'GM_getValue', 'GM_setValue', 'GM_registerMenuCommand',
    'requestAnimationFrame', 'MutationObserver', 'setInterval', 'console', readFileSync(SRC, 'utf8'))(
    { addEventListener() {}, innerWidth: 400 }, document, storage,
    (k, d) => (k in saved ? saved[k] : d), (k, v) => { saved[k] = v; }, () => {},
    (fn) => frames.push(fn), class { observe() {} }, () => 0, { log() {} });
  while (frames.length) frames.shift()();
  return { document, row: document.querySelector('ul[class*="icons" i]') };
}

for (const sidebar of Object.keys(SIDEBARS)) {
  test(`${sidebar}: the icon goes first in the row of status icons`, () => {
    const { document, row } = load(sidebar);
    const icon = document.getElementById(ICON);
    assert.ok(icon, 'the icon is on the page');
    assert.equal(icon.parentNode, row, 'in the status-icon row');
    assert.deepEqual([...row.children].map((li) => li.id || li.querySelector('a').getAttribute('aria-label')),
      [ICON, 'Company', 'Faction'], 'first, so it shows without swiping the strip');
  });

  test(`${sidebar}: the row may grow to fit the icon`, () => {
    const { document, row } = load(sidebar);
    // The stylesheet rule that lets the row grow: its selector must take in this row.
    const css = document.getElementById('tm-bloodbag-styles').textContent;
    const block = css.split('}').find((b) => /height:\s*auto\s*!important/.test(b));
    assert.ok(block, 'there is a rule letting the row grow');
    assert.ok(row.matches(block.split('{')[0].trim()), block.split('{')[0].trim());
  });
}

test('with life too low for the bags, there is no icon', () => {
  const { document } = load('Fly-out, phone', { life: 6000 });   // 80%: 3 bags need over 90%
  assert.equal(document.getElementById(ICON), null);
});

test('the header: the owner\'s copy, crediting ButtChew, updating from tornwar.com', () => {
  const src = readFileSync(SRC, 'utf8');
  const end = '// ==/UserScript==';
  const header = src.slice(0, src.indexOf(end) + end.length);
  const tag = (k) => [...header.matchAll(new RegExp('^// @' + k + '\\s+(.+)$', 'gm'))].map((m) => m[1].trim());
  assert.deepEqual(tag('name'), ['Torn: Refill Blood Bag Reminder']);
  assert.deepEqual(tag('namespace'), ['RussianRob']);
  assert.deepEqual(tag('author'), ['RussianRob']);
  assert.deepEqual(tag('version'), ['4.3.4']);
  assert.deepEqual(tag('license'), ['MIT'], 'ButtChew\'s licence stays');
  // The owner's words: the credit goes to ButtChew; this copy is just a fix.
  assert.match(tag('description')[0], /All credit goes to ButtChew \[3840391\], who wrote it \(Greasy Fork 548072\)/);
  assert.match(tag('description')[0], /this copy just adds a fix/);
  assert.deepEqual(tag('downloadURL'), ['https://tornwar.com/scripts/torn-refill-blood-bag-reminder.user.js']);
  assert.deepEqual(tag('updateURL'), ['https://tornwar.com/scripts/torn-refill-blood-bag-reminder.meta.js']);
  assert.deepEqual([...tag('homepageURL'), ...tag('supportURL')], [], 'no links to the original\'s pages');
  assert.equal(readFileSync(META, 'utf8'), header + '\n', 'the meta file is the header, byte for byte');
  assert.match(src, /\[Blood Bag v4\.3\.4\] Initialized/, 'the console line carries the same version');
  assert.match(src, /^\/\/ v4\.3\.4  - /m, 'the changelog has the 4.3.4 entry');
});
