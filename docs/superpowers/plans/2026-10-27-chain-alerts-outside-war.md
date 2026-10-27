# Chain Alerts Outside a War - Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Outside a live war (after it ends, and before kickoff), warboard sends a chain of 100 or more the same CHAIN BREAKING and CHAIN DYING alerts and bonus warnings it sends in a war, and one quiet "Chain ended at N" notice when that chain ends. In a war nothing changes.

**Architecture:**
- A new pure module, `server/chain-alert-rule.js`, holds the rule. A war is live from kickoff until it ends. Chains are alerted from 10 hits in a live war and from 100 outside one. Outside a war the chain is read every 2 minutes, and at the war's pace while it reads 100 or more (and for 5 minutes after), never later than kickoff. It also says when a reading means a chain of 100 or more has just ended.
- `server/chain-monitor.js` keeps its loop running after a war ends, where it used to stop, and reads the chain before kickoff, which it used to skip. It takes FactionOps' chain reports after a war, alerts from the rule's floor, and sends the chain-ended notice. The iOS Live Activity stays the war's, and an ended war gets no score check.
- `server/push-notifications.js` replaces the war gates on its chain alerts and bonus warnings with the rule's floor, and gains `notifyChainEnded`.
- `server/server.js`: a restart resumes the watch on an ended war, even when a Live Activity token names that war.
- Released by `deploy.sh`: it runs the whole suite and reloads warboard, which is offline for a few seconds.

**Tech Stack:** Node (ES modules) and node:test. The new tests import the rule module. They lift the functions of the three files that use it out of this checkout's copies by name, and run them against stubs, so nothing reads live data or sends a push.

**Spec:** the design the owner approved in chat, below. There is no spec file.

**The ask:**
- 23:23 EDT on 2026-10-26, the owner: "for chain alerts please alert chain dying if chain is greater 100 outside the wae because we lost chain because we stopped getting alerts".
- Facts found, from the logs and the code:
  - The war ended at 15:59:52 EDT on 2026-10-26. Ten seconds later the chain monitor logged `[chain] war war_42055 ended — monitor stopped`, and no chain line follows it. The faction chained on, and the chain died at about 23:12 EDT.
  - Three things stop the alerts at a war's end:
    - the monitor's loop stops there, and skips the chain before kickoff (2026-10-13);
    - `recordClientChainData` turns FactionOps' chain reports away once the war has ended (2026-05-10), though FactionOps keeps sending them;
    - `notifyChainAlert` and `notifyChainPanic` return outside a war (2026-05-10, on purpose: a chain after a war was thought noise), and `notifyBonusImminent` before kickoff.
  - A restart would not have brought the watch back. At the reload at 23:19 EDT one Live Activity token was on disk. The boot resume marks a token's war as handled whether or not it starts its watch, so the revive of recently-ended wars skipped the war, and no `[boot-resume]` line was logged. Every earlier revive (the last on 2026-10-19) came at a boot with no tokens.
  - FactionOps' own on-page chain alert has no war gate, but it needs a focused Torn page, so it cannot reach a locked phone.
  - 30 seconds before the war's end, a member's FactionOps reported a chain of 0 with nearly 5 minutes left on the chain's clock. The next reading had the whole chain again.
- The owner was asked three questions, each with a recommendation, and answered "go with recommended" at 04:18 EDT on 2026-10-27:
  1. "outside the war" is any time no war is live: after a war, before kickoff, between wars;
  2. the bonus warnings come outside a war too, for chains of 100 or more;
  3. when a chain of 100 or more ends outside a war, one quiet "Chain ended at N, alerts cleared" notice takes down the pinned chain alerts.
  - With them came the design. Outside a war the server reads the chain every 2 minutes (one pool call, about 30 an hour). At 100 or more it reads at the war's pace (10-20 s, or uses FactionOps' reports when they are fresh), and sends the same alerts to the same members. Under 100 it goes back to every 2 minutes. In a war nothing changes. It needs a warboard restart (`deploy.sh`).
- Rulings made while planning:
  - The chain-ended notice needs two things of the reading before the drop. By its clock the chain had 30 s or less left, counted to now: that keeps a bad 0 like the one above from telling members the chain has ended while it runs on. And it is at most 3 minutes old: that keeps a record left from before a restart from doing it.
  - Reads stay at the war's pace for 5 minutes after the last reading of 100 or more, so one bad low reading does not drop a live chain to reads 2 minutes apart.
  - The score check stays off once a war has ended. The design said that keeping the watch on would also bring back the 5-minute next-war check, as before 2026-10-13. It does not. In that check, the branch that sees a war clears the ended war's flags before `getOrCreateWar`, which archives a war only while it is flagged ended, so the ended war would be lost unarchived. The war-scanner (Tuesdays 14:00 UTC, and every 4 hours) and the war page's own check find the next war, as they do now.
  - The iOS Live Activity stays the war's: it ends with the war, as now, and a chain after the war does not raise it again.
  - On the first tick after a war ends, the war's target alert is reset, as the monitor's stop used to do, so the next war on the record gets its own.
  - Beyond the design: `server/server.js`'s boot resume marks a war as handled only once it has started the war's watch (the restart fact above). Without it the watch outside a war does not survive a restart.
  - A war with no record gets no chain alert, as now.
  - The push sender drops a chain alert under the floor too, though the monitor never sends one: the floor lives in one place, the rule.

**Execution:** the owner chooses at hand-off. One fresh Opus reviewer checks the branch between Task 1 and Task 2 either way.

**Dry run:** every block in this plan was applied, by a script that takes each one out of this file byte for byte, to copies of main's files at fb4b7da2: the test file and the failing run it makes (Task 1 Step 2), the rule and the 17 failures (Step 4: its counts and all 17 names), the thirty edits (Step 5), the checks and the green runs (Step 6: 28 of 28, then 93 of 93), the mutants (Step 7: 24 of 24) and the sweep (Step 9, in a scratch git repo). The whole suite ran too, on a copy of main's tracked server files: 2665 tests with the 30 failures named in Setup Step 3 before the edits, and 2693 with the same 30 after them. Each printed what its Expected says. Task 2 releases, so it did not run.

## Global Constraints

- In a live war nothing changes: alerts from 10 hits at the faction's chain pace, the Live Activity, the score check, the war's end.
- Outside a live war (the war has ended, or it is before `warStart`), only a chain of 100 or more gets alerts: CHAIN BREAKING at 60 s or less and CHAIN DYING at 30 s or less, with their cooldowns, and the bonus warnings. They go to the same audience (every faction member warboard knows, who has a push channel) under the same preferences (`chain_alert`, `bonus_imminent`).
- Outside a live war the chain is read every 120 s while it reads under 100. While it reads 100 or more, and for 300 s after the last such reading, it is read at `nextChain`, the war's pace. Before kickoff the next read is never later than kickoff, nor sooner than 5 s. A client report under 8 s old stands in for a read, as in a war.
- The chain-ended notice is `notifyChainEnded(audience, warId, finalCount)`: title `Chain ended at <N, with commas>`, body `Chain alerts cleared.`, tag `chain-cleared`, data `{ type: "clear-chain-alerts", warId }`, preference `chain_alert`, `{ urgency: "low", TTL: 60 }`. It is sent once, outside a live war, when a reading under 100 follows one of 100 or more that had 30 s or less left on its clock (counted to now) and is at most 180 s old. `sw.js` already closes pinned `chain-alert` and `chain-panic` notifications on that type and shows the notice silently, so `sw.js` does not change.
- No score check and no Live Activity update for an ended war.
- After a restart the watch resumes on a war that ended in the last 14 days, as `server.js`'s revive window has it (unchanged). It covers every faction warboard serves, each on its own key pool.
- No change to `sw.js`, `routes.js`, the iOS app or FactionOps.
- The repo is public. Tests and text use made-up numbers and ids (1,234 / 5,678, faction 1000, players 1000001 to 1000003), never a member's, and never a count from the logs.
- Server files end up `root:root 644`: git writes them as root, and warboard, which runs as its own user, only reads them. `push-notifications.js` is `warboard:warboard 644` now and becomes `root:root 644` with the merge, like the 149 other root-owned `.js` files in `server/`. Release: a fast-forward of main, then `deploy.sh`, which runs the whole suite, reloads warboard and checks its health. Every FactionOps client reconnects after the reload.
- Stage only this plan's paths: other sessions' dirty files in the main checkout stay as they are. Every commit ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **A bad reading of 0 in a chain's last 30 s.** The notice trusts a drop when the reading before it had 30 s or less left. A bad 0 in a chain's last 30 s would tell members the chain had ended, and take down their pinned CHAIN DYING alert, while the chain still runs. Worse, the next reading has the whole chain again, which the monitor reads as a fresh hit, and for the next 3 to 4 minutes it holds back a low timer as a stale one (`timerPlausible`, unchanged). This is how the monitor treats a bad 0 in a war too. The test "a 100+ chain has ended when a reading under 100 follows one with 30 s or less left, at most 3 minutes old" pins the 30 s line, and "no notice for a bad reading of 0, for a record from before a restart, or for a chain in a war" pins a bad 0 with minutes left.
2. **The next war found while a chain of 100 or more runs after the last one.** `getOrCreateWar` resets the record's chain to 0 when it sees a new enemy, and the next reading then looks like a fresh hit, as in item 1: no notice, but low timers are held back for a few minutes. No test here can run the war-scanner.
3. **A rematch with the same enemy.** `getOrCreateWar` resets a record only on a new enemy, so a rematch keeps the ended record and is watched as outside a war: alerts from 100, no Live Activity, no score check. Before this change it was not watched at all. No test here can run the war-scanner.
4. **App devices.** `sendToPlayers` sends the notice to the warboard app too, as it does the war's end notice. Whether the app takes its own pinned chain alerts down on `clear-chain-alerts` is the app's business, and no test here reaches it.
5. **The key pools.** Outside a war each faction's pool pays one chain read every 2 minutes, for as long as no war is live, and the reads at the war's pace while a chain of 100 or more runs. The test "outside a war, a chain under 100 is read again in 2 minutes, and one of 100 or more at the war's pace" pins the cadence.

## Paths and commands

- `W=/opt/warboard/.superpowers/sdd/2026-10-27-chain-alerts-outside-war` is this plan's git-ignored workspace, and `WT=$W/wt` the worktree, on branch `chain-alerts-outside-war`.
- **The new tests read this checkout's files**, by `new URL(..., import.meta.url)`, so in the worktree they test the worktree's code. `chain-monitor-lifecycle.test.mjs` imports main's `chain-monitor.js` by its absolute path, and `push-any-channel.test.mjs` reads main's `push-notifications.js` the same way; neither tests what this plan changes there.
- `SCRATCHPAD` is the scratchpad directory the session's system prompt names. Task 2 Step 7 uses it, and stops if it is unset.
- Test runs write to `$W/t.log` and print the `# tests`, `# pass` and `# fail` lines, then any `not ok` lines.
- **Edits:** each "Replace" block's text occurs in its file exactly once, and the "With" block takes its place. Neither block holds the newline that ends its last line. Make a step's edits in the order given.

## Setup

- [ ] **Step 1: Commit this plan on main, then make the worktree:**

