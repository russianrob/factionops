// ==UserScript==
// @name         Torn Inventory Probe (temporary)
// @namespace    RussianRob
// @version      0.2.0
// @description  TEMPORARY diagnostic — hunts where item.php keeps the full inventory (React fiber / globals / inline hydration) so Junk Finder can read it keyless with zero scroll. Remove after one run.
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

  var ID_KEYS = ["id", "ID", "itemID", "item_id", "itemId", "armoryID"];
  var ITEM_KEYS = ["name", "quantity", "amount", "qty", "market_price", "market_value", "type", "sub_type", "subType", "equipped", "uid"];
  function firstId(o) { for (var i = 0; i < ID_KEYS.length; i++) if (o && o[ID_KEYS[i]] != null) return o[ID_KEYS[i]]; return null; }
  function looksLikeItem(o) {
    if (!o || typeof o !== "object") return false;
    if (firstId(o) == null) return false;
    for (var i = 0; i < ITEM_KEYS.length; i++) if (o[ITEM_KEYS[i]] != null) return true;
    return false;
  }
  function summarize(arr) {
    var ids = [];
    for (var i = 0; i < arr.length && i < 6; i++) ids.push(firstId(arr[i]));
    return { count: arr.length, keys: Object.keys(arr[0]).slice(0, 14), ids: ids, kind: "array" };
  }
  function summarizeMap(v, ks) {
    var ids = [];
    for (var i = 0; i < ks.length && i < 6; i++) ids.push(firstId(v[ks[i]]));
    return { count: ks.length, keys: Object.keys(v[ks[0]]).slice(0, 14), ids: ids, kind: "map" };
  }
  function shallowItemArray(v, depth) {
    if (!v || typeof v !== "object") return null;
    if (Array.isArray(v)) {
      if (v.length > 20 && looksLikeItem(v[0])) return summarize(v);
      if (depth < 3) for (var a = 0; a < v.length && a < 30; a++) { var r0 = shallowItemArray(v[a], depth + 1); if (r0) return r0; }
      return null;
    }
    var ks; try { ks = Object.keys(v); } catch (e) { return null; }
    if (ks.length > 20) { try { if (looksLikeItem(v[ks[0]])) return summarizeMap(v, ks); } catch (e) {} }
    if (depth < 3) for (var i = 0; i < ks.length && i < 40; i++) { try { var r = shallowItemArray(v[ks[i]], depth + 1); if (r) return r; } catch (e) {} }
    return null;
  }

  function scanGlobals() {
    var hits = [], keys;
    try { keys = Object.keys(W); } catch (e) { keys = []; }
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i], v;
      if (/^(webkit|chrome|external|document|location|navigator|history|frames|top|parent|self|window)$/.test(k)) continue;
      try { v = W[k]; } catch (e) { continue; }
      if (!v || typeof v !== "object") continue;
      var info; try { info = shallowItemArray(v, 0); } catch (e) { info = null; }
      if (info && info.count > 50) hits.push({ key: k.slice(0, 40), count: info.count, kind: info.kind, sampleKeys: info.keys, ids: info.ids });
      if (hits.length >= 6) break;
    }
    return hits;
  }

  function reactInventory() {
    var img = document.querySelector('img[src*="/images/items/"]');
    if (!img) return { note: "no item img yet" };
    var node = (img.closest && (img.closest('li') || img.closest('[class*="item"]'))) || img.parentElement;
    var fk = null, kk = Object.keys(node || {});
    for (var i = 0; i < kk.length; i++) if (kk[i].indexOf("__reactFiber$") === 0 || kk[i].indexOf("__reactInternalInstance$") === 0) { fk = kk[i]; break; }
    if (!fk) return { note: "no react fiber key on item node", nodeKeys: kk.slice(0, 6) };
    var fiber = node[fk], hops = 0, best = null, bestHop = -1;
    while (fiber && hops < 80) {
      var slots = [fiber.memoizedProps, fiber.memoizedState];
      for (var s = 0; s < slots.length; s++) {
        var info; try { info = shallowItemArray(slots[s], 0); } catch (e) { info = null; }
        if (info && (!best || info.count > best.count)) { best = info; bestHop = hops; }
      }
      fiber = fiber.return; hops++;
    }
    if (best) return { count: best.count, kind: best.kind, sampleKeys: best.keys, ids: best.ids, hop: bestHop, hops: hops };
    return { note: "no item array in fiber props/state", hops: hops };
  }

  function scanInlineScripts() {
    var out = [], scripts;
    try { scripts = document.querySelectorAll("script:not([src])"); } catch (e) { return out; }
    var markers = ["armoryID", "market_price", "\"itemID\"", "\"inventory\"", "itemMarket", "\"items\":", "__INITIAL", "preloaded", "hydrat"];
    for (var i = 0; i < scripts.length; i++) {
      var txt = scripts[i].textContent || "";
      if (txt.length < 400) continue;
      var found = [];
      for (var m = 0; m < markers.length; m++) if (txt.indexOf(markers[m]) >= 0) found.push(markers[m]);
      if (found.length) out.push({ len: txt.length, markers: found });
      if (out.length >= 6) break;
    }
    return out;
  }

  function domItemImgs() { try { return document.querySelectorAll('img[src*="/images/items/"]').length; } catch (e) { return -1; } }

  function hunt(phase) {
    post("jfp-react", { phase: phase, t: Date.now() - T0, domImgs: domItemImgs(), react: reactInventory() });
    post("jfp-globals", { phase: phase, globals: scanGlobals() });
    post("jfp-scripts", { phase: phase, scripts: scanInlineScripts() });
  }

  post("jfp2-start", { hasUnsafe: (typeof unsafeWindow !== "undefined") });
  setTimeout(function () { hunt("t6"); }, 6000);
  setTimeout(function () { hunt("t12"); }, 12000);
})();
