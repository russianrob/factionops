// Where loadout sightings live.
//
// One row per observed player, newest sighting wins. This answers "what were
// they last seen with", not "what is their history" — the smaller claim, and
// the only one a handful of opportunistic sightings can actually support.
//
// The RAW sighting is stored alongside the flags on purpose. Classification is
// a judgement that will change (does a partial EOD set count? do orange
// primaries matter?), and keeping the facts means those questions can be
// re-answered over collected data instead of needing a fresh week of
// collection each time.
//
// WRITE AUTH IS NOT SOLVED. Posting is open and rate-limited, which is
// adequate while this is a measurement: observational data, little to gain by
// poisoning it, and every row carries who reported it so bad data can be
// traced and dropped. It is NOT adequate once a flag is displayed and acted
// on — at that point somebody could mark a whole faction as EOD. See the
// design note before building the UI.

import fs from "fs";
import path from "path";
import { readSighting, classify } from "./loadout-sighting.js";

const FILE = new URL("./data/loadout-sightings.json", import.meta.url).pathname;

/** Sightings older than this are not returned. Decided with the owner. */
export const WINDOW_DAYS = 30;

/** Past this, a flag is shown but dimmed — it is old enough to doubt. */
export const FRESH_DAYS = 7;

const DAY_MS = 86400000;

let _cache = null;

function load() {
  if (_cache) return _cache;
  try {
    _cache = JSON.parse(fs.readFileSync(FILE, "utf-8"));
  } catch {
    _cache = {};
  }
  return _cache;
}

function persist() {
  try {
    fs.mkdirSync(path.dirname(FILE), { recursive: true });
    fs.writeFileSync(FILE, JSON.stringify(_cache));
  } catch (e) {
    // A write that fails silently is how data disappears on restart. Say so.
    console.warn(`[loadout] could not persist sightings: ${e.message}`);
  }
}

/**
 * Record what was seen on one player.
 *
 * Returns the stored row, or null when nothing was actually revealed — which
 * is the common case and not an error.
 */
export function record(playerId, defenderItems, observedBy, nowMs = Date.now()) {
  const id = String(Number(playerId) || 0);
  if (id === "0") return null;

  const sighting = readSighting(defenderItems);
  if (!sighting) return null;

  const row = {
    seenAt: Math.floor(nowMs / 1000),
    by: Number(observedBy) || null,
    ...classify(sighting),
    sighting,
  };
  load()[id] = row;
  persist();
  return row;
}

/** Whether a row is recent enough to report, and whether it is still fresh. */
export function age(row, nowMs = Date.now()) {
  const ageMs = nowMs - (row.seenAt || 0) * 1000;
  return {
    days: ageMs / DAY_MS,
    withinWindow: ageMs <= WINDOW_DAYS * DAY_MS,
    fresh: ageMs <= FRESH_DAYS * DAY_MS,
  };
}

/**
 * Flags for the given players, keyed by id.
 *
 * Only ids with a sighting inside the window appear. A caller asking about
 * ninety names and getting four back is the expected shape — absence means no
 * sighting, never "seen carrying nothing".
 */
export function flagsFor(ids, nowMs = Date.now()) {
  const db = load();
  const out = {};
  for (const raw of ids || []) {
    const id = String(Number(raw) || 0);
    const row = db[id];
    if (!row) continue;
    const a = age(row, nowMs);
    if (!a.withinWindow) continue;
    out[id] = {
      eod: !!row.eod, eodPieces: row.eodPieces || 0, eodFull: !!row.eodFull,
      eodNames: row.eodNames || [],
      redPrimary: !!row.redPrimary, primaryName: row.primaryName || null,
      seenAt: row.seenAt,
      ageDays: Math.round(a.days * 10) / 10,
      fresh: a.fresh,
    };
  }
  return out;
}

/**
 * How much of the database is worth anything yet.
 *
 * This is the number the whole feature waits on: if Torn reveals items rarely
 * enough that almost nobody carries a sighting, the display is decoration and
 * should not be built. Reported rather than guessed at.
 */
export function coverage(nowMs = Date.now()) {
  const db = load();
  const rows = Object.values(db);
  const inWindow = rows.filter((r) => age(r, nowMs).withinWindow);
  return {
    players: rows.length,
    inWindow: inWindow.length,
    fresh: inWindow.filter((r) => age(r, nowMs).fresh).length,
    withEod: inWindow.filter((r) => r.eod).length,
    withFullEod: inWindow.filter((r) => r.eodFull).length,
    withRedPrimary: inWindow.filter((r) => r.redPrimary).length,
    // Partial sightings are the norm, so knowing how complete they are says
    // how much to trust an absence of flags.
    fullLoadouts: inWindow.filter((r) => (r.sighting?.armour || []).length >= 5).length,
    observers: new Set(inWindow.map((r) => r.by).filter(Boolean)).size,
    oldestDays: inWindow.length
      ? Math.round(Math.max(...inWindow.map((r) => age(r, nowMs).days)) * 10) / 10 : null,
  };
}

/** Test seam: drop the in-process cache so a fixture file is re-read. */
export function _reset() { _cache = null; }
