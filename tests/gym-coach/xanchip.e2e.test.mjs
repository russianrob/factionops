import fs from "fs";
import assert from "assert";
const { chromium } = await import("/root/.hermes/hermes-agent/node_modules/playwright-core/index.mjs");
const html = fs.readFileSync("harness/index.html", "utf8");
const script = fs.readFileSync("harness/gym-coach-beta.user.js", "utf8");
const b = await chromium.launch({ args: ["--no-sandbox"] });
const page = await b.newPage({ viewport: { width: 393, height: 1200 } });
await page.route("**/*", r => { const u = r.request().url();
  if (u.includes("gym-coach-beta.user.js")) return r.fulfill({ contentType: "application/javascript", body: script });
  if (/gym\.php/.test(u)) return r.fulfill({ contentType: "text/html", body: html });
  return r.fulfill({ status: 204, body: "" }); });

// The Inventory tab's Xanax chip has to agree with the Now verdict. Since 0.12.17
// the coach says train first, then take the Xanax, whenever the bar holds a
// train; a green one-tap USE button on that same bar takes the Xanax on held
// energy, which is the habit the fix removed. War stack and Happy jump take a
// Xanax on a held bar on purpose, so they keep USE.
async function chip(energy, extra = {}) {
  const max = 150;
  const cfg = Object.assign({ energy, energyMax: max, fulltime: Math.max(0, (max - energy) * 30),
                drug: 0, booster: 60000, xan: 85, cans: 21, happy: 4300,
                mem: Object.assign({ gcb_v1_mode: "xan", gcb_v1_verdictFold: 0 }, extra.mem || {}) }, extra.cfg || {});
  await page.goto("https://www.torn.com/gym.php?cfg=" + encodeURIComponent(JSON.stringify(cfg)), { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(400);
  const hasTab = await page.evaluate(() => { const t = document.querySelector('[data-tab="stock"]'); if (t) t.click(); return !!t; });
  await page.waitForTimeout(250);
  const r = await page.evaluate(() => {
    const use = document.querySelector('#gcb-panel [data-use="xanax"]');
    const tip = document.querySelector('#gcb-panel [data-tip="xanax"]');
    return { use: use ? use.textContent : null, tip: tip ? tip.textContent : null };
  });
  return Object.assign(r, { hasTab });
}
async function tapTip() {
  await page.evaluate(() => document.querySelector('#gcb-panel [data-tip="xanax"]').click());
  await page.waitForTimeout(300);
  return page.evaluate(() => document.body.innerText);
}
const BALBOAS = { cfg: { gym: 20 }, mem: { gcb_v1_focus: "dex", gcb_v1_gymsOwned: JSON.stringify([19, 24]) } };

let pass = 0, fail = 0;
const t = async (n, f) => { try { await f(); pass++; console.log("ok   " + n); } catch (e) { fail++; console.log("FAIL " + n + " :: " + e.message); } };

await t("cooldown clear with a train in the bar: the Xanax chip says TRAIN FIRST, not a one-tap USE", async () => {
  const r = await chip(145);
  assert.ok(r.hasTab, "fixture guard: no Inventory tab");
  assert.strictEqual(r.use, null, "a one-tap USE button is still offered on a held bar");
  assert.strictEqual(r.tip, "TRAIN FIRST");
});
await t("tapping TRAIN FIRST says why", async () => {
  await chip(145);
  const body = await tapTip();
  assert.ok(/Train what is in the bar first, then take it/.test(body), "tip does not explain train-first: " + body.slice(0, 300));
});
await t("less than one train in the bar: USE", async () => {
  assert.strictEqual((await chip(0)).use, "USE");
});
await t("war stack keeps USE: stacking on a held bar is the point", async () => {
  assert.strictEqual((await chip(500, { mem: { gcb_v1_warStack: true } })).use, "USE");
});
await t("Happy jump keeps USE", async () => {
  assert.strictEqual((await chip(145, { mem: { gcb_v1_mode: "jump" } })).use, "USE");
});
await t("one train is measured at the gym the coach names: 15e is under one Balboas train, so USE", async () => {
  assert.strictEqual((await chip(15, BALBOAS)).use, "USE");
});
await t("and 30e is one Balboas train, so TRAIN FIRST", async () => {
  assert.strictEqual((await chip(30, BALBOAS)).tip, "TRAIN FIRST");
});
await t("a running cooldown still shows WAIT", async () => {
  const r = await chip(145, { cfg: { drug: 3000 } });
  assert.ok(/^WAIT /.test(r.tip || ""), "expected a WAIT chip, got: " + JSON.stringify(r));
});
await b.close();
console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
