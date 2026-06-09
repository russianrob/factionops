# Foreign Stock on Travel Page — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `torn-foreign-stock.user.js` — a standalone userscript that shows YATA foreign stock inline on Torn's `page.php?sid=travel`, with a keyless stock view and an optional-API-key profit view.

**Architecture:** One IIFE userscript. Pure logic (country mapping, YATA parsing, money/age formatting, row building, sorting) is defined as plain functions and exposed via a guarded `module.exports` so it can be unit-tested under `node --test` without a browser. Browser-only concerns (GM storage, `GM_xmlhttpRequest` fetches, DOM injection, MutationObserver) run only when a `window`/`page.php?sid=travel` context is present. A throwaway diagnostic script captures the real `page.php?sid=travel` DOM (unverified in the TornPDA WebView) before the injector is built.

**Tech Stack:** Vanilla ES5-compatible JS (Tampermonkey + TornPDA WebView), `GM_xmlhttpRequest`/`GM_getValue`/`GM_setValue`, YATA travel export API, Torn API v2 `torn?selections=items`. Tests: node's built-in `node:test` + `node:assert`.

**Reference:** Approved spec at `docs/superpowers/specs/2026-06-09-foreign-stock-travel-page-design.md`.

**Conventions (warboard):** scripts live in `server/public/scripts/` (served static at `https://tornwar.com/scripts/<file>` and `http://127.0.0.1:3000/scripts/<file>`). Bump `@version` (in `.user.js` + `.meta.js`) **and** the in-file `SCRIPT_VERSION` together. `node --check` then `curl` the served file to verify. Commit messages end with the `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>` trailer. Standing rules: `@author`/`@namespace` RussianRob; `@license GPL-3.0-or-later`; no descriptive code comments, no changelog block, no `@copyright`; plain semver; Greasy Fork distribution.

---

## File Structure

- **Create** `server/public/scripts/foreign-stock-diag.user.js` — throwaway DOM-discovery diag (deleted in Task 11).
- **Create** `server/public/scripts/torn-foreign-stock.user.js` — the shipped script (all components).
- **Create** `server/public/scripts/torn-foreign-stock.meta.js` — Greasy Fork meta block.
- **Create** `server/torn-foreign-stock.test.js` — `node --test` unit tests for the pure logic + cache layer (dev verification tool; committed alongside the script).

The shipped script is a single file by necessity (userscripts ship as one file). Internally it is organised into labelled sections: pure helpers → GM/data layer → DOM (settings, injector, observer) → init. The pure helpers are the only part under unit test; DOM/network are verified by `node --check`, the served-file curl, and manual on-page checks.

---

## Task 1: DOM-discovery diagnostic

Captures the `page.php?sid=travel` destination-row DOM on the user's device (TornPDA + desktop) so the injector (Task 8) anchors to real elements. Cannot be unit-tested — it is a capture step whose output is read from the server log.

**Files:**
- Create: `server/public/scripts/foreign-stock-diag.user.js`

- [ ] **Step 1: Write the diag script**

```javascript
// ==UserScript==
// @name         Foreign Stock Diag
// @namespace    RussianRob
// @version      1.0.0
// @description  Temporary diagnostic — reports the page.php?sid=travel destination DOM so Foreign Stock can anchor its panels. Safe to remove after.
// @author       RussianRob
// @match        https://www.torn.com/page.php?sid=travel*
// @grant        GM_xmlhttpRequest
// @grant        GM_registerMenuCommand
// @connect      tornwar.com
// @run-at       document-idle
// ==/UserScript==
(function () {
  "use strict";
  var DIAG_URL = "https://tornwar.com/api/debug/client-log";
  var sent = 0, MAX = 14, seen = {}, noted = false;
  var COUNTRIES = ["mexico","cayman","canada","hawaii","kingdom","argentina","switzerland","japan","china","emirates","uae","africa"];
  function post(p) {
    if (sent >= MAX) return; sent++;
    try { GM_xmlhttpRequest({ method: "POST", url: DIAG_URL, headers: { "Content-Type": "application/json" }, data: JSON.stringify({ tag: "foreign-stock-diag", data: p }) }); } catch (e) {}
  }
  function cls(el) { try { return (el.getAttribute && el.getAttribute("class")) || ""; } catch (_) { return ""; } }
  function chain(el, n) {
    var out = [], e = el;
    for (var i = 0; i < n && e; i++) {
      var t = (e.textContent || "").replace(/\s+/g, " ").trim();
      out.push(e.tagName.toLowerCase() + "|" + cls(e).slice(0, 45) + "|len" + t.length + "|" + t.slice(0, 50));
      e = e.parentElement;
    }
    return out;
  }
  function scan() {
    // Find elements whose own text names a country — those are (or sit inside) destination rows.
    var all = document.querySelectorAll("div,li,tr,a,span"), hits = [];
    for (var i = 0; i < all.length; i++) {
      var el = all[i];
      if (!el.getClientRects().length) continue;
      var txt = (el.textContent || "").trim().toLowerCase();
      if (txt.length < 3 || txt.length > 120) continue;
      for (var c = 0; c < COUNTRIES.length; c++) {
        if (txt.indexOf(COUNTRIES[c]) !== -1) { hits.push(el); break; }
      }
    }
    if (!hits.length) return;
    if (!noted) { noted = true; post({ note: "travel scan", url: location.href.slice(0, 140), hits: hits.length }); }
    for (var k = 0; k < hits.length && k < 12; k++) {
      var el2 = hits[k], key = el2.tagName + "|" + cls(el2).slice(0, 30);
      if (seen[key]) continue; seen[key] = 1;
      post({
        tag2: el2.tagName.toLowerCase(),
        cls: cls(el2).slice(0, 80),
        text: (el2.textContent || "").replace(/\s+/g, " ").trim().slice(0, 90),
        chain: chain(el2, 6),
        html: (el2.outerHTML || "").replace(/\s+/g, " ").slice(0, 1200)
      });
    }
  }
  var iv = setInterval(function () { scan(); if (sent >= MAX) clearInterval(iv); }, 1500);
  try { if (typeof GM_registerMenuCommand === "function") GM_registerMenuCommand("Foreign Stock diag: capture now", function () { noted = false; seen = {}; sent = 0; scan(); }); } catch (_) {}
})();
```

