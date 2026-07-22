// ==UserScript==
// @name         Torn Gym Advisor
// @namespace    RussianRob
// @version      1.0.1
// @description  Live gym-training advisor for Torn's gym page: best-train-now per stat, single-train estimator, and a "nice number" (69/420) sequence solver. Reads your stats/happy/energy/perks live from the API (optional key) or manual entry. Math verified bit-for-bit against the Nice Stat Solver (JTS 2.0 / Vladar gym-gain formula).
// @author       RussianRob
// @match        https://www.torn.com/gym.php*
// @license      GPL-3.0-or-later
// @downloadURL  https://tornwar.com/scripts/torn-gym-advisor.user.js
// @updateURL    https://tornwar.com/scripts/torn-gym-advisor.meta.js
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    var SCRIPT_VERSION = "1.0.1";

    // ================================================================
    // Verified gym-training math. This block is the byte-for-byte port
    // from gym-math.js, proven equal to the original Nice Stat Solver
    // across 743,720 comparisons (max abs diff 0). Its UMD wrapper sets
    // globalThis.GymMath, which we read as `M` below. DO NOT edit — any
    // change here voids the verification.
    // ================================================================
/*
 * gym-math.js
 *
 * DOM-free port of the pure gym-training math from "Nice Stat Solver 2.5"
 * (training.html, "uses JTS 2.0/Vladar formula"). No document/els/inputs —
 * every function takes plain values and returns plain values.
 *
 * Core formula (per train):
 *   S       = adjustStatForCap(currentStat)              // soft cap above 50m
 *   logTerm = round(1 + 0.07 * round(ln(1 + happy/250), 4), 4)
 *   power   = 8 * happy^1.05
 *   happyAdj= (1 - (happy/99999)^2) * A                  // A/B/C depend on stat type
 *   base    = S*logTerm + power + happyAdj + B
 *   factor  = (1/200000) * perkMultiplier * dots * energy
 *   avg     = base * factor        range = C * factor    (gain = avg ± range)
 *
 * IMPORTANT: the original's exact rounding AND its caches are preserved.
 * The caches are not just a speed-up — they quantize their keys, so two
 * slightly different inputs can share one cached result. Sequence solving
 * depends on that behavior, so it is replicated verbatim.
 *
 * Usable two ways:
 *   - Browser: <script src="gym-math.js"></script>  ->  window.GymMath
 *   - Node:    const GymMath = require('./gym-math.js')  (or ESM default import)
 */
