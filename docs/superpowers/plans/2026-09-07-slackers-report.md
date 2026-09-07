# Slackers Report Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** An admin-only page at `/admin/slackers` ranking faction members by their last-90-day contribution — war hits, chain hits, Xanax, gym energy — with a days-in-faction cutoff.

**Architecture:** A pure model (`slackers-model.js`) does every calculation from local war-history plus a gym-energy snapshot file; a once-a-day poller writes those snapshots; two cookie-gated routes serve the JSON and the page. Nothing is precomputed to disk — the report is built per request, which is microseconds at this size and never stale after a war.

**Tech Stack:** Node 20 ESM, `node --test`, Express router, no runtime dependencies. Plain inline JS/CSS on the page, no CDN.

**Spec:** `docs/superpowers/specs/2026-09-07-slackers-report-design.md`

## Global Constraints

- Faction is `42055`; the model takes it as a parameter, callers pass `"42055"`.
- Window is 90 days; tenure cutoff default 100 days. Both overridable per request.
- War-history stores some wars twice — dedupe on `(enemyFactionId, warStart)`, keeping the entry with non-null `realWarId`.
- `breakdown.non_war` is the chain-hits number. `warHits` is war hits. `xanaxTaken` is war Xanax.
- Gym energy comes from `https://api.torn.com/v2/faction/contributors?stat=gymenergy&cat=current&key=<key>&comment=wb-api`; rows are `{id, username, value, in_faction}` and `value` is cumulative energy SPENT.
- Data files are written by the `warboard` user, never root.
- Admin gate is the existing `_verifyAdminCookie(req)` in `routes.js` (owner 137558, `scope: 'admin'`).
- Never log an API key; last-4 only if a key must be mentioned at all.
- Tests: `node --test` from `/opt/warboard/server`.

---

### Task 1: War selection — dedupe, window, presence

**Files:**
- Create: `server/slackers-model.js`
- Create: `server/slackers-model.test.js`

**Interfaces:**
- Produces: `dedupeWars(wars) -> Array`, `warsInWindow(wars, nowMs, windowDays) -> Array`, `presenceByPlayer(wars) -> Map<string, number>`

- [ ] **Step 1: Write the failing tests**

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { dedupeWars, warsInWindow, presenceByPlayer } from "./slackers-model.js";

const war = (over = {}) => ({
  warKey: "k", realWarId: null, enemyFactionId: 38761, enemyFactionName: "Foe",
  warStart: 1787270000000, capturedAt: 1787279169000, members: [], ...over,
});

test("the same war stored twice collapses to one, keeping the real war id", () => {
  const kept = dedupeWars([
    war({ warKey: "archived_42055_38761_1787279169", capturedAt: 2 }),
    war({ warKey: "47710", realWarId: 47710, capturedAt: 1 }),
  ]);
  assert.equal(kept.length, 1);
  assert.equal(kept[0].realWarId, 47710);
});

test("two different enemies on the same day are two wars", () => {
  const kept = dedupeWars([war({ enemyFactionId: 1 }), war({ enemyFactionId: 2 })]);
  assert.equal(kept.length, 2);
});

test("with no real war id the earliest capture wins", () => {
  const kept = dedupeWars([war({ warKey: "b", capturedAt: 20 }), war({ warKey: "a", capturedAt: 10 })]);
  assert.equal(kept.length, 1);
  assert.equal(kept[0].warKey, "a");
});

test("the window is measured from warStart and sorted oldest first", () => {
  const now = 1788800000000;
  const inside = war({ enemyFactionId: 1, warStart: now - 10 * 86400000 });
  const older = war({ enemyFactionId: 2, warStart: now - 80 * 86400000 });
  const outside = war({ enemyFactionId: 3, warStart: now - 100 * 86400000 });
  const got = warsInWindow([inside, outside, older], now, 90);
  assert.deepEqual(got.map((w) => w.enemyFactionId), [2, 1]);
});

test("presence counts the wars a player appears in, not the wars that happened", () => {
  const wars = [
    war({ enemyFactionId: 1, members: [{ playerId: "1" }, { playerId: "2" }] }),
    war({ enemyFactionId: 2, members: [{ playerId: "1" }] }),
  ];
  const p = presenceByPlayer(wars);
  assert.equal(p.get("1"), 2);
  assert.equal(p.get("2"), 1);
  assert.equal(p.get("3"), undefined);
});
```

- [ ] **Step 2: Run and watch it fail**

Run: `cd /opt/warboard/server && node --test slackers-model.test.js`
Expected: FAIL — cannot find module `./slackers-model.js`.

- [ ] **Step 3: Implement**

```js
export function dedupeWars(wars) {
  const byPair = new Map();
  for (const w of wars || []) {
    const key = `${w.enemyFactionId}|${w.warStart}`;
    const prev = byPair.get(key);
    if (!prev) { byPair.set(key, w); continue; }
    const prevReal = prev.realWarId != null;
    const thisReal = w.realWarId != null;
    if (thisReal && !prevReal) { byPair.set(key, w); continue; }
    if (thisReal === prevReal && (w.capturedAt || 0) < (prev.capturedAt || 0)) byPair.set(key, w);
  }
  return [...byPair.values()];
}

