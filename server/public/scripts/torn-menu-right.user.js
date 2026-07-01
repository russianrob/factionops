// ==UserScript==
// @name         Torn Menu Right
// @namespace    RussianRob
// @version      1.0.0
// @description  Moves Torn's mobile slide-out Areas menu to the right edge of the screen instead of the left.
// @author       RussianRob
// @license      GPL-3.0-or-later
// @match        https://www.torn.com/*
// @run-at       document-start
// @grant        none
// ==/UserScript==
(function () {
  "use strict";
  var css =
    '#fly-out-panel{position:fixed!important;left:auto!important;right:0!important;top:36px!important;' +
    'border-left:1px solid #444!important;border-right:0!important;' +
    'border-top-left-radius:5px!important;border-top-right-radius:0!important;}' +
    '#fly-out-panel:not([class*="visible___"]){transform:translateX(100%)!important;}' +
    '#fly-out-panel[class*="visible___"]{box-shadow:-1px 0 5px rgba(0,0,0,.7)!important;}';
  var s = document.createElement("style");
  s.id = "torn-menu-right";
  s.textContent = css;
  (document.head || document.documentElement).appendChild(s);
})();
