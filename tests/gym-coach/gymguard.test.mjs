import fs from "fs";
import assert from "assert";
const { chromium } = await import("/root/.hermes/hermes-agent/node_modules/playwright-core/index.mjs");
const html = fs.readFileSync("harness/index.html","utf8");
const script = fs.readFileSync("harness/gym-coach-beta.user.js","utf8");
const b = await chromium.launch({ args:["--no-sandbox"] });

// Nine of the 31 gyms have a zero somewhere. Balboas trains Defense and
// Dexterity ONLY; the four specialist gyms train exactly one stat each. The
// advice has to know that before it tells you to spend a bar there.
async function verdict({ gym, focus, mode = "xan", key = true, goals = null }) {
  const ctx = await b.newContext({ viewport:{width:393,height:1200} });
  const page = await ctx.newPage();
  await page.route("**/*", r => { const u=r.request().url();
    if (u.includes("gym-coach-beta.user.js")) return r.fulfill({contentType:"application/javascript",body:script});
    if (/gym\.php/.test(u)) return r.fulfill({contentType:"text/html",body:html});
    return r.fulfill({status:204,body:""}); });
  const cfg = { energy:150, energyMax:150, fulltime:0, drug:4000, booster:60000,
    xan:85, cans:21, happy:4300, happyMax:5000, gym,
    stats:{ str:150422278, def:104614286, spe:150464114, dex:146009 },
    mem: Object.assign({ gcb_v1_mode: mode, gcb_v1_focus: focus },
                       goals ? { gcb_v1_goals: goals } : {},
                       key ? {} : { gcb_v1_api_key: "" }) };
  await page.goto("https://www.torn.com/gym.php?cfg="+encodeURIComponent(JSON.stringify(cfg)),
                  { waitUntil:"domcontentloaded" });
  await page.waitForTimeout(1400);
  const r = await page.evaluate(() => {
    const p = document.getElementById("gcb-panel");
    return { move: (p.querySelector(".gcb-move") || {}).textContent || "",
             why: (p.querySelector(".gcb-why") || {}).textContent || "",
             body: p.textContent || "" };
  });
  await ctx.close();
  return r;
}

let pass=0,fail=0;
const t=async(n,f)=>{try{await f();pass++;console.log("ok   "+n);}catch(e){fail++;console.log("FAIL "+n+" :: "+e.message);}};

await t("a gym that cannot train the stat says so instead of advising it", async () => {
  const r = await verdict({ gym: 25, focus: "str" });          // Balboas: Def/Dex only
  assert.ok(!/Train 150e into Strength at Balboas/.test(r.body),
    "still advised the impossible: " + r.move);
  assert.match(r.move, /Balboas Gym cannot train Strength/i);
});

await t("it names what the gym CAN train, so the next move is obvious", async () => {
  const r = await verdict({ gym: 25, focus: "str" });
  // The list between "trains" and "only" is the claim being made. Asserting on
  // the whole sentence is useless — it names the blocked stat twice by design.
  const list = /trains (.+?) only/.exec(r.why);
  assert.ok(list, "no 'trains X only' clause: " + r.why);
  assert.strictEqual(list[1], "Defense and Dexterity");
  assert.ok(!/Strength/.test(list[1]), "offered the stat it just refused: " + list[1]);
  assert.ok(!/Speed/.test(list[1]), "Balboas has no Speed either: " + list[1]);
});

await t("the four specialist gyms are caught too, not just Balboas", async () => {
  const iso = await verdict({ gym: 28, focus: "str" });         // Mr. Isoyamas: Def only
  assert.match(iso.move, /Isoyamas.*cannot train Strength/i);
  assert.match(iso.why, /Defense/);

  const g3k = await verdict({ gym: 27, focus: "def" });         // Gym 3000: Str only
  assert.match(g3k.move, /Gym 3000 cannot train Defense/i);
  assert.strictEqual(/trains (.+?) only/.exec(g3k.why)[1], "Strength",
    "a one-stat gym must name exactly one stat");
});

await t("a gym that CAN train the stat is left completely alone", async () => {
  const r = await verdict({ gym: 24, focus: "str" });           // George's trains everything
  assert.ok(!/cannot train/i.test(r.body), r.move);
  assert.match(r.move, /Train Strength now/);
});

await t("happy jump gets the same guard — it ends in training too", async () => {
  const r = await verdict({ gym: 25, focus: "str", mode: "jump" });
  assert.match(r.move, /cannot train Strength/i);
});

await t("a partial-dot gym is not confused for a blocked one", async () => {
  // Legs Bums and Tums trains Spe/Def/Dex but NOT Str.
  const ok = await verdict({ gym: 15, focus: "spe" });
  assert.ok(!/cannot train/i.test(ok.body), ok.move);
  const no = await verdict({ gym: 15, focus: "str" });
  assert.match(no.move, /cannot train Strength/i);
});

console.log("\n" + pass + " passed, " + fail + " failed");
await b.close();
process.exit(fail ? 1 : 0);
