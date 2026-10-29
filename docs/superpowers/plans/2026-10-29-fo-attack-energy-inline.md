# FactionOps 5.6.33: the Attack-Page Energy as a Small Number by Your Name Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the attack page's energy bar (5.6.31-32) with a small `⚡875` right after your name in your own header, so it stops drawing the eye and nothing on the page moves when it appears.

**Architecture:** The reading is unchanged: `energyFollower` over `energyState` (the API reading at page open) and Torn's saved sidebar energy. The pass (`hpPass`) and the 2 s check are unchanged too. Only the text, the CSS and the painter change. A `span#fo-atk-energy` goes after `.user-name` in the green header's name row, not a bar after the header.

**Tech Stack:** the userscript (plain JS); `node:test` with the brace-count lifter; Playwright browser tests (playwright-core from /root/.hermes).

**Spec:** none written. The owner's ask (2026-10-29 16:17 EDT): "can we make the energy bar smaller or move it with it smaller its too distracting someone said". Option A was approved at 16:20 EDT ("lets do A"): "A small ⚡875 right after your name, inside your own header, in the header's text colour. There's no bar, and the headers and weapons don't move." Fallback B (a thin dim line under the header) is not built.

## Builder calls

- C1: `span#fo-atk-energy` is a sibling after your `.user-name` inside `[class*="headerWrapper__"][class*="green__"]`, never a child of it. Other scripts, and FactionOps' Assist, read `.user-name`'s text.
- C2: the text is U+26A1 followed by the energy with en-US commas: `⚡875`, `⚡1,050`. No max and no word "Energy". Source and tests use U+26A1 alone, with no U+FE0F.
- C3: the label counts as placed while it shares the name's parent and comes after the name. Another script's tag between the two is no reason to move it: two scripts that both insist on "right after the name" would trade places forever.
- C4: one CSS block:
  - `display: inline-block`;
  - `margin: 0 auto 0 6px` (the auto right margin keeps it beside the name in a row that pushes its items to the two ends, with the HP at the far end);
  - `flex: 0 99 auto`, `min-width: 0`, `overflow: hidden`, `text-overflow: ellipsis`, `white-space: nowrap` (in a full row it gives way before Torn's name or HP do);
  - `font-size: 0.85em`, `font-weight: 400`, `line-height: 1`, `vertical-align: middle`, `color: inherit`, `font-variant-numeric: tabular-nums`.
- C5: no name in your header means no label, as no header did before.
- Kept as they are:
  - `energyFollower` and `sidebarEnergy` (B4);
  - the 2 s check and pollEnergy's queued pass;
  - the exact-sid rule and the storage try.

  The war banner is out of scope.

## Global Constraints

- 5.6.33 goes in `// @version`, `const SCRIPT_VERSION`, `factionops.meta.js` and the version test in `server/factionops-chain-bar.test.mjs`, all together.
- No new Torn API call, no Torn page request, no new MutationObserver.
- The repo is public: made-up ids, names, class hashes and numbers only (player 1000002, energy 875/150).
- Clear `//` comments in the surrounding style. No version-stamped comments.

## Review Focus

1. **Torn's real name row.** The stand-in guesses a flex row with the name at one end and the HP entries at the other; the real markup's order is name then `textEntries`, but its CSS is not on hand. In a grid or a column the label could take a line of its own and move the page. Check: the owner's live look, with B as the fallback.
2. **A long name or a crowded header.** The label must give way (clipped, with an ellipsis), never wrap and never push the HP. Test: "a crowded header squeezes the number, not your HP".
3. **Other scripts decorating the name.** TornTools writes into the HP entries, not after the name; other scripts are unknown. There must be no position fight. Test: "another script's tag after your name is left alone".
4. **The header is Torn's button.** Tapping the label switches the view, as tapping the name does. That is Torn's own behaviour, and nothing changes it.
5. **Readers of the header's text.** FactionOps' Assist and TornTools read the rose header's `.user-name`. Nothing reads the green header's text, and the label stays out of `.user-name` either way. The life percentage (`HP_RE`) needs " / ", so the label is never tagged.

---

### Task 1: the number by your name

**Files:**
- Modify: `server/public/scripts/factionops.user.js`:
  - `attackEnergyText`; delete `attackEnergyFill`;
  - the `#fo-atk-energy` CSS (three blocks become one);
  - `attackEnergyWant`, `attackEnergyShown`, `paintAttackEnergyBar` → `paintAttackEnergy`;
  - the hpPass log line;
  - the version.
- Modify: `server/public/scripts/factionops.meta.js` (version), `server/factionops-chain-bar.test.mjs` (version test), `server/factionops-attack-energy.test.mjs`.
- Rewrite: `tests/factionops/attack-energy.e2e.test.mjs`.

**Interfaces:**
- `attackEnergyText({ current, max }) -> string`, e.g. `'⚡875'`.
- `attackEnergyWant() -> { name: Element, text: string } | null`, where `name` is the first `.user-name` in your green header.
- `attackEnergyShown(want) -> boolean` uses C3's rule.
- `paintAttackEnergy()` replaces `paintAttackEnergyBar`. Its failure logs `attack energy paint failed: <message>`.

- [ ] **Step 1: unit tests first.**
  - The version test reads 5.6.33.
  - `attackEnergyText({current: 75, max: 150}) === '⚡75'` and `({current: 1050, max: 150}) === '⚡1,050'`.
  - `attackEnergyFill` leaves the lifter's list and its assertions.

  Run: `node --test server/factionops-attack-energy.test.mjs server/factionops-chain-bar.test.mjs`
  Expected: FAIL on the version and on `'Energy 75/150'`.

- [ ] **Step 2: rewrite the browser file.**
  - The stand-in mirrors the phone markup: two headers, each `header` (role=button) > `topWrap` > [`.user-name`, `textEntries`], then the weapon list. `topWrap` is a guessed flex row with its items spread to the ends.
  - `cfg.barsDelay` answers the bars late.
  - The console check looks for `attack energy paint failed`.
  - Tests:
    - the number sits right after your name, in your header only: text `⚡875`, after the name in its parent, 6 px from it, in its row;
    - it follows Torn's saved energy once that changes on the page (900 saved at load, then 850);
    - the number coming in moves nothing: the rose header's top, the weapon's top and your HP entries' box are the same before and after;
    - a crowded header squeezes the number, not your HP: the row is set to name + entries + 10 px, and the entries' box is unchanged;
    - Torn redrawing your header puts the number back after your name: the row redrawn, then a fresh name span put in ahead of the number;
    - another script's tag after your name is left alone: no records on the label or its parent for 5 s;
    - no reading, no number, and nothing fails;
    - a profile page gets no number;
    - an attack log gets no number (the reading is still taken);
    - blocked storage leaves the reading from the page opening standing;
    - a quiet page is not repainted, nor passed over (passes 0);
    - a busy page runs its passes and leaves the number alone.

  Run: `node tests/factionops/attack-energy.e2e.test.mjs`
  Expected: FAIL, with no label. With `FO_SRC` set to the 5.6.32 copy, "moves nothing" shows the bar's 22 px drop.

- [ ] **Step 3: implement C1-C5.**

- [ ] **Step 4: run both files.**
  Expected: all pass.
  Mutants, each run with `FO_ONLY` and expected to fail its test:
  - `attackEnergyShown` always false;
  - an unconditional text write;
  - a strict "next sibling of the name" placement;
  - no auto right margin;
  - no `min-width: 0`.

- [ ] **Step 5: run the other FactionOps browser files one at a time** (attack-banner, assist, assist-toast, chainbar, outdated), then the whole suite (`cd server && npm test`).
  Expected: green, 0 fail.

- [ ] **Step 6: commit** the five files and this plan.

### Task 2: release (standing OK for userscript releases)

Sweep the diff and the messages. Check main hasn't moved, then fast-forward it. Restore the served files' owner and mode. Run the suite on main. Check the sha of disk, local and public copies and the version. Push. No server restart. Clean up the worktree.
