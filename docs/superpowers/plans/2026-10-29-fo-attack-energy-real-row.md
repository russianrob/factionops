# FactionOps 5.6.34: the Energy Number on Torn's Own Name Row Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make 5.6.33's `⚡875` actually show on Torn's own name row. Hide it rather than cut it when there is no room. Send the no-room report once per version, as it was meant to be.

**Architecture:**
- On Torn's row your name grows to fill the header, so any width the number takes comes out of the name's box. That box is invisible, but the 5.6.33 guard holds every box, so it pulls the number on every phone. Even unguarded, the number would sit mid-header, not after the name.
- A CSS rule stops the name growing while the number follows it.
- The guard holds the name's words, not its box.
- A number that would be cut is taken out like one that would move something.
- The report's "sent" flag takes any 2xx: the server answers client-log with 204.

**Tech Stack:** the userscript (plain JS); `node:test`; Playwright browser tests (playwright-core from /root/.hermes).

**Spec:** none written. The owner approved in chat on 2026-10-29 at 18:32 EDT ("yes", then "build and ship"). The approved behaviour:
- the ⚡ sits 6 px after your name, and nothing you can see moves;
- when there is no room it is hidden, not cut short ("⚡8…" could read as 8);
- the report counts as sent on any success code.

## Builder calls

- C1: the rule `[class*="headerWrapper__"][class*="green__"] .user-name:has(~ #fo-atk-energy) { flex-grow: 0 !important; }`.
  - It's a rule of its own: a browser without `:has()` drops just that rule.
  - `~`, not `+`: another script's tag between the name and the number must not undo it.
  - `!important` beats an inline style on Torn's name.
  - It cleans itself up: the number out means the name grows again. It also follows a name Torn draws afresh.
- C2: `attackEnergyRowShape(row, label, name)` changes for the name only. It pushes the name's text rect (a Range over its contents: left, top, width, height) in place of its box, plus `name.scrollWidth - name.clientWidth > 1 ? 1 : 0` (a name made to overflow). Every other child keeps its box; the header's and the row's heights stay.
- C3: after the number goes in, it counts as cut when `label.scrollWidth > label.clientWidth`. A cut number is handled like a moved row: taken out, `atkEnergyNoRoom = row`, reported.
  - From the final review: the cut check also runs once the number is up (in each pass and in the 2 s look), so a row that tightens later takes it down. A name that still grows with the number in (a flex row, computed `flex-grow` above 0: a browser without `:has()`) is handled the same way, with `why: 'grows'`.
  - `reportAttackEnergyNoRoom(row, name, why)` takes `why` as `'grows'`, `'moved'` or `'cut'`. It goes in the data as `why` and in the console line: `attack energy: no room in your header (<why>), row <display>`.
- C4: the sent flag is set when `res.status >= 200 && res.status < 300`.
- C5: `text-overflow: ellipsis` leaves the `#fo-atk-energy` block, since a cut number is never shown. Its comment says so.
- Kept as they are: the reading, the 2 s check, the pass, the placement rule, the colour and the gap margin.

## Global Constraints

- 5.6.34 goes in `// @version`, `const SCRIPT_VERSION`, `factionops.meta.js` and the version test in `server/factionops-chain-bar.test.mjs`, all together.
- No new Torn API call, no Torn page request, no new MutationObserver.
- The repo is public: made-up ids, names, class hashes and numbers only (player 1000002, energy 875/150). No counts from the server log.
- Clear `//` comments in the surrounding style. No version-stamped comments.

## Review Focus

1. **WebKit (iOS PDA).** Only Chromium is on hand. The `:has()` rule must take effect between the insert and the second measure, Range rects must agree, and `scrollWidth`/`clientWidth` rounding must not read a fitting number as cut. If any of that fails there, PDA shows no ⚡ and the report says why. Check: the owner's live look, plus the client log's `why`.
2. **Desktop's row.** No desktop report yet. If its row is the stand-in's spread row, nothing changes. If it's a row this plan doesn't know, the guard still holds.
3. **A name centred in its grown box.** Its words would move when it stops growing, so it must get no number. Test: "a name centred in its row gets no number, and nothing moves".
4. **The number growing longer** (875 → 1,050) in a row that only fits the shorter one. It is hidden until Torn draws the row again, which a new attack page does. This is accepted, not tested.
5. **The report once per version.** The real server answers 204, so the test stub must answer 204 too. The grid test's redraw is the check.

