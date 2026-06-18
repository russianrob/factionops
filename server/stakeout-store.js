import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

function dataFile() {
  const dir = process.env.DATA_DIR || join(__dirname, "data");
  return { dir, file: join(dir, "stakeout-watchers.json") };
}

let _state = { owners: {} };
let _saveTimer = null;

export function getState() { return _state; }

export function load() {
  try {
    const { file } = dataFile();
    _state = existsSync(file)
      ? { owners: (JSON.parse(readFileSync(file, "utf8")) || {}).owners || {} }
      : { owners: {} };
  } catch (e) {
    console.warn("[stakeout-store] load failed:", e.message);
    _state = { owners: {} };
  }
  console.log(`[stakeout-store] loaded ${Object.keys(_state.owners).length} owner(s)`);
  return _state;
}

export function _saveNow() {
  try {
    const { dir, file } = dataFile();
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(file, JSON.stringify(_state, null, 2), "utf8");
  } catch (e) {
    console.warn("[stakeout-store] save failed:", e.message);
  }
}

export function scheduleSave() {
  if (_saveTimer) return;
  _saveTimer = setTimeout(() => { _saveTimer = null; _saveNow(); }, 1000);
}

export function flushSync() {
  if (_saveTimer) { clearTimeout(_saveTimer); _saveTimer = null; }
  _saveNow();
}

function mergeTargets(prevMap, records, isPlayer) {
  const out = {};
  for (const rec of records) {
    const id = String(rec.id);
    const prev = prevMap[id];
    out[id] = {
      alerts: rec.alerts,
      info: prev ? prev.info : null,
      seeded: prev ? prev.seeded : false,
      lastFiredAt: prev ? prev.lastFiredAt || {} : {},
    };
    if (isPlayer) out[id].label = typeof rec.label === "string" ? rec.label : "";
  }
  return out;
}

export function syncOwner(ownerId, encryptedKey, players, factions) {
  const oid = String(ownerId);
  if ((players || []).length === 0 && (factions || []).length === 0) {
    delete _state.owners[oid]; // clearing the list removes the stored key
    scheduleSave();
    return;
  }
  const prev = _state.owners[oid] || { players: {}, factions: {} };
  _state.owners[oid] = {
    key: encryptedKey,
    players: mergeTargets(prev.players || {}, players || [], true),
    factions: mergeTargets(prev.factions || {}, factions || [], false),
  };
  scheduleSave();
}

export const MAX_PLAYERS_PER_OWNER = 100;
export const MAX_FACTIONS_PER_OWNER = 100;

const PLAYER_ALERT_KEYS = ["okay", "hospital", "landing", "online", "life", "offline", "revivable"];
const FACTION_ALERT_KEYS = ["chainReaches", "memberCountDrops", "rankedWarStarts", "inRaid", "inTerritoryWar"];
const PLAYER_THRESHOLD_KEYS = new Set(["life", "offline"]);
const FACTION_THRESHOLD_KEYS = new Set(["chainReaches", "memberCountDrops"]);

function normAlerts(raw, keys, thresholdKeys) {
  const out = {};
  if (!raw || typeof raw !== "object") return out;
  for (const k of keys) {
    if (!(k in raw)) continue;
    const v = raw[k];
    if (thresholdKeys.has(k)) {
      if (v === false) out[k] = false;
      else if (typeof v === "number" && Number.isFinite(v) && v >= 0) out[k] = v;
      else out[k] = false;
    } else {
      out[k] = !!v;
    }
  }
  return out;
}

function normList(raw, keys, thresholdKeys, cap) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const id = Number(entry.id);
    if (!Number.isInteger(id) || id <= 0) continue;
    const rec = { id, alerts: normAlerts(entry.alerts, keys, thresholdKeys) };
    if (typeof entry.label === "string") rec.label = entry.label;
    out.push(rec);
    if (out.length >= cap) break;
  }
  return out;
}

export function validateStakeoutSync(body) {
  const b = body && typeof body === "object" ? body : {};
  return {
    players: normList(b.players, PLAYER_ALERT_KEYS, PLAYER_THRESHOLD_KEYS, MAX_PLAYERS_PER_OWNER)
      .map((r) => (r.label === undefined ? { id: r.id, alerts: r.alerts } : { id: r.id, label: r.label, alerts: r.alerts })),
    factions: normList(b.factions, FACTION_ALERT_KEYS, FACTION_THRESHOLD_KEYS, MAX_FACTIONS_PER_OWNER)
      .map((r) => ({ id: r.id, alerts: r.alerts })),
  };
}