export function warsInWindow(wars, nowMs, windowDays) {
  const cut = nowMs - windowDays * 86400000;
  return dedupeWars(wars)
    .filter((w) => Number(w.warStart) >= cut)
    .sort((a, b) => a.warStart - b.warStart);
}

export function presenceByPlayer(wars) {
  const seen = new Map();
  for (const w of wars || []) {
    for (const m of w.members || []) {
      const id = String(m.playerId);
      seen.set(id, (seen.get(id) || 0) + 1);
    }
  }
  return seen;
}
```

- [ ] **Step 4: Run and watch it pass**

Run: `cd /opt/warboard/server && node --test slackers-model.test.js`
Expected: PASS, 5 tests, no warnings.

- [ ] **Step 5: Sanity-check against the real file**

Run:
```bash
cd /opt/warboard/server && node -e "
import('./slackers-model.js').then(m => {
  const d = JSON.parse(require('fs').readFileSync('data/war-history/42055.json','utf8'));
  const list = Array.isArray(d.wars) ? d.wars : Object.values(d.wars);
  console.log('raw', list.length, 'deduped-in-window', m.warsInWindow(list, Date.now(), 90).length);
});"
```
Expected: `raw 23 deduped-in-window 13` — 13 is the number the spec states.

- [ ] **Step 6: Commit**

```bash
cd /opt/warboard && git add server/slackers-model.js server/slackers-model.test.js
git commit -m "slackers: war selection — dedupe duplicate war records, 90d window, presence"
```

---

### Task 2: The energy column's four modes

**Files:**
- Modify: `server/slackers-model.js`
- Modify: `server/slackers-model.test.js`

**Interfaces:**
- Consumes: nothing from Task 1.
- Produces: `energyForMember(readings, playerId, daysInFaction, nowMs) -> { mode, energy, perDay, spanDays }` where `mode` is `"lifetime" | "partial" | "full" | "rejoined" | "unknown"`, and `readings` is the array from `data/gym-energy/<faction>.json` (`[{ at, members: { [id]: { energy, days } } }]`).

- [ ] **Step 1: Write the failing tests**

```js
import { energyForMember } from "./slackers-model.js";

const DAY = 86400000;
const reading = (at, energy) => ({ at, members: { "1": { energy, days: 500 } } });

test("with no readings at all the mode is unknown and nothing is invented", () => {
  const e = energyForMember([], "1", 500, 1788800000000);
  assert.equal(e.mode, "unknown");
  assert.equal(e.perDay, null);
});

test("under 7 days of history it is the lifetime average since joining", () => {
  const now = 1788800000000;
  const e = energyForMember([reading(now - 2 * DAY, 100000), reading(now, 101000)], "1", 500, now);
  assert.equal(e.mode, "lifetime");
  assert.equal(e.energy, 101000);
  assert.equal(e.perDay, 202);          // 101000 / 500
});

test("between 7 and 90 days it is a true delta over the real span", () => {
  const now = 1788800000000;
  const e = energyForMember([reading(now - 30 * DAY, 100000), reading(now, 130000)], "1", 500, now);
  assert.equal(e.mode, "partial");
  assert.equal(e.energy, 30000);
  assert.equal(e.spanDays, 30);
  assert.equal(e.perDay, 1000);
});

test("at 90 days or more it is the full window and older readings are ignored", () => {
  const now = 1788800000000;
  const e = energyForMember([
    reading(now - 200 * DAY, 1000),      // outside the window entirely
    reading(now - 90 * DAY, 100000),
    reading(now, 190000),
  ], "1", 500, now);
  assert.equal(e.mode, "full");
  assert.equal(e.energy, 90000);
  assert.equal(e.spanDays, 90);
});

test("a drop between readings is a rejoin, and the window restarts after it", () => {
  const now = 1788800000000;
  const e = energyForMember([
    reading(now - 60 * DAY, 500000),
    reading(now - 30 * DAY, 2000),       // left and came back: counter reset
    reading(now, 32000),
  ], "1", 500, now);
  assert.equal(e.mode, "rejoined");
  assert.equal(e.energy, 30000);
  assert.equal(e.spanDays, 30);
});

