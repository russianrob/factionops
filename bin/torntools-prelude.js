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
  } catch (e) { console.log('[warboard] tt prelude error', e); }
})();
