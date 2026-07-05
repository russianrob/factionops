// Durable per-faction war history. Companion to the volatile `wars` Map in
// store.js, which reuses a stable war_<factionId> key for the live war and
// only archives the most recent ended war — so the deeper history is lost.
// This store APPENDS a frozen per-member activity snapshot of every ended
// war so the full history survives. Mirrors oc-checkpoint-history.js.
//
// Disk layout: data/war-history/<factionId>.json
// {
//   "wars": {
//     "<warKey>": {
//       warKey, warId, realWarId,
//       enemyFactionId, enemyFactionName,
//       warStart, warEndedAt, warResult,        // warStart/warEndedAt = ms epoch
//       warScores: { myScore, enemyScore } | null,
//       capturedAt,
//       members: [ { playerId, name, level, warHits, totalAttacks, breakdown } ]
//     }
//   }
// }
//
// Ingest is idempotent: keyed by the real Torn ranked-war ID (synthetic
// fallback), so re-ingesting the same war (e.g. a payout recompute) UPSERTS
// the snapshot rather than duplicating. The member snapshot is frozen at
// capture, so it survives even after Torn's attack log ages out.

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { dirname, join as pathJoin } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.DATA_DIR || pathJoin(__dirname, "data");
const DIR = pathJoin(DATA_DIR, "war-history");
const PAYOUT_CACHE_FILE = pathJoin(DATA_DIR, "war-payouts-cache.json");

if (!existsSync(DIR)) mkdirSync(DIR, { recursive: true });

const fileFor = (factionId) => pathJoin(DIR, `${String(factionId)}.json`);

/** @type {Map<string, { wars: Record<string, any>, dirty: boolean, _saveTimer: any }>} */
const _state = new Map();

function _load(factionId) {
  const fid = String(factionId);
  if (_state.has(fid)) return _state.get(fid);
  let wars = {};
  try {
    const parsed = JSON.parse(readFileSync(fileFor(fid), "utf8"));
    if (parsed && typeof parsed === "object" && parsed.wars && typeof parsed.wars === "object") {
      wars = parsed.wars;
    }
  } catch { /* fresh */ }
  const entry = { wars, dirty: false, _saveTimer: null };
  _state.set(fid, entry);
  return entry;
}

function _scheduleSave(entry, factionId) {
  if (entry._saveTimer) return;
  entry._saveTimer = setTimeout(() => {
    entry._saveTimer = null;
    try {
      writeFileSync(fileFor(factionId), JSON.stringify({ wars: entry.wars }));
      entry.dirty = false;
    } catch (e) {
      console.error(`[war-history] save failed for ${factionId}: ${e.message}`);
    }
  }, 5_000);
}

// Durable key for a war: prefer the real Torn ranked-war ID, else a numeric
// internal warId, else a synthetic participants+end key (matches the archival
// scheme in store.js's pickArchiveKey). Never the volatile war_<factionId>.
function _warKey(war, result) {
  const realId = (war && war.realWarId) || (result && result.realWarId);
  if (realId) return String(realId);
  const wid = (result && result.warId) || (war && war.warId);
  if (wid && /^\d+$/.test(String(wid))) return String(wid);
  const fid = (result && result.factionId) || (war && war.factionId);
  const eid = (result && result.enemyFactionId != null) ? result.enemyFactionId
    : (war && war.enemyFactionId != null) ? war.enemyFactionId : null;
  const endedMs = (war && war.warEndedAt) || (result && result.toTs ? result.toTs * 1000 : 0);
  // Floor to whole seconds so the ms-precise live record (war.warEndedAt) and
  // the second-precise cache value (result.toTs) yield the SAME synthetic key.
  if (fid && eid != null && endedMs) return `archived_${fid}_${eid}_${Math.floor(endedMs / 1000)}`;
  return wid ? String(wid) : null;
}

/**
 * Snapshot one ended war's per-member activity into durable history.
 * `war` is the store war record (may be null on backfill); `result` is a
 * computePayouts() output. Idempotent upsert keyed by real war ID.
 * Returns the warKey on success, null if it couldn't be keyed.
 */
