# Foreign-Stock Restock Tracker — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A 24/7 server poller learns each foreign item's restock cadence from Prombot and publishes a `restock-model.json` to a public GitHub repo; the Torn Foreign Stocks userscript (0.2.2 → 0.3.0) reads that model to show always-on restock estimates (`~every 25m · ~8m (low)`) for out-of-stock items Prombot has no live prediction for.

**Architecture:** Server module `restock-tracker.js` (ESM) polls Prombot every 60 s, records "qty increased = restock" events per item, computes `{interval (median gap), last, n, rel}`, persists to `server/data/restock-state.json`, and every 10 min publishes the model to `russianrob/torn-foreign-restock` via `gh api`. The script adds a cached GitHub-model fetch and merges it into the out-of-stock display below Prombot's live prediction.

**Tech Stack:** Node 20 ESM (`fetch`, `child_process.execFile`, `node:fs`), `gh` CLI (russianrob auth), `node --test`. Userscript: ES5 + Promises, unit-tested via the existing `new Function` loader in `server/torn-foreign-stock.test.js`.

**Reference:** spec `docs/superpowers/specs/2026-06-09-foreign-stock-restock-tracker-design.md`.

**Conventions:** commit trailer `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`; userscript: GPL-3.0-or-later, no descriptive comments/changelog, `@version`+`SCRIPT_VERSION` synced, served from `server/public/scripts/`, GF id 581933; server `.js` changes need `pm2 reload warboard`. **When 0.3.0 ships, give the user the update link** (`https://tornwar.com/scripts/torn-foreign-stock.user.js` + GF `581933`).

---

## File Structure

- **Create** `server/restock-tracker.js` — ESM. Pure helpers (`median`, `coeffVar`, `reliabilityTier`, `gaps`, `recordSample`, `computeEntry`, `buildModel`) + impure runtime (`loadState`/`saveState`, `pollOnce`, `publishModel`, `startRestockTracker`). Exports the pure helpers + `startRestockTracker`. Importing it must NOT start any timers.
- **Create** `server/restock-tracker.test.js` — `node --test` for the pure helpers.
- **Modify** `server/server.js` — import + call `startRestockTracker()` next to `startRwpRefresh()`.
- **Modify** `server/public/scripts/torn-foreign-stock.user.js` + `.meta.js` — model fetch + merge display, `@connect raw.githubusercontent.com`, 0.3.0.
- **Modify** `server/torn-foreign-stock.test.js` — tests for `getModel`, `fmtDuration`, `modelEstimate`, `restockDisplay`.
- **GitHub** `russianrob/torn-foreign-restock` (public) — holds `restock-model.json` (created in Task 1).
- **Runtime** `server/data/restock-state.json` — gitignored, created at runtime.

---

## Task 1: Create the GitHub model repo

**Files:** none (operational `gh` commands).

- [ ] **Step 1: Create the public repo**

Run: `gh repo create russianrob/torn-foreign-restock --public -d "Torn foreign-stock restock model (auto-updated by warboard)"`
Expected: prints the new repo URL.

- [ ] **Step 2: Seed the model file (also creates the main branch)**

```bash
printf '{"updated":0,"items":{}}' > /tmp/seed-model.json
gh api --method PUT /repos/russianrob/torn-foreign-restock/contents/restock-model.json \
  -f message="seed restock model" \
  -f content="$(base64 -w0 /tmp/seed-model.json)"
```
Expected: JSON response with `"content"` + a commit. 

- [ ] **Step 3: Verify the raw URL serves it (keyless)**

Run: `curl -s https://raw.githubusercontent.com/russianrob/torn-foreign-restock/main/restock-model.json`
Expected: `{"updated":0,"items":{}}` (may take ~30 s for raw CDN to populate; retry if 404).

No commit (this task only creates remote state).

---

## Task 2: Stats helpers (TDD)

**Files:**
- Create: `server/restock-tracker.js`
- Create: `server/restock-tracker.test.js`

- [ ] **Step 1: Write the failing test**

Create `server/restock-tracker.test.js`:

