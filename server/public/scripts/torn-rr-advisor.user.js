// ==UserScript==
// @name         Russian Roulette Advisor
// @namespace    https://tornwar.com
// @version      0.1.0
// @description  Tells you to shoot once or twice to force the bullet onto your opponent, given which pull it fires on. Advisory only; never auto-plays.
// @author       RussianRob
// @license      GPL-3.0-or-later
// @match        https://www.torn.com/page.php?sid=russianRoulette*
// @grant        unsafeWindow
// @grant        GM_xmlhttpRequest
// @connect      tornwar.com
// @downloadURL  https://tornwar.com/scripts/torn-rr-advisor.user.js
// @updateURL    https://tornwar.com/scripts/torn-rr-advisor.meta.js
// ==/UserScript==
(function () {
    'use strict';

    const SCRIPT_VERSION = '0.1.0';
    const CHAMBERS = 6;
    const OW = (typeof unsafeWindow !== 'undefined') ? unsafeWindow : window;
    const nativeFetch = (OW.fetch || window.fetch).bind(OW);

    function chambersLeft(moves) {
        const k = CHAMBERS - (Number(moves) || 0);
        return k > 0 ? k : 0;
    }

    function fireChance(moves, shots) {
        const k = chambersLeft(moves);
        if (k <= 0) return 1;
        const p = (Number(shots) || 1) / k;
        return p > 1 ? 1 : p;
    }

    function advise(K, moves, myTurn, shotsAvailable) {
        K = Number(K) || 0;
        const R = K - (Number(moves) || 0);
        if (!K || R <= 0) return { shoot: 0, cls: 'na', text: '' };
        if (!myTurn) return { shoot: 0, cls: 'wait', text: "Opponent's move" };
        if (R === 1) return { shoot: 1, cls: 'lose', text: 'FORCED — you fire this pull' };
        const r = R % 3;
        if (r === 2) return { shoot: 1, cls: 'win', text: 'SHOOT ONCE' };
        if (r === 0) {
            if ((Number(shotsAvailable) || 1) >= 2) return { shoot: 2, cls: 'win', text: 'SHOOT TWICE' };
            return { shoot: 1, cls: 'lose', text: 'Shoot once (need 2-shot unlock to force it)' };
        }
        return { shoot: 1, cls: 'lose', text: 'Shoot once — parity against you' };
    }

    function pct(x) { return (x * 100).toFixed(0) + '%'; }

    const state = { moves: 0, whoseMove: null, shotsAvailable: 1, result: null, winner: null, creatorId: null, opponentId: null, active: false, myId: null, fatalPull: 0 };
    let lastSig = '';

    function diag(tag, data) {
        try {
            const body = JSON.stringify({ tag: tag, data: data });
            if (typeof GM_xmlhttpRequest === 'function') {
                GM_xmlhttpRequest({ method: 'POST', url: 'https://tornwar.com/api/debug/client-log', headers: { 'Content-Type': 'application/json' }, data: body });
            } else {
                nativeFetch('https://tornwar.com/api/debug/client-log', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body });
            }
        } catch (e) {}
    }

    function rotSnapshot() {
        try {
            const out = [];
            const els = document.querySelectorAll('[style*="rotate"],[style*="transform"]');
            for (let i = 0; i < els.length && out.length < 6; i++) {
                const t = els[i].style.transform || '';
                const m = t.match(/rotate[^)]*\)/);
                if (m) out.push(m[0]);
            }
            return out;
        } catch (e) { return []; }
    }

    function detectMyId() {
        if (state.myId) return state.myId;
        try {
            const sel = ['#sidebarroot a[href*="profiles.php?XID="]', '.menu-value a[href*="profiles.php?XID="]', 'a[href*="profiles.php?XID="]'];
            for (const s of sel) {
                const el = document.querySelector(s);
                const href = el && (el.getAttribute('href') || '');
                const mm = href && href.match(/XID=(\d+)/);
                if (mm) { state.myId = mm[1]; return state.myId; }
            }
        } catch (e) {}
        return null;
    }

    function findGame(o, depth) {
        if (!o || typeof o !== 'object' || (depth || 0) > 6) return null;
        if ('moves' in o && ('whoseMove' in o || 'result' in o)) return o;
        for (const k in o) {
            if (o[k] && typeof o[k] === 'object') {
                const r = findGame(o[k], (depth || 0) + 1);
                if (r) return r;
            }
        }
        return null;
    }

    function ingest(json) {
        const g = findGame(json, 0);
        if (!g) return;
        state.moves = Number(g.moves) || 0;
        state.whoseMove = g.whoseMove != null ? String(g.whoseMove) : null;
        state.shotsAvailable = Number(g.shotsAvailable) || 1;
        state.result = g.result != null ? String(g.result) : null;
        state.winner = g.winner != null ? String(g.winner) : null;
        if (g.creator && g.creator.ID != null) state.creatorId = String(g.creator.ID);
        if (g.opponent && g.opponent.ID != null) state.opponentId = String(g.opponent.ID);
        state.active = !!state.result && state.result !== 'won' && state.result !== 'lost';
        if (!state.active) state.fatalPull = 0;
        const sig = state.moves + '|' + state.whoseMove + '|' + state.result + '|' + state.winner;
        if (sig !== lastSig) {
            lastSig = sig;
            diag('rr-capture', { ev: 'state', moves: state.moves, whose: state.whoseMove, shots: state.shotsAvailable, res: state.result, win: state.winner, cr: state.creatorId, op: state.opponentId, uK: state.fatalPull, rot: rotSnapshot() });
        }
        render();
    }

    let panel;

    function ensurePanel() {
        if (panel && document.body.contains(panel)) return panel;
        panel = document.createElement('div');
        panel.id = 'rradv-panel';
        panel.style.cssText = 'position:fixed;right:12px;top:120px;z-index:99999;background:#0f1a2e;color:#e5e7eb;border:1px solid #1e3a5f;border-radius:8px;padding:12px 14px;font:13px/1.5 -apple-system,system-ui,sans-serif;min-width:210px;box-shadow:0 6px 20px rgba(0,0,0,.45)';
        (document.body || document.documentElement).appendChild(panel);
        return panel;
    }

    function setFatal(k) {
        state.fatalPull = (state.fatalPull === k) ? 0 : k;
        diag('rr-capture', { ev: 'userK', k: state.fatalPull, moves: state.moves, whose: state.whoseMove, rot: rotSnapshot() });
        render();
    }

    function fatalButtons() {
        let b = '<div style="margin:8px 0 4px;color:#9ca3af;font-size:12px">Bullet fires on pull:</div><div style="display:flex;gap:6px">';
        [3, 4, 5, 6].forEach(function (k) {
            const on = state.fatalPull === k;
            b += '<button data-k="' + k + '" style="flex:1;cursor:pointer;border:1px solid ' + (on ? '#4ade80' : '#1e3a5f') + ';background:' + (on ? '#14532d' : '#0a1420') + ';color:' + (on ? '#4ade80' : '#9ca3af') + ';border-radius:5px;padding:6px 0;font-weight:600">' + k + '</button>';
        });
        b += '</div>';
        return b;
    }

    function render() {
        const p = ensurePanel();
        const me = detectMyId();
        let html = '<div style="font-weight:700;color:#f3f4f6;margin-bottom:2px">RR ADVISOR <span style="color:#4b5563;font-weight:400;font-size:11px">v' + SCRIPT_VERSION + '</span></div>';

        if (state.result === 'won' || state.result === 'lost') {
            let msg = 'Game over';
            if (me && state.winner) msg = (state.winner === me) ? 'You won ✓' : 'You were shot';
            const col = (me && state.winner === me) ? '#4ade80' : '#ef4444';
            p.innerHTML = html + '<div style="margin:6px 0;font-weight:700;color:' + col + '">' + msg + '</div>';
            return;
        }
        if (!state.active) {
            p.innerHTML = html + '<div style="color:#6b7280;margin:6px 0">Waiting for a game…</div>';
            return;
        }

        const yourTurn = !!(me && state.whoseMove && state.whoseMove === me);
        html += '<div style="margin:4px 0;color:#9ca3af;font-size:12px">Pull #' + (state.moves + 1) + ' · ' + chambersLeft(state.moves) + ' left · ' + (yourTurn ? '<b style="color:#4ade80">your move</b>' : '<span style="color:#6b7280">their move</span>') + '</div>';
        html += fatalButtons();

        if (state.fatalPull) {
            const a = advise(state.fatalPull, state.moves, yourTurn, state.shotsAvailable);
            if (a.text) {
                const colors = { win: '#4ade80', lose: '#ef4444', wait: '#93c5fd', na: '#6b7280' };
                const c = colors[a.cls] || '#e5e7eb';
                html += '<div style="margin-top:10px;padding:8px;border-radius:6px;background:rgba(0,0,0,.25);text-align:center;font-weight:800;font-size:15px;color:' + c + '">' + a.text + '</div>';
            }
        } else {
            const one = fireChance(state.moves, 1), two = fireChance(state.moves, 2);
            html += '<div style="margin-top:8px;color:#6b7280;font-size:12px">Not sure which pull? Raw odds:</div>';
            html += '<div style="display:flex;justify-content:space-between"><span style="color:#9ca3af">shoot once</span><b style="color:' + (one >= 0.5 ? '#ef4444' : '#4ade80') + '">' + pct(one) + '</b></div>';
            if (state.shotsAvailable >= 2) html += '<div style="display:flex;justify-content:space-between"><span style="color:#9ca3af">shoot twice</span><b style="color:#fbbf24">' + pct(two) + '</b></div>';
        }
        p.innerHTML = html;
        const btns = p.querySelectorAll('button[data-k]');
        btns.forEach(function (btn) { btn.addEventListener('click', function () { setFatal(Number(btn.getAttribute('data-k'))); }); });
    }

    function hookFetch() {
        const orig = OW.fetch;
        if (typeof orig !== 'function') return;
        OW.fetch = function (input) {
            const url = (input && input.url) ? input.url : String(input || '');
            const out = orig.apply(this, arguments);
            if (url.indexOf('russianRoulette') !== -1 && url.indexOf('tornwar.com') === -1) {
                out.then(function (res) { try { res.clone().json().then(ingest).catch(function () {}); } catch (e) {} return res; }).catch(function () {});
            }
            return out;
        };
    }

    function hookXHR() {
        const X = OW.XMLHttpRequest;
        if (!X || !X.prototype) return;
        const oOpen = X.prototype.open, oSend = X.prototype.send;
        X.prototype.open = function (m, url) { this._rr = String(url || ''); return oOpen.apply(this, arguments); };
        X.prototype.send = function () {
            if (this._rr && this._rr.indexOf('russianRoulette') !== -1 && this._rr.indexOf('tornwar.com') === -1) {
                this.addEventListener('load', function () { try { ingest(JSON.parse(this.responseText)); } catch (e) {} });
            }
            return oSend.apply(this, arguments);
        };
    }

    hookFetch();
    hookXHR();
    render();
    OW.__rrAdvisor = { advise: advise, fireChance: fireChance, chambersLeft: chambersLeft, state: state, version: SCRIPT_VERSION };
})();
