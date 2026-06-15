# Can Energy Inline — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** A userscript that shows each energy can's effective energy (`{N}E`) inline on the Torn items page, matching TornTools.

**Architecture:** One file `/opt/warboard/server/public/scripts/torn-can-energy.user.js`. Pure energy math (base × perk multiplier, round-then-event-double) is factored into two functions verified in node; the rest is GM/DOM glue mirroring RW Pricer (item-id row targeting via `div.img-wrap[data-itemid]`, MutationObserver re-inject, inline ⚙ key cog).

**Tech Stack:** Tampermonkey-class userscript (GM_*), served from warboard.

---

### Task 1: Pure energy math (node-verifiable)

**Files:** Create `/opt/warboard/server/public/scripts/torn-can-energy.user.js` (start with the two pure functions + base map so they can be required/tested in node).

- [ ] **Step 1: Write the functions**

```js
// itemId -> base energy (first integer in the item's Torn effect string; stable)
const CAN_BASE = {
  985: 5, 986: 10, 987: 15, 530: 20, 553: 20, 532: 25, 554: 25, 533: 30, 555: 30,
};

// Product of every faction/job/book perk string matching "energy drinks" or
// "consumable gain": each contributes (1 + digits/100). Matches TornTools.
function perkMultiplier(perks) {
  const arrs = [perks.faction_perks, perks.job_perks, perks.book_perks];
  let mult = 1;
  for (const arr of arrs) {
    for (const s of arr || []) {
      if (!/energy drinks/i.test(s) && !/consumable gain/i.test(s)) continue;
      const n = parseInt(String(s).replace(/\D+/g, ""), 10);
      if (!Number.isNaN(n)) mult *= 1 + n / 100;
    }
  }
  return mult;
}

// round PER can, THEN event-double (×2 only during CaffeineCon)
function effectiveEnergy(base, mult, eventActive) {
  return Math.round(base * mult) * (eventActive ? 2 : 1);
}
```

- [ ] **Step 2: Node test — the 6 screenshot cases + ordering**

Run:
```bash
node -e '
const m=1.65;
const r=(b)=>Math.round(b*m);
const cases=[[15,25],[20,33],[25,41],[30,50]];
let ok=true;
for(const [b,exp] of cases){const g=r(b); if(g!==exp){ok=false;console.log("FAIL",b,g,exp);} else console.log("PASS",b,"->",g);}
// round-then-double ordering: round(25*1.65)=41, *2=82 (NOT round(25*1.65*2)=83)
const evt=Math.round(25*1.65)*2; console.log(evt===82?"PASS ordering 82":"FAIL ordering "+evt); ok=ok&&evt===82;
// perk parser
const perks={faction_perks:["+ 50% energy from energy drinks"],job_perks:["+ 10% consumable gain"],book_perks:[]};
const arrs=[perks.faction_perks,perks.job_perks,perks.book_perks];let mm=1;
for(const a of arrs)for(const s of a){if(!/energy drinks/i.test(s)&&!/consumable gain/i.test(s))continue;const n=parseInt(String(s).replace(/\\D+/g,""),10);if(!Number.isNaN(n))mm*=1+n/100;}
console.log(Math.abs(mm-1.65)<1e-9?"PASS perk 1.65":"FAIL perk "+mm); ok=ok&&Math.abs(mm-1.65)<1e-9;
process.exit(ok?0:1);
'
```
Expected: all PASS, exit 0 (1.50×1.10 = 1.65; round(25×1.65)=41; ordering 82).

- [ ] **Step 3: Commit** (after the full script in Task 2 — this task just establishes the verified math).

---

### Task 2: Assemble the full userscript

**Files:** Complete `/opt/warboard/server/public/scripts/torn-can-energy.user.js`.

- [ ] **Step 1: Metadata block** (house style: no @copyright, GPL, RussianRob, no `.meta.js` update URL)

```
// ==UserScript==
// @name         Can Energy
// @namespace    RussianRob
// @author       RussianRob
// @version      0.1.0
// @description  Shows each energy can's effective energy inline on the items page (perk-adjusted, matches TornTools)
// @license      GPL-3.0-or-later
// @match        https://www.torn.com/item.php*
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_addStyle
// @grant        GM_registerMenuCommand
// @connect      api.torn.com
// @downloadURL  https://tornwar.com/scripts/torn-can-energy.user.js
// @updateURL    https://tornwar.com/scripts/torn-can-energy.user.js
// ==/UserScript==
```

- [ ] **Step 2: Key + cached multiplier**

```js
const SCRIPT_VERSION = "0.1.0";
const KEY_STORE = "ce_apikey";
const MULT_STORE = "ce_mult";        // {multiplier, fetchedAt}
const MULT_TTL = 24 * 60 * 60 * 1000;

const getKey = () => (GM_getValue(KEY_STORE, "") || "").trim();
function cachedMult() {
  try { const m = JSON.parse(GM_getValue(MULT_STORE, "")); return m && typeof m.multiplier === "number" ? m : null; }
  catch (_) { return null; }
}
function fetchMult() {
  const key = getKey();
  if (!key) return;
  GM_xmlhttpRequest({
    method: "GET",
    url: "https://api.torn.com/user/?selections=perks&key=" + encodeURIComponent(key),
    onload: (r) => {
      try {
        const d = JSON.parse(r.responseText);
        if (d.error) { lastError = d.error.error; return; }
        const mult = perkMultiplier(d);
        GM_setValue(MULT_STORE, JSON.stringify({ multiplier: mult, fetchedAt: Date.now() }));
        lastError = null; render();
      } catch (e) { lastError = String(e); }
    },
    onerror: () => { lastError = "network"; },
  });
}
let lastError = null;
```

