# Torn Icon Hider 1.0.0 - Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A new userscript, Torn Icon Hider 1.0.0, that lets you choose which of Torn's status icons show in your sidebar row. A long press on any of Torn's icons, or "Icon Hider: Settings" in the script menu, opens a list of every kind of icon seen there. One you untick stays hidden until you tick it again.

**Architecture:** One new script, `server/public/scripts/torn-icon-hider.user.js`, with its `.meta.js`, tested in `server/torn-icon-hider.test.mjs`.
- It hides icons with one stylesheet: a `display: none` rule per hidden picture number, for the sidebar row only. It never changes, moves or removes Torn's nodes.
- It builds the stylesheet at document-start from GM storage and from Torn's own sidebar data in sessionStorage, then checks both again every 2 seconds.
- A settings box lists every kind of icon learned, with a switch each.
- All work happens in a git worktree on a branch, because the main checkout is the tree tornwar.com serves. The release fast-forwards main.

**Tech Stack:** a plain-JavaScript userscript (Tampermonkey, Torn PDA, the warboard app). Tests use node:test and linkedom, and read the script from `TIH_SRC`. The layout proof runs in headless Chromium (playwright-core), against Torn's own sidebar stylesheets, outside the repo.

**Spec:** `docs/superpowers/specs/2026-10-24-torn-icon-hider-design.md`. The owner approved it on 2026-10-24 at 21:12 EDT: "approved, write the plan". This plan's commit sets the spec's Status line to say so. The owner's decisions are the spec's table: Q1-Q7 ("our own script", then "do recommended") and New 1-3.

**Execution:** the owner, 2026-10-24 at 22:08 EDT: "im going to sleep so get script done youre in the pilot seat". So this plan runs at once, Native: one session does every task, then one fresh Opus reviewer checks the whole branch, and the release follows the review's fix pass. The live check waits for the owner.

**Dry run:** all the code in this plan ran while the plan was written.
- Each task's script edits were replayed on the script as the task before leaves it, and rebuild the next stage byte for byte.
- Each task's tests ran against the stage before (the RED lines below) and the stage after (the GREEN lines).
- The mutant check (Task 4) caught 41 of 41.
- The layout proof (Task 2) passed 8 of 8 on the finished script, and its two controls failed where they should.

## Global Constraints

- **Name and owner:** @name `Torn Icon Hider`, file `torn-icon-hider.user.js`. @namespace and @author `RussianRob`. @license `All Rights Reserved`. No @copyright.
- **Version** `1.0.0`, in three places: `// @version`, `const VERSION`, and the CHANGELOG entry `// v1.0.0  - First release.`. The console line on start carries it: `[Torn Icon Hider 1.0.0] running`.
- **URLs:** @downloadURL `https://tornwar.com/scripts/torn-icon-hider.user.js`, @updateURL `https://tornwar.com/scripts/torn-icon-hider.meta.js`.
- **Where it runs:** @match `https://www.torn.com/*` and `https://torn.com/*`, @run-at `document-start`.
- **Grants:** @grant GM_getValue, GM_setValue, GM_registerMenuCommand. No @connect.
- **The `.meta.js`** is the header, byte for byte, then a newline.
- **Plain ASCII,** because PDA turns curly quotes into a syntax error.
- **Every `GM_*` call is guarded** with `typeof`, on its own line or the line before.
- **No API key,** so `###PDA-APIKEY###` never appears. No password field of any kind.
- **Storage:** values are strings of JSON, because PDA hands stored values back as strings. Two keys: `tih-kinds` and `tih-hidden`.
- **One menu entry,** named for the script: `Icon Hider: Settings`.
- **Torn's page:** the script adds one `<style>` (`tm-icon-hider-styles`) and, while it is open, the settings box (`tm-icon-hider-settings`). It changes, moves and removes nothing of Torn's.
- **No clicks:** the script never clicks anything for you. A long press only opens the box and stops the click that the press ends in.
- **Comments:** clear `//` lines in the file's own style, with no version crumbs. Version notes go only in the CHANGELOG.
- **The repo is public:** no keys, key endings or member data in code, tests, plan or commits, and none of Torn's stylesheets. Those stay in this plan's git-ignored workspace.
- **Served files** are `warboard:warboard 644`.
- **The script and its test file reach the main checkout together,** in the release's fast-forward. The test file's default `SRC` is the served path, `/opt/warboard/server/public/scripts/torn-icon-hider.user.js`, which doesn't exist until then.
  - In the worktree, only `T` (which sets `TIH_SRC`) runs, never a bare `node --test`: the whole suite there would fail this file for want of the served script.
  - The whole suite runs once, in `/opt/warboard/server`, after the fast-forward.
- **Commits** name only this plan's paths: `git add -- <new paths>`, then `git commit -- <paths>`. Trailer: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **A hidden kind whose picture number changes.** A hidden drug cooldown moving to its next level never shows, because its level range is hidden whole. Another hidden kind's new number may show until the next check, at most 2 seconds, once (New 3). A range never hides a kind that is switched on. Tests: "a hidden cooldown's next level is hidden before it is ever seen", "another hidden kind's new picture number shows until the next check, then stays hidden" and "a kind that is switched on is never hidden by another kind's level range" (Task 1).
2. **Icons with the row's classes elsewhere on the page, and a row Torn redraws or replaces.** Only the sidebar row is touched: never Torn's header, a tray of icons outside the sidebar, or the Xanax and Blood Bag icons. The long press keeps working on a row Torn has replaced. Tests: the four "<layout>: a hidden kind's icon is hidden in the row, and nothing else on the page is" (Task 1), and "it works on a row Torn has replaced" (Task 4).
3. **Storage that misbehaves:** values that come back as objects or won't parse, and writes that are refused, dropped or read back wrong. The icons show rather than vanish. A Save that fails says so, stays open and keeps the old choice. Tests: "stored values that come back as objects still work" and "stored values that won't parse read as nothing saved: every icon shows" (Task 1), and "a save that storage refuses, drops, or reads back wrong says so, stays open, and keeps what was saved before" (Task 3).
4. **A long press that ends in a click Torn would act on:** a touchend that can't be cancelled, the phone's mouse copies of the touch, a tap in the box right after. Torn neither selects the icon nor follows its link, and the box works at once. Tests: "when a long press's touchend can't be cancelled, the click that follows is stopped; one much later is not", "after a long press, the phone's copies of the touch as mouse events start no second press" and "right after a long press, a tap on a switch in the box works" (Task 4).
5. **Every icon hidden.** In PDA there would be no way back, so Save keeps one showing, even when PDA's bridge turns up after the script has started. In the warboard app (which can carry PDA's bridge) and in Tampermonkey, every icon can go. Tests: "in Torn PDA, Save won't hide the last of Torn's icons showing in the row, and says why", "PDA is told by its user agent too; the warboard app (even with PDA's bridge) and Tampermonkey can hide every icon" and "PDA's bridge counts when it arrives after the script has started" (Task 3).

## Rulings made at plan time

1. **Desktop spacing is a flex row, not moved icons.** While something is hidden, the desktop row gets `display: flex; flex-wrap: wrap; column-gap: 10px; row-gap: 0`, and its li's `flex: none; margin-right: 0`. Torn's 10 px bottom margin stays, so lines stay 27 px apart. Moving hidden icons to the end is out, as the spec says. The layout proof below shows the result.
2. **The spacing rule needs Torn's `big___` class as well as no `mobile___`.** It is proved only for that row: 17 px icons in a 152 px box.
3. **A finger may wobble 10 px** (`SLOP_PX`) before it counts as moving and cancels the press. A thumb held still still drifts a little.
4. **The click a long press ends in is stopped only within 600 ms** (`AFTER_PRESS_MS`). It is stopped only when the touchend couldn't be cancelled, or when the press was the mouse's. Mouse events within 600 ms of a touch are the phone's copies of it and start no press. So a tap on a switch right after a long press works.
5. **PDA is told apart as FactionOps does it.** One cost: a Flutter-based fork of the warboard app without `gmBridge` would be taken for PDA, and would always keep one icon showing.
6. **PDA is asked about each time the box opens, not at start.** The script runs at document-start, before the page has anything, and PDA's bridge may come later. Every other script that checks for the bridge runs at document-end or later.
7. **Every handler the script gives the page, its box or the menu runs inside `safely()`,** a try that drops the error. The spec says "Errors are caught inside each check and each handler"; the first dry run left the handlers bare. Task 3's test reads every `addEventListener(` and `GM_registerMenuCommand(` line, and calls each document listener with an event whose every field throws.
8. **The script takes `<html>` as there at document-start,** as `torn-dual-flyout.user.js` (DF pinned links) does, live: Tampermonkey, the warboard app and both of PDA's webviews run document-start scripts once the document element exists. Playwright runs its init scripts earlier still, so the layout proof waits for `<html>` before it runs the script.
9. **The box's CSS is in the one stylesheet,** so the page gets one `<style>`.
10. **A kind in the row now is drawn with its picture number now;** a kind seen before, with the last number learned.
11. **Titles have their tags stripped by a regex** and six entities read (`&nbsp; &lt; &gt; &quot; &#39; &amp;`). They are never parsed as HTML, and they go in the box as text.
12. **The test harness is written whole in Task 1,** so the file reads top-down. Its box and press helpers (`BOX`, `MENU`, `HELP`, `KEEP_ONE`, `fire`, `lines`, `boxButton`, `boxSwitch`, `w.reactSaw`) are first used in Tasks 3 and 4.
13. **The header, the description and the CHANGELOG are final from Task 1.** Task 3's help text and comments speak of the long press, which Task 4 adds. Nothing is served before Task 5.
14. **A few tests pass before their task's code exists.** They are guards: they pin what the new code must leave alone. Each RED line below names them, and a mutant in Task 4's check shows that each one bites.
15. **The layout proof, the mutant check and Torn's stylesheets stay in this plan's git-ignored workspace,** never committed. The stylesheets are Torn's, and the proof needs them and a local playwright-core.
16. **The work is in a git worktree** on branch `torn-icon-hider`, inside this plan's git-ignored workspace, because the main checkout is what tornwar.com serves. Each task commits there. Task 5 fast-forwards main.
17. **The final review runs between Task 4 and Task 5,** so nothing unreviewed is served.

## The layout proof, at plan time

`probe-room.mjs` (Task 2) loads the script into copies of Torn's row inside Torn's own sidebar stylesheets, saved 2026-10-21: the Fly-out sidebar and the old one, each at desktop width and at phone width. Each row has 13 of Torn's icons with real class names, 3 of them hidden, with and without the Xanax and Blood Bag icons in front. It then measures where the icons that show end up. Every request is answered locally or aborted.

On the finished script:

```
Fly-out, desktop, with the Xanax and Blood Bag icons: lines 6/6: ok
Fly-out, desktop, Torn's icons only: lines 6/4: ok
old sidebar, desktop, with the Xanax and Blood Bag icons: lines 6/6: ok
old sidebar, desktop, Torn's icons only: lines 6/4: ok
Fly-out, phone, with the Xanax and Blood Bag icons: lines 12: ok
Fly-out, phone, Torn's icons only: lines 10: ok
old sidebar, phone, with the Xanax and Blood Bag icons: lines 12: ok
old sidebar, phone, Torn's icons only: lines 10: ok
all 8 ok
```

With the spacing rule taken out, the desktop lines come out uneven, as the spec says. Torn's every-6th rule takes the margin off an icon in mid-line, and without the Xanax and Blood Bag icons the lines come out 5 and 5:

```
Fly-out, desktop, with the Xanax and Blood Bag icons: lines 6/6: FAIL (icons not 27 px apart) [[0,27,54,81,108,125],[0,27,54,71,98,125]]
Fly-out, desktop, Torn's icons only: lines 5/5: FAIL (icons not 27 px apart; lines not 6 icons from the left) [[0,27,54,81,108],[0,27,54,81,98]]
old sidebar, desktop, with the Xanax and Blood Bag icons: lines 6/6: FAIL (icons not 27 px apart) [[0,27,54,81,108,125],[0,27,54,71,98,125]]
old sidebar, desktop, Torn's icons only: lines 5/5: FAIL (icons not 27 px apart; lines not 6 icons from the left) [[0,27,54,81,108],[0,27,54,81,98]]
Fly-out, phone, with the Xanax and Blood Bag icons: lines 12: ok
Fly-out, phone, Torn's icons only: lines 10: ok
old sidebar, phone, with the Xanax and Blood Bag icons: lines 12: ok
old sidebar, phone, Torn's icons only: lines 10: ok
4 of 8 FAIL
```

With the nudge taken out, no scroll event reaches the phone strip:

```
Fly-out, desktop, with the Xanax and Blood Bag icons: lines 6/6: ok
Fly-out, desktop, Torn's icons only: lines 6/4: ok
old sidebar, desktop, with the Xanax and Blood Bag icons: lines 6/6: ok
old sidebar, desktop, Torn's icons only: lines 6/4: ok
Fly-out, phone, with the Xanax and Blood Bag icons: lines 12: FAIL (no scroll sent to the strip) [[5,32,59,86,113,140,167,194,221,248,275,302]]
Fly-out, phone, Torn's icons only: lines 10: FAIL (no scroll sent to the strip) [[5,32,59,86,113,140,167,194,221,248]]
old sidebar, phone, with the Xanax and Blood Bag icons: lines 12: FAIL (no scroll sent to the strip) [[5,32,59,86,113,140,167,194,221,248,275,302]]
old sidebar, phone, Torn's icons only: lines 10: FAIL (no scroll sent to the strip) [[5,32,59,86,113,140,167,194,221,248]]
4 of 8 FAIL
```

What it can't show: Torn's own React working out the strip's fade again. The proof shows that the event reaches the strip, where both sidebars listen (`onScroll`). The owner's live check covers the rest. If the fade stays, the spec's fallback is a `resize` on the window.

## Files

- Create: `server/public/scripts/torn-icon-hider.user.js` (Task 1; edited in Tasks 2-4).
- Create: `server/public/scripts/torn-icon-hider.meta.js` (Task 1).
- Create: `server/torn-icon-hider.test.mjs` (Task 1; extended in Tasks 2-4).
- Modify: `docs/superpowers/specs/2026-10-24-torn-icon-hider-design.md`, its Status line only, in this plan's own commit.
- Outside the repo, in the workspace `/opt/warboard/.superpowers/sdd/2026-10-24-torn-icon-hider/` (git-ignored):
  - `torn/`: Torn's two sidebar stylesheets and its icon sprite;
  - `probe-room.mjs`: the layout proof (Task 2);
  - `mutants.mjs` and `mut/`: the mutant check (Task 4);
  - `suite.log`: the whole suite's output (Task 5).

## Paths and commands

- **`W` is the workspace,** `/opt/warboard/.superpowers/sdd/2026-10-24-torn-icon-hider`. **`WT` is the worktree,** `$W/wt`. Every command sets them, because shell variables don't carry from one command to the next.
- **The superpowers scripts** (`task-start`, `task-done`, `review-package`) run from inside `$WT`, so their `git rev-parse HEAD` is the branch's. Their ledger and briefs live in the worktree's own git-ignored `.superpowers/sdd/`.
- **The symlink:** `server/node_modules` in the worktree is a symlink to the main checkout's. Git sees it as untracked (`server/.gitignore` has `node_modules/`, which matches directories only), so commits always name their paths and never use `git add -A`.
- **`T`, the test run:**

```bash
WT=/opt/warboard/.superpowers/sdd/2026-10-24-torn-icon-hider/wt; cd "$WT/server" && TIH_SRC="$WT/server/public/scripts/torn-icon-hider.user.js" node --test torn-icon-hider.test.mjs 2>&1 | grep -E "^# (tests|pass|fail) " | paste -sd" " -
```

- **`C`, the source check** (it parses, and it is plain ASCII):

```bash
WT=/opt/warboard/.superpowers/sdd/2026-10-24-torn-icon-hider/wt; F="$WT/server/public/scripts/torn-icon-hider.user.js"; node --check "$F" && LC_ALL=C grep -c '[^ -~]' "$F" | grep -qx 0 && echo ascii-ok
```

- **`P`, the layout proof** (headless Chromium; one heavy thing at a time):

```bash
W=/opt/warboard/.superpowers/sdd/2026-10-24-torn-icon-hider; cd "$W" && node probe-room.mjs "$W/wt/server/public/scripts/torn-icon-hider.user.js" torn; echo "exit $?"
```

## Setup (before Task 1)

- [ ] **Check the load and the workspace's files.** They were put there at plan time, and the hashes are theirs:

```bash
uptime; W=/opt/warboard/.superpowers/sdd/2026-10-24-torn-icon-hider; cd "$W" && sha256sum torn/sidebar-flyout.css torn/sidebar-old.css torn/sprite.svg probe-room.mjs mutants.mjs && ls /root/.npm/_npx/86170c4cd1c5da32/node_modules/playwright-core/index.mjs
```

Expected: load under 12, then:

```
4b869210aca094e87acb9a3503c1fa48707016645e68ccf7004bec71ecb3afdb  torn/sidebar-flyout.css
80efac7ed64d734500837e7a055020e85d9e4d209be94dca9838aaa056b835ef  torn/sidebar-old.css
aba44f3c67b10b778838a8be69520ac852a06defb2f1920357fc0a3e25e2cb38  torn/sprite.svg
c56827de856cad01b3bb19802af4aead71a434a2a8965740dee298c667022bae  probe-room.mjs
8939fb844c8dfcbc4fa162ad896d37e6d0386792690b11b5ed1555407aa623ab  mutants.mjs
```

