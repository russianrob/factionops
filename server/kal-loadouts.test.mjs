import { test } from "node:test";
import assert from "node:assert/strict";
import { topThreats, summarise, RARITY_ORDER } from "./kal-loadouts.js";

const row = (o) => ({ id: 1, name: "X", score: 0, attacks: 0, bs: null, band: "unknown", farming: false, ...o });

// ── who we ask about ───────────────────────────────────────────────────
// KAL's faction endpoint returns the WHOLE roster in one call, so picking
// is about what we render, not what we fetch — but rendering 90 loadouts
// is not a report, it is a data dump.

test("picks the hardest hitters, by present battle stats", () => {
  const rows = [
    row({ id: 1, bs: 100, band: "light" }),
    row({ id: 2, bs: 900, band: "heavy" }),
    row({ id: 3, bs: 500, band: "mid" }),
  ];
  assert.deepEqual(topThreats(rows, 2).map((r) => r.id), [2, 3]);
});

test("ranks on bs, not on past-war score", () => {
  // score is what they did in a war that is over; bs is what they can do
  // to us now. A returning member with huge stats and no war history is
  // exactly who we want a loadout for.
  const rows = [
    row({ id: 1, bs: 100, score: 9999 }),
    row({ id: 2, bs: 900, score: 0 }),
  ];
  assert.deepEqual(topThreats(rows, 1).map((r) => r.id), [2]);
});

test("members with no stats never outrank members with stats", () => {
  const rows = [row({ id: 1, bs: null }), row({ id: 2, bs: 1 })];
  assert.deepEqual(topThreats(rows, 2).map((r) => r.id), [2, 1]);
});

test("ten by default — the people you actually plan around", () => {
  const rows = Array.from({ length: 30 }, (_, i) => row({ id: i, bs: i * 10 }));
  const top = topThreats(rows);
  assert.equal(top.length, 10);
  assert.equal(top[0].id, 29, "hardest first");
  assert.equal(top[9].id, 20);
});

test("asking for more than exist returns what there is", () => {
  assert.equal(topThreats([row({ id: 1, bs: 5 })], 5).length, 1);
  assert.deepEqual(topThreats([], 5), []);
  assert.deepEqual(topThreats(null, 5), []);
});

// ── what we show about them ────────────────────────────────────────────

const eq = (o) => ({ id: 1, name: "Item", type: "Weapon", rarity: null, slot: 1,
                     slot_name: null, bonuses: [], mods: [], ...o });

test("names the weapon in each hand", () => {
  const s = summarise({ equipment: [
    eq({ slot_name: "Primary", name: "ArmaLite M-15A4" }),
    eq({ slot_name: "Secondary", name: "Taser" }),
    eq({ slot_name: "Melee", name: "Ice Pick" }),
  ]});
  assert.equal(s.primary.name, "ArmaLite M-15A4");
  assert.equal(s.secondary.name, "Taser");
  assert.equal(s.melee.name, "Ice Pick");
});

test("carries the ranked rarity, which is the whole point of looking", () => {
  const s = summarise({ equipment: [eq({ slot_name: "Primary", name: "SIG 552", rarity: "red" })] });
  assert.equal(s.primary.rarity, "red");
});

test("surfaces only the bonus rolls worth knowing about", () => {
  // A yellow roll is noise on a report about five people. Red and orange
  // change how you attack them.
  const s = summarise({ equipment: [eq({
    slot_name: "Primary", name: "SIG 552",
    bonuses: [
      { title: "Penetrate", value: 38, rarity: "red" },
      { title: "Empower", value: 4, rarity: "yellow" },
      { title: "Deadeye", value: 20, rarity: "orange" },
    ],
  })]});
  assert.deepEqual(s.notable.map((b) => b.title), ["Penetrate", "Deadeye"]);
});

test("notable bonuses are ordered by rarity, hardest first", () => {
  const s = summarise({ equipment: [eq({
    slot_name: "Primary",
    bonuses: [{ title: "A", rarity: "orange" }, { title: "B", rarity: "red" }],
  })]});
  assert.deepEqual(s.notable.map((b) => b.title), ["B", "A"]);
  assert.ok(RARITY_ORDER.indexOf("red") < RARITY_ORDER.indexOf("orange"));
});

test("counts armour rather than listing five pieces", () => {
  const s = summarise({ equipment: [
    eq({ type: "Armor", slot_name: "Helmet", name: "EOD Helmet" }),
    eq({ type: "Armor", slot_name: "Body", name: "EOD Body Armor" }),
    eq({ slot_name: "Primary", name: "Gun" }),
  ]});
  assert.equal(s.armour.length, 2);
  assert.ok(s.armour.some((a) => a.name === "EOD Helmet"));
});

test("a member KAL has never seen is reported as unknown, not as unarmed", () => {
  // loadout=null means nobody has captured them. Rendering that as an
  // empty loadout would read as "they carry nothing", which is a lie that
  // gets someone killed.
  assert.equal(summarise(null), null);
  assert.equal(summarise({ equipment: [] }), null);
});

test("an odd shape yields nothing rather than throwing mid-report", () => {
  assert.equal(summarise({}), null);
  assert.equal(summarise({ equipment: null }), null);
  const s = summarise({ equipment: [eq({ slot_name: null, name: null })] });
  assert.ok(s === null || typeof s === "object");
});
