import { fetchFactionBasic } from "./torn-api.js";
import * as store from "./store.js";
import * as checkpointHistory from "./oc-checkpoint-history.js";
import { calculateLocalOutcome, slotsToRoles } from "./crimehub-model.js";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join as pathJoin } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const OC_HISTORY_DIR = pathJoin(process.env.DATA_DIR || pathJoin(__dirname, 'data'), 'oc-history');

// Read the disk OC history archive. This contains older completions that
// rolled out of the 90-day Torn API window but still matter for establishing
// how experienced a member is. Normalized to the same shape as API crimes so
// buildCprCache can treat both identically.
function loadAndNormalizeDiskHistory(factionId) {
  try {
    const file = pathJoin(OC_HISTORY_DIR, `${factionId}.json`);
    if (!existsSync(file)) return [];
    const raw = JSON.parse(readFileSync(file, 'utf-8'));
    if (!Array.isArray(raw)) return [];
    return raw.map(e => ({
      id: e.crimeId,
      name: e.crimeName,
      difficulty: e.difficulty || 0,
      slots: (e.slots || []).map(s => ({
        user_id: s.userId,
        position: s.position,
        checkpoint_pass_rate: s.weight,
      })),
    }));
  } catch (_) {
    return [];
  }
}

// Default lookback used when a faction has no oc_lookback_days override.
// Bumped from 90 → 120 (May 2026): per-faction setting now reads through
// (was previously ignored — see getLookbackDays below). 120 days gives the
// CPR Forecaster's trend detection a fuller window without burning much
// extra API budget; per-faction admins can still tune via OC Settings.
const DEFAULT_CPR_LOOKBACK_DAYS = 120;
const MIN_CPR_LOOKBACK_DAYS = 7;
const MAX_CPR_LOOKBACK_DAYS = 365;
function getLookbackDays(factionId) {
  const s = store.getFactionSettings(factionId) || {};
  const raw = Number(s.oc_lookback_days ?? s.lookback_days);
  if (!Number.isFinite(raw) || raw <= 0) return DEFAULT_CPR_LOOKBACK_DAYS;
  return Math.max(MIN_CPR_LOOKBACK_DAYS, Math.min(MAX_CPR_LOOKBACK_DAYS, Math.round(raw)));
}
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours — backstop only

const factionOcsCache    = new Map(); // factionId -> { timestamp, cprCache, completedCrimes }
// Per-faction snapshot of the previous poll's availableCrimes IDs. When a
// slot ID disappears between consecutive calls to getOcSpawnData() we
// know an OC just completed and force-invalidate completedCrimes so the
// notifier sees it within one 60s poll cycle (instead of waiting up to
// CACHE_TTL_MS = 6h for the natural expiry).
const lastAvailableIds   = new Map(); // factionId -> Set<crimeId>
// Short-TTL caches for high-frequency endpoints. These were being called on
// every spawn-key request (one per user refresh), burning through Torn's
// 100-req/min rate limit. 30s TTL is short enough that recruitment / member
// state still feels live, long enough that 10 users hitting the panel
// simultaneously share a single API call.
const AVAILABLE_TTL_MS   = 30 * 1000;
const BASIC_TTL_MS       = 30 * 1000;
const availableCache     = new Map(); // factionId -> { ts, crimes }
const basicCache         = new Map(); // factionId -> { ts, data }

// Helper to fetch from Torn API directly if not in torn-api.js.
// v3.1.45: paginates backwards using the `to` keyset so we fetch the
// *entire* 90-day completed-crimes window instead of just the most
// recent 100 crimes. Torn v2 caps each response at 100 entries; this
// walks back using the oldest executed_at of each batch until empty
// or past the lookback cutoff.
async function fetchCompletedCrimes(factionId, apiKey) {
  const lookbackDays = getLookbackDays(factionId);
  const fromTs = Math.floor(Date.now() / 1000) - (lookbackDays * 86400);
  const seen = new Set();
  const all = [];
  let toTs = null;
  const MAX_PAGES = 20;             // safety: 2000 crimes max
  for (let page = 0; page < MAX_PAGES; page++) {
    const params = new URLSearchParams({
      cat: 'completed',
      sort: 'DESC',
      from: String(fromTs),
      key: apiKey,
      comment: 'wb-oc',
    });
    if (toTs) params.set('to', String(toTs));
    const url = `https://api.torn.com/v2/faction/crimes?${params}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Torn API HTTP ${res.status}`);
    const data = await res.json();
    if (data.error) throw new Error(data.error.error);
    const batch = Array.isArray(data.crimes) ? data.crimes : Object.values(data.crimes || {});
    if (batch.length === 0) break;
    let addedThisBatch = 0;
    let oldest = Infinity;
    for (const c of batch) {
      const id = String(c.id);
      if (seen.has(id)) continue;
      seen.add(id);
      all.push(c);
      addedThisBatch++;
      const ts = Number(c.executed_at || 0);
      if (ts > 0 && ts < oldest) oldest = ts;
    }
    if (addedThisBatch === 0) break;  // nothing new (server ignoring our `to`)
    if (!Number.isFinite(oldest) || oldest <= fromTs) break; // reached cutoff
    // Walk backwards — use oldest-1 as the next upper bound.
    toTs = oldest - 1;
  }
  return all;
}

