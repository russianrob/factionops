import fs from "fs";
import assert from "assert";
const { chromium } = await import("/root/.hermes/hermes-agent/node_modules/playwright-core/index.mjs");
const html = fs.readFileSync("harness/index.html","utf8");
const script = fs.readFileSync("harness/gym-coach-beta.user.js","utf8");
const b = await chromium.launch({ args:["--no-sandbox"] });

// End-to-end: the item-page scrape has to reach the Stock list through the real
// call site. The unit tests call adoptScrapedCans directly, so deleting the call
// from countItems' caller leaves every one of them green.
async function stock(mem) {
  const ctx = await b.newContext({ viewport:{width:393,height:1200} });
  const page = await ctx.newPage();
  await page.route("**/*", r => { const u=r.request().url();
    if (u.includes("gym-coach-beta.user.js")) return r.fulfill({contentType:"application/javascript",body:script});
    if (/gym\.php/.test(u)) return r.fulfill({contentType:"text/html",body:html});
    return r.fulfill({status:204,body:""}); });
  const cfg = { energy:45, energyMax:150, fulltime:3150, drug:0, booster:60000,
    xan:85, cans:0, rudolph:30, happy:4300, happyMax:5000, gym:24,
    stats:{ str:150422278, def:104614286, spe:150464114, dex:146009 },
    mem: Object.assign({ gcb_v1_mode:"xan" }, mem) };
  await page.goto("https://www.torn.com/gym.php?cfg="+encodeURIComponent(JSON.stringify(cfg)),
                  { waitUntil:"domcontentloaded" });
  await page.waitForTimeout(1500);
  await page.evaluate(() => document.querySelector('#gcb-panel [data-tab="stock"]').click());
  await page.waitForTimeout(300);
  const txt = await page.evaluate(() => {
    const c = [...document.querySelectorAll("#gcb-panel .gc-card")]
      .find(x => x.querySelector("h3") && /Energy drinks/i.test(x.querySelector("h3").textContent));
    return c ? c.innerText.replace(/\n+/g, " | ") : "NO DRINKS CARD";
  });
  await ctx.close();
  return txt;
}

let pass=0,fail=0;
const t=async(n,f)=>{try{await f();pass++;console.log("ok   "+n);}catch(e){fail++;console.log("FAIL "+n+" :: "+e.message);}};

await t("a can only the item page has seen still reaches the Stock list", async () => {
  // 533 is Taurine Elite. The stubbed API inventory does NOT include it, so the
  // only way it can appear is the scrape being adopted at the real call site.
  const txt = await stock({ gcb_v1_invDom: { at: Date.now(), n: 2, qty: { 554: 30, 533: 5 } } });
  assert.ok(/Taurine/i.test(txt), "scrape never reached the list: " + txt);
  assert.ok(/Rudolph/i.test(txt), "and the API row must survive: " + txt);
});

await t("with no scrape the list is exactly what the API returned", async () => {
  const txt = await stock({});
  assert.ok(/Rudolph/i.test(txt), txt);
  assert.ok(!/Taurine/i.test(txt), "invented a can from nowhere: " + txt);
});

console.log("\n" + pass + " passed, " + fail + " failed");
await b.close();
process.exit(fail ? 1 : 0);
