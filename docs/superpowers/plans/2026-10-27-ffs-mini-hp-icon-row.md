# FFS Banner Estimates Beta 2.73.915: the Mini Profile's HP Beside the Icons - Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** In FFS Banner Estimates Beta, the mini profile's HP line moves from under the FF line to right after the card's icons, so it no longer runs out of Torn's status box onto whatever is below it.

**Architecture:**
- One script changes: `server/public/scripts/ffs-banner-estimates-beta.user.js` and its meta file. `ffs_paintMiniHp` puts the line at the end of the card's icon row (`.icons > ul`), with a size of its own, because Torn's row sets its font size to 0. Once the line is in, FFS checks whether it went down onto a line of its own below the icons. If it did, it says only the percentage, `HP 21%`. If that went down too, it says it all again, since it has a line of its own anyway. A card with no icon row gets the line where 2.73.914 put it, under the FF line.
- How FFS asks Torn does not change: one call per player, kept a minute, at most 20 a minute, and none while Torn is refusing the key. The FF line does not change.
- The stable copy, `ffs-banner-estimates.user.js`, stays at 2.73.61. `server/public/scripts` is served from the main checkout, so the work is done in a git worktree and released by a fast-forward of main. Nothing on the server changes, so there is no deploy and no pm2 reload.

**Tech Stack:** a userscript (plain JavaScript). Tests use node:test and linkedom, and run the beta's shipped functions, lifted out of the file by name. One throwaway check lays a copy of Torn's card out in headless Chromium, under Torn's own stylesheets (archived copies, read from disk).

**Spec:** the design the owner approved in chat, below. There is no spec file: the change is one script and its test.

**The ask:**
- 21:39 EDT on 2026-10-26, the owner, with a phone screenshot of a mini profile in which 2.73.914's HP line lay on top of the text of another script's block under Torn's status box: "can the hp by the icons?"
- Facts found, from archived copies of Torn's own stylesheets (the profile-mini build's and `css/style/icon.css`, both of 2026-09-17, from the Wayback Machine, not from Torn) and of the profile-mini build's code (2026-10-07):
  - The status box, `.profile-container .description`, is `position: absolute; bottom: 0; height: 53px`: a flex column, 10px text on 11px lines. Torn's own lines fill it, so a line added inside it runs out of its bottom. A copy of the card laid out in headless Chromium, with a hospital status as in the screenshot, has 2.73.914's HP line 13px out of the box: the overlap in the screenshot.
  - The icon row is `div.icons > ul.big.svg > li#icon<N>-mini-profile-<id>`, above the status box and in normal flow. Each icon is an inline-block 16px wide and 17px tall with a 4px gap after it, and the `ul` has `font-size: 0`. Torn takes the gap away only from the row's last child (`li:last-child`), so once the line follows the last icon, that icon keeps its gap and the line needs no margin of its own. Every `li` in the row gets Torn's icon picture as its background, and `ul.big li` is 16px wide, so the line must not be an `li`. Torn's code draws the row in the same pass as the rest of the column, as a list keyed by icon, and draws its `ul` even when there are no icons.
  - The icons' column is 246px wide on a phone (the card's own width there; it shows no picture), and at least 245px on PC (433px less the picture's 184px and its 4px margin; the picture can only shrink). Seven icons and their gaps take 140px of it, which leaves room, in Arial at 10px, for `HP 1,234 / 5,678 (21%)` (104px), but not for `HP 7,234 / 7,234 (100%)`.
- The owner was asked two questions, each with a recommendation, and answered "go with recommended" at 22:13 EDT:
  1. when the whole line has no room beside the icons, it says only the percentage, `HP 21%`, so it stays beside them;
  2. it goes right after the last icon.
  - With them came the design: the line 10px, in the card's own text colour; the fit checked once, as the line is drawn; Torn asked as before; under the FF line on a card with no icon row; the tests moved with it. The FF line, which also sits in the status box, was mentioned and left as it is.
- A ruling made while planning: when even `HP 21%` has no room, the line is on a line of its own under the icons anyway, so it says it all there. The owner's answer covers a line that fits once short; this is the case it leaves open.

**Execution:** the owner chooses at hand-off. One fresh Opus reviewer checks the branch between Task 1 and Task 2 either way.

**Dry run:** every block in this plan was applied, by a script that takes each one out of this file byte for byte, to copies of main's files at d3d2d25d in a scratch git repo: the Setup scripts and the chain button's baseline, Task 1's ten test edits (Step 2: its counts and all 15 names), its six script edits and the meta file (Step 4), the green runs (Step 5), the layout check on both betas (Step 6), the mutants (Step 7) and the sweep (Step 9). Each printed what its Expected says. The whole suite (Step 8) needs the real checkout, and Task 2 releases, so neither ran. The dry run changed the plan twice: the line lost a 4px left margin that doubled the gap after the last icon, and the layout check's copy of the card gained Torn's list reset, without which the row was 40px short.

## Global Constraints

- Beta only: `ffs-banner-estimates-beta.user.js` and `ffs-banner-estimates-beta.meta.js`. The stable copy and its meta file stay byte for byte as they are.
- The line: a `div.ffs-mini-hp`, appended as the last child of the card's `.icons > ul`, with the inline style `display:inline-block;font-size:10px;line-height:17px;vertical-align:top;white-space:nowrap`: no margin and no colour of its own. Its text is `HP <current> / <maximum> (<pct>%)`. When that has gone down below the element before it, the text is `HP <pct>%`, and when that has gone down too, the whole text again.
- "Gone down": the line's `offsetTop` is at or below the bottom of the element just before it (that element's `offsetTop + offsetHeight`). With nothing before it, it has not.
- A card with no icon row gets the line under the FF line in `.description`, as in 2.73.914. A card with no `.description` gets no line, as in 2.73.914.
- Nothing about asking Torn changes: `ffs_fetchLife`, `ffs_miniHp`, their limits and `check_mutation` stay as they are. The FF line stays as it is.
- No new @grant, @connect or menu entry; no clicks. The layout check sends no request anywhere: its page refuses every one.
- Version 2.73.915: `@version`, `SCRIPT_VERSION` and the meta file (the header and a newline) agree, and the CHANGELOG lists it first. Inline comments carry no version numbers.
- Straight quotes only in the script: PDA's GM layer breaks on curly ones.
- The repo is public. Tests and text use made-up numbers, names and ids (1,234 / 5,678, Target, 1000001), never a member's, and never a value from the owner's screenshots. No Torn stylesheet or bundle goes into the repo: the layout check reads the archived copies from this plan's git-ignored workspace.
- Release: a fast-forward of main, with the served files `warboard:warboard 644`. No `deploy.sh`, and no pm2 reload while the chain runs; pm2's warboard pid is the same before and after.
- Stage only this plan's paths: other sessions' dirty files in the main checkout stay as they are. Every commit ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Torn's real layout, on the owner's phone.** Whether the line fits is read from the card's layout, which only a browser has. Task 1 Step 6 draws the line into a copy of Torn's phone card under Torn's own stylesheets in headless Chromium, with 2.73.914 as the control. There, beside 7 icons the whole line fits when its numbers are short (`1,234 / 5,678`) and says `HP 100%` when they are long (`7,234 / 7,234`); beside 8 to 10 icons it says `HP 21%`; with 11 or 12 it takes a row of its own under the icons, which makes the card 17px taller, as a second row of Torn's own icons does; and once Torn's own icons take two rows (13), it fits beside them again. On PC the picture beside the column hides its overflow, so it can shrink: a long row widens the column a little and narrows the picture, as Torn's own long rows do, and the line counts toward that at its full length even once it has dropped to a row of its own. The check draws no PC card, because the rest of that column is not copied faithfully. Those stylesheets are copies from 2026-09-17, Chromium is not the phone's WebKit, and the box's fonts are not the phone's, so each count may move by an icon. The owner's check settles it (Task 2 Step 8 asks for it): the line right after the icons, `HP <pct>%` when the icons leave no room, the buttons still inside the card when the line takes a row of its own, and nothing lying on what is under the status box.
2. **Torn redrawing the icon row while the card is open.** React keeps the icons as a keyed list: an icon added while the card is open goes after the line, and a row drawn afresh loses it. No test here can run Torn's React. The line is drawn once per card, as in 2.73.914. If the owner sees it show and then go, that is the cause, and the cure is drawing it again whenever it is missing.
3. **A light card.** Torn's light theme gives the card a light background and its dark theme a dark one. The line has no colour of its own, so it takes the card's. The test "the HP line goes right after the last icon, at a size of its own, in the colour of the card" pins it.
4. **A card drawn before it is laid out.** If FFS draws the line before the browser has laid the card out, every size reads 0. That reads as gone down both times, so the card gets the whole line. The test "a card not laid out yet, every size 0, gets the whole line" pins it.
5. **Cards without a status box, or without icons.** Torn reuses the card's wrapper for its send-money form, and 2.73.914 drew nothing on a card with no `.description`; the icon row does not change that. A row with no icons has nothing before the line, and the line stays whole. The tests "a card with an icon row but no status box gets no line" and "an icon row with no icons in it still takes the whole line" pin them.

