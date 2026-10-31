# OC Spawn 3.2.92 + 3.2.93: the Armoury reads only on a tap, "Loan to…" for everyone, armour by name — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Two releases of OC Spawn's Manager → Armoury tab.
- **3.2.92:** an OC analysis that shows the Armoury again never reads Torn's armoury page, so only a tap does. Weapons' "Loan to…" lists every member again.
- **3.2.93:** the Armour view lists one line per piece name instead of one per piece.

**Architecture:**
- Everything is in `server/public/scripts/oc-spawn-assistance.user.js`.
- The restore fix is a `restore` flag passed from runAnalysis through `switchTab` to `loadManagerTab`.
- "Loan to…" for everyone is `mgr_loanCandidates` losing its holder filter.
- The grouping adds two pure helpers next to `mgr_armourCandidates` and an armour branch in `mgr_renderArmouryList`. Every button keeps meaning one piece through `data-row` (its index in the view's list), so `mgr_onArmouryClick` does not change.

**Tech Stack:** plain browser JavaScript (userscript); `node:test` unit tests (`server/oc-armoury.test.mjs`, which lifts pure functions out of the script); a Playwright browser test (`tests/oc-spawn/armoury.e2e.test.mjs`) that drives the whole script on a stand-in page.

**Spec:** the owner's grill (19:14 EDT 10-30), answered "do all recommended" at 19:42 EDT, plus the ask in the same message: "add back the names to the loan to even if they already have a weapon loaned". There is no separate spec file. The decisions are recorded below.

## Decisions

**The owner's:**
- **Q1, layout:** in Armour, one line per armour name with its body part, "N free of M" and one Loan button. The holders' chips (name · last on · ↩) sit under it. Order stays head, body, legs, hands, feet.
- **Q2, Loan:** the button lends any free piece of that name to whoever is picked in "Loan to…". 3.2.91's rules stay: the pick stays put so a full set can go out, and "Has <piece>" stops a second piece for a part already held.
- **Q3, holder order:** under each name, ex-members first, then whoever has been offline longest.
- **Q4, Weapons:** stay one line per copy.
- **Q5, order:** the Torn-rules fix ships first as 3.2.92, then the grouping as 3.2.93.
- **My call (approved with the rest):** a ranked-war armour piece gets a line of its own, so Loan never lends it in place of a plain one.
- **The names ask:** Weapons' "Loan to…" lists every member again, including holders of a ranked-war copy. This undoes 3.2.90's filter.

**My calls in this plan:**
- **C1. The pick still clears after a weapon loan** (3.2.89), so lending a second weapon takes a deliberate pick. The ask restores names to the list, and a cleared pick removes nobody from it.
- **C2. Armour's "Loan to…" keeps leaving out a full set's holder.** That is a 3.2.91 rule, kept by Q2's yes.
- **C3. Only the Armoury is left alone when an analysis restores the tab.** Missing, Unused, Payouts and Delays still reload after each analysis, as today: they read the Torn API and tornwar, never Torn's pages. Checked in the code: the only page requests are the Armoury reads, and Loan, ↩, the OC-slot loan and the Unused-tab retrieve, which all run on taps.
- **C4. Refresh no longer re-reads the armoury.** It is an OC analysis like the automatic ones. Tapping the Armoury sub-tab, or the Manager tab, still reads it fresh. Side effect: the 3.2.90 mid-loan re-read trap can now only happen on a tap.
- **C5. Search in Armour.** A line shows when the search matches its name, part, rarity or a bonus; then all its holders show. It also shows when the search matches a holder; then only that holder's chips show. The counts always cover the whole line. Searching a member therefore shows what they hold, and "N free of M" stays true.
- **C6. Loan lends the line's first free piece in list order.** 3.2.91's sort puts free pieces first, then by armoury id, and the list is not re-sorted after a loan. With none free, the button is greyed out (as in 3.2.86).
- **C7. Without a member list, chips keep list order** and show no time, as chips do today.

## Global Constraints

- The repo is public. Use made-up names, ids and counts only:
  - members are Alpha 1000001, Bravo 1000002, Charlie 1000003, and Gone 1000009, who has left;
  - armoury ids are 41-49 (unit) and 601-699 (browser).
  - No values from the owner's screenshot, the live armoury or the client log go in the repo.
- Each version goes in four places together:
  - `// @version` and `const SCRIPT_VERSION` in the script;
  - `server/public/scripts/oc-spawn-assistance.meta.js` (the header block plus "\n");
  - the version test in `server/oc-armoury.test.mjs`.
  - A CHANGELOG entry goes at the top of the script's CHANGELOG block, newest first, in its `// v3.2.9x — …` format. No version-stamped inline comments.
- Torn rules: Torn's armoury page is read only on a tap (the Armoury sub-tab, the Manager tab, the Weapons/Armour switch, Loan, ↩). No auto-clicks. One loan or retrieve in flight at a time.
- Comments are clear `//` lines, in the present tense and the script's plain style.
- The browser test runs alone (~60 s), never next to another job. The whole suite (`cd server && npm test`) runs on main after each fast-forward, before the push.

## Review Focus

1. **A restore while a loan or a read is in flight in the Armoury.** The list it lands in is the one left on screen, so the result must still show up there, and nothing is read.
2. **A restore after a first open that failed** (members unreadable, so the tab shows its error and has no list). It must stay as it is, and it must not try the members, then the page.
3. **A search matching both a line and one of its holders.** The whole line and all its chips show, not only that holder's.
4. **A view read again on a tap while an armour loan is in flight.** The new list can show the piece just lent as free. The line's Loan must not send that same piece twice. (This is 3.2.91's deferred minor, and it is now reachable only by a tap.)
5. **A long name, or many holders, on a 375 px phone.** The chips wrap inside the panel, there is no sideways scroll, and ↩ stays at least 28 px.

