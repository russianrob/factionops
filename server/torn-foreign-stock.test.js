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

test("modelEstimate builds '~every X · ~Y (rel)' and rolls forward when past", () => {
  const now = Date.parse("2026-06-09T16:00:00.000Z");
  const lastSec = Math.floor(now / 1000) - 600;
  const e = mod.modelEstimate({ interval: 1500, last: lastSec, n: 5, rel: "med" }, now);
  assert.strictEqual(e, "~every 25m · ~15m (med)");
  // last+interval already passed: roll forward to the next future cycle, never "due"
  const past = mod.modelEstimate({ interval: 300, last: Math.floor(now / 1000) - 700, n: 5, rel: "low" }, now);
  assert.strictEqual(past, "~every 5m · ~3m (low)");
});

test("restockDisplay merge priority", () => {
  const now = Date.parse("2026-06-09T16:00:00.000Z");
  const entry = { interval: 1500, last: Math.floor(now / 1000) - 600, n: 5, rel: "med" };
  assert.strictEqual(mod.restockDisplay("2026-06-09T16:09:00.000Z", entry, now), "restocks in 9m");
  assert.strictEqual(mod.restockDisplay(null, entry, now), "~every 25m · ~15m (med)");
  assert.strictEqual(mod.restockDisplay("2026-06-09T15:40:00.000Z", null, now), "restock due");
  assert.strictEqual(mod.restockDisplay(null, null, now), "out of stock");
});

test("itemCategory maps known ids and defaults Other", () => {
  assert.strictEqual(mod.itemCategory(26), "Weapon");
  assert.strictEqual(mod.itemCategory(196), "Drug");
  assert.strictEqual(mod.itemCategory(258), "Plushie");
  assert.strictEqual(mod.itemCategory(260), "Flower");
  assert.strictEqual(mod.itemCategory(50), "Armor");
  assert.strictEqual(mod.itemCategory(99999), "Other");
});

test("rowVisible: out-of-stock, negative-profit, category filters", () => {
  const base = { id: 26, qty: 5, profit: 100 };   // Weapon, in stock, +profit
  assert.strictEqual(mod.rowVisible(base, "stock", { hideOos: false, hideNeg: false, excludedCats: [], hiddenCountries: [] }), true);
  assert.strictEqual(mod.rowVisible({ id: 26, qty: 0, profit: null }, "stock", { hideOos: true, excludedCats: [] }), false);
  assert.strictEqual(mod.rowVisible({ id: 26, qty: 0, profit: null }, "stock", { hideOos: false, excludedCats: [] }), true);
  // hideNeg only applies in profit mode
  assert.strictEqual(mod.rowVisible({ id: 26, qty: 5, profit: -50 }, "profit", { hideNeg: true, excludedCats: [] }), false);
  assert.strictEqual(mod.rowVisible({ id: 26, qty: 5, profit: -50 }, "stock", { hideNeg: true, excludedCats: [] }), true);
  // excluded category hides the row
  assert.strictEqual(mod.rowVisible({ id: 26, qty: 5, profit: 1 }, "stock", { excludedCats: ["Weapon"] }), false);
  assert.strictEqual(mod.rowVisible({ id: 196, qty: 5, profit: 1 }, "stock", { excludedCats: ["Weapon"] }), true);
});

test("countryVisible: hidden set", () => {
  assert.strictEqual(mod.countryVisible("mex", { hiddenCountries: [] }), true);
  assert.strictEqual(mod.countryVisible("mex", { hiddenCountries: ["mex"] }), false);
  assert.strictEqual(mod.countryVisible("uae", { hiddenCountries: ["mex"] }), true);
});

test("parseFlightMinutes: h/m datetime format", () => {
  assert.strictEqual(mod.parseFlightMinutes("0h 18m"), 18);
  assert.strictEqual(mod.parseFlightMinutes("2h 39m"), 159);
  assert.strictEqual(mod.parseFlightMinutes("4h 31m"), 271);
});

test("parseFlightMinutes: colon clock format", () => {
  assert.strictEqual(mod.parseFlightMinutes("00:18"), 18);
  assert.strictEqual(mod.parseFlightMinutes("2:39"), 159);
  assert.strictEqual(mod.parseFlightMinutes("1:23:45"), 84);
});

