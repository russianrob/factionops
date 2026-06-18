# Stakeout Server-Side Push — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an always-on server-side watcher that polls each user's watched Stakeout targets, edge-detects with the userscript's own engine, and pushes a real notification (APNs / FCM / Web Push) even when the app or tab is fully closed.

**Architecture:** A new `stakeout-store.js` (per-owner watch list + edge-state persistence) and `stakeout-watcher.js` (a 30s poller that loads the existing `torn-stakeout.user.js` engine via `vm`, edge-detects like `price-watcher.js`, and fans out via the existing `push.sendToPlayers`). A new `POST /api/stakeout/sync` route mirrors the watch list up from the script. The watcher is gated behind an env flag (`STAKEOUT_WATCHER=1`, default OFF) so sync + storage ship with zero API spend until detection is switched on. v1 is owner-only (faction 42055), enforced naturally by the faction-locked `/api/auth`.

**Tech Stack:** Node ESM (`server/` is `"type":"module"`), Express, `node:test` + `node:assert/strict`, `node:vm` (engine load), the existing `push-notifications.js` orchestrator (Web Push + FCM + APNs), `store.js` (encrypted per-player keys).

**Design reference:** `docs/superpowers/specs/2026-06-18-stakeout-server-push-design.md`

### Corrections to the spec baked into this plan
- **Engine load = `vm`, NOT `require()`.** `server/package.json` is `"type":"module"`, so the engine's CJS `module.exports` cannot be `require()`d (it would parse as ESM and crash on `document`). Load it with `vm.runInNewContext` and a `{module:{exports:{}}}` sandbox, exactly like `test/stakeout.test.mjs:6-11`.
- **`threadId` needs no new code.** `apns.js:302` already maps `payload.threadId` → `aps["thread-id"]`. Just set it on the payload.
- **`isTypeEnabled` is not exported** (`push-notifications.js:152` is module-local). Preference-gating tests assert via the exported `NOTIFICATION_TYPES` + `getPreferences()` surface; runtime gating happens inside `sendToPlayers` automatically.
- **`/api/auth` is faction-locked** (`routes.js:1277`) to faction 42055 + factionops partners. That is exactly the owner-only v1 boundary. Widening Stakeout push to arbitrary Greasy Fork users later needs a non-faction-locked auth path — explicitly out of scope here.

---

## File Structure

**Create:**
- `server/stakeout-store.js` — pure validation (`validateStakeoutSync`), persistence of `data/stakeout-watchers.json`, and the `replaceOwnerWatchlist` mutator (merge owner membership, preserve per-target edge-state, GC empty targets). One responsibility: the watch-list data model.
- `server/stakeout-watcher.js` — loads the engine via `vm`; `evaluateTarget` (edge-detect + cooldown + seed); `buildStakeoutPayload` + `humanTrigger` + `notifyStakeoutAlert` (delivery); `runPoll` + `_fetchTorn` + `startWatcher`/`stopWatcher` (the poll loop). One responsibility: detection + delivery.
- `server/stakeout-store.test.js`, `server/stakeout-watcher.test.js`, `server/stakeout-engine-parity.test.js` — tests.

**Modify:**
- `server/push-notifications.js:38-54` — register the `stakeout_alert` notification type.
- `server/routes.js` — add `POST /api/stakeout/sync` (mirror the authed-route pattern at `routes.js:1883`).
- `server/server.js` — mount the rate limiter (~`server.js:213-216`), load the store + conditionally start the watcher (~`server.js:590`), stop it in `shutdown()` (~`server.js:838`).
- `server/public/scripts/torn-stakeout.user.js` — add `@connect tornwar.com`, a `syncUp()` (auth handshake → `POST /api/stakeout/sync`), trigger it on change + heartbeat, bump `@version` + `SCRIPT_VERSION`.

**Module constants (define once in `stakeout-watcher.js`):**
```js
export const POLL_INTERVAL_MS = 30_000;          // 30s, aligned to Torn's ~30s API cache
export const COOLDOWN_MS = 30 * 60_000;          // 30 min per-subscriber-per-trigger
```
**In `stakeout-store.js`:**
```js
export const MAX_PLAYERS_PER_OWNER = 100;
export const MAX_FACTIONS_PER_OWNER = 100;
```

---

## Task 1: `validateStakeoutSync` — normalize the sync body

**Files:**
- Create: `server/stakeout-store.js`
- Test: `server/stakeout-store.test.js`

The pure function that turns an untrusted request body into `{ players:[{id,label,alerts}], factions:[{id,alerts}] }` with the cached `info` and the secret `apiKey` stripped, tri-state alerts normalized, ids coerced to positive ints, over-cap entries dropped.

- [ ] **Step 1: Write the failing test**

Create `server/stakeout-store.test.js`:
```js
import test from "node:test";
import assert from "node:assert/strict";
import { validateStakeoutSync } from "./stakeout-store.js";

test("validateStakeoutSync: strips info + apiKey, keeps id/label/alerts", () => {
  const out = validateStakeoutSync({
    players: [{ id: "2194491", label: "rob", info: { name: "x" }, apiKey: "SECRET",
                alerts: { online: true, hospital: true, life: 25, bogus: 9 } }],
    factions: [{ id: 16335, info: {}, alerts: { rankedWarStarts: true, chainReaches: 0 } }],
  });
  assert.deepEqual(out.players, [
    { id: 2194491, label: "rob", alerts: { online: true, hospital: true, life: 25 } },
  ]);
  assert.deepEqual(out.factions, [
    { id: 16335, alerts: { rankedWarStarts: true, chainReaches: 0 } },
  ]);
});

test("validateStakeoutSync: drops bad ids, defaults arrays, caps length", () => {
  const players = Array.from({ length: 130 }, (_, i) => ({ id: i + 1, alerts: { online: true } }));
  const out = validateStakeoutSync({ players });
  assert.equal(out.players.length, 100);
  assert.deepEqual(out.factions, []);
  assert.deepEqual(validateStakeoutSync({ players: [{ id: "nope", alerts: {} }] }).players, []);
});

test("validateStakeoutSync: tri-state — false stays false, number stays, junk threshold -> false", () => {
  const out = validateStakeoutSync({
    players: [{ id: 5, alerts: { online: "yes", life: "bad", offline: 5, okay: false } }],
  });
  assert.deepEqual(out.players[0].alerts, { online: true, life: false, offline: 5, okay: false });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /opt/warboard/server && node --test stakeout-store.test.js`