```javascript
import test from "node:test";
import assert from "node:assert";
import { median, coeffVar, reliabilityTier } from "./restock-tracker.js";

test("median", () => {
  assert.strictEqual(median([5]), 5);
  assert.strictEqual(median([3, 1, 2]), 2);
  assert.strictEqual(median([4, 1, 3, 2]), 2.5);
  assert.strictEqual(median([]), 0);
});

test("coeffVar", () => {
  assert.strictEqual(coeffVar([10]), 0);
  assert.strictEqual(coeffVar([10, 10, 10]), 0);
  assert.ok(coeffVar([10, 20, 30]) > 0);
});

test("reliabilityTier", () => {
  assert.strictEqual(reliabilityTier(8, 0.2), "high");
  assert.strictEqual(reliabilityTier(8, 0.5), "med");
  assert.strictEqual(reliabilityTier(4, 0.5), "med");
  assert.strictEqual(reliabilityTier(2, 0.0), "low");
  assert.strictEqual(reliabilityTier(10, 0.9), "low");
});
```

- [ ] **Step 2: Run, verify FAIL**

Run: `cd /opt/warboard/server && node --test restock-tracker.test.js`
Expected: FAIL — cannot import (module/functions don't exist).

- [ ] **Step 3: Implement `server/restock-tracker.js`**

```javascript
export function median(nums) {
  if (!nums.length) return 0;
  const a = nums.slice().sort((x, y) => x - y);
  const m = Math.floor(a.length / 2);
  return (a.length % 2) ? a[m] : (a[m - 1] + a[m]) / 2;
}

export function coeffVar(nums) {
  if (nums.length < 2) return 0;
  const mean = nums.reduce((s, x) => s + x, 0) / nums.length;
  if (mean === 0) return 0;
  const variance = nums.reduce((s, x) => s + (x - mean) * (x - mean), 0) / nums.length;
  return Math.sqrt(variance) / mean;
}

export function reliabilityTier(n, cv) {
  if (n >= 8 && cv < 0.3) return "high";
  if (n >= 4 && cv < 0.6) return "med";
  return "low";
}
```

- [ ] **Step 4: Run, verify PASS**

Run: `cd /opt/warboard/server && node --test restock-tracker.test.js`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
cd /opt/warboard && git add server/restock-tracker.js server/restock-tracker.test.js
git commit -m "restock-tracker: stats helpers (median, coeffVar, reliabilityTier)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Restock detection + model build (TDD)

**Files:**
- Modify: `server/restock-tracker.js`
- Modify: `server/restock-tracker.test.js`

- [ ] **Step 1: Write the failing tests** (append)

```javascript
import { gaps, recordSample, computeEntry, buildModel } from "./restock-tracker.js";

test("recordSample records a restock only when qty increases", () => {
  let it = { qty: null, restocks: [] };
  it = recordSample(it, 5, 100);          // first observation, no prior qty
  assert.deepStrictEqual(it, { qty: 5, restocks: [] });
  it = recordSample(it, 3, 160);          // depleted, no restock
  assert.deepStrictEqual(it.restocks, []);
  it = recordSample(it, 9, 220);          // increased -> restock at 220
  assert.deepStrictEqual(it.restocks, [220]);
  it = recordSample(it, 9, 280);          // unchanged
  assert.deepStrictEqual(it.restocks, [220]);
});

test("recordSample caps the restock history at 24", () => {
  let it = { qty: 0, restocks: [] };
  for (let i = 1; i <= 30; i++) it = recordSample({ qty: 0, restocks: it.restocks }, i, 100 + i);
  assert.strictEqual(it.restocks.length, 24);
});

test("computeEntry needs >=2 restocks and yields median interval", () => {
  assert.strictEqual(computeEntry([100]), null);
  const e = computeEntry([100, 200, 280]); // gaps 100, 80 -> median 90
  assert.strictEqual(e.interval, 90);
  assert.strictEqual(e.last, 280);
  assert.strictEqual(e.n, 3);
  assert.strictEqual(e.rel, "low");
});

test("buildModel keeps only items with >=2 restocks", () => {
  const state = {
    mex: { "1": { qty: 0, restocks: [100, 200] }, "2": { qty: 0, restocks: [100] } }
  };
  const model = buildModel(state, 999);
  assert.strictEqual(model.updated, 999);
  assert.ok(model.items.mex["1"]);
  assert.strictEqual(model.items.mex["2"], undefined);
});
```

- [ ] **Step 2: Run, verify FAIL**

Run: `cd /opt/warboard/server && node --test restock-tracker.test.js`
Expected: FAIL — new functions undefined.

- [ ] **Step 3: Implement** (append to `server/restock-tracker.js`)

```javascript
export function gaps(restocks) {
  const g = [];
  for (let i = 1; i < restocks.length; i++) g.push(restocks[i] - restocks[i - 1]);
  return g;
}

export function recordSample(item, curQty, nowSec) {
  let restocks = (item && item.restocks) ? item.restocks.slice() : [];
  if (item && item.qty != null && curQty > item.qty) {
    restocks.push(nowSec);
    if (restocks.length > 24) restocks = restocks.slice(restocks.length - 24);
  }
  return { qty: curQty, restocks: restocks };
}

export function computeEntry(restocks) {
  if (!restocks || restocks.length < 2) return null;
  const g = gaps(restocks);
  return {
    interval: Math.round(median(g)),
    last: restocks[restocks.length - 1],
    n: restocks.length,
    rel: reliabilityTier(restocks.length, coeffVar(g))
  };
}

export function buildModel(state, nowSec) {
  const items = {};
  for (const c in state) {
    for (const id in state[c]) {
      const e = computeEntry(state[c][id].restocks || []);
      if (e) { if (!items[c]) items[c] = {}; items[c][id] = e; }
    }
  }
  return { updated: nowSec, items: items };
}
```

- [ ] **Step 4: Run, verify PASS**

Run: `cd /opt/warboard/server && node --test restock-tracker.test.js`
Expected: PASS (7 tests total).

- [ ] **Step 5: Commit**

```bash
cd /opt/warboard && git add server/restock-tracker.js server/restock-tracker.test.js
git commit -m "restock-tracker: restock detection, interval/reliability, model build

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Runtime — poll, persist, publish, wire

**Files:**
- Modify: `server/restock-tracker.js`
- Modify: `server/server.js`

- [ ] **Step 1: Implement the runtime** (append to `server/restock-tracker.js`)

```javascript
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const STATE_FILE = join(__dirname, "data", "restock-state.json");
const PROMBOT_URL = "https://api.prombot.co.uk/api/travel";
const REPO = "russianrob/torn-foreign-restock";
const MODEL_PATH = "restock-model.json";

let _state = {};

function loadState() {
  try { if (existsSync(STATE_FILE)) _state = JSON.parse(readFileSync(STATE_FILE, "utf-8")) || {}; }
  catch (e) { _state = {}; }
}
function saveState() {
  try { mkdirSync(dirname(STATE_FILE), { recursive: true }); writeFileSync(STATE_FILE, JSON.stringify(_state)); }
  catch (e) { console.error("[restock] saveState failed:", e.message); }
}

async function pollOnce() {
  let json;
  try { const r = await fetch(PROMBOT_URL); json = await r.json(); }
  catch (e) { console.error("[restock] poll failed:", e.message); return; }
  const stocks = (json && json.stocks) || {};
  const now = Math.floor(Date.now() / 1000);
  for (const c in stocks) {
    if (!_state[c]) _state[c] = {};
    for (const it of (stocks[c].stocks || [])) {
      const id = String(it.id);
      _state[c][id] = recordSample(_state[c][id], it.quantity, now);
    }
  }
  saveState();
}

function ghCurrentSha() {
  return new Promise((resolve) => {
    execFile("gh", ["api", `/repos/${REPO}/contents/${MODEL_PATH}`, "--jq", ".sha"],
      (e, out) => resolve(e ? "" : String(out).trim()));
  });
}
async function publishModel() {
  const now = Math.floor(Date.now() / 1000);
  const model = buildModel(_state, now);
  const content = Buffer.from(JSON.stringify(model)).toString("base64");
  const sha = await ghCurrentSha();
  const args = ["api", "--method", "PUT", `/repos/${REPO}/contents/${MODEL_PATH}`,
    "-f", `message=update restock model (${new Date(now * 1000).toISOString().slice(0, 16)}Z)`,
    "-f", `content=${content}`];
  if (sha) args.push("-f", `sha=${sha}`);
  await new Promise((resolve) => {
    execFile("gh", args, (e) => { if (e) console.error("[restock] publish failed:", e.message); resolve(); });
  });
}

export function startRestockTracker() {
  loadState();
  pollOnce().catch(() => {});
  setInterval(() => { pollOnce().catch(() => {}); }, 60_000);
  setInterval(() => { publishModel().catch(() => {}); }, 600_000);
  console.log("[restock] tracker started (poll 60s, publish 10m)");
}
```

- [ ] **Step 2: Verify the module still imports cleanly and tests pass (no timers started on import)**

Run: `cd /opt/warboard/server && node --check restock-tracker.js && node --test restock-tracker.test.js`
Expected: `node --check` silent; 7 tests pass. (Importing must not poll/publish — only `startRestockTracker()` does.)

- [ ] **Step 3: Wire into `server.js`**

After the line `import { startRwpRefresh } from "./rwp-refresh.js";` (server.js:38) add:

```javascript
import { startRestockTracker } from "./restock-tracker.js";
```

After the line `startRwpRefresh();` (server.js:581) add:

```javascript
startRestockTracker();
```

- [ ] **Step 4: Reload + verify the poller runs and writes state**

```bash
pm2 reload warboard
sleep 8
grep -m1 "restock] tracker started" /var/log/warboard/warboard-out.log
ls -l /opt/warboard/server/data/restock-state.json
```
Expected: the "tracker started" log line; the state file exists (created on the first poll). Then force a publish to confirm gh works:

```bash
node -e 'import("/opt/warboard/server/restock-tracker.js")' 2>/dev/null  # (no-op import sanity)
curl -s https://raw.githubusercontent.com/russianrob/torn-foreign-restock/main/restock-model.json | head -c 120
```
Expected: the seed (or, after the first 10-min publish, a populated model). Note: the model only fills as restocks are observed (warm-up).

- [ ] **Step 5: Commit**

```bash
cd /opt/warboard && git add server/restock-tracker.js server/server.js
git commit -m "restock-tracker: Prombot poll + state persistence + gh publish + wire into server

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Script — cached GitHub model fetch (TDD)

**Files:**
- Modify: `server/public/scripts/torn-foreign-stock.user.js`
- Modify: `server/torn-foreign-stock.test.js`

- [ ] **Step 1: Write the failing test** (append to `server/torn-foreign-stock.test.js`)

```javascript
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
  await mod.getModel();           // cached within TTL
  assert.strictEqual(calls, 1);
  clock += 601;
  await mod.getModel();           // stale -> refetch
  assert.strictEqual(calls, 2);
});
```

- [ ] **Step 2: Run, verify FAIL**

Run: `cd /opt/warboard/server && node --test torn-foreign-stock.test.js`
Expected: FAIL — `mod.getModel` undefined.

- [ ] **Step 3: Implement** in `torn-foreign-stock.user.js`. Near the top constants (after `TORN_ITEMS_URL`) add:

```javascript
  var MODEL_URL = "https://raw.githubusercontent.com/russianrob/torn-foreign-restock/main/restock-model.json";
  var MODEL_TTL = 600;
```

In the GM/data-layer section (after `getPrices`) add:

```javascript
  function getModel() {
    var cached = gmGet("tfs_model", null);
    if (cached && (_nowSec() - cached.t) < MODEL_TTL) return Promise.resolve(cached.data);
    return _fetchJson(MODEL_URL).then(function (json) {
      var data = (json && json.items) ? json.items : {};
      gmSet("tfs_model", { t: _nowSec(), data: data });
      return data;
    }).catch(function () { return cached ? cached.data : {}; });
  }
```

Add to the exports block: `module.exports.getModel = getModel;`

Add `// @connect      raw.githubusercontent.com` to the metadata block (after the `api.prombot.co.uk` line) in BOTH `torn-foreign-stock.user.js` and `torn-foreign-stock.meta.js`.

- [ ] **Step 4: Run, verify PASS**

Run: `cd /opt/warboard/server && node --check public/scripts/torn-foreign-stock.user.js && node --test torn-foreign-stock.test.js`
Expected: silent check; all tests pass (prior 20 + new 1 = 21).

- [ ] **Step 5: Commit**

```bash
cd /opt/warboard && git add server/public/scripts/torn-foreign-stock.user.js server/public/scripts/torn-foreign-stock.meta.js server/torn-foreign-stock.test.js
git commit -m "foreign-stock: cached GitHub restock-model fetch

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Script — estimate + merge display (TDD)

**Files:**
- Modify: `server/public/scripts/torn-foreign-stock.user.js`
- Modify: `server/torn-foreign-stock.test.js`

- [ ] **Step 1: Write the failing tests** (append)

```javascript
test("fmtDuration", () => {
  assert.strictEqual(mod.fmtDuration(1500), "25m");
  assert.strictEqual(mod.fmtDuration(3900), "1h 5m");
});

test("modelEstimate builds '~every X · ~Y (rel)' and 'due' when past", () => {
  const now = Date.parse("2026-06-09T16:00:00.000Z");
  const lastSec = Math.floor(now / 1000) - 600; // restocked 10m ago
  const e = mod.modelEstimate({ interval: 1500, last: lastSec, n: 5, rel: "med" }, now); // next in ~15m
  assert.strictEqual(e, "~every 25m · ~15m (med)");
  const past = mod.modelEstimate({ interval: 300, last: Math.floor(now / 1000) - 600, n: 5, rel: "low" }, now);
  assert.strictEqual(past, "~every 5m · due (low)");
});

test("restockDisplay merge priority", () => {
  const now = Date.parse("2026-06-09T16:00:00.000Z");
  const entry = { interval: 1500, last: Math.floor(now / 1000) - 600, n: 5, rel: "med" };
  // 1. Prombot future wins
  assert.strictEqual(mod.restockDisplay("2026-06-09T16:09:00.000Z", entry, now), "restocks in 9m");
  // 2. else model estimate
  assert.strictEqual(mod.restockDisplay(null, entry, now), "~every 25m · ~15m (med)");
  // 3. else Prombot recent-past -> restock due
  assert.strictEqual(mod.restockDisplay("2026-06-09T15:40:00.000Z", null, now), "restock due");
  // 4. else out of stock
  assert.strictEqual(mod.restockDisplay(null, null, now), "out of stock");
});
```

- [ ] **Step 2: Run, verify FAIL**

Run: `cd /opt/warboard/server && node --test torn-foreign-stock.test.js`
Expected: FAIL — functions undefined.

- [ ] **Step 3: Implement** in the pure-helpers section of `torn-foreign-stock.user.js`:

```javascript
  function fmtDuration(sec) {
    var m = Math.round(sec / 60);
    return (m < 60) ? (m + "m") : (Math.floor(m / 60) + "h " + (m % 60) + "m");
  }
  function modelEstimate(entry, nowMs) {
    if (!entry || !entry.interval) return null;
    var leftSec = (entry.last + entry.interval) - Math.floor(nowMs / 1000);
    var left = (leftSec > 0) ? ("~" + fmtDuration(leftSec)) : "due";
    return "~every " + fmtDuration(entry.interval) + " · " + left + " (" + (entry.rel || "low") + ")";
  }
  function restockDisplay(nextRestock, entry, nowMs) {
    var live = restockEta(nextRestock, nowMs);
    if (live && !live.due) return "restocks in " + live.text;
    var est = modelEstimate(entry, nowMs);
    if (est) return est;
    if (live && live.due) return "restock due";
    return "out of stock";
  }
```

Add `fmtDuration`, `modelEstimate`, `restockDisplay` to the exports block.

- [ ] **Step 4: Run, verify PASS**

Run: `cd /opt/warboard/server && node --check public/scripts/torn-foreign-stock.user.js && node --test torn-foreign-stock.test.js`
Expected: silent check; all pass (prior 21 + new 3 = 24).

- [ ] **Step 5: Commit**

```bash
cd /opt/warboard && git add server/public/scripts/torn-foreign-stock.user.js server/torn-foreign-stock.test.js
git commit -m "foreign-stock: model estimate + restock merge display logic

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: Script — wire model into render, 0.3.0, deploy, verify

**Files:**
- Modify: `server/public/scripts/torn-foreign-stock.user.js` + `.meta.js`

- [ ] **Step 1: Thread the model through render.** In `applyAll`, fetch the model alongside stock and pass it to `paintPanels`. Replace the body of `applyAll` with:

```javascript
  function applyAll(force) {
    var mode = getMode(), key = getKey();
    Promise.all([getStock(force), getModel()]).then(function (res) {
      var stock = res[0], model = res[1] || {};
      if (!stock) { tfsMsg("stock unavailable"); return; }
      if (mode === "profit" && key) {
        return getPrices(key).then(function (m) { tfsMsg(""); paintPanels(stock, "profit", m, model); })
          .catch(function () { tfsMsg("key error"); paintPanels(stock, "stock", {}, model); });
      }
      if (mode === "profit" && !key) tfsMsg("add a key for profit");
      paintPanels(stock, "stock", {}, model);
    });
  }
```

- [ ] **Step 2: Pass model to renderPanel.** Replace `paintPanels` with:

```javascript
  function paintPanels(stock, mode, prices, model) {
    var dests = findDestinations();
    for (var i = 0; i < dests.length; i++) renderPanel(dests[i].el, dests[i].code, stock, mode, prices, model || {});
  }
```

- [ ] **Step 3: Use the merge in renderPanel.** Change the `renderPanel` signature to accept `model`, and replace the out-of-stock branch. The function header becomes `function renderPanel(destEl, code, stock, mode, prices, model) {`. The out-of-stock branch (currently building `tfs-oos` via `restockEta`) becomes:

```javascript
      if (r.qty === 0) {
        var entry = (model && model[code]) ? model[code][String(r.id)] : null;
        html += '<div class="tfs-row out"><span class="tfs-name">' + escapeHtml(r.name) + '</span>' +
          '<span class="tfs-oos">' + restockDisplay(r.nextRestock, entry, nowMs) + '</span></div>';
      } else {
```

(Leave the in-stock `else` branch unchanged.)

- [ ] **Step 4: Bump to 0.3.0.** In `torn-foreign-stock.user.js`: `// @version      0.2.2` → `// @version      0.3.0` and `var SCRIPT_VERSION = "0.2.2";` → `"0.3.0"`. In `torn-foreign-stock.meta.js`: `// @version      0.2.2` → `0.3.0`.

- [ ] **Step 5: Verify syntax + all tests + served**

```bash
cd /opt/warboard/server && node --check public/scripts/torn-foreign-stock.user.js && node --test torn-foreign-stock.test.js
curl -s http://127.0.0.1:3000/scripts/torn-foreign-stock.user.js | grep -E "@version|raw.githubusercontent"
```
Expected: silent check; 24 tests pass; served shows `@version 0.3.0` + the `@connect raw.githubusercontent.com`.

- [ ] **Step 6: Commit + push**

```bash
cd /opt/warboard && git add server/public/scripts/torn-foreign-stock.user.js server/public/scripts/torn-foreign-stock.meta.js
git commit -m "torn-foreign-stocks 0.3.0: always-on restock estimate from GitHub model

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
git push origin HEAD:main
```

- [ ] **Step 7: Give the user the update link + live-verify**

Tell the user to update from `https://tornwar.com/scripts/torn-foreign-stock.user.js` (GF 581933 will sync) and load `page.php?sid=travel`. Expected once the tracker has warmed up: out-of-stock items with no live Prombot prediction show `~every 25m · ~8m (low)`; live ones still show "restocks in Xm". Note the warm-up — estimates fill in over hours as restocks are observed.

---

## Self-Review

**Spec coverage:** server poller + 60 s poll (Task 4) ✓; restock detection "qty increase" (Task 3) ✓; interval median + last + n + reliability from n/CV (Tasks 2–3) ✓; state persistence to `server/data/restock-state.json` (Task 4) ✓; publish 10 min via `gh api` to `russianrob/torn-foreign-restock` (Tasks 1, 4) ✓; `startRestockTracker()` wired like `startRwpRefresh()` (Task 4) ✓; script cached model fetch + `@connect raw.githubusercontent.com` (Task 5) ✓; merge priority live > model > recent-past-due > out-of-stock (Task 6) ✓; display `~every X · ~Y (rel)` (Task 6) ✓; render wiring + 0.3.0 + deploy + update link (Task 7) ✓; warm-up surfaced to user (Task 7) ✓; unit tests via node --test / new-Function loader ✓.

**Placeholder scan:** No TBD/TODO. Every code step has complete code; every command has expected output. (Task 4 Step 4's `node -e import` is an explicit sanity no-op, not a placeholder.)

**Type consistency:** model entry shape `{interval, last, n, rel}` is identical in `computeEntry`/`buildModel` (server), the `getModel` test, `modelEstimate`/`restockDisplay` (script), and `renderPanel`'s lookup `model[code][String(id)]`. `recordSample(item, curQty, nowSec)` ↔ `pollOnce` call site match. `restockEta` return `{text, due}` (from 0.2.2) is consumed correctly by `restockDisplay`. `paintPanels(stock, mode, prices, model)` / `renderPanel(destEl, code, stock, mode, prices, model)` signatures match their call sites in `applyAll`/`paintPanels`. Model keyed by country code then `String(id)` consistently (build + lookup).
