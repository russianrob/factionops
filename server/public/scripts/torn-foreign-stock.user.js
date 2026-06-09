// ==UserScript==
// @name         Foreign Stock
// @namespace    RussianRob
// @version      0.1.0
// @description  Shows abroad item stock (and optional profit) inline on the Torn travel page
// @author       RussianRob
// @license      GPL-3.0-or-later
// @match        https://www.torn.com/page.php*
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @connect      yata.yt
// @connect      api.torn.com
// @run-at       document-idle
// @downloadURL  https://tornwar.com/scripts/torn-foreign-stock.user.js
// @updateURL    https://tornwar.com/scripts/torn-foreign-stock.user.js
// ==/UserScript==
(function () {
  "use strict";
  var SCRIPT_VERSION = "0.1.0";
  var YATA_URL = "https://yata.yt/api/v1/travel/export/";
  var TORN_ITEMS_URL = "https://api.torn.com/v2/torn?selections=items&key=";
  var STOCK_TTL = 300, PRICE_TTL = 21600, STALE_MIN = 30;

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
        return { id: it.id, name: it.name, qty: it.quantity, cost: it.cost };
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
      return { id: it.id, name: it.name, qty: it.qty, cost: it.cost, value: value, profit: profit };
    });
  }
  function sortRows(rows, mode) {
    var arr = rows.slice();
    arr.sort(function (a, b) {
      var pa, pb;
      if (mode === "profit") { pa = (a.profit == null ? -Infinity : a.profit); pb = (b.profit == null ? -Infinity : b.profit); }
      else { pa = a.cost; pb = b.cost; }
      if (pb !== pa) return pb - pa;
      if (b.qty !== a.qty) return b.qty - a.qty;
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
    return _fetchJson(YATA_URL).then(function (json) {
      var data = parseYataExport(json);
      gmSet("tfs_stock", { t: _nowSec(), data: data });
      return data;
    }).catch(function () { return cached ? cached.data : null; });
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

  // ─── DOM: settings, injector, observer ───────────────────

  function main() {}

  if (typeof window !== "undefined" && typeof location !== "undefined" && /\/page\.php/.test(location.pathname) && /sid=travel/.test(location.search + location.hash)) {
    main();
  }
  if (typeof module !== "undefined" && module.exports) {
    module.exports = {
      normalizeCountryName: normalizeCountryName, COUNTRY_MAP: COUNTRY_MAP,
      parseYataExport: parseYataExport, fmtMoney: fmtMoney, fmtProfit: fmtProfit, formatAge: formatAge,
      buildRows: buildRows, sortRows: sortRows
    };
    module.exports.getStock = getStock;
    module.exports.getPrices = getPrices;
    module.exports.__setFetch = function (fn) { _fetchJson = fn; };
    module.exports.__setClock = function (fn) { _nowSec = fn; };
  }
})();
