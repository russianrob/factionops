// What the tooltip on a read price says.
//
// It named the item and warned that the reading came from a post's wording,
// then stopped — while the server had already worked out and returned WHY the
// number is what it is. For an ArmaLite M-15A4 at 36% Specialist the reply
// carries basis, 20 samples, a range of $999m to $2.86b, extrapolated: true,
// and a note reading "Nothing this good has ever sold — the best on record is
// 35%."
//
// That last part is not decoration. A $2,320,101,947 badge with no hint that
// it is extrapolated past every recorded sale is the most confident thing on
// the page and the least supported.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const SRC = fs.readFileSync(new URL("./public/scripts/torn-rw-pricer.user.js", import.meta.url), "utf8");
function fn(name) {
  const i = SRC.indexOf("function " + name + "(");
  assert.ok(i >= 0, "not in the script: " + name);
  let p = SRC.indexOf("(", i), d = 0, k = p;
  for (; k < SRC.length; k++) { if (SRC[k] === "(") d++; else if (SRC[k] === ")" && --d === 0) break; }
  const o = SRC.indexOf("{", k);
  let b = 0;
  for (let j = o; j < SRC.length; j++) {
    if (SRC[j] === "{") b++; else if (SRC[j] === "}" && --b === 0) return SRC.slice(i, j + 1);
  }
  throw new Error("unbalanced braces in " + name);
}
const box = {};
vm.createContext(box);
vm.runInContext([fn("fmtBigDollar"), fn("readItemTitle"),
  "globalThis.tip = readItemTitle;"].join("\n"), box);
const tip = box.tip;

const ITEM = {
  name: "ArmaLite M-15A4", rarity: "Orange",
  bonuses: [{ name: "Specialist", pct: 36 }],
  price: {
    estimate: 2320101947, low: 999000001, high: 2860310020,
    samples: 20, extrapolated: true,
    basis: "what an Orange ArmaLite M-15A4 with Specialist has sold for at other rolls",
    notes: ["Nothing this good has ever sold — the best on record is 35%."],
  },
};

test("it still says what was read", () => {
  const t = tip(ITEM);
  assert.match(t, /ArmaLite M-15A4/);
  assert.match(t, /36% Specialist/);
  assert.match(t, /Orange/);
});

test("it says WHY the price is that number", () => {
  assert.match(tip(ITEM), /has sold for at other rolls/);
});

test("it says how much evidence there is", () => {
  assert.match(tip(ITEM), /20 sales/);
});

test("an extrapolated price says so, in plain words", () => {
  // The single most important thing on this tooltip.
  const t = tip(ITEM);
  assert.match(t, /Nothing this good has ever sold/);
});

test("the range is shown when there is one", () => {
  const t = tip(ITEM);
  assert.match(t, /\$999,000,001/);
  assert.match(t, /\$2,860,310,020/);
});

test("it still warns the reading came from a post", () => {
  assert.match(tip(ITEM), /post/i);
});

test("a plain, well-evidenced price does not shout", () => {
  // No range, not extrapolated, plenty of sales: say the basis and stop.
  const plain = { name: "Kodachi", rarity: "Yellow", bonuses: [{ name: "Parry", pct: 53 }],
    price: { estimate: 618000000, samples: 78, extrapolated: false,
             basis: "what a Yellow Kodachi with Parry has sold for, matched to the 53%", notes: [] } };
  const t = tip(plain);
  assert.match(t, /matched to the 53%/);
  assert.ok(!/ever sold/.test(t), "invented a caveat: " + t);
});

test("an item with no price detail still produces a sane tooltip", () => {
  // The read can arrive before pricing, or pricing can fail.
  const bare = { name: "Kodachi", bonuses: [{ name: "Parry", pct: 53 }] };
  const t = tip(bare);
  assert.match(t, /Kodachi/);
  assert.ok(!/undefined|NaN|null/.test(t), t);
});
