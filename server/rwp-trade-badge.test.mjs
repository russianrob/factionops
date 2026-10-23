// One gun, one price: a trade counts an RW weapon at its badge's price.
//
// An Orange Bushmaster Carbon 15 with 14% Revitalize and 26% Conserve was
// badged $3,574,795,103 and counted in a trade at $3,193,164,535. The trade
// priced it with the forum ladder, which reads the more valuable bonus alone
// at its roll, so the Conserve and the gun's own earlier sale never came into
// it. Both now price with the badge's estimator, estimateItemPrice.
//
// The badge figure here is worked out the way injectPriceTags works it out:
// its table choice, the colour median, the estimator, then what the badge
// shows. The trade figure is tradeRwValue's, on a row whose info icon
// carries the bonuses the way Torn renders them. The tables are built by
// hand so the figures stay put; the live feed changes every day.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const SRC = fs.readFileSync(process.env.RWP_SRC || new URL("./public/scripts/torn-rw-pricer.user.js", import.meta.url), "utf8");

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
// Pieces only a build with the shared estimator has. A build without them
// still loads, so the tests show it failing rather than erroring.
const fnIfAny = (name) => (SRC.includes("function " + name + "(") ? fn(name) : "");
// Objects made inside a vm belong to another realm; compare them as data.
const plain = (x) => (x === undefined ? x : JSON.parse(JSON.stringify(x)));

// Which table set an item reads, as injectPriceTags chooses it.
const ACTIVE_LINE = "ACTIVE = (weaponKey && recentTables && bonuses.length === 1) ? recentTables : null;";
function tableChoice() {
  const m = fn("injectPriceTags").match(/^[ \t]*ACTIVE = .*$/m);
  assert.ok(m, "injectPriceTags no longer chooses the tables");
  return m[0].trim();
}
// The estimator as injectPriceTags runs it: its call to estimateItemPrice,
// or in a build from before that function, the block between the two
// comments that bracket it.
function estimatorStep() {
  const call = fn("injectPriceTags").match(/^[ \t]*var est = estimateItemPrice\(.*\);\n[ \t]*var bonusColors = est\.bonusColors.*;$/m);
  if (call) return call[0];
  const a = SRC.indexOf("// Determine bonus color tier for each bonus");
  const b = SRC.indexOf("// Gather full price arrays for tooltip");
  assert.ok(a > 0 && b > a, "the estimator in injectPriceTags has moved");
  return SRC.slice(a, b);
}

