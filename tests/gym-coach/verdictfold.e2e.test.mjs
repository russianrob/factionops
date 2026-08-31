// Folding the verdict away on the Now tab.
//
// Requested: "have that top section minimised like the first picture but have
// the option to expand it by clicking on it". Off the Now tab the verdict
// already collapses to one tappable line -- this makes that same compact form
// available ON Now, so the tabs and the cards below start higher up the
// screen without losing the verdict.
import fs from "fs";
import assert from "assert";
const { chromium } = await import("/root/.hermes/hermes-agent/node_modules/playwright-core/index.mjs");
const html = fs.readFileSync("harness/index.html", "utf8");
const script = fs.readFileSync("harness/gym-coach-beta.user.js", "utf8");
const b = await chromium.launch({ args: ["--no-sandbox"] });

async function open_({ folded = null } = {}) {
  const ctx = await b.newContext({ viewport: { width: 393, height: 1400 } });
  const p = await ctx.newPage();
  const errors = [];
  p.on("pageerror", e => errors.push(e.message));
  await p.route("**/*", r => {
    const u = r.request().url();
    if (u.includes("gym-coach-beta.user.js")) return r.fulfill({ contentType: "application/javascript", body: script });
    if (/gym\.php/.test(u)) return r.fulfill({ contentType: "text/html", body: html });
    return r.fulfill({ status: 204, body: "" });
  });
  const mem = { gcb_v1_mode: "xan", gcb_v1_focus: "str" };
  if (folded !== null) mem.gcb_v1_verdictFold = folded;
  const cfg = { energy: 127, energyMax: 150, fulltime: 2580, drug: 0, booster: 0,
    xan: 85, cans: 21, happy: 4300, happyMax: 5000, gym: 24, noPda: true,
    stats: { str: 647295613, def: 101935420, spe: 259461019, dex: 706534966 }, mem };
  await p.goto("https://www.torn.com/gym.php?cfg=" + encodeURIComponent(JSON.stringify(cfg)), { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(2200);
  await p.evaluate(() => { const x = document.getElementById("gcb-pill"); if (x) x.click(); });
  await p.waitForTimeout(600);
  return { p, ctx, errors };
}
const shape = p => p.evaluate(() => ({
  full: !!document.querySelector("#gcb-panel .gcb-verdict"),
  mini: !!document.querySelector("#gcb-panel .gcb-mini"),
  meters: !!document.querySelector("#gcb-panel .gcb-meters"),
  onNow: !!document.querySelector('#gcb-panel [data-tab="now"].on'),
  miniText: (document.querySelector("#gcb-panel .gcb-mini") || {}).innerText || "",
}));

let pass = 0, fail = 0;
const t = async (n, f) => { try { await f(); pass++; console.log("ok   " + n); } catch (e) { fail++; console.log("FAIL " + n + " :: " + e.message); } };

await t("nothing changes for anyone who has not asked for it", async () => {
  // Default stays expanded: a stored preference is one thing, silently
  // reshaping every existing user's panel is another.
  const { p, ctx, errors } = await open_();
  const s = await shape(p);
  assert.deepStrictEqual(errors, [], errors.join(" | "));
  assert.strictEqual(s.full, true, "the verdict should start expanded");
  assert.strictEqual(s.mini, false);
  await ctx.close();
});

await t("folded, the Now tab shows the same one-line form the other tabs use", async () => {
  const { p, ctx } = await open_({ folded: 1 });
  const s = await shape(p);
  assert.strictEqual(s.mini, true, "no compact line");
  assert.strictEqual(s.full, false, "the big verdict is still there");
  assert.strictEqual(s.onNow, true, "folding should not move you off the Now tab");
  await ctx.close();
});

await t("the compact line still carries the verdict and the energy", async () => {
  // Minimised has to stay useful: a bar that hides the answer is just a
  // smaller way of saying nothing.
  const { p, ctx } = await open_({ folded: 1 });
  const s = await shape(p);
  assert.match(s.miniText, /xan|train|wait/i, "no verdict in the compact line: " + s.miniText);
  assert.match(s.miniText, /127\s*\/\s*150/, "no energy in the compact line: " + s.miniText);
  await ctx.close();
});

await t("clicking the compact line expands it", async () => {
  const { p, ctx } = await open_({ folded: 1 });
  await p.click("#gcb-panel .gcb-mini");
  await p.waitForTimeout(500);
  const s = await shape(p);
  assert.strictEqual(s.full, true, "clicking did not expand it");
  assert.strictEqual(s.meters, true, "the energy meter did not come back");
  await ctx.close();
});

await t("and clicking the tag folds it away again", async () => {
  const { p, ctx } = await open_();
  await p.click('#gcb-panel .gcb-verdict [data-act="verdict"]');
  await p.waitForTimeout(500);
  assert.strictEqual((await shape(p)).mini, true, "it did not fold");
  await ctx.close();
});

await t("the choice is remembered", async () => {
  const { p, ctx } = await open_();
  await p.click('#gcb-panel .gcb-verdict [data-act="verdict"]');
  await p.waitForTimeout(500);
  const stored = await p.evaluate(() => window.GM_getValue("gcb_v1_verdictFold", null));
  assert.ok(stored, "the fold was not persisted, so it resets on every page load");
  await ctx.close();
});

await t("off Now it is still the plain tappable line that takes you back", async () => {
  // The existing behaviour, which this must not disturb: on another tab the
  // compact bar returns you to Now rather than toggling anything.
  const { p, ctx } = await open_();
  await p.evaluate(() => { const x = document.querySelector('[data-tab="plan"]'); if (x) x.click(); });
  await p.waitForTimeout(500);
  const act = await p.evaluate(() => {
    const m = document.querySelector("#gcb-panel .gcb-mini");
    return m ? { tab: m.dataset.tab || null, act: m.dataset.act || null } : null;
  });
  assert.deepStrictEqual(act, { tab: "now", act: null }, "the off-Now bar changed behaviour");
  await ctx.close();
});

console.log("\n" + pass + " passed, " + fail + " failed");
await b.close();
process.exit(fail ? 1 : 0);
