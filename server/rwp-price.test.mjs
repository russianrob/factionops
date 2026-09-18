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

test("the weapon from the forum post is priced by its own sale", () => {
  // The first screenshot this was ever pointed at. It used to extrapolate to
  // ~$2.19b past the highest recorded Assassinate roll; that exact weapon --
  // 97% Assassinate AND 23% Specialist -- turns out to have sold for $6.1b.
  // A record of the card beats a trend drawn near it.
  const p = priceItem(feed, {
    name: "Cobra Derringer", rarity: "Orange",
    bonuses: [{ name: "Specialist", pct: 23 }, { name: "Assassinate", pct: 97 }],
  });
  assert.equal(p.ok, true);
  assert.match(p.basis, /this exact weapon/i);
  assert.ok(p.estimate > 5e9, "got $" + (p.estimate / 1e6).toFixed(0) + "m");
  assert.equal(p.extrapolated, false, "a sale is not an extrapolation");
  // Nothing was dropped, so nothing should warn that it was.
  assert.ok(!p.notes.some((n) => /isn't counted/.test(n)));
});

test("a high roll with no sale of its own still beats the pooled median", () => {
  // What the level curve is for, kept under test now that the exact rung
  // covers the case above: 50% and 67% are not one price.
  const p = priceItem(feed, {
    name: "Cobra Derringer", rarity: "Yellow", bonuses: [{ name: "Assassinate", pct: 67 }],
  });
  assert.match(p.basis, /matched to the 67%/);
  assert.ok(p.estimate > 200e6, "got $" + (p.estimate / 1e6).toFixed(0) + "m");
});

test("a sale of both bonuses beats a curve drawn from one", () => {
  const p = priceItem(feed, {
    name: "Cobra Derringer", rarity: "Orange",
    bonuses: [{ name: "Assassinate", pct: 60 }, { name: "Double-Tap", pct: 20 }],
  });
  assert.match(p.basis, /both Assassinate and Double-Tap/);
  assert.equal(p.extrapolated, false);
  assert.ok(p.samples >= 1);
  // Whatever rung answers, it must not be one that threw a bonus away.
  assert.ok(!p.notes.some((n) => /isn't counted/.test(n)));
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
  assert.ok(p.notes.some((n) => /all \d+ sales on record/i.test(n)),
    "no note naming the longer view: " + p.notes.join(" | "));
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
  assert.ok(p.notes.some((n) => /no colour was given/i.test(n)),
    "an inferred rarity must be declared: " + p.notes.join(" | "));
});

test("a rarity that IS given is never second-guessed", () => {
  const p = priceItem(feed, {
    name: "SIG 552", rarity: "Yellow", bonuses: [{ name: "Expose", pct: 9 }],
  });
  assert.equal(p.rarity, "Yellow");
  assert.ok(!p.notes.some((n) => /no colour was given/i.test(n)));
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
  // The property, not the number: a hardcoded count breaks every time the
  // market moves, which says nothing about the code.
  assert.ok(p.samples > 100 && p.samples < 2000,
    "expected the sales at 23% (hundreds), got " + p.samples + " — 4688 would be every roll");
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
  // A pair with no recorded sale at ANY roll — the case where the second bonus
  // genuinely cannot be priced. (The S&W that first showed this now has a sale
  // of its own pair and is priced off it.)
  const p = priceItem(feed, {
    name: "Dagger", rarity: "Yellow",
    bonuses: [{ name: "Empower", pct: 20 }, { name: "Achilles", pct: 40 }],
  });
  assert.ok(p.notes.some((n) => /isn't counted/.test(n)));
  assert.ok(p.notes.some((n) => /floor/i.test(n)),
    "the reader must be told which way it is wrong: " + p.notes.join(" | "));
});

// ── The exact weapon ───────────────────────────────────────────
// Every rung below this one is an estimate built from weapons that share
// SOME of what is on the card. When the very same weapon — both bonuses, both
// rolls — has sold, that is a record, and a record beats a model.

test("the exact weapon outranks every estimate", () => {
  const p = priceItem(feed, {
    name: "S&W Revolver", rarity: "Red",
    bonuses: [{ name: "Assassinate", pct: 70 }, { name: "Double-Tap", pct: 52 }],
  });
  assert.equal(p.ok, true, p.reason);
  // It sold for $2.14b. Pricing off one bonus gave $375m.
  assert.ok(p.estimate > 2e9, "got $" + (p.estimate / 1e6).toFixed(0) + "m");
  assert.match(p.basis, /this exact weapon/i);
  assert.ok(p.notes.some((n) => /2026-08-26/.test(n)), "the date belongs on a record: " + p.notes.join(" | "));
  // Nothing is missing from this number, so nothing should warn that it is.
  assert.ok(!p.notes.some((n) => /isn't counted|floor/i.test(n)));
});

test("which bonus was listed first does not matter", () => {
  const a = priceItem(feed, { name: "S&W Revolver", rarity: "Red",
    bonuses: [{ name: "Assassinate", pct: 70 }, { name: "Double-Tap", pct: 52 }] });
  const b = priceItem(feed, { name: "S&W Revolver", rarity: "Red",
    bonuses: [{ name: "Double-Tap", pct: 52 }, { name: "Assassinate", pct: 70 }] });
  assert.equal(a.estimate, b.estimate);
});

test("a different roll is a different weapon", () => {
  // 71% is not 70%. Matching it would turn a record back into a guess.
  const p = priceItem(feed, { name: "S&W Revolver", rarity: "Red",
    bonuses: [{ name: "Assassinate", pct: 71 }, { name: "Double-Tap", pct: 52 }] });
  assert.ok(!/this exact weapon/i.test(p.basis || ""), "got: " + p.basis);
});

test("a single sale is reported as a single sale", () => {
  const p = priceItem(feed, { name: "S&W Revolver", rarity: "Red",
    bonuses: [{ name: "Assassinate", pct: 70 }, { name: "Double-Tap", pct: 52 }] });
  assert.equal(p.samples, 1);
  assert.ok(p.notes.some((n) => /once/i.test(n)), p.notes.join(" | "));
});

// ── Bonus names as they are WRITTEN ────────────────────────────
// The reader returns what the card says: "Double Tap". Every price table says
// "Double-Tap". That one hyphen made the S&W Revolver miss its own sale
// record, rank the wrong bonus as the lead, and quote $353m for a weapon that
// had sold for $2.14b — the exact failure this rung was built to stop.

test("a bonus written with a space still finds its table", () => {
  const spaced = priceItem(feed, {
    name: "S&W Revolver", rarity: "Red",
    bonuses: [{ name: "Assassinate", pct: 70 }, { name: "Double Tap", pct: 52 }],
  });
  const hyphen = priceItem(feed, {
    name: "S&W Revolver", rarity: "Red",
    bonuses: [{ name: "Assassinate", pct: 70 }, { name: "Double-Tap", pct: 52 }],
  });
  assert.equal(spaced.estimate, hyphen.estimate, "a hyphen is not a different weapon");
  assert.match(spaced.basis, /this exact weapon/i);
  assert.ok(spaced.estimate > 2e9, "got $" + (spaced.estimate / 1e6).toFixed(0) + "m");
});

test("the resolved spelling is what gets reported back", () => {
  const p = priceItem(feed, {
    name: "S&W Revolver", rarity: "Red",
    bonuses: [{ name: "double tap", pct: 52 }],
  });
  assert.equal(p.bonuses[0].name, "Double-Tap");
});

test("a bonus that is not a bonus is left alone, not invented", () => {
  const p = priceItem(feed, {
    name: "S&W Revolver", rarity: "Red", bonuses: [{ name: "Nonsense", pct: 52 }],
  });
  // It must not be silently mapped onto a real bonus.
  assert.notEqual(p.bonuses[0] && p.bonuses[0].name, "Double-Tap");
});

// ── The nearest recorded pair ──────────────────────────────────
// A Beretta M9 with 107% Assassinate and 30% Double-Tap quoted $354m off one
// bonus, with a note that it was a floor. It was: the same weapon at 106% and
// 36% — one roll away on each — sold for $750.6m. The floor was half price and
// the evidence for that was already in the feed, unread.

test("the closest sale of the same pair is surfaced", () => {
  const p = priceItem(feed, {
    name: "Beretta M9", rarity: "Red",
    bonuses: [{ name: "Assassinate", pct: 107 }, { name: "Double Tap", pct: 30 }],
  });
  assert.equal(p.ok, true, p.reason);
  assert.ok(p.notes.some((n) => /closest/i.test(n) && /750|751/.test(n)),
    "the near-miss sale belongs on the badge: " + p.notes.join(" | "));
  // And the price now comes from that pair rather than from half the weapon.
  assert.ok(p.estimate > 600e6, "got $" + (p.estimate / 1e6).toFixed(0) + "m");
});

test("the near-miss names the rolls it actually was", () => {
  const p = priceItem(feed, {
    name: "Beretta M9", rarity: "Red",
    bonuses: [{ name: "Assassinate", pct: 107 }, { name: "Double-Tap", pct: 30 }],
  });
  const note = p.notes.find((n) => /closest/i.test(n)) || "";
  assert.match(note, /106%/);
  assert.match(note, /36%/);
  assert.match(note, /2026-03-08/);
});

test("a roll nowhere near is not offered as a comparison", () => {
  // Two weapons sharing a bonus pair at wildly different rolls are not
  // comparable, and calling one "closest" would imply they were.
  const p = priceItem(feed, {
    name: "Beretta M9", rarity: "Red",
    bonuses: [{ name: "Assassinate", pct: 50 }, { name: "Double-Tap", pct: 5 }],
  });
  assert.ok(!p.notes.some((n) => /closest/i.test(n)), p.notes.join(" | "));
});

test("an exact match does not also report a near-miss", () => {
  const p = priceItem(feed, {
    name: "S&W Revolver", rarity: "Red",
    bonuses: [{ name: "Assassinate", pct: 70 }, { name: "Double-Tap", pct: 52 }],
  });
  assert.ok(!p.notes.some((n) => /closest/i.test(n)));
});

// ── Both bonuses, whatever the rolls ───────────────────────────
// Measured leave-one-out over 1,708 two-bonus sales from the last year:
//
//   single-bonus median (what this did)   median |log err| 0.442   71.5% within 2x
//   same pair, any rolls                                   0.175   94.7% within 2x
//
// The data was already there. 1,551 of 2,246 weapon+pair+rarity groups have
// recorded sales but no pair-combo entry, because that table drops anything
// under three sales — so two thirds of all pairs fell through to the method
// that is two and a half times worse.

test("a pair with only one sale still prices off that pair", () => {
  const p = priceItem(feed, {
    name: "Beretta M9", rarity: "Red",
    bonuses: [{ name: "Assassinate", pct: 107 }, { name: "Double Tap", pct: 30 }],
  });
  assert.equal(p.ok, true, p.reason);
  // The single-bonus fallback said $354m. The pair sold for $750.6m.
  assert.ok(p.estimate > 600e6, "got $" + (p.estimate / 1e6).toFixed(0) + "m");
  assert.match(p.basis, /both Assassinate and Double-Tap/);
  assert.equal(p.samples, 1);
});

test("both bonuses counted means no floor warning", () => {
  const p = priceItem(feed, {
    name: "Beretta M9", rarity: "Red",
    bonuses: [{ name: "Assassinate", pct: 107 }, { name: "Double-Tap", pct: 30 }],
  });
  assert.ok(!p.notes.some((n) => /isn't counted|floor/i.test(n)),
    "nothing was dropped: " + p.notes.join(" | "));
});

test("the rolls it actually sold at are still named", () => {
  const p = priceItem(feed, {
    name: "Beretta M9", rarity: "Red",
    bonuses: [{ name: "Assassinate", pct: 107 }, { name: "Double-Tap", pct: 30 }],
  });
  assert.ok(p.notes.some((n) => /106%/.test(n) && /36%/.test(n)),
    "a price off different rolls must say which: " + p.notes.join(" | "));
});

test("an exact match still outranks the pooled pair", () => {
  const p = priceItem(feed, {
    name: "S&W Revolver", rarity: "Red",
    bonuses: [{ name: "Assassinate", pct: 70 }, { name: "Double-Tap", pct: 52 }],
  });
  assert.match(p.basis, /this exact weapon/i);
});

test("a single-bonus weapon is untouched by any of this", () => {
  const p = priceItem(feed, {
    name: "SIG 552", rarity: "Yellow", bonuses: [{ name: "Expose", pct: 9 }],
  });
  assert.match(p.basis, /matched to the 9%/);
  assert.ok(!/both bonuses/i.test(p.basis));
});

// ── A roll outside its rarity's band ───────────────────────────
// An ArmaLite M-15A4 with 82% Achilles and 17% Warlord. The weapon is Orange
// because of the Achilles; the 17% Warlord is a YELLOW-band roll. Looking up
// "Orange Warlord at 17%" asks for something that cannot exist as a single-
// bonus sale — Orange Warlords start at 20% — so the curve was extrapolated
// below its own floor and returned $1.43b.
//
// Yellow recorded 17% Warlord twenty-two times, at $755m. An exact roll
// somebody actually sold beats a line drawn past the end of a different one.

test("an exact roll at another rarity beats extrapolating this one", () => {
  const p = priceItem(feed, {
    name: "ArmaLite M-15A4", rarity: "Orange",
    bonuses: [{ name: "Warlord", pct: 17 }],
  });
  assert.equal(p.ok, true, p.reason);
  assert.equal(p.extrapolated, false, "there is a real sale at this roll");
  assert.ok(p.estimate > 600e6 && p.estimate < 900e6,
    "got $" + (p.estimate / 1e6).toFixed(0) + "m; Yellow sold 22 of them at $755m");
  assert.ok(p.notes.some((n) => /Yellow/.test(n)),
    "borrowing another rarity's sales must be declared: " + p.notes.join(" | "));
});

test("a roll inside the band still uses its own rarity", () => {
  const p = priceItem(feed, {
    name: "ArmaLite M-15A4", rarity: "Orange",
    bonuses: [{ name: "Warlord", pct: 23 }],
  });
  assert.match(p.basis, /an Orange ArmaLite M-15A4 with Warlord/);
  assert.ok(!p.notes.some((n) => /Yellow/.test(n)));
  assert.ok(p.estimate > 2e9, "got $" + (p.estimate / 1e6).toFixed(0) + "m");
});

test("the ArmaLite from the table is not priced off its cheaper bonus", () => {
  // The table pricer ranked by percentage: 82% beat 17%, so it priced the
  // Achilles and ignored a Warlord worth more on its own than the whole
  // estimate. Achilles at 82% is ~$492m; Warlord at 17% is ~$755m.
  const p = priceItem(feed, {
    name: "ArmaLite M-15A4", rarity: "Orange",
    bonuses: [{ name: "Achilles", pct: 82 }, { name: "Warlord", pct: 17 }],
  });
  assert.equal(p.bonuses[0].name, "Warlord", "the Warlord is what this is worth");
  assert.ok(p.estimate > 600e6, "got $" + (p.estimate / 1e6).toFixed(0) + "m");
});

test("a nameless reading is named by its shop price", () => {
  // Distinct from the "M16A4" case: there the name was wrong, here there is
  // none at all, which is what a cropped card now honestly returns.
  const buys = { "kodachi": 95000, "armalite m-15a4": 20000000 };
  assert.equal(weaponByBuyPrice(feed, buys, 95000), "Kodachi");
});

test("any bonus may place the rarity, not only the leading one", () => {
  // A post that states no colour: Diamond Bladed Knife, 61% Achilles and 35%
  // Bleed. The Bleed leads because it is worth more, but 35% Bleed sold at no
  // single rarity so it cannot place the weapon — while 61% Achilles sold only
  // as Yellow and can. Asking just the lead gave up and priced nothing.
  const p = priceItem(feed, {
    name: "Diamond Bladed Knife", rarity: null,
    bonuses: [{ name: "Achilles", pct: 61 }, { name: "Bleed", pct: 35 }],
  });
  assert.equal(p.ok, true, p.reason);
  assert.ok(p.rarity, "a colour should have been worked out");
  assert.ok(p.estimate > 0);
});

test("a recorded sale of this exact pair names the rarity outright", () => {
  // A post with no colour: Cobra Derringer, 97% Assassinate and 23% Specialist.
  // Inferring from the Specialist gave Yellow — its Yellow band is 20-27 — and
  // priced $434m. The weapon is Orange, and not by inference: that exact pair
  // at those exact rolls has SOLD, once, for $6.1b. A record outranks a band.
  const p = priceItem(feed, {
    name: "Cobra Derringer", rarity: null,
    bonuses: [{ name: "Assassinate", pct: 97 }, { name: "Specialist", pct: 23 }],
  });
  assert.equal(p.rarity, "Orange");
  assert.ok(p.estimate > 5e9, "got $" + (p.estimate / 1e6).toFixed(0) + "m");
  assert.match(p.basis, /this exact weapon/i);
});

test("two bonuses are never inferred as Yellow from a roll", () => {
  // Of 8,004 recorded two-bonus sales, exactly zero were Yellow. A roll that
  // sits in a Yellow band therefore cannot place a two-bonus weapon there.
  assert.equal(rarityForRoll(feed, "Cobra Derringer", "Specialist", 23), "Yellow");
  assert.equal(rarityForRoll(feed, "Cobra Derringer", "Specialist", 23, 2), null);
});

test("a single-bonus weapon is still placed as Yellow when the roll says so", () => {
  assert.equal(rarityForRoll(feed, "Cobra Derringer", "Specialist", 23, 1), "Yellow");
});

// ── Explaining the number, not apologising for it ──────────────
// "This ignores the 50%" tells the reader what the pricer failed to do. What
// they want to know is why the number is what it is — and the answer is
// usually that nothing sold at their roll, while something sold either side
// of it. Those neighbouring sales exist; they were just never shown, because
// a roll with one or two sales is too thin to PRICE from. It is not too thin
// to quote.

test("a roll-agnostic price names the rolls that did sell", () => {
  // Red Glock 17 with Wither: 47% sold twice and 55% once, so no roll reaches
  // the three needed for a curve and the price is the median of all three.
  const p = priceItem(feed, {
    name: "Glock 17", rarity: "Red", bonuses: [{ name: "Wither", pct: 50 }],
  });
  assert.equal(p.ok, true, p.reason);
  const why = p.notes.join(" | ");
  assert.match(why, /nothing.*sold at 50%/i, "say what is missing: " + why);
  assert.match(why, /47%/, "and what did sell: " + why);
  assert.match(why, /55%/, why);
});

test("the neighbouring sales are quoted with their prices and counts", () => {
  const p = priceItem(feed, {
    name: "Glock 17", rarity: "Red", bonuses: [{ name: "Wither", pct: 50 }],
  });
  const why = p.notes.find((n) => /47%/.test(n)) || "";
  assert.match(why, /\$659m|\$658m/, "the 47% median: " + why);
  assert.match(why, /\$1\.00b/, "the 55% sale: " + why);
  assert.match(why, /2 sales/, "how thin each one is: " + why);
});

test("a roll above everything recorded says so", () => {
  // Nothing either side, only below: the note must not invent an upper neighbour.
  const p = priceItem(feed, {
    name: "Glock 17", rarity: "Red", bonuses: [{ name: "Wither", pct: 80 }],
  });
  if (p.ok && p.notes.some((n) => /nothing.*sold at 80%/i.test(n))) {
    const why = p.notes.find((n) => /nothing.*sold at 80%/i.test(n));
    assert.ok(!/above/.test(why) || /55%/.test(why), "only real neighbours: " + why);
  }
});

test("the word 'ignores' is gone from the roll-agnostic note", () => {
  const p = priceItem(feed, {
    name: "Glock 17", rarity: "Red", bonuses: [{ name: "Wither", pct: 50 }],
  });
  assert.ok(!p.notes.some((n) => /ignores the 50%/.test(n)),
    "it explains instead: " + p.notes.join(" | "));
});

// ── An extrapolation that contradicts itself ───────────────────
// "matched to the 40%. 25 sales" next to "nothing this good has ever sold —
// the best on record is 38%". Both cannot be true, and neither was quite: a
// 40% Weaken Orange Jackhammer HAS sold, once, for $308m. It misses the
// three-sale bar for the curve, so the curve extrapolated past 38% and the
// note reported the curve's world rather than the record.

test("an extrapolated price does not claim to be matched to the roll", () => {
  const p = priceItem(feed, {
    name: "Jackhammer", rarity: "Orange", bonuses: [{ name: "Weaken", pct: 40 }],
  });
  assert.equal(p.ok, true, p.reason);
  assert.equal(p.extrapolated, true);
  assert.ok(!/matched to the 40%/.test(p.basis),
    "it is not matched to anything: " + p.basis);
});

test("the sales it quotes are declared as being at other rolls", () => {
  const p = priceItem(feed, {
    name: "Jackhammer", rarity: "Orange", bonuses: [{ name: "Weaken", pct: 40 }],
  });
  // 25 sales across every roll, not 25 at 40%.
  assert.match(p.basis, /other rolls/i, p.basis);
});

test("a roll that HAS sold is never called unsold", () => {
  const p = priceItem(feed, {
    name: "Jackhammer", rarity: "Orange", bonuses: [{ name: "Weaken", pct: 40 }],
  });
  const why = p.notes.join(" | ");
  assert.ok(!/Nothing this good has ever sold/.test(why),
    "40% sold once for $308m: " + why);
  assert.match(why, /40%/, why);
  assert.match(why, /308|309/, "the sale it actually made: " + why);
});

test("a roll nothing has ever sold at still says so", () => {
  // 99% Weaken really has no sale at any depth.
  const p = priceItem(feed, {
    name: "Jackhammer", rarity: "Orange", bonuses: [{ name: "Weaken", pct: 99 }],
  });
  if (p.ok && p.extrapolated) {
    assert.match(p.notes.join(" | "), /Nothing this good has ever sold/);
  }
});

test("a matched roll still says matched", () => {
  const p = priceItem(feed, {
    name: "Jackhammer", rarity: "Orange", bonuses: [{ name: "Weaken", pct: 33 }],
  });
  assert.match(p.basis, /matched to the 33%/);
  assert.equal(p.extrapolated, false);
});

test("the all-time note says how many sales back it", () => {
  // "3 sales" looks thin and invites widening the window. Measured, widening it
  // to three years nearly doubles the error (median |log err| 0.075 -> 0.140),
  // because RW prices fall about a quarter a year and older sales are a
  // different market. What helps is saying how much evidence the longer view
  // actually holds, so the reader can weigh it themselves.
  const p = priceItem(feed, {
    name: "SIG 552", rarity: "Yellow", bonuses: [{ name: "Expose", pct: 9 }],
  });
  const back = p.notes.find((n) => /on record/i.test(n));
  assert.ok(back, "expected the longer-view note: " + p.notes.join(" | "));
  assert.match(back, /\d+ sales/, "with its sample size: " + back);
});

test("the longer view names its window and its size", () => {
  // "These are the last year's prices. Going all the way back it's $1.23b
  // across 31 sales" left two questions unanswered: which prices are the last
  // year's, and how far back is "all the way"? For this weapon it is three
  // years, not the dataset's eleven.
  const p = priceItem(feed, {
    name: "SIG 552", rarity: "Yellow", bonuses: [{ name: "Expose", pct: 9 }],
  });
  const back = p.notes.find((n) => /\d+ sales/.test(n) && /\$/.test(n));
  assert.ok(back, "expected the longer-view note: " + p.notes.join(" | "));
  assert.match(back, /last 12 months/i, "say which window the price used: " + back);
  assert.match(back, /back to (19|20)\d\d/, "and how far the other one reaches: " + back);
  assert.ok(!/all the way back/i.test(back), "vague: " + back);
});