Lines 1 and 2 are pinned in Task 1, line 3 in Task 4's search test, and line 5 in Task 4's phone test. Line 4 is a deliberate check for the reviewer, with no test (the trap needs a slow loan, a tap mid-flight and a stale read).

---

### Task 1: An analysis that shows the Armoury again reads nothing

**Files:**
- Modify: `server/public/scripts/oc-spawn-assistance.user.js`: `switchTab` (~4142), `loadManagerTab` (~7304), and the restore at the end of `runAnalysis` (~8144).
- Test: `tests/oc-spawn/armoury.e2e.test.mjs`: the `preamble` gains `cfg.admin`, plus two new tests placed after the `readTypes` helper.

**Interfaces:**
- Produces: `switchTab(name, restore = false)` and `loadManagerTab(restore = false)`. runAnalysis calls `switchTab(tab, true)`. Every other caller (tab taps, the settings gear) is unchanged.

- [ ] **Step 1: Write the failing tests**

In the `preamble`, with `cfg.admin` set, answer `https://tornwar.com/api/oc/spawn-key` with `{ viewer: { playerId: 1000001, playerName: "Alpha", position: "Leader", hasFactionAccess: true } }`. Settings already answer `isAdmin: true`, so the analysis's own restore runs: the stand-in's `oc_last_tab` is "manager". If the analysis then fails, add the fewest fields to that answer that let it reach "Last updated".

```js
// Refresh ignores a tap within 3 s of the page's own analysis.
const refresh = async (p) => {
  await p.waitForTimeout(3100);
  await p.evaluate(() => { document.getElementById("oc-spawn-status").textContent = ""; });
  await p.click("#oc-spawn-refresh");
  await p.waitForFunction(() => /Last updated/.test(document.getElementById("oc-spawn-status")?.textContent || ""), null, { timeout: 15000 });
};

await t("an analysis that shows the Armoury again reads nothing and leaves it as it was; tapping the Manager tab reads it", async () => {
  const { ctx, p, posts } = await open({ admin: true });
  await p.evaluate(() => { document.getElementById("mgr-arm-list").dataset.mark = "1"; });
  await refresh(p);
  const shown = await p.evaluate(() => getComputedStyle(document.getElementById("oc-tab-manager")).display !== "none");
  const kept = await p.evaluate(() => document.getElementById("mgr-arm-list")?.dataset.mark || "");
  const quiet = readTypes(posts);
  await p.click("#oc-manager-tab");
  await p.waitForSelector("#mgr-arm-list .mgr-arm-row", { timeout: 15000 });
  const tapped = readTypes(posts);
  await ctx.close();
  assert.ok(shown);
  assert.strictEqual(kept, "1");
  assert.deepStrictEqual(quiet, ["weapons"]);
  assert.deepStrictEqual(tapped, ["weapons", "weapons"]);
});

await t("an analysis after a first open that could not read the members leaves the error and reads nothing", async () => {
  const { ctx, p, posts, calls } = await open({ admin: true, membersSeq: [() => ({ httpStatus: 500 })], wait: ".oc-error" });
  const before = calls.members;
  await refresh(p);
  const text = await p.textContent("#mgr-sub-content");
  await ctx.close();
  assert.ok(/Couldn't read the armoury/.test(text), text);
  assert.strictEqual(calls.members, before);
  assert.deepStrictEqual(readTypes(posts), []);
});
```

