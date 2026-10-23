# RW Pricer 3.14.3: the trade window shows the badge's price. Implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A ranked-war weapon in a trade counts at the price its own badge shows, so one gun has one price.

**Architecture:**
- The badge's estimator moves, word for word, out of `injectPriceTags` into a new function, `estimateItemPrice`. `injectPriceTags` calls it at the same point.
- A new `badgePriceFor(weaponKey, rarity, bonuses)` prices a weapon from its name, colour and bonuses, the way the badge does: the same table choice, colour median and estimator. It puts the caller's table choice back afterwards.
- `tradeRwValue` uses `badgePriceFor`. Where the badge has nothing to say, because the icon gives no colour or there is no colour median, it falls back to `priceForumRow`. Forum price lists keep `priceForumRow`, unchanged.

**Tech Stack:** one userscript file in ES5 (`var`, `function`), served as a static file by the warboard server; node:test and node:vm for the tests; Python 3 for the exact text edits.

**Spec:** `docs/superpowers/specs/2026-10-23-rwp-trade-window-badge-price-design.md` (commit e7885e24). The owner approved it on 2026-10-23 at about 14:15 EDT with "write it". That approval also covers the range-gun ruling: the trade counts the low end.

## Global Constraints

Repo paths are relative to `/opt/warboard`.

**Version and files**
- 3.14.2 becomes 3.14.3 in three places, which change together:
  - `// @version      3.14.3` (line 4);
  - `var SCRIPT_VERSION = '3.14.3';` (line 37);
  - `.meta.js`, regenerated as the script's header block (lines 1 to 30).
- No `-wbN` suffix. RW Pricer has no CHANGELOG block, so none is added. `@name`, `@namespace`, `@author`, `@downloadURL` and `@updateURL` stay as they are.
- Six files ship:
  - `server/public/scripts/torn-rw-pricer.user.js`
  - `server/public/scripts/torn-rw-pricer.meta.js`
  - `server/rwp-trade-badge.test.mjs` (new)
  - `server/rwp-trade.test.mjs`
  - `server/rwp-second-bonus.test.mjs`
  - `server/rwp-exact-gun.test.mjs`
- The feed, `rwp-refresh.js` and the server don't change. This is client only, so there is no pm2 reload and no Refresh tap.
- Starting point, checked in Task 1. If any value differs, stop. The installed files' sha256 values start with:
  - `torn-rw-pricer.user.js`: `3943779b`, the same as `git show 82c0f4a3:server/public/scripts/torn-rw-pricer.user.js`;
  - `torn-rw-pricer.meta.js`: `71b2ddfc`;
  - `rwp-trade.test.mjs`: `73cf1bef`;
  - `rwp-second-bonus.test.mjs`: `8f6789a9`;
  - `rwp-exact-gun.test.mjs`: `b5b77d2b`.

  `server/rwp-trade-badge.test.mjs` does not exist yet.

**What must not change (from the spec)**
- Every badge: its price, source, tooltip lines and bonus colours stay byte-identical to 3.14.2. Task 4's back-test checks this.
- Forum price lists: `priceForumRow`'s code is untouched and its output byte-identical.
- Armour, and names that are not a weapon: `tradeRwValue` gives 0, so they count at market value, as now.
- Where the badge has nothing to say (no colour on the icon, or no colour median for the weapon), the trade figure is `priceForumRow`'s, as today.
- A gun whose badge shows a range ("⚠ $low–$high") counts in a trade at the low end, which is the badge's estimate.

**Code rules**
- The estimator block moves word for word, 4 spaces further left. Task 2's move check proves it byte for byte.
- New code matches the file around it: ES5 `var`, 4-space indent, single quotes, a `/** */` doc comment above each function, present-tense `//` comments, and no version numbers in comments.
- New text is ASCII only, for PDA. A doc comment must never contain the text `function <name>(`, because the tests, the engine and the move check find a function by that text.

**Where the work happens**
- `server/public/scripts/` is served as it is. A file written there is live for every user the moment it is written.
- So all the work happens in an overlay, `$WS/ov`. It is a copy of `server/` in which the test files and the two RW Pricer files are real copies and everything else is a symlink. Tests find the script relative to their own path, so in the overlay they test the overlay's script. The installed tree is touched only in Task 6, after the final review.
- `$WS` is this plan's git-ignored workspace, `/opt/warboard/.superpowers/sdd/2026-10-23-rwp-trade-window-badge-price`, which is what `sdd-workspace` prints for this plan. It holds:
  - the tools, in `$WS/tools`;
  - the overlay, `$WS/ov`;
  - `$WS/base.user.js`, the 3.14.2 script;
  - outputs, in `$WS/out`.

  Shell state doesn't carry from one command to the next, so each command block sets `WS` itself.
- Work is on `main`. The owner allows that for these scripts: the Xanax Reminder and RW Pricer 3.14.1 and 3.14.2 shipped this way. The overlay is the isolation.
- No task commits anything, because the repo's working tree is the served tree. Each task ends with a ledger line instead, with its file hashes. The six files go out in one commit in Task 6.
- Back-test data: `/root/projects/rwp-backtest/weapon-auctions4-2026-10-23.csv.gz`.
  - sha256 `64fa168c7175881693d6feb5a81dc493ed4e6407febd6f8033b45075da40457b`, 293,018 lines.
  - Downloaded 2026-10-23 at 07:44 EDT from `https://cdn.marches.cafe/items/weapon-auctions4.csv.gz`.
  - If it is missing, stop and ask. A fresh download holds newer sales, so Task 4's score lines would differ.

**Repo and box**
- The repo (factionops.git) is public. Commit no secrets, no key endings, and no Torn CSS or bundles.
- Stage only the six paths: `git add` the new test, then `git commit -- <paths>`. Leave other sessions' changes alone: `server/data/rwp-prices.json`, `server/public/river9-watch.txt`, and the files under `server/public/s/`.
- Never print git remotes or git config in `/opt/warboard`, because the remote URL holds a token. Mask push output with `sed -E 's#//[^@]*@#//***@#g'`.
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- `main` is ahead of `origin/main` by the spec commit e7885e24 and this plan's commit. Both go out with the release push in Task 6.
- The box is shared and live, and a load of about 8 is normal.
  - Run one heavy thing at a time (the suite, the back-test, the mutants), and check `uptime` first.
  - `rm` on a variable path is blocked, and `grep` is ugrep.
  - Run Python with `-I`.
  - Subagents use `model: "opus"`.
- Installing: scripts with `install -o warboard -g warboard -m 644`, tests with `install -o root -g root -m 644`.
- Times for the owner are in EDT. The box's clock is CEST, 6 hours ahead.

## Review Focus

These are the inputs most likely to bite someone in a real trade that the spec doesn't spell out. A test in Task 3 pins each one; the number is the test's place in `rwp-trade-badge.test.mjs`.

1. **The table choice left behind by the page's last badge.** `injectPriceTags` leaves `ACTIVE` set for the last item it priced, and the trade window prices its rows after that.
   - Last year's tables, left by a one-bonus badge, must not price a two-bonus row (test 14).
   - Every year's tables, left by a two-bonus badge, must not price a one-bonus row, and that includes the colour median (test 15).
   - The helper must not leave its own choice behind (test 13).
2. **A feed loaded from cache, with no last-year tables.** `loadCachedPrices` never restores them. A one-bonus gun must still count at what its badge shows (test 19).
3. **A feed cached before 3.14.2's exact-gun table**, from a user who hasn't tapped Refresh since. The trade must still match the badge, which then shows the 3.14.1 price (test 20).
4. **The order Torn lists the bonuses in.** A row may list Conserve before Revitalize, and the price must not change (test 17).
5. **A name written another way.** "Bushmaster Carbon-15" must count as "Bushmaster Carbon 15" (test 18).

## File map

| File | Change |
|---|---|
| `server/public/scripts/torn-rw-pricer.user.js` | Two new functions just above `injectPriceTags`: `estimateItemPrice` (the moved block) and `badgePriceFor`. `injectPriceTags` calls the first, and `tradeRwValue` uses the second. Version 3.14.3. |
| `server/public/scripts/torn-rw-pricer.meta.js` | The header, version 3.14.3. |
| `server/rwp-trade-badge.test.mjs` | New: 20 tests, 3 from Task 2 and 17 from Task 3. |
| `server/rwp-second-bonus.test.mjs`, `server/rwp-exact-gun.test.mjs` | The harness runs the estimator the way `injectPriceTags` runs it: through the call when the script has `estimateItemPrice`, or as the inline block when it doesn't. The assertions don't change. |
| `server/rwp-trade.test.mjs` | Its sandbox gets what the estimator reads, because `tradeRwValue` now runs it. The assertions don't change. |

**How the edits are made.** A script in this plan makes every change to these files. Each one is an exact text edit: it checks that each piece of text it looks for occurs exactly once, and stops if not. If one stops, an earlier step went wrong or the file has changed since this plan was written. Don't edit around it by hand.

**Dry run.** The whole plan ran twice on 2026-10-23, between about 14:50 and 15:10 EDT, in throwaway overlays built from the same files. Every `Expected:` line is what the second run printed. The script's hashes came out the same in both runs. The edits are deterministic, so a run of this plan gives the same hashes byte for byte. In the first run one mutant survived: the helper reading the colour median under the caller's table choice. No test caught it, because every test priced the badge before the trade, and the badge leaves its own choice set. Test 15 was added for it, and the counts here include it.

---

### Task 1: The workspace, and harnesses that read the estimator either way

**Files:**
- Create: `$WS/tools/build-overlay.sh`, `$WS/tools/run-tests.sh` and `$WS/tools/edit-harnesses.py`; the overlay `$WS/ov`; `$WS/base.user.js`; `$WS/out/`.
- Modify, in the overlay only: `$WS/ov/rwp-second-bonus.test.mjs` and `$WS/ov/rwp-exact-gun.test.mjs`.

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `build-overlay.sh <target>` builds the overlay. It refuses a target that already exists.
  - `run-tests.sh [test files...]` runs the named test files in the overlay, or the whole suite when none are named. It prints the failing tests, the path of the full output, and one line, `tests N pass N fail N skipped N exit N`. It exits with the test runner's status.
  - In both harnesses, `estimatorStep()` returns the code the harness loop runs:
    - `injectPriceTags`' two-line call to `estimateItemPrice` when the script has one;
    - otherwise the inline block, from `estimatorBlock()`.

    The loop runs `estimatorStep()` where it ran `estimatorBlock()`, and lifts `fnIfAny("estimateItemPrice")` into its sandbox. `activeLine()` reads the table choice from `fn("injectPriceTags")`, not the whole file, because from Task 3 on the file holds that line twice.

- [ ] **Step 1: Check the box and the starting point**

```bash
uptime
cd /opt/warboard && git log --oneline -3 && git status --short -- server/public/scripts/torn-rw-pricer.user.js server/public/scripts/torn-rw-pricer.meta.js server/rwp-trade.test.mjs server/rwp-second-bonus.test.mjs server/rwp-exact-gun.test.mjs server/rwp-trade-badge.test.mjs
cd /opt/warboard/server && sha256sum public/scripts/torn-rw-pricer.user.js public/scripts/torn-rw-pricer.meta.js rwp-trade.test.mjs rwp-second-bonus.test.mjs rwp-exact-gun.test.mjs | cut -c1-8; ls rwp-trade-badge.test.mjs
sha256sum /root/projects/rwp-backtest/weapon-auctions4-2026-10-23.csv.gz | cut -c1-16
```

Expected:
- The log shows this plan's commit, then `e7885e24`, then `82c0f4a3`.
- `git status` prints nothing.
- The hashes are `3943779b`, `71b2ddfc`, `73cf1bef`, `8f6789a9` and `b5b77d2b`.
- `ls` says there is no such file.
- The CSV's hash starts with `64fa168c71758816`.

- [ ] **Step 2: Make the workspace and write the first two tools**

The executing-plans setup runs `sdd-workspace` for this plan, which must print `/opt/warboard/.superpowers/sdd/2026-10-23-rwp-trade-window-badge-price`. Then:

```bash
WS=/opt/warboard/.superpowers/sdd/2026-10-23-rwp-trade-window-badge-price; mkdir -p $WS/tools $WS/out && ls $WS
```

Create `$WS/tools/build-overlay.sh`:

```bash
#!/bin/bash
# A copy of /opt/warboard/server that tests can run in without touching the
# served files: test files and the two RW Pricer script files are COPIES
# (tests read the script relative to their own path, so they must live here);
# everything else is a symlink to the live tree. Refuses an existing target.
set -euo pipefail
SRV=/opt/warboard/server
T="$1"
[ -e "$T" ] && { echo "exists: $T" >&2; exit 1; }
mkdir -p "$T/public/scripts"
for p in "$SRV"/* "$SRV"/.[!.]*; do
  [ -e "$p" ] || continue
  b=$(basename "$p")
  case "$b" in
    public) ;;
    *.test.js|*.test.mjs|*.test.cjs) cp -p "$p" "$T/$b" ;;
    *) ln -s "$p" "$T/$b" ;;
  esac
done
for p in "$SRV"/public/* "$SRV"/public/.[!.]*; do
  [ -e "$p" ] || continue
  b=$(basename "$p")
  [ "$b" = scripts ] || ln -s "$p" "$T/public/$b"
done
for p in "$SRV"/public/scripts/*; do
  b=$(basename "$p")
  case "$b" in
    torn-rw-pricer.user.js|torn-rw-pricer.meta.js) cp -p "$p" "$T/public/scripts/$b" ;;
    *) ln -s "$p" "$T/public/scripts/$b" ;;
  esac
done
echo "overlay at $T: $(ls "$T" | wc -l) entries, scripts copied: $(find "$T/public/scripts" -maxdepth 1 -type f | wc -l)"
```

