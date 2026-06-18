import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

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