test("a member missing from a reading does not read as a reset", () => {
  const now = 1788800000000;
  const rs = [reading(now - 30 * DAY, 100000), { at: now - 15 * DAY, members: {} }, reading(now, 130000)];
  const e = energyForMember(rs, "1", 500, now);
  assert.equal(e.mode, "partial");
  assert.equal(e.energy, 30000);
});
```

- [ ] **Step 2: Run and watch it fail**

Run: `cd /opt/warboard/server && node --test slackers-model.test.js`
Expected: FAIL — `energyForMember is not a function`.

- [ ] **Step 3: Implement**

```js
export const ENERGY_MIN_SPAN_DAYS = 7;

/**
 * Torn has no history for gym energy: /v2/faction/contributors reports a
 * cumulative total and its `timestamp` is a cache-buster, not a query. So a
 * windowed figure can only ever be a delta between two readings WE took, and
 * until enough of those exist the honest answer is the lifetime average.
 */
export function energyForMember(readings, playerId, daysInFaction, nowMs, windowDays = 90) {
  const id = String(playerId);
  const mine = (readings || [])
    .filter((r) => r && r.members && r.members[id] && Number.isFinite(Number(r.members[id].energy)))
    .map((r) => ({ at: Number(r.at), energy: Number(r.members[id].energy) }))
    .sort((a, b) => a.at - b.at);

  if (!mine.length) return { mode: "unknown", energy: null, perDay: null, spanDays: 0 };

  const latest = mine[mine.length - 1];
  const cut = nowMs - windowDays * 86400000;

  // A counter that went DOWN means the membership restarted — leaving and
  // rejoining resets contributors to zero. Anything before that drop belongs
  // to a different membership and cannot be subtracted from this one.
  let startIdx = 0;
  let rejoined = false;
  for (let i = 1; i < mine.length; i++) {
    if (mine[i].energy < mine[i - 1].energy) { startIdx = i; rejoined = true; }
  }

  // Oldest reading still inside the window (never older than a reset).
  let base = mine[startIdx];
  for (let i = startIdx; i < mine.length; i++) {
    if (mine[i].at >= cut) { base = mine[i]; break; }
    base = mine[i];
  }
  if (base.at < cut && !rejoined) {
    const inWindow = mine.filter((r) => r.at >= cut);
    if (inWindow.length) base = inWindow[0];
  }

  const spanDays = Math.round((latest.at - base.at) / 86400000);
  const days = Number(daysInFaction) || 0;

  if (spanDays < ENERGY_MIN_SPAN_DAYS) {
    return {
      mode: "lifetime",
      energy: latest.energy,
      perDay: days > 0 ? Math.round(latest.energy / days) : null,
      spanDays,
    };
  }

  const energy = latest.energy - base.energy;
  return {
    mode: rejoined ? "rejoined" : (spanDays >= windowDays ? "full" : "partial"),
    energy,
    perDay: spanDays > 0 ? Math.round(energy / spanDays) : null,
    spanDays,
  };
}
```

- [ ] **Step 4: Run and watch it pass**

Run: `cd /opt/warboard/server && node --test slackers-model.test.js`
Expected: PASS, 11 tests.

- [ ] **Step 5: Commit**

```bash
cd /opt/warboard && git add server/slackers-model.js server/slackers-model.test.js
git commit -m "slackers: gym-energy column — lifetime average until snapshots span real time"
```

---

### Task 3: Rows, medians and the flag rule

**Files:**
- Modify: `server/slackers-model.js`
- Modify: `server/slackers-model.test.js`

**Interfaces:**
- Consumes: `warsInWindow`, `presenceByPlayer`, `energyForMember`.
- Produces:
  - `buildReport({ wars, roster, readings, nowMs, windowDays = 90, minDays = 100 })` → `{ rows, medians, warsCounted, cohortSize, formerMembers, generatedAt, windowDays, minDays }`
  - `row` = `{ playerId, name, level, position, daysInFaction, eligible, warsPresent, warHits, chainHits, xanax, warHitsPerWar, chainHitsPerWar, xanaxPerWar, energy, flagged, reasons }`
  - `roster` = `[{ playerId, name, level, position, daysInFaction }]`
  - `METRICS` = the four metric keys in display order.

- [ ] **Step 1: Write the failing tests**

```js
import { buildReport, METRICS } from "./slackers-model.js";

