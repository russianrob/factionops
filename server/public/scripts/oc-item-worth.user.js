// ==UserScript==
// @name         OC Item Worth
// @namespace    RussianRob
// @version      1.0.0
// @description  Fixes Torn's native "worth $0" on completed Organized Crime reward items (paintings/weapons the item catalog prices at $0) by showing the live item-market lowest listing from tornwar.com.
// @author       RussianRob
// @match        https://www.torn.com/factions.php*
// @match        https://pda.torn.com/factions.php*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=torn.com
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @connect      tornwar.com
// @downloadURL  https://tornwar.com/scripts/oc-item-worth.user.js
// @updateURL    https://tornwar.com/scripts/oc-item-worth.meta.js
// ==/UserScript==

(function () {
  "use strict";

  const VALUES_URL = "https://tornwar.com/api/oc/item-values";
  const CACHE_KEY  = "ocw_item_values_v1";
  const TTL_MS     = 10 * 60 * 1000;
  const DIAG_URL   = "https://tornwar.com/api/debug/client-log";
  let _byName = {};
  let _diagCount = 0;

  function diag(payload) {
    if (_diagCount >= 6) return;
    _diagCount++;
    try {
      GM_xmlhttpRequest({
        method: "POST", url: DIAG_URL,
        headers: { "Content-Type": "application/json" },
        data: JSON.stringify({ tag: "oc-item-worth", data: payload }),
      });
    } catch (_) {}
  }

  const fmt = (n) => "$" + Number(n).toLocaleString("en-US");

  function applyOverrides() {
    if (!_byName || !Object.keys(_byName).length) return;
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const nodes = [];
    let n;
    while ((n = walker.nextNode())) {
      if (/worth\s*\$\s*0\b/i.test(n.nodeValue || "")) nodes.push(n);
    }
    for (const tn of nodes) {
      const txt = tn.nodeValue;
      let name = null, qty = 1;
      const m = txt.match(/(\d+)\s*x?\s+(.+?)\s+worth\s*\$\s*0\b/i); // "1x Priceless Painting worth $0"
      if (m) { qty = parseInt(m[1], 10) || 1; name = m[2].trim(); }
      else {
        // item name lives in a sibling element — search the parent's text for a known item
        const ancText = (tn.parentElement?.textContent || "").toLowerCase();
        for (const k of Object.keys(_byName)) {
          if (ancText.includes(k)) { name = k; const qm = ancText.match(/(\d+)\s*x/); if (qm) qty = parseInt(qm[1], 10) || 1; break; }
        }
      }
      if (!name) { diag({ unresolved: true, text: txt.slice(0, 80), anc: (tn.parentElement?.textContent || "").slice(0, 120) }); continue; }
      const unit = _byName[name.toLowerCase()];
      if (!(unit > 0)) { diag({ name, novalue: true }); continue; }
      const total = unit * qty;
      tn.nodeValue = txt.replace(/worth\s*\$\s*0\b/i, "worth " + fmt(total));
      diag({ name, qty, unit, total, replaced: true });
    }
  }

  function loadValues(cb) {
    try {
      const raw = GM_getValue(CACHE_KEY, "");
      if (raw) {
        const o = JSON.parse(raw);
        if (o && o.byName) { _byName = o.byName; if (o.ts && Date.now() - o.ts < TTL_MS) { cb(); return; } }
      }
    } catch (_) {}
    try {
      GM_xmlhttpRequest({
        method: "GET", url: VALUES_URL, timeout: 10000,
        onload: (resp) => {
          if (resp.status < 200 || resp.status >= 300) { cb(); return; }
          try {
            const body = JSON.parse(resp.responseText);
            if (body && body.byName) {
              _byName = body.byName;
              try { GM_setValue(CACHE_KEY, JSON.stringify({ ts: Date.now(), byName: _byName })); } catch (_) {}
            }
          } catch (_) {}
          cb();
        },
        onerror: () => cb(),
      });
    } catch (_) { cb(); }
  }

  let _pending = null;
  function schedule() {
    if (_pending) return;
    _pending = setTimeout(() => { _pending = null; try { applyOverrides(); } catch (_) {} }, 300);
  }

  loadValues(() => {
    applyOverrides();
    const obs = new MutationObserver(schedule);
    obs.observe(document.body, { childList: true, subtree: true });
  });
})();