## Paths and commands

- `W=/opt/warboard/.superpowers/sdd/2026-10-27-ffs-mini-hp-icon-row` is this plan's git-ignored workspace, and `WT=$W/wt` the worktree, on branch `ffs-mini-hp-icon-row`.
- **The HP tests read the beta from their own checkout**, so in the worktree they test the worktree's beta, unless `FFS_DIR` names another folder (the mutants use that). **The chain button's tests read `FFS_DIR`, or main's served beta when it is unset.** Every whole-suite run in the worktree sets `FFS_DIR="$WT/server/public/scripts"`, so they test the branch's beta.
- `SCRATCHPAD` is the scratchpad directory the session's system prompt names. Setup Step 3 and Task 2 Step 6 use it, and stop if it is unset.
- Test runs write to `$W/t.log` and print the `# tests`, `# pass` and `# fail` lines, then any `not ok` lines.
- **Edits:** each "Replace" block's text occurs in its file exactly once, and the "With" block takes its place. Neither block holds the newline that ends its last line. Make a step's edits in the order given.

## Setup

- [ ] **Step 1: Commit this plan on main, then make the worktree:**

```bash
uptime; cd /opt/warboard && git add -- docs/superpowers/plans/2026-10-27-ffs-mini-hp-icon-row.md && git commit -q -m "plan: FFS Banner Estimates Beta 2.73.915, the mini profile's HP beside the icons" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- docs/superpowers/plans/2026-10-27-ffs-mini-hp-icon-row.md && W=/opt/warboard/.superpowers/sdd/2026-10-27-ffs-mini-hp-icon-row && mkdir -p "$W" && git worktree add -q "$W/wt" -b ffs-mini-hp-icon-row && ln -s /opt/warboard/server/node_modules "$W/wt/server/node_modules" && git -C "$W/wt" status --short && git -C "$W/wt" log --format='%h %s' -1 | cat
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

- [ ] **Step 3: Torn's stylesheets, for the layout check.** Archived copies of 2026-09-17, kept in the workspace and never in the repo. They were fetched into the scratchpad's `mini-icons-dl` while this plan was written, so they are copied from there, and fetched again from the Wayback Machine if they are not there:

```bash
W=/opt/warboard/.superpowers/sdd/2026-10-27-ffs-mini-hp-icon-row; A="${SCRATCHPAD:?set SCRATCHPAD to the scratchpad directory}/mini-icons-dl"; C=$W/torn-css; mkdir -p "$C" && if [ -s "$A/app.dec.css" ] && [ -s "$A/icon-0917.css" ]; then cp "$A/app.dec.css" "$C/mini.css" && cp "$A/icon-0917.css" "$C/icon.css"; else curl -s -m 60 -o "$C/mini.raw" "https://web.archive.org/web/20260917144122id_/https://www.torn.com/builds/profile-mini/app.b56930936fb40c33.css" && curl -s -m 60 -o "$C/icon.raw" "https://web.archive.org/web/20260917144122id_/https://www.torn.com/css/style/icon.css?v=1788529980" && for f in mini icon; do (gunzip -c "$C/$f.raw" 2>/dev/null || cat "$C/$f.raw") > "$C/$f.css"; done; fi; wc -c < "$C/mini.css"; wc -c < "$C/icon.css"
```

Expected: `122065`, then `275990`.

- [ ] **Step 4: Baseline.** The chain button's tests, then the whole suite, in the worktree, with the failing names kept for Task 1:

```bash
W=/opt/warboard/.superpowers/sdd/2026-10-27-ffs-mini-hp-icon-row; WT=$W/wt; export FFS_DIR="$WT/server/public/scripts"; cd "$WT/server" && node --test ffs-chain-button.test.mjs > "$W/t.log" 2>&1; command grep -E "^# (tests|pass|fail) " "$W/t.log" | paste -sd" " -; node --test > "$W/baseline.log" 2>&1; command grep -E "^# (tests|pass|fail|skipped) " "$W/baseline.log" | paste -sd" " -; command grep -E "^not ok" "$W/baseline.log" | sed -E 's/^not ok [0-9]+ - //' | sort > "$W/base-fail-names.txt"; wc -l < "$W/base-fail-names.txt"
```

Expected: `# tests 26 # pass 26 # fail 0`; then the whole suite with `# skipped 2`, and its failures counted. A worktree has failed 30 tests that pass on main, all from what a worktree lacks: `factionops-filters.test.mjs` needs `server/.env`, `war-history-dedupe.test.mjs` needs main's uncommitted `war-history.js`, and 28 RW Pricer tests read main's live `data/rwp-prices.json`. If the names in `$W/base-fail-names.txt` are those, ledger them as the gate (`Setup: Ruling:`): Task 1 must end with the same names. If any other test fails, run it on main too (`cd /opt/warboard/server && node --test <file>`); a failure there as well is not this plan's, so ledger it and go on.

---

### Task 1: HP beside the icons

