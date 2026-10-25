# FFS Chain Button: Skip Targets Who Can't Be Attacked — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A click on FFS Banner Estimates' chain button (the green **FF** on the right edge of Torn's pages) opens someone who can be attacked now, not someone in hospital, travelling or in jail, and its target list is fetched again once it is an hour old while someone is chaining.

**Architecture:** Two functions do the deciding. `ffs_chainStatus(playerId)` asks Torn for one player's status. `ffs_chainPick(targets, start, nowMs, check)` walks the saved list: it skips, for free, the targets whose FFScouter `hospital_until` is still ahead, and asks `check` about at most 3 of the rest. The click opens the new tab first, so popup blockers allow it, waits for the pick, then sends the tab to the target, or closes it and shows a note. The list's age check is fixed (it compared a date string and never fired), the age limit becomes an hour, and the refresh runs at a page load within 10 minutes of a click.

**Tech Stack:** a plain JavaScript userscript (Tampermonkey on a PC, Torn PDA on a phone). Tests run on `node:test` and extract the SHIPPED functions from the script's source, the way `server/ffs-travel-country.test.mjs` does.

**Spec:** none, since this is a bounded change to an existing feature. The design of record is the grill round of 2026-10-25 and the owner's answer, "yes continue" (09:07 EDT). "Design of record" below restates it, with the rulings made at plan time.

## Design of record

What the owner approved in the grill round of 2026-10-25 ("yes continue", 09:07 EDT):

- **Q1 (c):** a click skips the people FFScouter already knows are in hospital (its `hospital_until`, at no cost), then one Torn call confirms the pick. The same answer shows travel and jail, so those are skipped too. A click makes at most 3 Torn checks. If all 3 are out, a note says so, and the next click carries on down the list.
- **Q2:** fix the list's refresh: fetch it again once it is an hour old, while the owner chains, and never at the cost of a Torn call.
- Both copies, stable 2.73.62 and beta 2.73.913, get the same change. Their chain code is identical today.

Rulings made at plan time (each gives what, why, and the cost if wrong):

1. **When the list refreshes.** The refresh runs at the next page load within 10 minutes of a click (`ffs_chainRefreshOnLoad`), not in the click itself as the grill round said. A fetch begun by the click is lost when "same tab" takes the page away. A fetch at page load can never swap the list in the middle of a click's walk. Cost if wrong: after a gap of more than 10 minutes between clicks, the first click uses the old list (Torn's check still covers it), and the page it opens fetches the new one.
2. **A new list starts from its top.** The saved place goes back to 0. Upstream FF Scouter 3.3 does the same. FFScouter orders a filtered list by battle stats, and a new list's hospital times are the newest. Cost if wrong: the top targets come round again each hour.
3. **No answer from Torn means go.** On an error, a timeout after 4 seconds, or a refused key, the button opens the pick, as it did before it asked. Cost if wrong: while Torn is down or refusing, someone in hospital can still be opened, as today.
4. **Only `Okay` is attackable.** Every other state counts as out: `Hospital`, `Traveling`, `Abroad`, `Jail`, `Federal`, or one not listed. Cost if wrong: a target in the same foreign country as the player is skipped.
5. **Torn PDA gets no waiting tab.** The tab opens once the target is known, with the call the button used before. Cost if wrong: if PDA refuses a tab opened after a wait, its new-tab mode opens nothing. The fix would be to use the same tab on PDA.
6. **No new setting turns the check off.** Cost if wrong: someone who doesn't want the calls can't opt out (at most 3 per click).
7. **The button stays a `<button>` reading "FF", fixed and green.** The settings panel finds it by exactly those three things when it removes and remakes it. It dims to half opacity while it waits.
8. **The key goes in the URL.** The Torn call sends it as `?key=`, like the script's other Torn call (`ffs_fetchFactionMembers`), so it needs no new `@connect` and causes no permission prompt. Cost if wrong: none new.
9. **The review comes before the release.** The final whole-branch review runs after Task 3, on the overlay (see "Review before release"), and Task 4 waits for its fixes. Nothing is committed before Task 4, because writing the served files is the release. Cost if wrong: none, since Task 4 changes no code.

## Global Constraints

- **The served files are the source:** `/opt/warboard/server/public/scripts/ffs-banner-estimates.user.js`, `ffs-banner-estimates-beta.user.js` and their `.meta.js`, owned `warboard:warboard`, mode 644. Writing them makes them live at once, so every task works on copies in `$WS/ov`, and only Task 4 installs them.
- **`$WS`** is `/opt/warboard/.superpowers/sdd/2026-10-25-ffs-chain-button-skip-unavailable` (git-ignored).
- **No branch or worktree.** The overlay in `$WS/ov` is the isolation, and Task 4 commits to `main`, which serves the scripts, as they go live. Ledger lines for Tasks 1 to 3 name the overlay instead of a commit range: `(overlay $WS/ov, no commits by design: ruling 9)`.
- **Both copies get the same chain code.** Every Replace text must occur exactly once in each.
- **Versions:** stable 2.73.61 → 2.73.62 and beta 2.73.912 → 2.73.913. Each goes in `// @version`, `const SCRIPT_VERSION` and a CHANGELOG entry, and the `.meta.js` is regenerated from the header. `@namespace` (`tornwar.com`), `@author`, `@grant` and `@connect` stay as they are.
- **No second PDA placeholder.** Never write the PDA key placeholder string a second time in a script. Detect PDA the way the code already does: `apikey[0] != "#"`.
- **Quotes and braces.** Use only straight quotes in the scripts: PDA's GMforPDA straightens curly quotes, and then the script fails to parse. The new functions may have no unbalanced `{` or `}` inside a string or template, because the test finds a function by counting braces.
- **Torn's rules:** one click opens one page, and the script reads Torn only through the API. A click makes at most 3 API calls, and none while `_ffsRateLimitedUntil` is ahead.
- **Comments:** clear `//` comments that say why. No version numbers in the code outside the header, `SCRIPT_VERSION` and the CHANGELOG block.
- **Made-up test data:** the tests use made-up players (ids 1 to 74, names "Target N") and the key `test-key`, nothing from the live game.
- **The repo is public:**
  - commit only this plan's paths (`git commit -- <paths>`);
  - end each commit message with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`;
  - sweep before pushing.

## Review Focus

1. **Torn PDA in new-tab mode.** The tab opens after Torn's answer, with no click left to vouch for it. Expected: it opens as before. Only the owner's phone can tell; Task 3's PDA test pins the code path.
2. **A browser that blocks even the waiting tab.** The target then opens the old way once it is known, which that browser blocks too, so the click shows nothing. Task 3's blocked-tab test pins this.
3. **Few hospital times from FFScouter.** More of the walk falls to Torn, still at most 3 calls a click. Task 2's limit test pins this.
4. **Two Torn tabs clicking at about the same moment.** They share one saved place, so both may open the same target. Expected: harmless. No test.
5. **Saving the settings while a click is still asking Torn.** The button is removed and made again, and the click already going still opens its pick. No test.

## Tools

`$WS/apply.py` puts a task's code in place from this plan, so what runs is exactly what the plan says. Write it in Task 1, Step 1:

```python
# Applies one task's code from the plan. "tests" mode writes the task's test
# block (Task 1 creates the test file, later tasks append to it). "edits" mode
# applies the task's Replace/With pairs, in order, to every file named; each
# old text must occur exactly once in every file, or no file is written.
# Usage: python3 -I apply.py PLAN TASK tests TESTFILE
#        python3 -I apply.py PLAN TASK edits FILE...
import re, sys

F = "`" * 3
plan, task, mode, *files = sys.argv[1:]
text = open(plan, encoding="utf-8").read()
parts = re.split(r"\n### Task (\d+): ", text)
sec = dict(zip(parts[1::2], parts[2::2]))[task]


def blocks(lead):
    return re.findall(re.escape(lead) + r"\n\n" + F + r"js\n(.*?)\n" + F + r"\n", sec, re.S)