test("parseFlightMinutes: junk -> null", () => {
  assert.strictEqual(mod.parseFlightMinutes(""), null);
  assert.strictEqual(mod.parseFlightMinutes(null), null);
  assert.strictEqual(mod.parseFlightMinutes("flight time"), null);
  assert.strictEqual(mod.parseFlightMinutes("abc"), null);
});

function withDocument(checkedMethod, fn) {
  const prev = globalThis.document;
  globalThis.document = {
    querySelector: function (sel) {
      if (sel.indexOf("travelType") !== -1) {
        return checkedMethod == null ? null : { value: checkedMethod };
      }
      return null;
    }
  };
  try { return fn(); } finally {
    if (prev === undefined) delete globalThis.document; else globalThis.document = prev;
  }
}

test("getTravelMethod: reads checked radio value, defaults standard", () => {
  withDocument("airstrip", () => assert.strictEqual(mod.getTravelMethod(), "airstrip"));
  withDocument("business", () => assert.strictEqual(mod.getTravelMethod(), "business"));
  withDocument(null, () => assert.strictEqual(mod.getTravelMethod(), "standard"));
  withDocument("bogus", () => assert.strictEqual(mod.getTravelMethod(), "standard"));
});

test("readFlightMinutes: DOM time[datetime] primary", () => {
  const destEl = {
    querySelector: function (sel) {
      if (sel.indexOf("time") !== -1) {
        return { getAttribute: function () { return "0h 18m"; }, querySelector: function () { return null; }, textContent: "00:18" };
      }
      return null;
    }
  };
  withDocument("standard", () => assert.strictEqual(mod.readFlightMinutes(destEl, "mex"), 18));
});

test("readFlightMinutes: missing time node -> base-table x method fallback", () => {
  const noTime = { querySelector: function () { return null; } };
  // standard: mex 26 * 1 = 26; uae 271 * 1 = 271
  withDocument("standard", () => {
    assert.strictEqual(mod.readFlightMinutes(noTime, "mex"), 26);
    assert.strictEqual(mod.readFlightMinutes(noTime, "uae"), 271);
  });
  // airstrip: mex round(26 * 0.7) = 18; private: uae round(271 * 0.5) = 136
  withDocument("airstrip", () => assert.strictEqual(mod.readFlightMinutes(noTime, "mex"), 18));
  withDocument("private", () => assert.strictEqual(mod.readFlightMinutes(noTime, "uae"), 136));
  // null destEl also falls back via table
  withDocument("standard", () => assert.strictEqual(mod.readFlightMinutes(null, "swi"), 175));
});

test("readFlightMinutes: unknown code with no DOM -> null", () => {
  withDocument("standard", () => assert.strictEqual(mod.readFlightMinutes(null, "zzz"), null));
});

const NOW = Date.parse("2026-06-09T16:00:00.000Z");
function nowSecOf(ms) { return Math.floor(ms / 1000); }

test("landVerdict: null when not ready or no flight time", () => {
  assert.strictEqual(mod.landVerdict({ qty: 50, sellRate: 1, srel: "high", sellReady: false, flightMinutes: 18, nextRestock: null, restockEntry: null, nowMs: NOW }), null);
  assert.strictEqual(mod.landVerdict({ qty: 50, sellRate: 1, srel: "high", sellReady: true, flightMinutes: null, nextRestock: null, restockEntry: null, nowMs: NOW }), null);
});

test("landVerdict: SAFE shows margin (big buffer)", () => {
  // qty 50, rate 1/min -> bufferedRate 1.15 -> M=43.5min, F=18 -> margin ~25.5
  const v = mod.landVerdict({ qty: 50, sellRate: 1, srel: "high", sellReady: true, flightMinutes: 18, nextRestock: null, restockEntry: null, nowMs: NOW });
  assert.strictEqual(v.state, "SAFE");
  assert.strictEqual(v.lowConf, false);
  assert.match(v.text, /In stock when you land/);
  assert.match(v.text, /buffer/);
});

