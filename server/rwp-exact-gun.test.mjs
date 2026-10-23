// A gun that has sold before is priced with its own sales.
//
// An Orange Bushmaster Carbon 15 with 14% Revitalize and 26% Conserve was
// badged $3.19B: what four Orange Bushmasters with 14% Revitalize alone had
// sold for, since its pair of bonuses has too few sales for a comp. But that
// very gun -- same weapon, colour, both bonuses at both rolls -- sold once,
// on 23 Aug 2025, for $4.00B, and the badge never looked.
//
// The estimator is lifted out of injectPriceTags and run in a loop over a
// hand-built feed, as in rwp-second-bonus.test.mjs. The fetch, the cache and
// the next page's load are lifted too, with the network and the page stubbed.
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
// Pieces only a build that reads the exact gun has. A build without them
// still loads, so the tests show it failing rather than erroring.
const fnIfAny = (name) => (SRC.includes("function " + name + "(") ? fn(name) : "");
const vIfAny = (name) => (new RegExp("^[ \\t]*var[ \\t]+" + name + "[ \\t]*=", "m").test(SRC) ? v(name) : "");
function estimatorBlock() {
  const a = SRC.indexOf("// Determine bonus color tier for each bonus");
  const b = SRC.indexOf("// Gather full price arrays for tooltip");
  assert.ok(a > 0 && b > a, "the estimator block in injectPriceTags has moved");
  return SRC.slice(a, b);
}
// The estimator as injectPriceTags runs it: its call to estimateItemPrice,
// or in a build from before that function, the block itself.
function estimatorStep() {
  const call = fn("injectPriceTags").match(/^[ \t]*var est = estimateItemPrice\(.*\);\n[ \t]*var bonusColors = est\.bonusColors.*;$/m);
  return call ? call[0] : estimatorBlock();
}
// Which table set an item reads, chosen per item just before the estimator.
function activeLine() {
  const m = fn("injectPriceTags").match(/^[ \t]*ACTIVE = \(weaponKey && recentTables && bonuses\.length === 1\) \? recentTables : null;$/m);
  assert.ok(m, "the per-item table choice in injectPriceTags has changed");
  return m[0].trim();
}
// Objects made inside a vm belong to another realm; compare them as data.
const plain = (x) => (x === undefined ? x : JSON.parse(JSON.stringify(x)));

const GUN = "Bushmaster Carbon 15";

// Prices Orange Bushmasters, one per entry of `items` (each a bonus list), in
// one loop the way injectPriceTags walks a page. `feed.exactPrices` is the
// exact-gun table. Strict, as the script is.
function priceAll(feed, items) {
  const box = { FEED: feed };
  vm.createContext(box);
  vm.runInContext([
    "'use strict';",
    v("WEAPON_CLASS"), v("COMBO_MIN_SAMPLES"), v("LEVEL_MIN_SAMPLES"),
    "var weaponPrices = FEED.weaponPrices, bonusPrices = FEED.bonusPrices || {}, classPrices = FEED.classPrices || {};",
    "var weaponComboPrices = FEED.comboPrices || {}, weaponPairComboPrices = FEED.pairComboPrices || {};",
    "var weaponLevelPrices = FEED.levelPrices || {}, recentTables = FEED.recent || null, ACTIVE = null;",
    vIfAny("weaponExactPrices"),
    "if (typeof weaponExactPrices !== 'undefined') weaponExactPrices = FEED.exactPrices || {};",
    // Which colour's cross-weapon bonus median to read; this feed has none.
    "function getBonusColorByName() { return null; }",
    fn("TBL"), fn("levelMedianOf"), fn("getMedianPrice"), fn("getBonusMedian"),
    fn("getWeaponComboMedian"), fn("getWeaponComboThinArray"), fn("getWeaponComboPriceArray"),
    fn("pairKeyFor"), fn("getWeaponPairComboMedian"), fn("getWeaponPairComboArray"),
    fn("getWeaponLevelMedian"), fn("getWeaponLevelCount"), fn("getCombinedLevelValue"),
    fn("getPriceArray"), fn("getBonusPriceArray"),
    fnIfAny("getWeaponExactGun"), fnIfAny("monthYearOfDay"),
    fnIfAny("estimateItemPrice"),
    "globalThis.run = function (items) {",
    "  var out = [];",
    "  for (var i = 0; i < items.length; i++) {",
    "    var weaponKey = " + JSON.stringify(GUN) + ", armourKey = null, rarity = 'Orange';",
    "    var bonuses = items[i];",
    "    " + activeLine(),
    "    var median = getMedianPrice(weaponKey, rarity), bonusFn = getBonusMedian;",
    "    var itemKey = weaponKey, comboFn = getWeaponComboMedian;",
    estimatorStep(),
    "    out.push({ est: estimatedPrice, deriv: deriv });",
    "  }",
    "  return out;",
    "};",
  ].join("\n"), box, { filename: "rwp-estimator.js" });
  return plain(box.run(items));
}
const price = (feed, bonuses) => priceAll(feed, [bonuses])[0];