The second test's "no members call" assertion assumes the analysis itself does not read `/v2/faction/members` through `fetch`. If it does, assert only on `readTypes(posts)` and the error text, and ledger the ruling.

- [ ] **Step 2: Run them to see them fail**

Run: `cd /opt/warboard/.superpowers/sdd/2026-10-31-oc-spawn-armoury-groups/wt && node tests/oc-spawn/armoury.e2e.test.mjs 2>&1 | tail -n 8`
Expected: both new tests FAIL: `quiet` is `["weapons", "weapons"]`, and the second test reads the page or the members again. Every other test is ok.

- [ ] **Step 3: Implement the `restore` flag**

- `switchTab(name, restore = false)` calls `loadManagerTab(restore)`.
- `loadManagerTab(restore = false)` builds the bar as today, then returns before `loadManagerSubTab` when `restore && mgr_currentSubTab === 'armoury'`. This does not depend on what the tab shows: a failed first open must not retry on a restore.
- runAnalysis's restore becomes `switchTab(validTabs.includes(lastTab) ? lastTab : 'admin', true)`. Its `switchTab('profile')` branch stays as it is.
- Add a comment at the early return: an analysis that shows this tab again leaves the Armoury as it is, because Torn's armoury page is read only on a tap (the sub-tab, the Manager tab, the Weapons/Armour switch, Loan, ↩). The other sub-tabs read the API and tornwar, and load again.

- [ ] **Step 4: Run the browser test to see it pass**

Run: the Step 2 command.
Expected: `N passed, 0 failed`.

- [ ] **Step 5: Commit**

```bash
git add tests/oc-spawn/armoury.e2e.test.mjs server/public/scripts/oc-spawn-assistance.user.js
git commit -m "OC Spawn: an analysis that shows the Armoury again reads nothing"
```

### Task 2: Weapons' "Loan to…" offers every member again

**Files:**
- Modify: `server/public/scripts/oc-spawn-assistance.user.js`:
  - `mgr_loanCandidates` (~7178) and its caller in `mgr_renderArmouryPicker`;
  - the Armoury comment block (~6955: "Loan to" for Weapons);
  - the comment after a loan in `mgr_onArmouryClick` ("Whoever now holds a weapon … leaves Loan to").
- Test: `server/oc-armoury.test.mjs` (the three `Loan to` tests at ~162-177) and `tests/oc-spawn/armoury.e2e.test.mjs`.

**Interfaces:**
- Produces: `mgr_loanCandidates(nameMap) -> Array<[id: string, name: string]>`: every member the tab loaded, by name.

- [ ] **Step 1: Write the failing tests**

Unit: replace the three `Loan to` tests with:

```js
test('Loan to offers every member, holders of a copy too, by name', () => {
  const copies = [{ armoryID: 12, holder: null }, { armoryID: 13, holder: { id: '1000002', name: 'Bravo' } }];
  assert.deepEqual(offered()(NAMES, copies), [['1000001', 'Alpha'], ['1000002', 'Bravo'], ['1000003', 'Charlie']]);
});
```

Browser: these tests change, and every other weapons test stays as it is:
- "a member who already holds a ranked-war copy is not offered in Loan to" becomes **"a member who already holds a ranked-war copy is offered in Loan to"**: names `["Loan to…", "Alpha", "Bravo", "Charlie"]`.
- "whoever is lent a copy drops out of Loan to, …" becomes **"whoever is lent a copy stays in Loan to, with the pick back on Loan to…"**:
  - `lent` and `returned` are both `["Loan to…", "Alpha", "Bravo", "Charlie"]`;
  - add `assert.strictEqual(await picked(p), "Loan to…")` right after the loan lands.
