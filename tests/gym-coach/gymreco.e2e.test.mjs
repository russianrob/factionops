import fs from "fs";
import assert from "assert";
const { chromium } = await import("/root/.hermes/hermes-agent/node_modules/playwright-core/index.mjs");
const html = fs.readFileSync("harness/index.html","utf8");
const script = fs.readFileSync("harness/gym-coach-beta.user.js","utf8");
const b = await chromium.launch({ args:["--no-sandbox"] });
const src = fs.readFileSync("gym-coach-beta.user.js","utf8");
function grabArr(d0){const i=src.indexOf(d0);const j=src.indexOf("\n  ];",i);return src.slice(i,j+5);}
const GYM_TABLE = new Function(grabArr("var GYMS = [") + " return GYMS;")();

// The unit tests call betterGym directly, so they stay green even if the scan
// never runs or the step never reaches the card. This drives the real page.
async function panel({ gym, focus, seedOwned = null, buttons = null,
                       owned = null, pct = null, progressUnlocked = false }) {
  // `buttons` short-renders the gym list — React paints it late, and a partial
  // read would look like "most gyms locked". The harness page builds its own
  // button list, so this rides in on the config rather than by patching markup.
  const pageHtml = html;
  const ctx = await b.newContext({ viewport:{width:393,height:1400} });
  const page = await ctx.newPage();
  await page.route("**/*", r => { const u=r.request().url();
    if (u.includes("gym-coach-beta.user.js")) return r.fulfill({contentType:"application/javascript",body:script});
    if (/gym\.php/.test(u)) return r.fulfill({contentType:"text/html",body:pageHtml});
    return r.fulfill({status:204,body:""}); });
  const cfg = { energy:150, energyMax:150, fulltime:0, drug:4000, booster:60000,
    xan:85, cans:21, happy:4300, happyMax:5000, gym,
    ...(buttons === null ? {} : { buttons }),
    ...(owned === null ? {} : { owned }),
    ...(pct === null ? {} : { pct }),
    ...(progressUnlocked ? { progressUnlocked: true } : {}),
    stats:{ str:150422278, def:104614286, spe:150464114, dex:146009 },
    mem: Object.assign({ gcb_v1_mode:"xan", gcb_v1_focus: focus },
                       seedOwned ? { gcb_v1_gymsOwned: seedOwned } : {}) };
  await page.goto("https://www.torn.com/gym.php?cfg="+encodeURIComponent(JSON.stringify(cfg)),
                  { waitUntil:"domcontentloaded" });
  await page.waitForTimeout(2200);          // the scan polls at 700ms
  const out = await page.evaluate(() => {
    const p = document.getElementById("gcb-panel");
    const card = [...p.querySelectorAll(".gc-card")]
      .find(c => c.querySelector("h3") && /Do this/i.test(c.querySelector("h3").textContent));
    return { body: p.textContent || "",
             steps: card ? card.innerText : "",
             owned: JSON.parse(localStorage.getItem("gcb_v1_gymsOwned") || "null") };
  });
  await ctx.close();
  return out;
}

let pass=0,fail=0;
const t=async(n,f)=>{try{await f();pass++;console.log("ok   "+n);}catch(e){fail++;console.log("FAIL "+n+" :: "+e.message);}};

await t("the page is scanned and the unlocked set is persisted", async () => {
  const r = await panel({ gym: 11, focus: "str" });       // Anabolic Anomalies (0-based 10)
  assert.ok(Array.isArray(r.owned), "nothing was stored: " + JSON.stringify(r.owned));
  assert.ok(r.owned.includes(23), "George's (23) should be unlocked in the fixture");
  assert.ok(!r.owned.includes(24), "24+ are locked in the fixture");
});

await t("the reported case: it names George's from Anabolic Anomalies", async () => {
  const r = await panel({ gym: 11, focus: "str" });
  // Phrased as the FIRST thing you do, not as a note beside advice to train
  // somewhere else — that was the contradiction.
  assert.match(r.body, /Change gym to George.s first .* trains Strength 46% faster for the same 10e/,
    r.body.slice(0, 400));
  // And it says where the ownership claim comes from, including how old the
  // reading is -- a confident sentence that cannot be traced is how the coach
  // came to recommend a gym somebody did not own.
  assert.match(r.body, /read from the gym page[^)]* ago\)/, r.body.slice(0, 400));
});

