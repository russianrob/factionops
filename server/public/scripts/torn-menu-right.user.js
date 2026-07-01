// ==UserScript==
// @name         Torn Menu Right
// @namespace    RussianRob
// @version      1.2.0
// @description  Moves Torn's mobile slide-out menu to the right edge and mirrors the open/close swipe (swipe left to open, swipe right to close).
// @author       RussianRob
// @license      GPL-3.0-or-later
// @match        https://www.torn.com/*
// @run-at       document-start
// @grant        none
// ==/UserScript==
(function () {
  "use strict";
  if (window.__tornMenuRight) return;
  window.__tornMenuRight = true;

  var css =
    '#fly-out-panel{position:fixed!important;left:auto!important;right:0!important;top:36px!important;' +
    'border-left:1px solid #444!important;border-right:0!important;' +
    'border-top-left-radius:5px!important;border-top-right-radius:0!important;}' +
    '#fly-out-panel:not([class*="visible___"]){transform:translateX(100%)!important;}' +
    '#fly-out-panel[class*="visible___"]{box-shadow:-1px 0 5px rgba(0,0,0,.7)!important;}';
  var s = document.createElement("style");
  s.id = "torn-menu-right";
  s.textContent = css;
  (document.head || document.documentElement).appendChild(s);

  var OPEN_DIST = 70;
  var CLOSE_DIST = 60;
  var HORIZ_RATIO = 2.0;
  var SYS_EDGE = 24;

  var start = null;
  var committed = false;

  function panel() { return document.getElementById("fly-out-panel"); }
  function menuButton() { return document.getElementById("fly-out-menu-button"); }
  function isOpen() { var p = panel(); return !!p && /visible___/.test(p.className); }
  function mobileActive() { var b = menuButton(); return !!b && b.getClientRects().length > 0; }

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

  function onStart(e) {
    committed = false;
    if (!e.touches || e.touches.length !== 1 || !mobileActive()) { start = null; return; }
    var t = e.touches[0];
    start = { x: t.clientX, y: t.clientY, id: t.identifier, open: isOpen() };
  }

  function onMove(e) {
    if (!start || committed || !e.touches || e.touches.length !== 1) return;
    var t = e.touches[0];
    if (t.identifier !== start.id) return;
    var dx = t.clientX - start.x, dy = t.clientY - start.y;
    if (Math.abs(dx) < Math.abs(dy) * HORIZ_RATIO) return;
    if (!start.open) {
      if (dx <= -OPEN_DIST) { committed = true; if (!isOpen()) toggleMenu(); }
    } else if (dx >= CLOSE_DIST && start.x > SYS_EDGE) {
      committed = true; if (isOpen()) toggleMenu();
    }
  }

  function onEnd() { start = null; committed = false; }

  document.addEventListener("touchstart", onStart, { passive: true, capture: true });
  document.addEventListener("touchmove", onMove, { passive: true, capture: true });
  document.addEventListener("touchend", onEnd, { passive: true, capture: true });
  document.addEventListener("touchcancel", onEnd, { passive: true, capture: true });
})();
