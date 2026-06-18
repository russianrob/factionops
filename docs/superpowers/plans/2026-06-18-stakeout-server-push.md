# Stakeout Server-Side Push — Implementation Plan (v2: isolated per-owner key)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** An always-on server-side watcher polls each user's watched Stakeout targets **with that user's own Torn key**, edge-detects with the userscript's own engine, and pushes a notification (APNs / FCM / Web Push) even when the app/tab is closed.

**Architecture (REVISED 2026-06-18):** A **self-contained stakeout island**. Each user enters their Torn key in the Stakeout userscript; the script POSTs `{apiKey, players, factions}` to a dedicated **unauthenticated** endpoint. The server resolves the key's owner via one Torn `/user` call, stores the key **encrypted in a stakeout-only file** (`data/stakeout-watchers.json`, per owner), and the watcher polls **only that owner's targets using only that owner's key**. The key is **never** placed in warboard's `store`/pool, `player-keys.json`, the factionops `/api/auth` JWT, or the faction lock. The only warboard surface the feature touches is the push **delivery** channel (APNs/FCM/Web Push) — that delivery *is* the feature.

**Hard isolation invariants (the user's explicit requirement):**
- A user's stakeout key is used **only** to (a) resolve their identity once and (b) poll *their* stakeout targets. Nothing else. Never pooled, never shared, never used by any other warboard poller.
- Per-owner polling: a target watched by two people is fetched **twice** (once per key). No key ever fetches a target on someone else's behalf.
- Clearing your watch list (`{players:[],factions:[]}`) **deletes your stored key** from the server.

**Tech Stack:** Node ESM (`server/` is `"type":"module"`), Express + `express-rate-limit`, `node:test`, `node:vm` (engine load), `key-encryption.js` (`encrypt`/`decrypt`, AES-256-GCM), the existing `push-notifications.js` orchestrator.

**Design reference:** `docs/superpowers/specs/2026-06-18-stakeout-server-push-design.md` (see its "REVISION 2026-06-18: isolated per-owner key model" section, which supersedes the original shared-subscriber model).

### Grounded facts baked in
- **Engine load = `vm`, not `require()`** (`server/package.json` is `"type":"module"`; the engine is CJS). Use `vm.runInNewContext` with a `{module:{exports:{}}}` sandbox like `test/stakeout.test.mjs:6-11`.
- **`apns.js:302`** already maps `payload.threadId` → `aps["thread-id"]` — zero new code for grouping.
- **`isTypeEnabled` is not exported** (`push-notifications.js:152`); preference tests use `NOTIFICATION_TYPES` + `getPreferences()`.
- **Key encryption:** `encrypt(plaintext)` / `decrypt(value)` from `key-encryption.js` (idempotent; `decrypt` returns plaintext, or the value as-is if not encrypted). Master key handled internally — do not touch the secret.
- **Identity from a key:** `GET https://api.torn.com/user/?selections=basic&key=<key>` → `data.player_id` (and `data.error` on failure), exactly as `auth.js verifyTornApiKey` parses it. We inline this so the stakeout key never flows through `auth.js`.
- **Per-owner storage `{ owners: { <pid>: { key, players, factions } } }`** — `key` is the AES-encrypted Torn key; `players`/`factions` are maps of `<id> → { alerts, info, seeded, lastFiredAt }`.

---

## File Structure

**Create:**
- `server/stakeout-store.js` — validation (done in Task 1), per-owner persistence (`data/stakeout-watchers.json`), `resolveOwnerId`, `syncOwner`, `handleStakeoutSync`. One responsibility: the stakeout watch-list + key island and its sync entry point.
- `server/stakeout-watcher.js` — `vm`-loaded engine; `evaluateTarget` (edge/cooldown/seed); payload builder + `notifyStakeoutAlert`; `runPoll` (per-owner, decrypts each owner's key) + `start/stopWatcher`.
- `server/stakeout-store.test.js`, `server/stakeout-watcher.test.js`, `server/stakeout-engine-parity.test.js`.

**Modify:**
- `server/push-notifications.js:38-54` — register `stakeout_alert`.
- `server/routes.js` — `POST /api/stakeout/sync` (no auth, IP rate-limited).
- `server/server.js` — define + mount `stakeoutSyncLimiter`, load the store, env-gate `startWatcher`, `stopWatcher` in shutdown.
- `server/public/scripts/torn-stakeout.user.js` — `@connect tornwar.com`, `syncUp()` (POST `{apiKey,players,factions}` — **no** `/api/auth`), triggers + version bump.

**Constants** — in `stakeout-watcher.js`:
```js
export const POLL_INTERVAL_MS = 30_000;
export const COOLDOWN_MS = 30 * 60_000;
```
In `stakeout-store.js` (already present from Task 1): `MAX_PLAYERS_PER_OWNER = 100`, `MAX_FACTIONS_PER_OWNER = 100`.

---

## Task 1: `validateStakeoutSync` — DONE ✅

Already implemented and committed (`ba2fe27`). It normalizes a sync body into `{ players:[{id,label,alerts}], factions:[{id,alerts}] }` (strips `info`/`apiKey`, tri-state alerts, caps, drops bad ids). Model-agnostic — unchanged by the v2 revision. Skip to Task 2.

---

## Task 2: store persistence — per-owner state, lazy DATA_DIR

**Files:**
- Modify: `server/stakeout-store.js`
- Test: `server/stakeout-store.test.js`

State shape `{ owners: {} }`. Data-dir read at call time so tests can set `process.env.DATA_DIR` before `load()`.

- [ ] **Step 1: Write the failing test**

Append to `server/stakeout-store.test.js`:
```js
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join as pathJoin } from "node:path";
import { load, getState, _saveNow } from "./stakeout-store.js";

test("store: load on empty dir yields {owners:{}}; save round-trips", () => {
  process.env.DATA_DIR = mkdtempSync(pathJoin(tmpdir(), "stk-"));
  load();
  assert.deepEqual(getState(), { owners: {} });
  getState().owners["137558"] = { key: "enc", players: {}, factions: {} };
  _saveNow();
  load();
  assert.deepEqual(Object.keys(getState().owners), ["137558"]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /opt/warboard/server && node --test stakeout-store.test.js`
Expected: FAIL — `load`/`getState`/`_saveNow` not exported.

- [ ] **Step 3: Write the minimal implementation**

Add to `server/stakeout-store.js` (place the `node:fs`/`node:path`/`node:url` imports at the top with the others if not already present from Task 1):
```js
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));

function dataFile() {
  const dir = process.env.DATA_DIR || join(__dirname, "data");
  return { dir, file: join(dir, "stakeout-watchers.json") };
}

let _state = { owners: {} };
let _saveTimer = null;

export function getState() { return _state; }

export function load() {
  try {
    const { file } = dataFile();
    _state = existsSync(file)
      ? { owners: (JSON.parse(readFileSync(file, "utf8")) || {}).owners || {} }
      : { owners: {} };
  } catch (e) {
    console.warn("[stakeout-store] load failed:", e.message);
    _state = { owners: {} };
  }
  console.log(`[stakeout-store] loaded ${Object.keys(_state.owners).length} owner(s)`);
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
> If Task 1 already imported some of these `node:` symbols, do NOT duplicate the import — merge into the existing import line.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /opt/warboard/server && node --test stakeout-store.test.js`
Expected: PASS — 4 tests, 0 fail.

- [ ] **Step 5: Commit**
```bash
cd /opt/warboard && git add server/stakeout-store.js server/stakeout-store.test.js
git commit -m "feat(stakeout): per-owner watch-list persistence (lazy DATA_DIR)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: `syncOwner` — upsert key + per-owner watch list, preserve edge-state, GC

**Files:**
- Modify: `server/stakeout-store.js`
- Test: `server/stakeout-store.test.js`

One owner's encrypted key + their two target maps. Preserve `info`/`seeded`/`lastFiredAt` for surviving targets; an empty list (no players AND no factions) **deletes the owner and their key**.

- [ ] **Step 1: Write the failing test**

Append to `server/stakeout-store.test.js`:
```js
import { syncOwner } from "./stakeout-store.js";

test("syncOwner: stores key + targets, preserves edge-state, GCs on empty", () => {
  process.env.DATA_DIR = mkdtempSync(pathJoin(tmpdir(), "stk-"));
  load();
  syncOwner("137558", "ENC1",
    [{ id: 5, label: "", alerts: { online: true } }],
    [{ id: 99, alerts: { rankedWarStarts: true } }]);
  assert.equal(getState().owners["137558"].key, "ENC1");
  assert.equal(getState().owners["137558"].players["5"].alerts.online, true);
  assert.equal(getState().owners["137558"].players["5"].seeded, false);

  // watcher observed target 5
  getState().owners["137558"].players["5"].info = { state: "Okay" };
  getState().owners["137558"].players["5"].seeded = true;
  getState().owners["137558"].players["5"].lastFiredAt = { online: 123 };

  // re-sync with refreshed key, keep player 5, drop faction 99
  syncOwner("137558", "ENC2", [{ id: 5, label: "", alerts: { online: true, hospital: true } }], []);
  const p5 = getState().owners["137558"].players["5"];
  assert.equal(getState().owners["137558"].key, "ENC2", "key refreshed");
  assert.equal(p5.seeded, true, "edge-state preserved");
  assert.equal(p5.info.state, "Okay");
  assert.equal(p5.lastFiredAt.online, 123);
  assert.equal(p5.alerts.hospital, true, "alerts updated");
  assert.deepEqual(getState().owners["137558"].factions, {});

  // empty list deletes owner + key
  syncOwner("137558", "ENC3", [], []);
  assert.deepEqual(getState().owners, {});
});

test("syncOwner: two owners are independent (same target id, separate rows)", () => {
  process.env.DATA_DIR = mkdtempSync(pathJoin(tmpdir(), "stk-"));
  load();
  syncOwner("111", "A", [{ id: 5, label: "", alerts: { online: true } }], []);
  syncOwner("222", "B", [{ id: 5, label: "", alerts: { hospital: true } }], []);
  assert.equal(getState().owners["111"].players["5"].alerts.online, true);
  assert.equal(getState().owners["222"].players["5"].alerts.hospital, true);
  assert.notEqual(getState().owners["111"].key, getState().owners["222"].key);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /opt/warboard/server && node --test stakeout-store.test.js`
Expected: FAIL — `syncOwner is not a function`.

- [ ] **Step 3: Write the minimal implementation**

Add to `server/stakeout-store.js`:
```js
function mergeTargets(prevMap, records, isPlayer) {
  const out = {};
  for (const rec of records) {
    const id = String(rec.id);
    const prev = prevMap[id];
    out[id] = {
      alerts: rec.alerts,
      info: prev ? prev.info : null,
      seeded: prev ? prev.seeded : false,
      lastFiredAt: prev ? prev.lastFiredAt || {} : {},
    };
    if (isPlayer) out[id].label = typeof rec.label === "string" ? rec.label : "";
  }
  return out;
}

export function syncOwner(ownerId, encryptedKey, players, factions) {
  const oid = String(ownerId);
  if ((players || []).length === 0 && (factions || []).length === 0) {
    delete _state.owners[oid]; // clearing the list removes the stored key
    scheduleSave();
    return;
  }
  const prev = _state.owners[oid] || { players: {}, factions: {} };
  _state.owners[oid] = {
    key: encryptedKey,
    players: mergeTargets(prev.players || {}, players || [], true),
    factions: mergeTargets(prev.factions || {}, factions || [], false),
  };
  scheduleSave();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /opt/warboard/server && node --test stakeout-store.test.js`
Expected: PASS — 6 tests, 0 fail.

- [ ] **Step 5: Commit**
```bash
cd /opt/warboard && git add server/stakeout-store.js server/stakeout-store.test.js
git commit -m "feat(stakeout): syncOwner upsert key + per-owner targets (preserve/GC)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: load the engine via `vm` + parity test

**Files:**
- Create: `server/stakeout-watcher.js`
- Test: `server/stakeout-engine-parity.test.js`

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
  const snap = engine.mapPlayerResponse({ profile: { name: "Bob", status: { state: "Hospital", description: "" }, last_action: { status: "Offline", timestamp: 1 }, life: { current: 50, maximum: 100 }, revivable: true } });
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

## Task 5: `evaluateTarget` — single owner-target: seed, edge-detect, cooldown, re-arm

**Files:**
- Modify: `server/stakeout-watcher.js`
- Test: `server/stakeout-watcher.test.js`

Operates on ONE owner's target `{ alerts, info, seeded, lastFiredAt }`; returns the array of fired trigger keys. Rules: always re-arm `info=snap`; cooldown never suppresses a first-ever fire.

- [ ] **Step 1: Write the failing test**

Create `server/stakeout-watcher.test.js`:
```js
import test from "node:test";
import assert from "node:assert/strict";
import { evaluateTarget, COOLDOWN_MS } from "./stakeout-watcher.js";

const NOW = 1_700_000_000_000;
const psnap = (o) => Object.assign(
  { name: "X", state: "Okay", description: "", lastAction: "Online", lastActionTs: NOW / 1000, lifeCur: 100, lifeMax: 100, revivable: false }, o);
const target = () => ({ alerts: { hospital: true }, info: null, seeded: false, lastFiredAt: {} });

test("evaluateTarget: first observation seeds, never fires", () => {
  const t = target();
  assert.deepEqual(evaluateTarget(t, psnap({ state: "Okay" }), "player", NOW), []);
  assert.equal(t.seeded, true);
  assert.equal(t.info.state, "Okay");
});
test("evaluateTarget: fires once on transition, re-arms, no double-fire", () => {
  const t = target();
  evaluateTarget(t, psnap({ state: "Okay" }), "player", NOW);
  assert.deepEqual(evaluateTarget(t, psnap({ state: "Hospital" }), "player", NOW + 1000), ["hospital"]);
  assert.deepEqual(evaluateTarget(t, psnap({ state: "Hospital" }), "player", NOW + 2000), []);
  assert.equal(t.info.state, "Hospital");
});
test("evaluateTarget: cooldown blocks re-fire in window, allows after; first fire never gated", () => {
  const t = target();
  evaluateTarget(t, psnap({ state: "Okay" }), "player", NOW);
  assert.deepEqual(evaluateTarget(t, psnap({ state: "Hospital" }), "player", NOW + 1000), ["hospital"]);
  evaluateTarget(t, psnap({ state: "Okay" }), "player", NOW + 2000);
  assert.deepEqual(evaluateTarget(t, psnap({ state: "Hospital" }), "player", NOW + 3000), []);
  evaluateTarget(t, psnap({ state: "Okay" }), "player", NOW + 4000);
  assert.deepEqual(evaluateTarget(t, psnap({ state: "Hospital" }), "player", NOW + COOLDOWN_MS + 5000), ["hospital"]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /opt/warboard/server && node --test stakeout-watcher.test.js`
Expected: FAIL — `evaluateTarget is not a function`.

- [ ] **Step 3: Write the minimal implementation**

Add to `server/stakeout-watcher.js`:
```js
export function evaluateTarget(target, snap, kind, now, cooldownMs = COOLDOWN_MS) {
  if (!target.seeded) { target.info = snap; target.seeded = true; return []; }
  const old = target.info;
  const fired = kind === "faction"
    ? engine.evaluateFaction(old, snap, target.alerts)
    : engine.evaluatePlayer(old, snap, target.alerts, now);
  if (!target.lastFiredAt) target.lastFiredAt = {};
  const deliver = [];
  for (const k of fired) {
    const last = target.lastFiredAt[k];
    if (last === undefined || now - last >= cooldownMs) { target.lastFiredAt[k] = now; deliver.push(k); }
  }
  target.info = snap; // ALWAYS re-arm
  return deliver;
}
```
> The `last === undefined` guard ensures a first-ever fire is never suppressed by the cooldown (matches the intent of `price-watcher.js:92` without its `|| 0` trap).

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

Add to `server/stakeout-watcher.js` (put the `import * as push` at the **top** with the other imports):
```js
import * as push from "./push-notifications.js";

const TRIGGER_TEXT = {
  online: "is online", okay: "is out of hospital", hospital: "is hospitalized",
  landing: "has landed", revivable: "is revivable", life: "life dropped below your threshold",
  offline: "has gone offline", chainReaches: "chain alert", memberCountDrops: "lost members",
  rankedWarStarts: "started a ranked war", inRaid: "is in a raid", inTerritoryWar: "is in a territory war",
};
function humanTrigger(k) { return TRIGGER_TEXT[k] || k; }

export function buildStakeoutPayload(targetId, snap, firedKeys, kind) {
  const id = String(targetId);
  const name = (snap && snap.name) || (kind === "faction" ? `Faction ${id}` : `Player ${id}`);
  const url = kind === "faction"
    ? `https://www.torn.com/factions.php?step=profile&ID=${id}`
    : `https://www.torn.com/profiles.php?XID=${id}`;
  return {
    title: "Stakeout",
    body: `${name} ${humanTrigger(firedKeys[0])}`,
    tag: `stakeout-${id}`,
    threadId: "stakeout",
    icon: "/icon-192.png",
    data: { type: "stakeout_alert", targetId: id, trigger: firedKeys[0], url },
  };
}

export async function notifyStakeoutAlert(subscriberIds, targetId, snap, firedKeys, kind) {
  if (!subscriberIds?.length || !firedKeys?.length) return;
  try {
    await push.sendToPlayers(subscriberIds.map(String), buildStakeoutPayload(targetId, snap, firedKeys, kind), "stakeout_alert");
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

- [ ] **Step 1: Write the failing test**

Append to `server/stakeout-watcher.test.js`:
```js
import { NOTIFICATION_TYPES, getPreferences } from "./push-notifications.js";

test("stakeout_alert type registered, default on, in preferences", () => {
  assert.ok(NOTIFICATION_TYPES.stakeout_alert);
  assert.equal(NOTIFICATION_TYPES.stakeout_alert.default, true);
  assert.equal(NOTIFICATION_TYPES.stakeout_alert.oc, undefined);
  assert.equal(getPreferences("000")["stakeout_alert"], true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /opt/warboard/server && node --test stakeout-watcher.test.js`
Expected: FAIL — `NOTIFICATION_TYPES.stakeout_alert` undefined.

- [ ] **Step 3: Write the minimal implementation**

In `server/push-notifications.js`, add to `NOTIFICATION_TYPES` (after `enemy_surge`, before the `oc:`-marked block):
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

## Task 8: `runPoll` — per owner, decrypt their key, poll only their targets

**Files:**
- Modify: `server/stakeout-watcher.js`
- Test: `server/stakeout-watcher.test.js`

Iterate owners; decrypt each owner's key; poll each of their targets once with that key; fire to that owner. A target shared by two owners is fetched once **per owner**. Idle short-circuit when no owners.

- [ ] **Step 1: Write the failing test**

Append to `server/stakeout-watcher.test.js`:
```js
import { runPoll } from "./stakeout-watcher.js";
import * as stkStore from "./stakeout-store.js";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join as pathJoin } from "node:path";

const profile = (state) => ({ profile: { name: "Bob", status: { state, description: "" }, last_action: { status: "Online", timestamp: 1 }, life: { current: 100, maximum: 100 }, revivable: false } });

test("runPoll: per-owner key, fires on transition; shared target fetched once per owner", async () => {
  process.env.DATA_DIR = mkdtempSync(pathJoin(tmpdir(), "stk-"));
  stkStore.load();
  stkStore.syncOwner("111", "ENC_A", [{ id: 5, label: "", alerts: { hospital: true } }], []);
  stkStore.syncOwner("222", "ENC_B", [{ id: 5, label: "", alerts: { hospital: true } }], []);

  const calls = [], sent = [];
  let state = "Okay";
  const fetchImpl = async (kind, id, key) => { calls.push(`${key}:${kind}:${id}`); return profile(state); };
  const sendImpl = async (ids, targetId, snap, keys) => { sent.push({ ids, keys }); };
  const decryptKey = (enc) => (enc === "ENC_A" ? "KEY_A" : "KEY_B");

  await runPoll({ fetchImpl, sendImpl, nowFn: () => 1000, decryptKey });   // seed both
  assert.deepEqual(calls.sort(), ["KEY_A:player:5", "KEY_B:player:5"], "each owner's own key, fetched per owner");
  state = "Hospital";
  await runPoll({ fetchImpl, sendImpl, nowFn: () => 2000, decryptKey });   // both fire
  assert.equal(sent.length, 2);
  assert.deepEqual(sent[0].keys, ["hospital"]);
});

test("runPoll: idle short-circuit (no owners) does zero fetches", async () => {
  process.env.DATA_DIR = mkdtempSync(pathJoin(tmpdir(), "stk-"));
  stkStore.load();
  let fetched = 0;
  const r = await runPoll({ fetchImpl: async () => { fetched++; return {}; }, sendImpl: async () => {}, nowFn: () => 1, decryptKey: () => "K" });
  assert.equal(fetched, 0);
  assert.equal(r.owners, 0);
});

test("runPoll: owner whose key won't decrypt is skipped", async () => {
  process.env.DATA_DIR = mkdtempSync(pathJoin(tmpdir(), "stk-"));
  stkStore.load();
  stkStore.syncOwner("111", "BAD", [{ id: 7, label: "", alerts: { online: true } }], []);
  let fetched = 0;
  await runPoll({ fetchImpl: async () => { fetched++; return {}; }, sendImpl: async () => {}, nowFn: () => 1, decryptKey: () => { throw new Error("bad"); } });
  assert.equal(fetched, 0);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /opt/warboard/server && node --test stakeout-watcher.test.js`
Expected: FAIL — `runPoll is not a function`.

- [ ] **Step 3: Write the minimal implementation**

Add to `server/stakeout-watcher.js` (imports at the **top**):
```js
import * as stakeoutStore from "./stakeout-store.js";
import { decrypt } from "./key-encryption.js";

async function _fetchTorn(kind, id, key) {
  const section = kind === "faction" ? "faction" : "user";
  const selections = kind === "faction" ? "basic,chain,wars" : "profile";
  const url = `https://api.torn.com/v2/${section}/${id}?selections=${selections}&comment=wb-stakeout`;
  const res = await fetch(url, { headers: { Authorization: `ApiKey ${key}`, Accept: "application/json" } });
  const json = await res.json();
  if (!json || json.error) return null;
  return json;
}

export async function runPoll(opts = {}) {
  const fetchImpl = opts.fetchImpl || _fetchTorn;
  const sendImpl = opts.sendImpl || notifyStakeoutAlert;
  const nowFn = opts.nowFn || Date.now;
  const decryptKey = opts.decryptKey || decrypt;
  const st = stakeoutStore.getState();
  const ownerIds = Object.keys(st.owners || {});
  let polled = 0, fired = 0;
  if (ownerIds.length === 0) return { owners: 0, polled, fired };
  for (const ownerId of ownerIds) {
    const owner = st.owners[ownerId];
    let key;
    try { key = decryptKey(owner.key); } catch { key = null; }
    if (!key) continue;
    for (const [kind, map] of [["player", owner.players || {}], ["faction", owner.factions || {}]]) {
      for (const [id, target] of Object.entries(map)) {
        let json;
        try { json = await fetchImpl(kind, id, key); } catch { json = null; }
        if (!json) continue; // bad read -> do not touch info
        const snap = kind === "faction" ? engine.mapFactionResponse(json) : engine.mapPlayerResponse(json);
        const firedKeys = evaluateTarget(target, snap, kind, nowFn());
        polled++;
        if (firedKeys.length) { await sendImpl([ownerId], id, snap, firedKeys, kind); fired++; }
      }
    }
  }
  stakeoutStore.scheduleSave();
  return { owners: ownerIds.length, polled, fired };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /opt/warboard/server && node --test stakeout-watcher.test.js`
Expected: PASS — 9 tests, 0 fail.

- [ ] **Step 5: Add `startWatcher`/`stopWatcher`, verify import, commit**

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
Run: `cd /opt/warboard/server && node --check stakeout-watcher.js && node --input-type=module -e "import('./stakeout-watcher.js').then(()=>console.log('import ok'))"`
Expected: `import ok`.
```bash
cd /opt/warboard && git add server/stakeout-watcher.js server/stakeout-watcher.test.js
git commit -m "feat(stakeout): per-owner runPoll (own key, isolated) + start/stop

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 9: `resolveOwnerId` + `handleStakeoutSync` + unauthenticated rate-limited route

**Files:**
- Modify: `server/stakeout-store.js` (resolver + handler)
- Modify: `server/routes.js` (route), `server/server.js` (rate limiter)
- Test: `server/stakeout-store.test.js`

The endpoint takes the raw `apiKey`, resolves the owner via one Torn `/user` call, encrypts the key, and stores it with the watch list. No warboard JWT/auth/faction-lock.

- [ ] **Step 1: Write the failing test**

Append to `server/stakeout-store.test.js`:
```js
import { handleStakeoutSync, resolveOwnerId } from "./stakeout-store.js";

function stubRes() { return { _s: 200, _j: null, status(c){this._s=c;return this;}, json(o){this._j=o;return this;} }; }

test("resolveOwnerId: parses player_id, null on error", async () => {
  const ok = async () => ({ ok: true, json: async () => ({ player_id: 137558, name: "Rob" }) });
  assert.equal(await resolveOwnerId("K", ok), "137558");
  const bad = async () => ({ ok: true, json: async () => ({ error: { code: 2, error: "Incorrect key" } }) });
  assert.equal(await resolveOwnerId("K", bad), null);
});

test("handleStakeoutSync: resolves owner from key, encrypts, stores", async () => {
  process.env.DATA_DIR = mkdtempSync(pathJoin(tmpdir(), "stk-"));
  load();
  const req = { body: { apiKey: "RAWKEY", players: [{ id: 5, alerts: { online: true } }], factions: [] } };
  const res = stubRes();
  await handleStakeoutSync(req, res, { resolveOwnerId: async () => "137558", encrypt: (s) => "ENC(" + s + ")" });
  assert.equal(res._s, 200);
  assert.deepEqual(res._j, { ok: true, players: 1, factions: 0 });
  assert.equal(getState().owners["137558"].key, "ENC(RAWKEY)");
  assert.equal(getState().owners["137558"].players["5"].alerts.online, true);
});

test("handleStakeoutSync: 400 without apiKey, 401 on bad key", async () => {
  load();
  const r1 = stubRes();
  await handleStakeoutSync({ body: { players: [] } }, r1, { resolveOwnerId: async () => "1", encrypt: (s) => s });
  assert.equal(r1._s, 400);
  const r2 = stubRes();
  await handleStakeoutSync({ body: { apiKey: "x", players: [{ id: 5, alerts: {} }] } }, r2, { resolveOwnerId: async () => null, encrypt: (s) => s });
  assert.equal(r2._s, 401);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /opt/warboard/server && node --test stakeout-store.test.js`
Expected: FAIL — `handleStakeoutSync`/`resolveOwnerId` not exported.

- [ ] **Step 3: Implement resolver + handler, then wire the route**

Add to `server/stakeout-store.js` (`encrypt` import at top):
```js
import { encrypt } from "./key-encryption.js";

export async function resolveOwnerId(apiKey, fetchImpl = fetch) {
  const url = `https://api.torn.com/user/?selections=basic&key=${encodeURIComponent(apiKey)}&comment=wb-stakeout`;
  const res = await fetchImpl(url);
  if (!res || !res.ok) return null;
  const data = await res.json();
  if (!data || data.error || data.player_id == null) return null;
  return String(data.player_id);
}

export async function handleStakeoutSync(req, res, deps = {}) {
  const resolve = deps.resolveOwnerId || resolveOwnerId;
  const enc = deps.encrypt || encrypt;
  const body = req.body || {};
  const apiKey = typeof body.apiKey === "string" ? body.apiKey.trim() : "";
  if (!apiKey) return res.status(400).json({ error: "apiKey is required" });
  let ownerId = null;
  try { ownerId = await resolve(apiKey); } catch { ownerId = null; }
  if (!ownerId) return res.status(401).json({ error: "invalid Torn API key" });
  const { players, factions } = validateStakeoutSync(body);
  syncOwner(ownerId, enc(apiKey), players, factions);
  return res.json({ ok: true, players: players.length, factions: factions.length });
}
```
In `server/routes.js` (add `handleStakeoutSync` to the existing top-of-file `./stakeout-store.js` import — if none exists yet, add `import { handleStakeoutSync } from "./stakeout-store.js";` with the other imports):
```js
router.post("/api/stakeout/sync", express.json({ limit: "16kb" }), (req, res) => handleStakeoutSync(req, res));
```
In `server/server.js`, near the other `rateLimit(...)` limiter definitions (~`server.js:195`):
```js
const stakeoutSyncLimiter = rateLimit({ windowMs: 5 * 60_000, max: 60, standardHeaders: true, legacyHeaders: false });
```
and mount it with the others (~`server.js:213`):
```js
app.use('/api/stakeout/sync', stakeoutSyncLimiter);
```

- [ ] **Step 4: Run tests + syntax checks**

Run: `cd /opt/warboard/server && node --test stakeout-store.test.js && node --check routes.js && node --check server.js`
Expected: PASS — 9 tests; both `--check` exit 0.

- [ ] **Step 5: Commit**
```bash
cd /opt/warboard && git add server/stakeout-store.js server/stakeout-store.test.js server/routes.js server/server.js
git commit -m "feat(stakeout): unauthenticated /api/stakeout/sync (key->owner, encrypt, rate-limit)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 10: wire the watcher into boot + shutdown (env-gated)

**Files:**
- Modify: `server/server.js` (~`server.js:590` boot; `shutdown()` ~`server.js:838`)

- [ ] **Step 1: Imports + boot wiring**

Top of `server/server.js`:
```js
import * as stakeoutStore from "./stakeout-store.js";
import { startWatcher as startStakeoutWatcher, stopWatcher as stopStakeoutWatcher } from "./stakeout-watcher.js";
```
Near `priceWatcher.load();` (`server.js:590`):
```js
stakeoutStore.load();
if (process.env.STAKEOUT_WATCHER === "1") startStakeoutWatcher();
else console.log("[stakeout-watcher] disabled (set STAKEOUT_WATCHER=1 to enable detection)");
```

- [ ] **Step 2: Shutdown** — next to `stopHeatmapFlush();` (`server.js:838`):
```js
  stopStakeoutWatcher();
```

- [ ] **Step 3: Syntax check + boot with detection OFF**

Run: `cd /opt/warboard/server && node --check server.js`
Expected: exit 0.
Run: `cd /opt/warboard && pm2 reload warboard && sleep 2 && curl -fsS http://127.0.0.1:3000/health && pm2 logs warboard --lines 30 --nostream | grep -i stakeout`
Expected: health OK; logs show `[stakeout-store] loaded 0 owner(s)` and `[stakeout-watcher] disabled (...)`. No poll traffic.

- [ ] **Step 4: Commit**
```bash
cd /opt/warboard && git add server/server.js
git commit -m "feat(stakeout): wire store load + env-gated watcher into boot/shutdown

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 11: userscript `syncUp` — POST {apiKey, players, factions} (no warboard auth)

**Files:**
- Modify: `server/public/scripts/torn-stakeout.user.js`

The script sends its key + lists straight to `/api/stakeout/sync`. **No `/api/auth`, no JWT.** No `//` comments in the body (house rule); keep the `==UserScript==` block.

- [ ] **Step 1: Confirm served version**

Run: `curl -fsS https://tornwar.com/scripts/torn-stakeout.user.js | grep -m1 '@version'`
New version = `max(local 1.0.15, served) + 1 patch` (e.g. `1.0.16`).

- [ ] **Step 2: Metadata** — ensure `// @connect      tornwar.com` is present; set `// @version      1.0.16` and the in-file `SCRIPT_VERSION` constant to the same value.

- [ ] **Step 3: Add `syncUp` (no comments)**

Inside the IIFE, after `getSettings`/`getPlayers`/`getFactions`:
```js
  var SYNC_URL = 'https://tornwar.com/api/stakeout/sync';
  function stripForSync(list, isPlayer) {
    return list.map(function (r) {
      var o = { id: r.id, alerts: r.alerts };
      if (isPlayer) o.label = r.label || '';
      return o;
    });
  }
  function syncUp() {
    var s = getSettings();
    if (!s.apiKey) return;
    GM_xmlhttpRequest({
      method: 'POST', url: SYNC_URL,
      headers: { 'Content-Type': 'application/json' },
      data: JSON.stringify({ apiKey: s.apiKey, players: stripForSync(getPlayers(), true), factions: stripForSync(getFactions(), false) }),
      onload: function () {}, onerror: function () {}
    });
  }
  var syncDebounce = null;
  function scheduleSync() {
    if (syncDebounce) clearTimeout(syncDebounce);
    syncDebounce = setTimeout(syncUp, 2000);
  }
```

- [ ] **Step 4: Trigger on change + heartbeat**

Call `scheduleSync()` **only** from the add-target, remove-target, and alert-toggle handlers (the `setPlayers(...)`/`setFactions(...)` calls inside *those*, around lines 368 / 373 / 379 / 380 / 427 / 429). **Do NOT** add it to `pollOnce`'s per-cycle `info` re-arm writes (near lines 172 / 184) — that would POST every ~30s and defeat the debounce. Add a heartbeat where polling starts:
```js
  setInterval(syncUp, 10 * 60 * 1000);
  syncUp();
```

- [ ] **Step 5: Syntax check + engine tests still pass**

Run: `cd /opt/warboard && node --check server/public/scripts/torn-stakeout.user.js && node --test test/stakeout.test.mjs`
Expected: `--check` exit 0; engine suite 18/18 (the added browser code never runs in node).

- [ ] **Step 6: Deploy + show served URL**

Run: `cd /opt/warboard && pm2 reload warboard && sleep 2 && curl -fsS http://127.0.0.1:3000/health && curl -fsS https://tornwar.com/scripts/torn-stakeout.user.js | grep -m1 '@version'`
Expected: health OK; served `@version` == new value.

- [ ] **Step 7: Commit + push (version boundary)**
```bash
cd /opt/warboard && git add server/public/scripts/torn-stakeout.user.js
git commit -m "feat(stakeout): sync watch list + own key to server for closed-app push (1.0.16)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
git push origin main
```
Report the install URL: `https://tornwar.com/scripts/torn-stakeout.user.js`.

---

## Enabling detection (after all tasks verified)

Detection is OFF by default. To switch on for the owner:
1. Add `STAKEOUT_WATCHER=1` to the process env (`server/ecosystem.config.cjs` env block — **targeted edit, never `git add -A`**).
2. `pm2 reload warboard && curl -fsS http://127.0.0.1:3000/health`.
3. `pm2 logs warboard --lines 50 --nostream | grep -i stakeout` — expect `[stakeout-watcher] started`, one fetch per watched target, no errors.
4. Confirm a real push end-to-end (take an alt online) before widening.

---

## Test runner + durability notes
- Each task runs its suite via `node --test <file>`. `package.json:10`'s `"test"` is NOT widened here (still `key-encryption.test.js`); widening to `node --test` pulls in the other suites and needs sign-off (deferred).
- Seed durability: first observation persists via the 1s `scheduleSave()` debounce; a hard kill in that window loses `seeded`/`info`, but the engine's `old===null → []` re-seeds silently on restart. `stopWatcher()`→`flushSync()` covers SIGTERM/SIGINT.

## Isolation self-check (the user's invariant)
- The stakeout key is read ONLY by: `resolveOwnerId` (one `/user` identity call) and `runPoll` (`_fetchTorn` against that owner's targets). Grep proof after build: `grep -rn "owner.key\|decrypt(" server/stakeout-*.js` should show decryption only in `runPoll`; `grep -rn "storeApiKey\|getPollingKey\|getApiKeyForPlayer" server/stakeout-*.js` must return **nothing** (no warboard pool/key-store coupling).
- `git grep -n "api/auth" server/public/scripts/torn-stakeout.user.js` must return **nothing** (the script never uses warboard's faction-locked auth).
