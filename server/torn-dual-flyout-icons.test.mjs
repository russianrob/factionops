// torn-dual-flyout: every icon in Torn's fly-out menu gets its own compositing layer.
//
// Torn's fly-out icons are SVGs with a CSS drop-shadow. On iOS 18 WebKit draws them
// only for the part of the scrolling panel that is on screen when the menu opens, and
// never redraws them on scroll, so the icons scrolled out of view stay blank: the
// bottom ones if the menu was left scrolled to the top, the top ones if it was left at
// the bottom. On the owner's iPhone (2026-10-20, Torn Flyout Diag) giving each icon
// its own layer with translateZ(0) fixed it in 2 of 2 opens and kept the shadow; a
// forced repaint and a 1px scroll nudge did not, and it happened with this script's
// stylesheet switched off too, so the fault is Torn's CSS plus WebKit.
//
// linkedom has no cascade, so these tests run the real script and resolve the
// stylesheet it injects against Torn's fly-out markup with element.matches().
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseHTML } from 'linkedom';

// TDF_SRC lets a working copy be tested before it is installed over the served file.
const SRC = process.env.TDF_SRC || '/opt/warboard/server/public/scripts/torn-dual-flyout.user.js';

// Torn's fly-out markup, cut down: the account links (icon, then its unread badge) and
// menu rows whose icon paths carry their own transform attributes, as Torn's do.
function load({ side = 'r', iconsOnly = false } = {}) {
  const src = readFileSync(SRC, 'utf8');
  const { document } = parseHTML(`<html><head></head><body>
    <div id="sidebarroot"><div id="sidebar">
      <aside id="fly-out-panel" class="flyOutPanel___Zqwqt visible___AnarB">
        <div class="accountLinksWrap___wnKEu mobile___hMyTx"><div class="accountLinks___GEnNc">
          <div class="wrap___zBGBU"><a href="/awards.php" class="awards___yD4LU" id="nav-awards">
            <svg id="awards-icon" viewBox="2 0 34 34"><path id="awards-path" transform="translate(709 175)" d="M0 0h4v4z"/></svg>
            <span class="amount___vyASa">3</span>
          </a></div>
        </div></div>
        <a class="link___tg6eQ" href="/gym.php"><span class="svgIconWrap___MDuQ8"><span class="defaultIcon___GnL0d mobile___nUzYc">
          <svg id="gym-icon" viewBox="0 0 20 10"><path d="M0 0h20v10z"/></svg>
        </span></span><span>Gym</span></a>
        <a class="link___tg6eQ" href="/halloffame.php"><span class="svgIconWrap___MDuQ8"><span class="defaultIcon___GnL0d mobile___nUzYc">
          <svg id="hof-icon" viewBox="0 0 16 16"><path d="M0 0h16v16z"/></svg>
        </span></span><span>Hall of Fame</span></a>
      </aside>
    </div></div>
    <div id="header-root"><div class="wrap"><button id="fly-out-menu-button"><svg id="menu-icon"><path d="M0 0h1v1z"/></svg></button></div></div>
  </body></html>`);
  document.getElementById('fly-out-menu-button').getClientRects = () => [{}];

  const store = new Map([['tmr_side', side], ['tdf_iconsonly', iconsOnly ? '1' : '0']]);
  const localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  };
  document.addEventListener = () => {};
  const win = { innerWidth: 393, addEventListener() {} };
  new Function('window', 'document', 'localStorage', 'MutationObserver', 'getComputedStyle',
    'setInterval', 'setTimeout', 'clearInterval', src)(
    win, document, localStorage, class { observe() {} }, () => ({}),
    () => 0, () => 0, () => {});
  return document;
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

test('fly-out icons scrolled into view are drawn: each icon has its own layer, menu on either side and in icons-only mode', () => {
  for (const side of ['r', 'l']) {
    for (const iconsOnly of [false, true]) {
      const document = load({ side, iconsOnly });
      for (const id of ['awards-icon', 'gym-icon', 'hof-icon']) {
        const transform = styledBy(document, document.getElementById(id)).transform || '';
        assert.match(transform, /translateZ\(0\)/, `${id}, side ${side}, icons-only ${iconsOnly}`);
      }
    }
  }
});

test('the shapes inside an icon keep their own transforms', () => {
  // Torn places some icon paths with a transform attribute (the awards icon's
  // translate(709 175)); a CSS transform reaching inside the svg would replace it.
  const document = load();
  assert.equal(styledBy(document, document.getElementById('awards-path')).transform, undefined);
});

test('svgs outside the fly-out are left alone', () => {
  // A layer per svg is only worth its memory where the paint bug is: the header's
  // menu-button icon is not inside the scrolling panel.
  const document = load();
  assert.equal(styledBy(document, document.getElementById('menu-icon')).transform, undefined);
});
