# Crimehub-backed OC features — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Per the standing flow, Codex implements each task and Claude verifies the diff.

**Goal:** Add three comparison columns to `oc-spawn-assistance`'s Outcome-EV table — **Yours %** (your faction's observed whole-crime success), **Local %** (a locally-computed flowchart success prediction, co-primary beside the tornprobability number), and **Community %** (Crimehub's community success, derived via the same flowchart) — so warboard cross-checks its OC numbers and is resilient to the tornprobability VPS.

**Architecture:** Server-centric, in warboard's OC subsystem (`/opt/warboard/server`). Three small modules: faction odds extend the existing `oc-checkpoint-history.js`; a new `crimehub-model.js` holds the ported flowchart engine (one pure `propagate()` core + two seeders); a new `crimehub-odds.js` reads Crimehub's public Firestore. The userscript (`oc-spawn-assistance.user.js`) only renders the new columns. Computation is for the actual assigned slots — no client-side recompute.

**Tech Stack:** Node ESM (server), plain JS userscript, Firestore REST (no SDK/auth), `node --check` + ad-hoc Node test scripts for verification (the server has no formal test harness).

**Build order (3 independently-shippable parts):** Part A (Yours %) → Part B (Local %) → Part C (Community %, depends on B's engine).

**Source of truth:** spec at `docs/superpowers/specs/2026-06-13-crimehub-oc-features-design.md` (read it for the verified Firestore schema, the exact flowchart algorithm, and the discovery facts referenced below).

---

## File structure

| File | Responsibility |
|---|---|
| `server/oc-checkpoint-history.js` (modify) | add `aggregateByCrime(factionId)` → per-crime-name observed success/fail from stored per-checkpoint P/F |
| `server/routes.js` (modify) | new `GET /api/oc/observed-odds`; extend `GET /api/oc/outcome` to also return `localSuccessChance` |
| `server/oc-spawn.js` (modify) | call `crimehub-model` inside the outcome path; surface community odds |
| `server/crimehub-model.js` (create) | vendored-graph loader + pure flowchart engine: `propagate`, `seedFromRoles`, `seedFromCommunity`, `calculateLocalOutcome`, `calculateCommunityOutcome` |
| `server/crimehub-odds.js` (create) | Firestore `aggregations` fetch + typed-JSON coercion + TTL cache + `crimeid↔typeid` use |
| `bin/vendor-crimehub-graphs.mjs` (create) | one-time: fetch + trim `<slug>_{paths,checks}.json` + scrape role-order table → `server/data/crimehub-graphs.json` |
| `server/data/crimehub-graphs.json` (create, vendored) | trimmed per-crime graphs + role order |
| `server/data/crimehub-crosswalk.json` (create, vendored) | crime name → `typeid` (+ `slug`) map (21 crimes) |
| `server/public/scripts/oc-spawn-assistance.user.js` (modify) | render Yours % / Local % / Community % columns |

---

# PART A — Yours % (faction observed success, zero external dependency)

### Task A1: `aggregateByCrime(factionId)` in oc-checkpoint-history.js

**Files:**
- Modify: `server/oc-checkpoint-history.js` (add an exported function; mirror existing `aggregateByMember` at lines 104-129)
- Test: `server/test/oc-checkpoint-history.aggregateByCrime.test.mjs` (create)

Stored schema (verified): `data/oc-checkpoint-history/<fid>.json = { scenarios: { "<sid>": { id, name, executedAt, ingestedAt, checkpoints: [ {checkpoint, outcome:"P"|"F", playerId, role} ] } } }`. A Torn OC succeeds iff **every** checkpoint passed. Only `P`/`F` are stored (no crit).

- [ ] **Step 1: Write the failing test**

```js
// server/test/oc-checkpoint-history.aggregateByCrime.test.mjs
import assert from "node:assert";
import { _aggregateScenariosByCrime } from "../oc-checkpoint-history.js";

// Pure helper over an in-memory scenarios map (no disk) — see Step 3.
const scenarios = {
  "1": { name: "Cash Me if You Can", checkpoints: [{outcome:"P"},{outcome:"P"},{outcome:"F"}] }, // fail
  "2": { name: "Cash Me if You Can", checkpoints: [{outcome:"P"},{outcome:"P"},{outcome:"P"}] }, // success
  "3": { name: "Cash Me if You Can", checkpoints: [{outcome:"P"}] },                              // success
  "4": { name: "Honey Trap",         checkpoints: [] },                                           // excluded (no checkpoints)
};
const out = _aggregateScenariosByCrime(scenarios);
assert.deepStrictEqual(out["Cash Me if You Can"], { success: 2, fail: 1, total: 3, rate: 2/3 });
assert.strictEqual(out["Honey Trap"], undefined, "empty-checkpoint scenarios are excluded");
console.log("OK");
```

- [ ] **Step 2: Run it, verify it fails**

Run: `node server/test/oc-checkpoint-history.aggregateByCrime.test.mjs`
Expected: FAIL — `_aggregateScenariosByCrime is not a function`.

- [ ] **Step 3: Implement** (add near `aggregateByMember`, export both the pure helper and the disk-backed wrapper)

```js
// Pure: classify per-instance records into per-crime-name success/fail tallies.
export function _aggregateScenariosByCrime(scenarios) {
  const byName = {};
  for (const sid in scenarios) {
    const s = scenarios[sid];
    const cps = Array.isArray(s.checkpoints) ? s.checkpoints : [];
    if (cps.length === 0) continue; // exclude empty/partial captures
    const name = String(s.name || "").trim();
    if (!name) continue;
    const b = (byName[name] ||= { success: 0, fail: 0, total: 0, rate: 0 });
    b.total++;
    if (cps.every((c) => c.outcome === "P")) b.success++;
    else b.fail++;
  }
  for (const name in byName) {
    const b = byName[name];
    b.rate = b.total ? b.success / b.total : 0;
  }
  return byName;
}

// Disk-backed: lazy-load the faction file (reuse the existing _load) then aggregate.
export function aggregateByCrime(factionId) {
  const entry = _load(factionId); // same loader aggregateByMember uses
  return _aggregateScenariosByCrime(entry.scenarios || {});
}
```

- [ ] **Step 4: Run it, verify it passes** → `node server/test/oc-checkpoint-history.aggregateByCrime.test.mjs` → `OK`.

- [ ] **Step 5: Commit**

```bash
git add server/oc-checkpoint-history.js server/test/oc-checkpoint-history.aggregateByCrime.test.mjs
git commit -m "oc-checkpoint-history: aggregateByCrime() for faction whole-crime success odds"
```

### Task A2: `GET /api/oc/observed-odds` (faction-only first)

**Files:**
- Modify: `server/routes.js` (add a route; copy the key-verify pattern from `/api/oc/scope` lines 8640-8651 and the admin gate from `/api/oc/outcome` lines 8727-8733)
- Modify: `server/routes.js` import area (import `aggregateByCrime` from `./oc-checkpoint-history.js`)

- [ ] **Step 1: Add the import** — alongside the existing `oc-checkpoint-history` import (the module is already imported for `ingestScenario`/`aggregateByMember`; add `aggregateByCrime` to that import).

- [ ] **Step 2: Add the route** (place near the other `/api/oc/*` GETs, e.g. after `/api/oc/outcome` ~line 8746)

```js
// GET /api/oc/observed-odds?key=...  → { byName: { "<crime name>": { faction:{success,fail,total,rate}, community: null } } }
// Admin-gated (same gate as /api/oc/outcome). community is filled in Part C.
router.get("/api/oc/observed-odds", async (req, res) => {
  const key = req.query.key;
  if (!key || key.length < 10) return res.status(400).json({ error: "Invalid key" });
  const suffix = key.slice(-8);
  let info = _spawnKeyCache.get(suffix);
  if (!info || (Date.now() - info.ts) > 5 * 60_000) {
    try {
      const tornInfo = await verifyTornApiKey(key);
      info = { ts: Date.now(), factionId: tornInfo.factionId, playerName: tornInfo.playerName,
               playerId: tornInfo.playerId, factionPosition: tornInfo.factionPosition,
               hasFactionAccess: tornInfo.hasFactionAccess };
      _spawnKeyCache.set(suffix, info);
    } catch (err) { return res.status(401).json({ error: err.message }); }
  }
  const isDev = String(info.playerId) === "137558";
  const adminRoles = store.getAdminRoles(info.factionId).map((r) => String(r).toLowerCase());
  const pos = String(info.factionPosition || "").toLowerCase();
  if (!isDev && !adminRoles.includes(pos)) return res.status(403).json({ error: "Admin role required" });

  const faction = aggregateByCrime(info.factionId); // { name: {success,fail,total,rate} }
  const byName = {};
  for (const name in faction) byName[name] = { faction: faction[name], community: null };
  res.set("Cache-Control", "private, max-age=60");
  return res.json({ byName });
});
```

- [ ] **Step 3: Manual verify** — reload server (`pm2 reload warboard`), then:

```bash
curl -s "http://127.0.0.1:3000/api/oc/observed-odds?key=<ADMIN_KEY>" | python3 -m json.tool | head -20
```
Expected: `byName` map with per-crime `faction.{success,fail,total,rate}`, `community: null`. (403 if the key isn't an admin — expected.)

- [ ] **Step 4: Commit**

```bash
git add server/routes.js
git commit -m "routes: GET /api/oc/observed-odds (faction whole-crime success)"
```

### Task A3: userscript "Yours %" column

**Files:**
- Modify: `server/public/scripts/oc-spawn-assistance.user.js` — table shell `renderOutcomeEvEngineShell` (line 5465; headers 5489-5495, rows 5524-5531, tt consts 5477-5480), async populator `scheduleOutcomeEvFetches` (line 5566; colour() at 5610), sort map (5656-5659), `gmRequest` (1612), `SERVER` (302), version (line 4 + 301).

Column order target: `OC | Lvl | Pass % | Local % | Yours % | Community % | Top end % | Hit % | Q score`. This task adds **Yours %** only (Local %/Community % land in B/C).

- [ ] **Step 1: Add a tooltip const** near lines 5477-5480:

```js
const ttYours = 'Your faction’s observed whole-crime success rate for this OC (a crime succeeds only if every checkpoint passes). From your checkpoint history; needs ≥4 completions.';
```

- [ ] **Step 2: Add the header cell** — insert immediately AFTER the Pass % `<th>` (line 5491), before the Top end % `<th>` (line 5492):

```js
html += `<th class="oc-ev-sort" data-col="yours" style="cursor:pointer;">Yours % <span class="oc-ev-sort-ind"></span> <span class="oc-ev-info" data-tt-title="Yours %" data-tt="${ttYours}">?</span></th>`;
```

- [ ] **Step 3: Add the row cell** — insert immediately AFTER the `.oc-outcome-pass` `<td>` (line 5527), before the `.oc-outcome-top` `<td>` (line 5528):

```js
html += `<td class="oc-outcome-yours" style="color:#6b7280">…</td>`;
```

- [ ] **Step 4: Add the sort-map entry** — in the ternary at lines 5656-5659, add `: col === 'yours' ? '.oc-outcome-yours'`.

- [ ] **Step 5: Fetch + populate** — once per table render (not per crime). In `scheduleOutcomeEvFetches` (after the function opens at 5566, before the per-crime loop), fetch the observed-odds map once:

```js
let _observed = {};
try {
  const ro = await gmRequest(`${SERVER}/api/oc/observed-odds?key=${encodeURIComponent(apiKey)}`);
  if (ro.ok && ro.data && ro.data.byName) _observed = ro.data.byName;
} catch (_) {}
```
Then inside the per-crime loop, after the `.oc-outcome-pass` populate (line 5614), add:

```js
const yoursCell = row.querySelector('.oc-outcome-yours');
if (yoursCell) {
  const f = _observed[c.name]?.faction;
  if (f && f.total >= 4) {
    const yp = f.rate * 100;
    yoursCell.style.color = colour(yp); yoursCell.textContent = yp.toFixed(1) + '%'; yoursCell.dataset.val = yp;
  } else {
    yoursCell.textContent = f && f.total > 0 ? `— (${f.total})` : '—';
  }
}
```

- [ ] **Step 6: Bump version (lockstep)** — line 4 `// @version 3.2.45` → `3.2.46`; line 301 `const SCRIPT_VERSION = '3.2.45';` → `'3.2.46'`. (First curl the served meta to confirm 3.2.45 is live; use max(source,served)+1.)

- [ ] **Step 7: Verify + deploy** — `node --check server/public/scripts/oc-spawn-assistance.user.js`; it's already in `public/scripts` (canonical, no source copy); curl `http://127.0.0.1:3000/scripts/oc-spawn-assistance.meta.js` shows 3.2.46. Manual: open the OC Admin tab, confirm a "Yours %" column shows your success rate / "—".

- [ ] **Step 8: Commit + push**

```bash
git add server/public/scripts/oc-spawn-assistance.user.js
git commit -m "oc-spawn-assistance 3.2.46: Yours % column (faction observed success)"
git push origin HEAD
```

**→ Part A is shippable on its own here.**

---

# PART B — Local % (ported flowchart model, co-primary)

### Task B1: vendor the graph data

**Files:**
- Create: `bin/vendor-crimehub-graphs.mjs`
- Create (output): `server/data/crimehub-graphs.json`, `server/data/crimehub-crosswalk.json`

Graph source (verified): `https://crimeshub-2b4b0.web.app/assets/json/<slug>_paths.json` (edges) + `<slug>_checks.json` (nodes), `slug = name.replace(/\s/g,'').toLowerCase()` + optional `v1`/`v2`. Role-order table = the 24 `setRoles(...)` calls in the bundle `main-*.js`. 3 crimes (`cranereaction`, `gonefission`, `manifestcruelty`) 404 → skip. Guardian Angels slug → `guardian%C3%A1ngels`.

- [ ] **Step 1: Write the vendor script** — fetch each crime's `_checks.json` + `_paths.json`, keep only fields the calc reads (drop `point`/`story`/coords; keep node `{id, type, data:{roles}}` for checks, `{id, type, data:{text, rewards:{money}}}` for endings, and edge `{id, target}`), and write `crimehub-graphs.json = { "<slug>": { name, roleOrder:[...], checks:[...], endings:[...], edges:[...] } }`. Build `crimehub-crosswalk.json = { "<Crime Name>": { slug, typeid } }` (typeid filled in Task C2's spike; for now write `typeid:null` + the name/slug from the bundle catalog). Use a hardcoded list of the 21 crime catalog entries (titles + slugs from the bundle) at the top of the script.

```js
// bin/vendor-crimehub-graphs.mjs — run: node bin/vendor-crimehub-graphs.mjs
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "..", "server", "data");
const BASE = "https://crimeshub-2b4b0.web.app/assets/json";
const UA = { headers: { "User-Agent": "warboard-oc/1.0 (+https://tornwar.com; interop with crimeshub-2b4b0.web.app)" } };

// {title, slug, roleOrder} — roleOrder scraped from the bundle's setRoles() calls (verified during discovery).
const CRIMES = [
  { title: "Honey Trap",      slug: "honeytrap",      roleOrder: ["Muscle2","Muscle1","Enforcer"] },
  // ... 20 more entries (titles + slugs + setRoles order). breakthebank/aceinthehole use v2 slug + their v2 role order.
];

function trimNodes(arr) {
  return arr.map((n) => n.type === "check"
    ? { id: n.id, type: n.type, data: { roles: n.data?.roles || [] } }
    : n.type === "ending"
      ? { id: n.id, type: n.type, data: { text: n.data?.text, money: n.data?.rewards?.money ?? null } }
      : { id: n.id, type: n.type });
}
const trimEdges = (arr) => arr.map((e) => ({ id: e.id, target: e.target }));

const graphs = {}, crosswalk = {};
for (const c of CRIMES) {
  try {
    const slug = encodeURI(c.slug);
    const [checks, paths] = await Promise.all([
      fetch(`${BASE}/${slug}_checks.json`, UA).then((r) => r.ok ? r.json() : Promise.reject(r.status)),
      fetch(`${BASE}/${slug}_paths.json`,  UA).then((r) => r.ok ? r.json() : Promise.reject(r.status)),
    ]);
    const nodes = trimNodes(checks);
    graphs[c.slug] = {
      name: c.title, roleOrder: c.roleOrder,
      checks: nodes.filter((n) => n.type === "check"),
      endings: nodes.filter((n) => n.type === "ending"),
      edges: trimEdges(paths),
    };
    crosswalk[c.title] = { slug: c.slug, typeid: null };
  } catch (status) { console.warn(`skip ${c.slug}: ${status}`); }
}
mkdirSync(OUT, { recursive: true });
writeFileSync(join(OUT, "crimehub-graphs.json"), JSON.stringify(graphs));
writeFileSync(join(OUT, "crimehub-crosswalk.json"), JSON.stringify(crosswalk, null, 2));
console.log(`vendored ${Object.keys(graphs).length} crimes`);
```

- [ ] **Step 2: Run it** → `node bin/vendor-crimehub-graphs.mjs` → expect `vendored 18` (21 minus the 3 unpublished), files written, total `crimehub-graphs.json` ~150-250 KB.
- [ ] **Step 3: Commit** → `git add bin/vendor-crimehub-graphs.mjs server/data/crimehub-graphs.json server/data/crimehub-crosswalk.json && git commit -m "Vendor Crimehub crime graphs + role order (attribution: crimeshub-2b4b0.web.app)"`

### Task B2: flowchart engine `crimehub-model.js` (golden-tested)

**Files:**
- Create: `server/crimehub-model.js`
- Test: `server/test/crimehub-model.test.mjs`

Algorithm (verified, from spec). The engine factors into a pure `propagate(graph, nodeSuccessRates)` + seeders.

- [ ] **Step 1: Write the golden test** (validated values from discovery)

```js
// server/test/crimehub-model.test.mjs
import assert from "node:assert";
import { calculateLocalOutcome } from "../crimehub-model.js";
const r = calculateLocalOutcome("Honey Trap", { Muscle2:50, Muscle1:50, Enforcer:50 });
assert.ok(Math.abs(r.successChance - 0.4067) < 0.002, `honeytrap@50 success ${r.successChance}`);
assert.ok(Math.abs(r.avgReward - 7370000) / 7370000 < 0.02, `honeytrap@50 avgReward ${r.avgReward}`);
console.log("OK", r);
```

- [ ] **Step 2: Run it, verify it fails** → `node server/test/crimehub-model.test.mjs` → FAIL (module missing).

- [ ] **Step 3: Implement** `server/crimehub-model.js`

```js
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const __dirname = dirname(fileURLToPath(import.meta.url));
let _graphs = null;
function graphs() { return _graphs ||= JSON.parse(readFileSync(join(__dirname, "data", "crimehub-graphs.json"), "utf8")); }
function graphForScenario(name) {
  const g = graphs();
  for (const slug in g) if (g[slug].name.toLowerCase() === String(name).toLowerCase()) return g[slug];
  return null;
}
const idSort = (a, b) => String(a.id).localeCompare(String(b.id), undefined, { numeric: true });

// Build {id -> {id, sources:[edgeIds], roles?, text?, money?, occurrenceRate:1}} for checks + endings.
function setMap(graph) {
  const map = {};
  for (const n of [...graph.checks, ...graph.endings].sort(idSort)) {
    if (n.type === "check")  map[n.id] = { id: n.id, sources: [], roles: n.data.roles, occurrenceRate: 1 };
    else                     map[n.id] = { id: n.id, sources: [], text: n.data.text, money: n.data.money, occurrenceRate: 1 };
  }
  for (const e of graph.edges) if (map[e.target]) map[e.target].sources.push(e.id);
  return map;
}
// Per-node successRate from {role -> passRate(0-100)} averaged over the node's roles.
export function seedFromRoles(graph, passRatesByRole) {
  const rates = {};
  for (const c of graph.checks) {
    const r = c.data.roles || [];
    const vals = r.map((k) => Number(passRatesByRole[k]) || 0);
    rates[c.id] = vals.length ? vals.reduce((a, b) => a + b, 0) / (vals.length * 100) : 0;
  }
  return rates;
}
// Pure propagation. nodeSuccessRates: {checkId -> 0..1}. Returns {successChance, avgReward, expectedReward}.
export function propagate(graph, nodeSuccessRates) {
  const map = setMap(graph);
  const ordered = Object.values(map).sort(idSort);
  for (const a of ordered) if (a.roles) {
    a.successRate = Number(nodeSuccessRates[a.id]) || 0;
    a.failureRate = 1 - a.successRate;
  }
  for (const a of ordered) {
    if (a.id === "A1-C1") continue; // first checkpoint always occurs
    a.occurrenceRate = a.sources.reduce((sum, c) => {
      const base = c.slice(0, -1), b = map[base];
      if (!b) return sum;
      return sum + (c.endsWith("P") ? b.successRate * b.occurrenceRate : b.failureRate * b.occurrenceRate);
    }, 0);
  }
  let success = 0, avgReward = 0;
  for (const a of ordered) if (a.text != null) {
    if (a.text[0] === "G") success += a.occurrenceRate;
    if (a.money != null) avgReward += a.occurrenceRate * a.money;
  }
  return { successChance: success, avgReward, expectedReward: success ? avgReward / success : 0 };
}
export function calculateLocalOutcome(scenarioName, passRatesByRole) {
  const g = graphForScenario(scenarioName);
  if (!g) return { successChance: null, avgReward: null, expectedReward: null, missing: true };
  return propagate(g, seedFromRoles(g, passRatesByRole));
}
```

- [ ] **Step 4: Run it, verify it passes** → `node server/test/crimehub-model.test.mjs` → `OK { successChance: ~0.4067, ... }`. If off, re-check role order in the vendored graph vs the test's role keys.

- [ ] **Step 5: Commit** → `git add server/crimehub-model.js server/test/crimehub-model.test.mjs && git commit -m "crimehub-model: port Crimehub flowchart successChance engine (golden: honeytrap@50=40.67%)"`

### Task B3: extend `/api/oc/outcome` with `localSuccessChance`

**Files:**
- Modify: `server/oc-spawn.js` `calculateOutcome` (lines 257-284) — after the upstream result resolves, compute the local value and merge it.
- Modify: `server/oc-spawn.js` imports — `import { calculateLocalOutcome } from "./crimehub-model.js";`

Input mapping: `/api/oc/outcome` passes `cprs` in **slot order**; the engine wants `{roleKey -> passRate}` in the crime's `roleOrder`. Map slot-order → role-order: `passRatesByRole[roleOrder[i]] = cprs[i]`. (Slot order == Torn slot order; the vendored `roleOrder` is Crimehub's `setRoles` order. **Verify alignment** in Step 3 against the honeytrap golden.)

- [ ] **Step 1: Write the test**

```js
// server/test/oc-spawn.localOutcome.test.mjs
import assert from "node:assert";
import { _withLocalOutcome } from "../oc-spawn.js"; // pure merge helper added in Step 3
const merged = _withLocalOutcome({ successChance: 0.42 }, "Honey Trap", [50,50,50]);
assert.ok(typeof merged.localSuccessChance === "number");
assert.ok(Math.abs(merged.delta - (merged.localSuccessChance - 0.42)) < 1e-9);
console.log("OK", merged.localSuccessChance.toFixed(4), merged.delta.toFixed(4));
```

- [ ] **Step 2: Run it, verify it fails** → FAIL (`_withLocalOutcome` missing).

- [ ] **Step 3: Implement** — add the pure helper + call it in `calculateOutcome` before returning the cached/fetched `data`:

```js
import { calculateLocalOutcome } from "./crimehub-model.js";
import crosswalkRaw from "./data/crimehub-crosswalk.json" assert { type: "json" };

export function _withLocalOutcome(data, scenario, rounded) {
  const slug = Object.values(crosswalkRaw).find((c) => c.name?.toLowerCase?.() === String(scenario).toLowerCase());
  // roleOrder lives in the vendored graph; calculateLocalOutcome looks it up by scenario name.
  const local = calculateLocalOutcome(scenario, _slotsToRoles(scenario, rounded));
  const lsc = local && !local.missing ? local.successChance : null;
  const base = (data && typeof data.successChance === "number") ? data.successChance : null;
  return { ...data, localSuccessChance: lsc, localAvgReward: local?.avgReward ?? null,
           delta: (lsc != null && base != null) ? lsc - base : null };
}
```
Add `_slotsToRoles(scenario, rounded)` that reads the vendored graph's `roleOrder` for the scenario and returns `{roleOrder[i]: rounded[i]}`. In `calculateOutcome`, change the two `return ...data` paths (cached hit line 270, fresh line 280) to `return _withLocalOutcome(data, scenario, rounded);`.

- [ ] **Step 4: Run it, verify it passes** → `node server/test/oc-spawn.localOutcome.test.mjs` → `OK`. **Then verify slot↔role alignment**: with `cprs=[50,50,50]` for Honey Trap, `localSuccessChance` must be ~0.4067 (matches the golden). If not, the slot order ≠ roleOrder — adjust `_slotsToRoles` (the plan's spike output / a per-crime slot→role index map).

- [ ] **Step 5: Commit** → `git add server/oc-spawn.js server/test/oc-spawn.localOutcome.test.mjs && git commit -m "oc-spawn: /api/oc/outcome also returns localSuccessChance + delta"`

### Task B4: userscript "Local %" column

**Files:** Modify `server/public/scripts/oc-spawn-assistance.user.js` (same sites as A3).

- [ ] **Step 1: tt const** near 5477-5480: `const ttLocal = 'Locally-computed flowchart success prediction (Crimehub model). Co-primary cross-check of the Pass % number; a large gap flags a discrepancy.';`
- [ ] **Step 2: header** — insert AFTER the Pass % `<th>` (5491), BEFORE the Yours % `<th>` added in A3:
```js
html += `<th class="oc-ev-sort" data-col="local" style="cursor:pointer;">Local % <span class="oc-ev-sort-ind"></span> <span class="oc-ev-info" data-tt-title="Local %" data-tt="${ttLocal}">?</span></th>`;
```
- [ ] **Step 3: row cell** — insert AFTER `.oc-outcome-pass` `<td>` (5527), BEFORE `.oc-outcome-yours`: `html += '<td class="oc-outcome-local" style="color:#6b7280">…</td>';`
- [ ] **Step 4: sort map** — add `: col === 'local' ? '.oc-outcome-local'`.
- [ ] **Step 5: populate** — in the per-crime loop right after the `.oc-outcome-pass` set (line 5614), Local % comes from the SAME `/api/oc/outcome` response `d`:
```js
const localCell = row.querySelector('.oc-outcome-local');
if (localCell) {
  if (typeof d.localSuccessChance === 'number') {
    const lp = d.localSuccessChance * 100;
    localCell.style.color = colour(lp); localCell.textContent = lp.toFixed(1) + '%'; localCell.dataset.val = lp;
    if (typeof d.delta === 'number' && Math.abs(d.delta) >= 0.05) localCell.title = `Δ vs Pass%: ${(d.delta*100).toFixed(1)}pp`;
  } else { localCell.textContent = '—'; } // crime not yet published by Crimehub
}
```
- [ ] **Step 6: version** → bump line 4 + 301 to `3.2.47` (max(source,served)+1).
- [ ] **Step 7: verify + deploy** → `node --check ...`; curl meta shows 3.2.47; open Admin tab → Local % populated next to Pass %, "—" for unpublished crimes.
- [ ] **Step 8: commit + push** → `git commit -m "oc-spawn-assistance 3.2.47: Local % column (flowchart model, co-primary)" && git push origin HEAD`

**→ Part B is shippable here.**

---

# PART C — Community % — ❌ DROPPED (infeasible, 2026-06-13)

> **DROPPED.** A spike found Crimehub's Firestore `outcomes`/`aggregations` are for Torn's **CLASSIC single-player crimes** (typeids 1–13 = Search for Cash … Arson, per the bundle's own `CrimeType` map), **not the OC2 team crimes**. OC2 crimes have **no community observed-odds anywhere** — Crimehub models them purely from user sliders (default 50), reading zero Firestore in the flowchart path. The only community-derived OC2 number is tornprobability's `CalculateSuccess`, which is warboard's existing **Pass %**. So there is nothing distinct to display. The tasks below were **NOT built**; kept for the record only.

### Task C1: `crimehub-odds.js` — Firestore aggregations fetch + cache

**Files:**
- Create: `server/crimehub-odds.js`
- Test: `server/test/crimehub-odds.coerce.test.mjs`

Firestore is public-read (no auth). REST: `GET https://firestore.googleapis.com/v1/projects/crimeshub-2b4b0/databases/(default)/documents/aggregations?pageSize=300`. Each doc has typed-JSON fields; we need `_id`(crimeid), `typeid`, `samples`, `outcomes.{success,failure,critical}`. Cache to `server/data/crimehub-aggregations-cache.json` with a 24 h TTL; coalesce concurrent refreshes (mirror the `getRoleWeights` inflight pattern, oc-spawn.js 302-345).

- [ ] **Step 1: Test the typed-JSON coercion**

```js
// server/test/crimehub-odds.coerce.test.mjs
import assert from "node:assert";
import { _coerceFsValue, _coerceAggDoc } from "../crimehub-odds.js";
assert.strictEqual(_coerceFsValue({ integerValue: "81" }), 81);
assert.strictEqual(_coerceFsValue({ doubleValue: 0.5 }), 0.5);
assert.strictEqual(_coerceFsValue({ booleanValue: false }), false);
const doc = { fields: { _id:{integerValue:"1"}, typeid:{integerValue:"1"}, samples:{integerValue:"14625"},
  outcomes:{ mapValue:{ fields:{ success:{integerValue:"12972"}, failure:{integerValue:"1595"}, critical:{integerValue:"58"} } } } } };
assert.deepStrictEqual(_coerceAggDoc(doc), { crimeid:1, typeid:1, samples:14625, success:12972, failure:1595, critical:58 });
console.log("OK");
```

- [ ] **Step 2: Run it, verify it fails** → FAIL (module missing).

- [ ] **Step 3: Implement** `server/crimehub-odds.js`

```js
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const __dirname = dirname(fileURLToPath(import.meta.url));
const DIR = process.env.DATA_DIR || join(__dirname, "data");
const CACHE = join(DIR, "crimehub-aggregations-cache.json");
const TTL_MS = 24 * 60 * 60 * 1000;
const URL = "https://firestore.googleapis.com/v1/projects/crimeshub-2b4b0/databases/(default)/documents/aggregations?pageSize=300";
const UA = { headers: { "User-Agent": "warboard-oc/1.0 (+https://tornwar.com; interop with crimeshub-2b4b0.web.app)" } };

export function _coerceFsValue(v) {
  if (v == null) return null;
  if ("integerValue" in v) return parseInt(v.integerValue, 10);
  if ("doubleValue" in v) return Number(v.doubleValue);
  if ("booleanValue" in v) return v.booleanValue;
  if ("stringValue" in v) return v.stringValue;
  if ("mapValue" in v) { const o = {}; const f = v.mapValue.fields || {}; for (const k in f) o[k] = _coerceFsValue(f[k]); return o; }
  if ("nullValue" in v) return null;
  return null;
}
export function _coerceAggDoc(doc) {
  const f = doc.fields || {};
  const o = _coerceFsValue({ mapValue: { fields: f.outcomes?.mapValue?.fields || {} } });
  return { crimeid: _coerceFsValue(f._id), typeid: _coerceFsValue(f.typeid), samples: _coerceFsValue(f.samples),
           success: o.success || 0, failure: o.failure || 0, critical: o.critical || 0 };
}

let _mem = null, _inflight = null;
function _readCache() { try { return JSON.parse(readFileSync(CACHE, "utf8")); } catch { return null; } }
export async function getAggregations() {           // → [{crimeid,typeid,samples,success,failure,critical}]
  if (_mem && Date.now() - _mem.ts < TTL_MS) return _mem.docs;
  const disk = _readCache();
  if (disk && Date.now() - disk.ts < TTL_MS) { _mem = disk; return disk.docs; }
  if (_inflight) return _inflight;
  _inflight = (async () => {
    try {
      let docs = [], url = URL;
      for (let i = 0; i < 5 && url; i++) {
        const r = await fetch(url, UA); if (!r.ok) throw new Error("firestore " + r.status);
        const j = await r.json(); docs.push(...(j.documents || []).map(_coerceAggDoc));
        url = j.nextPageToken ? URL + "&pageToken=" + encodeURIComponent(j.nextPageToken) : null;
      }
      _mem = { ts: Date.now(), docs };
      if (!existsSync(DIR)) mkdirSync(DIR, { recursive: true });
      writeFileSync(CACHE, JSON.stringify(_mem));
      return docs;
    } catch (e) { return disk?.docs || []; }   // serve stale on failure
    finally { _inflight = null; }
  })();
  return _inflight;
}
```

- [ ] **Step 4: Run it, verify it passes** → `node server/test/crimehub-odds.coerce.test.mjs` → `OK`. Smoke: `node -e "import('./server/crimehub-odds.js').then(m=>m.getAggregations()).then(d=>console.log(d.length, d[0]))"` → ~40+ docs.
- [ ] **Step 5: Commit** → `git add server/crimehub-odds.js server/test/crimehub-odds.coerce.test.mjs && git commit -m "crimehub-odds: public Firestore aggregations fetch + coercion + 24h cache"`

### Task C2: SPIKE — resolve the flowchart-node ↔ community-crimeid join, fill the crosswalk

**Files:** Modify `server/data/crimehub-crosswalk.json` (fill `typeid` + a `nodeToCrimeid` map per crime); document the rule in a comment block at the top of `server/crimehub-odds.js`.

This is a concrete investigation with a defined deliverable — **not** a placeholder. Community % needs, per crime, a way to seed each flowchart check node with the community's observed pass-rate. That requires `checkNodeId → crimeid` (then `crimeid → {success,critical,samples}` from C1).

- [ ] **Step 1: Inspect the data for a direct join.**
  - Re-fetch `honeytrap_checks.json` and print every field of a check node — does it carry a `crimeid`/numeric id? (`curl -s https://crimeshub-2b4b0.web.app/assets/json/honeytrap_checks.json | python3 -m json.tool | head -60`)
  - Print 3 `aggregations` docs and 3 `outcomes` docs for one typeid — do they carry a node id like `A1-C3`? (`runQuery` filtered by `typeid`).
- [ ] **Step 2: Inspect the bundle merge.** In Crimehub's `main-*.js`, find where graph nodes are joined to Firestore observed counts (search `GetOutcomes`, `aggregations`, `occurrenceRate`, the node-render that shows observed %). Record the exact join key.
- [ ] **Step 3: Test the ordering hypothesis.** Compare the count of check nodes for typeid T to the count of `aggregations` crimeids tagged `typeid==T`; if equal, test whether the i-th id-sorted check node ↔ the i-th id-sorted crimeid (compare a couple of observed rates against Crimehub's site for that crime).
- [ ] **Step 4: Deliverable.** Write the resolved rule into `crimehub-crosswalk.json` as `{ "<Crime Name>": { slug, typeid, nodeToCrimeid: { "A1-C1": <crimeid>, ... } } }` for the 18 published crimes, and add a comment in `crimehub-odds.js` describing the rule. If **no** per-node join exists, record that and STOP — Community % then falls back to per-typeid only (document the limitation; the column shows a typeid-level community success from the product of its crimeids' rates instead of node-seeded).
- [ ] **Step 5: Commit** → `git add server/data/crimehub-crosswalk.json server/crimehub-odds.js && git commit -m "crimehub: resolve flowchart-node -> community-crimeid join (crosswalk)"`

### Task C3: `calculateCommunityOutcome` — seed the flowchart with community rates

**Files:** Modify `server/crimehub-model.js` (add `seedFromCommunity` + `calculateCommunityOutcome`); Test `server/test/crimehub-model.community.test.mjs`.

- [ ] **Step 1: Test** — using a small synthetic graph + a `nodeToCrimeid` + community-rate map, assert `propagate` with community seeding returns the expected whole-crime success (hand-compute for a 2-checkpoint linear graph).
- [ ] **Step 2: Run it, verify it fails.**
- [ ] **Step 3: Implement**

```js
// per-node community rate = (success + critical) / samples for that node's crimeid (crit counts as a pass for whole-crime success)
export function seedFromCommunity(graph, nodeToCrimeid, communityByCrimeid) {
  const rates = {};
  for (const c of graph.checks) {
    const cid = nodeToCrimeid[c.id];
    const a = cid != null ? communityByCrimeid[cid] : null;
    rates[c.id] = a && a.samples ? (a.success + a.critical) / a.samples : 0;
  }
  return rates;
}
export function calculateCommunityOutcome(scenarioName, nodeToCrimeid, communityByCrimeid) {
  const g = graphForScenario(scenarioName);
  if (!g) return { successChance: null, missing: true };
  return propagate(g, seedFromCommunity(g, nodeToCrimeid, communityByCrimeid));
}
```

- [ ] **Step 4: Run it, verify it passes.**
- [ ] **Step 5: Commit** → `git commit -m "crimehub-model: calculateCommunityOutcome (community-seeded flowchart)"`

### Task C4: fill `community` in `/api/oc/observed-odds`

**Files:** Modify `server/routes.js` (`/api/oc/observed-odds` from A2).

- [ ] **Step 1: Wire it** — build `communityByCrimeid` once from `getAggregations()`; for each crime in the crosswalk, compute `calculateCommunityOutcome(name, crosswalk[name].nodeToCrimeid, communityByCrimeid)` and attach `community: { rate: successChance, samples: <min/representative samples> }` to `byName[name]`. Guard: missing crosswalk/graph → `community: null`.
- [ ] **Step 2: Manual verify** → `curl .../api/oc/observed-odds?key=<ADMIN>` shows non-null `community.rate` for published crimes; spot-check one against Crimehub's site.
- [ ] **Step 3: Commit** → `git commit -m "routes: fill community odds in /api/oc/observed-odds (flowchart-derived)"`

### Task C5: userscript "Community %" column

**Files:** Modify `server/public/scripts/oc-spawn-assistance.user.js` (same sites; uses the `_observed` map already fetched in A3).

- [ ] **Step 1: tt const**: `const ttCommunity = 'Crimehub community whole-crime success, derived by running community per-checkpoint rates through the flowchart. Source: crimeshub-2b4b0.web.app.';`
- [ ] **Step 2: header** — insert AFTER the Yours % `<th>`, BEFORE Top end %.
- [ ] **Step 3: row cell** — `<td class="oc-outcome-community" ...>…</td>` AFTER `.oc-outcome-yours`.
- [ ] **Step 4: sort map** — add `: col === 'community' ? '.oc-outcome-community'`.
- [ ] **Step 5: populate** — in the per-crime loop, from `_observed[c.name]?.community`:
```js
const commCell = row.querySelector('.oc-outcome-community');
if (commCell) {
  const cm = _observed[c.name]?.community;
  if (cm && typeof cm.rate === 'number') { const cp = cm.rate*100; commCell.style.color = colour(cp); commCell.textContent = cp.toFixed(1)+'%'; commCell.dataset.val = cp; }
  else commCell.textContent = '—';
}
```
- [ ] **Step 6: version** → bump to `3.2.48`.
- [ ] **Step 7: verify + deploy** → `node --check`; meta shows 3.2.48; Admin tab shows all four columns (Pass | Local | Yours | Community).
- [ ] **Step 8: commit + push** → `git commit -m "oc-spawn-assistance 3.2.48: Community % column (Crimehub, flowchart-derived)" && git push origin HEAD`

---

## Self-review

- **Spec coverage:** [a] community → C; [a] own faction → A; [b] local co-primary → B; vendoring → B1; server-centric → all; caching → C1 (24h) + A2 (60s) + B reuses 15min outcome cache; attribution/read-only → B1/C1 UA + tooltips. Covered. **Refinement vs spec:** the spec assumed `aggregations` were whole-crime; corrected here — Community % is flowchart-derived (Task C2 spike + C3), which is why Community ships after B, not "[a] fully first." Update the spec's Feature [a] section to match.
- **Placeholder scan:** C2 is a spike with concrete steps + a defined deliverable (not "TBD"). No vague "add error handling" — each error path is shown (serve-stale, `—`, `community:null`).
- **Type consistency:** `byName[name].{faction,community}` consistent A2↔C4↔userscript; `{success,fail,total,rate}` (faction) vs `{crimeid,typeid,samples,success,failure,critical}` (community) kept distinct; engine `propagate(graph,nodeSuccessRates)` reused by both seeders; column classes `.oc-outcome-{local,yours,community}` match the sort map.
- **Open risk:** Task C2 (node↔crimeid join) and Task B3 Step 4 (slot↔role order) are the two integration unknowns — both have explicit in-task verifications against the honeytrap golden / Crimehub's site.
