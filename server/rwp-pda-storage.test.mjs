// RW Pricer on Torn PDA.
//
// PDA runs userscripts through GMforPDA, whose GM_setValue writes the page's
// own localStorage under the very key it was given. Tampermonkey and the
// warboard apps keep GM storage apart from the page. 3.4.8 began deleting the
// localStorage copy of every cache after each save, and again at every load,
// so a stranded price cache could not fill torn.com's storage. On PDA that
// copy IS the save: nothing RW Pricer stored survived, the Items page never had
// a market-price list to label from, and it re-requested the 1 MB
// /v2/torn/items list back to back for as long as the page stayed open.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { parseHTML } from "linkedom";

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
function v(name) {
  const m = SRC.match(new RegExp("^[ \\t]*var[ \\t]+" + name + "[ \\t]*=.*$", "m"));
  assert.ok(m, "var not found: " + name);
  return m[0].trim();
}
// Pieces only the fixed build has. Builds without them still load, so the
// behaviour tests show those builds failing rather than erroring.
const fnIfAny = (name) => (SRC.includes("function " + name + "(") ? fn(name) : "");
const vIfAny = (name) => (new RegExp("^[ \\t]*var[ \\t]+" + name + "[ \\t]*=", "m").test(SRC) ? v(name) : "");

const SCRIPT = [
  "var apiKey = 'PDA-INJECTED';",
  v("CACHE_KEY"), v("NW_APIKEY_KEY"), v("NW_DATA_CACHE_KEY"), v("NW_ITEMS_CACHE_KEY"), v("NW_ITEMS_TTL"),
  vIfAny("SHARED_STORAGE_MAX"), fnIfAny("gmSharesLocalStorage"), vIfAny("GM_SHARES_LOCALSTORAGE"),
  fn("safeGet"), fn("safeSet"), fn("purgeStaleLocalStorageCaches"),
  vIfAny("mpMemory"), fnIfAny("marketPriceMaps"),
  fn("getEffectiveApiKey"), fn("fetchItemMarketPrices"), fn("setupBasePriceLabels"),
  v("tradeInited"), fn("ensureTradePrices"),
].join("\n");

// torn.com's localStorage. While `full` is set, every write fails the way a
// browser's does once the origin has run out of space.
function pageStorage({ full = false } = {}) {
  const m = new Map();
  const ls = {
    full,
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, val) => {
      if (ls.full) throw new DOMException("The quota has been exceeded.", "QuotaExceededError");
      m.set(k, String(val));
    },
    removeItem: (k) => { m.delete(k); },
  };
  return ls;
}

// GMforPDA 2.2, which Torn PDA injects: a GM value is the page's own
// localStorage entry for that key, stored as "GMV2_" + JSON.
function gmForPda(ls) {
  return {
    GM_getValue(key, def) {
      try {
        const r = ls.getItem(key);
        if (typeof r !== "string") return def;
        if (r.startsWith("GMV2_")) return JSON.parse(r.slice(5)) ?? def;
        return r ?? def;
      } catch (e) {
        return def;
      }
    },
    GM_setValue(key, value) { ls.setItem(key, "GMV2_" + JSON.stringify(value)); },
  };
}

// Tampermonkey: GM values live in the extension, apart from the page.
function gmTampermonkey() {
  const store = new Map();
  return {
    GM_getValue: (k, def) => (store.has(k) ? structuredClone(store.get(k)) : def),
    GM_setValue: (k, val) => { store.set(k, structuredClone(val)); },
  };
}

const pda = (opts) => { const ls = pageStorage(opts); return { ls, gm: gmForPda(ls) }; };
const tampermonkey = () => ({ ls: pageStorage(), gm: gmTampermonkey() });

const QUIET = { log() {}, warn() {}, error() {} };
const plain = (o) => JSON.parse(JSON.stringify(o)); // vm objects come from another realm

// One page load: the script's storage code starts fresh on the same device,
// including the clean-up that runs at the top of every load.
function loadPage(device, extra = {}) {
  const sandbox = {
    localStorage: device.ls, GM_getValue: device.gm.GM_getValue, GM_setValue: device.gm.GM_setValue,
    console: QUIET, ...extra,
  };
  vm.createContext(sandbox);
  vm.runInContext(SCRIPT + "\npurgeStaleLocalStorageCaches();", sandbox);
  return sandbox;
}

