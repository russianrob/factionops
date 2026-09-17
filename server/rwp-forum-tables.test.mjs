// Pricing the weapon price-list TABLES people post on the forums.
//
// These are real tables in the post -- Weapon, Bonus, B %, Quality -- so every
// column RW Pricer needs is already there as text. No screenshot, no vision
// call, no cost. The only thing missing is the rarity, and the roll supplies
// that.
//
// The functions under test are lifted out of the shipping userscript and run
// against the real price feed, the same way rwp-refresh.js runs the script's
// own parser server-side: the point is to test what ships, not a copy of it.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const SRC = fs.readFileSync(new URL("./public/scripts/torn-rw-pricer.user.js", import.meta.url), "utf8");
const FEED = JSON.parse(fs.readFileSync(new URL("./data/rwp-prices.json", import.meta.url), "utf8"));

function fn(name) {
  const i = SRC.indexOf("function " + name + "(");
  assert.ok(i >= 0, "not in the shipping script: " + name);
  const o = SRC.indexOf("{", i);
  let d = 0;
  for (let j = o; j < SRC.length; j++) {
    if (SRC[j] === "{") d++;
    else if (SRC[j] === "}" && --d === 0) return SRC.slice(i, j + 1);
  }
  throw new Error("unbalanced braces in " + name);
}
function v(name) {
  const m = SRC.match(new RegExp("^[ \\t]*var[ \\t]+" + name + "[ \\t]*=.*$", "m"));
  assert.ok(m, "var not found: " + name);
  return m[0].trim();
}

const sandbox = { FEED };
vm.createContext(sandbox);
vm.runInContext([
  v("WEAPON_CLASS"),
  "var weaponPrices = FEED.weaponPrices, armourPrices = FEED.armourPrices || {};",
  "var bonusPrices = FEED.bonusPrices, armourBonusPrices = FEED.armourBonusPrices || {};",
  "var weaponComboPrices = FEED.weaponComboPrices, weaponPairComboPrices = FEED.weaponPairComboPrices;",
  "var classPrices = FEED.classPrices, weaponLevelPrices = FEED.weaponLevelPrices;",
  "var recentTables = FEED.recent || null;",
  "var KNOWN_WEAPONS = {}; Object.keys(WEAPON_CLASS).forEach(function(w){ KNOWN_WEAPONS[w.toLowerCase()] = w; });",
  "var ACTIVE = null;",
  SRC.slice(SRC.indexOf("var BONUS_ALIAS = {};"), SRC.indexOf("function resolveBonusName(")),
  fn("TBL"), fn("levelMedianOf"), fn("lookupWeapon"), fn("normalizeWeaponName"), fn("resolveBonusName"),
  fn("getMedianPrice"), fn("getWeaponComboMedian"), fn("pairKeyFor"), fn("getWeaponPairComboMedian"),
  fn("getWeaponLevelMedian"), fn("getWeaponLevelCount"), fn("getCombinedLevelValue"),
  fn("forumHeaderMap"), fn("forumRowItem"), fn("rarityFromRoll"), fn("priceForumRow"),
].join("\n"), sandbox, { timeout: 5000, filename: "rwp-forum-tables.js" });

const { forumHeaderMap, forumRowItem, rarityFromRoll, priceForumRow } = sandbox;

// The header of the table actually posted, including the columns past the fold.
const HEADER = ["Weapon", "Bonus", "B %", "Quality", "Price"];

test("the price-list columns are found by name", () => {
  const m = forumHeaderMap(HEADER);
  assert.equal(m.weapon, 0);
  assert.equal(m.bonus, 1);
  assert.equal(m.pct, 2);
});

test("column order is not assumed", () => {
  const m = forumHeaderMap(["Price", "B %", "Weapon", "Bonus"]);
  assert.equal(m.weapon, 2);
  assert.equal(m.bonus, 3);
  assert.equal(m.pct, 1);
});

test("an unrelated table is left alone", () => {
  // Forums are full of tables that are not price lists. Touching one would put
  // a price column on somebody's war roster.
  const m = forumHeaderMap(["Member", "Level", "Last action"]);
  assert.ok(m.weapon < 0 || m.bonus < 0, "must not claim a non-price-list table");
});

