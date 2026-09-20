// A carried weapon name must not cross a table row.
//
// The reported fault, from a real shop thread: a table listed a Milkor MGL and
// then a Type 98 Anti-Tank. The line parser walks leaf cells in DOCUMENT order,
// so a table looks to it like a flat run of lines — and when the Type 98's name
// failed to resolve, the Milkor stayed as the carried name. The Type 98's bonus
// cell was priced at $2,097,580,147 under a tooltip reading "Milkor MGL — 35%
// Stricken": a confident price for the wrong gun on somebody else's sale
// thread, and nearly three times the right answer.
//
// The guard for this is one line, and a source-level assertion could not hold
// it: deleting `carry = null` from the row check left all 84 tests in the main
// file passing, because that same string appears on the ageing line below it.
// So this runs injectForumLines against a table and reads the tooltips.
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

// ── A DOM with rows in it ──────────────────────────────────────
const TEXT = (s) => ({ nodeType: 3, nodeValue: s, textContent: s, parentNode: null });

function cell(text, row) {
  const kid = TEXT(text);
  const c = {
    nodeType: 1, nodeName: "TD", childNodes: [kid], _row: row, _tags: [],
    textContent: text,
    classList: { contains: () => false },
    querySelector: () => null,
    querySelectorAll: () => [],
    getElementsByTagName: () => [],
    closest: (sel) => (sel === "tr" ? row : null),
    getAttribute: () => null,
    insertBefore(n) { this._tags.push(n); return n; },
  };
  kid.parentNode = c;
  return c;
}

function makeTable(rows, pricedByTable) {
  const all = [];
  for (const cells of rows) {
    const row = {
      nodeType: 1, nodeName: "TR",
      getAttribute: (k) => (k === "data-rwp-tbl" && pricedByTable ? "1" : null),
    };
    for (const t of cells) all.push(cell(t, row));
  }
  return all;
}

function run(cells) {
  const sandbox = {
    FEED,
    document: {
      querySelectorAll: () => cells,
      createElement: () => ({
        nodeType: 1, className: "", title: "", textContent: "",
        style: { cssText: "" },
        // setTip needs the attribute API: the tooltip text lives in
        // data-rwp-tip now, and the native title is removed rather than kept.
        _a: {},
        setAttribute(k, v) { this._a[k] = String(v); },
        getAttribute(k) { return k in this._a ? this._a[k] : null; },
        hasAttribute(k) { return k in this._a; },
        removeAttribute(k) { delete this._a[k]; },
      }),
    },
  };
  vm.createContext(sandbox);
  vm.runInContext([
    v("WEAPON_CLASS"), v("COMBO_MIN_SAMPLES"), v("LEVEL_MIN_SAMPLES"), v("RARITY_WORD"),
    "var weaponPrices = FEED.weaponPrices, armourPrices = FEED.armourPrices || {};",
    "var bonusPrices = FEED.bonusPrices, armourBonusPrices = FEED.armourBonusPrices || {};",
    "var weaponComboPrices = FEED.weaponComboPrices, weaponPairComboPrices = FEED.weaponPairComboPrices;",
    "var classPrices = FEED.classPrices, weaponLevelPrices = FEED.weaponLevelPrices;",
    "var recentTables = FEED.recent || null; var ACTIVE = null; var ITEM_ALIASES = {};",
    "var KNOWN_WEAPONS = {}; Object.keys(WEAPON_CLASS).forEach(function(w){ KNOWN_WEAPONS[w.toLowerCase()] = w; });",
    fn("flattenName"),
    "var FLAT_WEAPONS = {}; Object.keys(WEAPON_CLASS).forEach(function(w){ FLAT_WEAPONS[flattenName(w)] = w; });",
    SRC.slice(SRC.indexOf("var BONUS_ALIAS = {};"), SRC.indexOf("function resolveBonusName(")),
    fn("TBL"), fn("levelMedianOf"), fn("lookupWeapon"), fn("normalizeWeaponName"),
    fn("resolveBonusName"), fn("getMedianPrice"), fn("getWeaponComboMedian"), fn("pairKeyFor"),
    fn("getWeaponPairComboMedian"), fn("getWeaponLevelMedian"), fn("getWeaponLevelCount"),
    fn("getCombinedLevelValue"), fn("forumBonusPairs"), fn("forumRarityIn"),
    fn("rarityFromRoll"), fn("forumBonusWorth"), fn("priceForumRow"),
    fn("forumWeaponOnly"), fn("forumLineItem"), fn("forumLineSegments"), fn("segmentText"),
    fn("setTip"), fn("fmtBigDollar"), fn("isOurs"), fn("forumLineHosts"), fn("injectForumLines"),
    "injectForumLines();",
  ].join("\n"), sandbox, { timeout: 10000, filename: "rwp-lines.js" });
  return cells;
}

/** Every tooltip this pass produced, in order. */
const titles = (cells) => cells.flatMap((c) => c._tags.map((t) => t.getAttribute("data-rwp-tip") || t.title));

test("a bonus cell is never priced as the weapon on the row above", () => {
  // Deliberately a name the catalogue does NOT have. Spelling "Type 98
  // Anti-Tank" here would not test this guard at all: that name resolves now,
  // so the carry is correct whether or not the row boundary is honoured. What
  // this has to survive is the NEXT unrecognised name, whatever it turns out to
  // be — Torn adds weapons, and the catalogue is a snapshot.
  const cells = run(makeTable([
    ["Milkor MGL", "39% Stricken"],
    ["Fizzbin Repeater", "35% Stricken"],
  ]));
  const wrong = titles(cells).filter((t) => /Milkor/.test(t) && /35%/.test(t));
  assert.deepEqual(wrong, [], "an unknown weapon's roll was priced as the row above it");
});

test("and the second row is priced as the weapon it actually names", () => {
  const cells = run(makeTable([
    ["Milkor MGL", "39% Stricken"],
    ["Type 98 Anti-Tank", "35% Stricken"],
  ]));
  assert.ok(titles(cells).some((t) => /Type 98 Anti Tank/.test(t) && /35%/.test(t)),
    "expected a Type 98 price, got: " + JSON.stringify(titles(cells)));
});

test("a name still reaches the bonus cell in its OWN row", () => {
  // The carry exists for a reason and must survive the fix.
  const cells = run(makeTable([["Milkor MGL", "39% Stricken"]]));
  assert.ok(titles(cells).some((t) => /Milkor MGL/.test(t) && /39%/.test(t)),
    "the carry within a row was lost: " + JSON.stringify(titles(cells)));
});

test("rows the table parser already priced are left alone", () => {
  // Otherwise the row carries two estimates: one in the RW column and one
  // inline, which is how the wrong one went unnoticed.
  const cells = run(makeTable([["Milkor MGL", "39% Stricken"]], true));
  assert.deepEqual(titles(cells), [], "already-priced rows must not be priced again");
});