Expected: FAIL — `Cannot find module './stakeout-store.js'` / `validateStakeoutSync is not a function`.

- [ ] **Step 3: Write the minimal implementation**

Create `server/stakeout-store.js`:
```js
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

export const MAX_PLAYERS_PER_OWNER = 100;
export const MAX_FACTIONS_PER_OWNER = 100;

const PLAYER_ALERT_KEYS = ["okay", "hospital", "landing", "online", "life", "offline", "revivable"];
const FACTION_ALERT_KEYS = ["chainReaches", "memberCountDrops", "rankedWarStarts", "inRaid", "inTerritoryWar"];
const PLAYER_THRESHOLD_KEYS = new Set(["life", "offline"]);
const FACTION_THRESHOLD_KEYS = new Set(["chainReaches", "memberCountDrops"]);

function normAlerts(raw, keys, thresholdKeys) {
  const out = {};
  if (!raw || typeof raw !== "object") return out;
  for (const k of keys) {
    if (!(k in raw)) continue;
    const v = raw[k];
    if (thresholdKeys.has(k)) {
      if (v === false) out[k] = false;
      else if (typeof v === "number" && Number.isFinite(v) && v >= 0) out[k] = v;
      else out[k] = false;
    } else {
      out[k] = !!v;
    }
  }
  return out;
}

function normList(raw, keys, thresholdKeys, cap) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const id = Number(entry.id);
    if (!Number.isInteger(id) || id <= 0) continue;
    const rec = { id, alerts: normAlerts(entry.alerts, keys, thresholdKeys) };
    if (typeof entry.label === "string") rec.label = entry.label;
    out.push(rec);
    if (out.length >= cap) break;
  }
  return out;
}

export function validateStakeoutSync(body) {
  const b = body && typeof body === "object" ? body : {};
  return {
    players: normList(b.players, PLAYER_ALERT_KEYS, PLAYER_THRESHOLD_KEYS, MAX_PLAYERS_PER_OWNER)
      .map((r) => (r.label === undefined ? { id: r.id, alerts: r.alerts } : { id: r.id, label: r.label, alerts: r.alerts })),
    factions: normList(b.factions, FACTION_ALERT_KEYS, FACTION_THRESHOLD_KEYS, MAX_FACTIONS_PER_OWNER)
      .map((r) => ({ id: r.id, alerts: r.alerts })),
  };
}
```
> Note: the first test expects player key order `{ id, label, alerts }`; the `.map` above produces exactly that. Faction records never carry `label`.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /opt/warboard/server && node --test stakeout-store.test.js`
Expected: PASS — 3 tests, 0 fail.

- [ ] **Step 5: Commit**

```bash
cd /opt/warboard && git add server/stakeout-store.js server/stakeout-store.test.js
git commit -m "feat(stakeout): add validateStakeoutSync watch-list normalizer

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: store persistence — lazy DATA_DIR, load/save/getState

**Files:**
- Modify: `server/stakeout-store.js`
- Test: `server/stakeout-store.test.js`

