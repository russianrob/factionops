# Torn Ancient Ones 1.0.2 - Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** M'aol's next stop shows whenever it is certain, or as one of two, even when his praetorians fell too close together to put in order. A move the box sees him make settles their order, and then his route and where to fly show.

**Architecture:** one change to the route code of `server/public/scripts/torn-ancient-ones.user.js`, with its tests in `server/torn-ancient-ones.test.mjs`.
- `route(r)` becomes `routes(r)`: every order M'aol may be going round in. The falls give one order for each way the falls under 30 s apart could have come. His seen moves drop the orders they don't fit.
- `nextStop(r, ways)` names the next country when every order gives the same one, both when they give two, and none when they give more.
- The route line, and where to fly, still need exactly one order left.
- What the script reads, stores and asks for is as in 1.0.1.
- All work happens in a git worktree on a branch, because the main checkout is the tree tornwar.com serves.

**Tech Stack:** a plain-JavaScript userscript (Tampermonkey, Torn PDA, the warboard apps). The tests use node:test and linkedom, and read the script from `TAO_SRC`.

**Spec:** `docs/superpowers/specs/2026-10-26-torn-ancient-ones-design.md`. Task 1 amends "The box", "M'aol's route" and "Testing", and its Status gets the owner's asks below. Task 2 amends the version.

