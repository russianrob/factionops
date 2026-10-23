// A second bonus never makes a gun cheaper.
//
// An Orange Bushmaster Carbon 15 with 14% Revitalize and 26% Conserve was
// badged $2.09B. Four Orange Bushmasters with 14% Revitalize and nothing else
// had sold for a median of $3.19B, and Conserve was worth nothing on top. The
// two-bonus estimate is blended with the weapon's colour median ($200M here),
// and with no pair comp to lean on, that blend pulled a gun with a bonus
// added below what the same gun sells for without one.
//
// The estimator is inline in injectPriceTags, so it is lifted out between the
// two comments that bracket it and run, inside a loop over the page's items
// as it is there, over a hand-built feed holding the report's numbers.
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
function estimatorBlock() {
  const a = SRC.indexOf("// Determine bonus color tier for each bonus");
  const b = SRC.indexOf("// Gather full price arrays for tooltip");
  assert.ok(a > 0 && b > a, "the estimator block in injectPriceTags has moved");
  return SRC.slice(a, b);
}
// Which table set an item reads, chosen per item just before the estimator.
function activeLine() {
  const m = SRC.match(/^[ \t]*ACTIVE = \(weaponKey && recentTables && bonuses\.length === 1\) \? recentTables : null;$/m);
  assert.ok(m, "the per-item table choice in injectPriceTags has changed");
  return m[0].trim();
}

const GUN = "Bushmaster Carbon 15";

// Prices Orange Bushmasters, one per entry of `items` (each a bonus list), in
// one loop the way injectPriceTags walks a page: table choice, colour median,
// then the estimator. Strict, as the script is.
function priceAll(feed, items) {
  const box = { FEED: feed };
  vm.createContext(box);
  vm.runInContext([
    "'use strict';",
    v("WEAPON_CLASS"), v("COMBO_MIN_SAMPLES"), v("LEVEL_MIN_SAMPLES"),
    "var weaponPrices = FEED.weaponPrices, bonusPrices = FEED.bonusPrices || {}, classPrices = FEED.classPrices || {};",
    "var weaponComboPrices = FEED.comboPrices || {}, weaponPairComboPrices = FEED.pairComboPrices || {};",
    "var weaponLevelPrices = FEED.levelPrices || {}, recentTables = FEED.recent || null, ACTIVE = null;",
    // Which colour's cross-weapon bonus median to read; this feed has none.
    "function getBonusColorByName() { return null; }",
    fn("TBL"), fn("levelMedianOf"), fn("getMedianPrice"), fn("getBonusMedian"),
    fn("getWeaponComboMedian"), fn("getWeaponComboThinArray"), fn("getWeaponComboPriceArray"),
    fn("pairKeyFor"), fn("getWeaponPairComboMedian"), fn("getWeaponPairComboArray"),
    fn("getWeaponLevelMedian"), fn("getWeaponLevelCount"), fn("getCombinedLevelValue"),
    fn("getPriceArray"), fn("getBonusPriceArray"),
    "globalThis.run = function (items) {",
    "  var out = [];",
    "  for (var i = 0; i < items.length; i++) {",
    "    var weaponKey = " + JSON.stringify(GUN) + ", armourKey = null, rarity = 'Orange';",
    "    var bonuses = items[i];",
    "    " + activeLine(),
    "    var median = getMedianPrice(weaponKey, rarity), bonusFn = getBonusMedian;",
    "    var itemKey = weaponKey, comboFn = getWeaponComboMedian;",
    estimatorBlock(),
    "    out.push({ est: estimatedPrice, deriv: deriv });",
    "  }",
    "  return out;",
    "};",
  ].join("\n"), box, { filename: "rwp-estimator.js" });
  return JSON.parse(JSON.stringify(box.run(items)));
}
const price = (feed, bonuses) => priceAll(feed, [bonuses])[0];

// The report, as the tooltip showed it: Orange Bushmasters run $61.8M to
// $10.57B over 647 sales with a $200M median; 14% Revitalize alone has 4
// sales at a $3.19B median; Conserve is worth $48.5M, under the bare gun.
const REPORT = () => ({
  weaponPrices: { [GUN]: { Orange: [61800001, 200000001, 10574554640, 647] } },
  comboPrices: { [GUN + "|Conserve"]: { Orange: [30000001, 48475009, 70000001, 59] } },
  levelPrices: { [GUN + "|Revitalize"]: { Orange: { 13: [1888888889, 11], 14: [3193164535, 4], 15: [5244891468, 6] } } },
});
// The same, with a last-year table on top: the all-time tables plus, at this
// roll, `entry` (a [median, sales] reading from the last year).
const WITH_RECENT = (entry) => {
  const feed = REPORT();
  const lv = JSON.parse(JSON.stringify(feed.levelPrices));
  lv[GUN + "|Revitalize"].Orange[14] = entry;
  feed.recent = { weaponPrices: feed.weaponPrices, comboPrices: feed.comboPrices, levelPrices: lv };
  return feed;
};
const REVIT_14 = 3193164535;
const BONUSES = [{ name: "Revitalize", level: 14 }, { name: "Conserve", level: 26 }];
const floorLine = (r) => r.deriv.find((d) => /^not below/.test(d.label));

