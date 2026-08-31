import fs from "fs";
import assert from "assert";
const { chromium } = await import("/root/.hermes/hermes-agent/node_modules/playwright-core/index.mjs");
const html = fs.readFileSync("harness/index.html","utf8");
const script = fs.readFileSync("harness/gym-coach-beta.user.js","utf8");
const b = await chromium.launch({ args:["--no-sandbox"] });
const page = await b.newPage({ viewport:{width:393,height:1400} });
await page.route("**/*", r => { const u=r.request().url();
  if (u.includes("gym-coach-beta.user.js")) return r.fulfill({contentType:"application/javascript",body:script});
  if (/gym\.php/.test(u)) return r.fulfill({contentType:"text/html",body:html});
  return r.fulfill({status:204,body:""}); });

async function load(goals) {
  const cfg = { energy:45, energyMax:150, fulltime:3150, drug:0, booster:60000, xan:85,
    cans:21, happy:4300, happyMax:5000, gym:24,
    stats:{ str:150422278, def:104614286, spe:150464114, dex:146009 },
    // The verdict is folded by default now, and these assertions are about what the EXPANDED view says -- the move text, the plan strip, the energy meter. Pin it open rather than testing the fold by accident.
    mem: Object.assign({ gcb_v1_mode:"xan", gcb_v1_goalStep: 5e7, gcb_v1_verdictFold: 0 },
                       goals ? { gcb_v1_goals: goals } : {}) };
  await page.goto("https://www.torn.com/gym.php?cfg=" + encodeURIComponent(JSON.stringify(cfg)),
                  { waitUntil:"domcontentloaded" });
  await page.waitForTimeout(1200);
}
const cards = () => page.evaluate(() =>
  [...document.querySelectorAll("#gcb-panel .gc-body .gc-card h3")].map(h => h.textContent));
const tabLabels = () => page.evaluate(() =>
  [...document.querySelectorAll("#gcb-panel .tabs button")].map(x => x.textContent));
const strip = () => page.evaluate(() => {
  const el = document.querySelector("#gcb-panel .gcb-strip");
  return el ? el.innerText.replace(/\s+/g," ").trim() : null;
});

let pass=0,fail=0;
const t=async(n,f)=>{try{await f();pass++;console.log("ok   "+n);}catch(e){fail++;console.log("FAIL "+n+" :: "+e.message);}};

await t("Plan is a tab you can see, not an icon you have to know about", async () => {
  await load({ str:1e9, def:1e9, spe:1e9 });
  assert.deepStrictEqual(await tabLabels(), ["Now","Plan","Stock","Trend"]);
});

await t("all four tabs sit on one row at phone width", async () => {
  await load({ str:1e9 });
  const r = await page.evaluate(() => {
    const tabs = document.querySelector("#gcb-panel .tabs");
    const rows = new Set([...tabs.children].map(x => Math.round(x.getBoundingClientRect().top)));
    const clipped = [...tabs.children].filter(x => x.scrollWidth > x.clientWidth + 1).map(x => x.textContent);
    return { rows: rows.size, clipped };
  });
  assert.strictEqual(r.rows, 1, "the tab bar must not wrap");
  assert.deepStrictEqual(r.clipped, [], "no label may be clipped");
});

await t("the things you decide live on Plan", async () => {
  await load({ str:1e9, def:1e9, spe:1e9 });
  await page.evaluate(() => document.querySelector('[data-tab="plan"]').click());
  await page.waitForTimeout(300);
  const c = await cards();
  ["Goals","Energy sources","Playstyle","Calibration","Worth it?"].forEach(name =>
    assert.ok(c.some(x => x === name), name + " should be on Plan, got " + JSON.stringify(c)));
});

await t("the things you configure once stay behind the cog", async () => {
  await load({ str:1e9 });
  await page.evaluate(() => document.querySelector('[data-tab="set"]').click());
  await page.waitForTimeout(300);
  const c = await cards();
  assert.ok(c.includes("API"), "API belongs in setup: " + JSON.stringify(c));
  assert.ok(!c.includes("Goals"), "Goals must not be in both places");
  assert.ok(!c.includes("Energy sources"));
});

await t("the front page says what the plan is", async () => {
  await load({ str:1e9, def:1e9, spe:1e9 });
  const s = await strip();
  assert.ok(s, "there should be a plan strip on Now");
  assert.match(s, /Defense/);
  assert.match(s, /150,000,000/);
  assert.match(s, /all goals/);
});

await t("with nothing set it says so, which is the whole point", async () => {
  await load(null);
  const s = await strip();
  assert.match(s, /No goals set/);
  assert.match(s, /tap to plan/);
});

await t("tapping the strip goes to Plan", async () => {
  await load(null);
  await page.evaluate(() => document.querySelector("#gcb-panel .gcb-strip").click());
  await page.waitForTimeout(300);
  const on = await page.evaluate(() =>
    [...document.querySelectorAll("#gcb-panel .tabs button")].filter(x => x.classList.contains("on"))
      .map(x => x.textContent));
  assert.deepStrictEqual(on, ["Plan"]);
  assert.ok((await cards()).includes("Goals"));
});

await t("the strip is only on Now, not repeated on every tab", async () => {
  await load({ str:1e9 });
  assert.ok(await strip(), "present on Now");
  for (const tab of ["plan","stock","trend"]) {
    await page.evaluate(x => document.querySelector('[data-tab="'+x+'"]').click(), tab);
    await page.waitForTimeout(200);
    assert.strictEqual(await strip(), null, "should not appear on " + tab);
  }
});

console.log("\n" + pass + " passed, " + fail + " failed");
await b.close();
process.exit(fail ? 1 : 0);
