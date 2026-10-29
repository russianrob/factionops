# FactionOps 5.6.31: an Energy Bar on the Attack Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On Torn's attack page, FactionOps shows your energy in a slim bar right under your own header (your name and HP), so a hitter sees how much E is left.

**Architecture:** Pure helpers pick the reading. One source is the bars FactionOps already reads from Torn's API when the page opens (`energyState`, filled by `pollEnergy`). The other is Torn's own saved sidebar data (`sessionStorage` `sidebarData<id>.bars.energy`), but only once it changes while the page is open, which proves Torn keeps it live there. The bar is drawn in the life-percentage pass (`hpPass`). That pass already re-runs when Torn redraws the page and is disconnected across its own writes. A 2 s check queues the pass only when the bar's text or fill would change.

**Tech Stack:** the userscript (plain JS); `node:test` with the brace-count lifter; Playwright browser tests (playwright-core from /root/.hermes).

**Spec:** none. The owner's answers below are the authority.

## Decisions (owner, 2026-10-29 12:40 EDT: "q2 just the wnergy number no need to put how many attacks left do recommende besides Q2 ship it asap when done")

- Q1: a slim bar right under your own HP bar, in your green header row, as wide as it.
- Q2: just the energy number. No hits-left count.
- Q3: the reading taken when each attack page opens (FactionOps already makes that call), and Torn's live page data when Torn has it. No extra API calls, no timer polling Torn.
- Q4: desktop, PDA and the warboard app; on for everyone; no settings switch.
- Q5: ship mid-war as soon as it's built, tested and reviewed. Userscript only, no server restart.

## Builder calls

- B1: the text is `Energy 875/150`. "Energy" is Torn's own word for the bar. Numbers use en-US commas (`Energy 1,050/150`) whatever the device's locale.
- B2: one colour, FactionOps' green `#6bd47f`. The fill is current ÷ max, capped at full, so a stacked 1,050/150 shows a full bar with its real number. Q2 rules out extra colour states.
- B3: the bar is the next sibling of your green header (`[class*="headerWrapper__"][class*="green__"]`), not a child, so the header's own layout can't squeeze it.
- B4: Torn's saved sidebar energy counts only once it changes during this page view. Until then the API reading stands, because the saved copy may date from an earlier page.
- B5: with no reading (no key, an API error, no energy field) and no live sidebar, there is no bar.

## Global Constraints

- Version 5.6.31 goes in `// @version`, `const SCRIPT_VERSION`, `factionops.meta.js`, and the version test in `server/factionops-chain-bar.test.mjs`, all together.
- No new Torn API call and no Torn page request: the bar reads only `energyState` and `sessionStorage`.
- No new MutationObserver, and never one on document.body: the bar rides `hpPass`.
- The repo is public: made-up ids and numbers only (player 1000002, energy 875/150). Nothing comes from the owner's screenshot.
- Clear `//` comments in the surrounding style. No version-stamped comments. FactionOps has no CHANGELOG block, and none is added.

## Review Focus

1. **Torn's real attack-page layout on a phone and on desktop.** The bar must not be clipped, cover the target's row, or push START FIGHT off the screen.
   - Test: none possible here (no live DOM). Read the CSS for anything that leans on the parent's layout. The owner checks after release.
2. **A quiet page.** The 2 s check must not run the page-wide life-readout scan or rewrite the bar when nothing would change.
   - Test: Task 2 "a quiet page is not repainted".
3. **An API error, or a bars answer without energy.** No bar appears, nothing throws, and the Assist button is still there.
   - Test: Task 2 "no reading, no bar".
4. **Blocked or junk sessionStorage.** The API reading stands.
   - Test: Task 1 "Torn's saved energy is read from the first sidebarData<id> entry".
5. **A profile page** (`initAttackPage` also serves profiles.php). No bar.
   - Test: Task 2 "a profile page gets no bar".

---

### Task 1: The energy reading

**Files:**
- Modify: `server/public/scripts/factionops.user.js` (the helpers go right after `sidebarChain`, ~line 330)
- Create: `server/factionops-attack-energy.test.mjs`

