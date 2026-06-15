# Drink Stats — Energy + Nerve Inline — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Evolve the Can Energy userscript (1.0.0) into **Drink Stats** 1.1.0 — one script that shows perk-adjusted energy per can AND nerve per alcohol inline on the Torn items page.

**Architecture:** Refactor the single file into data-driven "providers" (energy + nerve), each a `{base, value(), cls}` descriptor. The pure math (perk parsers, formatters, base maps) becomes node-testable via a `vm`-loaded harness; the DOM machinery (RW Pricer coexistence, idempotent render, perk cache, ⚙ cog) is written once and shared across both providers.

**Tech Stack:** Tampermonkey-class userscript (GM_*), served from warboard's `server/public/scripts/` (static-mounted → live on save). Node `vm`+`assert` for pure-logic tests.

**Spec:** `docs/superpowers/specs/2026-06-15-drink-stats-energy-nerve-design.md`

**Conventions (from project memory):** no code comments in source (keep `==UserScript==`); no changelog/`@copyright`; `@namespace`/`@author` = RussianRob; keep `@version` and in-file `SCRIPT_VERSION` in sync; commit + push at each task (standing auth); `server/public/scripts/` edits are served live (no separate deploy).

**Files:**
- Modify: `/opt/warboard/server/public/scripts/torn-can-energy.user.js` (Can Energy 1.0.0 → Drink Stats 1.1.0)
- Create: `/opt/warboard/test/drink-stats.test.mjs` (node pure-logic tests; **outside** `server/public/` so it is NOT served)

**Test runner:** `node /opt/warboard/test/drink-stats.test.mjs` (self-contained; no framework). The harness loads the userscript with `vm.runInNewContext` into a sandbox lacking `document`, so the browser bootstrap is skipped and the IIFE's guarded `module.exports` hands back the pure functions.

---

### Task 1: Node-testable harness + pin existing energy behavior

Makes the script loadable in node and exports its pure functions, then locks down the current energy math as a regression net before refactoring.

**Files:**
- Modify: `/opt/warboard/server/public/scripts/torn-can-energy.user.js` (the bootstrap tail, ~lines 295-301)
- Create: `/opt/warboard/test/drink-stats.test.mjs`

- [ ] **Step 1: Write the test harness + energy regression checks**

Create `/opt/warboard/test/drink-stats.test.mjs`:

```js
import { readFileSync, existsSync } from "node:fs";
import vm from "node:vm";
import assert from "node:assert/strict";

const SCRIPT = "/opt/warboard/server/public/scripts/torn-can-energy.user.js";
const ITEMS = "/root/projects/warboard-ios/WarboardIOS/Resources/retorn/files/items.json";

function load() {
  const src = readFileSync(SCRIPT, "utf8");
  const sandbox = { module: { exports: {} }, console };
  vm.runInNewContext(src, sandbox, { filename: "drink-stats.user.js" });
  return sandbox.module.exports;
}

const ds = load();
let pass = 0, fail = 0;
function check(name, fn) {
  try { fn(); pass++; console.log("PASS " + name); }
  catch (e) { fail++; console.log("FAIL " + name + " — " + e.message); }
}

check("energy 15->25", () => assert.equal(ds.effectiveEnergy(15, 1.65, false), 25));
check("energy 20->33", () => assert.equal(ds.effectiveEnergy(20, 1.65, false), 33));
check("energy 25->41", () => assert.equal(ds.effectiveEnergy(25, 1.65, false), 41));
check("energy 30->50", () => assert.equal(ds.effectiveEnergy(30, 1.65, false), 50));
check("energy event 25->82", () => assert.equal(ds.effectiveEnergy(25, 1.65, true), 82));
check("perkMult energy 1.65", () => assert.ok(Math.abs(ds.perkMultiplier({ faction_perks: ["+ 50% energy from energy drinks"], job_perks: ["+ 10% consumable gain"], book_perks: [] }) - 1.65) < 1e-9));
check("CAN_BASE 987=15", () => assert.equal(ds.CAN_BASE[987], 15));

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
```