const NOW = 1788800000000;
const DAY = 86400000;
const mkWar = (enemy, members) => ({
  warKey: String(enemy), realWarId: enemy, enemyFactionId: enemy, enemyFactionName: "E" + enemy,
  warStart: NOW - 10 * DAY, capturedAt: NOW - 9 * DAY, members,
});
const mkMember = (id, warHits, nonWar, xan) => ({
  playerId: id, name: "P" + id, warHits, xanaxTaken: xan, breakdown: { non_war: nonWar },
});
const mkRoster = (ids, days = 400) => ids.map((id) => ({
  playerId: id, name: "P" + id, level: 50, position: "Member", daysInFaction: days,
}));

test("totals are not doubled by a war stored twice", () => {
  const w = mkWar(11, [mkMember("1", 10, 2, 1)]);
  const dup = { ...w, warKey: "archived_42055_11_x", realWarId: null };
  const r = buildReport({ wars: [w, dup], roster: mkRoster(["1"]), readings: [], nowMs: NOW });
  assert.equal(r.warsCounted, 1);
  assert.equal(r.rows[0].warHits, 10);
});

test("a member who missed wars is rated per war present, not per war fought", () => {
  const wars = [mkWar(11, [mkMember("1", 30, 0, 3), mkMember("2", 10, 0, 1)]),
                mkWar(12, [mkMember("1", 30, 0, 3)])];
  const r = buildReport({ wars, roster: mkRoster(["1", "2"]), readings: [], nowMs: NOW });
  const two = r.rows.find((x) => x.playerId === "2");
  assert.equal(two.warsPresent, 1);
  assert.equal(two.warHits, 10);
  assert.equal(two.warHitsPerWar, 10);
});

test("someone below half the median on two metrics is flagged, on one is not", () => {
  const members = [
    mkMember("1", 100, 20, 10), mkMember("2", 100, 20, 10), mkMember("3", 100, 20, 10),
    mkMember("4", 10, 1, 10),     // war hits + chain hits both far below
    mkMember("5", 10, 20, 10),    // only war hits below
  ];
  const r = buildReport({ wars: [mkWar(11, members)], roster: mkRoster(["1","2","3","4","5"]), readings: [], nowMs: NOW });
  assert.equal(r.rows.find((x) => x.playerId === "4").flagged, true);
  assert.equal(r.rows.find((x) => x.playerId === "5").flagged, false);
});

test("a metric whose median is zero cannot flag anyone", () => {
  const members = [mkMember("1", 100, 0, 10), mkMember("2", 100, 0, 10), mkMember("3", 4, 0, 10)];
  const r = buildReport({ wars: [mkWar(11, members)], roster: mkRoster(["1","2","3"]), readings: [], nowMs: NOW });
  const three = r.rows.find((x) => x.playerId === "3");
  assert.equal(three.reasons.includes("chainHitsPerWar"), false);
});

test("a member in no wars is flagged and never divides by zero", () => {
  const r = buildReport({ wars: [mkWar(11, [mkMember("1", 50, 5, 5)])], roster: mkRoster(["1", "9"]), readings: [], nowMs: NOW });
  const nine = r.rows.find((x) => x.playerId === "9");
  assert.equal(nine.warsPresent, 0);
  assert.equal(nine.warHitsPerWar, 0);
  assert.equal(nine.flagged, true);
  assert.ok(nine.reasons.includes("no-wars"));
});

test("under the cutoff is carried but not eligible, and not in the medians", () => {
  const members = [mkMember("1", 100, 10, 10), mkMember("2", 100, 10, 10), mkMember("3", 2, 0, 0)];
  const roster = [...mkRoster(["1", "2"]), ...mkRoster(["3"], 30)];
  const r = buildReport({ wars: [mkWar(11, members)], roster, readings: [], nowMs: NOW });
  const three = r.rows.find((x) => x.playerId === "3");
  assert.equal(three.eligible, false);
  assert.equal(three.flagged, false);
  assert.equal(r.cohortSize, 2);
  assert.equal(r.medians.warHitsPerWar, 100);
});

test("someone who fought but has left the faction is not a row", () => {
  const r = buildReport({ wars: [mkWar(11, [mkMember("1", 50, 5, 5), mkMember("gone", 1, 0, 0)])],
                          roster: mkRoster(["1"]), readings: [], nowMs: NOW });
  assert.equal(r.rows.length, 1);
  assert.equal(r.formerMembers, 1);
});

