// ==UserScript==
// @name         Torn Hide Travel Inventory
// @namespace    warboard
// @version      1.0.0
// @description  Hides the inventory-slot panel that Torn shows on the travel/flight screen (page.php?sid=travel). Prefix-matches the hashed class so it survives Torn rebuilds.
// @author       warboard
// @match        https://www.torn.com/page.php?sid=travel*
// @run-at       document-start
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  var css =
    '#travel-root [class*="inventoryPanel___"]{display:none !important;}';

  function inject() {
    if (document.getElementById('wb-hide-travel-inv')) return;
    var style = document.createElement('style');
    style.id = 'wb-hide-travel-inv';
    style.textContent = css;
    (document.head || document.documentElement).appendChild(style);
  }

  inject();
  // head may not exist yet at document-start; ensure it lands.
  if (!document.head) {
    document.addEventListener('DOMContentLoaded', inject, { once: true });
  }
})();