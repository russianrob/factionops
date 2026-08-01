// ==UserScript==
// @name         Torn Gym Stat Distribution
// @namespace    RussianRob
// @match        https://www.torn.com/gym.php*
// @match        https://pda.torn.com/gym.php*
// @version      2.0.5
// @description  Displays stat percentage distribution in the Torn Gym, plus your faction's Steadfast gym-gain bonus per stat. Based on KamiRen [2805199]'s Torn Gym Stat Distribution.
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @connect      api.torn.com
// @author       RussianRob
// @license      MIT
// @downloadURL  https://tornwar.com/scripts/torn-gym-stat-distribution.user.js
// @updateURL    https://tornwar.com/scripts/torn-gym-stat-distribution.meta.js
// ==/UserScript==

(function () {
    'use strict';

    /* =========================
       CONFIGURATION
    ========================== */

    // const ENABLE_INLINE_PERCENTAGES = true; // Inline (in tiles) percentages
    const ENABLE_INLINE_PERCENTAGES = true;

    // const OVERRIDE_MAIN_CONTAINER_WIDTH = true; // Layout tweak
    const OVERRIDE_MAIN_CONTAINER_WIDTH = !isMobileDevice();

    const MAIN_CONTAINER_WIDTH_PX = 1200;

    /**
     * Detect if user is on mobile device 
     */
    function isMobileDevice() {
        const userAgent = navigator.userAgent || navigator.vendor || window.opera;
        const mobileRegex = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i;
        const isMobileUA = mobileRegex.test(userAgent.toLowerCase());
        const isSmallViewport = window.innerWidth < 768;
        
        return isMobileUA || isSmallViewport;
    }

    /* =========================
       STEADFAST (faction gym-gain perks)
    ========================== */
    // The faction "Steadfast" upgrade branch grants a PER-STAT gym gain bonus,
    // and the four stats are upgraded independently — "+ 10% strength gym gains"
    // alongside "+ 14% defense gym gains". The gym page never shows these, so the
    // only source is the API's faction_perks list.
    //
    // Everything here is additive to the original script: if there is no API key,
    // or the call fails, the stat-distribution percentages carry on unchanged.
    const Steadfast = {
        KEY_STORE: 'sfGymApiKey',
        CACHE_STORE: 'sfGymPerkCache',
        // Factions swap the nerve/life/gym perks around wars, so a long cache
        // would keep showing a bonus that has already been switched off.
        CACHE_TTL_MS: 30 * 60 * 1000,

        perks: null,          // { strength, defense, speed, dexterity } as whole percentages
        state: 'nokey',       // nokey | loading | ok | error
        message: '',

        store(key, value) {
            try {
                if (typeof GM_setValue === 'function') { GM_setValue(key, value); return; }
            } catch (e) { /* fall through to localStorage */ }
            try { localStorage.setItem(key, value); } catch (e) { /* nothing durable available */ }
        },

        read(key) {
            try {
                if (typeof GM_getValue === 'function') {
                    const v = GM_getValue(key, '');
                    // PDA's GM shim hands back strings for everything; normalise.
                    return v == null ? '' : String(v);
                }
            } catch (e) { /* fall through to localStorage */ }
            try { return localStorage.getItem(key) || ''; } catch (e) { return ''; }
        },

        getKey() { return this.read(this.KEY_STORE).trim(); },

        setKey(k) {
            this.store(this.KEY_STORE, (k || '').trim());
            this.store(this.CACHE_STORE, '');   // a new key must not read the old key's perks
            this.perks = null;
            this.load();
        },

        promptForKey() {
            const current = this.getKey();
            const entered = window.prompt(
                'Torn API key for Steadfast gym bonuses (Limited access is enough).\nLeave blank to remove.',
                current
            );
            if (entered === null) return;          // cancelled — leave the stored key alone
            this.setKey(entered);
        },

        /**
         * "+ 14% defense gym gains" -> { defense: 14 }.
         * Requires the words "gym gains" so "+ 50% nerve gain from alcohol",
         * which sits in the same array, is ignored. Each stat is read
         * independently because the four values differ.
         */
        parse(factionPerks) {
            const out = { strength: 0, defense: 0, speed: 0, dexterity: 0 };
            if (!Array.isArray(factionPerks)) return out;
            factionPerks.forEach((line) => {
                const s = String(line);
                if (!s.includes('gym gains')) return;
                const m = s.match(/\d+/);
                if (!m) return;
                const value = parseInt(m[0], 10);
                if (s.includes('strength')) out.strength = value;
                else if (s.includes('speed')) out.speed = value;
                else if (s.includes('defense')) out.defense = value;
                else if (s.includes('dexterity')) out.dexterity = value;
            });
            return out;
        },

        loadCache() {
            try {
                const raw = this.read(this.CACHE_STORE);
                if (!raw) return false;
                const cached = JSON.parse(raw);
                if (!cached || !cached.perks) return false;
                if (Date.now() - Number(cached.at || 0) > this.CACHE_TTL_MS) return false;
                this.perks = cached.perks;
                this.state = 'ok';
                return true;
            } catch (e) { return false; }
        },

        load() {
            const key = this.getKey();
            if (!key) { this.state = 'nokey'; this.render(); return; }
            if (this.loadCache()) { this.render(); return; }

            this.state = 'loading';
            this.render();
            // api.torn.com sends CORS headers, so a plain fetch works and avoids
            // the GM_xmlhttpRequest shims, which report failure on requests that
            // actually completed in some hosts.
            fetch('https://api.torn.com/user/?selections=perks&key=' + encodeURIComponent(key) + '&comment=gymdist')
                .then((r) => r.json())
                .then((data) => {
                    if (!data || data.error) {
                        this.state = 'error';
                        this.message = (data && data.error && data.error.error) || 'API error';
                        this.render();
                        return;
                    }
                    this.perks = this.parse(data.faction_perks);
                    this.state = 'ok';
                    this.store(this.CACHE_STORE, JSON.stringify({ at: Date.now(), perks: this.perks }));
                    this.render();
                })
                .catch((e) => {
                    this.state = 'error';
                    this.message = String((e && e.message) || e);
                    this.render();
                });
        },

        badgeText(statKey) {
            if (this.state === 'nokey') return 'Steadfast: set API key';
            if (this.state === 'loading') return 'Steadfast …';
            if (this.state === 'error') return 'Steadfast: ' + this.message;
            const value = this.perks ? this.perks[statKey] : 0;
            // A faction that has not bought this stat's branch gets an explicit 0
            // rather than a blank, so "no bonus" is distinguishable from "broken".
            return '+' + (value || 0) + '% Steadfast';
        },

        /**
         * Appended into the tile's normal content flow rather than absolutely
         * positioned, so it cannot land on top of the distribution badge.
         */
        renderOne(statKey) {
            const li = document.querySelector(`li[class^="${statKey}__"]`);
            if (!li) return;
            const host = li.querySelector('[class*="propertyContent"]') || li;

            let el = host.querySelector(':scope > .steadfast-gym-gains');
            if (!el) {
                el = document.createElement('div');
                el.className = 'steadfast-gym-gains';
                el.addEventListener('click', (ev) => {
                    ev.stopPropagation();      // don't let the click reach the stat tile
                    ev.preventDefault();
                    this.promptForKey();
                });
                host.appendChild(el);
            }
            el.textContent = this.badgeText(statKey);
            el.title = this.state === 'ok'
                ? 'Faction Steadfast gym gain bonus. Click to change API key.'
                : 'Click to set your Torn API key (Limited is enough).';
            el.classList.toggle('steadfast-gym-gains--muted', this.state !== 'ok');
        },

        render() {
            ['strength', 'defense', 'speed', 'dexterity'].forEach((s) => this.renderOne(s));
        }
    };

    /* =========================
       MODEL
    ========================== */
    const GymStatsModel = {
        selectors: {
            strength:  'li[class^="strength__"] span[class^="propertyValue__"]',
            defense:   'li[class^="defense__"] span[class^="propertyValue__"]',
            speed:     'li[class^="speed__"] span[class^="propertyValue__"]',
            dexterity: 'li[class^="dexterity__"] span[class^="propertyValue__"]'
        },

        readStatValue(selector) {
            const element = document.querySelector(selector);
            if (!element) return null;

            // Extract ONLY the first numeric chunk (handles "1,234 (12.34%)")
            const match = (element.textContent || '').match(/[\d,]+/);
            if (!match) return null;

            return Number(match[0].replace(/,/g, '')) || 0;
        },

        getStats() {
            return {
                strength:  this.readStatValue(this.selectors.strength),
                defense:   this.readStatValue(this.selectors.defense),
                speed:     this.readStatValue(this.selectors.speed),
                dexterity: this.readStatValue(this.selectors.dexterity)
            };
        }
    };

    /* =========================
       HELPERS
    ========================== */
    function injectPercentageIntoStatTile(statKey, percentage) {
        if (!ENABLE_INLINE_PERCENTAGES) return;

        const liElement = document.querySelector(`li[class^="${statKey}__"]`);
        if (!liElement) return;

        let percentageElement = Array.from(liElement.children).find(
            el => el.classList && el.classList.contains('stat-percentage--inline')
        );
        if (!percentageElement) {
            percentageElement = document.createElement('span');
            percentageElement.className = 'stat-percentage--inline';
            liElement.appendChild(percentageElement);
        }

        percentageElement.textContent = ` (${percentage}%)`;
    }

    /* =========================
       CONTROLLER
    ========================== */
    const StatDistributionController = {
        refreshIntervalMs: 3000,
        lastTotal: null,

        start() {
            this.update();
            setInterval(() => this.update(), this.refreshIntervalMs);
            this.attachTrainClickHandler();
            Steadfast.load();
        },

        update() {
            const stats = GymStatsModel.getStats();

            // If Torn is mid-rerender and any stat is missing, don't update yet.
            if (
                stats.strength === null ||
                stats.defense === null ||
                stats.speed === null ||
                stats.dexterity === null
            ) {
                return;
            }


            const total = stats.strength + stats.defense + stats.speed + stats.dexterity;
            if (!total) return;

            // Guard against transient "only one stat loaded" states
            if (this.lastTotal !== null && total < this.lastTotal * 0.5) {
                return;
            }

            const percentages = this.calculatePercentages(stats, total);

            // Always attempt to re-inject inline percentages (Torn may swap nodes)
            this.injectInlinePercentages(percentages);
            this.lastTotal = total;
        },

        calculatePercentages(stats, total) {
            return {
                strength:  this.calculatePercentage(stats.strength, total),
                defense:   this.calculatePercentage(stats.defense, total),
                speed:     this.calculatePercentage(stats.speed, total),
                dexterity: this.calculatePercentage(stats.dexterity, total)
            };
        },

        injectInlinePercentages(percentages) {
            injectPercentageIntoStatTile('strength',  percentages.strength);
            injectPercentageIntoStatTile('defense',   percentages.defense);
            injectPercentageIntoStatTile('speed',     percentages.speed);
            injectPercentageIntoStatTile('dexterity', percentages.dexterity);
            // Re-assert the Steadfast badges on the same cycle: Torn swaps these
            // nodes out on re-render, which is exactly why the block above
            // re-injects every time rather than once.
            Steadfast.render();
        },

        calculatePercentage(value, total) {
            return ((value / total) * 100).toFixed(2);
        },

        attachTrainClickHandler() {
            document.addEventListener('click', (event) => {
                const clickedElement = event.target.closest('a, button, input');
                if (!clickedElement) return;

                const label = (clickedElement.textContent || '').trim().toUpperCase();
                if (label !== 'TRAIN') return;

                this.forceRecheckAfterTrain();
            }, true);
        },

        forceRecheckAfterTrain() {
            this.update();
            const delays = [100, 250, 500, 900, 1400, 2000, 3000];
            delays.forEach((ms) => setTimeout(() => this.update(), ms));
        }
    };

    /* =========================
       BOOTSTRAP
    ========================== */
    const gymReadyObserver = new MutationObserver(() => {
        if (document.querySelector(GymStatsModel.selectors.strength)) {
            gymReadyObserver.disconnect();
            StatDistributionController.start();
        }
    });

    gymReadyObserver.observe(document.body, { childList: true, subtree: true });

    // Guarded: an unguarded GM_registerMenuCommand aborts the whole script on
    // Torn PDA, which would take the distribution percentages down with it.
    try {
        if (typeof GM_registerMenuCommand === 'function') {
            GM_registerMenuCommand('Set Torn API key (Steadfast bonuses)', () => Steadfast.promptForKey());
        }
    } catch (e) { /* host without menu support — the badge is still clickable */ }

    /* =========================
       STYLE
    ========================== */
    const styleElement = document.createElement('style');
    styleElement.textContent = `
        /* Inline stat percentages */
        .stat-percentage--inline {
            position: absolute;
            top: 43px;
            right: 6px;
            font-size: 0.85em;
            font-weight: bold;
            background: rgba(32,32,32,0.85); /* optional: helps on mobile weaker background contrast */
            padding: 2px 6px;
            border-radius: 4px;
            pointer-events: none; /* so it doesn't break clicking the LI or stat */
        }

        /* Make sure parent <li> has position: relative */
        ul[class^="properties__"] li {
            position: relative;
        }

        /* Faction Steadfast bonus. In normal flow (not absolute) so it can never
           collide with .stat-percentage--inline above. */
        .steadfast-gym-gains {
            display: block;
            margin-top: 2px;
            font-size: 0.72em;
            font-weight: bold;
            color: #8ecf8e;
            cursor: pointer;
            line-height: 1.2;
            white-space: nowrap;
        }
        .steadfast-gym-gains--muted {
            color: #999;
            font-weight: normal;
        }

        /* Update positioning for smaller/devices under 600px */
        @media screen and (max-width: 600px) {
            .stat-percentage--inline {
                top: 28px;
                right: 6px;
                font-size: 0.92em;
                font-weight: bold;
                padding: 1px 4px;
            }
        }
    `;
    document.head.appendChild(styleElement);

})();