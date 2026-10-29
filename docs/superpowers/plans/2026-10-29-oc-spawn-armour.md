# OC Spawn 3.2.91: armour in the Armoury tab — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** OC Spawn's Manager → Armoury tab gets a Weapons | Armour switch. The Armour view lists every armour piece in the faction armoury, and a set can be lent out quickly. The Weapons view stays exactly as it is.

**Architecture:**
- Everything lives in `server/public/scripts/oc-spawn-assistance.user.js`.
- New pure helpers sit next to `mgr_rwCopies`. They read armour rows, give each piece its body part, and decide who "Loan to…" offers and which loans are refused. They are unit-tested by lifting them out of the script.
- The tab code (~6876-7100) keeps one state object per view: its list, its pick and its search. A tap is bound to the view it was made in, so a loan that lands after a switch updates its own view.
- The armour rows come from the armoury page (`step=armouryTabContent`). Torn's category spelling for armour has never been confirmed, so both spellings are tried.

**Tech Stack:** plain browser JavaScript (userscript); `node:test` unit tests; a Playwright browser test driving the whole script on a stand-in page.

**Spec:** the owner's grill, approved at 00:30 EDT 10-29 ("do all recommended"), recorded under Decisions below. There is no separate spec file.

## Decisions

**The owner's** (verbatim from the grill):
- **Q1:** A Weapons | Armour switch at the top of the Armoury tab. Each view has its own list, its own count line ("Armour · N · M free") and its own "Loan to…".
- **Q2 (the Armour view):**
  - "Loan to…" offers every member except those who already hold all five parts (helmet, body, pants, gloves, boots).
  - The pick STAYS after each loan.
  - A second piece for the same body part is refused with a short message. The body part is read from the name: Helmet → head, Vest/Body Armor → body, Pants → legs, Gloves → hands, Boots → feet.
  - The Weapons view is unchanged: RW only, weapon holders left out, the pick cleared after a loan. Armour doesn't count there.
- **Q3:** Ship as soon as it is built and reviewed, before the 13:00 EDT war. Script only, no server restart.

**Accepted builder calls** (from the grill):
- Armour sorted by piece, free copies first.
- The search covers armour.
- Both page spellings are tried, `armour` then `armor`. Loan types go `Defensive` then `Armor`, via `mgr_armouryPostTypes('armor', type)`. Which one Torn accepted is logged with the client-log tag `oc-armoury`.
- Version 3.2.91, with a CHANGELOG entry.

**My calls in this plan** (to show the owner):
- **C1. More keywords for each part:**
  - head also matches `mask` and `respirator`;
  - body also matches the word `body`, `apron` and `mail`.

  So Riot Body, Gas Mask, EOD Apron and Chain Mail get a part. A name matching none of the keywords gets part `''`. Such a piece is listed (last), lendable and never refused, and it never counts toward a full set.
- **C2. "By piece" means loadout order.** Head, body, legs, hands, feet, then unknown parts. Within a part, by name; free pieces before held ones; then by armoury id. After a loan the list is not re-sorted, so rows don't jump under a finger.
- **C3. The refusal names the piece already held:** "Has Combat Helmet", shown on the button for 2 s.
- **C4. Each view keeps its own search text.** The armour placeholder is "Search piece, part or member".
- **C5. A view is read the first time it is shown after the tab opens.** Armour is read only if Armour is opened.
- **C6. A row counts as armour** if its type is Defensive/Armor/Armour, or if its name maps to a part. Any other row is dropped. This guards against an unknown category answering with another tab's rows (weapons, medical…).

## Global Constraints

- The repo is public. Use made-up names, ids and counts only:
  - members are Alpha 1000001, Bravo 1000002, Charlie 1000003;
  - armoury ids are 31-40 (unit) and 601-699 (browser);
  - item ids are made up.
  - No live armour counts, no member ids, no values from the live probe or the client log.
- Version 3.2.91 goes in three places together: `// @version`, `const SCRIPT_VERSION` (line 441) and `server/public/scripts/oc-spawn-assistance.meta.js` (the header only).
  - The CHANGELOG entry goes at the top of the script's `// CHANGELOG` block, newest first, in its `// v3.2.91 — …` format.
  - No version-stamped inline comments.
- Torn rules:
  - armoury page requests only on a user's action (opening the tab or a view, tapping Loan or ↩);
  - no auto-clicks;
  - one loan or retrieve in flight at a time, across both views.
