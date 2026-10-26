# Torn Ancient Ones 1.0.0 - Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A new userscript, Torn Ancient Ones 1.0.0, that shows where Torn's Halloween Ancient Ones are, in a small box on every Torn page. They are M'aol (NPC 23) and his five praetorians (NPCs 100 to 104). The box shows each one's country, life left, and whether it stands or is beaten, with an Attack link for each one that can be hit now. It says when M'aol can be hit, his route once known, and whether a flight by airstrip or BCT gets there before each one dies.

**Architecture:** One new script, `server/public/scripts/torn-ancient-ones.user.js`, with its `.meta.js`, tested in `server/torn-ancient-ones.test.mjs`.
- It reads the six NPCs' v2 profiles from Torn's API on the user's key, one after another, at most one sweep a minute across all tabs. It stores the reading in GM storage, with what changed and when, so every tab draws the same box.
- From the reading it works out M'aol's route: from his moves once he can be hit, or else from the order the praetorians fell, with defeat times from TornStats' public feed. It estimates when each standing one dies from its life over the last 10 minutes.
- The box is the script's own floating panel, orange, at the bottom left. It can be dragged, folded and closed, and it holds the key row.
- All work happens in a git worktree on a branch, because the main checkout is the tree tornwar.com serves. The release fast-forwards main, after a read-only live check of Torn's answers against TornStats'.

**Tech Stack:** a plain-JavaScript userscript (Tampermonkey, Torn PDA, the warboard apps). Tests use node:test and linkedom with a fake clock, timers, storage and network, and read the script from `TAO_SRC`. The live check runs the script in linkedom on this box, and its calls to Torn's API carry the owner's key in a header.

**Spec:** `docs/superpowers/specs/2026-10-26-torn-ancient-ones-design.md`. The owner approved it on 2026-10-26 at 07:28 EDT: "approved, write the plan". Their answers after that (07:38 to 07:54 EDT: M'aol's route, TornStats, where to fly) and two reads of Torn's API (08:15 and 08:48 EDT) amended it. The owner reviews those amendments with this plan, and this plan's commit says so in the spec's Status line. The owner's decisions are the spec's table, Q1 to Q8.

**Execution:** the owner chooses at the handoff, Subagent-driven or Native. Each task's brief stands on its own, and either way one fresh Opus reviewer checks the whole branch between Task 5 and Task 6. The live check (Task 6 Step 1) runs on this box and needs no one. The release, the push included, is a version boundary, which the owner's standing OK covers once the push's sweep is clean.

**Dry run:** all the code in this plan ran while the plan was written.
- Each task's script edits were replayed on the script as the task before leaves it, and rebuild the next stage byte for byte. The plan's code blocks were read back out of this file, and they rebuild every stage and the test file.
- Each task's tests ran against the stage before (the RED lines below) and the stage after (the GREEN lines).
- The mutant check (Task 5) caught 57 of 57.
- The live check's tool (Task 6) ran once at 12:49 TCT on Oct 26, on the script as it ships. It made six calls, and all six readings agreed with TornStats. The fixture tool's test from that run passed too: 93 of 93.

## Global Constraints

- **Name and owner:** @name `Torn Ancient Ones`, file `torn-ancient-ones.user.js`. @namespace and @author `RussianRob`. @license `All Rights Reserved`. No @copyright.
- **Version** `1.0.0`, in three places: `// @version`, `const VERSION`, and the CHANGELOG entry that starts `// v1.0.0  - First release.`. The console line on start carries it: `[Torn Ancient Ones 1.0.0] running`.
- **URLs:** @downloadURL `https://tornwar.com/scripts/torn-ancient-ones.user.js`, @updateURL `https://tornwar.com/scripts/torn-ancient-ones.meta.js`.
- **Where it runs:** @match `https://www.torn.com/*`, @run-at `document-idle`.
- **Grants:** @grant GM_getValue, GM_setValue, GM_xmlhttpRequest; @connect `api.torn.com` and `www.tornstats.com`. No menu entry: the Key button is in the box.
- **The `.meta.js`** is the header, byte for byte, then a newline: 17 lines.
- **Plain ASCII,** because PDA turns curly quotes into a syntax error.
- **Every `GM_*` call is guarded** with `typeof`.
- **`###PDA-APIKEY###` appears exactly once,** where PDA swaps in its key. A key saved in the box beats PDA's.
- **No password field** (a plain text field for the key), **no new tab** (no `target="_blank"`, no `window.open`), and nothing put in as HTML: all text is the script's own, or Torn's words as text.
- **Torn's API:** `https://api.torn.com/v2/user/<id>/profile?striptags=true&key=<key>&comment=ancient-ones`, the six one after another, M'aol first. At most one sweep a minute across all tabs, only while the page is visible (always in PDA), and never more than six calls a sweep.
- **TornStats:** `https://www.tornstats.com/ajax/status/maol`, a GET by GM_xmlhttpRequest with `anonymous: true` (no cookies) and no key. Where a host has no GM_xmlhttpRequest the script tries fetch, which TornStats' feed refuses to torn.com pages, so the read fails quietly. Only `hosped_at` is used. At most once every 5 minutes across all tabs, only while a beaten one has no time of TornStats', and only while the page is visible (always in PDA).
- **The key** goes only into the request to Torn. It never reaches the page, the console, the stored reading or an error message. The field's hint shows `************` and the key's last 4, never more.
- **Storage:** three keys, each a string of JSON or text: `torn-ancient-ones-key`, `torn-ancient-ones-reading`, `torn-ancient-ones-box`.
- **Torn's page:** the script adds one `<style>` (`tao-styles`), the box (`tao-box`) and the mark `data-torn-ancient-ones` on `<html>`. It never clicks, loads or changes anything of Torn's. Its links are plain links that open in the same tab.
- **Torn's API terms** are a table at the top of the script and in the key row, in the spec's words.
- **Times** in the box are TCT (UTC), as `HH:MM TCT`, with the date when it isn't today. Reports to the owner give EDT.
- **Comments:** clear `//` lines in the file's own style, with no version crumbs. Version notes go only in the CHANGELOG.
- **The repo is public:** no keys, key endings, player ids or member data in code, tests, plan or commits. The live check's output stays in this plan's git-ignored workspace, except the fixture test of Task 6 Step 1, which holds NPC fields only.
- **Served files** are `warboard:warboard 644`.
- **The script and its test file reach the main checkout together,** in the release's fast-forward. The test file's default `SRC` is the served path, `/opt/warboard/server/public/scripts/torn-ancient-ones.user.js`, which doesn't exist until then.
  - In the worktree, only `T` (which sets `TAO_SRC`) runs, never a bare `node --test`: the whole suite there would fail this file for want of the served script.
  - The whole suite runs once, in `/opt/warboard/server`, after the fast-forward.
- **Commits** name only this plan's paths: `git add -- <new paths>`, then `git commit -- <paths>`. Trailer: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **Torn's rules for the live check:** six calls to Torn's API on the owner's key, twelve if it runs twice, from this box. They are read-only, and run only while warboard's own use of that key is under 50 a minute. The key goes only in the Authorization header. Nothing on Torn is clicked or loaded for it.

## Review Focus

1. **M'aol's answer once he can be hit, or once he has died, hasn't been seen yet.** Torn may word it in a way the tests don't have. Whatever it says, the box must still work out whether he can be hit from the praetorians, show his line (with Torn's words as text when they don't fit), and never throw. Tests: "a country Torn doesn't fly to, or words the script doesn't know, come through as Torn's words", "an answer that isn't JSON, or JSON with no profile in it, is said in words" and "life at 0 is beaten whatever the words say..." (Task 1); "M'aol can be hit only when all five are down, whatever his own words say" and "Torn's words go in as text, never as HTML" (Task 2); Task 6 Step 1's live check, with its fixture test when he has a new shape.
2. **Torn's 30-second cache, and falls close together.** Two praetorians may fall within one sweep, or Torn may hand back an answer up to 30 s old, so the script's own fall times can be out of order. Then no route comes from the falls, and TornStats' times are asked for even when the script timed a fall. Tests: "no route from the falls when two came in one sweep, a country is missing, or two share one" and "TornStats is asked only while its time for a beaten one is missing, even one the script timed, and at most every 5 minutes across tabs" (Task 3); "a change gets the time of the reading that showed it only when the reading before was at most 3 minutes older" (Task 1).
3. **TornStats lagging, tying, revising or failing.** Its times can tie or sit a second apart, move by a second between reads, come from an earlier summoning, lie in the future, or not come at all. Ties under 30 s give no route, old or future times are not used, a bad answer changes nothing, and a request still out never holds up a sweep. Tests: "TornStats' times give the route from the falls, but two under 30 s apart give none", "a time from TornStats counts only when no more than 8 days old, not in the future, and not from before the script last saw it standing", "an answer from TornStats that can't be read, or none, changes nothing, and the next try is 5 minutes later", "a TornStats request still out doesn't hold up a sweep, and a sweep still out doesn't hold up TornStats" and "with no GM_xmlhttpRequest, TornStats can't be read, and nothing else changes" (Task 3).
4. **Torn PDA and the warboard apps.** PDA's web view misreports whether the page is visible, hands stored values back as strings, keeps GM values in a localStorage that can be full, and swaps its key into the file. The warboard app answers PDA's bridge but isn't PDA. Each must still read once a minute, keep a copy of its own when storage won't save, and never sweep twice. Tests: "a page out of view doesn't sweep, but Torn PDA does, and the warboard app counts as not PDA", "PDA's key is used when PDA swaps it in, a key saved on the device beats it, and with neither there are no calls" and the six storage tests from "the reading is stored as a string of JSON..." to "with no GM functions at all..." (Task 1); "TornStats is not asked from a page out of view, except in Torn PDA" (Task 3); "a key storage won't keep is not used, and the row says so" (Task 5).
5. **The device's clock.** It can be set back (a phone's clock put right), stops can run past midnight, and the summoning window has edges. A sweep time, a wait or a TornStats ask stored ahead of the clock must not stop the reads. A stop past midnight shows its date, and the summary is right either side of the window's edges. Tests: "a sweep time or a wait stored ahead of the clock (the clock was set back) doesn't stop the sweeps" (Task 1); "all asleep, by the window's edges: 10:00 TCT on Oct 26 to 23:59:59 TCT on Oct 31" (Task 2); "a TornStats ask stored ahead of the clock (the clock was set back) doesn't stop the asks" (Task 3); "M'aol: a stop that runs past midnight shows the date on its end" (Task 4).

## Rulings made at plan time

1. **The header, the description, the API terms and the CHANGELOG are final from Task 1.** Nothing is served before Task 6.
2. **All of the box's styles arrive in Task 2,** including those of Task 5's buttons and key row, so the styles live in one place and Task 5 adds none.
3. **`closed` arrives in Task 1,** because the sweep and its check read it, though only Task 5's Close button sets it.
4. **The test harness is written whole in Task 1:** the fake clock and timers, GM storage, the answers of Torn and TornStats, GM_xmlhttpRequest and fetch, visibility, and PDA's and the app's bridges. Later tasks only add tests.
5. **Wordings the spec doesn't give:**
   - "Couldn't read Torn." in the summary when Torn never answered;
   - "Next summoning possible now (48 h after M'aol's death)." once that time has passed inside the window;
   - "M'aol can be hit: <Torn's words>." when his country isn't known;
   - "All 5 praetorians down." when M'aol himself wasn't read;
   - the footer's "Torn won't take the key: <message>. Save a new key." and "Couldn't read Torn: <message>. Last answer N min ago.".
   Before the window, on its first day, the summary says "Summoning opens 10:00 TCT." without the date, by the spec's rule for times.
6. **TornStats is asked until its own time is known for every beaten one,** even when the script timed that fall itself, because the script's times are a sweep apart at best and Torn's cache can swap two close falls. If TornStats never gives a time, the ask goes on every 5 minutes. Each answer's times replace the ones before, so a time TornStats moves by a second is taken. Either way two falls a second apart stay inside the 30 s, and give no route.
7. **The death estimate counts from the newest reading,** not from now, so a sweep that stalls doesn't push it later.
8. **For M'aol, a flight must land at least 2 minutes before he leaves a country.** He should die no sooner than 2 minutes after the catch, or the note says `too late`. His own `dies about` note shows above the two flight notes. Once the newest reading shows him more than 17 minutes in one country, there are no flight notes for him.
9. **His trail grows only while he can be hit.** While shielded he goes round only the beaten ones' countries, so the order of first sightings across that change isn't his route.
10. **Lines are built again only when what they say changes:** the box keeps the last lines it drew, as JSON, and rebuilds them only when the new ones differ. With an estimate showing, that is about once a minute.
11. **Three of the new tests pass on the stage before their task:** Task 3's "no route from the falls when two came in one sweep, a country is missing, or two share one", and Task 4's "no note for one beaten, or standing where no flight goes" and "M'aol: nothing on where to fly without his route, or without a time for his arrival". Each checks that nothing shows, which holds before the code exists. They stay, to pin that nothing shows once it does.
12. **A clock set back is guarded where it would stop the reads:** a stored sweep time, wait or TornStats ask ahead of the clock doesn't stop them (two tests and mutants M55 to M57). The highlight, the 3-minute rule and the life history also ignore times ahead of the clock.
13. **A summoning that starts and ends while no tab is reading** keeps the earlier summoning's times, and may say a new summoning is possible when it isn't. The spec names this under "Not in this version".
14. **The mutant check and the live check's tools stay in this plan's git-ignored workspace,** never committed, and so does the live check's output.
15. **The work is in a git worktree** on branch `torn-ancient-ones`, inside this plan's workspace, because the main checkout is what tornwar.com serves. Each task commits there, and Task 6 fast-forwards main.
16. **The final review runs between Task 5 and Task 6,** so nothing unreviewed is served. The live check runs after the review's fix pass, on the script as it will ship.

## Files

