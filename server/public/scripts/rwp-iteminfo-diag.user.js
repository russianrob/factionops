// ==UserScript==
// @name         RWP Item-Info Diag
// @namespace    RussianRob
// @version      1.0.0
// @description  Temporary diagnostic — reports why RW Pricer shows two/wrong RWP EST badges on the item info page. Safe to remove after.
// @author       RussianRob
// @match        https://www.torn.com/item*
// @match        https://www.torn.com/page.php?sid=ItemMarket*
// @grant        GM_xmlhttpRequest
// @grant        GM_registerMenuCommand
// @connect      tornwar.com
// @run-at       document-idle
// ==/UserScript==
(function () {
  "use strict";
  var DIAG_URL = "https://tornwar.com/api/debug/client-log";
  var sent = 0, MAX = 24, doneKeys = {};
  function post(p) {
    if (sent >= MAX) return; sent++;
    try { GM_xmlhttpRequest({ method: "POST", url: DIAG_URL, headers: { "Content-Type": "application/json" }, data: JSON.stringify({ tag: "rwp-iteminfo-diag", data: p }) }); } catch (e) {}
  }
  function cls(el) { try { return (el.getAttribute && el.getAttribute("class")) || ""; } catch (_) { return ""; } }
  function clean(h) { return String(h).replace(/<svg[\s\S]*?<\/svg>/gi, "<svg/>").replace(/<(script|style)[\s\S]*?<\/\1>/gi, "").replace(/\s+/g, " ").trim(); }
  function rarityCues(el) {
    var out = {};
    var iw = el.querySelector('[class*="imageWrapper"]');
    out.imageWrapper = iw ? cls(iw).slice(0, 80) : null;
    var re = el.querySelector('[class*="rarity___"]');
    out.rarityEl = re ? (re.textContent || "").trim().slice(0, 30) : null;
    var inner = (el.innerHTML || "");
    var gm = inner.match(/glow-(red|orange|yellow)/i);
    out.glowInInner = gm ? gm[0] : null;
    out.extraordinary = /extraordinary/i.test(inner) ? "extraordinary" : (/extremely[_-]?rare/i.test(inner) ? "extremely-rare" : null);
    return out;
  }
  function nearestNamed(badge) {
    var e = badge;
    for (var up = 0; up < 8 && e; up++) {
      var nm = e.querySelector && (e.querySelector('[class*="name___"]') || e.querySelector('.name-wrap .name') || e.querySelector('.item-name') || e.querySelector('[class*="title"]'));
      if (nm && (nm.textContent || "").trim()) return { holder: e, name: (nm.textContent || "").trim().slice(0, 40) };
      e = e.parentElement;
    }
    return { holder: badge.parentElement, name: "" };
  }
  function run() {
    var badges = document.querySelectorAll('.rwp-price-tag');
    if (!badges.length) return;
    var key = location.pathname + location.search + "|" + badges.length;
    if (doneKeys[key]) return;
    doneKeys[key] = 1;
    post({ note: "page", url: location.href.slice(0, 160), badgeCount: badges.length,
           sel_itemInfoWrapper: document.querySelectorAll('[class*="itemInfoWrapper"]').length,
           sel_itemInfo: document.querySelectorAll('[class*="itemInfo___"]').length,
           sel_showItemInfo: document.querySelectorAll('li.show-item-info, div.show-item-info, [class*="info___"].show-item-info').length,
           sel_tile: document.querySelectorAll('div[class*="itemTile___"], div[class^="itemTile"]').length });
    for (var i = 0; i < badges.length && i < 4; i++) {
      var b = badges[i];
      var valEl = b.querySelector('.rwp-price-tag-value');
      var labEl = b.querySelector('.rwp-price-tag-label');
      var nn = nearestNamed(b);
      var holder = nn.holder;
      post({
        badge: i,
        label: labEl ? (labEl.textContent || "").trim() : "",
        value: valEl ? (valEl.textContent || "").trim() : (b.textContent || "").trim().slice(0, 24),
        name: nn.name,
        holderTag: holder ? holder.tagName.toLowerCase() : "?",
        holderClass: holder ? cls(holder).slice(0, 70) : "",
        cues: rarityCues(holder || b),
        holderHTML: clean((holder && holder.outerHTML) || "").slice(0, 1100)
      });
    }
  }
  var tries = 0;
  var iv = setInterval(function () { tries++; run(); if (sent >= MAX || tries > 60) clearInterval(iv); }, 1000);
  try { if (typeof GM_registerMenuCommand === "function") GM_registerMenuCommand("RWP item-info diag: capture now", function () { doneKeys = {}; sent = 0; run(); }); } catch (_) {}
})();