```bash
uptime; cd /opt/warboard && git add -- docs/superpowers/plans/2026-10-27-chain-alerts-outside-war.md && git commit -q -m "plan: chain alerts outside a war" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- docs/superpowers/plans/2026-10-27-chain-alerts-outside-war.md && W=/opt/warboard/.superpowers/sdd/2026-10-27-chain-alerts-outside-war && mkdir -p "$W" && git worktree add -q "$W/wt" -b chain-alerts-outside-war && ln -s /opt/warboard/server/node_modules "$W/wt/server/node_modules" && git -C "$W/wt" status --short && git -C "$W/wt" log --format='%h %s' -1 | cat
```

Expected: the load under 12, then `?? server/node_modules`, then the plan's commit.

- [ ] **Step 2: The sweeps.** They live outside the repo, and Task 1 and Task 2 both use them.

Write `$W/sweep-env.mjs`:

```js
// Fails if any given file holds a value from /opt/warboard/server/.env (8 chars or more).
// Prints the names of the settings it finds, never their values.
import fs from "node:fs";
const env = fs.readFileSync("/opt/warboard/server/.env", "utf8").split("\n")
  .map((l) => l.match(/^\s*([A-Za-z_0-9]+)\s*=\s*(.*)$/)).filter(Boolean)
  .map((m) => [m[1], m[2].trim().replace(/^["']|["']$/g, "")]).filter(([, v]) => v.length >= 8);
let hits = 0;
for (const f of process.argv.slice(2)) {
  const s = fs.readFileSync(f, "utf8");
  for (const [k, v] of env) if (s.includes(v)) { console.log("HIT", k, "in", f); hits++; }
}
console.log(hits ? "SWEEP FAILED" : `sweep clean (${env.length} values checked)`);
process.exit(hits ? 1 : 0);
```

Write `$W/sweep-names.mjs`:

```js
// Fails if any given file holds the name or the id of a member of the faction, as a whole word.
// The members are those in the latest gym reading. RussianRob, the owner's publisher name, is in
// every script's @namespace and @author, so it is let be. It prints where each hit is, never the
// name or the id.
import fs from "node:fs";
const readings = JSON.parse(fs.readFileSync("/opt/warboard/server/data/gym-comp/42055.json", "utf8")).readings;
const LET_BE = new Set(["russianrob"]);
const words = new Set();
for (const [id, m] of Object.entries(readings[readings.length - 1].members)) {
  words.add(id);
  if (m.name && m.name.length >= 3 && !LET_BE.has(m.name.toLowerCase())) words.add(m.name.toLowerCase());
}
let hits = 0;
for (const f of process.argv.slice(2)) {
  fs.readFileSync(f, "utf8").split("\n").forEach((line, i) => {
    for (const w of line.toLowerCase().split(/[^a-z0-9_-]+/)) if (words.has(w)) { console.log("HIT", f + ":" + (i + 1)); hits++; }
  });
}
console.log(hits ? "NAMES SWEEP FAILED" : `names sweep clean (${words.size} names and ids checked)`);
process.exit(hits ? 1 : 0);
```

- [ ] **Step 3: Baseline.** The whole suite in the worktree, with the failing names kept for Task 1:

```bash
uptime; W=/opt/warboard/.superpowers/sdd/2026-10-27-chain-alerts-outside-war; cd "$W/wt/server" && node --test > "$W/baseline.log" 2>&1; command grep -E "^# (tests|pass|fail|skipped) " "$W/baseline.log" | paste -sd" " -; command grep -E "^not ok" "$W/baseline.log" | sed -E 's/^not ok [0-9]+ - //' | sort > "$W/base-fail-names.txt"; wc -l < "$W/base-fail-names.txt"
```

Expected: the load under 12, then the whole suite with `# skipped 2` and `30` failures. A worktree fails 30 tests that pass on main, all from what a worktree lacks: `factionops-filters.test.mjs` needs `server/.env`, `war-history-dedupe.test.mjs` needs main's uncommitted `war-history.js`, and 28 RW Pricer tests read main's live `data/rwp-prices.json`. If the names in `$W/base-fail-names.txt` are those, ledger them as the gate (`Setup: Ruling:`): Task 1 must end with the same names. If any other test fails, run it on main too (`cd /opt/warboard/server && node --test <file>`); a failure there as well is not this plan's, so ledger it and go on.

---

### Task 1: Chain alerts outside a war

**Files:**
- Create: `server/chain-alert-rule.js`, the rule.
- Create: `server/chain-outside-war.test.mjs`, its tests and those of the code below.
- Modify: `server/chain-monitor.js`: the header, the imports, `CHAIN_MIN_HITS` (gone), a new `lastBigChainAt` Map, `_processChain`, `recordClientChainData`, the poll loop in `startChainMonitor`, `stopChainMonitor`.
- Modify: `server/push-notifications.js`: an import, `hasWarEnded`'s note, a new `chainFloorForWar`, `notifyChainAlert`, `notifyChainPanic`, `notifyBonusImminent`, a new `notifyChainEnded`, `notifyEnemySurge`'s note.
- Modify: `server/server.js`: the boot resume.
- Modify: `server/chain-monitor-lifecycle.test.mjs`: its pre-war tests read the rule, and a message.

**Interfaces:**
- Consumes, unchanged: `normalizeChainData(chain, nowMs)` and `chainWithLiveTimeout(chain, nowMs)` from `chain-data.js` (the stored chain keeps its end as `chainEndsAt`; the live `timeout` is counted from it); `bonusToAnnounce(prev, current, lastAnnounced)` from `chain-bonus.js`.
- Produces, in `chain-alert-rule.js`:
  - `WAR_MIN_CHAIN = 10`, `OUTSIDE_WAR_MIN_CHAIN = 100`, `OUTSIDE_WAR_IDLE_MS = 120_000`, `BIG_CHAIN_HOLD_MS = 300_000`, `CHAIN_END_MAX_LEFT_S = 30`, `CHAIN_END_MAX_AGE_MS = 180_000`;
  - `isWarLive(war, nowMs)`: boolean;
  - `chainAlertFloor(war, nowMs)`: 10 or 100;
  - `outsideWarDelay(war, nowMs, fastMs, sinceBigChainMs)`: milliseconds;
  - `outsideWarChainEnded({ prevCurrent, prevTimeoutS, prevAgeMs, current })`: boolean.
- Produces, in `push-notifications.js`: `notifyChainEnded(warPlayers, warId, finalCount)`, a promise.

- [ ] **Step 1: The tests.**

Create `server/chain-outside-war.test.mjs`:

