// ==UserScript==
// @name         Torn Inventory Probe (temporary)
// @namespace    RussianRob
// @version      0.1.0
// @description  TEMPORARY diagnostic — reports how item.php loads inventory (fetch/XHR, bulk vs paginated) to decide if keyless zero-scroll is possible. Remove after one run.
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

  var seenIds = {};
  var invReqCount = 0;
  var topHit = null;
  var jsonPaths = {};
  var scrolled = false;
  var postedPost = false;
  var logBudget = 30;

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

  var ID_KEYS = ["id", "ID", "itemID", "item_id", "itemId"];
  var ITEM_KEYS = ["name", "quantity", "amount", "qty", "market_price", "market_value", "type", "sub_type", "equipped", "uid"];
  function firstId(o) { for (var i = 0; i < ID_KEYS.length; i++) if (o[ID_KEYS[i]] != null) return o[ID_KEYS[i]]; return null; }
  function looksLikeItem(o) {
    if (!o || typeof o !== "object") return false;
    if (firstId(o) == null) return false;
    for (var i = 0; i < ITEM_KEYS.length; i++) if (o[ITEM_KEYS[i]] != null) return true;
    return false;
  }

  function findItemArrays(root) {
    var hits = [], stack = [root], visited = 0;
    while (stack.length && visited < 4000) {
      var node = stack.pop(); visited++;
      if (!node || typeof node !== "object") continue;
      if (Array.isArray(node)) {
        if (node.length && looksLikeItem(node[0])) {
          var keys = Object.keys(node[0]).slice(0, 12);
          var ids = [];
          for (var k = 0; k < node.length; k++) { var id = firstId(node[k]); if (id != null) ids.push(id); }
          hits.push({ count: node.length, keys: keys, ids: ids });
        } else {
          for (var a = 0; a < node.length && a < 50; a++) stack.push(node[a]);
        }
      } else {
        for (var p in node) { try { stack.push(node[p]); } catch (e) {} }
      }
    }
    return hits;
  }

  function analyze(src, url, method, text) {
    if (!text || typeof text !== "string" || text.length > 3000000) return;
    if (text.charAt(0) !== "{" && text.charAt(0) !== "[") return;
    var u = String(url || "");
    if (u && !/torn\.com/i.test(u) && u.charAt(0) !== "/") return;
    var j; try { j = JSON.parse(text); } catch (e) { return; }
    var path = (u.split("?")[0]) || "(relative)";
    if (!jsonPaths[path]) jsonPaths[path] = { m: method, q: u.indexOf("?") >= 0 ? 1 : 0 };
    var hits = findItemArrays(j);
    if (!hits.length) return;
    invReqCount++;
    var biggest = hits[0];
    for (var i = 1; i < hits.length; i++) if (hits[i].count > biggest.count) biggest = hits[i];
    for (var x = 0; x < biggest.ids.length; x++) seenIds[String(biggest.ids[x])] = 1;
    if (!topHit || biggest.count > topHit.count) {
      topHit = { src: src, url: path.slice(0, 120), count: biggest.count, keys: biggest.keys, sampleIds: biggest.ids.slice(0, 4) };
    }
    post("jfp-hit", {
      src: src, t: Date.now() - T0, scrolled: scrolled,
      url: u.slice(0, 140), method: method,
      thisCount: biggest.count, cumDistinct: Object.keys(seenIds).length,
      keys: biggest.keys, sampleIds: biggest.ids.slice(0, 4)
    });
  }

  try {
    var of = W.fetch;
    if (typeof of === "function") {
      W.fetch = function (input, init) {
        var url = (typeof input === "string") ? input : (input && input.url) || "";
        var method = (init && init.method) || (input && input.method) || "GET";
        var pr = of.apply(this, arguments);
        try {
          pr.then(function (resp) {
            try { resp.clone().text().then(function (t) { analyze("fetch", url, method, t); }).catch(function () {}); } catch (e) {}
            return resp;
          }).catch(function () {});
        } catch (e) {}
        return pr;
      };
    }
  } catch (e) {}

  try {
    var OX = W.XMLHttpRequest;
    if (OX && OX.prototype) {
      var oOpen = OX.prototype.open, oSend = OX.prototype.send;
      OX.prototype.open = function (m, u) { this.__jfp = { m: m, u: u }; return oOpen.apply(this, arguments); };
      OX.prototype.send = function () {
        var self = this;
        try {
          self.addEventListener("load", function () {
            try {
              var rt = self.responseType;
              if (rt === "" || rt === "text") analyze("xhr", (self.__jfp && self.__jfp.u) || "", (self.__jfp && self.__jfp.m) || "GET", self.responseText);
            } catch (e) {}
          });
        } catch (e) {}
        return oSend.apply(this, arguments);
      };
    }
  } catch (e) {}

  ["scroll", "wheel", "touchmove"].forEach(function (ev) {
    try { W.addEventListener(ev, function () { if (!scrolled) { scrolled = true; setTimeout(postPost, 6000); } }, { passive: true, capture: true }); } catch (e) {}
  });

  function domItemImgs() {
    try { return document.querySelectorAll('img[src*="/images/items/"]').length; } catch (e) { return -1; }
  }
  function snapshot(phase) {
    return {
      phase: phase, tload: Date.now() - T0, scrolled: scrolled,
      hasUnsafe: (typeof unsafeWindow !== "undefined"),
      domItemImgs: domItemImgs(),
      invItemsSeen: Object.keys(seenIds).length,
      invRequests: invReqCount,
      topHit: topHit,
      jsonPaths: Object.keys(jsonPaths).slice(0, 12).map(function (p) { return (jsonPaths[p].m || "?") + " " + p.slice(0, 80) + (jsonPaths[p].q ? "?…" : ""); })
    };
  }
  function postPost() { if (postedPost) return; postedPost = true; post("jfp-post", snapshot("post-scroll")); }

  post("jfp-start", { hasUnsafe: (typeof unsafeWindow !== "undefined"), hasFetch: typeof W.fetch, hasXHR: !!(W.XMLHttpRequest && W.XMLHttpRequest.prototype) });
  setTimeout(function () { post("jfp-pre", snapshot("pre-scroll")); }, 5000);
  setTimeout(postPost, 25000);
})();