Create `$WS/tools/run-tests.sh`:

```bash
#!/bin/bash
# Runs node's test runner in the overlay: the named test files, or the whole
# suite when none are named. Keeps the full output in $WS/out, prints any
# failing test, then one line of counts. Exits with the runner's status.
# Usage: bash run-tests.sh [test files...]
set -u
WS=${WS:-/opt/warboard/.superpowers/sdd/2026-10-23-rwp-trade-window-badge-price}
cd "$WS/ov" || exit 2
mkdir -p "$WS/out"
out="$WS/out/tests-$(date +%H%M%S)-$$.txt"
node --test "$@" > "$out" 2>&1
rc=$?
grep -E "^not ok " "$out" | head -25
echo "full output: $out"
echo "$(grep -E '^# (tests|pass|fail|skipped) ' "$out" | sed 's/^# //' | tr '\n' ' ')exit $rc"
exit $rc
```

- [ ] **Step 3: Build the overlay and the base**

```bash
WS=/opt/warboard/.superpowers/sdd/2026-10-23-rwp-trade-window-badge-price
bash $WS/tools/build-overlay.sh $WS/ov && git -C /opt/warboard show 82c0f4a3:server/public/scripts/torn-rw-pricer.user.js > $WS/base.user.js && sha256sum $WS/base.user.js $WS/ov/public/scripts/torn-rw-pricer.user.js | cut -c1-8
```

Expected: `overlay at /opt/warboard/.superpowers/sdd/2026-10-23-rwp-trade-window-badge-price/ov: 250 entries, scripts copied: 2`, then `3943779b` twice. The entry count follows what is in `server/`, so it can be off by one or two if another session has added a file since; `scripts copied: 2` must hold.

- [ ] **Step 4: The whole suite in the overlay, before any change**

```bash
uptime; bash /opt/warboard/.superpowers/sdd/2026-10-23-rwp-trade-window-badge-price/tools/run-tests.sh
```

Expected: `tests 2178 pass 2176 fail 0 skipped 2 exit 0`. If another session has added tests to `server/` since this plan was written, every count below moves by the same amount, and `fail 0` must still hold.

- [ ] **Step 5: Edit the two harnesses**

Create `$WS/tools/edit-harnesses.py`:

```python
# The two estimator harnesses run the estimator however the script holds it
# (injectPriceTags' call to estimateItemPrice, or the inline block of a build
# from before it), and read the table choice from injectPriceTags itself.
# Usage: python3 -I edit-harnesses.py <dir holding the two test files>
import os, sys
d = sys.argv[1]
STEP = '''// The estimator as injectPriceTags runs it: its call to estimateItemPrice,
// or in a build from before that function, the block itself.
function estimatorStep() {
  const call = fn("injectPriceTags").match(/^[ \\t]*var est = estimateItemPrice\\(.*\\);\\n[ \\t]*var bonusColors = est\\.bonusColors.*;$/m);
  return call ? call[0] : estimatorBlock();
}
'''
OLD_ACTIVE = '  const m = SRC.match(/^[ \\t]*ACTIVE = \\(weaponKey && recentTables && bonuses\\.length === 1\\) \\? recentTables : null;$/m);'
NEW_ACTIVE = '  const m = fn("injectPriceTags").match(/^[ \\t]*ACTIVE = \\(weaponKey && recentTables && bonuses\\.length === 1\\) \\? recentTables : null;$/m);'
for name in ["rwp-second-bonus.test.mjs", "rwp-exact-gun.test.mjs"]:
    p = os.path.join(d, name)
    s = open(p, encoding="utf-8").read()
    anchor = '  return SRC.slice(a, b);\n}\n'
    assert s.count(anchor) == 1, name + ": estimatorBlock"
    s = s.replace(anchor, anchor + STEP)
    assert s.count('    estimatorBlock(),\n') == 1, name + ": loop"
    s = s.replace('    estimatorBlock(),\n', '    estimatorStep(),\n')
    assert s.count(OLD_ACTIVE) == 1, name + ": activeLine"
    s = s.replace(OLD_ACTIVE, NEW_ACTIVE)
    if name == "rwp-second-bonus.test.mjs":
        old = '    fn("getPriceArray"), fn("getBonusPriceArray"), fn("getWeaponExactGun"), fn("monthYearOfDay"),\n'
        assert s.count(old) == 1, name + ": roster"
        s = s.replace(old, old + '    fnIfAny("estimateItemPrice"),\n')
        old = 'function estimatorBlock() {'
        assert s.count(old) == 1, name + ": fnIfAny"
        s = s.replace(old, '// Pieces only a build with the shared estimator has.\n'
                           'const fnIfAny = (name) => (SRC.includes("function " + name + "(") ? fn(name) : "");\n' + old)
        old = ("// The estimator is inline in injectPriceTags, so it is lifted out between the\n"
               "// two comments that bracket it and run, inside a loop over the page's items\n"
               "// as it is there, over a hand-built feed holding the report's numbers.\n")
        assert s.count(old) == 1, name + ": header"
        s = s.replace(old, "// The estimator is run the way injectPriceTags runs it, inside a loop over\n"
                           "// the page's items as it is there, over a hand-built feed holding the\n"
                           "// report's numbers.\n")
    else:
        old = '    fnIfAny("getWeaponExactGun"), fnIfAny("monthYearOfDay"),\n'
        assert s.count(old) == 1, name + ": roster"
        s = s.replace(old, old + '    fnIfAny("estimateItemPrice"),\n')
    open(p, "w", encoding="utf-8").write(s)
    print("edited", name)
```

Run it:

```bash
WS=/opt/warboard/.superpowers/sdd/2026-10-23-rwp-trade-window-badge-price
python3 -I $WS/tools/edit-harnesses.py $WS/ov && cd $WS/ov && sha256sum rwp-second-bonus.test.mjs rwp-exact-gun.test.mjs | cut -c1-8
```

Expected: `edited rwp-second-bonus.test.mjs`, `edited rwp-exact-gun.test.mjs`, `1d49d0d7`, `3e1d178d`.

- [ ] **Step 6: They still pass on 3.14.2**

```bash
bash /opt/warboard/.superpowers/sdd/2026-10-23-rwp-trade-window-badge-price/tools/run-tests.sh rwp-second-bonus.test.mjs rwp-exact-gun.test.mjs
```

Expected: `tests 26 pass 26 fail 0 skipped 0 exit 0`.

This step changes test harnesses only, so there is no failing test to watch here. On 3.14.2, `estimatorStep()` returns the inline block, which is exactly what the harnesses ran before. The other branch, the call, first runs in Task 2 Step 6, where these 26 tests must pass through the moved estimator. That run is this change's real test.

- [ ] **Step 7: Close the task**

Run the executing-plans `task-done` for Task 1 with the test command `bash /opt/warboard/.superpowers/sdd/2026-10-23-rwp-trade-window-badge-price/tools/run-tests.sh rwp-second-bonus.test.mjs rwp-exact-gun.test.mjs`.

Expected: the ledger line ends `→ tests 26 pass 26 fail 0 skipped 0 exit 0`. Then add the line `Task 1: overlay hashes: rwp-second-bonus.test.mjs 1d49d0d7, rwp-exact-gun.test.mjs 3e1d178d (no commit: the working tree is the served tree)`.

---

### Task 2: The badge's estimator in its own function

**Files:**
- Create: `$WS/tools/move-check.mjs`, `$WS/tools/extract-estimator.py` and `$WS/ov/rwp-trade-badge.test.mjs`.
- Modify, in the overlay: `$WS/ov/public/scripts/torn-rw-pricer.user.js`.
  - 3.14.2 lines 2462 to 2750 are the estimator block. It runs from `            // Determine bonus color tier for each bonus (falls back to weapon rarity)` to the blank line before `            // Gather full price arrays for tooltip`.
  - The block moves into a new function inserted above `    function injectPriceTags() {` (line 2391).

**Interfaces:**
- Consumes: Task 1's overlay and `run-tests.sh`.
- Produces:
  - `estimateItemPrice(weaponKey, itemKey, rarity, bonuses, median, comboFn, bonusFn)` returns `{ price, source, deriv, bonusColors }`.
    - `weaponKey` is the weapon's name, or null for armour. `itemKey` is the item's name either way.
    - `comboFn` and `bonusFn` are `getWeaponComboMedian` and `getBonusMedian` for a weapon, or `getArmourComboMedian` and `getArmourBonusMedian` for armour.
    - `price` is a number and can be 0. `source` is a string or null. `deriv` is an array of `{label, amt, src, n, prem}` lines (some with `raw` and `floor` too). `bonusColors` maps each bonus name to the colour it was read at.
    - The caller sets `ACTIVE` first. The function writes nothing outside itself.
  - In `injectPriceTags`, where the block was (12-space indent):

    ```
    var est = estimateItemPrice(weaponKey, itemKey, rarity, bonuses, median, comboFn, bonusFn);
    var bonusColors = est.bonusColors, estimatedPrice = est.price, estSource = est.source, deriv = est.deriv;
    ```

  - `move-check.mjs <3.14.2 script> <build>` prints `move check OK: ...`, or the first line that differs and exits 1.
  - Test helpers in `rwp-trade-badge.test.mjs`, used again in Task 3:
    - `trader(feed)`, a sandbox holding the script's lookups, plus `badge(weaponKey, rarity, bonuses)` (returns `{ shown, est, source, median }`, or null) and `armourBadge(armourKey, rarity, bonuses)`;
    - `row(title)`, `icon(bonuses, colour)`, `copy(bonuses)` and `plain(x)`;
    - `fn(name)`, `fnIfAny(name)`, `v(name)`, `tableChoice()` and `estimatorStep()`;
    - `GUN`, `REVIT(level)`, `OWNER_BONUSES`, `OWNER()`, `SINGLE()` and `ACTIVE_LINE`.

- [ ] **Step 1: Write the failing tests**

Create `$WS/ov/rwp-trade-badge.test.mjs`:

```js
// One gun, one price: a trade counts an RW weapon at its badge's price.
//
// An Orange Bushmaster Carbon 15 with 14% Revitalize and 26% Conserve was
// badged $3,574,795,103 and counted in a trade at $3,193,164,535. The trade
// priced it with the forum ladder, which reads the more valuable bonus alone
// at its roll, so the Conserve and the gun's own earlier sale never came into
// it. Both now price with the badge's estimator, estimateItemPrice.
//
// The badge figure here is worked out the way injectPriceTags works it out:
// its table choice, the colour median, the estimator, then what the badge
// shows. The trade figure is tradeRwValue's, on a row whose info icon
// carries the bonuses the way Torn renders them. The tables are built by
// hand so the figures stay put; the live feed changes every day.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const SRC = fs.readFileSync(process.env.RWP_SRC || new URL("./public/scripts/torn-rw-pricer.user.js", import.meta.url), "utf8");

function fn(name) {
  const i = SRC.indexOf("function " + name + "(");
  assert.ok(i >= 0, "not in the shipping script: " + name);
  const o = SRC.indexOf("{", i);
  let d = 0;
  for (let j = o; j < SRC.length; j++) {
    if (SRC[j] === "{") d++;
    else if (SRC[j] === "}" && --d === 0) return SRC.slice(i, j + 1);
  }
  throw new Error("unbalanced braces in " + name);
}
function v(name) {
  const m = SRC.match(new RegExp("^[ \\t]*var[ \\t]+" + name + "[ \\t]*=.*$", "m"));
  assert.ok(m, "var not found: " + name);
  return m[0].trim();
}
// Pieces only a build with the shared estimator has. A build without them
// still loads, so the tests show it failing rather than erroring.
const fnIfAny = (name) => (SRC.includes("function " + name + "(") ? fn(name) : "");
// Objects made inside a vm belong to another realm; compare them as data.
const plain = (x) => (x === undefined ? x : JSON.parse(JSON.stringify(x)));

// Which table set an item reads, as injectPriceTags chooses it.
const ACTIVE_LINE = "ACTIVE = (weaponKey && recentTables && bonuses.length === 1) ? recentTables : null;";
function tableChoice() {
  const m = fn("injectPriceTags").match(/^[ \t]*ACTIVE = .*$/m);
  assert.ok(m, "injectPriceTags no longer chooses the tables");
  return m[0].trim();
}
// The estimator as injectPriceTags runs it: its call to estimateItemPrice,
// or in a build from before that function, the block between the two
// comments that bracket it.
function estimatorStep() {
  const call = fn("injectPriceTags").match(/^[ \t]*var est = estimateItemPrice\(.*\);\n[ \t]*var bonusColors = est\.bonusColors.*;$/m);
  if (call) return call[0];
  const a = SRC.indexOf("// Determine bonus color tier for each bonus");
  const b = SRC.indexOf("// Gather full price arrays for tooltip");
  assert.ok(a > 0 && b > a, "the estimator in injectPriceTags has moved");
  return SRC.slice(a, b);
}

// Everything tradeRwValue reaches, over a hand-built feed, plus badge() and
// armourBadge(): an item priced as injectPriceTags prices it. Strict, as the
// script is.
function trader(feed) {
  const box = { FEED: feed };
  vm.createContext(box);
  vm.runInContext([
    "'use strict';",
    v("WEAPON_CLASS"), v("ARMOUR_SET"), v("COMBO_MIN_SAMPLES"), v("LEVEL_MIN_SAMPLES"), v("RARITY_WORD"),
    "var weaponPrices = FEED.weaponPrices || {}, bonusPrices = FEED.bonusPrices || {}, classPrices = FEED.classPrices || {};",
    "var weaponComboPrices = FEED.comboPrices || {}, weaponPairComboPrices = FEED.pairComboPrices || {};",
    "var weaponLevelPrices = FEED.levelPrices || {}, recentTables = FEED.recent || null, ACTIVE = null;",
    "var weaponExactPrices = FEED.exactPrices || {};",
    "var armourPrices = FEED.armourPrices || {}, armourComboPrices = FEED.armourComboPrices || {};",
    "var armourBonusPrices = FEED.armourBonusPrices || {}, armourSetPrices = FEED.armourSetPrices || {};",
    "var ITEM_ALIASES = {};",
    "var KNOWN_WEAPONS = {}; Object.keys(WEAPON_CLASS).forEach(function (w) { KNOWN_WEAPONS[w.toLowerCase()] = w; });",
    fn("flattenName"),
    "var FLAT_WEAPONS = {}; Object.keys(WEAPON_CLASS).forEach(function (w) { FLAT_WEAPONS[flattenName(w)] = w; });",
    SRC.slice(SRC.indexOf("var BONUS_ALIAS = {};"), SRC.indexOf("function resolveBonusName(")),
    // Which colour's cross-weapon bonus median to read. As in the other
    // estimator tests, each bonus is read at the item's own colour.
    "function getBonusColorByName() { return null; }",
    fn("TBL"), fn("levelMedianOf"), fn("lookupWeapon"), fn("normalizeWeaponName"), fn("resolveBonusName"),
    fn("getMedianPrice"), fn("getBonusMedian"),
    fn("getWeaponComboMedian"), fn("getWeaponComboThinArray"), fn("getWeaponComboPriceArray"),
    fn("pairKeyFor"), fn("getWeaponPairComboMedian"), fn("getWeaponPairComboArray"),
    fn("getWeaponLevelMedian"), fn("getWeaponLevelCount"), fn("getCombinedLevelValue"),
    fn("getPriceArray"), fn("getBonusPriceArray"), fn("getWeaponExactGun"), fn("monthYearOfDay"),
    fn("getArmourMedianPrice"), fn("getArmourComboMedian"), fn("getArmourBonusMedian"),
    fn("getArmourPriceArray"), fn("getArmourBonusPriceArray"), fn("getArmourComboPriceArray"),
    fn("rarityFromRoll"), fn("forumBonusWorth"), fn("priceForumRow"),
    fn("parseTradeBonusTitle"), fn("tradeRwValue"),
    fnIfAny("estimateItemPrice"), fnIfAny("badgePriceFor"),
    "function badge(weaponKey, rarity, bonuses) {",
    "  var armourKey = null;",
    "  " + tableChoice(),
    "  var median = getMedianPrice(weaponKey, rarity), bonusFn = getBonusMedian;",
    "  if (!median) return null;",
    "  var itemKey = weaponKey, comboFn = getWeaponComboMedian;",
    estimatorStep(),
    "  return { shown: estimatedPrice || median, est: estimatedPrice, source: estSource, median: median };",
    "}",
    "function armourBadge(armourKey, rarity, bonuses) {",
    "  var weaponKey = null;",
    "  " + tableChoice(),
    "  var median = getArmourMedianPrice(armourKey, rarity), bonusFn = getArmourBonusMedian;",
    "  var itemKey = armourKey, comboFn = getArmourComboMedian;",
    estimatorStep(),
    "  return { est: estimatedPrice, source: estSource, deriv: deriv, colors: bonusColors, median: median };",
    "}",
  ].join("\n"), box, { filename: "rwp-trade-badge.js" });
  return box;
}

// A trade row, as tradeRwValue reads it: the info icon's title is all it uses.
const row = (title) => ({
  querySelector: (sel) => (sel.indexOf("networth-info-icon") >= 0 ? { getAttribute: () => title } : null),
});
// Torn's info-icon title for a weapon: a block per bonus with its roll, then
// the stats, the last of them the quality and the colour.
function icon(bonuses, colour) {
  return bonuses.map((b) => "<div class='t-overflow'><i class='bonus-attachment-" + b.name.toLowerCase() + "'></i><b>" +
    b.name + "</b><br/>" + b.level + "% chance of an effect</div>").join("") +
    "<div><ul class='bonus-tooltip clearfix'><li><i class='bonus-attachment-item-damage-bonus'></i><span>60.00</span></li>" +
    (colour ? "<li><i class='bonus-attachment-item-rarity-bonus'></i><span>150.00% " + colour.toLowerCase() + "</span></li>" : "") +
    "</ul></div>";
}

const GUN = "Bushmaster Carbon 15";
const REVIT = (level) => ({ name: "Revitalize", level });
const OWNER_BONUSES = [REVIT(14), { name: "Conserve", level: 26 }];
const copy = (bonuses) => bonuses.map((b) => ({ ...b }));

// The owner's gun with the tables the live feed has for it: Orange
// Bushmasters at a $200M median over 647 sales; 14% Revitalize alone at
// $3.19B over 4; at any roll, Revitalize at $3.00B and Conserve at $48.5M;
// and this gun sold once before, for $4.00B in Aug 2025. No pair comp.
const OWNER = () => ({
  bonusPrices: { Revitalize: {}, Conserve: {} },
  weaponPrices: { [GUN]: { Orange: [61800001, 200000001, 10574554640, 647] } },
  comboPrices: {
    [GUN + "|Conserve"]: { Orange: [30000001, 48475009, 70000001, 59] },
    [GUN + "|Revitalize"]: { Orange: [1500000000, 3000000000, 6000000000, 40] },
  },
  levelPrices: { [GUN + "|Revitalize"]: { Orange: { 13: [1888888889, 11], 14: [3193164535, 4], 15: [5244891468, 6] } } },
  exactPrices: { [GUN + "|Conserve+Revitalize"]: { Orange: { "26+14": [4002036189, 1, 20323] } } },
});
// One bonus at a roll with no sale of its own, and last year's tables lower
// than every year's. Conserve has never sold on this gun at all.
const SINGLE = () => ({
  bonusPrices: { Revitalize: {}, Conserve: {} },
  weaponPrices: { [GUN]: { Orange: [61800001, 200000001, 10574554640, 647] } },
  comboPrices: { [GUN + "|Revitalize"]: { Orange: [1500000000, 3000000000, 6000000000, 40] } },
  levelPrices: { [GUN + "|Revitalize"]: { Orange: { 12: [1500000000, 9], 13: [1888888889, 11], 15: [5244891468, 6], 16: [6000000000, 5] } } },
  recent: {
    weaponPrices: { [GUN]: { Orange: [50000001, 180000001, 9000000000, 300] } },
    comboPrices: { [GUN + "|Revitalize"]: { Orange: [1200000000, 2600000000, 5000000000, 20] } },
    levelPrices: { [GUN + "|Revitalize"]: { Orange: { 12: [1300000000, 5], 13: [1700000000, 6], 15: [4800000000, 4], 16: [5500000000, 3] } } },
  },
});

// ── The estimator, shared ──────────────────────────────────────

test("the badge's estimator is a function of the item alone", () => {
  const t = trader(OWNER());
  const r = t.estimateItemPrice(GUN, GUN, "Orange", copy(OWNER_BONUSES), 200000001, t.getWeaponComboMedian, t.getBonusMedian);
  assert.equal(r.price, 3574795103);
  assert.equal(r.source, "exact %");
  assert.deepEqual(plain(r.bonusColors), { Revitalize: "Orange", Conserve: "Orange" });
  assert.deepEqual(plain(r.deriv.at(-1)),
    { label: "blended with this exact gun", amt: 4002036189, src: "50% this gun, last sold Aug 2025", n: 1, prem: false });
});

test("injectPriceTags prices through that function, with no copy of its own", () => {
  const body = fn("injectPriceTags");
  assert.ok(body.includes("estimateItemPrice(weaponKey, itemKey, rarity, bonuses, median, comboFn, bonusFn)"),
    "the badge does not call estimateItemPrice with its item");
  assert.ok(!body.includes("// Determine bonus color tier for each bonus"), "the estimator is still inline");
});

test("an armour piece prices exactly as before", () => {
  // The figures the estimator gave while it was inline in injectPriceTags.
  // Armour goes through it with no weapon, the armour's own name as the
  // item, and the armour lookups.
  const HELMET = "Sentinel Helmet";
  const t = trader({
    armourPrices: { [HELMET]: { Orange: [900000000, 1400000001, 3000000000, 80] } },
    armourComboPrices: { [HELMET + "|Impregnable"]: { Orange: [1500000000, 2100000000, 4000000000, 12] } },
    armourBonusPrices: {
      Impregnable: { Orange: [800000000, 1800000000, 3500000000, 40] },
      Impenetrable: { Orange: [100000000, 300000000, 900000000, 25] },
    },
  });
  const IMPREG = { name: "Impregnable", level: 24 }, IMPEN = { name: "Impenetrable", level: 20 };
  const impregLine = { label: "Impregnable 24%", amt: 2100000000, src: "combo", n: 12, prem: false };
  assert.deepEqual(plain(t.armourBadge(HELMET, "Orange", [IMPREG])),
    { est: 2100000000, source: "combo", deriv: [impregLine], colors: { Impregnable: "Orange" }, median: 1400000001 });
  assert.deepEqual(plain(t.armourBadge(HELMET, "Orange", [IMPEN])),
    { est: 900000000, source: "weapon floor", colors: { Impenetrable: "Orange" }, median: 1400000001,
      deriv: [{ label: "Impenetrable 20%", amt: 900000000, src: "weapon floor", n: 80, prem: false }] });
  assert.deepEqual(plain(t.armourBadge(HELMET, "Orange", [IMPREG, IMPEN])),
    { est: 2100000000, source: "combo", colors: { Impregnable: "Orange", Impenetrable: "Orange" }, median: 1400000001,
      deriv: [impregLine, { label: "Impenetrable 20%", amt: 0, src: "weapon floor", n: 80, prem: true, raw: 900000000, floor: 900000000 }] });
});
```

- [ ] **Step 2: Watch them fail**

```bash
bash /opt/warboard/.superpowers/sdd/2026-10-23-rwp-trade-window-badge-price/tools/run-tests.sh rwp-trade-badge.test.mjs
```

Expected:

```
not ok 1 - the badge's estimator is a function of the item alone
not ok 2 - injectPriceTags prices through that function, with no copy of its own
full output: /opt/warboard/.superpowers/sdd/2026-10-23-rwp-trade-window-badge-price/out/tests-<HHMMSS>-<pid>.txt
tests 3 pass 1 fail 2 skipped 0 exit 1
```

`grep -E "^  error:"` on that file gives `'t.estimateItemPrice is not a function'` and `'the badge does not call estimateItemPrice with its item'`. Test 3 (armour) already passes. It holds the figures the inline block gives, and it must still pass after the move.

- [ ] **Step 3: Write the move check**

Create `$WS/tools/move-check.mjs`:

```js
// Proves a 3.14.3 build is 3.14.2 with only the planned changes:
//  1. estimateItemPrice's body is the 3.14.2 estimator block, 4 spaces left;
//  2. with that block put back in place of the call, estimateItemPrice and
//     badgePriceFor taken out, and tradeRwValue and the version lines as
//     they were, the file is 3.14.2 byte for byte.
// Usage: node move-check.mjs <3.14.2 user.js> <new user.js>
import fs from "node:fs";
const [,, basePath, newPath] = process.argv;
const base = fs.readFileSync(basePath, "utf8");
const neu = fs.readFileSync(newPath, "utf8");
const FROM = "            // Determine bonus color tier for each bonus (falls back to weapon rarity)\n";
const TO = "            // Gather full price arrays for tooltip\n";
const SIG = "    function estimateItemPrice(weaponKey, itemKey, rarity, bonuses, median, comboFn, bonusFn) {\n";
const RET = "        return { price: estimatedPrice, source: estSource, deriv: deriv, bonusColors: bonusColors };\n    }";
const CALL = "            var est = estimateItemPrice(weaponKey, itemKey, rarity, bonuses, median, comboFn, bonusFn);\n" +
  "            var bonusColors = est.bonusColors, estimatedPrice = est.price, estSource = est.source, deriv = est.deriv;\n\n";

function once(s, m, what) {
  const n = s.split(m).length - 1;
  if (n !== 1) throw new Error(what + ": found " + n + " times, not once");
  return s.indexOf(m);
}
function braceEnd(s, i) {
  let d = 0;
  for (let j = s.indexOf("{", i); j < s.length; j++) {
    if (s[j] === "{") d++;
    else if (s[j] === "}" && --d === 0) return j + 1;
  }
  throw new Error("unbalanced braces after " + i);
}
// A top-level function from the start of the doc comment right above it to
// its closing brace.
function region(s, name) {
  const i = once(s, "\n    function " + name + "(", name) + 1;
  const c = s.lastIndexOf("\n    /**\n", i) + 1;
  const doc = s.slice(c, i);
  if (!doc.endsWith("     */\n") || doc.indexOf("*/") !== doc.length - 3) throw new Error(name + ": no doc comment right above it");
  return [c, braceEnd(s, i)];
}

const block = base.slice(once(base, FROM, "3.14.2 block start"), once(base, TO, "3.14.2 block end"));

// 1. The body, word for word.
const [ea, eb] = region(neu, "estimateItemPrice");
const fnText = neu.slice(ea, eb);
const sigAt = once(fnText, SIG, "estimateItemPrice's signature");
if (!fnText.endsWith(RET)) throw new Error("estimateItemPrice does not end with its return");
const body = fnText.slice(sigAt + SIG.length, fnText.length - RET.length);
const back = body.split("\n").map((l) => (l ? "    " + l : l)).join("\n");
if (back !== block) throw new Error("estimateItemPrice's body is not the 3.14.2 block moved 4 spaces left");

// 2. Everything else.
let r = neu;
const had = [];
for (const name of ["badgePriceFor", "estimateItemPrice"]) {
  if (!r.includes("\n    function " + name + "(")) continue;
  const [a, b] = region(r, name);
  if (r.slice(b, b + 2) !== "\n\n") throw new Error(name + ": no blank line after it");
  r = r.slice(0, a) + r.slice(b + 2);
  had.push(name);
}
const k = once(r, CALL, "the call in injectPriceTags");
r = r.slice(0, k) + block + r.slice(k + CALL.length);
const [ta, tb] = region(r, "tradeRwValue"), [ba, bb] = region(base, "tradeRwValue");
const tradeChanged = r.slice(ta, tb) !== base.slice(ba, bb);
r = r.slice(0, ta) + base.slice(ba, bb) + r.slice(tb);
const versions = [];
for (const re of [/^\/\/ @version .*$/m, /^    var SCRIPT_VERSION = .*$/m]) {
  const was = base.match(re)[0], now = r.match(re)[0];
  if (was !== now) versions.push(now.trim());
  r = r.replace(re, () => was);
}
if (r !== base) {
  const x = r.split("\n"), y = base.split("\n");
  let i = 0;
  while (i < x.length && x[i] === y[i]) i++;
  console.log("first difference at 3.14.2 line " + (i + 1) + ":\n  3.14.2: " + JSON.stringify(y[i]) + "\n  build:  " + JSON.stringify(x[i]));
  process.exit(1);
}
console.log("move check OK: estimateItemPrice's body is the 3.14.2 block, 4 spaces left; " +
  "the rest is 3.14.2 except " + [...had.reverse(), tradeChanged ? "tradeRwValue" : null].filter(Boolean).join(", ") +
  (versions.length ? " and " + versions.join(" / ") : ""));
```