```js
// Chain alerts outside a war.
//
// Reported: "for chain alerts please alert chain dying if chain is greater
// 100 outside the war because we lost chain because we stopped getting
// alerts". On 2026-10-26 a war ended and the faction chained on for seven
// hours, and the chain died with no alert: the chain monitor stopped at the
// war's end, it turned FactionOps' chain reports away after it, and the push
// sender dropped chain alerts outside a war. A restart would not have
// brought them back either: the boot revive skipped an ended war that a Live
// Activity token named.
//
// Now, outside a live war (after it, before kickoff) a chain of 100 or more
// gets the same CHAIN BREAKING / CHAIN DYING alerts and bonus warnings as in
// a war, and one quiet "Chain ended at N" notice when it ends. In a war
// nothing changes. The rule is chain-alert-rule.js. These tests run it, and
// the parts of chain-monitor.js, push-notifications.js and server.js that use
// it, lifted out of this checkout's copies and run against stubs, so nothing
// here reads live data or sends a push. Numbers and ids are made up.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as path from "node:path";
import * as rule from "./chain-alert-rule.js";
import { normalizeChainData, chainWithLiveTimeout } from "./chain-data.js";
import { bonusToAnnounce } from "./chain-bonus.js";

const read = (name) => readFileSync(new URL(`./${name}`, import.meta.url), "utf8");
const MONITOR = read("chain-monitor.js");
const PUSH = read("push-notifications.js");
const SERVER = read("server.js");

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

// The module-level lines the lifted functions read: number constants, the
// per-war Maps and the poll cursor, taken from the file itself.
function moduleLines(src) {
  return [
    ...[...src.matchAll(/^const ([A-Z][A-Z0-9_]*) = ([\d_.]+);/gm)].map((m) => `const ${m[1]} = ${m[2]};`),
    ...[...src.matchAll(/^const (\w+) = new Map\(\);/gm)].map((m) => `const ${m[1]} = new Map();`),
    ...[...src.matchAll(/^let (\w+) = (\d+);/gm)].map((m) => `let ${m[1]} = ${m[2]};`),
  ];
}

// The lifted text must load no real module. chain-monitor.js reaches
// routes.js, the push sender store.js, and server.js node:fs, node:path and
// the Live Activity store, all by dynamic import: each becomes a stub the
// test passes in, and any other import fails the test.
function stubImports(text) {
  const out = text
    .replace(/await import\("\.\/live-activity-tokens\.js"\)/g, "({})")
    .replace(/await import\("node:fs"\)/g, "__fs")
    .replace(/await import\("node:path"\)/g, "__path")
    .replace(/await import\('\.\/store\.js'\)/g, "__store")
    .replace(/import\("\.\/routes\.js"\)/g, "__routes()")
    .replace(/import\.meta\.url/g, "__moduleUrl");
  assert.doesNotMatch(out, /\bimport\s*\(|import\.meta/, "a dynamic import is left in the lifted text");
  return out;
}

// Run `body` with each of `deps` in scope under its own name.
const make = (deps, body) => new Function(...Object.keys(deps), body)(...Object.values(deps));

const nowS = () => Math.floor(Date.now() / 1000);
const liveWar = () => ({ factionId: "1000", warStart: nowS() - 3_600 });
const endedWar = () => ({ factionId: "1000", warStart: nowS() - 86_400, warEnded: true, warEndedAt: Date.now() - 3_600_000 });
const comingWar = (kickoffInS) => ({ factionId: "1000", warStart: nowS() + kickoffInS });
// The reading before the next one: `current` hits, `agoMs` ago, with `leftS`
// seconds then on the chain's clock.
function lastRead(war, current, leftS, agoMs) {
  const at = Date.now() - agoMs;
  war.chainData = normalizeChainData({ current, timeout: leftS, cooldown: 0 }, at);
  war.chainDataUpdatedAt = at;
  return war;
}
const reading = (current, timeout) => ({ current, timeout, cooldown: 0 });

// ── The rule ────────────────────────────────────────────────────────────

const T = 2_000_000_000_000; // a fixed moment, in ms
const at = (startInS, extra = {}) => ({ factionId: "1000", warStart: T / 1000 + startInS, ...extra });

test("a war is live from kickoff until it ends, and a record with no start counts as started", () => {
  assert.equal(rule.isWarLive(at(-3_600), T), true);
  assert.equal(rule.isWarLive(at(0), T), true, "kickoff itself");
  assert.equal(rule.isWarLive(at(60), T), false);
  assert.equal(rule.isWarLive(at(-86_400, { warEnded: true }), T), false);
  assert.equal(rule.isWarLive({ factionId: "1000" }, T), true);
  assert.equal(rule.isWarLive(undefined, T), false);
});

test("chains are alerted from 10 hits in a live war, and from 100 after one or before kickoff", () => {
  assert.equal(rule.chainAlertFloor(at(-3_600), T), 10);
  assert.equal(rule.chainAlertFloor(at(-86_400, { warEnded: true }), T), 100);
  assert.equal(rule.chainAlertFloor(at(3_600), T), 100);
});

test("outside a war the chain is read every 2 minutes under 100, and at the war's pace from 100", () => {
  const after = (current) => at(-86_400, { warEnded: true, chainData: { current } });
  assert.equal(rule.outsideWarDelay(after(99), T, 15_000, Infinity), 120_000);
  assert.equal(rule.outsideWarDelay(after(100), T, 15_000, Infinity), 15_000);
  assert.equal(rule.outsideWarDelay(after(0), T, 15_000, 299_999), 15_000, "within 5 minutes of a reading of 100+");
  assert.equal(rule.outsideWarDelay(after(0), T, 15_000, 300_000), 120_000);
});

test("before kickoff the next read is never later than kickoff, nor sooner than 5 s", () => {
  assert.equal(rule.outsideWarDelay(at(30), T, 15_000, Infinity), 30_000);
  assert.equal(rule.outsideWarDelay(at(2), T, 15_000, Infinity), 5_000);
  assert.equal(rule.outsideWarDelay(at(3_600), T, 15_000, Infinity), 120_000);
  assert.equal(rule.outsideWarDelay(at(10, { chainData: { current: 1234 } }), T, 15_000, Infinity), 10_000);
});

test("a 100+ chain has ended when a reading under 100 follows one with 30 s or less left, at most 3 minutes old", () => {
  const ended = (o) => rule.outsideWarChainEnded({ prevCurrent: 1234, prevTimeoutS: 5, prevAgeMs: 15_000, current: 0, ...o });
  assert.equal(ended({}), true);
  assert.equal(ended({ current: 3 }), true, "a new chain's first hits");
  assert.equal(ended({ prevTimeoutS: 30, prevAgeMs: 180_000 }), true);
  assert.equal(ended({ prevTimeoutS: 285 }), false, "a bad reading of 0 with minutes left on the clock");
  assert.equal(ended({ prevAgeMs: 180_001 }), false, "a record from before a restart");
  assert.equal(ended({ prevTimeoutS: undefined }), false, "no clock on the reading before");
  assert.equal(ended({ prevCurrent: 99 }), false);
  assert.equal(ended({ current: 100 }), false);
});

// ── The push sender ─────────────────────────────────────────────────────

const PUSH_FNS = ["hasWarStarted", "hasWarEnded", "chainFloorForWar", "notifyChainAlert", "notifyChainPanic", "notifyBonusImminent", "notifyChainEnded"];
const PLAYERS = [{ id: "1000001" }, { id: "1000002" }, { id: "1000003" }]; // 1000003 has no push channel

function buildPush(wars) {
  const sends = [];
  const deps = {
    __store: { getWar: (id) => wars[id] },
    sendToPlayers: async (ids, payload, type, options) => { sends.push({ ids, payload, type, options }); },
    hasAnyPushChannel: (id) => id !== "1000003",
    ...rule,
  };
  const fns = PUSH_FNS.filter((n) => lift(PUSH, n));
  const api = make(deps, [...fns.map((n) => stubImports(lift(PUSH, n))), `return { ${fns.join(", ")} };`].join("\n"));
  return { api, sends };
}

test("outside a war, CHAIN DYING and CHAIN BREAKING go out for a chain of 100 or more, to members with a push channel", async () => {
  const { api, sends } = buildPush({ w1: endedWar() });
  await api.notifyChainPanic(PLAYERS, "w1", 1234, 25);
  await api.notifyChainAlert(PLAYERS, "w1", 100, 50, 50);
  assert.deepEqual(sends.map((s) => s.payload.tag), ["chain-panic", "chain-alert"]);
  assert.deepEqual(sends[0].ids, ["1000001", "1000002"]);
  assert.equal(sends[0].payload.title, "🔴 CHAIN DYING! 25s!");
  assert.deepEqual([sends[0].type, sends[0].options], ["chain_alert", { urgency: "high", TTL: 15 }]);
});

test("outside a war, a chain under 100 gets no chain alert", async () => {
  const { api, sends } = buildPush({ w1: endedWar(), w2: comingWar(3_600) });
  for (const w of ["w1", "w2"]) {
    await api.notifyChainPanic(PLAYERS, w, 99, 25);
    await api.notifyChainAlert(PLAYERS, w, 99, 50, 50);
  }
  assert.equal(sends.length, 0);
});

test("before kickoff, a chain of 100 or more gets CHAIN DYING", async () => {
  const { api, sends } = buildPush({ w1: comingWar(3_600) });
  await api.notifyChainPanic(PLAYERS, "w1", 1234, 25);
  assert.deepEqual(sends.map((s) => s.payload.tag), ["chain-panic"]);
});

test("in a war, chain alerts go out from 10 hits, as before", async () => {
  const { api, sends } = buildPush({ w1: liveWar() });
  await api.notifyChainPanic(PLAYERS, "w1", 10, 25);
  await api.notifyChainPanic(PLAYERS, "w1", 9, 25);
  assert.equal(sends.length, 1);
  assert.match(sends[0].payload.body, /^Chain 10 /);
});

test("bonus warnings follow the same rule, after a war and before kickoff", async () => {
  const { api, sends } = buildPush({ w1: endedWar(), w2: comingWar(3_600) });
  for (const w of ["w1", "w2"]) {
    await api.notifyBonusImminent(PLAYERS, w, 246, 250);
    await api.notifyBonusImminent(PLAYERS, w, 46, 50);
  }
  assert.deepEqual(sends.map((s) => s.payload.body), ["Chain at 246/250 — bonus hit incoming!", "Chain at 246/250 — bonus hit incoming!"]);
});

test("a war with no record gets no chain alert", async () => {
  const { api, sends } = buildPush({});
  await api.notifyChainPanic(PLAYERS, "gone", 1234, 25);
  await api.notifyBonusImminent(PLAYERS, "gone", 246, 250);
  assert.equal(sends.length, 0);
});

test("the chain-ended notice is quiet, clears the pinned chain alerts, and says where the chain stopped", async () => {
  const { api, sends } = buildPush({ w1: endedWar() });
  await api.notifyChainEnded(PLAYERS, "w1", 1234);
  assert.deepEqual(sends, [{
    ids: ["1000001", "1000002"],
    payload: { title: "Chain ended at 1,234", body: "Chain alerts cleared.", tag: "chain-cleared", icon: "/icon-192.png", data: { type: "clear-chain-alerts", warId: "w1" } },
    type: "chain_alert",
    options: { urgency: "low", TTL: 60 },
  }]);
});

// ── The chain monitor ───────────────────────────────────────────────────

const MONITOR_FNS = ["warScoreCheckInterval", "pushAudience", "_processChain", "recordClientChainData", "startChainMonitor"];
const AUDIENCE = [{ id: "1000001" }, { id: "1000002" }];

// `chainReading` is what Torn's chain call returns to the loop.
function buildMonitor(wars, chainReading = reading(0, 0)) {
  const seen = { sends: [], la: [], chainReads: 0, scoreReads: 0, stops: 0, logs: [] };
  let settle;
  const settled = new Promise((r) => { settle = r; });
  const log = (...a) => { seen.logs.push(a.join(" ")); };
  const pushStub = (name) => (...args) => { seen.sends.push([name, ...args]); return Promise.resolve(); };
  const deps = {
    store: {
      getWar: (id) => wars[id],
      saveState() {},
      getPollingKey: () => "test-key",
      getPlayerIdsForFaction: () => AUDIENCE.map((p) => p.id),
      quarantinePoolKey() {},
      demotePoolKeySelection() {},
      getOrCreateWar() {},
    },
    push: Object.fromEntries(["notifyChainPanic", "notifyChainAlert", "notifyBonusImminent", "notifyChainEnded",
      "notifyClearChainAlerts", "notifyWarTargetReached"].map((n) => [n, pushStub(n)])),
    liveActivityTokens: { listForWar: () => [] },
    console: { log, warn: log, error: log },
    // The loop's next tick: recorded, never run.
    setTimeout: (fn, ms) => { settle({ waitMs: ms }); return 1; },
    nextChain: () => 15_000,
    stopChainMonitor: () => { seen.stops++; settle({ stopped: true }); },
    broadcastChainLiveActivity: (...args) => { seen.la.push(args); return Promise.resolve(); },
    fetchFactionChain: async () => { seen.chainReads++; return { ...chainReading }; },
    fetchRankedWar: async () => { seen.scoreReads++; return null; },
    __routes: async () => ({ broadcastSSE() {} }),
    normalizeChainData, chainWithLiveTimeout, bonusToAnnounce, ...rule,
  };
  const fns = MONITOR_FNS.filter((n) => lift(MONITOR, n));
  const maps = [...MONITOR.matchAll(/^const (\w+) = new Map\(\);/gm)].map((m) => m[1]);
  const api = make(deps, [...moduleLines(MONITOR), ...fns.map((n) => stubImports(lift(MONITOR, n))),
    `return { ${fns.join(", ")}, maps: { ${maps.join(", ")} } };`].join("\n"));
  // One tick of the poll loop: start the monitor, and wait for it to set its
  // next tick, or to stop.
  api.firstTick = async (warId = "w1") => {
    let timer;
    const hung = new Promise((r) => { timer = globalThis.setTimeout(() => r({ hung: true }), 2_000); });
    api.startChainMonitor(null, warId);
    const out = await Promise.race([settled, hung]);
    globalThis.clearTimeout(timer);
    return out;
  };
  return { api, seen };
}

test("outside a war, a chain of 100 or more with 25 s left gets CHAIN DYING, and one under 100 gets nothing", async () => {
  const big = lastRead(endedWar(), 1234, 40, 15_000);
  const small = lastRead(endedWar(), 99, 40, 15_000);
  const { api, seen } = buildMonitor({ w1: big, w2: small });
  await api._processChain("w1", big, reading(1234, 25), null, "poll");
  await api._processChain("w2", small, reading(99, 25), null, "poll");
  assert.deepEqual(seen.sends.map((s) => s.slice(0, 1).concat(s.slice(2, 5))), [["notifyChainPanic", "w1", 1234, 25]]);
});

test("in a war, a chain of 10 with 25 s left gets CHAIN DYING, as before", async () => {
  const war = lastRead(liveWar(), 10, 40, 15_000);
  const { api, seen } = buildMonitor({ w1: war });
  await api._processChain("w1", war, reading(10, 25), null, "poll");
  assert.deepEqual(seen.sends.map((s) => s[0]), ["notifyChainPanic"]);
});

test("outside a war, a bonus warning goes out for a chain of 100 or more and not for a smaller one", async () => {
  const big = lastRead(endedWar(), 241, 280, 15_000);
  const small = lastRead(endedWar(), 44, 280, 15_000);
  const { api, seen } = buildMonitor({ w1: big, w2: small });
  await api._processChain("w1", big, reading(246, 290), null, "poll");
  await api._processChain("w2", small, reading(46, 290), null, "poll");
  assert.deepEqual(seen.sends.map((s) => s.slice(0, 1).concat(s.slice(2, 5))), [["notifyBonusImminent", "w1", 246, 250]]);
});

test("outside a war, a 100+ chain's end sends one quiet notice to the chain's audience", async () => {
  const war = lastRead(endedWar(), 1234, 20, 15_000); // 5 s left on its clock now
  const { api, seen } = buildMonitor({ w1: war });
  await api._processChain("w1", war, reading(0, 0), null, "poll");
  await api._processChain("w1", war, reading(0, 0), null, "poll");
  assert.deepEqual(seen.sends, [["notifyChainEnded", AUDIENCE, "w1", 1234]]);
  assert.ok(seen.logs.includes("[chain] Chain ended outside a war at 1234 (poll)"), seen.logs.join("\n"));
});

test("before kickoff, a 100+ chain's end sends the notice too", async () => {
  const war = lastRead(comingWar(3_600), 1234, 20, 15_000);
  const { api, seen } = buildMonitor({ w1: war });
  await api._processChain("w1", war, reading(0, 0), null, "client");
  assert.deepEqual(seen.sends.map((s) => s[0]), ["notifyChainEnded"]);
});

test("no notice for a bad reading of 0, for a record from before a restart, or for a chain in a war", async () => {
  const blip = lastRead(endedWar(), 1234, 290, 5_000);
  const stale = lastRead(endedWar(), 1234, 20, 18 * 3_600_000);
  const inWar = lastRead(liveWar(), 1234, 20, 15_000);
  const { api, seen } = buildMonitor({ w1: blip, w2: stale, w3: inWar });
  await api._processChain("w1", blip, reading(0, 0), null, "client");
  await api._processChain("w1", blip, reading(1234, 280), null, "client");
  await api._processChain("w2", stale, reading(0, 0), null, "poll");
  await api._processChain("w3", inWar, reading(0, 0), null, "poll");
  assert.deepEqual(seen.sends, []);
});

test("the iOS Live Activity stays with the war: readings after a war update nothing, readings in one do", async () => {
  const after = lastRead(endedWar(), 1234, 200, 15_000);
  const during = lastRead(liveWar(), 1234, 200, 15_000);
  const { api, seen } = buildMonitor({ w1: after, w2: during });
  await api._processChain("w1", after, reading(1240, 290), null, "poll");
  await api._processChain("w2", during, reading(1240, 290), null, "poll");
  assert.deepEqual(seen.la.map((a) => a[0]), ["w2"]);
});

test("after a war, FactionOps' chain reports are taken in", async () => {
  const war = lastRead(endedWar(), 1234, 200, 15_000);
  const { api } = buildMonitor({ w1: war });
  assert.equal(await api.recordClientChainData("w1", { ...reading(1240, 290), serverTimestamp: nowS() }), true);
  assert.equal(war.chainData.current, 1240);
  assert.equal(await api.recordClientChainData("gone", reading(1240, 290)), false, "no war, no report");
});

test("the first tick after a war ends keeps watching, and clears the war's scores and its target alert", async () => {
  const war = { ...endedWar(), warScores: { myScore: 5678, enemyScore: 1234 } };
  const { api, seen } = buildMonitor({ w1: war });
  api.maps.warTargetNotified.set("w1", true);
  const tick = await api.firstTick();
  assert.equal(seen.stops, 0);
  assert.equal(typeof tick.waitMs, "number");
  assert.equal(war.warScores, undefined);
  assert.equal(api.maps.warTargetNotified.has("w1"), false, "the next war on this record gets its own target alert");
  assert.ok(seen.logs.includes("[chain] war w1 ended — watching the chain outside the war (alerts from 100 hits)"), seen.logs.join("\n"));
});

test("after a war, each tick reads the chain and never the war's score", async () => {
  const { api, seen } = buildMonitor({ w1: endedWar() });
  await api.firstTick();
  assert.deepEqual([seen.chainReads, seen.scoreReads], [1, 0]);
});

test("outside a war, a chain under 100 is read again in 2 minutes, and one of 100 or more at the war's pace", async () => {
  const quiet = buildMonitor({ w1: endedWar() }, reading(99, 200));
  const busy = buildMonitor({ w1: endedWar() }, reading(1234, 200));
  assert.deepEqual(await quiet.api.firstTick(), { waitMs: 120_000 });
  assert.deepEqual(await busy.api.firstTick(), { waitMs: 15_000 });
});

test("for 5 minutes after a reading of 100 or more, the war's pace holds though the chain reads less", async () => {
  const war = endedWar();
  const { api } = buildMonitor({ w1: war }, reading(0, 0));
  await api._processChain("w1", war, reading(1234, 200), null, "client");
  war.chainDataUpdatedAt = Date.now() - 60_000; // no fresh client report, so the tick reads the chain itself
  assert.deepEqual(await api.firstTick(), { waitMs: 15_000 });
});

test("before kickoff the chain is read too, and the next tick comes no later than kickoff", async () => {
  const { api, seen } = buildMonitor({ w1: comingWar(30) });
  const tick = await api.firstTick();
  assert.equal(seen.chainReads, 1);
  assert.ok(tick.waitMs <= 30_000 && tick.waitMs >= 28_000, `waited ${tick.waitMs} ms`);
});

test("in a war, the next tick is at the war's pace whatever the chain, as before", async () => {
  const quiet = buildMonitor({ w1: liveWar() }, reading(0, 0));
  const busy = buildMonitor({ w1: liveWar() }, reading(1234, 200));
  assert.deepEqual(await quiet.api.firstTick(), { waitMs: 15_000 });
  assert.deepEqual(await busy.api.firstTick(), { waitMs: 15_000 });
});

// ── A restart ───────────────────────────────────────────────────────────

// server.js resumes the chain watches at boot in one anonymous block. This
// lifts it out by the Set it starts with and runs it against stub files.
function bootResume(wars, tokenRows) {
  const mark = SERVER.indexOf("const seen = new Set();");
  const start = SERVER.lastIndexOf("(async () => {", mark);
  assert.ok(mark > 0 && start > 0, "the boot resume block is not where this test looks for it");
  const text = SERVER.slice(start, closer(SERVER, SERVER.indexOf("{", start)) + 1) + ")()";
  const started = [];
  const deps = {
    store: { getWar: (id) => wars[id], getAllWars: () => wars },
    startChainMonitor: (io, warId) => { started.push(warId); },
    console: { log() {}, warn() {} },
    __fs: { existsSync: () => true, readFileSync: () => JSON.stringify(tokenRows) },
    __path: path,
    __moduleUrl: "file:///srv/warboard/server/server.js",
  };
  return make(deps, `return ${stubImports(text)};`).then(() => started);
}

test("a restart resumes the watch on a war that has ended, even when a Live Activity token names it", async () => {
  const wars = { war_1000: endedWar() };
  assert.deepEqual(await bootResume(wars, [{ warId: "war_1000", playerId: "1000001", token: "t" }]), ["war_1000"]);
  assert.deepEqual(await bootResume(wars, []), ["war_1000"]);
});

test("a restart starts a live war's watch once, from its Live Activity tokens", async () => {
  const wars = { war_1000: liveWar() };
  assert.deepEqual(await bootResume(wars, [{ warId: "war_1000" }, { warId: "war_1000" }]), ["war_1000"]);
});
```