// The report's tables (see rwp-second-bonus.test.mjs): Orange Bushmasters at a
// $200M median over 647 sales, 14% Revitalize alone at $3.19B over 4, and
// Conserve worth less than the bare gun. With these the badge reads $3.19B.
const REPORT = () => ({
  weaponPrices: { [GUN]: { Orange: [61800001, 200000001, 10574554640, 647] } },
  comboPrices: { [GUN + "|Conserve"]: { Orange: [30000001, 48475009, 70000001, 59] } },
  levelPrices: { [GUN + "|Revitalize"]: { Orange: { 13: [1888888889, 11], 14: [3193164535, 4], 15: [5244891468, 6] } } },
});
const REVIT_14 = 3193164535;
// The exact-gun table: weapon|bonuses in name order -> colour -> rolls in the
// same order -> [median, sales, day of the last sale counted from 1970].
// Day 20323 is 23 Aug 2025.
const EXACT = (rolls, entry) => ({ [GUN + "|Conserve+Revitalize"]: { Orange: { [rolls]: entry } } });
const WITH_EXACT = (entry, rolls = "26+14", base = REPORT()) => ({ ...base, exactPrices: EXACT(rolls, entry) });
const SOLD_ONCE = [4002036189, 1, 20323];
const BONUSES = [{ name: "Revitalize", level: 14 }, { name: "Conserve", level: 26 }];
const exactLine = (r) => r.deriv.find((d) => d.label === "blended with this exact gun");
// The rule the tests hold the badge to: a geometric average, with weight w on
// the gun's own sales.
const blend = (own, est, w) => Math.round(Math.exp(w * Math.log(own) + (1 - w) * Math.log(est)));

test("the gun from the report is priced with its own $4.00B sale, half and half", () => {
  assert.equal(price(WITH_EXACT(SOLD_ONCE), BONUSES).est, 3574795103);
});

test("the tooltip says it used this gun's sale, how much, and when it sold", () => {
  const r = price(WITH_EXACT(SOLD_ONCE), BONUSES);
  assert.deepEqual(r.deriv[r.deriv.length - 1],
    { label: "blended with this exact gun", amt: 4002036189, src: "50% this gun, last sold Aug 2025", n: 1, prem: false });
  // The floor it was blended into is still shown, just above.
  assert.equal(r.deriv[r.deriv.length - 2].label, "not below Revitalize 14% alone");
});

test("two sales of the gun carry two thirds of the weight", () => {
  const r = price(WITH_EXACT([4100000000, 2, 20400]), BONUSES);
  assert.equal(r.est, blend(4100000000, REVIT_14, 2 / 3));
  assert.equal(exactLine(r).src, "67% this gun, last sold Nov 2025");
  assert.equal(exactLine(r).n, 2);
});

test("how long ago it sold changes the date shown, not the price", () => {
  // No age limit: leaning less on sales over a year old, or dropping those
  // over two, was measured and was not better.
  const r = price(WITH_EXACT([4002036189, 1, 19430]), BONUSES);
  assert.equal(r.est, 3574795103);
  assert.equal(exactLine(r).src, "50% this gun, last sold Mar 2023");
});

test("the bonuses can be listed in either order", () => {
  const r = price(WITH_EXACT(SOLD_ONCE), [BONUSES[1], BONUSES[0]]);
  assert.equal(r.est, 3574795103);
});

test("a sale of the same pair at other rolls is not this gun", () => {
  for (const rolls of ["26+15", "25+14", "14+26"]) {
    const r = price(WITH_EXACT(SOLD_ONCE, rolls), BONUSES);
    assert.equal(r.est, REVIT_14, rolls);
    assert.equal(exactLine(r), undefined, rolls);
  }
});

test("a lower sale of the gun does not take it under the better bonus alone", () => {
  // Half and half with a $2.00B sale is $2.53B, under the $3.19B that 14%
  // Revitalize sells for on its own, so the floor holds and says so last.
  const r = price(WITH_EXACT([2000000000, 1, 20323]), BONUSES);
  assert.equal(r.est, REVIT_14);
  assert.ok(exactLine(r), "the blend is still shown");
  assert.deepEqual(r.deriv[r.deriv.length - 1],
    { label: "not below Revitalize 14% alone", amt: REVIT_14, src: "exact %", n: 4, prem: false });
  // Held before the blend and again after it, but said once, last.
  assert.equal(r.deriv.filter((d) => /^not below/.test(d.label)).length, 1);
});