- [ ] **Step 2: Run it to watch it fail**

Run: `node /opt/warboard/test/drink-stats.test.mjs`
Expected: FAIL — the script's unguarded `boot()` runs in node and throws `ReferenceError: GM_getValue is not defined` (load crashes), or once that's fixed `ds.effectiveEnergy` is undefined. Either way: non-zero exit, no clean PASS lines.

- [ ] **Step 3: Guard the browser bootstrap + add the export hook**

In `torn-can-energy.user.js`, replace the bootstrap tail:

```js
    try { GM_addStyle(".ce-energy{color:#19b34a;font-weight:600;} .ce-cog{cursor:pointer;margin-left:6px;opacity:.7;} .ce-cog:hover{opacity:1;} #ce-keypanel{margin-left:6px;display:inline-flex;gap:4px;align-items:center;} #ce-keypanel input{width:150px;padding:2px 6px;font-size:.85em;border:1px solid #2a3447;border-radius:6px;background:#1c2030;color:#e6e8ee;} #ce-keypanel button{padding:2px 8px;font-size:.85em;border:1px solid #19b34a;border-radius:6px;background:#19b34a;color:#fff;cursor:pointer;}"); } catch (e) {}
    try { GM_registerMenuCommand("Can Energy: refresh perks", fetchMult); } catch (e) {}
    try { new MutationObserver(scheduleRender).observe(document.body, { childList: true, subtree: true }); } catch (e) {}
    boot();
})();
```

with:

```js
    if (typeof document !== "undefined") {
        try { GM_addStyle(".ce-energy{color:#19b34a;font-weight:600;} .ce-cog{cursor:pointer;margin-left:6px;opacity:.7;} .ce-cog:hover{opacity:1;} #ce-keypanel{margin-left:6px;display:inline-flex;gap:4px;align-items:center;} #ce-keypanel input{width:150px;padding:2px 6px;font-size:.85em;border:1px solid #2a3447;border-radius:6px;background:#1c2030;color:#e6e8ee;} #ce-keypanel button{padding:2px 8px;font-size:.85em;border:1px solid #19b34a;border-radius:6px;background:#19b34a;color:#fff;cursor:pointer;}"); } catch (e) {}
        try { GM_registerMenuCommand("Can Energy: refresh perks", fetchMult); } catch (e) {}
        try { new MutationObserver(scheduleRender).observe(document.body, { childList: true, subtree: true }); } catch (e) {}
        boot();
    }
    if (typeof module !== "undefined" && typeof module.exports !== "undefined") {
        module.exports = { perkMultiplier, effectiveEnergy, CAN_BASE };
    }
})();
```

- [ ] **Step 4: Run it to watch it pass**

Run: `node /opt/warboard/test/drink-stats.test.mjs`
Expected: `7 passed, 0 failed`, exit 0.

- [ ] **Step 5: Verify the browser script still parses**

Run: `node --check /opt/warboard/server/public/scripts/torn-can-energy.user.js && echo OK`
Expected: OK.

- [ ] **Step 6: Commit**

```bash
cd /opt/warboard
git add server/public/scripts/torn-can-energy.user.js test/drink-stats.test.mjs
git commit -m "Drink Stats: node-testable harness + pin energy behavior"
git push origin HEAD
```

---

### Task 2: NERVE_BASE map (+ items.json cross-check)

**Files:**
- Modify: `torn-can-energy.user.js` (after `CAN_BASE`, ~line 32; and the export line)
- Modify: `test/drink-stats.test.mjs`

- [ ] **Step 1: Write the failing tests**

In `drink-stats.test.mjs`, insert before the `console.log("\n" + pass ...)` summary line:

```js
const EXPECT_NERVE = { 180: 1, 181: 1, 294: 1, 426: 1, 531: 2, 541: 4, 542: 3, 550: 2, 551: 3, 552: 4, 638: 3, 816: 2, 873: 5, 924: 5, 984: 5 };
check("NERVE_BASE matches expected", () => assert.deepEqual(ds.NERVE_BASE, EXPECT_NERVE));
check("NERVE_BASE matches items.json", () => {
  if (!existsSync(ITEMS)) { console.log("  (skipped — items.json absent)"); return; }
  const items = JSON.parse(readFileSync(ITEMS, "utf8")).items;
  const derived = {};
  for (const [id, it] of Object.entries(items)) {
    if (it && it.type === "Alcohol" && typeof it.effect === "string") {
      const m = it.effect.match(/nerve by (\d+)/i);
      if (m) derived[id] = Number(m[1]);
    }
  }
  const normalized = {}; for (const k of Object.keys(ds.NERVE_BASE)) normalized[k] = ds.NERVE_BASE[k];
  assert.deepEqual(normalized, derived);
});
```

- [ ] **Step 2: Run to watch it fail**

Run: `node /opt/warboard/test/drink-stats.test.mjs`
Expected: FAIL — `ds.NERVE_BASE` is undefined (`Cannot convert undefined or null to object` / deepEqual mismatch).

- [ ] **Step 3: Add the NERVE_BASE map**

In `torn-can-energy.user.js`, immediately after the `CAN_BASE` line:

```js
    const CAN_BASE = { 985: 5, 986: 10, 987: 15, 530: 20, 553: 20, 532: 25, 554: 25, 533: 30, 555: 30 };
    const NERVE_BASE = { 180: 1, 181: 1, 294: 1, 426: 1, 531: 2, 541: 4, 542: 3, 550: 2, 551: 3, 552: 4, 638: 3, 816: 2, 873: 5, 924: 5, 984: 5 };
```

Update the export line:

```js
        module.exports = { perkMultiplier, effectiveEnergy, CAN_BASE, NERVE_BASE };
```

- [ ] **Step 4: Run to watch it pass**

Run: `node /opt/warboard/test/drink-stats.test.mjs`
Expected: `9 passed, 0 failed`.

- [ ] **Step 5: Commit**

```bash
cd /opt/warboard
git add -A && git commit -m "Drink Stats: alcohol nerve base map (validated vs items.json)" && git push origin HEAD
```

---

### Task 3: Alcohol perk parser `alcoholPerks`

**Files:**
- Modify: `torn-can-energy.user.js` (near `perkMultiplier`, ~line 38; and export)
- Modify: `test/drink-stats.test.mjs`

- [ ] **Step 1: Write the failing tests**

Insert before the summary line in `drink-stats.test.mjs`:

```js
check("alcoholPerks faction only", () => assert.deepEqual(ds.alcoholPerks({ faction_perks: ["+ 10% nerve from alcohol"], job_perks: [], book_perks: [] }), { faction: 10, company: 0 }));
check("alcoholPerks company alcohol boost", () => assert.deepEqual(ds.alcoholPerks({ faction_perks: [], job_perks: ["+ 10% alcohol boost"], book_perks: [] }), { faction: 0, company: 10 }));
check("alcoholPerks company consumable boost", () => assert.deepEqual(ds.alcoholPerks({ faction_perks: [], job_perks: ["+ 5% consumable boost"], book_perks: [] }), { faction: 0, company: 5 }));
check("alcoholPerks both, ignore book+unrelated", () => assert.deepEqual(ds.alcoholPerks({ faction_perks: ["+ 15% nerve from alcohol", "+ 50% energy from energy drinks"], job_perks: ["+ 10% alcohol boost"], book_perks: ["+ 100% alcohol effects"] }), { faction: 15, company: 10 }));
check("alcoholPerks none", () => assert.deepEqual(ds.alcoholPerks({ faction_perks: [], job_perks: [], book_perks: [] }), { faction: 0, company: 0 }));
```

- [ ] **Step 2: Run to watch it fail**

