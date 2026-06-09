// ==UserScript==
// @name         Foreign Stock
// @namespace    RussianRob
// @version      0.1.0
// @description  Shows abroad item stock (and optional profit) inline on the Torn travel agency page
// @author       RussianRob
// @license      GPL-3.0-or-later
// @match        https://www.torn.com/travelagency.php*
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

  // ─── GM / data layer ─────────────────────────────────────

  // ─── DOM: settings, injector, observer ───────────────────

  function main() {}

  if (typeof window !== "undefined" && typeof location !== "undefined" && /\/travelagency\.php/.test(location.pathname)) {
    main();
  }
  if (typeof module !== "undefined" && module.exports) {
    module.exports = { normalizeCountryName: normalizeCountryName, COUNTRY_MAP: COUNTRY_MAP };
  }
})();