- [ ] **Step 2: Syntax check**

Run: `node --check /opt/warboard/server/public/scripts/foreign-stock-diag.user.js`
Expected: no output (exit 0).

- [ ] **Step 3: Confirm it is served**

Run: `curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:3000/scripts/foreign-stock-diag.user.js`
Expected: `200`

- [ ] **Step 4: User installs + loads the travel page**

Ask the user to install `https://tornwar.com/scripts/foreign-stock-diag.user.js`, open `page.php?sid=travel` on their device, and let it sit a few seconds. Then read the capture:

Run: `grep "foreign-stock-diag" /var/log/warboard/warboard-out.log | tail -14`
Expected: JSON rows showing each destination element's tag/class/chain/outerHTML.

- [ ] **Step 5: Record the DOM facts**

Append a short note to the spec's "DOM Discovery" section (or a comment in this plan) capturing: the destination-row selector, the element that holds the country name, and the best anchor element to insert a panel after. These feed Task 8's `findDestinations()`/`renderPanel()`.

- [ ] **Step 6: Commit the diag**

```bash
cd /opt/warboard && git add server/public/scripts/foreign-stock-diag.user.js
git commit -m "foreign-stock-diag 1.0.0: capture page.php?sid=travel destination DOM

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Script skeleton, metadata, and test harness

Creates the shipped file with its metadata block, the init guard, and the test-export hook, plus the empty test file. Establishes the `node --test` workflow before any logic exists.

**Files:**
- Create: `server/public/scripts/torn-foreign-stock.user.js`
- Create: `server/public/scripts/torn-foreign-stock.meta.js`
- Create: `server/torn-foreign-stock.test.js`

- [ ] **Step 1: Write the skeleton script**

```javascript
// ==UserScript==
// @name         Foreign Stock
// @namespace    RussianRob
// @version      0.1.0
// @description  Shows abroad item stock (and optional profit) inline on the Torn travel agency page
// @author       RussianRob
// @license      GPL-3.0-or-later
// @match        https://www.torn.com/page.php?sid=travel*
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @connect      yata.yt
// @connect      api.torn.com
// @run-at       document-idle
// @downloadURL  https://tornwar.com/scripts/torn-foreign-stock.user.js
// @updateURL    https://tornwar.com/scripts/torn-foreign-stock.user.js
// ==/UserScript==
(function () {
  "use strict";
  var SCRIPT_VERSION = "0.1.0";
  var YATA_URL = "https://yata.yt/api/v1/travel/export/";
  var TORN_ITEMS_URL = "https://api.torn.com/v2/torn?selections=items&key=";
  var STOCK_TTL = 300, PRICE_TTL = 21600, STALE_MIN = 30;

  // ─── pure helpers (unit-tested) ──────────────────────────

  // ─── GM / data layer ─────────────────────────────────────

  // ─── DOM: settings, injector, observer ───────────────────

  function main() {}

  if (typeof window !== "undefined" && typeof location !== "undefined" && /\/travelagency\.php/.test(location.pathname)) {
    main();
  }
  if (typeof module !== "undefined" && module.exports) {
    module.exports = {};
  }
})();
```

- [ ] **Step 2: Write the meta.js**

```javascript
// ==UserScript==
// @name         Foreign Stock
// @namespace    RussianRob
// @version      0.1.0
// @description  Shows abroad item stock (and optional profit) inline on the Torn travel agency page
// @author       RussianRob
// @license      GPL-3.0-or-later
// @match        https://www.torn.com/page.php?sid=travel*
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @connect      yata.yt
// @connect      api.torn.com
// @run-at       document-idle
// @downloadURL  https://tornwar.com/scripts/torn-foreign-stock.user.js
// @updateURL    https://tornwar.com/scripts/torn-foreign-stock.user.js
// ==/UserScript==
```

- [ ] **Step 3: Write the empty test file**

```javascript
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");

