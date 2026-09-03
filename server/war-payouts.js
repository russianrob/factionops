/**
 * War payout calculator.
 *
 * Pulls every ranked-war attack from the configured war window, classifies
 * each hit (war / retal / overseas / chain / assist), weights them, then
 * splits a loot total across attackers proportional to their score.
 *
 * Design echoes the public "war payout" tool from torn forums thread
 * t=16563983: dynamic FF mode (each hit worth its actual fair-fight value)
 * vs static tiered mode (flat per-bracket points). Custom mode is
 * supported via caller-supplied weight overrides.
 *
 * Cached per (warId, mode) for 5 minutes to avoid re-hammering Torn's
 * attacks endpoint on every UI render.
 */

import * as store from "./store.js";
import { fetchFactionAttacks, fetchRankedWarReport } from "./torn-api.js";
import * as warHistory from "./war-history.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const CACHE_TTL_MS = 5 * 60 * 1000;
const _cache = new Map(); // `${warId}:${mode}` → { result, expiresAt }

// v5.0.66: persist payouts results to disk for ENDED wars. Their
// underlying Torn data is frozen (no new attacks possible), so the
// computed payouts never change — caching forever saves the multi-
// minute paginated fetch on every pm2 restart and every modal open
// after the in-memory 5-min TTL would have expired.
const PAYOUTS_CACHE_FILE = path.join(
  process.env.DATA_DIR || "./data",
  "war-payouts-cache.json"
);
let _diskCacheLoaded = false;
function loadDiskCache() {
  if (_diskCacheLoaded) return;
  _diskCacheLoaded = true;
  try {
    const raw = fs.readFileSync(PAYOUTS_CACHE_FILE, "utf-8");
    const data = JSON.parse(raw);
    let count = 0, migrated = 0;
    for (const [key, entry] of Object.entries(data)) {
      // v5.0.69: cache key format changed in v5.0.68 from
      // `warId:mode` to `warId:mode:settingsHash`. Old entries
      // (lacking the settings suffix) become orphans and force
      // recompute every time. Migrate them to the new format
      // assuming no overrides were active.
      let migratedKey = key;
      if (!key.includes(':L')) {
        const settingsKey = `L${entry.settings?.lootOverride ?? '_'}|A${entry.settings?.assistWeight ?? '_'}|N${entry.settings?.nonWarWeight ?? '_'}|P${entry.settings?.payoutPct ?? '_'}`;
        migratedKey = `${key}:${settingsKey}`;
        migrated++;
      }
      _cache.set(migratedKey, { result: entry, expiresAt: Infinity });
      count++;
    }
    if (count > 0) {
      console.log(`[war-payouts] Loaded ${count} cached payout(s) from disk${migrated ? ` (${migrated} migrated to v5.0.68 key format)` : ''}`);
      if (migrated > 0) persistDiskCache(); // rewrite the file with new keys
    }
  } catch (_) { /* file missing or corrupted — proceed empty */ }
}
function persistDiskCache() {
  try {
    const obj = {};
    for (const [key, entry] of _cache.entries()) {
      // Only persist forever-cached entries (ended wars).
      if (entry.expiresAt === Infinity) obj[key] = entry.result;
    }
    fs.writeFileSync(PAYOUTS_CACHE_FILE, JSON.stringify(obj));
  } catch (e) {
    console.warn(`[war-payouts] Disk cache write failed: ${e.message}`);
  }
}

/** Default weights — match the OP's spec from t=16563983. */
const WEIGHTS = {
  dynamic: {
    war_hit: ff => ff * 1.00,
    retal: ff => ff * 1.25,
    overseas_war: ff => ff * 1.50,
    assist: () => 0.75,
    chain_hit: () => 0.60,
    os_chain: () => 0.60,
  },
  static: {
    // Tiered: each war hit = 1 pt regardless of FF, retals/overseas
    // still scale by FF for some incentive.
    war_hit: () => 1,
    retal: ff => ff * 1.25,
    overseas_war: ff => ff * 1.50,
    assist: () => 0.75,
    chain_hit: () => 0.60,
    os_chain: () => 0.60,
  },
};

/**
 * Classify one ranked-war attack record. Torn's v1 attacks selection
 * provides a `modifiers` object with these keys:
 *   fairFight       — exact FF value used for respect
 *   war             — 1 (chained but counted) or 2 (ranked-war hit)
 *   retaliation     — >1 if this hit is a retal of an incoming attack
 *   overseas        — >1 if attacker was abroad
 *   group_attack    — >1 if several attackers hit the target at once
 * The ranked_war field at the top level (already filtered upstream) is
 * 1 for any attack tracked under the ranked-war system. We further
 * narrow "war_hit" to attacks against the actual enemy faction; chain
 * hits against unrelated targets get the chain_hit / os_chain bucket.
 */
export function classify(atk, enemyFactionId) {
  const m = atk.modifiers || {};
  // An assist is a RESULT, not a modifier: someone else landed the
  // finishing blow, so Torn awards the respect to them and none to you.
  //
  // This used to test `group_attack > 1` instead. That is a different
  // mechanic entirely — several attackers hitting one target at once —
  // and it is a full hit that earns full respect. The two never coincide:
  // across all 1084 rows of data/attack-ledger/war_war_42055.json, ZERO
  // carried both, every group>1 row earned respect and every Assist row
  // earned none. Reading one as the other devalued 13 real war hits to
  // assist weight and hid 23 real assists (reported as "13 assists" when
  // Torn's war report said 24).
  //
  // `group_attack` remains a KEPT bonus in the fair_score maths — the
  // coordination effort it was always meant to credit.
  //
  // The old `atk.assist` probe is gone with it: v2 has no such field and
  // neither did v1, so it was never anything but dead weight.
  if (String(atk.result || "") === "Assist") return "assist";

  const isOverseas = m.overseas && Number(m.overseas) > 1;
  const defFid = String(atk.defender_faction || "");
  const isVsEnemy = defFid && defFid === String(enemyFactionId);
  const isRetal = m.retaliation && Number(m.retaliation) > 1;

  if (isVsEnemy && isOverseas) return "overseas_war";
  if (isVsEnemy && isRetal) return "retal";
  if (isVsEnemy) return "war_hit";
  if (isOverseas) return "os_chain";
  return "chain_hit";
}

/** Pick a weight value for an attack given mode + classification + ff. */
function weight(mode, cat, ff) {
  const set = WEIGHTS[mode] || WEIGHTS.dynamic;
  const fn = set[cat];
  if (!fn) return 0;
  const v = fn(ff || 0);
  return Number.isFinite(v) && v > 0 ? v : 0;
}

// Cache the item-market-values.json read in-process — it's static-ish
// and we don't want to hit the disk for every payout call.
let _itemValuesCache = null;
let _itemValuesLoadedAt = 0;
function loadItemMarketValues() {
  if (_itemValuesCache && Date.now() - _itemValuesLoadedAt < 600_000) {
    return _itemValuesCache;
  }
  try {
    const file = path.join(process.env.DATA_DIR || "./data", "item-market-values.json");
    const raw = fs.readFileSync(file, "utf-8");
    const parsed = JSON.parse(raw);
    _itemValuesCache = parsed.values || parsed || {};
    _itemValuesLoadedAt = Date.now();
  } catch (_) {
    _itemValuesCache = {};
  }
  return _itemValuesCache;
}

