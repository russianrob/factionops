// OC event detection + push broadcast.
//
// Two event types today:
//   - oc_ready_to_spawn — mirrors the OC Spawn Assistance Admin tab's
//     "spawn these level-N OCs" recommendation. Computes per-level
//     availability (members free now + members completing an OC inside
//     the forecast window) and compares against open Recruiting slots.
//     Fires when a level transitions from "0 OCs recommended" to
//     "≥1 OC should be spawned."
//   - oc_completed — crime finishes (Successful/Failure). Detected by
//     watching the completedCrimes list for new crimeIds we've never
//     seen before (per faction).
//
// Audience for both: faction admins (members whose factionPosition is in
// store.getAdminRoles(factionId)).
//
// _completedSeen is persisted to data/oc-completed-seen-<factionId>.json
// so reboots don't re-fire the entire Torn 90-day completed-crimes window.
// The ready-to-spawn snapshot is in-memory only (it's transition-based and
// re-baselines naturally within one poll cycle).

import * as push from './push-notifications.js';
import * as store from './store.js';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join as pathJoin } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const DATA_DIR   = process.env.DATA_DIR || pathJoin(__dirname, 'data');

// Cap is large enough to comfortably exceed Torn's completed-crimes API
// page (~last 90 days, sub-1k entries even for high-volume factions).
// Previous 300-cap was the spam source: a 500-entry response cycled
// 200 entries through the dropped → re-fire → dropped loop forever.
const COMPLETED_SEEN_CAP = 5000;
// Crimes whose executed_at is older than this are never fired, even if
// they're not in the seen set yet. Backstop for cold-start, restored
// snapshots, or Torn returning crimes from outside the recent window.
const FIRE_MAX_AGE_MS = 6 * 60 * 60 * 1000;   // 6 hours

// factionId → Map<level, numOcsRecommended>
// Also carries a __seeded sentinel on the Map so the first observation
// only populates the baseline without firing a backlog of alerts.
const _snapshot = new Map();
// factionId → Set<crimeId> already-notified completions
const _completedSeen = new Map();

function _facMap(factionId) {
  const k = String(factionId);
  if (!_snapshot.has(k)) _snapshot.set(k, new Map());
  return _snapshot.get(k);
}

function _completedSeenFile(factionId) {
  try { mkdirSync(DATA_DIR, { recursive: true }); } catch {}
  return pathJoin(DATA_DIR, `oc-completed-seen-${factionId}.json`);
}

function _facSeen(factionId) {
  const k = String(factionId);
  if (_completedSeen.has(k)) return _completedSeen.get(k);
  // Cold load from disk — ensures reboots don't reseed and re-fire.
  let s = new Set();
  try {
    const f = _completedSeenFile(k);
    if (existsSync(f)) {
      const raw = JSON.parse(readFileSync(f, 'utf-8'));
      if (Array.isArray(raw.ids)) s = new Set(raw.ids.map(String));
    }
  } catch (e) {
    console.warn(`[oc-completed] load seen set for ${k}: ${e.message}`);
  }
  _completedSeen.set(k, s);
  return s;
}

function _persistSeen(factionId) {
  const k = String(factionId);
  const s = _completedSeen.get(k);
  if (!s) return;
  try {
    writeFileSync(_completedSeenFile(k), JSON.stringify({
      ids: Array.from(s),
      savedAt: Date.now(),
    }));
  } catch (e) {
    console.warn(`[oc-completed] persist seen set for ${k}: ${e.message}`);
  }
}

// factionId -> Set<crimeId> already warned about a weak slot.
// Separate file from the completions set: different lifecycle, and mixing
// them would make one feature's cap evict the other's history.
const _lowSeen = new Map();
// factionId -> ms of the last evaluation. The poller ticks every minute;
// this check is deliberately hourly, which also debounces a crime whose
// slots are still being filled from firing on a half-staffed roster.
const _lowLastRun = new Map();
const LOW_CHECK_INTERVAL_MS = 60 * 60 * 1000;
const LOW_SEEN_CAP = 2000;

