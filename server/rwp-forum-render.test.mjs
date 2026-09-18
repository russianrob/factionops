// What the forum badge actually puts on the page.
//
// The userscript is one IIFE with GM_* grants, so it cannot be imported. The
// functions under test are lifted out of the source by brace matching and run
// against a stub DOM — which is enough, because render() only ever creates a
// div and sets text on it. The point is that the rules below are checked
// against the SHIPPING file rather than a copy that can drift from it.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const SRC = fs.readFileSync(new URL("./public/scripts/torn-rwp-forum.user.js", import.meta.url), "utf8");

function grab(name) {
  const i = SRC.indexOf("function " + name + "(");
  assert.ok(i >= 0, "function not found in the shipping script: " + name);
  const o = SRC.indexOf("{", i);
  let d = 0;
  for (let j = o; j < SRC.length; j++) {
    if (SRC[j] === "{") d++;
    else if (SRC[j] === "}" && --d === 0) return SRC.slice(i, j + 1);
  }
  throw new Error("unbalanced braces in " + name);
}

const document = { createElement: () => ({ className: "", textContent: "", innerHTML: "" }) };
const render = new Function("document", grab("money") + "\n" + grab("render") + "\nreturn render;")(document);
const all = (box) => box.textContent + " " + box.innerHTML;

test("an invented name never reaches the page", () => {
  // The Kodachi card is cropped above its name, so the reader returned "Big
  // Al's Gun Shop Katana" — the sell shop welded to what the picture looked
  // like — and said it was confident. Printing that onto somebody's public
  // sale thread is worse than saying nothing.
  const box = render(null, {
    item: { name: "Big Al's Gun Shop Katana", rarity: "Yellow", quality: 105.26,
            bonuses: [{ name: "Parry", pct: 53 }], confident: true },
    price: null, unknownItem: true, cached: true,
  });
  assert.equal(box.className, "rwpf pending");
  assert.match(box.textContent, /could not read an item card/);
  assert.ok(!/Big Al/.test(all(box)), "the invented name must not be rendered");
});

test("a real weapon with no sales keeps its name", () => {
  // The distinction the unknown flag exists to protect: Rheinmetall MG 3 is a
  // genuine weapon with no Orange sales on record, and "no price" beside its
  // real name is the right answer.
  const box = render(null, {
    item: { name: "Rheinmetall MG 3", rarity: "Orange", quality: 120, bonuses: [], confident: true },
    price: null, unknownItem: false, cached: true,
  });
  assert.match(box.innerHTML, /Rheinmetall MG 3/);
  assert.match(box.innerHTML, /no price/);
});

test("a priced item renders its estimate, bonus and basis", () => {
  const box = render(null, {
    item: { name: "SIG 552", rarity: "Yellow", quality: 117.51, bonuses: [{ name: "Expose", pct: 9 }] },
    price: { estimate: 85837512, rarity: "Yellow",
             basis: "SIG 552 + Expose sales by roll (Yellow, 3 price points)",
             samples: 120, low: 55250174, high: 150590101,
             notes: ["Priced on the last 365 days."] },
    unknownItem: false, cached: true,
  });
  assert.match(box.innerHTML, /SIG 552/);
  assert.match(box.innerHTML, /9% Expose/);
  assert.match(box.innerHTML, /Yellow/);
  assert.match(box.innerHTML, /117\.51%/);
  assert.ok(!/no price/.test(box.innerHTML));
});

test("an inferred rarity is shown, and shown as inferred", () => {
  // The Mag 7 card read cleanly but came back with rarity null; the roll says
  // Red. The header used to read the rarity off the ITEM, so a rarity the
  // pricer had worked out was invisible.
  const box = render(null, {
    item: { name: "Mag 7", rarity: null, quality: null, bonuses: [{ name: "Expose", pct: 15 }] },
    price: { estimate: 900236953, rarity: "Red", inferredRarity: true,
             basis: "Mag 7 + Expose sales by roll (Red, 1 price point)",
             samples: 3, low: 708960579, high: 955000001,
             notes: ["The card did not give a rarity. 15% Expose has only ever sold as Red, so that is what this prices."] },
    unknownItem: false, cached: true,
  });
  assert.match(box.innerHTML, /Red/, "the worked-out rarity belongs on the badge");
  assert.match(box.innerHTML, /worked out/i, "and it must not pass as something the card said");
});

