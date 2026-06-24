// ==UserScript==
// @name         Torn Inventory Probe (temporary)
// @namespace    RussianRob
// @version      0.4.0
// @description  TEMPORARY diagnostic — inspects item.php DOM structure (where item ids live, how many are present) and any load-more request, to find a stable keyless zero-scroll read. Remove after one run.
// @author       RussianRob
// @license      GPL-3.0-or-later
// @match        https://www.torn.com/item.php*
// @run-at       document-start
// @grant        unsafeWindow
// @grant        GM_xmlhttpRequest
// @connect      tornwar.com
// ==/UserScript==
(function () {
  "use strict";
  var DIAG_URL = "https://tornwar.com/api/debug/client-log";
  var T0 = Date.now();
  var W = (typeof unsafeWindow !== "undefined") ? unsafeWindow : window;
  var logBudget = 40;
  var reqSeen = {};

  function post(tag, data) {
    if (logBudget-- <= 0) return;
    try {
      GM_xmlhttpRequest({
        method: "POST", url: DIAG_URL,
        headers: { "Content-Type": "application/json" },
        data: JSON.stringify({ tag: tag, data: data })
      });
    } catch (e) {}
  }

  function sniff(src, url, method, text) {
    if (!text || typeof text !== "string") return;
    var u = String(url || "");
    if (u && !/torn\.com/i.test(u) && u.charAt(0) !== "/") return;
    var hasItemImg = text.indexOf("/images/items/") >= 0;
    var relevant = hasItemImg || /item\.php|page\.php|inventory/i.test(u);
    if (!relevant) return;
    var key = (method || "GET") + " " + u.split("?")[0] + (u.indexOf("?") >= 0 ? "?…" : "");
    if (reqSeen[key]) return;
    reqSeen[key] = 1;
    post("jfp4-req", { src: src, t: Date.now() - T0, url: u.slice(0, 150), method: method, len: text.length, hasItemImg: hasItemImg, head: text.slice(0, 100) });
  }

  try {
    var of = W.fetch;
    if (typeof of === "function") {
      W.fetch = function (input, init) {
        var url = (typeof input === "string") ? input : (input && input.url) || "";
        var method = (init && init.method) || "GET";
        var pr = of.apply(this, arguments);
        try { pr.then(function (r) { try { r.clone().text().then(function (t) { sniff("fetch", url, method, t); }).catch(function () {}); } catch (e) {} return r; }).catch(function () {}); } catch (e) {}
        return pr;
      };
    }
  } catch (e) {}
  try {
    var OX = W.XMLHttpRequest;
    if (OX && OX.prototype) {
      var oOpen = OX.prototype.open, oSend = OX.prototype.send;
      OX.prototype.open = function (m, u) { this.__p = { m: m, u: u }; return oOpen.apply(this, arguments); };
      OX.prototype.send = function () {
        var self = this;
        try { self.addEventListener("load", function () { try { var rt = self.responseType; if (rt === "" || rt === "text") sniff("xhr", (self.__p && self.__p.u) || "", (self.__p && self.__p.m) || "GET", self.responseText); } catch (e) {} }); } catch (e) {}
        return oSend.apply(this, arguments);
      };
    }
  } catch (e) {}

  function cnt(sel) { try { return document.querySelectorAll(sel).length; } catch (e) { return -1; } }
  function attrsOf(el) {
    var o = { tag: (el.tagName || "").toLowerCase(), cls: String(el.className || "").slice(0, 46) };
    var da = [];
    try { for (var i = 0; el.attributes && i < el.attributes.length; i++) { var a = el.attributes[i]; if (a.name.indexOf("data-") === 0 || a.name === "id" || a.name === "href") da.push(a.name + "=" + String(a.value).slice(0, 24)); } } catch (e) {}
    if (da.length) o.d = da.slice(0, 6);
    return o;
  }

  function domDump(phase) {
    var imgs = document.querySelectorAll('img[src*="/images/items/"]');
    var counts = {
      imgs: imgs.length,
      dataItem: cnt("[data-item]"),
      dataItemId: cnt("[data-itemid]"),
      dataId: cnt("[data-id]"),
      dataArmoryId: cnt("[data-armoryid]"),
      tornItemImg: cnt("img.torn-item"),
      ulLi: cnt("ul li"),
      lazyImg: cnt('img[data-src*="/images/items/"]') + cnt('img[loading="lazy"]')
    };
    post("jfp4-counts", { phase: phase, t: Date.now() - T0, counts: counts });
    if (!imgs.length) return;
    var mid = imgs[Math.floor(imgs.length / 2)];
    var chain = [], el = mid;
    for (var h = 0; el && h < 8; h++) { chain.push(attrsOf(el)); el = el.parentElement; }
    post("jfp4-chain", { phase: phase, chain: chain });
    var row = (mid.closest && (mid.closest("li") || mid.closest('[class*="item"]'))) || mid.parentElement || mid;
    var html = ""; try { html = String(row.outerHTML || "").slice(0, 420); } catch (e) {}
    post("jfp4-html", { phase: phase, html: html });
  }

  post("jfp4-start", { hasUnsafe: (typeof unsafeWindow !== "undefined") });
  setTimeout(function () { domDump("pre"); }, 5000);
  setTimeout(function () { domDump("post"); }, 16000);
})();
