// ==UserScript==
// @name         Torn Chat Reactions
// @namespace    RussianRob
// @version      1.2.7
// @description  Emoji reactions on every Torn chat channel, public and private. A reaction is sent as an ordinary chat message, so people without the script still see a normal human reaction instead of junk. No server, no chat content leaves Torn.
// @author       RussianRob
// @license      GPL-3.0-or-later
// @match        https://www.torn.com/*
// @noframes
// @grant        unsafeWindow
// @run-at       document-idle
// @downloadURL  https://update.greasyfork.org/scripts/600153/Torn%20Chat%20Reactions.user.js
// @updateURL    https://update.greasyfork.org/scripts/600153/Torn%20Chat%20Reactions.meta.js
// ==/UserScript==

/*
 * A reaction is just a chat message:
 *
 *     (emoji) "ima need to get a 99k"
 *
 * With the script you see a chip on the quoted message and the raw line
 * disappears. Without it you see someone reacting normally. Torn carries the
 * data, so there is no server and no chat content anywhere but Torn.
 *
 * The quote is how a reaction finds its message. A bare emoji can only mean
 * "the one above", which falls apart as soon as you react to something
 * further up.
 *
 * Every public message has id="<uuid>:<senderId>" on its sender link, which
 * Torn assigns and which survives a reload. Private chats have no id at all
 * (one to one, so no sender name, so no link), which is why messages are
 * found by their bubble and the chips map is keyed by the message object.
 */

