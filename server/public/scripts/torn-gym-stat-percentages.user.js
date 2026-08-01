// ==UserScript==
// @name         Torn Gym Stat Percentages 
// @namespace    torn-gym-stat-percentages
// @version      2.1.2
// @author       RussianRob
// @description  Shows each gym battle stat as a percentage of your total next to the stat name, plus a compact summary line and your faction's Steadfast gym-gain bonus per stat.
// @match        https://www.torn.com/gym.php*
// @match        https://www.torn.com/loader.php?sid=gym*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @connect      api.torn.com
// @downloadURL https://update.greasyfork.org/scripts/562419/Torn%20Gym%20Stat%20Percentages.user.js
// @updateURL https://update.greasyfork.org/scripts/562419/Torn%20Gym%20Stat%20Percentages.meta.js
// ==/UserScript==

(function () {
    'use strict';

    // -------- STEADFAST (faction gym-gain perks) --------
    // The faction "Steadfast" branch grants a PER-STAT gym gain bonus, and the
    // four stats are upgraded independently — "+ 10% strength gym gains" next to
    // "+ 14% defense gym gains". The gym page never shows these, so the API's
    // faction_perks list is the only source.
    //
    // Strictly additive: with no API key, a failed call, or a faction that has
    // not bought the branch, every distribution percentage behaves as before.
    const Steadfast = {
        KEY_STORE: 'gspApiKey',
        CACHE_STORE: 'gspPerkCache',
        // Factions swap these perks in and out around wars, so a long cache would
        // keep advertising a bonus that has already been switched off.
        CACHE_TTL_MS: 30 * 60 * 1000,

        perks: null,       // { strength, defense, speed, dexterity } whole percentages
        // Starts as 'init', NOT 'nokey': until the stored key has actually been
        // read we know nothing, and claiming "click to set API key" to someone who
        // already has one was the flash on every refresh.
        state: 'init',     // init | nokey | loading | ok | error
        message: '',
        onUpdate: null,    // set by the controller so results paint immediately

        notify() {
            try { if (typeof this.onUpdate === 'function') this.onUpdate(); } catch (e) { /* never break the caller */ }
        },

        store(key, value) {
            try {
                if (typeof GM_setValue === 'function') { GM_setValue(key, value); return; }
            } catch (e) { /* fall through */ }
            try { localStorage.setItem(key, value); } catch (e) { /* no durable storage */ }
        },

        read(key) {
            try {
                if (typeof GM_getValue === 'function') {
                    const v = GM_getValue(key, '');
                    // PDA's GM shim returns strings for everything; normalise.
                    return v == null ? '' : String(v);
                }
            } catch (e) { /* fall through */ }
            try { return localStorage.getItem(key) || ''; } catch (e) { return ''; }
        },

        getKey() { return this.read(this.KEY_STORE).trim(); },

        setKey(k) {
            this.store(this.KEY_STORE, (k || '').trim());
            this.store(this.CACHE_STORE, '');   // a new key must not inherit the old key's perks
            this.perks = null;
            this.load();
        },

        promptForKey() {
            const entered = window.prompt(
                'Torn API key for Steadfast gym bonuses (Limited access is enough).\nLeave blank to remove.',
                this.getKey()
            );
            if (entered === null) return;       // cancelled — keep the stored key
            this.setKey(entered);
        },

        /**
         * "+ 14% defense gym gains" -> { defense: 14 }.
         * Requires the words "gym gains", because "+ 50% nerve gain from alcohol"
         * sits in the same array and a looser match would pick it up. Each stat is
         * read independently since the four values differ.
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

        readCache() {
            try {
                const raw = this.read(this.CACHE_STORE);
                if (!raw) return null;
                const cached = JSON.parse(raw);
                if (!cached || !cached.perks) return null;
                return cached;
            } catch (e) { return null; }
        },

        load() {
            const key = this.getKey();
            if (!key) { this.state = 'nokey'; this.notify(); return; }

            // Stale-while-revalidate: show whatever was cached straight away, even
            // if past its TTL, then refresh behind it. Reading the cache is
            // synchronous, so with a warm cache the numbers are there on the first
            // paint and there is no gap to sit through at all.
            const cached = this.readCache();
            if (cached) {
                this.perks = cached.perks;
                this.state = 'ok';
                this.notify();
                if (Date.now() - Number(cached.at || 0) <= this.CACHE_TTL_MS) return;
            } else {
                this.state = 'loading';
                this.notify();
            }
            // api.torn.com sends CORS headers, so a plain fetch works — and avoids
            // the GM_xmlhttpRequest shims, which report failure on requests that
            // actually completed in some hosts.
            fetch('https://api.torn.com/user/?selections=perks&key=' + encodeURIComponent(key) + '&comment=gymstatpct')
                .then((r) => r.json())
                .then((data) => {
                    if (!data || data.error) {
                        this.fail((data && data.error && data.error.error) || 'API error');
                        return;
                    }
                    this.perks = this.parse(data.faction_perks);
                    this.state = 'ok';
                    this.store(this.CACHE_STORE, JSON.stringify({ at: Date.now(), perks: this.perks }));
                    this.notify();
                })
                .catch((e) => this.fail(String((e && e.message) || e)));
        },

        /**
         * A failed REFRESH must not wipe numbers that are already on screen —
         * slightly stale values beat an error message where the figures were.
         */
        fail(message) {
            if (this.perks) { this.notify(); return; }
            this.state = 'error';
            this.message = message;
            this.notify();
        },

        /** Short per-stat badge, e.g. "+14%". Null when there is nothing to say. */
        badge(statKey) {
            if (this.state !== 'ok' || !this.perks) return null;
            return '+' + (this.perks[statKey] || 0) + '%';
        },

        /** Fully-labelled line for the summary bar, which disambiguates the badges. */
        summary() {
            // 'init' shows nothing at all: better a bar with one line for a moment
            // than a line that states something untrue about your key.
            if (this.state === 'init') return '';
            if (this.state === 'nokey') return 'Steadfast: click to set API key';
            if (this.state === 'loading') return 'Steadfast: loading…';
            if (this.state === 'error') return 'Steadfast: ' + this.message;
            if (!this.perks) return '';
            return `Steadfast: STR +${this.perks.strength}% | DEF +${this.perks.defense}% | ` +
                   `SPD +${this.perks.speed}% | DEX +${this.perks.dexterity}%`;
        }
    };

    // -------- MODEL --------
    const GymStatsModel = {
        selectors: {
            strength:  'li[class*="strength"] span[class*="propertyValue"], li[class*="strength"] .stat-value',
            defense:   'li[class*="defense"] span[class*="propertyValue"],  li[class*="defense"] .stat-value',
            speed:     'li[class*="speed"] span[class*="propertyValue"],    li[class*="speed"] .stat-value',
            dexterity: 'li[class*="dexterity"] span[class*="propertyValue"], li[class*="dexterity"] .stat-value'
        },

        // Cache of DOM elements for each stat so we do not query repeatedly
        statElements: {
            strength: null,
            defense: null,
            speed: null,
            dexterity: null
        },

        getGymContainer() {
            // Try common gym containers used on web and PDA
            return document.querySelector('#gymroot, .gym-root, #gym, .gym-wrap') || document.body;
        },

        getStatElement(key) {
            if (this.statElements[key] && document.contains(this.statElements[key])) {
                return this.statElements[key];
            }
            const selector = this.selectors[key];
            if (!selector) return null;

            const el = document.querySelector(selector);
            if (!el) return null;

            this.statElements[key] = el;
            return el;
        },

        readStatValue(key) {
            const element = this.getStatElement(key);
            if (!element) return null;

            const match = (element.textContent || '').match(/[\d,]+/);
            if (!match) return null;

            return Number(match[0].replace(/,/g, '')) || 0;
        },

        getStats() {
            return {
                strength:  this.readStatValue('strength'),
                defense:   this.readStatValue('defense'),
                speed:     this.readStatValue('speed'),
                dexterity: this.readStatValue('dexterity')
            };
        }
    };

    // -------- VIEW --------
    const StatDistributionView = {
        // Cache <li> and name elements for each statKey
        liCache: {},
        nameCache: {},

        getLi(statKey) {
            if (this.liCache[statKey] && document.contains(this.liCache[statKey])) {
                return this.liCache[statKey];
            }
            const li = document.querySelector(`li[class*="${statKey}"]`);
            if (li) this.liCache[statKey] = li;
            return li;
        },

        getNameElement(statKey) {
            if (this.nameCache[statKey] && document.contains(this.nameCache[statKey])) {
                return this.nameCache[statKey];
            }

            const li = this.getLi(statKey);
            if (!li) return null;

            const nameElement =
                li.querySelector('span[class*="propertyName"], .title, .gym-stat-name') ||
                li.querySelector('span, div');

            if (nameElement) this.nameCache[statKey] = nameElement;
            return nameElement;
        },

        injectPercentageIntoStatName(statKey, percentage, isMax) {
            const nameElement = this.getNameElement(statKey);
            if (!nameElement) return;

            // Remove any stale duplicate spans (in case Torn rewrote the innerHTML)
            const existingSpans = nameElement.querySelectorAll('.stat-name-percentage');
            if (existingSpans.length > 1) {
                existingSpans.forEach((span, idx) => {
                    if (idx > 0) span.remove();
                });
            }

            let percentageElement = nameElement.querySelector('.stat-name-percentage');
            if (!percentageElement) {
                percentageElement = document.createElement('span');
                percentageElement.className = 'stat-name-percentage';
                nameElement.appendChild(percentageElement);
            }

            percentageElement.textContent = ` (${percentage}%)`;
            percentageElement.classList.toggle('stat-name-percentage-max', !!isMax);
        },

        injectSteadfastIntoStatName(statKey) {
            const badge = Steadfast.badge(statKey);
            const nameElement = this.getNameElement(statKey);
            if (!nameElement) return;

            let el = nameElement.querySelector('.stat-name-steadfast');
            // Nothing to show yet (no key, still loading, errored): remove any
            // stale badge rather than leaving a number that is no longer true.
            if (badge === null) {
                if (el) el.remove();
                return;
            }
            if (!el) {
                el = document.createElement('span');
                el.className = 'stat-name-steadfast';
                nameElement.appendChild(el);
            }
            el.textContent = ` ${badge}`;
            // Deliberately no `title`: the native tooltip does not dismiss itself
            // in Torn's mobile/app webviews, so it sits over the page until reload.
            // The summary line below already names what these badges are.
        },

        ensureSummaryBar() {
            if (this.summaryElement && document.contains(this.summaryElement)) {
                return this.summaryElement;
            }
            const container = GymStatsModel.getGymContainer();
            if (!container) return null;

            const bar = document.createElement('div');
            bar.className = 'gym-stat-summary-bar';
            bar.textContent = 'Loading distribution…';
            container.insertBefore(bar, container.firstChild);
            this.summaryElement = bar;
            return bar;
        },

        updateSummaryBar(percentages) {
            const bar = this.ensureSummaryBar();
            if (!bar) return;

            const distribution =
                `STR ${percentages.strength}% | ` +
                `DEF ${percentages.defense}% | ` +
                `SPD ${percentages.speed}% | ` +
                `DEX ${percentages.dexterity}%`;

            // Rebuilt rather than patched: textContent above used to own this node,
            // so anything appended once would be wiped on the next update anyway.
            bar.textContent = '';
            const distributionLine = document.createElement('div');
            distributionLine.textContent = distribution;
            bar.appendChild(distributionLine);

            const steadfastText = Steadfast.summary();
            if (!steadfastText) return;

            let steadfastLine = document.createElement('div');
            steadfastLine.className = 'gym-stat-steadfast-line';
            steadfastLine.textContent = steadfastText;
            // No `title` here either — same stuck-tooltip problem. The line reads
            // "Steadfast: ..." so it is already self-describing.
            steadfastLine.addEventListener('click', (ev) => {
                ev.stopPropagation();
                ev.preventDefault();
                Steadfast.promptForKey();
            });
            bar.appendChild(steadfastLine);
        }
    };

    // -------- CONTROLLER --------
    const StatDistributionController = {
        refreshIntervalMs: 3000,

        start() {
            // Order matters: load() reads the cache synchronously, so doing it
            // BEFORE the first update() means a warm cache is already on screen at
            // the first paint. It used to run after, so every refresh painted
            // "click to set API key" first and only corrected on the next 3s tick.
            Steadfast.onUpdate = () => this.update();
            Steadfast.load();

            this.update();
            setInterval(() => this.update(), this.refreshIntervalMs);
            this.attachTrainClickHandler();
        },

        isGymStillPresent() {
            return !!document.querySelector('li[class*="strength"]');
        },

        update() {
            if (!this.isGymStillPresent()) {
                return;
            }

            const stats = GymStatsModel.getStats();

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

            const percentages = this.calculatePercentages(stats, total);
            this.injectNamePercentages(percentages);
            StatDistributionView.updateSummaryBar(percentages);
        },

        calculatePercentages(stats, total) {
            return {
                strength:  this.calculatePercentage(stats.strength, total),
                defense:   this.calculatePercentage(stats.defense, total),
                speed:     this.calculatePercentage(stats.speed, total),
                dexterity: this.calculatePercentage(stats.dexterity, total)
            };
        },

        injectNamePercentages(percentages) {
            // Find max percentage to lightly highlight main stat
            const values = [
                percentages.strength,
                percentages.defense,
                percentages.speed,
                percentages.dexterity
            ].map(Number);
            const maxValue = Math.max.apply(null, values);

            const isMax = (val) => Number(val) === maxValue;

            StatDistributionView.injectPercentageIntoStatName('strength',  percentages.strength,  isMax(percentages.strength));
            StatDistributionView.injectPercentageIntoStatName('defense',   percentages.defense,   isMax(percentages.defense));
            StatDistributionView.injectPercentageIntoStatName('speed',     percentages.speed,     isMax(percentages.speed));
            StatDistributionView.injectPercentageIntoStatName('dexterity', percentages.dexterity, isMax(percentages.dexterity));

            // Re-asserted on the same cycle as the percentages: Torn rewrites these
            // name nodes, which is why the block above re-injects every time.
            StatDistributionView.injectSteadfastIntoStatName('strength');
            StatDistributionView.injectSteadfastIntoStatName('defense');
            StatDistributionView.injectSteadfastIntoStatName('speed');
            StatDistributionView.injectSteadfastIntoStatName('dexterity');
        },

        calculatePercentage(value, total) {
            return ((value / total) * 100).toFixed(2);
        },

        attachTrainClickHandler() {
            let trainRecheckScheduled = false;

            document.addEventListener('click', (event) => {
                const clickedElement = event.target.closest('a, button, input');
                if (!clickedElement) return;

                const label = (clickedElement.textContent || '').trim().toUpperCase();
                if (label !== 'TRAIN') return;

                if (trainRecheckScheduled) return;
                trainRecheckScheduled = true;
                this.forceRecheckAfterTrain(() => {
                    trainRecheckScheduled = false;
                });
            }, true);
        },

        forceRecheckAfterTrain(doneCb) {
            const delays = [100, 250, 500, 900, 1400, 2000];
            let remaining = delays.length;

            const checkDone = () => {
                remaining--;
                if (remaining <= 0 && typeof doneCb === 'function') doneCb();
            };

            this.update();
            delays.forEach((ms) => {
                setTimeout(() => {
                    this.update();
                    checkDone();
                }, ms);
            });
        }
    };

    // -------- BOOTSTRAP --------
    const gymReadyObserver = new MutationObserver((mutations, obs) => {
        if (document.querySelector('li[class*="strength"]')) {
            obs.disconnect();
            StatDistributionController.start();
        }
    });

    // Observe only body once; disconnects quickly when gym appears
    gymReadyObserver.observe(document.body, { childList: true, subtree: true });

    // Guarded: an unguarded GM_registerMenuCommand aborts the whole script on Torn
    // PDA, which would take the stat percentages down with it.
    try {
        if (typeof GM_registerMenuCommand === 'function') {
            GM_registerMenuCommand('Set Torn API key (Steadfast bonuses)', () => Steadfast.promptForKey());
        }
    } catch (e) { /* host without menu support — the summary line is still clickable */ }

    // -------- STYLE --------
    const styleElement = document.createElement('style');
    styleElement.textContent = `
        .stat-name-percentage {
            font-size: 0.85em;
            opacity: 0.65;
            margin-left: 4px;
            white-space: nowrap;
        }
        .stat-name-percentage-max {
            opacity: 0.95;
            font-weight: 600;
        }
        .gym-stat-summary-bar {
            margin-bottom: 6px;
            font-size: 0.85em;
            opacity: 0.75;
        }
        /* Faction Steadfast bonus, styled to match the distribution percentages
           exactly. The earlier green washed out against Torn's light theme; these
           inherit the page's own text colour, so they stay legible in both themes.
           The leading "+" and the "Steadfast:" label carry the distinction. */
        .stat-name-steadfast {
            font-size: 0.85em;
            opacity: 0.65;
            margin-left: 4px;
            white-space: nowrap;
        }
        .gym-stat-steadfast-line {
            cursor: pointer;
        }
    `;
    document.head.appendChild(styleElement);
})();
