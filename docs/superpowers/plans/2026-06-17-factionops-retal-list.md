# FactionOps Retal List — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Add a live "incoming retal" list to FactionOps — recent enemy-faction attacks on our members, each with a 5-min retal countdown and one-tap Attack link, computed server-side from our faction's attack feed and pushed to the overlay.

**Architecture:** New server module `retal-tracker.js` (pure `computeIncomingRetals` + a self-managed, viewing-gated per-war poller) co-started with the war-status monitor. It fetches OUR faction's attacks via attacks-capable pool keys, writes `war.incomingRetals`, and the existing `/api/poll` + realtime snapshot carries it to FactionOps, which renders a collapsible overlay section with a 1s countdown ticker.

**Tech Stack:** Node ESM (type:module), `node --test`; Tampermonkey/PDA userscript (IIFE, no build).

**Spec:** `docs/superpowers/specs/2026-06-17-factionops-retal-list-design.md`

**Constants:** `RETAL_WINDOW_SEC=300`, `RETAL_INTERVAL_MS=20000`, `RETAL_ACTIVE_MS=60000` (viewing freshness), `RETAL_LOOKBACK_SEC=420` (fetch `from`), `MAX_BACKOFF_MS=120000`.

---

### Task 1: Server pure helper `computeIncomingRetals` (TDD)

**Files:**
- Create: `/opt/warboard/server/retal-list.test.js`
- Create: `/opt/warboard/server/retal-tracker.js` (helper only this task)

- [ ] **Step 1: Write the failing test** — `/opt/warboard/server/retal-list.test.js`

```js
import test from "node:test";
import assert from "node:assert/strict";
import { computeIncomingRetals } from "./retal-tracker.js";

const NOW = 1781700000;
const ENEMY = 44092;
// helper: a v1 faction-attack object (our faction's log)
function atk(o) {
  return Object.assign({
    code: "c" + (o.attacker_id || "x"),
    attacker_id: 100, attacker_name: "Foe", attacker_faction: ENEMY,
    defender_id: 5, defender_name: "Us", result: "Hospitalized",
    timestamp_ended: NOW - 60, timestamp_started: NOW - 70,
  }, o);
}

test("includes an in-window enemy attack on us", () => {
  const r = computeIncomingRetals([atk({})], ENEMY, NOW);
  assert.equal(r.length, 1);
  assert.deepEqual(r[0], {
    attackId: "c100", attackerId: 100, attackerName: "Foe",
    defenderId: 5, defenderName: "Us", result: "Hospitalized",
    endedTs: NOW - 60, attackerLevel: null,
  });
});

test("excludes attacks by non-enemy factions", () => {
  assert.equal(computeIncomingRetals([atk({ attacker_faction: 999 })], ENEMY, NOW).length, 0);
});

test("excludes stealthed attacks (no attacker id)", () => {
  assert.equal(computeIncomingRetals([atk({ attacker_id: "" })], ENEMY, NOW).length, 0);
});

test("excludes attacks older than the 5-min window", () => {
  assert.equal(computeIncomingRetals([atk({ timestamp_ended: NOW - 301 })], ENEMY, NOW).length, 0);
});

test("reads attacker_faction_id when attacker_faction is absent", () => {
  const a = atk({}); delete a.attacker_faction; a.attacker_faction_id = ENEMY;
  assert.equal(computeIncomingRetals([a], ENEMY, NOW).length, 1);
});

test("sorts newest-first", () => {
  const r = computeIncomingRetals(
    [atk({ attacker_id: 1, timestamp_ended: NOW - 200 }), atk({ attacker_id: 2, timestamp_ended: NOW - 30 })],
    ENEMY, NOW);
  assert.deepEqual(r.map(x => x.attackerId), [2, 1]);
});

test("enriches attacker level from enemyStatuses", () => {
  const r = computeIncomingRetals([atk({ attacker_id: 7 })], ENEMY, NOW, 300, { "7": { level: 80 } });
  assert.equal(r[0].attackerLevel, 80);
});

test("falls back to attackerId-endedTs when code missing", () => {
  const a = atk({ attacker_id: 9 }); delete a.code;
  assert.equal(computeIncomingRetals([a], ENEMY, NOW)[0].attackId, "9-" + (NOW - 60));
});

test("empty / non-array input returns []", () => {
  assert.deepEqual(computeIncomingRetals(null, ENEMY, NOW), []);
  assert.deepEqual(computeIncomingRetals([], ENEMY, NOW), []);
  assert.deepEqual(computeIncomingRetals([atk({})], null, NOW), []);
});
```

