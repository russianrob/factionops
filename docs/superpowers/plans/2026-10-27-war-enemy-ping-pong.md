# War Enemy Ping-Pong - Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A member's FactionOps can no longer change a war's enemy. Only warboard's own Torn checks change it, so the war record stops flipping between the next war's enemy and the last one's.

**Architecture:**
- `server/store.js`: `getOrCreateWar` takes a fourth argument, `{ fromClient }`. From a client it creates a missing record, or fills in an enemy the record lacks, and nothing else: an enemy that differs from the record's is ignored, with one log line per war and enemy every 10 minutes. Without it (warboard's own checks) it works as now. The enemy ids are compared as strings for every caller.
- `server/routes.js` (`/api/stream`, `/api/poll`, `/api/poll-long`) and `server/socket-handlers.js` (`join_war`) pass `{ fromClient: true }`. `/api/poll` loses its own enemy-change block, the other way a client's enemy reached the record.
- Released by `deploy.sh`: it runs the whole suite and reloads warboard, which is offline for a few seconds.

**Tech Stack:** Node (ES modules) and node:test. The new test lifts `getOrCreateWar` out of this checkout's `store.js` by name and runs it against stubs, and reads the five callers' files as text, so nothing reads or writes live data.

**Spec:** the design the owner approved in chat, below. There is no spec file.

**The ask:**
- 09:00 EDT on 2026-10-27, the owner: "fix the ping-pong too". At about 10:11 EDT: "yes fix the ping pong", on the design "a member's FactionOps can no longer change the war's enemy", with one more restart. At about 10:17 EDT: "im going to breakfast so youre on autopilot do what is recommended".
- Facts found, from the logs and the code:
  - Every Tuesday, once the next matchup is out, `war_<faction>` flips between the next war's enemy and the last one's until kickoff, about once a minute (182 `[store] New enemy detected` lines in the last 30 MB of the log this morning).
  - Warboard's own checks set the new enemy: `detectNewWars` in `server.js`, the chain monitor's score check, and the war-scanner. Each FactionOps connect passes the enemy that member's script remembers, still the last war's, into `getOrCreateWar`, which resets the record on any difference.
  - Every reset wipes the chain, the calls, the priorities, the enemy roster and the war's start. A record with no start counts as a live war, so the chain is read at the war's pace and alerted from 10. The next chain reading then looks like a fresh chain, and `timerPlausible` holds low timers back for about 3 minutes, so CHAIN DYING is muffled from the matchup to kickoff.
  - FactionOps adopts the server's enemy only from a full-roster payload, and each reset empties the roster, so a stale client never catches up.
  - In 16 weeks of logs every new enemy was first seen by warboard's own checks, never by a client.
  - `/api/poll` has a second client path after `getOrCreateWar`: "WIPE STALE WAR DATA if enemy faction ID changed". It has not fired in the last 400 MB of the log, because `getOrCreateWar` has already changed the enemy by then. Once `getOrCreateWar` keeps a client's enemy out, it would fire on every stale poll and carry the flip on.
- Rulings made while planning:
  - `/api/poll`'s enemy-change block goes. Its only trigger would be the stale enemy this change ignores. The call timers it cleared are harmless when left: a timer returns when its call is gone (`scheduleCallExpiry`). `prewar.reassignEnemy` keeps its own tests and is no longer called by the server.
  - Filling in a missing enemy sets the id and saves, nothing else. Today it runs the reset, which zeroes the chain.
  - The ids are compared as strings for every caller, warboard's own checks included: a number and the same id as text no longer reset a war.
  - The ignored-enemy line comes once per war and enemy every 10 minutes: `[store] <warId> kept enemy <id>; a FactionOps connect sent <id>`.
  - A client connect still creates a war that does not exist, with its enemy, as now.
  - Not changed, as approved: `detectNewWars` clears an ended war's flags before `getOrCreateWar`, so `wars.json` never archives it (war history keeps it); FactionOps. Sibling, not changed: `join_war` takes the faction id from the client's payload, not the token.

**Execution:** Native, as the owner's "do what is recommended" chose. One fresh Opus reviewer checks the branch between Task 1 and Task 2.

## Global Constraints