/**
 * Auto-detect loot total from Torn's ranked war report rewards.
 *
 * Prior bug: this returned `respect × $1000`. Respect is a faction
 * stat — not cash — so the auto-detected loot for war 40638 came back
 * as ~$6.37M when the actual cache value was ~$1.73B.
 *
 * New approach: sum the market value of each item cache we received
 * (Armor / Melee / Small / Medium / Heavy Arms), using the cached
 * data/item-market-values.json the warboard already maintains. That
 * gives the *theoretical* sale value at current market prices — the
 * admin can still override per-war via /api/war/:warId/loot-override
 * to reflect actual realized sale price + treasury contribution.
 */
async function tryFetchLoot(factionId, apiKey, rwId) {
  // Returns { total, items: [{id, name, quantity, unitPrice, lineTotal}], cash, source }
  // so the UI can show *how* the estimate was computed (per-cache market
  // value × quantity), which is what admins actually need to verify the
  // number — and to override it if they sold below market or added
  // treasury cash.
  const out = { total: 0, items: [], cash: 0, source: "none" };
  try {
    const report = await fetchRankedWarReport(factionId, apiKey, rwId);
    const factions = Array.isArray(report?.factions) ? report.factions : [];
    const ours = factions.find(f => String(f.id) === String(factionId));
    if (!ours?.rewards) return out;
    const r = ours.rewards;
    if (typeof r.cash === "number" && r.cash > 0) out.cash += r.cash;
    if (typeof r.money === "number" && r.money > 0) out.cash += r.money;
    out.total += out.cash;
    if (Array.isArray(r.items) && r.items.length > 0) {
      const values = loadItemMarketValues();
      for (const it of r.items) {
        const id = String(it.id);
        const qty = Number(it.quantity) || 0;
        const unit = Number(values[id]) || 0;
        const lineTotal = qty * unit;
        out.items.push({
          id,
          name: it.name || `Item ${id}`,
          quantity: qty,
          unitPrice: unit,
          lineTotal,
        });
        out.total += lineTotal;
      }
    }
    if (out.total > 0) {
      out.source = out.items.length > 0 ? "caches+cash" : "cash";
    } else if (typeof r.points === "number" && r.points > 0) {
      // Last-resort fallback (Torn pays $5K/pt for some war tiers).
      out.total = r.points * 5000;
      out.source = "points";
    }
  } catch (_) { /* admin will input manually */ }
  return out;
}

/**
 * Main entry. Returns {
 *   warId, mode, fromTs, toTs, lootTotal, totalScore,
 *   members: [{ playerId, name, score, sharePct, dollarPayout, breakdown }],
 *   attackCount, generatedAt,
 * }
 */
/** Drop the disk + memory cache for a war (all modes) — called when
 *  per-war settings change so the next request recomputes. */
export function invalidateCache(warId) {
  const prefix = String(warId) + ':';
  for (const k of [..._cache.keys()]) {
    if (k.startsWith(prefix)) _cache.delete(k);
  }
  persistDiskCache();
}

/**
 * Tally every attack in the war window into per-attacker scores and
 * category breakdowns.
 *
 * Pure by construction — no store, no network, no clock. That is what
 * makes the payout maths testable: a test can replay real rows from
 * data/attack-ledger/ through it and assert on the breakdown directly.
 *
 * @param {object[]} attacks  v1-shaped attack rows (see normalizeV2Attack)
 * @returns {Record<string, object>} playerId → tally
 */
