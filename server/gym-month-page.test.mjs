// The monthly ladder on /gym: this month's top 25 under Standings, with its
// own countdown, and the finished months under Previous winners. The page's
// named functions run in vm, the way gym-hof.test.mjs runs hofHtml.
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
// One-line `var x = ...;` statements: $, fmt and the month names.
const line = (name) => {
  const m = PAGE.match(new RegExp("^\\s*var " + name.replace("$", "\\$") + " = .*$", "m"));
  assert.ok(m, "no var " + name + " in gym.html");
  return m[0].trim();
};

// The page with a stub document. `data` is the page's own variable, so it is
// declared here and set by the test.
function page(data) {
  const els = {};
  const box = {
    encodeURIComponent,
    document: { getElementById: (id) => (els[id] ||= { innerHTML: "", textContent: "", className: "" }) },
  };
  vm.createContext(box);
  vm.runInContext([
    line("$"), line("fmt"), line("MONTHS"),
    ...["esc", "hofHtml", "joinedPill", "monthHtml", "monthsHtml", "leftText", "countdown", "render"].map(fn),
    "var data = null;",
    "globalThis.P = { monthHtml, monthsHtml, leftText, countdown, render, set: function (d) { data = d; } };",
  ].join("\n"), box);
  box.P.set(data);
  return { P: box.P, els };
}

const DAY = 86400000;
const member = (n, e, extra = {}) => ({ id: String(100 + n), name: "M" + n, energy: e, split: null, joinedAt: null, ...extra });
const TOP = Array.from({ length: 25 }, (_, i) => member(i, 30000 - i * 1000));
const OCT = Date.UTC(2026, 9, 1);

// A whole /api/gym reply as the new server sends it, with the week and the
// month still running and a reading taken a minute ago.
function reply(over = {}) {
  const now = Date.now();
  return {
    week: { start: now - 3 * DAY, end: now + 2 * DAY },
    standings: [member(1, 900)], leaders: [member(1, 900)],
    baselineAt: now - 3 * DAY, lateStart: false, currentAt: now - 60000,
    history: [],
    month: { start: OCT, end: now + 5 * DAY, baselineAt: OCT - 31000, lateStart: false, currentAt: now - 60000, top: TOP },
    months: [],
    health: { lastReadingAt: now - 60000, readings: 10, lastOkAt: now - 60000, lastError: null },
    ...over,
  };
}

test("this month's ladder lists all 25, ranked, with energy and a link to each", () => {
  const html = page(null).P.monthHtml({ top: TOP });
  for (let r = 1; r <= 25; r++) assert.match(html, new RegExp('class="rank">' + r + "<"), "no rank " + r);
  assert.match(html, /M24\b/);
  assert.match(html, />30,000</);
  assert.match(html, /profiles\.php\?XID=124/);
});

test("a member who joined mid-month says when", () => {
  const top = [member(1, 5000, { joinedAt: Date.UTC(2026, 9, 12, 9, 0) })];
  assert.match(page(null).P.monthHtml({ top }), /joined Oct 12</);
});

test("a month nobody has trained in yet says so", () => {
  assert.match(page(null).P.monthHtml({ top: [] }), /Nobody has trained yet this month/);
});

test("names on the monthly ladder are escaped", () => {
  const top = [member(1, 100, { name: "<img src=x onerror=1>" })];
  assert.ok(!/<img/.test(page(null).P.monthHtml({ top })), "unescaped name reached the markup");
});

test("finished months: last month open, older ones folded to their leader", () => {
  const html = page(null).P.monthsHtml([
    { monthStart: Date.UTC(2026, 10, 1), monthEnd: Date.UTC(2026, 11, 1) - 1, top: TOP },
    { monthStart: OCT, monthEnd: Date.UTC(2026, 10, 1) - 1, top: [member(90, 7777), member(91, 6000)] },
  ]);
  const opens = html.match(/<details( open)?>/g) || [];
  assert.deepEqual(opens, ["<details open>", "<details>"]);
  assert.match(html, /November 2026/);
  assert.match(html, /October 2026/);
  assert.match(html, /M90/, "the older month's leader still shows on its summary line");
  assert.match(html, /M24\b/, "and last month shows all 25");
});

test("no finished months yet still reads sensibly", () => {
  assert.match(page(null).P.monthsHtml([]), /No finished months yet/);
});

test("a countdown reads in days, hours and minutes, and seconds on the last day", () => {
  const { P } = page(null);
  const now = Date.UTC(2026, 9, 26, 12, 0, 0);
  assert.equal(P.leftText(now + 5 * DAY + 3 * 3600000 + 2 * 60000, now), "5d 3h 2m ");
  assert.equal(P.leftText(now + 3 * 3600000 + 2 * 60000 + 7000, now), "3h 2m 7s");
});

test("the month's countdown reads scoring… once the month has ended", () => {
  const now = Date.now();
  const { P, els } = page(reply({ month: { ...reply().month, end: now - 1000 } }));
  P.countdown();
  assert.equal(els.mleft.textContent, "scoring…");
});

test("the month keeps counting down after the week has ended", () => {
  // The week's countdown used to return early once the week was over, and the
  // month's would have stopped with it.
  const now = Date.now();
  const { P, els } = page(reply({ week: { start: now - 7 * DAY, end: now - 1000 } }));
  P.countdown();
  assert.equal(els.left.textContent, "scoring…");
  assert.match(els.mleft.textContent, /^\d+d \d+h \d+m $/);
});

test("the month card shows the month by name and its top 25", () => {
  const { P, els } = page(reply({ months: [{ monthStart: Date.UTC(2026, 8, 1), top: [member(90, 7777)] }] }));
  P.render();
  assert.equal(els.monthcard.className, "card");
  assert.equal(els.mtitle.textContent, "October · top 25");
  assert.match(els.monthbox.innerHTML, /M24\b/);
  assert.match(els.mleft.textContent, /^\d+d \d+h \d+m $/);
  assert.equal(els.monthscard.className, "card");
  assert.match(els.months.innerHTML, /September 2026/);
});

test("a reply from before the server knew about months leaves the month cards out", () => {
  // The page is read from disk on every request, so it goes live the moment
  // the files land, while the running server still sends the old reply until
  // it reloads. The weekly board must carry on as before.
  const old = reply();
  delete old.month;
  delete old.months;
  const { P, els } = page(old);
  P.render();
  assert.equal(els.monthcard.className, "card hide");
  assert.equal(els.monthscard.className, "card hide");
  assert.match(els.tablebox.innerHTML, /M1\b/, "the weekly standings still render");
  P.countdown();
  assert.notEqual(els.left.textContent, "", "and the week still counts down");
});

test("a month measured from after the 1st says so, and that it will not be saved", () => {
  const late = { ...reply().month, lateStart: true, baselineAt: Date.UTC(2026, 9, 3, 10, 0) };
  const { P, els } = page(reply({ month: late }));
  P.render();
  assert.match(els.stale.innerHTML, /This month is measured from Sat, 03 Oct 2026 10:00:00 TCT/);
  assert.match(els.stale.innerHTML, /will not be saved/);
});
