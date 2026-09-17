// Pricing an item read off a screenshot.
//
// Run against the REAL feed, so a change to the data shows up here rather than
// on somebody's forum post.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { priceItem, valueAtPct, levelCurve, resolveName } from "./rwp-price.js";

const feed = JSON.parse(fs.readFileSync(new URL("./data/rwp-prices.json", import.meta.url), "utf8"));

test("interpolates inside a curve", () => {
  const pts = [[70, 770e6], [78, 1158e6]];
  const at = valueAtPct(pts, 74);
  assert.equal(at.extrapolated, false);
  assert.ok(at.value > 770e6 && at.value < 1158e6);
});

test("extends the trend past the last sale, and admits it", () => {
  const pts = levelCurve(feed, "Cobra Derringer", "Assassinate", "Orange");
  assert.ok(pts.length >= 5, "expected the Orange Assassinate curve");
  const at = valueAtPct(pts, 97);
  assert.equal(at.extrapolated, true, "97% is past every recorded sale");
  // ~$2.1b by least squares over 70-78%.
  assert.ok(at.value > 1.8e9 && at.value < 2.6e9, "got $" + (at.value / 1e9).toFixed(2) + "b");
});

test("the weapon from the forum post prices off its roll, not the median", () => {
  const p = priceItem(feed, {
    name: "Cobra Derringer", rarity: "Orange",
    bonuses: [{ name: "Specialist", pct: 23 }, { name: "Assassinate", pct: 97 }],
  });
  assert.equal(p.ok, true);
  // Assassinate leads: it is the bonus the price is about.
  assert.equal(p.bonuses[0].name, "Assassinate");
  assert.match(p.basis, /Assassinate sales by roll/);
  assert.equal(p.extrapolated, true);
  // Far above the roll-agnostic Orange median of $163m.
  assert.ok(p.estimate > 1e9, "got $" + (p.estimate / 1e6).toFixed(0) + "m");
  assert.ok(p.notes.some((n) => /beyond the highest recorded sale/.test(n)));
  assert.ok(p.notes.some((n) => /second bonus/.test(n)), "the unpriced second bonus must be stated");
});

test("an exact pair beats the curve when one exists", () => {
  const p = priceItem(feed, {
    name: "Cobra Derringer", rarity: "Orange",
    bonuses: [{ name: "Assassinate", pct: 60 }, { name: "Double-Tap", pct: 20 }],
  });
  assert.match(p.basis, /Assassinate\+Double-Tap/);
  assert.equal(p.extrapolated, false);
  assert.equal(p.samples, 4);
});

test("a low roll is not given a high roll's median", () => {
  // The bug the level curve exists to prevent: 50% and 97% are not one price.
  const low = priceItem(feed, { name: "Cobra Derringer", rarity: "Yellow",
    bonuses: [{ name: "Assassinate", pct: 50 }] });
  const high = priceItem(feed, { name: "Cobra Derringer", rarity: "Yellow",
    bonuses: [{ name: "Assassinate", pct: 67 }] });
  assert.ok(high.estimate > low.estimate * 1.3,
    `50% $${(low.estimate/1e6).toFixed(0)}m vs 67% $${(high.estimate/1e6).toFixed(0)}m`);
});

test("falls back to the weapon alone and says the bonuses are not counted", () => {
  const p = priceItem(feed, { name: "Cobra Derringer", rarity: "Orange", bonuses: [] });
  assert.match(p.basis, /all Orange Cobra Derringer sales/);
  assert.ok(p.notes.some((n) => /Bonuses not accounted for/.test(n)));
});

test("an unknown item is refused rather than guessed", () => {
  const p = priceItem(feed, { name: "Definitely Not A Weapon", rarity: "Orange", bonuses: [] });
  assert.equal(p.ok, false);
});

test("a nonsense curve never produces a negative price", () => {
  assert.equal(valueAtPct([[90, 100], [95, 10]], 400), null);
});