then the playwright-core path.
- If the load is over 12, wait.
- If `probe-room.mjs` or `mutants.mjs` is missing or its hash differs, write it again from its block (Task 2 Step 3, Task 4 Step 5) and check the hash again.
- If any of Torn's three files is missing or differs, stop and ask. They came from Torn's site on 2026-10-21 (`/builds/sidebar/app.6bd35b102423231d.css`, `/builds/sidebar-old/app.9a66bbb3a58d33b3.css` and `/images/v2/svg_icons/sprites/user_status_icons_sprite.svg`), and the proof is only good against Torn's own files.
- If the playwright-core path is gone, stop and ask before installing anything.

- [ ] **Make the worktree** from this plan's commit on main:

```bash
WT=/opt/warboard/.superpowers/sdd/2026-10-24-torn-icon-hider/wt; cd /opt/warboard && git worktree add "$WT" -b torn-icon-hider main && ln -s /opt/warboard/server/node_modules "$WT/server/node_modules" && git -C "$WT" log --format='%h %s' -1 && git -C "$WT" status --short && cd "$WT/server" && node -e "import('linkedom').then(() => console.log('linkedom-ok'))"
```

Expected: the branch's first commit is this plan's commit; status shows only `?? server/node_modules`; then `linkedom-ok`. There is no baseline run: the script and its tests don't exist yet.

---

### Task 1: Hiding

**Files:**
- Create: `server/public/scripts/torn-icon-hider.user.js`
- Create: `server/public/scripts/torn-icon-hider.meta.js`
- Create (tests): `server/torn-icon-hider.test.mjs`

**Interfaces:**
- Consumes: nothing; the script is new.
- Produces, inside the script's one function (later tasks use these names):
  - `VERSION`, `root` (`document.documentElement`), `STYLE_ID = 'tm-icon-hider-styles'`, `ROWS` (the two `#sidebar ul[...]` row selectors), `POLL_MS = 2000`, `KINDS_STORE = 'tih-kinds'`, `HIDDEN_STORE = 'tih-hidden'`, `LEVELS` (the six level ranges);
  - `gmGet(name) -> stored value or ''`, `gmSet(name, value) -> boolean`, `readJson(name) -> value or null`, `own(obj, key) -> boolean`;
  - `readIcons() -> { key: entry } or null` (Torn's `statusIcons.icons`), `iconNumber(entry) -> number` (0 for none), `plainTitle(value) -> string`;
  - `readKinds() -> { key: { title, ids } }`, `readHidden() -> string[]`, `learn(kinds, icons) -> boolean`, `learned() -> kinds`, `hiddenNumbers(kinds, hidden) -> number[]` (sorted);
  - `hideRule(n) -> string`, `cssText(numbers) -> string`, `applyStyles(numbers)`, `check()`.
- Produces, in the test file (Tasks 2-4 add their tests at its end and use these):
  - `page(options) -> w`, a Torn page with the script on it: `w.run()`, `w.check()`, `w.advance(ms)`, `w.draw()`, `w.setIcons(icons)`, `w.replaceRow()`, `w.row()`, `w.box()`, `w.icon(name)`, `w.store`, `w.menu`, `w.window`, `w.logs`, `w.captures`, `w.reactSaw`;
  - `fire(w, el, type, fields) -> event`, `rulesWith(w, declaration)`, `matching(w, declaration)`, `showing(w)`, `kindsIn(store)`, `lines(w)`, `boxButton(w, words)`, `boxSwitch(w, name)`, `countWrites(w)`, `hiding(...keys)`;
  - `LAYOUTS`, `DESKTOPS`, `PHONES`, `ICONS`, `TITLES`, `BLOODBAG`, `XANAX`, `STYLES`, `BOX`, `MENU`, `HELP`, `KEEP_ONE`, `NOW`.

- [ ] **Step 1: Write the failing tests.** Create `server/torn-icon-hider.test.mjs`:

```js
// Torn Icon Hider: choose which of Torn's status icons show in the sidebar row. These tests load
// the real script into hand-built Torn pages, with the clock, timers, GM storage, the menu, the
// console and the host (Torn PDA, the warboard app) under their control.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseHTML } from 'linkedom';

// TIH_SRC lets a mutant copy be tested in place of the served file.
const SRC = process.env.TIH_SRC || '/opt/warboard/server/public/scripts/torn-icon-hider.user.js';
const META = SRC.replace(/\.user\.js$/, '.meta.js');
const STYLES = 'tm-icon-hider-styles';
const BOX = 'tm-icon-hider-settings';
const MENU = 'Icon Hider: Settings';
const HELP = 'Untick an icon to hide it. Hidden icons stay in this list, so you can bring them back. '
  + 'A long press on any icon in the row opens these settings.';
const KEEP_ONE = 'Keep one icon showing: in Torn PDA, a long press on an icon is the only way back here.';
// The test clock: 2026-10-24 22:00 UTC, in Unix seconds.
const NOW = Date.UTC(2026, 9, 24, 22) / 1000;

// Torn's real class names for the icons used here, as each sidebar's stylesheet names them
// (from Torn's own files, saved in October 2026). Some have four underscores.
const FLY = { icon4: 'icon4___y6P08', icon5: 'icon5___L_2pk', icon6: 'icon6___R1xkN', icon8: 'icon8____Cehh',
  icon9: 'icon9___c8nOV', icon27: 'icon27___AH_kQ', icon49: 'icon49___iPumB', icon50: 'icon50___xzS1U',
  icon51: 'icon51___QDV4a', icon52: 'icon52____l66f', icon53: 'icon53___MXjcG', icon68: 'icon68___PDnPQ',
  icon74: 'icon74___Sgygm', icon81: 'icon81___isa6b', icon85: 'icon85___CyVUf' };
const OLD = { icon4: 'icon4___AaDeJ', icon5: 'icon5___dEHuC', icon6: 'icon6___rVWN7', icon8: 'icon8___QjLhg',
  icon9: 'icon9___ablCG', icon27: 'icon27___XQYNI', icon49: 'icon49___N4k4a', icon50: 'icon50___XF8N8',
  icon51: 'icon51___p_Tey', icon52: 'icon52___rwwcC', icon53: 'icon53___BpaFR', icon68: 'icon68___hg6nW',
  icon74: 'icon74___OLE9U', icon81: 'icon81___nugt3', icon85: 'icon85___yu0le' };

// Torn's sidebar data for the row: statusIcons.icons, one entry per icon, in the row's order.
// Keys and fields as Torn saves them; the names and details are made up.
const ICONS = {
  maleGender: { iconID: 'icon6', title: 'Male', subtitle: '', link: '#' },
  subscriber: { iconID: 'icon4', title: 'Subscriber', subtitle: '<b>30</b> days left', link: '/membership.php' },
  married: { iconID: 'icon8', title: 'Married', subtitle: 'To Example Spouse', link: '/profiles.php?XID=1' },
  faction: { iconID: 'icon74', title: 'Faction', subtitle: 'Leader of Example Faction', link: '/factions.php' },
  book: { iconID: 'icon68', title: 'Reading Book', subtitle: 'Example Book', link: '/page.php?sid=education' },
  drug_cooldown: { iconID: 'icon53', title: 'Drug Cooldown', subtitle: 'Xanax', link: '#', timerExpiresAt: NOW + 3600 },
};
const TITLES = ['Male', 'Subscriber', 'Married', 'Faction', 'Reading Book', 'Drug Cooldown'];
// The Blood Bag and Xanax Reminders' icons, first in the row: an id each and no icon class.
const BLOODBAG = 'tm-full-life-bloodbag';
const XANAX = 'tm-xanax-reminder';
const OURS = '<li id="' + BLOODBAG + '" style="background: none;"><a href="#" aria-label="Blood bag"><img src="b.png" width="17" height="17"></a></li>'
  + '<li id="' + XANAX + '"><a href="#" aria-label="Drug cooldown over: Xanax ready"><img src="x.png" width="17" height="17"></a></li>';

// Torn's li for one entry: the class named for its picture number (none when Torn has no class
// for it), and a link labelled with the title and the details as text.
function li(build, entry) {
  const label = entry.title + (entry.subtitle ? ': ' + entry.subtitle.replace(/<[^>]*>/g, '') : '');
  const cls = build[entry.iconID];
  return '<li' + (cls ? ' class="' + cls + '"' : '') + '><a href="' + (entry.link || '#') + '" aria-label="' + label
    + '" tabindex="0" data-is-tooltip-opened="false"></a></li>';
}

// Torn's sidebar in its four layouts, cut down to the row, inside React's root (#sidebarroot).
const LAYOUTS = {
  'Fly-out, phone': { build: FLY, html: (lis) => '<div id="sidebarroot"><div id="sidebar" class="sidebar___c4dEc mobile___fSMgm">'
    + '<div class="userInformationMobile___Aznrv"><div class="swiperWrapper___gaWYk"><div class="points-mobile___Zx867">$1.0M 1000</div>'
    + '<ul class="statusIcons___ks48M big___O1UVc mobile___IzEv7">' + lis + '</ul></div></div></div></div>' },
  'Fly-out, desktop': { build: FLY, html: (lis) => '<div id="sidebarroot"><div id="sidebar" class="sidebar___c4dEc desktop___F2V9S">'
    + '<div class="userInformation___Tkqft"><div><ul class="statusIcons___ks48M big___O1UVc">' + lis + '</ul>'
    + '<hr class="delimiter___nLMP8"></div></div></div></div>' },
  'old sidebar, phone': { build: OLD, html: (lis) => '<div id="sidebarroot"><div id="sidebar" class="sidebar___V9DPj">'
    + '<div class="user-information-mobile___I1ebJ"><div class="swiperWrapper____QQNn"><div class="points-mobile___FGMxg">$1.0M 1000</div>'
    + '<ul class="status-icons___sskG2 mobile___YGGsN big___IeUkB">' + lis + '</ul></div></div></div></div>' },
  'old sidebar, desktop': { build: OLD, html: (lis) => '<div id="sidebarroot"><div id="sidebar" class="sidebar___V9DPj">'
    + '<div class="user-information___LZ_gM"><div class="content___Ueeif"><div><ul class="status-icons___sskG2 big___IeUkB">' + lis + '</ul>'
    + '<hr class="delimiter___i8yeL"></div></div></div></div></div>' },
};
const DESKTOPS = ['Fly-out, desktop', 'old sidebar, desktop'];
const PHONES = ['Fly-out, phone', 'old sidebar, phone'];
// Torn's header menu, a list that comes before the sidebar on every page.
const HEADER = '<div id="header-wrapper-top"><ul class="menu-items"><li><a href="/">Home</a></li></ul></div>';
// Icons outside the sidebar, drawn with the row's own classes, as other parts of Torn draw them.
const TRAY = '<div id="tray"><ul class="statusIcons___ks48M small___cZqpf">' + li(FLY, ICONS.maleGender) + li(FLY, ICONS.drug_cooldown)
  + '</ul><ul class="status-icons___sskG2 big___IeUkB">' + li(OLD, ICONS.maleGender) + li(OLD, ICONS.drug_cooldown) + '</ul></div>';

// Torn's sidebar data, as both builds save it to sessionStorage.
function sidebarData(icons) {
  return JSON.stringify({ user: { name: 'Example' }, statusIcons: { visible: true, onTop: true, icons } });
}

// GM storage holding these kinds hidden, as the settings box saves them.
function hiding(...keys) {
  return { 'tih-hidden': JSON.stringify(keys) };
}

// A Torn page with the script on it. The test controls:
// - the clock (w.clock.ms), and timers (w.advance(ms) moves the clock and runs what is due);
// - the 2-second check (w.check() runs it once; the script runs it once itself on start);
// - GM storage (w.store; two pages given the same store share it, as tabs do), and how a write
//   goes (setValue);
// - Torn's sidebar data (icons, or data: null for none; w.setIcons() changes it and redraws the row
//   as Torn does);
// - the menu (w.menu), the console (w.logs), and the host: ua, pda (PDA's bridge) and warboard
//   (the warboard app's bridge).
// With start: true the script runs at document-start, before there is a <head> or a sidebar, and
// w.draw() adds them. w.reactSaw lists the clicks that reached React's root, #sidebarroot.
function page({ layout = 'Fly-out, phone', icons = ICONS, data, store = {}, clock = { ms: NOW * 1000 },
  src = readFileSync(SRC, 'utf8'), menu = true, setValue, ua = 'Mozilla/5.0 (iPhone)', pda = false,
  warboard = false, start = false } = {}) {
  const lay = LAYOUTS[layout];
  const rowHtml = (list) => OURS + Object.keys(list).filter((k) => list[k] && typeof list[k] === 'object')
    .map((k) => li(lay.build, list[k])).join('');
  const dom = parseHTML('<!doctype html><html><head></head><body></body></html>');
  const doc = dom.document;
  // As in a browser, document.head and document.body are null until the page has them (linkedom
  // would make them up).
  ['head', 'body'].forEach((tag) => Object.defineProperty(doc, tag, {
    configurable: true, get: () => doc.documentElement.querySelector(tag) }));
  const session = Object.create({ getItem(k) { return Object.prototype.hasOwnProperty.call(this, k) ? this[k] : null; } });
  const saved = data !== undefined ? data : sidebarData(icons);
  if (saved !== null) session.sidebarData137558 = saved;
  const timers = [];
  let timerId = 0;
  // linkedom has no capture phase, so the document's capture listeners are kept here and run
  // first by fire(), as a browser runs them.
  const captures = {};
  const add = doc.addEventListener.bind(doc);
  doc.addEventListener = (type, fn, opts) => {
    if (!(opts === true || (opts && opts.capture))) return add(type, fn, opts);
    (captures[type] = captures[type] || []).push({ fn, passive: !!(opts && opts.passive) });
  };
  const w = {
    document: doc, Event: dom.Event, store, clock, captures, menu: {}, logs: [], checks: [], pollMs: null, reactSaw: [],
    window: {},
    row: () => doc.querySelector('#sidebar ul'),
    box: () => doc.getElementById(BOX),
    // Torn's icon in the row with this title, or ours by id.
    icon: (name) => [...w.row().children].find((el) => el.id === name || labelOf(el) === name),
    // Draws the page: Torn's header, the sidebar and the icons elsewhere.
    draw() {
      if (!doc.head) doc.documentElement.appendChild(doc.createElement('head'));
      if (!doc.body) doc.documentElement.appendChild(doc.createElement('body'));
      doc.body.innerHTML = HEADER + lay.html(rowHtml(icons)) + TRAY;
      doc.getElementById('sidebarroot').addEventListener('click', (e) => w.reactSaw.push(e));
      return w;
    },
    // New sidebar data; Torn redraws the row from it, in the same list.
    setIcons(next) {
      session.sidebarData137558 = sidebarData(next);
      w.row().innerHTML = rowHtml(next);
    },
    // Torn replacing the whole row (a phone turning past the breakpoint, say).
    replaceRow() {
      const old = w.row();
      const ul = doc.createElement('ul');
      ul.className = old.className;
      ul.innerHTML = old.innerHTML;
      old.parentNode.replaceChild(ul, old);
      return ul;
    },
    check() { w.checks.forEach((fn) => fn()); },
    advance(ms) {
      const until = clock.ms + ms;
      for (;;) {
        timers.sort((a, b) => a.at - b.at || a.id - b.id);
        if (!timers.length || timers[0].at > until) break;
        const t = timers.shift();
        clock.ms = Math.max(clock.ms, t.at);
        t.fn();
      }
      clock.ms = until;
    },
    run() {
      if (pda) w.window.flutter_inappwebview = { callHandler() {} };
      if (warboard) w.window.webkit = { messageHandlers: { gmBridge: { postMessage() {} } } };
      new Function('window', 'document', 'navigator', 'sessionStorage', 'GM_getValue', 'GM_setValue',
        'GM_registerMenuCommand', 'setInterval', 'setTimeout', 'clearTimeout', 'Date', 'Event', 'console', src)(
        w.window, doc, { userAgent: ua }, session,
        (k, d) => (Object.prototype.hasOwnProperty.call(store, k) ? store[k] : d),
        setValue ? (k, v) => setValue(store, k, v) : (k, v) => { store[k] = v; },
        menu ? (name, fn) => { if (menu === 'throws') throw new Error('no menu here'); w.menu[name] = fn; } : undefined,
        (fn, ms) => { w.checks.push(fn); w.pollMs = ms; return w.checks.length; },
        (fn, ms) => { timers.push({ id: ++timerId, at: clock.ms + (ms || 0), fn }); return timerId; },
        (id) => { const i = timers.findIndex((t) => t.id === id); if (i >= 0) timers.splice(i, 1); },
        { now: () => clock.ms },
        dom.Event,
        { log: (...a) => w.logs.push(a.join(' ')), warn: (...a) => w.logs.push(a.join(' ')), error: (...a) => w.logs.push(a.join(' ')) });
      return w;
    },
  };
  if (start) {
    // document-start: an <html> with nothing in it yet.
    doc.head.remove();
    doc.body.remove();
  } else {
    w.draw();
  }
  return w;
}

// Fires a DOM event at el, with extra fields (touches, button, relatedTarget, key, cancelable),
// and returns it, so a test can see whether the script cancelled or stopped it. The document's
// capture listeners run first, as in a browser: stopPropagation there keeps the event from the
// target and from React's root, and preventDefault does nothing in a passive listener.
function fire(w, el, type, fields = {}) {
  const e = new w.Event(type, { bubbles: true, cancelable: fields.cancelable !== false });
  Object.assign(e, fields);
  e.target = el;
  for (const listener of w.captures[type] || []) {
    if (listener.passive) e.preventDefault = () => {};
    listener.fn.call(w.document, e);
    delete e.preventDefault;
    if (e._stopImmediatePropagationFlag) break;
  }
  if (!e.cancelBubble) el.dispatchEvent(e);
  return e;
}

// A row icon's name: ours by id, Torn's by the title in its label.
function labelOf(el) {
  return el.id || el.querySelector('a').getAttribute('aria-label').split(':')[0];
}

// The selectors of the script's rules that hold this declaration (display: none, say).
function rulesWith(w, declaration) {
  const style = w.document.getElementById(STYLES);
  if (!style) return [];
  return style.textContent.split('}').filter((rule) => rule.includes(declaration)).map((rule) => rule.split('{')[0].trim());
}

// Every element on the page that a rule with this declaration applies to.
function matching(w, declaration) {
  return new Set(rulesWith(w, declaration).flatMap((selector) => [...w.document.querySelectorAll(selector)]));
}

// The names of the row's icons that show, in order.
function showing(w) {
  const gone = matching(w, 'display: none');
  return [...w.row().children].filter((el) => !gone.has(el)).map(labelOf);
}

// What the script has learned, as stored.
function kindsIn(store) {
  return JSON.parse(store['tih-kinds']);
}

// The settings box's lines: { name, on, pos } for each switch, and the group headings and
// other text in order.
function lines(w) {
  return [...w.box().querySelectorAll('label')].map((line) => ({
    name: line.textContent.trim(),
    on: line.querySelector('input').checked,
    pos: line.querySelector('.tm-tih-pic').getAttribute('style'),
  }));
}

// A button of the settings box, by its words.
function boxButton(w, words) {
  return [...w.box().querySelectorAll('button')].find((b) => b.textContent === words);
}

// The settings box's switch for this title.
function boxSwitch(w, name) {
  return [...w.box().querySelectorAll('label')].find((line) => line.textContent.trim() === name).querySelector('input');
}

// Counts writes to the stylesheet's text from now on.
function countWrites(w) {
  const style = w.document.getElementById(STYLES);
  let proto = style;
  let desc = null;
  while (proto && !desc) {
    desc = Object.getOwnPropertyDescriptor(proto, 'textContent');
    proto = Object.getPrototypeOf(proto);
  }
  const count = { n: 0 };
  Object.defineProperty(style, 'textContent', {
    configurable: true,
    get() { return desc.get.call(this); },
    set(v) { count.n += 1; desc.set.call(this, v); },
  });
  return count;
}

// ---------------------------------------------------------------------------------------------
// Hiding
// ---------------------------------------------------------------------------------------------

test('the header: the owner\'s script, served from tornwar.com, run at document-start, with its version in the file', () => {
  const src = readFileSync(SRC, 'utf8');
  const end = '// ==/UserScript==';
  const header = src.slice(0, src.indexOf(end) + end.length);
  const tag = (k) => [...header.matchAll(new RegExp('^// @' + k + '\\s+(.+)$', 'gm'))].map((m) => m[1].trim());
  assert.deepEqual(tag('name'), ['Torn Icon Hider']);
  assert.deepEqual(tag('namespace'), ['RussianRob']);
  assert.deepEqual(tag('author'), ['RussianRob']);
  assert.deepEqual(tag('version'), ['1.0.0']);
  assert.deepEqual(tag('license'), ['All Rights Reserved']);
  assert.deepEqual(tag('copyright'), []);
  assert.deepEqual(tag('match'), ['https://www.torn.com/*', 'https://torn.com/*']);
  assert.deepEqual(tag('run-at'), ['document-start']);
  assert.deepEqual(tag('grant'), ['GM_getValue', 'GM_setValue', 'GM_registerMenuCommand']);
  assert.deepEqual(tag('connect'), []);
  assert.deepEqual(tag('downloadURL'), ['https://tornwar.com/scripts/torn-icon-hider.user.js']);
  assert.deepEqual(tag('updateURL'), ['https://tornwar.com/scripts/torn-icon-hider.meta.js']);
  assert.equal(tag('description').length, 1);
  assert.equal(readFileSync(META, 'utf8'), header + '\n', 'the meta file is the header, byte for byte');
  assert.match(src, /const VERSION = '1\.0\.0';/, 'the in-file version matches @version');
  assert.match(src, /^\/\/ v1\.0\.0  - First release\./m, 'the changelog has the 1.0.0 entry');
});

test('the source is plain ASCII with no PDA key placeholder or password field, every GM_ call is guarded, and the console line carries the version', () => {
  const src = readFileSync(SRC, 'utf8');
  assert.equal(src.match(/[^\x00-\x7f]/g), null, 'plain ASCII, or PDA breaks it');
  assert.equal(src.includes('###' + 'PDA-APIKEY###'), false, 'no key, so no placeholder');
  assert.equal(/password/i.test(src), false, 'no password field');
  const code = src.slice(src.indexOf('// ==/UserScript=='));
  // Each call has its typeof check on its own line or the line before.
  const codeLines = code.split('\n');
  const calls = codeLines.map((l, i) => [l, i]).filter(([l]) => /\bGM_\w+\s*\(/.test(l));
  assert.ok(calls.length >= 2, 'the script uses GM storage');
  for (const [l, i] of calls) {
    const name = l.match(/\b(GM_\w+)\s*\(/)[1];
    const guard = 'typeof ' + name + ' === \'function\'';
    assert.ok(l.includes(guard) || codeLines[i - 1].includes(guard), 'guarded: ' + l.trim());
  }
  assert.deepEqual(page().run().logs, ['[Torn Icon Hider 1.0.0] running']);
});

for (const layout of Object.keys(LAYOUTS)) {
  test(`${layout}: a hidden kind's icon is hidden in the row, and nothing else on the page is`, () => {
    const w = page({ layout, store: hiding('maleGender', 'married') }).run();
    assert.deepEqual(showing(w), [BLOODBAG, XANAX, 'Subscriber', 'Faction', 'Reading Book', 'Drug Cooldown']);
    const hidden = [...matching(w, 'display: none')];
    assert.equal(hidden.length, 2, 'just the two icons in the row');
    assert.ok(hidden.every((el) => el.parentNode === w.row()), 'none in the header or the icons outside the sidebar');
  });
}

