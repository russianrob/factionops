// Turtling on the payouts page.
//
// Hospitalising your own members so the enemy cannot score off them is real war
// work that earns no respect, so a score-based payout pays it nothing. The
// server already knows: tallyAttacks files an attack whose defender is our own
// faction as breakdown.turtle, and war-payouts.js says why it is counted —
// "the hit is now COUNTED, so the work is at least visible".
//
// It was not visible. The page rendered War hits, Retals, Assists, Losses and
// Non-war, and mentioned turtle nowhere — while the cached payout for the war
// that ended 2026-09-20 held 133 turtle hits across 16 members, the top one on
// 29. And turtleWeight / turtlePay, which the API has accepted since the
// feature landed, had no field to set them in.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const SRC = fs.readFileSync(new URL("./routes.js", import.meta.url), "utf8");
const PAGE = (() => {
  const i = SRC.indexOf("const PAYOUTS_HTML = `");
  const start = SRC.indexOf("`", i) + 1;
  let j = start;
  while (j < SRC.length) {
    if (SRC[j] === "\\") { j += 2; continue; }
    if (SRC[j] === "`") break;
    j++;
  }
  return SRC.slice(start, j);
})();

test("the member breakdown has a row for turtle hits", () => {
  assert.match(PAGE, /\['turtle',\s*'[^']+'\]/,
    "a member who turtled 29 times sees no sign of it");
});

test("it sits with the other unpaid-by-default work, not above war hits", () => {
  // The list is ordered most-valuable first and a turtle hit is worth zero
  // until priced, so it must not outrank a war hit visually.
  const order = [...PAGE.matchAll(/\['([a-z_]+)',\s*'[^']*'\]/g)].map((m) => m[1]);
  assert.ok(order.includes("turtle"), "not in the breakdown list at all");
  assert.ok(order.indexOf("turtle") > order.indexOf("war_hit"),
    "turtle outranks war hits: " + order.join(","));
});

test("the settings panel can price turtling, both ways", () => {
  // Flat dollars per hit, or a score weight — the server takes either and
  // prefers the flat rate, so both need a field.
  assert.match(PAGE, /id="s-turtlepay"/, "no flat-rate field");
  assert.match(PAGE, /id="s-turtleweight"/, "no score-weight field");
});

test("both fields are loaded from the saved settings", () => {
  assert.match(PAGE, /\$\('#s-turtlepay'\)\.value\s*=/, "flat rate never populated");
  assert.match(PAGE, /\$\('#s-turtleweight'\)\.value\s*=/, "weight never populated");
});

test("and both are sent on save, under the names the server reads", () => {
  // routes.js accepts turtlePay / turtleWeight. A different spelling here
  // would save nothing and report success.
  assert.match(PAGE, /turtlePay:\s*\$\('#s-turtlepay'\)\.value/);
  assert.match(PAGE, /turtleWeight:\s*\$\('#s-turtleweight'\)\.value/);
});

test("the server still accepts exactly those two names", () => {
  // Guards the pairing from the other side: rename one and this fails.
  assert.match(SRC, /body\.turtleWeight\s*!=\s*null/);
  assert.match(SRC, /body\.turtlePay\s*!=\s*null/);
});