- [ ] **Step 4: Move the estimator**

Create `$WS/tools/extract-estimator.py`:

```python
# Moves the badge's estimator out of injectPriceTags into its own function,
# estimateItemPrice, word for word but 4 spaces further left, and has
# injectPriceTags call it where the block was.
# Usage: python3 -I extract-estimator.py <torn-rw-pricer.user.js>
import sys
p = sys.argv[1]
s = open(p, encoding="utf-8").read()
FROM = "            // Determine bonus color tier for each bonus (falls back to weapon rarity)\n"
TO = "            // Gather full price arrays for tooltip\n"
HOST = "    function injectPriceTags() {\n"
for m in (FROM, TO, HOST):
    assert s.count(m) == 1, "marker not found exactly once: " + m.strip()
assert "function estimateItemPrice(" not in s, "already extracted"
a, b, h = s.index(FROM), s.index(TO), s.index(HOST)
assert h < a < b
block = s[a:b]
assert block.endswith("}\n\n"), "the block no longer ends with a blank line"
assert "\t" not in block
for ln in block.split("\n"):
    assert ln == "" or ln.startswith("            "), "line not indented 12: " + ln
moved = "\n".join(ln[4:] if ln else ln for ln in block.split("\n"))
CALL = ("            var est = estimateItemPrice(weaponKey, itemKey, rarity, bonuses, median, comboFn, bonusFn);\n"
        "            var bonusColors = est.bonusColors, estimatedPrice = est.price, estSource = est.source, deriv = est.deriv;\n"
        "\n")
FUNC = r'''    /**
     * What an item's badge prices it at, worked out from its bonuses.
     *
     * weaponKey is the weapon's name, or null for a piece of armour; itemKey
     * is the item's name either way, and comboFn and bonusFn are the combo
     * and bonus lookups for that kind of item. The estimate starts from
     * median, the item's colour median. The caller picks the price tables
     * first, in ACTIVE, and nothing outside this function is changed.
     *
     * Returns the price, which can come to 0 (the badge then shows the
     * median), the source the price rests on, the tooltip's working as a line
     * per step, and the colour each bonus was read at.
     */
    function estimateItemPrice(weaponKey, itemKey, rarity, bonuses, median, comboFn, bonusFn) {
''' + moved + r'''        return { price: estimatedPrice, source: estSource, deriv: deriv, bonusColors: bonusColors };
    }

'''
s = s[:a] + CALL + s[b:]
h = s.index(HOST)
s = s[:h] + FUNC + s[h:]
open(p, "w", encoding="utf-8").write(s)
print("moved %d lines into estimateItemPrice" % (block.count("\n") - 1))
```

Run it, then check the result:

```bash
WS=/opt/warboard/.superpowers/sdd/2026-10-23-rwp-trade-window-badge-price; S=$WS/ov/public/scripts/torn-rw-pricer.user.js
python3 -I $WS/tools/extract-estimator.py $S && node --check $S && node $WS/tools/move-check.mjs $WS/base.user.js $S && sha256sum $S | cut -c1-8
```

Expected:

```
moved 288 lines into estimateItemPrice
move check OK: estimateItemPrice's body is the 3.14.2 block, 4 spaces left; the rest is 3.14.2 except estimateItemPrice
bc96c47f
```

- [ ] **Step 5: Watch them pass**

```bash
bash /opt/warboard/.superpowers/sdd/2026-10-23-rwp-trade-window-badge-price/tools/run-tests.sh rwp-trade-badge.test.mjs
```

Expected: `tests 3 pass 3 fail 0 skipped 0 exit 0`.

- [ ] **Step 6: The other estimator tests, now through the call**

```bash
bash /opt/warboard/.superpowers/sdd/2026-10-23-rwp-trade-window-badge-price/tools/run-tests.sh rwp-second-bonus.test.mjs rwp-exact-gun.test.mjs rwp-trade.test.mjs
```

Expected: `tests 55 pass 55 fail 0 skipped 0 exit 0` (9, 17 and 29). The first two files now run `injectPriceTags`' call to `estimateItemPrice`, which tests Task 1's change.

- [ ] **Step 7: The whole suite**

```bash
uptime; bash /opt/warboard/.superpowers/sdd/2026-10-23-rwp-trade-window-badge-price/tools/run-tests.sh
```

Expected: `tests 2181 pass 2179 fail 0 skipped 2 exit 0`.

- [ ] **Step 8: Close the task**

Run the executing-plans `task-done` for Task 2 with the test command `bash /opt/warboard/.superpowers/sdd/2026-10-23-rwp-trade-window-badge-price/tools/run-tests.sh rwp-trade-badge.test.mjs rwp-second-bonus.test.mjs rwp-exact-gun.test.mjs rwp-trade.test.mjs`.

Expected: the ledger line ends `→ tests 58 pass 58 fail 0 skipped 0 exit 0`. Then add `Task 2: overlay hashes: torn-rw-pricer.user.js bc96c47f, rwp-trade-badge.test.mjs 5a013fb2`.

---

### Task 3: The trade window counts the badge's price

**Files:**
- Create: `$WS/tools/edit-trade-test.py` and `$WS/tools/trade-uses-badge.py`.
- Modify, in the overlay:
  - `$WS/ov/rwp-trade.test.mjs`: its sandbox only;
  - `$WS/ov/rwp-trade-badge.test.mjs`: 17 tests appended;
  - `$WS/ov/public/scripts/torn-rw-pricer.user.js`: `badgePriceFor` added above `injectPriceTags`. `tradeRwValue` (3.14.2 lines 4111 to 4125) gets a paragraph in its doc comment and the badge's price.

**Interfaces:**
- Consumes: `estimateItemPrice`, and the test helpers from Task 2.
- Produces:
  - `badgePriceFor(weaponKey, rarity, bonuses)` returns a number, or null when `getMedianPrice(weaponKey, rarity)` is empty. The number is `est.price || median`, which is what the badge shows. The table choice is `injectPriceTags`' line, word for word, and the caller's `ACTIVE` is put back in a `finally`.
  - `tradeRwValue(rowLi, name)` returns a number, with the same signature as before:
    - 0 with no row, name, icon or bonus;
    - 0 when the name is not a weapon (`lookupWeapon(normalizeWeaponName(name))` is empty);
    - with a colour on the icon, `badgePriceFor`'s price when it is above 0;
    - otherwise `priceForumRow`'s value, or 0.

- [ ] **Step 1: Give the trade test's sandbox what the estimator reads**

This step comes first. `rwp-trade.test.mjs` runs the real `tradeRwValue` in its test "a plain item keeps its market price, an RW weapon does not". After Step 4, `tradeRwValue` calls `badgePriceFor` and the estimator. Without their lookups in the sandbox, that test fails with `'badgePriceFor is not defined'` (checked while writing this plan) rather than on what it asserts.

Create `$WS/tools/edit-trade-test.py`:

```python
# rwp-trade.test.mjs prices trade rows with the real tradeRwValue, which now
# runs the badge's estimator: its sandbox gets what the estimator reads.
# Usage: python3 -I edit-trade-test.py <dir holding rwp-trade.test.mjs>
import os, sys
p = os.path.join(sys.argv[1], "rwp-trade.test.mjs")
s = open(p, encoding="utf-8").read()
EDITS = [
    ('const SRC = fs.readFileSync(new URL("./public/scripts/torn-rw-pricer.user.js", import.meta.url), "utf8");\n',
     'const SRC = fs.readFileSync(process.env.RWP_SRC || new URL("./public/scripts/torn-rw-pricer.user.js", import.meta.url), "utf8");\n'),
    ('  return m[0].trim();\n}\n\nconst sandbox = { FEED };\n',
     '  return m[0].trim();\n}\n'
     '// Pieces only a build with the shared estimator has. A build without them\n'
     '// still loads, so the tests show it failing rather than erroring.\n'
     'const fnIfAny = (name) => (SRC.includes("function " + name + "(") ? fn(name) : "");\n'
     '\nconst sandbox = { FEED };\n'),
    ('  "var recentTables = FEED.recent || null; var ACTIVE = null; var ITEM_ALIASES = {};",\n',
     '  "var recentTables = FEED.recent || null; var ACTIVE = null; var ITEM_ALIASES = {};",\n'
     '  "var weaponExactPrices = FEED.weaponExactPrices || {};",\n'
     '  // The colour each bonus is read at, as the badge reads it.\n'
     '  v("BONUS_ID_MAP"), SRC.slice(SRC.indexOf("var BONUS_COLOR_RANGES = {"), SRC.indexOf("// ─── Fetching flag ───")),\n'),
    ('  fn("parseTradeBonusTitle"),\n].join("\\n"), sandbox, { timeout: 5000, filename: "rwp-trade.js" });\n',
     '  fn("parseTradeBonusTitle"),\n'
     '  // The badge\'s estimator, which a trade row is priced with.\n'
     '  fn("getBonusMedian"), fn("getWeaponComboThinArray"), fn("getWeaponComboPriceArray"), fn("getWeaponPairComboArray"),\n'
     '  fn("getPriceArray"), fn("getBonusPriceArray"), fn("getWeaponExactGun"), fn("monthYearOfDay"),\n'
     '  fnIfAny("estimateItemPrice"), fnIfAny("badgePriceFor"),\n'
     '].join("\\n"), sandbox, { timeout: 5000, filename: "rwp-trade.js" });\n'),
]
for old, new in EDITS:
    assert s.count(old) == 1, "not found exactly once: " + old.splitlines()[0]
    s = s.replace(old, new)
open(p, "w", encoding="utf-8").write(s)
print("edited rwp-trade.test.mjs")
```

```bash
WS=/opt/warboard/.superpowers/sdd/2026-10-23-rwp-trade-window-badge-price
python3 -I $WS/tools/edit-trade-test.py $WS/ov && sha256sum $WS/ov/rwp-trade.test.mjs | cut -c1-8 && bash $WS/tools/run-tests.sh rwp-trade.test.mjs
```

Expected: `edited rwp-trade.test.mjs`, `b055eb9b`, then `tests 29 pass 29 fail 0 skipped 0 exit 0`.

- [ ] **Step 2: Write the failing tests**

Append this to the end of `$WS/ov/rwp-trade-badge.test.mjs`. It begins with a blank line:

```js

// ── The trade counts the badge's price ─────────────────────────

test("the owner's gun counts in a trade at its badge's price", () => {
  const t = trader(OWNER());
  assert.equal(t.badge(GUN, "Orange", copy(OWNER_BONUSES)).shown, 3574795103);
  assert.equal(t.tradeRwValue(row(icon(OWNER_BONUSES, "Orange")), GUN), 3574795103,
    "the forum ladder says $3,193,164,535, the 14% Revitalize alone");
});

test("a two-bonus gun whose pair never sold is priced as the badge builds it, not by its lead bonus", () => {
  // Both bonuses sold at other rolls only, and the pair never: the badge
  // builds it from the two and blends in the colour median.
  const feed = OWNER();
  delete feed.levelPrices;
  delete feed.exactPrices;
  feed.comboPrices[GUN + "|Conserve"].Orange = [900000000, 1500000000, 2500000000, 59];
  const t = trader(feed);
  assert.equal(t.badge(GUN, "Orange", copy(OWNER_BONUSES)).shown, 2885503405);
  assert.equal(t.tradeRwValue(row(icon(OWNER_BONUSES, "Orange")), GUN), 2885503405,
    "the lead bonus alone is $3.00B");
});

test("a one-bonus gun reads last year's tables, as its badge does", () => {
  const t = trader(SINGLE());
  assert.equal(t.badge(GUN, "Orange", [REVIT(14)]).shown, 2600000000);
  assert.equal(t.tradeRwValue(row(icon([REVIT(14)], "Orange")), GUN), 2600000000,
    "every year's tables give $3.00B, the forum ladder $3.25B");
});

test("a one-bonus gun whose bonus never sold counts at last year's colour median, as its badge does", () => {
  // With no sale of Conserve on this gun at any roll, the badge falls back to
  // the colour median: last year's, for a gun with one bonus.
  const t = trader(SINGLE());
  const conserve = [{ name: "Conserve", level: 26 }];
  assert.equal(t.badge(GUN, "Orange", copy(conserve)).shown, 180000001);
  assert.equal(t.tradeRwValue(row(icon(conserve, "Orange")), GUN), 180000001, "every year's median is $200,000,001");
});

test("a gun whose badge shows a range counts at the badge's estimate, the low end", () => {
  // Specialist has never sold on a Red ArmaLite, and what it fetches on
  // other weapons is under this one's floor. The badge reads the floor and
  // shows $2.03B to $6.49B; a trade row has room for one number.
  const ARMALITE = "ArmaLite M-15A4";
  const t = trader({
    bonusPrices: { Specialist: { Red: [10000000, 50000000, 100000000, 30] } },
    weaponPrices: { [ARMALITE]: { Red: [2030000000, 6490000000, 20000000000, 40] } },
  });
  const b = t.badge(ARMALITE, "Red", [{ name: "Specialist", level: 41 }]);
  assert.equal(b.source, "weapon floor");
  assert.equal(b.est, 2030000000);
  assert.equal(b.median, 6490000000);
  assert.equal(t.tradeRwValue(row(icon([{ name: "Specialist", level: 41 }], "Red")), ARMALITE), 2030000000,
    "the forum ladder says $6.49B, the colour median");
});

test("the badge shows its estimate, or the colour median when the estimate comes to nothing", () => {
  // badge() above restates this rule; this holds it to createBadge.
  assert.match(fn("createBadge"), /var displayPrice = estimatedPrice \|\| median;/);
  // One sale of 14% Revitalize, recorded at $0: the estimate is 0.
  const t = trader({
    bonusPrices: { Revitalize: {} },
    weaponPrices: { [GUN]: { Orange: [61800001, 200000001, 10574554640, 647] } },
    comboPrices: { [GUN + "|Revitalize"]: { Orange: [0, 0, 0, 1] } },
  });
  assert.equal(t.badge(GUN, "Orange", [REVIT(14)]).est, 0);
  assert.equal(t.badgePriceFor(GUN, "Orange", [REVIT(14)]), 200000001);
});

// ── Where the badge has nothing to say ─────────────────────────

test("with no colour on the icon, the forum ladder prices it as before", () => {
  const t = trader(OWNER());
  const title = icon(OWNER_BONUSES, null);
  assert.equal(t.parseTradeBonusTitle(title).rarity, null);
  // The ladder works the colour out from the 14% Revitalize: only Orange has sold at 14%.
  assert.equal(t.priceForumRow({ name: GUN, rarity: null, bonuses: copy(OWNER_BONUSES) }).value, 3193164535);
  assert.equal(t.tradeRwValue(row(title), GUN), 3193164535);
});

test("with no colour median for the weapon, the forum ladder prices it as before", () => {
  // 14% Revitalize has sold on Orange Bushmasters, but the gun has no Orange
  // median and no class one: the badge shows nothing.
  const t = trader({
    bonusPrices: { Revitalize: {} },
    weaponPrices: { [GUN]: { Yellow: [1000000, 5000000, 9000000, 50] } },
    levelPrices: { [GUN + "|Revitalize"]: { Orange: { 14: [3193164535, 4] } } },
  });
  assert.equal(t.badge(GUN, "Orange", [REVIT(14)]), null);
  assert.equal(t.tradeRwValue(row(icon([REVIT(14)], "Orange")), GUN), 3193164535);
});

test("armour, and a name that is no weapon, claim nothing", () => {
  const t = trader(OWNER());
  assert.equal(t.tradeRwValue(row(icon(OWNER_BONUSES, "Orange")), "Sentinel Helmet"), 0);
  assert.equal(t.tradeRwValue(row(icon(OWNER_BONUSES, "Orange")), "Not A Weapon"), 0);
});

// ── The table choice ───────────────────────────────────────────

test("pricing a trade row leaves the table choice as it found it", () => {
  const t = trader(SINGLE());
  const left = {};
  t.ACTIVE = left;
  t.tradeRwValue(row(icon([REVIT(14)], "Orange")), GUN);
  assert.equal(t.ACTIVE, left);
});

test("a choice left over from the page's last badge does not reach the trade", () => {
  // injectPriceTags leaves the choice set for the last item it priced. Last
  // year's tables, left there by a one-bonus badge, must not price a
  // two-bonus gun in the trade.
  const feed = OWNER();
  feed.recent = {
    weaponPrices: { [GUN]: { Orange: [50000001, 150000001, 9000000000, 300] } },
    comboPrices: {
      [GUN + "|Conserve"]: { Orange: [20000001, 30000001, 60000001, 25] },
      [GUN + "|Revitalize"]: { Orange: [1200000000, 2500000000, 5000000000, 20] },
    },
    levelPrices: { [GUN + "|Revitalize"]: { Orange: { 14: [2500000000, 3] } } },
  };
  const t = trader(feed);
  t.ACTIVE = t.recentTables;
  assert.equal(t.tradeRwValue(row(icon(OWNER_BONUSES, "Orange")), GUN), 3574795103,
    "read from last year's tables it is $3,163,082,432");
});

test("a choice left over from a two-bonus badge does not reach a one-bonus trade row", () => {
  // The other way round: a two-bonus badge leaves every year's tables
  // chosen. A one-bonus gun whose bonus never sold counts at last year's
  // colour median, so a median read under the leftover choice would show.
  const t = trader(SINGLE());
  t.badge(GUN, "Orange", copy(OWNER_BONUSES));
  assert.equal(t.ACTIVE, null);
  assert.equal(t.tradeRwValue(row(icon([{ name: "Conserve", level: 26 }], "Orange")), GUN), 180000001,
    "read under every year's tables it is $200,000,001");
});

test("the table choice is written the same in the badge loop and the trade's helper", () => {
  assert.equal(SRC.split(ACTIVE_LINE).length - 1, 2, "chosen this way exactly twice");
  assert.ok(fn("injectPriceTags").includes(ACTIVE_LINE));
  assert.ok(fn("badgePriceFor").includes(ACTIVE_LINE));
});

// ── What else a trade row can carry ────────────────────────────

test("the order Torn lists the two bonuses in does not change the price", () => {
  const t = trader(OWNER());
  assert.equal(t.tradeRwValue(row(icon([OWNER_BONUSES[1], OWNER_BONUSES[0]], "Orange")), GUN), 3574795103);
});

test("a name written with other punctuation is the same gun", () => {
  const t = trader(OWNER());
  assert.equal(t.tradeRwValue(row(icon(OWNER_BONUSES, "Orange")), "Bushmaster Carbon-15"), 3574795103);
});

test("after a cached load with no last-year tables, a one-bonus gun still matches its badge", () => {
  const feed = SINGLE();
  delete feed.recent;
  const t = trader(feed);
  assert.equal(t.badge(GUN, "Orange", [REVIT(14)]).shown, 3000000000);
  assert.equal(t.tradeRwValue(row(icon([REVIT(14)], "Orange")), GUN), 3000000000,
    "the forum ladder says $3,566,890,179");
});

test("on a feed cached before the exact-gun table, the trade still matches the badge", () => {
  const feed = OWNER();
  delete feed.exactPrices;
  const t = trader(feed);
  assert.equal(t.badge(GUN, "Orange", copy(OWNER_BONUSES)).shown, 3193164535);
  assert.equal(t.tradeRwValue(row(icon(OWNER_BONUSES, "Orange")), GUN), 3193164535);
});
```

```bash
sha256sum /opt/warboard/.superpowers/sdd/2026-10-23-rwp-trade-window-badge-price/ov/rwp-trade-badge.test.mjs | cut -c1-8
```

Expected: `80bf12ea`.

- [ ] **Step 3: Watch them fail**

```bash
bash /opt/warboard/.superpowers/sdd/2026-10-23-rwp-trade-window-badge-price/tools/run-tests.sh rwp-trade-badge.test.mjs
```

Expected:

```
not ok 4 - the owner's gun counts in a trade at its badge's price
not ok 5 - a two-bonus gun whose pair never sold is priced as the badge builds it, not by its lead bonus
not ok 6 - a one-bonus gun reads last year's tables, as its badge does
not ok 8 - a gun whose badge shows a range counts at the badge's estimate, the low end
not ok 9 - the badge shows its estimate, or the colour median when the estimate comes to nothing
not ok 14 - a choice left over from the page's last badge does not reach the trade
not ok 16 - the table choice is written the same in the badge loop and the trade's helper
not ok 17 - the order Torn lists the two bonuses in does not change the price
not ok 18 - a name written with other punctuation is the same gun
not ok 19 - after a cached load with no last-year tables, a one-bonus gun still matches its badge
full output: /opt/warboard/.superpowers/sdd/2026-10-23-rwp-trade-window-badge-price/out/tests-<HHMMSS>-<pid>.txt
tests 20 pass 10 fail 10 skipped 0 exit 1
```

In the full output, each fails on the forum ladder's figure:

| Test | Expected | Actual |
|---|---|---|
| 4, 14, 17, 18 | 3574795103 | 3193164535 |
| 5 | 2885503405 | 3000000000 |
| 6 | 2600000000 | 3250000000 |
| 8 | 2030000000 | 6490000000 |
| 9 | (error) | `'t.badgePriceFor is not a function'` |
| 16 | 2 | 1 |
| 19 | 3000000000 | 3566890179 |

Tests 7, 10, 11, 12, 13, 15 and 20 pass already. They hold what must stay as it is:
- last year's median for a bonus that never sold;
- the two fallbacks;
- armour;
- the table choice put back afterwards;
- a feed without the exact-gun table.

- [ ] **Step 4: Make the trade count the badge's price**

Create `$WS/tools/trade-uses-badge.py`:

```python
# Has the trade window count a weapon at its badge's price: adds badgePriceFor
# just above injectPriceTags, and has tradeRwValue use it, keeping the forum
# ladder for the rows the badge has nothing to say about.
# Usage: python3 -I trade-uses-badge.py <torn-rw-pricer.user.js>
import sys
p = sys.argv[1]
s = open(p, encoding="utf-8").read()
HOST = "    function injectPriceTags() {\n"
assert s.count(HOST) == 1, "injectPriceTags not found exactly once"
assert s.count("    function estimateItemPrice(") == 1, "run extract-estimator.py first"
assert "function badgePriceFor(" not in s, "already applied"
HELPER = r'''    /**
     * The badge's price for a weapon known only by its name, colour and
     * bonuses, as a trade row knows it.
     *
     * It reads the tables the badge reads, last year's for a weapon with one
     * bonus and every year's for two, and puts the caller's choice back
     * afterwards. Returns null when the weapon has no median at that colour,
     * which is when the badge shows nothing.
     */
    function badgePriceFor(weaponKey, rarity, bonuses) {
        var prevActive = ACTIVE;
        // Word for word as in injectPriceTags; a test holds the two together.
        ACTIVE = (weaponKey && recentTables && bonuses.length === 1) ? recentTables : null;
        try {
            var median = getMedianPrice(weaponKey, rarity);
            if (!median) return null;
            var est = estimateItemPrice(weaponKey, weaponKey, rarity, bonuses, median, getWeaponComboMedian, getBonusMedian);
            return est.price || median;
        } finally {
            ACTIVE = prevActive;
        }
    }

'''
OLD = r'''     * worth its market price, and replacing that with anything would be wrong.
     */
    function tradeRwValue(rowLi, name) {
        if (!rowLi || !name) return 0;
        var icon = rowLi.querySelector('i.networth-info-icon[title]');
        if (!icon) return 0;
        var t = parseTradeBonusTitle(icon.getAttribute('title'));
        if (!t) return 0;
        var p = priceForumRow({ name: name, rarity: t.rarity, bonuses: t.bonuses });
'''
NEW = r'''     * worth its market price, and replacing that with anything would be wrong.
     *
     * The figure is the badge's, so a gun is worth the same in a trade as on
     * its own row. Where the badge has nothing to say, because the icon gives
     * no colour or the weapon has no colour median, the forum ladder prices
     * it, working the colour out from the roll if it has to.
     */
    function tradeRwValue(rowLi, name) {
        if (!rowLi || !name) return 0;
        var icon = rowLi.querySelector('i.networth-info-icon[title]');
        if (!icon) return 0;
        var t = parseTradeBonusTitle(icon.getAttribute('title'));
        if (!t) return 0;
        var key = lookupWeapon(normalizeWeaponName(name));
        if (!key) return 0;
        if (t.rarity) {
            var b = badgePriceFor(key, t.rarity, t.bonuses);
            if (b > 0) return b;
        }
        var p = priceForumRow({ name: name, rarity: t.rarity, bonuses: t.bonuses });
'''
assert s.count(OLD) == 1, "tradeRwValue is not as expected"
s = s.replace(OLD, NEW)
h = s.index(HOST)
s = s[:h] + HELPER + s[h:]
open(p, "w", encoding="utf-8").write(s)
print("badgePriceFor added; tradeRwValue uses it")
```

```bash
WS=/opt/warboard/.superpowers/sdd/2026-10-23-rwp-trade-window-badge-price; S=$WS/ov/public/scripts/torn-rw-pricer.user.js
python3 -I $WS/tools/trade-uses-badge.py $S && node --check $S && node $WS/tools/move-check.mjs $WS/base.user.js $S && sha256sum $S | cut -c1-8
```

Expected:

