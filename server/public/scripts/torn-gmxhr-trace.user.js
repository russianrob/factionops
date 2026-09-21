// ==UserScript==
// @name         GM XHR Tracer
// @namespace    RussianRob
// @version      1.0.0
// @description  Wraps GM_xmlhttpRequest and records every call another userscript makes through it — method, URL, headers, body and outcome — so a failing request can be read instead of guessed at
// @author       RussianRob
// @license      GPL-3.0-or-later
// @match        https://www.torn.com/*
// @run-at       document-start
// @grant        GM_setClipboard
// ==/UserScript==

(function () {
    'use strict';

    var SCRIPT_VERSION = '1.0.0';

    // Why wrapping works here, and why it does not need to load before KAL:
    //
    // The warboard bootstrap assigns ONE GM_xmlhttpRequest onto the shared
    // window, and KAL resolves that global INSIDE apiRequest — at call time,
    // not when it loads. So replacing the global any time before the Connect
    // button is pressed is enough to see the request. Load order does not
    // matter, which is the only reason this is reliable.
    var W = (typeof unsafeWindow !== 'undefined' && unsafeWindow) ? unsafeWindow : window;

    var calls = [];
    var seq = 0;

    // The register payload carries a Torn API key, and this panel is going to
    // be screenshotted. Two keys have already leaked that way, so anything
    // key-shaped is masked to its last four before it is ever displayed.
    function redact(text) {
        if (typeof text !== 'string') return text;
        return text
            .replace(/("(?:key|apiKey|api_key|token)"\s*:\s*")([^"]{5,})(")/gi,
                function (_, a, v, b) { return a + '••••' + v.slice(-4) + b; })
            .replace(/\b([A-Za-z0-9]{12})([A-Za-z0-9]{4})\b/g, '••••••••$2');
    }

    function short(v, n) {
        var s = (typeof v === 'string') ? v : (function () {
            try { return JSON.stringify(v); } catch (e) { return String(v); }
        })();
        s = redact(s);
        return s.length > (n || 220) ? s.slice(0, n || 220) + '…' : s;
    }

    function note(entry) { calls.push(entry); render(); }

    var original = null;
    function install() {
        if (typeof W.GM_xmlhttpRequest !== 'function') return false;
        if (W.GM_xmlhttpRequest.__traced) return true;

        original = W.GM_xmlhttpRequest;
        var wrapped = function (details) {
            var d = details || {};
            var id = ++seq;
            var t0 = Date.now();
            var entry = {
                id: id,
                line: '#' + id + '  ' + (d.method || 'GET') + ' ' + String(d.url || '').slice(0, 90),
                detail: 'headers=' + short(d.headers || {}, 140) +
                        (d.data != null ? '  body=' + short(d.data, 160) : '  (no body)'),
                outcome: '… pending'
            };
            note(entry);

            // Each handler is wrapped rather than replaced, so the caller still
            // receives exactly what it would have. A tracer that swallows the
            // response would "fix" the bug by accident and teach us nothing.
            function chain(name, fmt) {
                var user = d[name];
                d[name] = function (res) {
                    entry.outcome = fmt(res) + '  (' + (Date.now() - t0) + 'ms)';
                    render();
                    if (typeof user === 'function') return user.apply(this, arguments);
                };
            }
            chain('onload', function (r) {
                return 'onload status=' + (r && r.status) + ' body=' + short(r && r.responseText, 200);
            });
            chain('onerror', function (r) {
                return 'ONERROR ' + short(r, 200);
            });
            chain('ontimeout', function () { return 'ONTIMEOUT'; });

            try {
                return original.call(this, d);
            } catch (err) {
                entry.outcome = 'THREW ' + (err && err.message);
                render();
                throw err;
            }
        };
        wrapped.__traced = true;
        W.GM_xmlhttpRequest = wrapped;
        // GM.xmlHttpRequest holds its own reference to the original, so point
        // it at the wrapper too or a caller using the GM4 style slips past.
        if (W.GM && typeof W.GM.xmlHttpRequest === 'function') W.GM.xmlHttpRequest = wrapped;
        return true;
    }

    var installed = install();
    // The bootstrap may not have run yet at document-start. Keep trying briefly
    // rather than giving up on the first miss.
    if (!installed) {
        var tries = 0;
        var iv = setInterval(function () {
            if (install() || ++tries > 100) clearInterval(iv);
        }, 50);
    }

    // ── panel ─────────────────────────────────────────────────────
    var panel, body, clip = '';

    function render() {
        if (!body) return;
        var lines = ['— GM_xmlhttpRequest calls intercepted: ' + calls.length + ' —'];
        if (!calls.length) {
            lines.push('  nothing yet. Press Connect in KAL.');
            lines.push('  If this stays at 0 after pressing it, KAL never reached');
            lines.push('  GM_xmlhttpRequest at all — which is itself the answer.');
        }
        calls.forEach(function (c) {
            lines.push(c.line); lines.push('    ' + c.detail); lines.push('    -> ' + c.outcome);
        });
        clip = lines.join('\n');
        body.innerHTML = '';
        lines.forEach(function (l) {
            var d = document.createElement('div');
            d.textContent = l;
            d.style.cssText = (l.charAt(0) === '—') ? 'color:#74889b;margin:6px 0 3px' :
                (/ONERROR|ONTIMEOUT|THREW/.test(l) ? 'color:#e8636f' :
                (/onload status=2/.test(l) ? 'color:#5fd39a' :
                (/^#/.test(l) ? 'color:#dde5ed;margin-top:6px' : 'color:#9aa8b8')));
            body.appendChild(d);
        });
    }

    function build() {
        if (panel || !document.body) return;
        panel = document.createElement('div');
        panel.style.cssText = 'position:fixed;left:8px;right:8px;bottom:8px;z-index:2147483600;' +
            'background:#0d141d;color:#dde5ed;border:1px solid #1c2a38;border-radius:10px;padding:12px;' +
            'font:11px/1.45 ui-monospace,Menlo,monospace;max-height:55vh;overflow:auto;' +
            'box-shadow:0 10px 30px rgba(0,0,0,.5)';
        panel.innerHTML = '<div style="display:flex;gap:8px;align-items:center;margin-bottom:6px">' +
            '<b style="color:#9fe870">GM XHR Tracer ' + SCRIPT_VERSION + '</b>' +
            '<button id="gmt-copy" style="margin-left:auto;background:#9fe870;color:#08120a;border:0;' +
            'border-radius:5px;padding:5px 10px;font:600 11px ui-monospace,monospace">Copy</button>' +
            '<button id="gmt-x" style="background:#1c2a38;color:#dde5ed;border:0;border-radius:5px;' +
            'padding:5px 9px;font:600 11px ui-monospace,monospace">×</button></div><div id="gmt-body"></div>';
        document.body.appendChild(panel);
        body = panel.querySelector('#gmt-body');
        panel.querySelector('#gmt-x').addEventListener('click', function () { panel.remove(); });
        panel.querySelector('#gmt-copy').addEventListener('click', function () {
            var ok = false;
            if (typeof GM_setClipboard === 'function') { try { GM_setClipboard(clip); ok = true; } catch (e) {} }
            if (!ok && navigator.clipboard) { try { navigator.clipboard.writeText(clip); ok = true; } catch (e) {} }
            this.textContent = ok ? 'Copied' : 'Select';
            if (!ok) {
                var ta = document.createElement('textarea');
                ta.value = clip;
                ta.style.cssText = 'width:100%;height:110px;margin-top:6px;background:#070b0f;color:#dde5ed';
                body.appendChild(ta); ta.select();
            }
        });
        render();
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build);
    else build();
})();