// Everything tradeRwValue reaches, over a hand-built feed, plus badge() and
// armourBadge(): an item priced as injectPriceTags prices it. Strict, as the
// script is.
function trader(feed) {
  const box = { FEED: feed };
  vm.createContext(box);
  vm.runInContext([
    "'use strict';",
    v("WEAPON_CLASS"), v("ARMOUR_SET"), v("COMBO_MIN_SAMPLES"), v("LEVEL_MIN_SAMPLES"), v("RARITY_WORD"),
    "var weaponPrices = FEED.weaponPrices || {}, bonusPrices = FEED.bonusPrices || {}, classPrices = FEED.classPrices || {};",
    "var weaponComboPrices = FEED.comboPrices || {}, weaponPairComboPrices = FEED.pairComboPrices || {};",
    "var weaponLevelPrices = FEED.levelPrices || {}, recentTables = FEED.recent || null, ACTIVE = null;",
    "var weaponExactPrices = FEED.exactPrices || {};",
    "var armourPrices = FEED.armourPrices || {}, armourComboPrices = FEED.armourComboPrices || {};",
    "var armourBonusPrices = FEED.armourBonusPrices || {}, armourSetPrices = FEED.armourSetPrices || {};",
    "var ITEM_ALIASES = {};",
    "var KNOWN_WEAPONS = {}; Object.keys(WEAPON_CLASS).forEach(function (w) { KNOWN_WEAPONS[w.toLowerCase()] = w; });",
    fn("flattenName"),
    "var FLAT_WEAPONS = {}; Object.keys(WEAPON_CLASS).forEach(function (w) { FLAT_WEAPONS[flattenName(w)] = w; });",
    SRC.slice(SRC.indexOf("var BONUS_ALIAS = {};"), SRC.indexOf("function resolveBonusName(")),
    // Which colour's cross-weapon bonus median to read. As in the other
    // estimator tests, each bonus is read at the item's own colour.
    "function getBonusColorByName() { return null; }",
    fn("TBL"), fn("levelMedianOf"), fn("lookupWeapon"), fn("normalizeWeaponName"), fn("resolveBonusName"),
    fn("getMedianPrice"), fn("getBonusMedian"),
    fn("getWeaponComboMedian"), fn("getWeaponComboThinArray"), fn("getWeaponComboPriceArray"),
    fn("pairKeyFor"), fn("getWeaponPairComboMedian"), fn("getWeaponPairComboArray"),
    fn("getWeaponLevelMedian"), fn("getWeaponLevelCount"), fn("getCombinedLevelValue"),
    fn("getPriceArray"), fn("getBonusPriceArray"), fn("getWeaponExactGun"), fn("monthYearOfDay"),
    fn("getArmourMedianPrice"), fn("getArmourComboMedian"), fn("getArmourBonusMedian"),
    fn("getArmourPriceArray"), fn("getArmourBonusPriceArray"), fn("getArmourComboPriceArray"),
    fn("rarityFromRoll"), fn("forumBonusWorth"), fn("priceForumRow"),
    fn("parseTradeBonusTitle"), fn("tradeRwValue"),
    fnIfAny("estimateItemPrice"), fnIfAny("badgePriceFor"),
    "function badge(weaponKey, rarity, bonuses) {",
    "  var armourKey = null;",
    "  " + tableChoice(),
    "  var median = getMedianPrice(weaponKey, rarity), bonusFn = getBonusMedian;",
    "  if (!median) return null;",
    "  var itemKey = weaponKey, comboFn = getWeaponComboMedian;",
    estimatorStep(),
    "  return { shown: estimatedPrice || median, est: estimatedPrice, source: estSource, median: median };",
    "}",
    "function armourBadge(armourKey, rarity, bonuses) {",
    "  var weaponKey = null;",
    "  " + tableChoice(),
    "  var median = getArmourMedianPrice(armourKey, rarity), bonusFn = getArmourBonusMedian;",
    "  var itemKey = armourKey, comboFn = getArmourComboMedian;",
    estimatorStep(),
    "  return { est: estimatedPrice, source: estSource, deriv: deriv, colors: bonusColors, median: median };",
    "}",
  ].join("\n"), box, { filename: "rwp-trade-badge.js" });
  return box;
}

// A trade row, as tradeRwValue reads it: the info icon's title is all it uses.
const row = (title) => ({
  querySelector: (sel) => (sel.indexOf("networth-info-icon") >= 0 ? { getAttribute: () => title } : null),
});
// Torn's info-icon title for a weapon: a block per bonus with its roll, then
// the stats, the last of them the quality and the colour.
function icon(bonuses, colour) {
  return bonuses.map((b) => "<div class='t-overflow'><i class='bonus-attachment-" + b.name.toLowerCase() + "'></i><b>" +
    b.name + "</b><br/>" + b.level + "% chance of an effect</div>").join("") +
    "<div><ul class='bonus-tooltip clearfix'><li><i class='bonus-attachment-item-damage-bonus'></i><span>60.00</span></li>" +
    (colour ? "<li><i class='bonus-attachment-item-rarity-bonus'></i><span>150.00% " + colour.toLowerCase() + "</span></li>" : "") +
    "</ul></div>";
}

const GUN = "Bushmaster Carbon 15";
const REVIT = (level) => ({ name: "Revitalize", level });
const OWNER_BONUSES = [REVIT(14), { name: "Conserve", level: 26 }];
const copy = (bonuses) => bonuses.map((b) => ({ ...b }));

// The owner's gun with the tables the live feed has for it: Orange
// Bushmasters at a $200M median over 647 sales; 14% Revitalize alone at
// $3.19B over 4; at any roll, Revitalize at $3.00B and Conserve at $48.5M;
// and this gun sold once before, for $4.00B in Aug 2025. No pair comp.
const OWNER = () => ({
  bonusPrices: { Revitalize: {}, Conserve: {} },
  weaponPrices: { [GUN]: { Orange: [61800001, 200000001, 10574554640, 647] } },
  comboPrices: {
    [GUN + "|Conserve"]: { Orange: [30000001, 48475009, 70000001, 59] },
    [GUN + "|Revitalize"]: { Orange: [1500000000, 3000000000, 6000000000, 40] },
  },
  levelPrices: { [GUN + "|Revitalize"]: { Orange: { 13: [1888888889, 11], 14: [3193164535, 4], 15: [5244891468, 6] } } },
  exactPrices: { [GUN + "|Conserve+Revitalize"]: { Orange: { "26+14": [4002036189, 1, 20323] } } },
});
// One bonus at a roll with no sale of its own, and last year's tables lower
// than every year's. Conserve has never sold on this gun at all.
const SINGLE = () => ({
  bonusPrices: { Revitalize: {}, Conserve: {} },
  weaponPrices: { [GUN]: { Orange: [61800001, 200000001, 10574554640, 647] } },
  comboPrices: { [GUN + "|Revitalize"]: { Orange: [1500000000, 3000000000, 6000000000, 40] } },
  levelPrices: { [GUN + "|Revitalize"]: { Orange: { 12: [1500000000, 9], 13: [1888888889, 11], 15: [5244891468, 6], 16: [6000000000, 5] } } },
  recent: {
    weaponPrices: { [GUN]: { Orange: [50000001, 180000001, 9000000000, 300] } },
    comboPrices: { [GUN + "|Revitalize"]: { Orange: [1200000000, 2600000000, 5000000000, 20] } },
    levelPrices: { [GUN + "|Revitalize"]: { Orange: { 12: [1300000000, 5], 13: [1700000000, 6], 15: [4800000000, 4], 16: [5500000000, 3] } } },
  },
});