- [ ] **Step 2: Run — expect FAIL** (module/function missing)

Run: `cd /opt/warboard/server && node --test retal-list.test.js`
Expected: FAIL — cannot find `./retal-tracker.js` / `computeIncomingRetals` not a function.

- [ ] **Step 3: Create `/opt/warboard/server/retal-tracker.js` with just the helper**

```js
import * as store from "./store.js";
import { fetchRecentFactionAttacks } from "./torn-api.js";
import { broadcastSSE } from "./routes.js";

export const RETAL_WINDOW_SEC = 300;
const RETAL_INTERVAL_MS = 20_000;
const RETAL_ACTIVE_MS   = 60_000;
const RETAL_LOOKBACK_SEC = 420;
const MAX_BACKOFF_MS    = 120_000;

/**
 * Build the incoming-retal list from OUR faction's attack log: enemy-faction
 * attacks on our members still inside the retal-bonus window. Pure + tested.
 */
export function computeIncomingRetals(attacks, enemyFactionId, nowSec, windowSec = RETAL_WINDOW_SEC, enemyStatuses = {}) {
  if (!Array.isArray(attacks) || !enemyFactionId) return [];
  const enemyFid = String(enemyFactionId);
  const out = [];
  for (const a of attacks) {
    const attackerFid = String(a.attacker_faction ?? a.attacker_faction_id ?? "");
    if (attackerFid !== enemyFid) continue;
    const attackerId = String(a.attacker_id ?? "");
    if (!attackerId) continue;
    const endedTs = Number(a.timestamp_ended || a.timestamp_started || 0);
    if (!endedTs || endedTs < nowSec - windowSec) continue;
    const lvl = enemyStatuses[attackerId] && enemyStatuses[attackerId].level;
    out.push({
      attackId: String(a.code || (attackerId + "-" + endedTs)),
      attackerId: Number(attackerId),
      attackerName: a.attacker_name || "",
      defenderId: Number(a.defender_id || 0),
      defenderName: a.defender_name || "",
      result: a.result || "",
      endedTs,
      attackerLevel: lvl != null ? Number(lvl) : null,
    });
  }
  out.sort((x, y) => y.endedTs - x.endedTs);
  return out;
}
```

- [ ] **Step 4: Run — expect PASS** (9/9)

Run: `cd /opt/warboard/server && node --test retal-list.test.js`
Expected: `# pass 9 # fail 0`.

- [ ] **Step 5: Commit**

```bash
cd /opt/warboard
git add server/retal-tracker.js server/retal-list.test.js
git commit -m "feat(retal): computeIncomingRetals pure helper + tests"
```

---

### Task 2: Pool-key routing + war object fields (store.js)

**Files:**
- Modify: `/opt/warboard/server/store.js` (PURPOSE_REQUIRED_SELECTION ~759; getOrCreateWar new-enemy reset ~204-235 and fresh-war literal ~240-252)

- [ ] **Step 1: Route the `retals` purpose to the `attacks` selection**

Edit the `PURPOSE_REQUIRED_SELECTION` object (add one line after `"xanax-tracker": "armorynews",`):

```js
  "xanax-tracker": "armorynews",
  "retals":        "attacks",
};
```

- [ ] **Step 2: Seed `incomingRetals` on the fresh-war literal**

In `getOrCreateWar`'s new-war object literal, after `enemyStatuses: {},` add:

```js
    enemyStatuses: {},
    incomingRetals: [],
```

- [ ] **Step 3: Clear `incomingRetals` on the new-enemy reset**