if mode == "tests":
    made, added = blocks("Create the test file with:"), blocks("Append to the test file:")
    assert len(made) + len(added) == 1, "want one test block in task " + task
    if made:
        open(files[0], "w", encoding="utf-8").write(made[0] + "\n")
    else:
        with open(files[0], "a", encoding="utf-8") as out:
            out.write("\n" + added[0] + "\n")
    print(files[0] + ": test block " + ("written" if made else "appended"))
else:
    pair = r"Replace:\n\n" + F + r"js\n(.*?)\n" + F + r"\n\nWith:\n\n" + F + r"js\n(.*?)\n" + F + r"\n"
    pairs = re.findall(pair, sec, re.S)
    assert pairs, "no edits in task " + task
    done = {}
    for f in files:
        s = open(f, encoding="utf-8").read()
        for k, (old, new) in enumerate(pairs, 1):
            c = s.count(old + "\n")
            assert c == 1, "%s: edit %d: old text found %d times" % (f, k, c)
            s = s.replace(old + "\n", new + "\n", 1)
        done[f] = s
    for f, s in done.items():
        open(f, "w", encoding="utf-8").write(s)
        print("%s: %d edits applied" % (f, len(pairs)))
```

## Review before release

Nothing is committed until Task 4, so after Task 3 the final review reads a package built from the overlay: `diff -u` of each copy against `$WS/orig`, then the new test file.

```bash
WS=/opt/warboard/.superpowers/sdd/2026-10-25-ffs-chain-button-skip-unavailable
P=$WS/review-overlay.diff; : > $P
for f in ffs-banner-estimates ffs-banner-estimates-beta; do diff -u $WS/orig/$f.user.js $WS/ov/$f.user.js >> $P; done
echo "=== new file: server/ffs-chain-button.test.mjs" >> $P; cat $WS/ov/ffs-chain-button.test.mjs >> $P
wc -l $P
```

Expected: the package's line count, about 900 lines.

Task 4 starts only once the review's fixes are in, each RED→GREEN on the overlay with `FFS_DIR=$WS/ov`.

---

### Task 1: The list's age, and the refresh while chaining

**Files:**
- Modify both copies, `$WS/ov/ffs-banner-estimates.user.js` and `$WS/ov/ffs-banner-estimates-beta.user.js`:
  - the top-level chain constants;
  - `get_cached_targets`;
  - `update_ff_targets`;
  - a new `ffs_chainRefreshOnLoad` after `clear_cached_targets`;
  - the page-load call.
- Create: `$WS/ov/ffs-chain-button.test.mjs`

**Interfaces:**
- Consumes: nothing from the other tasks.
- Produces:
  - `FF_TARGET_STALENESS = 60 * 60 * 1000`.
  - `CHAIN_CLICKED_KEY = "ffscouterv2-chain-clicked-at"`, the time of the last click in ms. `ffs_chainRefreshOnLoad` reads it, and Task 3's click writes it.
  - `FFS_CHAIN_ACTIVE_MS = 10 * 60 * 1000`.
  - `get_cached_targets(false)` returns null for a list an hour old or one whose time can't be read. `get_cached_targets(true)` returns any saved list.
  - `update_ff_targets()` sets the saved place back to 0 when it saves a new list.
  - The test file's helpers, which Tasks 2 and 3 use: `both(name, body)`, `NOW`, `NOW_S`, `FakeDate` and `T(id, extra)`.

- [ ] **Step 1: The overlay and the applier**

```bash
WS=/opt/warboard/.superpowers/sdd/2026-10-25-ffs-chain-button-skip-unavailable
S=/opt/warboard/server/public/scripts
# The overlay holds every task's work until Task 4 installs it: never copy over it.
[ -e $WS/ov ] && { echo "the overlay already exists: stop, it holds the tasks' work"; exit 1; }
mkdir -p $WS/ov $WS/orig
for f in ffs-banner-estimates ffs-banner-estimates-beta; do cp $S/$f.user.js $S/$f.meta.js $WS/ov/; cp $S/$f.user.js $S/$f.meta.js $WS/orig/; done
# server/package.json makes the served copies parse as modules; the overlay
# must parse them the same way for node --check to mean the same thing.
printf '{ "type": "module" }\n' > $WS/ov/package.json
ls $WS/ov | paste -sd' '
```

Expected: `ffs-banner-estimates-beta.meta.js ffs-banner-estimates-beta.user.js ffs-banner-estimates.meta.js ffs-banner-estimates.user.js package.json`

Then write `$WS/apply.py` from the Tools section, exactly as it stands there:

```bash
WS=/opt/warboard/.superpowers/sdd/2026-10-25-ffs-chain-button-skip-unavailable
python3 -I - /opt/warboard/docs/superpowers/plans/2026-10-25-ffs-chain-button-skip-unavailable.md $WS/apply.py <<'PY'
import re, sys
F = "`" * 3
plan, out = sys.argv[1], sys.argv[2]
tools = open(plan, encoding="utf-8").read().split("\n## Tools\n", 1)[1].split("\n## ", 1)[0]
open(out, "w", encoding="utf-8").write(re.search(F + r"python\n(.*?)\n" + F + r"\n", tools, re.S).group(1) + "\n")
print("apply.py written")
PY
```

Expected: `apply.py written`

- [ ] **Step 2: Write the failing tests**

Create the test file with:

```js
// The chain button, the green FF on the right edge of Torn's pages. A click
// skips people who can't be attacked: FFScouter's hospital times rule out the
// ones it knows about, and Torn is asked about the pick. The target list is
// fetched again once it is an hour old, while someone is chaining. Runs the
// SHIPPED functions of both copies, stable and beta. FFS_DIR points it at
// another folder holding both copies.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const DIR = process.env.FFS_DIR || '/opt/warboard/server/public/scripts';
const COPIES = ['ffs-banner-estimates.user.js', 'ffs-banner-estimates-beta.user.js'].map((file) => ({
  tag: file.includes('beta') ? 'beta' : 'stable',
  SRC: readFileSync(join(DIR, file), 'utf8'),
}));

// The source of one named function, found by counting braces from its name.
function fnOf(SRC, name) {
  const at = SRC.indexOf('function ' + name + '(');
  assert.ok(at >= 0, 'not found: ' + name);
  // Keep "async" when the function has it, or its awaits would not parse.
  const from = SRC.slice(at - 6, at) === 'async ' ? at - 6 : at;
  let depth = 0;
  for (let j = SRC.indexOf('{', at); j < SRC.length; j++) {
    if (SRC[j] === '{') depth++;
    else if (SRC[j] === '}' && --depth === 0) return SRC.slice(from, j + 1) + '\n';
  }
  throw new Error('unbalanced: ' + name);
}

// One `const NAME = ...;` as the script has it.
function konstOf(SRC, name) {
  const m = SRC.match(new RegExp('const ' + name + ' = [^;]+;'));
  assert.ok(m, 'not found: const ' + name);
  return m[0] + '\n';
}

// Registers a test once for each copy; the body gets that copy's fn and konst.
function both(name, body) {
  for (const { tag, SRC } of COPIES) {
    test(tag + ': ' + name, () => body({ fn: (n) => fnOf(SRC, n), konst: (n) => konstOf(SRC, n) }));
  }
}

const NOW = Date.UTC(2026, 9, 25, 12, 0, 0);
const NOW_S = NOW / 1000;
// A clock stopped at NOW. Given a value, it is an ordinary Date.
class FakeDate extends Date {
  constructor(...a) {
    if (a.length) super(...a);
    else super(NOW);
  }
  static now() {
    return NOW;
  }
}
// A chain target as FFScouter's get-targets lists one; made-up ids and names.
const T = (id, extra = {}) => ({ player_id: id, name: 'Target ' + id, ...extra });

// ── the list's age ──

// get_cached_targets as the script has it, reading `saved` from storage.
function cachedWith(x, saved) {
  return new Function('rD_getValue', 'Date',
    x.konst('TARGET_KEY') + x.konst('FF_TARGET_STALENESS') + x.fn('get_cached_targets') + 'return get_cached_targets;')(
    () => saved, FakeDate);
}
const savedAgo = (minutes) => JSON.stringify({ targets: [T(1)], last_updated: new Date(NOW - minutes * 60000) });

