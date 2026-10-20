// ==UserScript==
// @name         Torn Flyout Diag
// @namespace    RussianRob
// @version      0.1.1
// @author       RussianRob
// @description  Temporary diagnostic - logs every time Torn's fly-out menu opens, asks whether all its icons drew, and tries one candidate fix per open, to find why the icons go missing on iPhone. Safe to remove once the cause is found.
// @license      All Rights Reserved
// @match        https://www.torn.com/*
// @grant        GM_xmlhttpRequest
// @grant        GM_setClipboard
// @grant        GM_registerMenuCommand
// @connect      tornwar.com
// @run-at       document-start
// @downloadURL  https://tornwar.com/scripts/torn-flyout-diag.user.js
// @updateURL    https://tornwar.com/scripts/torn-flyout-diag.meta.js
// ==/UserScript==

// =============================================================================
// CHANGELOG
// =============================================================================
// v0.1.1  - A verdict tapped just as Torn shuts the menu (on that same tap) now
//           still counts and moves on to the next test, instead of being lost.
// v0.1.0  - Initial release. On every fly-out open: logs the panel's state, shows
//           a verdict bar beside the menu (All icons OK / Top missing / Bottom
//           missing / Other), and runs one candidate fix per open, moving to the
//           next fix once the menu closes with a verdict. Also logs sideways
//           swipes, whether one navigated the page, what opened the menu (tap,
//           Torn Dual Flyout, or neither), and which scripts listen for touches.
// =============================================================================

