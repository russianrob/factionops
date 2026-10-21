// ==UserScript==
// @name         Torn Dual Flyout Private
// @namespace    RussianRob.torn-dual-flyout.private
// @version      1.6.6
// @description  Private test build of Torn Dual Flyout: the two-way swipe menu plus a row of pinned menu links under Torn's phone header. Run this OR the public Torn Dual Flyout, not both.
// @author       RussianRob
// @downloadURL  https://tornwar.com/scripts/torn-dual-flyout-private.user.js
// @updateURL    https://tornwar.com/scripts/torn-dual-flyout-private.meta.js
// @license      All Rights Reserved
// @match        https://www.torn.com/*
// @run-at       document-start
// @grant        none
// ==/UserScript==
(function () {
  "use strict";
  // Shown instead of running when another copy of Torn Dual Flyout got here first.
  function showBothOnNote() {
    var tries = 0;
    var iv = setInterval(function () {
      if (++tries > 100) { clearInterval(iv); return; }        // ~20s and still no page: give up
      if (!document.body) return;                              // document-start: wait for <body>
      clearInterval(iv);
      if (document.getElementById("tdfp-both-on")) return;
      var n = document.createElement("div");
      n.id = "tdfp-both-on";
      n.setAttribute("style", "position:fixed;left:0;right:0;top:0;z-index:2147483002;padding:8px 34px 8px 10px;" +
        "background:#3b2f00;color:#ffe08a;border-bottom:1px solid #6b5500;font:13px/1.35 -apple-system,system-ui,sans-serif;");
      n.textContent = "Torn Dual Flyout Private is off because the public Torn Dual Flyout is also on. " +
        "Turn the public one off to test this build.";
      var x = document.createElement("span");
      x.textContent = "\u00d7";
      x.setAttribute("style", "position:absolute;right:10px;top:3px;font-size:20px;cursor:pointer;");
      x.addEventListener("click", function () { n.remove(); });
      n.appendChild(x);
      document.body.appendChild(n);
    }, 200);
  }
  // Two copies of Torn Dual Flyout would both answer every swipe. The public copy
  // already steps aside when this flag is set, so whichever loads first runs alone;
  // if the public one won, this build stays off and says why.
  if (window.__tornMenuRight) { showBothOnNote(); return; }
  window.__tornMenuRight = true;
  window.__tdfVer = "1.6.6";   // runtime version marker (confirm the installed build)

  var html = document.documentElement;

  var css =
    'html.tmr-right #fly-out-panel{position:fixed!important;left:auto!important;right:0!important;top:36px!important;' +
    'border-left:1px solid #444!important;border-right:0!important;' +
    'border-top-left-radius:5px!important;border-top-right-radius:0!important;}' +
    'html.tmr-right #fly-out-panel:not([class*="visible___"]){transform:translateX(100%)!important;}' +
    'html.tmr-right #fly-out-panel[class*="visible___"]{box-shadow:-1px 0 5px rgba(0,0,0,.7)!important;}' +
    'html.tmr-left #fly-out-panel{position:fixed!important;right:auto!important;left:0!important;top:36px!important;' +
    'border-right:1px solid #444!important;border-left:0!important;' +
    'border-top-right-radius:5px!important;border-top-left-radius:0!important;}' +
    'html.tmr-left #fly-out-panel:not([class*="visible___"]){transform:translateX(-100%)!important;}' +
    'html.tmr-left #fly-out-panel[class*="visible___"]{box-shadow:1px 0 5px rgba(0,0,0,.7)!important;}' +
    // Every icon on its own layer. Torn's icons carry a CSS drop-shadow, and on iOS 18
    // WebKit draws those only for the part of the scrolling panel that is on screen when
    // the menu opens, never redrawing them on scroll, so the icons scrolled out of view
    // stay blank. With a layer each they are drawn whole and keep their shadow. Only the
    // svg itself: Torn positions some icon paths with transforms of their own.
    '#fly-out-panel svg{transform:translateZ(0);}' +
    '#fly-out-menu-button::after{content:"◀";position:absolute;bottom:0;left:50%;transform:translateX(-50%);' +
    'font-size:11px;line-height:1;font-weight:700;background:linear-gradient(to top,#666,#888);' +
    '-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;color:transparent;pointer-events:none;}' +
    'html.tmr-right #fly-out-menu-button::after{content:"▶";}' +
    // While the row shows a pinned Messages / Events / Awards the button counts only the
    // ones still in the menu (syncMenuButton): Torn's number is hidden and that count is
    // drawn over it, in Torn's own colour and size.
    '#fly-out-menu-button[data-tdf-count] [class*="notificationsAmount___"]{visibility:hidden!important;}' +
    '#fly-out-menu-button[data-tdf-count] [class*="notificationsAmount___"]::after{content:var(--tdf-count);visibility:visible;position:absolute;top:0;left:0;}' +
    '#tdf-cog{position:absolute;background:transparent;border:0;padding:0;margin:0;cursor:pointer;display:flex;align-items:center;justify-content:center;z-index:2147483001;pointer-events:auto;-webkit-tap-highlight-color:transparent;}' +
    '#tdf-cog svg{display:block;}' +
    '#tdf-settings{position:fixed;top:40px;left:8px;right:8px;margin:0 auto;max-width:280px;z-index:2147483000;background:#0e0f12;border:1px solid #2e333d;border-radius:8px;padding:10px 12px;color:#dde2e8;font:13px -apple-system,system-ui,sans-serif;box-shadow:0 8px 28px rgba(0,0,0,.65);}' +
    '#tdf-settings.tdf-hidden{display:none;}' +
    '#tdf-settings h4{margin:0 0 6px;font-size:13px;font-weight:700;color:#f3f4f6;display:flex;justify-content:space-between;align-items:center;}' +
    '#tdf-settings .tdf-x{cursor:pointer;color:#8a8f98;font-size:18px;line-height:1;padding:0 4px;}' +
    '#tdf-settings label{display:flex;align-items:center;gap:9px;padding:7px 0;cursor:pointer;}' +
    '#tdf-settings input{width:16px;height:16px;accent-color:#4ade80;margin:0;flex:0 0 auto;}' +
    'html.tdf-iconsonly #fly-out-panel a{font-size:0!important;}' +
    'html.tdf-iconsonly #fly-out-panel a svg,html.tdf-iconsonly #fly-out-panel a img{font-size:initial!important;}' +
    'html.tdf-iconsonly #fly-out-panel{width:auto!important;min-width:0!important;}' +
    'html.tdf-iconsonly #fly-out-panel [class*="toggleBtn___"]{display:none!important;}' +
    'html.tdf-iconsonly #fly-out-panel [class*="accountLinksWrap___"]{display:block!important;height:auto!important;}' +
    'html.tdf-iconsonly #fly-out-panel [class*="accountLinks___"]{flex-direction:column!important;align-items:flex-start!important;height:auto!important;}' +
    'html.tdf-iconsonly #fly-out-panel [class*="accountLinks___"] [class*="wrap___"]{width:auto!important;margin:0!important;}' +
    // Sticky effects apply ONLY while the flyout is open, so a closed menu (incl. right
    // after navigation) leaves Torn's normal scroll/header behaviour untouched.
    'html.tdf-sticky.tdf-menu-open #sidebar [class*="overlay___"]{display:none!important;}' +
    'html.tdf-sticky.tdf-menu-open{overflow-y:auto!important;}' +
    'html.tdf-sticky.tdf-menu-open body{overflow:visible!important;}' +
    // Pre-open: while a sticky reopen is pending, paint the panel already in its open
    // position (no closed-off-screen frame, no slide-in) so there's no flash. Dropped
    // the instant React's real open state (visible___) takes over.
    'html.tdf-preopen #fly-out-panel{transform:none!important;transition:none!important;}' +
    'html.tdf-preopen #sidebar [class*="overlay___"]{display:none!important;}' +
    // Pinned links: a row under Torn's phone header, drawn the way Torn's own phone top
    // bar draws its links (its sidebar-old stylesheet, read off the owner's phone on
    // 2026-10-21): the same dark bar, nine links to a screen width, Torn's short names,
    // counts and colours. It wraps onto another line rather than ever sliding
    // sideways: the sliding is what the player found finicky about Torn's bar.
    '#tdf-pins{display:flex;flex-wrap:wrap;justify-content:flex-start;align-items:center;box-sizing:border-box;width:100%;margin:0;padding:0;' +
    'position:relative;z-index:100;background:#333;border-top:1px solid #000;border-bottom:1px solid #000;' +
    'box-shadow:inset 0 1px rgba(255,255,255,.1),0 1px rgba(255,255,255,.1);font-family:Arial,Helvetica,sans-serif;' +
    '-webkit-user-select:none;user-select:none;}' +
    '#tdf-pins.tdf-pins-jail{background:#353526;}' +
    'body.dark-mode #tdf-pins.tdf-pins-jail{background:#242415;}' +
    '#tdf-pins.tdf-pins-hospital{background:#3b3b3b;}' +
    'body[data-abroad="true"] #tdf-pins:not(.tdf-pins-jail):not(.tdf-pins-hospital){background:#26333f;}' +
    // A pin is one of Torn's slides (Torn's share of the width for this screen, see
    // perLine; 2px either side) holding the same nesting as Torn's link: a 40px row, then
    // the link with its icon and name.
    '#tdf-pins .tdf-pin{position:relative;display:block;box-sizing:border-box;flex:0 0 calc(100% / var(--tdf-cols, 9));' +
    'width:calc(100% / var(--tdf-cols, 9));max-width:calc(100% / var(--tdf-cols, 9));padding:0 2px;text-align:center;color:#999;' +
    'font-size:6px;font-weight:700;text-transform:uppercase;' +
    'text-decoration:none;-webkit-touch-callout:none;-webkit-tap-highlight-color:transparent;-webkit-user-select:none;user-select:none;}' +
    '#tdf-pins .tdf-pin-row{display:block;position:relative;max-width:40px;margin:0 auto;}' +
    '#tdf-pins .tdf-pin-link{display:flex;flex-direction:column;align-items:center;margin:4px 0;padding:0;}' +
    '.tdf-pin-icon{display:flex;flex-direction:row;justify-content:center;align-items:center;width:34px;height:23px;}' +
    '.tdf-pin-glyph,#tdf-pins .tdf-pin-name{display:block;white-space:nowrap;line-height:7px;}' +
    '#tdf-pins .tdf-pin-name{max-width:100%;overflow:hidden;text-overflow:ellipsis;}' +
    '#tdf-pins .tdf-pin-badge{position:absolute;top:-1px;right:-3px;width:14px;text-align:center;letter-spacing:-1px;color:#74c0fc;' +
    'font:700 10px/8px Arial,Helvetica,sans-serif;}' +
    // Names, as Torn's bar colours them: unread Messages, Events or Awards are green, name
    // and count (the name a lighter green in hospital), the page you are on is white,
    // Torn's blue "something here" is blue (paler on the page you are on), and in jail, in
    // hospital or abroad only the names left plain take that status's tint.
    '#tdf-pins .tdf-pin.tdf-pin-avail{color:#85b200;}' +
    '#tdf-pins .tdf-pin.tdf-pin-avail .tdf-pin-badge{color:#85b200;}' +
    '#tdf-pins .tdf-pin.tdf-pin-on{color:#fff;}' +
    '#tdf-pins .tdf-pin.tdf-pin-attn{color:#74c0fc;}' +
    '#tdf-pins .tdf-pin.tdf-pin-attn.tdf-pin-on{color:#d0ebff;}' +
    '#tdf-pins .tdf-pin.tdf-pin-jail:not(.tdf-pin-on):not(.tdf-pin-attn):not(.tdf-pin-avail){color:#bdbdae;}' +
    '#tdf-pins .tdf-pin.tdf-pin-hospital:not(.tdf-pin-on):not(.tdf-pin-attn):not(.tdf-pin-avail){color:#ddd;}' +
    '#tdf-pins .tdf-pin.tdf-pin-hospital.tdf-pin-avail{color:#a3d900;}' +
    'body[data-abroad="true"] #tdf-pins .tdf-pin:not(.tdf-pin-jail):not(.tdf-pin-hospital):not(.tdf-pin-on):not(.tdf-pin-attn)' +
    ':not(.tdf-pin-avail){color:#8fa6bc;}' +
    // Torn's blue dot on a highlighted link.
    '#tdf-pins .tdf-pin.tdf-pin-attn::after{content:"";display:block;position:absolute;top:2px;right:4px;width:6px;height:6px;' +
    'border-radius:100%;background:linear-gradient(#74c0fc,#1c7ed6);box-shadow:0 1px rgba(0,0,0,.25);}' +
    '#tdf-pins .tdf-pin.tdf-pin-attn.tdf-pin-on::after{background:linear-gradient(#e7f5ff,#74c0fc);}' +
    // Icons: Torn's top-bar gradients (copies, see ensureDefs) and shadows, rule for rule
    // in Torn's order. Each icon also gets a layer of its own, as the menu's do (above):
    // the cog panel's pin list scrolls, and WebKit leaves shadowed icons blank when they
    // scroll into view without one.
    '.tdf-pin-icon svg{max-width:34px;max-height:34px;overflow:visible;fill:url(#tdf-g-regular);filter:drop-shadow(0 0 1.3px #000);transform:translateZ(0);}' +
    '#tdf-pins .tdf-pin.tdf-pin-on .tdf-pin-icon svg{fill:url(#tdf-g-regular-on);filter:drop-shadow(0 0 1px rgba(255,255,255,.5));}' +
    '#tdf-pins .tdf-pin.tdf-pin-avail .tdf-pin-icon svg,#tdf-pins .tdf-pin.tdf-pin-jail.tdf-pin-avail .tdf-pin-icon svg{' +
    'fill:url(#tdf-g-green);filter:drop-shadow(0 0 1.2px rgba(133,178,0,.44));}' +
    '#tdf-pins .tdf-pin.tdf-pin-hospital.tdf-pin-avail .tdf-pin-icon svg,#tdf-pins .tdf-pin.tdf-pin-travel.tdf-pin-avail .tdf-pin-icon svg{' +
    'fill:url(#tdf-g-hospital-green);filter:none;}' +
    '#tdf-pins .tdf-pin.tdf-pin-attn .tdf-pin-icon svg,#tdf-pins .tdf-pin.tdf-pin-hospital.tdf-pin-attn .tdf-pin-icon svg,' +
    '#tdf-pins .tdf-pin.tdf-pin-jail.tdf-pin-attn .tdf-pin-icon svg,#tdf-pins .tdf-pin.tdf-pin-travel.tdf-pin-attn .tdf-pin-icon svg{fill:url(#tdf-g-blue);}' +
    '#tdf-pins .tdf-pin.tdf-pin-attn.tdf-pin-on .tdf-pin-icon svg,#tdf-pins .tdf-pin.tdf-pin-hospital.tdf-pin-attn.tdf-pin-on .tdf-pin-icon svg,' +
    '#tdf-pins .tdf-pin.tdf-pin-jail.tdf-pin-attn.tdf-pin-on .tdf-pin-icon svg,#tdf-pins .tdf-pin.tdf-pin-travel.tdf-pin-attn.tdf-pin-on .tdf-pin-icon svg{fill:url(#tdf-g-blue-on);}' +
    '#tdf-pins .tdf-pin.tdf-pin-attn.tdf-pin-on .tdf-pin-icon svg,#tdf-pins .tdf-pin.tdf-pin-jail.tdf-pin-attn.tdf-pin-on .tdf-pin-icon svg{filter:none;}' +
    '#tdf-pins .tdf-pin.tdf-pin-jail .tdf-pin-icon svg{fill:url(#tdf-g-jail);filter:drop-shadow(0 1px 1.3px #000);}' +
    '#tdf-pins .tdf-pin.tdf-pin-jail.tdf-pin-on .tdf-pin-icon svg{fill:url(#tdf-g-white);filter:drop-shadow(0 1px 1.3px #fff);}' +
    '#tdf-pins .tdf-pin.tdf-pin-hospital .tdf-pin-icon svg{fill:url(#tdf-g-hospital);filter:drop-shadow(0 1px 1.3px #000);}' +
    '#tdf-pins .tdf-pin.tdf-pin-hospital.tdf-pin-on .tdf-pin-icon svg,#tdf-pins .tdf-pin.tdf-pin-travel.tdf-pin-on .tdf-pin-icon svg{fill:url(#tdf-g-white);filter:none;}' +
    '#tdf-pins .tdf-pin.tdf-pin-travel .tdf-pin-icon svg{fill:url(#tdf-g-travel);filter:drop-shadow(0 1px 1.3px #000);}' +
    '#tdf-settings .tdf-pin-icon svg,.tdf-order-ghost .tdf-pin-icon svg{max-height:23px;}' +
    // Icons only hides the names, as it does in the menu; a pin with no icon keeps its
    // name, so it is never an empty box.
    'html.tdf-iconsonly #tdf-pins .tdf-pin:not(.tdf-pin-noicon) .tdf-pin-name{display:none;}' +
    // The cog panel's pin list scrolls inside the panel once it outgrows half the screen.
    '#tdf-settings .tdf-pins-head{margin:8px 0 2px;padding-top:8px;border-top:1px solid #2e333d;font-weight:700;color:#f3f4f6;}' +
    '#tdf-settings .tdf-pins-list{max-height:50vh;overflow-y:auto;}' +
    '#tdf-settings .tdf-pins-list label{padding:4px 0;}' +
    '#tdf-settings .tdf-pins-none{color:#8a8f98;padding:4px 0;}' +
    '#tdf-settings .tdf-pins-err{color:#fca5a5;padding:4px 0;}' +
    // The bar order list keeps its heading's and tiles' margins inside it, so its height
    // is all the room it takes, with or without room kept for unticked pins (keepPlace).
    '#tdf-settings .tdf-order{display:flow-root;}' +
    // The bar order list: one tile per pin, as Torn's own Navigation settings draws its
    // links (its preferences build, dark mode, 2026-10-21): a dark rounded tile 32px tall
    // and 2px from the next, the icon in a 34 x 23 box, then the name. The whole tile is
    // what a finger holds, so nothing under it scrolls, is selected or calls out.
    '#tdf-settings .tdf-order-row,.tdf-order-ghost{display:flex;align-items:center;box-sizing:border-box;margin-bottom:2px;padding:0 8px 0 0;' +
    'background-color:#333;color:#ddd;border-radius:5px;box-shadow:0 0 2px rgba(0,0,0,.35);font-size:12px;' +
    'font-family:Arial,Helvetica,sans-serif;line-height:32px;letter-spacing:.3px;cursor:grab;touch-action:none;' +
    '-webkit-user-select:none;user-select:none;-webkit-touch-callout:none;-webkit-tap-highlight-color:transparent;}' +
    '#tdf-settings .tdf-order-row .tdf-pin-icon,.tdf-order-ghost .tdf-pin-icon{flex:0 0 auto;}' +
    '#tdf-settings .tdf-order-name,.tdf-order-ghost .tdf-order-name{flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}' +
    // While a tile is dragged the tiles it passes slide out of its way, the tile itself
    // stays faded in the place it will land, and a copy of it floats over the page under
    // the pointer, with no lag, letting every touch through to what is under it.
    '#tdf-settings .tdf-order-row{transition:transform .25s ease;}' +
    '#tdf-settings .tdf-order-row.tdf-order-lifted{opacity:.3;}' +
    '.tdf-order-ghost{position:fixed;z-index:2147483001;margin:0;pointer-events:none;transition:none;}' +
    // The panel scrolls inside the screen once its two lists outgrow it: 40px from the
    // top and 8px clear of the bottom, less its own padding and border (22px). dvh is
    // the screen less the browser's own bars, where the browser knows it.
    '#tdf-settings{max-height:calc(100vh - 70px);max-height:calc(100dvh - 70px);overflow-y:auto;overscroll-behavior:contain;}';
  var s = document.createElement("style");
  s.id = "torn-menu-right";
  s.textContent = css;
  (document.head || document.documentElement).appendChild(s);

  var OPEN_DIST = 70;
  var CLOSE_DIST = 60;
  var HORIZ_RATIO = 2.0;
  var SYS_EDGE = 24;
  // The phone owns swipes that start this close to either screen edge: iOS uses them
  // for back/forward and Android gesture navigation for Back. Open swipes start further in.
  var OPEN_EDGE = 30;

  // Containers that scroll horizontally by transforming an inner track (e.g. flexslider),
  // so they report overflow-x:hidden even though content overflows. A swipe inside these
  // should NOT open the menu.
  var CAROUSEL_SEL = '.flex-viewport,[class*="flex-viewport"],[class*="flexslider"],[class*="slider"],[class*="carousel"]';

  function setSide(right) { html.classList.toggle("tmr-right", right); html.classList.toggle("tmr-left", !right); try { localStorage.setItem("tmr_side", right ? "r" : "l"); } catch (e) {} }
  var savedSide = "r";
  try { savedSide = localStorage.getItem("tmr_side") || "r"; } catch (e) {}
  setSide(savedSide !== "l");

  function iconsOnly() { try { return localStorage.getItem("tdf_iconsonly") === "1"; } catch (e) { return false; } }
  function applyIconsOnly(on) { html.classList.toggle("tdf-iconsonly", !!on); try { localStorage.setItem("tdf_iconsonly", on ? "1" : "0"); } catch (e) {} }
  applyIconsOnly(iconsOnly());

  // Sticky = scroll the page while the menu is open AND keep the menu open across every
  // page load / refresh / nav. Migrate the old separate "keep open" pin into sticky.
  function sticky() { try { return localStorage.getItem("tdf_sticky") === "1"; } catch (e) { return false; } }
  function applySticky(on) { html.classList.toggle("tdf-sticky", !!on); try { localStorage.setItem("tdf_sticky", on ? "1" : "0"); } catch (e) {} }
  try { if (localStorage.getItem("tdf_pinopen") === "1") { localStorage.setItem("tdf_sticky", "1"); localStorage.removeItem("tdf_pinopen"); } } catch (e) {}
  applySticky(sticky());

  var start = null;

  function panel() { return document.getElementById("fly-out-panel"); }
  function menuButton() { return document.getElementById("fly-out-menu-button"); }
  function isOpen() { var p = panel(); return !!p && /visible___/.test(p.className); }
  function mobileActive() { var b = menuButton(); return !!b && b.getClientRects().length > 0; }

  // Mirror the flyout's open/closed state onto <html> so sticky CSS only engages
  // while the menu is actually open. Must catch not only the panel's visible___ class
  // toggling but also the panel being unmounted (childList) and SPA route changes.
  function syncMenuOpen() { html.classList.toggle("tdf-menu-open", isOpen()); }
  function startMenuObserver() {
    var root = document.getElementById("sidebarroot") || document.body;
    if (!root || root.__tdfMenuObs) return;
    root.__tdfMenuObs = true;
    new MutationObserver(syncMenuOpen).observe(root, { attributes: true, attributeFilter: ["class"], childList: true, subtree: true });
    syncMenuOpen();
  }

  function toggleMenu() {
    var b = menuButton();
    if (!b) return;
    var key = null, keys = Object.keys(b), i;
    for (i = 0; i < keys.length; i++) { if (keys[i].indexOf("__reactProps$") === 0) { key = keys[i]; break; } }
    var props = key ? b[key] : null;
    if (!props || typeof props.onClick !== "function") return;
    try {
      props.onClick({
        preventDefault: function () {}, stopPropagation: function () {},
        persist: function () {}, isDefaultPrevented: function () { return false; },
        isPropagationStopped: function () { return false; },
        nativeEvent: { stopImmediatePropagation: function () {}, preventDefault: function () {}, stopPropagation: function () {} },
        currentTarget: b, target: b, type: "click", button: 0, detail: 1
      });
    } catch (err) {}
  }

  // Sticky persistence: navigating (full reload or SPA route) closes the flyout, so in
  // sticky mode we re-open it afterwards — it behaves like a pinned sidebar you click through.
  var reopenIv = null, reopening = false;
  function cancelReopen() {
    if (reopenIv) { clearInterval(reopenIv); reopenIv = null; }
    reopening = false;
    html.classList.remove("tdf-preopen");
  }
  function reopenSoon() {
    if (reopening) return;                   // one reopen loop at a time — rapid nav must not double-toggle
    reopening = true;
    var tries = 0, sinceToggle = 99;         // 99 → the first hydrated tick toggles immediately
    reopenIv = setInterval(function () {
      if (isOpen()) { cancelReopen(); return; }   // real open state took over
      var b = menuButton();
      // React props must be attached (page hydrated) before toggleMenu works.
      var ready = b && mobileActive() && Object.keys(b).some(function (k) { return k.indexOf("__reactProps$") === 0; });
      // toggleMenu() is a TOGGLE, not an idempotent open — never re-fire it on the very next
      // tick (that would shut a menu still mid-open). Toggle once, then wait ~6 ticks (~0.9s)
      // for React to apply the open state before retrying.
      if (ready) { if (sinceToggle >= 6) { toggleMenu(); sinceToggle = 0; } else sinceToggle++; }
      if (++tries > 60) cancelReopen();            // gave up (~9s) → don't leave it stuck open-looking
    }, 150);
  }
  function maybeReopen() {
    if (!sticky()) return;                   // sticky = keep the menu open across this load/nav
    html.classList.add("tdf-preopen");       // paint the panel open immediately → no closed→open flash
    reopenSoon();
  }

  function onScrollStrip(el) {
    for (var n = el; n && n !== document.body && n !== document.documentElement; n = n.parentElement) {
      if (n.scrollWidth > n.clientWidth + 4) {
        var ox = getComputedStyle(n).overflowX;
        if (ox === "auto" || ox === "scroll") return true;
        // Transform-based carousels (flexslider etc.) overflow but report overflow-x:hidden.
        if (n.matches && n.matches(CAROUSEL_SEL)) return true;
      }
    }
    return false;
  }

  function onStart(e) {
    if (!e.touches || e.touches.length !== 1 || !mobileActive()) { start = null; return; }
    // A touch in the cog panel is for the panel: a tile dragged, a list scrolled.
    if (e.target && e.target.closest && e.target.closest("#tdf-settings")) { start = null; return; }
    var t = e.touches[0];
    if (!isOpen() && onScrollStrip(e.target)) { start = null; return; }
    // An edge swipe is the phone navigating: don't also open the menu or flip its side.
    if (!isOpen() && (t.clientX <= OPEN_EDGE || t.clientX >= window.innerWidth - OPEN_EDGE)) { start = null; return; }
    start = { x: t.clientX, y: t.clientY, id: t.identifier, open: isOpen(), sideSet: false };
  }

  function onMove(e) {
    var s0 = start;
    if (!s0 || s0.sideSet || s0.open || !e.touches || e.touches.length !== 1) return;
    var t = e.touches[0];
    if (t.identifier !== s0.id) return;
    var dx = t.clientX - s0.x, dy = t.clientY - s0.y;
    if (Math.abs(dx) < Math.abs(dy) * HORIZ_RATIO) return;
    if (dx <= -OPEN_DIST) { setSide(true); s0.sideSet = true; }
    else if (dx >= OPEN_DIST) { setSide(false); s0.sideSet = true; }
  }

  function onEnd(e) {
    var s0 = start; start = null;
    if (!s0 || !e.changedTouches) return;
    var t = null, i;
    for (i = 0; i < e.changedTouches.length; i++) { if (e.changedTouches[i].identifier === s0.id) { t = e.changedTouches[i]; break; } }
    if (!t) return;
    var dx = t.clientX - s0.x, dy = t.clientY - s0.y;
    if (Math.abs(dx) < Math.abs(dy) * HORIZ_RATIO) return;
    var vw = window.innerWidth;
    var rightSide = html.classList.contains("tmr-right");
    var action = null;
    if (!s0.open) {
      if (dx <= -OPEN_DIST) { if (!s0.sideSet) setSide(true); action = "open"; }
      else if (dx >= OPEN_DIST) { if (!s0.sideSet) setSide(false); action = "open"; }
    } else if (rightSide && dx >= CLOSE_DIST && s0.x > SYS_EDGE) action = "close";
    else if (!rightSide && dx <= -CLOSE_DIST && s0.x < vw - SYS_EDGE) action = "close";
    if (!action) return;
    // A deliberate swipe-close means the owner wants it shut — abort any in-flight reopen
    // so the interval can't fight the close (sticky still returns it on the next navigation).
    if (action === "close") cancelReopen();
    setTimeout(function () {
      if (action === "open") { if (!isOpen()) toggleMenu(); }
      else if (isOpen()) toggleMenu();
    }, 0);
  }

  function buildSettings() {
    if (document.getElementById("tdf-settings")) return;
    var d = document.createElement("div");
    d.id = "tdf-settings";
    d.className = "tdf-hidden";
    // Torn's sidebar takes no swipe that starts under this mark, as on its own Navigation
    // settings list, so a tile dragged here never opens Torn's menu either.
    d.setAttribute("data-prevent-flyout-swipe", "true");
    d.innerHTML = '<h4>Torn Dual Flyout Private <span class="tdf-x">×</span></h4>' +
      '<label><input type="checkbox" class="tdf-iconsonly-cb"' + (iconsOnly() ? " checked" : "") + "> Icons only (hide menu names)</label>" +
      '<label><input type="checkbox" class="tdf-sticky-cb"' + (sticky() ? " checked" : "") + "> Sticky (keep menu open across pages + scroll while open)</label>" +
      '<div class="tdf-pins-head">Pinned links (shown under the header)</div>' +
      '<div class="tdf-pins-list"></div>' +
      // Below the tick list, so a tick that brings it in or takes it away never moves
      // the row just tapped.
      '<div class="tdf-order"></div>';
    (document.body || html).appendChild(d);
    d.querySelector(".tdf-x").addEventListener("click", function () { d.classList.add("tdf-hidden"); });
    d.querySelector(".tdf-iconsonly-cb").addEventListener("change", function (ev) { applyIconsOnly(ev.target.checked); });
    d.querySelector(".tdf-sticky-cb").addEventListener("change", function (ev) { applySticky(ev.target.checked); if (ev.target.checked && !isOpen()) { html.classList.add("tdf-preopen"); reopenSoon(); } });
  }
  function toggleSettings() {
    buildSettings();
    var d = document.getElementById("tdf-settings");
    if (!d) return;
    d.classList.toggle("tdf-hidden");
    if (!d.classList.contains("tdf-hidden")) fillPinList(d);   // fresh from the menu each time it opens
  }
  // The cog panel's "Pinned links" list: every link in the menu with a tick box,
  // rebuilt from the menu each time the panel opens, so new or renamed rows show up.
  function fillPinList(d) {
    var box = d.querySelector(".tdf-pins-list");
    if (!box) return;
    // A fresh list, a fresh start: the next failed tick or move says so again, and the
    // order list gives up any room it kept for unticked pins.
    d.querySelectorAll(".tdf-pins-err").forEach(function (n) { n.remove(); });
    var order = d.querySelector(".tdf-order");
    if (order) order.style.minHeight = "";
    ensureDefs();   // the list's icons use the same gradients as the row's
    fillOrderList(d);
    var links = menuLinks(), pins = loadPins();
    box.textContent = "";
    if (!links.length) {
      var none = document.createElement("div");
      none.className = "tdf-pins-none";
      none.textContent = "No menu links found yet. Open the menu once, then reopen this panel.";
      box.appendChild(none);
      return;
    }
    links.forEach(function (l) {
      var label = document.createElement("label");
      var cb = document.createElement("input");
      cb.type = "checkbox";
      cb.setAttribute("data-key", l.key);
      cb.checked = pins.indexOf(l.key) !== -1;
      cb.addEventListener("change", function () {
        var top = d.scrollTop;
        setPinned(l.key, cb.checked);
        // Show what was saved, not what was tapped: a full localStorage refuses the write.
        var saved = loadPins().indexOf(l.key) !== -1;
        if (saved !== cb.checked) { cb.checked = saved; saveError(box); }
        fillOrderList(d);
        keepPlace(d, top);
      });
      label.appendChild(cb);
      label.appendChild(iconClone(l));
      label.appendChild(document.createTextNode(l.name));
      box.appendChild(label);
    });
  }
  // The order list is the panel's last part, so an untick that takes a tile off it takes
  // that much off the panel's foot. Scrolled down to there, the browser has to scroll the
  // panel back by as much, sliding the tick list under the finger, and a quick second tap
  // lands on the row before. Instead the order list keeps that room until the panel next
  // opens, and the panel goes back to where it was, all before anything is painted.
  function keepPlace(d, top) {
    var lost = top - d.scrollTop;   // the browser lays the panel out to answer this
    if (lost <= 0) return;
    var box = d.querySelector(".tdf-order");
    box.style.minHeight = box.offsetHeight + lost + "px";
    d.scrollTop = top;
  }
  // The cog panel's "Bar order" list: the pins the bar shows, first at the top, one tile
  // each, the way Torn's Navigation settings lists its links. A tile is held and dragged
  // to its new place (below), and one that has the focus moves a place at a time with
  // the arrow keys. A move redraws only this list, so the tick list above stays scrolled
  // where it was.
  function fillOrderList(d) {
    var box = d.querySelector(".tdf-order");
    if (!box) return;
    stopDrag();   // a list drawn afresh ends any drag on the old one
    var shown = pinnedInMenu(loadPins(), menuLinks());
    box.textContent = "";
    if (shown.length < 2) return;   // one pin or none: nothing to put in order
    var head = document.createElement("div");
    head.className = "tdf-pins-head";
    head.textContent = "Bar order (top is first; hold and drag to move)";
    box.appendChild(head);
    shown.forEach(function (l) {
      var row = document.createElement("div");
      row.className = "tdf-order-row";
      row.setAttribute("data-key", l.key);
      row.setAttribute("tabindex", "0");
      row.appendChild(iconClone(l));
      var name = document.createElement("span");
      name.className = "tdf-order-name";
      name.textContent = l.name;
      row.appendChild(name);
      row.addEventListener("keydown", function (ev) {
        var dir = ev.key === "ArrowUp" ? -1 : ev.key === "ArrowDown" ? 1 : 0;
        if (!dir) return;
        ev.preventDefault();   // the panel does not scroll as well
        if (!movePin(l.key, dir)) saveError(box);
        fillOrderList(d);   // what was saved, not what was pressed
        // The tile keeps the focus where it lands, without the panel jumping to it.
        var moved = orderTile(box, l.key);
        if (moved) moved.focus({ preventScroll: true });
      });
      watchTile(row, d, box);
      box.appendChild(row);
    });
  }
  // A pin's tile in the order list, matched on its key as stored rather than through a
  // selector, which a key with quotes in it could break.
  function orderTile(box, key) {
    var tiles = box.querySelectorAll(".tdf-order-row"), i;
    for (i = 0; i < tiles.length; i++) if (tiles[i].getAttribute("data-key") === key) return tiles[i];
    return null;
  }
  // ---- Dragging a tile ----------------------------------------------------------------
  // As in Torn's Navigation settings (dnd-kit there): a finger held still on a tile for
  // 150ms, or a mouse moved more than 8px with its button down, lifts it. A copy then
  // follows the pointer up and down, the tile itself stays faded in the list in the place
  // it would land, and the tiles it passes slide out of its way. Letting go saves the new
  // order at once; a drag the browser cancels changes nothing.
  var HOLD_MS = 150, HOLD_SLOP = 5, MOUSE_SLOP = 8;
  var drag = null;   // the press, or the drag, on a tile of the order list
  function watchTile(row, d, box) {
    row.addEventListener("pointerdown", function (ev) { pressTile(ev, row, d, box); });
    row.addEventListener("pointermove", movePointer);
    row.addEventListener("pointerup", dropTile);
    row.addEventListener("pointercancel", cancelDrag);
    // A long press is how a tile is picked up, not a call for the browser's own menu.
    row.addEventListener("contextmenu", function (ev) { ev.preventDefault(); });
  }
  function pressTile(ev, row, d, box) {
    if (drag || ev.button !== 0) return;   // one drag at a time, and only the main mouse button
    var g = drag = { row: row, d: d, box: box, id: ev.pointerId, mouse: ev.pointerType === "mouse",
      x0: ev.clientX, y0: ev.clientY, y: ev.clientY, on: false, timer: 0, raf: 0 };
    // The tile keeps the pointer until it is let go, wherever it goes: a finger is kept
    // anyway, a mouse only when asked.
    if (row.setPointerCapture) { try { row.setPointerCapture(ev.pointerId); } catch (e) {} }
    if (!g.mouse) g.timer = setTimeout(function () { if (drag === g) liftTile(g); }, HOLD_MS);
  }
  function movePointer(ev) {
    var g = drag;
    if (!g || ev.pointerId !== g.id) return;
    g.y = ev.clientY;
    if (g.on) { placeTiles(g); keepScrolling(g); return; }
    var dx = ev.clientX - g.x0, dy = ev.clientY - g.y0, far = Math.sqrt(dx * dx + dy * dy);
    if (g.mouse) { if (far > MOUSE_SLOP) liftTile(g); }
    else if (far > HOLD_SLOP) stopDrag();   // a finger on the move before the hold is up is not holding a tile
  }
  function dropTile(ev) {
    var g = drag;
    if (!g || ev.pointerId !== g.id) return;
    if (!g.on) { stopDrag(); return; }   // a tap, or a press let go before the hold was up
    g.y = ev.clientY;
    placeTiles(g);
    if (g.to !== g.from) {
      var keys = g.keys.slice();
      keys.splice(g.to, 0, keys.splice(g.from, 1)[0]);
      if (!orderPins(keys)) saveError(g.box);
    }
    fillOrderList(g.d);   // what was saved, without the copy or the fading: no drop animation
  }
  function cancelDrag(ev) {
    var g = drag;
    if (!g || ev.pointerId !== g.id) return;
    if (g.on) fillOrderList(g.d); else stopDrag();   // every tile back as it was, nothing saved
  }
  // Lifted: the tiles are measured once, here, and the copy laid over the tile.
  function liftTile(g) {
    g.tiles = [].slice.call(g.box.querySelectorAll(".tdf-order-row"));
    g.keys = g.tiles.map(function (t) { return t.getAttribute("data-key"); });
    g.from = g.to = g.tiles.indexOf(g.row);
    g.rects = g.tiles.map(function (t) { return t.getBoundingClientRect(); });
    g.top0 = g.d.scrollTop;
    var r = g.rects[g.from], copy = g.row.cloneNode(true);
    copy.className = "tdf-order-ghost";
    copy.removeAttribute("data-key");
    copy.removeAttribute("tabindex");
    copy.setAttribute("aria-hidden", "true");
    copy.style.left = r.left + "px";
    copy.style.top = r.top + "px";
    copy.style.width = r.width + "px";
    copy.style.height = r.height + "px";
    document.body.appendChild(copy);
    g.ghost = copy;
    g.row.classList.add("tdf-order-lifted");
    g.on = true;
    placeTiles(g);
  }
  // Every tile for where the pointer is now: the copy under it, the faded tile in the
  // place whose middle is nearest the copy's, and the tiles between moved a place. The
  // panel's own scroll since the lift counts in, so the place is the one under the finger.
  function placeTiles(g) {
    var dy = g.y - g.y0, r = g.rects, from = g.from, to = 0, best = Infinity, i, off;
    var c = r[from].top + r[from].height / 2 + dy + (g.d.scrollTop - g.top0);
    for (i = 0; i < r.length; i++) {
      off = Math.abs(c - (r[i].top + r[i].height / 2));
      if (off < best) { best = off; to = i; }
    }
    g.to = to;
    g.ghost.style.transform = "translateY(" + dy + "px)";
    g.tiles.forEach(function (t, j) {
      var y = j === from ? r[to].top - r[from].top :
        from < to && j > from && j <= to ? r[j - 1].top - r[j].top :
        to < from && j >= to && j < from ? r[j + 1].top - r[j].top : 0;
      if (y) t.style.setProperty("transform", "translateY(" + y + "px)");
      else t.style.removeProperty("transform");
    });
  }
  // Dragged within 48px of the panel's top or bottom edge, the panel scrolls that way a
  // step a frame, up to 12px the nearer the edge, for as long as it can go further. Only
  // the way the finger has headed since the press: a tile lifted at an edge stays put.
  var SCROLL_EDGE = 48, SCROLL_STEP = 12;
  function scrollStep(g) {
    var r = g.d.getBoundingClientRect(), y = g.y;
    if (y > g.y0 && y > r.bottom - SCROLL_EDGE) return Math.ceil(SCROLL_STEP * Math.min(1, (y - r.bottom + SCROLL_EDGE) / SCROLL_EDGE));
    if (y < g.y0 && y < r.top + SCROLL_EDGE) return -Math.ceil(SCROLL_STEP * Math.min(1, (r.top + SCROLL_EDGE - y) / SCROLL_EDGE));
    return 0;
  }
  function keepScrolling(g) {
    if (!g.raf && scrollStep(g)) g.raf = requestAnimationFrame(function () { scrollFrame(g); });
  }
  function scrollFrame(g) {
    g.raf = 0;
    if (drag !== g) return;
    var step = scrollStep(g), before = g.d.scrollTop;
    if (!step) return;
    g.d.scrollTop = before + step;
    if (g.d.scrollTop === before) return;   // as far as it goes
    placeTiles(g);
    keepScrolling(g);
  }
  // Ends the press or the drag under way, if any: its timer, its scrolling and its copy
  // go. The tiles are put back by drawing the list afresh.
  function stopDrag() {
    var g = drag;
    if (!g) return;
    drag = null;
    clearTimeout(g.timer);
    if (g.raf) cancelAnimationFrame(g.raf);
    if (g.ghost) g.ghost.remove();
  }
  // The note goes above the list, not in it: the list scrolls, and a note at its top
  // would be out of sight after a tick further down.
  function saveError(box) {
    var prev = box.previousElementSibling;
    if (prev && prev.classList.contains("tdf-pins-err")) return;
    var err = document.createElement("div");
    err.className = "tdf-pins-err";
    err.textContent = "Could not save: this browser's storage for Torn is full.";
    box.parentNode.insertBefore(err, box);
  }
  // A fresh tick goes to the end of the list: pins show in the order they were ticked.
  function setPinned(key, on) {
    var pins = loadPins().filter(function (k) { return k !== key; });
    if (on) pins.push(key);
    savePins(pins);
    renderPins();
  }
  // The pins named in keys, put in that order in the places those same pins take in the
  // saved list, so a remembered pin that is not in the menu keeps its place. False if the
  // new order could not be saved.
  function orderPins(keys) {
    var pins = loadPins(), slots = [];
    keys = keys.filter(function (k) { return pins.indexOf(k) !== -1; });
    keys.forEach(function (k) { slots.push(pins.indexOf(k)); });
    slots.sort(function (a, b) { return a - b; });
    keys.forEach(function (k, i) { pins[slots[i]] = k; });
    var ok = savePins(pins);
    renderPins();
    return ok;
  }
  // One press of an arrow key: the pin moves one place on the bar as the menu has it now
  // (dir -1 towards the front, 1 towards the end), over any remembered pin that is not in
  // the menu. Already first or last, or no longer in the menu: nothing to save.
  function movePin(key, dir) {
    var bar = pinnedInMenu(loadPins(), menuLinks()).map(function (l) { return l.key; });
    var at = bar.indexOf(key), to = at + dir;
    if (at === -1 || to < 0 || to >= bar.length) return true;
    bar.splice(at, 1);
    bar.splice(to, 0, key);
    return orderPins(bar);
  }
  var COG_SVG = '<svg viewBox="0 0 24 24" width="20" height="20"><path fill="#8a8f98" d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.63-.07-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.49.49 0 0 0-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54A.49.49 0 0 0 14 2h-4a.49.49 0 0 0-.49.42l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96a.49.49 0 0 0-.59.22L2.13 8.48a.49.49 0 0 0 .12.61l2.03 1.58c-.05.31-.07.62-.07.94 0 .32.02.63.07.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.14.24.44.32.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.26.42.49.42h4c.23 0 .44-.18.49-.42l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.15.06.45-.02.59-.22l1.92-3.32a.49.49 0 0 0-.12-.61l-2.02-1.58zM12 15.6a3.6 3.6 0 1 1 0-7.2 3.6 3.6 0 0 1 0 7.2z"/></svg>';
  function positionCog(cog, b) {
    cog.style.top = b.offsetTop + "px";
    cog.style.left = (b.offsetLeft + b.offsetWidth + 4) + "px";
    cog.style.width = b.offsetWidth + "px";
    cog.style.height = b.offsetHeight + "px";
  }
  function ensureCog() {
    var b = menuButton();
    if (!b || !b.parentElement || !mobileActive()) return;
    // Lives in the header beside the hamburger so it rides along with it; high z-index +
    // pointer-events keep the tap landing on it. Re-anchor if React re-rendered the header.
    var cog = document.getElementById("tdf-cog");
    if (!cog) {
      cog = document.createElement("button");
      cog.id = "tdf-cog";
      cog.type = "button";
      cog.setAttribute("aria-label", "Torn Dual Flyout settings");
      cog.innerHTML = COG_SVG;
      cog.addEventListener("click", function (ev) { ev.preventDefault(); ev.stopPropagation(); toggleSettings(); });
      b.parentElement.appendChild(cog);
    } else if (cog.parentElement !== b.parentElement) {
      b.parentElement.appendChild(cog);
    }
    positionCog(cog, b);
  }
  // ---- Pinned links ------------------------------------------------------------
  // A row of the menu links the player ticked in the cog panel, drawn under Torn's
  // phone header so favourites are one tap away without opening the menu. The menu
  // itself is left exactly as Torn draws it. Each pin is a plain link to the same
  // address as its menu row: tapping one is an ordinary navigation, nothing is
  // clicked on the player's behalf.
  var PINS_KEY = "tdf_pins";   // JSON array of pin keys, in the order they were ticked
  // Anything that is not a list of strings (damaged, or written by something else)
  // counts as nothing pinned; a key stored twice counts once.
  function loadPins() {
    try {
      var v = JSON.parse(localStorage.getItem(PINS_KEY) || "[]");
      if (!Array.isArray(v)) return [];
      return v.filter(function (k, i) { return typeof k === "string" && k !== "" && v.indexOf(k) === i; });
    } catch (e) { return []; }
  }
  function savePins(list) { try { localStorage.setItem(PINS_KEY, JSON.stringify(list)); return true; } catch (e) { return false; } }
  // The pinned links the menu has, in pin order. A pin whose link has left the menu
  // stays remembered, just not drawn.
  function pinnedInMenu(keys, links) {
    var byKey = Object.create(null), shown = [];
    links.forEach(function (l) { byKey[l.key] = l; });
    keys.forEach(function (k) { if (byKey[k]) shown.push(byKey[k]); });
    return shown;
  }
  // A pin is remembered by its link with any scheme and host taken off, so a page
  // matches whether Torn writes its address absolute or relative.
  function pinKey(href) { return String(href || "").replace(/^[a-z][a-z0-9+.-]*:\/\/[^\/]*/i, ""); }

  // Every top-level link in Torn's menu, top to bottom: the Messages / Events / Awards
  // icons, then each area and list row. The people a list row expands to show sit
  // outside the row's own link, so they are not picked up.
  var MENU_LINK_SEL = '[class*="accountLinks___"] a[href], [id^="nav-"] > [class*="areaRow___"] > a[href]';
  // Torn's mark for the page the player is on, matched from the start of a class so one
  // that merely ends in it is not taken for it.
  function isActive(el) { return !!el && /(^|\s)active___/.test(el.className); }
  function menuLinks() {
    var p = panel(), out = [], seen = Object.create(null), i;
    if (!p) return out;
    var links = p.querySelectorAll(MENU_LINK_SEL);
    for (i = 0; i < links.length; i++) {
      var a = links[i], href = a.getAttribute("href"), key = pinKey(href);
      if (!key || seen[key]) continue;
      seen[key] = true;
      // Area and list rows carry their name in a span; the account icons only in
      // their aria-label ("Events, 4 new").
      var nameEl = a.querySelector('[class*="linkName___"]');
      var name = (nameEl ? nameEl.textContent : (a.getAttribute("aria-label") || "")).replace(/,\s*[\d,+]+\s+new\s*$/i, "").trim();
      // An unread or waiting count. Class matching is case-sensitive: a list row's
      // member count is listAmount___, left out on purpose (a list size is not news).
      var countEl = a.querySelector('[class*="amount___"]');
      var row = a.closest('[id^="nav-"]');
      // The page the player is on: Torn marks an area or list row active___, and for
      // the Messages / Events / Awards icons the wrapper round the icon's link.
      var on = isActive(a) || isActive(row) || isActive(a.parentNode);
      out.push({
        key: key, href: href, name: name || key,
        navId: row ? row.id.slice(4) : "",   // "gym" for #nav-gym
        count: countEl ? countEl.textContent.trim() : "",
        attn: !!row && /attention___/.test(row.className),   // Torn's blue "something here" tint
        acct: !!a.closest('[class*="accountLinks___"]'),     // Messages, Events or Awards
        on: on,
        // Unread Messages, Events or Awards: Torn marks the icon's link positive___, and
        // its top bar shows them green, except on that link's own page, which shows as
        // the page you are on. Area rows have counts too, but are never green.
        avail: !on && /(^|\s)positive___/.test(a.className),
        svg: a.querySelector("svg")
      });
    }
    return out;
  }
  // Torn's own short names for its phone top bar, by menu id, as that bar printed them
  // on the owner's phone (2026-10-21). Torn's own copy, when the page has it, comes
  // first (tornShortNames); a link in neither keeps its menu name.
  var SHORT_NAMES = {
    messages: "Messages", events: "Events", awards: "Awards", faction_armory: "Armory", faction_controls: "Controls",
    home: "home", items: "Items", gym: "Gym", property_vault: "Vault", crimes: "Crimes", city: "City", job: "job",
    education: "edu", faction: "faction", missions: "Missions", newspaper: "News", jail: "Jail", hospital: "Hospital",
    casino: "Casino", hall_of_fame: "HOF", forums: "Forums", properties: "property", calendar: "calendar",
    enemies_list: "Enemies", friends_list: "Friends", targets_list: "Targets", poker: "Poker"
  };
  // Torn keeps its sidebar data for the tab in sessionStorage ("sidebarData" plus the
  // player id), short names included. Parsed again only when Torn has rewritten it.
  var shortRaw = null, shortTorn = Object.create(null);
  function tornShortNames() {
    var raw = null, m, i, k;
    try {
      m = /(?:^|;\s*)uid=(\d+)/.exec(document.cookie || "");
      if (m) raw = sessionStorage.getItem("sidebarData" + m[1]);
      for (i = 0; !raw && i < sessionStorage.length; i++) {
        k = sessionStorage.key(i);
        if (/^sidebarData\d*$/.test(k)) raw = sessionStorage.getItem(k);
      }
    } catch (e) { raw = null; }
    if (raw === shortRaw) return shortTorn;
    shortRaw = raw;
    shortTorn = Object.create(null);
    try {
      var d = raw ? JSON.parse(raw) : null;
      // Only the shape Torn writes counts: groups of entries by id, each with a short
      // name in text. Anything else falls back to the built-in names.
      ["areas", "lists", "account"].forEach(function (g) {
        var grp = d && d[g];
        if (!grp || typeof grp !== "object" || Array.isArray(grp)) return;
        Object.keys(grp).forEach(function (key) {
          var v = grp[key];
          if (v && typeof v.shortName === "string" && v.shortName.trim()) shortTorn[key] = v.shortName.trim();
        });
      });
    } catch (e) {}
    return shortTorn;
  }
  // The name under a pin: Torn's short name (its data keys lists without the "_list"
  // the menu ids carry), then the built-in list, then the menu's own name.
  function shortName(link) {
    var t = tornShortNames(), id = link.navId;
    return (id && (t[id] || t[id.replace(/_list$/, "")] || SHORT_NAMES[id])) || link.name;
  }
  // Torn tints its top bar while the player is in jail, in hospital or travelling. The
  // menu says which: the panel's inJail___ / inHospital___ classes, travel___ icons.
  function userStatus() {
    var p = panel();
    if (!p) return "";
    if (/inJail___/.test(p.className)) return "jail";
    if (/inHospital___/.test(p.className)) return "hospital";
    if (p.querySelector('[class*="defaultIcon___"][class*="travel___"]')) return "travel";
    return "";
  }
  // Torn's top-bar gradients, copied stop for stop from its sidebar-old build. Ours, not
  // Torn's: the menu build defines only some of them, and only while it is drawn.
  var GRADIENTS = [["regular", "#888888", "#666666"], ["regular-on", "#DDDDDD", "#AAAAAA"], ["blue", "#74C0FC", "#1C7ED6"],
    ["blue-on", "#E7F5FF", "#74C0FC"], ["jail", "#BDBCAF", "#8A8973"], ["hospital", "#DDDDDD", "#AAAAAA"],
    ["travel", "#8FA6BC", "#5F7F9F"], ["white", "#FFFFFF", "#FFFFFF"], ["green", "#AFC372", "#798D3C"],
    ["hospital-green", "#C9DD8C", "#9BBD36"]];
  function ensureDefs() {
    if (document.getElementById("tdf-pins-defs") || !document.body) return;
    var d = document.createElement("div");
    d.id = "tdf-pins-defs";
    d.setAttribute("aria-hidden", "true");
    // Out of sight but not display:none, which would stop the gradients painting.
    d.setAttribute("style", "position:absolute;width:0;height:0;overflow:hidden;");
    d.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="0" height="0"><defs>' + GRADIENTS.map(function (g) {
      return '<linearGradient id="tdf-g-' + g[0] + '" gradientUnits="objectBoundingBox" gradientTransform="rotate(90)">' +
        '<stop offset="0" stop-color="' + g[1] + '"></stop><stop offset="1" stop-color="' + g[2] + '"></stop></linearGradient>';
    }).join("") + "</defs></svg>";
    document.body.appendChild(d);
  }
  // A copy of a menu link's icon. Torn colours its icons with rules that only reach
  // inside the menu, so the copy is coloured by this script's own rules (above), which
  // follow Torn's top bar.
  function iconClone(link) {
    var wrap = document.createElement("span");
    wrap.className = "tdf-pin-icon";
    if (!link.svg) return wrap;
    var glyph = document.createElement("span"), c = link.svg.cloneNode(true), ids, j;
    glyph.className = "tdf-pin-glyph";
    // The original stays in the menu, so any id the copy carried would be a duplicate;
    // references inside the icon still find the original's.
    c.removeAttribute("id");
    ids = c.querySelectorAll("[id]");
    for (j = 0; j < ids.length; j++) ids[j].removeAttribute("id");
    glyph.appendChild(c);
    wrap.appendChild(glyph);
    return wrap;
  }
  // One pin, nested the way Torn nests a top-bar link: a 40px row holding the count and
  // the link itself, which holds the icon and the short name. status is the player's
  // ("jail", "hospital", "travel" or ""), which tints the pin as it tints Torn's bar.
  function pinEl(link, label, status) {
    var a = document.createElement("a");
    a.className = "tdf-pin" + (link.attn ? " tdf-pin-attn" : "") + (link.on ? " tdf-pin-on" : "") + (link.avail ? " tdf-pin-avail" : "") +
      (status ? " tdf-pin-" + status : "") + (link.svg ? "" : " tdf-pin-noicon");
    a.setAttribute("href", link.href);
    // Read out the way Torn's own link reads, full name and all: "Events, 4 new".
    a.setAttribute("aria-label", link.count ? link.name + ", " + link.count + " new" : link.name);
    var row = document.createElement("span");
    row.className = "tdf-pin-row";
    if (link.count) {
      var badge = document.createElement("span");
      badge.className = "tdf-pin-badge";
      badge.textContent = link.count;
      row.appendChild(badge);
    }
    var inner = document.createElement("span");
    inner.className = "tdf-pin-link";
    inner.appendChild(iconClone(link));
    var name = document.createElement("span");
    name.className = "tdf-pin-name";
    name.textContent = label;
    inner.appendChild(name);
    row.appendChild(inner);
    a.appendChild(row);
    return a;
  }
  // How many links Torn's top bar fits on a line: its own table, keyed by the screen's
  // width (the first width at or above it), and 20 on anything wider.
  var PER_LINE = [[358, 8], [400, 9], [450, 10], [500, 11], [550, 12], [595, 13], [640, 14], [690, 15], [730, 16], [770, 17],
    [810, 18], [850, 19]];
  function perLine() {
    var w = window.innerWidth || document.documentElement.clientWidth, i;
    for (i = 0; i < PER_LINE.length; i++) if (w <= PER_LINE[i][0]) return PER_LINE[i][1];
    return 20;
  }
  // Torn re-draws the menu as counts change: follow it within a beat, one re-draw per
  // burst of changes. The row lives outside the panel, so drawing it never feeds back here.
  var pinsTimer = null;
  function schedulePins() {
    if (pinsTimer) return;
    pinsTimer = setTimeout(function () { pinsTimer = null; renderPins(); }, 60);
  }
  function startPinsObserver() {
    var p = panel();
    if (!p || p.__tdfPinsObs) return;
    p.__tdfPinsObs = true;
    new MutationObserver(schedulePins).observe(p, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ["class", "aria-label"] });
  }
  // Measured, not assumed. TornTools pads the page content for its own phone links,
  // which suggests the content does not move down for anything added up here. If it
  // does not, a spacer at the top of the content makes up the difference, never more
  // than the row's own height; if it does, the measured overlap is 0 and no spacer is
  // added. The spacer is a height, not a margin, so it cannot collapse through its
  // parent and move the content's own top, which is what is measured.
  var spacerH = 0;   // the room the row needs, as last measured
  function syncSpacer(row) {
    var content = document.querySelector('.content-wrapper[role="main"]');
    var sb = document.getElementById("sidebar");
    if (!row || !content || !sb) spacerH = 0;
    // Torn's header and sidebar scroll with the page (its menu only fixes itself to the
    // screen once the header has scrolled off), so the gap reads the same at any scroll.
    else if (typeof sb.getBoundingClientRect === "function" && typeof content.getBoundingClientRect === "function") {
      var need = Math.min(row.offsetHeight || 0, sb.getBoundingClientRect().bottom - content.getBoundingClientRect().top);
      spacerH = need >= 1 ? Math.round(need) : 0;
    }
    var sp = document.getElementById("tdf-pins-spacer");
    if (!spacerH) { if (sp) sp.remove(); return; }
    if (!sp) { sp = document.createElement("div"); sp.id = "tdf-pins-spacer"; }
    if (content.firstChild !== sp) content.insertBefore(sp, content.firstChild);   // Torn may wipe the content
    var h = "height:" + spacerH + "px";
    if (sp.getAttribute("style") !== h) sp.setAttribute("style", h);
  }
  // ---- Pinned links leave the menu ----------------------------------------------
  // A link the row is showing is hidden in the menu, so each link lives in one place:
  // its row, its icon among Messages / Events / Awards, and that icon bar itself once
  // every icon in it is pinned. Only while the row shows them: with no row the menu
  // keeps everything. A stylesheet rather than touching Torn's elements, so it is in
  // place before Torn draws the menu (no flash of pinned links) and its re-renders
  // cannot undo it.
  var HIDE_ID = "tdf-pins-hide";
  // A value as a CSS string. Quotes, backslashes, braces and control characters are
  // escaped, so no stored value can end the string or the rule early.
  function cssStr(v) {
    return '"' + String(v).replace(/["\\{}\x00-\x1f\x7f]/g, function (c) { return "\\" + c.charCodeAt(0).toString(16) + " "; }) + '"';
  }
  // The link to key k, written relative ("/gym.php") or absolute (".../torn.com/gym.php").
  function linkTo(k, pre) { return pre + "a[href=" + cssStr(k) + "]," + pre + "a[href$=" + cssStr("torn.com" + k) + "]"; }
  function hideCss(keys) {
    if (!keys.length) return "";
    var P = "html #fly-out-panel ", rules = [], pinned = [], others = "";
    keys.forEach(function (k) {
      rules.push(P + '[id^="nav-"]:has(' + linkTo(k, '> [class*="areaRow___"] > ') + ")");
      rules.push(P + '[class*="accountLinks___"] > :has(' + linkTo(k, "> ") + ")");
      pinned.push(linkTo(k, ""));
      others += ":not([href=" + cssStr(k) + "]):not([href$=" + cssStr("torn.com" + k) + "])";
    });
    // The icon bar: it holds a pinned link and no link that isn't pinned. Weighty
    // enough to beat Icons only's display:block on the same bar.
    rules.push(P + '[class*="accountLinksWrap___"]:has(' + pinned.join(",") + "):not(:has(a[href]" + others + "))");
    return rules.map(function (r) { return r + "{display:none!important;}"; }).join("");
  }
  function setHidden(keys) {
    var css = hideCss(keys), s = document.getElementById(HIDE_ID);
    if (!css) { if (s) s.remove(); return; }
    if (!s) {
      s = document.createElement("style");
      s.id = HIDE_ID;
      (document.head || document.documentElement).appendChild(s);
    }
    if (s.textContent !== css) s.textContent = css;
  }
  // ---- The three-bar button --------------------------------------------------------
  // Torn's menu button counts every unread Message, Event and Award, and is green while
  // there are any. One that is pinned is read in the row, not behind the button, so while
  // the row shows a pinned Messages / Events / Awards the button counts only the ones
  // still in the menu, and is green only while that is more than 0. With none of them in
  // the row the button is Torn's, handed back as Torn drew it.
  // A count as the menu writes it: "4", or "1.2k" from a thousand up, past Torn's 99.
  function countOf(text) { return /k$/i.test(text) ? 1000 : parseInt(text, 10) || 0; }
  function syncMenuButton(links, shown) {
    var btn = menuButton();
    if (!btn) return;
    var pinned = (shown || []).filter(function (l) { return l.acct; });
    if (!pinned.length) {
      if (!btn.hasAttribute("data-tdf-count")) return;   // not changed, or already handed back
      btn.removeAttribute("data-tdf-count");
      btn.style.removeProperty("--tdf-count");
      if (!btn.getAttribute("style")) btn.removeAttribute("style");
      // Torn's green comes and goes with its number.
      if (btn.querySelector('[class*="notificationsAmount___"]') && !btn.classList.contains("green")) btn.classList.add("green");
      return;
    }
    var n = 0;
    links.forEach(function (l) { if (l.acct && pinned.indexOf(l) < 0) n += countOf(l.count); });
    n = Math.min(n, 99);
    if (btn.getAttribute("data-tdf-count") !== String(n)) btn.setAttribute("data-tdf-count", String(n));
    // The number as a CSS string, which is what the stylesheet draws; none for 0.
    var css = n ? '"' + n + '"' : "";
    if (btn.style.getPropertyValue("--tdf-count") !== css) {
      if (css) btn.style.setProperty("--tdf-count", css);
      else btn.style.removeProperty("--tdf-count");
    }
    if (btn.classList.contains("green") !== n > 0) btn.classList.toggle("green", n > 0);
    // Torn's React puts its green back when a new one comes in after none, and rewrites its
    // number when a count changes: put the button right before the page is painted, not a
    // tick later. Writes only what differs, so its own writes come back to it once and stop.
    if (!btn.__tdfBtnObs) {
      btn.__tdfBtnObs = true;
      new MutationObserver(function () { renderPins(); }).observe(btn, { attributes: true, attributeFilter: ["class"], childList: true, subtree: true, characterData: true });
    }
  }
  function dropRow(row) { if (row) row.remove(); syncSpacer(null); syncMenuButton(null, null); }
  // Draw (or re-draw) the row directly above Torn's name/bars strip, the first thing
  // under the header on a phone. No strip means this is not the phone layout: no row.
  function renderPins() {
    var row = document.getElementById("tdf-pins");
    var keys = loadPins();
    // Nothing pinned: nothing to draw, hide or measure, so the menu is not even read.
    if (!keys.length) { dropRow(row); setHidden([]); return; }
    var links = menuLinks();
    // Torn has not drawn the menu's links yet (the page is still loading): keep the
    // pinned ones hidden, ready for when it does, so they never flash up in it.
    if (!links.length) { dropRow(row); setHidden(keys); return; }
    var strip = document.querySelector('#sidebar [class*="userInformationMobile___"]');
    var shown = pinnedInMenu(keys, links);
    // No strip means this is not the phone layout: no row, and then the menu keeps
    // every link, so a pinned link is never missing from both places.
    if (!strip || !shown.length) { dropRow(row); setHidden([]); return; }
    if (!row) {
      row = document.createElement("nav");
      row.id = "tdf-pins";
      row.setAttribute("aria-label", "Pinned links");
    }
    if (row.parentNode !== strip.parentNode || row.nextSibling !== strip) strip.parentNode.insertBefore(row, strip);
    // Read on every draw, so a turn of the phone is followed within a tick.
    var cols = String(perLine());
    if (row.style.getPropertyValue("--tdf-cols") !== cols) row.style.setProperty("--tdf-cols", cols);
    ensureDefs();
    var status = userStatus(), labels = shown.map(shortName);
    // Rebuild only when something a pin shows has changed, so the 800ms tick never
    // swaps a pin out from under a finger mid-tap.
    var sig = JSON.stringify([status].concat(shown.map(function (l, i) { return [l.key, labels[i], l.name, l.count, l.attn, l.on, l.avail, !!l.svg]; })));
    if (row.__tdfSig !== sig) {
      row.__tdfSig = sig;
      row.className = status ? "tdf-pins-" + status : "";
      row.textContent = "";
      shown.forEach(function (l, i) { row.appendChild(pinEl(l, labels[i], status)); });
    }
    setHidden(shown.map(function (l) { return l.key; }));
    syncSpacer(row);
    syncMenuButton(links, shown);
  }

  // ---- Torn drawing its header and sidebar --------------------------------------------
  // What the 800ms tick keeps in step with Torn's page.
  function syncAll() { ensureCog(); startMenuObserver(); syncMenuOpen(); startPinsObserver(); renderPins(); }
  // Torn's sidebar app draws the menu button into the header's #header-wrapper-top and
  // #sidebar into #sidebarroot, in one go. Watching those two for new children does what
  // the tick does in that same moment, before the page is painted, not up to 800ms later:
  // Torn's own count on the button never shows, and the row comes in with Torn's header.
  // Only their own children: Torn's frequent changes further down (bars, timers) are not
  // heard here.
  function watchMount() {
    ["header-wrapper-top", "sidebarroot"].forEach(function (id) {
      var el = document.getElementById(id);
      if (!el || el.__tdfMountObs) return;
      el.__tdfMountObs = true;
      new MutationObserver(syncAll).observe(el, { childList: true });
    });
  }
  // At document-start neither is there yet: #sidebarroot comes with Torn's page source,
  // but #header-wrapper-top is drawn by Torn's header app. Until both are, the whole page
  // is watched for them, and then only they are.
  function mounted() { return !!(document.getElementById("header-wrapper-top") && document.getElementById("sidebarroot")); }
  if (!mounted()) {
    var early = new MutationObserver(function () {
      watchMount();
      if (!mounted()) return;
      early.disconnect();
      // Put things right at once, in case Torn drew its sidebar in this same moment,
      // which those two observers came too late to hear.
      syncAll();
    });
    early.observe(html, { childList: true, subtree: true });
    // A page Torn draws without them: the tick takes over a few seconds after the page
    // has loaded. Not at load itself, as Torn's header app can draw its part after that;
    // and counted from now when the script starts on a page that has already loaded.
    var stopEarly = function () { setTimeout(function () { early.disconnect(); }, 10000); };
    if (document.readyState === "complete") stopEarly();
    else window.addEventListener("load", stopEarly);
  }

  // Torn may draw either of the two afresh: the tick watches the new one.
  setInterval(function () { watchMount(); syncAll(); }, 800);
  watchMount();
  ensureCog();
  startMenuObserver();
  startPinsObserver();
  renderPins();
  maybeReopen();                                   // sticky? re-open the menu on this full page load

  // SPA route changes (Torn uses in-section hash routing) don't reload the script, so
  // re-sync the open/closed state AND (in sticky mode) re-open the menu.
  window.addEventListener("hashchange", function () { syncMenuOpen(); maybeReopen(); });
  window.addEventListener("popstate", function () { syncMenuOpen(); maybeReopen(); });

  document.addEventListener("touchstart", onStart, { passive: true, capture: true });
  document.addEventListener("touchmove", onMove, { passive: true, capture: true });
  document.addEventListener("touchend", onEnd, { passive: true, capture: true });
  document.addEventListener("touchcancel", onEnd, { passive: true, capture: true });
})();