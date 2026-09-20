// The RW total at the top of a trade.
//
// RW Pricer already writes a "Total value" line under each side. The figure a
// reader sees FIRST is higher up the page and belongs to TornTools' Trade
// Calculator, which values everything at market price — so a Steyr AUG worth
// $1,074,482,443 on RW data showed there as part of $74,651.
//
// We do not touch that number. TornTools ships hashed per-version bundles and
// re-renders on its own schedule; reaching into it would break silently on
// their update, and would leave a wrong total behind if RW Pricer were ever
// disabled mid-trade. RW Pricer states its own figure in its own element
// instead, and the two sit side by side saying different things honestly.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const SRC = fs.readFileSync(new URL("./public/scripts/torn-rw-pricer.user.js", import.meta.url), "utf8");
function fn(name) {
  const i = SRC.indexOf("function " + name + "(");
  assert.ok(i >= 0, "not in the script: " + name);
  let p = SRC.indexOf("(", i), d = 0, k = p;
  for (; k < SRC.length; k++) {
    if (SRC[k] === "(") d++;
    else if (SRC[k] === ")" && --d === 0) break;
  }
  const o = SRC.indexOf("{", k);
  let b = 0;
  for (let j = o; j < SRC.length; j++) {
    if (SRC[j] === "{") b++;
    else if (SRC[j] === "}" && --b === 0) return SRC.slice(i, j + 1);
  }
  throw new Error("unbalanced braces in " + name);
}
const box = {};
vm.createContext(box);
vm.runInContext([fn("fmtBigDollar"), fn("tradeTopLine"),
  "globalThis.line = tradeTopLine;"].join("\n"), box);
const line = box.line;

test("both sides are shown, in page order", () => {
  const out = line([{ rwTotal: 1074482443, total: 74651, anyRw: true },
                    { rwTotal: 0, total: 0, anyRw: false }]);
  // fmtBigDollar writes the full figure, not an abbreviation.
  assert.match(out.text, /\$1,074,482,443/);
  assert.ok(out.text.indexOf("1,074,482,443") < out.text.indexOf("$0"), out.text);
});

test("it says what Torn's own figure is, rather than hiding the difference", () => {
  // Two totals four orders of magnitude apart is confusing; an unexplained
  // one is worse.
  const out = line([{ rwTotal: 1074482443, total: 74651, anyRw: true },
                    { rwTotal: 0, total: 0, anyRw: false }]);
  assert.match(out.title, /\$74,651/, out.title);
});

test("the side without an RW item reads as its plain market value", () => {
  // Only meaningful when the OTHER side has one — with neither, the banner is
  // suppressed entirely, which the next test pins. These two contradicted each
  // other until I noticed.
  const out = line([{ rwTotal: 1000000, total: 1000000, anyRw: true },
                    { rwTotal: 900, total: 900, anyRw: false }]);
  assert.match(out.text, /\$900/);
});

test("nothing is claimed when neither side holds an RW item", () => {
  // Otherwise the banner is a second opinion that agrees with the first, which
  // is just clutter on top of somebody else's total.
  assert.equal(line([{ rwTotal: 0, total: 0, anyRw: false },
                     { rwTotal: 0, total: 0, anyRw: false }]), null);
});

test("one empty side is still shown", () => {
  // A one-sided trade is the normal shape of a sale.
  const out = line([{ rwTotal: 1074482443, total: 74651, anyRw: true },
                    { rwTotal: 0, total: 0, anyRw: false }]);
  assert.ok(out, "a one-sided trade produced nothing");
});

test("the banner goes at the top of the trade container", () => {
  // #trade-container is a selector this script already proves it can find —
  // it is how the per-side totals are placed.
  const body = fn("injectTradePrices");
  assert.match(body, /#trade-container/);
  assert.match(body, /insertBefore\([^)]*firstChild|prepend/,
    "the banner is not placed first: " + body.slice(-600));
});
