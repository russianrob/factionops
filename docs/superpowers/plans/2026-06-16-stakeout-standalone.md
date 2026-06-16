# Standalone Stakeout Userscript — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port TornTools' Stakeout (player + faction monitoring with alerts) into one standalone Tampermonkey/PDA userscript at `server/public/scripts/torn-stakeout.user.js`.

**Architecture:** Single IIFE. A pure, unit-tested core (alert engine + v2 response mappers) is exposed for testing via a `module.exports` guard that early-returns in Node; everything below it (store, poller, notifier, UI) is browser-only and uses `window`/`document`/`GM_*`. Polling runs in page context via `setInterval` + `GM_xmlhttpRequest`; transitions are detected by diffing each poll's snapshot against the persisted last-known snapshot (this replaces TornTools' separate dedupe map — a persisted snapshot + edge detection fires each alert exactly once per transition).

**Tech Stack:** Vanilla ES5-style JS (userscript), `GM_setValue`/`GM_getValue`/`GM_xmlhttpRequest`/`GM_notification`, Torn API v2, Node's built-in `node:test` + `vm` for the pure-core tests.

**Spec:** `docs/superpowers/specs/2026-06-16-stakeout-standalone-design.md`

**Conventions (house rules — do not violate):**
- No descriptive `//` comments in the script body; keep only the `==UserScript==` metadata block.
- `@version` header and an in-file `SCRIPT_VERSION` constant stay in sync.
- `@namespace`/`@author` = `RussianRob`; `@description` credits "forked from TornTools"; `@license GPL-3.0-or-later`.
- Run `node --check <file>` after every edit. Deploy = save to `server/public/scripts/` (served live); verify with `curl`.
- Commit at each task boundary with a targeted `git add <specific files>` (NEVER `git add -A` in this repo — it sweeps a 100MB+ apk and breaks the push).

---

## Data shapes (used by every task — keep names identical)

**Player snapshot (flat):** `{ name, state, description, lastAction, lastActionTs, lifeCur, lifeMax, revivable }`
**Faction snapshot (flat):** `{ name, chain, respect, membersCur, membersMax, rankedWar, raid, territoryWar }`

**Player alerts:** `{ okay:bool, hospital:bool, landing:bool, online:bool, life:number|false, offline:number|false, revivable:bool }`
**Faction alerts:** `{ chainReaches:number|false, memberCountDrops:number|false, rankedWarStarts:bool, inRaid:bool, inTerritoryWar:bool }`

**Player record:** `{ id:number, order:number, label:string, info:PlayerSnapshot|null, alerts:PlayerAlerts }`
**Faction record:** `{ id:number, order:number, info:FactionSnapshot|null, alerts:FactionAlerts }`

**Store keys (GM):** `stakeout_players`, `stakeout_factions`, `stakeout_settings`
**Settings:** `{ apiKey:string, pollSeconds:number, sound:boolean, panelOpen:boolean, panelPos:{x,y}|null }` (defaults: `apiKey:''`, `pollSeconds:30`, `sound:true`, `panelOpen:false`, `panelPos:null`)

---

## Task 1: Pure core — alert engine + response mappers (TDD)

**Files:**
- Create: `server/public/scripts/torn-stakeout.user.js`
- Create: `test/stakeout.test.mjs`

- [ ] **Step 1: Write the failing test**

Create `test/stakeout.test.mjs`:

```js
import { readFileSync } from "node:fs";
import vm from "node:vm";
import assert from "node:assert/strict";
import test from "node:test";

function load() {
  const src = readFileSync("/opt/warboard/server/public/scripts/torn-stakeout.user.js", "utf8");
  const sandbox = { module: { exports: {} }, console };
  vm.runInNewContext(src, sandbox, { filename: "torn-stakeout.user.js" });
  return sandbox.module.exports;
}
const S = load();
const NOW = 1_700_000_000_000; // fixed "now" in ms for offline tests

// ---- hoursSince ----
test("hoursSince: 2h ago", () => {
  assert.equal(S.hoursSince(NOW / 1000 - 2 * 3600, NOW), 2);
});

// ---- evaluatePlayer ----
const P_ALERTS = { okay: true, hospital: true, landing: true, online: true, life: 25, offline: 5, revivable: true };
function psnap(o) {
  return Object.assign({ name: "X", state: "Okay", description: "", lastAction: "Offline", lastActionTs: NOW / 1000, lifeCur: 100, lifeMax: 100, revivable: false }, o);
}
test("evaluatePlayer: null old → baseline, no fire", () => {
  assert.deepEqual(S.evaluatePlayer(null, psnap({}), P_ALERTS, NOW), []);
});
test("evaluatePlayer: okay transition fires once", () => {
  const old = psnap({ state: "Hospital" });
  assert.deepEqual(S.evaluatePlayer(old, psnap({ state: "Okay" }), P_ALERTS, NOW), ["okay"]);
  assert.deepEqual(S.evaluatePlayer(psnap({ state: "Okay" }), psnap({ state: "Okay" }), P_ALERTS, NOW), []);
});
test("evaluatePlayer: hospital transition", () => {
  assert.deepEqual(S.evaluatePlayer(psnap({ state: "Okay" }), psnap({ state: "Hospital" }), P_ALERTS, NOW), ["hospital"]);
});
test("evaluatePlayer: landing fires only from Traveling", () => {
  assert.deepEqual(S.evaluatePlayer(psnap({ state: "Traveling" }), psnap({ state: "Okay" }), P_ALERTS, NOW), ["landing", "okay"]);
  assert.deepEqual(S.evaluatePlayer(psnap({ state: "Okay" }), psnap({ state: "Okay" }), P_ALERTS, NOW), []);
});
test("evaluatePlayer: online transition", () => {
  assert.deepEqual(S.evaluatePlayer(psnap({ lastAction: "Offline" }), psnap({ lastAction: "Online" }), P_ALERTS, NOW), ["online"]);
});
test("evaluatePlayer: life fires on crossing below threshold", () => {
  assert.deepEqual(S.evaluatePlayer(psnap({ lifeCur: 50 }), psnap({ lifeCur: 20 }), P_ALERTS, NOW), ["life"]);
  assert.deepEqual(S.evaluatePlayer(psnap({ lifeCur: 20 }), psnap({ lifeCur: 15 }), P_ALERTS, NOW), []);
});
test("evaluatePlayer: offline fires on crossing N hours", () => {
  const old = psnap({ lastActionTs: NOW / 1000 - 4 * 3600 });
  const snap = psnap({ lastActionTs: NOW / 1000 - 6 * 3600 });
  assert.deepEqual(S.evaluatePlayer(old, snap, P_ALERTS, NOW), ["offline"]);
});
test("evaluatePlayer: revivable false→true", () => {
  assert.deepEqual(S.evaluatePlayer(psnap({ revivable: false }), psnap({ revivable: true }), P_ALERTS, NOW), ["revivable"]);
});
test("evaluatePlayer: disabled alerts never fire", () => {
  const none = { okay: false, hospital: false, landing: false, online: false, life: false, offline: false, revivable: false };
  assert.deepEqual(S.evaluatePlayer(psnap({ state: "Hospital" }), psnap({ state: "Okay" }), none, NOW), []);
});

// ---- evaluateFaction ----
const F_ALERTS = { chainReaches: 100, memberCountDrops: 80, rankedWarStarts: true, inRaid: true, inTerritoryWar: true };
function fsnap(o) {
  return Object.assign({ name: "F", chain: 0, respect: 0, membersCur: 100, membersMax: 100, rankedWar: false, raid: false, territoryWar: false }, o);
}
test("evaluateFaction: null old → no fire", () => {
  assert.deepEqual(S.evaluateFaction(null, fsnap({}), F_ALERTS), []);
});
test("evaluateFaction: chainReaches crossing up", () => {
  assert.deepEqual(S.evaluateFaction(fsnap({ chain: 90 }), fsnap({ chain: 100 }), F_ALERTS), ["chainReaches"]);
  assert.deepEqual(S.evaluateFaction(fsnap({ chain: 100 }), fsnap({ chain: 110 }), F_ALERTS), []);
});
test("evaluateFaction: chainReaches===0 fires when an active chain drops", () => {
  const drop = { chainReaches: 0, memberCountDrops: false, rankedWarStarts: false, inRaid: false, inTerritoryWar: false };
  assert.deepEqual(S.evaluateFaction(fsnap({ chain: 47 }), fsnap({ chain: 0 }), drop), ["chainReaches"]);
  assert.deepEqual(S.evaluateFaction(fsnap({ chain: 5 }), fsnap({ chain: 0 }), drop), []); // below 10 → not "active"
});
test("evaluateFaction: memberCountDrops below N", () => {
  assert.deepEqual(S.evaluateFaction(fsnap({ membersCur: 85 }), fsnap({ membersCur: 79 }), F_ALERTS), ["memberCountDrops"]);
});
test("evaluateFaction: war/raid/territory transitions", () => {
  assert.deepEqual(S.evaluateFaction(fsnap({ rankedWar: false }), fsnap({ rankedWar: true }), F_ALERTS), ["rankedWarStarts"]);
  assert.deepEqual(S.evaluateFaction(fsnap({ raid: false }), fsnap({ raid: true }), F_ALERTS), ["inRaid"]);
  assert.deepEqual(S.evaluateFaction(fsnap({ territoryWar: false }), fsnap({ territoryWar: true }), F_ALERTS), ["inTerritoryWar"]);
});

// ---- response mappers ----
test("mapPlayerResponse: v2 user/profile → snapshot", () => {
  const j = { name: "Bob", life: { current: 80, maximum: 100 }, status: { state: "Hospital", description: "In hospital for 10 mins" }, last_action: { status: "Online", timestamp: 1699999000 }, revivable: 1 };
  assert.deepEqual(S.mapPlayerResponse(j), { name: "Bob", state: "Hospital", description: "In hospital for 10 mins", lastAction: "Online", lastActionTs: 1699999000, lifeCur: 80, lifeMax: 100, revivable: true });
});
test("mapFactionResponse: v2 basic+chain+wars → snapshot", () => {
  const j = { basic: { name: "Enemy", respect: 5000, members: 81, capacity: 100 }, chain: { current: 47 }, wars: { ranked: { war_id: 1 }, raids: [], territory: [{ id: 1 }] } };
  assert.deepEqual(S.mapFactionResponse(j), { name: "Enemy", chain: 47, respect: 5000, membersCur: 81, membersMax: 100, rankedWar: true, raid: false, territoryWar: true });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd /opt/warboard && node --test test/stakeout.test.mjs`
Expected: FAIL — the script file does not exist yet (`ENOENT`) or `module.exports` is empty so `S.hoursSince` is undefined.

- [ ] **Step 3: Write the minimal implementation (pure core + test hook)**

Create `server/public/scripts/torn-stakeout.user.js`:

```js
// ==UserScript==
// @name         Stakeout
// @namespace    RussianRob
// @version      1.0.0
// @description  Stake out players and factions with status alerts (online, hospital, landing, life, chain, war...) — forked from TornTools
// @author       RussianRob
// @license      GPL-3.0-or-later
// @match        https://www.torn.com/*
// @connect      api.torn.com
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_xmlhttpRequest
// @grant        GM_notification
// @grant        GM_registerMenuCommand
// @run-at       document-idle
// @downloadURL  https://tornwar.com/scripts/torn-stakeout.user.js
// @updateURL    https://tornwar.com/scripts/torn-stakeout.user.js
// ==/UserScript==
(function () {
  'use strict';
  var SCRIPT_VERSION = '1.0.0';

  function hoursSince(tsSec, nowMs) {
    return (nowMs / 1000 - tsSec) / 3600;
  }

  function evaluatePlayer(old, snap, alerts, nowMs) {
    if (!old) return [];
    var fired = [];
    if (alerts.landing && old.state === 'Traveling' && snap.state !== 'Traveling') fired.push('landing');
    if (alerts.okay && snap.state === 'Okay' && old.state !== 'Okay') fired.push('okay');
    if (alerts.hospital && snap.state === 'Hospital' && old.state !== 'Hospital') fired.push('hospital');
    if (alerts.online && snap.lastAction === 'Online' && old.lastAction !== 'Online') fired.push('online');
    if (alerts.life !== false) {
      var thr = snap.lifeMax * (alerts.life / 100);
      var oThr = old.lifeMax * (alerts.life / 100);
      if (snap.lifeCur <= thr && !(old.lifeCur <= oThr)) fired.push('life');
    }
    if (alerts.offline !== false) {
      if (hoursSince(snap.lastActionTs, nowMs) >= alerts.offline && hoursSince(old.lastActionTs, nowMs) < alerts.offline) fired.push('offline');
    }
    if (alerts.revivable && snap.revivable && !old.revivable) fired.push('revivable');
    return fired;
  }

  function evaluateFaction(old, snap, alerts) {
    if (!old) return [];
    var fired = [];
    if (alerts.chainReaches !== false) {
      if (alerts.chainReaches === 0) {
        if (old.chain >= 10 && snap.chain === 0) fired.push('chainReaches');
      } else if (snap.chain >= alerts.chainReaches && old.chain < alerts.chainReaches) {
        fired.push('chainReaches');
      }
    }
    if (alerts.memberCountDrops !== false && snap.membersCur < alerts.memberCountDrops && !(old.membersCur < alerts.memberCountDrops)) fired.push('memberCountDrops');
    if (alerts.rankedWarStarts && snap.rankedWar && !old.rankedWar) fired.push('rankedWarStarts');
    if (alerts.inRaid && snap.raid && !old.raid) fired.push('inRaid');
    if (alerts.inTerritoryWar && snap.territoryWar && !old.territoryWar) fired.push('inTerritoryWar');
    return fired;
  }

  function mapPlayerResponse(j) {
    return {
      name: j.name,
      state: j.status ? j.status.state : '',
      description: j.status ? (j.status.description || '') : '',
      lastAction: j.last_action ? j.last_action.status : '',
      lastActionTs: j.last_action ? j.last_action.timestamp : 0,
      lifeCur: j.life ? j.life.current : 0,
      lifeMax: j.life ? j.life.maximum : 0,
      revivable: !!j.revivable
    };
  }

  function mapFactionResponse(j) {
    var basic = j.basic || {};
    var chain = j.chain || {};
    var wars = j.wars || {};
    return {
      name: basic.name != null ? basic.name : (j.name || ''),
      chain: chain.current != null ? chain.current : 0,
      respect: basic.respect != null ? basic.respect : 0,
      membersCur: basic.members != null ? basic.members : 0,
      membersMax: basic.capacity != null ? basic.capacity : 0,
      rankedWar: !!(wars.ranked),
      raid: Array.isArray(wars.raids) ? wars.raids.length > 0 : false,
      territoryWar: Array.isArray(wars.territory) ? wars.territory.length > 0 : false
    };
  }

  if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
    module.exports = { hoursSince: hoursSince, evaluatePlayer: evaluatePlayer, evaluateFaction: evaluateFaction, mapPlayerResponse: mapPlayerResponse, mapFactionResponse: mapFactionResponse };
    return;
  }

})();
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd /opt/warboard && node --test test/stakeout.test.mjs`
Expected: PASS — all tests green.
Run: `node --check server/public/scripts/torn-stakeout.user.js`
Expected: exit 0 (no output).

- [ ] **Step 5: Confirm the v2 faction field paths**

The `mapFactionResponse` field paths (`basic.members`, `basic.capacity`, `chain.current`, `wars.ranked|raids|territory`) are the assumed v2 shapes. Cross-check against warboard's existing v2 faction usage:
Run: `grep -rnE "selections=.*(chain|wars|basic)|/v2/faction" /opt/warboard/server/*.js | head`
If the live shape differs (e.g. member count lives elsewhere), update `mapFactionResponse` AND the `mapFactionResponse` test fixture together, then re-run the test. Leave a note in the task's commit message about what was confirmed.

- [ ] **Step 6: Commit**