Run: `node /opt/warboard/test/drink-stats.test.mjs`
Expected: FAIL — `ds.alcoholPerks is not a function`.

- [ ] **Step 3: Implement `digitsPct` + `alcoholPerks`**

In `torn-can-energy.user.js`, immediately above `function perkMultiplier(perks) {`:

```js
    function digitsPct(s) {
        const n = parseInt(String(s).replace(/\D+/g, ""), 10);
        return Number.isNaN(n) ? 0 : n;
    }

    function alcoholPerks(perks) {
        const faction = (perks.faction_perks || []).find((s) => /alcohol/i.test(s));
        const company = (perks.job_perks || []).find((s) => /alcohol boost|consumable boost/i.test(s));
        return { faction: faction ? digitsPct(faction) : 0, company: company ? digitsPct(company) : 0 };
    }
```

Update the export line:

```js
        module.exports = { perkMultiplier, effectiveEnergy, alcoholPerks, CAN_BASE, NERVE_BASE };
```

- [ ] **Step 4: Run to watch it pass**

Run: `node /opt/warboard/test/drink-stats.test.mjs`
Expected: `14 passed, 0 failed`.

- [ ] **Step 5: Commit**

```bash
cd /opt/warboard
git add -A && git commit -m "Drink Stats: alcohol perk parser (faction /alcohol/, company alcohol|consumable boost)" && git push origin HEAD
```

---

### Task 4: Nerve range formatter `nerveRange`

**Files:**
- Modify: `torn-can-energy.user.js` (near `effectiveEnergy`, ~line 51; and export)
- Modify: `test/drink-stats.test.mjs`

- [ ] **Step 1: Write the failing tests**

Insert before the summary line:

```js
check("nerve 5,0,0 -> 5 N", () => assert.equal(ds.nerveRange(5, 0, 0, 1), "5 N"));
check("nerve 5,10,10 -> 6 - 7 N", () => assert.equal(ds.nerveRange(5, 10, 10, 1), "6 - 7 N"));
check("nerve 1,25,0 -> 1 - 2 N", () => assert.equal(ds.nerveRange(1, 25, 0, 1), "1 - 2 N"));
check("nerve 4,0,50 -> 6 N", () => assert.equal(ds.nerveRange(4, 0, 50, 1), "6 N"));
check("nerve default eventMult", () => assert.equal(ds.nerveRange(5, 0, 0), "5 N"));
```

- [ ] **Step 2: Run to watch it fail**

Run: `node /opt/warboard/test/drink-stats.test.mjs`
Expected: FAIL — `ds.nerveRange is not a function`.

- [ ] **Step 3: Implement `nerveRange`**

In `torn-can-energy.user.js`, immediately below `function effectiveEnergy(...) { ... }`:

```js
    function nerveRange(base, faction, company, eventMult) {
        const total = base * (1 + faction / 100) * (1 + company / 100) * (eventMult || 1);
        const min = Math.floor(total), max = Math.ceil(total);
        return min === max ? min + " N" : min + " - " + max + " N";
    }
```

Update the export line:

```js
        module.exports = { perkMultiplier, effectiveEnergy, alcoholPerks, nerveRange, CAN_BASE, NERVE_BASE };
```

- [ ] **Step 4: Run to watch it pass**

Run: `node /opt/warboard/test/drink-stats.test.mjs`
Expected: `19 passed, 0 failed`.

- [ ] **Step 5: Commit**

```bash
cd /opt/warboard
git add -A && git commit -m "Drink Stats: nerve range formatter (floor-ceil, matches TornTools)" && git push origin HEAD
```

---

### Task 5: Shared perk cache (`computePerks`, rename to `cachedPerks`/`fetchPerks`)

Compute energy + alcohol perks from one perks payload; widen the cache shape; migrate the old `{multiplier}` cache by treating it as stale. Render stays energy-only here (the data-driven swap is Task 6).

