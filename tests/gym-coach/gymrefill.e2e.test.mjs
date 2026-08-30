// A strip on the gym page itself saying the daily refill is still unspent.
//
// The panel already carries the same line in DO THIS, but the panel is tucked
// away behind a pill. This is for the moment in the screenshot that prompted
// it: standing on gym.php at 0/150 with a refill sitting unused.
import fs from "fs";
import assert from "assert";
const { chromium } = await import("/root/.hermes/hermes-agent/node_modules/playwright-core/index.mjs");
const html = fs.readFileSync("harness/index.html", "utf8");
const script = fs.readFileSync("harness/gym-coach-beta.user.js", "utf8");
const b = await chromium.launch({ args: ["--no-sandbox"] });

async function page({ url = "https://www.torn.com/gym.php", energy = 0, refillUsed = false,
                      refillErr = false, stripAnchor = true, refillUsedAfterMs = 0,
                      energyAfterMs = 0, energyAfter = 150 }) {
  const ctx = await b.newContext({ viewport: { width: 393, height: 900 } });
  const p = await ctx.newPage();
  const body = stripAnchor ? html : html.replace('id="skip-to-content"', 'id="moved-by-torn"');
  await p.route("**/*", r => {
    const u = r.request().url();
    if (u.includes("gym-coach-beta.user.js")) return r.fulfill({ contentType: "application/javascript", body: script });
    if (/torn\.com\/(gym|forums)\.php/.test(u)) return r.fulfill({ contentType: "text/html", body });
    return r.fulfill({ status: 204, body: "" });
  });
  const cfg = { energy, energyMax: 150, fulltime: 3000, drug: 4000, booster: 60000,
                xan: 85, cans: 21, happy: 4300, happyMax: 5000, gym: 24, noPda: true,
                refillUsed, refillErr, refillUsedAfterMs, energyAfterMs, energyAfter,
                stats: { str: 614000000, def: 12000000, spe: 9000000, dex: 8000000 },
                mem: { gcb_v1_mode: "xan", gcb_v1_focus: "str" } };
  await p.goto(url + "?cfg=" + encodeURIComponent(JSON.stringify(cfg)), { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(2500);
  return { p, ctx };
}
const strip = p => p.evaluate(() => {
  const el = document.getElementById("gcb-refill-strip");
  if (!el) return null;
  const prev = el.previousElementSibling;
  return { text: el.innerText.replace(/\n+/g, " | "), href: el.getAttribute("href"),
           afterId: prev ? prev.id : null,
           float: getComputedStyle(el).cssFloat,
           sameLine: prev ? Math.abs(prev.getBoundingClientRect().top - el.getBoundingClientRect().top) < 24 : null,
           fixed: getComputedStyle(el).position === "fixed" };
});

let pass = 0, fail = 0;
const t = async (n, f) => { try { await f(); pass++; console.log("ok   " + n); } catch (e) { fail++; console.log("FAIL " + n + " :: " + e.message); } };

await t("an unused refill on an empty bar shows a strip at the gym", async () => {
  const { p, ctx } = await page({ energy: 0 });
  const s = await strip(p);
  assert.ok(s, "no strip on gym.php at 0/150 with the refill unused");
  assert.match(s.text, /refill/i);
  await ctx.close();
});

await t("the strip sits beside the Gym title, on the same line", async () => {
  const { p, ctx } = await page({ energy: 0 });
  const s = await strip(p);
  assert.strictEqual(s.afterId, "skip-to-content",
    "expected it directly after h4#skip-to-content, got " + s.afterId);
  assert.strictEqual(s.fixed, false, "should be inline, not floating");
  // The title row is float-based, not flex. Without float:left this drops
  // onto its own line below the title instead of sitting next to it.
  assert.strictEqual(s.float, "left");
  assert.strictEqual(s.sameLine, true, "it dropped below the title");
  await ctx.close();
});

await t("a React repaint does not leave two strips behind", async () => {
  const { p, ctx } = await page({ energy: 0 });
  await p.evaluate(() => {
    // Torn re-rendering the title row: our node gets moved away from the h4.
    const el = document.getElementById("gcb-refill-strip");
    document.body.appendChild(el);
  });
  await p.waitForTimeout(1500);
  const n = await p.evaluate(() => document.querySelectorAll("#gcb-refill-strip").length);
  assert.strictEqual(n, 1, "ended up with " + n + " strips");
  assert.strictEqual((await strip(p)).afterId, "skip-to-content", "never went back beside the title");
  await ctx.close();
});

await t("a refill already used today shows nothing", async () => {
  const { p, ctx } = await page({ energy: 0, refillUsed: true });
  assert.strictEqual(await strip(p), null);
  await ctx.close();
});

await t("a nearly full bar shows nothing -- the refill would be wasted", async () => {
  const { p, ctx } = await page({ energy: 125 });
  assert.strictEqual(await strip(p), null);
  await ctx.close();
});

await t("a key that cannot read the flag shows nothing rather than guessing", async () => {
  const { p, ctx } = await page({ energy: 0, refillErr: true });
  assert.strictEqual(await strip(p), null);
  await ctx.close();
});

await t("it is a gym-page thing, not an everywhere thing", async () => {
  const { p, ctx } = await page({ url: "https://www.torn.com/forums.php", energy: 0 });
  assert.strictEqual(await strip(p), null);
  await ctx.close();
});

await t("if Torn renames the heading it floats instead of vanishing", async () => {
  // The id is stable today, but losing the anchor must cost the strip its
  // position, never its existence.
  const { p, ctx } = await page({ energy: 0, stripAnchor: false });
  const s = await strip(p);
  assert.ok(s, "no strip at all once the anchor was gone");
  assert.strictEqual(s.fixed, true, "expected the floating fallback");
  await ctx.close();
});

await t("it links to the points page, where the refill actually lives", async () => {
  const { p, ctx } = await page({ energy: 0 });
  assert.strictEqual((await strip(p)).href, "https://www.torn.com/points.php");
  await ctx.close();
});

await t("it comes down again once the bar no longer wants a refill", async () => {
  // Never going up and coming back down are different code paths, and only
  // this exercises the second. Driven by the bar filling rather than the
  // refill being spent, because that re-reads on the 8s poll instead of the
  // three-minute refill TTL.
  const { p, ctx } = await page({ energy: 0, energyAfterMs: 1000, energyAfter: 150 });
  assert.ok(await strip(p), "precondition: the strip was up");
  await p.waitForTimeout(14000);
  assert.strictEqual(await strip(p), null, "still up on a full bar");
  await ctx.close();
});

console.log("\n" + pass + " passed, " + fail + " failed");
await b.close();
process.exit(fail ? 1 : 0);