test('the rule for icon5 leaves icon52 alone, and the rule for icon52 leaves icon5 alone', () => {
  const icons = { level: { iconID: 'icon5', title: 'Level 100', subtitle: '', link: '#' },
    drug_cooldown: { iconID: 'icon52', title: 'Drug Cooldown', subtitle: 'Xanax', link: '#' } };
  assert.deepEqual(showing(page({ icons, store: hiding('level') }).run()), [BLOODBAG, XANAX, 'Drug Cooldown']);
  assert.deepEqual(showing(page({ icons, store: hiding('drug_cooldown') }).run()), [BLOODBAG, XANAX, 'Level 100']);
});

test('a class name with four underscores is matched too', () => {
  const w = page({ store: hiding('married') }).run();
  assert.equal(w.icon('Married').className, 'icon8____Cehh');
  assert.ok(matching(w, 'display: none').has(w.icon('Married')));
});

test('at document-start the stylesheet goes in <html>, before Torn draws anything, and hides the icon once it is drawn', () => {
  const w = page({ start: true, store: hiding('maleGender') }).run();
  const style = w.document.getElementById(STYLES);
  assert.equal(style.parentNode, w.document.documentElement, 'in <html>: there is no <head> yet');
  assert.ok(rulesWith(w, 'display: none').length > 0, 'the rule is there before the row');
  w.draw();
  assert.deepEqual(showing(w), [BLOODBAG, XANAX, 'Subscriber', 'Married', 'Faction', 'Reading Book', 'Drug Cooldown']);
});

test('loaded twice on one page, it runs once', () => {
  const w = page().run();
  w.run();
  assert.equal(w.document.querySelectorAll('#' + STYLES).length, 1);
  assert.equal(w.logs.length, 1);
});

test('the stylesheet is written only when the hidden numbers change', () => {
  const w = page({ store: hiding('maleGender') }).run();
  const writes = countWrites(w);
  w.check();
  w.check();
  assert.equal(writes.n, 0, 'nothing changed');
  w.store['tih-hidden'] = JSON.stringify(['maleGender', 'faction']);
  w.check();
  assert.equal(writes.n, 1);
  w.check();
  assert.equal(writes.n, 1);
});

test('a stylesheet taken out of the page is put back at the next check', () => {
  const w = page({ store: hiding('maleGender') }).run();
  w.document.getElementById(STYLES).remove();
  assert.equal(showing(w).includes('Male'), true, 'with the stylesheet gone, Male shows');
  w.check();
  assert.equal(w.document.querySelectorAll('#' + STYLES).length, 1);
  assert.equal(showing(w).includes('Male'), false);
});

test('each kind is learned with its title and picture number, and only the title is stored', () => {
  const w = page().run();
  const kinds = kindsIn(w.store);
  assert.deepEqual(Object.keys(kinds), Object.keys(ICONS));
  assert.deepEqual(kinds.maleGender, { title: 'Male', ids: [6] });
  assert.deepEqual(kinds.drug_cooldown, { title: 'Drug Cooldown', ids: [53] });
  for (const detail of ['Example Spouse', 'days left', 'Xanax', 'Example Faction', 'Example Book']) {
    assert.equal(w.store['tih-kinds'].includes(detail), false, detail);
  }
});

test('a title is kept as the icon\'s label reads it: HTML dropped, entities read; no title gives the key', () => {
  const icons = { odd: { iconID: 'icon9', title: '<b>Bold</b> &amp; <i>more</i>&nbsp;here', link: '#' },
    blank: { iconID: 'icon27', title: '', link: '#' } };
  const kinds = kindsIn(page({ icons }).run().store);
  assert.equal(kinds.odd.title, 'Bold & more here');
  assert.equal(kinds.blank.title, 'blank');
});

test('an entry with no picture number is skipped, as the script couldn\'t hide it', () => {
  const icons = { a: { title: 'A' }, b: { iconID: 'icon', title: 'B' }, c: { iconID: 'iconX', title: 'C' },
    d: { iconID: 'icon6x', title: 'D' }, e: null, f: 'text', maleGender: ICONS.maleGender };
  assert.deepEqual(Object.keys(kindsIn(page({ icons }).run().store)), ['maleGender']);
});

test('a picture number belongs to the kind it was last seen with, and a kind left with none is dropped', () => {
  const store = { 'tih-kinds': JSON.stringify({ old_faction: { title: 'Faction', ids: [74] }, company: { title: 'Company', ids: [27] } }) };
  const kinds = kindsIn(page({ store }).run().store);
  assert.deepEqual(kinds.faction, { title: 'Faction', ids: [74] });
  assert.equal(kinds.old_faction, undefined, 'its only number moved to faction');
  assert.deepEqual(kinds.company, { title: 'Company', ids: [27] }, 'seen before, kept');
});

test('a hidden cooldown\'s next level is hidden before it is ever seen', () => {
  const w = page({ store: hiding('drug_cooldown') }).run();
  assert.equal(showing(w).includes('Drug Cooldown'), false);
  w.setIcons(Object.assign({}, ICONS, { drug_cooldown: Object.assign({}, ICONS.drug_cooldown, { iconID: 'icon52' }) }));
  assert.equal(showing(w).includes('Drug Cooldown'), false, 'icon52, with no check since');
  w.setIcons(Object.assign({}, ICONS, { drug_cooldown: Object.assign({}, ICONS.drug_cooldown, { iconID: 'icon49' }) }));
  assert.equal(showing(w).includes('Drug Cooldown'), false, 'icon49 too');
});

test('another hidden kind\'s new picture number shows until the next check, then stays hidden', () => {
  const w = page({ store: hiding('faction') }).run();
  assert.equal(showing(w).includes('Faction'), false);
  w.setIcons(Object.assign({}, ICONS, { faction: Object.assign({}, ICONS.faction, { iconID: 'icon81' }) }));
  assert.equal(showing(w).includes('Faction'), true, 'a new role: not known yet');
  w.check();
  assert.equal(showing(w).includes('Faction'), false, 'learned at the next check');
  assert.deepEqual(kindsIn(w.store).faction.ids, [74, 81]);
});

test('a kind that is switched on is never hidden by another kind\'s level range', () => {
  const store = Object.assign({ 'tih-kinds': JSON.stringify({ odd: { title: 'Odd', ids: [50] } }) }, hiding('drug_cooldown'));
  const w = page({ store }).run();
  const rules = rulesWith(w, 'display: none').join(' ');
  for (const n of [49, 51, 52, 53]) assert.ok(rules.includes('icon' + n + '___'), 'icon' + n);
  assert.equal(rules.includes('icon50___'), false, 'icon50 belongs to Odd, which shows');
});

test('a save in another tab reaches this one at its next check', () => {
  const store = {};
  const a = page({ store }).run();
  const b = page({ store }).run();
  b.store['tih-hidden'] = JSON.stringify(['maleGender']);
  assert.equal(showing(a).includes('Male'), true);
  a.check();
  assert.equal(showing(a).includes('Male'), false);
});

test('with no sidebar data, hidden icons stay hidden and nothing new is learned', () => {
  const kinds = JSON.stringify({ maleGender: { title: 'Male', ids: [6] } });
  const w = page({ data: null, store: Object.assign({ 'tih-kinds': kinds }, hiding('maleGender')) }).run();
  assert.equal(showing(w).includes('Male'), false);
  assert.equal(w.store['tih-kinds'], kinds);
});

test('stored values that come back as objects still work', () => {
  const store = { 'tih-kinds': { maleGender: { title: 'Male', ids: [6] } }, 'tih-hidden': ['maleGender'] };
  assert.equal(showing(page({ store }).run()).includes('Male'), false);
});

test('stored values that won\'t parse read as nothing saved: every icon shows', () => {
  const w = page({ store: { 'tih-kinds': '{oops', 'tih-hidden': 'not json' } }).run();
  assert.deepEqual(showing(w), [BLOODBAG, XANAX].concat(TITLES));
  assert.deepEqual(Object.keys(kindsIn(w.store)), Object.keys(ICONS), 'learned afresh');
});

test('the Xanax and Blood Bag icons are never learned or hidden', () => {
  const w = page({ store: hiding(...Object.keys(ICONS)) }).run();
  assert.deepEqual(showing(w), [BLOODBAG, XANAX]);
  assert.equal(Object.keys(kindsIn(w.store)).some((k) => /xanax|blood/i.test(k)), false);
});
```

- [ ] **Step 2: Run them to see them fail.** Run `T`.

Expected: `# tests 24 # pass 0 # fail 24`. Every test fails with ENOENT, because the script doesn't exist yet.

- [ ] **Step 3: Write the script.** Create `server/public/scripts/torn-icon-hider.user.js`:

```js
// ==UserScript==
// @name         Torn Icon Hider
// @namespace    RussianRob
// @version      1.0.0
// @description  Choose which of Torn's status icons show in your sidebar row: a long press on any of them, or the menu, opens a list of every icon seen there, and one you untick stays hidden until you tick it again.
// @author       RussianRob
// @downloadURL  https://tornwar.com/scripts/torn-icon-hider.user.js
// @updateURL    https://tornwar.com/scripts/torn-icon-hider.meta.js
// @license      All Rights Reserved
// @match        https://www.torn.com/*
// @match        https://torn.com/*
// @run-at       document-start
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// ==/UserScript==

// =============================================================================
// CHANGELOG
// =============================================================================
// v1.0.0  - First release. Choose which of Torn's status icons show in your sidebar
//           row. A long press on any of them, or "Icon Hider: Settings" in the menu,
//           opens a list of every icon seen in your row: untick one to hide it.

(function () {
  'use strict';

  const VERSION = '1.0.0';

  // Loaded twice on one page (two copies installed, or PDA injecting it again), it runs once.
  // The mark goes on the page itself, which every copy can see; each copy may have its own window.
  const root = document.documentElement;
  if (root.hasAttribute('data-tm-icon-hider')) return;
  root.setAttribute('data-tm-icon-hider', VERSION);

  const STYLE_ID = 'tm-icon-hider-styles';
  // The row of status icons. Torn's old sidebar calls it status-icons___ and the Fly-out
  // Sidebar statusIcons___. Only inside #sidebar: other parts of a page (faction member lists,
  // profiles) draw icons with the same classes, and those are left alone.
  const ROWS = ['#sidebar ul[class*="status-icons"]', '#sidebar ul[class*="statusIcons___"]'];
  const POLL_MS = 2000;
  // GM storage: what the script has learned about each kind of icon, and which kinds are hidden.
  // Two values, so a tab learning a new icon can't undo a save made in another tab.
  const KINDS_STORE = 'tih-kinds';
  const HIDDEN_STORE = 'tih-hidden';
  // Picture numbers Torn gives the levels of one kind: booster cooldown, medical cooldown, drug
  // cooldown, drug addiction, radiation and upkeep (from TornTools' list of Torn's icons). When
  // a hidden kind has a number in one of these, the whole range is hidden, so a new level never
  // shows.
  const LEVELS = [[39, 43], [44, 48], [49, 53], [57, 61], [63, 67], [78, 80]];

  // ===== GM STORAGE =====

  // Every GM_* call is guarded, because hosts differ in what they give a script.
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

  // A stored value, read from its JSON. PDA hands values back as strings; a host that hands back
  // the object itself works too. null when nothing is saved, or the value won't parse.
  function readJson(name) {
    const raw = gmGet(name);
    if (raw && typeof raw === 'object') return raw;
    try {
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  // True when obj has its own key: Torn's keys and stored keys are plain words, but a word like
  // "constructor" must never read as something every object has.
  function own(obj, key) {
    return Object.prototype.hasOwnProperty.call(obj, key);
  }

  // ===== TORN'S SIDEBAR DATA =====

  // statusIcons.icons from the data both of Torn's sidebars save to sessionStorage on every
  // change: one entry per icon in the row, in the row's order. null when the data isn't there,
  // won't parse or has no icons (some pages have no sidebar).
  function readIcons() {
    try {
      const key = Object.keys(sessionStorage).find((k) => /^sidebarData\d+$/.test(k));
      if (!key) return null;
      const data = JSON.parse(sessionStorage.getItem(key));
      const icons = data && data.statusIcons && data.statusIcons.icons;
      return icons && typeof icons === 'object' ? icons : null;
    } catch (e) {
      return null;
    }
  }

  // The picture number of one of Torn's entries ("icon52" is 52), or 0 for an entry the script
  // can't hide. Torn draws the icon with the class named for that number.
  function iconNumber(entry) {
    const m = entry && typeof entry === 'object' ? /^icon(\d+)$/.exec(String(entry.iconID || '')) : null;
    return m ? Number(m[1]) : 0;
  }

  // A title as the icon's label reads it: Torn's label is the title's text, without any HTML.
  function plainTitle(value) {
    return String(value == null ? '' : value)
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, '\'')
      .replace(/&amp;/g, '&')
      .replace(/\s+/g, ' ')
      .trim();
  }

  // ===== KINDS OF ICON =====

  // What the script has learned: { key: { title, ids } } for each kind of icon seen in the row,
  // where ids are the picture numbers seen with it, the last one learned last. Anything stored
  // that doesn't read as that is left out.
  function readKinds() {
    const data = readJson(KINDS_STORE);
    const kinds = {};
    if (!data || typeof data !== 'object' || Array.isArray(data)) return kinds;
    Object.keys(data).forEach((key) => {
      const kind = data[key];
      if (!kind || typeof kind !== 'object' || !Array.isArray(kind.ids)) return;
      const ids = kind.ids.map(Number).filter((n, i, all) => Number.isInteger(n) && n > 0 && all.indexOf(n) === i);
      if (!ids.length) return;
      kinds[key] = { title: typeof kind.title === 'string' && kind.title ? kind.title : key, ids };
    });
    return kinds;
  }

  // The keys of the hidden kinds.
  function readHidden() {
    const data = readJson(HIDDEN_STORE);
    return Array.isArray(data) ? data.filter((key) => typeof key === 'string') : [];
  }

  // Learns the kinds of icon in Torn's data: a new kind, a new picture number or a new title.
  // A picture number belongs to the kind it was last seen with, so it leaves any other kind, and
  // a kind left with none is dropped. Only titles are kept, never the details after them (a
  // timer, a name). True when anything changed.
  function learn(kinds, icons) {
    let changed = false;
    Object.keys(icons).forEach((key) => {
      const n = iconNumber(icons[key]);
      if (!n) return;
      Object.keys(kinds).forEach((other) => {
        const at = other === key ? -1 : kinds[other].ids.indexOf(n);
        if (at < 0) return;
        kinds[other].ids.splice(at, 1);
        if (!kinds[other].ids.length) delete kinds[other];
        changed = true;
      });
      const title = plainTitle(icons[key].title) || key;
      if (!own(kinds, key)) {
        kinds[key] = { title, ids: [n] };
        changed = true;
        return;
      }
      if (kinds[key].title !== title) {
        kinds[key].title = title;
        changed = true;
      }
      if (kinds[key].ids.indexOf(n) < 0) {
        kinds[key].ids.push(n);
        changed = true;
      }
    });
    return changed;
  }

  // The kinds as stored, with anything new in Torn's data learned and saved.
  function learned() {
    const kinds = readKinds();
    const icons = readIcons();
    if (icons && learn(kinds, icons)) gmSet(KINDS_STORE, JSON.stringify(kinds));
    return kinds;
  }

  // The picture numbers to hide: every number of every hidden kind, and the whole level range of
  // any of them that is in one. A kind that is switched on is never hidden by another kind's
  // numbers.
  function hiddenNumbers(kinds, hidden) {
    const shown = {};
    Object.keys(kinds).forEach((key) => {
      if (hidden.indexOf(key) < 0) kinds[key].ids.forEach((n) => { shown[n] = true; });
    });
    const out = {};
    hidden.forEach((key) => {
      if (!own(kinds, key)) return;
      kinds[key].ids.forEach((n) => {
        out[n] = true;
        LEVELS.forEach((range) => {
          if (n < range[0] || n > range[1]) return;
          for (let m = range[0]; m <= range[1]; m += 1) if (!shown[m]) out[m] = true;
        });
      });
    });
    return Object.keys(out).map(Number).sort((a, b) => a - b);
  }

  // ===== THE STYLESHEET =====

  // One rule per hidden picture number, for Torn's icon with that number in the row. The ___
  // after the number keeps icon5 from matching icon52; some of Torn's class names have four
  // underscores (icon52____l66f), and those match too.
  function hideRule(n) {
    return ROWS.map((row) => row + ' > li[class*="icon' + n + '___"]').join(', ') + ' { display: none !important; }';
  }

  // The whole stylesheet for these hidden numbers.
  function cssText(numbers) {
    return numbers.map(hideRule).join('\n');
  }

  // Puts the stylesheet in the page, or back in it if something took it out, and brings it up
  // to date. At document-start there is no <head> yet, so it goes in <html>. Its text is written
  // only when it changes.
  function applyStyles(numbers) {
    const css = cssText(numbers);
    let style = document.getElementById(STYLE_ID);
    if (!style) {
      style = document.createElement('style');
      style.id = STYLE_ID;
      (document.head || root).appendChild(style);
    }
    if (style.textContent === css) return;
    style.textContent = css;
  }

  // ===== THE CHECK =====

  // At start, then every 2 seconds: learns what is new in Torn's data, and brings the stylesheet
  // up to date with what is saved, so a save in another tab reaches this one too.
  function check() {
    try {
      applyStyles(hiddenNumbers(learned(), readHidden()));
    } catch (e) {
      // A bad value stops this one check. It never reaches Torn's page.
    }
  }

  // ===== START =====

  // At document-start, before Torn draws anything, so a hidden icon doesn't flash on a page load.
  check();
  setInterval(check, POLL_MS);
  console.log('[Torn Icon Hider ' + VERSION + '] running');
})();
```

- [ ] **Step 4: Write the meta file:** the header, byte for byte, then a newline.

```bash
WT=/opt/warboard/.superpowers/sdd/2026-10-24-torn-icon-hider/wt; cd "$WT/server/public/scripts" && sed -n '1,/^\/\/ ==\/UserScript==$/p' torn-icon-hider.user.js > torn-icon-hider.meta.js && chmod 644 torn-icon-hider.user.js torn-icon-hider.meta.js && wc -l torn-icon-hider.meta.js
```

Expected: `16 torn-icon-hider.meta.js`.

- [ ] **Step 5: Run the tests to see them pass.** Run `T`, then `C`.

Expected: `# tests 24 # pass 24 # fail 0`, then `ascii-ok`.

- [ ] **Step 6: Commit.**

```bash
WT=/opt/warboard/.superpowers/sdd/2026-10-24-torn-icon-hider/wt; cd "$WT" && git add -- server/public/scripts/torn-icon-hider.user.js server/public/scripts/torn-icon-hider.meta.js server/torn-icon-hider.test.mjs && git commit -q -m "torn-icon-hider: a new script that hides the status icons you choose in Torn's sidebar row" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- server/public/scripts/torn-icon-hider.user.js server/public/scripts/torn-icon-hider.meta.js server/torn-icon-hider.test.mjs && git log --format='%h %s' -1 && git status --short
```

Expected: the commit, then only `?? server/node_modules`.

---

### Task 2: Room

**Files:**
- Modify: `server/public/scripts/torn-icon-hider.user.js`
- Modify (tests): `server/torn-icon-hider.test.mjs`
- Outside the repo: `/opt/warboard/.superpowers/sdd/2026-10-24-torn-icon-hider/probe-room.mjs` (already there from plan time)

**Interfaces:**
- Consumes (Task 1): `ROWS`, `LEVELS`, `hideRule(n)`, `cssText(numbers)`, `applyStyles(numbers)`; in the tests, `page`, `matching`, `rulesWith`, `showing`, `hiding`, `DESKTOPS`, `PHONES`.
- Produces:
  - `ROW_SELECTOR`, the two rows as one selector (Tasks 3 and 4 find the row with it);
  - `DESKTOP_ROWS`, `SPACING_CSS`, `nudgeStrip()`;
  - `cssText` now starts from `const rules = [];`, which Tasks 3 and 4 fill with `BOX_CSS` and `CALLOUT_CSS`.

- [ ] **Step 1: Write the failing tests.** Add at the end of `server/torn-icon-hider.test.mjs`, after a blank line:

```js
// ---------------------------------------------------------------------------------------------
// Room
// ---------------------------------------------------------------------------------------------

for (const layout of DESKTOPS) {
  test(`${layout}: with an icon hidden, the row is spaced by a 10 px gap with no margins, and only this row`, () => {
    const w = page({ layout, store: hiding('married') }).run();
    const rows = matching(w, 'column-gap: 10px');
    assert.deepEqual([...rows], [w.row()], 'the desktop row, nothing else');
    assert.ok(rulesWith(w, 'flex-wrap: wrap').length > 0);
    const noMargin = matching(w, 'margin-right: 0');
    assert.ok([...w.row().children].every((el) => noMargin.has(el)), 'every icon in it, ours too');
    assert.equal([...noMargin].some((el) => el.parentNode !== w.row()), false);
  });
}

for (const layout of PHONES) {
  test(`${layout}: the phone strip keeps Torn's own spacing`, () => {
    const w = page({ layout, store: hiding('married') }).run();
    assert.equal(matching(w, 'column-gap: 10px').size, 0);
    assert.equal(matching(w, 'margin-right: 0').size, 0);
  });
}

test('with nothing hidden, Torn\'s spacing is left alone on desktop too', () => {
  const w = page({ layout: 'Fly-out, desktop' }).run();
  assert.equal(rulesWith(w, 'column-gap').length, 0);
});

test('after the stylesheet changes, the phone strip gets a scroll event, so Torn redraws its fade; not when nothing changed', () => {
  const w = page({ store: hiding('maleGender') });
  const strip = w.row().parentNode;
  let scrolls = 0;
  strip.addEventListener('scroll', () => { scrolls += 1; });
  w.run();
  assert.equal(scrolls, 1, 'the first stylesheet');
  w.check();
  assert.equal(scrolls, 1, 'nothing changed');
  w.store['tih-hidden'] = JSON.stringify(['maleGender', 'book']);
  w.check();
  assert.equal(scrolls, 2);
});

test('at document-start the first stylesheet, with no row yet, sends nothing and breaks nothing; a change once the row is drawn sends one', () => {
  const w = page({ start: true, store: hiding('maleGender') }).run();
  w.draw();
  let scrolls = 0;
  w.row().parentNode.addEventListener('scroll', () => { scrolls += 1; });
  w.check();
  assert.equal(scrolls, 0);
  assert.equal(showing(w).includes('Male'), false);
  w.store['tih-hidden'] = JSON.stringify(['maleGender', 'book']);
  w.check();
  assert.equal(scrolls, 1);
});
```

- [ ] **Step 2: Run them to see them fail.** Run `T`.

Expected: `# tests 31 # pass 27 # fail 4`.
- The four that fail: the two "<desktop layout>: with an icon hidden, the row is spaced by a 10 px gap with no margins, and only this row", "after the stylesheet changes, the phone strip gets a scroll event, so Torn redraws its fade; not when nothing changed", and "at document-start the first stylesheet, with no row yet, sends nothing and breaks nothing; a change once the row is drawn sends one".
- The three new ones that pass already are guards: the two "<phone layout>: the phone strip keeps Torn's own spacing" (mutant M12 fails them) and "with nothing hidden, Torn's spacing is left alone on desktop too" (M11).

- [ ] **Step 3: Run the layout proof on the script as Task 1 left it.** `probe-room.mjs` is in the workspace from plan time (Setup checked its hash). If it must be written again, this is it:

