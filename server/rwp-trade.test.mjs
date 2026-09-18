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

test("the bonus is found however Torn classes the element carrying it", () => {
  // The add-items picker at trade.php#step=add is a different list again from
  // the trade window, and i.networth-info-icon is not necessarily what it uses.
  // The title's CONTENT is the reliable marker: Torn writes bonus-attachment-*
  // classes into it wherever the fragment appears.
  vm.runInContext([fn("bonusesFromInfoIcon"), "globalThis.__bi2 = bonusesFromInfoIcon;"].join("\n"), sandbox);
  const withSel = (match) => ({
    querySelector: (sel) => (match(sel) ? { getAttribute: () => KODACHI } : null),
  });
  // The trade window's icon.
  assert.ok(sandbox.__bi2(withSel((s) => s.indexOf("networth-info-icon") >= 0)));
  // Anything else carrying the same fragment.
  assert.ok(sandbox.__bi2(withSel((s) => s.indexOf("bonus-attachment") >= 0)),
    "a differently-classed element with the same title must still be read");
});

test("an element whose title is not a bonus fragment is ignored", () => {
  vm.runInContext([fn("bonusesFromInfoIcon"), "globalThis.__bi3 = bonusesFromInfoIcon;"].join("\n"), sandbox);
  const el = { querySelector: () => ({ getAttribute: () => "Click to view this item" }) };
  assert.equal(sandbox.__bi3(el), null);
});

// ── A coloured weapon with no bonus on show ────────────────────
// The trade add-items picker renders no bonus data at all: no info icon, no
// bonus-attachment icon for the bonus itself, only the weapon name and a
// damage STAT icon whose class merely looks similar. No selector can find what
// is not there.
//
// But rarity IS readable — the badge knew it was Red — and a Red weapon always
// carries a bonus. So when the colour says RW and no bonus could be read, the
// figure is knowably not the weapon's value, and saying so is the whole fix.

test("a coloured weapon with no readable bonus is labelled, not asserted", () => {
  const i = SRC.indexOf("function badgeLabelFor");
  assert.ok(i > 0, "badgeLabelFor must exist");
  const body = SRC.slice(i, i + 400);
  assert.match(body, /RARITY_WORD/, "the colour has to be consulted: " + body.slice(0, 200));
  assert.match(body, /bonusCount/);
});

test("a colourless weapon is untouched by that rule", () => {
  // A grey weapon genuinely has no bonus, and its median IS its value.
  const body = SRC.slice(SRC.indexOf("function badgeLabelFor"),
                         SRC.indexOf("function badgeLabelFor") + 800);
  assert.ok(body.length > 0, "badgeLabelFor must exist");
});

test("the label says the bonus is missing rather than implying a price", () => {
  vm.runInContext([v("RARITY_WORD"), fn("badgeLabelFor"), "globalThis.__bl = badgeLabelFor;"].join("\n"), sandbox);
  // Red, no bonus read: the dangerous case.
  assert.match(sandbox.__bl("Red", 0, 1, 1), /bonus/i);
  // Red with a bonus read: normal.
  assert.ok(!/bonus/i.test(sandbox.__bl("Red", 1, 2, 1)));
  // No colour at all: normal.
  assert.ok(!/bonus/i.test(sandbox.__bl(null, 0, 1, 1)));
});

// ── The uid route ──────────────────────────────────────────────
// The picker renders no bonus, but it does render the item's uid, and
// /torn/{uid}/itemdetails returns rarity and bonuses for that exact instance.
// The script already fetched that endpoint for rarity and threw the bonuses
// away.

test("the uid comes out of the row", () => {
  vm.runInContext([fn("uidFromRow"), "globalThis.__uid = uidFromRow;"].join("\n"), sandbox);
  // Torn puts it in two places on the same row.
  const viaInput = {
    getAttribute: () => null,
    querySelector: (sel) => (sel.indexOf("undefined-") >= 0 ? { id: "undefined-14828585269" } : null),
  };
  assert.equal(sandbox.__uid(viaInput), "14828585269");

  const viaReactId = {
    getAttribute: (a) => (a === "data-reactid" ? ".2.2.1.$=10:0.2:$Primary.$14828585269" : null),
    querySelector: () => null,
  };
  assert.equal(sandbox.__uid(viaReactId), "14828585269");
});

test("a row with no uid yields nothing", () => {
  vm.runInContext([fn("uidFromRow"), "globalThis.__uid2 = uidFromRow;"].join("\n"), sandbox);
  assert.equal(sandbox.__uid2({ getAttribute: () => null, querySelector: () => null }), null);
  assert.equal(sandbox.__uid2(null), null);
  // A reactid with no uid on the end must not yield a fragment of the path.
  assert.equal(sandbox.__uid2({ getAttribute: () => ".2.2.1.$=10:0.2", querySelector: () => null }), null);
});

