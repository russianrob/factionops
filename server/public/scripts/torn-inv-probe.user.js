// ==UserScript==
// @name         Torn Inventory Probe (temporary)
// @namespace    RussianRob
// @version      0.3.0
// @description  TEMPORARY diagnostic — starts at the inventory grid and deep-walks the React fiber (props + hook state) to locate the full inventory array for keyless zero-scroll. Remove after one run.
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
  var ITEM_KEYS = ["name", "title", "quantity", "amount", "qty", "market_price", "market_value", "type", "sub_type", "subType", "equipped", "uid", "rarity", "circulation"];
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
    return { count: arr.length, keys: Object.keys(arr[0]).slice(0, 16), ids: ids };
  }

  function deepBiggestItemArray(root, maxDepth, budget) {
    var best = null, seen = (typeof WeakSet !== "undefined") ? new WeakSet() : null;
    var stack = [{ v: root, d: 0 }];
    while (stack.length && budget-- > 0) {
      var cur = stack.pop(), v = cur.v, d = cur.d;
      if (!v || typeof v !== "object" || d > maxDepth) continue;
      try { if (seen) { if (seen.has(v)) continue; seen.add(v); } } catch (e) { continue; }
      if (Array.isArray(v)) {
        if (v.length > 50 && looksLikeItem(v[0])) { if (!best || v.length > best.count) best = summarize(v); }
        for (var a = 0; a < v.length && a < 80; a++) stack.push({ v: v[a], d: d + 1 });
      } else {
        var ks; try { ks = Object.keys(v); } catch (e) { continue; }
        for (var i = 0; i < ks.length; i++) {
          var k = ks[i];
          if (k === "return" || k === "stateNode" || k === "_owner" || k === "child" || k === "sibling" || k === "alternate" || k === "_debugOwner") continue;
          var nv; try { nv = v[k]; } catch (e) { continue; }
          if (nv && typeof nv === "object") stack.push({ v: nv, d: d + 1 });
        }
      }
    }
    return best;
  }

  function fiberKey(node) {
    var kk; try { kk = Object.keys(node || {}); } catch (e) { return null; }
    for (var i = 0; i < kk.length; i++) if (kk[i].indexOf("__reactFiber$") === 0 || kk[i].indexOf("__reactInternalInstance$") === 0) return kk[i];
    return null;
  }
  function typeName(f) {
    var t = (f && f.type) || (f && f.elementType);
    if (typeof t === "string") return t;
    if (typeof t === "function") return t.displayName || t.name || "Fn";
    if (t && typeof t === "object") {
      if (t.displayName) return t.displayName;
      if (t.render) return (t.render.displayName || t.render.name || "FwdRef");
      if (t.type) return (typeof t.type === "function" ? (t.type.displayName || t.type.name || "Memo") : "Memo");
      return "Obj";
    }
    return "host";
  }

  function findGrid() {
    var imgs = document.querySelectorAll('img[src*="/images/items/"]');
    if (!imgs.length) return null;
    var mid = imgs[Math.floor(imgs.length / 2)];
    var el = mid, best = mid, bestCount = 0;
    for (var hop = 0; el && hop < 16; hop++) {
      var c = 0; try { c = el.querySelectorAll('img[src*="/images/items/"]').length; } catch (e) {}
      if (c >= bestCount) { bestCount = c; best = el; }
      el = el.parentElement;
    }
    return { el: best, imgCount: bestCount, total: imgs.length };
  }

  function run() {
    var grid = findGrid();
    if (!grid) { post("jfp3-grid", { note: "no item imgs" }); return; }
    var cls = "";
    try { cls = String(grid.el.className || "").slice(0, 60); } catch (e) {}
    var fk = fiberKey(grid.el);
    post("jfp3-grid", { total: grid.total, imgCount: grid.imgCount, tag: (grid.el.tagName || "").toLowerCase(), cls: cls, fiber: !!fk });
    if (!fk) { post("jfp3-best", { note: "no fiber on grid", nodeKeys: Object.keys(grid.el).slice(0, 8) }); return; }

    var fiber = grid.el[fk], hops = 0, trail = [], best = null, bestHop = -1, bestName = "";
    while (fiber && hops < 90) {
      var nm = typeName(fiber);
      var found = deepBiggestItemArray({ p: fiber.memoizedProps, s: fiber.memoizedState }, 8, 9000);
      if (found && (!best || found.count > best.count)) { best = found; bestHop = hops; bestName = nm; }
      trail.push("h" + hops + ":" + String(nm).slice(0, 22) + (found ? "[" + found.count + "]" : ""));
      fiber = fiber.return; hops++;
    }

    if (best) post("jfp3-best", { hop: bestHop, comp: bestName, count: best.count, keys: best.keys, ids: best.ids });
    else post("jfp3-best", { note: "no item array >50 in any fiber", hops: hops });

    post("jfp3-trail-a", { hops: hops, trail: trail.slice(0, 18) });
    if (trail.length > 18) post("jfp3-trail-b", { trail: trail.slice(18, 40) });
  }

  post("jfp3-start", { hasUnsafe: (typeof unsafeWindow !== "undefined") });
  setTimeout(run, 6000);
  setTimeout(run, 13000);
})();
