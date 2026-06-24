// ==UserScript==
// @name         Torn Inventory Probe (temporary)
// @namespace    RussianRob
// @version      0.6.0
// @description  TEMPORARY diagnostic — calls item.php's own getNotAllItemsListWithoutGroups endpoint to prove keyless zero-scroll full-inventory fetch works. Remove after one run.
// @author       RussianRob
// @license      GPL-3.0-or-later
// @match        https://www.torn.com/item.php*
// @run-at       document-idle
// @grant        unsafeWindow
// @grant        GM_xmlhttpRequest
// @connect      tornwar.com
// ==/UserScript==
(function () {
  "use strict";
  var DIAG_URL = "https://tornwar.com/api/debug/client-log";
  var W = (typeof unsafeWindow !== "undefined") ? unsafeWindow : window;
  var logBudget = 24;

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

  function parseLis(html) {
    var tmp = document.createElement("ul"), out = [];
    try { tmp.innerHTML = html || ""; } catch (e) { return out; }
    var lis = tmp.querySelectorAll("li[data-item]");
    for (var i = 0; i < lis.length; i++) {
      var li = lis[i];
      out.push({
        id: li.getAttribute("data-item"),
        qty: li.getAttribute("data-qty"),
        name: li.getAttribute("data-sort"),
        cat: li.getAttribute("data-category"),
        eq: li.getAttribute("data-equipped")
      });
    }
    return out;
  }

  function run() {
    var ga = W.getAction;
    post("jfp6-start", { getAction: typeof ga, hasUnsafe: (typeof unsafeWindow !== "undefined") });
    if (typeof ga !== "function") { post("jfp6-done", { note: "no getAction global; cannot zero-scroll this way" }); return; }
    var ul = document.querySelector("#all-items");
    var q = (ul && ul.getAttribute("data-queue")) || "All";
    var total = 0, pages = 0, seen = {};
    function page(start, queue) {
      pages++;
      ga({
        type: "post", action: "item.php", dataType: "json",
        data: { step: "getNotAllItemsListWithoutGroups", start: start, queue: queue },
        success: function (str) {
          var json; try { json = (typeof str === "string") ? JSON.parse(str) : str; } catch (e) { post("jfp6-done", { note: "parse fail", head: String(str).slice(0, 120) }); return; }
          var lis = parseLis(json && json.html);
          for (var i = 0; i < lis.length; i++) seen[String(lis[i].id)] = 1;
          total += lis.length;
          if (pages <= 3) post("jfp6-page", { page: pages, count: json && json.count, htmlLen: (json && json.html) ? String(json.html).length : 0, start: json && json.start, queue: json && json.queue, parsedLi: lis.length, sample: lis[0] || null });
          var more = json && json.count && pages < 15 && json.start != null && Number(json.start) > Number(start);
          if (more) page(json.start, json.queue);
          else post("jfp6-done", { pages: pages, totalRows: total, distinctIds: Object.keys(seen).length, lastCount: json && json.count, lastStart: json && json.start });
        },
        error: function (xhr) { post("jfp6-done", { note: "getAction error", page: pages, status: xhr && xhr.status }); }
      });
    }
    page(0, q);
  }

  setTimeout(run, 6000);
})();