---

### Task 1: the number on Torn's row

**Files:**
- Modify: `server/public/scripts/factionops.user.js`:
  - the `#fo-atk-energy` CSS block and its comment (~1900);
  - the new C1 rule after it;
  - `attackEnergyRowShape`, `reportAttackEnergyNoRoom` and `paintAttackEnergy` (~14336-14410);
  - the version.
- Modify: `server/public/scripts/factionops.meta.js` (version), `server/factionops-chain-bar.test.mjs` (version test).
- Modify: `tests/factionops/attack-energy.e2e.test.mjs`.

**Interfaces:**
- `attackEnergyRowShape(row, label, name) -> number[]`
- `reportAttackEnergyNoRoom(row, name, why: 'grows'|'moved'|'cut') -> void`
- `paintAttackEnergy()` keeps its name and its early returns.

- [ ] **Step 1: tests first.**
  - The version test reads 5.6.34.
  - In the browser file's stub, `/api/debug/client-log` answers status 204 with an empty body, as the server does.
  - `layout()` gives your name as its words' rect (a Range over `.user-name`), not its box: members see the words, not the box.
  - New `REAL_ROW = "display:flex;justify-content:flex-start"` and `GROWS = ";flex:1 1 auto"` (a name that grows to fill the row).
  - New tests:
    - "Torn's own row, where your name grows to fill it, has the number 6 px from your name". `open(ATTACK, { rowCss: REAL_ROW, nameCss: GROWS })`, then `until(⚡875)`, then `label(p)` deep-equals `SHOWN`.
    - "the number coming into Torn's own row moves nothing". barsDelay 4000; layout before, appears, layout after; deep-equal.
    - "a name centred in its row gets no number, and nothing moves". nameCss `GROWS + ";text-align:center"`. Reported with `why: 'moved'`; no number; layout unchanged.
  - Changed tests:
    - "a crowded header squeezes the number, not your HP" becomes "a crowded header shows no number rather than a cut one, and nothing moves": squeeze 4, no number, layout unchanged, reported with `why: 'cut'`.
    - "a row with its own gap, short of room, still moves nothing" expects no number and layout unchanged.
    - The grid test's `sentNow.length === 1` stays; with the 204 stub it becomes the once-per-version check. It also asserts `sentNow[0].why === 'moved'`.

  Run: `node --test server/factionops-chain-bar.test.mjs && node tests/factionops/attack-energy.e2e.test.mjs`
  Expected: FAIL on the version, both real-row tests (no number), the crowded test and the gapped-tight test (a number shown), and the grid test (two reports, no `why`). The centred-name test may pass or fail on the old code; record which.

- [ ] **Step 2: implement C1-C5 and the version.**

- [ ] **Step 3: run both files.** Expected: all pass. Mutants, each run with `FO_ONLY` and each expected to fail its test:
  - no C1 rule;
  - C2 back to the name's box;
  - the name left out of the shape;
  - no cut check;
  - `=== 200` instead of 2xx;
  - `+` instead of `~` (the other-script's-tag test, on the real row: add that case if no test fails).

- [ ] **Step 4: the other FactionOps browser files one at a time** (attack-banner, assist, assist-toast, chainbar, outdated), then `cd server && npm test`. Expected: green, apart from the worktree's known environmental failures (server/.env, rwp-price data, war-history-dedupe), which the suite on main must not show.

- [ ] **Step 5: commit** the five files and this plan.

### Task 2: release (standing OK; the owner's "build and ship")

- Sweep the diff and the message.
- Check main hasn't moved, then fast-forward it.
- Restore the served files' owner (warboard:warboard) and mode 644.
- Run the suite on main.
- Check the disk, local and public shas and the version.
- Push. No server restart. Clean up the worktree.
