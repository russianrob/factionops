// ==UserScript==
// @name         Faction Revive Check
// @namespace    russianrob.faction.revives
// @version      2.0.0
// @description  Badges every faction member by their revive setting (Everyone / Friends & faction / off) in the position column, with a grouped copy-and-compose list. Originally built on AaronPMC's Elimination Revives.
// @author       RussianRob
// @match        https://www.torn.com/factions.php*
// @match        https://torn.com/factions.php*
// @grant        GM_getValue
// @grant        GM_setValue
// @run-at       document-idle
// ==/UserScript==

/* CHANGELOG
 * 2.0.0 - Faction pages only; the Elimination half is gone, and with it the
 *         per-member fetch queue it existed for. Renamed to Faction Revive
 *         Check. Hospitalised members now sort to the top of each group in
 *         the list, which is what the old fetch-order priority was for.
 * 1.2.0 - One /v2/faction/members call carries revive_setting for the whole
 *         roster. Badge moved to the position cell (the name cell clipped
 *         it). Three groups with chips, plus a Compose button.
 * 1.1.0 - Worked on factions.php as well as the Elimination page.
 * 1.0.0 - Elimination page: per-member revivable lookup, badges, copy list.
 */

(function () {
    'use strict';

    // --- config ---
    const CACHE_TTL_MS    = 3 * 60 * 60 * 1000; // 3h — a revive setting rarely changes
    const FACTION_TTL_MS  = 5 * 60 * 1000;      // scan() runs every 2s; this is what stops 30 calls/min
    const RESCAN_MS       = 2000;               // re-apply badges React may have wiped
    const OWN_KEY_STORE   = 'faction_revive_apikey';
    const CACHE_STORE     = 'faction_revive_cache';

    // uid -> { revivable: 0|1|null, setting: string|null, name: string|null, at: ts }
    const results = new Map();
    const roster  = new Map();   // uid -> name

    function listRoot() {
        return document.querySelector('.members-list, ul.table-body');
    }

    /**
     * Is this row's member in hospital?
     *
     * Deliberately NOT /\b\d{1,2}:\d{2}:\d{2}\b/ — row text concatenates to
     * "Deathy10:28:50", and there is no word boundary between "y" and "1",
     * so the anchored version matched nothing.
     */
    function isHospitalRow(a) {
        const row = a.closest('li');
        if (!row) return false;
        if (/hospital/i.test(row.className || '')) return true;
        if (row.querySelector('[class*="hospital" i], [title*="hospital" i]')) return true;
        return /\d{1,2}:\d{2}:\d{2}/.test(row.textContent || '');
    }

    // ---- the roster call -----------------------------------------------------
    //
    // The whole roster arrives in ONE request. /v2/faction/members carries
    // revive_setting per member — the enum Torn itself uses: "Everyone" |
    // "Friends & faction" | "No one" | "Unknown" — alongside is_revivable.
    // The old per-member queue was paced at 1.5s, so an 87-member faction
    // cost two minutes of rate limit for something one request answers.
    //
    // revive_setting is their PREFERENCE; is_revivable is whether they can
    // be revived right now. The list groups on the setting, which is the
    // stable fact, and marks who is actually in hospital separately.
    let factionFetchedAt = 0;
    let factionFetching = false;

    function fetchFactionRoster(force) {
        if (factionFetching) return;
        if (!force && Date.now() - factionFetchedAt < FACTION_TTL_MS) return;
        const key = resolveKey();
        if (!key) { setText('Set API key → tap 🔑'); return; }
        factionFetching = true;
        fetch('https://api.torn.com/v2/faction/members?striptags=true&comment=FactionRevive&key=' + encodeURIComponent(key))
            .then(function (r) { return r.json().catch(function () { return null; }); })
            .then(function (data) {
                factionFetching = false;
                if (!data) return;
                if (data.error) {
                    if (data.error.code === 2) setText('Invalid key → tap 🔑');
                    return;
                }
                const list = Array.isArray(data.members) ? data.members
                    : Object.keys(data.members || {}).map(function (id) {
                        return Object.assign({ id: id }, data.members[id]);
                    });
                if (!list.length) return;
                for (const m of list) {
                    const uid = String(m.id);
                    const set = m.revive_setting || 'Unknown';
                    results.set(uid, {
                        revivable: set === 'No one' ? 0 : set === 'Unknown' ? null : 1,
                        setting: set,
                        name: m.name || null,
                        at: Date.now()
                    });
                    if (m.name) roster.set(uid, m.name);
                }
                factionFetchedAt = Date.now();
                saveCacheSoon();
                scan();
                updateStatus();
            })
            .catch(function () { factionFetching = false; });
    }

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
            'Faction Revive Check — paste a Torn API key (Limited is fine).\n' +
            'Stored only in this browser.');
        if (k && k.trim()) { try { GM_setValue(OWN_KEY_STORE, k.trim()); } catch (_) {} return k.trim(); }
        return '';
    }

    // ---- persistent cache (GM) ----------------------------------------------
    function loadCache() {
        try {
            const raw = GM_getValue(CACHE_STORE, '');
            if (!raw) return;
            const obj = JSON.parse(raw);
            const now = Date.now();
            for (const [uid, e] of Object.entries(obj)) {
                if (e && typeof e.at === 'number' && (now - e.at) < CACHE_TTL_MS) {
                    // Carry revive_setting through: it is the finer answer, and
                    // rebuilding the entry without it silently demotes every
                    // member back to the boolean after a page load.
                    results.set(String(uid), {
                        revivable: e.revivable,
                        setting: e.setting || null,
                        name: e.name || null,
                        at: e.at
                    });
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
            try { GM_setValue(CACHE_STORE, JSON.stringify(obj)); } catch (_) {}
        }, 1500);
    }

    // ---- styles --------------------------------------------------------------
    (function injectCss() {
        const css = `
        /* The members table is a float-column layout already cramped on a
           phone, so the badge must not widen its cell: fixed box, no flex
           growth, never wraps. */
        .er-badge{display:inline-flex;align-items:center;justify-content:center;
            margin-left:4px;padding:0;width:13px;height:13px;min-width:13px;flex:0 0 auto;
            border-radius:50%;font:700 10px/13px Arial,sans-serif;white-space:nowrap;
            vertical-align:middle;border:1px solid transparent;}
        .er-on{background:rgba(0,184,148,.18);color:#00b894;border-color:rgba(0,184,148,.5);}
        /* Friends & faction reads amber: they CAN be revived, but only by
           their own side -- on an enemy roster that means not by you. */
        .er-fac{background:transparent;color:#fdcb6e;border-color:rgba(253,203,110,.5);}
        .er-off{background:transparent;color:#636e72;border-color:rgba(99,110,114,.35);}
        .er-unk{background:transparent;color:#4a5356;border-color:transparent;}
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
        #er-copy .er-row{display:flex;gap:6px;margin-top:8px;}
        #er-copy .er-groups{display:flex;flex-wrap:wrap;gap:5px;margin:0 0 7px;}
        #er-copy .er-chip{cursor:pointer;user-select:none;border-radius:9px;padding:2px 7px;
            font:700 10px/1.5 Arial,sans-serif;border:1px solid rgba(99,110,114,.45);
            background:rgba(0,0,0,.3);color:#8d9699;}
        #er-copy .er-chip[data-on="1"].er-g-everyone{border-color:rgba(0,184,148,.6);color:#00b894;background:rgba(0,184,148,.14);}
        #er-copy .er-chip[data-on="1"].er-g-faction{border-color:rgba(253,203,110,.6);color:#fdcb6e;background:rgba(253,203,110,.14);}
        #er-copy .er-chip[data-on="1"].er-g-none{border-color:rgba(225,112,85,.6);color:#e17055;background:rgba(225,112,85,.14);}
        #er-copy .er-hint{margin:6px 0 0;font:600 10px/1.35 Arial,sans-serif;color:#8d9699;}`;
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
                '<span id="er-text">Revives: …</span>' +
                '<button class="er-btn" id="er-copy-btn" title="Revivable list — copy or compose">📋 List</button>' +
                '<button class="er-btn" id="er-key-btn" title="Set / replace API key">🔑</button>';
            document.body.appendChild(el);
            el.querySelector('#er-key-btn').addEventListener('click', () => {
                if (promptForKey()) fetchFactionRoster(true);
            });
            el.querySelector('#er-copy-btn').addEventListener('click', openCopyPanel);
        }
        return el;
    }
    function setText(html) {
        const t = ensureStatus().querySelector('#er-text');
        if (t) t.innerHTML = html;
    }
    function updateStatus() {
        let total = roster.size, checked = 0, on = 0;
        roster.forEach((_n, uid) => {
            const e = results.get(uid);
            if (e && (e.revivable === 0 || e.revivable === 1)) { checked++; if (e.revivable === 1) on++; }
        });
        setText('<b>' + on + '</b> revivable · ' + checked + '/' + total + ' checked');
    }

    // ---- the list ------------------------------------------------------------
    //
    // Three buckets, because "revivable" is not one answer:
    //   everyone -- anyone can revive them, including you
    //   faction  -- only their friends and their own faction can, so on an
    //               ENEMY roster these are off-limits to you; on your own
    //               roster they are perfectly revivable
    //   none     -- revives off
    // Which buckets belong in a message depends on whose roster is open, and
    // only the reader knows that, so the chips decide and `everyone` is the
    // one that is safe by default.
    const GROUPS = [
        { key: 'everyone', label: 'Everyone',          cls: 'er-g-everyone', on: true  },
        { key: 'faction',  label: 'Friends & faction', cls: 'er-g-faction',  on: false },
        { key: 'none',     label: 'Not revivable',     cls: 'er-g-none',     on: false }
    ];

    function groupOf(entry) {
        if (!entry) return null;
        if (entry.setting === 'Everyone') return 'everyone';
        if (entry.setting === 'Friends & faction') return 'faction';
        if (entry.setting === 'No one') return 'none';
        if (entry.revivable === 1) return 'everyone';
        if (entry.revivable === 0) return 'none';
        return null;
    }

    // uids currently showing a hospital countdown, read off the live rows.
    function hospitalUids() {
        const out = new Set();
        const wrap = listRoot();
        if (!wrap) return out;
        wrap.querySelectorAll('a[href*="profiles.php?XID="]').forEach(function (a) {
            if (isHospitalRow(a)) { const u = uidFromAnchor(a); if (u) out.add(u); }
        });
        return out;
    }

    function buildGroups(hosp) {
        const hurt = hosp || new Set();
        const out = { everyone: [], faction: [], none: [] };
        roster.forEach((name, uid) => {
            const e = results.get(uid);
            const g = groupOf(e);
            if (!g) return;
            out[g].push({ name: (e.name || name || ('#' + uid)), uid: uid, hosp: hurt.has(uid) });
        });
        for (const k of Object.keys(out)) {
            // Hospitalised first: a revivable member who is not in hospital
            // does not need reviving, so they are the ones worth naming.
            out[k].sort((x, y) =>
                (y.hosp - x.hosp) || x.name.toLowerCase().localeCompare(y.name.toLowerCase()));
        }
        return out;
    }

    function renderList(groups, picked) {
        // Label the sections only when more than one is in play -- a single
        // selected group should paste as a bare list.
        const live = GROUPS.filter((g) => picked[g.key] && groups[g.key].length);
        const multi = live.length > 1;
        const chunks = [];
        for (const g of live) {
            const rows = groups[g.key];
            if (multi) chunks.push(g.label + ' (' + rows.length + '):');
            chunks.push(rows.map((r) => (r.hosp ? '* ' : '') + r.name + ' [' + r.uid + ']').join('\n'));
            if (multi) chunks.push('');
        }
        return chunks.join('\n').replace(/\n+$/, '');
    }

    function openCopyPanel() {
        const old = document.getElementById('er-copy');
        if (old) old.remove();
        const groups = buildGroups(hospitalUids());
        const picked = {};
        for (const g of GROUPS) picked[g.key] = g.on;
        const panel = document.createElement('div');
        panel.id = 'er-copy';
        panel.innerHTML =
            '<h4 id="er-copy-h">Revivable</h4>' +
            '<div class="er-groups">' +
                GROUPS.map((g) =>
                    '<span class="er-chip ' + g.cls + '" data-g="' + g.key + '" data-on="' + (g.on ? '1' : '0') + '">' +
                    g.label + ' · ' + groups[g.key].length + '</span>').join('') +
            '</div>' +
            '<textarea readonly></textarea>' +
            '<div class="er-row">' +
                '<button class="er-btn" id="er-copy-do" style="flex:1;">Copy</button>' +
                '<button class="er-btn" id="er-compose">✉ Compose</button>' +
                '<button class="er-btn" id="er-copy-close">Close</button>' +
            '</div>' +
            '<p class="er-hint">* = in hospital now. Compose copies the list and opens Torn mail — paste it in.</p>';
        document.body.appendChild(panel);
        const ta = panel.querySelector('textarea');

        function repaint() {
            const txt = renderList(groups, picked);
            ta.value = txt || '(nothing in the selected groups yet)';
            let n = 0;
            for (const g of GROUPS) if (picked[g.key]) n += groups[g.key].length;
            panel.querySelector('#er-copy-h').textContent = 'Revivable — ' + n + ' selected';
        }
        repaint();
        ta.focus(); ta.select();

        panel.querySelector('.er-groups').addEventListener('click', (ev) => {
            const chip = ev.target.closest('.er-chip');
            if (!chip) return;
            const k = chip.getAttribute('data-g');
            picked[k] = !picked[k];
            chip.setAttribute('data-on', picked[k] ? '1' : '0');
            repaint();
        });

        // Torn's compose takes no body parameter, so the honest version is:
        // put the text on the clipboard inside the same tap -- iOS and the PDA
        // refuse a write that happens after the gesture -- then open the mail
        // page for the user to paste into. Nothing auto-fills Torn's form.
        panel.querySelector('#er-compose').addEventListener('click', () => {
            const txt = ta.value;
            try {
                if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt);
                else { ta.focus(); ta.select(); document.execCommand('copy'); }
            } catch (_) {
                try { ta.focus(); ta.select(); document.execCommand('copy'); } catch (_e) {}
            }
            window.open('https://www.torn.com/messages.php#/p=compose', '_blank');
        });

        panel.querySelector('#er-copy-close').addEventListener('click', () => panel.remove());
        panel.querySelector('#er-copy-do').addEventListener('click', () => {
            ta.focus(); ta.select();
            const done = () => {
                const b = panel.querySelector('#er-copy-do');
                b.textContent = 'Copied!';
                setTimeout(() => { b.textContent = 'Copy'; }, 1500);
            };
            try {
                if (navigator.clipboard && navigator.clipboard.writeText) {
                    navigator.clipboard.writeText(ta.value).then(done, () => {
                        try { document.execCommand('copy'); done(); } catch (_) {}
                    });
                    return;
                }
            } catch (_) {}
            try { document.execCommand('copy'); done(); } catch (_) {}
        });
    }

    // ---- DOM badging ---------------------------------------------------------
    function uidFromAnchor(a) {
        const m = String(a.getAttribute('href') || '').match(/XID=(\d+)/);
        return m ? m[1] : null;
    }

    function badgeFor(rev, setting) {
        const b = document.createElement('span');
        // A known revive_setting is a finer answer than the boolean, so it
        // wins when we have one: "Friends & faction" is revivable, but not by
        // an outsider, and that distinction needs its own colour.
        const tone = setting === 'Everyone' ? 'er-on'
                   : setting === 'Friends & faction' ? 'er-fac'
                   : setting === 'No one' ? 'er-off'
                   : rev === 1 ? 'er-on' : rev === 0 ? 'er-off' : 'er-unk';
        b.className = 'er-badge ' + tone;
        b.setAttribute('data-er', '1');
        // Three states, not two. "No badge for off" would make "checked,
        // revives off" and "not checked yet" look identical, which is the one
        // reading that gets somebody killed.
        b.textContent = tone === 'er-on' ? '✙' : tone === 'er-fac' ? '✘'
                      : tone === 'er-off' ? '·' : '…';
        b.title = setting ? ('Revives: ' + setting)
                : rev === 1 ? 'Revives ON' : rev === 0 ? 'Revives off' : 'Not checked yet';
        return b;
    }

    /**
     * Badge the POSITION cell, not the name.
     *
     * The name cell measured 153px wide with overflow:hidden around 163px of
     * content, so a badge appended after the honour bar sat just past the
     * edge and was clipped — present in the DOM, invisible on screen. The
     * position cell is 71px and its text is already truncated, so a glyph
     * costs nothing.
     */
    function placeFactionBadge(a, entry) {
        const row = a.closest('li');
        if (!row) return;
        const cell = row.querySelector('[class*="positionCol"], .table-cell.position');
        if (!cell) return;
        const old = cell.querySelector('[data-er="1"]');
        if (old) old.remove();
        cell.insertAdjacentElement('afterbegin',
            badgeFor(entry ? entry.revivable : undefined, entry ? entry.setting : null));
    }

    function applyToAnchor(a) {
        const uid = uidFromAnchor(a);
        if (!uid) return;
        if (!roster.has(uid)) roster.set(uid, (a.textContent || '').trim());
        placeFactionBadge(a, results.get(uid));
    }

    function scan() {
        const wrap = listRoot();
        if (!wrap) return;
        fetchFactionRoster(false);
        const anchors = [].slice.call(wrap.querySelectorAll('a[href*="profiles.php?XID="]'));
        if (!anchors.length) return;
        anchors.forEach(applyToAnchor);
        updateStatus();
    }

    // ---- boot ----------------------------------------------------------------
    loadCache();
    setInterval(scan, RESCAN_MS);
    scan();
})();
