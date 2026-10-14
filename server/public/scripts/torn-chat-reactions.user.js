// ==UserScript==
// @name         Torn Chat Reactions
// @namespace    RussianRob
// @version      1.0.4
// @description  Emoji reactions on Torn faction chat. A reaction is sent as an ordinary chat message, so people without the script still see a normal human reaction instead of junk. No server, no chat content leaves Torn.
// @author       RussianRob
// @license      GPL-3.0-or-later
// @match        https://www.torn.com/*
// @noframes
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        unsafeWindow
// @grant        GM_xmlhttpRequest
// @connect      tornwar.com
// @run-at       document-idle
// @downloadURL  https://tornwar.com/scripts/torn-chat-reactions.user.js
// @updateURL    https://tornwar.com/scripts/torn-chat-reactions.meta.js
// ==/UserScript==

/*
 * CHANGELOG
 * 1.0.4 - The diagnostic reports the first SUCCESSFUL pass instead of the
 *         first pass. Chat renders long after the script starts, so the
 *         one-shot report was being spent on an empty DOM and then falling
 *         silent for the pass that worked. A 45s timeout covers the case
 *         where nothing is ever found.
 *
 * 1.0.3 - The '+' grid no longer summons the keyboard over itself. The free
 *         text field is no longer auto-focused, the menu is wider and
 *         scrollable on a phone, and it repositions after expanding instead
 *         of keeping a size measured before the grid appeared.
 *
 * 1.0.2 - Click the message to react, replacing the corner button and the
 *         long-press. Guards against hijacking links, buttons and an active
 *         text selection, and deliberately does not stopPropagation so
 *         Torn's own click handling on the row still runs.
 *
 * 1.0.1 - The react button is visible by default instead of hover-only, and
 *         holding the MESSAGE opens the picker (right-click on desktop) --
 *         the gesture everybody tries first. Adds a one-shot diagnostic,
 *         because 'nothing pops up' had no way to tell me whether the script
 *         found any messages at all.
 *
 * 1.0.0 - First cut.
 *
 *         HOW IT WORKS, and why there is no server. Tapping a reaction sends
 *         an ordinary chat message:
 *
 *             (emoji) "ima need to get a 99k"
 *
 *         Anyone running this script sees it parsed into a chip on the quoted
 *         message and the raw line hidden. Anyone NOT running it sees a
 *         perfectly normal human reaction. Torn carries the data, so nothing
 *         is stored anywhere and no chat content ever leaves the site.
 *
 *         The quote is how a reaction finds its target. A bare emoji would
 *         only ever mean "the message above", which breaks the moment you
 *         react to something further up.
 *
 *         Message identity comes from Torn itself: every chat message carries
 *         id="<uuid>:<senderId>" on its sender link, server-assigned and
 *         stable across reloads (verified: 10 of 10 ids survived two separate
 *         page loads). That is what makes a chip stick to the right message
 *         through the list's virtual recycling.
 */

