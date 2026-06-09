// ==UserScript==
// @name         FFS Banner Estimates
// @namespace    tornwar.com
// @match        https://www.torn.com/*
// @version      2.73.30
// @author       rDacted, Weav3r, xentac, Glasnost (fork by RussianRob)
// @description  FFS banner fork — paints estimated stats on the profile name banner using FFScouter data. Based on FF Scouter V2 (2.73, GPL-3.0).
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_listValues
// @grant        GM_deleteValue
// @grant        GM_registerMenuCommand
// @grant        GM_addStyle
// @connect      ffscouter.com
// @connect      tornwar.com
// @license      GPL-3.0
// @downloadURL  https://tornwar.com/scripts/ffs-banner-estimates.user.js
// @updateURL    https://tornwar.com/scripts/ffs-banner-estimates.meta.js
// ==/UserScript==

// =============================================================================
// FFS BANNER ESTIMATES — CHANGELOG
// =============================================================================
// Upstream: FF Scouter V2 (GPL-3.0, rDacted/Weav3r/xentac/Glasnost)
//   https://greasyfork.org/en/scripts/535292
//
// 2.73.0-wb18 — Travel countdown fixes: wb17 diag on /factions.php?step=your
//              returned zero faction IDs and zero rows. Two fixes:
//              1. Own-faction-id resolver — when on step=your the URL
//                 has no ID=, so call /v2/user?selections=basic via the
//                 configured FFS key (one-shot, cached).
//              2. Broader row selectors using [class*='members-list' i]
//                 etc. to catch Torn's React-mangled class names.
//              Also: poll diag now reports ownFactionResolved and a
//              sample of matched list-like elements for further fixes.
// 2.73.0-wb17 — Diagnose + broaden wb16 travel countdown: user reports
//              status still says 'Traveling'. Added ffs-travel-diag posts
//              at init, each poll, each fetch outcome, and each paint
//              cycle (first 20 only). Also broadened faction-id detection
//              (React mangled class names vary) and status-cell selector
//              fallback to [class*='status' i].
// 2.73.0-wb16 — New: replace "Traveling" status text on war.php and
//              factions.php member lists with a live HH:MM:SS countdown
//              to arrival, prefixed with a plane icon + country
//              abbreviation (e.g. ✈ UK  02:14:37). Uses Torn's own
//              v2 /faction/{id}/members endpoint (status.until provides
//              the landing UNIX time). Polls every 30s per visible
//              faction, ticks every 1s for the countdown repaint.
//              Restores the original status HTML when a member lands.
// 2.73.0-wb15 — New: travel arrival estimator on profile pages. Ported
//              from the modded FFS variant (greasyfork 537486). When a
//              target is travelling, calls ffscouter.com's player-flights
//              endpoint and paints live TCT countdown + arrival window
//              + travel method + fuel-book icon into the 'Traveling to X'
//              description. Tiks every second. Requires the same FFS
//              key already configured in Settings.
// 2.73.0-wb14 — New: FFS sort button on war.php + factions.php member
//              lists. Mirrors BSP's "BSP" sort button UX — click once
//              for strongest→weakest, click again to flip. Sort key is
//              FFS bs_estimate with FF score as fallback; rows missing
//              any FFS data sink to the bottom. Button auto-injects on
//              page load via a 15s polling probe so it works on Torn's
//              late-rendered React lists.
// 2.73.0-wb13 — XID injection for page-subject honor: wb12 force-paint
//              worked in theory but apply_ff_gauge's internal resolver
//              expected player_id to come from a descendant anchor. On
//              individual /profiles.php?XID=… pages the honor element
//              has no profile-link inside (subject is the page owner).
//              Now we inject a hidden anchor with the URL XID just
//              before calling apply_ff_gauge so the resolver finds it.
//              Marked with data-ffs-fork-inject so it's traceable.
// 2.73.0-wb12 — Force-paint retry: wb11 probes proved the profile page
//              DOES have a .honor-text-wrap (rendered between 0s and 1s
//              by React), but the upstream MutationObserver wasn't
//              catching it. Each delayed probe (1s/3s/10s) now also
//              scans for any .honor-text-wrap missing our
//              .ff-scouter-indicator class and paints it directly via
//              apply_ff_gauge. Closes the gap between late-rendered
//              honors and the paint path.
// 2.73.0-wb11 — Delayed probes: wb10 init probe on the individual profile
//              page reported 0 honor elements AND 0 name elements — the
//              React tree hadn't hydrated yet at script-execution time.
//              Now probes at init + 1s + 3s + 10s, tagged so we can see
//              when honor finally renders and what it's called. Also
//              added nameSample to capture profile-name-wrapper selectors
//              as an alternative injection point if the honor display
//              really is absent on /profiles.php?XID=….
// 2.73.0-wb10 — Init probe diagnostic: user reports NO FFS arrow + no chip
//              on individual /profiles.php?XID=… pages. That means FFS
//              itself isn't painting there (not our fork's bug). Added
//              a one-shot 'ffs-banner-init' POST on every page load
//              reporting URL, honor-text-wrap count, honorWrap count,
//              and the first 12 honor-classed element selectors. Lets
//              us see on the server side whether the script reaches
//              profile pages at all and what honor structure lives there.
// 2.73.0-wb9 — Overflow-visible fix: overlay chip showed on faction
//              list / lookup pages but was clipped on individual profile
//              pages (/profiles.php?XID=…) because the honor-bar
//              container there has overflow:hidden. Now when we attach
//              the .ff-scouter-indicator class we also force
//              overflow:visible on both the honor-text-wrap and its
//              immediate parent (.honorWrap on profile pages). Chip
//              should now be visible everywhere FFS paints its arrow.
// 2.73.0-wb8 — Overlay style per user request ('overlap like BSP does').
//              Chip is now position:absolute anchored to the bottom-center
//              of .honor-text-wrap (which is already position:relative via
//              .ff-scouter-indicator). The chip sits half-over, half-under
//              the bottom edge of the honor image — identical visual
//              pattern to BSP's TDup_BSPProfileInjection overlay.
//              z-index:5 + text-shadow so it reads clearly over any honor
//              image. pointer-events:none so it doesn't hijack hover on
//              the honor. Diag now reports estOverlayCount separately.
// 2.73.0-wb7 — Visibility fix: wb3-6 appended the chip as a CHILD of
//              .honor-text-wrap, which is sized to fit only the 20px
//              arrow and overflow-clips anything beyond. Chip was in
//              the DOM but invisible (diagnostics confirmed 49 chips
//              created on a 70-member faction page, user saw none).
//              Now inserts as a FOLLOWING SIBLING of the honor-text-wrap
//              so the chip flows in the parent's layout next to the
//              honor image. Also bumped opacity 0.55 → 0.65 and added
//              z-index:2 for layering above adjacent Torn styling.
// 2.73.0-wb6 — Remote diagnostics channel: script now also POSTs each
//              honor-bar paint attempt to https://tornwar.com/api/debug/
//              client-log tagged 'ffs-banner-diag'. Server logs via pm2
//              so dev can grep the actual cache shape and DOM counts
//              without the user pasting console output. Rate-limited to
//              50 posts per session and only fires in the first 5 min
//              post-page-load. Added @connect tornwar.com for the
//              GM_xmlhttpRequest permission.
// 2.73.0-wb5 — Diagnostics: wb4 still shows nothing for the user because
//              (a) they don't have BSP installed so the localStorage
//              fallback finds nothing and (b) ffscouter.com isn't
//              returning bs_estimate / bs_estimate_human for their
//              targets. Added console.log every time show_cached_values
//              paints a honor bar, dumping the full FFS cached object
//              + whether BSP localStorage had anything. This lets us
//              see EXACTLY what the ffcache holds and decide the next
//              fallback (likely: compute target ≈ user_total / ff if
//              neither source has an estimate).
// 2.73.0-wb4 — Cross-reference fallback: wb3 only showed the chip when
//              FFS returned bs_estimate_human, which is a premium-tier
//              field that's missing for most targets. Now chip resolves
//              from 3 sources in priority order:
//                1) FFS bs_estimate_human (if present)
//                2) FFS bs_estimate raw (formatted as short-form kmb)
//                3) BSP's TDup.battleStatsPredictor.cache.prediction.<id>
//                   (read from localStorage — same data BSP displays on
//                   the honor bar, so wherever BSP shows a number, we do)
//              Chip tooltip reveals which source fed it.
// 2.73.0-wb3 — Correction: user clarified the 'banner' is the HONOR BAR
//              strip, not above the name. Removed the name-banner
//              injection (wb1/wb2) entirely. Instead: show_cached_values
//              now stamps the bs_estimate_human as a compact black chip
//              next to the FF arrow inside the honor-text-wrap. The
//              chip appears on every honor bar the script already
//              decorates (profile page, faction members list, attack
//              page, competition page — anywhere FFS paints its arrow).
// 2.73.0-wb2 — Fix: wb1's .buttons-wrap target was below the name banner
//              and on some layouts didn't exist at all. Now probes multiple
//              selectors (user-information, profile-wrapper, etc.) and
//              injects at the TOP of the match so the badge sits next to
//              the name. Also handles SPA navigation (XID change →
//              wipe + repaint) and logs via ffdebug when no cached
//              data is available, to make "I don't see it" debuggable.
// 2.73.0-wb1 — New: paint FFS estimated stats on the profile name banner
//              (right below .buttons-wrap, same slot BSP uses via
//              TDup_BSPProfileInjection). Reads from the FFS IndexedDB
//              cache like the rest of the script — no extra API calls.
//              Shows: Est. Stats value · FF score · difficulty · age when
//              stale. Safe no-op when FFS has no cached data for the user.
// =============================================================================


// 2026-05-23 (wb62) — PDA Android polyfill. Tampermonkey's grant injection
// occasionally fails to bind GM_addStyle / GM_setValue / etc as local
// variables in the script scope, causing 'ReferenceError: GM_addStyle is
// not defined' at script start (xentac repro on moto g stylus, Android 12).
// When the bare GM_xxx identifier isn't found in any scope, JS falls back
// to the global object — so defining window.GM_xxx makes the bare call
// resolve cleanly. If TM did bind the local var, our polyfill is shadowed
// and ignored. Skipped GM_xmlhttpRequest (needs cross-origin semantics
// fetch can't reliably emulate inside a WebView).
(function () {
  const w = (typeof unsafeWindow !== 'undefined') ? unsafeWindow : window;
  if (typeof w.GM_addStyle !== 'function') {
    w.GM_addStyle = function (css) {
      const s = document.createElement('style');
      s.textContent = String(css || '');
      (document.head || document.documentElement).appendChild(s);
      return s;
    };
  }
  if (typeof w.GM_setValue !== 'function') {
    w.GM_setValue = function (k, v) { try { localStorage.setItem('ts:' + k, JSON.stringify(v)); } catch (_) {} };
  }
  if (typeof w.GM_getValue !== 'function') {
    w.GM_getValue = function (k, d) {
      try { const raw = localStorage.getItem('ts:' + k); return raw == null ? d : JSON.parse(raw); }
      catch (_) { return d; }
    };
  }
  if (typeof w.GM_deleteValue !== 'function') {
    w.GM_deleteValue = function (k) { try { localStorage.removeItem('ts:' + k); } catch (_) {} };
  }
  if (typeof w.GM_listValues !== 'function') {
    w.GM_listValues = function () {
      const out = [];
      try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith('ts:')) out.push(k.slice(3)); } } catch (_) {}
      return out;
    };
  }
  if (typeof w.GM_info !== 'object' || !w.GM_info) {
    w.GM_info = { script: { name: 'ffs-banner-estimates', version: '2.73.1-wb62' }, scriptHandler: 'polyfill' };
  }
})();

const FF_VERSION = "2.73";
const API_INTERVAL = 30000;
// wb63 (2026-05-24): prefer Torn's server-synced clock via
// window.getCurrentTimestamp() so travel + hospital countdowns match
// Torn's own UI tick-for-tick — no drift from a wrong device clock.
// Defensive: handles sec/ms shapes, falls back to Date.now()/1000 if
// Torn's React bundle hasn't loaded yet.
function ffs_nowSec() {
  try {
    const w = (typeof unsafeWindow !== 'undefined') ? unsafeWindow : window;
    if (typeof w.getCurrentTimestamp === 'function') {
      const t = w.getCurrentTimestamp();
      if (Number.isFinite(t)) {
        if (t > 1e12) return Math.floor(t / 1000);
        if (t > 1e9)  return Math.floor(t);
      }
    }
  } catch (_) {}
  return Math.floor(Date.now() / 1000);
}

// wb78: server time in FLOAT seconds (sub-second precision when Torn's
// getCurrentTimestamp returns ms). Pair with Math.round so the countdown
// matches Torn / War-Stuff-Enhanced timing instead of reading ~0.5s high from
// flooring (until - floor(now) shows the ceiling).
function ffs_nowSecFloat() {
  try {
    const w = (typeof unsafeWindow !== 'undefined') ? unsafeWindow : window;
    if (typeof w.getCurrentTimestamp === 'function') {
      const t = w.getCurrentTimestamp();
      if (Number.isFinite(t)) {
        if (t > 1e12) return t / 1000;   // ms → float seconds
        if (t > 1e9)  return t;          // already seconds
      }
    }
  } catch (_) {}
  return Date.now() / 1000;
}
const FF_TARGET_STALENESS = 24 * 60 * 60 * 1000; // Refresh the target list every day
const TARGET_KEY = "ffscouterv2-targets";
const TARGET_INDEX_KEY = "ffscouterv2-target-index";
const CLEARED_TSC_KEY = "ffscouterv2-cleared-tsc-keys";
const CHECK_KEY_CACHE_KEY = "ffscouterv2-check-key-cache";
const CHECK_KEY_INTERVAL = 15 * 60 * 1000;
const memberCountdowns = {};
const MAX_REQUESTS_PER_MINUTE = 20;
let apiCallInProgressCount = 0;
let currentUserId = null;

const TOAST_ERROR = "error";
const TOAST_LOG = "log";

