// Enemy loadouts for the pre-war report, sourced from KAL.
//
// KAL (kal-loadout-revealer, by Kalends [2032147]) runs a crowd-sourced
// loadout archive: members capture what they see on attack pages and KAL
// pools it. Warboard has its own equivalent in loadout-store.js, and that
// store is EMPTY — 0 players, 0 observers — so a display built on it would
// render nothing. This reads KAL's instead.
//
// LICENSING AND TERMS. The KAL userscript is All Rights Reserved, so none
// of its code is used here; this talks to the documented public API only.
// KAL's Terms name "an internal faction or faction-family ranked-war
// website" as an acceptable API consumer, provided it does not mirror or
// replace their own site — showing ten opponents inside a pre-war report
// does not. The conditions they attach are honoured deliberately:
//
//   "cache responses appropriately"  -> one call per faction per CACHE_TTL_MS
//   "respect rate limits"            -> their cap is 100/min per account;
//                                       a scout costs exactly one call
//   "do not overload the server"     -> failures are not retried in a loop
//
// The key must be a Torn API key REGISTERED WITH KAL — an ordinary Torn key
// returns is_registered:false and every read 401s. That is a person's
// action on kalends.dev, not something warboard can arrange.

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from "node:fs";
import { dirname, join as pathJoin } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CACHE_DIR = pathJoin(process.env.DATA_DIR || pathJoin(__dirname, "data"), "kal-cache");

const API_BASE = "https://api.kalends.dev";

/** How long a faction's loadouts stay fresh. Equipment changes between wars, not between refreshes. */
export const CACHE_TTL_MS = 30 * 60 * 1000;

/** How many opponents the report covers. */
export const TOP_N = 10;

/** KAL's bonus-roll tiers, hardest first. */
export const RARITY_ORDER = ["red", "orange", "yellow", "white", null];

/** Rolls worth putting in front of somebody planning a war. */
const NOTABLE = new Set(["red", "orange"]);

/**
 * The opponents worth pulling a loadout for.
 *
 * Ranked on BATTLE STATS, not on the threat sheet's war score. Score is
 * what they did in a war that has ended; bs is what they can do to us now,
 * and a returning member with huge stats and no war history is exactly who
 * we want the loadout for. Members with no stats sort last rather than
 * floating up on a null comparison.
 */
export function topThreats(rows, n = TOP_N) {
  return (rows || [])
    .filter(Boolean)
    .slice()
    .sort((a, b) => {
      const av = Number.isFinite(Number(a.bs)) ? Number(a.bs) : -1;
      const bv = Number.isFinite(Number(b.bs)) ? Number(b.bs) : -1;
      return bv - av;
    })
    .slice(0, n);
}

const rank = (r) => {
  const i = RARITY_ORDER.indexOf(r == null ? null : String(r).toLowerCase());
  return i === -1 ? RARITY_ORDER.length : i;
};

function pickSlot(equipment, slotName) {
  const hit = equipment.find(
    (e) => e && String(e.slot_name || "").toLowerCase() === slotName);
  if (!hit) return null;
  return { name: hit.name || null, rarity: hit.rarity || null, id: hit.id ?? null };
}

/**
 * One member's loadout, reduced to what a pre-war briefing can use.
 *
 * Returns null when KAL has never seen this player. That is NOT the same
 * as an empty loadout: rendering an unseen member as carrying nothing
 * reads as "safe to hit", which is the one wrong answer that gets
 * somebody killed. The caller must show unknown as unknown.
 */
export function summarise(loadout) {
  const equipment = loadout && Array.isArray(loadout.equipment) ? loadout.equipment : null;
  if (!equipment || equipment.length === 0) return null;

  const notable = [];
  for (const e of equipment) {
    for (const b of (e && Array.isArray(e.bonuses) ? e.bonuses : [])) {
      if (!b || !NOTABLE.has(String(b.rarity || "").toLowerCase())) continue;
      notable.push({
        title: b.title || null,
        value: b.value ?? null,
        rarity: String(b.rarity).toLowerCase(),
        on: (equipment.find((x) => x === e) || {}).name || null,
      });
    }
  }
  notable.sort((a, b) => rank(a.rarity) - rank(b.rarity));

  return {
    primary: pickSlot(equipment, "primary"),
    secondary: pickSlot(equipment, "secondary"),
    melee: pickSlot(equipment, "melee"),
    // Counted and named, not laid out piece by piece — five armour rows
    // per player across ten players is a data dump, not a briefing.
    armour: equipment
      .filter((e) => e && String(e.type || "").toLowerCase() === "armor")
      .map((e) => ({ name: e.name || null, rarity: e.rarity || null, slot: e.slot_name || null })),
    notable,
    observedAt: loadout.observed_at ?? null,
  };
}

