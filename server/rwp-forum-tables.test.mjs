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
  v("WEAPON_CLASS"), v("COMBO_MIN_SAMPLES"), v("LEVEL_MIN_SAMPLES"),
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
  fn("forumHeaderMap"), fn("forumBonusPairs"), fn("forumRarityIn"), fn("forumRowItem"), fn("rarityFromRoll"), fn("forumBonusWorth"), fn("priceForumRow"),
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

// ── Price LISTS written as lines, not tables ───────────────────
// The other way people post stock: one line per weapon, grouped under a
// heading per bonus. Everything needed is there in the text.
//
//   Guandao - 68% (swan)Grace • 51% (angry)Berserk - Red - Q:227.77% - 77.00/43.78
//
// Emoji sit flush against the bonus name, two bonuses are joined by a bullet,
// and the separator is a SPACED hyphen so "Tavor TAR-21" survives it.
const line = (() => {
  vm.runInContext([v("RARITY_WORD"), fn("forumLineItem"), "globalThis.__line = forumLineItem;"].join("\n"), sandbox);
  return sandbox.__line;
})();

test("a line becomes an item", () => {
  const r = line("Samurai Sword - 27% \u{1FA78}Bleed - Yellow - Q:110.73% - 64.43/56.65");
  assert.equal(r.name, "Samurai Sword");
  assert.equal(r.rarity, "Yellow");
  assert.equal(JSON.stringify(r.bonuses), JSON.stringify([{ name: "Bleed", level: 27 }]));
});

test("the emoji in front of the bonus is not part of its name", () => {
  const r = line("Mag 7 - 15% \u{1FAC0}Eviscerate - Yellow - Q:100.69% - 62.43/65.64");
  assert.equal(r.bonuses[0].name, "Eviscerate");
});

test("two bonuses joined by a bullet are both kept", () => {
  const r = line("Guandao - 68% \u{1F9A2}Grace • 51% \u{1F620}Berserk - Red - Q:227.77% - 77.00/43.78");
  assert.equal(r.rarity, "Red");
  assert.equal(r.bonuses.length, 2);
  // Biggest roll leads.
  assert.equal(r.bonuses[0].name, "Grace");
  assert.equal(r.bonuses[0].level, 68);
  assert.equal(r.bonuses[1].level, 51);
});

test("a hyphen inside a weapon name is not a separator", () => {
  for (const [text, want] of [
    ["Tavor TAR-21 - 9% \u{1F440}Expose - Yellow - Q:110.32%", "Tavor TAR-21"],
    ["AK-47 - 7% \u{1F6E1}Disarm - Orange - Q:142.4%", "AK-47"],
    ["ArmaLite M-15A4 - 25% \u{1F3AF}Deadeye - Yellow - Q:109.62%", "ArmaLite M-15A4"],
  ]) assert.equal(line(text).name, want, text);
});

test("prose is not mistaken for stock", () => {
  assert.equal(line("Selling only these below:"), null);
  assert.equal(line("Happy to hear offers - will respond as soon as possible"), null);
  assert.equal(line(""), null);
  assert.equal(line("Samurai Sword - 27% NotARealBonus - Yellow"), null,
    "an unrecognised bonus is not guessed at");
});

test("a stated rarity is used, not re-derived", () => {
  // The line says Orange outright. Working it back out of the roll would be
  // second-guessing something the seller actually wrote down.
  const r = line("AK-47 - 7% \u{1F6E1}Disarm - Orange - Q:142.4% - 64.78/57.46");
  assert.equal(r.rarity, "Orange");
  const p = priceForumRow(r);
  assert.equal(p.rarity, "Orange");
  assert.equal(p.inferred, false);
});