- Comments are clear `//` lines in the script's plain style.
- The browser test is heavy. Never run it alongside another job.
- Script only: no server change, no pm2 reload.
- Every existing browser check keeps passing. The one exception is the first test's "no armour" text check, which is rewritten in Task 2.

## Review Focus

1. **An unknown category's answer.** If a spelling Torn doesn't know answers with an error, HTML, nothing, or another tab's rows, it is never shown as armour, and the next spelling is tried.
   - Test: Task 2 "an answer of another tab's rows is not armour"; Task 1 `mgr_armourPieces` drops a weapon row.
2. **A loan in flight when the view switches.** It lands in its own view: holder, pick-clearing and picker. The other view's pick is untouched.
   - Test: Task 2 "a weapons loan landing after a switch to Armour stays in Weapons".
3. **A member holding two pieces for one part** (lent outside this tool). It counts as one part toward a set, and a third piece for that part is still refused.
   - Test: Task 1 `mgr_armourCandidates` / `mgr_armourPartHeld`.
4. **A piece whose name gives no part.** It is listed, lendable and never refused, and it never counts toward five.
   - Test: Task 1 `mgr_armourPieces`, `mgr_armourCandidates`, `mgr_armourPartHeld`.
5. **A full set lent in a row.** The pick stays through four loans. After the fifth, the member leaves "Loan to…" and the pick clears.
   - Test: Task 2 "a full set goes out on one pick, then that member leaves Loan to".

---

### Task 1: Armour helpers

**Files:**
- Modify: `server/public/scripts/oc-spawn-assistance.user.js`. Add the new functions after `mgr_rwCopies` (~2254) and edit `mgr_armouryMatches` (~2272).
- Test: `server/oc-armoury.test.mjs`.

**Interfaces:**
- Produces, all pure, with no module-level constants (so `fn()` can lift them):
  - `mgr_armourPart(name: string) -> 'head'|'body'|'legs'|'hands'|'feet'|''`. Regexes, first match wins:
    - head `/helmet|mask|respirator/i`
    - body `/vest|body|apron|mail/i`
    - legs `/pants/i`
    - hands `/gloves/i`
    - feet `/boots/i`
  - `mgr_armourPieces(rows) -> [{ armoryID, itemID:number, name, type, part, rarity:''|'red'|'orange'|'yellow', bonuses:string[], holder:{id:string,name}|null }]`.
    - Keeps a row only if it has an `armoryID` and passes C6.
    - Uses the same holder and bonus parsing as `mgr_rwCopies`.
    - Sorted per C2.
  - `mgr_armourCandidates(nameMap: Map<id,name>, pieces) -> [[id, name]]`. Lists members whose held pieces cover fewer than 5 distinct known parts, sorted by name. Ids are compared as strings.
  - `mgr_armourPartHeld(pieces, memberId, part) -> piece|null`. Returns the piece that member holds for that part, or null when the part is `''`.
  - `mgr_armouryMatches(row, query)` also matches `row.part || ''`.

- [ ] **Step 1: Write the failing tests.** Add an armour lifter beside `L()` so that a missing helper fails only these tests:

```js
const anames = ['mgr_rwBonusLabel', 'mgr_armourPart', 'mgr_armourPieces', 'mgr_armouryMatches', 'mgr_armouryPostTypes'];
const A = () => new Function(anames.map(fn).join('\n') + '\nreturn { ' + anames.join(', ') + ' };')();
const lift = (name) => new Function(fn(name) + '\nreturn ' + name + ';')();
// Armour rows as the armoury page gives them: every piece, ranked-war or not.
const piece = (armoryID, name, user = false, extra = {}) => ({ armoryID, itemID: String(9000 + armoryID), name, type: 'Defensive', glowClass: '', bonuses: [], user, ...extra });
const ARMOUR = [
  piece(31, 'Combat Boots', { userID: 1000002, playername: 'Bravo' }),
  piece(32, 'Combat Helmet', { id: '1000001', playername: 'Alpha' }),
  piece(33, 'Combat Helmet'),
  piece(34, 'Hazmat Suit'),
  piece(35, 'Flexible Body Armor', false, { glowClass: 'glow-yellow', bonuses: [bonus('Impregnable', '12% reduced melee damage'), blank] }),
  piece(36, 'Combat Pants', ''),
  piece(37, 'AK-47', false, { type: 'Primary' }),
  piece(38, 'Bulletproof Vest', { userID: 1000003, playername: 'Charlie' }),
  piece(39, 'Combat Gloves'),
];

test('an armour piece covers the body part its name says', () => {
  const p = A().mgr_armourPart;
  for (const [name, part] of [['Combat Helmet', 'head'], ['Construction Helmet', 'head'], ['Gas Mask', 'head'],
    ['Bulletproof Vest', 'body'], ['Combat Vest', 'body'], ['Flexible Body Armor', 'body'], ['Liquid Body Armor', 'body'], ['Riot Body', 'body'],
    ['Combat Pants', 'legs'], ['Combat Gloves', 'hands'], ['Leather Gloves', 'hands'], ['Combat Boots', 'feet'],
    ['Hazmat Suit', ''], ['', '']]) assert.equal(p(name), part, name);
});

test('every armour piece is listed, head to feet, free ones first; a row that is not armour is not', () => {
  const rows = A().mgr_armourPieces(ARMOUR);
  assert.deepEqual(rows.map((r) => r.armoryID), [33, 32, 38, 35, 36, 39, 31, 34]);
  assert.deepEqual(rows[3], { armoryID: 35, itemID: 9035, name: 'Flexible Body Armor', type: 'Defensive', part: 'body',
    rarity: 'yellow', bonuses: ['Impregnable 12%'], holder: null });
  assert.deepEqual(rows[1].holder, { id: '1000001', name: 'Alpha' });
  assert.equal(rows[4].holder, null);           // user '' is free
  assert.equal(rows[7].part, '');               // Hazmat Suit: kept by its type, part unknown
  assert.deepEqual(A().mgr_armourPieces([piece(40, 'Riot Gloves', false, { type: '' }), { name: 'No id', type: 'Defensive' }]).map((r) => r.armoryID), [40]);
});

test("Armour's Loan to offers everyone short of a full set, by name", () => {
  const offeredA = lift('mgr_armourCandidates');
  const held = (id, ...parts) => parts.map((part) => ({ part, holder: { id, name: '' } }));
  const pieces = [...held('1000002', 'head', 'body', 'legs', 'hands', 'feet'),
    ...held('1000001', 'head', 'head', 'body', 'legs', 'hands'),   // two helmets are one part
    ...held('1000003', 'head', '', '', '', ''),                     // unknown parts never count
    { part: 'feet', holder: null }];
  assert.deepEqual(offeredA(NAMES, pieces), [['1000001', 'Alpha'], ['1000003', 'Charlie']]);
  assert.deepEqual(offeredA(NAMES, held(1000002, 'head', 'body', 'legs', 'hands', 'feet')), [['1000001', 'Alpha'], ['1000003', 'Charlie']]);
  assert.deepEqual(offeredA(NAMES, []), [['1000001', 'Alpha'], ['1000002', 'Bravo'], ['1000003', 'Charlie']]);
});

test('the piece a member already holds for a body part is found; an unknown part is never in the way', () => {
  const heldFor = lift('mgr_armourPartHeld');
  const pieces = [
    { armoryID: 32, name: 'Combat Helmet', part: 'head', holder: { id: '1000001', name: 'Alpha' } },
    { armoryID: 41, name: 'Combat Helmet', part: 'head', holder: { id: '1000001', name: 'Alpha' } },
    { armoryID: 34, name: 'Hazmat Suit', part: '', holder: { id: '1000001', name: 'Alpha' } },
    { armoryID: 33, name: 'Combat Helmet', part: 'head', holder: null },
  ];
  assert.equal(heldFor(pieces, '1000001', 'head').armoryID, 32);
  assert.equal(heldFor(pieces, 1000001, 'head').armoryID, 32);
  assert.equal(heldFor(pieces, '1000001', 'feet'), null);
  assert.equal(heldFor(pieces, '1000001', ''), null);
  assert.equal(heldFor(pieces, '1000002', 'head'), null);
});

test('the search finds armour by piece, body part, bonus or who has it; a weapon has no part to match', () => {
  const lib = A();
  const rows = lib.mgr_armourPieces(ARMOUR);
  const hit = (q) => rows.filter((r) => lib.mgr_armouryMatches(r, q)).map((r) => r.armoryID);
  assert.deepEqual(hit('helmet'), [33, 32]);
  assert.deepEqual(hit('HEAD'), [33, 32]);
  assert.deepEqual(hit('feet'), [31]);
  assert.deepEqual(hit('charlie'), [38]);
  assert.deepEqual(hit('impregnable'), [35]);
  assert.deepEqual(L().mgr_rwCopies(PAGE).filter((r) => lib.mgr_armouryMatches(r, 'undefined')), []);
});

test('an armour loan or retrieve names Defensive first, then the older Armor', () => {
  const { mgr_armouryPostTypes: t } = A();
  assert.deepEqual(t('armor', 'Defensive'), ['Defensive', 'Armor']);
  assert.deepEqual(t('armor', ''), ['Defensive', 'Armor']);
});
```