test("with no floor, a lower sale of the gun brings the estimate down", () => {
  // 14% Revitalize has no sales of its own here, so nothing holds it up.
  const base = REPORT();
  delete base.levelPrices[GUN + "|Revitalize"].Orange[14];
  const before = price(base, BONUSES).est;
  const r = price(WITH_EXACT([300000000, 1, 20323], "26+14", base), BONUSES);
  assert.ok(before > 300000000, "the fixture needs an estimate above the sale: " + before);
  assert.equal(r.est, blend(300000000, before, 1 / 2));
  assert.equal(r.deriv[r.deriv.length - 1].label, "blended with this exact gun");
});

test("a gun with a comp for its pair of bonuses keeps the pair's price", () => {
  // The pair's median already holds this gun's sales; averaging them in a
  // second time was measured and scored worse.
  const base = REPORT();
  base.pairComboPrices = { [GUN + "|Conserve+Revitalize"]: { Orange: [1000000000, 1500000000, 4002036189, 3] } };
  const without = price(base, BONUSES);
  const r = price(WITH_EXACT(SOLD_ONCE, "26+14", base), BONUSES);
  assert.equal(r.est, without.est);
  assert.equal(exactLine(r), undefined);
});

test("with no exact-gun table, the price is what it was", () => {
  const r = price(REPORT(), BONUSES);
  assert.equal(r.est, REVIT_14);
  assert.equal(exactLine(r), undefined);
});

test("this gun's sale never carries over to the next weapon on the page", () => {
  // The reported gun first, then the same gun with 26% Conserve alone.
  const [first, next] = priceAll(WITH_EXACT(SOLD_ONCE), [BONUSES, [{ name: "Conserve", level: 26 }]]);
  assert.equal(first.est, 3574795103);
  assert.equal(exactLine(next), undefined);
  assert.equal(next.est, 48475009);
});

test("each gun on a page is priced as it would be on its own", () => {
  // The reported gun, then one held at its floor with no sale of its own
  // (25% Conserve has none), then one held at its floor after a lower sale.
  const feed = WITH_EXACT(SOLD_ONCE);
  feed.exactPrices[GUN + "|Conserve+Revitalize"].Orange["27+14"] = [2000000000, 1, 20323];
  const items = [BONUSES,
    [{ name: "Revitalize", level: 14 }, { name: "Conserve", level: 25 }],
    [{ name: "Revitalize", level: 14 }, { name: "Conserve", level: 27 }]];
  const page = priceAll(feed, items);
  assert.match(page[1].deriv.at(-1).label, /^not below/, "the second gun is held at its floor");
  assert.ok(exactLine(page[2]) && /^not below/.test(page[2].deriv.at(-1).label), "the third blends, then is held");
  items.forEach((bonuses, i) => assert.deepEqual(page[i], price(feed, bonuses), "item " + i));
});

// The shipped parser, run on auction CSV text the way the page and the
// server both run it.
function parse(csv) {
  const box = {};
  vm.createContext(box);
  vm.runInContext([
    ...["COMBO_MIN_SAMPLES", "LEVEL_MIN_SAMPLES", "RECENT_DAYS", "RECENT_MIN", "WEAPON_CLASS", "BONUS_ID_MAP",
        "ITEM_ID_MAP", "ARMOUR_SET", "ARMOUR_ID_MAP", "ARMOUR_BONUS_MAP", "RARITY_MAP"].map(v),
    fn("percentile"), fn("parseCSVAndComputePrices"),
    "globalThis.parse = parseCSVAndComputePrices;",
  ].join("\n"), box, { filename: "rwp-parser.js" });
  return plain(box.parse(csv));
}

test("the sale is read from the table the parser builds, keyed the way the badge looks it up", () => {
  // The auction row as the CSV has it, buyer and seller blanked: item 241,
  // Orange, Revitalize (41) at 14 and Conserve (55) at 26, in that order.
  const csv = "header\n1755981315,4002036189,0,seller,0,buyer,241,0,5,3,162.4,59.6,63.64,0,41,14,55,26,";
  const table = parse(csv).pairLevelPrices;
  const r = price({ ...REPORT(), exactPrices: table }, BONUSES);
  assert.equal(r.est, 3574795103);
  assert.equal(exactLine(r).src, "50% this gun, last sold Aug 2025");
});

