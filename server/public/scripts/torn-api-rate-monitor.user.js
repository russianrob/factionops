// ==UserScript==
// @name         Torn API Rate Monitor
// @namespace    warboard.local
// @version      1.0.0
// @description  Counts your api.torn.com calls (fetch/XHR/beacon) and logs a rolling 60s rate to the console, attributed by comment tag and endpoint.
// @author       you
// @match        https://www.torn.com/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  var API_HOST = 'api.torn.com';
  var WINDOW_MS = 60000;      // rolling window = 60s
  var REPORT_EVERY_MS = 10000; // log a summary every 10s
  var WARN_AT = 60;            // warn if calls in last 60s exceed this (cap is 100)

  // Each event: { t: epochMs, comment: string, endpoint: string }
  var events = [];

  function classify(url) {
    var u;
    try { u = new URL(url, location.href); } catch (_) { return null; }
    if (u.hostname !== API_HOST) return null;
    var comment = u.searchParams.get('comment') || '(none)';
    // Endpoint = first two path segments, e.g. /v2/user or /user or /v2/faction/42055 -> /v2/faction
    var parts = u.pathname.split('/').filter(Boolean);
    var endpoint = '/' + parts.slice(0, 2).filter(function (p) { return !/^\d+$/.test(p); }).join('/');
    return { comment: comment, endpoint: endpoint || u.pathname };
  }

  function record(url) {
    var c = classify(url);
    if (!c) return;
    events.push({ t: Date.now(), comment: c.comment, endpoint: c.endpoint });
  }

  function prune(now) {
    var cutoff = now - WINDOW_MS;
    while (events.length && events[0].t < cutoff) events.shift();
  }

  // ---- Hook fetch ----
  if (typeof window.fetch === 'function') {
    var _fetch = window.fetch;
    window.fetch = function (input, init) {
      try {
        var url = (typeof input === 'string') ? input : (input && input.url);
        if (url) record(url);
      } catch (_) {}
      return _fetch.apply(this, arguments);
    };
  }

  // ---- Hook XMLHttpRequest ----
  var _open = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (method, url) {
    try { if (url) record(url); } catch (_) {}
    return _open.apply(this, arguments);
  };

  // ---- Hook sendBeacon ----
  if (navigator.sendBeacon) {
    var _beacon = navigator.sendBeacon.bind(navigator);
    navigator.sendBeacon = function (url, data) {
      try { if (url) record(url); } catch (_) {}
      return _beacon(url, data);
    };
  }

  // ---- On-demand query ----
  window.__apiRate = function () {
    var now = Date.now();
    prune(now);
    var byComment = {}, byEndpoint = {};
    events.forEach(function (e) {
      byComment[e.comment] = (byComment[e.comment] || 0) + 1;
      byEndpoint[e.endpoint] = (byEndpoint[e.endpoint] || 0) + 1;
    });
    return { callsLast60s: events.length, byComment: byComment, byEndpoint: byEndpoint };
  };

  // ---- Periodic report ----
  setInterval(function () {
    var now = Date.now();
    prune(now);
    var n = events.length;
    var snap = window.__apiRate();
    var style = n > WARN_AT ? 'color:#e33;font-weight:bold' : 'color:#3a3';
    console.log('%c[API Rate] ' + n + ' calls in last 60s' + (n > WARN_AT ? '  ⚠ approaching 100/min cap' : ''), style);
    if (n) console.log('[API Rate]   by script:', snap.byComment, '  by endpoint:', snap.byEndpoint);
  }, REPORT_EVERY_MS);

  console.log('%c[API Rate] monitor active — logging every ' + (REPORT_EVERY_MS / 1000) + 's; call __apiRate() anytime', 'color:#39c');
})();