**Interfaces:**
- Produces:
  - `sidebarEnergy(storage) -> { current: number, max: number } | null`. It reads the first `sidebarData<digits>` key's `bars.energy` as `{ current: Number(amount), max: Number(max) }`, when amount is a finite number ≥ 0 and max a finite number > 0. Otherwise it returns null, and it returns null if storage throws.
  - `energyFollower() -> { read(api, side) -> { current, max } | null }`. `api` is `{ current, max }` (FactionOps' `energyState`); `side` is `sidebarEnergy`'s answer. The rule:
    - the first non-null `side` is remembered;
    - once a `side` differs from it (current or max), the sidebar is live for the rest of the page, and from then on a non-null `side` wins;
    - otherwise `api` wins when `api.max > 0`;
    - else null.
  - `attackEnergyText(r) -> string`: `'Energy ' + current + '/' + max`, each number through `toLocaleString('en-US')`.
  - `attackEnergyFill(r) -> number`: `Math.max(0, Math.min(100, current / max * 100))`.

- [ ] **Step 1: Write the failing tests** in `server/factionops-attack-energy.test.mjs`. Use the lifter from `server/factionops-chain-bar.test.mjs` (`fn(name)` by brace count, `FO_SRC` honoured), lifting the four names with `new Function`.

```js
const store = (items) => ({ length: Object.keys(items).length, key: (i) => Object.keys(items)[i], getItem: (k) => items[k] });
test("Torn's saved energy is read from the first sidebarData<id> entry", () => {
  const side = { bars: { energy: { name: 'Energy', amount: 875, max: 150 } } };
  assert.deepEqual(L().sidebarEnergy(store({ sidebarDataundefined: '{}', sidebarData1000002: JSON.stringify(side) })), { current: 875, max: 150 });
  assert.equal(L().sidebarEnergy(store({})), null);
  assert.equal(L().sidebarEnergy(store({ sidebarData1000002: '{oops' })), null);
  assert.equal(L().sidebarEnergy(store({ sidebarData1000002: '{"bars":{}}' })), null);
  assert.equal(L().sidebarEnergy(store({ sidebarData1000002: '{"bars":{"energy":{"amount":"x","max":150}}}' })), null);
  assert.equal(L().sidebarEnergy(store({ sidebarData1000002: '{"bars":{"energy":{"amount":10,"max":0}}}' })), null);
  assert.equal(L().sidebarEnergy({ get length() { throw new Error('blocked'); } }), null);
});
test('the saved energy counts only once it changes on the page; until then the reading from the page opening stands', () => {
  const f = L().energyFollower();
  const api = { current: 875, max: 150 };
  assert.deepEqual(f.read(api, { current: 900, max: 150 }), api);
  assert.deepEqual(f.read(api, { current: 900, max: 150 }), api);
  assert.deepEqual(f.read(api, { current: 850, max: 150 }), { current: 850, max: 150 });
  assert.deepEqual(f.read({ current: 800, max: 150 }, { current: 850, max: 150 }), { current: 850, max: 150 });
  assert.deepEqual(f.read({ current: 800, max: 150 }, null), { current: 800, max: 150 });
});
test('no reading and no live sidebar is no bar', () => {
  const f = L().energyFollower();
  assert.equal(f.read({ current: 0, max: 0 }, null), null);
  assert.equal(f.read({ current: 0, max: 0 }, { current: 900, max: 150 }), null);
  assert.deepEqual(f.read({ current: 0, max: 0 }, { current: 875, max: 150 }), { current: 875, max: 150 });
});
test('the bar reads "Energy <current>/<max>" and fills to the max, a stacked bar full', () => {
  assert.equal(L().attackEnergyText({ current: 75, max: 150 }), 'Energy 75/150');
  assert.equal(L().attackEnergyText({ current: 1050, max: 150 }), 'Energy 1,050/150');
  assert.equal(L().attackEnergyFill({ current: 75, max: 150 }), 50);
  assert.equal(L().attackEnergyFill({ current: 1050, max: 150 }), 100);
  assert.equal(L().attackEnergyFill({ current: 0, max: 150 }), 0);
});
```

- [ ] **Step 2: Run it.** `node --test server/factionops-attack-energy.test.mjs`. Expected: FAIL with `sidebarEnergy not found`.
- [ ] **Step 3: Implement the four helpers** after `sidebarChain`, commented in the surrounding style.
- [ ] **Step 4: Run it again.** Same command. Expected: 4 pass, 0 fail.
- [ ] **Step 5: Commit** with message `FactionOps 5.6.31: the attack page's energy reading`, naming the two paths.

### Task 2: The bar on the attack page, and 5.6.31

**Files:**
- Modify: `server/public/scripts/factionops.user.js`:
  - CSS next to `.fo-energy-display` (~1841);
  - `paintAttackEnergyBar()` and the 2 s check beside the life-percentage code (~14131-14260);
  - `hpPass`;
  - `initLifePercent`;
  - `pollEnergy`'s onload;
  - the version at lines 4 and 106.
- Modify: `server/public/scripts/factionops.meta.js` (line 4); `server/factionops-chain-bar.test.mjs` (the version test becomes 5.6.31)
- Create: `tests/factionops/attack-energy.e2e.test.mjs`

**Interfaces:**
- Consumes: Task 1's four helpers; `energyState`; `hpQueue()`; `hpObserver`.
- Produces: `#fo-atk-energy`, the next sibling of `[class*="headerWrapper__"][class*="green__"]`. Its children are `.fo-atk-energy-fill` (style width = the fill %) and `.fo-atk-energy-text` (the text).

- [ ] **Step 1: Write the failing browser tests** in `tests/factionops/attack-energy.e2e.test.mjs`. Copy the launch, preamble and `t()` from `tests/factionops/assist.e2e.test.mjs`. The preamble:
  - answers a URL ending `selections=bars&key=K` with `cfg.bars`, default `{ energy: { current: 875, maximum: 150, ticktime: 100, fulltime: 600 } }`;
  - seeds `sessionStorage.sidebarData1000002` with `{ bars: { energy: { amount, max } } }` from `cfg.sidebar` when given.

  The page is the assist page, with `#mainContainer` around both headers. The tests:
  1. "the bar sits right under your header with the energy the page opened with": `#fo-atk-energy` is the green header's `nextElementSibling`; text `Energy 875/150`; fill `100%`; one bar on the page; none after the rose header.
  2. "a reading under the max fills part of the bar": bars 75/150 → `Energy 75/150`, fill `50%`.
  3. "the bar follows Torn's saved energy once it changes on the page": sidebar 900/150 at load → `Energy 875/150`; then `p.evaluate` rewrites it to 850/150 → `Energy 850/150` within 4 s.
  4. "Torn redrawing your header keeps the bar under it": replace the first `player___`'s contents with a fresh green header → within 4 s the bar is the new header's next sibling, still `Energy 875/150`, and there is one bar.
  5. "no reading, no bar": bars answer `{ error: { code: 2, error: 'Incorrect key' } }` and no sidebar → no `#fo-atk-energy` after 4 s, and `#wb-assist-btn` is still there.
  6. "a profile page gets no bar": `https://www.torn.com/profiles.php?XID=1000001` → no `#fo-atk-energy` after 4 s.
  7. "a quiet page is not repainted": once the bar shows, a MutationObserver on `#fo-atk-energy` (subtree, attributes, characterData) records nothing in 5 s.

  Also change the version test in `server/factionops-chain-bar.test.mjs` to 5.6.31: its title, `@version\s+5\.6\.31`, and `SCRIPT_VERSION = '5\.6\.31'`.
- [ ] **Step 2: Run them.**
  - `node tests/factionops/attack-energy.e2e.test.mjs` (from the worktree root). Expected: 1, 2, 3, 4 and 7 FAIL with no bar; 5 and 6 pass already, since they pin the absence.
  - `node --test server/factionops-chain-bar.test.mjs`. Expected: the version test FAILS.
- [ ] **Step 3: Implement.**
  - **CSS:** `#fo-atk-energy` is a block, full width, height 16 px, rounded, dark track, `position: relative; overflow: hidden; box-sizing: border-box; margin: 3px 0`. `.fo-atk-energy-fill` is absolute, left/top/bottom 0, in green `#6bd47f`. `.fo-atk-energy-text` is relative, centred, 11 px/16 px bold white, nowrap, tabular-nums.
  - **`paintAttackEnergyBar()`:**
    - it only runs on `sid=attack`;
    - the reading is a module-level `energyFollower()`'s `.read(energyState, sidebarEnergy(window.sessionStorage))`;
    - no header or no reading removes any bar;
    - otherwise it keeps `#fo-atk-energy` as the header's next sibling, creating or moving it, and writes the text and fill only when they differ.
  - **The 2 s check:** started once from `initLifePercent`. It computes the reading and calls `hpQueue()` only when the text or fill would differ from what is painted, or the bar would appear or vanish.
  - **`hpPass`:** call `paintAttackEnergyBar()` in its own try/catch after `paintLifePercents()`.
  - **`pollEnergy`'s onload:** after `updateEnergyDisplay()`, add `if (hpObserver) hpQueue();`.
  - **Version:** 5.6.31 in the four places.
- [ ] **Step 4: Run everything.** Expected: all pass.
  - The browser file: 7/7.
  - `node --test server/factionops-chain-bar.test.mjs server/factionops-attack-energy.test.mjs`: 0 fail.
  - `node --check server/public/scripts/factionops.user.js`.
  - The other FactionOps browser files, one at a time: assist, assist-toast, chainbar, outdated.
- [ ] **Step 5: Commit** with message `FactionOps 5.6.31: an energy bar on the attack page`, naming the five paths.