test("landVerdict: SAFE via M >= 1.5F even when margin < 8", () => {
  // F=10, qty=20, rate=1 -> M=17.4, margin=7.4 (<8) but M>=1.5F(15) -> SAFE
  const v = mod.landVerdict({ qty: 20, sellRate: 1, srel: "high", sellReady: true, flightMinutes: 10, nextRestock: null, restockEntry: null, nowMs: NOW });
  assert.strictEqual(v.state, "SAFE");
});

test("landVerdict: RISKY shows margin (cutting it close)", () => {
  // F=18, qty=23, rate=1 -> M=20, margin=2 (0<=margin<8) -> RISKY
  const v = mod.landVerdict({ qty: 23, sellRate: 1, srel: "high", sellReady: true, flightMinutes: 18, nextRestock: null, restockEntry: null, nowMs: NOW });
  assert.strictEqual(v.state, "RISKY");
  assert.match(v.text, /Cutting it close/);
  assert.match(v.text, /to spare/);
});

test("landVerdict: GONE when sells out and no restock", () => {
  // F=18, qty=5, rate=1 -> M=4.3 < F, no restock -> GONE
  const v = mod.landVerdict({ qty: 5, sellRate: 1, srel: "high", sellReady: true, flightMinutes: 18, nextRestock: null, restockEntry: null, nowMs: NOW });
  assert.strictEqual(v.state, "GONE");
  assert.match(v.text, /sell out before you land/);
});

test("landVerdict: GONE_THEN_RESTOCKED when restock lands during flight after sellout", () => {
  // F=18, qty=5, rate=1 -> M=4.3; restock in 10m -> R=10, M(4.3)<R(10)<=F(18) -> GONE_THEN_RESTOCKED
  const nextRestock = new Date(NOW + 10 * 60000).toISOString();
  const v = mod.landVerdict({ qty: 5, sellRate: 1, srel: "high", sellReady: true, flightMinutes: 18, nextRestock: nextRestock, restockEntry: null, nowMs: NOW });
  assert.strictEqual(v.state, "GONE_THEN_RESTOCKED");
  assert.match(v.text, /restocks ~\d+m before you land/i);
});

test("landVerdict: GONE_THEN_RESTOCKED uses model roll-forward when rel != low", () => {
  // F=18, qty=5, rate=1 -> M=4.3; model interval 600s, last 7m ago -> next restock 3m out -> R=3 but R<M? M=4.3>R=3 -> not GTR -> GONE
  // make interval such that R between M and F: last 4m ago, interval 600 -> next in 6m, R=6 in (M,F] -> GTR
  const entry = { interval: 600, last: nowSecOf(NOW) - 240, n: 5, rel: "med" };
  const v = mod.landVerdict({ qty: 5, sellRate: 1, srel: "high", sellReady: true, flightMinutes: 18, nextRestock: null, restockEntry: entry, nowMs: NOW });
  assert.strictEqual(v.state, "GONE_THEN_RESTOCKED");
});

test("landVerdict: rel=low suppresses model restock promise -> GONE", () => {
  const entry = { interval: 600, last: nowSecOf(NOW) - 240, n: 5, rel: "low" };
  const v = mod.landVerdict({ qty: 5, sellRate: 1, srel: "high", sellReady: true, flightMinutes: 18, nextRestock: null, restockEntry: entry, nowMs: NOW });
  assert.strictEqual(v.state, "GONE");
});

test("landVerdict: qty<=0 restock-driven (restocks before land)", () => {
  const nextRestock = new Date(NOW + 12 * 60000).toISOString();
  const v = mod.landVerdict({ qty: 0, sellRate: 1, srel: "high", sellReady: true, flightMinutes: 18, nextRestock: nextRestock, restockEntry: null, nowMs: NOW });
  assert.strictEqual(v.state, "GONE_THEN_RESTOCKED");
  assert.match(v.text, /Restocks ~\d+m before you land/i);
});

test("landVerdict: qty<=0 no restock -> GONE out of stock", () => {
  const v = mod.landVerdict({ qty: 0, sellRate: 1, srel: "high", sellReady: true, flightMinutes: 18, nextRestock: null, restockEntry: null, nowMs: NOW });
  assert.strictEqual(v.state, "GONE");
  assert.match(v.text, /Out of stock/i);
});

