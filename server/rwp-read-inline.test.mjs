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
vm.runInContext(fn("matchReadItem") + "\nglobalThis.match = matchReadItem;", box);
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
      createElement: () => ({ nodeType: 1, className: "", title: "", textContent: "", style: { cssText: "" } }),
    },
    PASSES: passes,
    FRESH: () => JSON.parse(JSON.stringify(items)),
  };
  vm.createContext(sandbox);
  vm.runInContext([
    fn("fmtBigDollar"), fn("isOurs"), fn("forumLineHosts"), fn("forumLineSegments"),
    fn("segmentText"), fn("matchReadItem"), fn("readItemTitle"), fn("placeReadItems"),
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