- Only warboard's own checks change a war's enemy: `detectNewWars` (`server.js`), the chain monitor's score check (`chain-monitor.js`) and the war-scanner (`war-scanner.js`). Their calls do not change.
- From a client, `getOrCreateWar` creates a missing record (as now), fills in a missing enemy without touching anything else, and ignores a different enemy. It returns the record in every case.
- No change to FactionOps, the iOS app, `chain-monitor.js`, `server.js`, `war-scanner.js` or the archive.
- The repo is public. Tests and text use made-up ids (faction 1000, enemies 2000 and 3000, players 1000001 and 1000002) and numbers (1,234 / 2,500), never a real faction's or member's.
- Server files end up `root:root 644`. Release: a fast-forward of main, then `deploy.sh`. Every FactionOps client reconnects after the reload.
- Stage only this plan's paths. Every commit ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Warboard's checks fail and only a client knows the new enemy.** A client can no longer correct the record. `detectNewWars` runs every 5 minutes (every minute in Tuesday's matchup window) and the war-scanner on its own schedule, and in 16 weeks no client saw a new enemy first. No test here can run them.
2. **Clients that never catch up.** A stale FactionOps keeps sending the last war's enemy until it adopts the server's from a full roster. Now the roster is no longer wiped, so that should happen. If it does not, the ignored-enemy line keeps coming, once per 10 minutes per enemy, and nothing else.
3. **A rematch with the same enemy.** No reset, as now.
4. **A record whose enemy is missing.** A connect fills it in, and the record keeps its chain, calls and start. The test "a connect fills in a missing enemy and touches nothing else" pins it.
5. **An id as a number against the same id as text.** No reset, from a client or from warboard's checks. The test "the same enemy as a number is no change" pins it.

## Paths and commands

- `W=/opt/warboard/.superpowers/sdd/2026-10-27-war-enemy-ping-pong` is this plan's git-ignored workspace, and `WT=$W/wt` the worktree, on branch `war-enemy-ping-pong`.
- The new test reads this checkout's files by `new URL(..., import.meta.url)`, so in the worktree it tests the worktree's code.
- Test runs write to `$W/t.log` and print the `# tests`, `# pass` and `# fail` lines, then any `not ok` lines.
- **Edits:** each "Replace" block's text occurs in its file exactly once, and the "With" block takes its place. Neither block holds the newline that ends its last line.

## Setup

- [ ] **Step 1: Commit this plan on main, then make the worktree:**

```bash
uptime; cd /opt/warboard && git add -- docs/superpowers/plans/2026-10-27-war-enemy-ping-pong.md && git commit -q -m "plan: war enemy ping-pong" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- docs/superpowers/plans/2026-10-27-war-enemy-ping-pong.md && W=/opt/warboard/.superpowers/sdd/2026-10-27-war-enemy-ping-pong && mkdir -p "$W" && git worktree add -q "$W/wt" -b war-enemy-ping-pong && ln -s /opt/warboard/server/node_modules "$W/wt/server/node_modules" && git -C "$W/wt" status --short && git -C "$W/wt" log --format='%h %s' -1 | cat
```

Expected: the load under 12, then `?? server/node_modules`, then the plan's commit.

- [ ] **Step 2: The sweeps.** Write `$W/sweep-env.mjs` and `$W/sweep-names.mjs` exactly as `docs/superpowers/plans/2026-10-27-chain-alerts-outside-war.md` Setup Step 2 gives them. They live outside the repo.

- [ ] **Step 3: Baseline.** The whole suite in the worktree, with the failing names kept for Task 1:

```bash
uptime; W=/opt/warboard/.superpowers/sdd/2026-10-27-war-enemy-ping-pong; cd "$W/wt/server" && node --test > "$W/baseline.log" 2>&1; command grep -E "^# (tests|pass|fail|skipped) " "$W/baseline.log" | paste -sd" " -; command grep -E "^not ok" "$W/baseline.log" | sed -E 's/^not ok [0-9]+ - //' | sort > "$W/base-fail-names.txt"; wc -l < "$W/base-fail-names.txt"
```

Expected: the load under 12, then the whole suite with `# skipped 2` and `30` failures, the worktree-only ones: `factionops-filters.test.mjs` needs `server/.env`, `war-history-dedupe.test.mjs` needs main's uncommitted `war-history.js`, and 28 RW Pricer tests read main's live `data/rwp-prices.json`. Ledger them as the gate (`Setup: Ruling:`): Task 1 must end with the same names.

---

### Task 1: Only warboard changes a war's enemy

**Files:**
- Create: `server/war-enemy-client.test.mjs`
- Modify: `server/store.js` (`getOrCreateWar`), `server/routes.js` (three calls, and `/api/poll`'s enemy-change block), `server/socket-handlers.js` (one call)

**Interfaces:**
- Produces: `getOrCreateWar(warId, factionId, enemyFactionId = null, { fromClient = false } = {})`, returning the war record. Module constants `IGNORED_CLIENT_ENEMY_LOG_MS = 600000` and `ignoredClientEnemyLoggedAt` (a Map).

- [ ] **Step 1: The test.** Write `server/war-enemy-client.test.mjs`:

```js
// A member's FactionOps can no longer change a war's enemy.
//
// Every Tuesday, from the matchup to kickoff, war_<faction> flipped between
// the next war's enemy and the last one's about once a minute. Warboard's own
// Torn checks set the new enemy, and each FactionOps connect (the stream, the
// two polls, join_war) passed the enemy that member's script still
// remembered into getOrCreateWar, which reset the record on any difference.
// Each reset wiped the chain, the calls and the war's start, so the next
// chain reading looked like a fresh chain and low timers were held back.
//
// Now only warboard's own checks change an enemy. A connect may create a
// record, or fill in an enemy the record lacks, but never change one. These
// tests lift getOrCreateWar out of this checkout's store.js and run it
// against stubs, and read the callers' files as text, so nothing here reads
// or writes live data. Ids and numbers are made up.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (name) => readFileSync(new URL(`./${name}`, import.meta.url), "utf8");
const STORE = read("store.js");

// From an opening bracket at `start`, the index of the one that closes it.
function closer(src, start) {
  const open = src[start];
  const close = open === "(" ? ")" : "}";
  let depth = 0;
  for (let i = start; i < src.length; i++) {
    if (src[i] === open) depth++;
    else if (src[i] === close && --depth === 0) return i;
  }
  throw new Error(`unbalanced ${open} at ${start}`);
}

// A function's text, found by name, without `export`; "" when the file has
// none, so a test of a function not written yet fails on its own call.
function lift(src, name) {
  const m = new RegExp(`^(?:export )?(?:async )?function ${name}\\(`, "m").exec(src);
  if (!m) return "";
  const body = src.indexOf("{", closer(src, m.index + m[0].length - 1));
  return src.slice(m.index, closer(src, body) + 1).replace(/^export /, "");
}

// A module-level `const NAME = ...;` line, or "" when the file has none.
function constLine(src, name) {
  const m = new RegExp(`^const ${name} = [^\\n]*;`, "m").exec(src);
  return m ? m[0] : "";
}

// getOrCreateWar with its collaborators stubbed: `wars` is the store's Map,
// and the clock is `now`.
function makeStore({ wars = new Map(), now = () => 1_800_000_000_000 } = {}) {
  const logs = [];
  const saves = { n: 0 };
  const body = [
    constLine(STORE, "IGNORED_CLIENT_ENEMY_LOG_MS"),
    constLine(STORE, "ignoredClientEnemyLoggedAt"),
    lift(STORE, "pickArchiveKey"),
    lift(STORE, "getOrCreateWar"),
    "return getOrCreateWar;",
  ].join("\n");
  const getOrCreateWar = new Function("wars", "saveState", "clearPayoutLootOverride", "console", "Date", body)(
    wars,
    () => { saves.n++; },
    () => {},
    { log: (s) => logs.push(String(s)) },
    { now },
  );
  return { getOrCreateWar, wars, logs, saves };
}

const ENEMY = "2000"; // the record's enemy: the next war's
const LAST = "3000"; // the enemy a stale FactionOps still remembers

function warRecord(extra = {}) {
  return {
    warId: "war_1000",
    factionId: "1000",
    enemyFactionId: ENEMY,
    enemyFactionName: "Next",
    calls: { 1000001: { calledBy: "1000002" } },
    priorities: { 1000001: 1 },
    enemyStatuses: { 1000001: { status: "Okay" } },
    chainData: { current: 1234, max: 2500, timeout: 200, cooldown: 0 },
    warStart: 1_800_000_000,
    ...extra,
  };
}

test("a FactionOps connect cannot change a war's enemy", () => {
  const s = makeStore({ wars: new Map([["war_1000", warRecord()]]) });
  const war = s.getOrCreateWar("war_1000", "1000", LAST, { fromClient: true });
  assert.equal(war, s.wars.get("war_1000"));
  assert.equal(war.enemyFactionId, ENEMY);
  assert.equal(war.enemyFactionName, "Next");
  assert.equal(war.chainData.current, 1234);
  assert.equal(war.warStart, 1_800_000_000);
  assert.deepEqual(Object.keys(war.calls), ["1000001"]);
  assert.deepEqual(Object.keys(war.enemyStatuses), ["1000001"]);
  assert.equal(s.saves.n, 0);
});

test("warboard's own checks still change it, as before", () => {
  const s = makeStore({ wars: new Map([["war_1000", warRecord()]]) });
  const war = s.getOrCreateWar("war_1000", "1000", LAST);
  assert.equal(war.enemyFactionId, LAST);
  assert.equal(war.chainData.current, 0);
  assert.equal(war.warStart, undefined);
  assert.deepEqual(war.calls, {});
  assert.match(s.logs.join("\n"), /New enemy detected \(3000\)/);
});

test("the same enemy as a number is no change", () => {
  const s = makeStore({ wars: new Map([["war_1000", warRecord()]]) });
  s.getOrCreateWar("war_1000", "1000", 2000);
  s.getOrCreateWar("war_1000", "1000", 2000, { fromClient: true });
  const war = s.wars.get("war_1000");
  assert.equal(war.chainData.current, 1234);
  assert.equal(war.warStart, 1_800_000_000);
  assert.deepEqual(s.logs, []);
});

test("a connect fills in a missing enemy and touches nothing else", () => {
  const s = makeStore({ wars: new Map([["war_1000", warRecord({ enemyFactionId: null, enemyFactionName: null })]]) });
  const war = s.getOrCreateWar("war_1000", "1000", LAST, { fromClient: true });
  assert.equal(war.enemyFactionId, LAST);
  assert.equal(war.chainData.current, 1234);
  assert.equal(war.warStart, 1_800_000_000);
  assert.deepEqual(Object.keys(war.calls), ["1000001"]);
  assert.equal(s.saves.n, 1);
});

test("a connect still creates a war that does not exist", () => {
  const s = makeStore();
  const war = s.getOrCreateWar("war_1000", "1000", LAST, { fromClient: true });
  assert.equal(s.wars.get("war_1000"), war);
  assert.equal(war.factionId, "1000");
  assert.equal(war.enemyFactionId, LAST);
  assert.equal(war.chainData.current, 0);
});

test("an ignored enemy is logged once per war and enemy every 10 minutes", () => {
  let t = 1_800_000_000_000;
  const s = makeStore({ wars: new Map([["war_1000", warRecord()]]), now: () => t });
  s.getOrCreateWar("war_1000", "1000", LAST, { fromClient: true });
  t += 60_000;
  s.getOrCreateWar("war_1000", "1000", LAST, { fromClient: true });
  assert.equal(s.logs.length, 1);
  assert.match(s.logs[0], /war_1000 kept enemy 2000; a FactionOps connect sent 3000/);
  t += 540_000;
  s.getOrCreateWar("war_1000", "1000", LAST, { fromClient: true });
  assert.equal(s.logs.length, 2);
});

// Each `store.getOrCreateWar(...)` call in a file, by its arguments.
const callsIn = (file) => [...read(file).matchAll(/store\.getOrCreateWar\(([^\n]*)\);/g)].map((m) => m[1]);

test("every FactionOps connect passes fromClient, and warboard's own checks do not", () => {
  const CLIENT = "{ fromClient: true }";
  const routes = callsIn("routes.js");
  assert.equal(routes.length, 3);
  for (const c of routes) assert.ok(c.endsWith(CLIENT), c);
  const sock = callsIn("socket-handlers.js");
  assert.equal(sock.length, 1);
  assert.ok(sock[0].endsWith(CLIENT), sock[0]);
  for (const f of ["server.js", "chain-monitor.js", "war-scanner.js"]) {
    const cs = callsIn(f);
    assert.equal(cs.length, 1, f);
    assert.ok(!cs[0].includes("fromClient"), f);
  }
});

test("the routes set a war's enemy only from Torn's answer", () => {
  const sets = [...read("routes.js").matchAll(/war\.enemyFactionId = ([^;\n]+);/g)].map((m) => m[1]);
  assert.deepEqual(sets, ["rw.enemyFactionId"]);
});
```

- [ ] **Step 2: Run it, and watch it fail on the code as it is:**

```bash
W=/opt/warboard/.superpowers/sdd/2026-10-27-war-enemy-ping-pong; cd "$W/wt/server" && node --test war-enemy-client.test.mjs > "$W/t.log" 2>&1; command grep -E "^# (tests|pass|fail) " "$W/t.log" | paste -sd" " -; command grep -E "^not ok" "$W/t.log"
```

Expected: `# tests 8 # pass 2 # fail 6`. The two that pass pin what stays: "warboard's own checks still change it, as before" and "a connect still creates a war that does not exist". The six that fail: "a FactionOps connect cannot change a war's enemy", "the same enemy as a number is no change", "a connect fills in a missing enemy and touches nothing else", "an ignored enemy is logged once per war and enemy every 10 minutes", "every FactionOps connect passes fromClient, and warboard's own checks do not" and "the routes set a war's enemy only from Torn's answer".

- [ ] **Step 3: `server/store.js`.** Replace:

```js
export function getOrCreateWar(warId, factionId, enemyFactionId = null) {
  if (wars.has(warId)) {
    const war = wars.get(warId);
    if (enemyFactionId && war.enemyFactionId !== enemyFactionId) {
```

With:

```js
// Who may change a war's enemy. Warboard's own Torn checks may: detectNewWars,
// the chain monitor's score check and the war-scanner call this without
// `fromClient`. A FactionOps connect (the stream, the two polls and join_war)
// passes the enemy that member's script remembers, which after a new matchup
// is still the last war's. It may create a record, or fill in an enemy the
// record lacks, but never change one. When it could, every Tuesday from the
// matchup to kickoff the record flipped between the two enemies about once a
// minute, and each flip wiped the chain, the calls and the war's start.
const IGNORED_CLIENT_ENEMY_LOG_MS = 600000;
// `${warId}:${enemy}` -> when that ignored enemy was last logged.
const ignoredClientEnemyLoggedAt = new Map();

export function getOrCreateWar(warId, factionId, enemyFactionId = null, { fromClient = false } = {}) {
  if (wars.has(warId)) {
    const war = wars.get(warId);
    // As strings: some callers pass the id as a number, others as text.
    const differs = enemyFactionId && String(war.enemyFactionId) !== String(enemyFactionId);
    if (differs && fromClient) {
      if (war.enemyFactionId) {
        const key = `${warId}:${enemyFactionId}`;
        const now = Date.now();
        if (now - (ignoredClientEnemyLoggedAt.get(key) || 0) >= IGNORED_CLIENT_ENEMY_LOG_MS) {
          ignoredClientEnemyLoggedAt.set(key, now);
          console.log(`[store] ${warId} kept enemy ${war.enemyFactionId}; a FactionOps connect sent ${enemyFactionId}`);
        }
        return war;
      }
      // No enemy yet: fill it in, and leave the rest of the record alone.
      war.enemyFactionId = enemyFactionId;
      saveState();
      return war;
    }
    if (differs) {
```

- [ ] **Step 4: `server/routes.js` and `server/socket-handlers.js`.** The three calls in `routes.js` are the same line, so a counted substitution makes them; then two edits.

```bash
W=/opt/warboard/.superpowers/sdd/2026-10-27-war-enemy-ping-pong; cd "$W/wt/server" && OLD='const war = store.getOrCreateWar(warId, factionId, enemyFactionId || null);' && command grep -cF "$OLD" routes.js && sed -i 's/const war = store\.getOrCreateWar(warId, factionId, enemyFactionId || null);/const war = store.getOrCreateWar(warId, factionId, enemyFactionId || null, { fromClient: true });/' routes.js && command grep -cF "$OLD" routes.js; command grep -cF 'enemyFactionId || null, { fromClient: true });' routes.js
```

Expected: `3`, then `0`, then `3`.

In `server/socket-handlers.js`, replace:

```js
    const war = store.getOrCreateWar(warId, factionId, enemyFactionId || null);
```

With:

```js
    const war = store.getOrCreateWar(warId, factionId, enemyFactionId || null, { fromClient: true });
```

In `server/routes.js`, replace:

```js
  // WIPE STALE WAR DATA if enemy faction ID changed (bug fix)
  if (enemyFactionId && war.enemyFactionId !== enemyFactionId) {
    console.log(`[api] War ${warId} enemy changed from ${war.enemyFactionId} to ${enemyFactionId}. Wiping stale state.`);
    // The NAME is stale state too. This path used to set the id and leave
    // enemyFactionName untouched, so the record kept the previous faction's
    // name beside the new id — worse than the blank it also produced, since
    // every consumer then reports the wrong faction with confidence.
    const _ident = prewar.reassignEnemy(war, enemyFactionId, warHistory.listWars(factionId) || []);
    war.enemyFactionId = _ident.enemyFactionId;
    war.enemyFactionName = _ident.enemyFactionName;
    war.enemyStatuses = {};
    war.calls = {};
    war.priorities = {};

    // Clear call timers for this war
    for (const [key, timeoutId] of callTimers.entries()) {
      if (key.startsWith(`${warId}:`)) {
        clearTimeout(timeoutId);
        callTimers.delete(key);
      }
    }

    store.saveState();
    broadcastWarUpdate(warId);
  }
```

With:

```js
  // A client's enemy never changes the war's: getOrCreateWar ignores one that
  // differs (see store.js), and warboard's own checks set a new enemy.
```

- [ ] **Step 5: Check it parses, then run the test,** with `prewar-activity.test.mjs` and `chain-outside-war.test.mjs`, which read or stub what this changes:

```bash
W=/opt/warboard/.superpowers/sdd/2026-10-27-war-enemy-ping-pong; cd "$W/wt/server" && for f in store.js routes.js socket-handlers.js; do node --check "$f" || echo "PARSE FAIL $f"; done; command grep -c -E "prewar\.|callTimers|broadcastWarUpdate|warHistory\." routes.js; node --test war-enemy-client.test.mjs prewar-activity.test.mjs chain-outside-war.test.mjs > "$W/t.log" 2>&1; command grep -E "^# (tests|pass|fail) " "$W/t.log" | paste -sd" " -; command grep -E "^not ok" "$W/t.log"
```

Expected: no `PARSE FAIL`; a count above 0 (the names the removed block used are still used elsewhere); then `# fail 0`, with the 8 new tests passing.

- [ ] **Step 6: Mutants.** Each bends one thing this task does; the test must fail on every one. Write `$W/mutants.mjs`:

```js
// Applies each mutant to the worktree's file, runs the test, restores the file.
import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
const dir = process.argv[2];
const M = [
  ["store.js", "if (differs && fromClient) {", "if (differs && false) {"],
  ["store.js", "String(war.enemyFactionId) !== String(enemyFactionId)", "war.enemyFactionId !== enemyFactionId"],
  ["store.js", "      if (war.enemyFactionId) {", "      if (true) {"],
  ["store.js", ">= IGNORED_CLIENT_ENEMY_LOG_MS", ">= 0"],
  ["store.js", "      war.enemyFactionId = enemyFactionId;\n      saveState();\n      return war;", "      war.enemyFactionId = enemyFactionId;\n      return war;"],
  ["routes.js", "enemyFactionId || null, { fromClient: true });", "enemyFactionId || null);"],
  ["socket-handlers.js", "enemyFactionId || null, { fromClient: true });", "enemyFactionId || null);"],
];
let missed = 0;
for (const [file, from, to] of M) {
  const path = `${dir}/${file}`;
  const orig = readFileSync(path, "utf8");
  if (!orig.includes(from)) { console.log("NOT FOUND", file, JSON.stringify(from)); missed++; continue; }
  writeFileSync(path, orig.replace(from, to));
  try {
    const r = spawnSync("node", ["--test", "war-enemy-client.test.mjs"], { cwd: dir, encoding: "utf8" });
    const caught = r.status !== 0;
    console.log(caught ? "caught" : "MISSED", file, JSON.stringify(from).slice(0, 60));
    if (!caught) missed++;
  } finally {
    writeFileSync(path, orig);
  }
}
console.log(missed ? `${missed} mutant(s) not caught` : `all ${M.length} mutants caught`);
process.exit(missed ? 1 : 0);
```

```bash
W=/opt/warboard/.superpowers/sdd/2026-10-27-war-enemy-ping-pong; node "$W/mutants.mjs" "$W/wt/server" > "$W/mutants.log" 2>&1; echo "exit $?"; cat "$W/mutants.log"; git -C "$W/wt" diff --stat | cat
```

Expected: seven `caught` lines, `all 7 mutants caught`, `exit 0`, and the diff stat showing only this task's three modified files.

- [ ] **Step 7: The whole suite in the worktree,** against the baseline's failing names:

```bash
uptime; W=/opt/warboard/.superpowers/sdd/2026-10-27-war-enemy-ping-pong; cd "$W/wt/server" && node --test > "$W/suite.log" 2>&1; command grep -E "^# (tests|pass|fail|skipped) " "$W/suite.log" | paste -sd" " -; command grep -E "^not ok" "$W/suite.log" | sed -E 's/^not ok [0-9]+ - //' | sort | diff "$W/base-fail-names.txt" - && echo "same failing names as the baseline"
```

Expected: `# tests` 8 more than the baseline's, `# skipped 2`, and `same failing names as the baseline`.

- [ ] **Step 8: Sweep what the branch adds.** The new file is marked for adding first, so the diff shows it:

```bash
W=/opt/warboard/.superpowers/sdd/2026-10-27-war-enemy-ping-pong; cd "$W/wt" && git add -N -- server/war-enemy-client.test.mjs && git diff | command grep -E '^\+' > "$W/added.txt"; command grep -oE '(^|[^A-Za-z0-9])[A-Za-z0-9]{16}([^A-Za-z0-9]|$)' "$W/added.txt" | sort | uniq -c; command grep -n -i -E "production|happens" "$W/added.txt"; node "$W/sweep-env.mjs" "$W/added.txt" && node "$W/sweep-names.mjs" "$W/added.txt"
```

Expected: the 16-character words are code names this task adds or calls (`clearPayoutLootOverride` is longer and does not show), with nothing secret; no `production` or `happens` line; both sweeps clean.

- [ ] **Step 9: Commit.**

```bash
W=/opt/warboard/.superpowers/sdd/2026-10-27-war-enemy-ping-pong; cd "$W/wt" && git add -- server/war-enemy-client.test.mjs && git commit -q -m "war enemy: a member's FactionOps can no longer change it" -m "Every Tuesday from the matchup to kickoff the war record flipped between the next war's enemy and the last one's about once a minute: warboard's own checks set the new enemy, and each FactionOps connect passed the one its script remembered into getOrCreateWar, which reset the record. Each reset wiped the chain, the calls and the war's start, and held low-timer chain alerts back. Now a connect may create a record or fill in a missing enemy, never change one; an ignored enemy is logged once per war and enemy every 10 minutes. /api/poll's own enemy-change block goes, and the ids are compared as strings." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- server/war-enemy-client.test.mjs server/store.js server/routes.js server/socket-handlers.js && git status --short && git log --format='%h %s' -2 | cat
```

Expected: `?? server/node_modules`, then this commit and the plan's.

## Between Task 1 and Task 2: the final review

As superpowers:executing-plans says: the review package from the branch's merge base with main, and one fresh Opus reviewer given this plan, its Review Focus and the ledger's `Ruling:` lines. Then one fix pass for Critical and Important findings, each test-first, with the new test and the whole suite green after it. Minor findings go to the ledger and the report.

---

### Task 2: Release

- [ ] **Step 1: Pre-flight.**

```bash
uptime; W=/opt/warboard/.superpowers/sdd/2026-10-27-war-enemy-ping-pong; WT=$W/wt; command grep -E "^Task 1: complete|^Final" "$W/progress.md"; git -C "$WT" status --short; cd "$WT/server" && node --test war-enemy-client.test.mjs > "$W/t.log" 2>&1; command grep -E "^# (tests|pass|fail) " "$W/t.log" | paste -sd" " -; pm2 pid warboard | tee "$W/pid-before"; cd /opt/warboard && git log --format='%h %s' main..war-enemy-ping-pong | cat; git status --short -- server/war-enemy-client.test.mjs server/store.js server/routes.js server/socket-handlers.js
```

Expected: the load under 12; Task 1's `complete` line and the final review's lines; `?? server/node_modules`; `# tests 8 # pass 8 # fail 0`; warboard's pid; Task 1's commit and any fix-pass commits; then nothing.

- [ ] **Step 2: Fast-forward main.**

```bash
cd /opt/warboard && git merge -q --ff-only war-enemy-ping-pong; git log --format='%h %s' -1 | cat; stat -c '%U:%G %a %n' server/war-enemy-client.test.mjs server/store.js server/routes.js server/socket-handlers.js; git status --short -- server/war-enemy-client.test.mjs server/store.js server/routes.js server/socket-handlers.js
```

Expected: the branch's last commit as main's HEAD; all four `root:root 644`; then nothing. If the merge is refused, main has moved on: rebase the branch on main, run Task 1 Steps 5 and 7 again, and repeat this step.

- [ ] **Step 3: Deploy.**

```bash
uptime; W=/opt/warboard/.superpowers/sdd/2026-10-27-war-enemy-ping-pong; date -u +%FT%TZ > "$W/reload-at"; cd /opt/warboard/server && ./deploy.sh > "$W/deploy.log" 2>&1; echo "exit $?"; command grep -E "^# (tests|pass|fail|skipped) " "$W/deploy.log" | paste -sd" " -; tail -1 "$W/deploy.log"; echo "pid before $(cat "$W/pid-before") after $(pm2 pid warboard); reload at $(TZ=America/New_York date -d "$(cat "$W/reload-at")" '+%F %T %Z')"
```

Expected: `exit 0`, the suite with `# fail 0` and `# skipped 2`, 8 tests more than main's last run, `deploy ok`, two different pids and the reload's time in EDT.

- [ ] **Step 4: Watch the record settle.** Wait, with Monitor and an until-loop (not a foreground sleep), until 7 minutes have passed since the reload: long enough for `detectNewWars` (every 5 minutes outside Tuesday's matchup window) to set the new enemy if the reload caught the record on the stale one. Then count, from the log lines after the reload (EDT, like the log):

```bash
W=/opt/warboard/.superpowers/sdd/2026-10-27-war-enemy-ping-pong; T=$(TZ=America/New_York date -d "$(cat "$W/reload-at")" '+%FT%T'); tail -c 60000000 /var/log/warboard/warboard-out.log | awk -v t="$T" 'substr($0,1,19) >= t' > "$W/after.log"; echo "flips $(command grep -a -c 'New enemy detected' "$W/after.log"); kept $(command grep -a -c 'kept enemy' "$W/after.log"); poll-wipes $(command grep -a -c 'Wiping stale state' "$W/after.log")"; command grep -a -E "kept enemy|New enemy detected|Enemy changed" "$W/after.log" | tail -5 | cut -c1-160; node -e 'const w = JSON.parse(require("fs").readFileSync("/opt/warboard/server/data/wars.json", "utf8")).war_42055; console.log("enemy", w.enemyFactionId, "warStart", w.warStart ? new Date(w.warStart * 1000).toISOString() : null, "chain", w.chainData && w.chainData.current)'; tail -n 3 /var/log/warboard/warboard-error.log | cut -c1-160
```

Expected: `flips` 0 or 1 (one if the reload caught the record on the last war's enemy and `detectNewWars` then set the next war's), `kept` at least 1, `poll-wipes 0`; the record's enemy is the next war's, with its `warStart`, and the chain's count kept; no error-log line timed after the reload. If `flips` is above 1, stop and look.

- [ ] **Step 5: Push.** Sweep the lines this push adds, then push, with the remote's URL masked:

```bash
W=/opt/warboard/.superpowers/sdd/2026-10-27-war-enemy-ping-pong; cd /opt/warboard && git log --format='%h %s' origin/main..main | cat && git diff origin/main..main | command grep -E '^\+' > "$W/added.txt"; command grep -oE '(^|[^A-Za-z0-9])[A-Za-z0-9]{16}([^A-Za-z0-9]|$)' "$W/added.txt" | sort | uniq -c; node "$W/sweep-env.mjs" "$W/added.txt" && node "$W/sweep-names.mjs" "$W/added.txt" && git push -q origin main 2>&1 | sed -E 's#//[^@]*@#//***@#g'; git log --format='%h' -1 origin/main
```

Expected: the plan's commit, Task 1's and any from the fix pass, and no other session's commit (if there is one, stop and ask the owner first). Only code names among the 16-character words; both sweeps clean; origin/main's tip the same as main's.

- [ ] **Step 6: Clean up.** Copy the ledger and the logs into this session's scratchpad directory, then remove the worktree's `node_modules` link, the worktree, the branch and the workspace:

```bash
W=/opt/warboard/.superpowers/sdd/2026-10-27-war-enemy-ping-pong; S="${SCRATCHPAD:?set SCRATCHPAD to the scratchpad directory}/war-enemy-ping-pong-release"; mkdir -p "$S" && cp -r "$W/progress.md" "$W"/*.log "$W/mutants.mjs" "$S/" && rm "$W/wt/server/node_modules" && cd /opt/warboard && git worktree remove "$W/wt" && git branch -d war-enemy-ping-pong && rm -r /opt/warboard/.superpowers/sdd/2026-10-27-war-enemy-ping-pong && git worktree list | command grep -c war-enemy-ping-pong
```

Expected: `0`.

- [ ] **Step 7: Memory.** Update `reference_warboard_chain_alerts_outside_war.md`: the ping-pong is fixed (only warboard's own checks change a war's enemy; a connect's different enemy is logged as `kept enemy`), with the release's commit and time. Keep MEMORY.md's line count.

- [ ] **Step 8: Report to the owner,** in a few short lines: the flips stopped (from the Step 4 counts), the restart's time in EDT, and the rulings and deferred minors as superpowers:executing-plans lists them.
