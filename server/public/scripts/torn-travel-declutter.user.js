// ==UserScript==
// @name         Torn Travel Declutter
// @namespace    RussianRob
// @version      1.0.0
// @description  Hides the decorative inventory boxes shown during flight on Torn's travel page for a cleaner view.
// @author       RussianRob
// @downloadURL  https://tornwar.com/scripts/torn-travel-declutter.user.js
// @updateURL    https://tornwar.com/scripts/torn-travel-declutter.user.js
// @license      GPL-3.0-or-later
// @match        https://www.torn.com/page.php*
// @run-at       document-start
// @grant        none
// ==/UserScript==
(function () {
  "use strict";
  var SCRIPT_VERSION = "1.0.0";
  if (window.__tornTravelDeclutter) return;
  window.__tornTravelDeclutter = true;

  var css = '#travel-root [class*="inventoryPanel___"]{display:none!important;}';
  var s = document.createElement("style");
  s.id = "torn-travel-declutter";
  s.textContent = css;
  (document.head || document.documentElement).appendChild(s);
})();
