// ==UserScript==
// @name         Torn Poker HUD - Player Profiler & Coach
// @namespace    https://torn.com/
// @version      5.5
// @description  Automatic poker player profiling and in-game coaching. Tracks VPIP, PFR, AFq, WTSD and more. Badges on every seat, exploit hints for opponents, improvement path for yourself.
// @author       HopesG
// @license      MIT
// @match        *://www.torn.com/page.php?sid=holdem*
// @match        *://torn.com/page.php?sid=holdem*
// @run-at       document-idle
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        unsafeWindow
// @grant        GM_xmlhttpRequest
// @connect      api.torn.com
// @connect      poker.tornwar.com
// ==/UserScript==
// NOTE: Greasyfork downloadURL/updateURL removed on purpose. This is a private
// fork with cloud sync and a hardcoded server key; an auto-update from the
// published script would silently wipe those changes. Do not republish.

// =============================================================================
// CHANGELOG
// =============================================================================
//
// v5.5 (2026-07-08, private fork)
// -----------------
// Parser
//   - Torn reworded blind posts to plain "posted $X" (dropped the small/big-blind
//     label), so they missed both blind branches and tripped the parser-health
//     warning. Added a branch that recognizes the amount-only form, feeds the pot,
//     and classifies SB/BB by amount vs the table BB (post order as fallback). SB/BB
//     player assignment stays position-derived.
//
// v5.4 (2026-07-05, private fork)
// -----------------
// Cloud sync (poker.tornwar.com)
//   - Finished hands upload as per-hand delta events (deduped by hand id) and
//     merged profiles pull back every 5 minutes, so all devices share reads.
//   - One-time seed: the first device to contact an empty server imports its
//     full local database as the baseline.
//   - Population priors from the server recenter small-sample classification
//     on the real Torn population instead of a flat 50%.
//   - Settings: Cloud Sync section with on/off toggle and queue status.
//
// Data integrity
//   - Player records keyed by Torn XID: renames and duplicate names are safe.
//   - Fixed a crash in checkSelfTilt (undefined loadStats) that wedged hand
//     finalization, blocked whipsaw detection and double-counted stats.
//   - Parser health check warns when Torn changes its log wording.
//
// Coaching
//   - Push/fold advice under 15 BB effective stacks.
//   - Monte Carlo now models every villain's range, not just the aggressor.
//   - Range Reader shrinks thin samples toward the villain's archetype range.
//   - MDF and balanced bluff ratios in the coach math and glossary.
//   - Wilson 95% confidence bands on key stats in tooltip and panel.
//
// Collusion
//   - Suspicion pairs persist across sessions and tables with 30-day decay.
//
// v4.5 (2026-04-24)
// -----------------
// Storage
//   - Migrated all persistent data (stats, live stacks, hand history, suspicion
//     pairs) from GM_setValue/localStorage to IndexedDB. No more quota errors,
//     works on every platform including TornPDA without a userscript manager.
//   - One-time automatic migration merges existing GM/localStorage data into IDB
//     on first load — no data loss. Per-player merge uses handsObserved as
//     tiebreaker so the richer record always wins.
//   - Settings and intro flag intentionally kept in localStorage (sync read
//     required at startup, no quota risk).
//   - Removed @grant GM_setValue and @grant GM_info (no longer used).
//     GM_getValue kept for the one-time migration read.
//
// Collusion detection — whipsaw fix
//   - Moved checkWhipsaw() from firing at the moment of the 3-bet to running at
//     hand finalisation where full action data is available.
//   - Added raiser-called check: only flags a whipsaw if the original raiser
//     called the 3-bet (soft play). Folder or 4-bettor = normal poker, skipped.
//   - Added preflopRaiseCount > 2 guard: a 4-bet from either party clears the
//     flag entirely.
//   - Victims must have actually folded preflop (squeezed out). Callers are no
//     longer counted as victims.
//   - Non-faction whipsaw-only pairs now require 3+ events (up from 2) before
//     showing the indicator.
//   - Result: aggressive 3-bettors and normal squeeze spots no longer trigger
//     false collusion alerts.
//
// Player name improvements
//   - Opponent names are now clickable links to their Torn profile
//     (https://www.torn.com/profiles.php?XID=...). Opens in a new tab.
//   - Clicking the HUD badge does not trigger the profile link (click on badge
//     is correctly isolated).
//   - Long names are scaled down to prevent truncation caused by the badge
//     taking space: 6-7 chars → 10px, 8-11 chars → 9px, 12+ chars → 8px.
//
// Help glossary
//   - Added "Icons & Indicators" section explaining every emoji and seat
//     indicator: 🎭 bluffer, 🎯 draw chaser, 💎 value player, 🃏 marginal
//     overplayer, 📞 loose caller, ▼/▽ stack drop, ! alert, ✎ auto-tag,
//     net worth pill, faction flag, and ⚠ collusion warning.
//
// Draw detection bug fix
//   - Fixed open-ended straight draw misclassification for A-high draws.
//     Holding AJ on a QQK board (J-Q-K-A, missing T) was incorrectly reported
//     as an open-ended straight draw. The Ace caps the top of the window so
//     only one card completes it — correctly reclassified as a gutshot.
//   - Fix applied to both findStraightDraw() (live coach) and detectDraw()
//     (verdict analysis) independently.
//
// =============================================================================

(function () {
    'use strict';

    const STATS_KEY = 'tornPokerHUD_v1';
    const STATS_BACKUP_KEY = 'tornPokerHUD_v1_backup';
    const NOTES_KEY = 'tornPokerNotes';
    const LIVE_STACKS_KEY = 'tornPokerHUD_liveStacks';
    const HAND_HIST_KEY = 'tornPokerHUD_handHistory';
    const SUSPICION_KEY = 'tornPokerHUD_suspicion';
    const LIVE_STACKS_MAX_AGE = 4 * 60 * 60 * 1000; // 4 hours — stale beyond this, start fresh
    const SUSPICION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // collusion events decay after 30 days
    const SUSPICION_EVENTS_CAP = 20; // per pair, oldest dropped first

    // ── Cloud sync (poker.tornwar.com) ─────────────────────────
    // The key is intentionally hardcoded: the server only accepts requests
    // carrying it. Do not publish this copy of the script with the key in it.
    const SYNC_SERVER_URL = 'https://poker.tornwar.com';
    let SYNC_API_KEY = (typeof GM_getValue === 'function' ? (GM_getValue('pokerSyncApiKey', '') || '') : '');
    function phudEnsureKey() {
        if (SYNC_API_KEY) return;
        if (!document.body) { setTimeout(phudEnsureKey, 800); return; }
        if (document.getElementById('phud-key-box')) return;
        const b = document.createElement('div');
        b.id = 'phud-key-box';
        b.style.cssText = 'position:fixed;z-index:2147483647;top:10px;left:10px;right:10px;max-width:440px;margin:0 auto;background:#1b1b1f;color:#eee;border:1px solid #5b5fd5;border-radius:8px;padding:12px;font:13px sans-serif;box-shadow:0 4px 16px rgba(0,0,0,.5)';
        b.innerHTML = '<div style="margin-bottom:6px;font-weight:600">Poker HUD — paste your sync key</div><input id="phud-key-in" type="text" autocomplete="off" style="width:100%;box-sizing:border-box;padding:8px;border-radius:5px;border:1px solid #555;background:#111;color:#fff" placeholder="sync API key"><button id="phud-key-save" style="margin-top:8px;width:100%;padding:8px;border:0;border-radius:5px;background:#5b5fd5;color:#fff;font-weight:600">Save</button>';
        document.body.appendChild(b);
        b.querySelector('#phud-key-save').addEventListener('click', function () {
            const v = (b.querySelector('#phud-key-in').value || '').trim();
            if (!v) return;
            SYNC_API_KEY = v;
            try { if (typeof GM_setValue === 'function') GM_setValue('pokerSyncApiKey', v); } catch (e) {}
            b.remove();
        });
    }
    phudEnsureKey();
    const SYNC_QUEUE_KEY = 'tornPokerHUD_syncQueue';
    const SYNC_LAST_PULL_KEY = 'tornPokerHUD_syncLastPull'; // localStorage
    const SYNC_QUEUE_CAP = 300;
    const SYNC_BATCH_SIZE = 50;
    const SYNC_PULL_INTERVAL_MS = 5 * 60 * 1000;
    const RECENT_CAP = 30;
    const TABLE_RECENT_CAP = 20;

    // ── User settings ─────────────────────────────────────────────
    const SETTINGS_KEY = 'tornPokerHUD_settings';
    const SETTINGS_DEFAULTS = {
        badgeMode: 'session',  // 'session' | 'lifetime'
        sessionWindow: 15,         // hands used for session classification
        showAlertOnBadge: true,       // show ! alert indicator on badge
        tiltDeltaThreshold: 0.25,       // VPIP delta to trigger tilt alert
        tiltWindow: 8,          // recent hands window for tilt detection
        minHandsToClassify: 5,          // hands needed before showing a label
        panelDefaultTab: 'stats',    // which tab opens first
        badgeTapMode: 'single', // 'single' | 'double' — mobile only; double-tap to open badge panel
        mrCoachMode: 'on',   // 'on' | 'quiet' | 'off' — on by default
        coachMinHands: 8,    // min hands before data-driven advice fires
        coachLowConfidenceThreshold: 10,   // below this = "Thin read"
        coachMedConfidenceThreshold: 25,   // below this = "Decent read", above = "Solid read"
        usePokerTerms: false,              // use VPIP/PFR/AFq etc instead of plain English labels
        coachHistory: true,               // keep old self-advice grayed out below new one
        coachPersonality: 'default',       // 'default' or 'duke'
        coachLauncherPosition: null,       // mobile only: {x,y} for draggable pill (collapsed state)
        tlogBubblePosition: null,       // {x,y} for draggable table log bubble
        coachPanelPositionMobile: null,    // mobile only: {x,y} for draggable coach panel
        showInlineBadgeStats: true,        // show VPIP/PFR/AFq inline on badge (desktop only)
        autoTagPlays: true,                // auto-append notable play notes to player profiles
        tiltBanner: true,                  // show floating banner when own play pattern shows tilt
        tornApiKey: '',             // Torn API key for net worth enrichment (optional)
        showNetworthBadge: true,           // show wealth tag on player badges when net worth is known
        cloudSync: true,           // sync hands/profiles with poker.tornwar.com
        betReaction: true,                 // show coach reaction below self-entry when bet size is unusual
        hudScaleCoach: 1.0,             // zoom scale for the Mr. Coach panel (0.7–1.5)
        hudScalePanels: 1.0,             // zoom scale for player/settings panels (0.7–1.5)
        hudScaleHoverTip: 1.0,             // zoom scale for badge hover tooltip (0.7–1.5)
        turnAlert: false,           // play audio alert when it's your turn
        turnAlertVolume: 0.5,             // alert volume 0.0–1.0
        beatBubble: true,            // floating "% chance villain has a hand that beats you" bubble
        beatBubblePosition: null,          // {x,y} for draggable beat-you bubble
        beatBubbleMinSample: 4,            // min showdown hands before villain probability is considered usable
    };

    function loadSettings() {
        try { return { ...SETTINGS_DEFAULTS, ...JSON.parse(localStorage.getItem(SETTINGS_KEY)) }; }
        catch { return { ...SETTINGS_DEFAULTS }; }
    }

    function saveSettings(s) {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
    }

    function hudScaleTransform(scale) {
        return scale === 1.0 ? '' : `scale(${scale})`;
    }

    function applyHudScales() {
        const coach = document.getElementById('tphud-coach');
        if (coach) { coach.style.transform = hudScaleTransform(hudSettings.hudScaleCoach); coach.style.transformOrigin = 'top left'; }
        const panel = document.getElementById('tphud-panel');
        if (panel) {
            if (panel.style.left) {
                // Dragged — explicit pixels; must use scale(X) not '' to prevent CSS translate bleeding in
                panel.style.transform = `scale(${hudSettings.hudScalePanels})`;
                panel.style.transformOrigin = 'top left';
            } else {
                // Centered — combine with CSS centering translate
                panel.style.transform = `translate(-50%, -50%) scale(${hudSettings.hudScalePanels})`;
                panel.style.transformOrigin = '';
            }
        }
        const tip = document.getElementById('tphud-hover');
        if (tip) { tip.style.transform = hudScaleTransform(hudSettings.hudScaleHoverTip); tip.style.transformOrigin = 'top left'; }
        const settingsModal = document.getElementById('tphud-settings-modal');
        if (settingsModal) settingsModal.querySelector('.tphud-help-box').style.zoom = String(hudSettings.hudScalePanels);
    }

    let hudSettings = loadSettings();

    function isPageActive() {
        if (typeof document.visibilityState === 'string') return document.visibilityState === 'visible';
        return true;
    }

    // BB -> default display name
    const TABLE_BY_BB = {
        10: 'Newbie Corner',
        25: 'Hobo Holdem',
        50: 'Broke Jokes',
        100: '8-bit',
        250: 'Sprinkles',
        500: 'E-asy Street',
        1000: 'Gatling Gun',
        2500: 'Quickdraw',
        5000: 'Tight Knit',
        10000: 'Six of the Best',
        25000: 'Ballsy',
        50000: 'Boom or Bust',
        250000: 'Pound It',
        500000: 'Old Folks Home',
        2500000: "Cat's Chance",
        10000000: 'High Rollers',
        25000000: 'Fire Pit',
        100000000: 'Oligarch',
    };

    // Texture key -> exact table metadata
    const TABLE_BY_TEXTURE = {
        newbie_corner: { name: 'Newbie Corner', bb: 10 },
        hobo_holdem: { name: 'Hobo Holdem', bb: 25 },
        broke_jokes: { name: 'Broke Jokes', bb: 50 },
        '8_bit': { name: '8-bit', bb: 100 },
        '8bit': { name: '8-bit', bb: 100 },
        sprinkles: { name: 'Sprinkles', bb: 250 },
        e_asy_street: { name: 'E-asy Street', bb: 500 },
        easy_street: { name: 'E-asy Street', bb: 500 },
        gatling_gun: { name: 'Gatling Gun', bb: 1000 },
        quickdraw: { name: 'Quickdraw', bb: 2500 },
        tight_knit: { name: 'Tight Knit', bb: 5000 },
        six_of_the_best: { name: 'Six of the Best', bb: 10000 },
        ballsy: { name: 'Ballsy', bb: 25000 },
        boom_or_bust: { name: 'Boom or Bust', bb: 50000 },
        old_n_slow: { name: "Old 'n Slow", bb: 100000 },
        periodic: { name: 'Periodic', bb: 100000 },
        fourplay: { name: 'Fourplay', bb: 100000 },
        pound_it: { name: 'Pound It', bb: 250000 },
        old_folks_home: { name: 'Old Folks Home', bb: 500000 },
        duel_at_dawn: { name: 'Duel at Dawn', bb: 1000000 },
        river_wizard: { name: 'River Wizard', bb: 1000000 },
        tripod: { name: 'Tripod', bb: 1000000 },
        comatose_cove: { name: 'Comatose Cove', bb: 1000000 },
        cats_chance: { name: "Cat's Chance", bb: 2500000 },
        juan_on_juan: { name: 'Juan on Juan', bb: 5000000 },
        slow_cooker: { name: 'Slow Cooker', bb: 5000000 },
        high_rollers: { name: 'High Rollers', bb: 10000000 },
        fire_pit: { name: 'Fire Pit', bb: 25000000 },
        oligarch: { name: 'Oligarch', bb: 100000000 },
    };

    function getTableName(bb) { return TABLE_BY_BB[bb] || null; }
    function getStakeTier(bb) {
        if (!bb) return null;
        if (bb <= 500) return 'Nano';
        if (bb <= 50000) return 'Low';
        if (bb <= 999999) return 'Mid';
        if (bb <= 9999999) return 'High';
        return 'Elite';
    }

    let currentTableBB = null;
    let currentTableName = null;
    let currentStakeTier = null;
    let currentTextureKey = null;
    let lastTableSwitchTime = 0;
    let isBBDisplayMode = false; // true when Torn is showing amounts as BB rather than cash

    // Session P&L tracker — resets on page load. Tracks hero's chip outcomes across the current play session.
    // BB-normalised (each hand's net chips divided by that hand's BB) so cross-stake aggregation is meaningful.
    const sessionStats = {
        startedAt: Date.now(),
        handsPlayed: 0,   // every finalized hand hero was dealt into
        handsVPIP: 0,   // hands hero voluntarily entered (VPIP'd)
        netChips: 0,   // raw chip net (mixed stakes — only meaningful at single table)
        netBB: 0,   // BB-normalised net (cross-stake aware)
        biggestWinBB: 0,
        biggestLossBB: 0,
    };

    function fmtStack(n) {
        if (n == null) return '?';
        if (isBBDisplayMode && currentTableBB) return (n / currentTableBB).toFixed(1) + ' BB';
        if (n >= 1_000_000) return '$' + (n / 1_000_000).toFixed(2) + 'M';
        if (n >= 1_000) return '$' + Math.round(n / 1_000) + 'k';
        return '$' + n;
    }

    function fmtNetworth(n) {
        if (n == null) return null;
        if (n >= 1_000_000_000_000) return `$${(n / 1_000_000_000_000).toFixed(2)}T`;
        if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`;
        if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(0)}M`;
        if (n >= 1_000) return `$${Math.round(n / 1_000)}k`;
        return `$${n}`;
    }

    function networthColor(n) {
        if (n >= 1_000_000_000_000) return '#5e1585'; // Trillionaire
        if (n >= 100_000_000_000) return '#8b2222'; // 100B+
        if (n >= 10_000_000_000) return '#b05a10'; // 10B+
        if (n >= 1_000_000_000) return '#0d7070'; // Billionaire
        if (n >= 1_000_000) return '#2e7d32'; // Millionaire
        return '#3a5068';                             // Thousands or less
    }

    function fmtDuration(ms) {
        if (ms == null || ms < 0) return '—';
        const totalSec = Math.floor(ms / 1000);
        const hrs = Math.floor(totalSec / 3600);
        const mins = Math.floor((totalSec % 3600) / 60);
        const secs = totalSec % 60;
        if (hrs > 0) return `${hrs}h ${mins}m`;
        if (mins > 0) return `${mins}m`;
        return `${secs}s`;
    }

    function parseHandRank(handName) {
        if (/royal flush/i.test(handName)) return 9;
        if (/straight flush/i.test(handName)) return 8;
        if (/four of a kind/i.test(handName)) return 7;
        if (/full house/i.test(handName)) return 6;
        if (/flush/i.test(handName)) return 5;
        if (/straight/i.test(handName)) return 4;
        if (/three of a kind/i.test(handName)) return 3;
        if (/two pair/i.test(handName)) return 2;
        if (/\bpair\b/i.test(handName)) return 1;
        if (/high card/i.test(handName)) return 0;
        return -1;
    }

    function rankToHandName(rank) {
        const names = ['High card', 'Pair', 'Two pair', 'Three of a kind', 'Straight', 'Flush', 'Full house', 'Four of a kind', 'Straight flush', 'Royal flush'];
        return names[rank] ?? null;
    }

    function parseCardsList(text) {
        if (!text) return null;
        const cards = [];
        const re = /(10|[2-9AKQJT])([♠♥♦♣])/g;
        let m;
        while ((m = re.exec(text)) !== null) cards.push(m[1] + m[2]);
        return cards.length ? cards : null;
    }

    // Extracts a cash amount from "$1,234,567" or "3.50 BB" log text.
    // BB amounts are multiplied by currentTableBB to convert to cash.
    function parseCashAmt(text) {
        const dollarMatch = text.match(/\$([\d,]+)/);
        if (dollarMatch) return parseInt(dollarMatch[1].replace(/,/g, ''), 10);
        const bbMatch = text.match(/([\d.]+)\s*BB/i);
        if (bbMatch && currentTableBB) return Math.round(parseFloat(bbMatch[1]) * currentTableBB);
        return null;
    }

    // For "raised $X to $Y", returns the total commitment $Y (not the increment $X).
    // Falls back to parseCashAmt for plain "raised $X" or "bet $X".
    function parseTotalAmt(text) {
        const toMatch = text.match(/\bto\s+\$([\d,]+)/i);
        if (toMatch) return parseInt(toMatch[1].replace(/,/g, ''), 10);
        return parseCashAmt(text);
    }

    // ── Board & hand analysis ────────────────────────────────────

    const RANK_VALUES = {
        '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9,
        'T': 10, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14,
    };

    // Card ranks ordered low to high. Uses 'T' for ten (matches `rankOf` normalisation).
    const RANK_ORDER = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'];

    // Card string → rank char ('Th' → 'T', '10s' → 'T'). Normalises '10' to 'T'.
    const rankOf = c => { const r = c.slice(0, -1); return r === '10' ? 'T' : r; };
    // Card string → suit char ('Th' → 'h')
    const suitOf = c => c.slice(-1);

    // Pot odds % needed to call: callAmt / (pot + callAmt). Returns null if inputs are non-positive.
    function potOddsPct(callAmt, pot) {
        if (!callAmt || callAmt <= 0 || pot < 0) return null;
        return Math.round(callAmt / (pot + callAmt) * 100);
    }

    // Classifies a 4-of-5 straight window with one gap as 'oesd' or 'gutshot'.
    // aceTopVal is the rank that represents Ace in the caller's scale (14 for 1-14 numeric, 12 for 0-12 RANK_ORDER index).
    // Pass null to skip the A-high special case (used by ace-low/wheel loops where Ace is at the bottom).
    // A-high window with low-end gap is special: Ace caps the top, only one completer → gutshot.
    function classifyStraightGap(windowBase, gap, aceTopVal) {
        const isEndGap = gap === windowBase || gap === windowBase + 4;
        if (isEndGap && aceTopVal != null && windowBase + 4 === aceTopVal && gap === windowBase) return 'gutshot';
        return isEndGap ? 'oesd' : 'gutshot';
    }

    function classifyFiveCardRank(cards) {
        if (!cards || cards.length !== 5) return -1;
        const vals = cards.map(c => RANK_VALUES[c.slice(0, -1)] || 0);
        if (vals.some(v => !v)) return -1;
        const suits = cards.map(c => c.slice(-1));
        const isFlush = suits.every(s => s === suits[0]);
        const counts = {};
        vals.forEach(v => { counts[v] = (counts[v] || 0) + 1; });
        const countVals = Object.values(counts).sort((a, b) => b - a);
        const unique = [...new Set(vals)].sort((a, b) => a - b);
        let isStraight = false;
        let straightHigh = 0;
        if (unique.length === 5) {
            if (unique[4] - unique[0] === 4) {
                isStraight = true;
                straightHigh = unique[4];
            } else if (unique[0] === 2 && unique[1] === 3 && unique[2] === 4 && unique[3] === 5 && unique[4] === 14) {
                isStraight = true;
                straightHigh = 5;
            }
        }
        if (isFlush && isStraight) return straightHigh === 14 ? 9 : 8;
        if (countVals[0] === 4) return 7;
        if (countVals[0] === 3 && countVals[1] === 2) return 6;
        if (isFlush) return 5;
        if (isStraight) return 4;
        if (countVals[0] === 3) return 3;
        if (countVals[0] === 2 && countVals[1] === 2) return 2;
        if (countVals[0] === 2) return 1;
        return 0;
    }

    function evaluateShownHand(holeCards, boardCards) {
        if (!holeCards || holeCards.length < 2 || !boardCards || boardCards.length < 3) return null;
        const cards = [...holeCards, ...boardCards];
        if (cards.length < 5) return null;
        let bestRank = -1;
        const n = cards.length;
        for (let a = 0; a < n - 4; a++)
            for (let b = a + 1; b < n - 3; b++)
                for (let c = b + 1; c < n - 2; c++)
                    for (let d = c + 1; d < n - 1; d++)
                        for (let e = d + 1; e < n; e++) {
                            const rank = classifyFiveCardRank([cards[a], cards[b], cards[c], cards[d], cards[e]]);
                            if (rank > bestRank) bestRank = rank;
                            if (bestRank === 9) break;
                        }
        if (bestRank < 0) return null;
        const HAND_NAMES = {
            0: 'High Card',
            1: 'Pair',
            2: 'Two Pair',
            3: 'Three of a Kind',
            4: 'Straight',
            5: 'Flush',
            6: 'Full House',
            7: 'Four of a Kind',
            8: 'Straight Flush',
            9: 'Royal Flush',
        };
        return { rank: bestRank, name: HAND_NAMES[bestRank] || null };
    }

    const VERDICT_CONFIG = {
        CLEAR_BLUFF: { color: '#e74c3c', label: '⚠ Clear Bluff', bg: 'rgba(231,76,60,0.12)' },
        BLUFF_WET: { color: '#e74c3c', label: '⚠ Bluff on Wet Board', bg: 'rgba(231,76,60,0.12)' },
        THIN_VALUE: { color: '#e67e22', label: '? Thin Value / Bluff', bg: 'rgba(230,126,34,0.12)' },
        PROTECTION: { color: '#16a085', label: 'Protection Bet', bg: 'rgba(22,160,133,0.12)' },
        LOOSE_CALL: { color: '#f39c12', label: 'Loose Call', bg: 'rgba(243,156,18,0.10)' },
        DRAW_MADE: { color: '#3498db', label: '♦ Draw Hit (Lost)', bg: 'rgba(52,152,219,0.10)' },
        DRAW_MISS: { color: '#5dade2', label: '◇ Draw Miss', bg: 'rgba(93,173,226,0.10)' },
        VALUE_LOSS: { color: '#7f8c8d', label: 'Value Loss', bg: 'rgba(127,140,141,0.10)' },
        OUTPLAYED: { color: '#9b59b6', label: 'Outplayed', bg: 'rgba(155,89,182,0.10)' },
        STRONG_VALUE: { color: '#27ae60', label: '✓ Strong Value', bg: 'rgba(39,174,96,0.12)' },
        THIN_WIN: { color: '#f1c40f', label: '~ Thin Win', bg: 'rgba(241,196,15,0.10)' },
        TRAP: { color: '#9b59b6', label: '🪤 Slow Play / Trap', bg: 'rgba(155,89,182,0.12)' },
        VOLUNTARY_SHOW: { color: '#8e44ad', label: '👁 Voluntary Show', bg: 'rgba(142,68,173,0.10)' },
        BLUFF_SHOW: { color: '#e74c3c', label: '🃏 Bluff Showed', bg: 'rgba(231,76,60,0.12)' },
        // Uncontested win verdicts
        PREFLOP_STEAL: { color: '#f39c12', label: '↗ Preflop Steal', bg: 'rgba(243,156,18,0.10)' },
        PREFLOP_LIMP_WIN: { color: '#95a5a6', label: '○ Preflop Walk', bg: 'rgba(149,165,166,0.08)' },
        OVERBET_PRESSURE: { color: '#8e44ad', label: '▲ Overbet Pressure', bg: 'rgba(142,68,173,0.10)' },
        CBET_WIN: { color: '#2ecc71', label: '↦ C-Bet Win', bg: 'rgba(46,204,113,0.10)' },
        BARREL_WIN: { color: '#e74c3c', label: '▶▶ Barrel Win', bg: 'rgba(231,76,60,0.10)' },
        DELAYED_CBET: { color: '#3498db', label: '↪ Delayed Bet', bg: 'rgba(52,152,219,0.10)' },
        PROBE_WIN: { color: '#7f8c8d', label: '· Probe Win', bg: 'rgba(127,140,141,0.08)' },
        PASSIVE_WIN: { color: '#95a5a6', label: '○ Passive Win', bg: 'rgba(149,165,166,0.08)' },
        SINGLE_BET_WIN: { color: '#27ae60', label: '→ Bet & Take', bg: 'rgba(39,174,96,0.10)' },
        SELF_VALUE_UNCALLED: { color: '#27ae60', label: '✓ Value — Uncalled', bg: 'rgba(39,174,96,0.12)' },
        SELF_BLUFF_SUCCESS: { color: '#e74c3c', label: '★ Bluff Success', bg: 'rgba(231,76,60,0.12)' },
        SELF_SEMI_BLUFF_SUCCESS: { color: '#e67e22', label: '♦ Semi-Bluff Success', bg: 'rgba(230,126,34,0.12)' },
        SELF_THIN_VALUE_SUCCESS: { color: '#f1c40f', label: '~ Thin Value Win', bg: 'rgba(241,196,15,0.10)' },
    };

    function analyzeBoardTexture(cards) {
        if (!cards || cards.length === 0) return null;

        const suitCounts = {};
        const rankNums = [];

        for (const card of cards) {
            const suit = card.slice(-1);
            const rankStr = card.slice(0, -1);
            suitCounts[suit] = (suitCounts[suit] || 0) + 1;
            const rv = RANK_VALUES[rankStr];
            if (rv) rankNums.push(rv);
        }

        const maxFlush = Object.values(suitCounts).reduce((a, b) => Math.max(a, b), 0);
        const dominantSuit = Object.entries(suitCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || null;

        const unique = [...new Set(rankNums)].sort((a, b) => a - b);
        let maxConnected = 1;
        for (let i = 0; i < unique.length; i++) {
            let cnt = 1;
            for (let j = i + 1; j < unique.length; j++) {
                if (unique[j] - unique[i] <= 4) cnt++;
            }
            if (cnt > maxConnected) maxConnected = cnt;
        }

        const rankCounts = {};
        rankNums.forEach(r => { rankCounts[r] = (rankCounts[r] || 0) + 1; });
        const isPaired = Object.values(rankCounts).some(c => c >= 2);

        const tags = [];
        if (maxFlush >= 3) tags.push({ text: `${maxFlush}× ${dominantSuit} flush draw`, color: '#3498db' });
        if (maxConnected >= 3) tags.push({ text: `${maxConnected}-connected (straight draw)`, color: '#f39c12' });
        if (isPaired) tags.push({ text: 'paired board', color: '#9b59b6' });
        if (tags.length === 0) tags.push({ text: 'dry board', color: '#555' });

        return {
            flushCards: maxFlush,
            dominantSuit,
            isFlushy: maxFlush >= 3,
            straightConnected: maxConnected >= 3,
            maxConnected,
            isPaired,
            totalCards: cards.length,
            tags,
        };
    }

    function assessHandOwnership(holeCards, boardCards, handRank) {
        const unknown = { ownership: 'unknown', note: null, effectiveRank: handRank };
        if (!holeCards || holeCards.length < 2 || !boardCards || boardCards.length < 3) return unknown;

        const hRanks = holeCards.map(c => c.slice(0, -1));
        const bRankCounts = {};
        boardCards.forEach(c => { const r = c.slice(0, -1); bRankCounts[r] = (bRankCounts[r] || 0) + 1; });

        const h0board = (bRankCounts[hRanks[0]] || 0) > 0;
        const h1board = (bRankCounts[hRanks[1]] || 0) > 0;
        const isPocket = hRanks[0] === hRanks[1];
        const boardMaxCount = Math.max(...Object.values(bRankCounts), 0);
        const boardHasPair = boardMaxCount >= 2;
        const boardHasTrips = boardMaxCount >= 3;

        if (handRank === 3) {
            if (isPocket && h0board)
                return { ownership: 'strong', note: 'Set — pocket pair hit the board', effectiveRank: 3 };
            if (boardHasPair && (h0board || h1board))
                return { ownership: 'board_assisted', note: 'Trips from board pair — others with same rank share this', effectiveRank: 2 };
            if (boardHasTrips)
                return { ownership: 'board_noise', note: 'Board trips — player advantage is kicker only', effectiveRank: 1 };
        }

        if (handRank === 2) {
            if (isPocket && !h0board)
                return { ownership: 'board_assisted', note: 'Pocket pair + board pair — they own the pocket pair, board pair is shared', effectiveRank: 1 };
            if (h0board && h1board)
                return { ownership: 'strong', note: 'Both hole cards pair the board', effectiveRank: 2 };
            if (boardHasPair && !h0board && !h1board)
                return { ownership: 'board_noise', note: 'Neither hole card connects — board pair is doing all the work', effectiveRank: 0 };
            if (boardHasPair && (h0board || h1board))
                return { ownership: 'board_assisted', note: 'One pair is board-given, shared with anyone holding same rank', effectiveRank: 1 };
        }

        if (handRank === 1) {
            if (isPocket)
                return { ownership: 'strong', note: 'Pocket pair — board-independent', effectiveRank: 1 };
            if (!h0board && !h1board && boardHasPair)
                return { ownership: 'board_noise', note: 'Pair is the board pair — player has no connected cards', effectiveRank: 0 };
            if (h0board || h1board)
                return { ownership: 'board_assisted', note: 'Hole card pairs the board — shared with anyone holding same rank', effectiveRank: 1 };
        }

        return unknown;
    }

    function analyzeShowdownBluff(p, boardCards, winnerRank, streetBoards = {}, startStack = null, bbAmount = null, position = null) {
        if (!p.reachedShowdown || p.showdownRank < 0) return null;

        const rawRank = p.showdownRank;
        const ownership = assessHandOwnership(p.showdownCards, boardCards, rawRank);
        const rank = ownership.effectiveRank ?? rawRank;
        const rankGap = winnerRank >= 0 ? winnerRank - rank : null;
        const ownNote = (ownership.ownership === 'board_assisted' || ownership.ownership === 'board_noise')
            ? ` [${ownership.note}]` : '';

        const flopTexture = analyzeBoardTexture(streetBoards.flop || boardCards);
        const turnTexture = analyzeBoardTexture(streetBoards.turn || boardCards);
        const riverTexture = analyzeBoardTexture(streetBoards.river || boardCards);

        const raisedPre = !!(p.preflopRaiseAmt || p.raisedPreflop);

        const streetAgg = s => (p[s]?.bets || 0) + (p[s]?.raises || 0);
        const flopAgg = streetAgg('flop');
        const turnAgg = streetAgg('turn');
        const riverAgg = streetAgg('river');
        const streetsActive = [flopAgg, turnAgg, riverAgg].filter(n => n > 0).length;
        const totalAgg = flopAgg + turnAgg + riverAgg;

        // Hand rank at each street — used to detect late improvement vs true slowplay
        const _streetRank = board => {
            if (!p.showdownCards?.length || !board?.length || board.length < 3) return -1;
            const score = _scoreHand([...p.showdownCards, ...board]);
            return score > 0 ? Math.floor(score / _BRACKET) : -1;
        };
        const flopHandRank = _streetRank(streetBoards.flop);
        const turnHandRank = _streetRank(streetBoards.turn);
        const riverHandRank = _streetRank(streetBoards.river);
        // Earliest street they were passive — used to check if hand was already strong then
        const passiveStreetRank = flopAgg === 0 && flopHandRank >= 0 ? flopHandRank
            : turnAgg === 0 && turnHandRank >= 0 ? turnHandRank
                : -1;
        // Which street a hand of at least minRank first appeared
        const madeOn = minRank => flopHandRank >= minRank ? 'flop'
            : turnHandRank >= minRank ? 'turn'
                : riverHandRank >= minRank ? 'river'
                    : null;

        const heavyAgg = streetsActive >= 2 || riverAgg > 0 || (raisedPre && totalAgg >= 1);

        const bbDepth = startStack && bbAmount && bbAmount > 0 ? startStack / bbAmount : null;
        const isShort = bbDepth !== null && bbDepth < 20;
        const betPcts = startStack && p.betAmts?.length
            ? p.betAmts.map(b => b.amt / startStack * 100)
            : [];
        const maxBetPct = betPcts.length ? Math.max(...betPcts) : null;
        const hasOverbet = maxBetPct !== null && maxBetPct >= 40;
        const isProbeOnly = maxBetPct !== null && maxBetPct > 0 && maxBetPct < 6;

        const isLP = position === 'LP';
        const isEP = position === 'EP';

        if (rank === 5 || rank === 4) {
            const drawName = rank === 5 ? 'flush' : 'straight';
            if (p.wonShowdown) {
                const madeStreet = madeOn(rank);
                const madeNote = madeStreet ? ` — made on ${madeStreet}` : '';
                const aggNote = totalAgg > 0 ? `, bet/raised ${totalAgg} time${totalAgg > 1 ? 's' : ''}` : '';
                return {
                    verdict: 'STRONG_VALUE',
                    reason: `Won with a ${drawName}${madeNote}${aggNote}`,
                    handRank: rank,
                };
            }
            const madeStreet = madeOn(rank);
            const madeNote = madeStreet ? ` (made on ${madeStreet})` : '';
            return {
                verdict: 'DRAW_MADE',
                reason: `Made a ${drawName}${madeNote} but lost to a stronger hand`,
                handRank: rank,
            };
        }

        if (p.wonShowdown) {
            if (rank >= 2 && totalAgg > 0) {
                const madeStreet = madeOn(rank);
                const madeNote = madeStreet ? ` (had it from ${madeStreet})` : '';
                return {
                    verdict: 'STRONG_VALUE',
                    reason: `Won at showdown with ${p.showdownHandName || 'strong hand'}${madeNote} — bet/raised ${totalAgg} time${totalAgg > 1 ? 's' : ''}`,
                    handRank: rank,
                };
            }
            if (rank >= 2 && totalAgg === 0) {
                // Only a true slowplay if the hand was already strong when they went passive
                if (passiveStreetRank >= 0 && passiveStreetRank < 2) {
                    const improvedStreet = madeOn(rank);
                    const improvedNote = improvedStreet ? ` on the ${improvedStreet}` : '';
                    return {
                        verdict: 'THIN_WIN',
                        reason: `Started weak, improved to ${p.showdownHandName || 'strong hand'}${improvedNote} — passive play was correct`,
                        handRank: rank,
                    };
                }
                const trapStreet = madeOn(rank);
                const trapNote = trapStreet ? ` from the ${trapStreet}` : '';
                return {
                    verdict: 'TRAP',
                    reason: `Checked ${p.showdownHandName || 'strong hand'} to showdown — had it${trapNote}, never bet`,
                    handRank: rank,
                };
            }
            if (rank <= 1 && (totalAgg > 0 || p.postCalls >= 1)) {
                return {
                    verdict: 'THIN_WIN',
                    reason: totalAgg > 0
                        ? `Bet with only ${rank === 0 ? 'high card' : 'a pair'} and won — pushed thin value`
                        : `Called ${p.postCalls} streets with only ${rank === 0 ? 'high card' : 'a pair'} and won`,
                    handRank: rank,
                };
            }
            return null;
        }

        if (rank <= 1) {
            const handLabel = rank === 0 ? 'high card (air)' : 'a pair';

            const isPocketPair = ownership.ownership === 'strong' && rank === 1;
            const gapIsSmall = rankGap !== null && rankGap < 2;
            if (rank === 1 && gapIsSmall && ownership.ownership !== 'board_noise' && !heavyAgg) {
                const coolerLabel = isPocketPair ? 'Pocket pair' : 'Pair';
                return { verdict: 'VALUE_LOSS', reason: `${coolerLabel} lost to a marginally better hand — standard cooler`, handRank: rank };
            }

            const betTimeTexture = flopAgg ? flopTexture : turnAgg ? turnTexture : riverTexture;
            const isWetAtBet = betTimeTexture?.isFlushy || betTimeTexture?.straightConnected;

            const isProtection =
                rank === 1 &&
                ownership.ownership !== 'board_noise' &&
                (flopAgg > 0 || turnAgg > 0) &&
                !hasOverbet &&
                isWetAtBet;

            if (heavyAgg) {
                if (isShort) {
                    return {
                        verdict: 'THIN_VALUE',
                        reason: `Heavy aggression but short-stacked (${Math.round(bbDepth)}BB) — may be commitment, not a bluff${ownNote}`,
                        handRank: rank,
                    };
                }

                const streetParts = [];
                if (raisedPre) streetParts.push('raised preflop');
                if (flopAgg) streetParts.push('bet flop');
                if (turnAgg) streetParts.push('bet turn');
                if (riverAgg) streetParts.push('bet river');
                const streetSummary = streetParts.join(' → ');
                const overbetNote = hasOverbet ? ` — overbet ${maxBetPct.toFixed(0)}% of stack` : '';

                if (isProtection && riverAgg === 0) {
                    const boardDesc = [
                        betTimeTexture.isFlushy ? `${betTimeTexture.flushCards}× ${betTimeTexture.dominantSuit}` : '',
                        betTimeTexture.straightConnected ? `${betTimeTexture.maxConnected}-connected` : '',
                    ].filter(Boolean).join(', ');
                    return {
                        verdict: 'PROTECTION',
                        reason: `${streetSummary} with pair on wet board (${boardDesc}) — charged draws, checked river when scared${ownNote}`,
                        handRank: rank,
                    };
                }

                if (isPocketPair && isWetAtBet) {
                    const boardDesc = [
                        betTimeTexture.isFlushy ? `${betTimeTexture.flushCards}× ${betTimeTexture.dominantSuit}` : '',
                        betTimeTexture.straightConnected ? `${betTimeTexture.maxConnected}-connected` : '',
                    ].filter(Boolean).join(', ');
                    return {
                        verdict: 'THIN_VALUE',
                        reason: `${streetSummary} with pocket pair on a wet board (${boardDesc}) — thin value, dangerous spot${overbetNote}`,
                        handRank: rank,
                    };
                }

                if (isWetAtBet) {
                    const boardDesc = [
                        betTimeTexture.isFlushy ? `${betTimeTexture.flushCards}× ${betTimeTexture.dominantSuit}` : '',
                        betTimeTexture.straightConnected ? `${betTimeTexture.maxConnected}-connected` : '',
                    ].filter(Boolean).join(', ');
                    const posCtx = isEP ? ' — EP aggression, strong signal' : isLP ? ' — LP position play' : '';
                    return {
                        verdict: 'BLUFF_WET',
                        reason: `${streetSummary} with ${handLabel} on a wet board (${boardDesc})${ownNote}${overbetNote}${posCtx}`,
                        handRank: rank,
                    };
                }
                const posCtx = isEP ? ' — EP aggression, strong signal' : isLP ? ' — LP position play' : '';

                if (ownership.ownership === 'board_assisted') {
                    return {
                        verdict: 'THIN_VALUE',
                        reason: `${streetSummary} — overplayed hand with real but limited equity${ownNote}${overbetNote}${posCtx}`,
                        handRank: rank,
                    };
                }
                return {
                    verdict: 'CLEAR_BLUFF',
                    reason: `${streetSummary} — showed only ${handLabel}${ownNote}${overbetNote}${posCtx}`,
                    handRank: rank,
                };
            }

            if (totalAgg >= 1) {
                const singleStreet = flopAgg ? 'flop' : turnAgg ? 'turn' : riverAgg ? 'river' : null;
                const qualifier = (ownership.ownership === 'board_noise' || ownership.ownership === 'board_assisted')
                    ? 'mostly board-given hand' : handLabel;
                const probeNote = isProbeOnly ? ' (small probe bet)' : '';
                const overbetNote = hasOverbet ? ` — overbet ${maxBetPct.toFixed(0)}% of stack` : '';
                const posThinNote = isLP && raisedPre && singleStreet === 'flop'
                    ? ' (LP c-bet — standard position play)'
                    : isEP ? ' — EP bet, stronger signal' : '';

                if (isProtection) {
                    const boardDesc = [
                        betTimeTexture.isFlushy ? `${betTimeTexture.flushCards}× ${betTimeTexture.dominantSuit}` : '',
                        betTimeTexture.straightConnected ? `${betTimeTexture.maxConnected}-connected` : '',
                    ].filter(Boolean).join(', ');
                    return {
                        verdict: 'PROTECTION',
                        reason: `Bet ${singleStreet || 'post-flop'} with pair on wet board (${boardDesc}) — protection bet to charge draws${ownNote}${probeNote}`,
                        handRank: rank,
                    };
                }

                return {
                    verdict: 'THIN_VALUE',
                    reason: `Bet ${singleStreet || 'post-flop'} with ${qualifier}${isWetAtBet ? ' on a wet board' : ''}${probeNote}${posThinNote}, lost to much stronger hand${ownNote}${overbetNote}`,
                    handRank: rank,
                };
            }

            // Draw miss: called streets with a draw that didn't complete
            if (p.showdownCards?.length >= 2 && p.postCalls >= 1) {
                const drawCheck = detectDraw(p.showdownCards, boardCards);
                // Straight draws: require at least one hole card in the draw window
                let hasStraightDraw = false;
                if (drawCheck.oesd || drawCheck.gutshot) {
                    const sdRankIdx = c => RANK_ORDER.indexOf(rankOf(c));
                    const holeIdxSD = new Set(p.showdownCards.map(sdRankIdx));
                    const allIdxSD = [...new Set([...p.showdownCards, ...boardCards].map(sdRankIdx))].sort((a, b) => a - b);
                    for (let base = 0; base <= 8; base++) {
                        const win = [base, base + 1, base + 2, base + 3, base + 4];
                        if (win.filter(i => allIdxSD.includes(i)).length === 4 && win.some(i => holeIdxSD.has(i))) {
                            hasStraightDraw = true; break;
                        }
                    }
                }
                if (drawCheck.flushDraw || hasStraightDraw) {
                    const drawType = drawCheck.flushDraw ? 'flush' : drawCheck.oesd ? 'open-ended straight' : 'gutshot straight';
                    const hadPair = flopHandRank >= 1 || turnHandRank >= 1;
                    const pairNote = hadPair ? ' + pair' : ' (no pair)';
                    return {
                        verdict: 'DRAW_MISS',
                        reason: `Called ${p.postCalls} street${p.postCalls > 1 ? 's' : ''} with a ${drawType} draw${pairNote} — missed at showdown`,
                        handRank: rank,
                    };
                }
            }

            if (p.postCalls > 0 && (rankGap !== null ? rankGap >= 3 : p.postCalls >= 2)) {
                const midHandRank = Math.max(flopHandRank, turnHandRank);
                const midHandNote = midHandRank >= 1 ? ` (picked up ${midHandRank >= 2 ? 'two pair' : 'a pair'} mid-hand)` : ' (air the whole way)';
                return {
                    verdict: 'LOOSE_CALL',
                    reason: rankGap !== null
                        ? `Called down with ${handLabel}${midHandNote}, lost to ${winnerRank >= 6 ? 'very strong' : 'much stronger'} hand${ownNote}`
                        : `Called ${p.postCalls} streets with ${handLabel}${midHandNote} — opponent's hand unknown${ownNote}`,
                    handRank: rank,
                };
            }

            // Preflop aggressor who lost passively (all-in pre or checked through)
            if (raisedPre) {
                return {
                    verdict: 'VALUE_LOSS',
                    reason: `Raised preflop with ${p.showdownHandName || handLabel} — outdrawn at showdown${ownNote}`,
                    handRank: rawRank,
                };
            }

            // Completely passive — no bets, calls, or preflop raise. Nothing to profile.
            if (totalAgg === 0 && (p.postCalls || 0) === 0 && !raisedPre) return null;
        } else if (rank >= 2 && rank <= 3) {
            const handLabel = ownership.ownership === 'board_noise'
                ? `${p.showdownHandName || 'two pair/trips'} (board-driven — little actual value)`
                : ownership.ownership === 'board_assisted'
                    ? `${p.showdownHandName || 'two pair/trips'} (partly board-given)`
                    : p.showdownHandName || 'two pair/trips';

            const vlMadeStreet = madeOn(rank);
            const vlMadeNote = vlMadeStreet ? ` — had it from ${vlMadeStreet}` : '';
            if (rankGap !== null && rankGap >= 4)
                return { verdict: 'OUTPLAYED', reason: `Had ${handLabel}${vlMadeNote}, badly dominated`, handRank: rank };
            return { verdict: 'VALUE_LOSS', reason: `${ownership.ownership === 'board_noise' ? 'Weak board-driven hand' : 'Reasonable hand'} (${handLabel})${vlMadeNote} ran into better`, handRank: rank };
        } else if (rank >= 6) {
            return { verdict: 'VALUE_LOSS', reason: `Strong hand (${p.showdownHandName || 'full house+'}) outdrawn by winner`, handRank: rank };
        }

        // Final fallback: any loser who reached showdown
        return {
            verdict: 'VALUE_LOSS',
            reason: `Lost at showdown with ${p.showdownHandName || 'unknown hand'}${ownNote}`,
            handRank: rawRank,
        };
    }

    function cardHtml(card, sm = false, xs = false) {
        if (!card) return '';
        const m = card.trim().match(/^(10|[2-9AKQJT])([\u2660\u2665\u2666\u2663])$/);
        if (!m) return '';
        const suit = m[2];
        const suitClass =
            suit === '\u2665' ? 'tphud-card-heart' :
                suit === '\u2666' ? 'tphud-card-diamond' :
                    suit === '\u2663' ? 'tphud-card-club' :
                        suit === '\u2660' ? 'tphud-card-spade' : '';
        const cls = `tphud-card${suitClass ? ' ' + suitClass : ''}${xs ? ' tphud-card-xs' : sm ? ' tphud-card-sm' : ''}`;
        return `<span class="${cls}">${m[1]}<br>${m[2]}</span>`;
    }

    function cardsHtml(cards, sm = false) {
        if (!cards || !cards.length) return '';
        return cards.map(c => cardHtml(c, sm)).join('');
    }

    // Builds two card spans from a canonical hand key (e.g. "AKs", "QQ", "T9o").
    // Suited \u2192 same suit (\u2660\u2660). Pairs/offsuit \u2192 \u2660\u2665.
    function canonicalHandCards(ch, xs = false) {
        if (!ch || ch.length < 2) return '';
        const isPair = ch.length === 2;
        const isSuited = !isPair && ch.endsWith('s');
        const r1 = ch[0];
        const r2 = isPair ? ch[1] : ch[1];
        const s1 = '\u2660';
        const s2 = isSuited ? '\u2660' : '\u2665';
        return cardHtml(r1 + s1, false, xs) + cardHtml(r2 + s2, false, xs);
    }

    function escHtml(s) {
        return String(s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    let histShowLostTo = false;

    let statsCache = null;
    let activePanelPlayer = { name: null, numericId: null };

    // Mr. Coach state
    const COACH_STREETS = ['preflop', 'flop', 'turn', 'river'];
    let streetLogs = { preflop: [], flop: [], turn: [], river: [] };
    let streetActionSeq = { preflop: 0, flop: 0, turn: 0, river: 0 };
    let streetFiredCounts = { preflop: 0, flop: 0, turn: 0, river: 0 };
    let activeCoachStreet = 'preflop';
    let coachActionDebounce = null;
    let lastCoachFireStreet = null;   // tracks which street coach last fired on (decoupled from card detection)
    let selfCardsMissingOnLastFire = false; // dirty flag: re-fire self-advice when cards become available
    let coachMobileCollapsed = true;
    let coachDesktopCollapsed = false;
    let lastCoachPeekText = null;
    let savePending = false;
    let recentHandHistories = [];
    let tableSessionLog = [];  // session-only table round log; never persisted
    let coachTextCache = { preflop: [], flop: [], turn: [], river: [] };
    let prevHandCoachCache = null; // { preflop: [], flop: [], turn: [], river: [] }
    let lastOwnLean = null;  // most recent self-advice text, for bet reaction
    let lastBetCtx = null;  // computed context snapshot when coach last fired, for bet reaction
    let lastPotOddsNeeded = null; // pot odds % needed to call on last turn, for fold evaluation
    let betReactionTimer = null;
    const SAVE_DEBOUNCE_MS = 2000;
    let pageWasHidden = false;
    let finalizeTimer = null;
    let lastHandFinalizeAt = 0;
    const POST_FINALIZE_SHOWDOWN_GRACE_MS = 2500;

    // Session-level bluff outcome tracker — resets with coach on new table
    let sessionBluffs = {
        attempted: 0, won: 0, lost: 0,
        byStreet: { flop: { w: 0, l: 0 }, turn: { w: 0, l: 0 }, river: { w: 0, l: 0 } },
        consecutiveFails: 0,
    };

    function parseStatsStorage(raw) {
        if (!raw) return null;
        try {
            const parsed = JSON.parse(raw);
            return parsed && typeof parsed === 'object' ? parsed : null;
        } catch (e) {
            return null;
        }
    }

    // ── IndexedDB storage layer ───────────────────────────────────
    // Single source of truth for all persistent data. Works on desktop, mobile,
    // TornPDA, and any context — no GM dependency, no localStorage quota issues.

    const IDB_NAME = 'tornPokerHUD';
    const IDB_VER = 1;
    const IDB_STORE = 'kv';
    let _idbPromise = null;

    function _openIDB() {
        if (_idbPromise) return _idbPromise;
        _idbPromise = new Promise((resolve, reject) => {
            const req = indexedDB.open(IDB_NAME, IDB_VER);
            req.onupgradeneeded = e => e.target.result.createObjectStore(IDB_STORE);
            req.onsuccess = e => resolve(e.target.result);
            req.onerror = e => reject(e.target.error);
        });
        return _idbPromise;
    }

    function idbGet(key) {
        return _openIDB().then(db => new Promise((resolve, reject) => {
            const req = db.transaction(IDB_STORE, 'readonly').objectStore(IDB_STORE).get(key);
            req.onsuccess = e => resolve(e.target.result ?? null);
            req.onerror = e => reject(e.target.error);
        })).catch(() => null);
    }

    function idbSet(key, value) {
        return _openIDB().then(db => new Promise((resolve, reject) => {
            const req = db.transaction(IDB_STORE, 'readwrite').objectStore(IDB_STORE).put(value, key);
            req.onsuccess = () => resolve();
            req.onerror = e => reject(e.target.error);
        })).catch(err => {
            // Surface quota issues so persistent data loss is visible in the console.
            if (err && err.name === 'QuotaExceededError') {
                console.warn('[PokerHUD] IndexedDB quota exceeded — stats may not persist for key', key);
            } else if (err) {
                console.warn('[PokerHUD] IndexedDB write failed for key', key, '—', err.message || err);
            }
        });
    }

    // Pull a value from old GM/localStorage storage for one-time migration.
    function _migrateOldValue(key) {
        if (typeof GM_getValue === 'function') {
            try {
                const v = GM_getValue(key, null);
                if (v && typeof v.then !== 'function' && v !== null) return v;
            } catch (e) { }
        }
        try { return localStorage.getItem(key); } catch (e) { return null; }
    }

    // Loads all stores from IDB into their in-memory caches.
    // If IDB is empty, migrates one-time from old GM/localStorage.
    // Returns a Promise — call from init() and wait before attaching badges.
    function idbInit() {
        return Promise.all([
            idbGet(STATS_KEY),
            idbGet(LIVE_STACKS_KEY),
            idbGet(HAND_HIST_KEY),
            idbGet(SUSPICION_KEY),
            idbGet('_gmMigrated'),
            idbGet(SYNC_QUEUE_KEY),
        ]).then(([rawStats, rawStacks, rawHistory, rawSuspicion, gmMigrated, rawSyncQueue]) => {

            // ── Sync queue (hands not yet uploaded) ───────────────
            if (rawSyncQueue) {
                try {
                    const saved = JSON.parse(rawSyncQueue);
                    if (Array.isArray(saved)) _syncQueue = saved.slice(-SYNC_QUEUE_CAP);
                } catch (e) { }
            }

            // ── Stats ─────────────────────────────────────────────
            // Load whatever IDB has first (may be empty or partial from before migration ran)
            const parsedIdbStats = parseStatsStorage(rawStats);
            statsCache = (parsedIdbStats && Object.keys(parsedIdbStats).length > 0) ? parsedIdbStats : {};

            // One-time GM merge — runs until flagged done regardless of IDB state.
            // Needed because early versions wrote {} to IDB before the GM grant was restored,
            // and subsequent sessions added new data on top, making IDB non-empty but incomplete.
            if (!gmMigrated && typeof GM_getValue === 'function') {
                try {
                    const gmRaw = GM_getValue(STATS_KEY, null);
                    if (gmRaw && typeof gmRaw.then !== 'function') {
                        const gmStats = parseStatsStorage(gmRaw);
                        if (gmStats && Object.keys(gmStats).length > 0) {
                            // Per-player merge: keep whichever record has more observed hands
                            for (const [k, v] of Object.entries(gmStats)) {
                                if (!statsCache[k] || (v.handsObserved || 0) > (statsCache[k].handsObserved || 0)) {
                                    statsCache[k] = v;
                                }
                            }
                            idbSet(STATS_KEY, JSON.stringify(statsCache));
                        }
                    }
                } catch (e) { }
                idbSet('_gmMigrated', '1');
            }

            // Rekey name-keyed records to their Torn XID when known. XID keys survive
            // renames and cannot collide the way display names can. Idempotent: records
            // that only learn their XID later get moved on a subsequent load.
            try {
                let rekeyed = false;
                for (const [k, v] of Object.entries(statsCache)) {
                    const xid = v && v.numericId ? String(v.numericId) : null;
                    if (!xid || k === xid) continue;
                    const existing = statsCache[xid];
                    if (!existing || (v.handsObserved || 0) > (existing.handsObserved || 0)) {
                        statsCache[xid] = v;
                    }
                    delete statsCache[k];
                    rekeyed = true;
                }
                if (rekeyed) idbSet(STATS_KEY, JSON.stringify(statsCache));
            } catch (e) { }

            // ── Live stacks ───────────────────────────────────────
            const stackRaw = rawStacks || _migrateOldValue(LIVE_STACKS_KEY);
            if (stackRaw) {
                try {
                    const saved = JSON.parse(stackRaw);
                    const now = Date.now();
                    for (const [id, ls] of Object.entries(saved)) {
                        if (!ls.lastSeen || (now - ls.lastSeen) > LIVE_STACKS_MAX_AGE) continue;
                        liveStacks[id] = {
                            stack: null,
                            peakStack: ls.peakStack ?? null,
                            allIn: false,
                            rebuys: ls.rebuys ?? 0,
                            lastSeen: ls.lastSeen ?? null,
                            startStack: ls.startStack ?? null,
                            firstSeen: ls.firstSeen ?? null,
                            lowStackConfirmed: false,
                        };
                        if (ls.startStack != null)
                            _sessionOrigin[id] = { startStack: ls.startStack, firstSeen: ls.firstSeen ?? null };
                    }
                } catch (e) { }
            }

            // ── Hand history ──────────────────────────────────────
            const histRaw = rawHistory || _migrateOldValue(HAND_HIST_KEY);
            if (histRaw) {
                try {
                    const saved = JSON.parse(histRaw);
                    if (Array.isArray(saved)) recentHandHistories = saved;
                } catch (e) { }
            }

            // ── Suspicion pairs ───────────────────────────────────
            // Persistent across sessions and tables. Legacy (v1) saves were gated to one
            // table and had no timestamps; their events get stamped now and start aging.
            const suspRaw = rawSuspicion || _migrateOldValue(SUSPICION_KEY);
            if (suspRaw) {
                try {
                    const saved = JSON.parse(suspRaw);
                    const now = Date.now();
                    if (saved && Array.isArray(saved.pairs)) {
                        for (const entry of saved.pairs) {
                            const events = (entry.events || [])
                                .map(e => ({ ...e, ts: e.ts || now }))
                                .filter(e => (now - e.ts) <= SUSPICION_MAX_AGE_MS)
                                .slice(-SUSPICION_EVENTS_CAP);
                            if (events.length)
                                suspicionPairs.set(entry.key, { players: entry.players, events });
                        }
                    }
                } catch (e) { }
            }
        }).catch(e => console.warn('[TPHUD] idbInit failed:', e));
    }

    // Persist session stack state so profit/playtime survive a browser refresh
    function saveLiveStacks() {
        const toSave = {};
        for (const [id, ls] of Object.entries(liveStacks)) {
            if (ls.startStack != null) {
                toSave[id] = {
                    startStack: ls.startStack,
                    firstSeen: ls.firstSeen,
                    peakStack: ls.peakStack,
                    rebuys: ls.rebuys,
                    lastSeen: ls.lastSeen,
                };
            }
        }
        idbSet(LIVE_STACKS_KEY, JSON.stringify(toSave));
    }

    function saveSuspicionPairs() {
        const pairs = [];
        for (const [key, pair] of suspicionPairs)
            pairs.push({ key, players: pair.players, events: pair.events });
        idbSet(SUSPICION_KEY, JSON.stringify({ version: 2, pairs }));
    }

    function saveHandHistory() {
        idbSet(HAND_HIST_KEY, JSON.stringify(recentHandHistories));
    }

    // ── Cloud sync layer ─────────────────────────────────────────
    // Devices push per-hand delta events (deduped server-side by hand id) and
    // pull merged profiles, so every device sees the union of all reads.
    // Offline-first: everything queues in IndexedDB and the coach never waits
    // on the network.
    let _syncQueue = [];
    let _syncFlushTimer = null;
    let _syncFlushing = false;
    let _syncPullTimer = null;
    let popPriors = null; // { vpip, pfr, afq, hands } from /api/priors

    function syncRequest(method, path, bodyObj, onSuccess, onError) {
        const url = SYNC_SERVER_URL + path;
        const headers = { 'X-API-Key': SYNC_API_KEY };
        const body = bodyObj != null ? JSON.stringify(bodyObj) : null;
        if (body) headers['Content-Type'] = 'application/json';
        const fail = e => { if (onError) onError(e); };
        if (typeof GM_xmlhttpRequest === 'function') {
            GM_xmlhttpRequest({
                method, url, headers, data: body || undefined,
                responseType: 'json',
                onload: resp => {
                    let data = resp.response;
                    if (typeof data === 'string') { try { data = JSON.parse(data); } catch { data = null; } }
                    if (resp.status >= 200 && resp.status < 300 && data) onSuccess(data);
                    else fail(new Error(`HTTP ${resp.status}`));
                },
                onerror: () => fail(new Error('network error')),
            });
        } else {
            fetch(url, { method, headers, body: body || undefined })
                .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
                .then(onSuccess)
                .catch(fail);
        }
    }

    function saveSyncQueue() {
        idbSet(SYNC_QUEUE_KEY, JSON.stringify(_syncQueue));
    }

    function enqueueSyncHand(handEvent) {
        _syncQueue.push(handEvent);
        while (_syncQueue.length > SYNC_QUEUE_CAP) _syncQueue.shift();
        saveSyncQueue();
        scheduleSyncFlush(5000);
    }

    function scheduleSyncFlush(delayMs) {
        if (_syncFlushTimer) return;
        _syncFlushTimer = setTimeout(() => { _syncFlushTimer = null; flushSyncQueue(); }, delayMs);
    }

    function flushSyncQueue() {
        if (!hudSettings.cloudSync || _syncFlushing || !_syncQueue.length) return;
        _syncFlushing = true;
        const batch = _syncQueue.slice(0, SYNC_BATCH_SIZE);
        syncRequest('POST', '/api/hands', { hands: batch },
            () => {
                _syncFlushing = false;
                _syncQueue.splice(0, batch.length);
                saveSyncQueue();
                if (_syncQueue.length) scheduleSyncFlush(1000);
            },
            () => {
                _syncFlushing = false;
                scheduleSyncFlush(60000); // server unreachable: retry later, queue persists
            });
    }

    // Pull merged profiles and adopt any record the server knows better.
    // Local-only enrichments (net worth cache) are preserved.
    function pullProfiles() {
        if (!hudSettings.cloudSync) return;
        const since = parseInt(localStorage.getItem(SYNC_LAST_PULL_KEY) || '0', 10) || 0;
        syncRequest('GET', `/api/profiles?since=${since}`, null, data => {
            const profiles = data.profiles || {};
            let adopted = 0;
            for (const [key, rec] of Object.entries(profiles)) {
                if (!rec || typeof rec !== 'object') continue;
                const local = statsCache[key];
                if (local && (local.handsObserved || 0) > (rec.handsObserved || 0)) continue;
                if (local) {
                    if (rec.networth == null && local.networth != null) {
                        rec.networth = local.networth;
                        rec.networthFetched = local.networthFetched || false;
                    }
                }
                statsCache[key] = rec;
                adopted++;
            }
            if (adopted > 0) {
                markStatsDirty();
                try { refreshAllBadges(); } catch { }
            }
            if (data.serverTime) localStorage.setItem(SYNC_LAST_PULL_KEY, String(data.serverTime));
        }, () => { });
    }

    function pullPriors() {
        if (!hudSettings.cloudSync) return;
        syncRequest('GET', '/api/priors', null, data => {
            // Only trust priors backed by a real sample; clamp away degenerate values
            if (data && (data.hands || 0) >= 500) {
                const clamp01 = v => (v == null ? null : Math.max(0.05, Math.min(0.7, v)));
                popPriors = { vpip: clamp01(data.vpip), pfr: clamp01(data.pfr), afq: clamp01(data.afq), hands: data.hands };
            }
        }, () => { });
    }

    // Kick off sync once local state is loaded: seed the server on first
    // contact, then pull profiles and priors, then keep both fresh.
    function syncInit() {
        if (!hudSettings.cloudSync) return;
        syncRequest('GET', '/api/status', null, status => {
            if (!status.imported && Object.keys(getStats()).length > 0) {
                syncRequest('POST', '/api/import', { stats: getStats() },
                    r => { console.log('[TPHUD] cloud sync: seeded server with', r.imported, 'players'); pullProfiles(); },
                    () => { });
            } else {
                pullProfiles();
            }
            pullPriors();
            flushSyncQueue();
        }, () => { /* server down: queue keeps accumulating locally */ });
        if (!_syncPullTimer) {
            _syncPullTimer = setInterval(() => {
                if (!isPageActive()) return;
                pullProfiles();
                flushSyncQueue();
            }, SYNC_PULL_INTERVAL_MS);
        }
    }

    // ── Delta extraction for sync ────────────────────────────────
    // Uploads are the numeric increments a hand applied to a profile, so the
    // server can rebuild profiles by replay. Identity/device-local fields and
    // arrays are excluded (history/autoTags travel separately, capped).
    const _SYNC_SKIP_KEYS = new Set([
        'displayName', 'numericId', 'lastSeen',
        'networth', 'networthFetched',
        'recent', 'history', 'autoTags',
    ]);

    function _numericSnapshot(obj) {
        const out = {};
        for (const [k, v] of Object.entries(obj || {})) {
            if (_SYNC_SKIP_KEYS.has(k)) continue;
            if (typeof v === 'number' && isFinite(v)) out[k] = v;
            else if (v && typeof v === 'object' && !Array.isArray(v)) out[k] = _numericSnapshot(v);
        }
        return out;
    }

    function _numericDiff(before, after) {
        const out = {};
        for (const [k, v] of Object.entries(after || {})) {
            if (_SYNC_SKIP_KEYS.has(k)) continue;
            if (typeof v === 'number' && isFinite(v)) {
                const prev = (before && typeof before[k] === 'number') ? before[k] : 0;
                const d = v - prev;
                if (d !== 0) out[k] = d;
            } else if (v && typeof v === 'object' && !Array.isArray(v)) {
                const sub = _numericDiff(before ? before[k] : null, v);
                if (Object.keys(sub).length) out[k] = sub;
            }
        }
        return out;
    }


    function getStats() {
        // statsCache is populated by idbInit() before badges render.
        // If somehow called before init completes, return empty rather than blocking.
        if (!statsCache) statsCache = {};
        return statsCache;
    }

    function resolveStatsByName(name, allOverride) {
        if (!name) return null;
        const all = allOverride || getStats();
        if (!all) return null;

        const lower = String(name).toLowerCase();
        const numId = (chatNameToSeatId[name] || nameToSeatId[name]);
        const candidates = [];
        const push = s => { if (s && !candidates.includes(s)) candidates.push(s); };

        // XID-keyed entry is authoritative: seat element ids are real Torn player ids
        // (used for profile links and API calls), so a numeric hit is this player even
        // if they renamed since the record was written.
        if (numId && all[String(numId)]) push(all[String(numId)]);
        push(all[name]);

        const keys = Object.keys(all);
        const keyMatch = keys.find(k => k.toLowerCase() === lower);
        if (keyMatch) push(all[keyMatch]);

        keys.forEach(k => {
            const dn = all[k]?.displayName;
            if (dn && String(dn).toLowerCase() === lower) push(all[k]);
        });

        if (!candidates.length) return null;
        if (candidates.length === 1) return candidates[0];
        return candidates.reduce(
            (best, cur) => ((cur.handsObserved || 0) > (best.handsObserved || 0)) ? cur : best,
            candidates[0]
        );
    }

    let _statsFlushTimer = null;

    function flushStatsSave() {
        if (!statsCache) return;
        if (_statsFlushTimer) { clearTimeout(_statsFlushTimer); _statsFlushTimer = null; }
        savePending = false;
        idbSet(STATS_KEY, JSON.stringify(statsCache));
    }

    function markStatsDirty() {
        // Trailing debounce: coalesces burst writes (e.g. multiple auto-tags fired at hand finalization) into one save.
        // Force-flushed on visibilitychange / beforeunload so no pending data is lost on tab close.
        if (_statsFlushTimer) return;
        _statsFlushTimer = setTimeout(flushStatsSave, 1500);
    }

    // Appends a structured auto-tag to a player's profile. Capped at 50 to prevent unbounded growth.
    // tagObj: { label, handCards?, boardCards?, handName?, outcome?, line?, extra? }
    function appendAutoTag(name, tagObj) {
        if (!hudSettings.autoTagPlays) return;
        const all = getStats();
        const s = resolveStatsByName(name, all);
        if (!s) return;
        if (!s.autoTags) s.autoTags = [];
        // Guard against duplicate entries from the same hand (same label + extra)
        const newest = s.autoTags[0];
        if (newest && typeof newest === 'object' && newest.label === tagObj.label && newest.extra === tagObj.extra) return;
        const date = new Date().toLocaleDateString([], { month: 'short', day: 'numeric', year: '2-digit' });
        s.autoTags.unshift({ ...tagObj, date });
        if (s.autoTags.length > 50) s.autoTags.length = 50;
        markStatsDirty();
    }

    function fmtBoard(cards) {
        if (!cards || !cards.length) return '?';
        if (cards.length <= 3) return cards.join('');
        if (cards.length === 4) return cards.slice(0, 3).join('') + '-' + cards[3];
        return cards.slice(0, 3).join('') + '-' + cards[3] + '-' + cards[4];
    }

    function bettingLineSummary(p) {
        const parts = [];
        for (const street of ['preflop', 'flop', 'turn', 'river']) {
            const d = p[street];
            if (!d) continue;
            if ((d.bets || 0) > 0) parts.push(`bet ${street}`);
            if ((d.raises || 0) > 0) parts.push(`raised ${street}`);
        }
        if (p.raisedPreflop && !parts.some(x => x.includes('preflop'))) parts.unshift('raised preflop');
        return parts.join(', ');
    }

    function checkAutoTagsAtFinalization(name, p, currentHand, streetBoards = {}) {
        if (!hudSettings.autoTagPlays) return;
        if (name === localPlayerName) return;

        const board = currentHand.boardCards || [];
        const outcome = p.wonShowdown ? 'won' : p.wonNoShowdown ? 'won uncontested' : 'lost';
        const line = bettingLineSummary(p);
        const pos = p.position || null;

        // Hand rank at a specific street board — returns -1 if not computable
        const _streetRankFor = board => {
            if (!p.showdownCards?.length || !board?.length || board.length < 3) return -1;
            const score = _scoreHand([...p.showdownCards, ...board]);
            return score > 0 ? Math.floor(score / _BRACKET) : -1;
        };

        // ── Triggers that fire without hole cards ────────────────

        // Limp-reraise: limped preflop then 3-bet when someone raised — strong trap or squeeze tell
        if (p.limpedPreflop && p.threeBet) {
            appendAutoTag(name, {
                label: 'Limp-reraise preflop',
                handCards: p.showdownCards || null,
                handName: p.showdownHandName || null,
                boardCards: board,
                outcome,
                line,
                extra: pos ? `from ${pos}` : null,
            });
        }

        // Donk-bet into preflop aggressor on flop — disregards position, often weak or tricky
        if (p.sawFlop && currentHand.flopBettor === name && currentHand.preflopAggressor && currentHand.preflopAggressor !== name) {
            appendAutoTag(name, {
                label: 'Donk-bet flop into PFA',
                handCards: p.showdownCards || null,
                handName: p.showdownHandName || null,
                boardCards: board,
                outcome,
                line,
                extra: null,
            });
        }

        // ── Triggers that require hole cards ────────────────────

        const hasCards = p.showdownCards && p.showdownCards.length >= 2;
        if (!hasCards) return;

        const handCards = p.showdownCards;
        const handName = p.showdownHandName || null;

        // Triple barrel bluff: bet all 3 streets, weak hand, lost
        const betFlop = (p.flop?.bets || 0) + (p.flop?.raises || 0) > 0;
        const betTurn = (p.turn?.bets || 0) + (p.turn?.raises || 0) > 0;
        const betRiver = (p.river?.bets || 0) + (p.river?.raises || 0) > 0;
        if (betFlop && betTurn && betRiver && p.reachedShowdown && !p.wonShowdown && p.showdownRank <= 1) {
            appendAutoTag(name, {
                label: 'Triple barrel bluff',
                handCards,
                handName,
                boardCards: board,
                outcome: 'lost',
                line,
                extra: null,
            });
        } else if (p.reachedShowdown && !p.wonShowdown && p.showdownRank <= 1 && (p.postBets + p.postRaises) >= 1) {
            // Single/double barrel bluff
            appendAutoTag(name, {
                label: 'Bluffed to showdown',
                handCards,
                handName,
                boardCards: board,
                outcome: 'lost',
                line,
                extra: null,
            });
        }

        // Overbet with known hand
        const overbets = (p.betAmts || []).filter(b => b.potBefore > 0 && b.amt / b.potBefore > 1.5);
        overbets.forEach(ob => {
            const pct = Math.round(ob.amt / ob.potBefore * 100);
            appendAutoTag(name, {
                label: `Overbet ${ob.street}`,
                handCards,
                handName,
                boardCards: board,
                outcome,
                line,
                extra: `${pct}% pot`,
            });
        });

        // Check-raise with known hand (dedupe streets in case of multiple raises on same street)
        ([...new Set(p.checkRaiseStreets || [])]).forEach(street => {
            const crRank = _streetRankFor(streetBoards[street]);
            appendAutoTag(name, {
                label: `Check-raised ${street}`,
                handCards,
                handName: crRank >= 0 ? rankToHandName(crRank) : handName,
                boardCards: board,
                outcome,
                line,
                extra: null,
            });
        });

        // 3-bet bluff: 3-bet preflop, weak hand, lost at showdown
        if (p.threeBet && p.reachedShowdown && !p.wonShowdown && p.showdownRank <= 1) {
            appendAutoTag(name, {
                label: '3-bet bluff',
                handCards,
                handName,
                boardCards: board,
                outcome: 'lost',
                line,
                extra: pos ? `from ${pos}` : null,
            });
        }

        // Called off big chunk of stack with weak hand and lost
        if (p.reachedShowdown && !p.wonShowdown && p.showdownRank <= 1) {
            const bigCall = (p.callPcts || []).find(c => c >= 35);
            if (bigCall) {
                appendAutoTag(name, {
                    label: 'Called off big stack with weak hand',
                    handCards,
                    handName,
                    boardCards: board,
                    outcome: 'lost',
                    line,
                    extra: `${Math.round(bigCall)}% of stack`,
                });
            }
        }

        // Slowplay: trips+ hand at that specific street, checked it, still won
        if (p.wonShowdown) {
            const flopRank = _streetRankFor(streetBoards.flop);
            const turnRank = _streetRankFor(streetBoards.turn);
            const slowplayFlop = (p.flop?.checks || 0) > 0 && flopRank >= 3;
            const slowplayTurn = (p.turn?.checks || 0) > 0 && turnRank >= 3;
            if (slowplayFlop || slowplayTurn) {
                const slowStreet = slowplayFlop ? 'flop' : 'turn';
                const slowStreetRank = slowplayFlop ? flopRank : turnRank;
                const slowHandName = rankToHandName(slowStreetRank) || 'strong hand';
                appendAutoTag(name, {
                    label: `Slowplayed ${slowHandName} — checked ${slowStreet}`,
                    handCards,
                    handName: slowHandName,
                    boardCards: board,
                    outcome: 'won',
                    line,
                    extra: null,
                });
            }
        }
    }

    function blankStats(name) {
        return {
            displayName: name,
            handsObserved: 0,
            vpipCount: 0,
            pfrCount: 0,
            limpCount: 0,
            threeBetCount: 0,
            threeBetOpportunities: 0,
            foldTo3BetCount: 0,
            foldTo3BetOpportunities: 0,
            postBets: 0, postRaises: 0, postCalls: 0, postChecks: 0, postFolds: 0,
            facedFlopBetCount: 0,
            foldedVsFlopBetCount: 0,
            cbetFlopOpps: 0,   // hands where player was preflop aggressor AND saw flop
            cbetFlopMade: 0,   // those where they bet the flop (took the cbet)
            foldToCbetFlopOpps: 0, // hands where player faced a cbet on the flop (preflop aggressor's bet)
            foldToCbetFlopFolded: 0, // those where they folded to it
            donkFlopOpps: 0,   // hands where player was a preflop caller (not raiser) AND saw flop AND a preflop aggressor existed
            donkFlopMade: 0,   // those where they bet into the preflop aggressor on the flop
            crFlopCount: 0,   // hands where player check-raised on the flop. Rate = crFlopCount / sawFlopCount.
            squeezeCount: 0,   // hands where player squeezed (3-bet after a caller flatted the open). Rate = squeezeCount / threeBetOpportunities.
            wonAfterSawFlopCount: 0, // hands where player saw flop AND won (showdown OR uncontested) — feeds WWSF
            sawFlopCount: 0,
            wentToShowdownCount: 0,
            wonAtShowdownCount: 0,
            wonNoShowdownCount: 0,
            showdownWeak: 0,
            showdownStrong: 0,
            shownWeak: 0,
            shownStrong: 0,
            voluntaryShowCount: 0,
            voluntaryShowAfterWin: 0,
            recent: [],
            history: [],
            autoTags: [],
            byTable: {},
            numericId: null,
            lastSeen: Date.now(),
            raisePctSum: 0,
            raisePctSamples: 0,
            callPctSum: 0,
            callPctSamples: 0,
            positions: blankPositions(),
            bluffCount: 0,
            thinValueCount: 0,
            valuePlayCount: 0,
            drawCount: 0,
            drawMissCount: 0,
            looseCallCount: 0,
            protectionCount: 0,
            strongValueCount: 0,
            thinWinCount: 0,
            trapCount: 0,
            totalVerdicts: 0,
            ucStealCount: 0,
            ucCbetWinCount: 0,
            ucBarrelWinCount: 0,
            ucDelayedCount: 0,
            ucProbeCount: 0,
            ucPassiveCount: 0,
            ucOverbetCount: 0,
            ucTotalVerdicts: 0,
            selfBluffSuccessCount: 0,
            selfValueUncalledCount: 0,
            selfSemiBluffCount: 0,
            selfThinValueWinCount: 0,
            startingHands: {},
            shownHands: {},
            selfFoldedStrongCount: 0,
            selfFoldedStrongCorrectCount: 0,
            selfFoldedDrawCount: 0,
            selfFoldedAirCount: 0,
            selfFoldedMarginalCount: 0,
            facedTurnBetCount: 0,
            foldedVsTurnBetCount: 0,
            facedRiverBetCount: 0,
            foldedVsRiverBetCount: 0,
            networth: null,  // fetched net worth value; null until a fetch attempt completes
            networthFetched: false, // true once a fetch attempt has completed (success or failure)
        };
    }

    function blankPositions() {
        return {
            EP: { hands: 0, vpip: 0, pfr: 0 },
            MP: { hands: 0, vpip: 0, pfr: 0 },
            LP: { hands: 0, vpip: 0, pfr: 0 },
            SB: { hands: 0, vpip: 0, pfr: 0 },
            BB: { hands: 0, vpip: 0, pfr: 0 },
        };
    }

    function blankTableStats() {
        return {
            handsObserved: 0,
            vpipCount: 0, pfrCount: 0, limpCount: 0,
            threeBetCount: 0, threeBetOpportunities: 0,
            foldTo3BetCount: 0, foldTo3BetOpportunities: 0,
            postBets: 0, postRaises: 0, postCalls: 0, postChecks: 0, postFolds: 0,
            facedFlopBetCount: 0, foldedVsFlopBetCount: 0,
            cbetFlopOpps: 0, cbetFlopMade: 0,
            foldToCbetFlopOpps: 0, foldToCbetFlopFolded: 0,
            donkFlopOpps: 0, donkFlopMade: 0,
            crFlopCount: 0,
            squeezeCount: 0,
            wonAfterSawFlopCount: 0,
            sawFlopCount: 0, wentToShowdownCount: 0, wonAtShowdownCount: 0,
            wonNoShowdownCount: 0,
            showdownWeak: 0, showdownStrong: 0,
            shownWeak: 0, shownStrong: 0,
            voluntaryShowCount: 0, voluntaryShowAfterWin: 0,
            bluffCount: 0, thinValueCount: 0, valuePlayCount: 0,
            drawCount: 0, drawMissCount: 0, looseCallCount: 0, protectionCount: 0,
            strongValueCount: 0, thinWinCount: 0, trapCount: 0,
            totalVerdicts: 0,
            ucStealCount: 0,
            ucCbetWinCount: 0,
            ucBarrelWinCount: 0,
            ucDelayedCount: 0,
            ucProbeCount: 0,
            ucPassiveCount: 0,
            ucOverbetCount: 0,
            ucTotalVerdicts: 0,
            selfBluffSuccessCount: 0,
            selfValueUncalledCount: 0,
            selfSemiBluffCount: 0,
            selfThinValueWinCount: 0,
            startingHands: {},
            shownHands: {},
            selfFoldedStrongCount: 0,
            selfFoldedStrongCorrectCount: 0,
            selfFoldedDrawCount: 0,
            selfFoldedAirCount: 0,
            selfFoldedMarginalCount: 0,
            facedTurnBetCount: 0,
            foldedVsTurnBetCount: 0,
            facedRiverBetCount: 0,
            foldedVsRiverBetCount: 0,
            recent: [],
            raisePctSum: 0, raisePctSamples: 0,
            callPctSum: 0, callPctSamples: 0,
            positions: blankPositions(),
        };
    }

    let currentHand = null;

    // Returns effective stack in BBs for the hero at hand start.
    // Effective = min(selfBB, maxOppBB) — the largest opponent stack caps what you can win.
    // Returns null if BB or hero stack is unknown.
    function computeEffectiveStackBB(stackSnap) {
        if (!currentTableBB || !localPlayerName || !stackSnap) return null;
        const selfStack = stackSnap[localPlayerName];
        if (!selfStack || selfStack <= 0) return null;
        const selfBB = selfStack / currentTableBB;
        const oppBBs = Object.entries(stackSnap)
            .filter(([name]) => name !== localPlayerName)
            .map(([, stack]) => stack / currentTableBB)
            .filter(bb => bb > 0);
        if (oppBBs.length === 0) return selfBB;
        // Max opp stack — deep stack theory only needs one deep opponent to pay you off
        return Math.min(selfBB, Math.max(...oppBBs));
    }

    function newHandState(handId, synthetic = false) {
        return {
            handId,
            synthetic,
            street: 'preflop',
            seenPreflop: false,
            _handEnded: false,
            perPlayer: {},
            boardCards: [],
            flopCards: [],
            turnCards: [],
            riverCards: [],
            stackAtStart: {},
            effectiveStackBB: null,     // hero effective stack in BBs at hand start
            preflopRaiseCount: 0,
            preflopFirstRaiser: null,
            preflopHasCallerAfterRaise: false, // true once any non-raiser calls after a preflop raise — feeds squeeze detection
            flopBetOccurred: false,
            flopBettor: null,
            bbAmount: null,
            dealerSeatId: null,
            sbPlayer: null,
            bbPlayer: null,
            seatOrder: [],
            seatNameMap: {},
            selfHoleCards: null,
            selfFoldStreet: null,
            selfBoardAtFold: null,
            selfFoldEquity: null,
            isHU: isHeadsUp,
            runningPot: 0,
            playerPotContrib: {},
            aggressionHistory: {},  // playerName -> [{street, actionType, amount}]
            actionLog: { preflop: [], flop: [], turn: [], river: [] },
            selfBluffLine: {
                active: false,
                streets: [],                // streets where self bet with bluff-tier hand
                handStrengthAtBet: {},      // { flop: 'air', turn: 'bottom_pair' }
                abandonedOnStreet: null,    // street where self checked after bluffing
                facingCallStreets: [],      // streets opponent called our bluff bet
            },
        };
    }

    function isShowdownOnlyLogMessage(actor, text) {
        if (!text) return false;
        if (actor === 'Game') return false;
        if (actor === 'The preflop' || actor.startsWith('The flop') || actor.startsWith('The turn') || actor.startsWith('The river')) {
            return false;
        }
        return (
            /reveals\s*\[/i.test(text) ||
            (/\bshows?\s*\[/i.test(text) && !/reveals?\s*\[/i.test(text)) ||
            /won.*did not show hand/i.test(text) ||
            /won.*with\s*\[/i.test(text)
        );
    }

    function isStaleSyntheticHand(hand) {
        if (!hand?.synthetic) return false;
        if (hand._handEnded) return true;
        if ((hand.boardCards?.length || 0) >= 5) return true;
        if (hand.street === 'river') return true;
        return Object.values(hand.perPlayer || {}).some(p =>
            p?.reachedShowdown ||
            p?.wonShowdown ||
            p?.wonNoShowdown ||
            p?.voluntaryShowed ||
            (p?.showdownCards && p.showdownCards.length >= 2)
        );
    }

    function ensureCurrentHand() {
        if (currentHand && !currentHand._handEnded) return currentHand;
        if (currentHand?._handEnded) {
            try { finalizeCurrentHand(); } catch (e) { }
            currentHand = null;
            resetCoachLogs();
        }
        syncTableContextFromTexture();
        currentHand = newHandState(`synthetic_${Date.now()}`, true);
        return currentHand;
    }

    function ensurePlayer(name) {
        ensureCurrentHand();
        if (!currentHand.perPlayer[name]) {
            currentHand.perPlayer[name] = {
                postedSB: false,
                postedBB: false,
                inHandPreflop: false,
                voluntaryPreflop: false,
                raisedPreflop: false,
                foldedPreflop: false,
                limpedPreflop: false,
                facedPreflopRaise: currentHand.preflopRaiseCount > 0,
                threeBet: false,
                facedThreeBet: false,
                foldedToThreeBet: false,
                sawFlop: false,
                foldedOnFlop: false,
                postBets: 0, postRaises: 0, postCalls: 0, postChecks: 0, postFolds: 0,
                flop: { bets: 0, raises: 0, calls: 0, checks: 0, folds: 0 },
                turn: { bets: 0, raises: 0, calls: 0, checks: 0, folds: 0 },
                river: { bets: 0, raises: 0, calls: 0, checks: 0, folds: 0 },
                betAmts: [],
                callAmts: [],
                reachedShowdown: false,
                showdownRank: -1,
                wonNoShowdown: false,
                wonShowdown: false,
                voluntaryShowed: false,
                preflopRaiseAmt: null,
                riverAction: null,
                showdownCards: null,
                showdownHandName: null,
                winAmt: null,
                position: null,
                raisePcts: [],
                callPcts: [],
                preflopCallAmt: null,
                checkRaiseStreets: [],
            };
        }
        return currentHand.perPlayer[name];
    }

    function getRenderedTextureKey() {
        const table = document.querySelector('[class^="table___"][style*="tables_colour"]');
        const style = table?.getAttribute('style') || '';
        if (!style) return null;
        const m = style.match(/tables_colour\/\d+\/\d+_([a-z0-9_]+)\.png/i);
        return m ? m[1].toLowerCase() : null;
    }

    function handleHardTableSwitch(nextBB, nextName) {
        const changed = currentTableBB !== nextBB || currentTableName !== nextName;
        if (!changed) return;

        finalizeCurrentHand();
        resetCoachLogs();
        currentHand = null;
        // Only clear liveStacks on a genuine mid-session table switch.
        // currentTableBB === null means the table wasn't identified yet (page load / DOM not ready),
        // so loaded session data should be preserved, not wiped.
        console.log('[TPHUD-DEBUG] handleHardTableSwitch', currentTableBB, '->', nextBB, 'clearing liveStacks:', currentTableBB !== null, 'keys:', Object.keys(liveStacks));
        if (currentTableBB !== null) {
            Object.keys(liveStacks).forEach(k => delete liveStacks[k]);
        }
        Object.keys(stackByName).forEach(k => delete stackByName[k]);
        Object.keys(nameToSeatId).forEach(k => delete nameToSeatId[k]);
        Object.keys(chatNameToSeatId).forEach(k => delete chatNameToSeatId[k]);
        // Suspicion pairs deliberately survive table switches: events are stamped with
        // their table and repeat offenders should accumulate evidence across tables.

        currentTableBB = nextBB;
        currentTableName = nextName;
        currentStakeTier = getStakeTier(nextBB);

        document.querySelectorAll('[id^="player-"]').forEach(seat => {
            delete seat.dataset.hudBoundName;
            delete seat.dataset.hudName;
            const old = seat.querySelector('.tphud-badge');
            if (old) old.remove();
        });

        lastTableSwitchTime = Date.now();

        attachBadgesToSeats();
        refreshAllBadges();

        // Mobile: force re-attach after render delay
        setTimeout(() => { attachBadgesToSeats(); }, 100);
        setTimeout(() => { attachBadgesToSeats(); }, 300);
        setTimeout(() => { attachBadgesToSeats(); refreshAllBadges(); }, 500);
    }

    // Derives the current street from board card count and force-syncs state.
    // Needed after page refresh or visibility return when street marker messages may be missing from the DOM.
    function syncStreetFromBoardCards() {
        if (!currentHand || currentHand._handEnded) return;
        const n = currentHand.boardCards?.length || 0;
        const derived = n >= 5 ? 'river' : n >= 4 ? 'turn' : n >= 3 ? 'flop' : 'preflop';
        if (derived !== currentHand.street) {
            currentHand.street = derived;
        }
        if (derived !== activeCoachStreet) {
            activeCoachStreet = derived;
            switchCoachTab(derived);
        }
    }

    function syncTableContextFromTexture(force = false) {
        const textureKey = getRenderedTextureKey();
        if (!textureKey) return false;
        currentTextureKey = textureKey;

        const meta = TABLE_BY_TEXTURE[textureKey];
        if (!meta) {
            console.warn('[TPHUD] Unknown texture:', textureKey);
            return false;
        }

        if (force) {
            currentTableBB = meta.bb;
            currentTableName = meta.name;
            currentStakeTier = getStakeTier(meta.bb);
            refreshAllBadges();
            return true;
        }

        handleHardTableSwitch(meta.bb, meta.name);
        return true;
    }

    // ── Message parsing ──────────────────────────────────────────

    // Retries dealer + blind position resolution with exponential backoff until delay reaches 2000ms.
    function retryPositionContext(hand, delay) {
        setTimeout(function () {
            if (!hand || hand !== currentHand) return;
            if (!hand.dealerSeatId) {
                hand.dealerSeatId = getDealerSeatId();
            }
            // Rebuild seat order and name map if they were incomplete at hand start
            const snap = captureSeatOrder();
            if (snap.order.length > (hand.seatOrder?.length || 0)) {
                hand.seatOrder = snap.order;
                hand.seatNameMap = snap.nameToSeat;
            }
            if (hand.dealerSeatId && hand.seatOrder && hand.seatOrder.length >= 2) {
                fixBlindPlayersFromPosition(hand);
                updatePositionIndicator('active');
            } else if (delay < 2000) {
                retryPositionContext(hand, delay * 2);
            } else {
                // Dealer never resolved but try showing indicator anyway using DOM fallback
                updatePositionIndicator('active');
            }
        }, delay);
    }

    // Returns the count of opponents still active (not folded) at the current moment.
    // Used to snapshot numOpp at fold time so equity doesn't drift as others fold later.
    function _countActiveOpponents() {
        if (!currentHand?.perPlayer) return 1;
        const pp = currentHand.perPlayer;
        const count = Object.keys(pp).filter(name => {
            if (name === localPlayerName) return false;
            if (pp[name].foldedPreflop) return false;
            if (pp[name].foldedOnFlop) return false;
            if ((pp[name].turn?.folds || 0) > 0) return false;
            if ((pp[name].river?.folds || 0) > 0) return false;
            return true;
        }).length;
        return Math.max(1, count);
    }

    // ── Parser health ────────────────────────────────────────────
    // Everything downstream depends on regex-matching Torn's English log text. If Torn
    // rewords a message the stats degrade silently, so track action-shaped lines that no
    // branch recognized and warn the user once the pattern is clear.
    const parserHealth = { unparsed: 0, samples: [], warned: false };

    function _noteUnparsedActionLine(text) {
        parserHealth.unparsed++;
        if (parserHealth.samples.length < 5 && !parserHealth.samples.includes(text))
            parserHealth.samples.push(text);
        console.warn(`[TPHUD] Unrecognized action line (${parserHealth.unparsed} this session): "${text}"`);
        if (parserHealth.unparsed >= 5 && !parserHealth.warned) {
            parserHealth.warned = true;
            _showParserWarnBanner();
        }
    }

    function _showParserWarnBanner() {
        if (document.getElementById('tphud-parser-warn')) return;
        const el = document.createElement('div');
        el.id = 'tphud-parser-warn';
        el.style.cssText = 'position:fixed;top:8px;left:50%;transform:translateX(-50%);z-index:1000000;' +
            'background:#3a2a12;border:1px solid #e67e22;color:#f5c98a;padding:8px 12px;border-radius:8px;' +
            'font:12px/1.4 Arial,sans-serif;max-width:460px;box-shadow:0 4px 16px rgba(0,0,0,0.5)';
        const sample = parserHealth.samples[0] ? escHtml(parserHealth.samples[0].slice(0, 80)) : '';
        el.innerHTML = `<b>Poker HUD:</b> ${parserHealth.unparsed} game log lines were not recognized this session` +
            ` (e.g. "${sample}"). Torn may have changed its log wording; stats for these actions are not being` +
            ` recorded. <span id="tphud-parser-warn-x" style="cursor:pointer;color:#fff;font-weight:bold;` +
            `margin-left:8px">Dismiss</span>`;
        document.body.appendChild(el);
        el.querySelector('#tphud-parser-warn-x').addEventListener('click', () => el.remove());
    }

    function processMessage(node) {
        const actor = node.querySelector('em')?.textContent?.trim() || '';
        const span = node.querySelector('span');
        const text = span ? span.textContent.trim() : '';
        if (!text) return;

        if (actor === 'Game' && /started$/.test(text)) {
            const handId = text.replace(/\s*started$/, '').trim();

            if (currentHand && currentHand.synthetic) {
                if (isStaleSyntheticHand(currentHand)) {
                    if (finalizeTimer) { clearTimeout(finalizeTimer); finalizeTimer = null; }
                    currentHand = null;
                } else {
                    currentHand.handId = handId;
                    currentHand.synthetic = false;
                    if (!currentHand.seatOrder.length) {
                        const snap = captureSeatOrder();
                        currentHand.seatOrder = snap.order;
                        currentHand.seatNameMap = snap.nameToSeat;
                    }
                    if (!currentHand.dealerSeatId) currentHand.dealerSeatId = getDealerSeatId();
                    if (!currentHand.dealerSeatId) {
                        retryPositionContext(currentHand, 200);
                    } else {
                        fixBlindPlayersFromPosition(currentHand);
                        updatePositionIndicator('active');
                    }
                    return;
                }
            }

            finalizeCurrentHand();
            resetCoachLogs();
            currentHand = newHandState(handId, false);
            currentHand.stackAtStart = { ...stackByName };
            currentHand.effectiveStackBB = computeEffectiveStackBB(currentHand.stackAtStart);
            const seatSnap = captureSeatOrder();
            currentHand.seatOrder = seatSnap.order;
            currentHand.seatNameMap = seatSnap.nameToSeat;
            currentHand.dealerSeatId = getDealerSeatId();
            // Dealer button DOM may not be painted yet — retry with escalating backoff
            if (!currentHand.dealerSeatId) {
                retryPositionContext(currentHand, 200);
            } else {
                fixBlindPlayersFromPosition(currentHand);
                updatePositionIndicator('active');
            }
            return;
        }

        // Allow parsing even if preflop/blind lines arrive before Game started
        if (!currentHand) {
            if (
                lastHandFinalizeAt &&
                (Date.now() - lastHandFinalizeAt) < POST_FINALIZE_SHOWDOWN_GRACE_MS &&
                isShowdownOnlyLogMessage(actor, text)
            ) {
                return;
            }
            if (
                actor === 'The preflop' ||
                actor.startsWith('The flop') ||
                actor.startsWith('The turn') ||
                actor.startsWith('The river') ||
                /posted|called|raised|bet|checked|folded|reveals|won|shows|joined the table|left the table/i.test(text)
            ) {
                ensureCurrentHand();
            } else {
                return;
            }
        }

        if (actor === 'The preflop') {
            if (currentHand?.seenPreflop || currentHand?._handEnded) {
                try { finalizeCurrentHand(); } catch (e) { }
                currentHand = null;  // force null even if finalizeCurrentHand threw
                resetCoachLogs();
            }
            // currentHand may be null here: either seenPreflop triggered finalize above,
            // or the 900ms scheduleHandFinalize timer already fired before this message arrived
            if (!currentHand) {
                currentHand = newHandState(`synthetic_${Date.now()}`, true);
                currentHand.stackAtStart = { ...stackByName };
                currentHand.effectiveStackBB = computeEffectiveStackBB(currentHand.stackAtStart);
                const seatSnap = captureSeatOrder();
                currentHand.seatOrder = seatSnap.order;
                currentHand.seatNameMap = seatSnap.nameToSeat;
                currentHand.dealerSeatId = getDealerSeatId();
                if (!currentHand.dealerSeatId) {
                    retryPositionContext(currentHand, 200);
                } else {
                    fixBlindPlayersFromPosition(currentHand);
                    updatePositionIndicator('active');
                }
            }
            currentHand.seenPreflop = true;
            currentHand.street = 'preflop';
            switchCoachTab('preflop');
            return;
        }
        if (actor.startsWith('The flop')) {
            if (!currentHand || currentHand._handEnded) return;
            currentHand.street = 'flop';
            if (currentHand.boardCards.length === 0) {
                const cards = parseCardsList(text);
                if (cards) currentHand.boardCards.push(...cards);
            }
            currentHand.flopCards = [...currentHand.boardCards];
            Object.values(currentHand.perPlayer).forEach(p => {
                if (p.inHandPreflop && !p.foldedPreflop) p.sawFlop = true;
            });
            // Cards are read lazily by triggerCoachOnYourTurn to avoid stale DOM state
            // at flop message time (DOM may not have updated from previous hand yet)
            updatePositionIndicator('flop');
            switchCoachTab(currentHand?.street || 'preflop');
            if (isSelfFolded()) {
                // Recalculate preflop fold equity against the players who actually saw the flop
                const selfFoldedPreflop = currentHand.perPlayer?.[localPlayerName]?.foldedPreflop;
                if (selfFoldedPreflop && currentHand.selfHoleCards?.length === 2) {
                    const sawFlopCount = Object.keys(currentHand.perPlayer)
                        .filter(n => n !== localPlayerName && currentHand.perPlayer[n].sawFlop)
                        .length;
                    if (sawFlopCount > 0 && sawFlopCount !== currentHand.selfFoldNumOpps) {
                        const result = _monteCarlo(currentHand.selfHoleCards, [], 800, sawFlopCount);
                        currentHand.selfFoldEquity = result.win;
                        currentHand.selfFoldNumOpps = sawFlopCount;
                    }
                }
                setTimeout(refreshCoachForFold, 120);
            }
            return;
        }
        if (actor.startsWith('The turn')) {
            if (!currentHand || currentHand._handEnded) return;
            currentHand.street = 'turn';
            if (currentHand.boardCards.length <= 3) {
                const cards = parseCardsList(text);
                if (cards) {
                    // Some message formats show the full board — only push cards not already known
                    const existing = new Set(currentHand.boardCards);
                    cards.filter(c => !existing.has(c)).forEach(c => {
                        if (currentHand.boardCards.length < 4) currentHand.boardCards.push(c);
                    });
                }
            }
            currentHand.turnCards = [...currentHand.boardCards];
            updatePositionIndicator('turn');
            switchCoachTab(currentHand?.street || 'preflop');
            if (isSelfFolded()) setTimeout(refreshCoachForFold, 120);
            return;
        }
        if (actor.startsWith('The river')) {
            if (!currentHand || currentHand._handEnded) return;
            currentHand.street = 'river';
            if (currentHand.boardCards.length <= 4) {
                const cards = parseCardsList(text);
                if (cards) {
                    // Some message formats show the full board — only push cards not already known
                    const existing = new Set(currentHand.boardCards);
                    cards.filter(c => !existing.has(c)).forEach(c => {
                        if (currentHand.boardCards.length < 5) currentHand.boardCards.push(c);
                    });
                }
            }
            currentHand.riverCards = [...currentHand.boardCards];
            updatePositionIndicator('river');
            switchCoachTab(currentHand?.street || 'preflop');
            if (isSelfFolded()) setTimeout(refreshCoachForFold, 120);
            return;
        }

        if (/joined the table|left the table/i.test(text)) return;

        const p = ensurePlayer(actor);
        const street = currentHand.street;
        currentHand.actionLog[street].push({ actor, text });

        if (/posted small blind/i.test(text)) {
            p.postedSB = true;
            p.inHandPreflop = true;
            if (!currentHand.sbPlayer) currentHand.sbPlayer = actor;
            const sbAmt = parseCashAmt(text);
            if (sbAmt) { currentHand.runningPot += sbAmt; currentHand.playerPotContrib[actor] = sbAmt; }
            return;
        }

        if (/posted big blind/i.test(text)) {
            p.postedBB = true;
            p.inHandPreflop = true;
            // First poster captured here; fixBlindPlayersFromPosition() will override with correct
            // position-derived assignment once the dealer is known at Game started.
            if (!currentHand.bbPlayer) currentHand.bbPlayer = actor;
            const bbAmt2 = parseCashAmt(text);
            if (bbAmt2) { currentHand.runningPot += bbAmt2; currentHand.playerPotContrib[actor] = bbAmt2; }
            if (!currentHand.bbAmount) {
                const am = text.match(/\$([\d,]+)/);
                if (am) {
                    currentHand.bbAmount = parseInt(am[1].replace(/,/g, ''), 10);
                    if (currentTableBB !== currentHand.bbAmount) {
                        if (!syncTableContextFromTexture()) {
                            currentTableBB = currentHand.bbAmount;
                            currentTableName = getTableName(currentTableBB) || currentTableName;
                            currentStakeTier = getStakeTier(currentTableBB);
                            refreshAllBadges();
                        }
                    }
                }
            }
            return;
        }

        // Torn reworded blind posts from "posted small/big blind ($X)" to plain "posted $X"
        // (no label). The two branches above catch the old wording; this catches the amount-only
        // form so blinds still feed the pot and don't trip the parser-health warning. SB/BB player
        // assignment stays position-derived (fixBlindPlayersFromPosition); blind size is classified
        // by amount vs the known table BB, falling back to post order (SB posts first).
        if (/^posted\b/i.test(text)) {
            const amt = parseCashAmt(text);
            p.inHandPreflop = true;
            if (amt) {
                currentHand.runningPot += amt;
                currentHand.playerPotContrib[actor] = (currentHand.playerPotContrib[actor] || 0) + amt;
            }
            currentHand._blindPostSeq = (currentHand._blindPostSeq || 0) + 1;
            const isBB = (currentTableBB && amt) ? (amt >= currentTableBB) : (currentHand._blindPostSeq >= 2);
            if (isBB) {
                p.postedBB = true;
                if (!currentHand.bbPlayer) currentHand.bbPlayer = actor;
                if (amt && (!currentHand.bbAmount || amt >= currentHand.bbAmount)) {
                    currentHand.bbAmount = amt;
                    if (currentTableBB !== amt && !syncTableContextFromTexture()) {
                        currentTableBB = amt;
                        currentTableName = getTableName(currentTableBB) || currentTableName;
                        currentStakeTier = getStakeTier(currentTableBB);
                        refreshAllBadges();
                    }
                }
            } else {
                p.postedSB = true;
                if (!currentHand.sbPlayer) currentHand.sbPlayer = actor;
            }
            return;
        }

        if (/^folded?$/i.test(text)) {
            if (street === 'preflop') {
                p.foldedPreflop = true;
                p.inHandPreflop = true;
                if (p.facedThreeBet) p.foldedToThreeBet = true;
                updatePositionIndicator('active');
                if (actor === localPlayerName) {
                    currentHand.selfFoldEquity = _oddsCache?.win ?? null;
                    currentHand.selfFoldNumOpps = _countActiveOpponents();
                    setTimeout(refreshCoachForFold, 80);
                }
            } else {
                p.postFolds++;
                if (p[street]) p[street].folds++;
                if (street === 'flop') p.foldedOnFlop = true;
                if (street === 'river') p.riverAction = 'folded river';
                if (actor === localPlayerName && (street === 'flop' || street === 'turn' || street === 'river')) {
                    currentHand.selfFoldStreet = street;
                    currentHand.selfBoardAtFold = [...currentHand.boardCards];
                    currentHand.selfFoldEquity = _oddsCache?.win ?? null;
                    currentHand.selfFoldNumOpps = _countActiveOpponents();
                    _recordSelfBluffAbandon(street);
                    setTimeout(refreshCoachForFold, 80);
                }
            }
            if (actor !== localPlayerName) recordOpponentAction(actor, 'fold', null, street);
            checkSoftPlay(actor, street);
            return;
        }

        if (/^checked?$/i.test(text)) {
            if (street === 'preflop') {
                p.inHandPreflop = true;
            } else {
                p.postChecks++;
                if (p[street]) p[street].checks++;
            }
            if (actor !== localPlayerName) recordOpponentAction(actor, 'check', null, street);
            else if (street !== 'preflop') _recordSelfBluffAbandon(street);
            return;
        }

        if (/^call(?:ed|s)?\s+(?:\$|\d)/i.test(text)) {
            if (street === 'preflop') {
                p.voluntaryPreflop = true;
                p.inHandPreflop = true;
                if (currentHand.preflopRaiseCount === 0) p.limpedPreflop = true;
                if (currentHand.preflopRaiseCount > 0) {
                    p.facedPreflopRaise = true;
                    currentHand.preflopHasCallerAfterRaise = true;
                }
                const pfCallAmt = parseCashAmt(text);
                if (pfCallAmt != null) p.preflopCallAmt = pfCallAmt;
            } else {
                p.postCalls++;
                if (p[street]) p[street].calls++;
                const callAmt = parseCashAmt(text);
                if (callAmt != null) {
                    const actorStack = stackByName[actor] ?? liveStacks[chatNameToSeatId[actor]]?.stack ?? currentHand?.stackAtStart?.[actor];
                    if (actorStack && actorStack > 0) {
                        const _cp = callAmt / actorStack * 100;
                        if (_cp <= 100) p.callPcts.push(_cp);
                    }
                    p.callAmts.push({ street, amt: callAmt });
                }
                if (street === 'river') {
                    p.riverAction = callAmt != null ? `called $${callAmt.toLocaleString()}` : 'called';
                }
            }
            // Pot tracking: add only the incremental amount this player is adding
            const _callTotal = parseCashAmt(text);
            let _callAdded = null;
            if (_callTotal) {
                const _prev = currentHand.playerPotContrib[actor] || 0;
                _callAdded = Math.max(0, _callTotal - _prev);
                currentHand.runningPot += _callAdded;
                currentHand.playerPotContrib[actor] = _callTotal;
            }
            if (actor !== localPlayerName) {
                recordOpponentAction(actor, 'call', _callTotal, street, _callAdded);
                // Track when opponent calls our postflop bluff bet
                if (street !== 'preflop' && currentHand.selfBluffLine?.active) {
                    if (!currentHand.selfBluffLine.facingCallStreets.includes(street)) {
                        currentHand.selfBluffLine.facingCallStreets.push(street);
                    }
                }
            }
            return;
        }

        if (/^bets?\s+(?:to\s+)?(?:\$|\d)/i.test(text)) {
            if (street !== 'preflop') {
                p.postBets++;
                if (p[street]) p[street].bets++;
                const betAmt = parseCashAmt(text);
                if (betAmt != null) {
                    const actorStack = stackByName[actor] ?? liveStacks[chatNameToSeatId[actor]]?.stack ?? currentHand?.stackAtStart?.[actor];
                    if (actorStack && actorStack > 0) {
                        const _rp = betAmt / actorStack * 100;
                        if (_rp <= 100) p.raisePcts.push(_rp);
                        if (betAmt / actorStack >= 0.90) p.postAllinBets = (p.postAllinBets || 0) + 1;
                    }
                    p.betAmts.push({ street, amt: betAmt, type: 'bet', potBefore: currentHand.runningPot });
                }
                if (street === 'flop' && !currentHand.flopBetOccurred) {
                    currentHand.flopBetOccurred = true;
                    currentHand.flopBettor = actor;
                }
                if (street === 'river') {
                    p.riverAction = betAmt != null ? `bet $${betAmt.toLocaleString()}` : 'bet';
                }
                // Track turn/river bets facing the self player
                if (localPlayerName && actor !== localPlayerName) {
                    const lp = currentHand.perPlayer[localPlayerName];
                    if (lp && lp.sawFlop && !lp.foldedPreflop) {
                        if (street === 'turn') currentHand._facedTurnBet = (currentHand._facedTurnBet || 0) + 1;
                        if (street === 'river') currentHand._facedRiverBet = (currentHand._facedRiverBet || 0) + 1;
                    }
                }
                if (actor !== localPlayerName) {
                    const _betAmt2 = parseCashAmt(text);
                    if (_betAmt2) { currentHand.runningPot += _betAmt2; currentHand.playerPotContrib[actor] = (currentHand.playerPotContrib[actor] || 0) + _betAmt2; }
                    recordOpponentAction(actor, 'bet', _betAmt2, street, _betAmt2);
                } else {
                    _recordSelfBluffBet(street, betAmt);
                }
            }
            return;
        }

        if (/^raise[ds]?\s+(?:to\s+)?(?:\$|\d)/i.test(text)) {
            // Use the total commitment ("raised $X to $Y" → $Y) for sizing and pot math.
            const raiseAmt = parseTotalAmt(text);
            const _prevContrib = currentHand.playerPotContrib[actor] || 0;
            const _raiseAdded = raiseAmt != null ? Math.max(0, raiseAmt - _prevContrib) : null;
            if (street === 'preflop') {
                if (currentHand.preflopRaiseCount > 0) {
                    p.facedPreflopRaise = true;
                    p.threeBet = true;
                    // Squeeze: a 3-bet that comes after at least one caller has flatted the original raise.
                    if (currentHand.preflopHasCallerAfterRaise) p.squeezed = true;
                }
                p.voluntaryPreflop = true;
                p.raisedPreflop = true;
                p.inHandPreflop = true;
                p.preflopRaiseAmt = raiseAmt;
                if (raiseAmt) {
                    const actorStack = stackByName[actor] ?? liveStacks[chatNameToSeatId[actor]]?.stack ?? currentHand?.stackAtStart?.[actor];
                    if (actorStack && actorStack > 0) {
                        const _rp = raiseAmt / actorStack * 100;
                        if (_rp <= 100) p.raisePcts.push(_rp);
                    }
                }
                // When this is a 3-bet (first re-raise), mark prior raisers as facing a 3-bet
                const isThreeBet = currentHand.preflopRaiseCount === 1;
                if (currentHand.preflopRaiseCount === 0) currentHand.preflopFirstRaiser = actor;
                currentHand.preflopRaiseCount++;
                currentHand.preflopAggressor = actor;
                if (isThreeBet) currentHand.preflopThreeBettor = actor;
                Object.entries(currentHand.perPlayer).forEach(([n, op]) => {
                    if (n !== actor) {
                        op.facedPreflopRaise = true;
                        if (isThreeBet && op.raisedPreflop) op.facedThreeBet = true;
                    }
                });
                if (actor !== localPlayerName) recordOpponentAction(actor, 'raise', raiseAmt, 'preflop', _raiseAdded);
            } else {
                p.postRaises++;
                if (p[street]) p[street].raises++;
                if (raiseAmt != null) {
                    const actorStack = stackByName[actor] ?? liveStacks[chatNameToSeatId[actor]]?.stack ?? currentHand?.stackAtStart?.[actor];
                    if (actorStack && actorStack > 0) {
                        const _rp = raiseAmt / actorStack * 100;
                        if (_rp <= 100) p.raisePcts.push(_rp);
                        if (raiseAmt / actorStack >= 0.90) p.postAllinRaises = (p.postAllinRaises || 0) + 1;
                    }
                    p.betAmts.push({ street, amt: raiseAmt, type: 'raise', potBefore: currentHand.runningPot });
                    // Track check-raise per street. checkRaiseStreets feeds opponent auto-tags (skip self).
                    // checkRaisedFlopThisHand feeds aggregate stats (count everyone, including hero).
                    if (p[street] && p[street].checks > 0) {
                        if (actor !== localPlayerName) p.checkRaiseStreets.push(street);
                        if (street === 'flop') p.checkRaisedFlopThisHand = true;
                    }
                }
                if (street === 'river') p.riverAction = raiseAmt != null ? `raised $${raiseAmt.toLocaleString()}` : 'raised';
                // Track turn/river raises facing the self player
                if (localPlayerName && actor !== localPlayerName) {
                    const lp = currentHand.perPlayer[localPlayerName];
                    if (lp && lp.sawFlop && !lp.foldedPreflop) {
                        if (street === 'turn') currentHand._facedTurnBet = (currentHand._facedTurnBet || 0) + 1;
                        if (street === 'river') currentHand._facedRiverBet = (currentHand._facedRiverBet || 0) + 1;
                    }
                }
                if (actor !== localPlayerName) recordOpponentAction(actor, 'raise', raiseAmt, street, _raiseAdded);
                else _recordSelfBluffBet(street, raiseAmt);
            }
            // Pot tracking for raises: add only the incremental amount over previous contribution
            if (raiseAmt) {
                const _prev = currentHand.playerPotContrib[actor] || 0;
                const _added = Math.max(0, raiseAmt - _prev);
                currentHand.runningPot += _added;
                currentHand.playerPotContrib[actor] = raiseAmt;
            }
            return;
        }

        if (/reveals\s*\[/i.test(text)) {
            p.reachedShowdown = true;
            p.showdownCards = parseCardsList(text.match(/\[([^\]]+)\]/)?.[1]);
            const hm = text.match(/\(([^)]+)\)/);
            if (hm) {
                p.showdownRank = parseHandRank(hm[1]);
                p.showdownHandName = hm[1];
            }
            return;
        }

        if (/won.*did not show hand/i.test(text)) {
            p.wonNoShowdown = true;
            const winAmt = parseCashAmt(text);
            if (winAmt != null) p.winAmt = winAmt;
            scheduleHandFinalize('won_no_showdown');
            return;
        }

        if (/won.*with\s*\[/i.test(text)) {
            p.wonShowdown = true;
            p.reachedShowdown = true;
            const brackets = [...text.matchAll(/\[([^\]]+)\]/g)];
            p.showdownCards = brackets[0] ? parseCardsList(brackets[0][1]) : null;
            if (brackets[1] && !currentHand.boardCards.length) {
                const board = parseCardsList(brackets[1][1]);
                if (board) currentHand.boardCards.push(...board);
            }
            const winAmt = parseCashAmt(text);
            if (winAmt != null) p.winAmt = winAmt;
            const hm = text.match(/\(([^)]+)\)/);
            if (hm) {
                p.showdownRank = parseHandRank(hm[1]);
                p.showdownHandName = hm[1];
            }
            scheduleHandFinalize('won_showdown');
            return;
        }

        if (/\bshows?\s*\[/i.test(text) && !/reveals?\s*\[/i.test(text)) {
            p.voluntaryShowed = true;
            p.showdownCards = parseCardsList(text.match(/\[([^\]]+)\]/)?.[1]);
            return;
        }

        // Fallthrough: a player-actor line starting with an action verb that no branch
        // above recognized. Action lines always lead with the verb (the actor is in a
        // separate element), so this stays quiet on ordinary table chat.
        if (/^(?:folded?|checked?|call(?:ed|s)?|bets?|raise[ds]?|posts?(?:ed)?|reveals?|shows?|won)\b/i.test(text)) {
            _noteUnparsedActionLine(text);
        }
    }

    // ── History entries ──────────────────────────────────────────

    function buildHistEntry(handId, p, boardCards, bbAmount, startStack = null, winnerInfo = null) {
        const notable = p.raisedPreflop || p.sawFlop || p.wonNoShowdown ||
            p.reachedShowdown || p.voluntaryShowed || p.riverAction;

        let preflopAction;
        if (p.raisedPreflop)
            preflopAction = p.preflopRaiseAmt ? `Raised $${p.preflopRaiseAmt.toLocaleString()} preflop` : 'Raised preflop';
        else if (p.voluntaryPreflop)
            preflopAction = 'Called preflop';
        else if (p.postedBB && !p.foldedPreflop)
            preflopAction = 'Checked option (big blind)';
        else if (p.postedSB && !p.foldedPreflop)
            preflopAction = 'Small blind — stayed in';
        else if (p.foldedPreflop)
            preflopAction = 'Folded preflop';
        else
            preflopAction = 'Was in hand';

        let outcome;
        if (p.wonShowdown)
            outcome = { type: 'win', label: p.winAmt ? `Won $${p.winAmt.toLocaleString()} at showdown` : 'Won at showdown' };
        else if (p.wonNoShowdown)
            outcome = { type: 'win', label: p.winAmt ? `Won $${p.winAmt.toLocaleString()} (no showdown)` : 'Won uncontested' };
        else if (p.reachedShowdown)
            outcome = { type: 'lost', label: 'Lost at showdown' };
        else
            outcome = { type: 'folded', label: 'Folded' };

        return {
            ts: Date.now(),
            handId,
            notable,
            preflopAction,
            preflopRaiseAmt: p.preflopRaiseAmt || null,
            riverAction: p.riverAction || null,
            cards: p.showdownCards || null,
            handName: p.showdownHandName || null,
            boardCards: boardCards?.length ? [...boardCards] : null,
            voluntaryShowed: p.voluntaryShowed,
            bbAmount: bbAmount || null,
            verdict: p.bluffVerdict ?? null,
            flop: p.flop ? { ...p.flop } : null,
            turn: p.turn ? { ...p.turn } : null,
            river: p.river ? { ...p.river } : null,
            betAmts: [...(p.betAmts || [])],
            callAmts: [...(p.callAmts || [])],
            startStack: startStack,
            lostTo: (!p.wonShowdown && p.reachedShowdown && winnerInfo) ? winnerInfo : null,
            outcome,
            selfFoldVerdict: p.selfFoldVerdict || null,
            startingHand: p.showdownCards ? canonicalHand(p.showdownCards) : null,
            preflopCallAmt: p.preflopCallAmt || null,
        };
    }

    function readOwnCardsFromDOM() {
        const seat = document.querySelector('[id^="player-"][class*="self___"]');
        if (!seat) return null;
        const suitMap = { spades: '♠', hearts: '♥', diamonds: '♦', clubs: '♣' };
        const rankMap = { ace: 'A', king: 'K', queen: 'Q', jack: 'J', 10: '10' };
        const cards = [];
        seat.querySelectorAll('[class*="___"]').forEach(el => {
            for (const cls of el.classList) {
                const m = cls.match(/^(spades|hearts|diamonds|clubs)-(\w+)___/);
                if (m) {
                    const suit = suitMap[m[1]];
                    const rank = rankMap[m[2]] || m[2];
                    if (suit) cards.push(rank + suit);
                }
            }
        });
        const unique = [...new Map(cards.map(c => [c, c])).values()];
        return unique.length >= 2 ? unique.slice(0, 2) : null;
    }

    // ── Mr. Coach ────────────────────────────────────────────────

    function recordOpponentAction(playerName, actionType, amount, street, amountAdded) {
        const s = street || 'preflop';
        if (!streetLogs[s]) streetLogs[s] = [];
        streetActionSeq[s] = (streetActionSeq[s] || 0) + 1;
        streetLogs[s].push({ playerName, actionType, amount, amountAdded, street: s, timestamp: Date.now(), seq: streetActionSeq[s] });
        if (streetLogs[s].length > 25) streetLogs[s].shift();

        // Track per-hand aggression history for multi-street narrative
        if ((actionType === 'bet' || actionType === 'raise') && currentHand) {
            if (!currentHand.aggressionHistory[playerName]) currentHand.aggressionHistory[playerName] = [];
            currentHand.aggressionHistory[playerName].push({ street: s, actionType, amount });
        }
    }

    // ── Self bluff-line tracking helpers ─────────────────────────

    // Classifies the self player's current hand strength into stable tokens.
    // Returns: 'strong' | 'made' | 'semi' | 'bottom_pair' | 'overcards' | 'air' | null
    function classifySelfHandStrength() {
        if (!currentHand?.selfHoleCards || currentHand.selfHoleCards.length < 2) return null;
        if (!currentHand.boardCards || currentHand.boardCards.length < 3) return null;
        const holeCards = currentHand.selfHoleCards;
        const board = currentHand.boardCards.slice(0, 5);
        if (holeCards.some(c => board.includes(c))) return null;

        const holeRanks = holeCards.map(rankOf);
        const boardRanks = board.map(rankOf);
        const holeVals = holeRanks.map(r => RANK_VALUES[r]).filter(Boolean);
        const boardVals = boardRanks.map(r => RANK_VALUES[r]).filter(Boolean);
        const boardMax = boardVals.length ? Math.max(...boardVals) : 0;
        const holeMax = holeVals.length ? Math.max(...holeVals) : 0;

        const boardRankCounts = {};
        boardRanks.forEach(r => { boardRankCounts[r] = (boardRankCounts[r] || 0) + 1; });

        // Flush
        const sc = {}, hsc = {};
        [...holeCards, ...board].forEach(c => { const s = suitOf(c); sc[s] = (sc[s] || 0) + 1; });
        holeCards.forEach(c => { const s = suitOf(c); hsc[s] = (hsc[s] || 0) + 1; });
        const flushSuit = Object.keys(sc).find(s => sc[s] >= 5) || null;
        const hasMadeFlush = !!(flushSuit && (hsc[flushSuit] || 0) >= 1);
        const drawSuit = Object.keys(sc).find(s => sc[s] === 4 && (hsc[s] || 0) >= 1) || null;
        const hasFlushDraw = !!drawSuit && !hasMadeFlush;

        // Straight
        const rs = new Set([...holeVals, ...boardVals]);
        const hs = new Set(holeVals);
        if (rs.has(14)) rs.add(1);
        if (hs.has(14)) hs.add(1);
        let hasStraight = false;
        for (let s = 1; s <= 10; s++) {
            let ok = true, uh = false;
            for (let v = s; v <= s + 4; v++) { if (!rs.has(v)) { ok = false; break; } if (hs.has(v)) uh = true; }
            if (ok && uh) { hasStraight = true; break; }
        }
        let hasOesd = false;
        if (!hasStraight) {
            for (let s = 1; s <= 10; s++) {
                let hits = 0, missing = null, uh = false;
                for (let v = s; v <= s + 4; v++) { if (rs.has(v)) hits++; else missing = v; if (hs.has(v)) uh = true; }
                if (hits === 4 && uh && (missing === s || missing === s + 4)) { hasOesd = true; break; }
            }
        }

        // Pairs / made hands
        const hasPocket = holeRanks[0] === holeRanks[1];
        const holeHits = holeRanks.filter(r => boardRankCounts[r]);
        const uniqHits = [...new Set(holeHits)];
        const isTopPair = uniqHits.length >= 1 && holeVals.some(v => v === boardMax);
        const isSecondPair = uniqHits.length >= 1 && !isTopPair;
        const madeQuads = hasPocket && boardRankCounts[holeRanks[0]] >= 3;
        const madeSet = !madeQuads && hasPocket && boardRankCounts[holeRanks[0]] >= 1;
        const madeTrips = !hasPocket && uniqHits.length === 1 && boardRankCounts[uniqHits[0]] >= 2;
        const madeTwoPair = !hasPocket && uniqHits.length === 2;
        const overpair = hasPocket && boardMax > 0 && holeVals[0] > boardMax;
        const isUnderpair = hasPocket && !overpair && !madeSet && !madeQuads;
        const tripsRankCS = madeTrips ? uniqHits[0] : null;
        const madeTwoPairFH = madeTwoPair && uniqHits.some(r => boardRankCounts[r] >= 2);
        const madeTripsFullH = madeTrips && Object.entries(boardRankCounts).some(([r, c]) => r !== tripsRankCS && c >= 2);
        // Hero has one pair (not top pair) + board has a separate pair = two pair
        const boardPairedRankCS = Object.entries(boardRankCounts).find(([, c]) => c >= 2)?.[0] || null;
        const madeSecondPairPlusBoardPair = isSecondPair && boardPairedRankCS && !uniqHits.includes(boardPairedRankCS);

        if (hasMadeFlush || hasStraight || madeQuads || madeSet || madeTrips || madeTwoPairFH || madeTripsFullH) return 'strong';
        if (madeTwoPair || madeSecondPairPlusBoardPair || overpair || isTopPair) return 'made';
        if (hasFlushDraw || hasOesd) return 'semi';
        if (isSecondPair || isUnderpair) return 'bottom_pair';
        if (holeMax > boardMax) return 'overcards';
        return 'air';
    }

    // Activates the self bluff line when self bets postflop with a weak hand.
    function _recordSelfBluffBet(street, amount) {
        if (!currentHand?.selfHoleCards) return;
        const strength = classifySelfHandStrength();
        if (!strength || strength === 'strong' || strength === 'made') return;
        const bl = currentHand.selfBluffLine;
        bl.active = true;
        if (!bl.streets.includes(street)) bl.streets.push(street);
        bl.handStrengthAtBet[street] = strength;
    }

    // Marks the bluff line as abandoned when self checks or folds after bluffing.
    function _recordSelfBluffAbandon(street) {
        const bl = currentHand?.selfBluffLine;
        if (!bl?.active || bl.abandonedOnStreet || !bl.streets.length) return;
        bl.abandonedOnStreet = street;
    }

    function resetCoachLogs() {
        // Save current hand's coach advice before wiping
        const hasAny = Object.values(coachTextCache).some(arr => arr.length > 0);
        if (hasAny) prevHandCoachCache = coachTextCache;
        coachTextCache = { preflop: [], flop: [], turn: [], river: [] };

        processedKeys = new Set();
        streetLogs = { preflop: [], flop: [], turn: [], river: [] };
        streetActionSeq = { preflop: 0, flop: 0, turn: 0, river: 0 };
        streetFiredCounts = { preflop: 0, flop: 0, turn: 0, river: 0 };
        sessionBluffs = { attempted: 0, won: 0, lost: 0, byStreet: { flop: { w: 0, l: 0 }, turn: { w: 0, l: 0 }, river: { w: 0, l: 0 } }, consecutiveFails: 0 };
        activeCoachStreet = 'preflop';
        clearTimeout(coachActionDebounce);
        coachActionDebounce = null;
        lastCoachFireStreet = null;
        selfCardsMissingOnLastFire = false;
        lastOwnLean = null;
        lastBetCtx = null;
        lastPotOddsNeeded = null;
        clearTimeout(betReactionTimer);
        const panel = document.getElementById('tphud-coach');
        if (!panel) return;
        // Reset tabs — disable all except preflop
        panel.querySelectorAll('.tphud-coach-tab').forEach(t => {
            const s = t.dataset.street;
            t.classList.toggle('tphud-coach-tab-active', s === 'preflop');
            t.classList.remove('tphud-coach-tab-has-data');
            t.disabled = (s !== 'preflop');
        });
        panel.querySelectorAll('.tphud-coach-entry').forEach(e => e.remove());
        const msgEl = panel.querySelector('.tphud-coach-msg');
        if (msgEl) msgEl.textContent = hudSettings.mrCoachMode === 'off' ? 'Mr. Coach is off' : 'Watching the table...';

        const launcher = document.getElementById('tphud-coach-launcher');
        if (launcher) launcher.classList.remove('tphud-coach-launcher-hot');

        setCoachPeekText(null);
        // Clear slider marker on new hand
        window.dispatchEvent(new CustomEvent('tphud:betHint', { detail: { potPct: null } }));
        _resetBeatReadSnapshots();
        scheduleBeatBubbleRefresh();
    }

    // Returns a one-line summary of what happened on a completed street.
    // e.g. "Preflop: 1 raise, 2 callers, 1 fold"
    function getStreetSummaryLine(street) {
        const log = streetLogs[street] || [];
        if (!log.length) return null;
        const raises = log.filter(a => a.actionType === 'raise').length;
        const bets = log.filter(a => a.actionType === 'bet').length;
        const calls = log.filter(a => a.actionType === 'call').length;
        const folds = log.filter(a => a.actionType === 'fold').length;
        const parts = [];
        if (raises > 0) parts.push(`${raises} raise${raises !== 1 ? 's' : ''}`);
        if (bets > 0) parts.push(`${bets} bet${bets !== 1 ? 's' : ''}`);
        if (calls > 0) parts.push(`${calls} caller${calls !== 1 ? 's' : ''}`);
        if (folds > 0) parts.push(`${folds} fold${folds !== 1 ? 's' : ''}`);
        if (!parts.length) return null;
        const label = street.charAt(0).toUpperCase() + street.slice(1);
        return `${label}: ${parts.join(', ')}`;
    }

    function switchCoachTab(street) {
        // Snapshot a summary for the street we're leaving
        if (currentHand) {
            const prevStreet = COACH_STREETS[COACH_STREETS.indexOf(street) - 1];
            if (prevStreet) {
                if (!currentHand.streetSummaries) currentHand.streetSummaries = {};
                currentHand.streetSummaries[prevStreet] = getStreetSummaryLine(prevStreet);
            }
        }
        activeCoachStreet = street;
        const panel = document.getElementById('tphud-coach');
        if (!panel) return;
        const reached = COACH_STREETS.slice(0, COACH_STREETS.indexOf(street) + 1);
        panel.querySelectorAll('.tphud-coach-tab').forEach(t => {
            t.classList.toggle('tphud-coach-tab-active', t.dataset.street === street);
            t.disabled = !reached.includes(t.dataset.street);
        });
        // Re-render the body with this street's accumulated log
        updateCoachLog(streetLogs[street] || []);
    }

    // Reads visible action buttons to determine what the player is actually facing.
    // Returns 'bet' (facing a bet/raise to call), 'check' (can check, nothing to call), or null.
    function getFacingActionFromDOM() {
        const btns = [...document.querySelectorAll('button')].filter(b => b.offsetParent !== null);
        const labels = btns.map(b => b.textContent?.trim().toLowerCase()).filter(Boolean);
        if (labels.includes('call')) return 'bet';
        if (labels.includes('check')) return 'check';
        return null;
    }

    // True when the coach panel has no rendered entries (self or opponent).
    function isCoachPanelEmpty() {
        const panel = document.getElementById('tphud-coach');
        if (!panel) return true;
        return panel.querySelectorAll('.tphud-coach-entry').length === 0;
    }

    // Replaces the self-entry in the coach panel with a fold acknowledgment.
    // Called directly when self-fold is detected because triggerCoachOnYourTurn
    // won't fire after a fold (no action buttons visible).
    function refreshCoachForFold() {
        const panel = document.getElementById('tphud-coach');
        if (!panel) return;
        const body = panel.querySelector('.tphud-coach-body');
        if (!body) return;
        body.querySelectorAll('.tphud-coach-entry.tphud-coach-self').forEach(e => e.remove());
        const foldEntry = buildFoldedEntry();
        const msgEl = body.querySelector('.tphud-coach-msg');
        body.insertBefore(foldEntry, msgEl || body.firstChild);
    }

    // Plays a short beep and/or vibrates to signal it's the player's turn
    function playTurnAlert() {
        if (!hudSettings.turnAlert) return;
        try {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (AudioCtx) {
                const ctx = new AudioCtx();
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.type = 'sine';
                osc.frequency.setValueAtTime(880, ctx.currentTime);
                const vol = Math.max(0.001, Math.min(1, hudSettings.turnAlertVolume ?? 0.5));
                gain.gain.setValueAtTime(vol, ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
                osc.start(ctx.currentTime);
                osc.stop(ctx.currentTime + 0.35);
                osc.onended = () => ctx.close();
            }
        } catch (e) { /* audio unavailable */ }
    }

    function triggerCoachOnYourTurn() {
        if (!isPageActive()) return;
        if (hudSettings.mrCoachMode === 'off') return;
        if (!currentHand || currentHand._handEnded) return;
        attachBetReactionListener();
        const street = currentHand?.street || 'preflop';
        const log = streetLogs[street] || [];

        // Try to read own hole cards now if still missing
        if (!currentHand?.selfHoleCards && currentHand) {
            const cards = readOwnCardsFromDOM();
            if (cards) currentHand.selfHoleCards = cards;
        }

        const actionSeq = streetActionSeq[street] || 0;
        const hasNewActions = actionSeq > (streetFiredCounts[street] || 0);
        const isNewStreet = street !== lastCoachFireStreet;
        const hasSelfCards = (currentHand?.selfHoleCards?.length || 0) >= 2;
        const cardsBecameAvailable = hasSelfCards && selfCardsMissingOnLastFire;
        // If it's our turn but the panel is empty, force a render regardless of other guards.
        const panelEmpty = isCoachPanelEmpty();

        if (!hasNewActions && !isNewStreet && !cardsBecameAvailable && !panelEmpty) return;

        streetFiredCounts[street] = actionSeq;
        lastCoachFireStreet = street;
        selfCardsMissingOnLastFire = !hasSelfCards;

        const facingAction = getFacingActionFromDOM();

        const panel = document.getElementById('tphud-coach');
        if (log.length) {
            panel?.querySelector(`.tphud-coach-tab[data-street="${street}"]`)?.classList.add('tphud-coach-tab-has-data');
        }
        updateCoachLog(log, facingAction);
        scheduleBeatBubbleRefresh();
    }

    function getCoachConfidence(handsObserved) {
        if (handsObserved < hudSettings.coachLowConfidenceThreshold) return 'thin';
        if (handsObserved < hudSettings.coachMedConfidenceThreshold) return 'decent';
        return 'solid';
    }

    // Counts draw outs and returns equity strings using rule of 2 and 4.
    // Returns { outs, equityFlop, equityTurn, label } where equity is a readable % string.
    function calcExactDrawEquity(holeCards, board, flushDraw, drawSuit, straightDraw) {
        const known = [...holeCards, ...board];
        const D = 52 - known.length;
        const knownVals = known.map(c => RANK_VALUES[rankOf(c)]).filter(Boolean);
        const parts = [];
        let flushOuts = 0, strOuts = 0;

        if (flushDraw && drawSuit) {
            const suitSeen = known.filter(c => suitOf(c) === drawSuit).length;
            flushOuts = 13 - suitSeen;
            parts.push(`${flushOuts} flush outs`);
        }

        const completingRanks = straightDraw?.completingRanks;
        if (completingRanks?.size) {
            for (const rv of completingRanks) {
                const effRv = rv === 1 ? 14 : rv;
                const seen = knownVals.filter(v => v === effRv).length;
                let rankOuts = Math.max(0, 4 - seen);
                // subtract the one card that's also a flush out (already counted above)
                if (flushDraw && drawSuit) {
                    const alreadyCounted = !known.some(c => RANK_VALUES[rankOf(c)] === effRv && suitOf(c) === drawSuit);
                    if (alreadyCounted) rankOuts = Math.max(0, rankOuts - 1);
                }
                strOuts += rankOuts;
            }
            const strType = straightDraw.oesd ? 'straight outs' : 'straight outs (gutshot)';
            parts.push(`${strOuts} ${strType}`);
        }

        const outs = flushOuts + strOuts;
        if (outs === 0) return null;

        // Exact hypergeometric probability
        const equityFlop = Math.min(Math.round((1 - (D - outs) * (D - outs - 1) / (D * (D - 1))) * 100), 100);
        const equityTurn = Math.min(Math.round(outs / D * 100), 100);
        return { outs, equityFlop, equityTurn, label: parts.join(' + ') };
    }

    // Returns a mixed-strategy note when the spot is genuinely ambiguous (medium equity, medium pot odds).
    // Fires rarely — only when neither action is clearly dominant.
    // Includes a rough call-frequency anchor: at margin=0 lean 50/50, scaling linearly within the ±10% window.
    function getMixNote(equity, potOdds, handStrength) {
        if (equity == null || potOdds == null) return '';
        const margin = equity - potOdds;
        // Only fire in the tight window where the call is borderline
        if (Math.abs(margin) > 10) return '';
        // Don't fire on clearly strong or clearly weak hands
        if (handStrength === 'strong' || handStrength === 'fold') return '';
        // Frequency anchor: 50% at break-even, scales 2.5%/point toward call (max 75%, min 25%).
        const callFreq = Math.max(25, Math.min(75, Math.round(50 + margin * 2.5)));
        return _voice(
            ` Mixed spot — call about ${callFreq}% of the time, fold the rest. Read on them is the tiebreaker.`,
            ` Mixed spot, pal — call about ${callFreq}% of the time, fold the rest. Yous gotta read the room.`
        );
    }

    // Returns a short bet sizing recommendation string based on hand strength, board, street, and SPR.
    // Only used when hero is the one betting (not facing a bet).
    function getBetSizing(handStrength, texture, street, spr) {
        if (street === 'preflop' || street === 'river') {
            // River: thin value goes smaller, strong hands go bigger
            if (street === 'river') {
                if (handStrength === 'strong') return ' Bet 50–75% pot.';
                if (handStrength === 'thin') return ' Bet 25–40% pot.';
            }
            return '';
        }
        const isWet = !!(texture?.isFlushy || texture?.straightConnected);
        // Deep SPR + weak hand: keep pot small
        if (spr != null && spr > 8 && handStrength === 'pair') return ' Bet 25–33% pot to keep it small.';
        if (isWet) {
            if (handStrength === 'strong') return ' Bet 66–80% pot to charge draws.';
            if (handStrength === 'pair') return ' Bet 50–66% pot.';
            return ' Bet 50–66% pot.';
        }
        if (handStrength === 'strong') return ' Bet 50–66% pot.';
        if (handStrength === 'pair') return ' Bet 33–50% pot.';
        return ' Bet around half pot.';
    }

    // Rewrites "N–M% pot" / "N% pot" / "half pot" bet-sizing phrases into concrete
    // chip amounts from the live pot, e.g. "Bet $17K–$27K (25–40% pot)". No-op
    // preflop or when the pot is unknown/zero. Only annotates the DISPLAYED string;
    // the raw advice still feeds _emitBetHint (the bet-slider parser).
    function annotateBetSizing(text) {
        if (!text) return text;
        if (currentHand && currentHand.street === 'preflop') return text;
        const pot = (currentHand && currentHand.runningPot) || 0;
        if (pot <= 0) return text;
        const fmtAmt = (v) => {
            let r = Math.round(v / 1000) * 1000;
            if (r < 1000) r = 1000;
            if (r >= 1000000) {
                const mm = r / 1000000;
                return '$' + (mm % 1 === 0 ? mm.toFixed(0) : mm.toFixed(1)) + 'M';
            }
            return '$' + Math.round(r / 1000) + 'K';
        };
        return text.replace(
            /(\d+)\s*[-–]\s*(\d+)\s*%\s*pot|(\d+)\s*%\s*pot|half\s+pot/gi,
            (m, lo, hi, single) => {
                if (lo && hi) {
                    const a = fmtAmt(pot * (+lo) / 100), b = fmtAmt(pot * (+hi) / 100);
                    return (a === b ? a : a + '–' + b) + ' (' + m + ')';
                }
                if (single) return fmtAmt(pot * (+single) / 100) + ' (' + m + ')';
                return fmtAmt(pot * 0.5) + ' (' + m + ')';
            }
        ).replace(
            /(\d+)\s*[-–]\s*(\d+)\s*%(?=\s*—)/g,
            (m, lo, hi) => {
                const a = fmtAmt(pot * (+lo) / 100), b = fmtAmt(pot * (+hi) / 100);
                return a + '–' + b + ' (' + lo + '–' + hi + '% pot)';
            }
        );
    }

    function getOwnHandLean(facingAction, opponentCtx, potOdds = null, spr = null, isShove = false) {
        if (!currentHand?.selfHoleCards || currentHand.selfHoleCards.length < 2) return null;

        // Preflop: use hand chart
        if (!currentHand?.boardCards || currentHand.boardCards.length < 3) {
            const pos = getPlayerPosition(localPlayerName, currentHand);
            return getPreflopSelfAdvice(currentHand.selfHoleCards, pos);
        }

        const holeCards = currentHand.selfHoleCards;
        const board = currentHand.boardCards.slice(0, 5);
        // Stale state guard: if a hole card appears exactly in the board, data is corrupted (mid-game refresh artifact)
        if (holeCards.some(c => board.includes(c))) return null;
        const isRiver = board.length >= 5;
        const isTurn = board.length === 4;
        const pos = getPlayerPosition(localPlayerName, currentHand);
        const isIP = pos === 'LP';  // in position (BTN/CO)
        const posNote = isIP
            ? _voice(' You are in position - use it.', ' Yous got position. The Duke don\'t waste that.')
            : (pos ? _voice(' You are out of position - be careful bloating the pot.', ' Yous are out of position — don\'t go fattenin\' this pot, pal.') : '');

        // Position note for strong made hands — notes OOP without prescribing pot control (you want value with strong hands)
        const posNoteNeutral = isIP
            ? _voice(' You are in position - use it.', ' Yous got position. The Duke don\'t waste that.')
            : (pos ? _voice(' You are out of position — be mindful of your sizing.', ' Yous are out of position, pal. Pick your spots.') : '');

        // SPR context — tells hero how committed they are relative to the pot
        const sprNote = spr != null ? _voice(
            spr < 3 ? ` SPR ${spr} — stack is shallow, you're near pot-committed.`
                : spr < 8 ? ` SPR ${spr} — mid-depth. Don't build a massive pot without the goods.`
                    : ` SPR ${spr} — deep stack. Pot management matters here.`,
            spr < 3 ? ` SPR ${spr} — shallow stack, pal. You're damn near pot-committed.`
                : spr < 8 ? ` SPR ${spr} — mid-depth. Don't go fattenin' this pot without the goods, kid.`
                    : ` SPR ${spr} — deep stack, pal. Manage this pot carefully.`
        ) : '';

        const holeRanks = holeCards.map(rankOf);
        const boardRanks = board.map(rankOf);
        const holeVals = holeRanks.map(r => RANK_VALUES[r]).filter(Boolean);
        const boardVals = boardRanks.map(r => RANK_VALUES[r]).filter(Boolean);
        const boardMax = boardVals.length ? Math.max(...boardVals) : 0;

        const boardRankCounts = {};
        boardRanks.forEach(r => { boardRankCounts[r] = (boardRankCounts[r] || 0) + 1; });
        const boardHasPair = Object.values(boardRankCounts).some(c => c >= 2);
        // The rank that is paired on the board (e.g. '5' if board has 5,8,5)
        const boardPairedRank = Object.entries(boardRankCounts).find(([, c]) => c >= 2)?.[0] || null;

        const texture = analyzeBoardTexture(board) || {};

        // Bet sizing notes — only when hero is the bettor (not facing a bet/shove)
        const _betStreet = board.length >= 5 ? 'river' : board.length >= 4 ? 'turn' : 'flop';
        const sizingStrong = facingAction !== 'bet' ? getBetSizing('strong', texture, _betStreet, spr) : '';
        const sizingPair = facingAction !== 'bet' ? getBetSizing('pair', texture, _betStreet, spr) : '';
        const sizingThin = facingAction !== 'bet' ? getBetSizing('thin', texture, _betStreet, spr) : '';

        // Opponent range context — qualifies hand strength when facing a raise
        // Only fires when facingAction is 'bet' (we're being bet into) and we have data on the raiser
        const oppRangeNote = (() => {
            if (!opponentCtx || facingAction !== 'bet') return null;
            if (opponentCtx.handsObserved < 8) return null;
            const { typeKey: ot, name: on } = opponentCtx;
            if (ot === 'NIT' || ot === 'ROCK')
                return _voice(
                    `Heads up: ${on} is a NIT — their raising range is extremely narrow (top pairs, sets, two pair minimum). Even a decent hand can be crushed here.`,
                    `Heads up: ${on} is a NIT — razor-thin range, kid. Top pair, sets, two pair minimum. Even a decent hand gets eaten alive here.`
                );
            if (ot === 'MANIAC' || ot === 'LAG')
                return _voice(
                    `Heads up: ${on} is a maniac — they raise with a wide range. Don't over-respect this raise.`,
                    `Heads up: ${on} is a maniac — raises wide. Duke ain't givin' this raise respect it don't deserve, pal.`
                );
            if (ot === 'FISH' || ot === 'CALLING_STATION')
                return _voice(
                    `Heads up: ${on} raised — fish raise a wide, often weak range. Your made hands are likely ahead.`,
                    `Heads up: ${on} raised — fish raise wide and weak. You got a made hand, you're probably ahead, kid. Don't overthink it.`
                );
            if (ot === 'TAG')
                return _voice(
                    `Heads up: ${on} is a Sharp player — they pick spots, so this raise is real, but not necessarily a monster.`,
                    `Heads up: ${on} is Sharp — they pick their spots. This raise is real, but it ain't always the stone cold nuts.`
                );
            if (ot === 'TIGHT_PASSIVE')
                return _voice(
                    `Heads up: ${on} is a Cautious player who rarely bets — this raise from them is a very strong signal.`,
                    `Heads up: ${on} is Cautious — they don't fire without the goods. This raise is a loud signal, pal. Believe it.`
                );
            return null;
        })();
        const oppStr = oppRangeNote ? ` ${oppRangeNote}` : '';

        // Flush detection (made and draw). Draws must use at least one hole card.
        const suitCounts = {};
        const holeSuitCounts = {};
        [...holeCards, ...board].forEach(c => {
            const s = suitOf(c);
            suitCounts[s] = (suitCounts[s] || 0) + 1;
        });
        holeCards.forEach(c => {
            const s = suitOf(c);
            holeSuitCounts[s] = (holeSuitCounts[s] || 0) + 1;
        });

        const flushSuit = Object.keys(suitCounts).find(s => suitCounts[s] >= 5) || null;
        const hasMadeFlush = !!(flushSuit && (holeSuitCounts[flushSuit] || 0) >= 1);
        const boardHasFlush = !!(flushSuit && !hasMadeFlush);

        // Straight flush: hero has a made flush AND those flush-suit cards form a straight
        const hasStraightFlush = hasMadeFlush && (() => {
            const sfVals = new Set([...holeCards, ...board]
                .filter(c => suitOf(c) === flushSuit)
                .map(c => RANK_VALUES[rankOf(c)]).filter(Boolean));
            if (sfVals.has(14)) sfVals.add(1);
            const sfHoleVals = new Set(holeCards
                .filter(c => suitOf(c) === flushSuit)
                .map(c => RANK_VALUES[rankOf(c)]).filter(Boolean));
            if (sfHoleVals.has(14)) sfHoleVals.add(1);
            for (let s = 1; s <= 10; s++) {
                let ok = true, usesHole = false;
                for (let v = s; v <= s + 4; v++) {
                    if (!sfVals.has(v)) { ok = false; break; }
                    if (sfHoleVals.has(v)) usesHole = true;
                }
                if (ok && usesHole) return true;
            }
            return false;
        })();
        const isRoyalFlush = hasStraightFlush && (() => {
            const sfVals = new Set([...holeCards, ...board]
                .filter(c => suitOf(c) === flushSuit)
                .map(c => RANK_VALUES[rankOf(c)]).filter(Boolean));
            return [10, 11, 12, 13, 14].every(v => sfVals.has(v));
        })();

        const drawSuit = Object.keys(suitCounts).find(s => suitCounts[s] === 4 && (holeSuitCounts[s] || 0) >= 1) || null;
        const hasFlushDraw = !!drawSuit && !hasMadeFlush;
        // True nut flush draw = holding the ace of the draw suit
        const hasNutFlushDraw = hasFlushDraw && holeCards.some(c => suitOf(c) === drawSuit && rankOf(c) === 'A');
        // Highest draw-suit card in hand — determines draw quality
        const flushHoleCards = drawSuit ? holeCards.filter(c => suitOf(c) === drawSuit) : [];
        const flushHoleCard = flushHoleCards.reduce((best, c) => {
            const v = RANK_VALUES[rankOf(c)] || 0;
            return (!best || v > (RANK_VALUES[rankOf(best)] || 0)) ? c : best;
        }, null);
        const flushCardRank = flushHoleCard ? (RANK_VALUES[rankOf(flushHoleCard)] || 0) : 0;
        // Weak = best draw card is 8 or lower (higher cards beat the draw)
        const flushIsWeak = hasFlushDraw && !hasNutFlushDraw && flushCardRank <= 8;

        // Blocker: hero holds a card of the flush-threat suit but doesn't have the draw themselves
        // Reduces the probability opponent has a flush draw
        const flushThreatSuit = !hasMadeFlush && !hasFlushDraw
            ? Object.keys(suitCounts).find(s => suitCounts[s] === 3) || null
            : null;
        const heroBlocksFlush = !!(flushThreatSuit && (holeSuitCounts[flushThreatSuit] || 0) >= 1);
        const heroBlocksFlushStrongly = !!(flushThreatSuit && (holeSuitCounts[flushThreatSuit] || 0) >= 2);
        const blockerNote = heroBlocksFlush
            ? _voice(
                heroBlocksFlushStrongly
                    ? ` You hold two ${flushThreatSuit} cards — flush draw is heavily blocked.`
                    : ` You hold a ${flushThreatSuit} card — reduces flush draw risk.`,
                heroBlocksFlushStrongly
                    ? ` You're sittin' on two ${flushThreatSuit} cards, kid — flush draw is heavily blocked.`
                    : ` You're holdin' a ${flushThreatSuit} card — that cuts their flush draw odds, pal.`
            )
            : '';

        // Straight detection (made and draw). Must use at least one hole card.
        const rankSet = new Set([...holeVals, ...boardVals]);
        const rankSetNorm = new Set(rankSet);
        if (rankSet.has(14)) rankSetNorm.add(1);
        const holeSetNorm = new Set(holeVals);
        if (holeSetNorm.has(14)) holeSetNorm.add(1);

        function findStraight(rankSetIn, holeSetIn) {
            for (let start = 1; start <= 10; start++) {
                let ok = true;
                let usesHole = false;
                for (let v = start; v <= start + 4; v++) {
                    if (!rankSetIn.has(v)) { ok = false; break; }
                    if (holeSetIn.has(v)) usesHole = true;
                }
                if (ok) return { has: true, usesHole, start };
            }
            return { has: false, usesHole: false, start: -1 };
        }

        function findStraightDraw(rankSetIn, holeSetIn) {
            let oesd = false;
            let gutshot = false;
            const completingRanks = new Set();
            for (let start = 1; start <= 10; start++) {
                let hits = 0;
                let missing = null;
                let usesHole = false;
                for (let v = start; v <= start + 4; v++) {
                    if (rankSetIn.has(v)) hits++;
                    else missing = v;
                    if (holeSetIn.has(v)) usesHole = true;
                }
                if (hits === 4 && usesHole) {
                    const t = classifyStraightGap(start, missing, 14);
                    if (t === 'oesd') oesd = true; else gutshot = true;
                    completingRanks.add(missing);
                }
            }
            return { oesd, gutshot, completingRanks };
        }

        const straightInfo = findStraight(rankSetNorm, holeSetNorm);
        const hasStraight = straightInfo.has;
        const straightUsesHole = straightInfo.usesHole;
        const straightStart = straightInfo.start;

        // Vulnerable straight: board has 4 consecutive ranks allowing a higher straight with one hole card
        // e.g. hold 4, board 5-6-7-8 → your straight 4-8, anyone with 9 has 5-9 (higher)
        const straightIsVulnerable = (() => {
            if (!hasStraight || !straightUsesHole || straightStart < 0) return false;
            const boardSet = new Set(boardVals);
            if (boardSet.has(14)) boardSet.add(1);
            for (let s = straightStart + 1; s <= 10; s++) {
                let hits = 0;
                for (let v = s; v <= s + 4; v++) { if (boardSet.has(v)) hits++; }
                if (hits >= 4) return true;
            }
            return false;
        })();
        // The rank someone needs to hold to beat us — the card missing from the higher straight
        const straightDangerRank = (() => {
            if (!straightIsVulnerable) return null;
            const RANK_NAME = { 1: 'A', 2: '2', 3: '3', 4: '4', 5: '5', 6: '6', 7: '7', 8: '8', 9: '9', 10: 'T', 11: 'J', 12: 'Q', 13: 'K', 14: 'A' };
            const boardSet = new Set(boardVals);
            if (boardSet.has(14)) boardSet.add(1);
            let nutStart = straightStart;
            for (let s = straightStart + 1; s <= 10; s++) {
                let hits = 0;
                for (let v = s; v <= s + 4; v++) { if (boardSet.has(v)) hits++; }
                if (hits >= 4) nutStart = s;
            }
            for (let v = nutStart; v <= nutStart + 4; v++) {
                if (!boardSet.has(v) && !holeSetNorm.has(v)) return RANK_NAME[v] || String(v);
            }
            return null;
        })();

        const straightDraw = !hasStraight ? findStraightDraw(rankSetNorm, holeSetNorm) : { oesd: false, gutshot: false };
        const hasStraightDraw = straightDraw.oesd || straightDraw.gutshot;

        // Backdoor draws: two hole cards of same suit + only 1 on board (runner-runner flush)
        // or 3 consecutive ranks using at least one hole card (runner-runner straight)
        const hasBackdoorFlush = !hasFlushDraw && !hasMadeFlush && (() => {
            return Object.keys(holeSuitCounts).some(s => holeSuitCounts[s] === 2 && (suitCounts[s] || 0) === 3);
        })();
        const hasBackdoorStraight = !hasStraightDraw && !hasStraight && (() => {
            // 3 of the 5 consecutive needed are already present using at least one hole card
            for (let start = 1; start <= 10; start++) {
                let hits = 0; let usesHole = false;
                for (let v = start; v <= start + 4; v++) {
                    if (rankSetNorm.has(v)) hits++;
                    if (holeSetNorm.has(v)) usesHole = true;
                }
                if (hits === 3 && usesHole) return true;
            }
            return false;
        })();

        // Pair / made hand detection (must use hole cards)
        const hasPocket = holeRanks[0] === holeRanks[1];
        const holeHitRanks = holeRanks.filter(r => boardRankCounts[r]);
        const uniqueHoleHits = [...new Set(holeHitRanks)];
        const isTopPair = uniqueHoleHits.length >= 1 && holeVals.some(v => v === boardMax);
        const isSecondPair = uniqueHoleHits.length >= 1 && !isTopPair;
        const madeQuads = hasPocket && boardRankCounts[holeRanks[0]] >= 3;
        const madeSet = !madeQuads && hasPocket && boardRankCounts[holeRanks[0]] >= 1;
        const madeTrips = !hasPocket && uniqueHoleHits.length === 1 && boardRankCounts[uniqueHoleHits[0]] >= 2;
        const madeTwoPair = !hasPocket && uniqueHoleHits.length === 2;
        // Full house via two pair: one hole card pairs a board pair (gives trips) + second hole card pairs board (two pair) = boat
        // e.g. hold K,7 / board K,K,7 → K-K-K-7-7 = full house. uniqueHoleHits = ['K','7'], boardRankCounts['K'] = 2
        const madeTwoPairFullHouse = madeTwoPair && uniqueHoleHits.some(r => boardRankCounts[r] >= 2);
        // Full house via trips: hole card hits a board pair, AND board has a SECOND pair of a different rank
        // e.g. hold 8h / board 8s,8d,Kc,Kh → 8-8-8-K-K = full house
        const tripsRank = madeTrips ? uniqueHoleHits[0] : null;
        const madeTripsFullHouse = madeTrips && Object.entries(boardRankCounts).some(([r, c]) => r !== tripsRank && c >= 2);
        const overpair = hasPocket && boardMax > 0 && holeVals[0] > boardMax;
        // Board has 3 of a rank; hero pairs a DIFFERENT board card via one hole card → full house
        const boardTripsRank = Object.entries(boardRankCounts).find(([, c]) => c >= 3)?.[0] || null;
        const hasBoardTripsFullHouse = boardTripsRank !== null
            && uniqueHoleHits.length >= 1
            && !uniqueHoleHits.includes(boardTripsRank);
        // Pocket pair that missed the board entirely (not overpair, set, or quads)
        const pocketUnderpair = hasPocket && !overpair && !madeSet && !madeQuads;
        // Hero has one pair (not top pair) + board has a separate pair = two pair
        const madeSecondPairPlusBoardPair = isSecondPair && boardHasPair && boardPairedRank && !uniqueHoleHits.includes(boardPairedRank);

        // Made flush or straight
        if (hasStraightFlush) {
            if (isRoyalFlush) return _voice(
                `Royal flush. The best hand in poker — you cannot lose. Slow-play or lead, whatever extracts the most.${posNoteNeutral}`,
                `Royal flush, kid. The stone cold nuts — ain't a hand in existence that beats you. Slow-play it or go right at em. Every chip on this table is already yours.${posNoteNeutral}`
            );
            return isRiver
                ? _voice(
                    `Straight flush. Virtually unbeatable. Extract maximum value — slow-play or lead depending on what keeps them in.${posNoteNeutral}`,
                    `Straight flush, kid. Duke don't get hands like this and let em go for nothin'. Milk every last chip — slow-play or lead, whatever bleeds em driest.${posNoteNeutral}`
                )
                : _voice(
                    `Straight flush. Virtually unbeatable. Bet for value — get as much in the pot as possible.${posNoteNeutral}`,
                    `Straight flush. Get every chip you can into this pot, kid. You ain't losin' this one.${posNoteNeutral}`
                );
        }
        if (hasMadeFlush) {
            if (boardHasPair) return _voice(
                `You have a flush, but the board is paired. Full houses are possible - value bet, but be ready to slow down if raised.${posNoteNeutral}`,
                `You got the flush, kid, but that board's paired up. Full houses are lurkin' out there. Get value in but if they start re-raisin', pump the brakes.${posNoteNeutral}`
            );
            return isRiver
                ? _voice(
                    `Flush on the river. Bet for value and go for a call.${posNoteNeutral}`,
                    `Flush on the river. Beautiful. Get your money in and take what's yours, kid. Duke don't leave value on the table.${posNoteNeutral}`
                )
                : _voice(
                    `Flush made. Strong hand - bet for value and charge draws.${posNoteNeutral}`,
                    `Flush made. Extract every last chip before the board gets ugly — bet and make em pay, kid.${posNoteNeutral}`
                );
        }
        if (hasStraight && straightUsesHole) {
            // Monotone board check: if 4+ board cards share a suit, a flush beats the straight
            const boardSuitMax = Math.max(...Object.values(suitCounts).filter(v => typeof v === 'number'));
            const flushBeatsStraight = !hasMadeFlush && boardSuitMax >= 4;
            if (flushBeatsStraight) {
                return isRiver
                    ? _voice(
                        `Straight on the river, but the board is near-monotone — a flush beats you. Bet small or check down; fold to heavy aggression.${posNoteNeutral}`,
                        `Got a straight but the board's got four of a suit, kid — any flush beats you here. Small bet or check; get out if they come at you hard.${posNoteNeutral}`
                    )
                    : _voice(
                        `Straight made, but 4 board cards share a suit — flush draws are live and beat you. Bet to charge, but be ready to fold to a raise.${posNoteNeutral}`,
                        `Straight but the board's threatening a flush, pal — four of the same suit out there. Charge the draws but don't die on this hill.${posNoteNeutral}`
                    );
            }
            const vulnNote = straightIsVulnerable && straightDangerRank
                ? ` Anyone holding a ${straightDangerRank} makes a higher straight.`
                : '';
            const vulnNoteDuke = straightIsVulnerable && straightDangerRank
                ? ` Anyone sittin on a ${straightDangerRank} has got you beat with a higher straight.`
                : '';
            // Flush draw threat: 3 suited board cards means live flush draws that beat the straight
            const straightFlushDrawWarning = texture.isFlushy
                ? _voice(
                    ` Watch out: ${texture.flushCards} flush-suit cards on board — anyone on a flush draw beats your straight if it completes.`,
                    ` Watch out: ${texture.flushCards} flush-suit cards on that board — any flush draw out there beats your straight if it gets there.`
                ) : '';
            if (boardHasPair) {
                return _voice(
                    `Straight on a paired board.${vulnNote}${straightFlushDrawWarning} Be cautious — full houses beat you, and${straightIsVulnerable ? ' higher straights are possible too.' : ' there may be a better straight out there.'}${posNoteNeutral}`,
                    `You got a straight but that board's got a pair on it.${vulnNoteDuke}${straightFlushDrawWarning} Full houses eat straights for breakfast, pal. Don't go building a monument to it.${posNoteNeutral}`
                );
            }
            if (vulnNote) {
                return isRiver
                    ? _voice(
                        `Straight on the river, but you're on the low end.${vulnNote}${straightFlushDrawWarning} Bet small for value — fold if they raise hard.${posNoteNeutral}`,
                        `Straight on the river but you're on the cheap end, kid.${vulnNoteDuke}${straightFlushDrawWarning} Sneak a small bet in — the second they raise hard, you get out.${posNoteNeutral}`
                    )
                    : _voice(
                        `Straight made, but you're on the low end.${vulnNote}${straightFlushDrawWarning} Bet to charge draws, but fold to heavy resistance.${posNoteNeutral}`,
                        `You got a straight but it ain't the top of the ladder.${vulnNoteDuke}${straightFlushDrawWarning} Charge the draws, but if someone starts pushing back hard, Duke folds here.${posNoteNeutral}`
                    );
            }
            return isRiver
                ? _voice(
                    `Straight on the river. Bet for value unless you face heavy aggression.${straightFlushDrawWarning}${posNoteNeutral}`,
                    `Straight on the river. Get your value in - only back off if they come at you like they mean it, kid.${straightFlushDrawWarning}${posNoteNeutral}`
                )
                : _voice(
                    `Straight made. Bet for value and protect against draws.${straightFlushDrawWarning}${posNoteNeutral}`,
                    `You got a straight. Beautiful. Bet it and protect that pot — don't let some punk draw out on you for free.${straightFlushDrawWarning}${posNoteNeutral}`
                );
        }

        // Quads
        if (madeQuads) {
            return isRiver
                ? _voice(
                    `Quads — four of a kind. Basically unbeatable. Extract maximum value; slow-play or lead depending on their tendencies.${posNoteNeutral}`,
                    `Quads. Four of a kind, kid. Duke don't get hands like this and let em go cheap. Milk every last chip — slow-play or lead, whatever bleeds them driest.${posNoteNeutral}`
                )
                : _voice(
                    `Quads — four of a kind. Slow-play or bet small to keep them in. You cannot lose this hand.${posNoteNeutral}`,
                    `Four of a kind. You cannot lose this hand, pal. Keep em in — bet small, slow-play, whatever it takes to keep the fish on the line.${posNoteNeutral}`
                );
        }

        // Strong made hand: set, trips, or two pair
        if (madeSet || madeTrips || madeTwoPair || madeSecondPairPlusBoardPair || hasBoardTripsFullHouse) {
            // Board has trips + hero pairs a different rank via a hole card = full house
            if (hasBoardTripsFullHouse) {
                return isRiver
                    ? _voice(
                        `Full house — the board has trips and your pair fills the boat. Extremely strong. Bet for value.${posNoteNeutral}`,
                        `Full house — board's got trips and your pair makes a boat. Extremely strong. Bet for value and collect, kid.${posNoteNeutral}`
                    )
                    : _voice(
                        `Full house — board trips plus your pair. Extremely strong. Bet for value.${posNoteNeutral}`,
                        `Full house — board trips and your pair, that's a boat. Extremely strong. Bet it, kid.${posNoteNeutral}`
                    );
            }
            // Set on a paired board = full house
            if (madeSet && boardHasPair) {
                return isRiver
                    ? _voice(
                        `Full house — the board pair gives you the boat. Extremely strong. Bet for value.${posNoteNeutral}`,
                        `Full house — your set filled up on that paired board. The boat, kid. Bet for value and collect.${posNoteNeutral}`
                    )
                    : _voice(
                        `Full house — set plus a paired board. Extremely strong. Bet for value; the board is already doing the heavy lifting.${posNoteNeutral}`,
                        `Full house - set plus a paired board, that's a boat. Extremely strong. Bet it, the board's doing half the work for you, kid.${posNoteNeutral}`
                    );
            }
            // Two pair + board pair = full house
            if (madeTwoPairFullHouse) {
                return isRiver
                    ? _voice(
                        `Full house — your two pair fills up with the board pair. Very strong. Bet for value.${posNoteNeutral}`,
                        `Full house — your two pair caught a ride on that board pair. Very strong, pal. Bet it and take the chips.${posNoteNeutral}`
                    )
                    : _voice(
                        `Full house — two pair plus the board pair gives you a boat. Extremely strong. Bet for value.${posNoteNeutral}`,
                        `Full house - two pair and that board pair hand you a boat. Extremely strong. Bet and make em regret sitting down, kid.${posNoteNeutral}`
                    );
            }
            // Trips + second board pair = full house (e.g. hold 8, board 8-8-K-K)
            if (madeTripsFullHouse) {
                return isRiver
                    ? _voice(
                        `Full house — your trips fill up on the paired board. Extremely strong. Bet for value.${posNoteNeutral}`,
                        `Full house - your trips caught the paired board and made a boat. Extremely strong. Bet for value and clean em out, pal.${posNoteNeutral}`
                    )
                    : _voice(
                        `Full house — trips plus the board pair gives you a boat. Extremely strong. Bet for value.${posNoteNeutral}`,
                        `Full house — trips plus that board pair, you're sitting on a boat. Extremely strong. Get that value in, kid.${posNoteNeutral}`
                    );
            }
            const handName = madeSet ? 'Set' : madeTrips ? 'Trips' : 'Two pair';
            // Pair of 8s + board's KK: the board pair is entirely shared — hero's real advantage is just one pair
            if (madeSecondPairPlusBoardPair && boardPairedRank) {
                const heroPairRank = uniqueHoleHits[0];
                const boardPairIsHigher = (RANK_VALUES[boardPairedRank] || 0) > (RANK_VALUES[heroPairRank] || 0);
                const tripsNote = boardPairIsHigher
                    ? `Anyone with a ${boardPairedRank} has trips — they beat your two pair. `
                    : `Anyone with a ${heroPairRank} has trips — they beat your two pair. `;
                const tripsNoteDuke = boardPairIsHigher
                    ? `Anyone holding a ${boardPairedRank} has trips on you — they got you beat. `
                    : `Anyone holding a ${heroPairRank} has trips on you — they got you beat. `;
                const sizing = facingAction !== 'bet' ? ' Bet small (25–33% pot) or check.' : '';
                const sizingDuke = facingAction !== 'bet' ? ' Small bet or check.' : '';
                return _voice(
                    `Two pair — but the ${boardPairedRank}s are on the board, shared with everyone. Your real hand is just a pair of ${heroPairRank}s. ${tripsNote}Keep the pot small — do not overcommit.${sizing}${posNoteNeutral}`,
                    `Two pair on paper, but them ${boardPairedRank}s belong to the whole table, kid. Your actual hand is a pair of ${heroPairRank}s. ${tripsNoteDuke}Don't go buildin' a big pot with this.${sizingDuke}${posNoteNeutral}`
                );
            }
            // Two pair with a higher board pair = anyone with that board card has a better two pair
            const twoPairCounterfeited = madeTwoPair && boardHasPair && boardPairedRank
                && (RANK_VALUES[boardPairedRank] || 0) > Math.max(...uniqueHoleHits.map(r => RANK_VALUES[r] || 0));
            if (isRiver) {
                if (twoPairCounterfeited) {
                    return _voice(
                        `Two pair on the river, but the board has a pair of ${boardPairedRank}s that outranks your pairs. Anyone holding a ${boardPairedRank} has a better two pair than you. Be cautious.${posNoteNeutral}`,
                        `Two pair on the river, but that board's got a pair of ${boardPairedRank}s sitting higher than yours. Anybody holding a ${boardPairedRank} has you beat on two pair, kid. Tread careful.${posNoteNeutral}`
                    );
                }
                // Two pair facing a bet on a dangerous river board — strength depends on board type, who is betting, and hand strength
                if (madeTwoPair && facingAction === 'bet' && (texture.straightConnected || (texture.isFlushy && !heroBlocksFlushStrongly))) {
                    const isTopTwoPair = isTopPair;
                    const noRead = !opponentCtx || opponentCtx.typeKey === 'UNKNOWN' || opponentCtx.handsObserved < hudSettings.coachMinHands;
                    const isAggro = opponentCtx && (opponentCtx.typeKey === 'MANIAC' || opponentCtx.typeKey === 'LAG');
                    const isFish = opponentCtx && (opponentCtx.typeKey === 'FISH' || opponentCtx.typeKey === 'CALLING_STATION');
                    const isNit = opponentCtx && (opponentCtx.typeKey === 'NIT' || opponentCtx.typeKey === 'ROCK' || opponentCtx.typeKey === 'TIGHT_PASSIVE');
                    const oppName = opponentCtx?.name || 'Opponent';
                    const straightDanger = texture.straightConnected;
                    const flushDanger = texture.isFlushy && !heroBlocksFlushStrongly;
                    const boardLabel = straightDanger && flushDanger ? 'straight and flush-completing board'
                        : straightDanger ? 'straight-completing board' : 'flush-completing board';
                    // NIT/ROCK/TIGHT_PASSIVE: almost never bluffing here — fold regardless of two pair strength
                    if (isNit) {
                        return _voice(
                            `Two pair facing a bet from ${oppName} on a ${boardLabel}. Tight players almost never bluff here — their range is sets, straights${flushDanger ? ', flushes' : ''}, or better. Fold.${posNoteNeutral}`,
                            `Two pair and ${oppName} is betting on a ${boardLabel}. Tight players don't fire air here, kid — sets, straights${flushDanger ? ', flushes' : ''}, the real stuff. Fold.${posNoteNeutral}`
                        );
                    }
                    // FISH/CALLING_STATION: value-bet thin, so two pair is more defensible
                    if (isFish) {
                        if (isTopTwoPair) {
                            return _voice(
                                `Top two pair facing a fish bet on a ${boardLabel}. Fish value-bet thin — you may still be ahead. Calling is reasonable.${posNoteNeutral}`,
                                `Top two pair and a fish is betting into you on a ${boardLabel}. Fish love to value-bet thin — you might still be ahead, kid. Call is reasonable.${posNoteNeutral}`
                            );
                        }
                        return _voice(
                            `Two pair facing a fish bet on a ${boardLabel}. Fish bet thin but can still have straights${flushDanger ? ' or flushes' : ''}. Marginal call — don't overcommit.${posNoteNeutral}`,
                            `Two pair and a fish is betting on a ${boardLabel}. Fish bet thin but they can still have the real stuff. Marginal call — don't go deep, kid.${posNoteNeutral}`
                        );
                    }
                    // MANIAC/LAG: wide range, bluffs and thin value are real
                    if (isAggro) {
                        if (isTopTwoPair) {
                            return _voice(
                                `Top two pair facing a bet from ${oppName} on a ${boardLabel}. They run wide — bluffs and thin value are in their range. Call is fine.${posNoteNeutral}`,
                                `Top two pair and ${oppName} is firing on a ${boardLabel}. They fire wide, kid — bluffs are real. Call is fine.${posNoteNeutral}`
                            );
                        }
                        return _voice(
                            `Two pair facing a bet from ${oppName} on a ${boardLabel}. Known aggressor — bluffs and thin value are in their range. Calling is defensible, but be ready to be wrong.${posNoteNeutral}`,
                            `Two pair and ${oppName} is firing on a ${boardLabel}. They fire wide though — bluffs happen. Call ain't crazy, kid. Just know you might be behind.${posNoteNeutral}`
                        );
                    }
                    // No read yet
                    if (noRead) {
                        if (isTopTwoPair) {
                            return _voice(
                                `Top two pair facing a bet on a ${boardLabel}. No read yet — marginal spot. Straights${flushDanger ? ' and flushes' : ''} completed; only call if the price is good.${posNoteNeutral}`,
                                `Top two pair and they're betting on a ${boardLabel} — no read on this player yet. Marginal spot, kid. Straights${flushDanger ? ' and flushes' : ''} are live; only call if the price makes sense.${posNoteNeutral}`
                            );
                        }
                        return _voice(
                            `Two pair facing a bet on a ${boardLabel}. No read on this player — default fold. Weak two pair is a poor bluff-catcher here and you have no data to justify the call.${posNoteNeutral}`,
                            `Two pair and they're betting on a ${boardLabel} — no read on this player. Default fold, kid. Weak two pair don't catch enough bluffs to justify this without a read.${posNoteNeutral}`
                        );
                    }
                    // Has a read, not a known aggressor or fish (TAG, MIXED, etc.)
                    if (isTopTwoPair) {
                        return _voice(
                            `Top two pair facing a bet on a ${boardLabel}. ${oppName} is not a known bluffer — proceed carefully. Call with a specific reason, not just hand strength.${posNoteNeutral}`,
                            `Top two pair facing a bet on a ${boardLabel}. ${oppName} ain't known to fire air — don't just call because you got two pair, kid. Have a reason.${posNoteNeutral}`
                        );
                    }
                    return _voice(
                        `Two pair facing a bet on a ${boardLabel}. ${oppName} is not a known bluffer — straights${flushDanger ? '/flushes' : ''} completed. Lean fold unless you have a specific reason they are bluffing.${posNoteNeutral}`,
                        `Two pair facing a bet on a ${boardLabel}. ${oppName} ain't known to fire air — lean fold, kid. Don't talk yourself into a call without a real read.${posNoteNeutral}`
                    );
                }
                return _voice(
                    `${handName} - strong made hand. Bet for value.${sizingStrong}${posNoteNeutral}`,
                    `${handName}. You got a strong made hand. Now extract every last chip before the board gets ugly - bet for value, kid.${sizingStrong}${posNoteNeutral}`
                );
            }
            const wetWarnings = [];
            if (twoPairCounterfeited) wetWarnings.push(`board has a pair of ${boardPairedRank}s that outranks your pairs — opponents with a ${boardPairedRank} have you beaten on two pair`);
            if (texture.isFlushy) wetWarnings.push(heroBlocksFlush
                ? `${texture.flushCards} cards of the same suit on board${heroBlocksFlushStrongly ? ' — heavily blocked, you hold two' : ' — partially blocked, you hold one'}`
                : `${texture.flushCards} cards of the same suit on board — flush draws are live`);
            if (texture.straightConnected) wetWarnings.push(`${texture.maxConnected} connected cards — straight draws possible`);
            if (wetWarnings.length) {
                const prefix = twoPairCounterfeited ? `${handName} — watch out` : `${handName} - strong hand but the board is wet`;
                const prefixDuke = twoPairCounterfeited ? `${handName} — hold on` : `${handName} - strong hand but this board's got teeth`;
                return _voice(
                    `${prefix} (${wetWarnings.join('; ')}). ${twoPairCounterfeited ? 'Keep the pot small.' : 'Bet to charge those draws — do not slow down.'}${posNoteNeutral}`,
                    `${prefixDuke} (${wetWarnings.join('; ')}). ${twoPairCounterfeited ? 'Keep the pot small or you\'re writing a check you can\'t cash.' : 'Bet and make them draws pay a toll — Duke don\'t slow down on a strong hand.'}${posNoteNeutral}`
                );
            }
            return _voice(
                `${handName} - strong made hand. Bet for value and protect against draws.${sizingStrong}${posNoteNeutral}`,
                `${handName}. You got a set. Beautiful. Now extract every last chip before the board gets ugly, kid.${sizingStrong}${posNoteNeutral}`
            );
        }

        // Overpair
        if (overpair) {
            // Equity floor: if we know equity is very low, the overpair is likely crushed — switch to caution
            const _overpairEquity = parseFloat(_oddsCache?.win);
            const _overpairCrushed = !isNaN(_overpairEquity) && _overpairEquity < 28;
            if (_overpairCrushed) {
                if (facingAction === 'bet') return _voice(
                    `Overpair but equity is very low — this board has likely overtaken you. Fold to serious pressure.${sprNote}${posNote}${oppStr}`,
                    `Overpair but the board's got you beat, kid. Equity says fold to any real pressure.${sprNote}${posNote}${oppStr}`
                );
                return _voice(
                    `Overpair but equity is very low — the board is dangerous. Check and reassess before committing.${sprNote}${posNote}${oppStr}`,
                    `Overpair but the board's running over you, pal. Check it and think twice before putting chips in.${sprNote}${posNote}${oppStr}`
                );
            }
            if (isRiver) {
                const tripsNote = boardHasPair && boardPairedRank ? ` Board has a pair of ${boardPairedRank}s — anyone with a ${boardPairedRank} in hand has trips, which beats you.` : '';
                const tripsNoteDuke = boardHasPair && boardPairedRank ? ` Board's got a pair of ${boardPairedRank}s — anybody with a ${boardPairedRank} in hand just made trips and beat you.` : '';
                return _voice(
                    `Overpair on the river. Bet for value but do not overcommit if raised.${tripsNote}${posNote}${oppStr}`,
                    `Overpair on the river. Get value in but don't go handing your whole stack over if they push back, kid.${tripsNoteDuke}${posNote}${oppStr}`
                );
            }
            const wetWarnings = [];
            if (texture.isFlushy) wetWarnings.push(heroBlocksFlush
                ? `${texture.flushCards} flush-suit cards on board${heroBlocksFlushStrongly ? ' — heavily blocked, you hold two' : ' — partially blocked, you hold one'}`
                : `${texture.flushCards} flush-suit cards on board`);
            if (texture.straightConnected) wetWarnings.push(`${texture.maxConnected} connected cards`);
            if (boardHasPair && boardPairedRank) wetWarnings.push(`board has a pair of ${boardPairedRank}s — anyone holding a ${boardPairedRank} has trips on you`);
            if (wetWarnings.length) {
                // Shove on a paired board = strong fold signal even with AA/KK — one pair loses to trips/boats
                if (isShove && boardHasPair && boardPairedRank) return _voice(
                    `Overpair facing a shove on a paired board (${boardPairedRank}s on board). Anyone with a ${boardPairedRank} just made trips — they're beating you. Fold. One pair does not win big pots like this.${sprNote}${posNote}${oppStr}`,
                    `Overpair and they shoved on a board with ${boardPairedRank}s on it. Anyone holding a ${boardPairedRank} has trips and beats you, kid. Fold. One pair ain't worth your stack here — not even aces.${sprNote}${posNote}${oppStr}`
                );
                if (facingAction !== 'bet' && boardHasPair && boardPairedRank) {
                    // Hero is the aggressor on a paired board — warn against overbetting or shoving with just one pair
                    const deepSprWarning = (spr != null && spr > 4)
                        ? _voice(
                            ` Do NOT shove or overbet — probe with 25–40% pot to gauge their hand. If they call or raise, respect it and fold.`,
                            ` Don't go shoveling your whole stack in here, kid. Probe 25–40% pot and see what they do. They raise? You fold.`
                        )
                        : _voice(
                            ` Bet small to gauge — be ready to fold if they fight back.`,
                            ` Small bet to feel em out — walk away if they push back, pal.`
                        );
                    return _voice(
                        `Overpair, but dangerous board (${wetWarnings.join('; ')}).${deepSprWarning}${sprNote}${posNote}${oppStr}`,
                        `Overpair, but this board got teeth (${wetWarnings.join('; ')}).${deepSprWarning}${sprNote}${posNote}${oppStr}`
                    );
                }
                const raiseNote = facingAction === 'bet' ? ' Facing a bet here, re-evaluate — they may already have you beaten.' : ' Bet, but be ready to fold to heavy resistance.';
                const raiseNoteDuke = facingAction === 'bet' ? ' Facing a bet here, pal — re-think it, they might already have you beat.' : ' Bet it but be ready to walk away when the heat comes.';
                return _voice(
                    `Overpair, but watch out (${wetWarnings.join('; ')}).${raiseNote}${sprNote}${posNote}${oppStr}`,
                    `Overpair, but this board got teeth (${wetWarnings.join('; ')}).${raiseNoteDuke}${sprNote}${posNote}${oppStr}`
                );
            }
            if (facingAction === 'bet') return _voice(
                `Overpair facing a bet. Strong hand — calling or re-raising are both reasonable.${sprNote}${posNote}${oppStr}`,
                `Overpair and they're betting into you. Strong hand, kid — call or raise back, both plays work here.${sprNote}${posNote}${oppStr}`
            );
            return _voice(
                `Overpair. Strong one-pair - bet for value and protection.${sizingStrong}${sprNote}${posNote}${oppStr}`,
                `Overpair. Strong one-pair hand - bet it for value and run off the draws, kid.${sizingStrong}${sprNote}${posNote}${oppStr}`
            );
        }

        // River: draws are dead
        if (isRiver) {
            if (hasFlushDraw && !uniqueHoleHits.length) return _voice(
                `Your flush draw missed. You have a bluff-catcher at best - fold to significant pressure unless you have showdown value.`,
                `Your flush draw bricked. You got nothing but a prayer and a busted draw. Fold to any real pressure unless you got showdown value — bluff-catchers don't pay rent.`
            );
            if (hasStraightDraw && !uniqueHoleHits.length) return _voice(
                `Your straight draw missed. Do not call big bets without another reason to be in this hand.`,
                `Straight draw went nowhere, kid. Don't throw good chips after bad — you need another reason to be in this pot or you fold.`
            );
            if (isTopPair) {
                const _tpRiverEquity = parseFloat(_oddsCache?.win);
                const _tpCrushed = !isNaN(_tpRiverEquity) && _tpRiverEquity < 28;
                if (_tpCrushed) return _voice(
                    `Top pair on the river but equity is very low — the board has likely overtaken you. Fold to pressure.${posNote}`,
                    `Top pair on the river but the board's run you over, kid. Equity says fold to any real pressure.${posNote}`
                );
                return _voice(
                    `Top pair on the river. Bet for thin value or call a reasonable bet.${sizingThin}${posNote}`,
                    `Top pair on the river. That's your bread right there - bet for thin value or call a reasonable number, kid.${sizingThin}${posNote}`
                );
            }
            if (isSecondPair) return _voice(
                `Low pair on the river. Marginal hand - do not call big bets, but can call a small one.${posNote}`,
                `Low pair on the river. Low pair ain't gonna win you wars, kid. Don't call anything big — small bet maybe, but that's all.${posNote}`
            );
            if (boardHasFlush) return _voice(
                `Board has a flush. If you do not have it, treat this as a weak hand and avoid big calls.${posNote}`,
                `Board's got a flush sitting out there. You ain't holding it, you got a weak hand. Don't go calling big money into that.${posNote}`
            );
            return _voice(
                `You have not connected with the board. Fold to pressure - you have nothing to call with.`,
                `You connected with nothing on this board. Get outta there. Duke don't throw good chips after bad.`
            );
        }

        // Flush draw + straight draw combo (not river): big draw, 12 outs (flush + gutshot) or 15 outs (flush + OESD)
        if (hasFlushDraw && hasStraightDraw) {
            const flushLabel = hasNutFlushDraw ? 'nut flush draw' : flushIsWeak ? 'weak flush draw' : 'flush draw';
            const straightLabel = straightDraw.oesd ? 'open-ender' : 'gutshot';
            const eq = calcExactDrawEquity(holeCards, board, true, drawSuit, straightDraw);
            const rawEq = eq ? (isTurn ? eq.equityTurn : eq.equityFlop) : null;
            const eqNote = rawEq != null
                ? (potOdds != null
                    ? ` ~${rawEq}% equity, need ${potOdds}% to call${rawEq > potOdds ? ' — odds are there' : ' — close, but combo draws play strong as semi-bluffs'}.`
                    : ` ~${rawEq}% equity to river.`)
                : '';
            if (facingAction === 'bet') return _voice(
                `${flushLabel} + ${straightLabel}.${eqNote} Big combo draw — strong semi-bluff candidate. Raise for fold equity or call if the price is right.${sprNote}${posNote}${oppStr}`,
                `${flushLabel} and a ${straightLabel}, kid.${eqNote} You got a monster draw — raise and put the squeeze on, or call cheap if it's there.${sprNote}${posNote}${oppStr}`
            );
            return _voice(
                `${flushLabel} + ${straightLabel}.${eqNote} Combo draw with multiple ways to win. Bet for value and fold equity, or check-raise if checked to.${sprNote}${posNote}${oppStr}`,
                `${flushLabel} and a ${straightLabel}, pal.${eqNote} You got a monster draw — bet it strong or check-raise if they bet into you.${sprNote}${posNote}${oppStr}`
            );
        }

        // Pair + flush draw (not river): flush draw block has no pair guard, so intercept here
        if (hasFlushDraw && (uniqueHoleHits.length > 0 || pocketUnderpair)) {
            const drawType = hasNutFlushDraw ? 'nut flush draw' : flushIsWeak ? 'weak flush draw' : 'flush draw';
            const pairDesc = pocketUnderpair ? 'Pocket pair' : 'Pair';
            const eq = calcExactDrawEquity(holeCards, board, true, drawSuit, null);
            const rawEq = eq ? (isTurn ? eq.equityTurn : eq.equityFlop) : null;
            // Draw equity only — pair adds additional equity on top
            const eqNote = rawEq != null
                ? (potOdds != null
                    ? ` Draw equity: ~${rawEq}% (pair adds more on top), need ${potOdds}% to call${rawEq > potOdds ? ' — odds are there' : ' — odds against, pair equity may bridge the gap'}.`
                    : ` Draw equity: ~${rawEq}% (plus pair equity on top).`)
                : '';
            if (facingAction === 'bet') return _voice(
                `${pairDesc} + ${drawType} facing a bet.${eqNote} Two ways to win. Call if the price is right; don't stack off on the draw alone.${sprNote}${posNote}${oppStr}`,
                `${pairDesc} and a ${drawType} — they're betting, kid.${eqNote} Two ways to win. Call if the math's there, but don't go building monuments on a draw alone.${sprNote}${posNote}${oppStr}`
            );
            return _voice(
                `${pairDesc} + ${drawType}. Two ways to win — the pair holds or the flush gets there.${eqNote} Semi-playable; don't over-invest.${sprNote}${posNote}${oppStr}`,
                `${pairDesc} and a ${drawType}, kid. Two ways to win — pair holds or the flush comes.${eqNote} Keep it reasonable, don't go crazy with it.${sprNote}${posNote}${oppStr}`
            );
        }

        // Flush draw (not river)
        if (hasFlushDraw) {
            const eq = calcExactDrawEquity(holeCards, board, true, drawSuit, null);
            const rawEq = eq ? (isTurn ? eq.equityTurn : eq.equityFlop) : null;
            // eqStr: plain equity % — used in weak-draw warning (parenthetical footnote)
            const eqStr = rawEq != null ? (isTurn ? `~${rawEq}% to hit` : `~${rawEq}% equity to river`) : '';
            // eqNote: equity + pot odds verdict — used in main advice sentences
            const eqNote = rawEq != null
                ? (potOdds != null
                    ? ` ~${rawEq}% equity, need ${potOdds}% to call${rawEq > potOdds ? ' — odds are there' : ' — odds against you'} — `
                    : ` ${eqStr} — `)
                : ' ';
            if (flushIsWeak) {
                const cardName = flushHoleCard ? rankOf(flushHoleCard) : 'low';
                const warning = `Your flush card is a ${cardName} — anyone holding a higher ${drawSuit} card makes a better flush than you. Low implied odds.${eqStr ? ` (${eqStr})` : ''}`;
                const warningDuke = `Your flush card is a ${cardName} — anybody with a higher ${drawSuit} card makes a better flush than you. Low implied odds, kid.${eqStr ? ` (${eqStr})` : ''}`;
                if (facingAction === 'bet') {
                    if (isTurn) return _voice(
                        `Flush draw on the turn facing a bet, but ${warning} The price matters — if it's a big bet, fold this.${posNote}`,
                        `Flush draw on the turn and they're betting into you, but ${warningDuke} Price matters here - big bet? You fold this junk, kid.${posNote}`
                    );
                    return _voice(
                        `Flush draw on the flop facing a bet, but ${warning} Do not call a big bet to chase a weak flush draw.${posNote}`,
                        `Flush draw on the flop and they're putting in a bet, but ${warningDuke} Don't go calling big money chasing a weak flush draw, kid.${posNote}`
                    );
                }
                if (isTurn) return _voice(
                    `Flush draw on the turn, but ${warning} Don't over-invest chasing this.${posNote}`,
                    `Flush draw on the turn, but ${warningDuke} You ain't hit nothing yet but those high cards are live. Don't go blowing your stack on a prayer.${posNote}`
                );
                return _voice(
                    `Flush draw on the flop, but ${warning} Call small bets if the price is right, but don't build a big pot around this draw.${posNote}`,
                    `Flush draw on the flop, but ${warningDuke} Take the cheap street if the price is right, but don't build a monument around this weak draw, kid.${posNote}`
                );
            }
            const drawType = hasNutFlushDraw ? 'Nut flush draw' : 'Flush draw';
            if (facingAction === 'bet') {
                if (hasNutFlushDraw) {
                    if (isTurn) return _voice(
                        `${drawType} on the turn facing a bet.${eqNote}Strong semi-bluff candidate — raise to deny equity or call if the price is good.${posNote}`,
                        `${drawType} on the turn and they're betting into you.${eqNote}You're holding the nuts draw, pal — raise and make em sweat, or call if the price makes sense.${posNote}`
                    );
                    return _voice(
                        `${drawType} on the flop facing a bet.${eqNote}You can call or raise — nut draw gives you fold equity when you raise.${posNote}`,
                        `${drawType} on the flop facing a bet.${eqNote}You got the nut draw, kid — call or raise, either way you got leverage. Make em fold or make em pay.${posNote}`
                    );
                }
                if (isTurn) return _voice(
                    `${drawType} on the turn facing a bet.${eqNote}One card left — don't call a big bet chasing.${posNote}`,
                    `${drawType} on the turn and they're betting.${eqNote}One card left to save you, pal — don't throw chips at a long shot.${posNote}`
                );
                return _voice(
                    `${drawType} on the flop facing a bet.${eqNote}Calling is reasonable with two cards to come; raising is also valid for fold equity.${posNote}`,
                    `${drawType} on the flop and they're betting.${eqNote}Two cards to come — call or raise to take it down, kid.${posNote}`
                );
            }
            if (isTurn) return _voice(
                `${drawType} on the turn — one card left.${eqNote}Raising is an option with the nut draw.${posNote}`,
                `${drawType} on the turn - one card left.${eqNote}With the nut draw you can raise and make em think twice.${posNote}`
            );
            return _voice(
                `${drawType} on the flop — two cards to come.${eqNote}Calling is fine; raising is valid with the nut draw for fold equity.${posNote}`,
                `${drawType} on the flop - two cards to come.${eqNote}Call if it's cheap, kid. With the nut draw you raise and put the squeeze on.${posNote}`
            );
        }

        // Pocket pair + straight draw (not river): uniqueHoleHits is 0 for pocket pairs, so intercept before straight draw block
        if (hasStraightDraw && pocketUnderpair) {
            const drawLabel = straightDraw.oesd ? 'open-ended straight draw' : 'gutshot straight draw';
            const eq = calcExactDrawEquity(holeCards, board, false, null, straightDraw);
            const rawEq = eq ? (isTurn ? eq.equityTurn : eq.equityFlop) : null;
            // Draw equity only — pair adds additional equity on top of this
            const eqNote = rawEq != null
                ? (potOdds != null
                    ? ` Draw equity: ~${rawEq}% (pair adds more on top), need ${potOdds}% to call${rawEq > potOdds ? ' — odds are there' : ' — odds against, pair equity may bridge the gap'}.`
                    : ` Draw equity: ~${rawEq}% (plus pair equity on top).`)
                : '';
            if (facingAction === 'bet') return _voice(
                `Pocket pair + ${drawLabel} facing a bet.${eqNote} Two ways to win. Call if the price is right; fold to big bets on a gutshot.${sprNote}${posNote}${oppStr}`,
                `Pocket pair with a ${drawLabel} and they're betting, kid.${eqNote} Two ways to win. Call if the math's there, but gutshot folds to big money.${sprNote}${posNote}${oppStr}`
            );
            return _voice(
                `Pocket pair + ${drawLabel}. Two ways to win — pocket holds or the straight gets there.${eqNote} Don't over-invest, but the draw makes this more playable.${sprNote}${posNote}${oppStr}`,
                `Pocket pair and a ${drawLabel}, kid. Two ways to win here.${eqNote} Don't go nuts, but you got more than one out.${sprNote}${posNote}${oppStr}`
            );
        }

        // Straight draw (not river)
        if (hasStraightDraw && !uniqueHoleHits.length) {
            const eq = calcExactDrawEquity(holeCards, board, false, null, straightDraw);
            const rawEqSD = eq ? (isTurn ? eq.equityTurn : eq.equityFlop) : null;
            const drawLabel = straightDraw.oesd ? 'Open-ended straight draw' : 'Gutshot straight draw';
            // eqNote: equity + pot odds verdict inserted before the action advice
            const eqNote = rawEqSD != null
                ? (potOdds != null
                    ? ` ~${rawEqSD}% equity, need ${potOdds}% to call${rawEqSD > potOdds ? ' — odds are there' : ' — odds against you'}.`
                    : ` ~${rawEqSD}% equity.`)
                : '';
            if (facingAction === 'bet') {
                if (isTurn) return _voice(
                    `${drawLabel} on the turn facing a bet.${eqNote} One card left — gutshot folds to any real bet.${posNote}`,
                    `${drawLabel} on the turn and they're betting.${eqNote} One card left to save you — gutshot? Get outta there when they bet real money, kid.${posNote}`
                );
                return _voice(
                    `${drawLabel} on the flop facing a bet.${eqNote} Two cards to come is fine for an OESD; gutshot needs the odds to justify it.${posNote}`,
                    `${drawLabel} on the flop and they're betting.${eqNote} Two cards to come — OESD can call, but a gutshot better have the odds or Duke folds it.${posNote}`
                );
            }
            if (isTurn) return _voice(
                `${drawLabel} on the turn — one shot left.${eqNote} Don't call big bets here.${posNote}`,
                `${drawLabel} on the turn — one shot left, pal.${eqNote} Don't go calling big bets on a hope and a prayer.${posNote}`
            );
            return _voice(
                `${drawLabel} on the flop — two cards to come.${eqNote} Calling is reasonable; consider a semi-bluff raise if the board hits your range.${posNote}`,
                `${drawLabel} on the flop - two cards to come.${eqNote} You can peel if it's cheap, or fire a semi-bluff if this board sells your story, kid.${posNote}`
            );
        }

        // Top pair - evaluate kicker before advising
        if (isTopPair) {
            const kickerVal = holeVals.find(v => v !== boardMax);
            const kickerName = kickerVal != null ? holeRanks.find(r => RANK_VALUES[r] === kickerVal) : null;
            const kickerIsWeak = kickerVal != null && kickerVal <= 6;   // 2-6
            const kickerIsMid = kickerVal != null && kickerVal >= 7 && kickerVal <= 10; // 7-T

            const preflopRaises = (streetLogs?.preflop || []).filter(a => a.actionType === 'raise').length;
            const heavyPreflop = preflopRaises >= 2;

            const topPairWetWarning = (() => {
                const w = [];
                if (boardHasPair && boardPairedRank) w.push(`board has a pair of ${boardPairedRank}s — anyone holding a ${boardPairedRank} has trips, which beats your pair`);
                if (texture.isFlushy) w.push(`${texture.flushCards} flush-suit cards on board`);
                if (texture.straightConnected) w.push(`${texture.maxConnected} connected cards`);
                return w.length ? _voice(
                    `Watch out: ${w.join('; ')}.`,
                    `This board's got teeth: ${w.join('; ')}.`
                ) : null;
            })();

            // Single coherent sizing recommendation that resolves SPR + position together.
            // Prevents three-way conflict: "bet 50-75%" vs "one pair doesn't win big pots" vs "don't fatten the pot".
            const topPairSizingStr = (() => {
                if (facingAction === 'bet') return '';
                if (spr != null && spr > 8) {
                    return isIP
                        ? _voice(' Bet 33-40% — one pair at deep stacks, keep the pot manageable.', ' Bet 33-40% — one pair at deep stacks don\'t warrant a big pot, kid.')
                        : _voice(' Check or bet 25-33% — deep stack and out of position with one pair.', ' Check or bet 25-33% — deep stack OOP with one pair, pal. This ain\'t the spot to be building.');
                }
                if (!isIP) return _voice(' Bet 40-55% pot.', ' Bet 40-55% pot, kid.');
                return _voice(' Bet 50-75% pot.', ' Bet 50-75% pot, kid.');
            })();
            // Suppress sprNote when sizing already encodes the SPR context (avoids "bet 33-40%" + "one pair doesn't win big pots" firing together)
            const tpSprNote = (spr != null && spr > 8 && facingAction !== 'bet') ? '' : sprNote;
            // Suppress posNote when sizing already told OOP hero to keep it small (avoids doubling up the same warning)
            const tpPosNote = (spr != null && spr > 8 && !isIP && facingAction !== 'bet') ? '' : posNote;

            if (kickerIsWeak) {
                const kickerStr = kickerName ? `Your kicker is ${kickerName} - very weak.` : 'Your kicker is weak.';
                const kickerStrDuke = kickerName ? `Your kicker is ${kickerName} — that's trash, kid.` : 'Your kicker is garbage.';
                const preflopStr = heavyPreflop
                    ? ` Heavy preflop action means opponents likely have the same pair with a better kicker (A, K, Q kickers). If you face a raise, you are probably losing the kicker battle.`
                    : ` Anyone with the same top pair and a better kicker has you beat. Keep the pot small - do not build a big pot with this hand.`;
                const preflopStrDuke = heavyPreflop
                    ? ` Heavy preflop action means they probably got the same pair with a better kicker — A, K, Q. Face a raise here and you're losing the kicker war.`
                    : ` Anybody with the same top pair and a better kicker has you beat. Keep this pot small — don't go building a coffin around this hand.`;
                const wetStr = topPairWetWarning ? ` ${topPairWetWarning} Bet to charge draws but don't overcommit.` : '';
                const wetStrDuke = topPairWetWarning ? ` ${topPairWetWarning} Bet to charge the draws but don't overcommit or you're handing em the keys.` : '';
                const raiseStr = facingAction === 'bet' ? ' Facing a bet with this weak kicker is awkward — consider the pot size before calling.' : '';
                const raiseStrDuke = facingAction === 'bet' ? ' They\'re betting into that weak kicker — this is an ugly spot, pal. Think hard before you call.' : '';
                return _voice(
                    `Top pair but ${kickerStr}${preflopStr}${wetStr}${raiseStr}${posNote}${oppStr}`,
                    `Top pair but ${kickerStrDuke}${preflopStrDuke}${wetStrDuke}${raiseStrDuke}${posNote}${oppStr}`
                );
            }
            if (kickerIsMid && heavyPreflop) {
                const wetStr = topPairWetWarning ? ` ${topPairWetWarning}` : '';
                return _voice(
                    `Top pair with a medium kicker. Preflop was aggressive - opponents may hold A or K with the same pair. You can be ahead, but you are not the nuts here. Bet for value but do not overcommit.${wetStr}${posNote}${oppStr}`,
                    `Top pair with a mid kicker. Preflop got aggressive — they might have the same pair with an A or K kicker. You could be ahead but you ain't the top dog here. Bet for value, don't go all-in with it.${wetStr}${posNote}${oppStr}`
                );
            }
            if (facingAction === 'bet') {
                const wetStr = topPairWetWarning ? ` ${topPairWetWarning} Raise to charge draws.` : ' Call or raise — top pair is worth fighting for here.';
                const wetStrDuke = topPairWetWarning ? ` ${topPairWetWarning} Raise and make them draws pay a toll.` : ' Call or raise — top pair is your bread, fight for it.';
                if (isTurn) return _voice(
                    `Top pair on the turn facing a bet.${wetStr}${tpSprNote}${tpPosNote}${oppStr}`,
                    `Top pair on the turn and they're betting into you, kid.${wetStrDuke}${tpSprNote}${tpPosNote}${oppStr}`
                );
                return _voice(
                    `Top pair facing a bet.${wetStr}${tpSprNote}${tpPosNote}${oppStr}`,
                    `Top pair and they're coming at you, kid.${wetStrDuke}${tpSprNote}${tpPosNote}${oppStr}`
                );
            }
            if (isTurn) {
                const wetStr = topPairWetWarning ? ` ${topPairWetWarning} Bet to charge them.` : ' Do not slow down.';
                const wetStrDuke = topPairWetWarning ? ` ${topPairWetWarning} Bet and make em pay for their draws.` : ' Don\'t slow down, pal.';
                return _voice(
                    `Top pair on the turn. Bet for value and protection —${wetStr}${topPairSizingStr}${tpSprNote}${tpPosNote}${oppStr}`,
                    `Top pair on the turn, kid. Bet for value and run off the draws -${wetStrDuke}${topPairSizingStr}${tpSprNote}${tpPosNote}${oppStr}`
                );
            }
            if (topPairWetWarning) return _voice(
                `Top pair on a wet board. ${topPairWetWarning} Don't let draws in for free.${topPairSizingStr}${tpSprNote}${tpPosNote}${oppStr}`,
                `Top pair on a wet board. ${topPairWetWarning} Don't let the draws in for free.${topPairSizingStr}${tpSprNote}${tpPosNote}${oppStr}`
            );
            return _voice(
                `Top pair. Bet for value.${topPairSizingStr} Do not let draws get there for free.${tpSprNote}${tpPosNote}${oppStr}`,
                `Top pair, kid. Your bread right there — bet for value.${topPairSizingStr} Don't let the draws get there for free.${tpSprNote}${tpPosNote}${oppStr}`
            );
        }

        // Low pair or lower
        if (isSecondPair) {
            const drawLabel = straightDraw.oesd ? 'open-ended straight draw' : straightDraw.gutshot ? 'gutshot straight draw' : null;
            if (facingAction === 'bet') {
                const wetStr = (texture.isFlushy || texture.straightConnected)
                    ? ` Board is wet — a bet here means they likely have a draw or better.`
                    : '';
                const wetStrDuke = (texture.isFlushy || texture.straightConnected)
                    ? ` Board's wet — a bet here means they probably got a draw or better.`
                    : '';
                if (drawLabel) return _voice(
                    `Low pair + ${drawLabel} facing a bet. The draw adds equity — call if the price is right, but don't go stacking off.${sprNote}${posNote}${oppStr}`,
                    `Low pair but you got a ${drawLabel} too, kid. That draw gives you outs — call if the price is right, but don't build a monster pot on it.${sprNote}${posNote}${oppStr}`
                );
                return _voice(
                    `Low pair facing a bet. Marginal hand — fold to any real pressure.${wetStr}${sprNote}${posNote}${oppStr}`,
                    `Low pair and they're betting into you. Get outta there when they push real money, kid.${wetStrDuke}${sprNote}${posNote}${oppStr}`
                );
            }
            if (drawLabel) return _voice(
                `You have a pair but it is not top pair — but you also have an ${drawLabel}. Semi-playable: you have two ways to win. Don't overcommit, but the draw keeps you in it.${sprNote}${oppStr}`,
                `Low pair ain't much, but that ${drawLabel} changes things, kid. You got two ways to win — pair holds or the straight gets there. Keep it reasonable.${sprNote}${oppStr}`
            );
            return _voice(
                `You have a pair but it is not top pair. Pot control - do not build a massive pot.${sprNote}${oppStr} Fold to a big raise.`,
                `Low pair ain't gonna win you wars, kid. Keep it small or walk.${sprNote}${oppStr} Big raise? You fold.`
            );
        }

        // Pocket underpair — pocket pair that missed the board (below at least one board card)
        if (pocketUnderpair) {
            if (facingAction === 'bet') {
                const wetStr = (texture.isFlushy || texture.straightConnected)
                    ? ` Board is wet — fold to any real pressure.`
                    : '';
                const wetStrDuke = (texture.isFlushy || texture.straightConnected)
                    ? ` Board's wet — fold to any real pressure.`
                    : '';
                return _voice(
                    `Pocket pair but the board has higher cards. Marginal — fold to any real pressure.${wetStr}${sprNote}${posNote}${oppStr}`,
                    `Pocket pair but the board's running over you, kid. Fold to any real pressure.${wetStrDuke}${sprNote}${posNote}${oppStr}`
                );
            }
            return _voice(
                `Pocket pair, but the board has higher cards. Keep the pot small and fold to a big raise.${sprNote}${oppStr}`,
                `Pocket pair but the board's got you outgunned, kid. Keep it small or walk when they raise.${sprNote}${oppStr}`
            );
        }

        // Overcards only
        const holeMax = Math.max(...holeVals);
        if (holeMax > boardMax) {
            if (facingAction === 'bet') return _voice(
                `Overcards facing a bet. You have nothing made yet — fold unless you have a solid read they are bluffing or the price is very cheap.${posNote}`,
                `Overcards facing a bet. You ain't hit nothing yet, kid — get outta there unless you got a read they're running a bluff or the price is basically free.${posNote}`
            );
            return _voice(
                `You have overcards - unimproved but live. One more card could give you top pair. Cheap street is fine; do not call a big bet without a stronger read.${posNote}`,
                `You ain't hit nothing yet but those high cards are live. One more card could hand you top pair. Take the cheap street, don't go blowing your stack on a prayer.${posNote}`
            );
        }

        // Backdoor draws — low equity but worth noting on the flop only (not turn: too late)
        if (!isTurn && !isRiver && (hasBackdoorFlush || hasBackdoorStraight)) {
            const rrEq = _runnerRunnerEquity(holeCards, board);
            const equityParts = [];
            if (hasBackdoorFlush) equityParts.push(`${rrEq.flush}% flush`);
            if (hasBackdoorStraight) equityParts.push(`${rrEq.straight}% straight`);
            const equityNote = equityParts.join(', ');
            const parts = [];
            if (hasBackdoorFlush) parts.push('backdoor flush draw (need runner-runner)');
            if (hasBackdoorStraight) parts.push('backdoor straight draw (need runner-runner)');
            const backdoorNote = parts.join(' and ');
            if (facingAction === 'bet') return _voice(
                `You have not connected but you have a ${backdoorNote} (~${equityNote}). Don't call a significant bet for this alone. Fold unless you're getting a great price or have position.${posNote}`,
                `You ain't connected but you got a ${backdoorNote} (~${equityNote}). Duke don't pay for runner-runner dreams. Fold unless the price is basically a gift.${posNote}`
            );
            return _voice(
                `You haven't connected yet but have a ${backdoorNote} (~${equityNote}) — it adds a small reason to see the turn cheaply, but don't rely on it.${posNote}`,
                `You ain't hit nothing yet but you got a ${backdoorNote} (~${equityNote}) — take the cheap turn if they give it, otherwise fold. Don't build your future on it.${posNote}`
            );
        }

        if (facingAction === 'bet') return _voice(
            `You have not connected with the board and are facing a bet. Easy fold — you have no made hand and no strong draw.${posNote}`,
            `You connected with nothing on this board and they're betting. Easy fold - no made hand, no draw, no reason to be here, pal.${posNote}`
        );
        return _voice(
            `You have not connected with this board. You need a good reason to continue - a solid read on a bluff or a very cheap price.${posNote}`,
            `You connected with nothing on this board. You need a real reason to continue, pal — a solid read they're bluffing or an almost-free price.${posNote}`
        );
    }

    // Preflop hand chart. Returns { strength, action } for own hole cards.
    // strength: 'premium' | 'strong' | 'playable' | 'marginal' | 'weak'
    // action:   'raise'   | 'call'   | 'fold'     (default from position)
    function evalPreflopHand(holeCards, position, facingRaise) {
        if (!holeCards || holeCards.length < 2) return null;
        const r1 = RANK_VALUES[holeCards[0].slice(0, -1)];
        const r2 = RANK_VALUES[holeCards[1].slice(0, -1)];
        if (!r1 || !r2) return null;  // card format not recognized, don't guess
        const hi = Math.max(r1, r2);
        const lo = Math.min(r1, r2);
        const s1 = holeCards[0].slice(-1);
        const s2 = holeCards[1].slice(-1);
        const suited = s1 === s2;
        const isPair = r1 === r2;
        const gap = hi - lo;

        let strength, action;

        if (isPair) {
            if (hi >= 10) { strength = 'premium'; action = 'raise'; }
            else if (hi >= 7) { strength = 'strong'; action = facingRaise ? 'call' : 'raise'; }
            else if (hi >= 5) { strength = 'playable'; action = facingRaise && position === 'EP' ? 'fold' : 'call'; }
            else { strength = 'marginal'; action = facingRaise ? 'fold' : (position === 'LP' ? 'call' : 'fold'); }
        } else if (hi === 14) { // Ace-x
            if (lo >= 13 || (lo >= 12 && suited)) { strength = 'premium'; action = 'raise'; }
            else if (lo >= 12 || (lo >= 10 && suited)) { strength = 'strong'; action = 'raise'; }
            else if (suited && lo >= 2) { strength = 'playable'; action = facingRaise && position === 'EP' ? 'fold' : (position === 'EP' ? 'fold' : 'call'); }
            else if (lo >= 10) { strength = 'playable'; action = facingRaise ? 'fold' : (position === 'LP' ? 'raise' : 'fold'); }
            else { strength = 'marginal'; action = facingRaise ? 'fold' : (position === 'LP' ? 'fold' : 'fold'); }
        } else if (hi === 13) { // King-x
            if (lo >= 12 && suited) { strength = 'strong'; action = facingRaise ? 'call' : 'raise'; }
            else if (lo >= 11) { strength = 'playable'; action = facingRaise && position === 'EP' ? 'fold' : (position === 'LP' ? 'raise' : 'call'); }
            else if (suited && lo >= 9) { strength = 'playable'; action = facingRaise ? 'fold' : (position === 'LP' ? 'raise' : 'fold'); }
            else { strength = 'marginal'; action = 'fold'; }
        } else if (hi === 12) { // Queen-x
            if (lo >= 11 && suited) { strength = 'strong'; action = facingRaise ? 'call' : 'raise'; }
            else if (lo >= 10 && suited) { strength = 'playable'; action = facingRaise ? 'fold' : (position === 'LP' ? 'raise' : 'call'); }
            else if (lo >= 11) { strength = 'playable'; action = facingRaise && position === 'EP' ? 'fold' : 'call'; }
            else { strength = 'marginal'; action = 'fold'; }
        } else if (hi === 11) { // Jack-x
            if (lo >= 10 && suited) { strength = 'strong'; action = facingRaise ? 'call' : 'raise'; }
            else if (lo >= 9 && suited) { strength = 'playable'; action = facingRaise ? 'fold' : (position === 'LP' ? 'raise' : 'fold'); }
            else { strength = 'marginal'; action = 'fold'; }
        } else if (suited && gap <= 1 && lo >= 5) {
            // Suited connectors / one-gappers (65s, 76s, 87s, 98s, T9s etc.)
            strength = 'playable';
            action = facingRaise ? (position === 'LP' ? 'call' : 'fold') : (position === 'LP' ? 'raise' : 'fold');
        } else {
            strength = 'weak';
            action = 'fold';
        }

        return { strength, action, suited, isPair, hi, lo };
    }

    // ── Short-stack push/fold ────────────────────────────────────
    // Below ~15 BB effective the chart's raise/call/fold advice is wrong: correct play
    // collapses to all-in or fold. Thresholds approximate Nash push/fold ranges using the
    // hand's percentile in _HAND_ORDER (110 classes, strongest first).
    function _pushFoldThreshold(effBB, position, facingRaise, raisers) {
        if (facingRaise) {
            let t = effBB <= 5 ? 0.25 : effBB <= 10 ? 0.15 : 0.10;
            if (raisers >= 2) t *= 0.6;       // a raise and action behind: much tighter
            if (position === 'BB') t *= 1.25; // closing the action with a discount
            return Math.min(t, 1);
        }
        const table = effBB <= 5
            ? { EP: 0.35, MP: 0.45, LP: 0.60, SB: 1.00, BB: 0.45 }
            : effBB <= 10
                ? { EP: 0.20, MP: 0.30, LP: 0.45, SB: 0.60, BB: 0.30 }
                : { EP: 0.13, MP: 0.20, LP: 0.30, SB: 0.45, BB: 0.20 };
        return table[position] ?? table.MP;
    }

    function getShortStackPushFoldAdvice(holeCards, position, facingRaise, raisers, limperCount, isBBFree) {
        const effBB = currentHand?.effectiveStackBB;
        if (effBB == null || effBB <= 0 || effBB > 15) return null;
        const ch = canonicalHand(holeCards);
        if (!ch) return null;

        const idx = _HAND_ORDER.indexOf(ch);
        const pct = idx >= 0 ? (idx + 1) / _HAND_ORDER.length : 1;
        const pctStr = idx >= 0 ? `top ${Math.max(1, Math.round(pct * 100))}%` : 'bottom of the deck';
        const bbStr = `${Math.round(effBB)} BB`;
        const posLabel = { EP: 'early position', MP: 'mid position', LP: 'late position', SB: 'the small blind', BB: 'the big blind' }[position] || 'your position';
        const threshold = _pushFoldThreshold(effBB, position, facingRaise, raisers);
        const needStr = `top ${Math.max(1, Math.round(threshold * 100))}%`;
        const shouldCommit = pct <= threshold;

        // Big blind, unraised, nobody limped: the flop is free, never fold
        if (isBBFree && limperCount === 0) {
            return _voice(
                `Short stack (${bbStr} effective): free look from the big blind. Check and see the flop; save your last chips for a spot where you can shove first in.`,
                `${bbStr} left and a free peek from the big blind? Take it, kid. Check. Don't spend your last bullets before you have to.`
            );
        }
        // Big blind, unraised, limpers in front: shove over them or take the free flop
        if (isBBFree && limperCount > 0) {
            return shouldCommit
                ? _voice(
                    `Short stack (${bbStr} effective) with ${limperCount} limper${limperCount > 1 ? 's' : ''} in front: ${ch} is in the ${pctStr} of hands. Shove over the limps; dead money plus fold equity is exactly what a short stack lives on.`,
                    `${bbStr} left and ${limperCount} limper${limperCount > 1 ? 's' : ''} shuffling in? ${ch} is ${pctStr}, so ship it all-in over the top. Dead money's on the table, go take it.`
                )
                : _voice(
                    `Short stack (${bbStr} effective): ${ch} (${pctStr} of hands) is not worth committing over the limpers. Check your free flop and keep your last chips for a real shove.`,
                    `${bbStr} left, junk in your hand. Take the free flop and keep your powder dry, pal.`
                );
        }

        if (facingRaise) {
            return shouldCommit
                ? _voice(
                    `Short stack (${bbStr} effective) facing a raise: this is all-in or fold. ${ch} (${pctStr} of hands) is strong enough here. Re-shove and get it in; flat-calling just bleeds your last chips with no fold equity.`,
                    `${bbStr} left and somebody raised? It's ship-it-or-fold time. ${ch} is ${pctStr}, shove it all-in, kid. Calling small is how short stacks die slow.`
                )
                : _voice(
                    `Short stack (${bbStr} effective) facing a raise: all-in or fold, and ${ch} (${pctStr} of hands) is not strong enough to call off your stack. You need roughly the ${needStr} here. Fold.`,
                    `${bbStr} left and they raised into you. ${ch} don't cut it; you need the ${needStr} to go broke with. Fold and wait for a real hand.`
                );
        }

        return shouldCommit
            ? _voice(
                `Short stack (${bbStr} effective): push/fold territory. ${ch} is in the ${pctStr} of starting hands, strong enough to move all-in from ${posLabel}. Jam, don't min-raise: a small raise commits you anyway and gives up your fold equity.`,
                `${bbStr} left? You're in shove-or-fold country. ${ch} is ${pctStr}, ship it all-in from ${posLabel}. None of these dainty min-raises: you're committed either way, so take the fold equity with you.`
            )
            : _voice(
                `Short stack (${bbStr} effective): push/fold territory, and ${ch} (${pctStr} of hands) is below the roughly ${needStr} you can shove from ${posLabel}. Fold; at this depth there is no such thing as a small raise or a cheap call.`,
                `${bbStr} left. Shove-or-fold country, and ${ch} ain't a shove from ${posLabel}; you want the ${needStr}. Fold it and sit tight.`
            );
    }

    function getPreflopSelfAdvice(holeCards, position) {
        const facingRaise = (currentHand?.preflopRaiseCount || 0) > 0;
        const ev = evalPreflopHand(holeCards, position, facingRaise);
        if (!ev) return null;

        const limperCount = facingRaise ? 0 :
            Object.values(currentHand?.perPlayer || {})
                .filter(p => p.limpedPreflop && p !== currentHand.perPlayer[localPlayerName]).length;

        const { strength, action, suited, isPair, hi, lo } = ev;
        const posLabel = { EP: 'early position', MP: 'mid position', LP: 'late position', SB: 'small blind', BB: 'big blind' }[position] || 'your position';
        const raisers = facingRaise ? currentHand.preflopRaiseCount : 0;
        // BB special case: no raise = free flop, folding is never correct
        const isBBFree = position === 'BB' && !facingRaise;

        // Short-stack override: under ~15 BB effective the chart advice below is wrong
        const pushFold = getShortStackPushFoldAdvice(holeCards, position, facingRaise, raisers, limperCount, isBBFree);
        if (pushFold) return pushFold;

        if (strength === 'premium') {
            // Specific guidance for recognizable premium combos
            if (isPair && hi === 14) {
                // AA
                const pitfall = raisers >= 2
                    ? `Re-raise — do not slow-play aces against multiple raisers. Thin the field now.`
                    : `Raise. Pocket aces are the best starting hand — raise big to narrow the field. Pitfall: limping or min-raising lets in cheap callers who can crack you with suited connectors or small pairs. Don't be tricky preflop.`;
                const pitfallDuke = raisers >= 2
                    ? `Pocket aces and there's already raises flying. Re-raise — you don't slow-play rockets against multiple raisers. Thin the field now.`
                    : `Pocket aces, kid. The best hand in existence. Raise big and clear the riff-raff out. Don't limp, don't min-raise — some joker will crack you with a 7-2 suited if you let em in cheap.`;
                return _voice(pitfall, pitfallDuke);
            }
            if (isPair && hi === 13) {
                // KK
                const pitfall = raisers >= 2
                    ? `Cowboys — re-raise. Strong enough to go all-in preflop. The only hand that beats you here is AA.`
                    : `Pocket kings. Raise big. Pitfall: many players over-fold KK when an ace hits the board — your opponent doesn't always have the ace. Don't auto-surrender to an ace without reads.`;
                const pitfallDuke = raisers >= 2
                    ? `Cowboys, pal. Re-raise and don't look back. Only thing that beats you is rockets. Go all-in preflop.`
                    : `Pocket kings. Raise big. Rookie mistake: folding this the second an ace hits the flop. They don't always have the ace — don't hand your chips over without a read.`;
                return _voice(pitfall, pitfallDuke);
            }
            if (isPair && hi === 12) {
                // QQ
                return _voice(
                    raisers >= 2
                        ? `Pocket queens — strong, but if you're facing a 4-bet from a tight player, you might be behind KK or AA. Re-raise with caution and consider the raiser's badge.`
                        : `Pocket queens. Raise. Pitfall: queens hate an ace or king on the flop. If a tight player bets into an A-high or K-high board, reassess. Your hand is one-pair strength post-flop.`,
                    raisers >= 2
                        ? `Pocket queens facing multiple raises — strong hand but a tight 4-bettor might have you behind KK or AA. Re-raise with some respect for the action, pal.`
                        : `Pocket queens. Raise. Pitfall: queens fall apart when an ace or king lands. Tight player betting into that board? Reassess. You got one pair, not a miracle.`
                );
            }
            if (isPair && hi >= 11) {
                // JJ or TT
                const name = hi === 11 ? 'Jacks' : 'Tens';
                return _voice(
                    raisers >= 2
                        ? `Pocket ${name} facing multiple raises — calling is safer than re-jamming. Overcards are likely.`
                        : `Pocket ${name}. Raise, but be ready to fold if an overcard (A, K, Q) hits and a tight player shows real aggression. These hands are strong before the flop but become tricky after — don't over-commit when the board has overcards.`,
                    raisers >= 2
                        ? `Pocket ${name} and there's raises flying everywhere — calling is safer than re-jamming here, pal. Overcards are probably out there.`
                        : `Pocket ${name}. Raise, but keep your head. An overcard hits and a tight player starts showing teeth? Don't go broke on one pair.`
                );
            }
            if (!isPair && hi === 14 && lo === 13) {
                // AK
                return _voice(
                    raisers >= 2
                        ? `Big Slick — re-raise. Strong enough to go all-in preflop against most ranges.`
                        : `Ace-King${suited ? ' suited' : ''}. Raise. This is a premium drawing hand — it's not made yet. Pitfall: AK misses the flop about 2/3 of the time. Don't over-commit post-flop if you whiff. It's just ace-high.`,
                    raisers >= 2
                        ? `Big Slick${suited ? ' suited' : ''} — re-raise. Strong enough to go all-in preflop against most ranges, kid.`
                        : `Ace-King${suited ? ' suited' : ''}. Raise it. Premium drawing hand — but it ain't made yet. Misses the flop 2 out of 3 times. Don't go throwing your stack at a whiff. It's just ace-high until the board says otherwise.`
                );
            }
            if (!isPair && hi === 14 && lo === 12 && suited) {
                // AQs
                return _voice(
                    facingRaise
                        ? `Ace-Queen suited — solid. Call or re-raise. Against an EP raiser, be cautious about AK or AA dominating you.`
                        : `Ace-Queen suited. Raise from ${posLabel}. Strong hand with nut-flush potential. Pitfall: AQ is behind AK — against a tight 3-bettor, you may be dominated.`,
                    facingRaise
                        ? `Ace-Queen suited — solid hand, pal. Call or re-raise. Tight EP raiser? Tread careful, AK or AA might have you dominated.`
                        : `Ace-Queen suited. Raise from ${posLabel}. You got nut-flush potential on top of everything else. Pitfall: AQ loses to AK — tight 3-bettor is telling you something. Don't be stupid.`
                );
            }
            // Generic premium fallback
            return _voice(
                raisers >= 2
                    ? `Premium hand. Re-raise or go all-in. Don't just call a 3-bet with this.`
                    : `Premium hand. Raise if you haven't already.`,
                raisers >= 2
                    ? `Premium hand, kid. Re-raise or go all-in. Don't sit there calling a 3-bet with this.`
                    : `Premium hand. You raise this — if you haven't already, what are you waiting for.`
            );
        }
        if (strength === 'strong') {
            if (isPair && hi === 9) {
                return _voice(
                    facingRaise
                        ? `Pocket nines — call to see a flop. Overpairs are your goal. If an overcard-heavy board comes and you face aggression, be careful.`
                        : `Pocket nines. Raise from ${posLabel}. Good hand but not bullet-proof post-flop — fold to heavy multi-street pressure on overcard boards.`,
                    facingRaise
                        ? `Pocket nines — call and see the flop. You want to flop an overpair. Board comes out with overcards and they start barking? Be careful, pal.`
                        : `Pocket nines. Raise from ${posLabel}. Good hand, but it ain't armor — overcard board with heavy pressure means you gotta respect what they're selling.`
                );
            }
            if (!isPair && hi === 14 && lo === 12 && !suited) {
                // AQo
                return _voice(
                    facingRaise
                        ? `Ace-Queen offsuit facing a raise — calling is reasonable. Avoid 3-bet/calling off large portions of your stack, as AK dominates you.`
                        : `Ace-Queen. Raise from ${posLabel}. Solid hand. Post-flop: top pair with good kicker. Pitfall: don't stack off against tight players — AK beats you.`,
                    facingRaise
                        ? `Ace-Queen offsuit facing a raise — calling is reasonable. Don't go 3-bet calling off your whole stack, AK has you dominated.`
                        : `Ace-Queen. Raise from ${posLabel}. Solid hand — top pair with a good kicker is your bread. Pitfall: tight player comes over the top, think twice. AK eats this for breakfast.`
                );
            }
            if (isBBFree) return _voice(
                `Strong hand in the big blind. Raise it, don't let them see a cheap flop.`,
                `Strong hand in the big blind. Raise it — don't let these bums see a cheap flop.`
            );
            if (facingRaise) return _voice(
                `Solid hand from ${posLabel}. Calling is fine, re-raising is fine if you have a read on the raiser.`,
                `Solid hand from ${posLabel}. Call is fine, re-raise is fine ? you got enough to push back if you got a read on the raiser, kid.`
            );
            return limperCount > 0
                ? _voice(
                    `Strong hand. Raise to isolate — ${limperCount} limper${limperCount > 1 ? 's' : ''} in.`,
                    `Strong hand, kid. Raise to isolate — ${limperCount} limper${limperCount > 1 ? 's' : ''} already in.`
                )
                : _voice(
                    `Strong hand. Open raise from ${posLabel}.`,
                    `Strong hand, kid. Open raise from ${posLabel} — don't limp this.`
                );
        }
        if (strength === 'playable') {
            if (isBBFree) return _voice(
                `Decent hand. Check and see what the flop brings.`,
                `Decent hand in the big blind and it's free. Check and see what comes out on the flop, pal.`
            );
            if (action === 'fold') return _voice(
                `${suited ? 'Suited' : 'This'} hand has some potential but ${posLabel} makes it marginal. Folding to a raise is fine.`,
                `${suited ? 'Suited hand' : 'This hand'} got some potential but ${posLabel} makes it a tough play. Fold to a raise, don't be a hero.`
            );
            if (action === 'call') return _voice(
                `Speculative hand. Worth a call${facingRaise ? ' to see a flop' : ''}, but don't put in much more without a strong flop.`,
                `Speculative hand. Worth a call${facingRaise ? ' to see the flop' : ''}, but don't go building a pot around it without a strong board, kid.`
            );
            return limperCount > 0
                ? _voice(
                    `There ${limperCount === 1 ? 'is' : 'are'} ${limperCount} limper${limperCount > 1 ? 's' : ''} in — you can call or raise to build the pot.`,
                    `${limperCount} limper${limperCount > 1 ? 's' : ''} already in, pal — call or raise to build the pot.`
                )
                : _voice(
                    `Decent hand from ${posLabel}. Open raise is reasonable.`,
                    `Decent hand from ${posLabel}. Open raise is reasonable ? take the initiative, kid.`
                );
        }
        if (strength === 'marginal') {
            if (isBBFree) return _voice(
                `Weak hand but you're in the big blind with no raise. Check and take the free flop.`,
                `Weak hand but nobody raised and it's your big blind. Check it and take the free flop ? waste not, pal.`
            );
            return _voice(
                facingRaise
                    ? `Marginal hand. Fold to the raise and wait for a better spot.`
                    : (position === 'LP' ? `Weak hand but you're late, you can try a steal if it folded to you.` : `Marginal hand in ${posLabel}. Fold and move on.`),
                facingRaise
                    ? `Marginal hand. Fold to the raise and wait for a better spot — Duke don't play trash against raises.`
                    : (position === 'LP' ? `Weak hand but you're sitting late, pal. You can try a steal if it folded around to you.` : `Marginal hand in ${posLabel}. Fold and find a better spot, pal.`)
            );
        }
        // strength === 'weak'
        if (isBBFree) return _voice(
            `Bad hand but you're getting a free flop. Check and see.`,
            `Bad hand but you're getting a free flop, kid. Check it and see — can't hurt.`
        );
        return _voice(
            facingRaise
                ? `Weak hand. Fold.`
                : (position === 'LP' ? `Weak hand. Even as a steal this is too thin unless the blinds are very tight.` : `Weak hand. Fold.`),
            facingRaise
                ? `Weak hand. Fold, pal. Duke don't bleed chips on garbage facing a raise.`
                : (position === 'LP' ? `Weak hand. Even late position, this is too thin for a steal unless those blinds are playing scared.` : `Weak hand. Fold. Don't waste your time.`)
        );
    }

    // Classifies bet sizing into a pressure level using stack commitment as the primary signal.
    // Stack commitment (betPct) tells you how much they're actually risking relative to their future.
    // Pot% is secondary — useful for pot odds but misleading as a pressure signal at deep stacks.
    // BB count gives absolute context (2BB probe vs 40BB shove play completely differently).
    function classifyBetSizing(amount, betPct, potPct) {
        const bbAmt = currentTableBB && amount ? Math.round(amount / currentTableBB) : null;
        const bbLabel = isBBDisplayMode
            ? (bbAmt !== null ? `${bbAmt}BB` : null)
            : (amount ? fmtStack(amount) : null);
        const potLabel = potPct !== null ? `${potPct}% pot` : null;

        // Pressure is determined by stack commitment, not pot percentage
        let pressure, pressureWord;
        if (betPct !== null) {
            if (betPct < 2) { pressure = 'minimal'; pressureWord = 'tiny probe'; }
            else if (betPct < 5) { pressure = 'low'; pressureWord = 'probe'; }
            else if (betPct < 12) { pressure = 'medium'; pressureWord = 'standard bet'; }
            else if (betPct < 25) { pressure = 'high'; pressureWord = 'meaningful bet'; }
            else if (betPct < 50) { pressure = 'committed'; pressureWord = 'committed bet'; }
            else { pressure = 'stack-off'; pressureWord = 'stack-off bet'; }
        } else if (potPct !== null) {
            // No stack data — fall back to pot-relative pressure
            if (potPct < 30) { pressure = 'low'; pressureWord = 'probe'; }
            else if (potPct < 70) { pressure = 'medium'; pressureWord = 'standard bet'; }
            else if (potPct < 120) { pressure = 'high'; pressureWord = 'big bet'; }
            else { pressure = 'committed'; pressureWord = 'overbet'; }
        } else {
            pressure = null; pressureWord = 'bet';
        }

        return { bbAmt, bbLabel, potLabel, pressure, pressureWord };
    }

    function buildMechanisticMessage(playerName, actionType, betPct, texture, potPct, amount, amountAdded, street) {
        if (actionType === 'fold' || actionType === 'check') return null;

        const they = playerName || 'They';
        const isRiver = (currentHand?.boardCards?.length || 0) >= 5;
        const parts = [];
        const push = (def, duke) => parts.push(_voice(def, duke));
        const amtForPot = amountAdded ?? amount;

        if (actionType === 'bet' || actionType === 'raise') {
            const sz = classifyBetSizing(amount, betPct, potPct);

            if (sz.bbLabel && sz.potLabel) {
                // Both BB and pot context available — full picture
                if (sz.pressure === 'minimal' || sz.pressure === 'low') {
                    push(
                        `${they} bet ${sz.bbLabel} (${sz.potLabel}) — ${sz.pressureWord}. Testing who connected. Easy to call or raise with a hand.`,
                        `${they} bet ${sz.bbLabel} (${sz.potLabel}) — ${sz.pressureWord}. Tiny poke, see who flinches. Easy to peel or pop if you got a hand, kid.`
                    );
                } else if (sz.pressure === 'medium') {
                    push(
                        `${they} bet ${sz.bbLabel} (${sz.potLabel}) — ${sz.pressureWord}. Committing a real chunk. Has a read or has a hand.`,
                        `${they} bet ${sz.bbLabel} (${sz.potLabel}) — ${sz.pressureWord}. Real chunk. Either they got a read or they got the goods.`
                    );
                } else if (sz.pressure === 'high') {
                    push(
                        `${they} bet ${sz.bbLabel} (${sz.potLabel}) — ${sz.pressureWord}. That's ${Math.round(betPct)}% of their stack. Real commitment.`,
                        `${they} bet ${sz.bbLabel} (${sz.potLabel}) — ${sz.pressureWord}. That's ${Math.round(betPct)}% of their stack. Real heat.`
                    );
                } else if (sz.pressure === 'committed' || sz.pressure === 'stack-off') {
                    push(
                        `${they} bet ${sz.bbLabel} (${sz.potLabel}) — ${sz.pressureWord} at ${Math.round(betPct)}% of stack. They're putting their tournament life on this. Don't call without a real hand.`,
                        `${they} bet ${sz.bbLabel} (${sz.potLabel}) — ${sz.pressureWord} at ${Math.round(betPct)}% of stack. They puttin the stack on the line. Don't call without the goods.`
                    );
                }
            } else if (sz.bbLabel) {
                if (sz.pressure === 'minimal' || sz.pressure === 'low')
                    push(
                        `${they} bet ${sz.bbLabel} — ${sz.pressureWord}. Small investment, low risk for them.`,
                        `${they} bet ${sz.bbLabel} — ${sz.pressureWord}. Small poke, low risk for them.`
                    );
                else if (sz.pressure === 'medium')
                    push(
                        `${they} bet ${sz.bbLabel} — ${sz.pressureWord}.`,
                        `${they} bet ${sz.bbLabel} — ${sz.pressureWord}. Standard heat.`
                    );
                else
                    push(
                        `${they} bet ${sz.bbLabel} — ${sz.pressureWord}. Real commitment.`,
                        `${they} bet ${sz.bbLabel} — ${sz.pressureWord}. Real heat.`
                    );
            } else if (sz.potLabel) {
                if (sz.pressure === 'committed' || sz.pressure === 'stack-off')
                    push(
                        `${they} put in ${sz.potLabel}. Heavy pressure.`,
                        `${they} put in ${sz.potLabel}. Heavy heat.`
                    );
                else
                    push(
                        `${they} put in ${sz.potLabel} — ${sz.pressureWord}.`,
                        `${they} put in ${sz.potLabel} — ${sz.pressureWord}. Leaning on you.`
                    );
            } else {
                push(
                    actionType === 'raise'
                        ? `${they} raised. A raise always narrows range regardless of sizing.`
                        : `${they} bet into the pot.`,
                    actionType === 'raise'
                        ? `${they} raised. A raise always tightens the range, size or not.`
                        : `${they} fired into the pot.`
                );
            }

            // Pot odds — need X% to call (consistent format with GTO math layer)
            if (amtForPot) {
                const potBeforeCall = currentHand?.runningPot || 0; // pot already includes the bet
                const equity = potOddsPct(amtForPot, potBeforeCall);
                if (equity !== null && equity > 0 && equity < 100) {
                    if (equity <= 20) {
                        push(
                            `Need ~${equity}% to call — small bet into a big pot. Easy price.`,
                            `Need ~${equity}% to call — small bet, big pot. Easy price, pal.`
                        );
                    } else if (equity <= 40) {
                        const drawNote = isRiver ? `Worth calling with a solid pair or better.` : `Worth calling with a solid draw or pair.`;
                        const drawNoteDuke = isRiver ? `Worth a call with a solid pair or better.` : `Worth a call with a real draw or pair.`;
                        push(
                            `Need ~${equity}% to call. ${drawNote}`,
                            `Need ~${equity}% to call. ${drawNoteDuke}`
                        );
                    } else if (equity <= 60) {
                        push(
                            `Need ~${equity}% to call — expensive. Need a strong hand to justify it.`,
                            `Need ~${equity}% to call — that's expensive, pal. You better have a real hand.`
                        );
                    } else {
                        push(
                            `Need ~${equity}% to call — only worth it with a near-certain winner.`,
                            `Need ~${equity}% to call — only call with a near-certain winner, kid. Anything less is lighting money on fire.`
                        );
                    }
                }
            }

        } else if (actionType === 'call') {
            const isPreflop = ((street || currentHand?.street) || 'preflop') === 'preflop';
            const isLimp = isPreflop && (currentHand?.preflopRaiseCount || 0) === 0;
            if (isLimp) {
                push(
                    `${they} limped in — no raise before them. Wide speculative range: small pairs, suited connectors, or just loose play.`,
                    `${they} limped in — no raise before them. Wide junk range: small pairs, suited connectors, or just splashy nonsense.`
                );
            } else {
                const sz = classifyBetSizing(amount, betPct, potPct);
                if (sz.bbLabel && sz.potLabel) {
                    push(
                        `${they} called ${sz.bbLabel} (${sz.potLabel}). No stats yet — their range is still wide.`,
                        `${they} called ${sz.bbLabel} (${sz.potLabel}). No read yet — range still wide, kid.`
                    );
                } else if (sz.bbLabel) {
                    push(
                        `${they} called ${sz.bbLabel}. Range unknown — wait for more hands to build a read.`,
                        `${they} called ${sz.bbLabel}. Range unknown — need more hands to tag them.`
                    );
                } else {
                    push(
                        `${they} called. No data on this player yet.`,
                        `${they} called. No data yet.`
                    );
                }
            }
        }

        if (texture && texture.isFlushy && parts.length)
            push(
                isRiver ? 'Board has flush potential.' : 'Flush draw on board — draws are in play.',
                isRiver ? 'Board got flush cards on it.' : 'Flush draw out there — draws are live, pal.'
            );
        else if (texture && texture.straightConnected && parts.length)
            push(
                isRiver ? 'Board is straight-connected.' : 'Connected board — straight draws live.',
                isRiver ? 'Board is straight-connected.' : 'Connected board — straight draws are alive.'
            );

        const msg = parts.join(' ');
        return msg ? { text: msg, confidence: null, isMath: true } : null;
    }

    // Returns a compact sizing label for use inside longer coach messages.
    function sizingLabel(potPct, betPct, amount) {
        const sz = classifyBetSizing(amount, betPct, potPct);
        if (sz.bbLabel && sz.potLabel) return `${sz.bbLabel} (${sz.potLabel} — ${sz.pressureWord})`;
        if (sz.bbLabel) return `${sz.bbLabel} (${sz.pressureWord})`;
        if (sz.potLabel) return `${sz.potLabel} (${sz.pressureWord})`;
        return null;
    }

    // Returns a concrete action tag: "→ FOLD", "→ CALL", "→ RAISE", "→ CALL or RAISE".
    // decision: 'fold' | 'call' | 'raise' | 'call_or_raise' | 'check' | 'context_dependent'
    function actionTag(decision) {
        const map = {
            fold: '→ FOLD',
            call: '→ CALL',
            raise: '→ RAISE',
            call_or_raise: '→ CALL or RAISE',
            check: '→ CHECK',
            context_dependent: '→ Depends on your hand',
        };
        return map[decision] || '';
    }

    // Returns true when this action is worth a full detailed coach entry.
    // Low-signal actions (routine preflop limps, small calls, etc.) get a compact one-liner instead.
    function isHighSignal(actionType, betPct, street, typeKey, dm, isTilting, isAggSpike, aggHistory, isRiver) {
        if (actionType === 'fold') return false; // folds get their own compact path
        if (actionType === 'check') return false; // checks are always detailed via the check branch, skip here
        if (isRiver) return true;   // every river action matters
        if (isTilting || isAggSpike) return true; // live alerts always fire
        if (street !== 'preflop' && (actionType === 'bet' || actionType === 'raise')) return true; // any postflop bet/raise
        if (street === 'preflop' && actionType === 'raise') {
            // 3-bet or bigger: always high signal
            const pflopRaises = (currentHand?.preflopRaiseCount || 0);
            if (pflopRaises >= 2) return true;
            // First open raise: high signal only for tight players (unexpected) or large sizing
            if (typeKey === 'NIT' || typeKey === 'ROCK') return true;
            if (betPct !== null && betPct >= 12) return true; // big open
            return true; // preflop raises are always worth noting (short message)
        }
        if (actionType === 'call') {
            // Call after having bet/raised previously = potential slowplay
            if (aggHistory && aggHistory.length > 0) return true;
            // Large call
            if (betPct !== null && betPct >= 10) return true;
            // Call on turn or later
            if (street === 'turn') return true;
            // Tight player calling (unexpected) or aggressive player NOT raising (unusual)
            if (typeKey === 'NIT' || typeKey === 'ROCK') return true;
            if (typeKey === 'MANIAC' || typeKey === 'LAG') return true; // aggressive player flat-calling is a tell
            // Otherwise preflop call/limp is low signal
            return false;
        }
        // Sizing deviation from this player's baseline = always high signal
        if ((actionType === 'bet' || actionType === 'raise') && betPct !== null && dm?.avgRaisePct != null) {
            const ratio = betPct / dm.avgRaisePct;
            if (ratio > 1.7 || ratio < 0.6) return true;
        }
        return false;
    }

    function composeCoachMessage(action, facingAction) {
        if (!action) return null;
        if (hudSettings.mrCoachMode === 'off') return null;

        const v = (def, duke) => _voice(def, duke);
        const { playerName, actionType, amount, street } = action;
        const amountAdded = action.amountAdded ?? null;
        const amountForPot = amountAdded ?? amount;
        if (!street) return null;

        // Bet sizing — use current stack (start minus already committed) for accurate pressure %
        const startStack = currentHand?.stackAtStart?.[playerName];
        const alreadyIn = currentHand?.playerPotContrib?.[playerName] || 0;
        const currentStack = startStack ? Math.max(startStack - alreadyIn, 1) : null;
        const _rawBetPct = (amount && currentStack) ? (amount / currentStack * 100) : null;
        const betPct = (_rawBetPct !== null && _rawBetPct <= 100) ? _rawBetPct : null;
        const potAfter = currentHand?.runningPot || 0;
        const potBefore = (amountForPot && potAfter > amountForPot) ? (potAfter - amountForPot) : 0;
        const potPct = (amountForPot && potBefore > 0) ? Math.round(amountForPot / potBefore * 100) : null;
        const szClassify = classifyBetSizing(amount, betPct, potPct);
        // Preflop: pot% is meaningless (pot = just the blinds). Show BB count only.
        const sz = street === 'preflop'
            ? (szClassify.bbLabel || null)
            : sizingLabel(potPct, betPct, amount);

        // Board texture
        const board = currentHand?.boardCards || [];
        const texture = board.length >= 3 ? analyzeBoardTexture(board) : null;
        const isRiver = street === 'river';

        // Multi-street narrative for this player this hand
        const aggHistory = currentHand?.aggressionHistory?.[playerName] || [];
        const aggStreets = aggHistory.map(h => h.street);
        const postAggStreets = aggStreets.filter(s => s !== 'preflop');
        const isMultiBarrel = postAggStreets.length >= 2;
        const isTripleBarrel = postAggStreets.length >= 3;
        // True when a player who previously bet/raised this hand now calls — potential slowplay
        const callAfterAgg = actionType === 'call' && aggHistory.length > 0;
        // True when this player called in at least one prior street this hand
        const STREET_ORDER_C = ['preflop', 'flop', 'turn', 'river'];
        const streetIdxC = STREET_ORDER_C.indexOf(street);
        const callsInPriorStreets = STREET_ORDER_C.slice(0, Math.max(streetIdxC, 0)).reduce(
            (n, s) => n + (streetLogs[s] || []).filter(a => a.playerName === playerName && a.actionType === 'call').length, 0
        );
        const isMultiStreetCaller = callsInPriorStreets >= 1;

        // Resolve player stats
        const all = getStats();
        const rawStats = resolveStatsByName(playerName, all);

        if (!rawStats) return buildMechanisticMessage(playerName, actionType, betPct, texture, potPct, amount, amountForPot, street);

        const activeStats = getActiveStats(rawStats, currentTableBB);
        const handsObserved = activeStats.handsObserved || 0;

        if (handsObserved < hudSettings.coachMinHands) {
            // Sub-threshold: mechanistic base + any early pattern we can see
            const mech = buildMechanisticMessage(playerName, actionType, betPct, texture, potPct, amount, amountForPot, street);
            const earlyDm = getDisplayMetrics(activeStats);
            if (!earlyDm || handsObserved < 2) return mech;

            const earlyParts = [];
            const earlyPush = (def, duke) => earlyParts.push(v(def, duke));
            if (mech) earlyParts.push(mech.text);

            // Even with 2-7 hands, early VPIP/PFR patterns are visible
            const earlyVpip = earlyDm.vpip;
            const earlyPfr = earlyDm.pfr;
            const earlyAfq = earlyDm.afqReliable ? earlyDm.afq : null;

            if (actionType === 'raise' || actionType === 'bet') {
                if (earlyPfr < 0.08)
                    earlyPush(
                        `Early read: ${playerName} has only raised ${Math.round(earlyPfr * 100)}% of hands so far — this is uncommon for them. (${handsObserved} hands)`,
                        `Early read: ${playerName} has only raised ${Math.round(earlyPfr * 100)}% of hands so far — tight for them. (${handsObserved} hands)`
                    );
                else if (earlyVpip > 0.60)
                    earlyPush(
                        `Early read: ${playerName} is playing ${Math.round(earlyVpip * 100)}% of hands — loose player, don't give this bet full credit yet. (${handsObserved} hands)`,
                        `Early read: ${playerName} is playing ${Math.round(earlyVpip * 100)}% of hands — loose, don't give this bet full respect yet. (${handsObserved} hands)`
                    );
                else if (earlyAfq !== null && earlyAfq < 0.15)
                    earlyPush(
                        `Early read: they're rarely aggressive so far — this bet is a deviation from what little we've seen. (${handsObserved} hands)`,
                        `Early read: they been quiet so far — this bet is a spike from what little we've seen. (${handsObserved} hands)`
                    );
                else
                    earlyPush(
                        `Early read: ${handsObserved} hands seen, VPIP ${Math.round(earlyVpip * 100)}%. Building a profile.`,
                        `Early read: ${handsObserved} hands seen, VPIP ${Math.round(earlyVpip * 100)}%. Building a file.`
                    );
            } else if (actionType === 'call') {
                if (earlyVpip > 0.65)
                    earlyPush(
                        `Early read: calling ${Math.round(earlyVpip * 100)}% of hands so far — looks like a loose caller. (${handsObserved} hands)`,
                        `Early read: calling ${Math.round(earlyVpip * 100)}% of hands so far — loose caller. (${handsObserved} hands)`
                    );
                else if (earlyVpip < 0.20)
                    earlyPush(
                        `Early read: very tight so far (${Math.round(earlyVpip * 100)}% VPIP) — their call means more than average. (${handsObserved} hands)`,
                        `Early read: very tight so far (${Math.round(earlyVpip * 100)}% VPIP) — their call means more than average. Keep your head. (${handsObserved} hands)`
                    );
            }

            if (earlyParts.length > (mech ? 1 : 0)) {
                return { text: earlyParts.join(' '), confidence: 'thin', isMath: false, handsObserved };
            }
            return mech;
        }

        const dm = getDisplayMetrics(activeStats);
        // Use the same classification source as the badge so coach advice matches what the user sees
        const cls = hudSettings.badgeMode === 'session'
            ? classifySession(rawStats)
            : classifyMetrics(dm, handsObserved);
        const typeKey = Object.keys(TYPES).find(k => TYPES[k] === cls.type) || 'UNKNOWN';
        const confidence = getCoachConfidence(handsObserved);
        const alerts = getLiveAlerts(rawStats);
        const isTilting = alerts.some(a => /tilt|looser/i.test(a.label));
        const isAggSpike = alerts.some(a => /aggression spike/i.test(a.label));

        // Verdict history
        const tv = rawStats.totalVerdicts || 0;
        const bluffRate = tv >= 5 ? (rawStats.bluffCount || 0) / tv : 0;
        const trapRate = tv >= 5 ? (rawStats.trapCount || 0) / tv : 0;
        const drawRate = tv >= 5 ? (rawStats.drawCount || 0) / tv : 0;
        const protRate = tv >= 5 ? (rawStats.protectionCount || 0) / tv : 0;
        const pos = currentHand?.perPlayer?.[playerName]?.position || null;
        const posStats = pos && activeStats.positions ? activeStats.positions[pos] : null;
        const posHands = posStats?.hands || 0;
        const posVpip = posHands > 0 ? posStats.vpip / posHands : null;
        const posPfr = posHands > 0 ? posStats.pfr / posHands : null;

        // Quiet mode guard
        if (hudSettings.mrCoachMode === 'quiet' && confidence !== 'solid') {
            const avgRaise = rawStats.raisePctSamples > 0 ? rawStats.raisePctSum / rawStats.raisePctSamples : null;
            const isDeviation = avgRaise && betPct !== null && (betPct > avgRaise * 2 || betPct < avgRaise * 0.4);
            if (!isTilting && !isDeviation) return null;
        }

        const parts = [];
        let decision = null; // synthesized action recommendation
        const push = (def, duke) => parts.push(v(def, duke));

        // ── FOLD branch — compact note instead of silence ─────────
        if (actionType === 'fold') {
            // Only emit a fold note when there's something useful to say
            const foldVsFlop = dm.foldVsFlopBet;
            const foldCtx = currentHand?.aggressionHistory?.[playerName]?.length > 0;
            if (foldCtx) {
                // They folded after having bet/raised earlier — gave up
                const lastAggStreet = currentHand.aggressionHistory[playerName].slice(-1)[0]?.street;
                return {
                    text: v(
                        `Gave up after betting ${lastAggStreet} — possible bluff caught or missed draw.`,
                        `Gave up after betting ${lastAggStreet} — bluff got sniffed out or a draw bricked.`
                    ), compact: true, confidence: null, isMath: true, handsObserved
                };
            }
            if (street === 'flop' && foldVsFlop !== null && foldVsFlop >= 0.65) {
                return {
                    text: v(
                        `Folded to flop pressure (folds to flop bets ${Math.round(foldVsFlop * 100)}% of the time — keep firing).`,
                        `Folded to flop heat (folds ${Math.round(foldVsFlop * 100)}% to flop bets — yous keep firin').`
                    ), compact: true, confidence: null, isMath: true, handsObserved
                };
            }
            return null; // routine fold: no output
        }

        // ── LOW-SIGNAL gate — compact one-liner for routine actions ──
        const highSignal = isHighSignal(actionType, betPct, street, typeKey, dm, isTilting, isAggSpike, currentHand?.aggressionHistory?.[playerName], isRiver);
        if (!highSignal) {
            // Build a one-line summary: prefer % of stack, fall back to dollar amount (not BB — inconsistent in cash view)
            const pctNote = betPct !== null
                ? ` — ${Math.round(betPct)}% of their stack`
                : (amount ? ` — $${amount.toLocaleString()}` : '');
            const limpNote = (actionType === 'call' && street === 'preflop' && (currentHand?.preflopRaiseCount || 0) === 0) ? ' (limped)' : '';
            const actionWord = actionType === 'call' ? 'called' : actionType === 'raise' ? 'raised' : actionType;
            return {
                text: v(
                    `${actionWord}${limpNote}${pctNote}`,
                    `${actionWord}${limpNote}${pctNote} — Duke clocked it.`
                ), compact: true, confidence: null, isMath: true, handsObserved
            };
        }

        // ── LIMP branch — preflop call with no prior raise ────────
        // Limping is a fundamentally different action from calling a raise; handle it first.
        if (actionType === 'call' && street === 'preflop' && (currentHand?.preflopRaiseCount || 0) === 0) {
            const limpRate = rawStats.limpCount && rawStats.handsObserved
                ? rawStats.limpCount / rawStats.handsObserved : null;
            if (typeKey === 'NIT' || typeKey === 'ROCK') {
                push(
                    `${playerName} limped — unusual for a ${cls.type.label.toLowerCase()}. They rarely enter pots without a raise. Either they have a speculative hand (small pair, suited connector) or they're slow-playing something strong.`,
                    `${playerName} limped — odd for a ${cls.type.label.toLowerCase()}. They don't step in without a raise. Either they're set-mining (small pair, suited connector) or slowplaying something big.`
                );
                if (trapRate > 0.10) push(
                    `Their ${Math.round(trapRate * 100)}% slowplay rate — lean toward the trap read.`,
                    `Slowplay rate ${Math.round(trapRate * 100)}% — smells like a trap.`
                );
            } else if (typeKey === 'MANIAC' || typeKey === 'LAG') {
                push(
                    `${playerName} limped — very unusual for a ${cls.type.label.toLowerCase()}. When an aggressive player doesn't raise preflop, they're often disguising a strong hand or on a very speculative holding. Be cautious.`,
                    `${playerName} limped — weird for a ${cls.type.label.toLowerCase()}. Aggro types who limp are either hiding a monster or splashing with junk. Be careful.`
                );
            } else if (limpRate !== null && limpRate > 0.25 && confidence !== 'thin') {
                push(
                    `${playerName} limped in again — they do this ${Math.round(limpRate * 100)}% of hands. Wide passive range: could be anything from a small pair to a suited connector to low cards. Not a strong hand signal.`,
                    `${playerName} limped in again — they do this ${Math.round(limpRate * 100)}% of hands. Range is a junk drawer: small pairs, suited connectors, low cards. Not a strong signal.`
                );
            } else {
                push(
                    `${playerName} limped in. No raise before them — range is wide and speculative. Small pairs, suited connectors, or just loose play.`,
                    `${playerName} limped in. No raise before them — range is wide and speculative. Small pairs, suited connectors, or just loose junk.`
                );
            }
            decision = null;
            return { text: parts.join(' '), confidence, isMath: false, handsObserved };
        }

        // ── CHECK branch ──────────────────────────────────────────
        if (actionType === 'check') {
            const raisedPreflop = currentHand?.perPlayer?.[playerName]?.raisedPreflop || false;
            const prevAggStreets = aggStreets.filter(s => s !== street); // streets they already bet
            const hasPrevAgg = prevAggStreets.length > 0;

            // 1. Preflop raiser checking flop — missed cbet is a huge tell
            if (street === 'flop' && raisedPreflop) {
                if (typeKey === 'MANIAC' || typeKey === 'LAG' || (dm.afqReliable && dm.afq > 0.50)) {
                    push(
                        `${playerName} raised preflop but skipped the cbet — very unusual for an aggressive player (AFq ${Math.round(dm.afq * 100)}%).`,
                        `${playerName} raised preflop then skipped the c-bet — real odd for an aggressive type (AFq ${Math.round(dm.afq * 100)}%).`
                    );
                    if (trapRate > 0.12) push(
                        `Their ${Math.round(trapRate * 100)}% slowplay rate makes this suspicious — could be a trap. Don't auto-bet.`,
                        `${Math.round(trapRate * 100)}% slowplay rate — could be a trap. Don't auto-bet into the boss.`
                    );
                    else push(
                        `They likely missed this board completely. Consider betting if you have any piece.`,
                        `They likely whiffed this board. If you got any piece, take a stab.`
                    );
                    decision = 'context_dependent';
                } else if (typeKey === 'TAG') {
                    push(
                        `Sharp player raised preflop and checked the flop. TAGs only skip cbets when the board misses their range badly or they're slowplaying a monster. Proceed carefully.`,
                        `Sharp player raised preflop and checked the flop. TAGs skip cbets only when they whiff hard or they're slowplaying a monster. Proceed careful, kid.`
                    );
                    decision = 'context_dependent';
                } else if (typeKey === 'NIT' || typeKey === 'ROCK') {
                    push(
                        `${playerName} raised preflop and checked the flop. Tight players who skip cbets either missed badly or flopped a monster and want action. The check is a polarized signal.`,
                        `${playerName} raised preflop and checked the flop. Tight players who skip cbets either whiffed or flopped a monster and want action. That check is polarized.`
                    );
                    if (trapRate > 0.10) push(
                        `Their ${Math.round(trapRate * 100)}% slowplay rate — lean toward trap.`,
                        `Slowplay rate ${Math.round(trapRate * 100)}% — lean trap.`
                    );
                    decision = 'context_dependent';
                } else {
                    push(
                        `${playerName} raised preflop but checked the flop. Preflop raisers who skip the cbet usually missed this board. Could be a spot to take the pot.`,
                        `${playerName} raised preflop but checked the flop. Preflop raisers who skip the c-bet usually missed. Could be a spot to snatch the pot.`
                    );
                    decision = 'context_dependent';
                }
            }

            // 2. Player who was betting previous streets suddenly checks (multi-street then check)
            else if (hasPrevAgg) {
                push(
                    `${playerName} was betting ${prevAggStreets.join(' and ')} but just checked the ${street}.`,
                    `${playerName} was firing ${prevAggStreets.join(' and ')} then checked the ${street}.`
                );
                if (typeKey === 'MANIAC' || typeKey === 'LAG') {
                    if (street === 'river') {
                        push(
                            `Aggressive player stopping on the river — this is either a missed bluff (they were bluffing and gave up) or they have a made hand and want you to bet into them. Trap is a real possibility.`,
                            `Aggressive player stopping on the river — either a bluff died or they got a made hand and want you to bet into it. Trap is real.`
                        );
                        if (trapRate > 0.12) push(
                            `Their ${Math.round(trapRate * 100)}% slowplay rate makes the trap read more likely. Proceed carefully.`,
                            `Slowplay rate ${Math.round(trapRate * 100)}% makes the trap read more likely. Tread careful.`
                        );
                    } else {
                        push(
                            `Even maniacs don't check without reason. They may have hit a wall on this board, or they're slowing down with a big hand to trap. Not a safe spot to bluff.`,
                            `Even maniacs don't check for no reason. They hit a wall, or they're slowing down with a big hand to trap. Not a safe bluff spot.`
                        );
                    }
                    decision = 'context_dependent';
                } else if (typeKey === 'TAG') {
                    if (street === 'river') {
                        push(
                            `Sharp player who was betting earlier checked the river. TAGs don't give up easily — this is more likely a trap or a marginal hand inviting a bluff. A value bet may get called, a bluff may get check-raised.`,
                            `Sharp player who was firing earlier checked the river. TAGs don't quit easy — this is more likely a trap or a marginal hand fishing for a bluff. Value bet may get called, bluff may get check-raised.`
                        );
                        if (trapRate > 0.10) push(
                            `${Math.round(trapRate * 100)}% slowplay rate — lean toward trap.`,
                            `Slowplay rate ${Math.round(trapRate * 100)}% — lean trap.`
                        );
                    } else {
                        push(
                            `A TAG stopping their barrel usually means this street missed their range or they're pot-controlling. A well-timed bet here may take the pot.`,
                            `A TAG stopping their barrel usually means this street missed their range or they're pot-controlling. A well-timed bet can take the pot.`
                        );
                    }
                    decision = 'context_dependent';
                } else {
                    if (street === 'river') {
                        const afqPrefix = handsObserved > 15 ? `With ${Math.round(dm.afq * 100)}% AFq, ` : '';
                        const afqPrefixDuke = handsObserved > 15 ? `AFq ${Math.round(dm.afq * 100)}% — ` : '';
                        push(
                            `${afqPrefix}stopping the aggression on the river means weakness or a trap. If you have a made hand, bet — they either have nothing or they'll call with medium strength.`,
                            `${afqPrefixDuke}shutting down on the river means weakness or a trap. If you got a made hand, bet — they either got nothing or they'll call with medium strength.`
                        );
                    } else {
                        const afqPrefix = handsObserved > 15 ? `With ${Math.round(dm.afq * 100)}% AFq, ` : '';
                        const afqPrefixDuke = handsObserved > 15 ? `AFq ${Math.round(dm.afq * 100)}% — ` : '';
                        push(
                            `${afqPrefix}stopping the aggression here usually means weakness. Consider a bet if you have something.`,
                            `${afqPrefixDuke}shutting down here usually means weakness. Consider a bet if you got anything.`
                        );
                    }
                    decision = 'context_dependent';
                }
            }

            // 3. Aggressive player checking (no prior aggression this hand)
            else if (dm.afqReliable && dm.afq > 0.55 && confidence !== 'thin') {
                if (typeKey === 'MANIAC') {
                    push(
                        `${playerName} is a Maniac (AFq ${Math.round(dm.afq * 100)}%) who checked. Maniacs almost never check — this board completely missed them or they're setting up a massive trap.`,
                        `${playerName} is a Maniac (AFq ${Math.round(dm.afq * 100)}%) who checked. Maniacs don't check unless they whiffed or they're setting a big trap.`
                    );
                    decision = 'context_dependent';
                } else {
                    push(
                        `${playerName} has AFq ${Math.round(dm.afq * 100)}% — they usually bet when they have something. This check is a deviation.`,
                        `${playerName} has AFq ${Math.round(dm.afq * 100)}% — they usually fire when they got something. This check is a deviation.`
                    );
                    if (trapRate > 0.12) push(
                        `${Math.round(trapRate * 100)}% slowplay history — lean toward trap. Don't blindly fire into them.`,
                        `Slowplay history ${Math.round(trapRate * 100)}% — lean trap. Don't blindly fire into them.`
                    );
                    else if (street === 'river') push(
                        `On the river, an aggressive player checking means they either have nothing worth betting or they're inviting a bluff. Bet only if you have a real hand — don't turn a bluff-catcher into a bluff.`,
                        `On the river, an aggressive check means either air or a trap. Bet only with a real hand — don't turn a bluff-catcher into a bluff.`
                    );
                    else push(
                        `Likely missed the board. You have the initiative — bet if you have any hand or equity.`,
                        `Likely missed the board. You got the initiative — bet if you got any piece.`
                    );
                    decision = 'context_dependent';
                }
            }

            // 4. NIT/ROCK/TIGHT_PASSIVE checking
            else if (typeKey === 'NIT' || typeKey === 'ROCK' || typeKey === 'TIGHT_PASSIVE') {
                if (street === 'river') {
                    push(
                        `${playerName} is tight and checked the river. Tight players checking rivers either have nothing or they're slowplaying a monster they want to show at showdown. Their ${Math.round(dm.wtsd * 100)}% WTSD says ${dm.wtsd > 0.35 ? 'they usually stick around — could be a trap' : 'they often fold when they miss — this may be weakness'}.`,
                        `${playerName} is tight and checked the river. Tight players checking rivers either got nothing or they're slowplaying a monster. Their ${Math.round(dm.wtsd * 100)}% WTSD says ${dm.wtsd > 0.35 ? 'they usually stick around — could be a trap' : 'they often fold when they miss — this may be weakness'}.`
                    );
                } else {
                    push(
                        `${playerName} is ${cls.type.label.toLowerCase()} and checked. Tight players check when they miss — and they enter pots so rarely that a check here usually means a weak board hit. Bet if you have anything.`,
                        `${playerName} is ${cls.type.label.toLowerCase()} and checked. Tight players check when they miss — and they enter pots so rarely that a check here usually means a weak board hit. Bet if you got anything.`
                    );
                }
                decision = 'context_dependent';
            }

            // 5. Calling station / Fish checking
            else if (typeKey === 'CALLING_STATION' || typeKey === 'FISH') {
                push(
                    `${playerName} is a ${cls.type.label.toLowerCase()} who checked. Calling stations don't bluff-check often — they're usually just weak here. If you bet, they'll call with any piece, so only bet if you have value.`,
                    `${playerName} is a ${cls.type.label.toLowerCase()} who checked. Calling stations don't bluff-check much — they're usually weak here. If you bet, they'll call with any piece, so only bet for value.`
                );
                decision = 'context_dependent';
            }

            // 6. High WTSD player checking river
            else if (street === 'river' && dm.wtsdReliable && dm.wtsd > 0.45 && confidence !== 'thin') {
                push(
                    `${playerName} goes to showdown ${Math.round(dm.wtsd * 100)}% of the time and checked the river. They will call a bet here — don't bluff. Bet only for value.`,
                    `${playerName} goes to showdown ${Math.round(dm.wtsd * 100)}% of the time and checked the river. They will call a bet here — don't bluff. Value only.`
                );
                decision = 'context_dependent';
            }

            // 7. Passive player — normal check, still informative
            else if (dm.afqReliable && dm.afq < 0.22 && confidence !== 'thin') {
                push(
                    `${playerName} is passive (AFq ${Math.round(dm.afq * 100)}%) — checking is their default. They have something but are waiting. Bet for value if you're ahead; don't expect them to fold much.`,
                    `${playerName} is passive (AFq ${Math.round(dm.afq * 100)}%) — checking is their default. They got something and they're waiting. Bet for value if you're ahead; don't expect them to fold, kid.`
                );
                decision = 'context_dependent';
            }

            // 8. General fallback — always say something with the stats we have
            else {
                const afqStr = dm.afqReliable ? ` AFq ${Math.round(dm.afq * 100)}%.` : '';
                const vpipStr = `VPIP ${Math.round(dm.vpip * 100)}%.`;
                if (typeKey === 'MIXED' || typeKey === 'UNKNOWN') {
                    push(
                        `${playerName} checked.${afqStr} ${vpipStr} Not enough pattern to read this check definitively — play your hand, not theirs.`,
                        `${playerName} checked.${afqStr} ${vpipStr} Not enough pattern to read this check — play your cards, not their story.`
                    );
                } else {
                    push(
                        `${playerName} (${cls.type.label}) checked.${afqStr} With their profile, a check here is${dm.afq > 0.40 ? ' a deviation — likely weakness or a trap' : ' consistent — they check a lot'}.`,
                        `${playerName} (${cls.type.label}) checked.${afqStr} With their profile, a check here is${dm.afq > 0.40 ? ' a deviation — likely weakness or a trap' : ' consistent — they check a lot'}. Keep your guard up.`
                    );
                    decision = 'context_dependent';
                }
            }

            const tag = decision ? ` ${actionTag(decision)}` : '';
            return { text: parts.join(' ') + tag, confidence, isMath: false, handsObserved };
        }

        // ── BADGE-SPECIFIC CORE INSIGHT ───────────────────────────
        // Each badge type gets its own logic tree, not just a label.

        if (typeKey === 'FISH' || typeKey === 'CALLING_STATION' || typeKey === 'LOOSE_PASSIVE') {
            if (actionType === 'raise' || actionType === 'bet') {
                if (confidence !== 'thin') {
                    push(
                        `${playerName} is a ${cls.type.label.toLowerCase()} — they almost never bet or raise. Aggression from them is a real hand, not a bluff.`,
                        `${playerName} is a ${cls.type.label.toLowerCase()} — they almost never fire. When they do, it's the goods. Don't get cute, kid.`
                    );
                    if (street === 'river')
                        push(
                            `On the river especially, passive players only bet when they've made something. This is a value bet.`,
                            `On the river, passive players only bet when they've made something. That's pure value. Don't hero-call, kid.`
                        );
                    decision = 'fold';
                } else {
                    push(
                        `Low sample but their profile leans passive. Aggression from passive players tends to mean strength.`,
                        `Low sample but they look passive. When they fire, it usually means strength. Don't get stubborn, kid.`
                    );
                    decision = 'fold';
                }
            } else if (actionType === 'call') {
                if (typeKey === 'CALLING_STATION' || typeKey === 'FISH') {
                    push(
                        `${playerName} is a ${cls.type.label.toLowerCase()} — this call tells you nothing. Their hand range is still as wide as preflop. Do NOT bluff them. They call stations down to the river.`,
                        `${playerName} is a ${cls.type.label.toLowerCase()} — this call tells you nothing. Range still wide as preflop. Do NOT bluff them. They'll call you down to the river, kid.`
                    );
                } else {
                    push(
                        `${playerName} is passive and called. They're still on a wide range. Bluffing them is low-value.`,
                        `${playerName} is passive and called. Range is still wide. Bluffing them is lighting money on fire, kid.`
                    );
                }
                decision = null; // calling is their action, not ours
            }

        } else if (typeKey === 'NIT' || typeKey === 'ROCK') {
            if (actionType === 'raise' || actionType === 'bet') {
                if (street === 'preflop') {
                    push(
                        `${playerName} is a ${cls.type.label.toLowerCase()} raising preflop (${Math.round(dm.pfr * 100)}% PFR over ${handsObserved} hands). Their range is surgical — AA, KK, QQ, AK, maybe JJ or AQs. Unless you have a premium, this is a fold.`,
                        `${playerName} is a ${cls.type.label.toLowerCase()} raising preflop (${Math.round(dm.pfr * 100)}% PFR over ${handsObserved} hands). Range is surgical — AA, KK, QQ, AK, maybe JJ or AQs. Unless you got a premium, you fold.`
                    );
                    decision = confidence !== 'thin' ? 'fold' : 'context_dependent';
                } else if (isMultiBarrel) {
                    push(
                        `${playerName} has been betting ${postAggStreets.join(' and ')} — multiple streets of aggression from a ${cls.type.label.toLowerCase()}. This is an extremely narrow value range. They are not bluffing.`,
                        `${playerName} has been firin' ${postAggStreets.join(' and ')} — that's multiple streets from a ${cls.type.label.toLowerCase()}. Razor-narrow value range. They ain't bluffing. Duke's seen this a thousand times.`
                    );
                    decision = 'fold';
                } else if (street === 'river') {
                    push(
                        `${playerName} is a ${cls.type.label.toLowerCase()} betting the river. There are no draws left to protect against — a tight player betting here has a made hand, period. Sets, two pair, or strong top pair. Fold unless you have something equivalent or better.`,
                        `${playerName} is a ${cls.type.label.toLowerCase()} betting the river. Ain't no draws left to hide behind — tight player firin' here has got a made hand, period. Sets, two pair, or strong top pair. Fold unless yous got something that beats that.`
                    );
                    decision = 'fold';
                } else {
                    push(
                        `${playerName} is a ${cls.type.label.toLowerCase()} betting postflop. Their betting range is very narrow — sets, two pair, or top pair top kicker at minimum. Believe them.`,
                        `${playerName} is a ${cls.type.label.toLowerCase()} betting postflop. Range is tight — sets, two pair, or top pair top kicker at minimum. Believe them.`
                    );
                    decision = confidence !== 'thin' ? 'fold' : 'context_dependent';
                }
            } else if (actionType === 'call') {
                if (callAfterAgg) {
                    const lastAggStreet = aggHistory[aggHistory.length - 1]?.street;
                    push(
                        `${playerName} bet ${lastAggStreet} but is calling now — tight players don't slow-play often, but when they do it's a monster. Treat this with serious respect.`,
                        `${playerName} bet ${lastAggStreet} but is calling now — tight players don't slow-play often, but when they do it's a monster. Treat this with respect.`
                    );
                } else if (street === 'river') {
                    push(
                        `${playerName} called on the river. Tight players don't call rivers without a made hand — top pair or better. There are no draws to chase anymore.`,
                        `${playerName} called on the river. Tight players don't call rivers without a made hand — top pair or better. No draws left.`
                    );
                } else {
                    const multiNote = isMultiStreetCaller ? ` They have called multiple streets — their range is narrowing fast. Expect a real hand.` : '';
                    push(
                        `${playerName} called. Tight players don't call without decent equity. They have a real hand — top pair or a strong draw.${multiNote}`,
                        `${playerName} called. Tight players don't call without equity. They got a real hand — top pair or a strong draw.${multiNote}`
                    );
                }
            }

        } else if (typeKey === 'MANIAC' || typeKey === 'LAG') {
            if (actionType === 'raise' || actionType === 'bet') {
                const bluffMsg = bluffRate > 0.20 && confidence !== 'thin'
                    ? ` Their showdown history shows ${Math.round(bluffRate * 100)}% bluff rate.` : '';
                const bluffMsgDuke = bluffRate > 0.20 && confidence !== 'thin'
                    ? ` History says ${Math.round(bluffRate * 100)}% bluff rate.` : '';

                if (isTripleBarrel) {
                    // River triple barrel — even maniacs have real hands here sometimes
                    push(
                        `${playerName} has barreled every street including the river.${bluffMsg} Even maniacs narrow their range over three streets — but their bluff frequency stays high. Call with any pair or better unless you have a clear reason to fold.`,
                        `${playerName} has barreled every street including the river.${bluffMsgDuke} Even maniacs tighten up over three streets, but they still bluff plenty. Call with any pair or better unless you got a clear reason to fold.`
                    );
                    decision = 'call';
                } else if (street === 'river') {
                    // Single river bet from a maniac — last chance to bluff
                    if (sz) push(
                        `${playerName} is a ${cls.type.label.toLowerCase()} betting ${sz} on the river.${bluffMsg} This is exactly when they bluff — no more cards, last chance to push you off. Unless you're drawing dead, a call is usually right.`,
                        `${playerName} is a ${cls.type.label.toLowerCase()} betting ${sz} on the river.${bluffMsgDuke} This is their last shot to bluff — no cards left. Unless you're dead, a call is usually right.`
                    );
                    else push(
                        `${playerName} is a ${cls.type.label.toLowerCase()} firing on the river.${bluffMsg} River bets from maniacs are weighted toward bluffs — they can't win at showdown, so they have to bet.`,
                        `${playerName} is a ${cls.type.label.toLowerCase()} firing on the river.${bluffMsgDuke} River bets from maniacs skew bluff — they can't win at showdown, so they gotta bet.`
                    );
                    decision = bluffRate > 0.20 ? 'call' : 'context_dependent';
                } else {
                    if (sz) push(
                        `${playerName} is a ${cls.type.label.toLowerCase()} betting ${sz}.${bluffMsg} Do not auto-fold — this sizing means nothing on its own.`,
                        `${playerName} is a ${cls.type.label.toLowerCase()} betting ${sz}.${bluffMsgDuke} Don't auto-fold — this sizing means nothing on its own.`
                    );
                    else push(
                        `${playerName} is a ${cls.type.label.toLowerCase()}.${bluffMsg} Their aggression does not mean strength.`,
                        `${playerName} is a ${cls.type.label.toLowerCase()}.${bluffMsgDuke} They think they're the biggest shark in the room. Their aggression doesn't mean strength.`
                    );
                    if (bluffRate > 0.25) {
                        push(
                            `With a ${Math.round(bluffRate * 100)}% bluff rate, calling down with medium-strength hands is profitable against them.`,
                            `With a ${Math.round(bluffRate * 100)}% bluff rate, calling down with medium hands pays against them.`
                        );
                        decision = 'call';
                    } else {
                        decision = 'context_dependent';
                    }
                }
            } else if (actionType === 'call') {
                const bluffNote = bluffRate > 0.20 && confidence !== 'thin'
                    ? ` Their ${Math.round(bluffRate * 100)}% bluff rate means they're capable of calling now and firing a bluff on a later street — stay alert.`
                    : '';
                const bluffNoteDuke = bluffRate > 0.20 && confidence !== 'thin'
                    ? ` Their ${Math.round(bluffRate * 100)}% bluff rate means they can call now and fire later — stay sharp.`
                    : '';
                if (isMultiBarrel) {
                    push(
                        `${playerName} has been aggressive this hand but just called. They may have cooled off — could be a draw or a trap.${bluffNote}`,
                        `${playerName} has been aggressive this hand but just called. They may have cooled off — could be a draw or a trap.${bluffNoteDuke}`
                    );
                } else if (street === 'river') {
                    const multiNote = isMultiStreetCaller ? ` They have called every street — narrowing toward a real hand, not a missed draw.` : '';
                    push(
                        `${playerName} calling on the river instead of raising — for a ${cls.type.label.toLowerCase()}, this usually means a medium made hand, not a monster. They'd raise with the nuts.${multiNote}${bluffNote}`,
                        `${playerName} calling on the river instead of raising — for a ${cls.type.label.toLowerCase()}, this usually means a medium made hand, not a monster. They'd raise with the nuts.${multiNote}${bluffNoteDuke}`
                    );
                } else {
                    const multiNote = isMultiStreetCaller ? ` Multi-street calling narrows their range — less likely a pure float at this point.` : '';
                    push(
                        `${playerName} is a ${cls.type.label.toLowerCase()} and called instead of raising. Likely floating (planning to bluff later), on a draw, or slow-playing.${multiNote}${bluffNote}`,
                        `${playerName} is a ${cls.type.label.toLowerCase()} and called instead of raising. Likely floating (planning to bluff later), on a draw, or slow-playing.${multiNote}${bluffNoteDuke}`
                    );
                }
                decision = null;
            }

        } else if (typeKey === 'TAG') {
            if (actionType === 'raise' || actionType === 'bet') {
                if (isMultiBarrel) {
                    push(
                        `${playerName} is a Sharp (tight-aggressive) player who has bet ${postAggStreets.join(' and ')}. Multi-street aggression from a TAG is a strong value range — top pair top kicker or better.`,
                        `${playerName} is a Sharp (tight-aggressive) player who has bet ${postAggStreets.join(' and ')}. Multi-street aggression from a TAG is strong value — top pair top kicker or better.`
                    );
                    decision = 'fold';
                } else if (street === 'preflop') {
                    push(
                        `${playerName} is Sharp — they pick their spots. A preflop raise from them is a solid hand. Respect it.`,
                        `${playerName} is Sharp — they pick their spots. A preflop raise from them is a solid hand. Respect it, kid.`
                    );
                    decision = 'context_dependent';
                } else if (street === 'river') {
                    push(
                        `Sharp player betting the river. TAGs don't bluff rivers without a reason — when they fire here they usually have it made. Don't make a hero call without a read.`,
                        `Sharp player betting the river. TAGs don't bluff rivers without a reason — when they fire here they usually have it made. Don't go playing hero without a read.`
                    );
                    decision = 'fold';
                } else {
                    push(
                        `Sharp player betting — they pick their spots, so when they fire it usually connects with this board. Don't make a move here without a strong hand or a good read.`,
                        `Sharp player betting — they pick their spots, so when they fire it usually connects with this board. Don't make a move here without a real hand or a good read.`
                    );
                    decision = 'context_dependent';
                }
            } else if (actionType === 'call') {
                if (callAfterAgg) {
                    const lastAggStreet = aggHistory[aggHistory.length - 1]?.street;
                    push(
                        `${playerName} (Sharp) bet ${lastAggStreet} and is now calling — TAGs don't slow-play often but when they do, it's usually the nuts. High trap probability.`,
                        `${playerName} (Sharp) bet ${lastAggStreet} and is now calling — TAGs don't slow-play often but when they do, it's usually the nuts. High trap risk.`
                    );
                    decision = 'context_dependent';
                } else if (street === 'river') {
                    if (trapRate > 0.12 && confidence !== 'thin') {
                        push(
                            `${playerName} (Sharp) called the river with a ${Math.round(trapRate * 100)}% slowplay rate — this could be a trap. They called instead of raising, which means a mid-strength made hand or a slow-rolled monster.`,
                            `${playerName} (Sharp) called the river with a ${Math.round(trapRate * 100)}% slowplay rate — could be a trap. They called instead of raising, which means a mid-strength made hand or a slow-rolled monster.`
                        );
                    } else {
                        push(
                            `Sharp player calling the river. They believe they have the best hand — there are no more draws, no more cards. They have a real hand.`,
                            `Sharp player calling the river. They believe they got the best hand — no more draws, no more cards. Real hand.`
                        );
                    }
                    decision = 'context_dependent';
                } else if (trapRate > 0.12 && confidence !== 'thin') {
                    const multiNote = isMultiStreetCaller ? ` Multi-street calling from a TAG is extremely narrow — they're building a pot on purpose.` : '';
                    push(
                        `${playerName} is a Sharp player with a ${Math.round(trapRate * 100)}% slowplay rate. A flat call from them could be a trap.${multiNote}`,
                        `${playerName} is a Sharp player with a ${Math.round(trapRate * 100)}% slowplay rate. A flat call from them could be a trap.${multiNote} Stay sharp.`
                    );
                    decision = 'context_dependent';
                } else {
                    const multiNote = isMultiStreetCaller ? ` They have called multiple streets — range is strong.` : '';
                    push(
                        `Sharp player calling — they have the equity or a strong hand. Don't bluff into them.${multiNote}`,
                        `Sharp player calling — they got the equity or a strong hand. Don't bluff into them.${multiNote}`
                    );
                }
            }

        } else if (typeKey === 'TIGHT_PASSIVE') {
            if (actionType === 'raise' || actionType === 'bet') {
                push(
                    `${playerName} is Cautious — they almost never bet without a real hand. This bet is a strong signal.${sz ? ` Bet size: ${sz}.` : ''}`,
                    `${playerName} is Cautious — they almost never bet without a real hand. This bet is a strong signal. Respect it, kid.${sz ? ` Bet size: ${sz}.` : ''}`
                );
                if (street === 'river') {
                    push(
                        `On the river there are no draws left to bet — a tight player betting here has a made hand. This is not a bluff.`,
                        `On the river there are no draws left — a tight player betting here has a made hand. This is not a bluff, kid.`
                    );
                } else if (street !== 'preflop') {
                    push(
                        `Tight-passive players rarely bluff postflop. Take this seriously.`,
                        `Tight-passive players rarely bluff postflop. Take this seriously, kid.`
                    );
                }
                decision = confidence !== 'thin' ? 'fold' : 'context_dependent';
            } else if (actionType === 'call') {
                if (callAfterAgg) {
                    const lastAggStreet = aggHistory[aggHistory.length - 1]?.street;
                    push(
                        `${playerName} bet ${lastAggStreet} and now called — this combination from a cautious player is unusually strong. They rarely slowplay, so this is likely a monster or a hand they're unsure how to size.`,
                        `${playerName} bet ${lastAggStreet} and now called — from a cautious player that's unusually strong. They rarely slowplay, so it's a monster or a hand they're unsure how to size, kid.`
                    );
                } else if (street === 'river') {
                    push(
                        `${playerName} called the river. Cautious players don't call rivers without a made hand — they have you beat or are very confident in their hand.`,
                        `${playerName} called the river. Cautious players don't call rivers without a made hand — they have you beat or they're very confident, kid.`
                    );
                } else {
                    const multiNote = isMultiStreetCaller ? ` Multi-street calling from a cautious player is a very strong signal — they're not chasing; they have something.` : '';
                    push(
                        `${playerName} called. Cautious players call with decent hands, not draws. They have something.${multiNote}`,
                        `${playerName} called. Cautious players call with decent hands, not draws. They got something, kid.${multiNote}`
                    );
                }
            }

        } else {
            // MIXED / UNKNOWN — fall back to stat-based reads
            if (actionType === 'raise' || actionType === 'bet') {
                // Tilt takes priority
                if (isTilting) {
                    push(
                        confidence === 'thin'
                            ? `${playerName} may be playing emotionally. Not enough data to say for sure.`
                            : `${playerName} is playing looser than their baseline. This aggression could be frustration rather than a real hand.`,
                        confidence === 'thin'
                            ? `${playerName} may be steaming. Not enough hands to say for sure.`
                            : `${playerName} is steaming — playing loose and sloppy compared to their usual game. This aggression could be tilt money, not a real hand.`
                    );
                    decision = 'call';
                } else if (isAggSpike) {
                    push(
                        `${playerName} has been firing much more than usual lately. Could be running well or bullying — watch for a spot to push back.`,
                        `${playerName} has been firing more than usual. Running hot or pushin\' people around — yous watch for a spot to push back.`
                    );
                    decision = 'context_dependent';
                } else if (dm.afq < 0.25 && betPct !== null && betPct >= 40 && confidence !== 'thin') {
                    push(
                        `${playerName} is normally passive and this is a big bet from them. Passive players don't go large without something strong.`,
                        `${playerName} is normally passive and this is a big bet from them. Passive players don't go large without something strong, kid.`
                    );
                    decision = 'fold';
                } else if (dm.afq > 0.65 && betPct !== null && betPct < 10 && confidence !== 'thin') {
                    push(
                        `${playerName} usually bets big but this is tiny. Could be a blocker or a slowplay — don't be spooked by the small size.`,
                        `${playerName} usually bets big but this is tiny. Could be a blocker or a slowplay — don't get spooked by the small size.`
                    );
                    decision = 'call';
                } else if (street === 'river' && dm.wtsdReliable && dm.wtsd > 0.45 && confidence !== 'thin') {
                    push(
                        `${playerName} goes to showdown ${Math.round(dm.wtsd * 100)}% of the time. River bets from showdown-heavy players are usually value, not air.`,
                        `${playerName} goes to showdown ${Math.round(dm.wtsd * 100)}% of the time. River bets from showdown-heavy players are usually value, not air. Don't pay it off light.`
                    );
                    decision = 'fold';
                } else if (isMultiBarrel) {
                    push(
                        `${playerName} has been betting ${postAggStreets.join(' and ')}. Multi-street aggression narrows their range — this is more likely a strong hand than a bluff.`,
                        `${playerName} has been betting ${postAggStreets.join(' and ')} — multi-street heat narrows their range fast. Duke reads this as value, not air.`
                    );
                    decision = confidence !== 'thin' ? 'fold' : 'context_dependent';
                } else if ((street === 'preflop' && dm.pfr < 0.10) || (street !== 'preflop' && dm.pfr < 0.12)) {
                    const ctx = street === 'preflop' ? 'preflop' : 'postflop';
                    push(
                        confidence === 'thin'
                            ? `They rarely raise — this is worth paying attention to.`
                            : `${playerName} has a ${Math.round(dm.pfr * 100)}% PFR — they almost never raise ${ctx}. When they do, their range is narrow. Believe it.`,
                        confidence === 'thin'
                            ? `They rarely raise — pay attention to this.`
                            : `${playerName} has a ${Math.round(dm.pfr * 100)}% PFR — they almost never raise ${ctx}. When they do, range is narrow. Believe it.`
                    );
                    decision = 'fold';
                } else if (sz) {
                    if (street === 'preflop') {
                        push(
                            `${playerName} raised ${sz} preflop. Sizing alone tells little here — what matters is their PFR and position.`,
                            `${playerName} raised ${sz} preflop. Sizing alone tells little — PFR and position matter.`
                        );
                    } else if (szClassify.pressure === 'minimal' || szClassify.pressure === 'low') {
                        push(
                            `Small probe (${sz}) — testing who has a piece of this board.`,
                            `Small probe (${sz}) — testing who has a piece of this board. See who flinches.`
                        );
                    } else if (szClassify.pressure === 'stack-off') {
                        push(
                            `Overbet (${sz}). Maximum pressure — either a strong hand or a committed bluff.`,
                            `Overbet (${sz}). That's maximum heat — either they got it or they're all-in on the bluff. No middle ground.`
                        );
                    } else {
                        push(
                            `Bet: ${sz}.`,
                            `Bet: ${sz}. Nothing special about the size — read their profile.`
                        );
                    }
                    decision = 'context_dependent';
                }
            } else if (actionType === 'call') {
                if (callAfterAgg) {
                    const lastAggStreet = aggHistory[aggHistory.length - 1]?.street;
                    push(
                        `${playerName} bet ${lastAggStreet} but just called. Possible slowplay — calling after aggression often means they've hit their hand and are letting you catch up.`,
                        `${playerName} bet ${lastAggStreet} but just called. Possible slowplay — calling after aggression often means they hit and are letting you catch up.`
                    );
                } else if (isMultiStreetCaller && street !== 'preflop') {
                    push(
                        `${playerName} has called multiple streets. Draws become less likely — leaning toward a made hand willing to go to showdown.`,
                        `${playerName} has called multiple streets. Draws become less likely — leaning toward a made hand that wants showdown.`
                    );
                } else if (dm.vpip > 0.50 && dm.gap > 0.25 && confidence !== 'thin') {
                    push(
                        `${playerName} calls wide (${Math.round(dm.vpip * 100)}% VPIP, ${Math.round(dm.gap * 100)}% gap). This call tells you little about their hand — still a wide range.`,
                        `${playerName} calls wide (${Math.round(dm.vpip * 100)}% VPIP, ${Math.round(dm.gap * 100)}% gap). This call tells you little — still a wide range.`
                    );
                } else if (drawRate > 0.20 && texture && (texture.isFlushy || texture.straightConnected)) {
                    push(
                        `${playerName} chases draws (${Math.round(drawRate * 100)}% draw rate). This board is coordinated — their call could be a draw.`,
                        `${playerName} chases draws (${Math.round(drawRate * 100)}% draw rate). Board is coordinated — their call could be a draw.`
                    );
                } else if (dm.vpipReliable && dm.vpip < 0.30 && confidence !== 'thin') {
                    // Selective player calling — meaningful signal
                    push(
                        `${playerName} is selective (${Math.round(dm.vpip * 100)}% VPIP) — when they call, they usually have something real. Top pair, strong draw, or better.`,
                        `${playerName} is selective (${Math.round(dm.vpip * 100)}% VPIP) — when they call, they usually got something real. Top pair, strong draw, or better.`
                    );
                    decision = 'context_dependent';
                } else if (dm.vpipReliable) {
                    // Generic stats-based fallback
                    const afqStr = dm.afqReliable ? `, AFq ${Math.round(dm.afq * 100)}%` : '';
                    const widthRead = dm.vpip > 0.45
                        ? `Wide player — this call barely narrows their range. They can have almost anything.`
                        : `Moderate player — their call suggests a real hand or draw, not pure speculation.`;
                    push(
                        `${playerName} called. (${Math.round(dm.vpip * 100)}% VPIP${afqStr}) ${widthRead}`,
                        `${playerName} called. (${Math.round(dm.vpip * 100)}% VPIP${afqStr}) ${widthRead} File that.`
                    );
                } else {
                    push(
                        `${playerName} called. Not enough data yet to read their range.`,
                        `${playerName} called. Not enough data yet to read their range — need more hands.`
                    );
                }
            }
        }

        // ── VERDICT ADDITIONS (non-exclusive, append after core insight) ──
        if (parts.length && confidence !== 'thin') {
            // Tilt / aggression spike — fires for ALL badge types
            if (isTilting && !parts.some(p => p.includes('tilt') || p.includes('looser'))) {
                push(
                    `Live alert: ${playerName} is playing noticeably looser than their usual baseline right now — possible tilt. Their range is wider than their badge suggests.`,
                    `Live alert: ${playerName} is playin\' loose and sloppy right now — possible tilt. Don't trust their badge, their range is wider than it shows.`
                );
                if (decision === 'fold') decision = 'context_dependent';
            } else if (isAggSpike && !parts.some(p => p.includes('aggression spike') || p.includes('more than usual') || p.includes('more active'))) {
                push(
                    `Live alert: ${playerName} is showing an aggression spike — more active than their history. Running hot or bullying — factor that in.`,
                    `Live alert: ${playerName} is spikin\' on aggression — firin\' way more than usual. Running hot or tossin\' their weight around. Factor it in, kid.`
                );
                if (decision === 'fold') decision = 'context_dependent';
            }
            if ((actionType === 'bet' || actionType === 'raise') && bluffRate > 0.22 && !parts.some(p => p.includes('bluff'))) {
                push(
                    `History: ${Math.round(bluffRate * 100)}% showdown bluff rate — keep that in mind.`,
                    `History: ${Math.round(bluffRate * 100)}% showdown bluff rate — keep that in your back pocket.`
                );
                if (decision === 'fold') decision = 'context_dependent';
            }
            if (actionType === 'call' && trapRate > 0.12 && !parts.some(p => p.includes('slowplay') || p.includes('trap'))) {
                push(
                    `They have a ${Math.round(trapRate * 100)}% slowplay rate — flat calls from them can hide monsters.`,
                    `They have a ${Math.round(trapRate * 100)}% slowplay rate — flat calls can hide monsters. Don't get whacked.`
                );
            }
            if ((actionType === 'bet' || actionType === 'raise') && protRate > 0.15 && texture?.isFlushy && !parts.some(p => p.includes('protect'))) {
                push(
                    `They bet for protection frequently on wet boards — this might not be a monster, just protection.`,
                    `They bet for protection often on wet boards — might not be a monster, just protection.`
                );
                if (decision === 'fold') decision = 'context_dependent';
            }
            if (actionType === 'call' && drawRate > 0.20 && !parts.some(p => p.includes('draw'))) {
                push(
                    `${Math.round(drawRate * 100)}% draw chase rate — if the board is coordinated, count draws in their range.`,
                    `${Math.round(drawRate * 100)}% draw chase rate — on a coordinated board, count draws in their range.`
                );
            }
        }

        // ── HUD SIGNALS (position + sizing + tendencies) ─────────
        const hudExtras = [];
        const hudPush = (def, duke) => hudExtras.push(v(def, duke));
        if (confidence !== 'thin') {
            // Position trends
            if (pos && posHands >= 8 && posVpip !== null && posPfr !== null) {
                if (pos === 'LP' && posPfr - dm.pfr >= 0.12) {
                    hudPush(
                        `They open wider in late position (${Math.round(posPfr * 100)}% LP PFR).`,
                        `They open wider in late position (${Math.round(posPfr * 100)}% LP PFR). Late seat, light fingers.`
                    );
                } else if (pos === 'EP' && dm.vpip - posVpip >= 0.12) {
                    hudPush(
                        `They tighten up in early position (${Math.round(posVpip * 100)}% EP VPIP).`,
                        `They tighten up in early position (${Math.round(posVpip * 100)}% EP VPIP). Up front, they ain't splashing.`
                    );
                }
            }

            // 3-bet frequency context
            if (street === 'preflop' && actionType === 'raise' && currentHand?.perPlayer?.[playerName]?.threeBet && dm.threeBetPct !== null) {
                if (dm.threeBetPct <= 0.04) {
                    hudPush(
                        `Low 3-bet rate (${Math.round(dm.threeBetPct * 100)}%) — this re-raise is usually strong.`,
                        `Low 3-bet rate (${Math.round(dm.threeBetPct * 100)}%) — this re-raise is usually strong. Respect it.`
                    );
                } else if (dm.threeBetPct >= 0.12) {
                    hudPush(
                        `High 3-bet rate (${Math.round(dm.threeBetPct * 100)}%) — this re-raise can be wide.`,
                        `High 3-bet rate (${Math.round(dm.threeBetPct * 100)}%) — this re-raise can be wide. They like to swing.`
                    );
                }
            }
            // Fold-to-3bet context — fires when opponent opens preflop (good time to consider a squeeze)
            if (street === 'preflop' && actionType === 'raise' && !currentHand?.perPlayer?.[playerName]?.threeBet && dm.foldTo3BetPct !== null) {
                if (dm.foldTo3BetPct >= 0.70) {
                    hudPush(
                        `Folds to 3-bets ${Math.round(dm.foldTo3BetPct * 100)}% — good spot to squeeze if you have a hand.`,
                        `Folds to 3-bets ${Math.round(dm.foldTo3BetPct * 100)}% — they hate pressure. Good spot to squeeze.`
                    );
                } else if (dm.foldTo3BetPct <= 0.25) {
                    hudPush(
                        `Only folds to 3-bets ${Math.round(dm.foldTo3BetPct * 100)}% — don't light 3-bet this one.`,
                        `Only folds to 3-bets ${Math.round(dm.foldTo3BetPct * 100)}% — they call 3-bets. Don't bluff squeeze.`
                    );
                }
            }

            // Fold vs flop bet and postflop fold rate
            if (street === 'flop' && actionType === 'check' && dm.foldVsFlopBet !== null) {
                if (dm.foldVsFlopBet >= 0.60) hudPush(
                    `They fold to flop bets ${Math.round(dm.foldVsFlopBet * 100)}% — a c-bet often works.`,
                    `They fold to flop bets ${Math.round(dm.foldVsFlopBet * 100)}% — a c-bet often works. Print money.`
                );
                else if (dm.foldVsFlopBet <= 0.35) hudPush(
                    `They call flop bets often — avoid light bluffs here.`,
                    `They call flop bets often — don't bluff light into that.`
                );
            }
            if (actionType === 'call' && dm.postFoldPct !== null) {
                if (dm.postFoldPct >= 0.55) hudPush(
                    `They fold post-flop ${Math.round(dm.postFoldPct * 100)}% — a call from them is stronger than usual.`,
                    `They fold post-flop ${Math.round(dm.postFoldPct * 100)}% — a call from them means more than usual.`
                );
                else if (dm.postFoldPct <= 0.20) hudPush(
                    `They rarely fold post-flop — expect them to continue wide.`,
                    `They rarely fold post-flop — expect them to keep coming wide.`
                );
            }

            // Sizing vs their baseline
            if ((actionType === 'bet' || actionType === 'raise') && betPct !== null && dm.avgRaisePct !== null && (activeStats.raisePctSamples || 0) >= 5) {
                const ratio = betPct / dm.avgRaisePct;
                if (ratio > 1.7)
                    hudPush(
                        `Sizing deviation: they usually bet ${dm.avgRaisePct.toFixed(1)}% of stack — this bet is ${betPct.toFixed(1)}%, significantly larger than their norm. When they go big, they have it.`,
                        `Sizing deviation: they usually bet ${dm.avgRaisePct.toFixed(1)}% of stack — this bet is ${betPct.toFixed(1)}%, significantly larger than their norm. When they go big, they got it. Hammer time.`
                    );
                else if (ratio < 0.6)
                    hudPush(
                        `Sizing deviation: they usually bet ${dm.avgRaisePct.toFixed(1)}% of stack — this bet is ${betPct.toFixed(1)}%, much smaller. Could be blocking, probing, or a slowplay. Don't give it full credit.`,
                        `Sizing deviation: they usually bet ${dm.avgRaisePct.toFixed(1)}% of stack — this bet is ${betPct.toFixed(1)}%, much smaller. Could be blocking, probing, or a slowplay. Cheap feeler — don't give it full credit.`
                    );
            }
            if (actionType === 'call' && betPct !== null && dm.avgCallPct !== null && (activeStats.callPctSamples || 0) >= 5) {
                if (betPct > dm.avgCallPct * 1.7) hudPush(
                    `This call is larger than their avg call size (${dm.avgCallPct.toFixed(1)}% of stack).`,
                    `This call is larger than their avg call size (${dm.avgCallPct.toFixed(1)}% of stack). Big swallow.`
                );
                else if (betPct < dm.avgCallPct * 0.6) hudPush(
                    `This call is smaller than their avg call size (${dm.avgCallPct.toFixed(1)}% of stack).`,
                    `This call is smaller than their avg call size (${dm.avgCallPct.toFixed(1)}% of stack). Cheap look.`
                );
            }
        }

        if (hudExtras.length) parts.push(...hudExtras.slice(0, 2));

        // ── BOARD TEXTURE NOTE ────────────────────────────────────
        if (texture && texture.isFlushy && street !== 'preflop')
            push(
                isRiver ? `Board has flush potential — made flushes are in their range.` : `Flush draw on board — draws are live.`,
                isRiver ? `Board's got flush cards on it — made flushes are in their range, pal.` : `Flush draw on board — draws are alive.`
            );
        else if (texture && texture.straightConnected && street !== 'preflop')
            push(
                isRiver ? `Board is straight-connected — straights completed.` : `Connected board — straight draws are live.`,
                isRiver ? `Board is straight-connected — straights completed.` : `Connected board — straight draws are live.`
            );

        // ── CALL COST NOTE — only when we are actually facing a bet ──
        if ((actionType === 'bet' || actionType === 'raise') && facingAction === 'bet' && amountForPot && potAfter > 0) {
            const potBeforeCall = potAfter;
            const equity = potOddsPct(amountForPot, potBeforeCall);
            if (equity != null && equity > 0 && equity < 100) {
                const ratio = Math.round(potBeforeCall / amountForPot);
                if (equity <= 20) {
                    push(
                        `Small bet into a big pot — you only need to win 1 in ~${Math.round(1 / equity * 100)} times to call. Good price.`,
                        `Small bet into a big pot — you only need to win 1 in ~${Math.round(1 / equity * 100)} to call. Good price.`
                    );
                } else if (equity <= 40) {
                    const drawHint = street === 'river' ? `Worth calling with a solid pair or better — no more draws to hit.` : `Worth calling with a draw or solid pair.`;
                    const drawHintDuke = street === 'river' ? `Worth a call with a solid pair or better — no more draws to hit.` : `Worth a call with a draw or solid pair.`;
                    push(
                        `To call profitably, you need to win roughly 1 in ${ratio + 1} times (~${equity}%). ${drawHint}`,
                        `To call, you need to win roughly 1 in ${ratio + 1} times (~${equity}%). ${drawHintDuke}`
                    );
                } else if (equity <= 60) {
                    push(
                        `Large bet — you need to win ~${equity}% of the time to break even on a call. Need a real hand here.`,
                        `Large bet — you need to win ~${equity}% of the time to break even. Need a real hand here.`
                    );
                } else {
                    push(
                        `Massive bet into a small pot — only call with a near-certain winner.`,
                        `Massive bet into a small pot — only call with a near-certain winner. Otherwise you get whacked.`
                    );
                }
            }
        }

        // ── SYNTHESIZED ACTION TAG ────────────────────────────────
        if (decision) parts.push(actionTag(decision));

        if (!parts.length) return buildMechanisticMessage(playerName, actionType, betPct, texture, potPct, amount, amountForPot, street);

        return { text: parts.join(' '), confidence, isMath: false, handsObserved };
    }

    function isMobileViewport() {
        if (typeof window === 'undefined') return false;
        if (window.matchMedia) return window.matchMedia('(max-width: 900px)').matches;
        return window.innerWidth <= 900;
    }

    function clamp(n, min, max) {
        return Math.min(max, Math.max(min, n));
    }

    function applyCoachLauncherPosition(btn) {
        const pos = hudSettings.coachLauncherPosition;
        if (!pos || pos.x == null || pos.y == null) {
            btn.style.left = '';
            btn.style.top = '';
            btn.style.right = '';
            btn.style.bottom = '';
            return;
        }
        const r = btn.getBoundingClientRect();
        const w = r.width || 56;
        const h = r.height || 56;
        const maxX = Math.max(6, window.innerWidth - w - 6);
        const maxY = Math.max(6, window.innerHeight - h - 6);
        const x = clamp(pos.x, 6, maxX);
        const y = clamp(pos.y, 6, maxY);
        btn.style.left = x + 'px';
        btn.style.top = y + 'px';
        btn.style.right = '';
        btn.style.bottom = '';
    }

    function setCoachPeekText(text) {
        lastCoachPeekText = text ? String(text) : null;
    }

    function ensureCoachLauncher() {
        if (!isMobileViewport()) return;
        let btn = document.getElementById('tphud-coach-launcher');
        if (btn) {
            applyCoachLauncherPosition(btn);
            return;
        }
        btn = document.createElement('button');
        btn.id = 'tphud-coach-launcher';
        btn.className = 'tphud-coach-launcher';
        btn.type = 'button';
        btn.textContent = 'Coach';

        let dragged = false;
        btn.addEventListener('click', () => {
            if (dragged) { dragged = false; return; }
            setCoachMobileCollapsed(!coachMobileCollapsed);
            const panel = document.getElementById('tphud-coach');
            if (!coachMobileCollapsed && panel) {
                panel.classList.remove('tphud-coach-new');
                void panel.offsetWidth;
                panel.classList.add('tphud-coach-new');
            }
        });

        btn.addEventListener('pointerdown', e => {
            if (!isMobileViewport()) return;
            if (e.button !== undefined && e.button !== 0) return;
            dragged = false;
            e.preventDefault();
            const r = btn.getBoundingClientRect();
            const sx = e.clientX;
            const sy = e.clientY;
            const sl = r.left;
            const st = r.top;
            const w = r.width || 56;
            const h = r.height || 56;
            btn.style.cursor = 'grabbing';
            const onMove = e => {
                const dx = e.clientX - sx;
                const dy = e.clientY - sy;
                if (Math.abs(dx) + Math.abs(dy) > 4) dragged = true;
                const maxX = Math.max(6, window.innerWidth - w - 6);
                const maxY = Math.max(6, window.innerHeight - h - 6);
                const nx = clamp(sl + dx, 6, maxX);
                const ny = clamp(st + dy, 6, maxY);
                btn.style.left = nx + 'px';
                btn.style.top = ny + 'px';
                btn.style.right = '';
                btn.style.bottom = '';
            };
            const onUp = () => {
                btn.style.cursor = 'pointer';
                document.removeEventListener('pointermove', onMove);
                document.removeEventListener('pointerup', onUp);
                if (dragged) {
                    const nr = btn.getBoundingClientRect();
                    hudSettings.coachLauncherPosition = { x: Math.round(nr.left), y: Math.round(nr.top) };
                    saveSettings(hudSettings);
                }
            };
            document.addEventListener('pointermove', onMove);
            document.addEventListener('pointerup', onUp);
        });

        document.body.appendChild(btn);
        applyCoachLauncherPosition(btn);
    }

    function removeCoachLauncher() {
        const btn = document.getElementById('tphud-coach-launcher');
        if (btn) btn.remove();
    }

    // ── Table Session Log bubble + panel ─────────────────────────

    function ensureTableLogBubble() {
        if (document.getElementById('tphud-tlog-bubble')) return;
        const btn = document.createElement('button');
        btn.id = 'tphud-tlog-bubble';
        btn.className = 'tphud-tlog-bubble';
        btn.type = 'button';
        btn.title = 'Table history log';
        btn.textContent = 'Log';

        // Apply saved position
        const saved = hudSettings.tlogBubblePosition;
        if (saved?.x != null) {
            btn.style.left = saved.x + 'px';
            btn.style.top = saved.y + 'px';
            btn.style.right = '';
            btn.style.bottom = '';
        }

        let dragged = false;
        btn.addEventListener('click', () => {
            if (dragged) { dragged = false; return; }
            showTableLogModal();
        });

        btn.addEventListener('pointerdown', e => {
            if (e.button !== undefined && e.button !== 0) return;
            dragged = false;
            e.preventDefault();
            const r = btn.getBoundingClientRect();
            const sx = e.clientX;
            const sy = e.clientY;
            const sl = r.left;
            const st = r.top;
            const w = r.width || 56;
            const h = r.height || 56;
            btn.style.cursor = 'grabbing';
            const onMove = ev => {
                const dx = ev.clientX - sx;
                const dy = ev.clientY - sy;
                if (Math.abs(dx) + Math.abs(dy) > 4) dragged = true;
                const nx = clamp(sl + dx, 6, Math.max(6, window.innerWidth - w - 6));
                const ny = clamp(st + dy, 6, Math.max(6, window.innerHeight - h - 6));
                btn.style.left = nx + 'px';
                btn.style.top = ny + 'px';
                btn.style.right = '';
                btn.style.bottom = '';
            };
            const onUp = () => {
                btn.style.cursor = 'pointer';
                document.removeEventListener('pointermove', onMove);
                document.removeEventListener('pointerup', onUp);
                if (dragged) {
                    const nr = btn.getBoundingClientRect();
                    hudSettings.tlogBubblePosition = { x: Math.round(nr.left), y: Math.round(nr.top) };
                    saveSettings(hudSettings);
                }
            };
            document.addEventListener('pointermove', onMove);
            document.addEventListener('pointerup', onUp);
        });

        document.body.appendChild(btn);
    }

    // ── Beat-You bubble — shows live % chance an active villain holds a hand that currently beats hero
    function ensureBeatBubble() {
        if (!hudSettings.beatBubble) return;
        if (document.getElementById('tphud-beat-bubble')) return;
        const btn = document.createElement('button');
        btn.id = 'tphud-beat-bubble';
        btn.className = 'tphud-beat-bubble tphud-beat-bubble-empty';
        btn.type = 'button';
        btn.title = 'Hands that beat you (click for breakdown)';
        btn.textContent = '—';

        const saved = hudSettings.beatBubblePosition;
        if (saved?.x != null) {
            btn.style.left = saved.x + 'px';
            btn.style.top = saved.y + 'px';
            btn.style.right = '';
            btn.style.bottom = '';
        }

        let dragged = false;
        btn.addEventListener('click', () => {
            if (dragged) { dragged = false; return; }
            showBeatModal();
        });

        btn.addEventListener('pointerdown', e => {
            if (e.button !== undefined && e.button !== 0) return;
            dragged = false;
            e.preventDefault();
            const r = btn.getBoundingClientRect();
            const sx = e.clientX;
            const sy = e.clientY;
            const sl = r.left;
            const st = r.top;
            const w = r.width || 56;
            const h = r.height || 56;
            btn.style.cursor = 'grabbing';
            const onMove = ev => {
                const dx = ev.clientX - sx;
                const dy = ev.clientY - sy;
                if (Math.abs(dx) + Math.abs(dy) > 4) dragged = true;
                const nx = clamp(sl + dx, 6, Math.max(6, window.innerWidth - w - 6));
                const ny = clamp(st + dy, 6, Math.max(6, window.innerHeight - h - 6));
                btn.style.left = nx + 'px';
                btn.style.top = ny + 'px';
                btn.style.right = '';
                btn.style.bottom = '';
            };
            const onUp = () => {
                btn.style.cursor = 'pointer';
                document.removeEventListener('pointermove', onMove);
                document.removeEventListener('pointerup', onUp);
                if (dragged) {
                    const nr = btn.getBoundingClientRect();
                    hudSettings.beatBubblePosition = { x: Math.round(nr.left), y: Math.round(nr.top) };
                    saveSettings(hudSettings);
                }
            };
            document.addEventListener('pointermove', onMove);
            document.addEventListener('pointerup', onUp);
        });

        document.body.appendChild(btn);
        refreshBeatBubble();
    }

    function removeBeatBubble() {
        document.getElementById('tphud-beat-bubble')?.remove();
        document.getElementById('tphud-beat-modal')?.remove();
    }

    // Picks a color class based on aggregate probability — green safe, orange caution, red danger
    function _beatBubbleColorClass(p) {
        if (p == null) return 'tphud-beat-bubble-empty';
        if (p >= 0.60) return 'tphud-beat-bubble-hot';
        if (p >= 0.30) return 'tphud-beat-bubble-warm';
        return 'tphud-beat-bubble-cool';
    }

    let _beatRefreshTimer = null;
    function scheduleBeatBubbleRefresh() {
        if (!hudSettings.beatBubble) return;
        if (_beatRefreshTimer) return;
        _beatRefreshTimer = setTimeout(() => {
            _beatRefreshTimer = null;
            refreshBeatBubble();
        }, 220);
    }

    // In-memory snapshot of the most recent beat-bubble read per villain in the current hand.
    // Used at hand finalisation to compare our prediction against villain's revealed cards.
    let _lastBeatRead = null;
    const _beatReadHistory = [];
    const BEAT_READ_HISTORY_MAX = 20;

    function _resetBeatReadSnapshots() { _lastBeatRead = null; }

    function refreshBeatBubble() {
        const btn = document.getElementById('tphud-beat-bubble');
        if (!btn) return;
        if (!hudSettings.beatBubble) { btn.remove(); return; }

        const fullData = computeBeatYouProbabilities();
        const data = fullData || computeVillainRangesOnly();

        btn.classList.remove('tphud-beat-bubble-empty', 'tphud-beat-bubble-cool', 'tphud-beat-bubble-warm', 'tphud-beat-bubble-hot');

        if (!data) {
            btn.textContent = '—';
            btn.classList.add('tphud-beat-bubble-empty');
            btn.title = 'No active villains yet · click for read history';
        } else if (fullData && data.aggregate != null) {
            btn.textContent = `${Math.round(data.aggregate * 100)}%`;
            btn.classList.add(_beatBubbleColorClass(data.aggregate));
            btn.title = 'Chance ≥1 active villain has a hand beating you. Click for breakdown.';
        } else if (fullData) {
            btn.textContent = `~${Math.round(data.vsRandomPct * 100)}%`;
            btn.classList.add('tphud-beat-bubble-empty');
            btn.title = 'No villain has enough showdown samples yet — showing vs-random-hand baseline. Click for breakdown.';
        } else {
            // Spectator mode — hero isn't in this hand. Still tracking villains for the next showdown.
            const count = data.perVillain.length;
            btn.textContent = '👁';
            btn.classList.add('tphud-beat-bubble-empty');
            btn.title = `Spectating · tracking ${count} villain${count !== 1 ? 's' : ''} · click for read history`;
        }

        // Snapshot the per-villain read so we can grade it once the hand ends.
        // Keep top 12 weighted classes — enough to evaluate "was it in our list?" rank.
        if (data) {
            _lastBeatRead = { aggregate: data.aggregate, perVillain: {}, spectating: !fullData };
            data.perVillain.forEach(v => {
                _lastBeatRead.perVillain[v.name] = {
                    weightedClasses: v.weightedClasses.slice(0, 12).map(c => ({ cls: c.cls, weight: c.weight, beats: c.beats })),
                    weightedTotal: v.sample,
                    p: v.p,
                    action: v.action,
                    currentBB: v.currentBB,
                    spectating: !fullData,
                };
            });
        }

        _refreshBeatModalIfOpen(data);
    }

    // Called from finalizeCurrentHand for each villain who showed cards. Records whether the
    // canonical class of villain's actual hand was in our snapshot's weighted-class list, and
    // when it wasn't, splits the reason into:
    //   - 'new'      → villain has never shown this class before (pure sample-size miss)
    //   - 'filtered' → villain has shown this class but our PF/sizing filter excluded it
    function _recordBeatRead(name, showdownCards, actualBeats) {
        if (!_lastBeatRead?.perVillain?.[name]) return;
        const ch = canonicalHand(showdownCards);
        if (!ch) return;
        const snap = _lastBeatRead.perVillain[name];
        const idx = snap.weightedClasses.findIndex(c => c.cls === ch);
        const totalW = snap.weightedClasses.reduce((s, c) => s + c.weight, 0);
        const inList = idx >= 0;
        const cardEntry = inList ? snap.weightedClasses[idx] : null;

        // Inspect villain's historical shownHands so we can label MISSes as 'new class' vs 'filtered out'.
        const stats = resolveStatsByName(name);
        const shown = stats?.shownHands || null;
        const histEntry = shown?.[ch] || null;
        const uniqueClasses = shown ? Object.keys(shown).filter(k => (shown[k]?.seen || 0) > 0).length : 0;
        let missReason = null;
        if (!inList) {
            missReason = (histEntry && histEntry.seen > 0) ? 'filtered' : 'new';
        }

        _beatReadHistory.unshift({
            ts: Date.now(),
            name,
            actualClass: ch,
            inList,
            rank: inList ? idx + 1 : null,
            sharePct: inList && totalW > 0 ? cardEntry.weight / totalW : null,
            predictedBeats: inList ? cardEntry.beats : null,
            actualBeats,
            ourAggregate: _lastBeatRead.aggregate,
            ourP: snap.p,
            action: snap.action,
            missReason,
            histSeen: histEntry?.seen || 0,
            histPfr: histEntry?.pfr || 0,
            villainUniqueClasses: uniqueClasses,
            spectating: !!snap.spectating,
        });
        if (_beatReadHistory.length > BEAT_READ_HISTORY_MAX) _beatReadHistory.length = BEAT_READ_HISTORY_MAX;
        _refreshBeatModalIfOpen(computeBeatYouProbabilities());
    }

    function _refreshBeatModalIfOpen(data) {
        const modal = document.getElementById('tphud-beat-modal');
        if (!modal) return;
        const activeTab = modal.querySelector('.tphud-beat-tab.tphud-tab-active')?.dataset?.tab || 'current';
        const content = modal.querySelector('.tphud-beat-content');
        if (content) {
            content.innerHTML = buildBeatModalShell(data, activeTab);
            _wireBeatModalTabs(modal);
        }
    }

    function _wireBeatModalTabs(modal) {
        modal.querySelectorAll('.tphud-beat-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                modal.querySelectorAll('.tphud-beat-tab').forEach(t => t.classList.remove('tphud-tab-active'));
                modal.querySelectorAll('.tphud-beat-pane').forEach(p => p.classList.add('tphud-hidden'));
                tab.classList.add('tphud-tab-active');
                modal.querySelector(`#tphud-beat-pane-${tab.dataset.tab}`)?.classList.remove('tphud-hidden');
            });
        });
    }

    // Returns the full modal body: tab strip + three panes (current / history / beating).
    function buildBeatModalShell(data, activeTab = 'current') {
        const isSpectating = !!data?.spectating;
        const hasBoardData = !!data && !isSpectating;
        const beatingCount = hasBoardData ? data.beatingClasses.length : 0;
        const histCount = _beatReadHistory.length;
        const tabs = [
            { id: 'current', label: hasBoardData ? 'Current hand' : (isSpectating ? 'Spectating' : 'Current hand') },
            { id: 'history', label: histCount ? `History (${histCount})` : 'History' },
        ];
        if (hasBoardData && beatingCount) tabs.push({ id: 'beating', label: `Hands beating you (${beatingCount})` });

        const tabBar = tabs.map(t =>
            `<button class="tphud-beat-tab tphud-tab ${t.id === activeTab ? 'tphud-tab-active' : ''}" data-tab="${t.id}">${t.label}</button>`
        ).join('');

        const panes = tabs.map(t => {
            let body = '';
            if (t.id === 'current') body = renderBeatCurrentPane(data);
            else if (t.id === 'history') body = buildBeatReadHistoryHtml();
            else if (t.id === 'beating') body = renderBeatHandsPane(data);
            return `<div id="tphud-beat-pane-${t.id}" class="tphud-beat-pane ${t.id === activeTab ? '' : 'tphud-hidden'}">${body}</div>`;
        }).join('');

        return `<div class="tphud-beat-tabs tphud-tabs">${tabBar}</div>${panes}`;
    }

    function renderBeatCurrentPane(data) {
        if (!data) {
            return `<div class="tphud-beat-empty">
                <div class="tphud-beat-empty-icon">👁</div>
                <div class="tphud-beat-empty-title">No active villains</div>
                <div class="tphud-beat-empty-sub">Once a hand starts and villains commit chips, this tab fills with their likely-hand reads.</div>
            </div>`;
        }

        const pct = v => `${(v * 100).toFixed(1)}%`;
        const fmtW = w => Number.isInteger(w) ? String(w) : w.toFixed(1);
        const actionTag = (a, bb) => {
            const sizeNote = bb != null ? ` @ ${bb.toFixed(1)}BB` : '';
            if (a === 'raised') return `<span class="tphud-beat-vact" style="color:#e74c3c">raised${sizeNote}</span>`;
            if (a === 'called') return `<span class="tphud-beat-vact" style="color:#f39c12">limp/call${sizeNote}</span>`;
            return `<span class="tphud-beat-vact" style="color:#888">BB walk</span>`;
        };
        const TOP_N = 8;
        const renderLikelyChips = wcs => {
            if (!wcs.length) return `<span class="tphud-dim" style="font-size:12px">no shown hands match this PF line yet</span>`;
            const top = wcs.slice(0, TOP_N);
            const totalTop = top.reduce((s, c) => s + c.weight, 0);
            return top.map(c => {
                const share = totalTop > 0 ? Math.round(c.weight / totalTop * 100) : 0;
                const cls = c.beats ? 'tphud-beat-chip tphud-beat-chip-bad' : 'tphud-beat-chip tphud-beat-chip-ok';
                return `<span class="${cls}" title="${c.beats ? 'BEATS you' : 'does not beat you'} · weight ${fmtW(c.weight)}">${c.cls}<span class="tphud-beat-chip-pct">${share}%</span></span>`;
            }).join('');
        };

        let header = '';
        if (data.spectating) {
            header = `<div class="tphud-beat-spect">
                <span class="tphud-beat-spect-icon">👁</span>
                <span class="tphud-beat-spect-text">Spectating — you're not in this hand. Showing each active villain's likely range so the read history grades correctly when they show down.</span>
            </div>`;
        } else if (data.aggregate != null) {
            header = `<div class="tphud-beat-agg">
                <div class="tphud-beat-agg-num" style="color:${data.aggregate >= 0.6 ? '#e74c3c' : data.aggregate >= 0.3 ? '#e67e22' : '#27ae60'}">${pct(data.aggregate)}</div>
                <div class="tphud-beat-agg-lbl">chance someone has you beat right now</div>
                <div class="tphud-beat-baseline">vs random hand: ${pct(data.vsRandomPct)} · ${data.totalBeatingCombos} of ${data.totalCombos} possible combos beat you</div>
            </div>`;
        } else {
            header = `<div class="tphud-beat-agg">
                <div class="tphud-beat-agg-num" style="color:#888">no read</div>
                <div class="tphud-beat-agg-lbl">not enough showdown data on active villains</div>
                <div class="tphud-beat-baseline">vs random hand: ${pct(data.vsRandomPct)} · ${data.totalBeatingCombos} of ${data.totalCombos} possible combos beat you</div>
            </div>`;
        }

        const villainRows = data.perVillain.length
            ? data.perVillain.map(v => {
                const head = `<div class="tphud-beat-vname">
                    <span class="tphud-beat-vplayer">${v.name}</span>
                    ${actionTag(v.action, v.currentBB)}
                </div>`;
                if (data.spectating) {
                    return `<div class="tphud-beat-vrow">
                        ${head}
                        <div class="tphud-beat-vlikely-lbl">Likely hands consistent with their PF action:</div>
                        <div class="tphud-beat-vbeats">${renderLikelyChips(v.weightedClasses)}</div>
                    </div>`;
                }
                if (v.p == null) {
                    return `<div class="tphud-beat-vrow">
                        ${head}
                        <div class="tphud-beat-vmid tphud-dim">No usable read — need ${data.minSample}+ shown hands consistent with this PF line.</div>
                        ${v.weightedClasses.length ? `<div class="tphud-beat-vbeats">${renderLikelyChips(v.weightedClasses)}</div>` : ''}
                    </div>`;
                }
                const color = v.p >= 0.6 ? '#e74c3c' : v.p >= 0.3 ? '#e67e22' : '#27ae60';
                const thinTypeRead = v.priorSource === 'type' && v.sample < data.minSample;
                return `<div class="tphud-beat-vrow">
                    ${head}
                    <div class="tphud-beat-vmid">
                        <span class="tphud-beat-vp" style="color:${color}">${pct(v.p)}</span>
                        <span class="tphud-beat-vsub">chance they have you beat${thinTypeRead ? ' <span class="tphud-dim">(from player type, few shown hands yet)</span>' : ''}</span>
                    </div>
                    ${v.weightedClasses.length ? `<div class="tphud-beat-vlikely-lbl">Most likely hands now:</div>
                    <div class="tphud-beat-vbeats">${renderLikelyChips(v.weightedClasses)}</div>` : ''}
                </div>`;
            }).join('')
            : `<div class="tphud-dim" style="padding:10px 0">No active villains.</div>`;

        return `${header}
            <div class="tphud-beat-sec">Per-villain read</div>
            <div class="tphud-beat-vlist">${villainRows}</div>`;
    }

    function renderBeatHandsPane(data) {
        if (!data || data.spectating) {
            return `<div class="tphud-beat-empty">
                <div class="tphud-beat-empty-icon">·</div>
                <div class="tphud-beat-empty-title">Only available when you're in the hand</div>
                <div class="tphud-beat-empty-sub">This list shows which exact hand classes can beat your hole cards on the current board.</div>
            </div>`;
        }
        if (!data.beatingClasses.length) {
            return `<div class="tphud-beat-sec-good">You have the nuts — nothing on the deck beats you.</div>`;
        }
        const topBeating = data.beatingClasses.slice(0, 60).map(c => `<span class="tphud-beat-cls">${c.cls}<span class="tphud-beat-cnt">·${c.count}</span></span>`).join(' ');
        const more = data.beatingClasses.length > 60 ? `<span class="tphud-dim" style="margin-left:6px">+${data.beatingClasses.length - 60} more</span>` : '';
        return `<div class="tphud-beat-note" style="margin-top:0">Every class that currently beats your hand on this board. The number after each = remaining combos that can still make it.</div>
                <div class="tphud-beat-allcls">${topBeating}${more}</div>`;
    }

    // Renders the post-showdown grading log so you can verify whether the read had each villain.
    function buildBeatReadHistoryHtml() {
        if (!_beatReadHistory.length) {
            return `<div class="tphud-beat-empty">
                <div class="tphud-beat-empty-icon">·</div>
                <div class="tphud-beat-empty-title">No reads graded yet</div>
                <div class="tphud-beat-empty-sub">Each time a villain shows their cards, we'll log whether their actual hand was in our "most likely" list. MISS is expected when villains have few showdowns logged — the script can only list classes it's seen before.</div>
            </div>`;
        }
        const pct = v => `${(v * 100).toFixed(0)}%`;
        const total = _beatReadHistory.length;
        let hits = 0, partial = 0, underread = 0, missNew = 0, missFiltered = 0;
        _beatReadHistory.forEach(h => {
            if (h.inList) {
                if (h.spectating) hits++;
                else if ((h.predictedBeats && h.actualBeats) || (!h.predictedBeats && !h.actualBeats)) hits++;
                else if (h.predictedBeats && !h.actualBeats) partial++;
                else if (!h.predictedBeats && h.actualBeats) underread++;
                else hits++;
            } else {
                if (h.missReason === 'filtered') missFiltered++;
                else missNew++;
            }
        });
        const summary = `<div class="tphud-beat-histsum">
            <span class="tphud-beat-histsum-item" style="color:#2ecc71">HIT ${hits}</span>
            ${partial ? `<span class="tphud-beat-histsum-item" style="color:#e67e22">PARTIAL ${partial}</span>` : ''}
            ${underread ? `<span class="tphud-beat-histsum-item" style="color:#e67e22">UNDERREAD ${underread}</span>` : ''}
            <span class="tphud-beat-histsum-item" style="color:#e74c3c">MISS-NEW ${missNew}</span>
            <span class="tphud-beat-histsum-item" style="color:#f1c40f">MISS-FILTERED ${missFiltered}</span>
            <span class="tphud-beat-histsum-item tphud-dim">of ${total}</span>
        </div>`;

        const rows = _beatReadHistory.slice(0, 20).map(h => {
            let badge, color, sub = '';
            if (h.inList) {
                if (h.spectating) { badge = 'HIT (spec)'; color = '#2ecc71'; }
                else if (h.predictedBeats && h.actualBeats) { badge = 'HIT (red)'; color = '#2ecc71'; }
                else if (!h.predictedBeats && !h.actualBeats) { badge = 'HIT (gray)'; color = '#2ecc71'; }
                else if (h.predictedBeats && !h.actualBeats) { badge = 'PARTIAL'; color = '#e67e22'; }
                else if (!h.predictedBeats && h.actualBeats) { badge = 'UNDERREAD'; color = '#e67e22'; }
                else { badge = 'IN LIST'; color = '#aaa'; }
            } else if (h.missReason === 'filtered') {
                badge = 'MISS-FILTERED'; color = '#f1c40f';
                sub = `seen ${h.histSeen}× (${h.histPfr} as raiser), excluded by ${h.action === 'raised' ? 'raise filter' : 'no-raise filter'}`;
            } else {
                badge = 'MISS-NEW'; color = '#e74c3c';
                sub = `villain has ${h.villainUniqueClasses} unique classes shown total`;
            }
            const rankNote = h.inList ? `#${h.rank} · ${pct(h.sharePct)}` : '';
            const aggNote = h.ourAggregate != null ? `agg ${pct(h.ourAggregate)}` : '';
            const meta = [rankNote, aggNote].filter(Boolean).join(' · ');
            return `<div class="tphud-beat-histrow">
                <div class="tphud-beat-histtop">
                    <span class="tphud-beat-histbadge" style="background:${color}22;color:${color};border-color:${color}66">${badge}</span>
                    <span class="tphud-beat-histname">${h.name}</span>
                    <span class="tphud-beat-histcls">${h.actualClass}</span>
                    <span class="tphud-beat-histmeta">${meta}</span>
                </div>
                ${sub ? `<div class="tphud-beat-histsub">${sub}</div>` : ''}
            </div>`;
        }).join('');
        return `${summary}
            <div class="tphud-beat-histlist">${rows}</div>
            <div class="tphud-beat-note">
                <strong>HIT</strong> = we listed villain's actual class.
                <strong>PARTIAL/UNDERREAD</strong> = listed but mispredicted beat-or-not.
                <strong>MISS-NEW</strong> = villain has never shown this class — pure sample-size limit.
                <strong>MISS-FILTERED</strong> = villain has shown this class before but our PF/sizing filter excluded it this hand. If this is common, the filter may be too aggressive.
            </div>`;
    }

    function showBeatModal() {
        document.getElementById('tphud-beat-modal')?.remove();
        const data = computeBeatYouProbabilities() || computeVillainRangesOnly();
        const modal = document.createElement('div');
        modal.id = 'tphud-beat-modal';
        modal.className = 'tphud-help-modal';
        modal.innerHTML = `
            <div class="tphud-help-box tphud-beat-box">
                <div class="tphud-help-header">
                    <span class="tphud-help-title">Range Reader</span>
                    <button class="tphud-help-close">&times;</button>
                </div>
                <div class="tphud-help-content tphud-beat-content">
                    ${buildBeatModalShell(data, 'current')}
                </div>
            </div>`;
        modal.querySelector('.tphud-help-close').addEventListener('click', () => modal.remove());
        modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
        _wireBeatModalTabs(modal);
        document.body.appendChild(modal);
    }

    function buildTableLogRoundsHtml() {
        if (!tableSessionLog.length)
            return '<div class="tphud-dim" style="padding:12px 0">No hands logged this session yet.<br>Complete a hand to see it here.</div>';

        const fmtAmt = (amt, ss) => {
            if (!ss || !amt) return `<span style="color:#ccc">$${(amt || 0).toLocaleString()}</span>`;
            const pct = amt / ss * 100;
            const color = pct >= 40 ? '#e74c3c' : pct >= 20 ? '#e67e22' : '#aaa';
            const tag = pct >= 40 ? ' OB' : pct < 6 ? ' probe' : '';
            return `<span style="color:${color}">$${amt.toLocaleString()} (${pct.toFixed(0)}%${tag})</span>`;
        };

        const buildStreetLines = pl => {
            const ss = pl.startStack || null;
            const SEP = '<span style="color:#555"> · </span>';
            const lines = [];

            // Preflop
            const pfParts = [];
            if (pl.preflopRaiseAmt)
                pfParts.push(`<span style="color:#e74c3c">raise</span> ${fmtAmt(pl.preflopRaiseAmt, ss)}`);
            else if (pl.preflopAction === 'raised')
                pfParts.push(`<span style="color:#e74c3c">raise</span>`);
            if (pl.preflopCallAmt)
                pfParts.push(`<span style="color:#27ae60">call</span> ${fmtAmt(pl.preflopCallAmt, ss)}`);
            else if (pl.preflopAction === 'called')
                pfParts.push(`<span style="color:#27ae60">call</span>`);
            if (pl.preflopAction === 'folded preflop')
                pfParts.push(`<span style="color:#c0392b">fold</span>`);
            if (pfParts.length)
                lines.push(`<span style="color:#e67e22">preflop:</span> ${pfParts.join(SEP)}`);

            ['flop', 'turn', 'river'].forEach(street => {
                const d = pl[street];
                if (!d) return;
                const agg = (d.bets || 0) + (d.raises || 0);
                if (!agg && !d.calls && !d.checks && !d.folds) return;
                const parts = [];
                (pl.betAmts || []).filter(b => b.street === street && b.type === 'bet')
                    .forEach(b => parts.push(`<span style="color:#e67e22">bet</span> ${fmtAmt(b.amt, ss)}`));
                (pl.betAmts || []).filter(b => b.street === street && b.type === 'raise')
                    .forEach(b => parts.push(`<span style="color:#e74c3c">raise</span> ${fmtAmt(b.amt, ss)}`));
                if (!(pl.betAmts || []).some(b => b.street === street) && agg > 0) {
                    if (d.bets) parts.push(`<span style="color:#e67e22">bet×${d.bets}</span>`);
                    if (d.raises) parts.push(`<span style="color:#e74c3c">raise×${d.raises}</span>`);
                }
                (pl.callAmts || []).filter(c => c.street === street)
                    .forEach(c => parts.push(`<span style="color:#27ae60">call</span> ${fmtAmt(c.amt, ss)}`));
                if (!(pl.callAmts || []).some(c => c.street === street) && d.calls)
                    parts.push(`<span style="color:#27ae60">call×${d.calls}</span>`);
                if (d.checks) parts.push(`<span style="color:#7f8c8d">chk×${d.checks}</span>`);
                if (d.folds) parts.push(`<span style="color:#c0392b">fold</span>`);
                const lc = agg > 0 ? '#e67e22' : '#888';
                if (parts.length)
                    lines.push(`<span style="color:${lc}">${street}:</span> ${parts.join(SEP)}`);
            });

            return lines;
        };

        return tableSessionLog.map(round => {
            const timeStr = new Date(round.ts).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

            const boardHtml = round.boardCards?.length
                ? `<span class="tphud-hcard-label">Board</span>${cardsHtml(round.boardCards, true)}`
                : `<span style="color:#555;font-size:10px;font-style:italic">preflop only</span>`;

            const playersHtml = round.players.map(pl => {
                const isWinner = pl.wonShowdown || pl.wonNoShowdown;
                const outClass = isWinner ? 'tphud-hout-win' : pl.reachedShowdown ? 'tphud-hout-lost' : 'tphud-hout-fold';
                const outLabel = isWinner
                    ? (pl.winAmt ? `Won $${pl.winAmt.toLocaleString()}` : 'Won')
                    : pl.reachedShowdown ? 'Lost at showdown' : 'Folded';
                const posStr = pl.position ? ` <span style="color:#555;font-size:10px">${pl.position}</span>` : '';
                const nameColor = isWinner ? '#2ecc71' : '#ccc';

                const cardsRow = pl.cards ? `
                    <div class="tphud-hcard-row" style="margin:4px 0 2px">
                        <span class="tphud-hcard-label">Hand</span>
                        ${cardsHtml(pl.cards, true)}
                        ${pl.handName ? `<span class="tphud-hhand-name">${escHtml(pl.handName)}</span>` : ''}
                    </div>` : '';

                const streetLines = buildStreetLines(pl);
                const streetsHtml = streetLines.length
                    ? `<div class="tphud-hstreets">${streetLines.join('  ')}</div>`
                    : '';

                const entryBorder = isWinner ? '#2ecc71' : pl.reachedShowdown ? '#e74c3c' : '#2a2a2a';

                return `<div class="tphud-hentry" style="border-left-color:${entryBorder}">
                    <div class="tphud-htop">
                        <span class="tphud-haction" style="color:${nameColor};font-weight:bold">${escHtml(pl.name)}${posStr}</span>
                        <span class="tphud-hout ${outClass}">${outLabel}</span>
                    </div>
                    ${cardsRow}
                    ${streetsHtml}
                </div>`;
            }).join('');

            return `<div class="tphud-tlog-round-block">
                <div class="tphud-tlog-round-hdr">
                    <span class="tphud-tlog-hand-num">Hand #${round.handNum}</span>
                    <span class="tphud-tlog-time">${timeStr}</span>
                    <span class="tphud-hcard-row" style="display:inline-flex;gap:3px;align-items:center;flex-wrap:wrap">${boardHtml}</span>
                </div>
                ${playersHtml}
            </div>`;
        }).join('');
    }

    function showTableLogModal() {
        document.getElementById('tphud-tlog-modal')?.remove();
        const modal = document.createElement('div');
        modal.id = 'tphud-tlog-modal';
        modal.className = 'tphud-help-modal';

        const count = tableSessionLog.length;
        modal.innerHTML = `
            <div class="tphud-help-box tphud-tlog-box">
                <div class="tphud-help-header">
                    <span class="tphud-help-title">Table Log${count ? ` — ${count} hand${count !== 1 ? 's' : ''} this session` : ''}</span>
                    <button class="tphud-help-close">&times;</button>
                </div>
                <div class="tphud-help-content tphud-tlog-content">
                    ${buildTableLogRoundsHtml()}
                </div>
            </div>`;

        modal.querySelector('.tphud-help-close').addEventListener('click', () => modal.remove());
        modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
        document.body.appendChild(modal);
    }

    function refreshTableLogPanel() {
        // Re-render if modal is currently open
        const modal = document.getElementById('tphud-tlog-modal');
        if (modal) {
            const content = modal.querySelector('.tphud-tlog-content');
            if (content) content.innerHTML = buildTableLogRoundsHtml();
            const title = modal.querySelector('.tphud-help-title');
            const count = tableSessionLog.length;
            if (title) title.textContent = `Table Log — ${count} hand${count !== 1 ? 's' : ''} this session`;
        }
        const btn = document.getElementById('tphud-tlog-bubble');
        if (btn) btn.title = `Table log — ${tableSessionLog.length} hand${tableSessionLog.length !== 1 ? 's' : ''} this session`;
    }

    function updateCoachPanelLayout() {
        const panel = document.getElementById('tphud-coach');
        if (!panel) return;

        const mobile = isMobileViewport();
        panel.classList.toggle('tphud-coach-mobile', mobile);

        if (mobile) {
            ensureCoachLauncher();
            const launcher = document.getElementById('tphud-coach-launcher');
            if (launcher) {
                applyCoachLauncherPosition(launcher);
                launcher.style.display = coachMobileCollapsed ? '' : 'none';
            }
            const mpos = hudSettings.coachPanelPositionMobile;
            if (mpos && mpos.x != null) {
                const pw = panel.offsetWidth || 260;
                const ph = panel.offsetHeight || 200;
                const mx = clamp(mpos.x, 0, Math.max(0, window.innerWidth - pw));
                const my = clamp(mpos.y, 0, Math.max(0, window.innerHeight - ph));
                panel.style.left = mx + 'px';
                panel.style.top = my + 'px';
                panel.style.right = '';
                panel.style.bottom = '';
                panel.style.transform = hudScaleTransform(hudSettings.hudScaleCoach);
                panel.style.transformOrigin = 'top left';
            } else {
                // Default: top-right corner, clear of game buttons at bottom
                panel.style.right = '8px';
                panel.style.top = '72px';
                panel.style.left = '';
                panel.style.bottom = '';
                panel.style.transform = hudScaleTransform(hudSettings.hudScaleCoach);
                panel.style.transformOrigin = 'top left';
            }
            panel.style.display = coachMobileCollapsed ? 'none' : '';
            return;
        }

        panel.style.transform = hudScaleTransform(hudSettings.hudScaleCoach);
        panel.style.transformOrigin = 'top left';
        panel.style.display = coachDesktopCollapsed ? 'none' : '';
        removeCoachLauncher();
        // Show or remove desktop restore chip based on collapsed state
        if (coachDesktopCollapsed) {
            ensureDesktopRestoreChip();
        } else {
            removeDesktopRestoreChip();
            // Restore the min button symbol in case it was changed
            const minBtn = panel.querySelector('.tphud-coach-min');
            if (minBtn) minBtn.innerHTML = '&#8722;';
        }
        if (hudSettings.coachPanelPosition && hudSettings.coachPanelPosition.x != null) {
            const pw = panel.offsetWidth || 300;
            const ph = panel.offsetHeight || 200;
            const dx = clamp(hudSettings.coachPanelPosition.x, 0, Math.max(0, window.innerWidth - pw));
            const dy = clamp(hudSettings.coachPanelPosition.y, 0, Math.max(0, window.innerHeight - ph));
            panel.style.left = dx + 'px';
            panel.style.top = dy + 'px';
            panel.style.right = '';
            panel.style.bottom = '';
        } else {
            panel.style.left = '';
            panel.style.top = '';
            panel.style.right = '';
            panel.style.bottom = '';
        }
    }

    function syncCoachPanelVisibility() {
        const panel = document.getElementById('tphud-coach');
        if (hudSettings.mrCoachMode === 'off') {
            if (panel) panel.remove();
            removeCoachLauncher();
            setCoachPeekText(null);
            return;
        }

        const hadPanel = !!panel;
        if (!panel) createCoachPanel();
        updateCoachPanelLayout();
        if (!hadPanel) resetCoachLogs();
    }

    function setCoachMobileCollapsed(next) {
        coachMobileCollapsed = !!next;
        updateCoachPanelLayout();
        const launcher = document.getElementById('tphud-coach-launcher');
        if (launcher) launcher.style.display = coachMobileCollapsed ? '' : 'none';
    }


    function ensureDesktopRestoreChip() {
        if (document.getElementById('tphud-coach-restore')) return;

        // Place the chip where the panel was when it got minimized
        const panel = document.getElementById('tphud-coach');
        const rect = panel ? panel.getBoundingClientRect() : null;
        const chipX = rect ? Math.round(rect.left) : 16;
        const chipY = rect ? Math.round(rect.top) : 14;

        const chip = document.createElement('button');
        chip.id = 'tphud-coach-restore';
        chip.type = 'button';
        chip.textContent = 'Coach';
        chip.style.cssText = `
            position: fixed;
            left: ${chipX}px; top: ${chipY}px;
            background: #1a1c20; border: 1px solid rgba(240,179,91,0.4);
            color: #f0b35b; font-size: 11px; font-weight: 700;
            letter-spacing: 0.5px; text-transform: uppercase;
            padding: 8px 16px; border-radius: 999px; cursor: grab;
            z-index: 999998;
            box-shadow: 0 4px 14px rgba(0,0,0,0.6);
            user-select: none;
        `;

        // Restore on click (if not dragging)
        let dragged = false;
        chip.addEventListener('click', () => {
            if (dragged) { dragged = false; return; }
            coachDesktopCollapsed = false;
            updateCoachPanelLayout();
        });

        // Drag support
        let ox, oy, cl, ct;
        chip.addEventListener('mousedown', e => {
            if (e.button !== 0) return;
            dragged = false;
            e.preventDefault();
            const r = chip.getBoundingClientRect();
            ox = e.clientX; oy = e.clientY; cl = r.left; ct = r.top;
            chip.style.cursor = 'grabbing';
            const onMove = e => {
                const dx = e.clientX - ox;
                const dy = e.clientY - oy;
                if (Math.abs(dx) + Math.abs(dy) > 4) dragged = true;
                chip.style.left = (cl + dx) + 'px';
                chip.style.top = (ct + dy) + 'px';
            };
            const onUp = () => {
                chip.style.cursor = 'grab';
                document.removeEventListener('mousemove', onMove);
                document.removeEventListener('mouseup', onUp);
            };
            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onUp);
        });

        document.body.appendChild(chip);
    }

    function removeDesktopRestoreChip() {
        const chip = document.getElementById('tphud-coach-restore');
        if (chip) chip.remove();
    }

    function createCoachPanel() {
        if (hudSettings.mrCoachMode === 'off') return;
        if (document.getElementById('tphud-coach')) return;

        const pos = hudSettings.coachPanelPosition || {};
        const panel = document.createElement('div');
        panel.id = 'tphud-coach';
        panel.className = 'tphud-coach';
        if (pos.x != null) { panel.style.left = pos.x + 'px'; panel.style.top = pos.y + 'px'; }

        panel.innerHTML = `
            <div class="tphud-coach-header">
                <div class="tphud-coach-title-area">
                    <img class="tphud-coach-avatar tphud-hidden" src="https://profileimages.torn.com/4d661456-1798-ad32-4.png" crossorigin="anonymous" alt="">
                    <span class="tphud-coach-title">Mr. Coach</span>
                </div>
                <div class="tphud-coach-hdr-btns">
                    <button class="tphud-coach-hdr-btn tphud-coach-hh" title="Previous hand advice">HH</button>
                    <button class="tphud-coach-hdr-btn tphud-coach-session" title="Session P&amp;L report">$</button>
                    <button class="tphud-coach-hdr-btn tphud-coach-glossary" title="Odds & terms glossary">?</button>
                    <button class="tphud-coach-hdr-btn tphud-coach-personality" title="Switch personality">🎭</button>
                    <button class="tphud-coach-hdr-btn tphud-coach-self-toggle" title="Toggle self notes">S</button>
                    <button class="tphud-coach-hdr-btn tphud-coach-history-toggle" title="Toggle coach history">H</button>
                    <button class="tphud-coach-hdr-btn tphud-coach-refresh" title="Refresh log">&#8635;</button>
                    <button class="tphud-coach-hdr-btn tphud-coach-min" title="Minimize">&#8722;</button>
                </div>
            </div>
            <div class="tphud-coach-tabs">
                <button class="tphud-coach-tab tphud-coach-tab-active" data-street="preflop">Pre</button>
                <button class="tphud-coach-tab" data-street="flop" disabled>Flop</button>
                <button class="tphud-coach-tab" data-street="turn" disabled>Turn</button>
                <button class="tphud-coach-tab" data-street="river" disabled>River</button>
            </div>
            <div class="tphud-coach-body">
                <div class="tphud-coach-msg">Watching the table...</div>
            </div>`;

        document.body.appendChild(panel);
        panel.style.transform = hudScaleTransform(hudSettings.hudScaleCoach);
        panel.style.transformOrigin = 'top left';

        panel.querySelector('.tphud-coach-min').addEventListener('click', () => {
            if (panel.classList.contains('tphud-coach-mobile')) {
                setCoachMobileCollapsed(true);
                return;
            }
            coachDesktopCollapsed = true;
            updateCoachPanelLayout();
        });

        panel.querySelector('.tphud-coach-refresh').addEventListener('click', () => {
            try { finalizeCurrentHand(); } catch (e) { }
            currentHand = null;
            resetCoachLogs();
        });

        panel.querySelector('.tphud-coach-hh').addEventListener('click', e => {
            e.stopPropagation();
            showPrevCoachModal();
        });

        panel.querySelector('.tphud-coach-session').addEventListener('click', e => {
            e.stopPropagation();
            showSessionReportModal();
        });

        panel.querySelector('.tphud-coach-glossary').addEventListener('click', e => {
            e.stopPropagation();
            showCoachGlossaryModal();
        });

        const updateCoachPersonalityHeader = () => {
            const isDuke = hudSettings.coachPersonality === 'duke';
            const titleEl = panel.querySelector('.tphud-coach-title');
            const avatar = panel.querySelector('.tphud-coach-avatar');
            const togBtn = panel.querySelector('.tphud-coach-personality');
            if (titleEl) titleEl.textContent = isDuke ? 'Duke' : 'Mr. Coach';
            if (avatar) avatar.classList.toggle('tphud-hidden', !isDuke);
            if (togBtn) togBtn.style.opacity = isDuke ? '1' : '0.45';
            if (togBtn) togBtn.title = isDuke ? 'Switch to Mr. Coach' : 'Switch to Duke';
        };
        updateCoachPersonalityHeader();

        panel.querySelector('.tphud-coach-personality').addEventListener('click', e => {
            e.stopPropagation();
            hudSettings.coachPersonality = hudSettings.coachPersonality === 'duke' ? 'default' : 'duke';
            saveSettings(hudSettings);
            updateCoachPersonalityHeader();
            updateCoachLog(streetLogs[activeCoachStreet] || []);
        });

        const selfToggleBtn = panel.querySelector('.tphud-coach-self-toggle');
        const updateSelfToggle = () => {
            const on = hudSettings.showSelfNote !== false;
            selfToggleBtn.style.opacity = on ? '1' : '0.35';
            selfToggleBtn.title = on ? 'Hide self notes' : 'Show self notes';
        };
        selfToggleBtn.addEventListener('click', () => {
            hudSettings.showSelfNote = hudSettings.showSelfNote === false ? true : false;
            saveSettings(hudSettings);
            updateSelfToggle();
            updateCoachLog(streetLogs[activeCoachStreet] || []);
        });
        updateSelfToggle();

        const histToggleBtn = panel.querySelector('.tphud-coach-history-toggle');
        const updateHistToggle = () => {
            const on = hudSettings.coachHistory !== false;
            histToggleBtn.style.opacity = on ? '1' : '0.35';
            histToggleBtn.title = on ? 'Hide coach history' : 'Show coach history';
        };
        histToggleBtn.addEventListener('click', () => {
            hudSettings.coachHistory = hudSettings.coachHistory === false ? true : false;
            saveSettings(hudSettings);
            updateHistToggle();
            updateCoachLog(streetLogs[activeCoachStreet] || []);
        });
        updateHistToggle();

        // Street tab click handlers
        panel.querySelectorAll('.tphud-coach-tab').forEach(btn => {
            btn.addEventListener('click', () => {
                const s = btn.dataset.street;
                activeCoachStreet = s;
                panel.querySelectorAll('.tphud-coach-tab').forEach(t =>
                    t.classList.toggle('tphud-coach-tab-active', t.dataset.street === s)
                );
                updateCoachLog(streetLogs[s] || []);
            });
        });

        // Drag by header — mouse on desktop, pointer on mobile
        const header = panel.querySelector('.tphud-coach-header');
        let sx, sy, sl, st;

        const clampedMove = (clientX, clientY) => {
            const pw = panel.offsetWidth || 300;
            const ph = panel.offsetHeight || 200;
            const nx = clamp(sl + clientX - sx, 0, Math.max(0, window.innerWidth - pw));
            const ny = clamp(st + clientY - sy, 0, Math.max(0, window.innerHeight - ph));
            panel.style.left = nx + 'px';
            panel.style.top = ny + 'px';
        };

        header.addEventListener('mousedown', e => {
            if (panel.classList.contains('tphud-coach-mobile')) return;
            if (e.button !== 0) return;
            e.preventDefault();
            const r = panel.getBoundingClientRect();
            sx = e.clientX; sy = e.clientY; sl = r.left; st = r.top;
            panel.style.right = ''; panel.style.bottom = '';
            panel.style.transform = hudScaleTransform(hudSettings.hudScaleCoach);
            panel.style.transformOrigin = 'top left';
            panel.style.left = sl + 'px'; panel.style.top = st + 'px';
            const onMove = e => clampedMove(e.clientX, e.clientY);
            const onUp = () => {
                document.removeEventListener('mousemove', onMove);
                document.removeEventListener('mouseup', onUp);
                const nr = panel.getBoundingClientRect();
                hudSettings.coachPanelPosition = { x: Math.round(nr.left), y: Math.round(nr.top) };
                saveSettings(hudSettings);
            };
            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onUp);
        });

        header.addEventListener('pointerdown', e => {
            if (!panel.classList.contains('tphud-coach-mobile')) return;
            e.preventDefault();
            const r = panel.getBoundingClientRect();
            sx = e.clientX; sy = e.clientY; sl = r.left; st = r.top;
            panel.style.right = ''; panel.style.bottom = '';
            panel.style.transform = hudScaleTransform(hudSettings.hudScaleCoach);
            panel.style.transformOrigin = 'top left';
            panel.style.left = sl + 'px'; panel.style.top = st + 'px';
            header.setPointerCapture(e.pointerId);
            const onMove = e => clampedMove(e.clientX, e.clientY);
            const onUp = () => {
                header.removeEventListener('pointermove', onMove);
                header.removeEventListener('pointerup', onUp);
                const nr = panel.getBoundingClientRect();
                hudSettings.coachPanelPositionMobile = { x: Math.round(nr.left), y: Math.round(nr.top) };
                saveSettings(hudSettings);
            };
            header.addEventListener('pointermove', onMove);
            header.addEventListener('pointerup', onUp);
        });

        // Collapse panel when tapping outside on mobile
        document.addEventListener('pointerdown', e => {
            if (!isMobileViewport() || coachMobileCollapsed) return;
            if (!panel.contains(e.target)) setCoachMobileCollapsed(true);
        }, { capture: true });

        updateCoachPanelLayout();
    }

    function getCoachPeekText(body) {
        if (!body) return null;

        const self = body.querySelector('.tphud-coach-self');
        if (self) {
            const primary = self.querySelector('.tphud-coach-entry-msg:not(.tphud-coach-narrative):not(.tphud-coach-self-note)')
                || self.querySelector('.tphud-coach-entry-msg');
            const text = primary?.textContent?.trim();
            if (text) return text;
        }

        const entries = [...body.querySelectorAll('.tphud-coach-entry')];
        for (let i = entries.length - 1; i >= 0; i--) {
            const el = entries[i];
            if (el.classList.contains('tphud-coach-entry-narrative')) continue;
            if (el.classList.contains('tphud-coach-entry-compact')) {
                const compactText = el.querySelector('span:last-child')?.textContent?.trim();
                if (compactText) return compactText;
            }
            const msg = el.querySelector('.tphud-coach-entry-msg');
            const msgText = msg?.textContent?.trim();
            if (msgText) return msgText;
        }

        return null;
    }

    function updateCoachLog(actions, facingAction) {
        const panel = document.getElementById('tphud-coach');
        if (!panel) return;

        const body = panel.querySelector('.tphud-coach-body');
        const msgEl = panel.querySelector('.tphud-coach-msg');

        // Save old self-entries for history stacking before clearing
        // Each entry is stored with its text fingerprint so we can deduplicate later
        const savedSelfEntries = [];
        if (hudSettings.coachHistory !== false) {
            body.querySelectorAll('.tphud-coach-self').forEach(el => {
                const fp = [...el.querySelectorAll('.tphud-coach-entry-msg')].map(m => m.textContent).join('|');
                savedSelfEntries.push({ node: el.cloneNode(true), fp });
            });
            if (savedSelfEntries.length > 2) savedSelfEntries.splice(0, savedSelfEntries.length - 2);
        }

        // Clear previous entries
        body.querySelectorAll('.tphud-coach-entry').forEach(e => e.remove());

        if (hudSettings.mrCoachMode === 'off') {
            msgEl.textContent = 'Mr. Coach is off';
            setCoachPeekText(null);
            return;
        }

        // Hide idle text — self-entry may still populate even with no opponent actions
        msgEl.textContent = '';

        // ── Own-player entry + history always go at the top ──────────────────────
        const selfEntry = buildSelfEntry();
        if (selfEntry) body.insertBefore(selfEntry, msgEl);

        // Re-insert old self-entries grayed out right below the current one (newest old first)
        // Strip yellow narrative and gray self-note from history — they're street-specific and go stale
        // Skip entries whose text matches current — no point repeating the same message
        let histInsertBefore = selfEntry ? selfEntry.nextSibling : msgEl;
        if (hudSettings.coachHistory !== false && savedSelfEntries.length && selfEntry && !isMobileViewport()) {
            const newFp = [...selfEntry.querySelectorAll('.tphud-coach-entry-msg')].map(m => m.textContent).join('|');
            const seenFps = new Set([newFp]);
            let historyIdx = 0;
            savedSelfEntries.forEach(({ node, fp }) => {
                if (seenFps.has(fp)) return;
                seenFps.add(fp);
                node.querySelectorAll('.tphud-coach-narrative, .tphud-coach-self-note, .tphud-bet-reaction').forEach(el => el.remove());
                node.style.opacity = historyIdx === 0 ? '0.38' : '0.22';
                node.style.fontSize = '0.88em';
                node.style.borderLeft = '2px solid #2a2a2a';
                node.style.paddingLeft = '6px';
                node.style.marginTop = '2px';
                body.insertBefore(node, histInsertBefore);
                histInsertBefore = node.nextSibling;
                historyIdx++;
            });
        }

        // ── Prior-street summary + opponent entries go below own-player section ──
        const STREET_ORDER_N = ['preflop', 'flop', 'turn', 'river'];
        const prevStreetIdx = STREET_ORDER_N.indexOf(activeCoachStreet) - 1;
        const prevStreetN = prevStreetIdx >= 0 ? STREET_ORDER_N[prevStreetIdx] : null;
        const summaryLine = prevStreetN && currentHand?.streetSummaries?.[prevStreetN];
        if (summaryLine) {
            const summaryEl = document.createElement('div');
            summaryEl.className = 'tphud-coach-entry tphud-coach-entry-narrative';
            summaryEl.style.cssText = 'padding:3px 10px;color:#444;font-size:10px;font-style:italic;border-bottom:1px solid #1a1a1a;';
            summaryEl.textContent = summaryLine;
            body.insertBefore(summaryEl, msgEl);
        }

        const CHIP_META = {
            thin: { label: 'Thin read', bg: '#333', fg: '#888' },
            decent: { label: 'Decent read', bg: '#7a5200', fg: '#f39c12' },
            solid: { label: 'Solid read', bg: '#145a32', fg: '#2ecc71' },
        };
        const ACTION_LABEL = { bet: 'bet', raise: 'raised', call: 'called', check: 'checked', fold: 'folded' };

        for (const action of actions) {
            const result = composeCoachMessage(action, facingAction);
            if (!result) continue;

            // Precompute line interp so compact entries can be promoted if there's something notable
            let _preLineInterp = null;
            const _preStreet = currentHand?.street || 'preflop';
            const _preStreetIdx = ['preflop', 'flop', 'turn', 'river'].indexOf(_preStreet);
            if (_preStreetIdx >= 2 && action.playerName !== localPlayerName) {
                const _preP = currentHand?.perPlayer?.[action.playerName];
                if (_preP && !_preP.foldedPreflop) {
                    const _prePat = getOpponentLinePattern(action.playerName);
                    if (_prePat) {
                        const _preAll = getStats();
                        const _preRaw = resolveStatsByName(action.playerName, _preAll);
                        const _preActive = _preRaw ? getActiveStats(_preRaw, currentTableBB) : null;
                        const _preDm = _preActive ? getDisplayMetrics(_preActive) : null;
                        const _preCls = _preDm ? classifyMetrics(_preDm, _preActive.handsObserved || 0) : null;
                        const _preTKey = _preCls ? (Object.keys(TYPES).find(k => TYPES[k] === _preCls.type) || 'UNKNOWN') : 'UNKNOWN';
                        const _preBoard = (currentHand.boardCards || []).filter(Boolean);
                        const _preTex = _preBoard.length >= 3 ? analyzeBoardTexture(_preBoard) : null;
                        const _preFlop = (currentHand.flopCards || []).filter(Boolean);
                        const _preTurn = (currentHand.turnCards || []).filter(Boolean);
                        const _preRiver = (currentHand.riverCards || []).filter(Boolean);
                        const _preNew = _preStreet === 'river' ? (_preRiver[0] || null) : (_preTurn[0] || null);
                        const _preBChg = detectBoardChange(_preFlop, _preNew);
                        _preLineInterp = interpretOpponentLine(_prePat, _preTKey, _preTex, _preBChg);
                        if (_preLineInterp) result.compact = false; // promote: line reading is worth a full entry
                    }
                }
            }

            const entry = document.createElement('div');

            if (result.compact) {
                // Compact one-liner: dim single row, no message block
                entry.className = 'tphud-coach-entry tphud-coach-entry-compact';
                entry.style.cssText = 'padding:2px 10px;opacity:0.55;font-size:10px;display:flex;gap:6px;align-items:center;border-bottom:1px solid #151515;';

                const nameEl = document.createElement('span');
                nameEl.style.cssText = 'color:#888;font-weight:bold;white-space:nowrap;';
                nameEl.textContent = action.playerName;
                entry.appendChild(nameEl);

                const dimMsg = document.createElement('span');
                dimMsg.style.cssText = 'color:#555;';
                dimMsg.textContent = result.text;
                entry.appendChild(dimMsg);
            } else {
                entry.className = 'tphud-coach-entry';

                // Name row: bold name + action chip
                const nameRow = document.createElement('div');
                nameRow.className = 'tphud-coach-name-row';

                const nameEl = document.createElement('span');
                nameEl.className = 'tphud-coach-name';
                nameEl.textContent = action.playerName;
                nameRow.appendChild(nameEl);

                const actChip = document.createElement('span');
                actChip.className = 'tphud-coach-actchip';
                const actLabel = ACTION_LABEL[action.actionType] || action.actionType;
                actChip.textContent = action.amount
                    ? `${actLabel} $${Math.round(action.amount).toLocaleString()}`
                    : actLabel;
                nameRow.appendChild(actChip);

                entry.appendChild(nameRow);

                // Confidence chip (data-driven reads only)
                if (!result.isMath && result.confidence) {
                    const meta = CHIP_META[result.confidence] || CHIP_META.thin;
                    const cChip = document.createElement('span');
                    cChip.className = 'tphud-coach-chip';
                    cChip.textContent = meta.label;
                    cChip.style.cssText = `background:${meta.bg};color:${meta.fg};`;
                    entry.appendChild(cChip);
                }

                const msgEntry = document.createElement('div');
                msgEntry.className = 'tphud-coach-entry-msg';
                msgEntry.textContent = result.text;
                entry.appendChild(msgEntry);

                // Net worth context — injected when ratio is extreme and aligns with (or contradicts) observed profile
                if (action.playerName !== localPlayerName) {
                    const _nwAll = getStats();
                    const _nwStats = resolveStatsByName(action.playerName, _nwAll);
                    if (_nwStats?.networth != null) {
                        const _nwSeatId = chatNameToSeatId[action.playerName] || nameToSeatId[action.playerName];
                        const _nwStack = _nwSeatId ? (liveStacks[_nwSeatId]?.stack ?? null) : null;
                        const _nwRatio = (_nwStack != null && _nwStats.networth > 0) ? _nwStack / _nwStats.networth : null;
                        const _nwActive = getActiveStats(_nwStats, currentTableBB);
                        const _nwDm = _nwActive ? getDisplayMetrics(_nwActive) : null;
                        const _nwCls = _nwDm ? classifyMetrics(_nwDm, _nwActive.handsObserved || 0) : null;
                        const _nwType = _nwCls?.type ?? null;
                        const _nwEnoughHands = (_nwStats.handsObserved ?? 0) >= (hudSettings.minHandsToClassify ?? 5);
                        let _nwNote = null;
                        if (_nwRatio !== null && _nwRatio < 0.005) {
                            if (_nwEnoughHands && (_nwType === 'NIT' || _nwType === 'TAG')) {
                                _nwNote = `${fmtNetworth(_nwStats.networth)} net worth — stack is pocket change, but their profile shows disciplined play. Don't assume loose.`;
                            } else {
                                _nwNote = `${fmtNetworth(_nwStats.networth)} net worth — stack is pocket change for them. Could play looser than usual.`;
                            }
                        } else if (_nwRatio !== null && _nwRatio > 0.2) {
                            _nwNote = `${fmtNetworth(_nwStats.networth)} net worth — this stack is real money to them. Expect more careful play.`;
                        }
                        if (_nwNote) {
                            const nwEl = document.createElement('div');
                            nwEl.className = 'tphud-coach-entry-msg';
                            nwEl.style.cssText = 'color:#888;font-size:9px;margin-top:2px;';
                            nwEl.textContent = _nwNote;
                            entry.appendChild(nwEl);
                        }
                    }
                }

                // Opponent line reading note — reuses precomputed interp from the compact-promotion check above
                if (_preLineInterp) {
                    const _pat = getOpponentLinePattern(action.playerName);
                    const lineEl = document.createElement('div');
                    lineEl.className = 'tphud-coach-entry-msg tphud-coach-opp-line';
                    lineEl.style.cssText = 'color:#7a9ab0;font-size:10px;margin-top:2px;font-style:italic;';
                    lineEl.textContent = `Line (${_pat}): ${_preLineInterp}`;
                    entry.appendChild(lineEl);
                }
            }

            body.insertBefore(entry, msgEl);
        }

        // If nothing rendered at all, show idle message
        const hasContent = body.querySelectorAll('.tphud-coach-entry').length > 0;
        msgEl.textContent = hasContent ? '' : 'Watching the table...';

        if (hasContent) {
            // Flash border to signal new content
            panel.classList.remove('tphud-coach-new');
            void panel.offsetWidth;
            panel.classList.add('tphud-coach-new');
        }

        // Capture rendered text per street for previous-hand review
        if (hasContent) {
            const captured = [];
            body.querySelectorAll('.tphud-coach-entry').forEach(el => {
                const nameEl = el.querySelector('.tphud-coach-name, .tphud-coach-entry > span');
                const name = el.querySelector('.tphud-coach-name')?.textContent
                    || el.querySelector('span')?.textContent || '';
                const chip = el.querySelector('.tphud-coach-actchip')?.textContent || '';
                const msgs = [...el.querySelectorAll('.tphud-coach-entry-msg')]
                    .map(m => m.textContent.trim()).filter(Boolean);
                const isSelf = el.classList.contains('tphud-coach-self');
                const isCompact = el.classList.contains('tphud-coach-entry-compact');
                const isNarr = el.classList.contains('tphud-coach-entry-narrative');
                captured.push({ name, chip, msgs, isSelf, isCompact, isNarr });
            });
            coachTextCache[activeCoachStreet] = captured;
        }

        setCoachPeekText(getCoachPeekText(body));
        if (isMobileViewport()) {
            const launcher = document.getElementById('tphud-coach-launcher');
            if (launcher) launcher.classList.toggle('tphud-coach-launcher-hot', coachMobileCollapsed && hasContent);
        }
    }

    // Returns the last opponent who bet/raised on the current street, with their badge type resolved.
    function getLastOpponentAggressor() {
        if (!currentHand) return null;
        const street = currentHand.street || 'preflop';
        const log = streetLogs[street] || [];
        const aggActs = log.filter(a =>
            a.playerName !== localPlayerName &&
            (a.actionType === 'bet' || a.actionType === 'raise')
        );
        if (!aggActs.length) return null;
        const last = aggActs[aggActs.length - 1];
        const all = getStats();
        const rs = resolveStatsByName(last.playerName, all);
        if (!rs) return { name: last.playerName, typeKey: 'UNKNOWN', handsObserved: 0 };
        const as = getActiveStats(rs, currentTableBB);
        const dm2 = getDisplayMetrics(as);
        const cls = hudSettings.badgeMode === 'session'
            ? classifySession(rs)
            : classifyMetrics(dm2, as.handsObserved || 0);
        const typeKey = Object.keys(TYPES).find(k => TYPES[k] === cls?.type) || 'UNKNOWN';
        return { name: last.playerName, typeKey, handsObserved: as.handsObserved || 0 };
    }

    // Returns duke text when duke personality is active, default otherwise
    // Can be temporarily forced to default for specific UI elements (e.g., yellow narrative text).
    let _forceDefaultVoice = false;
    function _voice(def, duke) {
        if (_forceDefaultVoice) return def;
        return hudSettings.coachPersonality === 'duke' ? duke : def;
    }

    // Weaves win% into the coaching message naturally instead of appending a mechanical suffix.
    // Only surfaces the number when it changes or justifies the advice — never as decoration.
    function _applyWinContext(baseText, winStr, numOpp, street, aggressorHands, potOdds = null) {
        const win = parseFloat(winStr);
        if (isNaN(win) || !baseText) return baseText;

        const isPreflop = street === 'preflop';
        const isHeadsUp = numOpp <= 1;
        const hasDrawPct = /~\d+%|equity/.test(baseText); // draw messages already have equity baked in

        // Pot odds verdict — appended where call/fold decisions are at stake
        // Only fires postflop when we have a facing bet amount
        const _isDuke = hudSettings.coachPersonality === 'duke';
        const poVerdict = (!isPreflop && potOdds != null)
            ? (win > potOdds
                ? (_isDuke ? ` Need ${potOdds}% to call — the math's with you, kid.` : ` Need ${potOdds}% to call — you have the equity.`)
                : (_isDuke ? ` Need ${potOdds}% to call — odds ain't there, pal.` : ` Need ${potOdds}% to call — odds are against you.`))
            : '';

        // Premium preflop hands — never override, the advice is correct regardless of field
        if (isPreflop && /pocket aces|pocket kings|pocket queens|pocket jacks|pocket tens|cowboys/i.test(baseText))
            return baseText;
        // Draw messages already carry their own equity — leave them alone
        if (hasDrawPct) return baseText;
        // "Unbeatable" hands don't need equity context
        if (/unbeatable|cannot lose/i.test(baseText)) return baseText;

        // Confidence phrase — hedged when range data is sparse
        // MC can return 0 from 800 trials on a near-dead hand — show "< 1%" rather than "0%"
        const precise = aggressorHands >= 10;
        const pct = win < 1 ? '< 1%' : `${win}%`;
        const winWord = win < 1 ? 'under 1%' : (precise ? `sitting at ${win}%` : `around ${win}%`);

        // Detect what the base message is recommending
        const isValueBet = /bet for value|bet and build|extract|go for a call|charge draws|strong made|strong hand|strong one-pair|worth fighting for|bet between/i.test(baseText);
        const isFoldAdvice = /fold to pressure|fold and save|let it go|you have nothing|not worth it|walk away|drawing near-dead|bluff-catcher|easy fold/i.test(baseText);
        const isMarginal = /marginal|pot control|don't overcommit|be cautious|be wary|do not call big|keep it small|keep the pot small|watch out/i.test(baseText);
        const isOvercards = /unimproved but live|overcards facing a bet/i.test(baseText);

        // Get the hand noun from the start of the message (e.g. "Top pair", "Set", "Overpair")
        const nounMatch = baseText.match(/^(Full house|Flush|Straight|Quads|Set|Trips|Two pair|Overpair|Top pair|Low pair|[^.!,—\-]+)/);
        const noun = nounMatch ? nounMatch[1].trim() : baseText.split(' ').slice(0, 2).join(' ');

        // Win% brackets — context-aware (HU vs multi-way equity means different things)
        let bracket;
        if (isHeadsUp) {
            if (win >= 75) bracket = 'dominant';
            else if (win >= 60) bracket = 'strong';
            else if (win >= 45) bracket = 'competitive';
            else if (win >= 33) bracket = 'behind';
            else bracket = 'fold_territory';
        } else {
            if (win >= 60) bracket = 'dominant';
            else if (win >= 45) bracket = 'strong';
            else if (win >= 30) bracket = 'competitive';
            else if (win >= 18) bracket = 'behind';
            else bracket = 'fold_territory';
        }

        const oppStr = numOpp > 1 ? ` in a ${_activePlayers}-way pot` : '';

        // Deterministic variant picker — stable per message+equity combo, naturally varied across different spots
        const _seed = baseText.split('').reduce((a, c) => a + c.charCodeAt(0), 0) + Math.round(win);
        const _pick = (arr) => arr[_seed % arr.length];

        // WARNING: hand says bet/value but equity is bad — equity overrides the action
        if (isValueBet && (bracket === 'behind' || bracket === 'fold_territory')) {
            if (bracket === 'fold_territory') return _isDuke
                ? _pick([
                    `${noun} — but barely ${pct}${oppStr}. Get outta there. Duke don't fight wars with a bad number.`,
                    `${noun} at barely ${pct}${oppStr}. The number's telling you to stop. Don't put more in, pal.`,
                    `${noun}, but ${pct}${oppStr}. Cut your losses and walk.`,
                ])
                : _pick([
                    `${noun} — but barely ${pct}${oppStr}. This isn't a hand to fight with. Fold to any real pressure.`,
                    `${noun} at barely ${pct}${oppStr}. The number doesn't lie — don't put more in.`,
                    `${noun}, but ${pct}${oppStr}. Cut your losses. Fold to any pressure.`,
                ]);
            return _isDuke
                ? _pick([
                    `${noun} — but equity is only ${winWord}${oppStr}. Keep the pot small. Fold to a raise.`,
                    `${noun} at ${winWord}${oppStr}. Looks stronger than it is, kid — don't build this pot.`,
                    `${noun} — ${winWord}${oppStr}. That's a coin flip not a value hand. Keep it cheap.`,
                ])
                : _pick([
                    `${noun} — but equity is only ${winWord}${oppStr}. Keep the pot small. Fold to a raise.`,
                    `${noun} at ${winWord}${oppStr}. Looks stronger than it is — don't build this pot.`,
                    `${noun} — ${winWord}${oppStr}. Closer to a coin flip than a value hand. Keep it cheap.`,
                ]);
        }

        // UPGRADE: message is cautious but equity is actually good
        if (isMarginal && (bracket === 'dominant' || bracket === 'strong')) {
            const cleaned = baseText.replace(/\.$/, '');
            return _isDuke
                ? _pick([
                    `${cleaned} — though you're ${winWord}${oppStr}. More comfortable than it looks, kid.`,
                    `${cleaned} — but the number says ${winWord}${oppStr}. You got more room here than the board is trying to tell you.`,
                    `${cleaned}. Worth knowing: you're ${winWord}${oppStr}. Not as tight a spot as it feels.`,
                ])
                : _pick([
                    `${cleaned} — though you're ${winWord}${oppStr}. More comfortable than it looks.`,
                    `${cleaned} — but the equity says ${winWord}${oppStr}. You have more room here than the board suggests.`,
                    `${cleaned}. Worth noting: you're ${winWord}${oppStr}. Not as tight a spot as it feels.`,
                ]);
        }

        // MARGINAL CONFIRMED BAD: hand says cautious and equity agrees — reinforce with the number
        if (isMarginal && (bracket === 'behind' || bracket === 'fold_territory')) {
            if (bracket === 'fold_territory') return _isDuke
                ? _pick([
                    `${noun} — barely ${pct}${oppStr}.${poVerdict} This hand is dead weight. Fold.`,
                    `${noun} at ${pct}${oppStr}.${poVerdict} Not playable here, pal. Let it go.`,
                    `${noun} — ${pct}${oppStr}.${poVerdict} The number confirms it. Get out.`,
                ])
                : _pick([
                    `${noun} — barely ${pct}${oppStr}.${poVerdict} This hand has no value here. Fold.`,
                    `${noun} at ${pct}${oppStr}.${poVerdict} It's not playable here. Let it go.`,
                    `${noun} — ${pct}${oppStr}.${poVerdict} The equity confirms it. Get out.`,
                ]);
            return _isDuke
                ? _pick([
                    `${noun} — only ${winWord}${oppStr}. Keep it tiny and fold to any real heat.`,
                    `${noun} at ${winWord}${oppStr}. The equity ain't there — don't call anything substantial, kid.`,
                    `${noun} — ${winWord}${oppStr}. Marginal hand in a marginal spot. Minimum investment or walk, kid.`,
                ])
                : _pick([
                    `${noun} — only ${winWord}${oppStr}. Keep the pot very small. Fold to any real bet.`,
                    `${noun} at ${winWord}${oppStr}. The equity isn't there — don't call anything substantial.`,
                    `${noun} — ${winWord}${oppStr}. Marginal hand in a marginal spot. Minimum investment only.`,
                ]);
        }

        // FOLD REINFORCED: message already says fold and equity confirms it
        if (isFoldAdvice && bracket === 'fold_territory') return _isDuke
            ? _pick([
                `${baseText.replace(/\.$/, '')} — barely ${pct}${oppStr}. Get outta there.`,
                `${baseText.replace(/\.$/, '')} — ${pct}${oppStr}. Not worth another chip, pal.`,
                `${baseText.replace(/\.$/, '')} — the number confirms it at ${pct}${oppStr}. Walk.`,
            ])
            : _pick([
                `${baseText.replace(/\.$/, '')} — barely ${pct}${oppStr}. Walk away.`,
                `${baseText.replace(/\.$/, '')} — ${pct}${oppStr}. Not worth another chip.`,
                `${baseText.replace(/\.$/, '')} — equity confirms it at ${pct}${oppStr}. Go.`,
            ]);

        // PREFLOP MULTI-WAY: field dilution is the story, not hand strength
        if (isPreflop && numOpp >= 2) {
            if (bracket === 'fold_territory')
                return _isDuke
                    ? `${baseText.replace(/\.$/, '')} — too many in this pot now, barely ${pct}. Not worth it, pal.`
                    : `${baseText.replace(/\.$/, '')} — too many in now, barely ${pct}. Not worth it.`;
            if (bracket === 'behind')
                return _isDuke
                    ? `${baseText.replace(/\.$/, '')} — ${_activePlayers}-way pot has you ${winWord}. Tread careful, kid.`
                    : `${baseText.replace(/\.$/, '')} — ${_activePlayers}-way pot has you ${winWord}. Proceed carefully.`;
        }

        // CONFIRMING: hand-strength and equity agree in a multi-way pot where it actually matters
        if (bracket === 'dominant' && numOpp >= 2 && isValueBet) return _isDuke
            ? _pick([
                `${baseText.replace(/\.$/, '')} — even ${_activePlayers}-way you're ${winWord}. Push it, kid.`,
                `${baseText.replace(/\.$/, '')} — ${winWord} with ${_activePlayers} in it. Don't slow down.`,
                `${baseText.replace(/\.$/, '')} — the field ain't hurting you here, ${winWord}${oppStr}. Build the pot.`,
            ])
            : _pick([
                `${baseText.replace(/\.$/, '')} — even ${_activePlayers}-way you're ${winWord}. Push it.`,
                `${baseText.replace(/\.$/, '')} — ${winWord} with ${_activePlayers} in it. Don't slow down.`,
                `${baseText.replace(/\.$/, '')} — the field doesn't hurt you here, ${winWord}${oppStr}. Build the pot.`,
            ]);

        // OVERCARDS: equity IS the story — how live are they really?
        if (isOvercards) {
            const facingBet = /facing a bet/i.test(baseText);
            if (bracket === 'fold_territory') return facingBet
                ? (_isDuke
                    ? _pick([
                        `Overcards facing a bet — barely ${pct}${oppStr}. You ain't live enough to call. Get out.`,
                        `Overcards and barely ${pct}${oppStr}. Don't pay for a hope, pal. Fold.`,
                    ])
                    : _pick([
                        `Overcards facing a bet — barely ${pct}${oppStr}. Not live enough to call. Fold.`,
                        `Overcards and barely ${pct}${oppStr}. Not the price to pay for a hope. Fold.`,
                    ]))
                : (_isDuke
                    ? _pick([
                        `Overcards but barely ${pct}${oppStr}. This board hit them harder than it hit you. Don't chase.`,
                        `Overcards — ${pct}${oppStr}. They connect better with this board. Check it down or fold.`,
                    ])
                    : _pick([
                        `Overcards but barely ${pct}${oppStr}. They connect better with this board than you do. Don't chase.`,
                        `Overcards — ${pct}${oppStr}. This board hit them harder than it hit you. Check it down or fold.`,
                    ]));
            if (bracket === 'behind') return facingBet
                ? (_isDuke
                    ? _pick([
                        `Overcards facing a bet — ${winWord}${oppStr}.${poVerdict} Too thin to call real money, pal. Fold unless it's a probe.`,
                        `Overcards facing a bet — you're ${winWord}${oppStr}.${poVerdict} That ain't enough to call anything real. Fold.`,
                    ])
                    : _pick([
                        `Overcards facing a bet — ${winWord}${oppStr}.${poVerdict} Marginal call at best. Fold to anything bigger than a probe bet.`,
                        `Overcards facing a bet — you're ${winWord}${oppStr}.${poVerdict} Too thin to call anything real. Fold unless it's a minimum.`,
                    ]))
                : (_isDuke
                    ? _pick([
                        `Overcards — ${winWord}${oppStr}. Take the cheap street, that's all you get.`,
                        `Overcards at ${winWord}${oppStr}. You're live but trailing. One cheap look, nothing more.`,
                    ])
                    : _pick([
                        `Overcards — ${winWord}${oppStr}. Cheap look is fine, but don't go further without hitting.`,
                        `Overcards at ${winWord}${oppStr}. You're live but trailing. Take the cheap street, that's it.`,
                    ]));
            if (bracket === 'competitive' || bracket === 'strong') return facingBet
                ? (_isDuke
                    ? _pick([
                        `Overcards facing a bet — you're ${winWord}${oppStr}.${poVerdict || ' The equity backs a call if the price is right.'} Don't bloat this pot without a made hand.`,
                        `Overcards and ${winWord}${oppStr}.${poVerdict || " You can call a reasonable bet, kid — don't let em price you out cheap."}`,
                    ])
                    : _pick([
                        `Overcards facing a bet — you're ${winWord}${oppStr}.${poVerdict || ' The equity is there for a call if the price is right.'} Don't bloat the pot without a made hand.`,
                        `Overcards and ${winWord}${oppStr}.${poVerdict || " You can call a reasonable bet here — don't let them price you out cheap."}`,
                    ]))
                : (_isDuke
                    ? _pick([
                        `Overcards with real equity — ${winWord}${oppStr}. Worth a cheap street. Don't call big bets, but you're live.`,
                        `Overcards at ${winWord}${oppStr}. You're genuinely in this, pal. Take it cheap and see what the street brings.`,
                    ])
                    : _pick([
                        `Overcards with real equity — ${winWord}${oppStr}. Worth a cheap street. Don't call big bets, but you're live.`,
                        `Overcards at ${winWord}${oppStr}. You're genuinely in this. Take it cheaply and see what comes.`,
                    ]));
            return _isDuke
                ? _pick([
                    `Overcards — you're actually ${winWord}${oppStr}. Call a reasonable bet, this board ain't hurt you.`,
                    `Overcards but ${winWord}${oppStr}. Stronger than it looks, kid. Call a normal bet and see the next card.`,
                ])
                : _pick([
                    `Overcards — you're actually ${winWord}${oppStr}. Call a reasonable bet; this board hasn't hurt you.`,
                    `Overcards but ${winWord}${oppStr}. Stronger than it looks. Call a normal bet and see the next card.`,
                ]);
        }

        // Fallback: equity is always available — show it so the player can always see the number
        return baseText.replace(/\.$/, '') + ` (${pct})`;
    }

    // ── Bluff awareness system ────────────────────────────────────

    // Computes green score (how favourable bluffing conditions are) plus hard-stop flags.
    // oppRaw = raw active stats object (for per-street fold counts not in getDisplayMetrics)
    function computeBluffGreenScore(bl, oppDm, oppTypeKey, oppChecked, board, oppRaw) {
        const street = currentHand?.street || 'river';
        const isFlop = street === 'flop';
        const isTurn = street === 'turn';
        const isRiver = street === 'river';
        const n = oppDm?.n || 0;
        const dataReliable = n >= 8;
        const isPureBluff = !Object.values(bl.handStrengthAtBet || {}).includes('semi');

        let score = 0;
        let contextNote = null; // key reason surfaced in the coach message

        // ── Label-based scoring ──────────────────────────────────
        switch (oppTypeKey) {
            case 'NIT':
            case 'ROCK': score += 3; break;
            case 'TIGHT_PASSIVE': score += 2; break;
            case 'TAG': score += 1; break;
            case 'LAG':
                score -= 1;
                contextNote = _voice('Aggressive player — expect a fight-back or float more than a fold.', 'Aggressive player — they ain\'t foldin\'. Yous fire into them and they\'re comin\' right back.');
                break;
            case 'LOOSE_PASSIVE':
                score -= 2;
                contextNote = _voice('Passive Gambler calls wide — they are hard to push off a hand.', 'Passive Gambler — calls wide and don\'t let go. Yous can\'t bluff someone who ain\'t capable of folding.');
                break;
            case 'FISH':
                score -= 2;
                contextNote = _voice('Fish call to see cards — they rarely fold postflop.', 'Fish paid to see cards, pal. They ain\'t going nowhere — value bet em, don\'t try to bluff em out.');
                break;
            // MANIAC, CALLING_STATION are hard stops — handled below
        }

        // ── Per-street fold stats ────────────────────────────────
        // Flop fold-to-bet
        if (oppDm?.foldVsFlopBet != null) {
            if (oppDm.foldVsFlopBet >= 0.60) {
                score += 2;
                if (!contextNote) contextNote = _voice(
                    `Opponent folds flop bets ${Math.round(oppDm.foldVsFlopBet * 100)}% — strong fold target.`,
                    `Opponent folds ${Math.round(oppDm.foldVsFlopBet * 100)}% on the flop. They fold, kid.`
                );
            } else if (oppDm.foldVsFlopBet >= 0.45) {
                score += 1;
            } else if (oppDm.foldVsFlopBet < 0.30) {
                score -= 1;
            }
        }

        // Turn fold-to-bet (from raw stats — not exposed by getDisplayMetrics)
        const facedTurn = oppRaw?.facedTurnBetCount || 0;
        const foldTurnN = oppRaw?.foldedVsTurnBetCount || 0;
        const foldVsTurn = facedTurn >= 3 ? foldTurnN / facedTurn : null;
        if (foldVsTurn != null && (isTurn || isRiver)) {
            if (foldVsTurn >= 0.55) {
                score += 2;
                if (!contextNote) contextNote = _voice(
                    `Opponent folds turn bets ${Math.round(foldVsTurn * 100)}% — good barrel target.`,
                    `Opponent folds ${Math.round(foldVsTurn * 100)}% of turn bets. Barrel them, pal.`
                );
            } else if (foldVsTurn >= 0.40) {
                score += 1;
            } else if (foldVsTurn < 0.25) {
                score -= 1;
                if (!contextNote) contextNote = _voice(
                    `Opponent only folds ${Math.round(foldVsTurn * 100)}% to turn bets — they are stubborn on this street.`,
                    `Opponent folds ${Math.round(foldVsTurn * 100)}% on the turn, kid. They are not folding this street.`
                );
            }
        }

        // River fold-to-bet (from raw stats)
        const facedRiver = oppRaw?.facedRiverBetCount || 0;
        const foldRiverN = oppRaw?.foldedVsRiverBetCount || 0;
        const foldVsRiver = facedRiver >= 3 ? foldRiverN / facedRiver : null;
        if (foldVsRiver != null && isRiver) {
            if (foldVsRiver >= 0.50) {
                score += 2;
                if (!contextNote) contextNote = _voice(
                    `Opponent folds river bets ${Math.round(foldVsRiver * 100)}% — last street fold target.`,
                    `Opponent folds ${Math.round(foldVsRiver * 100)}% on the river, pal. Fire.`
                );
            } else if (foldVsRiver >= 0.35) {
                score += 1;
            } else if (foldVsRiver < 0.25) {
                score -= 2;
                if (!contextNote) contextNote = _voice(
                    `Opponent only folds ${Math.round(foldVsRiver * 100)}% on the river — they call rivers.`,
                    `Opponent folds ${Math.round(foldVsRiver * 100)}% on the river, kid. They are a river caller.`
                );
            }
        }

        // ── WTSD scoring ─────────────────────────────────────────
        const wtsd = oppDm?.wtsd || 0;
        if (wtsd < 0.25) score += 2;
        else if (wtsd < 0.35) score += 1;
        else if (wtsd > 0.50) score -= 1;

        // ── AFq: passive = won't fight back, aggressive = may re-raise ──
        if (oppDm?.afqReliable) {
            if (oppDm.afq < 0.15) score += 1;       // passive — checks/calls then folds
            else if (oppDm.afq > 0.50) score -= 1;  // fights back
        }

        // ── Position, opponent checked, board texture, equity, HU ──
        if (bl.position === 'LP') score += 1;
        if (oppChecked) score += 1;
        const tex = board?.length >= 3 ? analyzeBoardTexture(board) : null;
        if (tex && !tex.isFlushy && !tex.straightConnected && !tex.isPaired) score += 1;
        if (bl.handStrengthAtBet && Object.values(bl.handStrengthAtBet).some(s => s === 'semi')) score += 2;
        if (currentHand?.isHU) score += 1;

        // ── Thin data discount ───────────────────────────────────
        if (n > 0 && n < 8) score = Math.round(score * 0.6);

        // ── Hard stops ───────────────────────────────────────────
        const activePlayers = currentHand
            ? Object.values(currentHand.perPlayer).filter(p => !p.foldedPreflop && !p.foldedOnFlop).length
            : 1;

        let hardStop = false;
        let hardStopReason = null;

        if (oppTypeKey === 'MANIAC') {
            hardStop = true;
            hardStopReason = _voice(
                'Maniac — unpredictable and aggressive. They will not fold to pressure.',
                'Maniac at the table — yous bluffin\' them is just handin\' your chips over. Don\'t do it.'
            );
        } else if (oppTypeKey === 'CALLING_STATION') {
            hardStop = true;
            hardStopReason = _voice(
                'Calling station — they call everything down. Bluffing them is just donating chips.',
                'Calling station in the hand. Bluffin\' them ain\'t a play — it\'s a donation, pal. Duke don\'t bluff callers.'
            );
        } else if (oppTypeKey === 'FISH' && isRiver) {
            hardStop = true;
            hardStopReason = _voice(
                'Fish on the river — they called this far to see cards. They are not folding now.',
                'Fish on the river. They ain\'t callin\' three streets to lay it down now — Duke\'s seen this a thousand times. Don\'t bluff.'
            );
        } else if (wtsd > 0.55) {
            hardStop = true;
            hardStopReason = _voice(
                `Opponent goes to showdown ${Math.round(wtsd * 100)}% — they are not folding.`,
                `Opponent calls ${Math.round(wtsd * 100)}% to showdown. They are not folding this, pal.`
            );
        } else if (activePlayers >= 3) {
            hardStop = true;
            hardStopReason = _voice(
                'Three or more players in the pot — bluff equity collapses multiway.',
                'Three or more players in this pot. Bluffing into a crowd is just burning chips, pal.'
            );
        } else if (isRiver && isPureBluff && wtsd > 0.45) {
            hardStop = true;
            hardStopReason = _voice(
                `Pure bluff on the river into a ${Math.round(wtsd * 100)}% showdown caller. They will not fold.`,
                `River pure bluff into a ${Math.round(wtsd * 100)}% showdown caller. They are calling you down, kid.`
            );
        } else if (isRiver && isPureBluff && foldVsRiver != null && foldVsRiver < 0.20) {
            hardStop = true;
            hardStopReason = _voice(
                `Opponent only folds ${Math.round(foldVsRiver * 100)}% on the river — pure bluff here is burning chips.`,
                `Opponent folds ${Math.round(foldVsRiver * 100)}% on the river, kid. Pure bluff here is just giving chips away.`
            );
        } else if (isTurn && isPureBluff && foldVsTurn != null && foldVsTurn < 0.20) {
            hardStop = true;
            hardStopReason = _voice(
                `Opponent only folds ${Math.round(foldVsTurn * 100)}% to turn bets — they are not folding this street.`,
                `Opponent folds ${Math.round(foldVsTurn * 100)}% on the turn, pal. They are not folding this.`
            );
        }

        return { score, hardStop, hardStopReason, contextNote };
    }

    // Returns stack commitment risk level for a given bet amount relative to self stack at hand start.
    function getStackOffRisk(betAmt) {
        const selfStack = currentHand?.stackAtStart?.[localPlayerName] || 0;
        if (!selfStack || !betAmt) return 'safe';
        const pct = betAmt / selfStack;
        if (pct >= 0.80) return 'shipping';
        if (pct >= 0.60) return 'strong_warn';
        if (pct >= 0.40) return 'warn';
        return 'safe';
    }

    // Returns coaching advice when self has an active bluff line in progress.
    function getBluffLineAdvice(facingAction) {
        if (!currentHand?.selfBluffLine?.active) return null;
        const bl = currentHand.selfBluffLine;
        const street = currentHand.street || 'preflop';
        if (street === 'preflop') return null;
        if (isSelfFolded()) return null;

        const betStreets = bl.streets;
        const calledCount = bl.facingCallStreets.length;
        const isSemi = Object.values(bl.handStrengthAtBet).some(s => s === 'semi');
        const isRiver = street === 'river';
        const prevCount = betStreets.filter(s => s !== street).length;
        const barrelNote = prevCount > 0
            ? _voice(` (${prevCount} street${prevCount > 1 ? 's' : ''} invested)`, ` (${prevCount} street${prevCount > 1 ? 's' : ''} in already)`)
            : '';

        // Get opponent context for green score
        const all3 = getStats();
        const oppNames3 = Object.keys(currentHand.perPlayer)
            .filter(n => n !== localPlayerName && !currentHand.perPlayer[n].foldedPreflop && !currentHand.perPlayer[n].foldedOnFlop);
        const oppName3 = oppNames3[0] || null;
        const oppRaw3 = oppName3 ? resolveStatsByName(oppName3, all3) : null;
        const oppActive3 = oppRaw3 ? getActiveStats(oppRaw3, currentTableBB) : null;
        const oppDm3 = oppActive3 ? getDisplayMetrics(oppActive3) : null;
        const oppCls3 = oppDm3 ? classifyMetrics(oppActive3, oppActive3.handsObserved || 0) : null;
        const oppTypeKey3 = oppCls3 ? (Object.keys(TYPES).find(k => TYPES[k] === oppCls3.type) || 'UNKNOWN') : 'UNKNOWN';

        const currentLog3 = streetLogs[street] || [];
        const oppChecked3 = currentLog3.some(a => a.actionType === 'check' && a.playerName !== localPlayerName);
        const board3 = currentHand.boardCards.slice(0, 5);
        bl.position = getPlayerPosition(localPlayerName, currentHand) || 'MP';

        const gs = computeBluffGreenScore(bl, oppDm3, oppTypeKey3, oppChecked3, board3, oppActive3);

        // Table awareness: scan ALL active opponents for squeeze/re-raise risk
        // Semi-bluffs and bluffs into aggressive tables are much less profitable
        const tableAggWarning = (() => {
            if (oppNames3.length <= 1) return null;
            const all3stats = getStats();
            const aggressors = oppNames3.filter(n => {
                const raw = resolveStatsByName(n, all3stats);
                const active = raw ? getActiveStats(raw, currentTableBB) : null;
                const dm = active ? getDisplayMetrics(active) : null;
                const cls = dm ? classifyMetrics(active, active.handsObserved || 0) : null;
                const tk = cls ? (Object.keys(TYPES).find(k => TYPES[k] === cls.type) || 'UNKNOWN') : 'UNKNOWN';
                // Flag known aggressive types OR statistically confirmed high-PFR players
                return ['MANIAC', 'LAG'].includes(tk)
                    || (dm?.pfr != null && dm.pfr > 0.35 && (dm.n || 0) >= 8);
            });
            if (aggressors.length === 0) return null;
            const names = aggressors.slice(0, 2).join(' and ');
            return aggressors.length >= 2
                ? _voice(
                    `Table warning: ${names} are both aggressive — your bluff risks a squeeze. Only fire with strong equity.`,
                    `Table warning: ${names} are both playing aggressive — your bluff could get squeezed, kid. Only fire if your draw is strong.`
                )
                : _voice(
                    `${aggressors[0]} is aggressive — your bluff may get re-raised. Factor that in.`,
                    `${aggressors[0]} is aggressive, pal — your bluff could get squeezed. Think about it.`
                );
        })();


        const selfP4 = currentHand.perPlayer?.[localPlayerName];
        const lastBetAmt = selfP4?.betAmts?.length ? selfP4.betAmts[selfP4.betAmts.length - 1].amt : null;
        const stackRisk = getStackOffRisk(lastBetAmt);
        const stackWarn = {
            warn: _voice(' Warning: over 40% of stack committed.', ' Warning: over 40% of your stack, pal.'),
            strong_warn: _voice(' Over 60% of stack on the line.', ' Over 60% of your stack on the line, kid.'),
            shipping: _voice(' This is effectively a stack-off on a bluff.', ' You are shipping it on a bluff, pal.'),
            safe: '',
        }[stackRisk] || '';

        // Append contextNote when it adds useful info (why conditions are good or bad)
        const ctx = gs.contextNote ? ` ${gs.contextNote}` : '';

        // Hard stop — surfaces above everything else
        if (gs.hardStop) return gs.hardStopReason + stackWarn;

        // Bluff abandoned: bet a prior street then checked this one
        if (bl.abandonedOnStreet === street && betStreets.length > 0) {
            return _voice(
                `You bet ${betStreets.join('/')} then checked ${street}. Either commit to the line or don't start it — mixed lines are readable.`,
                `You bet ${betStreets.join('/')} then checked ${street}. Either you're in or you're out, pal. Half-measures are readable.`
            );
        }

        // Opponent called prior bluff and now checks — could be floating or weak
        if (calledCount > 0 && oppChecked3 && facingAction === 'check') {
            if (gs.score >= 4) return _voice(
                `They called your ${bl.facingCallStreets.join('/')} bet${barrelNote} and checked. Could be floating or drawing. Continuing here has fold equity.${ctx}${stackWarn}`,
                `They called your ${bl.facingCallStreets.join('/')} bet${barrelNote} then checked. Could be floating or weak. Fold equity is there.${ctx}${stackWarn}`
            );
            return _voice(
                `They called your ${bl.facingCallStreets.join('/')} bet${barrelNote} and checked. They showed interest — be cautious.${ctx}${stackWarn}`,
                `They called your ${bl.facingCallStreets.join('/')} bet${barrelNote} then checked. They have something. Be careful.${ctx}${stackWarn}`
            );
        }

        // Opponent called prior bluff and now bets — bluff likely dead
        if (calledCount > 0 && facingAction === 'bet') {
            return _voice(
                `You bet ${betStreets.join('/')} with nothing${barrelNote} and got called. Now they are betting — your bluff is likely dead. Fold unless you improved.`,
                `You fired ${betStreets.join('/')} with air${barrelNote} and they called. Now they are betting — bluff is dead, kid. Fold unless you hit something.`
            );
        }

        const tableWarn = tableAggWarning ? ` ${tableAggWarning}` : '';

        // Semi-bluff (draw exists)
        if (isSemi) {
            if (gs.score >= 5) return _voice(
                `Semi-bluff${barrelNote} — you have equity even if called. Good conditions.${ctx}${tableWarn}${stackWarn}`,
                `Semi-bluff${barrelNote} — equity is there even if they call. Good spot to keep firing.${ctx}${tableWarn}${stackWarn}`
            );
            if (gs.score >= 3) return _voice(
                `Semi-bluff${barrelNote} — draw is your backup. Mixed conditions.${ctx}${tableWarn}${stackWarn}`,
                `Semi-bluff${barrelNote} — draw backs you up. Mixed conditions, read the player.${ctx}${tableWarn}${stackWarn}`
            );
            return _voice(
                `Semi-bluff${barrelNote} — poor conditions. Consider checking and taking the free card.${ctx}${tableWarn}${stackWarn}`,
                `Semi-bluff${barrelNote} — poor spot, pal. Check and take the free card.${ctx}${tableWarn}${stackWarn}`
            );
        }

        // Pure bluff
        if (isRiver) {
            if (gs.score >= 5) return _voice(
                `Pure bluff on the river${barrelNote} — conditions are in your favour. Last chance.${ctx}${tableWarn}${stackWarn}`,
                `Pure bluff on the river${barrelNote} — conditions say go. Last shot, make it count.${ctx}${tableWarn}${stackWarn}`
            );
            if (gs.score >= 3) return _voice(
                `Pure bluff on the river${barrelNote} — marginal spot. No draw to fall back on.${ctx}${tableWarn}${stackWarn}`,
                `Pure bluff on the river${barrelNote} — marginal, pal. Nothing backing this.${ctx}${tableWarn}${stackWarn}`
            );
            return _voice(
                `Pure bluff on the river${barrelNote} — poor conditions. High chance of getting called.${ctx}${tableWarn}${stackWarn}`,
                `Pure bluff on the river${barrelNote} — bad conditions, kid. They are calling you.${ctx}${tableWarn}${stackWarn}`
            );
        }

        if (gs.score >= 5) return _voice(
            `Bluff${barrelNote} — good conditions. Opponent has a folding profile.${ctx}${tableWarn}${stackWarn}`,
            `Bluff${barrelNote} — good conditions, pal. Opponent folds.${ctx}${tableWarn}${stackWarn}`
        );
        if (gs.score >= 3) return _voice(
            `Bluff${barrelNote} — marginal spot.${ctx}${tableWarn}${stackWarn}`,
            `Bluff${barrelNote} — mixed bag, pal. Could work, could blow up. Read the room.${ctx}${tableWarn}${stackWarn}`
        );
        return _voice(
            `Bluff${barrelNote} — poor conditions. Opponent is unlikely to fold.${ctx}${tableWarn}${stackWarn}`,
            `Bluff${barrelNote} — poor conditions, kid. Opponent is not folding this.${ctx}${tableWarn}${stackWarn}`
        );
    }

    // Updates session bluff tracker. Called at hand end when self had an active bluff line.
    function updateSessionBluffOutcome(won, streets) {
        sessionBluffs.attempted++;
        if (won) { sessionBluffs.won++; sessionBluffs.consecutiveFails = 0; }
        else { sessionBluffs.lost++; sessionBluffs.consecutiveFails++; }
        for (const s of (streets || [])) {
            if (!sessionBluffs.byStreet[s]) continue;
            if (won) sessionBluffs.byStreet[s].w++;
            else sessionBluffs.byStreet[s].l++;
        }
    }

    // Returns session-level bluff meta advice when patterns emerge (3+ consecutive fails or 5+ attempts).
    function getSessionBluffMetaAdvice() {
        if (sessionBluffs.consecutiveFails >= 3) return _voice(
            `You have missed ${sessionBluffs.consecutiveFails} bluffs in a row. The table is reading you. Slow down and find a better spot.`,
            `${sessionBluffs.consecutiveFails} bluffs missed back to back. The table is onto you, kid. Slow down.`
        );
        if (sessionBluffs.attempted >= 5) {
            const rate = sessionBluffs.won / sessionBluffs.attempted;
            if (rate < 0.30) return _voice(
                `Bluff success rate is ${Math.round(rate * 100)}% this session (${sessionBluffs.won}/${sessionBluffs.attempted}). Pick spots against folders only.`,
                `Bluffing at ${Math.round(rate * 100)}% success this session (${sessionBluffs.won}/${sessionBluffs.attempted}). You are picking bad spots, kid. Stop bluffing callers.`
            );
            if (rate > 0.70 && sessionBluffs.attempted >= 7) return _voice(
                `Bluffs landing ${Math.round(rate * 100)}% this session. Good run — don't get greedy with it.`,
                `${Math.round(rate * 100)}% bluff success this session. Good run, pal — don't push your luck.`
            );
        }
        return null;
    }

    // Computes pot odds, SPR, and range advantage for the current decision point.
    // Only meaningful postflop — returns nulls preflop.
    // Bet size is pulled from aggressionHistory (getFacingActionFromDOM only returns 'bet'/'check', not the amount).
    function computeGTOMath(facingAction, aggressor) {
        if (!currentHand || currentHand.street === 'preflop') return { potOdds: null, spr: null, rangeAdv: null, mdf: null };

        const pot = currentHand.runningPot || 0;

        // Pot odds: minimum equity % needed to call profitably.
        // MDF: minimum defence frequency vs this bet size, potBefore / (potBefore + bet).
        // Folding more often than (100 - MDF)% lets a pure bluff show automatic profit.
        let potOdds = null, mdf = null;
        if ((facingAction === 'bet' || facingAction === 'shove') && aggressor?.name && pot > 0) {
            const agHist = currentHand.aggressionHistory?.[aggressor.name] || [];
            const lastAct = agHist[agHist.length - 1];
            if (lastAct?.street === currentHand.street && lastAct?.amount > 0) {
                potOdds = potOddsPct(lastAct.amount, pot);
                const potBefore = pot - lastAct.amount; // runningPot already includes the bet
                if (potBefore > 0) mdf = Math.round(100 * potBefore / (potBefore + lastAct.amount));
            }
        }

        // SPR: effective stack (min of hero vs villain remaining) divided by pot
        let spr = null;
        if (pot > 0) {
            const selfIn = currentHand.playerPotContrib?.[localPlayerName] || 0;
            const selfStart = currentHand.stackAtStart?.[localPlayerName] || 0;
            const selfRem = Math.max(selfStart - selfIn, 0);
            let effStack = selfRem;
            if (aggressor?.name) {
                const villIn = currentHand.playerPotContrib?.[aggressor.name] || 0;
                const villStart = currentHand.stackAtStart?.[aggressor.name] || 0;
                const villRem = Math.max(villStart - villIn, 0);
                effStack = Math.min(selfRem, villRem);
            }
            if (effStack > 0) spr = parseFloat((effStack / pot).toFixed(1));
        }

        // Range advantage: preflop raiser has edge on high dry boards; caller has edge on low wet boards
        let rangeAdv = null;
        const board = (currentHand.boardCards || []).filter(Boolean);
        if (board.length >= 3) {
            const texture = analyzeBoardTexture(board);
            const selfWasRaiser = !!(currentHand.perPlayer?.[localPlayerName]?.raisedPreflop);
            if (texture) {
                const boardVals = board.map(c => RANK_VALUES[c.slice(0, -1)] || 0).filter(Boolean);
                const highCard = boardVals.length > 0 && Math.max(...boardVals) >= 11; // J or higher
                const isDry = !texture.isFlushy && !texture.straightConnected;
                if (selfWasRaiser && highCard && isDry) rangeAdv = 'hero';
                else if (!selfWasRaiser && !highCard && !isDry) rangeAdv = 'hero';
                else if (selfWasRaiser && !highCard && !isDry) rangeAdv = 'villain';
                else if (!selfWasRaiser && highCard && isDry) rangeAdv = 'villain';
            }
        }

        return { potOdds, spr, rangeAdv, mdf };
    }

    function isSelfFolded() {
        if (!currentHand || !localPlayerName) return false;
        if (currentHand.perPlayer?.[localPlayerName]?.foldedPreflop) return true;
        if (currentHand.selfFoldStreet) return true;
        return false;
    }

    function buildFoldedEntry() {
        const foldStreet = currentHand?.selfFoldStreet;
        const streetLabel = foldStreet
            ? (foldStreet.charAt(0).toUpperCase() + foldStreet.slice(1))
            : 'Preflop';

        // Use the equity that was shown to the player at fold time — it was range-weighted and already
        // displayed in the coach. Re-running Monte Carlo here would give a different number because
        // the live coach uses aggressorCombos range-weighting that can't be reconstructed post-fold.
        const holeCards = currentHand?.selfHoleCards;
        const boardAtFold = currentHand?.selfBoardAtFold ?? [];
        let equity = currentHand?.selfFoldEquity != null ? parseFloat(currentHand.selfFoldEquity) : null;

        const hadEquity = equity != null && !isNaN(equity);
        const eq = hadEquity ? Math.round(equity) : null;

        // Opponent context
        const aggressor = getLastOpponentAggressor();
        const facedBet = !!aggressor;
        const agType = aggressor?.typeKey || null;
        const isWideOpp = agType === 'FISH' || agType === 'MANIAC' || agType === 'LAG' || agType === 'CALLING_STATION';
        const isTightOpp = agType === 'NIT' || agType === 'ROCK' || agType === 'TIGHT_PASSIVE';

        // Aggressor bluff rate from verdict history
        const agRaw = aggressor?.name ? resolveStatsByName(aggressor.name) : null;
        const agActive = agRaw ? getActiveStats(agRaw, currentTableBB) : null;
        const agTv = agActive ? (agActive.totalVerdicts || 0) : 0;
        const agBluffRate = agTv >= 5 ? (agActive.bluffCount || 0) / agTv : null;
        const isFreqBluff = agBluffRate !== null && agBluffRate >= 0.35;

        // What the coach last recommended
        const coachSaidFold = lastOwnLean ? /\bfold\b/i.test(lastOwnLean) : null;
        const coachSaidCall = !coachSaidFold && !!lastOwnLean && hadEquity && equity >= 30;

        // Draw detection from last coach advice text
        const hadDraw = !!lastOwnLean && /\b(flush draw|straight draw|OESD|gutshot|\d+ outs)\b/i.test(lastOwnLean);

        // Pot odds needed to break even on last turn (saved when coach last fired)
        const oddsNeeded = lastPotOddsNeeded;
        const priceWasGood = hadEquity && oddsNeeded !== null && equity > oddsNeeded + 5;
        const priceWasBad = hadEquity && oddsNeeded !== null && equity < oddsNeeded - 5;

        // What the hand looked like at fold time, and what happened after
        const handDesc = describeFoldHandAtStreet(holeCards, boardAtFold);
        const finalBoard = currentHand?.boardCards || [];
        const outcomeStr = describeFoldOutcome(holeCards, boardAtFold, finalBoard);

        // Sentence fragments assembled per branch
        const handCtx = handDesc
            ? (boardAtFold.length ? `Had ${handDesc} on the ${streetLabel.toLowerCase()}` : `Had ${handDesc} preflop`)
            : null;
        const outcomeSuffix = outcomeStr
            ? `${outcomeStr.charAt(0).toUpperCase()}${outcomeStr.slice(1)}.`
            : null;

        let mainMsg;
        let coachNote = null;

        if (hadEquity && equity >= 55) {
            // Strong favorite — biggest coaching opportunity
            const opening = handCtx
                ? _voice(`${handCtx}, ~${eq}% to win when you folded — you were the favorite.`,
                    `${handCtx}, ~${eq}% to win when you folded — you were the favorite, kid.`)
                : _voice(`~${eq}% to win when you folded — you were the favorite.`,
                    `~${eq}% to win when you folded — you were the favorite, kid.`);
            mainMsg = outcomeSuffix ? `${opening} ${outcomeSuffix}` : opening;
            coachNote = _voice(
                `Getting out when you are ahead that much costs real expected value over time. Think about what pushed you off this hand.`,
                `Getting out when you are ahead costs real money over time, pal. Worth thinking about what pushed you off this one.`
            );
        } else if (hadEquity && equity >= 38) {
            const opening = handCtx
                ? _voice(`${handCtx}, ~${eq}% to win when you folded.`,
                    `${handCtx}, ~${eq}% to win when you folded, kid.`)
                : _voice(`~${eq}% to win when you folded.`,
                    `~${eq}% to win when you folded, kid.`);
            const suffix = outcomeSuffix ? ` ${outcomeSuffix}` : '';

            if (coachSaidCall && facedBet && priceWasGood) {
                mainMsg = _voice(
                    `${opening} The price was right too — only needed ~${Math.round(oddsNeeded)}% to call.${suffix}`,
                    `${opening} Price was right too — only needed ~${Math.round(oddsNeeded)}% to call.${suffix}`
                );
                coachNote = _voice(
                    `When the pot odds are in your favor and you have equity, staying in is the play.`,
                    `When the price is right and you have equity, you stay in. Keep that in mind, pal.`
                );
            } else if (isFreqBluff && facedBet) {
                mainMsg = _voice(
                    `${opening} ${aggressor.name} bluffs a fair amount — ${Math.round(agBluffRate * 100)}% bluff rate.${suffix}`,
                    `${opening} ${aggressor.name} bluffs a lot — ${Math.round(agBluffRate * 100)}% bluff rate, kid.${suffix}`
                );
                coachNote = _voice(
                    `Against a frequent bluffer with this much equity, staying in is usually right. Their range is wider than it looks.`,
                    `Against a frequent bluffer with this much equity, you stay in. Their range is wider than it looks, pal.`
                );
            } else if (isWideOpp && facedBet) {
                mainMsg = _voice(
                    `${opening} ${aggressor.name} plays a wide range.${suffix}`,
                    `${opening} ${aggressor.name} plays wide, kid.${suffix}`
                );
                coachNote = _voice(
                    `Against players who bet wide, your equity goes further. This was a spot to consider calling.`,
                    `Against wide bettors your equity goes further. This was a spot to stay in, pal.`
                );
            } else if (isTightOpp && facedBet) {
                mainMsg = _voice(
                    `${opening} ${aggressor.name} is tight though — their betting range is narrow, so your equity may not be as clean as it looks.${suffix}`,
                    `${opening} ${aggressor.name} is tight though, kid — their betting range is narrow. Your equity might be tighter against their actual hand.${suffix}`
                );
            } else if (hadDraw) {
                mainMsg = _voice(
                    `${opening} Draw with that much equity — it comes down to price. If the pot was charging more than ${eq}%, fold was correct.${suffix}`,
                    `${opening} Draw with that equity, kid. It comes down to price. If they were charging more than ${eq}%, fold was right.${suffix}`
                );
            } else if (priceWasGood) {
                mainMsg = _voice(
                    `${opening} Only needed ~${Math.round(oddsNeeded)}% to call — the price was right.${suffix}`,
                    `${opening} Only needed ~${Math.round(oddsNeeded)}% to call, kid — the price was right.${suffix}`
                );
                coachNote = _voice(
                    `When equity beats pot odds, the call is profitable long-term. This was one of those spots.`,
                    `Equity beats pot odds means the call is profitable. This was one of those spots, pal.`
                );
            } else {
                mainMsg = facedBet
                    ? _voice(`${opening} If it hits the board after, that is variance — you played what was in front of you.${suffix}`,
                        `${opening} If it hits after, that is variance, kid. You played what was in front of you.${suffix}`)
                    : _voice(`${opening}${suffix}`,
                        `${opening}${suffix}`);
            }
        } else if (hadEquity && equity >= 22) {
            // Marginal range
            const opening = handCtx
                ? _voice(`${handCtx}, ~${eq}% to win when you folded.`,
                    `${handCtx}, ~${eq}% to win when you folded, pal.`)
                : _voice(`~${eq}% to win when you folded.`,
                    `~${eq}% to win when you folded, pal.`);
            const suffix = outcomeSuffix ? ` ${outcomeSuffix}` : '';

            if (priceWasBad && facedBet) {
                mainMsg = _voice(
                    `${opening} Price wasn't right though — they were asking more than the math justified.${suffix} Right fold.`,
                    `${opening} Price wasn't right though, pal — they were asking more than the math justified.${suffix} Right fold.`
                );
            } else if (isTightOpp && facedBet) {
                mainMsg = _voice(
                    `${opening} ${aggressor.name} is a tight player — narrow range means your equity may be against stronger hands.${suffix} Fold is defensible.`,
                    `${opening} ${aggressor.name} is tight — narrow range, your equity is against their real hands.${suffix} Fold is defensible, pal.`
                );
            } else if (hadDraw) {
                mainMsg = _voice(
                    `${opening} Draw equity needs the right price — if the odds weren't there, folding is correct.${suffix}`,
                    `${opening} Draw equity needs the right price, pal. If the odds weren't there, fold was right.${suffix}`
                );
            } else {
                mainMsg = _voice(
                    `${opening}${facedBet ? ' Marginal facing aggression.' : ' Marginal spot.'} Thin edge — protecting chips is reasonable.${suffix}`,
                    `${opening}${facedBet ? ' Marginal with a bet in your face.' : ' Marginal spot, pal.'} Thin edge — protecting chips is reasonable.${suffix}`
                );
            }
        } else if (hadEquity) {
            // Clear underdog — validate the fold, with specific tone based on what happened after
            const outcomeRank = outcomeStr
                ? (/quads|full house|flush|straight|set/.test(outcomeStr) ? 'big' : 'small')
                : null;

            // Opponent context suffix (appended when relevant)
            const oppCtx = isTightOpp && facedBet
                ? _voice(` ${aggressor.name} is tight — their range had you in bad shape there.`,
                    ` ${aggressor.name} is tight, kid — their range had you in bad shape.`)
                : isWideOpp && facedBet
                    ? _voice(` Even against someone who plays wide, that equity is not enough.`,
                        ` Even against a wide player, kid — that equity is not enough.`)
                    : '';

            const handPrefix = handCtx ? `${handCtx}. ` : '';

            if (outcomeRank === 'big') {
                // Something good hit after — acknowledge it, then ground the decision
                const hitWhat = outcomeStr.replace(/^you would have (made |hit )?|^your /i, '').replace(/ would have (come in|hit)$/, '');
                mainMsg = _voice(
                    `${handPrefix}That ${hitWhat} hit after you folded. Stings to watch. But at ~${eq}% you were a big dog going in — you would need that to come in roughly 1 in ${Math.round(100 / Math.max(eq, 1))} times just to break even on a call. Most of the time it does not, and you lose the chips. You played it right.${oppCtx}`,
                    `${handPrefix}Yeah, that ${hitWhat} hit after. I know that feeling, kid. But at ~${eq}% you were a ${Math.round(100 / Math.max(eq, 1))}-to-1 dog. You fold that spot every time you are in it and you will still have chips when others are reloading. Do not let the result shake your read.${oppCtx}`
                );
                coachNote = _voice(
                    `Results and decisions are separate. A bad result does not mean a bad decision — at those odds, folding is correct far more often than it fails you.`,
                    `Results and decisions are not the same thing. Bad result does not mean bad decision. At those odds, folding is right far more often than variance burns you.`
                );
            } else if (outcomeRank === 'small') {
                // Minor improvement (pair, two pair) hit after
                mainMsg = _voice(
                    `${handPrefix}You would have picked up something small after the fold. At ~${eq}% though, most of the time that does not come, and you are paying off a better hand. Right fold.${oppCtx}`,
                    `${handPrefix}You would have caught something small after. But at ~${eq}%, kid — most times that card does not come. You made the right read, do not second-guess it.${oppCtx}`
                );
            } else if (outcomeStr === null && finalBoard.length > boardAtFold.length) {
                // Board ran out and nothing interesting happened — clean confirmation
                mainMsg = _voice(
                    `${handPrefix}Only ~${eq}% when you folded${facedBet ? ' facing that pressure' : ''}. Board ran out and gave you nothing useful either. Math was right, cards confirmed it.${oppCtx}`,
                    `${handPrefix}Only ~${eq}% when you folded${facedBet ? ' with them firing' : ''}, kid. Board ran out and gave you nothing. Math was right and the cards backed it up.${oppCtx}`
                );
            } else {
                // Outcome not known yet or neutral
                mainMsg = _voice(
                    `${handPrefix}Only ~${eq}% when you folded${facedBet ? ' facing that pressure' : ''}. Right fold — at those odds the chips are better saved for a cleaner spot.${oppCtx}`,
                    `${handPrefix}Only ~${eq}% when you folded${facedBet ? ' with them firing' : ''}, kid. Right fold — at those odds your chips belong somewhere better.${oppCtx}`
                );
            }
        } else if (facedBet) {
            const opening = handCtx
                ? _voice(`${handCtx}.`, `${handCtx}, pal.`)
                : '';
            mainMsg = _voice(
                `${opening ? opening + ' ' : ''}Folded to aggression on the ${streetLabel.toLowerCase()}. No equity data, but you played what was in front of you. If something hit after, that is variance.`,
                `${opening ? opening + ' ' : ''}Folded to aggression on the ${streetLabel.toLowerCase()}, pal. You play what is in front of you, not what the board shows after.`
            );
        } else {
            mainMsg = _voice(
                `You folded on the ${streetLabel.toLowerCase()}${handCtx ? ` with ${handDesc}` : ''}. Watching the hand play out.`,
                `You folded on the ${streetLabel.toLowerCase()}${handCtx ? ` with ${handDesc}` : ''}, pal. Sit tight and watch.`
            );
        }

        const entry = document.createElement('div');
        entry.className = 'tphud-coach-entry tphud-coach-self';
        const nameRow = document.createElement('div');
        nameRow.className = 'tphud-coach-name-row';
        const nameEl = document.createElement('span');
        nameEl.className = 'tphud-coach-name tphud-coach-name-self';
        nameEl.textContent = localPlayerName || 'You';
        nameRow.appendChild(nameEl);
        entry.appendChild(nameRow);
        const mainEl = document.createElement('div');
        mainEl.className = 'tphud-coach-entry-msg';
        mainEl.textContent = mainMsg;
        entry.appendChild(mainEl);
        if (coachNote) {
            const noteEl = document.createElement('div');
            noteEl.className = 'tphud-coach-entry-msg tphud-coach-self-note';
            noteEl.textContent = coachNote;
            entry.appendChild(noteEl);
        }
        return entry;
    }

    function buildSelfEntry() {
        if (isSelfFolded()) return buildFoldedEntry();
        const aggressor = getLastOpponentAggressor();
        let facingAct = getFacingActionFromDOM();
        // Upgrade 'bet' to 'shove' if the bet commits ≥80% of aggressor's remaining stack
        if (facingAct === 'bet' && aggressor?.name && currentHand) {
            const agHist = currentHand.aggressionHistory?.[aggressor.name] || [];
            const lastAg = agHist[agHist.length - 1];
            if (lastAg?.street === currentHand.street && lastAg?.amount > 0) {
                const agIn = currentHand.playerPotContrib?.[aggressor.name] || 0;
                const agStart = currentHand.stackAtStart?.[aggressor.name] || 0;
                const stackBeforeBet = Math.max(agStart - agIn + lastAg.amount, lastAg.amount);
                if (agStart > 0 && lastAg.amount / stackBeforeBet >= 0.8) facingAct = 'shove';
            }
        }
        const gtoMath = computeGTOMath(facingAct, aggressor);
        lastPotOddsNeeded = gtoMath.potOdds ?? null;
        const street = currentHand?.street || 'preflop';
        // Pass 'bet' to getOwnHandLean for shoves — hand-type advice is the same; shove overlay added after MC
        let ownLean = getOwnHandLean(facingAct === 'shove' ? 'bet' : facingAct, aggressor, gtoMath.potOdds, gtoMath.spr, facingAct === 'shove');
        const _pp = currentHand?.perPlayer || {};
        const _activePlayers = Object.keys(_pp).filter(name => {
            if (_pp[name].foldedPreflop) return false;
            if (_pp[name].foldedOnFlop) return false;
            if (_pp[name].turn?.folds > 0) return false;
            if (_pp[name].river?.folds > 0) return false;
            return true;
        }).length;
        const numOpp = Math.max(1, _activePlayers - 1);
        if (ownLean && currentHand?.selfHoleCards?.length === 2) {
            const board = (currentHand.boardCards || []).filter(Boolean);
            const pp = _pp;
            // Build range-weighted combos — isolated try so a range error doesn't kill the MC
            let aggressorCombos = null;
            let actionType = null;
            try {
                if (aggressor?.name) {
                    const agPP = pp[aggressor.name] || {};
                    const agStack = currentHand.stackAtStart?.[aggressor.name] || 9999;
                    const ratio = agPP.preflopRaiseAmt > 0 ? agPP.preflopRaiseAmt / agStack : 0;
                    if (agPP.raisedPreflop) {
                        actionType = ratio >= 0.3 ? 'shove' : agPP.threeBet ? 'threeBet' : 'raise';
                    }
                    if (actionType) {
                        // Use actual PFR/3bet stats when available, fall back to badge-based static range
                        const agRaw = resolveStatsByName(aggressor.name);
                        const agActive = agRaw ? getActiveStats(agRaw, currentTableBB) : null;
                        const agDm = agActive ? getDisplayMetrics(agActive) : null;
                        let rangeHands;
                        if (agDm && agDm.pfr != null && agDm.n >= 10) {
                            rangeHands = _statsBasedRange(agDm.pfr, agDm.threeBetPct, actionType);
                        } else {
                            rangeHands = (_RANGES[aggressor.typeKey] || {})[actionType];
                        }
                        if (rangeHands) {
                            aggressorCombos = _buildRangeCombos(rangeHands, [...currentHand.selfHoleCards, ...board]);
                            // Multi-barrel tightening: 2+ postflop bets signals a stronger range
                            const aggHistory = currentHand.aggressionHistory?.[aggressor.name] || [];
                            const postflopBets = aggHistory.filter(e => e.street !== 'preflop' && (e.actionType === 'bet' || e.actionType === 'raise')).length;
                            if (postflopBets >= 2) {
                                aggressorCombos = aggressorCombos.slice(0, Math.max(1, Math.round(aggressorCombos.length * 0.6)));
                            }
                            // Bayesian narrowing: survived bets on each street reduce range to calling fraction
                            if (agDm) {
                                if (street === 'turn' || street === 'river') {
                                    aggressorCombos = _bayesianNarrow(aggressorCombos, agDm.foldVsFlopBet);
                                }
                                if (street === 'river') {
                                    const facedTurn = agActive.facedTurnBetCount || 0;
                                    const foldTurn = agActive.foldedVsTurnBetCount || 0;
                                    const foldVsTurn = facedTurn >= 5 ? foldTurn / facedTurn : null;
                                    aggressorCombos = _bayesianNarrow(aggressorCombos, foldVsTurn);
                                }
                            }
                        }
                    }
                }
            } catch { /* range build failed — MC runs with null combos (random hands) */ }
            // Non-aggressor villains still in the hand get VPIP-based ranges instead of
            // random hands: preflop callers do not hold random cards, and modeling them
            // matters most multiway.
            let villainCombos = null;
            try {
                const exclude = [...currentHand.selfHoleCards, ...board];
                const built = Object.keys(pp)
                    .filter(n =>
                        n !== localPlayerName &&
                        n !== (aggressor?.name || '') &&
                        !pp[n].foldedPreflop && !pp[n].foldedOnFlop &&
                        !(pp[n].turn?.folds > 0) && !(pp[n].river?.folds > 0))
                    .map(n => _villainRangeCombos(n, exclude))
                    .filter(Boolean);
                if (built.length) villainCombos = built;
            } catch { /* villain range build failed, those opponents stay random */ }
            // MC always runs regardless of range build outcome
            try {
                const cacheKey = `${currentHand.selfHoleCards.join(',')}|${board.join(',')}|${numOpp}|${aggressor?.name || ''}|${actionType || ''}|vm${villainCombos ? villainCombos.length : 0}`;
                if (_oddsCache.key !== cacheKey) {
                    const { win } = _monteCarlo(currentHand.selfHoleCards, board, 800, numOpp, aggressorCombos, villainCombos);
                    _oddsCache = { key: cacheKey, win };
                }
            } catch { /* MC unavailable — _oddsCache keeps last value */ }
            // _applyWinContext always runs — uses whatever win% we have
            try {
                ownLean = _applyWinContext(ownLean, _oddsCache?.win, numOpp, street, aggressor?.handsObserved || 0, gtoMath.potOdds);
            } catch { /* keep raw advice text */ }
        }
        // Mixed strategy note — appended when equity and pot odds are within 10pts of each other
        if (ownLean && facingAct === 'bet' && street !== 'preflop' && gtoMath.potOdds != null) {
            const win = parseFloat(_oddsCache?.win);
            if (!isNaN(win)) {
                const mixNote = getMixNote(win, gtoMath.potOdds, null);
                if (mixNote) ownLean = ownLean + mixNote;
            }
        }

        // Shove overlay — prepends explicit call/fold math when facing an all-in
        if (facingAct === 'shove' && ownLean && street !== 'preflop') {
            const _isDuke = hudSettings.coachPersonality === 'duke';
            const win = parseFloat(_oddsCache?.win);
            const needed = gtoMath.potOdds;
            if (!isNaN(win) && needed != null) {
                const margin = win - needed;
                let shoveNote;
                if (margin >= 8) {
                    shoveNote = _isDuke
                        ? `Shove. Need ${needed}% to call and you've got ~${win}% — that's a call, kid.`
                        : `Facing a shove — need ${needed}% to call. You have ~${win}% equity. Call.`;
                } else if (margin >= -8) {
                    shoveNote = _isDuke
                        ? `Shove. Need ${needed}%, sitting at ~${win}% — right on the line, pal. Trust your read.`
                        : `Facing a shove — need ${needed}% to call, you have ~${win}%. Breakeven spot — use your read on them.`;
                } else {
                    shoveNote = _isDuke
                        ? `Shove. Need ${needed}% to call but only got ~${win}% — Duke folds here, pal.`
                        : `Facing a shove — need ${needed}% to call. You only have ~${win}%. Fold.`;
                }
                ownLean = shoveNote + ' ' + ownLean;
            }
        }

        // Range advantage — flop only, heads-up only (HU range logic doesn't hold in multiway pots)
        // Skipped against Fish/Calling Station/Maniac — they don't play by range theory, advice is misleading
        const _rangeBlindTypes = ['FISH', 'CALLING_STATION', 'MANIAC'];
        if (gtoMath.rangeAdv && ownLean && street === 'flop' && numOpp <= 1 && !_rangeBlindTypes.includes(aggressor?.typeKey)) {
            const oppName = aggressor?.name || null;
            const opp = oppName || 'your opponent';
            // Vary wording per hand using first board card as seed
            const v = (currentHand.boardCards?.[0]?.charCodeAt(0) || 0) % 3;
            const heroVars = [
                'You have the range edge on this board. ',
                'This board connects better with your range. ',
                'Your preflop range hits this board harder. ',
            ];
            const heroVarsDuke = [
                'You have the range edge here, kid. ',
                "This board's yours — your range hits it harder. ",
                'Your range connects better with this board, kid. ',
            ];
            const villVars = [
                `${opp} has the range edge on this board — tread carefully. `,
                `This board connects better with ${opp}'s range — be cautious. `,
                `${opp}'s range hits this board harder — careful. `,
            ];
            const villVarsDuke = [
                `${opp} has the range edge here — careful, pal. `,
                `This board's ${opp}'s territory — their range hits it harder. `,
                `${opp}'s range connects better here — watch yourself, kid. `,
            ];
            const rangePrefix = _voice(
                gtoMath.rangeAdv === 'hero' ? heroVars[v] : villVars[v],
                gtoMath.rangeAdv === 'hero' ? heroVarsDuke[v] : villVarsDuke[v]
            );
            ownLean = rangePrefix + ownLean;
        }
        const bluffAdvice = getBluffLineAdvice(facingAct);
        const selfNote = hudSettings.showSelfNote !== false ? getSelfCoachNote() : null;
        const narrativeNote = getHandNarrativeNote();
        if (!ownLean && !selfNote && !narrativeNote && !bluffAdvice) return null;

        const entry = document.createElement('div');
        entry.className = 'tphud-coach-entry tphud-coach-self';

        const nameRow = document.createElement('div');
        nameRow.className = 'tphud-coach-name-row';
        const nameEl = document.createElement('span');
        nameEl.className = 'tphud-coach-name tphud-coach-name-self';
        nameEl.textContent = localPlayerName || 'You';
        nameRow.appendChild(nameEl);
        entry.appendChild(nameRow);

        // Bluff line advice — highest priority, shown above everything else when active
        if (bluffAdvice) {
            const bluffEl = document.createElement('div');
            bluffEl.className = 'tphud-coach-entry-msg tphud-coach-bluff-line';
            bluffEl.textContent = bluffAdvice;
            entry.appendChild(bluffEl);
        }

        // Adaptive narrative — reaction to what already happened this hand
        if (narrativeNote) {
            const narEl = document.createElement('div');
            narEl.className = 'tphud-coach-entry-msg tphud-coach-narrative';
            narEl.textContent = narrativeNote;
            entry.appendChild(narEl);
        }

        if (ownLean) {
            const handEl = document.createElement('div');
            handEl.className = 'tphud-coach-entry-msg';
            handEl.textContent = annotateBetSizing(ownLean);
            entry.appendChild(handEl);
            // Emit bet hint for slider integration (no-op if slider not installed)
            _emitBetHint(ownLean);
            lastOwnLean = ownLean;
            // Snapshot computed context for bet reaction — avoids text-parsing the coach message
            const _ctxBoard = (currentHand?.boardCards || []).filter(Boolean);
            lastBetCtx = {
                spr: gtoMath.spr,
                street,
                numOpp,
                facingAct,
                equity: parseFloat(_oddsCache?.win) || null,
                texture: _ctxBoard.length >= 3 ? (analyzeBoardTexture(_ctxBoard) || {}) : {},
            };
        }

        // Defence math vs a bet: pot odds plus MDF, one compact dim line
        if ((facingAct === 'bet' || facingAct === 'shove') && (gtoMath.potOdds != null || gtoMath.mdf != null)) {
            const bits = [];
            if (gtoMath.potOdds != null) bits.push(`need ${gtoMath.potOdds}% equity to call`);
            if (gtoMath.mdf != null) bits.push(`defend ~${gtoMath.mdf}% of the hands you would play this way (fold more and pure bluffs auto-profit against you)`);
            if (gtoMath.spr != null) bits.push(`SPR ${gtoMath.spr}`);
            const mathEl = document.createElement('div');
            mathEl.className = 'tphud-coach-entry-msg tphud-coach-self-note tphud-coach-defmath';
            mathEl.textContent = `Defence math: ${bits.join(' · ')}.`;
            entry.appendChild(mathEl);
        }

        if (selfNote) {
            const noteEl = document.createElement('div');
            noteEl.className = 'tphud-coach-entry-msg tphud-coach-self-note';
            noteEl.textContent = selfNote;
            entry.appendChild(noteEl);
        }

        return entry;
    }

    // Parses a pot percentage midpoint from a self-advice string.
    // Handles: "50-75% pot", "33% pot", "half pot", "full pot", "2/3 pot".
    function _parsePotPctFromLean(text) {
        if (!text) return null;
        // "half pot"
        if (/half\s+pot/i.test(text)) return 50;
        // "full pot"
        if (/full\s+pot/i.test(text)) return 100;
        // "2/3 pot"
        const fracM = text.match(/(\d+)\/(\d+)\s*pot/i);
        if (fracM) return Math.round(parseInt(fracM[1], 10) / parseInt(fracM[2], 10) * 100);
        // "50-75% pot" or "75% pot"
        const rangeM = text.match(/(\d+)(?:\s*[–\-]\s*(\d+))?\s*%\s*pot/i);
        if (rangeM) {
            const lo = parseInt(rangeM[1], 10);
            const hi = rangeM[2] ? parseInt(rangeM[2], 10) : lo;
            return Math.round((lo + hi) / 2);
        }
        return null;
    }

    // Fires window event so the slider can show a marker at the recommended amount.
    function _emitBetHint(ownLean) {
        const potPct = _parsePotPctFromLean(ownLean);
        const pot = currentHand?.runningPot || 0;
        if (potPct == null || pot <= 0) return;
        window.dispatchEvent(new CustomEvent('tphud:betHint', { detail: { potPct, pot } }));
    }

    // ── Bet reaction ──────────────────────────────────────────────────────────
    // Watches the native bet input and posts a blue comment below the self-entry
    // when the chosen size is notably off from what the coach advised.

    function _getSelfStack() {
        const input = document.querySelector('.input-money-group .input-money:not([type="hidden"])');
        if (input) {
            const v = parseInt((input.getAttribute('data-money') || '').replace(/,/g, ''), 10);
            if (v > 0) return v;
        }
        return currentHand?.stackAtStart?.[localPlayerName] || 0;
    }

    function generateBetReaction(betAmount) {
        if (!hudSettings.betReaction || hudSettings.mrCoachMode === 'off') return null;
        const pot = currentHand?.runningPot || 0;
        const stack = _getSelfStack();
        if (pot <= 0 || betAmount <= 0) return null;

        const potPct = Math.round(betAmount / pot * 100);
        const stackPct = stack > 0 ? Math.round(betAmount / stack * 100) : null;
        const lean = lastOwnLean || '';
        const stackLine = stackPct != null ? ` That's ${stackPct}% of your stack.` : '';

        // Fold/caution guards — always apply, independent of sizing logic
        const isFoldConclusion = /\bfold\b/i.test(lean);
        const isCautiousConclusion = /\b(check\/fold|be cautious|mixed spot|weigh (a |the )?call|marginal spot|too risky)\b/i.test(lean);

        if (isFoldConclusion && potPct >= 60) {
            return `Coach says fold but you're sizing ${potPct}% of the pot.${stackLine} You better have a strong read on this one.`;
        }
        if (isFoldConclusion && potPct >= 25) {
            return `Coach says fold — this ${potPct}% pot bet is a bluff. Make sure it's intentional.`;
        }
        if (isCautiousConclusion && potPct >= 75) {
            return `Coach flagged this as a marginal spot — a ${potPct}% pot bet is a big commitment.${stackLine}`;
        }
        if (stackPct != null && stackPct >= 70) {
            return `You're betting ${stackPct}% of your stack — you're pot committed after this.`;
        }

        // Balanced bluff ratio for the chosen size, river only: a bet of B into pot P
        // should be about B/(P+2B) bluffs at equilibrium (that equals the pot odds laid
        // to the caller). Earlier streets can run more bluffs than this.
        let bluffNote = '';
        if (currentHand?.street === 'river' && potPct > 0) {
            const a = betAmount / pot;
            const bf = Math.round(a / (1 + 2 * a) * 100);
            if (bf > 0) bluffNote = ` At this size a balanced river range is roughly ${bf}% bluffs, ${100 - bf}% value.`;
        }
        const orBluffNote = () => bluffNote ? bluffNote.trim() : null;

        // Sizing recommendation — derived from Monte Carlo equity + board context, not text parsing.
        // Fires whenever we have a hand (hole cards) and are not facing a shove.
        const ctx = lastBetCtx;
        if (!ctx || ctx.facingAct === 'shove' || ctx.equity == null) return orBluffNote();

        // Equity → hand strength tier (mirrors getBetSizing categories)
        let tier;
        if (ctx.equity >= 72) tier = 'strong';
        else if (ctx.equity >= 55) tier = 'pair';
        else if (ctx.equity >= 38) tier = 'thin';
        else tier = 'draw';

        // Bluff range when not facing a bet: coach can't recommend a size, so skip
        if (tier === 'draw' && ctx.facingAct !== 'bet') return orBluffNote();

        const sizing = getBetSizing(tier, ctx.texture, ctx.street, ctx.spr);
        if (!sizing) return orBluffNote();

        const rangeM = sizing.match(/(\d+)(?:[-–](\d+))?%/);
        if (!rangeM) return orBluffNote();
        const recLo = parseInt(rangeM[1], 10);
        const recHi = rangeM[2] ? parseInt(rangeM[2], 10) : recLo;
        const recStr = recLo === recHi ? `${recLo}%` : `${recLo}–${recHi}%`;

        if (potPct > recHi + 20) {
            return `With ~${Math.round(ctx.equity)}% equity, recommended sizing is ${recStr} pot. You're at ${potPct}% — that's an overbet.${stackLine}${bluffNote}`;
        }
        if (potPct < recLo - 15 && potPct > 0) {
            return `With ~${Math.round(ctx.equity)}% equity, recommended sizing is ${recStr} pot. You're at ${potPct}% — undersizing leaves value behind.${bluffNote}`;
        }
        if (tier !== 'thin' && potPct >= recLo && potPct <= recHi) {
            return `Sizing looks right — ${potPct}% pot matches the recommended range for this hand (~${Math.round(ctx.equity)}% equity).${bluffNote}`;
        }
        return orBluffNote();
    }

    function renderBetReaction(text) {
        lastBetReactionText = text || null;
        const selfEntry = document.querySelector('#tphud-coach .tphud-coach-body .tphud-coach-entry.tphud-coach-self');
        if (!selfEntry) return;
        let el = selfEntry.querySelector('.tphud-bet-reaction');
        if (!text) { if (el) el.remove(); return; }
        if (!el) {
            el = document.createElement('div');
            el.className = 'tphud-bet-reaction';
            selfEntry.appendChild(el);
        }
        el.textContent = text;
    }

    function attachBetReactionListener() {
        if (!hudSettings.betReaction) return;
        const input = document.querySelector('.input-money-group .input-money:not([type="hidden"])');
        if (!input || input.dataset.tphudReact) return;
        input.dataset.tphudReact = '1';
        input.addEventListener('input', () => {
            clearTimeout(betReactionTimer);
            betReactionTimer = setTimeout(() => {
                const val = parseInt((input.value || '').replace(/,/g, ''), 10);
                renderBetReaction(!isNaN(val) && val > 0 ? generateBetReaction(val) : null);
            }, 1000);
        });
    }

    // Reads what an opponent did on each street this hand and returns a pattern string.
    // Returns null when there is insufficient data (fewer than 2 prior streets with action).
    function getOpponentLinePattern(name) {
        if (!currentHand || !name) return null;
        const p = currentHand.perPlayer?.[name];
        if (!p) return null;

        // Must not show for the hero
        if (name === localPlayerName) return null;

        // Opponent must still be in the hand (not folded preflop or on flop)
        if (p.foldedPreflop) return null;

        const street = currentHand.street || 'preflop';
        const STREETS = ['preflop', 'flop', 'turn', 'river'];
        const streetIdx = STREETS.indexOf(street);

        // Need at least turn (index 2) — requires preflop + flop already done
        if (streetIdx < 2) return null;

        // Determine the primary action the opponent took on each street
        const primaryAction = s => {
            const d = p[s];
            if (!d) return null;
            if ((d.raises || 0) > 0) return 'raise';
            if ((d.bets || 0) > 0) return 'bet';
            if ((d.calls || 0) > 0) return 'call';
            if ((d.checks || 0) > 0) return 'check';
            if ((d.folds || 0) > 0) return 'fold';
            return null;
        };

        const streetsToRead = STREETS.slice(0, streetIdx); // all streets before current
        const parts = streetsToRead.map(primaryAction).filter(Boolean);

        if (parts.length < 2) return null;

        return parts.join(' → ');
    }

    // Detects a significant texture shift introduced by a new card landing on turn or river.
    // Returns a short description string or null.
    function detectBoardChange(flopCards, newCard) {
        if (!flopCards || flopCards.length < 3 || !newCard) return null;

        const flopTexture = analyzeBoardTexture(flopCards);
        if (!flopTexture) return null;

        const newCardSuit = newCard.slice(-1);
        const newCardRank = newCard.slice(0, -1);
        const newCardVal = RANK_VALUES[newCardRank] || 0;

        // Flush card: flop already had 2 of a suit and the new card adds a 3rd
        const suitCountsFlop = {};
        flopCards.forEach(c => {
            const s = c.slice(-1);
            suitCountsFlop[s] = (suitCountsFlop[s] || 0) + 1;
        });
        const flopMaxSuit = Math.max(...Object.values(suitCountsFlop));
        if (flopMaxSuit === 2 && suitCountsFlop[newCardSuit] === 2) {
            return 'flush card hit';
        }

        // Board pairs: new card matches a rank already on the flop
        const flopRanks = flopCards.map(c => c.slice(0, -1));
        if (flopRanks.includes(newCardRank)) {
            return 'board paired';
        }

        // Overcard: new card is higher than every card on the flop
        const flopVals = flopCards.map(c => RANK_VALUES[c.slice(0, -1)] || 0).filter(Boolean);
        if (flopVals.length > 0 && newCardVal > Math.max(...flopVals)) {
            return 'overcard hit';
        }

        // Straight card: extends connectivity (new card is within 4 of any flop rank)
        const closeTo = flopVals.some(v => Math.abs(v - newCardVal) <= 4 && v !== newCardVal);
        if (closeTo && flopTexture.maxConnected >= 2) {
            return 'straight card hit';
        }

        return null;
    }

    // Maps a betting pattern + opponent type to a plain-English interpretation.
    // Returns a voiced string or null when the pattern is not in the library.
    function interpretOpponentLine(pattern, opponentTypeKey, boardTexture, boardChange) {
        if (!pattern) return null;

        const isNitRock = opponentTypeKey === 'NIT' || opponentTypeKey === 'ROCK';
        const isManiacLag = opponentTypeKey === 'MANIAC' || opponentTypeKey === 'LAG';
        const isFishCaller = opponentTypeKey === 'FISH' || opponentTypeKey === 'CALLING_STATION';

        // Board change suffix injected where relevant
        const changeSuffix = boardChange ? ` (${boardChange})` : '';

        // Pattern library — 7 base patterns
        if (pattern === 'raise → bet → check') {
            if (isNitRock) {
                return _voice(
                    `Tight player slowed down after betting — likely scared of the board${changeSuffix}.`,
                    `Nit pumped the brakes — that board${changeSuffix} spooked them, probably marginal.`
                );
            }
            if (isManiacLag) {
                return _voice(
                    `Aggressor checked — could be anything from a draw brick to a trap${changeSuffix}.`,
                    `Maniac went quiet — draw bricked or setting a trap${changeSuffix}. Don't assume weakness.`
                );
            }
            return _voice(
                `Bet then checked — possible draw brick or slowing down${changeSuffix}.`,
                `Bet and then went quiet — draw bricked or doesn't like the board${changeSuffix}.`
            );
        }

        if (pattern === 'raise → bet → bet') {
            if (isNitRock) {
                return _voice(
                    `Triple aggression from a tight player — this is almost always the nuts.`,
                    `Nit is firing on all cylinders — they almost never do this without the goods.`
                );
            }
            if (isManiacLag) {
                return _voice(
                    `Polarised line — could be a full bluff or a monster. Wide range here.`,
                    `Could be air, could be the stone nuts — Maniacs run this line both ways.`
                );
            }
            return _voice(
                `Three streets of aggression — strong hand or polarised bluff.`,
                `Three barrels — either they've got it or they're committed to the bluff.`
            );
        }

        if (pattern === 'raise → check → bet') {
            if (isNitRock) {
                return _voice(
                    `Checked flop then bet turn — likely a slow-played strong hand.`,
                    `Nit skipped the flop and came out firing — classic trap. Be careful.`
                );
            }
            return _voice(
                `Checked flop, betting now — potential trap or a delayed c-bet.`,
                `Skipped the flop bet, now pulling the trigger — could be a trap or a delayed c-bet.`
            );
        }

        if (pattern === 'call → check → bet') {
            if (isFishCaller) {
                return _voice(
                    `Passive caller now betting — likely hit something or has a strong draw.`,
                    `The calling station woke up — they hit something or have a big draw. Take it seriously.`
                );
            }
            return _voice(
                `Called flop, now betting — floated with position or has a strong draw.`,
                `Called the flop, now betting — float play or a strong draw getting aggressive.`
            );
        }

        if (pattern === 'call → call → raise') {
            return _voice(
                `Called two streets, now raising — classic slowplay or just rivered a hand.`,
                `Two streets of calls and now a raise — slowplay or rivered something big. Danger signal.`
            );
        }

        if (pattern === 'call → bet → bet') {
            if (isFishCaller) {
                return _voice(
                    `Donk betting multiple streets — usually a strong made hand on this profile.`,
                    `Fish leading into you twice — they've got something real. Don't bluff them off it.`
                );
            }
            return _voice(
                `Donk betting multiple streets — strong made hand or a stubborn draw.`,
                `Donk-betting twice — strong hand or a draw that won't quit.`
            );
        }

        if (pattern === 'raise → check → check') {
            if (isNitRock) {
                return _voice(
                    `Preflop raiser went completely passive — almost certainly gave up.`,
                    `Nit raised preflop and did nothing after — they gave up. Board missed them.`
                );
            }
            return _voice(
                `Preflop aggressor went passive — likely gave up or is holding a weak hand.`,
                `Raised preflop then checked twice — probably gave up. Weak range.`
            );
        }

        // 2-part patterns (turn only — preflop + flop action)
        if (pattern === 'raise → bet') {
            if (isNitRock) return _voice(
                `Tight player c-bet the flop — likely has top pair or better.`,
                `Nit raised preflop and fired the flop — they usually have something real.`
            );
            if (isManiacLag) return _voice(
                `Aggressor c-bet — could be air or strong. Wide range on the flop.`,
                `Maniac c-bet — could be anything. Wait for the turn before reading too deep.`
            );
            return _voice(
                `Raised preflop and bet the flop — standard c-bet range, wide possibilities.`,
                `Raised and bet the flop — c-bet range, could be strong or just protecting.`
            );
        }

        if (pattern === 'raise → check') {
            if (isNitRock) return _voice(
                `Preflop raiser skipped the c-bet — likely missed the flop.`,
                `Nit raised preflop but checked the flop — board probably missed them.`
            );
            return _voice(
                `Preflop raiser checked the flop — missed their c-bet spot or slowing down.`,
                `Raised then went quiet on the flop — missed or decided to trap. Play carefully.`
            );
        }

        if (pattern === 'call → bet') {
            if (isFishCaller) return _voice(
                `Preflop caller leading out — likely hit the flop or has a draw.`,
                `Fish led into the flop — they hit something or have a draw they like.`
            );
            return _voice(
                `Preflop caller donk-betting the flop — could be a strong hit or a blocking bet.`,
                `Called preflop and came out betting — hit the flop or making a blocking bet.`
            );
        }

        if (pattern === 'call → check') {
            return _voice(
                `Preflop caller checked the flop — passive so far, range is wide.`,
                `Called preflop, checked the flop — passive, could be anything from a draw to a trap.`
            );
        }

        if (pattern === 'call → call') {
            if (isFishCaller) return _voice(
                `Called preflop and flop — passive caller, probably has a pair or a draw they won't let go.`,
                `Called twice and still in — fish with a draw or a made hand they're married to.`
            );
            return _voice(
                `Called two streets without raising — could be a draw, a medium made hand, or a slowplay.`,
                `Two streets of calling — range is wide here, could be drawing or slow-playing.`
            );
        }

        if (pattern === 'call → raise') {
            if (isNitRock) return _voice(
                `Tight player raised the flop after calling preflop — strong hand or a big draw.`,
                `Nit check-raised — they almost never do this without a real hand.`
            );
            return _voice(
                `Called preflop then raised the flop — connected hard or semi-bluffing a big draw.`,
                `Flat called then raised the flop — hit the board hard or has a strong draw.`
            );
        }

        if (pattern === 'raise → call') {
            if (isNitRock) return _voice(
                `Preflop raiser just called the flop — likely has a strong hand slow-playing or a draw.`,
                `Nit raised then just called — slowplay or picked up a draw. Watch the turn.`
            );
            return _voice(
                `Preflop raiser called the flop bet — range includes strong made hands and draws.`,
                `Raised preflop then just called — range is wide, but don't rule out a trap.`
            );
        }

        if (pattern === 'raise → raise') {
            if (isNitRock) return _voice(
                `Raised preflop and raised again on the flop — very tight player with two streets of aggression usually has it.`,
                `Nit is raising twice — almost certainly the nuts or top set.`
            );
            return _voice(
                `Two raises on different streets — polarised, strong hand or a committed bluff.`,
                `Raised twice — either they've got a monster or they're committed to the bluff.`
            );
        }

        if (pattern === 'raise → call → bet') {
            return _voice(
                `Raised preflop, called flop, now betting — delayed aggression, often a strong draw or slow-played hand.`,
                `Raised then called, now coming out — delayed c-bet or they've got a hand now.`
            );
        }

        if (pattern === 'raise → call → check') {
            if (isNitRock) return _voice(
                `Preflop raiser called flop and checked turn — tight player going passive, likely gave up or has a marginal hand.`,
                `Nit raised, called, then went quiet — probably gave up. Board hit you harder.`
            );
            return _voice(
                `Raised preflop, called flop, checked turn — passive line, could be pot control or giving up.`,
                `Raised then went passive on the turn — pot control or they're done with the hand.`
            );
        }

        if (pattern === 'raise → call → raise') {
            return _voice(
                `Raised preflop, called flop, now raising — classic slow-play finally showing up. Strong range.`,
                `Raised preflop, called flop, now raising — they were slow-playing. Strong hand.`
            );
        }

        if (pattern === 'call → call → bet') {
            if (isFishCaller) return _voice(
                `Passive caller woke up on the turn — hit the board or has a strong draw they're done slow-playing.`,
                `Fish called twice and now leads out — hit something real. Take it seriously.`
            );
            return _voice(
                `Called two streets, now leading out — often a made hand that improved, or a draw with enough equity to bet.`,
                `Called twice then bet — either improved or done waiting. Range is strong here.`
            );
        }

        if (pattern === 'call → call → check') {
            return _voice(
                `Three streets of passive play — medium made hand or a draw that bricked. Vulnerable to a bet.`,
                `Called twice and now checks — passive all the way, probably weak or a missed draw.`
            );
        }

        if (pattern === 'check → bet → bet') {
            if (isManiacLag) return _voice(
                `Checked preflop then bet two streets — aggressive player building a pot, wide range.`,
                `Checked then fired twice — could be strong or a standard aggression pattern for them.`
            );
            return _voice(
                `Checked preflop but bet flop and turn — connected with the board, likely a strong made hand or draw.`,
                `Checked then came out firing twice — hit the board hard or has a big draw.`
            );
        }

        if (pattern === 'check → check → bet') {
            if (isNitRock) return _voice(
                `Checked twice, now betting — tight player waking up on the river usually means a real hand.`,
                `Nit went quiet for two streets then bet — slow-play or just hit the river. Be careful.`
            );
            return _voice(
                `Two checks then a bet — could be a slow-play that paid off, or a weak stab after showing passivity.`,
                `Checked twice then bet — possible slow-play or a desperation stab. Read the river card.`
            );
        }

        if (pattern === 'check → raise') {
            if (isNitRock) return _voice(
                `Checked then raised — tight player check-raising is almost always a strong hand.`,
                `Nit check-raised — that's a monster. Fold everything marginal.`
            );
            return _voice(
                `Check-raised — strong hand or a semi-bluff with a big draw.`,
                `Check-raised — could be a big hand or a semi-bluff. Either way, their range is strong.`
            );
        }

        if (pattern === 'check → call') {
            return _voice(
                `Checked then called — passive line, range is wide from a draw to a slow-played hand.`,
                `Checked then called — could be a draw, pot control, or setting a trap.`
            );
        }

        if (pattern === 'check → check') {
            return _voice(
                `Passive both streets — weak hand or a slow-play. Safe to bet for value or to bluff.`,
                `Checked twice — likely weak or hoping someone else bets for them.`
            );
        }

        if (pattern === 'raise → bet → raise') {
            return _voice(
                `Raised preflop, bet flop, now raising — very strong range or a total bluff. High-stakes spot.`,
                `Three streets of escalating aggression — they've got the nuts or they're committed to the story.`
            );
        }

        if (pattern === 'raise → raise → bet') {
            if (isNitRock) return _voice(
                `Tight player with two raises and a bet — almost certainly the nuts.`,
                `Nit raised twice and now bets — just fold unless you have the stone nuts.`
            );
            return _voice(
                `Raised flop, raised again, now betting — extremely strong range or polarised bluff.`,
                `Two raises then a bet — big hand or total bluff. Nothing in between.`
            );
        }

        if (pattern === 'call → bet → check') {
            return _voice(
                `Donk-bet the flop then checked turn — could have been a blocking bet or a draw that lost confidence.`,
                `Led the flop then went quiet — blocking bet or a draw they don't want to over-commit with.`
            );
        }

        if (pattern === 'call → raise → bet') {
            return _voice(
                `Called preflop, raised flop, now betting — strong hand building the pot aggressively.`,
                `Raised the flop and kept firing — strong hand or a very committed bluff.`
            );
        }

        return null;
    }

    function getHandNarrativeNote() {
        if (!localPlayerName || !currentHand) return null;
        const street = currentHand.street || 'preflop';
        if (street === 'preflop') return null;

        const STREET_ORDER = ['preflop', 'flop', 'turn', 'river'];
        const streetIdx = STREET_ORDER.indexOf(street);
        if (streetIdx <= 0) return null;
        if (isSelfFolded()) return null;

        const selfP = currentHand.perPlayer?.[localPlayerName];
        const ownLean = (() => {
            const prev = _forceDefaultVoice;
            _forceDefaultVoice = true;
            try { return getOwnHandLean(); }
            finally { _forceDefaultVoice = prev; }
        })();
        const facts = [];
        const cautions = [];
        const seenFacts = new Set();
        const seenCautions = new Set();

        const addFact = s => {
            if (!s) return;
            const t = String(s).trim();
            if (!t || seenFacts.has(t)) return;
            seenFacts.add(t);
            facts.push(t);
        };
        const addCaution = (s, priority = 1) => {
            if (!s) return;
            const t = String(s).trim();
            if (!t || seenCautions.has(t)) return;
            seenCautions.add(t);
            cautions.push({ text: t, priority });
        };
        const fmtSentence = s => {
            const t = String(s || '').trim();
            if (!t) return '';
            return /[.!?]$/.test(t) ? t : t + '.';
        };

        // Check what the player did on each previous street and what followed
        for (let i = 1; i < streetIdx; i++) {
            const prevStreet = STREET_ORDER[i];
            const prevLog = streetLogs[prevStreet] || [];
            const selfActed = selfP?.[prevStreet];
            if (!selfActed) continue;

            const selfAggressive = (selfActed.bets || 0) + (selfActed.raises || 0) > 0;
            if (!selfAggressive) continue;

            const opponentCalls = prevLog.filter(a => a.actionType === 'call').length;
            const opponentRaises = prevLog.filter(a => a.actionType === 'raise').length;

            if (opponentRaises > 0) {
                const raiser = [...prevLog].reverse().find(a => a.actionType === 'raise');
                if (raiser?.playerName) addFact(`${raiser.playerName} raised your ${prevStreet} bet`);
                else addFact(`Your ${prevStreet} bet was raised`);
                addCaution('Strong range', 3);
            } else if (opponentCalls >= 2) {
                addFact(`Your ${prevStreet} bet got ${opponentCalls} callers`);
                addCaution('Multiway callers show strength', 2);
            } else if (opponentCalls === 1) {
                // Single caller — read the caller using their stats if possible
                const caller = prevLog.find(a => a.actionType === 'call');
                if (caller) {
                    const all = getStats();
                    const cs = resolveStatsByName(caller.playerName, all);
                    const cActive = cs ? getActiveStats(cs, currentTableBB) : null;
                    const cDm = cActive ? getDisplayMetrics(cActive) : null;
                    const cCls = cDm ? classifyMetrics(cDm, cActive.handsObserved || 0) : null;
                    const cTypeKey = cCls ? (Object.keys(TYPES).find(k => TYPES[k] === cCls.type) || 'UNKNOWN') : 'UNKNOWN';

                    addFact(`${caller.playerName} called your ${prevStreet} bet`);
                    if (cTypeKey === 'CALLING_STATION' || cTypeKey === 'FISH') {
                        addCaution('Wide caller profile', 1);
                    } else if (cTypeKey === 'NIT' || cTypeKey === 'ROCK' || cTypeKey === 'TIGHT_PASSIVE') {
                        addCaution('Tight call = strength', 2);
                    } else if (cDm && cDm.drawRate > 0.20) {
                        addCaution(`Draw-heavy profile (${Math.round((cDm.drawRate || 0) * 100)}% draws)`, 1);
                    } else {
                        addCaution('Caller has a hand or draw', 1);
                    }
                } else {
                    addFact(`Your ${prevStreet} bet got called`);
                    addCaution('Caller has a hand or draw', 1);
                }
            }
        }

        // Current street dynamics — are we facing aggression right now?
        const currentLog = streetLogs[street] || [];
        const currentRaises = currentLog.filter(a => a.actionType === 'raise' || a.actionType === 'bet');
        const currentChecks = currentLog.filter(a => a.actionType === 'check');
        const selfPrevAgg = selfP ? STREET_ORDER.slice(1, streetIdx).some(s => (selfP[s]?.bets || 0) + (selfP[s]?.raises || 0) > 0) : false;

        // Everyone checked to us this street — opportunity
        if (currentChecks.length > 0 && currentRaises.length === 0 && selfPrevAgg) {
            addFact(`Everyone checked to you on the ${street}`);
            addCaution('You have initiative', 1);
        }

        // We have a weak hand but someone is applying pressure on this street
        if (currentRaises.length > 0 && ownLean && /haven't connected|weigh what|marginal|be cautious/i.test(ownLean)) {
            const raiser = currentRaises[currentRaises.length - 1];
            if (raiser) {
                addFact(`${raiser.playerName} is applying pressure`);
                addCaution('Marginal hand spot', 3);
            }
        }

        // Fold-to-aggression: surface when active opponents are known to fold to flop bets
        if (street === 'flop') {
            const all = getStats();
            const activeOpponents = Object.keys(currentHand.perPlayer || {})
                .filter(name => name !== localPlayerName && !currentHand.perPlayer[name].foldedPreflop);

            const foldyOpp = [];
            const callyOpp = [];
            for (const name of activeOpponents) {
                const rs = resolveStatsByName(name, all);
                const as = rs ? getActiveStats(rs, currentTableBB) : null;
                const d = as ? getDisplayMetrics(as) : null;
                if (!d) continue;
                if (d.foldVsFlopBet !== null && d.foldVsFlopBet >= 0.65) foldyOpp.push({ name, rate: d.foldVsFlopBet });
                else if (d.foldVsFlopBet !== null && d.foldVsFlopBet <= 0.30) callyOpp.push({ name, rate: d.foldVsFlopBet });
            }

            if (foldyOpp.length > 0 && foldyOpp.length === activeOpponents.length) {
                const detail = foldyOpp.map(f => `${f.name} ${Math.round(f.rate * 100)}%`).join(', ');
                addFact(`All active opponents fold to flop bets often (${detail})`);
                addCaution('C-bet works often', 1);
            } else if (foldyOpp.length === 1 && activeOpponents.length === 1) {
                addFact(`${foldyOpp[0].name} folds to flop bets ${Math.round(foldyOpp[0].rate * 100)}%`);
                addCaution('C-bet works often', 1);
            } else if (foldyOpp.length >= 1) {
                addFact(`${foldyOpp[0].name} folds to flop bets ${Math.round(foldyOpp[0].rate * 100)}%`);
                addCaution('Others still in', 1);
            } else if (callyOpp.length > 0 && activeOpponents.length === 1) {
                addFact(`${callyOpp[0].name} only folds to flop bets ${Math.round(callyOpp[0].rate * 100)}%`);
                addCaution('Sticky caller', 1);
            }
        }

        // Turn fold-to-aggression: use postFoldPct as proxy for turn folding tendency
        if (street === 'turn') {
            const all = getStats();
            const activeOpponents = Object.keys(currentHand.perPlayer || {})
                .filter(name => name !== localPlayerName
                    && !currentHand.perPlayer[name].foldedPreflop
                    && !currentHand.perPlayer[name].foldedOnFlop);
            for (const name of activeOpponents) {
                const rs = resolveStatsByName(name, all);
                const as = rs ? getActiveStats(rs, currentTableBB) : null;
                const d = as ? getDisplayMetrics(as) : null;
                if (!d) continue;
                if (d.postFoldPct !== null && d.postFoldPct >= 0.60) {
                    addFact(`${name} folds to post-flop pressure ${Math.round(d.postFoldPct * 100)}%`);
                    addCaution('Turn barrel often works', 1);
                    break; // one note is enough
                }
            }
        }

        // Multi-way pot: warn when holding one-pair hands
        if (ownLean && /top pair|low pair|overpair|two pair/i.test(ownLean)) {
            const STREET_FOLD_KEY = { flop: 'foldedOnFlop', turn: null, river: null };
            const foldKey = STREET_FOLD_KEY[street];
            const activeOppCount = Object.keys(currentHand.perPlayer || {})
                .filter(name => {
                    if (name === localPlayerName) return false;
                    const p = currentHand.perPlayer[name];
                    if (p.foldedPreflop) return false;
                    if (foldKey && p[foldKey]) return false;
                    return true;
                }).length;
            if (activeOppCount >= 2) {
                const totalPlayers = activeOppCount + 1;
                const hasTwoPair = /two pair/i.test(ownLean);
                const hasOverpair = /overpair/i.test(ownLean);
                const hasTopPair = /top pair/i.test(ownLean);
                addFact(`${totalPlayers}-way pot`);
                if (hasTwoPair) {
                    addCaution('Two pair is strong multiway', 2);
                } else if (hasOverpair) {
                    addCaution('Overpair is one-pair strength multiway', 2);
                } else if (hasTopPair) {
                    addCaution('Top pair is marginal in a crowd', 3);
                } else {
                    addCaution('Low pair is marginal multiway', 2);
                }
            }
        }

        // Opponent line reading — inject interpretation for the primary opponent when on turn/river
        if (streetIdx >= 2) {
            const allPP = currentHand.perPlayer || {};
            const primaryOpp = Object.keys(allPP).find(name =>
                name !== localPlayerName &&
                !allPP[name].foldedPreflop &&
                !allPP[name].foldedOnFlop
            );
            if (primaryOpp) {
                const oppPattern = getOpponentLinePattern(primaryOpp);
                if (oppPattern) {
                    const all = getStats();
                    const oppRaw = resolveStatsByName(primaryOpp, all);
                    const oppActive = oppRaw ? getActiveStats(oppRaw, currentTableBB) : null;
                    const oppDm = oppActive ? getDisplayMetrics(oppActive) : null;
                    const oppCls = oppDm ? classifyMetrics(oppDm, oppActive.handsObserved || 0) : null;
                    const oppTypeKey = oppCls ? (Object.keys(TYPES).find(k => TYPES[k] === oppCls.type) || 'UNKNOWN') : 'UNKNOWN';

                    const board = (currentHand.boardCards || []).filter(Boolean);
                    const boardTexture = board.length >= 3 ? analyzeBoardTexture(board) : null;

                    // Detect turn/river card change vs flop baseline
                    const flopCards = (currentHand.flopCards || []).filter(Boolean);
                    const turnCards = (currentHand.turnCards || []).filter(Boolean);
                    const riverCards = (currentHand.riverCards || []).filter(Boolean);
                    const newCard = street === 'river'
                        ? (riverCards[0] || null)
                        : (turnCards[0] || null);
                    const boardChange = detectBoardChange(flopCards, newCard);

                    const lineInterp = interpretOpponentLine(oppPattern, oppTypeKey, boardTexture, boardChange);
                    if (lineInterp) {
                        // Only append when it doesn't duplicate what a fact already says
                        const dupCheck = lineInterp.toLowerCase();
                        const alreadyCovered = facts.some(f => f.toLowerCase().includes(dupCheck.slice(0, 20)));
                        if (!alreadyCovered) addFact(lineInterp);
                    }
                }
            }
        }

        if (!facts.length && !cautions.length) return null;

        const factText = facts.slice(0, 3).map(fmtSentence).join(' ');
        let cautionText = '';
        if (cautions.length) {
            const pick = [...cautions].sort((a, b) => b.priority - a.priority)[0];
            cautionText = pick ? fmtSentence(pick.text) : '';
        }

        // Trim to stay under ~200 chars
        let out = [factText, cautionText].filter(Boolean).join(' ');
        if (out.length > 200) out = out.slice(0, 197) + '…';
        return out || null;
    }

    // Counts seated opponents classified as weak/exploitable (Fish, Calling Station, Maniac).
    // Only counts players with enough hands to have a meaningful classification.
    function getTableFishCount() {
        const all = getStats();
        let count = 0;
        let total = 0;
        for (const name of Object.keys(nameToSeatId)) {
            if (name === localPlayerName) continue;
            const rs = resolveStatsByName(name, all);
            if (!rs || (rs.handsObserved || 0) < 5) continue;
            total++;
            const as = getActiveStats(rs, currentTableBB);
            const dm = getDisplayMetrics(as);
            const cls = classifyMetrics(dm, as.handsObserved || 0);
            const key = Object.keys(TYPES).find(k => TYPES[k] === cls?.type);
            if (key === 'FISH' || key === 'CALLING_STATION' || key === 'MANIAC') count++;
        }
        return { count, total };
    }

    function getSelfCoachNote() {
        if (!localPlayerName) return null;

        // Session bluff meta advice takes priority — surfaces after 3+ consecutive fails or 5+ attempts
        const bluffMeta = getSessionBluffMetaAdvice();
        if (bluffMeta) return bluffMeta;

        const all = getStats();
        const rawStats = resolveStatsByName(localPlayerName, all);
        if (!rawStats) return null;
        const activeStats = getActiveStats(rawStats, currentTableBB);
        if (!activeStats || (activeStats.handsObserved || 0) < 10) return null;
        const dm = getDisplayMetrics(activeStats);
        if (!dm) return null;
        const alerts = getLiveAlerts(rawStats);

        // Preflop context: hand-specific leak callout (highest priority, most actionable)
        if (currentHand && (!currentHand.boardCards || currentHand.boardCards.length < 3) && currentHand.selfHoleCards?.length >= 2) {
            const pos = getPlayerPosition(localPlayerName, currentHand) || 'MP';
            const facingRaise = (currentHand.preflopRaiseCount || 0) > 0;
            const ev = evalPreflopHand(currentHand.selfHoleCards, pos, facingRaise);
            if (ev) {
                const isWeakHand = ev.strength === 'weak' || ev.strength === 'marginal';
                const isStrong = ev.strength === 'premium' || ev.strength === 'strong';

                if (isWeakHand && dm.vpip > 0.42 && facingRaise && dm.gap > 0.20) {
                    // Both leaks firing at once: too wide AND calls raises too much
                    return _voice(
                        `SESSION FOCUS: Two leaks compounding here — you play too many hands (${Math.round(dm.vpip * 100)}% VPIP) AND call raises too wide (${Math.round(dm.gap * 100)}% gap). This exact spot is where your chips leak. → FOLD.`,
                        `SESSION FOCUS: Two leaks bleeding you out right here — your VPIP is ${Math.round(dm.vpip * 100)}% which means you play every hand like a sucker, AND you call raises too wide (${Math.round(dm.gap * 100)}% gap). This exact spot is where your money walks out the door. → FOLD.`
                    );
                }
                if (isWeakHand && dm.vpip > 0.42) {
                    return _voice(
                        `Your VPIP is ${Math.round(dm.vpip * 100)}% — you're playing too many hands. This weak hand is exactly the kind you need to stop entering pots with. → FOLD.`,
                        `Your VPIP is ${Math.round(dm.vpip * 100)}%? You're playing every hand like a sucker. This garbage right here is exactly what's bleeding you. → FOLD.`
                    );
                }
                if (isWeakHand && facingRaise && dm.gap > 0.20) {
                    return _voice(
                        `You call raises too wide (${Math.round(dm.gap * 100)}% gap). Folding this to a raise is the right discipline. → FOLD.`,
                        `You call raises too wide — ${Math.round(dm.gap * 100)}% gap is embarrassing, kid. This is exactly where you stop. → FOLD.`
                    );
                }
                if (isStrong && dm.pfr < 0.08) {
                    return _voice(
                        `You have a strong hand but your PFR is only ${Math.round(dm.pfr * 100)}% — you under-raise significantly. This is the spot to change that. → RAISE.`,
                        `You got a strong hand but you only raise ${Math.round(dm.pfr * 100)}% of the time preflop? You limp around like you got nothing. This is the spot to grow a spine. → RAISE.`
                    );
                }
            }
        }

        // Detect all active leaks, rank by estimated EV cost
        const leaks = [];

        if (dm.foldVsFlopBet !== null && dm.foldVsFlopBet > 0.65)
            leaks.push({ key: 'fold_flop', cost: 3, msg: `fold to flop bets too often (${Math.round(dm.foldVsFlopBet * 100)}%)` });
        if (dm.vpip > 0.50)
            leaks.push({ key: 'vpip_high', cost: 3, msg: `play too many hands (${Math.round(dm.vpip * 100)}% VPIP, target: ~35%)` });
        if (dm.gap > 0.25 && dm.vpip > 0.35)
            leaks.push({ key: 'gap_high', cost: 2, msg: `call preflop raises too wide (${Math.round(dm.gap * 100)}% gap — raise or fold instead)` });
        if (dm.pfr > 0 && dm.pfr < 0.08 && dm.vpip > 0.20)
            leaks.push({ key: 'limp', cost: 2, msg: `limp too much (PFR ${Math.round(dm.pfr * 100)}% vs VPIP ${Math.round(dm.vpip * 100)}%) — limping signals weakness and kills your initiative` });
        if (dm.afq < 0.15 && dm.vpip > 0.25)
            leaks.push({ key: 'passive', cost: 2, msg: `enter pots but rarely bet or raise (AFq ${Math.round(dm.afq * 100)}%) — you're a calling station` });
        if (alerts.some(a => /tilt|looser/i.test(a.label)))
            leaks.push({ key: 'tilt', cost: 3, msg: `your play has shifted looser recently — possible tilt` });

        // No leaks found — check for table-level context worth surfacing
        if (!leaks.length) {
            // Fish density: 2+ opponents typed as exploitable — push value-heavy strategy
            const { count, total } = getTableFishCount();
            if (count >= 2 && total >= 2) return _voice(
                `${count} of ${total} opponents here are weak players. Skip the balancing act — value bet relentlessly and cut your bluffs.`,
                `${count} of ${total} players at this table are fish, kid. Forget balance — bet your made hands hard every street and stop bluffing. They'll pay you off.`
            );
            // Stake-tier context: Nano/Low stakes — nudge toward exploitative over balanced play
            if (currentStakeTier === 'Nano' || currentStakeTier === 'Low') return _voice(
                `You're at a ${currentStakeTier} stakes table. Most opponents here make systematic mistakes — exploit them, don't try to balance. Value bet more, bluff less.`,
                `${currentStakeTier} stakes, kid. These players make the same mistakes every hand — exploit them hard. More value bets, fewer bluffs. GTO is for players you'll never meet here.`
            );
            return null;
        }

        leaks.sort((a, b) => b.cost - a.cost);

        // Single leak: direct focused note
        if (leaks.length === 1) {
            const l = leaks[0];
            if (l.key === 'fold_flop') return _voice(
                `You ${l.msg}. Opponents can exploit this by bluffing any flop. If you have any piece, hold on.`,
                `You ${l.msg}. Every player at this table knows they can bluff any flop and you'll fold. If you got any piece of that board, hold on and make em prove it.`
            );
            if (l.key === 'vpip_high') return _voice(
                `You ${l.msg}. More hands means more spots where you're out of position with weak holdings. Pick your spots.`,
                `You ${l.msg}. Playing every hand like a tourist means you're always out of position with garbage. Pick your spots or keep losing.`
            );
            if (l.key === 'gap_high') return _voice(
                `You ${l.msg}. When someone raises, 3-bet or fold. Flat-calling wide is the worst of both worlds.`,
                `You ${l.msg}. Someone raises, you 3-bet or you fold — flat-calling wide is the worst of both worlds and Duke knows it.`
            );
            if (l.key === 'limp') return _voice(
                `You ${l.msg}. Raise or fold preflop — limping funds the blinds and builds pots where you're at a disadvantage.`,
                `You ${l.msg}. Raise or fold — limping is funding everyone else's blinds and building pots where you're already behind, kid.`
            );
            if (l.key === 'passive') return _voice(
                `You ${l.msg}. Take the initiative — bet your made hands, bluff your equity draws, don't just call and hope.`,
                `You ${l.msg}. Take the initiative — bet your made hands, push your draws, stop calling and hoping like a sucker.`
            );
            if (l.key === 'tilt') return _voice(
                `Your play has shifted looser than your baseline. You may be on tilt. Slow down and play tighter until you reset.`,
                `Your play has gone loose and sloppy compared to your baseline. You're on tilt, pal. Slow the hell down and play tighter until you get your head right.`
            );
            return _voice(`Leak: you ${l.msg}.`, `Leak, kid: you ${l.msg}. Fix it.`);
        }

        // Multiple leaks: show the worst two and their interaction
        const top = leaks[0];
        const second = leaks[1];

        // Specific high-value intersections
        if (top.key === 'vpip_high' && second.key === 'fold_flop')
            return _voice(
                `Two compounding leaks: you play too many hands (${Math.round(dm.vpip * 100)}% VPIP) and then fold to flop bets too often (${Math.round(dm.foldVsFlopBet * 100)}%). You're paying to see flops and giving them away. SESSION FOCUS: stop entering pots with weak hands.`,
                `Two compounding leaks bleeding you dry: you play too many hands (${Math.round(dm.vpip * 100)}% VPIP — that's embarrassing) and then fold to flop bets ${Math.round(dm.foldVsFlopBet * 100)}% of the time. You're paying to see flops and handing them back. SESSION FOCUS: stop entering pots with garbage.`
            );
        if (top.key === 'fold_flop' && second.key === 'vpip_high')
            return _voice(
                `Two compounding leaks: you play too many hands (${Math.round(dm.vpip * 100)}% VPIP) and then fold to flop bets too often (${Math.round(dm.foldVsFlopBet * 100)}%). You're paying to see flops and giving them away. SESSION FOCUS: stop entering pots with weak hands.`,
                `Two leaks, kid, and they're compounding each other: ${Math.round(dm.vpip * 100)}% VPIP means you play everything, then you fold to flop bets ${Math.round(dm.foldVsFlopBet * 100)}% of the time. That's chips in the trash. SESSION FOCUS: stop entering pots with weak hands.`
            );
        if ((top.key === 'vpip_high' || top.key === 'limp') && second.key === 'gap_high')
            return _voice(
                `You play too wide AND call raises wide — a ${Math.round(dm.vpip * 100)}% VPIP with a ${Math.round(dm.gap * 100)}% gap. You're entering bad pots and compounding it by calling instead of folding. SESSION FOCUS: tighten preflop range, raise or fold facing a raise.`,
                `You play too wide AND call raises wide — ${Math.round(dm.vpip * 100)}% VPIP and a ${Math.round(dm.gap * 100)}% gap. You enter bad pots then compound the mistake by calling instead of folding. SESSION FOCUS: tighten up preflop and raise-or-fold facing a raise, pal.`
            );
        if (top.key === 'tilt')
            return _voice(
                `Tilt detected AND ${second.msg}. Playing emotionally while already leaking is a bad combination. SESSION FOCUS: tighten up, fold marginal spots, reset.`,
                `Tilt detected AND ${second.msg}. Playing on emotion while you're already leaking is a recipe to go broke. SESSION FOCUS: tighten up, fold the marginal spots, and reset before you do something stupid.`
            );

        // Generic multi-leak fallback
        return _voice(
            `${leaks.length} leaks active: ${leaks.slice(0, 2).map(l => l.msg).join(', and you ')}. SESSION FOCUS: ${leaks[0].key === 'vpip_high' || leaks[0].key === 'limp' ? 'tighten preflop' : leaks[0].key === 'fold_flop' ? 'hold on to hands postflop' : 'fix your biggest leak first'}.`,
            `${leaks.length} leaks bleeding you, kid: ${leaks.slice(0, 2).map(l => l.msg).join(', and you ')}. SESSION FOCUS: ${leaks[0].key === 'vpip_high' || leaks[0].key === 'limp' ? 'tighten up preflop before you give the whole stack away' : leaks[0].key === 'fold_flop' ? 'hold on to hands postflop instead of handing them pots' : 'fix your biggest leak first — one problem at a time'}.`
        );
    }

    // ── Position detection ───────────────────────────────────────

    // Returns true if the player in the given seat element is currently sitting out.
    function isSeatSittingOut(seatEl) {
        if (!seatEl) return false;
        // Class-based indicators used by Torn
        for (const c of seatEl.classList) {
            if (/sitOut|sittingOut|sit-out/i.test(c)) return true;
        }
        // Text-based fallback: state element shows "Sitting out"
        const stateEl = seatEl.querySelector('[class^="state___"]');
        if (stateEl && /sitting\s*out/i.test(stateEl.textContent)) return true;
        return false;
    }

    // Returns the set of seat IDs currently sitting out, keyed from the live DOM.
    function getSittingOutIds() {
        const out = new Set();
        document.querySelectorAll('[id^="player-"]').forEach(seatEl => {
            if (isSeatSittingOut(seatEl)) out.add(seatEl.id.replace('player-', ''));
        });
        return out;
    }

    // Returns seats sorted by visual position number (playerPositioner-N___hash) = true clockwise order.
    // Also builds a name→seatId snapshot captured at hand start.
    function captureSeatOrder() {
        const posSlots = [];
        const seenIds = new Set();

        document.querySelectorAll('[class*="playerPositioner-"]').forEach(posDiv => {
            let posNum = null;
            for (const c of posDiv.classList) {
                const m = c.match(/playerPositioner-(\d+)___/);
                if (m) { posNum = parseInt(m[1], 10); break; }
            }
            if (posNum === null) return;
            const playerEl = posDiv.querySelector('[id^="player-"]');
            if (!playerEl) return;
            const seatId = playerEl.id.replace('player-', '');
            seenIds.add(seatId);
            const name = (playerEl.dataset.hudName && !/^__self__:/.test(playerEl.dataset.hudName))
                ? playerEl.dataset.hudName
                : (playerEl.dataset.hudRawName || playerEl.querySelector('[class^="name___"]')?.textContent?.trim() || null);
            posSlots.push({ posNum, seatId, name });
        });

        // Self seat may be in a different wrapper (selfPositioner, etc.) — add it if missing.
        const selfEl = document.querySelector('[id^="player-"][class*="self___"]');
        if (selfEl) {
            const seatId = selfEl.id.replace('player-', '');
            if (!seenIds.has(seatId)) {
                // Walk up the DOM looking for any positional number class on an ancestor
                let posNum = null;
                let el = selfEl.parentElement;
                while (el && el !== document.body) {
                    for (const c of el.classList) {
                        const m = c.match(/(?:playerPositioner|selfPositioner|positioner)[^_]*-(\d+)___/i);
                        if (m) { posNum = parseInt(m[1], 10); break; }
                    }
                    if (posNum !== null) break;
                    el = el.parentElement;
                }
                // No positional class found — self seat is likely slot 0 (bottom of table)
                if (posNum === null) posNum = -1;
                const name = (selfEl.dataset.hudName && !/^__self__:/.test(selfEl.dataset.hudName))
                    ? selfEl.dataset.hudName
                    : (selfEl.dataset.hudRawName || selfEl.querySelector('[class^="name___"]')?.textContent?.trim() || null);
                posSlots.push({ posNum, seatId, name });
            }
        }

        posSlots.sort((a, b) => a.posNum - b.posNum);
        const order = posSlots.map(s => s.seatId);
        const nameToSeat = {};
        posSlots.forEach(s => { if (s.name) nameToSeat[s.name] = s.seatId; });
        return { order, nameToSeat };
    }

    // Finds the dealer seat using the global dealer element's position-N___hash class.
    function getDealerSeatId() {
        const dealerEl = document.querySelector('[class*="dealer___"]');
        if (!dealerEl) return null;

        // Torn uses "position-self___hash" (not numeric) when the local player holds the button
        if (dealerEl.className.split(/\s+/).some(c => c.startsWith('position-self___'))) {
            const selfEl = document.querySelector('[id^="player-"][class*="self___"]');
            return selfEl ? selfEl.id.replace('player-', '') : null;
        }

        let dealerPosNum = null;
        for (const c of dealerEl.classList) {
            const m = c.match(/position-(\d+)___/);
            if (m) { dealerPosNum = parseInt(m[1], 10); break; }
        }
        if (dealerPosNum === null) return null;
        const posDiv = [...document.querySelectorAll('[class*="playerPositioner-"]')].find(el => {
            for (const c of el.classList) { if (c.match(new RegExp(`playerPositioner-${dealerPosNum}___`))) return true; }
            return false;
        });
        if (posDiv) {
            const playerEl = posDiv.querySelector('[id^="player-"]');
            return playerEl ? playerEl.id.replace('player-', '') : null;
        }
        // Dealer position not in any standard positioner — self seat uses a non-standard wrapper
        const selfEl = document.querySelector('[id^="player-"][class*="self___"]');
        return selfEl ? selfEl.id.replace('player-', '') : null;
    }

    // After dealer is known, derive sbPlayer/bbPlayer from actual seat positions.
    // Overrides any dead-blind misassignment that happened before Game started.
    function fixBlindPlayersFromPosition(hand) {
        if (!hand.dealerSeatId || !hand.seatOrder.length) return;
        const order = hand.seatOrder;
        const dealerIdx = order.indexOf(String(hand.dealerSeatId));
        if (dealerIdx === -1) return;
        const seatToName = {};
        Object.entries(hand.seatNameMap || {}).forEach(([n, sid]) => { seatToName[String(sid)] = n; });
        const sbSeat = order[(dealerIdx + 1) % order.length];
        const bbSeat = order[(dealerIdx + 2) % order.length];
        if (seatToName[String(sbSeat)]) hand.sbPlayer = seatToName[String(sbSeat)];
        if (seatToName[String(bbSeat)]) hand.bbPlayer = seatToName[String(bbSeat)];
    }

    // Returns position group for a player given the hand state.
    // SB/BB are sourced from fixBlindPlayersFromPosition (position-derived, most reliable).
    // Everyone else is calculated by clockwise distance from dealer using playerPositioner-N order.
    function getPlayerPosition(name, hand) {
        if (!hand) return null;
        if (name === hand.sbPlayer) return 'SB';
        if (name === hand.bbPlayer) return 'BB';

        const nameMap = hand.seatNameMap || {};
        const seatId = nameMap[name] || nameToSeatId[name];
        const dealerId = hand.dealerSeatId;
        const order = hand.seatOrder;
        if (!seatId || !dealerId || !order.length) return null;

        const total = order.length;
        const dealerIdx = order.indexOf(String(dealerId));
        const myIdx = order.indexOf(String(seatId));
        if (dealerIdx === -1 || myIdx === -1) return null;

        // order is sorted by playerPositioner-N (clockwise), so no direction detection needed.
        const dist = (myIdx - dealerIdx + total) % total;

        if (dist === 0) return 'LP'; // BTN
        if (dist === 1 || dist === 2) return null; // SB/BB handled above
        if (total >= 5 && dist === total - 1) return 'LP'; // CO — only LP on 5+ player tables
        if (dist === 3 || dist === 4) return 'EP';
        return 'MP';
    }

    // ── Draw detection for fold analysis ────────────────────────
    function detectDraw(holeCards, boardCards) {
        const all = [...holeCards, ...boardCards];
        const rankIdx = r => RANK_ORDER.indexOf(r);

        const suitGroups = {};
        all.forEach(c => { const s = suitOf(c); if (!suitGroups[s]) suitGroups[s] = []; suitGroups[s].push(c); });
        const holeSuits = new Set(holeCards.map(suitOf));
        const flushDraw = Object.entries(suitGroups).some(([s, cards]) =>
            cards.length === 4 && holeSuits.has(s));

        const idxs = [...new Set(all.map(c => rankIdx(rankOf(c))))].sort((a, b) => a - b);
        let oesd = false, gutshot = false;
        for (let base = 0; base <= 8; base++) {
            const window = [base, base + 1, base + 2, base + 3, base + 4];
            const hits = window.filter(i => idxs.includes(i));
            if (hits.length === 4) {
                const gap = window.filter(i => !idxs.includes(i));
                const t = classifyStraightGap(base, gap[0], 12);
                if (t === 'oesd') oesd = true; else gutshot = true;
            }
        }
        // Ace-low straight draws: A=0, 2=1, 3=2, 4=3, 5=4
        const aceLowIdxs = idxs.map(i => i === 12 ? -1 : i).sort((a, b) => a - b);
        for (let base = -1; base <= 0; base++) {
            const window = [base, base + 1, base + 2, base + 3, base + 4];
            const hits = window.filter(i => aceLowIdxs.includes(i));
            if (hits.length === 4) {
                const gap = window.filter(i => !aceLowIdxs.includes(i));
                const t = classifyStraightGap(base, gap[0], null);
                if (t === 'oesd') oesd = true; else gutshot = true;
            }
        }
        return { flushDraw, oesd, gutshot };
    }

    // ── Self-fold analysis ────────────────────────────────────────
    function analyzeSelfFold(holeCards, boardAtFold, finalBoard, foldStreet, opponentContext, opponentShowdowns) {
        const boardRankNums = boardAtFold.map(c => {
            const r = c.slice(0, -1); return RANK_VALUES[r === '10' ? '10' : r] || 0;
        });
        const holeRanks = holeCards.map(c => {
            const r = c.slice(0, -1); return RANK_VALUES[r === '10' ? '10' : r] || 0;
        });
        const boardMax = Math.max(...boardRankNums);
        const pairRanks = holeRanks.filter(r => boardRankNums.includes(r));
        const topPair = pairRanks.some(r => r === boardMax);
        const hasPair = pairRanks.length > 0;
        const isPocket = holeRanks[0] === holeRanks[1];
        const draw = detectDraw(holeCards, boardAtFold);
        const hasAnyDraw = draw.flushDraw || draw.oesd || draw.gutshot;

        let verdict, handDesc, drawCompleted = false;

        if (isPocket || topPair || (hasPair && pairRanks[0] > boardMax * 0.75)) {
            verdict = 'FOLDED_STRONG';
            handDesc = isPocket ? 'pocket pair' : 'top pair';
        } else if (hasPair && !topPair) {
            verdict = 'FOLDED_MARGINAL';
            handDesc = 'middle/bottom pair';
        } else if (hasAnyDraw) {
            if (finalBoard && finalBoard.length > boardAtFold.length) {
                const fullDraw = detectDraw(holeCards, finalBoard);
                const allCards = [...holeCards, ...finalBoard];
                const suitGroups = {};
                allCards.forEach(c => { const s = suitOf(c); suitGroups[s] = (suitGroups[s] || 0) + 1; });
                const flushMade = Object.values(suitGroups).some(n => n >= 5);
                drawCompleted = flushMade || (!fullDraw.flushDraw && draw.flushDraw) || (!fullDraw.oesd && draw.oesd);
            }
            verdict = drawCompleted ? 'FOLDED_DRAW_HIT' : 'FOLDED_DRAW_MISSED';
            handDesc = draw.flushDraw ? 'flush draw' : draw.oesd ? 'open-ended straight draw' : 'gutshot';
        } else {
            verdict = 'FOLDED_AIR';
            handDesc = 'nothing';
        }

        // Use showdown data first — actual opponent hands beat guesswork
        if (verdict === 'FOLDED_STRONG' && opponentShowdowns && opponentShowdowns.length > 0) {
            const bestOpp = opponentShowdowns.reduce((a, b) => b.rank > a.rank ? b : a);
            // Pair = rank 1 (same as top pair). Two pair or better = they had us beat.
            if (bestOpp.rank >= 2) {
                verdict = 'FOLDED_STRONG_CORRECT';
                handDesc = handDesc + ` — opponent showed ${bestOpp.handName}`;
            } else if (bestOpp.rank <= 1) {
                // They only had a pair or worse — our fold might have been a mistake
                handDesc = handDesc + ` — opponent showed ${bestOpp.handName} (possible leak)`;
            }
        } else if (verdict === 'FOLDED_STRONG' && opponentContext) {
            // No showdown data — fall back to pressure heuristics
            const preflopPressure = (opponentContext.preflopAllIns >= 1) || (opponentContext.preflopRaisers >= 2);
            const streetPressure =
                opponentContext.raisesOnStreet >= 2 ||
                opponentContext.anyAllIn ||
                (opponentContext.activePlayers >= 3 && opponentContext.raisesOnStreet >= 1) ||
                (opponentContext.maxBetFraction >= 0.40);
            if (streetPressure || (preflopPressure && foldStreet === 'flop')) {
                verdict = 'FOLDED_STRONG_CORRECT';
                handDesc = handDesc + ' (heavy pressure — likely correct fold)';
            }
        }

        return { verdict, handDesc, drawCompleted };
    }

    // ── Canonical hand notation (e.g. "AKs", "TT", "72o") ─────
    function canonicalHand(cards) {
        if (!cards || cards.length < 2) return null;
        const order = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'];
        let [rA, rB, sA, sB] = [rankOf(cards[0]), rankOf(cards[1]), suitOf(cards[0]), suitOf(cards[1])];
        if (order.indexOf(rA) < order.indexOf(rB)) { [rA, rB] = [rB, rA];[sA, sB] = [sB, sA]; }
        if (rA === rB) return `${rA}${rB}`;
        return `${rA}${rB}${sA === sB ? 's' : 'o'}`;
    }

    // Rates preflop hole card strength for hero fold-quality tracking.
    // Returns 'premium' | 'strong' | 'playable' | 'marginal' | 'trash'
    function rateStartingHandTier(cards) {
        const ch = canonicalHand(cards);
        if (!ch) return null;
        const isPair = ch.length === 2;
        const isSuited = ch.endsWith('s');
        const order = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'];
        const r1 = order.indexOf(ch[0]);
        const r2 = order.indexOf(ch[1]);
        const gap = isPair ? 0 : r1 - r2;

        if (isPair) {
            if (r1 >= order.indexOf('T')) return 'premium';  // TT+
            if (r1 >= order.indexOf('7')) return 'strong';   // 77-99
            if (r1 >= order.indexOf('4')) return 'playable'; // 44-66
            return 'marginal';                                // 22-33
        }

        // Unpaired
        if (r1 === order.indexOf('A')) {
            if (isSuited && r2 >= order.indexOf('J')) return 'premium';  // AJs+
            if (r2 >= order.indexOf('K')) return 'premium';  // AKo
            if (isSuited && r2 >= order.indexOf('8')) return 'strong';   // A8s-ATs
            if (r2 >= order.indexOf('J')) return 'strong';   // AJo-AQo
            if (isSuited) return 'playable'; // A2s-A7s
            if (r2 >= order.indexOf('9')) return 'playable'; // A9o-ATo
            return 'marginal';                                            // weak Ax offsuit
        }

        if (r1 === order.indexOf('K')) {
            if (isSuited && r2 >= order.indexOf('T')) return 'strong';   // KTs+
            if (r2 >= order.indexOf('Q')) return 'strong';   // KQo
            if (isSuited && r2 >= order.indexOf('8')) return 'playable'; // K8s-K9s
            if (r2 >= order.indexOf('J')) return 'playable'; // KJo
            return 'marginal';
        }

        // Broadway suited connectors / high suited connectors
        if (isSuited && gap <= 2 && r1 >= order.indexOf('9')) return 'playable'; // 97s-QJs etc.
        if (isSuited && gap <= 1 && r1 >= order.indexOf('6')) return 'marginal'; // low suited connectors

        // Off-suit connectors with decent high card
        if (!isSuited && gap === 1 && r1 >= order.indexOf('Q')) return 'playable'; // QJo, KQo already covered
        if (!isSuited && gap === 1 && r1 >= order.indexOf('J')) return 'marginal'; // JTo

        return 'trash';
    }

    // Describes what hero had when they folded — used for fold coach messages.
    // Returns a short natural-language string: "top pair", "a flush draw", "two overcards", etc.
    function describeFoldHandAtStreet(holeCards, boardAtFold) {
        if (!holeCards?.length) return null;
        const rkStr = c => { const r = c.slice(0, -1); return r === '10' ? 'T' : r; };
        const hVals = holeCards.map(c => RANK_VALUES[rkStr(c)] || 0);

        // Preflop — describe hole cards
        if (!boardAtFold?.length) {
            const ch = canonicalHand(holeCards);
            if (!ch) return null;
            const isPocket = ch.length === 2;
            if (isPocket) {
                const bigPairs = ['A', 'K', 'Q', 'J', 'T'];
                return bigPairs.includes(ch[0]) ? `pocket ${ch[0]}s` : `a small pocket pair (${ch})`;
            }
            return ch; // e.g. "AKo", "JTs"
        }

        // Postflop — use evaluated rank + draw context
        const foldHand = boardAtFold.length >= 3 ? evaluateShownHand(holeCards, boardAtFold) : null;
        const rank = foldHand?.rank ?? -1;
        const draw = boardAtFold.length >= 3 ? detectDraw(holeCards, boardAtFold) : { flushDraw: false, oesd: false, gutshot: false };
        const bVals = boardAtFold.map(c => RANK_VALUES[rkStr(c)] || 0);
        const bMax = Math.max(...bVals);

        const drawParts = [];
        if (draw.flushDraw) drawParts.push('flush draw');
        if (draw.oesd) drawParts.push('open-ended straight draw');
        else if (draw.gutshot) drawParts.push('gutshot');
        const drawStr = drawParts.join(' + ');

        if (rank >= 9) return 'a royal flush';
        if (rank === 8) return 'a straight flush';
        if (rank === 7) return 'four of a kind';
        if (rank === 6) return 'a full house';
        if (rank === 5) return drawStr ? `a flush with a straight draw` : 'a flush';
        if (rank === 4) return 'a straight';
        if (rank === 3) {
            const isPocket = hVals[0] === hVals[1] && hVals[0] !== 0;
            return (isPocket && bVals.includes(hVals[0])) ? 'a set' : 'three of a kind';
        }
        if (rank === 2) return drawStr ? `two pair with a ${drawStr}` : 'two pair';
        if (rank === 1) {
            const isPocket = hVals[0] === hVals[1] && hVals[0] !== 0;
            if (isPocket) return `a pocket pair`;
            const pairVal = hVals.find(v => bVals.includes(v));
            if (pairVal == null) {
                // Board is paired but neither hole card connects — fall through to overcard logic
                const oc = hVals.filter(v => v > bMax).length;
                if (drawStr) return oc >= 2 ? `two overcards and a ${drawStr}` : oc === 1 ? `an overcard and a ${drawStr}` : `a ${drawStr}`;
                if (oc === 2) return 'two overcards';
                if (oc === 1) return 'an overcard';
                return 'nothing';
            }
            const bSorted = [...bVals].sort((a, b) => b - a);
            const type = pairVal === bMax ? 'top pair'
                : pairVal === bSorted[1] ? 'middle pair'
                    : 'bottom pair';
            return drawStr ? `${type} with a ${drawStr}` : type;
        }
        // rank 0 or no board match
        const overcards = hVals.filter(v => v > bMax).length;
        if (drawStr) {
            if (overcards >= 2) return `two overcards and a ${drawStr}`;
            if (overcards === 1) return `an overcard and a ${drawStr}`;
            return `a ${drawStr}`;
        }
        if (overcards === 2) return 'two overcards';
        if (overcards === 1) return 'an overcard';
        return 'nothing';
    }

    // Describes what would have happened after the fold — for fold coach context.
    // Returns null if nothing interesting changed (board didn't improve your hand).
    function describeFoldOutcome(holeCards, boardAtFold, finalBoard) {
        if (!holeCards?.length || !finalBoard?.length || finalBoard.length < 3) return null;
        if (finalBoard.length <= (boardAtFold?.length || 0)) return null; // no new cards

        const foldRank = boardAtFold?.length >= 3 ? (evaluateShownHand(holeCards, boardAtFold)?.rank ?? -1) : -1;
        const finalEval = evaluateShownHand(holeCards, finalBoard);
        const finalRank = finalEval?.rank ?? -1;
        if (finalRank < 0) return null;

        // Check if a draw specifically completed
        const hadDraw = boardAtFold?.length >= 3 ? detectDraw(holeCards, boardAtFold) : null;
        const lastDraw = detectDraw(holeCards, finalBoard);
        if (hadDraw?.flushDraw && !lastDraw.flushDraw && finalRank >= 5)
            return 'your flush would have come in';
        if ((hadDraw?.oesd || hadDraw?.gutshot) && !lastDraw.oesd && !lastDraw.gutshot && finalRank >= 4)
            return 'your straight would have come in';

        // For pair/two-pair outcomes, verify a hole card actually participates.
        // evaluateShownHand picks the best 5-card hand from all 7 cards — a board pair (e.g. 882)
        // would produce rank 1 even when neither hole card is an 8. Only report if the hero's
        // hole cards contributed: either a pocket pair (always contributes) or a hole card that
        // matches a board card rank.
        const hasPocket = holeCards[0].slice(0, -1) === holeCards[1].slice(0, -1);
        const finalBoardRanks = finalBoard.map(c => c.slice(0, -1));
        const holeMatchesBoard = holeCards.some(c => finalBoardRanks.includes(c.slice(0, -1)));
        const holeContributes = hasPocket || holeMatchesBoard;

        if (foldRank === -1) {
            // Preflop fold — show what final board would have made
            if (finalRank >= 7) return 'you would have made quads';
            if (finalRank === 6) return 'you would have filled up to a full house';
            if (finalRank === 5) return 'you would have made a flush';
            if (finalRank === 4) return 'you would have hit a straight';
            if (finalRank === 3) {
                const hVals = holeCards.map(c => RANK_VALUES[c.slice(0, -1)] || 0);
                const bVals = finalBoard.map(c => RANK_VALUES[c.slice(0, -1)] || 0);
                return (hVals[0] === hVals[1] && bVals.includes(hVals[0]))
                    ? 'you would have flopped a set'
                    : 'you would have made three of a kind';
            }
            if (finalRank === 2) return holeContributes ? 'you would have made two pair' : null;
            if (finalRank === 1) return holeContributes ? 'you would have paired up' : null;
            return null;
        }

        if (finalRank > foldRank) {
            if (finalRank === 7) return 'you would have made quads';
            if (finalRank === 6) return 'you would have filled up to a full house';
            if (finalRank === 5) return 'a flush would have hit';
            if (finalRank === 4) return 'a straight would have hit';
            if (finalRank === 3) return 'you would have made a set';
            if (finalRank === 2) return holeContributes ? 'you would have made two pair' : null;
            if (finalRank === 1) return holeContributes ? 'you would have paired up' : null;
        }
        return null;
    }

    function analyzeUncontestedWin(p, boardCards, streetBoards, startStack, bbAmount, position, selfHoleCards) {
        if (!p.wonNoShowdown) return null;

        const winStreet = (streetBoards.river?.length) ? 'river'
            : (streetBoards.turn?.length) ? 'turn'
                : (streetBoards.flop?.length) ? 'flop'
                    : 'preflop';

        const streetAgg = s => (p[s]?.bets || 0) + (p[s]?.raises || 0);
        const flopAgg = streetAgg('flop');
        const turnAgg = streetAgg('turn');
        const riverAgg = streetAgg('river');
        const totalPostAgg = flopAgg + turnAgg + riverAgg;
        const streetsBet = [flopAgg > 0, turnAgg > 0, riverAgg > 0].filter(Boolean).length;

        const raisedPre = !!(p.preflopRaiseAmt || p.raisedPreflop);

        const betPcts = startStack && p.betAmts?.length
            ? p.betAmts.map(b => b.amt / startStack * 100)
            : [];
        const maxBetPct = betPcts.length ? Math.max(...betPcts) : 0;
        const hasOverbet = maxBetPct >= 40;
        const isProbe = maxBetPct > 0 && maxBetPct < 6;

        const betsByStreet = { flop: [], turn: [], river: [] };
        (p.betAmts || []).forEach(b => { if (betsByStreet[b.street]) betsByStreet[b.street].push(b.amt); });
        const streetMaxes = ['flop', 'turn', 'river']
            .map(s => betsByStreet[s].length ? Math.max(...betsByStreet[s]) : 0)
            .filter(v => v > 0);
        const isEscalating = streetMaxes.length >= 2 &&
            streetMaxes.every((v, i) => i === 0 || v >= streetMaxes[i - 1] * 1.2);

        const isLP = position === 'LP';

        let verdict, reason;

        if (winStreet === 'preflop' && raisedPre) {
            verdict = 'PREFLOP_STEAL';
            reason = `Raised preflop and took it down${isLP ? ' — positional steal' : ' — open-raise steal'}`;
        } else if (winStreet === 'preflop') {
            verdict = 'PREFLOP_LIMP_WIN';
            reason = 'Won preflop without raising — opponents folded to a limp or blind';
        } else if (hasOverbet && totalPostAgg > 0) {
            const ovetBetStreet = p.betAmts?.find(b => b.amt / startStack * 100 >= 40)?.street || winStreet;
            verdict = 'OVERBET_PRESSURE';
            reason = `Overbet ${maxBetPct.toFixed(0)}% of stack on ${ovetBetStreet} — massive pressure, took it down`;
        } else if (raisedPre && flopAgg > 0 && winStreet === 'flop' && streetsBet === 1) {
            verdict = 'CBET_WIN';
            reason = 'Raised preflop, continuation bet the flop, took it down — standard c-bet line';
        } else if (raisedPre && streetsBet >= 2) {
            const parts = [];
            if (flopAgg) parts.push('flop');
            if (turnAgg) parts.push('turn');
            if (riverAgg) parts.push('river');
            verdict = 'BARREL_WIN';
            reason = `Raised preflop and barreled ${parts.join(' + ')} (${streetsBet} streets) — multi-street pressure${isEscalating ? ', escalating sizing' : ''}`;
        } else if (flopAgg === 0 && (turnAgg > 0 || riverAgg > 0)) {
            verdict = 'DELAYED_CBET';
            reason = `Checked the flop, then bet ${turnAgg > 0 ? 'the turn' : 'the river'} — delayed aggression`;
        } else if (totalPostAgg > 0 && isProbe && streetsBet === 1) {
            verdict = 'PROBE_WIN';
            reason = `Small bet (${maxBetPct.toFixed(1)}% of stack) on one street — minimal investment takedown`;
        } else if (totalPostAgg === 0) {
            verdict = 'PASSIVE_WIN';
            reason = `Won without betting post-flop — opponents folded${winStreet === 'river' ? ' after all streets checked through' : ''}`;
        } else {
            verdict = 'SINGLE_BET_WIN';
            reason = `Bet on ${streetsBet} street${streetsBet > 1 ? 's' : ''} and took it down`;
        }

        // Self-player override (hole cards available)
        if (selfHoleCards && boardCards.length >= 3) {
            const hRanks = selfHoleCards.map(c => {
                const r = c.slice(0, -1); return RANK_VALUES[r === '10' ? '10' : r] || 0;
            });
            const bRankVals = boardCards.map(c => {
                const r = c.slice(0, -1); return RANK_VALUES[r === '10' ? '10' : r] || 0;
            });
            const boardMax = Math.max(...bRankVals);
            const hasPair = hRanks.some(r => bRankVals.includes(r)) || hRanks[0] === hRanks[1];
            const hasTopPair = hRanks.some(r => bRankVals.includes(r) && r === boardMax);
            const hasOverpair = hRanks[0] === hRanks[1] && hRanks[0] > boardMax;

            const draw = detectDraw(selfHoleCards, boardCards);
            const hasAnyDraw = draw.flushDraw || draw.oesd || draw.gutshot;
            const hasNothing = !hasPair && !hasAnyDraw;

            if (totalPostAgg > 0) {
                // Texture at the street where the last bet occurred
                const betBoard = streetBoards.river?.length ? streetBoards.river
                    : streetBoards.turn?.length ? streetBoards.turn
                        : streetBoards.flop || boardCards;
                const texture = analyzeBoardTexture(betBoard);
                const isWet = !!(texture?.isFlushy || texture?.straightConnected);
                const onRiver = winStreet === 'river';
                const drawDesc = texture
                    ? [texture.isFlushy && `${texture.flushCards}× ${texture.dominantSuit} flush draw`,
                    texture.straightConnected && `${texture.maxConnected}-connected`]
                        .filter(Boolean).join(', ')
                    : '';
                const boardCtx = drawDesc ? ` (${drawDesc})` : '';

                if (hasOverpair) {
                    verdict = 'SELF_VALUE_UNCALLED';
                    reason = isWet && !onRiver
                        ? `You had an overpair on a draw-heavy board${boardCtx} — opponent folded. Protection was correct, but you'd prefer a call here.`
                        : `You had an overpair and bet — opponent folded. They got away cheap.`;
                } else if (hasTopPair) {
                    verdict = 'SELF_VALUE_UNCALLED';
                    const comboNote = hasAnyDraw
                        ? ` + ${draw.flushDraw ? 'flush draw' : draw.oesd ? 'straight draw' : 'gutshot'}`
                        : '';
                    if (onRiver) {
                        reason = `You had top pair${comboNote} and bet the river — opponent folded. They got away cheap.`;
                    } else if (isWet) {
                        reason = `You had top pair${comboNote} on a draw-heavy board${boardCtx} — opponent folded. Protection bet worked, equity denied.`;
                    } else {
                        reason = `You had top pair${comboNote} and bet — opponent folded. They got away cheap.`;
                    }
                } else if (hasNothing) {
                    verdict = 'SELF_BLUFF_SUCCESS';
                    reason = `You had nothing and bet ${streetsBet} street${streetsBet > 1 ? 's' : ''} — successful bluff`;
                } else if (hasAnyDraw && !hasPair) {
                    verdict = 'SELF_SEMI_BLUFF_SUCCESS';
                    reason = `You had a ${draw.flushDraw ? 'flush draw' : draw.oesd ? 'straight draw' : 'gutshot'} and bet — took it down before the draw resolved`;
                } else if (hasPair && hasAnyDraw && !hasTopPair && !hasOverpair) {
                    verdict = 'SELF_THIN_VALUE_SUCCESS';
                    reason = `You had a pair + ${draw.flushDraw ? 'flush draw' : draw.oesd ? 'straight draw' : 'gutshot'} — semi-value bet that worked`;
                } else if (hasPair && !hasTopPair && !hasOverpair) {
                    verdict = 'SELF_THIN_VALUE_SUCCESS';
                    reason = isWet && !onRiver
                        ? `You had a marginal pair on a draw-heavy board${boardCtx} — protection bet that worked`
                        : 'You had a marginal pair and bet — thin value that worked';
                }
            }
        }

        return { verdict, reason };
    }

    // ── Hand finalization ────────────────────────────────────────

    // Schedule a hand finalization shortly after a win line to avoid stale state
    function scheduleHandFinalize(reason, delayMs = 900) {
        if (!currentHand) return;
        if (currentHand._handEnded) return;
        currentHand._handEnded = true;
        currentHand._handEndReason = reason || 'unknown';
        const targetHand = currentHand;
        if (finalizeTimer) clearTimeout(finalizeTimer);
        finalizeTimer = setTimeout(() => {
            finalizeTimer = null;
            if (currentHand !== targetHand) return;
            finalizeCurrentHand();
        }, delayMs);
    }

    function finalizeCurrentHand() {
        if (!currentHand) return;
        if (finalizeTimer) { clearTimeout(finalizeTimer); finalizeTimer = null; }
        // Re-entry guard: if a previous finalize attempt threw partway through, the hand
        // may still be set. Never fold the same hand into the stats twice.
        if (currentHand._statsCounted) { currentHand = null; return; }
        currentHand._statsCounted = true;

        const handBB = currentHand.bbAmount || currentTableBB;
        const all = getStats();

        // Pre-compute winner rank, winner info, and street boards for verdict analysis
        const winnerRank = Math.max(-1,
            ...Object.values(currentHand.perPlayer)
                .filter(p => p.wonShowdown && p.showdownRank >= 0)
                .map(p => p.showdownRank)
        );
        const winnerInfoRaw = Object.values(currentHand.perPlayer)
            .find(p => p.wonShowdown && p.showdownCards);
        const winnerInfo = winnerInfoRaw
            ? { handName: winnerInfoRaw.showdownHandName, cards: winnerInfoRaw.showdownCards }
            : null;
        const streetBoards = {
            flop: currentHand.flopCards || [],
            turn: currentHand.turnCards || [],
            river: currentHand.riverCards || [],
        };

        // Cloud sync: per-player numeric deltas collected across the loop below.
        // Synthetic hands are skipped (partial data, device-local ids can't dedupe).
        const _syncEnabled = hudSettings.cloudSync && !currentHand.synthetic && currentHand.handId;
        const _syncPlayers = [];

        Object.entries(currentHand.perPlayer).forEach(([name, p]) => {
            const numId = chatNameToSeatId[name];
            const s = resolveStatsByName(name, all) || blankStats(name);
            s.displayName = name;
            if (numId) s.numericId = numId;
            if (!Array.isArray(s.recent)) s.recent = [];
            if (!Array.isArray(s.history)) s.history = [];
            if (!Array.isArray(s.autoTags)) s.autoTags = [];

            const _syncBefore = _syncEnabled ? _numericSnapshot(s) : null;
            const _syncTagCount = s.autoTags.length;
            let _syncHist = null;

            const isHUHand = currentHand.isHU === true;

            // Declared outside the HU guard — both blocks below reference these
            const pos = getPlayerPosition(name, currentHand);
            p.position = pos;
            const facedFlopBet = p.sawFlop && currentHand.flopBetOccurred && currentHand.flopBettor !== name;

            if (name === localPlayerName && !p.showdownCards) {
                const cards = currentHand.selfHoleCards || readOwnCardsFromDOM();
                if (cards) p.showdownCards = cards;
            }

            if (p.showdownRank < 0 && p.showdownCards && (currentHand.boardCards || []).length >= 3) {
                const evaled = evaluateShownHand(p.showdownCards, currentHand.boardCards);
                if (evaled) {
                    p.showdownRank = evaled.rank;
                    if (!p.showdownHandName && evaled.name) p.showdownHandName = evaled.name;
                }
            }

            if (!isHUHand) {
                s.handsObserved++;
                s.lastSeen = Date.now();

                if (p.voluntaryPreflop) s.vpipCount++;
                if (p.raisedPreflop) s.pfrCount++;
                if (p.limpedPreflop) s.limpCount++;
                if (p.facedPreflopRaise) s.threeBetOpportunities++;
                if (p.threeBet) s.threeBetCount++;
                if (p.facedThreeBet) s.foldTo3BetOpportunities++;
                if (p.foldedToThreeBet) s.foldTo3BetCount++;

                if (pos && currentHand.dealerSeatId) {
                    if (!s.positions) s.positions = blankPositions();
                    s.positions[pos].hands++;
                    if (p.voluntaryPreflop) s.positions[pos].vpip++;
                    if (p.raisedPreflop) s.positions[pos].pfr++;
                }

                if (facedFlopBet) {
                    s.facedFlopBetCount++;
                    if (p.foldedOnFlop) s.foldedVsFlopBetCount++;
                }

                // Cbet tracking — preflop aggressor who saw the flop had a cbet opportunity.
                // They "made" it if they were the flop bettor.
                if (p.raisedPreflop && p.sawFlop) {
                    s.cbetFlopOpps++;
                    if (currentHand.flopBettor === name) s.cbetFlopMade++;
                }
                // Fold-to-cbet — non-aggressor saw a cbet (flop bet from preflop aggressor) and folded.
                if (p.sawFlop && !p.raisedPreflop && currentHand.flopBettor && currentHand.flopBettor !== name
                    && currentHand.preflopAggressor && currentHand.flopBettor === currentHand.preflopAggressor) {
                    s.foldToCbetFlopOpps++;
                    if (p.foldedOnFlop) s.foldToCbetFlopFolded++;
                }
                // Donk bet — preflop caller (not raiser) saw flop with a preflop aggressor present;
                // counts as donk if they were the flop bettor (bet into the aggressor before the cbet).
                if (p.voluntaryPreflop && !p.raisedPreflop && p.sawFlop && currentHand.preflopAggressor && currentHand.preflopAggressor !== name) {
                    s.donkFlopOpps++;
                    if (currentHand.flopBettor === name) s.donkFlopMade++;
                }
                // Check-raise flop — incremented when player checked then raised on the flop this hand.
                if (p.checkRaisedFlopThisHand) s.crFlopCount++;
                // Squeeze — flagged when player 3-bet preflop after at least one caller existed.
                if (p.squeezed) s.squeezeCount++;

                s.postBets += p.postBets;
                s.postRaises += p.postRaises;
                s.postCalls += p.postCalls;
                s.postChecks += p.postChecks;
                s.postFolds += p.postFolds;
                s.postAllinBets = (s.postAllinBets || 0) + (p.postAllinBets || 0);
                s.postAllinRaises = (s.postAllinRaises || 0) + (p.postAllinRaises || 0);

                if (p.sawFlop) s.sawFlopCount++;
                if (p.sawFlop && (p.wonShowdown || p.wonNoShowdown)) s.wonAfterSawFlopCount++;
                if (p.reachedShowdown) {
                    if (!p.sawFlop) s.sawFlopCount++;
                    s.wentToShowdownCount++;
                    if (p.wonShowdown) s.wonAtShowdownCount++;
                    if (p.showdownRank >= 0) {
                        if (p.showdownRank <= 1) s.showdownWeak++;
                        else s.showdownStrong++;
                    }
                }
                if (p.wonNoShowdown) s.wonNoShowdownCount++;

                if (p.voluntaryShowed) {
                    s.voluntaryShowCount++;
                    if (p.wonNoShowdown) s.voluntaryShowAfterWin++;
                }
            } // end !isHUHand guard

            if (!isHUHand && p.showdownRank >= 0 && (p.reachedShowdown || p.voluntaryShowed)) {
                if (p.showdownRank <= 1) s.shownWeak = (s.shownWeak || 0) + 1;
                else s.shownStrong = (s.shownStrong || 0) + 1;
            }

            // Track starting hand distribution for self
            if (name === localPlayerName && p.showdownCards) {
                const ch = canonicalHand(p.showdownCards);
                if (ch) {
                    if (!s.startingHands) s.startingHands = {};
                    if (!s.startingHands[ch]) s.startingHands[ch] = { dealt: 0, vpip: 0, pfr: 0, won: 0 };
                    s.startingHands[ch].dealt++;
                    if (p.voluntaryPreflop) s.startingHands[ch].vpip++;
                    if (p.raisedPreflop) s.startingHands[ch].pfr++;
                    if (p.wonShowdown || p.wonNoShowdown) s.startingHands[ch].won++;
                }
            }

            // Track shown hands for opponents (showdown or voluntary show)
            if (name !== localPlayerName && p.showdownCards && (p.reachedShowdown || p.voluntaryShowed)) {
                // Grade the beat-bubble read against villain's revealed cards before we mutate shownHands.
                // "actualBeats" reflects whether villain's final hand beat hero's hand on this board
                // (or null when hero folded with no hole cards captured / board too short to score).
                const heroHole = currentHand.selfHoleCards;
                let actualBeats = null;
                if (heroHole && heroHole.length === 2 && currentHand.boardCards?.length >= 3) {
                    const heroScore = _scoreHand([...heroHole.map(_normalizeCard), ...currentHand.boardCards.map(_normalizeCard)]);
                    const vScore = _scoreHand([...p.showdownCards.map(_normalizeCard), ...currentHand.boardCards.map(_normalizeCard)]);
                    actualBeats = vScore > heroScore;
                }
                _recordBeatRead(name, p.showdownCards, actualBeats);

                const ch = canonicalHand(p.showdownCards);
                if (ch) {
                    if (!s.shownHands) s.shownHands = {};
                    if (!s.shownHands[ch]) s.shownHands[ch] = { seen: 0, pfr: 0, won: 0, pfRaiseBBsSum: 0, pfRaiseBBsSamples: 0, pfCallBBsSum: 0, pfCallBBsSamples: 0 };
                    const sh = s.shownHands[ch];
                    sh.seen++;
                    if (p.raisedPreflop) {
                        sh.pfr++;
                        if (p.preflopRaiseAmt && handBB) {
                            sh.pfRaiseBBsSum += p.preflopRaiseAmt / handBB;
                            sh.pfRaiseBBsSamples++;
                        }
                    } else if (p.voluntaryPreflop && p.preflopCallAmt && handBB) {
                        sh.pfCallBBsSum += p.preflopCallAmt / handBB;
                        sh.pfCallBBsSamples++;
                    }
                    if (p.wonShowdown || p.wonNoShowdown) sh.won++;
                }
            }

            // Analyze self-fold verdict (skipped for HU hands)
            if (!isHUHand && name === localPlayerName && p.showdownCards && currentHand.selfFoldStreet && currentHand.selfBoardAtFold) {
                const foldSt = currentHand.selfFoldStreet;
                const opponentContext = (() => {
                    let raisesOnStreet = 0, maxBetOnStreet = 0, activePlayers = 0, anyAllIn = false;
                    let preflopRaisers = 0, preflopAllIns = 0;
                    Object.entries(currentHand.perPlayer).forEach(([oName, op]) => {
                        if (oName === name) return;
                        if (op.foldedPreflop) return;
                        activePlayers++;
                        if (op[foldSt]) raisesOnStreet += (op[foldSt].raises || 0);
                        (op.betAmts || []).filter(b => b.street === foldSt).forEach(b => {
                            if (b.amt > maxBetOnStreet) maxBetOnStreet = b.amt;
                        });
                        if (op.raisedPreflop) {
                            preflopRaisers++;
                            const oStack = currentHand.stackAtStart?.[oName] || 0;
                            if (oStack > 0 && op.preflopRaiseAmt && op.preflopRaiseAmt / oStack >= 0.75) preflopAllIns++;
                        }
                    });
                    const selfStack = currentHand.stackAtStart?.[name] || 0;
                    const maxBetFraction = selfStack > 0 && maxBetOnStreet > 0 ? maxBetOnStreet / selfStack : 0;
                    if (maxBetFraction >= 0.90) anyAllIn = true;
                    return { raisesOnStreet, maxBetOnStreet, activePlayers, anyAllIn, maxBetFraction, preflopRaisers, preflopAllIns };
                })();

                // Collect opponent showdown hands — available since finalization runs after all messages
                const opponentShowdowns = Object.entries(currentHand.perPlayer)
                    .filter(([oName, op]) => oName !== name && op.showdownRank >= 0 && op.showdownHandName)
                    .map(([, op]) => ({ rank: op.showdownRank, handName: op.showdownHandName }));

                const fv = analyzeSelfFold(p.showdownCards, currentHand.selfBoardAtFold, currentHand.boardCards, foldSt, opponentContext, opponentShowdowns);
                p.selfFoldVerdict = fv;
                if (fv.verdict === 'FOLDED_STRONG') s.selfFoldedStrongCount++;
                else if (fv.verdict === 'FOLDED_STRONG_CORRECT') s.selfFoldedStrongCorrectCount++;
                else if (fv.verdict === 'FOLDED_DRAW_HIT' ||
                    fv.verdict === 'FOLDED_DRAW_MISSED') s.selfFoldedDrawCount++;
                else if (fv.verdict === 'FOLDED_MARGINAL') s.selfFoldedMarginalCount++;
                else if (fv.verdict === 'FOLDED_AIR') s.selfFoldedAirCount++;
            }

            // Compute bluff verdict and update cumulative counts
            const verdict = analyzeShowdownBluff(
                p,
                currentHand.boardCards,
                winnerRank,
                streetBoards,
                currentHand.stackAtStart?.[name] ?? null,
                currentHand.bbAmount,
                pos
            );
            p.bluffVerdict = verdict || null;
            if (verdict) {
                s.totalVerdicts = (s.totalVerdicts || 0) + 1;
                if (verdict.verdict === 'CLEAR_BLUFF' || verdict.verdict === 'BLUFF_WET')
                    s.bluffCount = (s.bluffCount || 0) + 1;
                else if (verdict.verdict === 'THIN_VALUE')
                    s.thinValueCount = (s.thinValueCount || 0) + 1;
                else if (verdict.verdict === 'PROTECTION' || verdict.verdict === 'VALUE_LOSS' || verdict.verdict === 'OUTPLAYED') {
                    s.valuePlayCount = (s.valuePlayCount || 0) + 1;
                    if (verdict.verdict === 'PROTECTION')
                        s.protectionCount = (s.protectionCount || 0) + 1;
                }
                else if (verdict.verdict === 'DRAW_MADE')
                    s.drawCount = (s.drawCount || 0) + 1;
                else if (verdict.verdict === 'DRAW_MISS') {
                    s.drawCount = (s.drawCount || 0) + 1;
                    s.drawMissCount = (s.drawMissCount || 0) + 1;
                }
                else if (verdict.verdict === 'LOOSE_CALL')
                    s.looseCallCount = (s.looseCallCount || 0) + 1;
                else if (verdict.verdict === 'STRONG_VALUE')
                    s.strongValueCount = (s.strongValueCount || 0) + 1;
                else if (verdict.verdict === 'THIN_WIN')
                    s.thinWinCount = (s.thinWinCount || 0) + 1;
                else if (verdict.verdict === 'TRAP')
                    s.trapCount = (s.trapCount || 0) + 1;
            }

            if (handBB) { if (!s.byTable) s.byTable = {}; if (!s.byTable[handBB]) s.byTable[handBB] = blankTableStats(); }
            if (verdict && handBB && s.byTable?.[handBB]) {
                const t = s.byTable[handBB];
                t.totalVerdicts = (t.totalVerdicts || 0) + 1;
                if (verdict.verdict === 'CLEAR_BLUFF' || verdict.verdict === 'BLUFF_WET')
                    t.bluffCount = (t.bluffCount || 0) + 1;
                else if (verdict.verdict === 'THIN_VALUE')
                    t.thinValueCount = (t.thinValueCount || 0) + 1;
                else if (verdict.verdict === 'PROTECTION' || verdict.verdict === 'VALUE_LOSS' || verdict.verdict === 'OUTPLAYED') {
                    t.valuePlayCount = (t.valuePlayCount || 0) + 1;
                    if (verdict.verdict === 'PROTECTION')
                        t.protectionCount = (t.protectionCount || 0) + 1;
                }
                else if (verdict.verdict === 'DRAW_MADE')
                    t.drawCount = (t.drawCount || 0) + 1;
                else if (verdict.verdict === 'DRAW_MISS') {
                    t.drawCount = (t.drawCount || 0) + 1;
                    t.drawMissCount = (t.drawMissCount || 0) + 1;
                }
                else if (verdict.verdict === 'LOOSE_CALL')
                    t.looseCallCount = (t.looseCallCount || 0) + 1;
                else if (verdict.verdict === 'STRONG_VALUE')
                    t.strongValueCount = (t.strongValueCount || 0) + 1;
                else if (verdict.verdict === 'THIN_WIN')
                    t.thinWinCount = (t.thinWinCount || 0) + 1;
                else if (verdict.verdict === 'TRAP')
                    t.trapCount = (t.trapCount || 0) + 1;
            }

            // Uncontested win verdict
            if (p.wonNoShowdown) {
                const selfCards = (name === localPlayerName)
                    ? (currentHand.selfHoleCards || readOwnCardsFromDOM())
                    : null;
                const ucVerdict = analyzeUncontestedWin(
                    p,
                    currentHand.boardCards,
                    streetBoards,
                    currentHand.stackAtStart?.[name] ?? null,
                    currentHand.bbAmount,
                    pos,
                    selfCards
                );
                if (ucVerdict) {
                    p.bluffVerdict = ucVerdict;
                    s.ucTotalVerdicts = (s.ucTotalVerdicts || 0) + 1;
                    const ucCounterMap = {
                        PREFLOP_STEAL: 'ucStealCount',
                        CBET_WIN: 'ucCbetWinCount',
                        BARREL_WIN: 'ucBarrelWinCount',
                        DELAYED_CBET: 'ucDelayedCount',
                        PROBE_WIN: 'ucProbeCount',
                        PASSIVE_WIN: 'ucPassiveCount',
                        OVERBET_PRESSURE: 'ucOverbetCount',
                        SELF_BLUFF_SUCCESS: 'selfBluffSuccessCount',
                        SELF_VALUE_UNCALLED: 'selfValueUncalledCount',
                        SELF_SEMI_BLUFF_SUCCESS: 'selfSemiBluffCount',
                        SELF_THIN_VALUE_SUCCESS: 'selfThinValueWinCount',
                    };
                    const counterKey = ucCounterMap[ucVerdict.verdict];
                    if (counterKey) s[counterKey] = (s[counterKey] || 0) + 1;
                    if (handBB && s.byTable?.[handBB]) {
                        const t = s.byTable[handBB];
                        t.ucTotalVerdicts = (t.ucTotalVerdicts || 0) + 1;
                        if (counterKey) t[counterKey] = (t[counterKey] || 0) + 1;
                    }
                }
            }

            // Turn/river facing stats for self player
            if (!isHUHand && name === localPlayerName) {
                if (currentHand._facedTurnBet) s.facedTurnBetCount = (s.facedTurnBetCount || 0) + currentHand._facedTurnBet;
                if (currentHand._facedRiverBet) s.facedRiverBetCount = (s.facedRiverBetCount || 0) + currentHand._facedRiverBet;
                if (currentHand.selfFoldStreet === 'turn') s.foldedVsTurnBetCount = (s.foldedVsTurnBetCount || 0) + 1;
                if (currentHand.selfFoldStreet === 'river') s.foldedVsRiverBetCount = (s.foldedVsRiverBetCount || 0) + 1;
            }

            if (!isHUHand) {
                const entry = buildHistEntry(currentHand.handId, p, currentHand.boardCards, handBB, currentHand.stackAtStart?.[name] ?? null, winnerInfo);
                if (entry) {
                    if (!s.history) s.history = [];
                    s.history.unshift(entry);
                    if (s.history.length > 30) s.history.length = 30;
                    _syncHist = entry;
                }
                checkAutoTagsAtFinalization(name, p, currentHand, streetBoards);
            }

            const recentEntry = {
                vpip: p.voluntaryPreflop,
                pfr: p.raisedPreflop,
                aggressive: p.postBets + p.postRaises,
                passive: p.postCalls + p.postChecks,
                folds: p.postFolds,
                sawFlop: p.sawFlop,
                showdown: p.reachedShowdown,
                won: p.wonShowdown || p.wonNoShowdown,
                bbAmount: handBB || null,
                hu: isHUHand,
                // Hero-only: effective stack in BBs at hand start (used for deep-stack VPIP adjustment)
                effectiveStackBB: name === localPlayerName ? (currentHand.effectiveStackBB ?? null) : undefined,
            };
            // For hero preflop folds, tag the hand tier so self-classification can discount trash folds
            if (name === localPlayerName && p.foldedPreflop && !p.voluntaryPreflop) {
                const holeCards = currentHand.selfHoleCards || p.showdownCards;
                if (holeCards) recentEntry.foldTier = rateStartingHandTier(holeCards);
            }
            s.recent.push(recentEntry);
            if (s.recent.length > RECENT_CAP) s.recent.shift();

            if (!isHUHand && handBB) {
                if (!s.byTable) s.byTable = {};
                if (!s.byTable[handBB]) s.byTable[handBB] = blankTableStats();
                const t = s.byTable[handBB];
                if (!Array.isArray(t.recent)) t.recent = [];

                t.handsObserved++;
                if (p.voluntaryPreflop) t.vpipCount++;
                if (p.raisedPreflop) t.pfrCount++;
                if (p.limpedPreflop) t.limpCount++;
                if (p.facedPreflopRaise) t.threeBetOpportunities++;
                if (p.threeBet) t.threeBetCount++;
                if (p.facedThreeBet) t.foldTo3BetOpportunities++;
                if (p.foldedToThreeBet) t.foldTo3BetCount++;

                if (pos && currentHand.dealerSeatId) {
                    if (!t.positions) t.positions = blankPositions();
                    t.positions[pos].hands++;
                    if (p.voluntaryPreflop) t.positions[pos].vpip++;
                    if (p.raisedPreflop) t.positions[pos].pfr++;
                }

                t.postBets += p.postBets;
                t.postRaises += p.postRaises;
                t.postCalls += p.postCalls;
                t.postChecks += p.postChecks;
                t.postFolds += p.postFolds;

                if (facedFlopBet) {
                    t.facedFlopBetCount++;
                    if (p.foldedOnFlop) t.foldedVsFlopBetCount++;
                }

                if (p.raisedPreflop && p.sawFlop) {
                    t.cbetFlopOpps++;
                    if (currentHand.flopBettor === name) t.cbetFlopMade++;
                }
                if (p.sawFlop && !p.raisedPreflop && currentHand.flopBettor && currentHand.flopBettor !== name
                    && currentHand.preflopAggressor && currentHand.flopBettor === currentHand.preflopAggressor) {
                    t.foldToCbetFlopOpps++;
                    if (p.foldedOnFlop) t.foldToCbetFlopFolded++;
                }
                if (p.voluntaryPreflop && !p.raisedPreflop && p.sawFlop && currentHand.preflopAggressor && currentHand.preflopAggressor !== name) {
                    t.donkFlopOpps++;
                    if (currentHand.flopBettor === name) t.donkFlopMade++;
                }
                if (p.checkRaisedFlopThisHand) t.crFlopCount++;
                if (p.squeezed) t.squeezeCount++;

                if (p.sawFlop) t.sawFlopCount++;
                if (p.sawFlop && (p.wonShowdown || p.wonNoShowdown)) t.wonAfterSawFlopCount++;
                if (p.reachedShowdown) {
                    if (!p.sawFlop) t.sawFlopCount++;
                    t.wentToShowdownCount++;
                    if (p.wonShowdown) t.wonAtShowdownCount++;
                    if (p.showdownRank >= 0) {
                        if (p.showdownRank <= 1) t.showdownWeak++;
                        else t.showdownStrong++;
                    }
                }

                if (p.wonNoShowdown) t.wonNoShowdownCount++;
                if (p.voluntaryShowed) {
                    t.voluntaryShowCount++;
                    if (p.wonNoShowdown) t.voluntaryShowAfterWin++;
                }
                if (p.showdownRank >= 0 && (p.reachedShowdown || p.voluntaryShowed)) {
                    if (p.showdownRank <= 1) t.shownWeak = (t.shownWeak || 0) + 1;
                    else t.shownStrong = (t.shownStrong || 0) + 1;
                }

                t.recent.push({
                    vpip: p.voluntaryPreflop,
                    pfr: p.raisedPreflop,
                    aggressive: p.postBets + p.postRaises,
                    passive: p.postCalls + p.postChecks,
                    folds: p.postFolds,
                    sawFlop: p.sawFlop,
                    showdown: p.reachedShowdown,
                    won: p.wonShowdown || p.wonNoShowdown,
                });
                if (t.recent.length > TABLE_RECENT_CAP) t.recent.shift();
            }

            // Aggregate stack commitment percentages (lifetime + per-table)
            if (p.raisePcts && p.raisePcts.length > 0) {
                p.raisePcts.forEach(pct => { s.raisePctSum += pct; s.raisePctSamples++; });
                if (handBB && s.byTable?.[handBB]) {
                    const t = s.byTable[handBB];
                    p.raisePcts.forEach(pct => { t.raisePctSum += pct; t.raisePctSamples++; });
                }
            }
            if (p.callPcts && p.callPcts.length > 0) {
                p.callPcts.forEach(pct => { s.callPctSum += pct; s.callPctSamples++; });
                if (handBB && s.byTable?.[handBB]) {
                    const t = s.byTable[handBB];
                    p.callPcts.forEach(pct => { t.callPctSum += pct; t.callPctSamples++; });
                }
            }
            // Cloud sync: everything this hand changed on the profile, as a numeric delta
            if (_syncEnabled) {
                try {
                    const delta = _numericDiff(_syncBefore, _numericSnapshot(s));
                    const addedTags = s.autoTags.length > _syncTagCount
                        ? s.autoTags.slice(0, s.autoTags.length - _syncTagCount) : [];
                    if (Object.keys(delta).length || _syncHist || addedTags.length) {
                        _syncPlayers.push({
                            xid: numId ? String(numId) : null,
                            name,
                            delta,
                            history: _syncHist || undefined,
                            autoTags: addedTags.length ? addedTags : undefined,
                        });
                    }
                } catch (e) { console.warn('[TPHUD] sync delta failed:', e); }
            }

            // Key by Torn XID when known: XIDs survive renames and cannot collide the way
            // display names can. Fall back to the name only when the seat id was never seen.
            const statsKey = numId ? String(numId) : name;
            all[statsKey] = s;
            // Clean up a legacy name-keyed alias pointing at this same record
            if (numId && all[name] === s && String(numId) !== name) delete all[name];

            // Session P&L: update hero's running totals once per hand. winAmt is gross collected;
            // contribution is what hero put in. Net = winAmt - contribution. Counts HU and non-HU hands.
            if (name === localPlayerName) {
                try {
                    const heroContrib = currentHand.playerPotContrib?.[name] || 0;
                    const heroWonChips = p.winAmt || 0;
                    const netChips = heroWonChips - heroContrib;
                    const handBBSize = handBB || currentTableBB;
                    sessionStats.handsPlayed++;
                    if (p.voluntaryPreflop) sessionStats.handsVPIP++;
                    sessionStats.netChips += netChips;
                    if (handBBSize > 0) {
                        const netBB = netChips / handBBSize;
                        sessionStats.netBB += netBB;
                        if (netBB > sessionStats.biggestWinBB) sessionStats.biggestWinBB = netBB;
                        if (netBB < sessionStats.biggestLossBB) sessionStats.biggestLossBB = netBB;
                    }
                } catch (e) {
                    console.warn('[PokerHUD] session P&L update failed:', e);
                }
            }
        });

        if (_syncEnabled && _syncPlayers.length) {
            enqueueSyncHand({
                handId: currentHand.handId,
                ts: Date.now(),
                tableBB: handBB || null,
                tableName: currentTableName || null,
                hu: currentHand.isHU === true,
                players: _syncPlayers,
            });
        }

        markStatsDirty();
        Object.keys(currentHand.perPlayer).forEach(refreshBadgeByName);
        updatePositionIndicator(null);

        // Snapshot hand for hand history before clearing
        if (currentHand.seenPreflop) {
            const snapPlayers = {};
            Object.entries(currentHand.perPlayer).forEach(([name, p]) => {
                snapPlayers[name] = {
                    position: p.position,
                    showdownCards: p.showdownCards,
                    showdownHandName: p.showdownHandName,
                    wonShowdown: p.wonShowdown,
                    wonNoShowdown: p.wonNoShowdown,
                    winAmt: p.winAmt,
                    reachedShowdown: p.reachedShowdown,
                    voluntaryShowed: p.voluntaryShowed,
                };
            });
            recentHandHistories.unshift({
                handId: currentHand.handId,
                tableName: currentTableName,
                tableBB: currentHand.bbAmount || currentTableBB,
                ts: Date.now(),
                actionLog: currentHand.actionLog,
                flopCards: currentHand.flopCards,
                turnCards: currentHand.turnCards,
                riverCards: currentHand.riverCards,
                stackAtStart: { ...currentHand.stackAtStart },
                seatOrder: [...currentHand.seatOrder],
                seatNameMap: { ...currentHand.seatNameMap },
                sbPlayer: currentHand.sbPlayer,
                bbPlayer: currentHand.bbPlayer,
                selfHoleCards: currentHand.selfHoleCards,
                players: snapPlayers,
            });
            if (recentHandHistories.length > 10) recentHandHistories.length = 10;
            saveHandHistory();

            // Table session log — captures all-player round summary for the floating table log panel
            if (!currentHand.isHU) {
                // seatNameMap is { playerName -> seatId }, so build the reverse for seat-ordered iteration
                const seatIdToName = {};
                Object.entries(currentHand.seatNameMap || {}).forEach(([n, sid]) => { seatIdToName[String(sid)] = n; });
                const orderedNames = currentHand.seatOrder.map(sid => seatIdToName[String(sid)]).filter(Boolean);
                const extraNames = Object.keys(currentHand.perPlayer).filter(n => !orderedNames.includes(n));
                const allNames = [...orderedNames, ...extraNames];

                const tlPlayers = allNames.map(name => {
                    const p = currentHand.perPlayer[name];
                    if (!p) return null;
                    let preflopAction;
                    if (p.raisedPreflop) preflopAction = 'raised';
                    else if (p.voluntaryPreflop) preflopAction = 'called';
                    else if (p.foldedPreflop) preflopAction = 'folded preflop';
                    else preflopAction = 'BB/SB';
                    return {
                        name,
                        position: p.position || null,
                        preflopAction,
                        preflopRaiseAmt: p.preflopRaiseAmt || null,
                        preflopCallAmt: p.preflopCallAmt || null,
                        cards: p.showdownCards || null,
                        handName: p.showdownHandName || null,
                        wonShowdown: !!p.wonShowdown,
                        wonNoShowdown: !!p.wonNoShowdown,
                        reachedShowdown: !!p.reachedShowdown,
                        winAmt: p.winAmt || null,
                        voluntaryShowed: !!p.voluntaryShowed,
                        flop: p.flop ? { ...p.flop } : null,
                        turn: p.turn ? { ...p.turn } : null,
                        river: p.river ? { ...p.river } : null,
                        betAmts: [...(p.betAmts || [])],
                        callAmts: [...(p.callAmts || [])],
                        startStack: currentHand.stackAtStart?.[name] ?? null,
                    };
                })
                    .filter(Boolean);

                tableSessionLog.unshift({
                    handNum: tableSessionLog.length + 1,
                    ts: Date.now(),
                    boardCards: currentHand.boardCards?.length ? [...currentHand.boardCards] : [],
                    bbAmount: handBB || null,
                    players: tlPlayers,
                });
                if (tableSessionLog.length > 50) tableSessionLog.length = 50;
                refreshTableLogPanel();
            }
        }

        // Update session bluff tracker if self was running a bluff line this hand
        if (currentHand.selfBluffLine?.active && localPlayerName) {
            const selfPFinal = currentHand.perPlayer?.[localPlayerName];
            const selfWon = !!(selfPFinal?.wonShowdown || selfPFinal?.wonNoShowdown);
            updateSessionBluffOutcome(selfWon, currentHand.selfBluffLine.streets);
        }

        // Never let a failure in the post-hand checks wedge finalization: the hand must
        // always be cleared or the next message would re-finalize and double-count.
        try { checkSelfTilt(); } catch (e) { console.warn('[TPHUD] checkSelfTilt failed:', e); }
        try { checkWhipsaw(); } catch (e) { console.warn('[TPHUD] checkWhipsaw failed:', e); }

        lastHandFinalizeAt = Date.now();
        currentHand = null;
    }

    // ── Metrics engine ───────────────────────────────────────────
    // betaMean: Bayesian-smoothed rate for CLASSIFICATION (pulls toward 50% on small samples)
    // rawRate: True rate for DISPLAY (what the user actually sees)

    // Prior mean defaults to 0.5 (the original Jeffreys-style pull); when the
    // server has population priors from enough hands, the named metrics shrink
    // toward the real Torn population instead.
    function betaMean(k, n, priorMean = 0.5) {
        return (k + priorMean) / (n + 1);
    }

    function popPrior(metric) {
        const v = popPriors ? popPriors[metric] : null;
        return (typeof v === 'number' && isFinite(v)) ? v : 0.5;
    }

    function rawRate(k, n) {
        return n > 0 ? k / n : 0;
    }

    // 95% Wilson score interval half-width for a rate with sample size n. Displayed as
    // a ± band next to key stats so sample quality is visible at a glance.
    function wilsonHalfWidth(p, n) {
        if (!n || n <= 0 || p == null) return null;
        const z = 1.96;
        p = Math.max(0, Math.min(1, p));
        const denom = 1 + z * z / n;
        return (z / denom) * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n));
    }

    // Small dim "±N" HTML fragment, or '' when no sample size is available
    function ciHtml(p, n) {
        const hw = wilsonHalfWidth(p, n);
        return hw != null ? `<span class="tphud-ci">±${Math.round(hw * 100)}</span>` : '';
    }

    // Smoothed metrics — used ONLY for profiling/classification
    function computeMetrics(s) {
        const n = s.handsObserved;
        if (n === 0) return null;

        const vpip = betaMean(s.vpipCount, n, popPrior('vpip'));
        const pfr = betaMean(s.pfrCount, n, popPrior('pfr'));
        const gap = vpip - pfr;

        const postAgg = (s.postBets || 0) + (s.postRaises || 0) - (s.postAllinBets || 0) - (s.postAllinRaises || 0);
        const postTotal = Math.max(0, postAgg) + (s.postCalls || 0) + (s.postFolds || 0);
        const afq = betaMean(Math.max(0, postAgg), postTotal, popPrior('afq'));
        const afqReliable = postTotal >= 5;

        const wtsd = s.sawFlopCount > 0
            ? Math.min(1, s.wentToShowdownCount / s.sawFlopCount) : 0;

        const wsd = s.wentToShowdownCount > 0
            ? s.wonAtShowdownCount / s.wentToShowdownCount : 0;

        const limpPct = betaMean(s.limpCount || 0, n);
        const threeBetOpps = s.threeBetOpportunities || 0;
        const threeBetPct = threeBetOpps >= 3 ? betaMean(s.threeBetCount || 0, threeBetOpps) : null;
        const f3bOpps = s.foldTo3BetOpportunities || 0;
        const foldTo3BetPct = f3bOpps >= 3 ? betaMean(s.foldTo3BetCount || 0, f3bOpps) : null;
        const facedFlop = s.facedFlopBetCount || 0;
        const foldVsFlopBet = facedFlop >= 3 ? betaMean(s.foldedVsFlopBetCount || 0, facedFlop) : null;

        const postTotal2 = (s.postFolds || 0) + (s.postCalls || 0) + (s.postBets || 0) + (s.postRaises || 0) + (s.postChecks || 0);
        const postFoldPct = postTotal2 >= 5 ? betaMean(s.postFolds || 0, postTotal2) : null;

        return { vpip, pfr, gap, afq, afqReliable, wtsd, wsd, limpPct, threeBetPct, foldTo3BetPct, foldVsFlopBet, postFoldPct, n };
    }

    // Raw metrics — used for ALL display bars, tooltips, and user-facing percentages
    function getDisplayMetrics(s) {
        const n = s.handsObserved || 0;
        if (n === 0) return null;

        const postBets = s.postBets || 0;
        const postRaises = s.postRaises || 0;
        const postCalls = s.postCalls || 0;
        const postChecks = s.postChecks || 0;
        const postFolds = s.postFolds || 0;

        const postAgg = Math.max(0, postBets + postRaises - (s.postAllinBets || 0) - (s.postAllinRaises || 0));
        const postTotal = postAgg + postCalls + postFolds;

        return {
            vpip: rawRate(s.vpipCount || 0, n),
            pfr: rawRate(s.pfrCount || 0, n),
            gap: rawRate(s.vpipCount || 0, n) - rawRate(s.pfrCount || 0, n),
            afq: postTotal > 0 ? postAgg / postTotal : 0,
            afqReliable: postTotal >= 5,

            wtsd: (s.sawFlopCount || 0) > 0
                ? Math.min(1, (s.wentToShowdownCount || 0) / s.sawFlopCount) : 0,

            wsd: (s.wentToShowdownCount || 0) > 0
                ? (s.wonAtShowdownCount || 0) / s.wentToShowdownCount : 0,

            limpPct: rawRate(s.limpCount || 0, n),

            threeBetPct: (s.threeBetOpportunities || 0) > 0
                ? (s.threeBetCount || 0) / s.threeBetOpportunities : null,

            foldTo3BetPct: (s.foldTo3BetOpportunities || 0) > 0
                ? (s.foldTo3BetCount || 0) / s.foldTo3BetOpportunities : null,

            foldVsFlopBet: (s.facedFlopBetCount || 0) > 0
                ? (s.foldedVsFlopBetCount || 0) / s.facedFlopBetCount : null,

            cbetFlop: (s.cbetFlopOpps || 0) >= 3
                ? (s.cbetFlopMade || 0) / s.cbetFlopOpps : null,

            foldToCbet: (s.foldToCbetFlopOpps || 0) >= 3
                ? (s.foldToCbetFlopFolded || 0) / s.foldToCbetFlopOpps : null,

            donkFlop: (s.donkFlopOpps || 0) >= 5
                ? (s.donkFlopMade || 0) / s.donkFlopOpps : null,

            crFlop: (s.sawFlopCount || 0) >= 10
                ? Math.min(1, (s.crFlopCount || 0) / s.sawFlopCount) : null,

            squeezePct: (s.threeBetOpportunities || 0) >= 5
                ? (s.squeezeCount || 0) / s.threeBetOpportunities : null,

            wwsf: (s.sawFlopCount || 0) >= 5
                ? Math.min(1, (s.wonAfterSawFlopCount || 0) / s.sawFlopCount) : null,

            postFoldPct: (postBets + postRaises + postCalls + postChecks + postFolds) > 0
                ? postFolds / (postBets + postRaises + postCalls + postChecks + postFolds) : null,

            avgRaisePct: s.raisePctSamples > 0 ? s.raisePctSum / s.raisePctSamples : null,
            avgCallPct: s.callPctSamples > 0 ? s.callPctSum / s.callPctSamples : null,

            n,
        };
    }

    // ── Player type definitions ──────────────────────────────────

    const TYPES = {
        MANIAC: { label: 'Maniac', desc: 'Plays almost every hand and constantly bets/raises. Very unpredictable.', short: 'MAN', color: '#ff6b6b', bg: 'rgba(231,76,60,0.40)' },
        LAG: { label: 'Aggressive', desc: 'Plays many hands and bets/raises a lot. Puts pressure on everyone at the table.', short: 'AGG', color: '#ffaa55', bg: 'rgba(230,126,34,0.40)' },
        TAG: { label: 'Sharp', desc: 'Selective about which hands they play, but aggressive when they do. Dangerous.', short: 'SHP', color: '#55e87a', bg: 'rgba(46,204,113,0.40)' },
        FISH: { label: 'Fish', desc: 'Plays far too many hands and almost never raises. Classic weak player — easy to exploit.', short: 'FSH', color: '#ff9944', bg: 'rgba(255,153,68,0.40)' },
        CALLING_STATION: { label: 'Calls Everything', desc: 'Plays a lot of hands but rarely raises. Will call you down to the river.', short: 'CLR', color: '#5db8f5', bg: 'rgba(52,152,219,0.40)' },
        ROCK: { label: 'Rock', desc: 'Ultra-tight. Only plays absolute premiums — even tighter than a nit.', short: 'RCK', color: '#8899aa', bg: 'rgba(100,120,140,0.50)' },
        NIT: { label: 'Rarely Plays', desc: 'Folds almost everything. Only enters pots with very strong hands.', short: 'NIT', color: '#4de3c4', bg: 'rgba(26,188,156,0.40)' },
        TIGHT_PASSIVE: { label: 'Cautious', desc: 'Plays few hands and mostly checks/calls. Avoids confrontation.', short: 'CTN', color: '#e0e8ea', bg: 'rgba(100,130,140,0.55)' },
        LOOSE_PASSIVE: { label: 'Passive Gambler', desc: 'Plays many hands but rarely bets or raises. Drifts along and calls a lot.', short: 'PSV', color: '#d97ff0', bg: 'rgba(155,89,182,0.50)' },
        MIXED: { label: 'Unpredictable', desc: 'No clear pattern yet. Could be adapting, or genuinely hard to read.', short: 'MIX', color: '#f0d060', bg: 'rgba(180,140,20,0.45)' },
        UNKNOWN: { label: 'Unknown', desc: 'Not enough hands seen to form a read.', short: '?', color: '#cccccc', bg: 'rgba(60,60,60,0.80)' },
    };

    // ── Poker-terminology overrides (used when hudSettings.usePokerTerms is on) ──
    const POKER_TYPE_OVERRIDES = {
        LAG: { label: 'LAG', short: 'LAG' },
        TAG: { label: 'TAG', short: 'TAG' },
        CALLING_STATION: { label: 'Calling Station', short: 'CS' },
        NIT: { label: 'Nit', short: 'NIT' },
        TIGHT_PASSIVE: { label: 'Tight-Passive', short: 'TP' },
        LOOSE_PASSIVE: { label: 'Loose-Passive', short: 'LP' },
    };

    // Stat bar label map: friendly (default) vs poker terminology
    const STAT_LABELS = {
        vpip: { friendly: 'Plays hands', poker: 'VPIP' },
        pfr: { friendly: 'Raises preflop', poker: 'PFR' },
        limp: { friendly: 'Limps in', poker: 'Limp%' },
        threeBet: { friendly: '3-bets', poker: '3-Bet%' },
        foldTo3Bet: { friendly: 'Folds to 3-bet', poker: 'Fold to 3-Bet' },
        afq: { friendly: 'Bets/raises post', poker: 'AFq' },
        foldVsCbet: { friendly: 'Folds to flop bet', poker: 'Fold vs CBet' },
        postFold: { friendly: 'Folds post-flop', poker: 'Post-Fold%' },
        wtsd: { friendly: 'Stays till showdown', poker: 'WTSD' },
        wsd: { friendly: 'Wins showdowns', poker: 'W$SD' },
        avgRaise: { friendly: 'Avg raise size', poker: 'Avg Raise%' },
        avgCall: { friendly: 'Avg call size', poker: 'Avg Call%' },
    };

    // Returns the stat label string for the current terminology mode
    function statLbl(key) {
        return hudSettings.usePokerTerms ? STAT_LABELS[key].poker : STAT_LABELS[key].friendly;
    }

    // Returns a type object with label/short overridden for poker mode if applicable
    function resolvedType(type) {
        if (!hudSettings.usePokerTerms) return type;
        const key = Object.keys(TYPES).find(k => TYPES[k] === type);
        const override = key && POKER_TYPE_OVERRIDES[key];
        return override ? { ...type, label: override.label, short: override.short } : type;
    }

    // Target metric profiles for each type: { vpip, pfr, afq }
    // Calibrated for Torn City's casual playerbase — VPIP averages are higher than serious sites.
    // A 50% VPIP player is midfield here, not a maniac. Adjust thresholds accordingly.
    const PROFILES = {
        MANIAC: { vpip: 0.72, pfr: 0.55, afq: 0.62 },
        LAG: { vpip: 0.50, pfr: 0.32, afq: 0.50 },
        TAG: { vpip: 0.24, pfr: 0.20, afq: 0.44 },
        FISH: { vpip: 0.65, pfr: 0.06, afq: 0.10 },
        CALLING_STATION: { vpip: 0.55, pfr: 0.07, afq: 0.14 },
        ROCK: { vpip: 0.07, pfr: 0.04, afq: 0.25 },
        NIT: { vpip: 0.13, pfr: 0.06, afq: 0.26 },
        TIGHT_PASSIVE: { vpip: 0.20, pfr: 0.05, afq: 0.18 },
        LOOSE_PASSIVE: { vpip: 0.47, pfr: 0.10, afq: 0.19 },
    };

    function typeScore(m, profile) {
        const c = (val, tgt, spread) => Math.max(0, 1 - Math.abs(val - tgt) / spread);
        const vpipS = c(m.vpip, profile.vpip, 0.25);
        const pfrS = c(m.pfr, profile.pfr, 0.18);
        const afqS = m.afqReliable ? c(m.afq, profile.afq, 0.25) : 0.5;
        return (vpipS * 2 + pfrS * 2 + afqS) / 5;
    }

    function classifyMetrics(m, n) {
        if (!m || n < hudSettings.minHandsToClassify) {
            return { type: TYPES.UNKNOWN, confLabel: '', confOpacity: 0.6, metrics: m, margin: 0 };
        }

        const scores = {};
        Object.keys(PROFILES).forEach(key => { scores[key] = typeScore(m, PROFILES[key]); });
        const sorted = Object.entries(scores).sort(([, a], [, b]) => b - a);
        const [bestKey] = sorted[0];
        const margin = sorted[0][1] - sorted[1][1];

        const type = margin >= 0.05 ? TYPES[bestKey] : TYPES.MIXED;

        let confLabel, confOpacity;
        if (n < 10) confLabel = 'Low', confOpacity = 0.55;
        else if (n < 25) confLabel = 'Medium', confOpacity = 0.75;
        else if (n < 50) confLabel = 'High', confOpacity = 0.90;
        else confLabel = 'Very High', confOpacity = 1.00;

        if (margin < 0.14 && type !== TYPES.MIXED) {
            confOpacity = Math.max(confOpacity - 0.15, 0.40);
            if (confLabel === 'Very High') confLabel = 'High';
            else if (confLabel === 'High') confLabel = 'Medium';
        }

        return { type, confLabel, confOpacity, metrics: m, margin };
    }

    function classify(s) {
        return classifyMetrics(computeMetrics(s), s.handsObserved);
    }

    // ── Session metrics (rolling window classification) ──────────

    function computeSessionMetrics(s) {
        const win = s.recent.filter(h => !h.hu).slice(-hudSettings.sessionWindow);
        const n = win.length;
        if (n === 0) return null;

        const vpipCount = win.filter(h => h.vpip).length;
        const pfrCount = win.filter(h => h.pfr).length;
        const postAgg = win.reduce((a, h) => a + (h.aggressive || 0), 0);
        const postPass = win.reduce((a, h) => a + (h.passive || 0), 0);
        const postFolds = win.reduce((a, h) => a + (h.folds || 0), 0);
        const postTotal = postAgg + postPass + postFolds;

        const vpip = betaMean(vpipCount, n, popPrior('vpip'));
        const pfr = betaMean(pfrCount, n, popPrior('pfr'));
        const afq = betaMean(postAgg, postTotal, popPrior('afq'));

        return { vpip, pfr, gap: vpip - pfr, afq, afqReliable: postTotal >= 5, n };
    }

    function classifySession(s) {
        const m = computeSessionMetrics(s);
        if (!m) return null;
        return classifyMetrics(m, m.n);
    }

    // Hero-specific session classification: excludes trash preflop folds from VPIP denominator.
    // Trash folds (72o, 83o etc.) are correct plays and shouldn't push hero toward Nit/Rock.
    // Also normalizes VPIP for deep-stack hands — at >200 BB effective, playing up to 45% of hands
    // is theoretically sound (implied odds justify wider calling ranges). VPIP above that cap in
    // deep-stack spots is still penalized, but correct wide play won't inflate the Fish signal.
    function classifySelfSession(s) {
        const win = s.recent.filter(h => !h.hu).slice(-hudSettings.sessionWindow);
        if (!win.length) return null;

        const vpipHands = win.filter(h => h.foldTier !== 'trash');
        const n = vpipHands.length || win.length; // fall back if all were tagged trash (edge case)
        const pfrCount = win.filter(h => h.pfr).length;
        const postAgg = win.reduce((a, h) => a + (h.aggressive || 0), 0);
        const postPass = win.reduce((a, h) => a + (h.passive || 0), 0);
        const postFolds = win.reduce((a, h) => a + (h.folds || 0), 0);
        const postTotal = postAgg + postPass + postFolds;

        // Deep-stack VPIP adjustment: cap the effective VPIP contribution of hands played at
        // >200 BB effective at 45% — anything up to that is correct play, not fish play.
        const DEEP_BB_THRESHOLD = 200;
        const DEEP_VPIP_CAP = 0.45;
        const deepHands = vpipHands.filter(h => (h.effectiveStackBB ?? 0) > DEEP_BB_THRESHOLD);
        const normalHands = vpipHands.filter(h => (h.effectiveStackBB ?? 0) <= DEEP_BB_THRESHOLD);
        const deepVpipCount = deepHands.filter(h => h.vpip).length;
        const deepVpipRate = deepHands.length > 0 ? deepVpipCount / deepHands.length : 0;
        const deepAdjCount = Math.round(Math.min(deepVpipRate, DEEP_VPIP_CAP) * deepHands.length);
        const normalVpipCount = normalHands.filter(h => h.vpip).length;
        const vpipCount = normalVpipCount + deepAdjCount;

        const vpip = betaMean(vpipCount, n, popPrior('vpip'));
        const pfr = betaMean(pfrCount, win.length, popPrior('pfr'));
        const afq = betaMean(postAgg, postTotal);

        return classifyMetrics({ vpip, pfr, gap: vpip - pfr, afq, afqReliable: postTotal >= 5, n }, n);
    }

    // ── Live alerts ──────────────────────────────────────────────

    function getLiveAlerts(s) {
        const alerts = [];
        const recent = s.recent || [];

        const recentNonHU = recent.filter(h => !h.hu);
        if (s.handsObserved < 20 || recentNonHU.length < hudSettings.tiltWindow) return alerts;

        const win = recentNonHU.slice(-hudSettings.tiltWindow);
        const baseline = s.vpipCount / s.handsObserved;
        const recentV = win.filter(h => h.vpip).length / win.length;
        const shift = recentV - baseline;

        if (shift > hudSettings.tiltDeltaThreshold) alerts.push({ label: 'Playing much looser — possible tilt', color: '#e74c3c' });
        else if (shift < -hudSettings.tiltDeltaThreshold) alerts.push({ label: 'Playing much tighter — may be adjusting', color: '#3498db' });

        const basePostAgg = (s.postBets || 0) + (s.postRaises || 0);
        const basePostTotal = basePostAgg + (s.postCalls || 0) + (s.postFolds || 0);
        if (basePostTotal >= 10) {
            const baseAfq = basePostAgg / basePostTotal;
            const recentAgg = win.reduce((a, h) => a + (h.aggressive || 0), 0);
            const recentPass = win.reduce((a, h) => a + (h.passive || 0) + (h.folds || 0), 0);
            const recentAfq = recentAgg + recentPass > 0 ? recentAgg / (recentAgg + recentPass) : 0;
            if (recentAfq - baseAfq > 0.30)
                alerts.push({ label: 'Aggression spike — firing much more than usual', color: '#e67e22' });
        }

        const contested = win.filter(h => h.showdown || h.sawFlop);
        if (contested.length >= 5 && contested.slice(-5).every(h => !h.won))
            alerts.push({ label: 'Losing streak — last 5 contested pots lost', color: '#e74c3c' });

        return alerts;
    }

    // ── Active stats resolution ──────────────────────────────────

    function getActiveStats(s, bb) {
        const t = bb ? s.byTable?.[bb] : null;
        if (!t || t.handsObserved < 5) return s;
        return {
            ...blankTableStats(),
            ...t,
            history: (s.history || []).filter(e => e.bbAmount === bb),
            displayName: s.displayName,
        };
    }

    function computeMetricsForTable(s, bb) {
        const t = s.byTable?.[bb];
        if (!t || t.handsObserved < 1) return null;
        const n = t.handsObserved;

        const vpip = betaMean(t.vpipCount || 0, n, popPrior('vpip'));
        const pfr = betaMean(t.pfrCount || 0, n, popPrior('pfr'));
        const gap = vpip - pfr;

        const postBets = t.postBets || 0;
        const postRaises = t.postRaises || 0;
        const postCalls = t.postCalls || 0;
        const postChecks = t.postChecks || 0;
        const postFolds = t.postFolds || 0;

        const postAgg = postBets + postRaises;
        const postTotal = postAgg + postCalls + postFolds;
        const afq = betaMean(postAgg, postTotal, popPrior('afq'));
        const afqReliable = postTotal >= 5;

        const sawFlop = t.sawFlopCount || 0;
        const wentToSD = t.wentToShowdownCount || 0;
        const wonSD = t.wonAtShowdownCount || 0;
        const wtsd = sawFlop > 0 ? Math.min(1, wentToSD / sawFlop) : 0;
        const wsd = wentToSD > 0 ? wonSD / wentToSD : 0;
        const wwsf = sawFlop >= 5 ? Math.min(1, (t.wonAfterSawFlopCount || 0) / sawFlop) : null;

        const limpPct = betaMean(t.limpCount || 0, n);
        const threeBetOpps = t.threeBetOpportunities || 0;
        const threeBetPct = threeBetOpps >= 3 ? betaMean(t.threeBetCount || 0, threeBetOpps) : null;
        const f3bOpps = t.foldTo3BetOpportunities || 0;
        const foldTo3BetPct = f3bOpps >= 3 ? betaMean(t.foldTo3BetCount || 0, f3bOpps) : null;
        const facedFlop = t.facedFlopBetCount || 0;
        const foldVsFlopBet = facedFlop >= 3 ? betaMean(t.foldedVsFlopBetCount || 0, facedFlop) : null;
        const cbetOpps = t.cbetFlopOpps || 0;
        const cbetFlop = cbetOpps >= 3 ? betaMean(t.cbetFlopMade || 0, cbetOpps) : null;
        const fcbetOpps = t.foldToCbetFlopOpps || 0;
        const foldToCbet = fcbetOpps >= 3 ? betaMean(t.foldToCbetFlopFolded || 0, fcbetOpps) : null;
        const donkOpps = t.donkFlopOpps || 0;
        const donkFlop = donkOpps >= 5 ? betaMean(t.donkFlopMade || 0, donkOpps) : null;
        const crFlop = sawFlop >= 10 ? Math.min(1, (t.crFlopCount || 0) / sawFlop) : null;
        const squeezePct = threeBetOpps >= 5 ? (t.squeezeCount || 0) / threeBetOpps : null;

        const postTotal2 = postFolds + postCalls + postBets + postRaises + postChecks;
        const postFoldPct = postTotal2 >= 5 ? betaMean(postFolds, postTotal2) : null;

        return { vpip, pfr, gap, afq, afqReliable, wtsd, wsd, wwsf, limpPct, threeBetPct, foldTo3BetPct, squeezePct, foldVsFlopBet, cbetFlop, foldToCbet, donkFlop, crFlop, postFoldPct, n };
    }

    // ── Secondary tags ───────────────────────────────────────────

    function getSecondaryTags(s) {
        const tags = [];
        const m = computeMetrics(s);

        if (m?.foldVsFlopBet != null) {
            if (m.foldVsFlopBet >= 0.65)
                tags.push({ label: `Folds flop bets ${Math.round(m.foldVsFlopBet * 100)}% — c-bet freely`, color: '#27ae60' });
            else if (m.foldVsFlopBet <= 0.30)
                tags.push({ label: `Calls flop bets ${Math.round((1 - m.foldVsFlopBet) * 100)}% — don't bluff`, color: '#e74c3c' });
        }
        if (m?.limpPct != null && m.limpPct >= 0.25)
            tags.push({ label: `Limps ${Math.round(m.limpPct * 100)}% — raise to isolate`, color: '#f39c12' });

        if (m?.postFoldPct != null) {
            if (m.postFoldPct >= 0.55)
                tags.push({ label: `Folds post-flop ${Math.round(m.postFoldPct * 100)}% — bluff freely`, color: '#27ae60' });
            else if (m.postFoldPct <= 0.20)
                tags.push({ label: `Rarely folds post-flop — value bet only`, color: '#e74c3c' });
        }

        if (m?.threeBetPct != null) {
            if (m.threeBetPct <= 0.03)
                tags.push({ label: 'Rarely 3-bets — raise wide vs them', color: '#27ae60' });
            else if (m.threeBetPct >= 0.12)
                tags.push({ label: `3-bets ${Math.round(m.threeBetPct * 100)}% — be cautious raising`, color: '#e74c3c' });
        }

        if (s.wentToShowdownCount >= 3 && (s.totalVerdicts || 0) < 3) {
            const weakRate = s.showdownWeak / s.wentToShowdownCount;
            if (weakRate > 0.5)
                tags.push({ label: 'Shows Down Light', color: '#e74c3c' });
            else if (s.showdownStrong / s.wentToShowdownCount > 0.70 && s.wentToShowdownCount >= 5)
                tags.push({ label: 'Value-Heavy', color: '#2ecc71' });
        }

        if (s.voluntaryShowAfterWin >= 2)
            tags.push({ label: 'Likes Showing Hands', color: '#9b59b6' });

        if (s.recent.length >= 10) {
            const win = s.recent.slice(-10);
            const recentV = win.filter(h => h.vpip).length / win.length;
            const lifetimeV = s.vpipCount / s.handsObserved;
            if (recentV - lifetimeV > 0.20) tags.push({ label: 'Playing Looser Recently', color: '#f1c40f' });
            if (lifetimeV - recentV > 0.20) tags.push({ label: 'Playing Tighter Recently', color: '#f1c40f' });
        }

        // Commitment % tags (require minimum samples for reliability)
        const dm2 = getDisplayMetrics(s);
        if (dm2?.avgRaisePct != null && s.raisePctSamples >= 5) {
            if (dm2.avgRaisePct >= 8)
                tags.push({ label: `High-commit raises (avg ${dm2.avgRaisePct.toFixed(1)}% of stack)`, color: '#e74c3c' });
            else if (dm2.avgRaisePct <= 2)
                tags.push({ label: `Probe bettor — low-commit raises (avg ${dm2.avgRaisePct.toFixed(1)}% of stack)`, color: '#3498db' });
        }
        if (dm2?.avgCallPct != null && s.callPctSamples >= 5 && dm2.avgCallPct >= 10) {
            tags.push({ label: `Commits big on calls (avg ${dm2.avgCallPct.toFixed(1)}% of stack)`, color: '#e74c3c' });
        }

        // Positional insight tags — require enough hands per position to be meaningful
        const pos = s.positions;
        if (pos) {
            if (pos.EP.hands >= 10) {
                const epVpip = pos.EP.vpip / pos.EP.hands;
                if (epVpip > 0.30)
                    tags.push({ label: `Plays too many hands early (${Math.round(epVpip * 100)}% EP)`, color: '#e74c3c' });
            }
            if (pos.LP.hands >= 8) {
                const lpPfr = pos.LP.pfr / pos.LP.hands;
                if (lpPfr < 0.12)
                    tags.push({ label: `Doesn't steal from late position (${Math.round(lpPfr * 100)}% LP PFR)`, color: '#27ae60' });
            }
            if (pos.BB.hands >= 10) {
                const bbVpip = pos.BB.vpip / pos.BB.hands;
                const bbPfr = pos.BB.pfr / pos.BB.hands;
                if (bbVpip > 0.55 && bbPfr < 0.10)
                    tags.push({ label: `Over-defends BB (${Math.round(bbVpip * 100)}% VPIP, ${Math.round(bbPfr * 100)}% PFR)`, color: '#27ae60' });
            }
            // Position awareness — compare LP vs EP aggression to detect if they adjust by position
            if (pos.LP.hands >= 8 && pos.EP.hands >= 8) {
                const lpPfr = pos.LP.pfr / pos.LP.hands;
                const epPfr = pos.EP.pfr / pos.EP.hands;
                if (lpPfr >= epPfr * 2 && lpPfr >= 0.15)
                    tags.push({ label: `Position-aware — raises LP (${Math.round(lpPfr * 100)}%) much more than EP (${Math.round(epPfr * 100)}%) — their LP raises are steals`, color: '#e67e22' });
                else if (epPfr >= 0.10 && Math.abs(lpPfr - epPfr) <= 0.05)
                    tags.push({ label: `Ignores position — same PFR from LP (${Math.round(lpPfr * 100)}%) and EP (${Math.round(epPfr * 100)}%) — raises are always real`, color: '#9b59b6' });
            }
        }

        // Verdict-based tags — require minimum sample for reliability
        const type = classify(s).type;
        const typeKey = Object.keys(TYPES).find(k => TYPES[k] === type) || 'UNKNOWN';
        const tv = s.totalVerdicts || 0;

        if ((typeKey === 'FISH' || typeKey === 'CALLING_STATION') && s.handsObserved < 15)
            tags.push({ label: `Fish? Only ${s.handsObserved} hands — sample too small`, color: '#f39c12' });

        const sdTotal = (s.showdownStrong || 0) + (s.showdownWeak || 0);
        if ((typeKey === 'FISH' || typeKey === 'CALLING_STATION') && sdTotal >= 5) {
            const strongPct = s.showdownStrong / sdTotal;
            if (strongPct >= 0.60)
                tags.push({ label: 'Calls with strong hands — selective, not loose', color: '#16a085' });
        }

        if (tv >= 5) {
            const bluffRate = s.bluffCount / tv;
            const drawRate = s.drawCount / tv;
            const valueRate = s.valuePlayCount / tv;
            const thinRate = s.thinValueCount / tv;

            if (bluffRate >= 0.40)
                tags.push({ label: 'Frequent bluffer — weight their bets accordingly', color: '#e74c3c' });
            if (drawRate >= 0.35)
                tags.push({ label: 'Chases draws often — be wary of wet boards', color: '#3498db' });
            if (valueRate >= 0.60)
                tags.push({ label: 'Shows strong hands at showdown — respect their bets', color: '#27ae60' });
            if (thinRate >= 0.40)
                tags.push({ label: 'Often overplays marginal hands', color: '#e67e22' });

            // Confirmed loose caller — card-verified, not just label
            if ((s.looseCallCount || 0) >= 2 && (s.looseCallCount / tv) >= 0.25)
                tags.push({ label: 'Loose caller confirmed by cards', color: '#f39c12' });

            // Protection bettor — understands board texture
            if ((s.protectionCount || 0) >= 2 && ((s.protectionCount || 0) / tv) >= 0.25)
                tags.push({ label: 'Protection bettor — aware of texture', color: '#1abc9c' });
        }

        return tags;
    }

    // ── Profile explanation ──────────────────────────────────────

    function buildReasonHtml(s, activeClass) {
        const { type, confLabel, metrics, margin } = activeClass || classify(s);
        const n = s.handsObserved;
        const hist = s.history || [];
        const dm = getDisplayMetrics(s);

        if (!metrics || n < 5)
            return '<div class="tphud-dim" style="padding:10px 0">Need at least 5 hands before a reason can be given.</div>';

        const pct = v => `${Math.round(v * 100)}%`;
        const bullets = [];
        const vpipPct = Math.round(dm.vpip * 100);
        const callsOnly = (s.vpipCount || 0) - (s.pfrCount || 0);

        if (vpipPct >= 55)
            bullets.push(`Plays <b>${vpipPct}%</b> of hands — enters the pot almost constantly. That's ${s.vpipCount} times out of ${n} hands watched.`);
        else if (vpipPct >= 35)
            bullets.push(`Plays <b>${vpipPct}%</b> of hands — enters more pots than most players. ${s.vpipCount} times out of ${n} hands.`);
        else if (vpipPct >= 18)
            bullets.push(`Plays <b>${vpipPct}%</b> of hands — selective but not overly tight. ${s.vpipCount} entries in ${n} hands.`);
        else
            bullets.push(`Only plays <b>${vpipPct}%</b> of hands — very picky about which hands they enter. Just ${s.vpipCount} times in ${n} hands.`);

        const pfrPct = Math.round(dm.pfr * 100);
        if (s.pfrCount === 0)
            bullets.push(`Has not raised preflop once in ${n} hands — always calls or folds.`);
        else if (pfrPct >= 30)
            bullets.push(`Raises preflop <b>${pfrPct}%</b> of the time — ${s.pfrCount} raises out of ${n} hands. Almost always comes in with aggression.`);
        else if (pfrPct >= 15)
            bullets.push(`Raises preflop <b>${pfrPct}%</b> of the time — ${s.pfrCount} raises in ${n} hands.`);
        else
            bullets.push(`Rarely raises preflop — only <b>${pfrPct}%</b> of hands (${s.pfrCount} times in ${n}). Mostly calls when they do enter.`);

        const gapPct = Math.round(dm.gap * 100);
        if (callsOnly > 0 && gapPct >= 15)
            bullets.push(`Called without raising <b>${callsOnly} times</b> preflop — prefers to limp or flat-call rather than raise.`);
        else if (s.pfrCount > 0 && gapPct < 5)
            bullets.push(`Nearly always raises when entering a pot — rarely just calls preflop.`);

        if (dm.afqReliable) {
            const afqPct = Math.round(dm.afq * 100);
            const postAgg = (s.postBets || 0) + (s.postRaises || 0);
            const postPass = (s.postCalls || 0) + (s.postChecks || 0);
            if (afqPct >= 50)
                bullets.push(`After the flop, bets or raises <b>${afqPct}%</b> of the time — ${postAgg} aggressive actions vs ${postPass} passive ones. Very active.`);
            else if (afqPct >= 30)
                bullets.push(`Moderately active after the flop — bets or raises <b>${afqPct}%</b> of the time (${postAgg} aggressive, ${postPass} passive actions).`);
            else
                bullets.push(`Passive after the flop — mostly checks or calls. Only bets or raises <b>${afqPct}%</b> of the time (${postAgg} aggressive vs ${postPass} passive).`);
        } else {
            const postTotal = (s.postBets || 0) + (s.postRaises || 0) + (s.postCalls || 0) + (s.postChecks || 0) + (s.postFolds || 0);
            if (postTotal < 5)
                bullets.push(`Not enough postflop action recorded yet to judge (${postTotal} postflop actions seen).`);
        }

        if (s.wentToShowdownCount > 0 && s.sawFlopCount > 0) {
            const wtsdPct = Math.round(dm.wtsd * 100);
            const wsdPct = Math.round(dm.wsd * 100);
            if (wtsdPct >= 50)
                bullets.push(`Goes to showdown <b>${wtsdPct}%</b> of the time when they see the flop — hard to get off a hand. ${s.wentToShowdownCount} showdowns total.`);
            else
                bullets.push(`Folds before showdown most of the time — only goes to the end <b>${wtsdPct}%</b> of flops seen. ${s.wentToShowdownCount} showdowns total.`);

            if (s.wentToShowdownCount >= 3)
                bullets.push(`When at showdown, wins <b>${wsdPct}%</b> of the time (${s.wonAtShowdownCount} wins out of ${s.wentToShowdownCount}).`);
        }

        if (s.wentToShowdownCount >= 3) {
            const weakRate = Math.round((s.showdownWeak / s.wentToShowdownCount) * 100);
            if (s.showdownWeak >= 2 && weakRate > 50)
                bullets.push(`Shows up to showdown with weak hands often — <b>${s.showdownWeak} out of ${s.wentToShowdownCount}</b> showdowns were high card or a pair.`);
            else if (s.showdownStrong >= 3 && (s.showdownStrong / s.wentToShowdownCount) > 0.65)
                bullets.push(`Usually shows up with strong hands at showdown — <b>${s.showdownStrong} out of ${s.wentToShowdownCount}</b> were two pair or better.`);
        }

        if (s.wonNoShowdownCount > 0) {
            const ucTotal = s.ucTotalVerdicts || 0;
            bullets.push(`Won <b>${s.wonNoShowdownCount}</b> pot${s.wonNoShowdownCount > 1 ? 's' : ''} without showing cards.`);
            if (ucTotal >= 3) {
                const stealRate = (s.ucStealCount || 0) / ucTotal;
                const cbetRate = (s.ucCbetWinCount || 0) / ucTotal;
                const barrelRate = (s.ucBarrelWinCount || 0) / ucTotal;
                const passiveRate = (s.ucPassiveCount || 0) / ucTotal;
                if (stealRate > 0.40)
                    bullets.push(`Preflop steals make up <b>${Math.round(stealRate * 100)}%</b> of their uncontested wins — may be stealing wide.`);
                if (cbetRate + barrelRate > 0.50)
                    bullets.push(`C-bets or barrels <b>${Math.round((cbetRate + barrelRate) * 100)}%</b> of uncontested wins — applies post-flop pressure. Consider floating or check-raising.`);
                if (passiveRate > 0.30)
                    bullets.push(`Wins passively (without betting) <b>${Math.round(passiveRate * 100)}%</b> of the time — opponents give up against them often.`);
            }
        }

        const bigRaises = hist.filter(e => e.preflopRaiseAmt).slice(0, 3);
        if (bigRaises.length >= 2) {
            const amounts = bigRaises.map(e => `$${e.preflopRaiseAmt.toLocaleString()}`).join(', ');
            bullets.push(`Recent preflop raise amounts from history: <b>${amounts}</b>.`);
        }

        const sdHands = hist.filter(e => e.cards && e.handName).slice(0, 3);
        if (sdHands.length >= 2) {
            const examples = sdHands.map(e => cardsHtml(e.cards)).join('<span style="color:#444;margin:0 6px">·</span>');
            bullets.push(`Hands seen at showdown: ${examples}`);
        }

        const riverFolds = hist.filter(e => e.riverAction === 'folded river').length;
        const riverBets = hist.filter(e => e.riverAction && e.riverAction.startsWith('bet')).length;
        const riverCalls = hist.filter(e => e.riverAction && e.riverAction.startsWith('called')).length;
        const riverRaises = hist.filter(e => e.riverAction && e.riverAction.startsWith('raised')).length;
        if (riverFolds + riverBets + riverCalls + riverRaises >= 2) {
            const parts = [];
            if (riverBets + riverRaises > 0) parts.push(`bet/raised ${riverBets + riverRaises}×`);
            if (riverCalls > 0) parts.push(`called ${riverCalls}×`);
            if (riverFolds > 0) parts.push(`folded ${riverFolds}×`);
            bullets.push(`On the river (from history): ${parts.join(', ')}.`);
        }

        let confNote = `Label based on <b>${n} hands</b> — `;
        if (confLabel === 'Low') confNote += 'early read, pattern may still shift.';
        else if (confLabel === 'Medium') confNote += 'pattern is emerging but could change.';
        else if (confLabel === 'High') confNote += 'fairly reliable at this point.';
        else if (confLabel === 'Very High') confNote += 'very solid read.';
        if (margin < 0.14) confNote += ' <i>(Close match with another style — could be adapting.)</i>';
        bullets.push(confNote);

        const bluffSignals = [];
        if (s.wonNoShowdownCount >= 2)
            bluffSignals.push(`Won <b>${s.wonNoShowdownCount}</b> pot${s.wonNoShowdownCount > 1 ? 's' : ''} without showing cards — took it down before showdown every time.`);

        if (s.voluntaryShowAfterWin >= 1)
            bluffSignals.push(`Voluntarily showed cards after winning uncontested <b>${s.voluntaryShowAfterWin}</b> time${s.voluntaryShowAfterWin > 1 ? 's' : ''} — may have been bluffing or just showing off.`);

        if (s.showdownWeak >= 2 && s.wentToShowdownCount >= 3) {
            const weakRate = Math.round((s.showdownWeak / s.wentToShowdownCount) * 100);
            bluffSignals.push(`<b>${s.showdownWeak} of ${s.wentToShowdownCount}</b> showdowns had only a pair or high card (${weakRate}%) — often calls all the way down with weak hands.`);
        }

        const riverAggCount = hist.filter(e => e.riverAction && (e.riverAction.startsWith('bet') || e.riverAction.startsWith('raised'))).length;
        if (riverAggCount >= 2)
            bluffSignals.push(`Bet or raised on the river <b>${riverAggCount}</b> times in recorded history.`);

        if (dm.afqReliable && dm.afq > 0.45 && dm.wtsd < 0.25 && s.sawFlopCount >= 3)
            bluffSignals.push(`High aggression after the flop (${pct(dm.afq)}) but rarely goes to showdown (${pct(dm.wtsd)}) — may be bluffing opponents off hands frequently.`);

        const tv = s.totalVerdicts || 0;
        if (tv >= 5) {
            const bluffRate = s.bluffCount / tv;
            const valueRate = s.valuePlayCount / tv;
            const drawRate = s.drawCount / tv;
            const looseRate = (s.looseCallCount || 0) / tv;

            if (bluffRate > 0.40)
                bluffSignals.push(`Card analysis: bluffs <b>${Math.round(bluffRate * 100)}%</b> of showdown hands (${s.bluffCount}/${tv} verdicts) — call their river bets lighter.`);
            if (valueRate > 0.60)
                bluffSignals.push(`Card analysis: shows real hands <b>${Math.round(valueRate * 100)}%</b> of the time — fold to their river bets unless you have top pair+.`);
            if (drawRate > 0.35)
                bluffSignals.push(`Card analysis: chases draws <b>${Math.round(drawRate * 100)}%</b> of showdowns — charge them on wet boards.`);
            if (looseRate > 0.30)
                bluffSignals.push(`Card analysis: calls too wide <b>${Math.round(looseRate * 100)}%</b> of showdowns — bet thin for value, they call too much.`);
        }

        // Turn/river facing stats coaching
        const facedTurn = s.facedTurnBetCount || 0;
        const facedRiver = s.facedRiverBetCount || 0;
        const foldVsTurn = s.foldedVsTurnBetCount || 0;
        const foldVsRiver = s.foldedVsRiverBetCount || 0;

        if (facedTurn >= 5) {
            const foldRate = foldVsTurn / facedTurn;
            if (foldRate > 0.65)
                bluffSignals.push(`Folds to turn bets <b>${Math.round(foldRate * 100)}%</b> of the time — exploitable, consider floating more on the turn.`);
        }
        if (facedRiver >= 5) {
            const foldRate = foldVsRiver / facedRiver;
            if (foldRate > 0.70)
                bluffSignals.push(`Folds to river bets <b>${Math.round(foldRate * 100)}%</b> of the time — over-folding, can be bluffed off strong-ish hands.`);
        }

        const ucTotal = s.ucTotalVerdicts || 0;
        if (ucTotal >= 3) {
            if ((s.ucBarrelWinCount || 0) >= 2)
                bluffSignals.push(`Barreled multiple streets <b>${s.ucBarrelWinCount}</b> times and took it uncontested — applies sustained pressure. Could be value or bluff.`);
            if ((s.ucOverbetCount || 0) >= 1)
                bluffSignals.push(`Used overbet pressure <b>${s.ucOverbetCount}</b> time${s.ucOverbetCount > 1 ? 's' : ''} to win uncontested — polarised sizing, likely very strong or a bluff.`);
            if ((s.ucStealCount || 0) >= 3 && (s.ucStealCount / ucTotal) > 0.50)
                bluffSignals.push(`Steals preflop <b>${s.ucStealCount}/${ucTotal}</b> uncontested wins — high steal frequency, consider defending wider.`);
        }

        if (bluffSignals.length === 0)
            bluffSignals.push('No strong bluff signals detected yet. Need more showdown and river history.');

        return `
            <div class="tphud-sec">Why ${resolvedType(type).label}?</div>
            <ul class="tphud-reasons">
                ${bullets.map(b => `<li>${b}</li>`).join('')}
            </ul>
            <div class="tphud-sec" style="margin-top:14px">Bluff Signals</div>
            <ul class="tphud-reasons">
                ${bluffSignals.map(b => `<li>${b}</li>`).join('')}
            </ul>`;
    }

    // ── Stack reading module ─────────────────────────────────────

    // Reads current stack for a seat element. Returns null if element absent,
    // 0 if player is all-in.
    // isSelf: on desktop the self seat uses pot___ for stack display instead of potString___
    function readPlayerStack(seatEl, isSelf) {
        // Mobile: stack lives in a <p> inside detailsItem___ that starts with "$"
        function mobileStackEl() {
            const items = seatEl.querySelectorAll('[class^="detailsItem___"]');
            for (const item of items) {
                const p = item.querySelector('p');
                if (p && /^\$/.test(p.textContent.trim())) return p;
            }
            return null;
        }

        const stackEl = seatEl.querySelector('[class^="potString___"]')
            || seatEl.querySelector('[class^="money___"]')
            || (isSelf ? seatEl.querySelector('[class^="pot___"]') : null)
            || mobileStackEl();
        if (!stackEl) return null;
        const raw = [...stackEl.childNodes]
            .filter(n => n.nodeType === Node.TEXT_NODE)
            .map(n => n.textContent.trim())
            .filter(Boolean)
            .join('') || stackEl.textContent.trim() || null;
        if (!raw) return null;
        if (/all.?in/i.test(raw)) return 0;
        // BB mode: "181.00 BB" → convert to cash using known table big blind
        if (/BB/i.test(raw)) {
            isBBDisplayMode = true;
            if (!currentTableBB) return null;  // can't convert BB→cash without BB size; stale raw BB stored as dollars causes insane pct calculations
            const bbVal = parseFloat(raw);
            return isNaN(bbVal) ? null : Math.round(bbVal * currentTableBB);
        }
        isBBDisplayMode = false;
        const parsed = parseFloat(raw.replace(/[$,]/g, ''));
        return isNaN(parsed) ? null : parsed;
    }

    // Stack depth relative to big blind.
    function getStackDepth(stack, bb) {
        if (!stack || !bb || bb === 0) return null;
        const bbs = stack / bb;
        if (bbs < 10) return 'shove';
        if (bbs < 20) return 'short';
        if (bbs < 40) return 'mid';
        if (bbs < 100) return 'normal';
        return 'deep';
    }

    // Live stack state, keyed by Torn ID and by player name.
    // Updated every cycle in attachBadgesToSeats.
    const liveStacks = {};   // tornId  -> { stack, allIn, rebuys, lastSeen }
    const stackByName = {};   // name    -> stack (for log lookups in processMessage)
    // Survives handleHardTableSwitch clearing liveStacks — used to recover startStack in justStarted path
    const _sessionOrigin = {}; // tornId  -> { startStack, firstSeen }

    let isHeadsUp = false;   // true when exactly 2 named players are at the table

    // ── Badges ───────────────────────────────────────────────────

    const badges = {};
    const sideStatsEls = {}; // badgeKey → body-level fixed-position stats element
    let selfPostflopPos = null; // { pos, total, tooltip } when a street is active, null otherwise
    let selfPosEl = null;      // body-level pos indicator element (the blue circle)
    // nameToSeatId: DOM seat name → numeric seat ID (DOM-derived, used in badge rendering)
    // chatNameToSeatId: chat log name → numeric seat ID (set alongside nameToSeatId, used in stats finalization)
    // Both are set together in attachBadgesToSeats(). Kept separate because lookup paths differ.
    const nameToSeatId = {};
    const chatNameToSeatId = {};

    // In-session cache: numericId (string) → net worth value (number or null if fetch failed)
    // Not persisted — net worth changes frequently enough that stale data misleads
    const networthCache = {};
    const networthAttempts = {};  // retry counter; permanent give-up after 3 failures

    // In-session cache: numericId (string) → { id, name } | null
    const factionCache = {};
    const factionAttempts = {};

    // Suspicion pairs: "xidA|xidB" (names as fallback) → { players: [A, B], events: [] }
    // Persisted across sessions and table switches so repeat offenders accumulate
    // evidence. Events are timestamped and decay after SUSPICION_MAX_AGE_MS; each pair
    // keeps at most SUSPICION_EVENTS_CAP events.
    const suspicionPairs = new Map();

    // TornPDA does a raw text replacement of '###PDA-APIKEY###' in the script source before execution.
    // Detect substitution by comparing against a split sentinel (so this line itself isn't replaced).
    const _PDA_SENTINEL = ['###PDA', 'APIKEY###'].join('-');
    const PDA_INJECTED_KEY = '###PDA-APIKEY###';
    const HAS_PDA_KEY = PDA_INJECTED_KEY !== _PDA_SENTINEL;

    // Detect TornPDA: key was substituted OR Flutter webview bridge is present
    function isPDA() { return HAS_PDA_KEY || typeof window.flutter_inappwebview !== 'undefined'; }

    // HTTP wrapper: GM_xmlhttpRequest when available (bypasses CSP/CORS, handles TornPDA too).
    // String-response guard covers TornPDA's unreliable responseType:'json'.
    // Falls back to native fetch only when GM_xmlhttpRequest is absent.
    function tornApiFetch(url, onSuccess, onError) {
        if (typeof GM_xmlhttpRequest === 'function') {
            GM_xmlhttpRequest({
                method: 'GET',
                url,
                responseType: 'json',
                onload(resp) {
                    // Guard against builds that ignore responseType and return a string
                    const data = typeof resp?.response === 'string'
                        ? (() => { try { return JSON.parse(resp.response); } catch (e) { return null; } })()
                        : resp?.response;
                    if (!data || data.error) { onError(); return; }
                    onSuccess(data);
                },
                onerror() { onError(); },
            });
        } else {
            fetch(url)
                .then(r => r.ok ? r.json() : Promise.reject(r.status))
                .then(data => {
                    if (!data || data.error) { onError(); return; }
                    onSuccess(data);
                })
                .catch(() => onError());
        }
    }

    function fetchNetWorth(numericId, onResult) {
        if (!numericId) return;
        const apiKey = hudSettings.tornApiKey || (HAS_PDA_KEY ? PDA_INJECTED_KEY : '');
        if (!apiKey) return;
        if (numericId in networthCache) { onResult(networthCache[numericId]); return; }
        const attempts = networthAttempts[numericId] || 0;
        if (attempts >= 3) { onResult(null); return; }
        networthAttempts[numericId] = attempts + 1;
        tornApiFetch(
            `https://api.torn.com/v2/user/${numericId}/personalstats?cat=networth&key=${apiKey}`,
            data => {
                const total = data?.personalstats?.networth?.total ?? null;
                networthCache[numericId] = total;
                onResult(total);
            },
            () => {
                if ((networthAttempts[numericId] || 0) >= 3) networthCache[numericId] = null;
                onResult(null);
            }
        );
    }

    function fetchFaction(numericId, onResult) {
        if (!numericId) return;
        const apiKey = hudSettings.tornApiKey || (HAS_PDA_KEY ? PDA_INJECTED_KEY : '');
        if (!apiKey) return;
        if (numericId in factionCache) { onResult(factionCache[numericId]); return; }
        const attempts = factionAttempts[numericId] || 0;
        if (attempts >= 3) { onResult(null); return; }
        factionAttempts[numericId] = attempts + 1;
        tornApiFetch(
            `https://api.torn.com/v2/user/${numericId}/faction?key=${apiKey}`,
            data => {
                const f = data?.faction;
                const result = (f && f.id) ? { id: f.id, name: f.name } : null;
                factionCache[numericId] = result;
                onResult(result);
            },
            () => {
                if ((factionAttempts[numericId] || 0) >= 3) factionCache[numericId] = null;
                onResult(null);
            }
        );
    }

    function refreshBadgeByName(name) {
        const numId = chatNameToSeatId[name] || nameToSeatId[name];
        const badge = (numId && badges[numId]) || badges[name];
        if (!badge) return;
        const all = getStats();
        const s = resolveStatsByName(name, all);
        if (s) renderBadge(badge, s);
        const seat = badge.closest('[id^="player-"]');
        if (seat) syncEmojiIndicators(seat, name);

        // Keep open panel in sync — re-render if this player is currently shown
        refreshPanelIfOpen(name, numId);
    }

    // Refreshes every badge regardless of whether the key is a numericId or a name.
    function refreshAllBadges() {
        const all = getStats();
        Object.entries(badges).forEach(([key, badge]) => {
            if (!badge) return;
            // Try key directly, then resolve via chatNameToSeatId if key is a name
            let s = all[key];
            if (!s) {
                const numId = /^\d+$/.test(key) ? key : chatNameToSeatId[key];
                if (numId) s = all[numId];
            }
            if (s) {
                renderBadge(badge, s);
                const seat = badge.closest('[id^="player-"]');
                const name = seat?.dataset.hudBoundName;
                if (seat && name) syncEmojiIndicators(seat, name);
            }
        });
    }

    function showTip(html, anchorRect) {
        const tip = document.getElementById('tphud-hover');
        if (!tip) return;
        tip.innerHTML = html;
        tip.classList.remove('tphud-hidden');
        const s = hudSettings.hudScaleHoverTip || 1;
        const tipW = (tip.offsetWidth || 230) * s;
        const tipH = (tip.offsetHeight || 60) * s;
        // Prefer right of anchor; flip left if it would overflow
        const left = anchorRect.right + 8 + tipW <= window.innerWidth
            ? anchorRect.right + 8
            : anchorRect.left - tipW - 8;
        const top = Math.min(anchorRect.top, window.innerHeight - tipH - 8);
        tip.style.left = Math.max(4, left) + 'px';
        tip.style.top = Math.max(4, top + window.scrollY) + 'px';
    }

    function hideTip() {
        document.getElementById('tphud-hover')?.classList.add('tphud-hidden');
    }

    function attachSimpleTip(el, html) {
        el.title = '';
        el.addEventListener('mouseenter', e => {
            e.stopPropagation();
            showTip(`<div class="tphud-tip-row">${html}</div>`, el.getBoundingClientRect());
        });
        el.addEventListener('mouseleave', hideTip);
    }

    function buildBadgeTip(s, alertSource, dm, secondary, alerts, ls) {
        const pct = v => `${Math.round(v * 100)}%`;
        const lifetime = classify(s);
        const session = s.displayName === localPlayerName ? classifySelfSession(s) : classifySession(s);
        const displayed = (session && session.type !== TYPES.UNKNOWN) ? session : lifetime;

        const rows = [];

        // Header: type + confidence
        rows.push(`<div class="tphud-tip-type" style="color:${displayed.type.color}">${resolvedType(displayed.type).label}<span class="tphud-tip-sub">${session ? 'Session' : 'Lifetime'} · ${s.handsObserved} hands</span></div>`);
        if (lifetime.type !== TYPES.UNKNOWN && lifetime.type !== displayed.type)
            rows.push(`<div class="tphud-tip-lifetime">Lifetime: ${resolvedType(lifetime.type).label}</div>`);
        if (isHeadsUp)
            rows.push(`<div class="tphud-tip-alert" style="color:#f39c12">⚠ Heads-up — VPIP/PFR norms don't apply</div>`);

        // Core stats, each with a 95% Wilson ± band so sample quality is visible
        if (dm) {
            const nHands = alertSource.handsObserved || 0;
            const postTotal = (alertSource.postBets || 0) + (alertSource.postRaises || 0) +
                (alertSource.postCalls || 0) + (alertSource.postFolds || 0);
            rows.push('<div class="tphud-tip-divider"></div>');
            rows.push(`<div class="tphud-tip-row"><b>VPIP</b> ${pct(dm.vpip)}${ciHtml(dm.vpip, nHands)} &nbsp; <b>PFR</b> ${pct(dm.pfr)}${ciHtml(dm.pfr, nHands)} &nbsp; <b>AFq</b> ${pct(dm.afq)}${ciHtml(dm.afq, postTotal)}</div>`);
            if (alertSource.sawFlopCount > 0)
                rows.push(`<div class="tphud-tip-row"><b>WTSD</b> ${pct(dm.wtsd)}${ciHtml(dm.wtsd, alertSource.sawFlopCount)}</div>`);
            if (dm.avgRaisePct != null || dm.avgCallPct != null) {
                const parts = [];
                if (dm.avgRaisePct != null) parts.push(`Avg raise ${dm.avgRaisePct.toFixed(1)}%`);
                if (dm.avgCallPct != null) parts.push(`Avg call ${dm.avgCallPct.toFixed(1)}%`);
                rows.push(`<div class="tphud-tip-row tphud-tip-dim">${parts.join(' · ')}</div>`);
            }
        }

        // Stack
        if (ls?.stack != null) {
            rows.push('<div class="tphud-tip-divider"></div>');
            const heroStack = localPlayerName ? (stackByName[localPlayerName] ?? null) : null;
            const eff = heroStack ? Math.min(ls.stack, heroStack) : null;
            if (ls.allIn) {
                rows.push(`<div class="tphud-tip-alert" style="color:#e74c3c">⚠ All-in</div>`);
            } else {
                rows.push(`<div class="tphud-tip-row">Stack <b>${fmtStack(ls.stack)}</b>${eff ? `  Eff <b>${fmtStack(eff)}</b>` : ''}</div>`);
            }
        }

        // Alerts
        if (alerts.length > 0) {
            rows.push('<div class="tphud-tip-divider"></div>');
            alerts.forEach(a => rows.push(`<div class="tphud-tip-alert" style="color:${a.color}">⚠ ${a.label}</div>`));
        }

        // Card profile summary
        const tv = alertSource.totalVerdicts || 0;
        if (tv >= 3) {
            rows.push('<div class="tphud-tip-divider"></div>');
            rows.push(`<div class="tphud-tip-dim">Card profile (${tv} verdicts)</div>`);
            const bluffPct = Math.round((alertSource.bluffCount || 0) / tv * 100);
            const protectPct = Math.round((alertSource.protectionCount || 0) / tv * 100);
            const valueLossPct = Math.round(Math.max(0, (alertSource.valuePlayCount || 0) - (alertSource.protectionCount || 0)) / tv * 100);
            const drawPct = Math.round((alertSource.drawCount || 0) / tv * 100);
            const thinPct = Math.round((alertSource.thinValueCount || 0) / tv * 100);
            const strongPct = Math.round((alertSource.strongValueCount || 0) / tv * 100);
            const thinWinPct = Math.round((alertSource.thinWinCount || 0) / tv * 100);
            const trapPct = Math.round((alertSource.trapCount || 0) / tv * 100);
            rows.push(`<div class="tphud-tip-row">Bluff <b>${bluffPct}%</b> · Protect <b>${protectPct}%</b> · Loss <b>${valueLossPct}%</b> · Draw <b>${drawPct}%</b> · Thin <b>${thinPct}%</b></div>`);
            rows.push(`<div class="tphud-tip-row tphud-tip-dim">Wins: Strong <b>${strongPct}%</b> · Thin <b>${thinWinPct}%</b> · Trap <b>${trapPct}%</b></div>`);
        }

        // Secondary tags
        if (secondary.length > 0) {
            rows.push('<div class="tphud-tip-divider"></div>');
            secondary.forEach(t => rows.push(`<div class="tphud-tip-tag" style="color:${t.color}">▸ ${t.label}</div>`));
        }

        return rows.join('');
    }

    // Positions a body-level stats element next to the badge using its bounding rect
    function positionSideStats(badge, el) {
        const rect = badge.getBoundingClientRect();
        if (!rect.width) return;
        if (badge.classList.contains('tphud-badge-self')) {
            // Anchor to the stable seat frame, not the badge — text inside shifts, the frame doesn't
            const seat = badge.closest('[id^="player-"]');
            const frameEl = seat?.querySelector('[class^="panelPositioner___"]') || seat;
            const frameRect = frameEl ? frameEl.getBoundingClientRect() : rect;
            el.style.top = (frameRect.top + window.scrollY + frameRect.height / 2) + 'px';
            el.style.left = (frameRect.left + window.scrollX - el.offsetWidth - 6) + 'px';
        } else {
            el.style.top = (rect.top + window.scrollY + rect.height / 2) + 'px';
            el.style.left = (rect.left + window.scrollX - el.offsetWidth - 13) + 'px';
        }
    }

    // Creates/updates/removes the body-level fixed stats element for a badge
    function syncSideStats(badge) {
        const key = badge._badgeKey;
        const data = badge._sideStatsData;
        if (!key) return;

        let el = sideStatsEls[key];
        if (!data) {
            if (el) { el.remove(); delete sideStatsEls[key]; }
            return;
        }

        if (!el) {
            el = document.createElement('div');
            el.className = 'tphud-badge-side-stats';
            document.body.appendChild(el);
            sideStatsEls[key] = el;
        }

        el.innerHTML = '';
        data.rows.forEach(r => {
            const row = document.createElement('div');
            row.textContent = r.label + r.val;
            row.style.color = r.notable ? data.color : '#fff';
            row.style.textShadow = r.notable
                ? '0 0 4px rgba(255,255,255,0.55), 0 1px 3px rgba(0,0,0,1)'
                : '0 1px 3px rgba(0,0,0,1)';
            el.appendChild(row);
        });

        positionSideStats(badge, el);
    }

    // Positions the self pos indicator below the side stats column (or at the seat left if no column)
    function positionSelfPosEl() {
        if (!selfPosEl) return;
        const selfBadge = Object.values(badges).find(b => b.classList.contains('tphud-badge-self'));
        if (!selfBadge) return;

        const seat = selfBadge.closest('[id^="player-"]');
        const frameEl = seat?.querySelector('[class^="panelPositioner___"]') || seat;
        if (!frameEl) return;
        const frameRect = frameEl.getBoundingClientRect();
        if (!frameRect.width) return;

        const elW = selfPosEl.offsetWidth || 17;
        const elH = selfPosEl.offsetHeight || 17;
        const left = frameRect.left + window.scrollX - elW - 6;

        const selfKey = selfBadge._badgeKey;
        const sideStatsEl = selfKey ? sideStatsEls[selfKey] : null;

        if (sideStatsEl) {
            // Below the side stats element with a small gap
            const statsRect = sideStatsEl.getBoundingClientRect();
            selfPosEl.style.top = (statsRect.bottom + window.scrollY + 4) + 'px';
        } else {
            // No side stats — center on the seat frame
            selfPosEl.style.top = (frameRect.top + window.scrollY + frameRect.height / 2 - elH / 2) + 'px';
        }
        selfPosEl.style.left = left + 'px';
    }

    function renderBadge(badge, s) {
        const lifetime = classify(s);
        const isSelfBadge = s.displayName === localPlayerName;
        const session = isSelfBadge ? classifySelfSession(s) : classifySession(s);

        // HU override — show neutral HU indicator, skip all classification logic
        if (isHeadsUp) {
            badge.innerHTML = '';
            badge.style.borderColor = '#666';
            badge.style.background = 'rgba(40,40,40,0.6)';
            badge.style.opacity = '0.85';
            const lbl = document.createElement('span');
            lbl.textContent = 'HU';
            lbl.style.color = '#aaa';
            badge.appendChild(lbl);
            attachSimpleTip(badge, 'Heads-up — stats paused, reads don\'t apply');
            return;
        }

        // Badge primary depends on user setting; each mode falls back to the other
        const displayed = hudSettings.badgeMode === 'lifetime'
            ? (lifetime.type !== TYPES.UNKNOWN ? lifetime : (session && session.type !== TYPES.UNKNOWN ? session : lifetime))
            : (session && session.type !== TYPES.UNKNOWN ? session : lifetime);
        const { type, confOpacity } = displayed;

        badge.innerHTML = '';
        badge.style.borderColor = type.color;
        badge.style.background = type.bg;
        badge.style.opacity = String(confOpacity);

        // Stack-loss indicator left of type label
        const seatIdForDrop = nameToSeatId[s.displayName];
        const lsForDrop = seatIdForDrop ? liveStacks[seatIdForDrop] : null;
        if (lsForDrop?.peakStack && lsForDrop.stack != null && lsForDrop.peakStack > 0) {
            const lostPct = (lsForDrop.peakStack - lsForDrop.stack) / lsForDrop.peakStack * 100;
            if (lostPct >= 35) {
                const drop = document.createElement('span');
                drop.textContent = lostPct >= 50 ? '▼' : '▽';
                const stackNote = lsForDrop.stack > 0 ? ` · ${fmtStack(lsForDrop.stack)} left` : '';
                drop.style.cssText = `font-size:9px;color:${lostPct >= 50 ? '#e74c3c' : '#e67e22'};font-weight:bold;margin-right:3px;vertical-align:middle;`;
                attachSimpleTip(drop, `Down ${Math.round(lostPct)}% from peak${stackNote}`);
                badge.appendChild(drop);
            }
        }

        const lbl = document.createElement('span');
        lbl.textContent = resolvedType(type).short;
        lbl.style.color = type.color;
        badge.appendChild(lbl);

        // Dot when the secondary source differs from what the badge shows
        if (hudSettings.badgeMode === 'lifetime') {
            if (session && session.type !== TYPES.UNKNOWN && session.type !== type) {
                const dot = document.createElement('span');
                dot.textContent = '●';
                dot.style.cssText = 'font-size:5px; color:#f1c40f; margin-left:2px; vertical-align:super;';
                attachSimpleTip(dot, `Session: ${resolvedType(session.type).label}`);
                badge.appendChild(dot);
            }
        } else {
            if (lifetime.type !== TYPES.UNKNOWN && lifetime.type !== type) {
                const dot = document.createElement('span');
                dot.textContent = '●';
                dot.style.cssText = 'font-size:5px; color:#f1c40f; margin-left:2px; vertical-align:super;';
                attachSimpleTip(dot, `Lifetime: ${resolvedType(lifetime.type).label}`);
                badge.appendChild(dot);
            }
        }

        const alertSource = getActiveStats(s, currentTableBB);
        const seatIdForBadge = nameToSeatId[s.displayName];
        const lsForBadge = seatIdForBadge ? liveStacks[seatIdForBadge] : null;
        const alerts = getLiveAlerts(alertSource);
        if (hudSettings.showAlertOnBadge && alerts.length > 0) {
            const bang = document.createElement('span');
            bang.textContent = '!';
            bang.style.cssText = `font-size:9px; color:${alerts[0].color}; font-weight:bold; margin-left:2px; vertical-align:middle;`;
            attachSimpleTip(bang, alerts.map(a => `<span style="color:${a.color}">⚠ ${a.label}</span>`).join('<br>'));
            badge.appendChild(bang);
        }
        // Verdict emojis live in the seat bottom row (syncEmojiIndicators) to avoid widening the badge.

        const dm = getDisplayMetrics(alertSource);
        const secondary = getSecondaryTags(alertSource);
        const pct = v => Math.round(v * 100);
        // Stack context lines for tooltip
        const liveStackVal = lsForBadge?.stack ?? null;
        const heroStackVal = localPlayerName ? (stackByName[localPlayerName] ?? null) : null;
        const effStack = liveStackVal && heroStackVal ? Math.min(liveStackVal, heroStackVal) : null;

        const stackLine = liveStackVal !== null
            ? `Stack: ${fmtStack(liveStackVal)}${effStack !== null ? `  · Effective vs you: ${fmtStack(effStack)}` : ''}`
            : '';

        const commitLine = (() => {
            const parts = [];
            if (dm?.avgRaisePct != null) parts.push(`Avg raise: ${dm.avgRaisePct.toFixed(1)}% of stack`);
            if (dm?.avgCallPct != null) parts.push(`Avg call: ${dm.avgCallPct.toFixed(1)}% of stack`);
            return parts.join('  ');
        })();

        const STACK_FRESH_MS = 4000;
        const stackIsFresh = lsForBadge?.lastSeen && (Date.now() - lsForBadge.lastSeen < STACK_FRESH_MS);
        const stackBBVal = stackIsFresh && liveStackVal && currentTableBB ? Math.round(liveStackVal / currentTableBB) : null;
        const shortStackWarning = stackBBVal !== null && stackBBVal < 20
            ? '⚠ Short stack — VPIP/PFR stats unreliable in push/fold mode'
            : '';

        badge.title = '';
        badge._tphudTip = { s, alertSource, dm, secondary, alerts, lsForBadge };

        // Store data needed to render the side stats sibling after badge is in the DOM
        badge._sideStatsData = (dm && hudSettings.showInlineBadgeStats && !isMobileViewport())
            ? {
                rows: [
                    { label: 'V', val: Math.round(dm.vpip * 100), notable: dm.vpip > 0.30 || dm.vpip < 0.14 },
                    { label: 'P', val: Math.round(dm.pfr * 100), notable: dm.pfr > 0.22 || dm.pfr < 0.06 },
                    dm.afqReliable
                        ? { label: 'A', val: Math.round(dm.afq * 100), notable: dm.afq > 0.60 || dm.afq < 0.20 }
                        : null,
                ].filter(Boolean),
                color: type.color,
            }
            : null;
        if (badge.parentNode) syncSideStats(badge);

        badge.addEventListener('mouseenter', e => {
            const d = badge._tphudTip;
            if (!d) return;
            showTip(buildBadgeTip(d.s, d.alertSource, d.dm, d.secondary, d.alerts, d.lsForBadge), badge.getBoundingClientRect());
        });
        badge.addEventListener('mouseleave', hideTip);
    }

    function createBadge(name, numericId) {
        const badgeKey = numericId || name;
        if (badges[badgeKey]) return badges[badgeKey];

        const badge = document.createElement('div');
        badge.className = 'tphud-badge';
        badge._badgeKey = badgeKey;

        const all = getStats();
        const s = resolveStatsByName(name, all);
        if (s) renderBadge(badge, s);
        else {
            badge.innerHTML = '<span style="color:#444">?</span>';
            badge.style.borderColor = '#333';
            badge.style.background = 'rgba(0,0,0,0.3)';
            badge.title = 'No data yet';
        }

        // On mobile with double-tap mode: require two taps within 400ms to open
        let badgeTapTimer = null;
        badge.addEventListener('pointerdown', e => {
            e.stopPropagation();
            if (isMobileViewport() && hudSettings.badgeTapMode === 'double') {
                if (badgeTapTimer) {
                    // Second tap within window — open panel
                    clearTimeout(badgeTapTimer);
                    badgeTapTimer = null;
                    openPanel(name, numericId);
                } else {
                    // First tap — wait for second
                    badge.style.outline = '2px solid rgba(255,255,255,0.3)';
                    badgeTapTimer = setTimeout(() => {
                        badgeTapTimer = null;
                        badge.style.outline = '';
                    }, 400);
                }
            } else {
                openPanel(name, numericId);
            }
        });
        badges[badgeKey] = badge;
        return badge;
    }

    // Shared container for bottom-of-seat indicators (auto-tag, net worth).
    // Creates it on first use; removes it if empty after sync.
    function getOrCreateBottomRow(seat) {
        let row = seat.querySelector('.tphud-seat-bottom');
        if (!row) {
            row = document.createElement('div');
            row.className = 'tphud-seat-bottom';
            seat.appendChild(row);
        }
        return row;
    }

    function syncAutoTagIndicator(seat, name, numericId) {
        const s = resolveStatsByName(name, getStats());
        const count = s?.autoTags?.length || 0;
        const row = getOrCreateBottomRow(seat);
        let indicator = row.querySelector('.tphud-autotag-indicator');

        if (count === 0) {
            indicator?.remove();
            if (!row.hasChildNodes()) row.remove();
            return;
        }

        if (!indicator) {
            indicator = document.createElement('div');
            indicator.className = 'tphud-autotag-indicator';
            indicator.title = 'Notable plays auto-tagged — click to view';
            indicator.addEventListener('pointerdown', e => {
                e.stopPropagation();
                showAutoTagsModal(name, numericId);
            });
            row.appendChild(indicator);
        }

        indicator.textContent = `✎ ${count}`;
    }

    function syncNetworthIndicator(seat, name) {
        const s = resolveStatsByName(name, getStats());
        const row = getOrCreateBottomRow(seat);
        let tag = row.querySelector('.tphud-networth-indicator');

        if (!s || (s.networth ?? null) === null) {
            tag?.remove();
            if (!row.hasChildNodes()) row.remove();
            return;
        }

        if (!tag) {
            tag = document.createElement('div');
            tag.className = 'tphud-networth-indicator';
            // Tooltip reads live stack data at hover time — attached once on creation
            tag.addEventListener('mouseenter', () => {
                const live = resolveStatsByName(name, getStats());
                if (!live?.networth) return;
                const seatId = nameToSeatId[name];
                const stack = seatId ? (liveStacks[seatId]?.stack ?? null) : null;
                const ratio = (stack != null && live.networth > 0) ? stack / live.networth : null;
                const lines = [`Net worth: ${fmtNetworth(live.networth)}`];
                if (ratio !== null) {
                    lines.push(`Stack is ${(ratio * 100).toFixed(1)}% of their wealth`);
                    if (ratio < 0.005) lines.push('Pocket change relative to their wealth');
                    else if (ratio > 0.2) lines.push('Significant stake for this player');
                }
                showTip(`<div class="tphud-tip-row">${lines.join('<br>')}</div>`, tag.getBoundingClientRect());
            });
            tag.addEventListener('mouseleave', hideTip);
            row.appendChild(tag);
        }

        tag.textContent = fmtNetworth(s.networth);
        tag.style.background = networthColor(s.networth);
    }

    // Returns Map<factionId, { name, players: Set<playerName> }> for factions with 2+ reps at the table.
    // Reads from live DOM seats so departed players don't count.
    function getTableFactionGroups() {
        const groups = new Map();
        document.querySelectorAll('[id^="player-"]').forEach(seat => {
            const name = seat.dataset.hudBoundName;
            if (!name || name.startsWith('__self__:')) return;
            if (!seat.querySelector('[class^="name___"]')) return; // vacant seat
            const numericId = nameToSeatId[name];
            if (!numericId) return;
            const f = factionCache[numericId];
            if (!f) return;
            if (!groups.has(f.id)) groups.set(f.id, { name: f.name, players: new Set() });
            groups.get(f.id).players.add(name);
        });
        return groups;
    }

    function syncFactionIndicator(seat, name) {
        const row = getOrCreateBottomRow(seat);
        let tag = row.querySelector('.tphud-faction-indicator');

        const numericId = nameToSeatId[name];
        // Not fetched yet or no API key — remove and bail
        if (!numericId || !(numericId in factionCache)) {
            tag?.remove();
            if (!row.hasChildNodes()) row.remove();
            return;
        }

        const cached = factionCache[numericId];

        if (!tag) {
            tag = document.createElement('div');
            tag.className = 'tphud-faction-indicator';
            tag.addEventListener('mouseenter', () => {
                const nm = nameToSeatId[name];
                const c = nm ? factionCache[nm] : null;
                if (!c) {
                    showTip(`<div class="tphud-tip-row">No faction</div>`, tag.getBoundingClientRect());
                    return;
                }
                const g = getTableFactionGroups().get(c.id);
                const lines = [];
                if (g && g.players.size >= 2) {
                    lines.push(`${g.players.size} players from the same faction (${c.name}): ${[...g.players].join(', ')}`);
                    lines.push(`Doesn't mean they're colluding but be wary!`);
                } else {
                    lines.push(`Faction: ${c.name}`);
                }
                showTip(`<div class="tphud-tip-row">${lines.join('<br>')}</div>`, tag.getBoundingClientRect());
            });
            tag.addEventListener('mouseleave', hideTip);
            row.appendChild(tag);
        }

        const groups = getTableFactionGroups();
        const shared = cached && (groups.get(cached.id)?.players.size ?? 0) >= 2;
        tag.dataset.shared = shared ? '1' : '0';
        tag.dataset.nofaction = cached ? '0' : '1';
        tag.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 14" width="9" height="12" style="display:block">
            <rect fill="currentColor" x="0" y="0" width="1.8" height="14" rx="0.6"/>
            <polygon fill="currentColor" points="1.8,0.5 10,3 10,9 1.8,11.5"/>
        </svg>`;
    }

    // ── Collusion detection ──────────────────────────────────────

    function getFactionForPlayer(name) {
        const numId = nameToSeatId[name] || chatNameToSeatId[name];
        if (!numId) return null;
        return factionCache[numId] ?? null;
    }

    // Returns true if both players share the same faction
    function sharesFaction(a, b) {
        const fa = getFactionForPlayer(a);
        const fb = getFactionForPlayer(b);
        return !!(fa && fb && fa.id === fb.id);
    }

    // Canonical key for a player pair — order-independent. Uses Torn XIDs when known so
    // the pair survives renames and table switches; falls back to names otherwise.
    function getPairKey(a, b) {
        const idOf = n => String(nameToSeatId[n] || chatNameToSeatId[n] || n);
        return [idOf(a), idOf(b)].sort().join('|');
    }

    function recordCollusionEvent(playerA, playerB, event) {
        const key = getPairKey(playerA, playerB);
        if (!suspicionPairs.has(key)) suspicionPairs.set(key, { players: [playerA, playerB], events: [] });
        const pair = suspicionPairs.get(key);
        // Keep display names current in case one of them renamed since the pair was created
        pair.players = [playerA, playerB];
        // Skip exact duplicate in the same hand
        if (pair.events.some(e => e.type === event.type && e.handId === event.handId)) return;
        event.ts = Date.now();
        event.tableBB = currentHand?.bbAmount || currentTableBB;
        event.tableName = currentTableName;
        // Capture hand snapshot for rich display in the modal
        if (currentHand) {
            event.snap = {
                boardCards: [...(currentHand.boardCards || [])],
                flopCards: [...(currentHand.flopCards || [])],
                turnCards: [...(currentHand.turnCards || [])],
                pot: currentHand.runningPot,
                stackAtStart: { ...currentHand.stackAtStart },
                potContrib: { ...currentHand.playerPotContrib },
                actionLog: JSON.parse(JSON.stringify(currentHand.actionLog || {})),
                selfHoleCards: currentHand.selfHoleCards ? [...currentHand.selfHoleCards] : null,
                tableBB: currentHand.bbAmount || currentTableBB,
                tableName: currentTableName,
            };
        }
        pair.events.push(event);
        // Cap per-pair growth: oldest events (and their heavy snapshots) go first
        while (pair.events.length > SUSPICION_EVENTS_CAP) pair.events.shift();
        saveSuspicionPairs();
        // Refresh indicators for both players
        [playerA, playerB].forEach(n => {
            const seat = document.getElementById('player-' + (nameToSeatId[n] || chatNameToSeatId[n]));
            if (seat) syncCollusionIndicator(seat, n);
        });
    }

    // Returns all qualifying suspicious pairs involving this player.
    // Faction pairs: show after 1 event. Non-faction pairs: show after 2+ events.
    function getSuspiciousPairsFor(name) {
        const result = [];
        for (const [, pair] of suspicionPairs) {
            if (!pair.players.includes(name)) continue;
            const other = pair.players.find(p => p !== name);
            const isFaction = sharesFaction(name, other);
            // Non-faction whipsaw-only pairs need 3+ — an aggressive 3-bettor + a raiser
            // who happened to call will still trigger this occasionally without coordination.
            // Mixed or soft-play-only pairs keep the 2+ bar.
            const hasOnlyWhipsaw = pair.events.length > 0 && pair.events.every(e => e.type === 'whipsaw');
            const threshold = isFaction ? 1 : (hasOnlyWhipsaw ? 3 : 2);
            if (pair.events.length >= threshold) result.push(pair);
        }
        return result;
    }

    // Soft play: player folds with significant stack committed against another player's aggression.
    // Threshold: 20% if they share a faction, 35% otherwise (stricter to avoid false alarms).
    function checkSoftPlay(folder, street) {
        if (!currentHand || folder === localPlayerName) return;
        if (street === 'preflop') return; // preflop folds are normal — too many false positives
        const contrib = currentHand.playerPotContrib[folder] || 0;
        const startStack = currentHand.stackAtStart[folder];
        if (!startStack || startStack <= 0) return;

        const aggressor = currentHand.preflopAggressor;
        if (!aggressor || aggressor === folder) return;

        const commitRatio = contrib / startStack;
        const isSameFaction = sharesFaction(folder, aggressor);
        const threshold = isSameFaction ? 0.20 : 0.35;
        if (commitRatio < threshold) return;

        recordCollusionEvent(folder, aggressor, {
            type: 'soft_play',
            handId: currentHand.handId,
            description: `${folder} folded ${Math.round(commitRatio * 100)}% committed on ${street} vs ${aggressor}`,
            folder,
            aggressor,
            street,
            commitRatio,
            contrib,
            startStack,
        });
    }

    // Whipsaw: original raiser soft-plays a 3-bet (calls instead of folding/4-betting),
    // trapping callers who got squeezed in between. Runs at hand finalization so we have
    // full action data — calling at 3-bet time caused every normal squeeze to false-positive.
    function checkWhipsaw() {
        if (!currentHand) return;
        const threeBettor = currentHand.preflopThreeBettor;
        const originalRaiser = currentHand.preflopFirstRaiser;
        if (!threeBettor || !originalRaiser || originalRaiser === threeBettor) return;

        const raiserData = currentHand.perPlayer[originalRaiser];
        if (!raiserData) return;

        // Raiser must have called the 3-bet — folding or 4-betting is normal poker, not a whipsaw.
        // preflopRaiseCount > 2 means someone 4-bet, which is aggressive, not soft play.
        if (raiserData.foldedToThreeBet) return;
        if (currentHand.preflopRaiseCount > 2) return;
        if (!raiserData.sawFlop) return;

        // Must have at least one caller who actually got squeezed out (folded preflop)
        const isSameFaction = sharesFaction(originalRaiser, threeBettor);
        const victims = Object.entries(currentHand.perPlayer)
            .filter(([name, p]) => {
                if (name === threeBettor || name === originalRaiser) return false;
                if (!p.voluntaryPreflop && !p.postedBB) return false;
                if (!isSameFaction && !p.voluntaryPreflop) return false;
                if (!p.foldedPreflop) return false; // must have been squeezed out — callers don't count
                return true;
            })
            .map(([name]) => name);

        if (victims.length === 0) return;

        recordCollusionEvent(originalRaiser, threeBettor, {
            type: 'whipsaw',
            handId: currentHand.handId,
            description: `${originalRaiser} raised then called ${threeBettor}'s 3-bet, squeezing ${victims.join(', ')}`,
            raiser: originalRaiser,
            threeBettor,
            victims,
        });
    }

    function syncCollusionIndicator(seat, name) {
        const row = getOrCreateBottomRow(seat);
        let tag = row.querySelector('.tphud-collusion-indicator');

        const qualifyingPairs = getSuspiciousPairsFor(name);
        const totalEvents = qualifyingPairs.reduce((sum, p) => sum + p.events.length, 0);

        if (totalEvents === 0) {
            tag?.remove();
            if (!row.hasChildNodes()) row.remove();
            return;
        }

        if (!tag) {
            tag = document.createElement('div');
            tag.className = 'tphud-collusion-indicator';
            tag.style.cursor = 'pointer';
            tag.addEventListener('mouseenter', () => {
                const pairs = getSuspiciousPairsFor(name);
                if (!pairs.length) return;
                const typeLabel = { soft_play: '🤝 Soft play', whipsaw: '🪤 Whipsaw' };
                const lines = pairs.flatMap(p => p.events.map(e => `${typeLabel[e.type] || '⚠'}: ${e.description}`));
                showTip(
                    `<div class="tphud-tip-row"><b style="color:#ffcc00">⚠ Suspicious pattern (${lines.length}) — click for full report</b><br>${lines.join('<br>')}</div>`,
                    tag.getBoundingClientRect()
                );
            });
            tag.addEventListener('mouseleave', hideTip);
            tag.addEventListener('click', e => {
                e.stopPropagation();
                hideTip();
                showSuspicionModal(name);
            });
            row.appendChild(tag);
        }

        tag.textContent = `⚠ ${totalEvents}`;
    }

    // Verdict emoji indicators in the seat bottom row (kept out of the badge to avoid widening it on mobile).
    function syncEmojiIndicators(seat, name) {
        const row = getOrCreateBottomRow(seat);
        let tag = row.querySelector('.tphud-emoji-indicators');

        const all = getStats();
        const s = resolveStatsByName(name, all);
        const alertSource = s ? getActiveStats(s, currentTableBB) : null;
        const tv = alertSource?.totalVerdicts || 0;

        if (tv < 5) {
            tag?.remove();
            if (!row.hasChildNodes()) row.remove();
            return;
        }

        const emojiMap = [
            { cond: (alertSource.bluffCount || 0) / tv >= 0.40, emoji: '🎭', tip: 'Frequent bluffer (card-verified)' },
            { cond: (alertSource.drawCount || 0) / tv >= 0.35, emoji: '🎯', tip: 'Chases draws often' },
            { cond: (alertSource.valuePlayCount || 0) / tv >= 0.60, emoji: '💎', tip: 'Shows strong hands at showdown' },
            { cond: (alertSource.thinValueCount || 0) / tv >= 0.40, emoji: '🃏', tip: 'Often overplays marginal hands' },
            { cond: (alertSource.looseCallCount || 0) / tv >= 0.25, emoji: '📞', tip: 'Loose caller (card-verified)' },
        ];
        const active = emojiMap.filter(e => e.cond).slice(0, 2);

        if (!active.length) {
            tag?.remove();
            if (!row.hasChildNodes()) row.remove();
            return;
        }

        if (!tag) {
            tag = document.createElement('span');
            tag.className = 'tphud-emoji-indicators';
            row.appendChild(tag);
        }

        tag.innerHTML = '';
        active.forEach(e => {
            const em = document.createElement('span');
            em.textContent = e.emoji;
            em.style.cssText = 'font-size:10px;cursor:default;';
            attachSimpleTip(em, e.tip);
            tag.appendChild(em);
        });
    }

    // ── Hint cards ───────────────────────────────────────────────

    function hintCard(icon, title, body, color) {
        return `
            <div class="tphud-hint-card" style="border-left-color:${color}">
                <div class="tphud-hint-title" style="color:${color}">${icon} ${title}</div>
                <div class="tphud-hint-body">${body}</div>
            </div>`;
    }

    function buildOpponentHintHtml(s, type, m) {
        const cards = [];
        const pct = v => `${Math.round(v * 100)}%`;
        const typeKey = Object.keys(TYPES).find(k => TYPES[k] === type) || 'UNKNOWN';
        const dm = getDisplayMetrics(s);

        const strategies = {
            MANIAC: { color: '#ff6b6b', body: `Stop trying to bluff them off hands — they call with anything. Sit back and trap. When you flop strong, check and let them bet into you, then raise. Tighten your preflop range and be patient. Their chips will come to you — don't rush it.` },
            LAG: { color: '#ffaa55', body: `Don't fold too quickly to their bets — they fire a lot of bluffs. Call them down with medium-strength hands more than you normally would. 3-bet them back for value when you have it, and let their own aggression cost them chips.` },
            TAG: { color: '#55e87a', body: `Most dangerous player at the table. Their range is tight and strong — respect their bets. Fold marginal hands when they show resistance. Don't try to run bluffs without a clear read. If they raise on a scary board, believe them. Pick up pots when they're not in the hand and avoid big confrontations without a strong holding.` },
            FISH: { color: '#ff9944', body: `This is your ATM. They play way too many hands and barely raise — just call and call. Value bet relentlessly with any made hand. Don't bluff them, don't get fancy. Bet big when you have it, check when you don't. They'll pay you off with bottom pair and gutshot draws all day long.` },
            CALLING_STATION: { color: '#5db8f5', body: `Never bluff them. They will call down to the river with bottom pair — full stop. Your only weapon is value. Bet big when you have it. Don't slow-play or trap. Thin value bets work here too — even top pair with a weak kicker is worth multiple streets. Just show up at showdown with the better hand.` },
            ROCK: { color: '#8899aa', body: `Even tighter than a nit — they play almost nothing. Steal their blinds every single orbit from any position. When they finally put chips in, run. Their range is AA/KK/AK and not much else. Don't waste a single chip trying to play back at them unless you're holding the nuts.` },
            NIT: { color: '#4de3c4', body: `Steal their blinds relentlessly from late position — they fold almost everything. When they finally show resistance, get out immediately. Their bets mean a very strong hand. Take the easy money repeatedly and don't pay them off when they wake up.` },
            TIGHT_PASSIVE: { color: '#e0e8ea', body: `C-bet almost every flop — they check-fold a lot. Steal blinds freely. When they call or raise, slow down and reassess. They avoid confrontation heavily, so their aggression is almost always real strength. Pick up small pots constantly, bleed them out.` },
            LOOSE_PASSIVE: { color: '#d97ff0', body: `Value bet relentlessly. They'll call with middle pair, weak draws, anything marginal. Don't bother bluffing — they call too much for it to work consistently. Play straightforward ABC poker and make them pay every single street when you have something real.` },
            MIXED: { color: '#f0d060', body: `No clear pattern yet — don't make fancy plays until you have a proper read. Watch how they respond to bets. Do they fold? Do they call? Do they fight back? Use the next few hands to build a real picture before committing big chips.` },
            UNKNOWN: { color: '#cccccc', body: `Not enough hands seen yet. Play standard poker and observe their tendencies.` },
        };

        const strat = strategies[typeKey] || strategies.UNKNOWN;
        cards.push(hintCard('▶', `How to Play Against ${resolvedType(type).label}`, strat.body, strat.color));

        const exploits = [];
        if (m.foldVsFlopBet != null) {
            if (m.foldVsFlopBet >= 0.65)
                exploits.push(`<b>C-bet every flop</b> — they fold to flop bets ${pct(m.foldVsFlopBet)} of the time. You don't need to connect with the board.`);
            else if (m.foldVsFlopBet <= 0.30)
                exploits.push(`<b>Cut your bluffs on the flop</b> — they only fold ${pct(m.foldVsFlopBet)}. Only bet when you have real equity behind it.`);
        }
        if (m.limpPct != null && m.limpPct >= 0.25)
            exploits.push(`<b>Isolate their limps</b> — they limp in ${pct(m.limpPct)} of the time. Raise it up in position to play heads-up with a range advantage against a weak entry.`);
        if (m.threeBetPct != null) {
            if (m.threeBetPct <= 0.03)
                exploits.push(`<b>Open wide when they're in the blinds</b> — they almost never 3-bet (${pct(m.threeBetPct)}). Steal freely and don't respect their flat-calls.`);
            else if (m.threeBetPct >= 0.12)
                exploits.push(`<b>Tighten your open range</b> when they're left to act — they 3-bet ${pct(m.threeBetPct)}. Don't open junk and get blown off it.`);
        }
        if (m.foldTo3BetPct != null) {
            if (m.foldTo3BetPct >= 0.70)
                exploits.push(`<b>3-bet them light</b> — they fold to 3-bets ${pct(m.foldTo3BetPct)} of the time. Squeeze them off wide opens with almost anything.`);
            else if (m.foldTo3BetPct <= 0.30)
                exploits.push(`<b>Don't 3-bet without a real hand</b> — they call or re-raise 3-bets ${pct(1 - m.foldTo3BetPct)} of the time. Light squeezes will get you in trouble.`);
        }
        if (m.wtsd >= 0.55)
            exploits.push(`<b>Don't try to bluff them off hands post-flop</b> — they go to showdown ${pct(m.wtsd)} of flops they see. They're not folding.`);
        if (s.wentToShowdownCount >= 3) {
            const weakRate = s.showdownWeak / s.wentToShowdownCount;
            if (weakRate > 0.5)
                exploits.push(`<b>Bet thin value freely</b> — ${Math.round(weakRate * 100)}% of their showdowns were one pair or worse. They call down with trash.`);
        }
        if (s.recent.length >= 10) {
            const win = s.recent.slice(-10);
            const recentV = win.filter(h => h.vpip).length / win.length;
            const lifetimeV = s.vpipCount / s.handsObserved;
            if (recentV - lifetimeV > 0.20)
                exploits.push(`<b>Playing looser than usual right now</b> — either tilting or on a rush. Tighten up and make them pay when you have it.`);
            else if (lifetimeV - recentV > 0.20)
                exploits.push(`<b>Playing much tighter than normal</b> — card-dead or nursing chips. Their rare bets are even more credible right now.`);
        }
        if (m.gap != null && m.gap >= 0.20)
            exploits.push(`<b>Heavy caller, rarely raises</b> — ${pct(m.gap)} gap between VPIP and PFR. Their range post-flop is full of weak speculative hands. Bet for value on safe boards.`);
        if (dm?.avgRaisePct != null && s.raisePctSamples >= 3) {
            if (dm.avgRaisePct <= 2)
                exploits.push(`<b>Probe-size raises (avg ${dm.avgRaisePct.toFixed(1)}% of stack)</b> — they're not committed. Float their raise and take the pot on the turn when they check.`);
            else if (dm.avgRaisePct >= 8)
                exploits.push(`<b>Large raise commitment (avg ${dm.avgRaisePct.toFixed(1)}% of stack)</b> — when they raise they have something real. 3-bet for value or fold. Don't float.`);
        }
        if (dm?.avgCallPct != null && s.callPctSamples >= 3 && dm.avgCallPct >= 10)
            exploits.push(`<b>Commits big on calls (avg ${dm.avgCallPct.toFixed(1)}% of stack)</b> — they won't fold after a big call. Forget bluffing — just charge them every street.`);
        if (s.wentToShowdownCount >= 5 && m.wsd != null && m.wsd <= 0.40)
            exploits.push(`<b>Loses showdowns often (${pct(m.wsd)})</b> — calls down with hands that can't beat much. Value bet every street you're ahead.`);

        if (exploits.length > 0)
            cards.push(hintCard('◆', 'Specific Exploits', `<ul class="tphud-hint-list">${exploits.map(e => `<li>${e}</li>`).join('')}</ul>`, '#f1c40f'));

        const dangers = [];
        if (typeKey === 'MANIAC' || typeKey === 'LAG')
            dangers.push(`Don't tilt-call because they're being annoying. Every bad call is chips you're giving away. Wait for a real hand and trap.`);
        if (typeKey === 'LAG')
            dangers.push(`They'll 3-bet light to retake the pot. Don't open weak hands when they're left to act — they will fight back.`);
        if (m.threeBetPct != null && m.threeBetPct >= 0.10)
            dangers.push(`3-bets ${pct(m.threeBetPct)} preflop — one of the highest at the table. Tighten your opening range when they have position or are in the blinds.`);
        if (m.wsd != null && m.wsd >= 0.65 && s.wentToShowdownCount >= 5)
            dangers.push(`Wins ${pct(m.wsd)} of showdowns reached — when they call to the river, they usually have it. Don't fire into them on wet boards without the goods.`);
        if (m.wtsd != null && m.wtsd >= 0.55 && m.wsd != null && m.wsd >= 0.55)
            dangers.push(`Rarely folds AND wins at showdown a lot — do not bluff. Only put chips in when you're confident you're ahead.`);
        if (typeKey === 'TAG')
            dangers.push(`Tight range, almost always strong. Fold marginal hands to their bets. Don't try to outplay them without the nuts.`);
        if (typeKey === 'TAG')
            dangers.push(`Watch their position — a TAG raising in position is value, not a steal. Don't 3-bet light expecting a fold.`);
        if (typeKey === 'FISH' || typeKey === 'CALLING_STATION')
            dangers.push(`Don't get frustrated when they suck out — bad players get lucky short term. Stay disciplined, keep value betting, the math wins over time.`);
        if (m.postFoldPct != null && m.postFoldPct <= 0.15)
            dangers.push(`Almost never folds post-flop (${pct(m.postFoldPct)}) — your bluffs are burning chips. Only bet when you have real equity or a made hand.`);
        if (dm?.avgRaisePct != null && s.raisePctSamples >= 3 && dm.avgRaisePct >= 8)
            dangers.push(`Large raise sizes (avg ${dm.avgRaisePct.toFixed(1)}% of stack) — when they raise, they're committed. Don't try to push them off it.`);

        if (dangers.length > 0)
            cards.push(hintCard('!', 'Watch Out For', `<ul class="tphud-hint-list">${dangers.map(d => `<li>${d}</li>`).join('')}</ul>`, '#e74c3c'));

        return cards.join('');
    }

    function buildStartingHandCard(s) {
        const sh = s.startingHands || {};
        if (Object.keys(sh).length < 8) return '';

        // Combine suited/offsuit variants when both have dealt < 5
        const combined = {};
        for (const [hand, data] of Object.entries(sh)) {
            const isPair = hand.length === 2;
            if (isPair) { combined[hand] = { ...data, _key: hand }; continue; }
            const base = hand.slice(0, 2);
            const other = hand.endsWith('s') ? base + 'o' : base + 's';
            if (sh[other] && data.dealt < 5 && sh[other].dealt < 5) {
                if (!combined[base]) {
                    combined[base] = { dealt: 0, vpip: 0, pfr: 0, won: 0, _key: base + ' (combined)', _combined: true };
                }
                combined[base].dealt += data.dealt;
                combined[base].vpip += data.vpip;
                combined[base].pfr += data.pfr;
                combined[base].won += data.won;
            } else {
                combined[hand] = { ...data, _key: hand };
            }
        }
        const hands = Object.values(combined);

        const top5 = [...hands].sort((a, b) => b.dealt - a.dealt).slice(0, 5);
        const top5Html = top5.map(h => {
            const vpipPct = h.dealt > 0 ? Math.round(h.vpip / h.dealt * 100) : 0;
            const winPct = h.dealt > 0 ? Math.round(h.won / h.dealt * 100) : 0;
            return `<b>${h._key}</b>: ${h.dealt} dealt, ${vpipPct}% VPIP, ${winPct}% win`;
        }).join('<br>');

        const worst = hands
            .filter(h => h.dealt >= 3 && (h.won / h.dealt) <= 0.25)
            .sort((a, b) => (b.dealt - b.won) - (a.dealt - a.won))
            .slice(0, 3);
        const worstHtml = worst.length > 0
            ? '<b>Costing you chips:</b><br>' + worst.map(h => {
                const winPct = Math.round(h.won / h.dealt * 100);
                return `<b>${h._key}</b>: ${h.dealt} dealt, ${winPct}% win — drop this.`;
            }).join('<br>')
            : '';

        const overPlayed = hands
            .filter(h => h.dealt >= 3 && (h.vpip / h.dealt) > 0.80 && (h.won / h.dealt) < 0.30)
            .sort((a, b) => (b.dealt - b.won) - (a.dealt - a.won))
            .slice(0, 3);
        const overPlayedHtml = overPlayed.length > 0
            ? '<b>Over-played losers:</b><br>' + overPlayed.map(h => {
                const vpipPct = Math.round(h.vpip / h.dealt * 100);
                const winPct = Math.round(h.won / h.dealt * 100);
                return `You play <b>${h._key}</b> almost every time (${vpipPct}% VPIP) but only win ${winPct}%.`;
            }).join('<br>')
            : '';

        const underPlayed = hands
            .filter(h => h.dealt >= 3 && h.vpip >= 1 && (h.vpip / h.dealt) < 0.40 && (h.won / h.dealt) > 0.60)
            .sort((a, b) => b.dealt - a.dealt)
            .slice(0, 3);
        const underPlayedHtml = underPlayed.length > 0
            ? '<b>Under-played winners:</b><br>' + underPlayed.map(h => {
                const winPct = Math.round(h.won / h.dealt * 100);
                const neverRaised = h.pfr === 0 ? ` And you've never raised it — raising builds bigger pots when you're ahead.` : '';
                return `You fold <b>${h._key}</b> too often — when you do play it, you win ${winPct}%.${neverRaised}`;
            }).join('<br>')
            : '';

        const noLeaksNote = (!worst.length && !overPlayed.length && !underPlayed.length)
            ? '<i>No obvious hand selection leaks detected.</i>' : '';

        const sections = [
            `<b>Top 5 most played:</b><br>${top5Html}`,
            worstHtml,
            overPlayedHtml,
            underPlayedHtml,
            noLeaksNote,
        ].filter(Boolean).join('<br><br>');

        return hintCard('♠', 'Starting Hand Report', sections, '#e67e22');
    }

    function buildFoldDisciplineCard(s) {
        const strongCount = s.selfFoldedStrongCount || 0;
        const drawCount = s.selfFoldedDrawCount || 0;
        const airCount = s.selfFoldedAirCount || 0;
        const marginalCount = s.selfFoldedMarginalCount || 0;
        if (strongCount + drawCount + airCount + marginalCount < 3) return '';

        const hist = s.history || [];
        const drawHitCount = hist.filter(e => e.selfFoldVerdict?.verdict === 'FOLDED_DRAW_HIT').length;
        const bullets = [];

        if (strongCount >= 1) {
            const examples = hist
                .filter(e => e.selfFoldVerdict?.verdict === 'FOLDED_STRONG')
                .slice(0, 3)
                .map(e => e.selfFoldVerdict.handDesc);
            const exStr = examples.length > 0 ? ` (${examples[0]}${examples.length > 1 ? ` and ${examples.length - 1} more` : ''})` : '';
            if (strongCount >= 2)
                bullets.push(`Folded strong hands <b>${strongCount} times</b>${exStr}. Review whether the bet sizing justified it — ${strongCount} times is a pattern.`);
            else
                bullets.push(`Folded a strong hand once${exStr}. Could be correct — monitor if it becomes a pattern.`);
        }

        if (drawCount >= 2) {
            const missCount = drawCount - drawHitCount;
            if (drawCount > 0 && drawHitCount / drawCount > 0.50)
                bullets.push(`Folded draws that completed <b>${drawHitCount} out of ${drawCount} times</b>. You may be folding too early when pot odds justify calling.`);
            else
                bullets.push(`Folded ${drawCount} draws — ${drawHitCount} hit, ${missCount} missed. Fold discipline on draws looks reasonable.`);
        }

        if (airCount >= 3)
            bullets.push(`Correctly folded nothing <b>${airCount} times</b>. Good discipline — don't call just because you're invested.`);

        if (marginalCount >= 2)
            bullets.push(`Folded marginal hands <b>${marginalCount} times</b>. Judgment calls — no clear leak unless you're folding them to minimum bets.`);

        if (!bullets.length) return '';
        return hintCard('⟳', 'Fold Discipline', `<ul class="tphud-hint-list">${bullets.map(b => `<li>${b}</li>`).join('')}</ul>`, '#9b59b6');
    }

    function buildTurnRiverCourageCard(s) {
        const facedTurn = s.facedTurnBetCount || 0;
        const facedRiver = s.facedRiverBetCount || 0;
        if (facedTurn < 5 && facedRiver < 5) return '';

        const foldVsTurn = s.foldedVsTurnBetCount || 0;
        const foldVsRiver = s.foldedVsRiverBetCount || 0;
        const pct = v => `${Math.round(v * 100)}%`;
        const bullets = [];

        if (facedTurn >= 5) {
            const rate = foldVsTurn / facedTurn;
            if (rate > 0.65)
                bullets.push(`You fold to turn bets <b>${pct(rate)}</b> of the time (${foldVsTurn}/${facedTurn}). Opponents who notice this will barrel you off hands every turn. This is a clear leak.`);
            else if (rate > 0.55)
                bullets.push(`You fold to turn bets <b>${pct(rate)}</b> of the time — on the high side. Start calling more with top pair or strong draws.`);
            else if (rate < 0.25)
                bullets.push(`You only fold <b>${pct(rate)}</b> to turn bets — you're a tough call-down. Make sure you're not bleeding chips calling with middle pair on scary boards.`);
            else
                bullets.push(`Turn fold rate is <b>${pct(rate)}</b> — reasonable. No obvious leak.`);
        }

        if (facedRiver >= 5) {
            const rate = foldVsRiver / facedRiver;
            if (rate > 0.70)
                bullets.push(`You fold to river bets <b>${pct(rate)}</b> of the time (${foldVsRiver}/${facedRiver}). Any decent player will bluff your river after you call the turn. Fix this.`);
            else if (rate > 0.60)
                bullets.push(`You fold to river bets <b>${pct(rate)}</b> — getting towards exploitable territory.`);
            else if (rate < 0.25)
                bullets.push(`You almost never fold the river (<b>${pct(rate)}</b>). Good if you have strong reads — expensive if you're just stubborn.`);
            else
                bullets.push(`River fold rate is <b>${pct(rate)}</b> — balanced.`);
        }

        if (facedTurn >= 5 && facedRiver >= 5) {
            const tr = foldVsTurn / facedTurn;
            const rr = foldVsRiver / facedRiver;
            if (tr > 0.55 && rr > 0.60)
                bullets.push(`You fold a lot on both late streets. Aggressive opponents will barrel you relentlessly — you're giving up pots you've already invested in.`);
            else if (tr < 0.30 && rr < 0.30)
                bullets.push(`You call down hard on both streets. Make sure you're not paying off value bets with weak holdings.`);
        }

        if (!bullets.length) return '';
        return hintCard('⬥', 'Turn & River Courage', `<ul class="tphud-hint-list">${bullets.map(b => `<li>${b}</li>`).join('')}</ul>`, '#e74c3c');
    }

    function buildPositionCard(s) {
        const pos = s.positions || {};
        const qualified = Object.values(pos).filter(p => (p.hands || 0) >= 8);
        if (qualified.length < 2) return '';

        const EP = pos.EP || { hands: 0, vpip: 0, pfr: 0 };
        const LP = pos.LP || { hands: 0, vpip: 0, pfr: 0 };
        const BB = pos.BB || { hands: 0, vpip: 0, pfr: 0 };
        const pct = (n, d) => d > 0 ? Math.round(n / d * 100) : 0;
        const bullets = [];

        if (EP.hands >= 8 && pct(EP.vpip, EP.hands) > 30)
            bullets.push(`You're playing too many hands from early position (<b>${pct(EP.vpip, EP.hands)}%</b> VPIP). Tighten to premium pairs and strong broadways from UTG.`);

        if (LP.hands >= 8 && pct(LP.pfr, LP.hands) < 12)
            bullets.push(`You're not stealing enough from late position (<b>${pct(LP.pfr, LP.hands)}%</b> PFR). When it folds to you on the button, raise wider — any ace, any pair, any two broadways.`);

        if (BB.hands >= 10 && pct(BB.vpip, BB.hands) > 55 && pct(BB.pfr, BB.hands) < 10)
            bullets.push(`You over-defend your big blind by calling too much (<b>${pct(BB.vpip, BB.hands)}%</b> VPIP, <b>${pct(BB.pfr, BB.hands)}%</b> PFR). Either fold or raise — stop flatting everything.`);

        if (LP.hands >= 8 && EP.hands >= 8) {
            const lpPfr = pct(LP.pfr, LP.hands);
            const epPfr = pct(EP.pfr, EP.hands);
            if (Math.abs(lpPfr - epPfr) <= 5 && lpPfr >= 10)
                bullets.push(`You play the same way regardless of position (LP <b>${lpPfr}%</b> PFR, EP <b>${epPfr}%</b> PFR). Position is the single biggest edge in poker — start exploiting it.`);
            else if (lpPfr >= epPfr * 1.8 && lpPfr >= 15)
                bullets.push(`Good position awareness — LP PFR <b>${lpPfr}%</b> vs EP PFR <b>${epPfr}%</b>. Keep adjusting by position.`);
        }

        if (!bullets.length) return '';
        return hintCard('⊞', 'Position Awareness', `<ul class="tphud-hint-list">${bullets.map(b => `<li>${b}</li>`).join('')}</ul>`, '#1abc9c');
    }

    function buildUncontestedCard(s) {
        const ucTotal = s.ucTotalVerdicts || 0;
        if (ucTotal < 3) return '';

        const notes = [];
        const bluffWins = s.selfBluffSuccessCount || 0;
        const semiBluffs = s.selfSemiBluffCount || 0;
        const totalBluffs = bluffWins + semiBluffs;
        const valueWins = s.selfValueUncalledCount || 0;
        const cbetWins = s.ucCbetWinCount || 0;
        const stealWins = s.ucStealCount || 0;

        if (totalBluffs === 0 && ucTotal >= 5)
            notes.push(`You've won <b>${ucTotal}</b> uncontested pots but never with a bluff — opponents will learn your bets always mean something and stop paying you off. Mix in some air.`);
        else if (totalBluffs > 0 && ucTotal >= 5) {
            const bluffPct = Math.round(totalBluffs / ucTotal * 100);
            if (bluffPct > 50)
                notes.push(`<b>${bluffPct}%</b> of your uncontested wins were bluffs or semi-bluffs (${totalBluffs}/${ucTotal}) — getting away with it for now, but tighten up if opponents start adjusting.`);
            else if (bluffPct >= 20 && bluffPct <= 40)
                notes.push(`<b>${bluffPct}%</b> of uncontested wins were bluffs — solid balance between value and air.`);
        }

        if (valueWins >= 2)
            notes.push(`Opponents folded to your value bets <b>${valueWins}</b> times — you're not extracting max value. Try smaller sizing to get calls.`);

        if (cbetWins >= 3)
            notes.push(`C-bets working — <b>${cbetWins}</b> uncontested c-bet wins. Keep firing.`);

        if (stealWins >= 3 && ucTotal >= 5)
            notes.push(`Stolen preflop <b>${stealWins}</b> times — effective blind pressure.`);

        if (!notes.length) return '';
        return hintCard('⊘', 'Uncontested Wins', `<ul class="tphud-hint-list">${notes.map(n => `<li>${n}</li>`).join('')}</ul>`, '#f39c12');
    }

    function buildSelfHintHtml(s, type, m) {
        const cards = [];
        const typeKey = Object.keys(TYPES).find(k => TYPES[k] === type) || 'UNKNOWN';
        const dm = getDisplayMetrics(s);
        const vpipPct = dm ? Math.round(dm.vpip * 100) : 0;
        const pfrPct = dm ? Math.round(dm.pfr * 100) : 0;
        const afqPct = dm ? Math.round(dm.afq * 100) : 0;
        const gap = dm ? Math.round(dm.gap * 100) : 0;

        // Card 1: You Are
        const assessments = {
            MANIAC: { color: '#ff6b6b', honest: `You're in almost every hand and betting constantly. This occasionally bullies weaker players into folding, but any patient player with a real hand will stack you. You're bleeding chips on the hands you have no business being in.` },
            LAG: { color: '#ffaa55', honest: `Aggressive and involved — this can be a strong winning style when backed by real hand equity. You can accumulate chips fast, but you can spew them equally fast. The line between LAG and Maniac is discipline in hand selection.` },
            TAG: { color: '#55e87a', honest: `You're playing the most profitable style in a casual pool. Selective hand selection, aggressive when you play, hard to put on a hand. The biggest risk from here is getting bored and gradually drifting your range wider.` },
            FISH: { color: '#ff9944', honest: `You're playing far too many hands and almost never raising when you do. This is the most expensive style in poker — you're giving every opponent at the table correct odds and free information every hand. The good news: the fix is simple and the improvement will be dramatic.` },
            CALLING_STATION: { color: '#5db8f5', honest: `You enter a lot of pots but rarely raise. You're consistently calling with hands that should either fold or raise — callers fund other people's winnings. You're giving opponents correct odds to draw against you every hand.` },
            ROCK: { color: '#8899aa', honest: `You fold almost everything. Your range is so tight that everyone at the table knows exactly what you have when you play a hand. You're giving up all the small pots and only winning when you have the absolute best of it — which isn't enough to grow your stack.` },
            NIT: { color: '#4de3c4', honest: `You're playing so tight you're leaving money on the table. You avoid bad spots — but you're also never stealing blinds, never applying pressure, and every player at the table has noticed they can fold when you bet.` },
            TIGHT_PASSIVE: { color: '#e0e8ea', honest: `You play few hands and don't raise enough when you do. That combo means you win small pots and lose small pots — but your chip count doesn't grow. You're playing scared money and giving away value every session.` },
            LOOSE_PASSIVE: { color: '#d97ff0', honest: `You're playing a lot of hands but checking and calling instead of betting and raising. This is one of the most expensive styles in poker. You give better-positioned and more aggressive players free information and cheap odds to outdraw you constantly.` },
            MIXED: { color: '#f0d060', honest: `Your play doesn't have a consistent enough pattern yet — could be genuine adaptation, could be inconsistency. Keep playing and check back once there's more data.` },
            UNKNOWN: { color: '#cccccc', honest: `Not enough hands tracked yet. Keep playing and come back.` },
        };
        const assessment = assessments[typeKey] || assessments.UNKNOWN;
        cards.push(hintCard('◈', `You Are: ${resolvedType(type).label}`, assessment.honest, assessment.color));

        // Card 2: Stats Breakdown
        const statNotes = [];
        if (vpipPct > 40) {
            let note = `Your <b>VPIP is ${vpipPct}%</b> — you're entering too many pots. Aim for <b>18–30%</b>. Start folding weak suited connectors, off-suit Broadway hands below J, and any hand you're "hoping works out".`;
            const sh = s.startingHands || {};
            const worstHand = Object.entries(sh)
                .filter(([, d]) => d.dealt >= 3 && (d.won / d.dealt) < 0.30 && (d.vpip / d.dealt) > 0.60)
                .sort(([, a], [, b]) => (b.dealt - b.won) - (a.dealt - a.won))[0];
            if (worstHand) {
                const [h, d] = worstHand;
                const winPct = Math.round(d.won / d.dealt * 100);
                note += ` Your most-played losing hand is <b>${h}</b> (${d.dealt} dealt, ${winPct}% win rate) — consider dropping it.`;
            }
            statNotes.push(note);
        } else if (vpipPct < 15)
            statNotes.push(`Your <b>VPIP is ${vpipPct}%</b> — you're folding a lot. Something around <b>18–28%</b> gives you more spots to work with. Open more from the button and cutoff when action folds to you.`);
        else
            statNotes.push(`Your <b>VPIP is ${vpipPct}%</b> — solid range. Keep it there.`);

        if (pfrPct < 8 && vpipPct > 15)
            statNotes.push(`Your <b>PFR is only ${pfrPct}%</b> — you're entering pots but not raising. Limping and flat-calling gives opponents good odds and hands initiative to them. Aim for <b>14–22%</b>.`);
        else if (pfrPct >= 14 && pfrPct <= 24)
            statNotes.push(`Your <b>PFR is ${pfrPct}%</b> — good aggression preflop. You're taking initiative and defining your range.`);
        else if (pfrPct > 30)
            statNotes.push(`Your <b>PFR is ${pfrPct}%</b> — raising a lot preflop. Make sure you have hands that can handle a 3-bet or a caller who connects with the flop.`);

        if (gap > 20)
            statNotes.push(`You have a <b>${gap}% gap between VPIP and PFR</b> — you call significantly more than you raise. Passive calling is a leak. Every hand you flat-call instead of raise, you're giving up edge.`);

        if (dm && dm.afqReliable) {
            if (afqPct < 20)
                statNotes.push(`Your <b>post-flop aggression is ${afqPct}%</b> — you check and call too often. Bet your strong hands and semi-bluff draws. Passive play leaks value every session.`);
            else if (afqPct >= 35 && afqPct <= 55)
                statNotes.push(`Your <b>post-flop aggression is ${afqPct}%</b> — good balance.`);
            else if (afqPct > 60)
                statNotes.push(`Your <b>post-flop aggression is ${afqPct}%</b> — you're firing a lot. Pick opponents who actually fold.`);
        }

        if (statNotes.length > 0)
            cards.push(hintCard('▣', 'Your Stats Breakdown', `<ul class="tphud-hint-list">${statNotes.map(n => `<li>${n}</li>`).join('')}</ul>`, '#3498db'));

        // Cards 3-6: helper-driven
        cards.push(buildStartingHandCard(s));
        cards.push(buildFoldDisciplineCard(s));
        cards.push(buildTurnRiverCourageCard(s));
        cards.push(buildPositionCard(s));
        cards.push(buildUncontestedCard(s));

        // Card 7: Path to TAG / Stay Sharp
        if (typeKey !== 'TAG' && typeKey !== 'UNKNOWN' && typeKey !== 'MIXED') {
            const upgrades = [];
            const sh = s.startingHands || {};

            if (vpipPct > 32) {
                let bullet = `<b>Fold more preflop</b> — especially from early position. The earlier you act, the stronger your hand needs to be.`;
                const toBeDropped = Object.entries(sh)
                    .filter(([, d]) => d.dealt >= 3 && (d.won / d.dealt) < 0.30 && (d.vpip / d.dealt) > 0.60)
                    .sort(([, a], [, b]) => (b.dealt - b.won) - (a.dealt - a.won))
                    .slice(0, 2);
                if (toBeDropped.length > 0)
                    bullet += ` Start by dropping <b>${toBeDropped.map(([h]) => h).join('</b> and <b>')}</b> — you've played them repeatedly with poor results.`;
                upgrades.push(bullet);
            }
            if (vpipPct < 15)
                upgrades.push(`<b>Open more from late position</b> — when action folds to you on the button or cutoff, raise with any decent ace, any pair, any two broadways. Stop folding to free chips.`);
            if (pfrPct < 12 && vpipPct > 12) {
                let bullet = `<b>Raise instead of call preflop</b> — entering with a raise takes initiative, builds the pot when you're ahead, and makes your hand harder to play against.`;
                const neverRaised = Object.entries(sh)
                    .filter(([, d]) => d.dealt >= 3 && d.vpip >= 2 && d.pfr === 0)
                    .sort(([, a], [, b]) => b.dealt - a.dealt)
                    .slice(0, 2);
                if (neverRaised.length > 0)
                    bullet += ` You've played <b>${neverRaised.map(([h]) => h).join('</b> and <b>')}</b> multiple times but never raised — if a hand is worth playing, raise.`;
                upgrades.push(bullet);
            }
            if (dm && dm.afqReliable && afqPct < 25)
                upgrades.push(`<b>Bet your strong hands post-flop instead of checking</b> — top pair on a dry board, a flopped flush draw, two pair — all deserve a bet. Passive play leaks value every session.`);
            if (gap > 18)
                upgrades.push(`<b>Close the VPIP-PFR gap</b> — before calling, ask yourself "should I raise here instead?" The answer is yes more often than you think.`);

            if (upgrades.length > 0)
                cards.push(hintCard('▲', `Path to ${resolvedType(TYPES.TAG).label}`, `<ul class="tphud-hint-list">${upgrades.map(u => `<li>${u}</li>`).join('')}</ul>`, TYPES.TAG.color));
        } else if (typeKey === 'TAG') {
            const sharpNotes = [];
            const sh = s.startingHands || {};

            const drifting = Object.entries(sh)
                .filter(([, d]) => d.dealt >= 3 && (d.vpip / d.dealt) > 0.80 && (d.won / d.dealt) < 0.30)
                .sort(([, a], [, b]) => b.dealt - a.dealt)
                .slice(0, 2);
            if (drifting.length > 0)
                sharpNotes.push(`Watch out — <b>${drifting.map(([h]) => h).join('</b>, <b>')}</b> ${drifting.length > 1 ? 'are' : 'is'} creeping into your range with poor results. That's how VPIP drift starts.`);

            const epPos = (s.positions || {}).EP || { hands: 0, vpip: 0 };
            if (epPos.hands >= 8 && (epPos.vpip / epPos.hands) > 0.25)
                sharpNotes.push(`Your early position play is loosening — <b>${Math.round(epPos.vpip / epPos.hands * 100)}%</b> VPIP from EP. Tighten back up.`);

            const facedTurn = s.facedTurnBetCount || 0;
            const facedRiver = s.facedRiverBetCount || 0;
            if (facedTurn >= 5 && (s.foldedVsTurnBetCount || 0) / facedTurn > 0.60)
                sharpNotes.push(`You're folding to turn bets <b>${Math.round((s.foldedVsTurnBetCount || 0) / facedTurn * 100)}%</b> of the time — even TAG players shouldn't be this exploitable on the turn.`);
            if (facedRiver >= 5 && (s.foldedVsRiverBetCount || 0) / facedRiver > 0.65)
                sharpNotes.push(`River fold rate is <b>${Math.round((s.foldedVsRiverBetCount || 0) / facedRiver * 100)}%</b> — getting high even for a TAG. Bluffers will find this.`);

            const body = sharpNotes.length > 0
                ? `<ul class="tphud-hint-list">${sharpNotes.map(n => `<li>${n}</li>`).join('')}</ul>`
                : `Don't drift. The biggest leak for TAG players is gradually opening weaker hands out of boredom — that VPIP starts creeping up a few percent, then a few more. If the table is passive and no one fights back, you can add controlled aggression with suited connectors in position. Otherwise, stay the course.`;
            cards.push(hintCard('★', 'Stay Sharp', body, TYPES.TAG.color));
        }

        const result = cards.filter(Boolean).join('');
        return result || '<div class="tphud-dim" style="padding:10px 0">Still building your profile — play more hands to unlock all insights.</div>';
    }

    function buildHintHtml(s, isSelf, activeClass) {
        const { type, metrics } = activeClass || classify(s);
        const n = s.handsObserved;
        if (n < 5)
            return `<div class="tphud-dim" style="padding:10px 0">${isSelf
                    ? `${n || 0}/5 hands tracked so far — keep playing to unlock your full improvement profile.`
                    : 'Need at least 5 hands to generate hints.'
                }</div>`;
        if (!isSelf && !metrics)
            return '<div class="tphud-dim" style="padding:10px 0">Need at least 5 hands to generate hints.</div>';
        return isSelf
            ? buildSelfHintHtml(s, type, metrics)
            : buildOpponentHintHtml(s, type, metrics);
    }

    // ── Display helpers ──────────────────────────────────────────

    function bar(label, value, color, tooltip = '', raw = '', n = null) {
        const pct = Math.round(value * 100);
        const hw = n ? wilsonHalfWidth(value, n) : null;
        const hwPct = hw != null ? Math.round(hw * 100) : null;
        const ciStr = hwPct != null ? `<span class="tphud-ci">±${hwPct}</span>` : '';
        const ciTip = hwPct != null ? `95% confidence: ${Math.max(0, pct - hwPct)}% to ${Math.min(100, pct + hwPct)}%` : '';
        const fullTitle = [tooltip, raw, ciTip].filter(Boolean).join('\n');
        return `
            <div class="tphud-row" title="${fullTitle}">
                <span>${label}</span>
                <div class="tphud-bar"><div style="width:${pct}%;background:${color}"></div></div>
                <b>${pct}%${ciStr}</b>
            </div>`;
    }

    function buildHistoryHtml(s) {
        const hist = s.history;
        if (!hist || !hist.length)
            return '<div class="tphud-dim" style="padding:10px 0">No hands recorded yet.<br>Complete a hand to see history here.</div>';

        const hasLostTo = hist.some(e => e.lostTo);
        const toggleHtml = hasLostTo ? `
            <label class="tphud-hist-toggle">
                <input type="checkbox" id="tphud-hist-lost-to" ${histShowLostTo ? 'checked' : ''}>
                Show lost to
            </label>` : '';

        const entriesHtml = hist.map(e => {
            const outcomeClass = e.outcome.type === 'win' ? 'tphud-hout-win'
                : e.outcome.type === 'lost' ? 'tphud-hout-lost'
                    : 'tphud-hout-fold';
            const stakeLabel = e.bbAmount ? (getTableName(e.bbAmount) || Object.values(TABLE_BY_TEXTURE).find(v => v.bb === e.bbAmount)?.name || `$${e.bbAmount.toLocaleString()} BB`) : null;
            const stakeChip = stakeLabel ? `<span class="tphud-stake-chip">${stakeLabel}</span>` : '';

            const cardRow = (e.cards || e.boardCards) ? `
                <div class="tphud-hcards">
                    ${e.cards ? `
                    <div class="tphud-hcard-row">
                        <span class="tphud-hcard-label">Hand</span>
                        ${cardsHtml(e.cards)}
                        ${e.handName ? `<span class="tphud-hhand-name">${e.handName}</span>` : ''}
                        ${e.voluntaryShowed ? '<span class="tphud-hshowed">showed</span>' : ''}
                    </div>` : ''}
                    ${e.boardCards ? `
                    <div class="tphud-hcard-row tphud-hcard-board">
                        <span class="tphud-hcard-label">Board</span>
                        ${cardsHtml(e.boardCards, true)}
                    </div>` : ''}
                </div>` : '';

            // Per-street action summary with amounts and stack percentages
            const actionRow = (() => {
                const ss = e.startStack || null;
                const fmtAmt = amt => {
                    if (!ss || !amt) return `<span style="color:#ccc">$${(amt || 0).toLocaleString()}</span>`;
                    const pct = amt / ss * 100;
                    const color = pct >= 40 ? '#e74c3c' : pct >= 20 ? '#e67e22' : '#aaa';
                    const tag = pct >= 40 ? ' OB' : pct < 6 ? ' probe' : '';
                    return `<span style="color:${color}">$${amt.toLocaleString()} (${pct.toFixed(0)}%${tag})</span>`;
                };
                const streetLine = street => {
                    const d = e[street];
                    if (!d) return '';
                    const agg = (d.bets || 0) + (d.raises || 0);
                    if (agg === 0 && !d.calls && !d.checks && !d.folds) return '';
                    const parts = [];
                    (e.betAmts || []).filter(b => b.street === street && b.type === 'bet').forEach(b =>
                        parts.push(`<span style="color:#e67e22">bet</span> ${fmtAmt(b.amt)}`));
                    (e.betAmts || []).filter(b => b.street === street && b.type === 'raise').forEach(b =>
                        parts.push(`<span style="color:#e74c3c">raise</span> ${fmtAmt(b.amt)}`));
                    if (!(e.betAmts || []).some(b => b.street === street) && agg > 0) {
                        if (d.bets) parts.push(`<span style="color:#e67e22">bet×${d.bets}</span>`);
                        if (d.raises) parts.push(`<span style="color:#e74c3c">raise×${d.raises}</span>`);
                    }
                    (e.callAmts || []).filter(c => c.street === street).forEach(c =>
                        parts.push(`<span style="color:#27ae60">call</span> ${fmtAmt(c.amt)}`));
                    if (!(e.callAmts || []).some(c => c.street === street) && d.calls)
                        parts.push(`<span style="color:#27ae60">call×${d.calls}</span>`);
                    if (d.checks) parts.push(`<span style="color:#7f8c8d">chk×${d.checks}</span>`);
                    if (d.folds) parts.push(`<span style="color:#c0392b">fold</span>`);
                    const labelColor = agg > 0 ? '#e67e22' : '#888';
                    return `<span style="color:${labelColor}">${street}:</span> ${parts.join('<span style="color:#555"> · </span>')}`;
                };
                const preflopLine = (() => {
                    if (!e.preflopRaiseAmt && !e.preflopCallAmt) return '';
                    const parts = [];
                    if (e.preflopRaiseAmt)
                        parts.push(`<span style="color:#e74c3c">raise</span> ${fmtAmt(e.preflopRaiseAmt)}`);
                    if (e.preflopCallAmt)
                        parts.push(`<span style="color:#27ae60">call</span> ${fmtAmt(e.preflopCallAmt)}`);
                    return `<span style="color:#e67e22">preflop:</span> ${parts.join('<span style="color:#555"> · </span>')}`;
                })();
                const lines = [preflopLine, ...['flop', 'turn', 'river'].map(streetLine)].filter(Boolean);
                if (!lines.length) return '';
                return `<div class="tphud-hstreets">${lines.join('<span style="color:#555">  </span>')}</div>`;
            })();

            const verdictRow = (() => {
                if (!e.verdict) return '';
                const cfg = VERDICT_CONFIG[e.verdict.verdict];
                if (!cfg) return '';
                return `<div class="tphud-hverdict" style="border-left:2px solid ${cfg.color};padding-left:5px;margin-top:3px">
                    <span style="color:${cfg.color};font-size:10px;font-weight:bold">${cfg.label}</span>
                    <span style="color:#aaa;font-size:9px;display:block;margin-top:1px">${e.verdict.reason}</span>
                </div>`;
            })();

            const showRow = (() => {
                if (!e.voluntaryShowed) return '';
                const wonUncontested = e.outcome?.label?.includes('no showdown') || e.outcome?.label === 'Won uncontested';
                const weakHands = ['High Card', 'One Pair'];
                const isBluffShow = wonUncontested && e.handName && weakHands.includes(e.handName);
                const cfg = isBluffShow ? VERDICT_CONFIG.BLUFF_SHOW : VERDICT_CONFIG.VOLUNTARY_SHOW;
                if (!cfg) return '';
                const reason = isBluffShow
                    ? `Showed ${e.handName} after winning uncontested — bluff.`
                    : e.handName ? `Voluntarily showed ${e.handName}.` : 'Voluntarily showed cards.';
                return `<div class="tphud-hverdict" style="border-left:2px solid ${cfg.color};padding-left:5px;margin-top:3px">
                    <span style="color:${cfg.color};font-size:10px;font-weight:bold">${cfg.label}</span>
                    <span style="color:#aaa;font-size:9px;display:block;margin-top:1px">${reason}</span>
                </div>`;
            })();

            const selfFoldRow = (() => {
                if (!e.selfFoldVerdict) return '';
                const fv = e.selfFoldVerdict;
                const COLOR_MAP = {
                    FOLDED_STRONG: '#e74c3c',
                    FOLDED_STRONG_CORRECT: '#27ae60',
                    FOLDED_DRAW_HIT: '#e67e22',
                    FOLDED_DRAW_MISSED: '#3498db',
                    FOLDED_MARGINAL: '#f39c12',
                    FOLDED_AIR: '#7f8c8d',
                };
                const LABEL_MAP = {
                    FOLDED_STRONG: '↩ Folded strong hand',
                    FOLDED_STRONG_CORRECT: '↩ Good fold — strong hand, right call',
                    FOLDED_DRAW_HIT: '↩ Folded draw — it hit',
                    FOLDED_DRAW_MISSED: '↩ Folded draw — missed',
                    FOLDED_MARGINAL: '↩ Folded marginal hand',
                    FOLDED_AIR: '↩ Folded nothing',
                };
                const color = COLOR_MAP[fv.verdict] || '#888';
                const label = LABEL_MAP[fv.verdict] || fv.verdict;
                return `<div class="tphud-hverdict" style="border-left:2px solid ${color};padding-left:5px;margin-top:3px">
                    <span style="color:${color};font-size:10px;font-weight:bold">${label}</span>
                    <span style="color:#aaa;font-size:9px;display:block;margin-top:1px">${fv.handDesc}${fv.drawCompleted ? ' (draw completed on later street)' : ''}</span>
                </div>`;
            })();

            const lostToRow = e.lostTo ? `
                <div class="tphud-hlostto">
                    <span style="color:#666;font-size:9px">Lost to: </span>
                    ${e.lostTo.cards ? cardsHtml(e.lostTo.cards, true) : ''}
                    ${e.lostTo.handName ? `<span style="color:#888;font-size:9px;margin-left:4px">${e.lostTo.handName}</span>` : ''}
                </div>` : '';

            const dateLabel = e.ts ? (() => {
                const d = new Date(e.ts);
                return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
                    + ' ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
            })() : null;

            return `
                <div class="tphud-hentry">
                    <div class="tphud-htop">
                        <span class="tphud-haction">${e.preflopAction}</span>
                        ${dateLabel ? `<span style="color:#555;font-size:9px;margin-left:6px">${dateLabel}</span>` : ''}
                    </div>
                    ${stakeChip}
                    ${cardRow}
                    ${actionRow}
                    ${verdictRow}
                    ${showRow}
                    ${selfFoldRow}
                    ${lostToRow}
                    <div class="tphud-hout ${outcomeClass}">${e.outcome.label}</div>
                </div>`;
        }).join('');

        const containerClass = histShowLostTo ? 'tphud-hist-list tphud-show-lost-to' : 'tphud-hist-list';
        return `${toggleHtml}<div class="${containerClass}">${entriesHtml}</div>`;
    }

    // Range overview — starting hands played by self
    function buildRangeRows(hands, sortCol, sortDir, minSeen) {
        const totalDealt = Object.values(hands).reduce((sum, v) => sum + v.dealt, 0);
        let entries = Object.entries(hands).filter(([, v]) => v.dealt >= minSeen);

        entries.sort(([hA, vA], [hB, vB]) => {
            if (sortCol === 'hand') return sortDir === 'asc' ? hA.localeCompare(hB) : hB.localeCompare(hA);
            let va, vb;
            switch (sortCol) {
                case 'won': va = vA.dealt > 0 ? vA.won / vA.dealt : 0; vb = vB.dealt > 0 ? vB.won / vB.dealt : 0; break;
                case 'pfr': va = vA.dealt > 0 ? vA.pfr / vA.dealt : 0; vb = vB.dealt > 0 ? vB.pfr / vB.dealt : 0; break;
                case 'vpip': va = vA.dealt > 0 ? vA.vpip / vA.dealt : 0; vb = vB.dealt > 0 ? vB.vpip / vB.dealt : 0; break;
                default: va = vA.dealt; vb = vB.dealt;
            }
            return sortDir === 'asc' ? va - vb : vb - va;
        });

        if (!entries.length)
            return '<div class="tphud-dim" style="padding:8px 4px">No hands match the current filter.</div>';

        return entries.map(([hand, v]) => {
            const freqPct = totalDealt > 0 ? Math.round(v.dealt / totalDealt * 100) : 0;
            const vpipPct = v.dealt > 0 ? Math.round(v.vpip / v.dealt * 100) : 0;
            const winPct = v.dealt > 0 ? Math.round(v.won / v.dealt * 100) : 0;
            const pfrPct = v.dealt > 0 ? Math.round(v.pfr / v.dealt * 100) : 0;
            const freqColor = freqPct >= 8 ? '#2ecc71' : freqPct >= 4 ? '#f1c40f' : '#888';
            return `
                <div class="tphud-range-row">
                    <span class="tphud-range-hand">${canonicalHandCards(hand, true)}</span>
                    <span class="tphud-range-count">${v.dealt}×</span>
                    <span class="tphud-range-vpip" style="color:${vpipPct >= 70 ? '#2ecc71' : vpipPct >= 40 ? '#f1c40f' : '#888'}">${vpipPct}%</span>
                    <span class="tphud-range-pct" style="color:${winPct >= 50 ? '#2ecc71' : winPct >= 30 ? '#f1c40f' : '#e74c3c'}">${winPct}%</span>
                    <span class="tphud-range-pfr">${pfrPct}%</span>
                </div>`;
        }).join('');
    }

    function buildRangeHtml(s, isSelf) {
        if (isSelf) {
            const hands = s.startingHands;
            if (!hands || Object.keys(hands).length === 0)
                return '<div class="tphud-dim" style="padding:12px 0">No hand data yet.<br>Hands are recorded when you reach the flop or showdown.</div>';
            const totalDealt = Object.values(hands).reduce((sum, v) => sum + v.dealt, 0);
            const uniqueHands = Object.keys(hands).length;
            return `
                <div class="tphud-range-summary">${uniqueHands} unique hands · ${totalDealt} total recorded</div>
                <div class="tphud-range-controls">
                    <label class="tphud-range-filter-label">Min seen
                        <select class="tphud-range-filter">
                            <option value="1">Any</option>
                            <option value="2">2+</option>
                            <option value="5">5+</option>
                            <option value="10">10+</option>
                        </select>
                    </label>
                </div>
                <div class="tphud-range-header">
                    <span class="tphud-range-sort" data-col="hand">Hand</span>
                    <span class="tphud-range-sort tphud-sort-active tphud-sort-desc" data-col="dealt">Seen</span>
                    <span class="tphud-range-sort" data-col="vpip">VPIP</span>
                    <span class="tphud-range-sort" data-col="won">Won</span>
                    <span class="tphud-range-sort" data-col="pfr">PF Raise</span>
                </div>
                <div class="tphud-range-list">${buildRangeRows(hands, 'dealt', 'desc', 1)}</div>
                <div class="tphud-dim" style="font-size:10px;margin-top:8px">Hands recorded when you reach the flop or showdown. VPIP = how often you chose to play it when dealt.</div>
            `;
        }

        // Opponent — shown hands only (showdown or voluntary show)
        const hands = s.shownHands;
        if (!hands || Object.keys(hands).length === 0)
            return '<div class="tphud-dim" style="padding:12px 0">No shown hands yet.<br>Added when they reach showdown or voluntarily show.</div>';
        const uniqueHands = Object.keys(hands).length;
        const totalSeen = Object.values(hands).reduce((sum, v) => sum + v.seen, 0);
        return `
            <div class="tphud-range-summary">${uniqueHands} unique hand${uniqueHands === 1 ? '' : 's'} · ${totalSeen} shown</div>
            <div class="tphud-range-controls">
                <label class="tphud-range-filter-label">Min seen
                    <select class="tphud-range-filter-opp">
                        <option value="1">Any</option>
                        <option value="2">2+</option>
                        <option value="3">3+</option>
                    </select>
                </label>
            </div>
            <div class="tphud-range-header tphud-range-header-opp">
                <span class="tphud-range-sort" data-col="hand">Hand</span>
                <span class="tphud-range-sort tphud-sort-active tphud-sort-desc" data-col="seen">Seen</span>
                <span class="tphud-range-sort" data-col="pfr">Raised</span>
                <span class="tphud-range-sort" data-col="raisebb">Raise BB</span>
                <span class="tphud-range-sort" data-col="callbb">Call BB</span>
                <span class="tphud-range-sort" data-col="won">Won</span>
            </div>
            <div class="tphud-range-list-opp">${buildOpponentRangeRows(hands, 'seen', 'desc', 1)}</div>
            <div class="tphud-dim" style="font-size:10px;margin-top:8px">Raise BB = avg preflop raise size. Call BB = avg preflop call size when they didn't raise.</div>
        `;
    }

    function buildOpponentRangeRows(hands, sortCol, sortDir, minSeen) {
        let entries = Object.entries(hands).filter(([, v]) => v.seen >= minSeen);

        entries.sort(([hA, vA], [hB, vB]) => {
            if (sortCol === 'hand') return sortDir === 'asc' ? hA.localeCompare(hB) : hB.localeCompare(hA);
            let va, vb;
            switch (sortCol) {
                case 'pfr': va = vA.seen > 0 ? vA.pfr / vA.seen : 0; vb = vB.seen > 0 ? vB.pfr / vB.seen : 0; break;
                case 'raisebb': va = vA.pfRaiseBBsSamples > 0 ? vA.pfRaiseBBsSum / vA.pfRaiseBBsSamples : 0;
                    vb = vB.pfRaiseBBsSamples > 0 ? vB.pfRaiseBBsSum / vB.pfRaiseBBsSamples : 0; break;
                case 'callbb': va = vA.pfCallBBsSamples > 0 ? vA.pfCallBBsSum / vA.pfCallBBsSamples : 0;
                    vb = vB.pfCallBBsSamples > 0 ? vB.pfCallBBsSum / vB.pfCallBBsSamples : 0; break;
                case 'won': va = vA.seen > 0 ? vA.won / vA.seen : 0; vb = vB.seen > 0 ? vB.won / vB.seen : 0; break;
                default: va = vA.seen; vb = vB.seen;
            }
            return sortDir === 'asc' ? va - vb : vb - va;
        });

        if (!entries.length)
            return '<div class="tphud-dim" style="padding:8px 4px">No hands match the current filter.</div>';

        return entries.map(([hand, v]) => {
            const pfrPct = v.seen > 0 ? Math.round(v.pfr / v.seen * 100) : 0;
            const winPct = v.seen > 0 ? Math.round(v.won / v.seen * 100) : 0;
            const raiseBB = v.pfRaiseBBsSamples > 0 ? (v.pfRaiseBBsSum / v.pfRaiseBBsSamples).toFixed(1) + '×' : '—';
            const callBB = v.pfCallBBsSamples > 0 ? (v.pfCallBBsSum / v.pfCallBBsSamples).toFixed(1) + '×' : '—';
            return `
                <div class="tphud-range-row-opp">
                    <span class="tphud-range-hand">${canonicalHandCards(hand, true)}</span>
                    <span class="tphud-range-count">${v.seen}×</span>
                    <span class="tphud-range-pfr" style="color:${pfrPct >= 70 ? '#e74c3c' : pfrPct >= 40 ? '#f1c40f' : '#888'}">${pfrPct}%</span>
                    <span class="tphud-range-bb">${raiseBB}</span>
                    <span class="tphud-range-bb">${callBB}</span>
                    <span class="tphud-range-pct" style="color:${winPct >= 50 ? '#2ecc71' : winPct >= 30 ? '#f1c40f' : '#e74c3c'}">${winPct}%</span>
                </div>`;
        }).join('');
    }

    // Renders a compact EP/MP/LP/SB/BB breakdown table with VPIP and PFR per position.
    // Only shows rows where hands > 0. Returns '' if no positional data tracked.
    function buildPositionalTable(stats) {
        if (!stats?.positions) return '';
        const order = ['EP', 'MP', 'LP', 'SB', 'BB'];
        const rows = order
            .map(k => ({ pos: k, ...stats.positions[k] }))
            .filter(r => r.hands > 0);
        if (!rows.length) return '';
        const rowsHtml = rows.map(r => {
            const vpip = (r.vpip / r.hands) * 100;
            const pfr = (r.pfr / r.hands) * 100;
            return `
                <div class="tphud-pos-row">
                    <span class="tphud-pos-name">${r.pos}</span>
                    <span class="tphud-pos-hands">${r.hands}h</span>
                    <span class="tphud-pos-stat">${vpip.toFixed(0)}%</span>
                    <span class="tphud-pos-stat">${pfr.toFixed(0)}%</span>
                </div>`;
        }).join('');
        return `
            <div class="tphud-pos-table">
                <div class="tphud-pos-row tphud-pos-hdr">
                    <span class="tphud-pos-name">Pos</span>
                    <span class="tphud-pos-hands">Hands</span>
                    <span class="tphud-pos-stat">VPIP</span>
                    <span class="tphud-pos-stat">PFR</span>
                </div>
                ${rowsHtml}
            </div>`;
    }

    function buildTablesHtml(s) {
        const byTable = s.byTable || {};
        const entries = Object.entries(byTable)
            .map(([bb, t]) => ({ bb: Number(bb), t }))
            .sort((a, b) => b.t.handsObserved - a.t.handsObserved);

        if (!entries.length)
            return '<div class="tphud-dim" style="padding:10px 0">No per-table data yet. Play some hands — table reads build up automatically.</div>';

        const lifetimeCls = classify(s);
        const lifetimeDm = getDisplayMetrics(s);
        const lifetimeRow = `
            <div class="tphud-tbl-entry tphud-tbl-lifetime">
                <div class="tphud-tbl-top">
                    <span class="tphud-tbl-name">Lifetime (all tables)</span>
                    <span class="tphud-tbl-hands">${s.handsObserved} hands</span>
                </div>
                <div class="tphud-tbl-meta">
                    <span style="color:${lifetimeCls.type.color};font-weight:bold">${resolvedType(lifetimeCls.type).label}</span>
                </div>
                ${lifetimeDm ? `<div class="tphud-bars tphud-tbl-bars">
                    ${bar(statLbl('vpip'), lifetimeDm.vpip, '#2ecc71', '', `${s.vpipCount || 0} / ${s.handsObserved || 0} hands`, s.handsObserved || 0)}
                    ${bar(statLbl('pfr'), lifetimeDm.pfr, '#e74c3c', '', `${s.pfrCount || 0} / ${s.handsObserved || 0} hands`, s.handsObserved || 0)}
                    ${bar(statLbl('afq'), lifetimeDm.afq, '#e67e22', '', `${(s.postBets || 0) + (s.postRaises || 0)} aggressive / ${((s.postBets || 0) + (s.postRaises || 0) + (s.postCalls || 0) + (s.postFolds || 0))} counted actions`, (s.postBets || 0) + (s.postRaises || 0) + (s.postCalls || 0) + (s.postFolds || 0))}
                </div>${buildPositionalTable(s)}` : ''}
            </div>`;

        return entries.map(({ bb, t }) => {
            const tname = Object.values(TABLE_BY_TEXTURE).find(v => v.bb === bb)?.name || getTableName(bb) || `$${bb.toLocaleString()} BB`;
            const tier = getStakeTier(bb);
            const m = computeMetricsForTable(s, bb);
            const dm = getDisplayMetrics(t);
            const cls = m ? classifyMetrics(m, t.handsObserved) : null;
            const isCurrent = currentTableBB === bb;

            const labelHtml = (cls && cls.type !== TYPES.UNKNOWN)
                ? `<span style="color:${cls.type.color};font-weight:bold">${resolvedType(cls.type).label}</span>`
                : `<span style="color:#444">Need more hands</span>`;

            return `
                <div class="tphud-tbl-entry${isCurrent ? ' tphud-tbl-current' : ''}">
                    <div class="tphud-tbl-top">
                        <span class="tphud-tbl-name">${tname}${isCurrent ? ' <span class="tphud-tbl-here">here</span>' : ''}</span>
                        <span class="tphud-tbl-hands">${t.handsObserved} hands</span>
                    </div>
                    <div class="tphud-tbl-meta">
                        ${labelHtml}
                        ${tier ? `<span class="tphud-tbl-tier">${tier}</span>` : ''}
                    </div>
                    ${dm ? `<div class="tphud-bars tphud-tbl-bars">
                        ${bar('Plays hands', dm.vpip, '#2ecc71', 'Voluntarily enters the pot preflop. BB checks (free looks) are not counted.', `${t.vpipCount || 0} / ${t.handsObserved || 0} hands`)}
                        ${bar('Raises preflop', dm.pfr, '#e74c3c', 'How often they raise before the flop', `${t.pfrCount || 0} / ${t.handsObserved || 0} hands`)}
                        ${t.limpCount > 0 ? bar('Limps in', dm.limpPct, '#f39c12', 'Calls preflop without raising', `${t.limpCount || 0} / ${t.handsObserved || 0} hands`) : ''}
                        ${dm.threeBetPct != null ? bar('3-bets', dm.threeBetPct, '#e74c3c', 'Re-raises preflop when facing a raise', `${t.threeBetCount || 0} / ${t.threeBetOpportunities || 0} opportunities`) : ''}
                        ${dm.squeezePct != null ? bar('Squeezes', dm.squeezePct, '#e74c3c', 'Subset of 3-bets — re-raises specifically when a caller has flatted the open. High = punishes flatters.', `${t.squeezeCount || 0} / ${t.threeBetOpportunities || 0} 3-bet opps`) : ''}
                        ${bar('Bets/raises post', dm.afq, '#e67e22', 'How aggressively they play after the flop', `${(t.postBets || 0) + (t.postRaises || 0)} aggressive / ${((t.postBets || 0) + (t.postRaises || 0) + (t.postCalls || 0) + (t.postFolds || 0))} counted actions`)}
                        ${dm.foldVsFlopBet != null ? bar('Folds to flop bet', dm.foldVsFlopBet, '#3498db', 'Folds when bet into on the flop', `${t.foldedVsFlopBetCount || 0} / ${t.facedFlopBetCount || 0} opportunities`) : ''}
                        ${dm.cbetFlop != null ? bar('C-bets flop', dm.cbetFlop, '#e74c3c', 'Bets the flop after raising preflop', `${t.cbetFlopMade || 0} / ${t.cbetFlopOpps || 0} opportunities`) : ''}
                        ${dm.foldToCbet != null ? bar('Folds to c-bet', dm.foldToCbet, '#3498db', 'Folds when the preflop raiser c-bets the flop', `${t.foldToCbetFlopFolded || 0} / ${t.foldToCbetFlopOpps || 0} opportunities`) : ''}
                        ${dm.donkFlop != null ? bar('Donk-bets flop', dm.donkFlop, '#f39c12', 'Bets into the preflop raiser on the flop after just calling preflop. High = leads with made hands or draws.', `${t.donkFlopMade || 0} / ${t.donkFlopOpps || 0} opportunities`) : ''}
                        ${dm.crFlop != null ? bar('Check-raises flop', dm.crFlop, '#9b59b6', 'How often they check-raise the flop (rate over flops seen). Higher = trickier postflop player; very high = likely traps.', `${t.crFlopCount || 0} / ${t.sawFlopCount || 0} flops seen`) : ''}
                        ${dm.postFoldPct != null ? bar('Folds post-flop', dm.postFoldPct, '#7f8c8d', 'How often they fold to any post-flop action', `${t.postFolds || 0} / ${((t.postFolds || 0) + (t.postCalls || 0) + (t.postBets || 0) + (t.postRaises || 0) + (t.postChecks || 0))} actions`) : ''}
                        ${t.sawFlopCount > 0 ? bar('Stays till showdown', dm.wtsd, '#3498db', 'How often they stay in until showdown', `${t.wentToShowdownCount || 0} / ${t.sawFlopCount || 0} flops seen`) : ''}
                        ${t.wentToShowdownCount > 0 ? bar('Wins showdowns', dm.wsd, '#9b59b6', 'How often they win when they reach showdown', `${t.wonAtShowdownCount || 0} / ${t.wentToShowdownCount || 0} showdowns`) : ''}
                        ${dm.wwsf != null ? bar('Wins after seeing flop', dm.wwsf, '#16a085', 'Wins (showdown or uncontested) when they see the flop. Aggressive winners run higher; passive callers run lower despite high WSD.', `${t.wonAfterSawFlopCount || 0} / ${t.sawFlopCount || 0} flops seen`) : ''}
                    </div>${buildPositionalTable(t)}` : ''}
                </div>`;
        }).join('') + lifetimeRow;
    }

    // ── Main panel ───────────────────────────────────────────────

    function openPanel(name, numericId) {
        closePanel();
        activePanelPlayer = { name, numericId };
        const openKey = numericId || name;
        if (sideStatsEls[openKey]) sideStatsEls[openKey].style.display = 'none';

        const all = getStats();
        const s = resolveStatsByName(name, all);
        if (!s) return;
        const displayName = s.displayName || name;

        const lifetime = classify(s);
        const tableRead = currentTableBB
            ? classifyMetrics(computeMetricsForTable(s, currentTableBB), s.byTable?.[currentTableBB]?.handsObserved || 0)
            : null;
        const activeStats = getActiveStats(s, currentTableBB);
        const usingTable = activeStats !== s;

        const active = usingTable ? tableRead : lifetime;
        const { type, confLabel } = active;
        const metrics = computeMetrics(activeStats);
        const dm = getDisplayMetrics(activeStats);
        const tableHandCount = s.byTable?.[currentTableBB]?.handsObserved || 0;
        const tableName = currentTableName || (currentStakeTier ? `${currentStakeTier} stakes` : `$${currentTableBB?.toLocaleString()} BB`);
        const readSource = usingTable ? `${tableName} — ${tableHandCount} hands` : `Lifetime — ${s.handsObserved} hands`;
        const secondary = getSecondaryTags(activeStats);
        const seatId = nameToSeatId[name];
        const notes = seatId ? (loadNotes()[seatId] || { tags: [], text: '' }) : { tags: [], text: '' };
        const panelSeatId = nameToSeatId[name];
        const panelLs = panelSeatId ? liveStacks[panelSeatId] : null;

        // Session classification
        const session = classifySession(s);
        const sessionDiffers = session && session.type !== TYPES.UNKNOWN && session.type !== active.type;

        // Multi-factor subtext for stats section
        const subtextLine = (() => {
            if (!dm) return '';
            const vpipPct = Math.round(dm.vpip * 100);
            const pfrPct = Math.round(dm.pfr * 100);
            const gapPct = Math.round(dm.gap * 100);
            const afqPct = dm.afqReliable ? Math.round(dm.afq * 100) : null;
            const parts = [];

            if (vpipPct >= 50) parts.push('plays very loosely pre-flop');
            else if (vpipPct >= 30) parts.push('plays a wide pre-flop range');
            else if (vpipPct >= 18) parts.push('selective pre-flop');
            else parts.push('very tight pre-flop');

            if (gapPct >= 25) parts.push('prefers calling over raising');
            else if (pfrPct >= 20) parts.push('raises most hands they enter');
            else if (pfrPct >= 10) parts.push('mixes raises and calls');
            else parts.push('rarely raises pre-flop');

            if (afqPct !== null) {
                if (afqPct >= 50) parts.push('fires aggressively post-flop');
                else if (afqPct >= 30) parts.push('moderately active post-flop');
                else parts.push('passive after the flop');
            }

            return parts.join(' · ');
        })();

        const panel = document.createElement('div');
        panel.id = 'tphud-panel';
        panel.className = 'tphud-panel';

        const activeAlerts = getLiveAlerts(activeStats);
        let trendHtml = isHeadsUp
            ? `<div class="tphud-trend" style="border-color:#f39c1240;color:#f39c12;background:#f39c1218">⚠ Heads-up mode — stats paused, reads from this table don't apply</div>`
            : activeAlerts.length > 0
                ? activeAlerts.map(a => `<div class="tphud-trend" style="border-color:${a.color}40;color:${a.color};background:${a.color}18">⚠ ${a.label}</div>`).join('')
                : '';


        const needMore = 5 - activeStats.handsObserved;
        const metricsHtml = dm ? `
            <div class="tphud-sec">Stats — ${readSource}</div>
            <div class="tphud-bars">
                ${bar(statLbl('vpip'), dm.vpip, '#2ecc71', 'Voluntarily enters the pot preflop. BB checks (free looks) are not counted.', `${activeStats.vpipCount || 0} / ${activeStats.handsObserved || 0} hands`, activeStats.handsObserved || 0)}
                ${bar(statLbl('pfr'), dm.pfr, '#e74c3c', 'How often they raise before the flop', `${activeStats.pfrCount || 0} / ${activeStats.handsObserved || 0} hands`, activeStats.handsObserved || 0)}
                ${(activeStats.limpCount || 0) > 0 ? bar(statLbl('limp'), dm.limpPct, '#f39c12', 'Calls preflop without raising — passive entry, easy to exploit', `${activeStats.limpCount || 0} / ${activeStats.handsObserved || 0} hands`) : ''}
                ${dm.threeBetPct != null ? bar(statLbl('threeBet'), dm.threeBetPct, '#e74c3c', 'Re-raises preflop when facing a raise — low means they fold to pressure', `${activeStats.threeBetCount || 0} / ${activeStats.threeBetOpportunities || 0} opportunities`, activeStats.threeBetOpportunities || 0) : ''}
                ${dm.foldTo3BetPct != null ? bar(statLbl('foldTo3Bet'), dm.foldTo3BetPct, '#9b59b6', 'How often they fold their open raise when facing a 3-bet — high means easy to squeeze', `${activeStats.foldTo3BetCount || 0} / ${activeStats.foldTo3BetOpportunities || 0} opportunities`, activeStats.foldTo3BetOpportunities || 0) : ''}
                ${dm.squeezePct != null ? bar('Squeezes', dm.squeezePct, '#e74c3c', 'How often they 3-bet specifically when there is already a caller on the open raise. High means they punish flatters.', `${activeStats.squeezeCount || 0} / ${activeStats.threeBetOpportunities || 0} 3-bet opps`) : ''}
                ${bar(statLbl('afq'), dm.afq, '#e67e22', 'How aggressively they play after the flop', `${(activeStats.postBets || 0) + (activeStats.postRaises || 0)} aggressive / ${((activeStats.postBets || 0) + (activeStats.postRaises || 0) + (activeStats.postCalls || 0) + (activeStats.postFolds || 0))} counted actions`, (activeStats.postBets || 0) + (activeStats.postRaises || 0) + (activeStats.postCalls || 0) + (activeStats.postFolds || 0))}
                ${dm.cbetFlop != null ? bar('C-bets flop', dm.cbetFlop, '#e74c3c', 'Bets the flop after raising preflop. High = c-bets a lot, low = often slowplays/checks.', `${activeStats.cbetFlopMade || 0} / ${activeStats.cbetFlopOpps || 0} opportunities`) : ''}
                ${dm.foldVsFlopBet != null ? bar(statLbl('foldVsCbet'), dm.foldVsFlopBet, '#3498db', 'Folds when bet into on the flop — high means c-bet freely', `${activeStats.foldedVsFlopBetCount || 0} / ${activeStats.facedFlopBetCount || 0} opportunities`, activeStats.facedFlopBetCount || 0) : ''}
                ${dm.foldToCbet != null ? bar('Folds to c-bet', dm.foldToCbet, '#3498db', 'Folds specifically when the preflop raiser c-bets the flop (stricter than the general "Fold vs CBet" above).', `${activeStats.foldToCbetFlopFolded || 0} / ${activeStats.foldToCbetFlopOpps || 0} opportunities`) : ''}
                ${dm.donkFlop != null ? bar('Donk-bets flop', dm.donkFlop, '#f39c12', 'Bets into the preflop raiser on the flop after just calling preflop. High = leads with made hands or draws.', `${activeStats.donkFlopMade || 0} / ${activeStats.donkFlopOpps || 0} opportunities`) : ''}
                ${dm.crFlop != null ? bar('Check-raises flop', dm.crFlop, '#9b59b6', 'How often they check-raise the flop (rate over flops seen). Higher = trickier postflop player; very high = likely traps.', `${activeStats.crFlopCount || 0} / ${activeStats.sawFlopCount || 0} flops seen`) : ''}
                ${dm.postFoldPct != null ? bar(statLbl('postFold'), dm.postFoldPct, '#7f8c8d', 'How often they fold when faced with any post-flop action', `${activeStats.postFolds || 0} / ${((activeStats.postFolds || 0) + (activeStats.postCalls || 0) + (activeStats.postBets || 0) + (activeStats.postRaises || 0) + (activeStats.postChecks || 0))} actions`) : ''}
                ${activeStats.sawFlopCount > 0 ? bar(statLbl('wtsd'), dm.wtsd, '#3498db', 'How often they stay in until showdown', `${activeStats.wentToShowdownCount || 0} / ${activeStats.sawFlopCount || 0} flops seen`, activeStats.sawFlopCount || 0) : ''}
                ${activeStats.wentToShowdownCount > 0 ? bar(statLbl('wsd'), dm.wsd, '#9b59b6', 'How often they win when they reach showdown', `${activeStats.wonAtShowdownCount || 0} / ${activeStats.wentToShowdownCount || 0} showdowns`, activeStats.wentToShowdownCount || 0) : ''}
                ${dm.wwsf != null ? bar('Wins after seeing flop', dm.wwsf, '#16a085', 'Wins (showdown or uncontested) when they see the flop. Aggressive winners run higher; passive callers run lower despite high WSD.', `${activeStats.wonAfterSawFlopCount || 0} / ${activeStats.sawFlopCount || 0} flops seen`) : ''}
                ${dm.avgRaisePct != null && activeStats.raisePctSamples >= 3 ? bar(statLbl('avgRaise'), dm.avgRaisePct / 100, '#e74c3c', 'Average raise as % of their stack — high means they commit real money when they raise', `avg ${dm.avgRaisePct.toFixed(1)}% of stack over ${activeStats.raisePctSamples} raises`) : ''}
                ${dm.avgCallPct != null && activeStats.callPctSamples >= 3 ? bar(statLbl('avgCall'), dm.avgCallPct / 100, '#3498db', 'Average call as % of their stack — high means they pot-commit when they call', `avg ${dm.avgCallPct.toFixed(1)}% of stack over ${activeStats.callPctSamples} calls`) : ''}
            </div>
            ${buildPositionalTable(activeStats)}
            <div class="tphud-subtext">${subtextLine}</div>
        ` : `<div class="tphud-dim">Need ${needMore} more hand${needMore === 1 ? '' : 's'} to start profiling.</div>`;

        const shownWeak = (activeStats.shownWeak ?? activeStats.showdownWeak ?? 0);
        const shownStrong = (activeStats.shownStrong ?? activeStats.showdownStrong ?? 0);
        const shownTotal = shownWeak + shownStrong;
        const sdHtml = shownTotal > 0 ? `
            <div class="tphud-sec">Shown hands — ${shownTotal} total</div>
            <div class="tphud-showdown">
                <span class="tphud-sd-stat">Weak shown: ${shownWeak}</span>
                <span class="tphud-sd-stat">Strong shown: ${shownStrong}</span>
                ${activeStats.wentToShowdownCount > 0 ? `<span class="tphud-sd-stat" style="color:#555">Showdowns: ${activeStats.wentToShowdownCount}</span>` : ''}
                ${activeStats.voluntaryShowAfterWin > 0 ? `<span class="tphud-sd-stat" style="color:#9b59b6">Show-after-win: ${activeStats.voluntaryShowAfterWin}</span>` : ''}
            </div>` : '';

        const cardProfileHtml = (() => {
            const tv = activeStats.totalVerdicts || 0;
            if (tv < 5) return '';
            const bluffRate = (activeStats.bluffCount || 0) / tv;
            const thinRate = (activeStats.thinValueCount || 0) / tv;
            const valueRate = (activeStats.valuePlayCount || 0) / tv;
            const drawRate = (activeStats.drawCount || 0) / tv;
            const strongRate = (activeStats.strongValueCount || 0) / tv;
            const thinWinRate = (activeStats.thinWinCount || 0) / tv;
            const trapRate = (activeStats.trapCount || 0) / tv;
            return `
                <div class="tphud-sec">Card Profile — ${tv} verdicts</div>
                <div class="tphud-bars">
                    <div class="tphud-tip-dim" style="margin-bottom:3px">Losses / aggression</div>
                    ${bar('Bluff', bluffRate, '#e74c3c', 'CLEAR_BLUFF + BLUFF_WET — bet with air', `${activeStats.bluffCount || 0} / ${tv}`)}
                    ${bar('Thin Value', thinRate, '#e67e22', 'THIN_VALUE — overplayed marginal hands', `${activeStats.thinValueCount || 0} / ${tv}`)}
                    ${bar('Protection', (activeStats.protectionCount || 0) / tv, '#1abc9c', 'PROTECTION — bet for protection on wet board, aware of texture', `${activeStats.protectionCount || 0} / ${tv}`)}
                    ${bar('Value Loss', Math.max(0, valueRate - (activeStats.protectionCount || 0) / tv), '#27ae60', 'VALUE_LOSS + OUTPLAYED — had a real hand, ran into better', `${(activeStats.valuePlayCount || 0) - (activeStats.protectionCount || 0)} / ${tv}`)}
                    ${bar('Draws', drawRate, '#3498db', 'DRAW_MADE + DRAW_MISS — hit or missed a draw at showdown', `${activeStats.drawCount || 0} / ${tv} (${(activeStats.drawCount || 0) - (activeStats.drawMissCount || 0)} hit, ${activeStats.drawMissCount || 0} missed)`)}
                    <div class="tphud-tip-dim" style="margin:5px 0 3px">Wins</div>
                    ${bar('Strong Win', strongRate, '#2ecc71', 'STRONG_VALUE — won with two pair or better', `${activeStats.strongValueCount || 0} / ${tv}`)}
                    ${bar('Thin Win', thinWinRate, '#f1c40f', 'THIN_WIN — committed chips with a pair and won', `${activeStats.thinWinCount || 0} / ${tv}`)}
                    ${bar('Trap', trapRate, '#9b59b6', 'TRAP — slow-played strong hand, never bet', `${activeStats.trapCount || 0} / ${tv}`)}
                </div>`;
        })();

        const isSelf = name === localPlayerName;
        const panelStack = panelLs?.stack ?? null;
        const panelPeak = panelLs?.peakStack ?? null;
        const panelRebuys = panelLs?.rebuys ?? 0;
        const panelStackBBv = panelStack && currentTableBB ? Math.round(panelStack / currentTableBB) : null;
        const panelPeakBBv = panelPeak && currentTableBB ? Math.round(panelPeak / currentTableBB) : null;
        const isShortStacked = panelStackBBv !== null && panelStackBBv < 20;

        const sessionDetailHtml = panelLs ? (() => {
            const playtime = panelLs.firstSeen ? fmtDuration(Date.now() - panelLs.firstSeen) : '—';
            const profit = (panelLs.startStack != null && panelStack != null) ? (panelStack - panelLs.startStack) : null;
            const profitLabel = profit == null
                ? '—'
                : (profit >= 0 ? `+${fmtStack(profit)}` : `-${fmtStack(Math.abs(profit))}`);
            const profitClass = profit == null ? '' : (profit >= 0 ? 'tphud-profit-pos' : 'tphud-profit-neg');
            return `
                <div class="tphud-detail-box">
                    <div class="tphud-detail-item">
                        <div class="tphud-detail-label">Playtime</div>
                        <div class="tphud-detail-value">${playtime}</div>
                    </div>
                    <div class="tphud-detail-item">
                        <div class="tphud-detail-label">Profit</div>
                        <div class="tphud-detail-value ${profitClass}">${profitLabel}</div>
                    </div>
                </div>`;
        })() : '';

        const stackLossTag = (() => {
            if (!panelLs?.peakStack || panelLs.stack == null || panelLs.peakStack <= 0) return [];
            const lostPct = (panelLs.peakStack - panelLs.stack) / panelLs.peakStack * 100;
            if (lostPct >= 50) return [{ label: `▼ Down ${Math.round(lostPct)}% from peak — high tilt risk`, color: '#e74c3c' }];
            if (lostPct >= 35) return [{ label: `▽ Down ${Math.round(lostPct)}% from peak — watch aggression`, color: '#e67e22' }];
            return [];
        })();
        const rebuyTag = panelRebuys > 0
            ? [{ label: `Rebought ${panelRebuys}× — watch for tilt`, color: '#f90' }]
            : [];
        const filteredSecondary = isShortStacked
            ? secondary.filter(t => !t.label.startsWith('High-commit') && !t.label.startsWith('Probe bettor') && !t.label.startsWith('Commits big'))
            : secondary;
        const allSecondary = [...stackLossTag, ...rebuyTag, ...filteredSecondary];

        const peakStackHtml = panelPeak ? (() => {
            const peakStr = fmtStack(panelPeak) + (panelPeakBBv !== null ? ` (${panelPeakBBv} BB)` : '');
            const currentStr = panelStack !== null
                ? fmtStack(panelStack) + (panelStackBBv !== null ? ` (${panelStackBBv} BB)` : '')
                : null;
            return `
                <div class="tphud-sec">Stack — this session</div>
                <div class="tphud-showdown">
                    <span class="tphud-sd-stat">Peak: ${peakStr}</span>
                    ${currentStr ? `<span class="tphud-sd-stat">Now: ${currentStr}</span>` : ''}
                    ${panelRebuys > 0 ? `<span class="tphud-sd-stat" style="color:#f90">Rebuys: ${panelRebuys}×</span>` : ''}
                </div>`;
        })() : '';

        const secondaryHtml = allSecondary.length > 0 ? `
            <div class="tphud-sec">Additional Reads</div>
            <div class="tphud-secondary">
                ${allSecondary.map(t => `<span class="tphud-stag" style="color:${t.color};border-color:${t.color}">${t.label}</span>`).join('')}
            </div>` : '';

        const notesHtml = (notes.tags.length > 0 || notes.text) ? `
            <div class="tphud-sec">Manual Notes</div>
            <div class="tphud-notes">
                ${notes.tags.map(t => `<span class="tphud-ntag">${t}</span>`).join('')}
                ${notes.text ? `<p class="tphud-ntext">${notes.text}</p>` : ''}
            </div>` : '';

        const autoTagList = s.autoTags || [];
        const autoTagsHtml = autoTagList.length > 0 ? `
            <div class="tphud-sec">Auto-Tagged Plays</div>
            <div class="tphud-autotags">
                ${autoTagList.map(t => `<div class="tphud-autotag">${escHtml(t)}</div>`).join('')}
            </div>` : '';

        panel.innerHTML = `
            <div class="tphud-header">
                <div>
                    <h3 class="tphud-name">
                        ${isSelf ? '<span class="tphud-self-tag">YOU</span>' : ''}${escHtml(displayName)}
                    </h3>
                    <div class="tphud-chips">
                        <span class="tphud-chip" style="color:${lifetime.type.color};border-color:${lifetime.type.color};background:${lifetime.type.bg}" title="${lifetime.type.desc}">${resolvedType(lifetime.type).short} <span class="tphud-chip-label">Lifetime</span></span>
                        <span class="tphud-chip" style="color:${session && session.type !== TYPES.UNKNOWN ? session.type.color : '#666'};border-color:${session && session.type !== TYPES.UNKNOWN ? session.type.color : '#444'};background:${session && session.type !== TYPES.UNKNOWN ? session.type.bg : 'rgba(40,40,40,0.8)'}" title="${session && session.type !== TYPES.UNKNOWN ? session.type.desc : 'Not enough recent hands'}">${session && session.type !== TYPES.UNKNOWN ? resolvedType(session.type).short : '?'} <span class="tphud-chip-label">Last ${hudSettings.sessionWindow}</span></span>
                    </div>
                    <div class="tphud-read-source">${readSource}</div>
                    <div class="tphud-typedesc"><span style="color:${session && session.type !== TYPES.UNKNOWN ? session.type.color : lifetime.type.color};font-weight:bold">${session && session.type !== TYPES.UNKNOWN ? resolvedType(session.type).label : resolvedType(lifetime.type).label}:</span> ${session && session.type !== TYPES.UNKNOWN ? session.type.desc : lifetime.type.desc}</div>
                    ${panelStackBBv !== null && panelStackBBv < 20
                ? '<div style="color:#e67e22;font-size:10px;margin-top:4px">⚠ Short-stacked — stats reflect push/fold play, not normal range</div>'
                : ''}
                </div>
                <div class="tphud-header-btns">
                    <button class="tphud-hh-open" title="Hand History">HH</button>
                    <button class="tphud-lb-open" title="Player Leaderboard">LB</button>
                    <button class="tphud-help" title="Glossary / Help">?</button>
                    <button class="tphud-gift" title="Support the creator">🎁</button>
                    <button class="tphud-settings" title="HUD Settings">⚙</button>
                    <button class="tphud-close">&times;</button>
                </div>
            </div>
            <div class="tphud-tabs">
                <button class="tphud-tab tphud-tab-active" data-tab="stats">Stats</button>
                <button class="tphud-tab tphud-tab-hints" data-tab="hints">${isSelf ? 'Improve' : 'Hints'}</button>
                <button class="tphud-tab" data-tab="why">Profile</button>
                <button class="tphud-tab" data-tab="tables">Tables</button>
                <button class="tphud-tab" data-tab="history">${usingTable ? 'History *' : 'History'}</button>
                <button class="tphud-tab" data-tab="range">Range</button>
            </div>
            <div class="tphud-tabpane" id="tphud-pane-stats">
                ${trendHtml}
                ${sessionDetailHtml}
                ${metricsHtml}
                ${sdHtml}
                ${cardProfileHtml}
                ${peakStackHtml}
                ${secondaryHtml}
                ${notesHtml}
            </div>
            <div class="tphud-tabpane tphud-hidden" id="tphud-pane-hints">
                ${buildHintHtml(activeStats, isSelf, session && session.type !== TYPES.UNKNOWN ? session : active)}
            </div>
            <div class="tphud-tabpane tphud-hidden" id="tphud-pane-why">
                ${buildReasonHtml(activeStats, active)}
            </div>
            <div class="tphud-tabpane tphud-hidden" id="tphud-pane-tables">
                ${buildTablesHtml(s)}
            </div>
            <div class="tphud-tabpane tphud-hidden" id="tphud-pane-history">
                ${usingTable ? '<div class="tphud-dim" style="margin-bottom:8px">* History filtered to current table only</div>' : ''}
                ${buildHistoryHtml(activeStats)}
            </div>
            <div class="tphud-tabpane tphud-hidden" id="tphud-pane-range">${buildRangeHtml(s, isSelf)}</div>
            <div class="tphud-reset-row">
                <button class="tphud-reset">Reset ${escHtml(displayName)}</button>
                <button class="tphud-reset-all">Reset All Players</button>
            </div>
        `;

        document.body.appendChild(panel);
        // Preserve CSS centering (translate(-50%,-50%)) while adding scale; origin stays at center
        panel.style.transform = `translate(-50%, -50%) scale(${hudSettings.hudScalePanels})`;
        makeDraggable(panel);

        // Toggle "show lost to" without inline handlers
        panel.addEventListener('change', e => {
            if (e.target.id === 'tphud-hist-lost-to') {
                histShowLostTo = e.target.checked;
                const list = panel.querySelector('.tphud-hist-list');
                if (list) list.classList.toggle('tphud-show-lost-to', e.target.checked);
            }
        });

        panel.querySelector('.tphud-close').addEventListener('click', closePanel);
        panel.querySelector('.tphud-hh-open').addEventListener('click', e => { e.stopPropagation(); showHandHistoryModal(); });
        panel.querySelector('.tphud-lb-open').addEventListener('click', e => { e.stopPropagation(); showLeaderboardModal(); });
        panel.querySelector('.tphud-help').addEventListener('click', e => { e.stopPropagation(); showHelpModal(); });
        panel.querySelector('.tphud-gift').addEventListener('click', e => { e.stopPropagation(); showDonateModal(); });
        panel.querySelector('.tphud-settings').addEventListener('click', e => { e.stopPropagation(); showSettingsModal(); });
        panel.querySelector('.tphud-reset').addEventListener('click', () => {
            const all = getStats();
            if (numericId && all[numericId]) delete all[numericId];
            delete all[name];
            markStatsDirty();
            const badgeKey = numericId || name;
            if (badges[badgeKey]) {
                const b = badges[badgeKey];
                b.innerHTML = '<span style="color:#444">?</span>';
                b.style.borderColor = '#333';
                b.style.background = 'rgba(0,0,0,0.3)';
                b.title = 'No data yet';
            }
            closePanel();
        });
        panel.querySelector('.tphud-reset-all').addEventListener('click', () => {
            const count = Object.keys(getStats()).length;
            if (!window.confirm(`Reset ALL stats? This will delete records for ${count} player${count === 1 ? '' : 's'} and cannot be undone.`)) return;
            statsCache = {};
            markStatsDirty();
            currentTableBB = null;
            currentTableName = null;
            currentStakeTier = null;
            currentTextureKey = null;
            currentHand = null;
            document.querySelectorAll('[id^="player-"]').forEach(seat => {
                delete seat.dataset.hudBoundName;
                delete seat.dataset.hudName;
            });
            refreshAllBadges();
            closePanel();
        });

        panel.querySelectorAll('.tphud-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                panel.querySelectorAll('.tphud-tab').forEach(t => t.classList.remove('tphud-tab-active'));
                panel.querySelectorAll('.tphud-tabpane').forEach(p => p.classList.add('tphud-hidden'));
                tab.classList.add('tphud-tab-active');
                panel.querySelector(`#tphud-pane-${tab.dataset.tab}`).classList.remove('tphud-hidden');
            });
        });

        // Range tab — sort and filter handlers
        const rangePane = panel.querySelector('#tphud-pane-range');
        if (rangePane) {
            if (isSelf) {
                const rangeState = { col: 'dealt', dir: 'desc', min: 1 };

                function refreshRangeList() {
                    const list = rangePane.querySelector('.tphud-range-list');
                    if (!list) return;
                    list.innerHTML = buildRangeRows(s.startingHands || {}, rangeState.col, rangeState.dir, rangeState.min);
                    rangePane.querySelectorAll('.tphud-range-sort').forEach(el => {
                        const isActive = el.dataset.col === rangeState.col;
                        el.classList.toggle('tphud-sort-active', isActive);
                        el.classList.toggle('tphud-sort-desc', isActive && rangeState.dir === 'desc');
                        el.classList.toggle('tphud-sort-asc', isActive && rangeState.dir === 'asc');
                    });
                }

                rangePane.querySelectorAll('.tphud-range-sort').forEach(el => {
                    el.addEventListener('click', () => {
                        const col = el.dataset.col;
                        if (rangeState.col === col) rangeState.dir = rangeState.dir === 'desc' ? 'asc' : 'desc';
                        else { rangeState.col = col; rangeState.dir = col === 'hand' ? 'asc' : 'desc'; }
                        refreshRangeList();
                    });
                });

                rangePane.querySelector('.tphud-range-filter')?.addEventListener('change', e => {
                    rangeState.min = parseInt(e.target.value);
                    refreshRangeList();
                });
            } else {
                const rangeState = { col: 'seen', dir: 'desc', min: 1 };

                function refreshOppRangeList() {
                    const list = rangePane.querySelector('.tphud-range-list-opp');
                    if (!list) return;
                    list.innerHTML = buildOpponentRangeRows(s.shownHands || {}, rangeState.col, rangeState.dir, rangeState.min);
                    rangePane.querySelectorAll('.tphud-range-sort').forEach(el => {
                        const isActive = el.dataset.col === rangeState.col;
                        el.classList.toggle('tphud-sort-active', isActive);
                        el.classList.toggle('tphud-sort-desc', isActive && rangeState.dir === 'desc');
                        el.classList.toggle('tphud-sort-asc', isActive && rangeState.dir === 'asc');
                    });
                }

                rangePane.querySelectorAll('.tphud-range-sort').forEach(el => {
                    el.addEventListener('click', () => {
                        const col = el.dataset.col;
                        if (rangeState.col === col) rangeState.dir = rangeState.dir === 'desc' ? 'asc' : 'desc';
                        else { rangeState.col = col; rangeState.dir = col === 'hand' ? 'asc' : 'desc'; }
                        refreshOppRangeList();
                    });
                });

                rangePane.querySelector('.tphud-range-filter-opp')?.addEventListener('change', e => {
                    rangeState.min = parseInt(e.target.value);
                    refreshOppRangeList();
                });
            }
        }

        // Open the user's preferred default tab
        if (hudSettings.panelDefaultTab !== 'stats') {
            const defaultTab = panel.querySelector(`.tphud-tab[data-tab="${hudSettings.panelDefaultTab}"]`);
            if (defaultTab) defaultTab.click();
        }
    }

    function closePanel() {
        document.getElementById('tphud-panel')?.remove();
        const prev = activePanelPlayer;
        activePanelPlayer = { name: null, numericId: null };
        const prevKey = prev?.numericId || prev?.name;
        if (prevKey && sideStatsEls[prevKey]) sideStatsEls[prevKey].style.display = '';
    }

    // ── Hand History ─────────────────────────────────────────────

    function serializeHandHistory(snap) {
        const bb = snap.tableBB;
        const fmtA = n => {
            if (n == null) return '?';
            if (bb && isBBDisplayMode) return `${(n / bb).toFixed(1)} BB`;
            if (n >= 1_000_000) return '$' + (n / 1_000_000).toFixed(2) + 'M';
            if (n >= 1_000) return '$' + Math.round(n / 1_000) + 'k';
            return '$' + n;
        };

        const lines = [];

        // Header
        const tablePart = snap.tableName ? `  ${snap.tableName}` : '';
        const bbPart = bb ? ` ($${bb.toLocaleString()} BB)` : '';
        lines.push(`Hand #${snap.handId}${tablePart}${bbPart}`);
        lines.push(new Date(snap.ts).toLocaleString());
        lines.push('');

        // Seats — hero hole cards shown inline here
        const heroCards = snap.selfHoleCards || snap.players[localPlayerName]?.showdownCards;
        const seatNames = snap.seatOrder
            .map(id => snap.seatNameMap[id])
            .filter(Boolean);
        if (seatNames.length) {
            lines.push('Seats:');
            seatNames.forEach(name => {
                const pos = snap.players[name]?.position;
                const stack = snap.stackAtStart?.[name];
                const posStr = pos ? ` (${pos})` : '';
                const stackStr = stack != null ? `: ${fmtA(stack)}` : '';
                const cards = (name === localPlayerName && heroCards)
                    ? ` [${heroCards.join(' ')}]` : '';
                lines.push(`  ${name}${posStr}${stackStr}${cards}`);
            });
            lines.push('');
        }

        // Streets
        const streetBoards = {
            flop: snap.flopCards || [],
            turn: snap.turnCards || [],
            river: snap.riverCards || [],
        };
        ['preflop', 'flop', 'turn', 'river'].forEach(street => {
            const actions = snap.actionLog?.[street];
            if (!actions || !actions.length) return;

            const board = streetBoards[street];
            const boardStr = board?.length ? ` [${board.join(' ')}]` : '';
            lines.push(`${street.charAt(0).toUpperCase() + street.slice(1)}:${boardStr}`);

            actions.forEach(({ actor, text }) => {
                // Showdown / winner lines grouped separately below
                if (/reveals\s*\[|won.*with\s*\[|won.*did not show|shows?\s*\[/i.test(text)) return;
                let action;
                if (/posted small blind/i.test(text)) action = `posts SB ${fmtA(parseCashAmt(text))}`;
                else if (/posted big blind/i.test(text)) action = `posts BB ${fmtA(parseCashAmt(text))}`;
                else if (/^folded?$/i.test(text)) action = 'folds';
                else if (/^checked?$/i.test(text)) action = 'checks';
                else if (/^call(?:ed|s)?\s+(?:\$|\d)/i.test(text)) action = `calls ${fmtA(parseCashAmt(text))}`;
                else if (/^bets?\s+/i.test(text)) action = `bets ${fmtA(parseCashAmt(text))}`;
                else if (/^raise[ds]?\s+/i.test(text)) action = `raises to ${fmtA(parseTotalAmt(text))}`;
                else action = text;
                lines.push(`  ${actor} ${action}`);
            });
            lines.push('');
        });

        // Showdown — opponent reveals + winner (hero already shown in seats)
        const sdLines = [];
        Object.entries(snap.players || {}).forEach(([name, p]) => {
            if (p.showdownCards && name !== localPlayerName) {
                const handPart = p.showdownHandName ? ` (${p.showdownHandName})` : '';
                sdLines.push(`  ${name} shows [${p.showdownCards.join(' ')}]${handPart}`);
            }
        });
        Object.entries(snap.players || {}).forEach(([name, p]) => {
            if (p.wonShowdown || p.wonNoShowdown) {
                const amtPart = p.winAmt != null ? ` ${fmtA(p.winAmt)}` : '';
                const how = p.wonShowdown ? ' (showdown)' : ' (uncontested)';
                sdLines.push(`  ${name} wins${amtPart}${how}`);
            }
        });
        if (sdLines.length) {
            lines.push('Showdown:');
            lines.push(...sdLines);
        }

        return lines.join('\n').trim();
    }

    // Builds and shows a modal with the standard tphud-help-modal scaffolding (header, close button, content area).
    // Wires close-on-button and close-on-backdrop click. onMount fires after DOM insertion so callers can bind
    // additional handlers on the live element. Returns the modal element.
    function createModal({ id, title, bodyHtml = '', boxClass = '', contentClass = '', onMount }) {
        document.getElementById(id)?.remove();
        const modal = document.createElement('div');
        modal.id = id;
        modal.className = 'tphud-help-modal';
        modal.innerHTML = `
            <div class="tphud-help-box${boxClass ? ' ' + boxClass : ''}">
                <div class="tphud-help-header">
                    <span class="tphud-help-title">${title}</span>
                    <button class="tphud-help-close">&times;</button>
                </div>
                <div class="tphud-help-content${contentClass ? ' ' + contentClass : ''}">
                    ${bodyHtml}
                </div>
            </div>`;
        document.body.appendChild(modal);
        modal.querySelector('.tphud-help-close').addEventListener('click', () => modal.remove());
        modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
        if (onMount) onMount(modal);
        return modal;
    }

    function showHandHistoryModal() {
        const isEmpty = !recentHandHistories.length;
        const title = isEmpty ? 'Hand History' : `Hand History (last ${recentHandHistories.length})`;
        const bodyHtml = isEmpty
            ? `<div class="tphud-dim" style="padding:12px 0">No hands recorded yet. Complete a hand to see history here.</div>`
            : recentHandHistories.map((snap, i) => {
                const text = serializeHandHistory(snap);
                const label = snap.tableName
                    ? `${snap.tableName}${snap.tableBB ? ` · $${snap.tableBB.toLocaleString()} BB` : ''}`
                    : (snap.tableBB ? `$${snap.tableBB.toLocaleString()} BB` : `Hand ${i + 1}`);
                const timeStr = new Date(snap.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                return `
                    <div class="tphud-hh-entry">
                        <div class="tphud-hh-entry-hdr">
                            <span class="tphud-hh-label">${escHtml(label)}</span>
                            <span class="tphud-hh-time">${timeStr}</span>
                            <button class="tphud-hh-copy" data-idx="${i}" title="Copy to clipboard">Copy</button>
                        </div>
                        <pre class="tphud-hh-pre">${escHtml(text)}</pre>
                    </div>`;
            }).join('');

        createModal({
            id: 'tphud-hh-modal',
            title,
            boxClass: 'tphud-hh-box',
            contentClass: 'tphud-hh-content',
            bodyHtml,
            onMount: modal => {
                modal.querySelectorAll('.tphud-hh-copy').forEach(btn => {
                    btn.addEventListener('click', e => {
                        e.stopPropagation();
                        const idx = parseInt(btn.dataset.idx, 10);
                        const snap = recentHandHistories[idx];
                        if (!snap) return;
                        const text = serializeHandHistory(snap);
                        navigator.clipboard.writeText(text).then(() => {
                            btn.textContent = 'Copied!';
                            setTimeout(() => { btn.textContent = 'Copy'; }, 1500);
                        }).catch(() => {
                            btn.textContent = 'Failed';
                            setTimeout(() => { btn.textContent = 'Copy'; }, 1500);
                        });
                    });
                });
            },
        });
    }

    // ── Suspicion Modal ───────────────────────────────────────────

    function showSuspicionModal(name) {
        document.getElementById('tphud-susp-modal')?.remove();

        const modal = document.createElement('div');
        modal.id = 'tphud-susp-modal';
        modal.className = 'tphud-help-modal';

        const qualifyingPairs = getSuspiciousPairsFor(name);
        const totalEvents = qualifyingPairs.reduce((sum, p) => sum + p.events.length, 0);

        // Renders one suspicion event into rich HTML
        function renderSuspEvent(e, pair) {
            const snap = e.snap || null;
            const bb = snap?.tableBB || currentTableBB;

            function fmtAmt(n) {
                if (n == null) return '?';
                if (bb && isBBDisplayMode) return (n / bb).toFixed(1) + ' BB';
                if (n >= 1_000_000) return '$' + (n / 1_000_000).toFixed(2) + 'M';
                if (n >= 1_000) return '$' + Math.round(n / 1_000) + 'k';
                return '$' + n;
            }

            function pctColor(pct) {
                return pct >= 40 ? '#e74c3c' : pct >= 20 ? '#e67e22' : '#aaa';
            }

            // ── Board cards ──
            const boardCards = snap?.boardCards || [];
            const boardHtml = boardCards.length
                ? `<div class="tphud-susp-row"><span class="tphud-susp-label">Board</span><span class="tphud-susp-cards">${cardsHtml(boardCards, true)}</span></div>`
                : '';

            // ── Self hole cards (only visible when we're one of the involved players) ──
            const holeCards = snap?.selfHoleCards;
            const holeHtml = holeCards?.length
                ? `<div class="tphud-susp-row"><span class="tphud-susp-label">Your hand</span><span class="tphud-susp-cards">${cardsHtml(holeCards, true)}</span></div>`
                : '';

            // ── Pot size ──
            const potHtml = snap?.pot
                ? `<div class="tphud-susp-row"><span class="tphud-susp-label">Pot</span><span style="color:#f1c40f">${fmtAmt(snap.pot)}</span></div>`
                : '';

            if (e.type === 'soft_play') {
                // ── Soft play: folder / aggressor / street / amounts ──
                const contrib = e.contrib ?? snap?.potContrib?.[e.folder] ?? null;
                const startStack = e.startStack ?? snap?.stackAtStart?.[e.folder] ?? null;
                const aggrStack = snap?.stackAtStart?.[e.aggressor] ?? null;
                const pct = (contrib != null && startStack) ? Math.round(contrib / startStack * 100) : null;

                const folderRow = `
                    <div class="tphud-susp-player-row">
                        <div class="tphud-susp-player-card tphud-susp-fold">
                            <div class="tphud-susp-player-name">${escHtml(e.folder || '?')}</div>
                            <div class="tphud-susp-player-role">folded</div>
                            ${startStack ? `<div class="tphud-susp-stack">Stack ${fmtAmt(startStack)}</div>` : ''}
                            ${contrib != null ? `<div class="tphud-susp-committed" style="color:${pct != null ? pctColor(pct) : '#aaa'}">Committed ${fmtAmt(contrib)}${pct != null ? ` (${pct}%)` : ''}</div>` : ''}
                        </div>
                        <div class="tphud-susp-vs">vs</div>
                        <div class="tphud-susp-player-card tphud-susp-agg">
                            <div class="tphud-susp-player-name">${escHtml(e.aggressor || '?')}</div>
                            <div class="tphud-susp-player-role">aggressor</div>
                            ${aggrStack ? `<div class="tphud-susp-stack">Stack ${fmtAmt(aggrStack)}</div>` : ''}
                        </div>
                    </div>`;

                const streetBoardMap = { flop: snap?.flopCards, turn: snap?.turnCards, river: snap?.boardCards };
                const streetBoard = e.street ? (streetBoardMap[e.street] || boardCards) : boardCards;
                const streetBoardHtml = streetBoard.length
                    ? `<div class="tphud-susp-row"><span class="tphud-susp-label">Board at fold (${e.street})</span><span class="tphud-susp-cards">${cardsHtml(streetBoard, true)}</span></div>`
                    : '';

                return `${folderRow}${streetBoardHtml}${holeHtml}${potHtml}`;
            }

            if (e.type === 'whipsaw') {
                // ── Whipsaw: raiser / 3-bettor / victims / preflop action ──
                const raiser = e.raiser || pair.players[0];
                const threeBettor = e.threeBettor || pair.players[1];
                const victims = e.victims || [];

                const raiserStack = snap?.stackAtStart?.[raiser] ?? null;
                const tbStack = snap?.stackAtStart?.[threeBettor] ?? null;
                const raiserIn = snap?.potContrib?.[raiser] ?? null;
                const tbIn = snap?.potContrib?.[threeBettor] ?? null;

                const raiserPct = (raiserIn != null && raiserStack) ? Math.round(raiserIn / raiserStack * 100) : null;
                const tbPct = (tbIn != null && tbStack) ? Math.round(tbIn / tbStack * 100) : null;

                const playerRow = `
                    <div class="tphud-susp-player-row">
                        <div class="tphud-susp-player-card tphud-susp-raise">
                            <div class="tphud-susp-player-name">${escHtml(raiser)}</div>
                            <div class="tphud-susp-player-role">raised</div>
                            ${raiserStack ? `<div class="tphud-susp-stack">Stack ${fmtAmt(raiserStack)}</div>` : ''}
                            ${raiserIn != null ? `<div class="tphud-susp-committed" style="color:${raiserPct != null ? pctColor(raiserPct) : '#aaa'}">In ${fmtAmt(raiserIn)}${raiserPct != null ? ` (${raiserPct}%)` : ''}</div>` : ''}
                        </div>
                        <div class="tphud-susp-player-card tphud-susp-3bet">
                            <div class="tphud-susp-player-name">${escHtml(threeBettor)}</div>
                            <div class="tphud-susp-player-role">3-bet</div>
                            ${tbStack ? `<div class="tphud-susp-stack">Stack ${fmtAmt(tbStack)}</div>` : ''}
                            ${tbIn != null ? `<div class="tphud-susp-committed" style="color:${tbPct != null ? pctColor(tbPct) : '#aaa'}">In ${fmtAmt(tbIn)}${tbPct != null ? ` (${tbPct}%)` : ''}</div>` : ''}
                        </div>
                    </div>`;

                // Victims with their stack/contrib
                const victimsHtml = victims.length ? `
                    <div class="tphud-susp-victims">
                        <span class="tphud-susp-label">Squeezed</span>
                        ${victims.map(v => {
                    const vStack = snap?.stackAtStart?.[v] ?? null;
                    const vIn = snap?.potContrib?.[v] ?? null;
                    const vPct = (vIn != null && vStack) ? Math.round(vIn / vStack * 100) : null;
                    return `<span class="tphud-susp-victim">${escHtml(v)}${vIn != null ? `<span style="color:${vPct != null ? pctColor(vPct) : '#aaa'}"> ${fmtAmt(vIn)}${vPct != null ? ` (${vPct}%)` : ''}</span>` : ''}</span>`;
                }).join('')}
                    </div>` : '';

                // Preflop action lines (raise + 3-bet entries)
                const pfActions = (snap?.actionLog?.preflop || []).filter(a =>
                    /raise[ds]?|3.?bet/i.test(a.text) && (a.actor === raiser || a.actor === threeBettor)
                );
                const pfHtml = pfActions.length ? `
                    <div class="tphud-susp-pf-log">
                        ${pfActions.map(a => `<div class="tphud-susp-pf-line"><span class="tphud-susp-actor">${escHtml(a.actor)}</span> <span style="color:#ccc">${escHtml(a.text)}</span></div>`).join('')}
                    </div>` : '';

                return `${playerRow}${victimsHtml}${pfHtml}${boardHtml}${holeHtml}${potHtml}`;
            }

            // Fallback for future event types
            return `<div class="tphud-susp-desc">${escHtml(e.description)}</div>`;
        }

        const pairsHtml = qualifyingPairs.map(pair => {
            const partner = pair.players.find(p => p !== name);
            const sameFaction = sharesFaction(name, partner);
            const factionInfo = getFactionForPlayer(partner);
            const factionTag = sameFaction
                ? `<span class="tphud-susp-faction-tag">${factionInfo?.name ? escHtml(factionInfo.name) : 'Same faction'}</span>`
                : '';

            const eventsHtml = pair.events.map((e, i) => `
                <div class="tphud-susp-event">
                    <div class="tphud-susp-event-hdr">
                        <span class="tphud-susp-type">${e.type === 'soft_play' ? '🤝 Soft play' : e.type === 'whipsaw' ? '🪤 Whipsaw' : '⚠ Unknown'}</span>
                        ${e.handId ? `<span class="tphud-susp-hand">Hand #${String(e.handId).slice(0, 8)}</span>` : ''}
                        ${(e.tableName || e.snap?.tableName) ? `<span class="tphud-susp-table">${escHtml(e.tableName || e.snap.tableName)}</span>` : ''}
                        ${e.ts ? `<span class="tphud-susp-table">${new Date(e.ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>` : ''}
                        <span class="tphud-susp-idx">#${i + 1}</span>
                    </div>
                    <div class="tphud-susp-event-body">
                        ${renderSuspEvent(e, pair)}
                    </div>
                </div>`).join('');

            return `
                <div class="tphud-susp-pair">
                    <div class="tphud-susp-pair-hdr">
                        <span class="tphud-susp-partner">${escHtml(name)} + ${escHtml(partner)}</span>
                        ${factionTag}
                        <span class="tphud-susp-count">${pair.events.length} event${pair.events.length !== 1 ? 's' : ''}</span>
                    </div>
                    ${eventsHtml}
                </div>`;
        }).join('');

        modal.innerHTML = `
            <div class="tphud-help-box tphud-hh-box">
                <div class="tphud-help-header">
                    <span class="tphud-help-title">⚠ Suspicious Activity — ${escHtml(name)} (${totalEvents} event${totalEvents !== 1 ? 's' : ''})</span>
                    <button class="tphud-help-close">&times;</button>
                </div>
                <div class="tphud-help-content tphud-hh-content">
                    <div class="tphud-susp-note">Kept for 30 days across sessions and tables. Faction pairs: 1+ events. Non-faction pairs: 2+ events (whipsaw-only: 3+).</div>
                    ${pairsHtml || '<div class="tphud-dim" style="padding:12px 0">No qualifying pairs yet.</div>'}
                </div>
            </div>`;

        document.body.appendChild(modal);
        modal.querySelector('.tphud-help-close').addEventListener('click', () => modal.remove());
        modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
    }

    // ── Leaderboard ───────────────────────────────────────────────

    function calcLeaderboardScore(s) {
        const hands = s.handsObserved || 0;
        if (hands < 10) return null;
        const vpip = hands > 0 ? (s.vpipCount || 0) / hands : 0;
        const sdTotal = s.wentToShowdownCount || 0;
        const sdWinRate = sdTotal > 0 ? (s.wonAtShowdownCount || 0) / sdTotal : 0.5;
        // Higher = more exploitable: loose player who loses at showdown, weighted by sample size
        return vpip * (1 - sdWinRate) * Math.log10(hands + 2);
    }

    function leaderboardTier(s, score) {
        const hands = s.handsObserved || 0;
        if (hands < 10) return { label: 'Unknown', color: '#666', tip: 'Too few hands to score — keep playing against them.' };
        const vpip = hands > 0 ? (s.vpipCount || 0) / hands : 0;
        if (score >= 0.8) return { label: 'Whale', color: '#f0c040', tip: 'Loose and consistently losing — high-value target with a solid sample.' };
        if (score >= 0.45) return { label: 'Fish', color: '#5db8f5', tip: 'Plays too many hands and loses often at showdown — exploitable.' };
        if (score < 0.15 && vpip < 0.28) return { label: 'Reg', color: '#55e87a', tip: 'Tight, selective, and winning at showdown — treat with caution.' };
        return { label: 'Regular', color: '#aaa', tip: 'Average profile — no strong read either way yet.' };
    }

    function showLeaderboardModal() {
        document.getElementById('tphud-lb-modal')?.remove();

        const modal = document.createElement('div');
        modal.id = 'tphud-lb-modal';
        modal.className = 'tphud-help-modal';

        const all = getStats();
        const rows = Object.values(all).filter(s => s && s.displayName && (s.handsObserved || 0) > 0).map(s => {
            const score = calcLeaderboardScore(s);
            const hands = s.handsObserved || 0;
            const vpip = hands > 0 ? (s.vpipCount || 0) / hands : 0;
            const sdTotal = s.wentToShowdownCount || 0;
            const sdWinRate = sdTotal > 0 ? (s.wonAtShowdownCount || 0) / sdTotal : null;
            const tier = leaderboardTier(s, score ?? 0);
            return { s, score: score ?? -1, hands, vpip, sdWinRate, tier };
        });

        let sortKey = 'score';

        function renderTable() {
            const sorted = [...rows].sort((a, b) => {
                if (sortKey === 'score') return b.score - a.score;
                if (sortKey === 'hands') return b.hands - a.hands;
                if (sortKey === 'vpip') return b.vpip - a.vpip;
                return 0;
            });

            return sorted.map((r, i) => {
                const nameId = escHtml(r.s.displayName);
                const numId = r.s.numericId || '';
                const sdPct = r.sdWinRate != null ? `${Math.round(r.sdWinRate * 100)}%` : '—';
                const scoreLbl = r.score >= 0 ? r.score.toFixed(2) : '—';
                return `
                    <tr class="tphud-lb-row" data-name="${nameId}" data-numid="${numId}">
                        <td class="tphud-lb-rank">${i + 1}</td>
                        <td class="tphud-lb-name"><button class="tphud-lb-namelink">${nameId}</button></td>
                        <td class="tphud-lb-cell">${r.hands}</td>
                        <td class="tphud-lb-cell">${Math.round(r.vpip * 100)}%</td>
                        <td class="tphud-lb-cell">${sdPct}</td>
                        <td class="tphud-lb-cell">${scoreLbl}</td>
                        <td class="tphud-lb-cell"><span style="color:${r.tier.color};cursor:help" title="${escHtml(r.tier.tip)}">${r.tier.label}</span></td>
                    </tr>`;
            }).join('');
        }

        function buildHtml() {
            return `
                <div class="tphud-help-box tphud-lb-box">
                    <div class="tphud-help-header">
                        <span class="tphud-help-title">Player Leaderboard</span>
                        <button class="tphud-help-close">&times;</button>
                    </div>
                    <div class="tphud-lb-sort-row">
                        Sort:
                        <button class="tphud-lb-sort ${sortKey === 'score' ? 'tphud-lb-sort-active' : ''}" data-sort="score">Score</button>
                        <button class="tphud-lb-sort ${sortKey === 'hands' ? 'tphud-lb-sort-active' : ''}" data-sort="hands">Hands</button>
                        <button class="tphud-lb-sort ${sortKey === 'vpip' ? 'tphud-lb-sort-active' : ''}" data-sort="vpip">VPIP</button>
                        <span class="tphud-lb-hint">Score = VPIP × (1 − SD win%) × confidence. Higher = more exploitable.</span>
                    </div>
                    ${rows.length === 0
                    ? '<div class="tphud-dim" style="padding:16px 0">No players tracked yet.</div>'
                    : `<div class="tphud-lb-table-wrap">
                            <table class="tphud-lb-table">
                                <thead><tr>
                                    <th>#</th><th>Name</th><th>Hands</th><th>VPIP</th><th>SD Win%</th><th>Score</th><th>Tier</th>
                                </tr></thead>
                                <tbody id="tphud-lb-tbody">${renderTable()}</tbody>
                            </table>
                           </div>`
                }
                </div>`;
        }

        modal.innerHTML = buildHtml();
        document.body.appendChild(modal);

        modal.querySelector('.tphud-help-close').addEventListener('click', () => modal.remove());
        modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });

        // Sort button clicks — re-render tbody only
        modal.addEventListener('click', e => {
            const sortBtn = e.target.closest('.tphud-lb-sort');
            if (sortBtn) {
                sortKey = sortBtn.dataset.sort;
                modal.querySelectorAll('.tphud-lb-sort').forEach(b => b.classList.toggle('tphud-lb-sort-active', b.dataset.sort === sortKey));
                const tbody = modal.querySelector('#tphud-lb-tbody');
                if (tbody) tbody.innerHTML = renderTable();
                // Re-bind name links after re-render
                bindNameLinks();
            }
            // Name link click
            const nameBtn = e.target.closest('.tphud-lb-namelink');
            if (nameBtn) {
                const row = nameBtn.closest('.tphud-lb-row');
                const name = row.dataset.name;
                const numId = row.dataset.numid ? parseInt(row.dataset.numid, 10) || null : null;
                modal.remove();
                openPanel(name, numId);
            }
        });

        function bindNameLinks() {
            // name link clicks handled via delegation above — nothing extra needed
        }
    }

    function generateTagInsight(tag, allTags) {
        if (!tag || typeof tag === 'string') return null;

        const board = tag.boardCards || [];
        const hand = tag.handCards || [];
        const handName = tag.handName || '';
        const outcome = tag.outcome || '';
        const label = tag.label || '';

        // Board texture helpers
        const rankVal = c => RANK_VALUES[rankOf(c)] || 0;

        const suitCounts = {};
        board.forEach(c => { const s = suitOf(c); suitCounts[s] = (suitCounts[s] || 0) + 1; });
        const maxSuitCount = Math.max(0, ...Object.values(suitCounts));
        const dominantSuit = Object.entries(suitCounts).sort((a, b) => b[1] - a[1])[0]?.[0];
        const hasFlushDraw = maxSuitCount >= 2;
        const boardIsFlushed = maxSuitCount >= 3;
        const handHasFlushSuit = dominantSuit && hand.some(c => suitOf(c) === dominantSuit);
        const flushCard = hand.find(c => suitOf(c) === dominantSuit);
        const flushCardRank = flushCard ? rankVal(flushCard) : 0;
        const highFlushCard = flushCardRank >= 11; // J or better

        // Straight draw: 4 cards from (hand + board) fit within any 5-consecutive-rank window
        const allRankVals = [...hand, ...board].map(rankVal).filter(Boolean);
        // Include ace-low (A=1) for wheel draws
        const withAceLow = allRankVals.flatMap(v => v === 14 ? [14, 1] : [v]);
        const uniqueRankVals = [...new Set(withAceLow)].sort((a, b) => a - b);
        let hasStraightDraw = false;
        for (let i = 0; i < uniqueRankVals.length; i++) {
            const lo = uniqueRankVals[i];
            const inWindow = uniqueRankVals.filter(v => v >= lo && v <= lo + 4);
            if (inWindow.length >= 4) { hasStraightDraw = true; break; }
        }

        // Pattern count: how many tags share this same label
        const patternCount = (allTags || []).filter(t => typeof t === 'object' && t.label === label).length;
        const nthTime = patternCount > 1 ? `That's ${patternCount === 2 ? 'the second' : patternCount === 3 ? 'third' : `${patternCount}th`} time` : null;

        // ── Insights by trigger type ────────────────────────────

        if (label === 'Triple barrel bluff') {
            const chaseNote = handHasFlushSuit && hasFlushDraw
                ? ` Probably chasing the flush with ${flushCard} — missed and kept firing anyway.`
                : hasStraightDraw ? ' Likely on a straight draw that bricked.' : '';
            const pattern = nthTime ? ` ${nthTime} triple-barrelling a bluff — compulsive bluffer. 4-bet or float and let them hang themselves.` : ' Note the board texture he picks for triple barrels.';
            return `Committed three streets with nothing.${chaseNote}${pattern}`;
        }

        if (label === 'Bluffed to showdown') {
            if (handHasFlushSuit && hasFlushDraw) {
                const sizeNote = tag.extra?.includes('%') ? ` ${tag.extra} — ` : ' ';
                const quality = highFlushCard ? 'High flush card, understandable semi-bluff' : 'Low flush card, bad spot to bluff';
                return `${quality} — chasing with ${flushCard} on a flush-draw board.${sizeNote}Didn't catch it. Classic chaser. Bet them off draws hard, they call too wide.`;
            }
            if (hasStraightDraw) return `Probable straight draw that missed. Bluffed into the wrong person. Note the connected board — this player bets when they pick up equity, even low equity.`;
            return `Showed up with ${handName || 'air'} at showdown after betting. Pure bluff with no draw. Either tilting or just plays too many hands.${nthTime ? ` ${nthTime} doing this.` : ''}`;
        }

        if (label.startsWith('Overbet')) {
            if (outcome === 'lost') {
                return `Overbet as a bluff — polarised sizing with nothing behind it. ${nthTime ? `${nthTime} overbetting and losing.` : 'If they overbet again, consider it a bluff-heavy line.'} Exploit: call down wide when they bomb.`;
            }
            return `Overbet for value or to deny equity. Strong hand range when they overbet — don't hero-call here.${nthTime ? ` ${nthTime} going big.` : ''}`;
        }

        if (label.startsWith('Check-raised')) {
            const street = label.replace('Check-raised ', '');
            if (outcome === 'won') {
                return `Slowplay trap — checked ${street} with ${handName || 'a strong hand'} then raised. Be cautious when this player checks. They're willing to give a free card to spring a trap.`;
            }
            return `Check-raised ${street} as a bluff — aggressive line, didn't have it. This player check-raises light. Their check is not always weakness.${nthTime ? ` ${nthTime} check-raising.` : ''}`;
        }

        if (label === '3-bet bluff') {
            const posNote = tag.extra ? ` ${tag.extra}` : '';
            if (nthTime) return `${nthTime} 3-bet bluffing${posNote}. Either a serial bluffer or overvaluing marginal hands. Consider 4-betting light — they're folding or playing badly postflop.`;
            return `3-bet with nothing${posNote}. Could be a one-off or a pattern. Track frequency — if they do it again, 4-bet them.`;
        }

        if (label === 'Called off big stack with weak hand') {
            if (handHasFlushSuit && hasFlushDraw) {
                return `Chasing the flush with ${flushCard}${highFlushCard ? ' — high card, pot odds might have looked okay' : ' — low card, terrible odds'}. Called off ${tag.extra || 'a big chunk'} and missed. Textbook chaser. Bet them off draws — they won't fold but they'll often miss.`;
            }
            if (hasStraightDraw) return `Called a big bet drawing to a straight. ${tag.extra || 'Significant'} stack at risk on a draw. Can be exploited — deny equity hard on draw-heavy boards.`;
            return `Called off ${tag.extra || 'big'} with ${handName || 'a weak hand'} — no draw, just bad call. Station tendencies. Value bet mercilessly, don't bluff.`;
        }

        if (label === 'Limp-reraise preflop') {
            if (hand.length) return `Limp-reraise with ${handName || 'a hand'} — classic trap with premiums (AA/KK). When this player limps and re-raises, give them maximum credit. Fold unless you have the nuts.`;
            return `Limp-reraise spotted — likely premium hand trap (AA/KK/QQ). Could also be a squeeze play.${nthTime ? ` ${nthTime} doing this.` : ''} Fold or 4-bet bluff only with blockers.`;
        }

        if (label === 'Donk-bet flop into PFA') {
            if (outcome === 'won') return `Donk-bet into the preflop aggressor and took it down. Either very strong or found a spot the PFA couldn't defend. Watch if they repeat this — could be a positional exploit or just luck.`;
            return `Donk-bet into the preflop aggressor and lost. Doesn't respect position. Easy to exploit — raise their donk-bets and they'll fold or misplay.`;
        }

        if (label.startsWith('Slowplayed')) {
            const checkedStreet = label.includes('flop') ? 'flop' : 'turn';
            return `Passive on the ${checkedStreet} with ${handName} — trapping or playing for deception. Don't give free cards to this player on coordinated boards. Their check is not always weakness.${nthTime ? ` ${nthTime} slowplaying.` : ''}`;
        }

        return null;
    }

    function renderAutoTagEntry(t, allTags) {
        // Backward compat: legacy plain-string entries
        if (typeof t === 'string') {
            return `<div class="tphud-autotag-entry"><div class="tphud-at-label">${escHtml(t)}</div></div>`;
        }
        const insight = generateTagInsight(t, allTags);

        const outcomeColor = t.outcome === 'won' ? '#2ecc71' : t.outcome === 'lost' ? '#e74c3c' : '#aaa';
        const metaParts = [];
        if (t.outcome) metaParts.push(`<span style="color:${outcomeColor}">${escHtml(t.outcome)}</span>`);
        if (t.extra) metaParts.push(`<span>${escHtml(t.extra)}</span>`);
        if (t.line) metaParts.push(`<span class="tphud-dim">${escHtml(t.line)}</span>`);
        if (t.date) metaParts.push(`<span class="tphud-dim">${escHtml(t.date)}</span>`);

        const handSection = t.handCards ? `
            <div class="tphud-at-cards">
                <span class="tphud-at-cards-label">Hand</span>
                <span class="tphud-hcard-row">${cardsHtml(t.handCards)}${t.handName ? `<span class="tphud-hhand-name">${escHtml(t.handName)}</span>` : ''}</span>
            </div>` : '';

        const flop = t.boardCards?.slice(0, 3) || [];
        const turn = t.boardCards?.slice(3, 4) || [];
        const river = t.boardCards?.slice(4, 5) || [];
        const boardSection = flop.length ? `
            <div class="tphud-at-cards">
                <span class="tphud-at-cards-label">Board</span>
                <span class="tphud-hcard-row">
                    ${cardsHtml(flop, true)}
                    ${turn.length ? `<span class="tphud-at-street-sep">·</span>${cardsHtml(turn, true)}` : ''}
                    ${river.length ? `<span class="tphud-at-street-sep">·</span>${cardsHtml(river, true)}` : ''}
                </span>
            </div>` : '';

        return `
            <div class="tphud-autotag-entry">
                <div class="tphud-at-label">${escHtml(t.label)}</div>
                ${handSection}
                ${boardSection}
                ${metaParts.length ? `<div class="tphud-at-meta">${metaParts.join('<span class="tphud-at-sep"> · </span>')}</div>` : ''}
                ${insight ? `<div class="tphud-at-insight">${escHtml(insight)}</div>` : ''}
            </div>`;
    }

    function showAutoTagsModal(name, numericId) {
        document.getElementById('tphud-autotags-modal')?.remove();

        const modal = document.createElement('div');
        modal.id = 'tphud-autotags-modal';
        modal.className = 'tphud-help-modal';

        const s = resolveStatsByName(name, getStats());
        const tags = s?.autoTags || [];
        const displayName = s?.displayName || name;

        const tagsHtml = tags.length === 0
            ? '<div class="tphud-dim" style="padding:12px 0">No notable plays tagged yet.</div>'
            : tags.map(t => renderAutoTagEntry(t, tags)).join('');

        const hasLegacy = tags.some(t => typeof t === 'string');

        modal.innerHTML = `
            <div class="tphud-help-box tphud-autotags-box">
                <div class="tphud-help-header">
                    <span class="tphud-help-title">Notable Plays — ${escHtml(displayName)}</span>
                    <div style="display:flex;gap:6px;align-items:center">
                        ${tags.length > 0 ? '<button class="tphud-at-clear" style="font-size:10px;color:#e74c3c;background:none;border:1px solid #e74c3c;border-radius:3px;padding:1px 6px;cursor:pointer">Clear all</button>' : ''}
                        <button class="tphud-help-close">&times;</button>
                    </div>
                </div>
                ${hasLegacy ? '<div class="tphud-dim" style="padding:6px 14px;font-size:10px;border-bottom:1px solid #222">Some entries are from an older format — clear and play through showdowns to see full card detail.</div>' : ''}
                <div class="tphud-help-content tphud-autotags-content">
                    ${tagsHtml}
                </div>
            </div>`;

        document.body.appendChild(modal);
        modal.querySelector('.tphud-help-close').addEventListener('click', () => modal.remove());
        modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
        modal.querySelector('.tphud-at-clear')?.addEventListener('click', e => {
            e.stopPropagation();
            const all = getStats();
            const ps = resolveStatsByName(name, all);
            if (ps) { ps.autoTags = []; markStatsDirty(); }
            modal.remove();
        });
    }

    function showPrevCoachModal() {
        document.getElementById('tphud-prevcoach-modal')?.remove();

        const modal = document.createElement('div');
        modal.id = 'tphud-prevcoach-modal';
        modal.className = 'tphud-help-modal';

        const cache = prevHandCoachCache;
        if (!cache || Object.values(cache).every(arr => !arr.length)) {
            modal.innerHTML = `
                <div class="tphud-help-box tphud-hh-box">
                    <div class="tphud-help-header">
                        <span class="tphud-help-title">Previous Hand — Coach Advice</span>
                        <button class="tphud-help-close">&times;</button>
                    </div>
                    <div class="tphud-help-content tphud-hh-content">
                        <div class="tphud-dim" style="padding:12px 0">No previous hand recorded yet.</div>
                    </div>
                </div>`;
        } else {
            const STREETS = ['preflop', 'flop', 'turn', 'river'];
            const streetLabels = { preflop: 'Pre', flop: 'Flop', turn: 'Turn', river: 'River' };

            const tabsHtml = STREETS
                .filter(s => cache[s]?.length)
                .map((s, i) => `<button class="tphud-pc-tab${i === 0 ? ' tphud-pc-tab-active' : ''}" data-street="${s}">${streetLabels[s]}</button>`)
                .join('');

            const panesHtml = STREETS
                .filter(s => cache[s]?.length)
                .map((s, i) => {
                    const entriesHtml = cache[s].map(e => {
                        if (e.isNarr) {
                            return `<div class="tphud-pc-narr">${escHtml(e.msgs[0] || '')}</div>`;
                        }
                        if (e.isCompact) {
                            return `<div class="tphud-pc-compact"><span class="tphud-pc-name">${escHtml(e.name)}</span> <span class="tphud-pc-dim">${escHtml(e.msgs[0] || '')}</span></div>`;
                        }
                        const chipHtml = e.chip ? `<span class="tphud-pc-chip">${escHtml(e.chip)}</span>` : '';
                        const msgsHtml = e.msgs.map(m => `<div class="tphud-pc-msg${e.isSelf ? ' tphud-pc-self-msg' : ''}">${escHtml(m)}</div>`).join('');
                        return `<div class="tphud-pc-entry${e.isSelf ? ' tphud-pc-self' : ''}">
                            <div class="tphud-pc-nameline"><span class="tphud-pc-name">${escHtml(e.name)}</span>${chipHtml}</div>
                            ${msgsHtml}
                        </div>`;
                    }).join('');
                    return `<div class="tphud-pc-pane${i !== 0 ? ' tphud-hidden' : ''}" data-street="${s}">${entriesHtml}</div>`;
                }).join('');

            modal.innerHTML = `
                <div class="tphud-help-box tphud-hh-box">
                    <div class="tphud-help-header">
                        <span class="tphud-help-title">Previous Hand — Coach Advice</span>
                        <button class="tphud-help-close">&times;</button>
                    </div>
                    <div class="tphud-pc-tabs">${tabsHtml}</div>
                    <div class="tphud-help-content tphud-hh-content" style="padding:8px 0">
                        ${panesHtml}
                    </div>
                </div>`;
        }

        document.body.appendChild(modal);
        modal.querySelector('.tphud-help-close').addEventListener('click', () => modal.remove());
        modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });

        modal.querySelectorAll('.tphud-pc-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                modal.querySelectorAll('.tphud-pc-tab').forEach(t => t.classList.remove('tphud-pc-tab-active'));
                modal.querySelectorAll('.tphud-pc-pane').forEach(p => p.classList.add('tphud-hidden'));
                tab.classList.add('tphud-pc-tab-active');
                modal.querySelector(`.tphud-pc-pane[data-street="${tab.dataset.street}"]`)?.classList.remove('tphud-hidden');
            });
        });
    }

    // Session report — hero's chip P&L, hands played, BB/100 since the page loaded.
    function showSessionReportModal() {
        const ss = sessionStats;
        const durMs = Date.now() - ss.startedAt;
        const durHours = Math.floor(durMs / 3600000);
        const durMins = Math.floor((durMs % 3600000) / 60000);
        const durStr = durHours > 0 ? `${durHours}h ${durMins}m` : `${durMins}m`;

        const bb100 = ss.handsPlayed > 0 ? (ss.netBB / ss.handsPlayed) * 100 : 0;
        const vpipPct = ss.handsPlayed > 0 ? (ss.handsVPIP / ss.handsPlayed) * 100 : 0;

        const fmtSigned = n => (n >= 0 ? '+' : '') + Math.round(n).toLocaleString();
        const fmtBB = n => (n >= 0 ? '+' : '') + n.toFixed(1) + ' BB';
        const colorOf = n => n > 0 ? '#2ecc71' : n < 0 ? '#e74c3c' : '#aaa';

        const empty = ss.handsPlayed === 0;
        const bodyHtml = empty
            ? `<div class="tphud-dim" style="padding:14px 0;text-align:center">No hands played this session yet.</div>`
            : `
                <div style="display:grid;grid-template-columns:max-content 1fr;gap:8px 16px;padding:8px 0">
                    <span class="tphud-help-term">Session length</span>
                    <span class="tphud-help-def">${durStr}</span>

                    <span class="tphud-help-term">Hands played</span>
                    <span class="tphud-help-def">${ss.handsPlayed}</span>

                    <span class="tphud-help-term">VPIP this session</span>
                    <span class="tphud-help-def">${vpipPct.toFixed(1)}%</span>

                    <span class="tphud-help-term">Net chips</span>
                    <span class="tphud-help-def" style="color:${colorOf(ss.netChips)}">${fmtSigned(ss.netChips)}</span>

                    <span class="tphud-help-term">Net BB</span>
                    <span class="tphud-help-def" style="color:${colorOf(ss.netBB)}">${fmtBB(ss.netBB)}</span>

                    <span class="tphud-help-term">BB/100</span>
                    <span class="tphud-help-def" style="color:${colorOf(bb100)}">${fmtSigned(bb100)} BB/100</span>

                    <span class="tphud-help-term">Biggest pot won</span>
                    <span class="tphud-help-def" style="color:#2ecc71">+${ss.biggestWinBB.toFixed(1)} BB</span>

                    <span class="tphud-help-term">Biggest pot lost</span>
                    <span class="tphud-help-def" style="color:#e74c3c">${ss.biggestLossBB.toFixed(1)} BB</span>
                </div>
                <div style="border-top:1px solid #222;padding-top:10px;margin-top:6px">
                    <button class="tphud-session-reset" style="font-size:11px;color:#e74c3c;background:none;border:1px solid #e74c3c;border-radius:3px;padding:3px 10px;cursor:pointer">Reset session</button>
                </div>
            `;

        createModal({
            id: 'tphud-session-modal',
            title: 'Session Report',
            bodyHtml,
            onMount: modal => {
                modal.querySelector('.tphud-session-reset')?.addEventListener('click', () => {
                    sessionStats.startedAt = Date.now();
                    sessionStats.handsPlayed = 0;
                    sessionStats.handsVPIP = 0;
                    sessionStats.netChips = 0;
                    sessionStats.netBB = 0;
                    sessionStats.biggestWinBB = 0;
                    sessionStats.biggestLossBB = 0;
                    modal.remove();
                });
            },
        });
    }

    // Coach-specific odds & terms glossary — explains GTO math shown in coach messages
    function showCoachGlossaryModal() {
        createModal({
            id: 'tphud-coach-glossary-modal', title: 'Coach — Odds &amp; Terms', bodyHtml: `
                    <div class="tphud-help-sec">Reading the Numbers</div>
                    <div class="tphud-help-grid">
                        <span class="tphud-help-term">Win % (Equity)</span>
                        <span class="tphud-help-def">Your estimated chance of winning this hand right now, based on your cards, the board, and what hands the opponent likely holds.<br><em>Example: "18.5% in a 3-way pot" — play this exact spot 100 times and you win roughly 18 of them. You're behind. Don't build a big pot.</em></span>

                        <span class="tphud-help-term">Need X% to call</span>
                        <span class="tphud-help-def">The minimum win % for a call to make money long-term. If your equity beats this number, calling is profitable. If it doesn't, folding saves chips over time.<br><em>Example: "Need 28% to call" — your hand wins 36% of the time → call is profitable. Your hand wins 20% → fold.</em></span>

                        <span class="tphud-help-term">Pot odds</span>
                        <span class="tphud-help-def">What the bet size costs you relative to the pot. A small bet into a big pot is a cheap call (low % needed). A big bet into a small pot is expensive (high % needed).<br><em>Example: Pot $100, opponent bets $25 — total pot becomes $125, you call $25 → need to win 25/125 = 20% to break even.</em></span>

                        <span class="tphud-help-term">SPR</span>
                        <span class="tphud-help-def">Stack-to-Pot Ratio — your effective stack divided by the pot. Tells you how committed you already are.<br><em>SPR under 3 = you're nearly pot-committed — calling a shove often makes sense even with one pair.<br>SPR 3–8 = mid-depth — don't overcommit without a strong hand.<br>SPR over 8 = deep stack — one pair rarely wins a big pot. Be careful.</em></span>

                        <span class="tphud-help-term">Range edge</span>
                        <span class="tphud-help-def">Which player's starting hands connect better with the current board. The preflop raiser's range hits high, dry boards harder. The caller's range hits low, connected boards harder.<br><em>Example: Board A-K-2 rainbow → raiser has the range edge (AK, AA, KK are in their range).<br>Board 6-7-8 two-tone → caller has the range edge (they flatted with suited connectors and small pairs).</em></span>

                        <span class="tphud-help-term">Defend ~X% (MDF)</span>
                        <span class="tphud-help-def">Minimum defence frequency: the share of the hands you would play this way that you must continue with (call or raise) against a given bet size. Fold more often than that and an opponent who bluffs with any two cards makes money automatically.<br><em>Formula: pot before the bet ÷ (pot before the bet + bet). Example: pot $100, bet $50 → defend 100/150 = 67% of your range, fold at most 33%.</em></span>

                        <span class="tphud-help-term">Balanced bluff %</span>
                        <span class="tphud-help-def">On the river, a bet of B into a pot of P should be a bluff about B/(P+2B) of the time to be unexploitable, which is exactly the pot odds the caller is getting. Bigger bets can bluff more often.<br><em>Half pot → 25% bluffs. Full pot → 33%. Twice pot → 40%. Earlier streets can run more bluffs because draws still have equity.</em></span>
                    </div>

                    <div class="tphud-help-sec">Draw Equity</div>
                    <div class="tphud-help-grid">
                        <span class="tphud-help-term">~X% equity to river</span>
                        <span class="tphud-help-def">Your chance of completing your draw by the river (two cards still to come on the flop).<br><em>Calculated as: outs × 4 on the flop, outs × 2 on the turn.</em></span>

                        <span class="tphud-help-term">Outs</span>
                        <span class="tphud-help-def">Cards left in the deck that complete your hand.<br><em>Flush draw = 9 outs (~36% to hit by river).<br>Open-ended straight draw = 8 outs (~32%).<br>Gutshot straight draw = 4 outs (~16%).</em></span>

                        <span class="tphud-help-term">Odds are there ✓</span>
                        <span class="tphud-help-def">Your draw equity beats what you need to call — the call is mathematically profitable long-term.<br><em>Example: draw equity 36%, need 28% to call → call.</em></span>

                        <span class="tphud-help-term">Odds against you ✗</span>
                        <span class="tphud-help-def">Your draw equity falls short of the required call % — calling loses money over time unless you have other reasons (fold equity, implied odds).<br><em>Example: draw equity 16%, need 33% to call → fold the gutshot.</em></span>
                    </div>

                    <div class="tphud-help-sec">Coach Confidence</div>
                    <div class="tphud-help-grid">
                        <span class="tphud-help-term">Thin read</span>
                        <span class="tphud-help-def">Fewer than ~10 hands observed on this player. The coach will still advise but the reads are based on limited data — treat them as early signals, not firm conclusions.</span>

                        <span class="tphud-help-term">Decent read</span>
                        <span class="tphud-help-def">10–25 hands observed. Stats are becoming meaningful. Player type labels are reasonably reliable.</span>

                        <span class="tphud-help-term">Solid read</span>
                        <span class="tphud-help-def">25+ hands observed. Player type and exploit advice is based on a substantial sample — higher confidence.</span>
                    </div>
        ` });
    }

    // Glossary / help modal
    function showHelpModal() {
        createModal({
            id: 'tphud-help-modal', title: 'HUD Glossary', bodyHtml: `

                    <div class="tphud-help-sec">Stats</div>
                    <div class="tphud-help-grid">
                        <span class="tphud-help-term">VPIP</span><span class="tphud-help-def">Voluntarily Put $ In Pot \u2014 how often they choose to enter a pot preflop (call or raise). High = loose, low = tight.</span>
                        <span class="tphud-help-term">PFR</span><span class="tphud-help-def">Preflop Raise % \u2014 how often they raise before the flop. Should be close to VPIP for aggressive players; a big gap means they limp/call a lot.</span>
                        <span class="tphud-help-term">AFq</span><span class="tphud-help-def">Aggression Frequency \u2014 how often they bet or raise (vs. call/check) post-flop. High = aggressive post-flop, low = passive.</span>
                        <span class="tphud-help-term">WTSD</span><span class="tphud-help-def">Went To ShowDown \u2014 how often they stick around until the cards are shown. High WTSD = hard to bluff off a hand.</span>
                        <span class="tphud-help-term">WSD</span><span class="tphud-help-def">Won at ShowDown \u2014 win rate when they do reach showdown. Low WSD with high WTSD = calling with weak hands.</span>
                        <span class="tphud-help-term">3-bet</span><span class="tphud-help-def">A re-raise preflop after someone already raised. Signals a very strong hand or a bluff squeeze.</span>
                        <span class="tphud-help-term">C-bet</span><span class="tphud-help-def">Continuation Bet \u2014 betting the flop after raising preflop. Standard move to take down pots without a strong hand.</span>
                        <span class="tphud-help-term">Limp</span><span class="tphud-help-def">Just calling the big blind preflop instead of raising. Passive entry \u2014 gives opponents good odds and hands initiative away.</span>
                        <span class="tphud-help-term">Gap (VPIP\u2013PFR)</span><span class="tphud-help-def">Difference between how often they play hands vs. raise. A big gap means they call a lot more than they raise \u2014 exploitable with aggression.</span>
                    </div>

                    <div class="tphud-help-sec">Player Types</div>
                    <div class="tphud-help-grid">
                        <span class="tphud-help-term">SHP</span><span class="tphud-help-def">Sharp / TAG (Tight-Aggressive) \u2014 plays a selective range but bets hard when in. The most dangerous type.</span>
                        <span class="tphud-help-term">AGG</span><span class="tphud-help-def">Aggressive / LAG (Loose-Aggressive) \u2014 plays many hands and puts pressure on everyone. Hard to read but can overplay.</span>
                        <span class="tphud-help-term">MAN</span><span class="tphud-help-def">Maniac \u2014 plays almost everything and bets constantly. Very high VPIP and PFR. Chaotic and unpredictable.</span>
                        <span class="tphud-help-term">FSH</span><span class="tphud-help-def">Fish \u2014 plays too many hands and almost never raises. Easy to exploit: bet for value, don't bluff.</span>
                        <span class="tphud-help-term">CLR</span><span class="tphud-help-def">Calling Station \u2014 loose but passive. Will call you down to the river. Never try to bluff these players off a hand.</span>
                        <span class="tphud-help-term">NIT</span><span class="tphud-help-def">Nit \u2014 folds almost everything. Only plays very strong hands. Fold when they show aggression.</span>
                        <span class="tphud-help-term">RCK</span><span class="tphud-help-def">Rock \u2014 even tighter than a Nit. Only absolute premiums. Treat their bets as the nuts.</span>
                        <span class="tphud-help-term">CTN</span><span class="tphud-help-def">Cautious / Tight-Passive \u2014 plays few hands and mostly checks/calls. Avoids confrontation. Low threat level.</span>
                        <span class="tphud-help-term">PSV</span><span class="tphud-help-def">Passive Gambler / Loose-Passive \u2014 plays many hands but rarely bets or raises. Drifts and calls.</span>
                        <span class="tphud-help-term">MIX</span><span class="tphud-help-def">Unpredictable / Mixed \u2014 no clear pattern detected. Either adapting their style or genuinely hard to read.</span>
                    </div>

                    <div class="tphud-help-sec">Positions</div>
                    <div class="tphud-help-grid">
                        <span class="tphud-help-term">EP</span><span class="tphud-help-def">Early Position \u2014 first seats to act preflop (UTG, UTG+1). You act before almost everyone \u2014 play tighter here.</span>
                        <span class="tphud-help-term">MP</span><span class="tphud-help-def">Middle Position \u2014 seats between EP and the button. More info than EP, less than late position.</span>
                        <span class="tphud-help-term">LP / BTN</span><span class="tphud-help-def">Late Position / Button \u2014 last to act post-flop. Strongest position. Play more hands and steal more blinds here.</span>
                        <span class="tphud-help-term">CO</span><span class="tphud-help-def">Cutoff \u2014 one seat right of the Button. Second-best position. Good spot to steal blinds.</span>
                        <span class="tphud-help-term">SB</span><span class="tphud-help-def">Small Blind \u2014 posts half the forced bet. Acts first post-flop every street. Worst position post-flop.</span>
                        <span class="tphud-help-term">BB</span><span class="tphud-help-def">Big Blind \u2014 posts the full forced bet. Gets last action preflop but is out of position post-flop.</span>
                        <span class="tphud-help-term">BB (unit)</span><span class="tphud-help-def">Big Blind as a stack unit. "20 BB" means their stack is 20\u00d7 the big blind.</span>
                    </div>

                    <div class="tphud-help-sec">Icons &amp; Indicators</div>
                    <div class="tphud-help-grid">
                        <span class="tphud-help-term">🎭 on badge</span><span class="tphud-help-def">Frequent bluffer — caught bluffing at showdown in 40%+ of verified hands. Their bets are often air.</span>
                        <span class="tphud-help-term">🎯 on badge</span><span class="tphud-help-def">Draw chaser — chases flush or straight draws in 35%+ of verified hands. Often calls too wide when drawing.</span>
                        <span class="tphud-help-term">💎 on badge</span><span class="tphud-help-def">Value player — shows up with strong hands at showdown 60%+ of the time. Their aggression is usually real.</span>
                        <span class="tphud-help-term">🃏 on badge</span><span class="tphud-help-def">Overplays marginals — frequently bets/raises with weak holdings and loses at showdown. Calls them down.</span>
                        <span class="tphud-help-term">📞 on badge</span><span class="tphud-help-def">Loose caller — calls down with weak hands in 25%+ of verified hands. Don't bluff these players.</span>
                        <span class="tphud-help-term">▼ on badge</span><span class="tphud-help-def">Stack drop — down 50%+ from their peak stack this session. May be tilting or short on chips.</span>
                        <span class="tphud-help-term">▽ on badge</span><span class="tphud-help-def">Moderate stack drop — down 35–50% from peak. Worth keeping an eye on.</span>
                        <span class="tphud-help-term">! on badge</span><span class="tphud-help-def">Live alert — a notable pattern was detected this hand (e.g. limp-reraise, check-raise, 3-bet from a tight player). Hover to see details.</span>
                        <span class="tphud-help-term">✎ N below seat</span><span class="tphud-help-def">Auto-tag count — the HUD has recorded N notable plays from this player (showdowns, bluffs, draws). Click to review them.</span>
                        <span class="tphud-help-term">$amount below seat</span><span class="tphud-help-def">Torn net worth pulled from their profile. Colour shows wealth tier. Hover for their stack-to-wealth ratio — tells you how much this game matters to them.</span>
                        <span class="tphud-help-term">Flag below seat</span><span class="tphud-help-def">Faction flag — this player shares a Torn faction with someone else at the table. Doesn't mean they're colluding, but worth knowing.</span>
                        <span class="tphud-help-term">⚠ N below seat</span><span class="tphud-help-def">Suspicious pattern — N concerning interactions detected between this player and another (soft play or whipsaw). Click for the full report.</span>
                    </div>

                    <div class="tphud-help-sec">Other Concepts</div>
                    <div class="tphud-help-grid">
                        <span class="tphud-help-term">Short-stacked</span><span class="tphud-help-def">Less than ~20 BB. Strategy shifts to push/fold \u2014 normal VPIP/PFR stats become less reliable.</span>
                        <span class="tphud-help-term">Rebuy</span><span class="tphud-help-def">Adding chips back after busting. Multiple rebuys can signal a tilting or gambling-style player.</span>
                        <span class="tphud-help-term">Tilt</span><span class="tphud-help-def">Playing worse than normal due to frustration or losses. Watch for stack drops, rebuy sprees, and sudden aggression spikes.</span>
                        <span class="tphud-help-term">Wet board</span><span class="tphud-help-def">A flop full of draw potential \u2014 flush draws, straight draws, connected cards. Bluffs are riskier here.</span>
                        <span class="tphud-help-term">Dry board</span><span class="tphud-help-def">Disconnected, uncoordinated flop with few draws. C-bets and bluffs have higher success rates here.</span>
                        <span class="tphud-help-term">Value bet</span><span class="tphud-help-def">Betting with a strong hand hoping to get called by worse hands. The opposite of a bluff.</span>
                        <span class="tphud-help-term">Probe bet</span><span class="tphud-help-def">Betting into the preflop aggressor on a later street to test if they still have a hand.</span>
                    </div>
        ` });
    }

    // Support / donate modal
    function showDonateModal() {
        createModal({
            id: 'tphud-donate-modal',
            title: '🎁 A note from HopesG',
            boxClass: 'tphud-donate-box',
            contentClass: 'tphud-donate-content',
            bodyHtml: `
                    <p class="tphud-donate-p">
                        This script will always be free. No subscriptions, no paywalls — ever.
                    </p>
                    <p class="tphud-donate-p">
                        If it's helped your game or just made poker a bit more fun, you're welcome to send something in-game.
                        Never expected, but always appreciated.
                    </p>
                    <a class="tphud-donate-link" href="https://www.torn.com/profiles.php?XID=4118257" target="_blank" rel="noopener">
                        Visit HopesG's profile
                    </a>
                    <p class="tphud-donate-p" style="margin-top:16px">
                        My DMs are open if you have feedback or questions. Have fun at the tables!
                    </p>
                    <p class="tphud-donate-sig">— HopesG</p>
                    <div class="tphud-donate-supporters">
                        <div class="tphud-donate-supporters-title">❤️ Project Supporters ❤️</div>
                        <div class="tphud-donate-supporter-row"><span class="tphud-donate-supporter-name">DuckOfDestiny</span><span class="tphud-donate-supporter-gift">30x Drug packs (!!) </span></div>
                        <div class="tphud-donate-supporter-row"><span class="tphud-donate-supporter-name">SoftStroker</span><span class="tphud-donate-supporter-gift">4x Donator Packs (!!) </span></div>
                        <div class="tphud-donate-supporter-row"><span class="tphud-donate-supporter-name">Anonymous</span><span class="tphud-donate-supporter-gift">2x Donator Packs (!)</span></div>
                        <div class="tphud-donate-supporter-row"><span class="tphud-donate-supporter-name">AFCO</span><span class="tphud-donate-supporter-gift">25x Xanax</span></div>
                        <div class="tphud-donate-supporter-row"><span class="tphud-donate-supporter-name">Old_Man</span><span class="tphud-donate-supporter-gift">Feathery Hotel Coupon</span></div>
                        <div class="tphud-donate-supporter-row"><span class="tphud-donate-supporter-name">Anonymous</span><span class="tphud-donate-supporter-gift">11x Xanax</span></div>
                        <div class="tphud-donate-supporters-more-toggle">Show more supporters</div>
                        <div class="tphud-donate-supporters-more" style="display:none">
                            <div class="tphud-donate-supporter-row"><span class="tphud-donate-supporter-name">Airwalker2662</span><span class="tphud-donate-supporter-gift">10x Xanax</span></div>
                            <div class="tphud-donate-supporter-row"><span class="tphud-donate-supporter-name">Anonymous</span><span class="tphud-donate-supporter-gift">10x Xanax</span></div>
                            <div class="tphud-donate-supporter-row"><span class="tphud-donate-supporter-name">Surazel</span><span class="tphud-donate-supporter-gift">10x Xanax</span></div>
                            <div class="tphud-donate-supporter-row"><span class="tphud-donate-supporter-name">Euthanatos</span><span class="tphud-donate-supporter-gift">9x Xanax</span></div>
                            <div class="tphud-donate-supporter-row"><span class="tphud-donate-supporter-name">Rovokan</span><span class="tphud-donate-supporter-gift">5x Xanax</span></div>
                            <div class="tphud-donate-supporter-row"><span class="tphud-donate-supporter-name">MrTouchtheybutt</span><span class="tphud-donate-supporter-gift">2x Xanax</span></div>
                            <div class="tphud-donate-supporter-row"><span class="tphud-donate-supporter-name">FRISK00</span><span class="tphud-donate-supporter-gift">2x Xanax</span></div>
                            <div class="tphud-donate-supporter-row"><span class="tphud-donate-supporter-name">pirx</span><span class="tphud-donate-supporter-gift">2x Xanax</span></div>
                            <div class="tphud-donate-supporter-row"><span class="tphud-donate-supporter-name">firetron</span><span class="tphud-donate-supporter-gift">Lottery Voucher</span></div>
                            <div class="tphud-donate-supporter-row"><span class="tphud-donate-supporter-name">Klam44</span><span class="tphud-donate-supporter-gift">1x Xanax</span></div>
                        </div>
                    </div>
            `,
            onMount: modal => {
                const moreToggle = modal.querySelector('.tphud-donate-supporters-more-toggle');
                const moreList = modal.querySelector('.tphud-donate-supporters-more');
                moreToggle.addEventListener('click', () => {
                    const open = moreToggle.classList.toggle('open');
                    moreList.style.display = open ? 'block' : 'none';
                });
            },
        });
    }

    // HUD settings modal
    function showSettingsModal() {
        document.getElementById('tphud-settings-modal')?.remove();

        const s = { ...hudSettings };

        const modal = document.createElement('div');
        modal.id = 'tphud-settings-modal';
        modal.className = 'tphud-help-modal';
        modal.innerHTML = `
            <div class="tphud-help-box tphud-settings-box">
                <div class="tphud-help-header">
                    <span class="tphud-help-title">⚙ HUD Settings</span>
                    <button class="tphud-help-close">&times;</button>
                </div>
                <div class="tphud-help-content tphud-settings-content">

                    <div class="tphud-help-sec">Badge Display</div>
                    <div class="tphud-setting-row">
                        <label class="tphud-setting-label" for="tphud-s-badgeMode">Badge shows</label>
                        <select class="tphud-setting-ctrl" id="tphud-s-badgeMode">
                            <option value="session"  ${s.badgeMode === 'session' ? 'selected' : ''}>Session (last N hands)</option>
                            <option value="lifetime" ${s.badgeMode === 'lifetime' ? 'selected' : ''}>Lifetime</option>
                        </select>
                    </div>
                    <div class="tphud-setting-row">
                        <label class="tphud-setting-label" for="tphud-s-sessionWindow">Session window</label>
                        <select class="tphud-setting-ctrl" id="tphud-s-sessionWindow">
                            <option value="15" ${s.sessionWindow === 15 ? 'selected' : ''}>15 hands</option>
                            <option value="25" ${s.sessionWindow === 25 ? 'selected' : ''}>25 hands</option>
                            <option value="30" ${s.sessionWindow === 30 ? 'selected' : ''}>30 hands</option>
                            <option value="50" ${s.sessionWindow === 50 ? 'selected' : ''}>50 hands</option>
                        </select>
                    </div>
                    <div class="tphud-setting-row">
                        <label class="tphud-setting-label" for="tphud-s-showAlert">Alert (!) on badge</label>
                        <select class="tphud-setting-ctrl" id="tphud-s-showAlert">
                            <option value="true"  ${s.showAlertOnBadge ? 'selected' : ''}>On</option>
                            <option value="false" ${!s.showAlertOnBadge ? 'selected' : ''}>Off</option>
                        </select>
                    </div>
                    <div class="tphud-setting-row">
                        <label class="tphud-setting-label" for="tphud-s-inlineStats">Inline stats on badge</label>
                        <select class="tphud-setting-ctrl" id="tphud-s-inlineStats">
                            <option value="true"  ${s.showInlineBadgeStats !== false ? 'selected' : ''}>On — VPIP/PFR/AFq (desktop)</option>
                            <option value="false" ${s.showInlineBadgeStats === false ? 'selected' : ''}>Off</option>
                        </select>
                    </div>

                    <div class="tphud-help-sec">Tilt Detection</div>
                    <div class="tphud-setting-row">
                        <label class="tphud-setting-label" for="tphud-s-tiltDelta">Sensitivity</label>
                        <select class="tphud-setting-ctrl" id="tphud-s-tiltDelta">
                            <option value="0.15" ${s.tiltDeltaThreshold === 0.15 ? 'selected' : ''}>High (15% VPIP shift)</option>
                            <option value="0.20" ${s.tiltDeltaThreshold === 0.20 ? 'selected' : ''}>Medium (20%)</option>
                            <option value="0.25" ${s.tiltDeltaThreshold === 0.25 ? 'selected' : ''}>Standard (25%) — default</option>
                            <option value="0.30" ${s.tiltDeltaThreshold === 0.30 ? 'selected' : ''}>Low (30%)</option>
                        </select>
                    </div>
                    <div class="tphud-setting-row">
                        <label class="tphud-setting-label" for="tphud-s-tiltWindow">Detection window</label>
                        <select class="tphud-setting-ctrl" id="tphud-s-tiltWindow">
                            <option value="5"  ${s.tiltWindow === 5 ? 'selected' : ''}>5 hands (reactive)</option>
                            <option value="8"  ${s.tiltWindow === 8 ? 'selected' : ''}>8 hands — default</option>
                            <option value="12" ${s.tiltWindow === 12 ? 'selected' : ''}>12 hands</option>
                            <option value="15" ${s.tiltWindow === 15 ? 'selected' : ''}>15 hands (stable)</option>
                        </select>
                    </div>
                    <div class="tphud-setting-row">
                        <label class="tphud-setting-label" for="tphud-s-tiltBanner">Tilt banner</label>
                        <select class="tphud-setting-ctrl" id="tphud-s-tiltBanner">
                            <option value="true"  ${s.tiltBanner !== false ? 'selected' : ''}>On — default</option>
                            <option value="false" ${s.tiltBanner === false ? 'selected' : ''}>Off</option>
                        </select>
                    </div>
                    <div class="tphud-setting-note">Floating banner when your play pattern shows tilt. Includes your session profit/loss so you know what's at stake.</div>

                    <div class="tphud-help-sec">Classification</div>
                    <div class="tphud-setting-row">
                        <label class="tphud-setting-label" for="tphud-s-minHands">Min hands to classify</label>
                        <select class="tphud-setting-ctrl" id="tphud-s-minHands">
                            <option value="3"  ${s.minHandsToClassify === 3 ? 'selected' : ''}>3 hands (fast)</option>
                            <option value="5"  ${s.minHandsToClassify === 5 ? 'selected' : ''}>5 hands — default</option>
                            <option value="8"  ${s.minHandsToClassify === 8 ? 'selected' : ''}>8 hands</option>
                            <option value="10" ${s.minHandsToClassify === 10 ? 'selected' : ''}>10 hands (strict)</option>
                        </select>
                    </div>

                    <div class="tphud-help-sec">Panel</div>
                    <div class="tphud-setting-row">
                        <label class="tphud-setting-label" for="tphud-s-defaultTab">Default tab</label>
                        <select class="tphud-setting-ctrl" id="tphud-s-defaultTab">
                            <option value="stats"   ${s.panelDefaultTab === 'stats' ? 'selected' : ''}>Stats</option>
                            <option value="hints"   ${s.panelDefaultTab === 'hints' ? 'selected' : ''}>Hints</option>
                            <option value="why"     ${s.panelDefaultTab === 'why' ? 'selected' : ''}>Profile</option>
                            <option value="tables"  ${s.panelDefaultTab === 'tables' ? 'selected' : ''}>Tables</option>
                            <option value="history" ${s.panelDefaultTab === 'history' ? 'selected' : ''}>History</option>
                        </select>
                    </div>

                    <div class="tphud-help-sec">Mobile</div>
                    <div class="tphud-setting-row">
                        <label class="tphud-setting-label" for="tphud-s-badgeTap">Badge tap (phone)</label>
                        <select class="tphud-setting-ctrl" id="tphud-s-badgeTap">
                            <option value="single" ${s.badgeTapMode !== 'double' ? 'selected' : ''}>Single tap — open immediately</option>
                            <option value="double" ${s.badgeTapMode === 'double' ? 'selected' : ''}>Double tap — reduces accidental opens</option>
                        </select>
                    </div>
                    <div class="tphud-setting-note">Double tap only applies on mobile. PC always uses single click.</div>
                    <div class="tphud-setting-row">
                        <label class="tphud-setting-label">Panel positions</label>
                        <button class="tphud-setting-ctrl" id="tphud-s-resetPos" type="button">Reset to default</button>
                    </div>
                    <div class="tphud-setting-note">Use this if the coach panel or launcher button ends up off-screen.</div>

                    <div class="tphud-help-sec">Turn Alert</div>
                    <div class="tphud-setting-row">
                        <label class="tphud-setting-label" for="tphud-s-turnAlert">Audio alert</label>
                        <select class="tphud-setting-ctrl" id="tphud-s-turnAlert">
                            <option value="false" ${!s.turnAlert ? 'selected' : ''}>Off — default</option>
                            <option value="true"  ${s.turnAlert ? 'selected' : ''}>On</option>
                        </select>
                    </div>
                    <div class="tphud-setting-row">
                        <label class="tphud-setting-label" for="tphud-s-turnAlertVolume">Alert volume</label>
                        <div class="tphud-scale-ctrl">
                            <input type="range" id="tphud-s-turnAlertVolume" class="tphud-scale-slider"
                                   min="0.05" max="1" step="0.05" value="${s.turnAlertVolume ?? 0.5}">
                            <span class="tphud-scale-val" id="tphud-s-turnAlertVolume-val">${Math.round((s.turnAlertVolume ?? 0.5) * 100)}%</span>
                        </div>
                    </div>
                    <div class="tphud-setting-note">Audio beep when it's your turn to act. Off by default.</div>

                    <div class="tphud-help-sec">Mr. Coach</div>
                    <div class="tphud-setting-row">
                        <label class="tphud-setting-label" for="tphud-s-coachMode">Coach mode</label>
                        <select class="tphud-setting-ctrl" id="tphud-s-coachMode">
                            <option value="on"    ${s.mrCoachMode === 'on' ? 'selected' : ''}>On — advises on every action</option>
                            <option value="quiet" ${s.mrCoachMode === 'quiet' ? 'selected' : ''}>Quiet — only speaks when confident</option>
                            <option value="off"   ${s.mrCoachMode === 'off' ? 'selected' : ''}>Off</option>
                        </select>
                    </div>
                    <div class="tphud-setting-note">Experimental - use as a guide, not a final decision.</div>
                    <div class="tphud-setting-row">
                        <label class="tphud-setting-label" for="tphud-s-coachHistory">Coach history</label>
                        <select class="tphud-setting-ctrl" id="tphud-s-coachHistory">
                            <option value="true"  ${s.coachHistory !== false ? 'selected' : ''}>On — keep old advice grayed below</option>
                            <option value="false" ${s.coachHistory === false ? 'selected' : ''}>Off — replace each update</option>
                        </select>
                    </div>
                    <div class="tphud-setting-row">
                        <label class="tphud-setting-label" for="tphud-s-betReaction">Bet reaction</label>
                        <select class="tphud-setting-ctrl" id="tphud-s-betReaction">
                            <option value="true"  ${s.betReaction !== false ? 'selected' : ''}>On — comment when sizing is unusual</option>
                            <option value="false" ${s.betReaction === false ? 'selected' : ''}>Off</option>
                        </select>
                    </div>
                    <div class="tphud-setting-row">
                        <label class="tphud-setting-label" for="tphud-s-coachPersonality">Coach voice</label>
                        <select class="tphud-setting-ctrl" id="tphud-s-coachPersonality">
                            <option value="default" ${s.coachPersonality !== 'duke' ? 'selected' : ''}>Default — standard coach</option>
                            <option value="duke"    ${s.coachPersonality === 'duke' ? 'selected' : ''}>Duke Calabrese</option>
                        </select>
                    </div>
                    <div class="tphud-setting-row">
                        <label class="tphud-setting-label" for="tphud-s-coachMinHands">Min hands for advice</label>
                        <select class="tphud-setting-ctrl" id="tphud-s-coachMinHands">
                            <option value="5"  ${s.coachMinHands === 5 ? 'selected' : ''}>5 hands</option>
                            <option value="8"  ${s.coachMinHands === 8 ? 'selected' : ''}>8 hands — default</option>
                            <option value="10" ${s.coachMinHands === 10 ? 'selected' : ''}>10 hands</option>
                            <option value="15" ${s.coachMinHands === 15 ? 'selected' : ''}>15 hands (strict)</option>
                        </select>
                    </div>
                    <div class="tphud-setting-row">
                        <label class="tphud-setting-label" for="tphud-s-coachLow">Thin read threshold</label>
                        <select class="tphud-setting-ctrl" id="tphud-s-coachLow">
                            <option value="8"  ${s.coachLowConfidenceThreshold === 8 ? 'selected' : ''}>Under 8 hands</option>
                            <option value="10" ${s.coachLowConfidenceThreshold === 10 ? 'selected' : ''}>Under 10 hands — default</option>
                            <option value="15" ${s.coachLowConfidenceThreshold === 15 ? 'selected' : ''}>Under 15 hands</option>
                        </select>
                    </div>
                    <div class="tphud-setting-row">
                        <label class="tphud-setting-label" for="tphud-s-coachMed">Solid read threshold</label>
                        <select class="tphud-setting-ctrl" id="tphud-s-coachMed">
                            <option value="20" ${s.coachMedConfidenceThreshold === 20 ? 'selected' : ''}>20 hands</option>
                            <option value="25" ${s.coachMedConfidenceThreshold === 25 ? 'selected' : ''}>25 hands — default</option>
                            <option value="30" ${s.coachMedConfidenceThreshold === 30 ? 'selected' : ''}>30 hands</option>
                            <option value="40" ${s.coachMedConfidenceThreshold === 40 ? 'selected' : ''}>40 hands (strict)</option>
                        </select>
                    </div>

                    <div class="tphud-help-sec">Range Reader</div>
                    <div class="tphud-setting-row">
                        <label class="tphud-setting-label" for="tphud-s-beatBubble">Range Reader bubble</label>
                        <select class="tphud-setting-ctrl" id="tphud-s-beatBubble">
                            <option value="true"  ${s.beatBubble !== false ? 'selected' : ''}>On — default</option>
                            <option value="false" ${s.beatBubble === false ? 'selected' : ''}>Off — hide the bubble entirely</option>
                        </select>
                    </div>
                    <div class="tphud-setting-note">Floating bubble showing the chance an active villain has a hand that beats you, based on their observed showdown range filtered by their preflop action and sizing. Click the bubble to open the full Range Reader modal (current hand · history · hands beating you). Turn off entirely if you don't want it on screen.</div>
                    <div class="tphud-setting-row">
                        <label class="tphud-setting-label" for="tphud-s-beatBubbleMinSample">Min showdowns to use a villain</label>
                        <select class="tphud-setting-ctrl" id="tphud-s-beatBubbleMinSample">
                            <option value="3"  ${s.beatBubbleMinSample === 3 ? 'selected' : ''}>3 shown hands</option>
                            <option value="4"  ${s.beatBubbleMinSample === 4 ? 'selected' : ''}>4 shown hands — default</option>
                            <option value="6"  ${s.beatBubbleMinSample === 6 ? 'selected' : ''}>6 shown hands</option>
                            <option value="10" ${s.beatBubbleMinSample === 10 ? 'selected' : ''}>10 shown hands (strict)</option>
                        </select>
                    </div>
                    <div class="tphud-setting-note">A villain needs at least this many showdown hands consistent with their current preflop line before their probability counts toward the aggregate. Lower = more reads but noisier; higher = fewer but more reliable.</div>

                    <div class="tphud-help-sec">Display Style</div>
                    <div class="tphud-setting-row">
                        <label class="tphud-setting-label" for="tphud-s-pokerTerms">Stat labels</label>
                        <select class="tphud-setting-ctrl" id="tphud-s-pokerTerms">
                            <option value="false" ${!s.usePokerTerms ? 'selected' : ''}>Plain English — default</option>
                            <option value="true"  ${s.usePokerTerms ? 'selected' : ''}>Poker terms (VPIP, PFR, AFq…)</option>
                        </select>
                    </div>

                    <div class="tphud-help-sec">Player Profiling</div>
                    <div class="tphud-setting-row">
                        <label class="tphud-setting-label" for="tphud-s-autoTag">Auto-tag notable plays</label>
                        <select class="tphud-setting-ctrl" id="tphud-s-autoTag">
                            <option value="true"  ${s.autoTagPlays !== false ? 'selected' : ''}>On — log overbets, check-raises (default)</option>
                            <option value="false" ${s.autoTagPlays === false ? 'selected' : ''}>Off</option>
                        </select>
                    </div>
                    <div class="tphud-setting-note">Automatically appends timestamped notes when a player makes an unusual play (overbet >150% pot, check-raise).</div>

                    <div class="tphud-help-sec">Torn API Integration</div>
                    ${isPDA() ? `
                    <div class="tphud-setting-note" style="color:#5b9bd5">TornPDA: API key is injected automatically from your TornPDA settings. No action needed here.</div>
                    ` : `
                    <div class="tphud-setting-row">
                        <label class="tphud-setting-label" for="tphud-s-tornApiKey">API key</label>
                        <input type="text" class="tphud-setting-ctrl" id="tphud-s-tornApiKey"
                               placeholder="Paste your Torn API key…"
                               value="${s.tornApiKey || ''}"
                               style="font-size:10px;min-width:160px;" />
                    </div>
                    <div class="tphud-setting-note">Optional — if set, fetches opponent net worth and shows a wealth tag on their badge. A minimal-access key is all that's needed. Get yours at <a href="https://www.torn.com/preferences.php#tab=api" target="_blank" style="color:#5b9bd5">torn.com preferences → API</a>.</div>
                    `}
                    <div class="tphud-setting-row">
                        <label class="tphud-setting-label" for="tphud-s-showNetworth">Wealth badge</label>
                        <select class="tphud-setting-ctrl" id="tphud-s-showNetworth">
                            <option value="true"  ${s.showNetworthBadge !== false ? 'selected' : ''}>On — show $X tag on badge</option>
                            <option value="false" ${s.showNetworthBadge === false ? 'selected' : ''}>Off</option>
                        </select>
                    </div>

                    <div class="tphud-help-sec">Cloud Sync</div>
                    <div class="tphud-setting-row">
                        <label class="tphud-setting-label" for="tphud-s-cloudSync">Sync with server</label>
                        <select class="tphud-setting-ctrl" id="tphud-s-cloudSync">
                            <option value="true"  ${s.cloudSync !== false ? 'selected' : ''}>On — share data across devices</option>
                            <option value="false" ${s.cloudSync === false ? 'selected' : ''}>Off</option>
                        </select>
                    </div>
                    <div class="tphud-setting-note">Pushes finished hands to ${SYNC_SERVER_URL.replace('https://', '')} and pulls merged player profiles, so every device sees the same reads. ${_syncQueue.length ? `${_syncQueue.length} hand(s) queued for upload.` : 'Queue is empty.'}</div>

                    <div class="tphud-help-sec">HUD Scale</div>
                    <div class="tphud-setting-row">
                        <label class="tphud-setting-label" for="tphud-s-scaleCoach">Coach panel</label>
                        <div class="tphud-scale-ctrl">
                            <input type="range" id="tphud-s-scaleCoach" class="tphud-scale-slider"
                                   min="0.7" max="1.5" step="0.05" value="${s.hudScaleCoach ?? 1.0}">
                            <span class="tphud-scale-val" id="tphud-s-scaleCoach-val">${Math.round((s.hudScaleCoach ?? 1.0) * 100)}%</span>
                        </div>
                    </div>
                    <div class="tphud-setting-row">
                        <label class="tphud-setting-label" for="tphud-s-scalePanels">Panels</label>
                        <div class="tphud-scale-ctrl">
                            <input type="range" id="tphud-s-scalePanels" class="tphud-scale-slider"
                                   min="0.7" max="1.5" step="0.05" value="${s.hudScalePanels ?? 1.0}">
                            <span class="tphud-scale-val" id="tphud-s-scalePanels-val">${Math.round((s.hudScalePanels ?? 1.0) * 100)}%</span>
                        </div>
                    </div>
                    <div class="tphud-setting-row">
                        <label class="tphud-setting-label" for="tphud-s-scaleHoverTip">Hover tip</label>
                        <div class="tphud-scale-ctrl">
                            <input type="range" id="tphud-s-scaleHoverTip" class="tphud-scale-slider"
                                   min="0.7" max="1.5" step="0.05" value="${s.hudScaleHoverTip ?? 1.0}">
                            <span class="tphud-scale-val" id="tphud-s-scaleHoverTip-val">${Math.round((s.hudScaleHoverTip ?? 1.0) * 100)}%</span>
                        </div>
                    </div>

                    <div class="tphud-help-sec">Stats Backup</div>
                    <div class="tphud-dim" style="font-size:10px;margin-bottom:6px">Export all player stats as JSON for backup or sharing. Import replaces all current stats.</div>
                    <div class="tphud-setting-row" style="justify-content:flex-start;gap:8px">
                        <button class="tphud-stats-export" type="button" style="font-size:11px;padding:4px 10px;background:#27ae60;color:#fff;border:none;border-radius:3px;cursor:pointer">Export stats</button>
                        <button class="tphud-stats-import" type="button" style="font-size:11px;padding:4px 10px;background:#3498db;color:#fff;border:none;border-radius:3px;cursor:pointer">Import stats</button>
                        <input class="tphud-stats-import-file" type="file" accept="application/json,.json" style="display:none">
                    </div>

                    <button class="tphud-settings-save">Save &amp; Apply</button>
                </div>
            </div>
        `;

        modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
        modal.querySelector('.tphud-help-close').addEventListener('click', () => modal.remove());

        // Stats export — downloads the full statsCache as a timestamped JSON file
        modal.querySelector('.tphud-stats-export').addEventListener('click', () => {
            const all = getStats();
            const blob = new Blob([JSON.stringify(all, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            const date = new Date().toISOString().slice(0, 10);
            a.href = url;
            a.download = `pokerhud-stats-${date}.json`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
        });

        // Stats import — file picker → confirm overwrite → replace statsCache → save
        const importFileInput = modal.querySelector('.tphud-stats-import-file');
        modal.querySelector('.tphud-stats-import').addEventListener('click', () => importFileInput.click());
        importFileInput.addEventListener('change', e => {
            const file = e.target.files?.[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = ev => {
                try {
                    const parsed = JSON.parse(ev.target.result);
                    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
                        window.alert('Import failed: file is not a valid stats JSON.');
                        return;
                    }
                    const incomingCount = Object.keys(parsed).length;
                    const currentCount = Object.keys(getStats()).length;
                    if (!window.confirm(`Replace all stats? Current: ${currentCount} player${currentCount === 1 ? '' : 's'} → Incoming: ${incomingCount} player${incomingCount === 1 ? '' : 's'}. This cannot be undone.`)) {
                        importFileInput.value = '';
                        return;
                    }
                    statsCache = parsed;
                    flushStatsSave();
                    refreshAllBadges();
                    window.alert(`Imported ${incomingCount} player records.`);
                } catch (err) {
                    window.alert('Import failed: ' + (err.message || err));
                }
                importFileInput.value = '';
            };
            reader.readAsText(file);
        });

        modal.querySelector('.tphud-settings-save').addEventListener('click', () => {
            const prevCoachMode = hudSettings.mrCoachMode;
            hudSettings = {
                badgeTapMode: modal.querySelector('#tphud-s-badgeTap').value,
                badgeMode: modal.querySelector('#tphud-s-badgeMode').value,
                sessionWindow: Number(modal.querySelector('#tphud-s-sessionWindow').value),
                showAlertOnBadge: modal.querySelector('#tphud-s-showAlert').value === 'true',
                showInlineBadgeStats: modal.querySelector('#tphud-s-inlineStats').value === 'true',
                tiltDeltaThreshold: Number(modal.querySelector('#tphud-s-tiltDelta').value),
                tiltWindow: Number(modal.querySelector('#tphud-s-tiltWindow').value),
                tiltBanner: modal.querySelector('#tphud-s-tiltBanner').value === 'true',
                minHandsToClassify: Number(modal.querySelector('#tphud-s-minHands').value),
                panelDefaultTab: modal.querySelector('#tphud-s-defaultTab').value,
                mrCoachMode: modal.querySelector('#tphud-s-coachMode').value,
                coachMinHands: Number(modal.querySelector('#tphud-s-coachMinHands').value),
                coachLowConfidenceThreshold: Number(modal.querySelector('#tphud-s-coachLow').value),
                coachMedConfidenceThreshold: Number(modal.querySelector('#tphud-s-coachMed').value),
                coachPanelPosition: hudSettings.coachPanelPosition || null,
                coachPanelPositionMobile: hudSettings.coachPanelPositionMobile || null,
                coachLauncherPosition: hudSettings.coachLauncherPosition || null,
                tlogBubblePosition: hudSettings.tlogBubblePosition || null,
                showSelfNote: hudSettings.showSelfNote !== false,
                usePokerTerms: modal.querySelector('#tphud-s-pokerTerms').value === 'true',
                coachHistory: modal.querySelector('#tphud-s-coachHistory').value === 'true',
                betReaction: modal.querySelector('#tphud-s-betReaction').value === 'true',
                coachPersonality: modal.querySelector('#tphud-s-coachPersonality').value,
                autoTagPlays: modal.querySelector('#tphud-s-autoTag').value === 'true',
                tornApiKey: isPDA() ? hudSettings.tornApiKey : modal.querySelector('#tphud-s-tornApiKey').value.trim(),
                showNetworthBadge: modal.querySelector('#tphud-s-showNetworth').value === 'true',
                cloudSync: modal.querySelector('#tphud-s-cloudSync').value === 'true',
                hudScaleCoach: Number(modal.querySelector('#tphud-s-scaleCoach').value),
                hudScalePanels: Number(modal.querySelector('#tphud-s-scalePanels').value),
                hudScaleHoverTip: Number(modal.querySelector('#tphud-s-scaleHoverTip').value),
                turnAlert: modal.querySelector('#tphud-s-turnAlert').value === 'true',
                turnAlertVolume: Number(modal.querySelector('#tphud-s-turnAlertVolume').value),
                beatBubble: modal.querySelector('#tphud-s-beatBubble').value === 'true',
                beatBubblePosition: hudSettings.beatBubblePosition || null,
                beatBubbleMinSample: Number(modal.querySelector('#tphud-s-beatBubbleMinSample').value),
            };
            saveSettings(hudSettings);
            applyHudScales();
            refreshAllBadges();
            syncCoachPanelVisibility();
            if (hudSettings.beatBubble) ensureBeatBubble(); else removeBeatBubble();
            refreshBeatBubble();
            if (hudSettings.cloudSync) syncInit();
            // Reflect coach mode change immediately on the panel
            if (hudSettings.mrCoachMode !== prevCoachMode && hudSettings.mrCoachMode !== 'off') {
                switchCoachTab(currentHand?.street || 'preflop');
            }
            modal.remove();
        });

        modal.querySelector('#tphud-s-resetPos').addEventListener('click', () => {
            hudSettings.coachPanelPosition = null;
            hudSettings.coachPanelPositionMobile = null;
            hudSettings.coachLauncherPosition = null;
            hudSettings.tlogBubblePosition = null;
            hudSettings.beatBubblePosition = null;
            saveSettings(hudSettings);
            updateCoachPanelLayout();
            const launcher = document.getElementById('tphud-coach-launcher');
            if (launcher) applyCoachLauncherPosition(launcher);
            const tlogBtn = document.getElementById('tphud-tlog-bubble');
            if (tlogBtn) { tlogBtn.style.left = ''; tlogBtn.style.top = ''; tlogBtn.style.right = ''; tlogBtn.style.bottom = ''; }
            const beatBtn = document.getElementById('tphud-beat-bubble');
            if (beatBtn) { beatBtn.style.left = ''; beatBtn.style.top = ''; beatBtn.style.right = ''; beatBtn.style.bottom = ''; }
            const btn = modal.querySelector('#tphud-s-resetPos');
            btn.textContent = 'Done!';
            setTimeout(() => { btn.textContent = 'Reset to default'; }, 1500);
        });

        document.body.appendChild(modal);
        modal.querySelector('.tphud-help-box').style.zoom = String(hudSettings.hudScalePanels);

        // Live percentage readouts for scale sliders
        [
            ['tphud-s-scaleCoach', 'tphud-s-scaleCoach-val'],
            ['tphud-s-scalePanels', 'tphud-s-scalePanels-val'],
            ['tphud-s-scaleHoverTip', 'tphud-s-scaleHoverTip-val'],
            ['tphud-s-turnAlertVolume', 'tphud-s-turnAlertVolume-val'],
        ].forEach(([sliderId, valId]) => {
            const slider = modal.querySelector(`#${sliderId}`);
            const valEl = modal.querySelector(`#${valId}`);
            if (slider && valEl) {
                slider.addEventListener('input', () => {
                    valEl.textContent = Math.round(Number(slider.value) * 100) + '%';
                });
            }
        });
    }

    // Re-renders the open panel in-place when the shown player's data changes
    function refreshPanelIfOpen(name, numericId) {
        const ap = activePanelPlayer;
        if (!ap.name) return;
        if (ap.name !== name && ap.numericId !== numericId && ap.numericId !== name) return;
        const existing = document.getElementById('tphud-panel');
        const savedLeft = existing?.style.left;
        const savedTop = existing?.style.top;
        const savedTransform = existing?.style.transform;
        const activeTab = existing?.querySelector('.tphud-tab-active')?.dataset?.tab || hudSettings.panelDefaultTab;
        const lostToChecked = existing?.querySelector('#tphud-hist-lost-to')?.checked || false;
        openPanel(ap.name, ap.numericId);
        const fresh = document.getElementById('tphud-panel');
        if (fresh) {
            if (savedLeft) {
                fresh.style.transform = savedTransform || 'none';
                fresh.style.left = savedLeft;
                fresh.style.top = savedTop;
            }
            if (activeTab !== 'stats') {
                const targetTab = fresh.querySelector(`.tphud-tab[data-tab="${activeTab}"]`);
                if (targetTab) targetTab.click();
            }
            if (lostToChecked) {
                const toggle = fresh.querySelector('#tphud-hist-lost-to');
                if (toggle) {
                    toggle.checked = true;
                    const list = fresh.querySelector('.tphud-hist-list');
                    if (list) list.classList.add('tphud-show-lost-to');
                }
            }
        }
    }

    // Draggable panel — drag by header, stays open on outside clicks
    function makeDraggable(panel) {
        const header = panel.querySelector('.tphud-header');
        if (!header) return;
        let startX, startY, startLeft, startTop;

        const beginDrag = (clientX, clientY) => {
            const rect = panel.getBoundingClientRect();
            startX = clientX; startY = clientY;
            startLeft = rect.left; startTop = rect.top;
            // Explicitly set scale(X) — never use '' — so the CSS class translate(-50%,-50%) can't bleed through.
            panel.style.transform = `scale(${hudSettings.hudScalePanels})`;
            panel.style.transformOrigin = 'top left';
            panel.style.left = startLeft + 'px';
            panel.style.top = startTop + 'px';
        };

        const applyDrag = (clientX, clientY) => {
            const pw = panel.offsetWidth || 300;
            const ph = panel.offsetHeight || 200;
            panel.style.left = clamp(startLeft + clientX - startX, 0, Math.max(0, window.innerWidth - pw)) + 'px';
            panel.style.top = clamp(startTop + clientY - startY, 0, Math.max(0, window.innerHeight - ph)) + 'px';
        };

        header.addEventListener('mousedown', e => {
            if (e.button !== 0) return;
            e.preventDefault();
            beginDrag(e.clientX, e.clientY);
            const onMove = e => applyDrag(e.clientX, e.clientY);
            const onUp = () => {
                document.removeEventListener('mousemove', onMove);
                document.removeEventListener('mouseup', onUp);
            };
            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onUp);
        });

        header.addEventListener('pointerdown', e => {
            if (e.pointerType === 'mouse') return;
            e.preventDefault();
            beginDrag(e.clientX, e.clientY);
            header.setPointerCapture(e.pointerId);
            const onMove = e => applyDrag(e.clientX, e.clientY);
            const onUp = () => {
                header.removeEventListener('pointermove', onMove);
                header.removeEventListener('pointerup', onUp);
            };
            header.addEventListener('pointermove', onMove);
            header.addEventListener('pointerup', onUp);
        });
    }

    function loadNotes() {
        try { return JSON.parse(localStorage.getItem(NOTES_KEY)) || {}; }
        catch { return {}; }
    }

    // ── Seat detection & badge attachment ────────────────────────

    let localPlayerName = null;
    let localPlayerId = null;

    // Session stack tracking — resets on page load, never persisted
    let sessionStartStack = null;
    let sessionPeakStack = null;
    let tiltBannerDismissedHands = 0;

    // ── Self-tilt banner ─────────────────────────────────────────

    function fmtChips(n) {
        if (n >= 1_000_000) return '$' + (n / 1_000_000).toFixed(2) + 'M';
        if (n >= 1_000) return '$' + (n / 1_000).toFixed(1) + 'K';
        return '$' + n;
    }

    function getTiltBannerEl() {
        let el = document.getElementById('tphud-tilt-banner');
        if (!el) {
            el = document.createElement('div');
            el.id = 'tphud-tilt-banner';
            el.className = 'tphud-tilt-banner';
            document.body.appendChild(el);
        }
        return el;
    }

    function hideTiltBanner() {
        const el = document.getElementById('tphud-tilt-banner');
        if (el) el.style.display = 'none';
    }

    function showTiltBanner(msg) {
        const el = getTiltBannerEl();
        el.innerHTML = `
            <span class="tphud-tilt-icon">⚠</span>
            <span class="tphud-tilt-msg">${msg}</span>
            <button class="tphud-tilt-dismiss">Got it — 5 hands</button>
        `;
        el.style.display = 'flex';
        el.querySelector('.tphud-tilt-dismiss').addEventListener('click', () => {
            tiltBannerDismissedHands = 5;
            hideTiltBanner();
        });
    }

    function checkSelfTilt() {
        if (!hudSettings.tiltBanner) { hideTiltBanner(); return; }

        if (tiltBannerDismissedHands > 0) {
            tiltBannerDismissedHands--;
            if (tiltBannerDismissedHands > 0) return;
        }

        // Update session stack using the already-maintained stackByName
        const stack = localPlayerName ? (stackByName[localPlayerName] ?? null) : null;
        if (stack !== null && stack > 0) {
            if (sessionStartStack === null) sessionStartStack = stack;
            if (sessionPeakStack === null || stack > sessionPeakStack) sessionPeakStack = stack;
        }

        // Only fire on behavioral tilt — VPIP spike vs lifetime baseline
        if (!localPlayerName) { hideTiltBanner(); return; }
        const s = resolveStatsByName(localPlayerName);
        const win = hudSettings.tiltWindow;
        if (!s || s.handsObserved < 20 || (s.recent?.length ?? 0) < win) { hideTiltBanner(); return; }

        const recent = s.recent.slice(-win);
        const recentV = recent.filter(h => h.vpip).length / recent.length;
        const lifetime = s.vpipCount / s.handsObserved;
        const shift = recentV - lifetime;

        if (shift < hudSettings.tiltDeltaThreshold) { hideTiltBanner(); return; }

        const pctUp = Math.round(shift * 100);
        let context = '';
        if (sessionStartStack && stack !== null) {
            const profit = stack - sessionStartStack;
            const lostFromPeak = sessionPeakStack - stack;
            if (lostFromPeak > 0 && profit > 0) {
                context = ` You've dropped ${fmtChips(lostFromPeak)} since your peak — but you're still ${fmtChips(profit)} up on the session. That's real money worth protecting.`;
            } else if (profit < 0) {
                context = ` You're also down ${fmtChips(Math.abs(profit))} on the session overall.`;
            }
        }

        showTiltBanner(
            `Your last ${win} hands you've been playing ${pctUp}% more hands than usual — that's a tilt pattern.${context} Take a breath before the next one.`
        );
    }

    function attachBadgesToSeats() {
        if (!isPageActive()) return;
        syncTableContextFromTexture();

        if (!localPlayerName || !localPlayerId) {
            const selfSeat = document.querySelector('[id^="player-"][class*="self___"]');
            if (selfSeat) {
                if (!localPlayerId) localPlayerId = selfSeat.id.replace('player-', '');
                if (!localPlayerName) {
                    // Prefer hudRawName if already captured, then details paragraph
                    if (selfSeat.dataset.hudRawName) {
                        localPlayerName = selfSeat.dataset.hudRawName;
                    } else {
                        const detailsEl = selfSeat.querySelector('[class^="details___"]');
                        const namePara = detailsEl?.querySelector('p');
                        if (namePara?.textContent?.trim()) localPlayerName = namePara.textContent.trim();
                    }
                }
            }
        }

        document.querySelectorAll('[id^="player-"]').forEach(seat => {
            const numericId = seat.id.replace('player-', '');
            const isSelf = seat.className.split(/\s+/).some(c => c.startsWith('self___'));

            if (isSelf && localPlayerName && seat.dataset.hudName && seat.dataset.hudName.startsWith('__self__:')) {
                delete seat.dataset.hudName;
                const old = seat.querySelector('.tphud-badge');
                if (old) old.remove();
                // Badge is cached under numericId (not the placeholder string), clear both to force recreation with real name
                delete badges[numericId];
                delete badges[`__self__:${numericId}`];
            }

            const nameEl = seat.querySelector('[class^="name___"]');
            let badgeAnchor = nameEl;

            if (!badgeAnchor && isSelf) {
                badgeAnchor = seat.querySelector('[class^="state___"]');
                if (!badgeAnchor) {
                    const items = seat.querySelectorAll('[class^="detailsItem___"]');
                    for (const item of items) {
                        const p = item.querySelector('p');
                        if (p && p.textContent.trim() === (seat.dataset.hudName || localPlayerName || '')) {
                            badgeAnchor = item;
                            break;
                        }
                    }
                    if (!badgeAnchor) {
                        const items2 = seat.querySelectorAll('[class^="detailsItem___"] p');
                        for (const p of items2) {
                            if (p.textContent.trim() && !/^\$/.test(p.textContent.trim())) {
                                badgeAnchor = p.parentElement;
                                break;
                            }
                        }
                    }
                }
            }
            if (!badgeAnchor) return;

            if (nameEl) {
                const rawRead = nameEl.textContent.trim();
                const badgePrefixes = ['MIX', 'RCK', 'LAG', 'TAG', 'NIT', 'STA', 'AGG', 'SHP', 'FSH', 'CLR', 'MAN', 'PSV', 'CTN', '▽', '△', '●', '!'];
                const looksClean = rawRead && !badgePrefixes.some(p => rawRead.startsWith(p));
                if (looksClean && !seat.dataset.hudRawName) seat.dataset.hudRawName = rawRead;
                if (!seat.dataset.hudName) {
                    const nameSource = seat.dataset.hudRawName || rawRead;
                    if (nameSource) seat.dataset.hudName = nameSource;
                }
            }

            if (!seat.dataset.hudName && isSelf) {
                if (localPlayerName) {
                    seat.dataset.hudName = localPlayerName;
                } else {
                    seat.dataset.hudName = `__self__:${numericId}`;
                }
            }

            const name = seat.dataset.hudName;
            if (!name) return;

            // Make opponent names clickable — opens their Torn profile in a new tab
            if (nameEl && !isSelf && numericId && !nameEl.dataset.profileLinked) {
                nameEl.style.cursor = 'pointer';
                nameEl.title = 'View Torn profile';
                nameEl.addEventListener('click', e => {
                    if (e.target.closest('.tphud-badge')) return;
                    e.stopPropagation();
                    window.open(`https://www.torn.com/profiles.php?XID=${numericId}`, '_blank');
                });
                nameEl.dataset.profileLinked = '1';
            }

            if (isSelf && !name.startsWith('__self__:') && localPlayerName !== name) localPlayerName = name;

            if (name && !name.startsWith('__self__:') && numericId) {
                chatNameToSeatId[name] = numericId;
            }

            // Carry stack history when player changes seat (re-entry after bust)
            const prevSeatId = nameToSeatId[name];
            const movedSeat = prevSeatId !== undefined && prevSeatId !== numericId;
            if (movedSeat && liveStacks[prevSeatId]) {
                liveStacks[numericId] = { ...liveStacks[prevSeatId] };
            }
            nameToSeatId[name] = numericId;

            // Fetch net worth for this opponent if not yet attempted this session
            if (numericId && !isSelf && !name.startsWith('__self__:') && !(numericId in networthCache)) {
                fetchNetWorth(numericId, networth => {
                    const all = getStats();
                    const s = resolveStatsByName(name, all);
                    if (s) {
                        s.networth = networth;
                        s.networthFetched = true;
                        refreshBadgeByName(name);
                        const updatedSeat = document.getElementById('player-' + numericId);
                        if (updatedSeat) syncNetworthIndicator(updatedSeat, name);
                    }
                });
            }

            // Fetch faction for this opponent if not yet attempted this session
            if (numericId && !name.startsWith('__self__:') && !(numericId in factionCache)) {
                fetchFaction(numericId, () => {
                    // Re-sync all current seats — a new arrival may flip shared status for others
                    document.querySelectorAll('[id^="player-"]').forEach(s => {
                        const n = s.dataset.hudBoundName;
                        if (n && !s.classList.contains('self___') && !s.className.includes('self___')) syncFactionIndicator(s, n);
                    });
                });
            }

            const prevBoundName = seat.dataset.hudBoundName;
            if (!movedSeat && prevBoundName && prevBoundName !== name) {
                const wasPlaceholder = prevBoundName.startsWith('__self__:');
                const isPlaceholder = name.startsWith('__self__:');
                if (!wasPlaceholder && !isPlaceholder) {
                    delete liveStacks[numericId];
                }
                const stale = seat.querySelector('.tphud-badge');
                if (stale) stale.remove();
            }
            seat.dataset.hudBoundName = name;

            // Read live stack and update liveStacks / stackByName
            const lsId = numericId;
            if (!liveStacks[lsId]) {
                liveStacks[lsId] = {
                    stack: null,
                    peakStack: null,
                    allIn: false,
                    rebuys: 0,
                    lastSeen: null,
                    startStack: null,
                    firstSeen: null,
                };
            }
            const ls = liveStacks[lsId];
            const rawStack = readPlayerStack(seat, isSelf);
            const stateEl = seat.querySelector('[class*="state___"]');
            const isAllInNow = rawStack === 0 || stateEl?.textContent?.trim() === 'All in';
            if (rawStack !== null) {
                if (rawStack > 0) {
                    // Only count rebuys from genuine short-stack → reload transitions after table is stable
                    const TABLE_STABLE_MS = 5000;
                    if (ls.stack !== null && !ls.allIn
                        && rawStack > ls.stack
                        && ls.stack <= (currentTableBB * 5)
                        && rawStack >= (currentTableBB * 20)
                        && ls.lowStackConfirmed
                        && Date.now() - lastTableSwitchTime > TABLE_STABLE_MS) {
                        ls.rebuys++;
                        ls.lowStackConfirmed = false;
                        saveLiveStacks();
                    }

                    // Track whether a low stack has been observed for at least one prior read
                    if (ls.stack !== null && ls.stack <= (currentTableBB * 5) && !ls.allIn) {
                        ls.lowStackConfirmed = true;
                    } else if (rawStack !== null && rawStack > (currentTableBB * 5)) {
                        ls.lowStackConfirmed = false;
                    }

                    const justStarted = ls.startStack == null;
                    if (ls.startStack == null) {
                        // Recover from session origin cache if liveStacks was cleared mid-session
                        const origin = _sessionOrigin[lsId];
                        ls.startStack = origin?.startStack ?? rawStack;
                        if (origin?.firstSeen != null) ls.firstSeen = origin.firstSeen;
                    }
                    if (ls.firstSeen == null) ls.firstSeen = Date.now();

                    const prevStack = ls.stack;
                    ls.stack = rawStack;
                    ls.peakStack = ls.peakStack === null ? rawStack : Math.max(ls.peakStack, rawStack);
                    ls.allIn = false;
                    ls.lastSeen = Date.now();
                    if (justStarted) {
                        console.log('[TPHUD-DEBUG] justStarted', lsId, 'startStack set to', ls.startStack);
                        saveLiveStacks(); // save after lastSeen is set so load doesn't skip this entry
                    }
                    if (name && !name.startsWith('__self__:')) stackByName[name] = rawStack;
                    if (prevStack !== rawStack) refreshPanelIfOpen(name, numericId);
                } else if (isAllInNow) {
                    const wasAllIn = ls.allIn;
                    ls.allIn = true;
                    ls.stack = 0;
                    if (!wasAllIn) refreshPanelIfOpen(name, numericId);
                }
            }
            // If rawStack is null: seat element exists but stack DOM is temporarily empty (common on mobile between hands).
            // Do not mutate liveStacks — keep last known values intact.


            if (!seat.querySelector('.tphud-badge')) {
                const badge = createBadge(name, numericId);
                if (isSelf) {
                    badge.classList.add('tphud-badge-self');
                    badgeAnchor.appendChild(badge);
                } else {
                    badgeAnchor.insertBefore(badge, badgeAnchor.firstChild);
                }
                syncSideStats(badge);
            } else {
                const existing = seat.querySelector('.tphud-badge');
                if (existing && badges[numericId || name] !== existing) {
                    if (badges[name] === existing) delete badges[name];
                    if (numericId && badges[numericId] === existing) delete badges[numericId];

                    const badge = createBadge(name, numericId);
                    if (isSelf) {
                        badge.classList.add('tphud-badge-self');
                        existing.replaceWith(badge);
                    } else {
                        existing.replaceWith(badge);
                    }
                    syncSideStats(badge);
                }
            }

            // Scale down long names so the badge doesn't push them into truncation
            if (nameEl && !isSelf) {
                const len = name.length;
                nameEl.style.fontSize = len > 11 ? '8px' : len > 7 ? '9px' : len > 5 ? '10px' : '';
            }

            // Auto-tag indicator: small note icon on the seat when the player has auto-tagged plays
            syncAutoTagIndicator(seat, name, numericId);
            if (!isSelf) syncNetworthIndicator(seat, name);
            if (!isSelf) syncFactionIndicator(seat, name);
            syncCollusionIndicator(seat, name);
            if (!isSelf) syncEmojiIndicators(seat, name);

            // Migrate stale name-keyed badge entry to numeric ID when both exist
            if (numericId && badges[name] && !badges[numericId]) {
                badges[numericId] = badges[name];
                delete badges[name];
            }
        });

        // Track whether this is a heads-up game so classification can be flagged
        const namedSeats = [...document.querySelectorAll('[id^="player-"]')]
            .filter(s => s.dataset.hudName);
        isHeadsUp = namedSeats.length === 2;

        // Reposition body-level side stats elements and remove any whose badge is gone
        Object.entries(sideStatsEls).forEach(([key, el]) => {
            const badge = badges[key];
            if (badge && badge.isConnected) positionSideStats(badge, el);
            else { el.remove(); delete sideStatsEls[key]; }
        });
        positionSelfPosEl();
    }

    // ── Message dedup & processing ───────────────────────────────

    // WeakSet: fast per-node dedup (catches same node seen twice in one session).
    // processedKeys: content-based dedup (catches re-rendered nodes with new identity but same text).
    // Cleared per hand in resetCoachLogs() so the set stays bounded.
    const processedMessages = new WeakSet();
    let processedKeys = new Set();

    function msgKey(node) {
        const text = node.textContent?.trim();
        return text ? text.slice(0, 200) : null;
    }

    function tryProcessMessage(node) {
        if (node.nodeType !== 1) return;
        const cls = typeof node.className === 'string' ? node.className : '';
        const isMsg = cls && (
            cls.split(/\s+/).some(c => c.startsWith('message___')) ||
            !!node.querySelector?.('i[class*="logIcon___"]')
        );
        if (!isMsg) return;

        if (!localPlayerName && cls.split(/\s+/).some(c => c.startsWith('current___'))) {
            const actor = node.querySelector('em')?.textContent?.trim();
            if (actor) {
                localPlayerName = actor;
                setTimeout(attachBadgesToSeats, 0);
            }
        }

        if (processedMessages.has(node)) return;
        processedMessages.add(node);

        // Secondary content-based check: if Torn re-renders the node, the WeakSet entry
        // is gone but the message text is identical — skip it to avoid double-processing.
        const key = msgKey(node);
        if (key && processedKeys.has(key)) return;
        if (key) processedKeys.add(key);

        try {
            processMessage(node);
        } catch (e) {
            // One bad message must never break processing of future messages.
            // If processMessage throws mid-handler (e.g. inside finalizeCurrentHand),
            // hand state can be corrupted — force a clean slate.
            if (currentHand?._handEnded) {
                currentHand = null;
                resetCoachLogs();
            }
        }
    }

    // ── Styles ───────────────────────────────────────────────────

    // Returns the local player's 1-indexed post-flop action position and total active seats.
    function getSelfPostflopPosition() {
        if (!currentHand) return null;

        // Resolve self seat ID — prefer cached, fall back to DOM
        const rawSelfId = localPlayerId
            || document.querySelector('[id^="player-"][class*="self___"]')?.id.replace('player-', '');
        if (!rawSelfId) return null;
        const selfId = String(rawSelfId);

        // Explicit falsy guard: String(null) = "null" which is truthy but not a valid seat id
        if (!currentHand.dealerSeatId) return null;
        const dealerId = String(currentHand.dealerSeatId);
        const pp = currentHand.perPlayer;
        const street = currentHand.street;

        // Post-flop: narrow to players who actually saw the flop (didn't fold preflop).
        // This is done by filtering seatOrder (which preserves clockwise order) using perPlayer data.
        // Preflop: use the full seatOrder — we show the post-flop position number from hand start,
        // so the player sees their upcoming post-flop position before cards come out.
        let base = currentHand.seatOrder?.length >= 2
            ? currentHand.seatOrder
            : [...document.querySelectorAll('[id^="player-"]')].map(s => s.id.replace('player-', ''));

        // Exclude players currently sitting out — they aren't dealt in
        const sittingOut = getSittingOutIds();
        if (sittingOut.size > 0) {
            const withoutSitouts = base.filter(id => !sittingOut.has(id));
            if (withoutSitouts.length >= 2) base = withoutSitouts;
        }

        let activeIds = base;

        if (Object.keys(pp).length > 0) {
            const nameMap = currentHand.seatNameMap || {};

            if (!street || street === 'preflop' || street === 'active') {
                // Preflop: start from all seats, subtract those who have already folded
                const foldedSeats = new Set(
                    Object.entries(pp)
                        .filter(([, p]) => p.foldedPreflop)
                        .map(([name]) => String(nameMap[name] || nameToSeatId[name] || chatNameToSeatId[name] || ''))
                        .filter(Boolean)
                );
                if (foldedSeats.size > 0) {
                    const filtered = base.filter(id => !foldedSeats.has(id));
                    if (filtered.length >= 2) activeIds = filtered;
                }
            } else {
                // Post-flop: keep only players who stayed through preflop
                const activeSeat = new Set(
                    Object.entries(pp)
                        .filter(([, p]) => p.inHandPreflop && !p.foldedPreflop)
                        .map(([name]) => String(nameMap[name] || nameToSeatId[name] || chatNameToSeatId[name] || ''))
                        .filter(Boolean)
                );
                const filtered = base.filter(id => activeSeat.has(id));
                if (filtered.length >= 2) activeIds = filtered;
            }
        }

        // Ensure both self and dealer are in the list; if not, fall back to full base
        if (!activeIds.includes(selfId) || !activeIds.includes(dealerId)) {
            activeIds = base;
        }
        if (!activeIds.includes(selfId) || !activeIds.includes(dealerId)) return null;

        const dealerIdx = activeIds.indexOf(dealerId);
        const selfIdx = activeIds.indexOf(selfId);
        const total = activeIds.length;
        const leftOfDealer = (dealerIdx + 1) % total;
        const pos = (selfIdx - leftOfDealer + total) % total + 1;
        return { pos, total };
    }

    // Shows or hides the post-flop position bubble to the left of the self seat,
    // below the V/P/A inline stats column (or alone there when inline stats are off).
    function updatePositionIndicator(street) {
        if (!street) {
            if (selfPosEl) { selfPosEl.remove(); selfPosEl = null; }
            selfPostflopPos = null;
            return;
        }

        const posData = getSelfPostflopPosition();
        if (!posData) {
            // Dealer detection is still resolving — keep the existing icon visible rather than
            // flashing it away. Only a null-street call (explicit clear) removes it.
            return;
        }

        const { pos, total } = posData;
        const ordinals = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th'];
        const ord = ordinals[pos - 1] || `${pos}th`;
        let tooltip;
        if (pos === 1) tooltip = `You act first post-flop (${ord} of ${total})`;
        else if (pos === total) tooltip = `You act last post-flop — button position (${ord} of ${total})`;
        else tooltip = `You act ${ord} of ${total} post-flop`;
        selfPostflopPos = { pos, total, tooltip };

        if (!selfPosEl) {
            selfPosEl = document.createElement('span');
            selfPosEl.className = 'tphud-pos-indicator';
            document.body.appendChild(selfPosEl);
        }
        selfPosEl.textContent = pos;
        selfPosEl.title = tooltip;
        positionSelfPosEl();
    }

    function injectStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .tphud-badge {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                min-width: 38px;
                height: 17px;
                padding: 0 5px;
                border: 1.5px solid #555;
                border-radius: 3px;
                cursor: pointer;
                font-size: 11px;
                font-weight: bold;
                font-family: monospace;
                letter-spacing: 0.5px;
                user-select: none;
                box-sizing: border-box;
                transition: filter 0.15s;
                text-shadow: 0 1px 3px rgba(0,0,0,0.9);
                touch-action: manipulation;
                -webkit-tap-highlight-color: transparent;
                pointer-events: auto !important;
                position: relative;
                z-index: 20;
                vertical-align: middle;
                flex: 0 0 auto;
                margin-left: 0;
                margin-right: 4px;
            }
            .tphud-badge:hover {
                filter: brightness(1.3);
            }
            .tphud-badge-self {
                outline: 2px solid rgba(255,220,50,0.7);
                outline-offset: 1px;
                margin-left: 0;
                margin-right: 4px;
            }
            .tphud-badge-side-stats {
                position: absolute;
                display: flex;
                flex-direction: column;
                align-items: flex-end;
                transform: translateY(-50%);
                font-size: 8px;
                font-weight: bold;
                font-family: monospace;
                line-height: 1.25;
                pointer-events: none;
                z-index: 10001;
                white-space: nowrap;
                background: rgba(18, 18, 18, 0.82);
                border-radius: 3px;
                padding: 2px 3px;
            }
            .tphud-pos-indicator {
                position: absolute;
                display: flex;
                align-items: center;
                justify-content: center;
                width: 17px;
                height: 17px;
                background: rgba(52, 152, 219, 0.85);
                color: #fff;
                border-radius: 50%;
                font-size: 10px;
                font-weight: bold;
                font-family: monospace;
                cursor: default;
                user-select: none;
                pointer-events: auto;
                z-index: 10001;
            }
            .tphud-self-tag {
                display: inline-block; background: rgba(255,220,50,0.15);
                border: 1px solid rgba(255,220,50,0.5); border-radius: 3px;
                color: #ffd700; font-size: 9px; font-weight: bold;
                padding: 0 4px; margin-right: 6px; vertical-align: middle;
                letter-spacing: 0.5px;
            }

            .tphud-panel {
                position: fixed; top: 50%; left: 50%; transform: translate(-50%,-50%);
                background: #1a1a1a; border: 1px solid #444; border-radius: 8px;
                padding: 16px; z-index: 10001; min-width: 300px; max-width: 360px;
                box-shadow: 0 6px 24px rgba(0,0,0,0.6);
            }
            .tphud-header {
                display: flex; justify-content: space-between; align-items: flex-start;
                margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid #2a2a2a;
                cursor: grab; user-select: none;
            }
            .tphud-header:active { cursor: grabbing; }
            .tphud-name  { color: #fff; font-size: 14px; font-weight: bold; margin: 0 0 3px; }
            .tphud-type  { font-size: 13px; font-weight: bold; margin-right: 6px; }
            .tphud-conf  { color: #666; font-size: 11px; }
            .tphud-close { background: none; border: none; color: #666; font-size: 20px; cursor: pointer; padding: 0; line-height: 1; }
            .tphud-close:hover { color: #fff; }

            .tphud-typedesc { color: #999; font-size: 11px; margin-bottom: 10px; line-height: 1.4; }

            .tphud-trend {
                background: rgba(241,196,15,0.1); border: 1px solid rgba(241,196,15,0.4);
                border-radius: 4px; color: #f1c40f; font-size: 11px;
                padding: 4px 8px; margin-bottom: 10px;
            }
            .tphud-detail-box {
                display: flex; justify-content: space-between; gap: 12px;
                background: #1f1f1f; border: 1px solid #2a2a2a; border-radius: 5px;
                padding: 6px 8px; margin-bottom: 10px;
            }
            .tphud-detail-item { display: flex; flex-direction: column; gap: 2px; }
            .tphud-detail-label {
                color: #666; font-size: 9px; text-transform: uppercase;
                letter-spacing: 0.6px;
            }
            .tphud-detail-value { color: #ddd; font-size: 11px; font-weight: bold; }
            .tphud-profit-pos { color: #2ecc71; }
            .tphud-profit-neg { color: #e74c3c; }

            .tphud-sec  { color: #666; font-size: 10px; text-transform: uppercase; letter-spacing: 1px; margin: 10px 0 6px; }
            .tphud-bars { display: flex; flex-direction: column; gap: 5px; }
            .tphud-row  { display: flex; align-items: center; gap: 6px; font-size: 11px; color: #aaa; }
            .tphud-row span { width: 110px; flex-shrink: 0; }
            .tphud-bar  { flex: 1; height: 8px; background: #2a2a2a; border-radius: 4px; overflow: hidden; }
            .tphud-bar div { height: 100%; border-radius: 4px; transition: width 0.3s; }
            .tphud-row b { color: #ccc; width: 34px; text-align: right; font-size: 11px; font-weight: normal; }
            .tphud-subtext { color: #555; font-size: 10px; margin-top: 4px; }

            .tphud-showdown  { display: flex; flex-wrap: wrap; gap: 6px; }
            .tphud-sd-stat   { font-size: 11px; color: #aaa; background: #222; border-radius: 3px; padding: 2px 7px; }

            .tphud-secondary { display: flex; flex-wrap: wrap; gap: 6px; }
            .tphud-stag { padding: 3px 9px; border: 1px solid; border-radius: 4px; font-size: 11px; font-weight: bold; }

            .tphud-notes { display: flex; flex-wrap: wrap; gap: 4px; align-items: flex-start; }
            .tphud-ntag  { padding: 2px 6px; background: #1a5a1a; border: 1px solid #2a8a2a; border-radius: 3px; color: #aef; font-size: 11px; }
            .tphud-ntext { width: 100%; color: #aaa; font-size: 11px; margin: 4px 0 0; white-space: pre-wrap; }
            .tphud-autotags { display: flex; flex-direction: column; gap: 3px; }
            .tphud-autotag  { font-size: 10px; color: #888; border-left: 2px solid #444; padding-left: 6px; line-height: 1.4; }
            .tphud-autotags-box { max-width: 520px; width: 94vw; }
            .tphud-autotags-content { overflow-y: auto; max-height: 60vh; padding: 10px 14px; display: flex; flex-direction: column; gap: 10px; }
            .tphud-autotag-entry { border-left: 2px solid #333; padding: 4px 0 4px 10px; display: flex; flex-direction: column; gap: 4px; }
            .tphud-at-label { font-size: 11px; color: #ccc; font-weight: bold; }
            .tphud-at-cards { display: flex; align-items: center; gap: 6px; }
            .tphud-at-cards-label { font-size: 9px; color: #555; min-width: 28px; }
            .tphud-at-street-sep { color: #444; margin: 0 3px; font-size: 10px; }
            .tphud-at-meta { font-size: 10px; color: #777; display: flex; align-items: center; gap: 4px; flex-wrap: wrap; }
            .tphud-at-sep { color: #444; }
            .tphud-at-insight { font-size: 10px; color: #f0c040; font-style: italic; line-height: 1.5; margin-top: 2px; }
            .tphud-seat-bottom {
                position: absolute; bottom: -13px; left: 50%; transform: translateX(-50%);
                display: flex; gap: 4px; align-items: center;
                z-index: 10; white-space: nowrap;
            }
            .tphud-emoji-indicators {
                display: inline-flex; gap: 2px; align-items: center;
            }
            .tphud-autotag-indicator {
                font-size: 9px; color: #888; background: rgba(0,0,0,0.6);
                border: 1px solid #444; border-radius: 3px;
                padding: 0 4px; line-height: 14px; cursor: pointer;
                transition: color .15s, border-color .15s;
            }
            .tphud-autotag-indicator:hover { color: #ccc; border-color: #777; }
            .tphud-networth-indicator {
                font-size: 9px; color: #fff; border-radius: 3px;
                padding: 0 4px; line-height: 14px; font-weight: bold; opacity: 0.9;
            }
            .tphud-faction-indicator {
                display: inline-flex; align-items: center; justify-content: center;
                width: 16px; height: 16px; border-radius: 3px; cursor: default;
                background: rgba(30,60,80,0.7); color: #7ab8d4; opacity: 0.9;
            }
            .tphud-faction-indicator[data-shared="1"] {
                background: rgba(100,10,10,0.7); color: #ff6666;
            }
            .tphud-faction-indicator[data-nofaction="1"] {
                background: rgba(40,40,40,0.6); color: #555;
            }
            .tphud-collusion-indicator {
                font-size: 9px; border-radius: 3px; cursor: pointer;
                padding: 0 4px; line-height: 14px; font-weight: bold;
                background: rgba(80,55,0,0.85); color: #ffcc00;
            }
            .tphud-susp-note {
                color: #555; font-size: 10px; margin-bottom: 12px; font-style: italic;
            }
            .tphud-susp-pair {
                border: 1px solid #2d2d00; border-radius: 6px; padding: 10px 12px;
                margin-bottom: 10px; background: rgba(60,45,0,0.18);
            }
            .tphud-susp-pair-hdr {
                display: flex; align-items: center; gap: 8px; margin-bottom: 8px;
                flex-wrap: wrap;
            }
            .tphud-susp-partner { color: #ffcc00; font-size: 12px; font-weight: bold; }
            .tphud-susp-faction-tag {
                font-size: 10px; padding: 1px 6px; border-radius: 3px;
                background: rgba(180,30,30,0.35); color: #ff7070; border: 1px solid #ff707040;
            }
            .tphud-susp-count { color: #666; font-size: 10px; margin-left: auto; }
            .tphud-susp-event {
                border: 1px solid #2a2a00; border-radius: 5px;
                padding: 8px 10px; margin-bottom: 8px; background: rgba(0,0,0,0.25);
            }
            .tphud-susp-event:last-child { margin-bottom: 0; }
            .tphud-susp-event-hdr {
                display: flex; align-items: center; gap: 8px; margin-bottom: 8px;
                flex-wrap: wrap;
            }
            .tphud-susp-type { color: #ffcc00; font-size: 11px; font-weight: bold; }
            .tphud-susp-hand { color: #555; font-size: 10px; font-family: monospace; }
            .tphud-susp-table { color: #4a7; font-size: 10px; }
            .tphud-susp-idx { color: #333; font-size: 10px; margin-left: auto; }
            .tphud-susp-event-body { display: flex; flex-direction: column; gap: 6px; }
            /* Player cards row */
            .tphud-susp-player-row {
                display: flex; align-items: stretch; gap: 6px;
            }
            .tphud-susp-player-card {
                flex: 1; border-radius: 4px; padding: 6px 8px;
                border: 1px solid transparent;
            }
            .tphud-susp-fold  { background: rgba(231,76,60,0.12);  border-color: #e74c3c40; }
            .tphud-susp-agg   { background: rgba(230,126,34,0.12); border-color: #e67e2240; }
            .tphud-susp-raise { background: rgba(230,126,34,0.12); border-color: #e67e2240; }
            .tphud-susp-3bet  { background: rgba(155,89,182,0.12); border-color: #9b59b640; }
            .tphud-susp-player-name { color: #eee; font-size: 11px; font-weight: bold; margin-bottom: 2px; }
            .tphud-susp-player-role { color: #666; font-size: 10px; margin-bottom: 3px; }
            .tphud-susp-stack { color: #888; font-size: 10px; }
            .tphud-susp-committed { font-size: 10px; font-weight: bold; margin-top: 1px; }
            .tphud-susp-vs {
                display: flex; align-items: center; color: #444; font-size: 10px;
                flex-shrink: 0; align-self: center;
            }
            /* Victims */
            .tphud-susp-victims {
                display: flex; align-items: center; flex-wrap: wrap; gap: 4px;
            }
            .tphud-susp-victim {
                font-size: 10px; padding: 1px 6px; border-radius: 3px;
                background: rgba(52,152,219,0.15); color: #5db8f5;
                border: 1px solid #3498db40;
            }
            /* Preflop action log */
            .tphud-susp-pf-log {
                border-left: 2px solid #333; padding-left: 8px;
            }
            .tphud-susp-pf-line { font-size: 10px; color: #888; margin-bottom: 2px; }
            .tphud-susp-actor { color: #aaa; font-weight: bold; }
            /* Board / cards rows */
            .tphud-susp-row {
                display: flex; align-items: center; gap: 8px; font-size: 10px;
            }
            .tphud-susp-label { color: #555; min-width: 95px; flex-shrink: 0; }
            .tphud-susp-cards { display: flex; gap: 2px; flex-wrap: wrap; }
            .tphud-susp-desc { color: #ccc; font-size: 11px; line-height: 1.5; }

            .tphud-dim { color: #555; font-size: 12px; margin-top: 4px; }

            .tphud-tabs { display: flex; gap: 3px; margin-bottom: 10px; }
            .tphud-tab {
                flex: 1; padding: 5px 0; background: #1e1e1e; border: 1px solid #333;
                border-radius: 4px; color: #666; font-size: 11px; cursor: pointer;
                transition: all .15s;
            }
            .tphud-tab:hover { background: #252525; color: #aaa; }
            .tphud-tab-active { background: #2a2a2a; border-color: #555; color: #eee; }
            .tphud-tabpane { max-height: 52vh; overflow-y: auto; padding-right: 8px; }
            .tphud-hidden { display: none !important; }

            .tphud-reasons {
                margin: 0; padding: 0; list-style: none;
                display: flex; flex-direction: column; gap: 7px;
            }
            .tphud-reasons li {
                color: #bbb; font-size: 11px; line-height: 1.5;
                padding-left: 12px; position: relative;
            }
            .tphud-reasons li::before {
                content: '›'; position: absolute; left: 0;
                color: #555; font-weight: bold;
            }
            .tphud-reasons li b { color: #ddd; }
            .tphud-reasons li i { color: #888; }

            .tphud-card {
                display: inline-flex; flex-direction: column; align-items: center;
                justify-content: center; width: 28px; height: 38px;
                background: #f0f0f0; border-radius: 4px; border: 1px solid #bbb;
                font-size: 10px; font-weight: bold; color: #111;
                font-family: monospace; line-height: 1.1; margin: 0 2px;
                vertical-align: middle; flex-shrink: 0;
            }
            .tphud-card-sm {
                width: 20px; height: 27px; font-size: 8px;
                border-radius: 3px; margin: 0 1px;
            }
            .tphud-card-xs {
                width: 15px; height: 20px; font-size: 6.5px;
                border-radius: 2px; margin: 0 1px;
            }
            .tphud-card-heart { color: #cc1111; }
            .tphud-card-diamond { color: #2d6cdf; }
            .tphud-card-club { color: #2e7d32; }
            .tphud-card-spade { color: #111; }

            .tphud-hentry {
                padding: 8px 10px; margin-bottom: 6px;
                background: #202020; border-radius: 5px;
                border-left: 3px solid #333;
            }
            .tphud-hentry:last-child { margin-bottom: 0; }
            .tphud-htop {
                display: flex; justify-content: space-between;
                align-items: center; margin-bottom: 5px;
            }
            .tphud-haction { color: #ccc; font-size: 11px; }
            .tphud-hriver {
                color: #aaa; font-size: 10px;
                background: #2a2a2a; padding: 1px 6px;
                border-radius: 3px; white-space: nowrap;
            }
            .tphud-hcards { display: flex; flex-direction: column; gap: 5px; margin: 5px 0 4px; }
            .tphud-hcard-row { display: flex; align-items: center; gap: 4px; flex-wrap: nowrap; }
            .tphud-hcard-board { opacity: 0.8; }
            .tphud-hcard-label { color: #555; font-size: 9px; width: 30px; flex-shrink: 0; }
            .tphud-hshowed { color: #9b59b6; font-size: 10px; font-style: italic; }
            .tphud-hhand-name { color: #888; font-size: 10px; font-style: italic; margin-left: 2px; }
            .tphud-hstreets { color: #aaa; font-size: 10px; margin: 3px 0 2px; line-height: 1.6; }
            .tphud-hverdict { margin-bottom: 3px; }
            .tphud-hout { font-size: 11px; font-weight: bold; }
            .tphud-hout-win  { color: #2ecc71; }
            .tphud-hout-lost { color: #e74c3c; }
            .tphud-hout-fold { color: #777; }
            .tphud-hlostto { display: none; margin: 3px 0 2px; align-items: center; gap: 3px; }
            .tphud-show-lost-to .tphud-hlostto { display: flex; }
            .tphud-hist-toggle { display: flex; align-items: center; gap: 5px; font-size: 10px; color: #888; margin-bottom: 6px; cursor: pointer; user-select: none; }
            .tphud-hist-toggle input { cursor: pointer; margin: 0; }

            .tphud-hint-card {
                border-left: 3px solid #444;
                padding: 8px 10px 8px 12px;
                margin-bottom: 10px;
                background: rgba(255,255,255,0.03);
                border-radius: 0 4px 4px 0;
            }
            .tphud-hint-card:last-child { margin-bottom: 0; }
            .tphud-hint-title {
                font-size: 10px; font-weight: bold; letter-spacing: 0.8px;
                text-transform: uppercase; margin-bottom: 6px;
            }
            .tphud-hint-body { color: #bbb; font-size: 11px; line-height: 1.65; }
            .tphud-hint-list {
                margin: 0; padding: 0 0 0 14px;
                display: flex; flex-direction: column; gap: 6px;
                color: #bbb; font-size: 11px; line-height: 1.55;
            }
            .tphud-hint-list li { padding-left: 2px; }
            .tphud-tab-hints { font-weight: bold; }

            .tphud-reset-row { display: flex; gap: 6px; margin-top: 14px; }
            .tphud-reset, .tphud-reset-all {
                flex: 1; padding: 6px;
                border-radius: 4px; font-size: 12px; cursor: pointer; transition: all .2s;
            }
            .tphud-reset { background: #2a1a1a; border: 1px solid #622; color: #c88; }
            .tphud-reset:hover { background: #3a1a1a; border-color: #933; color: #faa; }
            .tphud-reset-all { background: #1a1a2a; border: 1px solid #446; color: #88c; }
            .tphud-reset-all:hover { background: #1a1a3a; border-color: #669; color: #aaf; }

            .tphud-chips { display: flex; gap: 6px; margin-bottom: 6px; flex-wrap: wrap; }
            .tphud-chip {
                display: inline-flex; align-items: center; gap: 4px;
                padding: 3px 8px; border: 1.5px solid; border-radius: 4px;
                font-size: 11px; font-weight: bold; font-family: monospace;
                cursor: default; letter-spacing: 0.5px;
                text-shadow: 0 1px 3px rgba(0,0,0,0.9);
            }
            .tphud-chip-label { font-size: 9px; font-weight: normal; opacity: 0.7; font-family: sans-serif; letter-spacing: 0; }
            .tphud-read-source { margin-top: 3px; font-size: 10px; color: #555; letter-spacing: 0.3px; }
            .tphud-lifetime-note { margin-top: 6px; font-size: 10px; color: #444; }
            .tphud-tbl-lifetime {
                border-left-color: #333; margin-top: 10px;
                border-top: 1px solid #2a2a2a; padding-top: 10px;
            }
            .tphud-stake-chip {
                display: inline-block;
                background: rgba(52,73,94,0.5); border: 1px solid #3a4a5a;
                border-radius: 3px; color: #7fb3d3; font-size: 9px;
                padding: 1px 5px; margin-bottom: 4px;
            }

            .tphud-tbl-entry {
                padding: 8px 10px; margin-bottom: 6px;
                background: #1e1e1e; border-radius: 5px;
                border-left: 3px solid #2a2a2a;
            }
            .tphud-tbl-entry:last-child { margin-bottom: 0; }
            .tphud-tbl-current { border-left-color: #3a5a3a; background: #1e221e; }
            .tphud-tbl-top {
                display: flex; justify-content: space-between;
                align-items: center; margin-bottom: 4px;
            }
            .tphud-tbl-name  { color: #ccc; font-size: 12px; font-weight: bold; }
            .tphud-tbl-hands { color: #555; font-size: 10px; }
            .tphud-tbl-meta  { display: flex; align-items: center; gap: 8px; margin-bottom: 5px; font-size: 11px; }
            .tphud-tbl-tier  { color: #555; font-size: 10px; }
            .tphud-tbl-here  { color: #2ecc71; font-size: 9px; font-weight: normal; }
            .tphud-tbl-bars  { margin-top: 2px; }

            .tphud-pos-table { margin-top: 6px; padding-top: 4px; border-top: 1px solid #1d1d1d; font-size: 10px; }
            .tphud-pos-row   { display: grid; grid-template-columns: 32px 48px 1fr 1fr; gap: 4px; padding: 2px 0; align-items: center; }
            .tphud-pos-hdr   { color: #555; font-size: 9px; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid #1d1d1d; padding-bottom: 3px; margin-bottom: 2px; }
            .tphud-pos-name  { color: #aaa; font-weight: bold; }
            .tphud-pos-hands { color: #666; }
            .tphud-pos-stat  { color: #ccc; text-align: right; }

            .tphud-hover {
                position: fixed; z-index: 999999;
                background: #1a1a1a; border: 1px solid #333; border-radius: 6px;
                padding: 8px 10px; min-width: 190px; max-width: 260px;
                font-family: monospace; font-size: 11px; color: #ccc;
                pointer-events: none; box-shadow: 0 4px 16px rgba(0,0,0,0.6);
                line-height: 1.5;
            }
            .tphud-tip-type     { font-size: 13px; font-weight: bold; margin-bottom: 2px; }
            .tphud-tip-sub      { font-size: 9px; color: #666; margin-left: 5px; font-weight: normal; }
            .tphud-tip-lifetime { font-size: 10px; color: #888; margin-bottom: 2px; }
            .tphud-tip-divider  { border-top: 1px solid #2a2a2a; margin: 5px 0; }
            .tphud-tip-row      { margin: 2px 0; }
            .tphud-tip-dim      { color: #666; font-size: 10px; }
            .tphud-tip-alert    { font-size: 10px; margin: 2px 0; }
            .tphud-tip-tag      { font-size: 10px; margin: 2px 0; }
            .tphud-ci           { font-size: 9px; color: #777; font-weight: normal; margin-left: 2px; }

            /* Help button in panel header */
            .tphud-header-btns { display: flex; flex-direction: row; align-items: center; gap: 4px; flex-shrink: 0; }
            .tphud-hh-open {
                background: none; border: 1px solid #444; color: #777;
                font-size: 9px; font-weight: bold; cursor: pointer;
                height: 18px; border-radius: 3px;
                display: flex; align-items: center; justify-content: center;
                padding: 0 4px; line-height: 1; transition: all .15s;
            }
            .tphud-hh-open:hover { color: #fff; border-color: #888; background: #2a2a2a; }
            .tphud-lb-open {
                background: none; border: 1px solid #444; color: #777;
                font-size: 9px; font-weight: bold; cursor: pointer;
                height: 18px; border-radius: 3px;
                display: flex; align-items: center; justify-content: center;
                padding: 0 4px; line-height: 1; transition: all .15s;
            }
            .tphud-lb-open:hover { color: #fff; border-color: #888; background: #2a2a2a; }
            .tphud-lb-box { max-width: 620px; width: 96vw; }
            .tphud-lb-sort-row {
                display: flex; align-items: center; gap: 6px; flex-wrap: wrap;
                padding: 8px 12px; border-bottom: 1px solid #2a2a2a; font-size: 11px; color: #777;
            }
            .tphud-lb-sort {
                background: none; border: 1px solid #444; color: #777;
                font-size: 10px; padding: 2px 7px; border-radius: 3px; cursor: pointer;
            }
            .tphud-lb-sort:hover { color: #eee; border-color: #777; }
            .tphud-lb-sort-active { color: #eee; border-color: #888; background: #2a2a2a; }
            .tphud-lb-hint { margin-left: auto; font-size: 9px; color: #555; }
            .tphud-lb-table-wrap { overflow-y: auto; max-height: 55vh; padding: 0 12px 12px; }
            .tphud-lb-table { width: 100%; border-collapse: collapse; font-size: 11px; }
            .tphud-lb-table th {
                text-align: left; color: #666; font-weight: normal;
                padding: 6px 4px 4px; border-bottom: 1px solid #2a2a2a; position: sticky; top: 0; background: #1a1a1a;
            }
            .tphud-lb-table td { padding: 5px 4px; border-bottom: 1px solid #1e1e1e; }
            .tphud-lb-row:hover td { background: #1f1f1f; }
            .tphud-lb-rank { color: #555; width: 24px; }
            .tphud-lb-cell { color: #bbb; }
            .tphud-lb-namelink {
                background: none; border: none; color: #7eb8f5; cursor: pointer;
                font-size: 11px; padding: 0; text-align: left; text-decoration: underline;
            }
            .tphud-lb-namelink:hover { color: #aed4ff; }
            .tphud-help {
                background: none; border: 1px solid #444; color: #777;
                font-size: 11px; font-weight: bold; cursor: pointer;
                width: 18px; height: 18px; border-radius: 50%;
                display: flex; align-items: center; justify-content: center;
                padding: 0; line-height: 1; transition: all .15s;
            }
            .tphud-help:hover { color: #fff; border-color: #888; background: #2a2a2a; }

            /* Glossary modal */
            .tphud-help-modal {
                position: fixed; inset: 0; z-index: 11000;
                background: rgba(0,0,0,0.65);
                display: flex; align-items: center; justify-content: center;
            }
            .tphud-help-box {
                background: #1a1a1a; border: 1px solid #444; border-radius: 8px;
                width: 520px; max-width: 95vw; max-height: 80vh;
                display: flex; flex-direction: column;
                box-shadow: 0 8px 32px rgba(0,0,0,0.7);
            }
            .tphud-help-header {
                display: flex; justify-content: space-between; align-items: center;
                padding: 12px 16px; border-bottom: 1px solid #2a2a2a; flex-shrink: 0;
            }
            .tphud-help-title { color: #eee; font-size: 13px; font-weight: bold; }
            .tphud-help-close {
                background: none; border: none; color: #666; font-size: 20px;
                cursor: pointer; padding: 0; line-height: 1;
            }
            .tphud-help-close:hover { color: #fff; }
            .tphud-help-content { overflow-y: auto; padding: 12px 16px; }
            .tphud-help-sec {
                color: #555; font-size: 10px; text-transform: uppercase;
                letter-spacing: 1px; margin: 14px 0 6px;
            }
            .tphud-help-sec:first-child { margin-top: 0; }
            .tphud-help-grid {
                display: grid; grid-template-columns: 110px 1fr;
                gap: 4px 10px; align-items: baseline;
            }
            .tphud-help-term {
                color: #e0c97a; font-size: 11px; font-weight: bold;
                font-family: monospace; padding: 2px 0;
            }
            .tphud-help-def { color: #aaa; font-size: 11px; line-height: 1.5; padding: 2px 0; }

            /* Gift button */
            .tphud-gift {
                background: none; border: none; font-size: 13px; cursor: pointer;
                padding: 0; line-height: 1; opacity: 0.6; transition: opacity .15s, transform .15s;
            }
            .tphud-gift:hover { opacity: 1; transform: scale(1.2); }

            /* Donate modal */
            .tphud-donate-box { max-width: 380px; }
            .tphud-donate-content { padding: 16px 20px 20px; }
            .tphud-donate-p { color: #bbb; font-size: 12px; line-height: 1.7; margin: 0 0 12px; }
            .tphud-donate-note { color: #555; font-size: 11px; font-style: italic; }
            .tphud-donate-link {
                display: block; text-align: center;
                background: rgba(46,204,113,0.12); border: 1px solid rgba(46,204,113,0.35);
                color: #2ecc71; font-size: 12px; font-weight: bold;
                border-radius: 6px; padding: 10px 16px;
                text-decoration: none; transition: all .15s;
            }
            .tphud-donate-link:hover { background: rgba(46,204,113,0.22); border-color: #2ecc71; }
            .tphud-donate-sig { color: #555; font-size: 12px; font-style: italic; margin: 0; text-align: right; }
            .tphud-donate-supporters { margin-top: 18px; border-top: 1px solid #2a2a2a; padding-top: 14px; }
            .tphud-donate-supporters-title { text-align: center; color: #e74c3c; font-size: 11px; font-weight: bold; letter-spacing: 0.5px; margin-bottom: 10px; }
            .tphud-donate-supporter-row { display: flex; justify-content: space-between; align-items: center; padding: 4px 0; border-bottom: 1px solid #1e1e1e; }
            .tphud-donate-supporter-row:last-child { border-bottom: none; }
            .tphud-donate-supporter-name { color: #ccc; font-size: 12px; }
            .tphud-donate-supporter-gift { color: #f39c12; font-size: 11px; }
            .tphud-donate-supporters-more-toggle { color: #888; font-size: 11px; cursor: pointer; padding: 5px 0 3px; user-select: none; }
            .tphud-donate-supporters-more-toggle:hover { color: #ccc; }
            .tphud-donate-supporters-more-toggle.open { color: #aaa; }
            .tphud-donate-supporters-more-toggle.open::before { content: '▾ '; }
            .tphud-donate-supporters-more-toggle:not(.open)::before { content: '▸ '; }

            /* Hand history modal */
            .tphud-hh-box { max-width: 600px; width: 95vw; }
            .tphud-hh-content { overflow-y: auto; padding: 8px 12px; display: flex; flex-direction: column; gap: 12px; }
            .tphud-hh-entry { border: 1px solid #2a2a2a; border-radius: 6px; overflow: hidden; }
            .tphud-hh-entry-hdr {
                display: flex; align-items: center; gap: 8px;
                padding: 6px 10px; background: #222; border-bottom: 1px solid #2a2a2a;
            }
            .tphud-hh-label { color: #bbb; font-size: 11px; font-weight: bold; flex: 1; }
            .tphud-hh-time  { color: #555; font-size: 10px; }
            .tphud-hh-copy {
                background: rgba(255,255,255,0.05); border: 1px solid #444; color: #aaa;
                font-size: 10px; border-radius: 3px; padding: 2px 8px; cursor: pointer; transition: all .15s;
            }
            .tphud-hh-copy:hover { background: rgba(255,255,255,0.12); color: #fff; }
            .tphud-hh-pre {
                margin: 0; padding: 8px 10px; font-family: monospace; font-size: 11px;
                color: #ccc; white-space: pre-wrap; word-break: break-word;
                background: #141414; max-height: 260px; overflow-y: auto;
            }

            /* Previous hand coach modal */
            .tphud-pc-tabs {
                display: flex; gap: 2px; padding: 6px 10px 0;
                border-bottom: 1px solid #2a2a2a; flex-shrink: 0;
            }
            .tphud-pc-tab {
                background: none; border: 1px solid #333; border-bottom: none;
                color: #666; font-size: 10px; cursor: pointer; padding: 3px 10px;
                border-radius: 3px 3px 0 0; transition: all .15s;
            }
            .tphud-pc-tab-active { background: #1e1e1e; color: #ccc; border-color: #444; }
            .tphud-pc-tab:hover:not(.tphud-pc-tab-active) { color: #aaa; }
            .tphud-pc-pane { padding: 8px 12px; display: flex; flex-direction: column; gap: 6px; }
            .tphud-pc-entry {
                padding: 6px 8px; border-left: 2px solid #2a2a2a; background: #181818; border-radius: 0 3px 3px 0;
            }
            .tphud-pc-self { border-left-color: #3a6ea5; }
            .tphud-pc-nameline { display: flex; align-items: center; gap: 6px; margin-bottom: 3px; }
            .tphud-pc-name { color: #ccc; font-size: 11px; font-weight: bold; }
            .tphud-pc-chip { color: #888; font-size: 10px; }
            .tphud-pc-msg { color: #aaa; font-size: 11px; line-height: 1.5; }
            .tphud-pc-self-msg { color: #7fb3d3; }
            .tphud-pc-compact { padding: 2px 0; font-size: 10px; opacity: 0.6; }
            .tphud-pc-dim { color: #666; }
            .tphud-pc-narr { color: #444; font-size: 10px; font-style: italic; padding: 2px 0; }

            /* Range tab */
            .tphud-range-summary { color: #555; font-size: 10px; margin-bottom: 6px; }
            .tphud-range-controls { display: flex; align-items: center; gap: 10px; margin-bottom: 6px; }
            .tphud-range-filter-label { font-size: 10px; color: #555; display: flex; align-items: center; gap: 4px; }
            .tphud-range-filter { background: #1a1a1a; border: 1px solid #333; color: #aaa; font-size: 10px; padding: 2px 4px; border-radius: 3px; }
            .tphud-range-header {
                display: grid; grid-template-columns: 40px 36px 1fr 1fr 1fr;
                gap: 0 6px; padding: 0 4px 4px; border-bottom: 1px solid #2a2a2a;
                color: #444; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px;
            }
            .tphud-range-sort { cursor: pointer; user-select: none; }
            .tphud-range-sort:hover { color: #888; }
            .tphud-range-sort.tphud-sort-active { color: #aaa; }
            .tphud-range-sort.tphud-sort-desc::after { content: ' ▼'; font-size: 8px; }
            .tphud-range-sort.tphud-sort-asc::after  { content: ' ▲'; font-size: 8px; }
            .tphud-range-list { max-height: 300px; overflow-y: auto; }
            .tphud-range-row {
                display: grid; grid-template-columns: 40px 36px 1fr 1fr 1fr;
                gap: 0 6px; padding: 3px 4px; border-bottom: 1px solid #1c1c1c;
                align-items: center; min-height: 26px;
            }
            .tphud-range-row:last-child { border-bottom: none; }
            .tphud-range-hand  { display: flex; align-items: center; }
            .tphud-range-count { color: #666; font-size: 11px; }
            .tphud-range-vpip  { font-size: 11px; }
            .tphud-range-pct   { font-size: 11px; }
            .tphud-range-pfr   { color: #888; font-size: 11px; }
            .tphud-range-bb    { color: #3498db; font-size: 11px; font-family: monospace; }
            .tphud-range-list-opp { max-height: 260px; overflow-y: auto; }
            .tphud-range-row-opp {
                display: grid; grid-template-columns: 40px 28px 1fr 1fr 1fr 1fr;
                gap: 0 4px; padding: 3px 4px; border-bottom: 1px solid #1c1c1c;
                align-items: center; min-height: 26px;
            }
            .tphud-range-row-opp:last-child { border-bottom: none; }
            .tphud-range-header-opp { grid-template-columns: 40px 28px 1fr 1fr 1fr 1fr; }

            /* Mr. Coach floating panel */
            .tphud-coach {
                position: fixed; right: 18px; bottom: 90px;
                background: linear-gradient(180deg, #15181c, #0f1113);
                border: 1px solid rgba(255,255,255,0.10); border-radius: 12px;
                z-index: 9999; width: 320px; font-family: "Trebuchet MS", "Segoe UI", sans-serif;
                box-shadow: 0 10px 30px rgba(0,0,0,0.55);
                overflow: hidden;
                transition: border-color .25s, box-shadow .25s, transform .2s;
            }
            .tphud-coach.tphud-coach-new {
                border-color: rgba(46,204,113,0.70);
                box-shadow: 0 10px 30px rgba(0,0,0,0.55), 0 0 0 2px rgba(46,204,113,0.16);
            }
            .tphud-coach-header {
                display: flex; align-items: center; justify-content: space-between;
                padding: 10px 12px; border-bottom: 1px solid rgba(255,255,255,0.08);
                background: #111418;
                cursor: move; user-select: none;
            }
            .tphud-coach-title-area {
                display: flex; align-items: center; gap: 7px;
            }
            .tphud-coach-avatar {
                width: 26px; height: 26px; border-radius: 50%;
                object-fit: cover; border: 1px solid #f0b35b; flex-shrink: 0;
            }
            .tphud-coach-title {
                color: #f0b35b; font-size: 12px; font-weight: 700; letter-spacing: 0.6px;
                text-transform: uppercase;
            }
            .tphud-coach-hdr-btns {
                display: flex; align-items: center; gap: 6px;
            }
            .tphud-coach-hdr-btn {
                background: none; border: none; color: #7a7a7a; font-size: 14px;
                cursor: pointer; padding: 2px 4px; line-height: 1; border-radius: 3px;
                transition: color .15s, background .15s;
            }
            .tphud-coach-hdr-btn:hover { color: #d0d0d0; background: rgba(255,255,255,0.07); }
            .tphud-coach-min { font-size: 16px; }
            .tphud-coach-body {
                padding: 8px 0; max-height: 48vh; overflow-y: auto;
            }
            .tphud-coach-entry {
                padding: 8px 12px; border-bottom: 1px solid rgba(255,255,255,0.06);
            }
            .tphud-coach-entry:last-of-type { border-bottom: none; }
            .tphud-coach-name-row {
                display: flex; align-items: center; gap: 6px; margin-bottom: 4px;
            }
            .tphud-coach-name {
                color: #f0f0f0; font-size: 12px; font-weight: 700;
            }
            .tphud-coach-actchip {
                background: rgba(255,255,255,0.06); color: #c0c0c0; font-size: 10px;
                border-radius: 999px; padding: 2px 8px; white-space: nowrap;
                border: 1px solid rgba(255,255,255,0.10);
            }
            .tphud-coach-chip {
                display: inline-block; border-radius: 999px; padding: 2px 8px;
                font-size: 10px; font-weight: 700; margin-bottom: 4px;
                letter-spacing: 0.3px;
            }
            .tphud-coach-entry-msg {
                color: #d2d2d2; font-size: 11.5px; line-height: 1.45;
            }
            .tphud-coach-self { border-top: 1px solid rgba(46,204,113,0.25); background: rgba(46,204,113,0.06); }
            .tphud-coach-name-self { color: #2ecc71; }
            .tphud-coach-self-note { color: #b5b5b5; margin-top: 3px; font-style: italic; }
            .tphud-bet-reaction { color: #5bbfff; margin-top: 4px; font-style: italic; font-size: 11px; }
            .tphud-coach-narrative {
                color: #f3c263;
                margin-top: 3px;
                border-left: 2px solid #f3c263;
                padding-left: 6px;
                font-size: 10.5px;
                line-height: 1.25;
                display: -webkit-box;
                -webkit-line-clamp: 2;
                -webkit-box-orient: vertical;
                overflow: hidden;
            }
            .tphud-coach-msg {
                color: #7a7a7a; font-size: 11px; padding: 6px 12px; font-style: italic;
            }
            .tphud-coach-tabs {
                display: grid; grid-template-columns: repeat(4, 1fr);
                border-bottom: 1px solid rgba(255,255,255,0.08); background: #0f1113;
            }
            .tphud-coach-tab {
                background: none; border: none; border-right: 1px solid rgba(255,255,255,0.05);
                color: #7a7a7a; font-size: 10px; padding: 6px 0; cursor: pointer;
                text-transform: uppercase; letter-spacing: 0.6px;
                transition: color .15s, background .15s;
            }
            .tphud-coach-tab:last-child { border-right: none; }
            .tphud-coach-tab:disabled { color: #3a3a3a; cursor: default; }
            .tphud-coach-tab:not(:disabled):hover { background: rgba(255,255,255,0.04); color: #b5b5b5; }
            .tphud-coach-tab-active { color: #86b7ff !important; border-bottom: 2px solid #86b7ff; }
            .tphud-coach-tab-has-data { color: #a5a5a5 !important; }
            .tphud-coach-tab-has-data.tphud-coach-tab-active { color: #86b7ff !important; }

            .tphud-coach.tphud-coach-mobile {
                right: 8px; top: 72px; left: auto; bottom: auto;
                width: 72vw; max-width: 300px; height: auto;
                font-size: 0.87em;
                border-radius: 12px;
            }
            .tphud-coach.tphud-coach-mobile .tphud-coach-header {
                cursor: grab; touch-action: none;
                padding: 8px 10px;
            }
            .tphud-coach.tphud-coach-mobile .tphud-coach-body {
                max-height: 38vh;
                padding: 4px 0;
            }
            .tphud-coach.tphud-coach-mobile .tphud-coach-tabs { display: none; }
            .tphud-coach.tphud-coach-mobile .tphud-coach-narrative { display: none; }
            .tphud-coach.tphud-coach-mobile .tphud-coach-self-note { display: none; }
            .tphud-coach.tphud-coach-mobile .tphud-coach-entry { padding: 5px 8px; }

            .tphud-coach-launcher {
                position: fixed; right: 16px; bottom: 14px;
                width: 56px; height: 56px; border-radius: 999px;
                border: 1px solid rgba(255,255,255,0.15);
                background: linear-gradient(180deg, #181b20, #0f1113);
                color: #f0b35b; font-size: 11px; font-weight: 700;
                letter-spacing: 0.6px; text-transform: uppercase;
                display: flex; align-items: center; justify-content: center;
                box-shadow: 0 8px 24px rgba(0,0,0,0.5);
                z-index: 10000; cursor: pointer;
                user-select: none; -webkit-user-select: none;
                touch-action: none; -webkit-tap-highlight-color: transparent;
            }
            .tphud-coach-launcher-hot {
                box-shadow: 0 8px 24px rgba(0,0,0,0.5), 0 0 0 2px rgba(46,204,113,0.25);
                border-color: rgba(46,204,113,0.6);
            }
            .tphud-coach-launcher-open {
                color: #86b7ff;
                border-color: rgba(134,183,255,0.5);
            }

            /* Table Session Log bubble */
            .tphud-tlog-bubble {
                position: fixed; left: 16px; bottom: 14px;
                width: 56px; height: 56px; border-radius: 999px;
                border: 1px solid rgba(255,255,255,0.15);
                background: linear-gradient(180deg, #181b20, #0f1113);
                color: #7eb8f7; font-size: 11px; font-weight: 700;
                letter-spacing: 0.6px; text-transform: uppercase;
                display: flex; align-items: center; justify-content: center;
                box-shadow: 0 8px 24px rgba(0,0,0,0.5);
                z-index: 10000; cursor: grab;
                user-select: none; -webkit-user-select: none;
                touch-action: none; -webkit-tap-highlight-color: transparent;
                transition: border-color .15s, color .15s;
            }
            .tphud-tlog-bubble:hover { border-color: rgba(126,184,247,0.5); }

            /* Beat-you bubble */
            .tphud-beat-bubble {
                position: fixed; left: 88px; bottom: 14px;
                width: 56px; height: 56px; border-radius: 999px;
                border: 1px solid rgba(255,255,255,0.15);
                background: linear-gradient(180deg, #181b20, #0f1113);
                color: #ccc; font-size: 14px; font-weight: 700;
                letter-spacing: 0.2px;
                display: flex; align-items: center; justify-content: center;
                box-shadow: 0 8px 24px rgba(0,0,0,0.5);
                z-index: 10000; cursor: grab;
                user-select: none; -webkit-user-select: none;
                touch-action: none; -webkit-tap-highlight-color: transparent;
                transition: border-color .15s, color .15s, box-shadow .15s;
            }
            .tphud-beat-bubble:hover { border-color: rgba(255,255,255,0.4); }
            .tphud-beat-bubble-empty { color: #777; }
            .tphud-beat-bubble-cool  { color: #2ecc71; border-color: rgba(46,204,113,0.5); }
            .tphud-beat-bubble-warm  { color: #e67e22; border-color: rgba(230,126,34,0.5); }
            .tphud-beat-bubble-hot   { color: #e74c3c; border-color: rgba(231,76,60,0.6); box-shadow: 0 8px 24px rgba(0,0,0,0.5), 0 0 0 2px rgba(231,76,60,0.25); }

            /* Beat-you modal */
            .tphud-beat-box {
                width: 620px; max-width: 96vw;
                background: linear-gradient(180deg, #1a1d22, #131518);
                border: 1px solid #2a2f37;
                box-shadow: 0 18px 48px rgba(0,0,0,0.6);
            }
            .tphud-beat-content {
                overflow-y: auto; padding: 14px 16px 16px; max-height: 78vh;
                display: flex; flex-direction: column; gap: 0;
                font-size: 13px;
            }
            .tphud-beat-tabs {
                display: flex; gap: 4px; margin-bottom: 14px;
                border-bottom: 1px solid #2a2f37; padding-bottom: 0;
            }
            .tphud-beat-tab {
                flex: 1;
                padding: 9px 14px;
                background: transparent; border: none; border-bottom: 2px solid transparent;
                color: #888; font-size: 12px; font-weight: 600;
                cursor: pointer; transition: color .15s, border-color .15s, background .15s;
                text-transform: uppercase; letter-spacing: 0.4px;
                border-radius: 0;
            }
            .tphud-beat-tab:hover { color: #ccc; background: rgba(126,184,247,0.04); }
            .tphud-beat-tab.tphud-tab-active {
                color: #7eb8f7; border-bottom-color: #7eb8f7;
                background: transparent;
            }
            .tphud-beat-pane {
                display: flex; flex-direction: column; gap: 14px;
            }
            .tphud-beat-empty {
                text-align: center; padding: 32px 16px;
                color: #888;
            }
            .tphud-beat-empty-icon { font-size: 36px; margin-bottom: 8px; opacity: 0.6; }
            .tphud-beat-empty-title { font-size: 15px; color: #ccc; font-weight: 600; margin-bottom: 6px; }
            .tphud-beat-empty-sub { font-size: 12px; color: #888; max-width: 380px; margin: 0 auto; line-height: 1.5; }
            .tphud-beat-spect {
                display: flex; align-items: center; gap: 10px;
                background: rgba(126,184,247,0.06); border: 1px solid rgba(126,184,247,0.2);
                border-radius: 5px; padding: 10px 12px;
            }
            .tphud-beat-spect-icon { font-size: 18px; }
            .tphud-beat-spect-text { font-size: 12px; color: #aaa; line-height: 1.4; }
            .tphud-beat-agg {
                text-align: center; padding: 4px 0 10px;
                border-bottom: 1px solid #252525;
            }
            .tphud-beat-agg-num { font-size: 34px; font-weight: 700; line-height: 1.1; }
            .tphud-beat-agg-lbl { font-size: 12px; color: #aaa; margin-top: 6px; }
            .tphud-beat-baseline { font-size: 12px; color: #888; text-align: center; }
            .tphud-beat-sec {
                font-size: 12px; color: #7eb8f7; text-transform: uppercase;
                letter-spacing: 0.5px;
                padding-bottom: 4px; border-bottom: 1px solid #252525;
            }
            .tphud-beat-sec-good {
                font-size: 13px; color: #2ecc71; padding: 8px 0;
                border-top: 1px solid #252525; text-align: center; font-weight: 600;
            }
            .tphud-beat-vlist { display: flex; flex-direction: column; gap: 10px; }
            .tphud-beat-vrow {
                background: #14171b; border: 1px solid #1f2228; border-radius: 5px;
                padding: 10px 12px;
            }
            .tphud-beat-vname {
                display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
                font-size: 14px; color: #eee; font-weight: 600;
                margin-bottom: 4px;
            }
            .tphud-beat-vplayer { font-size: 14px; color: #eee; }
            .tphud-beat-vact  {
                font-size: 11px; font-weight: 700; text-transform: uppercase;
                letter-spacing: 0.4px; padding: 2px 6px;
                background: #1e2229; border-radius: 3px;
            }
            .tphud-beat-vmid {
                font-size: 13px; margin: 4px 0 8px;
                display: flex; align-items: baseline; gap: 8px;
            }
            .tphud-beat-vp { font-weight: 700; font-size: 18px; }
            .tphud-beat-vsub { font-size: 12px; color: #888; }
            .tphud-beat-vlikely-lbl {
                font-size: 11px; color: #888; text-transform: uppercase;
                letter-spacing: 0.4px; margin: 4px 0 4px;
            }
            .tphud-beat-vbeats {
                display: flex; flex-wrap: wrap; gap: 5px;
            }
            .tphud-beat-chip {
                display: inline-flex; align-items: baseline; gap: 3px;
                font-size: 13px; font-weight: 600;
                padding: 3px 8px; border-radius: 3px;
                border: 1px solid transparent;
            }
            .tphud-beat-chip-bad {
                background: rgba(231,76,60,0.18); border-color: rgba(231,76,60,0.55);
                color: #ff7a6a;
            }
            .tphud-beat-chip-ok {
                background: #1e2229; border-color: #2a2f37; color: #aaa;
            }
            .tphud-beat-chip-pct { font-size: 10px; color: inherit; opacity: 0.7; font-weight: 500; }
            .tphud-beat-cls {
                display: inline-block;
                background: #1e2229; border: 1px solid #2a2f37; border-radius: 3px;
                color: #ccc; font-size: 12px; padding: 2px 6px;
            }
            .tphud-beat-cnt { color: #666; margin-left: 2px; font-size: 11px; }
            .tphud-beat-allcls {
                display: flex; flex-wrap: wrap; gap: 4px;
                max-height: 200px; overflow-y: auto;
                padding: 4px 0;
            }
            .tphud-beat-note { font-size: 11px; color: #666; margin-top: 6px; line-height: 1.45; }
            .tphud-beat-histsum {
                display: flex; flex-wrap: wrap; gap: 10px;
                padding: 6px 0; font-size: 11px;
                border-bottom: 1px solid #1f2228;
                margin-bottom: 6px;
            }
            .tphud-beat-histsum-item { font-weight: 700; letter-spacing: 0.3px; }
            .tphud-beat-histlist {
                display: flex; flex-direction: column; gap: 4px;
                padding: 4px 0 2px;
            }
            .tphud-beat-histrow {
                background: #14171b; border: 1px solid #1f2228; border-radius: 4px;
                padding: 6px 10px; font-size: 12px;
                display: flex; flex-direction: column; gap: 3px;
            }
            .tphud-beat-histtop {
                display: flex; align-items: center; gap: 8px;
            }
            .tphud-beat-histsub {
                font-size: 11px; color: #888; padding-left: 4px;
            }
            .tphud-beat-histbadge {
                font-size: 10px; font-weight: 700; text-transform: uppercase;
                letter-spacing: 0.4px;
                padding: 2px 6px; border-radius: 3px;
                border: 1px solid;
                min-width: 108px; text-align: center;
                white-space: nowrap;
            }
            .tphud-beat-histname { font-weight: 600; color: #ddd; }
            .tphud-beat-histcls  { color: #f1c40f; font-weight: 700; }
            .tphud-beat-histmeta { color: #888; margin-left: auto; font-size: 11px; }

            /* Table Log modal content */
            .tphud-tlog-box { width: 560px; }
            .tphud-tlog-content {
                overflow-y: auto; padding: 10px 14px;
                display: flex; flex-direction: column; gap: 12px;
            }
            .tphud-tlog-round-block { display: flex; flex-direction: column; gap: 6px; }
            .tphud-tlog-round-hdr {
                display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
                padding-bottom: 6px; border-bottom: 1px solid #252525;
                margin-bottom: 2px;
            }
            .tphud-tlog-hand-num { color: #5a7090; font-size: 11px; font-weight: 700; }
            .tphud-tlog-time { color: #444; font-size: 10px; }

            /* Settings button */
            .tphud-settings {
                background: none; border: 1px solid #444; border-radius: 3px;
                color: #5b9bd5; font-size: 15px; cursor: pointer;
                padding: 0; line-height: 1; transition: all .15s;
            }
            .tphud-settings:hover { color: #7fb3e8; border-color: #5b9bd5; background: #1a2a3a; }

            /* Settings modal */
            .tphud-settings-box { width: 400px; }
            .tphud-settings-content { padding: 12px 16px; display: flex; flex-direction: column; gap: 2px; }
            .tphud-setting-row {
                display: flex; align-items: center; justify-content: space-between;
                padding: 6px 0; border-bottom: 1px solid #1e1e1e;
            }
            .tphud-setting-row:last-of-type { border-bottom: none; }
            .tphud-setting-label { color: #ccc; font-size: 12px; }
            .tphud-setting-note {
                color: #888; font-size: 11px; line-height: 1.3;
                margin: -2px 0 6px 0;
            }
            .tphud-setting-ctrl {
                background: #1e1e1e; border: 1px solid #444; border-radius: 3px;
                color: #ddd; font-size: 11px; padding: 3px 6px; cursor: pointer;
                min-width: 160px;
            }
            .tphud-setting-ctrl:focus { outline: none; border-color: #666; }
            .tphud-settings-save {
                margin-top: 12px; align-self: flex-end;
                background: #2ecc71; border: none; border-radius: 4px;
                color: #000; font-size: 12px; font-weight: bold;
                padding: 7px 18px; cursor: pointer; transition: background .15s;
            }
            .tphud-settings-save:hover { background: #27ae60; }
            .tphud-scale-ctrl {
                display: flex; align-items: center; gap: 8px; min-width: 160px;
            }
            .tphud-scale-slider {
                flex: 1; accent-color: #5b9bd5; cursor: pointer; height: 4px;
            }
            .tphud-scale-val {
                color: #5b9bd5; font-size: 11px; font-weight: bold; min-width: 34px; text-align: right;
            }

            /* ── Tilt banner ───────────────────── */
            .tphud-tilt-banner {
                display: none;
                position: fixed;
                top: 0;
                left: 50%;
                transform: translateX(-50%);
                z-index: 99999;
                align-items: center;
                gap: 10px;
                background: linear-gradient(135deg, #3d0f0f, #5c1010);
                border: 1.5px solid #c0392b;
                border-top: none;
                border-radius: 0 0 8px 8px;
                padding: 10px 16px;
                box-shadow: 0 4px 20px rgba(0,0,0,0.7);
                font-family: monospace;
                max-width: 520px;
                min-width: 320px;
            }
            .tphud-tilt-icon { color: #e74c3c; font-size: 18px; flex-shrink: 0; }
            .tphud-tilt-msg  { color: #f5c6c6; font-size: 12px; line-height: 1.5; flex: 1; }
            .tphud-tilt-dismiss {
                background: rgba(192,57,43,0.3);
                border: 1px solid #c0392b;
                color: #f5c6c6;
                font-size: 11px;
                font-family: monospace;
                padding: 4px 10px;
                border-radius: 4px;
                cursor: pointer;
                white-space: nowrap;
                flex-shrink: 0;
            }
            .tphud-tilt-dismiss:hover { background: rgba(192,57,43,0.6); }

        `;
        document.head.appendChild(style);
    }

    // ── Init ─────────────────────────────────────────────────────

    let seatDebounce = null;
    let lastObservedTexture = null;
    let badgeAttachInterval = null;
    let coachPollInterval = null;
    let thinkingObserver = null;
    let turnAlertObserver = null;
    let domObserver = null;
    let backgroundActive = false;

    function init() {
        injectStyles();

        const tip = document.createElement('div');
        tip.id = 'tphud-hover';
        tip.className = 'tphud-hover tphud-hidden';
        document.body.appendChild(tip);
        tip.style.transform = hudScaleTransform(hudSettings.hudScaleHoverTip);
        tip.style.transformOrigin = 'top left';

        syncCoachPanelVisibility();
        ensureTableLogBubble();
        ensureBeatBubble();

        syncTableContextFromTexture(true);

        idbInit().then(() => {
            if (isPageActive()) {
                document.querySelectorAll('[class*="message___"]').forEach(tryProcessMessage);
                syncStreetFromBoardCards();
                attachBadgesToSeats();
            } else {
                pageWasHidden = true;
            }
            // Cloud sync starts only after local state is loaded: seeds the
            // server on first contact, then pulls profiles and priors.
            try { syncInit(); } catch (e) { console.warn('[TPHUD] syncInit failed:', e); }
        });

        // Detects action buttons appearing in the DOM, which signals it is your turn to act
        const ACTION_BTN_RE = /^(fold|check|call|bet|raise)$/i;
        function isActionButton(el) {
            if (el.tagName !== 'BUTTON' && el.getAttribute?.('role') !== 'button') return false;
            return ACTION_BTN_RE.test(el.textContent?.trim());
        }
        function hasActionButtons(node) {
            if (isActionButton(node)) return true;
            const btns = node.querySelectorAll?.('button,[role="button"]');
            if (!btns) return false;
            for (const b of btns) { if (ACTION_BTN_RE.test(b.textContent?.trim())) return true; }
            return false;
        }

        function startBackgroundWork() {
            if (backgroundActive) return;
            backgroundActive = true;

            // Mobile: periodic reattach to catch missed renders
            if (!badgeAttachInterval) {
                badgeAttachInterval = setInterval(() => { attachBadgesToSeats(); }, 2000);
            }

            // Polling fallback for Mr. Coach turn detection.
            // "Thinking" status observer — fires when the game marks it as your turn to think.
            // Faster than button polling and catches the turn even before buttons render.
            // Fallback: the 400ms poll below handles check/fold auto-options where thinking state resolves instantly.
            if (!thinkingObserver) {
                thinkingObserver = new MutationObserver(() => {
                    if (!localPlayerName) return;
                    const thinkingSpan = [...document.querySelectorAll('span')].find(s =>
                        s.textContent?.trim() === `${localPlayerName} is thinking...`
                    );
                    if (thinkingSpan) triggerCoachOnYourTurn();
                });
            }
            const logsRoot = document.querySelector('[class*="logListContainer"]') || document.body;
            thinkingObserver.observe(logsRoot, { childList: true, subtree: true, characterData: true });

            // Turn alert observer — watches for the "Your Turn" log message specifically
            if (!turnAlertObserver) {
                turnAlertObserver = new MutationObserver(mutations => {
                    if (!hudSettings.turnAlert) return;
                    for (const mutation of mutations) {
                        for (const node of mutation.addedNodes) {
                            if (node.nodeType !== 1) continue;
                            const text = node.textContent?.trim() || '';
                            if (/your turn/i.test(text)) { playTurnAlert(); return; }
                            const inner = node.querySelector?.('*');
                            if (inner && /your turn/i.test(inner.textContent?.trim() || '')) { playTurnAlert(); return; }
                        }
                    }
                });
            }
            turnAlertObserver.observe(logsRoot, { childList: true, subtree: true });

            if (!coachPollInterval) {
                // The MutationObserver catches most cases but misses when buttons only change
                // visibility (no new DOM nodes). This polls every 400ms as a safety net.
                coachPollInterval = setInterval(() => {
                    // Check buttons first — if it's not the player's turn, skip immediately.
                    const hasVisible = [...document.querySelectorAll('button')].some(b =>
                        b.offsetParent !== null && ACTION_BTN_RE.test(b.textContent?.trim())
                    );
                    if (!hasVisible) return;

                    // Skip only when this exact state was already handled AND panel has content.
                    const street = currentHand?.street || 'preflop';
                    const log = streetLogs[street] || [];
                    const actionSeq = streetActionSeq[street] || 0;
                    if (!selfCardsMissingOnLastFire && !isCoachPanelEmpty() && actionSeq === (streetFiredCounts[street] || 0) && street === lastCoachFireStreet) return;

                    triggerCoachOnYourTurn();
                }, 400);
            }

            if (!domObserver) {
                domObserver = new MutationObserver(mutations => {
                    let needsSeatScan = false;
                    let maybeTextureChanged = false;
                    let maybeYourTurn = false;

                    mutations.forEach(mutation => {
                        mutation.addedNodes.forEach(node => {
                            if (node.nodeType !== 1) return;

                            tryProcessMessage(node);
                            node.querySelectorAll?.('[class*="message___"]').forEach(tryProcessMessage);
                            // Mobile: action messages (bet/raise) have <i class="logIcon___…"> and may use a different container class
                            node.querySelectorAll?.('i[class*="logIcon___"]').forEach(icon => {
                                if (icon.parentElement) tryProcessMessage(icon.parentElement);
                            });

                            if (node.id?.startsWith('player-') || node.querySelector?.('[id^="player-"]')) {
                                needsSeatScan = true;
                            }

                            if (
                                node.matches?.('[class^="table___"][style*="tables_colour"]') ||
                                node.querySelector?.('[class^="table___"][style*="tables_colour"]')
                            ) {
                                maybeTextureChanged = true;
                            }

                            // Detect action buttons appearing = your turn
                            if (hasActionButtons(node)) {
                                maybeYourTurn = true;
                            }
                        });

                        // Self-seat class/attribute change can signal active turn.
                        // Do NOT guard on streetLogs.length — when going first the log is empty
                        // and that guard was blocking the coach from firing entirely.
                        if (mutation.type === 'attributes' && localPlayerId &&
                            (mutation.target?.id === `player-${localPlayerId}` ||
                                mutation.target?.closest?.(`#player-${localPlayerId}`))) {
                            maybeYourTurn = true;
                        }

                        if (mutation.type === 'attributes' && mutation.target?.matches?.('[class^="table___"][style*="tables_colour"]')) {
                            maybeTextureChanged = true;
                        }
                    });

                    if (maybeYourTurn) {
                        clearTimeout(coachActionDebounce);
                        coachActionDebounce = setTimeout(triggerCoachOnYourTurn, 80);
                    }

                    const textureNow = getRenderedTextureKey();
                    if (textureNow && textureNow !== lastObservedTexture) {
                        lastObservedTexture = textureNow;
                        maybeTextureChanged = true;
                    }

                    if (maybeTextureChanged) {
                        syncTableContextFromTexture();
                        needsSeatScan = true;
                    }

                    if (needsSeatScan) {
                        clearTimeout(seatDebounce);
                        seatDebounce = setTimeout(attachBadgesToSeats, 120);
                    }

                    scheduleBeatBubbleRefresh();
                });
            }
            domObserver.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'class'] });
        }

        function stopBackgroundWork() {
            if (!backgroundActive) return;
            backgroundActive = false;

            if (badgeAttachInterval) { clearInterval(badgeAttachInterval); badgeAttachInterval = null; }
            if (coachPollInterval) { clearInterval(coachPollInterval); coachPollInterval = null; }

            if (thinkingObserver) thinkingObserver.disconnect();
            if (domObserver) domObserver.disconnect();

            clearTimeout(coachActionDebounce);
            coachActionDebounce = null;
            clearTimeout(seatDebounce);
            seatDebounce = null;
        }

        window.addEventListener('beforeunload', () => {
            finalizeCurrentHand();
            flushStatsSave();
            saveLiveStacks();
            saveHandHistory();
        });

        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden') {
                pageWasHidden = true;
                flushStatsSave();
                saveLiveStacks();
                stopBackgroundWork();
                return;
            }

            startBackgroundWork();
            if (!pageWasHidden) return;
            pageWasHidden = false;

            // Tab was hidden; rescan logs in case MutationObserver missed nodes.
            document.querySelectorAll('[class*="message___"]').forEach(tryProcessMessage);
            syncTableContextFromTexture();
            syncStreetFromBoardCards();
            attachBadgesToSeats();

            // Force a fresh self-card read when returning mid-hand.
            if (currentHand && !currentHand.selfFoldStreet) {
                const cards = readOwnCardsFromDOM();
                if (cards) currentHand.selfHoleCards = cards;
            }
            selfCardsMissingOnLastFire = true;
        });

        if (isPageActive()) {
            startBackgroundWork();
        }

        // Re-attach badges on window resize (table layout may shift)
        window.addEventListener('resize', () => {
            clearTimeout(seatDebounce);
            seatDebounce = setTimeout(attachBadgesToSeats, 200);
            updateCoachPanelLayout();
        });

        // First-run: show glossary so new players know what the HUD means
        if (!localStorage.getItem('tornPokerHUD_seenIntro')) {
            setTimeout(() => {
                if (!isPageActive()) return;
                showHelpModal();
                localStorage.setItem('tornPokerHUD_seenIntro', '1');
            }, 1500);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // ===== POKER ODDS ENGINE =====
    // Monte Carlo hand evaluator — called by coach to append win% to advice strings

    let _oddsCache = { key: null, win: null }; // single-entry cache — skip recompute if state unchanged

    const _RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
    const _SUITS = ['♠', '♥', '♦', '♣'];
    const _RV = { '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14 };
    const _P = [1, 15, 225, 3375, 50625]; // 15^0 .. 15^4
    const _BRACKET = 759375;                     // 15^5 — one hand-rank bracket width

    function _rv(card) { return _RV[card.slice(0, -1)] || 0; }
    function _suit(card) { return card.slice(-1); }

    function _buildDeck(exclude) {
        const ex = new Set(exclude);
        const deck = [];
        for (const s of _SUITS)
            for (const r of _RANKS)
                if (!ex.has(r + s)) deck.push(r + s);
        return deck;
    }

    function _shuffle(arr) {
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    }

    // Scores exactly 5 cards — returns a number where higher = better hand
    function _score5(cards) {
        const vals = cards.map(_rv).sort((a, b) => b - a);
        const suits = cards.map(_suit);
        const sc = {};
        suits.forEach(s => sc[s] = (sc[s] || 0) + 1);
        const isFlush = Object.values(sc).some(c => c === 5);
        const vc = {};
        vals.forEach(v => vc[v] = (vc[v] || 0) + 1);
        const groups = Object.entries(vc)
            .map(([v, c]) => [+v, c])
            .sort((a, b) => b[1] - a[1] || b[0] - a[0]);
        const unique = [...new Set(vals)].sort((a, b) => b - a);
        let isStraight = false, sHigh = 0;
        if (unique.length === 5 && unique[0] - unique[4] === 4) {
            isStraight = true; sHigh = unique[0];
        } else if (unique.includes(14) && [2, 3, 4, 5].every(v => unique.includes(v))) {
            isStraight = true; sHigh = 5;
        }
        if (isFlush && isStraight) return 8 * _BRACKET + sHigh;
        if (groups[0][1] === 4) return 7 * _BRACKET + groups[0][0] * _P[1] + groups[1][0];
        if (groups[0][1] === 3 && groups[1][1] === 2) return 6 * _BRACKET + groups[0][0] * _P[1] + groups[1][0];
        if (isFlush) return 5 * _BRACKET + vals[0] * _P[4] + vals[1] * _P[3] + vals[2] * _P[2] + vals[3] * _P[1] + vals[4];
        if (isStraight) return 4 * _BRACKET + sHigh;
        if (groups[0][1] === 3) return 3 * _BRACKET + groups[0][0] * _P[2] + groups[1][0] * _P[1] + groups[2][0];
        if (groups[0][1] === 2 && groups[1][1] === 2) return 2 * _BRACKET + Math.max(groups[0][0], groups[1][0]) * _P[2] + Math.min(groups[0][0], groups[1][0]) * _P[1] + groups[2][0];
        if (groups[0][1] === 2) return 1 * _BRACKET + groups[0][0] * _P[3] + groups[1][0] * _P[2] + groups[2][0] * _P[1] + groups[3][0];
        return vals[0] * _P[4] + vals[1] * _P[3] + vals[2] * _P[2] + vals[3] * _P[1] + vals[4];
    }

    // Best 5-card score from 5–7 cards (tries all C(n,5) combos)
    function _scoreHand(cards) {
        if (cards.length < 5) return 0;
        let best = 0;
        const n = cards.length;
        for (let a = 0; a < n - 4; a++)
            for (let b = a + 1; b < n - 3; b++)
                for (let c = b + 1; c < n - 2; c++)
                    for (let d = c + 1; d < n - 1; d++)
                        for (let e = d + 1; e < n; e++) {
                            const s = _score5([cards[a], cards[b], cards[c], cards[d], cards[e]]);
                            if (s > best) best = s;
                        }
        return best;
    }

    // Preflop raising ranges per player type and action — null means use random (too wide to model)
    const _RANGES = {
        NIT: { raise: ['AA', 'KK', 'QQ', 'JJ', 'TT', 'AKs', 'AQs', 'AJs', 'KQs', 'AKo', 'AQo'], threeBet: ['AA', 'KK', 'QQ', 'JJ', 'AKs', 'AKo'], shove: ['AA', 'KK', 'QQ', 'AKs', 'AKo'] },
        ROCK: { raise: ['AA', 'KK', 'QQ', 'JJ', 'TT', '99', 'AKs', 'AQs', 'AKo'], threeBet: ['AA', 'KK', 'QQ', 'AKs', 'AKo'], shove: ['AA', 'KK', 'AKs'] },
        TAG: { raise: ['AA', 'KK', 'QQ', 'JJ', 'TT', '99', '88', '77', 'AKs', 'AQs', 'AJs', 'ATs', 'KQs', 'KJs', 'QJs', 'JTs', 'T9s', '98s', 'AKo', 'AQo', 'AJo', 'KQo'], threeBet: ['AA', 'KK', 'QQ', 'JJ', 'TT', 'AKs', 'AQs', 'AJs', 'A5s', 'A4s', 'AKo', 'AQo'], shove: ['AA', 'KK', 'QQ', 'JJ', 'AKs', 'AKo'] },
        LAG: { raise: ['AA', 'KK', 'QQ', 'JJ', 'TT', '99', '88', '77', '66', '55', 'AKs', 'AQs', 'AJs', 'ATs', 'A9s', 'A8s', 'A7s', 'A6s', 'A5s', 'KQs', 'KJs', 'KTs', 'QJs', 'QTs', 'JTs', 'T9s', '98s', '87s', '76s', '65s', 'AKo', 'AQo', 'AJo', 'ATo', 'KQo', 'KJo', 'QJo'], threeBet: ['AA', 'KK', 'QQ', 'JJ', 'TT', '99', '88', 'AKs', 'AQs', 'AJs', 'ATs', 'A5s', 'A4s', 'A3s', 'AKo', 'AQo', 'AJo'], shove: ['AA', 'KK', 'QQ', 'JJ', 'TT', '99', 'AKs', 'AQs', 'AJs', 'AKo', 'AQo'] },
        MANIAC: { raise: null, threeBet: ['AA', 'KK', 'QQ', 'JJ', 'TT', '99', '88', '77', '66', '55', '44', '33', '22', 'AKs', 'AQs', 'AJs', 'ATs', 'A9s', 'A8s', 'A7s', 'A6s', 'A5s', 'A4s', 'A3s', 'A2s', 'KQs', 'KJs', 'KTs', 'K9s', 'QJs', 'QTs', 'JTs', 'T9s', '98s', 'AKo', 'AQo', 'AJo', 'ATo', 'A9o', 'KQo', 'KJo', 'QJo'], shove: ['AA', 'KK', 'QQ', 'JJ', 'TT', '99', '88', '77', '66', 'AKs', 'AQs', 'AJs', 'ATs', 'A9s', 'A5s', 'A4s', 'AKo', 'AQo', 'AJo', 'ATo'] },
        FISH: { raise: null, threeBet: ['AA', 'KK', 'QQ', 'JJ', 'AKs', 'AKo'], shove: ['AA', 'KK', 'QQ', 'JJ', 'TT', 'AKs', 'AKo'] },
        CALLING_STATION: { raise: null, threeBet: ['AA', 'KK', 'QQ', 'JJ', 'AKs', 'AKo'], shove: ['AA', 'KK', 'QQ', 'JJ', 'AKs', 'AKo'] },
        TIGHT_PASSIVE: { raise: ['AA', 'KK', 'QQ', 'JJ', 'TT', 'AKs', 'AQs', 'AKo'], threeBet: ['AA', 'KK', 'AKs', 'AKo'], shove: ['AA', 'KK'] },
        LOOSE_PASSIVE: { raise: null, threeBet: ['AA', 'KK', 'QQ', 'JJ', 'TT', 'AKs', 'AKo'], shove: ['AA', 'KK', 'QQ', 'AKs', 'AKo'] }
    };

    // 110 hand types ordered strongest→weakest — used for stats-based range slicing
    const _HAND_ORDER = (
        'AA KK QQ JJ TT 99 AKs 88 AQs AKo AJs KQs 77 ATs AQo KJs ' +
        '66 KTs A9s AJo QJs 55 A8s KQo K9s ATo QTs 44 A7s JTs K8s ' +
        'Q9s A6s KJo 33 K7s A5s T9s J9s A4s K6s Q8s 22 A3s K5s T8s ' +
        'A9o 98s J8s K4s A2s Q7s 87s K3s A8o K2s T7s Q6s 97s J7s ' +
        'A7o T9o Q5s 76s K9o 86s J6s A6o Q4s 65s T6s 96s J9o Q3s A5o ' +
        'J5s 75s Q2s A4o 85s K8o KTo T8o J4s 95s 64s A3o 98o J3s K7o ' +
        '54s 87o T5s J2s 74s A2o K6o QTo 76o T4s'
    ).split(' ');

    // Returns hand list sized by actual PFR/threeBetPct stats — replaces static _RANGES lookup
    function _statsBasedRange(pfr, threeBetPct, actionType) {
        let frac;
        if (actionType === 'raise') frac = pfr;
        else if (actionType === 'threeBet') frac = threeBetPct || (pfr * 0.3);
        else if (actionType === 'shove') frac = pfr * 0.4;
        else return null;
        const count = Math.round(Math.max(0, Math.min(frac, 1)) * _HAND_ORDER.length);
        return count > 0 ? _HAND_ORDER.slice(0, count) : null;
    }

    // Keeps top (1-foldRate) fraction of combos — models calling range after opponent faces a bet
    function _bayesianNarrow(combos, foldRate) {
        if (!combos || !foldRate || foldRate < 0.05) return combos;
        return combos.slice(0, Math.max(1, Math.round(combos.length * (1 - foldRate))));
    }

    // Maps single-char rank notation (A K Q J T 9..2) to card rank strings used in this script
    const _RMAP = { A: 'A', K: 'K', Q: 'Q', J: 'J', T: '10', '9': '9', '8': '8', '7': '7', '6': '6', '5': '5', '4': '4', '3': '3', '2': '2' };

    // Generates all valid [card1, card2] combos matching handList hands, excluding known cards
    function _buildRangeCombos(handList, exclude) {
        const ex = new Set(exclude);
        const combos = [];
        for (const hand of handList) {
            const r1 = _RMAP[hand[0]], r2 = _RMAP[hand[1]];
            if (!r1 || !r2) continue;
            if (r1 === r2) {
                // Pair — pick 2 suits from 4
                for (let i = 0; i < _SUITS.length; i++)
                    for (let j = i + 1; j < _SUITS.length; j++) {
                        const c1 = r1 + _SUITS[i], c2 = r1 + _SUITS[j];
                        if (!ex.has(c1) && !ex.has(c2)) combos.push([c1, c2]);
                    }
            } else if (hand.endsWith('s')) {
                // Suited — same suit for both
                for (const s of _SUITS) {
                    const c1 = r1 + s, c2 = r2 + s;
                    if (!ex.has(c1) && !ex.has(c2)) combos.push([c1, c2]);
                }
            } else {
                // Offsuit — different suits
                for (const s1 of _SUITS)
                    for (const s2 of _SUITS) {
                        if (s1 === s2) continue;
                        const c1 = r1 + s1, c2 = r2 + s2;
                        if (!ex.has(c1) && !ex.has(c2)) combos.push([c1, c2]);
                    }
            }
        }
        return combos;
    }

    // Range for a non-aggressor villain still in the hand. Callers hold roughly their
    // VPIP-wide range minus most of the top band they would have raised with (half of it
    // is kept: some players trap). A second raiser gets a raising range. Returns null
    // when the villain is unmodelable (BB walk) so the MC deals them a random hand.
    function _villainRangeCombos(name, exclude) {
        const p = currentHand?.perPlayer?.[name];
        if (!p) return null;
        const raw = resolveStatsByName(name);
        const active = raw ? getActiveStats(raw, currentTableBB) : null;
        const dm = active ? getDisplayMetrics(active) : null;
        const reliable = dm && dm.n >= 10;
        let hands = null;
        if (p.raisedPreflop) {
            hands = (reliable && dm.pfr != null)
                ? _statsBasedRange(dm.pfr, dm.threeBetPct, p.threeBet ? 'threeBet' : 'raise')
                : _HAND_ORDER.slice(0, Math.round(_HAND_ORDER.length * 0.15));
        } else if (p.voluntaryPreflop) {
            const vpip = (reliable && dm.vpip != null) ? dm.vpip : 0.60; // Torn pool is loose
            const pfr = (reliable && dm.pfr != null) ? dm.pfr : 0.10;
            const from = Math.round(_HAND_ORDER.length * Math.min(pfr * 0.5, 0.10));
            const to = Math.round(_HAND_ORDER.length * Math.max(Math.min(vpip, 1), 0.15));
            if (to <= from) return null;
            hands = _HAND_ORDER.slice(from, to);
        } else {
            return null;
        }
        if (!hands || !hands.length) return null;
        const combos = _buildRangeCombos(hands, exclude);
        return combos.length ? combos : null;
    }

    // Exact runner-runner equity: enumerate all C(D,2) two-card turn+river combos from remaining deck,
    // count how many result in a made straight or flush (using all 7 cards).
    // Returns { flush: "X.X", straight: "X.X" } as percentage strings.
    function _runnerRunnerEquity(holeCards, boardCards) {
        const known = [...holeCards, ...boardCards];
        const remaining = _buildDeck(known);
        const D = remaining.length;
        let flushFav = 0, straightFav = 0;

        for (let i = 0; i < D - 1; i++) {
            for (let j = i + 1; j < D; j++) {
                const allSeven = [...holeCards, ...boardCards, remaining[i], remaining[j]];

                // Flush: any suit with 5+ cards
                const sc = {};
                for (const c of allSeven) { const s = _suit(c); sc[s] = (sc[s] || 0) + 1; }
                if (Object.values(sc).some(c => c >= 5)) flushFav++;

                // Straight: 5 consecutive ranks in any window (ace plays both low and high)
                const ranks = new Set(allSeven.map(_rv));
                if (ranks.has(14)) ranks.add(1);
                for (let s = 1; s <= 10; s++) {
                    let hits = 0;
                    for (let v = s; v <= s + 4; v++) if (ranks.has(v)) hits++;
                    if (hits === 5) { straightFav++; break; }
                }
            }
        }

        const total = D * (D - 1) / 2;
        return {
            flush: (flushFav / total * 100).toFixed(1),
            straight: (straightFav / total * 100).toFixed(1),
        };
    }

    // Normalizes a card's rank to the '10'-form used by _buildDeck/_score5 ('Th' → '10h', '10♠' stays)
    function _normalizeCard(c) {
        if (!c) return c;
        const r = c.slice(0, -1);
        const s = c.slice(-1);
        return (r === 'T' ? '10' : r) + s;
    }

    // Returns names of villains still in the current hand (not folded, not hero)
    function _getActiveVillainNames() {
        const pp = currentHand?.perPlayer;
        if (!pp) return [];
        return Object.keys(pp).filter(name => {
            if (name === localPlayerName) return false;
            if (pp[name].foldedPreflop) return false;
            if (pp[name].foldedOnFlop) return false;
            if ((pp[name].turn?.folds || 0) > 0) return false;
            if ((pp[name].river?.folds || 0) > 0) return false;
            return true;
        });
    }

    // Enumerates 2-card combos that currently beat hero's made hand, groups by canonical class.
    // Returns Map<class, comboCount> or null when board < 3 cards.
    function _enumBeatingClasses(holeCards, boardCards) {
        if (!holeCards || holeCards.length < 2 || !boardCards || boardCards.length < 3) return null;
        const hole = holeCards.map(_normalizeCard);
        const board = boardCards.map(_normalizeCard);
        const heroScore = _scoreHand([...hole, ...board]);
        const deck = _buildDeck([...hole, ...board]);
        const out = new Map();
        const D = deck.length;
        for (let i = 0; i < D - 1; i++) {
            for (let j = i + 1; j < D; j++) {
                const combo = [deck[i], deck[j]];
                const vScore = _scoreHand([...combo, ...board]);
                if (vScore > heroScore) {
                    const cls = canonicalHand(combo);
                    if (cls) out.set(cls, (out.get(cls) || 0) + 1);
                }
            }
        }
        return out;
    }

    // Counts total remaining 2-card combos given hero hole + board (constant for a given known-card count)
    function _remainingComboCount(holeCards, boardCards) {
        const D = 52 - holeCards.length - boardCards.length;
        return D > 1 ? (D * (D - 1)) / 2 : 0;
    }

    // Builds per-villain probability of holding a hand that beats hero, weighted by their observed showdown distribution.
    // Returns { aggregate, perVillain[], vsRandomPct, beatingClasses[], totalBeatingCombos }
    // Classifies villain's preflop action so we can filter their shown range against it.
    // 'raised' = villain put in a preflop raise → only classes they have previously raised count.
    // 'called' = limped / called a raise → only classes they have shown without raising count.
    // 'walked' = BB checked option (no voluntary preflop action) → still "didn't raise", so
    //            uses the same seen-minus-pfr filter; the label is kept distinct only for display.
    function _villainPreflopAction(name) {
        const p = currentHand?.perPlayer?.[name];
        if (!p) return 'walked';
        if (p.raisedPreflop) return 'raised';
        if (p.voluntaryPreflop) return 'called';
        return 'walked';
    }

    // Returns the weight to give a shown-hand class for this villain given their current preflop action.
    // raised  → weight = data.pfr (times villain raised when shown with this class)
    // not raised (called / walked) → weight = seen - pfr (times villain showed up without raising)
    // If `sizing.currentBB` is provided and the class has prior sizing samples for the same action type,
    // a Gaussian similarity multiplier is applied so classes the villain previously raised at a very
    // different size get less weight (e.g. 2x raise now vs avg 5x raise with this class → less likely).
    function _classWeightForAction(data, action, sizing) {
        const seen = data?.seen || 0;
        if (!seen) return 0;
        const pfr = data.pfr || 0;
        const base = action === 'raised' ? pfr : Math.max(0, seen - pfr);
        if (!base) return 0;
        if (!sizing || sizing.currentBB == null) return base;

        let avgBB = null;
        if (action === 'raised' && (data.pfRaiseBBsSamples || 0) > 0) {
            avgBB = data.pfRaiseBBsSum / data.pfRaiseBBsSamples;
        } else if (action === 'called' && (data.pfCallBBsSamples || 0) > 0) {
            avgBB = data.pfCallBBsSum / data.pfCallBBsSamples;
        }
        if (avgBB == null || avgBB <= 0) return base;

        // σ = 30% of avg, floored at 1 BB. Closer to a 1-BB tolerance band for small raises,
        // wider for big raises so a 3-bet-vs-4-bet doesn't completely zero out.
        const sigma = Math.max(1.0, avgBB * 0.3);
        const z = (sizing.currentBB - avgBB) / sigma;
        const similarity = Math.exp(-0.5 * z * z);
        return base * similarity;
    }

    // Archetype prior for the Range Reader: the fraction of a typed villain's preflop
    // range that currently beats hero on this board. Replaces the vs-random baseline in
    // the shrinkage prior, so thin showdown samples drift toward "what a Nit who raised
    // looks like" instead of "a random hand" and reads become usable much earlier.
    const _beatPriorCache = new Map();
    function _cacheBeatPrior(key, val) {
        if (_beatPriorCache.size > 64) _beatPriorCache.clear();
        _beatPriorCache.set(key, val);
        return val;
    }
    function _archetypePriorPct(name, action, hole, board) {
        if (action === 'walked' || !hole || hole.length < 2 || !board || board.length < 3) return null;
        const raw = resolveStatsByName(name);
        if (!raw) return null;
        const cls = classify(raw);
        const typeKey = Object.keys(TYPES).find(k => TYPES[k] === cls.type);
        if (!typeKey || typeKey === 'UNKNOWN' || typeKey === 'MIXED') return null;

        const cacheKey = `${name}|${action}|${typeKey}|${hole.join('')}|${board.join('')}`;
        if (_beatPriorCache.has(cacheKey)) return _beatPriorCache.get(cacheKey);

        const active = getActiveStats(raw, currentTableBB);
        const dm = active ? getDisplayMetrics(active) : null;
        const reliable = dm && dm.n >= 10;
        const pp = currentHand?.perPlayer?.[name];
        let hands = null;
        if (action === 'raised') {
            const bucket = pp?.threeBet ? 'threeBet' : 'raise';
            hands = (_RANGES[typeKey] || {})[bucket];
            if (!hands && reliable && dm.pfr != null)
                hands = _statsBasedRange(dm.pfr, dm.threeBetPct, bucket);
        } else if (action === 'called') {
            // Caller band: VPIP-wide minus half the raising band, same model as the MC.
            // Falls back to the archetype's PROFILES targets when stats are thin.
            const prof = PROFILES[typeKey];
            const vpip = (reliable && dm.vpip != null) ? dm.vpip : prof?.vpip;
            const pfr = (reliable && dm.pfr != null) ? dm.pfr : prof?.pfr;
            if (vpip == null) return _cacheBeatPrior(cacheKey, null);
            const from = Math.round(_HAND_ORDER.length * Math.min((pfr || 0) * 0.5, 0.10));
            const to = Math.round(_HAND_ORDER.length * Math.max(Math.min(vpip, 1), 0.15));
            if (to > from) hands = _HAND_ORDER.slice(from, to);
        }
        if (!hands || !hands.length) return _cacheBeatPrior(cacheKey, null);

        const combos = _buildRangeCombos(hands, [...hole, ...board]);
        if (!combos.length) return _cacheBeatPrior(cacheKey, null);
        const heroScore = _scoreHand([...hole, ...board]);
        let beat = 0;
        for (const c of combos) {
            if (_scoreHand([c[0], c[1], ...board]) > heroScore) beat++;
        }
        return _cacheBeatPrior(cacheKey, beat / combos.length);
    }

    // Spectator-mode: returns each active villain's PF/sizing-filtered weighted classes without
    // requiring hero hole cards or a board. Used when hero is not dealt in (or it's preflop), so
    // we can still snapshot villain ranges for the post-showdown read-history grading.
    function computeVillainRangesOnly() {
        if (!currentHand) return null;
        const villainNames = _getActiveVillainNames();
        if (!villainNames.length) return null;
        const perVillain = villainNames.map(name => {
            const stats = resolveStatsByName(name);
            const shown = stats?.shownHands || null;
            const action = _villainPreflopAction(name);
            const pp = currentHand.perPlayer[name];
            let currentBB = null;
            if (currentTableBB) {
                if (action === 'raised' && pp?.preflopRaiseAmt) currentBB = pp.preflopRaiseAmt / currentTableBB;
                else if (action === 'called' && pp?.preflopCallAmt) currentBB = pp.preflopCallAmt / currentTableBB;
            }
            const sizing = { currentBB };
            let totalSeen = 0;
            const weightedClasses = [];
            if (shown) {
                for (const [cls, data] of Object.entries(shown)) {
                    const w = _classWeightForAction(data, action, sizing);
                    if (!w) continue;
                    totalSeen += w;
                    weightedClasses.push({ cls, weight: w, beats: false });
                }
            }
            weightedClasses.sort((a, b) => b.weight - a.weight);
            return { name, sample: totalSeen, weightedClasses, action, currentBB, p: null, pRaw: null, beatSeen: 0, beatingShown: [] };
        });
        return { spectating: true, perVillain, aggregate: null, vsRandomPct: null, beatingClasses: [], totalBeatingCombos: 0, totalCombos: 0, minSample: hudSettings.beatBubbleMinSample || 4 };
    }

    function computeBeatYouProbabilities() {
        if (!currentHand) return null;
        const hole = currentHand.selfHoleCards;
        const board = currentHand.boardCards;
        const beating = _enumBeatingClasses(hole, board);
        if (!beating) return null;

        const totalCombos = _remainingComboCount(hole, board);
        let beatingCombos = 0;
        for (const c of beating.values()) beatingCombos += c;
        const vsRandomPct = totalCombos > 0 ? (beatingCombos / totalCombos) : 0;

        // Bayesian shrinkage prior: small samples drift toward the vs-random baseline,
        // large samples dominate. Caps the per-villain probability well below 100%
        // so we never claim certainty from a finite showdown history.
        const PRIOR_WEIGHT = 4;

        const minSample = hudSettings.beatBubbleMinSample || 4;
        const villainNames = _getActiveVillainNames();
        const perVillain = villainNames.map(name => {
            const stats = resolveStatsByName(name);
            const shown = stats?.shownHands || null;
            const action = _villainPreflopAction(name);
            const pp = currentHand.perPlayer[name];
            let currentBB = null;
            if (currentTableBB) {
                if (action === 'raised' && pp?.preflopRaiseAmt) currentBB = pp.preflopRaiseAmt / currentTableBB;
                else if (action === 'called' && pp?.preflopCallAmt) currentBB = pp.preflopCallAmt / currentTableBB;
            }
            const sizing = { currentBB };
            let totalSeen = 0, beatSeen = 0;
            const weightedClasses = [];
            if (shown) {
                for (const [cls, data] of Object.entries(shown)) {
                    const w = _classWeightForAction(data, action, sizing);
                    if (!w) continue;
                    totalSeen += w;
                    const beats = beating.has(cls);
                    if (beats) beatSeen += w;
                    weightedClasses.push({ cls, weight: w, beats });
                }
            }
            weightedClasses.sort((a, b) => b.weight - a.weight);
            const beatingShown = weightedClasses.filter(c => c.beats).map(c => ({ cls: c.cls, seen: c.weight }));
            // Archetype prior beats the vs-random baseline when the villain has a type:
            // it also makes the read usable before minSample shown hands accumulate.
            let typePrior = null;
            try { typePrior = _archetypePriorPct(name, action, hole, board); } catch { /* fall back to vs-random */ }
            const prior = typePrior != null ? typePrior : vsRandomPct;
            const usable = totalSeen >= minSample || typePrior != null;
            const pShrunk = (totalSeen > 0 || typePrior != null)
                ? (beatSeen + PRIOR_WEIGHT * prior) / (totalSeen + PRIOR_WEIGHT)
                : null;
            const pRaw = totalSeen > 0 ? (beatSeen / totalSeen) : null;
            return {
                name,
                sample: totalSeen,
                p: usable ? pShrunk : null,
                pRaw,
                beatSeen,
                beatingShown,
                weightedClasses,
                action,
                currentBB,
                prior,
                priorSource: typePrior != null ? 'type' : 'random',
            };
        });

        const usable = perVillain.filter(v => v.p != null);
        let aggregate = null;
        if (usable.length) {
            let prod = 1;
            for (const v of usable) prod *= (1 - v.p);
            aggregate = 1 - prod;
        }

        const beatingClasses = [...beating.entries()]
            .map(([cls, count]) => ({ cls, count }))
            .sort((a, b) => b.count - a.count);

        return {
            aggregate,
            perVillain,
            vsRandomPct,
            beatingClasses,
            totalBeatingCombos: beatingCombos,
            totalCombos,
            minSample,
            priorWeight: PRIOR_WEIGHT,
        };
    }

    // Runs N simulations — aggressor uses range-weighted hand if aggressorCombos provided, rest random
    function _monteCarlo(holeCards, boardCards, iterations, numOpponents, aggressorCombos, villainCombosList) {
        iterations = iterations || 800;
        numOpponents = numOpponents || 1;
        const known = [...holeCards, ...boardCards];
        let wins = 0, ties = 0, losses = 0;
        const boardNeeded = 5 - boardCards.length;
        const hasAgg = !!(aggressorCombos && aggressorCombos.length > 0);
        // Modeled non-aggressor villains, capped by the opponent slots left after the aggressor
        const modeled = (villainCombosList || []).filter(c => c && c.length)
            .slice(0, Math.max(0, numOpponents - (hasAgg ? 1 : 0)));
        for (let i = 0; i < iterations; i++) {
            // Pick aggressor hand from range if available
            let aggHole = null;
            if (hasAgg) {
                aggHole = aggressorCombos[Math.floor(Math.random() * aggressorCombos.length)];
            }
            const used = aggHole ? [...known, aggHole[0], aggHole[1]] : [...known];
            // Sample each modeled villain from their range, rejecting card collisions.
            // After 10 failed tries they fall back to a random deal from the deck.
            const villainHoles = [];
            for (const combos of modeled) {
                let pick = null;
                for (let t = 0; t < 10; t++) {
                    const c = combos[Math.floor(Math.random() * combos.length)];
                    if (!used.includes(c[0]) && !used.includes(c[1])) { pick = c; break; }
                }
                villainHoles.push(pick);
                if (pick) used.push(pick[0], pick[1]);
            }
            // Build deck excluding known cards + all sampled hole cards
            const deck = _shuffle(_buildDeck(used));
            const fullBoard = [...boardCards];
            for (let j = 0; j < boardNeeded; j++) fullBoard.push(deck.pop());
            const myScore = _scoreHand([...holeCards, ...fullBoard]);
            let result = 1; // 1=win, 0=tie, -1=loss
            // Score aggressor (range-weighted)
            if (aggHole) {
                const s = _scoreHand([...aggHole, ...fullBoard]);
                if (s > myScore) result = -1;
                else if (s === myScore) result = 0;
            }
            // Score modeled villains (range-weighted callers)
            if (result !== -1) {
                for (const vh of villainHoles) {
                    const hole = vh || [deck.pop(), deck.pop()];
                    const s = _scoreHand([...hole, ...fullBoard]);
                    if (s > myScore) { result = -1; break; }
                    else if (s === myScore) { result = Math.min(result, 0); }
                }
            }
            // Score remaining opponents (random)
            if (result !== -1) {
                const randCount = numOpponents - (aggHole ? 1 : 0) - villainHoles.length;
                for (let o = 0; o < randCount; o++) {
                    const s = _scoreHand([deck.pop(), deck.pop(), ...fullBoard]);
                    if (s > myScore) { result = -1; break; }
                    else if (s === myScore) { result = Math.min(result, 0); }
                }
            }
            if (result === 1) wins++;
            else if (result === 0) ties++;
            else losses++;
        }
        const total = wins + ties + losses;
        return {
            win: (wins / total * 100).toFixed(1),
            tie: (ties / total * 100).toFixed(1),
            lose: (losses / total * 100).toFixed(1)
        };
    }

    // ===== END POKER ODDS ENGINE =====

    // ── Dev simulation API ────────────────────────────────
    // Exposed for sim-dev.user.js only. Not used in production.
    // Temporarily swaps globals so the real advice functions run against a mock hand.
    unsafeWindow.__tphudSim = {
        runAdvice(mockHand, mockName, facingAction, aggressorCtx, potOddsVal, sprVal) {
            const prevHand = currentHand;
            const prevName = localPlayerName;
            currentHand = mockHand;
            localPlayerName = mockName;
            try {
                return getOwnHandLean(facingAction, aggressorCtx, potOddsVal, sprVal);
            } catch (e) {
                return `[error: ${e.message}]`;
            } finally {
                currentHand = prevHand;
                localPlayerName = prevName;
            }
        },
        getGTOMath(mockHand, mockName, facingAction, aggressorCtx) {
            const prevHand = currentHand;
            const prevName = localPlayerName;
            currentHand = mockHand;
            localPlayerName = mockName;
            try {
                return computeGTOMath(facingAction, aggressorCtx);
            } catch (e) {
                return { potOdds: null, spr: null, rangeAdv: null };
            } finally {
                currentHand = prevHand;
                localPlayerName = prevName;
            }
        },
        getOpponentLine(mockHand, mockName, oppName, oppTypeKey) {
            const prevHand = currentHand;
            const prevName = localPlayerName;
            currentHand = mockHand;
            localPlayerName = mockName;
            try {
                const pattern = getOpponentLinePattern(oppName);
                if (!pattern) return { pattern: null, interp: null };
                const board = (mockHand.boardCards || []).filter(Boolean);
                const texture = board.length >= 3 ? analyzeBoardTexture(board) : null;
                const flop = (mockHand.flopCards || []).filter(Boolean);
                const turn = (mockHand.turnCards || []).filter(Boolean);
                const river = (mockHand.riverCards || []).filter(Boolean);
                const newCard = mockHand.street === 'river' ? (river[0] || null) : (turn[0] || null);
                const change = detectBoardChange(flop, newCard);
                const interp = interpretOpponentLine(pattern, oppTypeKey, texture, change);
                return { pattern, interp, boardChange: change };
            } catch (e) {
                return { pattern: null, interp: `[error: ${e.message}]` };
            } finally {
                currentHand = prevHand;
                localPlayerName = prevName;
            }
        },
        getNarrative(mockHand, mockName) {
            const prevHand = currentHand;
            const prevName = localPlayerName;
            const prevLogs = streetLogs;
            currentHand = mockHand;
            localPlayerName = mockName;
            // Clear real street logs so narrative doesn't read real player names
            streetLogs = { preflop: [], flop: [], turn: [], river: [] };
            try {
                return getHandNarrativeNote();
            } catch (e) {
                return `[error: ${e.message}]`;
            } finally {
                currentHand = prevHand;
                localPlayerName = prevName;
                streetLogs = prevLogs;
            }
        },
        ready: true,
    };

})();
