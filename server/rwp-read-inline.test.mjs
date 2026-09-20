// Putting a server-read price beside the weapon it was read from.
//
// The read itself was never the problem — the server returns a full, correct,
// priced list. Showing it was. The first attempt hung the whole list on one
// element captured before the request and was invisible four times running; the
// second pinned it over the post, which buried the post.
//
// This is the third shape and the one the rest of RW Pricer already uses: each
// price hangs off the LINE whose words it was read from, through the same
// forumLineSegments machinery the working line badges use. It is also
// self-checking in a way the other two were not — if the line cannot be found
// in the page, nothing is placed, so a price can never appear somewhere the
// weapon it describes does not.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const SRC = fs.readFileSync(new URL("./public/scripts/torn-rw-pricer.user.js", import.meta.url), "utf8");

function v(name) {
  const m = SRC.match(new RegExp("^[ \\t]*var[ \\t]+" + name + "[ \\t]*=.*$", "m"));
  assert.ok(m, "var not found: " + name);
  return m[0].trim();
}

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

// The post in the report, which lists the same weapon more than once.
const ITEMS = () => [
  { name: "Kodachi", readAs: "Kodachi", bonuses: [{ name: "Bloodlust", pct: 10 }], price: { estimate: 205740648 } },
  { name: "Kodachi", readAs: "Kodachi", bonuses: [{ name: "Plunder", pct: 21 }], price: { estimate: 225118508 } },
  { name: "Jackhammer", readAs: "Jackhammer", bonuses: [{ name: "Deadly", pct: 2 }], price: { estimate: 60000001 } },
  { name: "Metal Nunchaku", readAs: "Metal Nunchaku", bonuses: [{ name: "Roshambo", pct: 64 }], price: { estimate: 41000001 } },
];

const box = {};
vm.createContext(box);
vm.runInContext([fn("readItemFits"), fn("matchReadItem"),
                 "globalThis.match = matchReadItem;"].join("\n"), box);
const match = box.match;

// ── Which line a price belongs to ──────────────────────────────
test("a line is matched by its weapon, its bonus and its roll", () => {
  const items = ITEMS();
  const hit = match(items, "Kodachi 10% Bloodlust - 250m obo");
  assert.equal(hit && hit.bonuses[0].name, "Bloodlust");
});

test("the same weapon twice takes the right one each time", () => {
  // Two Kodachis on this post. Matching on the name alone would put the
  // Bloodlust price against the Plunder line.
  const items = ITEMS();
  const a = match(items, "Kodachi 21% Plunder");
  const b = match(items, "Kodachi 10% Bloodlust");
  assert.equal(a.bonuses[0].name, "Plunder");
  assert.equal(b.bonuses[0].name, "Bloodlust");
});

test("an item is used once, so two identical lines do not share a price", () => {
  const items = ITEMS();
  assert.ok(match(items, "Kodachi 10% Bloodlust"));
  assert.equal(match(items, "Kodachi 10% Bloodlust"), null, "the same item was handed out twice");
});

test("a roll that is only a substring of the line's number does not match", () => {
  // 10 must not match 100, or a 10% Bloodlust price lands on a 100% line.
  const items = ITEMS();
  assert.equal(match(items, "Kodachi 100% Bloodlust"), null);
});

test("the bonus has to be named too", () => {
  const items = ITEMS();
  assert.equal(match(items, "Kodachi 10% Parry"), null);
});

test("a line naming no weapon from the list matches nothing", () => {
  const items = ITEMS();
  assert.equal(match(items, "Message me if interested, 10% off today"), null);
});

test("a weapon whose name contains another's is not confused", () => {
  const items = ITEMS();
  assert.equal(match(items, "Metal Nunchaku 64% Roshambo").name, "Metal Nunchaku");
});

// ── Where the price ends up ────────────────────────────────────
const TEXT = (s) => ({ nodeType: 3, nodeValue: s, textContent: s, parentNode: null });

