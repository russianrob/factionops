// ==UserScript==
// @name         Torn Hide Travel Inventory
// @namespace    RussianRob
// @author       RussianRob
// @version      1.0.1
// @description  Hides the inventory grid on the Torn travel page.
// @match        https://www.torn.com/page.php*
// @match        https://www.torn.com/travelagency.php*
// @run-at       document-start
// @license      GPL-3.0-or-later
// @grant        none
// ==/UserScript==
(function () {
  'use strict';
  const css = 'ul[class*="inventoryPanel"]{display:none!important}';
  function inject() {
    if (document.getElementById('hide-travel-inventory-style')) return;
    const style = document.createElement('style');
    style.id = 'hide-travel-inventory-style';
    style.textContent = css;
    (document.head || document.documentElement).appendChild(style);
  }
  inject();
  if (!document.head) document.addEventListener('DOMContentLoaded', inject, { once: true });
})();