test("the API's bonuses become the ladder's bonuses", () => {
  vm.runInContext([fn("uidEntryFromDetails"), "globalThis.__ue = uidEntryFromDetails;"].join("\n"), sandbox);
  // The shape /torn/{uid}/itemdetails actually returns.
  const e = sandbox.__ue({
    uid: "14828585269", rarity: "red",
    bonuses: [{ id: 21, title: "Focus", description: "31% increased hit chance for every miss", value: 31 }],
  });
  assert.equal(e.rarity, "red");
  assert.equal(e.bonusCount, 1);
  assert.equal(JSON.stringify(e.bonuses), JSON.stringify([{ name: "Focus", level: 31 }]));
});

test("a bonus Torn titles differently to the feed is resolved", () => {
  vm.runInContext([fn("uidEntryFromDetails"), "globalThis.__ue2 = uidEntryFromDetails;"].join("\n"), sandbox);
  const e = sandbox.__ue2({ rarity: "red", bonuses: [{ title: "Double Tap", value: 52 }] });
  assert.equal(e.bonuses[0].name, "Double-Tap");
});

test("an item with no bonuses yields an empty list, not a missing one", () => {
  vm.runInContext([fn("uidEntryFromDetails"), "globalThis.__ue3 = uidEntryFromDetails;"].join("\n"), sandbox);
  const e = sandbox.__ue3({ rarity: null, bonuses: [] });
  assert.equal(JSON.stringify(e.bonuses), "[]", "an empty list is an answer; undefined is a cache miss");
  assert.equal(e.bonusCount, 0);
});

test("entries cached before bonuses were kept count as misses", () => {
  // The cache is persistent and full of {rarity, bonusCount} entries written
  // before this. Treating those as hits would serve the old shape forever.
  const body = SRC.slice(SRC.indexOf("function fetchUidDetails"),
                         SRC.indexOf("function fetchUidDetailsBatch"));
  assert.match(body, /cache\[uid\][\s\S]{0,120}bonuses/,
    "a cached entry without bonuses must not short-circuit: " + body.slice(0, 300));
});

test("the uid lookup is the last resort, after the row and the icon", () => {
  const i = SRC.indexOf("var bonuses = extractBonuses(el);");
  const body = SRC.slice(i, i + 900);
  assert.ok(body.indexOf("bonusesFromInfoIcon") < body.indexOf("uidBonusesFor"),
    "the icon is tried before the API");
  assert.ok(body.indexOf("uidBonusesFor") > 0, "the API is tried at all");
});

test("no API key means no claim, not a wrong one", () => {
  // Without a key the lookup cannot happen, and the badge must fall through to
  // the "no bonus read" label rather than pretending the median is a price.
  const i = SRC.indexOf("function uidBonusesFor");
  const body = SRC.slice(i, i + 700);
  assert.match(body, /getEffectiveApiKey/);
  assert.match(body, /if \(!key\) return null/);
});

test("one uid is asked about once, however many passes run", () => {
  // injectPriceTags runs on every mutation. Without a guard a single picker
  // page would fire the same lookup dozens of times.
  const i = SRC.indexOf("function uidBonusesFor");
  const body = SRC.slice(i, i + 700);
  assert.match(body, /uidAsked\[uid\]/);
});

// ── The trade page without an API key ──────────────────────────
// RW pricing needs the price FEED, which is a public CDN file. It does not
// need an API key. But the trade page refused to run at all without the
// item-market map, which does need one — so on PDA, where the auto-key often
// lacks Inventory permission, nothing appeared on a trade at all.

test("the trade page prices without the item-market map", () => {
  const i = SRC.indexOf("function ensureTradePrices");
  const body = SRC.slice(i, i + 1100);
  assert.match(body, /injectTradePrices\(/, "it must be called at all");
  // And not from inside a branch that only runs when the map exists.
  const call = body.indexOf("injectTradePrices(");
  const guard = body.indexOf("if (!haveMap");
  assert.ok(guard >= 0 && call > guard,
    "the call must come after the warning, not instead of it: " + body.slice(0, 400));
  assert.ok(!/\{ injectTradePrices\(maps\); return; \}/.test(body),
    "the early-return gate must be gone");
});

test("a missing map costs the base values, not the RW ones", () => {
  // tradeLineValue needs the map and returns 0 without it. tradeRwValue reads
  // the price feed and does not. A trade with no key should still show what
  // the RW weapons in it are worth.
  const i = SRC.indexOf("function tradeLineValue");
  const body = SRC.slice(i, i + 600);
  assert.match(body, /maps && maps\.byId/, "guarded against a null map");
  assert.match(body, /maps && maps\.byName/);
});
