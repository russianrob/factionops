// ==UserScript==
// @name         Torn Ranked War Timer
// @version      1.7.2
// @author       RussianRob
// @description  Timer for Ranked Wars
// @license      MIT
// @match        https://www.torn.com/factions.php*

// @downloadURL  https://update.greasyfork.org/scripts/562468/Torn%20Ranked%20War%20Timer.user.js
// @updateURL    https://update.greasyfork.org/scripts/562468/Torn%20Ranked%20War%20Timer.meta.js
// ==/UserScript==

// =============================================================================
// CHANGELOG
// =============================================================================
// v1.7.0  - Hash-agnostic selectors. Replaced literal CSS-module hashes
//           (.rankBox___OzP3D, .timer___fSGg8, .target___NBVXq) with
//           substring matches ([class*="rankBox___"], etc) so the script
//           survives Torn frontend rebundles (which rotate those hashes
//           and broke v1.6.1). Disambiguation: pick the rankBox whose
//           subtree contains a timer with >=8 spans AND a target box,
//           and scope timer/target queries to INSIDE that rankBox so a
//           stray timer___ elsewhere can't false-match.
// v1.6.1  - Update URLs to tornwar.com hosting
// v1.6.0  - Removed font size overrides for consistent PDA/desktop layout
// v1.5.0  - Version bump
// v1.4.0  - Timer repositioned as overlay badge in top-right corner
//           (no longer affects page layout)
// v1.3.0  - Initial public release
// =============================================================================

(function () {
    'use strict';


    function isDesktopLike() {
        // Treat wider viewports as desktop; PDA/mobile usually < 1000px.
        return window.matchMedia('(min-width: 1000px)').matches;
    }

    function formatHHMM(hoursFloat) {
        const totalMinutes = Math.floor(hoursFloat * 60);
        const remHours = Math.floor(totalMinutes / 60);
        const remMinutes = totalMinutes % 60;
        const hh = remHours.toString().padStart(2, '0');
        const mm = remMinutes.toString().padStart(2, '0');
        return { hh, mm, remHours };
    }

    function colorByUrgency(hoursRemainingFloat) {
        if (hoursRemainingFloat <= 2) {
            return 'red';
        } else if (hoursRemainingFloat <= 6) {
            return 'orange';
        } else {
            return 'lime';
        }
    }

    // v1.7.0: find the right rankBox by looking for one whose subtree
    // contains a timer with >=8 spans AND a target box. Multiple
    // candidates can match [class*="rankBox___"] in theory; this picks
    // the active war's box.
    function findWarBox() {
        const candidates = document.querySelectorAll('[class*="rankBox___"]');
        for (const c of candidates) {
            const spans = c.querySelectorAll('[class*="timer___"] span');
            const tb = c.querySelector('[class*="target___"]');
            if (spans.length >= 8 && tb) {
                return { warBox: c, timerSpans: spans, targetBox: tb };
            }
        }
        return null;
    }

    function updateWarTimer(display, warBox) {
        // Scope to the same warBox we picked at init time. Hash-agnostic
        // queries inside this subtree.
        const timerSpans = warBox.querySelectorAll('[class*="timer___"] span');
        const targetBox = warBox.querySelector('[class*="target___"]');

        if (!timerSpans || timerSpans.length < 8 || !targetBox) {
            display.textContent = '🕓 War Timer: N/A';
            return false;
        }

        const timeParts = Array.from(timerSpans)
            .map(span => span.textContent)
            .join('')
            .split(':');

        if (timeParts.length < 3) {
            display.textContent = '🕓 War Timer: N/A';
            return false;
        }

        const days = parseInt(timeParts[0]);
        const hours = parseInt(timeParts[1]);
        const minutes = parseInt(timeParts[2]);
        const totalElapsedHours = (days * 24) + hours + (minutes / 60);

        if (totalElapsedHours <= 24) {
            display.style.color = 'red';
            display.textContent = '🕓 Waiting for 24h mark...';
            display.title = 'War Timer\nCalculations start after 24h elapsed.';
            return true;
        }

        const dropHours = Math.floor(totalElapsedHours - 24);

        let match;
        try {
            match = targetBox.innerText.match(/(\d[\d,]*)\s*\/\s*(\d[\d,]*)/);
        } catch (e) {
            match = null;
        }

        if (!match) {
            display.style.color = 'red';
            display.textContent = '🕓 War Timer: N/A';
            display.title = 'War Timer\nUnable to parse target values.';
            return false;
        }

        const [leadStr, targetStr] = match.slice(1, 3);
        const lead = parseInt(leadStr.replace(/,/g, ''));
        const currentTarget = parseInt(targetStr.replace(/,/g, ''));

        const originalTarget = currentTarget / (1 - (dropHours * 0.01));
        const DROP_PER_HOUR = originalTarget * 0.01;
        const gap = currentTarget - lead;

        const hoursRemainingFloat = gap / DROP_PER_HOUR;

        if (hoursRemainingFloat <= 0) {
            display.remove();
            return false;
        }

        const { hh, mm, remHours } = formatHHMM(hoursRemainingFloat);
        const color = colorByUrgency(hoursRemainingFloat);

        display.style.color = color;
        display.textContent = `🕓 War Timer: ${hh}:${mm}`;
        display.title =
            `War Timer` +
            `\nTime left (approx): ${hh}:${mm}` +
            `\nEstimated original target: ${Math.round(originalTarget).toLocaleString()}` +
            `\nDrop per hour: ${Math.round(DROP_PER_HOUR).toLocaleString()}` +
            `\nLead gap: ${gap.toLocaleString()} ` +
            `\nHours remaining (approx): ${remHours}`;

        return true;
    }

    const DISPLAY_ID = 'wb-war-timer';

    const initInterval = setInterval(() => {
        const found = findWarBox();
        if (!found) return;
        const { warBox, timerSpans } = found;
        const timerBox = warBox.querySelector('[class*="timer___"]');
        if (!timerBox) return;

        clearInterval(initInterval);

        // Idempotent injection. This used to append unconditionally, so every
        // run of the script added ANOTHER badge — the user ended up with four.
        // On Android PDA the script runs more than once per page (a plain
        // reload still leaves two), and the old window.open(WIKI_URL) click
        // re-entered it as well, which is why tapping the timer spawned copies.
        // Adopt whatever is already on the page and delete any strays, so no
        // number of runs can produce more than one badge.
        const existing = document.querySelectorAll('#' + DISPLAY_ID);
        let display = existing[0] || null;
        for (let i = 1; i < existing.length; i++) existing[i].remove();

        const isNew = !display;
        if (isNew) {
            display = document.createElement('div');
            display.id = DISPLAY_ID;
            display.style.marginLeft = '10px';
            display.style.fontWeight = 'bold';
            display.style.display = 'inline-block';
            // Deliberately NOT clickable: no cursor:pointer, no onclick. The
            // wiki link it used to open was the source of the duplicates.
        }

        let headerContainer =
            warBox.querySelector('[class*="header"], [class*="title"]') ||
            (warBox.children && warBox.children[0]) ||
            timerBox.parentElement;

        if (!headerContainer) return;

        if (isNew) headerContainer.appendChild(display);

        const ok = updateWarTimer(display, warBox);
        if (!ok && !document.body.contains(display)) {
            return;
        }

        const refreshInterval = setInterval(() => {
            if (!document.body.contains(display)) {
                clearInterval(refreshInterval);
                return;
            }

            updateWarTimer(display, warBox);
        }, 30000);
    }, 1000);
})();