test("landVerdict: srel=low sets lowConf and omits numeric margin", () => {
  const v = mod.landVerdict({ qty: 50, sellRate: 1, srel: "low", sellReady: true, flightMinutes: 18, nextRestock: null, restockEntry: null, nowMs: NOW });
  assert.strictEqual(v.state, "SAFE");
  assert.strictEqual(v.lowConf, true);
  assert.doesNotMatch(v.text, /buffer|to spare|~\d+m/);
});

test("landVerdict: zero rate (no observed depletion) -> SAFE", () => {
  const v = mod.landVerdict({ qty: 50, sellRate: 0, srel: "high", sellReady: true, flightMinutes: 18, nextRestock: null, restockEntry: null, nowMs: NOW });
  assert.strictEqual(v.state, "SAFE");
});

test("landVerdict: negative or non-finite rate is not a confident verdict -> null", () => {
  assert.strictEqual(mod.landVerdict({ qty: 50, sellRate: -1, srel: "high", sellReady: true, flightMinutes: 18, nextRestock: null, restockEntry: null, nowMs: NOW }), null);
  assert.strictEqual(mod.landVerdict({ qty: 50, sellRate: NaN, srel: "high", sellReady: true, flightMinutes: 18, nextRestock: null, restockEntry: null, nowMs: NOW }), null);
  assert.strictEqual(mod.landVerdict({ qty: 50, sellRate: Infinity, srel: "high", sellReady: true, flightMinutes: 18, nextRestock: null, restockEntry: null, nowMs: NOW }), null);
});

test("parseTravelState: traveling to a foreign country -> flight + fields", () => {
  const api = {
    status: { state: "Traveling", description: "Traveling from Switzerland to Mexico" },
    travel: { destination: "Mexico", method: "Airstrip", timestamp: 1700001234, departed: 1700000000, time_left: 1080 }
  };
  const s = mod.parseTravelState(api);
  assert.deepStrictEqual(s, { mode: "flight", code: "mex", countryName: "Mexico", arrivalSec: 1700001234, timeLeftSec: 1080 });
});

test("parseTravelState: traveling home to Torn -> null", () => {
  const api = {
    status: { state: "Traveling", description: "Traveling from Mexico to Torn" },
    travel: { destination: "Torn", method: "Airstrip", timestamp: 1700001234, time_left: 600 }
  };
  assert.strictEqual(mod.parseTravelState(api), null);
});

test("parseTravelState: abroad 'In Mexico' from status.description -> abroad/mex", () => {
  const api = {
    status: { state: "Abroad", description: "In Mexico" },
    travel: { destination: "Mexico", method: "Airstrip", timestamp: 0, time_left: 0 }
  };
  const s = mod.parseTravelState(api);
  assert.deepStrictEqual(s, { mode: "abroad", code: "mex", countryName: "Mexico", arrivalSec: null, timeLeftSec: null });
});

test("parseTravelState: abroad falls back to travel.destination when no 'In X' match", () => {
  const api = {
    status: { state: "Abroad", description: "Doing something in a foreign land" },
    travel: { destination: "Japan", method: "Airstrip", timestamp: 0, time_left: 0 }
  };
  const s = mod.parseTravelState(api);
  assert.deepStrictEqual(s, { mode: "abroad", code: "jap", countryName: "Japan", arrivalSec: null, timeLeftSec: null });
});

test("parseTravelState: state Okay (at home) -> null", () => {
  assert.strictEqual(mod.parseTravelState({ status: { state: "Okay", description: "Okay" }, travel: {} }), null);
});

test("parseTravelState: missing status -> null", () => {
  assert.strictEqual(mod.parseTravelState({ travel: { destination: "Mexico" } }), null);
  assert.strictEqual(mod.parseTravelState({}), null);
  assert.strictEqual(mod.parseTravelState(null), null);
});