```bash
cd /opt/warboard
git add server/public/scripts/torn-stakeout.user.js test/stakeout.test.mjs
git commit -m "stakeout: pure alert engine + v2 mappers (TDD)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Store + bootstrap skeleton

**Files:**
- Modify: `server/public/scripts/torn-stakeout.user.js` (insert browser-only code after the `module.exports` guard, before the IIFE close)

- [ ] **Step 1: Add the store + settings helpers**

Insert this block immediately after the `if (typeof module !== 'undefined' ...) { ... return; }` guard (still inside the IIFE):

```js
  var PLAYERS_KEY = 'stakeout_players';
  var FACTIONS_KEY = 'stakeout_factions';
  var SETTINGS_KEY = 'stakeout_settings';
  var DEFAULT_SETTINGS = { apiKey: '', pollSeconds: 30, sound: true, panelOpen: false, panelPos: null };

  function gmGet(key, fallback) {
    try {
      if (typeof GM_getValue === 'function') {
        var v = GM_getValue(key, null);
        if (v == null) return fallback;
        return typeof v === 'string' ? JSON.parse(v) : v;
      }
      var ls = localStorage.getItem(key);
      return ls == null ? fallback : JSON.parse(ls);
    } catch (_) { return fallback; }
  }
  function gmSet(key, val) {
    try {
      var s = JSON.stringify(val);
      if (typeof GM_setValue === 'function') GM_setValue(key, s);
      else localStorage.setItem(key, s);
    } catch (_) {}
  }
  function getPlayers() { var a = gmGet(PLAYERS_KEY, []); return Array.isArray(a) ? a : []; }
  function setPlayers(a) { gmSet(PLAYERS_KEY, a); }
  function getFactions() { var a = gmGet(FACTIONS_KEY, []); return Array.isArray(a) ? a : []; }
  function setFactions(a) { gmSet(FACTIONS_KEY, a); }
  function getSettings() {
    var s = gmGet(SETTINGS_KEY, null);
    if (!s || typeof s !== 'object') return Object.assign({}, DEFAULT_SETTINGS);
    return Object.assign({}, DEFAULT_SETTINGS, s);
  }
  function setSettings(s) { gmSet(SETTINGS_KEY, s); }
```

- [ ] **Step 2: Verify the node test still loads (the browser block must not run in Node)**

Run: `cd /opt/warboard && node --test test/stakeout.test.mjs`
Expected: PASS — still green (the `return` in the export guard means none of the new `localStorage`/`GM_*` code executes under Node).
Run: `node --check server/public/scripts/torn-stakeout.user.js`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
cd /opt/warboard
git add server/public/scripts/torn-stakeout.user.js
git commit -m "stakeout: GM-backed store + settings

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Poller (fetch → map → evaluate → persist → notify)

**Files:**
- Modify: `server/public/scripts/torn-stakeout.user.js`

- [ ] **Step 1: Add the API fetch helper**

Insert after the store helpers:

```js
  function apiFetch(section, id, selections, cb) {
    var settings = getSettings();
    if (!settings.apiKey) { cb(new Error('no api key')); return; }
    var url = 'https://api.torn.com/v2/' + section + '/' + id + '?selections=' + selections.join(',');
    if (typeof GM_xmlhttpRequest === 'function') {
      GM_xmlhttpRequest({
        method: 'GET', url: url,
        headers: { 'Authorization': 'ApiKey ' + settings.apiKey, 'Accept': 'application/json' },
        onload: function (r) {
          try {
            var d = JSON.parse(r.responseText);
            if (d.error) { cb(new Error('api ' + d.error.code + ': ' + d.error.error)); return; }
            cb(null, d);
          } catch (e) { cb(e); }
        },
        onerror: function () { cb(new Error('network error')); }
      });
    } else { cb(new Error('GM_xmlhttpRequest unavailable')); }
  }
```

- [ ] **Step 2: Add the poll cycle**

Insert after `apiFetch`:

```js
  var polling = false;
  function pollOnce() {
    if (polling) return;
    polling = true;
    var nowMs = Date.now();
    var players = getPlayers();
    var factions = getFactions();
    var queue = [];
    players.forEach(function (p, i) { queue.push({ kind: 'player', rec: p, idx: i }); });
    factions.forEach(function (f, i) { queue.push({ kind: 'faction', rec: f, idx: i }); });
    var qi = 0;
    function next() {
      if (qi >= queue.length) { polling = false; return; }
      var job = queue[qi++];
      if (job.kind === 'player') {
        apiFetch('user', job.rec.id, ['profile'], function (err, d) {
          if (!err && d) {
            var snap = mapPlayerResponse(d);
            var fired = evaluatePlayer(job.rec.info, snap, job.rec.alerts, nowMs);
            job.rec.info = snap;
            var arr = getPlayers(); if (arr[job.idx] && arr[job.idx].id === job.rec.id) { arr[job.idx].info = snap; setPlayers(arr); }
            fired.forEach(function (a) { notifyPlayer(job.rec, snap, a); });
            renderPanel();
          }
          next();
        });
      } else {
        apiFetch('faction', job.rec.id, ['basic', 'chain', 'wars'], function (err, d) {
          if (!err && d) {
            var snap = mapFactionResponse(d);
            var fired = evaluateFaction(job.rec.info, snap, job.rec.alerts);
            job.rec.info = snap;
            var arr = getFactions(); if (arr[job.idx] && arr[job.idx].id === job.rec.id) { arr[job.idx].info = snap; setFactions(arr); }
            fired.forEach(function (a) { notifyFaction(job.rec, snap, a); });
            renderPanel();
          }
          next();
        });
      }
    }
    next();
  }

  var pollTimer = null;
  function restartPolling() {
    if (pollTimer) clearInterval(pollTimer);
    var secs = getSettings().pollSeconds || 30;
    pollTimer = setInterval(pollOnce, Math.max(10, secs) * 1000);
  }