test("a plain row becomes an item", () => {
  const r = forumRowItem(["Beretta 92FS", "Expose", "9%", "146.4"], forumHeaderMap(HEADER));
  assert.equal(r.name, "Beretta 92FS");
  // JSON, not deepEqual: objects built inside the vm carry that realm's
  // prototype and strict deep equality rejects them on identity alone.
  assert.equal(JSON.stringify(r.bonuses), JSON.stringify([{ name: "Expose", level: 9 }]));
});

test("a two-bonus row is split on the slash", () => {
  // "Bleed/Stun" with "23%/22%" is one weapon carrying two bonuses, and pricing
  // it as a single 23% Bleed would miss what the second one is worth.
  const r = forumRowItem(["Benelli M4 Super", "Bleed/Stun", "23%/22%", "165.4"], forumHeaderMap(HEADER));
  assert.equal(r.name, "Benelli M4 Super");
  assert.equal(r.bonuses.length, 2);
  assert.equal(JSON.stringify(Array.from(r.bonuses).map((b) => b.name).sort()),
               JSON.stringify(["Bleed", "Stun"]));
  // Biggest roll leads: it is what the price is mostly about.
  assert.equal(r.bonuses[0].level, 23);
});

test("bonus spelling is normalised to the feed's", () => {
  // The table writes "Double Tap"; every price table says "Double-Tap". That
  // one hyphen was the only row of twelve that would not price.
  const r = forumRowItem(["Cobra Derringer", "Double Tap", "26%", "151.4"], forumHeaderMap(HEADER));
  assert.equal(r.bonuses[0].name, "Double-Tap");
});

test("rows that are not weapons are skipped", () => {
  const m = forumHeaderMap(HEADER);
  assert.equal(forumRowItem(["", "", "", ""], m), null);
  assert.equal(forumRowItem(["Beretta 92FS", "Nonsense Bonus", "9%", ""], m), null,
    "an unrecognised bonus is not guessed at");
  assert.equal(forumRowItem(["Beretta 92FS", "Expose", "", ""], m), null,
    "no roll, no row: the roll is what makes it priceable");
});

test("the roll names the rarity", () => {
  assert.equal(rarityFromRoll("Mag 7", "Expose", 8), "Yellow");
  assert.equal(rarityFromRoll("Mag 7", "Expose", 11), "Orange");
  assert.equal(rarityFromRoll("Mag 7", "Expose", 15), "Red");
  assert.equal(rarityFromRoll("Mag 7", "Expose", 99), null, "no rarity ever sold that roll");
});

test("a weapon spelled differently than the feed still resolves", () => {
  // The table writes "Armalite M-15A4"; the feed writes "ArmaLite" with a
  // capital L. Matching exactly would silently price nothing.
  const p = priceForumRow({ name: "Armalite M-15A4", bonuses: [{ name: "Conserve", level: 32 }] });
  assert.ok(p && p.value > 0, "expected a price");
  assert.equal(p.rarity, "Orange");
  assert.equal(p.inferred, true);
});

test("every row of the posted table prices", () => {
  const rows = [
    ["Armalite M-15A4", "Conserve", "32%"], ["Axe", "Plunder", "20%"],
    ["Benelli M4 Super", "Deadly", "6%"], ["Benelli M4 Super", "Bleed/Stun", "23%/22%"],
    ["Beretta 92FS", "Expose", "9%"], ["Beretta M9", "Deadeye", "33%"],
    ["BT MP9", "Revitalize", "14%"], ["Bushmaster Carbon 15", "Revitalize", "10%"],
    ["Bushmaster Carbon 15", "Specialist", "34%"], ["China Lake", "Stun", "12%"],
    ["Claymore Sword", "Parry", "60%"], ["Cobra Derringer", "Double Tap", "26%"],
    ["Diamond Bladed Knife", "Fury", "11%"],
  ];
  const m = forumHeaderMap(HEADER);
  const missed = [];
  for (const cells of rows) {
    const item = forumRowItem(cells, m);
    const p = item && priceForumRow(item);
    if (!p || !(p.value > 0)) missed.push(cells.join(" "));
  }
  assert.equal(JSON.stringify(missed), "[]", "rows that did not price: " + missed.join(" | "));
});

test("a price is never invented for a weapon with no sales", () => {
  const p = priceForumRow({ name: "Definitely Not A Weapon", bonuses: [{ name: "Expose", level: 9 }] });
  assert.equal(p, null);
});
