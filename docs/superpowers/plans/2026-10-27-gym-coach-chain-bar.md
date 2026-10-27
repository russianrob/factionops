# Gym Coach Chain Bar - Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On every Torn page, a flashing red bar while the faction's chain has 10 or more hits and under 1:00 left, like Gym Coach's full-energy banner.

**Architecture:**
- `tests/gym-coach/gym-coach-beta.user.js` (Gym Coach's working copy) gains `readChainFromDom` (Torn's sidebar chain bar: count and clock), `chainCooldownFrom` (the bars poll's chain cooldown), `chainNag` (pure: should the bar be up) and `renderChainNag` (the bar). The coach's existing once-a-second tick calls it on every page, before the full-bar banner, which gives up its spot while the chain bar is up. The existing bars poll keeps the cooldown on `state.chainCd`.
- The bar is only up while the page has focus (Torn PDA exempt): Torn's rule for anything read off a page. No sound, no notification, no new API request, no setting.
- Released as 0.12.19: `deploy.sh` promotes the working copy to the served beta and its meta; the stable copy and its meta are copied from them (byte-identical, as `gym-coach-promotion.test.mjs` requires). Greasy Fork 600789 is the update source, so the owner uploads it there.

**Tech Stack:** Plain-JS userscript. Gym Coach's own suite: `node <file>` per test file in `tests/gym-coach`, `ok`/`FAIL` lines and an exit code; browser tests use playwright-core from `/root/.hermes/hermes-agent/node_modules` against `harness/gym-coach-beta.user.js` (`build-harness.sh` builds it: the harness preamble, which stubs GM_* and the Torn API, plus the working copy).

**Spec:** the owner's ask and the recommended answers below. There is no spec file.

**The ask:**
- About 10:11 EDT on 2026-10-27, the owner: "look at gym cosch about the red bar on every page saying how long its been a full bar of E, use same concept but for when any chain is dying under 1:00 left", then "but have it flashing if possible". At about 10:17 EDT: "im going to breakfast so youre on autopilot do what is recommended". The questions below were not put to the owner; each takes the recommended answer, recorded here for the owner to overturn.
- Facts found:
  - Gym Coach is the owner's only script that runs on every Torn page (`@match https://www.torn.com/*`). FactionOps runs on faction, war, attack and profile pages only.
  - Gym Coach's full-bar banner (`renderNag`) is drawn from its once-a-second tick on every page, outside the gym page's gate, when the page is visible or in Torn PDA. Gym Coach reads the energy bar off Torn's sidebar every second because the API's bars are cached for about 30 s.
  - Torn's sidebar chain bar is `#barChain`, with the count in `[class*="bar-stats"]` ("1,234/2,500") and the clock in `[class*="bar-timeleft"]` ("00:42"); FactionOps reads it with these selectors.
  - Gym Coach's bars poll (`bars,cooldowns,...`, v1, every 60 s while visible) already returns `chain` (`current`, `timeout`, `cooldown`), unused until now.
  - When a chain ends, Torn keeps its count through a cooldown of about 6 s a hit, and no new chain can build in it. Whether the sidebar counts that cooldown down in the chain's clock is not known: no log or capture on this box holds the sidebar's text.
  - Torn's scripting rules: nothing read off a page may draw attention while that page does not have focus (the accepted remedy is a `document.hasFocus()` gate; Torn PDA misreports focus, so it is exempt). API requests are allowed.
- Rulings (the recommended answers):
  1. Host: Gym Coach, for the facts above. A new script would need every member to install it; FactionOps is not on every page.
  2. "Any chain" from 10 hits. Under 10 nothing is at stake, and every lone attack starts a 1-hit chain, so a bar from 1 would flash after most fights.
  3. "Under 1:00": the clock reads 0:59 or less, and more than 0.
  4. The data: Torn's sidebar, read on the existing tick. The bar is up only while the page has focus, or in Torn PDA.
  5. A chain in its cooldown: the bar stays down while the last bars poll said the chain was in its cooldown, unless the count has grown past the count that poll read (a chain cannot grow in its cooldown). No other end-of-chain guess: a timer that reads 0 is not taken as the chain's end, because a stray 0 would then hide the bar for a chain that is still dying.
  6. Flashing: red and white, once a second; steady red for anyone whose system asks for less motion. Clicks pass through it. It says `CHAIN DYING · 1,234 hits · 0:42 left`.
  7. The full-bar banner gives up its spot while the chain bar is up; the chain bar drops below FactionOps' own bar where FactionOps has one, as the banner does.
  8. Version 0.12.19 (the stat-book fix offered on 2026-10-22 is a separate change, still awaiting the owner, and would be 0.12.20). Gym Coach has no CHANGELOG block.

**Execution:** Native. One fresh Opus reviewer checks the branch between Task 1 and Task 2.

## Global Constraints

- The bar is up only when all hold: Torn's sidebar chain bar is on the page, its count is 10 or more, its clock reads more than 0 and under 60 s, the page has focus or this is Torn PDA, and the last bars poll does not say the chain is in its cooldown at a count at least the sidebar's.
- No new API request, no sound, no notification, no stored setting, no change to the full-bar banner's own rules.
- Element ids: the bar `gcb-chain-nag`, its style `gcb-chain-style`, keyframes `gcb-chain-flash`. Text: `CHAIN DYING · <count with commas> hits · 0:<two digits> left`.
- ASCII only in the script (`deploy.sh` refuses raw curly quotes: Torn PDA breaks on them); `·` for the dot.
- `@version` and `GC_VERSION` both `0.12.19`. Served files `warboard:warboard 644`. The repo is public: tests use made-up numbers (1,234 / 2,500).
- Stage only this plan's paths. Every commit ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **The sidebar in Torn PDA and on other pages.** If a layout has no `#barChain`, or other classes, there is no bar there. Nothing here can render Torn's own pages; the owner's check on the phone covers it.
2. **A chain's cooldown shown as a countdown.** If Torn's sidebar counts a cooldown down in the chain's clock, a 10 to 19-hit chain (a cooldown of 1 to 2 minutes) can show the bar for up to a minute after it ends, until the next bars poll says cooldown. Accepted: no hit is lost, and guessing the end from the clock risks hiding a real one.
3. **The API's cache.** The poll's cooldown can be up to about 30 s old, so the bar may stay down that much longer after a cooldown ends. A new chain needs over 4 minutes without a hit to get under a minute, so this cannot hide a real one.
4. **FactionOps' pages.** FactionOps has its own chain bar there. The chain bar drops to 96 px when FactionOps' elements are on the page, as the full-bar banner does.
5. **Focus.** A visible window that does not have focus (another monitor) shows no bar, by Torn's rule.

## Paths and commands

- `W=/opt/warboard/.superpowers/sdd/2026-10-27-gym-coach-chain-bar` is this plan's git-ignored workspace, `WT=$W/wt` the worktree, on branch `gym-coach-chain-bar`, and `G=$WT/tests/gym-coach`.
- Gym Coach's tests run from `$G` (`node <file>`); each prints `ok`/`FAIL` lines and `<n> passed, <m> failed`, and exits non-zero on a failure.
- **Edits:** each "Replace" block's text occurs in its file exactly once, and the "With" block takes its place. Neither block holds the newline that ends its last line.

## Setup

- [ ] **Step 1: Commit this plan on main, then make the worktree, and build the harness:**

```bash
uptime; cd /opt/warboard && git add -- docs/superpowers/plans/2026-10-27-gym-coach-chain-bar.md && git commit -q -m "plan: Gym Coach chain bar" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- docs/superpowers/plans/2026-10-27-gym-coach-chain-bar.md && W=/opt/warboard/.superpowers/sdd/2026-10-27-gym-coach-chain-bar && mkdir -p "$W" && git worktree add -q "$W/wt" -b gym-coach-chain-bar && "$W/wt/tests/gym-coach/build-harness.sh" && git -C "$W/wt" status --short && git -C "$W/wt" log --format='%h %s' -1 | cat
```

Expected: the load under 12, nothing from `status` (the built harness is git-ignored), then the plan's commit.

- [ ] **Step 2: The sweeps.** `$W/sweep-env.mjs` and `$W/sweep-names.mjs`, exactly as `docs/superpowers/plans/2026-10-27-chain-alerts-outside-war.md` Setup Step 2 gives them.

- [ ] **Step 3: Baseline.** Every Gym Coach test file, one at a time, with the failing files kept for Task 1:

```bash
uptime; W=/opt/warboard/.superpowers/sdd/2026-10-27-gym-coach-chain-bar; cd "$W/wt/tests/gym-coach" && : > "$W/gc-base.txt"; for f in *.test.mjs; do timeout 300 node "$f" > "$W/gc-out-$f.log" 2>&1 || echo "$f" >> "$W/gc-base.txt"; done; ls *.test.mjs | wc -l; wc -l < "$W/gc-base.txt"; cat "$W/gc-base.txt"
```

Expected: the load under 12, the number of test files, then the files that already fail on 0.12.18. Ledger them (`Setup: Ruling:`) as the gate: Task 1 must end with the same failing files.

---

### Task 1: The chain bar

**Files:**
- Modify: `tests/gym-coach/gym-coach-beta.user.js` (version, state, bars poll, the bar, the full-bar banner's yield, the tick)
- Modify: `tests/gym-coach/harness/preamble.js` (the stub's bars payload gains `chain`)
- Create: `tests/gym-coach/chainbar.test.mjs`, `tests/gym-coach/chainbar.e2e.test.mjs`

**Interfaces:**
- Produces: `readChainFromDom()` returning `{ count, left }` or null; `chainCooldownFrom(chain, now)` returning `{ count, until }` or null; `chainNag(now, reading, cd)` returning `{ count, left }` or null; `renderChainNag()`; `state.chainCd`; constants `CHAIN_NAG_ID`, `CHAIN_STYLE_ID`, `CHAIN_NAG_MIN_HITS = 10`, `CHAIN_NAG_SECS = 60`.

- [ ] **Step 1: The unit tests.** Write `tests/gym-coach/chainbar.test.mjs`:

```js
// The chain bar: a flashing red bar on every Torn page while the faction's
// chain has 10 or more hits and under a minute left.
//
// Asked for 2026-10-27, the day after a chain died with no alert: "look at
// gym coach about the red bar on every page saying how long its been a full
// bar of E, use same concept but for when any chain is dying under 1:00
// left", then "but have it flashing if possible".
//
// It reads the chain off Torn's own sidebar once a second, as the coach reads
// the energy bar, and is only up while the page has focus: Torn's rule for
// anything read off a page. The bars poll says whether the chain is in its
// cooldown. These tests lift the functions out of the working copy and run
// them against stand-ins. Numbers are made up.
import fs from "fs";
import assert from "assert";
const src = fs.readFileSync("gym-coach-beta.user.js", "utf8");
function grab(n){const i=src.indexOf("function "+n+"(");if(i<0)return "";let d=0,j=src.indexOf("{",i);
  for(let k=j;k<src.length;k++){if(src[k]==="{")d++;else if(src[k]==="}"){d--;if(!d)return src.slice(i,k+1);}}}
// A top-level `var NAME = ...;` line, or "" when the script has none.
const varLine = (n) => { const m = new RegExp("^  var " + n + " = [^\\n]*;", "m").exec(src); return m ? m[0] : ""; };

let pass=0,fail=0;
const t=(n,f)=>{try{f();pass++;console.log("ok   "+n);}catch(e){fail++;console.log("FAIL "+n+" :: "+e.message);}};

// Torn's sidebar chain bar as the script looks it up: #barChain, holding the
// count and the clock. A null text leaves that part out.
function fakeDoc({ stats = "Chain:1,234/2,500", time = "00:42", bar = true } = {}) {
  const part = (text) => (text == null ? null : { textContent: text });
  const barEl = { querySelector: (sel) => /bar-stats/.test(sel) ? part(stats) : /bar-timeleft/.test(sel) ? part(time) : null };
  return { getElementById: (id) => (bar && id === "barChain" ? barEl : null), querySelector: () => null };
}
const readChain = (doc) => new Function("document", grab("readChainFromDom") + "\nreturn readChainFromDom();")(doc);
const nag = (...a) => new Function([varLine("CHAIN_NAG_MIN_HITS"), varLine("CHAIN_NAG_SECS"), grab("chainNag"), "return chainNag;"].join("\n"))()(...a);
const cooldownFrom = (...a) => new Function(grab("chainCooldownFrom") + "\nreturn chainCooldownFrom;")()(...a);
const NOW = 1800000000000;

t("reads the count and the clock off Torn's sidebar", () => {
  assert.deepStrictEqual(readChain(fakeDoc()), { count: 1234, left: 42 });
});
t("a clock of an hour or more reads in seconds", () => {
  assert.strictEqual(readChain(fakeDoc({ time: "1:02:03" })).left, 3723);
  assert.strictEqual(readChain(fakeDoc({ time: "4:21" })).left, 261);
});
t("no chain bar, or no clock on it, reads as nothing", () => {
  assert.strictEqual(readChain(fakeDoc({ bar: false })), null);
  assert.strictEqual(readChain(fakeDoc({ time: "" })), null);
  assert.strictEqual(readChain(fakeDoc({ time: null })), null);
});
t("a chain of 10 or more with under a minute left puts the bar up", () => {
  assert.deepStrictEqual(nag(NOW, { count: 1234, left: 42 }, null), { count: 1234, left: 42 });
  assert.deepStrictEqual(nag(NOW, { count: 10, left: 59 }, null), { count: 10, left: 59 });
});
t("a minute or more left, under 10 hits, or no clock keeps it down", () => {
  assert.strictEqual(nag(NOW, { count: 1234, left: 60 }, null), null);
  assert.strictEqual(nag(NOW, { count: 9, left: 42 }, null), null);
  assert.strictEqual(nag(NOW, { count: 1234, left: 0 }, null), null);
  assert.strictEqual(nag(NOW, null, null), null);
});
t("a chain in its cooldown keeps it down until it grows", () => {
  const cd = { count: 1234, until: NOW + 30000 };
  assert.strictEqual(nag(NOW, { count: 1234, left: 42 }, cd), null);
  assert.deepStrictEqual(nag(NOW, { count: 1235, left: 42 }, cd), { count: 1235, left: 42 });
  assert.deepStrictEqual(nag(NOW + 30001, { count: 1234, left: 42 }, cd), { count: 1234, left: 42 });
});
t("the bars poll gives the cooldown with the count it was read at", () => {
  assert.deepStrictEqual(cooldownFrom({ current: 1234, maximum: 2500, timeout: 0, cooldown: 30 }, NOW), { count: 1234, until: NOW + 30000 });
  assert.strictEqual(cooldownFrom({ current: 1234, maximum: 2500, timeout: 200, cooldown: 0 }, NOW), null);
  assert.strictEqual(cooldownFrom(undefined, NOW), null);
});
t("the tick draws the chain bar before the full-bar banner, which gives way to it", () => {
  assert.ok(src.includes("try { renderChainNag(); } catch (_) {}\n          try { renderNag(); } catch (_) {}"), "the tick does not draw the chain bar first");
  assert.ok(grab("renderNag").includes("if (document.getElementById(CHAIN_NAG_ID)) live = null;"), "the banner does not give way");
  assert.ok(grab("applyUserPayload").includes("state.chainCd = chainCooldownFrom(data.chain, Date.now());"), "the bars poll does not keep the cooldown");
});
t("it is only up while the page has focus, except in Torn PDA", () => {
  assert.ok(grab("renderChainNag").includes('var looking = isPda() || (typeof document.hasFocus === "function" && document.hasFocus());'), "no focus gate");
});
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail?1:0);
```

- [ ] **Step 2: The browser tests.** Write `tests/gym-coach/chainbar.e2e.test.mjs`:

```js
// The chain bar in a browser, on a Torn page that is not the gym: up and
// flashing while the sidebar's chain has under a minute left, down otherwise,
// and down without focus outside Torn PDA. Numbers are made up.
import fs from "fs";
import assert from "assert";
const { chromium } = await import("/root/.hermes/hermes-agent/node_modules/playwright-core/index.mjs");
const script = fs.readFileSync("harness/gym-coach-beta.user.js", "utf8");
const b = await chromium.launch({ args: ["--no-sandbox"] });

// Torn's sidebar chain bar, the way the script looks it up.
const page = (time, count) => `<!doctype html><html><head><meta charset="utf-8"><title>index.php</title></head><body>
<div id="sidebarroot"><a id="barChain" class="bar___x chain___x"><div class="bar-stats___x"><p class="bar-name___x">Chain:</p><p class="bar-value___x">${count}</p></div><p class="bar-timeleft___x">${time}</p></a></div>
<script src="/gym-coach-beta.user.js"></script></body></html>`;

async function open({ time = "00:42", count = "1,234/2,500", cfg = { noPda: true } } = {}) {
  const ctx = await b.newContext({ viewport: { width: 393, height: 800 } });
  const p = await ctx.newPage();
  await p.route("**/*", (r) => {
    const u = r.request().url();
    if (u.includes("gym-coach-beta.user.js")) return r.fulfill({ contentType: "application/javascript", body: script });
    if (/index\.php/.test(u)) return r.fulfill({ contentType: "text/html", body: page(time, count) });
    return r.fulfill({ status: 204, body: "" });
  });
  await p.goto("https://www.torn.com/index.php?cfg=" + encodeURIComponent(JSON.stringify(cfg)), { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(2600);
  return { ctx, p };
}
const bar = (p) => p.evaluate(() => {
  const e = document.getElementById("gcb-chain-nag");
  return e ? { text: e.textContent, anim: getComputedStyle(e).animationName } : null;
});
const setClock = (p, s) => p.evaluate((s) => { document.querySelector('[class*="bar-timeleft"]').textContent = s; }, s);
const noFocus = (p) => p.evaluate(() => { document.hasFocus = () => false; });

let pass = 0, fail = 0;
const t = async (n, f) => { try { await f(); pass++; console.log("ok   " + n); } catch (e) { fail++; console.log("FAIL " + n + " :: " + e.message); } };

await t("under a minute left: the bar is up and flashing, with the count and the clock", async () => {
  const { ctx, p } = await open();
  const got = await bar(p);
  await ctx.close();
  assert.ok(got, "no bar");
  assert.strictEqual(got.text, "CHAIN DYING · 1,234 hits · 0:42 left");
  assert.strictEqual(got.anim, "gcb-chain-flash");
});

await t("it follows the sidebar: down when a hit puts the clock back, up again under a minute", async () => {
  const { ctx, p } = await open();
  await setClock(p, "04:59");
  await p.waitForTimeout(1500);
  const after = await bar(p);
  await setClock(p, "00:30");
  await p.waitForTimeout(1500);
  const again = await bar(p);
  await ctx.close();
  assert.strictEqual(after, null, "still up at 4:59");
  assert.ok(again && again.text.endsWith("0:30 left"), JSON.stringify(again));
});

await t("outside Torn PDA it is down while the page does not have focus", async () => {
  const { ctx, p } = await open();
  await noFocus(p);
  await p.waitForTimeout(1500);
  const got = await bar(p);
  await ctx.close();
  assert.strictEqual(got, null);
});

await t("in Torn PDA it stays up without focus", async () => {
  const { ctx, p } = await open({ cfg: {} });
  await noFocus(p);
  await p.waitForTimeout(1500);
  const got = await bar(p);
  await ctx.close();
  assert.ok(got, "PDA lost the bar");
});

await t("a chain in its cooldown keeps it down", async () => {
  const { ctx, p } = await open({ cfg: { noPda: true, chain: { current: 1234, maximum: 2500, timeout: 0, modifier: 1, cooldown: 40 } } });
  const got = await bar(p);
  await ctx.close();
  assert.strictEqual(got, null);
});

await t("a chain under 10 hits keeps it down", async () => {
  const { ctx, p } = await open({ count: "9/10" });
  const got = await bar(p);
  await ctx.close();
  assert.strictEqual(got, null);
});

await b.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
```

- [ ] **Step 3: The harness's bars payload.** In `tests/gym-coach/harness/preamble.js`, replace:

```js
      cooldowns: { drug: N(cfg.drug, 0), booster: N(cfg.booster, 0), medical: 0 },
```

With:

```js
      cooldowns: { drug: N(cfg.drug, 0), booster: N(cfg.booster, 0), medical: 0 },
      // The bars selection's chain. cfg.chain stands in for a chain in its
      // cooldown, which the chain bar must stay down for.
      chain: N(cfg.chain, { current: 0, maximum: 10, timeout: 0, modifier: 1, cooldown: 0 }),
```

- [ ] **Step 4: Run both, and watch them fail on 0.12.18:**

```bash
W=/opt/warboard/.superpowers/sdd/2026-10-27-gym-coach-chain-bar; cd "$W/wt/tests/gym-coach" && ./build-harness.sh && node chainbar.test.mjs | tail -1; node chainbar.e2e.test.mjs | tail -1
```

Expected: `0 passed, 9 failed`, then `3 passed, 3 failed`. On 0.12.18 there is no chain bar: the three browser tests that need one fail, and the three that pin when it must stay down (no focus outside Torn PDA, a cooldown, under 10 hits) pass for that reason; they pin what must not change.

- [ ] **Step 5: The script.** Six edits to `tests/gym-coach/gym-coach-beta.user.js`.

Replace `// @version      0.12.18` with `// @version      0.12.19`, and `  var GC_VERSION = "0.12.18";` with `  var GC_VERSION = "0.12.19";`.

Replace:

```js
    fullAckAt: 0,
```

With:

```js
    fullAckAt: 0,
    // The last bars poll's chain cooldown, { count, until }, or null: the
    // chain bar stays down for a chain in its cooldown. See chainNag.
    chainCd: null,
```

Replace:

```js
    state.boosterCd = Number(cd.booster) || 0;
```

With:

```js
    state.boosterCd = Number(cd.booster) || 0;
    state.chainCd = chainCooldownFrom(data.chain, Date.now());
```

Replace:

```js
  var NAG_ID = "gcb-fullbar-nag";
```

With:

```js
  // --- a chain about to break ----------------------------------------------
  // The full-bar banner's idea, for the faction's chain: a red bar on every
  // Torn page, flashing, while the chain has under a minute left, so whoever
  // is on Torn goes and hits someone. Asked for 2026-10-27, the day after a
  // chain died with no one watching it.
  //
  // It reads Torn's own sidebar, on the coach's once-a-second tick, as the
  // energy bar does: the API's bars are cached for about 30s, half the window
  // this is about. Torn's rules forbid drawing attention with anything read
  // off a page you are not looking at, so the bar is only up while the page
  // has focus. No sound and no notification: warboard's push alerts are what
  // reach a phone in a pocket.
  var CHAIN_NAG_ID = "gcb-chain-nag";
  var CHAIN_STYLE_ID = "gcb-chain-style";
  // Under 10 hits nothing is at stake yet, and every lone attack starts a
  // 1-hit chain, so a bar for those would flash after most fights.
  var CHAIN_NAG_MIN_HITS = 10;
  // "under 1:00 left"
  var CHAIN_NAG_SECS = 60;

  // The sidebar's chain bar: "1,234/2,500" beside "00:42", or "1:02:03" for
  // an hour or more. The selectors are the ones FactionOps reads it with.
  // null when the page has no chain bar, or the bar shows no clock.
  function readChainFromDom() {
    var bar = document.getElementById("barChain") || document.querySelector('[id^="barChain"]');
    if (!bar) return null;
    var stats = bar.querySelector('[class*="bar-stats"]');
    var time = bar.querySelector('[class*="bar-timeleft"]');
    if (!stats || !time) return null;
    var n = String(stats.textContent || "").match(/(\d[\d,]*)\s*\//);
    var c = String(time.textContent || "").match(/(?:(\d+):)?(\d{1,2}):(\d{2})/);
    if (!n || !c) return null;
    return {
      count: Number(n[1].replace(/,/g, "")),
      left: (Number(c[1]) || 0) * 3600 + Number(c[2]) * 60 + Number(c[3]),
    };
  }

  // A chain that has ended keeps its count through its cooldown (about six
  // seconds a hit), and the sidebar's clock may count that cooldown down.
  // The bars poll says so: `cooldown` is the seconds left. Kept with the count
  // it was read at, because a chain cannot grow in its cooldown -- a higher
  // count is a live chain, whatever the last poll said.
  function chainCooldownFrom(chain, now) {
    var cd = Number(chain && chain.cooldown) || 0;
    if (!(cd > 0)) return null;
    return { count: Number(chain.current) || 0, until: now + cd * 1000 };
  }

  // Should the chain bar be up? Pure. `reading` is readChainFromDom()'s and
  // `cd` chainCooldownFrom()'s. Returns { count, left } or null.
  //
  // A clock that reads 0 is NOT taken as the chain's end: one stray 0 would
  // then hide the bar for a chain that is still dying, which is the one thing
  // this must never do.
  function chainNag(now, reading, cd) {
    if (!reading || reading.count < CHAIN_NAG_MIN_HITS) return null;
    if (!(reading.left > 0 && reading.left < CHAIN_NAG_SECS)) return null;
    if (cd && now < cd.until && reading.count <= cd.count) return null;
    return { count: reading.count, left: reading.left };
  }

  function renderChainNag() {
    // Torn PDA reports no focus while plainly in front of you, so it is exempt.
    var looking = isPda() || (typeof document.hasFocus === "function" && document.hasFocus());
    var live = looking ? chainNag(Date.now(), readChainFromDom(), state.chainCd) : null;
    var el = document.getElementById(CHAIN_NAG_ID);
    if (!live) {
      if (el && el.parentNode) el.parentNode.removeChild(el);
      return;
    }
    if (!document.body) return;
    if (!document.getElementById(CHAIN_STYLE_ID)) {
      // A hard red/white blink once a second, and steady red for anyone whose
      // system asks for less motion. An animation outranks the inline colours.
      var css = document.createElement("style");
      css.id = CHAIN_STYLE_ID;
      css.textContent =
        "@keyframes gcb-chain-flash{0%,49%{background:#d50000;color:#fff}50%,100%{background:#fff;color:#d50000}}" +
        "#" + CHAIN_NAG_ID + "{animation:gcb-chain-flash 1s infinite}" +
        "@media (prefers-reduced-motion:reduce){#" + CHAIN_NAG_ID + "{animation:none}}";
      (document.head || document.documentElement).appendChild(css);
    }
    if (!el) {
      el = document.createElement("div");
      el.id = CHAIN_NAG_ID;
      el.setAttribute("role", "alert");
      // The full-bar banner's spot, which it gives up while this is up, and
      // below FactionOps' own bar where FactionOps has one. Clicks pass
      // through: it is there to be seen, never to sit on a button you need.
      var fo = document.getElementById("fo-call-toast-container") ||
               document.querySelector('[id^="fo-chain"]');
      el.style.cssText =
        "position:fixed;top:" + (fo ? "96px" : "10px") + ";left:50%;" +
        "transform:translateX(-50%);z-index:2147483647;pointer-events:none;" +
        "background:#d50000;color:#fff;font:800 14px/1.2 Arial,sans-serif;" +
        "padding:9px 16px;border-radius:7px;white-space:nowrap;" +
        "box-shadow:0 3px 14px rgba(0,0,0,.5);max-width:94vw;";
      document.body.appendChild(el);
    }
    el.textContent = "CHAIN DYING · " + fmt(live.count) + " hits · 0:" +
      ("0" + live.left).slice(-2) + " left";
  }

  var NAG_ID = "gcb-fullbar-nag";
```

Replace:

```js
    var live = fullBarNag(Date.now(), st ? st.sec : null, state.fullAckAt,
                          state.warStack, state.energy, state.energyMax);
```

With:

```js
    var live = fullBarNag(Date.now(), st ? st.sec : null, state.fullAckAt,
                          state.warStack, state.energy, state.energyMax);
    // The chain bar has this spot while it is up: a chain about to break
    // comes first, and two banners in one place read as one broken one.
    if (document.getElementById(CHAIN_NAG_ID)) live = null;
```

Replace:

```js
          trackFullBar();
          try { renderNag(); } catch (_) {}
```

With:

```js
          trackFullBar();
          try { renderChainNag(); } catch (_) {}
          try { renderNag(); } catch (_) {}
```

- [ ] **Step 6: Check it, then run both again:**

```bash
W=/opt/warboard/.superpowers/sdd/2026-10-27-gym-coach-chain-bar; cd "$W/wt/tests/gym-coach" && node --check gym-coach-beta.user.js && command grep -c -P '[\x{2018}\x{2019}\x{201C}\x{201D}]' gym-coach-beta.user.js; command grep -m1 '@version' gym-coach-beta.user.js; command grep -m1 'var GC_VERSION' gym-coach-beta.user.js; ./build-harness.sh && node chainbar.test.mjs | tail -1; node chainbar.e2e.test.mjs | tail -1
```

Expected: `0` curly quotes, `0.12.19` twice, then `9 passed, 0 failed` and `6 passed, 0 failed`.

- [ ] **Step 7: The whole Gym Coach suite,** against the baseline's failing files:

```bash
uptime; W=/opt/warboard/.superpowers/sdd/2026-10-27-gym-coach-chain-bar; cd "$W/wt/tests/gym-coach" && : > "$W/gc-after.txt"; for f in *.test.mjs; do timeout 300 node "$f" > "$W/gc-out-$f.log" 2>&1 || echo "$f" >> "$W/gc-after.txt"; done; ls *.test.mjs | wc -l; diff "$W/gc-base.txt" "$W/gc-after.txt" && echo "same failing files as the baseline"
```

Expected: two files more than the baseline (the new ones), and `same failing files as the baseline`.

- [ ] **Step 8: Sweep what the branch adds:**

```bash
W=/opt/warboard/.superpowers/sdd/2026-10-27-gym-coach-chain-bar; cd "$W/wt" && git add -N -- tests/gym-coach/chainbar.test.mjs tests/gym-coach/chainbar.e2e.test.mjs && git diff | command grep -E '^\+' > "$W/added.txt"; command grep -oE '(^|[^A-Za-z0-9])[A-Za-z0-9]{16}([^A-Za-z0-9]|$)' "$W/added.txt" | sort | uniq -c; node "$W/sweep-env.mjs" "$W/added.txt" && node "$W/sweep-names.mjs" "$W/added.txt"
```

Expected: only code names among the 16-character words, both sweeps clean.

- [ ] **Step 9: Commit.**

```bash
W=/opt/warboard/.superpowers/sdd/2026-10-27-gym-coach-chain-bar; cd "$W/wt" && git add -- tests/gym-coach/chainbar.test.mjs tests/gym-coach/chainbar.e2e.test.mjs && git commit -q -m "Gym Coach Beta 0.12.19: a flashing red bar when the chain is about to break" -m "On every Torn page, while the faction's chain has 10 or more hits and under a minute left on Torn's own sidebar clock, a red and white flashing bar says CHAIN DYING with the count and the seconds left, like the full-energy banner, which gives way to it. It is up only while the page has focus (Torn PDA exempt), by Torn's rule for anything read off a page, and stays down for a chain in its cooldown, which the existing bars poll reports. No sound, no notification, no new API request." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- tests/gym-coach/gym-coach-beta.user.js tests/gym-coach/harness/preamble.js tests/gym-coach/chainbar.test.mjs tests/gym-coach/chainbar.e2e.test.mjs && git status --short && git log --format='%h %s' -2 | cat
```

Expected: nothing from `status`, then this commit and the plan's.

## Between Task 1 and Task 2: the final review

As superpowers:executing-plans says: the review package from the branch's merge base with main, one fresh Opus reviewer with this plan, its Review Focus and the ledger's `Ruling:` lines, then one fix pass for Critical and Important findings, test-first, with both new test files and the whole Gym Coach suite as in Step 7 after it.

---

### Task 2: Release

- [ ] **Step 1: Fast-forward main, then deploy.** `deploy.sh` checks the script, installs the served beta and its meta, and refuses a version that is already served. Then the stable copy and its meta, byte-identical:

```bash
cd /opt/warboard && git merge -q --ff-only gym-coach-chain-bar && git log --format='%h %s' -1 | cat && tests/gym-coach/deploy.sh && S=server/public/scripts && install -o warboard -g warboard -m 644 "$S/gym-coach-beta.user.js" "$S/gym-coach.user.js" && install -o warboard -g warboard -m 644 "$S/gym-coach-beta.meta.js" "$S/gym-coach.meta.js" && cmp "$S/gym-coach-beta.user.js" tests/gym-coach/gym-coach-beta.user.js && cmp "$S/gym-coach.user.js" "$S/gym-coach-beta.user.js" && cmp "$S/gym-coach.meta.js" "$S/gym-coach-beta.meta.js" && echo "served = working copy" && stat -c '%U:%G %a %n' "$S"/gym-coach*.js && cd server && node --test gym-coach-promotion.test.mjs 2>&1 | command grep -E "^# (tests|pass|fail) " | paste -sd" " -
```

Expected: the branch's commit as main's HEAD, `deployed 0.12.19 (meta.js regenerated)`, `served = working copy`, four `warboard:warboard 644`, and `# fail 0`.

- [ ] **Step 2: What the site serves:**

```bash
for f in gym-coach-beta.user.js gym-coach.user.js gym-coach-beta.meta.js; do printf '%s ' "$f"; curl -s "https://tornwar.com/scripts/$f" | command grep -m1 '@version'; done; curl -s https://tornwar.com/scripts/gym-coach-beta.user.js | sha256sum | cut -c1-16; sha256sum /opt/warboard/server/public/scripts/gym-coach-beta.user.js | cut -c1-16
```

Expected: `0.12.19` three times, and the two hashes the same.

- [ ] **Step 3: Commit the served files, sweep, push.**

```bash
W=/opt/warboard/.superpowers/sdd/2026-10-27-gym-coach-chain-bar; cd /opt/warboard && S=server/public/scripts && git commit -q -m "Gym Coach Beta 0.12.19: served" -m "The promoted beta and its meta, and the stable copy and its meta, byte-identical to them." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- "$S/gym-coach-beta.user.js" "$S/gym-coach-beta.meta.js" "$S/gym-coach.user.js" "$S/gym-coach.meta.js" && git log --format='%h %s' origin/main..main | cat && git diff origin/main..main | command grep -E '^\+' > "$W/added.txt"; command grep -oE '(^|[^A-Za-z0-9])[A-Za-z0-9]{16}([^A-Za-z0-9]|$)' "$W/added.txt" | sort | uniq -c; node "$W/sweep-env.mjs" "$W/added.txt" && node "$W/sweep-names.mjs" "$W/added.txt" && git push -q origin main 2>&1 | sed -E 's#//[^@]*@#//***@#g'; git log --format='%h' -1 origin/main
```

Expected: this plan's commits (and no other session's: if there is one, stop and ask the owner), only code names among the 16-character words, both sweeps clean, and origin/main's tip the same as main's.

- [ ] **Step 4: Clean up.** Copy the ledger and the logs into this session's scratchpad directory, then remove the worktree, the branch and the workspace:

```bash
W=/opt/warboard/.superpowers/sdd/2026-10-27-gym-coach-chain-bar; S="${SCRATCHPAD:?set SCRATCHPAD to the scratchpad directory}/gym-coach-chain-bar-release"; mkdir -p "$S" && cp "$W/progress.md" "$W"/gc-*.txt "$S/" && cd /opt/warboard && git worktree remove --force "$W/wt" && git branch -d gym-coach-chain-bar && rm -r /opt/warboard/.superpowers/sdd/2026-10-27-gym-coach-chain-bar && git worktree list | command grep -c gym-coach-chain-bar
```

(`--force` only because the built harness is an ignored file in the worktree; `git status` in Step 9 showed nothing else.) Expected: `0`.

- [ ] **Step 5: Memory.** A new `reference_gym_coach_chain_bar.md` (what it shows, when, the focus gate, the cooldown guard, 0.12.19, owed: the GF upload and the owner's check on a phone and a desktop), with its pointer added to an existing MEMORY.md line, not a new one.

- [ ] **Step 6: Report to the owner,** in a few short lines: what the bar does, the recommended answers taken (host, 10+, under 1:00, focus only), the GF upload owed, what to check, and the served URL.