```

NOTE: `notifyPlayer`, `notifyFaction`, and `renderPanel` are defined in Tasks 4 and 5. They are referenced here but not yet called at runtime until bootstrap (Task 7) wires `restartPolling()`. The script must still `node --check` clean because these are function references inside not-yet-executed functions.

- [ ] **Step 3: Verify**

Run: `node --check server/public/scripts/torn-stakeout.user.js`
Expected: exit 0.
Run: `cd /opt/warboard && node --test test/stakeout.test.mjs`
Expected: PASS (unchanged — poller code never runs in Node).

- [ ] **Step 4: Commit**

```bash
cd /opt/warboard
git add server/public/scripts/torn-stakeout.user.js
git commit -m "stakeout: poll cycle (sequential per-target v2 fetch + evaluate + persist)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Notifier (toast + GM_notification + sound)

**Files:**
- Modify: `server/public/scripts/torn-stakeout.user.js`

- [ ] **Step 1: Add notification helpers + messages**

Insert after the poller:

```js
  var PLAYER_MSG = {
    okay: 'is now OKAY', hospital: 'is in hospital', landing: 'has landed', online: 'is now online',
    life: 'life dropped below threshold', offline: 'has been offline a while', revivable: 'is now revivable'
  };
  var FACTION_MSG = {
    chainReaches: 'chain alert', memberCountDrops: 'member count dropped',
    rankedWarStarts: 'ranked war started', inRaid: 'is in a raid', inTerritoryWar: 'is in a territory war'
  };

  function playPing() {
    if (!getSettings().sound) return;
    try {
      var ctx = new (window.AudioContext || window.webkitAudioContext)();
      var o = ctx.createOscillator(), g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.frequency.value = 880; g.gain.value = 0.07;
      o.start(); o.stop(ctx.currentTime + 0.18);
    } catch (_) {}
  }

  function showToast(text, href) {
    var t = document.createElement('div');
    t.className = 'stk-toast';
    t.textContent = '📍 ' + text;
    t.onclick = function () { if (href) window.open(href, '_blank'); t.remove(); };
    document.body.appendChild(t);
    setTimeout(function () { t.classList.add('stk-toast-in'); }, 20);
    setTimeout(function () { t.classList.remove('stk-toast-in'); setTimeout(function () { t.remove(); }, 400); }, 8000);
  }

  function notify(text, href) {
    showToast(text, href);
    playPing();
    try {
      if (typeof GM_notification === 'function') {
        GM_notification({ title: 'Stakeout', text: text, onclick: function () { if (href) window.open(href, '_blank'); } });
      }
    } catch (_) {}
  }

  function notifyPlayer(rec, snap, alert) {
    var who = (rec.label || snap.name || ('Player ' + rec.id)) + ' [' + rec.id + ']';
    notify(who + ' ' + (PLAYER_MSG[alert] || alert), 'https://www.torn.com/profiles.php?XID=' + rec.id);
  }
  function notifyFaction(rec, snap, alert) {
    var who = (snap.name || ('Faction ' + rec.id)) + ' [' + rec.id + ']';
    var extra = alert === 'chainReaches' ? (' (chain ' + snap.chain + ')') : '';
    notify(who + ' ' + (FACTION_MSG[alert] || alert) + extra, 'https://www.torn.com/factions.php?step=profile&ID=' + rec.id);
  }
```

- [ ] **Step 2: Verify**

Run: `node --check server/public/scripts/torn-stakeout.user.js` → exit 0.
Run: `cd /opt/warboard && node --test test/stakeout.test.mjs` → PASS.

- [ ] **Step 3: Commit**

```bash
cd /opt/warboard
git add server/public/scripts/torn-stakeout.user.js
git commit -m "stakeout: notifier (toast + GM_notification + sound)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Floating panel UI (list, add-by-ID, alert editor, settings)

**Files:**
- Modify: `server/public/scripts/torn-stakeout.user.js`

- [ ] **Step 1: Add styles**

Insert after the notifier:

```js
  function injectStyles() {
    if (document.getElementById('stk-styles')) return;
    var s = document.createElement('style');
    s.id = 'stk-styles';
    s.textContent = [
      '.stk-toast{position:fixed;right:16px;bottom:80px;z-index:2147483647;max-width:300px;background:#1b1f2a;color:#e6e8ee;border:1px solid #2a3447;border-left:3px solid #6ee7b7;border-radius:8px;padding:10px 12px;font:600 13px system-ui,sans-serif;box-shadow:0 6px 18px rgba(0,0,0,.5);opacity:0;transform:translateY(8px);transition:opacity .35s,transform .35s;cursor:pointer;}',
      '.stk-toast-in{opacity:1;transform:translateY(0);}',
      '#stk-fab{position:fixed;right:16px;bottom:16px;z-index:2147483646;width:44px;height:44px;border-radius:50%;background:#1b1f2a;border:1px solid #2a3447;color:#fff;font-size:20px;display:flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 4px 12px rgba(0,0,0,.5);}',
      '#stk-panel{position:fixed;right:16px;bottom:70px;z-index:2147483646;width:320px;max-height:70vh;overflow:auto;background:#10141c;border:1px solid #2a3447;border-radius:10px;color:#e6e8ee;font:13px system-ui,sans-serif;padding:10px;box-shadow:0 8px 24px rgba(0,0,0,.6);display:none;}',
      '#stk-panel.stk-open{display:block;}',
      '.stk-row{border-bottom:1px solid #1c2330;padding:6px 2px;}',
      '.stk-row .stk-name{font-weight:600;}',
      '.stk-status{font-size:11px;color:#9aa3b2;}',
      '.stk-dot{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:5px;vertical-align:middle;}',
      '.stk-on{background:#6ee7b7;} .stk-off{background:#6b7280;} .stk-hosp{background:#e64d1a;}',
      '.stk-btn{background:#2a3447;color:#e6e8ee;border:0;border-radius:5px;padding:4px 8px;cursor:pointer;font-size:12px;}',
      '.stk-input{background:#0a0d14;border:1px solid #2a3447;color:#e6e8ee;border-radius:5px;padding:4px 6px;width:100%;box-sizing:border-box;}',
      '.stk-alerts label{display:inline-block;margin:2px 6px 2px 0;font-size:11px;color:#cdd3e0;}',
      '.stk-sec{margin:8px 0 4px;font-weight:700;color:#9aa3b2;font-size:11px;text-transform:uppercase;}'
    ].join('');
    document.head.appendChild(s);
  }