both('a chain list saved minutes ago is used as it is', (x) => {
  assert.deepEqual(cachedWith(x, savedAgo(5))(false), [T(1)]);
});

both('a chain list an hour old is due to be fetched again', (x) => {
  // last_updated comes back from storage as a string. The old test added the
  // staleness to that string, and to it no list was ever old.
  assert.equal(cachedWith(x, savedAgo(61))(false), null);
  assert.equal(cachedWith(x, savedAgo(60 * 24 * 20))(false), null);
});

both('a list whose time cannot be read is due too, and any list still serves a click', (x) => {
  const unreadable = JSON.stringify({ targets: [T(1)], last_updated: 'not a time' });
  assert.equal(cachedWith(x, unreadable)(false), null);
  assert.deepEqual(cachedWith(x, unreadable)(true), [T(1)]);
  assert.deepEqual(cachedWith(x, savedAgo(61))(true), [T(1)]);
});

// ffs_chainRefreshOnLoad as the script has it. Returns how many times it
// handed the list to update_ff_targets, which fetches it if it is due. A
// saved list here is always an hour old: due to be fetched again, but there.
function refreshOnLoad(x, { list, clickedAgoMin }) {
  let handed = 0;
  const stored = clickedAgoMin === undefined ? {} : { 'ffscouterv2-chain-clicked-at': String(NOW - clickedAgoMin * 60000) };
  new Function('rD_getValue', 'get_cached_targets', 'update_ff_targets', 'Date',
    x.konst('CHAIN_CLICKED_KEY') + x.konst('FFS_CHAIN_ACTIVE_MS') + x.fn('ffs_chainRefreshOnLoad') + 'return ffs_chainRefreshOnLoad;')(
    (k, d) => (k in stored ? stored[k] : d), (staleok) => (list && staleok ? [T(1)] : null), () => { handed++; }, FakeDate)();
  return handed;
}

both('a page load fetches the list when there is none', (x) => {
  assert.equal(refreshOnLoad(x, { list: false }), 1);
});

both('a page load hands an old list on only within 10 minutes of a chain-button click', (x) => {
  assert.equal(refreshOnLoad(x, { list: true }), 0);
  assert.equal(refreshOnLoad(x, { list: true, clickedAgoMin: 11 }), 0);
  assert.equal(refreshOnLoad(x, { list: true, clickedAgoMin: 2 }), 1);
});

both('a new list starts the chain from its top', (x) => {
  let resets = 0;
  const saved = {};
  const update = new Function('key', 'get_cached_targets', 'ffSettingsGet', 'BASE_URL', 'rD_xmlhttpRequest',
    'rD_setValue', 'showToast', 'console', 'reset_next_target_index',
    x.konst('TARGET_KEY') + x.fn('update_ff_targets') + 'return update_ff_targets;')(
    'test-key', () => null, () => undefined, 'https://ffscouter.invalid',
    (req) => req.onload({ status: 200, responseText: JSON.stringify({ targets: [T(1), T(2)] }) }),
    (k, v) => { saved[k] = v; }, () => {}, { log() {}, error() {} }, () => { resets++; });
  update();
  assert.ok(saved['ffscouterv2-targets'], 'the new list was saved');
  assert.equal(resets, 1);
});
```

Put it in place:

```bash
WS=/opt/warboard/.superpowers/sdd/2026-10-25-ffs-chain-button-skip-unavailable
python3 -I $WS/apply.py /opt/warboard/docs/superpowers/plans/2026-10-25-ffs-chain-button-skip-unavailable.md 1 tests $WS/ov/ffs-chain-button.test.mjs
```

Expected: `/opt/warboard/.superpowers/sdd/2026-10-25-ffs-chain-button-skip-unavailable/ov/ffs-chain-button.test.mjs: test block written`

- [ ] **Step 3: Run them to see them fail**

```bash
WS=/opt/warboard/.superpowers/sdd/2026-10-25-ffs-chain-button-skip-unavailable
cd /opt/warboard/server && FFS_DIR=$WS/ov node --test $WS/ov/ffs-chain-button.test.mjs > $WS/red1.txt 2>&1; grep -E '^# (tests|pass|fail) ' $WS/red1.txt | paste -sd' '; grep -E '^not ok' $WS/red1.txt
```

Expected: `# tests 12 # pass 2 # fail 10`. For each copy, "a chain list saved minutes ago is used as it is" passes, since the old code uses any list. The other five fail:
- the two age tests, on their asserts, because the old code uses a list of any age, even one whose time can't be read;
- the two page-load tests, on `not found: const CHAIN_CLICKED_KEY`;
- the new-list test, on its reset count of 0.

- [ ] **Step 4: Make the changes**

Replace:

```js
const FF_TARGET_STALENESS = 24 * 60 * 60 * 1000; // Refresh the target list every day
const TARGET_KEY = "ffscouterv2-targets";
const TARGET_INDEX_KEY = "ffscouterv2-target-index";
```

With:

```js
// The chain button's target list is fetched again once it is this old, at a
// page load while someone is chaining (ffs_chainRefreshOnLoad), so the
// hospital times FFScouter sends with it stay current.
const FF_TARGET_STALENESS = 60 * 60 * 1000;
const TARGET_KEY = "ffscouterv2-targets";
const TARGET_INDEX_KEY = "ffscouterv2-target-index";
// When the chain button was last clicked, in ms.
const CHAIN_CLICKED_KEY = "ffscouterv2-chain-clicked-at";
```

Replace:

```js
    if (parsed.last_updated + FF_TARGET_STALENESS > new Date()) {
      // Old cache, return nothing
      return null;
    }
```

With:

```js
    // last_updated comes back from storage as a date string, so it is read as
    // a time first. Adding the staleness to the string itself made text that
    // never compared as a date, and no list was ever seen as old.
    const age = Date.now() - new Date(parsed.last_updated).getTime();
    if (!(age < FF_TARGET_STALENESS)) {
      // An old list, or one whose time can't be read: return nothing
      return null;
    }
```

Replace:

```js
            rD_setValue(TARGET_KEY, JSON.stringify(result));
            console.log("[FF Scouter V2] Chain list updated successfully");
```

With:

```js
            rD_setValue(TARGET_KEY, JSON.stringify(result));
            // A new list starts from its top: FFScouter orders it by battle
            // stats, and its hospital times are the newest there are.
            reset_next_target_index();
            console.log("[FF Scouter V2] Chain list updated successfully");
```

Replace:

```js
  function clear_cached_targets() {
    rD_deleteValue(TARGET_KEY);
  }
```

With:

```js
  function clear_cached_targets() {
    rD_deleteValue(TARGET_KEY);
  }

  // A click on the chain button this recent means someone is chaining.
  const FFS_CHAIN_ACTIVE_MS = 10 * 60 * 1000;

  // At a page load: fetch the chain list if there is none, and otherwise let
  // update_ff_targets fetch it again if it is an hour old, but only within
  // FFS_CHAIN_ACTIVE_MS of a click on the chain button, so the refresh comes
  // while someone is chaining, not on every page anyone opens. It runs here,
  // on the page the click opened, because a fetch begun by the click itself
  // is lost when "same tab" takes that page away.
  function ffs_chainRefreshOnLoad() {
    const clickedAt = Number(rD_getValue(CHAIN_CLICKED_KEY, 0)) || 0;
    if (!get_cached_targets(true) || Date.now() - clickedAt < FFS_CHAIN_ACTIVE_MS) {
      update_ff_targets();
    }
  }
```

Replace:

```js
  create_chain_button();
  update_ff_targets();
  checkKeyAndUpdatePremium();
```

With:

```js
  create_chain_button();
  ffs_chainRefreshOnLoad();
  checkKeyAndUpdatePremium();
```

Apply them to both copies:

