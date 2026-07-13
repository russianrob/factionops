// ==UserScript==
// @name         Torn Script Finder
// @namespace    tornwar.com
// @version      1.2.1
// @description  Searchable directory overlay for the Tools & Userscripts forum. PDA-compatible fork of HopesG's Torn Script Finder — guards GM_registerMenuCommand so it does not crash on Torn PDA (which lacks that API).
// @author       HopesG (PDA fork by RussianRob)
// @match        *://www.torn.com/forums.php*
// @match        *://torn.com/forums.php*
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_addStyle
// @grant        GM_registerMenuCommand
// @connect      api.torn.com
// @run-at       document-idle
// @downloadURL https://tornwar.com/scripts/torn-script-finder.user.js
// @updateURL https://tornwar.com/scripts/torn-script-finder.meta.js
// ==/UserScript==

(function () {
    'use strict';

    // ---------- CONFIG ----------
    const API_BASE = 'https://api.torn.com/v2';
    const TOOLS_CATEGORY_ID = 67; // Tools & Userscripts forum category
    const MIN_REQUEST_INTERVAL_MS = 700; // global throttle, keeps us well under Torn's 100 req/min
    const MAX_RANGE_REQUESTS = 400; // hard safety cap on total requests during a single crawl
    const FORUM_EPOCH_SECONDS = 1104537600; // 2005-01-01 UTC, a safe floor before Torn existed
    const RECENT_OVERLAP_SECONDS = 2 * 24 * 60 * 60; // 2-day overlap when checking for new/updated threads
    const STORAGE_API_KEY = 'sf_api_key';
    const STORAGE_CACHE = 'sf_thread_cache';
    const STORAGE_BTN_POS = 'sf_btn_pos';
    const STORAGE_FAVORITES = 'sf_favorites';
    const STORAGE_LAST_VISIT = 'sf_last_visit';

    const CATEGORY_RULES = [
        { category: 'Poker', keywords: ['poker', 'hand history', 'holdem', 'range blocker', 'gto', 'poker solver'] },
        { category: 'Casino', keywords: ['casino', 'slots', 'roulette', 'blackjack', 'spin the wheel'] },
        { category: 'Faction', keywords: ['faction', 'chain', 'war report', 'oc ', 'organized crime', 'territory'] },
        { category: 'Crimes', keywords: ['crime', 'nerve', 'burglary', 'cracking', 'crimes 2.0'] },
        { category: 'Travel', keywords: ['travel', 'plushie', 'flower', 'abroad', 'foreign stock'] },
        { category: 'Trading', keywords: ['trade', 'market', 'bazaar', 'item price', 'flip'] },
        { category: 'Combat', keywords: ['attack', 'fair fight', 'target finder', 'spy', 'war stats'] },
        { category: 'UI / Quality of Life', keywords: ['theme', 'dark mode', 'ui', 'layout', 'notification', 'overlay', 'hotkey'] },
    ];

    const TYPE_RULES = [
        { type: 'Extension', keywords: ['chrome extension', 'firefox extension', 'browser extension'] },
        { type: 'Website', keywords: ['website', '.com', '.io', '.app', 'webapp', 'web app'] },
        { type: 'Guide / Tool', keywords: ['guide', 'tutorial', 'how to', 'walkthrough'] },
    ];

    // ---------- STYLES ----------
    GM_addStyle(`
        #sf-launch-btn, #sf-overlay, #sf-overlay * {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            box-sizing: border-box;
        }
        #sf-launch-btn {
            position: fixed; top: 100px; right: 16px; z-index: 99999;
            background: linear-gradient(135deg, #7c5cff, #5b8dff); color: #fff; border: none; border-radius: 24px;
            padding: 10px 18px; font-size: 13px; font-weight: 600; letter-spacing: 0.2px; cursor: grab;
            box-shadow: 0 4px 16px rgba(92, 80, 255, 0.35); user-select: none; touch-action: none;
            transition: transform 0.15s ease, box-shadow 0.15s ease;
        }
        #sf-launch-btn:hover { transform: translateY(-1px); box-shadow: 0 6px 20px rgba(92, 80, 255, 0.45); }
        #sf-launch-btn:active { cursor: grabbing; transform: translateY(0); }
        #sf-overlay {
            position: fixed; inset: 0; z-index: 100000; background: rgba(8, 9, 14, 0.65);
            backdrop-filter: blur(2px);
            display: none; align-items: center; justify-content: center;
        }
        #sf-overlay.open { display: flex; }
        #sf-panel {
            background: #14161e; color: #e6e8ef; width: 92%; max-width: 820px; height: 84vh;
            border-radius: 16px; display: flex; flex-direction: column; overflow: hidden;
            border: 1px solid #23273366; box-shadow: 0 24px 70px rgba(0,0,0,0.55);
        }
        #sf-panel header {
            display: flex; align-items: center; gap: 10px; padding: 16px 20px;
            border-bottom: 1px solid #23262f; flex-wrap: wrap;
        }
        #sf-panel header h2 { margin: 0; font-size: 17px; font-weight: 700; flex: 1 0 auto; letter-spacing: 0.2px; }
        #sf-search {
            flex: 1 1 220px; padding: 9px 14px; border-radius: 10px; border: 1px solid #2b2f3a;
            background: #1c1f28; color: #f2f3f7; font-size: 13px; transition: border-color 0.15s ease;
        }
        #sf-search::placeholder { color: #6b7180; }
        #sf-search:focus, #sf-panel select:focus, #sf-panel input:focus {
            outline: none; border-color: #7c5cff; box-shadow: 0 0 0 3px rgba(124, 92, 255, 0.18);
        }
        #sf-panel select, #sf-panel input {
            padding: 8px 10px; border-radius: 10px; border: 1px solid #2b2f3a;
            background: #1c1f28; color: #f2f3f7; font-size: 12.5px; transition: border-color 0.15s ease;
        }
        #sf-close {
            background: none; border: none; color: #8b93a7; font-size: 22px; line-height: 1; cursor: pointer;
            padding: 4px 8px; border-radius: 8px; transition: background 0.15s ease, color 0.15s ease;
        }
        #sf-close:hover { background: #1c1f28; color: #f2f3f7; }
        #sf-keybar { display: none; align-items: center; gap: 10px; padding: 12px 20px; border-bottom: 1px solid #23262f; background: #191c25; flex-wrap: wrap; }
        #sf-keybar input { flex: 1 1 220px; }
        #sf-key-hint { font-size: 11px; color: #6b7180; }
        #sf-chips { display: flex; gap: 6px; flex-wrap: wrap; padding: 12px 20px; border-bottom: 1px solid #23262f; }
        .sf-chip {
            padding: 5px 12px; border-radius: 16px; background: #1c1f28; color: #a8afc0;
            font-size: 12px; font-weight: 500; cursor: pointer; border: 1px solid #262a35;
            transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease;
        }
        .sf-chip:hover { border-color: #3a3f4f; color: #e6e8ef; }
        .sf-chip.active { background: linear-gradient(135deg, #7c5cff, #5b8dff); color: #fff; border-color: transparent; }
        #sf-toolbar { display: flex; gap: 8px; padding: 10px 20px; align-items: center; border-bottom: 1px solid #23262f; font-size: 12px; flex-wrap: wrap; }
        #sf-indexing-status { padding: 6px 20px; font-size: 11px; color: #6b7180; min-height: 14px; }
        #sf-results { flex: 1; overflow-y: auto; padding: 12px 20px 20px; }
        #sf-results::-webkit-scrollbar { width: 9px; }
        #sf-results::-webkit-scrollbar-thumb { background: #262a35; border-radius: 6px; }
        #sf-results::-webkit-scrollbar-track { background: transparent; }
        .sf-card {
            background: #191c25; border: 1px solid #23262f; border-radius: 12px; padding: 14px 16px;
            margin-bottom: 10px; transition: border-color 0.15s ease, transform 0.15s ease;
        }
        .sf-card:hover { border-color: #3a3f5a; transform: translateY(-1px); }
        .sf-card-title { font-weight: 650; font-size: 14.5px; color: #c9d3ff; text-decoration: none; cursor: pointer; }
        .sf-card-title:hover { color: #e6e8ef; text-decoration: underline; }
        .sf-star { cursor: pointer; margin-right: 8px; color: #454a5c; font-size: 15px; vertical-align: -1px; transition: color 0.15s ease; }
        .sf-star:hover { color: #f6c945; }
        .sf-star.active { color: #f6c945; }
        .sf-card-meta { font-size: 11.5px; color: #8b93a7; margin-top: 4px; }
        .sf-card-desc { font-size: 12.5px; color: #b7bdcc; margin-top: 8px; line-height: 1.5; }
        .sf-badge {
            display: inline-block; font-size: 10px; font-weight: 600; letter-spacing: 0.2px;
            padding: 2px 8px; border-radius: 6px; background: #23262f; color: #a8afc0; margin: 6px 4px 0 0;
        }
        .sf-badge.cat { background: rgba(124, 92, 255, 0.15); color: #b3a3ff; }
        .sf-badge.compat { background: rgba(91, 141, 255, 0.15); color: #9dbcff; }
        .sf-badge.new { background: rgba(52, 211, 153, 0.18); color: #6ee7b7; }
        #sf-status { padding: 32px 20px; text-align: center; color: #6b7180; font-size: 13px; line-height: 1.6; }
    `);

    // ---------- STORAGE ----------
    function getApiKey() { return GM_getValue(STORAGE_API_KEY, ''); }
    function setApiKey(key) { GM_setValue(STORAGE_API_KEY, key); }
    function loadCache() { return GM_getValue(STORAGE_CACHE, null); }
    function saveCache(threads) { GM_setValue(STORAGE_CACHE, { threads, fetchedAt: Date.now() }); }
    function loadFavorites() { return new Set(GM_getValue(STORAGE_FAVORITES, [])); }
    function saveFavorites(set) { GM_setValue(STORAGE_FAVORITES, Array.from(set)); }

    // Kept as a fallback path for anyone who prefers it; the in-panel field is the main flow.
    if (typeof GM_registerMenuCommand === 'function') {
        GM_registerMenuCommand('Script Finder: Set Torn API key', () => {
            const current = getApiKey();
            const next = prompt('Enter your Torn API key (Public access is enough to read the forum):', current);
            if (next !== null) setApiKey(next.trim());
        });
    }

    // ---------- API ----------
    function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }
    let lastRequestAt = 0;

    // Every call funnels through here, so the global throttle covers thread-list crawling
    // and first-post indexing together -- keeps us safely under Torn's 100 req/min.
    async function apiGet(path) {
        const key = getApiKey();
        if (!key) throw new Error('No Torn API key set yet.');
        const wait = MIN_REQUEST_INTERVAL_MS - (Date.now() - lastRequestAt);
        if (wait > 0) await sleep(wait);
        lastRequestAt = Date.now();
        const sep = path.includes('?') ? '&' : '?';
        const url = `${API_BASE}${path}${sep}key=${encodeURIComponent(key)}`;
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: 'GET',
                url,
                onload: (res) => {
                    let data;
                    try { data = JSON.parse(res.responseText); }
                    catch (e) { reject(new Error('Bad JSON from Torn API')); return; }
                    if (data && data.error) { reject(new Error(data.error.error || 'Torn API error')); return; }
                    resolve(data);
                },
                onerror: () => reject(new Error('Network error contacting Torn API')),
            });
        });
    }

    // Recursively narrows a [from, to] window until every window returns fewer than the
    // 100-thread page cap. A window under the cap is fully covered and needs no split; a full
    // window might be hiding more threads, so it gets bisected and both halves are re-checked.
    // This doesn't trust any cursor/link Torn provides -- those proved unreliable in testing
    // (the `prev` cursor and a self-computed `to` cursor both stalled after ~6 days of history).
    async function crawlRange(from, to, seen) {
        if (state.progress.requestsMade >= MAX_RANGE_REQUESTS || from >= to) return;
        const path = `/forum/${TOOLS_CATEGORY_ID}/threads?limit=100&sort=desc&from=${from}&to=${to}`;
        let data, requestError = null;
        try {
            data = await apiGet(path);
        } catch (e) {
            requestError = e.message;
            data = {};
        }
        const list = data.threads || data.data || (Array.isArray(data) ? data : []);
        list.forEach((t) => seen.set(t.id ?? t.thread_id, t));

        state.progress.requestsMade++;
        state.progress.totalThreads = seen.size;
        render();

        if (requestError) return; // don't recurse into a failing window
        if (list.length < 100) return; // window fully covered, nothing more to split here
        if (to - from <= 1) return; // can't split a 1-second window any further (safety floor)

        const mid = Math.floor((from + to) / 2);
        await crawlRange(from, mid, seen);
        await crawlRange(mid, to, seen);
    }

    // First post text, used to build the description + feed classification. Fetched lazily
    // in the background (see ensureDescriptions) rather than for the whole list up front.
    async function fetchFirstPostText(threadId) {
        const data = await apiGet(`/forum/${threadId}/posts`);
        const posts = data.posts || data.data || (Array.isArray(data) ? data : []);
        if (!posts.length) return '';
        const first = posts[0];
        return first.content || first.text || first.message || '';
    }

    function normalizeThread(raw) {
        const id = raw.id ?? raw.thread_id ?? raw.threadId;
        const title = raw.title ?? raw.name ?? '(untitled)';
        const author = (raw.author && (raw.author.username || raw.author.name)) || raw.username || raw.author_name || 'unknown';
        const lastPostAt = raw.last_post_time ?? raw.last_post ?? raw.last_poster_timestamp ?? raw.updated_at ?? 0;
        const replies = raw.posts ?? raw.replies ?? raw.num_posts ?? raw.post_count ?? 0;
        const views = raw.views ?? 0;
        const rating = raw.rating ?? 0;
        const lastPostMs = typeof lastPostAt === 'number' ? lastPostAt * (lastPostAt < 2e10 ? 1000 : 1) : Date.parse(lastPostAt) || 0;
        const t = {
            id, title, author, replies, views, rating,
            lastPostMs,
            url: `https://www.torn.com/forums.php?p=threads&f=${TOOLS_CATEGORY_ID}&t=${id}`,
            description: null,
            pdaCompatible: null,
            desktopCompatible: null,
        };
        applyClassification(t);
        return t;
    }

    // ---------- CLASSIFICATION ----------
    // Runs against title + first-post text combined once the description has loaded, so a
    // thread never needs the word "poker" in its title to be found searching/browsing Poker.
    function classifyCategories(text) {
        const t = text.toLowerCase();
        const matches = CATEGORY_RULES.filter((rule) => rule.keywords.some((kw) => t.includes(kw))).map((r) => r.category);
        return matches.length ? matches : ['Other'];
    }

    function classifyType(text) {
        const t = text.toLowerCase();
        for (const rule of TYPE_RULES) {
            if (rule.keywords.some((kw) => t.includes(kw))) return rule.type;
        }
        return 'Userscript';
    }

    function detectCompatibility(text) {
        const t = text.toLowerCase();
        const pda = /pda[\s-]*compat|works on pda|pda friendly/.test(t) ? true
            : /not pda|no pda|desktop only/.test(t) ? false : null;
        const desktop = /desktop only|not.*mobile/.test(t) ? true
            : /desktop.*not supported|no desktop/.test(t) ? false : null;
        return { pda, desktop };
    }

    // Recomputes categories/type/compatibility from whatever text is currently known
    // (title alone at first, title + first post once the background indexer reaches it).
    function applyClassification(t) {
        const combined = `${t.title} ${t.description || ''}`;
        t.categories = classifyCategories(combined);
        t.contentType = classifyType(combined);
        const compat = detectCompatibility(combined);
        t.pdaCompatible = compat.pda;
        t.desktopCompatible = compat.desktop;
    }

    // ---------- STATE ----------
    const state = {
        threads: [],
        query: '',
        category: 'All',
        contentType: 'All',
        sort: 'relevance',
        loading: false,
        checkingForUpdates: false,
        error: null,
        showKeyForm: false,
        favorites: loadFavorites(),
        favoritesOnly: false,
        lastVisitAt: Date.now(),
        progress: { requestsMade: 0, totalThreads: 0, descriptionDone: 0, descriptionTotal: 0 },
    };

    // Full from-scratch re-scan of the entire forum history. Used on the very first run, and
    // available manually via "Rebuild full index" for when the index looks incomplete --
    // refreshRecentThreads() below can only look forward from what's already cached, so it
    // can never fix gaps left by a bad or partial earlier crawl. This can.
    async function runFullCrawl() {
        state.loading = true;
        state.error = null;
        render();
        try {
            const seen = new Map();
            state.progress.requestsMade = 0;
            state.progress.totalThreads = 0;
            const nowPlusBuffer = Math.floor(Date.now() / 1000) + 3600;
            await crawlRange(FORUM_EPOCH_SECONDS, nowPlusBuffer, seen);
            const fresh = Array.from(seen.values()).map(normalizeThread);

            // Keep any first-post text already fetched for threads that still exist, so a
            // rebuild doesn't throw away indexing work that's already done.
            const prevById = new Map(state.threads.map((t) => [t.id, t]));
            fresh.forEach((t) => {
                const prev = prevById.get(t.id);
                if (prev && prev.description) {
                    t.description = prev.description;
                    applyClassification(t);
                }
            });
            state.threads = fresh;
            saveCache(state.threads);
        } catch (e) {
            state.error = e.message;
        } finally {
            state.loading = false;
            render();
            ensureDescriptions();
        }
    }

    async function ensureThreads() {
        const cached = loadCache();
        if (cached && cached.threads.length) {
            state.threads = cached.threads;
            render();
            ensureDescriptions();
            refreshRecentThreads();
            return;
        }
        await runFullCrawl();
    }

    // Cheap "what's new" check: only crawls from the newest thread we already know about
    // (minus a small overlap for safety) up to now, instead of redoing the full history.
    // Runs automatically on every open, plus whenever "Refresh list" is clicked.
    let recentCrawlRunning = false;
    async function refreshRecentThreads() {
        if (recentCrawlRunning || !state.threads.length) return;
        recentCrawlRunning = true;
        state.checkingForUpdates = true;
        render();
        try {
            const newestKnownSec = state.threads.reduce((max, t) => Math.max(max, Math.floor(t.lastPostMs / 1000)), 0);
            const from = Math.max(FORUM_EPOCH_SECONDS, newestKnownSec - RECENT_OVERLAP_SECONDS);
            const now = Math.floor(Date.now() / 1000) + 3600;
            const seen = new Map();
            state.progress.requestsMade = 0; // this is a small crawl, doesn't need the big-crawl counter
            await crawlRange(from, now, seen);

            if (seen.size) {
                const byId = new Map(state.threads.map((t) => [t.id, t]));
                seen.forEach((raw) => {
                    const id = raw.id ?? raw.thread_id;
                    const norm = normalizeThread(raw);
                    const existing = byId.get(id);
                    if (existing && existing.description) {
                        norm.description = existing.description;
                        applyClassification(norm);
                    }
                    byId.set(id, norm);
                });
                state.threads = Array.from(byId.values());
                saveCache(state.threads);
            }
        } catch (e) {
            // silent -- this is a background convenience check, not worth interrupting the user for
        } finally {
            recentCrawlRunning = false;
            state.checkingForUpdates = false;
            render();
            ensureDescriptions();
        }
    }

    // Gradually fetches the first post of every thread still missing one, in the background,
    // saving progress every few threads so a closed tab doesn't lose the work. Safe to call
    // repeatedly -- it no-ops if a crawl is already running.
    let descriptionCrawlRunning = false;
    async function ensureDescriptions() {
        if (descriptionCrawlRunning) return;
        descriptionCrawlRunning = true;
        try {
            const pending = state.threads.filter((t) => t.description === null);
            state.progress.descriptionDone = 0;
            state.progress.descriptionTotal = pending.length;
            for (const t of pending) {
                try {
                    const text = await fetchFirstPostText(t.id);
                    t.description = text.replace(/\s+/g, ' ').trim().slice(0, 600);
                } catch (e) {
                    t.description = ''; // mark attempted so we don't retry forever
                }
                applyClassification(t);
                state.progress.descriptionDone++;
                if (state.progress.descriptionDone % 5 === 0 || state.progress.descriptionDone === pending.length) {
                    saveCache(state.threads);
                    render();
                }
            }
        } finally {
            descriptionCrawlRunning = false;
        }
    }

    function toggleFavorite(id) {
        if (state.favorites.has(id)) state.favorites.delete(id);
        else state.favorites.add(id);
        saveFavorites(state.favorites);
        render();
    }

    function getFiltered() {
        const q = state.query.trim().toLowerCase();
        let list = state.threads.filter((t) => {
            if (state.favoritesOnly && !state.favorites.has(t.id)) return false;
            if (state.category !== 'All' && !t.categories.includes(state.category)) return false;
            if (state.contentType !== 'All' && t.contentType !== state.contentType) return false;
            if (q && !t.title.toLowerCase().includes(q) && !(t.description || '').toLowerCase().includes(q)) return false;
            return true;
        });
        switch (state.sort) {
            case 'newest':
            case 'updated':
                list = list.sort((a, b) => b.lastPostMs - a.lastPostMs); break;
            case 'popular':
                list = list.sort((a, b) => b.replies - a.replies); break;
            default:
                if (q) list = list.sort((a, b) => a.title.toLowerCase().indexOf(q) - b.title.toLowerCase().indexOf(q));
        }
        return list;
    }

    function relativeTime(ms) {
        if (!ms) return 'unknown';
        const diffSec = Math.floor((Date.now() - ms) / 1000);
        if (diffSec < 60) return 'just now';
        const mins = Math.floor(diffSec / 60);
        if (mins < 60) return `${mins}m ago`;
        const hours = Math.floor(mins / 60);
        if (hours < 24) return `${hours}h ago`;
        const days = Math.floor(hours / 24);
        if (days < 30) return `${days}d ago`;
        const months = Math.floor(days / 30);
        if (months < 12) return `${months}mo ago`;
        return `${Math.floor(months / 12)}y ago`;
    }

    // ---------- DRAGGABLE LAUNCH BUTTON ----------
    function applyBtnPosition(btn) {
        const pos = GM_getValue(STORAGE_BTN_POS, null);
        if (pos) {
            btn.style.left = pos.left;
            btn.style.top = pos.top;
            btn.style.right = 'auto';
        }
    }

    function makeDraggable(btn) {
        let dragging = false, moved = false, startX, startY, startLeft, startTop;
        btn.addEventListener('pointerdown', (e) => {
            dragging = true; moved = false;
            startX = e.clientX; startY = e.clientY;
            const rect = btn.getBoundingClientRect();
            startLeft = rect.left; startTop = rect.top;
            btn.setPointerCapture(e.pointerId);
        });
        btn.addEventListener('pointermove', (e) => {
            if (!dragging) return;
            const dx = e.clientX - startX, dy = e.clientY - startY;
            if (Math.abs(dx) > 4 || Math.abs(dy) > 4) moved = true;
            if (!moved) return;
            const left = Math.min(window.innerWidth - btn.offsetWidth - 4, Math.max(4, startLeft + dx));
            const top = Math.min(window.innerHeight - btn.offsetHeight - 4, Math.max(4, startTop + dy));
            btn.style.left = `${left}px`;
            btn.style.top = `${top}px`;
            btn.style.right = 'auto';
        });
        btn.addEventListener('pointerup', () => {
            dragging = false;
            if (moved) GM_setValue(STORAGE_BTN_POS, { left: btn.style.left, top: btn.style.top });
        });
        btn.addEventListener('click', (e) => {
            if (moved) { e.preventDefault(); e.stopPropagation(); moved = false; return; }
            open();
        });
    }

    // ---------- UI ----------
    let keybarEl, keyFieldEl;

    function buildShell() {
        const btn = document.createElement('button');
        btn.id = 'sf-launch-btn';
        btn.textContent = '🔎 Script Finder';
        document.body.appendChild(btn);
        applyBtnPosition(btn);
        makeDraggable(btn);

        const overlay = document.createElement('div');
        overlay.id = 'sf-overlay';
        overlay.innerHTML = `
            <div id="sf-panel">
                <header>
                    <h2>Script Finder</h2>
                    <input id="sf-search" type="text" placeholder="Search tools, scripts, sites..." />
                    <select id="sf-sort">
                        <option value="relevance">Relevance</option>
                        <option value="newest">Newest</option>
                        <option value="updated">Recently updated</option>
                        <option value="popular">Popular</option>
                    </select>
                    <button id="sf-key-btn" class="sf-chip">🔑 API Key</button>
                    <button id="sf-close">&times;</button>
                </header>
                <div id="sf-keybar">
                    <input id="sf-key-field" type="text" placeholder="Paste your Torn API key here..." />
                    <button id="sf-key-save" class="sf-chip">Save</button>
                    <span id="sf-key-hint">Public access is enough. Torn &rarr; Settings &rarr; API Keys.</span>
                </div>
                <div id="sf-chips"></div>
                <div id="sf-toolbar">
                    <select id="sf-type">
                        <option value="All">All types</option>
                        <option>Userscript</option>
                        <option>Website</option>
                        <option>Extension</option>
                        <option>Guide / Tool</option>
                    </select>
                    <button id="sf-fav-toggle" class="sf-chip">⭐ Favorites only</button>
                    <button id="sf-refresh" class="sf-chip">Refresh list</button>
                    <button id="sf-deepscan" class="sf-chip">Load details for visible results</button>
                    <button id="sf-rebuild" class="sf-chip">Rebuild full index</button>
                </div>
                <div id="sf-indexing-status"></div>
                <div id="sf-results"></div>
            </div>
        `;
        document.body.appendChild(overlay);

        keybarEl = overlay.querySelector('#sf-keybar');
        keyFieldEl = overlay.querySelector('#sf-key-field');
        if (getApiKey()) keyFieldEl.placeholder = 'Key saved. Paste a new one to replace it...';

        overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
        overlay.querySelector('#sf-close').addEventListener('click', close);
        overlay.querySelector('#sf-search').addEventListener('input', (e) => { state.query = e.target.value; render(); });
        overlay.querySelector('#sf-sort').addEventListener('change', (e) => { state.sort = e.target.value; render(); });
        overlay.querySelector('#sf-type').addEventListener('change', (e) => { state.contentType = e.target.value; render(); });
        overlay.querySelector('#sf-refresh').addEventListener('click', () => {
            if (state.threads.length) refreshRecentThreads();
            else ensureThreads();
        });
        overlay.querySelector('#sf-deepscan').addEventListener('click', deepScanVisible);
        overlay.querySelector('#sf-rebuild').addEventListener('click', () => {
            if (confirm("Fully re-scan the forum's entire history? This can take a minute or two, but fixes a gappy index.")) {
                runFullCrawl();
            }
        });
        overlay.querySelector('#sf-key-btn').addEventListener('click', () => toggleKeyBar());
        overlay.querySelector('#sf-key-save').addEventListener('click', saveKeyFromField);
        keyFieldEl.addEventListener('keydown', (e) => { if (e.key === 'Enter') saveKeyFromField(); });

        const favToggle = overlay.querySelector('#sf-fav-toggle');
        favToggle.addEventListener('click', () => {
            state.favoritesOnly = !state.favoritesOnly;
            favToggle.classList.toggle('active', state.favoritesOnly);
            render();
        });

        overlay.querySelector('#sf-results').addEventListener('click', (e) => {
            const star = e.target.closest('.sf-star');
            if (star) { e.preventDefault(); toggleFavorite(Number(star.dataset.id)); }
        });

        const chipsEl = overlay.querySelector('#sf-chips');
        ['All', 'Poker', 'Casino', 'Faction', 'Crimes', 'Travel', 'Trading', 'Combat', 'UI / Quality of Life', 'Other'].forEach((cat) => {
            const chip = document.createElement('span');
            chip.className = 'sf-chip' + (cat === 'All' ? ' active' : '');
            chip.textContent = cat;
            chip.addEventListener('click', () => {
                state.category = cat;
                chipsEl.querySelectorAll('.sf-chip').forEach((c) => c.classList.remove('active'));
                chip.classList.add('active');
                render();
            });
            chipsEl.appendChild(chip);
        });
    }

    function toggleKeyBar(forceOpen) {
        state.showKeyForm = forceOpen === true ? true : !state.showKeyForm;
        keybarEl.style.display = state.showKeyForm ? 'flex' : 'none';
        if (state.showKeyForm) keyFieldEl.focus();
    }

    function saveKeyFromField() {
        const val = keyFieldEl.value.trim();
        if (!val) return;
        setApiKey(val);
        keyFieldEl.value = '';
        keyFieldEl.placeholder = 'Key saved. Paste a new one to replace it...';
        toggleKeyBar(false);
        state.error = null;
        if (!state.threads.length) ensureThreads();
        else render();
    }

    // Manual priority-boost for whatever's currently on screen; the background crawler
    // (ensureDescriptions) will get to everything eventually, this just jumps the queue.
    async function deepScanVisible() {
        const visible = getFiltered().slice(0, 30).filter((t) => t.description === null);
        for (const t of visible) {
            try {
                const text = await fetchFirstPostText(t.id);
                t.description = text.replace(/\s+/g, ' ').trim().slice(0, 600);
            } catch (e) {
                t.description = '';
            }
            applyClassification(t);
        }
        saveCache(state.threads);
        render();
    }

    function open() {
        document.getElementById('sf-overlay').classList.add('open');
        if (!getApiKey()) {
            toggleKeyBar(true);
            render();
            return;
        }
        state.lastVisitAt = GM_getValue(STORAGE_LAST_VISIT, Date.now());
        GM_setValue(STORAGE_LAST_VISIT, Date.now());
        if (!state.threads.length) ensureThreads();
        else render();
    }
    function close() { document.getElementById('sf-overlay').classList.remove('open'); }

    function renderIndexingStatus() {
        const el = document.getElementById('sf-indexing-status');
        if (!el) return;
        const parts = [];
        if (state.threads.length) parts.push(`${state.threads.length} threads indexed`);
        if (state.checkingForUpdates) parts.push('checking for new threads...');
        const p = state.progress;
        if (p.descriptionTotal && p.descriptionDone < p.descriptionTotal) parts.push(`indexing first posts: ${p.descriptionDone}/${p.descriptionTotal}`);
        el.textContent = parts.join(' · ');
    }

    function render() {
        renderIndexingStatus();
        const results = document.getElementById('sf-results');
        if (!results) return;
        if (!getApiKey()) {
            results.innerHTML = `<div id="sf-status">No Torn API key set yet.<br>Click "🔑 API Key" above and paste one in (Public access is enough).</div>`;
            return;
        }
        if (state.loading) {
            const p = state.progress;
            const progress = p.totalThreads ? ` (${p.totalThreads} threads found across ${p.requestsMade} requests so far)` : '';
            results.innerHTML = `<div id="sf-status">Crawling full forum history for the first time...${progress}<br>This only happens once -- after this, checking for new threads is quick.</div>`;
            return;
        }
        if (state.error) { results.innerHTML = `<div id="sf-status">Error: ${escapeHtml(state.error)}</div>`; return; }

        const list = getFiltered();
        if (!list.length) { results.innerHTML = `<div id="sf-status">No results.</div>`; return; }

        results.innerHTML = list.map((t) => {
            const isFav = state.favorites.has(t.id);
            const isNew = t.lastPostMs > state.lastVisitAt;
            const badges = [
                isNew ? `<span class="sf-badge new">New</span>` : '',
                ...t.categories.map((c) => `<span class="sf-badge cat">${escapeHtml(c)}</span>`),
                `<span class="sf-badge">${escapeHtml(t.contentType)}</span>`,
                t.pdaCompatible === true ? `<span class="sf-badge compat">PDA OK</span>` : '',
                t.desktopCompatible === false ? `<span class="sf-badge compat">Not desktop</span>` : '',
            ].join('');
            const updatedAbs = t.lastPostMs ? new Date(t.lastPostMs).toLocaleString() : '';
            return `
                <div class="sf-card">
                    <span class="sf-star ${isFav ? 'active' : ''}" data-id="${t.id}">${isFav ? '★' : '☆'}</span>
                    <a class="sf-card-title" href="${t.url}" target="_blank" rel="noopener">${escapeHtml(t.title)}</a>
                    <div class="sf-card-meta">by ${escapeHtml(t.author)} &middot; updated <span title="${escapeHtml(updatedAbs)}">${relativeTime(t.lastPostMs)}</span> &middot; ${t.replies} replies</div>
                    <div>${badges}</div>
                    ${t.description ? `<div class="sf-card-desc">${escapeHtml(t.description.slice(0, 220))}</div>` : ''}
                </div>
            `;
        }).join('');
    }

    function escapeHtml(s) {
        return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    }

    buildShell();
})();