/**
 * One player's loadout, from the faction packs ALREADY on disk.
 *
 * Never calls KAL. The mini-profile opens on hover, and a call per hover is
 * the opposite of the "cache responses appropriately" their terms ask for —
 * so this reads only what a pre-war scout has already fetched and stays
 * silent otherwise. During a war that is exactly the right coverage: every
 * enemy in the list is in the pack the scout pulled, in one call, for free.
 *
 * Returns null for a player with no pack and for a member whose pack holds
 * no sighting, which are different misses and look the same to a caller
 * that only wants a line of text.
 */
export function cachedLoadoutFor(playerId, nowMs = Date.now()) {
  const want = String(playerId);
  let files = [];
  try { files = readdirSync(CACHE_DIR).filter((f) => f.startsWith("faction-")); } catch { return null; }
  for (const f of files) {
    let pack;
    try { pack = JSON.parse(readFileSync(pathJoin(CACHE_DIR, f), "utf-8")); } catch { continue; }
    const hit = (pack.members || []).find((m) => String(m.user_id) === want);
    if (!hit) continue;
    const summary = summarise(hit.loadout);
    if (!summary) return null;              // in the pack, never seen
    return {
      factionId: f.replace(/^faction-|\.json$/g, ""),
      factionName: pack.factionName || null,
      name: hit.name || null,
      summary,
      packAgeMs: Math.max(0, nowMs - (pack.fetchedAt || 0)),
    };
  }
  return null;
}

function cacheFile(factionId) {
  try { mkdirSync(CACHE_DIR, { recursive: true }); } catch {}
  return pathJoin(CACHE_DIR, `faction-${String(factionId)}.json`);
}

/**
 * Every member of a faction with their latest recorded loadout.
 *
 * One call covers the whole roster, which is why the report can afford to
 * widen from five opponents to ten without costing anything extra.
 *
 * Returns { members, factionName, fetchedAt, cached, error }. An error is
 * REPORTED, never thrown: a scout that works is worth more than a scout
 * that 500s because a third party is down.
 */
export async function factionLoadouts(key, factionId, nowMs = Date.now()) {
  const file = cacheFile(factionId);
  let cached = null;
  try { if (existsSync(file)) cached = JSON.parse(readFileSync(file, "utf-8")); } catch {}
  if (cached && (nowMs - (cached.fetchedAt || 0)) < CACHE_TTL_MS) {
    return { ...cached, cached: true };
  }

  if (!key) return { members: [], error: "no-key", cached: false, fetchedAt: 0 };

  try {
    const res = await fetch(`${API_BASE}/faction/${encodeURIComponent(factionId)}/loadouts`, {
      headers: { Authorization: `ApiKey ${key}` },
    });
    if (!res.ok) {
      // Serve stale rather than nothing — a fortnight-old loadout still
      // beats no loadout, and it stops a KAL outage emptying the report.
      const why = res.status === 401 || res.status === 403 ? "key-not-registered" : `http-${res.status}`;
      if (cached) return { ...cached, cached: true, error: why };
      return { members: [], error: why, cached: false, fetchedAt: 0 };
    }
    const body = await res.json();
    const out = {
      factionName: body.name || null,
      membersObservedAt: body.members_observed_at || null,
      members: Array.isArray(body.members) ? body.members : [],
      fetchedAt: nowMs,
    };
    try { writeFileSync(file, JSON.stringify(out)); } catch (e) {
      console.warn(`[kal] cache write failed: ${e.message}`);
    }
    return { ...out, cached: false };
  } catch (e) {
    if (cached) return { ...cached, cached: true, error: e.message };
    return { members: [], error: e.message, cached: false, fetchedAt: 0 };
  }
}

/** Whether a key is registered with KAL. One call, used to explain setup failures. */
export async function checkKey(key) {
  if (!key) return { registered: false, reason: "no key set" };
  try {
    const res = await fetch(`${API_BASE}/check-key`, { headers: { Authorization: `ApiKey ${key}` } });
    const body = await res.json().catch(() => null);
    return { registered: !!(body && body.is_registered), status: res.status };
  } catch (e) {
    return { registered: false, reason: e.message };
  }
}