```bash
WS=/opt/warboard/.superpowers/sdd/2026-10-25-ffs-chain-button-skip-unavailable
python3 -I $WS/apply.py /opt/warboard/docs/superpowers/plans/2026-10-25-ffs-chain-button-skip-unavailable.md 1 edits $WS/ov/ffs-banner-estimates.user.js $WS/ov/ffs-banner-estimates-beta.user.js
```

Expected: `5 edits applied`, once for each copy.

- [ ] **Step 5: Run the tests to see them pass, and check both copies parse**

```bash
WS=/opt/warboard/.superpowers/sdd/2026-10-25-ffs-chain-button-skip-unavailable
cd /opt/warboard/server && FFS_DIR=$WS/ov node --test $WS/ov/ffs-chain-button.test.mjs 2>&1 | grep -E '^# (tests|pass|fail) |^not ok' | paste -sd' '
for f in ffs-banner-estimates ffs-banner-estimates-beta; do node --check $WS/ov/$f.user.js && echo "parses: $f"; done
```

Expected: `# tests 12 # pass 12 # fail 0`, then `parses: ffs-banner-estimates` and `parses: ffs-banner-estimates-beta`.

No commit: the copies live outside the repo until Task 4.

### Task 2: Picking a target, and asking Torn

**Files:**
- Modify both copies in `$WS/ov`: add `FFS_CHAIN_MAX_CHECKS`, `FFS_CHAIN_CHECK_TIMEOUT_MS`, `ffs_chainStatus` and `ffs_chainPick` just above `create_chain_button`.
- Test: `$WS/ov/ffs-chain-button.test.mjs` (appended to)

**Interfaces:**
- Consumes:
  - from the script as it stands: `key`, `_ffsRateLimitedUntil`, `ffs_isRateLimitError(data)`, `FFS_REFUSAL_CODES` and `FFS_RATE_LIMIT_BACKOFF_MS`;
  - from Task 1's test file: `both`, `NOW`, `NOW_S`, `FakeDate` and `T`.
- Produces:
  - `FFS_CHAIN_MAX_CHECKS = 3` and `FFS_CHAIN_CHECK_TIMEOUT_MS = 4000`;
  - `ffs_chainStatus(playerId)`, a Promise of `"ok"`, `"out"` or `"unknown"`;
  - `ffs_chainPick(targets, start, nowMs, check)`, a Promise of `{ target, next }`, or `{ target: null, next, note }` when nobody can be attacked.

- [ ] **Step 1: Write the failing tests**

Append to the test file:

```js
// ── picking a target ──

// ffs_chainPick as the script has it.
const pickWith = (x) =>
  new Function(x.konst('FFS_CHAIN_MAX_CHECKS') + x.fn('ffs_chainPick') + 'return ffs_chainPick;')();

// Stands in for asking Torn: answers by player id, "ok" unless told otherwise,
// and keeps the ids it was asked about.
function torn(answers = {}) {
  const asked = [];
  return { asked, check: async (id) => { asked.push(id); return answers[id] || 'ok'; } };
}

both('FFScouter hospital times skip people for free, and Torn is asked about the first one left', async (x) => {
  const t = torn();
  const r = await pickWith(x)([T(11, { hospital_until: NOW_S + 600 }), T(12), T(13)], 0, NOW, t.check);
  assert.equal(r.target.player_id, 12);
  assert.equal(r.next, 2);
  assert.deepEqual(t.asked, [12]);
});

both('a hospital time already past skips nobody', async (x) => {
  const r = await pickWith(x)([T(11, { hospital_until: NOW_S - 5 })], 0, NOW, torn().check);
  assert.equal(r.target.player_id, 11);
});

both('someone Torn says is out is passed over for the next', async (x) => {
  const t = torn({ 21: 'out' });
  const r = await pickWith(x)([T(21), T(22)], 0, NOW, t.check);
  assert.equal(r.target.player_id, 22);
  assert.deepEqual(t.asked, [21, 22]);
  // After the last on the list comes the top again.
  assert.equal(r.next, 0);
});

both('no answer from Torn means go, as the button did before it asked', async (x) => {
  const r = await pickWith(x)([T(31)], 0, NOW, torn({ 31: 'unknown' }).check);
  assert.equal(r.target.player_id, 31);
});

both('a click asks Torn about 3 people at most, and the next click starts at the 4th', async (x) => {
  const t = torn({ 41: 'out', 42: 'out', 43: 'out' });
  const r = await pickWith(x)([T(41), T(42), T(43), T(44), T(45)], 0, NOW, t.check);
  assert.equal(r.target, null);
  assert.deepEqual(t.asked, [41, 42, 43]);
  assert.equal(r.next, 3);
  assert.match(r.note, /^The next 3 on your chain list can't be attacked right now/);
});

both('with everyone in hospital by FFScouter, Torn is not asked, and the note says who is out first', async (x) => {
  const t = torn();
  const r = await pickWith(x)([T(51, { hospital_until: NOW_S + 900 }), T(52, { hospital_until: NOW_S + 125 })], 1, NOW, t.check);
  assert.equal(r.target, null);
  assert.deepEqual(t.asked, []);
  assert.equal(r.next, 1);
  assert.equal(r.note, 'Nobody on your chain list can be attacked right now. First out of hospital: Target 52 in 3 min.');
});

both('the walk starts at the saved place and wraps round; a place past the end starts at the top', async (x) => {
  const t = torn({ 63: 'out' });
  const r = await pickWith(x)([T(61), T(62), T(63)], 2, NOW, t.check);
  assert.equal(r.target.player_id, 61);
  assert.deepEqual(t.asked, [63, 61]);
  const past = await pickWith(x)([T(61), T(62), T(63)], 7, NOW, torn().check);
  assert.equal(past.target.player_id, 61);
});

// ── asking Torn ──

// ffs_chainStatus as the script has it, on a stand-in fetch. Gives the status
// function, the URLs it fetched, and the stand-down time it leaves.
function statusWith(x, { reply, standDownUntil = 0, hang = false } = {}) {
  const urls = [];
  const fetchStub = async (url) => {
    urls.push(url);
    if (hang) return new Promise(() => {});
    if (reply instanceof Error) throw reply;
    return { json: async () => reply };
  };
  // When the fetch hangs, the timeout fires at once instead of in 4 seconds.
  const timer = hang ? (f) => f() : setTimeout;
  const made = new Function('key', 'fetch', 'Date', 'setTimeout',
    'let _ffsRateLimitedUntil = ' + standDownUntil + ';\n' + x.konst('FFS_REFUSAL_CODES') +
    x.konst('FFS_RATE_LIMIT_BACKOFF_MS') + x.konst('FFS_CHAIN_CHECK_TIMEOUT_MS') + x.fn('ffs_isRateLimitError') +
    x.fn('ffs_chainStatus') + 'return { status: ffs_chainStatus, until: () => _ffsRateLimitedUntil };')(
    'test-key', fetchStub, FakeDate, timer);
  return { ...made, urls };
}

// Fails, rather than hangs, when a call never settles: a test left waiting
// for ever is cancelled, and every test after it with it.
async function within(ms, promise) {
  let timer;
  const guard = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error('still waiting after ' + ms + ' ms')), ms);
  });
  try {
    return await Promise.race([promise, guard]);
  } finally {
    clearTimeout(timer);
  }
}

both('Torn saying Okay means ok, from one live call for the player basic profile', async (x) => {
  const s = statusWith(x, { reply: { profile: { id: 7, status: { state: 'Okay' } } } });
  assert.equal(await s.status(7), 'ok');
  assert.equal(s.urls.length, 1);
  assert.match(s.urls[0], /^https:\/\/api\.torn\.com\/v2\/user\/7\/basic\?/);
  assert.match(s.urls[0], /[?&]key=test-key(&|$)/);
  // A cache-buster, so a hospital stay that began seconds ago is seen.
  assert.match(s.urls[0], /[?&]timestamp=\d+/);
});

both('hospital, travel, abroad, jail and federal jail all mean out', async (x) => {
  for (const state of ['Hospital', 'Traveling', 'Abroad', 'Jail', 'Federal']) {
    assert.equal(await statusWith(x, { reply: { profile: { status: { state } } } }).status(7), 'out', state);
  }
});

both('an error, a failed fetch, a reply without a status or no reply in time all mean unknown', async (x) => {
  assert.equal(await statusWith(x, { reply: { error: { code: 2, error: 'Incorrect key' } } }).status(7), 'unknown');
  assert.equal(await statusWith(x, { reply: new Error('network down') }).status(7), 'unknown');
  assert.equal(await statusWith(x, { reply: {} }).status(7), 'unknown');
  assert.equal(await within(1000, statusWith(x, { hang: true }).status(7)), 'unknown');
});

both('a refusal stands the Torn calls down for a minute, and while stood down nothing is asked', async (x) => {
  const s = statusWith(x, { reply: { error: { code: 5, error: 'Too many requests' } } });
  assert.equal(await s.status(7), 'unknown');
  assert.equal(s.until(), NOW + 60000);
  const idle = statusWith(x, { reply: { profile: { status: { state: 'Okay' } } }, standDownUntil: NOW + 1000 });
  assert.equal(await idle.status(7), 'unknown');
  assert.equal(idle.urls.length, 0);
});
```