**Files:**
- Modify: `torn-can-energy.user.js` (cache + fetch + render/boot references, ~lines 113-148, 273-277, 298; and export)
- Modify: `test/drink-stats.test.mjs`

- [ ] **Step 1: Write the failing test**

Insert before the summary line:

```js
check("computePerks energy+alc", () => {
  const c = ds.computePerks({ faction_perks: ["+ 50% energy from energy drinks", "+ 10% nerve from alcohol"], job_perks: ["+ 10% consumable gain", "+ 5% alcohol boost"], book_perks: [] });
  assert.ok(Math.abs(c.energyMult - 1.65) < 1e-9);
  assert.equal(c.alcFaction, 10);
  assert.equal(c.alcCompany, 5);
});
```

- [ ] **Step 2: Run to watch it fail**

Run: `node /opt/warboard/test/drink-stats.test.mjs`
Expected: FAIL — `ds.computePerks is not a function`.

- [ ] **Step 3: Add `computePerks`, rename cache/fetch, migrate shape**

In `torn-can-energy.user.js`:

(a) Add `computePerks` immediately below `alcoholPerks`:

```js
    function computePerks(payload) {
        const alc = alcoholPerks(payload);
        return { energyMult: perkMultiplier(payload), alcFaction: alc.faction, alcCompany: alc.company };
    }
```

(b) Replace `cachedMult` with `cachedPerks` (validates the new shape; old `{multiplier}` cache → null → refetch):

```js
    function cachedPerks() {
        try {
            const m = JSON.parse(GM_getValue(MULT_STORE, ""));
            if (m && typeof m.energyMult === "number" && typeof m.alcFaction === "number" && typeof m.alcCompany === "number") return m;
            return null;
        } catch (e) {
            return null;
        }
    }
```

(c) Replace `fetchMult` with `fetchPerks`:

```js
    function fetchPerks() {
        const key = getKey();
        if (!key) return;
        GM_xmlhttpRequest({
            method: "GET",
            url: "https://api.torn.com/user/?selections=perks&key=" + encodeURIComponent(key),
            onload: (r) => {
                try {
                    const d = JSON.parse(r.responseText);
                    if (d.error) { lastError = d.error.error; return; }
                    GM_setValue(MULT_STORE, JSON.stringify(Object.assign(computePerks(d), { fetchedAt: Date.now() })));
                    lastError = null;
                    render();
                } catch (e) {
                    lastError = String(e);
                }
            },
            onerror: () => { lastError = "network error"; },
        });
    }
```

(d) Update `render()`'s first two lines from the cached-mult form to:

```js
    function render() {
        const perks = cachedPerks();
        const mult = perks ? perks.energyMult : 1;
```

(e) Update the remaining references from `fetchMult`→`fetchPerks` and `cachedMult`→`cachedPerks`:
- In `toggleKeyPanel`'s Save handler: `if (k) fetchPerks(); else render();`
- In `boot()`: `const c = cachedPerks();` and `... ) fetchPerks();`
- In the bootstrap: `GM_registerMenuCommand("Can Energy: refresh perks", fetchPerks);`

(f) Update the export line:

```js
        module.exports = { perkMultiplier, effectiveEnergy, alcoholPerks, nerveRange, computePerks, CAN_BASE, NERVE_BASE };
```

- [ ] **Step 4: Run to watch it pass**

Run: `node /opt/warboard/test/drink-stats.test.mjs`
Expected: `20 passed, 0 failed`.

- [ ] **Step 5: Verify no stale references remain + parses**

Run:
```bash
grep -nE "fetchMult|cachedMult" /opt/warboard/server/public/scripts/torn-can-energy.user.js || echo "CLEAN"
node --check /opt/warboard/server/public/scripts/torn-can-energy.user.js && echo OK
```
Expected: `CLEAN` then `OK`.

- [ ] **Step 6: Commit**

```bash
cd /opt/warboard
git add -A && git commit -m "Drink Stats: unified perk cache (energy mult + alcohol perks), migrate old shape" && git push origin HEAD
```

