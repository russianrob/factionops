// Pricing the RW weapons in a trade.
//
// Torn's trade window totals items at their BASE market value. A Red Steyr AUG
// with 31% Focus counts as $74,731 — the price of any Steyr AUG — while the
// weapon is worth about $1.07b. That is a four-order-of-magnitude error on a
// screen with an Accept button, which makes this the one place in Torn where a
// missing price costs real money.
//
// The bonus is not in the row. It sits in the `title` attribute of the info
// icon, as an HTML fragment Torn renders into its shared tooltip on hover —
// but the attribute is there on page load, so nothing has to be hovered.
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
  v("WEAPON_CLASS"), v("COMBO_MIN_SAMPLES"), v("LEVEL_MIN_SAMPLES"), v("RARITY_WORD"),
  "var weaponPrices = FEED.weaponPrices, armourPrices = FEED.armourPrices || {};",
  "var bonusPrices = FEED.bonusPrices, armourBonusPrices = FEED.armourBonusPrices || {};",
  "var weaponComboPrices = FEED.weaponComboPrices, weaponPairComboPrices = FEED.weaponPairComboPrices;",
  "var classPrices = FEED.classPrices, weaponLevelPrices = FEED.weaponLevelPrices;",
  "var recentTables = FEED.recent || null; var ACTIVE = null; var ITEM_ALIASES = {};",
  "var KNOWN_WEAPONS = {}; Object.keys(WEAPON_CLASS).forEach(function(w){ KNOWN_WEAPONS[w.toLowerCase()] = w; });",
  SRC.slice(SRC.indexOf("var BONUS_ALIAS = {};"), SRC.indexOf("function resolveBonusName(")),
  fn("TBL"), fn("levelMedianOf"), fn("lookupWeapon"), fn("normalizeWeaponName"), fn("resolveBonusName"),
  fn("getMedianPrice"), fn("getWeaponComboMedian"), fn("pairKeyFor"), fn("getWeaponPairComboMedian"),
  fn("getWeaponLevelMedian"), fn("getWeaponLevelCount"), fn("getCombinedLevelValue"),
  fn("forumBonusNames"), fn("rarityFromRoll"), fn("forumBonusWorth"), fn("priceForumRow"),
  fn("parseTradeBonusTitle"),
].join("\n"), sandbox, { timeout: 5000, filename: "rwp-trade.js" });

const { parseTradeBonusTitle, priceForumRow } = sandbox;

// The real attribute, exactly as Torn writes it.
const KODACHI = `<div class='t-overflow'>
  <i class='bonus-attachment-quicken'></i><b>Quicken</b><br/>
  82% increased passive speed while using this weapon
</div>
<div style='padding:5px'>
  <ul class='bonus-tooltip clearfix'>
    <li><i class='bonus-attachment-item-damage-bonus'></i><span>69.75</span></li>
    <li><i class='bonus-attachment-item-accuracy-bonus'></i><span>62.67</span></li>
    <li><i class='bonus-attachment-item-rarity-bonus'></i><span>144.24% yellow</span></li>
  </ul>
</div>`;

test("the bonus, its roll, the quality and the colour all come out", () => {
  const t = parseTradeBonusTitle(KODACHI);
  assert.equal(JSON.stringify(t.bonuses), JSON.stringify([{ name: "Quicken", level: 82 }]));
  assert.equal(t.quality, 144.24);
  assert.equal(t.rarity, "Yellow", "torn writes it lower case");
});

test("the quality percentage is never mistaken for a roll", () => {
  // "144.24% yellow" sits in the same fragment and is the single most dangerous
  // number in it: read as a roll it would price the weapon off its own quality.
  const t = parseTradeBonusTitle(KODACHI);
  assert.equal(t.bonuses.length, 1);
  assert.ok(!t.bonuses.some((b) => b.level === 144), JSON.stringify(t.bonuses));
});

test("a weapon with two bonuses yields both", () => {
  const two = `<div class='t-overflow'>
    <i class='bonus-attachment-focus'></i><b>Focus</b><br/>
    31% increased hit chance for every miss
  </div>
  <div class='t-overflow'>
    <i class='bonus-attachment-powerful'></i><b>Powerful</b><br/>
    19% increased damage
  </div>
  <div><ul class='bonus-tooltip clearfix'>
    <li><i class='bonus-attachment-item-rarity-bonus'></i><span>263.14% red</span></li>
  </ul></div>`;
  const t = parseTradeBonusTitle(two);
  assert.equal(t.bonuses.length, 2);
  assert.equal(JSON.stringify(t.bonuses.map((b) => b.name + " " + b.level)),
               JSON.stringify(["Focus 31", "Powerful 19"]));
  assert.equal(t.rarity, "Red");
  assert.equal(t.quality, 263.14);
});

test("a bonus name Torn spells differently to the price feed still resolves", () => {
  const dt = `<div class='t-overflow'><b>Double Tap</b><br/>52% chance of a second hit</div>
              <ul class='bonus-tooltip'><li><i class='bonus-attachment-item-rarity-bonus'></i><span>200% red</span></li></ul>`;
  assert.equal(parseTradeBonusTitle(dt).bonuses[0].name, "Double-Tap");
});