export function ingestWar(factionId, war, result) {
  if (!factionId || !result || !Array.isArray(result.members)) return null;
  const fid = String(factionId);
  const warKey = _warKey(war, result);
  if (!warKey) return null;
  const endedMs = Number(war && war.warEndedAt) || (result.toTs ? result.toTs * 1000 : 0) || null;
  // warStart and warEndedAt are stored as ms-epoch. The store record and
  // result.fromTs carry the start in SECONDS, so scale to ms for a unit that
  // matches warEndedAt.
  const startSec = Number(war && war.warStart) || Number(result.fromTs) || 0;
  const eid = result.enemyFactionId ?? (war && war.enemyFactionId) ?? null;
  const entry = _load(fid);
  // Once we learn a war's real ID, supersede any earlier synthetic-keyed row
  // for the same war (the snapshot taken before the realWarId was captured).
  if (/^\d+$/.test(warKey) && eid != null && endedMs) {
    const synthKey = `archived_${fid}_${eid}_${Math.floor(endedMs / 1000)}`;
    if (synthKey !== warKey && entry.wars[synthKey]) delete entry.wars[synthKey];
  }
  // Per-member xanax-taken (playerId -> count) from the live war object;
  // empty on backfill / wars polled before xanax tracking existed.
  const xanaxTakenMap = (war && war.xanaxStats && war.xanaxStats.taken) || {};
  entry.wars[warKey] = {
    warKey,
    warId: String((result.warId != null ? result.warId : (war && war.warId)) ?? warKey),
    realWarId: (war && war.realWarId != null) ? String(war.realWarId)
      : (result.realWarId != null ? String(result.realWarId) : null),
    enemyFactionId: eid,
    enemyFactionName: result.enemyFactionName || (war && war.enemyFactionName) || null,
    warStart: startSec ? startSec * 1000 : null,
    warEndedAt: endedMs,
    warResult: result.warResult || (war && war.warResult) || null,
    warScores: (war && war.warScores) || result.warScores || null,
    lootTotal: (result.lootTotal != null ? Number(result.lootTotal) : null),
    lootBreakdown: result.lootBreakdown || null,
    lootSource: result.lootSource || null,
    payoutPct: (Number.isFinite(result.payoutPct) ? Number(result.payoutPct) : null),
    payoutPool: (result.payoutPool != null ? Number(result.payoutPool) : null),
    factionShare: (result.factionShare != null ? Number(result.factionShare) : null),
    totalScore: (result.totalScore != null ? Number(result.totalScore) : null),
    settings: result.settings || null,
    payoutMode: result.mode || null,
    payoutComputedAt: Number(result.generatedAt) || Date.now(),
    capturedAt: Date.now(),
    // Full frozen xanax-taken map (playerId -> count) + names, so takers who
    // made ZERO attacks — absent from result.members but the worst misuse
    // cases — are still recorded. null when the war had no xanax tracking.
    xanaxStats: (war && war.xanaxStats && war.xanaxStats.taken)
      ? {
          taken: { ...war.xanaxStats.taken },
          names: { ...(war.xanaxStats.names || {}) },
          lastPolledAt: Number(war.xanaxStats.lastPolledAt) || null,
        }
      : null,
    members: result.members.map(m => {
      const totalAttacks = Number(m.totalAttacks) || 0;
      // Xanax accountability, frozen at capture. 1 xanax = 250e = 10 expected
      // attacks; deficit = expected - all attacks made (war + non-war). Zeroed
      // when the war carried no xanax tracking (backfill / pre-tracking wars).
      const xanaxTaken = Number(xanaxTakenMap[String(m.playerId)]) || 0;
      const xanaxDeficit = Math.max(0, xanaxTaken * 10 - totalAttacks);
      const xanaxFlagged = xanaxTaken > 0 && xanaxDeficit > 0;
      return {
        playerId: String(m.playerId),
        name: String(m.name || `Player ${m.playerId}`),
        level: Number(m.level) || null,
        warHits: Number(m.attackCount) || 0,
        totalAttacks,
        score: (m.score != null ? Number(m.score) : null),
        sharePct: (m.sharePct != null ? Number(m.sharePct) : null),
        dollarPayout: (m.dollarPayout != null ? Number(m.dollarPayout) : null),
        avgFf: (m.avgFf != null ? Number(m.avgFf) : null),
        maxFf: (m.maxFf != null ? Number(m.maxFf) : null),
        tornScore: (m.tornScore != null ? Number(m.tornScore) : null),
        tornAttacks: (m.tornAttacks != null ? Number(m.tornAttacks) : null),
        breakdown: (m.breakdown && typeof m.breakdown === "object") ? m.breakdown : {},
        xanaxTaken,
        xanaxDeficit,
        xanaxFlagged,
      };
    }),
  };
  entry.dirty = true;
  _scheduleSave(entry, fid);
  return warKey;
}

