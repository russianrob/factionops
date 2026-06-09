// ==UserScript==
// @name         Torn Foreign Stocks
// @namespace    RussianRob
// @version      0.7.1
// @description  Abroad item stock, profit & restock estimates on the Torn travel page (mobile panels + desktop table). Inspired by TornTools.
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
  var SCRIPT_VERSION = "0.7.1";
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
  var ITEM_CATEGORY = {4:"Weapon",8:"Weapon",11:"Weapon",20:"Weapon",21:"Weapon",26:"Weapon",31:"Weapon",50:"Armor",63:"Weapon",99:"Weapon",108:"Weapon",110:"Weapon",111:"Weapon",175:"Weapon",177:"Weapon",178:"Armor",196:"Drug",197:"Drug",198:"Drug",199:"Drug",200:"Drug",201:"Drug",203:"Drug",204:"Drug",205:"Drug",206:"Drug",217:"Weapon",218:"Weapon",219:"Weapon",220:"Weapon",221:"Weapon",222:"Weapon",223:"Weapon",224:"Weapon",225:"Weapon",226:"Weapon",227:"Weapon",228:"Weapon",229:"Weapon",230:"Weapon",231:"Weapon",232:"Weapon",233:"Weapon",234:"Weapon",235:"Weapon",236:"Weapon",237:"Weapon",238:"Weapon",239:"Weapon",240:"Weapon",241:"Weapon",242:"Weapon",243:"Weapon",244:"Weapon",245:"Weapon",246:"Weapon",247:"Weapon",248:"Weapon",249:"Weapon",250:"Weapon",251:"Weapon",252:"Weapon",253:"Weapon",255:"Weapon",256:"Weapon",257:"Weapon",258:"Plushie",260:"Flower",261:"Plushie",263:"Flower",264:"Flower",266:"Plushie",267:"Flower",268:"Plushie",269:"Plushie",271:"Flower",272:"Flower",273:"Plushie",274:"Plushie",276:"Flower",277:"Flower",281:"Plushie",282:"Flower",332:"Armor",333:"Armor",334:"Armor",382:"Weapon",384:"Plushie",385:"Flower",387:"Weapon",388:"Weapon",391:"Weapon",395:"Weapon",397:"Weapon",398:"Weapon",399:"Weapon",400:"Weapon",402:"Weapon",435:"Flower",438:"Weapon",439:"Weapon",440:"Weapon",612:"Weapon",613:"Weapon",614:"Weapon",615:"Weapon",616:"Weapon",617:"Flower",618:"Plushie",640:"Armor",641:"Armor",645:"Armor",651:"Armor",652:"Armor",653:"Armor",654:"Armor"};
  function itemCategory(id) { return ITEM_CATEGORY[id] || "Other"; }
  function rowVisible(row, mode, filters) {
    if (filters.hideOos && row.qty === 0) return false;
    if (mode === "profit" && filters.hideNeg && row.profit != null && row.profit < 0) return false;
    if (filters.excludedCats && filters.excludedCats.indexOf(itemCategory(row.id)) !== -1) return false;
    return true;
  }
  function countryVisible(code, filters) {
    return !(filters.hiddenCountries && filters.hiddenCountries.indexOf(code) !== -1);
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
  function getFilters() {
    return {
      hideOos: gmGet("tfs_hide_oos", false),
      hideNeg: gmGet("tfs_hide_negprofit", false),
      excludedCats: gmGet("tfs_cats", []),
      hiddenCountries: gmGet("tfs_hidden_countries", [])
    };
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
      ".tfs-bar{display:flex;align-items:center;gap:6px;flex-wrap:wrap;padding:7px 10px;margin:8px 0;background:#16181d;border:1px solid #262a33;border-radius:7px;box-shadow:0 1px 3px rgba(0,0,0,.35);font-size:12px;color:#cfd4dc;}" +
      ".tfs-bar .tfs-title{font-weight:700;color:#e8c44a;letter-spacing:.3px;margin-right:4px;}" +
      ".tfs-seg{display:inline-flex;border:1px solid #2e333d;border-radius:7px;overflow:hidden;background:#14161b;}" +
      ".tfs-toggle{background:transparent;color:#8a909a;border:0;border-radius:0;padding:4px 16px;cursor:pointer;font-weight:600;transition:background .12s,color .12s;}" +
      ".tfs-toggle:hover{background:#20242c;color:#cfd4dc;}" +
      ".tfs-toggle.on{background:#3b6dff;color:#fff;}" +
      ".tfs-toggle+.tfs-toggle{border-left:1px solid #2e333d;}" +
      ".tfs-refresh,.tfs-save,.tfs-filterbtn{background:#20242c;color:#aeb4bd;border:1px solid #2e333d;border-radius:7px;padding:4px 10px;cursor:pointer;transition:background .12s,color .12s;}" +
      ".tfs-refresh{width:27px;height:26px;padding:0;border-radius:50%;font-size:13px;display:inline-flex;align-items:center;justify-content:center;}" +
      ".tfs-refresh:hover,.tfs-save:hover,.tfs-filterbtn:hover{background:#262b34;color:#e6e9ee;border-color:#3a4150;}" +
      ".tfs-key{background:#0e0f12;border:1px solid #2e333d;color:#dde2e8;border-radius:6px;padding:3px 8px;width:150px;}" +
      ".tfs-msg{color:#e08a7a;}" +
      ".tfs-filters{display:none;flex-basis:100%;margin-top:7px;padding-top:8px;border-top:1px solid #262a33;}" +
      ".tfs-filters.open{display:block;}" +
      ".tfs-frow{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin:5px 0;}" +
      ".tfs-frow.flags{flex-wrap:nowrap;gap:3px;}" +
      ".tfs-frow .lbl{color:#7a818c;margin-right:2px;min-width:54px;font-size:10px;text-transform:uppercase;letter-spacing:.5px;}" +
      ".tfs-ricon{margin-right:5px;font-size:11px;opacity:.95;}" +
      ".tfs-chip{cursor:pointer;font-size:11px;transition:all .12s;}" +
      ".tfs-chip.cat{display:inline-flex;align-items:center;gap:3px;background:#202a40;color:#aec4ff;border:1px solid #2c3650;border-radius:11px;padding:2px 10px;}" +
      ".tfs-chip.cat:hover{border-color:#3b6dff;}" +
      ".tfs-chip.cat.off{background:transparent;color:#5b626d;border-color:#2a2e38;}" +
      ".tfs-chip.cat.off .tfs-cicon{filter:grayscale(1);opacity:.55;}" +
      ".tfs-chip.flag{background:transparent;border:0;border-radius:5px;font-size:15px;line-height:1;padding:1px 2px;flex:0 0 auto;}" +
      ".tfs-chip.flag:hover{background:#20242c;}" +
      ".tfs-chip.flag.off{filter:grayscale(1);opacity:.3;}" +
      ".tfs-ftog{background:#1a1e26;color:#8a909a;border:1px solid #2e333d;border-radius:7px;padding:3px 11px;cursor:pointer;transition:all .12s;}" +
      ".tfs-ftog:hover{border-color:#3a4150;color:#cfd4dc;}" +
      ".tfs-ftog.on{background:#3b6dff;color:#fff;border-color:#3b6dff;}" +
      ".tfs-ftog.on::before{content:'✓ ';}" +
      ".tfs-panel{margin:5px 0 10px;font-size:12px;max-width:540px;}" +
      ".tfs-head{display:flex;align-items:center;padding:2px 6px 3px;}" +
      ".tfs-age{margin-left:auto;font-size:10px;color:#6f7681;background:#20242c;padding:1px 7px;border-radius:8px;white-space:nowrap;}" +
      ".tfs-age.stale{opacity:.5;}" +
      ".tfs-row,.tfs-tr{display:grid;grid-template-columns:minmax(0,1fr) 50px 96px;gap:8px;align-items:baseline;padding:2px 6px;border-radius:4px;}" +
      ".tfs-row.mp,.tfs-tr.mp{grid-template-columns:minmax(0,1fr) 46px 92px 112px;}" +
      ".tfs-row.out,.tfs-tr.out{grid-template-columns:minmax(0,1fr) auto;opacity:.72;}" +
      ".tfs-row:hover,.tfs-tr:hover{background:#20242c;}" +
      ".tfs-name,.tfs-tn{min-width:0;color:#cfd4dc;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}" +
      ".tfs-qty,.tfs-tq{color:#7a818c;text-align:right;font-variant-numeric:tabular-nums;}" +
      ".tfs-cost,.tfs-tcost{color:#aeb4bd;text-align:right;font-variant-numeric:tabular-nums;}" +
      ".tfs-profit,.tfs-tp{text-align:right;font-variant-numeric:tabular-nums;}" +
      ".tfs-profit.pos,.tfs-tp.pos{color:#51c97a;}.tfs-profit.neg,.tfs-tp.neg{color:#b06a5a;}" +
      ".tfs-oos,.tfs-toos{text-align:right;color:#d8a463;font-style:italic;white-space:nowrap;}" +
      "#tfs-desktop{margin:8px 0;}" +
      ".tfs-thost{background:#16181d;border:1px solid #262a33;border-radius:7px;box-shadow:0 1px 4px rgba(0,0,0,.4);overflow:hidden;font-size:12px;color:#cfd4dc;}" +
      ".tfs-thead{display:flex;align-items:center;justify-content:space-between;padding:8px 12px;background:#1c1f26;border-bottom:1px solid #262a33;}" +
      ".tfs-ttitle{font-weight:600;color:#8a909a;font-size:11px;text-transform:uppercase;letter-spacing:.6px;}" +
      ".tfs-bar .tfs-ico{font-size:13px;}" +
      ".tfs-tcollapse{background:none;border:0;color:#8a909a;cursor:pointer;font-size:13px;line-height:1;}" +
      ".tfs-tbody{padding:6px 12px 10px;max-height:64vh;overflow-y:auto;}" +
      ".tfs-tbody::-webkit-scrollbar{width:9px;}.tfs-tbody::-webkit-scrollbar-thumb{background:#2e333d;border-radius:5px;}" +
      ".tfs-tc{margin:0 0 12px;max-width:540px;}" +
      ".tfs-tch{display:flex;align-items:center;gap:7px;font-weight:600;color:#e6e9ee;padding:5px 6px 4px;border-bottom:1px solid #262a33;margin-bottom:3px;position:sticky;top:-1px;background:#16181d;}" +
      ".tfs-flag{font-size:14px;}" +
      ".tfs-tempty{color:#7a818c;padding:6px 6px;}";
    document.head.appendChild(s);
  }

  var TFS_CATS = ["Plushie", "Flower", "Drug", "Temporary", "Weapon", "Armor", "Other"];
  var TFS_COUNTRIES = [["mex", "Mexico"], ["cay", "Cayman"], ["can", "Canada"], ["haw", "Hawaii"], ["uni", "UK"], ["arg", "Argentina"], ["swi", "Switz"], ["jap", "Japan"], ["chi", "China"], ["uae", "UAE"], ["sou", "S.Africa"]];
  var TFS_FLAGS = { mex: "🇲🇽", cay: "🇰🇾", can: "🇨🇦", haw: "🏝", uni: "🇬🇧", arg: "🇦🇷", swi: "🇨🇭", jap: "🇯🇵", chi: "🇨🇳", uae: "🇦🇪", sou: "🇿🇦" };
  function tfsFlag(code) { return TFS_FLAGS[code] || "🏳"; }
  var TFS_CATICON = { Plushie: "🧸", Flower: "🌸", Drug: "💊", Temporary: "⏳", Weapon: "⚔️", Armor: "🛡️", Other: "📦" };
  function tfsRowIcon(id) { var ic = TFS_CATICON[itemCategory(id)]; return ic ? ('<span class="tfs-ricon">' + ic + '</span>') : ''; }

  function buildFilterPanel(onChange) {
    var f = getFilters();
    var panel = document.createElement("div");
    panel.className = "tfs-filters";
    panel.id = "tfs-filters";
    var html = '<div class="tfs-frow">' +
      '<button class="tfs-ftog' + (f.hideOos ? " on" : "") + '" data-t="oos">Hide out-of-stock</button>' +
      '<button class="tfs-ftog' + (f.hideNeg ? " on" : "") + '" data-t="neg">Hide -profit</button>' +
      '</div><div class="tfs-frow"><span class="lbl">Items</span>';
    for (var i = 0; i < TFS_CATS.length; i++) html += '<span class="tfs-chip cat' + (f.excludedCats.indexOf(TFS_CATS[i]) !== -1 ? " off" : "") + '" data-cat="' + TFS_CATS[i] + '" title="' + TFS_CATS[i] + '"><span class="tfs-cicon">' + (TFS_CATICON[TFS_CATS[i]] || "") + '</span>' + TFS_CATS[i] + '</span>';
    html += '</div><div class="tfs-frow flags"><span class="lbl">Countries</span>';
    for (var k = 0; k < TFS_COUNTRIES.length; k++) html += '<span class="tfs-chip ctry flag' + (f.hiddenCountries.indexOf(TFS_COUNTRIES[k][0]) !== -1 ? " off" : "") + '" data-code="' + TFS_COUNTRIES[k][0] + '" title="' + TFS_COUNTRIES[k][1] + '">' + tfsFlag(TFS_COUNTRIES[k][0]) + '</span>';
    html += '</div>';
    panel.innerHTML = html;
    var togs = panel.querySelectorAll(".tfs-ftog");
    for (var t = 0; t < togs.length; t++) {
      (function (b) {
        b.addEventListener("click", function () {
          var which = b.getAttribute("data-t");
          if (which === "oos") gmSet("tfs_hide_oos", !gmGet("tfs_hide_oos", false));
          else gmSet("tfs_hide_negprofit", !gmGet("tfs_hide_negprofit", false));
          b.classList.toggle("on"); onChange(false);
        });
      })(togs[t]);
    }
    var catChips = panel.querySelectorAll(".tfs-chip.cat");
    for (var ci = 0; ci < catChips.length; ci++) {
      (function (c) {
        c.addEventListener("click", function () {
          var cat = c.getAttribute("data-cat");
          var ex = gmGet("tfs_cats", []); var idx = ex.indexOf(cat);
          if (idx === -1) { ex.push(cat); c.classList.add("off"); } else { ex.splice(idx, 1); c.classList.remove("off"); }
          gmSet("tfs_cats", ex); onChange(false);
        });
      })(catChips[ci]);
    }
    var ctryChips = panel.querySelectorAll(".tfs-chip.ctry");
    for (var di = 0; di < ctryChips.length; di++) {
      (function (c) {
        c.addEventListener("click", function () {
          var code = c.getAttribute("data-code");
          var hc = gmGet("tfs_hidden_countries", []); var idx = hc.indexOf(code);
          if (idx === -1) { hc.push(code); c.classList.add("off"); } else { hc.splice(idx, 1); c.classList.remove("off"); }
          gmSet("tfs_hidden_countries", hc); onChange(false);
        });
      })(ctryChips[di]);
    }
    return panel;
  }

  function isMapLayout() {
    return !!document.querySelector('[class*="worldMap___"]') && !document.querySelector('span[class*="country___"]');
  }
  function desktopHost() {
    var h = document.getElementById("tfs-desktop");
    if (h) return h;
    h = document.createElement("div");
    h.id = "tfs-desktop";
    var map = document.querySelector('[class*="worldMap___"]');
    var cont = (map && (map.closest('[class*="content-wrapper"]') || map.parentElement)) ||
      document.querySelector('[class*="content-wrapper"]') || document.querySelector(".content") || document.body;
    cont.appendChild(h);
    return h;
  }
  function ensureTablePanel() {
    var panel = document.getElementById("tfs-table-host");
    if (panel) return panel;
    panel = document.createElement("div");
    panel.id = "tfs-table-host";
    panel.className = "tfs-thost";
    panel.innerHTML = '<div class="tfs-thead"><span class="tfs-ttitle">Stock by country</span><button class="tfs-tcollapse" title="Collapse">▾</button></div><div class="tfs-tbody"></div>';
    panel.querySelector(".tfs-tcollapse").addEventListener("click", function () {
      var b = panel.querySelector(".tfs-tbody"), btn = panel.querySelector(".tfs-tcollapse");
      var show = (b.style.display === "none");
      b.style.display = show ? "" : "none"; btn.textContent = show ? "▾" : "▸";
    });
    desktopHost().appendChild(panel);
    return panel;
  }
  function paintTable(stock, mode, prices, model) {
    var filters = getFilters();
    var panel = ensureTablePanel();
    var body = panel.querySelector(".tfs-tbody");
    var nowMs = Date.now();
    var html = "";
    for (var ci = 0; ci < TFS_COUNTRIES.length; ci++) {
      var code = TFS_COUNTRIES[ci][0], cname = TFS_COUNTRIES[ci][1];
      if (!countryVisible(code, filters)) continue;
      var country = stock[code];
      if (!country) continue;
      var rows = sortRows(buildRows(country.items, { mode: mode, getValue: function (id) { return prices[id]; } }), mode, nowMs);
      rows = rows.filter(function (r) { return rowVisible(r, mode, filters); });
      if (!rows.length) continue;
      var age = formatAge(country.update, Math.floor(nowMs / 1000));
      html += '<div class="tfs-tc"><div class="tfs-tch"><span class="tfs-flag">' + tfsFlag(code) + '</span><span class="tfs-cn">' + cname + '</span><span class="tfs-age' + (age.stale ? " stale" : "") + '">updated ' + age.text + '</span></div>';
      for (var i = 0; i < rows.length; i++) {
        var r = rows[i];
        if (r.qty === 0) {
          var entry = (model && model[code]) ? model[code][String(r.id)] : null;
          html += '<div class="tfs-tr out"><span class="tfs-tn">' + tfsRowIcon(r.id) + escapeHtml(r.name) + '</span><span class="tfs-toos">' + restockDisplay(r.nextRestock, entry, nowMs) + '</span></div>';
        } else {
          html += '<div class="tfs-tr' + (mode === "profit" ? " mp" : "") + '"><span class="tfs-tn">' + tfsRowIcon(r.id) + escapeHtml(r.name) + '</span><span class="tfs-tq">×' + r.qty + '</span><span class="tfs-tcost">' + fmtMoney(r.cost) + '</span>' +
            (mode === "profit" ? '<span class="tfs-tp ' + (r.profit != null && r.profit > 0 ? "pos" : "neg") + '">' + fmtProfit(r.profit) + ' ea</span>' : '') + '</div>';
        }
      }
      html += '</div>';
    }
    body.innerHTML = html || '<div class="tfs-tempty">No items match your filters.</div>';
  }

  function injectSettingsBar(onChange) {
    if (document.getElementById("tfs-bar")) return;
    var bar = document.createElement("div");
    bar.id = "tfs-bar"; bar.className = "tfs-bar";
    var mode = getMode();
    bar.innerHTML =
      '<span class="tfs-title"><span class="tfs-ico">✈</span> Foreign Stocks</span>' +
      '<span class="tfs-seg"><button class="tfs-toggle" data-mode="stock">Stock</button><button class="tfs-toggle" data-mode="profit">Profit</button></span>' +
      '<button class="tfs-refresh" title="Refresh stock">↻</button>' +
      '<button class="tfs-filterbtn">Filters ▾</button>' +
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
    var fpanel = buildFilterPanel(onChange);
    bar.appendChild(fpanel);
    bar.querySelector(".tfs-filterbtn").addEventListener("click", function () { fpanel.classList.toggle("open"); });
    var anchor = document.querySelector('[class*="destinationList___"]');
    if (anchor && anchor.parentNode) { anchor.parentNode.insertBefore(bar, anchor); }
    else if (isMapLayout()) { var dh = desktopHost(); dh.insertBefore(bar, dh.firstChild); }
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

  function renderPanel(destEl, code, stock, mode, prices, model, filters) {
    if (!filters) filters = {};
    var country = stock[code];
    if (!country) return;
    var rows = sortRows(buildRows(country.items, { mode: mode, getValue: function (id) { return prices[id]; } }), mode);
    rows = rows.filter(function (r) { return rowVisible(r, mode, filters); });
    if (!rows.length) { var gone = destEl.querySelector(".tfs-panel"); if (gone) gone.parentNode.removeChild(gone); return; }
    var age = formatAge(country.update, Math.floor(Date.now() / 1000));
    var html = '<div class="tfs-head"><span class="tfs-age' + (age.stale ? " stale" : "") + '">updated ' + age.text + '</span></div><div class="tfs-rows">';
    var nowMs = Date.now();
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      if (r.qty === 0) {
        var entry = (model && model[code]) ? model[code][String(r.id)] : null;
        html += '<div class="tfs-row out"><span class="tfs-name">' + tfsRowIcon(r.id) + escapeHtml(r.name) + '</span>' +
          '<span class="tfs-oos">' + restockDisplay(r.nextRestock, entry, nowMs) + '</span></div>';
      } else {
        html += '<div class="tfs-row' + (mode === "profit" ? " mp" : "") + '"><span class="tfs-name">' + tfsRowIcon(r.id) + escapeHtml(r.name) + '</span><span class="tfs-qty">×' + r.qty + '</span><span class="tfs-cost">' + fmtMoney(r.cost) + '</span>' +
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
    var filters = getFilters();
    var dests = findDestinations();
    for (var i = 0; i < dests.length; i++) {
      if (!countryVisible(dests[i].code, filters)) {
        var hidden = dests[i].el.querySelector(".tfs-panel");
        if (hidden) hidden.parentNode.removeChild(hidden);
        continue;
      }
      renderPanel(dests[i].el, dests[i].code, stock, mode, prices, model || {}, filters);
    }
  }
  function applyAll(force) {
    var mode = getMode(), key = getKey();
    Promise.all([getStock(force), getModel()]).then(function (res) {
      var stock = res[0], model = res[1] || {};
      if (!stock) { tfsMsg("stock unavailable"); return; }
      function render(prices, m) {
        if (isMapLayout()) paintTable(stock, m, prices, model);
        else paintPanels(stock, m, prices, model);
      }
      if (mode === "profit" && key) {
        return getPrices(key).then(function (mp) { tfsMsg(""); render(mp, "profit"); })
          .catch(function () { tfsMsg("key error"); render({}, "stock"); });
      }
      if (mode === "profit" && !key) tfsMsg("add a key for profit");
      render({}, "stock");
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
      fmtDuration: fmtDuration, modelEstimate: modelEstimate, restockDisplay: restockDisplay,
      itemCategory: itemCategory, rowVisible: rowVisible, countryVisible: countryVisible
    };
    module.exports.getStock = getStock;
    module.exports.getPrices = getPrices;
    module.exports.getModel = getModel;
    module.exports.__setFetch = function (fn) { _fetchJson = fn; };
    module.exports.__setClock = function (fn) { _nowSec = fn; };
  }
})();