**Files:**
- Modify: `server/ffs-mini-hp.test.mjs`
- Modify: `server/public/scripts/ffs-banner-estimates-beta.user.js` (header, CHANGELOG, the HP section's opening comment, `ffs_hpLine`, `ffs_paintMiniHp`, `SCRIPT_VERSION`)
- Regenerate: `server/public/scripts/ffs-banner-estimates-beta.meta.js`

**Interfaces:**
- Consumes (in the beta since 2.73.914): `ffs_hpLine(life) -> string|null`; `ffs_placeMiniLine(description, el)`; `ffs_paintMiniHp(mini, life)`, which `ffs_showMiniHp(mini, playerId)` calls once Torn has answered and the card is still open on that player.
- Produces:
  - `ffs_hpLine(life, short = false) -> string|null`: with `short`, `HP <pct>%`;
  - `ffs_paintMiniHp(mini, life)`: called as before, now placing the line in the icon row;
  - `ffs_miniHpWrapped(line) -> boolean`.

- [ ] **Step 1: The tests.** Ten edits, in this order.

**Edit 1 of 10 in `server/ffs-mini-hp.test.mjs`.** Replace:

```js
// FFS Banner Estimates Beta: the HP line in Torn's mini profile. The card shows
// no life of its own, so FFS asks Torn's API for the player's profile, at most
// once a minute per player, and writes "HP 1,234 / 5,678 (21%)" under its FF
// line. Runs the SHIPPED functions of the beta, lifted out by name. The script
// is read from this checkout's public/scripts, or from FFS_DIR when that names
// another folder.
```

With:

```js
// FFS Banner Estimates Beta: the HP line in Torn's mini profile. The card shows
// no life of its own, so FFS asks Torn's API for the player's profile, at most
// once a minute per player, and writes "HP 1,234 / 5,678 (21%)" right after the
// card's icons. Runs the SHIPPED functions of the beta, lifted out by name. The
// script is read from this checkout's public/scripts, or from FFS_DIR when that
// names another folder.
```

**Edit 2 of 10 in `server/ffs-mini-hp.test.mjs`.** Replace:

```js
const hpLine = (life) => new Function(fn('ffs_hpLine') + 'return ffs_hpLine;')()(life);
```

With:

```js
const hpLine = (life, short) => new Function(fn('ffs_hpLine') + 'return ffs_hpLine;')()(life, short);
```

**Edit 3 of 10 in `server/ffs-mini-hp.test.mjs`.** Replace:

```js
    assert.equal(hpLine(life), null, String(JSON.stringify(life)));
  }
});
```

With:

```js
    assert.equal(hpLine(life), null, String(JSON.stringify(life)));
  }
});

test('the short line is the percentage alone, floored the same way', () => {
  assert.equal(hpLine({ current: 1234, maximum: 5678 }, true), 'HP 21%');
  assert.equal(hpLine({ current: 7499, maximum: 7500 }, true), 'HP 99%');
  assert.equal(hpLine({ current: 1, maximum: 7500 }, true), 'HP 1%');
  assert.equal(hpLine({ current: 0, maximum: 7500 }, true), 'HP 0%');
  assert.equal(hpLine({ current: 'x', maximum: 7500 }, true), null);
});
```

**Edit 4 of 10 in `server/ffs-mini-hp.test.mjs`.** Replace:

```js
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
```

With:

```js
// A mini profile as Torn draws one, for a made-up player, with FFS's lines (as
// HTML) in its description after Torn's own status. With `icons`, the card has
// Torn's icon row above the status box, holding that many icons.
function card(id, lines = '', icons = null) {
  const row = icons === null ? '' : '<div class="icons"><ul class="big svg">'
    + Array.from({ length: icons }, (_, i) => `<li id="icon${i + 1}-mini-profile-${id}" class="left"></li>`).join('')
    + '</ul></div>';
  const { window, document } = parseHTML('<!doctype html><html><body>'
    + '<div class="profile-mini-_userProfileWrapper_abc12">' + row + '<div class="profile-container">'
    + `<a class="user-name" href="https://www.torn.com/profiles.php?XID=${id}">Target</a>`
    + '<div class="description"><div class="desc-wrap"><span class="main-desc">Okay</span></div>'
    + lines + '</div></div></div></body></html>');
  const mini = document.querySelector('[class^="profile-mini-_userProfileWrapper_"]');
  return { window, document, mini, description: mini.querySelector('.description'), row: mini.querySelector('.icons > ul') };
}
const FF = '<span class="ff-scouter-mini-ff">FF 2.50 (Moderate)</span>';

// Lays a card out for the fit check, as a browser would: every icon 17 px tall
// on the first line, and the HP line beside them while its text is `room`
// characters long or less, else on the line below, 22 px down (an icon and its
// margin). With `room` null the card is not laid out yet, and every size reads
// 0. linkedom has no sizes of its own and one HTMLElement for every document,
// so the sizes hold for every card until the function this returns is called.
function layout(c, room) {
  const proto = c.window.HTMLElement.prototype;
  Object.defineProperty(proto, 'offsetTop', {
    configurable: true,
    get() { return room !== null && this.classList.contains('ffs-mini-hp') && this.textContent.length > room ? 22 : 0; },
  });
  Object.defineProperty(proto, 'offsetHeight', { configurable: true, get() { return room === null ? 0 : 17; } });
  return () => { delete proto.offsetTop; delete proto.offsetHeight; };
}
```

**Edit 5 of 10 in `server/ffs-mini-hp.test.mjs`.** Replace:

```js
    fn('ffs_hpLine') + fn('ffs_placeMiniLine') + fn('ffs_paintMiniHp') + fn('get_player_id_in_element')
    + fn('ffs_showMiniHp') + 'return { ffs_placeMiniLine, ffs_paintMiniHp, ffs_showMiniHp };',
```

With:

```js
    fn('ffs_hpLine') + fn('ffs_placeMiniLine') + fn('ffs_miniHpWrapped') + fn('ffs_paintMiniHp')
    + fn('get_player_id_in_element') + fn('ffs_showMiniHp')
    + 'return { ffs_placeMiniLine, ffs_paintMiniHp, ffs_showMiniHp };',
```

**Edit 6 of 10 in `server/ffs-mini-hp.test.mjs`.** Replace:

```js
test('the HP line sits right under the FF line, above anything after it', () => {
```

With:

```js
test('with no icon row, the HP line sits right under the FF line, above anything after it', () => {
```

**Edit 7 of 10 in `server/ffs-mini-hp.test.mjs`.** Replace:

```js
test('an FF line drawn after the HP line still goes above it, each time FFS redraws it', () => {
```

With:

```js
test('with no icon row, an FF line drawn after the HP line still goes above it, each time FFS redraws it', () => {
```

**Edit 8 of 10 in `server/ffs-mini-hp.test.mjs`.** Replace:

```js
test('with no FF line, the HP line goes at the end of the description', () => {
```

With:

```js
test('with no icon row and no FF line, the HP line goes at the end of the description', () => {
```

**Edit 9 of 10 in `server/ffs-mini-hp.test.mjs`.** Replace:

```js
  assert.equal(asked, 0);
});
```

With:

```js
  assert.equal(asked, 0);
});

// ── the icon row ──

// What the icon row holds, in order: each child's tag and its text.
const inRow = (c) => [...c.row.children].map((el) => el.tagName + ': ' + el.textContent);

test('the HP line goes right after the last icon, at a size of its own, in the colour of the card', () => {
  const c = card(1000001, FF, 3);
  const restore = layout(c, 99);
  try {
    painter(c.document).ffs_paintMiniHp(c.mini, LIFE);
  } finally {
    restore();
  }
  assert.deepEqual(inRow(c), ['LI: ', 'LI: ', 'LI: ', 'DIV: HP 1,234 / 5,678 (21%)']);
  const line = c.row.lastElementChild;
  assert.equal(line.className, 'ffs-mini-hp');
  // Torn's row sets its font size to 0, so the line must set its own or vanish.
  assert.equal(line.style.fontSize, '10px');
  assert.equal(line.style.display, 'inline-block');
  assert.equal(line.style.color, '', 'no colour of its own: the card has a light theme and a dark one');
  assert.deepEqual(shown(c.description), ['desc-wrap: Okay', 'ff-scouter-mini-ff: FF 2.50 (Moderate)']);
});

test('when the whole line has no room beside the icons, it says only the percentage', () => {
  const c = card(1000001, FF, 8);
  const restore = layout(c, 10);
  try {
    painter(c.document).ffs_paintMiniHp(c.mini, LIFE);
  } finally {
    restore();
  }
  assert.equal(c.row.lastElementChild.textContent, 'HP 21%');
});

test('when even the percentage has no room, the line is on a line of its own and says it all', () => {
  const c = card(1000001, FF, 11);
  const restore = layout(c, 0);
  try {
    painter(c.document).ffs_paintMiniHp(c.mini, LIFE);
  } finally {
    restore();
  }
  assert.equal(c.row.lastElementChild.textContent, 'HP 1,234 / 5,678 (21%)');
});

test('a card not laid out yet, every size 0, gets the whole line', () => {
  const c = card(1000001, FF, 3);
  const restore = layout(c, null);
  try {
    painter(c.document).ffs_paintMiniHp(c.mini, LIFE);
  } finally {
    restore();
  }
  assert.equal(c.row.lastElementChild.textContent, 'HP 1,234 / 5,678 (21%)');
});

test('an icon row with no icons in it still takes the whole line', () => {
  const c = card(1000001, FF, 0);
  const restore = layout(c, 0);
  try {
    painter(c.document).ffs_paintMiniHp(c.mini, LIFE);
  } finally {
    restore();
  }
  assert.deepEqual(inRow(c), ['DIV: HP 1,234 / 5,678 (21%)']);
});

test('drawing again in the icon row replaces the line instead of adding a second', () => {
  const c = card(1000001, FF, 3);
  const p = painter(c.document);
  const restore = layout(c, 99);
  try {
    p.ffs_paintMiniHp(c.mini, LIFE);
    p.ffs_paintMiniHp(c.mini, { current: 5678, maximum: 5678 });
  } finally {
    restore();
  }
  assert.deepEqual(inRow(c), ['LI: ', 'LI: ', 'LI: ', 'DIV: HP 5,678 / 5,678 (100%)']);
  assert.equal(c.mini.querySelectorAll('.ffs-mini-hp').length, 1);
});

test('a card with an icon row but no status box gets no line', () => {
  const c = card(1000001, FF, 3);
  c.description.remove();
  painter(c.document).ffs_paintMiniHp(c.mini, LIFE);
  assert.equal(c.mini.querySelectorAll('.ffs-mini-hp').length, 0);
});
```

**Edit 10 of 10 in `server/ffs-mini-hp.test.mjs`.** Replace:

```js
test('the beta is 2.73.914 in its header, its SCRIPT_VERSION and its meta file, and its CHANGELOG starts there', () => {
  assert.match(SRC, /^\/\/ @version {6}2\.73\.914$/m);
  assert.match(SRC, /const SCRIPT_VERSION = '2\.73\.914';/);
  const end = SRC.indexOf('// ==/UserScript==') + '// ==/UserScript=='.length;
  assert.equal(META, SRC.slice(0, end) + '\n');
  const log = SRC.slice(SRC.indexOf('CHANGELOG'));
  assert.match(log, /\n\/\/ 2\.73\.914 — [^\n]+\n(\/\/ {14}[^\n]+\n)*\/\/ 2\.73\.913 — /);
});
```

With:

```js
test('the beta is 2.73.915 in its header, its SCRIPT_VERSION and its meta file, and its CHANGELOG starts there', () => {
  assert.match(SRC, /^\/\/ @version {6}2\.73\.915$/m);
  assert.match(SRC, /const SCRIPT_VERSION = '2\.73\.915';/);
  const end = SRC.indexOf('// ==/UserScript==') + '// ==/UserScript=='.length;
  assert.equal(META, SRC.slice(0, end) + '\n');
  const log = SRC.slice(SRC.indexOf('CHANGELOG'));
  assert.match(log, /\n\/\/ 2\.73\.915 — [^\n]+\n(\/\/ {14}[^\n]+\n)*\/\/ 2\.73\.914 — /);
});
```

- [ ] **Step 2: Run them, and watch them fail:**

```bash
W=/opt/warboard/.superpowers/sdd/2026-10-27-ffs-mini-hp-icon-row; WT=$W/wt; cd "$WT/server" && node --test ffs-mini-hp.test.mjs > "$W/t.log" 2>&1; command grep -E "^# (tests|pass|fail) " "$W/t.log" | paste -sd" " -; command grep -E "^not ok" "$W/t.log" | sed -E 's/^not ok [0-9]+ - //'; command grep -c "not found: ffs_miniHpWrapped" "$W/t.log"
```

Expected: `# tests 29 # pass 14 # fail 15`, then these 15 names:

```
the short line is the percentage alone, floored the same way
with no icon row, the HP line sits right under the FF line, above anything after it
with no icon row, an FF line drawn after the HP line still goes above it, each time FFS redraws it
with no icon row and no FF line, the HP line goes at the end of the description
drawing again replaces the HP line instead of adding a second
a card that has closed, or now shows someone else, gets no line
no description, life with no line, or no player id: nothing is drawn or asked
the HP line goes right after the last icon, at a size of its own, in the colour of the card
when the whole line has no room beside the icons, it says only the percentage
when even the percentage has no room, the line is on a line of its own and says it all
a card not laid out yet, every size 0, gets the whole line
an icon row with no icons in it still takes the whole line
drawing again in the icon row replaces the line instead of adding a second
a card with an icon row but no status box gets no line
the beta is 2.73.915 in its header, its SCRIPT_VERSION and its meta file, and its CHANGELOG starts there
```

The short line fails on its value: 2.73.914 has no short line and says it all. The 13 tests that draw a card fail on `not found: ffs_miniHpWrapped`, which 2.73.915 adds; the count printed last, `13`, is how many times the log names it. The last fails on the version.

- [ ] **Step 3: The script.** Six edits, in this order.

**Edit 1 of 6 in `server/public/scripts/ffs-banner-estimates-beta.user.js`.** Replace:

```js
// @version      2.73.914
```

With:

```js
// @version      2.73.915
```

**Edit 2 of 6 in `server/public/scripts/ffs-banner-estimates-beta.user.js`.** Replace:

```js
// 2.73.914 — Mini profiles show the player's HP on its own line under the FF
```

With:

```js
// 2.73.915 — Mini profiles: the HP sits right after the icons. Under the FF
//              line it ran out of Torn's status box onto whatever was below
//              it. When the whole line has no room beside the icons, it says
//              only the percentage, "HP 21%".
// 2.73.914 — Mini profiles show the player's HP on its own line under the FF
```

**Edit 3 of 6 in `server/public/scripts/ffs-banner-estimates-beta.user.js`.** Replace:

```js
  // A mini profile shows the player's life on its own line under the FF line,
  // as "HP 1,234 / 5,678 (21%)". Torn's card carries no life, so it costs one
```

With:

```js
  // A mini profile shows the player's life right after its icons, as
  // "HP 1,234 / 5,678 (21%)". Torn's card carries no life, so it costs one
```

**Edit 4 of 6 in `server/public/scripts/ffs-banner-estimates-beta.user.js`.** Replace:

```js
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
```

With:

```js
  /**
   * The HP line for Torn's life numbers, or null when they are not numbers it
   * can show. The percentage is floored, as FactionOps' is on the attack page,
   * so it says 100% only when full and 0% only when the player is down. The
   * short line is the percentage alone, "HP 21%", for where the whole line has
   * no room.
   */
  function ffs_hpLine(life, short = false) {
    if (!life || !Number.isFinite(life.current) || !Number.isFinite(life.maximum)) return null;
    const cur = life.current;
    const max = life.maximum;
    if (max <= 0 || cur < 0) return null;
    let pct = Math.floor((cur / max) * 100);
    if (pct === 100 && cur < max) pct = 99;
    if (pct === 0 && cur > 0) pct = 1;
    if (short) return `HP ${pct}%`;
    return `HP ${cur.toLocaleString("en-US")} / ${max.toLocaleString("en-US")} (${pct}%)`;
  }
```

**Edit 5 of 6 in `server/public/scripts/ffs-banner-estimates-beta.user.js`.** Replace:

```js
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
```

With:

```js
  /**
   * Draws the HP line in a mini profile, in place of one already there. It goes
   * right after the last icon in Torn's icon row, because the status box below
   * the icons has a fixed height: a line added inside it runs out of the box
   * onto whatever is under it. A card with no icon row gets it under the FF
   * line. The row is narrow, so when the whole line has no room beside the
   * icons it says only the percentage, and when even that has no room it is on
   * a line of its own anyway, so it says it all.
   */
  function ffs_paintMiniHp(mini, life) {
    const text = ffs_hpLine(life);
    const description = mini.querySelector(".description");
    if (!text || !description) return;
    for (const old of mini.querySelectorAll(".ffs-mini-hp")) old.remove();
    const line = document.createElement("div");
    line.className = "ffs-mini-hp";
    line.textContent = text;
    const row = mini.querySelector(".icons > ul");
    if (!row) {
      ffs_placeMiniLine(description, line);
      return;
    }
    // Torn's icon row sets its font size to 0 to close the gaps between the
    // icons, so the line sets its own, and sits on the icons' line like one of
    // them. It needs no margin: Torn takes the gap after an icon away only from
    // the row's last child, so the icon before the line keeps its gap. It keeps
    // the card's text colour, which suits light and dark cards.
    line.style.cssText = "display:inline-block;font-size:10px;line-height:17px;vertical-align:top;white-space:nowrap";
    row.appendChild(line);
    if (ffs_miniHpWrapped(line)) {
      line.textContent = ffs_hpLine(life, true);
      if (ffs_miniHpWrapped(line)) line.textContent = text;
    }
  }

  /**
   * Whether the HP line in the icon row went down onto a line of its own, below
   * the icon before it. On a card that is not laid out yet every size is 0,
   * which reads as gone down, so such a card ends up with the whole line.
   */
  function ffs_miniHpWrapped(line) {
    const icon = line.previousElementSibling;
    return !!icon && line.offsetTop >= icon.offsetTop + icon.offsetHeight;
  }
```

**Edit 6 of 6 in `server/public/scripts/ffs-banner-estimates-beta.user.js`.** Replace:

```js
  const SCRIPT_VERSION = '2.73.914';
```

With:

```js
  const SCRIPT_VERSION = '2.73.915';
```

- [ ] **Step 4: The meta file is the header and a newline.** Write it again from the header, then check the script parses and the meta file matches:

```bash
W=/opt/warboard/.superpowers/sdd/2026-10-27-ffs-mini-hp-icon-row; S=$W/wt/server/public/scripts/ffs-banner-estimates-beta; sed -n '1,/^\/\/ ==\/UserScript==$/p' "$S.user.js" > "$S.meta.js" && node --check "$S.user.js" && echo parses; wc -l < "$S.meta.js"; command grep '@version' "$S.meta.js"; command grep -c $'[‘’“”]' "$S.user.js"; git -C "$W/wt" diff --stat | cat
```

Expected: `parses`; `20`, the header's lines; the new `@version`; `0`, for no curly quotes; then the diffstat:

```
 server/ffs-mini-hp.test.mjs                        | 155 ++++++++++++++++++---
 .../scripts/ffs-banner-estimates-beta.meta.js      |   2 +-
 .../scripts/ffs-banner-estimates-beta.user.js      |  56 ++++++--
 3 files changed, 185 insertions(+), 28 deletions(-)
```

- [ ] **Step 5: Run the tests again,** with the chain button's and the beta's sort tests:

```bash
W=/opt/warboard/.superpowers/sdd/2026-10-27-ffs-mini-hp-icon-row; WT=$W/wt; cd "$WT/server" && node --test ffs-mini-hp.test.mjs > "$W/t.log" 2>&1; command grep -E "^# (tests|pass|fail) " "$W/t.log" | paste -sd" " -; command grep -E "^not ok" "$W/t.log"; FFS_DIR="$WT/server/public/scripts" node --test ffs-chain-button.test.mjs 2>&1 | command grep -E "^# (tests|pass|fail) " | paste -sd" " -; FFS_BUILD=beta node --test ffs-sort.test.mjs 2>&1 | command grep -E "^# (tests|pass|fail) " | paste -sd" " -
```

Expected: `# tests 29 # pass 29 # fail 0` and no `not ok` lines; then `# tests 26 # pass 26 # fail 0`; then `# tests 53 # pass 53 # fail 0`.

- [ ] **Step 6: The layout check.** The tests above stand in for a browser's layout; this draws the line into a copy of Torn's card in headless Chromium, under Torn's own stylesheets, and says where it lands. It runs main's beta as well, as the control: that must show 2.73.914's line running out of the status box, or the check is not looking at what the owner saw.

Write `$W/layout-check.mjs`:

```js
// Draws FFS beta's HP line into a copy of Torn's mini profile in headless Chromium, laid out by
// Torn's own stylesheets (archived copies, read from disk, never fetched from Torn), and says where
// the line ended up. The page refuses every request it makes, so nothing reaches Torn or anywhere.
// Only a phone's card is drawn. There the card is 246px wide with no picture, so the column the
// icons are in is 246px. On PC that column is 433px less the picture's 184px and its 4px margin,
// and the picture can only shrink, so it is at least 245px: the phone is the tighter case.
// Usage: node layout-check.mjs <beta .user.js> <profile-mini .css> <icon .css>
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
const [betaPath, miniCssPath, iconCssPath] = process.argv.slice(2);
const SRC = fs.readFileSync(betaPath, "utf8");
const miniCss = fs.readFileSync(miniCssPath, "utf8");
const iconCss = fs.readFileSync(iconCssPath, "utf8");

// Playwright is not one of the repo's packages: use a copy npx has already fetched, one whose
// headless Chromium is installed. Nothing is installed here.
function findPlaywright() {
  const npx = path.join(os.homedir(), ".npm/_npx");
  const browsers = path.join(os.homedir(), ".cache/ms-playwright");
  for (const d of fs.existsSync(npx) ? fs.readdirSync(npx).sort() : []) {
    const pw = path.join(npx, d, "node_modules/playwright-core");
    if (!fs.existsSync(path.join(pw, "browsers.json"))) continue;
    const shell = JSON.parse(fs.readFileSync(path.join(pw, "browsers.json"), "utf8")).browsers
      .find((b) => b.name === "chromium-headless-shell");
    if (shell && fs.existsSync(path.join(browsers, "chromium_headless_shell-" + shell.revision))) return pw;
  }
  throw new Error("no playwright-core with its headless Chromium installed; ask before installing one");
}
const { chromium } = await import(pathToFileURL(path.join(findPlaywright(), "index.mjs")).href);

// The source of one named function, found by counting braces from its name, or "" if the build has none.
function fn(name) {
  const at = SRC.indexOf("function " + name + "(");
  if (at < 0) return "";
  let depth = 0;
  for (let j = SRC.indexOf("{", at); j < SRC.length; j++) {
    if (SRC[j] === "{") depth++;
    else if (SRC[j] === "}" && --depth === 0) return SRC.slice(at, j + 1) + "\n";
  }
  throw new Error("unbalanced: " + name);
}
const lifted = ["ffs_hpLine", "ffs_placeMiniLine", "ffs_miniHpWrapped", "ffs_paintMiniHp"].map(fn).join("");
const version = (SRC.match(/^\/\/ @version\s+(\S+)$/m) || [])[1];

// Torn's hashed class names, as its stylesheet has them in this build.
const cls = (stem) => {
  const m = miniCss.match(new RegExp("\\.(profile-mini-_" + stem + "___[A-Za-z0-9_-]+)"));
  if (!m) throw new Error("no class in the stylesheet for " + stem);
  return m[1];
};
const WRAPPER = cls("wrapper");
const PROFILE = cls("userProfileWrapper");
const INFO = cls("userInfoWrapper");
const IMAGE = cls("userImageWrapper");

// A card for a made-up player in hospital, as in the owner's screenshot: the icon row with `icons`
// icons, then the status box with Torn's two lines, its last action and FFS's FF line, then the buttons.
function cardHtml(icons) {
  const lis = Array.from({ length: icons }, (_, i) =>
    `<li id="icon${i + 1}-mini-profile-1000001" class="user-status-16-Icon${i + 1} left"></li>`).join("");
  return `<div id="profile-mini-root" class="profile-mini-root"><div class="${WRAPPER} mini-profile-wrapper">`
    + `<div class="${IMAGE}"></div><div class="${PROFILE}">`
    + `<div style="height:24px"><a href="https://www.torn.com/profiles.php?XID=1000001">Target</a></div>`
    + `<div class="${INFO}"></div>`
    + `<div class="icons"><ul class="big svg">${lis}</ul></div>`
    + `<div class="profile-container hospital"><div class="description">`
    + `<div class="desc-wrap"><span class="main-desc">In hospital for 12 minutes</span><span class="sub-desc">Attacked by Someone</span></div>`
    + `<div class="last-action"><span class="last-action-line"></span><span class="last-action-desc">Last action: 1 hour ago</span></div>`
    + `<span class="ff-scouter-mini-ff">FF 2.50 (Moderate) Stats: 1.23b</span>`
    + `</div></div>`
    + `<div class="buttons-list" style="height:42px"></div>`
    + `</div></div></div>`;
}

const CASES = [
  [5, { current: 1234, maximum: 5678 }],
  [7, { current: 1, maximum: 5678 }],
  [7, { current: 1234, maximum: 5678 }],
  [7, { current: 7234, maximum: 7234 }],
  [8, { current: 1234, maximum: 5678 }],
  [10, { current: 1234, maximum: 5678 }],
  [11, { current: 1234, maximum: 5678 }],
  [12, { current: 1234, maximum: 5678 }],
  [13, { current: 1234, maximum: 5678 }],
  [0, { current: 1234, maximum: 5678 }],
];

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
  await page.route("**/*", (route) => route.abort());
  for (const [icons, life] of CASES) {
    // Torn's page resets every list's margin and padding, in a stylesheet not kept here: in the
    // owner's screenshot the icons start flush with the status box. Without it, the browser's own
    // 40px indent would narrow the row.
    await page.setContent(`<!doctype html><html><head><style>${iconCss}</style><style>${miniCss}</style>`
      + `<style>body{margin:0;font:12px Arial,sans-serif}.${WRAPPER}{position:relative}ul{margin:0;padding:0}</style></head>`
      + `<body class="d r">${cardHtml(icons)}</body></html>`);
    const out = await page.evaluate(({ lifted, life }) => {
      const api = new Function(lifted + "return { ffs_paintMiniHp };")();
      const mini = document.querySelector('[class*="userProfileWrapper"]');
      const buttons = mini.querySelector(".buttons-list");
      const before = buttons.getBoundingClientRect().top;
      api.ffs_paintMiniHp(mini, life);
      const moved = Math.round(buttons.getBoundingClientRect().top - before);
      const line = mini.querySelector(".ffs-mini-hp");
      if (!line) return { text: "(no line)" };
      const r = line.getBoundingClientRect();
      const box = mini.querySelector(".profile-container .description").getBoundingClientRect();
      const inRow = !!line.closest(".icons");
      const icon = inRow ? line.previousElementSibling : null;
      const where = !inRow ? "in the status box"
        : !icon ? "alone in the icon row"
        : line.offsetTop >= icon.offsetTop + icon.offsetHeight ? "below the icons" : "beside the icons";
      const clash = inRow ? (r.bottom <= box.top ? "clear of the status box" : "OVER the status box")
        : (r.bottom <= box.bottom ? "inside it" : `spills ${Math.round(r.bottom - box.bottom)}px out of its bottom`);
      return { text: line.textContent, where, clash, moved: moved ? `pushes the buttons down ${moved}px` : "moves nothing",
        column: Math.round(mini.getBoundingClientRect().width) };
    }, { lifted, life });
    console.log(`${version} ${out.column}px ${String(icons).padStart(2)} icons  ${out.text.padEnd(24)} ${out.where}, ${out.clash}, ${out.moved}`);
  }
} finally {
  await browser.close();
}
```

Run it, on the worktree's beta and then on main's:

```bash
uptime; W=/opt/warboard/.superpowers/sdd/2026-10-27-ffs-mini-hp-icon-row; for b in "$W/wt/server/public/scripts" /opt/warboard/server/public/scripts; do timeout 180 node "$W/layout-check.mjs" "$b/ffs-banner-estimates-beta.user.js" "$W/torn-css/mini.css" "$W/torn-css/icon.css"; done
```

Expected: the load under 12, then the 10 lines of the worktree's 2.73.915 and the 10 of main's 2.73.914:

```
2.73.915 246px  5 icons  HP 1,234 / 5,678 (21%)   beside the icons, clear of the status box, moves nothing
2.73.915 246px  7 icons  HP 1 / 5,678 (1%)        beside the icons, clear of the status box, moves nothing
2.73.915 246px  7 icons  HP 1,234 / 5,678 (21%)   beside the icons, clear of the status box, moves nothing
2.73.915 246px  7 icons  HP 100%                  beside the icons, clear of the status box, moves nothing
2.73.915 246px  8 icons  HP 21%                   beside the icons, clear of the status box, moves nothing
2.73.915 246px 10 icons  HP 21%                   beside the icons, clear of the status box, moves nothing
2.73.915 246px 11 icons  HP 1,234 / 5,678 (21%)   below the icons, clear of the status box, pushes the buttons down 17px
2.73.915 246px 12 icons  HP 1,234 / 5,678 (21%)   below the icons, clear of the status box, pushes the buttons down 17px
2.73.915 246px 13 icons  HP 1,234 / 5,678 (21%)   beside the icons, clear of the status box, moves nothing
2.73.915 246px  0 icons  HP 1,234 / 5,678 (21%)   alone in the icon row, clear of the status box, pushes the buttons down 17px
2.73.914 246px  5 icons  HP 1,234 / 5,678 (21%)   in the status box, spills 13px out of its bottom, moves nothing
2.73.914 246px  7 icons  HP 1 / 5,678 (1%)        in the status box, spills 13px out of its bottom, moves nothing
2.73.914 246px  7 icons  HP 1,234 / 5,678 (21%)   in the status box, spills 13px out of its bottom, moves nothing
2.73.914 246px  7 icons  HP 7,234 / 7,234 (100%)  in the status box, spills 13px out of its bottom, moves nothing
2.73.914 246px  8 icons  HP 1,234 / 5,678 (21%)   in the status box, spills 13px out of its bottom, moves nothing
2.73.914 246px 10 icons  HP 1,234 / 5,678 (21%)   in the status box, spills 13px out of its bottom, moves nothing
2.73.914 246px 11 icons  HP 1,234 / 5,678 (21%)   in the status box, spills 13px out of its bottom, moves nothing
2.73.914 246px 12 icons  HP 1,234 / 5,678 (21%)   in the status box, spills 13px out of its bottom, moves nothing
2.73.914 246px 13 icons  HP 1,234 / 5,678 (21%)   in the status box, spills 13px out of its bottom, moves nothing
2.73.914 246px  0 icons  HP 1,234 / 5,678 (21%)   in the status box, spills 13px out of its bottom, moves nothing
```

Every 2.73.915 line says `clear of the status box`, and every 2.73.914 line says `spills 13px out of its bottom`: the overlap in the owner's screenshot. Where the line switches comes from the Arial on this box and Chromium's layout, so if a switch moves by an icon, ledger it and go on. A 2.73.915 line that says `OVER the status box`, or a 2.73.914 line that does not spill, stops the task: then the check is wrong, or the line is.

- [ ] **Step 7: Mutants.** Each changes one thing 2.73.915 changes, and the tests must catch every one.

Write `$W/mutants.mjs`:

```js
// Mutants of the worktree's beta: each changes one thing 2.73.915 changed, and the tests must
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
  ["the line stays under the FF line on a card with an icon row",
    "    const row = mini.querySelector(\".icons > ul\");\n", "    const row = null;\n"],
  ["the line put before the icons", "    row.appendChild(line);\n", "    row.prepend(line);\n"],
  ["no font size of its own, so it takes the row's 0",
    "display:inline-block;font-size:10px;line-height:17px;", "display:inline-block;line-height:17px;"],
  ["a white of its own, unreadable on a light card",
    "vertical-align:top;white-space:nowrap\";", "vertical-align:top;white-space:nowrap;color:#fff\";"],
  ["the whole line kept with no room beside the icons", "      line.textContent = ffs_hpLine(life, true);\n", ""],
  ["the percentage kept on a line of its own", "      if (ffs_miniHpWrapped(line)) line.textContent = text;\n", ""],
  ["the short line not short", "    if (short) return `HP ${pct}%`;\n", ""],
  ["a row with no icons breaks the fit check", "    return !!icon && line.offsetTop", "    return line.offsetTop"],
  ["a card with no status box still gets the line",
    "    if (!text || !description) return;\n    for (const old of mini.querySelectorAll(\".ffs-mini-hp\")) old.remove();",
    "    if (!text) return;\n    for (const old of mini.querySelectorAll(\".ffs-mini-hp\")) old.remove();"],
  ["drawing again adds a second line", "    for (const old of mini.querySelectorAll(\".ffs-mini-hp\")) old.remove();\n", ""],
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
W=/opt/warboard/.superpowers/sdd/2026-10-27-ffs-mini-hp-icon-row; node "$W/mutants.mjs" "$W/wt"
```

Expected:

```
m1 caught by 6: the line stays under the FF line on a card with an icon row (first: the HP line goes right after the last icon, at a size of its)
m2 caught by 5: the line put before the icons (first: the HP line goes right after the last icon, at a size of its)
m3 caught by 1: no font size of its own, so it takes the row's 0 (first: the HP line goes right after the last icon, at a size of its)
m4 caught by 1: a white of its own, unreadable on a light card (first: the HP line goes right after the last icon, at a size of its)
m5 caught by 1: the whole line kept with no room beside the icons (first: when the whole line has no room beside the icons, it says on)
m6 caught by 2: the percentage kept on a line of its own (first: when even the percentage has no room, the line is on a line )
m7 caught by 2: the short line not short (first: the short line is the percentage alone, floored the same way)
m8 caught by 1: a row with no icons breaks the fit check (first: an icon row with no icons in it still takes the whole line)
m9 caught by 2: a card with no status box still gets the line (first: no description, life with no line, or no player id: nothing )
m10 caught by 2: drawing again adds a second line (first: drawing again replaces the HP line instead of adding a secon)
10 of 10 caught
```

- [ ] **Step 8: The whole suite in the worktree,** against the baseline's failing names:

```bash
uptime; W=/opt/warboard/.superpowers/sdd/2026-10-27-ffs-mini-hp-icon-row; WT=$W/wt; cd "$WT/server" && FFS_DIR="$WT/server/public/scripts" node --test > "$W/suite.log" 2>&1; command grep -E "^# (tests|pass|fail|skipped) " "$W/suite.log" | paste -sd" " -; command grep -E "^not ok" "$W/suite.log" | sed -E 's/^not ok [0-9]+ - //' | sort | diff "$W/base-fail-names.txt" - && echo "same failing names as the baseline"
```

Expected: `# tests` 8 more than the baseline's, `# skipped 2`, and `same failing names as the baseline`.

- [ ] **Step 9: Sweep what the branch adds:**

```bash
W=/opt/warboard/.superpowers/sdd/2026-10-27-ffs-mini-hp-icon-row; WT=$W/wt; cd "$WT" && git diff | command grep -E '^\+' > "$W/added.txt"; command grep -oE '(^|[^A-Za-z0-9])[A-Za-z0-9]{16}([^A-Za-z0-9]|$)' "$W/added.txt" | sort | uniq -c; node "$W/sweep-env.mjs" "$W/added.txt" && node "$W/sweep-names.mjs" "$W/added.txt"
```

Expected: two DOM names, nothing secret, then both sweeps clean:

```
      3 .lastElementChild.
      1 .lastElementChild;
      2 .querySelectorAll(
sweep clean (13 values checked)
names sweep clean (187 names and ids checked)
```

The counts in the last two lines move as `.env` and the faction's roster do.

- [ ] **Step 10: Commit.**

```bash
W=/opt/warboard/.superpowers/sdd/2026-10-27-ffs-mini-hp-icon-row; cd "$W/wt" && git commit -q -m "ffs beta 2.73.915: the mini profile's HP sits right after the icons" -m "Under the FF line it ran out of Torn's status box onto whatever was below it. With no room beside the icons for the whole line, it says only the percentage." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- server/ffs-mini-hp.test.mjs server/public/scripts/ffs-banner-estimates-beta.user.js server/public/scripts/ffs-banner-estimates-beta.meta.js && git status --short && git log --format='%h %s' -2 | cat
```

Expected: `?? server/node_modules`, then this commit and the plan's.

## Between Task 1 and Task 2: the final review

As superpowers:executing-plans says: the review package from the branch's merge base with main, and one fresh Opus reviewer given this plan, its Review Focus and the ledger's `Ruling:` lines. Then one fix pass for Critical and Important findings, each test-first, with the HP tests and the whole suite (with `FFS_DIR` set) green after it. Minor findings go to the ledger and the report.

---

### Task 2: Release

- [ ] **Step 1: Pre-flight.** Note pm2's warboard pid; Step 4 checks it is unchanged.

```bash
uptime; W=/opt/warboard/.superpowers/sdd/2026-10-27-ffs-mini-hp-icon-row; WT=$W/wt; command grep -E "^Task 1: complete|^Final" "$W/progress.md"; git -C "$WT" status --short; cd "$WT/server" && node --test ffs-mini-hp.test.mjs > "$W/t.log" 2>&1; command grep -E "^# (tests|pass|fail) " "$W/t.log" | paste -sd" " -; pm2 pid warboard | tee "$W/pid-before"; cd /opt/warboard && git log --format='%h %s' main..ffs-mini-hp-icon-row | cat; git status --short -- server/ffs-mini-hp.test.mjs server/public/scripts/ffs-banner-estimates-beta.user.js server/public/scripts/ffs-banner-estimates-beta.meta.js
```

Expected: the load under 12; Task 1's `complete` line and the final review's lines; `?? server/node_modules`; `# tests 29 # pass 29 # fail 0`; warboard's pid, a number other than 0; Task 1's commit and any fix-pass commits; then nothing, because main's copies of the three paths are clean.

- [ ] **Step 2: Fast-forward main.** The served beta changes the moment the merge lands. Git writes the files as root, so give the served ones back to warboard:

```bash
cd /opt/warboard && git merge -q --ff-only ffs-mini-hp-icon-row && chown warboard:warboard server/public/scripts/ffs-banner-estimates-beta.user.js server/public/scripts/ffs-banner-estimates-beta.meta.js && chmod 644 server/public/scripts/ffs-banner-estimates-beta.user.js server/public/scripts/ffs-banner-estimates-beta.meta.js; git log --format='%h %s' -1 | cat; stat -c '%U:%G %a %n' server/public/scripts/ffs-banner-estimates-beta.user.js server/public/scripts/ffs-banner-estimates-beta.meta.js; git status --short -- server/ffs-mini-hp.test.mjs server/public/scripts/ffs-banner-estimates-beta.user.js server/public/scripts/ffs-banner-estimates-beta.meta.js
```

Expected: the branch's last commit as main's HEAD; both files `warboard:warboard 644`; then nothing. If the merge is refused, main has moved on. Then run `git -C "$W/wt" rebase main`, run Task 1 Steps 5 and 8 again, and repeat this step.

- [ ] **Step 3: The whole suite on main.** This is the gate `deploy.sh` runs, without its reload. A bare run is right here: on main, the chain button's tests read main's beta, which is now 2.73.915.

```bash
uptime; W=/opt/warboard/.superpowers/sdd/2026-10-27-ffs-mini-hp-icon-row; cd /opt/warboard/server && node --test > "$W/main-suite.log" 2>&1; command grep -E "^# (tests|pass|fail|skipped) " "$W/main-suite.log" | paste -sd" " -; command grep -E "^not ok" "$W/main-suite.log" | head
```

Expected: `# fail 0` and `# skipped 2`.

- [ ] **Step 4: Check what is served, and that nothing restarted:**

```bash
W=/opt/warboard/.superpowers/sdd/2026-10-27-ffs-mini-hp-icon-row; F=/opt/warboard/server/public/scripts/ffs-banner-estimates-beta; T=$(date +%s); curl -s "http://127.0.0.1:3000/scripts/ffs-banner-estimates-beta.meta.js?t=$T" | command grep '@version'; curl -s "https://tornwar.com/scripts/ffs-banner-estimates-beta.meta.js?t=$T" | command grep '@version'; curl -s "https://tornwar.com/scripts/ffs-banner-estimates-beta.meta.js" | command grep '@version'; curl -s "https://tornwar.com/scripts/ffs-banner-estimates-beta.user.js?t=$T" | sha256sum | cut -c1-12; sha256sum "$F.user.js" | cut -c1-12; curl -s "https://tornwar.com/scripts/ffs-banner-estimates.meta.js?t=$T" | command grep '@version'; echo "pid before $(cat "$W/pid-before") after $(pm2 pid warboard)"
```

Expected: `// @version      2.73.915` three times. The third is the plain address, which is what Tampermonkey's update check fetches. nginx sends it with `max-age=300`, so if it still says 2.73.914, check it again after 5 minutes, and report only once it says 2.73.915. Then the same 12 hex characters twice; then `// @version      2.73.61`, the stable copy, unchanged; then the same pid before and after.

- [ ] **Step 5: Push.** Sweep the lines this push adds, then push, with the remote's URL masked:

```bash
W=/opt/warboard/.superpowers/sdd/2026-10-27-ffs-mini-hp-icon-row; cd /opt/warboard && git log --format='%h %s' origin/main..main | cat && git diff origin/main..main | command grep -E '^\+' > "$W/added.txt"; command grep -oE '(^|[^A-Za-z0-9])[A-Za-z0-9]{16}([^A-Za-z0-9]|$)' "$W/added.txt" | sort | uniq -c; node "$W/sweep-env.mjs" "$W/added.txt" && node "$W/sweep-names.mjs" "$W/added.txt" && git push -q origin main 2>&1 | sed -E 's#//[^@]*@#//***@#g'; git log --format='%h' -1 origin/main
```

Expected: the plan's commit, Task 1's and any from the fix pass. Then the 16-character words, each with the characters either side of it: `20260917144122id` and `b56930936fb40c33`, from Setup Step 3's Wayback addresses for Torn's stylesheets; `userImageWrapper`, the class the layout check looks up; `lastElementChild` and `querySelectorAll`; and no others. Then both sweeps clean, and the push's own output, which is nothing; then origin/main's tip, the same commit as main's. Any other 16-character word stops the push until it is explained.

- [ ] **Step 6: Clean up.** Copy the ledger and the logs into this session's scratchpad directory, then remove the worktree's `node_modules` link, the worktree, the branch and the workspace:

```bash
W=/opt/warboard/.superpowers/sdd/2026-10-27-ffs-mini-hp-icon-row; S="${SCRATCHPAD:?set SCRATCHPAD to the scratchpad directory}/ffs-mini-hp-icon-row-release"; mkdir -p "$S" && cp -r "$W/progress.md" "$W"/*.log "$W/mutants.mjs" "$W/layout-check.mjs" "$S/" && rm "$W/wt/server/node_modules" && cd /opt/warboard && git worktree remove "$W/wt" && git branch -d ffs-mini-hp-icon-row && rm -r /opt/warboard/.superpowers/sdd/2026-10-27-ffs-mini-hp-icon-row && git worktree list | command grep -c ffs-mini-hp-icon-row
```

(`SCRATCHPAD` is the scratchpad directory the session's system prompt names; unset, the command stops before it does anything.) Expected: `0`.

- [ ] **Step 7: Memory.**
  - `project_ffs_mini_profile_layout.md`: the beta's HP line, `div.ffs-mini-hp`, is now the last child of the card's `.icons > ul`, with its own inline size; `HP <pct>%` when the whole line goes down below the icons, the whole line again when that does too; under the FF line only on a card with no icon row. Owed: the owner's check.
  - `reference_ffs_chain_button.md`: the beta is now 2.73.915, and `ffs-mini-hp.test.mjs` pins 2.73.915. A promote carries the icon row too.
  - `reference_torn_miniprofile_injection.md`: Torn's status box is a fixed 53px and absolutely placed, so text added inside it spills out; the icon row is in normal flow; Torn's own stylesheets can be read from the Wayback Machine's copies without a request to Torn.
  - Edit their MEMORY.md lines in place.

- [ ] **Step 8: Report to the owner,** in a few short lines:
  - Mini profiles in the beta show the HP right after the icons, and `HP <pct>%` when the icons leave no room for the whole line.
  - The URL: https://tornwar.com/scripts/ffs-banner-estimates-beta.user.js.
  - No warboard restart, so the chain was not touched.
  - Ask them to check, on phone and PC:
    - the HP sits right after the icons and lies on nothing below the status box;
    - on a player with many icons (about 8 to 10) it says just the percentage, and with about 11 or 12 it has a row of its own under the icons, which makes the card a line taller, with the buttons still inside the card;
    - it reads in Torn's light mode too.
  - Then the rulings and deferred minors, as superpowers:executing-plans lists them.
