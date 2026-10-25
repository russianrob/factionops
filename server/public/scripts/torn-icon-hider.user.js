// ==UserScript==
// @name         Torn Icon Hider
// @namespace    RussianRob
// @version      1.0.0
// @description  Choose which of Torn's status icons show in your sidebar row: a long press on any of them, or the menu, opens a list of every icon seen there, and one you untick stays hidden until you tick it again.
// @author       RussianRob
// @downloadURL  https://tornwar.com/scripts/torn-icon-hider.user.js
// @updateURL    https://tornwar.com/scripts/torn-icon-hider.meta.js
// @license      All Rights Reserved
// @match        https://www.torn.com/*
// @match        https://torn.com/*
// @run-at       document-start
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// ==/UserScript==

// =============================================================================
// CHANGELOG
// =============================================================================
// v1.0.0  - First release. Choose which of Torn's status icons show in your sidebar
//           row. A long press on any of them, or "Icon Hider: Settings" in the menu,
//           opens a list of every icon seen in your row: untick one to hide it.

(function () {
  'use strict';

  const VERSION = '1.0.0';

  // Loaded twice on one page (two copies installed, or PDA injecting it again), it runs once.
  // The mark goes on the page itself, which every copy can see; each copy may have its own window.
  const root = document.documentElement;
  if (root.hasAttribute('data-tm-icon-hider')) return;
  root.setAttribute('data-tm-icon-hider', VERSION);

  const STYLE_ID = 'tm-icon-hider-styles';
  // The row of status icons. Torn's old sidebar calls it status-icons___ and the Fly-out
  // Sidebar statusIcons___. Only inside #sidebar: other parts of a page (faction member lists,
  // profiles) draw icons with the same classes, and those are left alone.
  const ROWS = ['#sidebar ul[class*="status-icons"]', '#sidebar ul[class*="statusIcons___"]'];
  const ROW_SELECTOR = ROWS.join(', ');
  const POLL_MS = 2000;
  // GM storage: what the script has learned about each kind of icon, and which kinds are hidden.
  // Two values, so a tab learning a new icon can't undo a save made in another tab.
  const KINDS_STORE = 'tih-kinds';
  const HIDDEN_STORE = 'tih-hidden';
  // Picture numbers Torn gives the levels of one kind: booster cooldown, medical cooldown, drug
  // cooldown, drug addiction, radiation and upkeep (from TornTools' list of Torn's icons). When
  // a hidden kind has a number in one of these, the whole range is hidden, so a new level never
  // shows.
  const LEVELS = [[39, 43], [44, 48], [49, 53], [57, 61], [63, 67], [78, 80]];
  // The desktop row: Torn's big icons, 6 a line, not the phone strip.
  const DESKTOP_ROWS = ROWS.map((row) => row + '[class*="big___"]:not([class*="mobile___"])');
  const SETTINGS_ID = 'tm-icon-hider-settings';
  // After a save, the box says so for this long, then closes.
  const SAVED_MS = 1000;
  // Torn's own icon pictures: one sprite with a picture every 18 px, picture N at -(N-1)*18 px.
  const SPRITE_URL = 'https://www.torn.com/images/v2/svg_icons/sprites/user_status_icons_sprite.svg';
  const HELP = 'Untick an icon to hide it. Hidden icons stay in this list, so you can bring them back. '
    + 'A long press on any icon in the row opens these settings.';
  const PDA_HELP = ' Torn PDA has no script menu, so one icon always stays showing.';
  const KEEP_ONE = 'Keep one icon showing: in Torn PDA, a long press on an icon is the only way back here.';
  // A press this long on one of Torn's icons opens the settings box, as the Xanax Reminder's does.
  const LONG_PRESS_MS = 500;
  // A finger may wobble this far before the press counts as a move (a scroll of the strip).
  const SLOP_PX = 10;
  // After a long press, the click it ends in is stopped if it comes this soon. Mouse events this
  // soon after a touch are the phone's copies of it, and start no press.
  const AFTER_PRESS_MS = 600;

  // ===== GM STORAGE =====

  // Every GM_* call is guarded, because hosts differ in what they give a script.
  function gmGet(name) {
    try {
      return typeof GM_getValue === 'function' ? GM_getValue(name, '') : '';
    } catch (e) {
      return '';
    }
  }

  // True when the value was saved. A full localStorage, where PDA keeps GM values, throws.
  function gmSet(name, value) {
    try {
      if (typeof GM_setValue === 'function') {
        GM_setValue(name, value);
        return true;
      }
    } catch (e) {
      // Not saved: the caller decides what to do without it.
    }
    return false;
  }

  // True when storage kept the value: saved, then read back the same. Some hosts drop a write
  // without throwing.
  function saveChecked(name, value) {
    return gmSet(name, value) && gmGet(name) === value;
  }

  // A stored value, read from its JSON. PDA hands values back as strings; a host that hands back
  // the object itself works too. null when nothing is saved, or the value won't parse.
  function readJson(name) {
    const raw = gmGet(name);
    if (raw && typeof raw === 'object') return raw;
    try {
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  // True when obj has its own key: Torn's keys and stored keys are plain words, but a word like
  // "constructor" must never read as something every object has.
  function own(obj, key) {
    return Object.prototype.hasOwnProperty.call(obj, key);
  }

  // ===== TORN'S SIDEBAR DATA =====

  // statusIcons.icons from the data both of Torn's sidebars save to sessionStorage on every
  // change: one entry per icon in the row, in the row's order. null when the data isn't there,
  // won't parse or has no icons (some pages have no sidebar).
  function readIcons() {
    try {
      const key = Object.keys(sessionStorage).find((k) => /^sidebarData\d+$/.test(k));
      if (!key) return null;
      const data = JSON.parse(sessionStorage.getItem(key));
      const icons = data && data.statusIcons && data.statusIcons.icons;
      return icons && typeof icons === 'object' ? icons : null;
    } catch (e) {
      return null;
    }
  }

  // The picture number of one of Torn's entries ("icon52" is 52), or 0 for an entry the script
  // can't hide. Torn draws the icon with the class named for that number.
  function iconNumber(entry) {
    const m = entry && typeof entry === 'object' ? /^icon(\d+)$/.exec(String(entry.iconID || '')) : null;
    return m ? Number(m[1]) : 0;
  }

  // The picture number of Torn's icon in the row, from its class (icon52____l66f is 52), or 0
  // for any other li (the Xanax and Blood Bag icons have no such class).
  function numberOf(li) {
    const m = /(?:^|\s)icon(\d+)_/.exec(li && li.className ? String(li.className) : '');
    return m ? Number(m[1]) : 0;
  }

  // A title as the icon's label reads it: Torn's label is the title's text, without any HTML.
  function plainTitle(value) {
    return String(value == null ? '' : value)
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, '\'')
      .replace(/&amp;/g, '&')
      .replace(/\s+/g, ' ')
      .trim();
  }

  // ===== KINDS OF ICON =====

  // What the script has learned: { key: { title, ids } } for each kind of icon seen in the row,
  // where ids are the picture numbers seen with it, the last one learned last. Anything stored
  // that doesn't read as that is left out.
  function readKinds() {
    const data = readJson(KINDS_STORE);
    const kinds = {};
    if (!data || typeof data !== 'object' || Array.isArray(data)) return kinds;
    Object.keys(data).forEach((key) => {
      const kind = data[key];
      if (!kind || typeof kind !== 'object' || !Array.isArray(kind.ids)) return;
      const ids = kind.ids.map(Number).filter((n, i, all) => Number.isInteger(n) && n > 0 && all.indexOf(n) === i);
      if (!ids.length) return;
      kinds[key] = { title: typeof kind.title === 'string' && kind.title ? kind.title : key, ids };
    });
    return kinds;
  }

  // The keys of the hidden kinds.
  function readHidden() {
    const data = readJson(HIDDEN_STORE);
    return Array.isArray(data) ? data.filter((key) => typeof key === 'string') : [];
  }

  // Learns the kinds of icon in Torn's data: a new kind, a new picture number or a new title.
  // A picture number belongs to the kind it was last seen with, so it leaves any other kind, and
  // a kind left with none is dropped. Only titles are kept, never the details after them (a
  // timer, a name). True when anything changed.
  function learn(kinds, icons) {
    let changed = false;
    Object.keys(icons).forEach((key) => {
      const n = iconNumber(icons[key]);
      if (!n) return;
      Object.keys(kinds).forEach((other) => {
        const at = other === key ? -1 : kinds[other].ids.indexOf(n);
        if (at < 0) return;
        kinds[other].ids.splice(at, 1);
        if (!kinds[other].ids.length) delete kinds[other];
        changed = true;
      });
      const title = plainTitle(icons[key].title) || key;
      if (!own(kinds, key)) {
        kinds[key] = { title, ids: [n] };
        changed = true;
        return;
      }
      if (kinds[key].title !== title) {
        kinds[key].title = title;
        changed = true;
      }
      if (kinds[key].ids.indexOf(n) < 0) {
        kinds[key].ids.push(n);
        changed = true;
      }
    });
    return changed;
  }

  // The kinds as stored, with anything new in Torn's data learned and saved.
  function learned() {
    const kinds = readKinds();
    const icons = readIcons();
    if (icons && learn(kinds, icons)) gmSet(KINDS_STORE, JSON.stringify(kinds));
    return kinds;
  }

  // The picture numbers to hide: every number of every hidden kind, and the whole level range of
  // any of them that is in one. A kind that is switched on is never hidden by another kind's
  // numbers.
  function hiddenNumbers(kinds, hidden) {
    const shown = {};
    Object.keys(kinds).forEach((key) => {
      if (hidden.indexOf(key) < 0) kinds[key].ids.forEach((n) => { shown[n] = true; });
    });
    const out = {};
    hidden.forEach((key) => {
      if (!own(kinds, key)) return;
      kinds[key].ids.forEach((n) => {
        out[n] = true;
        LEVELS.forEach((range) => {
          if (n < range[0] || n > range[1]) return;
          for (let m = range[0]; m <= range[1]; m += 1) if (!shown[m]) out[m] = true;
        });
      });
    });
    return Object.keys(out).map(Number).sort((a, b) => a - b);
  }

  // ===== THE STYLESHEET =====

  // No iPhone link menu and no text selection on a long press of Torn's icons in the row. The
  // phone decides when the finger lands, so this is on all the time.
  const CALLOUT_CSS = ROWS.map((row) => row + ' > li[class*="icon"] a').join(', ')
    + ' { -webkit-touch-callout: none !important; -webkit-user-select: none !important; user-select: none !important; }';

  // Torn spaces the desktop row with a 10 px right margin on every icon but each 6th
  // (li:nth-child(6n)). A hidden icon still counts in that 6th, so lines would come out uneven.
  // While something is hidden, the row is a wrapping flex row with a 10 px gap and no margins
  // instead: 6 x 17 px and 5 x 10 px fill its 152 px exactly, as Torn's lines do.
  const SPACING_CSS = [
    DESKTOP_ROWS.join(', ') + ' { display: flex !important; flex-wrap: wrap !important; column-gap: 10px !important; row-gap: 0 !important; }',
    DESKTOP_ROWS.map((row) => row + ' > li').join(', ') + ' { flex: none !important; margin-right: 0 !important; }',
  ].join('\n');

  // The settings box, laid out like the Xanax Reminder's.
  const BOX_CSS = [
    '#' + SETTINGS_ID + ' { position: fixed; top: 0; right: 0; bottom: 0; left: 0; z-index: 100000; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,.8); }',
    '#' + SETTINGS_ID + ' .tm-tih-panel { box-sizing: border-box; display: flex; flex-direction: column; width: 450px; max-width: 90%; max-height: 90%; border-radius: 10px; background: #2e2e2e; color: #ccc; box-shadow: 0 4px 20px rgba(0,0,0,.5); font: 400 14px/18px Arial, sans-serif; text-align: left; }',
    '#' + SETTINGS_ID + ' .tm-tih-head { display: flex; flex: none; align-items: center; justify-content: space-between; padding: 15px 20px; border-radius: 10px 10px 0 0; background: linear-gradient(to bottom, #1a1a1a, #2a2a2a); }',
    '#' + SETTINGS_ID + ' .tm-tih-head b { color: #fff; font-size: 18px; }',
    '#' + SETTINGS_ID + ' .tm-tih-head button { width: 30px; height: 30px; padding: 0; border: none; background: none; color: #aaa; font: 24px Arial, sans-serif; cursor: pointer; }',
    '#' + SETTINGS_ID + ' .tm-tih-body { display: flex; flex-direction: column; min-height: 0; padding: 20px; }',
    '#' + SETTINGS_ID + ' p { margin: 0 0 15px; color: #888; font-size: 12px; line-height: 16px; }',
    // The list scrolls inside the box when it is taller than the screen.
    '#' + SETTINGS_ID + ' .tm-tih-list { min-height: 0; margin-bottom: 15px; overflow-y: auto; }',
    '#' + SETTINGS_ID + ' .tm-tih-group { margin: 10px 0 4px; color: #aaa; font-size: 12px; }',
    // 16px, or an iPhone zooms in when a switch is tapped.
    '#' + SETTINGS_ID + ' label { display: flex; align-items: center; gap: 10px; padding: 6px 0; color: #fff; font: 16px Arial, sans-serif; cursor: pointer; }',
    '#' + SETTINGS_ID + ' input { flex: none; width: 18px; height: 18px; margin: 0; }',
    '#' + SETTINGS_ID + ' .tm-tih-pic { flex: none; width: 17px; height: 17px; background: url("' + SPRITE_URL + '") no-repeat; }',
    '#' + SETTINGS_ID + ' p.tm-tih-message { margin: 0 0 10px; color: #a3c248; font-size: 14px; }',
    '#' + SETTINGS_ID + ' p.tm-tih-bad { color: #e8735a; }',
    '#' + SETTINGS_ID + ' .tm-tih-buttons { display: flex; flex: none; justify-content: flex-end; gap: 10px; }',
    '#' + SETTINGS_ID + ' .tm-tih-buttons button { padding: 10px 20px; border: none; border-radius: 5px; background: linear-gradient(to bottom, #555, #777); color: #fff; font: 14px Arial, sans-serif; cursor: pointer; }',
    '#' + SETTINGS_ID + ' .tm-tih-buttons .tm-tih-save { background: linear-gradient(to bottom, #799427, #a3c248); }',
  ].join('\n');

  // One rule per hidden picture number, for Torn's icon with that number in the row. The ___
  // after the number keeps icon5 from matching icon52; some of Torn's class names have four
  // underscores (icon52____l66f), and those match too.
  function hideRule(n) {
    return ROWS.map((row) => row + ' > li[class*="icon' + n + '___"]').join(', ') + ' { display: none !important; }';
  }

  // The whole stylesheet for these hidden numbers.
  function cssText(numbers) {
    const rules = [CALLOUT_CSS, BOX_CSS];
    if (numbers.length) rules.push(SPACING_CSS);
    return rules.concat(numbers.map(hideRule)).join('\n');
  }

  // Puts the stylesheet in the page, or back in it if something took it out, and brings it up
  // to date. At document-start there is no <head> yet, so it goes in <html>. Its text is written
  // only when it changes.
  function applyStyles(numbers) {
    const css = cssText(numbers);
    let style = document.getElementById(STYLE_ID);
    if (!style) {
      style = document.createElement('style');
      style.id = STYLE_ID;
      (document.head || root).appendChild(style);
    }
    if (style.textContent === css) return;
    style.textContent = css;
    nudgeStrip();
  }

  // Torn works out the fade at the phone strip's right edge (meaning "more to scroll") only on
  // load, on a resize and on a scroll, so it would stay after icons are hidden. Both sidebars
  // listen for scroll on the strip itself, so one sent there makes them work it out again.
  function nudgeStrip() {
    const row = document.querySelector(ROW_SELECTOR);
    if (row && row.parentElement) row.parentElement.dispatchEvent(new Event('scroll'));
  }

  // ===== THE SETTINGS BOX =====

  // The timer that closes the box a second after a save.
  let savedTimer = null;

  // Opens from the menu ("Icon Hider: Settings") or a long press on one of Torn's icons, over
  // everything else, laid out like the Xanax Reminder's settings: a switch for every kind of icon
  // seen in the row, ticked when it shows. Nothing changes in the row until Save. Nothing is
  // focused when it opens.
  function openSettings() {
    closeSettings();
    const kinds = learned();
    const hidden = readHidden();
    const pda = isPda();
    const overlay = make('div');
    overlay.id = SETTINGS_ID;
    const panel = make('div', '', 'tm-tih-panel');
    const head = make('div', '', 'tm-tih-head');
    head.appendChild(make('b', 'Icon Hider Settings'));
    head.appendChild(button('x', closeSettings));
    const list = make('div', '', 'tm-tih-list');
    const groups = listGroups(kinds);
    if (!groups.inRow.length && !groups.seen.length) list.appendChild(make('p', 'No icons seen yet.'));
    [['In your row now', groups.inRow], ['Seen before', groups.seen]].forEach((group) => {
      if (!group[1].length) return;
      list.appendChild(make('div', group[0], 'tm-tih-group'));
      group[1].forEach((item) => list.appendChild(switchLine(item, kinds[item.key].title, hidden.indexOf(item.key) < 0)));
    });
    const message = make('p', '', 'tm-tih-message');
    const say = (words, ok) => {
      message.textContent = words;
      message.classList.toggle('tm-tih-bad', !ok);
    };
    // Save keeps the kinds that are unticked. A save counts only when storage gives the value
    // back: then the row changes at once and the box closes a second later. When it doesn't, the
    // box says so and stays open, and what was saved before is kept.
    const save = () => {
      const next = [...list.querySelectorAll('input')].filter((box) => !box.checked).map((box) => box.getAttribute('data-key'));
      if (pda && !leavesOneShowing(kinds, next)) {
        say(KEEP_ONE, false);
        return;
      }
      const before = gmGet(HIDDEN_STORE);
      if (!saveChecked(HIDDEN_STORE, JSON.stringify(next))) {
        if (gmGet(HIDDEN_STORE) !== before) gmSet(HIDDEN_STORE, before);
        say('Couldn\'t save, try again.', false);
        return;
      }
      say('Saved.', true);
      check();
      clearTimeout(savedTimer);
      savedTimer = setTimeout(closeSettings, SAVED_MS);
    };
    const buttons = make('div', '', 'tm-tih-buttons');
    buttons.appendChild(button('Cancel', closeSettings));
    buttons.appendChild(button('Save', save, 'tm-tih-save'));
    const body = make('div', '', 'tm-tih-body');
    [make('p', HELP + (pda ? PDA_HELP : '')), list, message, buttons].forEach((el) => body.appendChild(el));
    panel.appendChild(head);
    panel.appendChild(body);
    overlay.appendChild(panel);
    // A tap on the dark area around the box is Cancel.
    overlay.addEventListener('click', safely((e) => {
      if (e.target === overlay) closeSettings();
    }));
    (document.body || root).appendChild(overlay);
  }

  // The kinds for the list: those in Torn's data now, in the row's order, then the rest by title.
  // Each comes with the picture number to draw: the one in the row now, or the last one learned.
  function listGroups(kinds) {
    const icons = readIcons() || {};
    const inRow = Object.keys(icons)
      .filter((key) => iconNumber(icons[key]) && own(kinds, key))
      .map((key) => ({ key, n: iconNumber(icons[key]) }));
    const seen = Object.keys(kinds)
      .filter((key) => !inRow.some((item) => item.key === key))
      .sort((a, b) => kinds[a].title.localeCompare(kinds[b].title))
      .map((key) => ({ key, n: kinds[key].ids[kinds[key].ids.length - 1] }));
    return { inRow, seen };
  }

  // One line of the list: a checkbox (ticked when the kind shows), Torn's picture and Torn's
  // title. The whole line is a label, so a tap anywhere on it flips the switch.
  function switchLine(item, title, shown) {
    const line = make('label');
    const box = make('input');
    box.type = 'checkbox';
    box.checked = shown;
    box.setAttribute('data-key', item.key);
    const pic = make('span', '', 'tm-tih-pic');
    pic.setAttribute('style', 'background-position: ' + (-(item.n - 1) * 18) + 'px 0');
    line.appendChild(box);
    line.appendChild(pic);
    line.appendChild(make('span', title));
    return line;
  }

  // Torn PDA, told apart as FactionOps does it: PDA's bridge (without the warboard app's own
  // bridge, as the warboard app once offered PDA's name too), or PDA's user agent. PDA shows no
  // script menu, so a long press on an icon is the only way back to the box there. Asked each
  // time the box opens, not at start: the script starts before the page has anything, and PDA's
  // bridge may come later.
  function isPda() {
    try {
      const warboard = !!(window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.gmBridge);
      if (typeof window.flutter_inappwebview !== 'undefined' && !warboard) return true;
      return /TornPDA|tornpda|DalvikTornPDA|com\.manuito/i.test(navigator.userAgent || '');
    } catch (e) {
      return false;
    }
  }

  // In PDA, true when at least one of Torn's icons in the row would still show with these kinds
  // hidden. With no row, or no Torn icon in it, there is nothing to keep.
  function leavesOneShowing(kinds, hidden) {
    const row = document.querySelector(ROW_SELECTOR);
    const numbers = row ? [...row.children].map(numberOf).filter(Boolean) : [];
    if (!numbers.length) return true;
    const gone = hiddenNumbers(kinds, hidden);
    return numbers.some((n) => gone.indexOf(n) < 0);
  }

  function closeSettings() {
    clearTimeout(savedTimer);
    savedTimer = null;
    const box = document.getElementById(SETTINGS_ID);
    if (box) box.remove();
  }

  // Escape closes the box without a change.
  function onKeyDown(e) {
    if (e.key === 'Escape' && document.getElementById(SETTINGS_ID)) closeSettings();
  }

  // An element with its text and class; either may be left out.
  function make(tag, text, className) {
    const el = document.createElement(tag);
    if (text) el.textContent = text;
    if (className) el.className = className;
    return el;
  }

  function button(words, onClick, className) {
    const b = make('button', words, className);
    b.type = 'button';
    b.addEventListener('click', safely(onClick));
    return b;
  }

  // ===== THE LONG PRESS =====

  let pressTimer = null;
  // Torn's icon being pressed, and where the finger landed on it.
  let pressed = null;
  let startX = 0;
  let startY = 0;
  // A long press just opened the box, and the press hasn't ended yet.
  let longPressed = false;
  // Until when the click a long press ends in is stopped, in ms.
  let stopClickUntil = 0;
  // When the last touch ended, in ms.
  let touchedAt = -Infinity;

  // Torn's own icon in the row that an event happened on, or null: an li with an iconN___ class
  // in the row. The Xanax and Blood Bag icons have no such class, and keep their own long press.
  function tornIcon(target) {
    const el = target && target.nodeType === 1 ? target : (target && target.parentElement) || null;
    const li = el && typeof el.closest === 'function' ? el.closest('li') : null;
    if (!li || !numberOf(li)) return null;
    const row = li.parentElement;
    return row && row.matches(ROW_SELECTOR) ? li : null;
  }

  function startPress(li) {
    longPressed = false;
    stopClickUntil = 0;
    clearTimeout(pressTimer);
    pressed = li;
    pressTimer = setTimeout(() => {
      pressTimer = null;
      pressed = null;
      longPressed = true;
      openSettings();
    }, LONG_PRESS_MS);
  }

  function cancelPress() {
    clearTimeout(pressTimer);
    pressTimer = null;
    pressed = null;
  }

  // A finger on one of Torn's icons starts a press. A second finger (a pinch) cancels it.
  function onTouchStart(e) {
    // A new touch is a new tap, so the click a long press ended in has come and gone.
    stopClickUntil = 0;
    const touches = e.touches || [];
    if (touches.length > 1) {
      cancelPress();
      return;
    }
    const li = tornIcon(e.target);
    if (!li) return;
    startX = touches[0] ? touches[0].clientX : 0;
    startY = touches[0] ? touches[0].clientY : 0;
    startPress(li);
  }

  // A finger moving more than a wobble (scrolling the strip, say) cancels the press.
  function onTouchMove(e) {
    if (!pressed) return;
    const t = e.touches && e.touches[0];
    if (!t || Math.abs(t.clientX - startX) > SLOP_PX || Math.abs(t.clientY - startY) > SLOP_PX) cancelPress();
  }

  // The main mouse button on one of Torn's icons starts a press. A right-click keeps its menu,
  // and mouse events that follow a touch are the phone's copies of it.
  function onMouseDown(e) {
    if (e.button !== 0 || Date.now() - touchedAt < AFTER_PRESS_MS) return;
    // A new press of the mouse's own, not a phone's copy of a touch: that click has come and gone too.
    stopClickUntil = 0;
    const li = tornIcon(e.target);
    if (li) startPress(li);
  }

  // The mouse leaving the icon cancels the press.
  function onMouseOut(e) {
    if (pressed && !(e.relatedTarget && pressed.contains(e.relatedTarget))) cancelPress();
  }

  // Letting go. After a long press, a touch's end is cancelled, which stops the click it would
  // make: that keeps Torn from selecting the icon or following its link. When it can't be
  // cancelled, or the press was the mouse's, the click that follows is stopped instead.
  function onPressEnd(e) {
    cancelPress();
    if (e.type === 'touchend') touchedAt = Date.now();
    if (!longPressed) return;
    longPressed = false;
    if (e.type === 'touchend' && e.cancelable) {
      e.preventDefault();
      return;
    }
    stopClickUntil = Date.now() + AFTER_PRESS_MS;
  }

  // A touch the browser took over (a scroll, its own gesture) ends the press with no click.
  function onTouchCancel() {
    cancelPress();
    longPressed = false;
  }

  // The click a long press ends in, wherever it lands, goes no further: stopPropagation keeps it
  // from Torn's React (which would select the icon), and preventDefault from the link (which
  // would open, or reload the page you're on). Either alone is not enough.
  function onClick(e) {
    if (!stopClickUntil) return;
    const stop = Date.now() <= stopClickUntil;
    stopClickUntil = 0;
    if (!stop) return;
    e.preventDefault();
    e.stopPropagation();
  }

  // The phone's own long-press menu (Android's) is held back during a press.
  function onContextMenu(e) {
    if (pressTimer || longPressed) e.preventDefault();
  }

  // ===== THE CHECK =====

  // At start, then every 2 seconds: learns what is new in Torn's data, and brings the stylesheet
  // up to date with what is saved, so a save in another tab reaches this one too.
  function check() {
    try {
      applyStyles(hiddenNumbers(learned(), readHidden()));
    } catch (e) {
      // A bad value stops this one check. It never reaches Torn's page.
    }
  }

  // ===== START =====

  // Every handler the script gives the page, its box or the menu runs inside a try, so an error
  // in one stays there and never reaches Torn's page.
  function safely(handler) {
    return function (e) {
      try {
        handler(e);
      } catch (err) {
        // Dropped, as an error in a check is.
      }
    };
  }

  // The script's menu, where the host has one. A long press on one of Torn's icons opens the box too.
  try {
    if (typeof GM_registerMenuCommand === 'function') GM_registerMenuCommand('Icon Hider: Settings', safely(openSettings));
  } catch (e) {
    // PDA once crashed here. Without a menu, the long press still works.
  }
  document.addEventListener('keydown', safely(onKeyDown), true);
  // Presses on Torn's icons are watched from the document, in the capture phase, so they keep
  // working when Torn redraws or replaces the row, and the click a long press ends in is stopped
  // before Torn's own handlers see it. touchstart and touchmove never cancel anything, so they
  // are passive; touchend has to be able to cancel, so it isn't.
  document.addEventListener('touchstart', safely(onTouchStart), { capture: true, passive: true });
  document.addEventListener('touchmove', safely(onTouchMove), { capture: true, passive: true });
  document.addEventListener('touchend', safely(onPressEnd), { capture: true, passive: false });
  document.addEventListener('touchcancel', safely(onTouchCancel), { capture: true, passive: true });
  document.addEventListener('mousedown', safely(onMouseDown), true);
  document.addEventListener('mouseup', safely(onPressEnd), true);
  document.addEventListener('mouseout', safely(onMouseOut), true);
  document.addEventListener('click', safely(onClick), true);
  document.addEventListener('contextmenu', safely(onContextMenu), true);
  // At document-start, before Torn draws anything, so a hidden icon doesn't flash on a page load.
  check();
  setInterval(check, POLL_MS);
  console.log('[Torn Icon Hider ' + VERSION + '] running');
})();
