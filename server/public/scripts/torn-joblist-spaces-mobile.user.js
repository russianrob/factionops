// ==UserScript==
// @name         Torn Job List Spaces — Mobile Layout Fix
// @namespace    RussianRob
// @version      1.0.0
// @author       RussianRob
// @description  Makes the API-key setup dialog of Feferoni's "Torn Job List — Available Spaces" fit a phone screen. Companion script — install alongside it, does not replace it.
// @license      GPL-3.0-or-later
// @match        https://www.torn.com/joblist.php*
// @grant        none
// @run-at       document-idle
// @downloadURL  https://tornwar.com/scripts/torn-joblist-spaces-mobile.user.js
// @updateURL    https://tornwar.com/scripts/torn-joblist-spaces-mobile.meta.js
// ==/UserScript==

// =============================================================================
// CHANGELOG
// =============================================================================
// v1.0.0  - Initial release. Restyles the setup dialog so it fits a phone.
// =============================================================================

(function () {
    'use strict';

    // Feferoni's dialog is built with inline styles on an anonymous div:
    //   position:fixed; ... padding:28px 32px; max-width:420px;
    // On a phone that fails three ways at once:
    //   1. max-width with no width lets it shrink-wrap, so the flex step rows
    //      collapse into a ~300px column and text wraps to two words a line.
    //   2. 32px of horizontal padding each side eats a sixth of a 390px screen.
    //   3. no max-height/overflow, so the dialog is taller than the viewport
    //      and its top and bottom are simply cut off — including the Save button.
    //
    // Deliberately a COMPANION script rather than a fork: that script carries a
    // custom "@license Feferoni", so redistributing a modified copy is not ours
    // to do. Restyling at runtime leaves their code untouched and keeps their
    // GreasyFork updates working.

    const KEY_INPUT_ID = 'spaces-key-input';

    function fixDialog(input) {
        // Walk up to the fixed-position container that IS the dialog. The div
        // has no id or class, so the input is the only stable anchor.
        let el = input.parentElement;
        while (el && el !== document.body) {
            if (getComputedStyle(el).position === 'fixed') break;
            el = el.parentElement;
        }
        if (!el || el === document.body || el.dataset.jlsFixed === '1') return;

        el.style.setProperty('width', 'min(420px, calc(100vw - 20px))', 'important');
        el.style.setProperty('max-width', 'none', 'important');
        el.style.setProperty('box-sizing', 'border-box', 'important');
        // Scroll inside the dialog rather than off the screen, so the Save
        // button stays reachable on a short viewport.
        el.style.setProperty('max-height', 'calc(100vh - 32px)', 'important');
        el.style.setProperty('overflow-y', 'auto', 'important');
        el.style.setProperty('padding', '18px', 'important');
        el.dataset.jlsFixed = '1';
    }

    function scan() {
        const input = document.getElementById(KEY_INPUT_ID);
        if (input) fixDialog(input);
    }

    scan();

    // The dialog is created only when no API key is stored, and possibly after
    // this script has already run — so watch rather than assume it is present.
    const observer = new MutationObserver(scan);
    observer.observe(document.body, { childList: true, subtree: true });

    // Stop watching once the dialog is gone for good; nothing else on the page
    // needs this and an always-on subtree observer is not free.
    setTimeout(() => observer.disconnect(), 60000);
})();