- [ ] **Step 2: Run them, and watch them fail to load:**

```bash
W=/opt/warboard/.superpowers/sdd/2026-10-27-chain-alerts-outside-war; cd "$W/wt/server" && node --test chain-outside-war.test.mjs > "$W/t.log" 2>&1; command grep -E "^# (tests|pass|fail) " "$W/t.log" | paste -sd" " -; command grep -m1 -o "Cannot find module '[^']*'" "$W/t.log" | sed "s#'.*/#'#"
```

Expected: `# tests 1 # pass 0 # fail 1`, then `Cannot find module 'chain-alert-rule.js'`: the file cannot load without the rule.

- [ ] **Step 3: The rule.**

Create `server/chain-alert-rule.js`:

```js
// When the server sends chain alerts, in a war and outside one.
//
// In a live war every chain of 10 or more gets the CHAIN BREAKING (60 s
// left) and CHAIN DYING (30 s left) alerts and the bonus warnings. Outside
// a live war (after it ends, before kickoff) only a chain of 100 or more
// does. Factions keep a chain going after a war, and on 2026-10-26 one that
// ran on for seven hours after its war died with no alert, because the
// alerts had stopped with the war. FactionOps' own on-page alert still
// covers smaller chains for anyone with FactionOps open on a Torn page.
//
// Pure, with no imports: chain-monitor.js and push-notifications.js both
// read it, and the tests import it directly.

/** The smallest chain alerted while a war is live. */
export const WAR_MIN_CHAIN = 10;

/** The smallest chain alerted outside a live war. */
export const OUTSIDE_WAR_MIN_CHAIN = 100;

/**
 * How often the chain is checked outside a war while it reads under 100.
 * Every hit puts the chain's clock back to 5 minutes, so a chain that
 * reaches 100 just after a check still has 3 minutes or more left at the
 * next one: time for the war-pace checks to catch the 60 s and 30 s marks.
 */
export const OUTSIDE_WAR_IDLE_MS = 120_000;

/**
 * How long the war-pace checks hold after the last reading of 100 or more.
 * A chain's clock never runs past 5 minutes, so a chain read at 100+ that
 * recently may still be alive though a later reading says less (see
 * CHAIN_END_MAX_LEFT_S for one that did).
 */
export const BIG_CHAIN_HOLD_MS = 300_000;

/**
 * A drop counts as the chain ending only if, by the clock of the reading
 * before it, the chain had this many seconds or fewer left. A chain ends
 * only when its clock runs out, so a drop with more time left is a bad
 * reading: at the end of a war on 2026-10-26 a member's FactionOps
 * reported one 0 with nearly 5 minutes left on the chain's clock, and the
 * next reading had the whole chain again.
 */
export const CHAIN_END_MAX_LEFT_S = 30;

/**
 * ...and only if the reading before it is this recent, so a record left
 * from before a restart, read again hours later, never reports a chain as
 * just ended.
 */
export const CHAIN_END_MAX_AGE_MS = 180_000;

/** The shortest wait before kickoff, as the pre-war cadence had it. */
const MIN_PRE_WAR_DELAY_MS = 5_000;

/**
 * True while the war on this record has started and not ended. A record
 * with no start time counts as started, as push-notifications.js'
 * hasWarStarted has it: never miss a live chain for want of a date.
 */
export function isWarLive(war, nowMs) {
  if (!war || war.warEnded === true) return false;
  const startSec = Number(war.warStart) || 0;
  return !startSec || nowMs / 1000 >= startSec;
}

/** The smallest chain worth an alert on this record at this moment. */
export function chainAlertFloor(war, nowMs) {
  return isWarLive(war, nowMs) ? WAR_MIN_CHAIN : OUTSIDE_WAR_MIN_CHAIN;
}

/**
 * Milliseconds until the next chain check outside a live war: `fastMs`, the
 * war's own pace, while the chain reads 100 or more or did within
 * BIG_CHAIN_HOLD_MS (`sinceBigChainMs` ago); otherwise OUTSIDE_WAR_IDLE_MS.
 * Before kickoff the wait never runs past kickoff, so the war's own pace
 * starts on time.
 */
export function outsideWarDelay(war, nowMs, fastMs, sinceBigChainMs) {
  const current = Number(war?.chainData?.current) || 0;
  const big = current >= OUTSIDE_WAR_MIN_CHAIN || sinceBigChainMs < BIG_CHAIN_HOLD_MS;
  const delay = big ? fastMs : OUTSIDE_WAR_IDLE_MS;
  const startSec = Number(war?.warStart) || 0;
  const msToKickoff = startSec * 1000 - nowMs;
  if (war && !war.warEnded && startSec > 0 && msToKickoff > 0) {
    return Math.min(delay, Math.max(MIN_PRE_WAR_DELAY_MS, msToKickoff));
  }
  return delay;
}

/**
 * True when a reading shows that a chain of 100 or more has just ended: the
 * reading before it was 100+ and recent, and by its clock the chain had 30 s
 * or less left (`prevTimeoutS`, counted to now), and this reading is under
 * 100 (0, or a new chain's first hits).
 */
export function outsideWarChainEnded({ prevCurrent, prevTimeoutS, prevAgeMs, current }) {
  return prevCurrent >= OUTSIDE_WAR_MIN_CHAIN
    && current < OUTSIDE_WAR_MIN_CHAIN
    && prevTimeoutS <= CHAIN_END_MAX_LEFT_S
    && prevAgeMs <= CHAIN_END_MAX_AGE_MS;
}
```