export function tallyAttacks(attacks, { ourFid, enemyFactionId, mode, settings = {} }) {
  const byAttacker = {}; // playerId → { name, computedScore, breakdown, attackCount, fairScoreSum, ffSum, ffSamples, totalAttacks }

  for (const atk of attacks) {
    if (String(atk.attacker_faction || "") !== ourFid) continue;
    const aid = String(atk.attacker_id || "");
    if (!aid || aid === "0") continue; // stealth = 0; skip

    // v5.0.72: ensure entry exists FIRST so failed attacks get
    // counted in totalAttacks + breakdown.failed even though they
    // earn no respect and don't add to score.
    if (!byAttacker[aid]) {
      byAttacker[aid] = {
        playerId: aid,
        name: String(atk.attacker_name || `Player ${aid}`),
        computedScore: 0,
        fairScoreSum: 0,
        ffSum: 0,
        ffSamples: 0,
        ffMax: 0,
        breakdown: {},
        attackCount: 0,    // successful war hits (drives the score)
        totalAttacks: 0,   // every attack attempted (war + non-war + failed)
      };
    }
    byAttacker[aid].totalAttacks += 1;

    // Assists earn ZERO respect, so they cannot travel the respect-driven
    // path below: the `respectGain <= 0` gate would drop them outright —
    // that is exactly how 23 real assists went missing from this war — and
    // the fair_score maths has no respect to scale. They are real war
    // contributions, so they are counted and weighted here, ahead of both
    // that gate and the ranked_war gate.
    if (String(atk.result || '') === 'Assist') {
      const ASSIST_WEIGHT = Number.isFinite(settings.assistWeight)
        ? Math.max(0, Number(settings.assistWeight))
        : 0.3;
      // Static mode pays a flat weight per assist. Dynamic mode scales by
      // fair_score, which is necessarily 0 here — so assistWeight is inert
      // in dynamic mode. Left that way deliberately: what a respect-scaled
      // mode ought to pay for a zero-respect hit is a payout-policy call
      // for the admin, not something to change while fixing a miscount.
      if (mode === 'static') byAttacker[aid].fairScoreSum += ASSIST_WEIGHT;
      byAttacker[aid].computedScore += weight(mode, 'assist',
        Number((atk.modifiers || {}).fair_fight) || 0);
      byAttacker[aid].breakdown.assist = (byAttacker[aid].breakdown.assist || 0) + 1;
      byAttacker[aid].attackCount += 1;
      continue;
    }

    // 2026-05-17: loss attacks ONLY (Lost, Stalemate, Escape,
    // Interrupted, Timeout) bucket into breakdown.failed.
    //
    // Previous gate was `respect_gain <= 0` — too broad. That caught
    // legitimate WINS that happen to earn no respect, most notably
    // Assists (the killer gets the respect, not the assister) and
    // hits on already-injured / stat-locked / pre-mugged targets.
    // User report: 'N4 failes 6 times but he only lost once' — the
    // other 5 were assists / zero-respect wins.
    //
    // SUCCESS_RESULTS for reference (mirror of war-status-monitor.js):
    //   Attacked, Hospitalized, Mugged, Looted, Special, Assist
    //
    // 2026-05-23: narrowed to TRUE losses only — user direction.
    // Stalemate / Escape / Interrupted / Timeout are inconvenient
    // but not the attacker's fault in the same way as actually
    // losing the fight. They no longer contribute to the breakdown
    // "losses" bucket or earn failedWeight credit.
    const LOSS_RESULTS = new Set(['Lost']);
    const respectGain = Number(atk.respect_gain) || 0;

    // Turtling: hospitalising your own member so the enemy cannot farm them
    // for points. Both ends of the attack are ours, which nothing else in a
    // war looks like, so it needs no new data to spot.
    //
    // It is not a ranked-war attack, so without this it fell into the non-war
    // bucket below and was filed beside somebody mugging a random mid-war.
    //
    // It earns no respect either, so today it is dropped by the zero-respect
    // gate just below and scores nothing in either mode. That stays true until
    // a turtle weight is set -- naming a category must not move money on wars
    // already settled -- but the hit is now COUNTED, so the work is at least
    // visible. Once priced the weight is flat in both modes, because there is
    // no respect for a respect-scaled weight to scale.
    if (String(atk.defender_faction || "") === ourFid) {
      // A flat dollar rate takes precedence over the score weight. Awarding
      // both would pay for the same hospitalisation twice -- once off the top
      // of the pool and again through the share.
      const tp = Number(settings.turtlePay);
      const paidFlat = Number.isFinite(tp) && tp > 0;
      const tw = Number(settings.turtleWeight);
      byAttacker[aid].fairScoreSum += (!paidFlat && Number.isFinite(tw) && tw > 0) ? tw : 0;
      byAttacker[aid].breakdown.turtle = (byAttacker[aid].breakdown.turtle || 0) + 1;
      continue;
    }

    if (respectGain <= 0) {
      const result = String(atk.result || '');
      if (LOSS_RESULTS.has(result)) {
        byAttacker[aid].breakdown.failed = (byAttacker[aid].breakdown.failed || 0) + 1;
        const FAILED_WEIGHT = Number.isFinite(settings.failedWeight)
          ? Math.max(0, Number(settings.failedWeight))
          : 0;
        if (FAILED_WEIGHT > 0) byAttacker[aid].fairScoreSum += FAILED_WEIGHT;
      }
      // Either way, no respect to score from this attack — continue.
      continue;
    }

    // v5.0.58: non-war attacks DO contribute to score, but at a
    // reduced 'assist-level' weight per user policy ('non war hits
    // should get paid same as assists').
    // v5.0.64: weighting now varies by mode:
    //   dynamic — respect_gain × 0.3 ÷ chain ÷ warlord (FF-aware,
    //             scales with how tough the target was)
    //   static  — flat 0.3 per non-war attack (every non-war hit
    //             counts the same — matches the egalitarian static
    //             policy where war hits are also flat 1.0)
    if (atk.ranked_war !== 1) {
      // v5.0.68: non-war weight is overridable per-war via the gear
      // panel. Default 0.3 matches the typical assist:full-hit ratio.
      const NON_WAR_WEIGHT = Number.isFinite(settings.nonWarWeight)
        ? Math.max(0, Number(settings.nonWarWeight))
        : 0.3;
      let nwScore;
      if (mode === 'static') {
        nwScore = NON_WAR_WEIGHT;
      } else {
        const m2 = atk.modifiers || {};
        const chainMod2 = Number(m2.chain_bonus) || 1;
        const warlordMod2 = Number(m2.warlord_bonus) || 1;
        nwScore = (respectGain * NON_WAR_WEIGHT) / (chainMod2 * warlordMod2);
      }
      byAttacker[aid].fairScoreSum += nwScore;
      byAttacker[aid].breakdown.non_war = (byAttacker[aid].breakdown.non_war || 0) + 1;
      // Non-war attacks don't bump attackCount (war-only) — only fair_score
      // and the non_war breakdown counter. attackCount stays the war-attack
      // count so the 'War / Total' ratio in the popover still works.
      continue;
    }

    // v5.0.44: 'fair payout score' — strip the bonuses the user
    // doesn't want counted toward payouts. Per user direction:
    //   - chain_bonus (varies by chain timing, not effort)
    //   - war (×2 ranked-war respect tier — circumstantial)
    //   - warlord_bonus (warlord/load extra respect)
    // What stays: fair_fight (skill-of-fight), retaliation (you went
    // out of your way to retal), group_attack (coordination effort),
    // overseas (effort/inconvenience).
    const m = atk.modifiers || {};
    const warMod = Number(m.war) || 1;
    const chainMod = Number(m.chain_bonus) || 1;
    const warlordMod = Number(m.warlord_bonus) || 1;
    // fair_score is what respect WOULD have been without the excluded
    // bonuses — divide them out of the final respect_gain.
    const fairScore = respectGain / (warMod * chainMod * warlordMod);

    const ff = Number(m.fair_fight ?? m.fairFight) || 0;
    const cat = classify(atk, enemyFactionId);
    const w = weight(mode, cat, ff);

    // (member entry already created above; keep populating)
    byAttacker[aid].computedScore += w;
    // v5.0.64: scoring per mode for ranked-war attacks:
    //   dynamic — fair_score (respect_gain ÷ war ÷ chain ÷ warlord),
    //             FF-aware via Torn's respect formula
    //   static  — 1.0 per successful war hit, 0.3 per assist
    //             (every direct hit pays equally regardless of FF or
    //             defender level — egalitarian payout policy)
    // v5.0.68/70: assist weight is overridable per-war via the gear
    // panel. Default 0.3 for BOTH modes per user request — matches
    // the typical assist:full-hit respect ratio Torn applies, and
    // means a group hit pays ~30% of a solo war hit regardless of
    // mode. Setting >0.3 boosts assists; <0.3 penalizes them more.
    const ASSIST_WEIGHT = Number.isFinite(settings.assistWeight)
      ? Math.max(0, Number(settings.assistWeight))
      : 0.3;
    if (mode === 'static') {
      byAttacker[aid].fairScoreSum += (cat === 'assist') ? ASSIST_WEIGHT : 1.0;
    } else {
      // FF Mode: assist contributes (fair_score × ASSIST_WEIGHT). With
      // default 0.3 this scales the assist's natural respect down to
      // ~30% — same effective rate as Termed Mode.
      byAttacker[aid].fairScoreSum += (cat === 'assist') ? (fairScore * ASSIST_WEIGHT) : fairScore;
    }
    if (ff > 0) {
      byAttacker[aid].ffSum += ff;
      byAttacker[aid].ffSamples += 1;
      if (ff > byAttacker[aid].ffMax) byAttacker[aid].ffMax = ff;
    }
    byAttacker[aid].breakdown[cat] = (byAttacker[aid].breakdown[cat] || 0) + 1;
    byAttacker[aid].attackCount += 1;
  }

  return byAttacker;
}

