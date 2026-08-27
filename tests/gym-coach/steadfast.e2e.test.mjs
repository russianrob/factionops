// The Plan tab has to say why a rotation leg went where it did -- a plan that
// silently reorders itself reads as a bug.
import fs from "fs";
import assert from "assert";
const { chromium } = await import("/root/.hermes/hermes-agent/node_modules/playwright-core/index.mjs");
const html = fs.readFileSync("harness/index.html","utf8");
const script = fs.readFileSync("harness/gym-coach-beta.user.js","utf8");
const b = await chromium.launch({ args:["--no-sandbox"] });
const ctx = await b.newContext({ viewport:{width:393,height:1600} });
const page = await ctx.newPage();
await page.route("**/*", r => { const u=r.request().url();
  if (u.includes("gym-coach-beta.user.js")) return r.fulfill({contentType:"application/javascript",body:script});
  if (/gym\.php/.test(u)) return r.fulfill({contentType:"text/html",body:html});
  return r.fulfill({status:204,body:""}); });
const cfg = { energy:100, energyMax:150, fulltime:1500, drug:4000, booster:60000,
  xan:85, cans:21, happy:4300, happyMax:5000, gym:24,
  stats:{ str:150422278, def:104614286, spe:150464114, dex:146009 },
  factionPerks:["+ 10% strength gym gains","+ 12% speed gym gains","+ 14% defense gym gains","+ 10% dexterity gym gains"],
  mem:{ gcb_v1_mode:"xan",
        gcb_v1_goals: JSON.stringify({ str:5e8, def:5e8, spe:5e8, dex:5e8 }) } };
await page.goto("https://www.torn.com/gym.php?cfg="+encodeURIComponent(JSON.stringify(cfg)),{waitUntil:"domcontentloaded"});
await page.waitForTimeout(1800);
await page.evaluate(() => document.querySelector('#gcb-panel [data-tab="plan"]').click());
await page.waitForTimeout(500);
const card = await page.evaluate(() => {
  const c=[...document.querySelectorAll("#gcb-panel .gc-card")]
    .find(x=>x.querySelector("h3")&&/Gym gain bonus/i.test(x.querySelector("h3").textContent));
  return c ? c.innerText.replace(/\n+/g," | ") : "";
});
const steps = await page.evaluate(() => (document.getElementById("gcb-panel").innerText||"").replace(/\n+/g," | "));
await ctx.close(); await b.close();

let pass=0, fail=0;
const t=(n,f)=>{try{f();pass++;console.log("ok   "+n);}catch(e){fail++;console.log("FAIL "+n+" :: "+e.message);}};

t("the Plan tab explains why the rotation is ordered as it is", () => {
  assert.ok(card, "no Gym gain bonus card");
  assert.match(card, /Defense[^|]*\|[^|]*\+17\.4%/, card);
});

t("the best bonus is marked, and it is the faction's strongest branch", () => {
  // Steadfast Def XIV (+14%) on top of the all-stat property and education
  // lines. Speed XII is second.
  assert.match(card, /\+17\.4%[^|]*best/, card);
  assert.ok(card.indexOf("Defense") < card.indexOf("Speed"), "not sorted by bonus: " + card);
});

t("it says WHY, not just what", () => {
  assert.match(card, /Steadfast/i, card);
  assert.match(card, /best bonus first/i, card);
});

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
