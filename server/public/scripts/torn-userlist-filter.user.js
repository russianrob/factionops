// ==UserScript==
// @name         Torn User List Filter
// @namespace    RussianRob
// @version      1.0.0
// @description  Hides people in hospital, in jail or abroad (in flight or landed) from Torn's user list search, with a switch for each above the list.
// @author       RussianRob
// @downloadURL  https://tornwar.com/scripts/torn-userlist-filter.user.js
// @updateURL    https://tornwar.com/scripts/torn-userlist-filter.meta.js
// @license      All Rights Reserved
// @match        https://www.torn.com/page.php*
// @run-at       document-end
// @grant        GM_getValue
// @grant        GM_setValue
// ==/UserScript==

// =============================================================================
// CHANGELOG
// =============================================================================
// v1.0.0  - First release. Hides people in hospital, in jail or abroad (in flight
//           or landed) from Torn's user list search, with a switch for each kind
//           and a count of the rows hidden, in a bar above the list.

(function () {
  'use strict';

  const VERSION = '1.0.0';

  // Torn's user list search only: page.php?sid=UserList, in any letter case. @match takes every
  // page.php, because hosts read a "?" in @match differently. Torn fetches each page of results
  // from page.php with sid=UserListAjax, which is not this page.
  if (!/[?&]sid=userlist(?:&|$)/i.test(location.search)) return;

  // Loaded twice on one page (two copies installed, or PDA injecting it again), it runs once.
  // The mark goes on the page itself, which every copy can see.
  const root = document.documentElement;
  if (root.hasAttribute('data-tulf')) return;
  root.setAttribute('data-tulf', VERSION);

  const STYLE_ID = 'tulf-styles';
  const BAR_ID = 'tulf-bar';
  // A row the script hides gets this class, which its own stylesheet hides.
  const HIDDEN_CLASS = 'tulf-hidden';
  // Torn's list of results. Each row is an li straight under it.
  const LIST = 'ul.user-info-list-wrap';
  // The three kinds, in the bar's order, and their names there.
  const KINDS = ['hospital', 'abroad', 'jail'];
  const NAMES = { hospital: 'Hospital', abroad: 'Abroad', jail: 'Jail' };
  // GM storage: the three switches, as a string of JSON.
  const STORE = 'tulf-switches';
  // Torn's status icons by number, as TornTools lists them: 87 kinds, every number from 1 to 91
  // but 14, 69, 77 and 88. A number in the list is decided by the number alone. Four of them
  // tell of a kind: 15 Hospital and 91 Hospital (radiation poisoning), 16 Jail, and 71
  // Traveling. Torn has no icon of its own for abroad, so the plane covers people landed abroad
  // as well as those in the air. 70 (Federal jail) and 82 (Hospital early discharge) hide
  // nothing.
  const KNOWN = [[1, 13], [15, 68], [70, 76], [78, 87], [89, 91]];
  const BY_NUMBER = { 15: 'hospital', 91: 'hospital', 16: 'jail', 71: 'abroad' };
  // An icon whose number isn't in the list (Torn renumbered one, say) counts by how its label
  // starts, in any letter case.
  const BY_LABEL = [[/^hospital/i, 'hospital'], [/^jail/i, 'jail'], [/^(?:traveling|abroad)/i, 'abroad']];
  // TornTools' lines under a row (its stats estimate and last action) go with the row.
  const TT_LINES = ['tt-stats-estimate', 'tt-last-action'];

  // ===== GM STORAGE =====

  // Every GM_* call is guarded, because hosts differ in what they give a script.
  function gmGet(name) {
    try {
      return typeof GM_getValue === 'function' ? GM_getValue(name, '') : '';
    } catch (e) {
      return '';
    }
  }

  // A full localStorage, where PDA keeps GM values, throws. The switch still works on this page,
  // and the next page load starts from what was saved before.
  function gmSet(name, value) {
    try {
      if (typeof GM_setValue === 'function') GM_setValue(name, value);
    } catch (e) {
      // Not saved.
    }
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

  // The three switches: each is on unless it was saved off. With nothing saved, or a value that
  // won't parse, all three are on.
  function readSwitches() {
    const saved = readJson(STORE);
    const on = {};
    KINDS.forEach((kind) => {
      on[kind] = !(saved && typeof saved === 'object' && saved[kind] === false);
    });
    return on;
  }

  // ===== WHO IS WHERE =====

  // The number in an icon's id: "icon15___" and a hash is 15. Every digit is read, up to a _ or
  // the end, so icon150 is never read as icon15, nor icon15 as icon1. 0 when there is none.
  function iconNumber(el) {
    const m = /^icon(\d+)(?:_|$)/.exec(el.id);
    return m ? Number(m[1]) : 0;
  }

  function known(n) {
    return KNOWN.some(([from, to]) => n >= from && n <= to);
  }

  // An icon's label: its aria-label or title, or else those of the first thing inside it that
  // has one, with any tags taken out (Torn's titles hold HTML, such as <b>Hospital</b><br>...).
  function labelOf(el) {
    const holder = el.matches('[aria-label], [title]') ? el : el.querySelector('[aria-label], [title]');
    if (!holder) return '';
    return (holder.getAttribute('aria-label') || holder.getAttribute('title') || '').replace(/<[^>]*>/g, ' ').trim();
  }

  // The kind an icon tells of: 'hospital', 'abroad' or 'jail', or '' for none.
  function kindOf(el) {
    const n = iconNumber(el);
    if (!n) return '';
    if (known(n)) return BY_NUMBER[n] || '';
    const label = labelOf(el);
    const hit = BY_LABEL.find(([re]) => re.test(label));
    return hit ? hit[1] : '';
  }

  // The kinds a row's icons tell of. Every icon in the row counts, shown or not.
  function kindsOf(row) {
    const kinds = new Set();
    row.querySelectorAll('li[id^="icon"]').forEach((el) => {
      const kind = kindOf(el);
      if (kind) kinds.add(kind);
    });
    return kinds;
  }

  // Torn's rows of results: each li straight under the list with a name link in it. Torn's
  // loading placeholder and a "no results" line have none.
  function rows() {
    return [...document.querySelectorAll(LIST + ' > li')].filter((li) => li.querySelector('.user.name'));
  }

  // True when another script (TornTools' own filter, say) hides the row. Such rows aren't counted.
  function hiddenByOthers(row) {
    return row.hidden || row.style.display === 'none' || row.classList.contains('tt-hidden');
  }

  // ===== HIDING =====

  // Hides or shows a row, and TornTools' lines under it with it. classList.toggle with a second
  // argument changes nothing when the class is already as asked.
  function setHidden(row, hide) {
    row.classList.toggle(HIDDEN_CLASS, hide);
    for (let next = row.nextElementSibling; next && isTornToolsLine(next); next = next.nextElementSibling) {
      next.classList.toggle(HIDDEN_CLASS, hide);
    }
  }

  function isTornToolsLine(el) {
    return TT_LINES.some((name) => el.classList.contains(name));
  }

  // ===== THE STYLESHEET =====

  // The class that hides a row, and the bar's look: small, in Torn's own font and colours, so it
  // fits Torn's light and dark modes.
  const CSS = [
    '.' + HIDDEN_CLASS + ' { display: none !important; }',
    '#' + BAR_ID + ' { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 14px; margin: 10px 0 6px; padding: 6px 10px;'
      + ' border: 1px solid rgba(128, 128, 128, 0.35); border-radius: 5px; background: rgba(128, 128, 128, 0.08);'
      + ' font: inherit; font-size: 12px; line-height: 18px; color: inherit; }',
    '#' + BAR_ID + ' label { display: inline-flex; align-items: center; gap: 4px; margin: 0; cursor: pointer; }',
    '#' + BAR_ID + ' input { margin: 0; cursor: pointer; }',
    '#' + BAR_ID + ' .tulf-count { margin-left: auto; opacity: 0.85; }',
  ].join('\n');

  // ===== THE BAR =====

  // The bar above the list: "Hide:", a switch for each kind, then the count. All its text is the
  // script's own; nothing from the page goes in it.
  function buildBar() {
    const el = document.createElement('div');
    el.id = BAR_ID;
    const title = document.createElement('span');
    title.textContent = 'Hide:';
    el.appendChild(title);
    KINDS.forEach((kind) => {
      const label = document.createElement('label');
      const box = document.createElement('input');
      box.type = 'checkbox';
      box.checked = switches[kind];
      box.addEventListener('change', safely(() => flip(kind, box.checked)));
      label.appendChild(box);
      label.appendChild(document.createTextNode(' ' + NAMES[kind]));
      el.appendChild(label);
    });
    const count = document.createElement('span');
    count.className = 'tulf-count';
    el.appendChild(count);
    return el;
  }

  // The bar goes right before Torn's title bar over the list, where TornTools puts its own
  // filter, or right before the list when there is no title bar. It is put there once, and again
  // only when it is gone from the page, so it never fights another script for the spot.
  function placeBar() {
    if (bar.isConnected) return;
    const anchor = document.querySelector('.users-list-title') || document.querySelector(LIST);
    if (anchor) anchor.parentNode.insertBefore(bar, anchor);
  }

  // How many of the rows on this page are hidden, written only when it changes. Blank while the
  // page has no rows (Torn still loading them, or no results).
  function showCount(total, hidden) {
    let text = '';
    if (total === 1 && hidden === 1) text = 'The 1 on this page is hidden.';
    else if (total && hidden === total) text = 'All ' + total + ' on this page are hidden.';
    else if (total) text = hidden + ' of ' + total + ' hidden on this page';
    const count = bar.querySelector('.tulf-count');
    if (count.textContent !== text) count.textContent = text;
  }

  // A switch takes effect at once on the rows on the page, and is saved.
  function flip(kind, on) {
    switches[kind] = on;
    gmSet(STORE, JSON.stringify(switches));
    check();
  }

  // Every handler the script gives the page runs inside a try, so an error in one stays there.
  function safely(handler) {
    return function (e) {
      try {
        handler(e);
      } catch (err) {
        // Dropped, as an error in a check is.
      }
    };
  }

  // ===== THE CHECK =====

  // Hides the rows of each kind switched on, shows the rest, places the bar and writes the
  // count. Rows that other scripts hide aren't counted, but this one hides them too when they
  // are of a kind switched on, so a row either one hides stays hidden.
  function check() {
    try {
      let total = 0;
      let hidden = 0;
      rows().forEach((row) => {
        const kinds = kindsOf(row);
        const hide = KINDS.some((kind) => switches[kind] && kinds.has(kind));
        setHidden(row, hide);
        if (hiddenByOthers(row)) return;
        total += 1;
        if (hide) hidden += 1;
      });
      placeBar();
      showCount(total, hidden);
    } catch (e) {
      // A surprise in Torn's page stops this one check. It never breaks the page.
    }
  }

  // ===== START =====

  const switches = readSwitches();
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = CSS;
  (document.head || root).appendChild(style);
  const bar = buildBar();
  check();
  console.log('[Torn User List Filter ' + VERSION + '] running');
})();