export async function computePayouts(warId, options = {}) {
  loadDiskCache(); // lazy: first call hydrates persisted ended-war results
  const mode = options.mode === "static" ? "static" : "dynamic";
  // v5.0.68: per-war settings overlay. The cache key includes a hash
  // of the active settings so different setting combinations cache
  // separately (and the gear panel's 'save' invalidates whichever
  // entry was current).
  const settings = store.getPayoutSettings(warId) || {};
  const settingsKey = settingsSignature(settings);
  const cacheKey = `${warId}:${mode}:${settingsKey}`;
  const cached = _cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now() && !options.forceFresh) {
    // For permacached (ended-war) entries, sanity-check that the
    // cached toTs aligns with the war's CURRENT warEndedAt. Mid-war
    // flickers can persist a partial-window result; this guard
    // detects the mismatch on the next read and forces recompute.
    // (Tolerance: 60 sec to absorb Date/Math floor rounding.)
    if (cached.expiresAt === Infinity) {
      const war = store.getWar(warId);
      const expectedToTs = war && war.warEndedAt
        ? Math.floor(Number(war.warEndedAt) / 1000)
        : null;
      if (expectedToTs && cached.result.toTs && Math.abs(cached.result.toTs - expectedToTs) > 60) {
        console.warn(`[war-payouts] cache stale for ${warId}: cached toTs=${cached.result.toTs}, war.warEndedAt=${expectedToTs} (diff ${expectedToTs - cached.result.toTs}s) — invalidating`);
        _cache.delete(cacheKey);
        persistDiskCache();
      } else {
        return { ...cached.result, cached: true };
      }
    } else {
      return { ...cached.result, cached: true };
    }
  }

  const war = store.getWar(warId);
  if (!war) {
    const served = serveArchivedPayout(warId, mode);
    if (served) return { ...served, cached: true };
    throw new Error(`War ${warId} not found`);
  }
  if (!war.factionId || !war.enemyFactionId) {
    throw new Error(`War ${warId} missing factionId/enemyFactionId`);
  }

  const fromTs = Number(war.warStart) || 0;
  const toTs = war.warEndedAt
    ? Math.floor(Number(war.warEndedAt) / 1000)
    : Math.floor(Date.now() / 1000);
  if (!fromTs || toTs <= fromTs) {
    throw new Error(`War ${warId} has invalid time range (${fromTs} → ${toTs})`);
  }

  // Pool keys can return Torn error code 7 ("Incorrect ID-entity
  // relation") when the key's owner left the faction or lost access.
  // Rotate through up to POOL_RETRY_LIMIT pool keys, quarantining any
  // that fail with code 7 so future calls skip them. Without this
  // rotation a single dead key in the pool silently returns [] and
  // the Payouts UI shows "no wars available" even with valid wars.
  const POOL_RETRY_LIMIT = 8;
  const triedKeys = new Set();
  let attacks = null;
  let lastErr = null;
  let apiKey = null; // hoisted — downstream (tryFetchLoot) reuses the working key.
  for (let attempt = 0; attempt < POOL_RETRY_LIMIT; attempt++) {
    const candidate = store.getPollingKey(war.factionId, "war-payouts", attempt);
    if (!candidate) break;
    if (triedKeys.has(candidate)) continue;
    triedKeys.add(candidate);
    try {
      // v5.0.57: pass rankedWarOnly:false so we can count war-attacks vs
      // total-attacks per member. Only ranked-war attacks contribute to
      // fair_score; the total count is shown in the breakdown popover.
      attacks = await fetchFactionAttacks(war.factionId, candidate, fromTs, toTs, { rankedWarOnly: false });
      apiKey = candidate;
      lastErr = null;
      break;
    } catch (err) {
      lastErr = err;
      if (err.code === 7) {
        // Permanent key issue for THIS faction — quarantine + try the next.
        store.quarantinePoolKey(candidate, war.factionId, `war-payouts: code 7 (${err.message})`);
        continue;
      }
      // Any other error (rate limit, network, etc.) — bail immediately
      // rather than burn through every key in the pool.
      throw err;
    }
  }
  if (attacks == null) {
    throw new Error(
      lastErr
        ? `All pool keys failed (last: ${lastErr.message})`
        : "No API key available in pool"
    );
  }

  const ourFid = String(war.factionId);
  const byAttacker = tallyAttacks(attacks, {
    ourFid,
    enemyFactionId: war.enemyFactionId,
    mode,
    settings,
  });

  // ── Pull Torn's official report for cross-reference ──────────────────
  // We use this as a SECONDARY display ('Torn score' column) so admins
  // can see how the fair-payout score compares to Torn's authoritative
  // respect — but payout shares are computed from fair_score (which
  // excludes chain/war/warlord bonuses per user request).
  let reportMembersById = null;
  let reportTotalScore = 0;
  let reportTotalAttacks = 0;
  let reportWarScores = null; // {myScore, enemyScore} from the ranked-war report
  try {
    const report = await fetchRankedWarReport(war.factionId, apiKey, warId);
    const factionsList = Array.isArray(report.factions)
      ? report.factions
      : Object.values(report.factions || {});
    const myFaction = factionsList.find(f => String(f.id) === ourFid);
    const enemyFaction = factionsList.find(f => String(f.id) !== ourFid);
    if (myFaction && enemyFaction && (myFaction.score != null || enemyFaction.score != null)) {
      reportWarScores = { myScore: Number(myFaction.score) || 0, enemyScore: Number(enemyFaction.score) || 0 };
    }
    if (myFaction && Array.isArray(myFaction.members) && myFaction.members.length > 0) {
      reportMembersById = {};
      for (const m of myFaction.members) {
        reportMembersById[String(m.id)] = m;
        reportTotalScore += Number(m.score) || 0;
        reportTotalAttacks += Number(m.attacks) || 0;
      }
    }
  } catch (_) {
    // Report unavailable — fair_score from attacks is still computable.
  }

  // Loot — caller-supplied wins; fall back to auto-detect from the
  // ranked war report; final fallback = 0 (admin must fill in UI).
  let lootTotal = 0;
  let lootBreakdown = null;
  let lootSource = "none";
  // v5.0.68: per-war loot override from settings takes precedence
  // over the auto-detected cache value. Caller can also pass
  // options.lootTotal to bypass everything.
  const settingsLoot = Number.isFinite(settings.lootOverride)
    ? Math.max(0, Number(settings.lootOverride))
    : null;
  if (options.lootTotal != null) {
    lootTotal = Math.max(0, Number(options.lootTotal) || 0);
    lootSource = "override";
  } else if (settingsLoot != null) {
    lootTotal = settingsLoot;
    lootSource = "admin override";
    lootBreakdown = await tryFetchLoot(war.factionId, apiKey, warId).catch(() => null);
  } else {
    const detected = await tryFetchLoot(war.factionId, apiKey, warId);
    lootTotal = detected.total;
    lootBreakdown = detected;
    lootSource = detected.source;
  }

  // v5.0.60+68: 80/20 default split, overridable per-war.
  const payoutPct = Number.isFinite(options.payoutPct) ? options.payoutPct
    : Number.isFinite(settings.payoutPct) ? settings.payoutPct
    : 0.80;
  const clampedPct = Math.max(0, Math.min(1, Number(payoutPct)));
  const payoutPool = Math.round(lootTotal * clampedPct);
  const factionShare = lootTotal - payoutPool;

  // ── Build merged member list ─────────────────────────────────────────
  // Primary key: playerId (from attacks). For each, fair_score is the
  // sum of (respect_gain / war / chain_bonus / warlord_bonus) over their
  // contributing attacks. Torn report data is attached for comparison.
  const mergedById = {};
  for (const m of Object.values(byAttacker)) {
    mergedById[m.playerId] = {
      playerId: m.playerId,
      name: m.name,
      fairScore: m.fairScoreSum,
      attackCount: m.attackCount,
      totalAttacks: m.totalAttacks, // war + non-war (display only)
      breakdown: m.breakdown,
      avgFf: m.ffSamples > 0 ? (m.ffSum / m.ffSamples) : 0,
      maxFf: m.ffMax || 0,
      tornScore: 0,
      tornAttacks: 0,
      level: null,
    };
  }
  if (reportMembersById) {
    for (const [aid, rm] of Object.entries(reportMembersById)) {
      if (!mergedById[aid]) {
        mergedById[aid] = {
          playerId: aid,
          name: rm.name,
          fairScore: 0,
          attackCount: 0,
          breakdown: {},
          avgFf: 0,
          maxFf: 0,
          tornScore: 0,
          tornAttacks: 0,
          level: null,
        };
      }
      mergedById[aid].name = rm.name || mergedById[aid].name;
      mergedById[aid].tornScore = Number(rm.score) || 0;
      mergedById[aid].tornAttacks = Number(rm.attacks) || 0;
      mergedById[aid].level = Number(rm.level) || null;
    }
  }

  // Decide which score drives shares + payouts. Default = 'fair'
  // (computed from raw attacks, excludes chain/war/warlord). If we
  // have NO attacks for some reason but the report exists, fall back
  // to report scores so payouts at least show *something*.
  const baseMembers = Object.values(mergedById);
  const fairTotal = baseMembers.reduce((s, m) => s + m.fairScore, 0);
  const useFair = fairTotal > 0;
  const totalScore = useFair ? fairTotal : reportTotalScore;
  const scoreSource = useFair ? "fair" : (reportMembersById ? "report" : "computed");

  const members = baseMembers
    .map(m => {
      const primary = useFair ? m.fairScore : m.tornScore;
      const sharePct = totalScore > 0 ? (primary / totalScore) * 100 : 0;
      const dollarPayout = totalScore > 0
        ? Math.round((primary / totalScore) * payoutPool) // 80% pool, not full loot
        : 0;
      return {
        playerId: m.playerId,
        name: m.name,
        // 'score' is the value used for payout shares — fair_score by
        // default. tornScore is provided alongside as a comparison
        // column (Torn-authoritative respect including all bonuses).
        score: Math.round(primary * 100) / 100,
        sharePct: Math.round(sharePct * 10) / 10,
        dollarPayout,
        attackCount: m.attackCount || m.tornAttacks || 0,
        // v5.0.57: total attacks (war + non-war) for the war-vs-total
        // ratio in the breakdown popover.
        totalAttacks: m.totalAttacks || m.attackCount || m.tornAttacks || 0,
        avgFf: Math.round(m.avgFf * 100) / 100,
        maxFf: Math.round((m.maxFf || 0) * 100) / 100,
        level: m.level,
        breakdown: m.breakdown,
        tornScore: Math.round(m.tornScore * 100) / 100,
        tornAttacks: m.tornAttacks,
      };
    })
    .filter(m => m.score > 0 || m.tornScore > 0) // drop zero-contribution noise
    .sort((a, b) => b.score - a.score);

  // Turtles are paid a flat amount off the TOP of the pool, and everyone else
  // splits what is left. The pool stays what the faction decided to pay out.
  const turtle = turtleDollars(baseMembers, settings.turtlePay, payoutPool);
  if (turtle.spent > 0) {
    const splitPool = Math.max(0, payoutPool - turtle.spent);
    for (const mem of members) {
      const share = totalScore > 0 ? (useFair ? mem.score : mem.tornScore) / totalScore : 0;
      mem.dollarPayout = Math.round(share * splitPool) + (turtle.byPlayer[mem.playerId] || 0);
    }
    // A member who ONLY turtled has no score and was filtered out above, so
    // they are added back -- being paid and not listed is the worse failure.
    for (const bm of baseMembers) {
      const pay = turtle.byPlayer[bm.playerId];
      if (!pay || members.some(x => x.playerId === bm.playerId)) continue;
      members.push({
        playerId: bm.playerId, name: bm.name, score: 0, sharePct: 0,
        dollarPayout: pay, attackCount: bm.attackCount || 0,
        totalAttacks: bm.totalAttacks || bm.attackCount || 0,
        avgFf: 0, maxFf: 0, level: bm.level, breakdown: bm.breakdown,
        tornScore: 0, tornAttacks: bm.tornAttacks || 0,
      });
    }
    members.sort((a, b) => b.dollarPayout - a.dollarPayout);
  }

  const result = {
    warId,
    factionId: war.factionId,
    enemyFactionId: war.enemyFactionId,
    enemyFactionName: war.enemyFactionName || null,
    warResult: war.warResult || null,
    warScores: war.warScores || reportWarScores || null,
    mode,
    scoreSource, // "fair" (excludes chain/war/warlord), "report" (fallback), "computed" (legacy)
    reportTotalScore: Math.round(reportTotalScore * 10) / 10, // for UI comparison
    fromTs,
    toTs,
    lootTotal,
    lootBreakdown,
    lootSource,
    lootAutoDetected: options.lootTotal == null && lootTotal > 0,
    payoutPct: clampedPct, // e.g., 0.8 = 80% to members
    payoutPool,            // dollars distributed to members
    factionShare,          // dollars retained by faction
    turtlePaid: turtle.spent,       // of the pool, paid flat for turtling
    turtleCapped: turtle.capped,    // true when the flat rate hit the pool ceiling
    settings,              // active per-war overrides (for the gear panel)
    totalScore: Math.round(totalScore * 10) / 10,
    members,
    // Total attacks shown in heatmap header. Sum from our merged member
    // list rather than raw attacks.length (which over-counts if Torn
    // returns duplicates across paginated calls).
    attackCount: members.reduce((s, m) => s + (m.attackCount || 0), 0),
    generatedAt: Date.now(),
  };

  // v5.0.66: ended wars are immutable → cache forever + persist to
  // disk. Active wars stay on the 5-min in-memory TTL since their
  // attack log is still growing.
  if (war.warEnded) {
    _cache.set(cacheKey, { result, expiresAt: Infinity });
    persistDiskCache();
    // Snapshot this ended war's per-member activity into durable war history
    // (idempotent upsert; best-effort — never let it break payout compute).
    try { warHistory.ingestWar(war.factionId, war, result); }
    catch (e) { console.warn(`[war-history] ingest failed for ${warId}: ${e.message}`); }
  } else {
    _cache.set(cacheKey, { result, expiresAt: Date.now() + CACHE_TTL_MS });
  }
  return { ...result, cached: false };
}