test('"The China Lake" is priced as "China Lake"', () => {
  // Torn's tooltip names it in a sentence, so the reading carries the article
  // and every price table does not. Exact matching returned nothing for a
  // weapon with 115 Orange sales.
  const p = priceItem(feed, {
    name: "The China Lake", rarity: "Orange", bonuses: [{ name: "Stricken", pct: 55 }],
  });
  assert.equal(p.ok, true, p.reason);
  assert.equal(p.name, "China Lake");
  assert.equal(p.readAs, "The China Lake");
  assert.ok(p.estimate > 0);
});

test("a near-miss name is refused, not approximated", () => {
  // Pricing the wrong gun is worse than pricing nothing.
  assert.equal(priceItem(feed, { name: "China Lak", rarity: "Orange", bonuses: [] }).ok, false);
  assert.equal(priceItem(feed, { name: "Chinese Lake", rarity: "Orange", bonuses: [] }).ok, false);
});

// ── Recency ────────────────────────────────────────────────────
// The feed ships a 365-day slice beside the all-time history. The desktop
// script has always preferred it; this path did not, so the same weapon priced
// differently on a forum screenshot than on its own item.php page.

test("prices off the last year, not a decade of history", () => {
  const p = priceItem(feed, {
    name: "SIG 552", rarity: "Yellow", bonuses: [{ name: "Expose", pct: 9 }],
  });
  assert.equal(p.ok, true, p.reason);
  // 15 sales in the last year put this at ~$86m. The all-time table says
  // $101m only because it still counts 2022-23 sales made in another economy.
  assert.ok(p.estimate < 95e6,
    "got $" + (p.estimate / 1e6).toFixed(1) + "m — that is the all-time median");
  assert.ok(p.estimate > 70e6, "got $" + (p.estimate / 1e6).toFixed(1) + "m");
});

test("the quoted range comes from the recent window too", () => {
  const p = priceItem(feed, {
    name: "SIG 552", rarity: "Yellow", bonuses: [{ name: "Expose", pct: 9 }],
  });
  // All-time says $52m-$900m across 346 sales; that $900m is a 2023 sale of a
  // gun that has since resold for $121m. Quoting it as a live range is a lie.
  assert.ok(p.high < 300e6, "got a high of $" + (p.high / 1e6).toFixed(0) + "m");
  assert.ok(p.samples < 346, "got " + p.samples + " samples — the all-time count");
});

test("says so when the recent market differs from the history", () => {
  const p = priceItem(feed, {
    name: "SIG 552", rarity: "Yellow", bonuses: [{ name: "Expose", pct: 9 }],
  });
  assert.ok(p.notes.some((n) => /all-time/i.test(n)),
    "no note naming the all-time figure: " + p.notes.join(" | "));
});

test("still prices when the feed carries no recent slice", () => {
  const p = priceItem({ ...feed, recent: null }, {
    name: "SIG 552", rarity: "Yellow", bonuses: [{ name: "Expose", pct: 9 }],
  });
  assert.equal(p.ok, true, p.reason);
  assert.equal(p.estimate, 101000001, "must fall straight back to the history");
});

// ── Invented names ─────────────────────────────────────────────
// A cropped card names no weapon, and the reader does not always decline: on
// the Kodachi post it returned "Big Al's Gun Shop Katana" -- the SELL SHOP
// welded to what the picture looked like -- with confident:true. Trusting the
// model's own confidence flag is not a guard, so the name is checked against
// the catalogue instead.

test("an item name that does not exist is flagged as unread, not priced", () => {
  const p = priceItem(feed, {
    name: "Big Al's Gun Shop Katana", rarity: "Yellow",
    bonuses: [{ name: "Parry", pct: 53 }],
  });
  assert.equal(p.ok, false);
  assert.equal(p.unknown, true, "the caller must be able to tell a misread from a rare item");
});

test("a real item with no sales is NOT called unread", () => {
  // The distinction the flag exists to protect: Rheinmetall MG 3 is a genuine
  // weapon with no Orange sales on record. "No price" is the right answer and
  // its name belongs on the badge.
  const p = priceItem(feed, { name: "Rheinmetall MG 3", rarity: "Orange", bonuses: [] });
  assert.equal(p.ok, false);
  assert.ok(!p.unknown, "a known weapon must keep its name");
  assert.match(p.reason, /Rheinmetall MG 3/);
});
