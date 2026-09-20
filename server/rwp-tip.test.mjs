// The styled tooltip.
//
// Every price badge explained itself through a native title attribute, which
// does not appear on a tap — so on a phone the reasoning was unreachable, and
// the reader who asked for it is usually on a phone. A title is also the one
// piece of UI a page cannot style.
//
// The positioning is the part worth testing: a panel that opens off-screen is
// worse than no panel, and a narrow phone viewport is where that happens.
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
vm.runInContext(fn("tipPosition") + "\nglobalThis.pos = tipPosition;", box);
const pos = box.pos;

const PHONE = { w: 390, h: 844 };
const PANEL = { w: 300, h: 120 };

test("it opens under the badge when there is room", () => {
  const p = pos({ left: 40, top: 200, right: 140, bottom: 216 }, PANEL, PHONE);
  assert.ok(p.top >= 216, "should sit below the badge: " + JSON.stringify(p));
});

test("it flips above when there is no room below", () => {
  // A badge near the bottom of a phone screen is the common case in a long
  // forum thread.
  const p = pos({ left: 40, top: 800, right: 140, bottom: 816 }, PANEL, PHONE);
  assert.ok(p.top + PANEL.h <= PHONE.h, "ran off the bottom: " + JSON.stringify(p));
  assert.ok(p.top < 800, "did not flip above: " + JSON.stringify(p));
});

test("it never runs off the right edge", () => {
  const p = pos({ left: 340, top: 200, right: 386, bottom: 216 }, PANEL, PHONE);
  assert.ok(p.left + PANEL.w <= PHONE.w, "off the right: " + JSON.stringify(p));
});

test("it never runs off the left edge", () => {
  const p = pos({ left: -20, top: 200, right: 30, bottom: 216 }, PANEL, PHONE);
  assert.ok(p.left >= 0, "off the left: " + JSON.stringify(p));
});

test("a panel taller than the screen is still anchored on screen", () => {
  // Degenerate, but a long note plus a range can make a tall panel on a short
  // viewport, and top must not go negative-infinite.
  const p = pos({ left: 40, top: 100, right: 140, bottom: 116 }, { w: 300, h: 2000 }, PHONE);
  assert.ok(p.top >= 0, "anchored off the top: " + JSON.stringify(p));
  assert.ok(p.left >= 0);
});

test("it tracks the badge horizontally when it fits", () => {
  const p = pos({ left: 100, top: 200, right: 200, bottom: 216 }, PANEL, { w: 1200, h: 800 });
  assert.equal(p.left, 100, "should line up with the badge on a wide screen");
});

// ── The trigger ────────────────────────────────────────────────
test("price badges carry their text in a data attribute, not title", () => {
  // Both would mean the native tooltip fights the styled one on desktop.
  const body = fn("setTip");
  assert.match(body, /data-rwp-tip|dataset\.rwpTip/);
  assert.match(body, /removeAttribute\('title'\)|title = ''/,
    "the native tooltip is left in place: " + body);
});

test("the three price explanations go through it", () => {
  // The line tag, the table cell and the read badge. Cog and button titles are
  // chrome and deliberately left as native tooltips.
  const calls = (SRC.match(/setTip\(/g) || []).length;
  assert.ok(calls >= 3, "only " + calls + " badges routed through setTip");
});
