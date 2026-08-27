import { test } from "node:test";
import assert from "node:assert/strict";
import {
  matchDeliOffers, isFlavoredHam, findDeliPages, countFilled, countMatched, promoteDecision, fillSheetXml, dateRangeLabel,
  visionCacheUsable,
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
    "Pepperoni": ["Black Bear", 7.99],   // standing default when none on sale
    "Roast Beef": ["London Broil", 13.99],   // cut, not brand
    "American": ["Land O'Lakes", 4.99],
    "Provolone": ["Auricchio", 5.99],
    "Mozzarella": [null, null],
    "Muenster": ["Bowl & Basket", 5.99],
    "Swiss": ["Bowl & Basket", 5.99],
    "Cheddar": ["Bowl & Basket", 6.99],   // no deli cheddar on this circular -> standing default
  };
  for (const row of got) {
    const [brand, price] = expect[row.item];
    assert.equal(row.brand, brand, `${row.item} brand`);
    assert.equal(row.price, price, `${row.item} price`);
  }
});

test("Salami: catches ANY brand (Carando Genoa), not just Black Bear", () => {
  const carando = matchDeliOffers([
    { product: "Carando Genoa Salami", brand: "Carando", priceText: "$5.99 lb", pricePerLb: 5.99, unit: "lb", description: "Store Sliced, Hard" },
  ]).find(r => r.item === "Salami");
  assert.equal(carando.brand, "Carando");
  assert.equal(carando.price, 5.99);
});

