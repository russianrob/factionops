// ==UserScript==
// @name         Torn Green Nav
// @namespace    RussianRob
// @version      1.0.4
// @description  Recolours Torn's blue UI icons + notification dots (the recent green->blue change) back to green.
// @author       RussianRob
// @license      GPL-3.0-or-later
// @match        https://www.torn.com/*
// @run-at       document-idle
// @grant        none
// @downloadURL  https://tornwar.com/scripts/torn-green-nav.user.js
// @updateURL    https://tornwar.com/scripts/torn-green-nav.meta.js
// ==/UserScript==
(function () {
  "use strict";
  var SCRIPT_VERSION = "1.0.4";
  var GREEN = "#84c500";

  function parseRgb(str) {
    var m = String(str || "").match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/i);
    return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
  }
  function isBlue(str) {
    var c = parseRgb(str);
    if (!c) return false;
    var r = c[0], g = c[1], b = c[2];
    return b > 150 && b > r + 40 && b >= g - 5;
  }

  var SEL = 'svg, path, g, circle, rect, use, [class*="icon"], [class*="Icon"],' +
    '[class*="dot"], [class*="badge"], [class*="notif"], [class*="active"],' +
    '[class*="areaLink"], [class*="mobileLink"], [class*="sidebar"], [class*="area-row"]';

  function paint(el) {
    var cs;
    try { cs = getComputedStyle(el); } catch (e) { return; }
    if (isBlue(cs.color)) el.style.setProperty("color", GREEN, "important");
    if (isBlue(cs.fill)) el.style.setProperty("fill", GREEN, "important");
    if (isBlue(cs.stroke)) el.style.setProperty("stroke", GREEN, "important");
    if (isBlue(cs.backgroundColor)) el.style.setProperty("background-color", GREEN, "important");
  }
  function sweep() {
    var els = document.querySelectorAll(SEL);
    for (var i = 0; i < els.length; i++) paint(els[i]);
  }

  var pending = null;
  function schedule() {
    if (pending) return;
    pending = setTimeout(function () { pending = null; sweep(); }, 200);
  }

  sweep();
  var tries = 0;
  var iv = setInterval(function () { sweep(); if (tries++ > 12) clearInterval(iv); }, 400);
  new MutationObserver(schedule).observe(document.body, {
    childList: true, subtree: true, attributes: true, attributeFilter: ["class", "style"]
  });
  window.addEventListener("popstate", schedule);
})();
