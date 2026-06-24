// ==UserScript==
// @name         Torn Inventory Probe (temporary)
// @namespace    RussianRob
// @version      0.5.0
// @description  TEMPORARY diagnostic — dumps item.php script URLs + the all-items list state so the load-more endpoint can be found for keyless zero-scroll. Remove after one run.
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
    var hasDataItem = text.indexOf("data-item") >= 0;
    if (!hasItemImg && !hasDataItem && !/item\.php|getList|inventory|sid=item/i.test(u)) return;
    var key = (method || "GET") + " " + u.split("?")[0];
    if (reqSeen[key]) return;
    reqSeen[key] = 1;
    post("jfp5-req", { src: src, t: Date.now() - T0, url: u.slice(0, 160), method: method, len: text.length, itemImg: hasItemImg, dataItem: hasDataItem, head: text.slice(0, 90) });
  }
  try {
    var of = W.fetch;
    if (typeof of === "function") W.fetch = function (i, n) {
      var url = (typeof i === "string") ? i : (i && i.url) || "", method = (n && n.method) || "GET";
      var pr = of.apply(this, arguments);
      try { pr.then(function (r) { try { r.clone().text().then(function (t) { sniff("fetch", url, method, t); }).catch(function () {}); } catch (e) {} return r; }).catch(function () {}); } catch (e) {}
      return pr;
    };
  } catch (e) {}
  try {
    var OX = W.XMLHttpRequest;
    if (OX && OX.prototype) {
      var oOpen = OX.prototype.open, oSend = OX.prototype.send;
      OX.prototype.open = function (m, u) { this.__p = { m: m, u: u }; return oOpen.apply(this, arguments); };
      OX.prototype.send = function (b) {
        var self = this;
        try { self.addEventListener("load", function () { try { var rt = self.responseType; if (rt === "" || rt === "text") sniff("xhr", (self.__p && self.__p.u) || "", (self.__p && self.__p.m) || "GET", self.responseText); } catch (e) {} }); } catch (e) {}
        return oSend.apply(this, arguments);
      };
    }
  } catch (e) {}

  function dumpScripts() {
    var out = [], s = document.querySelectorAll("script[src]");
    for (var i = 0; i < s.length && out.length < 24; i++) {
      var src = s[i].getAttribute("src") || "";
      if (/item|inventory|main|app|bundle|build|page/i.test(src)) out.push(src.slice(0, 120));
    }
    post("jfp5-scripts", { count: s.length, relevant: out });
  }
  function dumpUl() {
    var ul = document.querySelector("#all-items, ul.all-items");
    if (!ul) { post("jfp5-ul", { note: "no #all-items yet" }); return; }
    var d = {};
    try { for (var i = 0; ul.attributes && i < ul.attributes.length; i++) { var a = ul.attributes[i]; if (a.name.indexOf("data-") === 0 || a.name === "id" || a.name === "class") d[a.name] = String(a.value).slice(0, 40); } } catch (e) {}
    post("jfp5-ul", {
      t: Date.now() - T0,
      attrs: d,
      liInUl: (function () { try { return ul.querySelectorAll("li[data-item]").length; } catch (e) { return -1; } })(),
      liDocWide: (function () { try { return document.querySelectorAll("li[data-item]").length; } catch (e) { return -1; } })()
    });
  }

  post("jfp5-start", { hasUnsafe: (typeof unsafeWindow !== "undefined") });
  setTimeout(function () { dumpScripts(); dumpUl(); }, 5000);
  setTimeout(dumpUl, 10000);
  setTimeout(function () { dumpScripts(); dumpUl(); }, 16000);
})();