// Load the userscript as a CommonJS module via its guarded module.exports.
const mod = require("./public/scripts/torn-foreign-stock.user.js");

test("module loads and exports an object", () => {
  assert.strictEqual(typeof mod, "object");
});
```

- [ ] **Step 4: Verify syntax + that the test runs and loads the script under node**

Run: `cd /opt/warboard/server && node --check public/scripts/torn-foreign-stock.user.js && node --test torn-foreign-stock.test.js`
Expected: `node --check` silent; the test run reports `1 passing` (loading the file under node must NOT execute `main()` because `window` is undefined).

- [ ] **Step 5: Commit**

```bash
cd /opt/warboard && git add server/public/scripts/torn-foreign-stock.user.js server/public/scripts/torn-foreign-stock.meta.js server/torn-foreign-stock.test.js
git commit -m "foreign-stock 0.1.0: script skeleton + test harness

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Country mapping (TDD)

Maps an on-page destination name to a YATA country code.

**Files:**
- Modify: `server/public/scripts/torn-foreign-stock.user.js` (pure-helpers section + exports)
- Test: `server/torn-foreign-stock.test.js`

- [ ] **Step 1: Write the failing tests**

Add to `torn-foreign-stock.test.js`:

```javascript
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /opt/warboard/server && node --test torn-foreign-stock.test.js`
Expected: FAIL — `mod.normalizeCountryName is not a function`.

- [ ] **Step 3: Implement**

In the pure-helpers section:

```javascript
  var COUNTRY_MAP = {
    "mexico": "mex", "cayman islands": "cay", "canada": "can", "hawaii": "haw",
    "united kingdom": "uni", "uk": "uni", "argentina": "arg", "switzerland": "swi",
    "japan": "jap", "china": "chi", "uae": "uae", "united arab emirates": "uae",
    "south africa": "sou"
  };
  function normalizeCountryName(name) {
    if (!name) return null;
    var k = String(name).trim().toLowerCase().replace(/\s+/g, " ");
    return COUNTRY_MAP[k] || null;
  }
```

In the exports object:

```javascript
    module.exports = { normalizeCountryName: normalizeCountryName, COUNTRY_MAP: COUNTRY_MAP };
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /opt/warboard/server && node --test torn-foreign-stock.test.js`
Expected: PASS (all country tests green).

- [ ] **Step 5: Commit**

```bash
cd /opt/warboard && git add server/public/scripts/torn-foreign-stock.user.js server/torn-foreign-stock.test.js
git commit -m "foreign-stock: country-name to YATA-code mapping

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: YATA parsing + money/age formatting (TDD)

**Files:**
- Modify: `server/public/scripts/torn-foreign-stock.user.js`
- Test: `server/torn-foreign-stock.test.js`

- [ ] **Step 1: Write the failing tests**

```javascript
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
```

- [ ] **Step 2: Run to verify fail**

Run: `cd /opt/warboard/server && node --test torn-foreign-stock.test.js`
Expected: FAIL — functions undefined.

- [ ] **Step 3: Implement**

In the pure-helpers section:

```javascript
  function parseYataExport(json) {
    var out = {}, stocks = (json && json.stocks) || {};
    for (var code in stocks) {
      if (!Object.prototype.hasOwnProperty.call(stocks, code)) continue;
      var c = stocks[code] || {};
      var items = (c.stocks || []).map(function (it) {
        return { id: it.id, name: it.name, qty: it.quantity, cost: it.cost };
      });
      out[code] = { update: c.update || 0, items: items };
    }
    return out;
  }
  function fmtMoney(n) {
    if (n == null || isNaN(n)) return "—";
    return "$" + Math.round(n).toLocaleString("en-US");
  }
  function fmtProfit(n) {
    if (n == null || isNaN(n)) return "—";
    return (n < 0 ? "-$" : "+$") + Math.round(Math.abs(n)).toLocaleString("en-US");
  }
  function formatAge(updateSec, nowSecVal) {
    var diff = Math.max(0, Math.floor(nowSecVal - updateSec));
    var mins = Math.floor(diff / 60), text;
    if (diff < 60) text = "just now";
    else if (mins < 60) text = mins + "m ago";
    else text = Math.floor(mins / 60) + "h " + (mins % 60) + "m ago";
    return { text: text, stale: mins >= STALE_MIN };
  }