(function () {
    'use strict';

    const SCRIPT_VERSION = '1.0.4';

    // Default six, plus a '+' that opens a picker for anything else.
    const QUICK = ['\u{1F602}', '\u{1F44D}', '❤️', '\u{1F525}', '\u{1F480}', '\u{1F62E}'];
    const PICKER = [
        '\u{1F602}','\u{1F923}','\u{1F605}','\u{1F600}','\u{1F609}','\u{1F60E}','\u{1F970}','\u{1F618}',
        '\u{1F44D}','\u{1F44E}','\u{1F44F}','\u{1F64C}','\u{1F4AA}','\u{1F91D}','\u{1F64F}','\u{1F44A}',
        '❤️','\u{1F49A}','\u{1F494}','\u{1F525}','⭐','✨','\u{1F4AF}','\u{1F3AF}',
        '\u{1F480}','\u{1F47B}','\u{1F608}','\u{1F921}','\u{1F92C}','\u{1F624}','\u{1F62D}','\u{1F622}',
        '\u{1F62E}','\u{1F633}','\u{1F914}','\u{1F928}','\u{1F644}','\u{1F971}','\u{1F634}','\u{1F910}',
        '\u{1F4B0}','\u{1F48A}','\u{1F52B}','⚔️','\u{1F6E1}️','\u{1F3C6}','\u{1F6A8}','\u{1F440}',
    ];

    // Torn's own message id: <uuid>:<senderPlayerId>. Server-assigned, which
    // is the whole reason reactions can be shared at all.
    const MSG_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}:\d+$/i;
    // A reaction message: one or more emoji, a space, then the quoted anchor.
    const REACTION = /^(\S+)\s+"([\s\S]+)"$/u;
    const QUOTE_LEN = 24;
    const MARK = 'data-tcr';

    function gmGet(k, d) { try { return typeof GM_getValue === 'function' ? GM_getValue(k, d) : d; } catch (_) { return d; } }
    function gmSet(k, v) { try { if (typeof GM_setValue === 'function') GM_setValue(k, v); } catch (_) {} }

    const W = (typeof unsafeWindow !== 'undefined' && unsafeWindow) ? unsafeWindow : window;

    // ── chat plumbing ──────────────────────────────────────────────────────

    function chatRoot() { return document.getElementById('chatRoot'); }

    function factionBox() {
        const root = chatRoot();
        if (!root) return null;
        return root.querySelector('[id="faction"]') || root.querySelector('[id^="faction-"]');
    }

    /** Every rendered message, newest last. Anchored on Torn's id, not on a
     *  hashed CSS class: the id is data and survives a restyle, the class is
     *  regenerated on every Torn build. */
    function messages() {
        const root = chatRoot();
        if (!root) return [];
        const out = [];
        for (const a of root.querySelectorAll('a[id]')) {
            if (!MSG_ID.test(a.id)) continue;
            const bubble = a.closest('[class*="box___"]');
            if (!bubble) continue;
            const textEl = bubble.querySelector('[class*="message___"]');
            out.push({
                id: a.id,
                sender: (a.textContent || '').trim(),
                text: textEl ? (textEl.textContent || '').trim() : '',
                bubble,
                row: bubble.closest('[class*="virtualItem___"]') || bubble,
            });
        }
        return out;
    }

    // ── sending ────────────────────────────────────────────────────────────
    //
    // Lifted wholesale from factionops' sendCallToChat, which earned every
    // line of this the hard way: the native setter must come from
    // HTMLTextAreaElement (the input one silently no-ops), React's
    // _valueTracker has to be rewound or onChange never fires and the send
    // button never enables, and the enable flip has to be POLLED because a
    // phone can take ~450ms to re-render.

    let busy = false;

    function sendMessage(text) {
        if (!text || busy) return;
        const box = factionBox();
        const ta = box && box.querySelector('textarea[class*="textarea___"]');
        if (!ta) { toast('Open faction chat first'); return; }
        // Never type over a draft. The send button is enabled whenever the box
        // is non-empty, so with a draft present an enabled button proves
        // nothing about whether React took OUR text -- and we would post the
        // user's half-typed line instead.
        if (ta.value) { toast('Finish or clear your draft first'); return; }

        busy = true;
        try {
            const d = Object.getOwnPropertyDescriptor(
                (W.HTMLTextAreaElement || HTMLTextAreaElement).prototype, 'value');
            if (d && typeof d.set === 'function') d.set.call(ta, text);
            else ta.value = text;
            try {
                const tracker = ta._valueTracker;
                if (tracker && typeof tracker.setValue === 'function') tracker.setValue('');
            } catch (_) {}
            ta.dispatchEvent(new (W.Event || Event)('input', { bubbles: true }));
        } catch (_) { busy = false; toast('Could not type into chat'); return; }

        const deadline = Date.now() + 2500;
        const tick = () => {
            const b = factionBox();
            const t = b && b.querySelector('textarea[class*="textarea___"]');
            const scope = t ? (t.parentElement || b) : b;
            const btn = scope && scope.querySelector('button:not([disabled])');
            if (btn) { try { btn.click(); } catch (_) {} busy = false; return; }
            if (Date.now() > deadline) { busy = false; toast('Chat send button never enabled'); return; }
            setTimeout(tick, 50);
        };
        setTimeout(tick, 50);
    }

    /** The fragment that points a reaction at its message. Long enough to be
     *  unique among what is on screen, short enough to read naturally. */
    function quoteFor(msg, all) {
        const words = (msg.text || '').trim().split(/\s+/).filter(Boolean);
        if (!words.length) return null;
        let used = 0, frag = '';
        while (used < words.length && frag.length < QUOTE_LEN) {
            frag = frag ? frag + ' ' + words[used] : words[used];
            used += 1;
        }
        // Extend a word at a time while more than one visible message contains
        // the fragment, so a chip cannot land on the wrong line. Reactions are
        // excluded from the count -- they quote the fragment by definition.
        const ambiguous = () => all.filter((m) => m.text.includes(frag) && !REACTION.test(m.text)).length > 1;
        while (used < words.length && ambiguous()) {
            frag += ' ' + words[used];
            used += 1;
        }
        return frag;
    }

    // ── reaction registry ──────────────────────────────────────────────────
    // messageId -> emoji -> Set(sender). Rebuilt from the DOM every pass, so
    // the virtual list recycling rows cannot lose anything.

    function collect(all) {
        const reg = new Map();
        const hide = [];
        all.forEach((m, idx) => {
            const hit = REACTION.exec(m.text);
            if (!hit) return;
            const emoji = hit[1];
            const frag = hit[2];
            // The target is the most recent message BEFORE this one carrying
            // the quoted fragment.
            let target = null;
            for (let j = idx - 1; j >= 0; j--) {
                if (all[j].text.includes(frag) && !REACTION.test(all[j].text)) { target = all[j]; break; }
            }
            // FAIL OPEN. No match means the message scrolled out of the
            // virtual list, or somebody typed a quote by hand. Leave the line
            // visible as an ordinary message -- swallowing something we cannot
            // attribute is worse than not converting it.
            if (!target) return;
            if (!reg.has(target.id)) reg.set(target.id, new Map());
            const byEmoji = reg.get(target.id);
            if (!byEmoji.has(emoji)) byEmoji.set(emoji, new Set());
            byEmoji.get(emoji).add(m.sender);
            hide.push(m.row);
        });
        return { reg, hide };
    }

    function paint(all, reg, hide) {
        for (const row of hide) row.style.display = 'none';
        for (const m of all) {
            const existing = m.bubble.parentElement
                && m.bubble.parentElement.querySelector(':scope > .tcr-chips');
            const byEmoji = reg.get(m.id);
            if (!byEmoji || !byEmoji.size) { if (existing) existing.remove(); continue; }
            const want = [...byEmoji.entries()]
                .map(([e, who]) => e + (who.size > 1 ? ' ' + who.size : ''))
                .join(' ');
            if (existing && existing.dataset.tcrWant === want) continue;
            const chips = existing || document.createElement('div');
            chips.className = 'tcr-chips';
            chips.dataset.tcrWant = want;
            chips.textContent = '';
            chips.style.cssText = 'display:flex;gap:4px;flex-wrap:wrap;margin:2px 0 0 4px';
            for (const [e, who] of byEmoji) {
                const chip = document.createElement('span');
                chip.textContent = e + (who.size > 1 ? ' ' + who.size : '');
                chip.title = [...who].join(', ');
                chip.style.cssText = 'background:rgba(255,255,255,.10);border:1px solid rgba(255,255,255,.18);'
                    + 'border-radius:10px;padding:1px 6px;font-size:11px;line-height:1.5;cursor:default';
                chips.appendChild(chip);
            }
            if (!existing) m.bubble.insertAdjacentElement('afterend', chips);
        }
    }

    // ── the add-reaction button ────────────────────────────────────────────

    // 1.0.2: a plain CLICK on the message opens the picker. Replaces both the
    // corner button and the long-press -- clicking is what was asked for and
    // it needs no affordance to discover.
    function wire(m) {
        if (m.bubble.getAttribute(MARK)) return;
        m.bubble.setAttribute(MARK, '1');
        m.bubble.style.cursor = 'pointer';

        const open = (ev) => {
            // Never hijack a real control. The sender name is a profile link
            // and messages can carry item/user links; swallowing those would
            // break chat to add an emoji to it.
            if (ev.target.closest && ev.target.closest('a, button, input, textarea, select')) return;
            // Nor a selection in progress -- the user is copying text, not
            // reacting.
            const sel = W.getSelection && W.getSelection();
            if (sel && String(sel).length > 0 && !sel.isCollapsed) return;
            // Deliberately NOT stopPropagation: Torn has its own click
            // handling on these rows (the bubble carries
            // data-is-tooltip-opened) and suppressing it would break whatever
            // that does. Opening on the next tick instead lets the document
            // click handler close any previous menu BEFORE this one opens,
            // which is the only reason stopPropagation was tempting.
            const x = ev.clientX, y = ev.clientY;
            setTimeout(() => openPicker(m, { getBoundingClientRect: () => ({ left: x, top: y }) }), 0);
        };

        m.bubble.addEventListener('click', open);
        m.bubble.addEventListener('contextmenu', (ev) => { ev.preventDefault(); open(ev); });
    }

    let openMenu = null;
    function closeMenu() { if (openMenu) { openMenu.remove(); openMenu = null; } }
    document.addEventListener('click', closeMenu);

    function react(m, emoji) {
        closeMenu();
        const frag = quoteFor(m, messages());
        if (!frag) { toast('Nothing to quote in that message'); return; }
        sendMessage(emoji + ' "' + frag + '"');
    }

    function openPicker(m, anchor) {
        closeMenu();
        const menu = document.createElement('div');
        // Wider and scrollable on a phone: 48 emoji in a 240px column is a
        // very tall menu, and a tall fixed menu runs off the screen.
        menu.style.cssText = 'position:fixed;z-index:2147483647;background:#0f1a2e;border:1px solid #1e3a5f;'
            + 'border-radius:8px;padding:6px;display:flex;gap:4px;flex-wrap:wrap;'
            + 'max-width:min(320px,92vw);max-height:50vh;overflow-y:auto;'
            + 'box-shadow:0 8px 24px rgba(0,0,0,.5)';
        menu.addEventListener('click', (e) => e.stopPropagation());

        const mk = (label, fn) => {
            const b = document.createElement('button');
            b.type = 'button';
            b.textContent = label;
            b.style.cssText = 'border:0;background:transparent;font-size:18px;line-height:1;cursor:pointer;padding:2px';
            b.addEventListener('click', fn);
            return b;
        };
        for (const e of QUICK) menu.appendChild(mk(e, () => react(m, e)));
        menu.appendChild(mk('+', () => {
            menu.textContent = '';
            for (const e of PICKER) menu.appendChild(mk(e, () => react(m, e)));
            // Anything not in the grid: the OS emoji keyboard works in a real
            // input, which beats shipping the whole Unicode table.
            const inp = document.createElement('input');
            inp.type = 'text';
            inp.placeholder = 'or type one';
            inp.style.cssText = 'width:100%;margin-top:4px;background:#060b12;border:1px solid #1e3a5f;'
                + 'color:#e5e7eb;border-radius:4px;padding:4px 6px;font-size:13px';
            inp.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && inp.value.trim()) react(m, inp.value.trim().slice(0, 8));
            });
            menu.appendChild(inp);
            // NOT focused. Auto-focusing summoned the phone keyboard on top of
            // the grid that had just opened, so the only way to see the emoji
            // was to dismiss the keyboard first. The field is there for anyone
            // who wants their own emoji; tapping it raises the keyboard then.
            place();
        }));

        document.body.appendChild(menu);
        // Re-run after the '+' swap too: the menu changes size when the full
        // grid replaces the six quick picks, and a position measured before
        // that leaves it hanging off the screen.
        function place() {
            const r = anchor.getBoundingClientRect();
            const w = menu.offsetWidth, h = menu.offsetHeight;
            menu.style.left = Math.max(4, Math.min(r.left - w / 2, innerWidth - w - 8)) + 'px';
            // Above the tap by preference so a finger does not cover it, below
            // when there is no room above.
            const above = r.top - h - 8;
            menu.style.top = (above >= 4 ? above : Math.min(r.top + 24, innerHeight - h - 8)) + 'px';
        }
        place();
        openMenu = menu;
    }

    function toast(msg) {
        const n = document.createElement('div');
        n.textContent = msg;
        n.style.cssText = 'position:fixed;bottom:12px;left:12px;z-index:2147483647;background:#0f1a2e;'
            + 'color:#f5d76e;border:1px solid #1e3a5f;border-radius:6px;padding:8px 12px;'
            + 'font:12px/1.4 Arial,sans-serif';
        document.body.appendChild(n);
        setTimeout(() => n.remove(), 4000);
    }

    // ── the pass ───────────────────────────────────────────────────────────

    let observer = null;
    let queued = false;

    let diagSent = false;
    function diag(data) {
        if (diagSent) return;
        diagSent = true;
        try {
            if (typeof GM_xmlhttpRequest === 'function') {
                GM_xmlhttpRequest({
                    method: 'POST', url: 'https://tornwar.com/api/debug/client-log',
                    headers: { 'Content-Type': 'application/json' },
                    data: JSON.stringify({ tag: 'tcr', data: Object.assign({ v: SCRIPT_VERSION }, data) }),
                });
            }
        } catch (_) {}
    }

    function pass() {
        queued = false;
        const root = chatRoot();
        if (!root) { diag({ reason: 'no-chatRoot' }); return; }
        const all = messages();
        if (!all.length) {
            // NOT reported here any more. Chat renders well after the script
            // starts, so the first few passes legitimately find nothing -- and
            // a one-shot diagnostic spent its only report on them, logging
            // 'anchors:0' and then falling silent for the pass that actually
            // worked. Only a pass that found messages is worth a line; if none
            // ever does, the timeout below says so instead.
            return;
        }
        // Disconnected across the write. This writes into the very subtree it
        // watches, and an observer reacting to its own writes is a runaway
        // loop that warms the phone in your hand.
        if (observer) observer.disconnect();
        try {
            const { reg, hide } = collect(all);
            paint(all, reg, hide);
            let added = 0;
            for (const m of all) if (!REACTION.test(m.text)) { if (!m.bubble.getAttribute(MARK)) added += 1; wire(m); }
            diag({ reason: 'ok', messages: all.length, buttonsAdded: added,
                   reactions: reg.size, hidden: hide.length,
                   touch: matchMedia('(hover: none)').matches });
        } finally { observe(); }
    }

    function queue() { if (queued) return; queued = true; setTimeout(pass, 150); }

    function observe() {
        const root = chatRoot();
        if (!root) return;
        if (!observer) observer = new MutationObserver(queue);
        // Scoped to #chatRoot, never document.body: the whole page mutates
        // constantly and this only cares about one subtree.
        observer.observe(root, { childList: true, subtree: true });
    }

    let tries = 0;
    const boot = setInterval(() => {
        tries += 1;
        if (chatRoot()) { clearInterval(boot); observe(); queue(); }
        else if (tries > 40) { clearInterval(boot); diag({ reason: 'no-chatRoot-after-60s' }); }
    }, 1500);

    // If no pass ever finds a message, say so once -- that is the genuinely
    // broken case, and silence is how it used to look.
    setTimeout(() => {
        if (diagSent) return;
        const root = chatRoot();
        diag({ reason: 'never-found-messages',
               chatRoot: Boolean(root),
               anchors: root ? root.querySelectorAll('a[id]').length : 0,
               boxes: root ? root.querySelectorAll('[class*="box___"]').length : 0 });
    }, 45000);

    void SCRIPT_VERSION; void gmGet; void gmSet;
})();
