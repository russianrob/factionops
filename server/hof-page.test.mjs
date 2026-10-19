// The /hof page: its named functions run in vm, the way gym-hof.test.mjs runs
// /gym's, with document, fetch and the timers stubbed.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import vm from "node:vm";

process.env.DATA_DIR = mkdtempSync(join(tmpdir(), "hof-page-test-"));
const climb = await import("./hof-climb.js");

const PAGE = readFileSync(new URL("./pages/hof.html", import.meta.url), "utf8");
function fn(name) {
  const i = PAGE.indexOf("function " + name + "(");
  assert.ok(i >= 0, "not in hof.html: " + name);
  let k = PAGE.indexOf("(", i), depth = 0;
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
const NAMES = ["esc", "sep", "fmtNum", "fmtWeek", "fmtDate", "updatedLabel", "passLabel", "headerHtml",
  "switchHtml", "horizonsHtml", "noteHtml", "niceStep", "chartSvg", "tableHtml", "followUpDelay",
  "refreshDue", "setStatus", "render", "load"];
const CONSTS = PAGE.match(/^var [A-Z_]+ = .*;$/gm);
function page(globals = {}, extra = []) {
  const names = [...NAMES, ...extra];
  const box = { ...globals };
  vm.createContext(box);
  vm.runInContext([...CONSTS, ...names.map(fn), `globalThis.P = { ${names.join(", ")}, STATE };`].join("\n"), box);
  return box.P;
}

const UPDATED = Date.UTC(2026, 9, 19, 12, 0);
const row = (position, over = {}) => ({ position, id: 2000 + position, name: "F" + position, respect: 3552938 + (250 - position) * 1000,
  gap: (250 - position) * 1000, pace: { 7: 50, 30: 40 }, days: { 7: 30, 30: 25 }, ...over });
const ROWS = [];
for (let p = 230; p < 250; p++) ROWS.push(row(p));
ROWS.push({ position: 250, id: 42055, name: "Dead Fragment", respect: 3552938, gap: 0, us: true,
  pace: { 7: 110, 30: 100 }, days: { 7: null, 30: null } });
for (let p = 251; p <= 255; p++) ROWS.push(row(p, { gap: (250 - p) * 1000, days: { 7: null, 30: null } }));
Object.assign(ROWS[19].days, { 30: 0.3 });                         // #249: passed later today
Object.assign(ROWS[18], { pace: { 7: 120, 30: 120 }, days: { 7: null, 30: null } });  // #248: faster than us
Object.assign(ROWS[0].days, { 30: 400 });                          // #230: more than a year
Object.assign(ROWS[15].days, { 30: 100 });                         // #245: next year
Object.assign(ROWS[17], { name: "<b>Evil</b> & co" });             // #247
Object.assign(ROWS[16], { pace: { 7: null, 30: null } });          // #246: no pace
Object.assign(ROWS[21], { pace: { 7: 160, 30: 160 }, days: { 7: 0, 30: 0 } });     // #251: today
Object.assign(ROWS[22], { pace: { 7: 160, 30: 160 }, days: { 7: 0.5, 30: 0.5 } }); // #252: 1 day
Object.assign(ROWS[23], { pace: { 7: 160, 30: 160 }, days: { 7: 20.2, 30: 20.2 } }); // #253: 21 days
Object.assign(ROWS[24], { pace: { 7: 101, 30: 101 }, days: { 7: 400, 30: 400 } });   // #254: over a year
const DATA = {
  factionId: 42055, source: "live", refreshing: false, updatedAt: UPDATED, day: "2026-10-19",
  windows: [7, 30], defaultWindow: 30,
  us: { position: 250, respect: 3552938, pace: { 7: 110, 30: 100 } },
  rows: ROWS,
  history: [{ day: "2026-09-18", position: 255 }, { day: "2026-10-18", position: 250 }, { day: "2026-10-19", position: 250 }],
  projection: {
    7: Array.from({ length: 365 }, (_, i) => 249 - Math.floor(i / 10)),
    30: Array.from({ length: 365 }, (_, i) => 248 - Math.floor(i / 6)),
  },
  notes: { 7: null, 30: "We climbed 5 places last month (#255 to #250)." },
};

test("the page formats numbers exactly as hof-climb.js does", () => {
  const P = page();
  for (const v of [0, 188, 9999, 10000, 74850, 99950, 110914, 999500, 3552938, -33882, -1000000]) {
    assert.equal(P.fmtNum(v), climb.fmtNum(v), String(v));
  }
});

test("the table lists 20 above, us highlighted, and 5 below, linked to Torn", () => {
  const html = page().tableHtml(DATA, 30);
  assert.equal(html.split("<tr").length - 1, 27, "a header row and 26 rows");
  assert.equal(html.split('<tr class="us">').length - 1, 1);
  assert.match(html, /href="https:\/\/www\.torn\.com\/factions\.php\?step=profile&amp;ID=2249"[^>]*>#249 F249</);
});

test("faction names from Torn are escaped", () => {
  const html = page().tableHtml(DATA, 30);
  assert.ok(html.includes("#247 &lt;b&gt;Evil&lt;/b&gt; &amp; co"));
  assert.ok(!html.includes("<b>Evil</b>"));
});

test("the pass column says when we pass, or why we don't", () => {
  const P = page();
  const label = (i) => P.passLabel(ROWS[i], i < 20, 100, 30, UPDATED);
  assert.equal(label(19), "19 Oct");
  assert.equal(label(18), "pulling away");
  assert.equal(label(0), "over a year");
  assert.equal(label(15), "27 Jan 2027", "the year shows when it isn't this year");
  assert.equal(label(16), "—", "no pace");
  assert.equal(label(20), "", "our own row");
  assert.equal(label(21), "catches us today");
  assert.equal(label(22), "catches us in 1 day");
  assert.equal(label(23), "catches us in 21 days");
  assert.equal(label(24), "", "beyond a year, a row below shows nothing");
  assert.equal(label(25), "", "a slower row below shows nothing");
});

test("the chart draws history solid and the projection dashed, best at the top", () => {
  const svg = page().chartSvg(DATA, 30);
  const pts = (cls) => svg.match(new RegExp(`class="${cls}" points="([^"]+)"`))[1].split(" ").map((p) => p.split(",").map(Number));
  const hist = pts("hist");
  assert.equal(hist.length, 3);
  assert.ok(hist[0][1] > hist[2][1], "#255 sits lower than #250");
  assert.equal(pts("proj").length, 366, "from today out to a year");
  assert.match(PAGE, /\.chart \.proj\{[^}]*stroke-dasharray/);
  assert.equal(svg.split('class="dot"').length - 1, 5);
  for (const h of [7, 30, 91, 182, 365]) assert.ok(svg.includes(">#" + DATA.projection[30][h - 1] + "<"), "label at d=" + h);
  assert.match(page().chartSvg(DATA, 30, 360), /viewBox="0 0 360 240"/, "drawn at the container's width");
});

test("the switch redraws from the data already loaded, with no new request", () => {
  const els = {};
  let fetches = 0;
  const P = page({ document: { getElementById: (id) => (els[id] ||= { innerHTML: "" }) }, fetch: () => { fetches++; } });
  P.STATE.data = DATA;
  P.STATE.w = 7;
  P.render();
  assert.match(els.horizons.innerHTML, /1 week<\/span><span class="v">#249</);
  assert.match(els.switch.innerHTML, /data-w="7" class="on"/);
  assert.equal(els.note.innerHTML, "");
  P.STATE.w = 30;
  P.render();
  assert.match(els.horizons.innerHTML, /1 week<\/span><span class="v">#247</);
  assert.equal(els.note.innerHTML, "We climbed 5 places last month (#255 to #250).");
  assert.equal(fetches, 0);
});

test("the switch offers only available windows, 30 days first", () => {
  const html = page().switchHtml({ ...DATA, windows: [7, 30, 90] }, 30);
  assert.deepEqual([...html.matchAll(/data-w="(\d+)"/g)].map((m) => m[1]), ["30", "7", "90"]);
  assert.deepEqual([...page().switchHtml(DATA, 30).matchAll(/data-w="(\d+)"/g)].map((m) => m[1]), ["30", "7"]);
});

test("a 'refreshing' answer gets exactly one more fetch, five seconds later", async () => {
  const els = {}, timers = [];
  let fetches = 0;
  const P = page({
    document: { getElementById: (id) => (els[id] ||= { innerHTML: "", textContent: "", className: "" }) },
    fetch: async () => { fetches++; return { status: 200, ok: true, json: async () => ({ ...DATA, refreshing: true }) }; },
    setTimeout: (cb, ms) => { timers.push({ cb, ms }); },
  });
  await P.load(false);
  assert.deepEqual(timers.map((t) => t.ms), [5000]);
  timers[0].cb();
  await new Promise((resolve) => setImmediate(resolve));  // let the follow-up's answer arrive
  assert.equal(fetches, 2);
  assert.equal(timers.length, 1, "the follow-up doesn't schedule another");
});

test("the refresh runs every 15 minutes while visible, and in Torn PDA even when 'hidden'", () => {
  const P = page(), MIN = 60000, t = UPDATED;
  assert.equal(P.refreshDue(t, t + 15 * MIN, true, false), true);
  assert.equal(P.refreshDue(t, t + 14 * MIN, true, false), false);
  assert.equal(P.refreshDue(t, t + 30 * MIN, false, false), false, "a background tab spends nothing");
  assert.equal(P.refreshDue(t, t + 30 * MIN, false, true), true, "PDA can report hidden while on screen");
  assert.equal(P.followUpDelay({ refreshing: false }), null);
});

test("the header says how fresh the standings are", () => {
  const P = page();
  assert.equal(P.updatedLabel(UPDATED, UPDATED + 30000), "updated just now");
  assert.equal(P.updatedLabel(UPDATED, UPDATED + 5 * 60000), "updated 5 min ago");
  assert.equal(P.updatedLabel(UPDATED, UPDATED + 3 * 3600000), "updated 3 h ago");
  assert.match(P.headerHtml(DATA, 30, UPDATED + 60000), /#250<\/div>.*Dead Fragment.*3,552,938 respect · 700 a week \(30-day average\)/);
  assert.match(P.headerHtml({ ...DATA, source: "midnight" }, 30, UPDATED), /Torn&#39;s live standings are unavailable/);
  assert.match(P.headerHtml(DATA, 30, Date.UTC(2026, 9, 21, 12)), /Paces come from the 2026-10-19 snapshot\./);
});

// ── review fixes ────────────────────────────────────────────────────────
test("right after a restart the header says the live standings are loading, not unavailable", () => {
  const html = page().headerHtml({ ...DATA, source: "midnight", refreshing: true }, 30, UPDATED);
  assert.match(html, /Loading Torn&#39;s live standings/);
  assert.doesNotMatch(html, /unavailable/);
  assert.match(page().headerHtml({ ...DATA, source: "midnight", refreshing: false }, 30, UPDATED), /unavailable/);
});

test("between loads the page still redraws, so 'updated N min ago' keeps counting", () => {
  const els = {};
  let fetches = 0;
  const P = page({ document: { hidden: false, getElementById: (id) => (els[id] ||= { innerHTML: "" }) },
    fetch: () => { fetches++; } }, ["tick"]);
  P.STATE.data = { ...DATA, updatedAt: Date.now() - 5 * 60000 };
  P.STATE.loadedAt = Date.now();
  P.STATE.w = 30;
  P.tick();
  assert.equal(fetches, 0, "not due for a reload yet");
  assert.match(els.head.innerHTML, /updated 5 min ago/);
});

// ── pace per week ───────────────────────────────────────────────────────
test("paces show per week, the rhythm of the wars", () => {
  const P = page();
  const cases = [[7775.87, "54.4k"], [2368, "16.6k"], [310.9, "2,176"], [-10, "-70"], [0, "0"], [null, "—"], [NaN, "—"]];
  for (const [p, want] of cases) assert.equal(P.fmtWeek(p), want, String(p));
});

test("the table's pace column is per week", () => {
  const html = page().tableHtml(DATA, 30);
  assert.match(html, /<th>Pace \/week<\/th>/);
  assert.match(html, />#249 F249<\/a><\/td><td>1,000<\/td><td>280<\/td>/);
});

test("'How this works' explains the pace as respect per week", () => {
  assert.match(PAGE, /Pace is the respect gained between Torn's daily snapshots over\s+the window, shown per week\./);
  assert.doesNotMatch(PAGE, /divided by the days/);
});
