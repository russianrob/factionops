// ==UserScript==
// @name         Torn Junk Finder
// @namespace    RussianRob
// @version      1.0.6
// @description  Flags unnecessary inventory items — low value, redundant gear you already out-class, and a curated junk list — highlights them and groups them in one panel. Loads your whole inventory keyless with no scrolling.
// @author       RussianRob
// @license      GPL-3.0-or-later
// @match        https://www.torn.com/item.php*
// @run-at       document-idle
// @grant        unsafeWindow
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @connect      tornwar.com
// @downloadURL  https://tornwar.com/scripts/torn-junk-finder.user.js
// @updateURL    https://tornwar.com/scripts/torn-junk-finder.meta.js
// ==/UserScript==
(function () {
  "use strict";
  var SCRIPT_VERSION = "1.0.6";
  var CATALOG_URL = "https://tornwar.com/api/items/catalog";
  var CATALOG_TTL = 30 * 60 * 1000;
  var PAGE = (typeof unsafeWindow !== "undefined") ? unsafeWindow : window;

  function gmGet(k, d) { try { var v = GM_getValue(k, null); return v == null ? d : JSON.parse(v); } catch (e) { return d; } }
  function gmSet(k, v) { try { GM_setValue(k, JSON.stringify(v)); } catch (e) {} }
  function cfg() {
    return {
      threshold: Number(gmGet("jf_threshold", 10000)) || 10000,
      lowValue: gmGet("jf_lowvalue", true) !== false,
      redundant: gmGet("jf_redundant", true) !== false,
      junk: gmGet("jf_junk", true) !== false,
      junkList: gmGet("jf_junklist", [])
    };
  }
  function fmtMoney(n) { return "$" + Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ","); }

  var _catalog = null;
  function getCatalog(cb) {
    if (_catalog) { cb(_catalog); return; }
    var cached = gmGet("jf_catalog", null);
    if (cached && cached.items && (Date.now() - cached.t) < CATALOG_TTL) { _catalog = cached.items; cb(_catalog); return; }
    GM_xmlhttpRequest({
      method: "GET", url: CATALOG_URL, timeout: 15000,
      onload: function (r) {
        try {
          var j = JSON.parse(r.responseText);
          if (j && j.items) { _catalog = j.items; gmSet("jf_catalog", { t: Date.now(), items: j.items }); cb(_catalog); return; }
        } catch (e) {}
        cb(cached ? cached.items : null);
      },
      onerror: function () { cb(cached ? cached.items : null); },
      ontimeout: function () { cb(cached ? cached.items : null); }
    });
  }

  function harvest(html, byId) {
    var tmp = document.createElement("ul");
    try { tmp.innerHTML = html || ""; } catch (e) { return; }
    var lis = tmp.querySelectorAll("li[data-item]");
    for (var i = 0; i < lis.length; i++) {
      var li = lis[i], id = li.getAttribute("data-item");
      if (id == null || byId[id]) continue;
      byId[id] = {
        id: String(id),
        qty: Number(li.getAttribute("data-qty")) || 1,
        name: li.getAttribute("data-sort") || "",
        category: li.getAttribute("data-category") || "",
        equipped: li.getAttribute("data-equipped") === "true"
      };
    }
  }
  function fetchFullInventory(cb) {
    var ga = PAGE && PAGE.getAction;
    if (typeof ga !== "function") { cb(null); return; }
    var ul = document.querySelector("#all-items");
    var byId = {}, pages = 0, finished = false;
    function done() { if (finished) return; finished = true; var a = Object.keys(byId).map(function (id) { return byId[id]; }); cb(a.length ? a : null); }
    setTimeout(done, 15000);
    function pageReq(start, queue) {
      pages++;
      ga({
        type: "post", action: "item.php", dataType: "json",
        data: { step: "getNotAllItemsListWithoutGroups", start: start, queue: queue },
        success: function (str) {
          if (finished) return;
          var json; try { json = (typeof str === "string") ? JSON.parse(str) : str; } catch (e) { done(); return; }
          harvest(json && json.html, byId);
          var ns = json && json.start;
          if (json && json.count && pages < 20 && ns != null && Number(ns) > Number(start)) pageReq(ns, json.queue);
          else done();
        },
        error: function () { done(); }
      });
    }
    pageReq(0, (ul && ul.getAttribute("data-queue")) || "All");
  }

  function readInventory() {
    var out = [], seen = [], byId = {};
    var imgs = document.querySelectorAll('img[src*="/images/items/"]');
    for (var i = 0; i < imgs.length; i++) {
      var img = imgs[i];
      var m = String(img.getAttribute("src") || "").match(/\/images\/items\/(\d+)\b/);
      if (!m) continue;
      if (img.closest && img.closest('[class*="equippedItems"], [class*="itemReview"], [class*="loadout" i]')) continue;
      var id = m[1];
      var li = (img.closest && (img.closest("li") || img.closest('[class*="item"]'))) || img.parentElement;
      if (!li || seen.indexOf(li) !== -1) continue;
      seen.push(li);
      if (byId[id]) continue;
      byId[id] = 1;
      out.push({
        id: id, li: li, img: img,
        name: String(img.getAttribute("alt") || "").trim(),
        qty: readQty(li),
        equipped: /\bequipped\b/i.test(li.textContent || "") || !!(li.querySelector && li.querySelector('[class*="equipped" i]'))
      });
    }
    return out;
  }
  function readQty(li) {
    var q = li.querySelector && li.querySelector('[class*="qty" i], [class*="quantity" i], [class*="amount" i]');
    if (q) { var d = String(q.textContent || "").replace(/[^\d]/g, ""); if (d) return Number(d); }
    var mm = String(li.textContent || "").match(/(?:^|\D)x\s?(\d{1,7})\b/i);
    return mm ? Number(mm[1]) : 1;
  }

  function classify(items, catalog, c) {
    var bestBySub = {};
    if (c.redundant) {
      for (var i = 0; i < items.length; i++) {
        var meta = catalog[items[i].id]; if (!meta || !meta.st) continue;
        if (meta.t !== "Weapon" && meta.t !== "Armor") continue;
        var key = meta.t + ":" + meta.st;
        if (!bestBySub[key] || meta.v > bestBySub[key]) bestBySub[key] = meta.v;
      }
    }
    var junkSet = {};
    (c.junkList || []).forEach(function (s) { junkSet[String(s).toLowerCase()] = 1; });

    for (var k = 0; k < items.length; k++) {
      var it = items[k], m2 = catalog[it.id] || { t: "", st: "", v: 0 };
      it.value = Number(m2.v) || 0; it.type = m2.t || ""; it.sub = m2.st || "";
      if (it.equipped) { it.reasons = []; continue; }
      var reasons = [];
      if (c.lowValue && it.value > 0 && it.value < c.threshold) reasons.push("low");
      if (c.junk && (junkSet[(it.name || "").toLowerCase()] || junkSet[it.type.toLowerCase()] || junkSet[it.sub.toLowerCase()])) reasons.push("junk");
      if (c.redundant && m2.st && (m2.t === "Weapon" || m2.t === "Armor")) {
        var best = bestBySub[m2.t + ":" + m2.st] || 0;
        if (best >= it.value * 2 && it.value > 0) reasons.push("redundant");
      }
      it.reasons = reasons;
    }
    return items;
  }

  var BADGE = { low: "💸", junk: "🗑️", redundant: "🔁" };
  var LABEL = { low: "low value", junk: "junk", redundant: "redundant — you own better" };

  function hiOn(el, reasons) {
    var key = reasons.join(",");
    if (el.getAttribute("data-jf") === key) return;
    el.setAttribute("data-jf", key);
    el.style.setProperty("outline", "2px solid #c0392b", "important");
    el.style.setProperty("outline-offset", "-2px");
    el.style.setProperty("border-radius", "6px");
    el.style.setProperty("background", "rgba(192,57,43,0.10)", "important");
    var b = el.querySelector(".jf-badge");
    if (!b) { b = document.createElement("span"); b.className = "jf-badge"; el.appendChild(b); }
    b.style.cssText = "position:absolute;top:1px;right:1px;z-index:5;font-size:11px;background:#c0392b;color:#fff;border-radius:8px;padding:0 5px;line-height:16px;pointer-events:none;";
    b.textContent = reasons.map(function (r) { return BADGE[r]; }).join("");
    b.title = reasons.map(function (r) { return LABEL[r]; }).join(" · ");
    if (getComputedStyle(el).position === "static") el.style.position = "relative";
  }
  function hiOff(el) {
    if (!el.getAttribute("data-jf")) return;
    el.removeAttribute("data-jf");
    ["outline", "outline-offset", "background"].forEach(function (p) { el.style.removeProperty(p); });
    var ob = el.querySelector(".jf-badge"); if (ob) ob.remove();
  }
  function paintVisibleDom(flaggedById) {
    var lis = document.querySelectorAll("li[data-item]");
    for (var i = 0; i < lis.length; i++) {
      var li = lis[i], id = li.getAttribute("data-item");
      var f = id != null && flaggedById[id];
      if (f) hiOn(li, f.reasons); else hiOff(li);
    }
  }

  var _flagged = {};
  function savePersist() {
    var arr = Object.keys(_flagged).map(function (id) { var f = _flagged[id]; return { id: f.id, name: f.name, value: f.value, qty: f.qty, reasons: f.reasons }; });
    gmSet("jf_persist", { t: Date.now(), items: arr });
  }
  function restorePersist() {
    var p = gmGet("jf_persist", null);
    if (!p || !Array.isArray(p.items)) return;
    p.items.forEach(function (f) { if (f && f.id != null && f.reasons && f.reasons.length) _flagged[String(f.id)] = f; });
  }
  function clearPersist() {
    _flagged = {};
    gmSet("jf_persist", { t: Date.now(), items: [] });
    var panel = document.getElementById("jf-panel"); if (panel) panel.remove();
  }
  function paint(items) {
    for (var i = 0; i < items.length; i++) {
      var it = items[i], li = it.li;
      if (it.reasons.length) { hiOn(li, it.reasons); _flagged[it.id] = it; }
      else { hiOff(li); delete _flagged[it.id]; }
    }
    renderPanel(Object.keys(_flagged).map(function (id) { return _flagged[id]; }));
    savePersist();
  }

  function panelHost() {
    return document.querySelector('[class*="items-wrap"], [class*="itemsWrapper"], #item-list, .content-wrapper') || document.body;
  }
  var _viaEndpoint = false;
  function renderPanel(flagged) {
    var host = panelHost();
    var panel = document.getElementById("jf-panel");
    if (!flagged.length) { if (panel) panel.remove(); return; }
    if (!panel) {
      panel = document.createElement("div");
      panel.id = "jf-panel";
      panel.style.cssText = "margin:8px 0;background:#16181d;border:1px solid #c0392b;border-radius:8px;color:#cfd4dc;font-size:13px;overflow:hidden;";
      host.insertBefore(panel, host.firstChild);
    }
    var total = 0; flagged.forEach(function (f) { total += f.value * (f.qty || 1); });
    var collapsed = gmGet("jf_collapsed", false);
    var rows = flagged.slice().sort(function (a, b) { return a.value - b.value; }).map(function (f) {
      return '<div style="display:flex;gap:8px;align-items:center;padding:3px 12px;">' +
        '<span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' +
        f.reasons.map(function (r) { return BADGE[r]; }).join("") + " " + esc(f.name || ("Item " + f.id)) +
        (f.qty > 1 ? ' <span style="color:#7a818c">×' + f.qty + "</span>" : "") + "</span>" +
        '<span style="color:#aeb4bd;font-variant-numeric:tabular-nums;">' + fmtMoney(f.value) + "</span></div>";
    }).join("");
    var note = _viaEndpoint
      ? "✓ full inventory loaded — no scrolling needed. Tap ↻ to refresh after you dump items."
      : "↓ scroll once to catch everything — your list is saved across refreshes. Tap ↻ to rescan after you dump items.";
    panel.innerHTML =
      '<div id="jf-head" style="display:flex;gap:8px;align-items:center;padding:8px 12px;background:#1c1f26;cursor:pointer;font-weight:600;">' +
      '<span>🗑️ Useless Items</span><span style="background:#c0392b;color:#fff;border-radius:9px;padding:0 7px;font-size:11px;">' + flagged.length + "</span>" +
      '<span style="margin-left:auto;color:#8a909a;font-weight:400;">~' + fmtMoney(total) + ' to dump</span>' +
      '<span id="jf-clear" title="Refresh inventory" style="cursor:pointer;color:#8a909a;padding:0 5px;">↻</span>' +
      '<span style="color:#8a909a;">' + (collapsed ? "▸" : "▾") + "</span></div>" +
      '<div id="jf-body" style="display:' + (collapsed ? "none" : "block") + ';padding:4px 0 8px;max-height:50vh;overflow:auto;">' + rows +
      '<div style="padding:5px 12px 0;color:#7a818c;font-size:11px;border-top:1px solid #262a33;margin-top:4px;">' + note + "</div></div>";
    panel.querySelector("#jf-head").addEventListener("click", function () {
      var col = !gmGet("jf_collapsed", false); gmSet("jf_collapsed", col);
      panel.querySelector("#jf-body").style.display = col ? "none" : "block";
    });
    var _cl = panel.querySelector("#jf-clear");
    if (_cl) _cl.addEventListener("click", function (e) { e.stopPropagation(); refresh(); });
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]; }); }

  var _full = null, _flaggedById = {}, _fetching = false, _endpointGaveUp = false, _gaRetries = 0, _pending = null;
  function renderFull() {
    var flaggedArr = [];
    _flaggedById = {};
    for (var i = 0; i < _full.length; i++) { var it = _full[i]; if (it.reasons && it.reasons.length) { flaggedArr.push(it); _flaggedById[it.id] = it; } }
    renderPanel(flaggedArr);
    paintVisibleDom(_flaggedById);
  }
  function run() {
    getCatalog(function (catalog) {
      if (!catalog) return;
      if (_full) { paintVisibleDom(_flaggedById); return; }
      if (_endpointGaveUp) { paint(classify(readInventory(), catalog, cfg())); return; }
      if (_fetching) return;
      if (typeof (PAGE && PAGE.getAction) !== "function") {
        if (_gaRetries++ < 5) { setTimeout(run, 1200); return; }
        _endpointGaveUp = true; paint(classify(readInventory(), catalog, cfg())); return;
      }
      _fetching = true;
      fetchFullInventory(function (items) {
        _fetching = false;
        if (items && items.length) { _viaEndpoint = true; _full = classify(items, catalog, cfg()); renderFull(); }
        else { _endpointGaveUp = true; paint(classify(readInventory(), catalog, cfg())); }
      });
    });
  }
  function schedule() { if (_pending) return; _pending = setTimeout(function () { _pending = null; run(); }, 300); }
  function refresh() {
    _full = null; _flaggedById = {}; _fetching = false; _endpointGaveUp = false; _gaRetries = 0; _viaEndpoint = false;
    clearPersist(); run();
  }

  restorePersist();
  renderPanel(Object.keys(_flagged).map(function (id) { return _flagged[id]; }));
  run();
  new MutationObserver(function (muts) {
    for (var i = 0; i < muts.length; i++) {
      var t = muts[i].target;
      if (t && t.id !== "jf-panel" && !(t.closest && t.closest("#jf-panel"))) { schedule(); return; }
    }
  }).observe(document.body, { childList: true, subtree: true });

  try {
    GM_registerMenuCommand("Junk Finder: set value threshold ($)", function () {
      var v = prompt("Flag items worth LESS than this ($):", cfg().threshold);
      if (v != null && !isNaN(Number(v))) { gmSet("jf_threshold", Number(v)); refresh(); }
    });
    GM_registerMenuCommand("Junk Finder: edit junk list (comma-separated names/types)", function () {
      var cur = (cfg().junkList || []).join(", ");
      var v = prompt("Always-useless item names or types (comma-separated):", cur);
      if (v != null) { gmSet("jf_junklist", v.split(",").map(function (s) { return s.trim(); }).filter(Boolean)); refresh(); }
    });
    GM_registerMenuCommand("Junk Finder: refresh inventory", function () { refresh(); });
  } catch (e) {}
})();
