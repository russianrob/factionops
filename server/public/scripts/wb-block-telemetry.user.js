// ==UserScript==
// @name         Warboard Block Telemetry
// @namespace    tornwar.com
// @version      0.1.0
// @description  Block Torn PDA's bundled Sentry telemetry to cut WebView CPU + network wake-ups. Two-layer: stubs window.Sentry as a no-op proxy AND drops network calls matching Sentry beacon patterns. Logs block counts to a small overlay so you can verify it's working. Toggle off via Tampermonkey if anything misbehaves.
// @author       warboard
// @match        https://www.torn.com/*
// @downloadURL  https://tornwar.com/scripts/wb-block-telemetry.user.js
// @updateURL    https://tornwar.com/scripts/wb-block-telemetry.meta.js
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function () {
  'use strict';

  const stats = { sentryStub: 0, fetchBlocked: 0, xhrBlocked: 0, beaconBlocked: 0 };
  const log = msg => { try { console.log('[wb-block-telemetry] ' + msg); } catch (_) {} };
  log('script loaded v0.1.0');

  // ── Layer 1: stub window.Sentry as a no-op proxy ────────────────────
  // Defines a Proxy that returns itself for any property access and
  // returns itself when called/constructed. So Sentry.init() works,
  // Sentry.captureException() works, Sentry.withScope(cb) doesn't
  // crash — they all silently no-op. Defined as a non-writable
  // property so the real Sentry library's `window.Sentry = ...`
  // assignment in strict mode throws (caught by their own code) or
  // is silently ignored in sloppy mode.
  try {
    const noop = function () { return proxy; };
    var proxy = new Proxy(noop, {
      get(_t, prop) {
        // Counter for visibility
        if (typeof prop === 'string' && prop !== 'then' && prop !== 'Symbol(Symbol.toPrimitive)') {
          stats.sentryStub++;
        }
        return proxy;
      },
      apply()    { stats.sentryStub++; return proxy; },
      construct(){ stats.sentryStub++; return proxy; },
    });
    Object.defineProperty(window, 'Sentry', {
      get() { return proxy; },
      set() { /* silently swallow assignments from sentry-*.min.js */ },
      configurable: false,
    });
    log('Sentry stubbed');
  } catch (e) { log('Sentry stub failed: ' + e.message); }

  // ── Layer 2: drop network calls matching telemetry patterns ─────────
  // URL patterns conservative on purpose — only block what's clearly
  // Sentry/analytics so we don't accidentally kill Torn functionality.
  const URL_BLOCK = [
    /\/api\/\d+\/(envelope|store|security)\/?/i, // standard Sentry beacon paths
    /\bsentry\.io\b/i,                            // direct sentry.io ingest
    /\bingest\.[a-z0-9.-]+\.sentry\.io\b/i,       // regional ingests
    /\/sentry[\/?]/i,                             // any /sentry/ subpath on torn.com (their proxy)
    /\/sentry-\d+\.\d+\.\d+\.min\.js$/i,          // wouldn't normally be fetched again, but defensive
    /\bgoogle-analytics\.com\b/i,                 // also bundled, also pointless on PDA
    /\/collect(\?|$)/i,                           // GA collect endpoint
  ];
  function shouldBlockUrl(url) {
    if (!url) return false;
    const s = String(url);
    for (const re of URL_BLOCK) if (re.test(s)) return true;
    // Also block if stack trace shows the call came from a sentry script.
    try {
      const stack = new Error().stack || '';
      if (/\bsentry[-/]\d+\.\d+\.\d+\.min\.js\b/i.test(stack)) return true;
    } catch (_) {}
    return false;
  }

  // fetch
  try {
    const origFetch = window.fetch;
    if (origFetch) {
      window.fetch = function patchedFetch(input, init) {
        try {
          const url = typeof input === 'string' ? input : input?.url || '';
          if (shouldBlockUrl(url)) {
            stats.fetchBlocked++;
            return Promise.resolve(new Response('', { status: 200, statusText: 'OK (blocked)' }));
          }
        } catch (_) {}
        return origFetch.call(this, input, init);
      };
      log('fetch wrapped');
    }
  } catch (e) { log('fetch wrap failed: ' + e.message); }

  // XMLHttpRequest — drop send() on blocked URLs after open() redirected.
  try {
    const origOpen = XMLHttpRequest.prototype.open;
    const origSend = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.open = function patchedOpen(method, url, ...rest) {
      try { if (shouldBlockUrl(url)) this._wbBlocked = true; } catch (_) {}
      return origOpen.call(this, method, url, ...rest);
    };
    XMLHttpRequest.prototype.send = function patchedSend(...args) {
      if (this._wbBlocked) { stats.xhrBlocked++; return; }
      return origSend.apply(this, args);
    };
    log('XHR wrapped');
  } catch (e) { log('XHR wrap failed: ' + e.message); }

  // navigator.sendBeacon — common alt-path for telemetry that fires on
  // page unload. Trivially blockable.
  try {
    if (navigator && typeof navigator.sendBeacon === 'function') {
      const origBeacon = navigator.sendBeacon.bind(navigator);
      navigator.sendBeacon = function patchedBeacon(url, data) {
        if (shouldBlockUrl(url)) { stats.beaconBlocked++; return true; }
        return origBeacon(url, data);
      };
      log('sendBeacon wrapped');
    }
  } catch (e) { log('sendBeacon wrap failed: ' + e.message); }

  // ── Small overlay so you can SEE that blocking is working ───────────
  function buildOverlay() {
    if (!document.body) return setTimeout(buildOverlay, 200);
    if (document.getElementById('wb-block')) return;
    const el = document.createElement('div');
    el.id = 'wb-block';
    el.style.cssText = `
      position: fixed; bottom: 10px; right: 10px;
      background: rgba(10,15,25,0.88); color: #d0e0ff;
      font: 10px/1.3 ui-monospace, "SF Mono", Menlo, monospace;
      padding: 5px 8px; border-radius: 5px;
      border: 1px solid #2a3a55;
      z-index: 2147483645; pointer-events: auto; user-select: text;
      cursor: pointer;
    `;
    el.title = 'Tap to expand/collapse — Warboard Block Telemetry counts';
    el.textContent = 'blk: 0';
    let expanded = false;
    el.addEventListener('click', () => { expanded = !expanded; refresh(); });
    document.body.appendChild(el);
    function refresh() {
      const total = stats.fetchBlocked + stats.xhrBlocked + stats.beaconBlocked;
      if (!expanded) { el.textContent = '⛔ ' + total; return; }
      el.textContent = `⛔ blocked\nfetch: ${stats.fetchBlocked}\nxhr: ${stats.xhrBlocked}\nbeacon: ${stats.beaconBlocked}\nSentry calls swallowed: ${stats.sentryStub}`;
      el.style.whiteSpace = 'pre';
    }
    setInterval(refresh, 2000);
    refresh();
  }
  if (document.body) buildOverlay();
  else document.addEventListener('DOMContentLoaded', buildOverlay, { once: true });
})();