Put it in place:

```bash
WS=/opt/warboard/.superpowers/sdd/2026-10-25-ffs-chain-button-skip-unavailable
python3 -I $WS/apply.py /opt/warboard/docs/superpowers/plans/2026-10-25-ffs-chain-button-skip-unavailable.md 2 tests $WS/ov/ffs-chain-button.test.mjs
```

Expected: `.../ffs-chain-button.test.mjs: test block appended`

- [ ] **Step 2: Run them to see them fail**

```bash
WS=/opt/warboard/.superpowers/sdd/2026-10-25-ffs-chain-button-skip-unavailable
cd /opt/warboard/server && FFS_DIR=$WS/ov node --test $WS/ov/ffs-chain-button.test.mjs > $WS/red2.txt 2>&1; grep -E '^# (tests|pass|fail) ' $WS/red2.txt | paste -sd' '; grep -c 'not found: const FFS_CHAIN_' $WS/red2.txt
```

Expected: `# tests 34 # pass 12 # fail 22`. Task 1's 12 pass, and all 22 new tests fail on `not found: const FFS_CHAIN_MAX_CHECKS` or `not found: const FFS_CHAIN_CHECK_TIMEOUT_MS`; the grep count is 22 or more.

- [ ] **Step 3: Make the change**

Replace:

```js
  // Chain button stolen from https://greasyfork.org/en/scripts/511916-random-target-finder
  function create_chain_button() {
```

With:

```js
  // A click asks Torn about this many chain targets at most. When they are
  // all out, a note says so and the next click carries on after them.
  const FFS_CHAIN_MAX_CHECKS = 3;
  // How long a click waits for Torn's answer about one target.
  const FFS_CHAIN_CHECK_TIMEOUT_MS = 4000;

  /**
   * Torn's own word on whether a chain target can be attacked now: "ok" for
   * the status Okay, "out" for any other (hospital, travel, abroad, jail), and
   * "unknown" when Torn gives no answer, and the button then goes by FFScouter
   * alone, as it did before it asked. One API call on the script's key, with
   * a cache-buster so a hospital stay that began seconds ago is seen. While
   * Torn is refusing the key it asks nothing, as the other Torn calls here do.
   */
  async function ffs_chainStatus(playerId) {
    if (!key || Date.now() < _ffsRateLimitedUntil) return "unknown";
    const url = `https://api.torn.com/v2/user/${playerId}/basic?striptags=true&timestamp=${Date.now()}&key=${encodeURIComponent(key)}`;
    let timer = null;
    try {
      const data = await Promise.race([
        fetch(url).then((r) => r.json()),
        new Promise((resolve) => {
          timer = setTimeout(() => resolve(null), FFS_CHAIN_CHECK_TIMEOUT_MS);
        }),
      ]);
      if (!data || data.error) {
        if (ffs_isRateLimitError(data)) _ffsRateLimitedUntil = Date.now() + FFS_RATE_LIMIT_BACKOFF_MS;
        return "unknown";
      }
      const state = data.profile && data.profile.status && data.profile.status.state;
      if (!state) return "unknown";
      return state === "Okay" ? "ok" : "out";
    } catch (_) {
      return "unknown";
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * The next target on the chain list who can be attacked, walking from the
   * saved place `start` and round the list once. FFScouter's hospital_until
   * rules out, for free, the ones it already knows are in hospital, and
   * `check(playerId)` asks Torn about the rest, at most FFS_CHAIN_MAX_CHECKS
   * a click. Torn saying "ok", or giving no answer, means go.
   *
   * Resolves to the target and `next`, where the following click starts; or,
   * when nobody can be attacked, to a null target, `next`, and the note to show.
   */
  async function ffs_chainPick(targets, start, nowMs, check) {
    const n = targets.length;
    // A saved place past the end of this list starts again from its top.
    const from = Number.isInteger(start) && start >= 0 && start < n ? start : 0;
    let checks = 0;
    let soonest = null;
    for (let step = 0; step < n; step++) {
      const i = (from + step) % n;
      const t = targets[i];
      if (!t || !t.player_id) continue;
      const outAt = Number(t.hospital_until) * 1000;
      if (outAt > nowMs) {
        if (!soonest || outAt < soonest.at) soonest = { name: t.name, at: outAt };
        continue;
      }
      if (checks === FFS_CHAIN_MAX_CHECKS) {
        return {
          target: null,
          next: i,
          note: `The next ${FFS_CHAIN_MAX_CHECKS} on your chain list can't be attacked right now (hospital, travel or jail). Click again for the next ones.`,
        };
      }
      checks++;
      if ((await check(t.player_id)) !== "out") return { target: t, next: (i + 1) % n };
    }
    let note = "Nobody on your chain list can be attacked right now.";
    if (soonest) {
      const minutes = Math.max(1, Math.ceil((soonest.at - nowMs) / 60000));
      note += ` First out of hospital: ${soonest.name} in ${minutes} min.`;
    }
    return { target: null, next: from, note };
  }

  // Chain button stolen from https://greasyfork.org/en/scripts/511916-random-target-finder
  function create_chain_button() {
```

Apply it to both copies:

```bash
WS=/opt/warboard/.superpowers/sdd/2026-10-25-ffs-chain-button-skip-unavailable
python3 -I $WS/apply.py /opt/warboard/docs/superpowers/plans/2026-10-25-ffs-chain-button-skip-unavailable.md 2 edits $WS/ov/ffs-banner-estimates.user.js $WS/ov/ffs-banner-estimates-beta.user.js
```

Expected: `1 edits applied`, once for each copy.

- [ ] **Step 4: Run the tests to see them pass, and check both copies parse**

```bash
WS=/opt/warboard/.superpowers/sdd/2026-10-25-ffs-chain-button-skip-unavailable
cd /opt/warboard/server && FFS_DIR=$WS/ov node --test $WS/ov/ffs-chain-button.test.mjs 2>&1 | grep -E '^# (tests|pass|fail) |^not ok' | paste -sd' '
for f in ffs-banner-estimates ffs-banner-estimates-beta; do node --check $WS/ov/$f.user.js && echo "parses: $f"; done
```

Expected: `# tests 34 # pass 34 # fail 0`, then the two `parses:` lines.

### Task 3: The click

**Files:**
- Modify both copies in `$WS/ov`:
  - remove `get_next_target_index` and `get_random_chain_target`, which nothing else calls;
  - replace `create_chain_button`'s click listener.
- Test: `$WS/ov/ffs-chain-button.test.mjs` (appended to)

**Interfaces:**
- Consumes:
  - from Task 1: `CHAIN_CLICKED_KEY`, `get_cached_targets(true)` and `update_ff_targets()`;
  - from Task 2: `ffs_chainPick` and `ffs_chainStatus`;
  - from the script: `apikey`, `TARGET_INDEX_KEY`, `rD_getValue`, `rD_setValue`, `ffSettingsGet`, `showToast` and `TOAST_LOG`.
- Produces: the click as the Design of record describes it. Every click writes `CHAIN_CLICKED_KEY`, and the saved place moves to the pick's `next`.

- [ ] **Step 1: Write the failing tests**

Append to the test file:

```js
// ── the click ──

// create_chain_button as the script has it, on stand-in page objects. Torn's
// answers come by player id. `events` records, in order, each tab opened,
// each question to Torn, each note shown, the waiting tab closing, and a fetch
// of the list begun.
function clickRig(x, { tabType = 'newtab', linkType = 'attack', pda = false, list = [T(71), T(72)], answers = {}, blocked = false, index = 0 } = {}) {
  const events = [];
  const stored = { 'ffscouterv2-target-index': String(index) };
  let button = null;
  const waiting = {
    opener: 'the page',
    document: { title: '' },
    location: { href: '' },
    closed: false,
    close() {
      this.closed = true;
      events.push(['close']);
    },
  };
  const win = {
    location: { href: 'https://www.torn.com/index.php' },
    open(url, name, features) {
      events.push(['open', url, name, features || '']);
      return url === '' && !blocked ? waiting : null;
    },
  };
  const deps = {
    document: {
      createElement: () => ({ style: {}, on: {}, addEventListener(type, f) { this.on[type] = f; } }),
      body: { appendChild(el) { button = el; } },
    },
    window: win,
    ffSettingsGetToggle: () => true,
    ffSettingsGet: (k) => ({ 'chain-link-type': linkType, 'chain-tab-type': tabType })[k],
    ffdebug: () => {},
    get_cached_targets: () => list,
    // The old click's own pick, so a run before the change fails on what the
    // click does rather than on a missing name.
    get_random_chain_target: () => (list ? list[0] : null),
    ffs_chainStatus: async (id) => {
      events.push(['ask', id]);
      return answers[id] || 'ok';
    },
    rD_getValue: (k, d) => (k in stored ? stored[k] : d),
    rD_setValue: (k, v) => { stored[k] = String(v); },
    update_ff_targets: () => events.push(['update']),
    showToast: (message) => events.push(['toast', message]),
    TOAST_LOG: 'log',
    // The script's PDA test is apikey[0] != "#".
    apikey: pda ? 'a-pda-key' : '#',
    Date: FakeDate,
  };
  const names = Object.keys(deps);
  new Function(...names,
    x.konst('TARGET_INDEX_KEY') + x.konst('CHAIN_CLICKED_KEY') + x.konst('FFS_CHAIN_MAX_CHECKS') +
    x.fn('ffs_chainPick') + x.fn('create_chain_button') + 'return create_chain_button;')(...names.map((k) => deps[k]))();
  return { events, stored, waiting, win, button: () => button, click: () => button.on.click() };
}
const attackPage = (id) => 'https://www.torn.com/page.php?sid=attack&user2ID=' + id;

both('new tab: the tab opens with the click, before Torn is asked, then goes to the attack page', async (x) => {
  const r = clickRig(x);
  await r.click();
  assert.deepEqual(r.events, [['open', '', '_blank', ''], ['ask', 71]]);
  assert.equal(r.waiting.location.href, attackPage(71));
  assert.equal(r.waiting.opener, null);
  assert.equal(r.stored['ffscouterv2-target-index'], '1');
  assert.equal(r.stored['ffscouterv2-chain-clicked-at'], String(NOW));
});

both('same tab: Torn is asked, then the page itself goes to the target, and no tab opens', async (x) => {
  const r = clickRig(x, { tabType: 'sametab', linkType: 'profile' });
  await r.click();
  assert.deepEqual(r.events, [['ask', 71]]);
  assert.equal(r.win.location.href, 'https://www.torn.com/profiles.php?XID=71');
});

both('when the 3 asked about are all out, the waiting tab closes, the note shows and the next click starts after them', async (x) => {
  const r = clickRig(x, { list: [T(71), T(72), T(73), T(74)], answers: { 71: 'out', 72: 'out', 73: 'out' } });
  await r.click();
  assert.equal(r.waiting.closed, true);
  assert.equal(r.events.at(-1)[0], 'toast');
  assert.match(r.events.at(-1)[1], /^The next 3 on your chain list can't be attacked right now/);
  assert.equal(r.stored['ffscouterv2-target-index'], '3');
});

both('on Torn PDA the tab opens once the target is known', async (x) => {
  const r = clickRig(x, { pda: true });
  await r.click();
  assert.deepEqual(r.events, [['ask', 71], ['open', attackPage(71), '_blank', 'noopener,noreferrer']]);
});

both('a browser that blocks the waiting tab gets the target opened the old way once it is known', async (x) => {
  const r = clickRig(x, { blocked: true });
  await r.click();
  assert.deepEqual(r.events, [['open', '', '_blank', ''], ['ask', 71], ['open', attackPage(71), '_blank', 'noopener,noreferrer']]);
});

both('a second click while the first is still asking Torn does nothing, and the button is dimmed meanwhile', async (x) => {
  const r = clickRig(x);
  const first = r.click();
  assert.equal(r.button().style.opacity, '0.5');
  await r.click();
  await first;
  assert.equal(r.events.filter((e) => e[0] === 'ask').length, 1);
  assert.equal(r.events.filter((e) => e[0] === 'open').length, 1);
  assert.equal(r.button().style.opacity, '');
});

both('with no list yet, a click starts a fetch and opens nothing', async (x) => {
  const r = clickRig(x, { list: null });
  await r.click();
  assert.deepEqual(r.events, [['update']]);
});

both('a click starts where the last one left off and passes over people FFScouter has in hospital', async (x) => {
  // 72 is in hospital for 10 more minutes; 73's stay ended 10 minutes ago.
  const list = [T(71), T(72, { hospital_until: NOW_S + 600 }), T(73, { hospital_until: NOW_S - 600 })];
  const r = clickRig(x, { list, index: 1 });
  await r.click();
  assert.deepEqual(r.events, [['open', '', '_blank', ''], ['ask', 73]]);
  assert.equal(r.waiting.location.href, attackPage(73));
  assert.equal(r.stored['ffscouterv2-target-index'], '0');
});
```

Put it in place:

```bash
WS=/opt/warboard/.superpowers/sdd/2026-10-25-ffs-chain-button-skip-unavailable
python3 -I $WS/apply.py /opt/warboard/docs/superpowers/plans/2026-10-25-ffs-chain-button-skip-unavailable.md 3 tests $WS/ov/ffs-chain-button.test.mjs
```

Expected: `.../ffs-chain-button.test.mjs: test block appended`

- [ ] **Step 2: Run them to see them fail**

```bash
WS=/opt/warboard/.superpowers/sdd/2026-10-25-ffs-chain-button-skip-unavailable
cd /opt/warboard/server && FFS_DIR=$WS/ov node --test $WS/ov/ffs-chain-button.test.mjs > $WS/red3.txt 2>&1; grep -E '^# (tests|pass|fail) ' $WS/red3.txt | paste -sd' '; grep -c 'ERR_ASSERTION' $WS/red3.txt
```

Expected: `# tests 50 # pass 34 # fail 16`. The 16 are the 8 new click tests in each copy, and every one fails on an assertion (`ERR_ASSERTION`), because the old click opens its pick at once, without asking Torn. The grep count is 16 or more.

- [ ] **Step 3: Make the changes**

Replace:

```js
  function get_next_target_index() {
    const value = Number(rD_getValue(TARGET_INDEX_KEY, 0));

    rD_setValue(TARGET_INDEX_KEY, value + 1);

    return value;
  }

  function reset_next_target_index() {
```

With:

```js
  function reset_next_target_index() {
```

Replace:

```js
  function get_random_chain_target() {
    const targets = get_cached_targets(true);
    if (!targets) {
      return null;
    }

    let index = get_next_target_index();

    if (index >= targets.length) {
      index = 0;
      reset_next_target_index();
    }

    return targets[index];
  }

  function clear_cached_targets() {
```

With:

```js
  function clear_cached_targets() {
```

Replace:

```js
    // Add a click event listener to open Google in a new tab
    button.addEventListener("click", function () {
      let rando = get_random_chain_target();
      if (!rando) {
        return;
      }

      const linkType = ffSettingsGet("chain-link-type") || "attack";
      const tabType = ffSettingsGet("chain-tab-type") || "newtab";

      let profileLink;
      if (linkType === "profile") {
        profileLink = `https://www.torn.com/profiles.php?XID=${rando.player_id}`;
      } else {
        profileLink = `https://www.torn.com/page.php?sid=attack&user2ID=${rando.player_id}`;
      }

      if (tabType === "sametab") {
        window.location.href = profileLink;
      } else {
        window.open(profileLink, '_blank', 'noopener,noreferrer');
      }
    });