let singleton = document.getElementById("ff-scouter-run-once");
if (!singleton) {
  console.log(`[FF Scouter V2] FF Scouter version ${FF_VERSION} starting`);
  // wb16: CSS for the travel-countdown status badge on member lists.
  GM_addStyle(`
    .ffs-travel-status {
      display: inline-flex; align-items: center; gap: 2px;
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
      font-size: 11px;
      max-width: 100%;
      cursor: pointer;
      user-select: none;
    }
    .ffs-travel-status:hover { filter: brightness(1.2); }
    .ffs-travel-status .ffs-plane {
      width: 10px; height: 10px; fill: currentColor; flex-shrink: 0;
    }
    .ffs-travel-status.returning .ffs-plane { transform: scaleX(-1); }
    /* wb38: mini-profile countdown chip — same SVG plane, sized to match
       surrounding text so it no longer clips against the card's header. */
    .ffs-mini-countdown .ffs-plane {
      width: 10px; height: 10px; fill: currentColor;
      vertical-align: -1px;
    }
    /* wb29: default shows countdown; click toggles to country name. */
    .ffs-travel-status .ffs-mq-value { white-space: nowrap; }
    .status:has(.ffs-travel-status) { overflow: hidden; white-space: nowrap; }
    /* wb76: hospital / jail release timer renders INLINE in place of the native
       status text (like Torn War Stuff Enhanced) — no badge/pill — while staying
       a clickable link to the attack page. Inherits the status cell's colour so
       it matches Torn's native styling (red for hospital, etc.). */
    .ffs-hosp-status {
      color: inherit;
      font: inherit;
      text-decoration: none;
      cursor: pointer;
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
    }
    .ffs-hosp-status:hover { text-decoration: underline; }
    .ffs-hosp-status.imminent { color: #ff5252; font-weight: 700; }
    .status:has(.ffs-hosp-status) { overflow: hidden; white-space: nowrap; }
    /* wb63: hide online/offline activity filter (war page) */
    .ffs-hidden { display: none !important; }
    .ffs-hide-bar {
      display: flex; align-items: center; gap: 14px;
      padding: 5px 10px; margin: 4px 0; border-radius: 4px;
      background: rgba(20, 22, 28, .55); color: #cbd5e1;
      font-size: 12px; user-select: none;
    }
    .ffs-hide-bar label { display: inline-flex; align-items: center; gap: 5px; cursor: pointer; }
    .ffs-hide-bar input { margin: 0; cursor: pointer; }
    .ffs-hide-bar .ffs-hide-count { margin-left: auto; opacity: .7; font-size: 11px; }
  `);
  GM_addStyle(`
            .ff-scouter-indicator {
            position: relative;
            display: block;
            padding: 0;
            }

            .ff-scouter-vertical-line-low-upper,
            .ff-scouter-vertical-line-low-lower,
            .ff-scouter-vertical-line-high-upper,
            .ff-scouter-vertical-line-high-lower {
            content: '';
            position: absolute;
            width: 2px;
            height: 30%;
            background-color: black;
            margin-left: -1px;
            }

            .ff-scouter-vertical-line-low-upper {
            top: 0;
            left: calc(var(--arrow-width) / 2 + 33 * (100% - var(--arrow-width)) / 100);
            }

            .ff-scouter-vertical-line-low-lower {
            bottom: 0;
            left: calc(var(--arrow-width) / 2 + 33 * (100% - var(--arrow-width)) / 100);
            }

            .ff-scouter-vertical-line-high-upper {
            top: 0;
            left: calc(var(--arrow-width) / 2 + 66 * (100% - var(--arrow-width)) / 100);
        }

            .ff-scouter-vertical-line-high-lower {
            bottom: 0;
            left: calc(var(--arrow-width) / 2 + 66 * (100% - var(--arrow-width)) / 100);
            }

            .ff-scouter-ff-visible {
              display: flex !important;
            }

            .ff-scouter-ff-hidden {
              display: none !important;
            }

            .ff-scouter-est-visible {
              display: flex !important;
            }

            .ff-scouter-est-hidden {
              display: none !important;
            }

            .ff-scouter-arrow {
            position: absolute;
            transform: translate(-50%, -50%);
            padding: 0;
            top: 0;
            left: calc(var(--arrow-width) / 2 + var(--band-percent) * (100% - var(--arrow-width)) / 100);
            width: var(--arrow-width);
            object-fit: cover;
            pointer-events: none;
            }

            .last-action-row {
                font-size: 11px;
                color: inherit;
                font-style: normal;
                font-weight: normal;
                text-align: center;
                margin-left: 8px;
                margin-bottom: 2px;
                margin-top: -2px;
                display: block;
            }
            .travel-status {
                display: flex;
                align-items: center;
                justify-content: flex-end;
                gap: 2px;
                min-width: 0;
                overflow: hidden;
            }
            .torn-symbol {
                width: 16px;
                height: 16px;
                fill: currentColor;
                vertical-align: middle;
                flex-shrink: 0;
            }
            .plane-svg {
                width: 14px;
                height: 14px;
                fill: currentColor;
                vertical-align: middle;
                flex-shrink: 0;
            }
            .plane-svg.returning {
                transform: scaleX(-1);
            }
            .country-abbr {
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
                min-width: 0;
                flex: 0 1 auto;
                vertical-align: bottom;
            }

            /* FF Scouter CSS Variables */
            body {
                --ff-bg-color: #f0f0f0;
                --ff-alt-bg-color: #fff;
                --ff-border-color: #ccc;
                --ff-input-color: #ccc;
                --ff-text-color: #000;
                --ff-hover-color: #ddd;
                --ff-glow-color: #4CAF50;
                --ff-success-color: #4CAF50;
            }

            body.dark-mode {
                --ff-bg-color: #333;
                --ff-alt-bg-color: #383838;
                --ff-border-color: #444;
                --ff-input-color: #504f4f;
                --ff-text-color: #ccc;
                --ff-hover-color: #555;
                --ff-glow-color: #4CAF50;
                --ff-success-color: #4CAF50;
            }

            .ff-settings-accordion {
                margin: 10px 0;
                padding: 10px;
                background-color: var(--ff-bg-color);
                border: 1px solid var(--ff-border-color);
                border-radius: 5px;
            }

            .ff-settings-accordion summary {
                cursor: pointer;
            }

            .ff-settings-accordion div.ff-settings-body {
              margin-top: 10px;
            }

            .ff-settings-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-top: 10px;
                margin-bottom: 10px;
                font-size: 1.2em;
                font-weight: bold;
                color: var(--ff-text-color);
            }

            .ff-settings-header-username {
                display: inline;
                font-style: italic;
                color: var(--ff-success-color);
            }

            .ff-settings-entry {
                display: flex;
                align-items: center;
                gap: 5px;
                margin-top: 10px;
                margin-bottom: 5px;
            }

            .ff-settings-entry p {
                margin: 0;
                color: var(--ff-text-color);
            }

            .ff-settings-input {
                width: 120px;
                padding: 5px;
                background-color: var(--ff-input-color);
                color: var(--ff-text-color);
                border: 1px solid var(--ff-border-color);
                border-radius: 3px;
            }

            .ff-settings-input.ff-blur {
                filter: blur(3px);
                transition: filter 0.5s;
            }

            .ff-settings-input.ff-blur:focus {
                filter: blur(0);
                transition: filter 0.5s;
            }

            .ff-settings-button {
                margin-right: 10px;
            }

            .ff-settings-button:last-child {
                margin-right: 0;
            }

            .ff-settings-glow {
                animation: ff-glow 1s infinite alternate;
                border-width: 3px;
            }

            @keyframes ff-glow {
                0% {
                    border-color: var(--ff-border-color);
                }
                100% {
                    border-color: var(--ff-glow-color);
                }
            }

            .ff-api-explanation {
                background-color: var(--ff-alt-bg-color);
                border: 1px solid var(--ff-border-color);
                border-radius: 8px;
                color: var(--ff-text-color);
                margin-bottom: 20px;
            }

            .ff-api-explanation a {
                color: var(--ff-success-color) !important;
                text-decoration: underline;
            }

            .ff-settings-label {
                color: var(--ff-text-color);
            }

            .ff-settings-section-header {
                color: var(--ff-text-color);
                margin-top: 20px;
                margin-bottom: 10px;
                font-weight: bold;
            }

            .ff-settings-entry-large {
                margin-bottom: 15px;
            }

            .ff-settings-entry-small {
                margin-bottom: 10px;
            }

            .ff-settings-entry-section {
                margin-bottom: 20px;
            }

            .ff-settings-label-inline {
                margin-right: 10px;
                min-width: 150px;
                display: inline-block;
            }

            .ff-settings-input-wide {
                width: 200px;
            }

            .ff-settings-input-narrow {
                width: 120px;
            }

            .ff-settings-checkbox {
                margin-right: 8px;
            }

            .ff-settings-button-large {
                padding: 8px 16px;
                font-size: 14px;
                font-weight: bold;
            }

            .ff-settings-button-container {
                margin-bottom: 20px;
                text-align: center;
            }

            .ff-api-explanation-content {
                padding: 12px 16px;
                font-size: 13px;
                line-height: 1.5;
            }

			.ff-scouter-history-btn {
				position: relative;
				display: flex;
				align-items: center;
				justify-content: center;
				width: 42px;
				height: 42px;
				margin: 0 12px 12px 0;
				border: 1px solid rgb(17, 17, 17);
				border-radius: 5px;
				background: #1a6fa8;
				color: #fff !important;
				text-decoration: none !important;
				cursor: pointer;
				box-sizing: border-box;
				flex-shrink: 0;
				overflow: hidden;
			}
			.ff-scouter-history-btn:hover {
				background: #155d8e !important;
				color: #fff !important;
				text-decoration: none !important;
			}
			body:not(.dark-mode) .ff-scouter-history-btn {
				border-color: #b0c4d8;
				background: #2980b9;
			}
			body:not(.dark-mode) .ff-scouter-history-btn:hover {
				background: #1f6fa0 !important;
			}
			.ff-scouter-history-btn .ff-history-icon {
				position: absolute;
				top: 50%;
				left: 50%;
				transform: translate(-50%, -50%);
				opacity: 0.15;
				width: 36px;
				height: 36px;
				fill: #fff;
				pointer-events: none;
			}
			.ff-scouter-history-btn .ff-history-label {
				position: relative;
				z-index: 1;
				font-size: 9.5px;
				font-weight: bold;
				color: #fff;
				text-align: center;
				line-height: 1.2;
				white-space: pre-line;
				letter-spacing: 0.3px;
				pointer-events: none;
			}
        `);

  var BASE_URL = "https://ffscouter.com";
  var BLUE_ARROW = "https://uploads.glasnost.dev/blue-arrow.svg";
  var GREEN_ARROW = "https://uploads.glasnost.dev/green-arrow.svg";
  var RED_ARROW = "https://uploads.glasnost.dev/red-arrow.svg";

  var rD_xmlhttpRequest;
  var rD_setValue;
  var rD_getValue;
  var rD_listValues;
  var rD_deleteValue;
  var rD_registerMenuCommand;

  // DO NOT CHANGE THIS
  // DO NOT CHANGE THIS
  var apikey = "###PDA-APIKEY###";
  // DO NOT CHANGE THIS
  // DO NOT CHANGE THIS
  if (apikey[0] != "#") {
    console.log("[FF Scouter V2] Adding modifications to support TornPDA");
    rD_xmlhttpRequest = function (details) {
      ffdebug("[FF Scouter V2] Attempt to make http request");
      if (details.method.toLowerCase() == "get") {
        return PDA_httpGet(details.url)
          .then(details.onload)
          .catch(
            details.onerror ??
              ((e) =>
                console.error("[FF Scouter V2] Generic error handler: ", e)),
          );
      } else if (details.method.toLowerCase() == "post") {
        return PDA_httpPost(
          details.url,
          details.headers ?? {},
          details.body ?? details.data ?? "",
        )
          .then(details.onload)
          .catch(
            details.onerror ??
              ((e) =>
                console.error("[FF Scouter V2] Generic error handler: ", e)),
          );
      } else {
        console.log("[FF Scouter V2] What is this? " + details.method);
      }
    };
    rD_setValue = function (name, value) {
      ffdebug("[FF Scouter V2] Attempted to set " + name);
      return localStorage.setItem(name, value);
    };
    rD_getValue = function (name, defaultValue) {
      var value = localStorage.getItem(name) ?? defaultValue;
      return value;
    };
    rD_listValues = function () {
      const keys = [];
      for (const key in localStorage) {
        if (localStorage.hasOwnProperty(key)) {
          keys.push(key);
        }
      }
      return keys;
    };
    rD_deleteValue = function (name) {
      ffdebug("[FF Scouter V2] Attempted to delete " + name);
      return localStorage.removeItem(name);
    };
    rD_registerMenuCommand = function () {
      ffdebug("[FF Scouter V2] Disabling GM_registerMenuCommand");
    };
    rD_setValue("limited_key", apikey);
  } else {
    rD_xmlhttpRequest = GM_xmlhttpRequest;
    rD_setValue = GM_setValue;
    rD_getValue = GM_getValue;
    rD_listValues = GM_listValues;
    rD_deleteValue = GM_deleteValue;
    rD_registerMenuCommand = GM_registerMenuCommand;
  }

  class FFScouterCache {
    constructor(db_name) {
      this.db_name = db_name;
      this.db = null;
      // wb55: bumped 1 → 2 to force onupgradeneeded for users whose
      // DB was at v1 but missing the "cache" store. Migration 2
      // self-heals by creating the store if absent.
      //
      // wb65 (2026-05-24): caller now passes a fork-private db name
      // ("ffs-banner-cache" instead of "ffscouter-cache") so we no
      // longer share storage with xentac's upstream script — both can
      // be installed and toggled without VersionError collisions in
      // either direction. Reverted to db_version 2 (wb64's bump to 10
      // was a band-aid for the shared-name case that's no longer
      // applicable, and it broke xentac's script for users who
      // toggled between them).
      this.db_version = 2;

      this.store_name = "cache";

      // wb55: idempotent migrations. Both migrations check
      // objectStoreNames.contains before createObjectStore so a
      // partial schema state from any prior install gets repaired.
      const ensureStore = (db) => {
        if (db.objectStoreNames.contains(this.store_name)) return;
        const store = db.createObjectStore(this.store_name, {
          keyPath: "player_id",
        });
        store.createIndex("expiry", ["expiry"], { unique: false });
      };
      this.migrations = {
        1: (db, _) => { ffdebug("migration 1"); ensureStore(db); },
        2: (db, _) => { ffdebug("migration 2 (heal)"); ensureStore(db); },
      };
    }

    open = async () => {
      return new Promise((resolve, reject) => {
        const dbopen = window.indexedDB.open(this.db_name, this.db_version);
        dbopen.onerror = (event) => {
          showToast(`Error loading database: ${this.db_name}`);
          ffdebug(event);
          this.db = null;
          reject(dbopen.error);
        };

        dbopen.onsuccess = () => {
          this.db = dbopen.result;
          this.db.onversionchange = (event) => {
            const db = this.db;
            this.db = null;
            db.close();
          };
          resolve(dbopen.result);
        };

        dbopen.onupgradeneeded = (event) => {
          const db = event.target.result;
          const tx = event.target.transaction;
          const old_version = event.target.oldVersion;
          ffdebug(`Old version: ${old_version}`);

          db.onerror = (event) => {
            showToast(`Error loading database for upgrade: ${this.db_name}`);
            ffdebug(event);
            reject(db.error);
          };

          for (let i = (old_version ?? 0) + 1; i <= this.db_version; i++) {
            ffdebug(`migration: ${i}`);
            if (this.migrations[i]) {
              ffdebug("exists");
              this.migrations[i](db, tx);
            }
          }
        };
      });
    };

    update_cache = async (values) => {
      return new Promise(async (resolve, reject) => {
        if (!this.db) {
          await this.open();
        }
        const tx = this.db.transaction(this.store_name, "readwrite");

        tx.onerror = (event) => {
          showToast(`Error opening transaction for update_cache`);
          ffdebug(event);
          reject(tx.error);
        };

        tx.oncomplete = (event) => {
          resolve(event);
        };

        const store = tx.objectStore(this.store_name);

        const adds = [];
        for (const i of values) {
          const r = store.put(i);
          adds.push(r);
        }

        Promise.all(adds)
          .then(() => {
            tx.commit();
          })
          .catch((error) => {
            ffdebug("Error adding document to object store.");
            reject(error);
          });
      });
    };

    get = async (player_ids) => {
      return new Promise(async (resolve, reject) => {
        if (!this.db) {
          await this.open();
        }
        const tx = this.db.transaction(this.store_name, "readonly");

        tx.onerror = (event) => {
          showToast(`Error opening transaction for get: ${tx.error}`);
          ffdebug(event);
          ffdebug(tx.error);
          reject(tx.error);
        };

        const store = tx.objectStore(this.store_name);

        const promises = [];
        const results = {};
        for (const player_id of player_ids) {
          const res = store.get(player_id);
          promises.push(
            new Promise((resolve, reject) => {
              res.onerror = () => {
                reject(res.error);
              };

              res.onsuccess = () => {
                if (res.result && res.result.expiry > Date.now()) {
                  results[res.result.player_id] = res.result;
                }
                resolve();
              };
            }),
          );
        }

        Promise.all(promises)
          .then(() => {
            tx.commit();
            resolve(results);
          })
          .catch((error) => {
            showToast(`Error getting a player_id: ${error}`);
            ffdebug(error);
            reject(error);
          });
      });
    };

    clean_expired = () => {
      return new Promise(async (resolve, reject) => {
        if (!this.db) {
          await this.open();
        }
        const tx = this.db.transaction(this.store_name, "readwrite");

        tx.onerror = (event) => {
          showToast(`Error opening transaction for clean_expired: ${tx.error}`);
          ffdebug(event);
          ffdebug(tx.error);
          reject(tx.error);
        };

        const store = tx.objectStore(this.store_name);
        const index = store.index("expiry");

        const range = IDBKeyRange.upperBound(Date.now(), true);

        const r = index.getAllKeys(range);
        r.onerror = () => {
          reject(r.error);
        };
        r.onsuccess = () => {
          r.result.forEach((elem) => {
            store.delete(elem);
          });

          tx.commit();
          ffdebug(
            `[FF Scouter V2] Cleaned ${r.result.length} expired values from IndexedDB`,
          );
          resolve(r.result);
        };
      });
    };

    delete_db = async () => {
      return new Promise((resolve, reject) => {
        const r = window.indexedDB.deleteDatabase(this.db_name);

        r.onerror = () => {
          ffdebug(`Error deleting indexedDB (${this.db_name}): ${r.error}`);
          reject(r.error);
        };

        r.onsuccess = () => {
          ffdebug(`Successfully deleted indexedDB (${this.db_name})`);
          resolve(r.result);
        };
      });
    };
  }

  // wb65: fork-private DB name so we don't share with xentac's upstream
  // script. Avoids VersionError collisions when both are installed.
  const ffcache = new FFScouterCache("ffs-banner-cache");

  if (!rD_getValue(CLEARED_TSC_KEY)) {
    console.log("Trying to delete any TSC keys found");
    // Delete TSC data because they're not useful anymore
    const badkeys = [];
    for (var i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key.startsWith("kwack.mavri.tsc.rocks")) {
        badkeys.push(key);
      }
    }
    console.log(`Found ${badkeys.length} TSC keys`);
    for (const key of badkeys) {
      localStorage.removeItem(key);
    }
    console.log("Deleted keys");

    rD_setValue(CLEARED_TSC_KEY, "true");
  }

  var key = rD_getValue("limited_key", null);
  var info_line = null;

  rD_registerMenuCommand("Enter Limited API Key", () => {
    let userInput = prompt(
      "[FF Scouter V2]: Enter Limited API Key",
      rD_getValue("limited_key", ""),
    );
    if (userInput !== null) {
      rD_setValue("limited_key", userInput);
      // Reload page
      window.location.reload();
    }
  });

  function format_timestamp(ts) {
    const d = new Date(ts * 1000);
    return `${d.getHours() < 10 ? "0" : ""}${d.getHours()}:${d.getMinutes() < 10 ? "0" : ""}${d.getMinutes()}:${d.getSeconds() < 10 ? "0" : ""}${d.getSeconds()} - ${d.getDate() < 10 ? "0" : ""}${d.getDate()}/${d.getMonth() + 1 < 10 ? "0" : ""}${d.getMonth() + 1}/${d.getFullYear() - 2000}`;
  }

  function inject_info_line(h4, info_line) {
    const linksTopWrap = h4.parentNode.querySelector(".links-top-wrap");
    if (linksTopWrap) {
      linksTopWrap.parentNode.insertBefore(info_line, linksTopWrap.nextSibling);
    } else {
      h4.after(info_line);
    }
  }

  function ffdebug(...args) {
    if (ffSettingsGet("debug-logs") == "true") {
      console.log(...args);
    }
  }

  function create_text_location() {
    info_line = document.createElement("div");
    info_line.id = "ff-scouter-run-once";
    info_line.style.display = "block";
    info_line.style.clear = "both";
    info_line.style.margin = "5px 0";
    if (!key) {
      info_line.style.cursor = "pointer";
    }
    info_line.addEventListener("click", () => {
      if (!key) {
        const limited_key = prompt(
          "[FF Scouter V2]: Enter Limited API Key",
          rD_getValue("limited_key", ""),
        );
        if (limited_key) {
          rD_setValue("limited_key", limited_key);
          key = limited_key;
          window.location.reload();
        }
      }
    });

    var h4 = $("h4")[0];
    if (!h4) {
      const obs = new MutationObserver(function () {
        var h4 = $("h4")[0];
        if (!h4) {
          return;
        }

        inject_info_line(h4, info_line);
        obs.disconnect();
      });

      obs.observe(document, {
        childList: true,
        subtree: true,
      });
    } else {
      inject_info_line(h4, info_line);
    }

    return info_line;
  }

  function reset_ff_ranges() {
    rD_deleteValue("ffscouterv2-ranges");
  }

  function set_ff_ranges(low, high, max) {
    rD_setValue(
      "ffscouterv2-ranges",
      JSON.stringify({ low: low, high: high, max: max }),
    );
  }

  function get_ff_ranges(noDefault) {
    const defaultRange = { low: 2, high: 4, max: 8 };
    const rangeUnparsed = rD_getValue("ffscouterv2-ranges");
    if (!rangeUnparsed) {
      if (noDefault) {
        return null;
      }
      return defaultRange;
    }

    try {
      const parsed = JSON.parse(rangeUnparsed);
      return parsed;
    } catch (error) {
      console.error(
        "[FF Scouter V2] Problem parsing configured range, reseting values.",
      );
      reset_ff_ranges();
      if (noDefault) {
        return null;
      }
      return defaultRange;
    }
  }

  function set_message(message, error = false) {
    while (info_line.firstChild) {
      info_line.removeChild(info_line.firstChild);
    }

    const textNode = document.createTextNode(message);
    if (error) {
      info_line.style.color = "red";
    } else {
      info_line.style.color = "";
    }
    info_line.appendChild(textNode);
  }

  let queued_player_ids = [];
  let queued_callbacks = [];
  let requests_this_minute = 0;
  let requests_rate_limit = 100;
  let requests_remaining = requests_rate_limit;
  let requests_reset_time = new Date(Date.now() + 60000);

  async function update_ff_cache(player_ids, callback) {
    if (!key) {
      return;
    }

    player_ids = [...new Set(player_ids)];

    clean_expired_data();

    var unknown_player_ids = await get_cache_misses(player_ids);

    if (unknown_player_ids.length > 0) {
      console.log(
        `[FF Scouter V2] Queuing ${unknown_player_ids.length} ids to update`,
      );

      queued_player_ids.push(...unknown_player_ids);
      queued_callbacks.push(callback);
    } else {
      callback(player_ids);
    }
  }

  // Process queued player ids
  async function process_queue() {
    if (queued_player_ids.length > 0) {
      const processing_player_ids = queued_player_ids;
      queued_player_ids = [];
      const callbacks = queued_callbacks;
      queued_callbacks = [];
      if (requests_reset_time - Date.now() <= 0) {
        requests_this_minute = 0;
        requests_remaining = requests_rate_limit;
        requests_reset_time = new Date(Date.now() + 60000);
      } else {
        requests_this_minute++;
        requests_remaining--;
      }
      await process_queued_player_ids(processing_player_ids, function () {
        for (const callback of callbacks) {
          callback(processing_player_ids);
        }
      });
    }

    let seconds_left = Math.floor((requests_reset_time - Date.now()) / 1000);
    if (seconds_left <= 0) {
      seconds_left = 60;
      requests_this_minute = 0;
      requests_remaining = requests_rate_limit;
      requests_reset_time = new Date(Date.now() + 60000);
    }
    ffdebug("[FF Scouter V2] Seconds left:", seconds_left);

    if (requests_remaining <= 0) {
      requests_remaining = 1;
    }
    ffdebug("[FF Scouter V2] Requests left:", requests_remaining);

    // Evenly space the requests left this minute across the entire minute
    let next_check = (seconds_left / requests_remaining) * 1000;
    // But allow the first 5 to burst in the first second
    if (requests_this_minute < requests_rate_limit * 0.25) {
      next_check = 1000;
    }
    ffdebug("[FF Scouter V2] Next check:", next_check);
    setTimeout(process_queue, next_check);
  }
  setTimeout(process_queue, 10);

  async function process_queued_player_ids(player_ids, callback) {
    if (!key) {
      return;
    }

    player_ids = [...new Set(player_ids)];

    clean_expired_data();

    var unknown_player_ids = await get_cache_misses(player_ids);

    if (unknown_player_ids.length > 0) {
      console.log(
        `[FF Scouter V2] Refreshing cache for ${unknown_player_ids.length} ids`,
      );

      var player_id_list = unknown_player_ids.join(",");
      const url = `${BASE_URL}/api/v1/get-stats?key=${key}&targets=${player_id_list}`;

      rD_xmlhttpRequest({
        method: "GET",
        url: url,
        onload: function (response) {
          if (!response) {
            // If the same request happens in under a second, Torn PDA will return nothing
            return;
          }
          if (response.status == 200) {
            var ff_response = JSON.parse(response.responseText);
            if (ff_response && ff_response.error) {
              showToast(ff_response.error);
              return;
            }
            var one_hour = 60 * 60 * 1000;
            var expiry = Date.now() + one_hour;
            const cachedObjs = [];
            ff_response.forEach((result) => {
              if (result && result.player_id) {
                if (result.fair_fight === null) {
                  let cacheObj = {
                    no_data: true,
                    expiry: expiry,
                    player_id: result.player_id,
                  };
                  cachedObjs.push(cacheObj);
                } else {
                  let cacheObj = {
                    value: result.fair_fight,
                    last_updated: result.last_updated,
                    expiry: expiry,
                    bs_estimate: result.bs_estimate,
                    bs_estimate_human: result.bs_estimate_human,
                    distribution_human:
                      result.distribution?.distribution_human ?? null,
                    distribution_last_updated:
                      result.distribution?.last_updated ?? null,
                    player_id: result.player_id,
                  };
                  cachedObjs.push(cacheObj);
                }
              }
            });
            ffcache.update_cache(cachedObjs).then(() => {
              callback(player_ids);
            });

            update_limits(response.responseHeaders);
          } else {
            try {
              var err = JSON.parse(response.responseText);
              if (err && err.error) {
                showToast(
                  "API request failed. Error: " +
                    err.error +
                    "; Code: " +
                    err.code,
                );
              } else {
                showToast(
                  "API request failed. HTTP status code: " + response.status,
                );
              }
            } catch {
              showToast(
                "API request failed. HTTP status code: " + response.status,
              );
            }
          }
        },
        onerror: function (e) {
          console.error("[FF Scouter V2] **** error ", e, "; Stack:", e.stack);
        },
        onabort: function (e) {
          console.error("[FF Scouter V2] **** abort ", e, "; Stack:", e.stack);
        },
        ontimeout: function (e) {
          console.error(
            "[FF Scouter V2] **** timeout ",
            e,
            "; Stack:",
            e.stack,
          );
        },
      });
    } else {
      callback(player_ids);
    }
  }

  function update_limits(responseHeaders) {
    ffdebug("responseHeaders:", responseHeaders);
    const headerLines = responseHeaders.split("\n");
    const headers = {};
    for (const line of headerLines) {
      const [key, value] = line.split(":", 2);
      headers[key] = value.trim();
    }
    ffdebug("headers:", headers);
    if (
      "x-ratelimit-reset-timestamp" in headers &&
      "x-ratelimit-remaining" in headers
    ) {
      requests_reset_time = new Date(
        parseInt(headers["x-ratelimit-reset-timestamp"]) * 1000,
      );
      requests_remaining = parseInt(headers["x-ratelimit-remaining"]);
      requests_rate_limit = parseInt(headers["x-ratelimit-limit"]);
      requests_this_minute = requests_rate_limit - requests_remaining;
    }
  }

  function clean_expired_data() {
    ffcache.clean_expired();
    let count = 0;
    for (const key of rD_listValues()) {
      // Try renaming the key to the new name format
      if (key.match(/^\d+$/)) {
        if (rename_if_ffscouter(key)) {
          if (clear_if_expired("ffscouterv2-" + key)) {
            count++;
          }
        }
      }
      if (key.startsWith("ffscouterv2-")) {
        if (clear_if_expired(key)) {
          count++;
        }
      }
    }
    ffdebug("[FF Scouter V2] Cleaned " + count + " expired values");
  }

  function rename_if_ffscouter(key) {
    const value = rD_getValue(key, null);
    if (value == null) {
      return false;
    }
    var parsed = null;
    try {
      parsed = JSON.parse(value);
    } catch {
      return false;
    }
    if (parsed == null) {
      return false;
    }
    if ((!parsed.value && !parsed.no_data) || !parsed.expiry) {
      return false;
    }

    rD_setValue("ffscouterv2-" + key, value);
    rD_deleteValue(key);
    return true;
  }

  function clear_if_expired(key) {
    const value = rD_getValue(key, null);
    var parsed = null;
    try {
      parsed = JSON.parse(value);
    } catch {
      return false;
    }
    if (
      parsed &&
      (parsed.value || parsed.no_data) &&
      parsed.expiry &&
      parsed.expiry < Date.now()
    ) {
      rD_deleteValue(key);
      return true;
    }
    return false;
  }

  async function display_fair_fight(target_id, player_id) {
    const response = await get_cached_value(target_id);
    if (response) {
      set_fair_fight(response, player_id);
    }
  }

  function get_ff_string(ff_response) {
    const ff = ff_response.value.toFixed(2);

    const now = Date.now() / 1000;
    const age = now - ff_response.last_updated;

    var suffix = "";
    if (age > 14 * 24 * 60 * 60) {
      suffix = "?";
    }

    return `${ff}${suffix}`;
  }

  function get_age_human(unix_timestamp) {
    if (!unix_timestamp) return null;
    const now = Date.now() / 1000;
    const age = now - unix_timestamp;
    if (age < 60 * 60) {
      const mins = Math.round(age / 60);
      return mins <= 1 ? "1 minute" : `${mins} minutes`;
    } else if (age < 24 * 60 * 60) {
      const hours = Math.round(age / (60 * 60));
      return hours === 1 ? "1 hour" : `${hours} hours`;
    } else if (age < 31 * 24 * 60 * 60) {
      const days = Math.round(age / (24 * 60 * 60));
      return days === 1 ? "1 day" : `${days} days`;
    } else if (age < 365 * 24 * 60 * 60) {
      const months = Math.round(age / (31 * 24 * 60 * 60));
      return months === 1 ? "1 month" : `${months} months`;
    } else {
      const years = Math.round(age / (365 * 24 * 60 * 60));
      return years === 1 ? "1 year" : `${years} years`;
    }
  }

  function get_difficulty_text(ff) {
    if (ff <= 1) {
      return "Extremely easy";
    } else if (ff <= 2) {
      return "Easy";
    } else if (ff <= 3.5) {
      return "Moderately difficult";
    } else if (ff <= 4.5) {
      return "Difficult";
    } else {
      return "May be impossible";
    }
  }

  function get_detailed_message(ff_response, player_id) {
    if (ff_response.no_data || !ff_response.value) {
      return `<span style=\"font-weight: bold; margin-right: 6px;\">FairFight:</span><span style=\"background: #444; color: #fff; font-weight: bold; padding: 2px 6px; border-radius: 4px; display: inline-block;\">No data</span>`;
    }
    const ff_string = get_ff_string(ff_response);
    const difficulty = get_difficulty_text(ff_response.value);

    const now = Date.now() / 1000;
    const age = now - ff_response.last_updated;

    var fresh = "";

    if (age < 24 * 60 * 60) {
      // Pass
    } else if (age < 31 * 24 * 60 * 60) {
      var days = Math.round(age / (24 * 60 * 60));
      if (days == 1) {
        fresh = "(1 day old)";
      } else {
        fresh = `(${days} days old)`;
      }
    } else if (age < 365 * 24 * 60 * 60) {
      var months = Math.round(age / (31 * 24 * 60 * 60));
      if (months == 1) {
        fresh = "(1 month old)";
      } else {
        fresh = `(${months} months old)`;
      }
    } else {
      var years = Math.round(age / (365 * 24 * 60 * 60));
      if (years == 1) {
        fresh = "(1 year old)";
      } else {
        fresh = `(${years} years old)`;
      }
    }

    const background_colour = get_ff_colour(ff_response.value);
    const text_colour = get_contrast_color(background_colour);

    let statDetails = "";
    if (ff_response.bs_estimate_human) {
      let distLine = "";
      if (ff_response.distribution_human) {
        const ageStr = get_age_human(ff_response.distribution_last_updated);
        const agePart = ageStr ? ` (${ageStr} old)` : "";
        distLine = `<span style="display:block; margin-top: 2px; font-size: 12px; font-style: normal;"><span style="font-weight: bold; margin-right: 6px;">Top Stats:</span><span style="font-weight: normal;">${ff_response.distribution_human}${agePart}</span></span>`;
      }
      statDetails = `<span style="font-size: 11px; font-weight: normal; margin-left: 8px; vertical-align: middle; font-style: italic;">Est. Stats: <span>${ff_response.bs_estimate_human}</span>${distLine}</span>`;
    }

    return `<span style=\"font-weight: bold; margin-right: 6px;\">FairFight:</span><span style=\"background: ${background_colour}; color: ${text_colour}; font-weight: bold; padding: 2px 6px; border-radius: 4px; display: inline-block;\">${ff_string} (${difficulty}) ${fresh}</span>${statDetails}`;
  }

  function get_ff_string_short(ff_response, player_id) {
    const ff = ff_response.value.toFixed(2);

    const now = Date.now() / 1000;
    const age = now - ff_response.last_updated;

    if (ff > 99) {
      return `high`;
    }

    var suffix = "";
    if (age > 14 * 24 * 60 * 60) {
      suffix = "?";
    }

    return `${ff}${suffix}`;
  }

  function set_fair_fight(ff_response, player_id) {
    const detailed_message = get_detailed_message(ff_response, player_id);
    info_line.innerHTML = detailed_message;
  }

  // ─────────────────────────────────────────────────────────────────────
  // WARBOARD FORK (wb15): travel arrival estimator — ported from the
  // modded FFS variant (greasyfork 537486). Calls ffscouter.com's
  // /api/v1/player-flights endpoint when the target profile page shows
  // them travelling, then paints a live TCT countdown + arrival-window
  // (earliest / latest) + travel method + fuel-book hint into the
  // "Traveling to X" description block.
  // ─────────────────────────────────────────────────────────────────────
  function format_countdown(unixSec) {
    const remaining = Math.max(0, unixSec - ffs_nowSec());
    const h = Math.floor(remaining / 3600);
    const m = Math.floor((remaining % 3600) / 60);
    const s = Math.floor(remaining % 60);
    if (h > 0) return `${h}h ${m}m ${s}s`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  }

  function inject_flight_info(player_id) {
    if (!key || !player_id) return;

    function try_inject() {
      if (document.getElementById("ff-scouter-flight-info")) return true;
      const statusBlock = document.querySelector(".profile-status");
      if (!statusBlock || !statusBlock.classList.contains("travelling")) return false;
      const descriptionDiv = statusBlock.querySelector(".profile-container .description");
      if (!descriptionDiv) return false;
      if (descriptionDiv.dataset.ffFlightInjected) return true;
      descriptionDiv.dataset.ffFlightInjected = "1";

      const url = `${BASE_URL}/api/v1/player-flights?key=${key}&target=${player_id}`;
      rD_xmlhttpRequest({
        method: "GET",
        url,
        onload: function (response) {
          if (!response || response.status !== 200) return;
          let data;
          try { data = JSON.parse(response.responseText); } catch { return; }
          if (!data || data.error || !data.current) return;
          const flight = data.current;
          const earliest = flight.earliest_arrival_time;
          const latest = flight.latest_arrival_time;
          const method = flight.travel_method || "Unknown";
          const bookUsed = flight.book_likely_being_used;

          const mainDesc = descriptionDiv.querySelector(".main-desc");
          if (mainDesc) {
            const methodTag = document.createElement("span");
            methodTag.style.cssText = "opacity:0.65;font-size:0.9em;margin-left:4px;";
            if (bookUsed === true) {
              methodTag.innerHTML = `· ${method} <span style="font-size:10px;background:#1a6fa8;color:#fff;padding:1px 4px;border-radius:3px;vertical-align:middle;">\u{1F4D6}</span>`;
            } else {
              methodTag.textContent = `· ${method}`;
            }
            mainDesc.appendChild(methodTag);
          }

          const row1 = document.createElement("div");
          row1.id = "ff-scouter-flight-info";
          row1.style.cssText = "display:flex;gap:8px;";
          const countdownSpan = document.createElement("span");
          countdownSpan.id = "ff-scouter-flight-countdown";
          countdownSpan.style.cssText = "font-weight:bold;font-variant-numeric:tabular-nums;";
          const winSpan = document.createElement("span");
          winSpan.id = "ff-scouter-flight-window";
          winSpan.style.cssText = "font-size:11px;opacity:0.65;font-variant-numeric:tabular-nums;";
          row1.appendChild(countdownSpan);
          row1.appendChild(winSpan);
          descriptionDiv.appendChild(row1);

          function tick() {
            const cdEl = document.getElementById("ff-scouter-flight-countdown");
            const wEl = document.getElementById("ff-scouter-flight-window");
            if (!cdEl) return;
            const now = Date.now() / 1000;
            if (earliest && latest) {
              const earlyLeft = earliest - now;
              const lateLeft = latest - now;
              if (lateLeft <= 0) {
                cdEl.textContent = "Landing imminent";
                cdEl.style.color = "#f0a500";
              } else if (earlyLeft <= 0) {
                cdEl.textContent = `\u2264 ${format_countdown(latest)}`;
                cdEl.style.color = "#f0a500";
              } else {
                cdEl.textContent = `${format_countdown(earliest)} \u2013 ${format_countdown(latest)}`;
              }
              if (wEl) {
                const fmt = (d) => `${d.getUTCHours().toString().padStart(2,"0")}:${d.getUTCMinutes().toString().padStart(2,"0")} TCT`;
                wEl.textContent = `(${fmt(new Date(earliest*1000))} \u2013 ${fmt(new Date(latest*1000))})`;
              }
            } else {
              cdEl.textContent = "Arrival time unknown";
            }
            setTimeout(tick, 1000);
          }
          tick();
        },
        onerror: function () {},
      });
      return true;
    }

    if (try_inject()) return;
    const obs = new MutationObserver(function () {
      if (try_inject()) obs.disconnect();
    });
    obs.observe(document.body, { childList: true, subtree: true });
  }

  function inject_stats_history_button(player_id) {
    if (!player_id) return;
    if (ffSettingsGet("ff-history-enabled") === "false") return;
    if (document.querySelector(".ff-scouter-history-btn")) return;

    const buttonsList = document.querySelector(
      ".profile-buttons.profile-action .buttons-list",
    );
    if (!buttonsList) return;

    const btn = document.createElement("a");
    btn.href = `https://ffscouter.com/player-view?player_id=${player_id}`;
    btn.target = "_blank";
    btn.rel = "noopener noreferrer";
    btn.className = "ff-scouter-history-btn";
    btn.title = "View Stats History on FFScouter";

    // Semi-transparent background clock/history icon
    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.className.baseVal = "ff-history-icon";
    svg.setAttribute("class", "ff-history-icon");
    svg.innerHTML =
      '<path d="M13 3a9 9 0 1 0 9 9h-2a7 7 0 1 1-7-7V3zm-1 5v5.41l3.29 3.3 1.42-1.42L13 12.17V8h-1z"/>';
    btn.appendChild(svg);

    // "FF\nHistory" label on top
    const label = document.createElement("span");
    label.className = "ff-history-label";
    label.textContent = "FF\nHistory";
    btn.appendChild(label);

    buttonsList.appendChild(btn);
  }

  function get_members() {
    var player_ids = [];
    $(".table-body > .table-row").each(function () {
      if (!$(this).find(".fallen").length) {
        if (!$(this).find(".fedded").length) {
          $(this)
            .find(".member")
            .each(function (index, value) {
              var url = value.querySelectorAll('a[href^="/profiles"]')[0].href;
              var player_id = url.match(/.*XID=(?<player_id>\d+)/).groups
                .player_id;
              player_ids.push(parseInt(player_id));
            });
        }
      }
    });

    return player_ids;
  }

  function rgbToHex(r, g, b) {
    return (
      "#" +
      ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase()
    ); // Convert to hex and return
  }

  function get_ff_colour(value) {
    let r, g, b;

    // Transition from
    // blue - #2828c6
    // to
    // green - #28c628
    // to
    // red - #c62828
    if (value <= 1) {
      // Blue
      r = 0x28;
      g = 0x28;
      b = 0xc6;
    } else if (value <= 3) {
      // Transition from blue to green
      const t = (value - 1) / 2; // Normalize to range [0, 1]
      r = 0x28;
      g = Math.round(0x28 + (0xc6 - 0x28) * t);
      b = Math.round(0xc6 - (0xc6 - 0x28) * t);
    } else if (value <= 5) {
      // Transition from green to red
      const t = (value - 3) / 2; // Normalize to range [0, 1]
      r = Math.round(0x28 + (0xc6 - 0x28) * t);
      g = Math.round(0xc6 - (0xc6 - 0x28) * t);
      b = 0x28;
    } else {
      // Red
      r = 0xc6;
      g = 0x28;
      b = 0x28;
    }

    return rgbToHex(r, g, b); // Return hex value
  }

  function get_contrast_color(hex) {
    // Convert hex to RGB
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);

    // Calculate brightness
    const brightness = r * 0.299 + g * 0.587 + b * 0.114;
    return brightness > 126 ? "black" : "white"; // Return black or white based on brightness
  }

  async function get_cached_value(player_id) {
    const r = await ffcache.get([parseInt(player_id)]);
    if (r[player_id]) {
      return r[player_id];
    }
    return null;
  }

  async function apply_fair_fight_info(_) {
    const showBSDefault =
      (ffSettingsGet("factions-col-display") || "fair_fight") ===
      "battle_stats";
    var ff_li = document.createElement("li");
    ff_li.tabIndex = "0";
    ff_li.classList.add("table-cell");
    ff_li.classList.add("lvl");
    ff_li.classList.add("torn-divider");
    ff_li.classList.add("divider-vertical");
    ff_li.classList.add("c-pointer");
    ff_li.classList.add(
      showBSDefault ? "ff-scouter-ff-hidden" : "ff-scouter-ff-visible",
    );
    ff_li.onclick = () => {
      $(".ff-scouter-ff-visible").each(function (_, value) {
        value.classList.remove("ff-scouter-ff-visible");
        value.classList.add("ff-scouter-ff-hidden");
      });
      $(".ff-scouter-est-hidden").each(function (_, value) {
        value.classList.remove("ff-scouter-est-hidden");
        value.classList.add("ff-scouter-est-visible");
      });
    };

    ff_li.appendChild(document.createTextNode("FF"));
    var est_li = document.createElement("li");
    est_li.tabIndex = "0";
    est_li.classList.add("table-cell");
    est_li.classList.add("lvl");
    est_li.classList.add("torn-divider");
    est_li.classList.add("divider-vertical");
    est_li.classList.add("c-pointer");
    est_li.classList.add(
      showBSDefault ? "ff-scouter-est-visible" : "ff-scouter-est-hidden",
    );
    est_li.onclick = () => {
      $(".ff-scouter-ff-hidden").each(function (_, value) {
        value.classList.remove("ff-scouter-ff-hidden");
        value.classList.add("ff-scouter-ff-visible");
      });
      $(".ff-scouter-est-visible").each(function (_, value) {
        value.classList.remove("ff-scouter-est-visible");
        value.classList.add("ff-scouter-est-hidden");
      });
    };

    est_li.appendChild(document.createTextNode("Est"));

    if ($(".table-header > .lvl").length == 0) {
      // The .member-list doesn't have a .lvl, give up
      return;
    }
    $(".table-header > .lvl")[0].after(ff_li, est_li);

    const player_ids = [];
    $(".table-body > .table-row > .member").each(async function (_, value) {
      var url = value.querySelectorAll('a[href^="/profiles"]')[0].href;
      var player_id = url.match(/.*XID=(?<player_id>\d+)/).groups.player_id;
      player_ids.push(parseInt(player_id));
    });

    const cached_values = await ffcache.get(player_ids);

    $(".table-body > .table-row > .member").each(async function (_, value) {
      var url = value.querySelectorAll('a[href^="/profiles"]')[0].href;
      var player_id = parseInt(
        url.match(/.*XID=(?<player_id>\d+)/).groups.player_id,
      );

      var fair_fight_div = document.createElement("div");

      fair_fight_div.classList.add("table-cell");

      fair_fight_div.classList.add("lvl");
      fair_fight_div.classList.add(
        showBSDefault ? "ff-scouter-ff-hidden" : "ff-scouter-ff-visible",
      );

      var estimate_div = document.createElement("div");
      estimate_div.classList.add("table-cell");
      estimate_div.classList.add("lvl");
      estimate_div.classList.add(
        showBSDefault ? "ff-scouter-est-visible" : "ff-scouter-est-hidden",
      );
      const cached = cached_values[player_id];

      if (cached && cached.value) {
        const ff = cached.value;
        const ff_string = get_ff_string_short(cached, player_id);
        const background_colour = get_ff_colour(ff);
        const text_colour = get_contrast_color(background_colour);
        fair_fight_div.style.backgroundColor = background_colour;
        fair_fight_div.style.color = text_colour;
        fair_fight_div.style.fontWeight = "bold";
        fair_fight_div.innerHTML = ff_string;

        if (cached.bs_estimate_human) {
          estimate_div.style.backgroundColor = background_colour;
          estimate_div.style.color = text_colour;
          estimate_div.style.fontWeight = "bold";
          estimate_div.innerHTML = cached.bs_estimate_human;
          if (cached.distribution_human) {
            const ageStr = get_age_human(cached.distribution_last_updated);
            const agePart = ageStr ? ` (${ageStr} old)` : "";
            estimate_div.title = `Top Stats: ${cached.distribution_human}${agePart}`;
          }
        }
      }

      value.nextSibling.after(fair_fight_div, estimate_div);
    });
  }

  async function get_cache_misses(player_ids) {
    var unknown_player_ids = [];
    const cached_players = await ffcache.get(player_ids);
    for (const player_id of player_ids) {
      if (player_id in cached_players === false) {
        unknown_player_ids.push(player_id);
      }
    }
    return unknown_player_ids;
  }

  create_text_location();

  const match1 = window.location.href.match(
    /https:\/\/www.torn.com\/profiles.php\?XID=(?<target_id>\d+)/,
  );
  const match2 = window.location.href.match(
    /https:\/\/www.torn.com\/page.php\?sid=attack&user2ID=(?<target_id>\d+)/,
  );
  const match = match1 ?? match2;
  if (match) {
    var target_id = parseInt(match.groups.target_id);
    // wb45: skip the stats chip / FF gauge on attack pages (match2) —
    // user feedback that it looks cluttered next to Torn's own attack
    // HUD. Profile pages (match1) still get it.
    if (match1) {
      update_ff_cache([target_id], function (target_ids) {
        display_fair_fight(target_ids[0], target_id);
      });
    }

    // Inject Stats History button into Actions area
    // Use a MutationObserver in case the Actions area loads after page JS runs
    const statsHistoryObserver = new MutationObserver(function () {
      if (
        document.querySelector(".profile-buttons.profile-action .buttons-list")
      ) {
        inject_stats_history_button(target_id);
        statsHistoryObserver.disconnect();
      }
    });
    statsHistoryObserver.observe(document.body, {
      childList: true,
      subtree: true,
    });
    // Also try immediately in case it's already loaded
    inject_stats_history_button(target_id);

    // wb15: travel arrival estimator — only on profile pages (match1),
    // not attack pages (match2). Safe no-op when target isn't travelling.
    if (match1) {
      inject_flight_info(target_id);
    }

    if (!key) {
      set_message("[FF Scouter V2]: Limited API key needed - click to add");
    }
  } else if (
    window.location.href.startsWith("https://www.torn.com/factions.php")
  ) {
    const torn_observer = new MutationObserver(async function () {
      // Find the member table - add a column if it doesn't already have one, for FF scores
      var members_list = $(".members-list")[0];
      if (members_list) {
        torn_observer.disconnect();

        var player_ids = get_members();
        await update_ff_cache(player_ids, apply_fair_fight_info);
      }
    });

    torn_observer.observe(document, {
      attributes: false,
      childList: true,
      characterData: false,
      subtree: true,
    });

    if (!key) {
      set_message("[FF Scouter V2]: Limited API key needed - click to add");
    }
  } else {
    // console.log("Did not match against " + window.location.href);
  }

  function get_player_id_in_element(element) {
    const match = element.parentElement?.href?.match(/.*XID=(?<target_id>\d+)/);
    if (match) {
      return parseInt(match.groups.target_id);
    }

    const anchors = element.getElementsByTagName("a");

    for (const anchor of anchors) {
      const match = anchor.href.match(/.*XID=(?<target_id>\d+)/);
      if (match) {
        return parseInt(match.groups.target_id);
      }
      const matchUserId = anchor.href.match(/.*userId=(?<target_id>\d+)/);
      if (matchUserId) {
        return parseInt(matchUserId.groups.target_id);
      }
    }

    if (element.nodeName.toLowerCase() === "a") {
      const match = element.href.match(/.*XID=(?<target_id>\d+)/);
      if (match) {
        return parseInt(match.groups.target_id);
      }
      const matchUserId = element.href.match(/.*userId=(?<target_id>\d+)/);
      if (matchUserId) {
        return parseInt(matchUserId.groups.target_id);
      }
    }

    return null;
  }

  function ff_to_percent(ff) {
    // The percent is 0-33% 33-66% 66%-100%
    // With configurable ranges there are no guarantees that the sections are linear
    const stored_values = get_ff_ranges();
    const low_ff = stored_values.low;
    const high_ff = stored_values.high;
    const low_mid_percent = 33;
    const mid_high_percent = 66;
    ff = Math.min(ff, stored_values.max);
    var percent;
    if (ff < low_ff) {
      percent = ((ff - 1) / (low_ff - 1)) * low_mid_percent;
    } else if (ff < high_ff) {
      percent =
        ((ff - low_ff) / (high_ff - low_ff)) *
          (mid_high_percent - low_mid_percent) +
        low_mid_percent;
    } else {
      percent =
        ((ff - high_ff) / (stored_values.max - high_ff)) *
          (100 - mid_high_percent) +
        mid_high_percent;
    }

    return percent;
  }

  async function show_cached_values(elements) {
    // Rescan player ids because the competition page can rewrite them
    elements = elements.map((e) => {
      const player_id = get_player_id_in_element(e[1]);
      if (e[0] != player_id) {
        ffdebug(
          "[FF Scouter V2] Torn rewrote player element between request and response! Previous player_id:",
          e[0],
          "; New player_id:",
          player_id,
          "; Element:",
          e[1],
        );
      }
      return [player_id, e[1]];
    });
    // Remove any elements that don't have an id
    elements = elements.filter((e) => e[0]);
    const cached_values = await ffcache.get(
      elements.map((e) => parseInt(e[0])),
    );
    for (const [player_id, element] of elements) {
      element.classList.add("ff-scouter-indicator");
      if (!element.classList.contains("indicator-lines")) {
        element.classList.add("indicator-lines");
        element.style.setProperty("--arrow-width", "20px");
        // wb9: force visible overflow so our absolute-positioned chip
        // (anchored bottom-center, translated 50% downward) doesn't get
        // clipped by the honor-bar container on profile pages. Also
        // force the parent (.honorWrap on profile pages, varies
        // elsewhere) to allow visible overflow so the chip can extend
        // past the immediate container.
        element.style.overflow = "visible";
        if (element.parentElement) {
          element.parentElement.style.overflow = "visible";
        }

        // Ugly - does removing this break anything?
        element.classList.remove("small");
        element.classList.remove("big");

        //$(element).append($("<div>", { class: "ff-scouter-vertical-line-low-upper" }));
        //$(element).append($("<div>", { class: "ff-scouter-vertical-line-low-lower" }));
        //$(element).append($("<div>", { class: "ff-scouter-vertical-line-high-upper" }));
        //$(element).append($("<div>", { class: "ff-scouter-vertical-line-high-lower" }));
      }

      const cached = cached_values[parseInt(player_id)];
      if (cached && cached.value) {
        const percent = ff_to_percent(cached.value);
        element.style.setProperty("--band-percent", percent);

        $(element).find(".ff-scouter-arrow").remove();

        var arrow;
        if (percent < 33) {
          arrow = BLUE_ARROW;
        } else if (percent < 66) {
          arrow = GREEN_ARROW;
        } else {
          arrow = RED_ARROW;
        }
        const img = $("<img>", {
          src: arrow,
          class: "ff-scouter-arrow",
        });
        $(element).append(img);

        // WARBOARD FORK (wb3/wb4/wb5): stamp an estimate chip next to
        // the FF arrow on the honor bar.
        //
        // wb5: verbose diagnostic logging so we can see EXACTLY what FFS
        // stored in its cache for each target and why a chip does or
        // doesn't paint. Logs to the standard browser console (not
        // gated behind ffdebug) so users can self-diagnose with
        // devtools open.
        // wb8: paint chip as an ABSOLUTE OVERLAY on the honor bar — same
        // visual style BSP uses. Element is .honor-text-wrap which we've
        // already made position:relative via .ff-scouter-indicator, so
        // a position:absolute child with fixed offsets floats visually
        // on top of the honor image without being clipped or wrapped.
        // Cleanup: remove ALL prior chip positions (old child inline,
        // sibling, and overlay) so reruns don't stack.
        $(element).find(".ff-scouter-est-inline, .ff-scouter-est-overlay").remove();
        let sib = element.nextElementSibling;
        while (sib && sib.classList && (sib.classList.contains("ff-scouter-est-inline") || sib.classList.contains("ff-scouter-est-overlay"))) {
          const next = sib.nextElementSibling;
          sib.remove();
          sib = next;
        }
        const chipInfo = ffs_resolve_estimate_chip(player_id, cached);
        try { ffs_post_diag(player_id, cached, chipInfo, element); } catch (_) {}
        if (chipInfo) {
          const overlay = document.createElement("span");
          overlay.className = "ff-scouter-est-overlay";
          overlay.title = chipInfo.source;
          overlay.textContent = chipInfo.label;
          overlay.style.cssText =
            "position:absolute;left:50%;bottom:0;transform:translate(-50%, 50%);"
            + "padding:1px 6px;border-radius:3px;"
            + "font-size:10px;font-weight:700;"
            + "background:rgba(0,0,0,0.78);color:#fff;"
            + "white-space:nowrap;line-height:12px;"
            // wb77: the stat pill is now a click-to-attack target (was pointer-events:none)
            + "pointer-events:auto;cursor:pointer;"
            + "z-index:5;text-shadow:0 1px 1px rgba(0,0,0,0.8);";
          overlay.dataset.ffsUid = String(player_id);
          overlay.title = (chipInfo.source ? chipInfo.source + " · " : "") + "Click to attack";
          element.appendChild(overlay);
        }
      }
    }
  }

  // wb6: POST a diagnostic snapshot to warboard so we can grep pm2 logs
  // server-side. Only runs for the first 5 min after page load so we
  // don't spam. Tagged so grep is easy.
  const _ffsDiagWindowStart = Date.now();
  let _ffsDiagCount = 0;
  function ffs_post_diag(player_id, cached, chipInfo, element) {
    if (Date.now() - _ffsDiagWindowStart > 5 * 60_000) return;
    if (_ffsDiagCount > 50) return;
    _ffsDiagCount++;
    const payload = {
      pid: player_id,
      href: location.href,
      hostTag: element?.tagName + "." + (element?.className || "").slice(0, 60),
      cached: {
        value: cached?.value,
        bs_estimate: cached?.bs_estimate,
        bs_estimate_human: cached?.bs_estimate_human,
        distribution_human: cached?.distribution_human,
        last_updated: cached?.last_updated,
      },
      bspPresent: (function(){ try { return !!localStorage.getItem("tdup.battleStatsPredictor.cache.prediction." + player_id); } catch(_){ return null; }})(),
      chipInfo: chipInfo || null,
      honorTextWrapCount: document.querySelectorAll(".honor-text-wrap").length,
      ffArrowCount: document.querySelectorAll(".ff-scouter-arrow").length,
      estInlineCount: document.querySelectorAll(".ff-scouter-est-inline").length,
      estOverlayCount: document.querySelectorAll(".ff-scouter-est-overlay").length,
      scriptVersion: "2.73.0-wb51",
    };
    try {
      GM_xmlhttpRequest({
        method: "POST",
        url: "https://tornwar.com/api/debug/client-log",
        headers: { "Content-Type": "application/json" },
        data: JSON.stringify({ tag: "ffs-banner-diag", data: payload }),
        onload: function(){}, onerror: function(){},
      });
    } catch (_) { /* silently ignore */ }
  }

  // WARBOARD FORK (wb4): resolve an estimate chip string from the best
  // available source. Returns { label, source } or null if no data.
  function ffs_format_number_short(n) {
    if (n == null || !isFinite(n)) return null;
    if (n >= 1e9) return (n / 1e9).toFixed(n >= 1e10 ? 1 : 2) + "b";
    if (n >= 1e6) return (n / 1e6).toFixed(n >= 1e7 ? 1 : 2) + "m";
    if (n >= 1e3) return (n / 1e3).toFixed(n >= 1e4 ? 0 : 1) + "k";
    return String(Math.round(n));
  }

  function ffs_read_bsp_prediction(player_id) {
    try {
      const raw = localStorage.getItem(
        "tdup.battleStatsPredictor.cache.prediction." + player_id
      );
      if (!raw) return null;
      const pred = JSON.parse(raw);
      // BSP's prediction shape varies — handle both TBS (total battle
      // stats) and nested alternatives gracefully.
      let tbs = pred?.TBS ?? pred?.tbs ?? pred?.Total ?? null;
      if (typeof tbs === "string") tbs = parseFloat(tbs.replace(/,/g, ""));
      if (tbs == null || !isFinite(tbs)) return null;
      return tbs;
    } catch (_) {
      return null;
    }
  }

  function ffs_resolve_estimate_chip(player_id, cached) {
    // 1) FFS server-provided human string (premium tiers only)
    if (cached && cached.bs_estimate_human) {
      return { label: cached.bs_estimate_human, source: "FFS estimate" };
    }
    // 2) FFS raw number
    if (cached && typeof cached.bs_estimate === "number") {
      const s = ffs_format_number_short(cached.bs_estimate);
      if (s) return { label: s, source: "FFS estimate (raw)" };
    }
    // 3) BSP prediction from localStorage
    const bspTbs = ffs_read_bsp_prediction(player_id);
    if (bspTbs != null) {
      const s = ffs_format_number_short(bspTbs);
      if (s) return { label: s, source: "BSP prediction" };
    }
    return null;
  }

  async function apply_ff_gauge(elements) {
    // Remove elements which already have the class
    elements = elements.filter(
      (e) => !e.classList.contains("ff-scouter-indicator"),
    );
    // Convert elements to a list of tuples
    elements = elements.map((e) => {
      const player_id = get_player_id_in_element(e);
      return [player_id, e];
    });
    // Remove any elements that don't have an id
    elements = elements.filter((e) => e[0]);

    if (elements.length > 0) {
      // Display cached values immediately
      // This is also important to ensure we only iterate the list once
      // Then update
      // Then re-display after the update
      show_cached_values(elements);
      const player_ids = elements.map((e) => e[0]);
      await update_ff_cache(player_ids, () => {
        show_cached_values(elements);
      });
    }
  }

  // wb53: shared status-host finder for mini-profile injection.
  // Returns the element next to which the FFS estimate banner and
  // the travel countdown chip should dock. wb52's text-content
  // walker missed everything because the visible string is just
  // "Switzerland to Torn" — the word "Traveling" only appears in the
  // .main-desc element's aria-label. Verified DOM (2026-05-12):
  //   <div class="profile-container travelling from switzerland airstrip">
  //     <div class="description">
  //       <div class="desc-wrap">
  //         <span class="main-desc" aria-label="Traveling from ...">
  //           <span aria-hidden="true">Switzerland to Torn ...</span>
  //         </span>
  //       </div>
  //     </div>
  //   </div>
  function _ffs_findMiniStatusHost(mini) {
    // 1. Direct hit: the .main-desc span inside a travelling container.
    let host = mini.querySelector('.profile-container.travelling .main-desc')
            || mini.querySelector('.profile-container.returning .main-desc');
    if (host) return host;
    // 2. Looser: any element whose aria-label starts with Traveling /
    //    Returning. Covers DOM variants where the wrapper class drops.
    const labelled = mini.querySelectorAll('[aria-label]');
    for (const el of labelled) {
      const lbl = (el.getAttribute('aria-label') || '').trim();
      if (/^(Traveling|Returning)/i.test(lbl)) return el;
    }
    // 3. Last resort: visible-text walker (legacy wb52 path) for any
    //    future variant that puts the text directly in the DOM.
    let best = null, bestDepth = -1;
    for (const el of mini.querySelectorAll('*')) {
      const text = (el.textContent || '').trim();
      if (!/^(Traveling|Returning)/i.test(text)) continue;
      if (el.children.length > 6) continue;
      let depth = 0;
      for (let p = el; p && p !== mini; p = p.parentElement) depth++;
      if (depth > bestDepth) { best = el; bestDepth = depth; }
    }
    // wb58: canary for the Torn API change announced 2026-05-13
    // ("Traveling statuses always reference both origin and
    // destination"). If a mini-profile contains the words travel/
    // return/airstrip but NO selector / aria-label / text match
    // landed, Torn has likely changed the wording — log once with
    // the offending HTML snippet so we notice.
    if (!best) {
      try {
        const fullText = (mini.textContent || '').toLowerCase();
        if (/travel|return|airstrip|abroad/.test(fullText)) {
          _ffs_warnTravelHostMissOnce(mini);
        }
      } catch (_) {}
    }
    return best;
  }
  // wb58: dedupe travel-host warnings so we only log once per unique
  // text snippet per session.
  const _ffs_travelHostMissSeen = new Set();
  function _ffs_warnTravelHostMissOnce(mini) {
    try {
      const key = (mini.textContent || '').trim().slice(0, 120);
      if (_ffs_travelHostMissSeen.has(key)) return;
      _ffs_travelHostMissSeen.add(key);
      console.warn(
        '[FFS Banner] mini-profile travel host not found — Torn may have changed the format. textContent:',
        key,
      );
    } catch (_) {}
  }

  async function apply_to_mini_profile(mini) {
    // Get the user id, and the details
    const player_id = get_player_id_in_element(mini);
    if (player_id) {
      const response = await get_cached_value(player_id);
      if (response && response.value) {
        // Remove any existing elements
        $(mini).find(".ff-scouter-mini-ff").remove();

        // Minimal, text-only Fair Fight string for mini-profiles
        const ff_string = get_ff_string(response);
        const difficulty = get_difficulty_text(response.value);
        const now = Date.now() / 1000;
        const age = now - response.last_updated;
        let fresh = "";
        if (age < 24 * 60 * 60) {
          // Pass
        } else if (age < 31 * 24 * 60 * 60) {
          var days = Math.round(age / (24 * 60 * 60));
          fresh = days === 1 ? "(1 day old)" : `(${days} days old)`;
        } else if (age < 365 * 24 * 60 * 60) {
          var months = Math.round(age / (31 * 24 * 60 * 60));
          fresh = months === 1 ? "(1 month old)" : `(${months} months old)`;
        } else {
          var years = Math.round(age / (365 * 24 * 60 * 60));
          fresh = years === 1 ? "(1 year old)" : `(${years} years old)`;
        }
        let distLine = "";
        if (response.distribution_human) {
          const ageStr = get_age_human(response.distribution_last_updated);
          const agePart = ageStr ? ` (${ageStr})` : "";
          distLine = ` | Dist: ${response.distribution_human}${agePart}`;
        }
        // wb57: include the estimated stats value in the mini-profile
        // banner. Prefer bs_estimate_human (premium-tier formatted
        // string like "5.08b"); fall back to formatting bs_estimate
        // ourselves via ffs_format_number_short. Either way the stats
        // appear inline next to the FF score so members can see the
        // raw stat estimate without hovering or opening a profile.
        let statsLine = "";
        if (response.bs_estimate_human) {
          statsLine = ` Stats: ${response.bs_estimate_human}`;
        } else if (response.bs_estimate != null) {
          const formatted = ffs_format_number_short(Number(response.bs_estimate));
          if (formatted) statsLine = ` Stats: ${formatted}`;
        }
        // wb56: FF score banner stays in .description (bottom of card).
        // wb57: stats appended inline.
        const message = `FF ${ff_string} (${difficulty})${statsLine} ${fresh}${distLine}`;
        const description = $(mini).find(".description");
        const desc = $("<span></span>", { class: "ff-scouter-mini-ff" });
        desc.text(message);
        $(description).append(desc);
      }
    }
  }

  const check_mutation = async function (node) {
    if (!node.querySelectorAll) {
      return;
    }
    var honor_bars = Array.from(node.querySelectorAll(".honor-text-wrap"));
    var name_elems = Array.from(node.querySelectorAll(".user.name"));
    // wb51: skip FFS gauge injection on the Crimes tab. User feedback
    // that the stats chip in each OC slot clutters the crime card
    // layout. Scope check matches tab=crimes in either the hash
    // (Torn's React router) or the query string (legacy deep link).
    const onCrimesTab = /tab=crimes/i.test(location.hash + location.search)
      || !!document.getElementById('faction-crimes-root');
    if (onCrimesTab) {
      return;
    }
    if (honor_bars.length > 0) {
      await apply_ff_gauge(
        Array.from(node.querySelectorAll(".honor-text-wrap")),
      );
    } else {
      if (
        window.location.href.startsWith("https://www.torn.com/factions.php")
      ) {
        await apply_ff_gauge(Array.from(node.querySelectorAll(".member")));
      } else if (
        window.location.href.startsWith("https://www.torn.com/companies.php")
      ) {
        await apply_ff_gauge(Array.from(node.querySelectorAll(".employee")));
      } else if (
        window.location.href.startsWith(
          "https://www.torn.com/page.php?sid=competition#/team",
        )
      ) {
        await apply_ff_gauge(
          Array.from(node.querySelectorAll(".name___H_bss")),
        );
      } else if (
        window.location.href.startsWith("https://www.torn.com/joblist.php")
      ) {
        await apply_ff_gauge(Array.from(node.querySelectorAll(".employee")));
      } else if (
        window.location.href.startsWith("https://www.torn.com/messages.php")
      ) {
        await apply_ff_gauge(Array.from(node.querySelectorAll(".name")));
      } else if (
        window.location.href.startsWith("https://www.torn.com/index.php")
      ) {
        await apply_ff_gauge(Array.from(node.querySelectorAll(".name")));
      } else if (
        window.location.href.startsWith("https://www.torn.com/hospitalview.php")
      ) {
        await apply_ff_gauge(Array.from(node.querySelectorAll(".name")));
      } else if (
        window.location.href.startsWith(
          "https://www.torn.com/page.php?sid=UserList",
        )
      ) {
        await apply_ff_gauge(Array.from(node.querySelectorAll(".name")));
      } else if (
        window.location.href.startsWith("https://www.torn.com/bounties.php")
      ) {
        await apply_ff_gauge(Array.from(node.querySelectorAll(".target")));
        await apply_ff_gauge(Array.from(node.querySelectorAll(".listed")));
      } else if (
        window.location.href.startsWith(
          "https://www.torn.com/page.php?sid=attackLog",
        )
      ) {
        // wb50: user requested the FF gauge be hidden on attack-log
        // pages — the chip clutters the participant list. No-op.
      } else if (
        window.location.href.startsWith("https://www.torn.com/forums.php")
      ) {
        await apply_ff_gauge(Array.from(node.querySelectorAll(".last-poster")));
        await apply_ff_gauge(Array.from(node.querySelectorAll(".starter")));
        await apply_ff_gauge(Array.from(node.querySelectorAll(".last-post")));
        await apply_ff_gauge(Array.from(node.querySelectorAll(".poster")));
      } else if (window.location.href.includes("page.php?sid=hof")) {
        await apply_ff_gauge(
          Array.from(node.querySelectorAll('[class^="userInfoBox__"]')),
        );
      } else if (name_elems.length > 0) {
        // Fallback for anyone without honor bars enabled
        await apply_ff_gauge(Array.from(node.querySelectorAll(".user.name")));
      }
    }
    if (
      window.location.href.startsWith(
        "https://www.torn.com/page.php?sid=ItemMarket",
      )
    ) {
      await apply_ff_gauge(
        Array.from(
          node.querySelectorAll(
            "div.bazaar-listing-card div:first-child div:first-child > a",
          ),
        ),
      );
    }

    if (!node?.parentNode?.querySelectorAll) {
      return;
    }
    var mini_profiles = Array.from(
      node.parentNode.querySelectorAll(
        '[class^="profile-mini-_userProfileWrapper_"]',
      ),
    );
    if (mini_profiles.length > 0) {
      for (const mini of mini_profiles) {
        if (!mini.classList.contains("ff-processed")) {
          mini.classList.add("ff-processed");

          const player_id = get_player_id_in_element(mini);
          apply_to_mini_profile(mini);
          await update_ff_cache([player_id], () => {
            apply_to_mini_profile(mini);
          });
        }
      }
    }
  };

  const ff_gauge_observer = new MutationObserver(async (mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        check_mutation(node);
      }
    }
  });

  ff_gauge_observer.observe(document, {
    attributes: false,
    childList: true,
    characterData: false,
    subtree: true,
  });

  check_mutation(document.body);

  // wb11: delayed probes. Profile pages render late (React hydration);
  // init-time probe on wb10 showed 0 honor elements, but we know they
  // appear later. Fire at 0s (parity with wb10) + 1s + 3s + 10s so we
  // catch whenever Torn renders the honor.
  function ffs_probe(tag) {
    // wb12/wb13: paint unpainted honor-text-wraps at each delayed tick.
    // apply_ff_gauge normally resolves player_id from child anchors, but
    // on individual /profiles.php?XID=… pages the honor element has no
    // profile-link descendant — the profile subject IS the page owner,
    // so XID comes from location.href. Tag the element with a data-
    // attribute we can detect in get_player_id_in_element, or — simpler —
    // stash an anchor inside so the existing resolver works.
    try {
      const unpainted = Array.from(document.querySelectorAll(".honor-text-wrap"))
        .filter(el => !el.classList.contains("ff-scouter-indicator"));
      if (unpainted.length > 0) {
        const profileXidMatch = /\/profiles\.php\?XID=(\d+)/i.exec(location.href);
        if (profileXidMatch) {
          const pid = profileXidMatch[1];
          // Inject an invisible anchor so get_player_id_in_element can
          // find the XID for the page-subject honor. Idempotent check.
          for (const el of unpainted) {
            if (!el.querySelector('a[href*="XID="]')) {
              const hiddenA = document.createElement("a");
              hiddenA.href = `/profiles.php?XID=${pid}`;
              hiddenA.style.display = "none";
              hiddenA.setAttribute("data-ffs-fork-inject", "1");
              el.appendChild(hiddenA);
            }
          }
        }
        apply_ff_gauge(unpainted);
      }
    } catch (_) {}
    try {
      const honorClasses = [];
      document.querySelectorAll('[class*="honor" i]').forEach(el => {
        const sel = el.tagName + "." + String(el.className || "").slice(0, 80);
        if (honorClasses.length < 12) honorClasses.push(sel);
      });
      // Also probe for name-related elements so we know where to
      // inject if honor is truly absent on profile pages.
      const nameClasses = [];
      document.querySelectorAll('[class*="name" i], [class*="user" i], [class*="profile-wrapper" i]').forEach(el => {
        if (nameClasses.length >= 8) return;
        const sel = el.tagName + "." + String(el.className || "").slice(0, 80);
        nameClasses.push(sel);
      });
      const payload = {
        tag,
        href: location.href,
        pathname: location.pathname,
        bodyLen: document.body?.innerHTML?.length ?? 0,
        honorTextWrapCount: document.querySelectorAll(".honor-text-wrap").length,
        honorWrapCount: document.querySelectorAll(".honorWrap").length,
        anyHonor: document.querySelectorAll('[class*="honor" i]').length,
        userNameCount: document.querySelectorAll(".user.name").length,
        honorSample: honorClasses,
        nameSample: nameClasses,
        scriptVersion: "2.73.0-wb51",
      };
      GM_xmlhttpRequest({
        method: "POST",
        url: "https://tornwar.com/api/debug/client-log",
        headers: { "Content-Type": "application/json" },
        data: JSON.stringify({ tag: "ffs-banner-init", data: payload }),
        onload: function(){}, onerror: function(){},
      });
    } catch (_) {}
  }
  ffs_probe("init");
  setTimeout(() => ffs_probe("1s"), 1000);
  setTimeout(() => ffs_probe("3s"), 3000);
  setTimeout(() => ffs_probe("10s"), 10000);

  // ─────────────────────────────────────────────────────────────────────
  // WARBOARD FORK (wb16): replace "Traveling to X" status text with a
  // live arrival-time countdown. Ported from the modded FFS variant's
  // updateMemberStatus / updateAllMemberTimers. Uses Torn's v2 faction
  // members endpoint (status.until provides the landing UNIX time);
  // re-polls every 30s per faction and re-renders countdown every 1s.
  // ─────────────────────────────────────────────────────────────────────
  const FFS_TRAVEL_POLL_MS = 30_000;
  const _ffsMemberCountdowns = {};     // userID → unix landing time
  const _ffsMemberAbbr = {};           // userID → country abbrev
  const _ffsMemberReturning = {};      // userID → bool
  const _ffsOriginalStatusHtml = {};   // liElement reference → original innerHTML
  // wb44: hospital / jail release-time tracking (ported from Torn War Stuff
  // Enhanced — live HH:MM:SS countdown + flash when <5 min remain).
  const _ffsMemberHospitalUntil = {};  // userID → unix release time
  const _ffsMemberHospitalState = {};  // userID → 'Hospital' | 'Jail'

  // wb79: catch defensive hospital extensions. Torn hospital timers don't
  // stack (longest wins) — ipecac syrup / a wrong blood bag SET the timer to
  // ~60-90 min, so a target about to be released can jump back to a long
  // timer. The 30s poll + Torn's ~30s API service cache mean a real extension
  // can lag ~60s; long enough for the OLD short timer to hit 0 and (pre-wb79)
  // falsely mark the target released/attackable. Fix: when a chip is near or
  // past release, force a CACHE-BUSTED re-fetch of the tracked factions so the
  // new status.until lands in ~seconds, and NEVER release on the local
  // countdown alone — only the authoritative poll decides release.
  const FFS_IMMINENT_THRESHOLD_SEC = 120;  // fast-refresh once a hosp/jail chip is within 120s of release
  const FFS_IMMINENT_REFRESH_MS = 10_000;  // min gap between forced re-fetches (rate-limit guard)
  const FFS_LIVE_WINS_MS = 30_000;         // after a cache-busted (live) refresh, ignore the slower cached
                                           // 30s poll for this long so it can't clobber the fresh until
  const _ffsTrackedFactionIds = new Set(); // factions pollAll is currently watching
  const _ffsFactionLiveAt = {};            // factionId → ts of last applied cache-busted (live) response
  let _ffsLastImminentRefresh = 0;

  // wb44: localStorage cache so countdowns appear instantly on reload
  // without waiting for the 30s poll. Keyed per-faction so scouting
  // multiple factions doesn't cross-pollute. TTL 5min — older data is
  // discarded since arrival times / release times would be wrong.
  const FFS_CACHE_TTL_MS = 5 * 60_000;
  const _ffsCacheKey = (fid) => `ffs_status_cache_v1_${fid}`;
  let _ffsCacheSaveTimer = null;
  function ffs_saveStatusCache(factionId) {
    if (!factionId) return;
    if (_ffsCacheSaveTimer) return;
    _ffsCacheSaveTimer = setTimeout(() => {
      _ffsCacheSaveTimer = null;
      try {
        const payload = {
          ts: Date.now(),
          countdowns: _ffsMemberCountdowns,
          abbr: _ffsMemberAbbr,
          returning: _ffsMemberReturning,
          hospitalUntil: _ffsMemberHospitalUntil,
          hospitalState: _ffsMemberHospitalState,
        };
        localStorage.setItem(_ffsCacheKey(factionId), JSON.stringify(payload));
      } catch (_) { /* quota or storage disabled */ }
    }, 2000);
  }
  function ffs_loadStatusCache(factionId) {
    if (!factionId) return;
    try {
      const raw = localStorage.getItem(_ffsCacheKey(factionId));
      if (!raw) return;
      const data = JSON.parse(raw);
      if (!data || !data.ts || (Date.now() - data.ts) > FFS_CACHE_TTL_MS) {
        localStorage.removeItem(_ffsCacheKey(factionId));
        return;
      }
      Object.assign(_ffsMemberCountdowns, data.countdowns || {});
      Object.assign(_ffsMemberAbbr, data.abbr || {});
      Object.assign(_ffsMemberReturning, data.returning || {});
      Object.assign(_ffsMemberHospitalUntil, data.hospitalUntil || {});
      Object.assign(_ffsMemberHospitalState, data.hospitalState || {});
    } catch (_) { /* malformed cache — ignore */ }
  }

  function ffs_abbreviateCountry(name) {
    if (!name) return "";
    if (name.trim().toLowerCase() === "switzerland") return "Switz";
    const words = name.trim().split(/\s+/);
    if (words.length === 1) return words[0];
    return words.map((w) => w[0].toUpperCase()).join("");
  }

  function ffs_formatCountdown(ms) {
    // wb26: compact adaptive format so the countdown fits a narrow
    // status column. ≥1h → 1h23m (5 chars). <1h → 23:45 (5 chars).
    // <1m → 0:45 (4 chars). Same width across rows keeps list tidy.
    const s = Math.max(0, Math.floor(ms / 1000));
    if (s >= 3600) {
      const h = Math.floor(s / 3600);
      const m = Math.floor((s % 3600) / 60);
      return `${h}h${String(m).padStart(2, "0")}m`;
    }
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${String(sec).padStart(2, "0")}`;
  }

  const FFS_PLANE_SVG = '<svg class="ffs-plane" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 576 512"><path d="M482.3 192c34.2 0 93.7 29 93.7 64c0 36-59.5 64-93.7 64l-116.6 0L265.2 495.9c-5.7 10-16.3 16.1-27.8 16.1l-56.2 0c-10.6 0-18.3-10.2-15.4-20.4l49-171.6L112 320 68.8 377.6c-3 4-7.8 6.4-12.8 6.4l-42 0c-7.8 0-14-6.3-14-14c0-1.3 .2-2.6 .5-3.9L32 256 .5 145.9c-.4-1.3-.5-2.6-.5-3.9c0-7.8 6.3-14 14-14l42 0c5 0 9.8 2.4 12.8 6.4L112 192l102.9 0-49-171.6C162.9 10.2 170.6 0 181.2 0l56.2 0c11.5 0 22.1 6.2 27.8 16.1L365.7 192l116.6 0z"/></svg>';

  function ffs_fetchFactionMembers(factionId, bust) {
    // key is the FFS-registered Torn API key — same one used elsewhere
    // in this script. Works with Limited/Full Access.
    if (!key) return Promise.reject(new Error("no key"));
    let url = `https://api.torn.com/v2/faction/${factionId}/members?striptags=true&key=${encodeURIComponent(key)}`;
    // wb79: bust Torn's ~30s service cache with a unique timestamp so an
    // imminent re-fetch sees the LIVE status.until (catches a last-second
    // hospital extension). Sanctioned cache-buster; a cache MISS costs one
    // call, kept in check by the FFS_IMMINENT_REFRESH_MS debounce.
    if (bust) url += `&timestamp=${Date.now()}`;
    return fetch(url).then(r => r.json());
  }

  // wb79: debounced, cache-busted re-fetch of the factions pollAll is watching.
  // Fired by the paint loop when a hospital/jail chip is near or past release
  // so a defensive extension (ipecac / wrong blood bag) is reflected within
  // seconds instead of up to ~60s. The debounce caps the extra API load (≈ one
  // refresh cycle per 10s, hitting the 1-2 tracked factions). ffs_updateFaction-
  // TravelData is a hoisted declaration below, so it's callable here at runtime.
  function ffs_imminentHospRefresh() {
    const now = Date.now();
    if (now - _ffsLastImminentRefresh < FFS_IMMINENT_REFRESH_MS) return;
    if (_ffsTrackedFactionIds.size === 0) return;
    _ffsLastImminentRefresh = now;
    for (const fid of _ffsTrackedFactionIds) {
      try { ffs_updateFactionTravelData(fid, true); } catch (_) {}
    }
  }

  function ffs_recordMemberTravel(member) {
    if (!member || !member.status) return;
    const state = member.status.state;
    if (state === "Traveling") {
      const desc = member.status.description || "";
      let loc = "", returning = false;
      if (desc.startsWith("Returning to Torn from ")) {
        loc = desc.replace("Returning to Torn from ", "");
        returning = true;
      } else if (desc.startsWith("Traveling to ")) {
        loc = desc.replace("Traveling to ", "");
      }
      // wb35: store FULL country name (no abbreviation) to match the
      // DOM-derived cache in ffs_detectAndFetchTravellersFromDom, so the
      // click-to-toggle UX always sees the same string regardless of source.
      _ffsMemberAbbr[member.id] = loc.trim();
      _ffsMemberReturning[member.id] = returning;
      // wb24: fix TypeError — `typeof null === "object"` in JS, so the
      // old guard didn't prevent d.until from throwing when details=null.
      // Also: the last-action unix timestamp (member.last_action.timestamp)
      // combined with a hard-coded travel duration per method MIGHT work
      // as a proxy if Torn stops returning until.
      const s = member.status || {};
      const d = (s.details && typeof s.details === "object") ? s.details : {};
      const candidates = [
        s.until,
        d.until,
        d.arrival_time,
        d.arrival,
        d.arrival_at,
        d.end,
        d.timestamp,
        d.eta,
      ];
      let until = null;
      for (const v of candidates) {
        const n = parseInt(v, 10);
        if (isFinite(n) && n > 0) { until = n; break; }
      }
      if (until) {
        _ffsMemberCountdowns[member.id] = until;
      } else {
        // wb35: Torn v2 returns status.until=null for travelling members,
        // so ask FFScouter for the landing time directly instead of waiting
        // for the DOM text to contain "Traveling to X" (which doesn't appear
        // on war/rank pages).
        ffs_fetchFlightForMember(String(member.id));
      }
    } else {
      delete _ffsMemberCountdowns[member.id];
      delete _ffsMemberAbbr[member.id];
      delete _ffsMemberReturning[member.id];
    }
    // wb44: hospital / jail release tracking. Independent of travel.
    if (state === "Hospital" || state === "Jail") {
      const until = parseInt(member.status.until, 10);
      if (isFinite(until) && until > 0) {
        _ffsMemberHospitalUntil[member.id] = until;
        _ffsMemberHospitalState[member.id] = state;
      }
    } else {
      delete _ffsMemberHospitalUntil[member.id];
      delete _ffsMemberHospitalState[member.id];
    }
  }

  // wb25: per-member FFScouter flight fetcher. Torn's v2 faction/members
  // endpoint returns status.until=null and status.details=null for
  // travelling members, so we source the landing time from FFScouter's
  // player-flights endpoint instead (same one wb15 uses for profile-
  // page countdowns).
  const _ffsFlightFetchInflight = new Set();
  const _ffsFlightFetchFailures = new Map(); // uid → lastFailTs
  let _ffsFlightDiagCount = 0;
  async function ffs_fetchFlightForMember(uid) {
    if (_ffsMemberCountdowns[uid]) return;
    if (_ffsFlightFetchInflight.has(uid)) return;
    const lastFail = _ffsFlightFetchFailures.get(uid) || 0;
    if (Date.now() - lastFail < 60_000) return;
    _ffsFlightFetchInflight.add(uid);
    try {
      const url = `${BASE_URL}/api/v1/player-flights?key=${key}&target=${uid}`;
      await new Promise((resolve) => {
        rD_xmlhttpRequest({
          method: "GET",
          url,
          onload: (resp) => {
            let outcome = "ok", err = null, landingTs = null, keys = null;
            try {
              if (!resp || resp.status !== 200) throw new Error("HTTP " + resp?.status);
              const data = JSON.parse(resp.responseText);
              if (data) keys = Object.keys(data);
              if (!data || data.error) throw new Error(data?.error || "error");
              if (!data.current) throw new Error("no current (not travelling per FFS)");
              const f = data.current;
              // wb49: tighten landing estimate. FFS returns a 10-20 min
              // range (earliest ↔ latest) reflecting uncertainty over
              // whether the flyer has the Book of Rapid Travel (0.75x
              // duration). With FFS's book_likely_being_used flag we
              // can pick the right endpoint:
              //   book in use    → earliest  (shortened trip)
              //   no book        → latest    (full trip)
              //   flag missing   → midpoint  (best expected-value)
              const earliest = Number(f.earliest_arrival_time) || 0;
              const latest   = Number(f.latest_arrival_time)   || 0;
              if (f.book_likely_being_used === true && earliest > 0) {
                landingTs = earliest;
              } else if (f.book_likely_being_used === false && latest > 0) {
                landingTs = latest;
              } else if (earliest > 0 && latest > 0) {
                landingTs = Math.floor((earliest + latest) / 2);
              } else {
                landingTs = latest || earliest;
              }
              if (landingTs) {
                // wb82: FREEZE the landing time per flight. A flight's arrival
                // is fixed, but FFScouter's book_likely_being_used flag (and its
                // earliest/latest bounds) can change between our 30s re-fetches,
                // flipping the chosen endpoint (earliest/midpoint/latest) and
                // making the members-list countdown JUMP/RESET by up to the
                // ~10-min earliest↔latest gap. Keep the first value for this
                // flight; the members-endpoint clears _ffsMemberCountdowns when
                // the member stops travelling, so a NEW flight re-derives fresh.
                if (_ffsMemberCountdowns[uid] == null) _ffsMemberCountdowns[uid] = landingTs;
                // wb81: the fetch response carries the destination in
                // status_description ("Traveling from Torn to Mexico" /
                // "...from UAE to Torn"). Extract country + direction so the
                // click-to-show-country toggle works on the war/ranked page,
                // where the native status is just a flag (no parseable
                // "Traveling to X" text for the DOM fallback to read).
                const _sd = String(f.status_description || "");
                const _mm = _sd.match(/from\s+(.+?)\s+to\s+(.+?)\s*$/i);
                if (_mm) {
                  const _from = _mm[1].trim(), _to = _mm[2].trim();
                  if (/^torn$/i.test(_to)) {
                    _ffsMemberAbbr[uid] = _from; _ffsMemberReturning[uid] = true;
                  } else {
                    _ffsMemberAbbr[uid] = _to; _ffsMemberReturning[uid] = false;
                  }
                }
              } else {
                throw new Error("current present but no arrival timestamps");
              }
            } catch (e) {
              outcome = "failed";
              err = String(e?.message || e);
              _ffsFlightFetchFailures.set(uid, Date.now());
            }
            // Diag first N fetches so we see why fetches don't populate.
            if (_ffsFlightDiagCount < 8) {
              _ffsFlightDiagCount++;
              ffs_travelDiag({
                source: "flight-fetch",
                uid, outcome, err,
                landingTs,
                respStatus: resp?.status,
                respBody: resp?.responseText ? String(resp.responseText).slice(0, 240) : null,
              });
            }
            resolve();
          },
          onerror: (err) => {
            _ffsFlightFetchFailures.set(uid, Date.now());
            if (_ffsFlightDiagCount < 8) {
              _ffsFlightDiagCount++;
              ffs_travelDiag({ source: "flight-fetch", uid, outcome: "network-error", err: String(err?.error || err) });
            }
            resolve();
          },
        });
      });
    } finally {
      _ffsFlightFetchInflight.delete(uid);
    }
  }

  function ffs_detectAndFetchTravellersFromDom() {
    if (!key) return;
    // Walk every row with a profile link + status cell containing "Traveling"
    // or "Returning". This works even when Torn's v2 API hides the landing
    // time (null status.until) — we just need to know WHICH members are
    // travelling and then ask ffscouter for each one's arrival.
    const rows = document.querySelectorAll(
      ".enemy-faction .members-list li, "
      + ".your-faction .members-list li, "
      + ".members-list .table-row, "
      + ".members-list li, "
      + "[class*='members-list' i] .table-row, "
      + "[class*='members-list' i] li, "
      + "[class*='members-cont' i] li"
    );
    const seen = new Set();
    rows.forEach((row) => {
      const a = row.querySelector('a[href*="XID="]');
      if (!a) return;
      const m = a.href.match(/XID=(\d+)/);
      if (!m) return;
      const uid = m[1];
      if (seen.has(uid)) return;
      seen.add(uid);
      const statusEl = row.querySelector(".status")
        || row.querySelector('[class*="status" i]');
      if (!statusEl) return;
      const text = (statusEl.textContent || "").trim();
      // Also accept abbreviated forms Torn sometimes uses.
      if (!/travel|returning|in\s+[A-Z]/i.test(text)) return;

      // Derive country + returning hint from the status text, so we can
      // paint "✈ UK hh:mm:ss" without needing a separate Torn API call.
      if (!_ffsMemberAbbr[uid]) {
        let loc = "", returning = false;
        const retMatch = text.match(/Returning to Torn from (.+)/i);
        const trvMatch = text.match(/Traveling to (.+)/i);
        const abroadMatch = text.match(/^In (.+)/i);
        if (retMatch) { loc = retMatch[1]; returning = true; }
        else if (trvMatch) { loc = trvMatch[1]; }
        else if (abroadMatch) { loc = abroadMatch[1]; }
        // wb27: use the FULL country name — marquee will scroll it if
        // the status cell is too narrow, instead of truncating.
        _ffsMemberAbbr[uid] = loc.trim();
        _ffsMemberReturning[uid] = returning;
      }

      // Only fire ffscouter fetch for actively-in-flight members.
      if (/travel|returning/i.test(text)) {
        ffs_fetchFlightForMember(uid);
      }
    });
  }

  async function ffs_updateFactionTravelData(factionId, bust) {
    try {
      const data = await ffs_fetchFactionMembers(factionId, bust);
      if (!data || data.error) {
        ffs_travelDiag({
          source: "fetch-error",
          factionId,
          err: data?.error?.error || "no-data",
        });
        return;
      }
      // wb79: live-wins guard. The 30s poll is NOT cache-busted, so Torn can
      // serve it a snapshot up to ~30s stale. If a cache-busted (live) refresh
      // for this faction landed within the last FFS_LIVE_WINS_MS, drop this
      // cached response — otherwise a late-arriving stale poll could overwrite
      // a freshly-extended status.until (or delete a still-hospitalised member),
      // transiently re-introducing the false-release this fix removes. The
      // busted refresh re-fetches the whole faction anyway, so nothing is lost.
      const now = Date.now();
      if (!bust && (now - (_ffsFactionLiveAt[factionId] || 0) < FFS_LIVE_WINS_MS)) {
        return;
      }
      if (bust) _ffsFactionLiveAt[factionId] = now;
      const list = Array.isArray(data.members) ? data.members : [];
      let travelingCount = 0;
      let recorded = 0;
      let firstTravellingSample = null;
      for (const m of list) {
        const wasRecordedCount = Object.keys(_ffsMemberCountdowns).length;
        ffs_recordMemberTravel(m);
        if (Object.keys(_ffsMemberCountdowns).length > wasRecordedCount) recorded++;
        if (m?.status?.state === "Traveling") {
          travelingCount++;
          if (!firstTravellingSample) {
            // Stash the first travelling member's shape so we can see
            // exactly what fields are available.
            firstTravellingSample = {
              keys: Object.keys(m),
              id: m.id,
              user_id: m.user_id,
              name: m.name,
              statusKeys: Object.keys(m.status || {}),
              statusState: m.status?.state,
              statusDescription: m.status?.description,
              statusUntil: m.status?.until,
              statusLast: m.status?.last,
              statusDetails: m.status?.details,
              statusDetailsType: typeof m.status?.details,
              statusDetailsKeys: m.status?.details && typeof m.status.details === "object"
                ? Object.keys(m.status.details) : null,
              planeImageType: m.status?.plane_image_type,
              // Full serialized status object, 500 char cap.
              statusJSON: (function(){ try { return JSON.stringify(m.status).slice(0, 500); } catch(_){return null;}})(),
            };
          }
        }
      }
      ffs_travelDiag({
        source: "fetch-ok",
        factionId,
        membersCount: list.length,
        travelingCount,
        recorded,
        firstTravellingSample,
      });
      // wb44: persist latest countdowns + hospital state to localStorage
      // so a reload pre-fills instantly without waiting for the 30s poll.
      ffs_saveStatusCache(factionId);
    } catch (e) {
      ffs_travelDiag({ source: "fetch-threw", factionId, err: String(e?.message || e) });
    }
  }

  // wb68: stamp the running script version into diags so the server log shows
  // exactly which build a user has installed (PDA/Tampermonkey don't always
  // auto-update). KEEP IN SYNC with the @version header on every bump.
  const SCRIPT_VERSION = '2.73.30';

  // wb17: periodic diag post so we can see whether the paint fires and
  // how many rows / travelling members it finds.
  let _ffsTravelDiagCount = 0;
  function ffs_travelDiag(payload) {
    if (_ffsTravelDiagCount > 20) return;
    _ffsTravelDiagCount++;
    try {
      GM_xmlhttpRequest({
        method: "POST",
        url: "https://tornwar.com/api/debug/client-log",
        headers: { "Content-Type": "application/json" },
        data: JSON.stringify({ tag: "ffs-travel-diag", data: payload }),
        onload: function(){}, onerror: function(){},
      });
    } catch (_) {}
  }

  // wb67: dedicated diag for the hide filter. Separate budget (ffs_travelDiag's
  // 20-cap is spent at load), throttled, and only called when the filter
  // over-hides — so it survives to capture the bug rather than logging at load.
  let _ffsFilterDiagN = 0, _ffsFilterDiagAt = 0;
  function ffs_filterDiag(payload) {
    if (_ffsFilterDiagN > 25) return;
    const now = Date.now();
    if (now - _ffsFilterDiagAt < 1500) return;
    _ffsFilterDiagAt = now; _ffsFilterDiagN++;
    try {
      GM_xmlhttpRequest({
        method: "POST",
        url: "https://tornwar.com/api/debug/client-log",
        headers: { "Content-Type": "application/json" },
        data: JSON.stringify({ tag: "ffs-filter-state", data: payload }),
        onload: function(){}, onerror: function(){},
      });
    } catch (_) {}
  }

  // wb71: lightweight, high-frequency countdown refresh. Updates ONLY the
  // visible hospital/jail timer text from the release timestamp stamped on each
  // chip (data-ffs-until) — independent of the heavy 1s paint/sort/hide loop, so
  // the HH:MM:SS flips within ~250ms of real time instead of lagging up to 1s.
  function ffs_tickCountdowns() {
    let now;
    try { now = ffs_nowSecFloat(); } catch (_) { return; } // wb78: float secs + round → no ~0.5s flooring bias
    const chips = document.querySelectorAll('a.ffs-hosp-status[data-ffs-until]');
    for (const chip of chips) {
      const until = parseInt(chip.dataset.ffsUntil, 10);
      if (!Number.isFinite(until)) continue;
      const remaining = Math.round(until - now);
      if (remaining <= 0) continue; // let the heavy paint loop restore the cell
      const val = chip.querySelector('.ffs-hosp-val');
      if (!val) continue;
      const h = Math.floor(remaining / 3600);
      const m = Math.floor((remaining % 3600) / 60);
      const s = remaining % 60;
      const timeStr = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
      if (val.textContent !== timeStr) val.textContent = timeStr;
      const imminent = remaining < 300;
      if (chip.classList.contains('imminent') !== imminent) chip.classList.toggle('imminent', imminent);
    }
    // wb72: travel / landing countdowns — only while the chip shows the time
    // (skip when toggled to the country label). Keep data-ffs-time fresh so the
    // click-to-toggle still shows the right value.
    const travel = document.querySelectorAll('.ffs-travel-status[data-ffs-land]');
    for (const chip of travel) {
      if (chip.dataset.ffsShowCountry === '1') continue;
      const land = parseInt(chip.dataset.ffsLand, 10);
      if (!Number.isFinite(land)) continue;
      const remMs = (land - now) * 1000;
      if (remMs <= 0) continue;
      const val = chip.querySelector('.ffs-mq-value');
      if (!val) continue;
      const txt = ffs_formatCountdown(remMs);
      if (val.textContent !== txt) val.textContent = txt;
      chip.dataset.ffsTime = txt;
    }
  }

  // wb80: kill the ✈ flight-time flicker on faction/war pages. The chips live in
  // React-owned status cells, so a re-render wipes them and the 1s repaint left
  // them gone for up to ~1s. A scoped observer on the member-list container
  // re-paints within a frame, so a wiped chip is restored almost instantly. The
  // sort it triggers is signature-guarded (no-op when stable), so no extra churn.
  let _ffsTravelObs = null, _ffsTravelObsTarget = null, _ffsRepaintRaf = false;
  function _ffsScheduleRepaint() {
    if (_ffsRepaintRaf) return;
    _ffsRepaintRaf = true;
    requestAnimationFrame(() => { _ffsRepaintRaf = false; try { ffs_paintTravelCountdowns(); } catch (_) {} });
  }
  function _ffsAttachTravelObserver() {
    try {
      const cont = document.querySelector(
        "ul.f-war-list, .enemy-faction [class*='members-list' i], .your-faction [class*='members-list' i], "
        + "[class*='members-list' i], [class*='members-cont' i]"
      );
      if (!cont) { // navigated off the member list — drop the now-detached observer
        if (_ffsTravelObs) { _ffsTravelObs.disconnect(); _ffsTravelObs = null; _ffsTravelObsTarget = null; }
        return;
      }
      if (_ffsTravelObsTarget === cont && _ffsTravelObs) return; // already watching this container
      if (_ffsTravelObs) _ffsTravelObs.disconnect();
      _ffsTravelObs = new MutationObserver(_ffsScheduleRepaint);
      _ffsTravelObs.observe(cont, { childList: true, subtree: true });
      _ffsTravelObsTarget = cont;
    } catch (_) {}
  }

  function ffs_paintTravelCountdowns() {
    _ffsAttachTravelObserver(); // wb80: keep the re-render observer attached to the live list
    // Matches member list rows on:
    //   war.php                      (.enemy-faction / .your-faction)
    //   factions.php?ID=XX           (.members-list > .table-body > .table-row)
    //   factions.php?step=your       (varies — broad fallback below)
    const rows = document.querySelectorAll(
      ".enemy-faction .members-list li, "
      + ".your-faction .members-list li, "
      + ".members-list .table-row, "
      + ".members-list li, "
      // wb18: broader fallback — any row-ish element inside a
      // member-list-ish container that also has a profile-link child.
      + "[class*='members-list' i] .table-row, "
      + "[class*='members-list' i] li, "
      + "[class*='members-cont' i] li"
    );
    let painted = 0, skippedNoAnchor = 0, skippedNoStatus = 0, notTraveling = 0;
    rows.forEach(row => {
      const a = row.querySelector('a[href*="XID="]');
      if (!a) { skippedNoAnchor++; return; }
      const m = a.href.match(/XID=(\d+)/);
      if (!m) { skippedNoAnchor++; return; }
      const uid = m[1];
      const statusEl = row.querySelector(".status")
        || row.querySelector('[class*="status" i]');
      if (!statusEl) { skippedNoStatus++; return; }

      const until = _ffsMemberCountdowns[uid];
      if (until) {
        painted++;
        const remaining = (until - ffs_nowSec()) * 1000;
        const countdownText = ffs_formatCountdown(remaining);
        const countryText = _ffsMemberAbbr[uid] || "";
        const isReturning = !!_ffsMemberReturning[uid];
        const returningCls = isReturning ? " returning" : "";

        // wb29: marquee abandoned. Default: just plane + countdown.
        // Click toggles to country name. State persists on the
        // element via dataset.ffsShowCountry.
        let statusSpan = statusEl.querySelector(".ffs-travel-status");
        const valueSpan = statusEl.querySelector(".ffs-mq-value");

        // wb32: parse country fresh every paint from three sources in
        // priority order so clicks can toggle instantly, no 30s lag:
        //   1. _ffsMemberAbbr cache (in-memory)
        //   2. Live statusEl.textContent (still "Traveling to X" on first
        //      paint — BEFORE we overwrite innerHTML below)
        //   3. Preserved dataset.ffsTravelOriginal (post-repaint fallback)
        let effectiveCountry = countryText;
        let effectiveReturning = isReturning;
        if (!effectiveCountry) {
          const liveText = (statusEl.textContent || "").trim();
          const rmL = liveText.match(/Returning to Torn from (.+)/i);
          const tmL = liveText.match(/Traveling to (.+)/i);
          if (rmL) { effectiveCountry = rmL[1].trim(); effectiveReturning = true; }
          else if (tmL) { effectiveCountry = tmL[1].trim(); }
          if (!effectiveCountry && statusEl.dataset.ffsTravelOriginal) {
            const tmp = document.createElement("div");
            tmp.innerHTML = statusEl.dataset.ffsTravelOriginal;
            const origText = (tmp.textContent || "").trim();
            const rmO = origText.match(/Returning to Torn from (.+)/i);
            const tmO = origText.match(/Traveling to (.+)/i);
            if (rmO) { effectiveCountry = rmO[1].trim(); effectiveReturning = true; }
            else if (tmO) { effectiveCountry = tmO[1].trim(); }
          }
          if (effectiveCountry) {
            _ffsMemberAbbr[uid] = effectiveCountry;
            _ffsMemberReturning[uid] = effectiveReturning;
          }
        }
        const countryLabel = effectiveCountry
          ? (effectiveReturning ? `from ${effectiveCountry}` : `to ${effectiveCountry}`)
          : "";

        if (statusSpan && valueSpan) {
          statusSpan.dataset.ffsCountry = countryLabel;
          statusSpan.dataset.ffsTime = countdownText;
          statusSpan.dataset.ffsLand = String(until); // wb72: for the 250ms ticker
          const showCountry = statusSpan.dataset.ffsShowCountry === "1";
          // wb81: never blank the chip — if the country is somehow unknown,
          // keep showing the time so the plane doesn't shift to a lone icon.
          const desired = showCountry ? (countryLabel || countdownText) : countdownText;
          if (valueSpan.textContent !== desired) {
            valueSpan.textContent = desired;
          }
          statusSpan.classList.toggle("returning", effectiveReturning);
        } else {
          // wb43: only capture the original innerHTML if it has actual
          // content. Otherwise we might snapshot a React mid-render
          // (briefly empty) and then "restore" a permanent blank when
          // the member stops travelling. Skip injection this tick if
          // there's nothing to save — Torn will re-render and we'll
          // catch it on the next cycle.
          if (!statusEl.dataset.ffsTravelInjected) {
            const snapshot = statusEl.innerHTML;
            if (!snapshot || !snapshot.trim()) {
              return; // wait for Torn's React to render status before we overwrite
            }
            statusEl.dataset.ffsTravelOriginal = snapshot;
            statusEl.dataset.ffsTravelInjected = "1";
          }
          const escLabel = countryLabel.replace(/"/g, "&quot;");
          const retCls = effectiveReturning ? " returning" : "";
          statusEl.innerHTML =
            `<span class="ffs-travel-status${retCls}" `
            + `data-ffs-time="${countdownText}" `
            + `data-ffs-land="${until}" `
            + `data-ffs-country="${escLabel}" `
            + `data-ffs-show-country="0" `
            + `title="Click to toggle country / time">`
            + `${FFS_PLANE_SVG}`
            + `<span class="ffs-mq-value">${countdownText}</span>`
            + `</span>`;
        }
      } else if (statusEl.dataset.ffsTravelInjected) {
        // Member is no longer travelling — restore original. wb43: if
        // we cached an empty string (shouldn't happen anymore, but
        // defensively), don't blank the cell — leave React's current
        // content intact.
        const orig = statusEl.dataset.ffsTravelOriginal;
        if (orig && orig.trim()) {
          statusEl.innerHTML = orig;
        }
        delete statusEl.dataset.ffsTravelOriginal;
        delete statusEl.dataset.ffsTravelInjected;
      } else {
        // wb44: hospital / jail release timer. Active only when member
        // isn't travelling (travel takes priority on the same cell).
        const hospUntil = _ffsMemberHospitalUntil[uid];
        const hospState = _ffsMemberHospitalState[uid] || 'Hospital';
        if (hospUntil) {
          let remaining = Math.round(hospUntil - ffs_nowSecFloat()); // wb78: round, not floor (no ~0.5s bias)
          if (remaining <= 0) {
            // wb79: DON'T release on the local countdown alone. A target can
            // defensively extend hospital (ipecac / wrong blood bag) right
            // before release; status.until jumps, but our cached value is the
            // OLD short time until the next poll lands. Clamp at 0, KEEP the
            // chip showing 00:00:00, and force a cache-busted re-fetch. Release
            // is decided ONLY by the authoritative poll: ffs_recordMemberTravel
            // deletes the entry once state != Hospital, after which the
            // `else if (ffsHospInjected)` branch below restores React's cell.
            remaining = 0;
            ffs_imminentHospRefresh();
          } else if (remaining <= FFS_IMMINENT_THRESHOLD_SEC) {
            // wb79: near release — start fast-refreshing so a last-second
            // extension is caught before the old timer would expire.
            ffs_imminentHospRefresh();
          }
          const h = Math.floor(remaining / 3600);
          const m = Math.floor((remaining % 3600) / 60);
          const s = remaining % 60;
          const timeStr = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
          const imminent = remaining < 300;
          const jail = hospState === 'Jail';
          let hospSpan = statusEl.querySelector('.ffs-hosp-status');
          if (hospSpan) {
            hospSpan.dataset.ffsUntil = String(hospUntil); // wb71: for the 250ms lightweight ticker
            const valueSpan = hospSpan.querySelector('.ffs-hosp-val');
            if (valueSpan && valueSpan.textContent !== timeStr) valueSpan.textContent = timeStr;
            hospSpan.classList.toggle('imminent', imminent);
            hospSpan.classList.toggle('jail', jail);
          } else {
            if (!statusEl.dataset.ffsHospInjected) {
              const snapshot = statusEl.innerHTML;
              if (!snapshot || !snapshot.trim()) return;
              statusEl.dataset.ffsHospOriginal = snapshot;
              statusEl.dataset.ffsHospInjected = "1";
            }
            const cls = 'ffs-hosp-status' + (jail ? ' jail' : '') + (imminent ? ' imminent' : '');
            // wb47: chip becomes a link to the attack page so a click
            // lands you directly in attack flow (revive hunting UX).
            // Chip colour (red=hospital, grey=jail) still distinguishes state.
            const attackHref = `https://www.torn.com/page.php?sid=attack&user2ID=${uid}`;
            statusEl.innerHTML =
              `<a class="${cls}" href="${attackHref}" target="_blank" rel="noopener"`
              + ` data-ffs-until="${hospUntil}"`
              + ` title="${hospState} release \u2014 click to attack">`
              + `<span class="ffs-hosp-val">${timeStr}</span>`
              + `</a>`;
          }
          painted++;
        } else if (statusEl.dataset.ffsHospInjected) {
          // Member no longer hospitalised — restore original.
          const orig = statusEl.dataset.ffsHospOriginal;
          if (orig && orig.trim()) statusEl.innerHTML = orig;
          delete statusEl.dataset.ffsHospOriginal;
          delete statusEl.dataset.ffsHospInjected;
        } else {
          notTraveling++;
        }
      }
    });
    // Diag: only on the first 20 paint cycles after page load.
    ffs_travelDiag({
      href: location.href,
      rowCount: rows.length,
      painted, skippedNoAnchor, skippedNoStatus, notTraveling,
      travellingKnown: Object.keys(_ffsMemberCountdowns).length,
    });
    // wb48/wb61: after the paint pass, re-apply ordering. ffs_applyWarSort is
    // the single ordering authority: in war mode (after the user clicks FFS)
    // it keeps attackable→hospital→jail/travel and re-applies it every tick so
    // it survives React re-renders; otherwise it reproduces the original
    // hospital-release revive-hunt sort. Signature-guarded, so a stable list
    // is a no-op.
    ffs_applyWarSort(rows);
    // wb63: keep the hide-online/offline bar present and re-apply the filter
    // every tick so both survive Torn's React re-renders.
    if (ffs_isHideContext()) {
      ffs_injectHideControls();
      ffs_applyActivityFilter(rows);
    } else {
      ffs_clearActivityFilter(); // wb64: off member-list pages — no bar, no hidden rows
    }
  }

  // wb48/wb61: last-sorted signature per container so we skip DOM writes when
  // nothing changed (avoids visual thrash on every 1s paint tick). The
  // signature is mode + direction + resulting pid order, so a direction toggle
  // or a member moving between groups flips it and triggers exactly one
  // corrective re-sort.
  const _ffsSortSignatures = new WeakMap();

  // wb61: war-mode FFS sort state lives in module scope, NOT on the button —
  // the sort button is re-injected every 500ms (ffs_inject_sort_buttons) and
  // would otherwise reset direction to default. _ffsWarSortActive flips true
  // the first time the user clicks the FFS button in a war context; from then
  // on the 1s paint tick re-applies the war ordering so it survives Torn's
  // React re-renders. _ffsScoreCache holds FFS scores by pid so the tick never
  // has to await the async ffcache.get.
  let _ffsWarSortActive = false;
  let _ffsAppliedDesc = null;   // null = unclicked; true = strongest-first; false = weakest-first
  let _ffsPureStatSort = false; // set once the user clicks the FFS button: order by stats only, ignoring hospital/jail/travel status groups
  const _ffsScoreCache = {};    // pid (string) -> FFS score

  // wb63: hide online/offline activity filter (war page). Persisted across loads.
  let _ffsHideOnline  = ffs_parseBool(rD_getValue('ffs_hide_online', false));
  let _ffsHideOffline = ffs_parseBool(rD_getValue('ffs_hide_offline', false));
  let _ffsActivityDiagOnce = false; // wb64: one-shot detection diag per page load

  // wb61/wb64: are we on the ranked-war VIEW? Detect by URL ONLY. We used to
  // also check for the opponent-faction war banner, but that element is present
  // on EVERY faction page during a war (profile, members roster, etc.), which
  // leaked the war sort + the hide filter onto those pages (e.g. hiding 200+
  // roster members). The war view is factions.php?step=your&type=1#/war/rank —
  // uniquely identified by the type=1 query or the #/war/ hash. Roster/profile
  // pages have neither.
  function ffs_isWarContext() {
    return location.search.includes('type=1') || /\/war\//.test(location.hash);
  }

  // wb69: REVERTED to war-board only. Extending the hide machinery to the
  // faction profile/members roster (wb68) ran ffs_injectHideControls +
  // ffs_applyActivityFilter on that page every tick and knocked out the
  // FFScouter stat gauges there — even with both toggles off. The members
  // roster is where stats are read, so the hide feature stays on the war board
  // only; the roster falls through to ffs_clearActivityFilter (no bar, no
  // filter), exactly as before wb68.
  function ffs_isHideContext() {
    return ffs_isWarContext();
  }

  // wb61: keep the sort button's arrow/label in sync with module state. Label
  // shows the NEXT click's direction (↓ = sort strongest-first/descending).
  function _ffsApplySortBtnVisual(btn) {
    const nextDesc = (_ffsAppliedDesc !== true); // next click descends unless we just did
    btn.dataset.sortDesc = nextDesc ? "1" : "0";
    btn.textContent = nextDesc ? "↓ FFS" : "↑ FFS";
  }

  // wb61: parse the visible text out of a saved status-cell HTML snapshot
  // (data-ffsTravelOriginal / data-ffsHospOriginal) so group detection can
  // recover the native status word after our chip overwrote the cell.
  function _ffsTextFromHtml(html) {
    const t = document.createElement('div');
    t.innerHTML = html;
    return t.textContent || '';
  }

  // wb61: classify a member row into a sort group:
  //   0 = attackable (okay/online/idle), 1 = hospital, 2 = jail / travel / abroad
  // Priority ladder (first match wins), built to survive the chip painter
  // overwriting the native status text — after a chip is injected the cell text
  // is a bare timer ("00:12:34"), never the word "Hospital":
  //   (a) authoritative in-memory maps (independent of DOM),
  //   (b) our injected chips (.jail checked BEFORE plain hospital),
  //   (c) Torn-native status cell: aria-label + saved-original snapshot, read
  //       BEFORE live textContent,
  //   (d) raw textContent regex as a last resort.
  function ffs_rowGroup(row, pid) {
    if (pid && _ffsMemberCountdowns[pid]) return 2;            // traveling (map)
    if (pid && _ffsMemberHospitalUntil[pid]) {                // hospital/jail (map)
      return _ffsMemberHospitalState[pid] === 'Jail' ? 2 : 1;
    }
    if (row.querySelector('a.ffs-hosp-status.jail')) return 2; // jail BEFORE hospital
    if (row.querySelector('a.ffs-hosp-status'))      return 1; // hospital
    if (row.querySelector('span.ffs-travel-status')) return 2; // traveling
    const statusEl = row.querySelector('.status')
                  || row.querySelector('[class*="status" i]');
    let txt = '';
    if (statusEl) {
      if (statusEl.dataset.ffsHospOriginal)        txt = _ffsTextFromHtml(statusEl.dataset.ffsHospOriginal);
      else if (statusEl.dataset.ffsTravelOriginal) txt = _ffsTextFromHtml(statusEl.dataset.ffsTravelOriginal);
      else                                         txt = statusEl.textContent || '';
      const aria = statusEl.getAttribute('aria-label') || '';
      if (aria) txt = aria + ' ' + txt;
    }
    txt = txt.toLowerCase();
    if (/\b(traveling|travelling|jail|abroad)\b/.test(txt)) return 2;
    if (/\bhospital\b/.test(txt)) return 1;
    return 0;                                                  // attackable
  }
  function ffs_hospKey(pid)    { return _ffsMemberHospitalUntil[pid] || Infinity; }
  function ffs_unreachKey(pid) { return _ffsMemberHospitalUntil[pid] || _ffsMemberCountdowns[pid] || Infinity; }

  // wb61: the SINGLE reorderer for member lists — replaces the old
  // ffs_sortRowsByHospitalRelease so exactly one function owns ordering. (The
  // previous setup ran this hospital-release sort every 1s, fighting the
  // click-driven FFS sort — that conflict is why war-mode "groups mixed" and
  // wouldn't stay sorted.) Two modes:
  //   • war context (ANY ranked-war view — DEFAULT, no click needed):
  //     attackable first (by FFS score once cached), then hospital by soonest
  //     release, then jail/travel last;
  //   • legacy (non-war roster pages): hospital, jail & travel float to the
  //     top by release time (revive-hunting), attackable sinks — the original
  //     wb48 / "War Stuff Enhanced" behaviour, kept for the faction roster.
  // Signature-guarded + change-checked: an unchanged list is a no-op, so the
  // appendChild can never trigger a re-sort loop.
  function ffs_applyWarSort(rowList) {
    if (!rowList || rowList.length === 0) return;
    // wb62: war ordering is the DEFAULT on any war view — no click required.
    // (Pre-wb62 it engaged only after clicking ↓FFS via _ffsWarSortActive, so
    // the war page first loaded showing the legacy hospital-on-top revive-hunt
    // order — the reported bug.) The ↓FFS button now just toggles direction.
    const warMode = ffs_isWarContext();
    const desc = (_ffsAppliedDesc == null) ? true : _ffsAppliedDesc;
    const groups = new Map();
    rowList.forEach((row) => {
      const parent = row.parentElement;
      if (!parent) return;
      if (!groups.has(parent)) groups.set(parent, []);
      groups.get(parent).push(row);
    });

    for (const [parent, rows] of groups) {
      const metas = rows.map((row, idx) => {
        const a = row.querySelector('a[href*="XID="]');
        const m = a?.href?.match(/XID=(\d+)/);
        return { row, pid: m ? m[1] : null, idx };
      });

      metas.sort((A, B) => {
        if (_ffsPureStatSort) {                                // user clicked: stats only, status ignored
          const pa = _ffsScoreCache[A.pid];
          const pb = _ffsScoreCache[B.pid];
          if (pa == null && pb == null) return A.idx - B.idx;
          if (pa == null) return 1;                            // unknown score sinks
          if (pb == null) return -1;
          return desc ? pb - pa : pa - pb;
        }
        if (warMode) {
          const ga = ffs_rowGroup(A.row, A.pid);
          const gb = ffs_rowGroup(B.row, B.pid);
          if (ga !== gb) return ga - gb;                       // 0 atk < 1 hosp < 2 jail/travel
          if (ga === 1) return ffs_hospKey(A.pid) - ffs_hospKey(B.pid);     // soonest release first
          if (ga === 2) return ffs_unreachKey(A.pid) - ffs_unreachKey(B.pid);
          const sa = _ffsScoreCache[A.pid];                    // attackable: by FFS score
          const sb = _ffsScoreCache[B.pid];
          if (sa == null && sb == null) return A.idx - B.idx;
          if (sa == null) return 1;
          if (sb == null) return -1;
          return desc ? sb - sa : sa - sb;
        }
        // legacy: hospital(until) < jail(+1e10) < travel(+2e10) < attackable(Infinity)
        let ka = Infinity, kb = Infinity;
        if (A.pid) {
          if (_ffsMemberHospitalUntil[A.pid]) { const b = _ffsMemberHospitalUntil[A.pid]; ka = _ffsMemberHospitalState[A.pid] === 'Jail' ? b + 1e10 : b; }
          else if (_ffsMemberCountdowns[A.pid]) { ka = _ffsMemberCountdowns[A.pid] + 2e10; }
        }
        if (B.pid) {
          if (_ffsMemberHospitalUntil[B.pid]) { const b = _ffsMemberHospitalUntil[B.pid]; kb = _ffsMemberHospitalState[B.pid] === 'Jail' ? b + 1e10 : b; }
          else if (_ffsMemberCountdowns[B.pid]) { kb = _ffsMemberCountdowns[B.pid] + 2e10; }
        }
        return (ka - kb) || (A.idx - B.idx);
      });

      // Signature = mode + direction + resulting pid order. Unchanged → skip.
      const sig = (warMode ? 'w' : 'l') + (_ffsPureStatSort ? 'p' : 'g') + (desc ? 'd' : 'a') + '|' + metas.map(k => k.pid || '?').join(',');
      if (_ffsSortSignatures.get(parent) === sig) continue;
      _ffsSortSignatures.set(parent, sig);
      // Skip the DOM write if the rows are already in the desired order.
      let changed = false;
      for (let i = 0; i < metas.length; i++) {
        if (parent.children[i] !== metas[i].row) { changed = true; break; }
      }
      if (!changed) continue;
      const frag = document.createDocumentFragment();
      for (const k of metas) frag.appendChild(k.row);
      parent.appendChild(frag);
    }
  }

  // ── wb63: hide online / offline members on the war page ─────────────────
  // Detection mirrors TornTools' ranked-war-filter: each war row carries a
  // [class*="userOnlineStatusIcon___"] whose alt is "Online"/"Idle"/"Offline".
  // TWO-BUCKET semantics (wb66, per user): hide-online hides Online;
  // hide-offline hides everything NOT online (Idle + Offline) — idle counts as
  // offline. Unknown status is never hidden. Hidden rows just get display:none,
  // so this composes with the sort.
  function ffs_shouldHide(alt, hideOnline, hideOffline) {
    if (!alt) return false;
    if (hideOnline && alt === 'Online') return true;
    if (hideOffline && alt !== 'Online') return true; // idle + offline
    return false;
  }
  // wb66: robust boolean read for persisted toggles. On PDA, rD_getValue
  // returns the RAW localStorage string, so !!"false" / !!"0" were truthy —
  // that's why both boxes came back checked after a refresh. Parse explicitly.
  function ffs_parseBool(v) {
    return v === true || v === 1 || v === '1' || v === 'true';
  }
  function ffs_activityOf(row) {
    // Find the online indicator. Primary = TornTools' ranked-war icon; plus
    // a couple of other Torn online-dot patterns as fallback.
    const icon = row.querySelector(
      "[class*='userOnlineStatusIcon' i], [class*='onlineStatus' i], "
      + ".user-green-status, .user-yellow-status, .user-red-status"
    );
    if (!icon) return '';
    // Classic Torn status classes (unambiguous).
    const cl = icon.getAttribute('class') || '';
    if (/user-green-status/.test(cl))  return 'Online';
    if (/user-yellow-status/.test(cl)) return 'Idle';
    if (/user-red-status/.test(cl))    return 'Offline';
    // React war icon: the status word lives in alt / title / aria-label.
    // Normalise (lowercase + substring) so casing or extra text can't break it.
    const raw = (icon.getAttribute('alt') || icon.getAttribute('title')
              || icon.getAttribute('aria-label') || '').toLowerCase();
    if (raw.includes('online'))  return 'Online';
    if (raw.includes('idle'))    return 'Idle';
    if (raw.includes('offline')) return 'Offline';
    return '';
  }
  function ffs_warRows() {
    const out = [];
    document.querySelectorAll("ul.f-war-list li, [class*='members-list' i] li").forEach((li) => {
      if (li.querySelector("a[href*='XID=']")) out.push(li);
    });
    return out;
  }
  function ffs_applyActivityFilter(rows) {
    rows = rows || ffs_warRows();
    // wb64: one-shot diag — log what the online indicator actually looks like
    // on this user's war page so detection can be confirmed from server logs.
    if (!_ffsActivityDiagOnce && rows.length) {
      _ffsActivityDiagOnce = true;
      try {
        const samples = rows.slice(0, 6).map((row) => {
          const icon = row.querySelector(
            "[class*='userOnlineStatusIcon' i], [class*='onlineStatus' i], "
            + ".user-green-status, .user-yellow-status, .user-red-status"
          );
          return {
            icon: !!icon,
            tag: icon ? icon.tagName : null,
            cls: icon ? String(icon.getAttribute('class') || '').slice(0, 50) : null,
            alt: icon ? icon.getAttribute('alt') : null,
            title: icon ? icon.getAttribute('title') : null,
            aria: icon ? icon.getAttribute('aria-label') : null,
            canon: ffs_activityOf(row),
          };
        });
        ffs_travelDiag({ source: 'activity-detect', rowCount: rows.length, samples });
      } catch (_) {}
    }
    let hidden = 0, protectedOnline = 0;
    const counts = { Online: 0, Idle: 0, Offline: 0, unknown: 0 };
    const hiddenSamples = [];
    for (const row of rows) {
      const a = ffs_activityOf(row);
      counts[a || 'unknown']++;
      const onlineN = Array.from(row.querySelectorAll("[class*='userOnlineStatusIcon' i]"))
        .filter(ic => (ic.getAttribute('alt') || '').trim().toLowerCase() === 'online').length;
      let hide = ffs_shouldHide(a, _ffsHideOnline, _ffsHideOffline);
      // wb70 SAFETY: never hide a row that still shows an online member, even if
      // ffs_activityOf misread it (the War-Stuff hospital chip can clobber the
      // status cell). Only applies when we're not explicitly hiding online.
      if (hide && !_ffsHideOnline && onlineN > 0) { hide = false; protectedOnline++; }
      row.classList.toggle('ffs-hidden', hide);
      if (hide) {
        hidden++;
        if (hiddenSamples.length < 4) {
          const icon = row.querySelector("[class*='userOnlineStatusIcon' i]");
          const statusEl = row.querySelector(".status") || row.querySelector('[class*="status" i]');
          hiddenSamples.push({
            canon: a,
            alt: icon ? icon.getAttribute('alt') : null,
            iconN: row.querySelectorAll("[class*='userOnlineStatusIcon' i]").length, // >1 ⇒ matched a wrapper
            onlineN,                                                                 // online icons inside this hidden row
            xidN: row.querySelectorAll("a[href*='XID=']").length,                    // >1 ⇒ matched a wrapper
            hosp: !!row.querySelector('.ffs-hosp-status'),                           // our hospital chip present?
            statusHTML: statusEl ? String(statusEl.outerHTML || '').slice(0, 90) : null,
            cls: String(row.getAttribute('class') || '').slice(0, 40),
          });
        }
      }
    }
    // wb67/wb70: capture the bad state — fires when the online-safety guard had
    // to protect a row (the actual bug) OR >85% hidden. Shows wrapper signals
    // (iconN/xidN>1), whether hidden rows carry the hosp chip, and status HTML.
    if (rows.length >= 5 && (protectedOnline > 0 || hidden / rows.length > 0.85) && !(_ffsHideOnline && _ffsHideOffline)) {
      ffs_filterDiag({ hideOnline: _ffsHideOnline, hideOffline: _ffsHideOffline, rows: rows.length, hidden, protectedOnline, counts, hiddenSamples, href: location.href });
    }
    const countEl = document.querySelector('.ffs-hide-bar .ffs-hide-count');
    if (countEl) countEl.textContent = hidden ? `${hidden} hidden` : '';
  }
  // wb64: undo all hide-filter side effects (used when we're NOT on the war
  // view) so the filter can never leak onto the roster/profile pages, even via
  // stale classes left on DOM nodes reused across an SPA navigation.
  function ffs_clearActivityFilter() {
    document.querySelectorAll('.ffs-hidden').forEach((el) => el.classList.remove('ffs-hidden'));
    const bar = document.querySelector('.ffs-hide-bar');
    if (bar) bar.remove();
  }
  function ffs_injectHideControls() {
    if (!ffs_isHideContext()) return;
    if (document.querySelector('.ffs-hide-bar')) return; // already present
    const list = document.querySelector('ul.f-war-list')
              || document.querySelector(".faction-war [class*='members-list' i]")
              || document.querySelector("[class*='members-list' i]");
    if (!list || !list.parentNode) return;
    const bar = document.createElement('div');
    bar.className = 'ffs-hide-bar';
    const mk = (text, checked) => {
      const label = document.createElement('label');
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = checked;
      label.appendChild(cb);
      label.appendChild(document.createTextNode(text));
      return { label, cb };
    };
    const on = mk('Hide online', _ffsHideOnline);
    const off = mk('Hide offline', _ffsHideOffline);
    const count = document.createElement('span');
    count.className = 'ffs-hide-count';
    on.cb.addEventListener('change', () => {
      _ffsHideOnline = on.cb.checked;
      rD_setValue('ffs_hide_online', _ffsHideOnline ? '1' : '0'); // string round-trips on PDA
      ffs_applyActivityFilter();
    });
    off.cb.addEventListener('change', () => {
      _ffsHideOffline = off.cb.checked;
      rD_setValue('ffs_hide_offline', _ffsHideOffline ? '1' : '0');
      ffs_applyActivityFilter();
    });
    bar.appendChild(on.label);
    bar.appendChild(off.label);
    bar.appendChild(count);
    list.parentNode.insertBefore(bar, list);
    ffs_applyActivityFilter();
  }

  // wb36: paint live landing-time countdowns inside mini-profile cards.
  // wb37: position the chip INLINE next to the "Traveling to X" status
  // line instead of as a separate block below the description. Locate
  // the first element whose direct text node starts with "Traveling" or
  // "Returning" and inject the chip as its last child.
  function ffs_paintMiniProfileCountdowns() {
    if (!key) return;
    const minis = document.querySelectorAll(
      '[class^="profile-mini-_userProfileWrapper_"]'
    );
    minis.forEach((mini) => {
      const uid = String(get_player_id_in_element(mini) || "");
      if (!uid) return;
      ffs_fetchFlightForMember(uid);

      const until = _ffsMemberCountdowns[uid];
      let chip = mini.querySelector(".ffs-mini-countdown");
      if (until) {
        const remaining = until * 1000 - Date.now();
        const countdownText = ffs_formatCountdown(remaining);
        if (!chip) {
          // wb52: use the shared _ffs_findMiniStatusHost helper. The
          // old walker only matched DIRECT-child text nodes and broke
          // when Torn re-wrapped the status string, dropping the chip
          // into .description (the bottom of the card). The new helper
          // walks all descendants and picks the deepest match.
          const host = _ffs_findMiniStatusHost(mini)
                    || mini.querySelector(".description")
                    || mini;
          chip = document.createElement("span");
          chip.className = "ffs-mini-countdown";
          // color:inherit so the chip picks up the surrounding "Traveling
          // to X" header's text color (white on the dark theme) instead
          // of standing out in green.
          chip.style.cssText =
            "display:inline-block;margin-left:6px;color:inherit;"
            + "font-weight:600;font-size:12px;line-height:1.4;"
            + "vertical-align:middle;white-space:nowrap;";
          host.appendChild(chip);
        }
        // wb39: reverted to the U+2708 emoji plane — wb38's SVG swap was
        // a reaction to a clipping report that turned out to be fixable
        // via line-height alone.
        chip.textContent = `\u2708 ${countdownText}`;
      } else if (chip) {
        chip.remove();
      }
    });
  }

  function ffs_initTravelCountdowns() {
    if (!/\/(war|factions)\.php/.test(location.pathname)) return;
    if (!key) {
      ffs_travelDiag({ source: "init", skipped: "no-key", href: location.href });
      return;
    }
    ffs_travelDiag({ source: "init", started: true, ver: SCRIPT_VERSION, href: location.href });

    // Ticker: repaint every 1s so countdowns stay live.
    setInterval(ffs_paintTravelCountdowns, 1000);

    // wb78: the old boundary-aligned setTimeout (wb73) flipped on the DEVICE
    // second, but the value comes from ffs_nowSec (Torn's server clock), which is
    // phased off the device clock — so the flip lagged up to ~1s. Don't predict
    // the boundary; watch the value. Poll every 100ms and let ffs_tickCountdowns
    // repaint ONLY when the displayed second actually changes (its text-diff
    // guard), so the flip lands within ~100ms of the true tick regardless of any
    // clock offset. (A plain setInterval of this ticker is proven safe — ran fine
    // in 2.73.16/17 — unlike the phase probe that broke the stats.)
    ffs_tickCountdowns(); // initial paint
    setInterval(ffs_tickCountdowns, 100);

    // Data fetch loop: poll Torn API every 30s, extract all faction IDs
    // currently visible on the page.
    // wb42: cache enemy faction IDs from the authoritative Torn wars API,
    // since the war-list DOM on /factions.php?step=your&type=1 doesn't
    // always expose enemy faction IDs via anchors our selectors can match.
    // Refreshes every 60s.
    let _ffsWarFactionIds = null;
    let _ffsWarFactionFetchedAt = 0;
    async function ffs_resolveWarFactionIds() {
      if (_ffsWarFactionIds && (Date.now() - _ffsWarFactionFetchedAt) < 60_000) {
        return _ffsWarFactionIds;
      }
      try {
        const r = await fetch(`https://api.torn.com/v2/faction?selections=wars&key=${encodeURIComponent(key)}`);
        const d = await r.json();
        const ids = new Set();
        const w = d?.wars || d;
        const pools = [w?.ranked, w?.raids, w?.territory];
        for (const pool of pools) {
          if (!pool) continue;
          const list = Array.isArray(pool) ? pool : [pool];
          for (const entry of list) {
            const facs = entry?.factions || entry?.defender || entry?.attacker;
            if (!facs) continue;
            if (Array.isArray(facs)) {
              for (const f of facs) {
                const id = f?.id ?? f?.ID;
                if (id) ids.add(String(id));
              }
            } else if (facs.id) {
              ids.add(String(facs.id));
            }
          }
        }
        _ffsWarFactionIds = Array.from(ids);
        _ffsWarFactionFetchedAt = Date.now();
        ffs_travelDiag({ source: "war-faction-resolve", ids: _ffsWarFactionIds, hasError: !!d?.error });
      } catch (e) {
        ffs_travelDiag({ source: "war-faction-resolve", err: String(e?.message || e) });
        _ffsWarFactionIds = _ffsWarFactionIds || [];
      }
      return _ffsWarFactionIds;
    }

    // wb18: ownFactionId — resolved once via Torn's own API when we're
    // on /factions.php?step=your (URL has no ID=). Cached for the session.
    let _ffsOwnFactionId = null;
    async function ffs_resolveOwnFactionId() {
      if (_ffsOwnFactionId) return _ffsOwnFactionId;
      try {
        // wb23: user?selections=basic doesn't include faction info. Use
        // /v2/faction?selections=basic which returns the caller's OWN
        // faction when no ID is given.
        const r = await fetch(`https://api.torn.com/v2/faction?selections=basic&key=${encodeURIComponent(key)}`);
        const d = await r.json();
        const basic = d?.basic ?? d;
        const fid = basic?.id ?? basic?.ID ?? d?.ID ?? d?.id;
        ffs_travelDiag({ source: "own-faction-resolve", response: {
          hasError: !!d?.error,
          errorMsg: d?.error?.error,
          factionId: fid,
          topKeys: d ? Object.keys(d).slice(0, 10) : [],
          basicKeys: basic && typeof basic === "object" ? Object.keys(basic).slice(0, 10) : null,
        }});
        if (d && !d.error && fid) {
          _ffsOwnFactionId = String(fid);
          // wb44: prepopulate countdowns from last session's localStorage
          // cache so the chip appears instantly, before the 30s poll lands.
          ffs_loadStatusCache(_ffsOwnFactionId);
          return _ffsOwnFactionId;
        }
      } catch (e) {
        ffs_travelDiag({ source: "own-faction-resolve", err: String(e?.message || e) });
      }
      return null;
    }

    async function pollAll() {
      const factionIds = new Set();
      // War page: read faction IDs from any element whose class name
      // contains "FactionName" (Torn's React mangle varies) or from
      // any faction link matching factions.php?ID=.
      document.querySelectorAll(
        "[class*='FactionName'], [class*='factionName'], a[href*='factions.php?ID=']"
      ).forEach(el => {
        const href = el.href || el.querySelector("a")?.href || "";
        const m = href.match(/ID=(\d+)/);
        if (m) factionIds.add(m[1]);
      });
      document.querySelectorAll(".members-list a[href*='ID=']").forEach(a => {
        const m = (a.href || "").match(/factions\.php\?ID=(\d+)/);
        if (m) factionIds.add(m[1]);
      });
      // wb41: war-page specific selectors — the /war/rank and /war/faction
      // routes don't expose an ID= anchor for the enemy faction, so pull
      // it from the war faction tiles / banners which carry the ID in
      // their own href or data-* attributes. Covers a few React build
      // variants.
      document.querySelectorAll(
        "[class*='warList' i] a[href*='factions.php'], "
        + "[class*='warFaction' i] a[href*='factions.php'], "
        + "[class*='enemyFaction' i] a[href*='factions.php'], "
        + "[class*='ourFaction' i] a[href*='factions.php'], "
        + "[class*='warFaction' i] [data-id], "
        + "[class*='warFaction' i] [data-faction-id]"
      ).forEach(el => {
        const href = el.href || "";
        const m1 = href.match(/ID=(\d+)/);
        if (m1) factionIds.add(m1[1]);
        const dId = el.dataset?.id || el.dataset?.factionId;
        if (dId && /^\d+$/.test(String(dId))) factionIds.add(String(dId));
      });
      // Faction page: URL-scoped to a single faction.
      const fm = location.search.match(/ID=(\d+)/);
      if (fm && location.pathname.startsWith("/factions.php")) factionIds.add(fm[1]);
      // Own faction page (step=your) — no ID= in URL, resolve via API.
      // Also covers the war page, which lives under step=your too.
      if (location.search.includes("step=your") || /\/war\//.test(location.hash)) {
        const own = await ffs_resolveOwnFactionId();
        if (own) factionIds.add(own);
      }
      // wb41: parse /war/rank|faction IDs from the hash itself (e.g.
      // #/war/rank/12345 or #/tab=war&id=12345), covering routes where
      // Torn doesn't render a clickable faction tile.
      const hashM = location.hash.match(/(?:war|id)[=\/]\s*(\d{2,})/i);
      if (hashM) factionIds.add(hashM[1]);

      // wb42: on war-related URLs, also pull enemy faction IDs from the
      // authoritative Torn wars API. Handles war-list + war-room pages
      // where the DOM doesn't expose enemy faction anchors our selectors
      // can reach.
      const onWarPage = location.search.includes("step=your")
        || /\/war\//.test(location.hash)
        || location.search.includes("type=1");
      if (onWarPage) {
        const warIds = await ffs_resolveWarFactionIds();
        for (const id of (warIds || [])) factionIds.add(id);
      }

      // wb18: DOM probe to see what classes Torn is actually rendering,
      // so we can fix row selectors if they aren't matching.
      const listSamples = [];
      document.querySelectorAll("ul, ol, [class*='member' i], [class*='list' i]").forEach(el => {
        if (listSamples.length >= 10) return;
        if (!el.className || typeof el.className !== "string") return;
        const cn = el.className.slice(0, 80);
        if (/member|list/i.test(cn)) listSamples.push(el.tagName + "." + cn);
      });

      ffs_travelDiag({
        source: "poll",
        factionIds: Array.from(factionIds),
        href: location.href,
        ownFactionResolved: _ffsOwnFactionId,
        listSamples,
      });
      // wb79: remember which factions we're watching so the imminent
      // hospital re-fetch (paint loop) can target the same set.
      _ffsTrackedFactionIds.clear();
      factionIds.forEach(id => _ffsTrackedFactionIds.add(id));
      for (const fid of factionIds) {
        // wb44: prepopulate from last session's cache before the fetch
        // so chips appear within 1s of page load even on scouted
        // factions, not just our own.
        ffs_loadStatusCache(fid);
        await ffs_updateFactionTravelData(fid);
      }
    }
    pollAll();
    setInterval(pollAll, FFS_TRAVEL_POLL_MS);

    // wb25: DOM scan for travelling members — catches anyone the API
    // poll didn't cover (e.g. enemy faction on the war page, where the
    // faction ID can be hard to resolve from the DOM).
    // wb41: drop cadence from 5s → 1.5s so war-page cold start fills
    // countdowns within ~1–2s instead of up to 5s. Each call dedupes via
    // _ffsFlightFetchInflight + _ffsMemberCountdowns, so extra ticks
    // don't duplicate fetches.
    ffs_detectAndFetchTravellersFromDom();
    setInterval(ffs_detectAndFetchTravellersFromDom, 1_500);

    // wb33: event delegation — also loosens the click target (anywhere
    // on the status cell, not just the inner span) and logs the click
    // to server-side diag so we can see what's in dataset at click time.
    document.body.addEventListener("click", (ev) => {
      const span = ev.target.closest && (
        ev.target.closest(".ffs-travel-status") ||
        (ev.target.closest(".status")?.querySelector(".ffs-travel-status"))
      );
      if (!span) return;
      ev.stopPropagation();
      ev.preventDefault();
      const was = span.dataset.ffsShowCountry === "1";
      span.dataset.ffsShowCountry = was ? "0" : "1";
      const v = span.querySelector(".ffs-mq-value");
      const target = was ? span.dataset.ffsTime : (span.dataset.ffsCountry || span.dataset.ffsTime);
      // Diag: capture the click state before mutation so we can see
      // what the user actually toggled to.
      ffs_travelDiag({
        source: "click",
        wasShowCountry: was,
        dsTime: span.dataset.ffsTime,
        dsCountry: span.dataset.ffsCountry,
        resolvedTarget: target,
        hadValueSpan: !!v,
        memberAbbrSize: Object.keys(_ffsMemberAbbr).length,
      });
      if (!v) return;
      v.textContent = target || span.dataset.ffsTime || "";
    }, true);
  }
  ffs_initTravelCountdowns();

  // wb77: make the FFS stat pill on the honor bar a click-to-attack shortcut.
  // Bound at top level so it works on profiles AND war/member pages. The pill
  // carries data-ffs-uid (stamped when painted); clicking it opens that player's
  // attack page. Capture phase + preventDefault so it overrides the honor bar's
  // underlying profile link. (Own-faction members aren't attackable — Torn will
  // just say so — but the pill is mostly used on scouted enemies.)
  document.addEventListener("click", function (ev) {
    const pill = ev.target && ev.target.closest && ev.target.closest(".ff-scouter-est-overlay[data-ffs-uid]");
    if (!pill) return;
    const uid = pill.dataset.ffsUid;
    if (!uid) return;
    ev.preventDefault();
    ev.stopPropagation();
    const url = "https://www.torn.com/page.php?sid=attack&user2ID=" + uid;
    const w = window.open(url, "_blank", "noopener");
    if (!w) location.href = url;
  }, true);

  // wb36: mini-profile countdown ticker — runs on every Torn page,
  // since mini-profiles can appear anywhere (chat, messages, forums,
  // attacks log, etc.), not just war/faction pages.
  if (key) {
    setInterval(ffs_paintMiniProfileCountdowns, 1000);
  }

  // ─────────────────────────────────────────────────────────────────────
  // WARBOARD FORK (wb14): FFS sort button on war/faction member lists.
  // Same visual + UX pattern as BSP's "BSP" sort button — click once to
  // sort strongest→weakest, click again to flip. Sort key is FFS
  // bs_estimate (or value/FF score if bs_estimate is absent). Works on:
  //   - .members-cont (war.php)
  //   - .members-list (factions.php)
  // ─────────────────────────────────────────────────────────────────────
  async function ffs_inject_sort_buttons() {
    // wb60: wb59's structural fallback was too greedy — it mounted the
    // button on every ancestor that contained >=3 XID links AND used
    // `cont.firstElementChild` as a "header" fallback. Result on the
    // React war page: button appeared on individual member rows
    // instead of once in the header. Tightened in two ways:
    //   1. Header must look like a header (NOT contain XID links).
    //   2. Structural fallback picks the SMALLEST qualifying ancestor,
    //      not every ancestor in the chain.
    const candidates = new Set();

    document.querySelectorAll(".members-cont").forEach(el => candidates.add(el));
    document.querySelectorAll(".members-list").forEach(el => candidates.add(el));
    document.querySelectorAll(
      '[class*="membersList___"], [class*="membersCont___"], '
      + '[class*="warMembersList___"], [class*="warMembers___"], '
      + '[class*="memberList___"]'
    ).forEach(el => candidates.add(el));

    if (candidates.size === 0) {
      const xidLinks = Array.from(document.querySelectorAll('a[href*="XID="]'));
      // Find each XID link's nearest ancestor with >=3 XID links — that
      // ancestor is the list container. Walking only ONE step beyond
      // the first qualifying ancestor would skip the actual list and
      // catch a row's parent (which also contains 3+ links via the
      // sibling rows).
      const qualifying = new Set();
      for (const link of xidLinks) {
        let node = link.parentElement;
        for (let depth = 0; node && depth < 10; depth++, node = node.parentElement) {
          if (node.querySelectorAll('a[href*="XID="]').length >= 3) {
            qualifying.add(node);
            break; // smallest qualifying — don't keep walking
          }
        }
      }
      // Of all the per-link smallest-qualifying ancestors, the COMMON
      // ancestor across all links is the actual list (every link's
      // smallest qualifying ancestor will point at the same container
      // when the container itself has >=3 links — which is the desired
      // single mount point). Add the most-frequently-pointed-to one.
      const counts = new Map();
      qualifying.forEach(n => counts.set(n, (counts.get(n) || 0) + 1));
      let best = null, bestCount = 0;
      for (const [n, c] of counts) { if (c > bestCount) { best = n; bestCount = c; } }
      if (best) candidates.add(best);
    }

    const containers = Array.from(candidates).filter(el => {
      if (el.closest(".raid-members-list")) return false;
      const desc = el.closest(".desc-wrap");
      if (desc && !desc.matches('[class*="warDesc"]')) return false;
      return true;
    });

    for (const cont of containers) {
      // Header must (a) exist and (b) NOT contain an XID link — that
      // disqualifies the first member row from being treated as a
      // header. Drop the firstElementChild fallback entirely; if no
      // proper header exists, skip mounting rather than scattering
      // buttons onto rows.
      const headerCandidates = [
        cont.querySelector(".member"),
        cont.querySelector('[class*="header___"]'),
        cont.querySelector('[class*="memberHeader___"]'),
        cont.querySelector('[class*="listHeader___"]'),
      ].filter(Boolean);
      const header = headerCandidates.find(h => !h.querySelector('a[href*="XID="]'));
      if (!header) continue;
      if (header.querySelector(".ff-scouter-sort-btn")) continue;

      const btn = document.createElement("button");
      btn.className = "ff-scouter-sort-btn";
      _ffsApplySortBtnVisual(btn); // wb61: reflect persisted direction (survives 500ms re-inject)
      btn.style.cssText =
        "margin-left:6px;padding:1px 6px;border-radius:3px;"
        + "font-size:11px;font-weight:700;background:#2a3fff;color:#fff;"
        + "border:0;cursor:pointer;line-height:14px;vertical-align:middle;"
        + "position:relative;z-index:5;";

      btn.addEventListener("click", (ev) => {
        ev.stopPropagation();
        ev.preventDefault();
        ffs_sort_list(cont, btn);
      });

      header.insertBefore(btn, header.children[1] || null);
    }

    // Cleanup: remove any sort buttons that wb59 erroneously placed on
    // member rows (parent has an XID link). Safe to run repeatedly.
    document.querySelectorAll('.ff-scouter-sort-btn').forEach(btn => {
      const parent = btn.parentElement;
      if (parent && parent.querySelector('a[href*="XID="]')) {
        btn.remove();
      }
    });
  }

  async function ffs_sort_list(container, btn) {
    // wb61: direction + active state live in module scope (see _ffsAppliedDesc /
    // _ffsWarSortActive), NOT on the button — the button is re-injected every
    // 500ms and would otherwise reset. Toggle on each click; null → desc first.
    _ffsAppliedDesc = (_ffsAppliedDesc == null) ? true : !_ffsAppliedDesc;
    const descNow = _ffsAppliedDesc; // true = strongest-first
    _ffsPureStatSort = true;         // clicking sorts by stats only, regardless of hospital/jail/travel status
    _ffsApplySortBtnVisual(btn);

    // War pages (legacy): rows live under .members-list.
    // Faction pages: rows live under .table-body.
    // React-migrated war page: rows are direct children of the
    // container or hashed-class wrappers — fall back to walking from
    // XID links if the named selectors miss.
    let rowContainer = container.querySelector(".members-list")
      || container.querySelector(".table-body")
      || container.querySelector('[class*="tableBody___"], [class*="rowsList___"], [class*="memberRows___"]');
    if (!rowContainer) {
      // Last resort: treat the container itself as the row parent,
      // filtering to children that contain an XID link.
      const childrenWithXid = Array.from(container.children).filter(
        c => c.querySelector && c.querySelector('a[href*="XID="]')
      );
      if (childrenWithXid.length >= 2) {
        rowContainer = container;
      } else {
        return;
      }
    }

    const rows = Array.from(rowContainer.children).filter(
      c => !c.classList.contains('member') && !c.matches('[class*="header"]')
    );
    const playerIds = [];
    const rowMeta = rows.map(row => {
      const a = row.querySelector('a[href*="XID="]');
      if (!a) return { row, pid: null };
      const m = a.href.match(/XID=(\d+)/);
      const pid = m ? parseInt(m[1], 10) : null;
      if (pid) playerIds.push(pid);
      return { row, pid };
    });

    // Pull FFS cache for all rows in one shot, then stash scores by pid so the
    // 1s paint-tick re-sort (ffs_applyWarSort) reads them synchronously.
    const cache = await ffcache.get(playerIds);
    function rowScore(meta) {
      if (!meta.pid) return null;
      const c = cache[meta.pid];
      if (!c) return null;
      // Prefer bs_estimate (absolute stats); fall back to FF score
      // (ratio) so targets without an estimate still sort reasonably.
      if (typeof c.bs_estimate === "number" && isFinite(c.bs_estimate)) return c.bs_estimate;
      if (typeof c.value === "number" && isFinite(c.value)) return c.value;
      return null;
    }
    for (const meta of rowMeta) {
      if (!meta.pid) continue;
      const sc = rowScore(meta);
      if (sc != null) _ffsScoreCache[String(meta.pid)] = sc; // never downgrade a known score
    }

    // wb61: in a war context hand ordering to the single persistent sorter so
    // the result survives Torn's React re-renders (it re-applies under a
    // signature guard on every 1s paint tick). Instant feedback + persistence.
    if (ffs_isWarContext()) {
      _ffsWarSortActive = true;
      ffs_applyWarSort(rows);
      return;
    }

    // Non-war faction roster page: one-shot group+score sort (click-only, as
    // before) using the shared robust group detector.
    //   0 = attackable (online/idle/okay) — FFS score within group
    //   1 = hospital — soonest release first
    //   2 = traveling / jail — bottom
    rowMeta.sort((a, b) => {
      const sa = rowScore(a);
      const sb = rowScore(b);
      if (sa == null && sb == null) return 0;
      if (sa == null) return 1;
      if (sb == null) return -1;
      return descNow ? sb - sa : sa - sb;
    });
    // Reattach in new order.
    for (const m of rowMeta) rowContainer.appendChild(m.row);
  }

  // Periodically re-probe for the member lists — Torn's SPA re-renders
  // and the header row we inject into can vanish. 500ms × 30 = 15s
  // covers late React hydration on war/faction pages.
  if (/\/(war|factions)\.php/.test(location.pathname)) {
    let tries = 0;
    const iv = setInterval(() => {
      tries++;
      ffs_inject_sort_buttons();
      if (tries >= 30) clearInterval(iv);
    }, 500);
  }

  function get_cached_targets(staleok) {
    const value = rD_getValue(TARGET_KEY);
    if (!value) {
      return null;
    }

    let parsed = null;
    try {
      parsed = JSON.parse(value);
    } catch {
      return null;
    }

    if (parsed == null) {
      return null;
    }

    if (staleok) {
      return parsed.targets;
    }

    if (parsed.last_updated + FF_TARGET_STALENESS > new Date()) {
      // Old cache, return nothing
      return null;
    }

    return parsed.targets;
  }

  function get_next_target_index() {
    const value = Number(rD_getValue(TARGET_INDEX_KEY, 0));

    rD_setValue(TARGET_INDEX_KEY, value + 1);

    return value;
  }

  function reset_next_target_index() {
    rD_setValue(TARGET_INDEX_KEY, 0);
  }

  function update_ff_targets() {
    if (!key) {
      return;
    }

    const cached = get_cached_targets(false);
    if (cached) {
      return;
    }

    const chain_ff_target = ffSettingsGet("chain-ff-target") || "2.5";

    const url = `${BASE_URL}/api/v1/get-targets?key=${key}&inactiveonly=1&maxff=${chain_ff_target}&limit=50`;

    console.log("[FF Scouter V2] Refreshing chain list");
    rD_xmlhttpRequest({
      method: "GET",
      url: url,
      onload: function (response) {
        if (!response) {
          return;
        }
        if (response.status == 200) {
          var ff_response = JSON.parse(response.responseText);
          if (ff_response && ff_response.error) {
            showToast(ff_response.error);
            return;
          }
          if (ff_response.targets) {
            const result = {
              targets: ff_response.targets,
              last_updated: new Date(),
            };
            rD_setValue(TARGET_KEY, JSON.stringify(result));
            console.log("[FF Scouter V2] Chain list updated successfully");
          }
        } else {
          try {
            var err = JSON.parse(response.responseText);
            if (err && err.error) {
              showToast(
                "API request failed. Error: " +
                  err.error +
                  "; Code: " +
                  err.code,
              );
            } else {
              showToast(
                "API request failed. HTTP status code: " + response.status,
              );
            }
          } catch {
            showToast(
              "API request failed. HTTP status code: " + response.status,
            );
          }
        }
      },
      onerror: function (e) {
        console.error("[FF Scouter V2] **** error ", e, "; Stack:", e.stack);
      },
      onabort: function (e) {
        console.error("[FF Scouter V2] **** abort ", e, "; Stack:", e.stack);
      },
      ontimeout: function (e) {
        console.error("[FF Scouter V2] **** timeout ", e, "; Stack:", e.stack);
      },
    });
  }

  function get_random_chain_target() {
    const targets = get_cached_targets(true);
    if (!targets) {
      return null;
    }

    let index = get_next_target_index();

    if (index >= targets.length) {
      index = 0;
      reset_next_target_index();
    }

    return targets[index];
  }

  function clear_cached_targets() {
    rD_deleteValue(TARGET_KEY);
  }

  // Chain button stolen from https://greasyfork.org/en/scripts/511916-random-target-finder
  function create_chain_button() {
    // Check if chain button is enabled in settings
    if (!ffSettingsGetToggle("chain-button-enabled")) {
      ffdebug("[FF Scouter V2] Chain button disabled in settings");
      return;
    }

    const button = document.createElement("button");
    button.innerHTML = "FF";
    button.style.position = "fixed";
    //button.style.top = '10px';
    //button.style.right = '10px';
    button.style.top = "32%"; // Adjusted to center vertically
    button.style.right = "0%"; // Center horizontally
    //button.style.transform = 'translate(-50%, -50%)'; // Center the button properly
    button.style.zIndex = "9999";

    // Add CSS styles for a green background
    button.style.backgroundColor = "green";
    button.style.color = "white";
    button.style.border = "none";
    button.style.padding = "6px";
    button.style.borderRadius = "6px";
    button.style.cursor = "pointer";

    // Add a click event listener to open Google in a new tab
    button.addEventListener("click", function () {
      let rando = get_random_chain_target();
      if (!rando) {
        return;
      }

      const linkType = ffSettingsGet("chain-link-type") || "attack";
      const tabType = ffSettingsGet("chain-tab-type") || "newtab";

      let profileLink;
      if (linkType === "profile") {
        profileLink = `https://www.torn.com/profiles.php?XID=${rando.player_id}`;
      } else {
        profileLink = `https://www.torn.com/page.php?sid=attack&user2ID=${rando.player_id}`;
      }

      if (tabType === "sametab") {
        window.location.href = profileLink;
      } else {
        window.open(profileLink, '_blank', 'noopener,noreferrer');
      }
    });
    // Add the button to the page
    document.body.appendChild(button);
  }

  function abbreviateCountry(name) {
    if (!name) return "";
    if (name.trim().toLowerCase() === "switzerland") return "Switz";
    const words = name.trim().split(/\s+/);
    if (words.length === 1) return words[0];
    return words.map((w) => w[0].toUpperCase()).join("");
  }

  function formatTime(ms) {
    let totalSeconds = Math.max(0, Math.floor(ms / 1000));
    let hours = String(Math.floor(totalSeconds / 3600)).padStart(2, "0");
    let minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(
      2,
      "0",
    );
    let seconds = String(totalSeconds % 60).padStart(2, "0");
    return `${hours}:${minutes}:${seconds}`;
  }

  function fetchFactionData(factionID) {
    const url = `https://api.torn.com/v2/faction/${factionID}/members?striptags=true&key=${key}`;
    return fetch(url).then((response) => response.json());
  }

  function updateMemberStatus(li, member) {
    if (!member || !member.status) return;

    let statusEl = li.querySelector(".status");
    if (!statusEl) return;

    let lastActionRow = li.querySelector(".last-action-row");
    let lastActionText = member.last_action?.relative || "";
    if (lastActionRow) {
      lastActionRow.textContent = `Last Action: ${lastActionText}`;
    } else {
      lastActionRow = document.createElement("div");
      lastActionRow.className = "last-action-row";
      lastActionRow.textContent = `Last Action: ${lastActionText}`;
      let lastDiv = Array.from(li.children)
        .reverse()
        .find((el) => el.tagName === "DIV");
      if (lastDiv?.nextSibling) {
        li.insertBefore(lastActionRow, lastDiv.nextSibling);
      } else {
        li.appendChild(lastActionRow);
      }
    }

    // Handle status changes
    if (member.status.state === "Okay") {
      if (statusEl.dataset.originalHtml) {
        statusEl.innerHTML = statusEl.dataset.originalHtml;
        delete statusEl.dataset.originalHtml;
      }
      statusEl.textContent = "Okay";
    } else if (member.status.state === "Traveling") {
      if (!statusEl.dataset.originalHtml) {
        statusEl.dataset.originalHtml = statusEl.innerHTML;
      }

      let description = member.status.description || "";
      let location = "";
      let isReturning = false;

      if (description.includes("Returning to Torn from ")) {
        location = description.replace("Returning to Torn from ", "");
        isReturning = true;
      } else if (description.includes("Traveling to ")) {
        location = description.replace("Traveling to ", "");
      }

      let abbr = abbreviateCountry(location);
      const planeSvg = `<svg class="plane-svg ${isReturning ? "returning" : ""}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 576 512">
                    <path d="M482.3 192c34.2 0 93.7 29 93.7 64c0 36-59.5 64-93.7 64l-116.6 0L265.2 495.9c-5.7 10-16.3 16.1-27.8 16.1l-56.2 0c-10.6 0-18.3-10.2-15.4-20.4l49-171.6L112 320 68.8 377.6c-3 4-7.8 6.4-12.8 6.4l-42 0c-7.8 0-14-6.3-14-14c0-1.3 .2-2.6 .5-3.9L32 256 .5 145.9c-.4-1.3-.5-2.6-.5-3.9c0-7.8 6.3-14 14-14l42 0c5 0 9.8 2.4 12.8 6.4L112 192l102.9 0-49-171.6C162.9 10.2 170.6 0 181.2 0l56.2 0c11.5 0 22.1 6.2 27.8 16.1L365.7 192l116.6 0z"/>
                </svg>`;
      const tornSymbol = `<svg class="torn-symbol" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="11" fill="none" stroke="currentColor" stroke-width="1.5"/>
                    <text x="12" y="16" text-anchor="middle" font-family="Arial" font-weight="bold" font-size="14" fill="currentColor">T</text>
                </svg>`;
      statusEl.innerHTML = `<span class="travel-status">${tornSymbol}${planeSvg}<span class="country-abbr">${abbr}</span></span>`;
    } else if (member.status.state === "Abroad") {
      if (!statusEl.dataset.originalHtml) {
        statusEl.dataset.originalHtml = statusEl.innerHTML;
      }
      let description = member.status.description || "";
      if (description.startsWith("In ")) {
        let location = description.replace("In ", "");
        let abbr = abbreviateCountry(location);
        statusEl.textContent = `in ${abbr}`;
      }
    }

    // Update countdown
    if (member.status.until && parseInt(member.status.until, 10) > 0) {
      memberCountdowns[member.id] = parseInt(member.status.until, 10);
    } else {
      delete memberCountdowns[member.id];
    }
  }

  function updateFactionStatuses(factionID, container) {
    apiCallInProgressCount++;
    fetchFactionData(factionID)
      .then((data) => {
        if (!Array.isArray(data.members)) {
          console.warn(
            `[FF Scouter V2] No members array for faction ${factionID}`,
          );
          return;
        }

        const memberMap = {};
        data.members.forEach((member) => {
          memberMap[member.id] = member;
        });

        container.querySelectorAll("li").forEach((li) => {
          let profileLink = li.querySelector('a[href*="profiles.php?XID="]');
          if (!profileLink) return;
          let match = profileLink.href.match(/XID=(\d+)/);
          if (!match) return;
          let userID = match[1];
          updateMemberStatus(li, memberMap[userID]);
        });
      })
      .catch((err) => {
        console.error(
          "[FF Scouter V2] Error fetching faction data for faction",
          factionID,
          err,
        );
      })
      .finally(() => {
        apiCallInProgressCount--;
      });
  }

  function updateAllMemberTimers() {
    const liElements = document.querySelectorAll(
      ".enemy-faction .members-list li, .your-faction .members-list li",
    );
    liElements.forEach((li) => {
      let profileLink = li.querySelector('a[href*="profiles.php?XID="]');
      if (!profileLink) return;
      let match = profileLink.href.match(/XID=(\d+)/);
      if (!match) return;
      let userID = match[1];
      let statusEl = li.querySelector(".status");
      if (!statusEl) return;
      // wb61: don't overwrite a cell our travel/hospital chip owns — textContent
      // would wipe the chip and break chip-based group detection.
      if (statusEl.dataset.ffsTravelInjected || statusEl.dataset.ffsHospInjected) return;
      if (memberCountdowns[userID]) {
        let remaining = memberCountdowns[userID] * 1000 - Date.now();
        if (remaining < 0) remaining = 0;
        statusEl.textContent = formatTime(remaining);
      }
    });
  }

  function updateAPICalls() {
    let enemyFactionLink = document.querySelector(
      ".opponentFactionName___vhESM",
    );
    let yourFactionLink = document.querySelector(".currentFactionName___eq7n8");
    if (!enemyFactionLink || !yourFactionLink) return;

    let enemyFactionIdMatch = enemyFactionLink.href.match(/ID=(\d+)/);
    let yourFactionIdMatch = yourFactionLink.href.match(/ID=(\d+)/);
    if (!enemyFactionIdMatch || !yourFactionIdMatch) return;

    let enemyList = document.querySelector(".enemy-faction .members-list");
    let yourList = document.querySelector(".your-faction .members-list");
    if (!enemyList || !yourList) return;

    updateFactionStatuses(enemyFactionIdMatch[1], enemyList);
    updateFactionStatuses(yourFactionIdMatch[1], yourList);
  }

  function initWarScript() {
    let enemyFactionLink = document.querySelector(
      ".opponentFactionName___vhESM",
    );
    let yourFactionLink = document.querySelector(".currentFactionName___eq7n8");
    if (!enemyFactionLink || !yourFactionLink) return false;

    let enemyList = document.querySelector(".enemy-faction .members-list");
    let yourList = document.querySelector(".your-faction .members-list");
    if (!enemyList || !yourList) return false;

    updateAPICalls();
    setInterval(updateAPICalls, API_INTERVAL);
    console.log(
      "[FF Scouter V2] Torn Faction Status Countdown (Real-Time & API Status - Relative Last): Initialized",
    );
    return true;
  }

  let warObserver = new MutationObserver((mutations, obs) => {
    if (initWarScript()) {
      obs.disconnect();
    }
  });

  // Only initialize war monitoring if enabled in settings
  if (
    !document.getElementById("FFScouterV2DisableWarMonitor") &&
    ffSettingsGetToggle("war-monitor-enabled")
  ) {
    warObserver.observe(document.body, { childList: true, subtree: true });

    const memberTimersInterval = setInterval(updateAllMemberTimers, 1000);

    window.addEventListener("FFScouterV2DisableWarMonitor", () => {
      console.log(
        "[FF Scouter V2] Caught disable event, removing monitoring observer and interval",
      );
      warObserver.disconnect();

      clearInterval(memberTimersInterval);
    });
  }
  // Try to be friendly and detect other war monitoring scripts
  const catchOtherScripts = () => {
    if (
      Array.from(document.querySelectorAll("style")).some(
        (style) =>
          style.textContent.includes(
            '.members-list li:has(div.status[data-twse-highlight="true"])', // Torn War Stuff Enhanced
          ) ||
          style.textContent.includes(".warstuff_highlight") || // Torn War Stuff
          style.textContent.includes(".finally-bs-stat"), // wall-battlestats
      )
    ) {
      window.dispatchEvent(new Event("FFScouterV2DisableWarMonitor"));
    }
  };
  catchOtherScripts();
  setTimeout(catchOtherScripts, 500);

  function waitForElement(querySelector, timeout = 15000) {
    return new Promise((resolve) => {
      // Check if element already exists
      const existingElement = document.querySelector(querySelector);
      if (existingElement) {
        return resolve(existingElement);
      }

      // Set up observer to watch for element
      const observer = new MutationObserver(() => {
        const element = document.querySelector(querySelector);
        if (element) {
          observer.disconnect();
          if (timer) {
            clearTimeout(timer);
          }
          resolve(element);
        }
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true,
      });

      // Set up timeout
      const timer = setTimeout(() => {
        observer.disconnect();
        resolve(null);
      }, timeout);
    });
  }

  async function getLocalUserId() {
    const profileLink = await waitForElement(
      ".settings-menu > .link > a:first-child",
      15000,
    );

    if (!profileLink) {
      console.error(
        "[FF Scouter V2] Could not find profile link in settings menu",
      );
      return null;
    }

    const match = profileLink.href.match(/XID=(\d+)/);
    if (match) {
      const userId = match[1];
      ffdebug(`[FF Scouter V2] Found local user ID: ${userId}`);
      return userId;
    }

    console.error(
      "[FF Scouter V2] Could not extract user ID from profile link",
    );
    return null;
  }

  function getCurrentUserId() {
    return currentUserId;
  }

  // Settings management utilities
  function ffSettingsGet(key) {
    return rD_getValue(`ffscouterv2-${key}`, null);
  }

  function ffSettingsSet(key, value) {
    rD_setValue(`ffscouterv2-${key}`, value);
  }

  function ffSettingsGetToggle(key) {
    return ffSettingsGet(key) === "true";
  }

  function ffSettingsSetToggle(key, value) {
    ffSettingsSet(key, value.toString());
  }

  async function createSettingsPanel() {
    // Check if we're on the user's own profile page
    const pageId = window.location.href.match(/XID=(\d+)/)?.[1];
    if (!pageId || pageId !== currentUserId) {
      return;
    }

    // Wait for profile wrapper to be available
    const profileWrapper = await waitForElement(".profile-wrapper", 15000);
    if (!profileWrapper) {
      console.error(
        "[FF Scouter V2] Could not find profile wrapper for settings panel",
      );
      return;
    }

    // Check if settings panel already exists
    if (document.querySelector(".ff-settings-accordion")) {
      ffdebug("[FF Scouter V2] Settings panel already exists");
      return;
    }

    // Get current user data for display
    const userName =
      profileWrapper.querySelector(".user-name")?.textContent ||
      profileWrapper.querySelector(".profile-name")?.textContent ||
      profileWrapper.querySelector("h1")?.textContent ||
      "User";

    // Create the settings panel
    const settingsPanel = document.createElement("details");
    settingsPanel.className = "ff-settings-accordion";

    profileWrapper.parentNode.insertBefore(
      settingsPanel,
      profileWrapper.nextSibling,
    );

    // Add glow effect if API key is not set
    if (!key) {
      settingsPanel.classList.add("ff-settings-glow");
    }

    // Create summary
    const summary = document.createElement("summary");
    summary.textContent = "FF Scouter Settings";
    settingsPanel.appendChild(summary);

    // Create main content div
    const content = document.createElement("div");
    content.className = "ff-settings-body";

    // API Key Explanation
    const apiExplanation = document.createElement("div");
    apiExplanation.className = "ff-api-explanation ff-api-explanation-content";

    apiExplanation.innerHTML = `
      <strong>Important:</strong> You must use the SAME exact API key that you use on
      <a href="https://ffscouter.com/" target="_blank" rel="noopener noreferrer">ffscouter.com</a>.
      <br><br>
      If you're not sure which API key you used, go to
      <a href="https://www.torn.com/preferences.php#tab=api" target="_blank" rel="noopener noreferrer">your API preferences</a>
      and look for "FFScouter3" in your API key history comments.
    `;
    content.appendChild(apiExplanation);

    // API Key Input

    const apiKeyDiv = document.createElement("div");
    apiKeyDiv.className = "ff-settings-entry ff-settings-entry-large";

    const apiKeyLabel = document.createElement("label");
    apiKeyLabel.setAttribute("for", "ff-api-key");
    apiKeyLabel.textContent = "FF Scouter API Key:";
    apiKeyLabel.className = "ff-settings-label ff-settings-label-inline";
    apiKeyDiv.appendChild(apiKeyLabel);

    if (apikey[0] == "#") {
      const apiKeyInput = document.createElement("input");
      apiKeyInput.type = "text";
      apiKeyInput.id = "ff-api-key";
      apiKeyInput.placeholder = "Paste your key here...";
      apiKeyInput.className = "ff-settings-input ff-settings-input-wide";
      apiKeyInput.value = key || "";

      // Add blur class if key exists
      if (key) {
        apiKeyInput.classList.add("ff-blur");
      }

      apiKeyInput.addEventListener("focus", function () {
        this.classList.remove("ff-blur");
      });

      apiKeyInput.addEventListener("blur", function () {
        if (this.value) {
          this.classList.add("ff-blur");
        }
      });

      apiKeyInput.addEventListener("change", function () {
        const newKey = this.value;

        if (typeof newKey !== "string") {
          return;
        }

        if (newKey && newKey.length < 10) {
          this.style.outline = "1px solid red";
          return;
        }

        this.style.outline = "none";

        if (newKey === key) return;

        rD_setValue("limited_key", newKey);
        key = newKey;

        if (newKey) {
          this.classList.add("ff-blur");
          settingsPanel.classList.remove("ff-settings-glow");
        } else {
          settingsPanel.classList.add("ff-settings-glow");
        }
      });

      apiKeyDiv.appendChild(apiKeyInput);
    } else {
      const apiKeyInput = document.createElement("label");
      apiKeyInput.textContent = "Code entered in Torn PDA User Scripts";
      apiKeyInput.className = "ff-settings-label ff-settings-label-inline";
      apiKeyDiv.appendChild(apiKeyInput);
    }

    content.appendChild(apiKeyDiv);

    const premiumDiv = document.createElement("div");
    premiumDiv.className = "ff-settings-entry ff-settings-entry-large";

    const premiumLabel = document.createElement("label");
    premiumLabel.setAttribute("for", "ff-premium");
    premiumLabel.textContent = "FF Scouter Premium:";
    premiumLabel.className = "ff-settings-label ff-settings-label-inline";
    premiumDiv.appendChild(premiumLabel);

    content.appendChild(premiumDiv);

    const verifyDiv = document.createElement("div");
    verifyDiv.className = "ff-settings-entry ff-settings-entry-large";

    checkKeyButton = document.createElement("button");
    checkKeyButton.textContent = "Verify";
    checkKeyButton.className =
      "ff-settings-button ff-settings-button-large torn-btn btn-big";

    checkKeyButton.addEventListener("click", () => {
      rD_xmlhttpRequest({
        method: "GET",
        url: `${BASE_URL}/api/v1/check-key?key=${key}`,
        onload: (response) => {
          if (!response) {
            return;
          }

          if (response.status == 200) {
            var ff_response = JSON.parse(response.responseText);
            if (ff_response && ff_response.error) {
              showToast(ff_response.error);
              return;
            }

            let message = `FF Scouter not configured. API key (${ff_response.key}) not registered.`;
            let level = TOAST_ERROR;
            if (ff_response.is_registered) {
              message = `FF Scouter successfully configured. API key (${ff_response.key}) was registered on ${format_timestamp(ff_response.registered_at)} and last used ${format_timestamp(ff_response.last_used)}.`;
              level = TOAST_LOG;
            }
            showToast(message, level);
          } else {
            try {
              var err = JSON.parse(response.responseText);
              if (err && err.error) {
                showToast(
                  "API request failed. Error: " +
                    err.error +
                    "; Code: " +
                    err.code,
                );
              } else {
                showToast(
                  "API request failed. HTTP status code: " + response.status,
                );
              }
            } catch {
              showToast(
                "API request failed. HTTP status code: " + response.status,
              );
            }
          }
        },
        onerror: function (e) {
          console.error("[FF Scouter V2] **** error ", e, "; Stack:", e.stack);
        },
        onabort: function (e) {
          console.error("[FF Scouter V2] **** abort ", e, "; Stack:", e.stack);
        },
        ontimeout: function (e) {
          console.error(
            "[FF Scouter V2] **** timeout ",
            e,
            "; Stack:",
            e.stack,
          );
        },
      });
    });

    verifyDiv.appendChild(checkKeyButton);

    content.appendChild(verifyDiv);

    const rangesDiv = document.createElement("div");
    rangesDiv.className = "ff-settings-entry ff-settings-entry-large";

    const rangesLabel = document.createElement("label");
    rangesLabel.setAttribute("for", "ff-ranges");
    rangesLabel.textContent =
      "FF Ranges (Low, High, Max) -- affects the color and positions of the arrows over player's honor bars:";
    rangesLabel.className = "ff-settings-label ff-settings-label-inline";
    rangesDiv.appendChild(rangesLabel);

    const rangesInput = document.createElement("input");
    rangesInput.type = "text";
    rangesInput.id = "ff-ranges";
    rangesInput.placeholder = "2,4,8";
    rangesInput.className = "ff-settings-input ff-settings-input-narrow";

    // Set current values
    const currentRanges = get_ff_ranges(true);
    if (currentRanges) {
      rangesInput.value = `${currentRanges.low},${currentRanges.high},${currentRanges.max}`;
    }

    rangesInput.addEventListener("change", function () {
      const value = this.value;

      if (value === "") {
        reset_ff_ranges();
        this.style.outline = "none";
        return;
      }

      const parts = value.split(",").map((p) => p.trim());
      if (parts.length !== 3) {
        this.style.outline = "1px solid red";
        showToast(
          "Incorrect format: FF ranges should be exactly 3 numbers separated by commas [low,high,max]",
        );
        return;
      }

      try {
        const low = parseFloat(parts[0]);
        const high = parseFloat(parts[1]);
        const max = parseFloat(parts[2]);

        if (isNaN(low) || isNaN(high) || isNaN(max)) {
          throw new Error("Invalid numbers");
        }

        if (low <= 0 || high <= 0 || max <= 0) {
          this.style.outline = "1px solid red";
          showToast("FF ranges must be positive numbers");
          return;
        }

        if (low >= high || high >= max) {
          this.style.outline = "1px solid red";
          showToast("FF ranges must be in ascending order: low < high < max");
          return;
        }

        set_ff_ranges(low, high, max);
        this.style.outline = "none";
        showToast("FF ranges updated successfully!");
      } catch (e) {
        this.style.outline = "1px solid red";
        showToast("Invalid numbers in FF ranges");
      }
    });

    rangesDiv.appendChild(rangesInput);
    content.appendChild(rangesDiv);

    // Feature Toggles
    const featuresLabel = document.createElement("p");
    featuresLabel.textContent = "Feature toggles:";
    featuresLabel.className = "ff-settings-section-header";
    content.appendChild(featuresLabel);

    // Chain Button Toggle
    const chainToggleDiv = document.createElement("div");
    chainToggleDiv.className = "ff-settings-entry ff-settings-entry-small";

    const chainToggle = document.createElement("input");
    chainToggle.type = "checkbox";
    chainToggle.id = "chain-button-toggle";
    chainToggle.checked = ffSettingsGetToggle("chain-button-enabled");
    chainToggle.className = "ff-settings-checkbox";

    const chainLabel = document.createElement("label");
    chainLabel.setAttribute("for", "chain-button-toggle");
    chainLabel.textContent = "Enable Chain Button (Green FF Button)";
    chainLabel.className = "ff-settings-label";
    chainLabel.style.cursor = "pointer";

    chainToggleDiv.appendChild(chainToggle);
    chainToggleDiv.appendChild(chainLabel);

    content.appendChild(chainToggleDiv);

    const chainLinkTypeDiv = document.createElement("div");
    chainLinkTypeDiv.className = "ff-settings-entry ff-settings-entry-small";
    chainLinkTypeDiv.style.marginLeft = "20px";

    const chainLinkTypeLabel = document.createElement("label");
    chainLinkTypeLabel.textContent = "Chain button opens:";
    chainLinkTypeLabel.className = "ff-settings-label ff-settings-label-inline";
    chainLinkTypeDiv.appendChild(chainLinkTypeLabel);

    const chainLinkTypeSelect = document.createElement("select");
    chainLinkTypeSelect.id = "chain-link-type";
    chainLinkTypeSelect.className = "ff-settings-input";

    const attackOption = document.createElement("option");
    attackOption.value = "attack";
    attackOption.textContent = "Attack page";
    chainLinkTypeSelect.appendChild(attackOption);

    const profileOption = document.createElement("option");
    profileOption.value = "profile";
    profileOption.textContent = "Profile page";
    chainLinkTypeSelect.appendChild(profileOption);

    chainLinkTypeSelect.value = ffSettingsGet("chain-link-type") || "attack";
    chainLinkTypeDiv.appendChild(chainLinkTypeSelect);

    content.appendChild(chainLinkTypeDiv);

    const chainTabTypeDiv = document.createElement("div");
    chainTabTypeDiv.className = "ff-settings-entry ff-settings-entry-small";
    chainTabTypeDiv.style.marginLeft = "20px";

    const chainTabTypeLabel = document.createElement("label");
    chainTabTypeLabel.textContent = "Open in:";
    chainTabTypeLabel.className = "ff-settings-label ff-settings-label-inline";
    chainTabTypeDiv.appendChild(chainTabTypeLabel);

    const chainTabTypeSelect = document.createElement("select");
    chainTabTypeSelect.id = "chain-tab-type";
    chainTabTypeSelect.className = "ff-settings-input";

    const newTabOption = document.createElement("option");
    newTabOption.value = "newtab";
    newTabOption.textContent = "New tab";
    chainTabTypeSelect.appendChild(newTabOption);

    const sameTabOption = document.createElement("option");
    sameTabOption.value = "sametab";
    sameTabOption.textContent = "Same tab";
    chainTabTypeSelect.appendChild(sameTabOption);

    chainTabTypeSelect.value = ffSettingsGet("chain-tab-type") || "newtab";
    chainTabTypeDiv.appendChild(chainTabTypeSelect);

    content.appendChild(chainTabTypeDiv);

    const chainFFTargetDiv = document.createElement("div");
    chainFFTargetDiv.className = "ff-settings-entry ff-settings-entry-small";
    chainFFTargetDiv.style.marginLeft = "20px";

    const chainFFTargetLabel = document.createElement("label");
    chainFFTargetLabel.setAttribute("for", "chain-ff-target");
    chainFFTargetLabel.textContent =
      "FF target (Maximum FF the chain button should open)";
    chainFFTargetLabel.className = "ff-settings-label ff-settings-label-inline";
    chainFFTargetDiv.appendChild(chainFFTargetLabel);

    const chainFFTargetInput = document.createElement("input");
    chainFFTargetInput.id = "chain-ff-target";
    chainFFTargetInput.className = "ff-settings-input";

    chainFFTargetInput.value = ffSettingsGet("chain-ff-target") || "2.5";
    chainFFTargetDiv.appendChild(chainFFTargetInput);

    content.appendChild(chainFFTargetDiv);

    // FF History Button Toggle
    const historyToggleDiv = document.createElement("div");
    historyToggleDiv.className = "ff-settings-entry ff-settings-entry-small";
    const historyToggle = document.createElement("input");
    historyToggle.type = "checkbox";
    historyToggle.id = "ff-history-toggle";
    historyToggle.checked = ffSettingsGet("ff-history-enabled") !== "false";
    historyToggle.className = "ff-settings-checkbox";
    const historyLabel = document.createElement("label");
    historyLabel.setAttribute("for", "ff-history-toggle");
    historyLabel.textContent = "Enable FF History button on profile pages";
    historyLabel.className = "ff-settings-label";
    historyLabel.style.cursor = "pointer";
    historyToggleDiv.appendChild(historyToggle);
    historyToggleDiv.appendChild(historyLabel);
    content.appendChild(historyToggleDiv);

    // Factions Column Display
    const factionsColDiv = document.createElement("div");
    factionsColDiv.className = "ff-settings-entry ff-settings-entry-small";
    const factionsColLabel = document.createElement("label");
    factionsColLabel.setAttribute("for", "factions-col-display");
    factionsColLabel.textContent = "Factions page FF column shows:";
    factionsColLabel.className = "ff-settings-label ff-settings-label-inline";
    factionsColDiv.appendChild(factionsColLabel);
    const factionsColSelect = document.createElement("select");
    factionsColSelect.id = "factions-col-display";
    factionsColSelect.className = "ff-settings-input";
    const ffOption = document.createElement("option");
    ffOption.value = "fair_fight";
    ffOption.textContent = "Fair Fight score";
    factionsColSelect.appendChild(ffOption);
    const bsOption = document.createElement("option");
    bsOption.value = "battle_stats";
    bsOption.textContent = "Battle Stats estimate";
    factionsColSelect.appendChild(bsOption);
    factionsColSelect.value =
      ffSettingsGet("factions-col-display") || "fair_fight";
    factionsColDiv.appendChild(factionsColSelect);
    content.appendChild(factionsColDiv);

    // War Monitor Toggle
    const warToggleDiv = document.createElement("div");
    warToggleDiv.className = "ff-settings-entry ff-settings-entry-section";

    const warToggle = document.createElement("input");
    warToggle.type = "checkbox";
    warToggle.id = "war-monitor-toggle";
    warToggle.checked = ffSettingsGetToggle("war-monitor-enabled");
    warToggle.className = "ff-settings-checkbox";

    const warLabel = document.createElement("label");
    warLabel.setAttribute("for", "war-monitor-toggle");
    warLabel.textContent = "Enable War Monitor (Faction Status)";
    warLabel.className = "ff-settings-label";
    warLabel.style.cursor = "pointer";

    warToggleDiv.appendChild(warToggle);
    warToggleDiv.appendChild(warLabel);

    content.appendChild(warToggleDiv);

    const saveButtonDiv = document.createElement("div");
    saveButtonDiv.className = "ff-settings-button-container";

    const resetButton = document.createElement("button");
    resetButton.textContent = "Reset to Defaults";
    resetButton.className =
      "ff-settings-button ff-settings-button-large torn-btn btn-big";

    resetButton.addEventListener("click", function () {
      const confirmed = confirm(
        "Are you sure you want to reset all settings to their default values?",
      );
      if (!confirmed) return;

      reset_ff_ranges();
      ffSettingsSetToggle("chain-button-enabled", true);
      ffSettingsSet("chain-link-type", "attack");
      ffSettingsSet("chain-tab-type", "newtab");
      ffSettingsSet("chain-ff-target", "2.5");
      ffSettingsSetToggle("war-monitor-enabled", true);
      ffSettingsSetToggle("debug-logs", false);
      ffSettingsSet("ff-history-enabled", "true");
      ffSettingsSet("factions-col-display", "fair_fight");

      document.getElementById("ff-ranges").value = "";
      document.getElementById("chain-button-toggle").checked = true;
      document.getElementById("chain-link-type").value = "attack";
      document.getElementById("chain-tab-type").value = "newtab";
      document.getElementById("chain-ff-target").value = "2.5";
      document.getElementById("war-monitor-toggle").checked = true;
      document.getElementById("debug-logs").checked = false;
      document.getElementById("ff-history-toggle").checked = true;
      document.getElementById("factions-col-display").value = "fair_fight";

      document.getElementById("ff-ranges").style.outline = "none";

      const existingButtons = Array.from(
        document.querySelectorAll("button"),
      ).filter(
        (btn) =>
          btn.textContent === "FF" &&
          btn.style.position === "fixed" &&
          btn.style.backgroundColor === "green",
      );
      existingButtons.forEach((btn) => btn.remove());
      create_chain_button();

      showToast("Settings reset to defaults!", TOAST_LOG);

      this.style.backgroundColor = "var(--ff-success-color)";
      setTimeout(() => {
        this.style.backgroundColor = "";
      }, 1000);
    });

    const saveButton = document.createElement("button");
    saveButton.textContent = "Save Settings";
    saveButton.className =
      "ff-settings-button ff-settings-button-large torn-btn btn-big";

    saveButton.addEventListener("click", function () {
      let apiKey = null;
      if (document.getElementById("ff-api-key")) {
        apiKey = document.getElementById("ff-api-key").value;
      }
      const ranges = document.getElementById("ff-ranges").value;
      const chainEnabled = document.getElementById(
        "chain-button-toggle",
      ).checked;
      const chainLinkType = document.getElementById("chain-link-type").value;
      const chainTabType = document.getElementById("chain-tab-type").value;
      const chainFFTarget = document.getElementById("chain-ff-target").value;
      const warEnabled = document.getElementById("war-monitor-toggle").checked;
      const debugEnabled = document.getElementById("debug-logs").checked;
      const historyEnabled =
        document.getElementById("ff-history-toggle").checked;
      const factionsColDisplay = document.getElementById(
        "factions-col-display",
      ).value;

      let hasErrors = false;

      // In Torn PDA we hide the api key field because we read it from the script page
      if (document.getElementById("ff-api-key") && apiKey !== key) {
        rD_setValue("limited_key", apiKey);
        key = apiKey;

        if (apiKey) {
          settingsPanel.classList.remove("ff-settings-glow");
          document.getElementById("ff-api-key").classList.add("ff-blur");
        } else {
          settingsPanel.classList.add("ff-settings-glow");
        }
      }

      const rangesInput = document.getElementById("ff-ranges");
      if (ranges === "") {
        reset_ff_ranges();
        rangesInput.style.outline = "none";
      } else {
        const parts = ranges.split(",").map((p) => p.trim());
        if (parts.length !== 3) {
          rangesInput.style.outline = "1px solid red";
          showToast(
            "FF ranges must be exactly 3 numbers separated by commas [low,high,max]",
          );
          hasErrors = true;
        } else {
          try {
            const low = parseFloat(parts[0]);
            const high = parseFloat(parts[1]);
            const max = parseFloat(parts[2]);

            if (isNaN(low) || isNaN(high) || isNaN(max)) {
              rangesInput.style.outline = "1px solid red";
              showToast("FF ranges must be valid numbers");
              hasErrors = true;
            } else if (low <= 0 || high <= 0 || max <= 0) {
              rangesInput.style.outline = "1px solid red";
              showToast("FF ranges must be positive numbers");
              hasErrors = true;
            } else if (low >= high || high >= max) {
              rangesInput.style.outline = "1px solid red";
              showToast(
                "FF ranges must be in ascending order: low < high < max",
              );
              hasErrors = true;
            } else {
              set_ff_ranges(low, high, max);
              rangesInput.style.outline = "none";
            }
          } catch (e) {
            rangesInput.style.outline = "1px solid red";
            showToast("Invalid FF ranges format");
            hasErrors = true;
          }
        }
      }

      if (hasErrors) {
        return;
      }

      const wasChainEnabled = ffSettingsGetToggle("chain-button-enabled");
      const wasWarEnabled = ffSettingsGetToggle("war-monitor-enabled");

      ffSettingsSetToggle("chain-button-enabled", chainEnabled);
      ffSettingsSet("chain-link-type", chainLinkType);
      ffSettingsSet("chain-tab-type", chainTabType);
      ffSettingsSet("chain-ff-target", chainFFTarget);
      ffSettingsSetToggle("war-monitor-enabled", warEnabled);
      ffSettingsSetToggle("debug-logs", debugEnabled);
      ffSettingsSet("ff-history-enabled", historyEnabled.toString());
      ffSettingsSet("factions-col-display", factionsColDisplay);

      const existingButtons = Array.from(
        document.querySelectorAll("button"),
      ).filter(
        (btn) =>
          btn.textContent === "FF" &&
          btn.style.position === "fixed" &&
          btn.style.backgroundColor === "green",
      );

      if (!chainEnabled) {
        existingButtons.forEach((btn) => btn.remove());
      } else if (chainEnabled !== wasChainEnabled) {
        if (existingButtons.length === 0) {
          create_chain_button();
        }
      } else {
        existingButtons.forEach((btn) => btn.remove());
        create_chain_button();
      }

      clear_cached_targets();
      update_ff_targets();

      if (warEnabled !== wasWarEnabled) {
        if (!warEnabled) {
          window.dispatchEvent(new Event("FFScouterV2DisableWarMonitor"));
        } else {
          location.reload();
        }
      }

      showToast("Settings saved successfully!", TOAST_LOG);

      this.style.backgroundColor = "var(--ff-success-color)";
      setTimeout(() => {
        this.style.backgroundColor = "";
      }, 1000);
    });

    saveButtonDiv.appendChild(resetButton);
    saveButtonDiv.appendChild(saveButton);
    content.appendChild(saveButtonDiv);

    const cacheLabel = document.createElement("p");
    cacheLabel.textContent = "Cache management:";
    cacheLabel.className = "ff-settings-section-header";
    content.appendChild(cacheLabel);

    const cacheButtonDiv = document.createElement("div");
    cacheButtonDiv.className = "ff-settings-button-container";

    const clearCacheBtn = document.createElement("button");
    clearCacheBtn.textContent = "Clear FF Cache";
    clearCacheBtn.className = "ff-settings-button torn-btn btn-big";

    clearCacheBtn.addEventListener("click", async function () {
      const confirmed = confirm(
        "Are you sure you want to clear all FF Scouter cache?",
      );
      if (!confirmed) return;

      let count = 0;
      const keysToRemove = [];

      for (const key of rD_listValues()) {
        if (
          key.startsWith("ffscouterv2-") &&
          !key.includes("limited_key") &&
          !key.includes("ranges")
        ) {
          keysToRemove.push(key);
        }
      }

      for (const key of keysToRemove) {
        rD_deleteValue(key);
        count++;
      }

      await ffcache.delete_db();

      showToast(`Cleared ${count} cached items`);
    });

    cacheButtonDiv.appendChild(clearCacheBtn);
    content.appendChild(cacheButtonDiv);

    const debugLabel = document.createElement("p");
    debugLabel.textContent = "Debug settings:";
    debugLabel.className = "ff-settings-section-header";
    content.appendChild(debugLabel);

    const debugToggleDiv = document.createElement("div");
    debugToggleDiv.className = "ff-settings-entry ff-settings-entry-small";

    const debugToggle = document.createElement("input");
    debugToggle.type = "checkbox";
    debugToggle.id = "debug-logs";
    debugToggle.checked = ffSettingsGetToggle("debug-logs");
    debugToggle.className = "ff-settings-checkbox";

    const debugToggleLabel = document.createElement("label");
    debugToggleLabel.setAttribute("for", "debug-logs");
    debugToggleLabel.textContent = "Enable debug logging";
    debugToggleLabel.className = "ff-settings-label";
    debugToggleLabel.style.cursor = "pointer";

    debugToggleDiv.appendChild(debugToggle);
    debugToggleDiv.appendChild(debugToggleLabel);

    content.appendChild(debugToggleDiv);

    settingsPanel.appendChild(content);

    ffdebug("[FF Scouter V2] Settings panel created successfully");

    const _ckCached = (() => {
      try {
        return JSON.parse(rD_getValue(CHECK_KEY_CACHE_KEY, null));
      } catch {
        return null;
      }
    })();
    if (_ckCached) applyPremiumBadge(_ckCached.is_premium);
    checkKeyAndUpdatePremium();
  }

  function checkKeyAndUpdatePremium() {
    if (!key) return;
    const now = Date.now();
    const cached = (() => {
      try {
        return JSON.parse(rD_getValue(CHECK_KEY_CACHE_KEY, null));
      } catch {
        return null;
      }
    })();
    if (
      cached &&
      cached.last_checked &&
      now - cached.last_checked < CHECK_KEY_INTERVAL
    ) {
      ffdebug("[FF Scouter V2] check-key: using cached result");
      applyPremiumBadge(cached.is_premium);
      return;
    }
    const url = `${BASE_URL}/api/v1/check-key?key=${key}`;
    rD_xmlhttpRequest({
      method: "GET",
      url: url,
      onload: function (response) {
        if (!response || response.status !== 200) return;
        try {
          const data = JSON.parse(response.responseText);
          const result = {
            is_premium: !!data.is_premium,
            last_checked: Date.now(),
          };
          rD_setValue(CHECK_KEY_CACHE_KEY, JSON.stringify(result));
          applyPremiumBadge(result.is_premium);
        } catch (e) {
          ffdebug("[FF Scouter V2] check-key parse error", e);
        }
      },
      onerror: function (e) {
        ffdebug("[FF Scouter V2] check-key error", e);
      },
    });
  }

  function applyPremiumBadge(is_premium) {
    const existing = document.getElementById("ff-premium-badge");
    if (existing) existing.remove();
    const badge = document.createElement("span");
    badge.id = "ff-premium-badge";
    if (is_premium) {
      badge.textContent = "Enabled";
      badge.style.cssText =
        "display:inline-block;background:#4CAF50;color:#fff;font-size:11px;font-weight:bold;padding:2px 8px;border-radius:4px;vertical-align:middle;";
    } else {
      badge.textContent = "Disabled";
      badge.style.cssText =
        "display:inline-block;background:#C62828;color:#fff;font-size:11px;font-weight:bold;padding:2px 8px;border-radius:4px;vertical-align:middle;";
    }
    const premiumLabel = document.querySelector('label[for="ff-premium"]');
    if (premiumLabel) {
      premiumLabel.parentNode.insertBefore(badge, premiumLabel.nextSibling);
    }
  }

  function showToast(message, level) {
    const existing = document.getElementById("ffscouter-toast");
    if (existing) existing.remove();

    const toast = document.createElement("div");
    toast.id = "ffscouter-toast";
    toast.style.position = "fixed";
    toast.style.bottom = "30px";
    toast.style.left = "50%";
    toast.style.transform = "translateX(-50%)";
    toast.style.color = "#fff";
    toast.style.padding = "8px 16px";
    toast.style.borderRadius = "8px";
    toast.style.fontSize = "14px";
    toast.style.boxShadow = "0 2px 12px rgba(0,0,0,0.2)";
    toast.style.zIndex = "2147483647";
    toast.style.opacity = "1";
    toast.style.transition = "opacity 0.5s";
    toast.style.display = "flex";
    toast.style.alignItems = "center";
    toast.style.gap = "10px";

    const closeBtn = document.createElement("span");
    closeBtn.textContent = "×";
    closeBtn.style.cursor = "pointer";
    closeBtn.style.marginLeft = "8px";
    closeBtn.style.fontWeight = "bold";
    closeBtn.style.fontSize = "18px";
    closeBtn.setAttribute("aria-label", "Close");
    closeBtn.onclick = () => toast.remove();

    switch (level) {
      case TOAST_LOG:
        toast.style.background = "green";
        break;

      case TOAST_ERROR:
      default:
        toast.style.background = "#c62828";
        break;
    }

    const msg = document.createElement("span");
    if (
      message ===
      "Invalid API key. Please sign up at ffscouter.com to use this service"
    ) {
      msg.innerHTML =
        'FairFight Scouter: Invalid API key. Please sign up at <a href="https://ffscouter.com" target="_blank" rel="noopener noreferrer" style="color: #fff; text-decoration: underline; font-weight: bold;">ffscouter.com</a> to use this service';
    } else {
      msg.textContent = `FairFight Scouter: ${message}`;
    }

    console.log("[FF Scouter V2] Toast: ", message);

    toast.appendChild(msg);
    toast.appendChild(closeBtn);
    document.body.appendChild(toast);
    setTimeout(() => {
      if (toast.parentNode) {
        toast.style.opacity = "0";
        setTimeout(() => toast.remove(), 500);
      }
    }, 4000);
  }

  create_chain_button();
  update_ff_targets();
  checkKeyAndUpdatePremium();
  setInterval(checkKeyAndUpdatePremium, CHECK_KEY_INTERVAL);

  getLocalUserId().then((userId) => {
    if (userId) {
      currentUserId = userId;
      ffdebug(`[FF Scouter V2] Current user ID initialized: ${currentUserId}`);

      createSettingsPanel();

      const profileObserver = new MutationObserver(() => {
        const pageId = window.location.href.match(/XID=(\d+)/)?.[1];
        if (
          pageId === currentUserId &&
          window.location.pathname === "/profiles.php"
        ) {
          createSettingsPanel();
        }
      });

      profileObserver.observe(document.body, {
        childList: true,
        subtree: true,
      });
    }
  });
}
