// ==UserScript==
// @name         Torn Menu Right
// @namespace    RussianRob
// @version      1.3.0
// @description  Two-way swipe for Torn's mobile menu: swipe left opens it on the right, swipe right opens it on the left. Swipe back toward its edge to close.
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

  var html = document.documentElement;

  var css =
    'html.tmr-right #fly-out-panel{position:fixed!important;left:auto!important;right:0!important;top:36px!important;' +
    'border-left:1px solid #444!important;border-right:0!important;' +
    'border-top-left-radius:5px!important;border-top-right-radius:0!important;}' +
    'html.tmr-right #fly-out-panel:not([class*="visible___"]){transform:translateX(100%)!important;}' +
    'html.tmr-right #fly-out-panel[class*="visible___"]{box-shadow:-1px 0 5px rgba(0,0,0,.7)!important;}';
  var s = document.createElement("style");
  s.id = "torn-menu-right";
  s.textContent = css;
  (document.head || document.documentElement).appendChild(s);

  var OPEN_DIST = 70;
  var CLOSE_DIST = 60;
  var HORIZ_RATIO = 2.0;
  var SYS_EDGE = 24;

  function setSide(right) { html.classList.toggle("tmr-right", right); }
  setSide(true);

  var start = null;

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
    if (!e.touches || e.touches.length !== 1 || !mobileActive()) { start = null; return; }
    var t = e.touches[0];
    start = { x: t.clientX, y: t.clientY, id: t.identifier, open: isOpen() };
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
      if (dx <= -OPEN_DIST) { setSide(true); action = "open"; }
      else if (dx >= OPEN_DIST) { setSide(false); action = "open"; }
    } else if (rightSide && dx >= CLOSE_DIST && s0.x > SYS_EDGE) action = "close";
    else if (!rightSide && dx <= -CLOSE_DIST && s0.x < vw - SYS_EDGE) action = "close";
    if (!action) return;
    setTimeout(function () {
      if (action === "open") { if (!isOpen()) toggleMenu(); }
      else if (isOpen()) toggleMenu();
    }, 0);
  }

  document.addEventListener("touchstart", onStart, { passive: true, capture: true });
  document.addEventListener("touchend", onEnd, { passive: true, capture: true });
  document.addEventListener("touchcancel", onEnd, { passive: true, capture: true });
})();