- [ ] **Step 4: Run the tests again,** and watch them fail on the code as it is:

```bash
W=/opt/warboard/.superpowers/sdd/2026-10-27-chain-alerts-outside-war; cd "$W/wt/server" && node --test chain-outside-war.test.mjs > "$W/t.log" 2>&1; command grep -E "^# (tests|pass|fail) " "$W/t.log" | paste -sd" " -; command grep -E "^not ok" "$W/t.log" | sed -E 's/^not ok [0-9]+ - //'; command grep -c "name: 'AssertionError'" "$W/t.log"; command grep -c "api.notifyChainEnded is not a function" "$W/t.log"
```

Expected: `# tests 28 # pass 11 # fail 17`, then these 17 names:

```
outside a war, CHAIN DYING and CHAIN BREAKING go out for a chain of 100 or more, to members with a push channel
before kickoff, a chain of 100 or more gets CHAIN DYING
in a war, chain alerts go out from 10 hits, as before
bonus warnings follow the same rule, after a war and before kickoff
the chain-ended notice is quiet, clears the pinned chain alerts, and says where the chain stopped
outside a war, a chain of 100 or more with 25 s left gets CHAIN DYING, and one under 100 gets nothing
outside a war, a bonus warning goes out for a chain of 100 or more and not for a smaller one
outside a war, a 100+ chain's end sends one quiet notice to the chain's audience
before kickoff, a 100+ chain's end sends the notice too
the iOS Live Activity stays with the war: readings after a war update nothing, readings in one do
after a war, FactionOps' chain reports are taken in
the first tick after a war ends keeps watching, and clears the war's scores and its target alert
after a war, each tick reads the chain and never the war's score
outside a war, a chain under 100 is read again in 2 minutes, and one of 100 or more at the war's pace
for 5 minutes after a reading of 100 or more, the war's pace holds though the chain reads less
before kickoff the chain is read too, and the next tick comes no later than kickoff
a restart resumes the watch on a war that has ended, even when a Live Activity token names it
```

then `16`, the failures on what the code does, and `1`, the one on `notifyChainEnded`, which is not written yet. The 11 that pass are the rule's five, and what the code already does: in a war, alerts from 10 hits at the war's pace; the push sender sends nothing for a chain under 100 outside a war, nor for a war with no record; a bad 0 gets no notice; a restart starts a live war's watch once.

- [ ] **Step 5: The code.** Thirty edits, in this order: 17 in `server/chain-monitor.js`, 7 in `server/push-notifications.js`, 3 in `server/server.js`, 3 in `server/chain-monitor-lifecycle.test.mjs`.

**Edit 1 of 17 in `server/chain-monitor.js`.** Replace:

```js
 * Server-side fallback: polls Torn API for chain data when no client is
 * reporting chain info (i.e. nobody has FactionOps open). Fires push
 * notifications for chain-break alerts and bonus-imminent hits.
 *
 * Only polls when:
 * - A war is active
 * - No client has reported chain data in the last CLIENT_STALE_MS
 */
```

With:

```js
 * Server-side fallback: polls Torn API for chain data when no client is
 * reporting chain info (i.e. nobody has FactionOps open). Fires push
 * notifications for chain-break alerts and bonus-imminent hits.
 *
 * Polls only when no client has reported chain data in the last
 * CLIENT_CHAIN_FRESH_MS. In a live war it alerts on chains of 10 or more,
 * at the faction's chain pace. Outside one (after the war, before kickoff)
 * it alerts on chains of 100 or more, and reads the chain every 2 minutes
 * until it reaches 100: see chain-alert-rule.js.
 */
```

**Edit 2 of 17 in `server/chain-monitor.js`.** Replace:

```js
import { normalizeChainData, chainWithLiveTimeout } from "./chain-data.js";
```

With:

```js
import { normalizeChainData, chainWithLiveTimeout } from "./chain-data.js";
import { isWarLive, chainAlertFloor, outsideWarDelay, outsideWarChainEnded, OUTSIDE_WAR_MIN_CHAIN } from "./chain-alert-rule.js";
```

**Edit 3 of 17 in `server/chain-monitor.js`.** Replace:

```js
let _chainPollCursor = 0;
const CHAIN_MIN_HITS = 10;        // only alert when chain >= 10 (real chain)
```

With:

```js
let _chainPollCursor = 0;
```

**Edit 4 of 17 in `server/chain-monitor.js`.** Replace:

```js
const lastChainIncreaseAt = new Map();
```

With:

```js
const lastChainIncreaseAt = new Map();
/** Wall-clock (ms) of the last reading of 100 or more per warId. Outside a
 * war it keeps the reads at the war's pace for a while after it. */
const lastBigChainAt = new Map();
```

**Edit 5 of 17 in `server/chain-monitor.js`.** Replace:

```js
  const prevChain = chainWithLiveTimeout({ ...war.chainData }, Date.now());
```

With:

```js
  const prevChain = chainWithLiveTimeout({ ...war.chainData }, Date.now());
  // The age of that reading, taken before it is overwritten below: a record
  // left from before a restart must not pass for a chain that just ended.
  const prevAgeMs = Date.now() - (Number(war.chainDataUpdatedAt) || 0);
```

**Edit 6 of 17 in `server/chain-monitor.js`.** Replace:

```js
  if ((chain.current || 0) > (prevChain.current || 0)) lastChainIncreaseAt.set(warId, Date.now());
  const tokenCount = liveActivityTokens.listForWar(warId).length;
  console.log(`[chain/${source}] war=${warId} prev=${prevChain.current||0} curr=${chain.current||0} cooldown=${chain.cooldown} timeout=${chain.timeout} tokens=${tokenCount} willPush=${countChanged || cooldownFlipped || broke}`);
  if (countChanged || cooldownFlipped || broke) {
```

With:

```js
  if ((chain.current || 0) > (prevChain.current || 0)) lastChainIncreaseAt.set(warId, Date.now());
  // Chains are alerted from 10 hits in a live war, and from 100 outside one.
  const warLive = isWarLive(war, Date.now());
  const minChain = chainAlertFloor(war, Date.now());
  if ((chain.current || 0) >= OUTSIDE_WAR_MIN_CHAIN) lastBigChainAt.set(warId, Date.now());
  const tokenCount = liveActivityTokens.listForWar(warId).length;
  // The iOS Live Activity belongs to the war: the war's end ends it (in the
  // poll loop below), and a chain after the war does not raise it again.
  const willPush = !war.warEnded && (countChanged || cooldownFlipped || broke);
  console.log(`[chain/${source}] war=${warId} prev=${prevChain.current||0} curr=${chain.current||0} cooldown=${chain.cooldown} timeout=${chain.timeout} tokens=${tokenCount} willPush=${willPush}`);
  if (willPush) {
```

**Edit 7 of 17 in `server/chain-monitor.js`.** Replace:

```js
  if (!isCoolingDown && !timerPlausible && chain.timeout > 0 && chain.timeout <= CHAIN_ALERT_THRESHOLD && chain.current >= CHAIN_MIN_HITS) {
```

With:

```js
  if (!isCoolingDown && !timerPlausible && chain.timeout > 0 && chain.timeout <= CHAIN_ALERT_THRESHOLD && chain.current >= minChain) {
```

**Edit 8 of 17 in `server/chain-monitor.js`.** Replace:

```js
  if (!isCoolingDown && timerPlausible && chain.timeout > 0 && chain.current >= CHAIN_MIN_HITS) {
```

With:

```js
  if (!isCoolingDown && timerPlausible && chain.timeout > 0 && chain.current >= minChain) {
```

**Edit 9 of 17 in `server/chain-monitor.js`.** Replace:

```js
  if (!isCoolingDown && chain.current >= CHAIN_MIN_HITS) {
```

With:

```js
  if (!isCoolingDown && chain.current >= minChain) {
```

**Edit 10 of 17 in `server/chain-monitor.js`.** Replace:

```js
  // A broken or reset chain starts the announcements over: the next chain
  // deserves its own warning at the same milestone.
```

With:

```js
  // Outside a war, a chain of 100 or more that ends gets one quiet notice,
  // which also takes down its pinned CHAIN BREAKING / CHAIN DYING alerts, as
  // the war's end does for a war's. outsideWarChainEnded says which drops
  // count: not a bad reading of 0, nor a record from before a restart.
  if (!warLive && outsideWarChainEnded({
    prevCurrent: prevChain.current || 0,
    prevTimeoutS: prevChain.timeout,
    prevAgeMs,
    current: chain.current || 0,
  })) {
    push.notifyChainEnded(pushAudience(war), warId, prevChain.current)
      .catch((e) => console.warn(`[chain] chain-ended push failed: ${e.message}`));
    console.log(`[chain] Chain ended outside a war at ${prevChain.current} (${source})`);
  }
  // A broken or reset chain starts the announcements over: the next chain
  // deserves its own warning at the same milestone.
```

**Edit 11 of 17 in `server/chain-monitor.js`.** Replace:

```js
 * we already have so a slow client can't override fresh data.
 */
export async function recordClientChainData(warId, chain) {
  const war = store.getWar(warId);
  if (!war || war.warEnded) return false;
```

With:

```js
 * we already have so a slow client can't override fresh data.
 * Taken after a war ends too: the chain is still watched then (from 100
 * hits), and FactionOps keeps sending it.
 */
export async function recordClientChainData(warId, chain) {
  const war = store.getWar(warId);
  if (!war) return false;
```

**Edit 12 of 17 in `server/chain-monitor.js`.** Replace:

```js
    // STOP once the war is over. This loop had no warEnded gate at all, and
    // stopChainMonitor was only ever reachable from shutdown — so an ended
    // war kept a 10-20s chain poll running until the next matchup, days
    // later. Worse, it SPED UP: warScoreCheckInterval drops to the 30s
    // endgame cadence once |my - enemy| >= 0.9 * target, and a ranked war
    // ends precisely when the lead reaches the target, so that condition is
    // true by definition from the final whistle onward.
    //
    // Safe to stop here because the war-end branch below has already run on
    // the tick that detected it, and a NEW war gets a fresh monitor from
    // war-scanner's crons, server boot, or a client loading the war page.
    if (war.warEnded) {
      // Clear the scores that pinned the endgame cadence. Belt and braces:
      // if a restart ever resurrects this record, the stop above fires
      // first, but leaving a 30s-forever trap in the data is not worth it.
      if (war.warScores) { delete war.warScores; store.saveState(); }
      stopChainMonitor(warId);
      console.log(`[chain] war ${warId} ended — monitor stopped`);
      return;
    }

    // DON'T POLL BEFORE KICKOFF. war records are created as soon as Torn
    // lists the matchup, which is days early, and the chain poll ran at full
    // speed that whole time against a chain nobody is building yet.
    //
    // The war-score check still runs at its normal 300s cadence: it is what
    // keeps warStart fresh and what notices a matchup being cancelled. Only
    // the 10-20s chain fetch is suppressed.
    const startSec = Number(war.warStart) || 0;
    const preWar = startSec > 0 && Date.now() / 1000 < startSec;
```

With:

```js
    // A war that has ended keeps its watch. This loop used to stop at the
    // war's end, and on 2026-10-26 a chain that ran on for seven hours after
    // its war died with no alert. Outside a live war (after it, and before
    // kickoff) the chain is read every 2 minutes, and at the war's pace while
    // it reads 100 or more: see chain-alert-rule.js and the scheduling at the
    // end of this tick.
    //
    // On the first tick after the end, clear the war's scores, as the stop
    // here used to (they pinned the score check at its 30s endgame cadence:
    // a ranked war ends exactly when the lead reaches the target), and its
    // target alert, so the next war on this record gets its own.
    if (war.warEnded && war.warScores) {
      delete war.warScores;
      warTargetNotified.delete(warId);
      store.saveState();
      console.log(`[chain] war ${warId} ended — watching the chain outside the war (alerts from ${OUTSIDE_WAR_MIN_CHAIN} hits)`);
    }
```

**Edit 13 of 17 in `server/chain-monitor.js`.** Replace:

```js
    const ageMs = Date.now() - updatedAt;
    // `preWar` joins the existing client-freshness gate rather than getting
    // its own branch, so the war-score check keeps running underneath it
    // exactly as it does when a client is pushing chain data.
    const skipChainFetch = preWar || ageMs < CLIENT_CHAIN_FRESH_MS;
```

With:

```js
    const ageMs = Date.now() - updatedAt;
    const skipChainFetch = ageMs < CLIENT_CHAIN_FRESH_MS;
```

**Edit 14 of 17 in `server/chain-monitor.js`.** Replace:

```js
        if (skipChainFetch) {
          // Say WHICH gate fired. Both suppress the fetch, but "client data
          // is 13s old" printed 66 hours before kickoff is a lie that would
          // send the next reader looking for a client that isn't there.
          console.log(preWar
            ? `[chain/skip] war=${warId} pre-war, kickoff in ${Math.round((startSec * 1000 - Date.now()) / 3600000)}h`
            : `[chain/skip] war=${warId} client data is ${Math.round(ageMs / 1000)}s old (gate=${CLIENT_CHAIN_FRESH_MS / 1000}s)`);
```

With:

```js
        if (skipChainFetch) {
          console.log(`[chain/skip] war=${warId} client data is ${Math.round(ageMs / 1000)}s old (gate=${CLIENT_CHAIN_FRESH_MS / 1000}s)`);
```

**Edit 15 of 17 in `server/chain-monitor.js`.** Replace:

```js
      const lastCheck = lastScoreCheck.get(warId) || 0;
      if (Date.now() - lastCheck > scoreDueIn) {
```

With:

```js
      const lastCheck = lastScoreCheck.get(warId) || 0;
      // Not once the war has ended: the war-scanner finds the next war. Here,
      // the `if (rw)` branch below would clear the ended war's flags before
      // getOrCreateWar, which archives a war only while it is flagged ended.
      if (!war.warEnded && Date.now() - lastCheck > scoreDueIn) {
```

**Edit 16 of 17 in `server/chain-monitor.js`.** Replace:

```js
      if (chainErr) throw chainErr;
      // Before kickoff there is no chain to watch, so there is no reason to
      // wake every 10-20s: the only work left on a pre-war tick is the
      // 300s war-score check. Wake on that cadence instead, and never
      // sleep past kickoff itself.
      if (preWar) {
        const msToStart = Math.max(0, startSec * 1000 - Date.now());
        scheduleNext(Math.max(5_000, Math.min(warScoreCheckInterval(war), msToStart)));
      } else {
        scheduleNext(nextChain(war));
      }
```

With:

```js
      if (chainErr) throw chainErr;
      // In a live war, the war's pace. Outside one, every 2 minutes, or the
      // war's pace while the chain reads 100 or more (and for a while after),
      // and before kickoff never later than kickoff.
      const now = Date.now();
      scheduleNext(isWarLive(war, now)
        ? nextChain(war)
        : outsideWarDelay(war, now, nextChain(war), now - (lastBigChainAt.get(warId) || 0)));
```

**Edit 17 of 17 in `server/chain-monitor.js`.** Replace:

```js
  lastChainIncreaseAt.delete(warId);
  lastBonusAnnounced.delete(warId);
```

With:

```js
  lastChainIncreaseAt.delete(warId);
  lastBigChainAt.delete(warId);
  lastBonusAnnounced.delete(warId);
```

**Edit 1 of 7 in `server/push-notifications.js`.** Replace:

```js
import { listForPlayer as fcmListForPlayer } from "./fcm-subscriptions.js";
```

With:

```js
import { listForPlayer as fcmListForPlayer } from "./fcm-subscriptions.js";
// Which chains are worth an alert, in a war and outside one. The module is
// pure, so this static import adds no cycle.
import { chainAlertFloor } from "./chain-alert-rule.js";
```

**Edit 2 of 7 in `server/push-notifications.js`.** Replace:

```js
/** Check if the war has ended. Used to gate chain panic / alert
 *  notifications that should stop after the war is over — factions
 *  often keep chaining post-war for the bonus, but the panic urgency
 *  is gone and the push notifications become noise on PDA / FCM. */
async function hasWarEnded(warId) {
  const store = await import('./store.js');
  const war = store.getWar(warId);
  if (!war) return false;
  return war.warEnded === true;
}
```

With:

```js
/** Check if the war has ended. Used to gate the enemy-surge notification,
 *  which stops after the war is over. Chain alerts no longer stop there:
 *  see chainFloorForWar. */
async function hasWarEnded(warId) {
  const store = await import('./store.js');
  const war = store.getWar(warId);
  if (!war) return false;
  return war.warEnded === true;
}

/** The smallest chain worth an alert for this war at this moment: 10 hits
 *  in a live war, 100 outside one, after it or before kickoff
 *  (chain-alert-rule.js). Factions keep chaining after a war, and a chain
 *  that big is worth saving. No war record, no alert, as hasWarStarted
 *  has it. */
async function chainFloorForWar(warId) {
  const store = await import('./store.js');
  const war = store.getWar(warId);
  return war ? chainAlertFloor(war, Date.now()) : Infinity;
}
```

**Edit 3 of 7 in `server/push-notifications.js`.** Replace:

```js
export async function notifyChainAlert(warPlayers, warId, current, timeout, timeLeft) {
  if (!(await hasWarStarted(warId))) return;
  if (await hasWarEnded(warId)) return;
```

With:

```js
export async function notifyChainAlert(warPlayers, warId, current, timeout, timeLeft) {
  if ((Number(current) || 0) < (await chainFloorForWar(warId))) return;
```

**Edit 4 of 7 in `server/push-notifications.js`.** Replace:

```js
export async function notifyChainPanic(warPlayers, warId, current, timeLeft) {
  if (!(await hasWarStarted(warId))) return;
  if (await hasWarEnded(warId)) return;
```

With:

```js
export async function notifyChainPanic(warPlayers, warId, current, timeLeft) {
  if ((Number(current) || 0) < (await chainFloorForWar(warId))) return;
```

**Edit 5 of 7 in `server/push-notifications.js`.** Replace:

```js
export async function notifyBonusImminent(warPlayers, warId, current, nextBonus) {
  if (!(await hasWarStarted(warId))) return;
```

With:

```js
export async function notifyBonusImminent(warPlayers, warId, current, nextBonus) {
  if ((Number(current) || 0) < (await chainFloorForWar(warId))) return;
```

**Edit 6 of 7 in `server/push-notifications.js`.** Replace:

```js
    "chain_alert", // re-use chain_alert pref so opt-outs cascade naturally
    { urgency: "low", TTL: 60 },
  );
}
```

With:

```js
    "chain_alert", // re-use chain_alert pref so opt-outs cascade naturally
    { urgency: "low", TTL: 60 },
  );
}

/**
 * Fired when a chain of 100 or more ends outside a war (chain-monitor.js).
 * Like the war-end notice above, it takes down the chain-alert /
 * chain-panic notifications still pinned from that chain, with a quiet
 * line saying where the chain stopped.
 */
export async function notifyChainEnded(warPlayers, warId, finalCount) {
  const playerIds = warPlayers.map((p) => p.playerId || p.id);
  await sendToPlayers(
    playerIds.filter((id) => hasAnyPushChannel(id)),
    {
      title: `Chain ended at ${(Number(finalCount) || 0).toLocaleString("en-US")}`,
      body: "Chain alerts cleared.",
      tag: "chain-cleared",
      icon: "/icon-192.png",
      data: { type: "clear-chain-alerts", warId },
    },
    "chain_alert",
    { urgency: "low", TTL: 60 },
  );
}
```

**Edit 7 of 7 in `server/push-notifications.js`.** Replace:

```js
 * sharply — i.e. the enemy is rallying. Suppressed post-war (matches
 * chain-panic gating) since a surge after the war's over is just
 * noise. Per-faction config (threshold/window/cooldown) is enforced
```

With:

```js
 * sharply — i.e. the enemy is rallying. Suppressed post-war since a
 * surge after the war's over is just noise. Per-faction config
 * (threshold/window/cooldown) is enforced
```

**Edit 1 of 3 in `server/server.js`.** Replace:

```js
          if (row && row.warId && !seen.has(row.warId)) {
            seen.add(row.warId);
            const w = store.getWar(row.warId);
            if (w && !w.warEnded) {
              startChainMonitor(null, row.warId);
```

With:

```js
          if (row && row.warId && !seen.has(row.warId)) {
            const w = store.getWar(row.warId);
            if (w && !w.warEnded) {
              // Marked only once started. An ENDED war's token used to mark
              // it too, and the revive below then skipped that war, so a
              // restart after a war left its chain unwatched (2026-10-26).
              seen.add(row.warId);
              startChainMonitor(null, row.warId);
```

**Edit 2 of 3 in `server/server.js`.** Replace:

```js
    // 2026-05-19: Also resume chain-monitor for every recently-ended
    // war so the next ranked-war match for that faction gets picked up
    // automatically without waiting on client traffic. Previously
    // chain-monitor stopped permanently on warEnded → new-war detection
    // was blocked until someone loaded the war page (which then ran the
    // route-level lazy detection). Recency gate: 14 days, well past any
    // realistic between-war gap so we don't keep polling abandoned wars
    // forever.
```

With:

```js
    // Also resume chain-monitor for every recently-ended war, so its chain
    // is still watched after the war: chain-monitor alerts on a chain of
    // 100 or more outside a war (chain-alert-rule.js). Added on 2026-05-19
    // for new-war detection, which is the war-scanner's now: chain-monitor
    // makes no score check on an ended war. Recency gate: 14 days, well
    // past any realistic between-war gap so we don't keep polling
    // abandoned wars forever.
```

**Edit 3 of 3 in `server/server.js`.** Replace:

```js
      if (revived > 0) console.log(`[boot-resume] revived chain-monitor for ${revived} recently-ended synthetic war(s) so new-war detection stays live`);
```

With:

```js
      if (revived > 0) console.log(`[boot-resume] revived chain-monitor for ${revived} recently-ended synthetic war(s) so their chains stay watched`);
```

**Edit 1 of 3 in `server/chain-monitor-lifecycle.test.mjs`.** Replace:

```js
import { warScoreCheckInterval } from "/opt/warboard/server/chain-monitor.js";
```

With:

```js
import { warScoreCheckInterval } from "/opt/warboard/server/chain-monitor.js";
import { isWarLive } from "./chain-alert-rule.js";
```

**Edit 2 of 3 in `server/chain-monitor-lifecycle.test.mjs`.** Replace:

```js
    "this is why an ended war polled FASTER — the fix is to stop the monitor and clear warScores");
```

With:

```js
    "this is why an ended war polled FASTER — the fix is to clear warScores when the war ends");
```

**Edit 3 of 3 in `server/chain-monitor-lifecycle.test.mjs`.** Replace:

```js
// The pre-war gate, as the source computes it.
const preWarAt = (warStart, nowSec) => {
  const s = Number(warStart) || 0;
  return s > 0 && nowSec < s;
};
test("pre-war gate: suppressed before kickoff, live after", () => {
  const start = 2_000_000_000;
  assert.equal(preWarAt(start, start - 86_400), true,  "a day before kickoff -> no chain fetch");
```

With:

```js
// Before kickoff, as chain-alert-rule.js has it: the war is not live yet, so
// only chains of 100 or more are alerted.
const preWarAt = (warStart, nowSec) => !isWarLive({ warStart }, nowSec * 1000);
test("pre-war: not live before kickoff, live from it", () => {
  const start = 2_000_000_000;
  assert.equal(preWarAt(start, start - 86_400), true,  "a day before kickoff -> pre-war");
```

- [ ] **Step 6: Check it parses, then run the tests,** with the six other test files that load or read these files:

```bash
W=/opt/warboard/.superpowers/sdd/2026-10-27-chain-alerts-outside-war; cd "$W/wt/server" && for f in chain-alert-rule.js chain-monitor.js push-notifications.js server.js; do node --check "$f" || echo "$f DOES NOT PARSE"; done; command grep -cE "preWar|startSec|CHAIN_MIN_HITS|  stopChainMonitor\(warId\);" chain-monitor.js; node --test chain-outside-war.test.mjs > "$W/t.log" 2>&1; command grep -E "^# (tests|pass|fail) " "$W/t.log" | paste -sd" " -; command grep -E "^not ok" "$W/t.log"; node --test chain-outside-war.test.mjs chain-monitor-lifecycle.test.mjs war-score-cadence.test.js push-any-channel.test.mjs stakeout-watcher.test.js chain-data.test.js blood-bags-route.test.js 2>&1 | command grep -E "^# (tests|pass|fail) " | paste -sd" " -
```

Expected: no `DOES NOT PARSE`; `0`, for nothing left of the old pre-war gate, the old floor or the stop; `# tests 28 # pass 28 # fail 0` and no `not ok` lines; then `# tests 93 # pass 93 # fail 0`, the 28 and the other six files' 65.

- [ ] **Step 7: Mutants.** Each undoes or bends one thing this branch does, and the new tests must catch every one.

Write `$W/mutants.mjs`:

```js
// Each mutant undoes or bends one thing this branch does, in a copy of the
// files, and the new tests must fail on every one. Run with the worktree's
// server directory and a scratch directory to copy into.
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const [SRC, SCRATCH] = process.argv.slice(2);
const FILES = ["chain-alert-rule.js", "chain-monitor.js", "push-notifications.js", "server.js",
  "chain-data.js", "chain-bonus.js", "chain-outside-war.test.mjs"];
const R = "chain-alert-rule.js", M = "chain-monitor.js", P = "push-notifications.js";
const MUTANTS = [
  ["outside a war, alerts from 10", R, "export const OUTSIDE_WAR_MIN_CHAIN = 100;", "export const OUTSIDE_WAR_MIN_CHAIN = 10;"],
  ["in a war, alerts from 100", R, "export const WAR_MIN_CHAIN = 10;", "export const WAR_MIN_CHAIN = 100;"],
  ["an ended war counts as live", R, "if (!war || war.warEnded === true) return false;", "if (!war) return false;"],
  ["a war counts as live before kickoff", R, "return !startSec || nowMs / 1000 >= startSec;", "return true;"],
  ["idle reads every 15 s", R, "export const OUTSIDE_WAR_IDLE_MS = 120_000;", "export const OUTSIDE_WAR_IDLE_MS = 15_000;"],
  ["no hold after a 100+ reading", R, " || sinceBigChainMs < BIG_CHAIN_HOLD_MS", ""],
  ["reads run past kickoff", R, "return Math.min(delay, Math.max(MIN_PRE_WAR_DELAY_MS, msToKickoff));", "return delay;"],
  ["a drop with 5 minutes left counts as the end", R, "export const CHAIN_END_MAX_LEFT_S = 30;", "export const CHAIN_END_MAX_LEFT_S = 300;"],
  ["a stale record counts as the end", R, "\n    && prevAgeMs <= CHAIN_END_MAX_AGE_MS;", ";"],
  ["client reports refused after a war", M, "  if (!war) return false;", "  if (!war || war.warEnded) return false;"],
  ["score check after a war", M, "if (!war.warEnded && Date.now() - lastCheck > scoreDueIn) {", "if (Date.now() - lastCheck > scoreDueIn) {"],
  ["target alert kept after a war", M, "      warTargetNotified.delete(warId);\n", ""],
  ["Live Activity after a war", M, "const willPush = !war.warEnded && (", "const willPush = ("],
  ["chain-ended notice in a war", M, "if (!warLive && outsideWarChainEnded({", "if (outsideWarChainEnded({"],
  ["chain-ended notice names the new count", M, "push.notifyChainEnded(pushAudience(war), warId, prevChain.current)", "push.notifyChainEnded(pushAudience(war), warId, chain.current)"],
  ["war pace always", M, "scheduleNext(isWarLive(war, now)", "scheduleNext(true"],
  ["monitor alerts from 10 outside a war", M, "chain.timeout > 0 && chain.current >= minChain) {", "chain.timeout > 0 && chain.current >= 10) {"],
  ["monitor bonus from 10 outside a war", M, "if (!isCoolingDown && chain.current >= minChain) {", "if (!isCoolingDown && chain.current >= 10) {"],
  ["sender: no floor on CHAIN DYING", P, "export async function notifyChainPanic(warPlayers, warId, current, timeLeft) {\n  if ((Number(current) || 0) < (await chainFloorForWar(warId))) return;\n", "export async function notifyChainPanic(warPlayers, warId, current, timeLeft) {\n"],
  ["sender: no floor on bonus warnings", P, "export async function notifyBonusImminent(warPlayers, warId, current, nextBonus) {\n  if ((Number(current) || 0) < (await chainFloorForWar(warId))) return;\n", "export async function notifyBonusImminent(warPlayers, warId, current, nextBonus) {\n"],
  ["sender: alerts for a war with no record", P, "return war ? chainAlertFloor(war, Date.now()) : Infinity;", "return war ? chainAlertFloor(war, Date.now()) : 0;"],
  ["sender: notice of a type sw.js does not clear on", P, "      data: { type: \"clear-chain-alerts\", warId },\n    },\n    \"chain_alert\",\n", "      data: { type: \"chain-ended\", warId },\n    },\n    \"chain_alert\",\n"],
  ["sender: notice to members with no channel", P, "    playerIds.filter((id) => hasAnyPushChannel(id)),\n    {\n      title: `Chain ended at", "    playerIds,\n    {\n      title: `Chain ended at"],
  ["restart: a token marks an ended war handled", "server.js", "            const w = store.getWar(row.warId);\n            if (w && !w.warEnded) {", "            seen.add(row.warId);\n            const w = store.getWar(row.warId);\n            if (w && !w.warEnded) {"],
];

const dir = fs.mkdtempSync(path.join(SCRATCH, "mut-"));
const reset = () => { for (const f of FILES) fs.copyFileSync(path.join(SRC, f), path.join(dir, f)); };
const run = () => spawnSync(process.execPath, ["--test", "chain-outside-war.test.mjs"], { cwd: dir, encoding: "utf8" }).status;
reset();
if (run() !== 0) { console.log("the unmutated copy fails: stop"); process.exit(1); }
let caught = 0;
for (const [name, file, from, to] of MUTANTS) {
  reset();
  const p = path.join(dir, file);
  const s = fs.readFileSync(p, "utf8");
  if (s.split(from).length !== 2) { console.log(`NOT APPLIED (text not found once): ${name}`); continue; }
  fs.writeFileSync(p, s.replace(from, to));
  const status = run();
  if (status !== 0) caught++;
  console.log(`${status !== 0 ? "caught  " : "SURVIVED"} ${name}`);
}
fs.rmSync(dir, { recursive: true });
console.log(`caught ${caught} of ${MUTANTS.length}`);
process.exit(caught === MUTANTS.length ? 0 : 1);
```

Run it on the worktree's files:

```bash
uptime; W=/opt/warboard/.superpowers/sdd/2026-10-27-chain-alerts-outside-war; node "$W/mutants.mjs" "$W/wt/server" "$W"
```

Expected: the load under 12, then 24 lines that start `caught`, then `caught 24 of 24`. A `SURVIVED` line is a test missing; a `NOT APPLIED` line means the code differs from this plan's edits.

- [ ] **Step 8: The whole suite in the worktree,** against the baseline's failing names:

```bash
uptime; W=/opt/warboard/.superpowers/sdd/2026-10-27-chain-alerts-outside-war; cd "$W/wt/server" && node --test > "$W/suite.log" 2>&1; command grep -E "^# (tests|pass|fail|skipped) " "$W/suite.log" | paste -sd" " -; command grep -E "^not ok" "$W/suite.log" | sed -E 's/^not ok [0-9]+ - //' | sort | diff "$W/base-fail-names.txt" - && echo "same failing names as the baseline"
```

Expected: `# tests` 28 more than the baseline's, `# skipped 2`, and `same failing names as the baseline`.

- [ ] **Step 9: Sweep what the branch adds.** The two new files are marked for adding first, so the diff shows them:

```bash
W=/opt/warboard/.superpowers/sdd/2026-10-27-chain-alerts-outside-war; cd "$W/wt" && git add -N -- server/chain-alert-rule.js server/chain-outside-war.test.mjs && git diff | command grep -E '^\+' > "$W/added.txt"; command grep -oE '(^|[^A-Za-z0-9])[A-Za-z0-9]{16}([^A-Za-z0-9]|$)' "$W/added.txt" | sort | uniq -c; node "$W/sweep-env.mjs" "$W/added.txt" && node "$W/sweep-names.mjs" "$W/added.txt"
```

Expected: five function names this branch adds or calls (`chainFloorForWar`, `notifyChainAlert`, `notifyChainEnded`, `notifyChainPanic`, and `stopChainMonitor` in the tests' stubs), nothing secret, then both sweeps clean:

```
      4  chainFloorForWar(
      1  chainFloorForWar.
      1 "chainFloorForWar"
      2 "notifyChainAlert"
      2 .notifyChainAlert(
      1  notifyChainEnded(
      4 "notifyChainEnded"
      2 .notifyChainEnded(
      4 "notifyChainPanic"
      6 .notifyChainPanic(
      1  stopChainMonitor:
sweep clean (13 values checked)
names sweep clean (173 names and ids checked)
```

The counts in the last two lines move as `.env` and the faction's roster do.

- [ ] **Step 10: Commit.**

```bash
W=/opt/warboard/.superpowers/sdd/2026-10-27-chain-alerts-outside-war; cd "$W/wt" && git add -- server/chain-alert-rule.js server/chain-outside-war.test.mjs && git commit -q -m "chain alerts outside a war: from 100 hits, and a notice when the chain ends" -m "After a war and before kickoff, a chain of 100 or more gets the CHAIN BREAKING and CHAIN DYING alerts and the bonus warnings again. The chain monitor stopped at a war's end and turned FactionOps' chain reports away, the push sender dropped the alerts, and a restart skipped an ended war that a Live Activity token named. When such a chain ends, one quiet notice takes its pinned alerts down. In a war nothing changes." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- server/chain-alert-rule.js server/chain-outside-war.test.mjs server/chain-monitor.js server/push-notifications.js server/server.js server/chain-monitor-lifecycle.test.mjs && git status --short && git log --format='%h %s' -2 | cat
```

Expected: `?? server/node_modules`, then this commit and the plan's.

## Between Task 1 and Task 2: the final review

As superpowers:executing-plans says: the review package from the branch's merge base with main, and one fresh Opus reviewer given this plan, its Review Focus and the ledger's `Ruling:` lines. Then one fix pass for Critical and Important findings, each test-first, with the new tests and the whole suite green after it. Minor findings go to the ledger and the report.

---

### Task 2: Release

- [ ] **Step 1: Pre-flight.** Note pm2's warboard pid; Step 3 checks that the reload changed it.

```bash
uptime; W=/opt/warboard/.superpowers/sdd/2026-10-27-chain-alerts-outside-war; WT=$W/wt; command grep -E "^Task 1: complete|^Final" "$W/progress.md"; git -C "$WT" status --short; cd "$WT/server" && node --test chain-outside-war.test.mjs > "$W/t.log" 2>&1; command grep -E "^# (tests|pass|fail) " "$W/t.log" | paste -sd" " -; pm2 pid warboard | tee "$W/pid-before"; cd /opt/warboard && git log --format='%h %s' main..chain-alerts-outside-war | cat; git status --short -- server/chain-alert-rule.js server/chain-outside-war.test.mjs server/chain-monitor.js server/push-notifications.js server/server.js server/chain-monitor-lifecycle.test.mjs
```

Expected: the load under 12; Task 1's `complete` line and the final review's lines; `?? server/node_modules`; `# tests 28 # pass 28 # fail 0`; warboard's pid, a number other than 0; Task 1's commit and any fix-pass commits; then nothing, because main's copies of the six paths are clean.

- [ ] **Step 2: Fast-forward main.** Warboard keeps running the old code until Step 3's reload: it read these files when it started.

```bash
cd /opt/warboard && git merge -q --ff-only chain-alerts-outside-war; git log --format='%h %s' -1 | cat; stat -c '%U:%G %a %n' server/chain-alert-rule.js server/chain-outside-war.test.mjs server/chain-monitor.js server/push-notifications.js server/server.js server/chain-monitor-lifecycle.test.mjs; git status --short -- server/chain-alert-rule.js server/chain-outside-war.test.mjs server/chain-monitor.js server/push-notifications.js server/server.js server/chain-monitor-lifecycle.test.mjs
```

Expected: the branch's last commit as main's HEAD; all six `root:root 644` (`push-notifications.js` was `warboard:warboard 644`, and warboard reads it either way); then nothing. If the merge is refused, main has moved on. Then run `git -C "$W/wt" rebase main`, run Task 1 Steps 6 and 8 again, and repeat this step.

- [ ] **Step 3: Deploy.** `deploy.sh` runs the whole suite on main, refuses to reload if anything fails, then reloads warboard and asks it for its health. Warboard is offline for a few seconds, and every FactionOps client reconnects.

```bash
uptime; W=/opt/warboard/.superpowers/sdd/2026-10-27-chain-alerts-outside-war; date -u +%FT%TZ > "$W/reload-at"; cd /opt/warboard/server && ./deploy.sh > "$W/deploy.log" 2>&1; echo "exit $?"; command grep -E "^# (tests|pass|fail|skipped) " "$W/deploy.log" | paste -sd" " -; tail -1 "$W/deploy.log"; echo "pid before $(cat "$W/pid-before") after $(pm2 pid warboard); reload at $(TZ=America/New_York date -d "$(cat "$W/reload-at")" '+%F %T %Z')"
```

Expected: the load under 12, then `exit 0`, the suite with `# fail 0` and `# skipped 2`, 28 tests more than main's last run, then `deploy ok`, then two different pids and the reload's time in EDT.

- [ ] **Step 4: Check the boot:**

```bash
W=/opt/warboard/.superpowers/sdd/2026-10-27-chain-alerts-outside-war; echo "reload at $(TZ=America/New_York date -d "$(cat "$W/reload-at")" '+%FT%T')"; command grep -a -E "\[boot-resume\]|\[chain\] (Started|Stopped) monitoring|monitor stopped|watching the chain" /var/log/warboard/warboard-out.log | tail -4 | cut -c1-170; command grep -a -E "\[(chain|boot-resume|live-activity)\]" /var/log/warboard/warboard-error.log | tail -3 | cut -c1-170
```

Expected: the reload's time, then, timed after it (both logs are in EDT), `[boot-resume] revived chain-monitor for 1 recently-ended synthetic war(s) so their chains stay watched` and `[chain] Started monitoring for war war_42055 (server fallback, polls every 20s when no client active)`. A `Stopped monitoring` line timed at the reload is the old process shutting down. No `monitor stopped` line after the reload, and no `watching the chain` line either: the war's scores were cleared when the old code stopped its watch. In the error log, no line timed after the reload.

- [ ] **Step 5: Watch the watch.** Wait, with Monitor and an until-loop (not a foreground sleep), until the war record has a chain reading newer than the reload, for at most 5 minutes:

```bash
W=/opt/warboard/.superpowers/sdd/2026-10-27-chain-alerts-outside-war; until node -e 'const fs = require("fs"); const w = JSON.parse(fs.readFileSync("/opt/warboard/server/data/wars.json", "utf8")).war_42055; process.exit(w.chainDataUpdatedAt > new Date(fs.readFileSync(process.argv[1], "utf8").trim()).getTime() ? 0 : 1)' "$W/reload-at"; do sleep 10; done; echo "new reading"
```

Then:

```bash
W=/opt/warboard/.superpowers/sdd/2026-10-27-chain-alerts-outside-war; node -e 'const fs = require("fs"); const w = JSON.parse(fs.readFileSync("/opt/warboard/server/data/wars.json", "utf8")).war_42055; console.log("reading", Math.round((w.chainDataUpdatedAt - new Date(fs.readFileSync(process.argv[1], "utf8").trim()).getTime()) / 1000), "s after the reload; warEnded", w.warEnded === true)' "$W/reload-at"; command grep -a -E "\[chain/(poll|client|skip)\] war=war_42055" /var/log/warboard/warboard-out.log | tail -4 | cut -c1-200; command grep -a -c "Chain ended outside a war" /var/log/warboard/warboard-out.log
```

Expected: `new reading`; then `reading <n> s after the reload; warEnded true`; then chain lines timed after the reload. `[chain/poll]` lines are the server's own reads, with `willPush=false`: the Live Activity stays off after a war. With no FactionOps client reporting and a chain under 100 they come 120 s apart, and 10 to 20 s apart while a chain of 100 or more runs. `[chain/client]` lines are members' FactionOps reports, taken in again, with `[chain/skip] ... client data is <n>s old` lines between them. Then `0`, unless a chain of 100 or more has ended since the reload. If no new reading comes in 5 minutes, stop and look: `[chain] Poll failed` lines in the error log say why.

- [ ] **Step 6: Push.** Sweep the lines this push adds, then push, with the remote's URL masked:

```bash
W=/opt/warboard/.superpowers/sdd/2026-10-27-chain-alerts-outside-war; cd /opt/warboard && git log --format='%h %s' origin/main..main | cat && git diff origin/main..main | command grep -E '^\+' > "$W/added.txt"; command grep -oE '(^|[^A-Za-z0-9])[A-Za-z0-9]{16}([^A-Za-z0-9]|$)' "$W/added.txt" | sort | uniq -c; node "$W/sweep-env.mjs" "$W/added.txt" && node "$W/sweep-names.mjs" "$W/added.txt" && git push -q origin main 2>&1 | sed -E 's#//[^@]*@#//***@#g'; git log --format='%h' -1 origin/main
```

Expected: the plan's commit, Task 1's and any from the fix pass, and no other session's commit: if there is one, stop and ask the owner before pushing it. Then the 16-character words, each with the characters either side of it: the function names `chainFloorForWar`, `fcmListForPlayer`, `notifyChainAlert`, `notifyChainEnded`, `notifyChainPanic`, `notifyEnemySurge` and `stopChainMonitor`, and no others. Then both sweeps clean, and the push's own output, which is nothing; then origin/main's tip, the same commit as main's. Any other 16-character word stops the push until it is explained.

- [ ] **Step 7: Clean up.** Copy the ledger and the logs into this session's scratchpad directory, then remove the worktree's `node_modules` link, the worktree, the branch and the workspace:

```bash
W=/opt/warboard/.superpowers/sdd/2026-10-27-chain-alerts-outside-war; S="${SCRATCHPAD:?set SCRATCHPAD to the scratchpad directory}/chain-alerts-outside-war-release"; mkdir -p "$S" && cp -r "$W/progress.md" "$W"/*.log "$W/mutants.mjs" "$S/" && rm "$W/wt/server/node_modules" && cd /opt/warboard && git worktree remove "$W/wt" && git branch -d chain-alerts-outside-war && rm -r /opt/warboard/.superpowers/sdd/2026-10-27-chain-alerts-outside-war && git worktree list | command grep -c chain-alerts-outside-war
```

(`SCRATCHPAD` is the scratchpad directory the session's system prompt names; unset, the command stops before it does anything.) Expected: `0`.

- [ ] **Step 8: Memory.**
  - A new `reference_warboard_chain_alerts_outside_war.md`: outside a live war (ended, or before kickoff) chain alerts and bonus warnings go out from 100 hits (`chain-alert-rule.js`); the chain is read every 2 minutes under 100, at the war's pace from 100 and for 5 minutes after; one `notifyChainEnded` notice when such a chain ends (the reading before had 30 s or less left and is at most 3 minutes old); no score check on an ended war (the war-scanner finds the next war); the Live Activity stays the war's; the boot resume marks a war handled only once it starts the watch, and resumes ended wars for 14 days. Owed: the owner's check.
  - MEMORY.md is at its 200-line limit, so add the pointer to the `reference_warboard_war_data_model.md` line rather than a line of its own.

- [ ] **Step 9: Report to the owner,** in a few short lines:
  - Chain alerts now work outside a war: after a war and before kickoff, a chain of 100 or more gets CHAIN BREAKING, CHAIN DYING and the bonus warnings, and when it ends, one quiet "Chain ended at N" notice clears the pinned alerts. In a war nothing changed.
  - Warboard restarted at the reload's time, in EDT, for a few seconds.
  - Two things the design did not say: the 5-minute next-war check does not come back after a war (the war-scanner keeps that job: the check would lose the ended war's archive), and a restart now resumes the watch (the 23:19 restart did not, because of a Live Activity token).
  - Ask them to check, on the next chain of 100 or more outside a war: a CHAIN BREAKING or CHAIN DYING alert reaches a locked phone, and when the chain ends, the "Chain ended at N" notice comes and the chain alerts go.
  - Then the rulings and deferred minors, as superpowers:executing-plans lists them, and the siblings: a rematch with the same enemy is watched as outside a war (`getOrCreateWar` resets a record only on a new enemy); a bad 0, or the next war's reset of the record, holds back low timers for 3 to 4 minutes, in a war too; `sw.js` leaves bonus warnings pinned; `routes.js` still starts no watch for an ended war, so only a restart more than 14 days after a war leaves it unwatched; `stopChainMonitor` is now called by nothing.
