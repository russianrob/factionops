// ==UserScript==
// @name         Foreign Stock Diag
// @namespace    RussianRob
// @version      2.0.0
// @description  Temporary diagnostic — reports the DESKTOP travel page (page.php?sid=travel) DOM (map + country markers + container) so Foreign Stock can support desktop. Safe to remove after.
// @author       RussianRob
// @match        https://www.torn.com/page.php*
// @grant        GM_xmlhttpRequest
// @grant        GM_registerMenuCommand
// @connect      tornwar.com
// @run-at       document-idle
// ==/UserScript==
(function () {
  "use strict";
  var DIAG_URL = "https://tornwar.com/api/debug/client-log";
  var sent = 0, MAX = 16, seen = {}, noted = false;
  function post(p) {
    if (sent >= MAX) return; sent++;
    try { GM_xmlhttpRequest({ method: "POST", url: DIAG_URL, headers: { "Content-Type": "application/json" }, data: JSON.stringify({ tag: "foreign-stock-diag", data: p }) }); } catch (e) {}
  }
  function cls(el) { try { return (el.getAttribute && el.getAttribute("class")) || ""; } catch (_) { return ""; } }
  function attrs(el) {
    var a = "";
    try { ["alt", "title", "href", "src", "aria-label", "data-country"].forEach(function (k) { var v = el.getAttribute && el.getAttribute(k); if (v) a += " " + k + "=" + String(v).slice(0, 60); }); } catch (_) {}
    return a.slice(0, 160);
  }
  function chain(el, n) {
    var out = [], e = el;
    for (var i = 0; i < n && e; i++) {
      var t = (e.textContent || "").replace(/\s+/g, " ").trim();
      out.push(e.tagName.toLowerCase() + "|" + cls(e).slice(0, 45) + "|len" + t.length);
      e = e.parentElement;
    }
    return out;
  }
  function scan() {
    if (!/sid=travel/.test(location.search) && !/sid=travel/.test(location.hash)) return;
    // 1. the travel-agency content container (biggest element whose class mentions travel/map)
    var conts = document.querySelectorAll('[class*="travel" i], [class*="map" i], [class*="agency" i], #travel-root, [class*="content-wrapper"]');
    // 2. country markers: anything referencing a flag image, or a country name in attrs
    var flags = document.querySelectorAll('img[src*="flag" i], [class*="flag" i], [class*="country" i], a[href*="travel" i], [class*="destination" i], area, [class*="marker" i]');
    if (!noted) { noted = true; post({ note: "desktop travel scan", url: location.href.slice(0, 140), conts: conts.length, flags: flags.length }); }
    var n = 0;
    for (var i = 0; i < flags.length && n < 10; i++) {
      var el = flags[i];
      if (!el.getClientRects().length) continue;
      var key = el.tagName + "|" + cls(el).slice(0, 30);
      if (seen[key]) continue; seen[key] = 1; n++;
      post({
        kind: "marker",
        tag: el.tagName.toLowerCase(),
        cls: cls(el).slice(0, 80),
        attrs: attrs(el),
        text: (el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 50),
        chain: chain(el, 6),
        html: (el.outerHTML || "").replace(/\s+/g, " ").slice(0, 500)
      });
    }
    // also dump the biggest travel container's class + a shallow child list
    var best = null, bestLen = 0;
    for (var c = 0; c < conts.length; c++) { var L = (conts[c].textContent || "").length; if (L > bestLen && L < 8000) { bestLen = L; best = conts[c]; } }
    if (best && !seen.CONT) {
      seen.CONT = 1;
      var kids = [];
      for (var k = 0; k < best.children.length && k < 12; k++) kids.push(best.children[k].tagName.toLowerCase() + "." + cls(best.children[k]).slice(0, 40));
      post({ kind: "container", cls: cls(best).slice(0, 80), childCount: best.children.length, kids: kids, chain: chain(best, 5) });
    }
  }
  var iv = setInterval(function () { scan(); if (sent >= MAX) clearInterval(iv); }, 1500);
  try { if (typeof GM_registerMenuCommand === "function") GM_registerMenuCommand("Foreign Stock diag: capture now", function () { noted = false; seen = {}; sent = 0; scan(); }); } catch (_) {}
})();
