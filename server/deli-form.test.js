import { test } from "node:test";
import assert from "node:assert/strict";
import {
  matchDeliOffers, isFlavoredHam, findDeliPages, countFilled, fillSheetXml, dateRangeLabel,
} from "./deli-form.js";

// Fixture: this week's deli offers as the VISION step should return them —
// including the grouped-tile expansion (each $5.99 / $7.99 product its own entry).
const WEEK_0802 = [
  { product: "Black Bear Turkey Breast", brand: "Black Bear", priceText: "$11.99 lb", pricePerLb: 11.99, unit: "lb", description: "Store Sliced, Oven Gold" },
  { product: "Carolina Smoked Turkey", brand: "Carolina", priceText: "$5.99 lb", pricePerLb: 5.99, unit: "lb", description: "Store Sliced, Honey, Oil-Braised" },
  { product: "Butterball Turkey Breast", brand: "Butterball", priceText: "$5.99 lb", pricePerLb: 5.99, unit: "lb", description: "Store Sliced, Oven Roasted" },
  { product: "Bowl & Basket Chicken Breast", brand: "Bowl & Basket", priceText: "$7.99 lb", pricePerLb: 7.99, unit: "lb", description: "Store Sliced, Oven Roasted, BBQ or Buffalo" },
  { product: "Black Bear Deli Classic Ham", brand: "Black Bear", priceText: "$7.99 lb", pricePerLb: 7.99, unit: "lb", description: "Store Sliced, Deep Smoked, Maple Glazed, Prosciuttini" },
  { product: "Farmland Domestic Ham", brand: "Farmland", priceText: "$3.99 lb", pricePerLb: 3.99, unit: "lb", description: "Store Sliced" },
  { product: "Smithfield Domestic Ham", brand: "Smithfield", priceText: "$4.99 lb", pricePerLb: 4.99, unit: "lb", description: "Store Sliced, 97% Fat Free" },
  { product: "Glen Rock Virginia Ham", brand: "Glen Rock", priceText: "$4.99 lb", pricePerLb: 4.99, unit: "lb", description: "Store Sliced, Honey or Virginia" },
  { product: "Bowl & Basket Ham Off the Bone", brand: "Bowl & Basket", priceText: "$5.99 lb", pricePerLb: 5.99, unit: "lb", description: "Store Sliced, Double Smoked, Perfectly Sweet & Salty" },
  { product: "Bowl & Basket Bologna", brand: "Bowl & Basket", priceText: "$3.99 lb", pricePerLb: 3.99, unit: "lb", description: "Store Sliced" },
  { product: "Black Bear Classico Genoa Salami", brand: "Black Bear Classico", priceText: "$5.99 lb", pricePerLb: 5.99, unit: "lb", description: "Store Sliced, Hard or Genoa" },
  { product: "Black Bear London Broil Roast Beef", brand: "Black Bear", priceText: "$13.99 lb", pricePerLb: 13.99, unit: "lb", description: "Store Sliced, Top Round, Extra Lean" },
  { product: "Land O'Lakes American", brand: "Land O'Lakes", priceText: "$4.99 lb", pricePerLb: 4.99, unit: "lb", description: "Store Sliced Deli Cheese" },
  { product: "Auricchio Provolone", brand: "Auricchio", priceText: "$5.99 lb", pricePerLb: 5.99, unit: "lb", description: "Store Sliced, Mild" },
  { product: "Bowl & Basket Domestic Swiss", brand: "Bowl & Basket", priceText: "$5.99 lb", pricePerLb: 5.99, unit: "lb", description: "Store Sliced, Aged 60 Days" },
  { product: "Bowl & Basket Muenster", brand: "Bowl & Basket", priceText: "$5.99 lb", pricePerLb: 5.99, unit: "lb", description: "Store Sliced, Pepper Jack or" },
  // Distractors that MUST NOT match a deli row (packaged / raw meat / not per-lb):
  { product: "Bowl & Basket Chicken Thighs or Drumsticks", brand: "Bowl & Basket", priceText: "$1.49 lb", pricePerLb: 1.49, unit: "lb", description: "raw poultry" },
  { product: "Galbani Mozzarella Ball", brand: "Galbani", priceText: "$3.99", pricePerLb: null, unit: "each", description: "8-oz packaged" },
  { product: "Sargento Sliced Cheese", brand: "Sargento", priceText: "$2.99", pricePerLb: null, unit: "each", description: "packaged" },
];