test("the four metrics are the ones the page renders", () => {
  assert.deepEqual(METRICS, ["warHitsPerWar", "chainHitsPerWar", "xanaxPerWar", "energyPerDay"]);
});
```

- [ ] **Step 2: Run and watch it fail**

Run: `cd /opt/warboard/server && node --test slackers-model.test.js`
Expected: FAIL — `buildReport is not a function`.

- [ ] **Step 3: Implement**

```js
export const METRICS = ["warHitsPerWar", "chainHitsPerWar", "xanaxPerWar", "energyPerDay"];
export const FLAG_FRACTION = 0.5;   // "below half the median"
export const FLAG_MIN_METRICS = 2;  // on two or more of them

export function median(values) {
  const v = values.filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
  if (!v.length) return 0;
  const mid = Math.floor(v.length / 2);
  return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
}

export function buildReport({ wars, roster, readings, nowMs, windowDays = 90, minDays = 100 }) {
  const kept = warsInWindow(wars, nowMs, windowDays);
  const presence = presenceByPlayer(kept);

  const totals = new Map();
  for (const w of kept) {
    for (const m of w.members || []) {
      const id = String(m.playerId);
      const t = totals.get(id) || { warHits: 0, chainHits: 0, xanax: 0 };
      t.warHits += Number(m.warHits) || 0;
      t.chainHits += Number(m.breakdown?.non_war) || 0;
      t.xanax += Number(m.xanaxTaken) || 0;
      totals.set(id, t);
    }
  }

  const rosterIds = new Set((roster || []).map((r) => String(r.playerId)));
  let formerMembers = 0;
  for (const id of totals.keys()) if (!rosterIds.has(id)) formerMembers++;

  const rows = (roster || []).map((r) => {
    const id = String(r.playerId);
    const t = totals.get(id) || { warHits: 0, chainHits: 0, xanax: 0 };
    const present = presence.get(id) || 0;
    const per = (n) => (present > 0 ? Math.round((n / present) * 10) / 10 : 0);
    const energy = energyForMember(readings, id, r.daysInFaction, nowMs, windowDays);
    return {
      playerId: id,
      name: r.name,
      level: r.level ?? null,
      position: r.position ?? "",
      daysInFaction: Number(r.daysInFaction) || 0,
      eligible: (Number(r.daysInFaction) || 0) >= minDays,
      warsPresent: present,
      warHits: t.warHits,
      chainHits: t.chainHits,
      xanax: t.xanax,
      warHitsPerWar: per(t.warHits),
      chainHitsPerWar: per(t.chainHits),
      xanaxPerWar: per(t.xanax),
      energy,
      energyPerDay: energy.perDay,
      flagged: false,
      reasons: [],
    };
  });

  const cohort = rows.filter((r) => r.eligible);
  const medians = {};
  for (const k of METRICS) medians[k] = median(cohort.map((r) => r[k]));

  // A metric whose median is zero is dropped: "below half of zero" is
  // unreachable, so leaving it in would let it silently absorb one of the two
  // strikes a flag needs.
  const live = METRICS.filter((k) => medians[k] > 0);
  const need = Math.min(FLAG_MIN_METRICS, live.length || 1);

  for (const r of cohort) {
    if (r.warsPresent === 0) { r.flagged = true; r.reasons = ["no-wars"]; continue; }
    const below = live.filter((k) => Number(r[k] ?? 0) < medians[k] * FLAG_FRACTION);
    r.reasons = below;
    r.flagged = live.length > 0 && below.length >= need;
  }

  return {
    rows, medians, warsCounted: kept.length, cohortSize: cohort.length,
    formerMembers, windowDays, minDays, generatedAt: nowMs,
    wars: kept.map((w) => ({
      enemyFactionId: w.enemyFactionId, enemyFactionName: w.enemyFactionName,
      warStart: w.warStart, warResult: w.warResult ?? null,
    })),
  };
}
```

- [ ] **Step 4: Run and watch it pass**

Run: `cd /opt/warboard/server && node --test slackers-model.test.js`
Expected: PASS, 19 tests.

- [ ] **Step 5: Commit**

```bash
cd /opt/warboard && git add server/slackers-model.js server/slackers-model.test.js
git commit -m "slackers: rows, cohort medians and the below-half-median flag rule"
```

---

### Task 4: The daily gym-energy snapshot

**Files:**
- Create: `server/gym-energy-snapshot.js`
- Modify: `server/store.js` — `PURPOSE_REQUIRED_SELECTION` (around line 768)
- Modify: `server/server.js` — start the poller beside the other `import(...).then(m => m.start())` calls (around line 873)

**Interfaces:**
- Produces: `start()`, `snapshotOnce(factionId)`, `readSnapshots(factionId) -> Array<{at, members}>`
- Data file: `server/data/gym-energy/<factionId>.json` = `{ factionId, readings: [{ at, members: { [id]: { energy, days } } }] }`

- [ ] **Step 1: Add the pool-key routing entry**

In `server/store.js`, inside `PURPOSE_REQUIRED_SELECTION`:

```js
  "gym-energy":    "contributors",