```

Extend the exports:

```javascript
    module.exports = {
      normalizeCountryName: normalizeCountryName, COUNTRY_MAP: COUNTRY_MAP,
      parseYataExport: parseYataExport, fmtMoney: fmtMoney, fmtProfit: fmtProfit, formatAge: formatAge
    };
```

- [ ] **Step 4: Run to verify pass**

Run: `cd /opt/warboard/server && node --test torn-foreign-stock.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd /opt/warboard && git add server/public/scripts/torn-foreign-stock.user.js server/torn-foreign-stock.test.js
git commit -m "foreign-stock: YATA parse + money/age formatting

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Row building + sorting + profit (TDD)

**Files:**
- Modify: `server/public/scripts/torn-foreign-stock.user.js`
- Test: `server/torn-foreign-stock.test.js`

- [ ] **Step 1: Write the failing tests**

```javascript
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
  assert.strictEqual(rows[2].profit, null); // id 3 not priced
});

test("sortRows stock: price desc, then qty desc, then name", () => {
  const rows = mod.sortRows(mod.buildRows(ITEMS, { mode: "stock" }), "stock");
  assert.deepStrictEqual(rows.map(function (r) { return r.id; }), [1, 3, 2]);
  // cost 830 first; then cost 452 tie -> qty tie (142) -> name "Aaa"(3) before "Plushie"(2)
});

test("sortRows profit: profit desc, nulls last", () => {
  const prices = { 1: 9200, 2: 850 };
  const rows = mod.sortRows(mod.buildRows(ITEMS, { mode: "profit", getValue: function (id) { return prices[id]; } }), "profit");
  assert.deepStrictEqual(rows.map(function (r) { return r.id; }), [1, 2, 3]);
});
```

- [ ] **Step 2: Run to verify fail**

Run: `cd /opt/warboard/server && node --test torn-foreign-stock.test.js`
Expected: FAIL — functions undefined.

- [ ] **Step 3: Implement**

```javascript
  function buildRows(items, opts) {
    opts = opts || {};
    var mode = opts.mode || "stock";
    var getValue = opts.getValue || function () { return undefined; };
    return items.map(function (it) {
      var value = (mode === "profit") ? getValue(it.id) : undefined;
      value = (value == null || isNaN(value)) ? null : value;
      var profit = (value == null) ? null : (value - it.cost);
      return { id: it.id, name: it.name, qty: it.qty, cost: it.cost, value: value, profit: profit };
    });
  }
  function sortRows(rows, mode) {
    var arr = rows.slice();
    arr.sort(function (a, b) {
      var pa, pb;
      if (mode === "profit") { pa = (a.profit == null ? -Infinity : a.profit); pb = (b.profit == null ? -Infinity : b.profit); }
      else { pa = a.cost; pb = b.cost; }
      if (pb !== pa) return pb - pa;
      if (b.qty !== a.qty) return b.qty - a.qty;
      return String(a.name).localeCompare(String(b.name));
    });
    return arr;
  }
```

Extend exports with `buildRows` and `sortRows`.

- [ ] **Step 4: Run to verify pass**