```
badgePriceFor added; tradeRwValue uses it
move check OK: estimateItemPrice's body is the 3.14.2 block, 4 spaces left; the rest is 3.14.2 except estimateItemPrice, badgePriceFor, tradeRwValue
0490e7fc
```

The move check also proves nothing else moved. With the two new functions taken out, the block put back and `tradeRwValue` as it was, the file is 3.14.2.

- [ ] **Step 5: Watch them pass**

```bash
bash /opt/warboard/.superpowers/sdd/2026-10-23-rwp-trade-window-badge-price/tools/run-tests.sh rwp-trade-badge.test.mjs
```

Expected: `tests 20 pass 20 fail 0 skipped 0 exit 0`.

- [ ] **Step 6: The four RW Pricer files, then the whole suite**

```bash
WS=/opt/warboard/.superpowers/sdd/2026-10-23-rwp-trade-window-badge-price
bash $WS/tools/run-tests.sh rwp-trade-badge.test.mjs rwp-second-bonus.test.mjs rwp-exact-gun.test.mjs rwp-trade.test.mjs; uptime; bash $WS/tools/run-tests.sh
```

Expected: `tests 75 pass 75 fail 0 skipped 0 exit 0`, then `tests 2198 pass 2196 fail 0 skipped 2 exit 0`.

- [ ] **Step 7: Close the task**

Run the executing-plans `task-done` for Task 3 with the test command `bash /opt/warboard/.superpowers/sdd/2026-10-23-rwp-trade-window-badge-price/tools/run-tests.sh rwp-trade-badge.test.mjs rwp-second-bonus.test.mjs rwp-exact-gun.test.mjs rwp-trade.test.mjs`.

Expected: the ledger line ends `→ tests 75 pass 75 fail 0 skipped 0 exit 0`. Then add `Task 3: overlay hashes: torn-rw-pricer.user.js 0490e7fc, rwp-trade-badge.test.mjs 80bf12ea, rwp-trade.test.mjs b055eb9b`.

---

### Task 4: The back-test, the owner's gun, and mutants

**Files:**
- Create: `$WS/tools/engine.mjs`, `$WS/tools/bt-3143.mjs`, `$WS/tools/owner-3143.mjs` and `$WS/tools/mutate-3143.cjs`; outputs in `$WS/out/`.
- Nothing in the overlay changes.

**Interfaces:**
- Consumes: the Task 3 build and tests, the back-test CSV, and the live feed `/opt/warboard/server/data/rwp-prices.json` (read only).
- Produces: `$WS/out/bt.txt`, `$WS/out/owner.txt` and `$WS/out/mutants.txt`, which go into Task 6's review package.
  - `engine.mjs` exports `loadEngine(scriptPath)`, a vm sandbox holding the script's own table builders and estimator, and `lift(src, name)`.
  - `bt-3143.mjs` and `mutate-3143.cjs` exit 1 when their gate fails.

- [ ] **Step 1: Write the engine and the back-test**

Create `$WS/tools/engine.mjs`:

```js
// Lifts RW Pricer's OWN table builders and its badge estimator out of the
// userscript source and runs them in a vm, so a back-test measures the exact
// code that ships. Reads the estimator inline in injectPriceTags (3.14.2 and
// before) or as estimateItemPrice, with badgePriceFor where the script has it.
// Nothing here touches the network or the DOM.
import fs from "node:fs";
import vm from "node:vm";

const START = "'use strict';";
const PARSER_END = "    function parseArmourCSVAndComputePrices(";
const EST_FROM = "// Determine bonus color tier for each bonus";
const EST_TO = "// Gather full price arrays for tooltip";

function lineStart(src, idx) { return src.lastIndexOf("\n", idx) + 1; }
export function lift(src, name) {
  const i = src.indexOf("function " + name + "(");
  if (i < 0) throw new Error("engine: missing " + name);
  const o = src.indexOf("{", i); let d = 0;
  for (let j = o; j < src.length; j++) { if (src[j] === "{") d++; else if (src[j] === "}" && --d === 0) return src.slice(i, j + 1); }
  throw new Error("engine: unbalanced braces in " + name);
}

export function loadEngine(scriptPath) {
  const src = fs.readFileSync(scriptPath, "utf8");
  const a = src.indexOf(START), b = src.indexOf(PARSER_END);
  if (a < 0 || b < 0 || !(a < b)) throw new Error("engine: parser markers not found in " + scriptPath);
  const prefix = src.slice(a + START.length, b);
  let estimate;
  if (src.includes("function estimateItemPrice(")) {
    estimate = lift(src, "estimateItemPrice") + "\n" +
      "function __estimate(itemKey, weaponKey, armourKey, rarity, bonuses, median, comboFn, bonusFn) {\n" +
      "  var r = estimateItemPrice(weaponKey, itemKey, rarity, bonuses, median, comboFn, bonusFn);\n" +
      "  return { est: r.price, src: r.source, deriv: r.deriv, colors: r.bonusColors };\n}\n" +
      (src.includes("function badgePriceFor(") ? lift(src, "badgePriceFor") + "\n" : "");
  } else {
    const e1 = src.indexOf(EST_FROM), e2 = src.indexOf(EST_TO);
    if (e1 < 0 || e2 < 0 || !(b < e1 && e1 < e2)) throw new Error("engine: estimator markers not found in " + scriptPath);
    estimate = "function __estimate(itemKey, weaponKey, armourKey, rarity, bonuses, median, comboFn, bonusFn) {\n" +
      src.slice(lineStart(src, e1), lineStart(src, e2)) +
      "\nreturn { est: estimatedPrice, src: estSource, deriv: deriv, colors: bonusColors };\n}\n";
  }
  const code = prefix + "\n" + estimate +
    "function __setTables(w) { recentTables = w.recent || null; weaponPrices = w.weaponPrices; bonusPrices = w.bonusPrices;" +
    " classPrices = w.classPrices; weaponComboPrices = w.comboPrices; weaponPairComboPrices = w.pairComboPrices || {};" +
    " weaponLevelPrices = w.levelPrices || {}; if (w.itemAliases) ITEM_ALIASES = w.itemAliases;" +
    " if (w.weaponMaxBonus) weaponMaxBonus = w.weaponMaxBonus; ACTIVE = null;" +
    // The exact-gun table, every year, as the page loads it (3.14.2 on).
    " if (typeof weaponExactPrices !== 'undefined') weaponExactPrices = w.pairLevelPrices || {}; }\n" +
    "function __setFeed(j) { weaponPrices = j.weaponPrices; bonusPrices = j.bonusPrices; if (j.classPrices) classPrices = j.classPrices;" +
    " if (j.weaponComboPrices) weaponComboPrices = j.weaponComboPrices; if (j.weaponPairComboPrices) weaponPairComboPrices = j.weaponPairComboPrices;" +
    " if (j.weaponLevelPrices) weaponLevelPrices = j.weaponLevelPrices; if (j.itemAliases) ITEM_ALIASES = j.itemAliases;" +
    " if (j.weaponMaxBonus) weaponMaxBonus = j.weaponMaxBonus; recentTables = j.recent || null; ACTIVE = null; }\n" +
    // One item, priced the way injectPriceTags prices it: the table set is
    // chosen first (recent for a single-bonus weapon, all-time otherwise),
    // then the colour median, then the estimator.
    "function __price(weaponKey, rarity, bonuses) {\n" +
    "  ACTIVE = (weaponKey && recentTables && bonuses.length === 1) ? recentTables : null;\n" +
    "  var median = getMedianPrice(weaponKey, rarity); if (!median) { ACTIVE = null; return null; }\n" +
    "  var r = __estimate(weaponKey, weaponKey, null, rarity, bonuses, median, getWeaponComboMedian, getBonusMedian);\n" +
    "  r.median = median; ACTIVE = null; return r;\n}\n" +
    // The best exact-roll single-bonus median among the bonuses: the number a
    // floor would hold the estimate to. Read from the all-time tables, the
    // same set a two-bonus item reads.
    "function __exactBest(weaponKey, rarity, bonuses) {\n" +
    "  ACTIVE = null; var best = null;\n" +
    "  for (var i = 0; i < bonuses.length; i++) { var b = bonuses[i]; if (!b.level) continue;\n" +
    "    var c = getWeaponLevelCount(weaponKey, b.name, rarity, b.level); if (!c) continue;\n" +
    "    var m = getWeaponLevelMedian(weaponKey, b.name, rarity, b.level);\n" +
    "    if (m && (!best || m > best.value)) best = { value: m, count: c, name: b.name, level: b.level }; }\n" +
    "  return best;\n}\n";
  const mem = () => { const m = new Map(); return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)),
    removeItem: k => m.delete(k), clear: () => m.clear(), key: i => [...m.keys()][i] ?? null, get length() { return m.size; } }; };
  const sandbox = { console, localStorage: mem(), sessionStorage: mem(), setTimeout: () => 0, clearTimeout() {}, setInterval: () => 0, clearInterval() {} };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox, { filename: "rwp-engine.js" });
  return sandbox;
}
```

Create `$WS/tools/bt-3143.mjs`:

```js
// 3.14.2 against 3.14.3 on every test sale (the newest 20% of the auction
// CSV, the tables built from the rest): the badge byte-identical, the forum
// ladder byte-identical, and the trade's figure (badgePriceFor) equal to what
// the 3.14.2 badge showed. Then the trade window scored before and after.
// Exits 1 unless every one of those counts is 0.
import fs from "node:fs";
import zlib from "node:zlib";
import vm from "node:vm";
import { loadEngine, lift } from "./engine.mjs";
const [,, oldScript, newScript, csvGz] = process.argv;
function engine(script) {
  const s = loadEngine(script), SRC = fs.readFileSync(script, "utf8");
  // Auction rows carry Torn's canonical weapon names, so name lookups are identity.
  vm.runInContext(["function lookupWeapon(n) { return n; }", "function normalizeWeaponName(n) { return n; }",
    lift(SRC, "forumBonusWorth"), lift(SRC, "priceForumRow")].join("\n"), s);
  return s;
}
const A = engine(oldScript), B = engine(newScript);
const rows = zlib.gunzipSync(fs.readFileSync(csvGz)).toString("utf8").split("\n").filter((l) => l.trim())
  .map((l, i) => ({ l: l.trim(), i, ts: parseInt(l, 10) || 0 })).sort((a, b) => a.ts - b.ts || a.i - b.i);
const cut = Math.floor(rows.length * 0.8);
const train = "header\n" + rows.slice(0, cut).map((r) => r.l).join("\n");
const w = A.parseCSVAndComputePrices(train); A.attachRecentPrices(train, w);
A.__setTables(w); B.__setTables(w);
const copy = (bs) => bs.map((b) => ({ ...b }));
let n = 0, badgeDiff = 0, forumDiff = 0, tradeDiff = 0, activeLeft = 0, noHelper = 0;
const ex = [], out = [];
for (const r of rows.slice(cut)) {
  const c = r.l.split(","); if (c.length < 15) continue;
  const price = parseInt(c[1], 10); if (!(price > 0)) continue;
  const rar = c[9]; if (rar === "1" || !A.RARITY_MAP[rar]) continue;
  const weapon = A.ITEM_ID_MAP[c[6]]; if (!weapon) continue;
  const bn1 = (c[14] && A.BONUS_ID_MAP[c[14]]) || null, bn2 = (c.length > 16 && c[16] && A.BONUS_ID_MAP[c[16]]) || null;
  if (!bn1 || bn1 === bn2) continue;
  const q1 = parseInt(c[15], 10) || 0, q2 = c.length > 17 ? (parseInt(c[17], 10) || 0) : 0;
  if (!(q1 > 0) || (bn2 && !(q2 > 0))) continue;
  const rarity = A.RARITY_MAP[rar];
  const bs = bn2 ? [{ name: bn1, level: q1 }, { name: bn2, level: q2 }] : [{ name: bn1, level: q1 }];
  const a = A.__price(weapon, rarity, copy(bs)), b = B.__price(weapon, rarity, copy(bs));
  if (!a && !b) continue;
  n++;
  if (JSON.stringify(a) !== JSON.stringify(b)) { badgeDiff++; if (ex.length < 3) ex.push(["badge", weapon, rarity, JSON.stringify(bs)]); }
  const fa = A.priceForumRow({ name: weapon, rarity, bonuses: copy(bs) }), fb = B.priceForumRow({ name: weapon, rarity, bonuses: copy(bs) });
  if (JSON.stringify(fa) !== JSON.stringify(fb)) { forumDiff++; if (ex.length < 3) ex.push(["forum", weapon, rarity, JSON.stringify(bs)]); }
  let t = null;
  if (typeof B.badgePriceFor === "function") {
    vm.runInContext("ACTIVE = null;", B);
    t = B.badgePriceFor(weapon, rarity, copy(bs));
    if (vm.runInContext("ACTIVE", B) !== null) activeLeft++;
    const shown = a ? (a.est || a.median) : null;
    if (t !== shown) { tradeDiff++; if (ex.length < 3) ex.push(["trade", weapon, rarity, JSON.stringify(bs), t, shown]); }
  } else noHelper++;
  if (a && fa) out.push({ price, before: fa.value, after: t != null ? t : NaN, two: !!bn2, pair: a.src === "exact pair" });
}
console.log({ sales: n, badgeDiff, forumDiff, tradeDiff, activeLeft, noHelper });
if (!n || badgeDiff || forumDiff || tradeDiff || activeLeft || noHelper) process.exitCode = 1;
for (const e of ex) console.log("  example:", ...e);
const med = (x) => { const s = [...x].sort((p, q) => p - q), k = s.length; return k ? (k % 2 ? s[(k - 1) / 2] : (s[k / 2 - 1] + s[k / 2]) / 2) : NaN; };
const score = (arr, f) => { let off = 0; const ra = []; for (const x of arr) { const e = f(x); ra.push(e / x.price); if (Math.abs(e - x.price) / x.price > 0.5) off++; }
  return `${(100 * off / arr.length).toFixed(1).padStart(5)}% off by >50%, median est/actual ${med(ra).toFixed(2)}`; };
const h = Math.floor(out.length / 2);
for (const [cn, cf] of [["one bonus", (x) => !x.two], ["two bonuses, pair comp", (x) => x.two && x.pair], ["two bonuses, no pair comp", (x) => x.two && !x.pair]]) {
  const A1 = out.slice(0, h).filter(cf), B1 = out.slice(h).filter(cf);
  console.log(`${cn.padEnd(26)} n=${A1.length}/${B1.length}`);
  console.log(`   trade before: ${score(A1, (x) => x.before)}  |  ${score(B1, (x) => x.before)}`);
  if (!noHelper) console.log(`   trade after:  ${score(A1, (x) => x.after)}  |  ${score(B1, (x) => x.after)}`);
}
```

