// ==UserScript==
// @name         Warboard Tab Fix (PDA Android GM redefine workaround)
// @namespace    tornwar.com
// @version      0.3.0
// @description  Suppress "Cannot redefine property: GM" errors on Torn PDA Android caused by PDA double-injecting userscript bundles into the same page. Patches Object.defineProperty at document-start so the second GM redefine silently no-ops instead of throwing — downstream scripts then continue past the failure point. Also logs run counts + suppressed redefines to console so you can see what's happening.
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

  // Counters survive between PDA's double-injections because window
  // persists across them (same page, same global). Tracking runs
  // here is what proves the double-inject theory in the console.
  if (!window.__wbTabFix) {
    window.__wbTabFix = {
      version: '0.3.0',
      startTs: Date.now(),
      runs: 0,
      gmSuppressed: 0,
      gmAttempted: 0,
      errors: [],
    };
  }
  const state = window.__wbTabFix;
  state.runs++;
  const myRun = state.runs;
  const elapsed = Date.now() - state.startTs;

  const log = (m) => { try { console.log('[wb-tab-fix] ' + m); } catch (_) {} };
  log('run #' + myRun + ' at +' + elapsed + 'ms — UA: ' + (navigator.userAgent || '').slice(0, 80));

  // Subsequent runs of THIS script just bump the counter; the
  // defineProperty patch from run 1 is already in place.
  if (myRun > 1) {
    log('subsequent run — patch already installed; state: runs=' + state.runs + ' suppressed=' + state.gmSuppressed + ' attempted=' + state.gmAttempted);
    return;
  }

  // ── 1. Suppress GM redefine errors ──────────────────────────────────
  // Root cause: PDA Android invokes the userscript bundle twice per page
  // load. TM's bootstrap calls Object.defineProperty(window, 'GM',
  // { configurable: false, ... }) on each invocation. The second call
  // throws "Cannot redefine property: GM" — and that thrown error
  // cascades: dependent grants (GM_addStyle, etc.) never re-initialize,
  // and any script that imported a TM-sourced symbol fails.
  //
  // Patch: intercept defineProperty. If the target already has the
  // property AND it's a known TM-injected name (GM, GM_*, unsafeWindow),
  // silently return without re-defining. The window's existing GM (from
  // run 1) stays intact, TM's run-2 bootstrap continues past the
  // "successful" return, downstream userscripts work.
  try {
    const TM_PROPS = /^(GM|GM_|unsafeWindow$)/;

    const origDefine = Object.defineProperty;
    Object.defineProperty = function patchedDefine(target, prop, descriptor) {
      try {
        if (target === window && typeof prop === 'string' && TM_PROPS.test(prop)) {
          state.gmAttempted++;
          if (Object.prototype.hasOwnProperty.call(target, prop)) {
            state.gmSuppressed++;
            // Don't log every suppression — could be very chatty if many
            // GM_* props get re-defined. Log first one of each prop only.
            const k = '__wbLogged_' + prop;
            if (!state[k]) {
              state[k] = true;
              log('suppressed redefine of window.' + prop + ' (already exists from run 1) — protects against PDA double-inject');
            }
            return target;
          }
        }
      } catch (_) {}
      return origDefine.apply(this, arguments);
    };

    const origDefines = Object.defineProperties;
    if (typeof origDefines === 'function') {
      Object.defineProperties = function patchedDefines(target, props) {
        if (target === window && props && typeof props === 'object') {
          try {
            // Strip TM-named props that already exist; let the rest through
            const cleaned = {};
            let stripped = 0;
            for (const k of Object.keys(props)) {
              if (TM_PROPS.test(k) && Object.prototype.hasOwnProperty.call(target, k)) {
                state.gmAttempted++;
                state.gmSuppressed++;
                stripped++;
                continue;
              }
              cleaned[k] = props[k];
            }
            if (stripped > 0) {
              log('Object.defineProperties: stripped ' + stripped + ' TM redefine(s)');
            }
            return origDefines.call(this, target, cleaned);
          } catch (_) {}
        }
        return origDefines.apply(this, arguments);
      };
    }
    log('defineProperty patch installed');
  } catch (e) {
    log('defineProperty patch failed: ' + e.message);
  }

  // ── 2. Capture window errors for visibility ──────────────────────────
  try {
    window.addEventListener('error', function (e) {
      const msg = String((e && e.message) || '');
      if (/Cannot redefine|\bGM\b|GM_|Tampermonkey/i.test(msg)) {
        state.errors.push({
          ts: Date.now() - state.startTs,
          msg: msg.slice(0, 200),
          src: (e.filename || '').slice(-60),
          line: e.lineno || 0,
        });
        if (state.errors.length <= 5) {
          log('error #' + state.errors.length + ' captured: ' + msg + ' @ ' + (e.filename || '?') + ':' + (e.lineno || '?'));
        }
      }
    }, true);
  } catch (_) {}

  // ── 3. Diagnostic helper — call wbTabFixDump() in console anytime ─
  try {
    window.wbTabFixDump = function () {
      console.log('[wb-tab-fix] DIAG DUMP:', JSON.parse(JSON.stringify(state)));
      console.log('[wb-tab-fix] page lifetime: ' + (Date.now() - state.startTs) + 'ms');
      console.log('[wb-tab-fix] window.GM type: ' + typeof window.GM);
      console.log('[wb-tab-fix] window.GM_addStyle type: ' + typeof window.GM_addStyle);
      console.log('[wb-tab-fix] unsafeWindow type: ' + typeof window.unsafeWindow);
      return state;
    };
  } catch (_) {}

  // ── 4. Lightweight summary dump after page settles ──────────────────
  // Fires once 8s after first run so the typical double-inject + initial
  // userscript activity is captured. The result paints the full picture
  // in one console line.
  try {
    setTimeout(function () {
      log('SUMMARY after +' + (Date.now() - state.startTs) + 'ms: runs=' + state.runs +
          ' gmAttempted=' + state.gmAttempted +
          ' gmSuppressed=' + state.gmSuppressed +
          ' errorsCaptured=' + state.errors.length +
          ' GM=' + typeof window.GM +
          ' GM_addStyle=' + typeof window.GM_addStyle);
    }, 8000);
  } catch (_) {}
})();
