// The banner has to appear on pages the coach otherwise refuses to draw on.
// ensureUi() actively strips the pill and closes the panel off the gym page,
// so "it works in the unit tests" proves nothing about whether this mounts.
import fs from "fs";
import assert from "assert";
const { chromium } = await import("/root/.hermes/hermes-agent/node_modules/playwright-core/index.mjs");
const html = fs.readFileSync("harness/index.html", "utf8");
const script = fs.readFileSync("harness/gym-coach-beta.user.js", "utf8");
const b = await chromium.launch({ args: ["--no-sandbox"] });
const MIN = 60000;

async function page({ url = "https://www.torn.com/forums.php", energy = 150, max = 150,
                      fullSince = null, ack = null, warStack = false }) {
  const ctx = await b.newContext({ viewport: { width: 393, height: 900 } });
  const p = await ctx.newPage();
  await p.route("**/*", r => {
    const u = r.request().url();
    if (u.includes("gym-coach-beta.user.js")) return r.fulfill({ contentType: "application/javascript", body: script });
    if (/torn\.com\/(gym|forums|item|index)\.php/.test(u)) return r.fulfill({ contentType: "text/html", body: html });
    return r.fulfill({ status: 204, body: "" });
  });
  const mem = { gcb_v1_mode: "xan", gcb_v1_focus: "str" };
  if (fullSince !== null) mem.gcb_v1_fullsince = Date.now() - fullSince;
  if (ack !== null) mem.gcb_v1_fullack = Date.now() - ack;
  if (warStack) mem.gcb_v1_warStack = true;
  const cfg = { energy, energyMax: max, fulltime: 0, drug: 4000, booster: 60000,
                xan: 85, cans: 21, happy: 4300, happyMax: 5000, gym: 24, noPda: true,
                stats: { str: 614000000, def: 12000000, spe: 9000000, dex: 8000000 }, mem };
  await p.goto(url + "?cfg=" + encodeURIComponent(JSON.stringify(cfg)), { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(2500);
  return { p, ctx };
}
const nagText = p => p.evaluate(() => {
  const el = document.getElementById("gcb-fullbar-nag");
  return el ? el.innerText.replace(/\n+/g, " | ") : null;
});

let pass = 0, fail = 0;
const t = async (n, f) => { try { await f(); pass++; console.log("ok   " + n); } catch (e) { fail++; console.log("FAIL " + n + " :: " + e.message); } };

await t("the banner mounts on a NON-gym page", async () => {
  // The whole point: the coach draws nothing here, but this must still appear.
  const { p, ctx } = await page({ fullSince: 12 * MIN });
  const txt = await nagText(p);
  assert.ok(txt, "no banner on forums.php");
  assert.match(txt, /BAR FULL 12 MINUTES/);
  // and the panel itself is still correctly absent
  assert.strictEqual(await p.evaluate(() => !!document.getElementById("gcb-pill")), false,
    "the pill should still be stripped off-gym");
  await ctx.close();
});

await t("a bar full for two minutes draws nothing", async () => {
  const { p, ctx } = await page({ fullSince: 2 * MIN });
  assert.strictEqual(await nagText(p), null);
  await ctx.close();
});

await t("Got it takes it down", async () => {
  const { p, ctx } = await page({ fullSince: 12 * MIN });
  assert.ok(await nagText(p), "precondition: banner is up");
  await p.click("#gcb-fullbar-nag-ok");
  await p.waitForTimeout(300);
  assert.strictEqual(await nagText(p), null, "still showing after acknowledging");
  await ctx.close();
});

await t("the acknowledgement survives a page change, then wears off", async () => {
  // Acknowledged 2 minutes ago -- still quiet on a different page.
  const a = await page({ url: "https://www.torn.com/item.php", fullSince: 30 * MIN, ack: 2 * MIN });
  assert.strictEqual(await nagText(a.p), null, "a fresh page ignored the acknowledgement");
  await a.ctx.close();
  // Acknowledged 11 minutes ago -- back, because Got it is a snooze.
  const c = await page({ url: "https://www.torn.com/item.php", fullSince: 30 * MIN, ack: 11 * MIN });
  assert.ok(await nagText(c.p), "the snooze never wore off");
  await c.ctx.close();
});

await t("a war stack is left alone", async () => {
  const { p, ctx } = await page({ fullSince: 40 * MIN, warStack: true });
  assert.strictEqual(await nagText(p), null);
  await ctx.close();
});

await t("the gym page gets it too -- you can be distracted there as well", async () => {
  const { p, ctx } = await page({ url: "https://www.torn.com/gym.php", fullSince: 12 * MIN });
  assert.ok(await nagText(p), "no banner on the gym page");
  await ctx.close();
});

// The tests above all SEED the clock. None of them proved the clock ever
// starts on its own -- which is the whole path a real user walks.
await t("a live poll starts the clock and persists it, with nothing seeded", async () => {
  const { p, ctx } = await page({ energy: 150, max: 150 });   // no fullSince
  const v = await p.evaluate(() => window.GM_getValue("gcb_v1_fullsince", 0));
  assert.ok(Number(v) > 0, "the clock never started: gcb_v1_fullsince = " + JSON.stringify(v));
  assert.strictEqual(await nagText(p), null, "10 minutes have not passed yet");
  await ctx.close();
});

await t("a bar that is not full does not start the clock", async () => {
  const { p, ctx } = await page({ energy: 120, max: 150 });
  assert.strictEqual(Number(await p.evaluate(() => window.GM_getValue("gcb_v1_fullsince", 0))), 0);
  await ctx.close();
});

await t("the banner arrives on its own as the clock crosses ten minutes", async () => {
  // Nine minutes fifty seconds in, so the threshold is crossed while the page
  // is open. Proves the per-second timer re-renders rather than only painting
  // once at load.
  const { p, ctx } = await page({ fullSince: 9 * MIN + 50000 });
  assert.strictEqual(await nagText(p), null, "too early -- it should not be up yet");
  await p.waitForTimeout(12000);
  assert.ok(await nagText(p), "the banner never appeared as the clock crossed");
  await ctx.close();
});

console.log("\n" + pass + " passed, " + fail + " failed");
await b.close();
process.exit(fail ? 1 : 0);
