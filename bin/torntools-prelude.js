/* warboard: TornTools' background is an MV3 service worker; we run it in a plain
   hidden page. Stub the service-worker-only globals + chrome.offscreen so the
   bundle doesn't throw on load. Runs after the browser shim (injected first). */
(function () {
  try {
    var g = self;
    if (typeof g.skipWaiting !== 'function') g.skipWaiting = function () { return Promise.resolve(); };
    if (typeof g.clients === 'undefined') g.clients = { claim: function () { return Promise.resolve(); }, matchAll: function () { return Promise.resolve([]); }, openWindow: function () { return Promise.resolve(null); } };
    if (typeof g.registration === 'undefined') g.registration = { showNotification: function () { return Promise.resolve(); }, getNotifications: function () { return Promise.resolve([]); }, scope: location.origin + '/', update: function () { return Promise.resolve(); } };
    if (typeof g.importScripts !== 'function') g.importScripts = function () {};
    var c = window.chrome || window.browser;
    if (c && !c.offscreen) c.offscreen = { createDocument: function () { return Promise.resolve(); }, closeDocument: function () { return Promise.resolve(); }, hasDocument: function () { return Promise.resolve(false); } };
    // chrome.runtime.getContexts — Chrome-116 MV3 API TornTools uses to check for an
    // existing offscreen doc before creating one; undefined in the WKWebView runtime.
    if (c && c.runtime && typeof c.runtime.getContexts !== 'function') c.runtime.getContexts = function () { return Promise.resolve([]); };
  } catch (e) { console.log('[warboard] tt prelude error', e); }

  // DIAGNOSTIC + safety net: report anything the background bundle throws at init.
  // The content-script diag doesn't cover this off-main background context, so a
  // silent throw here just shows up as "TornTools completely gone". Multi-channel
  // (console + image + fetch beacon) so at least one survives the page's CSP.
  function ttReport(kind, msg) {
    var s = '[' + kind + '] ' + String(msg == null ? '' : msg).slice(0, 1500);
    try { console.error('[warboard-tt-init]', s); } catch (e) {}
    try {
      var u = 'https://tornwar.com/api/debug/tt-beacon?m=' + encodeURIComponent(s);
      if (typeof Image === 'function') { var im = new Image(); im.src = u; }
      if (typeof fetch === 'function') { fetch(u, { mode: 'no-cors' }).catch(function () {}); }
    } catch (e) {}
  }
  try {
    if (self.addEventListener) {
      self.addEventListener('error', function (ev) {
        ttReport('error', (ev && ev.message) + ' @ ' + (ev && ev.filename) + ':' + (ev && ev.lineno) + ':' + (ev && ev.colno) + ' | ' + (ev && ev.error && ev.error.stack || ''));
      });
      self.addEventListener('unhandledrejection', function (ev) {
        var r = ev && ev.reason;
        ttReport('reject', (r && (r.stack || r.message)) || String(r));
      });
    }
  } catch (e) {}
})();
