// ==UserScript==
// @name         Torn Debuff Mobile Status
// @namespace    RussianRob
// @version      1.0.0
// @description  On Torn's phone attack page, shows your own +/-% stats and your effects (debuffs and boosts, with seconds left) in a row at the top of the enemy's window, so you can see them without leaving your weapons.
// @author       RussianRob
// @downloadURL  https://tornwar.com/scripts/torn-debuff-mobile-status.user.js
// @updateURL    https://tornwar.com/scripts/torn-debuff-mobile-status.meta.js
// @license      All Rights Reserved
// @match        https://www.torn.com/page.php?sid=attack*
// @match        https://www.torn.com/loader.php?sid=attack*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

// =============================================================================
// CHANGELOG
// =============================================================================
// v1.0.0  - First release. On the phone layout of the attack page, a row at the
//           top of the enemy's window shows your five +/-% and your effect icons
//           with the seconds left, so your own debuffs stay in view while you fight.

(function () {
  'use strict';

  // PDA can inject a script more than once; one copy is enough.
  if (window.__tdmsLoaded) return;
  window.__tdmsLoaded = true;

  const ROW_ID = 'tdms-row';
  const STYLE_ID = 'tdms-style';
  // Torn's strip order, with the short labels the row uses.
  const STATS = [['strength', 'str'], ['speed', 'spd'], ['dexterity', 'dex'], ['defense', 'def'], ['damage', 'dmg']];
  // The look the owner approved from the live mock-up (layout B). The row sits over the top
  // of the enemy's window, above Torn's own layers, and taps go straight through it.
  const CSS = [
    '#tdms-row{position:absolute;top:4px;left:4px;right:4px;z-index:20;pointer-events:none;font:11px/1.1 Arial,Helvetica,sans-serif;color:#fff}',
    '#tdms-row .tdms-stats{display:flex;align-items:stretch;gap:2px;background:rgba(0,0,0,.62);border:1px solid #6fae3f;border-radius:5px;padding:2px}',
    '#tdms-row .tdms-you{display:flex;align-items:center;padding:0 4px;background:#6fae3f;font-weight:bold;font-size:9px;border-radius:3px;letter-spacing:.5px}',
    '#tdms-row .tdms-stat{flex:1 1 0;min-width:0;display:flex;flex-direction:column;align-items:center;justify-content:center}',
    '#tdms-row .tdms-stat b{font-size:12px}',
    '#tdms-row .tdms-stat i{font-style:normal;font-size:8px;opacity:.8}',
    '#tdms-row .tdms-up b{color:#8fd16a}',
    '#tdms-row .tdms-down b{color:#ff6b5e}',
    '#tdms-row .tdms-icons{display:flex;flex-wrap:wrap;align-items:center;gap:4px;margin-top:4px}',
    '#tdms-row .tdms-icons[hidden]{display:none}',
    '#tdms-row .tdms-icon{width:34px;display:flex;flex-direction:column;align-items:center;background:rgba(0,0,0,.62);border:1px solid #888;border-radius:5px;padding:2px 0}',
    '#tdms-row .tdms-icon img{width:26px;height:26px}',
    '#tdms-row .tdms-icon i{font-style:normal;font-size:10px}',
  ].join('\n');

  let store = null;      // Torn's Redux store, once found
  let row = null;        // the row, built once and moved into whichever window Torn renders
  let pending = false;   // a repaint is booked for the next frame
  let reported = false;  // the first error has been logged
  let lastKey = '';      // what the row last showed, so dispatches that change none of it are skipped

  // Torn keeps the fight in a Redux store, on the props of a React fiber a few levels above
  // the players' box. Returns the box and the store; either can be null.
  function findStore() {
    const box = document.querySelector('[class*="playersModelWrap___"]');
    if (!box) return { box: null, store: null };
    const key = Object.keys(box).find((k) => k.startsWith('__reactFiber$'));
    for (let f = key ? box[key] : null, i = 0; f && i < 40; i++, f = f.return) {
      const p = f.memoizedProps;
      if (p && p.store && typeof p.store.getState === 'function' && typeof p.store.subscribe === 'function') {
        return { box, store: p.store };
      }
    }
    return { box, store: null };
  }

  // What the row draws, or null when it shouldn't show. It shows on Torn's phone layout (one
  // player window on the page) while the enemy's window is up: layout "attacker", Torn's
  // default. Tapping your own header switches the layout to "defender" and Torn shows your
  // own window, strip and all, so the row isn't needed then. You are always the attacker on
  // this page, and your numbers are the ones Torn's strip shows in your own window.
  function readView() {
    const state = store.getState() || {};
    const attack = state.attack || {};
    const me = attack.attackerUser;
    const mods = me && me.statsModifiers;
    if (!mods || !STATS.some(([k]) => mods[k] && typeof mods[k].value === 'number')) return null;
    const layout = state.activePlayerLayout && state.activePlayerLayout.activePlayerLayout;
    if (layout !== 'attacker') return null;
    const windows = (document.getElementById('attack-root') || document).querySelectorAll('[class*="playerWindow___"]');
    if (windows.length !== 1) return null;
    return {
      win: windows[0],
      stats: STATS.map(([k, label]) => ({ label, value: mods[k] && typeof mods[k].value === 'number' ? mods[k].value : 0 })),
    };
  }

  // Everything the row shows, as one string.
  function viewKey(view) {
    return view ? JSON.stringify(view.stats.map((s) => s.value)) : 'none';
  }

  // Logs the first error only, so a change on Torn's side shows up without flooding the console.
  function report(err) {
    if (reported) return;
    reported = true;
    console.info('[Torn Debuff Mobile Status] ' + (err && err.message ? err.message : String(err)));
  }

  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = CSS;
    (document.head || document.documentElement).appendChild(style);
  }

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  // The row has two lines: the numbers line, then the icons line under it.
  function buildRow() {
    const r = el('div');
    r.id = ROW_ID;
    r.appendChild(el('div', 'tdms-stats'));
    r.appendChild(el('div', 'tdms-icons'));
    return r;
  }

  // The numbers line: YOU, then the five values. Rebuilt only when a value changes.
  function drawStats(line, stats) {
    const key = stats.map((s) => s.value).join(',');
    if (line.getAttribute('data-key') === key) return;
    line.setAttribute('data-key', key);
    line.textContent = '';
    line.appendChild(el('span', 'tdms-you', 'YOU'));
    for (const s of stats) {
      const cell = el('span', 'tdms-stat' + (s.value > 0 ? ' tdms-up' : s.value < 0 ? ' tdms-down' : ''));
      cell.appendChild(el('b', '', (s.value < 0 ? '-' : '+') + Math.abs(s.value) + '%'));
      cell.appendChild(el('i', '', s.label));
      line.appendChild(cell);
    }
  }

  // Draws the row from Torn's current state, putting it into the enemy's window or taking it
  // out. Safe to run any number of times: it only touches the page where something differs.
  function paint() {
    pending = false;
    try {
      const view = readView();
      lastKey = viewKey(view);
      if (!view) {
        if (row && row.parentNode) row.parentNode.removeChild(row);
        return;
      }
      const host = view.win.querySelector('[class*="allLayers___"]') || view.win;
      if (!row) row = buildRow();
      if (row.parentNode !== host) host.appendChild(row);
      drawStats(row.firstChild, view.stats);
    } catch (err) {
      report(err);
    }
  }

  // One repaint per frame, however many things ask for one.
  function schedule() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(paint);
  }

  // Torn's store calls back on every dispatch, hits and animations included, so repaint only
  // when something the row shows has changed. Nothing may be thrown from here: an error in a
  // Redux listener stops the dispatch, and Torn's own listeners with it.
  function onStore() {
    try {
      if (viewKey(readView()) !== lastKey) schedule();
    } catch (err) {
      report(err);
    }
  }

  // Torn rebuilds the window without the store changing (the phone turning, React remounting
  // it), and the row goes with it. Book a repaint for any change in the attack app except our
  // own: changes inside the row, or the row itself being added or removed. That way this can't
  // set itself off, and the repaint changes nothing when the row is already in place.
  function onMutations(records) {
    for (const m of records) {
      if (row && (m.target === row || row.contains(m.target))) continue;
      const nodes = [...m.addedNodes, ...m.removedNodes];
      if (nodes.length && nodes.every((n) => n === row)) continue;
      schedule();
      return;
    }
  }

  function attach(s) {
    store = s;
    ensureStyle();
    store.subscribe(onStore);
    const root = document.getElementById('attack-root');
    if (root) new MutationObserver(onMutations).observe(root, { childList: true, subtree: true });
    schedule();
  }

  // Torn's attack app renders after the page loads, and PDA can run this script before that,
  // so look for the players' box and its store every 500 ms. A page that shows an error
  // instead of a fight never gets a box and keeps looking, one selector lookup each time. A
  // box with no store means Torn has changed its page, so give up after 10 seconds.
  let waited = 0;
  function tryAttach() {
    const found = findStore();
    if (found.store) {
      clearInterval(finder);
      attach(found.store);
      return;
    }
    if (found.box && (waited += 500) >= 10000) {
      clearInterval(finder);
      console.info('[Torn Debuff Mobile Status] Torn\'s fight data was not found on this page, so there is nothing to show.');
    }
  }
  const finder = setInterval(tryAttach, 500);
  tryAttach();
})();
