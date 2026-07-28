// ==UserScript==
// @name         RWP Armoury Diag
// @namespace    RussianRob
// @version      1.1.0
// @description  Temporary diagnostic — reports the faction armoury item DOM (container, name, rarity, bonus) so RW Pricer can badge the collapsed armoury rows. Safe to remove after.
// @author       RussianRob
// @match        https://www.torn.com/factions.php*
// @grant        GM_xmlhttpRequest
// @grant        GM_registerMenuCommand
// @connect      tornwar.com
// @run-at       document-idle
// ==/UserScript==
(function () {
  "use strict";
  var DIAG_URL = "https://tornwar.com/api/debug/client-log";
  var sent = 0, MAX = 12, seen = {}, noted = false;
  function post(p) {
    if (sent >= MAX) return; sent++;
    try { GM_xmlhttpRequest({ method: "POST", url: DIAG_URL, headers: { "Content-Type": "application/json" }, data: JSON.stringify({ tag: "rwp-armoury-diag", data: p }) }); } catch (e) {}
  }
  function cls(el) { try { return (el.getAttribute && el.getAttribute("class")) || ""; } catch (_) { return ""; } }
  function ancestors(el, n) {
    var out = [], e = el;
    for (var i = 0; i < n && e; i++) {
      var t = (e.textContent || "").replace(/\s+/g, " ").trim();
      out.push(e.tagName.toLowerCase() + "|" + cls(e).slice(0, 45) + "|len" + t.length + "|" + t.slice(0, 55));
      e = e.parentElement;
    }
    return out;
  }
  function colors(el) {
    var hits = [], nodes = [el].concat([].slice.call(el.querySelectorAll("*")).slice(0, 45));
    for (var i = 0; i < nodes.length && hits.length < 7; i++) {
      try {
        var s = getComputedStyle(nodes[i]), b = s.borderColor, sh = s.boxShadow;
        if ((b && b !== "rgb(0, 0, 0)" && b !== "rgba(0, 0, 0, 0)") || (sh && sh !== "none")) {
          hits.push(nodes[i].tagName.toLowerCase() + "." + cls(nodes[i]).slice(0, 28) + " b:" + b + " sh:" + (sh || "").slice(0, 36));
        }
      } catch (_) {}
    }
    return hits;
  }
  function liFor(wrap) {
    var e = wrap;
    for (var up = 0; up < 5 && e; up++) { if (e.tagName === "LI") return e; e = e.parentElement; }
    return wrap.parentElement || wrap;
  }
  function childMap(li) {
    var out = [], kids = li.children;
    for (var i = 0; i < kids.length && i < 12; i++) {
      var k = kids[i], t = (k.textContent || "").replace(/\s+/g, " ").trim();
      out.push(k.tagName.toLowerCase() + "|" + cls(k).slice(0, 40) + "|" + t.slice(0, 40));
    }
    return out;
  }
  // Any element carrying a title/aria-label/alt — bonus icons live here as
  // image tooltips with no textContent, so a text-only dump misses them.
  function annotated(li) {
    var out = [], all = li.querySelectorAll("*");
    for (var i = 0; i < all.length && out.length < 18; i++) {
      var n = all[i];
      var ttl = n.getAttribute("title"), aria = n.getAttribute("aria-label"), alt = (n.tagName === "IMG") ? n.getAttribute("alt") : null;
      if (ttl || aria || (alt && alt.length)) {
        out.push(n.tagName.toLowerCase() + "." + cls(n).slice(0, 24) + " title=" + (ttl || "").slice(0, 30) + " aria=" + (aria || "").slice(0, 30) + " alt=" + (alt || "").slice(0, 24));
      }
    }
    return out;
  }
  function scan() {
    var wraps = document.querySelectorAll("div.img-wrap[data-armoryid]"), vis = [];
    for (var i = 0; i < wraps.length; i++) if (wraps[i].getClientRects().length) vis.push(wraps[i]);
    if (!vis.length) return;
    if (!noted) { noted = true; post({ note: "armoury scan", url: location.href.slice(0, 140), rows: vis.length }); }
    for (var k = 0; k < vis.length && k < 8; k++) {
      var wrap = vis[k], li = liFor(wrap), iid = wrap.getAttribute("data-itemid") || "?";
      if (seen[iid]) continue; seen[iid] = 1;
      post({
        itemId: iid,
        dataLoaded: wrap.getAttribute("data-loaded"),
        liTag: li.tagName.toLowerCase(),
        liClass: cls(li).slice(0, 60),
        liText: (li.textContent || "").replace(/\s+/g, " ").trim().slice(0, 180),
        children: childMap(li),
        annotated: annotated(li),
        liHTML: (li.outerHTML || "").replace(/\s+/g, " ").slice(0, 4000)
      });
    }
  }
  var iv = setInterval(function () { scan(); if (sent >= MAX) clearInterval(iv); }, 1500);
  try { if (typeof GM_registerMenuCommand === "function") GM_registerMenuCommand("RWP diag: capture armoury now", function () { noted = false; seen = {}; sent = 0; scan(); }); } catch (_) {}
})();