(function () {
    'use strict';

    const SCRIPT_VERSION = '1.2.7';

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

    const W = (typeof unsafeWindow !== 'undefined' && unsafeWindow) ? unsafeWindow : window;

    // ── chat plumbing ──────────────────────────────────────────────────────

    function chatRoot() { return document.getElementById('chatRoot'); }

    /** The chat window a message belongs to, found structurally: walk up until
     *  an ancestor contains a composer. That identifies faction, company, a
     *  private conversation or anything else Torn adds, without knowing a
     *  single channel id.
     *
     *  Bails if it reaches #chatRoot with more than one composer in scope --
     *  that means the message's own window has none and we would otherwise
     *  send into whichever channel happened to be first in the DOM. */
    function windowFor(el) {
        const root = chatRoot();
        let cur = el;
        while (cur && cur !== document.body) {
            const tas = cur.querySelectorAll ? cur.querySelectorAll('textarea[class*="textarea___"]') : [];
            if (tas.length === 1) return { scope: cur, ta: tas[0] };
            if (tas.length > 1) return null;      // ambiguous, refuse to guess
            if (cur === root) return null;
            cur = cur.parentElement;
        }
        return null;
    }

    /** Every rendered message, newest last. Anchored on Torn's id, not on a
     *  hashed CSS class: the id is data and survives a restyle, the class is
     *  regenerated on every Torn build. */
    function messages() {
        const root = chatRoot();
        if (!root) return [];
        const out = [];
        // Anchored on the BUBBLE, not the sender link. A private conversation
        // is one-to-one so Torn prints no sender name, which means no link and
        // no id -- the whole reason PMs found nothing. The bubble exists in
        // every channel (box___eWW6m in faction, box___ijzC5 in a PM; the hash
        // differs per component, the prefix does not).
        for (const bubble of root.querySelectorAll('[class*="box___"]')) {
            const a = bubble.querySelector('a[id]');
            const id = a && MSG_ID.test(a.id) ? a.id : null;
            // Public channels put the text in its own span alongside the
            // sender; a PM bubble IS the text.
            const textEl = bubble.querySelector('[class*="message___"]');
            const row = bubble.closest('[class*="virtualItem___"]') || bubble;
            // `self___` on the wrapper marks your own side of a conversation.
            // It is the only sender information a PM offers.
            const mine = /\bself___/.test(String((bubble.parentElement || row).className || ''));
            const win = windowFor(bubble);
            out.push({
                id,
                sender: a ? (a.textContent || '').trim() : (mine ? 'You' : 'Them'),
                text: (textEl ? textEl.textContent : bubble.textContent || '').trim(),
                bubble,
                row,
                // Which chat window this message is in. Reactions must resolve
                // within one channel: with faction and a PM both open, the same
                // words in each would otherwise let a reaction in one land on a
                // message in the other.
                win: win ? win.scope : null,
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

    function sendMessage(text, fromEl) {
        if (!text || busy) return;
        // The composer of the window the message is in. Sending every reaction
        // to the faction channel was the whole reason this only worked there --
        // react in a PM and the emoji would have landed in faction chat, in
        // front of everyone, quoting a private message.
        const win = windowFor(fromEl);
        const ta = win && win.ta;
        if (!ta) { toast('Could not find that channel composer'); return; }
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
            const scope = ta.parentElement || win.scope;
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

    // Reactions REMEMBERED, not re-derived each pass.
    //
    // The list is virtualised: only ~15 rows are mounted. Rebuilding the
    // registry from what is rendered meant that scrolling a reaction line out
    // of the window while its target stayed on screen removed the chip, and
    // scrolling back put it there again -- chips popping in and out. Once a
    // reaction has been seen it is kept, so the chip is stable.
    const seen = new Map();          // key -> Map(emoji -> Set(sender))
    const SEEN_CAP = 800;
    const winIds = new WeakMap();
    const winOther = new Map();   // for a null/non-element window
    let winSeq = 0;

    // Torn gives public messages a stable id. A PM has none, so fall back to
    // channel plus text, which is stable for the life of the message and is
    // the same thing the quote already matches on.
    function keyFor(m) {
        if (m.id) return m.id;
        // m.win is normally the chat window ELEMENT, but windowFor() returns
        // null when it cannot identify a composer -- and WeakMap.set(null)
        // throws, which would take down the whole pass. Elements go in the
        // WeakMap so detached windows can be collected; anything else goes in
        // a plain Map, which is tiny and bounded by the number of channels.
        const w = (m.win && typeof m.win === 'object')
            ? (winIds.get(m.win) ?? (winIds.set(m.win, ++winSeq), winSeq))
            : (winOther.get(m.win) ?? (winOther.set(m.win, ++winSeq), winSeq));
        return w + '|' + (m.text || '').slice(0, 120);
    }

    function remember(targetKey, emoji, sender) {
        let byEmoji = seen.get(targetKey);
        if (!byEmoji) {
            if (seen.size >= SEEN_CAP) seen.delete(seen.keys().next().value);
            byEmoji = new Map();
            seen.set(targetKey, byEmoji);
        }
        if (!byEmoji.has(emoji)) byEmoji.set(emoji, new Set());
        byEmoji.get(emoji).add(sender);
        return byEmoji;
    }

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
                if (all[j].win !== m.win) continue;     // never across channels
                if (all[j].text.includes(frag) && !REACTION.test(all[j].text)) { target = all[j]; break; }
            }
            // FAIL OPEN. No match means the message scrolled out of the
            // virtual list, or somebody typed a quote by hand. Leave the line
            // visible as an ordinary message -- swallowing something we cannot
            // attribute is worse than not converting it.
            if (!target) return;
            reg.set(target, remember(keyFor(target), emoji, m.sender));
            hide.push(m);
        });
        return { reg, hide };
    }

    // Belt and braces against a shake from some OTHER cause. If a row we
    // hid comes back visible, something else is re-rendering it; after a few
    // rounds of that, stop touching it. A visible line beats a flickering one.
    const hideTries = new WeakMap();
    function hideRow(row) {
        if (!row || row.style.display === 'none') return;
        row.style.visibility = '';          // no longer newest: collapse it
        const n = (hideTries.get(row) || 0) + 1;
        hideTries.set(row, n);
        if (n > 3) return;                   // it keeps coming back: leave it
        row.style.display = 'none';
    }
    // The NEWEST reaction is made invisible rather than removed.
    //
    // display:none COLLAPSES the row, and on the newest message that changes
    // the list height while the virtualiser is pinning you to the bottom --
    // it re-renders, we re-hide, and the chat shakes. visibility:hidden
    // collapses nothing: the row keeps its exact box, so there is nothing to
    // re-measure, and it is still laid out so Torn can see it and clear the
    // unread badge.
    //
    // The cost is a blank gap the height of one message, for the few seconds
    // until the next message arrives and it collapses properly. That beats
    // showing the raw quoted text, which is what was actually objected to.
    function blankRow(row) {
        if (!row || row.style.visibility === 'hidden') return;
        row.style.display = '';
        row.style.visibility = 'hidden';
    }

    function paint(all, reg, hide) {
        // Hide the reaction lines -- but NEVER the newest message in a
        // channel, which is where this went wrong before.
        //
        // display:none on a virtualItem___ row changes the list's measured
        // height. On the NEWEST row that fights the virtualiser's scroll-to-
        // bottom: it re-renders to compensate, this observer fires, the row
        // is hidden again, and the chat visibly shakes. The same row is also
        // the one Torn needs you to SEE to clear the unread badge, which is
        // why the channel stayed green. Older rows are already scrolled past
        // and drive neither.
        //
        // So the newest reaction shows its raw line until another message
        // arrives, then tidies itself away.
        const newest = new Map();            // win -> last message in it
        for (const m of all) newest.set(m.win, m);
        for (const m of hide) {
            if (newest.get(m.win) === m) blankRow(m.row);   // invisible, same size
            else hideRow(m.row);                            // gone entirely
        }
        for (const m of all) {
            const existing = m.bubble.parentElement
                && m.bubble.parentElement.querySelector(':scope > .tcr-chips');
            // From the durable store, so a chip survives its reaction line
            // being recycled out of the virtual window.
            const byEmoji = seen.get(keyFor(m));
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

    // A plain click on the message opens the picker. No corner button and no
    // long press: clicking is what people try, and it needs no affordance to
    // discover.
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
        // Uniqueness is judged within the message's OWN channel. A fragment
        // competing with text in some other open window is not ambiguous.
        const frag = quoteFor(m, messages().filter((x) => x.win === m.win));
        if (!frag) { toast('Nothing to quote in that message'); return; }
        sendMessage(emoji + ' "' + frag + '"', m.bubble);
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

    function pass() {
        queued = false;
        const root = chatRoot();
        if (!root) return;
        const all = messages();
        // Chat renders well after the script starts, so the first few
        // passes legitimately find nothing. Not an error.
        if (!all.length) return;
        // Disconnected across the write. This writes into the very subtree it
        // watches, and an observer reacting to its own writes is a runaway
        // loop that warms the phone in your hand.
        if (observer) observer.disconnect();
        try {
            const { reg, hide } = collect(all);
            paint(all, reg, hide);
            for (const m of all) if (!REACTION.test(m.text)) wire(m);
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
        else if (tries > 40) clearInterval(boot);
    }, 1500);

    void SCRIPT_VERSION;
})();