```

Without it the router hands this purpose keys that cannot serve contributors and pm2 fills with Torn code 16.

- [ ] **Step 2: Write the poller**

```js
// Gym energy is the one number in the slackers report that Torn will not hand
// over historically: /v2/faction/contributors reports a cumulative total and
// its `timestamp` parameter is a cache-buster, not a query. So the history has
// to be ours — one reading a day, kept for 400 days, and the report subtracts
// two of them. Until enough readings exist the report says "avg since joining"
// rather than inventing a window.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as store from "./store.js";
import { fetchFactionBasic } from "./torn-api.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIR = path.join(__dirname, "data", "gym-energy");
const RETAIN_DAYS = 400;
const INTERVAL_MS = 24 * 60 * 60 * 1000;
const FACTION = "42055";

function fileFor(factionId) { return path.join(DIR, `${factionId}.json`); }

export function readSnapshots(factionId) {
  try {
    const raw = JSON.parse(fs.readFileSync(fileFor(factionId), "utf8"));
    return Array.isArray(raw.readings) ? raw.readings : [];
  } catch (_) { return []; }
}

function writeSnapshots(factionId, readings) {
  if (!fs.existsSync(DIR)) fs.mkdirSync(DIR, { recursive: true });
  const cut = Date.now() - RETAIN_DAYS * 86400000;
  const kept = readings.filter((r) => Number(r.at) >= cut);
  fs.writeFileSync(fileFor(factionId), JSON.stringify({ factionId: String(factionId), readings: kept }));
}

async function fetchContributors(factionId, apiKey) {
  const url = `https://api.torn.com/v2/faction/contributors?stat=gymenergy&cat=current`
            + `&key=${encodeURIComponent(apiKey)}&comment=wb-api`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`contributors HTTP ${res.status}`);
  const data = await res.json();
  if (data.error) {
    const err = new Error(`Torn API error: ${data.error.error} (code ${data.error.code})`);
    err.code = data.error.code;
    throw err;
  }
  const c = data.contributors;
  if (!c) return [];
  // Tolerate the object-keyed shape as well as the documented array.
  const rows = Array.isArray(c)
    ? c
    : Object.keys(c).map((k) => ({ id: c[k].id ?? k, value: c[k].value, in_faction: c[k].in_faction }));
  return rows.filter((r) => r.in_faction !== false);
}

export async function snapshotOnce(factionId = FACTION) {
  const apiKey = store.getPollingKey(factionId, "gym-energy");
  if (!apiKey) return { ok: false, reason: "no-key" };
  let rows, basic;
  try {
    rows = await fetchContributors(factionId, apiKey);
    basic = await fetchFactionBasic(factionId, apiKey);
  } catch (err) {
    // A key whose key/info claims `contributors` can still refuse it. Demote it
    // so the router stops picking it, the way chain and xanax-tracker do.
    if (err.code === 16) store.demotePoolKeySelection(apiKey, factionId, "contributors");
    console.error(`[gym-energy] snapshot failed: ${err.message}`);
    return { ok: false, reason: err.message };
  }
  const days = {};
  for (const [id, m] of Object.entries(basic?.members || {})) days[String(id)] = Number(m.days_in_faction) || 0;

  const members = {};
  for (const r of rows) {
    const id = String(r.id);
    members[id] = { energy: Number(r.value) || 0, days: days[id] ?? 0 };
  }
  const readings = readSnapshots(factionId);
  readings.push({ at: Date.now(), members });
  writeSnapshots(factionId, readings);
  return { ok: true, members: Object.keys(members).length };
}