// The fetch, the cache and the next page's load, as the script runs them.
// `opts.pda` picks the path: the pre-built feed on PDA, the auction CSVs and
// the script's own parser elsewhere (`opts.parsed` stands in for the parser).
function pages(opts) {
  const box = { OPTS: opts, SAVED: {}, ERRORS: [] };
  box.console = { log() {}, warn() {}, error: (...a) => box.ERRORS.push(a.map(String).join(" ")) };
  vm.createContext(box);
  vm.runInContext([
    "'use strict';",
    v("CACHE_KEY"),
    "var weaponPrices = {}, bonusPrices = {}, classPrices = {}, armourPrices = {}, armourBonusPrices = {}, armourSetPrices = {};",
    "var weaponComboPrices = {}, armourComboPrices = {}, weaponPairComboPrices = {}, weaponLevelPrices = {}, weaponMaxBonus = {};",
    "var ITEM_ALIASES = {}, recentTables = null, isFetching = false, isPDA = !!OPTS.pda;",
    vIfAny("weaponExactPrices"),
    "var WEAPON_CDN_URL = 'weapons', ARMOUR_CDN_URL = 'armour';",
    "function setToggleLoading() {} function removeAllBadges() {} function injectPriceTags() {} function flashButton() {}",
    "function fetchPricesJSON() { return Promise.resolve(OPTS.feed); }",
    "function fetchGzip(url) { return Promise.resolve(url); }",
    "function decompressGzip(gz) { return gz + '.csv'; }",
    "function parseCSVAndComputePrices() { return OPTS.parsed(); }",
    "function attachRecentPrices(csv, all) { all.recent = OPTS.lastYear; return all; }",
    "function parseArmourCSVAndComputePrices() { return { armourPrices: {}, armourBonusPrices: {}, armourSetPrices: {}, comboPrices: {} }; }",
    "function safeSet(k, val) { SAVED[k] = val; }",
    "function safeGet(k, fallback) { return (k in SAVED) ? SAVED[k] : fallback; }",
    fn("applyJsonPrices"), fn("loadCachedPrices"), "async " + fn("fetchAndUpdatePrices"),
    "globalThis.refresh = fetchAndUpdatePrices;",
    "globalThis.load = loadCachedPrices;",
    "globalThis.table = function () { return typeof weaponExactPrices === 'undefined' ? undefined : weaponExactPrices; };",
    // A new page: nothing loaded yet but what the script starts with.
    "globalThis.newPage = function () { if (typeof weaponExactPrices !== 'undefined') weaponExactPrices = {}; };",
  ].join("\n"), box, { filename: "rwp-pages.js" });
  return box;
}
const ALL_TIME = EXACT("26+14", SOLD_ONCE);
// What the parser hands back for the auction CSVs: every year at the top,
// and the last year under `recent`, which the Aug 2025 sale is not in.
const DESKTOP = {
  pda: false,
  parsed: () => ({ weaponPrices: { [GUN]: {} }, bonusPrices: {}, classPrices: {}, comboPrices: {},
                   pairComboPrices: {}, levelPrices: {}, pairLevelPrices: ALL_TIME }),
  lastYear: { pairLevelPrices: {} },
};

test("on a computer, the badge reads every year of the gun's sales, not only the last", async () => {
  const p = pages(DESKTOP);
  assert.equal(await p.refresh(), true, p.ERRORS.join("\n"));
  assert.deepEqual(plain(p.table()), ALL_TIME);
});

test("on PDA, the badge reads the exact-gun table the price feed carries", async () => {
  const p = pages({ pda: true, feed: { weaponPrices: { [GUN]: {} }, weaponExactPrices: ALL_TIME } });
  assert.equal(await p.refresh(), true, p.ERRORS.join("\n"));
  assert.deepEqual(plain(p.table()), ALL_TIME);
});

test("a cache saved before the table existed still loads, and leaves it empty", () => {
  // What 3.14.1 saved: every table but this one. Until the next refresh the
  // badge prices as 3.14.1 did, rather than reading a table that is not there.
  const p = pages(DESKTOP);
  p.SAVED[p.CACHE_KEY] = JSON.stringify({ weaponPrices: { [GUN]: {} }, bonusPrices: {}, classPrices: {}, timestamp: Date.now() });
  assert.ok(p.load() > 0, "the cache did not load");
  assert.deepEqual(plain(p.table()), {});
});

test("the next page knows the gun's sales without a refresh", async () => {
  // Prices are fetched when the button is pressed, and every page after
  // that loads them from the cache.
  const p = pages(DESKTOP);
  assert.equal(await p.refresh(), true, p.ERRORS.join("\n"));
  p.newPage();
  assert.ok(p.load() > 0, "the cache did not load");
  assert.deepEqual(plain(p.table()), ALL_TIME);
});