- "a tab read again while a loan is on its way …" becomes **"a tab read again while a loan is on its way shows the copy lent and clears the pick"**:
  - `names` becomes `["Loan to…", "Alpha", "Bravo", "Charlie"]`;
  - the pick-clear, label and actions assertions stay.
- "a pick whose member holds a copy by the time the tab is read again is dropped, …" becomes **"a member who holds a copy by the time the tab is read again stays picked, and Loan lends them another"**. This one pins the owner's ask:
  - `names` is `["Loan to…", "Alpha", "Bravo", "Charlie"]`;
  - `await picked(p)` is `"Alpha"`;
  - clicking `.mgr-arm-loan[data-row="1"]` (with `accept: ["Primary"]`) sends `["loan 505 Primary Alpha [1000001]"]`.
- "Armour's Loan to leaves out a full set's holder; Weapons' Loan to does not count armour": `weapons` becomes `["Loan to…", "Alpha", "Bravo", "Charlie"]`.

- [ ] **Step 2: Run them to see them fail**

Run: `cd /opt/warboard/.superpowers/sdd/2026-10-31-oc-spawn-armoury-groups/wt && OC_SRC=$PWD/server/public/scripts/oc-spawn-assistance.user.js node --test server/oc-armoury.test.mjs 2>&1 | tail -n 12; node tests/oc-spawn/armoury.e2e.test.mjs 2>&1 | tail -n 12`
Expected: the unit test FAILs (Bravo is left out), and the five changed browser tests FAIL.

- [ ] **Step 3: Implement**

- `mgr_loanCandidates(nameMap)` returns every entry, sorted by name with `localeCompare`.
- `mgr_renderArmouryPicker` passes only `mgr_memberNameMap` for Weapons.
- Rewrite the two comments to say what the code does now:
  - Weapons' "Loan to" offers every member, and the pick goes back to "Loan to…" after a loan, so a second weapon takes a fresh pick;
  - a full set's holder leaves Armour's "Loan to", and whoever gave a piece back is offered again.

- [ ] **Step 4: Run them to see them pass**

Run: the Step 2 command.
Expected: unit all pass; browser `N passed, 0 failed`.

- [ ] **Step 5: Commit**

```bash
git add server/oc-armoury.test.mjs tests/oc-spawn/armoury.e2e.test.mjs server/public/scripts/oc-spawn-assistance.user.js
git commit -m "OC Spawn: Weapons' Loan to offers every member again"
```

### Task 3: Review and release 3.2.92

**Files:**
- Modify: the script (version, CHANGELOG), `server/public/scripts/oc-spawn-assistance.meta.js`, and `server/oc-armoury.test.mjs` (the version test).

- [ ] **Step 1: The version test fails first.** Change it to `'3.2.92 in both places, and the meta file is the header'` with `3\.2\.92` in both patterns. Run the unit file and expect that one test to FAIL.
- [ ] **Step 2: Bump.**
  - Set `@version` and `SCRIPT_VERSION` to 3.2.92, and the meta.js to the new header.
  - Add the CHANGELOG entry: the Armoury no longer reads Torn's armoury page again when an OC analysis (automatic, or Refresh) shows it again, and only a tap in the Armoury reads it, as Torn's rules ask; Weapons' "Loan to…" lists every member again, holders included, and the pick still goes back to "Loan to…" after each loan.
  - Run the unit file and the browser test (alone). Expect all pass. Commit `OC Spawn 3.2.92: the Armoury reads only on a tap; Loan to offers everyone`.
- [ ] **Step 3: Review.**
  - Run `review-package` for the range from bab90f2b to HEAD.
  - Dispatch one reviewer on model `opus` with superpowers:requesting-code-review's `code-reviewer.md`, this plan, Review Focus lines 1-2, and C1, C3 and C4.
  - Re-grade by effect. Fix Critical and Important findings in one TDD pass, with the test failing first and the browser test plus unit file green after. Ledger the minors.