test("matchDeliOffers reproduces the user-approved 12 rows exactly", () => {
  const got = matchDeliOffers(WEEK_0802);
  const expect = {
    "Turkey": ["Black Bear", 11.99],
    "Chicken": ["Bowl & Basket", 7.99],
    "Domestic Ham": ["Farmland", 3.99],
    "Flavored Ham": ["Glen Rock", 4.99],
    "Bologna": ["Bowl & Basket", 3.99],
    "Salami": ["Black Bear", 5.99],   // Black-Bear-only, "Classico" dropped from the cell
    "Pepperoni": [null, null],
    "Roast Beef": ["London Broil", 13.99],   // cut, not brand
    "American": ["Land O'Lakes", 4.99],
    "Provolone": ["Auricchio", 5.99],
    "Mozzarella": [null, null],
    "Muenster": ["Bowl & Basket", 5.99],
    "Swiss": ["Bowl & Basket", 5.99],
    "Cheddar": [null, null],   // added; no per-lb deli cheddar this week
  };
  for (const row of got) {
    const [brand, price] = expect[row.item];
    assert.equal(row.brand, brand, `${row.item} brand`);
    assert.equal(row.price, price, `${row.item} price`);
  }
});

test("Carolina is excluded even though it is the cheapest turkey", () => {
  const got = matchDeliOffers(WEEK_0802);
  const turkey = got.find(r => r.item === "Turkey");
  assert.equal(turkey.brand, "Black Bear");   // NOT Carolina @ 5.99
});

test("Butterball is excluded from Turkey (like Carolina)", () => {
  // Fixture has Butterball @5.99, Carolina @5.99, Black Bear @11.99 — both cheaper
  // brands are excluded, so Black Bear wins despite being pricier.
  assert.equal(matchDeliOffers(WEEK_0802).find(r => r.item === "Turkey").brand, "Black Bear");
  assert.equal(matchDeliOffers(WEEK_0802).find(r => r.item === "Turkey").price, 11.99);
});

test("Salami is Black-Bear-only and its cell reads just 'Black Bear' (no Classico)", () => {
  const salami = matchDeliOffers(WEEK_0802).find(r => r.item === "Salami");
  assert.equal(salami.brand, "Black Bear");   // NOT "Black Bear Classico"
  assert.equal(salami.price, 5.99);
  // A cheaper non-Black-Bear salami must NOT be chosen — the row stays blank:
  const other = matchDeliOffers([{ product: "Carando Genoa Salami", brand: "Carando", priceText: "$3.99 lb", pricePerLb: 3.99, unit: "lb", description: "" }]);
  assert.equal(other.find(r => r.item === "Salami").price, null);
});

test("raw chicken thighs never fill the deli Chicken row", () => {
  const got = matchDeliOffers(WEEK_0802);
  assert.equal(got.find(r => r.item === "Chicken").price, 7.99);  // not 1.49
});

test("packaged / non-per-lb cheese never fills Mozzarella", () => {
  assert.equal(matchDeliOffers(WEEK_0802).find(r => r.item === "Mozzarella").price, null);
});

test("flavored vs domestic ham splits on the description, not the brand", () => {
  assert.equal(isFlavoredHam("Store Sliced, Honey or Virginia"), true);
  assert.equal(isFlavoredHam("Deep Smoked, Maple Glazed"), true);
  assert.equal(isFlavoredHam("Store Sliced"), false);          // plain domestic
  assert.equal(isFlavoredHam("Double Smoked, Sweet & Salty"), false);  // "smoked" alone doesn't flavor it
  // A honey ham from any OTHER brand still lands in Flavored Ham:
  const offers = [{ product: "Store Brand Honey Ham", brand: "ShopRite", priceText: "$4.49 lb", pricePerLb: 4.49, unit: "lb", description: "Honey" }];
  const m = matchDeliOffers(offers);
  assert.equal(m.find(r => r.item === "Flavored Ham").price, 4.49);
  assert.equal(m.find(r => r.item === "Domestic Ham").price, null);
});

