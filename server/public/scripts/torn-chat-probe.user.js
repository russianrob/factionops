// ==UserScript==
// @name         Torn Chat Probe
// @namespace    RussianRob
// @version      1.0.0
// @description  One-shot diagnostic: reports the STRUCTURE of Torn chat messages so we can tell whether a message carries a stable id worth anchoring an emoji reaction to. Reports no message text at all.
// @author       RussianRob
// @license      GPL-3.0-or-later
// @match        https://www.torn.com/*
// @noframes
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_xmlhttpRequest
// @connect      tornwar.com
// @run-at       document-idle
// @downloadURL  https://tornwar.com/scripts/torn-chat-probe.user.js
// @updateURL    https://tornwar.com/scripts/torn-chat-probe.meta.js
// ==/UserScript==

/*
 * CHANGELOG
 * 1.0.0 - First cut. Answers one question: does a Torn chat message carry an
 *         id that two different browsers would independently agree on?
 *
 *         That decides whether emoji reactions on Torn's chat are coherent at
 *         all. A reaction has to attach to a MESSAGE, so every client needs
 *         the same name for it. Torn's own id would be ideal; a hash of
 *         author+text+time works only if a per-message time exists in the DOM;
 *         a position index is useless because it shifts on every new message.
 */

(function () {
    'use strict';

    const SCRIPT_VERSION = '1.0.0';
    const TAG = 'torn-chat-probe';
    const ENDPOINT = 'https://tornwar.com/api/debug/client-log';
    // One report per device per hour. The probe answers a fixed question, so
    // repeating it on every page load is pure noise in the log.
    const REPORT_EVERY_MS = 60 * 60 * 1000;

    // Every GM_* is typeof-guarded: GMforPDA defines only a subset, and an
    // unguarded reference aborts the whole script before anything runs.
    function gmGet(k, d) {
        try { return typeof GM_getValue === 'function' ? GM_getValue(k, d) : d; } catch (_) { return d; }
    }
    function gmSet(k, v) {
        try { if (typeof GM_setValue === 'function') GM_setValue(k, v); } catch (_) { /* ignore */ }
    }

    function post(data) {
        const body = JSON.stringify({ tag: TAG, data });
        // GM_xmlhttpRequest, not fetch: Torn's CSP blocks a page-context
        // request to tornwar.com.
        if (typeof GM_xmlhttpRequest === 'function') {
            GM_xmlhttpRequest({
                method: 'POST', url: ENDPOINT,
                headers: { 'Content-Type': 'application/json' },
                data: body,
            });
            return;
        }
        try { fetch(ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body }); }
        catch (_) { /* nothing else to try */ }
    }

    // Attribute VALUES are only reported when the attribute name looks like it
    // could carry an identity or a timestamp. Everything else reports the name
    // alone, because a title= or aria-label= on a chat row can contain the
    // message itself and this probe must not ship faction chat to a log.
    const VALUE_SAFE = /(^|[-_])(id|key|uid|guid|hash|seq|index|time|ts|date|at)([-_]|$)/i;

    function describe(el) {
        if (!el) return null;
        const attrs = {};
        for (const a of el.attributes) {
            attrs[a.name] = VALUE_SAFE.test(a.name) ? String(a.value).slice(0, 60) : '<redacted>';
        }
        return {
            tag: el.tagName.toLowerCase(),
            // FULL className, never sliced. A truncated class once shipped a
            // selector that matched nothing.
            cls: el.className ? String(el.className) : '',
            attrs,
            textLen: (el.textContent || '').length,
        };
    }

    function chain(el, depth) {
        const out = [];
        let cur = el;
        for (let i = 0; i < depth && cur; i++) { out.push(describe(cur)); cur = cur.parentElement; }
        return out;
    }

    function probe() {
        const root = document.getElementById('chatRoot');
        if (!root) return { chatRoot: false };

        // The faction channel box, by the same selectors factionops uses.
        const box = root.querySelector('[id="faction"]')
            || root.querySelector('[id^="faction-"]')
            || null;

        // A message row is not reliably classed, so try the likely shapes and
        // report which one matched rather than assuming.
        const CANDIDATES = [
            '[class*="message" i]',
            '[class*="chat-box-message" i]',
            '[class*="messageWrapper" i]',
            'li',
        ];
        let rows = [], matched = null;
        const scope = box || root;
        for (const sel of CANDIDATES) {
            const found = scope.querySelectorAll(sel);
            if (found.length >= 2) { rows = [...found]; matched = sel; break; }
        }

        const sample = rows.length ? rows[rows.length - 1] : null;
        // Two rows, because the question is whether anything DIFFERS between
        // them in a way that identifies the message.
        const prev = rows.length > 1 ? rows[rows.length - 2] : null;

        // Does anything inside a row look like a per-message timestamp? Without
        // one, author+text is not unique: the same person posting "k" twice
        // collides, and the fallback hash scheme dies here.
        let timeish = null;
        if (sample) {
            const t = sample.querySelector('time, [class*="time" i], [datetime], [title*=":"]');
            if (t) timeish = describe(t);
        }

        return {
            v: SCRIPT_VERSION,
            chatRoot: true,
            boxFound: Boolean(box),
            matchedSelector: matched,
            rowCount: rows.length,
            sample: describe(sample),
            prevSample: describe(prev),
            sampleAncestors: sample ? chain(sample.parentElement, 3) : null,
            perMessageTime: timeish,
            // The actual verdict, computed here so the log line is readable
            // without me re-deriving it.
            verdict: !sample
                ? 'NO ROWS MATCHED - selectors need widening'
                : (Object.keys(describe(sample).attrs).some((n) => VALUE_SAFE.test(n))
                    ? 'ROW CARRIES AN ID-LIKE ATTRIBUTE'
                    : (timeish ? 'NO ROW ID, but a per-message time exists (hash fallback viable)'
                               : 'NO ROW ID and NO per-message time (reactions on Torn chat not anchorable)')),
        };
    }

    function run() {
        const last = Number(gmGet('tcp_last', 0)) || 0;
        if (Date.now() - last < REPORT_EVERY_MS) return;

        const out = probe();
        if (!out.chatRoot) return;        // chat not on this page; say nothing
        gmSet('tcp_last', String(Date.now()));
        post(out);

        // Visible confirmation. Without it there is no way to tell the probe
        // ran, and "nothing happened" is indistinguishable from "it is broken".
        const n = document.createElement('div');
        n.textContent = 'Chat probe sent: ' + out.verdict;
        n.style.cssText = 'position:fixed;bottom:12px;left:12px;z-index:2147483647;'
            + 'background:#0f1a2e;color:#9fe870;border:1px solid #1e3a5f;border-radius:6px;'
            + 'padding:8px 12px;font:12px/1.4 Arial,sans-serif;max-width:360px';
        document.body.appendChild(n);
        setTimeout(() => n.remove(), 12000);
    }

    // Chat renders well after document-idle, and the channel has to be opened
    // at least once for its box to exist. Retry a few times rather than firing
    // once into an empty DOM.
    let tries = 0;
    const timer = setInterval(() => {
        tries += 1;
        const root = document.getElementById('chatRoot');
        if (root && root.querySelectorAll('*').length > 30) { clearInterval(timer); run(); }
        else if (tries >= 20) clearInterval(timer);
    }, 1500);
})();