---

### Task 6: Data-driven providers + generalized render (nerve goes live)

Turn the energy-only renderer into a two-provider renderer; alcohol nerve now displays. Reuses the RW Pricer coexistence + idempotent-write logic verbatim, keyed on a shared `.ce-badge` class.

**Files:**
- Modify: `torn-can-energy.user.js` (`rowFullName` ~line 67, `findCanRows`→`findRows` ~line 92, `render` ~line 145, `PROVIDERS` new, style string, export)
- Modify: `test/drink-stats.test.mjs`

- [ ] **Step 1: Write the failing tests**

Insert before the summary line:

```js
check("energy provider value (perks)", () => assert.equal(ds.PROVIDERS.find(p => p.key === "energy").value(15, { energyMult: 1.65 }), "25E"));
check("energy provider value (base only)", () => assert.equal(ds.PROVIDERS.find(p => p.key === "energy").value(15, null), "15E"));
check("nerve provider value (perks)", () => assert.equal(ds.PROVIDERS.find(p => p.key === "nerve").value(5, { alcFaction: 10, alcCompany: 10 }), "6 - 7 N"));
check("nerve provider value (base only)", () => assert.equal(ds.PROVIDERS.find(p => p.key === "nerve").value(5, null), "5 N"));
check("providers cover both maps", () => { assert.equal(ds.PROVIDERS.length, 2); assert.equal(ds.PROVIDERS[0].base[987], 15); assert.equal(ds.PROVIDERS[1].base[180], 1); });
```

- [ ] **Step 2: Run to watch it fail**

Run: `node /opt/warboard/test/drink-stats.test.mjs`
Expected: FAIL — `Cannot read properties of undefined (reading 'find')` (`ds.PROVIDERS` undefined).

- [ ] **Step 3: Add PROVIDERS, generalize rowFullName/findRows/render**

(a) Add `PROVIDERS` immediately after the `NERVE_BASE` line (it references `effectiveEnergy`/`nerveRange`, which are function declarations and hoisted — fine):

```js
    const PROVIDERS = [
        { key: "energy", cls: "ce-energy", base: CAN_BASE, tip: "Effective energy (your perks)",
          value: (base, p) => effectiveEnergy(base, p ? p.energyMult : 1, false) + "E" },
        { key: "nerve", cls: "ce-nerve", base: NERVE_BASE, tip: "Effective nerve (your perks)",
          value: (base, p) => nerveRange(base, p ? p.alcFaction : 0, p ? p.alcCompany : 0, 1) },
    ];
```

(b) Generalize `rowFullName` to also match bottle/glass:

```js
    function rowFullName(row) {
        const al = row.querySelector("[aria-label]");
        if (al) {
            const v = al.getAttribute("aria-label") || "";
            if (/(can|bottle|glass) of /i.test(v)) return v;
        }
        const ds = row.getAttribute("data-sort") || "";
        const m = ds.match(/(can|bottle|glass) of .+$/i);
        return m ? m[0] : "";
    }
```

(c) Replace `findCanRows` with `findRows`:

```js
    function findRows() {
        const rows = document.querySelectorAll(
            "ul.items-cont > li, ul.items-list > li, li.show-item-info, [data-category='Energy Drink'], [data-category='Alcohol']"
        );
        const out = [];
        const seen = new Set();
        rows.forEach((row) => {
            if (seen.has(row)) return;
            seen.add(row);
            const id = parseInt(row.getAttribute("data-item"), 10);
            let provider = null, base = null;
            for (const p of PROVIDERS) {
                if (p.base[id] != null) { provider = p; base = p.base[id]; break; }
            }
            if (provider == null) {
                const b = canBase((nameElForRow(row) || row).textContent);
                if (b != null) { provider = PROVIDERS[0]; base = b; }
            }
            if (provider == null) return;
            const nameLeaf = findNameTextEl(row, rowFullName(row)) || nameElForRow(row) || row;
            const nameWrap = row.querySelector(".name-wrap");
            out.push({ row: row, nameLeaf: nameLeaf, nameWrap: nameWrap, provider: provider, base: base });
        });
        return out;
    }
```