```js
// Layout proof for the Torn Icon Hider, outside the repo: runs the script in headless Chromium on
// copies of Torn's row inside Torn's own sidebar stylesheets (Fly-out and old, saved 2026-10-21),
// with 3 of Torn's 13 icons hidden, with and without the Xanax and Blood Bag icons in the row, and
// measures where the icons that show end up. Every request is answered locally or aborted.
// Usage: node probe-room.mjs <script> <dir holding sidebar-flyout.css, sidebar-old.css, sprite.svg>
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from '/root/.npm/_npx/86170c4cd1c5da32/node_modules/playwright-core/index.mjs';

const [script, dir] = process.argv.slice(2);
const SRC = readFileSync(script, 'utf8');
const CSS = { fly: readFileSync(join(dir, 'sidebar-flyout.css'), 'utf8'), old: readFileSync(join(dir, 'sidebar-old.css'), 'utf8') };
const SPRITE = readFileSync(join(dir, 'sprite.svg'));
// The 13 icons of a saved Fly-out row, in order, with each build's class names.
const IDS = [27, 74, 29, 35, 38, 32, 52, 57, 85, 5, 6, 4, 8];
const CLASS = {
  fly: { 4: 'icon4___y6P08', 5: 'icon5___L_2pk', 6: 'icon6___R1xkN', 8: 'icon8____Cehh', 27: 'icon27___AH_kQ', 29: 'icon29___vVeyq', 32: 'icon32___GUecf',
    35: 'icon35___HePiD', 38: 'icon38___GDDkw', 52: 'icon52____l66f', 57: 'icon57___D8csm', 74: 'icon74___Sgygm', 85: 'icon85___CyVUf' },
  old: { 4: 'icon4___AaDeJ', 5: 'icon5___dEHuC', 6: 'icon6___rVWN7', 8: 'icon8___QjLhg', 27: 'icon27___XQYNI', 29: 'icon29___wcmqa', 32: 'icon32___dp2Cf',
    35: 'icon35___HDTbA', 38: 'icon38___ltEU1', 52: 'icon52___rwwcC', 57: 'icon57___Ig3dJ', 74: 'icon74___OLE9U', 85: 'icon85___yu0le' },
};
// Hidden: the 3rd and 6th of Torn's icons (the 6th is the one Torn's nth-child(6n) rule takes
// the margin off) and the 9th.
const HIDE = [29, 32, 85];
// The Xanax and Blood Bag icons as their scripts draw them, first in the row, with the rules of
// theirs that change the layout: the row may grow, and the Xanax pill spills past its 17 px slot.
const OURS = '<li id="tm-full-life-bloodbag" style="background: none;"><a href="#"><img src="data:," width="17" height="17" style="display:block"></a></li>'
  + '<li id="tm-xanax-reminder"><a href="#"><img src="data:," width="17" height="17"></a></li>';
const OURS_CSS = '#sidebar ul[class*="status-icons"], #sidebar ul[class*="statusIcons___"] { height: auto !important; overflow: visible !important; }'
  + ' #tm-xanax-reminder, #tm-full-life-bloodbag { background: none !important; }'
  + ' #tm-xanax-reminder a { display: block; width: 17px; height: 17px; }'
  + ' #tm-xanax-reminder img { display: block; width: 26px; height: 17px; margin-left: -4.5px; max-width: none; object-fit: contain; }';
const lis = (build, ours) => (ours ? OURS : '') + IDS.map((n) => `<li class="${CLASS[build][n]}"><a href="#" aria-label="icon${n}" tabindex="0"></a></li>`).join('');
const LAYOUTS = {
  'Fly-out, desktop': { build: 'fly', width: 1280, html: (l) => `<div id="sidebarroot"><div id="sidebar" class="sidebar___c4dEc desktop___F2V9S" style="width:172px"><div class="userInformation___Tkqft"><div><ul class="statusIcons___ks48M big___O1UVc">${l}</ul><hr class="delimiter___nLMP8"></div></div></div></div>` },
  'old sidebar, desktop': { build: 'old', width: 1280, html: (l) => `<div id="sidebarroot"><div id="sidebar" class="sidebar___V9DPj" style="width:172px"><div class="user-information___LZ_gM"><div class="content___Ueeif"><div><ul class="status-icons___sskG2 big___IeUkB">${l}</ul><hr class="delimiter___i8yeL"></div></div></div></div></div>` },
  'Fly-out, phone': { build: 'fly', width: 393, html: (l) => `<div id="sidebarroot"><div id="sidebar" class="sidebar___c4dEc mobile___fSMgm"><div class="userInformationMobile___Aznrv"><div class="swiperWrapper___gaWYk"><div class="points-mobile___Zx867" style="flex:none;width:150px">$1.0M 1000</div><ul class="statusIcons___ks48M big___O1UVc mobile___IzEv7">${l}</ul></div></div></div></div>` },
  'old sidebar, phone': { build: 'old', width: 393, html: (l) => `<div id="sidebarroot"><div id="sidebar" class="sidebar___V9DPj"><div class="user-information-mobile___I1ebJ"><div class="swiperWrapper____QQNn"><div class="points-mobile___FGMxg" style="flex:none;width:150px">$1.0M 1000</div><ul class="status-icons___sskG2 mobile___YGGsN big___IeUkB">${l}</ul></div></div></div></div>` },
};

// GM storage and Torn's sidebar data, set up before the script runs.
function setup({ hide, ids }) {
  const store = { 'tih-hidden': JSON.stringify(hide.map((n) => 'k' + n)) };
  window.GM_getValue = (k, d) => (k in store ? store[k] : d);
  window.GM_setValue = (k, v) => { store[k] = v; };
  const icons = {};
  ids.forEach((n) => { icons['k' + n] = { iconID: 'icon' + n, title: 'Icon ' + n }; });
  sessionStorage.setItem('sidebarData137558', JSON.stringify({ statusIcons: { icons } }));
  // Scroll events the script sends, by the class of the element they were sent to. A scroll
  // event doesn't bubble, but the document sees it on the way down.
  window.scrollsSeen = [];
  document.addEventListener('scroll', (e) => { if (e.target && e.target.className) window.scrollsSeen.push(String(e.target.className)); }, true);
}

const browser = await chromium.launch();
const out = {};
const errors = [];
try {
  const page = await (await browser.newContext()).newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  let body = '';
  await page.route('**/*', (route) => {
    const url = route.request().url();
    if (url === 'https://www.torn.com/probe') return route.fulfill({ status: 200, contentType: 'text/html', body });
    if (url.endsWith('/user_status_icons_sprite.svg')) return route.fulfill({ status: 200, contentType: 'image/svg+xml', body: SPRITE });
    return route.abort();
  });
  await page.addInitScript(setup, { hide: HIDE, ids: IDS });
  // A host runs a document-start script once the page has its <html> element and before the
  // rest of the page. Playwright runs init scripts earlier still, so this one waits for <html>.
  await page.addInitScript((src) => {
    const run = () => Function(src)();
    if (document.documentElement) run();
    else new MutationObserver((_, watch) => { if (!document.documentElement) return; watch.disconnect(); run(); }).observe(document, { childList: true });
  }, SRC);
  for (const [name, lay] of Object.entries(LAYOUTS)) {
    for (const ours of [true, false]) {
      await page.setViewportSize({ width: lay.width, height: 700 });
      body = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>${CSS[lay.build]}</style>`
        + (ours ? `<style>${OURS_CSS}</style>` : '')
        + `<style>body{margin:0;font:12px Arial}</style></head><body class="d body r regular with-sidebar">${lay.html(lis(lay.build, ours))}</body></html>`;
      await page.goto('https://www.torn.com/probe');
      await page.waitForTimeout(150);
      const r = await page.evaluate(() => {
        const ul = document.querySelector('#sidebar ul');
        const box = ul.getBoundingClientRect();
        const shown = [...ul.children].map((li) => li.getBoundingClientRect()).filter((b) => b.width > 0);
        const rows = {};
        shown.forEach((b) => { const top = Math.round(b.top - box.top); (rows[top] = rows[top] || []).push(Math.round(b.left - box.left)); });
        return { shown: shown.length, hidden: ul.children.length - shown.length, tops: Object.keys(rows).map(Number), lines: Object.values(rows),
          nudged: window.scrollsSeen.some((c) => c.includes('swiperWrapper')) };
      });
      out[name + (ours ? ', with the Xanax and Blood Bag icons' : ', Torn\'s icons only')] = Object.assign(r, { desktop: name.endsWith('desktop'), expected: (ours ? 15 : 13) - HIDE.length });
    }
  }
} finally {
  await browser.close();
}
// Desktop: 6 a line at 0, 27, ... 135 px, lines 27 px apart. Phone: one line, 27 px apart, and
// a scroll event sent to the strip, so Torn works out its fade again.
let failed = 0;
for (const [name, r] of Object.entries(out)) {
  const wrong = [];
  if (r.shown !== r.expected || r.hidden !== HIDE.length) wrong.push(r.shown + ' showing and ' + r.hidden + ' hidden, not ' + r.expected + ' and ' + HIDE.length);
  if (!r.lines.every((line) => line.every((x, i) => i === 0 || x - line[i - 1] === 27))) wrong.push('icons not 27 px apart');
  if (r.desktop) {
    if (!r.lines.every((line, i) => line[0] === 0 && (i === r.lines.length - 1 ? line.length <= 6 : line.length === 6))) wrong.push('lines not 6 icons from the left');
    if (!r.tops.every((t, i) => t === i * 27)) wrong.push('lines not 27 px apart');
  } else {
    if (r.lines.length !== 1) wrong.push(r.lines.length + ' lines, not 1');
    if (!r.nudged) wrong.push('no scroll sent to the strip');
  }
  if (wrong.length) failed += 1;
  console.log(`${name}: lines ${r.lines.map((l) => l.length).join('/')}: ` + (wrong.length ? 'FAIL (' + wrong.join('; ') + ') ' + JSON.stringify(r.lines) : 'ok'));
}
if (errors.length) console.log('page errors: ' + JSON.stringify(errors));
console.log(failed || errors.length ? failed + ' of 8 FAIL' : 'all 8 ok');
process.exitCode = failed || errors.length ? 1 : 0;
```

Run `P`.

Expected:

```
Fly-out, desktop, with the Xanax and Blood Bag icons: lines 6/6: FAIL (icons not 27 px apart) [[0,27,54,81,108,125],[0,27,54,71,98,125]]
Fly-out, desktop, Torn's icons only: lines 5/5: FAIL (icons not 27 px apart; lines not 6 icons from the left) [[0,27,54,81,108],[0,27,54,81,98]]
old sidebar, desktop, with the Xanax and Blood Bag icons: lines 6/6: FAIL (icons not 27 px apart) [[0,27,54,81,108,125],[0,27,54,71,98,125]]
old sidebar, desktop, Torn's icons only: lines 5/5: FAIL (icons not 27 px apart; lines not 6 icons from the left) [[0,27,54,81,108],[0,27,54,81,98]]
Fly-out, phone, with the Xanax and Blood Bag icons: lines 12: FAIL (no scroll sent to the strip) [[5,32,59,86,113,140,167,194,221,248,275,302]]
Fly-out, phone, Torn's icons only: lines 10: FAIL (no scroll sent to the strip) [[5,32,59,86,113,140,167,194,221,248]]
old sidebar, phone, with the Xanax and Blood Bag icons: lines 12: FAIL (no scroll sent to the strip) [[5,32,59,86,113,140,167,194,221,248,275,302]]
old sidebar, phone, Torn's icons only: lines 10: FAIL (no scroll sent to the strip) [[5,32,59,86,113,140,167,194,221,248]]
8 of 8 FAIL
exit 1
```

- [ ] **Step 4: Edit the script.** In `server/public/scripts/torn-icon-hider.user.js`, five edits, in this order:

**Edit 2.1: The two rows as one selector, for the nudge (and for Tasks 3 and 4).** Replace:

```js
  const ROWS = ['#sidebar ul[class*="status-icons"]', '#sidebar ul[class*="statusIcons___"]'];
```

With:

```js
  const ROWS = ['#sidebar ul[class*="status-icons"]', '#sidebar ul[class*="statusIcons___"]'];
  const ROW_SELECTOR = ROWS.join(', ');
```

**Edit 2.2: The desktop row.** Replace:

```js
  const LEVELS = [[39, 43], [44, 48], [49, 53], [57, 61], [63, 67], [78, 80]];
```

With:

```js
  const LEVELS = [[39, 43], [44, 48], [49, 53], [57, 61], [63, 67], [78, 80]];
  // The desktop row: Torn's big icons, 6 a line, not the phone strip.
  const DESKTOP_ROWS = ROWS.map((row) => row + '[class*="big___"]:not([class*="mobile___"])');
```

**Edit 2.3: The spacing rule, at the top of the stylesheet section.** Replace:

```js
  // ===== THE STYLESHEET =====
```

With:

```js
  // ===== THE STYLESHEET =====

  // Torn spaces the desktop row with a 10 px right margin on every icon but each 6th
  // (li:nth-child(6n)). A hidden icon still counts in that 6th, so lines would come out uneven.
  // While something is hidden, the row is a wrapping flex row with a 10 px gap and no margins
  // instead: 6 x 17 px and 5 x 10 px fill its 152 px exactly, as Torn's lines do.
  const SPACING_CSS = [
    DESKTOP_ROWS.join(', ') + ' { display: flex !important; flex-wrap: wrap !important; column-gap: 10px !important; row-gap: 0 !important; }',
    DESKTOP_ROWS.map((row) => row + ' > li').join(', ') + ' { flex: none !important; margin-right: 0 !important; }',
  ].join('\n');
```

**Edit 2.4: The spacing rule goes in the stylesheet only while something is hidden.** Replace:

```js
  function cssText(numbers) {
    return numbers.map(hideRule).join('\n');
  }
```

With:

```js
  function cssText(numbers) {
    const rules = [];
    if (numbers.length) rules.push(SPACING_CSS);
    return rules.concat(numbers.map(hideRule)).join('\n');
  }
```

**Edit 2.5: After the stylesheet changes, the nudge.** Replace:

```js
    style.textContent = css;
  }
```

With:

```js
    style.textContent = css;
    nudgeStrip();
  }

  // Torn works out the fade at the phone strip's right edge (meaning "more to scroll") only on
  // load, on a resize and on a scroll, so it would stay after icons are hidden. Both sidebars
  // listen for scroll on the strip itself, so one sent there makes them work it out again.
  function nudgeStrip() {
    const row = document.querySelector(ROW_SELECTOR);
    if (row && row.parentElement) row.parentElement.dispatchEvent(new Event('scroll'));
  }
```

- [ ] **Step 5: Run the tests, the source check and the layout proof.** Run `T`, `C`, then `P`.

Expected: `# tests 31 # pass 31 # fail 0`, `ascii-ok`, then:

```
Fly-out, desktop, with the Xanax and Blood Bag icons: lines 6/6: ok
Fly-out, desktop, Torn's icons only: lines 6/4: ok
old sidebar, desktop, with the Xanax and Blood Bag icons: lines 6/6: ok
old sidebar, desktop, Torn's icons only: lines 6/4: ok
Fly-out, phone, with the Xanax and Blood Bag icons: lines 12: ok
Fly-out, phone, Torn's icons only: lines 10: ok
old sidebar, phone, with the Xanax and Blood Bag icons: lines 12: ok
old sidebar, phone, Torn's icons only: lines 10: ok
all 8 ok
exit 0
```

Add the proof's last line, with its 8 lines, to the ledger.

- [ ] **Step 6: Commit.**

```bash
WT=/opt/warboard/.superpowers/sdd/2026-10-24-torn-icon-hider/wt; cd "$WT" && git commit -q -m "torn-icon-hider: even desktop lines while icons are hidden, and the phone strip's fade worked out again" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- server/public/scripts/torn-icon-hider.user.js server/torn-icon-hider.test.mjs && git log --format='%h %s' -1 && git status --short
```

Expected: the commit, then only `?? server/node_modules`.

---

### Task 3: The settings box

**Files:**
- Modify: `server/public/scripts/torn-icon-hider.user.js`
- Modify (tests): `server/torn-icon-hider.test.mjs`

**Interfaces:**
- Consumes:
  - from Task 1: `gmGet`, `gmSet`, `readIcons`, `iconNumber`, `own`, `learned`, `readHidden`, `hiddenNumbers`, `check`, `root`, `HIDDEN_STORE`; in the tests, `fire`, `lines`, `boxButton`, `boxSwitch`, `BOX`, `MENU`, `HELP`, `KEEP_ONE`, `w.menu`, `w.window`, `w.captures`;
  - from Task 2: `ROW_SELECTOR`, `cssText`'s `const rules = [];`, and the `DESKTOP_ROWS` line (an edit's anchor).
