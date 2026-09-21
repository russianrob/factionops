// ==UserScript==
// @name         GM XHR Probe
// @namespace    RussianRob
// @version      1.3.0
// @description  Diagnoses why a userscript's cross-origin calls fail in a given runtime — reports whether GM_xmlhttpRequest exists at injection time, then races it against a page-context fetch to the same host
// @author       RussianRob
// @license      GPL-3.0-or-later
// @match        https://www.torn.com/*
// @run-at       document-start
// @grant        GM_xmlhttpRequest
// @grant        GM_setClipboard
// @connect      api.kalends.dev
// @connect      ffscouter.com
// @downloadURL  https://tornwar.com/scripts/torn-gmxhr-probe.user.js
// @updateURL    https://tornwar.com/scripts/torn-gmxhr-probe.meta.js
// ==/UserScript==

(function () {
    'use strict';

    var SCRIPT_VERSION = '1.3.0';

    // ── The measurement that has to happen FIRST ──────────────────
    //
    // This is the whole point of the probe, and it is why @run-at is
    // document-start. A script that feature-detects like
    //
    //     var http = typeof GM_xmlhttpRequest === 'function' ? gmFetch : fetch;
    //
    // latches that decision once, at its own top level. If the runtime defines
    // the GM_* functions AFTER the script's first statements run, the detect
    // fails, the page-context fallback is captured for the life of the page,
    // and every later request goes out as a plain fetch — which CORS answers
    // with status 0. Sampling here, before anything else in this file, records
    // what a script would have seen at that same moment.
    var AT_INIT = {
        GM_xmlhttpRequest: typeof GM_xmlhttpRequest,
        GM_object: typeof GM,
        GM_xmlHttpRequest_on_GM: (typeof GM !== 'undefined' && GM) ? typeof GM.xmlHttpRequest : 'n/a',
        unsafeWindow: typeof unsafeWindow,
        GM_info: (typeof GM_info !== 'undefined' && GM_info && GM_info.scriptHandler)
            ? GM_info.scriptHandler + ' ' + (GM_info.version || '') : 'absent',
        readyState: document.readyState,
        href: location.href.split('#')[0]
    };

    // Two hosts, not one. If the control succeeds and the subject fails, the
    // problem is that host — DNS, TLS, or its own server. If BOTH fail the
    // problem is the runtime, and the probe has told us something the subject
    // alone could not.
    var SUBJECT = 'https://api.kalends.dev/';
    var CONTROL = 'https://ffscouter.com/api/v1/check-key?key=0000000000000000';
    // A URL that reliably answers 401, and another that answers 404. These are
    // the only requests here that can distinguish the builds: every other test
    // gets a 200, and a 200 behaved identically before and after the fix.
    //
    // Tampermonkey hands ANY completed response to onload with its status. The
    // old bridge sent anything outside 200-399 to onerror instead, which is why
    // an ordinary 401 reached KAL as its own failure value, status 0.
    var NON2XX_401 = 'https://ffscouter.com/api/v1/get-stats?key=0000000000000000&targets=1';
    var NON2XX_404 = 'https://ffscouter.com/api/v1/nope';
    // KAL's connect is a POST with a JSON body; 1.0/1.1 only ever tested GET,
    // which is why they reported a healthy bridge while connect still failed.
    // This mirrors KAL's own request exactly — same endpoint, same headers —
    // but omits the key field, so it fails validation with 422 without
    // reaching Torn and without touching any real key's rate limit.
    var POST_URL = 'https://api.kalends.dev/script/register';
    var POST_BODY = JSON.stringify({ version: 'gmxhr-probe' });
    // The same POST again, but carrying KAL's FULL payload shape — a
    // well-formed 16-character key it has never seen. That reaches the branch
    // the validation-only probe stops short of: the server looks the key up
    // with Torn and answers 422 code 15. A deliberately fake key so nothing is
    // registered and no real key's cooldown is touched.
    var POST_BODY_FULL = JSON.stringify({
        key: 'zzzzzzzzzzzzzzzz',
        version: '1.2.9',
        agree_to_api_policy_and_tos: true
    });

    var results = [];
    var clipCache = '';   // pre-warmed: see the copy button below

    var VERDICT = 'testing…';
    function record(name, detail) {
        results.push({ name: name, detail: detail });
        render();
    }

    // Which build is on this device, decided by where a 401 lands.
    function checkBridgeBuild() {
        if (typeof GM_xmlhttpRequest !== 'function') {
            VERDICT = 'UNKNOWN — GM_xmlhttpRequest missing'; render(); return;
        }
        GM_xmlhttpRequest({
            method: 'GET', url: NON2XX_401, timeout: 15000,
            onload: function (r) {
                VERDICT = (r.status === 401)
                    ? 'FIXED BRIDGE — a 401 reached onload with its status (0.11.305+)'
                    : 'onload fired with status ' + r.status + ' (expected 401)';
                record('GM_xhr   → 401 endpoint', 'onload status=' + r.status + '  <-- correct');
            },
            onerror: function (e) {
                VERDICT = 'OLD BRIDGE — a 401 was routed to onerror; update to 0.11.305+';
                record('GM_xhr   → 401 endpoint', 'onerror ' + safeJson(e) + '  <-- the bug');
            },
            ontimeout: function () { record('GM_xhr   → 401 endpoint', 'TIMEOUT'); }
        });
        GM_xmlhttpRequest({
            method: 'GET', url: NON2XX_404, timeout: 15000,
            onload: function (r) { record('GM_xhr   → 404 endpoint', 'onload status=' + r.status + '  <-- correct'); },
            onerror: function (e) { record('GM_xhr   → 404 endpoint', 'onerror ' + safeJson(e) + '  <-- the bug'); }
        });
    }

    // A POST through the bridge, shaped like the one that is failing.
    function viaGMPost(label) {
        if (typeof GM_xmlhttpRequest !== 'function') {
            record(label, 'GM_xmlhttpRequest is not a function'); return;
        }
        var t = Date.now();
        try {
            GM_xmlhttpRequest({
                method: 'POST', url: POST_URL,
                headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
                data: POST_BODY, timeout: 15000,
                onload: function (r) {
                    record(label, 'onload status=' + r.status + ' in ' + (Date.now() - t) + 'ms' +
                        (r.status === 422 ? '  <-- POST WORKS' : '') +
                        ' body=' + (r.responseText || '').slice(0, 70));
                },
                onerror: function (e) {
                    record(label, 'onerror ' + safeJson(e) + ' after ' + (Date.now() - t) +
                        'ms  <-- POST IS BROKEN');
                },
                ontimeout: function () {
                    record(label, 'TIMEOUT after ' + (Date.now() - t) + 'ms  <-- POST IS BROKEN');
                }
            });
        } catch (err) { record(label, 'THREW ' + (err && err.message) + '  <-- POST IS BROKEN'); }
    }

    // KAL's exact request, end to end, minus a real key.
    function viaGMPostFull(label) {
        if (typeof GM_xmlhttpRequest !== 'function') { record(label, 'no GM_xhr'); return; }
        var t = Date.now();
        GM_xmlhttpRequest({
            method: 'POST', url: POST_URL,
            headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
            data: POST_BODY_FULL, timeout: 15000,
            onload: function (r) {
                record(label, 'onload status=' + r.status + ' in ' + (Date.now() - t) + 'ms' +
                    '  <-- FULL PAYLOAD WORKS  body=' + (r.responseText || '').slice(0, 80));
            },
            onerror: function (e) {
                record(label, 'onerror ' + safeJson(e) + '  <-- FULL PAYLOAD FAILS');
            },
            ontimeout: function () {
                record(label, 'TIMEOUT after ' + (Date.now() - t) + 'ms  <-- FULL PAYLOAD FAILS');
            }
        });
    }

    // ── The four ways a script might make the same call ───────────

    function viaGM(label, url) {
        if (typeof GM_xmlhttpRequest !== 'function') {
            record(label, 'GM_xmlhttpRequest is not a function (' + typeof GM_xmlhttpRequest + ')');
            return;
        }
        var t = Date.now();
        try {
            GM_xmlhttpRequest({
                method: 'GET', url: url, timeout: 15000,
                onload: function (r) {
                    record(label, 'OK status=' + r.status + ' in ' + (Date.now() - t) + 'ms' +
                        ' len=' + ((r.responseText || '').length));
                },
                // The bridge omits `status` entirely on a native error, where
                // Tampermonkey sets 0 — so print the whole object rather than
                // one field, or the interesting case reads as blank.
                onerror: function (e) {
                    record(label, 'ERROR ' + safeJson(e) + ' after ' + (Date.now() - t) + 'ms');
                },
                ontimeout: function () { record(label, 'TIMEOUT after ' + (Date.now() - t) + 'ms'); }
            });
        } catch (err) {
            record(label, 'THREW ' + (err && err.message));
        }
    }

    function viaGMObject(label, url) {
        var fn = (typeof GM !== 'undefined' && GM && GM.xmlHttpRequest) ? GM.xmlHttpRequest : null;
        if (!fn) { record(label, 'GM.xmlHttpRequest absent'); return; }
        try {
            fn({ method: 'GET', url: url, timeout: 15000,
                onload: function (r) { record(label, 'OK status=' + r.status); },
                onerror: function (e) { record(label, 'ERROR ' + safeJson(e)); } });
        } catch (err) { record(label, 'THREW ' + (err && err.message)); }
    }

    // The comparison that identifies the symptom. A page-context fetch to a
    // third-party host without permissive CORS headers rejects with a
    // TypeError and no status — which is what "status 0" means when a script
    // reports it. Seeing this succeed where GM fails, or vice versa, is the
    // answer.
    function viaFetch(label, url) {
        var t = Date.now();
        fetch(url, { method: 'GET' })
            .then(function (r) { record(label, 'OK status=' + r.status + ' in ' + (Date.now() - t) + 'ms'); })
            .catch(function (e) {
                record(label, 'BLOCKED ' + (e && e.name) + ': ' + (e && e.message) +
                    ' — this is what surfaces as "status 0"');
            });
    }

    function viaXHR(label, url) {
        try {
            var x = new XMLHttpRequest();
            x.open('GET', url, true);
            x.timeout = 15000;
            x.onload = function () { record(label, 'OK status=' + x.status); };
            // A CORS-blocked XHR fires onerror with status LITERALLY 0. This is
            // the line that reproduces the reported symptom exactly.
            x.onerror = function () { record(label, 'ERROR status=' + x.status + ' (0 = CORS-blocked)'); };
            x.ontimeout = function () { record(label, 'TIMEOUT'); };
            x.send();
        } catch (err) { record(label, 'THREW ' + (err && err.message)); }
    }

    function safeJson(o) {
        try {
            if (o == null) return String(o);
            if (typeof o !== 'object') return String(o);
            var out = {};
            for (var k in o) { if (typeof o[k] !== 'function') out[k] = o[k]; }
            var s = JSON.stringify(out);
            return (s === '{}') ? ('(empty object, keys: ' + Object.keys(o).join(',') + ')') : s;
        } catch (e) { return '(unserialisable)'; }
    }

    // ── Output, on screen ─────────────────────────────────────────
    // There is no console to read on an iOS webview, so the report has to be
    // part of the page and copyable in one tap.

    var panel, body;
    function build() {
        if (panel || !document.body) return;
        panel = document.createElement('div');
        panel.style.cssText = 'position:fixed;left:8px;right:8px;bottom:8px;z-index:2147483600;' +
            'background:#0d141d;color:#dde5ed;border:1px solid #1c2a38;border-radius:10px;' +
            'padding:12px;font:12px/1.45 ui-monospace,Menlo,monospace;max-height:62vh;overflow:auto;' +
            'box-shadow:0 10px 30px rgba(0,0,0,.5)';
        panel.innerHTML =
            '<div style="display:flex;gap:8px;align-items:center;margin-bottom:8px">' +
            '<b style="color:#9fe870">GM XHR Probe ' + SCRIPT_VERSION + '</b>' +
            '<button id="gmp-copy" style="margin-left:auto;background:#9fe870;color:#08120a;border:0;' +
            'border-radius:5px;padding:5px 10px;font:600 12px ui-monospace,monospace">Copy</button>' +
            '<button id="gmp-x" style="background:#1c2a38;color:#dde5ed;border:0;border-radius:5px;' +
            'padding:5px 9px;font:600 12px ui-monospace,monospace">×</button></div>' +
            '<div id="gmp-body"></div>';
        document.body.appendChild(panel);
        body = panel.querySelector('#gmp-body');

        panel.querySelector('#gmp-x').addEventListener('click', function () { panel.remove(); });

        // Clipboard writes only survive inside the synchronous part of a real
        // tap on this platform, so the text is built up front and the handler
        // does nothing but hand it over.
        panel.querySelector('#gmp-copy').addEventListener('click', function () {
            var text = clipCache;
            var done = false;
            if (typeof GM_setClipboard === 'function') {
                try { GM_setClipboard(text); done = true; } catch (e) {}
            }
            if (!done && navigator.clipboard && navigator.clipboard.writeText) {
                try { navigator.clipboard.writeText(text); done = true; } catch (e) {}
            }
            this.textContent = done ? 'Copied' : 'Select ↓';
            if (!done) {
                // Last resort: put it somewhere the reader can select by hand.
                var ta = document.createElement('textarea');
                ta.value = text;
                ta.style.cssText = 'width:100%;height:120px;margin-top:8px;background:#070b0f;' +
                    'color:#dde5ed;border:1px solid #1c2a38;border-radius:6px';
                body.appendChild(ta); ta.select();
            }
        });
        render();
    }

    function render() {
        if (!body) return;
        var lines = ['— bridge build —', '  ' + VERDICT, '— at injection time —'];
        for (var k in AT_INIT) lines.push('  ' + k + ': ' + AT_INIT[k]);
        lines.push('— requests —');
        results.forEach(function (r) { lines.push('  ' + r.name + ': ' + r.detail); });
        clipCache = lines.join('\n');

        body.innerHTML = '';
        lines.forEach(function (l) {
            var d = document.createElement('div');
            var head = l.charAt(0) === '—';
            d.textContent = l;
            d.style.cssText = head ? 'color:#74889b;margin:7px 0 3px' :
                (/FIXED BRIDGE/.test(l) ? 'color:#5fd39a;font-weight:700' :
                (/OLD BRIDGE/.test(l) ? 'color:#e8636f;font-weight:700' :
                (/\bOK\b|correct|POST WORKS|PAYLOAD WORKS/.test(l) ? 'color:#5fd39a' :
                (/(ERROR|BLOCKED|TIMEOUT|THREW|not a function|absent|the bug|POST IS BROKEN|PAYLOAD FAILS/.test(l) ? 'color:#e8636f' : ''))));
            body.appendChild(d);
        });
    }

    function start() {
        build();
        // Subject via every route, then the control via the two that matter.
        // Sequential enough to read, but not serialised — the timings are part
        // of the evidence.
        viaGM('GM_xhr   → kalends', SUBJECT);
        viaGMObject('GM.xhr   → kalends', SUBJECT);
        viaFetch('fetch    → kalends', SUBJECT);
        viaXHR('XHR      → kalends', SUBJECT);
        checkBridgeBuild();
        viaGMPost('GM_xhr   → POST validation-only');
        viaGMPostFull('GM_xhr   → POST full payload');
        viaGM('GM_xhr   → ffscouter (control)', CONTROL);
        viaFetch('fetch    → ffscouter (control)', CONTROL);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', start);
    } else {
        start();
    }
})();
