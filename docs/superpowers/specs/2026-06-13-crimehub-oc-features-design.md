# Crimehub-backed OC features (warboard) — Design

**Date:** 2026-06-13
**Status:** Implemented (Yours % + Local %); **Community % DROPPED as infeasible** — see note below.
**Repo:** `/opt/warboard` (factionops) — server (`server/`) + userscript (`server/public/scripts/oc-spawn-assistance.user.js`)

> **⚠️ Outcome (2026-06-13).** Shipped **Yours %** (faction history) + **Local %** (ported flowchart engine) in oc-spawn-assistance 3.2.47. **Community % was dropped**: a spike found Crimehub's Firestore data is for Torn CLASSIC single-player crimes, **not OC2** — there is no OC2 community observed-odds to display. Details in `docs/superpowers/plans/2026-06-13-crimehub-oc-features.md` Part C.

## Goal

Add two independent, **side-by-side comparison** OC features to warboard, both feeding off the Crimehub / tornprobability OC2 ecosystem:

- **[a] Observed-odds columns** — per OC scenario, show observed success/fail/crit odds from **both** Crimehub's community dataset **and** your own faction's history, side by side, in `oc-spawn-assistance`'s Outcome-EV / Hit% table.
- **[b] Local flowchart success model** — port Crimehub's client-side flowchart `successChance` calculator so warboard computes OC success **locally**, shown as a **co-primary** number next to the tornprobability `CalculateSuccess` value warboard currently depends on.

The two features are independent and separately shippable. Build order: **[a] first** (pure data), then **[b]**.

## Background (verified by discovery, 2026-06-13)

Ecosystem (all by the Torn player **Emforus**):
- The **OC Scenario Tracker** (greasyfork 530656) intercepts the completed-crimes fetch and POSTs instances to `tornprobability.com:3000/api/scenarios`.
- tornprobability aggregates submissions → **Firebase Firestore** → **Crimehub** (Angular SPA, `crimeshub-2b4b0.web.app`) reads Firestore directly in the browser.
- warboard already proxies `tornprobability.com:3000/api/CalculateSuccess` via `/api/oc/outcome` (server `oc-spawn.js` `calculateOutcome`, ~15-min cache) and `GetRoleWeights` (~12 h cache). Per-slot CPR is warboard's own (`buildCprCache`, from faction checkpoint-pass-rate history).

Discovery findings (probed live, read-only):
- **Crimehub Firestore is fully public-read** — no auth, no SDK, no API key required. Plain REST: `GET .../v1/projects/crimeshub-2b4b0/databases/(default)/documents/<collection>`, `:runQuery`, `:runAggregationQuery`.
- **`aggregations` collection** (~40 docs; `_id` == Torn `crimeid`, tagged with `typeid`) is the observed-odds source. Doc shape:
  ```
  { _id: 1, typeid: 1, samples: 14625,
    outcomes: { success: 12972, failure: 1595, critical: 58 },
    money: { min: 3, avg: 73.6489, max: 600 },
    crits: { injury:{min,max}, jail:{min,max}, hospital:{min,max} } }   // severity seconds
  ```
  **Correction (post-planning discovery): each `aggregations` doc is ONE checkpoint, not a whole crime** (a crime ≈ 6 crimeids, e.g. typeid 1 = `_id` 1–6, with `samples` decreasing down the chain — these are *conditional* per-checkpoint pass counts). So a whole-crime community success % is **derived**, not read: run the per-checkpoint community rates through the flowchart model ([b]) — see the plan's Task C2 (node↔crimeid join) + C3. This **couples Community % to [b]**, so it ships after it.
- **`outcomes` collection** (13,999 docs) = per-variant story/reward detail. **Out of scope for v1** (drill-down only).
- **Keying / mapping:** no `name→typeid` table is shipped anywhere. Join via **Torn `crimeid`** (`== aggregations._id`), which warboard already sees in OC data. A scenario (`typeid`) can span multiple `crimeid`s (e.g. typeid 3 → crimeids 12 & 18). Crosswalk seed (typeid→first crimeid): `{1:4, 2:8, 3:[12,18], 4:19, 5:27, 6:49, 7:112, 8:140, 9:157, 10:205, 11:208, 12:290, ...}` — build & cache the full `crimeid↔typeid` crosswalk once by scanning the `outcomes`/`aggregations` collections (select `crimeid`,`typeid`, dedup).
- **Flowchart model reverse-engineered & validated.** Graph data = static JSON on the Crimehub host: `assets/json/<slug>_paths.json` (edges) + `assets/json/<slug>_checks.json` (nodes), `slug = name.replace(/\s/g,'').toLowerCase()` + optional `v1`/`v2`. ~956 KB raw across 21 crime-variants (650 nodes / 804 edges); trims to ~150–250 KB by dropping story text + coords. Role-order tables live in the bundle (`setRoles()` calls). 3 routed crimes (`cranereaction`, `gonefission`, `manifestcruelty`) currently 404 (unpublished). Guardian Angels slug needs accent: `guardian%C3%A1ngels`.
- Data refresh cadence ~daily. Always send a descriptive User-Agent; **attribute Crimehub** (`crimeshub-2b4b0.web.app`) as the source. **Read-only — never write to Firestore.**

