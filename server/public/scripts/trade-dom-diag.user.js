// ==UserScript==
// @name         Trade DOM Diag
// @namespace    RussianRob
// @version      1.1.0
// @description  Temporary diagnostic — reports the trade.php DOM (active-trade view) so RW Pricer can price trade items. Safe to remove after.
// @author       RussianRob
// @match        https://www.torn.com/trade.php*
// @grant        GM_xmlhttpRequest
// @grant        GM_registerMenuCommand
// @connect      tornwar.com
// @run-at       document-idle
// ==/UserScript==
(function () {
  "use strict";
  var DIAG_URL = "https://tornwar.com/api/debug/client-log";
  var sent = 0, MAX = 40, captured = {};
  function post(p) {
    if (sent >= MAX) return; sent++;
    try { GM_xmlhttpRequest({ method: "POST", url: DIAG_URL, headers: { "Content-Type": "application/json" }, data: JSON.stringify({ tag: "trade-dom-diag", data: p }) }); } catch (e) {}
  }
  // Stagger sends — PDA's GM engine drops rapid concurrent POSTs.
  function postQueue(arr) {
    var k = 0;
    (function next() {
      if (k >= arr.length) return;
      post(arr[k++]);
      setTimeout(next, 150);
    })();
  }
  function cls(el) { try { return (el.getAttribute && el.getAttribute("class")) || ""; } catch (_) { return ""; } }
  function clean(html) {
    return String(html)
      .replace(/<svg[\s\S]*?<\/svg>/gi, "<svg/>")
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/\s+/g, " ").trim();
  }
  function rowProbe(root) {
    var out = [], all = root.querySelectorAll("li, tr, div");
    for (var i = 0; i < all.length && out.length < 6; i++) {
      var n = all[i];
      var t = (n.textContent || "").replace(/\s+/g, " ").trim();
      if (t.length > 3 && t.length < 110 && /x\d+/.test(t) && n.querySelectorAll("li, tr").length === 0) {
        out.push(n.tagName.toLowerCase() + "." + cls(n).slice(0, 30) + " | " + t.slice(0, 70) + " | html:" + clean(n.outerHTML).slice(0, 420));
      }
    }
    return out;
  }
  // Only the active-trade view (has the side panels / totals), NOT the
  // "New Trade" initiation screen.
  function isActiveTrade(text) {
    return /total value/i.test(text) || /in trade/i.test(text);
  }
  function run() {
    var el = document.querySelector("#trade-container") || document.querySelector("#mainContainer");
    if (!el) return;
    var text = (el.textContent || "").replace(/\s+/g, " ").trim();
    if (!isActiveTrade(text)) return;
    var html = clean(el.outerHTML);
    if (html.length < 200) return;
    var key = location.hash + "|" + html.length;
    if (captured[key]) return;
    captured[key] = 1;
    var batch = [];
    batch.push({ note: "active trade", url: location.href.slice(0, 140), tag: el.tagName.toLowerCase(), id: el.id || "", len: html.length });
    var probe = rowProbe(el);
    for (var r = 0; r < probe.length; r++) batch.push({ rowProbe: r, v: probe[r] });
    var CH = 1100, n = Math.min(Math.ceil(html.length / CH), 16);
    for (var i = 0; i < n; i++) batch.push({ i: i, n: n, s: html.slice(i * CH, (i + 1) * CH) });
    postQueue(batch);
  }
  var tries = 0;
  var iv = setInterval(function () { tries++; run(); if (sent >= MAX || tries > 120) clearInterval(iv); }, 1000);
  window.addEventListener("hashchange", function () { tries = 0; setTimeout(run, 400); });
  try {
    var obs = new MutationObserver(function () { run(); });
    obs.observe(document.body, { childList: true, subtree: true });
  } catch (_) {}
  try { if (typeof GM_registerMenuCommand === "function") GM_registerMenuCommand("Trade diag: capture now", function () { captured = {}; sent = 0; run(); }); } catch (_) {}
})();