test("Salami: Black Bear still strips the 'Classico' sub-brand from the cell", () => {
  const bb = matchDeliOffers([
    { product: "Black Bear Classico Genoa Salami", brand: "Black Bear Classico", priceText: "$5.99 lb", pricePerLb: 5.99, unit: "lb", description: "Store Sliced, Hard or Genoa" },
  ]).find(r => r.item === "Salami");
  assert.equal(bb.brand, "Black Bear");
  assert.equal(bb.price, 5.99);
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

test("Salami: WEEK_0802 yields Black Bear with 'Classico' stripped; any brand qualifies", () => {
  const salami = matchDeliOffers(WEEK_0802).find(r => r.item === "Salami");
  assert.equal(salami.brand, "Black Bear");   // NOT "Black Bear Classico"
  assert.equal(salami.price, 5.99);
  // Any-brand now (was Black-Bear-only): a Carando salami DOES fill the row.
  const row = matchDeliOffers([{ product: "Carando Genoa Salami", brand: "Carando", priceText: "$3.99 lb", pricePerLb: 3.99, unit: "lb", description: "" }])
    .find(r => r.item === "Salami");
  assert.equal(row.brand, "Carando");
  assert.equal(row.price, 3.99);
});

test("Pepperoni defaults to Black Bear $7.99 when none is on sale", () => {
  const p = matchDeliOffers([{ product: "Auricchio Provolone", brand: "Auricchio", priceText: "$5.99 lb", pricePerLb: 5.99, unit: "lb", description: "" }])
    .find(r => r.item === "Pepperoni");
  assert.equal(p.brand, "Black Bear");
  assert.equal(p.price, 7.99);
});

test("Pepperoni on sale overrides the default", () => {
  const p = matchDeliOffers([{ product: "Margherita Pepperoni", brand: "Margherita", priceText: "$6.99 lb", pricePerLb: 6.99, unit: "lb", description: "Store Sliced" }])
    .find(r => r.item === "Pepperoni");
  assert.equal(p.brand, "Margherita");
  assert.equal(p.price, 6.99);
});

// Standing defaults, same shape as Pepperoni: an item the user buys every week
// regardless, so a blank cell is worse than last-known price. The circular's own
// deal still wins whenever there is one.
const NO_DELI = [{ product: "Auricchio Provolone", brand: "Auricchio", priceText: "$5.99 lb", pricePerLb: 5.99, unit: "lb", description: "" }];

test("Bologna defaults to Bowl & Basket $3.99 when none is on sale", () => {
  const b = matchDeliOffers(NO_DELI).find(r => r.item === "Bologna");
  assert.equal(b.brand, "Bowl & Basket");
  assert.equal(b.price, 3.99);
});

test("Bologna on sale overrides the default", () => {
  const b = matchDeliOffers([{ product: "Dietz & Watson Bologna", brand: "Dietz & Watson", priceText: "$4.99 lb", pricePerLb: 4.99, unit: "lb", description: "Store Sliced" }])
    .find(r => r.item === "Bologna");
  assert.equal(b.brand, "Dietz & Watson");
  assert.equal(b.price, 4.99);
});

test("Cheddar defaults to Bowl & Basket $6.99 when none is on sale", () => {
  const c = matchDeliOffers(NO_DELI).find(r => r.item === "Cheddar");
  assert.equal(c.brand, "Bowl & Basket");
  assert.equal(c.price, 6.99);
});

test("Cheddar on sale overrides the default, keeping its sharpness label", () => {
  const c = matchDeliOffers([{ product: "Bowl & Basket Ultra Sharp Cheddar", brand: "Bowl & Basket", priceText: "$5.99 lb", pricePerLb: 5.99, unit: "lb", description: "Store Sliced" }])
    .find(r => r.item === "Cheddar");
  assert.equal(c.brand, "Bowl & Basket Ultra Sharp");
  assert.equal(c.price, 5.99);
});

test("Roast Beef defaults to Eye Round $10.99 when none is on sale", () => {
  // The Roast Beef cell carries the CUT, not the maker — so the default's
  // "brand" is the cut, matching what the label function produces on a real deal.
  const r = matchDeliOffers(NO_DELI).find(x => x.item === "Roast Beef");
  assert.equal(r.brand, "Eye Round");
  assert.equal(r.price, 10.99);
});

test("Roast Beef on sale overrides the default and still shows the cut", () => {
  const r = matchDeliOffers([{ product: "Black Bear London Broil Roast Beef", brand: "Black Bear", priceText: "$9.99 lb", pricePerLb: 9.99, unit: "lb", description: "Store Sliced" }])
    .find(x => x.item === "Roast Beef");
  assert.equal(r.brand, "London Broil");
  assert.equal(r.price, 9.99);
});

test("a 'Cheddarwurst' bratwurst never fills the Cheddar cheese row", () => {
  const got = matchDeliOffers([
    { product: "Black Bear Bratwurst", brand: "Black Bear", priceText: "$3.99 lb", pricePerLb: 3.99, unit: "lb", description: "Cheddarwurst, Knockwurst" },
  ]).find(r => r.item === "Cheddar");
  assert.notEqual(got.price, 3.99);        // the point: NOT the Cheddarwurst's price
  assert.equal(got.price, 6.99);           // falls through to the standing default
  assert.equal(got.fromDefault, true);     // and is marked as not-from-the-circular
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

test("'American Cheddar' fills Cheddar, not American; real American cheese fills American", () => {
  const offers = [
    { product: "Bowl & Basket Muenster", brand: "Bowl & Basket", priceText: "$5.99 lb", pricePerLb: 5.99, unit: "lb", description: "Ultra Sharp American Cheddar or" },
    { product: "Black Bear American Cheese", brand: "Black Bear", priceText: "$5.99 lb", pricePerLb: 5.99, unit: "lb", description: "Yellow or White, Premium" },
  ];
  const m = matchDeliOffers(offers);
  assert.equal(m.find(r => r.item === "American").brand, "Black Bear");   // real American cheese, not the Cheddar tile
  const ched = m.find(r => r.item === "Cheddar");
  assert.equal(ched.price, 5.99);            // the "American Cheddar" lands here
  assert.equal(ched.brand, "Bowl & Basket Ultra Sharp");   // sharpness variety appended
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
  // All but Mozzarella: Pepperoni and Cheddar are standing defaults this week.
  assert.equal(countFilled(matchDeliOffers(WEEK_0802)), 13);
});

test("findDeliPages detects the header page and Store-Sliced pages, not raw-meat", () => {
  const pages = findDeliPages([
    { page: 1, text: "General Mills Cereal 4 for $7" },
    { page: 2, text: "Chicken Breast $2.49 lb Pork Chops $2.99 lb Beef $5.99 lb lb lb" }, // raw meat, high lb, no Store Sliced
    { page: 5, text: "Deli, Specialty Cheese & Snacking\nCarando Genoa Salami Store Sliced" },
    { page: 4, text: "Black Bear Turkey Breast Store Sliced ... Land O'Lakes American Store Sliced" }, // 2 Store Sliced
    { page: 10, text: "Black Bear Eye Round Roast Beef (Deli) Store Sliced $10.99" }, // 1 Store Sliced (lunchbox page)
  ]);
  assert.ok(pages.includes(5), "header page");
  assert.ok(pages.includes(4), "Store-Sliced page (Turkey/American)");
  assert.ok(pages.includes(10), "single Store-Sliced item (roast beef on a grocery page)");
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

test("the overwrite guard counts circular matches only, not standing defaults", () => {
  // The guard exists to stop a degraded vision read replacing the user's approved
  // form. Defaults fill even when the read returned NOTHING, so counting them
  // would defeat it: four free rows would be most of the way to the threshold.
  const nothingRead = matchDeliOffers([]);
  assert.equal(countMatched(nothingRead), 0);          // guard sees zero
  assert.equal(countFilled(nothingRead), 4);           // but four cells are populated
  assert.deepEqual(nothingRead.filter(f => f.price != null).map(f => f.item).sort(),
                   ["Bologna", "Cheddar", "Pepperoni", "Roast Beef"]);
});

test("a real match is not marked fromDefault", () => {
  const b = matchDeliOffers([{ product: "Bowl & Basket Bologna", brand: "Bowl & Basket", priceText: "$3.99 lb", pricePerLb: 3.99, unit: "lb", description: "Store Sliced" }])
    .find(r => r.item === "Bologna");
  assert.equal(b.price, 3.99);
  assert.equal(b.fromDefault, undefined);   // same price as the default, but genuinely read
});

// ── promoteDecision ─────────────────────────────────────────────────────────
// Whether a freshly-generated form may replace the one the user has bookmarked.

test("promoteDecision: a clean, well-filled run promotes", () => {
  assert.equal(promoteDecision({ matched: 10, pageFailures: 0, minMatched: 7 }).promote, true);
});

test("promoteDecision: a page whose vision call failed blocks promotion", () => {
  const d = promoteDecision({ matched: 12, pageFailures: 1, minMatched: 7 });
  assert.equal(d.promote, false);
  assert.match(d.reason, /page/i);
});

test("promoteDecision: too few circular matches blocks promotion", () => {
  const d = promoteDecision({ matched: 6, pageFailures: 0, minMatched: 7 });
  assert.equal(d.promote, false);
  assert.match(d.reason, /circular matches/i);
});

test("promoteDecision: a WEAKER re-read of the SAME week is refused", () => {
  // The real incident: a 1000px render read page 1 as empty, blanking Turkey and
  // American. It still cleared minMatched, so it overwrote a strictly better form.
  const d = promoteDecision({
    matched: 8, pageFailures: 0, minMatched: 7,
    validFrom: "2026-08-16",
    previous: { validFrom: "2026-08-16", matched: 10 },
  });
  assert.equal(d.promote, false);
  assert.match(d.reason, /fewer|regress/i);
});

test("promoteDecision: an EQUAL re-read of the same week still promotes", () => {
  // Re-running after a rule change (e.g. adding standing defaults) must not be
  // blocked when the circular-read quality is unchanged.
  const d = promoteDecision({
    matched: 10, pageFailures: 0, minMatched: 7,
    validFrom: "2026-08-16",
    previous: { validFrom: "2026-08-16", matched: 10 },
  });
  assert.equal(d.promote, true);
});

test("promoteDecision: a NEW week with fewer deals is NOT a regression", () => {
  // A quiet sale week legitimately has fewer matches than a busy one. The guard
  // must only compare like with like, or it would freeze the form forever.
  const d = promoteDecision({
    matched: 8, pageFailures: 0, minMatched: 7,
    validFrom: "2026-08-23",
    previous: { validFrom: "2026-08-16", matched: 12 },
  });
  assert.equal(d.promote, true);
});

test("promoteDecision: no previous record → falls back to the threshold alone", () => {
  assert.equal(promoteDecision({ matched: 7, pageFailures: 0, minMatched: 7, validFrom: "2026-08-16" }).promote, true);
  assert.equal(promoteDecision({ matched: 6, pageFailures: 0, minMatched: 7, validFrom: "2026-08-16" }).promote, false);
});

// A flavour named after another meat must not disqualify the row. Real tile from
// the 08/23 book: nine flavours, one of them "Bacon Lovers", and the bare
// /bacon/ exclusion blanked a $9.99/lb turkey breast.
test("turkey breast with a Bacon Lovers flavour still fills the Turkey row", () => {
  const offers = [{
    product: "Turkey Breast", brand: "Black Bear", priceText: "$9.99 lb", pricePerLb: 9.99, unit: "lb",
    description: "Store Sliced, Deli Classic, Catering, Oven-Roasted, Honey, Mesquite Smoked, Black Peppered, Cajun, Bacon Lovers or Honey Maple Glazed",
  }];
  const turkey = matchDeliOffers(offers).find(f => f.item === "Turkey");
  assert.equal(turkey.price, 9.99, "Bacon Lovers is a flavour, not turkey bacon");
  assert.equal(turkey.brand, "Black Bear");
});

// The exclusion still has to do its actual job.
test("turkey bacon is still kept out of the Turkey row", () => {
  const offers = [{ product: "Turkey Bacon", brand: "Bowl & Basket", priceText: "$4.99 lb", pricePerLb: 4.99, unit: "lb", description: "Store Sliced" }];
  assert.equal(matchDeliOffers(offers).find(f => f.item === "Turkey").price, null);
});

// Black Bear prices its mozzarella the same as its provolone, so a week whose
// deli page names the provolone but not the mozzarella still fills both. This
// is a MIRROR, not a standing default: the price follows whatever the provolone
// went on sale at that week rather than a fixed figure.
const bb = (product, price) => ({
  product, brand: "Black Bear", priceText: `$${price} lb`, pricePerLb: price,
  unit: "lb", description: "Store Sliced",
});
const rowOf = (fills, item) => fills.find(f => f.item === item);

test("mozzarella mirrors Black Bear provolone when the circular omits it", () => {
  const fills = matchDeliOffers([bb("Black Bear Provolone", 5.99)]);
  const moz = rowOf(fills, "Mozzarella");
  assert.equal(moz.price, 5.99);
  assert.equal(moz.brand, "Black Bear");
});

test("the mirrored price follows the provolone, not a fixed figure", () => {
  const fills = matchDeliOffers([bb("Black Bear Provolone", 7.49)]);
  assert.equal(rowOf(fills, "Mozzarella").price, 7.49);
});

test("a real mozzarella deal beats the mirror", () => {
  // The circular is always the better source when it actually says something.
  const fills = matchDeliOffers([bb("Black Bear Provolone", 5.99),
                                 bb("Black Bear Fresh Mozzarella", 4.99)]);
  assert.equal(rowOf(fills, "Mozzarella").price, 4.99);
});

test("another brand's provolone does not set the mozzarella", () => {
  // The rule is specific to Black Bear pricing its two cheeses alike; nothing
  // says Bowl & Basket does.
  const fills = matchDeliOffers([
    { product: "Bowl & Basket Provolone", brand: "Bowl & Basket", priceText: "$4.99 lb",
      pricePerLb: 4.99, unit: "lb", description: "Store Sliced" }]);
  assert.equal(rowOf(fills, "Mozzarella").price, null);
});

test("a mirrored mozzarella does not count as a circular match", () => {
  // countMatched drives the overwrite guard. The circular supplied the
  // PROVOLONE; the mozzarella is inferred, so it must not help a weak read
  // clear the bar and clobber the approved form.
  const fills = matchDeliOffers([bb("Black Bear Provolone", 5.99)]);
  assert.equal(rowOf(fills, "Mozzarella").fromDefault, true);
  assert.equal(countMatched(fills), 1);
});

test("no provolone at all leaves mozzarella blank", () => {
  const fills = matchDeliOffers([bb("Black Bear Swiss", 6.99)]);
  assert.equal(rowOf(fills, "Mozzarella").price, null);
});

// ── vision replay cache ─────────────────────────────────────────────────────
// Re-reading a page is not free of consequence: the model is non-deterministic,
// so a second read of the SAME page can return a different price and quietly
// regress a form that was already right. That happened — a rebuild to pick up a
// new rule re-read page 2 and moved chicken from $7.99 to $4.99, because each
// row takes the cheapest match and the second read saw a $4.99 chicken.
const cache = (over = {}) => ({ pages: [2, 3], pageFailures: 0, offers: [{ product: "x" }], ...over });

test("a clean cache for the same pages is replayed", () => {
  assert.equal(visionCacheUsable(cache(), [2, 3]), true);
});

test("a cache for different pages is not replayed", () => {
  // The circular changed shape; last week's read says nothing about this one.
  assert.equal(visionCacheUsable(cache(), [2, 4]), false);
  assert.equal(visionCacheUsable(cache(), [2]), false);
  assert.equal(visionCacheUsable(cache({ pages: [2] }), [2, 3]), false);
});

test("a partial read is never frozen in", () => {
  // A page that failed should get a fresh chance next run rather than have the
  // gap inherited forever.
  assert.equal(visionCacheUsable(cache({ pageFailures: 1 }), [2, 3]), false);
});

test("a missing or malformed cache falls back to reading", () => {
  assert.equal(visionCacheUsable(null, [2, 3]), false);
  assert.equal(visionCacheUsable({}, [2, 3]), false);
  assert.equal(visionCacheUsable(cache({ offers: "nope" }), [2, 3]), false);
  assert.equal(visionCacheUsable(cache({ pages: null }), [2, 3]), false);
});

test("an empty read is still a real answer and is replayed", () => {
  // Zero offers on a page is a legitimate outcome the prompt allows for; it
  // must not be mistaken for a failure and re-rolled.
  assert.equal(visionCacheUsable(cache({ offers: [] }), [2, 3]), true);
});
