import test from "node:test";
import assert from "node:assert";
import fs from "node:fs";

const src = fs.readFileSync(new URL("./public/scripts/torn-foreign-stock.user.js", import.meta.url), "utf8");
const mod = (function () {
  const module = { exports: {} };
  new Function("module", "exports", src)(module, module.exports);
  return module.exports;
})();

test("module loads and exports an object", () => {
  assert.strictEqual(typeof mod, "object");
});

test("normalizeCountryName maps canonical names", () => {
  assert.strictEqual(mod.normalizeCountryName("Mexico"), "mex");
  assert.strictEqual(mod.normalizeCountryName("South Africa"), "sou");
  assert.strictEqual(mod.normalizeCountryName("Cayman Islands"), "cay");
});

test("normalizeCountryName handles variants + whitespace/case", () => {
  assert.strictEqual(mod.normalizeCountryName("  united   kingdom "), "uni");
  assert.strictEqual(mod.normalizeCountryName("UK"), "uni");
  assert.strictEqual(mod.normalizeCountryName("United Arab Emirates"), "uae");
  assert.strictEqual(mod.normalizeCountryName("UAE"), "uae");
});

test("normalizeCountryName returns null for unknown", () => {
  assert.strictEqual(mod.normalizeCountryName("Torn"), null);
  assert.strictEqual(mod.normalizeCountryName(""), null);
  assert.strictEqual(mod.normalizeCountryName(null), null);
});

test("parseYataExport normalizes countries + items", () => {
  const json = { stocks: { mex: { update: 1000, stocks: [ { id: 99, name: "Springfield 1911", quantity: 49, cost: 430 } ] } } };
  const out = mod.parseYataExport(json);
  assert.deepStrictEqual(out.mex.items[0], { id: 99, name: "Springfield 1911", qty: 49, cost: 430, nextRestock: null });
  assert.strictEqual(out.mex.update, 1000);
});

test("parseYataExport tolerates missing fields", () => {
  assert.deepStrictEqual(mod.parseYataExport({}), {});
  assert.deepStrictEqual(mod.parseYataExport(null), {});
});

test("fmtMoney and fmtProfit", () => {
  assert.strictEqual(mod.fmtMoney(1071816), "$1,071,816");
  assert.strictEqual(mod.fmtMoney(null), "—");
  assert.strictEqual(mod.fmtProfit(8370), "+$8,370");
  assert.strictEqual(mod.fmtProfit(-500), "-$500");
  assert.strictEqual(mod.fmtProfit(null), "—");
});

test("formatAge text + staleness", () => {
  assert.strictEqual(mod.formatAge(1000, 1030).text, "just now");
  assert.strictEqual(mod.formatAge(1000, 1000 + 120).text, "2m ago");
  assert.strictEqual(mod.formatAge(1000, 1000 + 120).stale, false);
  assert.strictEqual(mod.formatAge(1000, 1000 + 31 * 60).stale, true);
  assert.strictEqual(mod.formatAge(1000, 1000 + 90 * 60).text, "1h 30m ago");
});

const ITEMS = [
  { id: 1, name: "Xanax", qty: 88, cost: 830 },
  { id: 2, name: "Plushie", qty: 142, cost: 452 },
  { id: 3, name: "Aaa", qty: 142, cost: 452 }
];

test("buildRows stock mode leaves profit null", () => {
  const rows = mod.buildRows(ITEMS, { mode: "stock" });
  assert.strictEqual(rows[0].profit, null);
  assert.strictEqual(rows[0].value, null);
});

test("buildRows profit mode computes value-cost by id; miss => null", () => {
  const prices = { 1: 9200, 2: 850 };
  const rows = mod.buildRows(ITEMS, { mode: "profit", getValue: function (id) { return prices[id]; } });
  assert.strictEqual(rows[0].profit, 9200 - 830);
  assert.strictEqual(rows[1].profit, 850 - 452);
  assert.strictEqual(rows[2].profit, null);
});

test("sortRows stock: price desc, then qty desc, then name", () => {
  const rows = mod.sortRows(mod.buildRows(ITEMS, { mode: "stock" }), "stock");
  assert.deepStrictEqual(rows.map(function (r) { return r.id; }), [1, 3, 2]);
});