- Create: `server/public/scripts/torn-ancient-ones.user.js` (Task 1; edited in Tasks 2 to 5).
- Create: `server/public/scripts/torn-ancient-ones.meta.js` (Task 1).
- Create: `server/torn-ancient-ones.test.mjs` (Task 1; extended in Tasks 2 to 5, and in Task 6 when M'aol has a new shape).
- Modify: `docs/superpowers/specs/2026-10-26-torn-ancient-ones-design.md`, in this plan's own commit: its Status line, and the amendments from the 08:48 EDT read.
- Outside the repo, in the workspace `/opt/warboard/.superpowers/sdd/2026-10-26-torn-ancient-ones/` (git-ignored):
  - `mutants.mjs` and `mut/`: the mutant check (Task 5);
  - `live/live.mjs` and `live/fixture.mjs`: the live check (Task 6), and `live/out*/`, what it found;
  - `suite.log` and `push-added.txt`: the whole suite's output and the push's added lines (Task 6).

## Paths and commands

- **`W` is the workspace,** `/opt/warboard/.superpowers/sdd/2026-10-26-torn-ancient-ones`. **`WT` is the worktree,** `$W/wt`. Every command sets them, because shell variables don't carry from one command to the next.
- **The superpowers scripts** (`task-start`, `task-done`, `review-package`) run from inside `$WT`, so their `git rev-parse HEAD` is the branch's. Their ledger and briefs live in the worktree's own git-ignored `.superpowers/sdd/`.
- **The symlink:** `server/node_modules` in the worktree is a symlink to the main checkout's. Git sees it as untracked (`server/.gitignore` has `node_modules/`, which matches directories only), so commits always name their paths and never use `git add -A`.
- **`T`, the test run:**

```bash
WT=/opt/warboard/.superpowers/sdd/2026-10-26-torn-ancient-ones/wt; cd "$WT/server" && TAO_SRC="$WT/server/public/scripts/torn-ancient-ones.user.js" node --test torn-ancient-ones.test.mjs 2>&1 | grep -E "^# (tests|pass|fail) " | paste -sd" " -
```

- **`C`, the source check** (it parses, and it is plain ASCII):

```bash
WT=/opt/warboard/.superpowers/sdd/2026-10-26-torn-ancient-ones/wt; F="$WT/server/public/scripts/torn-ancient-ones.user.js"; node --check "$F" && LC_ALL=C grep -c '[^ -~]' "$F" | grep -qx 0 && echo ascii-ok
```

## Setup (before Task 1)

- [ ] **Check the load and the workspace's files.** They were put there at plan time, and the hashes are theirs:

```bash
uptime; W=/opt/warboard/.superpowers/sdd/2026-10-26-torn-ancient-ones; cd "$W" && sha256sum mutants.mjs live/live.mjs live/fixture.mjs
```

Expected: load under 12, then:

```
c5fe3a30253ac729bb87f2892a8fd2c674bc18515cb6a152742ace8a202bb84c  mutants.mjs
c478d0024e627ec6a4cf9242bda3a50ad68c747d610023efcae9814749cadcce  live/live.mjs
34bb88be47168d095b999f40fdc3afbba490de96730f7c927cf95fc83a481a00  live/fixture.mjs
```

- If the load is over 12, wait.
- If a file is missing or its hash differs, write it again from its block (Task 5 Step 5, Task 6 Step 1) and check the hash again.

- [ ] **Make the worktree** from this plan's commit on main:

```bash
WT=/opt/warboard/.superpowers/sdd/2026-10-26-torn-ancient-ones/wt; cd /opt/warboard && git worktree add "$WT" -b torn-ancient-ones main && ln -s /opt/warboard/server/node_modules "$WT/server/node_modules" && git -C "$WT" log --format='%h %s' -1 && git -C "$WT" status --short && cd "$WT/server" && node -e "import('linkedom').then(() => console.log('linkedom-ok'))"
```

Expected: the branch's tip is this plan's commit; status shows only `?? server/node_modules`; then `linkedom-ok`. There is no baseline run: the script and its tests don't exist yet.

---

### Task 1: Reading Torn, storage and the sweep

**Files:**
- Create: `server/public/scripts/torn-ancient-ones.user.js`
- Create: `server/public/scripts/torn-ancient-ones.meta.js`
- Create (tests): `server/torn-ancient-ones.test.mjs`

**Interfaces:**
- Consumes: nothing; the script is new.
- Produces, inside the script's one function (later tasks use these names):
  - constants: `VERSION`, `root` (`document.documentElement`), `MAOL` (23), `PRAETORIANS` (`[100, 101, 102, 103, 104]`), `IDS` (M'aol first), `COUNTRIES` (Torn's eleven abroad, nearest first), `TORN_CITY`, `SWEEP_EVERY_MS`, `TICK_MS`, `BACK_OFF_MS`, `TIMED_GAP_MS`, `KEY_CODES`, `WAIT_CODES`, `KEY_STORE`, `READING_STORE`, `BOX_STORE`, `PDA_KEY`, `HAS_PDA_KEY`, `IS_WARBOARD`, `IS_PDA`, `STATES`;
  - storage: `gmGet(name) -> string`, `gmSet(name, value) -> boolean`, `saveChecked(name, value) -> boolean`, `apiKey() -> string` (`''` for none);
  - the reading: `parseReading(v) -> reading`, `readNpc(n) -> npc`, `readReading() -> reading`, `writeReading(r)`, and `tabCopy`. A reading is `{ at, okAt, error, wait, stop, npcs }`, with `npcs` by id. An npc is `{ name, state, place, words, cur, max, readAt, since, changedAt }`, where `state` is `'up'`, `'beaten'`, `'dormant'` or `'unknown'`. Task 3 adds `trail`, `fell` and `fellAskedAt` to the reading and `upAt` to an npc; Task 4 adds `hist` to an npc;
  - Torn's answer: `readProfile(p) -> { name, state, place, words, cur, max }`, `placeOf(words, state) -> string`, `down(n) -> boolean`, `hittable(npcs) -> boolean`, `applyProfile(r, id, seen, nowMs)`;
  - asking Torn: `sweeping`, `closed`, `sweepDue(nowMs) -> boolean`, `sweep(key, nowMs)`, `askTorn(key, id) -> Promise` (resolves with Torn's profile, rejects with `{ code, message }`), `get(url) -> Promise<string>`, `hideKey(text, key) -> string`, `tick()`.
- Produces, in the test file (Tasks 2 to 5 add their tests at its end and use these):
  - `SRC`, `META`, `RUNNING`, `KEY_STORE`, `READING_STORE`, `BOX_STORE`, `KEY`, `PDA_KEY`, `TORNSTATS`, `T0` (10:40 TCT on Oct 26), `SEC`, `MIN`, `IDS`, `COUNTRIES`, `READ_1125`, `READ_1215`;
  - `profile(id, description, current, { state, max })`, `up(id, place, current)`, `beaten(id, place)`, `allBeaten(maolWords, maolLife)`, `flush()`;
  - `device({ store, torn, tornstats }) -> env`, with `env.tab(opts)`, `env.advance(ms)`, `env.release()`, `env.hold`, `env.torn`, `env.tornError`, `env.tornstats`, `env.store`, `env.now`, `env.requests`, `env.torns()`, `env.stats()` and `env.reading()`;
  - `tab(env, { visible, pda, pdaKey, app, gm, xhr, getValue, setValue, width, height }) -> w`, with `w.run()`, `w.show()`, `w.hide()`, `w.fire(type, e)`, `w.document`, `w.win` and `w.logs`;
  - `started(opts, tabOpts) -> { env, w }`, `seen(env)` (`[state, place, whole % of life]` by id) and `askedIds(env)`.

- [ ] **Step 1: Write the failing tests.** Create `server/torn-ancient-ones.test.mjs`:

```js
// Torn Ancient Ones: where M'aol and his five praetorians are, in a small box on Torn pages.
// These tests load the real script into hand-built Torn pages, with the clock, the timers, GM
// storage, the answers from Torn and TornStats, the window and the console under their control.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseHTML } from 'linkedom';

// TAO_SRC lets a mutant copy be tested in place of the served file.
const SRC = process.env.TAO_SRC || '/opt/warboard/server/public/scripts/torn-ancient-ones.user.js';
const META = SRC.replace(/\.user\.js$/, '.meta.js');
const RUNNING = '[Torn Ancient Ones 1.0.0] running';
const KEY_STORE = 'torn-ancient-ones-key';
const READING_STORE = 'torn-ancient-ones-reading';
const BOX_STORE = 'torn-ancient-ones-box';
// Made-up keys. Torn's are 16 characters; these are shorter on purpose.
const KEY = 'TestKey0000wxyz';
const PDA_KEY = 'PdaKeyFromPDA12';
const TORNSTATS = 'https://www.tornstats.com/ajax/status/maol';
// 10:40 TCT on 26 October 2026, 40 minutes into the summoning window.
const T0 = Date.UTC(2026, 9, 26, 10, 40);
const SEC = 1000;
const MIN = 60 * SEC;
const IDS = [23, 100, 101, 102, 103, 104];
const COUNTRIES = ['Mexico', 'Cayman Islands', 'Canada', 'Hawaii', 'United Kingdom', 'Argentina',
  'Switzerland', 'Japan', 'China', 'UAE', 'South Africa'];

// The six as Torn's API gave them on 2026-10-26, NPC fields only. At 11:25 TCT M'aol was shielded
// in Torn City, with one praetorian beaten; at 12:15 TCT he was shielded in the Cayman Islands,
// with three beaten.
const READ_1125 = {
  23: {"id":23,"name":"M'aol","role":"NPC","status":{"description":"Awoken","details":null,"state":"Awoken","color":"green","until":null},"life":{"current":151200000,"maximum":151200000},"last_action":{"status":"Online","timestamp":1793008800,"relative":"1 hour ago"}},
  100: {"id":100,"name":"Dyno'salam","role":"NPC","status":{"description":"Awoken in Cayman Islands","details":null,"state":"Abroad","color":"blue","until":null},"life":{"current":57759744,"maximum":172500000},"last_action":{"status":"Online","timestamp":1793008800,"relative":"1 hour ago"}},
  101: {"id":101,"name":"Nol'dasaym","role":"NPC","status":{"description":"Dormant in Mexico","details":null,"state":"Abroad","color":"blue","until":null},"life":{"current":0,"maximum":129600000},"last_action":{"status":"Offline","timestamp":1793008800,"relative":"1 hour ago"}},
  102: {"id":102,"name":"Asmol'yand","role":"NPC","status":{"description":"Awoken in Canada","details":null,"state":"Abroad","color":"blue","until":null},"life":{"current":194583588,"maximum":217800000},"last_action":{"status":"Online","timestamp":1793008800,"relative":"1 hour ago"}},
  103: {"id":103,"name":"Sylo'nadam","role":"NPC","status":{"description":"Awoken in Hawaii","details":null,"state":"Abroad","color":"blue","until":null},"life":{"current":202949730,"maximum":202950000},"last_action":{"status":"Online","timestamp":1793008800,"relative":"1 hour ago"}},
  104: {"id":104,"name":"Ladso'myna","role":"NPC","status":{"description":"Awoken in United Kingdom","details":null,"state":"Abroad","color":"blue","until":null},"life":{"current":119606777,"maximum":222000000},"last_action":{"status":"Online","timestamp":1793008800,"relative":"1 hour ago"}},
};
const READ_1215 = {
  23: {"id":23,"name":"M'aol","role":"NPC","status":{"description":"Awoken in Cayman Islands","details":null,"state":"Abroad","color":"blue","until":null},"life":{"current":151200000,"maximum":151200000},"last_action":{"status":"Online","timestamp":1793008800,"relative":"2 hours ago"}},
  100: {"id":100,"name":"Dyno'salam","role":"NPC","status":{"description":"Dormant in Cayman Islands","details":null,"state":"Abroad","color":"blue","until":null},"life":{"current":0,"maximum":172500000},"last_action":{"status":"Offline","timestamp":1793008800,"relative":"2 hours ago"}},
  101: {"id":101,"name":"Nol'dasaym","role":"NPC","status":{"description":"Dormant in Mexico","details":null,"state":"Abroad","color":"blue","until":null},"life":{"current":0,"maximum":129600000},"last_action":{"status":"Offline","timestamp":1793008800,"relative":"2 hours ago"}},
  102: {"id":102,"name":"Asmol'yand","role":"NPC","status":{"description":"Awoken in Canada","details":null,"state":"Abroad","color":"blue","until":null},"life":{"current":120751439,"maximum":217800000},"last_action":{"status":"Online","timestamp":1793008800,"relative":"2 hours ago"}},
  103: {"id":103,"name":"Sylo'nadam","role":"NPC","status":{"description":"Awoken in Hawaii","details":null,"state":"Abroad","color":"blue","until":null},"life":{"current":199916612,"maximum":202950000},"last_action":{"status":"Online","timestamp":1793008800,"relative":"2 hours ago"}},
  104: {"id":104,"name":"Ladso'myna","role":"NPC","status":{"description":"Dormant in United Kingdom","details":null,"state":"Abroad","color":"blue","until":null},"life":{"current":0,"maximum":222000000},"last_action":{"status":"Offline","timestamp":1793008800,"relative":"2 hours ago"}},
};

// A profile in the shape Torn's v2 API gives: the name, the words, the life. state is Torn's
// status.state: by default "Abroad" when the words name a place, else the words' first word.
// max defaults to that one's real maximum life.
function profile(id, description, current, { state, max } = {}) {
  const real = READ_1125[id];
  return {
    id, name: real.name, role: 'NPC',
    status: { description, details: null, state: state || (/ in /.test(description) ? 'Abroad' : description.split(' ')[0]), color: 'blue', until: null },
    life: { current, maximum: max || real.life.maximum },
  };
}
const up = (id, place, current) => profile(id, place === 'Torn City' ? 'Awoken' : 'Awoken in ' + place, current === undefined ? READ_1125[id].life.maximum : current);
const beaten = (id, place) => profile(id, 'Dormant in ' + place, 0);
// The six with every praetorian beaten where it stood on 2026-10-26, and M'aol standing where given.
function allBeaten(maolWords = 'Awoken in Mexico', maolLife = 151200000) {
  return {
    23: profile(23, maolWords, maolLife),
    100: beaten(100, 'Cayman Islands'), 101: beaten(101, 'Mexico'), 102: beaten(102, 'Canada'),
    103: beaten(103, 'Hawaii'), 104: beaten(104, 'United Kingdom'),
  };
}

// Lets every answer that is due reach the script: answers come back as promise jobs, and
// setImmediate runs only once those are all done.
const flush = () => new Promise((resolve) => setImmediate(resolve));

// linkedom lays nothing out. Every element is 300 by 200; the box sits where its style puts it,
// or 20 px from the bottom left of its window when its style doesn't say.
const tabOf = new WeakMap();
parseHTML('<!doctype html><html></html>').HTMLElement.prototype.getBoundingClientRect = function () {
  const w = tabOf.get(this.ownerDocument);
  const width = 300;
  const height = 200;
  const left = this.style && this.style.left ? parseFloat(this.style.left) : 20;
  const top = this.style && this.style.top ? parseFloat(this.style.top) : (w ? w.win.innerHeight : 800) - 20 - height;
  return { x: left, y: top, left, top, width, height, right: left + width, bottom: top + height };
};

// One device: its clock, its timers, its GM storage, and the answers Torn and TornStats give,
// shared by every tab on it.
// - env.torn: the profile Torn gives for each id; { error: { code, error } } is Torn's error,
//   { raw } is that text as it is, and null is no answer. env.tornError, when set, is Torn's
//   error for every call.
// - env.tornstats: TornStats' feed: a list, a text, or null for no answer.
// - env.hold: true holds back every answer, 'torn' or 'tornstats' only theirs, until
//   env.release().
// - env.requests: every request, in order.
// - env.advance(ms): moves the clock on, running each timer when it is due, and every answer.
function device({ store = {}, torn = READ_1125, tornstats = [] } = {}) {
  const env = { now: T0, store, torn: { ...torn }, tornError: null, tornstats, hold: false, held: [], requests: [], timers: [], seq: 0 };
  env.advance = async (ms) => {
    const end = env.now + ms;
    await flush();
    for (;;) {
      const due = env.timers.filter((t) => t.at <= end).sort((a, b) => a.at - b.at || a.seq - b.seq)[0];
      if (!due) break;
      env.now = due.at;
      if (due.every) due.at += due.every;
      else env.timers.splice(env.timers.indexOf(due), 1);
      due.fn();
      await flush();
    }
    env.now = end;
    await flush();
  };
  env.release = async () => {
    const held = env.held;
    env.held = [];
    held.forEach((answer) => answer());
    await flush();
  };
  env.tab = (opts) => tab(env, opts);
  env.torns = () => env.requests.filter((r) => r.url.startsWith('https://api.torn.com/'));
  env.stats = () => env.requests.filter((r) => r.url.startsWith('https://www.tornstats.com/'));
  env.reading = () => JSON.parse(env.store[READING_STORE]);
  return env;
}

// Torn's or TornStats' answer to a request, as text, or null for no answer.
function answerText(env, url) {
  const torn = /^https:\/\/api\.torn\.com\/v2\/user\/(\d+)\/profile\?/.exec(url);
  if (torn) {
    if (env.tornError) return JSON.stringify({ error: env.tornError });
    const p = env.torn[torn[1]];
    if (p === null || p === undefined) return null;
    if (p.raw !== undefined) return p.raw;
    return JSON.stringify(p.error ? p : { profile: p });
  }
  if (url === TORNSTATS && env.tornstats !== null) return typeof env.tornstats === 'string' ? env.tornstats : JSON.stringify(env.tornstats);
  return null;
}

// Sends an answer now (as a promise job) or holds it, as env.hold says.
function answerLater(env, url, answer) {
  const which = url.startsWith('https://api.torn.com/') ? 'torn' : 'tornstats';
  if (env.hold === true || env.hold === which) env.held.push(answer);
  else Promise.resolve().then(answer);
}

// A Torn page (a tab) on the device, with the script ready to run. Options:
// - visible: whether the page is in view (default true); w.show() and w.hide() change it as
//   the browser does;
// - pda: Torn PDA's bridge on the window, and PDA's key in place of the placeholder (pdaKey,
//   '' for none); app: the warboard app's gmBridge handler, with PDA's bridge too, as the app
//   answers it;
// - gm: false takes every GM_* function away; xhr: false only GM_xmlhttpRequest (then the
//   script asks by fetch); getValue and setValue change how storage reads and writes go;
// - width and height: the window's size.
function tab(env, { visible = true, pda = false, pdaKey, app = false, gm = true, xhr = true, getValue, setValue, width = 1280, height = 800 } = {}) {
  const dom = parseHTML('<!doctype html><html><head></head><body><div id="mainContainer"><div class="content-wrapper">Torn</div></div></body></html>');
  const doc = dom.document;
  const w = { env, dom, document: doc, logs: [], visible, listeners: {} };
  tabOf.set(doc, w);
  Object.defineProperty(doc, 'visibilityState', { configurable: true, get: () => (w.visible ? 'visible' : 'hidden') });
  w.win = {
    innerWidth: width,
    innerHeight: height,
    addEventListener: (type, fn) => { (w.listeners[type] = w.listeners[type] || []).push(fn); },
    removeEventListener: (type, fn) => { w.listeners[type] = (w.listeners[type] || []).filter((f) => f !== fn); },
  };
  if (pda || app) w.win.flutter_inappwebview = { callHandler: () => Promise.resolve() };
  if (app) w.win.webkit = { messageHandlers: { gmBridge: { postMessage() {} } } };
  // An event on the window, as the browser would send it.
  w.fire = (type, e = {}) => (w.listeners[type] || []).slice().forEach((fn) => fn(e));
  w.show = () => { w.visible = true; doc.dispatchEvent(new dom.Event('visibilitychange')); };
  w.hide = () => { w.visible = false; doc.dispatchEvent(new dom.Event('visibilitychange')); };
  let src = readFileSync(SRC, 'utf8');
  const swapped = pdaKey === undefined ? (pda ? PDA_KEY : '') : pdaKey;
  if (swapped) src = src.split('###PDA-APIKEY###').join(swapped);
  const has = (k) => Object.prototype.hasOwnProperty.call(env.store, k);
  const getV = getValue ? (k, d) => getValue(env.store, k, d) : (k, d) => (has(k) ? env.store[k] : d);
  const setV = setValue ? (k, v) => setValue(env.store, k, v) : (k, v) => { env.store[k] = v; };
  const xhrFn = (o) => {
    env.requests.push({ url: o.url, method: o.method, anonymous: o.anonymous, headers: o.headers, via: 'xhr', tab: w });
    answerLater(env, o.url, () => {
      const text = answerText(env, o.url);
      if (text === null) o.onerror({ status: 0 });
      else o.onload({ status: 200, responseText: text });
    });
  };
  // fetch reaches Torn, but not TornStats, whose feed doesn't let torn.com pages read it.
  const fetchFn = (url, init) => {
    env.requests.push({ url, credentials: init && init.credentials, via: 'fetch', tab: w });
    return new Promise((resolve, reject) => answerLater(env, url, () => {
      const text = url.startsWith('https://api.torn.com/') ? answerText(env, url) : null;
      if (text === null) reject(new TypeError('Failed to fetch'));
      else resolve({ ok: true, status: 200, text: () => Promise.resolve(text) });
    }));
  };
  const add = (fn, ms, every) => {
    const t = { id: ++env.seq, seq: env.seq, at: env.now + Math.max(0, ms || 0), every: every ? Math.max(1, ms) : 0, fn, tab: w };
    env.timers.push(t);
    return t.id;
  };
  const clear = (id) => { env.timers = env.timers.filter((t) => t.id !== id); };
  class FakeDate extends Date {
    constructor(...a) { super(...(a.length ? a : [env.now])); }
    static now() { return env.now; }
  }
  const con = { log: (...a) => w.logs.push(a.join(' ')), warn: (...a) => w.logs.push(a.join(' ')), error: (...a) => w.logs.push(a.join(' ')) };
  w.run = () => {
    new Function('window', 'document', 'GM_getValue', 'GM_setValue', 'GM_xmlhttpRequest', 'fetch', 'setInterval', 'clearInterval', 'setTimeout', 'clearTimeout', 'Date', 'console', src)(
      w.win, doc, gm ? getV : undefined, gm ? setV : undefined, gm && xhr ? xhrFn : undefined, fetchFn,
      (fn, ms) => add(fn, ms, true), clear, (fn, ms) => add(fn, ms, false), clear, FakeDate, con);
    return w;
  };
  return w;
}

// A device with the key saved, and one tab on it that has run the script and read Torn once.
async function started(opts = {}, tabOpts = {}) {
  const env = device(opts);
  env.store[KEY_STORE] = KEY;
  const w = env.tab(tabOpts).run();
  await env.advance(0);
  return { env, w };
}

// What the script stored of each of the six: [state, place, whole % of life left] by id.
function seen(env) {
  const r = env.reading();
  const out = {};
  for (const id of IDS) {
    const n = r.npcs[id];
    out[id] = n ? [n.state, n.place, n.max ? Math.floor((100 * n.cur) / n.max) : null] : null;
  }
  return out;
}

// The id each Torn request asked for, in order.
const askedIds = (env) => env.torns().map((r) => Number(/\/user\/(\d+)\//.exec(r.url)[1]));

// ---------------------------------------------------------------------------------------------
// The source
// ---------------------------------------------------------------------------------------------

test('the header is the spec\'s, and the meta file is the header and a newline', () => {
  const src = readFileSync(SRC, 'utf8');
  const end = '// ==/UserScript==';
  const header = src.slice(0, src.indexOf(end) + end.length) + '\n';
  assert.equal(readFileSync(META, 'utf8'), header);
  const tags = header.split('\n').filter((l) => l.startsWith('// @')).map((l) => l.slice(4).replace(/\s+/, ' '));
  assert.deepEqual(tags, [
    'name Torn Ancient Ones',
    'namespace RussianRob',
    'version 1.0.0',
    'description Where Torn\'s Halloween Ancient Ones are (M\'aol and his five praetorians), in a small box on Torn pages: country, life left, standing or beaten, an attack link, when M\'aol can be hit and his route, and where to fly by airstrip or BCT. It needs a Public API key; Torn PDA gives its own.',
    'author RussianRob',
    'downloadURL https://tornwar.com/scripts/torn-ancient-ones.user.js',
    'updateURL https://tornwar.com/scripts/torn-ancient-ones.meta.js',
    'license All Rights Reserved',
    'match https://www.torn.com/*',
    'run-at document-idle',
    'grant GM_getValue',
    'grant GM_setValue',
    'grant GM_xmlhttpRequest',
    'connect api.torn.com',
    'connect www.tornstats.com',
  ]);
  assert.match(src, /\n\/\/ TORN'S API TERMS\n/);
  assert.match(src, /\n\/\/ Data Sharing {11}None\. The script also reads TornStats' public feed of the six, and sends\n/);
  assert.match(src, /\n\/\/ Key Access Level {7}Public\.\n/);
  assert.match(src, /\n  const VERSION = '1\.0\.0';\n/);
  assert.match(src, /\n\/\/ CHANGELOG\n/);
  assert.match(src, /\n\/\/ v1\.0\.0  - First release\./);
});

test('the source is plain ASCII, guards every GM_* call, holds PDA\'s placeholder once, and has no password field, new tab or HTML put in', () => {
  const src = readFileSync(SRC, 'utf8');
  assert.equal(/[^\x00-\x7f]/.test(src), false, 'plain ASCII');
  const lines = src.split('\n');
  lines.forEach((line, i) => {
    if (line.trim().startsWith('//')) return;
    for (const m of line.matchAll(/\b(GM_\w+)\(/g)) {
      const guard = 'typeof ' + m[1];
      assert.ok(line.includes(guard) || (lines[i - 1] || '').includes(guard) || (lines[i - 2] || '').includes(guard), 'line ' + (i + 1) + ' guards ' + m[1]);
    }
  });
  assert.equal(src.split('###PDA-APIKEY###').length - 1, 1);
  assert.equal(/['"]password['"]/i.test(src), false);
  assert.equal(/_blank|window\.open/.test(src), false);
  assert.equal(/innerHTML|outerHTML|insertAdjacentHTML|document\.write/.test(src), false);
});

test('it says once in the console that it is running, and a second copy on the same page does nothing', async () => {
  const { env, w } = await started();
  assert.equal(w.document.documentElement.getAttribute('data-torn-ancient-ones'), '1.0.0');
  w.run();
  await env.advance(0);
  assert.deepEqual(w.logs, [RUNNING]);
  assert.deepEqual(askedIds(env), IDS);
});

// ---------------------------------------------------------------------------------------------
// Reading Torn's answer
// ---------------------------------------------------------------------------------------------

test('the six as Torn gave them at 11:25 TCT read as they were: M\'aol shielded in Torn City, one praetorian beaten', async () => {
  const { env } = await started({ torn: READ_1125 });
  assert.deepEqual(seen(env), {
    23: ['up', 'Torn City', 100],
    100: ['up', 'Cayman Islands', 33],
    101: ['beaten', 'Mexico', 0],
    102: ['up', 'Canada', 89],
    103: ['up', 'Hawaii', 99],
    104: ['up', 'United Kingdom', 53],
  });
  const r = env.reading();
  assert.equal(r.npcs[23].name, 'M\'aol');
  assert.equal(r.npcs[100].words, 'Awoken in Cayman Islands');
  assert.equal(r.npcs[100].cur, 57759744);
  assert.equal(r.npcs[100].max, 172500000);
});

test('the six as Torn gave them at 12:15 TCT read as they were: M\'aol shielded in the Cayman Islands, three beaten', async () => {
  const { env } = await started({ torn: READ_1215 });
  assert.deepEqual(seen(env), {
    23: ['up', 'Cayman Islands', 100],
    100: ['beaten', 'Cayman Islands', 0],
    101: ['beaten', 'Mexico', 0],
    102: ['up', 'Canada', 55],
    103: ['up', 'Hawaii', 98],
    104: ['beaten', 'United Kingdom', 0],
  });
});

test('life at 0 is beaten whatever the words say, and Dormant with life left is dormant', async () => {
  const { env } = await started({ torn: { ...READ_1125, 100: profile(100, 'Awoken in Cayman Islands', 0), 102: profile(102, 'Dormant in Canada', 108900000) } });
  assert.deepEqual(seen(env)[100], ['beaten', 'Cayman Islands', 0]);
  assert.deepEqual(seen(env)[102], ['dormant', 'Canada', 50]);
});

test('each of Torn\'s eleven countries abroad is read, in any letter case', async () => {
  for (const country of COUNTRIES.concat(['united kingdom', 'CAYMAN ISLANDS'])) {
    const { env } = await started({ torn: { ...READ_1125, 100: up(100, country) } });
    assert.equal(seen(env)[100][1], COUNTRIES.find((c) => c.toLowerCase() === country.toLowerCase()), country);
  }
});

test('a country Torn doesn\'t fly to, or words the script doesn\'t know, come through as Torn\'s words', async () => {
  const { env } = await started({ torn: { ...READ_1125, 100: profile(100, 'Awoken in Atlantis', 1000), 102: profile(102, 'Sleeping <b>soundly</b>', 1000, { state: 'Okay' }) } });
  const r = env.reading();
  assert.deepEqual([r.npcs[100].state, r.npcs[100].place, r.npcs[100].words], ['up', '', 'Awoken in Atlantis']);
  assert.deepEqual([r.npcs[102].state, r.npcs[102].words], ['unknown', 'Sleeping <b>soundly</b>']);
});

test('with no country in the words, Torn City unless Torn\'s state says abroad or flying', async () => {
  const { env } = await started({ torn: { ...READ_1125, 100: profile(100, 'Awoken', 1000, { state: 'Abroad' }), 102: profile(102, 'Awoken', 1000, { state: 'Traveling' }), 103: profile(103, 'Awoken', 1000, { state: 'Okay' }) } });
  assert.deepEqual([seen(env)[23][1], seen(env)[100][1], seen(env)[102][1], seen(env)[103][1]], ['Torn City', '', '', 'Torn City']);
});

test('the words decide before Torn\'s state does, and the state decides when the words don\'t say', async () => {
  const { env } = await started({ torn: { ...READ_1125, 100: profile(100, 'Something', 1000, { state: 'Dormant' }), 102: profile(102, 'Awoken in Canada', 1000, { state: 'Dormant' }) } });
  assert.equal(seen(env)[100][0], 'dormant');
  assert.equal(seen(env)[102][0], 'up');
});

// ---------------------------------------------------------------------------------------------
// Times
// ---------------------------------------------------------------------------------------------

test('a change gets the time of the reading that showed it only when the reading before was at most 3 minutes older', async () => {
  const { env, w } = await started();
  let r = env.reading();
  assert.equal(r.npcs[100].since, 0, 'nothing changed at the first reading');
  assert.equal(r.npcs[100].changedAt, 0);
  env.torn[100] = beaten(100, 'Cayman Islands');
  await env.advance(MIN);
  r = env.reading();
  assert.equal(r.npcs[100].state, 'beaten');
  assert.equal(r.npcs[100].since, T0 + MIN);
  assert.equal(r.npcs[100].changedAt, T0 + MIN);
  // The page out of view for 5 minutes: the next change can't be timed.
  w.hide();
  await env.advance(5 * MIN);
  env.torn[102] = beaten(102, 'Canada');
  w.show();
  await env.advance(0);
  r = env.reading();
  assert.equal(r.npcs[102].state, 'beaten');
  assert.equal(r.npcs[102].since, 0);
  assert.equal(r.npcs[102].changedAt, T0 + 6 * MIN);
  assert.equal(r.npcs[100].since, T0 + MIN, 'an earlier change keeps its time');
});

test('a move while standing is a change; the same place again is not', async () => {
  const { env } = await started({ torn: READ_1215 });
  env.torn[23] = up(23, 'Mexico');
  await env.advance(MIN);
  assert.equal(env.reading().npcs[23].since, T0 + MIN);
  await env.advance(MIN);
  assert.equal(env.reading().npcs[23].since, T0 + MIN);
});

// ---------------------------------------------------------------------------------------------
// Asking Torn
// ---------------------------------------------------------------------------------------------

test('a sweep asks Torn\'s v2 profile of each of the six, M\'aol first, with the key and a comment, sending no cookies', async () => {
  const { env } = await started();
  assert.deepEqual(env.torns().map((r) => r.url), IDS.map((id) => 'https://api.torn.com/v2/user/' + id + '/profile?striptags=true&key=' + KEY + '&comment=ancient-ones'));
  assert.ok(env.torns().every((r) => r.method === 'GET' && r.anonymous === true && r.via === 'xhr'));
});

test('with no GM_xmlhttpRequest, it asks Torn by fetch, sending no cookies', async () => {
  const { env } = await started({}, { xhr: false });
  assert.deepEqual(askedIds(env), IDS);
  assert.ok(env.torns().every((r) => r.via === 'fetch' && r.credentials === 'omit'));
  assert.deepEqual(seen(env)[101], ['beaten', 'Mexico', 0]);
});

test('two tabs on one device make one sweep a minute between them', async () => {
  const env = device();
  env.store[KEY_STORE] = KEY;
  env.tab().run();
  env.tab().run();
  await env.advance(0);
  assert.equal(env.torns().length, 6);
  await env.advance(59 * SEC);
  assert.equal(env.torns().length, 6);
  await env.advance(SEC);
  assert.equal(env.torns().length, 12);
  await env.advance(3 * MIN);
  assert.equal(env.torns().length, 30);
});

test('a page out of view doesn\'t sweep, but Torn PDA does, and the warboard app counts as not PDA', async () => {
  const hidden = device();
  hidden.store[KEY_STORE] = KEY;
  hidden.tab({ visible: false }).run();
  await hidden.advance(3 * MIN);
  assert.equal(hidden.torns().length, 0);

  const pda = device();
  pda.tab({ visible: false, pda: true }).run();
  await pda.advance(2 * MIN + SEC);
  assert.equal(pda.torns().length, 18);

  const app = device();
  app.store[KEY_STORE] = KEY;
  app.tab({ visible: false, app: true }).run();
  await app.advance(3 * MIN);
  assert.equal(app.torns().length, 0);
});

test('a page that comes back into view sweeps at once when a sweep is due, and not before', async () => {
  const { env, w } = await started();
  w.hide();
  await env.advance(30 * SEC);
  w.show();
  await env.advance(0);
  assert.equal(env.torns().length, 6, 'not due yet');
  w.hide();
  await env.advance(91 * SEC);
  assert.equal(env.torns().length, 6);
  w.show();
  await env.advance(0);
  assert.equal(env.torns().length, 12);
  assert.equal(env.reading().at, T0 + 121 * SEC);
});

test('the six are asked one after another, never two at once', async () => {
  const env = device();
  env.store[KEY_STORE] = KEY;
  env.hold = 'torn';
  env.tab().run();
  await env.advance(0);
  for (let n = 1; n <= 6; n++) {
    assert.equal(env.torns().length, n);
    await env.release();
  }
  assert.equal(env.torns().length, 6);
  assert.ok(env.reading().okAt > 0);
});

test('Torn\'s error stops the sweep, keeps the last good reading, and the next sweep comes a minute later', async () => {
  const { env } = await started();
  env.torn[101] = { error: { code: 17, error: 'Backend error occurred, please try again' } };
  env.torn[100] = up(100, 'Cayman Islands', 1000);
  await env.advance(MIN);
  assert.deepEqual(askedIds(env), IDS.concat([23, 100, 101]));
  const r = env.reading();
  assert.equal(r.error, 'Backend error occurred, please try again (code 17)');
  assert.equal(r.okAt, T0);
  assert.equal(r.npcs[100].cur, 1000, 'what came before the error is kept');
  assert.deepEqual(seen(env)[104], ['up', 'United Kingdom', 53]);
  await env.advance(MIN);
  assert.equal(env.torns().length, 12);
});

test('no answer from Torn is said in words, and the next sweep comes a minute later', async () => {
  const { env } = await started();
  env.torn[23] = null;
  await env.advance(MIN);
  assert.equal(env.reading().error, 'no answer from Torn');
  assert.equal(env.torns().length, 7);
  await env.advance(MIN);
  assert.equal(env.torns().length, 8);
});

test('an answer that isn\'t JSON, or JSON with no profile in it, is said in words', async () => {
  for (const [raw, words] of [['<html>Cloudflare</html>', 'no answer from Torn'], [JSON.stringify({ something: 1 }), 'unexpected answer from Torn']]) {
    const { env } = await started({ torn: { ...READ_1125, 23: { raw } } });
    assert.equal(env.reading().error, words);
    assert.equal(env.torns().length, 1);
  }
});

test('a key Torn won\'t take (codes 2, 10, 13, 18) stops the sweeps; codes 5, 8 and 9 wait 5 minutes', async () => {
  for (const code of [2, 10, 13, 18]) {
    const env = device();
    env.store[KEY_STORE] = KEY;
    env.tornError = { code, error: 'Key error' };
    env.tab().run();
    await env.advance(10 * MIN);
    assert.equal(env.torns().length, 1, 'code ' + code);
    assert.equal(env.reading().stop, true);
    assert.equal(env.reading().error, 'Key error (code ' + code + ')');
  }
  for (const code of [5, 8, 9]) {
    const env = device();
    env.store[KEY_STORE] = KEY;
    env.tornError = { code, error: 'Wait' };
    env.tab().run();
    await env.advance(5 * MIN - SEC);
    assert.equal(env.torns().length, 1, 'code ' + code);
    env.tornError = null;
    await env.advance(SEC);
    assert.equal(env.torns().length, 7, 'code ' + code);
  }
});

test('a sweep time or a wait stored ahead of the clock (the clock was set back) doesn\'t stop the sweeps', async () => {
  // A sweep stored as started 3 hours from now: the device's clock was set back since.
  const ahead = device();
  ahead.store[KEY_STORE] = KEY;
  ahead.store[READING_STORE] = JSON.stringify({ at: T0 + 3 * 60 * MIN });
  ahead.tab().run();
  await ahead.advance(0);
  assert.equal(ahead.torns().length, 6);
  // A wait further off than Torn ever asks for (5 minutes) is from a clock set back too.
  const waiting = device();
  waiting.store[KEY_STORE] = KEY;
  waiting.store[READING_STORE] = JSON.stringify({ wait: T0 + 60 * MIN });
  waiting.tab().run();
  await waiting.advance(0);
  assert.equal(waiting.torns().length, 6);
});

test('the key never reaches the console or the stored reading, even when Torn\'s message holds it', async () => {
  const env = device();
  env.store[KEY_STORE] = KEY;
  env.tornError = { code: 16, error: 'Key ' + KEY + ' has too low an access level' };
  const w = env.tab().run();
  await env.advance(0);
  assert.equal(env.reading().error, 'Key **** has too low an access level (code 16)');
  assert.equal(env.store[READING_STORE].includes(KEY), false);
  assert.equal(w.logs.join('\n').includes(KEY), false);
});

// ---------------------------------------------------------------------------------------------
// The API key
// ---------------------------------------------------------------------------------------------

test('PDA\'s key is used when PDA swaps it in, a key saved on the device beats it, and with neither there are no calls', async () => {
  const pda = device();
  pda.tab({ pda: true }).run();
  await pda.advance(0);
  assert.ok(pda.torns().every((r) => r.url.includes('&key=' + PDA_KEY + '&')));
  assert.equal(pda.torns().length, 6);

  const both = device();
  both.store[KEY_STORE] = '  ' + KEY + ' ';
  both.tab({ pda: true }).run();
  await both.advance(0);
  assert.ok(both.torns().every((r) => r.url.includes('&key=' + KEY + '&')));

  for (const opts of [{}, { app: true }, { pda: true, pdaKey: '' }]) {
    const none = device();
    none.tab(opts).run();
    await none.advance(3 * MIN);
    assert.equal(none.torns().length, 0, JSON.stringify(opts));
  }
});

// ---------------------------------------------------------------------------------------------
// Stored
// ---------------------------------------------------------------------------------------------

test('the reading is stored as a string of JSON, and one handed back already parsed reads the same', async () => {
  const { env } = await started();
  assert.equal(typeof env.store[READING_STORE], 'string');
  const parsed = device({ store: { ...env.store } });
  parsed.now = T0 + 30 * SEC;
  parsed.tab({ getValue: (store, k, d) => (k in store ? (k === READING_STORE ? JSON.parse(store[k]) : store[k]) : d) }).run();
  await parsed.advance(0);
  assert.equal(parsed.torns().length, 0, 'the sweep 30 s ago still counts');
});

test('a stored reading that won\'t parse, or holds nonsense, is no reading at all', async () => {
  for (const bad of ['{not json', '"a string"', '42', JSON.stringify({ at: 'soon', npcs: { 23: 'x', 100: { state: 'flying', cur: 'lots' } }, trail: 'Mexico' })]) {
    const env = device({ store: { [KEY_STORE]: KEY, [READING_STORE]: bad } });
    env.tab().run();
    await env.advance(0);
    assert.equal(env.torns().length, 6, bad);
    assert.deepEqual(seen(env)[101], ['beaten', 'Mexico', 0], bad);
  }
});

test('a storage that won\'t save: the tab keeps its own copy, and still sweeps once a minute', async () => {
  const env = device({ store: { [KEY_STORE]: KEY } });
  env.tab({ setValue: () => { throw new Error('QuotaExceededError'); } }).run();
  await env.advance(3 * MIN);
  assert.equal(env.torns().length, 24);
  assert.equal(READING_STORE in env.store, false);
});

test('a storage that drops writes without a word is caught the same way', async () => {
  const env = device({ store: { [KEY_STORE]: KEY } });
  env.tab({ setValue: () => {} }).run();
  await env.advance(2 * MIN);
  assert.equal(env.torns().length, 18);
});

test('a storage that throws on reads is no key and no reading, and with PDA\'s key it still sweeps', async () => {
  const env = device({ store: { [KEY_STORE]: KEY } });
  env.tab({ getValue: () => { throw new Error('no'); } }).run();
  await env.advance(MIN);
  assert.equal(env.torns().length, 0);
  const pda = device();
  pda.tab({ pda: true, getValue: () => { throw new Error('no'); } }).run();
  await pda.advance(MIN + SEC);
  assert.equal(pda.torns().length, 12);
});

test('with no GM functions at all, the script still runs on PDA\'s key and breaks nothing', async () => {
  const env = device();
  const w = env.tab({ pda: true, gm: false }).run();
  await env.advance(MIN);
  assert.deepEqual(w.logs, [RUNNING]);
  assert.equal(env.requests.filter((r) => r.via === 'fetch' && r.url.startsWith('https://api.torn.com/')).length, 12);
});
```

- [ ] **Step 2: Run them to see them fail.** Run `T`.

Expected: `# tests 31 # pass 0 # fail 31`. Every test fails with ENOENT, because the script doesn't exist yet.

- [ ] **Step 3: Write the script.** Create `server/public/scripts/torn-ancient-ones.user.js`:

```js
// ==UserScript==
// @name         Torn Ancient Ones
// @namespace    RussianRob
// @version      1.0.0
// @description  Where Torn's Halloween Ancient Ones are (M'aol and his five praetorians), in a small box on Torn pages: country, life left, standing or beaten, an attack link, when M'aol can be hit and his route, and where to fly by airstrip or BCT. It needs a Public API key; Torn PDA gives its own.
// @author       RussianRob
// @downloadURL  https://tornwar.com/scripts/torn-ancient-ones.user.js
// @updateURL    https://tornwar.com/scripts/torn-ancient-ones.meta.js
// @license      All Rights Reserved
// @match        https://www.torn.com/*
// @run-at       document-idle
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_xmlhttpRequest
// @connect      api.torn.com
// @connect      www.tornstats.com
// ==/UserScript==

// =============================================================================
// TORN'S API TERMS
// =============================================================================
// Data Storage           Only on this device: the six NPCs' last reading, the box's place, your key.
// Data Sharing           None. The script also reads TornStats' public feed of the six, and sends
//                        TornStats nothing of yours.
// Purpose of Use         Show where the Ancient Ones are and which can be attacked.
// Key Storage & Sharing  Stored on this device in the script's storage; sent only to Torn's API.
// Key Access Level       Public.

// =============================================================================
// CHANGELOG
// =============================================================================
// v1.0.0  - First release. A small box on Torn pages shows where M'aol and his five
//           praetorians are, how much life each has left, which can be hit now, when
//           M'aol can be, and once he can, his route and next stop. For each one
//           standing, it estimates when it dies and whether a flight by airstrip or BCT
//           lands in time; for M'aol, where each flight catches him.

(function () {
  'use strict';

  const VERSION = '1.0.0';

  // Loaded twice on one page (two copies installed, or PDA injecting it again), it runs once.
  // The mark goes on the page itself, which every copy can see; each copy may have its own window.
  const root = document.documentElement;
  if (root.hasAttribute('data-torn-ancient-ones')) return;
  root.setAttribute('data-torn-ancient-ones', VERSION);

  // ===== WHO AND WHERE =====

  // M'aol and his five praetorians, by their NPC ids. Every sweep reads M'aol first.
  const MAOL = 23;
  const PRAETORIANS = [100, 101, 102, 103, 104];
  const IDS = [MAOL].concat(PRAETORIANS);
  // Torn's countries abroad, nearest first, as Torn's flights go. Only these names count as a
  // country in Torn's words, and the box lists the praetorians in this order.
  const COUNTRIES = ['Mexico', 'Cayman Islands', 'Canada', 'Hawaii', 'United Kingdom', 'Argentina',
    'Switzerland', 'Japan', 'China', 'UAE', 'South Africa'];
  const TORN_CITY = 'Torn City';

  // ===== TIMES =====

  // At most one sweep of the six a minute, across all tabs.
  const SWEEP_EVERY_MS = 60 * 1000;
  // How often each tab checks whether a sweep is due.
  const TICK_MS = 5000;
  // After Torn says too many requests, IP blocked or API off, the next sweep waits this long.
  const BACK_OFF_MS = 5 * 60 * 1000;
  // A change gets a time only when the reading before it was at most this much older.
  const TIMED_GAP_MS = 3 * 60 * 1000;

  // Torn's error codes for a key it won't take: wrong key (2), key owner in federal jail (10),
  // key off for the owner's inactivity (13), key paused (18). Torn blocks an IP that keeps
  // sending a bad key, so these stop the sweeps until a key is saved.
  const KEY_CODES = [2, 10, 13, 18];
  // Torn's error codes that mean wait: too many requests (5), IP blocked (8), API off (9).
  const WAIT_CODES = [5, 8, 9];

  // ===== STORAGE =====

  // GM storage: the key from the box, the last sweep (shared by every tab), and the box's place.
  const KEY_STORE = 'torn-ancient-ones-key';
  const READING_STORE = 'torn-ancient-ones-reading';
  const BOX_STORE = 'torn-ancient-ones-box';

  // PDA puts your API key in place of this placeholder when it loads the script. The file must
  // hold the placeholder once only: PDA finds it by its text, and a second copy breaks the swap.
  const PDA_KEY = '###PDA-APIKEY###';
  // Still the placeholder (it has the #s) means PDA didn't swap it, or this isn't PDA.
  const HAS_PDA_KEY = PDA_KEY.indexOf('##') === -1 && PDA_KEY.length > 8;
  // The warboard app answers PDA's bridge too, so it is told apart by its own gmBridge handler.
  const IS_WARBOARD = !!(window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.gmBridge);
  // Torn PDA. Its web view misreports whether the page is visible, so there the box always reads.
  const IS_PDA = typeof window.flutter_inappwebview !== 'undefined' && !IS_WARBOARD;

  // Every GM_* call is guarded, because hosts differ in what they give a script. Values are
  // stored as strings, because PDA hands stored values back as strings.
  function gmGet(name) {
    try {
      return typeof GM_getValue === 'function' ? GM_getValue(name, '') : '';
    } catch (e) {
      return '';
    }
  }

  // True when the value was saved. A full localStorage, where PDA keeps GM values, throws.
  function gmSet(name, value) {
    try {
      if (typeof GM_setValue === 'function') {
        GM_setValue(name, value);
        return true;
      }
    } catch (e) {
      // Not saved: the caller decides what to do without it.
    }
    return false;
  }

  // True when storage kept the value: saved, then read back the same. Some hosts drop a write
  // without throwing.
  function saveChecked(name, value) {
    return gmSet(name, value) && gmGet(name) === value;
  }

  // The key for Torn's API: one saved in the box beats the one PDA gives. '' means none.
  function apiKey() {
    const saved = gmGet(KEY_STORE);
    if (typeof saved === 'string' && saved.trim()) return saved.trim();
    return HAS_PDA_KEY ? PDA_KEY : '';
  }

  // ===== THE READING =====

  // The last sweep, shared by every tab:
  // - at: when a sweep last started (ms), in any tab;
  // - okAt: when a sweep last read all six (ms, 0 for never);
  // - error: why the last call failed, in words ('' if it didn't);
  // - wait: no sweep before this time (ms, 0 for none), after Torn said to wait;
  // - stop: Torn won't take the key, so no sweeps until a key is saved;
  // - npcs: what was read of each Ancient One, by id (see readNpc).
  const STATES = ['up', 'beaten', 'dormant', 'unknown'];

  function parseReading(v) {
    try {
      if (typeof v === 'string') v = v ? JSON.parse(v) : null;
    } catch (e) {
      v = null;
    }
    if (!v || typeof v !== 'object') v = {};
    const from = v.npcs && typeof v.npcs === 'object' ? v.npcs : {};
    const npcs = {};
    IDS.forEach((id) => {
      if (from[id] && typeof from[id] === 'object') npcs[id] = readNpc(from[id]);
    });
    return {
      at: Number(v.at) || 0,
      okAt: Number(v.okAt) || 0,
      error: typeof v.error === 'string' ? v.error : '',
      wait: Number(v.wait) || 0,
      stop: v.stop === true,
      npcs: npcs,
    };
  }

  // One Ancient One as stored:
  // - name: Torn's name for it;
  // - state: 'up' (standing), 'beaten' (0 life), 'dormant' (asleep with life left: its week
  //   ran out) or 'unknown' (Torn's words say neither);
  // - place: a country, Torn City, or '' when Torn's words don't say;
  // - words: Torn's description as it came, for a line the script can't read otherwise;
  // - cur and max: its life;
  // - readAt: when this was read (ms);
  // - since: when its state (or, while it stands, its place) last changed, if the reading
  //   before was close enough to pin that down (ms, 0 for not known);
  // - changedAt: when the script last saw it change (ms, 0 for never), for the highlight.
  function readNpc(n) {
    return {
      name: typeof n.name === 'string' ? n.name : '',
      state: STATES.indexOf(n.state) >= 0 ? n.state : 'unknown',
      place: typeof n.place === 'string' ? n.place : '',
      words: typeof n.words === 'string' ? n.words : '',
      cur: Number(n.cur) || 0,
      max: Number(n.max) || 0,
      readAt: Number(n.readAt) || 0,
      since: Number(n.since) || 0,
      changedAt: Number(n.changedAt) || 0,
    };
  }

  // This tab's own copy of the reading, kept only while storage won't save it (PDA keeps GM
  // values in localStorage, which can be full). It wins unless storage holds a newer sweep.
  let tabCopy = null;

  function readReading() {
    const shared = parseReading(gmGet(READING_STORE));
    return tabCopy && tabCopy.at >= shared.at ? parseReading(JSON.stringify(tabCopy)) : shared;
  }

  function writeReading(r) {
    const text = JSON.stringify(r);
    tabCopy = saveChecked(READING_STORE, text) ? null : parseReading(text);
  }

  // ===== READING TORN'S ANSWER =====

  // What Torn's v2 profile says of one Ancient One, as readNpc stores it (without the times).
  function readProfile(p) {
    const status = p && p.status && typeof p.status === 'object' ? p.status : {};
    const words = String(status.description == null ? '' : status.description).trim();
    const state = String(status.state == null ? '' : status.state);
    const life = p && p.life && typeof p.life === 'object' ? p.life : null;
    const cur = life ? Number(life.current) : NaN;
    const max = life ? Number(life.maximum) : NaN;
    // Standing or asleep: the first word of Torn's words decides, else Torn's state.
    const first = (/^[a-z]+/i.exec(words) || [''])[0].toLowerCase();
    let asleep = null;
    if (first === 'awoken' || first === 'dormant') asleep = first === 'dormant';
    else if (/^(?:awoken|dormant)$/i.test(state)) asleep = /^dormant$/i.test(state);
    // Life at 0 is beaten, whatever the words say.
    if (Number.isFinite(cur) && cur <= 0) asleep = true;
    let kind = 'unknown';
    if (asleep === false) kind = 'up';
    else if (asleep === true) kind = Number.isFinite(cur) && cur > 0 ? 'dormant' : 'beaten';
    return {
      name: String((p && p.name) || ''),
      state: kind,
      place: placeOf(words, state),
      words: words,
      cur: Number.isFinite(cur) ? cur : 0,
      max: Number.isFinite(max) ? max : 0,
    };
  }

  // Where Torn's words put it: the words after "in" when they name one of Torn's countries
  // abroad (or Torn itself); with no "in", Torn City unless Torn's state says it is abroad or
  // flying. '' when the words don't say.
  function placeOf(words, state) {
    const m = /\bin\s+(.+?)\s*$/i.exec(words);
    if (m) {
      if (/^torn(?: city)?$/i.test(m[1])) return TORN_CITY;
      const name = m[1].toLowerCase();
      return COUNTRIES.find((c) => c.toLowerCase() === name) || '';
    }
    return /^(?:abroad|traveling)$/i.test(state) ? '' : TORN_CITY;
  }

  // Beaten, or dormant: asleep either way.
  function down(n) {
    return !!n && (n.state === 'beaten' || n.state === 'dormant');
  }

  // M'aol can be hit when he isn't asleep and all five praetorians are. This is worked out from
  // the praetorians, not from M'aol's own words.
  function hittable(npcs) {
    return !!npcs[MAOL] && !down(npcs[MAOL]) && PRAETORIANS.every((id) => down(npcs[id]));
  }

  // Puts what Torn said of one Ancient One into the reading, with what changed since it was
  // last read: a new state (summoned, beaten, gone dormant), or a new place while it stands
  // (M'aol moving). The change's time is kept only when the reading before was at most 3
  // minutes older; after a longer gap (a phone asleep, say) it happened at some time unknown.
  function applyProfile(r, id, seen, nowMs) {
    const before = r.npcs[id];
    const wasHittable = hittable(r.npcs);
    const npc = Object.assign({}, seen, { readAt: nowMs, since: 0, changedAt: 0 });
    if (before) {
      const changed = before.state !== npc.state || (npc.state === 'up' && before.place !== npc.place);
      if (changed) {
        const timed = nowMs >= before.readAt && nowMs - before.readAt <= TIMED_GAP_MS;
        npc.since = timed ? nowMs : 0;
        npc.changedAt = nowMs;
      } else {
        npc.since = before.since;
        npc.changedAt = before.changedAt;
      }
    }
    r.npcs[id] = npc;
    // M'aol coming within reach is a change of his own, though his own words may not change.
    if (!wasHittable && hittable(r.npcs) && npc.changedAt === nowMs) r.npcs[MAOL].changedAt = nowMs;
  }

  // ===== ASKING TORN =====

  // True while this tab's sweep is under way.
  let sweeping = false;
  // True once the box is closed: this page makes no more calls.
  let closed = false;

  // True when this tab should start a sweep now: there is a key Torn hasn't refused, the page
  // is visible (PDA can't tell, so there always), Torn hasn't said to wait, and the last sweep
  // in any tab started a minute ago or more.
  function sweepDue(nowMs) {
    if (closed || sweeping || !apiKey()) return false;
    if (!IS_PDA && document.visibilityState === 'hidden') return false;
    const r = readReading();
    if (r.stop) return false;
    // A wait, or a last sweep, further ahead than it could be means the clock moved back.
    if (r.wait > nowMs && r.wait - nowMs <= BACK_OFF_MS) return false;
    return !(r.at <= nowMs && nowMs - r.at < SWEEP_EVERY_MS);
  }

  // Reads the six one after another, and stores each answer as it comes, so that every tab
  // draws it. One at a time, not all at once: PDA merges identical requests in flight, and the
  // first error stops the sweep before more calls go out.
  function sweep(key, nowMs) {
    sweeping = true;
    const start = readReading();
    start.at = nowMs;
    writeReading(start);
    let i = 0;
    const end = () => {
      sweeping = false;
    };
    const next = () => {
      // A closed box, or a key saved over or cleared since the sweep began, ends it.
      if (closed || apiKey() !== key) return end();
      if (i >= IDS.length) {
        const done = readReading();
        done.okAt = Date.now();
        done.error = '';
        writeReading(done);
        return end();
      }
      const id = IDS[i++];
      askTorn(key, id).then((profile) => {
        try {
          if (closed || apiKey() !== key) return end();
          const r = readReading();
          applyProfile(r, id, readProfile(profile), Date.now());
          writeReading(r);
          next();
        } catch (e) {
          end();
        }
      }, (err) => {
        try {
          if (apiKey() === key) {
            const r = readReading();
            r.error = err.message;
            if (KEY_CODES.indexOf(err.code) >= 0) r.stop = true;
            if (WAIT_CODES.indexOf(err.code) >= 0) r.wait = Date.now() + BACK_OFF_MS;
            writeReading(r);
          }
        } catch (e) {
          // Nothing more to do: the next sweep tries again.
        }
        end();
      });
    };
    next();
  }

  // GET one Ancient One's profile. Resolves with Torn's profile, or rejects with { code,
  // message }: Torn's error code and words (with the key cut out), or code 0 and a fixed message
  // when Torn gave no answer the script can read. The key is in the request and nowhere else.
  function askTorn(key, id) {
    const url = 'https://api.torn.com/v2/user/' + id + '/profile?striptags=true&key=' + encodeURIComponent(key) + '&comment=ancient-ones';
    return new Promise((resolve, reject) => {
      const answered = (text) => {
        let data;
        try {
          data = JSON.parse(text);
        } catch (e) {
          reject({ code: 0, message: 'no answer from Torn' });
          return;
        }
        if (data && data.error) {
          const code = Number(data.error.code) || 0;
          reject({ code: code, message: hideKey(String(data.error.error || 'error'), key) + ' (code ' + code + ')' });
        } else if (data && data.profile && typeof data.profile === 'object') {
          resolve(data.profile);
        } else {
          reject({ code: 0, message: 'unexpected answer from Torn' });
        }
      };
      get(url).then(answered, () => reject({ code: 0, message: 'no answer from Torn' }));
    });
  }

  // GET a page's text, sending no cookies. GM_xmlhttpRequest where the host has it: it isn't held
  // to the page's rules on what the page may fetch. fetch where it doesn't. Rejects with no answer.
  function get(url) {
    return new Promise((resolve, reject) => {
      if (typeof GM_xmlhttpRequest === 'function') {
        try {
          GM_xmlhttpRequest({
            method: 'GET',
            url: url,
            anonymous: true,
            timeout: 20000,
            onload: (res) => resolve(res && res.responseText != null ? String(res.responseText) : ''),
            onerror: reject,
            ontimeout: reject,
            onabort: reject,
          });
          return;
        } catch (e) {
          // Fall through to fetch.
        }
      }
      try {
        fetch(url, { credentials: 'omit' }).then((res) => res.text()).then(resolve, reject);
      } catch (e) {
        reject(e);
      }
    });
  }

  // Torn's messages don't hold the key, but the box must never show it, so make sure.
  function hideKey(text, key) {
    return key ? text.split(key).join('****') : text;
  }

  // Each tab's check, every 5 seconds and when the page comes back into view: a sweep if one is
  // due.
  function tick() {
    try {
      const nowMs = Date.now();
      if (sweepDue(nowMs)) sweep(apiKey(), nowMs);
    } catch (e) {
      // A surprise stops this one check. It never breaks the page.
    }
  }

  // ===== START =====

  tick();
  setInterval(tick, TICK_MS);
  // A page that comes back into view reads at once if a sweep is due. PDA misreports this.
  document.addEventListener('visibilitychange', () => {
    if (!IS_PDA && document.visibilityState !== 'hidden') tick();
  });
  console.log('[Torn Ancient Ones ' + VERSION + '] running');
})();
```

- [ ] **Step 4: Write the meta file:** the header, byte for byte, then a newline.

```bash
WT=/opt/warboard/.superpowers/sdd/2026-10-26-torn-ancient-ones/wt; cd "$WT/server/public/scripts" && sed -n '1,/^\/\/ ==\/UserScript==$/p' torn-ancient-ones.user.js > torn-ancient-ones.meta.js && chmod 644 torn-ancient-ones.user.js torn-ancient-ones.meta.js && wc -l torn-ancient-ones.meta.js
```

Expected: `17 torn-ancient-ones.meta.js`.

- [ ] **Step 5: Run the tests to see them pass.** Run `T`, then `C`.

Expected: `# tests 31 # pass 31 # fail 0`, then `ascii-ok`.

- [ ] **Step 6: Commit.**

```bash
WT=/opt/warboard/.superpowers/sdd/2026-10-26-torn-ancient-ones/wt; cd "$WT" && git add -- server/public/scripts/torn-ancient-ones.user.js server/public/scripts/torn-ancient-ones.meta.js server/torn-ancient-ones.test.mjs && git commit -q -m "torn-ancient-ones: a new script that reads Torn's Halloween Ancient Ones from the API, one sweep a minute across tabs" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- server/public/scripts/torn-ancient-ones.user.js server/public/scripts/torn-ancient-ones.meta.js server/torn-ancient-ones.test.mjs && git log --format='%h %s' -1 && git status --short
```

Expected: the commit, then only `?? server/node_modules`.

---

### Task 2: The box

**Files:**
- Modify: `server/public/scripts/torn-ancient-ones.user.js`
- Modify (tests): `server/torn-ancient-ones.test.mjs`

**Interfaces:**
- Consumes, from Task 1: `readReading()`, `apiKey()`, `down(n)`, `hittable(npcs)`, `tick()`, `sweep(key, nowMs)` (its end and each answer now redraw the box), `MAOL`, `PRAETORIANS`, `IDS`, `COUNTRIES`, `TORN_CITY`, `TIMED_GAP_MS`; in the tests, everything Task 1's tests produce.
- Produces, in the script:
  - constants: `PROFILE_URL`, `ATTACK_URL`, `HIGHLIGHT_MS` (5 minutes), `RESUMMON_MS` (48 hours), `ACCENT` (`'#f0a04b'`), `BOX_ID` (`'tao-box'`), `STYLE_ID` (`'tao-styles'`), `STYLE` (every rule the box uses, Task 5's buttons and key row included), `MONTHS`; and `box`, `drawn` (the last lines drawn, as JSON);
  - `make(tag, text, className) -> element`, `setText(el, text)`, `makeBox()`, `draw()`, `drawSafe()`;
  - `order(npcs) -> id[]`, `line(id, r, nowMs) -> { id, name, where, life, state, attack, notes, down, fresh }`, `percent(n) -> number`, `lineElement(l) -> element`;
  - `summary(r, key, nowMs) -> string`, `nextSummoning(r, nowMs) -> string`, `footer(r, key, nowMs) -> string`, `ago(ms) -> string`, `clock(ms, nowMs) -> string`, `hhmm(ms) -> string`;
  - the box's parts, by class: `tao-head`, `tao-titles`, `tao-title`, `tao-summary`, `tao-body`, `tao-lines`, `tao-line` (with `data-id`), `tao-name`, `tao-where`, `tao-life`, `tao-state`, `tao-attack`, `tao-note`, `tao-foot`, `tao-age`; and the classes `tao-down` (dimmed), `tao-new` (highlighted) and `tao-folded`.
- Produces, in the test file: `boxOf(w)`, `summary(w)`, `footer(w)`, `lineEl(w, id)`, `lineText(w, id)` (a line's parts joined by two spaces, without its notes), `lineTexts(w)`, `notes(w, id)` and `later(env, ms, tabOpts)` (a new device with this one's storage, ms later).

- [ ] **Step 1: Write the failing tests.** Add at the end of `server/torn-ancient-ones.test.mjs`, after a blank line:

```js
// ---------------------------------------------------------------------------------------------
// The box
// ---------------------------------------------------------------------------------------------

const boxOf = (w) => w.document.getElementById('tao-box');
const summary = (w) => boxOf(w).querySelector('.tao-summary').textContent;
const footer = (w) => boxOf(w).querySelector('.tao-age').textContent;
const lineEl = (w, id) => boxOf(w).querySelector('.tao-line[data-id="' + id + '"]');
// A line's own parts (name, where, life, state, Attack), joined by two spaces.
function lineText(w, id) {
  const el = lineEl(w, id);
  return el ? [...el.children].filter((c) => !c.classList.contains('tao-note')).map((c) => c.textContent).join('  ') : null;
}
// Every line, in order, as text.
const lineTexts = (w) => [...boxOf(w).querySelectorAll('.tao-line')].map((el) => lineText(w, Number(el.getAttribute('data-id'))));
// The notes under a line.
const notes = (w, id) => [...lineEl(w, id).querySelectorAll('.tao-note')].map((n) => n.textContent);

// A new device holding what this one stored, with its clock ms later and Torn giving the same
// answers: as when the owner comes back to Torn after a while.
async function later(env, ms, tabOpts = {}) {
  const next = device({ store: { ...env.store }, torn: env.torn, tornstats: env.tornstats });
  next.now = env.now + ms;
  const w = next.tab(tabOpts).run();
  await next.advance(0);
  return { env: next, w };
}

test('the box: bottom left, titled "Ancient Ones", in its own styles', async () => {
  const { w } = await started();
  const box = boxOf(w);
  assert.equal(box.parentNode, w.document.body);
  assert.equal(box.querySelector('.tao-title').textContent, 'Ancient Ones');
  const css = w.document.getElementById('tao-styles').textContent;
  assert.match(css, /#tao-box\{position:fixed;left:20px;bottom:20px;[^}]*max-width:320px;background:rgba\(11,15,25,0\.95\);color:#f0a04b;[^}]*font:12px Verdana/);
  assert.match(css, /\.tao-head\{[^}]*touch-action:none/);
});

test('the lines at 11:25 TCT: M\'aol first, then the praetorians nearest country first, each in its own words', async () => {
  const { w } = await started({ torn: READ_1125 });
  assert.deepEqual(lineTexts(w), [
    'M\'aol  Torn City  100%  shielded, 4 praetorians up',
    'Nol\'dasaym  Mexico  beaten',
    'Dyno\'salam  Cayman Islands  33%  Attack',
    'Asmol\'yand  Canada  89%  Attack',
    'Sylo\'nadam  Hawaii  99%  Attack',
    'Ladso\'myna  United Kingdom  53%  Attack',
  ]);
  assert.equal(summary(w), '4 of 5 praetorians up. M\'aol shielded.');
  assert.ok(lineEl(w, 101).classList.contains('tao-down'));
  assert.equal(lineEl(w, 100).classList.contains('tao-down'), false);
});

test('the lines at 12:15 TCT: M\'aol shielded in the Cayman Islands, three beaten', async () => {
  const { w } = await started({ torn: READ_1215 });
  assert.deepEqual(lineTexts(w), [
    'M\'aol  Cayman Islands  100%  shielded, 2 praetorians up',
    'Nol\'dasaym  Mexico  beaten',
    'Dyno\'salam  Cayman Islands  beaten',
    'Asmol\'yand  Canada  55%  Attack',
    'Sylo\'nadam  Hawaii  98%  Attack',
    'Ladso\'myna  United Kingdom  beaten',
  ]);
  assert.equal(summary(w), '2 of 5 praetorians up. M\'aol shielded.');
});

test('one praetorian left: "1 praetorian up"; one with no known country goes last; dormant says so', async () => {
  const { w } = await started({ torn: { ...allBeaten('Awoken'), 100: profile(100, 'Awoken in Atlantis', 1000), 102: profile(102, 'Dormant in Canada', 5000) } });
  assert.equal(lineText(w, 23), 'M\'aol  Torn City  100%  shielded, 1 praetorian up');
  assert.equal(summary(w), '1 of 5 praetorians up. M\'aol shielded.');
  assert.deepEqual([...boxOf(w).querySelectorAll('.tao-line')].map((el) => Number(el.getAttribute('data-id'))), [23, 101, 102, 103, 104, 100]);
  assert.equal(lineText(w, 102), 'Asmol\'yand  Canada  dormant');
  assert.equal(lineText(w, 100), 'Dyno\'salam  Awoken in Atlantis  1%  Attack');
});

test('a fall the script saw in time shows its time; one it didn\'t, none', async () => {
  const { env, w } = await started();
  env.torn[100] = beaten(100, 'Cayman Islands');
  await env.advance(MIN);
  assert.equal(lineText(w, 100), 'Dyno\'salam  Cayman Islands  beaten 10:41 TCT');
  assert.equal(lineText(w, 101), 'Nol\'dasaym  Mexico  beaten');
});

test('once all five are down, M\'aol can be hit: an Attack link, his country, and how he moves', async () => {
  const { env, w } = await started({ torn: allBeaten('Awoken in Mexico') });
  assert.equal(summary(w), 'M\'aol can be hit: in Mexico.');
  assert.equal(lineText(w, 23), 'M\'aol  Mexico  100%  Attack');
  assert.deepEqual(notes(w, 23), ['moves about every 15 min']);
  env.torn[23] = up(23, 'Cayman Islands', 140000000);
  await env.advance(MIN);
  assert.equal(summary(w), 'M\'aol can be hit: in Cayman Islands.');
  assert.equal(lineText(w, 23), 'M\'aol  Cayman Islands  92%  Attack');
  assert.deepEqual(notes(w, 23), ['moves about every 15 min, here since 10:41 TCT']);
});

test('M\'aol can be hit only when all five are down, whatever his own words say', async () => {
  const shielded = await started({ torn: { ...allBeaten('Awoken in Mexico'), 104: up(104, 'United Kingdom') } });
  assert.equal(lineText(shielded.w, 23), 'M\'aol  Mexico  100%  shielded, 1 praetorian up');
  assert.equal(lineEl(shielded.w, 23).querySelector('.tao-attack'), null);
  const open = await started({ torn: allBeaten('Awoken') });
  assert.equal(lineText(open.w, 23), 'M\'aol  Torn City  100%  Attack');
  assert.equal(summary(open.w), 'M\'aol can be hit: in Torn City.');
  const odd = await started({ torn: allBeaten('Awoken in Atlantis') });
  assert.equal(summary(odd.w), 'M\'aol can be hit: Awoken in Atlantis.');
});

test('the summary with no key, before any answer, and when Torn never answered', async () => {
  const none = device();
  const a = none.tab().run();
  await none.advance(0);
  assert.equal(summary(a), 'Needs an API key.');
  assert.equal(footer(a), '');
  const waiting = device();
  waiting.store[KEY_STORE] = KEY;
  waiting.hold = 'torn';
  const b = waiting.tab().run();
  await waiting.advance(0);
  assert.equal(summary(b), 'Reading Torn...');
  assert.equal(footer(b), 'Reading Torn...');
  const failing = device();
  failing.store[KEY_STORE] = KEY;
  failing.torn[23] = null;
  const c = failing.tab().run();
  await failing.advance(0);
  assert.equal(summary(c), 'Couldn\'t read Torn.');
  assert.equal(footer(c), 'Couldn\'t read Torn: no answer from Torn.');
});

test('all asleep: the next summoning, 48 h after a seen death of M\'aol', async () => {
  const { env, w } = await started({ torn: allBeaten('Awoken in Mexico') });
  env.torn[23] = beaten(23, 'Mexico');
  await env.advance(MIN);
  assert.equal(lineText(w, 23), 'M\'aol  Mexico  beaten 10:41 TCT');
  assert.equal(summary(w), 'All asleep. Next summoning possible from Oct 28 10:41 TCT (48 h after M\'aol\'s death).');
  const after = await later(env, 48 * 60 * MIN);
  assert.equal(summary(after.w), 'All asleep. Next summoning possible now (48 h after M\'aol\'s death).');
  const unseen = await started({ torn: { ...allBeaten(), 23: beaten(23, 'Mexico') } });
  assert.equal(summary(unseen.w), 'All asleep. Next summoning possible 48 h after M\'aol\'s death.');
});

test('all asleep, by the window\'s edges: 10:00 TCT on Oct 26 to 23:59:59 TCT on Oct 31', async () => {
  const asleep = { ...allBeaten(), 23: beaten(23, 'Mexico') };
  const at = async (ms) => {
    const env = device({ torn: asleep });
    env.now = ms;
    env.store[KEY_STORE] = KEY;
    const w = env.tab().run();
    await env.advance(0);
    return summary(w);
  };
  assert.equal(await at(Date.UTC(2026, 9, 26, 9, 59, 59)), 'All asleep. Summoning opens 10:00 TCT.');
  assert.equal(await at(Date.UTC(2026, 9, 25, 12, 0)), 'All asleep. Summoning opens Oct 26 10:00 TCT.');
  assert.equal(await at(Date.UTC(2026, 9, 26, 10, 0, 0)), 'All asleep. Next summoning possible 48 h after M\'aol\'s death.');
  assert.equal(await at(Date.UTC(2026, 9, 31, 23, 59, 59)), 'All asleep. Next summoning possible 48 h after M\'aol\'s death.');
  assert.equal(await at(Date.UTC(2026, 10, 1, 0, 0, 0)), 'All asleep. No more summonings this Halloween.');
  // A death less than 48 h before the window ends: no more this year.
  const late = device({ torn: allBeaten('Awoken in Mexico') });
  late.store[KEY_STORE] = KEY;
  late.now = Date.UTC(2026, 9, 30, 0, 0);
  const lw = late.tab().run();
  await late.advance(0);
  late.torn[23] = beaten(23, 'Mexico');
  await late.advance(MIN);
  assert.equal(summary(lw), 'All asleep. No more summonings this Halloween.');
});

test('links: a name goes to the profile, Attack to the fight, both in this tab; Attack only for one that can be hit now', async () => {
  const { w } = await started({ torn: READ_1125 });
  assert.equal(lineEl(w, 100).querySelector('.tao-name').getAttribute('href'), 'https://www.torn.com/profiles.php?XID=100');
  assert.equal(lineEl(w, 100).querySelector('.tao-attack').getAttribute('href'), 'https://www.torn.com/loader.php?sid=attack&user2ID=100');
  assert.equal(lineEl(w, 23).querySelector('.tao-name').getAttribute('href'), 'https://www.torn.com/profiles.php?XID=23');
  assert.equal(lineEl(w, 101).querySelector('.tao-attack'), null);
  assert.equal(lineEl(w, 23).querySelector('.tao-attack'), null);
  assert.deepEqual([...boxOf(w).querySelectorAll('.tao-attack')].map((a) => a.parentNode.getAttribute('data-id')), ['100', '102', '103', '104']);
  assert.ok([...boxOf(w).querySelectorAll('a')].every((a) => !a.hasAttribute('target')));
});

test('a change is highlighted, with the title bar, for 5 minutes: there at 4, gone at 6', async () => {
  const { env, w } = await started();
  const head = () => boxOf(w).querySelector('.tao-head');
  assert.equal(head().classList.contains('tao-new'), false, 'the first reading changes nothing');
  env.torn[100] = beaten(100, 'Cayman Islands');
  await env.advance(MIN);
  await env.advance(4 * MIN);
  assert.ok(lineEl(w, 100).classList.contains('tao-new'));
  assert.ok(head().classList.contains('tao-new'));
  assert.equal(lineEl(w, 102).classList.contains('tao-new'), false);
  await env.advance(2 * MIN);
  assert.equal(lineEl(w, 100).classList.contains('tao-new'), false);
  assert.equal(head().classList.contains('tao-new'), false);
});

test('M\'aol coming within reach is highlighted on his line too', async () => {
  const { env, w } = await started({ torn: { ...allBeaten('Awoken in Mexico'), 104: up(104, 'United Kingdom', 1000) } });
  env.torn[104] = beaten(104, 'United Kingdom');
  await env.advance(MIN);
  assert.ok(lineEl(w, 23).classList.contains('tao-new'));
  assert.ok(lineEl(w, 104).classList.contains('tao-new'));
});

test('Torn\'s words go in as text, never as HTML', async () => {
  const { w } = await started({ torn: { ...READ_1125, 102: profile(102, 'Sleeping <b>soundly</b>', 1000, { state: 'Okay' }) } });
  assert.equal(lineText(w, 102), 'Asmol\'yand  Sleeping <b>soundly</b>  1%');
  assert.equal(boxOf(w).querySelector('b'), null);
});

test('life left is a whole percent, rounded down, but at least 1% while any is left', async () => {
  const { w } = await started({ torn: { ...READ_1125, 100: up(100, 'Cayman Islands', 1), 102: up(102, 'Canada', 217799999) } });
  assert.equal(lineText(w, 100), 'Dyno\'salam  Cayman Islands  1%  Attack');
  assert.equal(lineText(w, 102), 'Asmol\'yand  Canada  99%  Attack');
});

test('the footer: how long ago Torn answered, or why it didn\'t, with the key cut out', async () => {
  const { env, w } = await started();
  assert.equal(footer(w), 'updated 0 s ago');
  await env.advance(40 * SEC);
  assert.equal(footer(w), 'updated 40 s ago');
  env.torn[23] = null;
  await env.advance(2 * MIN);
  assert.equal(footer(w), 'Couldn\'t read Torn: no answer from Torn. Last answer 2 min ago.');
  const hidden = await later(env, 3 * 60 * MIN, { visible: false });
  assert.equal(footer(hidden.w), 'Couldn\'t read Torn: no answer from Torn. Last answer 3 h ago.');
  const refused = device();
  refused.store[KEY_STORE] = KEY;
  refused.tornError = { code: 2, error: 'Incorrect key ' + KEY };
  const r = refused.tab().run();
  await refused.advance(0);
  assert.equal(footer(r), 'Torn won\'t take the key: Incorrect key **** (code 2). Save a new key.');
  assert.equal(boxOf(r).textContent.includes(KEY), false);
});

test('a hidden tab still draws, within 5 seconds, the sweep another tab made', async () => {
  const env = device();
  env.store[KEY_STORE] = KEY;
  env.tab().run();
  const quiet = env.tab({ visible: false }).run();
  await env.advance(0);
  env.torn[100] = beaten(100, 'Cayman Islands');
  await env.advance(MIN + 5 * SEC);
  assert.equal(lineText(quiet, 100), 'Dyno\'salam  Cayman Islands  beaten 10:41 TCT');
});

test('lines with nothing new in them are left as they are, not built again', async () => {
  const { env, w } = await started({ torn: READ_1215 });
  const before = lineEl(w, 102);
  await env.advance(30 * SEC);
  assert.equal(lineEl(w, 102), before);
});
```

- [ ] **Step 2: Run them to see them fail.** Run `T`.

Expected: `# tests 49 # pass 31 # fail 18`. Each of the 18 new tests fails on a TypeError, `Cannot read properties of null`, because there is no box yet. Task 1's 31 still pass.

- [ ] **Step 3: Edit the script.** In `server/public/scripts/torn-ancient-ones.user.js`, nine edits, in this order:

**Edit 2.1: Torn's pages, for the links.** Replace:

```js
  const TORN_CITY = 'Torn City';
```

With:

```js
  const TORN_CITY = 'Torn City';
  const PROFILE_URL = 'https://www.torn.com/profiles.php?XID=';
  const ATTACK_URL = 'https://www.torn.com/loader.php?sid=attack&user2ID=';
```

**Edit 2.2: The check's interval: it redraws the box too.** Replace:

```js
  // How often each tab checks whether a sweep is due.
```

With:

```js
  // How often each tab checks whether a sweep is due, and redraws the box.
```

**Edit 2.3: The highlight's 5 minutes, and the next summoning's 48 hours.** Replace:

```js
  const TIMED_GAP_MS = 3 * 60 * 1000;
```

With:

```js
  const TIMED_GAP_MS = 3 * 60 * 1000;
  // A change stays highlighted this long after the script saw it.
  const HIGHLIGHT_MS = 5 * 60 * 1000;
  // A new summoning is possible this long after M'aol's death, by Torn's patch notes (#408).
  const RESUMMON_MS = 48 * 60 * 60 * 1000;
```

**Edit 2.4: A sweep's end redraws the box.** Replace:

```js
    const end = () => {
      sweeping = false;
    };
```

With:

```js
    const end = () => {
      sweeping = false;
      drawSafe();
    };
```

**Edit 2.5: Each answer redraws the box.** Replace:

```js
          writeReading(r);
          next();
```

With:

```js
          writeReading(r);
          drawSafe();
          next();
```

**Edit 2.6: The check's comment.** Replace:

```js
  // Each tab's check, every 5 seconds and when the page comes back into view: a sweep if one is
  // due.
```

With:

```js
  // Each tab's check, every 5 seconds and when the page comes back into view: a sweep if one is
  // due, then the box redrawn from the stored reading, so a sweep by another tab shows too.
```

**Edit 2.7: The check draws the box.** Replace:

```js
      if (sweepDue(nowMs)) sweep(apiKey(), nowMs);
```

With:

```js
      if (sweepDue(nowMs)) sweep(apiKey(), nowMs);
      draw();
```

**Edit 2.8: The box: its look, its lines, the summary, the footer and the times.** Replace:

```js
  // ===== START =====
```

With:

```js
  function drawSafe() {
    try {
      draw();
    } catch (e) {
      // As in tick: a surprise never breaks the page.
    }
  }

  // ===== THE BOX =====

  // The box's colour: orange, where the Loot Rangers box is blue, so the two can't be mixed up.
  const ACCENT = '#f0a04b';
  const BOX_ID = 'tao-box';
  const STYLE_ID = 'tao-styles';
  // The box starts at the bottom left (the Loot Rangers box starts at the bottom right). The
  // title bar takes touch-action: none, so a finger on it drags the box, not the page.
  const STYLE = [
    '#tao-box{position:fixed;left:20px;bottom:20px;z-index:999998;max-width:320px;background:rgba(11,15,25,0.95);color:' + ACCENT + ';border:1px solid ' + ACCENT + ';border-radius:6px;box-shadow:0 0 6px rgba(0,0,0,0.6);font:12px Verdana,Arial,sans-serif;text-align:left}',
    '#tao-box .tao-head{display:flex;align-items:center;gap:4px;padding:4px 6px;cursor:move;touch-action:none;border-bottom:1px solid ' + ACCENT + '}',
    '#tao-box.tao-folded .tao-head{border-bottom:0}',
    '#tao-box .tao-titles{flex:1;min-width:0}',
    '#tao-box .tao-title{font-weight:bold}',
    '#tao-box .tao-summary{font-size:10px}',
    '#tao-box .tao-btn{padding:0 5px;font-size:10px;line-height:16px;background:transparent;color:' + ACCENT + ';border:1px solid ' + ACCENT + ';border-radius:3px;cursor:pointer}',
    '#tao-box .tao-body{padding:4px 6px;line-height:1.4;cursor:default}',
    '#tao-box.tao-folded .tao-body{display:none}',
    '#tao-box .tao-line{padding:1px 3px;border-radius:3px}',
    '#tao-box .tao-line > span, #tao-box .tao-line > a{margin-right:6px}',
    '#tao-box .tao-down{opacity:0.55}',
    '#tao-box .tao-new{background:rgba(240,160,75,0.25)}',
    '#tao-box .tao-note{font-size:10px;padding-left:8px}',
    '#tao-box a{color:' + ACCENT + ';text-decoration:underline}',
    '#tao-box .tao-foot{display:flex;justify-content:space-between;align-items:center;gap:6px;margin-top:3px;font-size:10px}',
    '#tao-box .tao-keyrow{margin-top:4px;font-size:10px}',
    '#tao-box .tao-keyrow input{width:150px;margin:3px 4px 0 0;font-size:11px}',
    '#tao-box [hidden]{display:none}',
  ].join('\n');
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  let box = null;
  // What the lines were last drawn from. They are rebuilt only when it changes: a line rebuilt
  // under a finger would lose the tap.
  let drawn = '';

  // An element with its text and class; either may be left out.
  function make(tag, text, className) {
    const el = document.createElement(tag);
    if (text) el.textContent = text;
    if (className) el.className = className;
    return el;
  }

  // Sets an element's text only when it differs.
  function setText(el, text) {
    if (el && el.textContent !== text) el.textContent = text;
  }

  // The box: a title bar with the summary under the title, then the lines and the footer.
  function makeBox() {
    if (!document.getElementById(STYLE_ID)) {
      const style = make('style');
      style.id = STYLE_ID;
      style.textContent = STYLE;
      (document.head || document.documentElement).appendChild(style);
    }
    box = make('div');
    box.id = BOX_ID;
    const head = make('div', '', 'tao-head');
    const titles = make('div', '', 'tao-titles');
    titles.appendChild(make('div', 'Ancient Ones', 'tao-title'));
    titles.appendChild(make('div', '', 'tao-summary'));
    head.appendChild(titles);
    const body = make('div', '', 'tao-body');
    body.appendChild(make('div', '', 'tao-lines'));
    const foot = make('div', '', 'tao-foot');
    foot.appendChild(make('span', '', 'tao-age'));
    body.appendChild(foot);
    box.appendChild(head);
    box.appendChild(body);
    document.body.appendChild(box);
  }

  // Draws the box from the stored reading: the summary, the lines and the footer.
  function draw() {
    if (!box) return;
    const nowMs = Date.now();
    const r = readReading();
    const key = apiKey();
    setText(box.querySelector('.tao-summary'), summary(r, key, nowMs));
    setText(box.querySelector('.tao-age'), footer(r, key, nowMs));
    const lines = order(r.npcs).map((id) => line(id, r, nowMs));
    const plan = JSON.stringify(lines);
    if (plan !== drawn) {
      drawn = plan;
      const holder = box.querySelector('.tao-lines');
      holder.textContent = '';
      lines.forEach((l) => holder.appendChild(lineElement(l)));
    }
    box.querySelector('.tao-head').classList.toggle('tao-new', lines.some((l) => l.fresh));
  }

  // The ids to draw, in order: M'aol first, then the praetorians nearest country first. One with
  // no known country goes last. One not read yet has no line.
  function order(npcs) {
    const rank = (id) => {
      const i = COUNTRIES.indexOf(npcs[id].place);
      return i < 0 ? COUNTRIES.length : i;
    };
    const praetorians = PRAETORIANS.filter((id) => npcs[id]).sort((a, b) => rank(a) - rank(b) || a - b);
    return (npcs[MAOL] ? [MAOL] : []).concat(praetorians);
  }

  // One line, as plain data: who, where, life left, its state in words, whether it can be hit
  // now (then it gets an Attack link), notes under it, and whether it is dimmed or highlighted.
  function line(id, r, nowMs) {
    const n = r.npcs[id];
    const asleep = down(n);
    const canHit = id === MAOL ? hittable(r.npcs) : n.state === 'up';
    let state = '';
    const notes = [];
    if (asleep) {
      state = n.state + (n.since ? ' ' + clock(n.since, nowMs) : '');
    } else if (id === MAOL && canHit) {
      notes.push('moves about every 15 min' + (n.since ? ', here since ' + clock(n.since, nowMs) : ''));
    } else if (id === MAOL) {
      const up = PRAETORIANS.filter((p) => !down(r.npcs[p])).length;
      state = 'shielded, ' + up + ' praetorian' + (up === 1 ? '' : 's') + ' up';
    }
    return {
      id: id,
      name: n.name || String(id),
      where: n.state !== 'unknown' && n.place ? n.place : n.words,
      life: !asleep && n.max > 0 ? percent(n) + '%' : '',
      state: state,
      attack: canHit,
      notes: notes,
      down: asleep,
      fresh: n.changedAt > 0 && nowMs >= n.changedAt && nowMs - n.changedAt < HIGHLIGHT_MS,
    };
  }

  // Life left as a whole percent, rounded down, but at least 1 while any is left.
  function percent(n) {
    if (n.cur <= 0) return 0;
    return Math.min(100, Math.max(1, Math.floor((100 * n.cur) / n.max)));
  }

  // A line's elements. All text goes in as text, Torn's words included, never as HTML. Links
  // open in the same tab: the warboard app's web view handles new tabs badly.
  function lineElement(l) {
    const el = make('div', '', 'tao-line' + (l.down ? ' tao-down' : '') + (l.fresh ? ' tao-new' : ''));
    el.setAttribute('data-id', String(l.id));
    const name = make('a', l.name, 'tao-name');
    name.setAttribute('href', PROFILE_URL + l.id);
    el.appendChild(name);
    if (l.where) el.appendChild(make('span', l.where, 'tao-where'));
    if (l.life) el.appendChild(make('span', l.life, 'tao-life'));
    if (l.state) el.appendChild(make('span', l.state, 'tao-state'));
    if (l.attack) {
      const attack = make('a', 'Attack', 'tao-attack');
      attack.setAttribute('href', ATTACK_URL + l.id);
      el.appendChild(attack);
    }
    l.notes.forEach((note) => el.appendChild(make('div', note, 'tao-note')));
    return el;
  }

  // The line under the title.
  function summary(r, key, nowMs) {
    if (!key) return 'Needs an API key.';
    const npcs = r.npcs;
    if (!IDS.some((id) => npcs[id])) return r.error ? 'Couldn\'t read Torn.' : 'Reading Torn...';
    const asleep = PRAETORIANS.filter((id) => down(npcs[id])).length;
    if (asleep < PRAETORIANS.length) return (PRAETORIANS.length - asleep) + ' of 5 praetorians up. M\'aol shielded.';
    const m = npcs[MAOL];
    if (!m) return 'All 5 praetorians down.';
    if (!down(m)) {
      if (m.state !== 'unknown' && m.place) return 'M\'aol can be hit: in ' + m.place + '.';
      return 'M\'aol can be hit: ' + (m.words || 'where is unknown') + '.';
    }
    return 'All asleep. ' + nextSummoning(r, nowMs);
  }

  // When a new summoning is possible: 48 hours after a seen death of M'aol, inside the window
  // patch #408 gives, from 10:00 TCT on Oct 26 to 23:59:59 TCT on Oct 31 of this year.
  function nextSummoning(r, nowMs) {
    const year = new Date(nowMs).getUTCFullYear();
    const opens = Date.UTC(year, 9, 26, 10, 0, 0);
    const ends = Date.UTC(year, 9, 31, 23, 59, 59);
    if (nowMs < opens) return 'Summoning opens ' + clock(opens, nowMs) + '.';
    if (nowMs > ends) return 'No more summonings this Halloween.';
    const m = r.npcs[MAOL];
    const died = m.state === 'beaten' ? m.since : 0;
    if (died) {
      const from = died + RESUMMON_MS;
      if (from > ends) return 'No more summonings this Halloween.';
      if (from <= nowMs) return 'Next summoning possible now (48 h after M\'aol\'s death).';
      return 'Next summoning possible from ' + clock(from, nowMs) + ' (48 h after M\'aol\'s death).';
    }
    return 'Next summoning possible 48 h after M\'aol\'s death.';
  }

  // The footer: how long ago Torn last answered, or why the last call failed.
  function footer(r, key, nowMs) {
    if (!key) return '';
    if (r.stop) return 'Torn won\'t take the key: ' + r.error + '. Save a new key.';
    if (r.error) return 'Couldn\'t read Torn: ' + r.error + '.' + (r.okAt ? ' Last answer ' + ago(nowMs - r.okAt) + ' ago.' : '');
    if (r.okAt) return 'updated ' + ago(nowMs - r.okAt) + ' ago';
    return 'Reading Torn...';
  }

  // How long, in words: seconds under a minute, then minutes, then hours.
  function ago(ms) {
    const s = Math.max(0, Math.round(ms / 1000));
    if (s < 60) return s + ' s';
    const min = Math.floor(s / 60);
    return min < 60 ? min + ' min' : Math.floor(min / 60) + ' h';
  }

  // A time in TCT, Torn's clock (UTC), as HH:MM TCT, with the date when it isn't today.
  function clock(ms, nowMs) {
    const d = new Date(ms);
    const now = new Date(nowMs);
    const time = hhmm(ms) + ' TCT';
    const today = d.getUTCFullYear() === now.getUTCFullYear() && d.getUTCMonth() === now.getUTCMonth() && d.getUTCDate() === now.getUTCDate();
    return today ? time : MONTHS[d.getUTCMonth()] + ' ' + d.getUTCDate() + ' ' + time;
  }

  // A time in TCT as HH:MM, with nothing after it.
  function hhmm(ms) {
    const d = new Date(ms);
    const pad = (v) => (v < 10 ? '0' : '') + v;
    return pad(d.getUTCHours()) + ':' + pad(d.getUTCMinutes());
  }

  // ===== START =====
```

**Edit 2.9: The box, made at start.** Replace:

```js
  tick();
```

With:

```js
  makeBox();
  tick();
```

- [ ] **Step 4: Run the tests to see them pass.** Run `T`, then `C`.

Expected: `# tests 49 # pass 49 # fail 0`, then `ascii-ok`.

- [ ] **Step 5: Commit.**

```bash
WT=/opt/warboard/.superpowers/sdd/2026-10-26-torn-ancient-ones/wt; cd "$WT" && git commit -q -m "torn-ancient-ones: the box: where each one is, its life, standing or beaten and since when, with the next summoning" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- server/public/scripts/torn-ancient-ones.user.js server/torn-ancient-ones.test.mjs && git log --format='%h %s' -1 && git status --short
```

Expected: the commit, then only `?? server/node_modules`.

---

### Task 3: M'aol's route, and asking TornStats

**Files:**
- Modify: `server/public/scripts/torn-ancient-ones.user.js`
- Modify (tests): `server/torn-ancient-ones.test.mjs`

**Interfaces:**
- Consumes, from Task 1: `parseReading(v)`, `readNpc(n)`, `applyProfile(r, id, seen, nowMs)`, `hittable(npcs)`, `down(n)`, `get(url)`, `closed`, `IS_PDA`, `tick()`; from Task 2: `line(id, r, nowMs)`, `nextSummoning(r, nowMs)`, `clock(ms, nowMs)`, `drawSafe()`, `RESUMMON_MS`; in the tests, everything Tasks 1 and 2 produce.
- Produces, in the script:
  - constants: `STOP_MS` (15 minutes), `FALL_GAP_MS` (30 s), `TRAIL_MAX` (20), `FELL_EVERY_MS` (5 minutes), `FELL_MAX_AGE_MS` (8 days), `TORNSTATS_URL`; and `asking`;
  - the reading gains `trail` (M'aol's countries while he could be hit, in order), `fell` (TornStats' defeat times by id, in ms) and `fellAskedAt`; an npc gains `upAt` (when it was last read standing);
  - `readFell(o) -> { id: ms }`, `noteTrail(r, id, before, npc)`, `theirFall(r, id) -> ms`, `fellAt(r, id) -> ms`, `praetorianCountries(npcs) -> string[] | null`, `route(r) -> string[] | null`, `nextStop(r, way) -> { place, at } | null`;
  - `fallsDue(r, nowMs) -> boolean`, `askFalls(nowMs)`.
- Produces, in the test file: `PLACE` (each praetorian's country on Oct 26), `allUp()`, `fall(env, ids)`, `go(env, places)`, `maolNotes(w)`, `TS_1215`, `AT_1215`, `fellEntry(id, iso)` and `at1215(opts, tabOpts)`.

- [ ] **Step 1: Write the failing tests.** Add at the end of `server/torn-ancient-ones.test.mjs`, after a blank line:

```js
// ---------------------------------------------------------------------------------------------
// M'aol's route
// ---------------------------------------------------------------------------------------------

// Where each praetorian awoke on 2026-10-26.
const PLACE = { 100: 'Cayman Islands', 101: 'Mexico', 102: 'Canada', 103: 'Hawaii', 104: 'United Kingdom' };
// All six standing: the praetorians where they awoke, M'aol shielded in Torn City.
const allUp = () => ({ 23: READ_1125[23], 100: up(100, PLACE[100]), 101: up(101, PLACE[101]), 102: up(102, PLACE[102]), 103: up(103, PLACE[103]), 104: up(104, PLACE[104]) });
// The praetorians falling in this order, one a minute.
async function fall(env, ids) {
  for (const id of ids) {
    env.torn[id] = beaten(id, PLACE[id]);
    await env.advance(MIN);
  }
}
// M'aol seen in each of these places in turn, one a minute.
async function go(env, places) {
  for (const place of places) {
    env.torn[23] = up(23, place);
    await env.advance(MIN);
  }
}
// M'aol's notes on how he moves: where he is since when, his next stop, and his route.
const maolNotes = (w) => notes(w, 23).filter((n) => /^(moves|next|route) /.test(n));

test('his route from his moves: once he has been seen in all five countries, in the order first seen', async () => {
  const { env, w } = await started({ torn: allBeaten('Awoken in Mexico') });
  await go(env, ['Cayman Islands', 'United Kingdom', 'Cayman Islands', 'Canada']);
  assert.deepEqual(maolNotes(w), ['moves about every 15 min, here since 10:44 TCT']);
  await go(env, ['Hawaii']);
  assert.deepEqual(maolNotes(w), [
    'moves about every 15 min, here since 10:45 TCT',
    'next Mexico about 11:00 TCT',
    'route Mexico > Cayman Islands > United Kingdom > Canada > Hawaii',
  ]);
  assert.deepEqual(env.reading().trail, ['Mexico', 'Cayman Islands', 'United Kingdom', 'Cayman Islands', 'Canada', 'Hawaii']);
});

test('his route from the falls: each timed by the script, at least 30 s apart', async () => {
  const { env, w } = await started({ torn: allUp() });
  await fall(env, [102, 100, 104, 101, 103]);
  assert.deepEqual(maolNotes(w), ['moves about every 15 min', 'route Canada > Cayman Islands > United Kingdom > Mexico > Hawaii'], 'no next stop from Torn City');
  await go(env, ['Canada']);
  assert.deepEqual(maolNotes(w), [
    'moves about every 15 min, here since 10:46 TCT',
    'next Cayman Islands about 11:01 TCT',
    'route Canada > Cayman Islands > United Kingdom > Mexico > Hawaii',
  ]);
});

test('no route from the falls when two came in one sweep, a country is missing, or two share one', async () => {
  const one = await started({ torn: allUp() });
  one.env.torn[102] = beaten(102, 'Canada');
  one.env.torn[100] = beaten(100, 'Cayman Islands');
  await one.env.advance(MIN);
  await fall(one.env, [104, 101, 103]);
  assert.deepEqual(maolNotes(one.w), ['moves about every 15 min']);

  const missing = await started({ torn: allUp() });
  await fall(missing.env, [102, 100, 104, 101]);
  missing.env.torn[103] = profile(103, 'Dormant', 0, { state: 'Abroad' });
  await missing.env.advance(MIN);
  assert.deepEqual(maolNotes(missing.w), ['moves about every 15 min']);

  const shared = await started({ torn: { ...allUp(), 103: up(103, 'Canada') } });
  await fall(shared.env, [102, 100, 104, 101]);
  shared.env.torn[103] = beaten(103, 'Canada');
  await shared.env.advance(MIN);
  assert.deepEqual(maolNotes(shared.w), ['moves about every 15 min']);
});

test('his moves beat the falls when they disagree', async () => {
  const { env, w } = await started({ torn: allUp() });
  await fall(env, [102, 100, 104, 101, 103]);
  await go(env, ['Mexico', 'Hawaii', 'Canada', 'Cayman Islands']);
  assert.deepEqual(maolNotes(w).slice(1), ['next United Kingdom about 11:04 TCT', 'route Canada > Cayman Islands > United Kingdom > Mexico > Hawaii']);
  await go(env, ['United Kingdom']);
  assert.deepEqual(maolNotes(w).slice(1), ['next Mexico about 11:05 TCT', 'route Mexico > Hawaii > Canada > Cayman Islands > United Kingdom']);
});

test('the next stop has no time when his arrival wasn\'t seen in time, and there is none from Torn City', async () => {
  const { env, w } = await started({ torn: allBeaten('Awoken in Mexico') });
  await go(env, ['Cayman Islands', 'United Kingdom', 'Canada', 'Hawaii']);
  // Out of view for 4 minutes, while he moves on to Mexico.
  w.hide();
  env.torn[23] = up(23, 'Mexico');
  await env.advance(4 * MIN);
  w.show();
  await env.advance(0);
  assert.deepEqual(maolNotes(w), ['moves about every 15 min', 'next Cayman Islands', 'route Mexico > Cayman Islands > United Kingdom > Canada > Hawaii']);
  env.torn[23] = up(23, 'Torn City');
  await env.advance(MIN);
  assert.deepEqual(maolNotes(w), ['moves about every 15 min, here since 10:49 TCT', 'route Mexico > Cayman Islands > United Kingdom > Canada > Hawaii']);
});

test('his moves while shielded don\'t count toward his route', async () => {
  const env = device({ torn: READ_1215 });
  env.now = Date.UTC(2026, 9, 26, 12, 15, 25);
  env.store[KEY_STORE] = KEY;
  const w = env.tab().run();
  await env.advance(0);
  await go(env, ['Mexico', 'United Kingdom']);
  assert.equal(lineText(w, 23), 'M\'aol  United Kingdom  100%  shielded, 2 praetorians up');
  assert.deepEqual(env.reading().trail, []);
  env.torn[102] = beaten(102, 'Canada');
  env.torn[103] = beaten(103, 'Hawaii');
  await env.advance(MIN);
  assert.deepEqual(env.reading().trail, ['United Kingdom']);
});

test('a new summoning empties his trail and TornStats\' times', async () => {
  const { env, w } = await started({ torn: allBeaten('Awoken in Mexico') });
  await go(env, ['Cayman Islands', 'United Kingdom', 'Canada', 'Hawaii']);
  env.tornstats = [{ torn_id: 23, name: 'M\'aol', status: 'Dormant in Hawaii', current_health: 0, max_health: 151200000, hosped_at: '2026-10-26T10:44:30.000000Z' }];
  env.torn[23] = beaten(23, 'Hawaii');
  await env.advance(MIN + 5 * SEC);
  assert.equal(env.reading().trail.length, 5);
  assert.deepEqual(Object.keys(env.reading().fell), ['23']);
  env.torn = allUp();
  await env.advance(MIN);
  assert.deepEqual(env.reading().trail, []);
  assert.deepEqual(env.reading().fell, {});
  assert.equal(lineText(w, 23), 'M\'aol  Torn City  100%  shielded, 5 praetorians up');
});

// ---------------------------------------------------------------------------------------------
// Asking TornStats
// ---------------------------------------------------------------------------------------------

// TornStats' feed of the six at 12:15 TCT on 2026-10-26: the fields the script reads, and a few
// more, as they came.
const TS_1215 = [
  {"torn_id":23,"name":"M'aol","status":"Awoken in Mexico","current_health":151200000,"max_health":151200000,"hosped_at":null,"updated_at":"2026-10-26T12:01:02.000000Z"},
  {"torn_id":100,"name":"Dyno'salam","status":"Dormant in Cayman Islands","current_health":0,"max_health":172500000,"hosped_at":"2026-10-26T11:52:37.000000Z","updated_at":"2026-10-26T11:53:01.000000Z"},
  {"torn_id":101,"name":"Nol'dasaym","status":"Dormant in Mexico","current_health":0,"max_health":129600000,"hosped_at":"2026-10-26T10:24:02.000000Z","updated_at":"2026-10-26T10:24:02.000000Z"},
  {"torn_id":102,"name":"Asmol'yand","status":"Awoken in Canada","current_health":122519445,"max_health":217800000,"hosped_at":null,"updated_at":"2026-10-26T12:15:01.000000Z"},
  {"torn_id":103,"name":"Sylo'nadam","status":"Awoken in Hawaii","current_health":199933784,"max_health":202950000,"hosped_at":null,"updated_at":"2026-10-26T12:15:01.000000Z"},
  {"torn_id":104,"name":"Ladso'myna","status":"Dormant in United Kingdom","current_health":0,"max_health":222000000,"hosped_at":"2026-10-26T11:52:37.000000Z","updated_at":"2026-10-26T11:53:02.000000Z"},
];
const AT_1215 = Date.UTC(2026, 9, 26, 12, 15, 25);
// One feed entry: a defeat time for one of the six.
const fellEntry = (id, iso) => ({ torn_id: id, name: READ_1125[id].name, status: 'Dormant', current_health: 0, max_health: 1, hosped_at: iso });

// A device at 12:15:25 TCT on 2026-10-26, with Torn's and TornStats' answers from then and the
// key saved, and one tab that has read Torn, and 5 s later TornStats.
async function at1215(opts = {}, tabOpts = {}) {
  const env = device({ torn: READ_1215, tornstats: TS_1215, ...opts });
  env.now = AT_1215;
  env.store[KEY_STORE] = KEY;
  const w = env.tab(tabOpts).run();
  await env.advance(5 * SEC);
  return { env, w };
}

test('a beaten one with no time of its own gets TornStats\' time', async () => {
  const { env, w } = await at1215();
  assert.equal(lineText(w, 101), 'Nol\'dasaym  Mexico  beaten 10:24 TCT');
  assert.equal(lineText(w, 100), 'Dyno\'salam  Cayman Islands  beaten 11:52 TCT');
  assert.equal(lineText(w, 104), 'Ladso\'myna  United Kingdom  beaten 11:52 TCT');
  assert.deepEqual(env.reading().fell, { 100: Date.parse('2026-10-26T11:52:37Z'), 101: Date.parse('2026-10-26T10:24:02Z'), 104: Date.parse('2026-10-26T11:52:37Z') });
});

test('TornStats\' times give the route from the falls, but two under 30 s apart give none', async () => {
  const at = Date.UTC(2026, 9, 26, 12, 30);
  const feed = (ukAt) => [fellEntry(101, '2026-10-26T10:24:02Z'), fellEntry(100, '2026-10-26T11:52:37Z'), fellEntry(104, ukAt), fellEntry(102, '2026-10-26T12:10:00Z'), fellEntry(103, '2026-10-26T12:20:00Z')];
  for (const [ukAt, route] of [['2026-10-26T11:52:37Z', null], ['2026-10-26T11:53:30Z', 'route Mexico > Cayman Islands > United Kingdom > Canada > Hawaii']]) {
    const env = device({ torn: allBeaten('Awoken in Mexico'), tornstats: feed(ukAt) });
    env.now = at;
    env.store[KEY_STORE] = KEY;
    const w = env.tab().run();
    await env.advance(5 * SEC);
    assert.deepEqual(maolNotes(w).filter((n) => n.startsWith('route ')), route ? [route] : [], ukAt);
  }
});

test('TornStats is asked only while its time for a beaten one is missing, even one the script timed, and at most every 5 minutes across tabs', async () => {
  const standing = await started({ torn: allUp() });
  await standing.env.advance(10 * MIN);
  assert.equal(standing.env.stats().length, 0, 'none beaten');

  const { env } = await at1215();
  assert.equal(env.stats().length, 1);
  await env.advance(15 * MIN);
  assert.equal(env.stats().length, 1, 'every time known');

  const two = device({ torn: allUp() });
  two.store[KEY_STORE] = KEY;
  two.tab().run();
  two.tab().run();
  await two.advance(0);
  two.torn[100] = beaten(100, 'Cayman Islands');
  await two.advance(MIN);
  assert.equal(two.stats().length, 1, 'the script timed the fall at 10:41, and TornStats is asked all the same');
  await two.advance(5 * MIN - SEC);
  assert.equal(two.stats().length, 1);
  await two.advance(SEC);
  assert.equal(two.stats().length, 2);
});

test('TornStats is not asked from a page out of view, except in Torn PDA', async () => {
  const first = await at1215({ tornstats: [] });
  assert.equal(first.env.stats().length, 1);
  const hidden = await later(first.env, 10 * MIN, { visible: false });
  await hidden.env.advance(10 * MIN);
  assert.equal(hidden.env.stats().length, 0);
  const pda = await later(first.env, 10 * MIN, { visible: false, pda: true });
  await pda.env.advance(5 * SEC);
  assert.equal(pda.env.stats().length, 1);
});

test('a TornStats ask stored ahead of the clock (the clock was set back) doesn\'t stop the asks', async () => {
  const env = device({ torn: READ_1215, tornstats: TS_1215 });
  env.now = AT_1215;
  env.store[KEY_STORE] = KEY;
  env.store[READING_STORE] = JSON.stringify({ fellAskedAt: AT_1215 + 3 * 60 * MIN });
  env.tab().run();
  await env.advance(5 * SEC);
  assert.equal(env.stats().length, 1);
});

test('the request to TornStats is a plain GET of its feed, with no key and no cookies', async () => {
  const { env } = await at1215();
  const r = env.stats()[0];
  assert.equal(r.url, TORNSTATS);
  assert.equal(r.method, 'GET');
  assert.equal(r.anonymous, true);
  assert.equal(r.headers, undefined);
});

test('a time from TornStats counts only when no more than 8 days old, not in the future, and not from before the script last saw it standing', async () => {
  const day = 24 * 60 * MIN;
  for (const [iso, shown] of [
    [new Date(T0 - 9 * day).toISOString(), 'beaten'],
    [new Date(T0 - 7 * day).toISOString(), 'beaten Oct 19 10:40 TCT'],
    [new Date(T0 + 2 * MIN).toISOString(), 'beaten'],
    [new Date(T0 + 30 * SEC).toISOString(), 'beaten 10:40 TCT'],
  ]) {
    const { env, w } = await started({ tornstats: [fellEntry(101, iso)] });
    await env.advance(5 * SEC);
    assert.equal(lineText(w, 101), 'Nol\'dasaym  Mexico  ' + shown, iso);
  }
  for (const [iso, shown] of [[new Date(T0 - 2 * MIN).toISOString(), 'beaten 10:41 TCT'], [new Date(T0 + 30 * SEC).toISOString(), 'beaten 10:40 TCT']]) {
    const { env, w } = await started({ tornstats: [fellEntry(100, iso)] });
    env.torn[100] = beaten(100, 'Cayman Islands');
    await env.advance(MIN + 5 * SEC);
    assert.equal(lineText(w, 100), 'Dyno\'salam  Cayman Islands  ' + shown, iso);
  }
});

test('an answer from TornStats that can\'t be read, or none, changes nothing, and the next try is 5 minutes later', async () => {
  for (const feed of ['<html>busy</html>', null, '{"a":1}', JSON.stringify([{ torn_id: 101, hosped_at: 'soon' }, { torn_id: 999, hosped_at: '2026-10-26T10:00:00Z' }])]) {
    const { env, w } = await started({ tornstats: feed });
    await env.advance(5 * SEC);
    assert.equal(env.stats().length, 1, String(feed));
    assert.equal(lineText(w, 101), 'Nol\'dasaym  Mexico  beaten', String(feed));
    assert.deepEqual(env.reading().fell, {}, String(feed));
    await env.advance(5 * MIN);
    assert.equal(env.stats().length, 2, String(feed));
  }
});

test('a TornStats request still out doesn\'t hold up a sweep, and a sweep still out doesn\'t hold up TornStats', async () => {
  const { env } = await started();
  env.hold = 'tornstats';
  await env.advance(3 * MIN);
  assert.equal(env.stats().length, 1);
  assert.equal(env.torns().length, 24);

  const other = await started();
  await other.env.advance(5 * SEC);
  assert.equal(other.env.stats().length, 1);
  other.env.hold = 'torn';
  await other.env.advance(5 * MIN);
  assert.equal(other.env.torns().length, 7, 'the sweep at 10:41 still waits on M\'aol');
  assert.equal(other.env.stats().length, 2);
});

test('with no GM_xmlhttpRequest, TornStats can\'t be read, and nothing else changes', async () => {
  const { env, w } = await started({ tornstats: [fellEntry(101, '2026-10-26T10:24:02Z')] }, { xhr: false });
  await env.advance(5 * SEC);
  assert.equal(env.stats().length, 1);
  assert.equal(env.stats()[0].via, 'fetch');
  assert.equal(lineText(w, 101), 'Nol\'dasaym  Mexico  beaten');
  assert.equal(env.torns().length, 6);
});

test('the next summoning counts from TornStats\' time for M\'aol\'s death', async () => {
  const { env, w } = await started({ torn: { ...allBeaten(), 23: beaten(23, 'Mexico') }, tornstats: [fellEntry(23, '2026-10-26T10:31:15.000000Z')] });
  await env.advance(5 * SEC);
  assert.equal(lineText(w, 23), 'M\'aol  Mexico  beaten 10:31 TCT');
  assert.equal(summary(w), 'All asleep. Next summoning possible from Oct 28 10:31 TCT (48 h after M\'aol\'s death).');
});
```

- [ ] **Step 2: Run them to see them fail.** Run `T`.

Expected: `# tests 67 # pass 50 # fail 17`. Of the 18 new tests, 17 fail: fifteen on AssertionErrors (no route or next stop under M'aol's line, no TornStats time on a beaten line, no request to TornStats), and two on a TypeError reaching for what isn't there yet (the reading's trail, a TornStats request that never went out). One passes already: "no route from the falls when two came in one sweep, a country is missing, or two share one", which checks that nothing shows. Tasks 1 and 2's 49 still pass.

- [ ] **Step 3: Edit the script.** In `server/public/scripts/torn-ancient-ones.user.js`, fifteen edits, in this order:

**Edit 3.1: M'aol's 15 minutes, the falls' 30 seconds, the trail's size, and how often and how far back TornStats counts.** Replace:

```js
  const RESUMMON_MS = 48 * 60 * 60 * 1000;
```

With:

```js
  const RESUMMON_MS = 48 * 60 * 60 * 1000;
  // M'aol stays this long in each country of his route.
  const STOP_MS = 15 * 60 * 1000;
  // Two falls this close together can't be put in order: the script saw them in the same sweep,
  // or TornStats in the same check.
  const FALL_GAP_MS = 30 * 1000;
  // The most countries M'aol's trail keeps.
  const TRAIL_MAX = 20;
  // TornStats is asked at most this often, across all tabs, while its time for a beaten one is
  // missing.
  const FELL_EVERY_MS = 5 * 60 * 1000;
  // A defeat time older than this is from an earlier summoning: an Ancient One left standing
  // goes dormant within a week.
  const FELL_MAX_AGE_MS = 8 * 24 * 60 * 60 * 1000;
```

**Edit 3.2: The reading's comment: the trail and TornStats' times.** Replace:

```js
  // - npcs: what was read of each Ancient One, by id (see readNpc).
```

With:

```js
  // - npcs: what was read of each Ancient One, by id (see readNpc);
  // - trail: the countries M'aol was seen in while he could be hit, in order;
  // - fell: TornStats' defeat times (ms), by id;
  // - fellAskedAt: when TornStats was last asked (ms), in any tab.
```

**Edit 3.3: The reading keeps the trail and TornStats' times.** Replace:

```js
      npcs: npcs,
```

With:

```js
      npcs: npcs,
      trail: Array.isArray(v.trail) ? v.trail.filter((c) => COUNTRIES.indexOf(c) >= 0).slice(-TRAIL_MAX) : [],
      fell: readFell(v.fell),
      fellAskedAt: Number(v.fellAskedAt) || 0,
```

**Edit 3.4: TornStats' times, as stored.** Replace:

```js
    };
  }

  // One Ancient One as stored:
```

With:

```js
    };
  }

  // TornStats' defeat times as stored: a time (ms) by id, for the six only.
  function readFell(o) {
    const fell = {};
    if (o && typeof o === 'object') {
      IDS.forEach((id) => {
        if (Number(o[id]) > 0) fell[id] = Number(o[id]);
      });
    }
    return fell;
  }

  // One Ancient One as stored:
```

**Edit 3.5: An Ancient One's comment: when it was last read standing.** Replace:

```js
  // - changedAt: when the script last saw it change (ms, 0 for never), for the highlight.
```

With:

```js
  // - changedAt: when the script last saw it change (ms, 0 for never), for the highlight;
  // - upAt: when it was last read standing (ms, 0 for never).
```

**Edit 3.6: An Ancient One keeps when it was last read standing.** Replace:

```js
      changedAt: Number(n.changedAt) || 0,
    };
```

With:

```js
      changedAt: Number(n.changedAt) || 0,
      upAt: Number(n.upAt) || 0,
    };
```

**Edit 3.7: Each answer notes when it was last read standing.** Replace:

```js
    r.npcs[id] = npc;
```

With:

```js
    npc.upAt = npc.state === 'up' ? nowMs : (before ? before.upAt : 0);
    r.npcs[id] = npc;
```

**Edit 3.8: Each answer adds to M'aol's trail.** Replace:

```js
    if (!wasHittable && hittable(r.npcs) && npc.changedAt === nowMs) r.npcs[MAOL].changedAt = nowMs;
  }
```

With:

```js
    if (!wasHittable && hittable(r.npcs) && npc.changedAt === nowMs) r.npcs[MAOL].changedAt = nowMs;
    noteTrail(r, id, before, npc);
  }
```

**Edit 3.9: M'aol's trail, his route and his next stop.** Replace:

```js
  // ===== ASKING TORN =====
```

With:

```js
  // M'aol's trail: a new summoning empties it (and TornStats' defeat times, which were for the
  // summoning before), and while he can be hit, each new country he is seen in is added to it.
  function noteTrail(r, id, before, npc) {
    if (id === MAOL && down(before) && !down(npc)) {
      r.trail = [];
      r.fell = {};
    }
    if (!hittable(r.npcs)) return;
    const place = r.npcs[MAOL].place;
    if (COUNTRIES.indexOf(place) >= 0 && r.trail[r.trail.length - 1] !== place) {
      r.trail.push(place);
      r.trail = r.trail.slice(-TRAIL_MAX);
    }
  }

  // ===== M'AOL'S ROUTE =====

  // TornStats' time for this one's defeat (ms), or 0: none, it isn't beaten, or the time is from
  // more than a minute before the script last saw it standing (an earlier summoning).
  function theirFall(r, id) {
    const n = r.npcs[id];
    const at = r.fell[id] || 0;
    return n && n.state === 'beaten' && at >= n.upAt - 60000 ? at : 0;
  }

  // When this one was defeated (ms), or 0 when not known: TornStats' time, else the script's own,
  // when it saw the fall with a time.
  function fellAt(r, id) {
    const n = r.npcs[id];
    if (!n || n.state !== 'beaten') return 0;
    return theirFall(r, id) || n.since;
  }

  // The praetorians' countries, one each, or null when one is missing or two share a country.
  function praetorianCountries(npcs) {
    const places = PRAETORIANS.map((id) => (npcs[id] ? npcs[id].place : ''));
    if (places.some((p) => COUNTRIES.indexOf(p) < 0)) return null;
    return places.filter((p, i) => places.indexOf(p) === i).length === places.length ? places : null;
  }

  // M'aol's route: his praetorians' countries in the order he visits them, or null when the
  // script doesn't know it. From his moves once his trail holds all five countries, because
  // that is what he did; until then, from the order the praetorians fell, when each has a
  // defeat time and no two came in the same sweep.
  function route(r) {
    const countries = praetorianCountries(r.npcs);
    if (!countries) return null;
    const moves = [];
    r.trail.forEach((c) => {
      if (countries.indexOf(c) >= 0 && moves.indexOf(c) < 0) moves.push(c);
    });
    if (moves.length === countries.length) return moves;
    const falls = PRAETORIANS.map((id) => ({ place: r.npcs[id].place, at: fellAt(r, id) }));
    if (falls.some((f) => !f.at)) return null;
    falls.sort((a, b) => a.at - b.at);
    for (let i = 1; i < falls.length; i++) {
      if (falls[i].at - falls[i - 1].at < FALL_GAP_MS) return null;
    }
    return falls.map((f) => f.place);
  }

  // Where M'aol goes next: the country after his current one on his route, from the last back
  // to the first, and when (15 minutes after he was seen arriving; 0 when his arrival had no
  // time). null with no route, or when he is somewhere not on it.
  function nextStop(r, way) {
    const m = r.npcs[MAOL];
    const i = way && m ? way.indexOf(m.place) : -1;
    if (i < 0) return null;
    return { place: way[(i + 1) % way.length], at: m.since ? m.since + STOP_MS : 0 };
  }

  // ===== ASKING TORN =====
```

**Edit 3.10: Asking TornStats.** Replace:

```js
  // Each tab's check, every 5 seconds
```

With:

```js
  // ===== ASKING TORNSTATS =====

  // TornStats' public feed of the six, which its own M'aol page reads. Only the time it saw each
  // one defeated is used; Torn's API stays the source for everything else.
  const TORNSTATS_URL = 'https://www.tornstats.com/ajax/status/maol';
  // True while this tab is asking TornStats.
  let asking = false;

  // True when TornStats should be asked: one of the six is beaten and TornStats' time for it isn't
  // known yet, the page is visible (PDA can't tell, so there always), and no tab asked in the
  // last 5 minutes. The script's own times are a sweep apart at best, and Torn's cache can put
  // two close falls in the wrong order, so TornStats' times are asked for even then.
  function fallsDue(r, nowMs) {
    if (closed || asking) return false;
    if (!IS_PDA && document.visibilityState === 'hidden') return false;
    if (!IDS.some((id) => r.npcs[id] && r.npcs[id].state === 'beaten' && !theirFall(r, id))) return false;
    return !(r.fellAskedAt <= nowMs && nowMs - r.fellAskedAt < FELL_EVERY_MS);
  }

  // Reads TornStats' feed and keeps each defeat time that is no more than 8 days old and not in
  // the future. The time of the ask is stored first, so another tab sees it and waits. An answer
  // the script can't read, or none, changes nothing.
  function askFalls(nowMs) {
    asking = true;
    const start = readReading();
    start.fellAskedAt = nowMs;
    writeReading(start);
    get(TORNSTATS_URL).then((text) => {
      try {
        const list = JSON.parse(text);
        const r = readReading();
        const now = Date.now();
        (Array.isArray(list) ? list : []).forEach((item) => {
          const id = Number(item && item.torn_id);
          const at = Date.parse(item && item.hosped_at);
          if (IDS.indexOf(id) >= 0 && at > 0 && at <= now + 60000 && now - at <= FELL_MAX_AGE_MS) r.fell[id] = at;
        });
        writeReading(r);
      } catch (e) {
        // Nothing to keep.
      }
      asking = false;
      drawSafe();
    }, () => {
      asking = false;
    });
  }

  // Each tab's check, every 5 seconds
```

**Edit 3.11: The check asks TornStats when it is due.** Replace:

```js
      if (sweepDue(nowMs)) sweep(apiKey(), nowMs);
```

With:

```js
      if (sweepDue(nowMs)) sweep(apiKey(), nowMs);
      if (fallsDue(readReading(), nowMs)) askFalls(nowMs);
```

**Edit 3.12: A beaten line's time: TornStats' first.** Replace:

```js
      state = n.state + (n.since ? ' ' + clock(n.since, nowMs) : '');
```

With:

```js
      const at = n.state === 'beaten' ? fellAt(r, id) : n.since;
      state = n.state + (at ? ' ' + clock(at, nowMs) : '');
```

**Edit 3.13: M'aol's next stop and route, under his line.** Replace:

```js
      notes.push('moves about every 15 min' + (n.since ? ', here since ' + clock(n.since, nowMs) : ''));
```

With:

```js
      notes.push('moves about every 15 min' + (n.since ? ', here since ' + clock(n.since, nowMs) : ''));
      const way = route(r);
      const stop = nextStop(r, way);
      if (stop) notes.push('next ' + stop.place + (stop.at ? ' about ' + clock(stop.at, nowMs) : ''));
      if (way) notes.push('route ' + way.join(' > '));
```

**Edit 3.14: The next summoning's comment.** Replace:

```js
  // When a new summoning is possible: 48 hours after a seen death of M'aol, inside the window
  // patch #408 gives, from 10:00 TCT on Oct 26 to 23:59:59 TCT on Oct 31 of this year.
```

With:

```js
  // When a new summoning is possible: 48 hours after M'aol's death (TornStats' time, or the
  // script's own), inside the window patch #408 gives, from 10:00 TCT on Oct 26 to 23:59:59 TCT
  // on Oct 31 of this year.
```

**Edit 3.15: The next summoning counts from M'aol's defeat time.** Replace:

```js
    const m = r.npcs[MAOL];
    const died = m.state === 'beaten' ? m.since : 0;
```

With:

```js
    const died = fellAt(r, MAOL);
```

- [ ] **Step 4: Run the tests to see them pass.** Run `T`, then `C`.

Expected: `# tests 67 # pass 67 # fail 0`, then `ascii-ok`.

- [ ] **Step 5: Commit.**

```bash
WT=/opt/warboard/.superpowers/sdd/2026-10-26-torn-ancient-ones/wt; cd "$WT" && git commit -q -m "torn-ancient-ones: M'aol's route and next stop, with TornStats' defeat times" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- server/public/scripts/torn-ancient-ones.user.js server/torn-ancient-ones.test.mjs && git log --format='%h %s' -1 && git status --short
```

Expected: the commit, then only `?? server/node_modules`.

---

### Task 4: Where to fly

**Files:**
- Modify: `server/public/scripts/torn-ancient-ones.user.js`
- Modify (tests): `server/torn-ancient-ones.test.mjs`

**Interfaces:**
- Consumes, from Task 1: `readNpc(n)`, `applyProfile(r, id, seen, nowMs)`, `COUNTRIES`, `MAOL`; from Task 2: `line(id, r, nowMs)`, `clock(ms, nowMs)`, `hhmm(ms)`; from Task 3: `route(r)`, `STOP_MS`; in the tests, everything Tasks 1 to 3 produce.
- Produces, in the script:
  - constants: `HIST_MS` (15 minutes), `HIST_MAX` (20), `RATE_WINDOW_MS` (10 minutes), `RATE_MIN_MS` (2 minutes), `SPARE_MIN_MS` (2 minutes), `FLIGHT_MIN` (standard minutes, in `COUNTRIES`' order), `FLIGHTS` (`[['airstrip', 0.7], ['BCT', 0.3]]`), `OVERSTAY_MS` (17 minutes);
  - an npc gains `hist`: `[ms, life]` at each reading while it stands, over the last 15 minutes;
  - `flightMin(place, share) -> minutes`, `deathAt(n) -> ms` (0 for no estimate), `spare(dies, landMs) -> string`, `flyNote(n, nowMs) -> string`, `maolFly(r, way, nowMs) -> string[]`.
- Produces, in the test file: `bleeding(id, lives)`, `M` (a million), `maolInMexico(lives)` and `flyNotes(w)`.

- [ ] **Step 1: Write the failing tests.** Add at the end of `server/torn-ancient-ones.test.mjs`, after a blank line:

```js
// ---------------------------------------------------------------------------------------------
// Where to fly
// ---------------------------------------------------------------------------------------------

// One praetorian read with each of these lives in turn, one a minute, from the first sweep at
// 10:40 TCT. The others stand where they awoke, losing nothing; M'aol is shielded.
async function bleeding(id, lives) {
  const { env, w } = await started({ torn: { ...allUp(), [id]: up(id, PLACE[id], lives[0]) } });
  for (const life of lives.slice(1)) {
    env.torn[id] = up(id, PLACE[id], life);
    await env.advance(MIN);
  }
  return { env, w };
}
const M = 1000000;

test('a standing praetorian\'s death estimate: its loss over 2 minutes or more, counted from its newest reading', async () => {
  const short = await bleeding(102, [100 * M, 99 * M]);
  assert.deepEqual(notes(short.w, 102), ['airstrip 27 min | BCT 12 min'], 'a minute of history is too little');
  const { env, w } = await bleeding(102, [100 * M, 99 * M, 98 * M]);
  assert.deepEqual(notes(w, 102), ['dies about 12:20 TCT | airstrip 27 min: 71 min to spare | BCT 12 min: 86 min to spare']);
  // No readings for 3 minutes: the estimate stays, and the minutes to spare go down.
  w.hide();
  await env.advance(3 * MIN);
  assert.deepEqual(notes(w, 102), ['dies about 12:20 TCT | airstrip 27 min: 68 min to spare | BCT 12 min: 83 min to spare']);
});

test('the rate counts only the last 10 minutes of its history', async () => {
  const lives = [100, 95, 90, 89, 88, 87, 86, 85, 84, 83, 82, 81, 80].map((v) => v * M);
  const { w } = await bleeding(102, lives);
  assert.deepEqual(notes(w, 102), ['dies about 12:12 TCT | airstrip 27 min: 53 min to spare | BCT 12 min: 68 min to spare']);
});

test('no estimate with no loss, or with life going up', async () => {
  const still = await bleeding(102, [100 * M, 100 * M, 100 * M]);
  assert.deepEqual(notes(still.w, 102), ['airstrip 27 min | BCT 12 min']);
  const healing = await bleeding(102, [98 * M, 99 * M, 100 * M]);
  assert.deepEqual(notes(healing.w, 102), ['airstrip 27 min | BCT 12 min']);
});

test('the flight minutes to each of the eleven countries: 70% of the standard time by airstrip, 30% by BCT', async () => {
  const minutes = { 'Mexico': [17, 7], 'Cayman Islands': [23, 10], 'Canada': [27, 12], 'Hawaii': [89, 38], 'United Kingdom': [106, 45], 'Argentina': [111, 47],
    'Switzerland': [116, 50], 'Japan': [149, 64], 'China': [160, 69], 'UAE': [180, 77], 'South Africa': [197, 85] };
  for (const [country, [airstrip, bct]] of Object.entries(minutes)) {
    const { w } = await started({ torn: { ...READ_1125, 100: up(100, country) } });
    assert.deepEqual(notes(w, 100), ['airstrip ' + airstrip + ' min | BCT ' + bct + ' min'], country);
  }
});

test('a flight that lands less than 2 minutes before the estimate is too late', async () => {
  const soon = await bleeding(101, [12 * M, 11 * M, 10 * M]);
  assert.deepEqual(notes(soon.w, 101), ['dies about 10:52 TCT | airstrip 17 min: too late | BCT 7 min: 3 min to spare']);
  const under = await bleeding(101, [2 * M + 8983333, M + 8983333, 8983333]);
  assert.match(notes(under.w, 101)[0], /\| BCT 7 min: too late$/);
  const edge = await bleeding(101, [11 * M, 10 * M, 9 * M]);
  assert.match(notes(edge.w, 101)[0], /\| BCT 7 min: 2 min to spare$/);
});

test('no note for one beaten, or standing where no flight goes', async () => {
  const { w } = await started({ torn: { ...READ_1125, 100: profile(100, 'Awoken in Atlantis', 1000) } });
  assert.deepEqual(notes(w, 100), []);
  assert.deepEqual(notes(w, 101), []);
});

// M'aol hittable with his route known from the falls (Mexico, Cayman Islands, United Kingdom,
// Canada, Hawaii, from 10:41 to 10:45 TCT), seen arriving in Mexico at 10:46 TCT. lives gives
// his life from 10:40 to 10:45, then at 10:46 and each minute after; he stays in Mexico.
async function maolInMexico(lives = [151200000, 151200000]) {
  const { env, w } = await started({ torn: { ...allUp(), 23: up(23, 'Torn City', lives[0]) } });
  await fall(env, [101, 100, 104, 102]);
  env.torn[103] = beaten(103, 'Hawaii');
  await env.advance(MIN);
  for (const life of lives.slice(1)) {
    env.torn[23] = up(23, 'Mexico', life);
    await env.advance(MIN);
  }
  return { env, w };
}
const flyNotes = (w) => notes(w, 23).filter((n) => /^(airstrip|BCT|dies) /.test(n) || /^(airstrip|BCT):/.test(n));

test('M\'aol: for each flight, the stop on his route where it catches him soonest', async () => {
  const { env, w } = await maolInMexico();
  assert.deepEqual(notes(w, 23), [
    'moves about every 15 min, here since 10:46 TCT',
    'next Cayman Islands about 11:01 TCT',
    'route Mexico > Cayman Islands > United Kingdom > Canada > Hawaii',
    'airstrip: fly to Cayman Islands, he\'s there 11:01-11:16 TCT',
    'BCT: fly to Mexico, he\'s there 10:46-11:01 TCT',
  ]);
  await env.advance(6 * MIN);
  assert.deepEqual(flyNotes(w), ['airstrip: fly to Canada, he\'s there 11:31-11:46 TCT', 'BCT: fly to Mexico, he\'s there 10:46-11:01 TCT']);
  await env.advance(MIN);
  assert.deepEqual(flyNotes(w), ['airstrip: fly to Canada, he\'s there 11:31-11:46 TCT', 'BCT: fly to Cayman Islands, he\'s there 11:01-11:16 TCT']);
});

test('M\'aol: his own death estimate, and too late for a flight that catches him less than 2 minutes before it', async () => {
  // 15M lost from 10:40 to 10:47, 5M left: dies at 10:49:20.
  const fast = await maolInMexico([20 * M, 12 * M, 5 * M]);
  assert.deepEqual(flyNotes(fast.w), ['dies about 10:49 TCT', 'airstrip: too late', 'BCT: too late']);
  // 7M lost from 10:40 to 10:47, 13M left: dies at 11:00. BCT lands in Mexico at 10:54.
  const slow = await maolInMexico([20 * M, 16 * M, 13 * M]);
  assert.deepEqual(flyNotes(slow.w), ['dies about 11:00 TCT', 'airstrip: too late', 'BCT: fly to Mexico, he\'s there 10:46-11:01 TCT']);
});

test('M\'aol: nothing on where to fly once he has stayed more than 17 minutes in one country', async () => {
  const { env, w } = await maolInMexico();
  await env.advance(17 * MIN);
  assert.equal(flyNotes(w).length, 2, 'seen there 17 minutes after he arrived');
  await env.advance(MIN);
  assert.deepEqual(flyNotes(w), []);
  assert.deepEqual(notes(w, 23).slice(0, 2), ['moves about every 15 min, here since 10:46 TCT', 'next Cayman Islands about 11:01 TCT']);
});

test('M\'aol: a stop that runs past midnight shows the date on its end', async () => {
  const env = device({ torn: allUp() });
  env.now = Date.UTC(2026, 9, 26, 23, 35);
  env.store[KEY_STORE] = KEY;
  const w = env.tab().run();
  await env.advance(0);
  await fall(env, [101, 100, 104, 102, 103]);
  await go(env, ['Mexico']);
  assert.deepEqual(flyNotes(w), ['airstrip: fly to Cayman Islands, he\'s there 23:56-Oct 27 00:11 TCT', 'BCT: fly to Mexico, he\'s there 23:41-23:56 TCT']);
});

test('M\'aol: nothing on where to fly without his route, or without a time for his arrival', async () => {
  const noRoute = await started({ torn: allBeaten('Awoken in Mexico') });
  await go(noRoute.env, ['Cayman Islands']);
  assert.deepEqual(flyNotes(noRoute.w), []);
  const { env, w } = await maolInMexico();
  w.hide();
  env.torn[23] = up(23, 'Cayman Islands');
  await env.advance(4 * MIN);
  w.show();
  await env.advance(0);
  assert.deepEqual(flyNotes(w), []);
});

test('while an estimate shows, the lines are built again only when what they say changes, not every 5 seconds', async () => {
  const { env, w } = await bleeding(102, [100 * M, 99 * M, 98 * M]);
  let el = lineEl(w, 102);
  let rebuilt = 0;
  for (let i = 1; i <= 120; i++) {
    if (i % 12 === 0) env.torn[102] = up(102, 'Canada', (98 - i / 12) * M);
    await env.advance(5 * SEC);
    if (lineEl(w, 102) !== el) {
      rebuilt += 1;
      el = lineEl(w, 102);
    }
  }
  assert.ok(rebuilt >= 10 && rebuilt <= 20, 'built again ' + rebuilt + ' times in 10 minutes');
});
```

- [ ] **Step 2: Run them to see them fail.** Run `T`.

Expected: `# tests 79 # pass 69 # fail 10`. Of the 12 new tests, 10 fail on AssertionErrors: nine find no `dies about` and no flight notes, and one finds the line `built again 4 times in 10 minutes`, because with no notes only its whole percent changes. Two pass already, "no note for one beaten, or standing where no flight goes" and "M'aol: nothing on where to fly without his route, or without a time for his arrival", which check that nothing shows. Tasks 1 to 3's 67 still pass.

- [ ] **Step 3: Edit the script.** In `server/public/scripts/torn-ancient-ones.user.js`, seven edits, in this order:

**Edit 4.1: The life history's and the rate's times, and the 2 minutes to spare.** Replace:

```js
  const FELL_MAX_AGE_MS = 8 * 24 * 60 * 60 * 1000;
```

With:

```js
  const FELL_MAX_AGE_MS = 8 * 24 * 60 * 60 * 1000;
  // Each one's life is kept from each reading over this long, for the rate it is losing life.
  const HIST_MS = 15 * 60 * 1000;
  const HIST_MAX = 20;
  // The rate is taken over this long, and needs at least this much of it.
  const RATE_WINDOW_MS = 10 * 60 * 1000;
  const RATE_MIN_MS = 2 * 60 * 1000;
  // A flight that lands less than this before the death estimate is too late.
  const SPARE_MIN_MS = 2 * 60 * 1000;
```

**Edit 4.2: An Ancient One's comment: its life history.** Replace:

```js
  // - upAt: when it was last read standing (ms, 0 for never).
```

With:

```js
  // - upAt: when it was last read standing (ms, 0 for never);
  // - hist: its life at each reading while standing, over the last 15 minutes, as [ms, life].
```

**Edit 4.3: An Ancient One keeps its life history.** Replace:

```js
      upAt: Number(n.upAt) || 0,
```

With:

```js
      upAt: Number(n.upAt) || 0,
      hist: Array.isArray(n.hist)
        ? n.hist.filter((h) => Array.isArray(h) && Number(h[0]) > 0 && Number.isFinite(Number(h[1]))).map((h) => [Number(h[0]), Number(h[1])]).slice(-HIST_MAX)
        : [],
```

**Edit 4.4: Each answer adds to the life history.** Replace:

```js
    r.npcs[id] = npc;
```

With:

```js
    // Its life over the last 15 minutes, kept only while it stands.
    const kept = before && before.state === 'up' && npc.state === 'up'
      ? before.hist.filter((h) => h[0] <= nowMs && nowMs - h[0] <= HIST_MS)
      : [];
    npc.hist = npc.state === 'up' ? kept.concat([[nowMs, npc.cur]]).slice(-HIST_MAX) : [];
    r.npcs[id] = npc;
```

**Edit 4.5: Where to fly.** Replace:

```js
  // ===== ASKING TORN =====
```

With:

```js
  // ===== WHERE TO FLY =====

  // Standard flight minutes from Torn City to each of COUNTRIES, in the same order, from
  // TornTools' travel table (as of 21 Oct 2026).
  const FLIGHT_MIN = [24, 33, 39, 127, 151, 158, 166, 213, 229, 257, 282];
  // The two ways of flying the box checks, and the share of the standard time each takes.
  const FLIGHTS = [['airstrip', 0.7], ['BCT', 0.3]];
  // M'aol seen in one country longer than this means his 15 minutes don't hold right now, so the
  // box doesn't say where to fly for him.
  const OVERSTAY_MS = STOP_MS + 2 * 60 * 1000;

  // A flight's minutes from Torn City: the standard time times its share, rounded to the minute.
  // 0 for a place with no flight.
  function flightMin(place, share) {
    const i = COUNTRIES.indexOf(place);
    return i < 0 ? 0 : Math.round(FLIGHT_MIN[i] * share);
  }

  // When this one should die (ms), from how fast its life dropped: the life lost from its oldest
  // reading in the 10 minutes before its newest, which must be at least 2 minutes back, gives the
  // rate. The estimate counts from the newest reading. 0 when it isn't losing life, or there is
  // too little history.
  function deathAt(n) {
    const h = n && n.state === 'up' ? n.hist : [];
    if (h.length < 2) return 0;
    const last = h[h.length - 1];
    const first = h.find((x) => last[0] - x[0] <= RATE_WINDOW_MS);
    if (last[0] - first[0] < RATE_MIN_MS || first[1] <= last[1]) return 0;
    const rate = (first[1] - last[1]) / (last[0] - first[0]);
    return last[0] + Math.round(last[1] / rate);
  }

  // A flight landing at landMs against a death estimate: the whole minutes to spare, or too late
  // when it lands less than 2 minutes before.
  function spare(dies, landMs) {
    const ms = dies - landMs;
    return ms < SPARE_MIN_MS ? 'too late' : Math.floor(ms / 60000) + ' min to spare';
  }

  // The note under a standing praetorian: when it should die, then each flight's minutes and
  // whether it lands in time. With no estimate, only the minutes. '' when its country has no
  // flight.
  function flyNote(n, nowMs) {
    if (!flightMin(n.place, 1)) return '';
    const dies = deathAt(n);
    const parts = dies ? ['dies about ' + clock(dies, nowMs)] : [];
    FLIGHTS.forEach((f) => {
      const min = flightMin(n.place, f[1]);
      parts.push(f[0] + ' ' + min + ' min' + (dies ? ': ' + spare(dies, nowMs + min * 60000) : ''));
    });
    return parts.join(' | ');
  }

  // Where each flight catches M'aol soonest, once his route is known and his arrival here had a
  // time: his stops are 15 minutes each, in route order from his arrival here, round and round.
  // For each country on the route, a flight catches him on his first stop there that he leaves
  // at least 2 minutes after it lands. The soonest catch wins, and it is too late when he should
  // die less than 2 minutes after it. No notes when he has stayed longer than his 15 minutes.
  function maolFly(r, way, nowMs) {
    const m = r.npcs[MAOL];
    const here = way && m ? way.indexOf(m.place) : -1;
    if (here < 0 || !m.since || m.readAt - m.since > OVERSTAY_MS) return [];
    const dies = deathAt(m);
    return FLIGHTS.map((f) => {
      let best = null;
      way.forEach((place, i) => {
        const land = nowMs + flightMin(place, f[1]) * 60000;
        let k = (i - here + way.length) % way.length;
        while (m.since + (k + 1) * STOP_MS - SPARE_MIN_MS < land) k += way.length;
        const from = m.since + k * STOP_MS;
        const at = Math.max(land, from);
        if (!best || at < best.at) best = { place: place, at: at, from: from };
      });
      if (dies && dies - best.at < SPARE_MIN_MS) return f[0] + ': too late';
      return f[0] + ': fly to ' + best.place + ', he\'s there ' + hhmm(best.from) + '-' + clock(best.from + STOP_MS, nowMs);
    });
  }

  // ===== ASKING TORN =====
```

**Edit 4.6: M'aol's death estimate and where to fly, under his line.** Replace:

```js
      if (way) notes.push('route ' + way.join(' > '));
```

With:

```js
      if (way) notes.push('route ' + way.join(' > '));
      const dies = deathAt(n);
      if (dies) notes.push('dies about ' + clock(dies, nowMs));
      maolFly(r, way, nowMs).forEach((note) => notes.push(note));
```

**Edit 4.7: A standing praetorian's note.** Replace:

```js
      state = 'shielded, ' + up + ' praetorian' + (up === 1 ? '' : 's') + ' up';
    }
```

With:

```js
      state = 'shielded, ' + up + ' praetorian' + (up === 1 ? '' : 's') + ' up';
    } else if (n.state === 'up') {
      const note = flyNote(n, nowMs);
      if (note) notes.push(note);
    }
```

- [ ] **Step 4: Run the tests to see them pass.** Run `T`, then `C`.

Expected: `# tests 79 # pass 79 # fail 0`, then `ascii-ok`.

- [ ] **Step 5: Commit.**

```bash
WT=/opt/warboard/.superpowers/sdd/2026-10-26-torn-ancient-ones/wt; cd "$WT" && git commit -q -m "torn-ancient-ones: where to fly by airstrip or BCT, against when each one should die" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- server/public/scripts/torn-ancient-ones.user.js server/torn-ancient-ones.test.mjs && git log --format='%h %s' -1 && git status --short
```

Expected: the commit, then only `?? server/node_modules`.

---

### Task 5: The box's controls and the key, and the mutant check

**Files:**
- Modify: `server/public/scripts/torn-ancient-ones.user.js`
- Modify (tests): `server/torn-ancient-ones.test.mjs`
- Workspace only: `mutants.mjs` (from plan time) and `mut/`.

**Interfaces:**
- Consumes, from Task 1: `gmGet(name)`, `gmSet(name, value)`, `saveChecked(name, value)`, `apiKey()`, `readReading()`, `writeReading(r)`, `tick()`, `closed`, `KEY_STORE`, `BOX_STORE`, `TICK_MS`; from Task 2: `box`, `make(tag, text, className)`, `setText(el, text)`, `makeBox()`, `draw()`, `drawSafe()`, and the box's parts and classes; in the tests, everything Tasks 1 to 4 produce.
- Produces, in the script:
  - `readJson(name) -> object | null`, `TERMS` (Torn's API terms, as rows), `keyOpen`, `drag`, `timer`;
  - `controls()`, `button(text, onClick, className) -> element`, `keyRow() -> element`, `toggleKey()`, `saveKey()`, `readPrefs() -> { left, top, folded }`, `savePrefs(p)`, `showFold(folded)`, `toggleFold()`, `closeBox()`, `placeBox()`, `put(left, top)`, `startDrag(e)`, `moveDrag(e)`, `endDrag()`;
  - the box's new parts, by class: `tao-fold`, `tao-close` and `tao-keybtn` (buttons, with `tao-btn`), and the key row `tao-keyrow`, with `tao-keyfor`, `tao-term`, `tao-key` (the field), `tao-save` and `tao-keymsg`.
- Produces, in the test file: `part(w, cls)`, `press(w, el, x, y, button)`, `saveKey(w, text)` and `stored(env)` (the box's stored place and fold).

- [ ] **Step 1: Write the failing tests.** Add at the end of `server/torn-ancient-ones.test.mjs`, after a blank line:

```js
// ---------------------------------------------------------------------------------------------
// The box's controls
// ---------------------------------------------------------------------------------------------

const part = (w, cls) => boxOf(w).querySelector('.' + cls);
// A press on an element of the page, as a pointer would make it.
function press(w, el, x, y, button = 0) {
  const e = new w.dom.Event('pointerdown', { bubbles: true });
  e.clientX = x;
  e.clientY = y;
  e.button = button;
  el.dispatchEvent(e);
}
// Types a key into the key row and saves it.
function saveKey(w, text) {
  part(w, 'tao-key').value = text;
  part(w, 'tao-save').click();
}
const stored = (env) => JSON.parse(env.store[BOX_STORE]);

test('fold: the box folds to its title bar and stays folded after a reload, and it still reads Torn', async () => {
  const { env, w } = await started();
  let bodyClicks = 0;
  w.document.body.addEventListener('click', () => { bodyClicks += 1; });
  assert.equal(part(w, 'tao-fold').textContent, '-');
  part(w, 'tao-fold').click();
  assert.ok(boxOf(w).classList.contains('tao-folded'));
  assert.equal(part(w, 'tao-fold').textContent, '+');
  assert.equal(part(w, 'tao-fold').getAttribute('title'), 'Open the box');
  assert.equal(stored(env).folded, true);
  assert.equal(bodyClicks, 0, 'the click goes no further than the box');
  assert.match(w.document.getElementById('tao-styles').textContent, /#tao-box\.tao-folded \.tao-body\{display:none\}/);
  await env.advance(2 * MIN);
  assert.equal(env.torns().length, 18);
  const reload = env.tab().run();
  assert.ok(boxOf(reload).classList.contains('tao-folded'));
  part(reload, 'tao-fold').click();
  assert.equal(boxOf(reload).classList.contains('tao-folded'), false);
  assert.equal(stored(env).folded, false);
});

test('close: the box goes until the page reloads, and the page asks Torn and TornStats nothing more', async () => {
  const { env, w } = await started();
  part(w, 'tao-close').click();
  assert.equal(boxOf(w), null);
  const torns = env.torns().length;
  await env.advance(10 * MIN);
  assert.equal(env.torns().length, torns);
  assert.equal(env.stats().length, 0);
  const reload = env.tab().run();
  await env.advance(0);
  assert.ok(boxOf(reload));
});

test('closing the box mid-sweep stops the sweep: no more calls go out', async () => {
  const { env, w } = await started();
  env.hold = 'torn';
  await env.advance(MIN);
  assert.equal(env.torns().length, 7);
  part(w, 'tao-close').click();
  env.hold = false;
  await env.release();
  await env.advance(MIN);
  assert.equal(env.torns().length, 7);
});

test('a drag by the title bar moves the box, saves its place, and leaves the page\'s own styles alone', async () => {
  const { env, w } = await started();
  press(w, part(w, 'tao-head'), 100, 700);
  w.fire('pointermove', { clientX: 150, clientY: 650 });
  assert.equal(boxOf(w).style.left, '70px');
  assert.equal(boxOf(w).style.top, '530px');
  w.fire('pointerup', {});
  assert.deepEqual(stored(env), { left: 70, top: 530, folded: false });
  assert.equal(w.document.body.getAttribute('style'), null);
  assert.equal(w.document.documentElement.getAttribute('style'), null);
  w.fire('pointermove', { clientX: 300, clientY: 300 });
  assert.equal(boxOf(w).style.left, '70px', 'the drag is over');
  const reload = env.tab().run();
  assert.equal(boxOf(reload).style.left, '70px');
  assert.equal(boxOf(reload).style.top, '530px');
});

test('a drag cut off part way still ends, and saves where it got to', async () => {
  for (const end of ['pointercancel', 'blur']) {
    const { env, w } = await started();
    press(w, part(w, 'tao-head'), 100, 700);
    w.fire('pointermove', { clientX: 90, clientY: 690 });
    w.fire(end, {});
    assert.deepEqual(stored(env), { left: 10, top: 570, folded: false }, end);
    w.fire('pointermove', { clientX: 300, clientY: 300 });
    assert.equal(boxOf(w).style.left, '10px', end);
  }
});

test('a press on a button in the title bar, or with another mouse button, is no drag, and a press that doesn\'t move saves nothing', async () => {
  const { env, w } = await started();
  press(w, part(w, 'tao-fold'), 100, 700);
  w.fire('pointermove', { clientX: 150, clientY: 650 });
  w.fire('pointerup', {});
  assert.equal(boxOf(w).style.left, '');
  press(w, part(w, 'tao-head'), 100, 700, 2);
  w.fire('pointermove', { clientX: 150, clientY: 650 });
  w.fire('pointerup', {});
  assert.equal(boxOf(w).style.left, '');
  press(w, part(w, 'tao-head'), 100, 700);
  w.fire('pointerup', {});
  assert.equal(BOX_STORE in env.store, false);
});

test('a saved place is pulled back inside the window on load and on resize, and left as saved', async () => {
  const env = device({ store: { [KEY_STORE]: KEY, [BOX_STORE]: JSON.stringify({ left: 1200, top: 700, folded: false }) } });
  const w = env.tab().run();
  assert.equal(boxOf(w).style.left, '980px');
  assert.equal(boxOf(w).style.top, '600px');
  w.win.innerWidth = 400;
  w.win.innerHeight = 700;
  w.fire('resize', {});
  assert.equal(boxOf(w).style.left, '100px');
  assert.equal(boxOf(w).style.top, '500px');
  assert.deepEqual(stored(env), { left: 1200, top: 700, folded: false });
  const strings = device({ store: { [BOX_STORE]: JSON.stringify({ left: '12', top: '34' }) } }).tab().run();
  assert.equal(boxOf(strings).style.left, '12px');
  const junk = device({ store: { [BOX_STORE]: JSON.stringify({ left: 'far', top: null }) } }).tab().run();
  assert.equal(boxOf(junk).style.left, '');
});

test('the key row: in place of the lines with no key, and opened by the Key button with one', async () => {
  const none = device();
  const a = none.tab().run();
  await none.advance(0);
  assert.equal(part(a, 'tao-keyrow').hidden, false);
  assert.equal(part(a, 'tao-lines').hidden, true);
  const input = part(a, 'tao-key');
  assert.equal(input.getAttribute('type'), 'text');
  assert.equal(input.getAttribute('autocomplete'), 'off');
  assert.equal(input.getAttribute('placeholder'), 'Your API key');
  assert.deepEqual([...boxOf(a).querySelectorAll('.tao-term')].map((t) => t.textContent), [
    'Data Storage: Only on this device: the six NPCs\' last reading, the box\'s place, your key.',
    'Data Sharing: None. The script also reads TornStats\' public feed of the six, and sends TornStats nothing of yours.',
    'Purpose of Use: Show where the Ancient Ones are and which can be attacked.',
    'Key Storage & Sharing: Stored on this device in the script\'s storage; sent only to Torn\'s API.',
    'Key Access Level: Public.',
  ]);
  const { w } = await started();
  assert.equal(part(w, 'tao-keyrow').hidden, true);
  part(w, 'tao-keybtn').click();
  assert.equal(part(w, 'tao-keyrow').hidden, false);
  assert.equal(part(w, 'tao-lines').hidden, false);
  part(w, 'tao-keybtn').click();
  assert.equal(part(w, 'tao-keyrow').hidden, true);
});

test('saving a key stores it, shows only its last 4, closes the row and reads Torn at once', async () => {
  const env = device();
  const w = env.tab().run();
  await env.advance(30 * SEC);
  assert.equal(env.torns().length, 0);
  saveKey(w, '  ' + KEY + ' ');
  await env.advance(0);
  assert.equal(env.store[KEY_STORE], KEY);
  assert.equal(part(w, 'tao-key').value, '');
  assert.equal(part(w, 'tao-key').getAttribute('placeholder'), '************wxyz');
  assert.equal(part(w, 'tao-keyrow').hidden, true);
  assert.equal(env.torns().length, 6);
  assert.equal(boxOf(w).textContent.includes(KEY), false);
});

test('a key saved within a minute of the last sweep is used at once', async () => {
  const { env, w } = await started();
  await env.advance(10 * SEC);
  part(w, 'tao-keybtn').click();
  saveKey(w, 'NewKey000000abc');
  await env.advance(0);
  assert.equal(env.torns().length, 12);
  assert.ok(env.torns().slice(6).every((r) => r.url.includes('&key=NewKey000000abc&')));
});

test('a key Torn won\'t take stops the sweeps until a new key is saved', async () => {
  const env = device();
  env.store[KEY_STORE] = KEY;
  env.tornError = { code: 2, error: 'Incorrect key' };
  const w = env.tab().run();
  await env.advance(3 * MIN);
  assert.equal(env.torns().length, 1);
  assert.equal(part(w, 'tao-keyrow').hidden, false, 'the row opens itself');
  env.tornError = null;
  saveKey(w, 'NewKey000000abc');
  await env.advance(0);
  assert.equal(env.torns().length, 7);
  assert.ok(env.torns().slice(1).every((r) => r.url.includes('&key=NewKey000000abc&')));
  assert.equal(footer(w), 'updated 0 s ago');
  assert.equal(part(w, 'tao-keyrow').hidden, true);
});

test('saving an empty field removes the saved key, and PDA\'s is used again', async () => {
  const { env, w } = await started({}, { pda: true });
  assert.ok(env.torns().every((r) => r.url.includes('&key=' + KEY + '&')));
  part(w, 'tao-keybtn').click();
  saveKey(w, '');
  await env.advance(0);
  assert.equal(env.store[KEY_STORE], '');
  assert.equal(env.torns().length, 12);
  assert.ok(env.torns().slice(6).every((r) => r.url.includes('&key=' + PDA_KEY + '&')));
  assert.equal(part(w, 'tao-key').getAttribute('placeholder'), '************DA12');
});

test('a key storage won\'t keep is not used, and the row says so', async () => {
  const env = device();
  const w = env.tab({ setValue: (store, k, v) => { if (k === KEY_STORE) throw new Error('full'); store[k] = v; } }).run();
  await env.advance(0);
  saveKey(w, KEY);
  await env.advance(MIN);
  assert.equal(part(w, 'tao-keymsg').textContent, 'Couldn\'t save the key on this device.');
  assert.equal(env.torns().length, 0);
  assert.equal(summary(w), 'Needs an API key.');
});
```

- [ ] **Step 2: Run them to see them fail.** Run `T`.

Expected: `# tests 92 # pass 79 # fail 13`. Ten of the 13 new tests fail on a TypeError, reaching for the fold, close or Key button, the key field or the key row, none of which exist yet. Two fail on AssertionErrors (a drag, or a saved place, moves nothing yet), and one on a SyntaxError reading the box's stored place, which nothing saved. Tasks 1 to 4's 79 still pass.

- [ ] **Step 3: Edit the script.** In `server/public/scripts/torn-ancient-ones.user.js`, four edits, in this order:

**Edit 5.1: readJson, before the key.** Replace:

```js
  // The key for Torn's API
```

With:

```js
  // A stored object, from a string of JSON (PDA hands back strings) or as it is. null when
  // nothing is stored or it won't parse.
  function readJson(name) {
    let v = gmGet(name);
    try {
      if (typeof v === 'string') v = v ? JSON.parse(v) : null;
    } catch (e) {
      v = null;
    }
    return v && typeof v === 'object' ? v : null;
  }

  // The key for Torn's API
```

**Edit 5.2: The key row and its hint, in the drawing.** Replace:

```js
    box.querySelector('.tao-head').classList.toggle('tao-new', lines.some((l) => l.fresh));
```

With:

```js
    box.querySelector('.tao-head').classList.toggle('tao-new', lines.some((l) => l.fresh));
    // The key row shows with no key, with a key Torn refused, or when the Key button opened it.
    // With no key, it takes the lines' place.
    const row = box.querySelector('.tao-keyrow');
    const showRow = !key || r.stop || keyOpen;
    if (row.hidden === showRow) row.hidden = !showRow;
    const holder = box.querySelector('.tao-lines');
    if (holder.hidden !== !key) holder.hidden = !key;
    // The field's grey hint: the key in use with all but its last 4 hidden, never more.
    const hint = key ? '************' + key.slice(-4) : 'Your API key';
    const input = box.querySelector('.tao-key');
    if (input.getAttribute('placeholder') !== hint) input.setAttribute('placeholder', hint);
```

**Edit 5.3: The box's controls: fold, close, drag and the key row.** Replace:

```js
  // ===== START =====
```

With:

```js
  // ===== THE BOX'S CONTROLS =====

  // True while the Key button has the key row open.
  let keyOpen = false;
  // A drag under way: where the pointer and the box started, and whether the box moved.
  let drag = null;
  // Torn's API terms, as the script's header has them, shown in the key row.
  const TERMS = [
    ['Data Storage', 'Only on this device: the six NPCs\' last reading, the box\'s place, your key.'],
    ['Data Sharing', 'None. The script also reads TornStats\' public feed of the six, and sends TornStats nothing of yours.'],
    ['Purpose of Use', 'Show where the Ancient Ones are and which can be attacked.'],
    ['Key Storage & Sharing', 'Stored on this device in the script\'s storage; sent only to Torn\'s API.'],
    ['Key Access Level', 'Public.'],
  ];

  // The fold and close buttons, the key row, the Key button, the drag, and the box put at its
  // saved place.
  function controls() {
    const head = box.querySelector('.tao-head');
    head.appendChild(button('-', toggleFold, 'tao-fold'));
    head.appendChild(button('x', closeBox, 'tao-close'));
    const foot = box.querySelector('.tao-foot');
    foot.parentNode.insertBefore(keyRow(), foot);
    foot.appendChild(button('Key', toggleKey, 'tao-keybtn'));
    showFold(readPrefs().folded);
    placeBox();
    head.addEventListener('pointerdown', startDrag);
    window.addEventListener('pointermove', moveDrag);
    window.addEventListener('pointerup', endDrag);
    window.addEventListener('pointercancel', endDrag);
    window.addEventListener('blur', endDrag);
    window.addEventListener('resize', placeBox);
  }

  // A button of the box's. A click on it goes no further, and a surprise never breaks the page.
  function button(text, onClick, className) {
    const b = make('button', text, 'tao-btn ' + className);
    b.setAttribute('type', 'button');
    b.addEventListener('click', (e) => {
      if (e && e.stopPropagation) e.stopPropagation();
      try {
        onClick();
      } catch (err) {
        // Nothing more to do.
      }
    });
    return b;
  }

  // The box's place and fold, as stored: left and top (px; null for the default place, bottom
  // left), and whether it is folded.
  function readPrefs() {
    const p = readJson(BOX_STORE) || {};
    const num = (v) => (typeof v === 'number' || (typeof v === 'string' && v.trim() !== '')) && Number.isFinite(Number(v)) ? Number(v) : null;
    return { left: num(p.left), top: num(p.top), folded: p.folded === true };
  }

  function savePrefs(p) {
    gmSet(BOX_STORE, JSON.stringify(p));
  }

  // Folds the box to its title bar, or opens it again, and remembers which.
  function toggleFold() {
    const p = readPrefs();
    p.folded = !box.classList.contains('tao-folded');
    showFold(p.folded);
    savePrefs(p);
  }

  function showFold(folded) {
    box.classList.toggle('tao-folded', folded);
    const b = box.querySelector('.tao-fold');
    setText(b, folded ? '+' : '-');
    b.setAttribute('title', folded ? 'Open the box' : 'Fold the box');
  }

  // Closes the box until the page reloads. This page makes no more calls.
  function closeBox() {
    closed = true;
    clearInterval(timer);
    if (box) box.remove();
    box = null;
  }

  // Puts the box here, pulled back inside the window so none of it is off screen.
  function put(left, top) {
    const rect = box.getBoundingClientRect();
    const width = window.innerWidth || 0;
    const height = window.innerHeight || 0;
    box.style.left = Math.round(Math.max(0, Math.min(left, width - rect.width))) + 'px';
    box.style.top = Math.round(Math.max(0, Math.min(top, height - rect.height))) + 'px';
    box.style.right = 'auto';
    box.style.bottom = 'auto';
  }

  // Puts the box at its saved place, if it has one; else it stays at the default, bottom left.
  // Run on load and when the window resizes, so a place saved on a wide screen can't leave the
  // box off a phone's.
  function placeBox() {
    if (!box) return;
    const p = readPrefs();
    if (p.left !== null && p.top !== null) put(p.left, p.top);
  }

  // A drag by the title bar. It never touches the page's own styles, so a drag cut off part
  // way can't leave the page unable to scroll.
  function startDrag(e) {
    if (!box || drag) return;
    if (e.target && e.target.closest && e.target.closest('button')) return;
    if (typeof e.button === 'number' && e.button !== 0) return;
    const rect = box.getBoundingClientRect();
    drag = { x: e.clientX, y: e.clientY, left: rect.left, top: rect.top, moved: false };
    if (e.preventDefault) e.preventDefault();
  }

  function moveDrag(e) {
    if (!drag || !box) return;
    drag.moved = true;
    put(drag.left + e.clientX - drag.x, drag.top + e.clientY - drag.y);
  }

  // Ends a drag, however it ends: the pointer let go, the browser took the touch over, or the
  // window lost focus. Only a drag that moved the box saves its place.
  function endDrag() {
    if (!drag) return;
    const moved = drag.moved;
    drag = null;
    if (!moved || !box) return;
    const p = readPrefs();
    p.left = parseFloat(box.style.left) || 0;
    p.top = parseFloat(box.style.top) || 0;
    savePrefs(p);
  }

  // The key row: what the key is for, Torn's API terms, the field and Save. A plain text field,
  // not a password field, which sets off password managers.
  function keyRow() {
    const row = make('div', '', 'tao-keyrow');
    row.hidden = true;
    row.appendChild(make('div', 'With your API key, the script reads these six NPCs\' profiles from Torn\'s API, once a minute at most. A Public key is enough.', 'tao-keyfor'));
    TERMS.forEach((t) => row.appendChild(make('div', t[0] + ': ' + t[1], 'tao-term')));
    const input = make('input', '', 'tao-key');
    input.setAttribute('type', 'text');
    input.setAttribute('autocomplete', 'off');
    input.setAttribute('spellcheck', 'false');
    input.setAttribute('aria-label', 'API key');
    row.appendChild(input);
    row.appendChild(button('Save', saveKey, 'tao-save'));
    row.appendChild(make('div', '', 'tao-keymsg'));
    return row;
  }

  // Opens or closes the key row.
  function toggleKey() {
    keyOpen = !keyOpen;
    drawSafe();
  }

  // Saves the key in the field. '' removes the saved key, and PDA's is used again, if there is
  // one. A new key starts afresh: the last error, wait and stop go, and a sweep is due at once.
  function saveKey() {
    const input = box.querySelector('.tao-key');
    const value = String(input.value || '').trim();
    if (!saveChecked(KEY_STORE, value)) {
      setText(box.querySelector('.tao-keymsg'), 'Couldn\'t save the key on this device.');
      return;
    }
    input.value = '';
    setText(box.querySelector('.tao-keymsg'), '');
    keyOpen = false;
    const r = readReading();
    r.at = 0;
    r.error = '';
    r.wait = 0;
    r.stop = false;
    writeReading(r);
    tick();
  }

  // ===== START =====
```

**Edit 5.4: The controls, made at start, and the timer kept.** Replace:

```js
  makeBox();
  tick();
  setInterval(tick, TICK_MS);
```

With:

```js
  makeBox();
  controls();
  tick();
  const timer = setInterval(tick, TICK_MS);
```

- [ ] **Step 4: Run the tests to see them pass.** Run `T`, then `C`.

Expected: `# tests 92 # pass 92 # fail 0`, then `ascii-ok`.

- [ ] **Step 5: The mutant check.** Each mutant changes the script in one place, and each must fail at least one test. It runs the test file once per mutant, so it takes a few minutes: run it in the background, or with a long timeout. `mutants.mjs` is in the workspace from plan time (Setup checked its hash). If it must be written again, this is it:

```js
// Mutant check for Torn Ancient Ones, outside the repo: makes one broken copy of the script per
// mutant below, runs the script's tests on each (TAO_SRC), one at a time, and says which the
// tests catch. Every mutant must be caught.
// Usage: node mutants.mjs <script> <test file> <scratch dir>
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { spawnSync } from 'node:child_process';

const [script, tests, dir] = process.argv.slice(2);
const SRC = readFileSync(script, 'utf8');
const META = readFileSync(script.replace(/\.user\.js$/, '.meta.js'), 'utf8');

// [name, text in the script (it must be there exactly once), what replaces it]
const MUTANTS = [
  ['M1 M\'aol hittable from his own words', 'return !!npcs[MAOL] && !down(npcs[MAOL]) && PRAETORIANS.every((id) => down(npcs[id]));', "return !!npcs[MAOL] && npcs[MAOL].state === 'up' && COUNTRIES.indexOf(npcs[MAOL].place) >= 0;"],
  ['M2 the 3-minute rule dropped', 'const timed = nowMs >= before.readAt && nowMs - before.readAt <= TIMED_GAP_MS;', 'const timed = true;'],
  ['M3 a sweep per tab', '    start.at = nowMs;\n    writeReading(start);\n    let i = 0;', '    writeReading(start);\n    let i = 0;'],
  ['M4 sweeping while out of view', "    if (closed || sweeping || !apiKey()) return false;\n    if (!IS_PDA && document.visibilityState === 'hidden') return false;\n", '    if (closed || sweeping || !apiKey()) return false;\n'],
  ['M5 code 2 retried', '            if (KEY_CODES.indexOf(err.code) >= 0) r.stop = true;\n', ''],
  ['M6 calls sent all at once', "    next();\n  }\n\n  // GET one Ancient One's profile.", "    IDS.forEach(() => next());\n  }\n\n  // GET one Ancient One's profile."],
  ['M7 Torn\'s words put in as HTML', "    if (l.where) el.appendChild(make('span', l.where, 'tao-where'));", "    if (l.where) { const s = make('span', '', 'tao-where'); s.innerHTML = l.where; el.appendChild(s); }"],
  ['M8 the drag locking the page', '    drag = { x: e.clientX, y: e.clientY, left: rect.left, top: rect.top, moved: false };\n', "    drag = { x: e.clientX, y: e.clientY, left: rect.left, top: rect.top, moved: false };\n    document.body.style.touchAction = 'none';\n"],
  ['M9 TornStats asked while out of view', "    if (closed || asking) return false;\n    if (!IS_PDA && document.visibilityState === 'hidden') return false;\n", '    if (closed || asking) return false;\n'],
  ['M10 TornStats asked on every check', '    return !(r.fellAskedAt <= nowMs && nowMs - r.fellAskedAt < FELL_EVERY_MS);', '    return true;'],
  ['M11 TornStats\' time from an earlier summoning used', "return n && n.state === 'beaten' && at >= n.upAt - 60000 ? at : 0;", "return n && n.state === 'beaten' ? at : 0;"],
  ['M12 an old TornStats time used', ' && now - at <= FELL_MAX_AGE_MS', ''],
  ['M13 a TornStats time in the future used', 'at <= now + 60000 && ', ''],
  ['M14 requests sent with cookies', '            anonymous: true,\n', '            anonymous: false,\n'],
  ['M15 TornStats asked only when no time at all is known', "r.npcs[id].state === 'beaten' && !theirFall(r, id))", "r.npcs[id].state === 'beaten' && !fellAt(r, id))"],
  ['M16 his moves while shielded counted', '    if (!hittable(r.npcs)) return;\n', '    if (down(r.npcs[MAOL])) return;\n'],
  ['M17 falls under 30 s apart put in order anyway', 'if (falls[i].at - falls[i - 1].at < FALL_GAP_MS) return null;', 'if (falls[i].at - falls[i - 1].at < 0) return null;'],
  ['M18 his moves never give the route', '    if (moves.length === countries.length) return moves;\n', ''],
  ['M19 the next stop doesn\'t wrap', 'place: way[(i + 1) % way.length]', 'place: way[i + 1]'],
  ['M20 a new summoning keeps the trail', '      r.trail = [];\n      r.fell = {};\n', '      r.fell = {};\n'],
  ['M21 the death estimate counted from now', '    return last[0] + Math.round(last[1] / rate);', '    return Date.now() + Math.round(last[1] / rate);'],
  ['M22 the whole history in the rate', 'const first = h.find((x) => last[0] - x[0] <= RATE_WINDOW_MS);', 'const first = h[0];'],
  ['M23 a minute of history enough', 'const RATE_MIN_MS = 2 * 60 * 1000;', 'const RATE_MIN_MS = 60 * 1000;'],
  ['M24 too late only when it lands after', "return ms < SPARE_MIN_MS ? 'too late'", "return ms < 0 ? 'too late'"],
  ['M25 airstrip at half the time', "const FLIGHTS = [['airstrip', 0.7], ['BCT', 0.3]];", "const FLIGHTS = [['airstrip', 0.5], ['BCT', 0.3]];"],
  ['M26 flight minutes rounded down', 'return i < 0 ? 0 : Math.round(FLIGHT_MIN[i] * share);', 'return i < 0 ? 0 : Math.floor(FLIGHT_MIN[i] * share);'],
  ['M27 M\'aol caught with no time to spare', 'while (m.since + (k + 1) * STOP_MS - SPARE_MIN_MS < land) k += way.length;', 'while (m.since + (k + 1) * STOP_MS < land) k += way.length;'],
  ['M28 no check that his 15 minutes hold', 'if (here < 0 || !m.since || m.readAt - m.since > OVERSTAY_MS) return [];', 'if (here < 0 || !m.since) return [];'],
  ['M29 a stop past midnight without its date', "hhmm(best.from) + '-' + clock(best.from + STOP_MS, nowMs)", "hhmm(best.from) + '-' + hhmm(best.from + STOP_MS) + ' TCT'"],
  ['M30 the lines built again on every check', '    if (plan !== drawn) {', '    if (true) {'],
  ['M31 the highlight for 10 minutes', 'const HIGHLIGHT_MS = 5 * 60 * 1000;', 'const HIGHLIGHT_MS = 10 * 60 * 1000;'],
  ['M32 the fold not saved', '    showFold(p.folded);\n    savePrefs(p);\n', '    showFold(p.folded);\n'],
  ['M33 closing doesn\'t stop a sweep under way', '    closed = true;\n    clearInterval(timer);\n', '    clearInterval(timer);\n'],
  ['M34 the place not pulled back on resize', "    window.addEventListener('resize', placeBox);\n", ''],
  ['M35 the hint shows more of the key', "const hint = key ? '************' + key.slice(-4) : 'Your API key';", "const hint = key ? '************' + key.slice(-6) : 'Your API key';"],
  ['M36 a saved key waits for the next minute', '    const r = readReading();\n    r.at = 0;\n', '    const r = readReading();\n'],
  ['M37 PDA\'s key beats a saved one', "    if (typeof saved === 'string' && saved.trim()) return saved.trim();\n    return HAS_PDA_KEY ? PDA_KEY : '';", "    if (HAS_PDA_KEY) return PDA_KEY;\n    if (typeof saved === 'string' && saved.trim()) return saved.trim();\n    return '';"],
  ['M38 the warboard app counted as PDA', "const IS_PDA = typeof window.flutter_inappwebview !== 'undefined' && !IS_WARBOARD;", "const IS_PDA = typeof window.flutter_inappwebview !== 'undefined';"],
  ['M39 GM_getValue unguarded', "return typeof GM_getValue === 'function' ? GM_getValue(name, '') : '';", "return GM_getValue(name, '');"],
  ['M40 the key left in Torn\'s message', "return key ? text.split(key).join('****') : text;", 'return text;'],
  ['M41 the next summoning 24 h after', 'const RESUMMON_MS = 48 * 60 * 60 * 1000;', 'const RESUMMON_MS = 24 * 60 * 60 * 1000;'],
  ['M42 the window\'s end ignored', "    if (nowMs > ends) return 'No more summonings this Halloween.';\n", ''],
  ['M43 a second copy runs too', "  if (root.hasAttribute('data-torn-ancient-ones')) return;\n", ''],
  ['M44 code 5 not waited out', '            if (WAIT_CODES.indexOf(err.code) >= 0) r.wait = Date.now() + BACK_OFF_MS;\n', ''],
  ['M45 only the tab that sweeps draws', '      if (fallsDue(readReading(), nowMs)) askFalls(nowMs);\n      draw();\n', '      if (fallsDue(readReading(), nowMs)) askFalls(nowMs);\n'],
  ['M46 no copy of its own when storage won\'t save', '    tabCopy = saveChecked(READING_STORE, text) ? null : parseReading(text);', '    saveChecked(READING_STORE, text);'],
  ['M47 a sweep under way holds up TornStats', '    if (closed || asking) return false;\n', '    if (closed || asking || sweeping) return false;\n'],
  ['M48 TornStats under way holds up a sweep', '    if (closed || sweeping || !apiKey()) return false;\n', '    if (closed || sweeping || asking || !apiKey()) return false;\n'],
  ['M49 the script\'s own time beats TornStats\'', '    return theirFall(r, id) || n.since;', '    return n.since || theirFall(r, id);'],
  ['M50 dormant read as beaten', "kind = Number.isFinite(cur) && cur > 0 ? 'dormant' : 'beaten';", "kind = 'beaten';"],
  ['M51 a country read in one letter case', 'return COUNTRIES.find((c) => c.toLowerCase() === name) || \'\';', 'return COUNTRIES.find((c) => c === m[1]) || \'\';'],
  ['M52 life 0 under "Awoken" read as standing', '    if (Number.isFinite(cur) && cur <= 0) asleep = true;\n', ''],
  ['M53 the order of the lines by id', 'sort((a, b) => rank(a) - rank(b) || a - b)', 'sort((a, b) => a - b)'],
  ['M54 Attack shown for the shielded M\'aol', "const canHit = id === MAOL ? hittable(r.npcs) : n.state === 'up';", "const canHit = n.state === 'up';"],
  ['M55 a sweep time ahead of the clock stops the sweeps', '    return !(r.at <= nowMs && nowMs - r.at < SWEEP_EVERY_MS);', '    return !(nowMs - r.at < SWEEP_EVERY_MS);'],
  ['M56 a wait ahead of the clock stops the sweeps', '    if (r.wait > nowMs && r.wait - nowMs <= BACK_OFF_MS) return false;', '    if (r.wait > nowMs) return false;'],
  ['M57 a TornStats ask ahead of the clock stops the asks', '    return !(r.fellAskedAt <= nowMs && nowMs - r.fellAskedAt < FELL_EVERY_MS);', '    return !(nowMs - r.fellAskedAt < FELL_EVERY_MS);'],
];

let caught = 0;
const lines = [];
rmSync(dir, { recursive: true, force: true });
for (const [name, from, to] of MUTANTS) {
  const n = SRC.split(from).length - 1;
  if (n !== 1) {
    lines.push(name + ': SETUP ERROR (found ' + n + ' times)');
    continue;
  }
  const slug = name.split(' ')[0];
  const file = join(dir, slug, 'torn-ancient-ones.user.js');
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, SRC.replace(from, to));
  writeFileSync(file.replace(/\.user\.js$/, '.meta.js'), META);
  const run = spawnSync(process.execPath, ['--test', tests], { env: { ...process.env, TAO_SRC: file }, encoding: 'utf8', timeout: 180000 });
  const out = (run.stdout || '') + (run.stderr || '');
  const fail = Number((out.match(/^# fail (\d+)/m) || [0, -1])[1]);
  if (fail > 0) caught += 1;
  lines.push(name + ': ' + (fail > 0 ? 'caught (' + fail + ' failing)' : 'SURVIVED'));
}
console.log(lines.join('\n'));
console.log(caught + ' of ' + MUTANTS.length + ' caught');
process.exit(caught === MUTANTS.length ? 0 : 1);
```

Run:

```bash
W=/opt/warboard/.superpowers/sdd/2026-10-26-torn-ancient-ones; cd "$W" && node mutants.mjs "$W/wt/server/public/scripts/torn-ancient-ones.user.js" "$W/wt/server/torn-ancient-ones.test.mjs" "$W/mut" > "$W/mutants.log" 2>&1; echo "exit $?"; tail -2 "$W/mutants.log"
```

Expected: `exit 0`, then the last mutant's line, `M57 a TornStats ask ahead of the clock stops the asks: caught (1 failing)`, then `57 of 57 caught`. Any `SURVIVED` or `SETUP ERROR` is a finding: a survivor needs a test that kills it, and a setup error means the script's text differs from this plan's. Add the last line to the ledger.

- [ ] **Step 6: Commit.**

```bash
WT=/opt/warboard/.superpowers/sdd/2026-10-26-torn-ancient-ones/wt; cd "$WT" && git commit -q -m "torn-ancient-ones: drag, fold and close the box, and the key row" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- server/public/scripts/torn-ancient-ones.user.js server/torn-ancient-ones.test.mjs && git log --format='%h %s' -1 && git status --short
```

Expected: the commit, then only `?? server/node_modules`.

---

## Between Task 5 and Task 6: the final review

- The review package covers the whole branch, `git merge-base main HEAD`..HEAD, built by `review-package` from inside `$WT`.
- The reviewer is a fresh Opus agent (`model: "opus"`). It gets:
  - the package, this plan and the spec;
  - the Review Focus above, verbatim;
  - a pointer to the ledger's `Ruling:` lines and this plan's "Rulings made at plan time";
  - the mutant check's output from Task 5. It may run the tests and the check again on copies in its own scratch directory. It calls neither Torn's API nor TornStats: the live check is Task 6's.
- Critical and Important findings go into one fix pass. Each fix is a failing test first, then the fix, then `T` green and `C` clean, committed on the branch. A fix that changes text a mutant looks for updates the mutant and runs the check again.
- Minor findings go to the ledger as deferred.

---

### Task 6: The live check, and release

**Files:** none in the repo change here, unless the live check finds M'aol in a new shape (then one test is added to `server/torn-ancient-ones.test.mjs`) or something to fix (then as the fix pass says). Main fast-forwards to the branch, the two served files get their owner, and the memory notes outside the repo are updated.

**Interfaces:** consumes the branch `torn-ancient-ones` after the final review's fix pass, and the workspace's `live/live.mjs` and `live/fixture.mjs`.

- [ ] **Step 1: The live check (a gate).** One sweep of Torn's answers on the owner's key from this box, set against TornStats' feed, on the script as it will ship. It is read-only: six calls to Torn's API (twelve if it runs twice) and one read of TornStats' feed. Nothing on Torn is clicked or loaded. The tool gives the script a stand-in key. Each call's `key=` comes out of the address, and the owner's key (`OWNER_API_KEY` in `server/.env`) goes in the Authorization header instead, so the real key never reaches the script, the page or the output. Run it only while warboard's own use of that key is under 50 calls a minute. `live/live.mjs` and `live/fixture.mjs` are in the workspace from plan time (Setup checked their hashes). If they must be written again, `live/live.mjs` is:

```js
// The live check before release (a gate), outside the repo. The script as it will ship runs on
// a page of its own (linkedom) and makes one real sweep: six calls to Torn's API, 1 s apart.
// Its key is a stand-in: each call's key= comes out of the address, and the owner's key goes in
// the Authorization header instead, so the real key never reaches the script, the page or the
// output. TornStats' public feed is read once, sending nothing of anyone's. Then what the script
// stored of each Ancient One is set against TornStats' words for it.
// Read-only. It prints NPC fields only, and saves both answers (mode 600) for a new fixture.
// Usage: node live.mjs <script> <out dir>
import { readFileSync, writeFileSync, mkdirSync, chmodSync } from 'node:fs';
import { join } from 'node:path';
import { parseHTML } from 'linkedom';

const [script, out] = process.argv.slice(2);
const dotenv = readFileSync('/opt/warboard/server/.env', 'utf8');
const OWNER = ((/^OWNER_API_KEY=(.*)$/m.exec(dotenv) || [])[1] || '').trim().replace(/^["']|["']$/g, '');
if (!OWNER) {
  console.log('no OWNER_API_KEY in .env');
  process.exit(1);
}
const STAND_IN = 'LiveCheck000000';
const KEY_STORE = 'torn-ancient-ones-key';
const READING_STORE = 'torn-ancient-ones-reading';
const TORNSTATS = 'https://www.tornstats.com/ajax/status/maol';
const IDS = [23, 100, 101, 102, 103, 104];
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const tct = (ms) => (ms ? new Date(ms).toISOString().slice(11, 19) + ' TCT' : '-');

const store = { [KEY_STORE]: STAND_IN };
const requests = [];
const problems = [];
const torn = {};
let statsText = null;
let lastTorn = 0;

// Torn's API: the stand-in key comes out of the address, and the owner's goes in a header.
async function tornText(url) {
  const u = new URL(url);
  if (u.searchParams.get('key') !== STAND_IN) throw new Error('a call without the stand-in key');
  u.searchParams.delete('key');
  const wait = lastTorn + 1000 - Date.now();
  if (wait > 0) await sleep(wait);
  lastTorn = Date.now();
  const res = await fetch(u.toString(), { headers: { Authorization: 'ApiKey ' + OWNER } });
  const text = await res.text();
  const id = Number((/\/user\/(\d+)\//.exec(u.pathname) || [])[1]);
  try {
    const j = JSON.parse(text);
    const p = j.profile || {};
    torn[id] = j.error ? { error: { code: j.error.code } } : { profile: { id: p.id, name: p.name, role: p.role, status: p.status, life: p.life, last_action: p.last_action } };
  } catch (e) {
    torn[id] = { unreadable: true };
  }
  return text;
}

// TornStats' feed, read once whoever asks first.
async function tornStats() {
  if (statsText === null) {
    const res = await fetch(TORNSTATS, { headers: { Accept: 'application/json' } });
    statsText = await res.text();
  }
  return statsText;
}

function xhr(o) {
  const u = new URL(o.url);
  requests.push({ host: u.host, anonymous: o.anonymous === true });
  const answer = u.host === 'api.torn.com' ? tornText(o.url) : o.url === TORNSTATS ? tornStats() : Promise.reject(new Error('an address it shouldn\'t ask'));
  answer.then((text) => o.onload({ status: 200, responseText: text }), (e) => {
    problems.push('request to ' + u.host + ' failed: ' + e.message);
    o.onerror({ status: 0 });
  });
}

const dom = parseHTML('<!doctype html><html><head></head><body><div id="mainContainer"><div class="content-wrapper">Torn</div></div></body></html>');
const doc = dom.document;
Object.defineProperty(doc, 'visibilityState', { configurable: true, get: () => 'visible' });
// linkedom lays nothing out: the box is 300 by 200, at the bottom left of an 1280 by 800 window.
dom.HTMLElement.prototype.getBoundingClientRect = () => ({ x: 20, y: 580, left: 20, top: 580, width: 300, height: 200, right: 320, bottom: 780 });
const win = { innerWidth: 1280, innerHeight: 800, addEventListener() {}, removeEventListener() {} };
const logs = [];
const con = { log: (...a) => logs.push(a.join(' ')), warn: (...a) => logs.push(a.join(' ')), error: (...a) => logs.push(a.join(' ')) };
new Function('window', 'document', 'GM_getValue', 'GM_setValue', 'GM_xmlhttpRequest', 'fetch', 'console', readFileSync(script, 'utf8'))(
  win, doc, (k, d) => (k in store ? store[k] : d), (k, v) => { store[k] = v; }, xhr, undefined, con);

const reading = () => JSON.parse(store[READING_STORE] || '{}');
// The sweep, then TornStats if the script asks it (only while a beaten one has no time of
// TornStats'), then a second for its answer to be stored.
const t0 = Date.now();
for (;;) {
  const r = reading();
  if (r.error || Date.now() - t0 > 45000) break;
  if (r.okAt && (statsText !== null || Date.now() - t0 > 20000)) break;
  await sleep(500);
}
await sleep(1000);
const r = reading();
let stats = [];
try {
  stats = JSON.parse(await tornStats());
} catch (e) {
  problems.push('TornStats\' feed could not be read');
}
const byId = {};
(Array.isArray(stats) ? stats : []).forEach((x) => { byId[Number(x && x.torn_id)] = x; });

// TornStats' words, read plainly: the first word says standing or not, and the words after
// "in" the country (none: Torn City).
function theirs(words) {
  const w = String(words || '').trim();
  const first = (/^[a-z]+/i.exec(w) || [''])[0].toLowerCase();
  const m = /\bin\s+(.+?)\s*$/i.exec(w);
  return { standing: first === 'awoken' ? true : first === 'dormant' ? false : null, place: m ? m[1] : 'Torn City' };
}

const npcs = r.npcs || {};
let agree = 0;
console.log('sweep: started ' + tct(r.at) + ', read all six ' + tct(r.okAt) + (r.error ? ', error: ' + r.error : ''));
for (const id of IDS) {
  const n = npcs[id];
  const t = byId[id];
  const p = (torn[id] && torn[id].profile) || {};
  const s = p.status || {};
  const life = p.life ? Math.floor((100 * p.life.current) / p.life.maximum) + '%' : '-';
  const th = t ? theirs(t.status) : null;
  const ok = !!(n && th && th.standing !== null && (n.state === 'up') === th.standing && n.place === th.place);
  if (ok) agree += 1;
  console.log(id + ' ' + (p.name || (n && n.name) || '?') +
    ' | Torn: ' + (s.state || '-') + ' / ' + (s.description || '-') + ' / ' + life +
    ' | script: ' + (n ? n.state + ', ' + (n.place || '(no place)') + ', ' + (n.max ? Math.floor((100 * n.cur) / n.max) + '%' : '-') : 'not read') +
    ' | TornStats: ' + (t ? t.status + ' (updated ' + tct(Date.parse(t.updated_at)) + ', defeated ' + tct(Date.parse(t.hosped_at)) + ')' : 'none') +
    ' | ' + (ok ? 'agree' : 'DIFFERS'));
}
const box = doc.getElementById('tao-box');
const summary = box && box.querySelector('.tao-summary');
console.log('box summary: ' + (summary ? summary.textContent : '(no box)'));
const tornCalls = requests.filter((q) => q.host === 'api.torn.com').length;
const statsCalls = requests.filter((q) => q.host === 'www.tornstats.com').length;
console.log('requests: ' + tornCalls + ' to Torn, ' + statsCalls + ' to TornStats from the script, all without cookies: ' + requests.every((q) => q.anonymous));
console.log('TornStats\' defeat times kept: ' + Object.keys(r.fell || {}).map((id) => id + ' ' + tct(r.fell[id])).join(', '));
console.log('console: ' + logs.join(' / '));
problems.forEach((p) => console.log('problem: ' + p));
mkdirSync(out, { recursive: true });
for (const [name, value] of [['torn.json', { readAt: new Date(r.okAt || Date.now()).toISOString(), profiles: torn }], ['tornstats.json', stats]]) {
  writeFileSync(join(out, name), JSON.stringify(value, null, 2) + '\n');
  chmodSync(join(out, name), 0o600);
}
console.log('agree: ' + agree + ' of 6');
process.exit(agree === 6 && tornCalls === 6 && statsCalls <= 1 && requests.every((q) => q.anonymous) && !problems.length && !r.error ? 0 : 1);
```

and `live/fixture.mjs` is:

```js
// Gate item 3, outside the repo. When M'aol's answer at release is of a shape the tests haven't
// seen (he can be hit, or he has died), this prints a test of the six as Torn gave them in the
// live check, with what each should read as taken from TornStats' words at the same time, for
// the end of the test file. NPC fields only.
// Usage: node fixture.mjs <the live check's out dir>
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = process.argv[2];
const torn = JSON.parse(readFileSync(join(dir, 'torn.json'), 'utf8'));
const stats = JSON.parse(readFileSync(join(dir, 'tornstats.json'), 'utf8'));
const IDS = [23, 100, 101, 102, 103, 104];
const byId = {};
stats.forEach((x) => { byId[Number(x.torn_id)] = x; });
// A JavaScript string in the test file's own quotes.
const q = (s) => '\'' + String(s).replace(/\\/g, '\\\\').replace(/'/g, '\\\'') + '\'';
const read = new Date(torn.readAt);
const when = read.toISOString().slice(11, 16) + ' TCT on ' + read.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' }) + ' ' + read.getUTCDate();
const given = [];
const want = [];
for (const id of IDS) {
  const p = torn.profiles[id].profile;
  given.push('    ' + id + ': profile(' + id + ', ' + q(p.status.description) + ', ' + p.life.current + ', { state: ' + q(p.status.state) + ', max: ' + p.life.maximum + ' }),');
  // TornStats' words: the first word says standing or not, and the words after "in" the country.
  const words = String(byId[id].status);
  const m = /\bin\s+(.+?)\s*$/i.exec(words);
  const state = /^awoken\b/i.test(words) ? 'up' : p.life.current > 0 ? 'dormant' : 'beaten';
  want.push('    ' + id + ': [' + q(state) + ', ' + q(m ? m[1] : 'Torn City') + ', ' + Math.floor((100 * p.life.current) / p.life.maximum) + '],');
}
console.log([
  '',
  '// The six as Torn gave them at ' + when + ', in the live check before release, with what each',
  '// should read as taken from TornStats\' words at the same time.',
  'test(' + q('the six as Torn gave them at ' + when + ' read as TornStats saw them: M\'aol ' + torn.profiles[23].profile.status.description) + ', async () => {',
  '  const torn = {',
  ...given,
  '  };',
  '  const { env } = await started({ torn });',
  '  assert.deepEqual(seen(env), {',
  ...want,
  '  });',
  '});',
].join('\n'));
```

Run the check:

```bash
uptime; W=/opt/warboard/.superpowers/sdd/2026-10-26-torn-ancient-ones; ln -sfn /opt/warboard/server/node_modules "$W/live/node_modules" && cd "$W/live" && node live.mjs "$W/wt/server/public/scripts/torn-ancient-ones.user.js" "$W/live/out"; echo "exit $?"
```

Expected:
- `sweep: started HH:MM:SS TCT, read all six HH:MM:SS TCT`;
- one line for each of the six, each ending in `agree`;
- then `box summary: ...`;
- `requests: 6 to Torn, 1 to TornStats from the script, all without cookies: true` (0 to TornStats while none is beaten);
- `TornStats' defeat times kept: ...` and `console: [Torn Ancient Ones 1.0.0] running`;
- `agree: 6 of 6` and `exit 0`.

At plan time (12:49 TCT on Oct 26) it gave 6 of 6, with four beaten and M'aol shielded in Canada.

What to do with what it finds:
- **M'aol alone `DIFFERS`,** with TornStats' `updated` time for him before the sweep started: he may have moved between the two reads, because he moves every 15 minutes and TornStats reads each minute. Wait 2 minutes and run it once more, into `$W/live/out2`. The run that agrees is the one the rest of this step uses.
- **Anything else differs** (a praetorian, or M'aol a second time), or `exit 1` for another reason: STOP. Don't release. Report to the owner with the tool's lines, which hold NPC fields only. Torn's words may have changed, and the reading code then needs a fix pass.
**Gate item 3:** when the box summary starts `M'aol can be hit` or `All asleep`, M'aol's answer is of a shape the plan-time tests haven't seen. Make it a test of its own, from the run that agreed (for `out2`, put `out2` in place of `out`):

```bash
W=/opt/warboard/.superpowers/sdd/2026-10-26-torn-ancient-ones; cd "$W/live" && node fixture.mjs out >> "$W/wt/server/torn-ancient-ones.test.mjs" && tail -22 "$W/wt/server/torn-ancient-ones.test.mjs"
```

Expected: the new test, headed `// The six as Torn gave them at HH:MM TCT on Oct NN, in the live check before release...`, with each of the six's words, life and expected reading. Then run `T`, and expect one test more than the branch had, all passing: `# tests 93 # pass 93 # fail 0` when the fix pass added none. The test passes at once, because it pins what the live check just saw; if it fails, that is the STOP above. Commit it, and record the shape of M'aol's answer in the ledger:

```bash
WT=/opt/warboard/.superpowers/sdd/2026-10-26-torn-ancient-ones/wt; cd "$WT" && git commit -q -m "torn-ancient-ones: a test of the six as Torn gave them at release" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- server/torn-ancient-ones.test.mjs && git log --format='%h %s' -1 && git status --short
```

Expected: the commit, then only `?? server/node_modules`.

- [ ] **Step 2: Pre-flight.** Check that the box isn't overloaded, that none of this script's files is in the main checkout (an untracked one there would stop the fast-forward), and that main hasn't moved:

```bash
uptime; cd /opt/warboard && ls server/public/scripts/torn-ancient-ones.user.js server/public/scripts/torn-ancient-ones.meta.js server/torn-ancient-ones.test.mjs 2>&1 | grep -c 'No such file'; git status --short -- server/public/scripts/torn-ancient-ones.user.js server/public/scripts/torn-ancient-ones.meta.js server/torn-ancient-ones.test.mjs docs/superpowers/specs/2026-10-26-torn-ancient-ones-design.md docs/superpowers/plans/2026-10-26-torn-ancient-ones.md && git merge-base --is-ancestor main torn-ancient-ones && echo fast-forward-ok
```

Expected: load under 12, `3`, no status lines, then `fast-forward-ok`.
- If the load is over 12, wait.
- If main has moved, rebase the branch first: `git -C "$WT" rebase main`. Then run `T`, which must be all green.

- [ ] **Step 3: Fast-forward main.** This is the moment tornwar.com starts serving 1.0.0. Git writes the files as root, so their owner goes to warboard:

```bash
cd /opt/warboard && git merge --ff-only torn-ancient-ones && chown warboard:warboard server/public/scripts/torn-ancient-ones.user.js server/public/scripts/torn-ancient-ones.meta.js && chmod 644 server/public/scripts/torn-ancient-ones.user.js server/public/scripts/torn-ancient-ones.meta.js && ls -l server/public/scripts/torn-ancient-ones.user.js server/public/scripts/torn-ancient-ones.meta.js
```

Expected: `Fast-forward`, then both files `-rw-r--r-- warboard warboard`.

- [ ] **Step 4: The whole suite, in place:**

```bash
cd /opt/warboard/server && node --test > /opt/warboard/.superpowers/sdd/2026-10-26-torn-ancient-ones/suite.log 2>&1; grep -E "^# (tests|pass|fail|skipped) " /opt/warboard/.superpowers/sdd/2026-10-26-torn-ancient-ones/suite.log | paste -sd" " -
```

Expected: `# fail 0`, with 2 skipped. The last run had 2510 tests. This one should have about 2602: this plan adds 92, one more when Step 1 added M'aol's fixture, and any from the final review's fix pass, give or take other sessions' work.
- If a failure is this change's, take the script down at once with `git revert --no-edit <first>^..HEAD` on main (first = the Task 1 commit), and stop.
- If a failure is another session's, name it in the report and carry on.

- [ ] **Step 5: Check what is served:**

```bash
curl -s http://127.0.0.1:3000/scripts/torn-ancient-ones.meta.js | grep '@version'; curl -s https://tornwar.com/scripts/torn-ancient-ones.meta.js | grep '@version'; curl -s https://tornwar.com/scripts/torn-ancient-ones.user.js | grep -c "const VERSION = '1.0.0'"; curl -s https://tornwar.com/scripts/torn-ancient-ones.user.js | sha256sum | cut -c1-16; sha256sum /opt/warboard/server/public/scripts/torn-ancient-ones.user.js | cut -c1-16
```

Expected: `// @version      1.0.0` twice, then `1`, then the same 16 characters twice.

- [ ] **Step 6: Sweep the push, then push main.** The repo is public, so first look at everything the push adds. That means the commits, any 16-character word in an added line (Torn's keys are 16 characters; this plan's test keys are 15), and any value of `server/.env`. The check prints `.env` names, never values:

```bash
W=/opt/warboard/.superpowers/sdd/2026-10-26-torn-ancient-ones; cd /opt/warboard && git log --format='%h %s' origin/main..main && git diff origin/main..main -U0 | grep -E '^\+' | grep -v -E '^\+\+\+ ' > "$W/push-added.txt"; wc -l < "$W/push-added.txt"; grep -o -E '\b[A-Za-z0-9]{16}\b' "$W/push-added.txt" | sort -u; python3 -I - "$W/push-added.txt" <<'PY'
import sys
added = open(sys.argv[1], encoding='utf-8', errors='replace').read()
found = []
for line in open('/opt/warboard/server/.env', encoding='utf-8', errors='replace'):
    line = line.strip()
    if line and not line.startswith('#') and '=' in line:
        name, value = line.split('=', 1)
        value = value.strip().strip('"\'')
        if len(value) >= 12 and value in added:
            found.append(name.strip())
print('.env values in the push:', ', '.join(found) if found else 'none')
PY
```

Expected:
- the commits to push: the spec's and this plan's, the five tasks', the fix pass's, and the fixture's if Step 1 made one;
- the added lines' count;
- no 16-character word, or only words that are plainly not keys;
- `.env values in the push: none`.

A key-like word or any `.env` name: STOP, don't push, and ask the owner. So too for a commit that isn't this plan's: another session's unpushed work isn't this plan's to push. When the sweep is clean, push, with the remote's credentials masked:

```bash
cd /opt/warboard && git push origin main 2>&1 | sed -E 's#//[^@]*@#//***@#g'; git status -sb | head -1
```

Expected: `main -> main`, and `## main...origin/main` with nothing ahead.

- [ ] **Step 7: Record Task 6,** from inside `$WT`. Run `task-done` with the served-version check as its test command:

```bash
bash -c "curl -s https://tornwar.com/scripts/torn-ancient-ones.meta.js | grep -q '@version      1.0.0' && echo served-1.0.0"
```

Then copy the ledger, `mutants.log`, `suite.log` and `live/out*/` out of the workspace, to this session's scratchpad, before the workspace goes.

- [ ] **Step 8: Remove the worktree, the branch and the workspace.** The worktree's symlink goes first: git counts it as untracked, so it would block the removal.

```bash
rm /opt/warboard/.superpowers/sdd/2026-10-26-torn-ancient-ones/wt/server/node_modules && cd /opt/warboard && git worktree remove /opt/warboard/.superpowers/sdd/2026-10-26-torn-ancient-ones/wt && git branch -d torn-ancient-ones && rm -r /opt/warboard/.superpowers/sdd/2026-10-26-torn-ancient-ones && git worktree list
```

Expected: `git worktree list` shows only `/opt/warboard`.

- [ ] **Step 9: Notes and report.**
  - Write this script's project memory, outside the repo. It says 1.0.0 is live and pushed, what the script does, and the live check's answers, in EDT. Still owed: the owner's own check after release, and Greasy Fork if the owner wants it there. Add its index line, folding an older line into its neighbour if the index is at its cap.
  - Report to the owner:
    - the rulings and any deferred minors from the ledger;
    - what the live check found, and M'aol's shape if Step 1 made a fixture;
    - the served URL, https://tornwar.com/scripts/torn-ancient-ones.user.js, to install from;
    - that Tampermonkey and the warboard apps ask for a Public key once, and PDA gives its own;
    - the spec's "Live check (owner, after release)" list.
