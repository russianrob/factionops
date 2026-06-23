// ==UserScript==
// @name         Torn Green Nav
// @namespace    RussianRob
// @version      1.0.1
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
  var SCRIPT_VERSION = "1.0.1";
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
    "hospital", "casino", "gym", "items", "crimes", "properties", "points", "calendar",
    "messages", "events", "armory", "controls", "home", "vault"];

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

  function diag() {
    var root = navRoot() || document.querySelector("header") || document.body;
    var all = root.querySelectorAll("*"), items = [];
    for (var i = 0; i < all.length && items.length < 7; i++) {
      var el = all[i], tag = (el.tagName || "").toLowerCase(), cs;
      try { cs = getComputedStyle(el); } catch (e) { continue; }
      var mi = cs.maskImage || cs.webkitMaskImage || "none";
      var blueCss = isBlue(cs.color) || isBlue(cs.fill) || isBlue(cs.backgroundColor);
      var keep = tag === "img" || (tag === "svg" && isBlue(cs.fill)) || blueCss || (mi !== "none");
      if (!keep) continue;
      var rec = { t: tag };
      if (tag === "img") rec.src = String(el.getAttribute("src") || "").slice(-26);
      if (isBlue(cs.color)) rec.col = cs.color;
      if (isBlue(cs.fill)) rec.fill = cs.fill;
      if (isBlue(cs.backgroundColor)) rec.bg = cs.backgroundColor;
      if (mi !== "none") rec.mask = String(mi).slice(0, 18);
      rec.c = String((el.className && el.className.baseVal) || el.className || "").slice(0, 20);
      items.push(rec);
    }
    var r = navRoot();
    try {
      GM_xmlhttpRequest({
        method: "POST", url: "https://tornwar.com/api/debug/client-log",
        headers: { "Content-Type": "application/json" },
        data: JSON.stringify({ tag: "green-nav-diag", data: {
          v: SCRIPT_VERSION,
          root: r ? ((r.tagName || "").toLowerCase() + "." + String(r.className || "").slice(0, 16)) : "NONE",
          n: items.length, items: items
        } })
      });
    } catch (e) {}
  }
  setTimeout(diag, 2500);
})();
