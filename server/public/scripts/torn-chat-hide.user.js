// ==UserScript==
// @name         Torn Chat - Hide User Messages
// @namespace    RussianRob
// @version      1.4.0
// @description  Hide a person's group-chat messages. Tap a name and use the Hide chat button on their mini profile, or long-press the name (right-click on desktop); muted messages disappear entirely. Torn PDA compatible. Based on Ben_Hagen [2966467]'s script (Greasy Fork 588787).
// @author       RussianRob
// @match        https://www.torn.com/*
// @match        https://torn.com/*
// @license      GNU GPLv3
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_addStyle
// @run-at       document-idle
// @downloadURL  https://tornwar.com/scripts/torn-chat-hide.user.js
// @updateURL    https://tornwar.com/scripts/torn-chat-hide.meta.js
// ==/UserScript==

(function () {
    'use strict';

    // ---------- Torn PDA compatibility ----------
    //
    // PDA runs userscripts through GMforPDA, which provides SOME of the GM_*
    // API and not all of it. A reference to one it does not define throws
    // before anything renders and takes the whole script with it -- and this
    // one called GM_addStyle at the top level, so on PDA it died on load and
    // nothing about it ever appeared. Every GM_* below is reached through a
    // guarded wrapper with a plain-DOM fallback.
    const hasGM = (n) => { try { return typeof window[n] === 'function'; } catch (e) { return false; } };

    const addStyle = (css) => {
        if (hasGM('GM_addStyle')) { try { return GM_addStyle(css); } catch (e) { /* fall through */ } }
        const el = document.createElement('style');
        el.textContent = css;
        (document.head || document.documentElement).appendChild(el);
        return el;
    };

    // PDA's storage hands values back as STRINGS, so a boolean written there
    // comes back as "false" -- which is truthy. Everything here is JSON text
    // either way, so this only has to survive the missing-function case.
    const getVal = (k, d) => {
        if (hasGM('GM_getValue')) { try { return GM_getValue(k, d); } catch (e) { /* fall through */ } }
        try { const v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; }
    };
    const setVal = (k, v) => {
        if (hasGM('GM_setValue')) { try { return GM_setValue(k, v); } catch (e) { /* fall through */ } }
        try { localStorage.setItem(k, v); } catch (e) { /* quota, private mode */ }
    };

    const STORAGE_KEY = 'torn_chat_hidden_users_v1';

    // ---------- storage ----------
    function loadHiddenUsers() {
        try {
            return JSON.parse(getVal(STORAGE_KEY, '{}')); // { xid: name }
        } catch (e) {
            return {};
        }
    }
    function saveHiddenUsers(obj) {
        setVal(STORAGE_KEY, JSON.stringify(obj));
    }
    let hiddenUsers = loadHiddenUsers();

    // ---------- styles ----------
    addStyle(`
        /* Gone, not collapsed. This used to leave a clickable "Hidden message
           from X" placeholder -- which still took a line, still named them, and
           came back on every reopen because the reveal was per-row and the rows
           are recycled. Muted means muted. */
        .tch-hidden-row {
            display: none !important;
        }
        .tch-menu {
            position: fixed;
            z-index: 999999;
            background: #222;
            color: #eee;
            border: 1px solid #555;
            border-radius: 4px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.5);
            font-size: 13px;
            padding: 4px 0;
            min-width: 180px;
        }
        .tch-menu-item {
            padding: 6px 12px;
            cursor: pointer;
            white-space: nowrap;
        }
        /* Coarse pointer = finger. The desktop menu is fine at 6px; a thumb
           needs a real target, and the long-press must not start Torn's own
           text-selection handles over the name. */
        @media (pointer: coarse) {
            .tch-menu-item { padding: 12px 16px; font-size: 15px; }
            .tch-menu { min-width: 220px; }
            [data-tch-xid] a[href*="XID="] {
                -webkit-touch-callout: none;
                -webkit-user-select: none;
                user-select: none;
            }
        }
        .tch-menu-item:hover {
            background: #3a3a6a;
        }
    `);

    // ---------- helpers ----------
    function getXidFromHref(href) {
        const m = href && href.match(/XID=(\d+)/i);
        return m ? m[1] : null;
    }

    // Find candidate name links inside the chat panel. Torn marks the actual
    // sender name link with a class containing "sender" (as opposed to the
    // avatar link right next to it, which points to the same profile but
    // isn't the name the user would right-click).
    function findNameLinks(root) {
        return root.querySelectorAll('a[class*="sender"][href*="XID="]');
    }

    // Private-chat conversation previews and other non-live-chat lists show a
    // relative time like "2 days ago" - real live chat lines never look like
    // that (they show a one-off "Today HH:MM" header, not per-row). Kept as
    // a defensive backup even though container scoping should already
    // prevent this.
    const RELATIVE_TIME_RE = /\b\d+\s*(second|minute|hour|day|week|month|year)s?\s*ago\b/i;
    function looksLikeLiveChatRow(row) {
        return !RELATIVE_TIME_RE.test(row.textContent);
    }

    // ---------- locate the live chat panels we're allowed to touch ----------
    // Whitelist approach: only channel types explicitly listed here are ever
    // touched. Anything not matched - including private 1:1 chats, whatever
    // their id format turns out to be - is automatically excluded, since it
    // simply never gets added to `containers` below.
    //
    // Confirmed from live inspection: faction-<factionID>, company-<companyID>,
    // public_trade. Torn appears to separate org-tied channels ("faction-",
    // "company-") from channels open to any player, which use a "public_"
    // prefix - so matching that prefix broadly should also pick up Global
    // chat and temporary event chats (e.g. Elimination) without needing each
    // one listed individually. Not yet confirmed against Elimination's real
    // DOM - if it isn't picked up, send an inspected snippet of its panel
    // and this can be adjusted.
    const ALLOWED_CHANNEL_PATTERNS = [
        /^faction-/,
        /^company-/,
        /^public_/,
        /elimin/i
    ];
    function isAllowedChannelId(id) {
        return !!id && ALLOWED_CHANNEL_PATTERNS.some((re) => re.test(id));
    }

    function findChatContainers() {
        const chatRoot = document.getElementById('chatRoot') || document;
        const matches = [];
        chatRoot.querySelectorAll('[id]').forEach((el) => {
            if (isAllowedChannelId(el.id)) matches.push(el);
        });
        return matches;
    }

    // element -> its MutationObserver
    const containers = new Map();

    function isInAnyContainer(node) {
        for (const c of containers.keys()) {
            if (c.contains(node)) return true;
        }
        return false;
    }

    // The enclosing row for a message is the nearest ancestor with a class
    // containing "virtualItem" - Torn's own wrapper for a single chat line.
    function findMessageRow(link) {
        return link.closest('[class*="virtualItem"]') || link.parentElement;
    }

    function applyHiddenState(row, xid, name) {
        // The click-to-reveal opt-out went with the placeholder. It was also a
        // bug waiting on this list: Torn RECYCLES these rows, so one revealed
        // once stayed revealed after being reused for another message.

        // Final safety net: never collapse an element that contains more
        // than one message's sender link - that would mean we're about to
        // hide multiple messages at once.
        if (row.querySelectorAll('a[class*="sender"][href*="XID="]').length > 1) return;

        // Never touch conversation-preview cards (private chats list etc).
        if (!looksLikeLiveChatRow(row)) return;

        if (hiddenUsers[xid]) {
            row.classList.add('tch-hidden-row');
            row.dataset.tchXid = xid;
        } else {
            row.classList.remove('tch-hidden-row');
        }
    }

    // ---------- context menu ----------
    let openMenu = null;
    function closeMenu() {
        if (openMenu) {
            openMenu.remove();
            openMenu = null;
        }
    }
    document.addEventListener('click', closeMenu);
    document.addEventListener('scroll', closeMenu, true);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeMenu(); });

    function showContextMenu(x, y, xid, name) {
        closeMenu();
        const menu = document.createElement('div');
        menu.className = 'tch-menu';
        // Positioned after it is measured. A long-press near the right or
        // bottom edge of a phone put the menu half off the screen, where the
        // one item it contains could not be reached.
        menu.style.left = '0px';
        menu.style.top = '0px';
        menu.style.visibility = 'hidden';

        const isHidden = !!hiddenUsers[xid];
        const item = document.createElement('div');
        item.className = 'tch-menu-item';
        item.textContent = isHidden
            ? `✅ Unhide messages from ${name}`
            : `🚫 Hide messages from ${name}`;

        item.addEventListener('click', (e) => {
            e.stopPropagation();
            if (isHidden) {
                delete hiddenUsers[xid];
            } else {
                hiddenUsers[xid] = name;
            }
            saveHiddenUsers(hiddenUsers);
            refreshAllRows();
            closeMenu();
        });

        menu.appendChild(item);
        document.body.appendChild(menu);

        const pad = 8;
        const r = menu.getBoundingClientRect();
        const vw = window.innerWidth || document.documentElement.clientWidth;
        const vh = window.innerHeight || document.documentElement.clientHeight;
        menu.style.left = Math.round(Math.max(pad, Math.min(x, vw - r.width - pad))) + 'px';
        menu.style.top = Math.round(Math.max(pad, Math.min(y, vh - r.height - pad))) + 'px';
        menu.style.visibility = '';

        openMenu = menu;
    }

    // ---------- row processing ----------
    // Torn's chat list recycles DOM nodes on scroll (virtualization): the same
    // row/link elements get reused for different messages, only their content
    // changes. So we can't just "process once and skip forever" - we need to
    // re-sync every time, and detect when a node has been repurposed for a
    // different message so we can clear any stale hidden/revealed state.
    const listenersAttached = new WeakSet();

    function processLink(link) {
        // Only ever touch links inside one of the allowed chat panels.
        if (!isInAnyContainer(link)) return;

        const xid = getXidFromHref(link.getAttribute('href') || '');
        if (!xid) return;
        const name = link.textContent.trim().replace(/:$/, '');
        if (!name) return;

        const row = findMessageRow(link);
        if (!row) return;

        // If this row previously belonged to a different user (recycled node),
        // wipe its stale state before reapplying.
        if (row.dataset.tchXid && row.dataset.tchXid !== xid) {
            row.classList.remove('tch-hidden-row');
        }

        row.dataset.tchXid = xid;
        row.dataset.tchName = name;
        applyHiddenState(row, xid, name);

        // Attached once per physical element: the handlers read live state off
        // the row/dataset when they fire, so they stay correct even after Torn
        // recycles the node for a different message.
        if (!listenersAttached.has(link)) {
            listenersAttached.add(link);

            const openFor = (x, y) => {
                const curXid = getXidFromHref(link.getAttribute('href') || '');
                const curName = link.textContent.trim().replace(/:$/, '');
                showContextMenu(x, y, curXid, curName);
            };

            // Desktop.
            link.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                e.stopPropagation();
                openFor(e.clientX, e.clientY);
            });

            // Mobile. A phone has no right-click, and PDA's WebView does not
            // raise `contextmenu` from a long-press either -- so on PDA the
            // menu had no way to open at all and the script looked dead even
            // once it loaded.
            //
            // LONG-PRESS, not tap: a tap on a name is Torn's own link to the
            // profile and must keep working.
            let pressTimer = null, pressed = null, fired = false;
            const HOLD_MS = 500;      // long enough not to catch a normal tap
            const SLOP_PX = 12;       // finger wander that is still a press

            const cancel = () => {
                if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; }
                pressed = null;
            };

            link.addEventListener('touchstart', (e) => {
                if (e.touches && e.touches.length > 1) { cancel(); return; }
                const t = e.touches && e.touches[0];
                if (!t) return;
                fired = false;
                pressed = { x: t.clientX, y: t.clientY };
                pressTimer = setTimeout(() => {
                    pressTimer = null;
                    if (!pressed) return;
                    fired = true;
                    openFor(pressed.x, pressed.y);
                }, HOLD_MS);
            }, { passive: true });

            // A scroll that began on a name is a scroll, not a press. Without
            // this, dragging the chat list open would pop the menu.
            link.addEventListener('touchmove', (e) => {
                const t = e.touches && e.touches[0];
                if (!pressed || !t) return;
                if (Math.abs(t.clientX - pressed.x) > SLOP_PX ||
                    Math.abs(t.clientY - pressed.y) > SLOP_PX) cancel();
            }, { passive: true });

            link.addEventListener('touchcancel', cancel, { passive: true });

            link.addEventListener('touchend', (e) => {
                cancel();
                // The press already opened the menu, so swallow the tap that
                // follows it -- otherwise Torn navigates to the profile and the
                // menu is gone before it can be read.
                if (fired) {
                    fired = false;
                    e.preventDefault();
                    e.stopPropagation();
                }
            });

            // Belt and braces for the same navigation: a click arriving within
            // a moment of the press is that press's tail.
            link.addEventListener('click', (e) => {
                if (fired) { e.preventDefault(); e.stopPropagation(); }
            }, true);
        }
    }

    function refreshAllRows() {
        document.querySelectorAll('[data-tch-xid]').forEach((row) => {
            if (!isInAnyContainer(row)) return;
            const xid = row.dataset.tchXid;
            const name = row.dataset.tchName;
            applyHiddenState(row, xid, name);
        });
    }

    function scan(root) {
        findNameLinks(root).forEach(processLink);
    }

    // Watch for new chat messages AND for existing nodes being recycled
    // (Torn's chat is virtualized - it often reuses row/link elements and
    // just changes their href/text instead of adding new DOM nodes).
    function attachObserver(container) {
        const obs = new MutationObserver((mutations) => {
            for (const m of mutations) {
                if (m.type === 'childList') {
                    m.addedNodes.forEach((node) => {
                        if (node.nodeType !== 1) return;
                        if (node.matches && node.matches('a[class*="sender"][href*="XID="]')) {
                            processLink(node);
                        }
                        scan(node);
                    });
                } else if (m.type === 'attributes') {
                    // e.g. href changed on a recycled name link
                    const el = m.target;
                    if (el.nodeType === 1 && el.matches && el.matches('a[class*="sender"][href*="XID="]')) {
                        processLink(el);
                    }
                } else if (m.type === 'characterData') {
                    // text content changed inside a recycled row
                    const parent = m.target.parentElement;
                    if (parent) scan(parent);
                }
            }
        });
        obs.observe(container, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['href'],
            characterData: true
        });
        return obs;
    }

    // Try to (re)locate allowed chat panels. Runs on load and periodically,
    // since panels can be torn down/recreated on navigation or opened for
    // the first time (e.g. switching to a tab that wasn't open before).
    function ensureContainers() {
        // drop any that got removed from the page
        for (const [el, obs] of containers) {
            if (!document.contains(el)) {
                obs.disconnect();
                containers.delete(el);
            }
        }
        // add any newly-found allowed panels
        findChatContainers().forEach((el) => {
            if (!containers.has(el)) {
                const obs = attachObserver(el);
                containers.set(el, obs);
                scan(el);
            }
        });
    }

    // ---------- the mini profile ----------
    //
    // Tapping a name in chat opens Torn's own mini-profile card. That is the
    // discoverable route: nobody guesses a long-press exists, and a button in
    // the card is reached by an ordinary tap with no gesture to get wrong.
    //
    // Torn REBUILDS this card every time it opens, so the button is re-added on
    // every pass rather than once -- the same reason the chat rows are re-synced
    // instead of processed once.
    const MINI_WRAP = '#profile-mini-root .mini-profile-wrapper';
    const MINI_BTN = 'tch-mini-btn';

    function miniXid(wrap) {
        // The card's own profile link. Several shapes are tried because this is
        // Torn's markup, not ours, and a wrong id would hide the wrong person --
        // so when none matches, nothing is injected at all.
        const sels = ['a[href*="profiles.php?XID="]', 'a[href*="XID="]', '[data-id]'];
        for (const sel of sels) {
            const el = wrap.querySelector(sel);
            if (!el) continue;
            const href = el.getAttribute('href') || '';
            const m = href.match(/XID=(\d+)/);
            if (m) return m[1];
            const d = el.getAttribute('data-id');
            if (d && /^\d+$/.test(d)) return d;
        }
        return null;
    }

    function miniName(wrap, xid) {
        const el = wrap.querySelector('a[href*="XID=' + xid + '"]');
        const t = el && el.textContent ? el.textContent.trim().replace(/:$/, '') : '';
        // A name is only needed for the label and the stored record; the id is
        // what actually does the hiding.
        return t || hiddenUsers[xid] || ('#' + xid);
    }

    function syncMiniProfile() {
        const wrap = document.querySelector(MINI_WRAP);
        if (!wrap) return;
        const list = wrap.querySelector('.buttons-list') || wrap.querySelector('[class*="buttons-list"]');
        if (!list) return;
        const xid = miniXid(wrap);
        if (!xid) return;

        let btn = list.querySelector('.' + MINI_BTN);
        if (!btn) {
            btn = document.createElement('button');
            btn.type = 'button';
            btn.className = MINI_BTN;
            list.appendChild(btn);
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const id = btn.dataset.tchXid;
                if (!id) return;
                if (hiddenUsers[id]) delete hiddenUsers[id];
                else hiddenUsers[id] = btn.dataset.tchName || ('#' + id);
                saveHiddenUsers(hiddenUsers);
                refreshAllRows();
                paintMini(btn, id);
            });
        }
        btn.dataset.tchXid = xid;
        btn.dataset.tchName = miniName(wrap, xid);
        paintMini(btn, xid);
    }

    function paintMini(btn, xid) {
        const hidden = !!hiddenUsers[xid];
        const label = hidden ? '\u2705 Unhide chat' : '\u{1F6AB} Hide chat';
        if (btn.textContent !== label) btn.textContent = label;
        btn.classList.toggle('tch-mini-on', hidden);
    }

    addStyle(`
        .${MINI_BTN} {
            display: block;
            width: 100%;
            margin: 4px 0 0;
            padding: 7px 10px;
            box-sizing: border-box;
            border: 1px solid #555;
            border-radius: 4px;
            background: #222;
            color: #eee;
            font: inherit;
            font-size: 12px;
            cursor: pointer;
        }
        .${MINI_BTN}.tch-mini-on { border-color: #4a7; color: #8d8; }
        @media (pointer: coarse) { .${MINI_BTN} { padding: 11px 12px; font-size: 14px; } }
    `);

    // Watch the card's own root so the button lands as the card opens rather
    // than up to a second later. #profile-mini-root is a stable container that
    // Torn empties and refills, so this is scoped tightly -- no body-wide
    // subtree observer. The poll below is still the net: on a page where the
    // root does not exist yet, this never attaches.
    let miniObs = null;
    function ensureMiniObserver() {
        const root = document.getElementById('profile-mini-root');
        if (!root || miniObs) {
            if (miniObs && !document.contains(miniObs.__root)) { miniObs.disconnect(); miniObs = null; }
            return;
        }
        miniObs = new MutationObserver(() => {
            try { syncMiniProfile(); } catch (e) { /* markup moved; the long-press still works */ }
        });
        miniObs.__root = root;
        miniObs.observe(root, { childList: true, subtree: true });
    }

    ensureContainers();
    ensureMiniObserver();
    setInterval(() => {
        ensureContainers();
        containers.forEach((_obs, el) => scan(el));
        ensureMiniObserver();
        // Cheap: one querySelector when no card is open, which is most ticks.
        try { syncMiniProfile(); } catch (e) { /* markup moved; the long-press still works */ }
    }, 1000);

})();