/** True if this war already has a history entry (by derived key). */
export function hasWar(factionId, war, result) {
  const key = _warKey(war, result);
  if (!key) return false;
  return !!_load(factionId).wars[key];
}

/** List wars for a faction (meta only, no member arrays), most-recent first. */
export function listWars(factionId) {
  const entry = _load(factionId);
  return Object.values(entry.wars)
    .map(w => ({
      warKey: w.warKey,
      realWarId: w.realWarId,
      enemyFactionId: w.enemyFactionId,
      enemyFactionName: w.enemyFactionName,
      warStart: w.warStart,
      warEndedAt: w.warEndedAt,
      warResult: w.warResult,
      warScores: w.warScores,
      memberCount: Array.isArray(w.members) ? w.members.length : 0,
      lootTotal: (w.lootTotal ?? null), payoutPool: (w.payoutPool ?? null),
      payoutPct: (w.payoutPct ?? null), factionShare: (w.factionShare ?? null),
    }))
    .sort((a, b) => (b.warEndedAt || 0) - (a.warEndedAt || 0));
}

/** Full record (incl. per-member activity) for one war. */
export function getWar(factionId, warKey) {
  return _load(factionId).wars[String(warKey)] || null;
}

/** True if this war's archive record carries computed payout fields. */
export function hasPayout(factionId, warKey) {
  const w = _load(factionId).wars[String(warKey)];
  return !!(w && w.payoutPool != null && Array.isArray(w.members));
}

/** Reconstruct a computePayouts-shaped result from the archive record. */
export function getPayout(factionId, warKey) {
  const w = _load(factionId).wars[String(warKey)];
  if (!w || w.payoutPool == null) return null;
  return {
    warId: String(warKey), factionId: String(factionId),
    enemyFactionId: w.enemyFactionId, enemyFactionName: w.enemyFactionName || null,
    warResult: w.warResult || null, warScores: w.warScores || null,
    mode: w.payoutMode || 'dynamic', scoreSource: 'archive',
    fromTs: (w.warStart ? Math.floor(w.warStart / 1000) : 0),
    toTs: (w.warEndedAt ? Math.floor(w.warEndedAt / 1000) : 0),
    lootTotal: Number(w.lootTotal) || 0, lootBreakdown: w.lootBreakdown || null,
    lootSource: w.lootSource || 'archive', lootAutoDetected: false,
    payoutPct: (w.payoutPct != null ? Number(w.payoutPct) : 0.8),
    payoutPool: Number(w.payoutPool) || 0, factionShare: Number(w.factionShare) || 0,
    settings: w.settings || {}, totalScore: Number(w.totalScore) || 0,
    members: (w.members || []).map(m => ({
      playerId: String(m.playerId), name: m.name, level: m.level ?? null,
      score: Number(m.score) || 0, sharePct: Number(m.sharePct) || 0,
      dollarPayout: Number(m.dollarPayout) || 0, attackCount: Number(m.warHits) || 0,
      totalAttacks: Number(m.totalAttacks) || 0, avgFf: Number(m.avgFf) || 0,
      maxFf: Number(m.maxFf) || 0, tornScore: Number(m.tornScore) || 0,
      tornAttacks: Number(m.tornAttacks) || 0, breakdown: m.breakdown || {},
    })),
    generatedAt: w.payoutComputedAt || w.capturedAt || Date.now(), fromArchive: true,
  };
}

/**
 * Per-member activity aggregated across ALL stored wars, sorted by war hits
 * desc: [{ playerId, name, level, wars, warHits, totalAttacks, breakdown }].
 */
export function aggregateByMember(factionId) {
  const entry = _load(factionId);
  const byId = {};
  for (const wk in entry.wars) {
    const w = entry.wars[wk];
    if (!w || !Array.isArray(w.members)) continue;
    for (const m of w.members) {
      const pid = String(m.playerId);
      if (!byId[pid]) {
        byId[pid] = { playerId: pid, name: m.name, level: m.level || null, wars: 0, warHits: 0, totalAttacks: 0, xanaxTaken: 0, xanaxWarsFlagged: 0, breakdown: {} };
      }
      const agg = byId[pid];
      if (m.name) agg.name = m.name;          // freshest name wins
      if (m.level) agg.level = m.level;
      agg.wars += 1;
      agg.warHits += Number(m.warHits) || 0;
      agg.totalAttacks += Number(m.totalAttacks) || 0;
      agg.xanaxTaken += Number(m.xanaxTaken) || 0;
      if (m.xanaxFlagged) agg.xanaxWarsFlagged += 1;
      const bd = m.breakdown || {};
      for (const k in bd) agg.breakdown[k] = (agg.breakdown[k] || 0) + (Number(bd[k]) || 0);
    }
  }
  return Object.values(byId).sort((a, b) => b.warHits - a.warHits);
}