(d) Replace `render`'s body to use providers + the shared `.ce-badge` placement:

```js
    function render() {
        const perks = cachedPerks();
        const hasKey = !!getKey();
        const rows = findRows();
        rows.forEach((entry) => {
            const row = entry.row;
            let span = row.querySelector(".ce-badge");
            if (!span) {
                span = document.createElement("span");
                span.className = "ce-badge " + entry.provider.cls;
            }
            const priced = !!row.querySelector(".rwp-base-price-tag");
            let ref;
            if (priced && entry.nameLeaf && entry.nameWrap &&
                entry.nameLeaf !== entry.nameWrap && entry.nameWrap.contains(entry.nameLeaf)) {
                ref = entry.nameLeaf;
            } else if (entry.nameWrap) {
                ref = entry.nameWrap;
            } else {
                ref = entry.nameLeaf || row;
            }
            if (ref === row) {
                if (span.parentElement !== ref) ref.appendChild(span);
            } else if (span.previousElementSibling !== ref) {
                ref.insertAdjacentElement("afterend", span);
            }
            const txt = " " + entry.provider.value(entry.base, perks) + (hasKey ? "" : "*");
            if (span.textContent !== txt) span.textContent = txt;
            const tip = hasKey ? entry.provider.tip
                : (lastError ? "API error: " + lastError : "Base value — tap the cog to add your API key for perk-adjusted values");
            if (span.title !== tip) span.title = tip;
        });
        injectHeaderCog();
    }
```

(e) In the bootstrap `GM_addStyle(...)` string, split the badge color rule so both providers are styled. Replace the leading `.ce-energy{color:#19b34a;font-weight:600;}` with:

```
.ce-badge{font-weight:600;} .ce-energy{color:#19b34a;} .ce-nerve{color:#e0556b;}
```

(so the full style string begins `".ce-badge{font-weight:600;} .ce-energy{color:#19b34a;} .ce-nerve{color:#e0556b;} .ce-cog{cursor:pointer; ...`).

(f) Update the export line:

```js
        module.exports = { perkMultiplier, effectiveEnergy, alcoholPerks, nerveRange, computePerks, PROVIDERS, CAN_BASE, NERVE_BASE };
```

- [ ] **Step 4: Run to watch it pass**

Run: `node /opt/warboard/test/drink-stats.test.mjs`
Expected: `25 passed, 0 failed`.

- [ ] **Step 5: Verify no stale `findCanRows` and parses**

Run:
```bash
grep -n "findCanRows" /opt/warboard/server/public/scripts/torn-can-energy.user.js || echo "CLEAN"
node --check /opt/warboard/server/public/scripts/torn-can-energy.user.js && echo OK
```
Expected: `CLEAN` then `OK`.

- [ ] **Step 6: Commit**

```bash
cd /opt/warboard
git add -A && git commit -m "Drink Stats: data-driven providers — alcohol nerve now displays inline alongside energy" && git push origin HEAD
```

---

### Task 7: Identity/metadata → Drink Stats 1.1.0 + final verify

**Files:**
- Modify: `torn-can-energy.user.js` (metadata block + `SCRIPT_VERSION` + cog/menu labels)

- [ ] **Step 1: Update the metadata block + SCRIPT_VERSION**

In `torn-can-energy.user.js`:
- `// @name         Can Energy` → `// @name         Drink Stats`
- `// @version      1.0.0` → `// @version      1.1.0`
- `// @description  ...` → `// @description  Shows energy per can and nerve per alcohol inline on the items page (perk-adjusted; forked from TornTools)`
- `const SCRIPT_VERSION = "1.0.0";` → `const SCRIPT_VERSION = "1.1.0";`