## Scope

**In:** [a] community + own-faction observed-odds columns; [b] server-side local flowchart calc as co-primary; one-time vendoring script for graph + role data; caching; golden/unit tests; attribution.

**Out (YAGNI):** interactive what-if sliders, client-side recompute, the 13,999-doc `outcomes` drill-down, rebuilding Crimehub's flowchart visualization, and dropping tornprobability (it stays — [b] is co-primary, not a replacement).

## Architecture & boundaries (server-centric)

Small, single-purpose units in the existing OC subsystem:

- **`server/crimehub-odds.js`** (new) — fetch Crimehub `aggregations` via Firestore REST, coerce Firestore typed-JSON, cache (12–24 h TTL, on-disk under `server/data/`), maintain the `crimeid↔typeid` crosswalk. One job: external observed odds.
- **`server/crimehub-model.js`** (new) — load the vendored graph blob + role-order table; export `calculateLocalOutcome(scenarioName, cprsByRole)` implementing the ported flowchart algorithm (pure, golden-tested). One job: local predicted odds.
- **own-faction odds** — aggregate per-crime `success/fail/crit` from the **checkpoint-history warboard already collects** (`/api/oc/checkpoint-history` store). Extend the existing store query; no new data capture. **Verify at implementation what the store records:** if it holds per-*checkpoint* pass/fail rather than per-*crime* outcome, derive a per-crime result (success = reached a "Good" ending / all checkpoints passed; critical = a crit occurred; else failure) so the faction tally matches Crimehub's `aggregations` taxonomy (`success`/`failure`/`critical`) and the two columns are like-for-like.
- **`bin/vendor-crimehub-graphs.mjs`** (new, one-time/occasional) — fetch all `assets/json/<slug>_{paths,checks}.json` + scrape the role-order table from Crimehub's bundle, trim story/coords, write `server/data/crimehub-graphs.json` (+ role table). Re-run to refresh. Skips 404 crimes; URL-encodes accented slugs.
- **endpoint wiring** in `routes.js` / `oc-spawn.js`; column rendering in `oc-spawn-assistance.user.js`.

Rationale for server-centric: matches the existing `/api/oc/*` pattern, caches once for all users, keeps the (apiKey-less) Firestore fetch + ~250 KB graph JSON out of the userscript, and makes the calc a unit-testable pure function. Computation is for the **actual assigned slots** (not interactive sliders), so no client-side recompute is needed.

## Feature [a] — Observed-odds columns

**Endpoint:** `GET /api/oc/observed-odds` (admin-gated, key as siblings). Keyed by crime **name** (the join key across faction store + the table rows). Returns, per crime:
```jsonc
{
  "byName": {
    "Honey Trap": {
      "faction":   { "success": 41, "fail": 7, "total": 49, "rate": 0.837 },  // exact whole-crime success
      "community": { "rate": 0.41, "samples": 14625 }                          // flowchart-derived; null until [b]
    }
  }
}
```
- `faction` ← `aggregateByCrime` over checkpoint-history; whole-crime success = every checkpoint passed (no crit — store is P/F only). Ships first, no external dependency.
- `community` ← `calculateCommunityOutcome`: Crimehub `aggregations` per-checkpoint rates run through the flowchart ([b]). `null` until [b] lands and the node↔crimeid join (plan Task C2) is resolved.