test("the gun from the report is priced at its Revitalize 14% sales, not under them", () => {
  assert.equal(price(REPORT(), BONUSES).est, REVIT_14);
});

test("the tooltip says why the blend did not take it lower", () => {
  const r = price(REPORT(), BONUSES);
  const labels = r.deriv.map((d) => d.label);
  assert.ok(labels.some((l) => /^blended with Orange/.test(l)), "the blend line stays: " + labels.join(" / "));
  assert.deepEqual(r.deriv[r.deriv.length - 1],
    { label: "not below Revitalize 14% alone", amt: REVIT_14, src: "exact %", n: 4, prem: false });
});

test("a second bonus that is worth something still adds it", () => {
  // Conserve with real sales of its own, on a weapon whose colour median is
  // near the build-up: the blend lands above $3.19B, so there is nothing to
  // hold up and the answer is the blend.
  const feed = REPORT();
  feed.weaponPrices[GUN].Orange = [61800001, 2500000000, 10574554640, 647];
  feed.comboPrices = { [GUN + "|Conserve"]: { Orange: [500000000, 1000000000, 1500000000, 5] } };
  const r = price(feed, BONUSES);
  assert.ok(r.est > REVIT_14, "got " + r.est);
  assert.equal(floorLine(r), undefined);
  assert.match(r.deriv[r.deriv.length - 1].label, /^blended with/);
});

test("a gun with sales of its exact pair of bonuses keeps the pair's price", () => {
  // Measured: holding a pair comp up to one bonus's sales made more of those
  // estimates miss by over half, so the pair stands as it is.
  const feed = REPORT();
  feed.pairComboPrices = { [GUN + "|Conserve+Revitalize"]: { Orange: [1000000000, 1500000000, 2000000000, 3] } };
  const r = price(feed, BONUSES);
  assert.ok(r.est < REVIT_14, "got " + r.est);
  assert.equal(floorLine(r), undefined);
});

test("only sales at the exact roll set the floor, not a roll worked out between two", () => {
  // 14% has no sales of its own here; 13% and 15% do, and the value between
  // them is an estimate, which is what the blend is there to temper.
  const feed = REPORT();
  delete feed.levelPrices[GUN + "|Revitalize"].Orange[14];
  const r = price(feed, BONUSES);
  assert.equal(floorLine(r), undefined);
});

test("when both bonuses have sales at their rolls, the better one sets the floor", () => {
  // 26% Conserve has sold three times on its own at $1.00B. The blend still
  // lands under $3.19B, and it is Revitalize's sales it stops at.
  const feed = REPORT();
  feed.levelPrices[GUN + "|Conserve"] = { Orange: { 26: [1000000000, 3] } };
  const r = price(feed, BONUSES);
  assert.equal(r.est, REVIT_14);
  assert.equal(floorLine(r).label, "not below Revitalize 14% alone");
});

test("it is never under what the same gun with that bonus alone is badged at", () => {
  // A one-bonus gun is priced from the last year's sales at its roll when
  // there are three of them: here $3.60B, so that is the badge on a 14%
  // Revitalize Bushmaster, and the two-bonus one may not show less.
  const r = price(WITH_RECENT([3600000000, 3]), BONUSES);
  assert.equal(r.est, 3600000000);
  assert.deepEqual(floorLine(r), { label: "not below Revitalize 14% alone", amt: 3600000000, src: "exact %", n: 3, prem: false });
});

test("a lower reading from the last year does not pull the floor down", () => {
  const r = price(WITH_RECENT([2800000000, 3]), BONUSES);
  assert.equal(r.est, REVIT_14);
});

test("a floor never carries over to the next weapon on the page", () => {
  // The reported gun first, then the same gun with 26% Conserve alone.
  const [first, next] = priceAll(REPORT(), [BONUSES, [{ name: "Conserve", level: 26 }]]);
  assert.equal(first.est, REVIT_14);
  assert.equal(floorLine(next), undefined);
  assert.equal(next.est, 48475009);
});
