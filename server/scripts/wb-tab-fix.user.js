// ==UserScript==
// @name         Warboard Tab Fix (PDA Android GM redefine workaround)
// @namespace    tornwar.com
// @version      0.2.0
// @description  Workaround for Torn PDA Android's "Cannot redefine property: GM" bug, which kills all userscripts in any tab opened via window.open(url,'_blank') or <a target="_blank">. Root cause is PDA double-injecting Tampermonkey's GM bridge into newly-spawned WebViews; noopener doesn't help. This script intercepts new-tab opens on Android and redirects them to same-tab navigation (location.assign) so no new WebView spawns. iOS keeps the original new-tab behavior + adds noopener as a mild defense-in-depth measure.
// @author       warboard
// @match        https://www.torn.com/*
// @match        https://*.torn.com/*
// @downloadURL  https://tornwar.com/scripts/wb-tab-fix.user.js
// @updateURL    https://tornwar.com/scripts/wb-tab-fix.meta.js
// @grant        none
// @run-at       document-start
// @noframes
// ==/UserScript==

(function () {
  'use strict';
  if (window.__wbTabFixInstalled) return;
  window.__wbTabFixInstalled = true;

  const log = (m) => { try { console.log('[wb-tab-fix] ' + m); } catch (_) {} };

  // ── Platform detection ───────────────────────────────────────────────
  // Android Chromium WebView is the only platform with the GM-redefine
  // bug. iOS PDA uses WKWebView (out-of-process WebContent per tab) so
  // child tabs never share the parent's already-defined GM property.
  const UA = navigator.userAgent || '';
  const IS_ANDROID = /Android/i.test(UA);
  const IS_IOS = /(iPhone|iPad|iPod)/i.test(UA);

  log('installed v0.2.0 — UA platform: ' + (IS_ANDROID ? 'Android (active fix)' : IS_IOS ? 'iOS (noopener-only)' : 'other (noopener-only)'));

  if (IS_ANDROID) {
    // ── ANDROID: redirect new-tab opens to same-tab nav ──────────────
    // Don't spawn a new WebView at all — that's what triggers PDA's
    // double-injection of GM. Navigate the current tab instead, which
    // is the only known userland workaround until PDA fixes its
    // bootstrap order.
    //
    // Trade-off: users lose the "opens in new tab" UX (no back-button
    // to restore the panel they came from beyond standard browser
    // history). This is strictly worse UX but strictly better than
    // a dead tab where no scripts work.

    // 1) window.open
    try {
      const origOpen = window.open;
      window.open = function (url, target /*, features */) {
        if (target === '_blank' && url) {
          try {
            log('redirecting window.open(_blank) → location.assign for: ' + String(url).slice(0, 100));
            window.location.assign(url);
            return window; // best we can do — caller expects a WindowProxy
          } catch (e) {
            log('location.assign failed: ' + e.message + ' — falling back to original open');
          }
        }
        return origOpen.apply(this, arguments);
      };
    } catch (e) { log('open-patch failed: ' + e.message); }

    // 2) <a target="_blank"> and <area target="_blank"> clicks
    //    Capture phase so we run before page handlers; prevent the
    //    browser's new-tab navigation and do same-tab assign instead.
    const handleLinkClick = (e) => {
      try {
        const t = e.target;
        if (!t || !t.closest) return;
        const a = t.closest('a[target="_blank"], area[target="_blank"]');
        if (!a) return;
        // Respect modifier keys (Ctrl/Cmd-click): user explicitly wants
        // a new tab, let the browser handle it. They'll hit the bug but
        // that's their choice.
        if (e.ctrlKey || e.metaKey || e.shiftKey || e.button === 1) return;
        const href = a.getAttribute('href');
        if (!href || href === '#' || href.startsWith('javascript:')) return;
        e.preventDefault();
        e.stopPropagation();
        log('redirecting <a target=_blank> click → location.assign: ' + href.slice(0, 100));
        window.location.assign(href);
      } catch (_) {}
    };
    try {
      // Both pointerdown (fires earlier, before some custom handlers
      // can call preventDefault on click) and click (the actual nav
      // trigger). pointerdown alone isn't enough because we need to
      // stop the navigation; click alone is fine but pointerdown
      // catches earlier UX.
      document.addEventListener('click', handleLinkClick, { capture: true });
    } catch (e) { log('click-listener failed: ' + e.message); }

    // 3) <form target="_blank"> submits
    try {
      document.addEventListener('submit', (e) => {
        try {
          const f = e.target;
          if (f && f.tagName === 'FORM' && (f.target || '').toLowerCase() === '_blank') {
            // Easiest fix: change target to _self before submission.
            f.target = '_self';
            log('rewrote <form target=_blank> → _self');
          }
        } catch (_) {}
      }, { capture: true });
    } catch (e) { log('submit-listener failed: ' + e.message); }

    return; // Android path complete — skip the iOS noopener block
  }

  // ── iOS / other: noopener injection (defense-in-depth) ──────────────
  // Doesn't address the Android GM bug (that bug doesn't exist here),
  // but adds noopener as a mild security/perf nicety. Cheap to keep.
  try {
    const origOpen = window.open;
    if (typeof origOpen === 'function') {
      window.open = function (url, target, features) {
        try {
          if (target === '_blank') {
            const f = String(features || '');
            if (!/\bnoopener\b/i.test(f)) {
              features = f ? f + ',noopener,noreferrer' : 'noopener,noreferrer';
            }
          }
        } catch (_) {}
        return origOpen.call(this, url, target, features);
      };
    }
  } catch (e) { log('open-patch failed: ' + e.message); }

  function ensureNoopener(el) {
    if (!el || el.__wbNoopenerSet) return;
    const tag = el.tagName;
    if (tag !== 'A' && tag !== 'AREA' && tag !== 'FORM') return;
    if ((el.target || '').toLowerCase() !== '_blank') return;
    const rel = String(el.rel || '').toLowerCase();
    const adds = [];
    if (!/\bnoopener\b/.test(rel)) adds.push('noopener');
    if (!/\bnoreferrer\b/.test(rel)) adds.push('noreferrer');
    if (adds.length) el.rel = rel ? rel + ' ' + adds.join(' ') : adds.join(' ');
    el.__wbNoopenerSet = true;
  }

  try {
    document.addEventListener('click', (e) => {
      try {
        const t = e.target;
        if (!t || !t.closest) return;
        const a = t.closest('a[target="_blank"], area[target="_blank"]');
        if (a) ensureNoopener(a);
      } catch (_) {}
    }, { capture: true, passive: true });

    document.addEventListener('submit', (e) => {
      try {
        const f = e.target;
        if (f && f.tagName === 'FORM' && (f.target || '').toLowerCase() === '_blank') {
          ensureNoopener(f);
        }
      } catch (_) {}
    }, { capture: true, passive: true });
  } catch (_) {}
})();