- Produces:
  - `SETTINGS_ID = 'tm-icon-hider-settings'`, `SAVED_MS = 1000`, `SPRITE_URL`, `HELP`, `PDA_HELP`, `KEEP_ONE`, `BOX_CSS`;
  - `saveChecked(name, value) -> boolean` (saved and read back the same), `numberOf(li) -> number` (the picture number in an li's class, 0 for none);
  - `openSettings()`, `listGroups(kinds) -> { inRow, seen }`, `switchLine(item, title, shown)`, `isPda() -> boolean`, `leavesOneShowing(kinds, hidden) -> boolean`, `closeSettings()`, `onKeyDown(e)`, `make(tag, text, className)`, `button(words, onClick, className)`;
  - `safely(handler) -> handler`: every handler the script gives the page, the box or the menu goes through it.
  - Task 4 uses `openSettings`, `numberOf`, `safely`, and the `KEEP_ONE` and keydown lines (edit anchors).

- [ ] **Step 1: Write the failing tests.** Add at the end of `server/torn-icon-hider.test.mjs`, after a blank line:

```js
// ---------------------------------------------------------------------------------------------
// The settings box
// ---------------------------------------------------------------------------------------------

test('"Icon Hider: Settings" in the menu opens the box: a title, an x, the help, the list, Cancel and Save', () => {
  const w = page().run();
  assert.deepEqual(Object.keys(w.menu), [MENU]);
  w.menu[MENU]();
  const box = w.box();
  assert.ok(box, 'the box is on the page');
  assert.equal(box.parentNode, w.document.body);
  assert.equal(box.querySelector('.tm-tih-head b').textContent, 'Icon Hider Settings');
  assert.deepEqual([...box.querySelectorAll('button')].map((b) => b.textContent), ['x', 'Cancel', 'Save']);
  assert.equal(box.querySelector('.tm-tih-body p').textContent, HELP);
  assert.equal(readFileSync(SRC, 'utf8').includes('.focus('), false, 'nothing is focused when it opens');
  const css = w.document.getElementById(STYLES).textContent;
  assert.match(css, /#tm-icon-hider-settings \.tm-tih-panel \{[^}]*width: 450px; max-width: 90%;/);
  assert.match(css, /#tm-icon-hider-settings label \{[^}]*font: 16px/, '16px, or an iPhone zooms in');
  assert.match(css, /#tm-icon-hider-settings \.tm-tih-list \{[^}]*overflow-y: auto;/, 'a long list scrolls in the box');
  w.menu[MENU]();
  assert.equal(w.document.querySelectorAll('#' + BOX).length, 1, 'never two boxes');
});

test('the list: the row\'s kinds in the row\'s order, then the ones seen before by title, each with Torn\'s picture', () => {
  const store = { 'tih-kinds': JSON.stringify({ travel: { title: 'Traveling', ids: [71] }, company: { title: 'Company', ids: [73, 27] } }) };
  const w = page({ store }).run();
  w.menu[MENU]();
  assert.deepEqual([...w.box().querySelectorAll('.tm-tih-group')].map((g) => g.textContent), ['In your row now', 'Seen before']);
  assert.deepEqual(lines(w).map((l) => l.name), TITLES.concat(['Company', 'Traveling']));
  const pos = Object.fromEntries(lines(w).map((l) => [l.name, l.pos]));
  assert.equal(pos.Male, 'background-position: -90px 0', 'picture 6: -(6-1) x 18 px');
  assert.equal(pos['Drug Cooldown'], 'background-position: -936px 0', 'picture 53');
  assert.equal(pos.Company, 'background-position: -468px 0', 'the last picture learned: 27');
  const css = w.document.getElementById(STYLES).textContent;
  assert.ok(css.includes('url("https://www.torn.com/images/v2/svg_icons/sprites/user_status_icons_sprite.svg")'), 'Torn\'s own sprite');
});

test('hidden kinds are listed in their place, unticked, and the rest ticked', () => {
  const w = page({ store: hiding('married', 'book') }).run();
  w.menu[MENU]();
  assert.deepEqual(lines(w).map((l) => [l.name, l.on]), [['Male', true], ['Subscriber', true], ['Married', false],
    ['Faction', true], ['Reading Book', false], ['Drug Cooldown', true]]);
});

test('with nothing learned yet, the box says "No icons seen yet."', () => {
  const w = page({ data: null }).run();
  w.menu[MENU]();
  assert.equal(w.box().querySelectorAll('input').length, 0);
  assert.equal(w.box().querySelector('.tm-tih-list').textContent, 'No icons seen yet.');
});

test('Save hides what is unticked at once, says "Saved." and closes a second later', () => {
  const w = page().run();
  w.menu[MENU]();
  boxSwitch(w, 'Male').checked = false;
  fire(w, boxButton(w, 'Save'), 'click');
  assert.equal(w.box().querySelector('.tm-tih-message').textContent, 'Saved.');
  assert.equal(w.store['tih-hidden'], '["maleGender"]');
  assert.equal(showing(w).includes('Male'), false, 'at once');
  w.advance(999);
  assert.ok(w.box(), 'still open');
  w.advance(1);
  assert.equal(w.box(), null, 'closed a second after the save');
});

test('a save that storage refuses, drops, or reads back wrong says so, stays open, and keeps what was saved before', () => {
  const ways = {
    refuses: (store, k, v) => { if (k === 'tih-hidden') throw new Error('QuotaExceededError'); store[k] = v; },
    drops: (store, k, v) => { if (k !== 'tih-hidden') store[k] = v; },
    // The save's write comes back changed; the write that puts the old choice back works.
    'reads back wrong': (() => {
      let garbled = false;
      return (store, k, v) => {
        store[k] = k === 'tih-hidden' && !garbled ? v.slice(0, -1) : v;
        if (k === 'tih-hidden') garbled = true;
      };
    })(),
  };
  for (const [name, setValue] of Object.entries(ways)) {
    const w = page({ store: hiding('book'), setValue }).run();
    w.menu[MENU]();
    boxSwitch(w, 'Male').checked = false;
    fire(w, boxButton(w, 'Save'), 'click');
    const message = w.box().querySelector('.tm-tih-message');
    assert.equal(message.textContent, 'Couldn\'t save, try again.', name);
    assert.ok(message.classList.contains('tm-tih-bad'), name);
    w.advance(5000);
    assert.ok(w.box(), name + ': stays open');
    assert.equal(w.store['tih-hidden'], '["book"]', name + ': the old choice is kept');
    assert.deepEqual(showing(w), [BLOODBAG, XANAX, 'Male', 'Subscriber', 'Married', 'Faction', 'Drug Cooldown'], name);
  }
});

test('Cancel, the x, Escape and a tap on the dark area close the box without a change; a tap inside it does not', () => {
  const ways = [
    (w) => fire(w, boxButton(w, 'Cancel'), 'click'),
    (w) => fire(w, boxButton(w, 'x'), 'click'),
    (w) => fire(w, w.document.body, 'keydown', { key: 'Escape' }),
    (w) => fire(w, w.box(), 'click'),
  ];
  ways.forEach((close, i) => {
    const w = page().run();
    w.menu[MENU]();
    boxSwitch(w, 'Male').checked = false;
    fire(w, w.box().querySelector('.tm-tih-panel'), 'click');
    fire(w, w.document.body, 'keydown', { key: 'Enter' });
    assert.ok(w.box(), 'a tap inside, or another key, leaves it open');
    close(w);
    assert.equal(w.box(), null, 'way ' + i);
    assert.equal(w.store['tih-hidden'], undefined, 'nothing saved');
    assert.equal(showing(w).includes('Male'), true);
  });
});

test('each time it opens, the switches show what is saved', () => {
  const w = page().run();
  w.menu[MENU]();
  boxSwitch(w, 'Male').checked = false;
  fire(w, boxButton(w, 'Cancel'), 'click');
  w.menu[MENU]();
  assert.equal(boxSwitch(w, 'Male').checked, true, 'Cancel saved nothing');
  fire(w, boxButton(w, 'Cancel'), 'click');
  w.store['tih-hidden'] = JSON.stringify(['faction']);
  w.menu[MENU]();
  assert.equal(boxSwitch(w, 'Faction').checked, false, 'a save from another tab');
});

test('titles go in as text, never as HTML', () => {
  const icons = { odd: { iconID: 'icon9', title: '<img src=x onerror=alert(1)>Odd &lt;b&gt;', link: '#' } };
  const w = page({ icons }).run();
  w.menu[MENU]();
  assert.deepEqual(lines(w).map((l) => l.name), ['Odd <b>']);
  assert.equal(w.box().querySelectorAll('img, b:not(.tm-tih-head b)').length, 0);
});

test('in Torn PDA, Save won\'t hide the last of Torn\'s icons showing in the row, and says why', () => {
  const w = page({ pda: true }).run();
  w.menu[MENU]();
  assert.ok(w.box().querySelector('.tm-tih-body p').textContent.endsWith('Torn PDA has no script menu, so one icon always stays showing.'));
  w.box().querySelectorAll('input').forEach((box) => { box.checked = false; });
  fire(w, boxButton(w, 'Save'), 'click');
  const message = w.box().querySelector('.tm-tih-message');
  assert.equal(message.textContent, KEEP_ONE);
  assert.ok(message.classList.contains('tm-tih-bad'));
  assert.equal(w.store['tih-hidden'], undefined, 'nothing saved');
  boxSwitch(w, 'Faction').checked = true;
  fire(w, boxButton(w, 'Save'), 'click');
  assert.equal(message.textContent, 'Saved.');
  assert.deepEqual(showing(w), [BLOODBAG, XANAX, 'Faction']);
});

test('PDA is told by its user agent too; the warboard app (even with PDA\'s bridge) and Tampermonkey can hide every icon', () => {
  const hideAll = (opts) => {
    const w = page(opts).run();
    w.menu[MENU]();
    w.box().querySelectorAll('input').forEach((box) => { box.checked = false; });
    fire(w, boxButton(w, 'Save'), 'click');
    return w.box().querySelector('.tm-tih-message').textContent;
  };
  assert.equal(hideAll({ ua: 'Mozilla/5.0 (Linux; Android 14) TornPDA/3.7' }), KEEP_ONE);
  assert.equal(hideAll({ pda: true, warboard: true }), 'Saved.');
  assert.equal(hideAll({ warboard: true }), 'Saved.');
  assert.equal(hideAll({}), 'Saved.');
  const w = page({ warboard: true }).run();
  w.menu[MENU]();
  assert.equal(w.box().querySelector('.tm-tih-body p').textContent, HELP, 'no PDA line');
});

test('PDA\'s bridge counts when it arrives after the script has started', () => {
  const w = page().run();
  w.window.flutter_inappwebview = { callHandler() {} };
  w.menu[MENU]();
  assert.ok(w.box().querySelector('.tm-tih-body p').textContent.endsWith('Torn PDA has no script menu, so one icon always stays showing.'));
  w.box().querySelectorAll('input').forEach((box) => { box.checked = false; });
  fire(w, boxButton(w, 'Save'), 'click');
  assert.equal(w.box().querySelector('.tm-tih-message').textContent, KEEP_ONE);
});

test('in PDA, with no Torn icon in the row to keep, Save works', () => {
  const w = page({ pda: true }).run();
  w.row().innerHTML = '';
  w.menu[MENU]();
  w.box().querySelectorAll('input').forEach((box) => { box.checked = false; });
  fire(w, boxButton(w, 'Save'), 'click');
  assert.equal(w.box().querySelector('.tm-tih-message').textContent, 'Saved.');
});

test('a host with no menu, or a menu that throws, still runs and hides icons', () => {
  for (const menu of [false, 'throws']) {
    const w = page({ menu, store: hiding('maleGender') }).run();
    assert.equal(showing(w).includes('Male'), false, String(menu));
    assert.deepEqual(w.logs, ['[Torn Icon Hider 1.0.0] running']);
  }
});

test('an error inside a handler is caught there, never reaching Torn\'s page', () => {
  const src = readFileSync(SRC, 'utf8');
  const hooks = src.split('\n').filter((l) => /addEventListener\(|GM_registerMenuCommand\(/.test(l));
  assert.ok(hooks.length >= 4, 'the menu, the box\'s buttons and the document\'s listeners');
  for (const l of hooks) assert.ok(l.includes('safely('), 'inside a try: ' + l.trim());
  const w = page().run();
  // An event any field of which throws when it is read.
  const bad = new Proxy({}, { get() { throw new Error('a field that throws'); } });
  for (const [type, listeners] of Object.entries(w.captures)) {
    for (const listener of listeners) assert.doesNotThrow(() => listener.fn.call(w.document, bad), type);
  }
});
```

- [ ] **Step 2: Run them to see them fail.** Run `T`.

Expected: `# tests 46 # pass 32 # fail 14`. Every new test fails but one: "a host with no menu, or a menu that throws, still runs and hides icons" passes already, as a guard (mutant M39 fails it).

- [ ] **Step 3: Edit the script.** In `server/public/scripts/torn-icon-hider.user.js`, seven edits, in this order:

**Edit 3.1: The box's names and words.** Replace:

```js
  const DESKTOP_ROWS = ROWS.map((row) => row + '[class*="big___"]:not([class*="mobile___"])');
```

With:

```js
  const DESKTOP_ROWS = ROWS.map((row) => row + '[class*="big___"]:not([class*="mobile___"])');
  const SETTINGS_ID = 'tm-icon-hider-settings';
  // After a save, the box says so for this long, then closes.
  const SAVED_MS = 1000;
  // Torn's own icon pictures: one sprite with a picture every 18 px, picture N at -(N-1)*18 px.
  const SPRITE_URL = 'https://www.torn.com/images/v2/svg_icons/sprites/user_status_icons_sprite.svg';
  const HELP = 'Untick an icon to hide it. Hidden icons stay in this list, so you can bring them back. '
    + 'A long press on any icon in the row opens these settings.';
  const PDA_HELP = ' Torn PDA has no script menu, so one icon always stays showing.';
  const KEEP_ONE = 'Keep one icon showing: in Torn PDA, a long press on an icon is the only way back here.';
```

**Edit 3.2: A save that reads itself back.** Replace:

```js
    return false;
  }

  // A stored value, read from its JSON. PDA hands values back as strings; a host that hands back
```

With:

```js
    return false;
  }

  // True when storage kept the value: saved, then read back the same. Some hosts drop a write
  // without throwing.
  function saveChecked(name, value) {
    return gmSet(name, value) && gmGet(name) === value;
  }

  // A stored value, read from its JSON. PDA hands values back as strings; a host that hands back
```

**Edit 3.3: The picture number of an icon in the row.** Replace:

```js
    return m ? Number(m[1]) : 0;
  }

  // A title as the icon's label reads it: Torn's label is the title's text, without any HTML.
```

With:

```js
    return m ? Number(m[1]) : 0;
  }

  // The picture number of Torn's icon in the row, from its class (icon52____l66f is 52), or 0
  // for any other li (the Xanax and Blood Bag icons have no such class).
  function numberOf(li) {
    const m = /(?:^|\s)icon(\d+)_/.exec(li && li.className ? String(li.className) : '');
    return m ? Number(m[1]) : 0;
  }

  // A title as the icon's label reads it: Torn's label is the title's text, without any HTML.
```

**Edit 3.4: The box's CSS, after the spacing rule.** Replace:

```js
  ].join('\n');

  // One rule per hidden picture number, for Torn's icon with that number in the row. The ___
```

With:

```js
  ].join('\n');

  // The settings box, laid out like the Xanax Reminder's.
  const BOX_CSS = [
    '#' + SETTINGS_ID + ' { position: fixed; top: 0; right: 0; bottom: 0; left: 0; z-index: 100000; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,.8); }',
    '#' + SETTINGS_ID + ' .tm-tih-panel { box-sizing: border-box; display: flex; flex-direction: column; width: 450px; max-width: 90%; max-height: 90%; border-radius: 10px; background: #2e2e2e; color: #ccc; box-shadow: 0 4px 20px rgba(0,0,0,.5); font: 400 14px/18px Arial, sans-serif; text-align: left; }',
    '#' + SETTINGS_ID + ' .tm-tih-head { display: flex; flex: none; align-items: center; justify-content: space-between; padding: 15px 20px; border-radius: 10px 10px 0 0; background: linear-gradient(to bottom, #1a1a1a, #2a2a2a); }',
    '#' + SETTINGS_ID + ' .tm-tih-head b { color: #fff; font-size: 18px; }',
    '#' + SETTINGS_ID + ' .tm-tih-head button { width: 30px; height: 30px; padding: 0; border: none; background: none; color: #aaa; font: 24px Arial, sans-serif; cursor: pointer; }',
    '#' + SETTINGS_ID + ' .tm-tih-body { display: flex; flex-direction: column; min-height: 0; padding: 20px; }',
    '#' + SETTINGS_ID + ' p { margin: 0 0 15px; color: #888; font-size: 12px; line-height: 16px; }',
    // The list scrolls inside the box when it is taller than the screen.
    '#' + SETTINGS_ID + ' .tm-tih-list { min-height: 0; margin-bottom: 15px; overflow-y: auto; }',
    '#' + SETTINGS_ID + ' .tm-tih-group { margin: 10px 0 4px; color: #aaa; font-size: 12px; }',
    // 16px, or an iPhone zooms in when a switch is tapped.
    '#' + SETTINGS_ID + ' label { display: flex; align-items: center; gap: 10px; padding: 6px 0; color: #fff; font: 16px Arial, sans-serif; cursor: pointer; }',
    '#' + SETTINGS_ID + ' input { flex: none; width: 18px; height: 18px; margin: 0; }',
    '#' + SETTINGS_ID + ' .tm-tih-pic { flex: none; width: 17px; height: 17px; background: url("' + SPRITE_URL + '") no-repeat; }',
    '#' + SETTINGS_ID + ' p.tm-tih-message { margin: 0 0 10px; color: #a3c248; font-size: 14px; }',
    '#' + SETTINGS_ID + ' p.tm-tih-bad { color: #e8735a; }',
    '#' + SETTINGS_ID + ' .tm-tih-buttons { display: flex; flex: none; justify-content: flex-end; gap: 10px; }',
    '#' + SETTINGS_ID + ' .tm-tih-buttons button { padding: 10px 20px; border: none; border-radius: 5px; background: linear-gradient(to bottom, #555, #777); color: #fff; font: 14px Arial, sans-serif; cursor: pointer; }',
    '#' + SETTINGS_ID + ' .tm-tih-buttons .tm-tih-save { background: linear-gradient(to bottom, #799427, #a3c248); }',
  ].join('\n');

  // One rule per hidden picture number, for Torn's icon with that number in the row. The ___
```

**Edit 3.5: The box's CSS goes in the stylesheet, always.** Replace:

```js
    const rules = [];
```

With:

```js
    const rules = [BOX_CSS];
```

**Edit 3.6: The settings box, before the check.** Replace:

```js
  // ===== THE CHECK =====
```

With:

```js
  // ===== THE SETTINGS BOX =====

  // The timer that closes the box a second after a save.
  let savedTimer = null;

  // Opens from the menu ("Icon Hider: Settings") or a long press on one of Torn's icons, over
  // everything else, laid out like the Xanax Reminder's settings: a switch for every kind of icon
  // seen in the row, ticked when it shows. Nothing changes in the row until Save. Nothing is
  // focused when it opens.
  function openSettings() {
    closeSettings();
    const kinds = learned();
    const hidden = readHidden();
    const pda = isPda();
    const overlay = make('div');
    overlay.id = SETTINGS_ID;
    const panel = make('div', '', 'tm-tih-panel');
    const head = make('div', '', 'tm-tih-head');
    head.appendChild(make('b', 'Icon Hider Settings'));
    head.appendChild(button('x', closeSettings));
    const list = make('div', '', 'tm-tih-list');
    const groups = listGroups(kinds);
    if (!groups.inRow.length && !groups.seen.length) list.appendChild(make('p', 'No icons seen yet.'));
    [['In your row now', groups.inRow], ['Seen before', groups.seen]].forEach((group) => {
      if (!group[1].length) return;
      list.appendChild(make('div', group[0], 'tm-tih-group'));
      group[1].forEach((item) => list.appendChild(switchLine(item, kinds[item.key].title, hidden.indexOf(item.key) < 0)));
    });
    const message = make('p', '', 'tm-tih-message');
    const say = (words, ok) => {
      message.textContent = words;
      message.classList.toggle('tm-tih-bad', !ok);
    };
    // Save keeps the kinds that are unticked. A save counts only when storage gives the value
    // back: then the row changes at once and the box closes a second later. When it doesn't, the
    // box says so and stays open, and what was saved before is kept.
    const save = () => {
      const next = [...list.querySelectorAll('input')].filter((box) => !box.checked).map((box) => box.getAttribute('data-key'));
      if (pda && !leavesOneShowing(kinds, next)) {
        say(KEEP_ONE, false);
        return;
      }
      const before = gmGet(HIDDEN_STORE);
      if (!saveChecked(HIDDEN_STORE, JSON.stringify(next))) {
        if (gmGet(HIDDEN_STORE) !== before) gmSet(HIDDEN_STORE, before);
        say('Couldn\'t save, try again.', false);
        return;
      }
      say('Saved.', true);
      check();
      clearTimeout(savedTimer);
      savedTimer = setTimeout(closeSettings, SAVED_MS);
    };
    const buttons = make('div', '', 'tm-tih-buttons');
    buttons.appendChild(button('Cancel', closeSettings));
    buttons.appendChild(button('Save', save, 'tm-tih-save'));
    const body = make('div', '', 'tm-tih-body');
    [make('p', HELP + (pda ? PDA_HELP : '')), list, message, buttons].forEach((el) => body.appendChild(el));
    panel.appendChild(head);
    panel.appendChild(body);
    overlay.appendChild(panel);
    // A tap on the dark area around the box is Cancel.
    overlay.addEventListener('click', safely((e) => {
      if (e.target === overlay) closeSettings();
    }));
    (document.body || root).appendChild(overlay);
  }

  // The kinds for the list: those in Torn's data now, in the row's order, then the rest by title.
  // Each comes with the picture number to draw: the one in the row now, or the last one learned.
  function listGroups(kinds) {
    const icons = readIcons() || {};
    const inRow = Object.keys(icons)
      .filter((key) => iconNumber(icons[key]) && own(kinds, key))
      .map((key) => ({ key, n: iconNumber(icons[key]) }));
    const seen = Object.keys(kinds)
      .filter((key) => !inRow.some((item) => item.key === key))
      .sort((a, b) => kinds[a].title.localeCompare(kinds[b].title))
      .map((key) => ({ key, n: kinds[key].ids[kinds[key].ids.length - 1] }));
    return { inRow, seen };
  }

  // One line of the list: a checkbox (ticked when the kind shows), Torn's picture and Torn's
  // title. The whole line is a label, so a tap anywhere on it flips the switch.
  function switchLine(item, title, shown) {
    const line = make('label');
    const box = make('input');
    box.type = 'checkbox';
    box.checked = shown;
    box.setAttribute('data-key', item.key);
    const pic = make('span', '', 'tm-tih-pic');
    pic.setAttribute('style', 'background-position: ' + (-(item.n - 1) * 18) + 'px 0');
    line.appendChild(box);
    line.appendChild(pic);
    line.appendChild(make('span', title));
    return line;
  }

  // Torn PDA, told apart as FactionOps does it: PDA's bridge (without the warboard app's own
  // bridge, as the warboard app once offered PDA's name too), or PDA's user agent. PDA shows no
  // script menu, so a long press on an icon is the only way back to the box there. Asked each
  // time the box opens, not at start: the script starts before the page has anything, and PDA's
  // bridge may come later.
  function isPda() {
    try {
      const warboard = !!(window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.gmBridge);
      if (typeof window.flutter_inappwebview !== 'undefined' && !warboard) return true;
      return /TornPDA|tornpda|DalvikTornPDA|com\.manuito/i.test(navigator.userAgent || '');
    } catch (e) {
      return false;
    }
  }

  // In PDA, true when at least one of Torn's icons in the row would still show with these kinds
  // hidden. With no row, or no Torn icon in it, there is nothing to keep.
  function leavesOneShowing(kinds, hidden) {
    const row = document.querySelector(ROW_SELECTOR);
    const numbers = row ? [...row.children].map(numberOf).filter(Boolean) : [];
    if (!numbers.length) return true;
    const gone = hiddenNumbers(kinds, hidden);
    return numbers.some((n) => gone.indexOf(n) < 0);
  }

  function closeSettings() {
    clearTimeout(savedTimer);
    savedTimer = null;
    const box = document.getElementById(SETTINGS_ID);
    if (box) box.remove();
  }

  // Escape closes the box without a change.
  function onKeyDown(e) {
    if (e.key === 'Escape' && document.getElementById(SETTINGS_ID)) closeSettings();
  }

  // An element with its text and class; either may be left out.
  function make(tag, text, className) {
    const el = document.createElement(tag);
    if (text) el.textContent = text;
    if (className) el.className = className;
    return el;
  }

  function button(words, onClick, className) {
    const b = make('button', words, className);
    b.type = 'button';
    b.addEventListener('click', safely(onClick));
    return b;
  }

  // ===== THE CHECK =====
```

**Edit 3.7: The try around every handler, the menu and Escape, at the start.** Replace:

```js
  // At document-start, before Torn draws anything, so a hidden icon doesn't flash on a page load.
```

With:

```js
  // Every handler the script gives the page, its box or the menu runs inside a try, so an error
  // in one stays there and never reaches Torn's page.
  function safely(handler) {
    return function (e) {
      try {
        handler(e);
      } catch (err) {
        // Dropped, as an error in a check is.
      }
    };
  }

  // The script's menu, where the host has one. A long press on one of Torn's icons opens the box too.
  try {
    if (typeof GM_registerMenuCommand === 'function') GM_registerMenuCommand('Icon Hider: Settings', safely(openSettings));
  } catch (e) {
    // PDA once crashed here. Without a menu, the long press still works.
  }
  document.addEventListener('keydown', safely(onKeyDown), true);
  // At document-start, before Torn draws anything, so a hidden icon doesn't flash on a page load.
```

- [ ] **Step 4: Run the tests to see them pass.** Run `T`, then `C`.

Expected: `# tests 46 # pass 46 # fail 0`, then `ascii-ok`.

- [ ] **Step 5: Commit.**

```bash
WT=/opt/warboard/.superpowers/sdd/2026-10-24-torn-icon-hider/wt; cd "$WT" && git commit -q -m "torn-icon-hider: the settings box, with a switch for every kind of icon seen in the row" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- server/public/scripts/torn-icon-hider.user.js server/torn-icon-hider.test.mjs && git log --format='%h %s' -1 && git status --short
```

Expected: the commit, then only `?? server/node_modules`.

---

### Task 4: The long press, and the mutant check

**Files:**
- Modify: `server/public/scripts/torn-icon-hider.user.js`
- Modify (tests): `server/torn-icon-hider.test.mjs`
- Outside the repo: `/opt/warboard/.superpowers/sdd/2026-10-24-torn-icon-hider/mutants.mjs` (already there from plan time) and `mut/`

**Interfaces:**
- Consumes:
  - from Tasks 1-3: `ROWS`, `ROW_SELECTOR`, `numberOf`, `openSettings`, `safely`, `cssText`'s `const rules = [BOX_CSS];`, and the `KEEP_ONE` and keydown lines (edit anchors);
  - in the tests: `fire`, `w.advance`, `w.reactSaw`, `w.captures`, `w.replaceRow`, `boxSwitch`, `boxButton`, `matching`, `rulesWith`.
- Produces:
  - `LONG_PRESS_MS = 500`, `SLOP_PX = 10`, `AFTER_PRESS_MS = 600`, `CALLOUT_CSS`;
  - the press: `tornIcon(target)`, `startPress(li)`, `cancelPress()`, and the handlers `onTouchStart`, `onTouchMove`, `onMouseDown`, `onMouseOut`, `onPressEnd`, `onTouchCancel`, `onClick`, `onContextMenu`, put on the document in the capture phase, each through `safely()`.

- [ ] **Step 1: Write the failing tests.** Add at the end of `server/torn-icon-hider.test.mjs`, after a blank line:

```js
// ---------------------------------------------------------------------------------------------
// The long press
// ---------------------------------------------------------------------------------------------

// A finger at (x, y), as touch events carry it.
const at = (x, y) => ({ touches: [{ clientX: x, clientY: y }] });

for (const layout of Object.keys(LAYOUTS)) {
  test(`${layout}: a 500 ms touch on one of Torn's icons opens the box, and its end is cancelled, so no click follows`, () => {
    const w = page({ layout }).run();
    const link = w.icon('Male').querySelector('a');
    fire(w, link, 'touchstart', at(10, 10));
    w.advance(499);
    assert.equal(w.box(), null, 'not yet');
    w.advance(1);
    assert.ok(w.box(), 'open');
    assert.equal(fire(w, link, 'touchend').defaultPrevented, true, 'cancelled: the phone makes no click');
  });
}

