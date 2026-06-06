// ==UserScript==
// @name         OC Item Worth & Totals
// @namespace    RussianRob
// @version      1.0.0
// @description  Shows the real market value of completed-OC reward items (the paintings/weapons Torn prices at $0 or a stale catalog price) and adds a per-OC "Items total", using live Torn item-market prices via tornwar.com — no API key, works in Torn PDA.
// @author       RussianRob
// @copyright    2026, RussianRob (https://tornwar.com)
// @license      MIT
// @match        https://www.torn.com/factions.php*
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @connect      tornwar.com
// @downloadURL  https://tornwar.com/scripts/oc-item-worth.user.js
// @updateURL    https://tornwar.com/scripts/oc-item-worth.meta.js
// ==/UserScript==

// Standalone version of the OC reward-value override that ships inside OC Spawn
// Assistance — for people who don't run that script and just want correct reward
// worths + a per-OC total. Corrects Torn's native "worth $N" on OC reward items
// (the catalog underprices/zeroes collectibles like the Priceless Painting) with
// the live item-market lowest listing from tornwar.com, and sums each OC's reward
// items into one "Items total" line. Built-in diag (tag oc-item-worth) to verify.
(function () {
  "use strict";
  const SCRIPT_VERSION = "1.0.0";
  const NAMES_URL  = "https://tornwar.com/api/oc/item-values"; // {byName} — for tooltip worth rewrite
  const VALUE_URL  = "https://tornwar.com/api/oc/value";        // ?ids= → {values:{id:price}} — for per-OC total
  const CACHE_KEY  = "ocw_item_values_v1";
  const TTL_MS     = 10 * 60 * 1000;
  const DIAG_URL   = "https://tornwar.com/api/debug/client-log";
  let _byName = {};      // item name(lower) -> value  (the $0/stale-catalog items)
  let _byId   = {};      // item id(str)     -> value  (catalog || item-market; filled on demand)
  let _fetching = false;
  let _diagCount = 0, _diagDone = false;
  const VER = (typeof GM_info !== "undefined" && GM_info && GM_info.script && GM_info.script.version) || SCRIPT_VERSION;
  function diag(payload) {
    if (_diagCount >= 6) return; _diagCount++;
    try { GM_xmlhttpRequest({ method: "POST", url: DIAG_URL, headers: { "Content-Type": "application/json" }, data: JSON.stringify({ tag: "oc-item-worth", data: Object.assign({ ver: VER, src: "standalone" }, payload) }) }); } catch (_) {}
  }
  const fmt = (n) => "$" + Number(n).toLocaleString("en-US");
  function isVisible(el) {
    return !!(el && el.getClientRects && el.getClientRects().length > 0);
  }

  // ── pass 1: correct the hover tooltip's "worth $N" to the live market value ──
  //   Torn shows the bulk catalog market_price, which is $0 for some collectibles
  //   and stale for others (e.g. Priceless Painting catalog $65M, listed at $85M).
  //   For any tracked item we have a live value for, rewrite the shown amount.
  const WORTH_RE = /worth\s*\$\s*([\d,]+)/i;
  function rewriteWorth() {
    if (!_byName || !Object.keys(_byName).length) return;
    const w1 = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const hits = []; let n;
    while ((n = w1.nextNode())) { if (WORTH_RE.test(n.nodeValue || "") && isVisible(n.parentElement)) hits.push(n); }
    for (const tn of hits) {
      const txt = tn.nodeValue;
      let name = null, qty = 1;
      const m = txt.match(/(\d+)\s*x?\s+(.+?)\s+worth\s*\$\s*[\d,]+/i);
      if (m) { qty = parseInt(m[1], 10) || 1; name = m[2].trim(); }
      else {
        const ancText = (tn.parentElement && tn.parentElement.textContent || "").toLowerCase();
        for (const k of Object.keys(_byName)) { if (ancText.includes(k)) { name = k; const qm = ancText.match(/(\d+)\s*x/); if (qm) qty = parseInt(qm[1], 10) || 1; break; } }
      }
      if (!name) continue;
      const unit = _byName[name.toLowerCase()];
      if (!(unit > 0)) continue;
      const want = unit * qty;
      const shown = parseInt((txt.match(WORTH_RE)[1] || "0").replace(/,/g, ""), 10);
      if (shown === want) continue; // already correct — don't churn
      tn.nodeValue = txt.replace(WORTH_RE, "worth " + fmt(want));
    }
  }

  // ── pass 2: persistent per-OC Total, summed from the reward ICONS ───────────
  //   The "$ worth" only exists in transient hover tooltips, so we read id+qty
  //   off the reward icons and value them ourselves (/api/oc/value).
  // Group reward icons by their OC reward list (<ul class="reward___…">). Each OC
  // card has exactly one, so this gives ONE total per OC. Icons outside any reward
  // ul (member weapons, avatars, other UI) are ignored. DOM (confirmed via diag):
  //   img.torn-item ▸ span.item-plate ▸ div.container___[aria-label] ▸ li ▸ ul.reward___
  function scanRewardLists() {
    const lists = new Map(); // reward <ul> -> Map(id -> qty)
    const imgs = document.querySelectorAll('img.torn-item, img[src*="/images/items/"]');
    for (const img of imgs) {
      if (!isVisible(img)) continue;
      const m = (img.getAttribute("src") || img.src || "").match(/\/items\/(\d+)\b/);
      if (!m) continue;
      const ul = img.closest('[class*="reward___"]');
      if (!ul) continue; // not an OC reward icon
      const id = m[1];
      const container = img.closest('[class*="container___"]') || img.parentElement;
      const qEl = container && container.querySelector('[class*="quantityContainer"]');
      let qty = 1;
      if (qEl) { const q = parseInt((qEl.textContent || "").replace(/[^\d]/g, ""), 10); if (q > 0) qty = q; }
      let g = lists.get(ul); if (!g) { g = new Map(); lists.set(ul, g); }
      if (!g.has(id) || qty > g.get(id)) g.set(id, qty); // dedupe within an OC by id
    }
    return lists;
  }
  function ensureValues(ids, done) {
    const missing = ids.filter((id) => !(id in _byId));
    if (!missing.length || _fetching) { done(); return; }
    _fetching = true;
    // re-run after the fetch so any ids that changed while it was in flight get picked up
    const finish = () => { _fetching = false; done(); schedule(); };
    try {
      GM_xmlhttpRequest({ method: "GET", url: VALUE_URL + "?ids=" + missing.slice(0, 30).join(","), timeout: 20000,
        onload: (resp) => {
          try { const b = JSON.parse(resp.responseText); if (b && b.values) for (const [k, v] of Object.entries(b.values)) _byId[k] = Number(v) || 0; } catch (_) {}
          finish();
        },
        onerror: finish,
        ontimeout: finish,
      });
    } catch (_) { finish(); }
  }
  function injectTotals() {
    // drop totals whose reward ul was re-rendered away (avoids dupes/orphans)
    document.querySelectorAll(".ocw-oc-total").forEach((el) => {
      const prev = el.previousElementSibling;
      if (!(prev && prev.matches && prev.matches('[class*="reward___"]'))) el.remove();
    });
    const lists = scanRewardLists();
    let ocs = 0, firstSum = 0;
    for (const [ul, byId] of lists) {
      if (!document.contains(ul)) continue;
      let sum = 0, missing = 0;
      for (const [id, qty] of byId) { const v = _byId[id]; if (v > 0) sum += v * qty; else if (!(id in _byId)) missing++; }
      if (!(sum > 0)) continue; // wait until values are in — no "$0 …" flash
      let el = ul.nextElementSibling;
      if (!(el && el.classList && el.classList.contains("ocw-oc-total"))) {
        el = document.createElement("div");
        el.className = "ocw-oc-total";
        el.style.cssText = "margin:5px 2px 3px;font-size:12px;font-weight:700;color:#46d369;letter-spacing:.2px;font-family:inherit;";
        ul.insertAdjacentElement("afterend", el);
      }
      const label = "💰 Items total: " + fmt(sum) + (missing ? " …" : "");
      if (el.textContent !== label) el.textContent = label;
      ocs++; if (!firstSum) firstSum = sum;
    }
    if (ocs && !_diagDone) { _diagDone = true; diag({ total_v3: true, ocs, firstSum }); }
  }
  function pass2() {
    const lists = scanRewardLists();
    const ids = new Set();
    for (const byId of lists.values()) for (const id of byId.keys()) ids.add(id);
    if (!ids.size) { injectTotals(); return; } // still run to clean stale totals
    ensureValues(Array.from(ids), injectTotals);
    injectTotals(); // paint immediately with whatever's already cached
  }

  function applyOverrides() { rewriteWorth(); pass2(); }

  function loadNames(cb) {
    try { const raw = GM_getValue(CACHE_KEY, ""); if (raw) { const o = JSON.parse(raw); if (o && o.byName) { _byName = o.byName; if (o.ts && Date.now() - o.ts < TTL_MS) { cb(); return; } } } } catch (_) {}
    try {
      GM_xmlhttpRequest({ method: "GET", url: NAMES_URL, timeout: 10000,
        onload: (resp) => {
          if (resp.status >= 200 && resp.status < 300) { try { const body = JSON.parse(resp.responseText); if (body && body.byName) { _byName = body.byName; try { GM_setValue(CACHE_KEY, JSON.stringify({ ts: Date.now(), byName: _byName })); } catch (_) {} } } catch (_) {} }
          cb();
        },
        onerror: () => cb(),
      });
    } catch (_) { cb(); }
  }
  let _pending = null;
  function schedule() { if (_pending) return; _pending = setTimeout(() => { _pending = null; try { applyOverrides(); } catch (_) {} }, 300); }
  loadNames(() => { applyOverrides(); try { new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true }); } catch (_) {} });
})();