Run: `cd /opt/warboard/server && node --test torn-foreign-stock.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd /opt/warboard && git add server/public/scripts/torn-foreign-stock.user.js server/torn-foreign-stock.test.js
git commit -m "foreign-stock: row building, profit, sorting

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: GM storage + cached data layer (TDD with stubs)

`getStock`/`getPrices` with TTL caching, tested by stubbing `GM_getValue`/`GM_setValue` and the fetch helper.

**Files:**
- Modify: `server/public/scripts/torn-foreign-stock.user.js`
- Test: `server/torn-foreign-stock.test.js`

- [ ] **Step 1: Write the failing tests**

The data functions read injectable seams `__setFetch(fn)` (replaces the network call) and `__setClock(fn)` (replaces `nowSec`), and use module-level `GM_getValue`/`GM_setValue` which the test defines as globals before requiring the module is not possible (module already loaded) — so the script reads GM via `globalThis`. Tests:

```javascript
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
  await mod.getStock();            // within 300s -> cached
  assert.strictEqual(calls, 1);
  clock += 301;
  await mod.getStock();            // stale -> refetch
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
  assert.ok(out.mex);              // returns last good cache
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
```

- [ ] **Step 2: Run to verify fail**

Run: `cd /opt/warboard/server && node --test torn-foreign-stock.test.js`
Expected: FAIL — `mod.getStock`/`__setFetch` undefined.

- [ ] **Step 3: Implement the GM/data layer**

```javascript
  var _fetchJson = function (url) {
    return new Promise(function (resolve, reject) {
      GM_xmlhttpRequest({
        method: "GET", url: url, timeout: 15000,
        onload: function (r) { try { resolve(JSON.parse(r.responseText)); } catch (e) { reject(e); } },
        onerror: function () { reject(new Error("network")); },
        ontimeout: function () { reject(new Error("timeout")); }
      });
    });
  };
  var _nowSec = function () { return Math.floor(Date.now() / 1000); };
  function gmGet(key, def) { try { var v = (typeof GM_getValue === "function") ? GM_getValue(key, null) : null; return v == null ? def : JSON.parse(v); } catch (e) { return def; } }
  function gmSet(key, val) { try { if (typeof GM_setValue === "function") GM_setValue(key, JSON.stringify(val)); } catch (e) {} }

  function getStock(force) {
    var cached = gmGet("tfs_stock", null);
    if (!force && cached && (_nowSec() - cached.t) < STOCK_TTL) return Promise.resolve(cached.data);
    return _fetchJson(YATA_URL).then(function (json) {
      var data = parseYataExport(json);
      gmSet("tfs_stock", { t: _nowSec(), data: data });
      return data;
    }).catch(function () { return cached ? cached.data : null; });
  }
  function getPrices(key) {
    if (!key) return Promise.resolve({});
    var cached = gmGet("tfs_prices", null);
    if (cached && cached.key === key && (_nowSec() - cached.t) < PRICE_TTL) return Promise.resolve(cached.map);
    return _fetchJson(TORN_ITEMS_URL + encodeURIComponent(key)).then(function (json) {
      if (json && json.error) throw new Error((json.error && json.error.error) || "API error");
      var items = (json && json.items) || {};
      var list = Array.isArray(items) ? items : Object.keys(items).map(function (k) { var o = items[k] || {}; if (o.id == null) o.id = Number(k); return o; });
      var map = {};
      list.forEach(function (it) {
        var v = (it.value && it.value.market_price != null) ? it.value.market_price : (it.market_value != null ? it.market_value : it.marketValue);
        if (v != null) map[it.id] = v;
      });
      gmSet("tfs_prices", { t: _nowSec(), key: key, map: map });
      return map;
    });
  }
```

Add test seams + exports:

```javascript
    module.exports.getStock = getStock;
    module.exports.getPrices = getPrices;
    module.exports.__setFetch = function (fn) { _fetchJson = fn; };
    module.exports.__setClock = function (fn) { _nowSec = fn; };
```

- [ ] **Step 4: Run to verify pass**

Run: `cd /opt/warboard/server && node --test torn-foreign-stock.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd /opt/warboard && git add server/public/scripts/torn-foreign-stock.user.js server/torn-foreign-stock.test.js
git commit -m "foreign-stock: cached YATA + Torn-price data layer

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: Settings bar (DOM — verified by check + manual)

Injected once, sentinel-guarded; view toggle, Refresh, inline key field. Not unit-tested (DOM); verified via `node --check` and on-page.

**Files:**
- Modify: `server/public/scripts/torn-foreign-stock.user.js`

- [ ] **Step 1: Implement settings state + bar**

In the DOM section:

```javascript
  function getMode() { var m = gmGet("tfs_mode", "stock"); return (m === "profit") ? "profit" : "stock"; }
  function setMode(m) { gmSet("tfs_mode", m); }
  function getKey() { return gmGet("tfs_key", "") || ""; }
  function setKey(k) { gmSet("tfs_key", String(k || "").trim()); }

  function injectSettingsBar(onChange) {
    if (document.getElementById("tfs-bar")) return;
    var bar = document.createElement("div");
    bar.id = "tfs-bar";
    bar.className = "tfs-bar";
    var mode = getMode();
    bar.innerHTML =
      '<span class="tfs-title">Foreign Stock</span>' +
      '<button class="tfs-toggle" data-mode="stock">Stock</button>' +
      '<button class="tfs-toggle" data-mode="profit">Profit</button>' +
      '<button class="tfs-refresh" title="Refresh stock">↻</button>' +
      '<span class="tfs-keywrap" style="display:' + (mode === "profit" ? "inline-flex" : "none") + '">' +
      '<input class="tfs-key" type="password" placeholder="Torn API key for profit" value="' + getKey().replace(/"/g, "") + '">' +
      '<button class="tfs-save">Save</button></span>' +
      '<span class="tfs-msg"></span>';
    function paint() {
      var m = getMode();
      bar.querySelectorAll(".tfs-toggle").forEach(function (b) { b.classList.toggle("on", b.getAttribute("data-mode") === m); });
      bar.querySelector(".tfs-keywrap").style.display = (m === "profit") ? "inline-flex" : "none";
    }
    bar.querySelectorAll(".tfs-toggle").forEach(function (b) {
      b.addEventListener("click", function () { setMode(b.getAttribute("data-mode")); paint(); onChange(); });
    });
    bar.querySelector(".tfs-refresh").addEventListener("click", function () { onChange(true); });
    bar.querySelector(".tfs-save").addEventListener("click", function () {
      var v = bar.querySelector(".tfs-key").value.trim();
      if (!v) { tfsMsg("enter a key"); return; }
      setKey(v); tfsMsg("saved"); onChange(true);
    });
    paint();
    var anchor = document.querySelector(".content-title") || document.querySelector(".content") || document.body;
    anchor.insertBefore(bar, anchor.firstChild);
  }
  function tfsMsg(s) { var m = document.querySelector("#tfs-bar .tfs-msg"); if (m) m.textContent = s ? (" " + s) : ""; }
```