/** Count of wars stored for a faction. */
export function warCount(factionId) {
  return Object.keys(_load(factionId).wars).length;
}

/**
 * Backfill xanax accountability onto an ALREADY-STORED war, using a taken-map
 * re-fetched from armoury news (playerId -> net count). Patches per-member
 * {xanaxTaken, xanaxDeficit, xanaxFlagged} against the stored totalAttacks and
 * sets the war-level xanaxStats map (so no-show takers absent from the member
 * list are retained). Returns { warKey, patched } or null if the war is absent.
 */
export function backfillXanaxForWar(factionId, warKey, takenMap, names, meta = {}) {
  const fid = String(factionId);
  const w = _load(fid).wars[String(warKey)];
  if (!w || !Array.isArray(w.members)) return null;
  const taken = takenMap || {};
  w.xanaxStats = {
    taken: { ...taken },
    names: { ...(names || {}) },
    lastPolledAt: Number(meta.lastPolledAt) || null,
    backfilledFrom: Number(meta.from) || null,
    backfilledTo: Number(meta.to) || null,
  };
  for (const m of w.members) {
    const totalAttacks = Number(m.totalAttacks) || 0;
    const xanaxTaken = Number(taken[String(m.playerId)]) || 0;
    m.xanaxTaken = xanaxTaken;
    m.xanaxDeficit = Math.max(0, xanaxTaken * 10 - totalAttacks);
    m.xanaxFlagged = xanaxTaken > 0 && m.xanaxDeficit > 0;
  }
  const entry = _load(fid);
  entry.dirty = true;
  _scheduleSave(entry, fid);
  return { warKey: String(warKey), patched: w.members.length };
}

/** Set the ranked-war score on an existing entry (score-backfill). */
export function setScores(factionId, warKey, warScores) {
  const entry = _load(factionId);
  const w = entry.wars[String(warKey)];
  if (!w) return false;
  w.warScores = (warScores && typeof warScores === "object") ? warScores : null;
  entry.dirty = true;
  _scheduleSave(entry, factionId);
  return true;
}

/** All faction IDs with stored history (disk files ∪ in-memory state). */
export function factionIds() {
  const ids = new Set([..._state.keys()].map(String));
  try {
    for (const f of readdirSync(DIR)) if (f.endsWith(".json")) ids.add(f.replace(/\.json$/, ""));
  } catch { /* dir missing */ }
  return [...ids];
}

/**
 * Wars that have no ranked-war score yet AND a numeric report ID we can look
 * up on Torn. Returns [{ warKey, reportId }] for the score-backfill.
 */
export function warsMissingScores(factionId) {
  const entry = _load(factionId);
  const out = [];
  for (const wk in entry.wars) {
    const w = entry.wars[wk];
    if (!w) continue;
    const hasScore = w.warScores && (w.warScores.myScore != null || w.warScores.enemyScore != null);
    if (hasScore) continue;
    const reportId = w.realWarId || (/^\d+$/.test(String(w.warKey)) ? String(w.warKey) : null);
    if (reportId) out.push({ warKey: w.warKey, reportId: String(reportId) });
  }
  return out;
}

/**
 * One-time backfill from the persisted payout cache so wars computed before
 * this store existed aren't lost. The disk cache is { cacheKey: result };
 * we ingest one snapshot per distinct (faction, warId). `getWarFn` is an
 * optional store.getWar to enrich with scores/start when the war still
 * exists. Best-effort; returns the number of wars ingested.
 */
export function backfill(getWarFn) {
  let cacheObj;
  try {
    cacheObj = JSON.parse(readFileSync(PAYOUT_CACHE_FILE, "utf8"));
  } catch { return 0; }
  if (!cacheObj || typeof cacheObj !== "object") return 0;
  // Group cache results by a STABLE per-war identity (faction + enemy + end
  // second) so the same physical war — which can appear under both its live
  // key (war_<fid>) and its archive key (realWarId), and in dynamic + static
  // modes — collapses to ONE ingest. Prefer the entry with a numeric warId
  // (its realWarId: gives a stable numeric history key + a matching record).
  const byIdentity = new Map();
  for (const key in cacheObj) {
    const result = cacheObj[key];
    if (!result || !result.factionId || !Array.isArray(result.members)) continue;
    const endedSec = result.toTs ? Math.floor(Number(result.toTs)) : 0;
    const identity = `${result.factionId}:${result.enemyFactionId}:${endedSec}`;
    const existing = byIdentity.get(identity);
    const isNumeric = /^\d+$/.test(String(result.warId));
    if (!existing || (isNumeric && !/^\d+$/.test(String(existing.warId)))) {
      byIdentity.set(identity, result);
    }
  }
  let n = 0;
  for (const result of byIdentity.values()) {
    let war = (typeof getWarFn === "function") ? getWarFn(result.warId) : null;
    // Only trust the live record if it actually describes THIS war — the
    // volatile war_<fid> slot may have been reset to a new opponent, which
    // would otherwise graft the wrong scores/start onto this snapshot.
    if (war && String(war.enemyFactionId) !== String(result.enemyFactionId)) war = null;
    if (ingestWar(result.factionId, war, result)) n++;
  }
  return n;
}

