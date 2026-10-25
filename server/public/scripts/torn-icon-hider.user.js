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

  // One rule per hidden picture number, for Torn's icon with that number in the row. The ___
  // after the number keeps icon5 from matching icon52; some of Torn's class names have four
  // underscores (icon52____l66f), and those match too.
  function hideRule(n) {
    return ROWS.map((row) => row + ' > li[class*="icon' + n + '___"]').join(', ') + ' { display: none !important; }';
  }

  // The whole stylesheet for these hidden numbers.
  function cssText(numbers) {
    return numbers.map(hideRule).join('\n');
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

  // At document-start, before Torn draws anything, so a hidden icon doesn't flash on a page load.
  check();
  setInterval(check, POLL_MS);
  console.log('[Torn Icon Hider ' + VERSION + '] running');
})();