- [ ] **Step 2: Run the back-test**

```bash
WS=/opt/warboard/.superpowers/sdd/2026-10-23-rwp-trade-window-badge-price; uptime
cd $WS/tools && node bt-3143.mjs $WS/base.user.js $WS/ov/public/scripts/torn-rw-pricer.user.js /root/projects/rwp-backtest/weapon-auctions4-2026-10-23.csv.gz > $WS/out/bt.txt 2>&1; echo "exit $?"; cat $WS/out/bt.txt
```

Expected, in about 6 seconds:

```
exit 0
{
  sales: 58363,
  badgeDiff: 0,
  forumDiff: 0,
  tradeDiff: 0,
  activeLeft: 0,
  noHelper: 0
}
one bonus                  n=28144/28068
   trade before:   8.2% off by >50%, median est/actual 1.04  |   10.3% off by >50%, median est/actual 1.04
   trade after:    6.3% off by >50%, median est/actual 1.03  |    8.4% off by >50%, median est/actual 1.03
two bonuses, pair comp     n=193/172
   trade before:  27.5% off by >50%, median est/actual 1.15  |   41.3% off by >50%, median est/actual 1.23
   trade after:   21.8% off by >50%, median est/actual 1.02  |   27.9% off by >50%, median est/actual 1.13
two bonuses, no pair comp  n=844/942
   trade before:  60.0% off by >50%, median est/actual 0.43  |   56.8% off by >50%, median est/actual 0.44
   trade after:   20.7% off by >50%, median est/actual 0.85  |   19.3% off by >50%, median est/actual 0.86
```

What each count means:
- `badgeDiff: 0`: on every sale the badge's price, source, tooltip lines, colours and median are byte-identical to 3.14.2.
- `forumDiff: 0`: `priceForumRow` is byte-identical, so forum lists are untouched (Q2).
- `tradeDiff: 0`: the trade figure (`badgePriceFor`) equals what the 3.14.2 badge shows (`estimate || median`) on every sale.
- `activeLeft: 0`: the helper put the table choice back every time.

"Before" is the trade window today (`priceForumRow`), and "after" is 3.14.3. They match the spec's tables. An exit status other than 0 means a count above is not 0: stop and find out why.

- [ ] **Step 3: The owner's gun on today's live feed**

Create `$WS/tools/owner-3143.mjs`:

```js
// The owner's gun on today's live feed, from one build: the badge (as
// injectPriceTags prices it) and the trade (badgePriceFor), side by side.
import fs from "node:fs";
import vm from "node:vm";
import { loadEngine } from "./engine.mjs";
const [,, script, feedFile] = process.argv;
const feed = JSON.parse(fs.readFileSync(feedFile, "utf8"));
const s = loadEngine(script);
s.__setFeed(feed); s.FEED = feed;
vm.runInContext("weaponExactPrices = FEED.weaponExactPrices || {};", s);
const gun = () => [{ name: "Revitalize", level: 14 }, { name: "Conserve", level: 26 }];
const badge = s.__price("Bushmaster Carbon 15", "Orange", gun());
console.log("badge", badge.est.toLocaleString("en-US"), "(" + badge.src + ")");
if (typeof s.badgePriceFor !== "function") { console.log("no badgePriceFor in this build"); process.exit(0); }
const trade = s.badgePriceFor("Bushmaster Carbon 15", "Orange", gun());
console.log("trade", trade.toLocaleString("en-US"), trade === badge.est ? "SAME" : "DIFFERENT");
```

```bash
WS=/opt/warboard/.superpowers/sdd/2026-10-23-rwp-trade-window-badge-price; cd $WS/tools
{ node owner-3143.mjs $WS/base.user.js /opt/warboard/server/data/rwp-prices.json; node owner-3143.mjs $WS/ov/public/scripts/torn-rw-pricer.user.js /opt/warboard/server/data/rwp-prices.json; } > $WS/out/owner.txt 2>&1; cat $WS/out/owner.txt
```

Expected:

```
badge 3,574,795,103 (exact %)
no badgePriceFor in this build
badge 3,574,795,103 (exact %)
trade 3,574,795,103 SAME
```

The feed is rebuilt every day. If the figure has moved, what must hold is that the two `badge` lines are equal and the last line says `SAME`.

- [ ] **Step 4: Mutants**

Create `$WS/tools/mutate-3143.cjs`:

```js
// Each mutant breaks one piece of 3.14.3; the tests must fail on every one
// except the one marked equivalent. Usage:
//   node mutate-3143.cjs <script> <test1,test2,...> <outDir>
// Each mutant is written to <outDir>/mN.user.js and the tests run against it
// through RWP_SRC. A mutant whose text is not found exactly once is SKIPPED
// and reported, which means this list no longer matches the code. Exits 1 if
// any mutant survives or is skipped.
const fs = require("fs");
const { execFileSync } = require("child_process");
const [,, script, testList, outDir] = process.argv;
const tests = testList.split(",");
const src = fs.readFileSync(script, "utf8");
const HELPER_ACTIVE = "        ACTIVE = (weaponKey && recentTables && bonuses.length === 1) ? recentTables : null;\n        try {";
const RETURN = "        return { price: estimatedPrice, source: estSource, deriv: deriv, bonusColors: bonusColors };";
const M = [
  ["the trade keeps the forum ladder",
    "        if (t.rarity) {\n            var b = badgePriceFor(key, t.rarity, t.bonuses);",
    "        if (false) {\n            var b = badgePriceFor(key, t.rarity, t.bonuses);"],
  ["no table choice in the helper", HELPER_ACTIVE, "        ACTIVE = null;\n        try {"],
  ["a leftover choice kept for two bonuses", HELPER_ACTIVE,
    "        if (weaponKey && recentTables && bonuses.length === 1) ACTIVE = recentTables;\n        try {"],
  ["median read with the caller's choice",
    "        try {\n            var median = getMedianPrice(weaponKey, rarity);",
    "        try {\n            var median = (function () { var a = ACTIVE; ACTIVE = prevActive; var m = getMedianPrice(weaponKey, rarity); ACTIVE = a; return m; })();"],
  ["choice not put back",
    "            return est.price || median;\n        } finally {\n            ACTIVE = prevActive;\n        }",
    "            return est.price || median;\n        } finally {\n        }"],
  ["estimate only, never the median", "            return est.price || median;", "            return est.price;"],
  ["a range counts at the median", "            return est.price || median;",
    "            return (est.source === 'weapon floor' && est.price < median) ? median : (est.price || median);"],
  ["no fallback where the badge has no price",
    "            if (b > 0) return b;\n        }\n        var p = priceForumRow(",
    "            return b > 0 ? b : 0;\n        }\n        var p = priceForumRow("],
  ["colour worked out for the badge",
    "        if (t.rarity) {\n            var b = badgePriceFor(key, t.rarity, t.bonuses);",
    "        var r0 = t.rarity || rarityFromRoll(key, t.bonuses[0].name, t.bonuses[0].level);\n        if (r0) {\n            var b = badgePriceFor(key, r0, t.bonuses);"],
  ["EQUIVALENT: no colour check (a null colour has no median, so it falls back anyway)",
    "        if (t.rarity) {\n            var b = badgePriceFor(key, t.rarity, t.bonuses);",
    "        if (true) {\n            var b = badgePriceFor(key, t.rarity, t.bonuses);"],
  ["the estimator drops its source", RETURN, RETURN.replace("source: estSource", "source: null")],
  ["the estimator drops its colours", RETURN, RETURN.replace("bonusColors: bonusColors }", "bonusColors: {} }")],
  ["the estimator drops its tooltip lines", RETURN, RETURN.replace("deriv: deriv,", "deriv: [],")],
  ["the badge passes the weapon as the item",
    "            var est = estimateItemPrice(weaponKey, itemKey, rarity, bonuses, median, comboFn, bonusFn);",
    "            var est = estimateItemPrice(weaponKey, weaponKey, rarity, bonuses, median, comboFn, bonusFn);"],
];
let killed = 0, live = 0, skipped = 0;
M.forEach(([name, from, to], k) => {
  const n = src.split(from).length - 1;
  if (n !== 1) { skipped++; console.log("SKIP (" + n + " matches): " + name); return; }
  const file = outDir + "/m" + (k + 1) + ".user.js";
  fs.writeFileSync(file, src.replace(from, () => to));
  let failed = false, out = "";
  try { out = execFileSync(process.execPath, ["--test", ...tests], { env: { ...process.env, RWP_SRC: file }, encoding: "utf8" }); }
  catch (e) { failed = true; out = e.stdout || ""; }
  const fails = (out.match(/^not ok \d+ - .*$/gm) || []).map((l) => l.replace(/^not ok /, ""));
  const equivalent = name.startsWith("EQUIVALENT");
  if (failed) killed++; else if (!equivalent) live++;
  console.log((failed ? "killed  " : equivalent ? "equiv.  " : "SURVIVED") + "  " + name +
    (fails.length ? "  [" + fails.length + ": " + fails[0].slice(0, 80) + "]" : ""));
});
console.log(killed + " killed, " + live + " survived, " + skipped + " skipped, of " + M.length);
if (live || skipped) process.exitCode = 1;
```

```bash
WS=/opt/warboard/.superpowers/sdd/2026-10-23-rwp-trade-window-badge-price; uptime; mkdir -p $WS/out/mutants
cd $WS/ov && node $WS/tools/mutate-3143.cjs $WS/ov/public/scripts/torn-rw-pricer.user.js rwp-trade-badge.test.mjs,rwp-second-bonus.test.mjs,rwp-exact-gun.test.mjs,rwp-trade.test.mjs $WS/out/mutants > $WS/out/mutants.txt 2>&1; echo "exit $?"; cat $WS/out/mutants.txt
```

Expected:

```
exit 0
killed    the trade keeps the forum ladder  [8: 30 - the owner's gun counts in a trade at its badge's price]
killed    no table choice in the helper  [4: 32 - a one-bonus gun reads last year's tables, as its badge does]
killed    a leftover choice kept for two bonuses  [2: 40 - a choice left over from the page's last badge does not reach the trade]
killed    median read with the caller's choice  [1: 41 - a choice left over from a two-bonus badge does not reach a one-bonus trade ]
killed    choice not put back  [1: 39 - pricing a trade row leaves the table choice as it found it]
killed    estimate only, never the median  [1: 35 - the badge shows its estimate, or the colour median when the estimate comes ]
killed    a range counts at the median  [1: 34 - a gun whose badge shows a range counts at the badge's estimate, the low end]
killed    no fallback where the badge has no price  [1: 37 - with no colour median for the weapon, the forum ladder prices it as before]
killed    colour worked out for the badge  [1: 36 - with no colour on the icon, the forum ladder prices it as before]
equiv.    EQUIVALENT: no colour check (a null colour has no median, so it falls back anyway)
killed    the estimator drops its source  [3: 27 - the badge's estimator is a function of the item alone]
killed    the estimator drops its colours  [2: 27 - the badge's estimator is a function of the item alone]
killed    the estimator drops its tooltip lines  [13: 2 - the tooltip says it used this gun's sale, how much, and when it sold]
killed    the badge passes the weapon as the item  [2: 28 - injectPriceTags prices through that function, with no copy of its own]
13 killed, 0 survived, 0 skipped, of 14
```

The bracket after each mutant shows how many tests it failed, then the first of them. Its number counts across the four files. The last line is the gate:
- `SURVIVED` means a test is missing. Use systematic-debugging, then write the test, watch it fail on that mutant and pass on the build, and run the mutants again.
- `SKIP` means a mutant's text is no longer in the build exactly once, so an earlier step differs from this plan.

The one equivalent mutant drops the `if (t.rarity)` check. It can't be killed, because with no colour there is no colour median, so the helper returns null and the fallback runs anyway.

- [ ] **Step 5: Close the task**

Run the executing-plans `task-done` for Task 4 with the test command `bash -c 'WS=/opt/warboard/.superpowers/sdd/2026-10-23-rwp-trade-window-badge-price; cd $WS/ov && node $WS/tools/mutate-3143.cjs $WS/ov/public/scripts/torn-rw-pricer.user.js rwp-trade-badge.test.mjs,rwp-second-bonus.test.mjs,rwp-exact-gun.test.mjs,rwp-trade.test.mjs $WS/out/mutants'`.

Expected: the ledger line ends `→ 13 killed, 0 survived, 0 skipped, of 14`. Then add `Task 4: back-test 58,363 sales, 0 badge / 0 forum / 0 trade diffs; owner's gun badge = trade = 3,574,795,103; mutants 13 killed + 1 equivalent`.

---

### Task 5: Version 3.14.3