/**
 * Score-backfill: for every stored war with no ranked-war score yet, fetch the
 * ranked-war report straight from Torn (reusing the legit pool-key path) and
 * fill in myScore/enemyScore. For wars that ended before the history store
 * existed, the live record is gone so they can't be recomputed — but Torn
 * still serves the report by war ID. Best-effort; returns wars filled.
 */
export async function backfillWarScores() {
  let filled = 0;
  for (const factionId of warHistory.factionIds()) {
    const missing = warHistory.warsMissingScores(factionId);
    if (!missing.length) continue;
    const ourFid = String(factionId);
    for (const { warKey, reportId } of missing) {
      const key = store.getPollingKey(factionId, "war-history", 0);
      if (!key) break; // no key for this faction — skip the rest
      try {
        const report = await fetchRankedWarReport(factionId, key, reportId);
        const facs = Array.isArray(report.factions) ? report.factions : Object.values(report.factions || {});
        const mine = facs.find(f => String(f.id) === ourFid);
        const enemy = facs.find(f => String(f.id) !== ourFid);
        if (mine && enemy && (mine.score != null || enemy.score != null)) {
          warHistory.setScores(factionId, warKey, { myScore: Number(mine.score) || 0, enemyScore: Number(enemy.score) || 0 });
          filled++;
        }
      } catch (_) { /* report gone / key issue — leave unscored */ }
    }
  }
  return filled;
}

/**
 * Build a combined member×war matrix for the heatmap view. Each member
 * row carries their score per war + total. Wars are returned in
 * chronological order so the UI can render columns left→right oldest→
 * newest. Reuses computePayouts (and its 5-min cache) for each war —
 * subsequent calls within the cache window are cheap.
 *
 * Loot is read from the per-war auto-detect; explicit overrides aren't
 * supported here (keeps the matrix one-shot computable; per-war manual
 * loot is still available via the per-war drilldown UI).
 */