test('a short tap opens nothing, and its click reaches Torn untouched', () => {
  const w = page().run();
  const link = w.icon('Male').querySelector('a');
  fire(w, link, 'touchstart', at(10, 10));
  w.advance(200);
  assert.equal(fire(w, link, 'touchend').defaultPrevented, false);
  const click = fire(w, link, 'click');
  assert.equal(click.defaultPrevented, false, 'the link works');
  assert.equal(w.reactSaw.length, 1, 'Torn\'s React sees it');
  w.advance(2000);
  assert.equal(w.box(), null);
});

test('a 500 ms mouse press opens the box, and the click it ends in reaches neither Torn\'s React nor the link', () => {
  const w = page({ layout: 'Fly-out, desktop' }).run();
  const link = w.icon('Faction').querySelector('a');
  fire(w, link, 'mousedown', { button: 0 });
  w.advance(500);
  assert.ok(w.box());
  fire(w, link, 'mouseup', { button: 0 });
  const click = fire(w, link, 'click', { button: 0 });
  assert.equal(click.defaultPrevented, true, 'the link doesn\'t open (or reload the page)');
  assert.equal(w.reactSaw.length, 0, 'Torn doesn\'t select the icon');
});

test('a short mouse click passes through untouched', () => {
  const w = page({ layout: 'Fly-out, desktop' }).run();
  const link = w.icon('Faction').querySelector('a');
  fire(w, link, 'mousedown', { button: 0 });
  w.advance(100);
  fire(w, link, 'mouseup', { button: 0 });
  assert.equal(fire(w, link, 'click', { button: 0 }).defaultPrevented, false);
  assert.equal(w.reactSaw.length, 1);
  w.advance(1000);
  assert.equal(w.box(), null);
});

test('a finger moving more than 10 px cancels the press; a small wobble doesn\'t', () => {
  const w = page().run();
  const link = w.icon('Male').querySelector('a');
  fire(w, link, 'touchstart', at(10, 10));
  fire(w, link, 'touchmove', at(30, 10));
  w.advance(600);
  assert.equal(w.box(), null, 'a scroll of the strip');
  fire(w, link, 'touchend');
  fire(w, link, 'touchstart', at(10, 10));
  fire(w, link, 'touchmove', at(14, 13));
  w.advance(500);
  assert.ok(w.box(), 'a wobble');
});

test('a second finger cancels the press', () => {
  const w = page().run();
  const link = w.icon('Male').querySelector('a');
  fire(w, link, 'touchstart', at(10, 10));
  fire(w, link, 'touchstart', { touches: [{ clientX: 10, clientY: 10 }, { clientX: 90, clientY: 40 }] });
  w.advance(600);
  assert.equal(w.box(), null, 'a pinch');
  fire(w, link, 'touchend');
  fire(w, link, 'touchstart', at(10, 10));
  w.advance(500);
  assert.ok(w.box(), 'one finger again');
});

test('the mouse leaving the icon cancels the press; a right-click starts none and keeps its menu', () => {
  const w = page({ layout: 'Fly-out, desktop' }).run();
  const link = w.icon('Faction').querySelector('a');
  fire(w, link, 'mousedown', { button: 0 });
  fire(w, link, 'mouseout', { relatedTarget: w.icon('Faction') });
  w.advance(100);
  fire(w, link, 'mouseout', { relatedTarget: w.document.body });
  w.advance(600);
  assert.equal(w.box(), null, 'left the icon');
  fire(w, link, 'mouseup', { button: 0 });
  fire(w, link, 'mousedown', { button: 2 });
  w.advance(600);
  assert.equal(w.box(), null, 'a right-click');
  assert.equal(fire(w, link, 'contextmenu').defaultPrevented, false, 'its menu opens');
  fire(w, link, 'mouseup', { button: 2 });
  fire(w, link, 'mousedown', { button: 0 });
  w.advance(500);
  assert.ok(w.box(), 'the main button, held on the icon');
});

test('the phone\'s own long-press menu is held back during a press', () => {
  const w = page().run();
  const link = w.icon('Male').querySelector('a');
  fire(w, link, 'touchstart', at(10, 10));
  w.advance(300);
  assert.equal(fire(w, link, 'contextmenu').defaultPrevented, true);
  fire(w, link, 'touchend');
  assert.equal(fire(w, link, 'contextmenu').defaultPrevented, false, 'no press, no change');
});

test('a long press on the Xanax or Blood Bag icon, or on icons elsewhere on the page, doesn\'t open this box', () => {
  const w = page().run();
  const others = [w.icon(XANAX), w.icon(BLOODBAG), w.document.querySelector('#tray li')];
  for (const el of others) {
    fire(w, el.querySelector('a'), 'touchstart', at(10, 10));
    w.advance(600);
    assert.equal(w.box(), null, el.id || el.className);
    fire(w, el.querySelector('a'), 'touchend');
  }
  fire(w, w.icon('Male').querySelector('a'), 'touchstart', at(10, 10));
  w.advance(500);
  assert.ok(w.box(), 'Torn\'s own icon in the row');
});

test('it works on a row Torn has replaced', () => {
  const w = page().run();
  const ul = w.replaceRow();
  fire(w, ul.firstElementChild.nextElementSibling.nextElementSibling.querySelector('a'), 'touchstart', at(10, 10));
  w.advance(500);
  assert.ok(w.box());
});

test('after a long press, the phone\'s copies of the touch as mouse events start no second press', () => {
  const w = page().run();
  const link = w.icon('Male').querySelector('a');
  fire(w, link, 'touchstart', at(10, 10));
  w.advance(500);
  const box = w.box();
  assert.ok(box, 'the long press opened the box');
  fire(w, link, 'touchend');
  w.advance(50);
  fire(w, link, 'mousedown', { button: 0 });
  w.advance(600);
  assert.equal(w.box(), box, 'the same box');
});

test('right after a long press, a tap on a switch in the box works', () => {
  const w = page().run();
  const link = w.icon('Male').querySelector('a');
  fire(w, link, 'touchstart', at(10, 10));
  w.advance(500);
  fire(w, link, 'touchend');
  w.advance(200);
  assert.equal(fire(w, boxSwitch(w, 'Male'), 'click').defaultPrevented, false, 'the switch flips');
});

test('when a long press\'s touchend can\'t be cancelled, the click that follows is stopped; one much later is not', () => {
  const w = page().run();
  const link = w.icon('Male').querySelector('a');
  fire(w, link, 'touchstart', at(10, 10));
  w.advance(500);
  assert.equal(fire(w, link, 'touchend', { cancelable: false }).defaultPrevented, false);
  w.advance(100);
  const click = fire(w, link, 'click');
  assert.equal(click.defaultPrevented, true);
  assert.equal(w.reactSaw.length, 0);
  fire(w, boxButton(w, 'Cancel'), 'click');
  w.advance(1000);
  assert.equal(fire(w, link, 'click').defaultPrevented, false, 'a later tap is a tap');
  assert.equal(w.reactSaw.length, 1);
});

test('touchstart and touchmove are watched passively; touchend can cancel', () => {
  const w = page().run();
  assert.equal(w.captures.touchstart[0].passive, true);
  assert.equal(w.captures.touchmove[0].passive, true);
  assert.equal(w.captures.touchend[0].passive, false);
});

for (const layout of Object.keys(LAYOUTS)) {
  test(`${layout}: Torn's icon links in the row get no iPhone link menu and no text selection; nothing else does`, () => {
    const w = page({ layout }).run();
    const links = matching(w, '-webkit-touch-callout: none');
    assert.ok(TITLES.every((t) => links.has(w.icon(t).querySelector('a'))), 'Torn\'s icons in the row');
    assert.equal(links.has(w.icon(XANAX).querySelector('a')), false, 'the Xanax icon keeps its own');
    assert.equal([...links].some((a) => a.parentNode.parentNode !== w.row()), false, 'nothing outside the row');
    assert.ok(rulesWith(w, '-webkit-touch-callout: none').every((sel) => rulesWith(w, 'user-select: none').includes(sel)));
  });
}
```

- [ ] **Step 2: Run them to see them fail.** Run `T`.

Expected: `# tests 67 # pass 48 # fail 19`. Every new test fails but two guards: "a short tap opens nothing, and its click reaches Torn untouched" and "a short mouse click passes through untouched" pass already (mutant M38 fails both).

- [ ] **Step 3: Edit the script.** In `server/public/scripts/torn-icon-hider.user.js`, five edits, in this order:

**Edit 4.1: The press's timings.** Replace:

```js
  const KEEP_ONE = 'Keep one icon showing: in Torn PDA, a long press on an icon is the only way back here.';
```

With:

```js
  const KEEP_ONE = 'Keep one icon showing: in Torn PDA, a long press on an icon is the only way back here.';
  // A press this long on one of Torn's icons opens the settings box, as the Xanax Reminder's does.
  const LONG_PRESS_MS = 500;
  // A finger may wobble this far before the press counts as a move (a scroll of the strip).
  const SLOP_PX = 10;
  // After a long press, the click it ends in is stopped if it comes this soon. Mouse events this
  // soon after a touch are the phone's copies of it, and start no press.
  const AFTER_PRESS_MS = 600;
```

**Edit 4.2: No phone link menu and no text selection on Torn's icons.** Replace:

```js
  // ===== THE STYLESHEET =====
```

With:

```js
  // ===== THE STYLESHEET =====

  // No iPhone link menu and no text selection on a long press of Torn's icons in the row. The
  // phone decides when the finger lands, so this is on all the time.
  const CALLOUT_CSS = ROWS.map((row) => row + ' > li[class*="icon"] a').join(', ')
    + ' { -webkit-touch-callout: none !important; -webkit-user-select: none !important; user-select: none !important; }';
```

**Edit 4.3: That rule goes in the stylesheet, always.** Replace:

```js
    const rules = [BOX_CSS];
```

With:

```js
    const rules = [CALLOUT_CSS, BOX_CSS];
```

**Edit 4.4: The long press, before the check.** Replace:

```js
  // ===== THE CHECK =====
```

With:

```js
  // ===== THE LONG PRESS =====

  let pressTimer = null;
  // Torn's icon being pressed, and where the finger landed on it.
  let pressed = null;
  let startX = 0;
  let startY = 0;
  // A long press just opened the box, and the press hasn't ended yet.
  let longPressed = false;
  // Until when the click a long press ends in is stopped, in ms.
  let stopClickUntil = 0;
  // When the last touch ended, in ms.
  let touchedAt = -Infinity;

  // Torn's own icon in the row that an event happened on, or null: an li with an iconN___ class
  // in the row. The Xanax and Blood Bag icons have no such class, and keep their own long press.
  function tornIcon(target) {
    const el = target && target.nodeType === 1 ? target : (target && target.parentElement) || null;
    const li = el && typeof el.closest === 'function' ? el.closest('li') : null;
    if (!li || !numberOf(li)) return null;
    const row = li.parentElement;
    return row && row.matches(ROW_SELECTOR) ? li : null;
  }

  function startPress(li) {
    longPressed = false;
    stopClickUntil = 0;
    clearTimeout(pressTimer);
    pressed = li;
    pressTimer = setTimeout(() => {
      pressTimer = null;
      pressed = null;
      longPressed = true;
      openSettings();
    }, LONG_PRESS_MS);
  }

  function cancelPress() {
    clearTimeout(pressTimer);
    pressTimer = null;
    pressed = null;
  }

  // A finger on one of Torn's icons starts a press. A second finger (a pinch) cancels it.
  function onTouchStart(e) {
    const touches = e.touches || [];
    if (touches.length > 1) {
      cancelPress();
      return;
    }
    const li = tornIcon(e.target);
    if (!li) return;
    startX = touches[0] ? touches[0].clientX : 0;
    startY = touches[0] ? touches[0].clientY : 0;
    startPress(li);
  }

  // A finger moving more than a wobble (scrolling the strip, say) cancels the press.
  function onTouchMove(e) {
    if (!pressed) return;
    const t = e.touches && e.touches[0];
    if (!t || Math.abs(t.clientX - startX) > SLOP_PX || Math.abs(t.clientY - startY) > SLOP_PX) cancelPress();
  }

  // The main mouse button on one of Torn's icons starts a press. A right-click keeps its menu,
  // and mouse events that follow a touch are the phone's copies of it.
  function onMouseDown(e) {
    if (e.button !== 0 || Date.now() - touchedAt < AFTER_PRESS_MS) return;
    const li = tornIcon(e.target);
    if (li) startPress(li);
  }

  // The mouse leaving the icon cancels the press.
  function onMouseOut(e) {
    if (pressed && !(e.relatedTarget && pressed.contains(e.relatedTarget))) cancelPress();
  }

  // Letting go. After a long press, a touch's end is cancelled, which stops the click it would
  // make: that keeps Torn from selecting the icon or following its link. When it can't be
  // cancelled, or the press was the mouse's, the click that follows is stopped instead.
  function onPressEnd(e) {
    cancelPress();
    if (e.type === 'touchend') touchedAt = Date.now();
    if (!longPressed) return;
    longPressed = false;
    if (e.type === 'touchend' && e.cancelable) {
      e.preventDefault();
      return;
    }
    stopClickUntil = Date.now() + AFTER_PRESS_MS;
  }

  // A touch the browser took over (a scroll, its own gesture) ends the press with no click.
  function onTouchCancel() {
    cancelPress();
    longPressed = false;
  }

  // The click a long press ends in, wherever it lands, goes no further: stopPropagation keeps it
  // from Torn's React (which would select the icon), and preventDefault from the link (which
  // would open, or reload the page you're on). Either alone is not enough.
  function onClick(e) {
    if (!stopClickUntil) return;
    const stop = Date.now() <= stopClickUntil;
    stopClickUntil = 0;
    if (!stop) return;
    e.preventDefault();
    e.stopPropagation();
  }

  // The phone's own long-press menu (Android's) is held back during a press.
  function onContextMenu(e) {
    if (pressTimer || longPressed) e.preventDefault();
  }

  // ===== THE CHECK =====
```