In the new-enemy reset block, right after `war.enemyStatuses = {};` add (prevents leaking retals across reused `war_<factionId>` opponents — same class of bug as xanaxStats):

```js
      war.enemyStatuses = {};
      war.incomingRetals = [];
```

- [ ] **Step 4: Verify syntax**

Run: `cd /opt/warboard/server && node --check store.js && node -e "import('./store.js').then(()=>console.log('OK'))"`
Expected: `CHECK` ok + `OK`. Then `node --test pool-routing.test.js` → still green (existing routing test).

- [ ] **Step 5: Commit**

```bash
cd /opt/warboard
git add server/store.js
git commit -m "feat(retal): route retals->attacks pool keys; seed/reset war.incomingRetals"
```

---

### Task 3: Viewing-gated poller in `retal-tracker.js` + wire into war-status-monitor

**Files:**
- Modify: `/opt/warboard/server/retal-tracker.js` (append poller)
- Modify: `/opt/warboard/server/war-status-monitor.js` (co-start at ~263 inside `startWarStatusMonitor`; teardown in `stopWarStatusMonitor` ~600 and `stopAll` ~635)

- [ ] **Step 1: Append the poller to `retal-tracker.js`**

```js
const retalTimeouts = new Map();
const retalCursors  = new Map();
const retalBackoffs = new Map();
let _io = null;

function viewed(warId, war) {
  const room = _io && _io.sockets && _io.sockets.adapter.rooms.get(`war_${warId}`);
  if (room && room.size > 0) return true;
  return Date.now() - (Number(war.lastClientPollAt) || 0) <= RETAL_ACTIVE_MS;
}

export function startRetalTracker(io, warId) {
  if (retalTimeouts.has(warId)) return;
  _io = io || _io;
  const schedule = (delay) => retalTimeouts.set(warId, setTimeout(poll, delay));

  async function poll() {
    const war = store.getWar(warId);
    if (!war || !war.enemyFactionId || war.warEnded) { schedule(RETAL_INTERVAL_MS); return; }
    if (!viewed(warId, war)) { retalBackoffs.delete(warId); schedule(RETAL_INTERVAL_MS); return; }

    const apiKey = store.getPollingKey(war.factionId, "retals", (retalCursors.get(warId) || 0) + 1);
    retalCursors.set(warId, (retalCursors.get(warId) || 0) + 1);
    if (!apiKey) { schedule(RETAL_INTERVAL_MS); return; }

    const nowSec = Math.floor(Date.now() / 1000);
    try {
      const attacks = await fetchRecentFactionAttacks(war.factionId, apiKey, nowSec - RETAL_LOOKBACK_SEC);
      retalBackoffs.delete(warId);
      const next = computeIncomingRetals(attacks, war.enemyFactionId, nowSec, RETAL_WINDOW_SEC, war.enemyStatuses || {});
      const changed = JSON.stringify(next) !== JSON.stringify(war.incomingRetals || []);
      war.incomingRetals = next;
      if (changed && _io) {
        _io.to(`war_${warId}`).emit("retals", { warId, retals: next });
        broadcastSSE(warId, { retals: next });
      }
      schedule(RETAL_INTERVAL_MS);
    } catch (err) {
      if (/Incorrect ID-entity relation/i.test(err.message)) store.quarantinePoolKey(apiKey, war.factionId, "retals code 7");
      else if (/Incorrect key|\(code 2\)/i.test(err.message)) store.quarantinePoolKey(apiKey, war.factionId, "retals code 2");
      const cur = retalBackoffs.get(warId) || RETAL_INTERVAL_MS;
      const back = Math.min(cur * 2, MAX_BACKOFF_MS);
      retalBackoffs.set(warId, back);
      console.warn(`[retals] war ${warId}: poll failed (${err.message}); retry in ${Math.round(back / 1000)}s`);
      schedule(back);
    }
  }

  schedule(1_000);
}

export function stopRetalTracker(warId) {
  const t = retalTimeouts.get(warId);
  if (t) clearTimeout(t);
  retalTimeouts.delete(warId);
  retalCursors.delete(warId);
  retalBackoffs.delete(warId);
}

export function stopAll() {
  for (const t of retalTimeouts.values()) clearTimeout(t);
  retalTimeouts.clear(); retalCursors.clear(); retalBackoffs.clear();
}
```