test("sortRows profit: profit desc, nulls last", () => {
  const prices = { 1: 9200, 2: 850 };
  const rows = mod.sortRows(mod.buildRows(ITEMS, { mode: "profit", getValue: function (id) { return prices[id]; } }), "profit");
  assert.deepStrictEqual(rows.map(function (r) { return r.id; }), [1, 2, 3]);
});

test("getStock caches within TTL and refreshes after", async () => {
  const store = {};
  globalThis.GM_getValue = (k, d) => (k in store ? store[k] : d);
  globalThis.GM_setValue = (k, v) => { store[k] = v; };
  let clock = 1000, calls = 0;
  mod.__setClock(() => clock);
  mod.__setFetch(async () => { calls++; return { stocks: { mex: { update: 1, stocks: [{ id: 1, name: "X", quantity: 2, cost: 3 }] } } }; });

  const a = await mod.getStock();
  assert.strictEqual(a.mex.items[0].id, 1);
  assert.strictEqual(calls, 1);
  await mod.getStock();
  assert.strictEqual(calls, 1);
  clock += 301;
  await mod.getStock();
  assert.strictEqual(calls, 2);
});

test("getStock serves stale cache on fetch failure", async () => {
  const store = {};
  globalThis.GM_getValue = (k, d) => (k in store ? store[k] : d);
  globalThis.GM_setValue = (k, v) => { store[k] = v; };
  let clock = 1000;
  mod.__setClock(() => clock);
  mod.__setFetch(async () => ({ stocks: { mex: { update: 1, stocks: [] } } }));
  await mod.getStock();
  clock += 999999;
  mod.__setFetch(async () => { throw new Error("down"); });
  const out = await mod.getStock();
  assert.ok(out.mex);
});

test("getPrices maps v2 value.market_price and throws on api error", async () => {
  const store = {};
  globalThis.GM_getValue = (k, d) => (k in store ? store[k] : d);
  globalThis.GM_setValue = (k, v) => { store[k] = v; };
  mod.__setClock(() => 1000);
  mod.__setFetch(async () => ({ items: { "1": { id: 1, value: { market_price: 9200 } }, "2": { id: 2, value: { market_price: 850 } } } }));
  const map = await mod.getPrices("KEY");
  assert.strictEqual(map[1], 9200);
  mod.__setFetch(async () => ({ error: { error: "Incorrect key" } }));
  await assert.rejects(() => mod.getPrices("BADKEY"));
});

test("parseYataExport keeps nextRestock (prombot) and defaults null (yata)", () => {
  const prom = { stocks: { mex: { update: 1, stocks: [{ id: 5, name: "A", quantity: 0, cost: 9, nextRestock: "2026-06-09T16:45:00.000Z" }] } } };
  assert.strictEqual(mod.parseYataExport(prom).mex.items[0].nextRestock, "2026-06-09T16:45:00.000Z");
  const yata = { stocks: { mex: { update: 1, stocks: [{ id: 5, name: "A", quantity: 3, cost: 9 }] } } };
  assert.strictEqual(mod.parseYataExport(yata).mex.items[0].nextRestock, null);
});

test("restockEta: null for missing/invalid/long-past, due for recent past, text for future", () => {
  const now = Date.parse("2026-06-09T16:00:00.000Z");
  assert.strictEqual(mod.restockEta(null, now), null);
  assert.strictEqual(mod.restockEta("not-a-date", now), null);
  assert.strictEqual(mod.restockEta("2026-06-09T14:00:00.000Z", now), null); // 2h past -> null
  const due = mod.restockEta("2026-06-09T15:30:00.000Z", now); // 30m past -> due
  assert.strictEqual(due.due, true);
  assert.strictEqual(due.text, "due");
  const f = mod.restockEta("2026-06-09T16:09:00.000Z", now);
  assert.strictEqual(f.text, "9m");
  assert.strictEqual(f.due, false);
  assert.strictEqual(mod.restockEta("2026-06-09T17:24:00.000Z", now).text, "1h 24m");
});

test("sortRows out-of-stock: future soonest, then due, then none", () => {
  const now = Date.parse("2026-06-09T16:00:00.000Z");
  const rows = [
    { id: 4, name: "Soon", qty: 0, cost: 1, profit: null, nextRestock: "2026-06-09T16:10:00.000Z" },
    { id: 5, name: "None", qty: 0, cost: 1, profit: null, nextRestock: null },
    { id: 6, name: "Due", qty: 0, cost: 1, profit: null, nextRestock: "2026-06-09T15:40:00.000Z" }
  ];
  const ids = mod.sortRows(rows, "stock", now).map(function (r) { return r.id; });
  assert.deepStrictEqual(ids, [4, 6, 5]); // future, due, none
});

