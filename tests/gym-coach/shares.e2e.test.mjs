// The percentage build as the panel actually behaves.
//
// shares.test.mjs proves the arithmetic. This proves the boxes are reachable,
// what you type survives, and the derived goals reach the planner -- none of
// which the unit tests can see.
import fs from "fs";
import assert from "assert";
const { chromium } = await import("/root/.hermes/hermes-agent/node_modules/playwright-core/index.mjs");
const html = fs.readFileSync("harness/index.html", "utf8");
const script = fs.readFileSync("harness/gym-coach-beta.user.js", "utf8");
const b = await chromium.launch({ args: ["--no-sandbox"] });
const ME = { str: 647295613, def: 101935420, spe: 259461019, dex: 706534966 };

async function panel({ shares = null, shareTotal = 0, goals = null }) {
  const ctx = await b.newContext({ viewport: { width: 393, height: 1600 } });
  const p = await ctx.newPage();
  await p.route("**/*", r => {
    const u = r.request().url();
    if (u.includes("gym-coach-beta.user.js")) return r.fulfill({ contentType: "application/javascript", body: script });
    if (/gym\.php/.test(u)) return r.fulfill({ contentType: "text/html", body: html });
    return r.fulfill({ status: 204, body: "" });
  });
  const mem = { gcb_v1_mode: "xan", gcb_v1_focus: "str" };
  if (shares) mem.gcb_v1_shares = JSON.stringify(shares);
  if (shareTotal) mem.gcb_v1_shareTotal = shareTotal;
  if (goals) mem.gcb_v1_goals = JSON.stringify(goals);
  const cfg = { energy: 100, energyMax: 150, fulltime: 1500, drug: 0, booster: 0,
    xan: 85, cans: 21, happy: 4300, happyMax: 5000, gym: 24, noPda: true,
    stats: ME, mem };
  await p.goto("https://www.torn.com/gym.php?cfg=" + encodeURIComponent(JSON.stringify(cfg)), { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(2200);
  await p.evaluate(() => { const x = document.getElementById("gcb-pill"); if (x) x.click(); });
  await p.waitForTimeout(500);
  // The persisted focus, not scraped text. applyGoalFocus's own comment says
  // everything downstream keys off state.focus, so that IS the contract --
  // and matching stat names in the panel passed for the wrong reason, since
  // the share card lists all four of them.
  const focus = await p.evaluate(() => window.GM_getValue("gcb_v1_focus", null));
  await p.evaluate(() => { const t = document.querySelector('[data-tab="plan"]'); if (t) t.click(); });
  await p.waitForTimeout(700);
  return { p, ctx, focus };
}
const card = p => p.evaluate(() => {
  const c = [...document.querySelectorAll(".gc-card")]
    .find(x => x.querySelector("h3") && /build by percentage/i.test(x.querySelector("h3").textContent));
  return c ? c.innerText.replace(/\n+/g, " | ") : null;
});

let pass = 0, fail = 0;
const t = async (n, f) => { try { await f(); pass++; console.log("ok   " + n); } catch (e) { fail++; console.log("FAIL " + n + " :: " + e.message); } };

await t("the card is on the Plan tab and asks for shares", async () => {
  const { p, ctx } = await panel({});
  const txt = await card(p);
  assert.ok(txt, "no Build by percentage card");
  assert.match(txt, /40\/30\/20\/10 and 4\/3\/2\/1 are the same build/);
  await ctx.close();
});

await t("it shows your real shares against the ones you want", async () => {
  const { p, ctx } = await panel({ shares: { dex: 40, str: 30, spe: 20, def: 10 } });
  const txt = await card(p);
  assert.match(txt, /Speed · want 20% \| 15\.1% · 4\.9 under/, txt);
  assert.match(txt, /Strength · want 30% \| 37\.7% · 7\.7 over/, txt);
  await ctx.close();
});

await t("maintain mode points the coach at the biggest deficit", async () => {
  // No total goal, so nothing for the planner to aim at -- the focus has to
  // come from the shares alone. Asserted on the PERSISTED focus rather than
  // panel text: applyGoalFocus's own comment says everything downstream keys
  // off state.focus, so that is the contract, and matching stat names in the
  // panel passed for the wrong reason because the share card lists all four.
  const { p, ctx, focus } = await panel({ shares: { dex: 40, str: 30, spe: 20, def: 10 } });
  assert.strictEqual(focus, "spe", "not training the under-share stat, it is on " + focus);
  assert.match(await card(p), /Maintain mode/);
  await ctx.close();
});

await t("a total goal turns the shares into real dated goals", async () => {
  const { p, ctx } = await panel({ shares: { dex: 40, str: 30, spe: 20, def: 10 }, shareTotal: 3000000000 });
  // Read the goal INPUTS, not innerText: an input's value is a property, not a
  // text node, so it never appears in innerText and the assertion would fail
  // against a feature that is working perfectly.
  const goals = await p.evaluate(() =>
    [...document.querySelectorAll("[data-goal]")].map(i => i.dataset.goal + "=" + i.value).sort());
  assert.deepStrictEqual(goals, [
    "def=300,000,000", "dex=1,200,000,000", "spe=600,000,000", "str=900,000,000",
  ], "40/30/20/10 of 3b did not reach the goal boxes");
  assert.ok(!/Maintain mode/.test(await card(p)), "still calling it maintain mode with a total set");
  await ctx.close();
});

await t("typing a share is kept as typed, not rewritten under the cursor", async () => {
  const { p, ctx } = await panel({});
  await p.evaluate(() => {
    const el = document.querySelector('[data-share="spe"]');
    el.value = "2";
    el.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await p.waitForTimeout(600);
  const v = await p.evaluate(() => (document.querySelector('[data-share="spe"]') || {}).value);
  assert.strictEqual(v, "2", "the box was rewritten to a normalised percentage");
  await ctx.close();
});

await t("a zero share is reported as never trained, not as a deficit", async () => {
  const { p, ctx } = await panel({ shares: { dex: 50, str: 50, spe: 0, def: 0 } });
  const txt = await card(p);
  assert.match(txt, /Defense · want 0% \| 5\.9% · not trained/, txt);
  await ctx.close();
});

console.log("\n" + pass + " passed, " + fail + " failed");
await b.close();
process.exit(fail ? 1 : 0);