// ── The estimator, shared ──────────────────────────────────────

test("the badge's estimator is a function of the item alone", () => {
  const t = trader(OWNER());
  const r = t.estimateItemPrice(GUN, GUN, "Orange", copy(OWNER_BONUSES), 200000001, t.getWeaponComboMedian, t.getBonusMedian);
  assert.equal(r.price, 3574795103);
  assert.equal(r.source, "exact %");
  assert.deepEqual(plain(r.bonusColors), { Revitalize: "Orange", Conserve: "Orange" });
  assert.deepEqual(plain(r.deriv.at(-1)),
    { label: "blended with this exact gun", amt: 4002036189, src: "50% this gun, last sold Aug 2025", n: 1, prem: false });
});

test("injectPriceTags prices through that function, with no copy of its own", () => {
  const body = fn("injectPriceTags");
  assert.ok(body.includes("estimateItemPrice(weaponKey, itemKey, rarity, bonuses, median, comboFn, bonusFn)"),
    "the badge does not call estimateItemPrice with its item");
  assert.ok(!body.includes("// Determine bonus color tier for each bonus"), "the estimator is still inline");
});

test("an armour piece prices exactly as before", () => {
  // The figures the estimator gave while it was inline in injectPriceTags.
  // Armour goes through it with no weapon, the armour's own name as the
  // item, and the armour lookups.
  const HELMET = "Sentinel Helmet";
  const t = trader({
    armourPrices: { [HELMET]: { Orange: [900000000, 1400000001, 3000000000, 80] } },
    armourComboPrices: { [HELMET + "|Impregnable"]: { Orange: [1500000000, 2100000000, 4000000000, 12] } },
    armourBonusPrices: {
      Impregnable: { Orange: [800000000, 1800000000, 3500000000, 40] },
      Impenetrable: { Orange: [100000000, 300000000, 900000000, 25] },
    },
  });
  const IMPREG = { name: "Impregnable", level: 24 }, IMPEN = { name: "Impenetrable", level: 20 };
  const impregLine = { label: "Impregnable 24%", amt: 2100000000, src: "combo", n: 12, prem: false };
  assert.deepEqual(plain(t.armourBadge(HELMET, "Orange", [IMPREG])),
    { est: 2100000000, source: "combo", deriv: [impregLine], colors: { Impregnable: "Orange" }, median: 1400000001 });
  assert.deepEqual(plain(t.armourBadge(HELMET, "Orange", [IMPEN])),
    { est: 900000000, source: "weapon floor", colors: { Impenetrable: "Orange" }, median: 1400000001,
      deriv: [{ label: "Impenetrable 20%", amt: 900000000, src: "weapon floor", n: 80, prem: false }] });
  assert.deepEqual(plain(t.armourBadge(HELMET, "Orange", [IMPREG, IMPEN])),
    { est: 2100000000, source: "combo", colors: { Impregnable: "Orange", Impenetrable: "Orange" }, median: 1400000001,
      deriv: [impregLine, { label: "Impenetrable 20%", amt: 0, src: "weapon floor", n: 80, prem: true, raw: 900000000, floor: 900000000 }] });
});

// ── The trade counts the badge's price ─────────────────────────

test("the owner's gun counts in a trade at its badge's price", () => {
  const t = trader(OWNER());
  assert.equal(t.badge(GUN, "Orange", copy(OWNER_BONUSES)).shown, 3574795103);
  assert.equal(t.tradeRwValue(row(icon(OWNER_BONUSES, "Orange")), GUN), 3574795103,
    "the forum ladder says $3,193,164,535, the 14% Revitalize alone");
});