- [ ] **Step 4: Release (standing OK).**
  - `git -C /opt/warboard merge --ff-only oc-spawn-armoury-groups`.
  - `chown warboard:warboard` and `chmod 644` on the two served files.
  - Check the served shas, `https://tornwar.com/scripts/oc-spawn-assistance.user.js` and `.meta.js`, plain and `?v=<time>`, against disk.
  - Run `cd /opt/warboard/server && npm test` on main and expect 0 fail.
  - Sweep the diff, the added lines and the commit messages with `/root/sweeps/sweep-env.mjs` and `sweep-names.mjs`.
  - Push, masking the output with `sed -E 's#//[^@]*@#//***@#g'`.
  - No pm2 reload (client-only).
  - Update memory: `reference_oc_spawn_armoury_tab.md`, and close `project_oc_spawn_armoury_no_tap_reads.md`.

### Task 4: Armour lists one line per piece name

**Files:**
- Modify: `server/public/scripts/oc-spawn-assistance.user.js`:
  - add `mgr_armourGroups` and `mgr_holderOrder` after `mgr_armourCandidates` (~2318);
  - add the armour branch of `mgr_renderArmouryList` (~7205);
  - CSS near `.mgr-arm-chip` (~3434);
  - update the Armoury comment block (~6955).
- Test: `server/oc-armoury.test.mjs` (two new tests) and `tests/oc-spawn/armoury.e2e.test.mjs` (the Armour section).

**Interfaces:**
- Consumes: `mgr_armourPieces(rows)` (sorted by part, name, free first, armoryID), `mgr_holderSeen`, `mgr_armouryMatches`, and `mgr_memberLastAction` (a Map from id to last_action).
- Produces:
  - `mgr_armourGroups(pieces) -> Array<{ key: string, name: string, part: string, rarity: string, bonuses: string[], rows: number[] }>`.
    - Groups come in order of first appearance in `pieces`.
    - `key` is the name for a plain piece, and `'rw:' + armoryID` for a piece with a rarity.
    - `rows` are the pieces' indices in `pieces`, in list order.
  - `mgr_holderOrder(pieces, rows, membersMap) -> number[]`: the indices in `rows` whose piece has a holder.
    - A holder missing from a non-empty `membersMap` comes first; then by `last_action.timestamp`, oldest first; a holder with no timestamp comes last.
    - Ties, and a null or empty map, keep list order.

- [ ] **Step 1: Write the failing unit tests**

```js
test('armour lists one line per piece name in list order; a ranked-war piece is a line of its own', () => {
  const pieces = A().mgr_armourPieces(ARMOUR);
  const g = lift('mgr_armourGroups')(pieces);
  assert.deepEqual(g.map((x) => [x.key, x.part, x.rows.map((i) => pieces[i].armoryID)]), [
    ['Combat Helmet', 'head', [33, 32]], ['Bulletproof Vest', 'body', [38]], ['rw:35', 'body', [35]],
    ['Combat Pants', 'legs', [36]], ['Combat Gloves', 'hands', [39]], ['Combat Boots', 'feet', [31]], ['Hazmat Suit', '', [34]],
  ]);
  assert.deepEqual(g[2].bonuses, pieces[g[2].rows[0]].bonuses);
});

test('holders under a line: ex-members first, then longest offline, then no time; no member list keeps list order', () => {
  const order = lift('mgr_holderOrder');
  const held = (armoryID, id, name) => ({ armoryID, holder: id ? { id, name } : null });
  const pieces = [held(41, '1000001', 'Alpha'), held(42), held(43, '1000009', 'Gone'), held(44, '1000003', 'Charlie'), held(45, '1000002', 'Bravo'), held(46, '1000004', 'Delta')];
  const seen = new Map([['1000001', { status: 'Online', timestamp: 1000 }], ['1000002', { status: 'Idle', timestamp: 500 }],
    ['1000003', { status: 'Offline', timestamp: 100 }], ['1000004', { status: 'Offline' }]]);
  const ids = (m) => order(pieces, [0, 1, 2, 3, 4, 5], m).map((i) => pieces[i].armoryID);
  assert.deepEqual(ids(seen), [43, 44, 45, 41, 46]);
  assert.deepEqual(ids(null), [41, 43, 44, 45, 46]);
  assert.deepEqual(ids(new Map()), [41, 43, 44, 45, 46]);
});
```

The expected order in the first test follows `mgr_armourPieces`' sort of the unit `ARMOUR` fixture. If the run shows a different order that the sort explains, correct the expectation and ledger it. Never correct it toward the helper.