```

With:

```js
    // One click, one target. The click waits a moment while Torn is asked
    // about the pick (ffs_chainPick); a second click meanwhile is ignored
    // rather than starting a second search.
    let busy = false;
    button.addEventListener("click", async function () {
      if (busy) return;
      // A page load within FFS_CHAIN_ACTIVE_MS of this counts as chaining
      // and may fetch the list again (ffs_chainRefreshOnLoad).
      rD_setValue(CHAIN_CLICKED_KEY, Date.now());
      const targets = get_cached_targets(true);
      if (!targets || !targets.length) {
        update_ff_targets();
        return;
      }

      const linkType = ffSettingsGet("chain-link-type") || "attack";
      const tabType = ffSettingsGet("chain-tab-type") || "newtab";

      // A new tab has to be opened by the click itself, before Torn answers:
      // the browser's popup blocker stops one opened after a wait. Torn PDA
      // opens tabs its own way, so there the tab opens once the target is
      // known, with the call the button always used.
      const onPDA = apikey[0] != "#";
      let tab = null;
      if (tabType !== "sametab" && !onPDA) {
        tab = window.open("", "_blank");
        if (tab) {
          tab.opener = null;
          try {
            tab.document.title = "FF Scouter: finding a chain target";
          } catch (_) {}
        }
      }

      busy = true;
      button.style.opacity = "0.5";
      try {
        const start = Number(rD_getValue(TARGET_INDEX_KEY, 0)) || 0;
        const pick = await ffs_chainPick(targets, start, Date.now(), ffs_chainStatus);
        rD_setValue(TARGET_INDEX_KEY, pick.next);
        if (!pick.target) {
          if (tab) tab.close();
          showToast(pick.note, TOAST_LOG);
          return;
        }
        const id = pick.target.player_id;
        const link =
          linkType === "profile"
            ? `https://www.torn.com/profiles.php?XID=${id}`
            : `https://www.torn.com/page.php?sid=attack&user2ID=${id}`;
        if (tabType === "sametab") window.location.href = link;
        else if (tab) tab.location.href = link;
        else window.open(link, "_blank", "noopener,noreferrer");
      } catch (err) {
        if (tab) tab.close();
        console.error("[FF Scouter V2] Chain button failed", err);
      } finally {
        busy = false;
        button.style.opacity = "";
      }
    });
```

Apply them to both copies:

```bash
WS=/opt/warboard/.superpowers/sdd/2026-10-25-ffs-chain-button-skip-unavailable
python3 -I $WS/apply.py /opt/warboard/docs/superpowers/plans/2026-10-25-ffs-chain-button-skip-unavailable.md 3 edits $WS/ov/ffs-banner-estimates.user.js $WS/ov/ffs-banner-estimates-beta.user.js
```

Expected: `3 edits applied`, once for each copy.

- [ ] **Step 4: Run the tests to see them pass; nothing calls the removed functions; both copies parse**

```bash
WS=/opt/warboard/.superpowers/sdd/2026-10-25-ffs-chain-button-skip-unavailable
cd /opt/warboard/server && FFS_DIR=$WS/ov node --test $WS/ov/ffs-chain-button.test.mjs 2>&1 | grep -E '^# (tests|pass|fail) |^not ok' | paste -sd' '
grep -c 'get_random_chain_target\|get_next_target_index' $WS/ov/ffs-banner-estimates.user.js $WS/ov/ffs-banner-estimates-beta.user.js
for f in ffs-banner-estimates ffs-banner-estimates-beta; do node --check $WS/ov/$f.user.js && echo "parses: $f"; done
```

Expected:
- `# tests 50 # pass 50 # fail 0`;
- each copy counts `0`;
- the two `parses:` lines.

Then run "Review before release" and wait for the review. Its fixes go in, each RED→GREEN on the overlay, before Task 4.

### Task 4: Versions, release and push

**Files:**
- Modify (overlay first, then installed):
  - `server/public/scripts/ffs-banner-estimates.user.js` and `.meta.js`;
  - `server/public/scripts/ffs-banner-estimates-beta.user.js` and `.meta.js`.
