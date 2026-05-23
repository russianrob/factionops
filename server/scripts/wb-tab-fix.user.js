// ==UserScript==
// @name         Warboard Tab Fix (PDA Android GM redefine workaround)
// @namespace    tornwar.com
// @version      0.1.0
// @description  Fix Torn PDA Android's "Uncaught TypeError: Cannot redefine property: GM" bug that breaks all userscripts in any tab opened via window.open(url,'_blank') or <a target="_blank">. Patches both APIs to add noopener so the new tab gets a fresh top-level context and Tampermonkey can inject cleanly. Harmless no-op on iOS (WKWebView already isolates child WebContents); active fix on Android/Chromium WebView.
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
  log('installed v0.1.0');

  // ── Why this exists ─────────────────────────────────────────────────
  // PDA Android (Flutter InAppWebView, Chromium WebView) keeps the new
  // tab in the parent's BrowsingContext when window.open is called
  // without 'noopener'. Tampermonkey re-runs its bootstrap in the child
  // and tries to defineProperty(window, 'GM', ...) — but GM was already
  // defined non-configurable in the parent context, so the child throws
  // "Cannot redefine property: GM" and NO scripts inject in that tab.
  // The user has to force-quit PDA to recover.
  //
  // iOS WKWebView spawns each child in its own out-of-process WebContent
  // process so the same bug can't happen there. This fix is a no-op on
  // iOS — adding noopener to an already-isolated tab does nothing.

  // ── 1. Patch window.open ─────────────────────────────────────────────
  // Any call with target='_blank' that doesn't already specify noopener
  // gets noopener,noreferrer appended to the features string. Severs
  // the opener relationship → fresh context in the new tab → TM injects
  // cleanly. We preserve the original return value.
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

  // ── 2. Inject rel="noopener noreferrer" on _blank links/forms ───────
  // Anchors and forms can also open new tabs without going through
  // window.open. We catch them at click/submit capture-phase so we run
  // before the page or other scripts handle it — by the time the
  // navigation actually fires, the rel attribute is set.
  function ensureNoopener(el) {
    if (!el || el.__wbNoopenerSet) return;
    const tag = el.tagName;
    if (tag !== 'A' && tag !== 'AREA' && tag !== 'FORM') return;
    if ((el.target || '').toLowerCase() !== '_blank') return;
    const rel = String(el.rel || '').toLowerCase();
    const adds = [];
    if (!/\bnoopener\b/.test(rel)) adds.push('noopener');
    if (!/\bnoreferrer\b/.test(rel)) adds.push('noreferrer');
    if (adds.length) {
      el.rel = rel ? rel + ' ' + adds.join(' ') : adds.join(' ');
    }
    el.__wbNoopenerSet = true;
  }

  // capture=true so we run before page click handlers; passive=true
  // so we don't block the navigation.
  try {
    document.addEventListener('click', function (e) {
      try {
        const t = e.target;
        if (!t || !t.closest) return;
        const a = t.closest('a[target="_blank"], area[target="_blank"]');
        if (a) ensureNoopener(a);
      } catch (_) {}
    }, { capture: true, passive: true });

    document.addEventListener('submit', function (e) {
      try {
        const f = e.target;
        if (f && f.tagName === 'FORM' && (f.target || '').toLowerCase() === '_blank') {
          ensureNoopener(f);
        }
      } catch (_) {}
    }, { capture: true, passive: true });
  } catch (e) { log('listener-attach failed: ' + e.message); }

  // ── 3. Optional: passive sweep at DOMContentLoaded ──────────────────
  // Catches the common case where a script builds a link and synthetically
  // dispatches a click — our capture listener will fire first, but only
  // on real user clicks. Synthetic clicks may not bubble identically.
  // A single sweep on ready is cheap and protects most patterns.
  try {
    const sweep = () => {
      const els = document.querySelectorAll('a[target="_blank"], area[target="_blank"], form[target="_blank"]');
      for (const el of els) ensureNoopener(el);
    };
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', sweep, { once: true });
    } else {
      sweep();
    }
  } catch (_) {}
})();