test("every line of the posted list prices", () => {
  const lines = [
    "Guandao - 68% \u{1F9A2}Grace • 51% \u{1F620}Berserk - Red - Q:227.77% - 77.00/43.78",
    "Samurai Sword - 27% \u{1FA78}Bleed - Yellow - Q:110.73% - 64.43/56.65",
    "ArmaLite M-15A4 - 25% \u{1F3AF}Deadeye - Yellow - Q:109.62% - 73.91/62.05",
    "Enfield SA-80 - 35% \u{1F3AF}Deadeye - Yellow - Q:113.29% - 69.98/59.35",
    "Qsz-92 - 41% \u{1F3AF}Deadeye - Yellow - Q:101.89% - 68.35/56.84",
    "AK-47 - 7% \u{1F6E1}Disarm - Orange - Q:142.4% - 64.78/57.46",
    "Mag 7 - 15% \u{1FAC0}Eviscerate - Yellow - Q:100.69% - 62.43/65.64",
    "Cobra Derringer - 16% ⚔Execute - Yellow - Q:101.1% - 67.11/57.00",
    "ArmaLite M-15A4 - 8% \u{1F440}Expose - Yellow - Q:104.94% - 74.51/60.98",
    "Enfield SA-80 - 8% \u{1F440}Expose - Yellow - Q:109.78% - 70.16/58.82",
    "Tavor TAR-21 - 9% \u{1F440}Expose - Yellow - Q:110.32% - 72.16/55.87",
  ];
  const missed = [];
  for (const t of lines) {
    const it = line(t);
    const p = it && priceForumRow(it);
    if (!p || !(p.value > 0)) missed.push(t.slice(0, 40));
  }
  assert.equal(JSON.stringify(missed), "[]", "lines that did not price: " + missed.join(" | "));
});

// ── Reassembling a line from the spans Torn shreds it into ─────
const seg = (() => {
  vm.runInContext([fn("forumLineSegments"), fn("segmentText"),
    "globalThis.__seg = forumLineSegments; globalThis.__segText = segmentText;"].join("\n"), sandbox);
  return { split: sandbox.__seg, text: sandbox.__segText };
})();

const T = (v) => ({ nodeType: 3, nodeValue: v, textContent: v });
const BR = () => ({ nodeType: 1, nodeName: "BR", classList: { contains: () => false } });
const SPAN = (v, cls) => ({ nodeType: 1, nodeName: "SPAN", textContent: v,
                            classList: { contains: (c) => c === cls } });
const HOST = (kids) => ({ nodeType: 1, childNodes: kids });

test("a line shredded across coloured spans is put back together", () => {
  // This is how Torn renders it: the percentage green, the bonus green, the
  // rarity its own colour. No single element holds the line.
  const host = HOST([
    T("Samurai Sword - "), SPAN("27%"), SPAN(" \u{1FA78}Bleed"), T(" - "),
    SPAN("Yellow"), T(" - Q:110.73% - 64.43/56.65"), BR(),
    T("Cobra Derringer - "), SPAN("16%"), SPAN(" ⚔Execute"), T(" - "),
    SPAN("Yellow"), T(" - Q:101.1%"),
  ]);
  const segs = seg.split(host);
  assert.equal(segs.length, 2, "one segment per <br>-separated line");
  const first = line(seg.text(segs[0]));
  assert.equal(first.name, "Samurai Sword");
  assert.equal(first.bonuses[0].name, "Bleed");
  assert.equal(first.rarity, "Yellow");
  const second = line(seg.text(segs[1]));
  assert.equal(second.name, "Cobra Derringer");
});

test("a price already added is not read back into the next line", () => {
  // The badge is a sibling in the same run of nodes. Letting it back in would
  // feed "$251m" into the text the parser reads.
  const host = HOST([
    T("Samurai Sword - 27% Bleed - Yellow"), SPAN("≈ $251m", "rwp-tbl-cell"), BR(),
  ]);
  const text = seg.text(seg.split(host)[0]);
  assert.ok(!/251/.test(text), "our own badge must be excluded: " + text);
  assert.equal(line(text).name, "Samurai Sword");
});

test("a run with no break is still one line", () => {
  const host = HOST([T("Mag 7 - 15% Eviscerate - Yellow - Q:100.69%")]);
  const segs = seg.split(host);
  assert.equal(segs.length, 1);
  assert.equal(line(seg.text(segs[0])).name, "Mag 7");
});

test("empty lines do not become segments", () => {
  const host = HOST([BR(), BR(), T("AK-47 - 7% Disarm - Orange"), BR(), BR()]);
  const segs = seg.split(host);
  assert.equal(segs.length, 1, "consecutive breaks must not produce empty segments");
});

