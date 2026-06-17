import * as store from "./store.js";
import { fetchRecentFactionAttacks } from "./torn-api.js";

export const RETAL_WINDOW_SEC = 300;
const RETAL_INTERVAL_MS  = 20_000;
const RETAL_ACTIVE_MS    = 60_000;
const RETAL_LOOKBACK_SEC  = 420;
const MAX_BACKOFF_MS     = 120_000;

/**
 * Build the incoming-retal list from OUR faction's attack log: enemy-faction
 * attacks on our members still inside the retal-bonus window. Pure + tested.
 */
export function computeIncomingRetals(attacks, enemyFactionId, nowSec, windowSec = RETAL_WINDOW_SEC, enemyStatuses = {}) {
  if (!Array.isArray(attacks) || !enemyFactionId) return [];
  const enemyFid = String(enemyFactionId);
  const out = [];
  for (const a of attacks) {
    const attackerFid = String(a.attacker_faction ?? a.attacker_faction_id ?? "");
    if (attackerFid !== enemyFid) continue;
    const attackerId = String(a.attacker_id ?? "");
    if (!attackerId) continue;
    const endedTs = Number(a.timestamp_ended || a.timestamp_started || 0);
    if (!endedTs || endedTs < nowSec - windowSec) continue;
    const lvl = enemyStatuses[attackerId] && enemyStatuses[attackerId].level;
    out.push({
      attackId: String(a.code || (attackerId + "-" + endedTs)),
      attackerId: Number(attackerId),
      attackerName: a.attacker_name || "",
      defenderId: Number(a.defender_id || 0),
      defenderName: a.defender_name || "",
      result: a.result || "",
      endedTs,
      attackerLevel: lvl != null ? Number(lvl) : null,
    });
  }
  out.sort((x, y) => y.endedTs - x.endedTs);
  return out;
}

const retalTimeouts = new Map();
const retalCursors  = new Map();
const retalBackoffs = new Map();
let _io = null;

function viewed(warId, war) {
  const room = _io && _io.sockets && _io.sockets.adapter.rooms.get(`war_${warId}`);
  if (room && room.size > 0) return true;
  return Date.now() - (Number(war.lastClientPollAt) || 0) <= RETAL_ACTIVE_MS;
}

export function startRetalTracker(io, warId) {
  if (retalTimeouts.has(warId)) return;
  _io = io || _io;
  const schedule = (delay) => retalTimeouts.set(warId, setTimeout(poll, delay));

  async function poll() {
    const war = store.getWar(warId);
    if (!war || !war.enemyFactionId || war.warEnded) { schedule(RETAL_INTERVAL_MS); return; }
    if (!viewed(warId, war)) { retalBackoffs.delete(warId); schedule(RETAL_INTERVAL_MS); return; }

    const cursor = (retalCursors.get(warId) || 0) + 1;
    retalCursors.set(warId, cursor);
    const apiKey = store.getPollingKey(war.factionId, "retals", cursor);
    if (!apiKey) { schedule(RETAL_INTERVAL_MS); return; }

    const nowSec = Math.floor(Date.now() / 1000);
    try {
      const attacks = await fetchRecentFactionAttacks(war.factionId, apiKey, nowSec - RETAL_LOOKBACK_SEC);
      retalBackoffs.delete(warId);
      const next = computeIncomingRetals(attacks, war.enemyFactionId, nowSec, RETAL_WINDOW_SEC, war.enemyStatuses || {});
      const changed = JSON.stringify(next) !== JSON.stringify(war.incomingRetals || []);
      war.incomingRetals = next;
      if (changed && _io) {
        _io.to(`war_${warId}`).emit("retals", { warId, retals: next });
        import("./routes.js").then(r => r.broadcastSSE(warId, { retals: next })).catch(() => {});
      }
      schedule(RETAL_INTERVAL_MS);
    } catch (err) {
      if (/Incorrect ID-entity relation/i.test(err.message)) store.quarantinePoolKey(apiKey, war.factionId, "retals code 7");
      else if (/Incorrect key|\(code 2\)/i.test(err.message)) store.quarantinePoolKey(apiKey, war.factionId, "retals code 2");
      const cur = retalBackoffs.get(warId) || RETAL_INTERVAL_MS;
      const back = Math.min(cur * 2, MAX_BACKOFF_MS);
      retalBackoffs.set(warId, back);
      console.warn(`[retals] war ${warId}: poll failed (${err.message}); retry in ${Math.round(back / 1000)}s`);
      schedule(back);
    }
  }

  schedule(1_000);
}

export function stopRetalTracker(warId) {
  const t = retalTimeouts.get(warId);
  if (t) clearTimeout(t);
  retalTimeouts.delete(warId);
  retalCursors.delete(warId);
  retalBackoffs.delete(warId);
}

export function stopAll() {
  for (const t of retalTimeouts.values()) clearTimeout(t);
  retalTimeouts.clear();
  retalCursors.clear();
  retalBackoffs.clear();
}
