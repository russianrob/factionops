// ==UserScript==
// @name         Torn Green Nav
// @namespace    RussianRob
// @version      1.0.2
// @description  Recolours Torn's area-nav active highlight + notification dot from the new blue back to green.
// @author       RussianRob
// @license      GPL-3.0-or-later
// @match        https://www.torn.com/*
// @run-at       document-idle
// @grant        GM_xmlhttpRequest
// @connect      tornwar.com
// @downloadURL  https://tornwar.com/scripts/torn-green-nav.user.js
// @updateURL    https://tornwar.com/scripts/torn-green-nav.meta.js
// ==/UserScript==
(function () {
  "use strict";
  var SCRIPT_VERSION = "1.0.3";
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
  function isMyGreen(str) {
    var c = parseRgb(str);
    return !!(c && c[0] > 110 && c[0] < 160 && c[1] > 170 && c[2] < 40);
  }

  function navRoot() {
    var root = document.querySelector('#sidebar, #sidebarroot, [class*="areasWrapper"], [class*="area-row"], [class*="sidebar"]');
    return (root && root.tagName.toLowerCase() !== "body") ? root : null;
  }

  function recolor(root) {
    if (!root) return;
    var els = root.querySelectorAll("*");
    for (var i = 0; i < els.length; i++) {
      var el = els[i], cs;
      try { cs = getComputedStyle(el); } catch (e) { continue; }
      if (isBlue(cs.color)) el.style.setProperty("color", GREEN, "important");
      var tag = (el.tagName || "").toLowerCase();
      if (tag === "svg" || tag === "path" || tag === "g" || tag === "circle" || tag === "rect" || tag === "use") {
        if (isBlue(cs.fill)) el.style.setProperty("fill", GREEN, "important");
        if (isBlue(cs.stroke)) el.style.setProperty("stroke", GREEN, "important");
      }
      if (isBlue(cs.backgroundColor)) el.style.setProperty("background-color", GREEN, "important");
    }
  }

  var pending = null, observed = null;
  function schedule() {
    if (pending) return;
    pending = setTimeout(function () { pending = null; recolor(navRoot()); }, 150);
  }
  function attach() {
    var root = navRoot();
    if (!root) return false;
    recolor(root);
    if (observed === root) return true;
    observed = root;
    new MutationObserver(schedule).observe(root, {
      childList: true, subtree: true, attributes: true, attributeFilter: ["class", "style", "fill"]
    });
    return true;
  }
  var tries = 0;
  (function boot() { if (attach() || tries++ > 40) return; setTimeout(boot, 250); })();
  window.addEventListener("popstate", schedule);

  function diag() {
    // Find what's actually still BLUE (the active icon + dot) and where.
    var hits = [];
    var all = document.querySelectorAll('svg, path, span, i, [class*="con"], [class*="dot"], [class*="badge"], [class*="active"]');
    for (var i = 0; i < all.length && hits.length < 6; i++) {
      var el = all[i], cs;
      try { cs = getComputedStyle(el); } catch (e) { continue; }
      var cn = String((el.className && el.className.baseVal) || el.className || "");
      if (/avatar/i.test(cn)) continue;
      var bf = isBlue(cs.fill), bc = isBlue(cs.color), bb = isBlue(cs.backgroundColor);
      var mi = cs.maskImage || cs.webkitMaskImage || "none";
      if (!bf && !bc && !bb) continue;
      var p = el.parentElement, chain = [];
      for (var d = 0; d < 4 && p; d++) {
        chain.push((p.tagName || "").toLowerCase() + "." + String((p.className && p.className.baseVal) || p.className || "").slice(0, 16));
        p = p.parentElement;
      }
      hits.push({
        t: (el.tagName || "").toLowerCase(), c: cn.slice(0, 18),
        fill: bf ? cs.fill : 0, col: bc ? cs.color : 0, bg: bb ? cs.backgroundColor : 0,
        mask: mi !== "none" ? 1 : 0, par: chain
      });
    }
    var nr = navRoot();
    try {
      GM_xmlhttpRequest({
        method: "POST", url: "https://tornwar.com/api/debug/client-log",
        headers: { "Content-Type": "application/json" },
        data: JSON.stringify({ tag: "green-nav-diag", data: {
          v: SCRIPT_VERSION, nr: nr ? (nr.tagName.toLowerCase() + "." + String(nr.className || "").slice(0, 16)) : "NULL",
          n: hits.length, hits: hits
        } })
      });
    } catch (e) {}
  }
  setTimeout(diag, 2500);
})();