const MARKET = { ts: 1760000000000, map: { 206: 873392 }, byName: { xanax: 873392 }, byId: { 206: 873392 } };
const FEED = JSON.stringify({ weaponPrices: { Katana: { Yellow: [1, 2, 3, 4] } }, timestamp: 1, recent: "x".repeat(1_600_000) });

test("PDA: a market-price list saved on one page is still there on the next", () => {
  const device = pda();
  loadPage(device).safeSet("rwp_torn_items_marketprice", MARKET);
  assert.deepEqual(plain(loadPage(device).safeGet("rwp_torn_items_marketprice", null)), MARKET);
});

test("PDA: the 1.6M-character price feed is never written into torn.com's localStorage", () => {
  const device = pda();
  loadPage(device).safeSet("rwp_price_cache", FEED);
  assert.equal(device.ls.getItem("rwp_price_cache"), null);
});

test("PDA: a price feed an older version left in localStorage is cleared at load", () => {
  const device = pda();
  device.ls.setItem("rwp_price_cache", "GMV2_" + JSON.stringify(FEED));
  loadPage(device);
  assert.equal(device.ls.getItem("rwp_price_cache"), null);
});

// About the size of the real list (~54K characters for 1,500 items): over the
// 51,200-character cap of the plain-localStorage fallback, under the cap for
// what PDA may keep in torn.com's storage.
function realSizedMarket() {
  const list = { ts: 1760000000000, map: {}, byName: {}, byId: {} };
  for (let id = 1; id <= 1500; id++) {
    list.map[id] = 1000 + id;
    list.byName["item number " + id] = 1000 + id;
    list.byId[id] = 1000 + id;
  }
  return list;
}

test("PDA: a load that finds torn.com storage full keeps what was saved", () => {
  const device = pda();
  device.ls.setItem("rwp_torn_items_marketprice", "GMV2_" + JSON.stringify(MARKET));
  device.ls.full = true;
  assert.deepEqual(plain(loadPage(device).safeGet("rwp_torn_items_marketprice", null)), MARKET);
});

test("PDA: a save that fails because storage filled up keeps the older list", () => {
  const device = pda();
  const older = realSizedMarket();
  const size = JSON.stringify(older).length;
  assert.ok(size > 51200 && size < 100000, "fixture must sit between the two caps, is " + size);
  loadPage(device).safeSet("rwp_torn_items_marketprice", older);
  device.ls.full = true;
  loadPage(device).safeSet("rwp_torn_items_marketprice", { ...older, ts: older.ts + 1 });
  assert.deepEqual(plain(loadPage(device).safeGet("rwp_torn_items_marketprice", null)), older);
});

test("Tampermonkey: a page load after the first writes nothing to GM storage", () => {
  const device = tampermonkey();
  loadPage(device);
  let writes = 0;
  const counted = { ls: device.ls, gm: { GM_getValue: device.gm.GM_getValue, GM_setValue: (k, val) => { writes++; device.gm.GM_setValue(k, val); } } };
  loadPage(counted);
  assert.equal(writes, 0);
});

test("Tampermonkey: a cache an old version stranded in localStorage is still cleared at load", () => {
  const device = tampermonkey();
  device.ls.setItem("rwp_torn_items_marketprice", JSON.stringify(MARKET));
  loadPage(device);
  assert.equal(device.ls.getItem("rwp_torn_items_marketprice"), null);
});

test("Tampermonkey: the price feed is still kept between pages", () => {
  const device = tampermonkey();
  loadPage(device).safeSet("rwp_price_cache", FEED);
  assert.equal(loadPage(device).safeGet("rwp_price_cache", null), FEED);
});

