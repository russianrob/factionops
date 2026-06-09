// ==UserScript==
// @name         Foreign Stock Diag
// @namespace    RussianRob
// @version      1.1.0
// @description  Temporary diagnostic — reports the travel page (page.php?sid=travel) destination DOM so Foreign Stock can anchor its panels. Safe to remove after.
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
  var COUNTRIES = ["mexico", "cayman", "canada", "hawaii", "kingdom", "argentina", "switzerland", "japan", "china", "emirates", "uae", "africa"];
  function post(p) {
    if (sent >= MAX) return; sent++;
    try { GM_xmlhttpRequest({ method: "POST", url: DIAG_URL, headers: { "Content-Type": "application/json" }, data: JSON.stringify({ tag: "foreign-stock-diag", data: p }) }); } catch (e) {}
  }
  function cls(el) { try { return (el.getAttribute && el.getAttribute("class")) || ""; } catch (_) { return ""; } }
  function attrs(el) {
    var a = "";
    try { if (el.getAttribute("alt")) a += " alt=" + el.getAttribute("alt"); } catch (_) {}
    try { if (el.getAttribute("title")) a += " title=" + el.getAttribute("title"); } catch (_) {}
    return a.slice(0, 60);
  }
  function matchesCountry(el) {
    var hay = ((el.textContent || "") + " " + (el.getAttribute && (el.getAttribute("alt") || "") || "") + " " + (el.getAttribute && (el.getAttribute("title") || "") || "")).toLowerCase();
    if (hay.length < 3 || hay.length > 200) return false;
    for (var c = 0; c < COUNTRIES.length; c++) if (hay.indexOf(COUNTRIES[c]) !== -1) return true;
    return false;
  }
  function chain(el, n) {
    var out = [], e = el;
    for (var i = 0; i < n && e; i++) {
      var t = (e.textContent || "").replace(/\s+/g, " ").trim();
      out.push(e.tagName.toLowerCase() + "|" + cls(e).slice(0, 45) + "|len" + t.length + "|" + t.slice(0, 50));
      e = e.parentElement;
    }
    return out;
  }
  function scan() {
    if (!/sid=travel/.test(location.search) && !/sid=travel/.test(location.hash)) return;
    var all = document.querySelectorAll("div,li,tr,a,span,img,button"), hits = [];
    for (var i = 0; i < all.length; i++) {
      var el = all[i];
      if (!el.getClientRects().length) continue;
      if (matchesCountry(el)) hits.push(el);
    }
    if (!noted) { noted = true; post({ note: "travel scan", url: location.href.slice(0, 140), hits: hits.length }); }
    if (!hits.length) return;
    for (var k = 0; k < hits.length && k < 14; k++) {
      var el2 = hits[k], key = el2.tagName + "|" + cls(el2).slice(0, 30);
      if (seen[key]) continue; seen[key] = 1;
      post({
        tag2: el2.tagName.toLowerCase(),
        cls: cls(el2).slice(0, 80),
        attrs: attrs(el2),
        text: (el2.textContent || "").replace(/\s+/g, " ").trim().slice(0, 90),
        chain: chain(el2, 6),
        html: (el2.outerHTML || "").replace(/\s+/g, " ").slice(0, 1200)
      });
    }
  }
  var iv = setInterval(function () { scan(); if (sent >= MAX) clearInterval(iv); }, 1500);
  try { if (typeof GM_registerMenuCommand === "function") GM_registerMenuCommand("Foreign Stock diag: capture now", function () { noted = false; seen = {}; sent = 0; scan(); }); } catch (_) {}
})();
