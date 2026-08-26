import fs from "fs";
const { chromium } = await import("/root/.hermes/hermes-agent/node_modules/playwright-core/index.mjs");
const html = fs.readFileSync("harness/index.html","utf8");
const script = fs.readFileSync("harness/gym-coach-beta.user.js","utf8");
const b = await chromium.launch({ args:["--no-sandbox"] });
const page = await b.newPage({ viewport:{width:393,height:900} });
await page.route("**/*", r => { const u=r.request().url();
  if (u.includes("gym-coach-beta.user.js")) return r.fulfill({contentType:"application/javascript",body:script});
  if (/gym\.php/.test(u)) return r.fulfill({contentType:"text/html",body:html});
  return r.fulfill({status:204,body:""}); });

// A real navigation per case — a fragment-only change is same-document, so the
// script would run once and every later case would silently test nothing.
const CASES = [];
for (const energy of [0, 100, 140, 149, 150, 300])
  for (const fulltime of [0, 600, 2400, 5400])
    for (const drug of [0, 1800, 20220])
      for (const mode of ["xan", "jump"])
        CASES.push({ energy, fulltime, drug, mode,
                     booster: 60000, xan: 85, cans: 21, happy: 4300, stack: false });
CASES.push({ energy: 140, fulltime: 600, drug: 0, mode: "xan", booster: 0, xan: 0, cans: 0, happy: 4300, stack: true });

// A seeded history so the CALIBRATED branch of the scorecard renders too. The
// cases above all leave the ledger empty, which only ever exercises the
// "still learning" text.
const DAY = 86400000;
function seeded(gain, used, days = 20) {
  const today = Math.floor(Date.now() / DAY);
  const hist = [], ledger = [];
  let str = 614000000;
  hist.push({ d: today - days - 1, v: [str, 12000000, 9000000, 8000000] });
  for (let i = days; i >= 1; i--) {
    str += gain;
    hist.push({ d: today - i, v: [str, 12000000, 9000000, 8000000] });
    ledger.push({ d: today - i, used, wasted: Math.max(0, 1470 - used) });
  }
  return { gcb_v1_hist: hist, gcb_v1_ledger: ledger };
}
for (const [gain, used, label] of [[4200000, 1470, "on plan"],
                                   [3900000, 1280, "under-spending"],
                                   [80000000, 1470, "absurd gain, clamped"],
                                   [1000, 20, "barely trains"]])
  for (const goals of [{}, { gcb_v1_goals: { str: 800000000, def: 20000000 } }])
    CASES.push({ energy: 140, fulltime: 600, drug: 0, mode: "xan", booster: 60000,
                 xan: 85, cans: 21, happy: 4300, stack: false, label,
                 seed: Object.assign(seeded(gain, used), goals) });

let failures = [];
for (const c of CASES) {
  const cfg = { energy:c.energy, fulltime:c.fulltime, drug:c.drug, booster:c.booster,
                xan:c.xan, cans:c.cans, happy:c.happy,
                mem: Object.assign({ gcb_v1_mode:c.mode, gcb_v1_warStack:c.stack }, c.seed || {}) };
  await page.goto("https://www.torn.com/gym.php?cfg="+encodeURIComponent(JSON.stringify(cfg)),
                  {waitUntil:"domcontentloaded"});
  await page.waitForTimeout(200);
  const bad = await page.evaluate(() => {
    const pn = document.getElementById("gcb-panel");
    if (!pn) return "no panel";
    for (const t of ["now","plan","stock","trend","set"]) {
      const btn = pn.querySelector('[data-tab="'+t+'"]');
      if (btn) btn.click();
      const txt = pn.textContent || "";
      if (/could not draw/.test(txt)) {
        const why = pn.querySelector(".gcb-why");
        return t + ": " + (why ? why.textContent : "?");
      }
      if (txt.length < 200) return t + ": empty";
    }
    return null;
  });
  if (bad) failures.push(JSON.stringify(c) + " -> " + bad);
}
console.log(CASES.length + " cases, each a real page load, all five tabs");
if (failures.length) { console.log(failures.length + " FAILED:"); failures.slice(0,5).forEach(f=>console.log("  "+f)); }
else console.log("every one drew without error");
await b.close();
process.exit(failures.length ? 1 : 0);
