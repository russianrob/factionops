// Per-checkpoint OC outcome storage. Companion to oc-history (which stores
// aggregate slot data); this stores PER-CHECKPOINT pass/fail attribution
// parsed by the userscript fetch interceptor from Torn's page-level
// completed-crimes response (only place per-checkpoint data is exposed —
// /v2/faction/crimes only returns aggregate checkpoint_pass_rate).
//
// Disk layout: data/oc-checkpoint-history/<factionId>.json
// {
//   "scenarios": {
//     "<scenarioId>": {
//       id, name, executedAt, ingestedAt,
//       checkpoints: [
//         { checkpoint: 1, outcome: "P"|"F", playerId, role }
//       ]
//     }
//   }
// }
//
// Cold-start gap is intentional: only populates when an admin actually
// opens the Completed tab on faction.php. The userscript filters that
// fetch and POSTs the parsed scenario data here.

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join as pathJoin } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIR = pathJoin(process.env.DATA_DIR || pathJoin(__dirname, "data"), "oc-checkpoint-history");

if (!existsSync(DIR)) mkdirSync(DIR, { recursive: true });

const fileFor = (factionId) => pathJoin(DIR, `${String(factionId)}.json`);

/** @type {Map<string, { scenarios: Record<string, any>, dirty: boolean, _saveTimer: NodeJS.Timeout|null }>} */
const _state = new Map();

function _load(factionId) {
  const fid = String(factionId);
  if (_state.has(fid)) return _state.get(fid);
  let initial = { scenarios: {} };
  try {
    const raw = readFileSync(fileFor(fid), "utf8");
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && parsed.scenarios) initial = parsed;
  } catch { /* fresh */ }
  const entry = { ...initial, dirty: false, _saveTimer: null };
  _state.set(fid, entry);
  return entry;
}

function _scheduleSave(entry, factionId) {
  if (entry._saveTimer) return;
  entry._saveTimer = setTimeout(() => {
    entry._saveTimer = null;
    try {
      writeFileSync(fileFor(factionId), JSON.stringify({ scenarios: entry.scenarios }));
      entry.dirty = false;
    } catch (e) {
      console.error(`[oc-checkpoints] save failed for ${factionId}: ${e.message}`);
    }
  }, 5_000);
}

/**
 * Ingest one parsed scenario. `checkpoints` is an array of
 * { checkpoint: number, outcome: "P"|"F", playerId: string, role: string }.
 * Returns the count of NEW checkpoints recorded (0 if scenario already
 * stored; full array length if first-time ingest).
 */
export function ingestScenario(factionId, scenarioId, scenarioData) {
  if (!factionId || !scenarioId) return 0;
  const fid = String(factionId);
  const sid = String(scenarioId);
  const entry = _load(fid);
  if (entry.scenarios[sid]) return 0; // already stored
  if (!Array.isArray(scenarioData?.checkpoints)) return 0;
  const sanitized = {
    id: sid,
    name: String(scenarioData.name || "").slice(0, 80),
    executedAt: Number(scenarioData.executedAt) || 0,
    ingestedAt: Date.now(),
    checkpoints: scenarioData.checkpoints
      .filter(c => Number.isFinite(Number(c.checkpoint)) && (c.outcome === "P" || c.outcome === "F"))
      .map(c => ({
        checkpoint: Number(c.checkpoint),
        outcome: c.outcome,
        playerId: c.playerId != null ? String(c.playerId) : null,
        role: String(c.role || "").slice(0, 60),
      })),
  };
  entry.scenarios[sid] = sanitized;
  entry.dirty = true;
  _scheduleSave(entry, fid);
  return sanitized.checkpoints.length;
}

/**
 * Return per-(member, OC, role, checkpoint) pass/fail counts for a
 * faction. Used by oc-spawn.js's buildCprCache to extend cprCache[uid]
 * with a byCheckpoint dimension.
 *
 * Shape: { [playerId]: { [`${ocName}::${role}::C${n}`]: { pass, fail, rate } } }
 */
export function aggregateByMember(factionId) {
  const entry = _load(factionId);
  const out = {};
  for (const sid in entry.scenarios) {
    const s = entry.scenarios[sid];
    if (!s || !Array.isArray(s.checkpoints)) continue;
    for (const cp of s.checkpoints) {
      if (!cp.playerId || !cp.role) continue;
      const pid = cp.playerId;
      const key = `${s.name}::${cp.role}::C${cp.checkpoint}`;
      if (!out[pid]) out[pid] = {};
      if (!out[pid][key]) out[pid][key] = { pass: 0, fail: 0, rate: 0 };
      if (cp.outcome === "P") out[pid][key].pass++;
      else if (cp.outcome === "F") out[pid][key].fail++;
    }
  }
  // Compute rate
  for (const pid in out) {
    for (const k in out[pid]) {
      const e = out[pid][k];
      const total = e.pass + e.fail;
      e.rate = total > 0 ? Math.round((e.pass / total) * 1000) / 10 : 0;
    }
  }
  return out;
}

/**
 * Per-crime-NAME observed whole-crime success for a faction. A Torn OC
 * succeeds only when EVERY checkpoint passed (the store holds P/F only —
 * no crit). Empty-checkpoint scenarios are excluded as partial captures.
 * Shape: { [crimeName]: { success, fail, total, rate(0..1) } }.
 */
export function _aggregateScenariosByCrime(scenarios) {
  const byName = {};
  for (const sid in scenarios) {
    const s = scenarios[sid];
    const cps = Array.isArray(s?.checkpoints) ? s.checkpoints : [];
    if (cps.length === 0) continue;
    const name = String(s.name || "").trim();
    if (!name) continue;
    const b = (byName[name] ||= { success: 0, fail: 0, total: 0, rate: 0 });
    b.total++;
    if (cps.every((c) => c.outcome === "P")) b.success++;
    else b.fail++;
  }
  for (const name in byName) {
    const b = byName[name];
    b.rate = b.total ? b.success / b.total : 0;
  }
  return byName;
}

export function aggregateByCrime(factionId) {
  const entry = _load(factionId);
  return _aggregateScenariosByCrime(entry.scenarios || {});
}

/** Total scenarios stored for a faction — for diag/stats endpoints. */
export function scenarioCount(factionId) {
  const entry = _load(factionId);
  return Object.keys(entry.scenarios).length;
}

/** Force flush all dirty entries — call from process shutdown hook. */
export function flushAll() {
  for (const [fid, entry] of _state) {
    if (entry._saveTimer) { clearTimeout(entry._saveTimer); entry._saveTimer = null; }
    if (!entry.dirty) continue;
    try {
      writeFileSync(fileFor(fid), JSON.stringify({ scenarios: entry.scenarios }));
      entry.dirty = false;
    } catch (e) {
      console.error(`[oc-checkpoints] flush failed for ${fid}: ${e.message}`);
    }
  }
}