- [ ] **Step 2: Run them to see them fail.**
  - Run: `node --test server/oc-armoury.test.mjs`
  - Expected: the first five new tests FAIL, with `mgr_armourPart not found` (and the same for the other helpers). The last one passes already: it pins the call the Armour view relies on. The 18 existing tests pass.

- [ ] **Step 3: Implement the four helpers and the `mgr_armouryMatches` change**, per the Interfaces block. Each gets a short `//` comment in the style of `mgr_rwCopies`.

- [ ] **Step 4: Run them to see them pass.**
  - Run: `node --test server/oc-armoury.test.mjs`
  - Expected: 24/24 pass.

- [ ] **Step 5: Commit**

```bash
git add -- server/oc-armoury.test.mjs
git commit -m "OC Spawn: armour pieces, body parts and Loan to rules for the Armoury tab" -- server/oc-armoury.test.mjs server/public/scripts/oc-spawn-assistance.user.js
```

---

### Task 2: The Weapons | Armour switch, and 3.2.91

**Files:**
- Modify: `server/public/scripts/oc-spawn-assistance.user.js`:
  - the tab code ~6876-7100;
  - the CSS ~3348;
  - the CHANGELOG at the top;
  - `@version` and `SCRIPT_VERSION`.
- Modify: `server/public/scripts/oc-spawn-assistance.meta.js`.
- Test: `tests/oc-spawn/armoury.e2e.test.mjs` and `server/oc-armoury.test.mjs` (the version test).

**Interfaces:**
- Consumes Task 1's helpers.
- **State:** `mgr_armViews = { weapons: { list, member, query, logged, readFor, noRarity }, armour: { list, member, query, logged, readFor } }`, plus:
  - `mgr_armouryView` ('weapons' by default);
  - `mgr_armouryOpens` (counts tab opens; a view is read when `readFor !== mgr_armouryOpens`);
  - `mgr_armourCat` (the spelling Torn answered on, tried first next time);
  - `mgr_armouryBusy = { view, row, loan }`.

  This replaces `mgr_armouryList`, `mgr_armouryMember`, `mgr_armouryQuery` and `mgr_armouryLogged`.
- **`mgr_scanArmouryRows(type)`** is `mgr_scanArmouryWeapons` with the category as a parameter; the old name goes.
- **`mgr_scanArmour() -> pieces`.** Each spelling has four outcomes:
  - it throws;
  - it answers with no rows;
  - it answers only with rows that `mgr_armourPieces` drops;
  - it answers with armour.

  Rules:
  - Try `[mgr_armourCat || 'armour', the other spelling]`.
  - The first spelling that yields pieces wins: remember it in `mgr_armourCat` and return its pieces.
  - Log once per page view `{ kind: 'armour', cat, rows: n, tried }`. A spelling whose rows were all dropped is noted in `tried` with its rows' distinct `type` values and `Object.keys(rows[0])`, names only.
  - If no spelling yields pieces but at least one answered: log `{ kind: 'armour', cat: null, tried }` once and return `[]`. The list then says "No armour in the armoury."
  - If both threw: throw the last error. The list then says "Couldn't read the armoury: <msg>".
- **`mgr_armouryAct(view, role, copy, userID, userName)`** uses `mgr_armouryPostTypes(view === 'armour' ? 'armor' : 'weapons', copy.type)`. Its first-success log is per view (`v.logged`), and every payload carries `kind: view`.
- **`mgr_renderArmouryPicker(view = mgr_armouryView)`:**
  - offers `mgr_armourCandidates` for armour and `mgr_loanCandidates` for weapons;
  - drops that view's pick when it is no longer offered;
  - draws only when `view` is the shown view.
- **`mgr_showArmouryView(view)`:**
  - marks the switch;
  - sets the search box's placeholder and that view's text;
  - draws its picker;
  - reads its rows if they haven't been read this open (the list shows "Reading the armoury…" or "Reading the armour…" meanwhile);
  - then draws the picker and list, if still shown.

  A read error shows `<div class="oc-error">Couldn't read the armoury: …</div>` inside `#mgr-arm-list`, and the switch keeps working.