test("parseTravelState: unknown country -> null", () => {
  const flight = {
    status: { state: "Traveling", description: "Traveling from Torn to Narnia" },
    travel: { destination: "Narnia", method: "Airstrip", timestamp: 1, time_left: 1 }
  };
  assert.strictEqual(mod.parseTravelState(flight), null);
  const abroad = {
    status: { state: "Abroad", description: "In Narnia" },
    travel: { destination: "Narnia" }
  };
  assert.strictEqual(mod.parseTravelState(abroad), null);
});

function withTravelDoc(listPresent, fn) {
  const prev = globalThis.document;
  globalThis.document = {
    querySelector: function (sel) {
      if (sel.indexOf("country___") !== -1) return listPresent ? {} : null;
      return null;
    }
  };
  try { return fn(); } finally {
    if (prev === undefined) delete globalThis.document; else globalThis.document = prev;
  }
}

const FLIGHT_API = {
  status: { state: "Traveling", description: "Traveling from Torn to Mexico" },
  travel: { destination: "Mexico", method: "Airstrip", timestamp: 1700001234, time_left: 1080 }
};

test("getTravelState: no key set -> null, no fetch", async () => {
  const store = {};
  globalThis.GM_getValue = (k, d) => (k in store ? store[k] : d);
  globalThis.GM_setValue = (k, v) => { store[k] = v; };
  mod.__setClock(() => 1000);
  let calls = 0;
  mod.__setFetch(async () => { calls++; return FLIGHT_API; });
  const out = await withTravelDoc(false, () => mod.getTravelState());
  assert.strictEqual(out, null);
  assert.strictEqual(calls, 0);
});

test("getTravelState: destination list present -> skip fetch, null", async () => {
  const store = { tfs_key: JSON.stringify("KEY") };
  globalThis.GM_getValue = (k, d) => (k in store ? store[k] : d);
  globalThis.GM_setValue = (k, v) => { store[k] = v; };
  mod.__setClock(() => 1000);
  let calls = 0;
  mod.__setFetch(async () => { calls++; return FLIGHT_API; });
  const out = await withTravelDoc(true, () => mod.getTravelState());
  assert.strictEqual(out, null);
  assert.strictEqual(calls, 0);
});

test("getTravelState: with key + list absent -> fetches v1 travel,basic and parses flight", async () => {
  const store = { tfs_key: JSON.stringify("KEY") };
  globalThis.GM_getValue = (k, d) => (k in store ? store[k] : d);
  globalThis.GM_setValue = (k, v) => { store[k] = v; };
  mod.__setClock(() => 1000);
  let url = null, calls = 0;
  mod.__setFetch(async (u) => { calls++; url = u; return FLIGHT_API; });
  const out = await withTravelDoc(false, () => mod.getTravelState());
  assert.deepStrictEqual(out, { mode: "flight", code: "mex", countryName: "Mexico", arrivalSec: 1700001234, timeLeftSec: 1080 });
  assert.strictEqual(calls, 1);
  assert.match(url, /api\.torn\.com\/user\/?\?/);
  assert.match(url, /selections=travel,basic/);
  assert.match(url, /key=KEY/);
});

test("getTravelState: caches within TRAVEL_TTL, refetches after", async () => {
  const store = { tfs_key: JSON.stringify("KEY") };
  globalThis.GM_getValue = (k, d) => (k in store ? store[k] : d);
  globalThis.GM_setValue = (k, v) => { store[k] = v; };
  let clock = 1000, calls = 0;
  mod.__setClock(() => clock);
  mod.__setFetch(async () => { calls++; return FLIGHT_API; });
  await withTravelDoc(false, () => mod.getTravelState());
  assert.strictEqual(calls, 1);
  await withTravelDoc(false, () => mod.getTravelState());
  assert.strictEqual(calls, 1);
  clock += 31;
  await withTravelDoc(false, () => mod.getTravelState());
  assert.strictEqual(calls, 2);
});

test("getTravelState: API error -> null quietly (no throw)", async () => {
  const store = { tfs_key: JSON.stringify("KEY") };
  globalThis.GM_getValue = (k, d) => (k in store ? store[k] : d);
  globalThis.GM_setValue = (k, v) => { store[k] = v; };
  mod.__setClock(() => 1000);
  mod.__setFetch(async () => ({ error: { error: "Incorrect key" } }));
  const out = await withTravelDoc(false, () => mod.getTravelState());
  assert.strictEqual(out, null);
});