function line(text) {
  const kid = TEXT(text);
  const el = {
    nodeType: 1, nodeName: "DIV", childNodes: [kid], textContent: text, _tags: [],
    classList: { contains: () => false },
    querySelector: () => null, querySelectorAll: () => [],
    getElementsByTagName: () => [], closest: () => null, getAttribute: () => null,
    insertBefore(n) { this._tags.push(n); return n; },
  };
  kid.parentNode = el;
  return el;
}

/**
 * Run the placement over a DOM. `passes` sets how many times, each with its own
 * fresh copy of the read list — which is what a SECOND installed copy of the
 * script looks like: its own response, the same page.
 */
function runPlace(lines, items, passes = 1) {
  const cells = lines.map(line);
  const sandbox = {
    document: {
      querySelectorAll: () => cells,
      createElement: () => ({ nodeType: 1, className: "", title: "", textContent: "", style: { cssText: "" },
        _a: {},
        setAttribute(k, v) { this._a[k] = String(v); },
        getAttribute(k) { return k in this._a ? this._a[k] : null; },
        hasAttribute(k) { return k in this._a; },
        removeAttribute(k) { delete this._a[k]; } }),
    },
    PASSES: passes,
    FRESH: () => JSON.parse(JSON.stringify(items)),
  };
  vm.createContext(sandbox);
  vm.runInContext([
    fn("setTip"), fn("fmtBigDollar"), fn("isOurs"), fn("forumLineHosts"), fn("forumLineSegments"),
    v("MAX_READ_LINE"),
    fn("segmentText"), fn("readItemFits"), fn("countReadMatches"), fn("matchReadItem"),
    fn("readItemTitle"), fn("placeReadItems"),
    "globalThis.placed = 0;",
    "for (var p = 0; p < PASSES; p++) globalThis.placed += placeReadItems(FRESH(), null);",
  ].join("\n"), sandbox, { timeout: 5000 });
  return { cells, placed: sandbox.placed };
}

test("each price lands on the line it was read from", () => {
  const { cells, placed } = runPlace([
    "Down below I listed my Ranked War Weapons for sale!",
    "Kodachi 10% Bloodlust",
    "Jackhammer 2% Deadly",
  ], ITEMS());
  assert.equal(placed, 2);
  assert.deepEqual(cells[0]._tags, [], "prose must not be tagged");
  assert.match(cells[1]._tags[0].textContent, /205/, "the Kodachi price belongs on the Kodachi line");
  assert.match(cells[2]._tags[0].textContent, /60/, "the Jackhammer price belongs on the Jackhammer line");
});

test("a line is tagged once however often the pass runs", () => {
  // Two copies of RW Pricer are installed on the reporting device — the access
  // log caught two reads posted in the same second — so this pass genuinely
  // happens twice, each with its own answer from the server. Without the
  // per-line marker the reader gets the same price printed twice on one line.
  const { cells, placed } = runPlace(["Kodachi 10% Bloodlust"], ITEMS(), 2);
  assert.equal(cells[0]._tags.length, 1, "the line was priced twice");
  assert.equal(placed, 1);
});

test("nothing is placed when the post does not show the weapons", () => {
  // The honest outcome: if the line cannot be found, no price is invented onto
  // some other part of the page.
  const { cells, placed } = runPlace(["Ask me about prices"], ITEMS());
  assert.equal(placed, 0);
  assert.deepEqual(cells[0]._tags, []);
});

test("an item with no price is never tagged", () => {
  const items = [{ name: "Kodachi", readAs: "Kodachi", bonuses: [{ name: "Bloodlust", pct: 10 }], price: null }];
  const { placed } = runPlace(["Kodachi 10% Bloodlust"], items);
  assert.equal(placed, 0);
});

// ── The overlay is gone ────────────────────────────────────────
test("the read no longer pins anything over the post", () => {
  assert.ok(!/function pinReadCard/.test(SRC), "the pinned card must be gone");
  assert.ok(!/position:fixed;left:8px/.test(SRC), "no fixed overlay may remain");
});