(function () {
  "use strict";
  var W = typeof unsafeWindow !== "undefined" ? unsafeWindow : window;
  // One copy per page: a page restored from the back/forward cache keeps the old one.
  if (W.__tfd) return;
  W.__tfd = { ver: "0.1.1" };

  var VER = "0.1.1";
  var TAG = "flyout-diag";
  var LOG_URL = "https://tornwar.com/api/debug/client-log";
  var BEACON_URL = "https://tornwar.com/api/debug/tt-beacon?m=";
  var html = document.documentElement;
  var T0 = Date.now();

  // One candidate fix per open. Each targets a WebKit drawing feature that Torn's
  // fly-out panel or its icons use; if the icons always draw under one of them and
  // go missing under "baseline", that feature is the cause.
  var TESTS = [
    { id: "baseline" },                                   // control: change nothing
    // The icons carry a CSS drop-shadow filter. If this fixes it, the filter is required.
    { id: "no-filter", css: "#fly-out-panel svg,#fly-out-panel svg *{filter:none!important;-webkit-filter:none!important;}" },
    // Give every icon its own drawing layer: the fix that would keep the shadow.
    { id: "svg-layer", css: "#fly-out-panel svg{transform:translateZ(0);}" },
    // No CSS: redraw the icons once after the panel opens (see pulse()).
    { id: "pulse-repaint", pulse: true },
    // No CSS: scroll the panel 1px and back after it opens (see nudge()).
    { id: "nudge-scroll", nudge: true },
    // Torn Dual Flyout's stylesheet off: the panel goes back to Torn's own place (left, top 66px).
    { id: "df-css-off", dfOff: true },
    { id: "no-backface", css: "#fly-out-panel{-webkit-backface-visibility:visible!important;backface-visibility:visible!important;}" },
    { id: "no-will-change", css: "#fly-out-panel{will-change:auto!important;}" },
    // Torn leaves the open panel on transform:translateZ(0); drop the transform once open.
    { id: "open-no-transform", css: "#fly-out-panel[class*=\"visible___\"]{transform:none!important;}" },
    { id: "no-touch-scroll", css: "#fly-out-panel{-webkit-overflow-scrolling:auto!important;}" }
  ];

  // ---- storage (every access can throw in a locked-down web view) ----
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  // Per-tab scratch goes in sessionStorage: it survives the next page load in this tab
  // without adding to localStorage, which Torn's chat already fills on some phones.
  function ssGet(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } }
  function ssSet(k, v) { try { sessionStorage.setItem(k, v); } catch (e) {} }
  function ssDel(k) { try { sessionStorage.removeItem(k); } catch (e) {} }
  function parse(s) { try { return s ? JSON.parse(s) : null; } catch (e) { return null; } }

  var idx = +(lsGet("tfd_idx") || 0);
  if (!(idx >= 0 && idx < TESTS.length)) idx = 0;
  var tallies = parse(lsGet("tfd_tally")) || {};

  // ---- event log ----
  // ring: the last 200 events, readable from the inspect bridge as window.__tfd.log.
  // queue: events the server has not accepted yet, handed on to the next page in this tab.
  // n is a per-tab sequence number, so gaps and page boundaries show in the server log.
  var ring = [];
  var queue = parse(ssGet("tfd_q")) || [];
  ssDel("tfd_q");
  var seq = +(ssGet("tfd_n") || 0);

  function note(kind, data) {
    var ev = { k: kind, n: ++seq, t: Date.now() - T0 }, key;
    if (data) for (key in data) if (data[key] !== undefined) ev[key] = data[key];
    ring.push(ev);
    if (ring.length > 200) ring.shift();
    queue.push(ev);
    if (queue.length > 150) queue.shift();
    ssSet("tfd_n", String(seq));
    return ev;
  }
  function err(at, e) { note("err", { at: at, m: String((e && e.message) || e).slice(0, 160) }); }
  function safe(at, fn) { try { return fn(); } catch (e) { try { err(at, e); } catch (e2) {} } }

  // ---- reporting ----
  // Batches go to /api/debug/client-log under the "flyout-diag" tag, which the server
  // gives its own bucket of 10 posts a minute and a 6000-character cut. This stays
  // under both: at most 8 posts a minute, each under 3500 characters of events.
  // A refused or failed post keeps its events and is tried again 20s later.
  var MAX_DATA = 3500, MAX_PER_MIN = 8;
  var sending = false, sendStart = 0, retryAt = 0, winStart = 0, winCount = 0;
  var stats = { sent: 0, posts: 0, fails: 0, last: "" };

  function pack() {
    var batch = [], size = 40, i;
    for (i = 0; i < queue.length; i++) {
      var len = JSON.stringify(queue[i]).length + 1;
      if (batch.length && size + len > MAX_DATA) break;
      batch.push(queue[i]);
      size += len;
    }
    return batch;
  }
  function drop(batch) { queue = queue.filter(function (ev) { return batch.indexOf(ev) < 0; }); }
  function failed(why) { sending = false; stats.fails++; stats.last = why; retryAt = Date.now() + 20000; }

  function flush() {
    if (!queue.length) return;
    var now = Date.now();
    if (sending && now - sendStart < 30000) return;   // the app never times a request out; give up on one after 30s
    if (now < retryAt) return;
    if (now - winStart > 60000) { winStart = now; winCount = 0; }
    if (winCount >= MAX_PER_MIN) return;
    var batch = pack();
    winCount++;
    stats.posts++;
    if (typeof GM_xmlhttpRequest !== "function") {
      // No GM bridge: Torn's CSP blocks fetch to tornwar but allows images, so use the
      // GET beacon. It can't report back, so the batch counts as sent.
      try { if (typeof Image === "function") new Image().src = BEACON_URL + encodeURIComponent(TAG + " " + JSON.stringify({ v: VER, e: batch }).slice(0, 1400)); } catch (e) {}
      drop(batch);
      return;
    }
    sending = true;
    sendStart = now;
    try {
      GM_xmlhttpRequest({
        method: "POST",
        url: LOG_URL,
        headers: { "Content-Type": "application/json" },
        data: JSON.stringify({ tag: TAG, data: { v: VER, e: batch } }),
        onload: function (r) {
          var st = r && r.status;
          if (st >= 200 && st < 300) {
            sending = false;
            drop(batch);
            stats.sent += batch.length;
            stats.last = "ok";
            if (queue.length) setTimeout(flush, 1500);
          } else failed("http " + st);
        },
        onerror: function () { failed("network"); }
      });
    } catch (e) { failed("threw"); }
  }

  // ---- the menu ----
  function panel() { return document.getElementById("fly-out-panel"); }
  function menuButton() { return document.getElementById("fly-out-menu-button"); }
  function isOpen() { var p = panel(); return !!p && /visible___/.test(p.className); }

  // ---- what opened it ----
  // Torn's menu button opens the menu through its React onClick. Wrapping that handler
  // on the button node tells a real tap (a trusted event) from a script calling it,
  // which is how Torn Dual Flyout opens the menu after a swipe. An open that never went
  // through the button shows up as "native-swipe?" (right after a swipe) or "other".
  var lastClick = null, lastTapDom = 0, lastSwipe = null;
  function hookButton() {
    var b = menuButton();
    if (!b || b.__tfdHooked) return;
    var keys = Object.keys(b), key = null, i;
    for (i = 0; i < keys.length; i++) if (keys[i].indexOf("__reactProps$") === 0) { key = keys[i]; break; }
    if (!key) return;                                   // not hydrated yet; the next tick retries
    var cur = b[key], seenFor = null, seenOut = null;
    // React stores fresh props on the node at each render and reads them back to run a
    // handler, so a getter can hand out a copy whose onClick notes the call first.
    function wrapped() {
      var props = cur;
      if (!props || typeof props.onClick !== "function") return props;
      if (props === seenFor) return seenOut;
      var orig = props.onClick, out = {}, k;
      for (k in props) out[k] = props[k];
      out.onClick = function (ev) {
        try { lastClick = { at: Date.now(), trusted: !!(ev && ev.nativeEvent && ev.nativeEvent.isTrusted) }; } catch (e) {}
        return orig.apply(this, arguments);
      };
      seenFor = props;
      seenOut = out;
      return out;
    }
    try {
      Object.defineProperty(b, key, { configurable: true, enumerable: true, get: wrapped, set: function (v) { cur = v; } });
      b.__tfdHooked = true;
    } catch (e) { err("hook", e); }
  }
  function guessVia() {
    var now = Date.now();
    var swiped = lastSwipe && now - lastSwipe.at < 1500;
    if (lastClick && now - lastClick.at < 1500) return lastClick.trusted ? "tap" : (swiped ? "df-swipe" : "df-script");
    if (now - lastTapDom < 1500) return "tap";
    return swiped ? "native-swipe?" : "other";
  }

  // ---- panel state ----
  function rect(el) {
    try {
      var r = el.getBoundingClientRect();
      return [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)];
    } catch (e) { return null; }
  }
  // Horizontal offset of a computed transform: matrix(a,b,c,d,tx,ty) or matrix3d(..., tx at 12).
  function txOf(tf) {
    var m = /matrix(3d)?\(([^)]*)\)/.exec(tf || "");
    if (!m) return tf === "none" ? 0 : tf;
    return Math.round(parseFloat(m[2].split(",")[m[1] ? 12 : 4]));
  }
  function snap(p) {
    var cs = getComputedStyle(p), vv = W.visualViewport;
    var svgs = p.querySelectorAll("svg"), zero = 0, hidden = 0, i;
    for (i = 0; i < svgs.length; i++) {
      var r = rect(svgs[i]);
      if (r && (!r[2] || !r[3])) zero++;
      var c = getComputedStyle(svgs[i]);
      if (c.display === "none" || c.visibility === "hidden" || c.opacity === "0") hidden++;
    }
    var s0 = svgs[0] ? getComputedStyle(svgs[0]) : null;
    return {
      cls: p.className,                                 // full className: hashed classes matter
      st: p.getAttribute("style") || "",
      pos: cs.position, top: cs.top, tf: cs.transform, wc: cs.willChange, oy: cs.overflowY,
      wos: cs.webkitOverflowScrolling || "", bfv: cs.webkitBackfaceVisibility || cs.backfaceVisibility || "",
      trn: cs.transition || "", z: cs.zIndex,
      r: rect(p), sc: [p.scrollTop, p.scrollHeight, p.clientHeight],
      vp: [W.innerWidth, W.innerHeight, W.scrollY, W.devicePixelRatio],
      vv: vv ? [Math.round(vv.width), Math.round(vv.height), Math.round(vv.offsetTop), Math.round(vv.pageTop), vv.scale] : null,
      hc: html.className,
      ho: getComputedStyle(html).overflow, bo: document.body ? getComputedStyle(document.body).overflow : "",
      svg: svgs.length, zero: zero, hid: hidden,
      f0: s0 ? s0.filter : "", fl0: s0 ? s0.fill : "",
      defs: document.querySelectorAll('[id="sidebar_svg_gradient_regular_mobile"]').length,
      vis: document.visibilityState
    };
  }
  // Each icon row's label and its offset inside the panel, once per page, so "top" and
  // "bottom" in a verdict map to real rows.
  function rows(p) {
    var a = p.querySelectorAll("a"), pr = rect(p), out = [], i;
    for (i = 0; i < a.length && out.length < 40; i++) {
      if (!a[i].querySelector("svg")) continue;
      var r = rect(a[i]);
      var lab = (a[i].textContent || "").replace(/\s+/g, " ").trim().slice(0, 14);
      out.push(lab + "@" + (r && pr ? r[1] - pr[1] + (p.scrollTop || 0) : "?"));
    }
    return out.join("|");
  }

  // ---- open / close ----
  var cur = null, lastClosed = null, wasOpen = false, rowsSent = false;
  var opens = +(ssGet("tfd_opens") || 0);
  function check() {
    var o = isOpen();
    if (o === wasOpen) return;
    wasOpen = o;
    if (o) safe("open", onOpen); else safe("close", onClose);
  }
  function onOpen() {
    var p = panel();
    cur = { o: ++opens, at: Date.now(), ts: TESTS[idx].id, via: guessVia(), verdict: null, scrolls: 0, pts: [] };
    ssSet("tfd_opens", String(opens));
    var ev = { o: cur.o, ts: cur.ts, via: cur.via, df: W.__tdfVer || null }, s = safe("snap", function () { return snap(p); }) || {}, k;
    for (k in s) ev[k] = s[k];
    note("open", ev);
    if (!rowsSent) { rowsSent = true; safe("rows", function () { note("rows", { o: cur.o, rows: rows(p) }); }); }
    safe("bar", showBar);
    track(p, cur);
    if (TESTS[idx].nudge) setTimeout(function () { safe("nudge", function () { nudge(p); }); }, 450);
    if (TESTS[idx].pulse) setTimeout(function () { safe("pulse", pulse); }, 450);
  }
  // Where the panel really is while it slides in: [ms, left, top, scrollTop, transform-x]
  // at fixed points over the first second. A slide that stalls or jumps shows here.
  function track(p, c) {
    [0, 60, 160, 300, 600, 1000].forEach(function (ms) {
      setTimeout(function () {
        safe("track", function () {
          if (cur !== c) return;
          var r = rect(p);
          c.pts.push([ms, r ? r[0] : null, r ? r[1] : null, p.scrollTop, txOf(getComputedStyle(p).transform)]);
          if (ms === 160) placeBar();
          if (ms === 1000) { note("track", { o: c.o, pts: c.pts }); c.ptsSent = true; }
        });
      }, ms);
    });
  }
  // nudge-scroll: move the panel's scroll position 1px and back once the slide-in is
  // over. WebKit works out again which parts of a scrolled layer to draw when it
  // scrolls, so if this alone brings the icons back, the drawn area had gone stale.
  function nudge(p) {
    var t = p.scrollTop;
    p.scrollTop = t > 0 ? t - 1 : t + 1;
    setTimeout(function () { p.scrollTop = t; }, 50);
    note("nudge", { o: cur && cur.o, from: t });
  }
  // pulse-repaint: swap the icons' shadow for a near-identical one for a moment once the
  // slide-in is over, which makes WebKit draw every icon again where the panel now is.
  // Icons that come back and stay mean the first drawing went stale; icons that come
  // back only in the rows on screen, and blank again on scrolling, mean each drawing is
  // cut to what is on screen at the time.
  function pulse() {
    var st = document.createElement("style");
    st.id = "tfd-pulse";
    st.textContent = "#fly-out-panel svg{filter:drop-shadow(rgba(0,0,0,.26) 0 1px 0)!important;}";
    (document.head || html).appendChild(st);
    setTimeout(function () { if (st.parentNode) st.parentNode.removeChild(st); }, 60);
    note("pulse", { o: cur && cur.o });
  }
  function onClose() {
    hideBar();
    var c = cur;
    cur = null;
    if (!c) return;
    c.closedAt = Date.now();
    lastClosed = c;
    note("close", { o: c.o, ts: c.ts, v: c.verdict, ms: Date.now() - c.at, scr: c.scrolls, pts: c.ptsSent ? undefined : c.pts });
    // A test is only done once the owner has judged it; an open with no verdict repeats it.
    if (c.verdict) { tally(c.ts, c.verdict); advance(); }
  }
  function verdict(v) {
    var c = cur, late = false;
    if (!c) {
      // Torn may shut the menu on the same tap, before the bar's click arrives. That tap
      // still judges the open that just closed, once, within 1.5s.
      c = lastClosed;
      if (!c || c.verdict || Date.now() - c.closedAt > 1500) return;
      late = true;
    }
    c.verdict = v;
    var p = panel();
    note("verdict", {
      o: c.o, ts: c.ts, v: v, via: c.via, ms: Date.now() - c.at, scr: c.scrolls, late: late ? 1 : undefined,
      sc: p ? [p.scrollTop, p.scrollHeight, p.clientHeight] : null, r: p ? rect(p) : null, sy: W.scrollY
    });
    var bs = bar.querySelectorAll("button[data-v]"), i;
    for (i = 0; i < bs.length; i++) bs[i].classList.toggle("tfd-picked", bs[i].getAttribute("data-v") === v);
    if (late) { tally(c.ts, v); advance(); }          // onClose has already run without a verdict
    setTimeout(flush, 200);
  }
  function tally(ts, v) {
    var t = tallies[ts] || (tallies[ts] = {});
    t[v] = (t[v] || 0) + 1;
    lsSet("tfd_tally", JSON.stringify(tallies));
  }
  function tallyText(ts) {
    var t = tallies[ts];
    if (!t) return "first try";
    var bad = (t.top || 0) + (t.bottom || 0) + (t.other || 0);
    return (t.ok || 0) + " OK, " + bad + " missing so far";
  }

  // ---- tests ----
  function applyTest() {
    var st = document.getElementById("tfd-test");
    if (!st) {
      st = document.createElement("style");
      st.id = "tfd-test";
      (document.head || html).appendChild(st);
    }
    st.textContent = TESTS[idx].css || "";
    dfStyle();
  }
  // Torn Dual Flyout's stylesheet is <style id="torn-menu-right">; media="not all" switches it off.
  function dfStyle() {
    var s = document.getElementById("torn-menu-right");
    if (!s) return;
    var off = !!TESTS[idx].dfOff;
    if (off && s.getAttribute("media") !== "not all") s.setAttribute("media", "not all");
    else if (!off && s.getAttribute("media") === "not all") s.removeAttribute("media");
  }
  function advance() {
    idx = (idx + 1) % TESTS.length;
    lsSet("tfd_idx", String(idx));
    applyTest();
    note("arm", { ts: TESTS[idx].id, idx: idx });
  }

  // ---- verdict bar ----
  var UI_CSS =
    '#tfd-bar{position:fixed;z-index:2147483002;top:120px;left:6px;width:120px;display:none;flex-direction:column;gap:6px;padding:6px;box-sizing:border-box;' +
    'background:rgba(14,15,18,.94);border:1px solid #3a3f4b;border-radius:8px;font:12px -apple-system,system-ui,sans-serif;color:#dde2e8;' +
    '-webkit-user-select:none;user-select:none;-webkit-tap-highlight-color:transparent;}' +
    '#tfd-bar.tfd-on{display:flex;}' +
    '#tfd-bar .tfd-h{font-size:11px;line-height:1.35;color:#9aa3ad;}' +
    '#tfd-bar .tfd-h b{color:#f3f4f6;font-weight:700;}' +
    '#tfd-bar button{font:inherit;font-size:13px;line-height:1.2;padding:10px 4px;margin:0;border-radius:6px;border:1px solid #454b57;background:#1d2027;color:#f3f4f6;text-align:center;}' +
    '#tfd-bar button.tfd-picked{background:#14532d;border-color:#4ade80;}';
  var bar = null;
  function ensureBar() {
    if (bar && bar.parentNode) return;
    bar = document.createElement("div");
    bar.id = "tfd-bar";
    bar.setAttribute("data-prevent-flyout-swipe", "true");   // Torn's own opt-out from its swipe gesture
    bar.innerHTML = '<div class="tfd-h"></div>' +
      '<button type="button" data-v="ok">All icons OK</button>' +
      '<button type="button" data-v="top">Top missing</button>' +
      '<button type="button" data-v="bottom">Bottom missing</button>' +
      '<button type="button" data-v="other">Other</button>';
    var bs = bar.querySelectorAll("button[data-v]"), i;
    for (i = 0; i < bs.length; i++) {
      bs[i].addEventListener("click", (function (v) {
        return function (e) { e.preventDefault(); e.stopPropagation(); safe("verdict", function () { verdict(v); }); };
      })(bs[i].getAttribute("data-v")));
    }
    // Taps on the bar must not reach Torn's page handlers (outside-tap close, swipes).
    ["touchstart", "touchend", "pointerdown", "pointerup", "mousedown", "mouseup"].forEach(function (ty) {
      bar.addEventListener(ty, function (e) { e.stopPropagation(); }, { passive: true });
    });
    (document.body || html).appendChild(bar);
  }
  function showBar() {
    ensureBar();
    var t = TESTS[idx];
    bar.querySelector(".tfd-h").innerHTML = "<b>Flyout diag</b> " + (idx + 1) + "/" + TESTS.length + "<br>" + t.id + "<br>" + tallyText(t.id);
    var bs = bar.querySelectorAll("button[data-v]"), i;
    for (i = 0; i < bs.length; i++) bs[i].classList.remove("tfd-picked");
    bar.classList.add("tfd-on");
    placeBar();
  }
  function hideBar() { if (bar) bar.classList.remove("tfd-on"); }
  // Beside the panel, on whichever side has more room, so the bar never covers an icon.
  // Mid-slide the panel is still partly off-screen, which leaves the same side roomier.
  function placeBar() {
    var p = panel();
    if (!p || !bar) return;
    var r = rect(p), vw = W.innerWidth;
    var leftRoom = r ? r[0] : 0, rightRoom = r ? vw - (r[0] + r[2]) : vw, w;
    if (leftRoom >= rightRoom) {
      w = Math.max(84, Math.min(150, leftRoom - 12));
      bar.style.left = Math.max(4, Math.round((leftRoom - w) / 2)) + "px";
      bar.style.right = "auto";
    } else {
      w = Math.max(84, Math.min(150, rightRoom - 12));
      bar.style.right = Math.max(4, Math.round((rightRoom - w) / 2)) + "px";
      bar.style.left = "auto";
    }
    bar.style.width = w + "px";
  }

  // ---- swipes ----
  // Every sideways swipe, and every touch that starts at a screen edge (the phone's
  // back/forward gesture), with whether the menu was open before and 700ms after.
  var tStart = null, tLast = null;
  function onTStart(e) {
    if (!e.touches || e.touches.length !== 1) { tStart = null; return; }
    var t = e.touches[0];
    tStart = { x: t.clientX, y: t.clientY, at: Date.now(), open: isOpen() };
    tLast = { x: t.clientX, y: t.clientY };
    if (e.target && e.target.closest && e.target.closest("#fly-out-menu-button") && e.isTrusted) lastTapDom = Date.now();
  }
  function onTMove(e) {
    if (tStart && e.touches && e.touches[0]) tLast = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }
  function onTEnd(e) {
    var s = tStart;
    tStart = null;
    if (!s) return;
    var t = (e.changedTouches && e.changedTouches[0]) || null;
    var x1 = t ? t.clientX : tLast.x, y1 = t ? t.clientY : tLast.y;
    var dx = x1 - s.x, dy = y1 - s.y, vw = W.innerWidth;
    var edge = s.x <= 30 ? "L" : (s.x >= vw - 30 ? "R" : "");
    var cancel = e.type === "touchcancel";
    var sideways = Math.abs(dx) >= 40 && Math.abs(dx) >= Math.abs(dy) * 1.5;
    // Edge touches count even when short or cancelled: the phone's gesture takes the
    // touch over (touchcancel) before it has travelled far.
    if (!sideways && !(edge && (cancel || Math.abs(dx) >= 15))) return;
    var sw = { at: Date.now(), x0: Math.round(s.x), x1: Math.round(x1), dy: Math.round(dy), ms: Date.now() - s.at, edge: edge, was: s.open ? 1 : 0, end: cancel ? "cancel" : "end" };
    lastSwipe = sw;
    ssSet("tfd_swipe", JSON.stringify(sw));             // the next page reads it if this swipe navigated
    setTimeout(function () {
      note("swipe", { x0: sw.x0, x1: sw.x1, dy: sw.dy, ms: sw.ms, edge: sw.edge, was: sw.was, end: sw.end, now: isOpen() ? 1 : 0 });
    }, 700);
  }
  // A swipe followed within 2s by the last page going away was the phone navigating.
  function checkNav() {
    var h = parse(ssGet("tfd_hide")), sw = parse(ssGet("tfd_swipe"));
    ssDel("tfd_hide");
    if (h && sw && h.at >= sw.at && h.at - sw.at < 2000) {
      note("nav", { from: h.p, gap: h.at - sw.at, x0: sw.x0, x1: sw.x1, edge: sw.edge, was: sw.was, end: sw.end });
      ssDel("tfd_swipe");
    }
  }
  // Own listeners go on before the wrapper below, so they don't show up in regs.
  document.addEventListener("touchstart", function (e) { safe("ts", function () { onTStart(e); }); }, { capture: true, passive: true });
  document.addEventListener("touchmove", function (e) { safe("tm", function () { onTMove(e); }); }, { capture: true, passive: true });
  document.addEventListener("touchend", function (e) { safe("te", function () { onTEnd(e); }); }, { capture: true, passive: true });
  document.addEventListener("touchcancel", function (e) { safe("tc", function () { onTEnd(e); }); }, { capture: true, passive: true });

  // ---- who listens for touches ----
  // Records every touch/pointer listener added from here on: on which node, with which
  // options, and the torn.com script frame that added it. Torn's bundles load after
  // every document-start userscript, so a native fly-out swipe would show up here.
  // Scripts injected before this one (Torn Dual Flyout) are not seen.
  var regs = [], aelOk = null;
  function nodeName(o) {
    if (o === W || o === window) return "window";
    if (o === document) return "document";
    if (!o) return String(o);
    var s = String(o.nodeName || "?").toLowerCase();
    if (o.id) s += "#" + o.id;
    var c = typeof o.className === "string" ? o.className.trim().split(/\s+/)[0] : "";
    if (c) s += "." + c;
    return s;
  }
  function frame() {
    var st = String(new Error().stack || "").split("\n"), i;
    for (i = 1; i < st.length; i++) if (st[i].indexOf("torn.com") >= 0) return st[i].trim().replace("https://www.torn.com", "").slice(0, 160);
    return (st[2] || st[1] || "").trim().slice(0, 100);
  }
  safe("wrap", function () {
    var ET = W.EventTarget;
    if (!ET || !ET.prototype || typeof ET.prototype.addEventListener !== "function") return;
    var orig = ET.prototype.addEventListener;
    if (orig.__tfdWrap) return;
    var wrap = function (type, fn, opts) {
      try {
        if (regs.length < 120 && typeof type === "string" && /^(touch|pointer)/.test(type) && !(this && /^tfd-/.test(this.id || ""))) {
          var o = opts && typeof opts === "object" ? (opts.capture ? "c" : "") + (opts.passive ? "p" : "") + (opts.passive === false ? "P" : "") : (opts ? "c" : "");
          regs.push({ ty: type, on: nodeName(this), o: o, t: Date.now() - T0, src: frame() });
        }
      } catch (e) {}
      return orig.apply(this, arguments);
    };
    wrap.__tfdWrap = true;
    ET.prototype.addEventListener = wrap;
    aelOk = W.addEventListener === wrap;                // false: window has its own copy and slips past
  });
  // Sent once per tab: identical registrations folded together with a count.
  function sendRegs() {
    if (ssGet("tfd_regs_sent")) return;
    ssSet("tfd_regs_sent", "1");
    var seen = {}, list = [], i;
    for (i = 0; i < regs.length; i++) {
      var r = regs[i], line = r.ty + "|" + r.on + "|" + r.o + "|" + r.src;
      if (seen[line]) { seen[line].c++; continue; }
      seen[line] = { s: line, c: 1 };
      list.push(seen[line]);
    }
    var srcs = [], sc = document.scripts || [];
    for (i = 0; i < sc.length; i++) if (/sidebar/.test(sc[i].src || "")) srcs.push(String(sc[i].src).replace("https://www.torn.com", ""));
    var lines = list.map(function (x) { return (x.c > 1 ? x.c + "x " : "") + x.s; });
    for (i = 0; i < lines.length || i === 0; i += 10) {
      note("regs", { part: i / 10 + 1, of: Math.max(1, Math.ceil(lines.length / 10)), total: regs.length, js: i === 0 ? srcs.join(" ") : undefined, r: lines.slice(i, i + 10) });
    }
  }

  // ---- page lifecycle ----
  function boot() {
    note("boot", {
      at: Date.now(), p: W.location.pathname, df: W.__tdfVer || null, host: W.__WB_NATIVE_HOST__ ? 1 : 0,
      ua: String(W.navigator.userAgent || "").slice(0, 160), ts: TESTS[idx].id, idx: idx, hc: html.className, aelOk: aelOk
    });
    checkNav();
    observe();
    setTimeout(function () { safe("regs", sendRegs); }, 8000);
  }
  var observing = false;
  function observe() {
    if (observing) return;
    var root = document.getElementById("sidebarroot") || document.body;
    if (!root) return;
    try {
      new MutationObserver(function () { safe("check", check); }).observe(root, { attributes: true, attributeFilter: ["class"], childList: true, subtree: true });
      observing = true;
    } catch (e) { err("mo", e); }
  }
  var watched = null;
  function watchPanel() {
    var p = panel();
    if (!p || p === watched) return;
    watched = p;
    p.addEventListener("scroll", function () { if (cur) cur.scrolls++; }, { passive: true });
  }

  W.addEventListener("pagehide", function () {
    ssSet("tfd_hide", JSON.stringify({ at: Date.now(), p: W.location.pathname + W.location.hash }));
    ssSet("tfd_q", JSON.stringify(queue));
    queue = [];                                         // handed to the next page, which sends it
  });
  W.addEventListener("pageshow", function (e) {
    if (!e || !e.persisted) return;                     // restored from the back/forward cache
    queue = queue.concat(parse(ssGet("tfd_q")) || []);
    ssDel("tfd_q");
    checkNav();
  });

  // ---- start ----
  var uiStyle = document.createElement("style");
  uiStyle.id = "tfd-ui";
  uiStyle.textContent = UI_CSS;
  (document.head || html).appendChild(uiStyle);
  applyTest();
  hookButton();
  observe();
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function () { safe("boot", boot); });
  else safe("boot", boot);
  setInterval(function () {
    safe("tick", function () { hookButton(); dfStyle(); watchPanel(); observe(); check(); });
  }, 1000);
  setInterval(function () { safe("flush", flush); }, 6000);

  if (typeof GM_registerMenuCommand === "function") {
    try {
      GM_registerMenuCommand("Flyout diag: copy log", function () {
        if (typeof GM_setClipboard === "function") GM_setClipboard(JSON.stringify({ v: VER, test: TESTS[idx].id, tallies: tallies, stats: stats, log: ring }));
      });
      GM_registerMenuCommand("Flyout diag: restart tests", function () {
        idx = 0; tallies = {};
        lsSet("tfd_idx", "0"); lsSet("tfd_tally", "{}");
        applyTest();
        note("restart", {});
      });
    } catch (e) {}
  }

  W.__tfd = {
    ver: VER, log: ring, regs: regs, stats: stats,
    queued: function () { return queue.length; },
    test: function () { return TESTS[idx].id; },
    tallies: function () { return tallies; },
    snap: function () { var p = panel(); return p ? snap(p) : null; },
    flush: flush
  };
})();