**Edit 4.5: The press's listeners, after the Escape listener.** Replace:

```js
  document.addEventListener('keydown', safely(onKeyDown), true);
```

With:

```js
  document.addEventListener('keydown', safely(onKeyDown), true);
  // Presses on Torn's icons are watched from the document, in the capture phase, so they keep
  // working when Torn redraws or replaces the row, and the click a long press ends in is stopped
  // before Torn's own handlers see it. touchstart and touchmove never cancel anything, so they
  // are passive; touchend has to be able to cancel, so it isn't.
  document.addEventListener('touchstart', safely(onTouchStart), { capture: true, passive: true });
  document.addEventListener('touchmove', safely(onTouchMove), { capture: true, passive: true });
  document.addEventListener('touchend', safely(onPressEnd), { capture: true, passive: false });
  document.addEventListener('touchcancel', safely(onTouchCancel), { capture: true, passive: true });
  document.addEventListener('mousedown', safely(onMouseDown), true);
  document.addEventListener('mouseup', safely(onPressEnd), true);
  document.addEventListener('mouseout', safely(onMouseOut), true);
  document.addEventListener('click', safely(onClick), true);
  document.addEventListener('contextmenu', safely(onContextMenu), true);
```

- [ ] **Step 4: Run the tests to see them pass.** Run `T`, then `C`.

Expected: `# tests 67 # pass 67 # fail 0`, then `ascii-ok`.

- [ ] **Step 5: The mutant check.** Each mutant changes the script in one place, and each must fail at least one test. `mutants.mjs` is in the workspace from plan time (Setup checked its hash). If it must be written again, this is it:

```js
// Mutant check for the Torn Icon Hider tests: each mutant changes the script in one place, and
// each must fail at least one test. Usage: node mutants.mjs <script> <test file> <work dir>
import { readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

const [script, tests, dir] = process.argv.slice(2);
const src = readFileSync(script, 'utf8');
const meta = script.replace(/\.user\.js$/, '.meta.js');
const MUTANTS = [
  ['rules not limited to #sidebar', `const ROWS = ['#sidebar ul[class*="status-icons"]', '#sidebar ul[class*="statusIcons___"]'];`, `const ROWS = ['ul[class*="status-icons"]', 'ul[class*="statusIcons___"]'];`],
  ['a match without the ___', `' > li[class*="icon' + n + '___"]'`, `' > li[class*="icon' + n + '"]'`],
  ['no drug cooldown range', `[44, 48], [49, 53], [57, 61]`, `[44, 48], [57, 61]`],
  ['a number never leaves its old kind', `const at = other === key ? -1 : kinds[other].ids.indexOf(n);`, `const at = -1;`],
  ['range hides a shown kind\'s number', `if (!shown[m]) out[m] = true;`, `out[m] = true;`],
  ['subtitle stored with the title', `const title = plainTitle(icons[key].title) || key;`, `const title = plainTitle(icons[key].title + ' ' + (icons[key].subtitle || '')) || key;`],
  ['HTML kept in titles', `.replace(/<[^>]*>/g, '')`, `.replace(/<script>/g, '')`],
  ['stylesheet written every check', `if (style.textContent === css) return;`, ``],
  ['stylesheet waits for <head>', `(document.head || root).appendChild(style);`, `if (document.head) document.head.appendChild(style);`],
  ['a stylesheet taken out is never put back', `    let style = document.getElementById(STYLE_ID);\n    if (!style) {\n      style = document.createElement('style');`, `    let style = applyStyles.made || document.getElementById(STYLE_ID);\n    if (!style) {\n      style = applyStyles.made = document.createElement('style');`],
  ['spacing on with nothing hidden', `if (numbers.length) rules.push(SPACING_CSS);`, `rules.push(SPACING_CSS);`],
  ['spacing on the phone strip too', `row + '[class*="big___"]:not([class*="mobile___"])'`, `row + '[class*="big___"]'`],
  ['no nudge for the fade', `    style.textContent = css;\n    nudgeStrip();`, `    style.textContent = css;`],
  ['save without read-back', `if (!saveChecked(HIDDEN_STORE, JSON.stringify(next))) {`, `if (!gmSet(HIDDEN_STORE, JSON.stringify(next))) {`],
  ['failed save not undone', `if (gmGet(HIDDEN_STORE) !== before) gmSet(HIDDEN_STORE, before);`, ``],
  ['PDA rule off', `if (pda && !leavesOneShowing(kinds, next)) {`, `if (false && !leavesOneShowing(kinds, next)) {`],
  ['warboard app taken for PDA', `if (typeof window.flutter_inappwebview !== 'undefined' && !warboard) return true;`, `if (typeof window.flutter_inappwebview !== 'undefined') return true;`],
  ['PDA told apart only at start', `  function isPda() {\n    try {`, `  const PDA_AT_START = isPdaNow();\n  function isPda() {\n    return PDA_AT_START;\n  }\n  function isPdaNow() {\n    try {`],
  ['seen-before not sorted', `.sort((a, b) => kinds[a].title.localeCompare(kinds[b].title))`, ``],
  ['box closes at once after save', `savedTimer = setTimeout(closeSettings, SAVED_MS);`, `closeSettings();`],
  ['overlay closes on any tap', `if (e.target === overlay) closeSettings();`, `closeSettings();`],
  ['click after a long press not stopped from React', `    e.preventDefault();\n    e.stopPropagation();\n  }`, `    e.preventDefault();\n  }`],
  ['click after a long press opens the link', `    e.preventDefault();\n    e.stopPropagation();\n  }`, `    e.stopPropagation();\n  }`],
  ['touchend passive', `document.addEventListener('touchend', safely(onPressEnd), { capture: true, passive: false });`, `document.addEventListener('touchend', safely(onPressEnd), { capture: true, passive: true });`],
  ['touchend not cancelled', `if (e.type === 'touchend' && e.cancelable) {\n      e.preventDefault();`, `if (e.type === 'touchend' && e.cancelable) {`],
  ['click stopped after a cancelled touch too', `      e.preventDefault();\n      return;\n    }\n    stopClickUntil`, `      e.preventDefault();\n    }\n    stopClickUntil`],
  ['no wobble allowed', `const SLOP_PX = 10;`, `const SLOP_PX = 0;`],
  ['touchmove never cancels', `if (!t || Math.abs(t.clientX - startX) > SLOP_PX || Math.abs(t.clientY - startY) > SLOP_PX) cancelPress();`, ``],
  ['phone\'s mouse copies restart a press', `if (e.button !== 0 || Date.now() - touchedAt < AFTER_PRESS_MS) return;`, `if (e.button !== 0) return;`],
  ['right-click starts a press', `if (e.button !== 0 || Date.now()`, `if (Date.now()`],
  ['mouse leaving doesn\'t cancel', `if (pressed && !(e.relatedTarget && pressed.contains(e.relatedTarget))) cancelPress();`, ``],
  ['context menu not held back', `if (pressTimer || longPressed) e.preventDefault();`, ``],
  ['long press on our own icons', `if (!li || !numberOf(li)) return null;`, `if (!li) return null;`],
  ['long press on icons elsewhere', `return row && row.matches(ROW_SELECTOR) ? li : null;`, `return li;`],
  ['a second finger doesn\'t cancel', `if (touches.length > 1) {`, `if (touches.length > 9) {`],
  ['no callout rule', `const rules = [CALLOUT_CSS, BOX_CSS];`, `const rules = [BOX_CSS];`],
  ['long press too short', `const LONG_PRESS_MS = 500;`, `const LONG_PRESS_MS = 300;`],
  ['every press end taken for a long press', `    if (!longPressed) return;\n    longPressed = false;`, `    longPressed = false;`],
  ['menu outside a try', `  try {\n    if (typeof GM_registerMenuCommand === 'function') GM_registerMenuCommand('Icon Hider: Settings', safely(openSettings));\n  } catch (e) {\n    // PDA once crashed here. Without a menu, the long press still works.\n  }`, `  if (typeof GM_registerMenuCommand === 'function') GM_registerMenuCommand('Icon Hider: Settings', safely(openSettings));`],
  ['handlers outside a try', `  function safely(handler) {\n    return function (e) {`, `  function safely(handler) {\n    return handler;\n    return function (e) {`],
  ['one handler not wrapped', `document.addEventListener('click', safely(onClick), true);`, `document.addEventListener('click', onClick, true);`],
];
let caught = 0;
MUTANTS.forEach(([name, find, replace], i) => {
  const count = src.split(find).length - 1;
  if (count !== 1) { console.log(`M${i + 1} ${name}: find text occurs ${count} times`); return; }
  const file = join(dir, `m${String(i + 1).padStart(2, '0')}.user.js`);
  writeFileSync(file, src.replace(find, replace));
  copyFileSync(meta, file.replace(/\.user\.js$/, '.meta.js'));
  const run = spawnSync(process.execPath, ['--test', tests], { env: { ...process.env, TIH_SRC: file }, encoding: 'utf8' });
  const fail = Number(((run.stdout || '').match(/^# fail (\d+)/m) || [])[1] || 0);
  if (fail > 0) caught += 1;
  console.log(`M${i + 1} ${name}: ${fail > 0 ? 'caught' : 'SURVIVED'} (${fail} failing)`);
});
console.log(`${caught} of ${MUTANTS.length} caught`);
```

It runs the test file once per mutant, 41 runs in a row, so check the load first:

```bash
uptime; W=/opt/warboard/.superpowers/sdd/2026-10-24-torn-icon-hider; cd "$W" && mkdir -p mut && node mutants.mjs "$W/wt/server/public/scripts/torn-icon-hider.user.js" "$W/wt/server/torn-icon-hider.test.mjs" "$W/mut" > "$W/mutants.log" 2>&1; grep -v ': caught (' "$W/mutants.log"
```

Expected: load under 12, then `41 of 41 caught` and nothing else.
- A `SURVIVED` line means a test is missing. Write it, watch it fail on that mutant (`TIH_SRC` at `$W/mut/mNN.user.js`), add it to the test file, and ledger a ruling.
- A `find text occurs 0 times` line means an edit changed that text. Update the mutant to match, and ledger it.

Add the last line to the ledger.

- [ ] **Step 6: Commit.**

```bash
WT=/opt/warboard/.superpowers/sdd/2026-10-24-torn-icon-hider/wt; cd "$WT" && git commit -q -m "torn-icon-hider: a long press on Torn's icons opens the settings box, and the click it ends in goes nowhere" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- server/public/scripts/torn-icon-hider.user.js server/torn-icon-hider.test.mjs && git log --format='%h %s' -1 && git status --short
```

Expected: the commit, then only `?? server/node_modules`.

---

## Between Task 4 and Task 5: the final review

- The review package covers the whole branch, `git merge-base main HEAD`..HEAD, built by `review-package` from inside `$WT`.
- The reviewer is a fresh Opus agent (`model: "opus"`). It gets:
  - the package, this plan and the spec;
  - the Review Focus above, verbatim;
  - a pointer to the ledger's `Ruling:` lines and this plan's "Rulings made at plan time";
  - the layout proof's output from Task 2, and the mutant check's from Task 4. It may run both again on copies in its own scratch directory.
- Critical and Important findings go into one fix pass. Each fix is a failing test first, then the fix, then `T` green and `C` clean, committed on the branch. A fix that touches the spacing rule or the nudge runs `P` again; a fix that changes text a mutant looks for updates the mutant and runs the check again.
- Minor findings go to the ledger as deferred.

---

### Task 5: Release

**Files:** none in the repo change here. Main fast-forwards to the branch, the two served files get their owner, and the memory notes outside the repo are updated.

**Interfaces:** consumes the branch `torn-icon-hider` after the final review's fix pass.

- [ ] **Step 1: Pre-flight.** Check that the box isn't overloaded, that none of this script's files is in the main checkout (an untracked one there would stop the fast-forward), and that main hasn't moved:

```bash
uptime; cd /opt/warboard && ls server/public/scripts/torn-icon-hider.user.js server/public/scripts/torn-icon-hider.meta.js server/torn-icon-hider.test.mjs 2>&1 | grep -c 'No such file'; git status --short -- server/public/scripts/torn-icon-hider.user.js server/public/scripts/torn-icon-hider.meta.js server/torn-icon-hider.test.mjs docs/superpowers/specs/2026-10-24-torn-icon-hider-design.md docs/superpowers/plans/2026-10-24-torn-icon-hider.md && git merge-base --is-ancestor main torn-icon-hider && echo fast-forward-ok
```

Expected: load under 12, `3`, no status lines, then `fast-forward-ok`.
- If the load is over 12, wait.
- If main has moved, rebase the branch first: `git -C "$WT" rebase main`. Then run `T`, which must be all green.

- [ ] **Step 2: Fast-forward main.** This is the moment tornwar.com starts serving 1.0.0. Git writes the files as root, so their owner goes to warboard:

```bash
cd /opt/warboard && git merge --ff-only torn-icon-hider && chown warboard:warboard server/public/scripts/torn-icon-hider.user.js server/public/scripts/torn-icon-hider.meta.js && chmod 644 server/public/scripts/torn-icon-hider.user.js server/public/scripts/torn-icon-hider.meta.js && ls -l server/public/scripts/torn-icon-hider.user.js server/public/scripts/torn-icon-hider.meta.js
```

Expected: `Fast-forward`, then both files `-rw-r--r-- warboard warboard`.

- [ ] **Step 3: The whole suite, in place:**

```bash
cd /opt/warboard/server && node --test > /opt/warboard/.superpowers/sdd/2026-10-24-torn-icon-hider/suite.log 2>&1; grep -E "^# (tests|pass|fail|skipped) " /opt/warboard/.superpowers/sdd/2026-10-24-torn-icon-hider/suite.log | paste -sd" " -
```

Expected: `# fail 0`, with 2 skipped. The last run had 2328 tests, so this one should have about 2395 (this plan adds 67), give or take other sessions' work.
- If a failure is this change's, take the script down at once with `git revert --no-edit <first>^..HEAD` on main (first = the Task 1 commit), and stop.
- If a failure is another session's, name it in the report and carry on.

- [ ] **Step 4: Check what is served:**

```bash
curl -s http://127.0.0.1:3000/scripts/torn-icon-hider.meta.js | grep '@version'; curl -s https://tornwar.com/scripts/torn-icon-hider.meta.js | grep '@version'; curl -s https://tornwar.com/scripts/torn-icon-hider.user.js | grep -c "const VERSION = '1.0.0'"; curl -s https://tornwar.com/scripts/torn-icon-hider.user.js | sha256sum | cut -c1-16; sha256sum /opt/warboard/server/public/scripts/torn-icon-hider.user.js | cut -c1-16
```

Expected: `// @version      1.0.0` twice, then `1`, then the same 16 characters twice.

- [ ] **Step 5: Push main,** with the remote's credentials masked:

```bash
cd /opt/warboard && git push origin main 2>&1 | sed -E 's#//[^@]*@#//***@#g'; git status -sb | head -1
```

Expected: `main -> main`, and `## main...origin/main` with nothing ahead.

- [ ] **Step 6: Record Task 5,** from inside `$WT`. Run `task-done` with the served-version check as its test command:

```bash
bash -c "curl -s https://tornwar.com/scripts/torn-icon-hider.meta.js | grep -q '@version      1.0.0' && echo served-1.0.0"
```

Then copy the ledger, `mutants.log` and `suite.log` out of the workspace, to this session's scratchpad, before the workspace goes.

- [ ] **Step 7: Remove the worktree, the branch and the workspace.** The symlink goes first: git counts it as untracked, so it would block the removal.

```bash
rm /opt/warboard/.superpowers/sdd/2026-10-24-torn-icon-hider/wt/server/node_modules && cd /opt/warboard && git worktree remove /opt/warboard/.superpowers/sdd/2026-10-24-torn-icon-hider/wt && git branch -d torn-icon-hider && rm -r /opt/warboard/.superpowers/sdd/2026-10-24-torn-icon-hider && git worktree list
```

Expected: `git worktree list` shows only `/opt/warboard`.

- [ ] **Step 8: Notes and report.**
  - Update this script's project memory, outside the repo, in place: 1.0.0 is live and pushed, with what it does; still owed: the owner's live check and the Greasy Fork upload. Update its index line in place too.
  - Report to the owner:
    - the rulings and any deferred minors from the ledger;
    - the served URL, https://tornwar.com/scripts/torn-icon-hider.user.js, to install from and to paste to Greasy Fork;
    - the live check from the spec.
