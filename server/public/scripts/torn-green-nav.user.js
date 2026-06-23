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
  var SCRIPT_VERSION = "1.0.2";
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
    // Find the active label my recolor turned green, then dump its nav-item
    // markup so we can see what the (still-blue) icon actually is.
    var target = null, all = document.querySelectorAll("span, a, div, li, p");
    for (var i = 0; i < all.length && !target; i++) {
      var el = all[i];
      if (el.children.length) continue;
      var t = (el.textContent || "").trim();
      if (!t || t.length > 16) continue;
      if (isMyGreen(getComputedStyle(el).color)) target = el;
    }
    var item = target, html = null, label = "NONE";
    if (target) {
      label = (target.textContent || "").trim().slice(0, 14);
      for (var d = 0; d < 5 && item && !(item.querySelector && item.querySelector("img, svg")); d++) item = item.parentElement;
      if (item) {
        html = item.outerHTML
          .replace(/(<svg[^>]*)>[\s\S]*?<\/svg>/gi, "$1></svg>")
          .replace(/ d="[^"]*"/gi, "")
          .replace(/\s+/g, " ")
          .slice(0, 700);
      }
    }
    try {
      GM_xmlhttpRequest({
        method: "POST", url: "https://tornwar.com/api/debug/client-log",
        headers: { "Content-Type": "application/json" },
        data: JSON.stringify({ tag: "green-nav-diag", data: { v: SCRIPT_VERSION, label: label, html: html } })
      });
    } catch (e) {}
  }
  setTimeout(diag, 2500);
})();