export async function computePayoutsHeatmap(factionId, options = {}) {
  const mode = options.mode === "static" ? "static" : "dynamic";
  // 2026-05-16: forward forceFresh so the modal Refresh button can
  // actually bust the per-war cache. Without this, fresh=1 on the
  // heatmap endpoint propagated to listEligibleWars but NOT to the
  // computePayouts call below — so a war with bad cached data
  // (e.g. loot=$0 because Torn's report wasn't ready when first
  // computed) would never recompute.
  const forceFresh = !!options.forceFresh;
  // v5.0.71: only show the most-recent ended war by default. With
  // disk-cache the second-load is instant, but a cold load (after
  // pm2 restart, with multiple historical wars) was paginating
  // every war back-to-back and burning ~2-4 minutes. Per user
  // request, slice to the latest war only — older wars stay in
  // storage and computePayouts(warId) is still callable directly
  // if the UI ever wants to surface them.
  const allWars = listEligibleWars(factionId);
  const limit = Number.isFinite(options.warLimit) && options.warLimit > 0
    ? Math.min(options.warLimit, allWars.length)
    : 1;
  const wars = allWars.slice(0, limit);
  const perWar = [];
  // Sequential to avoid hammering Torn's attack endpoint when the
  // cache is cold; cached calls return instantly anyway.
  for (const w of wars) {
    try {
      const r = await computePayouts(w.warId, { mode, forceFresh });
      perWar.push({
        warId: w.warId,
        enemyFactionName: w.enemyFactionName,
        warResult: w.warResult,
        warEndedAt: w.warEndedAt,
        lootTotal: r.lootTotal,
        lootBreakdown: r.lootBreakdown,
        lootSource: r.lootSource,
        payoutPct: r.payoutPct,
        payoutPool: r.payoutPool,
        factionShare: r.factionShare,
        settings: r.settings, // pass through for the gear panel
        // Whether the numbers beside those settings were computed WITH them.
        settingsApplied: r.settingsApplied !== false,
        totalScore: r.totalScore,
        members: r.members,
      });
    } catch (e) {
      perWar.push({
        warId: w.warId,
        enemyFactionName: w.enemyFactionName,
        warResult: w.warResult,
        warEndedAt: w.warEndedAt,
        error: e.message,
      });
    }
  }

  // Build the member matrix. Key by playerId; track most-recent name
  // (later-war scores overwrite if a player changed their display name).
  const memberMap = {};
  for (const w of perWar) {
    if (!Array.isArray(w.members)) continue;
    for (const m of w.members) {
      if (!memberMap[m.playerId]) {
        memberMap[m.playerId] = {
          playerId: m.playerId,
          name: m.name,
          scoresByWar: {},
          payoutsByWar: {},
          // Per-war attack count + breakdown so the drilldown can show
          // 'Atk / Asst / War / Retal' columns instead of just a score.
          // Without these the UI had no way to surface 'how did I earn
          // this score' — user only saw aggregate dollar payouts.
          attacksByWar: {},
          totalAttacksByWar: {}, // v5.0.59: was missing — caused 'Cannot set property 40638 of undefined' on the per-war assignment below.
          breakdownByWar: {},
          // v5.0.44: include Torn-official score per war + avg FF for
          // side-by-side comparison in the UI. tornScoresByWar is purely
          // informational; fair score (in scoresByWar) drives payouts.
          tornScoresByWar: {},
          avgFfByWar: {},
          totalScore: 0,
          totalPayout: 0,
          totalAttacks: 0,
          totalBreakdown: {}, // war_hit / retal / overseas_war / chain_hit / os_chain / assist counts
          warsParticipated: 0,
        };
      }
      memberMap[m.playerId].name = m.name;
      memberMap[m.playerId].scoresByWar[w.warId] = m.score;
      memberMap[m.playerId].payoutsByWar[w.warId] = m.dollarPayout;
      memberMap[m.playerId].attacksByWar[w.warId] = m.attackCount || 0;
      memberMap[m.playerId].totalAttacksByWar[w.warId] = m.totalAttacks || m.attackCount || 0;
      memberMap[m.playerId].breakdownByWar[w.warId] = m.breakdown || {};
      memberMap[m.playerId].tornScoresByWar[w.warId] = m.tornScore || 0;
      memberMap[m.playerId].avgFfByWar[w.warId] = m.avgFf || 0;
      memberMap[m.playerId].totalScore += m.score;
      memberMap[m.playerId].totalPayout += m.dollarPayout;
      memberMap[m.playerId].totalAttacks += m.attackCount || 0;
      memberMap[m.playerId].warsParticipated++;
      // Roll up per-category breakdown across wars
      if (m.breakdown) {
        for (const [cat, n] of Object.entries(m.breakdown)) {
          memberMap[m.playerId].totalBreakdown[cat] =
            (memberMap[m.playerId].totalBreakdown[cat] || 0) + n;
        }
      }
    }
  }
  const members = Object.values(memberMap)
    .map(m => ({
      ...m,
      totalScore: Math.round(m.totalScore * 10) / 10,
    }))
    .sort((a, b) => b.totalScore - a.totalScore);

  return {
    factionId: String(factionId),
    mode,
    wars: perWar.map(w => ({
      warId: w.warId,
      enemyFactionName: w.enemyFactionName,
      warResult: w.warResult,
      warEndedAt: w.warEndedAt,
      lootTotal: w.lootTotal || 0,
      lootBreakdown: w.lootBreakdown || null,
      lootSource: w.lootSource || null,
      payoutPct: w.payoutPct ?? 0.80,
      payoutPool: w.payoutPool || 0,
      factionShare: w.factionShare || 0,
      settings: w.settings || {},
      settingsApplied: w.settingsApplied !== false,
      totalScore: w.totalScore || 0,
      error: w.error || null,
    })),
    members,
    generatedAt: Date.now(),
  };
}

/**
 * Serve a payout result for a war that's no longer in the live store, from the
 * durable archive. Resolves the faction + archive record by warKey, then tries
 * (in order): the in-memory payout cache matched BY IDENTITY (faction + enemy +
 * end-second, never by cache key), the archive record's own stored payout
 * fields, and finally a fields-only reconstruction. Returns null if the war
 * isn't in any faction's archive.
 */
/**
 * The stored attack log for a finished war.
 *
 * The post-war cache is filed under the key that was live when it was captured
 * -- war_<factionId>, which is reused every war -- while the payouts UI asks by
 * the war's REAL id. So a direct filename hit is tried first, and failing that
 * the directory is searched for the file whose report carries that id.
 *
 * The search result is remembered because these files run to megabytes and the
 * answer cannot change: a war's id and its capture are both immutable. It is
 * also only ever reached when someone has actually set weights on an archived
 * war, so the cost is paid by the feature that needs it.
 */
