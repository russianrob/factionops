// ==UserScript==
// @name         MiniOps
// @namespace    tornwar.com/miniops
// @version      1.0.0
// @description  Call/uncall faction war targets directly from Torn's native war page. No overlay, no banners — just a tap-to-call button in place of each enemy's score cell.
// @author       RussianRob
// @license      MIT
// @match        https://www.torn.com/factions.php*
// @match        https://www.torn.com/war.php*
// @downloadURL  https://tornwar.com/scripts/miniops.user.js
// @updateURL    https://tornwar.com/scripts/miniops.meta.js
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_addStyle
// @connect      tornwar.com
// @connect      api.torn.com
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  const SERVER     = 'https://tornwar.com';
  const POLL_MS    = 5000;          // how often we fetch fresh call state
  const LONG_MS    = 500;           // long-press threshold → deal call
  const LOG_PREFIX = '[miniops]';
  const log  = (...a) => console.log(LOG_PREFIX, ...a);
  const warn = (...a) => console.warn(LOG_PREFIX, ...a);

  // ── Persisted state ─────────────────────────────────────────────────
  const get = (k, d) => { try { return GM_getValue(k, d); } catch { return d; } };
  const set = (k, v) => { try { GM_setValue(k, v); } catch {} };

  const state = {
    apiKey:  get('miniops_apikey', ''),
    jwt:     get('miniops_jwt', ''),
    myId:    get('miniops_my_id', ''),
    myName:  get('miniops_my_name', ''),
    warId:   null,
    calls:   Object.create(null),   // targetId → { calledBy:{id,name}, isDeal, calledAt }
    rowCache: new Map(),            // targetId → score-cell button element
    pollTimer: null,
    scoreColIdx: null,              // header-based column index, cached
  };

  // ── HTTP helpers (use GM_xhr to bypass page CSP) ────────────────────
  function gmRequest({ method, url, body, headers }) {
    return new Promise((resolve, reject) => {
      try {
        GM_xmlhttpRequest({
          method, url,
          headers: Object.assign({ 'Content-Type': 'application/json' }, headers || {}),
          data: body ? JSON.stringify(body) : undefined,
          timeout: 15000,
          onload:    r => {
            try {
              const json = r.responseText ? JSON.parse(r.responseText) : {};
              if (r.status >= 200 && r.status < 300) resolve(json);
              else reject(new Error(json.error || json.message || `HTTP ${r.status}`));
            } catch (e) { reject(new Error('Bad JSON: ' + e.message)); }
          },
          onerror:   () => reject(new Error('Network error')),
          ontimeout: () => reject(new Error('Timeout')),
        });
      } catch (e) { reject(e); }
    });
  }
  function authHeaders() { return state.jwt ? { Authorization: 'Bearer ' + state.jwt } : {}; }

  // ── Auth: trade Torn API key for a warboard JWT ─────────────────────
  async function auth() {
    if (!state.apiKey) throw new Error('No API key set');
    log('Authenticating…');
    const r = await gmRequest({
      method: 'POST',
      url: SERVER + '/api/auth',
      body: { apiKey: state.apiKey, scriptVersion: '1.0.0', scriptName: 'miniops' },
    });
    if (!r.token || !r.playerId) throw new Error('Auth response missing token');
    state.jwt    = r.token;
    state.myId   = String(r.playerId);
    state.myName = r.playerName || '';
    set('miniops_jwt',     state.jwt);
    set('miniops_my_id',   state.myId);
    set('miniops_my_name', state.myName);
    log('Authed as', state.myName, '(' + state.myId + ')');
  }

  // ── War detection — pull warId from the URL or DOM ──────────────────
  function detectWarId() {
    // Most reliable signal first: ?step=war in URL
    const m1 = location.href.match(/[?&]warID=(\d+)/i) || location.href.match(/[?&]war[Ii]d=(\d+)/);
    if (m1) return m1[1];
    // Fallback: look for any data-warid / data-war-id attr in the DOM
    const el = document.querySelector('[data-warid], [data-war-id]');
    if (el) return el.getAttribute('data-warid') || el.getAttribute('data-war-id');
    // Last resort: parse from the page's chain/war banner text
    const link = document.querySelector('a[href*="warID="], a[href*="war.php?warID="]');
    if (link) {
      const m2 = link.getAttribute('href').match(/warID=(\d+)/i);
      if (m2) return m2[1];
    }
    return null;
  }

  // ── Server: pull current calls for the war ──────────────────────────
  async function pollCalls() {
    if (!state.jwt || !state.warId) return;
    try {
      const r = await gmRequest({
        method: 'GET',
        url:    SERVER + '/api/calls?warId=' + encodeURIComponent(state.warId),
        headers: authHeaders(),
      });
      state.calls = r.calls || Object.create(null);
      renderAllRows();
    } catch (e) {
      warn('pollCalls:', e.message);
    }
  }

  // ── Server: claim / release a call ──────────────────────────────────
  async function emitCall(targetId, isDeal) {
    const tid = String(targetId);
    // Optimistic
    state.calls[tid] = {
      calledBy: { id: state.myId, name: state.myName || 'You' },
      calledAt: Date.now(),
      isDeal:   !!isDeal,
    };
    renderRow(tid);
    try {
      const body = { warId: state.warId, targetId: tid };
      if (isDeal) body.isDeal = true;
      await gmRequest({ method: 'POST', url: SERVER + '/api/call', body, headers: authHeaders() });
    } catch (e) {
      warn('call failed:', e.message);
      delete state.calls[tid];
      renderRow(tid);
    }
  }
  async function emitUncall(targetId) {
    const tid = String(targetId);
    const prev = state.calls[tid];
    delete state.calls[tid];
    renderRow(tid);
    try {
      await gmRequest({
        method: 'POST',
        url:    SERVER + '/api/call',
        body:   { warId: state.warId, targetId: tid, action: 'uncall' },
        headers: authHeaders(),
      });
    } catch (e) {
      warn('uncall failed:', e.message);
      if (prev) state.calls[tid] = prev;
      renderRow(tid);
    }
  }

  // ── Score column detection (header-text → column index) ─────────────
  function findScoreColIdx() {
    if (state.scoreColIdx != null) return state.scoreColIdx;
    const headers = document.querySelectorAll('th, [role="columnheader"], [class*="header" i]');
    for (const h of headers) {
      const t = (h.textContent || '').trim();
      if (t === 'Score' || t.toLowerCase() === 'score') {
        const parent = h.parentElement;
        if (!parent) continue;
        const idx = Array.prototype.indexOf.call(parent.children, h);
        if (idx >= 0) { state.scoreColIdx = idx; return idx; }
      }
    }
    return null;
  }

  // Find every enemy row + its score cell. Returns [{ targetId, cell }].
  // Defensive: matches anywhere a player profile link is the row's anchor.
  function findRows() {
    const idx = findScoreColIdx();
    const out = [];
    // Walk every element that links to a player profile.
    const links = document.querySelectorAll('a[href*="profiles.php?XID="]');
    const seenRows = new Set();
    for (const link of links) {
      // Climb to a row-like ancestor
      let row = link.closest('li, tr, [role="row"]');
      if (!row || seenRows.has(row)) continue;
      seenRows.add(row);
      const m = link.getAttribute('href').match(/XID=(\d+)/);
      if (!m) continue;
      const targetId = m[1];
      if (targetId === state.myId) continue; // skip self if appears
      // Score cell by header index, else fallback
      let cell = null;
      if (idx != null && row.children[idx]) cell = row.children[idx];
      if (!cell) {
        for (const c of row.children) {
          const t = (c.textContent || '').trim();
          if (/^\d{1,4}\.\d{1,2}$/.test(t) || c.querySelector('.wpo-pill')) { cell = c; break; }
        }
      }
      if (!cell) continue;
      out.push({ targetId, cell });
    }
    return out;
  }

  // ── Rendering ───────────────────────────────────────────────────────
  function pillFor(targetId) {
    const c = state.calls[String(targetId)];
    if (!c) return { cls: 'wpo-empty', text: 'Call' };
    const isYours = c.calledBy && String(c.calledBy.id) === String(state.myId);
    if (isYours) return { cls: 'wpo-mine'  + (c.isDeal ? ' wpo-deal' : ''), text: c.isDeal ? '🤝 You' : 'You' };
    const name = (c.calledBy && c.calledBy.name) || 'Called';
    return { cls: 'wpo-other' + (c.isDeal ? ' wpo-deal' : ''), text: c.isDeal ? '🤝 ' + name : name };
  }

  function makeCallButton(targetId) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'wpo-pill';
    btn.dataset.tid = targetId;
    const p = pillFor(targetId);
    btn.classList.add(...p.cls.split(/\s+/));
    btn.textContent = p.text;
    let pressTimer = null, longFired = false;
    const trigger = (isDeal) => {
      const c = state.calls[String(targetId)];
      if (!c) emitCall(targetId, isDeal);
      else if (c.calledBy && String(c.calledBy.id) === String(state.myId)) emitUncall(targetId);
      // else: someone else's call, ignore
    };
    btn.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      longFired = false;
      pressTimer = setTimeout(() => { longFired = true; trigger(true); }, LONG_MS);
    });
    const cancel = (e) => {
      if (e) e.stopPropagation();
      if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; }
    };
    btn.addEventListener('pointerup',     cancel);
    btn.addEventListener('pointercancel', cancel);
    btn.addEventListener('pointerleave',  cancel);
    btn.addEventListener('click', (e) => {
      e.stopPropagation(); e.preventDefault();
      if (longFired) { longFired = false; return; }
      trigger(false);
    });
    btn.addEventListener('contextmenu', (e) => {
      e.stopPropagation(); e.preventDefault();
      trigger(true);
    });
    return btn;
  }

  function renderRow(targetId) {
    const btn = state.rowCache.get(String(targetId));
    if (!btn) return;
    const p = pillFor(targetId);
    btn.className = 'wpo-pill ' + p.cls;
    btn.textContent = p.text;
  }

  function renderAllRows() {
    const rows = findRows();
    for (const { targetId, cell } of rows) {
      let btn = state.rowCache.get(targetId);
      if (!btn || !cell.contains(btn)) {
        cell.innerHTML = '';
        cell.classList.add('wpo-cell');
        btn = makeCallButton(targetId);
        cell.appendChild(btn);
        state.rowCache.set(targetId, btn);
      } else {
        renderRow(targetId);
      }
    }
  }

  // ── Settings UI (one-time API key entry) ────────────────────────────
  function showSettings() {
    if (document.getElementById('wpo-settings')) return;
    const overlay = document.createElement('div');
    overlay.id = 'wpo-settings';
    overlay.innerHTML = `
      <div class="wpo-modal">
        <h3>MiniOps</h3>
        <p>Paste your Torn API key (limited access is fine — only used for auth).</p>
        <input type="text" id="wpo-key" placeholder="API key" value="${state.apiKey || ''}">
        <div class="wpo-row">
          <button id="wpo-save">Save</button>
          <button id="wpo-close" class="wpo-secondary">Close</button>
        </div>
        <div id="wpo-status"></div>
      </div>`;
    document.body.appendChild(overlay);
    document.getElementById('wpo-close').onclick = () => overlay.remove();
    document.getElementById('wpo-save').onclick  = async () => {
      const k = document.getElementById('wpo-key').value.trim();
      if (!k) return;
      state.apiKey = k; set('miniops_apikey', k);
      const s = document.getElementById('wpo-status');
      s.textContent = 'Authenticating…';
      try {
        await auth();
        s.textContent = 'OK — signed in as ' + state.myName;
        setTimeout(() => overlay.remove(), 800);
        boot();
      } catch (e) { s.textContent = 'Error: ' + e.message; }
    };
  }

  function makeGear() {
    if (document.getElementById('wpo-gear')) return;
    const g = document.createElement('button');
    g.id = 'wpo-gear';
    g.textContent = '⚙';
    g.title = 'MiniOps settings';
    g.onclick = showSettings;
    document.body.appendChild(g);
  }

  // ── Styles ──────────────────────────────────────────────────────────
  GM_addStyle(`
    .wpo-cell { padding: 0 !important; text-align: center !important; pointer-events: auto !important; }
    .wpo-pill {
      display: inline-block; padding: 4px 10px; border-radius: 12px;
      font: 700 11px/1.2 ui-monospace, "SF Mono", Menlo, monospace;
      border: 1px solid transparent; background: transparent; cursor: pointer;
      user-select: none; white-space: nowrap; max-width: 100%;
      overflow: hidden; text-overflow: ellipsis;
      -webkit-tap-highlight-color: transparent; touch-action: manipulation;
    }
    .wpo-pill:active { transform: translateY(1px); }
    .wpo-empty { background: rgba(78,205,196,0.12); color: #4ecdc4; border-color: #4ecdc4; }
    .wpo-mine  { background: rgba(78,205,196,0.28); color: #4ecdc4; border-color: #4ecdc4; }
    .wpo-other { background: rgba(225,112,85,0.18); color: #e17055; border-color: #e17055; }
    .wpo-deal  { background: rgba(253,203,110,0.20); color: #fdcb6e; border-color: #fdcb6e; }

    #wpo-gear {
      position: fixed; bottom: 16px; right: 16px; z-index: 99999;
      width: 36px; height: 36px; border-radius: 18px;
      background: #4ecdc4; color: #0a0d14; border: 0;
      font-size: 18px; cursor: pointer;
      box-shadow: 0 2px 8px rgba(0,0,0,0.4);
    }
    #wpo-settings {
      position: fixed; inset: 0; z-index: 100000;
      background: rgba(0,0,0,0.6);
      display: flex; align-items: center; justify-content: center;
    }
    .wpo-modal {
      background: #131722; color: #e6e8ee;
      border-radius: 10px; padding: 20px; width: 320px;
      font: 13px -apple-system, sans-serif;
    }
    .wpo-modal h3 { margin: 0 0 8px; font-size: 16px; color: #4ecdc4; }
    .wpo-modal p  { color: #999; font-size: 12px; }
    .wpo-modal input {
      width: 100%; box-sizing: border-box; padding: 8px;
      background: #0a0d14; color: #e6e8ee; border: 1px solid #2a2d3a;
      border-radius: 6px; margin: 8px 0;
    }
    .wpo-modal button {
      background: #4ecdc4; color: #0a0d14; border: 0; padding: 8px 14px;
      border-radius: 6px; font-weight: 700; cursor: pointer;
    }
    .wpo-modal button.wpo-secondary { background: #2a2d3a; color: #ddd; }
    .wpo-row { display: flex; gap: 8px; margin-top: 8px; }
    #wpo-status { margin-top: 8px; font-size: 11px; color: #999; }
  `);

  // ── Boot ────────────────────────────────────────────────────────────
  async function boot() {
    makeGear();
    if (!state.apiKey) { showSettings(); return; }
    if (!state.jwt) { try { await auth(); } catch (e) { warn('auth failed:', e.message); showSettings(); return; } }
    state.warId = detectWarId();
    if (!state.warId) { log('No war detected — running passive'); return; }
    log('War detected:', state.warId);

    // Initial render + poll loop
    pollCalls();
    state.pollTimer = setInterval(pollCalls, POLL_MS);

    // Watch for new rows added by Torn's lazy-load
    const root = document.getElementById('mainContainer') || document.body;
    const debounce = (fn, ms) => { let t; return () => { clearTimeout(t); t = setTimeout(fn, ms); }; };
    const obs = new MutationObserver(debounce(renderAllRows, 250));
    obs.observe(root, { childList: true, subtree: true });
    renderAllRows();
  }

  // Wait a tick so Torn's React has rendered first.
  setTimeout(boot, 800);
})();
