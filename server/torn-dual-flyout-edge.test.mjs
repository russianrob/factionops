// torn-dual-flyout: a swipe that starts at the very edge of the screen belongs
// to the phone, not to the menu.
//
// iOS (Safari, and the warboard app's web view, which has swipe-to-navigate on)
// and Android gesture navigation both use a swipe that starts at the screen edge
// for back/forward. Up to 1.5.14 the open swipe was taken from anywhere, so an
// edge swipe went back a page AND popped the menu open. The owner checked on
// 2026-10-20: a swipe started a thumb-width in does not navigate, so only swipes
// that start at the edge are handed to the phone.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseHTML } from 'linkedom';

// TDF_SRC lets a working copy be tested before it is installed over the served file.
const SRC = process.env.TDF_SRC || '/opt/warboard/server/public/scripts/torn-dual-flyout.user.js';
const VW = 393;   // the owner's iPhone width in CSS px

// Runs the real script against Torn's flyout markup. The menu button's React
// onClick is the only thing that opens or closes the menu; like Torn's, it
// toggles the panel's visible___ class.
function load({ side = 'r', open = false } = {}) {
  const src = readFileSync(SRC, 'utf8');
  const { document } = parseHTML(`<html><head></head><body>
    <div id="sidebarroot"><div id="sidebar">
      <div id="fly-out-panel" class="flyOutPanel___Zqwqt${open ? ' visible___AnarB' : ''}"></div>
    </div></div>
    <div id="header-root"><div class="wrap"><button id="fly-out-menu-button"></button></div></div>
    <div id="content"></div>
  </body></html>`);
  const panel = document.getElementById('fly-out-panel');
  const btn = document.getElementById('fly-out-menu-button');
  btn.getClientRects = () => [{}];   // laid out: the mobile header is showing
  const clicks = [];
  btn.__reactProps$tdftest = { onClick() { clicks.push(1); panel.classList.toggle('visible___AnarB'); } };

  const store = new Map([['tmr_side', side]]);
  const localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  };
  const handlers = {};
  document.addEventListener = (type, fn) => { handlers[type] = fn; };
  const timeouts = [];
  const win = { innerWidth: VW, addEventListener() {} };
  new Function('window', 'document', 'localStorage', 'MutationObserver', 'getComputedStyle',
    'setInterval', 'setTimeout', 'clearInterval', src)(
    win, document, localStorage, class { observe() {} }, () => ({}),
    () => 0, (fn) => { timeouts.push(fn); return 0; }, () => {});

  // One finger from x0 to x1 at a fixed height, with moves along the way.
  function swipe(x0, x1, y = 300) {
    const at = (x) => [{ clientX: x, clientY: y, identifier: 0 }];
    handlers.touchstart({ touches: at(x0), target: document.getElementById('content') });
    handlers.touchmove({ touches: at(x0 + (x1 - x0) / 2) });
    handlers.touchmove({ touches: at(x1) });
    handlers.touchend({ changedTouches: at(x1) });
    while (timeouts.length) timeouts.shift()();
  }
  return { swipe, clicks, store, html: document.documentElement, panel };
}

test('a swipe from the left edge (the phone\'s back gesture) does not open the menu', () => {
  const page = load({ side: 'r' });
  page.swipe(10, 160);
  assert.equal(page.clicks.length, 0);
});

test('a swipe from the right edge (the phone\'s forward gesture) does not open the menu', () => {
  const page = load({ side: 'r' });
  page.swipe(VW - 10, VW - 160);
  assert.equal(page.clicks.length, 0);
});

test('an edge swipe leaves the saved menu side alone', () => {
  const page = load({ side: 'r' });
  page.swipe(10, 160);   // rightward, so the old code flipped the menu to the left mid-swipe
  assert.equal(page.store.get('tmr_side'), 'r');
  assert.ok(page.html.classList.contains('tmr-right'));
});

test('a swipe started a thumb-width in still opens the menu on the side it points to', () => {
  const right = load({ side: 'l' });
  right.swipe(VW - 60, VW - 210);   // leftward opens on the right
  assert.equal(right.clicks.length, 1);
  assert.equal(right.store.get('tmr_side'), 'r');

  const left = load({ side: 'r' });
  left.swipe(60, 210);              // rightward opens on the left
  assert.equal(left.clicks.length, 1);
  assert.equal(left.store.get('tmr_side'), 'l');
});

test('closing is unchanged: an open right-side menu still closes from 27px in', () => {
  // Close swipes keep their own, narrower 24px edge rule; the open-swipe edge
  // must not leak into it.
  const page = load({ side: 'r', open: true });
  page.swipe(27, 177);
  assert.equal(page.clicks.length, 1);
  assert.ok(!/visible___/.test(page.panel.className));
});