// ── A block is not a line ──────────────────────────────────────
// Four prices came out at the BOTTOM of the post, stranded with no weapon
// beside them: $1,751,508,564 for an ArmaLite 36% Weaken sitting under "Last
// edited by...", eight lines below the ArmaLite.
//
// forumLineHosts pushes any element with a <br> DESCENDANT, so a wrapper around
// several lines is offered as a line itself, and its segment text is the whole
// block. That text names the ArmaLite, so it matched — and the badge went where
// the block ends rather than where the weapon is.
//
// A line describes ONE weapon. Text that could be several is a block.
test("text that could be several weapons is not priced", () => {
  const items = ITEMS();
  const block = "Kodachi 10% Bloodlust Price: 250m " +
                "Jackhammer 2% Deadly Price: 90m " +
                "Metal Nunchaku 64% Roshambo Price: 50m";
  const { cells, placed } = runPlace([block], items);
  assert.equal(placed, 0, "a whole block took a price");
  assert.deepEqual(cells[0]._tags, []);
});

test("the wrapper is skipped and the lines inside it are still priced", () => {
  // Both are offered as hosts, wrapper first — document order. The wrapper must
  // take nothing and consume nothing, or the line below it loses its price too.
  const { cells, placed } = runPlace([
    "Kodachi 10% Bloodlust Jackhammer 2% Deadly",
    "Kodachi 10% Bloodlust",
    "Jackhammer 2% Deadly",
  ], ITEMS());
  assert.equal(placed, 2);
  assert.deepEqual(cells[0]._tags, [], "the wrapper must stay bare");
  assert.match(cells[1]._tags[0].textContent, /205/);
  assert.match(cells[2]._tags[0].textContent, /60/);
});

test("a line is still priced when it is the last one left", () => {
  // The count rule must not refuse a genuine line just because it is the only
  // match remaining.
  const { placed } = runPlace(["Metal Nunchaku 64% Roshambo"], ITEMS());
  assert.equal(placed, 1);
});

test("text far longer than a line is refused even if only one weapon fits", () => {
  // The other half of the same failure: a block whose other weapons have
  // already been priced still ends in the wrong place.
  const long = "Rules of this thread. ".repeat(40) + " Metal Nunchaku 64% Roshambo";
  const { placed } = runPlace([long], ITEMS());
  assert.equal(placed, 0, "a page of text took a price: " + long.length + " chars");
});

// ── The reported post, with its real read ──────────────────────
// Ten lines, the nineteen items the server actually returned for them, and the
// wrapper that forumLineHosts offers alongside them. On 3.9.10 the wrapper took
// the ArmaLite's price and put it at the end of the block; four such wrappers
// on the real page stranded four prices at the bottom of the post.
test("every line of the reported post keeps its own price", () => {
  const items = JSON.parse(fs.readFileSync(
    new URL("./data/rwp-text-cache/txt-f8b5a348b7220164044b67b2025155b3.json", import.meta.url), "utf8")).items;
  items.forEach((it, n) => { it.price = { estimate: (n + 1) * 1000 }; });

  const LINES = [
    "ArmaLite M-15A4 77.08/62.83 Quality: 149.11% (O) Bonus: Weaken 36% Price: 1.95b (in market)",
    "BT MP9 73.05/63.73 Quality: 207.73% (O) Bonus: Slow 30% Price: 880m (in market)",
    "Desert Eagle 74.13/44.49 Quality: 236.17% (R) Bonus: Expose 18% Price: 850m (in market)",
    "Diamond Bladed Knife 69.89/67.03 Quality: 149.24% (O) Bonus: Frenzy 8% Price: 1.3b (in market)",
    "Diamond Bladed Knife 70.50/67.63 Quality: 161.29% (O) Bonus: Wither 32% Price: 1.55b (in market)",
    "Diamond Bladed Knife 73.27/67.81 Quality: 190.76% (O) Bonus: Assassinate 91% Price: 1.5b (in market)",
    "Diamond Bladed Knife 67.90/65.93 Quality: 118.34% (Y) Bonus: Empower 74% Price: 760m (in market)",
    "Enfield SA-80 76.63/63.80 Quality: 224.38% (R) Bonus: Conserve 39% Price: 1.5b (in market)",
    "Kama 50.46/64.26 Quality: 247.25% (R) Bonus: Frenzy 14% Price: 1.2b (in market)",
    "Lorcin 380 43.36/49.59 Quality: 249.42% (R) Bonus: Wither 53% Price: 750m (in market)",
  ];
  // The wrapper comes first, as it does in document order.
  const { cells, placed } = runPlace([LINES.join(" "), ...LINES], items);

  assert.deepEqual(cells[0]._tags, [], "the wrapper took a price");
  assert.equal(placed, LINES.length);
  const bare = LINES.filter((_, i) => cells[i + 1]._tags.length === 0);
  assert.deepEqual(bare, [], "these lines lost their price");
});