// ── A table that names its columns differently ─────────────────
// Name | Type | Rarity | Bonus | Value | Damage
//
// Three things the first parser could not do: the percentage column is called
// "Value", the rarity is a column of its own, and a two-bonus weapon puts both
// names in one cell with both percentages in another.
const HEADER2 = ["Name", "Type", "Rarity", "Bonus", "Value", "Damage"];
const findPct = (() => {
  vm.runInContext([fn("forumFindPctColumn"), fn("forumBonusNames"),
    "globalThis.__fp = forumFindPctColumn;"].join("\n"), sandbox);
  return sandbox.__fp;
})();

test("a percentage column is found by what is in it, not its name", () => {
  // "Value" could mean anything; the cells cannot. Every one of them is a
  // percentage, and no other column is.
  const m = forumHeaderMap(HEADER2);
  assert.equal(m.weapon, 0);
  assert.equal(m.bonus, 3);
  assert.equal(m.pct, -1, "no header here says percentage");
  const rows = [
    ["Qsz-92", "Secondary", "Yellow", "Achilles", "51%", "70.91"],
    ["Enfield SA-80", "Primary", "Yellow", "Assassinate", "57%", "70.23"],
    ["Macana", "Melee", "Yellow", "Bleed", "29%", "62.72"],
  ];
  assert.equal(findPct(rows, m), 4);
});

test("a rarity column is used rather than worked out", () => {
  const m = forumHeaderMap(HEADER2);
  assert.equal(m.rarity, 2);
  const r = forumRowItem(["Qsz-92", "Secondary", "Yellow", "Achilles", "51%", "70.91"],
    { weapon: 0, bonus: 3, pct: 4, rarity: 2 });
  assert.equal(r.rarity, "Yellow");
  assert.equal(r.bonuses[0].name, "Achilles");
  assert.equal(r.bonuses[0].level, 51);
});

test("two bonuses sharing a cell are both read", () => {
  // The cell holds "Achilles Warlord" and the one beside it "82% 17%".
  const r = forumRowItem(["ArmaLite M-15A4", "Primary", "Orange", "Achilles Warlord", "82% 17%", "80.58"],
    { weapon: 0, bonus: 3, pct: 4, rarity: 2 });
  assert.equal(r.bonuses.length, 2);
  assert.equal(JSON.stringify(Array.from(r.bonuses).map((b) => b.name + " " + b.level).sort()),
               JSON.stringify(["Achilles 82", "Warlord 17"]));
});

test("a two-word bonus is not split into two", () => {
  // "Sure Shot" is one bonus. Splitting on the space would invent a "Shot".
  assert.equal(JSON.stringify(Array.from(sandbox.forumBonusNames("Sure Shot"))), JSON.stringify(["Sure Shot"]));
  assert.equal(JSON.stringify(Array.from(sandbox.forumBonusNames("Double Tap"))), JSON.stringify(["Double-Tap"]));
  // ...but two one-word bonuses in a cell still come back as two.
  assert.equal(JSON.stringify(Array.from(sandbox.forumBonusNames("Achilles Warlord"))),
               JSON.stringify(["Achilles", "Warlord"]));
});

test("every row of this table prices", () => {
  const m = { weapon: 0, bonus: 3, pct: 4, rarity: 2 };
  const rows = [
    ["Qsz-92", "Secondary", "Yellow", "Achilles", "51%"],
    ["ArmaLite M-15A4", "Primary", "Orange", "Achilles Warlord", "82% 17%"],
    ["Enfield SA-80", "Primary", "Yellow", "Assassinate", "57%"],
    ["Fiveseven", "Secondary", "Orange", "Assassinate Quicken", "81% 50%"],
    ["Diamond Bladed Knife", "Melee", "Yellow", "Backstab", "37%"],
    ["Macana", "Melee", "Yellow", "Bleed", "29%"],
    ["Jackhammer", "Primary", "Yellow", "Bleed", "24%"],
    ["Scimitar", "Melee", "Yellow", "Bleed", "23%"],
    ["Rheinmetall MG 3", "Primary", "Yellow", "Blindfire", "16%"],
    ["Kodachi", "Melee", "Yellow", "Bloodlust", "12%"],
    ["M4A1 Colt Carbine", "Primary", "Orange", "Conserve Deadeye", "27% 57%"],
  ];
  const missed = [];
  for (const cells of rows) {
    const item = forumRowItem(cells, m);
    const p = item && priceForumRow(item);
    if (!p || !(p.value > 0)) missed.push(cells[0] + " " + cells[3]);
  }
  assert.equal(JSON.stringify(missed), "[]", "rows that did not price: " + missed.join(" | "));
});

