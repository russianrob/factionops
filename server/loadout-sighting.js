// Reading a loadout sighting out of Torn's attack payload.
//
// Torn shows an opponent's equipped items only sometimes, and only during a
// fight. When it does, the page's attack data carries them at
// `defenderItems[slot].item[0]` with a name, a rarity and any bonuses. This
// turns that into a record, and a record into flags.
//
// THE SPLIT THAT MATTERS: the userscript captures raw facts — names, rarities,
// bonus titles — and the server decides what they mean. Userscript updates
// reach eighty-six people slowly and unevenly, so anything likely to need
// adjusting (what counts as EOD, whether a partial set counts, which rarities
// are interesting) belongs on this side, where changing it is a deploy rather
// than a campaign.

/** Torn's weapon slot keys, in the order a reader expects them. */
export const WEAPON_SLOTS = ["primary", "secondary", "melee", "temporary"];

/** Torn's armour slot keys. */
export const ARMOUR_SLOTS = ["helmet", "body_armor", "pants", "boots", "gloves"];

/**
 * EOD matched as a WORD.
 *
 * A substring test would flag a future item whose name merely contains those
 * three letters — "Neodymium" being the obvious one — and it would do so
 * silently, on somebody's profile, where nobody would think to question it.
 */
const EOD = /\bEOD\b/i;

function firstItem(container) {
  if (!container || !Array.isArray(container.item)) return null;
  const it = container.item[0];
  return it && typeof it === "object" ? it : null;
}

function bonusTitles(item) {
  const b = item && item.currentBonuses;
  if (!b || typeof b !== "object") return [];
  return Object.values(b)
    .map((x) => (x && typeof x === "object" ? String(x.title || "").trim() : ""))
    .filter(Boolean);
}

/**
 * What was visible, as facts rather than conclusions.
 *
 * Returns null when nothing was revealed. A PARTIAL loadout is still a
 * sighting: Torn reveals items inconsistently, and discarding half a loadout
 * would throw away most of what can ever be collected.
 */
export function readSighting(defenderItems) {
  if (!defenderItems || typeof defenderItems !== "object") return null;

  const weapons = [];
  for (const s of WEAPON_SLOTS) {
    const it = firstItem(defenderItems[s]);
    if (!it || !it.name) continue;
    weapons.push({
      slot: s,
      name: String(it.name),
      // Torn's casing is not a contract; compare on a normalised value.
      rarity: String(it.rarity || "").toLowerCase() || null,
      bonuses: bonusTitles(it),
    });
  }

  const armour = [];
  for (const s of ARMOUR_SLOTS) {
    const it = firstItem(defenderItems[s]);
    if (!it || !it.name) continue;
    armour.push({
      slot: s,
      name: String(it.name),
      rarity: String(it.rarity || "").toLowerCase() || null,
      bonuses: bonusTitles(it),
    });
  }

  if (!weapons.length && !armour.length) return null;
  return {
    primary: weapons.find((w) => w.slot === "primary") || null,
    weapons,
    armour,
  };
}

/**
 * Flags, from a sighting.
 *
 * `eod` and `eodFull` are kept apart deliberately. Two pieces is worth knowing
 * and is NOT the same claim as a full set; a flag that cannot tell them apart
 * will be trusted for the stronger one.
 *
 * `redPrimary` is about the PRIMARY only. A red melee is a different fact, and
 * folding it in would leave the flag meaning nothing in particular.
 */
export function classify(sighting) {
  const empty = {
    eod: false, eodPieces: 0, eodFull: false, eodNames: [],
    redPrimary: false, primaryName: null, primaryRarity: null,
  };
  if (!sighting) return empty;

  const eodNames = (sighting.armour || [])
    .filter((a) => EOD.test(a.name))
    .map((a) => a.name);

  const p = sighting.primary;
  return {
    eod: eodNames.length > 0,
    eodPieces: eodNames.length,
    eodFull: eodNames.length >= ARMOUR_SLOTS.length,
    eodNames,
    redPrimary: !!p && p.rarity === "red",
    primaryName: p ? p.name : null,
    primaryRarity: p ? p.rarity : null,
  };
}