test("getStock uses Prombot, falls back to YATA on Prombot failure", async () => {
  const store = {};
  globalThis.GM_getValue = (k, d) => (k in store ? store[k] : d);
  globalThis.GM_setValue = (k, v) => { store[k] = v; };
  mod.__setClock(() => 2000);
  mod.__setFetch(async (url) => {
    if (url.indexOf("prombot") !== -1) throw new Error("prombot down");
    return { stocks: { mex: { update: 1, stocks: [{ id: 7, name: "Y", quantity: 1, cost: 2 }] } } };
  });
  const out = await mod.getStock(true);
  assert.strictEqual(out.mex.items[0].id, 7);
});

test("sortRows: in-stock before out-of-stock; out-of-stock by soonest restock", () => {
  const now = Date.parse("2026-06-09T16:00:00.000Z");
  const rows = [
    { id: 1, name: "InB", qty: 5, cost: 100, profit: null, nextRestock: null },
    { id: 2, name: "OutLate", qty: 0, cost: 50, profit: null, nextRestock: "2026-06-09T18:00:00.000Z" },
    { id: 3, name: "InA", qty: 9, cost: 200, profit: null, nextRestock: null },
    { id: 4, name: "OutSoon", qty: 0, cost: 50, profit: null, nextRestock: "2026-06-09T16:10:00.000Z" },
    { id: 5, name: "OutNone", qty: 0, cost: 50, profit: null, nextRestock: null }
  ];
  const ids = mod.sortRows(rows, "stock", now).map(function (r) { return r.id; });
  assert.deepStrictEqual(ids, [3, 1, 4, 2, 5]); // in-stock by cost desc (200,100), then out-of-stock: soon, late, none
});

test("getModel fetches + caches the GitHub model items map", async () => {
  const store = {};
  globalThis.GM_getValue = (k, d) => (k in store ? store[k] : d);
  globalThis.GM_setValue = (k, v) => { store[k] = v; };
  let clock = 5000, calls = 0;
  mod.__setClock(() => clock);
  mod.__setFetch(async () => { calls++; return { updated: 1, items: { uae: { "384": { interval: 1500, last: 1, n: 5, rel: "med" } } } }; });
  const a = await mod.getModel();
  assert.strictEqual(a.uae["384"].interval, 1500);
  assert.strictEqual(calls, 1);
  await mod.getModel();
  assert.strictEqual(calls, 1);
  clock += 601;
  await mod.getModel();
  assert.strictEqual(calls, 2);
});

test("fmtDuration", () => {
  assert.strictEqual(mod.fmtDuration(1500), "25m");
  assert.strictEqual(mod.fmtDuration(3900), "1h 5m");
});

test("modelEstimate builds '~every X · ~Y (rel)' and 'due' when past", () => {
  const now = Date.parse("2026-06-09T16:00:00.000Z");
  const lastSec = Math.floor(now / 1000) - 600;
  const e = mod.modelEstimate({ interval: 1500, last: lastSec, n: 5, rel: "med" }, now);
  assert.strictEqual(e, "~every 25m · ~15m (med)");
  const past = mod.modelEstimate({ interval: 300, last: Math.floor(now / 1000) - 600, n: 5, rel: "low" }, now);
  assert.strictEqual(past, "~every 5m · due (low)");
});

test("restockDisplay merge priority", () => {
  const now = Date.parse("2026-06-09T16:00:00.000Z");
  const entry = { interval: 1500, last: Math.floor(now / 1000) - 600, n: 5, rel: "med" };
  assert.strictEqual(mod.restockDisplay("2026-06-09T16:09:00.000Z", entry, now), "restocks in 9m");
  assert.strictEqual(mod.restockDisplay(null, entry, now), "~every 25m · ~15m (med)");
  assert.strictEqual(mod.restockDisplay("2026-06-09T15:40:00.000Z", null, now), "restock due");
  assert.strictEqual(mod.restockDisplay(null, null, now), "out of stock");
});