test("two lines in one cell do not run together", () => {
  // <td><div>Achilles</div><div>Warlord</div></td> has textContent
  // "AchillesWarlord" — no space anywhere, because there is no text between
  // the divs. Read that way the cell names one bonus that does not exist.
  vm.runInContext([fn("forumCellText"), "globalThis.__ct = forumCellText;"].join("\n"), sandbox);
  const el = (kids) => ({ nodeType: 1, childNodes: kids, classList: { contains: () => false } });
  const txt = (v) => ({ nodeType: 3, nodeValue: v });
  const cell = el([el([txt("Achilles")]), el([txt("Warlord")])]);
  const out = sandbox.__ct(cell);
  assert.match(out, /Achilles\s+Warlord/, "got: " + JSON.stringify(out));
  assert.equal(JSON.stringify(Array.from(sandbox.forumBonusNames(out))),
               JSON.stringify(["Achilles", "Warlord"]));
});

test("a table row is priced off its valuable bonus, not its bigger number", () => {
  // ArmaLite M-15A4, Orange, "Achilles Warlord" / "82% 17%". Ranking by
  // percentage picked the Achilles (~$492m) and ignored a Warlord worth ~$755m
  // on its own — more than the whole estimate it produced.
  const r = forumRowItem(["ArmaLite M-15A4", "Primary", "Orange", "Achilles Warlord", "82% 17%"],
    { weapon: 0, bonus: 3, pct: 4, rarity: 2 });
  const p = priceForumRow(r);
  assert.ok(p, "expected a price");
  assert.equal(p.bonuses[0].name, "Warlord", "the Warlord is what this weapon is worth");
  assert.ok(p.value > 600e6, "got $" + (p.value / 1e6).toFixed(0) + "m");
});

// ── A table with no percentage column at all ───────────────────
// Weapon | Type | Bonuses | Quality | Dam | Accu | Price
//
// The percentages are inside the Bonuses cell, interleaved with the names:
// "29% Motivation 30% Powerful". And the rarity is inside the Quality cell,
// "265% Red", rather than a column of its own. With no column that is purely
// percentages, the content sniffer found nothing and the whole table was
// skipped.
const pairs = (() => {
  vm.runInContext([fn("forumBonusPairs"), "globalThis.__bp = forumBonusPairs;"].join("\n"), sandbox);
  return sandbox.__bp;
})();

test("percentages and names read out of one cell", () => {
  assert.equal(JSON.stringify(Array.from(pairs("29% Motivation 30% Powerful"))),
               JSON.stringify([{ name: "Motivation", level: 29 }, { name: "Powerful", level: 30 }]));
  assert.equal(JSON.stringify(Array.from(pairs("4% Rage 9% Frenzy"))),
               JSON.stringify([{ name: "Rage", level: 4 }, { name: "Frenzy", level: 9 }]));
});

test("a single bonus in that shape still reads", () => {
  assert.equal(JSON.stringify(Array.from(pairs("43% Wither"))),
               JSON.stringify([{ name: "Wither", level: 43 }]));
});

test("a two-word bonus in that shape is not split", () => {
  assert.equal(JSON.stringify(Array.from(pairs("30% Sure Shot 12% Rage"))),
               JSON.stringify([{ name: "Sure Shot", level: 30 }, { name: "Rage", level: 12 }]));
});

test("rolls above 100% are read, not truncated", () => {
  // "127% Empower" and "102% Quicken" are real rolls on this table.
  assert.equal(JSON.stringify(Array.from(pairs("20% Plunder 127% Empower"))),
               JSON.stringify([{ name: "Plunder", level: 20 }, { name: "Empower", level: 127 }]));
});

test("a cell with no recognisable bonus yields nothing", () => {
  assert.equal(pairs("Primary").length, 0);
  assert.equal(pairs("65.62").length, 0);
  assert.equal(pairs("").length, 0);
});