async function fetchAvailableCrimes(factionId, apiKey) {
  const now = Date.now();
  const cached = availableCache.get(String(factionId));
  if (cached && (now - cached.ts) < AVAILABLE_TTL_MS) return cached.crimes;

  const url = `https://api.torn.com/v2/faction/crimes?cat=available&key=${encodeURIComponent(apiKey)}&comment=wb-oc`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Torn API HTTP ${res.status}`);
  const data = await res.json();
  if (data.error) throw new Error(data.error.error);

  const crimes = Array.isArray(data.crimes) ? data.crimes : Object.values(data.crimes || {});
  availableCache.set(String(factionId), { ts: now, crimes });
  return crimes;
}

// Minimum # of completed crimes at topLevel before we'll project a member
// up to topLevel+1 (joinable boost). Without this, a single lucky completion
// pushes a member into the next tier on the optimizer's recommendations,
// which for new/returning members almost always fails.
const MIN_SAMPLES_FOR_BOOST = 3;

// Extract current placements from non-completed crimes. A member sitting
// on a level-4 Planning/Executing crime right now is demonstrably at least
// level-4-capable — someone placed them there. We use this as evidence that
// boosts their `highestLevel` floor even if their completed-crime history
// is thin (brand-new members especially).
function extractCurrentPlacements(crimes) {
  const placements = {};
  for (const crime of crimes) {
    // Recruiting: slot-filler may not have been accepted yet. Skip.
    if (crime.status === 'Recruiting') continue;
    const diff = crime.difficulty || 0;
    if (!Array.isArray(crime.slots)) continue;
    for (const slot of crime.slots) {
      const uid = slot.user_id ?? slot.user?.id;
      if (!uid) continue;
      if ((placements[uid] || 0) < diff) placements[uid] = diff;
    }
  }
  return placements;
}

function buildCprCache(completedCrimes, currentPlacements = {}) {
  const highestLevel = {};
  for (const crime of completedCrimes) {
    const diff = crime.difficulty || 0;
    if (!Array.isArray(crime.slots)) continue;
    for (const slot of crime.slots) {
      const uid = slot.user_id ?? slot.user?.id;
      if (!uid) continue;
      if ((highestLevel[uid] || 0) < diff) highestLevel[uid] = diff;
    }
  }

  // Merge in-progress placements. This helps new members who are currently
  // sitting on a higher-difficulty OC but have no completions to show for it.
  for (const [uid, diff] of Object.entries(currentPlacements)) {
    if ((highestLevel[uid] || 0) < diff) highestLevel[uid] = diff;
  }

  const cache = {};
  for (const crime of completedCrimes) {
    const diff = crime.difficulty || 0;
    if (!Array.isArray(crime.slots)) continue;

    for (const slot of crime.slots) {
      const uid = slot.user_id ?? slot.user?.id;
      if (!uid) continue;
      const topLevel = highestLevel[uid] || 0;
      if (diff < topLevel - 1) continue;

      const rawRate = slot.checkpoint_pass_rate ?? slot.success_chance ?? null;
      if (rawRate === null) continue;

      if (!cache[uid]) cache[uid] = { rateSum: 0, count: 0, entries: [], topLevelCount: 0 };
      cache[uid].rateSum += rawRate;
      cache[uid].count += 1;
      cache[uid].entries.push({ diff, rate: rawRate });
      if (diff === topLevel) cache[uid].topLevelCount += 1;
    }
  }

  const result = {};
  const MINCPR = 60;
  const CPR_BOOST = 15;
  for (const [uid, d] of Object.entries(cache)) {
    const cpr = d.count > 0 ? d.rateSum / d.count : 0;
    const topLevel = highestLevel[uid] || 0;
    // Only allow joinable+1 projection if we have enough samples AT the
    // current top level. One lucky completion isn't enough evidence.
    const eligibleForBoost =
        cpr >= MINCPR + CPR_BOOST
        && d.topLevelCount >= MIN_SAMPLES_FOR_BOOST;
    const joinable = eligibleForBoost ? Math.min(topLevel + 1, 10) : topLevel;
    result[uid] = {
      cpr: Math.round(cpr * 10) / 10,
      samples: d.count,
      topLevelSamples: d.topLevelCount,
      highestLevel: topLevel,
      joinable,
      entries: d.entries,
      currentPlacement: currentPlacements[uid] || 0,
    };
  }

  // Members currently placed in a crime but with NO completed history.
  // Their placement is evidence of capability at that difficulty.
  for (const [uid, diff] of Object.entries(currentPlacements)) {
    if (result[uid]) continue;
    result[uid] = {
      cpr: 0, samples: 0, topLevelSamples: 0,
      highestLevel: diff,
      joinable: diff,
      entries: [],
      currentPlacement: diff,
    };
  }

  return result;
}

/**
 * Return raw completed crimes from the cache for a given faction.
 * Used by routes.js engines (slot optimizer, failure risk, etc.) for OC history.
 * Returns [] if no cached data yet (caller should handle gracefully).
 */
// ── OC Outcome Distribution (private admin build) ────────────────────────
// Proxies tornprobability.com's CalculateSuccess endpoint for a given
// scenario + CPR-per-slot array and returns the full outcome distribution
// (success/failure plus per-ending probabilities).
//
// Deliberately admin-only in routes.js — surfacing expected-reward
// probabilities to every faction member creates adverse selection
// (members cluster into high-EV OCs, low-tier slates starve). This helper
// is plumbing only; no public endpoint exposes it without role check.
//
// Cached per (scenario, rounded-CPR-tuple). CPRs rounded to whole numbers
// so near-identical slates share a cache entry.
const _outcomeCache = new Map();
const OUTCOME_TTL_MS = 15 * 60 * 1000;

// Merge the local Crimehub flowchart prediction into the tornprobability
// result so the userscript shows both side by side. `data` is the raw
// upstream object; the local value is recomputed per call (cheap, pure).
export function _withLocalOutcome(data, scenario, rounded) {
  const local = calculateLocalOutcome(scenario, slotsToRoles(scenario, rounded));
  const lsc = local && !local.missing ? local.successChance : null;
  const base = data && typeof data.successChance === "number" ? data.successChance : null;
  return {
    ...data,
    localSuccessChance: lsc,
    localAvgReward: local && !local.missing ? local.avgReward : null,
    delta: lsc != null && base != null ? lsc - base : null,
  };
}

export async function calculateOutcome(scenario, cprs) {
  if (!scenario || !Array.isArray(cprs) || cprs.length === 0) {
    return { error: "missing scenario or cprs" };
  }
  const rounded = cprs.map((v) => {
    const n = Number(v);
    if (!Number.isFinite(n)) return 0;
    return Math.max(0, Math.min(100, Math.round(n)));
  });
  const key = scenario + "|" + rounded.join(",");
  const cached = _outcomeCache.get(key);
  if (cached && (Date.now() - cached.ts) < OUTCOME_TTL_MS) return _withLocalOutcome(cached.data, scenario, rounded);
  try {
    const res = await fetch("https://tornprobability.com:3000/api/CalculateSuccess", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scenario, parameters: rounded }),
    });
    if (!res.ok) return { error: "upstream " + res.status };
    const data = await res.json();
    _outcomeCache.set(key, { data, ts: Date.now() });
    return _withLocalOutcome(data, scenario, rounded);
  } catch (e) {
    return { error: String(e?.message || e) };
  }
}

export function getCachedCompletedCrimes(factionId) {
  const cached = factionOcsCache.get(factionId);
  if (cached && cached.completedCrimes) return cached.completedCrimes;
  return [];
}

// ── Role weights from tornprobability.com ────────────────────────────────
// v3.2.12: previously the failure-risk + slot-optimizer engines looked up
// data.weights but nothing ever populated it — every slot got weight=0.
// tornprobability.com exposes per-crime role weights via the same endpoint
// that 'Torn OC Weights Under Roles' (greasyfork 547973) uses. Fetch +
// cache once every 12h; weights change only when Torn re-balances OCs.
//
// Returned shape: { [normalizedCrimeName]: { [normalizedRoleName]: pct } }
// Names normalized to lowercase + alphanumeric so callers can do fuzzy
// lookups without rebuilding the map.
const ROLE_WEIGHTS_TTL_MS = 12 * 60 * 60 * 1000;
let _roleWeightsCache = null;
let _roleWeightsCachedAt = 0;
let _roleWeightsInflight = null;
function _normalizeOcName(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}
export async function getRoleWeights() {
  // Serve from cache if fresh
  if (_roleWeightsCache && (Date.now() - _roleWeightsCachedAt) < ROLE_WEIGHTS_TTL_MS) {
    return _roleWeightsCache;
  }
  // Coalesce concurrent calls — engines run in batches and we don't
  // want to fetch in parallel.
  if (_roleWeightsInflight) return _roleWeightsInflight;
  _roleWeightsInflight = (async () => {
    try {
      const res = await fetch('https://tornprobability.com:3000/api/GetRoleWeights');
      if (!res.ok) throw new Error('upstream HTTP ' + res.status);
      const raw = await res.json();
      const out = {};
      for (const [crimeName, roles] of Object.entries(raw || {})) {
        const cKey = _normalizeOcName(crimeName);
        if (!cKey) continue;
        out[cKey] = {};
        for (const [roleName, pct] of Object.entries(roles || {})) {
          const rKey = _normalizeOcName(roleName);
          if (!rKey) continue;
          out[cKey][rKey] = Number(pct) || 0;
        }
      }
      _roleWeightsCache = out;
      _roleWeightsCachedAt = Date.now();
      console.log(`[oc-spawn] Fetched role weights for ${Object.keys(out).length} crime(s) from tornprobability.com`);
      return out;
    } catch (e) {
      console.warn(`[oc-spawn] getRoleWeights failed: ${e.message}`);
      return _roleWeightsCache || {}; // serve stale on failure
    } finally {
      _roleWeightsInflight = null;
    }
  })();
  return _roleWeightsInflight;
}
export { _normalizeOcName as normalizeOcName };

// Add synthetic cprCache entries for members with no completed-crime history
// AND no current OC placement. Uses level-bucketed priors from established
// members in the faction so a level-41 new member inherits the typical
// joinable level of other 40-59 members, not joinable=1.
function augmentWithSyntheticProfiles(cprCache, members) {
  const levelByUid = {};
  for (const m of members) levelByUid[String(m.id || m.playerId || m.uid)] = m.level || 0;

  const bucketKey = (lvl) => {
    if (!lvl) return 'unknown';
    if (lvl < 20)  return '1-19';
    if (lvl < 40)  return '20-39';
    if (lvl < 60)  return '40-59';
    if (lvl < 80)  return '60-79';
    if (lvl < 100) return '80-99';
    return '100+';
  };

  // Build level-bucket priors from established members (3+ samples)
  const buckets = {};
  for (const [uid, c] of Object.entries(cprCache)) {
    if ((c.samples || 0) < 3) continue;
    const b = bucketKey(levelByUid[uid]);
    if (!buckets[b]) buckets[b] = { cprSum: 0, cprCount: 0, joinables: [] };
    buckets[b].cprSum += c.cpr || 0;
    buckets[b].cprCount += 1;
    if (typeof c.joinable === 'number') buckets[b].joinables.push(c.joinable);
  }
  function priorCprFor(lvl) {
    const b = buckets[bucketKey(lvl)];
    return (!b || b.cprCount < 2) ? 50 : Math.round((b.cprSum / b.cprCount) * 10) / 10;
  }
  function priorJoinableFor(lvl) {
    const b = buckets[bucketKey(lvl)];
    if (!b || b.joinables.length < 2) return 1;
    const sorted = b.joinables.slice().sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0
      ? Math.round((sorted[mid - 1] + sorted[mid]) / 2)
      : sorted[mid];
  }

  // Fill in synthetic profiles for everyone missing from cache
  for (const m of members) {
    const uid = String(m.id || m.playerId || m.uid);
    if (cprCache[uid]) continue;   // real history, skip
    const pc = priorCprFor(m.level);
    const pj = priorJoinableFor(m.level);
    cprCache[uid] = {
      cpr: pc,
      samples: 0, topLevelSamples: 0,
      highestLevel: pj,
      joinable: pj,
      entries: [],
      currentPlacement: 0,
      synthetic: true,               // lets the client distinguish projected vs real
    };
  }
  return cprCache;
}

export async function getOcSpawnData(factionId, apiKey) {
  // Fetch available first so we can extract current placements and feed
  // them into the cache build. Completed-crimes cache is long-lived (6h TTL),
  // but placements are re-derived every call — they change minute to minute.
  const availableCrimes = await fetchAvailableCrimes(factionId, apiKey);
  const currentPlacements = extractCurrentPlacements(availableCrimes);

  // Detect just-completed OCs: any slot ID that was in the previous poll's
  // availableCrimes but isn't anymore must have transitioned to completed.
  // When that happens, force the completedCrimes cache to refetch so the
  // notifier (which runs right after this returns) sees the new entry on
  // its very next dedup pass — sub-60s latency instead of up to CACHE_TTL_MS.
  // First poll after restart: lastAvailableIds is empty, so no IDs are
  // "missing" and we don't trigger a spurious refetch.
  const fid = String(factionId);
  const currentAvailIds = new Set();
  for (const c of (availableCrimes || [])) {
    if (c?.id != null) currentAvailIds.add(String(c.id));
  }
  const prevAvailIds = lastAvailableIds.get(fid);
  let availDelta = false;
  if (prevAvailIds && prevAvailIds.size > 0) {
    for (const id of prevAvailIds) {
      if (!currentAvailIds.has(id)) { availDelta = true; break; }
    }
  }
  lastAvailableIds.set(fid, currentAvailIds);
  if (availDelta) {
    factionOcsCache.delete(factionId);   // force refetch below
    console.log(`[oc-spawn] faction ${fid}: availableCrimes shrunk → invalidating completedCrimes cache`);
  }

  // Load disk history every call (fast, small file, may have been updated
  // by routes.js's persist path in the last few minutes). API crimes are
  // cached for 6h separately.
  const diskHistory = loadAndNormalizeDiskHistory(factionId);

  let cprCache = null;
  const cached = factionOcsCache.get(factionId);
  const cacheFresh = cached && (Date.now() - cached.timestamp < CACHE_TTL_MS);
  let completedCrimes;
  if (cacheFresh) {
    completedCrimes = cached.completedCrimes;
  } else {
    completedCrimes = await fetchCompletedCrimes(factionId, apiKey);
    factionOcsCache.set(factionId, { timestamp: Date.now(), completedCrimes });
  }

  // Merge API completions (last 90 days, high fidelity) with disk history
  // (older archive). Dedupe by crimeId — API wins when overlap exists since
  // it has the checkpoint_pass_rate directly.
  const seen = new Set();
  const mergedCrimes = [];
  for (const c of completedCrimes) {
    const cid = String(c.id);
    if (seen.has(cid)) continue;
    seen.add(cid);
    mergedCrimes.push(c);
  }
  for (const c of diskHistory) {
    const cid = String(c.id);
    if (seen.has(cid)) continue;
    seen.add(cid);
    mergedCrimes.push(c);
  }
  cprCache = buildCprCache(mergedCrimes, currentPlacements);

  // Per-checkpoint attribution: parsed by the userscript fetch
  // interceptor from page-level completed-crime responses (only
  // place per-checkpoint outcomes are exposed — public API only
  // returns aggregate checkpoint_pass_rate). Merge into each
  // member's cprCache entry so engines can render checkpoint
  // heatmaps without a second round-trip. Cold-start gap: nothing
  // here until at least one admin opens the Completed tab and the
  // userscript uploads the parsed scenario.
  try {
    const byCheckpoint = checkpointHistory.aggregateByMember(factionId);
    for (const uid in byCheckpoint) {
      if (!cprCache[uid]) continue; // member has no CPR data — skip
      cprCache[uid].byCheckpoint = byCheckpoint[uid];
    }
  } catch (e) {
    console.warn(`[oc-spawn] byCheckpoint merge failed for ${factionId}: ${e.message}`);
  }

  // Short-lived cache for faction basic data (member list + status) —
  // avoids calling this endpoint once per spawn-key request per user.
  const now = Date.now();
  let basicData;
  const basicCached = basicCache.get(String(factionId));
  if (basicCached && (now - basicCached.ts) < BASIC_TTL_MS) {
    basicData = basicCached.data;
  } else {
    basicData = await fetchFactionBasic(factionId, apiKey);
    basicCache.set(String(factionId), { ts: now, data: basicData });
  }
  const members = Object.entries(basicData.members || {}).map(([id, m]) => ({ id, ...m }));

  // Now that we have both cprCache + members, backfill synthetic entries for
  // members missing from the cache (no history AND not currently placed).
  augmentWithSyntheticProfiles(cprCache, members);

  return { members, availableCrimes, cprCache };
}