- **`mgr_loadArmouryTab()`:**
  - reads the members as now (a first failure still replaces the whole tab with the error);
  - increments `mgr_armouryOpens`;
  - draws the switch, the existing controls and the list, keeping the same ids;
  - calls `mgr_showArmouryView(mgr_armouryView)`.

  The weapons `noRarity` check moves into the weapons read and sets `v.noRarity`.
- **`mgr_onArmouryClick`** binds `view` and `v` at tap time:
  - Armour, Loan, a picked member already holding a piece of a known part (`mgr_armourPartHeld`): flash `Has <held.name>` for 2000 ms and send nothing.
  - After a successful loan:
    - Weapons clears the pick as now.
    - Armour keeps it.
    - Both call `mgr_renderArmouryPicker(view)`.
  - The failure flash runs only if `view` is still shown.
- **Exact copy:**
  - Switch buttons `<button class="mgr-arm-view" data-view="weapons">Weapons</button>` and `…data-view="armour">Armour</button>` in `<div class="mgr-arm-views">`, above `.mgr-arm-controls`; the active one carries `mgr-arm-view-on`.
  - Armour heading `Armour · ${n} · ${free} free`.
  - Armour empty: `No armour in the armoury.`
  - Armour row:
    - the rarity dot only when `rarity` is set;
    - `.mgr-arm-type` shows Head/Body/Legs/Hands/Feet (blank for '');
    - `.mgr-arm-bonus` shows the bonuses joined by ' · ', or is empty (no "No bonus").
  - The Weapons heading, rows and texts are unchanged.
- **CSS:** `.mgr-arm-views` is a two-button segmented bar in the sub-tab colours (`#2d4a3e` border, `#74c69d` for the active one), with buttons at least 28px high.
- **CHANGELOG** (exact, at the top of the block):

```
// v3.2.91 — Armoury: a Weapons | Armour switch. Armour lists every piece,
//           head to feet with free ones first, with its own count line,
//           search and "Loan to…", which offers everyone short of a full set
//           and keeps the pick after each loan so a set goes out in a row;
//           a second piece for the same body part is refused. Weapons are
//           unchanged.
```

- [ ] **Step 1: Update the browser test harness and write the failing tests.**

  **Harness changes:**
  - Add the ARMOUR fixture below. With Bravo's full set (602 head, 604 body, 605 legs, 606 hands, 601 feet) and Charlie's helmet 609, the listed order is: 603, 602, 609, 604, 605, 607, 606, 608, 601 (rows 0-8; "Armour · 9 · 3 free").