test("a quality with no rarity is still shown", () => {
  // Quality used to be nested inside the rarity test, so a card that gave one
  // and not the other lost both.
  const box = render(null, {
    item: { name: "SIG 552", rarity: null, quality: 117.51, bonuses: [] },
    price: null, unknownItem: false, cached: true,
  });
  assert.match(box.innerHTML, /117\.51%/);
});

test("an unread screenshot and an unpaid one say different things", () => {
  const unread = render(null, { item: null, price: null, cached: false });
  const unpaid = render(null, { item: null, price: null, needsMember: true, cached: false });
  assert.match(unread.textContent, /could not read/);
  assert.match(unpaid.textContent, /not been read yet/);
});

// ── The caption walker ─────────────────────────────────────────
// Minimal DOM: text nodes and elements, enough for ownText/caption to walk.
function txt(v) { return { nodeType: 3, nodeValue: v }; }
function el(cls, kids) {
  const n = { nodeType: 1, childNodes: kids || [], parentNode: null,
              classList: { contains: (c) => (cls || "").split(" ").indexOf(c) >= 0 } };
  for (const k of n.childNodes) k.parentNode = n;
  return n;
}
const caption = new Function(grab("ownText") + "\n" + grab("caption") + "\nreturn caption;")();

test("the caption is the post's own words", () => {
  const img = el("", []);
  const post = el("post", [txt("Kodachi - 53% parry"), img, txt("Price: DM your offers")]);
  img.parentNode = post;
  const c = caption(img);
  assert.match(c, /Kodachi - 53% parry/);
});

test("our own badge is never fed back as evidence", () => {
  // The pending badge sits in the post by the time a retry is decided. Reading
  // it back would hand the model its own output as if it were the post.
  const img = el("", []);
  const badge = el("rwpf pending", [txt("RW Pricer: could not read an item card in this image.")]);
  const post = el("post", [txt("Kodachi - 53% parry"), img, badge]);
  for (const k of post.childNodes) k.parentNode = post;
  const c = caption(img);
  assert.match(c, /Kodachi/);
  assert.ok(!/RW Pricer/.test(c), "the badge must be excluded: " + c);
});

test("the walk stops before it swallows the whole thread", () => {
  const img = el("", []);
  const post = el("post", [img]);                       // nothing of its own
  img.parentNode = post;
  const thread = el("thread", [post, txt("x".repeat(4000))]);
  post.parentNode = thread;
  const c = caption(img);
  assert.ok(c.length <= 300, "a caption is capped at 300 chars, got " + c.length);
  assert.ok(!/x{100}/.test(c), "the thread body is not this picture's caption");
});

test("no words near the picture means no caption", () => {
  const img = el("", []);
  const post = el("post", [img]);
  img.parentNode = post;
  assert.equal(caption(img), "", "an empty caption must not trigger a paid retry");
});

// ── The panel is a sign-in box, not a diagnostic ───────────────
// It was built while the feature was being debugged and still reads like it:
// image counts, HTTP replies, a list of skipped avatars. None of that means
// anything to somebody who just wants prices on a sale thread.
test("the panel shows no counters or request logs", () => {
  const panel = SRC.slice(SRC.indexOf("function panel(force)"),
                          SRC.indexOf("placePanel(el);", SRC.indexOf("function panel(force)")));
  for (const leak of [/DIAG\.imgs/, /DIAG\.furniture/, /DIAG\.asked/, /DIAG\.replies/, /DIAG\.skipped/,
                      /images:/, /furniture:/, /skipped:/]) {
    assert.ok(!leak.test(panel), "still in the panel: " + leak);
  }
});

test("signing in and out is still there", () => {
  const panel = SRC.slice(SRC.indexOf("function panel(force)"),
                          SRC.indexOf("placePanel(el);", SRC.indexOf("function panel(force)")));
  assert.match(panel, /rwpf-in/);
  assert.match(panel, /rwpf-out/);
  assert.match(panel, /Torn API key/);
  // And the one message that is about the reader rather than the machinery.
  assert.match(panel, /has not been read yet/);
});
