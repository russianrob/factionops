// ==UserScript==
// @name         Torn Foreign Stocks
// @namespace    RussianRob
// @version      0.3.0
// @description  Shows abroad item stock (and optional profit) inline on the Torn travel page
// @author       RussianRob
// @license      GPL-3.0-or-later
// @match        https://www.torn.com/page.php*
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @connect      api.prombot.co.uk
// @connect      raw.githubusercontent.com
// @connect      yata.yt
// @connect      api.torn.com
// @run-at       document-idle
// @downloadURL  https://update.greasyfork.org/scripts/581933/Torn%20Foreign%20Stocks.user.js
// @updateURL    https://update.greasyfork.org/scripts/581933/Torn%20Foreign%20Stocks.meta.js
// ==/UserScript==
(function () {
  "use strict";
  var SCRIPT_VERSION = "0.3.0";
  var YATA_URL = "https://yata.yt/api/v1/travel/export/";
  var PROMBOT_URL = "https://api.prombot.co.uk/api/travel";
  var TORN_ITEMS_URL = "https://api.torn.com/v2/torn?selections=items&key=";
  var MODEL_URL = "https://raw.githubusercontent.com/russianrob/torn-foreign-restock/main/restock-model.json";
  var MODEL_TTL = 600;
  var STOCK_TTL = 60, PRICE_TTL = 21600, STALE_MIN = 30;

  // ─── pure helpers (unit-tested) ──────────────────────────
  var COUNTRY_MAP = {
    "mexico": "mex", "cayman islands": "cay", "canada": "can", "hawaii": "haw",
    "united kingdom": "uni", "uk": "uni", "argentina": "arg", "switzerland": "swi",
    "japan": "jap", "china": "chi", "uae": "uae", "united arab emirates": "uae",
    "south africa": "sou"
  };
  function normalizeCountryName(name) {
    if (!name) return null;
    var k = String(name).trim().toLowerCase().replace(/\s+/g, " ");
    return COUNTRY_MAP[k] || null;
  }
  function parseYataExport(json) {
    var out = {}, stocks = (json && json.stocks) || {};
    for (var code in stocks) {
      if (!Object.prototype.hasOwnProperty.call(stocks, code)) continue;
      var c = stocks[code] || {};
      var items = (c.stocks || []).map(function (it) {
        return { id: it.id, name: it.name, qty: it.quantity, cost: it.cost, nextRestock: (it.nextRestock != null ? it.nextRestock : null) };
      });
      out[code] = { update: c.update || 0, items: items };
    }
    return out;
  }
  function groupThousands(n) {
    return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }
  function fmtMoney(n) {
    if (typeof n !== "number" || !isFinite(n)) return "—";
    return "$" + groupThousands(Math.round(n));
  }
  function fmtProfit(n) {
    if (typeof n !== "number" || !isFinite(n)) return "—";
    return (n < 0 ? "-$" : "+$") + groupThousands(Math.round(Math.abs(n)));
  }
  function formatAge(updateSec, nowSecVal) {
    var diff = Math.max(0, Math.floor(nowSecVal - updateSec));
    var mins = Math.floor(diff / 60), text;
    if (diff < 60) text = "just now";
    else if (mins < 60) text = mins + "m ago";
    else text = Math.floor(mins / 60) + "h " + (mins % 60) + "m ago";
    return { text: text, stale: mins >= STALE_MIN };
  }
  function buildRows(items, opts) {
    opts = opts || {};
    var mode = opts.mode || "stock";
    var getValue = opts.getValue || function () { return undefined; };
    return items.map(function (it) {
      var value = (mode === "profit") ? getValue(it.id) : undefined;
      value = (typeof value === "number" && isFinite(value)) ? value : null;
      var profit = (value == null) ? null : (value - it.cost);
      return { id: it.id, name: it.name, qty: it.qty, cost: it.cost, value: value, profit: profit, nextRestock: it.nextRestock || null };
    });
  }
  function restockEta(nextRestock, nowMs) {
    if (!nextRestock) return null;
    var t = Date.parse(nextRestock);
    if (isNaN(t)) return null;
    if (t > nowMs) {
      var mins = Math.ceil((t - nowMs) / 60000);
      return { mins: mins, text: (mins < 60) ? (mins + "m") : (Math.floor(mins / 60) + "h " + (mins % 60) + "m"), due: false };
    }
    if ((nowMs - t) <= 3600000) return { mins: 0, text: "due", due: true };
    return null;
  }
  function fmtDuration(sec) {
    var m = Math.round(sec / 60);
    return (m < 60) ? (m + "m") : (Math.floor(m / 60) + "h " + (m % 60) + "m");
  }
  function modelEstimate(entry, nowMs) {
    if (!entry || !entry.interval) return null;
    var leftSec = (entry.last + entry.interval) - Math.floor(nowMs / 1000);
    var left = (leftSec > 0) ? ("~" + fmtDuration(leftSec)) : "due";
    return "~every " + fmtDuration(entry.interval) + " · " + left + " (" + (entry.rel || "low") + ")";
  }
  function restockDisplay(nextRestock, entry, nowMs) {
    var live = restockEta(nextRestock, nowMs);
    if (live && !live.due) return "restocks in " + live.text;
    var est = modelEstimate(entry, nowMs);
    if (est) return est;
    if (live && live.due) return "restock due";
    return "out of stock";
  }
  function sortRows(rows, mode, nowMs) {
    if (nowMs == null) nowMs = Date.now();
    var arr = rows.slice();
    arr.sort(function (a, b) {
      var ai = a.qty > 0, bi = b.qty > 0;
      if (ai !== bi) return ai ? -1 : 1;
      if (ai) {
        var pa, pb;
        if (mode === "profit") { pa = (a.profit == null ? -Infinity : a.profit); pb = (b.profit == null ? -Infinity : b.profit); }
        else { pa = a.cost; pb = b.cost; }
        if (pb !== pa) return pb - pa;
        if (b.qty !== a.qty) return b.qty - a.qty;
        return String(a.name).localeCompare(String(b.name));
      }
      var ea = restockEta(a.nextRestock, nowMs), eb = restockEta(b.nextRestock, nowMs);
      var ma = ea ? (ea.due ? 1e9 : ea.mins) : Infinity, mb = eb ? (eb.due ? 1e9 : eb.mins) : Infinity;
      if (ma !== mb) return ma - mb;
      return String(a.name).localeCompare(String(b.name));
    });
    return arr;
  }

  // ─── GM / data layer ─────────────────────────────────────
  var _fetchJson = function (url) {
    return new Promise(function (resolve, reject) {
      GM_xmlhttpRequest({
        method: "GET", url: url, timeout: 15000,
        onload: function (r) { try { resolve(JSON.parse(r.responseText)); } catch (e) { reject(e); } },
        onerror: function () { reject(new Error("network")); },
        ontimeout: function () { reject(new Error("timeout")); }
      });
    });
  };
  var _nowSec = function () { return Math.floor(Date.now() / 1000); };
  function gmGet(key, def) {
    try {
      var g = (typeof GM_getValue === "function") ? GM_getValue : (typeof globalThis !== "undefined" ? globalThis.GM_getValue : null);
      var v = g ? g(key, null) : null;
      return v == null ? def : JSON.parse(v);
    } catch (e) { return def; }
  }
  function gmSet(key, val) {
    try {
      var s = (typeof GM_setValue === "function") ? GM_setValue : (typeof globalThis !== "undefined" ? globalThis.GM_setValue : null);
      if (s) s(key, JSON.stringify(val));
    } catch (e) {}
  }
  function getStock(force) {
    var cached = gmGet("tfs_stock", null);
    if (!force && cached && (_nowSec() - cached.t) < STOCK_TTL) return Promise.resolve(cached.data);
    function store(json) { var data = parseYataExport(json); gmSet("tfs_stock", { t: _nowSec(), data: data }); return data; }
    return _fetchJson(PROMBOT_URL).then(store).catch(function () {
      return _fetchJson(YATA_URL).then(store).catch(function () { return cached ? cached.data : null; });
    });
  }
  function getPrices(key) {
    if (!key) return Promise.resolve({});
    var cached = gmGet("tfs_prices", null);
    if (cached && cached.key === key && (_nowSec() - cached.t) < PRICE_TTL) return Promise.resolve(cached.map);
    return _fetchJson(TORN_ITEMS_URL + encodeURIComponent(key)).then(function (json) {
      if (json && json.error) throw new Error((json.error && json.error.error) || "API error");
      var items = (json && json.items) || {};
      var list = Array.isArray(items) ? items : Object.keys(items).map(function (k) { var o = items[k] || {}; if (o.id == null) o.id = Number(k); return o; });
      var map = {};
      list.forEach(function (it) {
        var v = (it.value && it.value.market_price != null) ? it.value.market_price : (it.market_value != null ? it.market_value : it.marketValue);
        if (v != null) map[it.id] = v;
      });
      gmSet("tfs_prices", { t: _nowSec(), key: key, map: map });
      return map;
    });
  }
  function getModel() {
    var cached = gmGet("tfs_model", null);
    if (cached && (_nowSec() - cached.t) < MODEL_TTL) return Promise.resolve(cached.data);
    return _fetchJson(MODEL_URL).then(function (json) {
      var data = (json && json.items) ? json.items : {};
      gmSet("tfs_model", { t: _nowSec(), data: data });
      return data;
    }).catch(function () { return cached ? cached.data : {}; });
  }

  // ─── DOM: settings, injector, observer ───────────────────
  function getMode() { var m = gmGet("tfs_mode", "stock"); return (m === "profit") ? "profit" : "stock"; }
  function setMode(m) { gmSet("tfs_mode", m); }
  function getKey() { return gmGet("tfs_key", "") || ""; }
  function setKey(k) { gmSet("tfs_key", String(k || "").trim()); }
  function tfsMsg(s) { var m = document.querySelector("#tfs-bar .tfs-msg"); if (m) m.textContent = s ? (" " + s) : ""; }
  function escapeHtml(s) { return String(s).replace(/[&<>"]/g, function (c) { return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]; }); }

  function injectCss() {
    if (document.getElementById("tfs-css")) return;
    var s = document.createElement("style");
    s.id = "tfs-css";
    s.textContent =
      ".tfs-bar{display:flex;align-items:center;gap:6px;flex-wrap:wrap;padding:6px 8px;margin:6px 0;background:#1a1a1a;border:1px solid #333;border-radius:4px;font-size:12px;color:#ccc;}" +
      ".tfs-bar .tfs-title{font-weight:700;color:#e8c44a;margin-right:4px;}" +
      ".tfs-toggle{background:#2a2a2a;color:#bbb;border:1px solid #444;border-radius:3px;padding:2px 8px;cursor:pointer;}" +
      ".tfs-toggle.on{background:#2a3fff;color:#fff;border-color:#2a3fff;}" +
      ".tfs-refresh{background:#2a2a2a;color:#bbb;border:1px solid #444;border-radius:3px;padding:2px 7px;cursor:pointer;}" +
      ".tfs-key{background:#111;border:1px solid #444;color:#ddd;border-radius:3px;padding:2px 6px;width:150px;}" +
      ".tfs-save{background:#2a2a2a;color:#bbb;border:1px solid #444;border-radius:3px;padding:2px 8px;cursor:pointer;}" +
      ".tfs-msg{color:#e88;}" +
      ".tfs-panel{margin:4px 0 8px;font-size:12px;}" +
      ".tfs-head .tfs-age{color:#888;}.tfs-head .tfs-age.stale{opacity:.5;}" +
      ".tfs-row{display:flex;gap:8px;padding:1px 0;align-items:baseline;}" +
      ".tfs-name{flex:1;min-width:0;color:#ddd;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}" +
      ".tfs-qty{color:#888;}.tfs-cost{color:#bbb;min-width:60px;text-align:right;}" +
      ".tfs-row.out{opacity:.6;}" +
      ".tfs-oos{color:#d6a86a;font-style:italic;margin-left:auto;text-align:right;white-space:nowrap;}" +
      ".tfs-profit{min-width:80px;text-align:right;}.tfs-profit.pos{color:#5ad15a;}.tfs-profit.neg{color:#777;}";
    document.head.appendChild(s);
  }

  function injectSettingsBar(onChange) {
    if (document.getElementById("tfs-bar")) return;
    var bar = document.createElement("div");
    bar.id = "tfs-bar"; bar.className = "tfs-bar";
    var mode = getMode();
    bar.innerHTML =
      '<span class="tfs-title">Foreign Stock</span>' +
      '<button class="tfs-toggle" data-mode="stock">Stock</button>' +
      '<button class="tfs-toggle" data-mode="profit">Profit</button>' +
      '<button class="tfs-refresh" title="Refresh stock">↻</button>' +
      '<span class="tfs-keywrap" style="display:' + (mode === "profit" ? "inline-flex" : "none") + '">' +
      '<input class="tfs-key" type="password" placeholder="Torn API key for profit" value="' + getKey().replace(/"/g, "") + '">' +
      '<button class="tfs-save">Save</button></span>' +
      '<span class="tfs-msg"></span>';
    function paint() {
      var m = getMode();
      var tg = bar.querySelectorAll(".tfs-toggle");
      for (var i = 0; i < tg.length; i++) { tg[i].classList.toggle("on", tg[i].getAttribute("data-mode") === m); }
      bar.querySelector(".tfs-keywrap").style.display = (m === "profit") ? "inline-flex" : "none";
    }
    var toggles = bar.querySelectorAll(".tfs-toggle");
    for (var t = 0; t < toggles.length; t++) {
      (function (btn) { btn.addEventListener("click", function () { setMode(btn.getAttribute("data-mode")); paint(); onChange(false); }); })(toggles[t]);
    }
    bar.querySelector(".tfs-refresh").addEventListener("click", function () { onChange(true); });
    bar.querySelector(".tfs-save").addEventListener("click", function () {
      var v = bar.querySelector(".tfs-key").value.trim();
      if (!v) { tfsMsg("enter a key"); return; }
      setKey(v); tfsMsg("saved"); onChange(true);
    });
    paint();
    var anchor = document.querySelector('[class*="destinationList___"]');
    if (anchor && anchor.parentNode) { anchor.parentNode.insertBefore(bar, anchor); }
    else { var c = document.querySelector(".content") || document.body; c.insertBefore(bar, c.firstChild); }
  }

  function findDestinations() {
    var out = [], seen = [];
    var spans = document.querySelectorAll('span[class*="country___"]');
    for (var i = 0; i < spans.length; i++) {
      var code = normalizeCountryName((spans[i].textContent || "").trim());
      if (!code) continue;
      var row = spans[i];
      for (var up = 0; up < 6 && row; up++) {
        var cn = (row.getAttribute && row.getAttribute("class")) || "";
        if (/destination___/.test(cn) && !/destinationList___|destinationDetails___/.test(cn)) break;
        row = row.parentElement;
      }
      if (!row || !/destination___/.test((row.getAttribute && row.getAttribute("class")) || "")) continue;
      if (seen.indexOf(row) !== -1) continue;
      seen.push(row); out.push({ el: row, code: code });
    }
    return out;
  }

  function renderPanel(destEl, code, stock, mode, prices, model) {
    var country = stock[code];
    if (!country) return;
    var rows = sortRows(buildRows(country.items, { mode: mode, getValue: function (id) { return prices[id]; } }), mode);
    var age = formatAge(country.update, Math.floor(Date.now() / 1000));
    var html = '<div class="tfs-head"><span class="tfs-age' + (age.stale ? " stale" : "") + '">updated ' + age.text + '</span></div><div class="tfs-rows">';
    var nowMs = Date.now();
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      if (r.qty === 0) {
        var entry = (model && model[code]) ? model[code][String(r.id)] : null;
        html += '<div class="tfs-row out"><span class="tfs-name">' + escapeHtml(r.name) + '</span>' +
          '<span class="tfs-oos">' + restockDisplay(r.nextRestock, entry, nowMs) + '</span></div>';
      } else {
        html += '<div class="tfs-row"><span class="tfs-name">' + escapeHtml(r.name) + '</span><span class="tfs-qty">×' + r.qty + '</span><span class="tfs-cost">' + fmtMoney(r.cost) + '</span>' +
          (mode === "profit" ? '<span class="tfs-profit ' + (r.profit != null && r.profit > 0 ? "pos" : "neg") + '">' + fmtProfit(r.profit) + ' ea</span>' : '') + '</div>';
      }
    }
    html += '</div>';
    var existing = destEl.querySelector(".tfs-panel");
    if (existing) { existing.innerHTML = html; }
    else { var p = document.createElement("div"); p.className = "tfs-panel"; p.innerHTML = html; destEl.appendChild(p); }
  }

  var _applyTimer = null;
  function paintPanels(stock, mode, prices, model) {
    var dests = findDestinations();
    for (var i = 0; i < dests.length; i++) renderPanel(dests[i].el, dests[i].code, stock, mode, prices, model || {});
  }
  function applyAll(force) {
    var mode = getMode(), key = getKey();
    Promise.all([getStock(force), getModel()]).then(function (res) {
      var stock = res[0], model = res[1] || {};
      if (!stock) { tfsMsg("stock unavailable"); return; }
      if (mode === "profit" && key) {
        return getPrices(key).then(function (m) { tfsMsg(""); paintPanels(stock, "profit", m, model); })
          .catch(function () { tfsMsg("key error"); paintPanels(stock, "stock", {}, model); });
      }
      if (mode === "profit" && !key) tfsMsg("add a key for profit");
      paintPanels(stock, "stock", {}, model);
    });
  }
  function scheduleApply() {
    if (_applyTimer) clearTimeout(_applyTimer);
    _applyTimer = setTimeout(function () { applyAll(false); }, 200);
  }
  function startObserver() {
    var root = document.querySelector('[class*="destinationList___"]') || document.querySelector(".content") || document.body;
    var obs = new MutationObserver(scheduleApply);
    obs.observe(root, { childList: true, subtree: true });
  }

  function main() {
    injectCss();
    injectSettingsBar(function (force) { applyAll(!!force); });
    applyAll(false);
    startObserver();
    setInterval(function () { applyAll(false); }, 30000);
    try { if (typeof GM_registerMenuCommand === "function") GM_registerMenuCommand("Foreign Stock: refresh", function () { applyAll(true); }); } catch (e) {}
  }

  if (typeof window !== "undefined" && typeof location !== "undefined" && /\/page\.php/.test(location.pathname) && /sid=travel/.test(location.search + location.hash)) {
    main();
  }
  if (typeof module !== "undefined" && module.exports) {
    module.exports = {
      normalizeCountryName: normalizeCountryName, COUNTRY_MAP: COUNTRY_MAP,
      parseYataExport: parseYataExport, fmtMoney: fmtMoney, fmtProfit: fmtProfit, formatAge: formatAge,
      buildRows: buildRows, sortRows: sortRows, restockEta: restockEta,
      fmtDuration: fmtDuration, modelEstimate: modelEstimate, restockDisplay: restockDisplay
    };
    module.exports.getStock = getStock;
    module.exports.getPrices = getPrices;
    module.exports.getModel = getModel;
    module.exports.__setFetch = function (fn) { _fetchJson = fn; };
    module.exports.__setClock = function (fn) { _nowSec = fn; };
  }
})();