function _lowSeenFile(factionId) {
  try { mkdirSync(DATA_DIR, { recursive: true }); } catch {}
  return pathJoin(DATA_DIR, `oc-low-success-seen-${factionId}.json`);
}

function _facLowSeen(factionId) {
  const k = String(factionId);
  if (_lowSeen.has(k)) return _lowSeen.get(k);
  let set = new Set();
  try {
    const f = _lowSeenFile(k);
    if (existsSync(f)) {
      const raw = JSON.parse(readFileSync(f, 'utf-8'));
      if (Array.isArray(raw.ids)) set = new Set(raw.ids.map(String));
    }
  } catch (e) {
    console.warn(`[oc-low] load seen set for ${k}: ${e.message}`);
  }
  _lowSeen.set(k, set);
  return set;
}

function _persistLowSeen(factionId) {
  const k = String(factionId);
  const set = _lowSeen.get(k);
  if (!set) return;
  try {
    writeFileSync(_lowSeenFile(k), JSON.stringify({ ids: Array.from(set), savedAt: Date.now() }));
  } catch (e) {
    // A write that fails silently is how a seen-set resets and re-fires
    // the whole backlog after a restart. Say so.
    console.warn(`[oc-low] persist seen set for ${k}: ${e.message}`);
  }
}

function _filledCount(slots) {
  if (!Array.isArray(slots)) return 0;
  let n = 0;
  for (const s of slots) if (s && (s.user_id != null || s.user != null)) n++;
  return n;
}

// ── Low success chance detection ───────────────────────────────────────
//
// Torn renders a per-slot success chance on the OC page (the number in
// `successChance___*`). The API exposes the SAME number as each slot's
// `checkpoint_pass_rate` — verified against 81 filled slots in faction
// 42055, every one an exact match. That matters: it means this check runs
// server-side on a timer and never needs anybody to have the page open.
//
// `success_chance` does NOT exist on /v2/faction/crimes?cat=available.
// Reaching for that name silently yields undefined and the check goes dead
// without failing, so the field read here is deliberate.

/** Below this, a slot is worth waking an admin for. */
export const LOW_SUCCESS_THRESHOLD = 65;

/**
 * Crimes carrying at least one filled slot below the threshold.
 *
 * THE TRAP: Torn reports `checkpoint_pass_rate: 0` for UNFILLED slots.
 * Read without checking occupancy, every recruiting crime looks like a
 * 0% catastrophe and alerts forever. Occupancy is checked first, always.
 *
 * Absent or non-numeric rates are skipped rather than coerced — unknown
 * is not the same as terrible, and coercing it cries wolf whenever Torn
 * omits a field.
 *
 * @param seen  crime ids already notified; those are omitted entirely
 * @param names uid -> member name. The crimes endpoint returns slot.user
 *              as an id and progression only, with NO name — a live run
 *              printed "Enforcer 61%", which says a slot is weak but not
 *              who to go and talk to.
 */
