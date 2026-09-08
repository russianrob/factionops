// ==UserScript==
// @name         Torn Elimination Revives
// @namespace    aaronpmc.elim.revives
// @version      1.0.0
// @description  Shows which Elimination team members have revives on (API revivable flag), badged per row.
// @author       AaronPMC
// @match        https://www.torn.com/page.php?sid=elimination*
// @match        https://torn.com/page.php?sid=elimination*
// @grant        GM_getValue
// @grant        GM_setValue
// @run-at       document-idle
// ==/UserScript==

(function () {
    'use strict';

    // --- config ---
    const REQ_SPACING_MS = 750;          // ~80 calls/min ceiling; cap is 100/min
    const CACHE_TTL_MS   = 3 * 60 * 60 * 1000; // 3h — revive setting rarely changes
    const RESCAN_MS      = 2000;         // re-apply badges React may have wiped
    const OWN_KEY_STORE  = 'elim_revive_apikey';

    // uid -> { revivable: 0|1|null, at: ts }
    const results = new Map();
    const queued  = new Set();   // uids awaiting fetch
    const queue   = [];          // uids in fetch order
    let draining  = false;

    // ---- API key resolution --------------------------------------------------
    // GM storage is per-script, so FactionOps' key may not be readable here.
    // Try our own store, then FactionOps' GM key, then its localStorage mirror.
    function resolveKey() {
        try { const k = GM_getValue(OWN_KEY_STORE, ''); if (k) return String(k); } catch (_) {}
        try { const k = GM_getValue('factionops_apikey', ''); if (k) return String(k); } catch (_) {}
        try {
            const raw = localStorage.getItem('fo:factionops_apikey');
            if (raw) { const v = JSON.parse(raw); if (v) return String(v); }
        } catch (_) {}
        return '';
    }

    function promptForKey() {
        const k = window.prompt(
            'Elimination Revives — paste a Torn API key (Limited is fine).\n' +
            'Stored only in this browser.');
        if (k && k.trim()) {
            try { GM_setValue(OWN_KEY_STORE, k.trim()); } catch (_) {}
            return k.trim();
        }
        return '';
    }

    // ---- persistent cache (GM) ----------------------------------------------
    function loadCache() {
        try {
            const raw = GM_getValue('elim_revive_cache', '');
            if (!raw) return;
            const obj = JSON.parse(raw);
            const now = Date.now();
            for (const [uid, e] of Object.entries(obj)) {
                if (e && typeof e.at === 'number' && (now - e.at) < CACHE_TTL_MS) {
                    results.set(String(uid), { revivable: e.revivable, at: e.at });
                }
            }
        } catch (_) {}
    }
    let saveTimer = null;
    function saveCacheSoon() {
        if (saveTimer) return;
        saveTimer = setTimeout(() => {
            saveTimer = null;
            const obj = {};
            for (const [uid, e] of results.entries()) {
                if (e.revivable === 0 || e.revivable === 1) obj[uid] = e;
            }
            try { GM_setValue('elim_revive_cache', JSON.stringify(obj)); } catch (_) {}
        }, 1500);
    }

    // ---- styles --------------------------------------------------------------
    (function injectCss() {
        const css = `
        .er-badge{display:inline-flex;align-items:center;gap:3px;margin-left:6px;
            padding:1px 6px;border-radius:9px;font:700 9px/1.4 Arial,sans-serif;
            letter-spacing:.03em;white-space:nowrap;vertical-align:middle;}
        .er-on{background:rgba(0,184,148,.18);color:#00b894;border:1px solid rgba(0,184,148,.45);}
        .er-off{background:rgba(225,112,85,.16);color:#e17055;border:1px solid rgba(225,112,85,.4);}
        .er-unk{background:rgba(99,110,114,.18);color:#b2bec3;border:1px solid rgba(99,110,114,.4);}
        #er-status{position:fixed;left:10px;bottom:10px;z-index:2147483000;
            background:#14100e;color:#ffd9c9;border:1px solid rgba(225,112,85,.5);
            border-radius:6px;padding:6px 10px;font:600 11px/1.3 Arial,sans-serif;
            box-shadow:0 6px 20px rgba(0,0,0,.5);cursor:pointer;}
        #er-status b{color:#00b894;}`;
        const s = document.createElement('style');
        s.textContent = css;
        (document.head || document.documentElement).appendChild(s);
    })();

    function statusEl() {
        let el = document.getElementById('er-status');
        if (!el) {
            el = document.createElement('div');
            el.id = 'er-status';
            el.title = 'Tap to set/replace the API key';
            el.addEventListener('click', () => {
                const k = promptForKey();
                if (k) { drain(); }
            });
            document.body.appendChild(el);
        }
        return el;
    }
    function updateStatus() {
        const rows = document.querySelectorAll('[class*="teamPageWrapper"] a[href*="profiles.php?XID="]');
        const total = rows.length;
        let checked = 0, on = 0;
        results.forEach((e) => {
            if (e.revivable === 0 || e.revivable === 1) { checked++; if (e.revivable === 1) on++; }
        });
        const el = statusEl();
        el.innerHTML = 'Revives: ' + checked + '/' + total + ' checked · <b>' + on + ' on</b>';
    }

    // ---- fetch queue ---------------------------------------------------------
    function enqueue(uid) {
        if (queued.has(uid)) return;
        const cached = results.get(uid);
        if (cached && (cached.revivable === 0 || cached.revivable === 1)) return;
        queued.add(uid);
        queue.push(uid);
        drain();
    }

    function drain() {
        if (draining) return;
        draining = true;
        step();
    }

    function step() {
        if (queue.length === 0) { draining = false; return; }
        const key = resolveKey();
        if (!key) {
            // Leave everything queued; user can tap the status pill to set a key.
            draining = false;
            statusEl().innerHTML = 'Revives: set API key \u2192 tap here';
            return;
        }
        const uid = queue.shift();
        const url = 'https://api.torn.com/user/' + encodeURIComponent(uid) +
            '?selections=profile&comment=ElimRevive&key=' + encodeURIComponent(key);

        fetch(url)
            .then((r) => r.json())
            .then((data) => {
                if (data && data.error) {
                    // 5 = too many requests: back off and requeue.
                    if (data.error.code === 5) {
                        queue.unshift(uid);
                        setTimeout(step, 5000);
                        return;
                    }
                    // 2 = incorrect key: stop and prompt.
                    results.set(uid, { revivable: null, at: Date.now() });
                    applyForUid(uid);
                    if (data.error.code === 2) {
                        statusEl().innerHTML = 'Revives: invalid key \u2192 tap here';
                    }
                    setTimeout(step, REQ_SPACING_MS);
                    return;
                }
                const rev = (data && (data.revivable === 1 || data.revivable === true)) ? 1
                          : (data && (data.revivable === 0 || data.revivable === false)) ? 0
                          : null;
                results.set(uid, { revivable: rev, at: Date.now() });
                queued.delete(uid);
                applyForUid(uid);
                updateStatus();
                saveCacheSoon();
            })
            .catch(() => {
                results.set(uid, { revivable: null, at: Date.now() });
                applyForUid(uid);
            })
            .finally(() => {
                setTimeout(step, REQ_SPACING_MS);
            });
    }

    // ---- DOM badging ---------------------------------------------------------
    function uidFromAnchor(a) {
        const m = String(a.getAttribute('href') || '').match(/XID=(\d+)/);
        return m ? m[1] : null;
    }

    function badgeFor(rev) {
        const b = document.createElement('span');
        b.className = 'er-badge ' + (rev === 1 ? 'er-on' : rev === 0 ? 'er-off' : 'er-unk');
        b.textContent = rev === 1 ? 'REVIVES ON' : rev === 0 ? 'revives off' : 'revive ?';
        b.setAttribute('data-er', '1');
        return b;
    }

    function applyToAnchor(a) {
        const uid = uidFromAnchor(a);
        if (!uid) return;
        const e = results.get(uid);
        const rev = e ? e.revivable : undefined;

        // Remove any stale badge we placed, then (re)add current state.
        const next = a.nextElementSibling;
        if (next && next.getAttribute && next.getAttribute('data-er') === '1') next.remove();

        if (rev === 0 || rev === 1) {
            a.insertAdjacentElement('afterend', badgeFor(rev));
        } else {
            // pending: show a placeholder so the row shows it's being checked
            a.insertAdjacentElement('afterend', badgeFor(undefined));
            enqueue(uid);
        }
    }

    function applyForUid(uid) {
        const rows = document.querySelectorAll('[class*="teamPageWrapper"] a[href*="profiles.php?XID=' + uid + '"]');
        rows.forEach(applyToAnchor);
    }

    function scan() {
        const wrap = document.querySelector('[class*="teamPageWrapper"]');
        if (!wrap) return;
        const anchors = wrap.querySelectorAll('a[href*="profiles.php?XID="]');
        if (!anchors.length) return;
        anchors.forEach(applyToAnchor);
        updateStatus();
    }

    // ---- boot ----------------------------------------------------------------
    loadCache();
    // The elimination app is React + hash-routed; poll rather than rely on one paint.
    setInterval(scan, RESCAN_MS);
    scan();
})();