export function start() {
  // One reading a day is all a 90-day window needs, and contributors is one
  // call per stat — this is two API calls a day in total.
  snapshotOnce().catch(() => {});
  setInterval(() => { snapshotOnce().catch(() => {}); }, INTERVAL_MS);
}
```

- [ ] **Step 3: Wire it into the server**

In `server/server.js`, beside the existing poller starts:

```js
import('./gym-energy-snapshot.js').then(m => m.start()).catch(e => {
  console.error('[gym-energy] failed to start:', e.message);
});
```

- [ ] **Step 4: Verify it runs and writes**

Run:
```bash
cd /opt/warboard/server && node -e "
import('./gym-energy-snapshot.js').then(async m => {
  console.log(await m.snapshotOnce('42055'));
  console.log('readings', m.readSnapshots('42055').length);
});"
```
Expected: `{ ok: true, members: <n> }` with n ≈ the faction size, then `readings 1`.
Then confirm ownership is `warboard`, not root — a root-owned data file makes the
server's own write fail with EACCES and the failure is swallowed:
```bash
ls -l /opt/warboard/server/data/gym-energy/42055.json
sudo chown warboard:warboard /opt/warboard/server/data/gym-energy/42055.json
```

- [ ] **Step 5: Commit**

```bash
cd /opt/warboard && git add server/gym-energy-snapshot.js server/store.js server/server.js
git commit -m "slackers: daily gym-energy snapshot, the one thing Torn won't backfill"
```

---

### Task 5: The admin-gated JSON route

**Files:**
- Modify: `server/routes.js` — add beside the other `/admin/*` routes

**Interfaces:**
- Consumes: `buildReport` (Task 3), `readSnapshots` (Task 4), `_verifyAdminCookie` (already in routes.js), `fetchFactionBasic` (torn-api.js), `store.getPollingKey`.
- Produces: `GET /api/admin/slackers?minDays=&windowDays=` → the `buildReport` payload plus `{ roster: { stale, at } }`.

- [ ] **Step 1: Add the route**

```js
// ── GET /api/admin/slackers ───────────────────────────────────────────
// The numbers behind /admin/slackers. This is the gate that matters — the
// page itself is only markup, the member-by-member figures are here.
let _slackersRoster = { at: 0, members: [] };
router.get("/api/admin/slackers", async (req, res) => {
  if (!_verifyAdminCookie(req)) return res.status(401).json({ error: "Admin login required" });
  const factionId = "42055";
  const minDays = Math.max(0, Number(req.query.minDays ?? 100) || 0);
  const windowDays = Math.max(1, Number(req.query.windowDays ?? 90) || 90);

  let wars = [];
  try {
    const raw = JSON.parse(fs.readFileSync(
      path.join(__dirname, "data", "war-history", `${factionId}.json`), "utf8"));
    wars = Array.isArray(raw.wars) ? raw.wars : Object.values(raw.wars || {});
  } catch (err) {
    return res.status(500).json({ error: `war history unreadable: ${err.message}` });
  }

  // Roster is cached for an hour: it moves slowly, and a failed refresh must
  // not blank the page — a stale roster with a banner beats no report.
  let rosterStale = false;
  if (Date.now() - _slackersRoster.at > 3600_000) {
    try {
      const key = store.getPollingKey(factionId, "war-status");
      const basic = await fetchFactionBasic(factionId, key);
      _slackersRoster = {
        at: Date.now(),
        members: Object.entries(basic?.members || {}).map(([id, m]) => ({
          playerId: String(id), name: m.name, level: m.level ?? null,
          position: m.position ?? "", daysInFaction: Number(m.days_in_faction) || 0,
        })),
      };
    } catch (err) {
      rosterStale = true;
      if (!_slackersRoster.members.length) {
        return res.status(502).json({ error: `roster unavailable: ${err.message}` });
      }
    }
  }

  const readings = gymEnergy.readSnapshots(factionId);
  const report = slackers.buildReport({
    wars, roster: _slackersRoster.members, readings,
    nowMs: Date.now(), windowDays, minDays,
  });
  res.json({ ...report, roster: { stale: rosterStale, at: _slackersRoster.at } });
});
```

Add the imports at the top of `routes.js` alongside the existing ones:

```js
import * as slackers from "./slackers-model.js";
import * as gymEnergy from "./gym-energy-snapshot.js";
```

(`fs`, `path`, `__dirname`, `store` and `fetchFactionBasic` are already imported there — check before adding duplicates.)

- [ ] **Step 2: Verify the gate and the payload**

Run:
```bash
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3000/api/admin/slackers
```
Expected: `401` — no cookie, no numbers.

- [ ] **Step 3: Commit**

```bash
cd /opt/warboard && git add server/routes.js
git commit -m "slackers: admin-gated JSON route"
```

---

### Task 6: The page

**Files:**
- Create: `server/slackers-page.js` — exports `renderSlackersPage()` returning the HTML string
- Modify: `server/routes.js` — `GET /admin/slackers`

**Interfaces:**
- Consumes: `GET /api/admin/slackers` (Task 5).
- Produces: `renderSlackersPage()` → string.

- [ ] **Step 1: Add the page route**

```js
// ── GET /admin/slackers ───────────────────────────────────────────────
router.get("/admin/slackers", (req, res) => {
  if (!_verifyAdminCookie(req)) return res.redirect(302, "/admin");
  res.set("Content-Type", "text/html; charset=utf-8");
  res.send(renderSlackersPage());
});
```

- [ ] **Step 2: Build the page**

One file, no dependencies, no CDN. Structure:

1. **Header** — "Slackers", the window ("13 wars · last 90 days"), generated time, and a staleness banner when `roster.stale` is true.
2. **Summary strip** — members assessed, wars counted, flagged count, median war hits/war.
3. **Controls** — a range input for the tenure cutoff (0–400, default 100, live label "100+ days"), a window select (30/60/90 days) that refetches, and a "copy list" button that puts the flagged block on the clipboard as plain text.
4. **The conversation list** — one card per flagged member, worst first: name + id, days in faction, then the line `9 of 13 wars · 4.1 hits/war · 12 chain hits · 0 xanax · 180 e/day`, then the reasons rendered as human words ("below half-median on war hits, xanax").
5. **The table** — every member, sortable on click by any column: member, days, wars present, war hits (total · per war), chain hits, xanax, energy, flags. Rows under the cutoff are dimmed and excluded from medians, not hidden, so moving the slider reveals them in place.

Behaviour:
- Fetch once on load with `credentials: "same-origin"`; on 401 replace the body with a link to `/admin`.
- Cutoff slider re-filters and **re-computes medians and flags in the browser** from the same payload — the server sends every member, so the control needs no round trip. Port `median`, `METRICS`, `FLAG_FRACTION` and the zero-median rule as a small inline function; the payload's own `medians` are used only for the initial 100-day view.
- Energy cell shows the number plus a mode tag: `avg/day since joining`, `last 34 days`, `last 90 days`, `since rejoining`, or `—` when unknown.

Visual direction (spec's design section, made concrete):
- Tokens on `:root` for light, redefined under both `@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) }` and `:root[data-theme="dark"]`; `body` paints an explicit token background.
- Palette: slate ground `#eef1f5` / `#10141a`, panels `#ffffff` / `#171d25`, ink `#151a21` / `#e6ebf2`, muted `#5d6875` / `#94a1b1`, hairline `#e0e5ec` / `#242c36`. One warm accent for attention only — `#b4541f` light / `#e2874a` dark — used for flags and below-median cells and nothing else. A single cool `#2f5d8a` / `#6aa6dd` for links and the sorted-column marker.
- Type: system stack for body; one display face for the h1 via `@font-face`-free Google Fonts link (`Fraunces`, 700, with `Georgia, serif` fallback). `font-variant-numeric: tabular-nums` on every numeric cell.
- Table: sticky header, sticky first column, `overflow-x:auto` on its own wrapper so the body never scrolls sideways.
- `prefers-reduced-motion` respected; focus states visible on the slider, buttons and sortable headers.

- [ ] **Step 3: Verify**

```bash
cd /opt/warboard/server && node --check slackers-page.js && node --check routes.js
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3000/admin/slackers   # expect 302
```

- [ ] **Step 4: Deploy and smoke-test**

```bash
pm2 reload warboard && sleep 3 && pm2 logs warboard --lines 20 --nostream
curl -s -o /dev/null -w '%{http_code}\n' https://tornwar.com/admin/slackers      # expect 302
```
Then open `https://tornwar.com/admin/slackers` in a logged-in browser and confirm:
rows render, the slider moves the cohort, sorting works, and the energy column
reads "avg/day since joining" on day one.

- [ ] **Step 5: Commit**

```bash
cd /opt/warboard && git add server/slackers-page.js server/routes.js
git commit -m "slackers: the page — conversation cards, sortable table, live tenure cutoff"
```

---

## Self-review

**Spec coverage:** dedupe → Task 1. Presence → Task 1. Energy modes incl. rejoin → Task 2. Medians/flags/zero-median → Task 3. Cutoff → Task 3 (server) + Task 6 (live). Snapshot poller + pool routing + demote-on-16 → Task 4. Admin gate on both surfaces → Tasks 5, 6. Roster staleness and former members → Tasks 3, 5. Page design → Task 6. Tests → Tasks 1–3.

**Not covered by a task, deliberately:** co-leader access, non-war Xanax, true chain reports — all listed out of scope in the spec.

**Type consistency:** `energyForMember` returns `{mode, energy, perDay, spanDays}`; rows expose it as `row.energy` (the object) and `row.energyPerDay` (the number the medians use). `METRICS` names match row keys exactly.