const _archivePathByWar = new Map();
function loadArchivedAttacks(warKey) {
  const key = String(warKey);
  if (_archivePathByWar.has(key)) {
    const p = _archivePathByWar.get(key);
    if (!p) return null;
    try { return JSON.parse(fs.readFileSync(p, "utf-8")).attackLog || null; }
    catch (_) { return null; }
  }
  const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "data", "post-war-cache");
  const direct = path.join(dir, key.replace(/[^A-Za-z0-9_-]/g, "_") + ".json");
  const candidates = [];
  try {
    if (fs.existsSync(direct)) candidates.push(direct);
    for (const f of fs.readdirSync(dir)) {
      const full = path.join(dir, f);
      if (full !== direct && f.endsWith(".json")) candidates.push(full);
    }
  } catch (_) { _archivePathByWar.set(key, null); return null; }
  for (const full of candidates) {
    try {
      const d = JSON.parse(fs.readFileSync(full, "utf-8"));
      const id = d && d.warReportData && d.warReportData.id;
      if (full === direct || String(id) === key) {
        _archivePathByWar.set(key, full);
        return d.attackLog || null;
      }
    } catch (_) { /* unreadable file — keep looking */ }
  }
  _archivePathByWar.set(key, null);
  return null;
}

function serveArchivedPayout(warKey, mode) {
  let fid = null, hw = null;
  for (const f of warHistory.factionIds()) {
    const rec = warHistory.getWar(f, warKey);
    if (rec) { fid = String(f); hw = rec; break; }
  }
  if (!hw) return null;
  const endedSec = hw.warEndedAt ? Math.floor(Number(hw.warEndedAt) / 1000) : 0;

  // Settings the admin has set for THIS war. A finished war never reaches the
  // live compute path, so without this every exit below serves numbers that
  // predate them -- and the gear panel showed the frozen archive copy, which is
  // what made a save look like it had not happened.
  const live = store.getPayoutSettings(warKey) || {};
  const liveSig = settingsSignature(live);
  const hasLive = liveSig !== settingsSignature({});
  if (hasLive) {
    const attacks = loadArchivedAttacks(warKey);
    const fresh = attacks && recomputeArchivedResult({ hw, fid, mode, attacks, settings: live });
    if (fresh) return fresh;
  }
  // 1) Cache-by-identity: a cached compute for this same physical war may still
  // live in memory under a now-orphaned key. Match on faction+enemy+end-second.
  let best = null;
  for (const entry of _cache.values()) {
    const r = entry && entry.result;
    if (!r) continue;
    if (String(r.factionId) !== fid || String(r.enemyFactionId) !== String(hw.enemyFactionId)) continue;
    if (endedSec && r.toTs && Math.abs(Math.floor(Number(r.toTs)) - endedSec) > 60) continue;
    // Identity is not enough: this scan matches on faction + enemy + end-time,
    // so it will happily return the entry cached under the reused war_<fid> key
    // -- computed under THAT war's weights. Serving it here is how settings got
    // silently ignored twice over.
    if (settingsSignature(r.settings) !== liveSig) continue;
    if (!best || (r.mode === mode && best.mode !== mode)) best = r;
  }
  if (best) return { ...best, warId: String(warKey), factionId: fid, settingsApplied: true };
  // 2) Archive record's own backfilled payout fields.
  if (warHistory.hasPayout(fid, warKey)) {
    const p = warHistory.getPayout(fid, warKey);
    const applied = settingsSignature(p && p.settings) === liveSig;
    // The live settings travel with it either way, so the gear panel shows what
    // was saved -- but it is told plainly whether the numbers beside them were
    // computed with those settings or predate them.
    return { ...p, settings: hasLive ? live : (p.settings || {}), settingsApplied: applied };
  }
  // 3) Fields-only reconstruction from the raw archive record.
  const rec = archiveRecordToResult(hw, mode, fid);
  return { ...rec, settings: hasLive ? live : (rec.settings || {}),
           settingsApplied: !hasLive };
}

/** Map a durable archive record into a computePayouts-shaped result literal. */
function archiveRecordToResult(hw, mode, fid) {
  const members = (hw.members || []).map(m => ({
    playerId: String(m.playerId),
    name: m.name,
    score: Number(m.score) || 0,
    sharePct: Number(m.sharePct) || 0,
    dollarPayout: Number(m.dollarPayout) || 0,
    attackCount: Number(m.warHits) || 0,
    totalAttacks: Number(m.totalAttacks) || 0,
    avgFf: Number(m.avgFf) || 0,
    maxFf: Number(m.maxFf) || 0,
    level: Number(m.level) || 0,
    breakdown: m.breakdown || {},
    tornScore: Number(m.tornScore) || 0,
    tornAttacks: Number(m.tornAttacks) || 0,
  }));
  return {
    warId: String(hw.warKey),
    factionId: String(fid),
    enemyFactionId: hw.enemyFactionId,
    enemyFactionName: hw.enemyFactionName || null,
    warResult: hw.warResult || null,
    warScores: hw.warScores || null,
    mode,
    scoreSource: 'archive',
    reportTotalScore: 0,
    fromTs: (hw.warStart ? Math.floor(Number(hw.warStart) / 1000) : 0),
    toTs: (hw.warEndedAt ? Math.floor(Number(hw.warEndedAt) / 1000) : 0),
    lootTotal: Number(hw.lootTotal) || 0,
    lootBreakdown: hw.lootBreakdown || null,
    lootSource: hw.lootSource || 'archive',
    lootAutoDetected: false,
    payoutPct: (hw.payoutPct != null ? Number(hw.payoutPct) : 0.8),
    payoutPool: Number(hw.payoutPool) || 0,
    factionShare: Number(hw.factionShare) || 0,
    settings: hw.settings || {},
    totalScore: members.reduce((s, m) => s + (m.score || 0), 0),
    members,
    attackCount: members.reduce((s, m) => s + (m.attackCount || 0), 0),
    generatedAt: Date.now(),
  };
}

/**
 * A comparable fingerprint of the knobs that change a payout number.
 *
 * Was built inline in two places with slightly different field lists, which is
 * how a cache entry computed under one set of weights could be served for
 * another. `updatedAt` is deliberately out: saving the same numbers again must
 * not bust a cache that is still correct.
 */
/**
 * A flat dollar amount per turtle, taken off the top of the payout pool.
 *
 * Turtling as a SCORE was awkward: the same weight is a war hit's worth in
 * Termed Mode and almost nothing in FF Mode, where a real hit scores its
 * respect. A dollar figure means the same thing in both.
 *
 * Off the top rather than on top -- the turtlers are paid first and everyone
 * else splits what is left. The pool stays what the faction decided to pay
 * out, and the faction share is untouched.
 *
 * Capped at the pool, and shared out in proportion when it would exceed it:
 * paying the first member in full and the next nothing would be arbitrary.
 */
export function turtleDollars(members, turtlePay, pool) {
  const rate = Number(turtlePay);
  const budget = Math.max(0, Number(pool) || 0);
  const byPlayer = {};
  if (!Number.isFinite(rate) || rate <= 0 || !budget) return { byPlayer, spent: 0, capped: false };

  const owed = [];
  let wanted = 0;
  for (const mem of members || []) {
    const n = Math.max(0, Number((mem.breakdown || {}).turtle) || 0);
    if (!n) continue;
    const due = n * rate;
    owed.push({ id: String(mem.playerId), due });
    wanted += due;
  }
  if (!wanted) return { byPlayer, spent: 0, capped: false };

  const capped = wanted > budget;
  // Floor each share so the rounding can only ever spend LESS than the pool.
  const scale = capped ? budget / wanted : 1;
  let spent = 0;
  for (const o of owed) {
    const pay = Math.floor(o.due * scale);
    if (pay <= 0) continue;
    byPlayer[o.id] = pay;
    spent += pay;
  }
  return { byPlayer, spent, capped };
}