```js
const piece = (armoryID, name, user = false) => ({ armoryID, itemID: String(9000 + armoryID), name, type: "Defensive", glowClass: "", bonuses: [], user });
const BRAVO = { userID: 1000002, playername: "Bravo" };
const ARMOUR = [piece(601, "Combat Boots", BRAVO), piece(602, "Combat Helmet", BRAVO), piece(603, "Combat Helmet"),
  piece(604, "Combat Vest", BRAVO), piece(605, "Combat Pants", BRAVO), piece(606, "Combat Gloves", BRAVO),
  piece(607, "Combat Gloves"), piece(608, "Combat Boots"), piece(609, "Combat Helmet", { userID: 1000003, playername: "Charlie" })];
```

  - In the route, replace `f.get("type") === "weapons" ? … : []` with a branch per type:
    - `weapons` as now;
    - `cfg.armourCat || "armour"` answers `(cfg.armourPages || [ARMOUR])[start / 50] || []`;
    - the other spelling answers `cfg.wrongTab ? WEAPONS : []`.
  - Add `armourView(p)`: click `.mgr-arm-view[data-view="armour"]`, then wait for `#mgr-arm-list .mgr-arm-row` or `.mgr-ok`.
  - Rewrite the first test's last assertion. Instead of `!/armour/i.test(text…)`, check that no Weapons row names an armour piece: `!got.some((r) => /Combat/.test(r))`.

  **New tests** (each opens its own page; `accept: ["Defensive"]` where a loan must land):
  1. **"the Armour switch lists every piece head to feet, free ones first, under its own count line".**
     - Row names in the listed order.
     - `#mgr-arm-list .mgr-arm-heading` textContent is `Armour · 9 · 3 free`.
     - Read posts at start=0 have types `["weapons", "armour"]`.
     - One `oc-armoury` log has `kind: "armour", cat: "armour"`.
  2. **"armour is asked as armour first, then armor, and the one Torn answered is logged".**
     - With `{ armourCat: "armor" }`: the rows show; the read types are `["weapons", "armour", "armor"]`; the log has `cat: "armor"`.
     - With `{ armourPages: [[]] }`: the list says `No armour in the armoury.`; the log has `cat: null`.
  3. **"an answer of another tab's rows is not armour".**
     - With `{ armourCat: "armor", wrongTab: true }`: 9 armour rows; no row names AK-47, Glock or Zebra.
  4. **"Loan in Armour lends that piece as Defensive, and the pick stays for the next piece".**
     - Pick Alpha. Loan row 0 (603), then row 5 (607) without picking again.
     - `actions` equals `["loan 603 Defensive Alpha [1000001]", "loan 607 Defensive Alpha [1000001]"]`.
     - `#mgr-arm-member` value is `1000001`.
  5. **"a second piece for a body part the member holds is refused by name, and nothing is sent".**
     - Pick Charlie. Loan row 0.
     - The button reads `Has Combat Helmet`; `actions` is `[]`.
  6. **"Armour's Loan to leaves out a full set's holder; Weapons' Loan to does not count armour".**
     - Armour's options are Alpha and Charlie (no Bravo).
     - Back in Weapons, the options are Alpha and Bravo (Charlie holds the Glock).
  7. **"a full set goes out on one pick, then that member leaves Loan to"** (Focus 5).
     - `armourPages` holds five free pieces, Riot Helmet/Body/Pants/Gloves/Boots (ids 611-615).
     - Pick Alpha and lend all five. After the fourth, the pick is still Alpha. After the fifth, Alpha is not an option and the value is `""`.
  8. **"a weapons loan landing after a switch to Armour stays in Weapons"** (Focus 2).
     - Set `{ accept: ["Primary"], slow: 1500 }`.
     - In Weapons, pick Alpha and Loan row 1. Switch to Armour at once and pick Charlie.
     - Wait 2 s. The armour pick is still `1000003`, and no armour row shows Alpha.
     - Back in Weapons, row 1 shows Alpha and the pick is `""`.
  9. **"switching back to Weapons keeps its list, pick and search".**
     - Search `warlord` and pick Bravo, then switch to Armour: the search box is empty and the placeholder is `Search piece, part or member`.
     - Switch back: the search is `warlord`, the one AK-47 row shows, and the pick is `1000002`.
  10. **"the search in Armour finds a piece, a body part or a holder".**
      - `gloves` gives 2 rows, `feet` gives 2, `charlie` gives 1.
  11. **"↩ in Armour takes that piece back as Defensive".**
      - Tap ↩ on row 1 (602, Bravo) twice.
      - `actions` is `["retrieve 602 Defensive Bravo [1000002]"]`, and row 1 shows Loan.

  Also add to `server/oc-armoury.test.mjs`: the version test becomes `3.2.91 in both places, and the meta file is the header`, with `3\.2\.91` in both regexes.

- [ ] **Step 2: Run them to see them fail.**
  - Run: `node tests/oc-spawn/armoury.e2e.test.mjs` (alone), then `node --test server/oc-armoury.test.mjs`.
  - Expected:
    - the 11 new browser tests FAIL (no `.mgr-arm-view`);
    - the 29 existing ones pass, including the rewritten first one;
    - the version test FAILs on 3.2.90.

- [ ] **Step 3: Implement the tab changes, CSS, CHANGELOG and version** per the Interfaces block. Do the version triple together: `@version 3.2.91`, `SCRIPT_VERSION = '3.2.91'`, and meta.js equal to the new header.

- [ ] **Step 4: Run them to see them pass.**
  - Run: `node --test server/oc-armoury.test.mjs` → 24/24.
  - Run: `node tests/oc-spawn/armoury.e2e.test.mjs` → `40 passed, 0 failed`.
  - Run: `node --check server/public/scripts/oc-spawn-assistance.user.js` → no output.

- [ ] **Step 5: Commit**

```bash
git commit -m "OC Spawn 3.2.91: armour in the Armoury tab" -- server/public/scripts/oc-spawn-assistance.user.js server/public/scripts/oc-spawn-assistance.meta.js server/oc-armoury.test.mjs tests/oc-spawn/armoury.e2e.test.mjs
```