test("Roast Beef cell shows the cut (Eye Round / London Broil / Regular), not the brand", () => {
  const mk = (product, desc) => matchDeliOffers([{ product, brand: "Black Bear", priceText: "$13.99 lb", pricePerLb: 13.99, unit: "lb", description: desc }]).find(r => r.item === "Roast Beef").brand;
  assert.equal(mk("Black Bear London Broil Roast Beef", "Top Round"), "London Broil");
  assert.equal(mk("Black Bear Eye Round Roast Beef", ""), "Eye Round");
  assert.equal(mk("Black Bear Cap-Off Roast Beef", "Seasoned"), "Regular");  // neither cut named
});

test("cheapest wins within a row", () => {
  const got = matchDeliOffers(WEEK_0802);
  assert.equal(got.find(r => r.item === "Domestic Ham").price, 3.99);  // Farmland, not Smithfield 4.99
});

test("countFilled reports non-blank rows (guard input)", () => {
  assert.equal(countFilled(matchDeliOffers(WEEK_0802)), 11);  // all but Pepperoni + Mozzarella
});

test("findDeliPages detects the header page and Store-Sliced pages, not raw-meat", () => {
  const pages = findDeliPages([
    { page: 1, text: "General Mills Cereal 4 for $7" },
    { page: 2, text: "Chicken Breast $2.49 lb Pork Chops $2.99 lb Beef $5.99 lb lb lb" }, // raw meat, high lb, no Store Sliced
    { page: 5, text: "Deli, Specialty Cheese & Snacking\nCarando Genoa Salami Store Sliced" },
    { page: 4, text: "Black Bear Turkey Breast Store Sliced ... Land O'Lakes American Store Sliced" }, // 2 Store Sliced
  ]);
  assert.ok(pages.includes(5), "header page");
  assert.ok(pages.includes(4), "Store-Sliced page (Turkey/American)");
  assert.ok(!pages.includes(1) && !pages.includes(2), "raw-meat/other pages excluded");
});

test("dateRangeLabel formats ISO to the sheet's M/D-M/D", () => {
  assert.equal(dateRangeLabel("2026-08-02", "2026-08-08"), "8/2-8/8");
  assert.equal(dateRangeLabel("2025-10-31", "2025-11-06"), "10/31-11/6");
});

test("fillSheetXml sets date, inline-string brands, numeric prices, clears blanks", () => {
  const sheet = '<sheetData>'
    + '<row r="1"><c r="A1" t="s"><v>0</v></c><c r="C1" s="4" t="s"><v>1</v></c></row>'
    + '<row r="3"><c r="A3" t="s"><v>2</v></c><c r="C3" s="11" t="s"><v>7</v></c><c r="D3" s="12" t="n"><v>12.99</v></c></row>'
    + '<row r="8"><c r="A8" t="s"><v>3</v></c><c r="C8" s="11" t="s"><v>9</v></c><c r="D8" s="12" t="n"><v>6.99</v></c></row>'
    + '</sheetData>';
  const fills = [
    { row: 3, item: "Turkey", brand: "Black Bear", price: 11.99 },
    { row: 8, item: "Pepperoni", brand: null, price: null },
  ];
  const out = fillSheetXml(sheet, fills, "8/2-8/8");
  assert.match(out, /<c r="C1" s="4" t="inlineStr"><is><t>8\/2-8\/8<\/t><\/is><\/c>/);
  assert.match(out, /<c r="C3" s="11" t="inlineStr"><is><t>Black Bear<\/t><\/is><\/c>/);
  assert.match(out, /<c r="D3" s="12" t="n"><v>11.99<\/v><\/c>/);
  assert.match(out, /<c r="C8" s="11" t="inlineStr"><is><t><\/t><\/is><\/c>/);  // cleared
  assert.ok(!out.includes("12.99") && !out.includes("6.99"), "old prices gone");
});

test("fillSheetXml escapes XML in brand names (Bowl & Basket)", () => {
  const sheet = '<row r="13"><c r="C13" s="11" t="s"><v>1</v></c><c r="D13" s="12" t="n"><v>1</v></c></row>';
  const out = fillSheetXml(sheet, [{ row: 13, item: "Muenster", brand: "Bowl & Basket", price: 5.99 }], null);
  assert.match(out, /Bowl &amp; Basket/);
});