**UI (`oc-spawn-assistance`):** add **"Yours %"** (ships first) and **"Community %"** (after [b]) columns to the Outcome-EV / Hit% table — both whole-crime success-rate. **Distinct** from the existing payout-based **Hit%** column (that's top-quartile payout). Missing data → "—", never breaks the table.

## Feature [b] — Local flowchart model

**Extend the existing `/api/oc/outcome`:** alongside the tornprobability `CalculateSuccess` result, also run `calculateLocalOutcome(scenario, cprs)` on the same slot CPRs and return both:
```jsonc
{
  "successChance": 0.41,          // tornprobability (existing)
  "goodEnding1": 0.18, "...": 0,
  "localSuccessChance": 0.4067,   // NEW — local flowchart model
  "localAvgReward": 7370000,      // NEW (optional)
  "delta": -0.0033,               // NEW — local - tornprobability
  "outcomeSource": "tornprobability" // existing field; local always computed when graph data present
}
```
- Crimes Crimehub hasn't published (the 3 404s) → `localSuccessChance: null` → greyed in UI.
- **UI:** show **"Local %"** next to the existing tornprobability Pass%. A notable `delta` is the divergence signal.

### The ported algorithm (exact — from discovery)

Inputs: `passRates` = `{ roleKey -> passRate (0–100) }`, ordered per the crime's `setRoles` order (`data.roles = Object.values(this.roles)`). warboard feeds each assigned member's per-role success% straight in (Crimehub treats the CPR input directly as pass rate = `passRate/100`); default 50 reproduces Crimehub's baseline.

Graph: `<slug>_checks.json` nodes `{id, point, type∈{start,check,ending}}`; check adds `data.roles` (1–2 role keys); ending adds `data.text` ("Good End #n" starts `G`, "Bad End #n" starts `B`) + `data.rewards.money`. `<slug>_paths.json` edges `{id, origin, target, ...}` where **edge `id` last char encodes the branch**: `…P` = pass (origin's success), `…F` = fail (origin's failure); base origin = `id.slice(0,-1)`. The lone non-P/F edge is "Prelude" (start → `A1-C1`).

```
setMap(nodes, edges):
  map = {}
  for node in nodes sorted by id (numeric-aware localeCompare):
    if node.type == "check":  map[node.id] = {id, sources:[], roles:node.data.roles, occurrenceRate:1}
    if node.type == "ending": map[node.id] = {id, sources:[], text:node.data.text,
                                              money:node.data.rewards?.money, occurrenceRate:1}
    # start node skipped
  for edge in edges: map[edge.target].sources.push(edge.id)
  return map

getSuccessRates(map, roleOrder, passRates):   # roleOrder = Object.values(this.roles) keys
  t = roleOrder.map(k => passRates[k])
  for a in map values (in id-sorted insertion order):
    if a.roles:
      if a.roles.length == 1: a.successRate = t[roleOrder.indexOf(a.roles[0])] / 100
      else:                   a.successRate = (t[roleOrder.indexOf(a.roles[0])]
                                             + t[roleOrder.indexOf(a.roles[1])]) / 200   # AVERAGE
      a.failureRate = 1 - a.successRate
  for a in map values (id-sorted):
    if a.id == "A1-C1": continue                 # first checkpoint pinned occurrenceRate = 1
    a.occurrenceRate = sum over c in a.sources of:
        base = c.slice(0,-1)
        c.endsWith('P') ? map[base].successRate * map[base].occurrenceRate
                        : map[base].failureRate * map[base].occurrenceRate
    # id sort is topological (origin precedes target) so values are ready when read

getOverallSuccessRate(map):
  return sum of map[ending].occurrenceRate for endings where text[0] == 'G'

getAverageReward(map):
  return sum of map[ending].occurrenceRate * ending.money for endings with money
getExpectedReward(map):  # avg conditioned on success
  return getAverageReward(map) / getOverallSuccessRate(map)
```

## Error handling & resilience

- Crimehub Firestore unreachable → serve last-cached `aggregations`; if none cached → community column "—".
- tornprobability down → existing path now *also* returns `localSuccessChance`, so the row still shows a real number (the resilience win, now visible always — not only on failure).
- Vendored graph missing a crime → `localSuccessChance: null` → greyed.
- Firestore typed-JSON + polymorphic `reward_values` (int for money, array of `{id,name,amount}` for items) → one small coercion helper, unit-tested.

## Testing (server-side Node, as my own verification — not pushed into the user's workflow)

- **Golden tests** for `calculateLocalOutcome` against discovery-verified outputs: *honeytrap @ all-CPR-50 → 40.67% success, ~$7.37M avg reward*; *breakthebankv2 @50* reproduces.
- Unit tests for the Firestore typed-JSON coercion + `reward_values` polymorphism + the `crimeid↔typeid` crosswalk build.
- Live-fetch smoke against one `aggregations` doc (asserts `outcomes.success/samples` parse).
- Manual: load OC page, confirm Community%/Yours% columns populate and Local% sits next to tornprobability Pass% with a sane delta.

## Files

- **Create:** `server/crimehub-odds.js`, `server/crimehub-model.js`, `bin/vendor-crimehub-graphs.mjs`, `server/data/crimehub-graphs.json` (vendored), `server/data/crimehub-aggregations-cache.json` (runtime cache), and a Node test script alongside each module (the server has no formal test harness — run with `node`).
- **Modify:** `routes.js` (new `/api/oc/observed-odds`, extend `/api/oc/outcome`), `oc-spawn.js` (call `calculateLocalOutcome`; faction-odds aggregation), `oc-spawn-assistance.user.js` (Community%/Yours%/Local% columns; bump @version + SCRIPT_VERSION).

## Attribution & courtesy

Cache aggressively (≥12 h), descriptive User-Agent on all Crimehub/Firestore requests, read-only (never write Firestore), and credit Crimehub (`crimeshub-2b4b0.web.app`) as the odds + model source in the UI/source comments.
