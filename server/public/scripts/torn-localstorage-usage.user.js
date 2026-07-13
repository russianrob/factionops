// ==UserScript==
// @name         LocalStorage Usage
// @namespace    tornwar.com
// @version      1.0.1
// @description  Shows what is filling this origin's localStorage, largest first, with a two-tap delete so you can clear space when Torn (chat, etc.) hits QuotaExceededError. PDA-safe.
// @author       RussianRob
// @match        https://www.torn.com/*
// @grant        GM_setValue
// @grant        GM_getValue
// @license      GPL-3.0-or-later
// @downloadURL  https://tornwar.com/scripts/torn-localstorage-usage.user.js
// @updateURL    https://tornwar.com/scripts/torn-localstorage-usage.meta.js
// ==/UserScript==

(function () {
    'use strict';
    const SCRIPT_VERSION = '1.0.1';
    const BTN_POS_KEY = 'lsu_btn_pos';
    const QUOTA_KB = 5 * 1024;
    const LOCK_RE = /token|auth|session|login|csrf/i;

    function gmGet(k, d) { try { return (typeof GM_getValue === 'function') ? GM_getValue(k, d) : d; } catch (_) { return d; } }
    function gmSet(k, v) { try { if (typeof GM_setValue === 'function') GM_setValue(k, v); } catch (_) {} }

    function addStyle(css) {
        try {
            const s = document.createElement('style');
            s.textContent = css;
            (document.head || document.documentElement).appendChild(s);
        } catch (_) {}
    }

    function scan() {
        const rows = [];
        let totalChars = 0;
        for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            let v = '';
            try { v = localStorage.getItem(k) || ''; } catch (_) {}
            const chars = (k ? k.length : 0) + v.length;
            totalChars += chars;
            rows.push({ key: k, chars: chars });
        }
        rows.sort((a, b) => b.chars - a.chars);
        return { rows: rows, totalChars: totalChars };
    }

    function kb(chars) { return Math.round(chars / 1024); }
    function fmt(chars) {
        const k = chars / 1024;
        return k >= 1024 ? (k / 1024).toFixed(2) + ' MB' : Math.round(k) + ' kb';
    }

    let btn = null, overlay = null;

    function open() { render(); overlay.classList.add('open'); }
    function close() { overlay.classList.remove('open'); }

    function render() {
        const data = scan();
        overlay.querySelector('#lsu-total').textContent =
            fmt(data.totalChars) + ' / ~5 MB • ' + data.rows.length + ' keys';
        const pct = Math.min(100, Math.round(data.totalChars / 1024 / QUOTA_KB * 100));
        const bar = overlay.querySelector('#lsu-bar');
        bar.style.width = pct + '%';
        bar.style.background = pct >= 90 ? '#ff4444' : pct >= 75 ? '#ffa500' : '#4caf50';

        const list = overlay.querySelector('#lsu-list');
        list.textContent = '';
        if (!data.rows.length) {
            const e = document.createElement('div');
            e.className = 'lsu-empty';
            e.textContent = 'localStorage is empty.';
            list.appendChild(e);
            return;
        }
        const MAX_ROWS = 100;
        data.rows.slice(0, MAX_ROWS).forEach((r) => {
            const row = document.createElement('div');
            row.className = 'lsu-row';
            const name = document.createElement('span');
            name.className = 'lsu-key';
            name.textContent = r.key;
            name.title = r.key;
            const size = document.createElement('span');
            size.className = 'lsu-size';
            size.textContent = kb(r.chars) + ' kb';
            row.appendChild(name);
            row.appendChild(size);
            if (LOCK_RE.test(r.key)) {
                const lock = document.createElement('span');
                lock.className = 'lsu-lock';
                lock.textContent = '🔒';
                lock.title = 'Looks session-critical — not deletable here';
                row.appendChild(lock);
            } else {
                const del = document.createElement('button');
                del.type = 'button';
                del.className = 'lsu-del';
                del.textContent = 'Delete';
                let armed = false, tmr = null;
                del.addEventListener('click', () => {
                    if (!armed) {
                        armed = true;
                        del.textContent = 'Sure?';
                        del.classList.add('armed');
                        tmr = setTimeout(() => { armed = false; del.textContent = 'Delete'; del.classList.remove('armed'); }, 3000);
                        return;
                    }
                    if (tmr) clearTimeout(tmr);
                    try { localStorage.removeItem(r.key); } catch (_) {}
                    render();
                });
                row.appendChild(del);
            }
            list.appendChild(row);
        });
        if (data.rows.length > MAX_ROWS) {
            const more = document.createElement('div');
            more.className = 'lsu-empty';
            more.textContent = '+ ' + (data.rows.length - MAX_ROWS) + ' more smaller keys not shown';
            list.appendChild(more);
        }
    }

    function boot() {
        if (btn) return;
        addStyle(
            '#lsu-btn{position:fixed;top:120px;right:14px;z-index:2147483000;width:40px;height:40px;border:none;border-radius:50%;background:linear-gradient(135deg,#3a4a6b,#22304d);color:#fff;font-size:18px;line-height:40px;text-align:center;cursor:grab;box-shadow:0 3px 10px rgba(0,0,0,.4);touch-action:none;user-select:none;padding:0;}' +
            '#lsu-btn:active{cursor:grabbing;}' +
            '#lsu-overlay{position:fixed;inset:0;z-index:2147483001;background:rgba(6,8,12,.6);display:none;align-items:center;justify-content:center;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif;}' +
            '#lsu-overlay.open{display:flex;}' +
            '#lsu-panel{background:#14161e;color:#e6e8ef;width:92%;max-width:560px;max-height:82vh;border-radius:12px;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 10px 40px rgba(0,0,0,.6);}' +
            '#lsu-panel header{display:flex;align-items:center;gap:10px;padding:12px 14px;border-bottom:1px solid #262a36;}' +
            '#lsu-panel h2{font-size:15px;margin:0;}' +
            '#lsu-total{font-size:12px;color:#9aa3b5;flex:1 1 auto;}' +
            '#lsu-close{margin-left:auto;background:none;border:none;color:#9aa3b5;font-size:22px;line-height:1;cursor:pointer;padding:0 4px;}' +
            '#lsu-barwrap{height:6px;background:#0e1017;}' +
            '#lsu-bar{height:6px;width:0;background:#4caf50;transition:width .2s ease;}' +
            '#lsu-list{overflow-y:auto;padding:6px 0;}' +
            '.lsu-row{display:flex;align-items:center;gap:10px;padding:7px 14px;border-bottom:1px solid #1c1f2a;}' +
            '.lsu-key{flex:1 1 auto;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}' +
            '.lsu-size{flex:0 0 auto;font-size:12px;color:#9aa3b5;min-width:58px;text-align:right;}' +
            '.lsu-lock{flex:0 0 auto;font-size:13px;width:64px;text-align:center;}' +
            '.lsu-del{flex:0 0 auto;width:64px;background:#3a2030;color:#ff8a9c;border:1px solid #5a2a3c;border-radius:6px;font-size:11px;font-weight:700;padding:4px 0;cursor:pointer;}' +
            '.lsu-del.armed{background:#7a1020;color:#fff;border-color:#a01530;}' +
            '#lsu-panel footer{padding:8px 14px;font-size:10px;color:#6b7280;border-top:1px solid #262a36;}' +
            '.lsu-empty{padding:20px;text-align:center;color:#9aa3b5;}'
        );

        btn = document.createElement('button');
        btn.id = 'lsu-btn';
        btn.type = 'button';
        btn.textContent = '💾';
        btn.title = 'LocalStorage usage';
        document.body.appendChild(btn);

        const pos = gmGet(BTN_POS_KEY, null);
        if (pos && pos.left != null) { btn.style.left = pos.left; btn.style.top = pos.top; btn.style.right = 'auto'; }

        let dragging = false, moved = false, sx, sy, sl, st;
        btn.addEventListener('pointerdown', (e) => {
            dragging = true; moved = false; sx = e.clientX; sy = e.clientY;
            const r = btn.getBoundingClientRect(); sl = r.left; st = r.top;
            try { btn.setPointerCapture(e.pointerId); } catch (_) {}
        });
        btn.addEventListener('pointermove', (e) => {
            if (!dragging) return;
            const dx = e.clientX - sx, dy = e.clientY - sy;
            if (Math.abs(dx) > 4 || Math.abs(dy) > 4) moved = true;
            if (!moved) return;
            const left = Math.min(window.innerWidth - btn.offsetWidth - 4, Math.max(4, sl + dx));
            const top = Math.min(window.innerHeight - btn.offsetHeight - 4, Math.max(4, st + dy));
            btn.style.left = left + 'px'; btn.style.top = top + 'px'; btn.style.right = 'auto';
        });
        btn.addEventListener('pointerup', () => {
            dragging = false;
            if (moved) gmSet(BTN_POS_KEY, { left: btn.style.left, top: btn.style.top });
        });
        btn.addEventListener('click', (e) => {
            if (moved) { e.preventDefault(); e.stopPropagation(); moved = false; return; }
            open();
        });

        overlay = document.createElement('div');
        overlay.id = 'lsu-overlay';
        overlay.innerHTML =
            '<div id="lsu-panel">' +
            '<header><h2>LocalStorage</h2><span id="lsu-total"></span><button id="lsu-close" type="button">×</button></header>' +
            '<div id="lsu-barwrap"><div id="lsu-bar"></div></div>' +
            '<div id="lsu-list"></div>' +
            '<footer>Tap Delete twice to confirm. 🔒 = looks session-critical, left alone. v' + SCRIPT_VERSION + '</footer>' +
            '</div>';
        document.body.appendChild(overlay);
        overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
        overlay.querySelector('#lsu-close').addEventListener('click', close);
    }

    if (document.body) boot();
    else document.addEventListener('DOMContentLoaded', boot, { once: true });
})();