await t("already in the best gym you own, it says nothing", async () => {
  const r = await panel({ gym: 24, focus: "str" });       // George's (0-based 23)
  assert.ok(!/faster for the same/.test(r.body), "nudged from the best gym: " + r.body.slice(0,300));
});

await t("a gym that cannot train the stat is told where it can", async () => {
  const r = await panel({ gym: 25, focus: "str" });       // Balboas (0-based 24): no Strength
  assert.match(r.body, /cannot train Strength at all/);
  assert.match(r.body, /Change gym to George.s first/);
  // 0.9.69 replaced the bare ownership claim with where it came from: the
  // count the scan saw and when it looked.
  assert.match(r.body, /\d+ of 31 unlocked, read from the gym page/);
});

await t("a half-rendered gym list is not read as a set of locked gyms", async () => {
  // Five buttons is React mid-render, not a player who owns five gyms. Storing
  // that would hide every real upgrade until the next scan overwrote it.
  const r = await panel({ gym: 11, focus: "str", buttons: 5 });
  assert.strictEqual(r.owned, null, "persisted a partial read: " + JSON.stringify(r.owned));
  assert.ok(!/faster for the same/.test(r.body), "advised from a partial read");
});

await t("it never names two different gyms to train at in one verdict", async () => {
  // The reported contradiction: "Train Strength at Force Training" one line
  // above "George's ... switch before you spend this bar". Advice that argues
  // with itself is worse than no advice.
  const r = await panel({ gym: 19, focus: "str" });       // Force Training (0-based 18)
  // Count how many DISTINCT gym names the steps card mentions. One is fine —
  // that is where you train. Two means the card is arguing with itself.
  const mentioned = GYM_TABLE.map(g => g.Gym).filter(n => r.steps.includes(n));
  assert.ok(mentioned.length <= 1,
    "the steps name " + mentioned.length + " gyms: " + mentioned.join(" AND ") +
    "\n---\n" + r.steps);
});

await t("when a better gym exists, the training step names THAT gym", async () => {
  const r = await panel({ gym: 19, focus: "str" });
  assert.ok(r.steps.includes("George's"), "should send you to George's:\n" + r.steps);
  assert.ok(!r.steps.includes("Force Training"),
    "still naming the worse gym:\n" + r.steps);
});


// ---- the reported case: told to switch to the gym you are unlocking ---------
//
// A member standing in Cha Cha's (id 20) was told "change gym to Atlas first —
// it trains Strength 9% faster for the same 10e a train, and you have it
// unlocked". Atlas (id 21) is the very next rung, and they did not own it.

await t("the tile being unlocked is not counted as a gym you own", async () => {
  const r = await panel({ gym: 20, focus: "str", owned: 20, pct: 63 });
  assert.ok(!r.owned.includes(20), "Atlas (index 20) was stored as owned: " + JSON.stringify(r.owned));
  assert.ok(r.owned.includes(19), "Cha Cha's (19) is genuinely owned: " + JSON.stringify(r.owned));
});

await t("the reported wording does not appear: no switch to Atlas", async () => {
  const r = await panel({ gym: 20, focus: "str", owned: 20, pct: 63 });
  assert.ok(!/Change gym to Atlas/.test(r.body), "still names Atlas: " + r.body.slice(0, 400));
});

await t("and not when the in-progress tile carries no lock class either", async () => {
  // The shape the live report points at. With the lock class absent, the only
  // thing separating that tile from an owned one is the unlock percentage.
  const r = await panel({ gym: 20, focus: "str", owned: 20, pct: 63, progressUnlocked: true });
  assert.ok(!r.owned.includes(20), "Atlas counted as owned: " + JSON.stringify(r.owned));
  assert.ok(!/Change gym to Atlas/.test(r.body), "still names Atlas: " + r.body.slice(0, 400));
});

await t("a gym you really do own is still recommended from the same page", async () => {
  // The guard must not silence the feature: from Force Training (id 19) with
  // Cha Cha's and everything below it owned, Cha Cha's is a real upgrade for
  // Dexterity and should still be named.
  const r = await panel({ gym: 19, focus: "dex", owned: 20, pct: 63 });
  assert.match(r.body, /Change gym to Cha Cha/, r.body.slice(0, 400));
});

await b.close();
console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);