(function (global, factory) {
    'use strict';
    var api = factory();
    // Node / CommonJS (also what `import GymMath from './gym-math.js'` sees)
    if (typeof module === 'object' && module !== null && typeof module.exports === 'object') {
        module.exports = api;
    }
    // Plain browser script tag (harmless in node too)
    if (global && typeof global === 'object') {
        global.GymMath = api;
    }
})(typeof globalThis !== 'undefined' ? globalThis
    : typeof window !== 'undefined' ? window
    : typeof self !== 'undefined' ? self
    : this,
function () {
    'use strict';

    // ------------------------------------------------------------------
    // Gym table — verbatim from training.html. `energy` is the cost per
    // train; the four stat fields are the gym's dot ratings (0 = the gym
    // cannot train that stat).
    // ------------------------------------------------------------------
    const GYM_DATA = [
        { name: "[L] Premier Fitness", energy: 5, strength: 2, speed: 2, defense: 2, dexterity: 2 },
        { name: "[L] Average Joes", energy: 5, strength: 2.4, speed: 2.4, defense: 2.8, dexterity: 2.4 },
        { name: "[L] Woodys Workout", energy: 5, strength: 2.8, speed: 3.2, defense: 3, dexterity: 2.8 },
        { name: "[L] Beach Bods", energy: 5, strength: 3.2, speed: 3.2, defense: 3.2, dexterity: 0 },
        { name: "[L] Silver Gym", energy: 5, strength: 3.4, speed: 3.6, defense: 3.4, dexterity: 3.2 },
        { name: "[L] Pour Femme", energy: 5, strength: 3.4, speed: 3.6, defense: 3.6, dexterity: 3.8 },
        { name: "[L] Davies Den", energy: 5, strength: 3.7, speed: 0, defense: 3.7, dexterity: 3.7 },
        { name: "[L] Global Gym", energy: 5, strength: 4, speed: 4, defense: 4, dexterity: 4 },
        { name: "[M] Knuckle Heads", energy: 10, strength: 4.8, speed: 4.4, defense: 4, dexterity: 4.2 },
        { name: "[M] Pioneer Fitness", energy: 10, strength: 4.4, speed: 4.6, defense: 4.8, dexterity: 4.4 },
        { name: "[M] Anabolic Anomalies", energy: 10, strength: 5, speed: 4.6, defense: 5.2, dexterity: 4.6 },
        { name: "[M] Core", energy: 10, strength: 5, speed: 5.2, defense: 5, dexterity: 5 },
        { name: "[M] Racing Fitness", energy: 10, strength: 5, speed: 5.4, defense: 4.8, dexterity: 5.2 },
        { name: "[M] Complete Cardio", energy: 10, strength: 5.5, speed: 5.8, defense: 5.5, dexterity: 5.2 },
        { name: "[M] Legs, Bums and Tums", energy: 10, strength: 0, speed: 5.6, defense: 5.6, dexterity: 5.8 },
        { name: "[M] Deep Burn", energy: 10, strength: 6, speed: 6, defense: 6, dexterity: 6 },
        { name: "[H] Apollo Gym", energy: 10, strength: 6, speed: 6.2, defense: 6.4, dexterity: 6.2 },
        { name: "[H] Gun Shop", energy: 10, strength: 6.6, speed: 6.4, defense: 6.2, dexterity: 6.2 },
        { name: "[H] Force Training", energy: 10, strength: 6.4, speed: 6.6, defense: 6.4, dexterity: 6.8 },
        { name: "[H] Cha Chas", energy: 10, strength: 6.4, speed: 6.4, defense: 6.8, dexterity: 7 },
        { name: "[H] Atlas", energy: 10, strength: 7, speed: 6.4, defense: 6.4, dexterity: 6.6 },
        { name: "[H] Last Round", energy: 10, strength: 6.8, speed: 6.6, defense: 7, dexterity: 6.6 },
        { name: "[H] The Edge", energy: 10, strength: 6.8, speed: 7, defense: 7, dexterity: 6.8 },
        { name: "[H] Georges", energy: 10, strength: 7.3, speed: 7.3, defense: 7.3, dexterity: 7.3 },
        { name: "[S] Balboas Gym", energy: 25, strength: 0, speed: 0, defense: 7.5, dexterity: 7.5 },
        { name: "[S] Frontline Fitness", energy: 25, strength: 7.5, speed: 7.5, defense: 0, dexterity: 0 },
        { name: "[S] Gym 3000", energy: 50, strength: 8, speed: 0, defense: 0, dexterity: 0 },
        { name: "[S] Mr. Isoyamas", energy: 50, strength: 0, speed: 0, defense: 8, dexterity: 0 },
        { name: "[S] Total Rebound", energy: 50, strength: 0, speed: 8, defense: 0, dexterity: 0 },
        { name: "[S] Elites", energy: 50, strength: 0, speed: 0, defense: 0, dexterity: 8 },
        { name: "[S] Sports Science Lab", energy: 25, strength: 9, speed: 9, defense: 9, dexterity: 9 },
        { name: "The Jail Gym", energy: 5, strength: 3.4, speed: 3.4, defense: 4.6, dexterity: 0 }
    ];

    // Per-stat formula constants: A feeds the happy adjustment, B is a flat
    // offset in the base, C scales the random range.
    const STAT_CONSTANTS = {
        strength: { A: 1600, B: 1700, C: 700 },
        speed:    { A: 1600, B: 2000, C: 1350 },
        dexterity:{ A: 1800, B: 1500, C: 1000 },
        defense:  { A: 2100, B: -600, C: 1500 }
    };

    // Above STAT_CAP the effective stat is soft-capped (see adjustStatForCap).
    const STAT_CAP = 50000000;
    const SOFT_CAP_DIVISOR = 8.77635;
    const STAT_CAP_CACHE = new Map();
    const MAX_HAPPY = 99999;

    // Precomputed happy-dependent terms for every integer happy 0..99999.
    const HAPPY_TABLE = {
        logTerm: new Float64Array(MAX_HAPPY + 1),
        powerTerm: new Float64Array(MAX_HAPPY + 1),
        happyAdjBase: new Float64Array(MAX_HAPPY + 1)
    };

    // Decimal rounding via the string-exponent trick — copied verbatim from
    // the original. This is NOT equivalent to Math.round(x*10^d)/10^d for all
    // inputs, so it must stay exactly like this to match the original output.
    function round(num, decimals) {
        return Number(Math.round(num + 'e' + decimals) + 'e-' + decimals);
    }

    (function initHappyTable() {
        for (let h = 0; h <= MAX_HAPPY; h++) {
            const logTerm = round(1 + 0.07 * round(Math.log(1 + h / 250), 4), 4);
            HAPPY_TABLE.logTerm[h] = logTerm;
            HAPPY_TABLE.powerTerm[h] = 8 * Math.pow(h, 1.05);
            const ratio = h / MAX_HAPPY;
            HAPPY_TABLE.happyAdjBase[h] = 1 - (ratio * ratio);
        }
    })();

    // Clamp happy into the table range; non-integers get Math.round'ed.
    function clampHappy(happy) {
        if (happy <= 0) return 0;
        if (happy >= MAX_HAPPY) return MAX_HAPPY;
        return Math.round(happy);
    }

    // Quantized cache key for the per-calculator memo. Coarser buckets at
    // higher stats (e.g. >=1e7 rounds to buckets of 50) — kept verbatim
    // because colliding inputs intentionally share one cached result.
    function makeStatCacheKey(stat) {
        if (!isFinite(stat) || stat <= 0) return '0';
        if (stat >= 1e9) return Math.round(stat / 1000) + 'k';
        if (stat >= 1e8) return Math.round(stat / 100) + 'h';
        if (stat >= 1e7) return Math.round(stat / 50) + '50';
        if (stat >= 1e6) return Math.round(stat / 10) + '10';
        if (stat >= 1e4) return stat.toFixed(1);
        return stat.toFixed(3);
    }

    // Soft cap: below 50m the stat is used as-is; above it, the excess is
    // divided by 8.77635 * log10(stat). Results are memoized per rounded stat.
    function adjustStatForCap(stat) {
        if (stat <= 0) return 0;
        if (stat <= STAT_CAP) return stat;
        const key = Math.round(stat);
        if (STAT_CAP_CACHE.has(key)) return STAT_CAP_CACHE.get(key);
        const logComponent = Math.log10 ? Math.log10(stat) : (Math.log(stat) / Math.LN10);
        if (!isFinite(logComponent) || logComponent <= 0) {
            STAT_CAP_CACHE.set(key, STAT_CAP);
            return STAT_CAP;
        }
        const adjusted = STAT_CAP + (stat - STAT_CAP) / (SOFT_CAP_DIVISOR * logComponent);
        STAT_CAP_CACHE.set(key, adjusted);
        return adjusted;
    }

    // Happy lost per train: one of round(e/10*4|5|6), averaged. Cached per energy.
    const HAPPY_LOSS_CACHE = {};

    function estimateHappyLoss(energy) {
        if (!HAPPY_LOSS_CACHE[energy]) {
            const base = energy / 10;
            const outcomes = [4, 5, 6].map(step => Math.round(base * step));
            const avg = outcomes.reduce((sum, val) => sum + val, 0) / outcomes.length;
            HAPPY_LOSS_CACHE[energy] = {
                avg,
                min: Math.min(...outcomes),
                max: Math.max(...outcomes)
            };
        }
        return HAPPY_LOSS_CACHE[energy];
    }

    // ------------------------------------------------------------------
    // Perk multiplier. The original reads six percentage inputs and does
    //   product of (1 + pct/100)  in this exact order:
    //   faction, property, job, eduS (stat-specific edu), eduG (general edu), book
    // Order is preserved because float multiplication order matters for
    // last-digit equality. Empty/NaN values coerce to 0 like the page's val().
    // ------------------------------------------------------------------
    function perkMultiplier(perks) {
        perks = perks || {};
        const val = (x) => parseFloat(x) || 0; // mirrors: (id) => parseFloat(...value) || 0
        const p = [
            1 + (val(perks.faction) / 100),
            1 + (val(perks.property) / 100),
            1 + (val(perks.job) / 100),
            1 + (val(perks.eduS) / 100),
            1 + (val(perks.eduG) / 100),
            1 + (val(perks.book) / 100)
        ];
        return p.reduce((a, b) => a * b, 1);
    }

    // ------------------------------------------------------------------
    // fastCalc factory — verbatim port. Returns
    //   calc(currentStat, happy, dots, energy) -> { avg, range, nextHappy }
    // One instance memoizes across calls (quantized keys), exactly like the
    // original solver's single shared instance per hunt.
    // ------------------------------------------------------------------
    function createFastCalculator(statType, multiplier) {
        const { A, B, C } = STAT_CONSTANTS[statType];
        const baseFactorMult = (1 / 200000) * multiplier;
        const fastCache = new Map();

        return function (currentStat, happy, dots, energy) {
            if (dots <= 0 || energy <= 0) return { avg: 0, range: 0, nextHappy: happy };

            const safeHappy = Math.max(happy, 0);
            const happyIdx = clampHappy(safeHappy);
            const statKey = makeStatCacheKey(currentStat);
            const cacheKey = `${dots}|${energy}|${happyIdx}|${statKey}`;
            if (fastCache.has(cacheKey)) {
                return fastCache.get(cacheKey);
            }
            const S = adjustStatForCap(currentStat);
            const logTerm = HAPPY_TABLE.logTerm[happyIdx];
            const powerTerm = HAPPY_TABLE.powerTerm[happyIdx];
            const happyAdj = HAPPY_TABLE.happyAdjBase[happyIdx] * A;
            const baseWithoutRand = (S * logTerm) + powerTerm + happyAdj + B;
            const factor = baseFactorMult * dots * energy;
            const avg = baseWithoutRand * factor;
            const range = C * factor;
            const happyLoss = estimateHappyLoss(energy).avg;

            const result = {
                avg: avg > 0 ? avg : 0,
                range,
                nextHappy: Math.max(safeHappy - happyLoss, 0)
            };
            fastCache.set(cacheKey, result);
            return result;
        };
    }

    // One-shot single-train estimate: { avg, range, nextHappy }.
    // NOTE: statType is required here even though the original fastCalc didn't
    // take it — the original captured statType via closure, and A/B/C (happy
    // adjustment, base offset, random range) all depend on it.
    function estimateTrain(currentStat, happy, dots, energy, multiplier, statType) {
        if (!STAT_CONSTANTS[statType]) {
            throw new Error("estimateTrain: statType must be 'strength'|'speed'|'defense'|'dexterity'");
        }
        return createFastCalculator(statType, multiplier)(currentStat, happy, dots, energy);
    }

    // Chance (%) that a run ending at finalAvg ± totalHalfRange lands inside
    // the integer window [targetInt, targetInt+1). Verbatim port.
    function getSuccessChance(finalAvg, totalHalfRange, targetInt) {
        const start = Math.max(finalAvg - totalHalfRange, targetInt);
        const end = Math.min(finalAvg + totalHalfRange, targetInt + 0.9999);
        if (start >= end) return 0;
        const overlap = end - start;
        const totalSpan = totalHalfRange * 2;
        if (totalSpan === 0) return (finalAvg >= targetInt && finalAvg < targetInt + 1) ? 100 : 0;
        let pct = (overlap / totalSpan) * 100;
        return pct > 100 ? 100 : pct;
    }

    // ------------------------------------------------------------------
    // Path solver for one exact integer target — verbatim port.
    // Phase 1: bulk-train at the best gym until close to the target.
    // Phase 1b: same, in chunks of 5 while plenty of steps remain.
    // Phase 2: BFS over all available gyms to land exactly in
    //          [targetInt, targetInt+1) within maxSteps trains, then check
    //          the success chance against minChance.
    // Returns { path, finalVal, totalRange, totalEnergy, chance } or null.
    // ------------------------------------------------------------------
    function solveForTargetRange(start, startHappy, targetInt, fastCalc, gyms, bulkGym, minChance, maxSteps, budget) {
        let simStat = start;
        let simHappy = startHappy;
        let path = [];
        const limit = targetInt;

        // 1. Bulk (Safety Stop)
        let sanity = 20000;
        while (sanity-- > 0 && path.length < maxSteps) {
            const stepInfo = fastCalc(simStat, simHappy, bulkGym.dots, bulkGym.energy);
            if (simStat + stepInfo.avg >= limit + 1) break;
            if ((limit - simStat) < (stepInfo.avg * 3)) break;
            simStat += stepInfo.avg;
            simHappy = stepInfo.nextHappy;
            path.push(bulkGym);
            if (stepInfo.avg <= 0.00001 || simHappy <= 0) break;
        }

        // 1b. Chunk application for repeated best-gym steps
        const CHUNK_SIZE = 5;
        while (path.length < maxSteps) {
            if ((maxSteps - path.length) < CHUNK_SIZE) break;
            let chunkProgress = false;
            let lastChunkAvg = 0;
            for (let r = 0; r < CHUNK_SIZE && path.length < maxSteps; r++) {
                const stepInfo = fastCalc(simStat, simHappy, bulkGym.dots, bulkGym.energy);
                if (stepInfo.avg <= 0.00001 || simHappy <= 0) { chunkProgress = false; break; }
                if (simStat + stepInfo.avg >= limit + 1) { chunkProgress = false; break; }
                simStat += stepInfo.avg;
                simHappy = stepInfo.nextHappy;
                lastChunkAvg = stepInfo.avg;
                path.push(bulkGym);
                chunkProgress = true;
            }
            if (!chunkProgress) break;
            if ((limit - simStat) < lastChunkAvg * 3) break;
        }

        // 2. BFS (Track Variance and Steps)
        let searchGyms = gyms.map(g => {
            const preview = fastCalc(simStat, simHappy, g.dots, g.energy);
            return { ...g, previewAvg: preview.avg || 0 };
        }).sort((a, b) => {
            if (b.previewAvg !== a.previewAvg) return b.previewAvg - a.previewAvg;
            if (a.energy !== b.energy) return a.energy - b.energy;
            return b.dots - a.dots;
        });

        // Queue: [value, happy, historyArray]. Dequeue via a head pointer (O(1))
        // instead of queue.shift() (O(n)) — at high stat the queue grows to
        // hundreds of thousands of nodes, and shift() made the whole BFS O(n²),
        // which was the freeze. `budget` (optional, shared across a hunt's solves)
        // caps total BFS work so an unsolvable high-stat run can't spin forever.
        let queue = [[simStat, simHappy, []]];
        let head = 0;
        let visited = new Set();
        let maxOps = 100000;
        const QUEUE_CAP = 200000;

        while (head < queue.length && maxOps-- > 0) {
            if (budget) { if (budget.ops <= 0) return null; budget.ops--; }
            let [curVal, curHappy, curHist] = queue[head++];
            const stepsUsed = path.length + curHist.length;
            const stepsRemaining = maxSteps - stepsUsed;
            if (stepsRemaining <= 0) continue;

            const bestStepPreview = fastCalc(curVal, curHappy, bulkGym.dots, bulkGym.energy);
            // Check Target
            if (Math.floor(curVal) === targetInt) {
                let fullPath = [...path, ...curHist];

                if (fullPath.length > maxSteps) continue;

                let finalAvg = start;
                let finalHappy = startHappy;
                let totalRange = 0;

                for (let i = 0; i < fullPath.length; i++) {
                    let s = fullPath[i];
                    let info = fastCalc(finalAvg, finalHappy, s.dots, s.energy);
                    finalAvg += info.avg;
                    finalHappy = info.nextHappy;
                    totalRange += info.range;
                }

                let chance = getSuccessChance(finalAvg, totalRange, targetInt);
                if (chance >= minChance) {
                    return {
                        path: fullPath,
                        finalVal: finalAvg,
                        totalRange: totalRange,
                        totalEnergy: fullPath.reduce((a, b) => a + b.energy, 0),
                        chance: chance
                    };
                }
            }

            if (bestStepPreview.avg <= 0) continue;
            if (curVal + bestStepPreview.avg * stepsRemaining < targetInt) continue;

            if (curVal >= targetInt + 1) continue;

            let key = `${Math.round(curVal * 1000)}|${Math.round(curHappy * 10)}`;
            if (visited.has(key)) continue;
            visited.add(key);

            if (queue.length < QUEUE_CAP) {
                for (let g of searchGyms) {
                    let step = fastCalc(curVal, curHappy, g.dots, g.energy);
                    if (step.avg <= 0) continue;
                    let nextVal = curVal + step.avg;

                    if (nextVal < targetInt + 1) {
                        queue.push([nextVal, step.nextHappy, [...curHist, g]]);
                    }
                }
            }
        }
        return null;
    }

    // ------------------------------------------------------------------
    // Full "hunt" — DOM-free port of the original btnSolve click handler.
    // Finds the nearest reachable "nice" targets (containing 69 / 420) and
    // the train path to hit them.
    //
    // options:
    //   statType     'strength'|'speed'|'defense'|'dexterity'   (required)
    //   currentStat  starting stat value                        (required)
    //   happy        starting happy                             (required)
    //   multiplier   perk multiplier — OR pass `perks` (object for perkMultiplier)
    //   maxGymIndex  highest allowed GYM_DATA index (default: last gym)
    //   maxSteps     max trains (default 10)
    //   minSequences minimum count of 69/420 sequences (default 1)
    //   minChance    minimum success chance %, 0-100 (default 50)
    //   niceMode     '420' | '69' | 'either' (default 'either')
    //
    // Returns { t1, t2, candidateCount, scanStart, scanLimit, availableGyms,
    //           bestGym, multiplier }.
    // t1 = nearest target with exactly minSequences sequences,
    // t2 = nearest target with more than minSequences sequences; each is
    // { target, finalVal, variance, energy, path, score, chance } or null.
    // ------------------------------------------------------------------
    function solveSequence(options) {
        const opts = options || {};
        const statType = opts.statType;
        if (!STAT_CONSTANTS[statType]) {
            throw new Error("solveSequence: statType must be 'strength'|'speed'|'defense'|'dexterity'");
        }
        // Same coercion the page applied via val(): NaN/empty -> 0
        const startStat = parseFloat(opts.currentStat) || 0;
        const startHappy = parseFloat(opts.happy) || 0;
        const mult = (opts.multiplier != null) ? opts.multiplier : perkMultiplier(opts.perks);
        const maxGymIndex = (opts.maxGymIndex != null) ? opts.maxGymIndex : GYM_DATA.length - 1;
        const minSeq = parseInt(opts.minSequences, 10) || 1;
        const minChance = (opts.minChance != null) ? opts.minChance : 50;
        const maxSteps = (opts.maxSteps != null) ? opts.maxSteps : 10;
        const niceMode = opts.niceMode || 'either';

        // Gyms usable for this stat, best dots first (stable sort keeps the
        // original index order on ties, same as the page).
        let availableGyms = [];
        for (let i = 0; i <= maxGymIndex; i++) {
            if (GYM_DATA[i][statType] > 0) {
                availableGyms.push({
                    id: i,
                    name: GYM_DATA[i].name,
                    energy: GYM_DATA[i].energy,
                    dots: GYM_DATA[i][statType]
                });
            }
        }
        availableGyms.sort((a, b) => b.dots - a.dots);
        const bestGym = availableGyms[0];

        if (availableGyms.length === 0) {
            return { t1: null, t2: null, candidateCount: 0, scanStart: 0, scanLimit: 0, availableGyms, bestGym: null, multiplier: mult, error: 'No valid gyms for this stat.' };
        }

        const fastCalc = createFastCalculator(statType, mult);

        // --- CALCULATE MAX REACHABLE STAT ---
        let simStat = startStat;
        let simHappy = startHappy;
        for (let i = 0; i < maxSteps; i++) {
            const { avg, nextHappy } = fastCalc(simStat, simHappy, bestGym.dots, bestGym.energy);
            simStat += avg;
            simHappy = nextHappy;
        }
        let scanLimit = Math.ceil(simStat + 1);
        if (scanLimit <= startStat) scanLimit = Math.ceil(startStat + 1);
        let scanStart = Math.ceil(startStat);

        // --- GENERATE CANDIDATES WITH CONSTRAINTS ---
        const re69 = /69/g;
        const re420 = /420/g;
        let t1Found = null;
        let t2Found = null;
        let candidates = [];

        // Scan the reachable range for "nice" numbers, NEAREST first. Two hard
        // bounds so it can't freeze on high-stat accounts (where the reachable
        // range spans 1M+ integers): stop after MAX_SCAN integers, and stop once
        // we have enough candidates. Rare patterns like "420" used to scan the
        // whole million-wide range because the candidate cap never tripped —
        // MAX_SCAN closes that. We only need the NEAREST nice targets anyway.
        const MAX_SCAN = 250000;
        const scanEnd = Math.min(scanLimit, scanStart + MAX_SCAN);
        for (let i = scanStart; i < scanEnd; i++) {
            let s = i.toString();

            const has69 = s.includes('69');
            const has420 = s.includes('420');

            // Apply constraint mode
            let allow = false;
            if (niceMode === '420') {
                allow = has420;
            } else if (niceMode === '69') {
                allow = has69;
            } else { // 'either'
                allow = has69 || has420;
            }

            if (!allow) continue;

            // Score = total sequences of "69" + "420"
            let score = 0;
            const m69 = s.match(re69);
            const m420 = s.match(re420);
            if (m69 || m420) {
                const c69 = m69 ? m69.length : 0;
                const c420 = m420 ? m420.length : 0;
                score = c69 + c420;
            }

            if (score >= minSeq) {
                candidates.push({ val: i, score: score });
            }

            if (candidates.length >= 2000) break;
        }

        if (candidates.length === 0) {
            return { t1: null, t2: null, candidateCount: 0, scanStart, scanLimit, availableGyms, bestGym, multiplier: mult };
        }

        // --- SOLVE ---
        // Only path-solve the NEAREST candidates, and share ONE op budget across
        // all of them. Each solve is a bounded BFS, but running full-cost failing
        // solves on many candidates (common at high stat, where exact integer
        // landings are near-impossible) was the other half of the freeze. The
        // shared budget hard-caps total work; the nearest candidates are plenty.
        const MAX_SOLVE = 250;
        const solveBudget = { ops: 400000 };
        for (let k = 0; k < candidates.length && k < MAX_SOLVE; k++) {
            let cand = candidates[k];
            if (solveBudget.ops <= 0) break;

            if (cand.score === minSeq && t1Found) continue;
            if (cand.score > minSeq && t2Found) continue;

            let pathInfo = solveForTargetRange(
                startStat,
                startHappy,
                cand.val,
                fastCalc,
                availableGyms,
                bestGym,
                minChance,
                maxSteps,
                solveBudget
            );

            if (pathInfo) {
                let resObj = {
                    target: cand.val,
                    finalVal: pathInfo.finalVal,
                    variance: pathInfo.totalRange,
                    energy: pathInfo.totalEnergy,
                    path: pathInfo.path,
                    score: cand.score,
                    chance: pathInfo.chance
                };

                if (cand.score > minSeq && !t2Found) {
                    t2Found = resObj;
                }
                if (cand.score === minSeq && !t1Found) {
                    t1Found = resObj;
                }
            }

            if (t1Found && t2Found) break;
        }

        return { t1: t1Found, t2: t2Found, candidateCount: candidates.length, scanStart, scanLimit, availableGyms, bestGym, multiplier: mult };
    }

    // Collapse a train path (array of gym steps) into display rows of
    // consecutive same-gym runs: { name, dots, count, energy }. Same grouping
    // the original renderPath used for its table.
    function condensePath(ops) {
        let rows = [];
        if (ops.length > 0) {
            let cur = ops[0];
            let count = 1;
            let e = cur.energy;
            for (let i = 1; i < ops.length; i++) {
                if (ops[i].id === cur.id) {
                    count++;
                    e += ops[i].energy;
                } else {
                    rows.push({ name: cur.name, dots: cur.dots, count: count, energy: e });
                    cur = ops[i];
                    count = 1;
                    e = cur.energy;
                }
            }
            rows.push({ name: cur.name, dots: cur.dots, count: count, energy: e });
        }
        return rows;
    }

    return {
        GYM_DATA,
        STAT_CONSTANTS,
        STAT_CAP,
        SOFT_CAP_DIVISOR,
        MAX_HAPPY,
        HAPPY_TABLE,
        round,
        clampHappy,
        makeStatCacheKey,
        adjustStatForCap,
        estimateHappyLoss,
        perkMultiplier,
        createFastCalculator,
        estimateTrain,
        getSuccessChance,
        solveForTargetRange,
        solveSequence,
        condensePath
    };
});

    // ================================================================
    // Advisor. Everything below is UI + live data; all numbers come
    // from the verified module above (referenced as M).
    // ================================================================
    var M = (typeof GymMath !== 'undefined') ? GymMath : window.GymMath;
    if (!M) { console.error('[GymAdvisor] gym-math module missing'); return; }

    var STATS = ['strength', 'speed', 'defense', 'dexterity'];
    var STAT_LABEL = { strength: 'Strength', speed: 'Speed', defense: 'Defense', dexterity: 'Dexterity' };
    var KEY_LS = 'gymAdvisorApiKey';
    var COLLAPSE_LS = 'gymAdvisorCollapsed';

    // Live state. Populated from the API (with a key) or manual inputs.
    var state = {
        stats: { strength: 0, speed: 0, defense: 0, dexterity: 0 },
        happy: 0,
        energy: 0,
        activeGymIdx: 7,                 // default Global Gym (index 7) until known
        mult: { strength: 1, speed: 1, defense: 1, dexterity: 1 },
        loaded: false,
        err: null
    };

    function getKey() { try { return localStorage.getItem(KEY_LS) || ''; } catch (e) { return ''; } }
    function setKey(k) { try { localStorage.setItem(KEY_LS, k); } catch (e) {} }
    function clearKey() { try { localStorage.removeItem(KEY_LS); } catch (e) {} }
    function maskKey(k) { return k && k.length >= 4 ? '••••••••••••' + k.slice(-4) : ''; }

    function fmt(n) {
        if (!isFinite(n)) return '0';
        if (Math.abs(n) >= 1000) return Math.round(n).toLocaleString();
        return (Math.round(n * 100) / 100).toString();
    }

    // ---- Perk parsing: turn Torn's perk arrays into a per-stat gym-gain
    // multiplier, using the same rules the Vladar-based gym-gain script uses
    // (property = "+N% gym gains" all-stat; education 1% general + 1% per stat;
    // company 3% general + 10% per stat; book 20% all / 30% per stat; faction
    // N% per stat). Everything is multiplicative, matching the verified module.
    function parsePerks(data) {
        var mAll = 1, mStr = 1, mSpe = 1, mDef = 1, mDex = 1;
        function each(arr, fn) { if (Array.isArray(arr)) for (var i = 0; i < arr.length; i++) fn(String(arr[i])); }
        each(data.property_perks, function (s) {
            if (s.includes('gym gains')) { var m = s.match(/\d+/); if (m) mAll *= (parseFloat(m[0]) / 100) + 1; }
        });
        each(data.education_perks, function (s) {
            if (s.includes('1% gym gains')) mAll *= 1.01;
            if (s.includes('dexterity gym gains')) mDex *= 1.01;
            if (s.includes('defense gym gains')) mDef *= 1.01;
            if (s.includes('speed gym gains')) mSpe *= 1.01;
            if (s.includes('strength gym gains')) mStr *= 1.01;
        });
        each(data.company_perks, function (s) {
            if (s.includes('dexterity gym gains')) mDex *= 1.1;
            if (s.includes('defense gym gains')) mDef *= 1.1;
            if (s.includes('gym gains') && !s.includes('dexterity') && !s.includes('defense') && !s.includes('speed') && !s.includes('strength')) mAll *= 1.03;
        });
        each(data.book_perks, function (s) {
            if (s.includes('all gym gains')) mAll *= 1.2;
            if (s.includes('strength gym gains')) mStr *= 1.3;
            if (s.includes('defense gym gains')) mDef *= 1.3;
            if (s.includes('speed gym gains')) mSpe *= 1.3;
            if (s.includes('dexterity gym gains')) mDex *= 1.3;
        });
        each(data.faction_perks, function (s) {
            if (s.includes('gym gains')) {
                var m = s.match(/\d+/); if (!m) return;
                var n = (parseFloat(m[0]) / 100) + 1;
                if (s.includes('strength')) mStr *= n;
                else if (s.includes('speed')) mSpe *= n;
                else if (s.includes('defense')) mDef *= n;
                else if (s.includes('dexterity')) mDex *= n;
            }
        });
        return {
            strength: mStr * mAll,
            speed: mSpe * mAll,
            defense: mDef * mAll,
            dexterity: mDex * mAll
        };
    }

    function fetchData() {
        var key = getKey();
        if (!key) { state.err = 'no-key'; render(); return; }
        state.err = null;
        var url = 'https://api.torn.com/user/?selections=battlestats,bars,gym,perks&key=' + encodeURIComponent(key);
        fetch(url).then(function (r) { return r.json(); }).then(function (d) {
            if (d && d.error) { state.err = 'API error ' + d.error.code + ': ' + d.error.error; render(); return; }
            state.stats = {
                strength: d.strength, speed: d.speed, defense: d.defense, dexterity: d.dexterity
            };
            state.happy = d.happy && typeof d.happy.current === 'number' ? d.happy.current : 0;
            state.energy = d.energy && typeof d.energy.current === 'number' ? d.energy.current : 0;
            // active_gym is 1-indexed into Torn's gym order, which matches
            // GYM_DATA for gyms 1..31 (the 32nd, Jail, is not an active gym).
            var gi = (typeof d.active_gym === 'number') ? d.active_gym - 1 : -1;
            if (gi >= 0 && gi < 31) state.activeGymIdx = gi;
            state.mult = parsePerks(d);
            state.loaded = true;
            state.err = null;
            render();
        }).catch(function (e) { state.err = 'Network error: ' + (e && e.message || e); render(); });
    }

    // ---- Compute a projected multi-train total by simulating each train
    // (stat + happy both drift), using the verified single-train estimator.
    function projectTotal(statType, dots, energyPerTrain, mult, trains) {
        var calc = M.createFastCalculator(statType, mult);
        var stat = state.stats[statType], happy = state.happy, total = 0;
        var n = Math.min(trains, 2000); // safety cap; real train counts are tiny
        for (var i = 0; i < n; i++) {
            var info = calc(stat, happy, dots, energyPerTrain);
            if (info.avg <= 0) break;
            total += info.avg; stat += info.avg; happy = info.nextHappy;
        }
        return total;
    }

    // ---------------- rendering ----------------
    function el(id) { return document.getElementById(id); }

    function renderRightNow() {
        var gym = M.GYM_DATA[state.activeGymIdx];
        if (!gym) return '<div class="ga-muted">Unknown active gym.</div>';
        var rows = '', bestAvg = -1;
        var data = STATS.map(function (st) {
            var dots = gym[st];
            if (!dots || dots <= 0) return { st: st, dots: 0 };
            var est = M.estimateTrain(state.stats[st], state.happy, dots, gym.energy, state.mult[st], st);
            var trains = gym.energy > 0 ? Math.floor(state.energy / gym.energy) : 0;
            var total = trains > 0 ? projectTotal(st, dots, gym.energy, state.mult[st], trains) : 0;
            if (est.avg > bestAvg) bestAvg = est.avg;
            return { st: st, dots: dots, est: est, trains: trains, total: total };
        });
        data.forEach(function (d) {
            if (d.dots === 0) {
                rows += '<div class="ga-row ga-dim"><span class="ga-st">' + STAT_LABEL[d.st] + '</span><span class="ga-na">gym can\'t train</span></div>';
                return;
            }
            var isBest = d.est.avg === bestAvg && bestAvg > 0;
            rows += '<div class="ga-row' + (isBest ? ' ga-best' : '') + '">' +
                '<span class="ga-st">' + STAT_LABEL[d.st] + (isBest ? ' ★' : '') + '</span>' +
                '<span class="ga-gain">+' + fmt(d.est.avg) + ' <span class="ga-range">±' + fmt(d.est.range) + '</span></span>' +
                '<span class="ga-total">×' + d.trains + ' → +' + fmt(d.total) + '</span>' +
                '</div>';
        });
        return '<div class="ga-gymname">' + gym.name + ' · ' + gym.energy + 'E/train · ' +
            state.energy + 'E, ' + state.happy + ' happy</div>' + rows;
    }

    function gymOptions(selName, forStat) {
        var opts = '';
        for (var i = 0; i < M.GYM_DATA.length; i++) {
            var g = M.GYM_DATA[i];
            var disabled = forStat && (!g[forStat] || g[forStat] <= 0);
            opts += '<option value="' + i + '"' + (i === state.activeGymIdx ? ' selected' : '') +
                (disabled ? ' disabled' : '') + '>' + g.name + '</option>';
        }
        return opts;
    }

    function renderEstimator() {
        var st = el('ga-est-stat') ? el('ga-est-stat').value : 'strength';
        var gi = el('ga-est-gym') ? parseInt(el('ga-est-gym').value, 10) : state.activeGymIdx;
        var gym = M.GYM_DATA[gi];
        var out = el('ga-est-out');
        if (!gym || !out) return;
        var dots = gym[st];
        if (!dots || dots <= 0) { out.innerHTML = '<span class="ga-na">' + gym.name + ' can\'t train ' + STAT_LABEL[st] + '</span>'; return; }
        var est = M.estimateTrain(state.stats[st], state.happy, dots, gym.energy, state.mult[st], st);
        var trains = gym.energy > 0 ? Math.floor(state.energy / gym.energy) : 0;
        var total = trains > 0 ? projectTotal(st, dots, gym.energy, state.mult[st], trains) : 0;
        out.innerHTML = '<div class="ga-row"><span class="ga-st">Single train</span><span class="ga-gain">+' +
            fmt(est.avg) + ' <span class="ga-range">±' + fmt(est.range) + '</span></span></div>' +
            '<div class="ga-row"><span class="ga-st">All ' + state.energy + 'E (×' + trains + ')</span><span class="ga-gain">+' + fmt(total) + '</span></div>';
    }

    function renderSolver() {
        var out = el('ga-solve-out');
        if (!out) return;
        var st = el('ga-solve-stat').value;
        var maxSteps = parseInt(el('ga-solve-steps').value, 10) || 10;
        var minChance = parseInt(el('ga-solve-chance').value, 10) || 50;
        var niceMode = el('ga-solve-mode').value;
        out.innerHTML = '<div class="ga-muted">Solving…</div>';
        // Defer so the "Solving…" paints before the (sync) BFS runs.
        setTimeout(function () {
            var res;
            try {
                res = M.solveSequence({
                    statType: st, currentStat: state.stats[st], happy: state.happy,
                    multiplier: state.mult[st], maxSteps: maxSteps, minChance: minChance,
                    minSequences: 1, niceMode: niceMode
                });
            } catch (e) { out.innerHTML = '<span class="ga-na">' + e.message + '</span>'; return; }
            function target(label, t) {
                if (!t) return '<div class="ga-row ga-dim"><span class="ga-st">' + label + '</span><span class="ga-na">none within ' + maxSteps + ' trains</span></div>';
                var rows = M.condensePath(t.path).map(function (r) {
                    return r.count + '× ' + r.name + ' (' + r.energy + 'E)';
                }).join('<br>');
                return '<div class="ga-solve-card">' +
                    '<div class="ga-solve-head">' + label + ': <b>' + t.target.toLocaleString() + '</b> ' +
                    '<span class="ga-muted">' + Math.round(t.chance) + '% · ' + t.energy + 'E · ' + t.path.length + ' trains</span></div>' +
                    '<div class="ga-solve-path">' + rows + '</div></div>';
            }
            if (res.candidateCount === 0) { out.innerHTML = '<span class="ga-na">No nice numbers reachable in ' + maxSteps + ' trains.</span>'; return; }
            out.innerHTML = target('Nearest', res.t1) + target('More sequences', res.t2);
        }, 20);
    }

    function render() {
        var panel = el('ga-panel');
        if (!panel) return;
        var body = el('ga-body');
        var key = getKey();

        if (state.err === 'no-key' || (!key && !state.loaded)) {
            body.innerHTML =
                '<div class="ga-sec"><div class="ga-muted">Enter a Torn API key (Limited is fine) to auto-load your stats, happy, energy, and perks.</div>' +
                '<div class="ga-keyrow"><input id="ga-key" type="text" placeholder="16-char API key" autocomplete="off" spellcheck="false">' +
                '<button id="ga-save" class="ga-btn">Save</button></div></div>';
            el('ga-save').addEventListener('click', function () {
                var v = el('ga-key').value.trim();
                if (v.length !== 16) { alert('That is not a 16-character API key.'); return; }
                setKey(v); fetchData();
            });
            return;
        }
        if (state.err) {
            body.innerHTML = '<div class="ga-sec"><div class="ga-na">' + state.err + '</div>' +
                '<div class="ga-keyrow"><button id="ga-rekey" class="ga-btn">Change key</button>' +
                '<button id="ga-retry" class="ga-btn">Retry</button></div></div>';
            el('ga-rekey').addEventListener('click', function () { clearKey(); state.loaded = false; state.err = 'no-key'; render(); });
            el('ga-retry').addEventListener('click', fetchData);
            return;
        }
        if (!state.loaded) { body.innerHTML = '<div class="ga-sec"><div class="ga-muted">Loading…</div></div>'; return; }

        body.innerHTML =
            '<div class="ga-sec"><div class="ga-h">Best train now</div>' + renderRightNow() + '</div>' +
            '<div class="ga-sec"><div class="ga-h">Estimator</div>' +
            '<div class="ga-ctl"><select id="ga-est-stat">' + STATS.map(function (s) { return '<option value="' + s + '">' + STAT_LABEL[s] + '</option>'; }).join('') + '</select>' +
            '<select id="ga-est-gym">' + gymOptions('est') + '</select></div>' +
            '<div id="ga-est-out"></div></div>' +
            '<div class="ga-sec"><div class="ga-h ga-toggle" id="ga-solve-toggle">Nice-number solver ▸</div>' +
            '<div id="ga-solve-wrap" style="display:none">' +
            '<div class="ga-ctl"><select id="ga-solve-stat">' + STATS.map(function (s) { return '<option value="' + s + '">' + STAT_LABEL[s] + '</option>'; }).join('') + '</select>' +
            '<select id="ga-solve-mode"><option value="either">69 or 420</option><option value="69">69 only</option><option value="420">420 only</option></select></div>' +
            '<div class="ga-ctl"><label class="ga-lbl">Max trains <input id="ga-solve-steps" type="number" value="10" min="1" max="50"></label>' +
            '<label class="ga-lbl">Min % <input id="ga-solve-chance" type="number" value="50" min="0" max="100"></label>' +
            '<button id="ga-solve-go" class="ga-btn">Solve</button></div>' +
            '<div id="ga-solve-out"></div></div></div>' +
            '<div class="ga-foot"><span class="ga-muted">' + maskKey(key) + '</span>' +
            '<button id="ga-refresh" class="ga-btn ga-sm">Refresh</button>' +
            '<button id="ga-rekey2" class="ga-btn ga-sm">Key</button></div>';

        el('ga-est-stat').addEventListener('change', renderEstimator);
        el('ga-est-gym').addEventListener('change', renderEstimator);
        renderEstimator();

        var solveToggle = el('ga-solve-toggle');
        solveToggle.addEventListener('click', function () {
            var w = el('ga-solve-wrap');
            var open = w.style.display === 'none';
            w.style.display = open ? 'block' : 'none';
            solveToggle.textContent = 'Nice-number solver ' + (open ? '▾' : '▸');
        });
        el('ga-solve-go').addEventListener('click', renderSolver);
        el('ga-refresh').addEventListener('click', fetchData);
        el('ga-rekey2').addEventListener('click', function () { clearKey(); state.loaded = false; state.err = 'no-key'; render(); });
    }

    // ---------------- panel shell + styles ----------------
    function injectStyles() {
        if (el('ga-style')) return;
        var css =
            '#ga-panel{position:fixed;right:12px;bottom:12px;width:290px;z-index:2147483000;font:12px/1.4 Arial,sans-serif;color:#e8e8e8;background:#1c1f24;border:1px solid #333;border-radius:8px;box-shadow:0 6px 24px rgba(0,0,0,.5);overflow:hidden}' +
            '#ga-head{display:flex;align-items:center;justify-content:space-between;padding:8px 10px;background:#12b886;color:#04120c;font-weight:700;cursor:pointer}' +
            '#ga-head .ga-v{font-weight:400;opacity:.7;font-size:10px}' +
            '#ga-body{max-height:70vh;overflow:auto;padding:4px 0}' +
            '.ga-sec{padding:8px 10px;border-top:1px solid #2a2e34}' +
            '.ga-sec:first-child{border-top:0}' +
            '.ga-h{font-weight:700;color:#12b886;margin-bottom:6px;font-size:11px;text-transform:uppercase;letter-spacing:.4px}' +
            '.ga-toggle{cursor:pointer;user-select:none}' +
            '.ga-gymname{font-size:10px;color:#9aa0a6;margin-bottom:6px}' +
            '.ga-row{display:flex;align-items:baseline;justify-content:space-between;gap:6px;padding:2px 0}' +
            '.ga-best{background:#12341f;margin:0 -10px;padding:2px 10px;border-radius:4px}' +
            '.ga-dim{opacity:.5}' +
            '.ga-st{flex:0 0 auto;min-width:70px}' +
            '.ga-gain{color:#69db7c;font-weight:700;text-align:right;flex:1}' +
            '.ga-range{color:#8a929a;font-weight:400;font-size:10px}' +
            '.ga-total{color:#c0c4c8;font-size:10px;flex:0 0 auto}' +
            '.ga-na{color:#e8896a}.ga-muted{color:#8a929a}' +
            '.ga-ctl{display:flex;gap:6px;margin-bottom:6px}' +
            '.ga-ctl select,.ga-ctl input{flex:1;min-width:0;background:#0f1216;color:#e8e8e8;border:1px solid #333;border-radius:4px;padding:4px}' +
            '.ga-lbl{flex:1;display:flex;align-items:center;gap:4px;font-size:10px;color:#9aa0a6}' +
            '.ga-lbl input{width:52px;flex:0 0 auto}' +
            '.ga-btn{background:#12b886;color:#04120c;border:0;border-radius:4px;padding:4px 10px;font-weight:700;cursor:pointer;flex:0 0 auto}' +
            '.ga-btn:hover{background:#0ca678}.ga-btn.ga-sm{padding:2px 8px;font-size:10px}' +
            '.ga-keyrow{display:flex;gap:6px;margin-top:6px}.ga-keyrow input{flex:1;background:#0f1216;color:#e8e8e8;border:1px solid #333;border-radius:4px;padding:4px}' +
            '.ga-solve-card{background:#0f1216;border:1px solid #2a2e34;border-radius:4px;padding:6px;margin-top:6px}' +
            '.ga-solve-head{margin-bottom:4px}.ga-solve-path{font-size:10px;color:#c0c4c8}' +
            '.ga-foot{display:flex;align-items:center;justify-content:space-between;gap:6px;padding:6px 10px;border-top:1px solid #2a2e34;background:#16191d}' +
            '#ga-panel.ga-collapsed #ga-body{display:none}';
        var s = document.createElement('style');
        s.id = 'ga-style'; s.textContent = css;
        document.head.appendChild(s);
    }

    function buildPanel() {
        if (el('ga-panel')) return;
        injectStyles();
        var p = document.createElement('div');
        p.id = 'ga-panel';
        var collapsed = false;
        try { collapsed = localStorage.getItem(COLLAPSE_LS) === '1'; } catch (e) {}
        if (collapsed) p.className = 'ga-collapsed';
        p.innerHTML =
            '<div id="ga-head"><span>🏋️ Gym Advisor <span class="ga-v">v' + SCRIPT_VERSION + '</span></span><span id="ga-min">' + (collapsed ? '▸' : '▾') + '</span></div>' +
            '<div id="ga-body"></div>';
        document.body.appendChild(p);
        el('ga-head').addEventListener('click', function () {
            var c = p.classList.toggle('ga-collapsed');
            el('ga-min').textContent = c ? '▸' : '▾';
            try { localStorage.setItem(COLLAPSE_LS, c ? '1' : '0'); } catch (e) {}
        });
        render();
    }

    // The gym page is a React SPA that mounts after document-idle; wait for
    // body, build the panel once, then load data.
    function boot() {
        if (!document.body) { setTimeout(boot, 200); return; }
        buildPanel();
        if (getKey()) fetchData();
    }
    boot();
})();
