// ==UserScript==
// @name         Torn Chat Probe
// @namespace    RussianRob
// @version      1.0.3
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
 * 1.0.3 - Answers whether the message id is STABLE across a reload, which is
 *         the only thing that matters now one exists. Remembers the ids it
 *         saw and counts how many survive the next load.
 *
 * 1.0.2 - A throw inside the probe now reports instead of vanishing, and the
 *         attribute selector built from a live class string is guarded.
 *
 * 1.0.1 - Census instead of selector guessing. 1.0.0 matched nothing: it
 *         tried four likely class patterns and Torn uses none of them. The
 *         message row is now found structurally - the class that repeats
 *         most often, deepest, while still carrying text - which works
 *         whatever Torn renames things to.
 *
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

    const SCRIPT_VERSION = '1.0.3';
    const TAG = 'torn-chat-probe';
    const ENDPOINT = 'https://tornwar.com/api/debug/client-log';
    // One report per device per hour. The probe answers a fixed question, so
    // repeating it on every page load is pure noise in the log.
    const REPORT_EVERY_MS = 60 * 1000;   // 1.0.1: short while we iterate

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

    // v1.0.1: stop guessing selectors. Take a CENSUS instead -- in a list of
    // messages, the message row is simply whatever class repeats most often at
    // the deepest level that still has text. That finds the row whatever Torn
    // decides to call it this week.
    function census(root) {
        const byClass = new Map();
        const ids = [];
        const all = root.querySelectorAll('*');
        for (const el of all) {
            if (el.id) ids.push(el.id);
            const c = el.className && typeof el.className === 'string' ? el.className.trim() : '';
            if (!c) continue;
            const rec = byClass.get(c) || { n: 0, depth: 0, textLen: 0, tag: el.tagName.toLowerCase() };
            rec.n += 1;
            let d = 0, cur = el;
            while (cur && cur !== root) { d += 1; cur = cur.parentElement; }
            rec.depth = d;
            rec.textLen = Math.max(rec.textLen, (el.textContent || '').length);
            byClass.set(c, rec);
        }
        // Repeated, deep, and carrying text: that is a message row.
        const ranked = [...byClass.entries()]
            .filter(([, r]) => r.n >= 3 && r.textLen > 0)
            .sort((a, b) => (b[1].n * b[1].depth) - (a[1].n * a[1].depth))
            .slice(0, 10)
            .map(([cls, r]) => ({ cls, n: r.n, depth: r.depth, tag: r.tag, maxTextLen: r.textLen }));
        return { total: all.length, ids: ids.slice(0, 25), ranked };
    }

    function probe() {
        const root = document.getElementById('chatRoot');
        if (!root) return { chatRoot: false };
        const c = census(root);

        // Best guess at the row: top of the census. Describe it and a sibling
        // so I can see what DIFFERS between two messages.
        let sample = null, prev = null, usedClass = null;
        for (const cand of c.ranked) {
            let els = [];
            // A class string straight off the page can contain anything; an
            // attribute selector built from it may throw, and a throw here
            // used to mean the probe reported nothing at all.
            try { els = root.querySelectorAll('[class="' + cand.cls.replace(/"/g, '\\"') + '"]'); }
            catch (_) { continue; }
            if (els.length >= 2) { sample = els[els.length - 1]; prev = els[els.length - 2]; usedClass = cand.cls; break; }
        }

        let timeish = null;
        if (sample) {
            const t = sample.querySelector('time, [class*="time" i], [datetime], [title]');
            if (t) timeish = describe(t);
        }

        return {
            v: SCRIPT_VERSION,
            chatRoot: true,
            nodes: c.total,
            ids: c.ids,
            ranked: c.ranked,
            usedClass,
            sample: describe(sample),
            prevSample: describe(prev),
            sampleAncestors: sample ? chain(sample.parentElement, 2) : null,
            perMessageTime: timeish,
            verdict: !sample
                ? 'NO REPEATED TEXT ROW FOUND - chat may be collapsed; open the faction channel'
                : (Object.keys(describe(sample).attrs).some((n) => VALUE_SAFE.test(n))
                    ? 'ROW CARRIES AN ID-LIKE ATTRIBUTE'
                    : (timeish ? 'NO ROW ID, but a per-message time exists (hash fallback viable)'
                               : 'NO ROW ID and NO per-message time (reactions on Torn chat not anchorable)')),
        };
    }

    // 1.0.3: the ONLY question left. The id is <uuid>:<senderId> and it is
    // unique per message -- but that is worth nothing unless two browsers
    // agree on it. A React-generated uuid would be re-rolled on every mount,
    // so the same message would carry a different id after a reload and a
    // shared reaction could never land.
    //
    // Cheap decisive test: remember the ids seen last time and count how many
    // are still present now. High overlap after a reload means the id came
    // down the wire from Torn. Zero overlap means it is minted locally.
    function stabilityCheck(ids) {
        const msgIds = ids.filter((i) => /^[0-9a-f-]{36}:\d+$/i.test(i));
        let prior = [];
        try { prior = JSON.parse(gmGet('tcp_ids', '[]')) || []; } catch (_) { prior = []; }
        gmSet('tcp_ids', JSON.stringify(msgIds.slice(0, 40)));

        if (!prior.length) return { first: true, seen: msgIds.length };
        const now = new Set(msgIds);
        const overlap = prior.filter((i) => now.has(i)).length;
        return {
            first: false,
            priorCount: prior.length,
            seen: msgIds.length,
            overlap,
            // Chat moves, so some of the old ids will legitimately have
            // scrolled out of the virtualized list. Any overlap at all is the
            // signal; zero across two runs with overlapping messages is the
            // damning one.
            readsAs: overlap > 0
                ? 'STABLE - ids survive a reload, so they come from Torn'
                : 'NO OVERLAP - either the id is client-minted, or chat turned over completely',
        };
    }

    function run() {
        const last = Number(gmGet('tcp_last', 0)) || 0;
        if (Date.now() - last < REPORT_EVERY_MS) return;

        let out;
        try { out = probe(); }
        catch (e) {
            // Silence is the worst outcome for a diagnostic: it is
            // indistinguishable from "not installed". Report the throw.
            post({ v: SCRIPT_VERSION, threw: String(e && e.message).slice(0, 300) });
            gmSet('tcp_last', String(Date.now()));
            return;
        }
        if (!out.chatRoot) return;        // chat not on this page; say nothing
        out.stability = stabilityCheck(out.ids || []);
        // The census is big and the body cap is 4kb; once the structure is
        // known the ranked list is just noise.
        out.ranked = (out.ranked || []).slice(0, 3);
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
