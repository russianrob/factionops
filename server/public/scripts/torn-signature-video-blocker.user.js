// ==UserScript==
// @name         Torn Signature Video Blocker
// @namespace    RussianRob
// @version      1.0.0
// @author       RussianRob
// @description  Stops profiles with many embedded videos from crashing and reloading the page. Replaces video iframes with click-to-load placeholders.
// @license      GPL-3.0-or-later
// @match        https://www.torn.com/profiles.php*
// @match        https://pda.torn.com/profiles.php*
// @grant        none
// @run-at       document-start
// @downloadURL  https://tornwar.com/scripts/torn-signature-video-blocker.user.js
// @updateURL    https://tornwar.com/scripts/torn-signature-video-blocker.meta.js
// ==/UserScript==

// =============================================================================
// CHANGELOG
// =============================================================================
// v1.0.0  - Initial release. Neuters video iframes in profile signatures.
//           Written after profile XID=500173 was found to carry 59 YouTube
//           embeds in its signature, which exhausts the web content process
//           on a phone: iOS kills the renderer and the page reloads, forever.
//           Reproduced in both Safari and the warboard app, which is what
//           ruled out a userscript or a meta-refresh as the cause.
// =============================================================================

(function () {
    'use strict';

    // Each YouTube embed loads a full player runtime. A signature with dozens of
    // them is megabytes of JS and several decoders per page — far past what a
    // phone's renderer is given. The tab does not "refresh"; the web content
    // process is killed and the page comes back from scratch. That is why the
    // navigation type reads "navigate" rather than "reload", why sessionStorage
    // is wiped, and why it happens in every browser rather than one app.
    const VIDEO_HOST = /(?:youtube(?:-nocookie)?\.com|youtu\.be|vimeo\.com|dailymotion\.com|streamable\.com)/i;

    // Only iframes are neutered, and only video ones — Torn uses iframes of its
    // own elsewhere on the page and they must keep working.
    function isVideoFrame(el) {
        if (!el || el.tagName !== 'IFRAME') return false;
        const src = el.getAttribute('src') || el.getAttribute('data-src') || '';
        return VIDEO_HOST.test(src);
    }

    function placeholderFor(url) {

        const box = document.createElement('div');
        box.className = 'sig-video-blocked';
        box.style.cssText = [
            'display:inline-flex', 'align-items:center', 'gap:8px',
            'max-width:100%', 'box-sizing:border-box',
            'margin:4px 0', 'padding:8px 12px',
            'border:1px solid #666', 'border-radius:6px',
            'background:#1a1a1a', 'color:#ddd',
            'font:12px/1.3 Arial,sans-serif', 'cursor:pointer',
        ].join(';');
        box.title = 'Blocked to stop this page reloading. Tap to load this one.';
        box.textContent = '▶ Video blocked — tap to load';

        // Restore on demand: one video is harmless, it is the pile that kills
        // the renderer. Swap the placeholder back for a real iframe.
        box.addEventListener('click', () => {
            const real = document.createElement('iframe');
            real.setAttribute('src', url);
            real.setAttribute('frameborder', '0');
            real.setAttribute('allowfullscreen', '');
            real.style.cssText = 'max-width:100%;width:560px;height:315px;border:0;';
            box.replaceWith(real);
        }, { once: true });

        return box;
    }

    let blocked = 0;

    function neuter(iframe) {
        if (!isVideoFrame(iframe) || iframe.dataset.sigBlocked === '1') return;
        // Capture the URL BEFORE clearing src, or the placeholder has nothing to
        // restore and "tap to load" silently does nothing.
        const raw = iframe.getAttribute('src') || '';
        const url = raw.startsWith('//') ? 'https:' + raw : raw;
        // Then drop src, which stops the load even if the element is not
        // detached this tick.
        iframe.removeAttribute('src');
        iframe.dataset.sigBlocked = '1';
        iframe.replaceWith(placeholderFor(url));
        blocked++;
    }

    function sweep(root) {
        if (!root || root.nodeType !== 1) return;
        if (root.tagName === 'IFRAME') { neuter(root); return; }
        const frames = root.getElementsByTagName ? root.getElementsByTagName('iframe') : [];
        // Live HTMLCollection shrinks as we replace, so walk a static copy.
        Array.prototype.slice.call(frames).forEach(neuter);
    }

    // document-start: catch each iframe as it is parsed in, before it can start
    // fetching. A document-idle script would be far too late — by then all 59
    // players have already loaded and the damage is done.
    const observer = new MutationObserver((mutations) => {
        for (const m of mutations) {
            for (const node of m.addedNodes) sweep(node);
        }
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });

    document.addEventListener('DOMContentLoaded', () => sweep(document.body), { once: true });

    // Torn renders the signature well after load, so keep watching — but not
    // forever; the page is settled long before this.
    setTimeout(() => {
        observer.disconnect();
        if (blocked) console.log('[sig-video-blocker] blocked ' + blocked + ' video embed(s)');
    }, 30000);
})();