```

- [ ] **Step 2: Add the FAB + panel scaffold + render**

Insert after `injectStyles`:

```js
  function ensurePanel() {
    injectStyles();
    if (!document.getElementById('stk-fab')) {
      var fab = document.createElement('div');
      fab.id = 'stk-fab'; fab.textContent = '📍';
      fab.onclick = function () {
        var p = document.getElementById('stk-panel');
        p.classList.toggle('stk-open');
        var st = getSettings(); st.panelOpen = p.classList.contains('stk-open'); setSettings(st);
        if (st.panelOpen) renderPanel();
      };
      document.body.appendChild(fab);
    }
    if (!document.getElementById('stk-panel')) {
      var panel = document.createElement('div');
      panel.id = 'stk-panel';
      document.body.appendChild(panel);
      if (getSettings().panelOpen) panel.classList.add('stk-open');
    }
  }

  function defaultPlayerAlerts() { return { okay: false, hospital: true, landing: true, online: true, life: false, offline: false, revivable: false }; }
  function defaultFactionAlerts() { return { chainReaches: false, memberCountDrops: false, rankedWarStarts: true, inRaid: false, inTerritoryWar: false }; }

  function addTarget(rawId, kind) {
    var id = parseInt(String(rawId).replace(/[^0-9]/g, ''), 10);
    if (!id) return;
    if (kind === 'player') {
      var ps = getPlayers();
      if (ps.some(function (p) { return p.id === id; })) return;
      ps.push({ id: id, order: Date.now(), label: '', info: null, alerts: defaultPlayerAlerts() });
      setPlayers(ps);
    } else {
      var fs = getFactions();
      if (fs.some(function (f) { return f.id === id; })) return;
      fs.push({ id: id, order: Date.now(), info: null, alerts: defaultFactionAlerts() });
      setFactions(fs);
    }
    renderPanel();
    pollOnce();
  }

  function removePlayer(id) { setPlayers(getPlayers().filter(function (p) { return p.id !== id; })); renderPanel(); }
  function removeFaction(id) { setFactions(getFactions().filter(function (f) { return f.id !== id; })); renderPanel(); }

  function dot(snap) {
    if (!snap) return '<span class="stk-dot stk-off"></span>';
    if (snap.state === 'Hospital') return '<span class="stk-dot stk-hosp"></span>';
    if (snap.lastAction === 'Online') return '<span class="stk-dot stk-on"></span>';
    return '<span class="stk-dot stk-off"></span>';
  }

  function renderPanel() {
    var panel = document.getElementById('stk-panel');
    if (!panel || !panel.classList.contains('stk-open')) return;
    var s = getSettings();
    var players = getPlayers(), factions = getFactions();
    var calls = players.length + factions.length;
    var rate = s.pollSeconds ? Math.round(calls / s.pollSeconds * 60) : 0;
    var html = '';
    html += '<div class="stk-sec">Players</div>';
    players.forEach(function (p) {
      var info = p.info;
      html += '<div class="stk-row" data-pid="' + p.id + '">' +
        dot(info) + '<span class="stk-name">' + (p.label || (info && info.name) || p.id) + ' [' + p.id + ']</span> ' +
        '<button class="stk-btn stk-del-p" data-id="' + p.id + '">✕</button>' +
        '<div class="stk-status">' + (info ? (info.state + (info.lifeMax ? ' · life ' + Math.round(info.lifeCur / info.lifeMax * 100) + '%' : '')) : 'pending…') + '</div>' +
        '<div class="stk-alerts" data-pid="' + p.id + '">' + playerAlertCheckboxes(p) + '</div>' +
        '</div>';
    });
    html += '<div style="margin:6px 0;"><input class="stk-input" id="stk-add-p" placeholder="Add player ID"></div>';
    html += '<div class="stk-sec">Factions</div>';
    factions.forEach(function (f) {
      var info = f.info;
      html += '<div class="stk-row" data-fid="' + f.id + '">' +
        '<span class="stk-name">' + ((info && info.name) || f.id) + ' [' + f.id + ']</span> ' +
        '<button class="stk-btn stk-del-f" data-id="' + f.id + '">✕</button>' +
        '<div class="stk-status">' + (info ? ('chain ' + info.chain + ' · members ' + info.membersCur + '/' + info.membersMax) : 'pending…') + '</div>' +
        '<div class="stk-alerts" data-fid="' + f.id + '">' + factionAlertCheckboxes(f) + '</div>' +
        '</div>';
    });
    html += '<div style="margin:6px 0;"><input class="stk-input" id="stk-add-f" placeholder="Add faction ID"></div>';
    html += '<div class="stk-sec">Settings</div>';
    html += '<div>API key <input class="stk-input" id="stk-key" value="' + (s.apiKey ? '••••••••' : '') + '" placeholder="Torn API key"></div>';
    html += '<div style="margin-top:4px;">Poll secs <input class="stk-input" id="stk-poll" value="' + s.pollSeconds + '" style="width:70px;display:inline;"> ' +
      '<label><input type="checkbox" id="stk-sound"' + (s.sound ? ' checked' : '') + '> sound</label></div>';
    html += '<div class="stk-status" style="margin-top:4px;">~' + rate + ' API calls/min</div>';
    panel.innerHTML = html;
    wirePanel(panel);
  }