- [ ] **Step 2: Rewrite the browser Armour tests to the grouped shape**

- Replace the `pieces` helper with a `lines` helper:

  ```js
  const lines = (p) => p.$$eval("#mgr-arm-list .mgr-arm-row", (els) => els.map((e) => [e.querySelector(".mgr-arm-name").textContent,
    e.querySelector(".mgr-arm-type").textContent, e.querySelector(".mgr-arm-count")?.textContent || "", [...e.querySelectorAll(".mgr-arm-who")].map((w) => w.textContent)]));
  ```

  Add `countIs(p, name, text)`, which waits until the line named `name` reads `text`.
- In the default `ARMOUR`, data-row 0 is 603 (the helmet line's first free piece), 5 is 607 (gloves) and 1 is 602 (Bravo's helmet). That still holds, so the Loan and ↩ selectors keep working.
- The rewritten and new tests:
  - **"the Armour switch lists one line per piece name, head to feet, with how many are free and who holds the rest"**
    - `lines` is:
      - `["Combat Helmet","Head","1 free of 3",["Charlie","Bravo"]]`
      - `["Combat Vest","Body","0 free of 1",["Bravo"]]`
      - `["Combat Pants","Legs","0 free of 1",["Bravo"]]`
      - `["Combat Gloves","Hands","1 free of 2",["Bravo"]]`
      - `["Combat Boots","Feet","1 free of 2",["Bravo"]]`
    - The heading is `"Armour · 9 · 3 free"`. The read types and the armour log assertions stay.
  - "armour is asked as armour first, then armor, …" and "an answer of another tab's rows is not armour": `got.length` becomes 5.
  - **"Loan in Armour lends the first free piece of that name as Defensive, and the pick stays for the next piece"**
    - Pick Alpha. Loan on the helmet line, then wait for `countIs(p, "Combat Helmet", "0 free of 3")`. Loan on the gloves line, then wait for `"0 free of 2"`.
    - The actions are `["loan 603 Defensive Alpha [1000001]", "loan 607 Defensive Alpha [1000001]"]`, and the pick is `"1000001"` both times.
  - "a second piece for a body part the member holds is refused by name, and nothing is sent": unchanged.
  - **"the search in Armour finds a piece name, a body part or a holder; a holder's search shows only their pieces"**
    - The line counts for `gloves`, `feet` and `charlie` are `[1, 1, 1]`.
    - On `charlie`, `lines` is `[["Combat Helmet","Head","1 free of 3",["Charlie"]]]`. On `helmet`, the chips are `["Charlie","Bravo"]`.
  - **"↩ in Armour takes that piece back as Defensive"**
    - Click `.mgr-arm-back[data-row="1"]` twice, then wait for `countIs(p, "Combat Helmet", "2 free of 3")`.
    - The actions are `["retrieve 602 Defensive Bravo [1000002]"]`.
  - New, **"holders under a line are listed ex-members first, then longest offline first; a line with none free greys out its Loan"**
    - Armour pages: helmets 621 (Bravo), 622 (Gone, 1000009), 623 (Alpha) and 624 (Charlie).
    - `lines` is `[["Combat Helmet","Head","0 free of 4",["Gone","Charlie","Bravo","Alpha"]]]`, and its `.mgr-arm-loan` is disabled.
  - New, **"a ranked-war piece has a line of its own, and Loan on the plain line never lends it"**
    - Armour pages: Flexible Body Armor 631 (plain), 632 (glowClass `glow-yellow`, bonus Impregnable "12% reduced melee damage") and 633 (plain).
    - The lines are the plain one, `"2 free of 2"`, then the ranked-war one, `"1 free of 1"`, which has a `.mgr-arm-dot` and text including "Impregnable".
    - Pick Alpha and Loan on the plain line, then pick Charlie and Loan on the plain line again. The actions are `["loan 631 Defensive Alpha [1000001]", "loan 633 Defensive Charlie [1000003]"]`, and the ranked-war line still reads `"1 free of 1"`.
  - New, **"on a phone the Armour lines and their holders fit the panel"**
    - `open({ width: 375 })`, then the Armour view.
    - `#mgr-arm-list` has `scrollWidth - clientWidth <= 0`, and the first `.mgr-arm-back` is at least 28 × 28.
