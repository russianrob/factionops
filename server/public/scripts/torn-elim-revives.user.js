// ==UserScript==
// @name         Torn Elimination Revives
// @namespace    aaronpmc.elim.revives
// @version      1.0.2
// @description  Shows which Elimination team members have revives on (API revivable flag), badged per row, with a copy-paste list.
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
    const REQ_SPACING_MS  = 1500;               // ~40 calls/min; leaves headroom under 100/min
    const CACHE_TTL_MS    = 3 * 60 * 60 * 1000; // 3h — revive setting rarely changes
    const NULL_RETRY_MS   = 10 * 60 * 1000;     // don't re-fetch a failed/unknown lookup for 10 min
    const RATE_PAUSE_MS   = 60 * 1000;          // full-queue backoff when Torn throttles
    const RESCAN_MS       = 2000;               // re-apply badges React may have wiped
    const OWN_KEY_STORE   = 'elim_revive_apikey';

    // uid -> { revivable: 0|1|null, name: string|null, at: ts }
    const results = new Map();
    const roster  = new Map();   // uid -> name, scoped to the current team
    const queued  = new Set();
    const queue   = [];
    let draining  = false;
    let pauseUntil = 0;          // wall-clock; queue is idle until then

    function currentTeamId() {
        const m = String(location.hash || '').match(/team\/(\d+)/);
        return m ? m[1] : '';
    }
    let teamId = currentTeamId();

    // ---- API key resolution --------------------------------------------------
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
        if (k && k.trim()) { try { GM_setValue(OWN_KEY_STORE, k.trim()); } catch (_) {} return k.trim(); }
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
                    results.set(String(uid), { revivable: e.revivable, name: e.name || null, at: e.at });
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
            border-radius:6px;padding:6px 8px;font:600 11px/1.3 Arial,sans-serif;
            box-shadow:0 6px 20px rgba(0,0,0,.5);display:flex;align-items:center;gap:8px;}
        #er-status b{color:#00b894;}
        .er-btn{cursor:pointer;border:1px solid rgba(225,112,85,.5);border-radius:4px;
            background:rgba(0,0,0,.35);color:#ff9a72;font:700 11px/1 Arial,sans-serif;
            padding:5px 7px;white-space:nowrap;}
        .er-btn:hover{background:#241a15;}
        #er-copy{position:fixed;left:10px;bottom:52px;z-index:2147483001;width:280px;max-width:92vw;
            background:#14100e;color:#ffd9c9;border:1px solid rgba(225,112,85,.6);border-radius:8px;
            padding:10px;box-shadow:0 8px 26px rgba(0,0,0,.6);font:600 11px/1.3 Arial,sans-serif;}
        #er-copy h4{margin:0 0 6px;font-size:12px;color:#00b894;}
        #er-copy textarea{width:100%;height:180px;box-sizing:border-box;resize:vertical;
            background:rgba(0,0,0,.35);color:#ffd9c9;border:1px solid rgba(225,112,85,.35);
            border-radius:4px;font:12px/1.4 monospace;padding:6px;}
        #er-copy .er-row{display:flex;gap:6px;margin-top:8px;}`;
        const s = document.createElement('style');
        s.textContent = css;
        (document.head || document.documentElement).appendChild(s);
    })();

    // ---- status pill ---------------------------------------------------------
    function ensureStatus() {
        let el = document.getElementById('er-status');
        if (!el) {
            el = document.createElement('div');
            el.id = 'er-status';
            el.innerHTML =
                '<span id="er-text">Revives: \u2026</span>' +
                '<button class="er-btn" id="er-copy-btn" title="Copy revives-on list">\uD83D\uDCCB Copy ON</button>' +
                '<button class="er-btn" id="er-key-btn" title="Set / replace API key">\uD83D\uDD11</button>';
            document.body.appendChild(el);
            el.querySelector('#er-key-btn').addEventListener('click', () => { if (promptForKey()) drain(); });
            el.querySelector('#er-copy-btn').addEventListener('click', openCopyPanel);
        }
        return el;
    }
    function setText(html) {
        const t = ensureStatus().querySelector('#er-text');
        if (t) t.innerHTML = html;
    }
    function updateStatus() {
        if (Date.now() < pauseUntil) {
            setText('rate-limited \u2014 pausing ' + Math.ceil((pauseUntil - Date.now()) / 1000) + 's');
            return;
        }
        let total = roster.size, checked = 0, on = 0;
        roster.forEach((_n, uid) => {
            const e = results.get(uid);
            if (e && (e.revivable === 0 || e.revivable === 1)) { checked++; if (e.revivable === 1) on++; }
        });
        setText('<b>' + on + '</b> revives on \u00b7 ' + checked + '/' + total + ' checked');
    }

    // ---- copy-paste list -----------------------------------------------------
    function buildOnList() {
        const arr = [];
        roster.forEach((name, uid) => {
            const e = results.get(uid);
            if (e && e.revivable === 1) arr.push({ name: (e.name || name || ('#' + uid)), uid });
        });
        arr.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
        return arr.map((x) => x.name + ' [' + x.uid + ']').join('\n');
    }
    function openCopyPanel() {
        const old = document.getElementById('er-copy');
        if (old) old.remove();
        const list = buildOnList();
        const panel = document.createElement('div');
        panel.id = 'er-copy';
        panel.innerHTML =
            '<h4>Revives ON (' + (list ? list.split('\n').length : 0) + ')</h4>' +
            '<textarea readonly></textarea>' +
            '<div class="er-row">' +
                '<button class="er-btn" id="er-copy-do" style="flex:1;">Copy</button>' +
                '<button class="er-btn" id="er-copy-close">Close</button>' +
            '</div>';
        document.body.appendChild(panel);
        const ta = panel.querySelector('textarea');
        ta.value = list || '(none checked yet — let the list finish scanning)';
        ta.focus(); ta.select();
        panel.querySelector('#er-copy-close').addEventListener('click', () => panel.remove());
        panel.querySelector('#er-copy-do').addEventListener('click', () => {
            ta.focus(); ta.select();
            const done = () => { const b = panel.querySelector('#er-copy-do'); b.textContent = 'Copied!'; setTimeout(() => { b.textContent = 'Copy'; }, 1500); };
            try {
                if (navigator.clipboard && navigator.clipboard.writeText) {
                    navigator.clipboard.writeText(ta.value).then(done, () => { try { document.execCommand('copy'); done(); } catch (_) {} });
                    return;
                }
            } catch (_) {}
            try { document.execCommand('copy'); done(); } catch (_) {}
        });
    }

    // ---- fetch queue ---------------------------------------------------------
    function enqueue(uid) {
        if (queued.has(uid)) return;
        const c = results.get(uid);
        if (c) {
            if (c.revivable === 0 || c.revivable === 1) return;      // resolved — done
            if ((Date.now() - c.at) < NULL_RETRY_MS) return;         // failed recently — wait, don't hammer
        }
        queued.add(uid);
        queue.push(uid);
        drain();
    }
    function drain() { if (draining) return; draining = true; step(); }

    // Full-queue backoff: Torn is throttling us, so stop firing for a while.
    function rateBackoff(uid) {
        pauseUntil = Date.now() + RATE_PAUSE_MS;
        if (uid != null) queue.unshift(uid);   // keep it (still in `queued`) to retry after the pause
        updateStatus();
    }

    function step() {
        if (queue.length === 0) { draining = false; return; }
        if (Date.now() < pauseUntil) {          // respect backoff — do NOT fetch while throttled
            setTimeout(step, (pauseUntil - Date.now()) + 250);
            return;
        }
        const key = resolveKey();
        if (!key) { draining = false; setText('Set API key \u2192 tap \uD83D\uDD11'); return; }

        const uid = queue.shift();
        const url = 'https://api.torn.com/user/' + encodeURIComponent(uid) +
            '?selections=profile&comment=ElimRevive&key=' + encodeURIComponent(key);

        fetch(url)
            .then((r) => r.json().catch(() => null))   // block page = HTML, not JSON
            .then((data) => {
                if (!data) { rateBackoff(uid); return; } // no JSON => throttled / blocked
                if (data.error) {
                    if (data.error.code === 5) { rateBackoff(uid); return; } // too many requests
                    // Other API error (bad key, etc.): record as unknown, retry after NULL_RETRY_MS.
                    results.set(uid, { revivable: null, name: null, at: Date.now() });
                    queued.delete(uid);
                    applyForUid(uid);
                    if (data.error.code === 2) setText('Invalid key \u2192 tap \uD83D\uDD11');
                    return;
                }
                const rev = (data.revivable === 1 || data.revivable === true) ? 1
                          : (data.revivable === 0 || data.revivable === false) ? 0
                          : null;
                results.set(uid, { revivable: rev, name: data.name || null, at: Date.now() });
                queued.delete(uid);
                applyForUid(uid);
                updateStatus();
                saveCacheSoon();
            })
            .catch(() => { rateBackoff(uid); })          // network/other: treat as throttle, back off
            .finally(() => { setTimeout(step, REQ_SPACING_MS); });
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
        if (!roster.has(uid)) roster.set(uid, (a.textContent || '').trim());
        const e = results.get(uid);
        const rev = e ? e.revivable : undefined;
        const next = a.nextElementSibling;
        if (next && next.getAttribute && next.getAttribute('data-er') === '1') next.remove();
        if (rev === 0 || rev === 1) {
            a.insertAdjacentElement('afterend', badgeFor(rev));
        } else {
            a.insertAdjacentElement('afterend', badgeFor(undefined));
            enqueue(uid);
        }
    }
    function applyForUid(uid) {
        const rows = document.querySelectorAll('[class*="teamPageWrapper"] a[href*="profiles.php?XID=' + uid + '"]');
        rows.forEach(applyToAnchor);
    }
    function scan() {
        const tid = currentTeamId();
        if (tid !== teamId) { teamId = tid; roster.clear(); }
        const wrap = document.querySelector('[class*="teamPageWrapper"]');
        if (!wrap) return;
        const anchors = wrap.querySelectorAll('a[href*="profiles.php?XID="]');
        if (!anchors.length) return;
        anchors.forEach(applyToAnchor);
        updateStatus();
    }

    // ---- boot ----------------------------------------------------------------
    loadCache();
    setInterval(scan, RESCAN_MS);
    scan();
})();