test("getTravelState: network failure -> null quietly", async () => {
  const store = { tfs_key: JSON.stringify("KEY") };
  globalThis.GM_getValue = (k, d) => (k in store ? store[k] : d);
  globalThis.GM_setValue = (k, v) => { store[k] = v; };
  mod.__setClock(() => 1000);
  mod.__setFetch(async () => { throw new Error("down"); });
  const out = await withTravelDoc(false, () => mod.getTravelState());
  assert.strictEqual(out, null);
});

test("getTravelState: API error -> preserves last cached-good state and refreshes its TTL", async () => {
  const store = { tfs_key: JSON.stringify("KEY") };
  globalThis.GM_getValue = (k, d) => (k in store ? store[k] : d);
  globalThis.GM_setValue = (k, v) => { store[k] = v; };
  let clock = 1000, calls = 0;
  mod.__setClock(() => clock);
  mod.__setFetch(async () => { calls++; return FLIGHT_API; });
  const first = await withTravelDoc(false, () => mod.getTravelState());
  assert.deepStrictEqual(first, { mode: "flight", code: "mex", countryName: "Mexico", arrivalSec: 1700001234, timeLeftSec: 1080 });
  assert.strictEqual(calls, 1);
  // TTL elapses, next poll errors -> keep last good, don't return null
  clock += 31;
  mod.__setFetch(async () => { calls++; return { error: { error: "Incorrect key" } }; });
  const out = await withTravelDoc(false, () => mod.getTravelState());
  assert.deepStrictEqual(out, first);
  assert.strictEqual(calls, 2);
  // TTL was refreshed on the error path -> next poll serves cache, does NOT spam
  const cached = await withTravelDoc(false, () => mod.getTravelState());
  assert.deepStrictEqual(cached, first);
  assert.strictEqual(calls, 2);
});

test("getTravelState: network failure -> preserves last cached-good state and refreshes its TTL", async () => {
  const store = { tfs_key: JSON.stringify("KEY") };
  globalThis.GM_getValue = (k, d) => (k in store ? store[k] : d);
  globalThis.GM_setValue = (k, v) => { store[k] = v; };
  let clock = 1000, calls = 0;
  mod.__setClock(() => clock);
  mod.__setFetch(async () => { calls++; return FLIGHT_API; });
  const first = await withTravelDoc(false, () => mod.getTravelState());
  assert.strictEqual(calls, 1);
  clock += 31;
  mod.__setFetch(async () => { calls++; throw new Error("down"); });
  const out = await withTravelDoc(false, () => mod.getTravelState());
  assert.deepStrictEqual(out, first);
  assert.strictEqual(calls, 2);
  const cached = await withTravelDoc(false, () => mod.getTravelState());
  assert.deepStrictEqual(cached, first);
  assert.strictEqual(calls, 2);
});

test("getTravelState: error with no prior cache still returns null quietly", async () => {
  const store = { tfs_key: JSON.stringify("KEY") };
  globalThis.GM_getValue = (k, d) => (k in store ? store[k] : d);
  globalThis.GM_setValue = (k, v) => { store[k] = v; };
  mod.__setClock(() => 1000);
  mod.__setFetch(async () => ({ error: { error: "Incorrect key" } }));
  const out = await withTravelDoc(false, () => mod.getTravelState());
  assert.strictEqual(out, null);
});

test("getTravelState: destinationList present -> skip fetch, null", async () => {
  const store = { tfs_key: JSON.stringify("KEY") };
  globalThis.GM_getValue = (k, d) => (k in store ? store[k] : d);
  globalThis.GM_setValue = (k, v) => { store[k] = v; };
  mod.__setClock(() => 1000);
  let calls = 0;
  mod.__setFetch(async () => { calls++; return FLIGHT_API; });
  const prev = globalThis.document;
  globalThis.document = {
    querySelector: function (sel) {
      if (sel.indexOf("destinationList___") !== -1) return {};
      return null;
    }
  };
  try {
    const out = await mod.getTravelState();
    assert.strictEqual(out, null);
    assert.strictEqual(calls, 0);
  } finally {
    if (prev === undefined) delete globalThis.document; else globalThis.document = prev;
  }
});

