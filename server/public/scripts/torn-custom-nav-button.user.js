// ==UserScript==
// @name         Torn Custom Nav Button
// @namespace    aaron.warboard
// @version      1.1.0
// @description  Adds a custom tab to the Torn faction page tab bar that navigates to a page you choose.
// @author       Aaron
// @match        https://www.torn.com/factions.php*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  /* ======================= CONFIG — edit these ======================= */
  const TARGET_URL      = 'https://www.torn.com/';   // <-- your brand-new page goes here
  const BUTTON_LABEL    = 'My Page';                 // tab text
  const OPEN_IN_NEW_TAB = true;                      // true = new tab, false = navigate current tab
  /* =================================================================== */

  const MARK = 'data-custom-nav-tab';

  function getTabNav() {
    // Legacy jQuery-UI tab bar on the faction page — stable, unhashed classes.
    return document.querySelector('ul.faction-tabs.ui-tabs-nav');
  }

  function buildTab(templateLi) {
    // Clone a real tab so we inherit the current build's styling exactly.
    const li = templateLi.cloneNode(true);
    li.setAttribute(MARK, '1');
    li.removeAttribute('id');
    // Drop any "active/selected" state copied from the template.
    li.classList.remove('ui-tabs-active', 'ui-state-active', 'ui-state-focus');

    const a = li.querySelector('a') || li;
    a.textContent = BUTTON_LABEL;
    if (a.tagName === 'A') {
      a.href = TARGET_URL;
      a.removeAttribute('aria-controls');
      a.removeAttribute('aria-selected');
    }

    const nav = (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (OPEN_IN_NEW_TAB) window.open(TARGET_URL, '_blank', 'noopener');
      else window.location.href = TARGET_URL;
    };
    // Bind on the li and the anchor so the jQuery tab handler can't hijack it.
    li.addEventListener('click', nav, true);
    a.addEventListener('click', nav, true);

    return li;
  }

  function ensureTab() {
    if (document.querySelector('li[' + MARK + ']')) return;   // cheap guard
    const nav = getTabNav();
    if (!nav) return;
    const tabs = nav.querySelectorAll('li');
    if (!tabs.length) return;                                 // nothing to clone yet
    nav.appendChild(buildTab(tabs[tabs.length - 1]));
  }

  ensureTab();

  // Keep it alive against re-renders, cheaply: the callback is just one
  // querySelector guard unless the tab is actually missing.
  const host = document.getElementById('factions') || document.body;
  const mo = new MutationObserver(() => ensureTab());
  mo.observe(host, { childList: true, subtree: true });
})();