**The ask:**
- At 10:03 EDT on 2026-10-26, with a screenshot of the box (M'aol in Hawaii, and no route, because the Cayman Islands' and the UK's praetorians had fallen a second apart), the owner asked "can it know where it goes next?". Then came "and when he will go next to mexico" and "says 11 minutes and 26 in caymans so every 15 mins".
- A bounded design went to the owner in chat at about 10:10 EDT. At 10:27 EDT the owner said "do recommended":
  - his next stop whenever it is certain;
  - his moves settle falls under 30 s apart;
  - the 30 s rule stays;
  - a move that fits no order the falls allow means no route and no next stop, until he has been seen in all five countries.
- At 10:28 EDT the owner said "it doesnt shown where and when hes moving next". So this plan also names both of two next stops (`next Cayman Islands or United Kingdom about 14:30 TCT`). The owner kept that at 10:53 EDT ("do recommended").
- In the same message, the owner asked to fix the box's Attack link, which Torn had retired. That fix shipped first, as 1.0.1 (2138dd8b), so this plan is 1.0.2.

**Execution:** Native, as the owner chose for 1.0.0. One session works the tasks, then one fresh Opus reviewer checks the whole branch between Task 2 and Task 3.

**Dry run:** all the code in this plan ran while the plan was written, on copies of the files as 1.0.1 left them (main at 2138dd8b). The plan's code blocks were read back out of this file and replayed:
- Task 1's tests against 1.0.1: `# tests 103 # pass 98 # fail 5`; after its code, 103 of 103.
- Task 2's tests against Task 1's script: `# tests 103 # pass 100 # fail 3`; after its edits, 103 of 103.
- The mutant check: `71 of 71 caught`: 1.0.0's 64, with M17 to M19 following the code into `routes()` and `nextStop()`, and M65 to M71 for this plan.

## Global Constraints

- **Version** `1.0.2`, in three places: `// @version`, `const VERSION`, and the CHANGELOG entry that starts `// v1.0.2  - M'aol's next stop shows whenever it is certain,`, above 1.0.1's. The console line on start carries it: `[Torn Ancient Ones 1.0.2] running`.
- **The `.meta.js`** is the header, byte for byte, then a newline: 17 lines.
- **Unchanged from 1.0.1:**
  - @name `Torn Ancient Ones`; @namespace and @author `RussianRob`; @license `All Rights Reserved`;
  - the URLs, @match, @run-at, the grants and both @connect lines;
  - plain ASCII; every `GM_*` call guarded with `typeof`; `###PDA-APIKEY###` once;
  - no password field, no new tab, nothing put in as HTML.
- **No new requests.** The change is in what the box works out from its reading, not in what it reads, so there is no live check. 1.0.0's, at 10:20 EDT, read Torn's six as TornStats did, and pinned the hittable M'aol in a test.
- **The 30 s rule stays:** falls under 30 s after the one before are a run whose order isn't known. A run is every fall linked to the one before it by a gap under 30 s, however far apart its first and last fall are.
- **The box names at most two next stops,** joined by ` or `, in the order the routes give them.
- **Comments:** clear `//` lines in the file's own style, with no version crumbs. Version notes go only in the CHANGELOG.
- **The repo is public:** no keys, key endings, player ids or member data in code, tests, plan or commits.
- **Served files** are `warboard:warboard 644`.
- **The worktree:** the branch `torn-ancient-ones-next-stop`, at `/opt/warboard/.superpowers/sdd/2026-10-26-torn-ancient-ones-next-stop/wt`, cut from main after this plan's commit. In it, only `T` runs (it sets `TAO_SRC`), never a bare `node --test`. The whole suite runs once, in `/opt/warboard/server`, after the release's fast-forward.
- **Commits** name only this plan's paths (`git commit -- <paths>`), with the trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **Times** in the box are TCT; reports to the owner give EDT.

## Review Focus

1. **Falls chained under 30 s apart.** TornStats' times can sit seconds apart, so three falls 20 s apart are one run, though the first and last are 40 s apart. Then from the country before the run, his next stop could be any of three, and none shows. Task 1's fifth test pins it.
2. **A move that fits no order the falls allow.** It means the falls or the trail are wrong. The box names no stop until his trail is whole, and never one it saw him skip. Task 1's fourth test pins it.
3. **A move from his last stop back to his first** (Hawaii to Mexico on 2026-10-26) is a step of his route like any other. Task 1's first test makes that move, and mutant M70 checks it.

Checked and found covered by 1.0.0's tests: a gap of 10 minutes or more in his readings (the trail starts again), his moves while shielded, a country missing or shared, and Torn City.

Left as they are (deferred minors from 1.0.0's review, which the owner has): two falls that straddle one sweep's reads can get the script's own times 60 s apart in the wrong order, and once he has stayed past 15 minutes the next stop's time is already past. With 1.0.2, a move that doesn't fit a wrong order from the falls stops the box naming a stop (Task 1's fourth test).

## Paths and commands

- `W=/opt/warboard/.superpowers/sdd/2026-10-26-torn-ancient-ones-next-stop` (this plan's git-ignored workspace) and `WT=$W/wt` (the worktree).
- **T**, the test file on the worktree's script:

```bash
W=/opt/warboard/.superpowers/sdd/2026-10-26-torn-ancient-ones-next-stop; WT=$W/wt; cd "$WT/server" && TAO_SRC="$WT/server/public/scripts/torn-ancient-ones.user.js" node --test torn-ancient-ones.test.mjs > "$W/t.log" 2>&1; grep -E "^# (tests|pass|fail) " "$W/t.log" | paste -sd" " -; grep -E "^not ok" "$W/t.log" | cut -c1-150
```

- **C**, the script parses and is plain ASCII:

```bash
F=/opt/warboard/.superpowers/sdd/2026-10-26-torn-ancient-ones-next-stop/wt/server/public/scripts/torn-ancient-ones.user.js; node --check "$F" && LC_ALL=C grep -c '[^ -~]' "$F" | grep -qx 0 && echo ascii-ok
```

- **Edits:** each "Replace" block's text occurs in its file exactly once, and the "With" block takes its place. Neither holds the newline that ends its last line.

## Setup

- [ ] **Step 1: Commit this plan on main, then make the worktree:**

```bash
uptime; cd /opt/warboard && git add -- docs/superpowers/plans/2026-10-26-torn-ancient-ones-next-stop.md && git commit -q -m "plan: Torn Ancient Ones 1.0.2, M'aol's next stop whenever it is certain" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- docs/superpowers/plans/2026-10-26-torn-ancient-ones-next-stop.md && W=/opt/warboard/.superpowers/sdd/2026-10-26-torn-ancient-ones-next-stop && mkdir -p "$W" && git worktree add "$W/wt" -b torn-ancient-ones-next-stop && ln -s /opt/warboard/server/node_modules "$W/wt/server/node_modules" && git -C "$W/wt" status --short && git -C "$W/wt" log --format='%h %s' -1
```

Expected: the load under 12, then `?? server/node_modules`, then the plan's commit.

- [ ] **Step 2: Write the mutant check** to `$W/mutants.mjs`, outside the repo. It is 1.0.0's, with M17 to M19 following the code into `routes()` and `nextStop()`, and M65 to M71 for this plan:

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
  ['M17 falls under 30 s apart put in order anyway', 'if (i > 0 && f.at - falls[i - 1].at < FALL_GAP_MS) runs', 'if (i > 0 && f.at - falls[i - 1].at < 0) runs'],
  ['M18 his moves never give the route', '    if (moves.length === countries.length) return [moves];\n', ''],
  ['M19 the next stop doesn\'t wrap', 'const next = way[(i + 1) % way.length];', 'const next = way[i + 1];'],
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
  ['M53 the order of the lines by id', '.sort((a, b) => group(a) - group(b) || byTime(a, b) || rank(a) - rank(b) || a - b);', '.sort((a, b) => a - b);'],
  ['M54 Attack shown for the shielded M\'aol', "const canHit = id === MAOL ? hittable(r.npcs) : n.state === 'up';", "const canHit = n.state === 'up';"],
  ['M55 a sweep time ahead of the clock stops the sweeps', '    return !(r.at <= nowMs && nowMs - r.at < SWEEP_EVERY_MS);', '    return !(nowMs - r.at < SWEEP_EVERY_MS);'],
  ['M56 a wait ahead of the clock stops the sweeps', '    if (r.wait > nowMs && r.wait - nowMs <= BACK_OFF_MS) return false;', '    if (r.wait > nowMs) return false;'],
  ['M57 a TornStats ask ahead of the clock stops the asks', '    return !(r.fellAskedAt <= nowMs && nowMs - r.fellAskedAt < FELL_EVERY_MS);', '    return !(nowMs - r.fellAskedAt < FELL_EVERY_MS);'],
  ['M58 the falls not in the order they fell', 'group(a) - group(b) || byTime(a, b) || rank(a)', 'group(a) - group(b) || rank(a)'],
  ['M59 a fall with no time put after the timed ones', '(fellAt(r, id) ? 1 : 0)', '(fellAt(r, id) ? 0 : 1)'],
  ['M60 those standing put first', '(fellAt(r, id) ? 1 : 0) : 2)', '(fellAt(r, id) ? 1 : 0) : -1)'],
  ['M61 no time for the next try', "' Trying again at ' + clock(r.wait, nowMs) + '.'", "''"],
  ['M62 a time for a wait from a clock set back', 'const waiting = r.wait > nowMs && r.wait - nowMs <= BACK_OFF_MS;', 'const waiting = r.wait > nowMs;'],
  ['M63 the trail kept across a gap', '    if (id === MAOL && before && !(nowMs >= before.readAt && nowMs - before.readAt < TRAIL_GAP_MS)) r.trail = [];\n', ''],
  ['M64 a sweep stored ahead of the clock beats the tab\'s copy', 'const newer = tabCopy && shared.at > tabCopy.at && shared.at <= Date.now();', 'const newer = tabCopy && shared.at > tabCopy.at;'],
  ['M65 the next stop only once his route is known', '    if (!places.length || places.length > 2) return null;\n', '    if (ways.length !== 1) return null;\n'],
  ['M66 his moves don\'t settle falls too close to put in order', '    return ways.filter((way) => fitsMoves(way, r.trail));\n', '    return ways;\n'],
  ['M67 the falls stand when his moves fit none of their orders', '    return ways.filter((way) => fitsMoves(way, r.trail));\n', '    const fit = ways.filter((way) => fitsMoves(way, r.trail));\n    return fit.length ? fit : ways;\n'],
  ['M68 three next stops named', '    if (!places.length || places.length > 2) return null;\n', '    if (!places.length) return null;\n'],
  ['M69 two next stops not named', '    if (!places.length || places.length > 2) return null;\n', '    if (places.length !== 1) return null;\n'],
  ['M70 a move from his last stop back to his first doesn\'t fit', 'way[(from + 1) % way.length] !== trail[i]', 'way[from + 1] !== trail[i]'],
  ['M71 a run of falls measured from its first, not from the one before', 'f.at - falls[i - 1].at < FALL_GAP_MS', 'f.at - falls[i - runs[runs.length - 1].length].at < FALL_GAP_MS'],
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

Then check it parses: `node --check /opt/warboard/.superpowers/sdd/2026-10-26-torn-ancient-ones-next-stop/mutants.mjs && echo ok`.

### Task 1: The next stop from every order the falls allow, settled by his moves

**Files:**
- Modify: `server/public/scripts/torn-ancient-ones.user.js`: `route()` and `nextStop()` (from `// M'aol's route: his praetorians' countries` to the end of `nextStop`), and three lines of `line()`.
- Test: `server/torn-ancient-ones.test.mjs` (five tests at the end).
- Modify: `docs/superpowers/specs/2026-10-26-torn-ancient-ones-design.md` (Status, "The box", "M'aol's route", "Testing").

**Interfaces:**
- Consumes (from 1.0.1): `praetorianCountries(npcs)`, the five countries or null; `fellAt(r, id)`, a defeat time (ms) or 0; `r.trail`, the countries M'aol was seen in while he could be hit, with no gap of 10 minutes or more; `FALL_GAP_MS`, `STOP_MS`, `MAOL`, `PRAETORIANS`; `maolFly(r, way, nowMs)`, unchanged, which takes one order or null.
- Produces:
  - `routes(r)`: an array of orders, each an array of the five countries, in the order he would visit them;
  - `orders(places)`: every order of a list;
  - `fitsMoves(way, trail)`: true or false;
  - `nextStop(r, ways)`: `{ places: [one or two countries], at: ms or 0 }`, or null.
  - `route(r)` is gone; `line()` takes the route as `ways.length === 1 ? ways[0] : null`.

- [ ] **Step 1: Write the failing tests.** Add this to the end of the test file:

```js
// ---------------------------------------------------------------------------------------------
// M'aol's next stop when praetorians fell too close together to put in order
// ---------------------------------------------------------------------------------------------

// Nol'dasaym (Mexico) falls at 10:41 TCT; Dyno'salam (Cayman Islands) and Ladso'myna (United
// Kingdom) both in the sweep at 10:42, too close to put in order; then Asmol'yand (Canada) at
// 10:43 and Sylo'nadam (Hawaii) at 10:44. So his route is Mexico, the Cayman Islands and the UK
// in an order not known, Canada, Hawaii.
async function fallWithATie(env) {
  await fall(env, [101]);
  env.torn[100] = beaten(100, PLACE[100]);
  env.torn[104] = beaten(104, PLACE[104]);
  await env.advance(MIN);
  await fall(env, [102, 103]);
}
// The where-to-fly notes, without his death time.
const catchNotes = (w) => notes(w, 23).filter((n) => /^(airstrip|BCT):/.test(n));

test('with two falls too close to put in order, the next stop shows when every order gives the same one, or names both, and the route doesn\'t show', async () => {
  const { env, w } = await started({ torn: allUp() });
  await fallWithATie(env);
  await go(env, ['Hawaii']);
  assert.deepEqual(maolNotes(w), ['moves about every 15 min, here since 10:45 TCT', 'next Mexico about 11:00 TCT']);
  await go(env, ['Mexico']);
  assert.deepEqual(maolNotes(w), ['moves about every 15 min, here since 10:46 TCT', 'next Cayman Islands or United Kingdom about 11:01 TCT']);
  assert.deepEqual(catchNotes(w), [], 'where to fly needs his route');
});

test('one move seen among falls too close to put in order settles their order, either way round, and his route and where to fly show', async () => {
  const caymanFirst = await started({ torn: allUp() });
  await fallWithATie(caymanFirst.env);
  await go(caymanFirst.env, ['Mexico', 'Cayman Islands']);
  assert.deepEqual(maolNotes(caymanFirst.w), [
    'moves about every 15 min, here since 10:46 TCT',
    'next United Kingdom about 11:01 TCT',
    'route Mexico > Cayman Islands > United Kingdom > Canada > Hawaii',
  ]);
  assert.equal(catchNotes(caymanFirst.w).length, 2);

  const ukFirst = await started({ torn: allUp() });
  await fallWithATie(ukFirst.env);
  await go(ukFirst.env, ['United Kingdom', 'Cayman Islands']);
  assert.deepEqual(maolNotes(ukFirst.w), [
    'moves about every 15 min, here since 10:46 TCT',
    'next Canada about 11:01 TCT',
    'route Mexico > United Kingdom > Cayman Islands > Canada > Hawaii',
  ]);
});

test('with three falls too close to put in order, he has no next stop where it could be any of the three', async () => {
  const { env, w } = await started({ torn: allUp() });
  await fall(env, [101]);
  for (const id of [100, 104, 102]) env.torn[id] = beaten(id, PLACE[id]);
  await env.advance(MIN);
  await fall(env, [103]);
  await go(env, ['Hawaii']);
  assert.deepEqual(maolNotes(w), ['moves about every 15 min, here since 10:44 TCT', 'next Mexico about 10:59 TCT']);
  await go(env, ['Mexico']);
  assert.deepEqual(maolNotes(w), ['moves about every 15 min, here since 10:45 TCT']);
});

test('a move that fits no order the falls allow: no next stop and no route until he has been seen in all five countries', async () => {
  const { env, w } = await started({ torn: allUp() });
  await fall(env, [102, 100, 104, 101, 103]);
  await go(env, ['Mexico']);
  assert.deepEqual(maolNotes(w), [
    'moves about every 15 min, here since 10:46 TCT',
    'next Hawaii about 11:01 TCT',
    'route Canada > Cayman Islands > United Kingdom > Mexico > Hawaii',
  ]);
  // The falls have Hawaii after Mexico, but he goes on to Canada.
  await go(env, ['Canada']);
  assert.deepEqual(maolNotes(w), ['moves about every 15 min, here since 10:47 TCT']);
  await go(env, ['Hawaii', 'Cayman Islands', 'United Kingdom']);
  assert.deepEqual(maolNotes(w), [
    'moves about every 15 min, here since 10:50 TCT',
    'next Mexico about 11:05 TCT',
    'route Mexico > Canada > Hawaii > Cayman Islands > United Kingdom',
  ]);
});

test('falls each under 30 s after the one before make one run, however far apart its first and last', async () => {
  const at = Date.UTC(2026, 9, 26, 12, 30);
  const feed = (canadaAt) => [fellEntry(101, '2026-10-26T10:24:02Z'), fellEntry(100, '2026-10-26T11:52:00Z'), fellEntry(104, '2026-10-26T11:52:20Z'), fellEntry(102, canadaAt), fellEntry(103, '2026-10-26T12:20:00Z')];
  // Canada 20 s after the UK: the Cayman Islands, the UK and Canada are one run of three, so
  // from Mexico his next stop could be any of them. 40 s after: only the first two are a run.
  for (const [canadaAt, next] of [['2026-10-26T11:52:40Z', []], ['2026-10-26T11:53:00Z', ['next Cayman Islands or United Kingdom']]]) {
    const env = device({ torn: allBeaten('Awoken in Mexico'), tornstats: feed(canadaAt) });
    env.now = at;
    env.store[KEY_STORE] = KEY;
    const w = env.tab().run();
    await env.advance(5 * SEC);
    assert.deepEqual(maolNotes(w).filter((n) => n.startsWith('next ')), next, canadaAt);
  }
});
```

- [ ] **Step 2: Run T.**

Expected: `# tests 103 # pass 98 # fail 5`. The five new tests fail, each for want of a next stop or a route that 1.0.1 doesn't give, or for one it still gives after a move that doesn't fit.

- [ ] **Step 3: Replace `route()` and `nextStop()` in the script.** Replace:

```js
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
```

With:

```js
  // M'aol's routes: each order of his praetorians' countries he may be going round in, as far
  // as the script can tell. From his moves once his trail holds all five countries, because
  // that is what he did. Until then, each order the praetorians' falls allow that fits every
  // move he was seen to make. Falls under 30 s apart came too close to put in order (the same
  // sweep, or TornStats' times a second apart), so they may have come either way. None when a
  // fall has no time, or when his moves fit no order the falls allow: then the script waits
  // until it has seen him in all five.
  function routes(r) {
    const countries = praetorianCountries(r.npcs);
    if (!countries) return [];
    const moves = [];
    r.trail.forEach((c) => {
      if (countries.indexOf(c) >= 0 && moves.indexOf(c) < 0) moves.push(c);
    });
    if (moves.length === countries.length) return [moves];
    const falls = PRAETORIANS.map((id) => ({ place: r.npcs[id].place, at: fellAt(r, id) }));
    if (falls.some((f) => !f.at)) return [];
    falls.sort((a, b) => a.at - b.at);
    // Runs of falls, each under 30 s after the one before: the order inside a run isn't known.
    const runs = [];
    falls.forEach((f, i) => {
      if (i > 0 && f.at - falls[i - 1].at < FALL_GAP_MS) runs[runs.length - 1].push(f.place);
      else runs.push([f.place]);
    });
    let ways = [[]];
    runs.forEach((run) => {
      const longer = [];
      ways.forEach((way) => orders(run).forEach((o) => longer.push(way.concat(o))));
      ways = longer;
    });
    return ways.filter((way) => fitsMoves(way, r.trail));
  }

  // Every order of these places.
  function orders(places) {
    if (places.length < 2) return [places];
    const all = [];
    places.forEach((p, i) => {
      orders(places.filter((q, j) => j !== i)).forEach((rest) => all.push([p].concat(rest)));
    });
    return all;
  }

  // True when each move M'aol was seen to make between two countries of this order, one
  // straight after the other in his trail, goes on to the next country of it, from the last
  // back to the first.
  function fitsMoves(way, trail) {
    for (let i = 1; i < trail.length; i++) {
      const from = way.indexOf(trail[i - 1]);
      if (from >= 0 && way.indexOf(trail[i]) >= 0 && way[(from + 1) % way.length] !== trail[i]) return false;
    }
    return true;
  }

  // Where M'aol goes next: the country after his current one on each of his routes, from the
  // last back to the first. One country when they all give the same one, two when they give
  // two (in the order the routes give them), and null when they give more, when there is no
  // route, or when he is somewhere not on them. When: 15 minutes after he was seen arriving;
  // 0 when his arrival had no time.
  function nextStop(r, ways) {
    const m = r.npcs[MAOL];
    const places = [];
    for (const way of ways) {
      const i = m ? way.indexOf(m.place) : -1;
      if (i < 0) return null;
      const next = way[(i + 1) % way.length];
      if (places.indexOf(next) < 0) places.push(next);
    }
    if (!places.length || places.length > 2) return null;
    return { places: places, at: m.since ? m.since + STOP_MS : 0 };
  }
```

- [ ] **Step 4: Draw the next stop from all the orders, and the route from one.** In `line()`, replace:

```js
      const way = route(r);
      const stop = nextStop(r, way);
      if (stop) notes.push('next ' + stop.place + (stop.at ? ' about ' + clock(stop.at, nowMs) : ''));
```

With:

```js
      const ways = routes(r);
      // His route, once one order is left of those he may be going round in.
      const way = ways.length === 1 ? ways[0] : null;
      const stop = nextStop(r, ways);
      if (stop) notes.push('next ' + stop.places.join(' or ') + (stop.at ? ' about ' + clock(stop.at, nowMs) : ''));
```

- [ ] **Step 5: Run T, then C.**

Expected: `# tests 103 # pass 103 # fail 0`, then `ascii-ok`.

- [ ] **Step 6: Amend the spec.** Eight edits, in order:

1. **The Status.** Replace:

```text
  - 10:10 EDT, the final review: two of its findings changed "M'aol's route" (a gap of 10 minutes or more in his readings starts his trail again) and "Stored" (a sweep stored ahead of the clock doesn't beat a tab's own copy).
```

   With:

```text
  - 10:10 EDT, the final review: two of its findings changed "M'aol's route" (a gap of 10 minutes or more in his readings starts his trail again) and "Stored" (a sweep stored ahead of the clock doesn't beat a tab's own copy).
  - 10:03 to 10:28 EDT, testing the box while M'aol could be hit: the owner asked "can it know where it goes next?" and "and when he will go next to mexico". The Cayman Islands' and the UK's praetorians had fallen a second apart, so the box knew no route and named no next stop. The owner approved the design at 10:27 EDT with "do recommended" (his next stop whenever it is certain, and his moves settling falls too close to put in order), then said at 10:28 EDT "it doesnt shown where and when hes moving next", which added naming both of two next stops; the owner kept that at 10:53 EDT. That changed "The box", "M'aol's route" and "Testing" for 1.0.2.
```

2. **"The box", M'aol's line once he can be hit.** Replace:

```text
then, when his route is known, `next Canada about 11:17 TCT` and `route Mexico > Cayman Islands > United Kingdom > Canada > Hawaii` |
```

   With:

```text
then, when his next stop is known, `next Canada about 11:17 TCT` (or `next Cayman Islands or United Kingdom about 11:17 TCT`), and when his route is, `route Mexico > Cayman Islands > United Kingdom > Canada > Hawaii` |
```

3. **"M'aol's route", its opening.** Replace:

```text
So once he can be hit, the box says where he goes next, when the script knows his route.
```

   With:

```text
So once he can be hit, the box says where he goes next and his route, as far as the script knows them.
```

4. **"The route from the falls", and "His moves settle it" after it.** Replace:

```text
- **The route from the falls:** when the script saw all five praetorians fall, each with a time (the 3-minute rule) and each at least 30 seconds after the one before, the route is their countries in the order they fell. Falls seen in the same sweep can't be put in order, so then this route isn't known.
```

   With:

```text
- **The route from the falls:** when each praetorian has a defeat time (TornStats', or the script's own by the 3-minute rule), the route is their countries in the order they fell. Falls each under 30 seconds after the one before make a run, however far apart its first and last: they came too close to put in order (falls seen in the same sweep, or TornStats' times a second apart), so each order of a run may be his route.
- **His moves settle it:** each move the script saw him make, from one of the five countries straight to another in his trail, is a step of his route, and an order the falls allow without that step is dropped. When one order is left, it is his route. On 2026-10-26 the Cayman Islands and the UK fell a second apart, after Mexico and before Canada, and one move among those four, such as the UK to Canada, settles which came first.
```

5. **"Which wins".** Replace:

```text
- **Which wins:** the route from his moves, once it is whole, because it is what he did. Until then, the route from the falls.
```

   With:

```text
- **Which wins:** the route from his moves, once it is whole, because it is what he did. Until then, the order the falls allow that fits his moves. When his moves fit no order the falls allow, the box names no route and no next stop until his trail is whole: it doesn't name a stop it saw him skip.
```

6. **"Next stop".** Replace:

```text
- **Next stop:** the country after his current one on the route, from the last back to the first. The time is 15 minutes after he was seen arriving, shown only when his arrival here had a time. In a country not on the route, such as Torn City, there is no next stop.
```

   With:

```text
- **Next stop:** the country after his current one, from the last back to the first, on each order that may be his route. When they all give the same country, that is his next stop, route known or not: on 2026-10-26, from Hawaii it was Mexico, whichever came first of the Cayman Islands and the UK. When they give two, the box names both; when more, none. The time is 15 minutes after he was seen arriving, shown only when his arrival here had a time. In a country not on the route, such as Torn City, there is no next stop.
```

7. **"Shown".** Replace:

```text
- **Shown:** under M'aol's line, after `moves about every 15 min...`: `next Canada about 11:17 TCT` (or `next Canada` without a time), then `route Mexico > Cayman Islands > United Kingdom > Canada > Hawaii`. With no route known, neither shows.
```

   With:

```text
- **Shown:** under M'aol's line, after `moves about every 15 min...`: `next Canada about 11:17 TCT` (or `next Canada` without a time, or `next Cayman Islands or United Kingdom about 11:17 TCT` for one of two), then, once his route is known, `route Mexico > Cayman Islands > United Kingdom > Canada > Hawaii`. Where to fly needs his route.
```

8. **"Testing", M'aol's route.** Replace:

```text
  - tied times from TornStats give no route from the falls.
```

   With:

```text
  - tied times from TornStats give no route from the falls;
  - falls too close to put in order: the next stop when every order gives the same one (from Hawaii, Mexico), both of two (from Mexico, the Cayman Islands or the UK), none of three, and no route or where to fly;
  - one move among them settles their order, either way round, and his route and where to fly show;
  - a move that fits no order the falls allow: no next stop and no route until he has been seen in all five countries;
  - falls each under 30 s after the one before are one run, however far apart its first and last (11:52:00, :20 and :40 are one run of three).
```

- [ ] **Step 7: Commit.**

```bash
WT=/opt/warboard/.superpowers/sdd/2026-10-26-torn-ancient-ones-next-stop/wt; cd "$WT" && git commit -q -F - -- server/public/scripts/torn-ancient-ones.user.js server/torn-ancient-ones.test.mjs docs/superpowers/specs/2026-10-26-torn-ancient-ones-design.md <<'MSG' && git log --format='%h %s' -1 && git status --short
torn-ancient-ones: M'aol's next stop whenever it is certain, and his moves settle close falls

Falls under 30 s apart can't be put in order, so the box knew no route
and named no next stop. The box now works out every order he may be
going round in, drops those his seen moves don't fit, and names his
next stop when they agree, or both of two. One order left is his route.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
MSG
```

Expected: the commit, then only `?? server/node_modules`.

### Task 2: Version 1.0.2

**Files:**
- Modify: `server/public/scripts/torn-ancient-ones.user.js` (@version, the CHANGELOG, `VERSION`) and `server/public/scripts/torn-ancient-ones.meta.js` (rebuilt from the header).
- Test: `server/torn-ancient-ones.test.mjs` (the version in five places).
- Modify: `docs/superpowers/specs/2026-10-26-torn-ancient-ones-design.md` (the version in two places).

**Interfaces:** consumes Task 1's script; produces 1.0.2 as Task 3 releases it.

- [ ] **Step 1: The tests ask for 1.0.2.** Five edits to the test file, in order:

1. **The console line.** Replace:

```js
const RUNNING = '[Torn Ancient Ones 1.0.1] running';
```

   With:

```js
const RUNNING = '[Torn Ancient Ones 1.0.2] running';
```

2. **The header's version.** Replace:

```js
    'version 1.0.1',
```

   With:

```js
    'version 1.0.2',
```

3. **`VERSION`.** Replace:

```js
  assert.match(src, /\n  const VERSION = '1\.0\.1';\n/);
```

   With:

```js
  assert.match(src, /\n  const VERSION = '1\.0\.2';\n/);
```

4. **The CHANGELOG.** Replace:

```js
  assert.match(src, /\n\/\/ v1\.0\.1  - The Attack link opens Torn's attack page again/);
```

   With:

```js
  assert.match(src, /\n\/\/ v1\.0\.2  - M'aol's next stop shows whenever it is certain,/);
  assert.match(src, /\n\/\/ v1\.0\.1  - The Attack link opens Torn's attack page again/);
```

5. **The mark on `<html>`.** Replace:

```js
getAttribute('data-torn-ancient-ones'), '1.0.1');
```

   With:

```js
getAttribute('data-torn-ancient-ones'), '1.0.2');
```

- [ ] **Step 2: Run T.**

Expected: `# tests 103 # pass 100 # fail 3`: `the header is the spec's...`, `it says once in the console that it is running...` and `with no GM functions at all...`.

- [ ] **Step 3: The script says 1.0.2.** Three edits, in order:

1. **@version.** Replace:

```js
// @version      1.0.1
```

   With:

```js
// @version      1.0.2
```

2. **The CHANGELOG, 1.0.2 above 1.0.1.** Replace:

```js
// v1.0.1  - The Attack link opens Torn's attack page again (page.php), now that
```

   With:

```js
// v1.0.2  - M'aol's next stop shows whenever it is certain, even when two of his
//           praetorians fell too close together to put in order, and the box names
//           both when it is one of two. A move it sees him make settles their order,
//           and then his route and where to fly show.
// v1.0.1  - The Attack link opens Torn's attack page again (page.php), now that
```

3. **`VERSION`.** Replace:

```js
  const VERSION = '1.0.1';
```

   With:

```js
  const VERSION = '1.0.2';
```

Then rebuild the meta file from the header:

```bash
cd /opt/warboard/.superpowers/sdd/2026-10-26-torn-ancient-ones-next-stop/wt/server/public/scripts && awk '1; /^\/\/ ==\/UserScript==$/{exit}' torn-ancient-ones.user.js > torn-ancient-ones.meta.js && wc -l < torn-ancient-ones.meta.js && git diff --stat -- torn-ancient-ones.meta.js
```

Expected: `17`, and one line changed in the meta file.

- [ ] **Step 4: Run T, then C.**

Expected: `# tests 103 # pass 103 # fail 0`, then `ascii-ok`.

- [ ] **Step 5: The spec says 1.0.2.** Two edits:

1. **The Script line.** Replace:

```text
`.meta.js`, version 1.0.1. Tests:
```

   With:

```text
`.meta.js`, version 1.0.2. Tests:
```

2. **The header.** Replace:

```text
@version 1.0.1, and a CHANGELOG block.
```

   With:

```text
@version 1.0.2, and a CHANGELOG block.
```

- [ ] **Step 6: The mutant check.**

```bash
W=/opt/warboard/.superpowers/sdd/2026-10-26-torn-ancient-ones-next-stop; cd "$W" && node mutants.mjs "$W/wt/server/public/scripts/torn-ancient-ones.user.js" "$W/wt/server/torn-ancient-ones.test.mjs" "$W/mut" > "$W/mutants.log" 2>&1; echo "exit $?"; tail -1 "$W/mutants.log"; grep -vE ": caught \(" "$W/mutants.log" | head
```

Expected: `exit 0`, `71 of 71 caught`, and no line but the count and exit.

- [ ] **Step 7: Commit.**

```bash
WT=/opt/warboard/.superpowers/sdd/2026-10-26-torn-ancient-ones-next-stop/wt; cd "$WT" && git commit -q -m "torn-ancient-ones: 1.0.2" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- server/public/scripts/torn-ancient-ones.user.js server/public/scripts/torn-ancient-ones.meta.js server/torn-ancient-ones.test.mjs docs/superpowers/specs/2026-10-26-torn-ancient-ones-design.md && git log --format='%h %s' -1 && git status --short
```

Expected: the commit, then only `?? server/node_modules`.

## Between Task 2 and Task 3: the final review

One fresh Opus reviewer checks the whole branch (main..torn-ancient-ones-next-stop), with this plan's Review Focus. Critical and Important findings get one fix pass, test first; minors go to the ledger. Nothing is served until Task 3.

### Task 3: Release

**Files:** none change here. Main fast-forwards to the branch, the two served files get their owner, and the memory notes outside the repo are updated.

**Interfaces:** consumes the branch after the final review's fix pass.

- [ ] **Step 1: Pre-flight.** The box isn't overloaded, main hasn't moved, and none of the branch's files is changed in the main checkout:

```bash
uptime; cd /opt/warboard && git status --short -- server/public/scripts/torn-ancient-ones.user.js server/public/scripts/torn-ancient-ones.meta.js server/torn-ancient-ones.test.mjs docs/superpowers/specs/2026-10-26-torn-ancient-ones-design.md && git merge-base --is-ancestor main torn-ancient-ones-next-stop && echo fast-forward-ok
```

Expected: the load under 12, no status lines, then `fast-forward-ok`. If main has moved, rebase the branch on it (`git -C "$WT" rebase main`) and run T, which must be all green.

- [ ] **Step 2: Fast-forward main.** tornwar.com serves 1.0.2 from this moment:

```bash
cd /opt/warboard && git merge --ff-only torn-ancient-ones-next-stop && chown warboard:warboard server/public/scripts/torn-ancient-ones.user.js server/public/scripts/torn-ancient-ones.meta.js && chmod 644 server/public/scripts/torn-ancient-ones.user.js server/public/scripts/torn-ancient-ones.meta.js && ls -l server/public/scripts/torn-ancient-ones.user.js server/public/scripts/torn-ancient-ones.meta.js
```

Expected: `Fast-forward`, then both files `-rw-r--r-- warboard warboard`.

- [ ] **Step 3: The whole suite, in place:**

```bash
cd /opt/warboard/server && node --test > /opt/warboard/.superpowers/sdd/2026-10-26-torn-ancient-ones-next-stop/suite.log 2>&1; grep -E "^# (tests|pass|fail|skipped) " /opt/warboard/.superpowers/sdd/2026-10-26-torn-ancient-ones-next-stop/suite.log | paste -sd" " -
```

Expected: `# fail 0`, with 2 skipped, and about 2613 tests (2608 at 1.0.1's release, and this plan's 5, give or take other sessions' work).
- If a failure is this change's, take it down at once: `git revert --no-edit <Task 1's commit>^..HEAD` on main, then stop.
- If it is another session's, name it in the report and carry on.

- [ ] **Step 4: Check what is served:**

```bash
curl -s http://127.0.0.1:3000/scripts/torn-ancient-ones.meta.js | grep '@version'; curl -s https://tornwar.com/scripts/torn-ancient-ones.meta.js | grep '@version'; curl -s https://tornwar.com/scripts/torn-ancient-ones.user.js | grep -c "const VERSION = '1.0.2'"; curl -s https://tornwar.com/scripts/torn-ancient-ones.user.js | sha256sum | cut -c1-16; sha256sum /opt/warboard/server/public/scripts/torn-ancient-ones.user.js | cut -c1-16
```

Expected: `// @version      1.0.2` twice, then `1`, then the same 16 characters twice.

- [ ] **Step 5: Sweep the push, then push main.** The repo is public. Look at every commit the push adds, any 16-character word in an added line (Torn's keys are 16 characters), and any value of `server/.env` (the check prints names only):

```bash
W=/opt/warboard/.superpowers/sdd/2026-10-26-torn-ancient-ones-next-stop; cd /opt/warboard && git log --format='%h %s' origin/main..main && git diff origin/main..main -U0 | grep -E '^\+' | grep -v -E '^\+\+\+ ' > "$W/push-added.txt"; wc -l < "$W/push-added.txt"; grep -o -E '\b[A-Za-z0-9]{16}\b' "$W/push-added.txt" | sort -u; python3 -I - "$W/push-added.txt" <<'PY'
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

Expected: this plan's three commits (the plan, Task 1, Task 2, and any from the fix pass); no 16-character word but plain ones like `addEventListener`; `.env values in the push: none`. A key-like word, a `.env` name, or a commit that isn't this plan's: stop, don't push, and ask the owner. When the sweep is clean, push, with the remote's credentials masked:

```bash
cd /opt/warboard && git push origin main 2>&1 | sed -E 's#//[^@]*@#//***@#g'; git status -sb | head -1
```

Expected: `main -> main`, and `## main...origin/main` with nothing ahead.

- [ ] **Step 6: Record Task 3,** from inside `$WT`, with `task-done` and the served-version check as its test command:

```bash
bash -c "set -o pipefail; curl -s https://tornwar.com/scripts/torn-ancient-ones.meta.js | grep -q '@version      1.0.2' && echo served-1.0.2"
```

Then copy the ledger, `mutants.log` and `suite.log` out of the workspace, to the session's scratchpad, before the workspace goes.

- [ ] **Step 7: Remove the worktree, the branch and the workspace.** The worktree's symlink goes first, because git counts it as untracked:

```bash
rm /opt/warboard/.superpowers/sdd/2026-10-26-torn-ancient-ones-next-stop/wt/server/node_modules && cd /opt/warboard && git worktree remove /opt/warboard/.superpowers/sdd/2026-10-26-torn-ancient-ones-next-stop/wt && git branch -d torn-ancient-ones-next-stop && rm -r /opt/warboard/.superpowers/sdd/2026-10-26-torn-ancient-ones-next-stop && git worktree list
```

Expected: `git worktree list` shows only `/opt/warboard`.

- [ ] **Step 8: Notes and report.**
  - Update this script's project memory, outside the repo: 1.0.2 is live and pushed, and what changed, in EDT.
  - Report to the owner: any rulings and deferred minors from the ledger, and the served URL, https://tornwar.com/scripts/torn-ancient-ones.user.js. Tampermonkey takes 1.0.2 as an update.
