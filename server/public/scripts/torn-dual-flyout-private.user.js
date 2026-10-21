// ==UserScript==
// @name         Torn Dual Flyout Private
// @namespace    RussianRob.torn-dual-flyout.private
// @version      1.6.0
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
  window.__tdfVer = "1.6.0";   // runtime version marker (confirm the installed build)

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
    // Pinned links: a row under Torn's phone header. It wraps onto another line rather
    // than ever scrolling sideways (sliding strips are what the player found finicky),
    // and takes Torn's own panel colours so it suits light and dark mode alike.
    '#tdf-pins{display:flex;flex-wrap:wrap;justify-content:center;gap:2px 4px;box-sizing:border-box;width:100%;padding:3px 4px;' +
    'background:var(--default-bg-panel-color,#333);color:var(--default-color,#ddd);border-bottom:1px solid rgba(0,0,0,.35);}' +
    '#tdf-pins .tdf-pin{position:relative;display:flex;flex-direction:column;align-items:center;justify-content:center;box-sizing:border-box;' +
    'min-width:44px;min-height:32px;padding:2px 4px;border-radius:4px;color:inherit;text-decoration:none;' +
    '-webkit-touch-callout:none;-webkit-tap-highlight-color:transparent;}' +
    '#tdf-pins .tdf-pin-attn{background:rgba(34,139,230,.18);}' +
    '.tdf-pin-icon{display:inline-flex;align-items:center;justify-content:center;width:34px;height:23px;line-height:0;}' +
    '.tdf-pin-icon svg{max-width:100%;max-height:100%;}' +
    '#tdf-pins .tdf-pin-name{font:10px/12px Arial,Helvetica,sans-serif;max-width:68px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}' +
    '#tdf-pins .tdf-pin-badge{position:absolute;top:0;right:1px;font:700 10px/12px Arial,Helvetica,sans-serif;color:#a9e34b;text-shadow:0 1px rgba(0,0,0,.25);}' +
    'html.tdf-iconsonly #tdf-pins .tdf-pin-name{display:none;}';
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
    d.innerHTML = '<h4>Torn Dual Flyout Private <span class="tdf-x">×</span></h4>' +
      '<label><input type="checkbox" class="tdf-iconsonly-cb"' + (iconsOnly() ? " checked" : "") + "> Icons only (hide menu names)</label>" +
      '<label><input type="checkbox" class="tdf-sticky-cb"' + (sticky() ? " checked" : "") + "> Sticky (keep menu open across pages + scroll while open)</label>";
    (document.body || html).appendChild(d);
    d.querySelector(".tdf-x").addEventListener("click", function () { d.classList.add("tdf-hidden"); });
    d.querySelector(".tdf-iconsonly-cb").addEventListener("change", function (ev) { applyIconsOnly(ev.target.checked); });
    d.querySelector(".tdf-sticky-cb").addEventListener("change", function (ev) { applySticky(ev.target.checked); if (ev.target.checked && !isOpen()) { html.classList.add("tdf-preopen"); reopenSoon(); } });
  }
  function toggleSettings() {
    buildSettings();
    var d = document.getElementById("tdf-settings");
    if (d) d.classList.toggle("tdf-hidden");
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
  function savePins(list) { try { localStorage.setItem(PINS_KEY, JSON.stringify(list)); } catch (e) {} }
  // A pin is remembered by its link with any scheme and host taken off, so a page
  // matches whether Torn writes its address absolute or relative.
  function pinKey(href) { return String(href || "").replace(/^[a-z][a-z0-9+.-]*:\/\/[^\/]*/i, ""); }

  // Every top-level link in Torn's menu, top to bottom: the Messages / Events / Awards
  // icons, then each area and list row. The people a list row expands to show sit
  // outside the row's own link, so they are not picked up.
  var MENU_LINK_SEL = '[class*="accountLinks___"] a[href], [id^="nav-"] > [class*="areaRow___"] > a[href]';
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
      out.push({
        key: key, href: href, name: name || key,
        count: countEl ? countEl.textContent.trim() : "",
        attn: !!row && /attention___/.test(row.className),   // Torn's blue "something here" tint
        svg: a.querySelector("svg")
      });
    }
    return out;
  }
  // Keep only the #fragment of a url() paint. WebKit can report it resolved against the
  // page address, and written back inline a full address stops pointing at this page's
  // gradient once the address changes (or under a <base> tag). The gradients Torn's
  // icons use are defined once in this same page.
  function localUrl(v) { return String(v || "").replace(/url\(\s*["']?[^"'()#]*(#[^"'()]+)["']?\s*\)/g, 'url("$1")'); }
  // Torn colours its icons with rules that only reach inside the menu (a gradient fill
  // and a drop shadow), so a copy anywhere else would come out flat and black: carry
  // both across inline. Read once per redraw, and only for links being drawn.
  function paintOf(link) {
    if (!link.paint) {
      link.paint = { fill: "", filter: "" };
      try {
        var cs = link.svg ? getComputedStyle(link.svg) : null;
        if (cs) {
          link.paint.fill = localUrl(cs.fill);
          link.paint.filter = cs.filter && cs.filter !== "none" ? cs.filter : "";
        }
      } catch (e) {}
    }
    return link.paint;
  }
  function iconClone(link) {
    var wrap = document.createElement("span");
    wrap.className = "tdf-pin-icon";
    if (!link.svg) return wrap;
    var c = link.svg.cloneNode(true), p = paintOf(link), style = "", ids, j;
    // The original stays in the menu, so any id the copy carried would be a duplicate;
    // references inside the icon still find the original's.
    c.removeAttribute("id");
    ids = c.querySelectorAll("[id]");
    for (j = 0; j < ids.length; j++) ids[j].removeAttribute("id");
    if (p.fill) style += "fill:" + p.fill + ";";
    if (p.filter) style += "filter:" + p.filter + ";";
    if (style) c.setAttribute("style", style + (c.getAttribute("style") || ""));
    wrap.appendChild(c);
    return wrap;
  }
  function pinEl(link) {
    var a = document.createElement("a");
    a.className = "tdf-pin" + (link.attn ? " tdf-pin-attn" : "");
    a.setAttribute("href", link.href);
    a.setAttribute("aria-label", link.count ? link.name + ", " + link.count : link.name);
    a.appendChild(iconClone(link));
    var name = document.createElement("span");
    name.className = "tdf-pin-name";
    name.textContent = link.name;
    a.appendChild(name);
    if (link.count) {
      var badge = document.createElement("span");
      badge.className = "tdf-pin-badge";
      badge.textContent = link.count;
      a.appendChild(badge);
    }
    return a;
  }
  // Draw (or re-draw) the row directly above Torn's name/bars strip, the first thing
  // under the header on a phone. No strip means this is not the phone layout: no row.
  function renderPins() {
    var row = document.getElementById("tdf-pins");
    var strip = document.querySelector('#sidebar [class*="userInformationMobile___"]');
    var byKey = Object.create(null), shown = [];
    menuLinks().forEach(function (l) { byKey[l.key] = l; });
    // A pin whose link has left the menu stays remembered, just not drawn.
    loadPins().forEach(function (k) { if (byKey[k]) shown.push(byKey[k]); });
    if (!strip || !shown.length) {
      if (row) row.remove();
      return;
    }
    if (!row) {
      row = document.createElement("nav");
      row.id = "tdf-pins";
      row.setAttribute("aria-label", "Pinned links");
    }
    if (row.parentNode !== strip.parentNode || row.nextSibling !== strip) strip.parentNode.insertBefore(row, strip);
    // Rebuild only when something a pin shows has changed, so the 800ms tick never
    // swaps a pin out from under a finger mid-tap.
    var sig = JSON.stringify(shown.map(function (l) { var p = paintOf(l); return [l.key, l.name, l.count, l.attn, p.fill, p.filter]; }));
    if (row.__tdfSig !== sig) {
      row.__tdfSig = sig;
      row.textContent = "";
      shown.forEach(function (l) { row.appendChild(pinEl(l)); });
    }
  }

  setInterval(function () { ensureCog(); startMenuObserver(); syncMenuOpen(); renderPins(); }, 800);
  ensureCog();
  startMenuObserver();
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