test("a plain item with no bonus yields nothing", () => {
  assert.equal(parseTradeBonusTitle(""), null);
  assert.equal(parseTradeBonusTitle("<div class='t-overflow'>Just a description</div>"), null);
  assert.equal(parseTradeBonusTitle(null), null);
});

test("the Steyr AUG from the trade prices in the billions, not the thousands", () => {
  const aug = `<div class='t-overflow'>
    <i class='bonus-attachment-focus'></i><b>Focus</b><br/>
    31% increased hit chance for every miss
  </div>
  <div><ul class='bonus-tooltip clearfix'>
    <li><i class='bonus-attachment-item-damage-bonus'></i><span>80.09</span></li>
    <li><i class='bonus-attachment-item-accuracy-bonus'></i><span>55.22</span></li>
    <li><i class='bonus-attachment-item-rarity-bonus'></i><span>263.14% red</span></li>
  </ul></div>`;
  const t = parseTradeBonusTitle(aug);
  const p = priceForumRow({ name: "Steyr AUG", rarity: t.rarity, bonuses: t.bonuses });
  assert.ok(p && p.value > 5e8,
    "Torn totals this at $74,631; got " + (p ? "$" + Math.round(p.value / 1e6) + "m" : "nothing"));
});

// ── What lands on the row and the total ────────────────────────
test("a plain item keeps its market price, an RW weapon does not", () => {
  vm.runInContext([fn("tradeRwValue"), "globalThis.__rw = tradeRwValue;"].join("\n"), sandbox);
  const icon = (title) => ({ getAttribute: () => title });
  const row = (title) => ({ querySelector: (sel) => (sel.indexOf("networth-info-icon") >= 0 && title ? icon(title) : null) });

  // No info icon at all: not an RW weapon, so nothing is claimed.
  assert.equal(sandbox.__rw(row(null), "Kodachi"), 0);
  // An icon whose title carries no bonus: same.
  assert.equal(sandbox.__rw(row("<div class='t-overflow'>plain</div>"), "Kodachi"), 0);
  // A real one.
  const v = sandbox.__rw(row(KODACHI), "Kodachi");
  assert.ok(v > 1e8, "82% Quicken Yellow Kodachi should price high, got " + v);
});

test("an unknown weapon name claims nothing", () => {
  const icon = { getAttribute: () => KODACHI };
  const row = { querySelector: () => icon };
  assert.equal(sandbox.__rw(row, "Not A Weapon"), 0);
});

test("the total keeps Torn's figure beside the RW one", () => {
  // A side worth $74,631 by Torn's reckoning and $1.07b by ours needs both
  // numbers visible, or the disagreement looks like a bug rather than the
  // point.
  const body = SRC.slice(SRC.indexOf("var totalTxt = "), SRC.indexOf("var totalTxt = ") + 400);
  assert.match(body, /anyRw/);
  assert.match(body, /Torn:/);
});

// ── The same weapon must not price twice ───────────────────────
// The inventory badge said $1.51b and the trade said $1.07b for one Steyr AUG.
// The tooltip gave it away: "Median $1.51B · 85 sales" with no bonus named —
// that is every Red Steyr AUG ever sold, the 31% Focus thrown away entirely.
// The inventory list does not render bonuses in the row; they are in the same
// networth-info-icon title the trade page uses.

test("a bonus is recovered from the icon when the row does not show one", () => {
  vm.runInContext([fn("bonusesFromInfoIcon"), "globalThis.__bi = bonusesFromInfoIcon;"].join("\n"), sandbox);
  const el = {
    querySelector: (sel) => (sel.indexOf("networth-info-icon") >= 0
      ? { getAttribute: () => KODACHI } : null),
  };
  const got = sandbox.__bi(el);
  assert.ok(got, "expected the icon to yield a bonus");
  assert.equal(JSON.stringify(got.bonuses), JSON.stringify([{ name: "Quicken", level: 82 }]));
  assert.equal(got.rarity, "Yellow");
});

test("a row with no icon yields nothing, and claims nothing", () => {
  vm.runInContext([fn("bonusesFromInfoIcon"), "globalThis.__bi = bonusesFromInfoIcon;"].join("\n"), sandbox);
  assert.equal(sandbox.__bi({ querySelector: () => null }), null);
  assert.equal(sandbox.__bi(null), null);
});

test("the item page asks the icon only when the row gave nothing", () => {
  // The row's own markup is the better source where it exists — it is what the
  // page actually shows. The icon is a fallback, not a replacement.
  const body = SRC.slice(SRC.indexOf("var bonuses = extractBonuses(el);"),
                         SRC.indexOf("var bonuses = extractBonuses(el);") + 500);
  assert.match(body, /bonuses\.length/, "gated on the row yielding nothing: " + body.slice(0, 200));
  assert.match(body, /bonusesFromInfoIcon/);
});