// ── A post that is one block, not a list of elements ───────────
// The read came back with four priced weapons and one price appeared. The post
// is a single block of <br>-separated lines with the weapon names in <b> — no
// block elements inside it at all — and placeReadItems scopes its search to the
// post. querySelectorAll returns DESCENDANTS, so it found no hosts and placed
// nothing. The one price on the page came from the deterministic line parser,
// which searches the whole document.
//
// The post itself is a line host. Scoping to it must not exclude it.
function brBlock(lines) {
  const kids = [];
  for (const L of lines) {
    const cut = L.indexOf(" ", L.indexOf(" ") + 1);
    const b = { nodeType: 1, nodeName: "B", childNodes: [], textContent: L.slice(0, cut),
                classList: { contains: () => false } };
    kids.push(b,
      { nodeType: 3, nodeValue: L.slice(cut), textContent: L.slice(cut) },
      { nodeType: 1, nodeName: "BR", childNodes: [], textContent: "",
        classList: { contains: () => false } });
  }
  const el = {
    nodeType: 1, nodeName: "DIV", childNodes: kids, textContent: lines.join(" "),
    _tags: [], isConnected: true,
    classList: { contains: () => false },
    closest: () => null, getAttribute: () => null,
    querySelector: () => null,
    querySelectorAll: () => [],                       // no block descendants
    getElementsByTagName: (t) =>
      (t.toUpperCase() === "BR" ? kids.filter((k) => k.nodeName === "BR") : []),
    insertBefore(n) { this._tags.push(n); return n; },
  };
  kids.forEach((k) => { k.parentNode = el; });
  return el;
}

function runScoped(lines, items) {
  const post = brBlock(lines);
  const sandbox = {
    document: {
      querySelectorAll: () => [post],
      createElement: () => ({ nodeType: 1, className: "", title: "", textContent: "", style: { cssText: "" },
        _a: {},
        setAttribute(k, v) { this._a[k] = String(v); },
        getAttribute(k) { return k in this._a ? this._a[k] : null; },
        hasAttribute(k) { return k in this._a; },
        removeAttribute(k) { delete this._a[k]; } }),
    },
    ITEMS: items, SCOPE: post,
  };
  vm.createContext(sandbox);
  vm.runInContext([
    v("MAX_READ_LINE"), fn("setTip"), fn("fmtBigDollar"), fn("isOurs"), fn("forumLineHosts"),
    fn("forumLineSegments"), fn("segmentText"), fn("readItemFits"), fn("countReadMatches"),
    fn("matchReadItem"), fn("readItemTitle"), fn("placeReadItems"),
    "globalThis.placed = placeReadItems(ITEMS, SCOPE);",
  ].join("\n"), sandbox, { timeout: 5000 });
  return { post, placed: sandbox.placed };
}

test("a post scoped to itself still has its lines found", () => {
  const items = JSON.parse(fs.readFileSync(
    new URL("./data/rwp-text-cache/txt-d7c7fb4b97d94fa9d0b579345a4f7a78.json", import.meta.url), "utf8")).items;
  items.forEach((it, n) => { it.price = { estimate: (n + 1) * 1000 }; });

  const { placed } = runScoped([
    "jackhammer 20% eviscerate 612m",
    "enfield 23% specialist 289m",
    "sig 552 16% puncture 102m",
    "samurai sword 16% motivation 102m",
    "naval cutlass 7% expose 61m",
  ], items);
  assert.equal(placed, 4, "the read's four priced weapons must all land");
});
