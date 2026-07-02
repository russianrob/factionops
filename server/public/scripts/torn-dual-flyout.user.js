// ==UserScript==
// @name         Torn Dual Flyout
// @namespace    RussianRob
// @version      1.5.7
// @description  Two-way swipe for Torn's mobile fly-out menu: swipe left opens it on the right, swipe right opens it on the left, with a side arrow on the menu button.
// @author       RussianRob
// @downloadURL  https://tornwar.com/scripts/torn-dual-flyout.user.js
// @updateURL    https://tornwar.com/scripts/torn-dual-flyout.user.js
// @license      GPL-3.0-or-later
// @match        https://www.torn.com/*
// @run-at       document-start
// @grant        none
// ==/UserScript==
(function () {
  "use strict";
  if (window.__tornMenuRight) return;
  window.__tornMenuRight = true;

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
    '#fly-out-menu-button::after{content:"◀";position:absolute;bottom:0;left:50%;transform:translateX(-50%);' +
    'font-size:11px;line-height:1;font-weight:700;background:linear-gradient(to top,#666,#888);' +
    '-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;color:transparent;pointer-events:none;}' +
    'html.tmr-right #fly-out-menu-button::after{content:"▶";}' +
    '#tdf-cog{position:absolute;background:transparent;border:0;padding:0;margin:0;cursor:pointer;display:flex;align-items:center;justify-content:center;z-index:100000;-webkit-tap-highlight-color:transparent;}' +
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
    'html.tdf-sticky.tdf-menu-open body{overflow:visible!important;}';
  var s = document.createElement("style");
  s.id = "torn-menu-right";
  s.textContent = css;
  (document.head || document.documentElement).appendChild(s);

  var OPEN_DIST = 70;
  var CLOSE_DIST = 60;
  var HORIZ_RATIO = 2.0;
  var SYS_EDGE = 24;

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

  function sticky() { try { return localStorage.getItem("tdf_sticky") === "1"; } catch (e) { return false; } }
  function applySticky(on) { html.classList.toggle("tdf-sticky", !!on); try { localStorage.setItem("tdf_sticky", on ? "1" : "0"); } catch (e) {} }
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
    d.innerHTML = '<h4>Torn Dual Flyout <span class="tdf-x">×</span></h4>' +
      '<label><input type="checkbox" class="tdf-iconsonly-cb"' + (iconsOnly() ? " checked" : "") + "> Icons only (hide menu names)</label>" +
      '<label><input type="checkbox" class="tdf-sticky-cb"' + (sticky() ? " checked" : "") + "> Sticky (scroll page while menu open)</label>";
    (document.body || html).appendChild(d);
    d.querySelector(".tdf-x").addEventListener("click", function () { d.classList.add("tdf-hidden"); });
    d.querySelector(".tdf-iconsonly-cb").addEventListener("change", function (ev) { applyIconsOnly(ev.target.checked); });
    d.querySelector(".tdf-sticky-cb").addEventListener("change", function (ev) { applySticky(ev.target.checked); });
  }
  function toggleSettings() {
    buildSettings();
    var d = document.getElementById("tdf-settings");
    if (d) d.classList.toggle("tdf-hidden");
  }
  var COG_SVG = '<svg viewBox="0 0 24 24" width="20" height="20"><path fill="#8a8f98" d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.63-.07-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.49.49 0 0 0-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54A.49.49 0 0 0 14 2h-4a.49.49 0 0 0-.49.42l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96a.49.49 0 0 0-.59.22L2.13 8.48a.49.49 0 0 0 .12.61l2.03 1.58c-.05.31-.07.62-.07.94 0 .32.02.63.07.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.14.24.44.32.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.26.42.49.42h4c.23 0 .44-.18.49-.42l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.15.06.45-.02.59-.22l1.92-3.32a.49.49 0 0 0-.12-.61l-2.02-1.58zM12 15.6a3.6 3.6 0 1 1 0-7.2 3.6 3.6 0 0 1 0 7.2z"/></svg>';
  function ensureCog() {
    if (document.getElementById("tdf-cog")) return;
    var b = menuButton();
    if (!b || !b.parentElement || !mobileActive()) return;
    var cog = document.createElement("button");
    cog.id = "tdf-cog";
    cog.type = "button";
    cog.setAttribute("aria-label", "Torn Dual Flyout settings");
    cog.innerHTML = COG_SVG;
    cog.style.top = b.offsetTop + "px";
    cog.style.left = (b.offsetLeft + b.offsetWidth + 4) + "px";
    cog.style.width = b.offsetWidth + "px";
    cog.style.height = b.offsetHeight + "px";
    cog.addEventListener("click", function (ev) { ev.preventDefault(); ev.stopPropagation(); toggleSettings(); });
    b.parentElement.appendChild(cog);
  }
  setInterval(function () { ensureCog(); startMenuObserver(); syncMenuOpen(); }, 800);
  ensureCog();
  startMenuObserver();

  // SPA route changes (Torn uses in-section hash routing) don't reload the script, so
  // re-sync the open/closed state on navigation to release sticky overrides.
  window.addEventListener("hashchange", syncMenuOpen);
  window.addEventListener("popstate", syncMenuOpen);

  document.addEventListener("touchstart", onStart, { passive: true, capture: true });
  document.addEventListener("touchmove", onMove, { passive: true, capture: true });
  document.addEventListener("touchend", onEnd, { passive: true, capture: true });
  document.addEventListener("touchcancel", onEnd, { passive: true, capture: true });
})();