State shape: `{ players: { <id>: { subscribers, info, seeded } }, factions: { ... } }`. The data-dir is read **at call time** so a test can set `process.env.DATA_DIR` before calling `load()` (ESM hoists imports, so a load-time constant can't be overridden).

- [ ] **Step 1: Write the failing test**

Append to `server/stakeout-store.test.js`:
```js
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join as pathJoin } from "node:path";
import { load, getState, _saveNow } from "./stakeout-store.js";

test("store: load on empty dir yields empty maps; save round-trips", () => {
  process.env.DATA_DIR = mkdtempSync(pathJoin(tmpdir(), "stk-"));
  load();
  assert.deepEqual(getState(), { players: {}, factions: {} });
  getState().players["5"] = { subscribers: {}, info: null, seeded: false };
  _saveNow();
  load();
  assert.deepEqual(Object.keys(getState().players), ["5"]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /opt/warboard/server && node --test stakeout-store.test.js`
Expected: FAIL — `load`/`getState`/`_saveNow` are not exported.

- [ ] **Step 3: Write the minimal implementation**

Add to `server/stakeout-store.js`:
```js
function dataFile() {
  const dir = process.env.DATA_DIR || join(__dirname, "data");
  return { dir, file: join(dir, "stakeout-watchers.json") };
}

let _state = { players: {}, factions: {} };
let _saveTimer = null;

export function getState() { return _state; }

export function load() {
  try {
    const { file } = dataFile();
    if (existsSync(file)) {
      const parsed = JSON.parse(readFileSync(file, "utf8"));
      _state = {
        players: (parsed && parsed.players) || {},
        factions: (parsed && parsed.factions) || {},
      };
    } else {
      _state = { players: {}, factions: {} };
    }
  } catch (e) {
    console.warn("[stakeout-store] load failed:", e.message);
    _state = { players: {}, factions: {} };
  }
  const n = Object.keys(_state.players).length + Object.keys(_state.factions).length;
  console.log(`[stakeout-store] loaded ${n} watched target(s)`);
  return _state;
}

export function _saveNow() {
  try {
    const { dir, file } = dataFile();
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(file, JSON.stringify(_state, null, 2), "utf8");
  } catch (e) {
    console.warn("[stakeout-store] save failed:", e.message);
  }
}

export function scheduleSave() {
  if (_saveTimer) return;
  _saveTimer = setTimeout(() => { _saveTimer = null; _saveNow(); }, 1000);
}

export function flushSync() {
  if (_saveTimer) { clearTimeout(_saveTimer); _saveTimer = null; }
  _saveNow();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /opt/warboard/server && node --test stakeout-store.test.js`
Expected: PASS — 4 tests, 0 fail.

- [ ] **Step 5: Commit**

```bash
cd /opt/warboard && git add server/stakeout-store.js server/stakeout-store.test.js
git commit -m "feat(stakeout): persist watch-list state with lazy DATA_DIR

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: `replaceOwnerWatchlist` — merge membership, preserve edge-state, GC

**Files:**
- Modify: `server/stakeout-store.js`
- Test: `server/stakeout-store.test.js`

Full-replace one owner's membership while preserving `info`/`seeded`/`lastFiredAt` for surviving targets and garbage-collecting targets whose subscriber map empties.

- [ ] **Step 1: Write the failing test**

Append to `server/stakeout-store.test.js`:
```js
import { replaceOwnerWatchlist } from "./stakeout-store.js";

test("replaceOwnerWatchlist: adds subscribers, preserves edge-state, GCs empties", () => {
  process.env.DATA_DIR = mkdtempSync(pathJoin(tmpdir(), "stk-"));
  load();
  replaceOwnerWatchlist("137558",
    [{ id: 5, label: "", alerts: { online: true } }],
    [{ id: 99, alerts: { rankedWarStarts: true } }]);
  assert.deepEqual(Object.keys(getState().players), ["5"]);
  assert.equal(getState().players["5"].subscribers["137558"].alerts.online, true);

  // simulate the watcher having observed target 5
  getState().players["5"].info = { name: "x", state: "Okay" };
  getState().players["5"].seeded = true;
  getState().players["5"].subscribers["137558"].lastFiredAt = { online: 123 };

  // owner re-syncs: keeps 5, drops faction 99
  replaceOwnerWatchlist("137558", [{ id: 5, label: "", alerts: { online: true } }], []);
  assert.equal(getState().players["5"].seeded, true, "edge-state preserved");
  assert.equal(getState().players["5"].info.state, "Okay");
  assert.equal(getState().players["5"].subscribers["137558"].lastFiredAt.online, 123);
  assert.deepEqual(Object.keys(getState().factions), [], "unwatched faction GC'd");

  // second owner shares target 5; first owner drops everything -> 5 survives via owner B
  replaceOwnerWatchlist("999", [{ id: 5, label: "", alerts: { hospital: true } }], []);
  replaceOwnerWatchlist("137558", [], []);
  assert.deepEqual(Object.keys(getState().players), ["5"]);
  assert.deepEqual(Object.keys(getState().players["5"].subscribers), ["999"]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /opt/warboard/server && node --test stakeout-store.test.js`
Expected: FAIL — `replaceOwnerWatchlist is not a function`.

- [ ] **Step 3: Write the minimal implementation**

Add to `server/stakeout-store.js`:
```js
function mergeOne(map, ownerId, records, isPlayer) {
  const seenIds = new Set();
  for (const rec of records) {
    const id = String(rec.id);
    seenIds.add(id);
    let target = map[id];
    if (!target) { target = map[id] = { subscribers: {}, info: null, seeded: false }; }
    const prev = target.subscribers[ownerId];
    const sub = { alerts: rec.alerts, lastFiredAt: (prev && prev.lastFiredAt) || {} };
    if (isPlayer) sub.label = typeof rec.label === "string" ? rec.label : "";
    target.subscribers[ownerId] = sub;
  }
  // remove this owner from targets they no longer list, then GC empty targets
  for (const id of Object.keys(map)) {
    if (!seenIds.has(id) && map[id].subscribers[ownerId]) delete map[id].subscribers[ownerId];
    if (Object.keys(map[id].subscribers).length === 0) delete map[id];
  }
}

export function replaceOwnerWatchlist(ownerId, players, factions) {
  const oid = String(ownerId);
  mergeOne(_state.players, oid, players || [], true);
  mergeOne(_state.factions, oid, factions || [], false);
  scheduleSave();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /opt/warboard/server && node --test stakeout-store.test.js`
Expected: PASS — 5 tests, 0 fail.

- [ ] **Step 5: Commit**

```bash
cd /opt/warboard && git add server/stakeout-store.js server/stakeout-store.test.js
git commit -m "feat(stakeout): replaceOwnerWatchlist merge/preserve/GC

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: load the Stakeout engine via `vm` + parity test

**Files:**
- Create: `server/stakeout-watcher.js`
- Test: `server/stakeout-engine-parity.test.js`

The watcher consumes the **same** engine the script ships, so server and script can never drift. Load via `vm` (NOT `require` — `"type":"module"`).

- [ ] **Step 1: Write the failing test**

Create `server/stakeout-engine-parity.test.js`:
```js
import test from "node:test";
import assert from "node:assert/strict";
import { engine } from "./stakeout-watcher.js";

const NOW = 1_700_000_000_000;
const plain = (o) => JSON.parse(JSON.stringify(o));
const psnap = (o) => Object.assign(
  { name: "X", state: "Okay", description: "", lastAction: "Online", lastActionTs: NOW / 1000, lifeCur: 100, lifeMax: 100, revivable: false }, o);
const P = { okay: true, hospital: true, landing: true, online: true, life: 25, offline: 5, revivable: true };

test("engine: exports the five pure functions", () => {
  for (const k of ["hoursSince", "evaluatePlayer", "evaluateFaction", "mapPlayerResponse", "mapFactionResponse"]) {
    assert.equal(typeof engine[k], "function", `missing ${k}`);
  }
});

test("engine: null old -> [] (no cold-boot spam)", () => {
  assert.deepEqual(plain(engine.evaluatePlayer(null, psnap({}), P, NOW)), []);
});

test("engine: okay transition fires once then re-arms", () => {
  assert.deepEqual(plain(engine.evaluatePlayer(psnap({ state: "Hospital" }), psnap({ state: "Okay" }), P, NOW)), ["okay"]);
  assert.deepEqual(plain(engine.evaluatePlayer(psnap({ state: "Okay" }), psnap({ state: "Okay" }), P, NOW)), []);
});

test("engine: evaluateFaction takes 3 args (no nowMs)", () => {
  const fsnap = (o) => Object.assign({ name: "F", chain: 0, membersCur: 10, membersMax: 100, rankedWar: false, raid: false, territoryWar: false }, o);
  assert.deepEqual(plain(engine.evaluateFaction(fsnap({ rankedWar: false }), fsnap({ rankedWar: true }), { rankedWarStarts: true })), ["rankedWarStarts"]);
});

test("engine: mapPlayerResponse reads v2 profile shape", () => {
  const snap = engine.mapPlayerResponse({ profile: { name: "Bob", status: { state: "Hospital", description: "in for 1h" }, last_action: { status: "Offline", timestamp: 1 }, life: { current: 50, maximum: 100 }, revivable: true } });
  assert.equal(plain(snap).state, "Hospital");
  assert.equal(plain(snap).revivable, true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /opt/warboard/server && node --test stakeout-engine-parity.test.js`
Expected: FAIL — `Cannot find module './stakeout-watcher.js'`.

- [ ] **Step 3: Write the minimal implementation**

Create `server/stakeout-watcher.js`:
```js
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

export const POLL_INTERVAL_MS = 30_000;
export const COOLDOWN_MS = 30 * 60_000;

function loadEngine() {
  const src = readFileSync(join(__dirname, "public/scripts/torn-stakeout.user.js"), "utf8");
  const sandbox = { module: { exports: {} }, console };
  vm.runInNewContext(src, sandbox, { filename: "torn-stakeout.user.js" });
  const e = sandbox.module.exports;
  for (const k of ["evaluatePlayer", "evaluateFaction", "mapPlayerResponse", "mapFactionResponse"]) {
    if (typeof e[k] !== "function") throw new Error(`[stakeout-watcher] engine missing ${k} — script export guard broken`);
  }
  return e;
}

export const engine = loadEngine();
```
> The required-key check is the spec's "startup self-check": if someone edits the script and breaks the `module.exports` guard, the watcher fails loudly at import instead of silently never firing.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /opt/warboard/server && node --test stakeout-engine-parity.test.js`
Expected: PASS — 5 tests, 0 fail.

- [ ] **Step 5: Commit**

```bash
cd /opt/warboard && git add server/stakeout-watcher.js server/stakeout-engine-parity.test.js
git commit -m "feat(stakeout): load script engine via vm + parity test

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: `evaluateTarget` — seed, edge-detect, per-trigger cooldown, re-arm

**Files:**
- Modify: `server/stakeout-watcher.js`
- Test: `server/stakeout-watcher.test.js`

Pure of I/O: takes a target row + a fresh snapshot, mutates the row's `info`/`seeded`/`lastFiredAt`, returns `[{ ownerId, keys }]`. Two non-negotiable rules from `price-watcher.js`: (1) **always** write `info = snap` to re-arm; (2) cooldown checked at fire time.

- [ ] **Step 1: Write the failing test**

Create `server/stakeout-watcher.test.js`:
```js
import test from "node:test";
import assert from "node:assert/strict";
import { evaluateTarget, COOLDOWN_MS } from "./stakeout-watcher.js";

const NOW = 1_700_000_000_000;
const psnap = (o) => Object.assign(
  { name: "X", state: "Okay", description: "", lastAction: "Online", lastActionTs: NOW / 1000, lifeCur: 100, lifeMax: 100, revivable: false }, o);

function target() {
  return { subscribers: { "137558": { alerts: { hospital: true }, lastFiredAt: {} } }, info: null, seeded: false };
}

test("evaluateTarget: first observation seeds, never fires", () => {
  const t = target();
  assert.deepEqual(evaluateTarget(t, psnap({ state: "Okay" }), "player", NOW), []);
  assert.equal(t.seeded, true);
  assert.equal(t.info.state, "Okay");
});

test("evaluateTarget: fires once on transition, re-arms, no double-fire", () => {
  const t = target();
  evaluateTarget(t, psnap({ state: "Okay" }), "player", NOW);            // seed
  const fired = evaluateTarget(t, psnap({ state: "Hospital" }), "player", NOW + 1000);
  assert.deepEqual(fired, [{ ownerId: "137558", keys: ["hospital"] }]);
  assert.deepEqual(evaluateTarget(t, psnap({ state: "Hospital" }), "player", NOW + 2000), []); // still hosp
  assert.equal(t.info.state, "Hospital", "info re-armed every cycle");
});

test("evaluateTarget: per-trigger cooldown suppresses re-fire inside window", () => {
  const t = target();
  evaluateTarget(t, psnap({ state: "Okay" }), "player", NOW);
  evaluateTarget(t, psnap({ state: "Hospital" }), "player", NOW + 1000);  // fires, stamps lastFiredAt
  evaluateTarget(t, psnap({ state: "Okay" }), "player", NOW + 2000);      // re-arm (leaves hosp)
  const within = evaluateTarget(t, psnap({ state: "Hospital" }), "player", NOW + 3000);
  assert.deepEqual(within, [], "cooldown blocks re-fire");
  const after = evaluateTarget(t, psnap({ state: "Okay" }), "player", NOW + 4000);
  const refire = evaluateTarget(t, psnap({ state: "Hospital" }), "player", NOW + COOLDOWN_MS + 5000);
  assert.deepEqual(refire, [{ ownerId: "137558", keys: ["hospital"] }], "fires again after cooldown");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /opt/warboard/server && node --test stakeout-watcher.test.js`
Expected: FAIL — `evaluateTarget is not a function`.

- [ ] **Step 3: Write the minimal implementation**

Add to `server/stakeout-watcher.js`:
```js
export function evaluateTarget(target, snap, kind, now, cooldownMs = COOLDOWN_MS) {
  if (!target.seeded) {
    target.info = snap;
    target.seeded = true;
    return [];
  }
  const old = target.info;
  const fires = [];
  for (const [ownerId, sub] of Object.entries(target.subscribers || {})) {
    const fired = kind === "faction"
      ? engine.evaluateFaction(old, snap, sub.alerts)
      : engine.evaluatePlayer(old, snap, sub.alerts, now);
    if (!sub.lastFiredAt) sub.lastFiredAt = {};
    const deliver = [];
    for (const k of fired) {
      const last = sub.lastFiredAt[k];
      if (last === undefined || now - last >= cooldownMs) { sub.lastFiredAt[k] = now; deliver.push(k); }
    }
    if (deliver.length) fires.push({ ownerId, keys: deliver });
  }
  target.info = snap; // ALWAYS re-arm
  return fires;
}
```
> The `last === undefined` guard ensures a target's **first-ever** fire is never suppressed by the cooldown (an unfired trigger has no timestamp); only repeat fires inside the window are gated. This avoids the `|| 0` trap in `price-watcher.js:92` (masked there only because production `now` is always ≫ `cooldownMs`, but it would bite the small `now` values Task 8's test injects).

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /opt/warboard/server && node --test stakeout-watcher.test.js`
Expected: PASS — 3 tests, 0 fail.

- [ ] **Step 5: Commit**

```bash
cd /opt/warboard && git add server/stakeout-watcher.js server/stakeout-watcher.test.js
git commit -m "feat(stakeout): evaluateTarget edge-detect + per-trigger cooldown

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: payload builder + `notifyStakeoutAlert`

**Files:**
- Modify: `server/stakeout-watcher.js`
- Test: `server/stakeout-watcher.test.js`

Pure `buildStakeoutPayload` (testable), plus a thin `notifyStakeoutAlert` that calls `push.sendToPlayers`. Keep `data` values primitive (Android coerces to String); set `tag` (Web Push collapse) + `threadId` (already supported by `apns.js:302`).

- [ ] **Step 1: Write the failing test**

Append to `server/stakeout-watcher.test.js`:
```js
import { buildStakeoutPayload } from "./stakeout-watcher.js";

test("buildStakeoutPayload: shape, primitive data, deep link", () => {
  const p = buildStakeoutPayload(2194491, { name: "Bob" }, ["online"], "player");
  assert.equal(p.title, "Stakeout");
  assert.equal(p.body, "Bob is online");
  assert.equal(p.tag, "stakeout-2194491");
  assert.equal(p.threadId, "stakeout");
  assert.deepEqual(p.data, { type: "stakeout_alert", targetId: "2194491", trigger: "online", url: "https://www.torn.com/profiles.php?XID=2194491" });
  for (const v of Object.values(p.data)) assert.equal(typeof v, "string");
});

test("buildStakeoutPayload: faction deep link + fallback name", () => {
  const p = buildStakeoutPayload(16335, {}, ["rankedWarStarts"], "faction");
  assert.equal(p.body, "Faction 16335 started a ranked war");
  assert.equal(p.data.url, "https://www.torn.com/factions.php?step=profile&ID=16335");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /opt/warboard/server && node --test stakeout-watcher.test.js`
Expected: FAIL — `buildStakeoutPayload is not a function`.

- [ ] **Step 3: Write the minimal implementation**

Add to `server/stakeout-watcher.js` (put the `import` at the **top** of the file with the other imports, above `export const engine = loadEngine();`; the helper functions + exports go in the module body):
```js
import * as push from "./push-notifications.js";

const TRIGGER_TEXT = {
  online: "is online", okay: "is out of hospital", hospital: "is hospitalized",
  landing: "has landed", revivable: "is revivable", life: "life dropped below your threshold",
  offline: "has gone offline", chainReaches: "chain alert", memberCountDrops: "lost members",
  rankedWarStarts: "started a ranked war", inRaid: "is in a raid", inTerritoryWar: "is in a territory war",
};

function humanTrigger(key) { return TRIGGER_TEXT[key] || key; }

export function buildStakeoutPayload(targetId, snap, firedKeys, kind) {
  const key = firedKeys[0];
  const id = String(targetId);
  const name = (snap && snap.name) || (kind === "faction" ? `Faction ${id}` : `Player ${id}`);
  const url = kind === "faction"
    ? `https://www.torn.com/factions.php?step=profile&ID=${id}`
    : `https://www.torn.com/profiles.php?XID=${id}`;
  return {
    title: "Stakeout",
    body: `${name} ${humanTrigger(key)}`,
    tag: `stakeout-${id}`,
    threadId: "stakeout",
    icon: "/icon-192.png",
    data: { type: "stakeout_alert", targetId: id, trigger: key, url },
  };
}

export async function notifyStakeoutAlert(subscriberIds, targetId, snap, firedKeys, kind) {
  if (!subscriberIds?.length || !firedKeys?.length) return;
  const payload = buildStakeoutPayload(targetId, snap, firedKeys, kind);
  try {
    await push.sendToPlayers(subscriberIds.map(String), payload, "stakeout_alert");
  } catch (e) {
    console.warn("[stakeout-watcher] push failed:", e.message);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /opt/warboard/server && node --test stakeout-watcher.test.js`
Expected: PASS — 5 tests, 0 fail.

- [ ] **Step 5: Commit**

```bash
cd /opt/warboard && git add server/stakeout-watcher.js server/stakeout-watcher.test.js
git commit -m "feat(stakeout): notification payload builder + notifyStakeoutAlert

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: register the `stakeout_alert` notification type

**Files:**
- Modify: `server/push-notifications.js:38-54`
- Test: `server/stakeout-watcher.test.js`

Registering the type makes the toggle UI-visible and gives `getPreferences` a default. (Unregistered types still send via `?? true`, but won't show in the prefs UI.)

- [ ] **Step 1: Write the failing test**

Append to `server/stakeout-watcher.test.js`:
```js
import { NOTIFICATION_TYPES, getPreferences } from "./push-notifications.js";

test("stakeout_alert type is registered, default on, included in preferences", () => {
  assert.ok(NOTIFICATION_TYPES.stakeout_alert, "type registered");
  assert.equal(NOTIFICATION_TYPES.stakeout_alert.default, true);
  assert.equal(NOTIFICATION_TYPES.stakeout_alert.oc, undefined, "not an OC-only type");
  assert.equal(getPreferences("000")["stakeout_alert"], true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /opt/warboard/server && node --test stakeout-watcher.test.js`
Expected: FAIL — `NOTIFICATION_TYPES.stakeout_alert` is undefined.

- [ ] **Step 3: Write the minimal implementation**

In `server/push-notifications.js`, add one entry to the `NOTIFICATION_TYPES` object (after `enemy_surge` at line 46, before the `oc:`-marked block):
```js
  stakeout_alert:  { label: "Stakeout Alerts",        description: "A watched player/faction hit a trigger (online, out of hospital, landed, revivable…)", default: true },
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /opt/warboard/server && node --test stakeout-watcher.test.js`
Expected: PASS — 6 tests, 0 fail.

- [ ] **Step 5: Commit**

```bash
cd /opt/warboard && git add server/push-notifications.js server/stakeout-watcher.test.js
git commit -m "feat(stakeout): register stakeout_alert notification type

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: `runPoll` — fetch only watched targets, one call each, fan out

**Files:**
- Modify: `server/stakeout-watcher.js`
- Test: `server/stakeout-watcher.test.js`

`runPoll` reads the store, fetches each distinct target **once** with an owner's own key, maps + `evaluateTarget`, and fires. Dependencies (`fetchImpl`, `sendImpl`, `nowFn`) are injectable for tests. Idle short-circuit when no targets.

- [ ] **Step 1: Write the failing test**

Append to `server/stakeout-watcher.test.js`:
```js
import { runPoll } from "./stakeout-watcher.js";
import * as stkStore from "./stakeout-store.js";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join as pathJoin } from "node:path";

test("runPoll: one fetch per distinct target, fires on transition", async () => {
  process.env.DATA_DIR = mkdtempSync(pathJoin(tmpdir(), "stk-"));
  stkStore.load();
  // two owners watch the SAME player 5 -> must be fetched ONCE
  stkStore.replaceOwnerWatchlist("137558", [{ id: 5, label: "", alerts: { hospital: true } }], []);
  stkStore.replaceOwnerWatchlist("999", [{ id: 5, label: "", alerts: { hospital: true } }], []);

  const calls = [];
  const sent = [];
  const profile = (state) => ({ profile: { name: "Bob", status: { state, description: "" }, last_action: { status: "Online", timestamp: 1 }, life: { current: 100, maximum: 100 }, revivable: false } });
  let state = "Okay";
  const fetchImpl = async (kind, id) => { calls.push(`${kind}:${id}`); return profile(state); };
  const sendImpl = async (ids, targetId, snap, keys, k) => { sent.push({ ids, targetId, keys }); };
  const keyFor = () => "FAKEKEY";

  await runPoll({ fetchImpl, sendImpl, nowFn: () => 1000, keyForOwner: keyFor }); // seed
  assert.deepEqual(calls, ["player:5"], "one fetch for the shared target");
  state = "Hospital";
  await runPoll({ fetchImpl, sendImpl, nowFn: () => 2000, keyForOwner: keyFor }); // fires
  assert.equal(calls.length, 2, "still one fetch per cycle");
  assert.equal(sent.length, 2, "both subscribers notified");
  assert.deepEqual(sent[0].keys, ["hospital"]);
});

test("runPoll: idle short-circuit does zero fetches", async () => {
  process.env.DATA_DIR = mkdtempSync(pathJoin(tmpdir(), "stk-"));
  stkStore.load();
  let fetched = 0;
  const r = await runPoll({ fetchImpl: async () => { fetched++; return {}; }, sendImpl: async () => {}, nowFn: () => 1, keyForOwner: () => "K" });
  assert.equal(fetched, 0);
  assert.deepEqual(r, { polled: 0, fired: 0 });
});

test("runPoll: skips target whose owners have no stored key", async () => {
  process.env.DATA_DIR = mkdtempSync(pathJoin(tmpdir(), "stk-"));
  stkStore.load();
  stkStore.replaceOwnerWatchlist("137558", [{ id: 7, label: "", alerts: { online: true } }], []);
  let fetched = 0;
  await runPoll({ fetchImpl: async () => { fetched++; return {}; }, sendImpl: async () => {}, nowFn: () => 1, keyForOwner: () => null });
  assert.equal(fetched, 0, "no key -> no fetch");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /opt/warboard/server && node --test stakeout-watcher.test.js`
Expected: FAIL — `runPoll is not a function`.

- [ ] **Step 3: Write the minimal implementation**

Add to `server/stakeout-watcher.js` (again, place both `import` lines at the **top** with the other imports, not inline below the executable code):
```js
import * as store from "./store.js";
import * as stakeoutStore from "./stakeout-store.js";

async function _fetchTorn(kind, id, key) {
  const section = kind === "faction" ? "faction" : "user";
  const selections = kind === "faction" ? "basic,chain,wars" : "profile";
  const url = `https://api.torn.com/v2/${section}/${id}?selections=${selections}&comment=wb-stakeout`;
  const res = await fetch(url, { headers: { Authorization: `ApiKey ${key}`, Accept: "application/json" } });
  const json = await res.json();
  if (!json || json.error) return null; // Torn { error:{code,error} } or bad body -> skip, no info touch
  return json;
}

function _keyForOwner(target) {
  for (const ownerId of Object.keys(target.subscribers || {})) {
    const k = store.getApiKeyForPlayer(String(ownerId));
    if (k) return k;
  }
  return null;
}

export async function runPoll(opts = {}) {
  const fetchImpl = opts.fetchImpl || _fetchTorn;
  const sendImpl = opts.sendImpl || notifyStakeoutAlert;
  const nowFn = opts.nowFn || Date.now;
  const keyForOwner = opts.keyForOwner || ((t) => _keyForOwner(t));
  const st = stakeoutStore.getState();
  const groups = [["player", st.players], ["faction", st.factions]];
  let polled = 0, fired = 0;
  if (Object.keys(st.players).length === 0 && Object.keys(st.factions).length === 0) {
    return { polled, fired };
  }
  for (const [kind, map] of groups) {
    for (const [id, target] of Object.entries(map)) {
      const key = keyForOwner(target);
      if (!key) continue;
      let json;
      try { json = await fetchImpl(kind, id, key); } catch { json = null; }
      if (!json) continue; // bad read -> do not touch info
      const snap = kind === "faction" ? engine.mapFactionResponse(json) : engine.mapPlayerResponse(json);
      const fires = evaluateTarget(target, snap, kind, nowFn());
      polled++;
      for (const f of fires) {
        await sendImpl([f.ownerId], id, snap, f.keys, kind);
        fired++;
      }
    }
  }
  stakeoutStore.scheduleSave();
  return { polled, fired };
}
```
> The map step uses the engine's two separate mappers (`engine.mapFactionResponse(json)` for factions, `engine.mapPlayerResponse(json)` for players) — there is no combined mapper. The Task-8 test injects `fetchImpl` returning a `{profile:{...}}` shape, so `mapPlayerResponse` runs.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /opt/warboard/server && node --test stakeout-watcher.test.js`
Expected: PASS — 9 tests, 0 fail.

- [ ] **Step 5: Add `startWatcher`/`stopWatcher` and commit**

Add to `server/stakeout-watcher.js`:
```js
let _pollTimer = null;

export function startWatcher() {
  if (_pollTimer) return;
  _pollTimer = setInterval(() => { runPoll().catch((e) => console.warn("[stakeout-watcher] poll error:", e.message)); }, POLL_INTERVAL_MS);
  console.log(`[stakeout-watcher] started (every ${POLL_INTERVAL_MS / 1000}s)`);
  runPoll().catch(() => {});
}

export function stopWatcher() {
  if (_pollTimer) { clearInterval(_pollTimer); _pollTimer = null; }
  stakeoutStore.flushSync();
}
```
Verify the module imports cleanly:
Run: `cd /opt/warboard/server && node --check stakeout-watcher.js && node --input-type=module -e "import('./stakeout-watcher.js').then(()=>console.log('import ok'))"`
Expected: `import ok` (engine loads, no throw).

```bash
cd /opt/warboard && git add server/stakeout-watcher.js server/stakeout-watcher.test.js
git commit -m "feat(stakeout): runPoll (one call per target) + start/stop watcher

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 9: `POST /api/stakeout/sync` route + rate limiter

**Files:**
- Modify: `server/routes.js` (add route near the other authed POSTs, e.g. after `/api/me/bars` at `routes.js:1909`)
- Modify: `server/server.js:213-216` (mount the existing per-JWT limiter)
- Test: `server/stakeout-store.test.js` (handler unit via req/res stub)

- [ ] **Step 1: Write the failing test**

Append to `server/stakeout-store.test.js`:
```js
import { handleStakeoutSync } from "./stakeout-store.js";

function stubRes() {
  return { _status: 200, _json: null, status(c) { this._status = c; return this; }, json(o) { this._json = o; return this; } };
}

test("handleStakeoutSync: owner from req.user, persists, returns counts", () => {
  process.env.DATA_DIR = mkdtempSync(pathJoin(tmpdir(), "stk-"));
  load();
  const req = { user: { playerId: "137558" }, body: { players: [{ id: 5, alerts: { online: true } }], factions: [] } };
  const res = stubRes();
  handleStakeoutSync(req, res);
  assert.equal(res._status, 200);
  assert.deepEqual(res._json, { ok: true, players: 1, factions: 0 });
  assert.deepEqual(Object.keys(getState().players), ["5"]);
  assert.equal(getState().players["5"].subscribers["137558"].alerts.online, true);
});

test("handleStakeoutSync: ignores client-sent owner id (uses req.user)", () => {
  process.env.DATA_DIR = mkdtempSync(pathJoin(tmpdir(), "stk-"));
  load();
  const req = { user: { playerId: "137558" }, body: { ownerId: "999", players: [{ id: 5, alerts: {} }] } };
  handleStakeoutSync(req, stubRes());
  assert.deepEqual(Object.keys(getState().players["5"].subscribers), ["137558"]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /opt/warboard/server && node --test stakeout-store.test.js`
Expected: FAIL — `handleStakeoutSync is not a function`.

- [ ] **Step 3: Implement the handler (in `stakeout-store.js`) and wire the route**

Add to `server/stakeout-store.js`:
```js
export function handleStakeoutSync(req, res) {
  const ownerId = req.user && req.user.playerId ? String(req.user.playerId) : null;
  if (!ownerId) return res.status(401).json({ error: "auth required" });
  const { players, factions } = validateStakeoutSync(req.body);
  replaceOwnerWatchlist(ownerId, players, factions);
  return res.json({ ok: true, players: players.length, factions: factions.length });
}
```
In `server/routes.js`, after the `/api/me/bars` handler (ends `routes.js:1909`), add:
```js
import { handleStakeoutSync } from "./stakeout-store.js"; // (add to the existing import block at top of routes.js)

router.post("/api/stakeout/sync", requireAuth, express.json({ limit: "16kb" }), (req, res) => handleStakeoutSync(req, res));
```
> Put the `import` with the other `./` imports at the top of `routes.js`, not inline. `requireAuth` and `express` are already imported there.

In `server/server.js`, alongside the existing limiter mounts (`server.js:213-216`):
```js
app.use('/api/stakeout/sync', warRoomPerJwtLimiter);
```

- [ ] **Step 4: Run tests + syntax check**

Run: `cd /opt/warboard/server && node --test stakeout-store.test.js && node --check routes.js && node --check server.js`
Expected: PASS — 7 tests; both `--check` silent (exit 0).

- [ ] **Step 5: Commit**

```bash
cd /opt/warboard && git add server/stakeout-store.js server/stakeout-store.test.js server/routes.js server/server.js
git commit -m "feat(stakeout): POST /api/stakeout/sync route + rate limit

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 10: wire the watcher into server boot + shutdown (env-gated)

**Files:**
- Modify: `server/server.js` (~`server.js:590` boot block; `shutdown()` at ~`server.js:838`)

No unit test (boot wiring) — verified by a guarded `pm2` reload + health check. Detection stays OFF unless `STAKEOUT_WATCHER=1`.

- [ ] **Step 1: Add the import + boot wiring**

At the top of `server/server.js` with the other module imports:
```js
import * as stakeoutStore from "./stakeout-store.js";
import { startWatcher as startStakeoutWatcher, stopWatcher as stopStakeoutWatcher } from "./stakeout-watcher.js";
```
In the boot block near `priceWatcher.load();` (`server.js:590`):
```js
stakeoutStore.load();
if (process.env.STAKEOUT_WATCHER === "1") {
  startStakeoutWatcher();
} else {
  console.log("[stakeout-watcher] disabled (set STAKEOUT_WATCHER=1 to enable detection)");
}
```

- [ ] **Step 2: Add to shutdown**

In the `shutdown()` function next to `stopHeatmapFlush();` (`server.js:838`):
```js
  stopStakeoutWatcher();
```

- [ ] **Step 3: Syntax check + verify it boots with detection OFF**

Run: `cd /opt/warboard/server && node --check server.js`
Expected: exit 0.

Run: `cd /opt/warboard && pm2 reload warboard && sleep 2 && curl -fsS http://127.0.0.1:3000/health && pm2 logs warboard --lines 30 --nostream | grep -i stakeout`
Expected: `200`/health OK; log shows `[stakeout-store] loaded N watched target(s)` and `[stakeout-watcher] disabled (...)`. No poll traffic.

- [ ] **Step 4: Commit**

```bash
cd /opt/warboard && git add server/server.js
git commit -m "feat(stakeout): wire store load + env-gated watcher into boot/shutdown

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 11: userscript `syncUp` — auth handshake + push the watch list

**Files:**
- Modify: `server/public/scripts/torn-stakeout.user.js` (metadata `@connect` + `@version`; `SCRIPT_VERSION`; new `syncUp()` + triggers)

The script gets a JWT via `POST /api/auth` (faction-locked → owner-only v1) then mirrors its list to `/api/stakeout/sync` on change (debounced) + heartbeat. **No `//` comments in the script body** (house rule); keep the `==UserScript==` block.

- [ ] **Step 1: Confirm the served version before bumping**

Run: `curl -fsS https://tornwar.com/scripts/torn-stakeout.user.js | grep -m1 '@version'`
Use `max(local 1.0.15, served) + 1 patch` as the new version (e.g. `1.0.16`). Record it.

- [ ] **Step 2: Add `@connect` and bump version (metadata block)**

In the `==UserScript==` block: ensure `// @connect      tornwar.com` is present (alongside `api.torn.com`), and set `// @version      1.0.16` (or the computed value). Update the in-file `SCRIPT_VERSION` constant to the same string (keep them in lockstep).

- [ ] **Step 3: Add the `syncUp` function (no comments)**

Inside the IIFE (browser half, after `getSettings`/`getPlayers`/`getFactions` are defined), add:
```js
  var SYNC_BASE = 'https://tornwar.com';
  var jwtCache = null;
  function syncAuth(cb) {
    if (jwtCache) { cb(jwtCache); return; }
    var s = getSettings();
    if (!s.apiKey) { cb(null); return; }
    GM_xmlhttpRequest({
      method: 'POST', url: SYNC_BASE + '/api/auth',
      headers: { 'Content-Type': 'application/json' },
      data: JSON.stringify({ apiKey: s.apiKey, scriptName: 'stakeout', scriptVersion: SCRIPT_VERSION }),
      onload: function (r) {
        try { var d = JSON.parse(r.responseText); jwtCache = d && d.token ? d.token : null; } catch (e) { jwtCache = null; }
        cb(jwtCache);
      },
      onerror: function () { cb(null); }
    });
  }
  function stripForSync(list, isPlayer) {
    return list.map(function (r) {
      var o = { id: r.id, alerts: r.alerts };
      if (isPlayer) o.label = r.label || '';
      return o;
    });
  }
  function syncUp() {
    syncAuth(function (token) {
      if (!token) return;
      GM_xmlhttpRequest({
        method: 'POST', url: SYNC_BASE + '/api/stakeout/sync',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        data: JSON.stringify({ players: stripForSync(getPlayers(), true), factions: stripForSync(getFactions(), false) }),
        onload: function () {}, onerror: function () {}
      });
    });
  }
  var syncDebounce = null;
  function scheduleSync() {
    if (syncDebounce) clearTimeout(syncDebounce);
    syncDebounce = setTimeout(syncUp, 2000);
  }
```

- [ ] **Step 4: Trigger sync on change + heartbeat**

Call `scheduleSync()` **only** from the handlers that change membership or alert toggles — the add-target, remove-target, and alert-toggle handlers (the `setPlayers(...)`/`setFactions(...)` calls inside *those*, around lines 368 / 373 / 379 / 380 / 427 / 429). **Do NOT** add it to `pollOnce`'s per-cycle `info` re-arm writes (the `setPlayers`/`setFactions` near lines 172 / 184 persist poll snapshots, not membership changes — syncing there would POST `/api/stakeout/sync` every ~30s per target, defeat the 2s debounce, and break the zero-idle-spend guarantee). If unsure whether a `setPlayers`/`setFactions` site is a mutation or a re-arm: it's a mutation only if it runs from a user click (add/remove/toggle), never from the poll loop. Add one heartbeat near where polling starts:
```js
  setInterval(syncUp, 10 * 60 * 1000);
  syncUp();
```

- [ ] **Step 5: Syntax check + node engine tests still pass**

Run: `cd /opt/warboard && node --check server/public/scripts/torn-stakeout.user.js && node --test test/stakeout.test.mjs`
Expected: `--check` exit 0; engine suite still 18/18 (the export guard is untouched, so the added browser code never runs in node).

- [ ] **Step 6: Deploy + show the served URL**

Run: `cd /opt/warboard && pm2 reload warboard && sleep 2 && curl -fsS http://127.0.0.1:3000/health && curl -fsS https://tornwar.com/scripts/torn-stakeout.user.js | grep -m1 '@version'`
Expected: health 200; served `@version` == the new value (static mount serves `public/` live).

- [ ] **Step 7: Commit + push (version boundary → standing auth)**

```bash
cd /opt/warboard && git add server/public/scripts/torn-stakeout.user.js
git commit -m "feat(stakeout): sync watch list to server for closed-app push (v1.0.16)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
git push origin main
```
Report the install URL: `https://tornwar.com/scripts/torn-stakeout.user.js`

---

## Enabling detection (after all tasks land + verified)

Detection is OFF by default. To switch it on for the owner once the sync side has accumulated a real watch list:
1. Add `STAKEOUT_WATCHER=1` to the warboard process env (`server/ecosystem.config.cjs` env block) — **targeted edit, never `git add -A`**.
2. `pm2 reload warboard && curl -fsS http://127.0.0.1:3000/health`
3. Watch one cycle: `pm2 logs warboard --lines 50 --nostream | grep -i stakeout` — expect `[stakeout-watcher] started`, then one fetch per watched target, no errors.
4. Confirm a real push end-to-end (watch your own alt, take it online) before widening scope.

---

## Test runner + durability notes

- **Each task runs its own suite** via `node --test <file>`, so all three new suites are exercised during implementation. The repo's `package.json:10` `"test"` script is **not** widened here (it still runs only `key-encryption.test.js`); widening it to `node --test` also pulls in the 10 pre-existing suites and needs sign-off (spec open-decision). Deferred deliberately — flag to RussianRob when enabling detection, or append just the three new files to the script.
- **Seed durability:** a brand-new target's first observation persists via the 1s `scheduleSave()` debounce. A hard kill (SIGKILL/OOM) inside that window loses `seeded`/`info`, but this is **self-correcting, not a spam risk** — on restart the engine's `old===null → []` re-seeds silently. Graceful shutdown (`stopWatcher()` → `flushSync()`) covers SIGTERM/SIGINT.

## Self-Review

**1. Spec coverage:**
- Sync API + validation → Tasks 1, 9. Storage shape + preserve/GC → Tasks 2, 3. Watcher engine reuse → Task 4. Edge-detect + cooldown + seed → Task 5. Delivery fan-out + payload + threadId + primitive data → Task 6. `stakeout_alert` type → Task 7. Only-poll-watched + one-call-per-target + idle short-circuit + own-key → Task 8. Boot/shutdown env-gate → Task 10. Script sync + auth → Task 11. Web Push channel → **no task needed** (reused for free via `sendToPlayers`; the design's "out of scope: no new web-push infra" holds). API-cost guarantee → enforced by Task 8's per-target loop + idle short-circuit.
- **Deferred (documented, not built):** in-page/server dedup, per-trigger push types, stale-owner TTL, 60s backoff at high target counts, widening past owner-only. All listed in the spec's Out-of-scope / Open-decisions.

**2. Placeholder scan:** The only prose-y spot is Task 8's map helper — explicitly resolved to the literal `engine.mapFactionResponse(json)` / `engine.mapPlayerResponse(json)` line. No "TBD"/"handle errors"/"etc." left as instructions.

**3. Type consistency:** `evaluateTarget(target, snap, kind, now, cooldownMs)` and its `{ownerId, keys}` return shape are consistent across Tasks 5 and 8. `notifyStakeoutAlert(subscriberIds, targetId, snap, firedKeys, kind)` matches `runPoll`'s call site. `replaceOwnerWatchlist(ownerId, players, factions)` matches `handleStakeoutSync`. Store getters (`getState`, `load`, `scheduleSave`, `flushSync`) consistent across Tasks 2/3/8/10. `stakeout_alert` type string identical in Tasks 6, 7, 8.
