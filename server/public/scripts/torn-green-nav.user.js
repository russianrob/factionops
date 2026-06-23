// ==UserScript==
// @name         Torn Green Nav
// @namespace    RussianRob
// @version      1.0.6
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
  var SCRIPT_VERSION = "1.0.6";
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

  function fixSvg(sv) {
    if (sv.__gn) return;
    var cs;
    try { cs = getComputedStyle(sv); } catch (e) { return; }
    var blue = isBlue(cs.color) || isBlue(cs.fill);
    var stops = sv.getElementsByTagName("stop");
    if (!blue) {
      for (var s = 0; s < stops.length && !blue; s++) {
        try { if (isBlue(getComputedStyle(stops[s]).stopColor)) blue = true; } catch (e) {}
      }
    }
    if (!blue) return;
    sv.style.setProperty("color", GREEN, "important");
    for (var i = 0; i < stops.length; i++) stops[i].style.setProperty("stop-color", GREEN, "important");
    var ps = sv.querySelectorAll("path, g, rect, circle, polygon, ellipse");
    for (var j = 0; j < ps.length; j++) {
      var pc; try { pc = getComputedStyle(ps[j]); } catch (e) { continue; }
      if (isBlue(pc.fill)) ps[j].style.setProperty("fill", GREEN, "important");
    }
    sv.__gn = 1;
  }
  function fixEl(el) {
    var cs;
    try { cs = getComputedStyle(el); } catch (e) { return; }
    if (isBlue(cs.color)) el.style.setProperty("color", GREEN, "important");
    if (isBlue(cs.backgroundColor)) el.style.setProperty("background-color", GREEN, "important");
  }
  function sweep() {
    var svgs = document.querySelectorAll("svg");
    for (var i = 0; i < svgs.length; i++) fixSvg(svgs[i]);
    var els = document.querySelectorAll('[class*="active"], [class*="dot"], [class*="badge"], [class*="notif"], [class*="Link"], [class*="title"], [class*="name"]');
    for (var k = 0; k < els.length; k++) fixEl(els[k]);
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