test("travelRowsHtml applies filters (hide-out-of-stock) like the destination-list panels", () => {
  const store = {};
  globalThis.GM_getValue = (k, d) => (k in store ? store[k] : d);
  globalThis.GM_setValue = (k, v) => { store[k] = v; };
  const state = { mode: "abroad", code: "mex", countryName: "Mexico" };
  const stock = { mex: { items: [
    { id: 1, name: "InStockItem", qty: 5, cost: 100 },
    { id: 2, name: "OosItem", qty: 0, cost: 100 }
  ] } };
  const now = Date.parse("2026-06-09T16:00:00.000Z");

  // filters off (empty store) -> both rows present
  let html = mod.travelRowsHtml(state, stock, {}, {}, "stock", now);
  assert.ok(html.includes("InStockItem"));
  assert.ok(html.includes("OosItem"));

  // hide-out-of-stock on -> the qty-0 row is filtered out of the travel panel too
  store["tfs_hide_oos"] = JSON.stringify(true);
  html = mod.travelRowsHtml(state, stock, {}, {}, "stock", now);
  assert.ok(html.includes("InStockItem"));
  assert.ok(!html.includes("OosItem"));
});

// ── Live-stock parser (Torn foreign-store React grid) ──────────────
function tfsMakeCell(label, value) {
  const sr = label == null ? null : { textContent: label };
  return {
    textContent: (label == null ? "" : label) + (value == null ? "" : value),
    querySelector: (sel) => (sel.indexOf("srOnly") !== -1 ? sr : null)
  };
}
function tfsMakeRow(cells) {
  const cellObjs = cells.map((c) => tfsMakeCell(c.label, c.value));
  return { querySelectorAll: (sel) => (sel.indexOf("cell___") !== -1 ? cellObjs : []) };
}

test("tfsStockFromRow reads the stock-labeled cell's number (bare text node)", () => {
  const row = tfsMakeRow([
    { label: null, value: "" },                // image cell
    { label: null, value: "Claymore Mine" },   // name (button)
    { label: "type ", value: "Temporary" },
    { label: "stock ", value: "982" },
    { label: null, value: "$70,000" }
  ]);
  assert.strictEqual(mod.tfsStockFromRow(row), 982);
});

test("tfsStockFromRow strips commas in the stock count", () => {
  assert.strictEqual(mod.tfsStockFromRow(tfsMakeRow([{ label: "stock ", value: "1,021" }])), 1021);
});

test("tfsStockFromRow returns 0 for an Out-of-stock cell", () => {
  assert.strictEqual(mod.tfsStockFromRow(tfsMakeRow([{ label: "stock ", value: "Out of stock" }])), 0);
});

test("tfsStockFromRow prefers a stock cell over an available cell", () => {
  const row = tfsMakeRow([
    { label: "available ", value: "5" },
    { label: "stock ", value: "982" }
  ]);
  assert.strictEqual(mod.tfsStockFromRow(row), 982);
});

test("tfsStockFromRow falls back to available when there is no stock cell", () => {
  assert.strictEqual(mod.tfsStockFromRow(tfsMakeRow([{ label: "available ", value: "37" }])), 37);
});

test("tfsStockFromRow returns null when no stock/available column exists", () => {
  const row = tfsMakeRow([
    { label: "type ", value: "Temporary" },
    { label: null, value: "$70,000" }
  ]);
  assert.strictEqual(mod.tfsStockFromRow(row), null);
});

test("tfsCellLabel lowercases the srOnly label", () => {
  assert.strictEqual(mod.tfsCellLabel(tfsMakeCell("Stock ", "982")).trim(), "stock");
});

test("tfsStoreRowImgId extracts the item id from the store image", () => {
  const row = {
    querySelector: (sel) => (sel.indexOf("images/items") !== -1
      ? { getAttribute: () => "/images/items/229/medium.png" } : null)
  };
  assert.strictEqual(mod.tfsStoreRowImgId(row), "229");
});
