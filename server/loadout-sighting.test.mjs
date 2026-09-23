// Reading a loadout sighting out of Torn's attack payload.
//
// The script captures RAW FACTS — item names, rarities, bonus titles — and the
// server decides what they mean. That split is deliberate: userscript updates
// reach people slowly and unevenly, so anything likely to need adjusting (what
// counts as EOD, whether a partial set counts, which rarities matter) has to
// live where it can be changed without asking eighty-six people to update.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  readSighting, classify, ARMOUR_SLOTS, WEAPON_SLOTS,
} from "./loadout-sighting.js";

/** Torn's shape: defenderItems[slot].item[0] */
const slot = (name, over = {}) => ({ item: [{ name, rarity: "yellow", ...over }] });

const full = (over = {}) => ({
  primary: slot("Steyr AUG", { rarity: "red" }),
  helmet: slot("EOD Helmet"),
  body_armor: slot("EOD Body Armor"),
  pants: slot("EOD Pants"),
  boots: slot("EOD Boots"),
  gloves: slot("EOD Gloves"),
  ...over,
});

// ── reading ────────────────────────────────────────────────────

test("reads the primary weapon's name and rarity", () => {
  const s = readSighting(full());
  assert.equal(s.primary.name, "Steyr AUG");
  assert.equal(s.primary.rarity, "red");
});

test("reads every armour slot it finds", () => {
  const s = readSighting(full());
  assert.equal(s.armour.length, 5);
  assert.deepEqual(s.armour.map((a) => a.slot).sort(), ARMOUR_SLOTS.slice().sort());
});

test("a partly revealed loadout is still a sighting", () => {
  // Torn reveals items inconsistently. Half a loadout is real evidence and
  // discarding it would throw away most of what we can ever collect.
  const s = readSighting({ helmet: slot("EOD Helmet"), boots: slot("EOD Boots") });
  assert.equal(s.armour.length, 2);
  assert.equal(s.primary, null);
});

test("nothing revealed is not a sighting", () => {
  assert.equal(readSighting({}), null);
  assert.equal(readSighting(null), null);
  assert.equal(readSighting({ primary: { item: [] } }), null);
});

test("rarity is normalised, because Torn's casing is not a contract", () => {
  const s = readSighting({ primary: slot("Steyr AUG", { rarity: "RED" }) });
  assert.equal(s.primary.rarity, "red");
});

test("bonus titles ride along for slots that have them", () => {
  const s = readSighting({
    body_armor: slot("EOD Body Armor", { currentBonuses: { 0: { title: "Impenetrable", value: 10 } } }),
  });
  assert.deepEqual(s.armour[0].bonuses, ["Impenetrable"]);
});

test("weapon slots other than primary are recorded but not confused with it", () => {
  const s = readSighting({
    primary: slot("Steyr AUG", { rarity: "red" }),
    melee: slot("Kodachi", { rarity: "red" }),
  });
  assert.equal(s.primary.name, "Steyr AUG");
  assert.equal(s.weapons.length, 2);
  assert.ok(WEAPON_SLOTS.includes("melee"));
});

// ── classifying ────────────────────────────────────────────────

test("a full EOD set is flagged, and counted", () => {
  const c = classify(readSighting(full()));
  assert.equal(c.eod, true);
  assert.equal(c.eodPieces, 5);
  assert.equal(c.eodFull, true);
});

test("a partial EOD set is flagged but not called full", () => {
  // Two pieces is worth knowing and is NOT the same claim as a full set. A
  // flag that cannot tell them apart will be trusted for the wrong one.
  const c = classify(readSighting({
    helmet: slot("EOD Helmet"), boots: slot("EOD Boots"), pants: slot("Dune Pants"),
  }));
  assert.equal(c.eod, true);
  assert.equal(c.eodPieces, 2);
  assert.equal(c.eodFull, false);
});

test("a non-EOD set is not flagged", () => {
  const c = classify(readSighting({
    helmet: slot("Dune Helmet"), body_armor: slot("Dune Body Armor"),
  }));
  assert.equal(c.eod, false);
  assert.equal(c.eodPieces, 0);
});

test("EOD is matched as a word, not a substring", () => {
  // The failure this rules out: a future item whose name merely contains those
  // three letters quietly flagging everyone who wears it.
  const c = classify(readSighting({ helmet: slot("Neodymium Helm") }));
  assert.equal(c.eod, false, "matched EOD inside another word");
});

test("a red primary is flagged; a red melee is not", () => {
  // The question is what they shoot with. A red melee is a different fact and
  // conflating them makes the flag mean nothing in particular.
  assert.equal(classify(readSighting({ primary: slot("Steyr AUG", { rarity: "red" }) })).redPrimary, true);
  assert.equal(classify(readSighting({ melee: slot("Kodachi", { rarity: "red" }) })).redPrimary, false);
});

test("a yellow or orange primary is not a red one", () => {
  for (const r of ["yellow", "orange", "", null]) {
    assert.equal(classify(readSighting({ primary: slot("Steyr AUG", { rarity: r }) })).redPrimary, false, `rarity ${r}`);
  }
});

test("classifying nothing yields no flags rather than throwing", () => {
  const c = classify(null);
  assert.equal(c.eod, false);
  assert.equal(c.redPrimary, false);
});

test("the classification carries what it was based on", () => {
  // A flag nobody can interrogate gets ignored or believed too readily. The
  // names behind it let the UI explain itself.
  const c = classify(readSighting(full()));
  assert.equal(c.primaryName, "Steyr AUG");
  assert.ok(c.eodNames.includes("EOD Helmet"));
});