- [ ] **Step 2: Update the user-facing labels**

- Menu command: `GM_registerMenuCommand("Drink Stats: refresh perks", fetchPerks);`
- Cog title in `injectHeaderCog`: `cog.title = "Drink Stats — set your Torn API key for perk-adjusted energy & nerve";`

- [ ] **Step 3: Run the full test suite (pure logic unaffected by metadata)**

Run: `node /opt/warboard/test/drink-stats.test.mjs`
Expected: `25 passed, 0 failed`.

- [ ] **Step 4: Verify parse, version sync, and served**

Run:
```bash
F=/opt/warboard/server/public/scripts/torn-can-energy.user.js
node --check "$F" && echo PARSE_OK
grep -nE "@name|@version|SCRIPT_VERSION =|@description" "$F"
curl -s https://tornwar.com/scripts/torn-can-energy.user.js | grep -m1 -E "@name|@version"
```
Expected: PARSE_OK; `@name Drink Stats`, `@version 1.1.0` and `SCRIPT_VERSION = "1.1.0"` in source; served shows `@name Drink Stats` / `@version 1.1.0`.

- [ ] **Step 5: Commit**

```bash
cd /opt/warboard
git add -A && git commit -m "Drink Stats 1.1.0: rename from Can Energy, ship energy + alcohol nerve" && git push origin HEAD
```

- [ ] **Step 6: On-device verification (user)**

Ask the user to force-update from `https://tornwar.com/scripts/torn-can-energy.user.js` (confirm `@version` 1.1.0 installed) and open `item.php`. Confirm:
- Cans still show `{N}E` (green); alcohol now shows `{N} N` or `{min} - {max} N` (rose).
- RW Pricer prices still appear on both (no name-wrap pollution regression).
- No steady-state CPU spin (idempotent writes preserved).
- Tapping ⚙ → entering the key makes both energy and nerve perk-adjusted (match TornTools).

---

## Self-Review

**Spec coverage:**
- Energy unchanged (map, formula, green badge) → preserved through Task 1 net + Task 6 provider ✓
- Nerve map (15 items) → Task 2 (+ items.json assertion) ✓
- Nerve perk formula (faction `/alcohol/i`, company `/alcohol boost|consumable boost/i`, no book) → Task 3 ✓
- Nerve floor–ceil range display → Task 4 ✓
- Shared cached perks (one `?selections=perks`, `{energyMult,alcFaction,alcCompany,fetchedAt}`, migration) → Task 5 ✓
- Data-driven providers + shared RW-Pricer coexistence + idempotent render (`.ce-badge`) → Task 6 ✓
- Rose nerve color, distinct from green energy → Task 6 step 3e ✓
- Identity: `@name` Drink Stats, 1.1.0, same file/`ce_*` keys, `@connect api.torn.com`, no update/download URL → Task 7 (+ untouched metadata) ✓
- States (no-key `*`, error tooltip, unknown→nothing) → preserved in render (Task 6d) ✓
- Out of scope (events hard-1, no happy/other pages, no book buff) → not implemented; `eventMult` seam present in `nerveRange`/providers ✓

**Placeholder scan:** none — every code step shows complete code; every run step shows exact command + expected output. The items.json cross-check has a real skip-guard, not a TODO.

**Type consistency:** `cachedPerks`/`fetchPerks`/`computePerks`/`findRows`/`PROVIDERS`/`NERVE_BASE`/`digitsPct`/`alcoholPerks`/`nerveRange` used consistently after their defining tasks; the `{energyMult, alcFaction, alcCompany}` shape is identical in `computePerks` (T5), `cachedPerks` validation (T5), and provider `value()` (T6); badge class `ce-badge` used in both create (T6d) and query (T6d). Export line is extended (not contradicted) each task. Old names `fetchMult`/`cachedMult`/`findCanRows` are explicitly grep-checked for removal (T5 step 5, T6 step 5).
```
