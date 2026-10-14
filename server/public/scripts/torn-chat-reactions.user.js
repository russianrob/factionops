// ==UserScript==
// @name         Torn Chat Reactions
// @namespace    RussianRob
// @version      1.2.13
// @description  Emoji reactions on every Torn chat channel, public and private. A reaction is sent as an ordinary chat message, so people without the script still see a normal human reaction instead of junk. No server, no chat content leaves Torn.
// @author       RussianRob
// @license      GPL-3.0-or-later
// @match        https://www.torn.com/*
// @noframes
// @grant        unsafeWindow
// @grant        GM_setValue
// @grant        GM_getValue
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

    const SCRIPT_VERSION = '1.2.13';

    // Default six, plus a '+' that opens a picker for anything else.
    // The row a fresh install starts with. Once you have used anything it is
    // ranked out of the way -- see quickRow().
    const QUICK_DEFAULT = ['\u{1F602}', '\u{1F44D}', '❤️', '\u{1F525}', '\u{1F480}', '\u{1F62E}'];
    const QUICK_SLOTS = 6;
    const USE_KEY = 'tcr-emoji-use';
    const USE_CAP = 40;          // bound the stored map
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
        // The channel this message is actually in. Every composer we find has
        // to belong to it.
        //
        // Walking up until exactly one composer is in scope is not enough. A
        // COLLAPSED channel renders no composer but keeps its bubbles, so the
        // walk sailed past it and found the one open channel's composer
        // instead -- and then sendMessage() would have typed a quote of a
        // PRIVATE message into faction chat, which is verbatim the failure
        // windowFor exists to prevent.
        //
        // Checking the channel rather than the DOM depth is what makes this
        // layout-independent: bailing at #chatRoot only helps when the channel
        // boxes are its direct children, and any wrapper between them puts a
        // single composer in scope one level earlier, where the bail never
        // runs.
        const chan = channelOf(el);
        let cur = el;
        while (cur && cur !== document.body) {
            const tas = cur.querySelectorAll ? cur.querySelectorAll('textarea[class*="textarea___"]') : [];
            if (tas.length === 1) {
                // Refuse when either side is unnameable. A visible "could not
                // find that channel composer" is the right failure; posting
                // into the wrong channel is not.
                const taChan = channelOf(tas[0]);
                if (!chan || !taChan || taChan !== chan) return null;
                return { scope: cur, ta: tas[0] };
            }
            if (tas.length > 1) return null;      // ambiguous, refuse to guess
            if (cur === root) return null;
            cur = cur.parentElement;
        }
        return null;
    }

    /** Does this className mark the viewer's own side of a conversation?
     *
     *  Matched as a whole CLASS TOKEN, never with /\bself___/: `-` is a word
     *  boundary, so that pattern also fires on a class like
     *  `position-self___hash`, and Torn uses that shape elsewhere in the
     *  product. A false positive here reads somebody else's message as your
     *  own, which is the dangerous direction. */
    function isSelf(className) {
        return String(className || '').split(/\s+/).some((c) => c.indexOf('self___') === 0);
    }

    /** A message's own text, with our chip strip excluded.
     *
     *  The strip is now a CHILD of the bubble so it can hang off the bubble's
     *  bottom edge, and a PM bubble has no inner message element -- its text is
     *  read from the bubble itself. Without this filter the chip emoji would
     *  become part of the message text, and in a PM the text IS the registry
     *  key, so every reaction would change the key of the very message it
     *  decorates and the chip would detach from it on the next pass.
     */
    function bubbleText(bubble, textEl) {
        if (textEl) return (textEl.textContent || '').trim();
        let t = '';
        for (const n of bubble.childNodes) {
            if (n.nodeType === 1 && n.classList && n.classList.contains('tcr-chips')) continue;
            t += n.textContent || '';
        }
        return t.trim();
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
            const mine = isSelf((bubble.parentElement || row).className);
            const win = windowFor(bubble);
            out.push({
                id,
                // Torn's channel name, resolved once per message: every key and
                // every cross-channel comparison goes through this.
                chan: channelOf(bubble),
                sender: a ? (a.textContent || '').trim() : (mine ? 'You' : 'Them'),
                text: bubbleText(bubble, textEl),
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
    // Every message text we have ever rendered, per channel, so a reaction can
    // still find its target after the virtualiser has recycled that target
    // away. Without this a reaction whose target has scrolled out of the
    // ~15-row window matches nothing, fails open, and sits in the chat as raw
    // quoted text -- which is exactly what it looked like.
    const texts = new Map();         // winId -> [{ text, key }], newest last
    const SEEN_CAP = 800;
    const winIds = new WeakMap();
    const winOther = new Map();   // for a null/non-element window
    let winSeq = 0;

    /** Torn's own name for the channel a message is in.
     *
     *  `windowFor()` can only name a window that HAS a composer, and a
     *  collapsed channel has none -- so every window it could not name fell
     *  into one shared bucket, and two different conversations containing the
     *  same words got the same key. A reaction in one then decorated a message
     *  in the other.
     *
     *  The channel container carries an id whether or not it is open:
     *  `faction`, `company`, or the peer's player id for a private chat (and
     *  `faction-<id>` / `private-<uid>-<uid>` on the older Chat 3.0 markup).
     *  Measured live: a collapsed PM box, 20 bubbles, no composer, id 2862329.
     *
     *  Takes the OUTERMOST id below #chatRoot, so an inner wrapper that happens
     *  to carry an id cannot split one channel into several. */
    function channelOf(el) {
        const root = chatRoot();
        let cur = el, found = null;
        while (cur && cur !== document.body && cur !== root) {
            if (cur.id) found = String(cur.id);
            cur = cur.parentElement;
        }
        return found ? 'c:' + found : null;
    }

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
        return winIdOf(m) + '|' + (m.text || '').slice(0, 120);
    }

    function winIdOf(m) {
        // Torn's own channel name first: it is stable, unique per conversation,
        // and survives the channel being collapsed.
        if (m.chan) return m.chan;
        if (m.win && typeof m.win === 'object') {
            const w = winIds.get(m.win);
            if (w !== undefined) return w;
            winIds.set(m.win, ++winSeq);
            return winSeq;
        }
        const w = winOther.get(m.win);
        if (w !== undefined) return w;
        winOther.set(m.win, ++winSeq);
        return winSeq;
    }

    /** Remember a message so a later reaction can still find it. */
    function note(m) {
        if (REACTION.test(m.text)) return;      // reactions are not targets
        const w = winIdOf(m);
        let list = texts.get(w);
        if (!list) { list = []; texts.set(w, list); }
        const key = keyFor(m);
        if (list.length && list[list.length - 1].key === key) return;
        if (!list.some((e) => e.key === key)) {
            list.push({ text: m.text, key });
            if (list.length > 400) list.shift();
        }
    }

    /** The most recent remembered message in this channel containing frag. */
    function findRemembered(m, frag) {
        const list = texts.get(winIdOf(m));
        if (!list) return null;
        for (let i = list.length - 1; i >= 0; i--) {
            if (list[i].text.includes(frag)) return list[i].key;
        }
        return null;
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
        all.forEach((m) => note(m));
        all.forEach((m, idx) => {
            const hit = REACTION.exec(m.text);
            if (!hit) return;
            const emoji = hit[1];
            const frag = hit[2];
            // The target is the most recent message BEFORE this one carrying
            // the quoted fragment.
            let target = null;
            for (let j = idx - 1; j >= 0; j--) {
                // By resolved channel, not by window element: two windows that
                // windowFor() could not name are both null, and null === null,
                // so a reaction in one used to find a target in the other.
                if (winIdOf(all[j]) !== winIdOf(m)) continue;
                if (all[j].text.includes(frag) && !REACTION.test(all[j].text)) { target = all[j]; break; }
            }
            // FAIL OPEN. No match means the message scrolled out of the
            // virtual list, or somebody typed a quote by hand. Leave the line
            // visible as an ordinary message -- swallowing something we cannot
            // attribute is worse than not converting it.
            if (target) {
                reg.set(target, remember(keyFor(target), emoji, m.sender));
                hide.push(m);
                return;
            }
            // Not on screen -- but we may have rendered it earlier this
            // session. Matching from the index means the reaction is still
            // resolved (and so still hidden) when its target has scrolled
            // away. Only a fragment we have genuinely never seen stays
            // visible, which keeps the fail-open rule intact.
            const key = findRemembered(m, frag);
            if (!key) return;
            remember(key, emoji, m.sender);
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
        // By resolved channel, not the window element: several composer-less
        // boxes share one window object, so all but one of them lost its
        // newest-row entry and got display:none where it needed
        // visibility:hidden.
        for (const m of all) newest.set(winIdOf(m), m);
        for (const m of hide) {
            if (newest.get(winIdOf(m)) === m) blankRow(m.row);   // invisible, same size
            else hideRow(m.row);                            // gone entirely
        }
        for (const m of all) {
            // INSIDE the bubble, not after it. As a sibling the strip was laid
            // out by the bubble's parent, and that parent arranges its children
            // in a row -- so the strip was squeezed to one chip per line and
            // became a vertical column down the right-hand side, making the
            // message a line taller for every reaction on it.
            const existing = m.bubble.querySelector(':scope > .tcr-chips');
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
            const bs = getComputedStyle(m.bubble);
            // The bubble is the positioning context, so the strip hangs off the
            // bubble's own bottom edge rather than its wrapper's -- the wrapper
            // is taller than the bubble by a margin we do not control.
            if (bs.position === 'static') m.bubble.style.position = 'relative';
            // The strip deliberately overhangs, so a bubble that clips would
            // slice it in half.
            if (bs.overflow !== 'visible') m.bubble.style.overflow = 'visible';
            // Out of flow and overhanging the 5px gap below the message. An
            // absolutely positioned strip contributes NO height, so the row the
            // virtualiser already measured does not change and it never
            // re-measures -- the same hazard behind the shake bug. nowrap
            // because wrapping is what stacked them.
            // `top:100%` pins the strip's TOP to the bubble's bottom edge, so the
            // whole chip hangs below whatever height it renders at. A negative
            // `bottom` could not do this: it pins the chip's BOTTOM, so the taller
            // the chip the further UP its top reaches -- and an emoji glyph blows
            // well past its 15px line box, which is how 1.2.9 ended up covering
            // the last line of text. The -3px just tucks it into the bubble's own
            // bottom padding so it reads as attached rather than floating.
            chips.style.cssText = 'position:absolute;left:6px;top:100%;margin-top:-3px;z-index:5;'
                + 'display:flex;gap:4px;flex-wrap:nowrap;white-space:nowrap;'
                // Taps fall through: to the bubble beneath (which opens the
                // picker) and to the message below, which the strip now covers.
                + 'pointer-events:none';
            // Opaque, borrowed from the message it belongs to. Translucent chips
            // read as mud where they cross onto the next bubble, and borrowing
            // means this follows whichever theme Torn is rendering.
            let bg = bs.backgroundColor || '';
            if (!bg || bg === 'transparent' || /rgba\(0, 0, 0, 0\)/.test(bg)) bg = '#2b2f36';
            for (const [e, who] of byEmoji) {
                const chip = document.createElement('span');
                chip.textContent = e + (who.size > 1 ? ' ' + who.size : '');
                chip.title = [...who].join(', ');
                chip.style.cssText = 'background:' + bg + ';border:1px solid rgba(255,255,255,.22);'
                    + 'border-radius:9px;padding:0 5px;font-size:10px;line-height:15px;'
                    + 'box-shadow:0 1px 2px rgba(0,0,0,.45);cursor:default';
                chips.appendChild(chip);
            }
            if (!existing) m.bubble.appendChild(chips);
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

    // -- the quick row, ranked by what you actually use ----------------------
    //
    // Every GM_* call is typeof-guarded. An unguarded one throws on PDA before
    // any UI exists, which kills the whole script rather than one feature.

    function gmGet(key, fallback) {
        try {
            if (typeof GM_getValue !== 'function') return fallback;
            const v = GM_getValue(key, null);
            return v == null ? fallback : v;
        } catch (_) { return fallback; }
    }
    function gmSet(key, value) {
        try { if (typeof GM_setValue === 'function') GM_setValue(key, value); } catch (_) {}
    }

    /** { emoji: [useCount, lastUsedMs] } */
    function loadUse() {
        const raw = gmGet(USE_KEY, null);
        if (!raw) return {};
        try {
            const o = typeof raw === 'string' ? JSON.parse(raw) : raw;
            return (o && typeof o === 'object') ? o : {};
        } catch (_) { return {}; }
    }

    function noteUse(emoji) {
        if (!emoji) return;
        const use = loadUse();
        const prev = use[emoji];
        use[emoji] = [(prev && prev[0] ? prev[0] : 0) + 1, Date.now()];
        // Keep the map bounded: drop the least used, oldest first on a tie.
        const keys = Object.keys(use);
        if (keys.length > USE_CAP) {
            keys.sort((a, b) => (use[b][0] - use[a][0]) || (use[b][1] - use[a][1]));
            const kept = {};
            for (const k of keys.slice(0, USE_CAP)) kept[k] = use[k];
            gmSet(USE_KEY, JSON.stringify(kept));
            return;
        }
        gmSet(USE_KEY, JSON.stringify(use));
    }

    /** The six on the quick row.
     *
     *  Ranked by use COUNT, so the row is stable and your regulars stay put --
     *  pure recency would let six novelty emoji push your thumbs-up off it.
     *  But the most recently used one is always included even when its count is
     *  low, so something picked out of the grid is one tap away immediately
     *  instead of having to out-rank everything you have ever used first.
     *  Padded from the defaults until you have used six different things. */
    function quickRow() {
        const use = loadUse();
        const used = Object.keys(use);
        if (!used.length) return QUICK_DEFAULT.slice();
        used.sort((a, b) => (use[b][0] - use[a][0]) || (use[b][1] - use[a][1]));
        const row = used.slice(0, QUICK_SLOTS);
        // The one used most recently, wherever it ranks.
        let recent = used[0];
        for (const e of used) if (use[e][1] > use[recent][1]) recent = e;
        if (row.indexOf(recent) < 0) row[QUICK_SLOTS - 1] = recent;
        for (const e of QUICK_DEFAULT) {
            if (row.length >= QUICK_SLOTS) break;
            if (row.indexOf(e) < 0) row.push(e);
        }
        return row;
    }

    let openMenu = null;
    function closeMenu() { if (openMenu) { openMenu.remove(); openMenu = null; } }
    document.addEventListener('click', closeMenu);

    function react(m, emoji) {
        closeMenu();
        // Counted on send, not on open, so merely browsing the grid does not
        // reorder your row.
        noteUse(emoji);
        // Uniqueness is judged within the message's OWN channel. A fragment
        // competing with text in some other open window is not ambiguous.
        const frag = quoteFor(m, messages().filter((x) => winIdOf(x) === winIdOf(m)));
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
        for (const e of quickRow()) menu.appendChild(mk(e, () => react(m, e)));
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