/**
 * One-time idempotent enrich: graft full payout fields (loot/pool/per-member
 * shares) onto already-ingested archive records that lack them, sourcing from
 * the persisted payout cache MATCHED BY ENEMY IDENTITY (faction+enemy), never
 * by cache key. Skips records that already carry a payoutPool. Returns the
 * count of war records enriched.
 */
export function backfillPayouts() {
  let cacheObj;
  try {
    cacheObj = JSON.parse(readFileSync(PAYOUT_CACHE_FILE, "utf8"));
  } catch { return 0; }
  if (!cacheObj || typeof cacheObj !== "object") return 0;
  // Build a best-per-(faction:enemy) index over cache results that actually
  // carry payout members. Prefer dynamic mode, then the freshest generatedAt.
  const best = new Map();
  for (const key in cacheObj) {
    const entry = cacheObj[key];
    const r = (entry && (entry.result || entry)) || null;
    if (!r || !r.factionId || r.enemyFactionId == null || !Array.isArray(r.members)) continue;
    const idKey = `${r.factionId}:${r.enemyFactionId}`;
    const cur = best.get(idKey);
    if (!cur) { best.set(idKey, r); continue; }
    const better = (r.mode === 'dynamic' && cur.mode !== 'dynamic')
      || (((r.mode === 'dynamic') === (cur.mode === 'dynamic'))
          && (Number(r.generatedAt) || 0) > (Number(cur.generatedAt) || 0));
    if (better) best.set(idKey, r);
  }
  let n = 0;
  for (const fid of factionIds()) {
    const entry = _load(fid);
    let touched = false;
    for (const wk in entry.wars) {
      const w = entry.wars[wk];
      if (!w || w.enemyFactionId == null || w.payoutPool != null) continue; // idempotent
      const r = best.get(`${fid}:${w.enemyFactionId}`);
      if (!r) continue;
      const payoutById = new Map();
      for (const m of r.members) {
        payoutById.set(String(m.playerId), {
          score: m.score, sharePct: m.sharePct, dollarPayout: m.dollarPayout,
        });
      }
      w.members = (w.members || []).map(m => {
        const p = payoutById.get(String(m.playerId));
        return p ? { ...m, score: p.score, sharePct: p.sharePct, dollarPayout: p.dollarPayout } : m;
      });
      w.lootTotal = (r.lootTotal != null ? Number(r.lootTotal) : null);
      w.payoutPool = (r.payoutPool != null ? Number(r.payoutPool) : null);
      w.payoutPct = (r.payoutPct != null ? Number(r.payoutPct) : null);
      w.factionShare = (r.factionShare != null ? Number(r.factionShare) : null);
      w.totalScore = (r.totalScore != null ? Number(r.totalScore) : null);
      w.settings = r.settings || null;
      w.payoutMode = r.mode || null;
      if (!w.warResult && r.warResult) w.warResult = r.warResult;
      w.payoutComputedAt = Number(r.generatedAt) || null;
      w.payoutBackfilledAt = Date.now();
      n++;
      touched = true;
    }
    if (touched) { entry.dirty = true; _scheduleSave(entry, fid); }
  }
  return n;
}

/** Force flush all dirty entries — call from the process shutdown hook. */
export function flushAll() {
  for (const [fid, entry] of _state) {
    if (entry._saveTimer) { clearTimeout(entry._saveTimer); entry._saveTimer = null; }
    if (!entry.dirty) continue;
    try {
      writeFileSync(fileFor(fid), JSON.stringify({ wars: entry.wars }));
      entry.dirty = false;
    } catch (e) {
      console.error(`[war-history] flush failed for ${fid}: ${e.message}`);
    }
  }
}