// /v2/torn/items as Torn returns it (2026-10-19), cut to the two items on the
// page; description and effect are shortened.
const TORN_ITEMS = { items: [
  { id: 206, name: "Xanax", description: "Xanax in Torn City is very different to ...", effect: "Increases energy by 250 and ha...", requirement: null,
    image: "https://www.torn.com/images/items/206/large.png", type: "Drug", sub_type: null, is_masked: false, is_tradable: true, is_found_in_city: true,
    value: { vendor: { country: "United Kingdom", name: "Black Market" },
      shops: [{ country: "United Kingdom", shop: "Black Market", buy_price: null, sell_price: null }],
      buy_price: null, sell_price: null, market_price: 873392 },
    circulation: 9018042, details: null },
  { id: 564, name: "Glasses", description: "A pair of high quality designer spectacl...", effect: "Improves Search for cash crime...", requirement: null,
    image: "https://www.torn.com/images/items/564/large.png", type: "Enhancer", sub_type: null, is_masked: false, is_tradable: true, is_found_in_city: false,
    value: { vendor: null, shops: [], buy_price: null, sell_price: null, market_price: 8048 },
    circulation: 554679, details: null },
] };
const TOO_MANY_REQUESTS = { error: { code: 5, error: "Too many requests" } };
const ITEMS_PAGE = '<html><body><ul class="items-cont">' +
  '<li><span class="name-wrap"><span class="name">Xanax</span></span></li>' +
  '<li><span class="name-wrap"><span class="name">Glasses</span></span></li>' +
  "</ul></body></html>";

// Opens item.php for 20 seconds of page time. The script's own timers run 50x
// fast; every Torn reply takes 5 ms. Returns how often Torn was asked for
// /v2/torn/items and the price labels on the page at the end.
async function openItemsPage(device, reply) {
  const { document, window } = parseHTML(ITEMS_PAGE);
  const handles = [];
  let calls = 0;
  const fetch = () => {
    calls++;
    return new Promise((resolve) => handles.push(setTimeout(() => resolve({ json: async () => reply }), 5)));
  };
  const page = loadPage(device, {
    document, window, fetch,
    setTimeout: (f, ms) => { const h = setTimeout(f, ms / 50); handles.push(h); return h; },
    setInterval: (f, ms) => { const h = setInterval(f, ms / 50); handles.push(h); return h; },
  });
  page.setupBasePriceLabels();
  await new Promise((r) => setTimeout(r, 20_000 / 50));
  handles.forEach((h) => { clearTimeout(h); clearInterval(h); });
  return { calls, labels: [...document.querySelectorAll(".rwp-base-price-tag")].map((s) => s.textContent) };
}

test("PDA: the Items page asks Torn once and labels the items", async () => {
  assert.deepEqual(await openItemsPage(pda(), TORN_ITEMS), { calls: 1, labels: ["$873,392", "$8,048"] });
});

test("PDA: the next Items page labels from the saved list without asking Torn", async () => {
  const device = pda();
  await openItemsPage(device, TORN_ITEMS);
  assert.deepEqual(await openItemsPage(device, TORN_ITEMS), { calls: 0, labels: ["$873,392", "$8,048"] });
});

test("PDA with full storage: the Items page labels from memory after one request", async () => {
  assert.deepEqual(await openItemsPage(pda({ full: true }), TORN_ITEMS), { calls: 1, labels: ["$873,392", "$8,048"] });
});

test("PDA: after Torn refuses, the Items page waits instead of asking again", async () => {
  assert.deepEqual(await openItemsPage(pda(), TOO_MANY_REQUESTS), { calls: 1, labels: [] });
});

test("Tampermonkey: the list one Items page fetched serves the next", async () => {
  const device = tampermonkey();
  await openItemsPage(device, TORN_ITEMS);
  assert.deepEqual(await openItemsPage(device, TORN_ITEMS), { calls: 0, labels: ["$873,392", "$8,048"] });
});

// Opens a trade for 20 seconds of page time and returns the market list (by
// name) that the last pricing pass handed to injectTradePrices.
async function openTradePage(device, reply) {
  const { document, window } = parseHTML("<html><body></body></html>");
  const handles = [];
  const handed = [];
  const fetch = () => new Promise((resolve) => handles.push(setTimeout(() => resolve({ json: async () => reply }), 5)));
  const page = loadPage(device, {
    document, window, fetch,
    injectTradePrices: (maps) => { handed.push(maps ? plain(maps.byName) : null); },
    setTimeout: (f, ms) => { const h = setTimeout(f, ms / 50); handles.push(h); return h; },
    setInterval: (f, ms) => { const h = setInterval(f, ms / 50); handles.push(h); return h; },
  });
  page.ensureTradePrices();
  await new Promise((r) => setTimeout(r, 20_000 / 50));
  handles.forEach((h) => { clearTimeout(h); clearInterval(h); });
  return handed[handed.length - 1];
}

test("PDA with full storage: the trade page prices plain items from the list it just fetched", async () => {
  assert.deepEqual(await openTradePage(pda({ full: true }), TORN_ITEMS), { xanax: 873392, glasses: 8048 });
});