- The other Armour tests (switching views, full set, loans landing after a switch) keep their assertions. Their `data-row` and row-index use still points at the same pieces and lines.

- [ ] **Step 3: Run both to see them fail**

Run: `cd /opt/warboard/.superpowers/sdd/2026-10-31-oc-spawn-armoury-groups/wt && OC_SRC=$PWD/server/public/scripts/oc-spawn-assistance.user.js node --test server/oc-armoury.test.mjs 2>&1 | tail -n 12; node tests/oc-spawn/armoury.e2e.test.mjs 2>&1 | tail -n 16`
Expected: the two unit tests FAIL ("mgr_armourGroups not found"), the rewritten and new Armour tests FAIL, and every Weapons test passes.

- [ ] **Step 4: Implement the helpers and the armour branch of `mgr_renderArmouryList`**

Weapons keep their current rows exactly. For Armour, the count line is unchanged. Then, per group:
- `whole` = `mgr_armouryMatches({ ...first piece, holder: null }, query)`.
- `held` = `mgr_holderOrder(v.list, g.rows, mgr_membersLoaded ? mgr_memberLastAction : null)`, filtered to `whole || mgr_armouryMatches(v.list[i], query)`.
- Skip the group when `!whole && !held.length`. With nothing shown, keep "Nothing matches.".
- The `.mgr-arm-row` line holds:
  - a `.mgr-arm-main` with the rarity dot (ranked-war only), `.mgr-arm-name`, `.mgr-arm-type` (the part label), `.mgr-arm-count` ("N free of M" over all of `g.rows`), and a Loan button (`mgr-action-btn mgr-btn-loan mgr-arm-loan`);
  - the Loan's `data-row` is the first free index (the first index when none is free). It is disabled when none is free or an action is in flight, and shows "…" while its own loan (`busy.loan`, `g.rows` holding `busy.row`) is in flight;
  - for a ranked-war group, a `.mgr-arm-bonus` line with its bonuses;
  - when `held` is not empty, a `.mgr-arm-borrowers` holding today's chip markup per index (who, seen, ↩ with `data-row` = that index, "…" while it is the retrieve in flight).

CSS:
- `.mgr-arm-count { font-size: 11px; color: #9ca3af; white-space: nowrap; }`
- `.mgr-arm-main .mgr-action-btn { width: auto; margin: 0; padding: 3px 10px; }`
- `.mgr-arm-borrowers { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 4px; }`
- `.mgr-arm-borrowers .mgr-arm-chip { max-width: 100%; }`

Update the Armoury comment block's Armour lines to describe the lines, Loan and chips.

- [ ] **Step 5: Run both to see them pass**

Run: the Step 3 command.
Expected: unit all pass; browser `N passed, 0 failed`.

- [ ] **Step 6: Commit**

```bash
git add server/oc-armoury.test.mjs tests/oc-spawn/armoury.e2e.test.mjs server/public/scripts/oc-spawn-assistance.user.js
git commit -m "OC Spawn: Armour lists one line per piece name"
```

### Task 5: Review and release 3.2.93

- [ ] **Step 1: The version test fails first.** Change it to 3.2.93 and run it. Expect FAIL.
- [ ] **Step 2: Bump.**
  - `@version`, `SCRIPT_VERSION` and meta.js become 3.2.93.
  - The CHANGELOG entry: Armour lists one line per piece name with its body part, how many are free and one Loan that lends a free one, with who holds the rest under it (anyone who left first, then whoever has been offline longest); a ranked-war piece keeps a line of its own; Weapons are unchanged.
  - Run the unit file and the browser test. Expect all pass. Commit `OC Spawn 3.2.93: armour by piece name`.
- [ ] **Step 3: Final review.**
  - Run `review-package` from the 3.2.92 release commit to HEAD.
  - One reviewer on model `opus`, given this plan, Review Focus lines 3-5, and C5-C7.
  - One TDD fix pass for Critical and Important findings. Ledger the minors.
- [ ] **Step 4: Release.**
  - As Task 3 Step 4.
  - Then remove the worktree (unlink `server/node_modules` first, no trailing slash), the branch and this plan's workspace, after copying the ledger to the scratchpad.
  - Update memory. Report to the owner with the served URL and version first, then the rulings and the deferred minors.