export function lowSuccessCrimes(availableCrimes, { threshold = LOW_SUCCESS_THRESHOLD, seen, names } = {}) {
  const out = [];
  for (const c of (availableCrimes || [])) {
    if (!c || c.id == null) continue;
    const cid = String(c.id);
    if (seen && seen.has(cid)) continue;

    const weak = [];
    for (const s of (c.slots || [])) {
      if (!s) continue;
      // Occupancy first. See THE TRAP above.
      const uid = s.user_id ?? s.user?.id ?? null;
      if (uid == null) continue;
      const pct = typeof s.checkpoint_pass_rate === 'number' ? s.checkpoint_pass_rate : null;
      if (pct == null || !Number.isFinite(pct)) continue;
      if (pct >= threshold) continue;
      weak.push({
        userId: String(uid),
        // Slot name first if Torn ever supplies one, roster second.
        name: String(s.user?.name || (names && names[String(uid)]) || ''),
        // 'Muscle #2' -> 'Muscle', matching how slots are keyed elsewhere.
        position: String(s.position || '').replace(/\s*#\d+$/, ''),
        pct,
      });
    }
    if (weak.length) {
      // Weakest first: the one to fix is the one that reads first.
      weak.sort((a, b) => a.pct - b.pct);
      out.push({ crimeId: cid, name: String(c.name || 'OC'), weak });
    }
  }
  return out;
}

function _resolveAdmins(factionId, members) {
  const fid = String(factionId);
  const adminRoles = (store.getAdminRoles(fid) || []).map(r => String(r).toLowerCase());
  const ids = [];
  for (const m of (members || [])) {
    const pos = String(m?.factionPosition || m?.position || '').toLowerCase();
    if (pos && adminRoles.includes(pos)) ids.push(String(m.id));
  }
  return { adminIds: ids, adminRoles };
}

// ── Spawn-recommendation detection ─────────────────────────────────────
// Mirrors the OC Spawn Assistance Admin tab's "Recommended OCs to
// spawn" computation. For each difficulty level we count eligible
// members (free now + completing an OC within forecast_hours) and
// compare against open Recruiting slots. When a level has at least
// one full OC's worth of deficit, it's a "spawn recommendation."
const DEFAULT_SLOTS_PER_OC = 4;

// Recompute each member's `joinable` using the faction's MINCPR and
// CPR_BOOST settings. getOcSpawnData's cprCache is built with a server-
// wide default MINCPR=60/BOOST=15; /api/oc/spawn-key's response re-runs
// this same loop with the faction's oc_mincpr / oc_cpr_boost before the
// userscript sees it, so the Admin tab's joinable differs from the raw
// cache for factions whose mincpr isn't 60. Mirror that recalc here
// so the notifier agrees with the Admin tab.
function _applyFactionCprThreshold(cprCache, mincpr, boost) {
  if (!cprCache) return {};
  const out = {};
  for (const [uid, d] of Object.entries(cprCache)) {
    const lc = {};
    for (const e of (d?.entries || [])) {
      if (!lc[e.diff]) lc[e.diff] = { sum: 0, count: 0 };
      lc[e.diff].sum += e.rate;
      lc[e.diff].count += 1;
    }
    let effTop = d?.highestLevel || 0;
    for (let lvl = effTop; lvl >= 1; lvl--) {
      const lv = lc[lvl];
      if (!lv) continue;
      if ((lv.sum / lv.count) >= mincpr) { effTop = lvl; break; }
    }
    const cpr = Number(d?.cpr || 0);
    const joinable = cpr >= mincpr + boost ? Math.min(effTop + 1, 10) : effTop;
    out[uid] = { ...d, effectiveTop: effTop, joinable };
  }
  return out;
}

function _buildSpawnRecommendations(factionId, availableCrimes, members, cprCache) {
  if (!Array.isArray(availableCrimes) || !Array.isArray(members)) return [];
  const settings = store.getFactionSettings(factionId) || {};
  const forecastHours = Number(settings.oc_forecast_hours ?? 6);
  const activeDays = Number(settings.oc_active_days ?? 7);
  const mincpr = Number(settings.oc_mincpr ?? 60);
  const boost = Number(settings.oc_cpr_boost ?? 15);
  const nowSec = Math.floor(Date.now() / 1000);
  const forecastCutoff = nowSec + forecastHours * 3600;
  const activeCutoff = nowSec - activeDays * 86400;
  // Recompute joinable per-member using faction thresholds.
  const tunedCpr = _applyFactionCprThreshold(cprCache, mincpr, boost);

  // Map each placed member → their current OC's ready_at timestamp.
  const memberOcMap = new Map();
  for (const c of availableCrimes) {
    if (!c || c.status === 'Expired' || !Array.isArray(c.slots)) continue;
    for (const s of c.slots) {
      const uid = s?.user_id ?? s?.user?.id;
      if (uid != null) memberOcMap.set(String(uid), Number(c.ready_at || 0));
    }
  }

  // Filter members: active, tenure, and forecast-window OC gating.
  const eligible = [];
  for (const m of members) {
    const uid = String(m?.id ?? '');
    if (!uid) continue;
    const lastAction = Number(m?.last_action?.timestamp ?? 0);
    if (lastAction < activeCutoff) continue;
    const daysInFaction = Number(m?.days_in_faction ?? 999);
    if (daysInFaction < 3) continue;
    const rec = tunedCpr?.[uid];
    const joinable = Number(rec?.joinable ?? 0);
    if (joinable <= 0) continue;
    const readyAt = memberOcMap.get(uid);
    const inOC = readyAt !== undefined;
    // Skip members in an OC that finishes beyond the forecast window —
    // they're not available to join anything we'd spawn now.
    if (inOC && readyAt > 0 && readyAt > forecastCutoff) continue;
    eligible.push({ uid, joinable, inOC });
  }

  // Count current Recruiting capacity per level.
  const slotMap = {};
  for (const c of availableCrimes) {
    if (!c || c.status !== 'Recruiting') continue;
    const d = Number(c.difficulty || 0);
    if (!slotMap[d]) slotMap[d] = { totalSlots: 0, openSlots: 0, crimes: 0 };
    const slots = Array.isArray(c.slots) ? c.slots : [];
    let open = 0;
    for (const s of slots) if (!s?.user_id && !s?.user?.id) open++;
    slotMap[d].totalSlots += slots.length;
    slotMap[d].openSlots  += open;
    slotMap[d].crimes     += 1;
  }

  const recs = [];
  for (let lvl = 10; lvl >= 1; lvl--) {
    const forLvl = eligible.filter(e => e.joinable === lvl);
    if (forLvl.length === 0) continue;
    const freeNow  = forLvl.filter(e => !e.inOC).length;
    const soonFree = forLvl.length - freeNow;
    const info = slotMap[lvl] || { totalSlots: 0, openSlots: 0, crimes: 0 };
    const slotsPerOc = info.crimes > 0 ? info.totalSlots / info.crimes : DEFAULT_SLOTS_PER_OC;
    let numOcsToSpawn = 0;
    if (info.totalSlots === 0) {
      numOcsToSpawn = 1; // no OCs at this level but members waiting — open one
    } else {
      const deficit = forLvl.length - info.openSlots;
      if (deficit > 0) numOcsToSpawn = Math.floor(deficit / slotsPerOc);
    }
    if (numOcsToSpawn > 0) recs.push({ level: lvl, numOcsToSpawn, freeNow, soonFree });
  }
  return recs;
}

async function _checkReadyToSpawn(factionId, availableCrimes, members, cprCache) {
  if (!Array.isArray(availableCrimes) || !Array.isArray(members)) return;
  const fid = String(factionId);
  const map = _facMap(fid);
  const recs = _buildSpawnRecommendations(fid, availableCrimes, members, cprCache);

  // First-ever observation for this faction: seed the snapshot without
  // firing so cold boots don't spam the admin with the current backlog.
  if (!map.__seeded) {
    map.__seeded = true;
    for (const r of recs) map.set(r.level, r.numOcsToSpawn);
    return;
  }

  const { adminIds, adminRoles } = _resolveAdmins(fid, members);
  const transitions = [];
  const presentLevels = new Set(recs.map(r => r.level));
  for (const r of recs) {
    const prevCount = map.get(r.level) || 0;
    if (prevCount === 0 && r.numOcsToSpawn > 0) transitions.push(r);
    map.set(r.level, r.numOcsToSpawn);
  }
  // Reset dropped levels to 0 so the next fresh spike can fire again.
  for (const lvl of Array.from(map.keys())) {
    if (typeof lvl !== 'number') continue;
    if (!presentLevels.has(lvl) && map.get(lvl) !== 0) map.set(lvl, 0);
  }

  if (transitions.length === 0) return;
  if (adminIds.length === 0) {
    console.log(`[oc-ready] faction ${fid}: ${transitions.length} recommendation(s) but no admins in roles [${adminRoles.join(',')}] — skipping push`);
    return;
  }

  for (const t of transitions) {
    const total = t.freeNow + t.soonFree;
    const s = t.numOcsToSpawn === 1 ? '' : 's';
    const soonBit = t.soonFree > 0 ? ` (${t.freeNow} free now, ${t.soonFree} completing within forecast)` : ` (${t.freeNow} free now)`;
    const payload = {
      title: `Spawn ${t.numOcsToSpawn} level-${t.level} OC${s}`,
      body: `${total} member${total === 1 ? '' : 's'} ready to join${soonBit}`,
      tag: `oc-ready-lvl-${t.level}`,
      data: {
        type: 'oc_ready_to_spawn',
        factionId: fid,
        level: t.level,
        count: t.numOcsToSpawn,
        url: 'https://www.torn.com/factions.php?step=your#/tab=crimes',
      },
    };
    try {
      await push.sendToPlayers(adminIds, payload, 'oc_ready_to_spawn');
      console.log(`[oc-ready] faction ${fid}: recommend ${t.numOcsToSpawn}×lvl-${t.level} OC(s) (${t.freeNow} free, ${t.soonFree} soon) → ${adminIds.length} admin(s)`);
    } catch (e) {
      console.warn(`[oc-ready] faction ${fid} push failed for lvl ${t.level}:`, e.message);
    }
  }
}

// ── Completed detection ────────────────────────────────────────────────
async function _checkCompletions(factionId, completedCrimes, members) {
  if (!Array.isArray(completedCrimes) || completedCrimes.length === 0) return;
  const fid = String(factionId);
  const seen = _facSeen(fid);
  const wasEmpty = seen.size === 0;

  // First-ever observation (no on-disk seed either): record every current
  // crime ID without firing. Prevents a brand-new install from spamming
  // the entire 90-day Torn history.
  if (wasEmpty) {
    for (const c of completedCrimes) if (c?.id != null) seen.add(String(c.id));
    _persistSeen(fid);
    return;
  }

  // Age guard backstop. Even if the seen set somehow lost an ID, only
  // crimes whose executed_at is within FIRE_MAX_AGE_MS get pushed —
  // historical entries from Torn's 90-day window can never spam again.
  const ageCutoff = Math.floor((Date.now() - FIRE_MAX_AGE_MS) / 1000);

  const { adminIds, adminRoles } = _resolveAdmins(fid, members);
  const fresh = [];
  let dirty = false;
  for (const c of completedCrimes) {
    if (!c || c.id == null) continue;
    const cid = String(c.id);
    if (seen.has(cid)) continue;
    // Mark as seen regardless of whether we'll fire — that prevents the
    // SAME old crime ID showing up twice across consecutive polls and
    // still being considered fresh. Persist after the loop.
    seen.add(cid);
    dirty = true;
    const executedAt = Number(c.executed_at || 0);
    if (executedAt && executedAt < ageCutoff) {
      // Too old to push but still record as seen so the dedup is honest.
      continue;
    }
    fresh.push(c);
  }

  if (fresh.length === 0) {
    if (dirty) _persistSeen(fid);
    return;
  }
  if (adminIds.length === 0) {
    console.log(`[oc-completed] faction ${fid}: ${fresh.length} new completion(s) but no admins in roles [${adminRoles.join(',')}] — skipping push`);
    if (dirty) _persistSeen(fid);
    return;
  }

  for (const c of fresh) {
    const cid = String(c.id);
    const name = String(c.name || 'OC');
    const status = String(c.status || '');
    const isSuccess = /success/i.test(status);
    const isFail = /fail/i.test(status);
    const outcome = isSuccess ? '✓ Success' : isFail ? '✗ Failed' : status || 'Finished';
    const money = Number(c?.rewards?.money || 0);
    const respect = Number(c?.rewards?.respect || 0);
    const bits = [outcome];
    if (money > 0) bits.push('$' + money.toLocaleString('en-US'));
    if (respect > 0) bits.push(respect.toLocaleString('en-US') + ' respect');
    const payload = {
      title: `OC completed: ${name}`,
      body: bits.join(' · '),
      tag: `oc-completed-${cid}`,
      data: {
        type: 'oc_completed',
        crimeId: cid,
        factionId: fid,
        url: 'https://www.torn.com/factions.php?step=your#/tab=crimes',
      },
    };
    try {
      await push.sendToPlayers(adminIds, payload, 'oc_completed');
      console.log(`[oc-completed] faction ${fid}: fired "${name}" (${status || 'no status'}) to ${adminIds.length} admin(s)`);
    } catch (e) {
      console.warn(`[oc-completed] faction ${fid} push failed for ${cid}:`, e.message);
    }
  }

  // Cap memory. 5000 comfortably exceeds Torn's completed-crimes page
  // size (~last 90 days), so the previous "drop 200 → re-fire 200 next
  // poll" loop can't happen even on the busiest factions.
  if (seen.size > COMPLETED_SEEN_CAP) {
    const arr = Array.from(seen);
    _completedSeen.set(fid, new Set(arr.slice(-COMPLETED_SEEN_CAP)));
  }
  _persistSeen(fid);
}

/**
 * Warn faction admins about OC slots unlikely to pass.
 *
 * Fires ONCE PER CRIME, ever — the owner's choice. One notification lists
 * every weak slot on that crime and the crime is never mentioned again,
 * even if another member later drops below the line. The alternative,
 * re-alerting hourly while a crime sits in planning for days, is the
 * fastest way to get the whole channel muted.
 *
 * Unlike the completions check there is NO silent first-run seeding: a
 * crime already sitting weak is a live problem, and seeding would mean it
 * is never reported at all.
 */
async function _checkLowSuccess(factionId, availableCrimes, members) {
  if (!Array.isArray(availableCrimes) || availableCrimes.length === 0) return;
  const fid = String(factionId);

  const now = Date.now();
  const last = _lowLastRun.get(fid) || 0;
  if (now - last < LOW_CHECK_INTERVAL_MS) return;
  _lowLastRun.set(fid, now);

  const seen = _facLowSeen(fid);
  // The crimes endpoint carries slot.user as an id with no name, so the
  // roster supplies it. Without this an admin is told "Enforcer 61%" and
  // has to go and work out which Enforcer.
  const names = {};
  for (const m of (members || [])) {
    if (m && m.id != null && m.name) names[String(m.id)] = String(m.name);
  }
  const flagged = lowSuccessCrimes(availableCrimes, { seen, names });
  if (!flagged.length) return;

  const { adminIds } = _resolveAdmins(fid, members);
  if (!adminIds.length) {
    // No audience yet — do NOT mark these as seen, or they become
    // permanently unreportable the moment an admin does show up.
    console.log(`[oc-low] faction ${fid}: ${flagged.length} weak crime(s) but no admins resolved — holding`);
    _lowLastRun.set(fid, 0);
    return;
  }

  for (const c of flagged) {
    const who = c.weak
      .map(w => `${w.name || w.position} ${w.pct}%`)
      .slice(0, 4)
      .join(' · ');
    const more = c.weak.length > 4 ? ` +${c.weak.length - 4} more` : '';
    const payload = {
      title: `Weak OC slot: ${c.name}`,
      body: `Below ${LOW_SUCCESS_THRESHOLD}% — ${who}${more}`,
      tag: `oc-low-${c.crimeId}`,
      data: {
        type: 'oc_low_success',
        crimeId: c.crimeId,
        factionId: fid,
        // Tap-through lives on data.url; a top-level url is ignored by
        // all three delivery channels.
        url: 'https://www.torn.com/factions.php?step=your#/tab=crimes',
      },
    };
    try {
      await push.sendToPlayers(adminIds, payload, 'oc_low_success');
      seen.add(c.crimeId);
      console.log(`[oc-low] faction ${fid}: fired "${c.name}" (${c.weak.length} weak) to ${adminIds.length} admin(s)`);
    } catch (e) {
      // Not marked seen — a failed send should retry next hour, not vanish.
      console.warn(`[oc-low] faction ${fid} push failed for ${c.crimeId}:`, e.message);
    }
  }

  if (seen.size > LOW_SEEN_CAP) {
    _lowSeen.set(fid, new Set(Array.from(seen).slice(-LOW_SEEN_CAP)));
  }
  _persistLowSeen(fid);
}

// ── Public API ─────────────────────────────────────────────────────────
export async function checkAndNotify(factionId, availableCrimes, members, completedCrimes, cprCache) {
  await _checkReadyToSpawn(factionId, availableCrimes, members, cprCache);
  if (completedCrimes) await _checkCompletions(factionId, completedCrimes, members);
  await _checkLowSuccess(factionId, availableCrimes, members);
}

export function checkAndNotifyAsync(factionId, availableCrimes, members, completedCrimes, cprCache) {
  Promise.resolve()
    .then(() => checkAndNotify(factionId, availableCrimes, members, completedCrimes, cprCache))
    .catch(e => console.warn('[oc-notif] async error:', e.message));
}

// ─────────────────────────────────────────────────────────────────────
// Background poller — independent of admin Refresh clicks. Runs every
// POLL_INTERVAL_MS per faction with a known polling key (Torn key pool
// or oc_ffs_key fallback). Cost: 1-2 Torn API calls per faction per
// minute, well under Torn's 100/min per-key cap.
// ─────────────────────────────────────────────────────────────────────

const POLL_INTERVAL_MS = 60_000;
let _pollTimer = null;
let _listFactions = null;
let _getFreshKey = null;
let _fetchOcData = null;

export function startPoller({ listFactions, getFreshKey, fetchOcData }) {
  if (_pollTimer) return;
  _listFactions = listFactions;
  _getFreshKey = getFreshKey;
  _fetchOcData = fetchOcData;
  _pollTimer = setInterval(runPoll, POLL_INTERVAL_MS);
  console.log(`[oc-notif][poller] started — ${POLL_INTERVAL_MS / 1000}s interval`);
  runPoll();
}

export function stopPoller() {
  if (_pollTimer) { clearInterval(_pollTimer); _pollTimer = null; }
}

async function runPoll() {
  if (!_listFactions || !_getFreshKey || !_fetchOcData) return;
  let factionIds = [];
  try { factionIds = _listFactions() || []; } catch (_) { return; }
  for (const fid of factionIds) {
    // Try every pool key in order until one succeeds. Previously we
    // grabbed only `getFactionKeys(fid)[0]` and gave up on its first
    // failure, which produced minute-by-minute "Incorrect ID-entity
    // relation" log spam whenever the front-of-pool key was broken
    // (Torn occasionally returns code 6 spuriously after the late-Apr
    // 2026 auth refactor). Now we walk through the candidates the
    // same way /api/oc/spawn-key's fallback path does.
    const candidates = _getFreshKey(fid, { all: true }) || [];
    if (candidates.length === 0) continue;
    let succeeded = false;
    let lastErr = null;
    for (const key of candidates) {
      try {
        const data = await _fetchOcData(fid, key);
        await checkAndNotify(fid, data.availableCrimes, data.members, data.completedCrimes, data.cprCache);
        succeeded = true;
        break;
      } catch (e) {
        lastErr = e;
        // Don't log per-key failure here — only log once at the end if
        // every key failed. Keeps the per-minute log volume bounded.
      }
    }
    if (!succeeded && lastErr) {
      console.warn(`[oc-notif][poller] faction ${fid}: all ${candidates.length} pool key(s) failed — last error: ${lastErr.message}`);
    }
  }
}