- [ ] **Step 3: Inject the energy value per can row**

```js
function render() {
  const cached = cachedMult();
  const mult = cached ? cached.multiplier : 1;        // no key/cache -> base (×1)
  const hasKey = !!getKey();
  document.querySelectorAll("div.img-wrap[data-itemid]").forEach((wrap) => {
    const id = parseInt(wrap.getAttribute("data-itemid"), 10);
    if (!(id in CAN_BASE)) return;
    const row = wrap.closest("li, .item, [class*='item']") || wrap.parentElement;
    if (!row) return;
    const name = row.querySelector("[class*='name'], .name-wrap, .title") || row;
    let span = row.querySelector(".ce-energy");
    if (!span) {
      span = document.createElement("span");
      span.className = "ce-energy";
      name.appendChild(span);
    }
    const e = effectiveEnergy(CAN_BASE[id], mult, false);  // event off in v1
    span.textContent = " " + e + "E" + (hasKey ? "" : "*");
    span.title = hasKey ? "Effective energy (your perks)" : "Base energy — tap ⚙ to add your API key for perk-adjusted values";
  });
  injectCog();
}
```

- [ ] **Step 4: Inline ⚙ key cog + styles** (mirror RW Pricer's no-key cog)

```js
GM_addStyle(".ce-energy{color:#19b34a;font-weight:600;} .ce-cog{cursor:pointer;margin-left:6px;opacity:.6;} .ce-cog:hover{opacity:1;}");
function injectCog() {
  if (getKey() || document.querySelector(".ce-cog")) return;
  const anchor = document.querySelector("div.img-wrap[data-itemid]");
  if (!anchor) return;
  const cog = document.createElement("span");
  cog.className = "ce-cog"; cog.textContent = "⚙";
  cog.title = "Set Torn API key for perk-adjusted energy";
  cog.addEventListener("click", () => {
    const k = prompt("Torn API key (for your energy-drink perks):", "");
    if (k && k.trim()) { GM_setValue(KEY_STORE, k.trim()); fetchMult(); }
  });
  (anchor.closest("li") || anchor.parentElement).appendChild(cog);
}
```

- [ ] **Step 5: Boot + observer + refresh**

```js
function boot() {
  const c = cachedMult();
  if (getKey() && (!c || Date.now() - c.fetchedAt > MULT_TTL)) fetchMult();
  render();
}
GM_registerMenuCommand("Can Energy: refresh perks", fetchMult);
GM_registerMenuCommand("Can Energy: set API key", () => {
  const k = prompt("Torn API key:", getKey()); if (k != null) { GM_setValue(KEY_STORE, k.trim()); fetchMult(); }
});
new MutationObserver(() => render()).observe(document.body, { childList: true, subtree: true });
boot();
```

- [ ] **Step 6: Verify it parses**

Run: `node --check /opt/warboard/server/public/scripts/torn-can-energy.user.js && echo OK`
Expected: OK.

---

### Task 3: Deploy + verify served

- [ ] **Step 1: Confirm version + no .meta.js**

Run: `grep -E "@version|SCRIPT_VERSION" /opt/warboard/server/public/scripts/torn-can-energy.user.js | head`
Expected: 0.1.0 in both.

- [ ] **Step 2: Commit + push** (standing auth for script changes)

```bash
cd /opt/warboard
git add server/public/scripts/torn-can-energy.user.js docs/superpowers/plans/2026-06-15-can-energy-inline.md
git commit -m "Can Energy 0.1.0: inline effective energy per can on the items page"
git push origin HEAD
```

- [ ] **Step 3: Verify served**

Run: `curl -s -o /dev/null -w "%{http_code}\n" https://tornwar.com/scripts/torn-can-energy.user.js`
Expected: 200.

- [ ] **Step 4: Give the user the install URL** — `https://tornwar.com/scripts/torn-can-energy.user.js` (Greasy Fork later if they want). On-device: open the items page → each can shows `{N}E`; tap ⚙ → paste key → values become perk-adjusted (match TornTools).

---

## Self-Review

**Spec coverage:** base map (T1) ✓; effective formula round-then-event (T1) ✓; perk multiplier from faction/job/book (T1) ✓; cached perks + TTL (T2.2) ✓; inline cog key flow (T2.4) ✓; no-key→base state (T2.3 `mult=1`, `*` marker) ✓; item-id row targeting + observer (T2.3/2.5) ✓; metadata/match/grants/connect/no-.meta.js (T2.1) ✓; event/education excluded (T2.3 `eventActive=false`, perkMultiplier omits education) ✓; deploy (T3) ✓.

**Placeholder scan:** none — full code in every step. The DOM selectors (`div.img-wrap[data-itemid]`, name selector) are RW-Pricer-derived and may need a one-line tweak after seeing the live items DOM; flagged, not a gap.

**Type consistency:** `CAN_BASE`, `perkMultiplier`, `effectiveEnergy`, `cachedMult`, `fetchMult`, `render`, `injectCog`, `getKey` consistent across tasks.