test("a two-bonus gun whose pair never sold is priced as the badge builds it, not by its lead bonus", () => {
  // Both bonuses sold at other rolls only, and the pair never: the badge
  // builds it from the two and blends in the colour median.
  const feed = OWNER();
  delete feed.levelPrices;
  delete feed.exactPrices;
  feed.comboPrices[GUN + "|Conserve"].Orange = [900000000, 1500000000, 2500000000, 59];
  const t = trader(feed);
  assert.equal(t.badge(GUN, "Orange", copy(OWNER_BONUSES)).shown, 2885503405);
  assert.equal(t.tradeRwValue(row(icon(OWNER_BONUSES, "Orange")), GUN), 2885503405,
    "the lead bonus alone is $3.00B");
});

test("a one-bonus gun reads last year's tables, as its badge does", () => {
  const t = trader(SINGLE());
  assert.equal(t.badge(GUN, "Orange", [REVIT(14)]).shown, 2600000000);
  assert.equal(t.tradeRwValue(row(icon([REVIT(14)], "Orange")), GUN), 2600000000,
    "every year's tables give $3.00B, the forum ladder $3.25B");
});

test("a one-bonus gun whose bonus never sold counts at last year's colour median, as its badge does", () => {
  // With no sale of Conserve on this gun at any roll, the badge falls back to
  // the colour median: last year's, for a gun with one bonus.
  const t = trader(SINGLE());
  const conserve = [{ name: "Conserve", level: 26 }];
  assert.equal(t.badge(GUN, "Orange", copy(conserve)).shown, 180000001);
  assert.equal(t.tradeRwValue(row(icon(conserve, "Orange")), GUN), 180000001, "every year's median is $200,000,001");
});

test("a gun whose badge shows a range counts at the badge's estimate, the low end", () => {
  // Specialist has never sold on a Red ArmaLite, and what it fetches on
  // other weapons is under this one's floor. The badge reads the floor and
  // shows $2.03B to $6.49B; a trade row has room for one number.
  const ARMALITE = "ArmaLite M-15A4";
  const t = trader({
    bonusPrices: { Specialist: { Red: [10000000, 50000000, 100000000, 30] } },
    weaponPrices: { [ARMALITE]: { Red: [2030000000, 6490000000, 20000000000, 40] } },
  });
  const b = t.badge(ARMALITE, "Red", [{ name: "Specialist", level: 41 }]);
  assert.equal(b.source, "weapon floor");
  assert.equal(b.est, 2030000000);
  assert.equal(b.median, 6490000000);
  assert.equal(t.tradeRwValue(row(icon([{ name: "Specialist", level: 41 }], "Red")), ARMALITE), 2030000000,
    "the forum ladder says $6.49B, the colour median");
});

test("the badge shows its estimate, or the colour median when the estimate comes to nothing", () => {
  // badge() above restates this rule; this holds it to createBadge.
  assert.match(fn("createBadge"), /var displayPrice = estimatedPrice \|\| median;/);
  // One sale of 14% Revitalize, recorded at $0: the estimate is 0.
  const t = trader({
    bonusPrices: { Revitalize: {} },
    weaponPrices: { [GUN]: { Orange: [61800001, 200000001, 10574554640, 647] } },
    comboPrices: { [GUN + "|Revitalize"]: { Orange: [0, 0, 0, 1] } },
  });
  assert.equal(t.badge(GUN, "Orange", [REVIT(14)]).est, 0);
  assert.equal(t.badgePriceFor(GUN, "Orange", [REVIT(14)]), 200000001);
});

// ── Where the badge has nothing to say ─────────────────────────

test("with no colour on the icon, the forum ladder prices it as before", () => {
  const t = trader(OWNER());
  const title = icon(OWNER_BONUSES, null);
  assert.equal(t.parseTradeBonusTitle(title).rarity, null);
  // The ladder works the colour out from the 14% Revitalize: only Orange has sold at 14%.
  assert.equal(t.priceForumRow({ name: GUN, rarity: null, bonuses: copy(OWNER_BONUSES) }).value, 3193164535);
  assert.equal(t.tradeRwValue(row(title), GUN), 3193164535);
});

