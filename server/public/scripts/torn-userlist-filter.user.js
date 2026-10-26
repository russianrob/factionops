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
  // A row the script hides gets this class, which its own stylesheet hides.
  const HIDDEN_CLASS = 'tulf-hidden';
  // Torn's list of results. Each row is an li straight under it.
  const LIST = 'ul.user-info-list-wrap';
  // The three kinds.
  const KINDS = ['hospital', 'abroad', 'jail'];
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

  // The class that hides a row.
  const CSS = [
    '.' + HIDDEN_CLASS + ' { display: none !important; }',
  ].join('\n');

  // ===== THE CHECK =====

  // Hides the rows of each kind switched on and shows the rest.
  function check() {
    try {
      rows().forEach((row) => {
        const kinds = kindsOf(row);
        setHidden(row, KINDS.some((kind) => switches[kind] && kinds.has(kind)));
      });
    } catch (e) {
      // A surprise in Torn's page stops this one check. It never breaks the page.
    }
  }

  // ===== START =====

  // For now, every kind is hidden.
  const switches = { hospital: true, abroad: true, jail: true };
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = CSS;
  (document.head || root).appendChild(style);
  check();
  console.log('[Torn User List Filter ' + VERSION + '] running');
})();
