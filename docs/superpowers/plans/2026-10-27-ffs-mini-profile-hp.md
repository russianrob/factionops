# FFS Banner Estimates Beta 2.73.914: HP in the Mini Profile - Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** FFS Banner Estimates Beta shows a player's HP in Torn's mini profile, on its own line under FFS's FF line: `HP 1,234 / 5,678 (21%)`.

**Architecture:**
- One script changes: `server/public/scripts/ffs-banner-estimates-beta.user.js` and its meta file. When FFS first sees a mini profile, it asks Torn's API for that player's v2 profile and draws `life.current / life.maximum` with a percentage. An answer is kept for a minute per player. Cards that ask while a call is out share it. Nothing is asked while Torn is refusing the key, through the stand-down the chain button already uses (`_ffsRateLimitedUntil`). A small helper keeps FFS's two lines in one order, the FF line and then the HP line, whichever is drawn first.
- The stable copy, `ffs-banner-estimates.user.js`, stays at 2.73.61. The owner keeps FFS changes to the beta (2026-10-25), and promoting the beta later carries this along.
- `server/public/scripts` is served from the main checkout, so the served file is the repo file. The work is done in a git worktree on a branch, and the release is a fast-forward of main. Nothing on the server changes, so there is no deploy and no pm2 reload.

**Tech Stack:** a userscript (plain JavaScript, with the jQuery FFS already uses). Tests use node:test and linkedom, and run the beta's shipped functions, lifted out of the file by name.

**Spec:** the design the owner approved in chat, below. There is no spec file: the change is one script and its tests.

