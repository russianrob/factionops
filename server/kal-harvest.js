/**
 * Loadouts harvested from KAL's own on-page render.
 *
 * `kal-loadouts.js` reads faction packs a pre-war scout pulled, and never
 * calls KAL — a fetch per mini-profile hover is the opposite of the "cache
 * responses appropriately" their terms ask for. That is the right policy and
 * this does not change it. Coverage was the cost: two scouted factions, 172
 * players, and silence for everybody else.
 *
 * But KAL's own userscript already resolves the loadout whenever a member
 * opens a profile — a 12-hour-old sighting was on screen for a player no pack
 * of ours had ever heard of. That answer is already paid for. Reading it costs
 * KAL nothing extra, which is the whole reason this is allowed to exist where
 * fetch-on-demand is not.
 *
 * So the client relays the RAW loadout object KAL put in the page and the
 * server summarises it here, through the same `summarise()` the packs use.
 * Deliberately not a text parser over KAL's rendered HTML: reconstructing
 * bonus titles, values and rarities out of innerText would be guesswork that
 * breaks silently the first time they restyle.
 *
 * Trust: any authenticated faction member can write here, same as
 * /api/loadout/seen. The shape is validated and capped, but a member who
 * wants to post a fictional loadout can. That is the existing trust boundary
 * for this faction's tooling, not a new one.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join as pathJoin, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { summarise } from "./kal-loadouts.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.DATA_DIR || pathJoin(__dirname, "data");
const STORE_FILE = pathJoin(DATA_DIR, "kal-harvest.json");

/** Drop a harvested row once it is older than the packs would ever be. */
export const MAX_AGE_MS = 30 * 24 * 3600 * 1000;

/** A single player's row is small; this is a guard against a pasted blob. */
const MAX_EQUIPMENT = 40;

let _cache = null;

function load() {
  if (_cache) return _cache;
  _cache = {};
  try {
    if (existsSync(STORE_FILE)) _cache = JSON.parse(readFileSync(STORE_FILE, "utf-8")) || {};
  } catch (e) {
    console.warn(`[kal-harvest] unreadable store, starting empty: ${e.message}`);
    _cache = {};
  }
  return _cache;
}

function persist() {
  try {
    mkdirSync(DATA_DIR, { recursive: true });
    writeFileSync(STORE_FILE, JSON.stringify(_cache));
  } catch (e) {
    console.warn(`[kal-harvest] could not persist: ${e.message}`);
  }
}

/**
 * Record one harvested loadout.
 *
 * Returns the stored row, or null when there was nothing worth storing —
 * which is the ordinary case, not an error: KAL renders a card for players it
 * has never seen equipped, and that card summarises to nothing.
 */
export function record(playerId, loadout, meta = {}, nowMs = Date.now()) {
  const id = String(Number(playerId) || 0);
  if (id === "0") return null;
  if (!loadout || typeof loadout !== "object") return null;
  if (Array.isArray(loadout.equipment) && loadout.equipment.length > MAX_EQUIPMENT) return null;

  const summary = summarise(loadout);
  if (!summary) return null; // card present, nothing ever observed

  const row = {
    summary,
    name: typeof meta.name === "string" ? meta.name.slice(0, 40) : null,
    factionId: meta.factionId != null ? String(meta.factionId).slice(0, 12) : null,
    factionName: typeof meta.factionName === "string" ? meta.factionName.slice(0, 60) : null,
    // KAL's own observation time, which is what staleness should be measured
    // against — not when a member happened to walk past the profile.
    observedAt: Number(summary.observedAt) || Number(meta.observedAt) || null,
    harvestedAt: nowMs,
    by: Number(meta.by) || null,
  };

  const store = load();
  const prev = store[id];
  // Never let a stale walk-past overwrite a fresher sighting. Two members can
  // open the same profile minutes apart and KAL may serve one of them an
  // older cached answer.
  if (prev && (prev.observedAt || 0) > (row.observedAt || 0)) return prev;

  store[id] = row;
  persist();
  return row;
}

/** One player's harvested loadout, or null. Expired rows read as absent. */
export function harvestedFor(playerId, nowMs = Date.now()) {
  const row = load()[String(playerId)];
  if (!row) return null;
  if (nowMs - (row.harvestedAt || 0) > MAX_AGE_MS) return null;
  return row;
}

/** How much the harvest adds, for deciding whether it is pulling its weight. */
export function stats(nowMs = Date.now()) {
  const store = load();
  const ids = Object.keys(store);
  const live = ids.filter((id) => nowMs - (store[id].harvestedAt || 0) <= MAX_AGE_MS);
  return { players: ids.length, live: live.length };
}

export function _reset() { _cache = null; }
