// ==UserScript==
// @name         OC Item Worth & Totals
// @namespace    RussianRob
// @version      1.1.0
// @description  Shows the real market value of completed-OC reward items (the paintings/weapons Torn prices at $0 or a stale catalog price) and a per-OC "Items total", reading live item-market prices straight from Torn with YOUR own API key. Talks only to api.torn.com. Works in Torn PDA.
// @author       RussianRob
// @copyright    2026, RussianRob (https://tornwar.com)
// @license      MIT
// @match        https://www.torn.com/factions.php*
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_registerMenuCommand
// @connect      api.torn.com
// @downloadURL  https://tornwar.com/scripts/oc-item-worth.user.js
// @updateURL    https://tornwar.com/scripts/oc-item-worth.meta.js
// ==/UserScript==

(function () {
  "use strict";
  const SCRIPT_VERSION = "1.1.0";
  const KEY_STORE  = "ocwk_torn_api_key";
  const CACHE_KEY  = "ocwk_listings_v1";
  const TTL_MS     = 10 * 60 * 1000;
  const FETCH_GAP  = 350;
  const API_BASE   = "https://api.torn.com/v2/market/";

  let _apiKey = "";
  let _byId = {};
  let _byName = {};
  let _cache = {};
  let _fetching = false;
  let _state = "none";
  let _expanded = false;
  let _chipSig = null;

  const fmt = (n) => "$" + Number(n).toLocaleString("en-US");
  function isVisible(el) { return !!(el && el.getClientRects && el.getClientRects().length > 0); }

  function loadKey()  { try { _apiKey = (GM_getValue(KEY_STORE, "") || "").trim(); } catch (_) { _apiKey = ""; } }
  function saveKey(k) { _apiKey = String(k || "").trim(); try { GM_setValue(KEY_STORE, _apiKey); } catch (_) {} }
  function clearKey() { _apiKey = ""; try { GM_setValue(KEY_STORE, ""); } catch (_) {} }
  function loadCache() {
    try { const raw = GM_getValue(CACHE_KEY, ""); if (raw) { const o = JSON.parse(raw); if (o && typeof o === "object") _cache = o; } } catch (_) { _cache = {}; }
    const now = Date.now();
    for (const [id, e] of Object.entries(_cache)) {
      if (e && now - (e.at || 0) < TTL_MS) { _byId[id] = Number(e.price) || 0; if (e.name && e.price > 0) _byName[String(e.name).toLowerCase()] = e.price; }
    }
  }
  function saveCache() { try { GM_setValue(CACHE_KEY, JSON.stringify(_cache)); } catch (_) {} }

  function fetchItem(id, cb) {
    const url = API_BASE + id + "/itemmarket?key=" + encodeURIComponent(_apiKey) + "&comment=oc-item-worth";
    try {
      GM_xmlhttpRequest({
        method: "GET", url, timeout: 15000,
        onload: (resp) => {
          let d = null; try { d = JSON.parse(resp.responseText); } catch (_) {}
          if (!d) { cb("parse"); return; }
          if (d.error) { cb(d.error.code); return; }
          const im = d.itemmarket || {};
          const name = (im.item && im.item.name) || (_cache[id] && _cache[id].name) || null;
          const listings = Array.isArray(im.listings) ? im.listings : [];
          let lowest = 0;
          for (const l of listings) { const p = Number(l && l.price) || 0; if (p > 0 && (lowest === 0 || p < lowest)) lowest = p; }
          _cache[id] = { name, price: lowest, at: Date.now() };
          _byId[id] = lowest;
          if (name && lowest > 0) _byName[name.toLowerCase()] = lowest;
          cb(null);
        },
        onerror: () => cb("net"),
        ontimeout: () => cb("timeout"),
      });
    } catch (_) { cb("net"); }
  }
  function fetchMissing(ids, done) {
    if (_fetching) { done(); return; }
    const need = ids.filter((id) => !(id in _byId));
    if (!need.length) { done(); return; }
    _fetching = true;
    if (_state !== "ok") { _state = "checking"; renderChip(); }
    let i = 0;
    const step = () => {
      if (i >= need.length) { _fetching = false; saveCache(); if (_state === "checking") { _state = "ok"; renderChip(); } done(); schedule(); return; }
      const id = need[i++];
      fetchItem(id, (err) => {
        if (err === 2 || err === 1) { _state = "invalid"; _fetching = false; renderChip(); return; }
        if (err === 16) { _state = "lowaccess"; _fetching = false; renderChip(); return; }
        if (err === 18) { _state = "paused"; _fetching = false; renderChip(); return; }
        if (err === 5) { _state = "ratelimited"; saveCache(); renderChip(); setTimeout(() => { _fetching = false; schedule(); }, 5000); return; }
        if (err == null && _state !== "ok") { _state = "ok"; renderChip(); }
        setTimeout(step, FETCH_GAP);
      });
    };
    step();
  }

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
      if (shown === want) continue;
      tn.nodeValue = txt.replace(WORTH_RE, "worth " + fmt(want));
    }
  }

  function scanRewardLists() {
    const lists = new Map();
    const imgs = document.querySelectorAll('img.torn-item, img[src*="/images/items/"]');
    for (const img of imgs) {
      if (!isVisible(img)) continue;
      const m = (img.getAttribute("src") || img.src || "").match(/\/items\/(\d+)\b/);
      if (!m) continue;
      const ul = img.closest('[class*="reward___"]');
      if (!ul) continue;
      const id = m[1];
      const container = img.closest('[class*="container___"]') || img.parentElement;
      const qEl = container && container.querySelector('[class*="quantityContainer"]');
      let qty = 1;
      if (qEl) { const q = parseInt((qEl.textContent || "").replace(/[^\d]/g, ""), 10); if (q > 0) qty = q; }
      let g = lists.get(ul); if (!g) { g = new Map(); lists.set(ul, g); }
      if (!g.has(id) || qty > g.get(id)) g.set(id, qty);
    }
    return lists;
  }
  function injectTotals() {
    document.querySelectorAll(".ocw-oc-total").forEach((el) => {
      const prev = el.previousElementSibling;
      if (!(prev && prev.matches && prev.matches('[class*="reward___"]'))) el.remove();
    });
    const lists = scanRewardLists();
    for (const [ul, byId] of lists) {
      if (!document.contains(ul)) continue;
      let sum = 0;
      for (const [id, qty] of byId) { const v = _byId[id]; if (v > 0) sum += v * qty; }
      if (!(sum > 0)) continue;
      let el = ul.nextElementSibling;
      if (!(el && el.classList && el.classList.contains("ocw-oc-total"))) {
        el = document.createElement("div");
        el.className = "ocw-oc-total";
        el.style.cssText = "margin:5px 2px 3px;font-size:12px;font-weight:700;color:#46d369;letter-spacing:.2px;font-family:inherit;";
        ul.insertAdjacentElement("afterend", el);
      }
      const label = "💰 Items total: " + fmt(sum);
      if (el.textContent !== label) el.textContent = label;
    }
  }

  function statusText() {
    switch (_state) {
      case "ok":          return "✓ OC prices: Torn";
      case "checking":    return "⏳ Checking key…";
      case "invalid":     return "⚠ Invalid API key — tap to fix";
      case "lowaccess":   return "⚠ Key access too low — tap to fix";
      case "paused":      return "⚠ API key paused — tap to fix";
      case "ratelimited": return "⏳ Rate-limited — retrying…";
      case "error":       return "⚠ Torn API error — tap to retry";
      default:            return "🔑 Set API key for OC prices";
    }
  }
  function panelHTML() {
    const cur = (_apiKey || "").replace(/[^A-Za-z0-9]/g, "");
    let note = "";
    if (_state === "invalid")   note = '<div style="margin-top:4px;color:#ff6b6b">Key was rejected — paste a valid one.</div>';
    if (_state === "lowaccess") note = '<div style="margin-top:4px;color:#ff6b6b">This key\'s access level is too low. A Limited Access key works.</div>';
    if (_state === "paused")    note = '<div style="margin-top:4px;color:#ff6b6b">This key is paused in your Torn API settings.</div>';
    return '' +
      '<div style="font-weight:700;margin-bottom:5px">OC item prices — Torn API key</div>' +
      '<input id="ocwk-input" type="text" autocomplete="off" spellcheck="false" placeholder="Paste Torn API key" value="' + cur + '" ' +
        'style="width:200px;max-width:60vw;padding:4px 6px;border-radius:4px;border:1px solid #555;background:#1a1a1a;color:#eee;font-size:12px">' +
      '<div style="margin-top:6px;display:flex;gap:6px;flex-wrap:wrap">' +
        '<button data-action="save"  style="padding:3px 10px;border-radius:4px;border:0;background:#2e7d32;color:#fff;font-weight:700;cursor:pointer">Save</button>' +
        '<button data-action="clear" style="padding:3px 10px;border-radius:4px;border:0;background:#555;color:#fff;cursor:pointer">Clear</button>' +
        '<button data-action="close" style="padding:3px 10px;border-radius:4px;border:0;background:#333;color:#bbb;cursor:pointer">Close</button>' +
      '</div>' +
      note +
      '<div style="margin-top:6px;opacity:.65;font-size:10px;line-height:1.35;max-width:230px">A <b>Limited Access</b> key is enough. Stored only in this browser; sent only to api.torn.com. Create one in Torn → Settings → API Keys.</div>';
  }
  function ensureChip() {
    let chip = document.getElementById("ocwk-chip");
    if (chip) return chip;
    chip = document.createElement("div");
    chip.id = "ocwk-chip";
    chip.style.cssText = "position:fixed;left:8px;bottom:8px;z-index:2147483600;max-width:80vw;" +
      "background:rgba(20,20,20,.92);color:#ddd;border:1px solid #3a3a3a;border-radius:8px;" +
      "padding:6px 9px;font-family:inherit;font-size:12px;box-shadow:0 2px 10px rgba(0,0,0,.4)";
    chip.addEventListener("click", onChipClick);
    document.body.appendChild(chip);
    _chipSig = null;
    renderChip();
    return chip;
  }
  function removeChip() { const c = document.getElementById("ocwk-chip"); if (c) c.remove(); _chipSig = null; _expanded = false; }
  function onChipClick(e) {
    const t = e.target;
    const act = t && t.getAttribute && t.getAttribute("data-action");
    if (act === "save") {
      const inp = document.getElementById("ocwk-input");
      saveKey(inp ? inp.value : "");
      _expanded = false; _chipSig = null;
      if (_apiKey) { _byId = {}; _byName = {}; _state = "checking"; renderChip(); schedule(); }
      else { _state = "none"; renderChip(); }
      return;
    }
    if (act === "clear") {
      clearKey(); _byId = {}; _byName = {}; _expanded = false; _state = "none"; _chipSig = null;
      document.querySelectorAll(".ocw-oc-total").forEach((el) => el.remove());
      renderChip();
      return;
    }
    if (act === "close") { _expanded = false; _chipSig = null; renderChip(); return; }
    _expanded = !_expanded; _chipSig = null; renderChip();
  }
  function renderChip() {
    const chip = document.getElementById("ocwk-chip");
    if (!chip) return;
    if (_expanded) {
      const sig = "exp:" + _state;
      if (_chipSig === sig) return;
      const prev = document.getElementById("ocwk-input");
      const pv = prev ? prev.value : null, ps = prev ? prev.selectionStart : null, pe = prev ? prev.selectionEnd : null;
      _chipSig = sig; chip.innerHTML = panelHTML();
      const inp = document.getElementById("ocwk-input");
      if (inp) { if (pv != null) inp.value = pv; try { inp.focus(); if (ps != null) inp.setSelectionRange(ps, pe); } catch (_) {} }
      return;
    }
    const status = statusText();
    const sig = "col:" + status;
    if (_chipSig === sig) return;
    _chipSig = sig;
    chip.innerHTML = '<span data-action="toggle" style="cursor:pointer;white-space:nowrap">' + status + '</span>';
  }

  const TERMINAL_ERR = { invalid: 1, lowaccess: 1, paused: 1 };
  function tick() {
    const lists = scanRewardLists();
    if (!lists.size) { removeChip(); return; }
    ensureChip();
    if (!_apiKey) { if (_state !== "none") { _state = "none"; renderChip(); } injectTotals(); return; }
    if (!TERMINAL_ERR[_state]) {
      const ids = new Set();
      for (const byId of lists.values()) for (const id of byId.keys()) ids.add(id);
      fetchMissing(Array.from(ids), () => { rewriteWorth(); injectTotals(); });
    }
    rewriteWorth(); injectTotals();
  }
  let _pending = null;
  function schedule() { if (_pending) return; _pending = setTimeout(() => { _pending = null; try { tick(); } catch (_) {} }, 300); }

  try {
    if (typeof GM_registerMenuCommand === "function") {
      GM_registerMenuCommand("Set OC API key (Torn)", () => {
        const k = prompt("Paste your Torn API key (Limited Access is enough):", _apiKey || "");
        if (k != null) { saveKey(k); _byId = {}; _byName = {}; _state = _apiKey ? "checking" : "none"; _chipSig = null; schedule(); }
      });
      GM_registerMenuCommand("Clear OC API key", () => { clearKey(); _byId = {}; _byName = {}; _state = "none"; _chipSig = null; schedule(); });
    }
  } catch (_) {}

  loadKey();
  loadCache();
  tick();
  try { new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true }); } catch (_) {}
})();