- Create: `server/ffs-chain-button.test.mjs` (the overlay's test file).

**Interfaces:**
- Consumes: the overlay as Task 3 and the review left it.
- Produces: the release; nothing later depends on it.

- [ ] **Step 1: The versions as served, then the bump and the CHANGELOG entries**

```bash
for f in ffs-banner-estimates ffs-banner-estimates-beta; do echo "$f served $(curl -s http://127.0.0.1:3000/scripts/$f.meta.js | grep -m1 '@version' | awk '{print $3}')"; done
```

Expected: `ffs-banner-estimates served 2.73.61` and `ffs-banner-estimates-beta served 2.73.912`. A higher served version means an out-of-band deploy: stop and ask the owner.

```bash
WS=/opt/warboard/.superpowers/sdd/2026-10-25-ffs-chain-button-skip-unavailable
python3 -I - $WS <<'PY'
import sys
ws = sys.argv[1]
def bump(path, pairs):
    s = open(path, encoding="utf-8").read()
    for old, new in pairs:
        assert s.count(old) == 1, (path, old[:50])
        s = s.replace(old, new)
    open(path, "w", encoding="utf-8").write(s)
    print("bumped", path.rsplit("/", 1)[1])
bump(ws + "/ov/ffs-banner-estimates.user.js", [
    ("// @version      2.73.61\n", "// @version      2.73.62\n"),
    ("  const SCRIPT_VERSION = '2.73.61';", "  const SCRIPT_VERSION = '2.73.62';"),
    ("// 2.73.61 —  Menu:",
     "// 2.73.62 —  Chain button: skip people who can't be attacked. FFScouter's\n"
     "//              hospital times rule out the ones it knows are in hospital, and\n"
     "//              Torn is asked about the pick, one API call on your key and at\n"
     "//              most 3 a click, so a click opens someone out of hospital, not\n"
     "//              travelling and not in jail. The target list is fetched again\n"
     "//              once it is an hour old while you chain; it was never refreshed.\n"
     "//\n"
     "// 2.73.61 —  Menu:"),
])
bump(ws + "/ov/ffs-banner-estimates-beta.user.js", [
    ("// @version      2.73.912\n", "// @version      2.73.913\n"),
    ("  const SCRIPT_VERSION = '2.73.912';", "  const SCRIPT_VERSION = '2.73.913';"),
    ("// 2.73.912 — Menu:",
     "// 2.73.913 — Chain button: skip people who can't be attacked (as FFS 2.73.62).\n"
     "// 2.73.912 — Menu:"),
])
PY
```

Expected: `bumped ffs-banner-estimates.user.js` and `bumped ffs-banner-estimates-beta.user.js`.

- [ ] **Step 2: The metas, the checks and the tests on the overlay**

```bash
WS=/opt/warboard/.superpowers/sdd/2026-10-25-ffs-chain-button-skip-unavailable
for f in ffs-banner-estimates ffs-banner-estimates-beta; do
  sed -n '/==UserScript==/,/==\/UserScript==/p' $WS/ov/$f.user.js > $WS/ov/$f.meta.js
  echo "$f: $(grep -m1 '@version' $WS/ov/$f.meta.js | awk '{print $3}') / $(grep -o "SCRIPT_VERSION = '[^']*'" $WS/ov/$f.user.js)"
  diff $WS/orig/$f.meta.js $WS/ov/$f.meta.js | grep '^[<>]'
  node --check $WS/ov/$f.user.js && echo "parses: $f"
done
cd /opt/warboard/server && FFS_DIR=$WS/ov node --test $WS/ov/ffs-chain-button.test.mjs 2>&1 | grep -E '^# (tests|pass|fail) ' | paste -sd' '
```

Expected:
- `ffs-banner-estimates: 2.73.62 / SCRIPT_VERSION = '2.73.62'`, then the meta diff showing only the old and new `@version` lines, then `parses: ffs-banner-estimates`;
- the same for the beta with 2.73.913;
- `# tests 50 # pass 50 # fail 0`.

- [ ] **Step 3: Nobody else changed the served files, then install**

```bash
WS=/opt/warboard/.superpowers/sdd/2026-10-25-ffs-chain-button-skip-unavailable
S=/opt/warboard/server/public/scripts
for f in ffs-banner-estimates.user.js ffs-banner-estimates.meta.js ffs-banner-estimates-beta.user.js ffs-banner-estimates-beta.meta.js; do cmp -s $S/$f $WS/orig/$f && echo "unchanged $f" || echo "CHANGED $f"; done
cd /opt/warboard && git status --short -- server/public/scripts/ffs-banner-estimates.user.js server/public/scripts/ffs-banner-estimates.meta.js server/public/scripts/ffs-banner-estimates-beta.user.js server/public/scripts/ffs-banner-estimates-beta.meta.js server/ffs-chain-button.test.mjs
```

Expected: four `unchanged` lines, and no `git status` lines. A `CHANGED` line or a status line means another session changed one of these files since Task 1: stop and ask the owner, since installing would overwrite their change.

```bash
WS=/opt/warboard/.superpowers/sdd/2026-10-25-ffs-chain-button-skip-unavailable
S=/opt/warboard/server/public/scripts
echo "installed at $(TZ=America/New_York date '+%H:%M %Z')"
for f in ffs-banner-estimates ffs-banner-estimates-beta; do install -o warboard -g warboard -m 644 $WS/ov/$f.user.js $WS/ov/$f.meta.js $S/; done
install -o root -g root -m 644 $WS/ov/ffs-chain-button.test.mjs /opt/warboard/server/ffs-chain-button.test.mjs
for f in ffs-banner-estimates ffs-banner-estimates-beta; do
  echo "$f: served $(curl -s http://127.0.0.1:3000/scripts/$f.meta.js | grep -m1 '@version' | awk '{print $3}'), same as the overlay: $(curl -s http://127.0.0.1:3000/scripts/$f.user.js | cmp -s - $WS/ov/$f.user.js && echo yes || echo NO), owner $(stat -c '%U:%G %a' $S/$f.user.js)"
done
```

Expected: `ffs-banner-estimates: served 2.73.62, same as the overlay: yes, owner warboard:warboard 644`, and the same for the beta with 2.73.913.

- [ ] **Step 4: The tests in place, and the whole suite**

```bash
WS=/opt/warboard/.superpowers/sdd/2026-10-25-ffs-chain-button-skip-unavailable
cd /opt/warboard/server && node --test ffs-chain-button.test.mjs ffs-sort.test.mjs ffs-travel-country.test.mjs 2>&1 | grep -E '^# (tests|pass|fail|skipped) ' | paste -sd' '
FFS_BUILD=beta node --test ffs-sort.test.mjs 2>&1 | grep -E '^# (tests|pass|fail|skipped) ' | paste -sd' '
node --test > $WS/suite.txt 2>&1; grep -E '^# (tests|pass|fail|skipped) ' $WS/suite.txt | paste -sd' '; grep -E '^not ok' $WS/suite.txt | head
```

Expected: `# tests 135 # pass 133 # fail 0 # skipped 2` (50 new tests and the 85 FFS tests already there), then `# tests 53 # pass 53 # fail 0 # skipped 0` (the sort tests run on the beta copy, the only existing test of it), then the suite with `# fail 0`. The suite's totals depend on other sessions' tests, so they are not pinned.

- [ ] **Step 5: Commit**

```bash
cd /opt/warboard && git add server/ffs-chain-button.test.mjs && git commit -q -F - -- server/public/scripts/ffs-banner-estimates.user.js server/public/scripts/ffs-banner-estimates.meta.js server/public/scripts/ffs-banner-estimates-beta.user.js server/public/scripts/ffs-banner-estimates-beta.meta.js server/ffs-chain-button.test.mjs <<'EOF'
ffs 2.73.62 / beta 2.73.913: the chain button skips people who can't be attacked

A click passes over the targets FFScouter knows are in hospital, then asks
Torn about the pick (at most 3 calls a click) and opens someone out of
hospital, not travelling and not in jail. The target list is fetched again
once it is an hour old, at a page load within 10 minutes of a click; its age
check compared a date string and never fired, so the list was never
refreshed.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
git log --oneline -1; git show --stat --format= HEAD
```

Expected: the commit, with five files: the four script files and the new test file.

- [ ] **Step 6: Sweep, then push**

Copy the sweep patterns the blood-bag release used, one per line, to `$WS/sweep.txt`: `cp /tmp/claude-0/-root/47c424fc-f532-4851-8c7f-7c18d084306c/scratchpad/bb-budget/sweep.txt $WS/sweep.txt` (8 lines). They never go into the repo.

```bash
WS=/opt/warboard/.superpowers/sdd/2026-10-25-ffs-chain-button-skip-unavailable
cd /opt/warboard && git log --oneline origin/main..main
test -s $WS/sweep.txt && echo "sweep hits: $(git diff origin/main..main | grep -E '^\+' | grep -c -i -F -f $WS/sweep.txt)"
git diff origin/main..main | grep -E '^\+' | grep -n -o -E '(^|[^A-Za-z0-9_])[A-Za-z0-9]{16}([^A-Za-z0-9_]|$)' | head
```

Expected: this plan's commit and the release commit; `sweep hits: 0`; and every 16-character word plainly not a key, or none.

```bash
cd /opt/warboard && git push origin main 2>&1 | sed -E 's#//[^@]*@#//***@#g' | tail -n 3; git status -sb | head -1
```

Expected: `main -> main`, and `## main...origin/main`.

- [ ] **Step 7: Memory**

In `/root/.claude/projects/-root/memory/`:
- Write `reference_ffs_chain_button.md`. It records:
  - what the chain button does since 2.73.62 / 2.73.913;
  - FFScouter's get-targets: a filtered query comes back ordered by battle stats, with an optional `hospital_until`;
  - the refresh rule;
  - Torn's `/v2/user/{id}/basic`, which gives `profile.status.state`;
  - what is owed from Step 8.
- Add its line to `MEMORY.md`. To keep `MEMORY.md` at 200 lines, fold the FFS countdown-timing and hospital-timer-sourcing lines into one line that links both files.

- [ ] **Step 8: Report**

Tell the owner, in EDT, with the URLs at the top:
- `2.73.62 is live: https://tornwar.com/scripts/ffs-banner-estimates.user.js` and `Beta 2.73.913 is live: https://tornwar.com/scripts/ffs-banner-estimates-beta.user.js`.
- What changed, in their terms.
- What the release check saw: the served versions, the tests, the suite.
- Owed, not claimed. These are the owner's live checks, since nothing here can click the button in a real browser:
  - new tab on a PC, where a blank tab should turn into the attack page;
  - same tab;
  - the note when nobody can be attacked;
  - new tab on Torn PDA. If that one opens nothing, the fix is the same tab on PDA.
- "Rulings I made" and "Deferred minors" from the ledger, as executing-plans asks.
- Siblings, not done:
  - the diagnostics' stale version stamp ("2.73.0-wb51", hard-coded in two places);
  - upstream FF Scouter 3.3 made the button a link (middle-click works) and added level and factionless filters.
