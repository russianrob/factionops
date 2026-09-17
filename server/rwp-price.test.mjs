// Pricing an item read off a screenshot.
//
// Run against the REAL feed, so a change to the data shows up here rather than
// on somebody's forum post.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { priceItem, valueAtPct, levelCurve, resolveName, rarityForRoll, weaponByBuyPrice, rarityForQuality } from "./rwp-price.js";

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
  assert.match(p.basis, /with Assassinate has sold for, matched to the 97%/);
  assert.equal(p.extrapolated, true);
  // Far above the roll-agnostic Orange median of $163m.
  assert.ok(p.estimate > 1e9, "got $" + (p.estimate / 1e6).toFixed(0) + "m");
  assert.ok(p.notes.some((n) => /best on record/.test(n)));
  assert.ok(p.notes.some((n) => /isn't counted/.test(n)), "the unpriced second bonus must be stated");
});

test("an exact pair beats the curve when one exists", () => {
  const p = priceItem(feed, {
    name: "Cobra Derringer", rarity: "Orange",
    bonuses: [{ name: "Assassinate", pct: 60 }, { name: "Double-Tap", pct: 20 }],
  });
  assert.match(p.basis, /both Assassinate and Double-Tap/);
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
  assert.match(p.basis, /whatever bonus it had/);
  assert.ok(p.notes.some((n) => /ignores the bonus completely/.test(n)));
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
  assert.ok(p.notes.some((n) => /going all the way back/i.test(n)),
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

// ── A missing rarity ───────────────────────────────────────────
// The reader drops the coloured word often enough to matter: the Mag 7 post
// came back with the name and the bonus but rarity null, and every rung below
// needs a rarity, so a perfectly readable card priced at nothing.

test("infers the rarity from the roll when the card did not give one", () => {
  const p = priceItem(feed, {
    name: "Mag 7", rarity: null, bonuses: [{ name: "Expose", pct: 15 }],
  });
  assert.equal(p.ok, true, p.reason);
  assert.equal(p.rarity, "Red", "15% Expose only ever sold as Red");
  assert.ok(p.estimate > 0);
  assert.ok(p.notes.some((n) => /doesn't show a colour/i.test(n)),
    "an inferred rarity must be declared: " + p.notes.join(" | "));
});

test("a rarity that IS given is never second-guessed", () => {
  const p = priceItem(feed, {
    name: "SIG 552", rarity: "Yellow", bonuses: [{ name: "Expose", pct: 9 }],
  });
  assert.equal(p.rarity, "Yellow");
  assert.ok(!p.notes.some((n) => /doesn't show a colour/.test(n)));
});

test("an ambiguous roll is not guessed at", () => {
  // rarityForRoll answers only when exactly one rarity recorded that roll.
  // Where ranges overlap, picking one would price a Yellow as a Red.
  const amb = rarityForRoll(feed, "Mag 7", "Expose", 99);
  assert.equal(amb, null, "no rarity sold a 99% Expose Mag 7");
});

test("the roll picks the rarity out of three candidates", () => {
  assert.equal(rarityForRoll(feed, "Mag 7", "Expose", 8), "Yellow");
  assert.equal(rarityForRoll(feed, "Mag 7", "Expose", 11), "Orange");
  assert.equal(rarityForRoll(feed, "Mag 7", "Expose", 15), "Red");
});

// ── Identifying a weapon that the card does not name ───────────
// A cropped card names no weapon and the reader fills the gap: an ArmaLite
// M-15A4 came back as "M16A4", which is not a Torn item, so it priced at
// nothing. But the card always carries the shop BUY price -- "Buy: $20,000,000
// (Mexico)" -- and that is a fixed catalogue figure, not a market value that
// drifts. Matched exactly, it names the weapon.

test("a buy price identifies the weapon the card did not name", () => {
  const buys = { "armalite m-15a4": 20000000, "mag 7": 60000, "sig 552": 7500000 };
  assert.equal(weaponByBuyPrice(feed, buys, 20000000), "ArmaLite M-15A4");
  assert.equal(weaponByBuyPrice(feed, buys, 7500000), "SIG 552");
});

test("an ambiguous buy price is refused, not picked", () => {
  // Two weapons at the same shop price cannot be told apart this way, and
  // guessing between them prices the wrong gun.
  const buys = { "mag 7": 60000, "axe": 60000 };
  assert.equal(weaponByBuyPrice(feed, buys, 60000), null);
});

test("a buy price nothing matches is refused", () => {
  const buys = { "mag 7": 60000 };
  assert.equal(weaponByBuyPrice(feed, buys, 12345), null);
  assert.equal(weaponByBuyPrice(feed, buys, 0), null);
  assert.equal(weaponByBuyPrice(feed, buys, null), null);
});

test("only weapons the price feed actually knows are candidates", () => {
  // The catalogue has every item in Torn; the price feed has the 101 with
  // sales. Identifying something we cannot price is not an identification.
  const buys = { "plushie": 20000000, "armalite m-15a4": 20000000 };
  assert.equal(weaponByBuyPrice(feed, buys, 20000000), "ArmaLite M-15A4",
    "a non-weapon at the same price must not create ambiguity");
});

// ── Plain English ──────────────────────────────────────────────
// The badge is read by people mid-trade, not by the person who wrote it.
// "sales by roll (Orange, 6 price points)" was the line that prompted this:
// nobody outside this file knows what a roll is.

test("nothing on the badge is written in jargon", () => {
  const jargon = [/\broll\b/i, /price points?/i, /\bmedian\b/i, /\bsample\b/i,
                  /extrapolat/i, /roll-agnostic/i, /\bbasis\b/i, /\bpct\b/i];
  const cases = [
    { name: "Cobra Derringer", rarity: "Orange", bonuses: [{ name: "Assassinate", pct: 97 }, { name: "Specialist", pct: 23 }] },
    { name: "Cobra Derringer", rarity: "Orange", bonuses: [{ name: "Assassinate", pct: 60 }, { name: "Double-Tap", pct: 20 }] },
    { name: "SIG 552", rarity: "Yellow", bonuses: [{ name: "Expose", pct: 9 }] },
    { name: "Mag 7", rarity: null, bonuses: [{ name: "Expose", pct: 15 }] },
    { name: "Cobra Derringer", rarity: "Orange", bonuses: [] },
  ];
  for (const c of cases) {
    const p = priceItem(feed, c);
    if (!p.ok) continue;
    for (const text of [p.basis].concat(p.notes)) {
      for (const bad of jargon) {
        assert.ok(!bad.test(text), "jargon " + bad + " in: " + text);
      }
    }
  }
});

test("the basis reads as a sentence about what things sold for", () => {
  const p = priceItem(feed, { name: "SIG 552", rarity: "Yellow", bonuses: [{ name: "Expose", pct: 9 }] });
  assert.match(p.basis, /^what a Yellow SIG 552 with Expose has sold for/);
  assert.match(p.basis, /matched to the 9%/);
});

test("the article agrees with the colour", () => {
  const orange = priceItem(feed, { name: "Cobra Derringer", rarity: "Orange", bonuses: [] });
  const yellow = priceItem(feed, { name: "Cobra Derringer", rarity: "Yellow", bonuses: [] });
  assert.match(orange.basis, /what an Orange/);
  assert.match(yellow.basis, /what a Yellow/);
});

// ── Armour ─────────────────────────────────────────────────────
// Every rung of the ladder read weapon tables, so an armour card resolved to a
// real item and then priced at nothing. The feed has had armour prices all
// along; nothing was looking at them.

test("armour prices, matched to its roll", () => {
  const p = priceItem(feed, {
    name: "Assault Body", rarity: "Yellow", bonuses: [{ name: "Impenetrable", pct: 23 }],
  });
  assert.equal(p.ok, true, p.reason);
  assert.ok(p.estimate > 200e6 && p.estimate < 320e6, "got $" + (p.estimate / 1e6).toFixed(0) + "m");
  assert.match(p.basis, /matched to the 23%/);
});

test('"The Assault Body" is priced as "Assault Body"', () => {
  const p = priceItem(feed, {
    name: "The Assault Body", rarity: "Yellow", bonuses: [{ name: "Impenetrable", pct: 23 }],
  });
  assert.equal(p.ok, true, p.reason);
  assert.equal(p.name, "Assault Body");
});

test("a low-roll armour is not given a high-roll price", () => {
  // The reason armour needed per-roll data at all: quoted across every roll,
  // an Assault Body reads "$68m to $3.5b", which is not an answer.
  const lo = priceItem(feed, { name: "Assault Body", rarity: "Yellow", bonuses: [{ name: "Impenetrable", pct: 20 }] });
  const hi = priceItem(feed, { name: "Assault Body", rarity: "Yellow", bonuses: [{ name: "Impenetrable", pct: 29 }] });
  assert.ok(hi.estimate > lo.estimate * 1.5,
    `20% $${(lo.estimate/1e6).toFixed(0)}m vs 29% $${(hi.estimate/1e6).toFixed(0)}m`);
});

test("armour with no usable bonus still prices off the piece itself", () => {
  const p = priceItem(feed, { name: "Assault Gloves", rarity: "Yellow", bonuses: [] });
  assert.equal(p.ok, true, p.reason);
  assert.ok(p.estimate > 0);
  assert.match(p.basis, /whatever bonus it had/);
});

test("armour speaks the same English as weapons", () => {
  const p = priceItem(feed, {
    name: "Assault Gloves", rarity: "Yellow", bonuses: [{ name: "Impenetrable", pct: 22 }],
  });
  assert.match(p.basis, /^what a Yellow Assault Gloves with Impenetrable has sold for/);
  for (const bad of [/\broll\b/i, /price points?/i, /\bmedian\b/i]) {
    assert.ok(!bad.test(p.basis), "jargon in: " + p.basis);
    for (const n of p.notes) assert.ok(!bad.test(n), "jargon in: " + n);
  }
});

// ── The range has to answer the same question as the price ─────
// An Assault Body priced at the 23% was quoted "$68m to $3.5b" beside it,
// because the range came from every roll pooled while the estimate came from
// one. The two numbers described different things and only one was labelled.

test("a roll-matched price reports sales at THAT roll, not all of them", () => {
  const p = priceItem(feed, {
    name: "Assault Body", rarity: "Yellow", bonuses: [{ name: "Impenetrable", pct: 23 }],
  });
  assert.equal(p.samples, 592, "the count must be the sales at 23%, not 4688 across every roll");
  assert.equal(p.low, null, "an all-roll range beside a one-roll price is two answers wearing one label");
  assert.equal(p.high, null);
});

test("the same holds for weapons", () => {
  const p = priceItem(feed, {
    name: "SIG 552", rarity: "Yellow", bonuses: [{ name: "Expose", pct: 9 }],
  });
  assert.ok(p.samples > 0 && p.samples < 100, "got " + p.samples + " — that is the all-roll count");
  assert.equal(p.low, null);
});

test("a roll nobody has sold keeps the wider range, because that is all there is", () => {
  // 97% Assassinate is past every recorded sale, so there is no count at the
  // roll and the pooled range is the only evidence available.
  const p = priceItem(feed, {
    name: "Cobra Derringer", rarity: "Orange", bonuses: [{ name: "Assassinate", pct: 97 }],
  });
  assert.equal(p.extrapolated, true);
  assert.ok(p.low > 0 && p.high > 0, "an estimated roll keeps the pooled range");
});

// ── Placing a card that shows a quality but no colour ──────────
// myGear lists a weapon with its quality on the thumbnail and no rarity
// anywhere: "Enfield SA-80, 245.2%, 75% Cupid, 41% Specialist". Both bonuses
// and the name read fine and it priced at nothing, because every rung needs a
// rarity and 75% Cupid is not a roll any single rarity recorded.

test("quality places a weapon when the card gives no colour", () => {
  // Enfield SA-80: Yellow tops out at 178.3, Orange at 217.09, Red runs
  // 219.79-275.15. 245.2 is inside one of those and outside the others.
  assert.equal(rarityForQuality(feed, "Enfield SA-80", 245.2, 2), "Red");
  assert.equal(rarityForQuality(feed, "Enfield SA-80", 100, 1), "Yellow");
});

test("a quality inside two spans is refused", () => {
  // 160 sits in Yellow (83.55-178.3) and Orange (137.08-217.09) at once.
  assert.equal(rarityForQuality(feed, "Enfield SA-80", 160, 1), null);
});

test("two bonuses rule out Yellow, which can settle a tie", () => {
  // Of 8,004 recorded two-bonus sales, exactly zero are Yellow. So a quality
  // that would be ambiguous on its own stops being ambiguous.
  assert.equal(rarityForQuality(feed, "Enfield SA-80", 160, 2), "Orange");
});

test("a quality nothing has ever sold at is refused", () => {
  assert.equal(rarityForQuality(feed, "Enfield SA-80", 900, 1), null);
  assert.equal(rarityForQuality(feed, "Enfield SA-80", 0, 1), null);
  assert.equal(rarityForQuality(feed, "Not A Weapon", 150, 1), null);
});

test("the myGear listing prices end to end", () => {
  const p = priceItem(feed, {
    name: "Enfield SA-80", rarity: null, quality: 245.2,
    bonuses: [{ name: "Cupid", pct: 75 }, { name: "Specialist", pct: 41 }],
  });
  assert.equal(p.ok, true, p.reason);
  assert.equal(p.rarity, "Red");
  assert.ok(p.estimate > 0);
  assert.ok(p.notes.some((n) => /quality/i.test(n)),
    "a colour worked out from quality must say so: " + p.notes.join(" | "));
});

test("a colour the card DID show is still never second-guessed", () => {
  const p = priceItem(feed, {
    name: "Enfield SA-80", rarity: "Yellow", quality: 245.2,
    bonuses: [{ name: "Specialist", pct: 25 }],
  });
  assert.equal(p.rarity, "Yellow");
  assert.ok(!p.notes.some((n) => /quality/i.test(n)));
});

// ── Which bonus the price is about ─────────────────────────────
// A Diamond Bladed Knife with 61% Achilles and 35% Bleed priced at $200m.
// It had sold for $2.22b thirteen days earlier. Two faults compounded.

test("the leading bonus is the valuable one, not the bigger percentage", () => {
  // 61% and 35% are different scales: on this knife at Orange the Achilles is
  // worth $249m and the Bleed $2.1b. Ranking by percentage picked the cheap one.
  const p = priceItem(feed, {
    name: "Diamond Bladed Knife", rarity: "Orange",
    bonuses: [{ name: "Achilles", pct: 61 }, { name: "Bleed", pct: 35 }],
  });
  assert.equal(p.bonuses[0].name, "Bleed", "the Bleed is what this knife is worth");
  assert.ok(p.estimate > 1.5e9, "got $" + (p.estimate / 1e6).toFixed(0) + "m; it sold for $2.22b");
});

test("one recorded sale does not price a different roll", () => {
  // The Orange Achilles curve is a single point, 76%. Returning its price for a
  // 61% weapon is not an estimate, it is a coincidence with a dollar sign.
  assert.equal(valueAtPct([[76, 200e6]], 61), null);
  // At the roll it actually recorded, it is a price.
  const same = valueAtPct([[76, 200e6]], 76);
  assert.equal(same.value, 200e6);
  assert.equal(same.extrapolated, false);
});

test("two points do not license an extrapolation", () => {
  // A line through two observations is a line through noise. Inside them,
  // interpolation is still fine.
  assert.equal(valueAtPct([[33, 2035e6], [34, 1752e6]], 35), null, "outside: refuse");
  const inside = valueAtPct([[33, 2035e6], [35, 1752e6]], 34);
  assert.ok(inside && !inside.extrapolated, "inside: interpolate");
});

test("an extrapolation below the range says so correctly", () => {
  // The note read "the best on record is 76%" for a 61% weapon, which is the
  // wrong end of the curve and reads as though the roll were exceptional.
  const p = priceItem(feed, {
    name: "Cobra Derringer", rarity: "Yellow", bonuses: [{ name: "Assassinate", pct: 30 }],
  });
  if (p.ok && p.extrapolated) {
    assert.ok(p.notes.some((n) => /lowest on record/i.test(n)),
      "a roll below every sale must say so: " + p.notes.join(" | "));
  }
});

test("an uncounted second bonus says which way the number is wrong", () => {
  // "isn't counted" tells the reader something is missing but not what to do
  // about it. Measured over 950 pairs that have both a pair comp and a single
  // one, the pair goes for about 1.4x the better single at the median -- so the
  // quoted number is a floor, and saying so is the difference between a caveat
  // and a warning. It is only a floor USUALLY: a quarter of pairs sell for less.
  const p = priceItem(feed, {
    name: "S&W Revolver", rarity: "Red",
    bonuses: [{ name: "Assassinate", pct: 70 }, { name: "Double-Tap", pct: 52 }],
  });
  assert.ok(p.notes.some((n) => /isn't counted/.test(n)));
  assert.ok(p.notes.some((n) => /floor/i.test(n)),
    "the reader must be told which way it is wrong: " + p.notes.join(" | "));
});