test("the rarity is found inside the quality cell", () => {
  const m = forumHeaderMap(["Weapon", "Type", "Bonuses", "Quality", "Dam", "Accu", "Price"]);
  assert.equal(m.weapon, 0);
  assert.equal(m.bonus, 2);
  assert.equal(m.pct, -1, "there is no percentage column here");
  const r = forumRowItem(["Bushmaster Carbon 15", "Primary", "29% Motivation 30% Powerful",
                          "265% Red", "65.62", "67.98", "$5b"], m);
  assert.equal(r.rarity, "Red", "the colour is in the Quality cell");
  assert.equal(r.bonuses.length, 2);
});

test("every row of this table prices", () => {
  const m = forumHeaderMap(["Weapon", "Type", "Bonuses", "Quality", "Dam", "Accu", "Price"]);
  const rows = [
    ["Bushmaster Carbon 15", "Primary", "29% Motivation 30% Powerful", "265% Red", "65.62", "67.98", "$5b"],
    ["Macana", "Melee", "4% Rage 9% Frenzy", "144% Orange", "65.99", "70.44", "$3.8b"],
    ["Naval Cutlass", "Melee", "20% Plunder 127% Empower", "178% Orange", "73.94", "59.9", "$3.5b"],
    ["Naval Cutlass", "Melee", "20% Motivation 5% Frenzy", "155% Orange", "73.73", "57.83", "$1.5b"],
    ["Naval Cutlass", "Melee", "55% Throttle 102% Quicken", "200% Orange", "75.22", "60.82", "$900m"],
    ["Thompson", "Primary", "43% Wither", "271% Red", "56.65", "52.51", "$500m"],
    ["Beretta 92FS", "Secondary", "17% Expose", "248% Red", "63.94", "59.88", "$1.2b"],
    ["Magnum", "Secondary", "96% Deadeye", "257% Red", "69.14", "49.64", "$700m"],
  ];
  const missed = [];
  for (const cells of rows) {
    const item = forumRowItem(cells, m);
    const p = item && priceForumRow(item);
    if (!p || !(p.value > 0)) missed.push(cells[0] + " — " + cells[2]);
  }
  assert.equal(JSON.stringify(missed), "[]", "rows that did not price: " + missed.join(" | "));
});

test("the seller's own price column is never read as a bonus roll", () => {
  // "$5b" and "$900m" sit in a column called Price. Mistaking one for a
  // percentage would price the weapon off the number the seller chose.
  const m = forumHeaderMap(["Weapon", "Type", "Bonuses", "Quality", "Dam", "Accu", "Price"]);
  const r = forumRowItem(["Thompson", "Primary", "43% Wither", "271% Red", "56.65", "52.51", "$500m"], m);
  assert.equal(r.bonuses.length, 1);
  assert.equal(r.bonuses[0].level, 43);
});

// ── Pipe-delimited lines ───────────────────────────────────────
// A fourth shape, and prose again rather than a table:
//
//   Yasukuni Sword | orange | 12% Bloodlust | Dmg:75.00 | Acc:54.64 | Q:156.39% | Price: 1b
//   Kodachi | red | 38% Double-edged + 75%Throttle | Q: 236.22% | Dmg:76.24 | ...
//
// The separator is a pipe, the rarity is its own field in lower case, two
// bonuses are joined by "+", and the fields arrive in no fixed order.

test("a pipe-delimited line reads", () => {
  const r = line("Yasukuni Sword | orange | 12% Bloodlust | Dmg:75.00 | Acc:54.64 | Q:156.39% | Price: 1b");
  assert.equal(r.name, "Yasukuni Sword");
  assert.equal(r.rarity, "Orange", "a lower-case colour is still a colour");
  assert.equal(JSON.stringify(Array.from(r.bonuses)), JSON.stringify([{ name: "Bloodlust", level: 12 }]));
});

test("bonuses joined by a plus are both read", () => {
  const r = line("Kodachi | red | 38% Double-edged + 75%Throttle | Q: 236.22% | Dmg:76.24 | Acc:65.38 | Price: 5b");
  assert.equal(r.rarity, "Red");
  assert.equal(r.bonuses.length, 2);
  // Note "75%Throttle" — no space after the percent sign.
  assert.equal(JSON.stringify(Array.from(r.bonuses).map((b) => b.name + " " + b.level).sort()),
               JSON.stringify(["Double-Edged 38", "Throttle 75"]));
});