export function settingsSignature(s) {
  const o = s || {};
  return `L${o.lootOverride ?? '_'}|A${o.assistWeight ?? '_'}|N${o.nonWarWeight ?? '_'}` +
         `|P${o.payoutPct ?? '_'}|F${o.failedWeight ?? '_'}|T${o.turtleWeight ?? '_'}` +
         `|$${o.turtlePay ?? '_'}`;
}

/**
 * Score shares and dollar payouts from a tally.
 *
 * Deliberately NOT a refactor of the live path's copy of this arithmetic: that
 * path pays real money and is covered by a frozen fixture, and rewriting it to
 * share code with a new feature is a risk the feature does not need. The two
 * are kept in step by the tests either side rather than by sharing a function.
 */
export function membersFromTally(byAttacker, payoutPool) {
  const base = Object.values(byAttacker || {}).map(m => ({
    playerId: String(m.playerId),
    name: m.name,
    fairScore: Number(m.fairScoreSum) || 0,
    attackCount: Number(m.attackCount) || 0,
    totalAttacks: Number(m.totalAttacks) || 0,
    breakdown: m.breakdown || {},
    avgFf: m.ffSamples > 0 ? (m.ffSum / m.ffSamples) : 0,
    maxFf: Number(m.ffMax) || 0,
  }));
  const totalScore = base.reduce((sum, m) => sum + m.fairScore, 0);
  const members = base.map(m => ({
    playerId: m.playerId,
    name: m.name,
    score: m.fairScore,
    sharePct: totalScore > 0 ? (m.fairScore / totalScore) * 100 : 0,
    dollarPayout: totalScore > 0 ? Math.round((m.fairScore / totalScore) * payoutPool) : 0,
    attackCount: m.attackCount,
    totalAttacks: m.totalAttacks,
    avgFf: m.avgFf,
    maxFf: m.maxFf,
    level: 0,
    breakdown: m.breakdown,
    tornScore: 0,
    tornAttacks: 0,
  })).sort((a, b) => b.score - a.score);
  return { members, totalScore };
}

/**
 * Recompute a finished war's payouts from its stored attack log.
 *
 * A war that has ended is not in the live store -- that is keyed
 * war_<factionId> and reused every war -- so the payout code serves it from the
 * archive, which carries member scores frozen at capture time. New weights
 * therefore could not change anything, and the gear panel showed the archived
 * settings rather than the ones just saved: "i cant save the payout weights, it
 * doesnt get saved". They saved; nothing read them.
 *
 * The raw attacks survive in the post-war cache, so this needs no API key and
 * no pool: it is a pure re-tally of rows already on disk.
 *
 * Returns null when there is nothing to recompute from. An empty board would
 * read as "nobody earned anything", which is a claim about the war rather than
 * about the data.
 */
export function recomputeArchivedResult({ hw, fid, mode, attacks, settings }) {
  if (!Array.isArray(attacks) || !attacks.length) return null;
  const s = settings || {};
  const byAttacker = tallyAttacks(attacks, {
    ourFid: String(fid),
    enemyFactionId: hw.enemyFactionId,
    mode,
    settings: s,
  });
  if (!Object.keys(byAttacker).length) return null;

  const lootTotal = Number.isFinite(s.lootOverride)
    ? Math.max(0, Number(s.lootOverride))
    : Number(hw.lootTotal) || 0;
  const pct = Number.isFinite(s.payoutPct)
    ? Math.min(1, Math.max(0, Number(s.payoutPct)))
    : (hw.payoutPct != null ? Number(hw.payoutPct) : 0.8);
  const poolFromPct = Math.round(lootTotal * pct);
  const payoutPool = poolFromPct;
  // Turtles first, off the top, then the rest is split -- same as the live path.
  const turtle = turtleDollars(Object.values(byAttacker), s.turtlePay, payoutPool);
  const splitPool = Math.max(0, payoutPool - turtle.spent);
  const { members, totalScore } = membersFromTally(byAttacker, splitPool);
  if (turtle.spent > 0) {
    for (const mem of members) mem.dollarPayout += (turtle.byPlayer[mem.playerId] || 0);
    members.sort((a, b) => b.dollarPayout - a.dollarPayout);
  }

  return {
    warId: String(hw.warKey),
    factionId: String(fid),
    enemyFactionId: hw.enemyFactionId,
    enemyFactionName: hw.enemyFactionName || null,
    warResult: hw.warResult || null,
    warScores: hw.warScores || null,
    mode,
    scoreSource: 'fair',
    reportTotalScore: 0,
    fromTs: (hw.warStart ? Math.floor(Number(hw.warStart) / 1000) : 0),
    toTs: (hw.warEndedAt ? Math.floor(Number(hw.warEndedAt) / 1000) : 0),
    lootTotal,
    lootBreakdown: hw.lootBreakdown || null,
    lootSource: Number.isFinite(s.lootOverride) ? 'override' : (hw.lootSource || 'archive'),
    lootAutoDetected: false,
    payoutPct: pct,
    payoutPool,
    factionShare: lootTotal - payoutPool,
    turtlePaid: turtle.spent,
    turtleCapped: turtle.capped,
    settings: s,
    // The panel needs to know the difference between "your weights are in these
    // numbers" and "these numbers predate your weights".
    settingsApplied: true,
    totalScore,
    members,
    attackCount: members.reduce((sum, m) => sum + (m.attackCount || 0), 0),
    generatedAt: Date.now(),
  };
}

/** List wars eligible for payouts (ended, has data) for a faction. */
export function listEligibleWars(factionId) {
  const fid = String(factionId);
  const out = [];
  const seen = new Set();
  const idKey = (eid, endedMs) => `${eid == null ? '' : eid}:${endedMs ? Math.floor(Number(endedMs) / 1000) : 0}`;
  // getAllWars() returns a Map — iterate via .entries() not for...in
  // (the latter only works for plain objects).
  const all = store.getAllWars();
  const entries = (all instanceof Map)
    ? Array.from(all.entries())
    : Object.entries(all || {});
  for (const [wid, w] of entries) {
    if (!w || String(w.factionId) !== fid) continue;
    if (!w.warEnded) continue; // only ended wars eligible
    out.push({
      warId: String(wid),
      enemyFactionName: w.enemyFactionName || `Faction ${w.enemyFactionId}`,
      warResult: w.warResult || "unknown",
      warEndedAt: w.warEndedAt || 0,
    });
    seen.add(idKey(w.enemyFactionId, w.warEndedAt));
  }
  // Merge ended wars the live store has dropped, sourced from the durable
  // archive. Deduped against the live list by enemy + end-second so the same
  // physical war isn't listed twice.
  try {
    for (const hw of warHistory.listWars(fid)) {
      const k = idKey(hw.enemyFactionId, hw.warEndedAt);
      if (seen.has(k)) continue;
      seen.add(k);
      out.push({
        warId: String(hw.warKey),
        enemyFactionName: hw.enemyFactionName || `Faction ${hw.enemyFactionId}`,
        warResult: hw.warResult || "unknown",
        warEndedAt: hw.warEndedAt || 0,
      });
    }
  } catch (e) { console.warn(`[war-payouts] archive merge failed for ${fid}: ${e.message}`); }
  // Most-recent first
  out.sort((a, b) => (b.warEndedAt || 0) - (a.warEndedAt || 0));
  return out;
}