**The ask:**
- 19:26 EDT on 2026-10-26, the owner, with a screenshot of a mini profile: "can we have the hp shown in the mini profile as well?"
- Facts found:
  - Torn's mini profile shows no life. Its data (`page.php?sid=UserMiniProfile`) carries none that any reader here uses: TornTools 9.1.1.1 and ReTorn read only the player's id and last action from it.
  - Torn's API v2 `user/{id}/profile` gives any player's `life: {current, maximum}`, as `torn-stakeout` and `torn-ancient-ones` read it.
  - FFS already writes its FF line into every mini profile (`apply_to_mini_profile` appends a `span.ff-scouter-mini-ff` to the card's `.description`). It already calls Torn's API on its own key (the chain button's `ffs_chainStatus`), and it stays on outside war. FactionOps, which draws the attack page's percentage, is switched off outside war.
- At 20:11 EDT the owner said "do recommended", which approved:
  1. FFS beta, as 2.73.914, with the stable copy untouched;
  2. its own line right under the FF line: `HP 1,234 / 5,678 (21%)`, Torn's numbers with thousands separators, then a percentage;
  3. automatic on each mini-profile open: one call, kept for a minute per player, and nothing asked while Torn is refusing the key;
  4. read once when the card opens, with no live count.

**Execution:** the owner chooses at hand-off. One fresh Opus reviewer checks the branch between Task 1 and Task 2 either way.

**Dry run:** Task 1 ran while the plan was written. Its test file, edits, scripts and commands were read back out of this file and replayed in order on copies of main's files at 0503ef60. What needs the real worktree or main did not run: Setup, the whole-suite runs and Task 2.
- Task 1's tests: `# tests 20 # pass 0 # fail 20` before its code, and `# tests 20 # pass 20 # fail 0` after. The chain button's tests (26) and the beta's sort tests (53) pass on the replayed beta.
- Mutants: 12 of 12 caught.
- Both sweeps ran on the replayed diff.
- One read-only call to Torn, with `timestamp=`: `user/{id}/profile` answered with `profile.life.current` and `profile.life.maximum` as numbers.

## Global Constraints

- Beta only: `ffs-banner-estimates-beta.user.js` and `ffs-banner-estimates-beta.meta.js`. The stable copy and its meta file stay byte for byte as they are.
- The line: a `div.ffs-mini-hp` in the card's `.description`, right after the `span.ff-scouter-mini-ff` when there is one, and at the end when there is not. Its text is `HP <current> / <maximum> (<pct>%)`, with numbers written the `en-US` way (1,234). The percentage is floored, then 99 when not full and 1 when not down: the rule FactionOps uses on the attack page.
- The call: `GET https://api.torn.com/v2/user/<id>/profile?striptags=true&timestamp=<ms>&key=<FFS's key>`, waiting 4 s at most, on FFS's own key (`key`). No call when FFS has no key, or while `_ffsRateLimitedUntil` is ahead. A refusal (code 5, 8 or 9, or "too many requests") sets `_ffsRateLimitedUntil` a minute ahead, as the chain button's does.
- Kept: an answer with life in it, for 60 s per player. A call that is out is shared. A failure is not kept.
- No new @grant, @connect or menu entry; no clicks; no requests but that one call.
- Version 2.73.914: `@version`, `SCRIPT_VERSION` and the meta file (the header and a newline) agree, and the CHANGELOG lists it first. Inline comments carry no version numbers.
- Straight quotes only in the script: PDA's GM layer breaks on curly ones.
- The repo is public. Tests and text use made-up numbers, names and ids (Target, 1000001), never a member's, and never a value from the owner's screenshots.
- Release: a fast-forward of main, with the served files `warboard:warboard 644`. No `deploy.sh`, and no pm2 reload while the chain runs; pm2's warboard pid is the same before and after.
- Stage only this plan's paths: other sessions' dirty files in the main checkout stay as they are. Every commit ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Room in Torn's card.** The HP line goes in the card's `.description`, the same box as the FF line. Torn sets the card's height before scripts add to it, and does not grow it for them: a list of item pictures another script added to the card once painted out through its bottom, while a few lines of text fitted. One more line of text should fit, but Torn's CSS is not here, so no test can say. The owner's check on phone and PC settles it (Task 2 Step 8 asks for it). If the line is cut off, read the card through remote inspect before moving anything.
2. **The key's budget on PC.** On PC a card opens on hover, so a fast mouse over a list opens many cards: one call per new player per minute. The key's 100 a minute is shared with every script the owner runs. A refusal stands every FFS Torn call down for a minute, the chain button's too, and the card simply goes without the line. The tests "a refusal stands every Torn call here down for a minute; other errors do not" and "while Torn is refusing the key, nothing is asked" pin it.
3. **PDA and the warboard apps.** The call is a plain `fetch` to api.torn.com, as the chain button's is, on FFS's own key (on PDA, PDA's key). With no key there is no line and no prompt. The test "with no key set, nothing is asked and there is no line" pins it; the hosts themselves are the owner's check.
4. **The order under real timing.** FFScouter's answer and Torn's come in either order, and FFS draws its FF line again after FFScouter's refresh. The FF line must stay above the HP line, one of each. The tests "an FF line drawn after the HP line still goes above it, each time FFS redraws it" and "the FF line is placed with the HP line in mind" pin it.
5. **Cards that close, change or are drawn again.** A card closed before Torn answers, or open by then on someone else, gets no line. A card with no `.description` gets none either: Torn reuses the card's wrapper for its send-money form, and FactionOps keeps out of a card showing one. The tests "a card that has closed, or now shows someone else, gets no line" and "no description, life with no line, or no player id: nothing is drawn or asked" pin it. No test here can show Torn drawing a card again after a script has written into it, which has wiped buttons other scripts added. The FF line shows in the owner's cards, so FFS finds a card after that. The HP line goes into the same box a moment later, and is drawn once. If the owner sees it show and then go, that is the cause, and the cure is drawing it again whenever it is missing.

## Paths and commands

- `W=/opt/warboard/.superpowers/sdd/2026-10-27-ffs-mini-profile-hp` is this plan's git-ignored workspace, and `WT=$W/wt` the worktree, on branch `ffs-mini-profile-hp`.
- **The new test file reads the beta from its own checkout**, so in the worktree it tests the worktree's beta, unless `FFS_DIR` names another folder (the mutants use that). **The chain button's tests read `FFS_DIR`, or main's served beta when it is unset.** Every whole-suite run in the worktree sets `FFS_DIR="$WT/server/public/scripts"`, so they test the branch's beta.
- Test runs write to `$W/t.log` and print the `# tests`, `# pass` and `# fail` lines, then any `not ok` lines.
- **Edits:** each "Replace" block's text occurs in its file exactly once, and the "With" block takes its place. Neither block holds the newline that ends its last line. Make a step's edits in the order given.

## Setup

- [ ] **Step 1: Commit this plan on main, then make the worktree:**

```bash
uptime; cd /opt/warboard && git add -- docs/superpowers/plans/2026-10-27-ffs-mini-profile-hp.md && git commit -q -m "plan: FFS Banner Estimates Beta 2.73.914, HP in the mini profile" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- docs/superpowers/plans/2026-10-27-ffs-mini-profile-hp.md && W=/opt/warboard/.superpowers/sdd/2026-10-27-ffs-mini-profile-hp && mkdir -p "$W" && git worktree add -q "$W/wt" -b ffs-mini-profile-hp && ln -s /opt/warboard/server/node_modules "$W/wt/server/node_modules" && git -C "$W/wt" status --short && git -C "$W/wt" log --format='%h %s' -1 | cat
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

- [ ] **Step 3: Baseline.** The chain button's tests, then the whole suite, in the worktree, with the failing names kept for Task 1:

```bash
W=/opt/warboard/.superpowers/sdd/2026-10-27-ffs-mini-profile-hp; WT=$W/wt; export FFS_DIR="$WT/server/public/scripts"; cd "$WT/server" && node --test ffs-chain-button.test.mjs > "$W/t.log" 2>&1; command grep -E "^# (tests|pass|fail) " "$W/t.log" | paste -sd" " -; node --test > "$W/baseline.log" 2>&1; command grep -E "^# (tests|pass|fail|skipped) " "$W/baseline.log" | paste -sd" " -; command grep -E "^not ok" "$W/baseline.log" | sed -E 's/^not ok [0-9]+ - //' | sort > "$W/base-fail-names.txt"; wc -l < "$W/base-fail-names.txt"
```

Expected: `# tests 26 # pass 26 # fail 0`; then the whole suite with `# skipped 2`, and its failures counted. A worktree has failed 30 tests that pass on main, all from what a worktree lacks: `factionops-filters.test.mjs` needs `server/.env`, `war-history-dedupe.test.mjs` needs main's uncommitted `war-history.js`, and 28 RW Pricer tests read main's live `data/rwp-prices.json`. If the names in `$W/base-fail-names.txt` are those, ledger them as the gate (`Setup: Ruling:`): Task 1 must end with the same names. If any other test fails, run it on main too (`cd /opt/warboard/server && node --test <file>`); a failure there as well is not this plan's, so ledger it and go on.

---

### Task 1: HP in the mini profile

**Files:**
- Create: `server/ffs-mini-hp.test.mjs`
- Modify: `server/public/scripts/ffs-banner-estimates-beta.user.js` (header, CHANGELOG, `apply_to_mini_profile`, `check_mutation`, after `ffs_isRateLimitError`, `SCRIPT_VERSION`)
- Regenerate: `server/public/scripts/ffs-banner-estimates-beta.meta.js`

**Interfaces:**
- Consumes (already in the beta): `key` (FFS's API key, or null), `_ffsRateLimitedUntil` (ms), `FFS_RATE_LIMIT_BACKOFF_MS` (60_000), `ffs_isRateLimitError(data) -> boolean`, `get_player_id_in_element(element) -> number|null`, `apply_to_mini_profile(mini)`, and the loop in `check_mutation` that marks each new card `ff-processed`.
- Produces:
  - `FFS_MINI_HP_TTL_MS = 60_000`, `FFS_MINI_HP_TIMEOUT_MS = 4000`, `_ffsMiniHp` (a `Map` of player id to `{ at, life }` or `{ at, pending }`);
  - `ffs_hpLine(life) -> string|null`;
  - `async ffs_fetchLife(playerId) -> {current, maximum}|null`;
  - `async ffs_miniHp(playerId) -> {current, maximum}|null`;
  - `ffs_placeMiniLine(description, el)`, for both lines;
  - `ffs_paintMiniHp(mini, life)`;
  - `async ffs_showMiniHp(mini, playerId)`.

- [ ] **Step 1: Write the tests.**

Create `server/ffs-mini-hp.test.mjs`:

```js
// FFS Banner Estimates Beta: the HP line in Torn's mini profile. The card shows
// no life of its own, so FFS asks Torn's API for the player's profile, at most
// once a minute per player, and writes "HP 1,234 / 5,678 (21%)" under its FF
// line. Runs the SHIPPED functions of the beta, lifted out by name. The script
// is read from this checkout's public/scripts, or from FFS_DIR when that names
// another folder.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseHTML } from 'linkedom';

const DIR = process.env.FFS_DIR || fileURLToPath(new URL('./public/scripts/', import.meta.url));
const SRC = readFileSync(join(DIR, 'ffs-banner-estimates-beta.user.js'), 'utf8');
const META = readFileSync(join(DIR, 'ffs-banner-estimates-beta.meta.js'), 'utf8');

// The source of one named function, found by counting braces from its name.
function fn(name) {
  const at = SRC.indexOf('function ' + name + '(');
  assert.ok(at >= 0, 'not found: ' + name);
  // Keep "async" when the function has it, or its awaits would not parse.
  const from = SRC.slice(at - 6, at) === 'async ' ? at - 6 : at;
  let depth = 0;
  for (let j = SRC.indexOf('{', at); j < SRC.length; j++) {
    if (SRC[j] === '{') depth++;
    else if (SRC[j] === '}' && --depth === 0) return SRC.slice(from, j + 1) + '\n';
  }
  throw new Error('unbalanced: ' + name);
}

// One `const NAME = ...;` as the script has it.
function konst(name) {
  const m = SRC.match(new RegExp('const ' + name + ' = [^;]+;'));
  assert.ok(m, 'not found: const ' + name);
  return m[0] + '\n';
}

const NOW = Date.UTC(2026, 9, 27, 12, 0, 0);
// Life as Torn's v2 profile gives it, and a whole answer around it; made-up numbers.
const LIFE = { current: 1234, maximum: 5678 };
const answerWith = (life) => ({ profile: { id: 1000001, name: 'Target', life } });

// ── the line ──

// ffs_hpLine as the beta has it, lifted at each call so a missing one fails its own test.
const hpLine = (life) => new Function(fn('ffs_hpLine') + 'return ffs_hpLine;')()(life);

test('the HP line reads as the attack page does, with the percentage after', () => {
  assert.equal(hpLine({ current: 1234, maximum: 5678 }), 'HP 1,234 / 5,678 (21%)');
  assert.equal(hpLine({ current: 7500, maximum: 7500 }), 'HP 7,500 / 7,500 (100%)');
  assert.equal(hpLine({ current: 123456789, maximum: 123456789 }), 'HP 123,456,789 / 123,456,789 (100%)');
});

test('the percentage is floored, as on the attack page: 100% only when full, 0% only when down', () => {
  assert.equal(hpLine({ current: 7499, maximum: 7500 }), 'HP 7,499 / 7,500 (99%)');
  assert.equal(hpLine({ current: 1, maximum: 7500 }), 'HP 1 / 7,500 (1%)');
  assert.equal(hpLine({ current: 0, maximum: 7500 }), 'HP 0 / 7,500 (0%)');
});

test('life that Torn did not give as numbers makes no line', () => {
  for (const life of [undefined, null, {}, { current: 1234 }, { maximum: 5678 },
    { current: '1234', maximum: 5678 }, { current: 1234, maximum: 0 }, { current: -1, maximum: 5678 },
    { current: NaN, maximum: 5678 }, { current: 1234, maximum: Infinity }]) {
    assert.equal(hpLine(life), null, String(JSON.stringify(life)));
  }
});

// ── asking Torn ──

// A request Torn never answers.
const SILENT = Symbol('silent');

// ffs_miniHp as the beta has it, with the key the script keeps, its refusal
// stand-down, a clock the test moves, and Torn played by `answer(url)`: a body,
// an Error for a request that fails, or SILENT for one that is never answered.
function torn({ key = 'k+1', answer = () => answerWith(LIFE) } = {}) {
  const t = { now: NOW, calls: [], timers: [], cleared: 0 };
  const fetchStub = (url) => {
    t.calls.push(url);
    const a = answer(url);
    if (a === SILENT) return new Promise(() => {});
    if (a instanceof Error) return Promise.reject(a);
    return Promise.resolve({ json: () => Promise.resolve(a) });
  };
  const setTimeoutStub = (f, ms) => t.timers.push({ f, ms });
  const clearStub = () => { t.cleared += 1; };
  const api = new Function('fetch', 'Date', 'setTimeout', 'clearTimeout', 'keyIn',
    'let key = keyIn;\nlet _ffsRateLimitedUntil = 0;\n'
    + konst('FFS_RATE_LIMIT_BACKOFF_MS') + konst('FFS_REFUSAL_CODES')
    + konst('FFS_MINI_HP_TTL_MS') + konst('FFS_MINI_HP_TIMEOUT_MS') + konst('_ffsMiniHp')
    + fn('ffs_isRateLimitError') + fn('ffs_hpLine') + fn('ffs_fetchLife') + fn('ffs_miniHp')
    + 'return { ffs_miniHp, limited: () => _ffsRateLimitedUntil, refuseUntil: (ms) => { _ffsRateLimitedUntil = ms; } };',
  )(fetchStub, { now: () => t.now }, setTimeoutStub, clearStub, key);
  return Object.assign(t, api);
}

test('a card asks Torn once, for the profile, on the script key, with a cache-buster', async () => {
  const t = torn();
  assert.deepEqual(await t.ffs_miniHp(1000001), LIFE);
  assert.deepEqual(t.calls, [`https://api.torn.com/v2/user/1000001/profile?striptags=true&timestamp=${NOW}&key=k%2B1`]);
});

test('the same player again within a minute is free; a minute on, Torn is asked again', async () => {
  const t = torn();
  await t.ffs_miniHp(1000001);
  t.now = NOW + 59_999;
  assert.deepEqual(await t.ffs_miniHp(1000001), LIFE);
  assert.equal(t.calls.length, 1);
  t.now = NOW + 60_000;
  assert.deepEqual(await t.ffs_miniHp(1000001), LIFE);
  assert.equal(t.calls.length, 2);
});

test('two cards for one player while Torn is being asked share the one call', async () => {
  const t = torn();
  const [a, b] = await Promise.all([t.ffs_miniHp(1000001), t.ffs_miniHp(1000001)]);
  assert.deepEqual(a, LIFE);
  assert.deepEqual(b, LIFE);
  assert.equal(t.calls.length, 1);
  await t.ffs_miniHp(1000002);
  assert.equal(t.calls.length, 2, 'another player has a call of their own');
});

test('with no key set, nothing is asked and there is no line', async () => {
  for (const key of ['', null]) {
    const t = torn({ key });
    assert.equal(await t.ffs_miniHp(1000001), null);
    assert.equal(t.calls.length, 0);
  }
});

test('while Torn is refusing the key, nothing is asked', async () => {
  const t = torn();
  t.refuseUntil(NOW + 1);
  assert.equal(await t.ffs_miniHp(1000001), null);
  assert.equal(t.calls.length, 0);
});

test('a refusal stands every Torn call here down for a minute; other errors do not', async () => {
  for (const code of [5, 8, 9]) {
    const t = torn({ answer: () => ({ error: { code, error: 'refused' } }) });
    assert.equal(await t.ffs_miniHp(1000001), null);
    assert.equal(t.limited(), NOW + 60_000, 'code ' + code);
  }
  for (const code of [2, 6, 16]) {
    const t = torn({ answer: () => ({ error: { code, error: 'not this' } }) });
    assert.equal(await t.ffs_miniHp(1000001), null);
    assert.equal(t.limited(), 0, 'code ' + code);
  }
});

test('a failed or unreadable answer is not kept: the next card asks again', async () => {
  const answers = [new Error('offline'), answerWith(null), answerWith({ current: 'x', maximum: 5678 }),
    { profile: null }, answerWith(LIFE)];
  const t = torn({ answer: () => answers.shift() });
  for (let i = 0; i < 4; i++) assert.equal(await t.ffs_miniHp(1000001), null, 'answer ' + i);
  assert.deepEqual(await t.ffs_miniHp(1000001), LIFE);
  assert.equal(t.calls.length, 5);
});

test('no answer within 4 seconds makes no line, and the next card asks again', async () => {
  const t = torn({ answer: () => SILENT });
  const pending = t.ffs_miniHp(1000001);
  assert.equal(t.timers.length, 1);
  assert.equal(t.timers[0].ms, 4000);
  t.timers[0].f();
  assert.equal(await pending, null);
  assert.equal(t.cleared, 1);
  t.ffs_miniHp(1000001);
  assert.equal(t.calls.length, 2);
});

// ── the card ──

// A mini profile as Torn draws one, for a made-up player, with FFS's lines (as
// HTML) in its description after Torn's own status.
function card(id, lines = '') {
  const { document } = parseHTML('<!doctype html><html><body>'
    + '<div class="profile-mini-_userProfileWrapper_abc12"><div class="profile-container">'
    + `<a class="user-name" href="https://www.torn.com/profiles.php?XID=${id}">Target</a>`
    + '<div class="description"><div class="desc-wrap"><span class="main-desc">Okay</span></div>'
    + lines + '</div></div></div></body></html>');
  const mini = document.querySelector('[class^="profile-mini-_userProfileWrapper_"]');
  return { document, mini, description: mini.querySelector('.description') };
}
const FF = '<span class="ff-scouter-mini-ff">FF 2.50 (Moderate)</span>';

// The beta's drawing of the line, with `miniHp` standing in for the call to Torn.
function painter(document, miniHp = async () => LIFE) {
  return new Function('document', 'ffs_miniHp',
    fn('ffs_hpLine') + fn('ffs_placeMiniLine') + fn('ffs_paintMiniHp') + fn('get_player_id_in_element')
    + fn('ffs_showMiniHp') + 'return { ffs_placeMiniLine, ffs_paintMiniHp, ffs_showMiniHp };',
  )(document, miniHp);
}
// What the description holds, in order: each child's class and text.
const shown = (description) => [...description.children].map((el) => el.className + ': ' + el.textContent);

test('the HP line sits right under the FF line, above anything after it', () => {
  const c = card(1000001, FF + '<div class="other">from another script</div>');
  painter(c.document).ffs_paintMiniHp(c.mini, LIFE);
  assert.deepEqual(shown(c.description), [
    'desc-wrap: Okay',
    'ff-scouter-mini-ff: FF 2.50 (Moderate)',
    'ffs-mini-hp: HP 1,234 / 5,678 (21%)',
    'other: from another script',
  ]);
});

test('an FF line drawn after the HP line still goes above it, each time FFS redraws it', () => {
  const c = card(1000001);
  const p = painter(c.document);
  p.ffs_paintMiniHp(c.mini, LIFE);
  for (const text of ['FF 2.50 (Moderate)', 'FF 2.75 (Moderate)']) {
    // As FFS redraws its FF line: the old one out, the new one placed.
    for (const old of c.description.querySelectorAll('.ff-scouter-mini-ff')) old.remove();
    const ff = c.document.createElement('span');
    ff.className = 'ff-scouter-mini-ff';
    ff.textContent = text;
    p.ffs_placeMiniLine(c.description, ff);
    assert.deepEqual(shown(c.description), [
      'desc-wrap: Okay', 'ff-scouter-mini-ff: ' + text, 'ffs-mini-hp: HP 1,234 / 5,678 (21%)',
    ]);
  }
});

test('with no FF line, the HP line goes at the end of the description', () => {
  const c = card(1000001);
  painter(c.document).ffs_paintMiniHp(c.mini, LIFE);
  assert.deepEqual(shown(c.description), ['desc-wrap: Okay', 'ffs-mini-hp: HP 1,234 / 5,678 (21%)']);
});

test('drawing again replaces the HP line instead of adding a second', () => {
  const c = card(1000001, FF);
  const p = painter(c.document);
  p.ffs_paintMiniHp(c.mini, LIFE);
  p.ffs_paintMiniHp(c.mini, { current: 5678, maximum: 5678 });
  assert.deepEqual(shown(c.description), [
    'desc-wrap: Okay', 'ff-scouter-mini-ff: FF 2.50 (Moderate)', 'ffs-mini-hp: HP 5,678 / 5,678 (100%)',
  ]);
});

test('a card that has closed, or now shows someone else, gets no line', async () => {
  const closed = card(1000001, FF);
  closed.mini.remove();
  await painter(closed.document).ffs_showMiniHp(closed.mini, 1000001);
  assert.equal(closed.mini.querySelectorAll('.ffs-mini-hp').length, 0);

  const other = card(1000002, FF);
  await painter(other.document).ffs_showMiniHp(other.mini, 1000001);
  assert.equal(other.mini.querySelectorAll('.ffs-mini-hp').length, 0);

  const open = card(1000001, FF);
  await painter(open.document).ffs_showMiniHp(open.mini, 1000001);
  assert.equal(open.mini.querySelectorAll('.ffs-mini-hp').length, 1);
});

test('no description, life with no line, or no player id: nothing is drawn or asked', async () => {
  const c = card(1000001, FF);
  const p = painter(c.document);
  p.ffs_paintMiniHp(c.mini, { current: 'x', maximum: 5678 });
  assert.equal(c.mini.querySelectorAll('.ffs-mini-hp').length, 0);
  c.description.remove();
  p.ffs_paintMiniHp(c.mini, LIFE);
  assert.equal(c.mini.querySelectorAll('.ffs-mini-hp').length, 0);
  let asked = 0;
  await painter(c.document, async () => { asked += 1; return LIFE; }).ffs_showMiniHp(c.mini, null);
  assert.equal(asked, 0);
});

// ── wiring and version ──

test('FFS asks for the HP when it first sees a mini profile, without holding up the FF line', () => {
  const at = SRC.indexOf('const check_mutation = async function');
  const body = SRC.slice(at, SRC.indexOf('const ff_gauge_observer', at));
  assert.match(body, /const player_id = get_player_id_in_element\(mini\);\n(\s*\/\/[^\n]*\n)*\s*ffs_showMiniHp\(mini, player_id\)\.catch\(\(\) => \{\}\);\n\s*apply_to_mini_profile\(mini\);/);
});

test('the FF line is placed with the HP line in mind', () => {
  const body = fn('apply_to_mini_profile');
  assert.match(body, /ffs_placeMiniLine\(description\[0\], desc\[0\]\)/);
  assert.doesNotMatch(body, /\.append\(desc\)/);
});

test('the beta is 2.73.914 in its header, its SCRIPT_VERSION and its meta file, and its CHANGELOG starts there', () => {
  assert.match(SRC, /^\/\/ @version {6}2\.73\.914$/m);
  assert.match(SRC, /const SCRIPT_VERSION = '2\.73\.914';/);
  const end = SRC.indexOf('// ==/UserScript==') + '// ==/UserScript=='.length;
  assert.equal(META, SRC.slice(0, end) + '\n');
  const log = SRC.slice(SRC.indexOf('CHANGELOG'));
  assert.match(log, /\n\/\/ 2\.73\.914 — [^\n]+\n(\/\/ {14}[^\n]+\n)*\/\/ 2\.73\.913 — /);
});
```

- [ ] **Step 2: Run them, and watch them fail:**

```bash
W=/opt/warboard/.superpowers/sdd/2026-10-27-ffs-mini-profile-hp; WT=$W/wt; cd "$WT/server" && node --test ffs-mini-hp.test.mjs > "$W/t.log" 2>&1; command grep -E "^# (tests|pass|fail) " "$W/t.log" | paste -sd" " -; command grep -E "^not ok" "$W/t.log" | sed -E 's/^not ok [0-9]+ - //'
```

Expected: `# tests 20 # pass 0 # fail 20`, then all 20 names. The first 17 fail on `not found:`, naming a function or constant that 2.73.914 adds; the two wiring tests fail on patterns the beta does not have yet, and the last on the version.

- [ ] **Step 3: The script.** Six edits, in this order.

**Edit 1 of 6 in `server/public/scripts/ffs-banner-estimates-beta.user.js`.** Replace:

```js
// @version      2.73.913
```

With:

```js
// @version      2.73.914
```

**Edit 2 of 6 in `server/public/scripts/ffs-banner-estimates-beta.user.js`.** Replace:

```js
// 2.73.913 — Chain button: skip people who can't be attacked (as FFS 2.73.62).
```

With:

```js
// 2.73.914 — Mini profiles show the player's HP on its own line under the FF
//              line, as "HP 1,234 / 5,678 (21%)": one Torn call per player a
//              minute at most, and none while Torn is refusing the key.
// 2.73.913 — Chain button: skip people who can't be attacked (as FFS 2.73.62).
```

**Edit 3 of 6 in `server/public/scripts/ffs-banner-estimates-beta.user.js`.** Replace:

```js
        $(description).append(desc);
```

With:

```js
        // Above the HP line when that was drawn first, so the order never changes.
        if (description[0]) ffs_placeMiniLine(description[0], desc[0]);
```

**Edit 4 of 6 in `server/public/scripts/ffs-banner-estimates-beta.user.js`.** Replace:

```js
          const player_id = get_player_id_in_element(mini);
          apply_to_mini_profile(mini);
```

With:

```js
          const player_id = get_player_id_in_element(mini);
          // Not awaited: Torn's answer must not hold up the FF line.
          ffs_showMiniHp(mini, player_id).catch(() => {});
          apply_to_mini_profile(mini);
```

**Edit 5 of 6 in `server/public/scripts/ffs-banner-estimates-beta.user.js`.** Replace:

```js
    return /too many requests/i.test(String(e.error || ""));
  }

  // beta: a target whose hospital time just ended is the most time-critical row
```

With:

```js
    return /too many requests/i.test(String(e.error || ""));
  }

  // ── HP in the mini profile ──
  // A mini profile shows the player's life on its own line under the FF line,
  // as "HP 1,234 / 5,678 (21%)". Torn's card carries no life, so it costs one
  // API call on the script's key, kept for a minute per player so that opening
  // the same card again is free. While Torn is refusing the key, nothing is
  // asked and the card goes without the line.
  const FFS_MINI_HP_TTL_MS = 60_000;
  // How long a card waits for Torn's answer before going without the line.
  const FFS_MINI_HP_TIMEOUT_MS = 4000;
  // Player id -> { at, life } once Torn has answered, or { at, pending } while
  // the call is out, so every card that asks meanwhile shares the one call.
  const _ffsMiniHp = new Map();

  /**
   * The HP line for Torn's life numbers, or null when they are not numbers it
   * can show. The percentage is floored, as FactionOps' is on the attack page,
   * so it says 100% only when full and 0% only when the player is down.
   */
  function ffs_hpLine(life) {
    if (!life || !Number.isFinite(life.current) || !Number.isFinite(life.maximum)) return null;
    const cur = life.current;
    const max = life.maximum;
    if (max <= 0 || cur < 0) return null;
    let pct = Math.floor((cur / max) * 100);
    if (pct === 100 && cur < max) pct = 99;
    if (pct === 0 && cur > 0) pct = 1;
    return `HP ${cur.toLocaleString("en-US")} / ${max.toLocaleString("en-US")} (${pct}%)`;
  }

  /**
   * One player's life as Torn's v2 profile gives it, { current, maximum }, or
   * null when Torn gives none: a refusal or another error, a request that
   * fails, no answer within FFS_MINI_HP_TIMEOUT_MS, or an answer without life
   * it can show. A refusal stands every Torn call here down for a minute, as
   * the chain button's does. The cache-buster keeps Torn from answering with a
   * reading it saved earlier.
   */
  async function ffs_fetchLife(playerId) {
    const url = `https://api.torn.com/v2/user/${playerId}/profile?striptags=true&timestamp=${Date.now()}&key=${encodeURIComponent(key)}`;
    let timer = null;
    try {
      const data = await Promise.race([
        fetch(url).then((r) => r.json()),
        new Promise((resolve) => {
          timer = setTimeout(() => resolve(null), FFS_MINI_HP_TIMEOUT_MS);
        }),
      ]);
      if (!data || data.error) {
        if (ffs_isRateLimitError(data)) _ffsRateLimitedUntil = Date.now() + FFS_RATE_LIMIT_BACKOFF_MS;
        return null;
      }
      const life = data.profile && data.profile.life;
      return ffs_hpLine(life) ? { current: life.current, maximum: life.maximum } : null;
    } catch (_) {
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * One player's life for a mini profile: the answer from the last minute when
   * there is one, else one call to Torn. Only an answer with life in it is
   * kept, so the next card after a failure asks again.
   */
  async function ffs_miniHp(playerId) {
    const hit = _ffsMiniHp.get(playerId);
    if (hit && (hit.pending || Date.now() - hit.at < FFS_MINI_HP_TTL_MS)) return hit.pending || hit.life;
    if (!key || Date.now() < _ffsRateLimitedUntil) return null;
    const pending = ffs_fetchLife(playerId);
    _ffsMiniHp.set(playerId, { at: Date.now(), pending });
    const life = await pending;
    if (life) _ffsMiniHp.set(playerId, { at: Date.now(), life });
    else _ffsMiniHp.delete(playerId);
    return life;
  }

  /**
   * Puts one of FFS's lines into a mini profile's description in a fixed order,
   * whichever is drawn first: the FF line, then the HP line right under it.
   * When the other line is not there, it goes at the end.
   */
  function ffs_placeMiniLine(description, el) {
    if (el.classList.contains("ffs-mini-hp")) {
      const ff = description.querySelector(".ff-scouter-mini-ff");
      if (ff) {
        ff.after(el);
        return;
      }
    } else {
      const hp = description.querySelector(".ffs-mini-hp");
      if (hp) {
        hp.before(el);
        return;
      }
    }
    description.appendChild(el);
  }

  /** Draws the HP line in a mini profile, in place of one already there. */
  function ffs_paintMiniHp(mini, life) {
    const text = ffs_hpLine(life);
    const description = mini.querySelector(".description");
    if (!text || !description) return;
    for (const old of mini.querySelectorAll(".ffs-mini-hp")) old.remove();
    const line = document.createElement("div");
    line.className = "ffs-mini-hp";
    line.textContent = text;
    ffs_placeMiniLine(description, line);
  }

  /**
   * Asks for a player's life when FFS first sees their mini profile, and draws
   * it if the card is still open on that player when the answer comes.
   */
  async function ffs_showMiniHp(mini, playerId) {
    if (!playerId) return;
    const life = await ffs_miniHp(playerId);
    if (!life || !mini.isConnected || get_player_id_in_element(mini) !== playerId) return;
    ffs_paintMiniHp(mini, life);
  }

  // beta: a target whose hospital time just ended is the most time-critical row
```

**Edit 6 of 6 in `server/public/scripts/ffs-banner-estimates-beta.user.js`.** Replace:

```js
  const SCRIPT_VERSION = '2.73.913';
```

With:

```js
  const SCRIPT_VERSION = '2.73.914';
```

- [ ] **Step 4: The meta file is the header and a newline.** Write it again from the header, then check the script parses and the meta file matches:

```bash
W=/opt/warboard/.superpowers/sdd/2026-10-27-ffs-mini-profile-hp; S=$W/wt/server/public/scripts/ffs-banner-estimates-beta; sed -n '1,/^\/\/ ==\/UserScript==$/p' "$S.user.js" > "$S.meta.js" && node --check "$S.user.js" && echo parses; wc -l < "$S.meta.js"; command grep '@version' "$S.meta.js"; command grep -c $'[‘’“”]' "$S.user.js"; git -C "$W/wt" diff --stat | cat
```

Expected: `parses`, `20`, `// @version      2.73.914`, `0` (no curly quotes), and the diff stat for the two beta files (`ffs-mini-hp.test.mjs` is new, so it is not in `git diff` yet):

```
 .../scripts/ffs-banner-estimates-beta.meta.js      |   2 +-
 .../scripts/ffs-banner-estimates-beta.user.js      | 134 ++++++++++++++++++++-
 2 files changed, 132 insertions(+), 4 deletions(-)
```

- [ ] **Step 5: Run the tests again,** with the chain button's and the beta's sort tests:

```bash
W=/opt/warboard/.superpowers/sdd/2026-10-27-ffs-mini-profile-hp; WT=$W/wt; cd "$WT/server" && node --test ffs-mini-hp.test.mjs > "$W/t.log" 2>&1; command grep -E "^# (tests|pass|fail) " "$W/t.log" | paste -sd" " -; command grep -E "^not ok" "$W/t.log"; FFS_DIR="$WT/server/public/scripts" node --test ffs-chain-button.test.mjs 2>&1 | command grep -E "^# (tests|pass|fail) " | paste -sd" " -; FFS_BUILD=beta node --test ffs-sort.test.mjs 2>&1 | command grep -E "^# (tests|pass|fail) " | paste -sd" " -
```

Expected: `# tests 20 # pass 20 # fail 0` and no `not ok` lines; then `# tests 26 # pass 26 # fail 0`; then `# tests 53 # pass 53 # fail 0`.

- [ ] **Step 6: Mutants.** Each changes one thing 2.73.914 adds, and the tests must catch every one.

Write `$W/mutants.mjs`:

```js
// Mutants of the worktree's beta: each changes one thing 2.73.914 added, and the tests must
// fail on every one. Each is a copy of the beta and its meta file in its own folder under
// $W/mut, tested in place of the real one through FFS_DIR.
// Usage: node mutants.mjs <worktree>
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
const wt = process.argv[2];
const scripts = path.join(wt, "server/public/scripts");
const src = fs.readFileSync(path.join(scripts, "ffs-banner-estimates-beta.user.js"), "utf8");
const meta = fs.readFileSync(path.join(scripts, "ffs-banner-estimates-beta.meta.js"), "utf8");
const MUTANTS = [
  ["the minute's answer not kept: every card asks Torn",
    "if (hit && (hit.pending || Date.now() - hit.at < FFS_MINI_HP_TTL_MS)) return hit.pending || hit.life;",
    "if (hit && hit.pending) return hit.pending;"],
  ["cards asking at once each make a call of their own",
    "if (hit && (hit.pending || Date.now() - hit.at < FFS_MINI_HP_TTL_MS)) return hit.pending || hit.life;",
    "if (hit && hit.life && Date.now() - hit.at < FFS_MINI_HP_TTL_MS) return hit.life;"],
  ["the percentage rounded, not floored", "let pct = Math.floor((cur / max) * 100);", "let pct = Math.round((cur / max) * 100);"],
  ["no line for a player who is down", "if (max <= 0 || cur < 0) return null;", "if (max <= 0 || cur <= 0) return null;"],
  ["a refusal does not stand Torn calls down",
    "_ffsRateLimitedUntil = Date.now() + FFS_RATE_LIMIT_BACKOFF_MS;\n        return null;\n      }\n      const life",
    "_ffsRateLimitedUntil = 0;\n        return null;\n      }\n      const life"],
  ["no cache-buster on the call", "/profile?striptags=true&timestamp=${Date.now()}&key=", "/profile?striptags=true&key="],
  ["the HP line added at the end, not right under the FF line", "        ff.after(el);\n", "        description.appendChild(el);\n"],
  ["the FF line still appended below an HP line drawn first",
    "if (description[0]) ffs_placeMiniLine(description[0], desc[0]);", "$(description).append(desc);"],
  ["drawing again adds a second HP line", "    for (const old of mini.querySelectorAll(\".ffs-mini-hp\")) old.remove();\n", ""],
  ["a closed card still gets the line", "if (!life || !mini.isConnected || ", "if (!life || "],
  ["a card now showing someone else still gets the line", " || get_player_id_in_element(mini) !== playerId) return;", ") return;"],
  ["the FF line waits for Torn's answer", "ffs_showMiniHp(mini, player_id).catch(() => {});", "await ffs_showMiniHp(mini, player_id);"],
];
let caught = 0;
MUTANTS.forEach(([name, from, to], i) => {
  if (src.split(from).length !== 2) throw new Error("not in the script exactly once: " + name);
  const dir = path.join(path.dirname(wt), "mut", `m${i + 1}`);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "ffs-banner-estimates-beta.user.js"), src.replace(from, to));
  fs.writeFileSync(path.join(dir, "ffs-banner-estimates-beta.meta.js"), meta);
  const run = spawnSync(process.execPath, ["--test", "ffs-mini-hp.test.mjs"],
    { cwd: path.join(wt, "server"), env: { ...process.env, FFS_DIR: dir }, encoding: "utf8" });
  const failed = [...run.stdout.matchAll(/^not ok \d+ - (.*)$/gm)].map((m) => m[1]);
  if (failed.length) caught += 1;
  console.log(`m${i + 1} ${failed.length ? "caught by " + failed.length : "MISSED"}: ${name}`
    + (failed.length ? ` (first: ${failed[0].slice(0, 60)})` : ""));
});
console.log(`${caught} of ${MUTANTS.length} caught`);
process.exit(caught === MUTANTS.length ? 0 : 1);
```

Run it:

```bash
W=/opt/warboard/.superpowers/sdd/2026-10-27-ffs-mini-profile-hp; node "$W/mutants.mjs" "$W/wt"
```

Expected:

```
m1 caught by 1: the minute's answer not kept: every card asks Torn (first: the same player again within a minute is free; a minute on, )
m2 caught by 1: cards asking at once each make a call of their own (first: two cards for one player while Torn is being asked share the)
m3 caught by 4: the percentage rounded, not floored (first: the HP line reads as the attack page does, with the percenta)
m4 caught by 1: no line for a player who is down (first: the percentage is floored, as on the attack page: 100% only )
m5 caught by 1: a refusal does not stand Torn calls down (first: a refusal stands every Torn call here down for a minute; oth)
m6 caught by 1: no cache-buster on the call (first: a card asks Torn once, for the profile, on the script key, w)
m7 caught by 1: the HP line added at the end, not right under the FF line (first: the HP line sits right under the FF line, above anything aft)
m8 caught by 1: the FF line still appended below an HP line drawn first (first: the FF line is placed with the HP line in mind)
m9 caught by 1: drawing again adds a second HP line (first: drawing again replaces the HP line instead of adding a secon)
m10 caught by 1: a closed card still gets the line (first: a card that has closed, or now shows someone else, gets no l)
m11 caught by 1: a card now showing someone else still gets the line (first: a card that has closed, or now shows someone else, gets no l)
m12 caught by 1: the FF line waits for Torn's answer (first: FFS asks for the HP when it first sees a mini profile, witho)
12 of 12 caught
```

- [ ] **Step 7: The whole suite in the worktree,** against the baseline's failing names:

```bash
uptime; W=/opt/warboard/.superpowers/sdd/2026-10-27-ffs-mini-profile-hp; WT=$W/wt; cd "$WT/server" && FFS_DIR="$WT/server/public/scripts" node --test > "$W/suite.log" 2>&1; command grep -E "^# (tests|pass|fail|skipped) " "$W/suite.log" | paste -sd" " -; command grep -E "^not ok" "$W/suite.log" | sed -E 's/^not ok [0-9]+ - //' | sort | diff "$W/base-fail-names.txt" - && echo "same failing names as the baseline"
```

Expected: `# tests` 20 more than the baseline's, `# skipped 2`, and `same failing names as the baseline`.

- [ ] **Step 8: Sweep what the branch adds:**

```bash
W=/opt/warboard/.superpowers/sdd/2026-10-27-ffs-mini-profile-hp; WT=$W/wt; cd "$WT" && git add -N -- server/ffs-mini-hp.test.mjs && git diff | command grep -E '^\+' > "$W/added.txt"; command grep -oE '(^|[^A-Za-z0-9])[A-Za-z0-9]{16}([^A-Za-z0-9]|$)' "$W/added.txt" | sort | uniq -c; node "$W/sweep-env.mjs" "$W/added.txt" && node "$W/sweep-names.mjs" "$W/added.txt"
```

Expected: the 16-character check lists only `isRateLimitError` and `querySelectorAll`, each with the character on either side of it: a function of the beta's and a DOM method. Then `sweep clean` and `names sweep clean`.

- [ ] **Step 9: Commit.**

```bash
W=/opt/warboard/.superpowers/sdd/2026-10-27-ffs-mini-profile-hp; cd "$W/wt" && git add -- server/ffs-mini-hp.test.mjs && git commit -q -m "ffs beta 2.73.914: mini profiles show the player's HP under the FF line" -m "One Torn call per player a minute at most, and none while Torn is refusing the key." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- server/ffs-mini-hp.test.mjs server/public/scripts/ffs-banner-estimates-beta.user.js server/public/scripts/ffs-banner-estimates-beta.meta.js && git status --short && git log --format='%h %s' -2 | cat
```

Expected: `?? server/node_modules`, then this commit and the plan's.

## Between Task 1 and Task 2: the final review

As superpowers:executing-plans says: the review package from the branch's merge base with main, and one fresh Opus reviewer given this plan, its Review Focus and the ledger's `Ruling:` lines. Then one fix pass for Critical and Important findings, each test-first, with the new tests and the whole suite (with `FFS_DIR` set) green after it. Minor findings go to the ledger and the report.

---

### Task 2: Release

- [ ] **Step 1: Pre-flight.** Note pm2's warboard pid; Step 4 checks it is unchanged.

```bash
uptime; W=/opt/warboard/.superpowers/sdd/2026-10-27-ffs-mini-profile-hp; WT=$W/wt; command grep -E "^Task 1: complete|^Final" "$W/progress.md"; git -C "$WT" status --short; cd "$WT/server" && node --test ffs-mini-hp.test.mjs > "$W/t.log" 2>&1; command grep -E "^# (tests|pass|fail) " "$W/t.log" | paste -sd" " -; pm2 pid warboard | tee "$W/pid-before"; cd /opt/warboard && git log --format='%h %s' main..ffs-mini-profile-hp | cat; git status --short -- server/ffs-mini-hp.test.mjs server/public/scripts/ffs-banner-estimates-beta.user.js server/public/scripts/ffs-banner-estimates-beta.meta.js
```

Expected: the load under 12; Task 1's `complete` line and the final review's lines; `?? server/node_modules`; `# tests 20 # pass 20 # fail 0`; warboard's pid, a number other than 0; Task 1's commit and any fix-pass commits; then nothing, because main's copies of the three paths are clean.

- [ ] **Step 2: Fast-forward main.** The served beta changes the moment the merge lands. Git writes the files as root, so give the served ones back to warboard:

```bash
cd /opt/warboard && git merge -q --ff-only ffs-mini-profile-hp && chown warboard:warboard server/public/scripts/ffs-banner-estimates-beta.user.js server/public/scripts/ffs-banner-estimates-beta.meta.js && chmod 644 server/public/scripts/ffs-banner-estimates-beta.user.js server/public/scripts/ffs-banner-estimates-beta.meta.js; git log --format='%h %s' -1 | cat; stat -c '%U:%G %a %n' server/public/scripts/ffs-banner-estimates-beta.user.js server/public/scripts/ffs-banner-estimates-beta.meta.js; git status --short -- server/ffs-mini-hp.test.mjs server/public/scripts/ffs-banner-estimates-beta.user.js server/public/scripts/ffs-banner-estimates-beta.meta.js
```

Expected: the branch's last commit as main's HEAD; both files `warboard:warboard 644`; then nothing. If the merge is refused, main has moved on. Then run `git -C "$W/wt" rebase main`, run Task 1 Steps 5 and 7 again, and repeat this step.

- [ ] **Step 3: The whole suite on main.** This is the gate `deploy.sh` runs, without its reload. A bare run is right here: on main, the chain button's tests read main's beta, which is now 2.73.914.

```bash
uptime; W=/opt/warboard/.superpowers/sdd/2026-10-27-ffs-mini-profile-hp; cd /opt/warboard/server && node --test > "$W/main-suite.log" 2>&1; command grep -E "^# (tests|pass|fail|skipped) " "$W/main-suite.log" | paste -sd" " -; command grep -E "^not ok" "$W/main-suite.log" | head
```

Expected: `# fail 0` and `# skipped 2`.

- [ ] **Step 4: Check what is served, and that nothing restarted:**

```bash
W=/opt/warboard/.superpowers/sdd/2026-10-27-ffs-mini-profile-hp; F=/opt/warboard/server/public/scripts/ffs-banner-estimates-beta; T=$(date +%s); curl -s "http://127.0.0.1:3000/scripts/ffs-banner-estimates-beta.meta.js?t=$T" | command grep '@version'; curl -s "https://tornwar.com/scripts/ffs-banner-estimates-beta.meta.js?t=$T" | command grep '@version'; curl -s "https://tornwar.com/scripts/ffs-banner-estimates-beta.meta.js" | command grep '@version'; curl -s "https://tornwar.com/scripts/ffs-banner-estimates-beta.user.js?t=$T" | sha256sum | cut -c1-12; sha256sum "$F.user.js" | cut -c1-12; curl -s "https://tornwar.com/scripts/ffs-banner-estimates.meta.js?t=$T" | command grep '@version'; echo "pid before $(cat "$W/pid-before") after $(pm2 pid warboard)"
```

Expected: `// @version      2.73.914` three times. The third is the plain address, which is what Tampermonkey's update check fetches. nginx sends it with `max-age=300`, so if it still says 2.73.913, check it again after 5 minutes, and report only once it says 2.73.914. Then the same 12 hex characters twice; then `// @version      2.73.61`, the stable copy, unchanged; then the same pid before and after.

- [ ] **Step 5: Push.** Sweep the lines this push adds, then push, with the remote's URL masked:

```bash
W=/opt/warboard/.superpowers/sdd/2026-10-27-ffs-mini-profile-hp; cd /opt/warboard && git log --format='%h %s' origin/main..main | cat && git diff origin/main..main | command grep -E '^\+' > "$W/added.txt"; command grep -oE '(^|[^A-Za-z0-9])[A-Za-z0-9]{16}([^A-Za-z0-9]|$)' "$W/added.txt" | sort | uniq -c; node "$W/sweep-env.mjs" "$W/added.txt" && node "$W/sweep-names.mjs" "$W/added.txt" && git push -q origin main 2>&1 | sed -E 's#//[^@]*@#//***@#g'; git log --format='%h' -1 origin/main
```

Expected: this plan's commit, Task 1's and any fix-pass commits, and no other session's; the 16-character check lists only `isRateLimitError` and `querySelectorAll`, as in Task 1; both sweeps clean; then origin/main at main's HEAD. A commit from another session: stop and ask before pushing it.

- [ ] **Step 6: Clean up.** Copy the ledger and the logs into this session's scratchpad directory, then remove the worktree's `node_modules` link, the worktree, the branch and the workspace:

```bash
W=/opt/warboard/.superpowers/sdd/2026-10-27-ffs-mini-profile-hp; S="$SCRATCHPAD/ffs-mini-hp-release"; mkdir -p "$S" && cp -r "$W/progress.md" "$W"/*.log "$S/" && rm "$W/wt/server/node_modules" && cd /opt/warboard && git worktree remove "$W/wt" && git branch -d ffs-mini-profile-hp && rm -r /opt/warboard/.superpowers/sdd/2026-10-27-ffs-mini-profile-hp && git worktree list | command grep -c ffs-mini-profile-hp
```

(`SCRATCHPAD` is the scratchpad directory the session's system prompt names.) Expected: `0`.

- [ ] **Step 7: Memory.**
  - `project_ffs_mini_profile_layout.md`: the beta's HP line, `div.ffs-mini-hp`, sits right under the FF line in `.description`, placed by `ffs_placeMiniLine`. Owed: the owner's check.
  - `reference_ffs_chain_button.md`: the beta is now 2.73.914. Promoting the beta must carry the HP line too, and `ffs-mini-hp.test.mjs` reads only the beta, so it needs the stable copy added then.
  - Edit both MEMORY.md lines in place.

- [ ] **Step 8: Report to the owner,** in a few short lines:
  - Mini profiles in the beta show `HP <current> / <max> (<pct>%)` under the FF line.
  - The URL: https://tornwar.com/scripts/ffs-banner-estimates-beta.user.js.
  - No warboard restart, so the chain was not touched.
  - Ask them to check, on phone and PC:
    - the line sits under the FF line and is not cut off;
    - the numbers match the attack page;
    - it shows with FactionOps off.
  - Then the rulings and deferred minors, as superpowers:executing-plans lists them.