> Note: the `anchor` selector (`.content-title`/`.content`) is the page-top fallback; replace with the precise travel-page header captured in Task 1 if different.

- [ ] **Step 2: Syntax check**

Run: `cd /opt/warboard/server && node --check public/scripts/torn-foreign-stock.user.js`
Expected: silent.

- [ ] **Step 3: Confirm tests still pass (no regressions to pure logic)**

Run: `cd /opt/warboard/server && node --test torn-foreign-stock.test.js`
Expected: PASS (all previous tests still green; loading under node must still skip `main`).

- [ ] **Step 4: Commit**

```bash
cd /opt/warboard && git add server/public/scripts/torn-foreign-stock.user.js
git commit -m "foreign-stock: settings bar (mode toggle, key field, refresh)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: Injector + MutationObserver (DOM — built against Task 1)

**Files:**
- Modify: `server/public/scripts/torn-foreign-stock.user.js`

> Uses the destination selector/anchor recorded in Task 1. The implementation below uses a country-name text scan as a DOM-agnostic fallback so it works before the exact selector is confirmed; once Task 1's selector is known, set `DEST_SELECTOR` to it for precision.

- [ ] **Step 1: Implement destination discovery + panel render**

```javascript
  var DEST_SELECTOR = ""; // set from Task 1 capture; empty => text-scan fallback

  function findDestinations() {
    var out = [], seen = [];
    function consider(el) {
      var name = (el.getAttribute && el.getAttribute("data-country")) || textCountry(el);
      var code = normalizeCountryName(name);
      if (!code) return;
      if (seen.indexOf(el) !== -1) return;
      seen.push(el); out.push({ el: el, code: code });
    }
    if (DEST_SELECTOR) {
      document.querySelectorAll(DEST_SELECTOR).forEach(consider);
    } else {
      var nodes = document.querySelectorAll("li,div,tr,a");
      for (var i = 0; i < nodes.length; i++) {
        var t = (nodes[i].textContent || "").trim();
        if (t.length >= 3 && t.length <= 40 && normalizeCountryName(t)) consider(nodes[i]);
      }
    }
    return out;
  }
  function textCountry(el) {
    var t = (el.textContent || "").trim();
    return (t.length <= 40) ? t : "";
  }

  function renderPanel(destEl, code, stock, mode, prices) {
    var existing = destEl.querySelector(":scope > .tfs-panel");
    var country = stock[code];
    if (!country) return;
    var rows = sortRows(buildRows(country.items, { mode: mode, getValue: function (id) { return prices[id]; } }), mode);
    var age = formatAge(country.update, Math.floor(Date.now() / 1000));
    var html = '<div class="tfs-head"><span class="tfs-age' + (age.stale ? " stale" : "") + '">updated ' + age.text + '</span></div><div class="tfs-rows">';
    rows.forEach(function (r) {
      html += '<div class="tfs-row">' +
        '<span class="tfs-name">' + escapeHtml(r.name) + '</span>' +
        '<span class="tfs-qty">×' + r.qty + '</span>' +
        '<span class="tfs-cost">' + fmtMoney(r.cost) + '</span>' +
        (mode === "profit" ? '<span class="tfs-profit ' + (r.profit > 0 ? "pos" : "neg") + '">' + fmtProfit(r.profit) + ' ea</span>' : '') +
        '</div>';
    });
    html += '</div>';
    if (existing) { existing.innerHTML = html; }
    else { var p = document.createElement("div"); p.className = "tfs-panel"; p.innerHTML = html; destEl.appendChild(p); }
  }
  function escapeHtml(s) { return String(s).replace(/[&<>"]/g, function (c) { return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]; }); }
```

- [ ] **Step 2: Implement the orchestrator + observer**

```javascript
  var _stockCache = null, _priceCache = {}, _applyTimer = null;

  function applyAll(force) {
    var mode = getMode(), key = getKey();
    getStock(force).then(function (stock) {
      _stockCache = stock;
      if (!stock) { tfsMsg("stock unavailable"); return; }
      if (mode === "profit" && key) {
        return getPrices(key).then(function (m) { _priceCache = m; tfsMsg(""); paintPanels(stock, "profit", m); })
          .catch(function (e) { tfsMsg("key error"); paintPanels(stock, "stock", {}); });
      }
      if (mode === "profit" && !key) tfsMsg("add a key for profit");
      paintPanels(stock, "stock", {});
    });
  }
  function paintPanels(stock, mode, prices) {
    findDestinations().forEach(function (d) { renderPanel(d.el, d.code, stock, mode, prices); });
  }
  function scheduleApply() {
    if (_applyTimer) clearTimeout(_applyTimer);
    _applyTimer = setTimeout(function () { applyAll(false); }, 200);
  }
  function startObserver() {
    var root = (DEST_SELECTOR && document.querySelector(DEST_SELECTOR) && document.querySelector(DEST_SELECTOR).parentElement) || document.querySelector(".content") || document.body;
    var obs = new MutationObserver(scheduleApply);
    obs.observe(root, { childList: true, subtree: true });
  }
```

- [ ] **Step 3: Syntax check + tests**

Run: `cd /opt/warboard/server && node --check public/scripts/torn-foreign-stock.user.js && node --test torn-foreign-stock.test.js`
Expected: silent check; PASS tests.

- [ ] **Step 4: Commit**

```bash
cd /opt/warboard && git add server/public/scripts/torn-foreign-stock.user.js
git commit -m "foreign-stock: destination injector + scoped debounced observer

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 9: Styling

**Files:**
- Modify: `server/public/scripts/torn-foreign-stock.user.js`

- [ ] **Step 1: Implement CSS injection**

```javascript
  function injectCss() {
    if (document.getElementById("tfs-css")) return;
    var s = document.createElement("style");
    s.id = "tfs-css";
    s.textContent =
      ".tfs-bar{display:flex;align-items:center;gap:6px;flex-wrap:wrap;padding:6px 8px;margin:6px 0;background:#1a1a1a;border:1px solid #333;border-radius:4px;font-size:12px;color:#ccc;}" +
      ".tfs-bar .tfs-title{font-weight:700;color:#e8c44a;margin-right:4px;}" +
      ".tfs-toggle{background:#2a2a2a;color:#bbb;border:1px solid #444;border-radius:3px;padding:2px 8px;cursor:pointer;}" +
      ".tfs-toggle.on{background:#2a3fff;color:#fff;border-color:#2a3fff;}" +
      ".tfs-refresh{background:#2a2a2a;color:#bbb;border:1px solid #444;border-radius:3px;padding:2px 7px;cursor:pointer;}" +
      ".tfs-key{background:#111;border:1px solid #444;color:#ddd;border-radius:3px;padding:2px 6px;width:150px;}" +
      ".tfs-save{background:#2a2a2a;color:#bbb;border:1px solid #444;border-radius:3px;padding:2px 8px;cursor:pointer;}" +
      ".tfs-msg{color:#e88;}" +
      ".tfs-panel{margin:4px 0 8px;font-size:12px;}" +
      ".tfs-head .tfs-age{color:#888;}.tfs-head .tfs-age.stale{opacity:.5;}" +
      ".tfs-row{display:flex;gap:8px;padding:1px 0;align-items:baseline;}" +
      ".tfs-name{flex:1;min-width:0;color:#ddd;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}" +
      ".tfs-qty{color:#888;}.tfs-cost{color:#bbb;min-width:60px;text-align:right;}" +
      ".tfs-profit{min-width:80px;text-align:right;}.tfs-profit.pos{color:#5ad15a;}.tfs-profit.neg{color:#777;}";
    document.head.appendChild(s);
  }
```

- [ ] **Step 2: Syntax check**

Run: `cd /opt/warboard/server && node --check public/scripts/torn-foreign-stock.user.js`
Expected: silent.

- [ ] **Step 3: Commit**

```bash
cd /opt/warboard && git add server/public/scripts/torn-foreign-stock.user.js
git commit -m "foreign-stock: panel + settings-bar styling

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 10: Wire main(), deploy, verify on the live page

**Files:**
- Modify: `server/public/scripts/torn-foreign-stock.user.js`

- [ ] **Step 1: Implement main()**

```javascript
  function main() {
    injectCss();
    injectSettingsBar(function (force) { applyAll(!!force); });
    applyAll(false);
    startObserver();
    try { if (typeof GM_registerMenuCommand === "function") GM_registerMenuCommand("Foreign Stock: refresh", function () { applyAll(true); }); } catch (e) {}
  }
```

- [ ] **Step 2: Syntax check + full test run**

Run: `cd /opt/warboard/server && node --check public/scripts/torn-foreign-stock.user.js && node --test torn-foreign-stock.test.js`
Expected: silent check; all tests PASS.

- [ ] **Step 3: Confirm served**

Run: `curl -s http://127.0.0.1:3000/scripts/torn-foreign-stock.user.js | grep -m1 "@version"`
Expected: `// @version      0.1.0`

- [ ] **Step 4: User installs + verifies on the live travel page**

Ask the user to install `https://tornwar.com/scripts/torn-foreign-stock.user.js`, open `page.php?sid=travel`, and confirm:
- A "Foreign Stock" bar appears at the top with Stock/Profit toggles + Refresh.
- Each destination shows a stock panel (`item ×qty $price`) with an "updated Xm ago" header.
- Switching to Profit with a valid key adds `→ +$X ea` and re-sorts by profit; with no key it shows the "add a key" hint and stays on stock rows; with a bad key it shows "key error" and falls back.
Collect a screenshot; fix any DOM-anchor mismatches by setting `DEST_SELECTOR`/`anchor` from the real page (re-using Task 1's capture).

- [ ] **Step 5: Commit + push**

```bash
cd /opt/warboard && git add server/public/scripts/torn-foreign-stock.user.js
git commit -m "foreign-stock: wire main(), live-page verified

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
git push origin HEAD:main
```

---

## Task 11: Remove the diag + Greasy Fork distribution

**Files:**
- Delete: `server/public/scripts/foreign-stock-diag.user.js`
- Modify: `server/public/scripts/torn-foreign-stock.user.js` + `.meta.js` (`@downloadURL`/`@updateURL` → Greasy Fork once the GF id exists)

- [ ] **Step 1: Tell the user to uninstall the diag; delete the served file**

```bash
cd /opt/warboard && git rm server/public/scripts/foreign-stock-diag.user.js
git commit -m "foreign-stock: remove DOM-discovery diag

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

- [ ] **Step 2: Create the Greasy Fork script, then repoint update URLs**

After the user creates the GF entry (or asks you to prep it), set `@downloadURL`/`@updateURL` in both `.user.js` and `.meta.js` to `https://update.greasyfork.org/scripts/<id>/Foreign%20Stock.user.js` / `.meta.js`, bump to `1.0.0` (`@version` + `SCRIPT_VERSION` + `.meta.js`), `node --check`, confirm served, commit + push. Set GF "Sync from URL" to `https://tornwar.com/scripts/torn-foreign-stock.user.js`.

- [ ] **Step 3: Save a memory note**

Record the new script (purpose, YATA source, optional-key profit, travelagency-only) under the warboard scripts memory so future sessions know it exists.

---

## Self-Review

**Spec coverage:** Stock view (Tasks 4–5, 8–9) ✓; profit view + optional key (Tasks 5–6, 7, 8, 10) ✓; YATA source + 300s cache (Task 6) ✓; Torn v2 prices + 6h cache + field fallback (Task 6) ✓; country mapping incl. variants (Task 3) ✓; id-based join + miss→`—` (Tasks 5, 8) ✓; settings bar injected once + scoped/debounced observer no-loop contract (Tasks 7–8) ✓; sort primary+secondary, re-sort on toggle (Tasks 5, 8) ✓; per-country age stamp + 30-min stale styling on the stamp only (Tasks 4, 8–9) ✓; failure modes: YATA down / no-key / invalid-key (Tasks 6, 8, 10) ✓; DOM diag as dev-only first step, shipped script tornwar-free (Tasks 1, 11) ✓; packaging/standing rules (Task 2) ✓; manual verification (Task 10) ✓.

**Placeholder scan:** No "TBD/handle-later". The two "set from Task 1 capture" notes (settings anchor, `DEST_SELECTOR`) are deliberate: each has a working text-scan/`.content` fallback so the script runs before the exact selector is confirmed, then is tightened — not an empty placeholder.

**Type consistency:** Item shape `{id,name,qty,cost}` (Task 4) is consumed unchanged by `buildRows` (Task 5) and `renderPanel` (Task 8). `buildRows` row shape `{id,name,qty,cost,value,profit}` matches `sortRows`/`renderPanel` usage. `getValue(id)`/`getPrices` keyed by id throughout. `getMode()` returns `"stock"|"profit"` consistently. `onChange(force)` callback signature matches `applyAll(force)`. `formatAge(updateSec, nowSec)` argument order consistent between test and call site.
