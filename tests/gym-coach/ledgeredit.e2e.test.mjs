// Drives the real Settings card. The unit tests call clearLedgerDay directly,
// so they stay green even if no button ever reaches it.
import fs from "fs";
import assert from "assert";
const { chromium } = await import("/root/.hermes/hermes-agent/node_modules/playwright-core/index.mjs");
const html = fs.readFileSync("harness/index.html", "utf8");
const script = fs.readFileSync("harness/gym-coach-beta.user.js", "utf8");
const b = await chromium.launch({ args: ["--no-sandbox"] });

const DAY = 86400000;
const today = Math.floor(Date.now() / DAY);
// Three days of a war: plenty spent on attacks, and a bar held at cap
// throughout, which is exactly what used to poison the usage figure.
const LEDGER = [
  // Outside the 14-day calibration window: never listed, and Clear all must not
  // reach it. Without this row a clear-all that ignores the window looks fine.
  { d: today - 40, used: 900, wasted: 700 },
  { d: today - 4, used: 1400, wasted: 40 },
  { d: today - 3, used: 1200, wasted: 980 },
  { d: today - 2, used: 1180, wasted: 1120 },
];

async function open_() {
  const ctx = await b.newContext({ viewport: { width: 393, height: 1600 } });
  const page = await ctx.newPage();
  await page.route("**/*", r => {
    const u = r.request().url();
    if (u.includes("gym-coach-beta.user.js")) return r.fulfill({ contentType: "application/javascript", body: script });
    if (/gym\.php/.test(u)) return r.fulfill({ contentType: "text/html", body: html });
    return r.fulfill({ status: 204, body: "" });
  });
  const cfg = {
    energy: 100, energyMax: 150, fulltime: 1500, drug: 4000, booster: 60000,
    xan: 85, cans: 21, happy: 4300, happyMax: 5000, gym: 24,
    stats: { str: 150422278, def: 104614286, spe: 150464114, dex: 146009 },
    mem: { gcb_v1_mode: "xan", gcb_v1_focus: "str", gcb_v1_ledger: JSON.stringify(LEDGER) },
  };
  await page.goto("https://www.torn.com/gym.php?cfg=" + encodeURIComponent(JSON.stringify(cfg)),
    { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1600);
  await page.evaluate(() => document.querySelector('#gcb-panel [data-tab="set"]').click());
  await page.waitForTimeout(400);
  return { page, ctx };
}
const readCard = page => page.evaluate(() => {
  const c = [...document.querySelectorAll("#gcb-panel .gc-card")]
    .find(x => x.querySelector("h3") && /Missed energy/i.test(x.querySelector("h3").textContent));
  return {
    text: c ? c.innerText.replace(/\n+/g, " | ") : "",
    clears: c ? c.querySelectorAll("[data-clearday]").length : 0,
    restores: c ? c.querySelectorAll("[data-restoreday]").length : 0,
    // The GM stub holds live values: seeded as a JSON string, written back as
    // an array. Read whichever is there.
    ledger: (v => typeof v === "string" ? JSON.parse(v) : v)(window.GM_getValue("gcb_v1_ledger", null)),
  };
});

let pass = 0, fail = 0;
const t = async (n, f) => { try { await f(); pass++; console.log("ok   " + n); } catch (e) { fail++; console.log("FAIL " + n + " :: " + e.message); } };

await t("the card lists every day that missed energy", async () => {
  const { page, ctx } = await open_();
  const r = await readCard(page);
  assert.ok(r.text, "no Missed energy card in Settings");
  assert.strictEqual(r.clears, 3, "expected a button per in-window day, got " + r.clears);
  assert.ok(!r.text.includes("900e"), "listed a day older than the window: " + r.text);
  await ctx.close();
});

await t("it shows what clearing would do to the usage figure before you do it", async () => {
  const { page, ctx } = await open_();
  const r = await readCard(page);
  assert.match(r.text, /Bar actually used/, r.text);
  assert.match(r.text, /→\s*\d+%/, "no before/after shown: " + r.text);
  await ctx.close();
});

await t("clicking Clear zeroes that day and writes it back", async () => {
  const { page, ctx } = await open_();
  await page.evaluate(d => document.querySelector('[data-clearday="' + d + '"]').click(), today - 2);
  await page.waitForTimeout(300);
  const r = await readCard(page);
  const hit = r.ledger.find(e => e.d === today - 2);
  assert.strictEqual(hit.wasted, 0, "day was not cleared in storage");
  assert.strictEqual(hit.w0, 1120, "nothing kept to restore from");
  assert.strictEqual(hit.used, 1180, "spend was touched");
  await ctx.close();
});

await t("a cleared day turns into a Put back button", async () => {
  const { page, ctx } = await open_();
  await page.evaluate(d => document.querySelector('[data-clearday="' + d + '"]').click(), today - 2);
  await page.waitForTimeout(300);
  const r = await readCard(page);
  assert.strictEqual(r.restores, 1, "no way to undo the clear");
  assert.strictEqual(r.clears, 2);
  await ctx.close();
});

await t("Put back restores the original figure", async () => {
  const { page, ctx } = await open_();
  await page.evaluate(d => document.querySelector('[data-clearday="' + d + '"]').click(), today - 2);
  await page.waitForTimeout(300);
  await page.evaluate(d => document.querySelector('[data-restoreday="' + d + '"]').click(), today - 2);
  await page.waitForTimeout(300);
  const r = await readCard(page);
  const hit = r.ledger.find(e => e.d === today - 2);
  assert.strictEqual(hit.wasted, 1120);
  await ctx.close();
});

await t("Clear all only touches the days on screen", async () => {
  const { page, ctx } = await open_();
  await page.evaluate(() => document.querySelector('[data-act="clearallwaste"]').click());
  await page.waitForTimeout(400);
  const r = await readCard(page);
  // Today's bucket is created live by ledgerObserve while the page runs, so
  // compare against the seeded days rather than the whole ledger.
  const inWindow = r.ledger.filter(e => [today - 4, today - 3, today - 2].includes(e.d));
  assert.ok(inWindow.every(e => e.wasted === 0), "not everything cleared: " + JSON.stringify(inWindow));
  assert.deepStrictEqual(inWindow.map(e => e.used), [1400, 1200, 1180], "spend was touched");
  assert.strictEqual(r.restores, 3, "each cleared day should be restorable");
  const old = r.ledger.find(e => e.d === today - 40);
  assert.strictEqual(old.wasted, 700, "Clear all reached a day the list never showed");
  await ctx.close();
});

console.log("\n" + pass + " passed, " + fail + " failed");
await b.close();
process.exit(fail ? 1 : 0);