**Files:**
- Modify, in the overlay: `$WS/ov/public/scripts/torn-rw-pricer.user.js` (lines 4 and 37) and `$WS/ov/public/scripts/torn-rw-pricer.meta.js` (regenerated).

**Interfaces:**
- Consumes: the Task 3 build.
- Produces: the release files, `torn-rw-pricer.user.js` `140bec75` and `torn-rw-pricer.meta.js` `b89aa2c3`.

- [ ] **Step 1: Bump the version**

```bash
WS=/opt/warboard/.superpowers/sdd/2026-10-23-rwp-trade-window-badge-price; SC=$WS/ov/public/scripts
sed -i -e 's|^// @version      3\.14\.2$|// @version      3.14.3|' -e "s|^    var SCRIPT_VERSION = '3\.14\.2';$|    var SCRIPT_VERSION = '3.14.3';|" $SC/torn-rw-pricer.user.js && sed -n '1,/==\/UserScript==/p' $SC/torn-rw-pricer.user.js > $SC/torn-rw-pricer.meta.js && sed -n '4p;37p' $SC/torn-rw-pricer.user.js && grep -c '3\.14\.2' $SC/torn-rw-pricer.user.js; wc -l < $SC/torn-rw-pricer.meta.js; diff <(git -C /opt/warboard show 82c0f4a3:server/public/scripts/torn-rw-pricer.meta.js) $SC/torn-rw-pricer.meta.js
```

Expected:

```
// @version      3.14.3
    var SCRIPT_VERSION = '3.14.3';
0
30
4c4
< // @version      3.14.2
---
> // @version      3.14.3
```

- [ ] **Step 2: Check the build**

```bash
WS=/opt/warboard/.superpowers/sdd/2026-10-23-rwp-trade-window-badge-price; SC=$WS/ov/public/scripts
node --check $SC/torn-rw-pricer.user.js && node $WS/tools/move-check.mjs $WS/base.user.js $SC/torn-rw-pricer.user.js && sha256sum $SC/torn-rw-pricer.user.js $SC/torn-rw-pricer.meta.js | cut -c1-8
```

Expected:

```
move check OK: estimateItemPrice's body is the 3.14.2 block, 4 spaces left; the rest is 3.14.2 except estimateItemPrice, badgePriceFor, tradeRwValue and // @version      3.14.3 / var SCRIPT_VERSION = '3.14.3';
140bec75
b89aa2c3
```

- [ ] **Step 3: The whole suite**

```bash
uptime; bash /opt/warboard/.superpowers/sdd/2026-10-23-rwp-trade-window-badge-price/tools/run-tests.sh
```

Expected: `tests 2198 pass 2196 fail 0 skipped 2 exit 0`.

- [ ] **Step 4: Close the task**

Run the executing-plans `task-done` for Task 5 with the test command `bash /opt/warboard/.superpowers/sdd/2026-10-23-rwp-trade-window-badge-price/tools/run-tests.sh`.

Expected: the ledger line ends `→ tests 2198 pass 2196 fail 0 skipped 2 exit 0`. Then add `Task 5: release files: torn-rw-pricer.user.js 140bec75, torn-rw-pricer.meta.js b89aa2c3, rwp-trade-badge.test.mjs 80bf12ea, rwp-trade.test.mjs b055eb9b, rwp-second-bonus.test.mjs 1d49d0d7, rwp-exact-gun.test.mjs 3e1d178d`.

Keep that run's full output under a fixed name, for the review package:

```bash
WS=/opt/warboard/.superpowers/sdd/2026-10-23-rwp-trade-window-badge-price
cp "$(ls -t $WS/out/tests-*.txt | head -1)" $WS/out/suite-final.txt && grep -E "^# (tests|pass|fail|skipped) " $WS/out/suite-final.txt
```

Expected: `# tests 2198`, `# pass 2196`, `# fail 0`, `# skipped 2`. Any other count means the newest output was not the whole suite; run Step 3 again and copy that.

---

### Task 6: Final review, release and report

**Files:**
- Create: `$WS/review/`, the review package.
- Install from the overlay: the six files.
- Modify, outside the repo: `/root/.claude/projects/-root/memory/reference_rwp_bonus_level_pricing.md` and `MEMORY.md`.

**Interfaces:**
- Consumes: everything above.
- Produces: RW Pricer 3.14.3, live at `https://tornwar.com/scripts/torn-rw-pricer.user.js`, and one commit of the six files, pushed.

- [ ] **Step 1: Build the review package**

Nothing is committed before the review, because the working tree is the served tree. So the package is built from the overlay against the installed 3.14.2 files, in place of `review-package` on a commit range.

```bash
WS=/opt/warboard/.superpowers/sdd/2026-10-23-rwp-trade-window-badge-price; R=$WS/review; mkdir -p $R
cd /opt/warboard/server && for f in public/scripts/torn-rw-pricer.user.js public/scripts/torn-rw-pricer.meta.js rwp-trade.test.mjs rwp-second-bonus.test.mjs rwp-exact-gun.test.mjs; do diff -u $f $WS/ov/$f; done > $R/changes.diff; diff -u /dev/null $WS/ov/rwp-trade-badge.test.mjs >> $R/changes.diff
cp $WS/out/bt.txt $WS/out/owner.txt $WS/out/mutants.txt $R/ && node $WS/tools/move-check.mjs $WS/base.user.js $WS/ov/public/scripts/torn-rw-pricer.user.js > $R/move-check.txt && cp $WS/out/suite-final.txt $R/suite.txt && wc -l $R/*
```

Expected: `changes.diff` with 1,205 lines (the moved block shows as 288 lines out and 288 in; `move-check.txt` is the proof they are the same), and the five output files.

- [ ] **Step 2: The final review**

Dispatch one reviewer with the Agent tool: `subagent_type: "general-purpose"`, `model: "opus"`. Fill in superpowers:requesting-code-review's `code-reviewer.md`:
- **DESCRIPTION:** RW Pricer 3.14.3. The badge's estimator moves, word for word, into `estimateItemPrice`. A new `badgePriceFor` prices a weapon the way its badge does. `tradeRwValue` counts a weapon at that price and falls back to `priceForumRow` where the badge has nothing to say. The version goes to 3.14.3.
- **PLAN_OR_REQUIREMENTS:** this plan and the spec, by path.
- **In place of the git range:** the package at `$WS/review/`: `changes.diff`, plus the back-test, owner, mutant, move-check and suite outputs. The installed files under `/opt/warboard/server` are 3.14.2, and the overlay files under `$WS/ov` are 3.14.3; the reviewer may read either.
- This plan's Review Focus section, word for word, and the ledger's `Ruling:` lines.
- The review is read-only. The reviewer writes nothing under `/opt/warboard`, including the overlay.

- [ ] **Step 3: Act on the review**

Follow executing-plans' Final Review:
- Re-grade the findings by their effect on a person using the script.
- Critical and Important findings get one fix pass in the overlay. For each, write a test, watch it fail on the current build, make it pass, then rerun Task 4 Steps 2 to 4 and Task 5 Steps 2 to 4. The hashes in this plan no longer apply after a fix, so record the new ones.
- Minor findings go to the ledger as deferred.
- Each "Declined to judge" line gets a ruling.

- [ ] **Step 4: Install**

First confirm the installed files are still the ones Task 1 started from, since another session may have changed them:

```bash
cd /opt/warboard/server && sha256sum public/scripts/torn-rw-pricer.user.js public/scripts/torn-rw-pricer.meta.js rwp-trade.test.mjs rwp-second-bonus.test.mjs rwp-exact-gun.test.mjs | cut -c1-8; ls rwp-trade-badge.test.mjs
```

Expected: `3943779b`, `71b2ddfc`, `73cf1bef`, `8f6789a9`, `b5b77d2b`, and no such file. If anything differs, stop and ask.

Then install: the tests first, then the script, then its header. A userscript manager that reads the new header then finds the new script.

```bash
WS=/opt/warboard/.superpowers/sdd/2026-10-23-rwp-trade-window-badge-price; cd /opt/warboard/server
for f in rwp-trade-badge.test.mjs rwp-trade.test.mjs rwp-second-bonus.test.mjs rwp-exact-gun.test.mjs; do install -o root -g root -m 644 $WS/ov/$f $f; done && install -o warboard -g warboard -m 644 $WS/ov/public/scripts/torn-rw-pricer.user.js public/scripts/torn-rw-pricer.user.js && install -o warboard -g warboard -m 644 $WS/ov/public/scripts/torn-rw-pricer.meta.js public/scripts/torn-rw-pricer.meta.js
for f in public/scripts/torn-rw-pricer.user.js public/scripts/torn-rw-pricer.meta.js rwp-trade-badge.test.mjs rwp-trade.test.mjs rwp-second-bonus.test.mjs rwp-exact-gun.test.mjs; do cmp $f $WS/ov/$f && stat -c '%U:%G %a %n' $f; done
```

Expected, with no output from `cmp`:

```
warboard:warboard 644 public/scripts/torn-rw-pricer.user.js
warboard:warboard 644 public/scripts/torn-rw-pricer.meta.js
root:root 644 rwp-trade-badge.test.mjs
root:root 644 rwp-trade.test.mjs
root:root 644 rwp-second-bonus.test.mjs
root:root 644 rwp-exact-gun.test.mjs
```

- [ ] **Step 5: Check what is served**

```bash
for u in http://127.0.0.1:3000/scripts/torn-rw-pricer.meta.js "https://tornwar.com/scripts/torn-rw-pricer.meta.js?v=$(date +%s)" https://tornwar.com/scripts/torn-rw-pricer.meta.js; do curl -s "$u" | grep '@version'; done
for u in http://127.0.0.1:3000/scripts/torn-rw-pricer.user.js "https://tornwar.com/scripts/torn-rw-pricer.user.js?v=$(date +%s)"; do curl -s "$u" | sha256sum | cut -c1-8; done
```

Expected:
- The first two lines say `// @version      3.14.3`.
- The third can still say 3.14.2 for up to 5 minutes, because nginx caches; check it again after that.
- Then `140bec75` twice.

- [ ] **Step 6: The whole suite on the installed tree**

```bash
WS=/opt/warboard/.superpowers/sdd/2026-10-23-rwp-trade-window-badge-price; uptime
cd /opt/warboard/server && (npm test > $WS/out/suite-installed.txt 2>&1; echo "exit $?" >> $WS/out/suite-installed.txt); grep -E "^# (tests|pass|fail|skipped) |^exit" $WS/out/suite-installed.txt
```

Expected: `# tests 2198`, `# pass 2196`, `# fail 0`, `# skipped 2`, `exit 0`.

- [ ] **Step 7: Commit and push**

```bash
cd /opt/warboard && git add server/rwp-trade-badge.test.mjs && git commit -q -F - -- server/public/scripts/torn-rw-pricer.user.js server/public/scripts/torn-rw-pricer.meta.js server/rwp-trade-badge.test.mjs server/rwp-trade.test.mjs server/rwp-second-bonus.test.mjs server/rwp-exact-gun.test.mjs <<'MSG'
RW Pricer 3.14.3: the trade window shows the badge's price

A gun in a trade now counts at the price its own badge shows. The badge's
estimator moves, word for word, into estimateItemPrice. badgePriceFor
prices a weapon from its name, colour and bonuses the way the badge does,
and tradeRwValue uses it. It keeps priceForumRow where the badge has
nothing to say: no colour on the icon, or no colour median. Forum lists,
armour and every badge are unchanged.

The owner's Orange Bushmaster Carbon 15 (14% Revitalize, 26% Conserve)
counted at $3,193,164,535 and now counts at its badge's $3,574,795,103.
On the newest 20% of sales, two-bonus guns with no pair comp miss by
more than half 20.7% / 19.3% of the time, down from 60.0% / 56.8%.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
MSG
git show --stat --format='%h %s' HEAD | head -10
git push origin HEAD:main 2>&1 | sed -E 's#//[^@]*@#//***@#g'; git status -sb | head -1
```

Expected:
- The commit lists exactly the six files.
- The push goes from `82c0f4a3` to the new commit, carrying `e7885e24` and this plan's commit with it.
- `git status -sb` shows `## main...origin/main` with nothing ahead.

- [ ] **Step 8: Memory**

In `/root/.claude/projects/-root/memory/reference_rwp_bonus_level_pricing.md`, rewrite the "Trade window" section as shipped. Include:
- the commit;
- what the trade does now;
- the two fallbacks;
- range guns at the low end;
- the harness pattern (`estimatorStep()`: the call, else the inline block);
- the leftover-choice test that killed the median mutant;
- the items left as they are.

Update its `MEMORY.md` line to match.

- [ ] **Step 9: Clear the workspace**

After a clean final review, executing-plans says to delete this plan's workspace. Use its literal path, since `rm` on a variable path is blocked. The overlay's symlinks are removed, not what they point at:

```bash
rm -rf /opt/warboard/.superpowers/sdd/2026-10-23-rwp-trade-window-badge-price
```

Keep `/root/projects/rwp-backtest/` for the next back-test.

- [ ] **Step 10: Report to the owner**

Keep it short and put the served URL near the top: https://tornwar.com/scripts/torn-rw-pricer.user.js (3.14.3). Then say:
- what changes in a trade: every RW weapon row counts at its badge's price, so the owner's gun goes from $3,193,164,535 to $3,574,795,103, and a range gun counts at the low end;
- that there is no Refresh tap;
- that the Greasy Fork copy (GF 569836) needs the owner to update it, because this box can't reach Greasy Fork;
- the spec's "Not in this version" items, in one line each;
- "Rulings I made" and "Deferred minors", from the ledger;
- what is still owed: a phone check of a trade window with an RW weapon in it.