- [ ] **Step 2: Co-start in `war-status-monitor.js`** — add import near the existing imports (top, ~line 8):

```js
import { startRetalTracker, stopRetalTracker } from "./retal-tracker.js";
```

Inside `startWarStatusMonitor`, next to where `startAttacksFeedMonitor(io, warId)` is invoked (~line 263), add:

```js
    startRetalTracker(io, warId);
```

- [ ] **Step 3: Teardown** — in `stopWarStatusMonitor(warId)` (~line 600), next to the other per-war stops, add `stopRetalTracker(warId);`. In `stopAll()` (~line 635), import and call the tracker's `stopAll` (alias to avoid name clash):

At top import: `import { startRetalTracker, stopRetalTracker, stopAll as stopAllRetals } from "./retal-tracker.js";`
In this module's `stopAll`, add `stopAllRetals();`.

- [ ] **Step 4: Verify**

Run: `cd /opt/warboard/server && node --check retal-tracker.js && node --check war-status-monitor.js && node --test retal-list.test.js`
Expected: checks OK; tests still `# pass 9`.

- [ ] **Step 5: Commit**

```bash
cd /opt/warboard
git add server/retal-tracker.js server/war-status-monitor.js
git commit -m "feat(retal): viewing-gated poller, co-started with war-status monitor"
```

---

### Task 4: Serve `retals` + stamp viewing signal (routes.js)

**Files:**
- Modify: `/opt/warboard/server/routes.js` (snapshots at 226, 1469, 1507, 1592, 1756; stamps in /api/poll ~1669 and /api/stream ~1563)

- [ ] **Step 1: Add `retals` to all five war-snapshot objects.** Use these unique anchors:

Snapshot #1 (`const payload = {` block):
```js
    enemyStatuses: war.enemyStatuses,
    retals: war.incomingRetals || [],
    chainData: war.chainData,
```
Snapshot #4 (`const initial = {` block) — same insertion `retals: war.incomingRetals || [],` after `enemyStatuses: war.enemyStatuses,`.
Snapshot #5 (`return res.json({` at end of /api/poll) — same insertion after `enemyStatuses: war.enemyStatuses,`.
Snapshot #2 (/api/wars, 8-space, `war.*`) — after `        enemyStatuses: war.enemyStatuses,` add `        retals: war.incomingRetals || [],`.
Snapshot #3 (/api/wars ended-war, 8-space, `mostRecent.*`) — after `        enemyStatuses: mostRecent.enemyStatuses,` add `        retals: mostRecent.incomingRetals || [],`.