test("with no colour median for the weapon, the forum ladder prices it as before", () => {
  // 14% Revitalize has sold on Orange Bushmasters, but the gun has no Orange
  // median and no class one: the badge shows nothing.
  const t = trader({
    bonusPrices: { Revitalize: {} },
    weaponPrices: { [GUN]: { Yellow: [1000000, 5000000, 9000000, 50] } },
    levelPrices: { [GUN + "|Revitalize"]: { Orange: { 14: [3193164535, 4] } } },
  });
  assert.equal(t.badge(GUN, "Orange", [REVIT(14)]), null);
  assert.equal(t.tradeRwValue(row(icon([REVIT(14)], "Orange")), GUN), 3193164535);
});

test("armour, and a name that is no weapon, claim nothing", () => {
  const t = trader(OWNER());
  assert.equal(t.tradeRwValue(row(icon(OWNER_BONUSES, "Orange")), "Sentinel Helmet"), 0);
  assert.equal(t.tradeRwValue(row(icon(OWNER_BONUSES, "Orange")), "Not A Weapon"), 0);
});

// ── The table choice ───────────────────────────────────────────

test("pricing a trade row leaves the table choice as it found it", () => {
  const t = trader(SINGLE());
  const left = {};
  t.ACTIVE = left;
  t.tradeRwValue(row(icon([REVIT(14)], "Orange")), GUN);
  assert.equal(t.ACTIVE, left);
});

test("a choice left over from the page's last badge does not reach the trade", () => {
  // injectPriceTags leaves the choice set for the last item it priced. Last
  // year's tables, left there by a one-bonus badge, must not price a
  // two-bonus gun in the trade.
  const feed = OWNER();
  feed.recent = {
    weaponPrices: { [GUN]: { Orange: [50000001, 150000001, 9000000000, 300] } },
    comboPrices: {
      [GUN + "|Conserve"]: { Orange: [20000001, 30000001, 60000001, 25] },
      [GUN + "|Revitalize"]: { Orange: [1200000000, 2500000000, 5000000000, 20] },
    },
    levelPrices: { [GUN + "|Revitalize"]: { Orange: { 14: [2500000000, 3] } } },
  };
  const t = trader(feed);
  t.ACTIVE = t.recentTables;
  assert.equal(t.tradeRwValue(row(icon(OWNER_BONUSES, "Orange")), GUN), 3574795103,
    "read from last year's tables it is $3,163,082,432");
});

test("a choice left over from a two-bonus badge does not reach a one-bonus trade row", () => {
  // The other way round: a two-bonus badge leaves every year's tables
  // chosen. A one-bonus gun whose bonus never sold counts at last year's
  // colour median, so a median read under the leftover choice would show.
  const t = trader(SINGLE());
  t.badge(GUN, "Orange", copy(OWNER_BONUSES));
  assert.equal(t.ACTIVE, null);
  assert.equal(t.tradeRwValue(row(icon([{ name: "Conserve", level: 26 }], "Orange")), GUN), 180000001,
    "read under every year's tables it is $200,000,001");
});

test("the table choice is written the same in the badge loop and the trade's helper", () => {
  assert.equal(SRC.split(ACTIVE_LINE).length - 1, 2, "chosen this way exactly twice");
  assert.ok(fn("injectPriceTags").includes(ACTIVE_LINE));
  assert.ok(fn("badgePriceFor").includes(ACTIVE_LINE));
});

// ── What else a trade row can carry ────────────────────────────

test("the order Torn lists the two bonuses in does not change the price", () => {
  const t = trader(OWNER());
  assert.equal(t.tradeRwValue(row(icon([OWNER_BONUSES[1], OWNER_BONUSES[0]], "Orange")), GUN), 3574795103);
});

test("a name written with other punctuation is the same gun", () => {
  const t = trader(OWNER());
  assert.equal(t.tradeRwValue(row(icon(OWNER_BONUSES, "Orange")), "Bushmaster Carbon-15"), 3574795103);
});

test("after a cached load with no last-year tables, a one-bonus gun still matches its badge", () => {
  const feed = SINGLE();
  delete feed.recent;
  const t = trader(feed);
  assert.equal(t.badge(GUN, "Orange", [REVIT(14)]).shown, 3000000000);
  assert.equal(t.tradeRwValue(row(icon([REVIT(14)], "Orange")), GUN), 3000000000,
    "the forum ladder says $3,566,890,179");
});

test("on a feed cached before the exact-gun table, the trade still matches the badge", () => {
  const feed = OWNER();
  delete feed.exactPrices;
  const t = trader(feed);
  assert.equal(t.badge(GUN, "Orange", copy(OWNER_BONUSES)).shown, 3193164535);
  assert.equal(t.tradeRwValue(row(icon(OWNER_BONUSES, "Orange")), GUN), 3193164535);
});
