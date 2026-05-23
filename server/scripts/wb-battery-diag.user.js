// ==UserScript==
// @name         Warboard Battery Diag
// @namespace    tornwar.com
// @version      0.2.8
// @description  Live overlay of what's consuming CPU/network inside the WebView — fetch / XHR / GM_xhr counts by host + caller, mutation rate, setInterval handles, page nav rate. Diagnostic only, no side effects.
// @author       warboard
// @match        https://www.torn.com/*
// @downloadURL  https://tornwar.com/scripts/wb-battery-diag.user.js
// @updateURL    https://tornwar.com/scripts/wb-battery-diag.meta.js
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @run-at       document-start
// @connect      tornwar.com
// ==/UserScript==

(function () {
  'use strict';

  // 0.2.7 — bfcache / re-injection guard. PDA's WebView and Safari
  // keep pages in back-forward cache; on return the userscript runs
  // again but the previous script context lives on with its
  // setIntervals still firing. Without this guard the diag's OWN
  // nav-poll + post-loop accumulate to ×N visits, polluting the
  // "active intervals" count it was supposed to be measuring.
  try {
    if (window.__wbDiagInitialized) return;
    window.__wbDiagInitialized = true;
  } catch (_) {}

  // 0.1.1 — wrap each instrumentation step in try/catch so one
  // failure on a hardened WebView (PDA) doesn't kill the overlay.
  // Also log a marker so the user can verify the script loaded.
  console.log('[wb-diag] script loaded v0.1.1 — overlay will appear bottom-left when body is ready');
  function safe(label, fn) {
    try { fn(); } catch (e) { console.warn('[wb-diag] ' + label + ' failed:', e && e.message); }
  }

  // ── Stats state ─────────────────────────────────────────────────────
  const stats = {
    startTs:   Date.now(),
    fetch:     0,
    xhr:       0,
    gmxhr:     0,
    byHost:    Object.create(null),    // hostname → count
    byPath:    Object.create(null),    // host+normalized-path → count (0.2.8)
    bySource:  Object.create(null),    // script URL → count (network)
    mutations: 0,
    navs:      0,
    qsa:       0,
    qsaBySource:     Object.create(null),  // 0.2.3: script URL of IMMEDIATE qSA caller
    qsaByOriginator: Object.create(null),  // 0.2.5: script URL of OUTERMOST frame — blames the userscript that started the chain even when it triggered Torn helpers
    intervals: new Map(),              // handle → { ms, fn-summary }
    timeouts:  0,
    setIntervalCalls: 0,
  };

  // Caller attribution — pull the first non-self frame from a stack.
  // Tampermonkey/Stay/PDA userscripts show up in stacks with their
  // @downloadURL or a synthetic userscript:// URL. We strip noise and
  // bucket by that string so per-script blame is possible.
  function attributeCaller() {
    try {
      const stack = new Error().stack || '';
      const lines = stack.split('\n').slice(2);
      for (const line of lines) {
        const m = line.match(/(https?:\/\/[^\s):]+)|(userscript:[^\s):]+)|(file:\/\/[^\s):]+)/);
        if (m && m[0] && !m[0].includes('wb-battery-diag')) {
          // Strip line:col tail for grouping; keep filename.
          return m[0].replace(/:\d+:\d+$/, '').split('/').slice(-2).join('/').slice(0, 60);
        }
      }
    } catch (_) {}
    return 'unknown';
  }
  // 0.2.5: collect both immediate (innermost) and originator (outermost)
  // frames in one stack walk. Userscripts that trigger Torn helpers
  // were getting hidden under the helper's URL with attributeCaller
  // alone; the originator field surfaces them.
  function attributeBoth() {
    let immediate = null, outermost = null;
    try {
      const stack = new Error().stack || '';
      const lines = stack.split('\n').slice(2);
      for (const line of lines) {
        const m = line.match(/(https?:\/\/[^\s):]+)|(userscript:[^\s):]+)|(file:\/\/[^\s):]+)/);
        if (m && m[0] && !m[0].includes('wb-battery-diag')) {
          const cleaned = m[0].replace(/:\d+:\d+$/, '').split('/').slice(-2).join('/').slice(0, 60);
          if (!immediate) immediate = cleaned;
          outermost = cleaned;
        }
      }
    } catch (_) {}
    return { immediate: immediate || 'unknown', outermost: outermost || 'unknown' };
  }

  function bump(map, key) { map[key] = (map[key] || 0) + 1; }

  // 0.2.8: normalize URL path for byPath bucketing. Strips:
  //   - query string + hash (huge cardinality killer)
  //   - trailing numeric IDs (so /user/12345 collapses with /user/67890)
  //   - long hash-like UUID-ish segments
  // Result is host+canonical-path, e.g. "www.torn.com/sentry/api/N/envelope".
  function normalizeUrl(rawUrl) {
    try {
      const u = new URL(String(rawUrl), location.href);
      const segs = u.pathname.split('/').map(seg => {
        if (!seg) return seg;
        if (/^\d+$/.test(seg)) return 'N';                     // numeric ID
        if (/^[a-f0-9]{16,}$/i.test(seg)) return 'HASH';       // hex hash
        if (/^[0-9a-f-]{32,}$/i.test(seg)) return 'UUID';      // uuid-ish
        return seg;
      });
      return u.hostname + segs.join('/');
    } catch (_) {
      return String(rawUrl || '').slice(0, 80);
    }
  }

  // ── Network instrumentation (each wrapped so one failure is isolated) ─
  safe('fetch-wrap', () => {
    const origFetch = window.fetch;
    if (!origFetch) return;
    window.fetch = function patchedFetch(input, init) {
      stats.fetch++;
      try {
        const url = typeof input === 'string' ? input : input?.url || '';
        const host = new URL(url, location.href).hostname || '(relative)';
        bump(stats.byHost, host);
        bump(stats.byPath, normalizeUrl(url));
        bump(stats.bySource, attributeCaller());
      } catch (_) {}
      return origFetch.call(this, input, init);
    };
  });

  safe('xhr-wrap', () => {
    const origXhrOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function patchedOpen(method, url, ...rest) {
      stats.xhr++;
      try {
        const host = new URL(url, location.href).hostname || '(relative)';
        bump(stats.byHost, host);
        bump(stats.byPath, normalizeUrl(url));
        bump(stats.bySource, attributeCaller());
      } catch (_) {}
      return origXhrOpen.call(this, method, url, ...rest);
    };
  });

  safe('gm-xhr-wrap', () => {
    if (typeof GM_xmlhttpRequest !== 'function') return;
    const origGm = GM_xmlhttpRequest;
    window.GM_xmlhttpRequest = function patchedGm(opts) {
      stats.gmxhr++;
      try {
        const host = new URL(opts.url || '', location.href).hostname || '(relative)';
        bump(stats.byHost, host);
        bump(stats.byPath, normalizeUrl(opts.url || ''));
        bump(stats.bySource, attributeCaller());
      } catch (_) {}
      return origGm(opts);
    };
  });

  safe('timer-wrap', () => {
    const origSI = window.setInterval;
    window.setInterval = function patchedSI(fn, ms, ...args) {
      stats.setIntervalCalls++;
      const h = origSI.call(this, fn, ms, ...args);
      try {
        const summary = (typeof fn === 'function' ? fn.toString() : String(fn)).replace(/\s+/g, ' ').slice(0, 80);
        stats.intervals.set(h, { ms: Number(ms) || 0, fn: summary, caller: attributeCaller() });
      } catch (_) {}
      return h;
    };
    const origCI = window.clearInterval;
    window.clearInterval = function patchedCI(h) {
      stats.intervals.delete(h);
      return origCI.call(this, h);
    };
    const origST = window.setTimeout;
    window.setTimeout = function patchedST(...args) {
      stats.timeouts++;
      return origST.apply(this, args);
    };
  });

  safe('qsa-wrap', () => {
    // 0.2.5: bump BOTH immediate and originator maps per call. Single
    // Error.stack capture extracts both, so cost is the same as 0.2.3
    // but we gain the chain-originator view.
    const origQSA = Document.prototype.querySelectorAll;
    Document.prototype.querySelectorAll = function patchedQSA(...args) {
      stats.qsa++;
      try {
        const a = attributeBoth();
        bump(stats.qsaBySource,     a.immediate);
        bump(stats.qsaByOriginator, a.outermost);
      } catch (_) {}
      return origQSA.apply(this, args);
    };
    const origQSAE = Element.prototype.querySelectorAll;
    Element.prototype.querySelectorAll = function patchedQSAE(...args) {
      stats.qsa++;
      try {
        const a = attributeBoth();
        bump(stats.qsaBySource,     a.immediate);
        bump(stats.qsaByOriginator, a.outermost);
      } catch (_) {}
      return origQSAE.apply(this, args);
    };
  });

  safe('mut-observer', () => {
    function startMutObserver() {
      if (!document.body) return setTimeout(startMutObserver, 100);
      const obs = new MutationObserver(muts => { stats.mutations += muts.length; });
      obs.observe(document.body, { childList: true, subtree: true });
    }
    startMutObserver();
  });

  safe('nav-poll', () => {
    let lastUrl = location.href;
    setInterval(() => {
      if (location.href !== lastUrl) { stats.navs++; lastUrl = location.href; }
    }, 1000);
  });

  // ── Overlay UI ──────────────────────────────────────────────────────
  // 0.2.4 — collapsed state persists across page nav via localStorage.
  // Previously closing the panel only hid it for the current page;
  // next refresh popped it back open and the user had to close again.
  function getCollapsed() {
    try { return localStorage.getItem('wb-diag-collapsed') === '1'; } catch (_) { return false; }
  }
  function setCollapsed(v) {
    try { localStorage.setItem('wb-diag-collapsed', v ? '1' : '0'); } catch (_) {}
  }

  function buildOverlay() {
    if (!document.body) return setTimeout(buildOverlay, 200);
    if (document.getElementById('wb-diag')) return;
    const startCollapsed = getCollapsed();
    const wrap = document.createElement('div');
    wrap.id = 'wb-diag';
    wrap.style.cssText = `
      position: fixed; bottom: 10px; left: 10px;
      background: rgba(10,15,25,0.92); color: #d0e0ff;
      font: 11px/1.35 ui-monospace, "SF Mono", Menlo, monospace;
      padding: 8px 10px; border-radius: 6px;
      border: 1px solid #2a3a55;
      z-index: 2147483646;
      max-width: 340px; max-height: 60vh; overflow: auto;
      box-shadow: 0 4px 14px rgba(0,0,0,0.5);
      pointer-events: auto; user-select: text;
    `;
    wrap.innerHTML = '<div id="wb-diag-body">starting…</div>';
    if (startCollapsed) wrap.style.display = 'none';
    document.body.appendChild(wrap);

    // Toggle button — smaller pill to expand/collapse.
    const btn = document.createElement('div');
    btn.textContent = '🔋 diag';
    btn.style.cssText = `
      position: fixed; bottom: 10px; left: 10px;
      background: #e05070; color: #fff;
      font: 600 11px ui-monospace, "SF Mono", Menlo, monospace;
      padding: 5px 10px; border-radius: 999px;
      z-index: 2147483647; cursor: pointer;
      box-shadow: 0 2px 8px rgba(0,0,0,0.4);
      display: none;
    `;
    btn.addEventListener('click', () => {
      wrap.style.display = 'block';
      btn.style.display = 'none';
      setCollapsed(false);
    });
    if (startCollapsed) btn.style.display = 'block';
    document.body.appendChild(btn);

    // Header with collapse button
    const hdr = document.createElement('div');
    hdr.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;border-bottom:1px solid #2a3a55;padding-bottom:4px;';
    hdr.innerHTML = `<strong style="color:#ff7e9c">WB Battery Diag</strong>`;
    const close = document.createElement('span');
    close.textContent = '×';
    close.style.cssText = 'cursor:pointer;font-size:16px;line-height:1;padding:0 4px;color:#999;';
    close.addEventListener('click', () => { wrap.style.display = 'none'; btn.style.display = 'block'; setCollapsed(true); });
    const reset = document.createElement('span');
    reset.textContent = '↺';
    reset.style.cssText = 'cursor:pointer;font-size:14px;line-height:1;padding:0 6px;color:#999;';
    reset.addEventListener('click', () => {
      stats.startTs = Date.now();
      stats.fetch = stats.xhr = stats.gmxhr = stats.mutations = stats.navs = stats.qsa = stats.timeouts = stats.setIntervalCalls = 0;
      for (const k of Object.keys(stats.byHost)) delete stats.byHost[k];
      for (const k of Object.keys(stats.bySource)) delete stats.bySource[k];
    });
    const right = document.createElement('div');
    right.appendChild(reset);
    right.appendChild(close);
    hdr.appendChild(right);
    wrap.insertBefore(hdr, wrap.firstChild);

    setInterval(() => safe('overlay-refresh', refreshOverlay), 1000);
  }

  function refreshOverlay() {
    const body = document.getElementById('wb-diag-body');
    if (!body) return;
    const elapsedSec = Math.max(0.001, (Date.now() - stats.startTs) / 1000);
    const perMin = n => Number.isFinite(n) ? (n / elapsedSec * 60).toFixed(1) : '0';
    const topN = (obj, n) => Object.entries(obj || {}).sort((a, b) => (b[1] || 0) - (a[1] || 0)).slice(0, n);
    let activeIntervals = [];
    try { activeIntervals = [...stats.intervals.values()]; } catch (_) {}
    // 0.2.6: group by (caller, ms, fn-shortened) so "unknown" rows
    // get sub-grouped by the actual callback function source. That
    // lets us see e.g. "unknown @ 1000ms ×83 — fn: function tick(){...}"
    // instead of an unattributable bucket.
    const intByKey = {};
    let intervalHandles = activeIntervals.length;
    let intervalRatePerMin = 0;
    for (const i of activeIntervals) {
      const ms = Number(i && i.ms) || 0;
      if (ms > 0) intervalRatePerMin += (60000 / ms);
      const caller = (i && i.caller) || 'unknown';
      const fnShort = (i && i.fn) ? String(i.fn).slice(0, 60) : '';
      const key = caller + ' @ ' + ms + 'ms\n  ' + fnShort;
      intByKey[key] = (intByKey[key] || 0) + 1;
    }
    body.innerHTML = `
      <div style="margin-bottom:6px;color:#8ba">elapsed: ${elapsedSec.toFixed(0)}s</div>
      <div><strong>Network</strong> (/min):
        fetch <b>${perMin(stats.fetch)}</b> ·
        xhr <b>${perMin(stats.xhr)}</b> ·
        gmxhr <b>${perMin(stats.gmxhr)}</b>
      </div>
      <div style="color:#8ba;margin-top:3px;font-size:10px">top hosts:</div>
      ${topN(stats.byHost, 6).map(([h, n]) => `<div style="padding-left:6px">${h} <span style="color:#8ba">${n} (${perMin(n)}/m)</span></div>`).join('')}
      <div style="color:#8ba;margin-top:3px;font-size:10px">top callers:</div>
      ${topN(stats.bySource, 6).map(([s, n]) => `<div style="padding-left:6px">${s} <span style="color:#8ba">${n}</span></div>`).join('')}

      <div style="margin-top:6px"><strong>DOM</strong>:
        mutations <b>${perMin(stats.mutations)}</b>/m ·
        qSA <b>${perMin(stats.qsa)}</b>/m ·
        navs <b>${stats.navs}</b>
      </div>

      <div style="margin-top:6px"><strong>Timers</strong>:
        active intervals <b>${intervalHandles}</b> (~${intervalRatePerMin.toFixed(0)} fires/m) ·
        setInterval calls <b>${stats.setIntervalCalls}</b> ·
        setTimeout <b>${perMin(stats.timeouts)}</b>/m
      </div>
      <div style="color:#8ba;margin-top:3px;font-size:10px">active interval owners (caller / ms / fn-source):</div>
      ${Object.entries(intByKey).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([k, n]) => {
        const [head, ...rest] = k.split('\n');
        const fn = (rest.join(' ') || '').trim();
        const escFn = fn.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
        return `<div style="padding-left:6px;font-size:10px;line-height:1.3">${head} <span style="color:#8ba">×${n}</span>${fn ? `<br><span style="padding-left:14px;color:#666;font-family:ui-monospace,Menlo,monospace;font-size:9px">${escFn}</span>` : ''}</div>`;
      }).join('')}

      <div style="margin-top:8px;font-size:10px;color:#667">
        higher mutations/min ≈ more JS / repaint work.<br>
        higher gmxhr or fetch /min ≈ more network wake-ups.<br>
        many active intervals ≈ constant CPU even idle.
      </div>
    `;
  }

  // 0.1.1 — call buildOverlay in two places: now (in case body exists),
  // and on DOMContentLoaded as a backup. Both routes hit the same code
  // which is idempotent (only one element with id=wb-diag is created).
  safe('overlay-now', buildOverlay);
  if (document.addEventListener) {
    document.addEventListener('DOMContentLoaded', () => safe('overlay-domready', () => {
      if (!document.getElementById('wb-diag')) buildOverlay();
    }), { once: true });
  }

  // 0.2.0 — periodic POST of the current sample window to the server,
  // so the user can review later at https://tornwar.com/diag/battery
  // instead of watching the overlay live. Counters reset after each
  // send so each sample represents a discrete window. Uses
  // GM_xmlhttpRequest to bypass any page CSP restrictions; falls back
  // to plain fetch if GM_xhr isn't around. Fire-and-forget — failures
  // are silent so a server hiccup doesn't spam errors.
  const POST_INTERVAL_MS = 60 * 1000;
  let _windowStart = Date.now();
  safe('post-loop', () => {
    setInterval(() => safe('post-tick', () => {
      const windowSec = (Date.now() - _windowStart) / 1000;
      if (windowSec < 5) return;
      const payload = {
        windowSec,
        ua: navigator.userAgent || '',
        url: location.href || '',
        fetch:     stats.fetch,
        xhr:       stats.xhr,
        gmxhr:     stats.gmxhr,
        mutations: stats.mutations,
        qsa:       stats.qsa,
        navs:      stats.navs,
        timeouts:  stats.timeouts,
        intervalsActive: stats.intervals.size,
        byHost:          Object.assign({}, stats.byHost),
        byPath:          Object.assign({}, stats.byPath),
        bySource:        Object.assign({}, stats.bySource),
        qsaBySource:     Object.assign({}, stats.qsaBySource),     // 0.2.3: immediate
        qsaByOriginator: Object.assign({}, stats.qsaByOriginator), // 0.2.5: outermost
      };
      // Reset counters before send so next window starts clean. (Don't
      // reset interval handles — those are live.)
      _windowStart = Date.now();
      stats.fetch = stats.xhr = stats.gmxhr = stats.mutations = stats.qsa = stats.navs = stats.timeouts = 0;
      for (const k of Object.keys(stats.byHost)) delete stats.byHost[k];
      for (const k of Object.keys(stats.byPath)) delete stats.byPath[k];
      for (const k of Object.keys(stats.bySource)) delete stats.bySource[k];
      for (const k of Object.keys(stats.qsaBySource)) delete stats.qsaBySource[k];
      for (const k of Object.keys(stats.qsaByOriginator)) delete stats.qsaByOriginator[k];
      const body = JSON.stringify(payload);
      if (typeof GM_xmlhttpRequest === 'function') {
        // origGm intentionally — patched gmxhr would double-count this
        // very call in the next sample, which is misleading.
        GM_xmlhttpRequest({
          method: 'POST',
          url: 'https://tornwar.com/api/diag/battery',
          headers: { 'Content-Type': 'application/json' },
          data: body,
          timeout: 8000,
        });
      } else if (typeof fetch === 'function') {
        fetch('https://tornwar.com/api/diag/battery', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body
        }).catch(() => {});
      }
    }), POST_INTERVAL_MS);
  });
})();
