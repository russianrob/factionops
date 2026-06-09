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
  function fmtMoney(n) {
    if (n == null || isNaN(n)) return "—";
    return "$" + Math.round(n).toLocaleString("en-US");
  }
  function fmtProfit(n) {
    if (n == null || isNaN(n)) return "—";
    return (n < 0 ? "-$" : "+$") + Math.round(Math.abs(n)).toLocaleString("en-US");
  }
  function formatAge(updateSec, nowSecVal) {
    var diff = Math.max(0, Math.floor(nowSecVal - updateSec));
    var mins = Math.floor(diff / 60), text;
    if (diff < 60) text = "just now";
    else if (mins < 60) text = mins + "m ago";
    else text = Math.floor(mins / 60) + "h " + (mins % 60) + "m ago";
    return { text: text, stale: mins >= STALE_MIN };
  }

  // ─── GM / data layer ─────────────────────────────────────

  // ─── DOM: settings, injector, observer ───────────────────

  function main() {}

  if (typeof window !== "undefined" && typeof location !== "undefined" && /\/page\.php/.test(location.pathname) && /sid=travel/.test(location.search + location.hash)) {
    main();
  }
  if (typeof module !== "undefined" && module.exports) {
    module.exports = {
      normalizeCountryName: normalizeCountryName, COUNTRY_MAP: COUNTRY_MAP,
      parseYataExport: parseYataExport, fmtMoney: fmtMoney, fmtProfit: fmtProfit, formatAge: formatAge
    };
  }
})();