```

- [ ] **Step 3: Add the alert-checkbox builders + panel event wiring**

Insert after `renderPanel`:

```js
  function cb(id, key, checked, label) {
    return '<label><input type="checkbox" data-akey="' + key + '" data-id="' + id + '"' + (checked ? ' checked' : '') + '> ' + label + '</label>';
  }
  function num(id, key, val, label, ph) {
    return '<label>' + label + ' <input class="stk-input" data-anum="' + key + '" data-id="' + id + '" value="' + (val === false ? '' : val) + '" placeholder="' + ph + '" style="width:48px;display:inline;"></label>';
  }
  function playerAlertCheckboxes(p) {
    var a = p.alerts;
    return cb(p.id, 'okay', a.okay, 'okay') + cb(p.id, 'hospital', a.hospital, 'hosp') +
      cb(p.id, 'landing', a.landing, 'land') + cb(p.id, 'online', a.online, 'online') +
      cb(p.id, 'revivable', a.revivable, 'reviv') +
      num(p.id, 'life', a.life, 'life<', '%') + num(p.id, 'offline', a.offline, 'off≥', 'h');
  }
  function factionAlertCheckboxes(f) {
    var a = f.alerts;
    return cb(f.id, 'rankedWarStarts', a.rankedWarStarts, 'war') + cb(f.id, 'inRaid', a.inRaid, 'raid') +
      cb(f.id, 'inTerritoryWar', a.inTerritoryWar, 'terr') +
      num(f.id, 'chainReaches', a.chainReaches, 'chain≥', 'N/0') + num(f.id, 'memberCountDrops', a.memberCountDrops, 'mem<', 'N');
  }

  function updateAlert(kind, id, key, value) {
    if (kind === 'player') {
      var ps = getPlayers(); ps.forEach(function (p) { if (p.id === id) p.alerts[key] = value; }); setPlayers(ps);
    } else {
      var fs = getFactions(); fs.forEach(function (f) { if (f.id === id) f.alerts[key] = value; }); setFactions(fs);
    }
  }

  function wirePanel(panel) {
    panel.querySelectorAll('.stk-del-p').forEach(function (b) { b.onclick = function () { removePlayer(parseInt(b.getAttribute('data-id'), 10)); }; });
    panel.querySelectorAll('.stk-del-f').forEach(function (b) { b.onclick = function () { removeFaction(parseInt(b.getAttribute('data-id'), 10)); }; });
    panel.querySelectorAll('input[data-akey]').forEach(function (el) {
      el.onchange = function () {
        var kind = el.closest('[data-pid]') ? 'player' : 'faction';
        updateAlert(kind, parseInt(el.getAttribute('data-id'), 10), el.getAttribute('data-akey'), el.checked);
      };
    });
    panel.querySelectorAll('input[data-anum]').forEach(function (el) {
      el.onchange = function () {
        var kind = el.closest('[data-pid]') ? 'player' : 'faction';
        var v = el.value.trim();
        var parsed = v === '' ? false : parseInt(v.replace(/[^0-9]/g, ''), 10);
        if (parsed !== false && isNaN(parsed)) parsed = false;
        updateAlert(kind, parseInt(el.getAttribute('data-id'), 10), el.getAttribute('data-anum'), parsed);
      };
    });
    var addP = panel.querySelector('#stk-add-p');
    if (addP) addP.onkeydown = function (e) { if (e.key === 'Enter') addTarget(addP.value, 'player'); };
    var addF = panel.querySelector('#stk-add-f');
    if (addF) addF.onkeydown = function (e) { if (e.key === 'Enter') addTarget(addF.value, 'faction'); };
    var keyEl = panel.querySelector('#stk-key');
    if (keyEl) keyEl.onchange = function () { if (keyEl.value && keyEl.value.indexOf('•') === -1) { var s = getSettings(); s.apiKey = keyEl.value.trim(); setSettings(s); pollOnce(); } };
    var pollEl = panel.querySelector('#stk-poll');
    if (pollEl) pollEl.onchange = function () { var s = getSettings(); s.pollSeconds = Math.max(10, parseInt(pollEl.value, 10) || 30); setSettings(s); restartPolling(); };
    var soundEl = panel.querySelector('#stk-sound');
    if (soundEl) soundEl.onchange = function () { var s = getSettings(); s.sound = soundEl.checked; setSettings(s); };
  }
```

- [ ] **Step 4: Verify**

Run: `node --check server/public/scripts/torn-stakeout.user.js` → exit 0.
Run: `cd /opt/warboard && node --test test/stakeout.test.mjs` → PASS.

- [ ] **Step 5: Commit**

```bash
cd /opt/warboard
git add server/public/scripts/torn-stakeout.user.js
git commit -m "stakeout: floating panel (list, add-by-id, alert editor, settings)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: On-page quick-add toggle (profile + faction pages)

**Files:**
- Modify: `server/public/scripts/torn-stakeout.user.js`

- [ ] **Step 1: Add the on-page toggle injector**

Insert after `wirePanel`:

```js
  function currentProfileXid() {
    var m = location.search.match(/[?&]XID=(\d+)/i);
    return m ? parseInt(m[1], 10) : null;
  }
  function currentFactionId() {
    var m = location.search.match(/[?&]ID=(\d+)/i);
    return (/factions\.php/i.test(location.pathname) && /step=profile/i.test(location.href) && m) ? parseInt(m[1], 10) : null;
  }
  function injectQuickAdd() {
    var xid = currentProfileXid();
    var fid = currentFactionId();
    if (!xid && !fid) return;
    if (document.getElementById('stk-quick')) return;
    var anchor = document.querySelector('.content-title, .titleContainer___, h4');
    if (!anchor) return;
    var btn = document.createElement('button');
    btn.id = 'stk-quick';
    btn.className = 'stk-btn';
    btn.style.cssText = 'margin-left:8px;';
    function refresh() {
      if (xid) {
        var on = getPlayers().some(function (p) { return p.id === xid; });
        btn.textContent = on ? '📍 Staking out' : '📍 Stakeout';
      } else {
        var onf = getFactions().some(function (f) { return f.id === fid; });
        btn.textContent = onf ? '📍 Staking out' : '📍 Stakeout faction';
      }
    }
    btn.onclick = function () {
      if (xid) {
        if (getPlayers().some(function (p) { return p.id === xid; })) removePlayer(xid);
        else addTarget(xid, 'player');
      } else {
        if (getFactions().some(function (f) { return f.id === fid; })) removeFaction(fid);
        else addTarget(fid, 'faction');
      }
      refresh();
    };
    refresh();
    anchor.appendChild(btn);
  }
```

- [ ] **Step 2: Verify**

Run: `node --check server/public/scripts/torn-stakeout.user.js` → exit 0.
Run: `cd /opt/warboard && node --test test/stakeout.test.mjs` → PASS.

NOTE: the `.titleContainer___` / `.content-title` anchor selectors are best-effort; Step is verified on-device in Task 7. If no toggle appears on a profile, capture the profile header DOM and adjust the `anchor` selector.

- [ ] **Step 3: Commit**

```bash
cd /opt/warboard
git add server/public/scripts/torn-stakeout.user.js
git commit -m "stakeout: on-page quick-add toggle (profile + faction)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: Bootstrap, deploy, on-device verification

**Files:**
- Modify: `server/public/scripts/torn-stakeout.user.js`
- Create: `server/public/scripts/torn-stakeout.meta.js`

- [ ] **Step 1: Add the bootstrap (the only top-level browser execution)**

Insert immediately before the IIFE close `})();`:

```js
  function boot() {
    ensurePanel();
    injectQuickAdd();
    if (getSettings().panelOpen) renderPanel();
    restartPolling();
    pollOnce();
    var mo = new MutationObserver(function () { injectQuickAdd(); });
    mo.observe(document.body, { childList: true, subtree: true });
    try { if (typeof GM_registerMenuCommand === 'function') GM_registerMenuCommand('Stakeout: open panel', function () { var p = document.getElementById('stk-panel'); if (p) { p.classList.add('stk-open'); renderPanel(); } }); } catch (_) {}
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
```

- [ ] **Step 2: Create the meta.js**

Create `server/public/scripts/torn-stakeout.meta.js` with the exact `==UserScript==` block from the `.user.js` header (same `@version 1.0.0`, all `@match`/`@grant`/`@connect`/`@downloadURL`/`@updateURL` lines).

- [ ] **Step 3: Verify locally**

Run: `node --check server/public/scripts/torn-stakeout.user.js` → exit 0.
Run: `cd /opt/warboard && node --test test/stakeout.test.mjs` → PASS (all engine/mapper tests).
Run: `curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:3000/scripts/torn-stakeout.user.js` → `200`.

- [ ] **Step 4: Commit + push**

```bash
cd /opt/warboard
git add server/public/scripts/torn-stakeout.user.js server/public/scripts/torn-stakeout.meta.js
git commit -m "stakeout: bootstrap + meta.js — v1.0.0

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
git push origin HEAD
```

- [ ] **Step 5: On-device verification checklist (user-driven, report results)**

Install from `https://tornwar.com/scripts/torn-stakeout.user.js`, then confirm:
1. 📍 FAB appears bottom-right on Torn; tapping opens the panel.
2. Enter an API key in the panel; it persists across reload (key field shows `••••••••`).
3. Add a player ID → row appears, status fills in within one poll (`pending…` → state/life).
4. On a profile page, the `📍 Stakeout` toggle appears in the header and adds/removes that player.
5. Add a faction ID → chain/members fill in.
6. Trigger an alert (e.g. tick `online` for someone currently offline, wait for them to come online, or set `life<99` on a full-life target then watch them drop) → toast + (desktop) OS notification + ping.
7. Confirm the panel shows the `~N API calls/min` line and that adjusting poll secs changes it.

Report which pass; fix any failures (selectors / mapper field paths) before announcing complete.

---

## Notes for the implementer
- Forward references are fine: `notifyPlayer`/`notifyFaction`/`renderPanel`/`restartPolling`/`pollOnce` are hoisted function declarations within one IIFE, so Task 3 may reference functions defined in Tasks 4–5. The script only *executes* them from `boot()` (Task 7).
- Keep all new code INSIDE the IIFE and AFTER the `module.exports` early-return, so the Node test never executes browser code.
- After shipping, end with the direct served URL so the user can force-update, and note the Greasy Fork upload as a follow-up (the script self-distributes from tornwar.com via `@downloadURL`).
