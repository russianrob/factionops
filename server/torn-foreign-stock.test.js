import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

// Load the userscript as a CommonJS module via its guarded module.exports.
const mod = require("./public/scripts/torn-foreign-stock.user.js");

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
  assert.deepStrictEqual(out.mex.items[0], { id: 99, name: "Springfield 1911", qty: 49, cost: 430 });
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
