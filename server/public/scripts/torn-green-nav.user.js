// ==UserScript==
// @name         Torn Green Nav
// @namespace    RussianRob
// @version      1.0.0
// @description  Recolours Torn's area-nav active highlight + notification dot from the new blue back to green.
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
  var SCRIPT_VERSION = "1.0.0";
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

  var AREAS = ["city", "job", "education", "faction", "missions", "news", "jail",
    "hospital", "casino", "gym", "items", "crimes", "properties", "points", "calendar"];

  function navRoot() {
    var root = document.querySelector('#sidebar, #sidebarroot, [class*="areasWrapper"], [class*="area-row"], [class*="sidebar"]');
    if (root) return root;
    var links = [];
    var all = document.querySelectorAll("a[aria-label], a, [role='link']");
    for (var i = 0; i < all.length; i++) {
      var lab = (all[i].getAttribute("aria-label") || all[i].textContent || "").trim().toLowerCase();
      if (AREAS.indexOf(lab) !== -1) links.push(all[i]);
    }
    if (links.length < 3) return null;
    var anc = links[0];
    for (var d = 0; d < 8 && anc; d++) {
      var inside = 0;
      for (var j = 0; j < links.length; j++) if (anc.contains(links[j])) inside++;
      if (inside >= 3) return anc;
      anc = anc.parentElement;
    }
    return null;
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
      if (isBlue(cs.borderTopColor)) el.style.setProperty("border-color", GREEN, "important");
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
  (function boot() {
    if (attach() || tries++ > 40) return;
    setTimeout(boot, 250);
  })();
  window.addEventListener("popstate", schedule);
})();