(For #1/#4/#5 the `enemyStatuses: war.enemyStatuses,\n    chainData` triple is identical — anchor each Edit by including the block's unique leading line: `const payload = {`, `const initial = {`, `return res.json({`.)

- [ ] **Step 2: Stamp the viewing signal in `/api/poll`** — after the faction-gate `}` (~line 1669), add:

```js
  war.lastClientPollAt = Date.now();
```

- [ ] **Step 3: Stamp the viewing signal in `/api/stream`** — after the faction-gate `}` (~line 1563), add the same line `  war.lastClientPollAt = Date.now();`.

- [ ] **Step 4: Verify**

Run: `cd /opt/warboard/server && node --check routes.js`
Expected: OK. Then `pm2 reload warboard` and `curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3000/health` → `200`.

- [ ] **Step 5: Commit**

```bash
cd /opt/warboard
git add server/routes.js
git commit -m "feat(retal): serve war.incomingRetals in snapshots; stamp lastClientPollAt"
```

---

### Task 5: FactionOps state + ingest + version bump

**Files:**
- Modify: `/opt/warboard/server/public/scripts/factionops.user.js` (@version L4, SCRIPT_VERSION L89, state literal ~2998, applyServerData ~4898)

- [ ] **Step 1: Check served version then bump both fields**

Run: `curl -s https://tornwar.com/scripts/factionops.meta.js | grep -m1 @version`
Set new = max(source 5.1.30, served)+1. Edit L4 `@version` and L89 `SCRIPT_VERSION` to the SAME value (plain semver, no suffix).

- [ ] **Step 2: Init `state.retals`** — in the `state = { ... }` literal (~2998), next to `calls`/`priorities`, add `retals: [],`.

- [ ] **Step 3: Ingest in `applyServerData`** — near the `calls`/`priorities` blocks, add:

```js
      if (data.retals) { state.retals = data.retals; if (typeof renderRetalList === 'function') renderRetalList(); }
```

- [ ] **Step 4: Add the socket listener** — in `connectRealtime()` after the `war_state` handler (~5208):

```js
      realtimeSocket.on('retals', (d) => applyServerData({ retals: (d && d.retals) || [] }));
```
(SSE flows through `applyServerData` automatically; no SSE change needed.)

- [ ] **Step 5: Verify syntax**

Run: `node --check /opt/warboard/server/public/scripts/factionops.user.js`
Expected: OK (no PASS yet — UI is rendered next task).

- [ ] **Step 6: Commit**

```bash
cd /opt/warboard
git add server/public/scripts/factionops.user.js
git commit -m "feat(retal): factionops ingests data.retals into state (vX.Y.Z)"
```

---

### Task 6: FactionOps overlay section + render + CSS + countdown

**Files:**
- Modify: `/opt/warboard/server/public/scripts/factionops.user.js` (skeleton ~9202, CSS ~2993, renderRetalList near 9816, renderOverlay end ~9811, 1s ticker ~9452)

- [ ] **Step 1: Add the section to the overlay skeleton** — between `</ul>` (L9202, the target list) and `<div class="fo-footer">` (L9203):

```html
            <div class="fo-retal-section" id="fo-retal-section" style="display:none;">
                <div class="fo-retal-header">⚔ Retal</div>
                <ul class="fo-retal-list" id="fo-retal-list"></ul>
            </div>
```

- [ ] **Step 2: Add CSS** — just before the closing `` `; `` of the `injectStyles` css template (L2993):

```css
.fo-retal-section{margin-top:8px;border-top:1px solid var(--wb-border,#2a3447);padding-top:6px;}
.fo-retal-header{font-size:11px;font-weight:700;text-transform:uppercase;color:var(--wb-hospital-red,#e03a3a);margin:0 0 4px 4px;letter-spacing:.5px;}
.fo-retal-list{list-style:none;margin:0;padding:0;}
.fo-retal-row{display:flex;align-items:center;gap:6px;padding:4px 6px;border-bottom:1px solid var(--wb-border,#1c2330);font-size:12px;}
.fo-retal-main{flex:1;min-width:0;}
.fo-retal-name{font-weight:600;color:var(--wb-text,#e6e8ee);text-decoration:none;}
.fo-retal-sub{font-size:10px;color:#9aa3b2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.fo-retal-cd{font-variant-numeric:tabular-nums;color:#ffb44d;font-weight:700;min-width:42px;text-align:right;}
.fo-retal-attack{background:linear-gradient(135deg,#ff6b52,#e03a3a);color:#fff;border:0;border-radius:5px;padding:3px 8px;font-size:11px;font-weight:700;text-decoration:none;box-shadow:0 1px 4px rgba(214,48,49,.3);}
```

- [ ] **Step 3: Define `renderRetalList()`** — as a sibling near `renderOverlayRow` (~9816):

```js
  function renderRetalList() {
    const sec = document.getElementById('fo-retal-section');
    const ul = document.getElementById('fo-retal-list');
    if (!sec || !ul) return;
    const list = Array.isArray(state.retals) ? state.retals : [];
    const nowSec = Math.floor(Date.now() / 1000);
    const live = list.filter(r => (r.endedTs + 300 - nowSec) > 0);
    sec.style.display = live.length ? 'block' : 'none';
    ul.innerHTML = live.map(r => {
      const rem = r.endedTs + 300 - nowSec;
      const mm = Math.floor(rem / 60), ss = String(rem % 60).padStart(2, '0');
      const lvl = r.attackerLevel ? ' [' + r.attackerLevel + ']' : '';
      return '<li class="fo-retal-row" data-fo-retal="' + r.attackId + '" data-ended="' + r.endedTs + '">'
        + '<div class="fo-retal-main">'
        + '<a class="fo-retal-name" href="/profiles.php?XID=' + r.attackerId + '" target="_blank" rel="noopener">'
        + escapeHtml(r.attackerName) + lvl + '</a>'
        + '<div class="fo-retal-sub">→ ' + escapeHtml(r.defenderName) + ' · ' + escapeHtml(r.result) + '</div>'
        + '</div>'
        + '<span class="fo-retal-cd" data-ended="' + r.endedTs + '">' + mm + ':' + ss + '</span>'
        + '<a class="fo-retal-attack" href="https://www.torn.com/page.php?sid=attack&user2ID=' + r.attackerId + '" target="_blank" rel="noopener">Attack</a>'
        + '</li>';
    }).join('');
    ul.querySelectorAll('a').forEach(a => a.addEventListener('click', e => e.stopPropagation()));
  }
```
(Reuse the existing `escapeHtml` helper — confirm its name in-file; if absent, inline a minimal escaper.)

- [ ] **Step 4: Call it from `renderOverlay`** — just before the final `}` (~L9811):

```js
        if (typeof renderRetalList === 'function') renderRetalList();
```

- [ ] **Step 5: Live countdown** — extend the existing 1s display ticker (`updateWarTimerDisplay`, registered ~9452) to repaint retal timers and drop expired rows. Append inside that function:

```js
    (function tickRetals() {
      const nowSec = Math.floor(Date.now() / 1000);
      document.querySelectorAll('#fo-retal-list .fo-retal-row').forEach(li => {
        const ended = Number(li.getAttribute('data-ended')) || 0;
        const rem = ended + 300 - nowSec;
        if (rem <= 0) { li.remove(); return; }
        const cd = li.querySelector('.fo-retal-cd');
        if (cd) cd.textContent = Math.floor(rem / 60) + ':' + String(rem % 60).padStart(2, '0');
      });
      const ul = document.getElementById('fo-retal-list'), sec = document.getElementById('fo-retal-section');
      if (sec && ul) sec.style.display = ul.children.length ? 'block' : 'none';
    })();
```

- [ ] **Step 6: Verify syntax + serve**

Run: `node --check /opt/warboard/server/public/scripts/factionops.user.js`
Then deploy copies if used (see Task 7).

- [ ] **Step 7: Commit**

```bash
cd /opt/warboard
git add server/public/scripts/factionops.user.js
git commit -m "feat(retal): factionops overlay retal section + live countdown"
```

---

### Task 7: Deploy, adversarial review, push

- [ ] **Step 1:** Full server suite green: `cd /opt/warboard/server && for t in *.test.js; do node --test "$t"; done` → all pass.
- [ ] **Step 2:** `pm2 reload warboard` → `curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3000/health` = `200`.
- [ ] **Step 3:** Confirm served userscript: `curl -s http://127.0.0.1:3000/scripts/factionops.user.js | grep -m1 @version` = new version; `grep -c fo-retal-list` ≥ 1.
- [ ] **Step 4:** Sync deploy copies if they exist (`/opt/warboard/client/factionops.user.js`, `/opt/warboard/public/scripts/factionops.user.js`) — diff against the served copy; update only if the deploy workflow requires it.
- [ ] **Step 5:** Adversarial review (workflow) of the full diff: server correctness (filter/window/leak-on-enemy-change), API snapshot coverage, viewing-gate, factionops wiring; fix anything Critical/Important.
- [ ] **Step 6:** Push: `git push origin HEAD`. Share `https://tornwar.com/scripts/factionops.user.js`.

---

## Out of scope (do not build)

Notifications/alerts; greyed history rows; client-direct `/v2/faction/attacks`; extra per-attacker profile calls for level; any change to the existing `⚠ Retal` request button; Android / web-app parity.