test("the fields are found wherever they sit, not by position", () => {
  // One line puts Q before Dmg, another after. Only the weapon leads.
  const a = line("Thompson | orange | 20% Warlord | Q:154.37% | Dmg: 47.97 | Acc: 49.46 | Price: 500m");
  const b = line("Samurai Sword | orange | 20% Plunder + 17% Double-edged | Q: 186.32% | Dmg: 69.84 | Acc: 58.80 | Price: 1.5b");
  assert.equal(a.bonuses[0].name, "Warlord");
  assert.equal(b.bonuses.length, 2);
});

test("damage, accuracy, quality and price are never read as bonuses", () => {
  // Every one of these carries digits and some carry a percent sign. A quality
  // of 236.22% read as a bonus roll would price a weapon off its own quality.
  const r = line("Scimitar | yellow | 50% Parry | Q: 114.01% | Dmg: 47.77 | Acc: 61.63 | Price: 168m");
  assert.equal(r.bonuses.length, 1, JSON.stringify(r.bonuses));
  assert.equal(r.bonuses[0].name, "Parry");
  assert.equal(r.bonuses[0].level, 50);
});

test("a non-numeric price does not stop the line", () => {
  const r = line("AK74U | red | 40% Warlord | Q: 262.47% | Dmg: 60.96 | Acc: 52.29 | Price: offer");
  assert.equal(r.name, "AK74U");
  assert.equal(r.bonuses[0].level, 40);
});

test("the heading above a group is not a line", () => {
  // "Bloodlust  Life regenerated by % of damage dealt" names a bonus and
  // carries a percent sign, and is a heading rather than stock.
  assert.equal(line("Bloodlust  Life regenerated by % of damage dealt"), null);
  assert.equal(line("Parry % chance of blocking the next melee attack"), null);
  assert.equal(line("Professional • Reliable • 100% Negotiable"), null);
});

test("every line of this post prices", () => {
  const lines = [
    "Yasukuni Sword | orange | 12% Bloodlust | Dmg:75.00 | Acc:54.64 | Q:156.39% | Price: 1b",
    "Kodachi | red | 38% Double-edged + 75%Throttle | Q: 236.22% | Dmg:76.24 | Acc:65.38 | Price: 5b",
    "Thompson | orange | 20% Warlord | Q:154.37% | Dmg: 47.97 | Acc: 49.46 | Price: 500m",
    "Sawed-Off Shotgun | orange | 22% Warlord | Q:171.35% | Dmg: 49.47 | Acc: 71.66 | Price: 650m",
    "AK74U | red | 40% Warlord | Q: 262.47% | Dmg: 60.96 | Acc: 52.29 | Price: offer",
    "Samurai Sword | orange | 20% Plunder + 17% Double-edged | Q: 186.32% | Dmg: 69.84 | Acc: 58.80 | Price: 1.5b",
    "Yasukuni Sword | orange | 28% Plunder + 50% Quicken | Q: 186.64% | Dmg: 75.84 | Acc: 56.82 | Price: 3.5b",
    "Scimitar | yellow | 50% Parry | Q: 114.01% | Dmg: 47.77 | Acc: 61.63 | Price: 168m",
    "Naval Cutlass | yellow | 51% Parry | Q: 126.1% | Dmg: 72.15 | Acc: 56.46 | Price: 350m",
    "Samurai Sword | yellow | 57% Parry | Q: 121.05% | Dmg: 65.86 | Acc: 56.24 | Price: 800m",
    "Scimitar | orange | 67% Parry | Q: 167.45% | Dmg: 50.53 | Acc: 64.22 | Price: 1.5b",
    "MP5 Navy | yellow | 11% Revitalize | Q: 118.02% | Dmg: 51.73 | Acc: 56.07 | Price: 500m",
  ];
  const missed = [];
  for (const t of lines) {
    const it = line(t);
    const p = it && priceForumRow(it);
    if (!p || !(p.value > 0)) missed.push(t.slice(0, 44));
  }
  assert.equal(JSON.stringify(missed), "[]", "lines that did not price: " + missed.join(" | "));
});
