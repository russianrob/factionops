# FactionOps Chain Bar on Every Page - Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On every Torn page, a flashing red bar from FactionOps while the faction's chain has 10 or more hits and the chain-alert threshold (1:00 unless changed) or less left.

**Architecture:**
- `server/public/scripts/factionops.user.js` (the served script is the source) gains SECTION 1A, right after CONFIG and `setConfig`. It holds the pure parts (`isFactionOpsPage`, `readChainFromDom`, `chainCooldownFrom`, `chainNag`, `chainBarStep`, `chainBarText`), the bar (`renderChainBar`), a once-a-second `chainBarTick`, the one Torn API check per dying chain (`startChainBarCheck`), and `startChainBar()`. Then comes the gate: `if (!isFactionOpsPage(location.href)) return;`.
- The header keeps its nine `@match` lines and adds `https://www.torn.com/*` and `https://torn.com/*`, as the private build did in 5.4.2 for its chat dock. Off the old pages, the script stops at the gate, right after starting the bar.
- The bar reads Torn's sidebar chain bar. Where the sidebar gives no reading, the war overlay's chain stands in, handed over by the overlay's chain tick (`chainBarFromOverlay`) with the alerts' own checks. The existing chain alerts (sound, PDA notification, the overlay's timer) are untouched.
- Released as 5.6.21 by fast-forwarding main. The script is served from main's checkout, so no restart is needed.

**Tech Stack:**
- A plain-JS userscript.
- Server tests: `node --test` (node:test). New: `server/factionops-chain-bar.test.mjs`, which lifts the pure functions out of the script text the way `factionops-warchat.test.mjs` does.
- A browser test, `tests/factionops/chainbar.e2e.test.mjs`. It uses playwright-core from `/root/.hermes/hermes-agent/node_modules`, as Gym Coach's browser tests do. It runs the real script on a made-up Torn page, with the GM storage and the Torn API stubbed.

**Spec:** the owner's messages and the design they approved, below. There is no spec file.

**The ask:**
- **The owner's messages (EDT, 2026-10-27):**
  - About 10:11: "look at gym cosch about the red bar on every page saying how long its been a full bar of E, use same concept but for when any chain is dying under 1:00 left".
  - Then: "but have it flashing if possible".
  - 11:37, after it was built in Gym Coach: "the chain bar should be factionops not gym coach unless thays the name of it".
  - Then: "i want the bar to be on all pages if possible and Q2 on all chain alerts". Q2 asked whether the bar should follow FactionOps' chain-alert on/off setting and threshold (default 1:00) and its checks (10+ hits, page focus with PDA exempt), with the recommended answer "one switch for all chain alerts".
  - At 12:27, "go", on this design:
    - FactionOps loads on every Torn page. Off its own pages (faction, war, attack, profile) it runs only the chain bar: no overlay, no server connection, no request interception.
    - The bar flashes red and white at the top, reading `CHAIN DYING · 1,234 hits · 0:42 left`, and clicks pass through it. It follows the chain-alert switch and threshold (default 1:00), with 10+ hits and page focus (PDA exempt).
    - On FactionOps' own pages it comes up with the existing chain alerts, from the same chain data and checks. The sound and PDA notification stay as they are, on those pages only.
    - On other pages it reads Torn's sidebar chain clock every second. Before it first comes up, it makes one Torn API call (the faction's chain, as FactionOps' own poll does) to rule out a finished chain's cooldown. If that call fails, the bar shows anyway.
    - Torn PDA may need FactionOps updated in PDA before the new pages apply; the owner checks on the phone.
    - Reuse the tested Gym Coach chain-bar code and drop that branch.
- **Facts found:**
  - FactionOps 5.6.20's `@match` list: `factions.php?step=your*` and `?step=profile*` (www only); `loader.php?sid=attack*`, `page.php?sid=attack*` and `profiles.php?XID=*` (www and bare); `war.php*` (www only). The script is one IIFE, run at `document-idle`. Before its first side effect come only the GM polyfill, CONFIG and the PDA key's first save.
  - The existing chain alerts live in `startChainTimer`'s tick, a requestAnimationFrame loop that only `initWarOverlay` starts.
    - The checks: `CONFIG.CHAIN_ALERT && _chainFocusOK && chainDataFresh && chainTimeoutPlausible && state.chain.timeout > 0 && state.chain.current >= 10`.
    - At the threshold or less, a sound plus a PDA notification ("CHAIN BREAKING!"); at 30 s or less, the same ("CHAIN DYING!"). The overlay's small timer pulses red under 30 s. There is no bar.
  - The chain data on FactionOps' pages comes from the direct poll `api.torn.com/faction/<id>?selections=chain` every 30 s, which also reads `cooldown`. `parseChainFromDOM` reads Torn's `#barChain` as follows:
    - `bar-stats`: "1/10" or "Chain: 1,234/100,000";
    - `bar-timeleft`: "MM:SS", "M:SS" or "HH:MM:SS".
  - Where the war overlay runs, `moveTornChainBar` moves Torn's `#barChain` into the overlay's header and reads the count from it and the clock from the direct poll ("DOM for count, API poll for timeout"); its comment warns that PDA may lose the bar's id after the move. Gym Coach reads the live sidebar's `#barEnergy` (or `[id^="barEnergy"]`) by its whole text on every page.
  - FactionOps' call toasts sit at the top centre, `top: 10px`, at z-index 1000001.
  - Gym Coach's full-bar banner (`#gcb-fullbar-nag`, released Gym Coach and beta) also sits at the top centre, at z-index 2147483646. It picks its spot once, when it is created: 96 px if `#fo-call-toast-container` or an element whose id starts `fo-chain` is on the page, else 10 px.
  - `factionops.meta.js` is the user.js header, byte for byte. Both files are `warboard:warboard 644`. Express serves them from main's checkout. nginx caches the plain address for 300 s.
  - Most FactionOps server tests read main's copy by its absolute path, so in a worktree they test main, not the branch. `factionops-call-drops.test.mjs` takes `FO_SRC`.
- **Rulings** (each one is the recommended answer or follows from the approved design):
  1. **FactionOps' own pages** are exactly its old `@match` list (`FO_PAGE_PATTERNS`). The nine lines stay in the header, followed by the two every-page lines.
  2. **Data:** Torn's sidebar first, on every page. The war overlay's chain (`chainBarFromOverlay`, under 2 s old) stands in only where the sidebar gives no reading, and only while the alerts' own checks pass (fresh, plausible, more than 0 left); it needs no cooldown check, because the overlay's poll knows the cooldown. Changed after the final review: an overlay-first draft kept the bar up after a save until the overlay's next poll, and down while the overlay had no chain data though the sidebar showed the chain dying. The switch, threshold and checks stay shared with the alerts. The sidebar's clock is `#barChain`'s `bar-timeleft` element, as `parseChainFromDOM` reads it. Its count is the first `n/m` in the rest of the bar's text, the way Gym Coach reads the energy bar, because nothing here shows which element Torn puts the number in. For the same reason, a bar with no `bar-timeleft` element takes its clock from the first element in it that holds nothing but a clock (Torn's CDP Chrome was not reachable to look, 2026-10-27).
  3. **The check:** `https://api.torn.com/faction/?selections=chain&key=<the FactionOps key>` (v1, the key owner's faction), once per dying chain, before the bar first comes up.
     - The bar is shown anyway after 5 s with no answer, on an error, or when there is no key.
     - A check stands for the same count while the clock only runs down, for up to a minute.
     - A check that says cooldown keeps the bar down until the cooldown ends or the count grows, and only while that cooldown agrees with the sidebar's clock: at most 45 s ahead of it and 5 s behind. (Added after the final review: Torn reported a cooldown for a chain that ran on, 2026-10-26.)
  4. **When it is up:** 0 < left ≤ the threshold (`Number(CONFIG.CHAIN_ALERT_THRESHOLD)`, 60 if not a positive number), the same `<=` as the alerts. The text says `CHAIN DYING` for the whole window, as approved.
  5. **The on/off switch:** the bar is off when `CONFIG.CHAIN_ALERT` is false or the string `'false'`. PDA's GM storage hands values back as strings, as the CONFIG comment on `CALL_CHAT` says. The alerts' own check is left as it is (a sibling).
  6. **Where it sits:** fixed, top centre, `top: 10px`, z-index 2147483647, `pointer-events: none`. It goes 6 px below Gym Coach's full-bar banner while that banner holds the top spot (its top under 50 px). Its style element's id does not start `fo-chain`, because that element stays on the page and would send Gym Coach's banner to 96 px with no bar up.
  7. **No sound and no notification** from the bar.
  8. **Version 5.6.21.** FactionOps has no CHANGELOG block.
  9. **Gym Coach:** the unreleased 0.12.19 branch `gym-coach-chain-bar` is deleted and Gym Coach stays at 0.12.18. The stat-book fix offered on 2026-10-22, still waiting for the owner, would be 0.12.19.

**Execution:** Native, with no plan-review stop (the owner: build it without stopping again unless something is off). One fresh Opus reviewer checks the branch between Task 1 and Task 2. The release falls under the standing OK for commit and push at version boundaries after the sweep. The final review changed Rulings 2 and 3; Task 1's code blocks are the reviewed draft, and the branch holds the shipped code and tests.

## Global Constraints

- **Version:** `@version` and `SCRIPT_VERSION` are both `5.6.21`. `factionops.meta.js` is the user.js header, byte for byte. The served files are `warboard:warboard 644`.
- **Header:** the nine old `@match` lines stay, then `// @match        https://www.torn.com/*` and `// @match        https://torn.com/*`. Nothing else in the header changes.
- **Off FactionOps' old pages, nothing runs past the gate:** no overlay, no request to tornwar.com, no request interception, no menu commands. The only request is the Torn API chain check, once per dying chain.
- **The bar:**
  - The element id is `fo-chain-bar`, its style element `fo-style-chain-bar`, and the keyframes `fo-chain-bar-flash`.
  - The text is `CHAIN DYING · <count with commas> hits · <m>:<ss> left`.
  - It flashes red and white once a second, and is steady red under `prefers-reduced-motion`.
- **When the bar is up:**
  - chain alerts are on;
  - the page has focus, or this is Torn PDA;
  - the count is 10 or more;
  - 0 < left ≤ the threshold;
  - no standing check says the chain is in its cooldown at this count or higher, with a cooldown that agrees with the sidebar's clock.
- **The existing chain alerts do not change:** the sound, the PDA notification, the overlay's timer and their checks.
- **ASCII only in what is added:** `\u00B7` in strings for the dot. No raw curly quotes in the file (PDA breaks on them).
- **Tests:** made-up numbers (1,234 / 2,500) and a made-up key. No request to Torn or tornwar.com from any test.
- **Commits:** stage only this plan's paths. Every commit ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Torn's real sidebar, on desktop and on PDA's mobile layout.** The reader takes the count from `#barChain`'s whole text and the clock from `bar-timeleft`, or else the first element holding only a clock, but nothing here can render Torn's own pages. If a layout has no `#barChain`, the bar is up there only where the war overlay runs. The owner's check during a chain covers it.
2. **A sidebar clock that counts a cooldown down** (if Torn's does). The check covers it, except when the API's answer is up to about 30 s stale right after a chain breaks: a stale "live" answer then puts the bar up for a chain that just ended. In a cooldown the clock only falls, so only the check's 60 s life brings a new check. A cooldown shorter than about the threshold plus the API's cache (about 90 s: a chain that breaks at about 15 hits or fewer) can show a false CHAIN DYING for the whole of it.
3. **FactionOps' own pages.** While it is up, the bar sits over the top-centre spot of FactionOps' call toasts. Clicks pass through to them.
4. **The cost of running on every page.** About 770 KB parses on every Torn page load, phones included. Off FactionOps' pages the script stops after CONFIG and one 1-s interval. PDA and the warboard app pick up the new `@match` when they update the script.
5. **Several Torn tabs.** Each focused tab, and each PDA tab, runs its own bar and makes its own check: one Torn API call per tab per dying chain.

## Paths and commands

- `W=/opt/warboard/.superpowers/sdd/2026-10-27-factionops-chain-bar` is this plan's git-ignored workspace. `WT=$W/wt` is the worktree, on branch `factionops-chain-bar`, with `server/node_modules` symlinked to main's.
- **Edits:** each "Replace" block's text occurs in its file exactly once, and the "With" block takes its place. Neither block holds the newline that ends its last line. `$W/apply.py` applies one pair by the blocks' fence line numbers in the task's brief: `python3 -I "$W/apply.py" BRIEF FILE OLD_FENCE NEW_FENCE "$W/block.py"`.
- **The related set** runs every server test that reads FactionOps against the worktree's copy:
  - copies of the tests that read main's absolute path, rewritten to the worktree, in a scratch directory that is removed afterwards;
  - plus the ones that already read relative to themselves.

## Setup

- [ ] **Step 1: Commit this plan on main, then make the worktree:**

```bash
uptime; cd /opt/warboard && git add -- docs/superpowers/plans/2026-10-27-factionops-chain-bar.md && git commit -q -m "plan: FactionOps chain bar on every page" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- docs/superpowers/plans/2026-10-27-factionops-chain-bar.md && W=/opt/warboard/.superpowers/sdd/2026-10-27-factionops-chain-bar && mkdir -p "$W" && git worktree add -q "$W/wt" -b factionops-chain-bar && ln -s /opt/warboard/server/node_modules "$W/wt/server/node_modules" && git -C "$W/wt" status --short && git -C "$W/wt" log --format='%h %s' -1 | cat
```

Expected: the load under 12, `?? server/node_modules`, then the plan's commit.

- [ ] **Step 2: Helpers and sweeps.** Copy them from the Gym Coach chain-bar workspace, the scripts that plan used:

```bash
W=/opt/warboard/.superpowers/sdd/2026-10-27-factionops-chain-bar; GW=/opt/warboard/.superpowers/sdd/2026-10-27-gym-coach-chain-bar; cp "$GW/apply.py" "$GW/block.py" "$GW/sweep-env.mjs" "$GW/sweep-names.mjs" "$W/" && ls "$W"
```

Expected: `apply.py block.py plan-path progress.md sweep-env.mjs sweep-names.mjs task-1-brief.md wt` (the brief and ledger come from `task-start`, if it ran first) or the four copied files beside `wt`.

- [ ] **Step 3: Withdraw the Gym Coach chain-bar plan.** Ledger it, keep its ledger and logs in the scratchpad, then remove its worktree (`--force`: its only untracked file is the git-ignored built harness), its branch and its workspace:

```bash
GW=/opt/warboard/.superpowers/sdd/2026-10-27-gym-coach-chain-bar; S="${SCRATCHPAD:?set SCRATCHPAD to the scratchpad directory}/gym-coach-chain-bar-withdrawn"; git -C "$GW/wt" status --short --ignored; echo "Final: Ruling: plan withdrawn 2026-10-27 11:37 EDT: the owner moved the chain bar to FactionOps ('the chain bar should be factionops not gym coach'); branch gym-coach-chain-bar (7f0af07f, never released) deleted, its code carried into docs/superpowers/plans/2026-10-27-factionops-chain-bar.md — cost if wrong: none; the code is in this plan's text and in the FactionOps plan." >> "$GW/progress.md"; mkdir -p "$S" && cp "$GW/progress.md" "$GW"/*.log "$S/" && cd /opt/warboard && git worktree remove --force "$GW/wt" && git branch -D gym-coach-chain-bar && rm -r /opt/warboard/.superpowers/sdd/2026-10-27-gym-coach-chain-bar && git worktree list | command grep -c gym-coach-chain-bar
```

Expected: `!! tests/gym-coach/harness/gym-coach-beta.user.js` and nothing else from `status`. Then `Deleted branch gym-coach-chain-bar (was 7f0af07f).` and `0`.

- [ ] **Step 4: Baseline.** The related set on 5.6.20, without the new test:

```bash
uptime; W=/opt/warboard/.superpowers/sdd/2026-10-27-factionops-chain-bar; WT=$W/wt; R=$WT/server/wtcopy; mkdir "$R" && for t in factionops-activate-pill factionops-auth-refusal factionops-call-drops factionops-chain-bonus factionops-chat-ids factionops-hide-abroad factionops-life-percent factionops-transport-chip push-support-message; do sed "s#/opt/warboard/server/public/scripts/#$WT/server/public/scripts/#g" "$WT/server/$t.test.mjs" > "$R/$t.test.mjs"; done; cd "$WT/server" && node --test wtcopy/*.test.mjs factionops-filters.test.mjs menu-labels.test.mjs > "$W/related-base.log" 2>&1; rm -r /opt/warboard/.superpowers/sdd/2026-10-27-factionops-chain-bar/wt/server/wtcopy; command grep -E "^# (tests|pass|fail) " "$W/related-base.log" | paste -sd" " -; git -C "$WT" status --short
```

Expected: `# fail 0`, with the test count ledgered (`Setup: Ruling:`) as the gate Task 1's related set must match plus the new file's 11. Then `?? server/node_modules` only.

---

### Task 1: The chain bar

**Files:**
- Modify: `server/public/scripts/factionops.user.js` (the version, the header, SECTION 1A with the gate, and one assignment in `startChainTimer`'s tick)
- Modify: `server/public/scripts/factionops.meta.js` (regenerated from the header)
- Create: `server/factionops-chain-bar.test.mjs` and `tests/factionops/chainbar.e2e.test.mjs`

**Interfaces:**
- Consumes: `CONFIG` (`CHAIN_ALERT`, `CHAIN_ALERT_THRESHOLD`, `API_KEY`), `IS_PDA` and `httpRequest(opts)` (a hoisted function declaration in SECTION 1B), all as they are.
- Produces:
  - `isFactionOpsPage(href)` → boolean;
  - `readChainFromDom(doc)` → `{ count, left }` or null;
  - `chainCooldownFrom(chain, now)` → `{ count, until }` or null;
  - `chainNag(now, reading, cd, threshold)` → `{ count, left }` or null;
  - `chainBarStep(now, reading, check, threshold)` → `{ show, start }`;
  - `chainBarText(live)` → string;
  - `chainBarReading(now, overlay, readSidebar)` → the reading the bar follows, or null;
  - `renderChainBar(live)`, `chainBarTick()`, `startChainBarCheck(now, reading)` and `startChainBar()`;
  - `let chainBarCheck` (`{ count, left, at, done, cd }` or null);
  - `let chainBarFromOverlay` (`{ ok, count, left, at, fromOverlay: true }` or null), set by the war overlay's chain tick on every frame.

- [ ] **Step 1: The unit tests.** Write `server/factionops-chain-bar.test.mjs`:

```js
// FactionOps' chain bar (5.6.21): the pure parts lifted out of the script and
// driven with made-up chains, and the wiring checked in the text -- the
// header, the version, and the gate that stops the script off its own pages.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// FO_SRC points the checks at another copy (the mutants use it).
const SRC = readFileSync(process.env.FO_SRC || new URL('./public/scripts/factionops.user.js', import.meta.url), 'utf8');
const META = readFileSync(new URL('./public/scripts/factionops.meta.js', import.meta.url), 'utf8');

// The text of `function name(...) {...}`, by brace count.
function fn(name) {
  const i = SRC.indexOf('function ' + name + '(');
  assert.ok(i > 0, name + ' not found');
  let d = 0;
  for (let j = SRC.indexOf('{', i); j < SRC.length; j++) {
    if (SRC[j] === '{') d++;
    else if (SRC[j] === '}' && --d === 0) return SRC.slice(i, j + 1);
  }
  throw new Error(name + ' never closes');
}
function konst(name) {
  const m = SRC.match(new RegExp('const ' + name + ' = ([^;]+);'));
  assert.ok(m, name + ' not found');
  return 'const ' + name + ' = ' + m[1] + ';\n';
}
let lib = null;
function L() {
  if (lib) return lib;
  const names = ['isFactionOpsPage', 'readChainFromDom', 'chainCooldownFrom', 'chainNag', 'chainBarStep', 'chainBarText', 'chainBarReading'];
  lib = new Function(
    ['CHAIN_BAR_MIN_HITS', 'CHAIN_BAR_CHECK_WAIT_MS', 'CHAIN_BAR_CHECK_TTL_MS', 'FO_PAGE_PATTERNS'].map(konst).join('')
    + names.map(fn).join('\n') + '\nreturn { ' + names.join(', ') + ' };')();
  return lib;
}

// A sidebar with one chain bar under the given id. Its text runs the label,
// the count and the clock together, as textContent gives them. The clock sits
// in an element of class `cls`; a null clock means the bar has none.
function doc(count, time, id = 'barChain', cls = 'bar-timeleft___x') {
  const leaf = (t) => ({ children: [], textContent: t });
  const clock = time == null ? null : leaf(time);
  const bar = {
    textContent: 'Chain:' + count + (time == null ? '' : time),
    querySelector: (s) => (s.includes('bar-timeleft') && cls.includes('bar-timeleft') ? clock : null),
    querySelectorAll: (s) => (s === '*' ? [leaf('Chain:'), leaf(count)].concat(clock ? [clock] : []) : []),
  };
  return {
    getElementById: (x) => (x === id ? bar : null),
    querySelector: (s) => (s === '[id^="barChain"]' && id.startsWith('barChain') ? bar : null),
  };
}

test("FactionOps runs whole on its old @match list's pages, and only the bar elsewhere", () => {
  const head = SRC.slice(0, SRC.indexOf('// ==/UserScript=='));
  const old = [...head.matchAll(/^\/\/ @match\s+(\S+)$/gm)].map((m) => m[1]).filter((u) => !u.endsWith('torn.com/*'));
  assert.equal(old.length, 9);
  for (const u of old) assert.equal(L().isFactionOpsPage(u.replace(/\*$/, 'x')), true, u);
  for (const u of ['https://www.torn.com/gym.php', 'https://www.torn.com/index.php', 'https://www.torn.com/item.php',
    'https://www.torn.com/page.php?sid=crimes', 'https://www.torn.com/loader.php?sid=racing'])
    assert.equal(L().isFactionOpsPage(u), false, u);
});

test('it reads the sidebar: the count wherever Torn puts it, the clock as parseChainFromDOM reads it', () => {
  assert.deepEqual(L().readChainFromDom(doc('1,234/2,500', '00:42')), { count: 1234, left: 42 });
  assert.deepEqual(L().readChainFromDom(doc(' 1,234 / 100,000', '1:02:03')), { count: 1234, left: 3723 });
  assert.deepEqual(L().readChainFromDom(doc('12/25', '4:21', 'barChain-x')), { count: 12, left: 261 });
  // The clock ahead of the count, run together: its digits are not the count's.
  const ahead = doc('1,234/2,500', '00:42');
  ahead.getElementById('barChain').textContent = 'Chain:00:421,234/2,500';
  assert.deepEqual(L().readChainFromDom(ahead), { count: 1234, left: 42 });
  // A clock under some other class: the element that holds nothing but a clock.
  assert.deepEqual(L().readChainFromDom(doc('1,234/2,500', '00:42', 'barChain', 'timer___x')), { count: 1234, left: 42 });
  assert.equal(L().readChainFromDom(doc('1,234/2,500', '--:--', 'barChain', 'timer___x')), null);
  assert.equal(L().readChainFromDom(doc('1,234/2,500', '00:42', 'nothing')), null);
  assert.equal(L().readChainFromDom(doc('1,234/2,500', null)), null);
  assert.equal(L().readChainFromDom(doc('1,234/2,500', '--:--')), null);
  assert.equal(L().readChainFromDom(doc('1,234/2,500', '')), null);
  assert.equal(L().readChainFromDom(doc('', '00:42')), null);
});

test('up from 10 hits with the threshold or less on the clock, and more than 0', () => {
  const r = (count, left) => ({ count, left });
  assert.deepEqual(L().chainNag(0, r(1234, 42), null, 60), { count: 1234, left: 42 });
  assert.deepEqual(L().chainNag(0, r(10, 60), null, 60), { count: 10, left: 60 });
  assert.equal(L().chainNag(0, r(1234, 61), null, 60), null);
  assert.equal(L().chainNag(0, r(1234, 0), null, 60), null);
  assert.equal(L().chainNag(0, r(9, 42), null, 60), null);
  assert.equal(L().chainNag(0, null, null, 60), null);
  assert.deepEqual(L().chainNag(0, r(1234, 85), null, 90), { count: 1234, left: 85 });
});

test('a chain in its cooldown keeps it down until the cooldown ends or the count grows', () => {
  const cd = L().chainCooldownFrom({ current: 1234, cooldown: 7404 }, 1000);
  assert.deepEqual(cd, { count: 1234, until: 1000 + 7404 * 1000 });
  assert.equal(L().chainCooldownFrom({ current: 1234, cooldown: 0 }, 1000), null);
  assert.equal(L().chainCooldownFrom(null, 1000), null);
  const r = { count: 1234, left: 42 };
  assert.equal(L().chainNag(2000, r, cd, 60), null);
  assert.deepEqual(L().chainNag(cd.until, r, cd, 60), r);
  assert.deepEqual(L().chainNag(2000, { count: 1235, left: 42 }, cd, 60), { count: 1235, left: 42 });
});

test("one check before it first comes up; the overlay's chain needs none", () => {
  const S = L().chainBarStep;
  assert.deepEqual(S(0, { count: 1234, left: 42 }, null, 60), { show: null, start: true });
  const pending = { count: 1234, left: 42, at: 0, done: false, cd: null };
  assert.deepEqual(S(4999, { count: 1234, left: 38 }, pending, 60), { show: null, start: false });
  assert.deepEqual(S(5000, { count: 1234, left: 37 }, pending, 60), { show: { count: 1234, left: 37 }, start: false });
  const live = { ...pending, done: true };
  assert.deepEqual(S(1000, { count: 1234, left: 41 }, live, 60), { show: { count: 1234, left: 41 }, start: false });
  const cooling = { ...pending, done: true, cd: { count: 1234, until: 9e12 } };
  assert.deepEqual(S(1000, { count: 1234, left: 42 }, cooling, 60), { show: null, start: false });
  // A new count, a clock that went back up, or a minute on: check again.
  assert.deepEqual(S(1000, { count: 1240, left: 42 }, live, 60), { show: null, start: true });
  assert.deepEqual(S(1000, { count: 1234, left: 59 }, live, 60), { show: null, start: true });
  assert.deepEqual(S(60000, { count: 1234, left: 2 }, live, 60), { show: null, start: true });
  assert.deepEqual(S(0, { count: 1234, left: 42, fromOverlay: true }, null, 60), { show: { count: 1234, left: 42 }, start: false });
  assert.deepEqual(S(0, { count: 1234, left: 75 }, null, 60), { show: null, start: false });
});

test('the text: the count with commas, the clock as m:ss', () => {
  assert.equal(L().chainBarText({ count: 1234, left: 42 }), 'CHAIN DYING \u00B7 1,234 hits \u00B7 0:42 left');
  assert.equal(L().chainBarText({ count: 12, left: 75 }), 'CHAIN DYING \u00B7 12 hits \u00B7 1:15 left');
});

test('5.6.21 in both places, the meta file is the header, and every page joins the old list', () => {
  const end = '// ==/UserScript==';
  const head = SRC.slice(0, SRC.indexOf(end) + end.length) + '\n';
  assert.equal(META, head);
  assert.match(head, /^\/\/ @version\s+5\.6\.21$/m);
  assert.match(SRC, /const SCRIPT_VERSION = '5\.6\.21';/);
  const matches = [...head.matchAll(/^\/\/ @match\s+(\S+)$/gm)].map((m) => m[1]);
  assert.equal(matches.length, 11);
  assert.deepEqual(matches.slice(-2), ['https://www.torn.com/*', 'https://torn.com/*']);
});

test('the gate: the bar starts, then the script stops off its own pages, above everything else', () => {
  const g = '    if (!isFactionOpsPage(location.href)) return;';
  const gate = SRC.indexOf(g);
  assert.ok(gate > 0, 'no gate');
  assert.equal(SRC.indexOf(g, gate + 1), -1, 'two gates');
  const start = SRC.indexOf('\n    startChainBar();\n');
  assert.ok(start > 0 && start < gate, 'the bar does not start above the gate');
  assert.ok(gate > SRC.indexOf('function setConfig('), 'the gate is above CONFIG');
  assert.ok(gate < SRC.indexOf('SECTION 1B: PDA-COMPATIBLE HTTP WRAPPER'), 'the gate is below the HTTP wrapper');
});

test("where the war overlay's chain tick runs, the bar follows it and its checks; elsewhere, the sidebar", () => {
  const side = { count: 1234, left: 42 };
  const read = () => side;
  const o = (ok, at) => ({ ok, count: 1240, left: 30, at, fromOverlay: true });
  assert.equal(L().chainBarReading(5000, o(true, 4000), read).count, 1240);
  assert.equal(L().chainBarReading(5000, o(false, 4000), read), null);
  assert.deepEqual(L().chainBarReading(5000, o(true, 3000), read), side);
  assert.deepEqual(L().chainBarReading(5000, null, read), side);
});

test("the war overlay's chain tick hands the bar its chain, with the alerts' own checks", () => {
  const tick = fn('startChainTimer');
  const i = tick.indexOf('const _chainFocusOK');
  const j = tick.indexOf('chainBarFromOverlay = {');
  const k = tick.indexOf('ok: chainDataFresh && chainTimeoutPlausible && state.chain.timeout > 0,');
  assert.ok(i > 0 && j > i && k > j, 'the overlay does not hand the bar its chain in the tick');
});

test('no raw curly quotes: Torn PDA straightens them and the file stops parsing', () => {
  assert.doesNotMatch(SRC, /[\u2018\u2019\u201C\u201D]/);
});
```

- [ ] **Step 2: The browser tests.** Write `tests/factionops/chainbar.e2e.test.mjs`:

```js
// The chain bar in a browser, on a Torn page that is not one of FactionOps'
// own: one chain check, then up and flashing while the sidebar's chain has
// the threshold or less left; down for a chain in its cooldown, without focus
// outside Torn PDA, under 10 hits or with chain alerts off; and nothing else
// of FactionOps runs there. Numbers and the key are made up.
import fs from "fs";
import assert from "assert";
const { chromium } = await import("/root/.hermes/hermes-agent/node_modules/playwright-core/index.mjs");
const script = fs.readFileSync(new URL("../../server/public/scripts/factionops.user.js", import.meta.url), "utf8");
const b = await chromium.launch({ args: ["--no-sandbox"] });
const CHECK = "https://api.torn.com/faction/?selections=chain&";

// What a userscript manager would give the script, with GM storage and the
// Torn API stubbed: every request is logged, and only the chain check is
// answered (cfg.chain, or a live chain) or failed (cfg.fail).
const preamble = (cfg) => `(() => {
  const cfg = ${JSON.stringify(cfg)};
  const store = Object.assign({ factionops_apikey: "testkey1234" }, cfg.store || {});
  const answer = (url) => url.startsWith(${JSON.stringify(CHECK)})
    ? JSON.stringify({ chain: cfg.chain || { current: 1234, max: 2500, timeout: 42, modifier: 1, cooldown: 0 } })
    : null;
  const log = (url) => window.__reqs.push(String(url).replace(/key=[^&]*/, "key=K"));
  window.__reqs = [];
  window.unsafeWindow = window;
  window.GM_getValue = (k, d) => (k in store ? store[k] : d);
  window.GM_setValue = (k, v) => { store[k] = v; };
  window.GM_addStyle = (css) => { const s = document.createElement("style"); s.textContent = css; document.head.appendChild(s); return s; };
  window.GM_setClipboard = () => {};
  window.GM_registerMenuCommand = () => {};
  window.GM_xmlhttpRequest = (o) => {
    log(o.url);
    setTimeout(() => {
      if (cfg.fail) return o.onerror && o.onerror({});
      const body = answer(o.url);
      if (body) o.onload({ status: 200, responseText: body });
    }, 100);
  };
  if (cfg.pda) {
    window.flutter_inappwebview = { callHandler: () => Promise.resolve() };
    window.PDA_httpGet = (url) => { log(url); return Promise.resolve(answer(url) || "{}"); };
  }
})();`;

// Torn's sidebar chain bar, the way the script looks it up.
const page = ({ time = "00:42", count = "1,234/2,500", gcBanner = 0 }) => `<!doctype html><html><head><meta charset="utf-8"><title>gym</title></head><body>
${gcBanner ? '<div id="gcb-fullbar-nag" style="position:fixed;top:' + gcBanner + 'px;left:50%;transform:translateX(-50%);height:36px;width:300px">E full</div>' : ""}
<div id="sidebarroot"><a id="barChain" class="bar___x chain___x"><div class="bar-stats___x"><p class="bar-name___x">Chain:</p><p class="bar-value___x">${count}</p></div><p class="bar-timeleft___x">${time}</p></a></div>
<script src="/fo-preamble.js"></script><script src="/factionops.user.js"></script></body></html>`;

async function open(opts = {}) {
  const url = "https://www.torn.com/gym.php";
  const ctx = await b.newContext({ viewport: { width: 393, height: 800 } });
  const p = await ctx.newPage();
  const seen = [];
  await p.route("**/*", (r) => {
    const u = r.request().url();
    if (u.endsWith("/fo-preamble.js")) return r.fulfill({ contentType: "application/javascript", body: preamble(opts.cfg || {}) });
    if (u.endsWith("/factionops.user.js")) return r.fulfill({ contentType: "application/javascript", body: script });
    if (u === url) return r.fulfill({ contentType: "text/html", body: page(opts) });
    if (!u.endsWith("/favicon.ico")) seen.push(u);
    return r.fulfill({ status: 204, body: "" });
  });
  await p.goto(url, { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(2600);
  return { ctx, p, seen };
}
const bar = (p) => p.evaluate(() => {
  const e = document.getElementById("fo-chain-bar");
  if (!e) return null;
  const cs = getComputedStyle(e);
  return { text: e.textContent, anim: cs.animationName, pe: cs.pointerEvents, top: parseInt(e.style.top, 10) };
});
const setClock = (p, s) => p.evaluate((s) => { document.querySelector('[class*="bar-timeleft"]').textContent = s; }, s);
const noFocus = (p) => p.evaluate(() => { document.hasFocus = () => false; });
const checks = (p) => p.evaluate((c) => window.__reqs.filter((u) => u.startsWith(c)).length, CHECK);
const reqs = (p) => p.evaluate(() => window.__reqs.slice());
const foNodes = (p) => p.evaluate(() => [...document.querySelectorAll('[id^="fo-"],[id^="wb-"],[class^="fo-"],[class^="wb-"]')].map((e) => e.id || e.className));

let pass = 0, fail = 0;
const t = async (n, f) => { try { await f(); pass++; console.log("ok   " + n); } catch (e) { fail++; console.log("FAIL " + n + " :: " + e.message); } };

await t("off FactionOps' pages: one chain check, then the bar is up and flashing, and nothing else runs", async () => {
  const { ctx, p, seen } = await open();
  const got = await bar(p), r = await reqs(p), nodes = await foNodes(p);
  await ctx.close();
  assert.ok(got, "no bar");
  assert.strictEqual(got.text, "CHAIN DYING \u00B7 1,234 hits \u00B7 0:42 left");
  assert.strictEqual(got.anim, "fo-chain-bar-flash");
  assert.strictEqual(got.pe, "none");
  assert.deepStrictEqual(r, [CHECK + "key=K"]);
  assert.deepStrictEqual(nodes, ["fo-style-chain-bar", "fo-chain-bar"]);
  assert.deepStrictEqual(seen, []);
});

await t("it follows the sidebar: down at 4:59, up again at 0:30, with no second check", async () => {
  const { ctx, p } = await open();
  await setClock(p, "04:59");
  await p.waitForTimeout(1500);
  const after = await bar(p);
  await setClock(p, "00:30");
  await p.waitForTimeout(1500);
  const again = await bar(p), n = await checks(p);
  await ctx.close();
  assert.strictEqual(after, null, "still up at 4:59");
  assert.ok(again && again.text.endsWith("0:30 left"), JSON.stringify(again));
  assert.strictEqual(n, 1);
});

await t("a chain in its cooldown keeps it down, with no more checks", async () => {
  const { ctx, p } = await open({ cfg: { chain: { current: 1234, max: 2500, timeout: 0, modifier: 1, cooldown: 7404 } } });
  await p.waitForTimeout(2500);
  const got = await bar(p), n = await checks(p);
  await ctx.close();
  assert.strictEqual(got, null);
  assert.strictEqual(n, 1);
});

await t("a check that fails lets it up anyway", async () => {
  const { ctx, p } = await open({ cfg: { fail: true } });
  const got = await bar(p);
  await ctx.close();
  assert.ok(got && got.text.endsWith("0:42 left"), JSON.stringify(got));
});

await t("outside Torn PDA it is down while the page does not have focus", async () => {
  const { ctx, p } = await open();
  await noFocus(p);
  await p.waitForTimeout(1500);
  const got = await bar(p);
  await ctx.close();
  assert.strictEqual(got, null);
});

await t("in Torn PDA it stays up without focus, checked through PDA's own request", async () => {
  const { ctx, p } = await open({ cfg: { pda: true } });
  await noFocus(p);
  await p.waitForTimeout(1500);
  const got = await bar(p), n = await checks(p);
  await ctx.close();
  assert.ok(got, "PDA lost the bar");
  assert.strictEqual(n, 1);
});

await t("under 10 hits, or chain alerts off (PDA's string too), keeps it down", async () => {
  for (const opts of [{ count: "9/10" }, { cfg: { store: { factionops_chain_alert: false } } }, { cfg: { store: { factionops_chain_alert: "false" } } }]) {
    const { ctx, p } = await open(opts);
    const got = await bar(p);
    await ctx.close();
    assert.strictEqual(got, null, JSON.stringify(opts));
  }
});

await t("the chain-alert threshold sets when it comes up", async () => {
  const { ctx, p } = await open({ time: "01:15", cfg: { store: { factionops_chain_alert_threshold: 90 } } });
  const got = await bar(p);
  await ctx.close();
  assert.ok(got && got.text.endsWith("1:15 left"), JSON.stringify(got));
});

await t("below Gym Coach's full-bar banner while that holds the top spot, and at the top when it sits lower", async () => {
  const one = await open({ gcBanner: 10 });
  const high = await bar(one.p);
  await one.ctx.close();
  const two = await open({ gcBanner: 96 });
  const low = await bar(two.p);
  await two.ctx.close();
  assert.ok(high && low, "no bar");
  assert.strictEqual(high.top, 52);
  assert.strictEqual(low.top, 10);
});

await b.close();
console.log(`${pass} passed, ${fail} failed`);
process.exitCode = fail ? 1 : 0;
```

- [ ] **Step 3: Run both, and watch them fail on 5.6.20:**

```bash
W=/opt/warboard/.superpowers/sdd/2026-10-27-factionops-chain-bar; cd "$W/wt/server" && node --test factionops-chain-bar.test.mjs > "$W/red-unit.log" 2>&1; command grep -E "^# (tests|pass|fail) " "$W/red-unit.log" | paste -sd" " -; cd "$W/wt/tests/factionops" && timeout 300 node chainbar.e2e.test.mjs > "$W/red-e2e.log" 2>&1; tail -n 1 "$W/red-e2e.log"
```

Expected:
- **Unit:** `# tests 11 # pass 1 # fail 10`. Only the curly-quote check passes; the rest fail on `not found`, `no gate`, the version or the overlay's hook.
- **Browser:** `2 passed, 7 failed`. On 5.6.20 there is no chain bar. The two tests that pin when it must stay down (no focus outside PDA; under 10 hits or alerts off) pass for that reason. The cooldown test fails on its one check.

- [ ] **Step 4: The script.** Edits to `server/public/scripts/factionops.user.js`.

Replace:

```js
// @version      5.6.20
```

With:

```js
// @version      5.6.21
```

Replace:

```js
    const SCRIPT_VERSION = '5.6.20';
```

With:

```js
    const SCRIPT_VERSION = '5.6.21';
```

Replace:

```js
// @match        https://www.torn.com/war.php*
```

With:

```js
// @match        https://www.torn.com/war.php*
// @match        https://www.torn.com/*
// @match        https://torn.com/*
```

Replace:

```js
    // =========================================================================
    // SECTION 1B: PDA-COMPATIBLE HTTP WRAPPER
```

With:

```js
    // =========================================================================
    // SECTION 1A: CHAIN BAR (every Torn page)
    // =========================================================================
    // A red and white flashing bar at the top of every Torn page while the
    // faction's chain has 10 or more hits and the chain-alert threshold (1:00
    // unless changed in settings) or less left, so whoever is on Torn goes and
    // hits someone. Asked for 2026-10-27, the day after a chain died with no
    // one watching it.
    //
    // FactionOps loads on every Torn page for this alone. Off its own pages
    // (isFactionOpsPage: the @match list it had before 5.6.21) the script
    // stops right after starting the bar: no overlay, no server connection, no
    // request interception. The private build widened @match the same way in
    // 5.4.2, for its chat dock.
    //
    // Where the war overlay runs, the bar follows the overlay's chain (the
    // direct poll, with the chain alerts' own freshness and plausibility
    // checks), so the bar and the alerts come up together. Anywhere else it
    // reads Torn's own sidebar chain bar, once a second. Torn's rules forbid
    // drawing attention with anything read off a page you are not looking at, so the bar is only up while the page has
    // focus; Torn PDA reports no focus while plainly in front of you, so it is
    // exempt. It follows the chain-alert switch and threshold, and makes no
    // sound: the alerts in startChainTimer already do, on FactionOps' pages.
    const CHAIN_BAR_ID = 'fo-chain-bar';
    // Not "fo-chain...": Gym Coach drops its full-bar banner to 96 px when it
    // finds an element whose id starts that way, and the style element stays
    // on the page after the bar comes down.
    const CHAIN_BAR_STYLE_ID = 'fo-style-chain-bar';
    // Under 10 hits nothing is at stake yet, and every lone attack starts a
    // 1-hit chain: the chain alerts' own floor.
    const CHAIN_BAR_MIN_HITS = 10;
    // How long the bar waits for its cooldown check before it shows anyway.
    const CHAIN_BAR_CHECK_WAIT_MS = 5000;
    // How long one check stands for the same count.
    const CHAIN_BAR_CHECK_TTL_MS = 60000;

    // The pages in FactionOps' @match list before 5.6.21: the header's first
    // nine @match lines. Every other page gets the chain bar only.
    const FO_PAGE_PATTERNS = [
        /^https:\/\/www\.torn\.com\/factions\.php\?step=(?:your|profile)/,
        /^https:\/\/(?:www\.)?torn\.com\/(?:loader|page)\.php\?sid=attack/,
        /^https:\/\/(?:www\.)?torn\.com\/profiles\.php\?XID=/,
        /^https:\/\/www\.torn\.com\/war\.php/,
    ];

    function isFactionOpsPage(href) {
        const s = String(href || '');
        return FO_PAGE_PATTERNS.some((re) => re.test(s));
    }

    // Torn's sidebar chain bar: "Chain: 1,234/2,500" beside "00:42", or
    // "1:02:03" for an hour or more. FactionOps has not read Torn's markup
    // since 5.1.43, so neither number hangs on one class name. The clock is
    // the bar's bar-timeleft element, as parseChainFromDOM read it, or else
    // the first element in the bar that holds nothing but a clock. The count
    // is the first "n/m" in the rest of the bar's text, the way Gym Coach
    // reads the energy bar. { count, left } in seconds, or null when the page
    // has no chain bar or the bar shows no clock.
    function readChainFromDom(doc) {
        const bar = doc.getElementById('barChain') || doc.querySelector('[id^="barChain"]');
        if (!bar) return null;
        const time = bar.querySelector('[class*="bar-timeleft"]')
            || Array.from(bar.querySelectorAll('*')).find((e) => !e.children.length
                && /^\d{1,2}:\d{2}(?::\d{2})?$/.test(String(e.textContent || '').trim()));
        if (!time) return null;
        const clock = String(time.textContent || '');
        const n = String(bar.textContent || '').replace(clock, ' ').match(/(\d[\d,.\s]*)\s*\/\s*\d/);
        const parts = clock.trim().split(':').map(Number);
        if (!n || (parts.length !== 2 && parts.length !== 3)) return null;
        if (!parts.every((p) => Number.isInteger(p) && p >= 0)) return null;
        const left = parts.length === 3
            ? parts[0] * 3600 + parts[1] * 60 + parts[2]
            : parts[0] * 60 + parts[1];
        return { count: Number(n[1].replace(/[^\d]/g, '')), left };
    }

    // A chain that has ended keeps its count through its cooldown (about six
    // seconds a hit), and the sidebar's clock may count that cooldown down.
    // The API's `cooldown` is the seconds left. Kept with the count it was
    // read at, because a chain cannot grow in its cooldown: a higher count is
    // a live chain, whatever the check said.
    function chainCooldownFrom(chain, now) {
        const cd = Number(chain && chain.cooldown) || 0;
        if (!(cd > 0)) return null;
        return { count: Number(chain.current) || 0, until: now + cd * 1000 };
    }

    // The chain-alert threshold in seconds: 60 unless changed in settings.
    function chainBarThreshold() {
        const t = Number(CONFIG.CHAIN_ALERT_THRESHOLD);
        return t > 0 ? t : 60;
    }

    // Should the bar be up for this reading? Pure: { count, left } or null.
    // `cd` is chainCooldownFrom()'s answer, or null.
    function chainNag(now, reading, cd, threshold) {
        if (!reading || !(reading.count >= CHAIN_BAR_MIN_HITS)) return null;
        if (!(reading.left > 0 && reading.left <= threshold)) return null;
        if (cd && now < cd.until && reading.count <= cd.count) return null;
        return { count: reading.count, left: reading.left };
    }

    // One Torn API check per dying chain, before the bar first comes up,
    // because the sidebar may be counting a finished chain's cooldown down.
    // Pure. `check` is { count, left, at, done, cd } or null. Returns
    // { show, start }: `show` is the bar's reading or null, and `start` asks
    // for a new check. A check stands while the count is the same, the clock
    // has only run down since, and it is under a minute old. One that has not
    // answered in 5 s lets the bar up anyway: missing a dying chain is the
    // worse mistake. The overlay's own poll knows the cooldown already.
    function chainBarStep(now, reading, check, threshold) {
        const live = chainNag(now, reading, check && check.done ? check.cd : null, threshold);
        if (!live) return { show: null, start: false };
        if (reading.fromOverlay) return { show: live, start: false };
        const stands = !!check && check.count === live.count && live.left <= check.left + 1
            && now - check.at < CHAIN_BAR_CHECK_TTL_MS;
        if (!stands) return { show: null, start: true };
        if (check.done || now - check.at >= CHAIN_BAR_CHECK_WAIT_MS) return { show: live, start: false };
        return { show: null, start: false };
    }

    function chainBarText(live) {
        const m = Math.floor(live.left / 60);
        const s = live.left % 60;
        return 'CHAIN DYING \u00B7 ' + live.count.toLocaleString('en-US') + ' hits \u00B7 '
            + m + ':' + String(s).padStart(2, '0') + ' left';
    }

    // Which chain the bar follows. Where the war overlay's chain tick has run
    // in the last 2 s, the overlay's: the direct poll the chain alerts use,
    // null while the alerts' own checks fail, so the bar comes up with them.
    // Anywhere else, Torn's sidebar. Pure; readSidebar is only called when it
    // is needed.
    function chainBarReading(now, overlay, readSidebar) {
        if (overlay && now - overlay.at < 2000) return overlay.ok ? overlay : null;
        return readSidebar();
    }

    // The latest cooldown check (see chainBarStep), and the war overlay's
    // chain, which startChainTimer's tick keeps fresh where it runs.
    let chainBarCheck = null;
    let chainBarFromOverlay = null;

    function renderChainBar(live) {
        let el = document.getElementById(CHAIN_BAR_ID);
        if (!live) {
            if (el && el.parentNode) el.parentNode.removeChild(el);
            return;
        }
        if (!document.body) return;
        if (!document.getElementById(CHAIN_BAR_STYLE_ID)) {
            // A hard red/white blink once a second, and steady red for anyone
            // whose system asks for less motion. An animation outranks the
            // inline colours.
            const css = document.createElement('style');
            css.id = CHAIN_BAR_STYLE_ID;
            css.textContent =
                '@keyframes fo-chain-bar-flash{0%,49%{background:#d50000;color:#fff}50%,100%{background:#fff;color:#d50000}}' +
                '#' + CHAIN_BAR_ID + '{animation:fo-chain-bar-flash 1s infinite}' +
                '@media (prefers-reduced-motion:reduce){#' + CHAIN_BAR_ID + '{animation:none}}';
            (document.head || document.documentElement).appendChild(css);
        }
        const text = chainBarText(live);
        if (el && el.textContent === text) return;
        if (!el) {
            el = document.createElement('div');
            el.id = CHAIN_BAR_ID;
            // Clicks pass through: it is there to be seen, never to sit on a
            // button you need.
            el.style.cssText =
                'position:fixed;top:10px;left:50%;transform:translateX(-50%);' +
                'z-index:2147483647;pointer-events:none;' +
                'background:#d50000;color:#fff;font:800 14px/1.2 Arial,sans-serif;' +
                'padding:9px 16px;border-radius:7px;white-space:nowrap;' +
                'box-shadow:0 3px 14px rgba(0,0,0,.5);max-width:94vw;';
            document.body.appendChild(el);
        }
        // Below Gym Coach's full-bar banner while that banner holds the top
        // spot, so the two never sit on each other. (When this bar is up
        // first, the banner takes 96 px of its own accord.)
        const gc = document.getElementById('gcb-fullbar-nag');
        const r = gc ? gc.getBoundingClientRect() : null;
        el.style.top = (r && r.bottom > 0 && r.top < 50 ? Math.round(r.bottom) + 6 : 10) + 'px';
        el.textContent = text;
    }

    function startChainBarCheck(now, reading) {
        const check = { count: reading.count, left: reading.left, at: now, done: false, cd: null };
        chainBarCheck = check;
        const finish = (cd) => { check.cd = cd; check.done = true; };
        if (!CONFIG.API_KEY) return finish(null);
        try {
            httpRequest({
                method: 'GET',
                url: 'https://api.torn.com/faction/?selections=chain&key=' + encodeURIComponent(CONFIG.API_KEY),
                timeout: CHAIN_BAR_CHECK_WAIT_MS,
                onload(res) {
                    let data = null;
                    try { data = JSON.parse(res.responseText); } catch (_) {}
                    finish(data && !data.error && data.chain ? chainCooldownFrom(data.chain, Date.now()) : null);
                },
                onerror() { finish(null); },
                ontimeout() { finish(null); },
            });
        } catch (_) { finish(null); }
    }

    function chainBarTick() {
        const now = Date.now();
        // PDA's GM storage hands values back as strings, and "false" is truthy.
        const on = !!CONFIG.CHAIN_ALERT && String(CONFIG.CHAIN_ALERT) !== 'false';
        // The chain alerts' own focus check.
        const looking = IS_PDA || (typeof document.hasFocus === 'function' ? document.hasFocus() : !document.hidden);
        const reading = chainBarReading(now, chainBarFromOverlay, () => readChainFromDom(document));
        const step = on && looking ? chainBarStep(now, reading, chainBarCheck, chainBarThreshold()) : { show: null, start: false };
        if (step.start) startChainBarCheck(now, reading);
        renderChainBar(step.show);
    }

    function startChainBar() {
        // Not in Torn's frames: one bar, on the page itself.
        if (window.top !== window.self) return;
        setInterval(() => { try { chainBarTick(); } catch (_) {} }, 1000);
    }

    startChainBar();
    // Off FactionOps' own pages, the chain bar is all this script does.
    if (!isFactionOpsPage(location.href)) return;

    // =========================================================================
    // SECTION 1B: PDA-COMPATIBLE HTTP WRAPPER
```

Replace:

```js
            const _chainFocusOK = IS_PDA || (typeof document.hasFocus === 'function' ? document.hasFocus() : !document.hidden);
```

With:

```js
            const _chainFocusOK = IS_PDA || (typeof document.hasFocus === 'function' ? document.hasFocus() : !document.hidden);
            // The chain bar follows this chain while the overlay runs, with the
            // same freshness and plausibility checks as the alerts below, so
            // the two come up together. See SECTION 1A.
            chainBarFromOverlay = {
                ok: chainDataFresh && chainTimeoutPlausible && state.chain.timeout > 0,
                count: state.chain.current, left: Math.ceil(state.chain.timeout), at: Date.now(), fromOverlay: true,
            };
```

- [ ] **Step 5: The meta file, then check the script:**

```bash
W=/opt/warboard/.superpowers/sdd/2026-10-27-factionops-chain-bar; cd "$W/wt/server/public/scripts" && sed -n '1,/==\/UserScript==/p' factionops.user.js > factionops.meta.js && node --check factionops.user.js && echo "syntax ok"; command grep -c -P '[\x{2018}\x{2019}\x{201C}\x{201D}]' factionops.user.js; command grep -m1 '@version' factionops.meta.js; command grep -m1 'const SCRIPT_VERSION' factionops.user.js; command grep -c '^// @match' factionops.meta.js; git -C "$W/wt" diff --stat | cat
```

Expected: `syntax ok`, `0`, `// @version      5.6.21`, `const SCRIPT_VERSION = '5.6.21';` (indented), `11`, then the two script files changed.

- [ ] **Step 6: Run both again:**

```bash
W=/opt/warboard/.superpowers/sdd/2026-10-27-factionops-chain-bar; cd "$W/wt/server" && node --test factionops-chain-bar.test.mjs > "$W/green-unit.log" 2>&1; command grep -E "^# (tests|pass|fail) " "$W/green-unit.log" | paste -sd" " -; cd "$W/wt/tests/factionops" && timeout 300 node chainbar.e2e.test.mjs > "$W/green-e2e.log" 2>&1; tail -n 1 "$W/green-e2e.log"
```

Expected: `# tests 11 # pass 11 # fail 0`, then `9 passed, 0 failed`. If the browser's first test fails only on `seen` or `nodes`, something past the gate ran: look at which, and do not loosen the test.

- [ ] **Step 7: Mutants.** Each must turn the unit tests red. Write `$W/mutants.mjs`, then run it from the worktree's server directory:

```js
// Each mutant must turn the unit tests red. Run from the worktree's server
// directory: node <W>/mutants.mjs <W>
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
const W = process.argv[2];
const SRC = fs.readFileSync('public/scripts/factionops.user.js', 'utf8');
const mutants = [
  ['the threshold itself', 'reading.left > 0 && reading.left <= threshold', 'reading.left > 0 && reading.left < threshold'],
  ['the 10-hit floor', 'const CHAIN_BAR_MIN_HITS = 10;', 'const CHAIN_BAR_MIN_HITS = 1;'],
  ['the cooldown guard', '        if (cd && now < cd.until && reading.count <= cd.count) return null;\n', ''],
  ['the overlay needs no check', '        if (reading.fromOverlay) return { show: live, start: false };\n', ''],
  ['a clock that went back up', ' && live.left <= check.left + 1', ''],
  ['the wait for the check', 'check.done || now - check.at >= CHAIN_BAR_CHECK_WAIT_MS', 'check.done'],
  ["war.php is FactionOps' own", '        /^https:\\/\\/www\\.torn\\.com\\/war\\.php/,\n', ''],
  ['an hour on the clock', '? parts[0] * 3600 + parts[1] * 60 + parts[2]', '? parts[0] * 60 + parts[1]'],
  ['the clock out of the count', ".replace(clock, ' ')", ''],
  ['the clock without its class', "/^\\d{1,2}:\\d{2}(?::\\d{2})?$/.test(", "/^$/.test("],
  ['the gate', '    if (!isFactionOpsPage(location.href)) return;\n', ''],
  ["the overlay hands over its checks", 'ok: chainDataFresh && chainTimeoutPlausible && state.chain.timeout > 0,', 'ok: true,'],
  ["the overlay's checks", 'return overlay.ok ? overlay : null;', 'return overlay;'],
  ['the overlay first', 'if (overlay && now - overlay.at < 2000)', 'if (false)'],
];
let caught = 0;
for (const [name, from, to] of mutants) {
  const n = SRC.split(from).length - 1;
  if (n !== 1) { console.log(`BAD    ${name}: found ${n} times`); continue; }
  const file = `${W}/mutant.user.js`;
  fs.writeFileSync(file, SRC.replace(from, to));
  const r = spawnSync(process.execPath, ['--test', 'factionops-chain-bar.test.mjs'], { env: { ...process.env, FO_SRC: file }, encoding: 'utf8' });
  if (r.status !== 0) caught++;
  console.log(`${r.status !== 0 ? 'caught' : 'MISSED'} ${name}`);
}
fs.rmSync(`${W}/mutant.user.js`, { force: true });
console.log(`${caught} of ${mutants.length} caught`);
process.exit(caught === mutants.length ? 0 : 1);
```

```bash
W=/opt/warboard/.superpowers/sdd/2026-10-27-factionops-chain-bar; cd "$W/wt/server" && node "$W/mutants.mjs" "$W" > "$W/mutants.log" 2>&1; echo "exit $?"; cat "$W/mutants.log"
```

Expected: `exit 0` and `14 of 14 caught`.

- [ ] **Step 8: The related set** against the worktree's copy, with the new file:

```bash
uptime; W=/opt/warboard/.superpowers/sdd/2026-10-27-factionops-chain-bar; WT=$W/wt; R=$WT/server/wtcopy; mkdir "$R" && for t in factionops-activate-pill factionops-auth-refusal factionops-call-drops factionops-chain-bonus factionops-chat-ids factionops-hide-abroad factionops-life-percent factionops-transport-chip push-support-message; do sed "s#/opt/warboard/server/public/scripts/#$WT/server/public/scripts/#g" "$WT/server/$t.test.mjs" > "$R/$t.test.mjs"; done; cd "$WT/server" && node --test wtcopy/*.test.mjs factionops-filters.test.mjs menu-labels.test.mjs factionops-chain-bar.test.mjs > "$W/related.log" 2>&1; rm -r /opt/warboard/.superpowers/sdd/2026-10-27-factionops-chain-bar/wt/server/wtcopy; command grep -E "^# (tests|pass|fail) " "$W/related.log" | paste -sd" " -; git -C "$WT" status --short
```

Expected: `# fail 0` and 11 tests more than the Setup baseline. Then the two script files modified and the two new test files untracked, beside `?? server/node_modules`.

- [ ] **Step 9: Sweep what the branch adds:**

```bash
W=/opt/warboard/.superpowers/sdd/2026-10-27-factionops-chain-bar; cd "$W/wt" && git add -N -- server/factionops-chain-bar.test.mjs tests/factionops/chainbar.e2e.test.mjs && git diff | command grep -E '^\+' > "$W/added.txt"; command grep -oE '(^|[^A-Za-z0-9])[A-Za-z0-9]{16}([^A-Za-z0-9]|$)' "$W/added.txt" | sort | uniq -c; node "$W/sweep-env.mjs" "$W/added.txt" && node "$W/sweep-names.mjs" "$W/added.txt"
```

Expected: only code names among the 16-character words (`isFactionOpsPage`, `readChainFromDom`, `parseChainFromDOM` is longer and does not show), and both sweeps clean.

- [ ] **Step 10: Commit.**

```bash
W=/opt/warboard/.superpowers/sdd/2026-10-27-factionops-chain-bar; cd "$W/wt" && git add -- server/factionops-chain-bar.test.mjs tests/factionops/chainbar.e2e.test.mjs && git commit -q -m "factionops 5.6.21: a flashing chain bar on every Torn page" -m "While the faction's chain has 10 or more hits and the chain-alert threshold (1:00 unless changed) or less left, a red and white bar flashes at the top of every Torn page: CHAIN DYING with the count and the clock. FactionOps now loads on every Torn page for it; off its own pages (its old @match list) it stops right after starting the bar. The bar reads Torn's sidebar once a second, the war overlay's chain standing in where the sidebar has none, and before it first comes up it asks the Torn API once whether the chain is in its cooldown (shown anyway if that fails). Only while the page has focus (Torn PDA exempt), under the chain-alert switch; the existing chain alerts do not change." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- server/public/scripts/factionops.user.js server/public/scripts/factionops.meta.js server/factionops-chain-bar.test.mjs tests/factionops/chainbar.e2e.test.mjs && git status --short && git log --format='%h %s' -2 | cat
```

Expected: `?? server/node_modules` from `status`, then this commit and the plan's.

---

### Task 2: Release

- [ ] **Step 1: Pre-flight.**

```bash
uptime; W=/opt/warboard/.superpowers/sdd/2026-10-27-factionops-chain-bar; WT=$W/wt; command grep -E "^Task 1: complete|^Final review" "$W/progress.md" | cut -c1-160; git -C "$WT" status --short; pm2 pid warboard | tee "$W/pid-before"; cd /opt/warboard && git log --format='%h %s' main..factionops-chain-bar | cat; git status --short -- server/public/scripts/factionops.user.js server/public/scripts/factionops.meta.js server/factionops-chain-bar.test.mjs tests/factionops
```

Expected: the load under 12; Task 1's `complete` line and the final review's; `?? server/node_modules`; warboard's pid; Task 1's commit and any fix-pass commits; then nothing.

- [ ] **Step 2: Fast-forward main.** The served script changes the moment the merge lands. Git writes the files as root, so give the served ones back to warboard:

```bash
W=/opt/warboard/.superpowers/sdd/2026-10-27-factionops-chain-bar; cd /opt/warboard && git rev-parse HEAD > "$W/main-before" && git merge -q --ff-only factionops-chain-bar && chown warboard:warboard server/public/scripts/factionops.user.js server/public/scripts/factionops.meta.js && chmod 644 server/public/scripts/factionops.user.js server/public/scripts/factionops.meta.js; git log --format='%h %s' -1 | cat; stat -c '%U:%G %a %n' server/public/scripts/factionops.user.js server/public/scripts/factionops.meta.js server/factionops-chain-bar.test.mjs tests/factionops/chainbar.e2e.test.mjs
```

Expected: the branch's last commit as main's HEAD; the two served files `warboard:warboard 644`; the two test files `root:root 644`. If the merge is refused, main has moved on: run `git -C "$WT" rebase main`, run Task 1 Steps 6 and 8 again, and repeat this step.

- [ ] **Step 3: The whole suite on main** (the gate `deploy.sh` runs, without its reload; nothing here needs a restart):

```bash
uptime; W=/opt/warboard/.superpowers/sdd/2026-10-27-factionops-chain-bar; cd /opt/warboard/server && node --test > "$W/main-suite.log" 2>&1; command grep -E "^# (tests|pass|fail|skipped) " "$W/main-suite.log" | paste -sd" " -; command grep -E "^not ok" "$W/main-suite.log" | head
```

Expected: `# fail 0` and `# skipped 2`, with 11 tests more than main's last run (2727 at 11:19 EDT). If anything fails, the old script goes back first: `git revert --no-edit "$(cat "$W/main-before")..HEAD"` on main, the same `chown`/`chmod` as Step 2, then stop and look.

- [ ] **Step 4: Check what is served, and that nothing restarted:**

```bash
W=/opt/warboard/.superpowers/sdd/2026-10-27-factionops-chain-bar; F=/opt/warboard/server/public/scripts/factionops; T=$(date +%s); curl -s "http://127.0.0.1:3000/scripts/factionops.meta.js?t=$T" | command grep '@version'; curl -s "https://tornwar.com/scripts/factionops.meta.js?t=$T" | command grep '@version'; curl -s "https://tornwar.com/scripts/factionops.meta.js" | command grep '@version'; curl -s "https://tornwar.com/scripts/factionops.user.js?t=$T" | sha256sum | cut -c1-12; sha256sum "$F.user.js" | cut -c1-12; echo "pid before $(cat "$W/pid-before") after $(pm2 pid warboard)"
```

Expected: `// @version      5.6.21` three times. The third is the plain address, which is what Tampermonkey's update check fetches; nginx sends it with `max-age=300`, so if it still says 5.6.20, check again after 5 minutes and report only once it says 5.6.21. Then the same 12 hex characters twice, and the same pid before and after.

- [ ] **Step 5: Push.** Sweep the lines this push adds, then push with the remote's URL masked:

```bash
W=/opt/warboard/.superpowers/sdd/2026-10-27-factionops-chain-bar; cd /opt/warboard && git log --format='%h %an %s' origin/main..main | cat && git diff origin/main..main | command grep -E '^\+' > "$W/added.txt"; command grep -oE '(^|[^A-Za-z0-9])[A-Za-z0-9]{16}([^A-Za-z0-9]|$)' "$W/added.txt" | sort | uniq -c; node "$W/sweep-env.mjs" "$W/added.txt" && node "$W/sweep-names.mjs" "$W/added.txt" && git push -q origin main 2>&1 | sed -E 's#//[^@]*@#//***@#g'; git log --format='%h' -1 origin/main
```

Expected: the plan's commit, Task 1's and any from the fix pass, and no other session's commit (if there is one, stop and ask the owner first). Then only code names among the 16-character words, both sweeps clean, and origin/main's tip the same as main's.

- [ ] **Step 6: Clean up.** Copy the ledger and the logs into this session's scratchpad directory, then remove the worktree's `node_modules` link, the worktree, the branch and the workspace:

```bash
W=/opt/warboard/.superpowers/sdd/2026-10-27-factionops-chain-bar; S="${SCRATCHPAD:?set SCRATCHPAD to the scratchpad directory}/factionops-chain-bar-release"; mkdir -p "$S" && cp -r "$W/progress.md" "$W"/*.log "$W/mutants.mjs" "$S/" && rm "$W/wt/server/node_modules" && cd /opt/warboard && git worktree remove "$W/wt" && git branch -d factionops-chain-bar && rm -r /opt/warboard/.superpowers/sdd/2026-10-27-factionops-chain-bar && git worktree list | command grep -c factionops-chain-bar
```

Expected: `0`.

- [ ] **Step 7: Memory.**
  - New `reference_factionops_chain_bar.md`:
    - 5.6.21 matches every Torn page. `isFactionOpsPage` (its old `@match` list) gates everything but the bar, which is started just above that gate.
    - The ids and the text.
    - The data: the war overlay's chain where it runs (`chainBarFromOverlay`), Torn's sidebar everywhere else.
    - The one API cooldown check per dying chain.
    - Owed: the owner's check on the phone (PDA may need FactionOps updated in PDA) and on a non-FactionOps page during a chain.
  - Edit MEMORY.md's FactionOps line in place to point at it, keeping the line count.
  - Gym Coach's memory: the chain bar went to FactionOps; Gym Coach stays 0.12.18; the stat-book fix would be 0.12.19.

- [ ] **Step 8: Report to the owner,** in a few short lines:
  - what shipped, and the served URL `https://tornwar.com/scripts/factionops.user.js`;
  - that Tampermonkey picks it up on its next update check, and that PDA may need FactionOps updated in PDA;
  - what to check;
  - the rulings and deferred minors, as superpowers:executing-plans lists them.
