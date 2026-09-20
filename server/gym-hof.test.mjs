// The Previous-winners block on /gym.
//
// It showed one name and one number per completed week, while the server had
// been storing the full top ten all along — finaliseWeeks writes
// `top: rows.filter(r => !r.partial).slice(0, 10)` for every week it freezes.
// The week of 2026-09-13 already held ten rows on disk and the page rendered
// the first of them.
//
// Most recent week expanded, older ones collapsed to their winner line: after
// a year that is one screen rather than two hundred rows, and the newest week
// is the one anybody opens the page to read.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const PAGE = fs.readFileSync(new URL("./pages/gym.html", import.meta.url), "utf8");

function fn(name) {
  const i = PAGE.indexOf("function " + name + "(");
  assert.ok(i >= 0, "not in gym.html: " + name);
  let p = PAGE.indexOf("(", i), depth = 0, k = p;
  for (; k < PAGE.length; k++) {
    if (PAGE[k] === "(") depth++;
    else if (PAGE[k] === ")" && --depth === 0) break;
  }
  const o = PAGE.indexOf("{", k);
  let d = 0;
  for (let j = o; j < PAGE.length; j++) {
    if (PAGE[j] === "{") d++;
    else if (PAGE[j] === "}" && --d === 0) return PAGE.slice(i, j + 1);
  }
  throw new Error("unbalanced braces in " + name);
}

function render(history) {
  const box = { encodeURIComponent };
  vm.createContext(box);
  vm.runInContext([
    fn("esc"),
    // fmt is a var-assigned arrow, not a declaration.
    PAGE.match(/^\s*var fmt = .*$/m)[0].trim(),
    fn("hofHtml"),
    "globalThis.out = hofHtml(HISTORY);",
  ].join("\n"), Object.assign(box, { HISTORY: history }));
  return box.out;
}

const member = (n, e, extra = {}) => ({ id: 100 + n, name: "M" + n, energy: e, ...extra });
const week = (start, top, winners) => ({
  weekStart: start, weekEnd: start + 604799999,
  winners: winners || [top[0]], top,
});
const TEN = Array.from({ length: 10 }, (_, i) => member(i, 10000 - i * 500));

test("the newest week shows all ten, not just the winner", () => {
  const html = render([week(Date.UTC(2026, 8, 13), TEN)]);
  for (const m of TEN) assert.match(html, new RegExp(m.name + "\\b"), m.name + " missing");
});

test("each of them is ranked, with the winner starred rather than numbered", () => {
  // The winner is always in `winners`, so they always carry the joint marker.
  // Ranks therefore run star, 2, 3 ... 10 — which reads correctly for one
  // winner and stays correct for a tie, where numbering would invent an order.
  const html = render([week(Date.UTC(2026, 8, 13), TEN)]);
  assert.match(html, /\u2605/, "the winner is not marked");
  for (let r = 2; r <= 10; r++) {
    assert.match(html, new RegExp(">" + r + "<"), "no rank " + r);
  }
});

test("only the newest week is open", () => {
  // The whole reason for expanding one: a year of this is 52 weeks. <details>
  // COLLAPSES its content rather than removing it, so the check is on the open
  // attribute — the runner-up is in the markup either way, just not on screen.
  const newest = week(Date.UTC(2026, 8, 13), TEN);
  const older = week(Date.UTC(2026, 8, 6), [member(90, 7777), member(91, 6000)]);
  const html = render([newest, older]);
  const opens = html.match(/<details( open)?>/g) || [];
  assert.equal(opens.length, 2, "both weeks should be expandable");
  assert.equal(opens[0], "<details open>", "the newest week should start open");
  assert.equal(opens[1], "<details>", "older weeks should start closed");
  assert.match(html, /M90/, "the older week's winner still shows on its summary line");
});

test("an older week can be opened", () => {
  const html = render([
    week(Date.UTC(2026, 8, 13), TEN),
    week(Date.UTC(2026, 8, 6), [member(90, 7777)]),
  ]);
  assert.match(html, /<details/, "older weeks need to be expandable");
});

test("a tie shows every joint winner", () => {
  // winnersOf can return more than one, and the rank must not claim otherwise.
  const tied = [member(1, 9000), member(2, 9000), member(3, 100)];
  const html = render([week(Date.UTC(2026, 8, 13), tied, [tied[0], tied[1]])]);
  assert.match(html, /M1/);
  assert.match(html, /M2/);
});

test("no completed weeks still reads sensibly", () => {
  assert.match(render([]), /first winner is crowned/i);
});

test("names are escaped", () => {
  // A Torn name is not ours to trust into innerHTML.
  const html = render([week(Date.UTC(2026, 8, 13), [member(1, 100, { name: '<img src=x onerror=1>' })])]);
  assert.ok(!/<img/.test(html), "unescaped name reached the markup");
});
