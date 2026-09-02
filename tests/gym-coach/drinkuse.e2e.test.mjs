// Pressing USE has to move the number you are looking at, without a refresh.
//
// The unit suite drives applyPendingUses directly, so it stays green whether or
// not a click reaches it and whether or not the render reads the store it
// updates. That gap is exactly where this bug lived: the use WAS recorded and
// subtracted, just from a number nobody was looking at.
import fs from "fs";
import assert from "assert";
const { chromium } = await import("/root/.hermes/hermes-agent/node_modules/playwright-core/index.mjs");
const html = fs.readFileSync("harness/index.html", "utf8");
const script = fs.readFileSync("harness/gym-coach-beta.user.js", "utf8");
const b = await chromium.launch({ args: ["--no-sandbox"] });

const CANS = 21, GOOSE = 985;

async function stockTab(over) {
  const ctx = await b.newContext({ viewport: { width: 393, height: 1400 } });
  const page = await ctx.newPage();
  await page.route("**/*", r => {
    const u = r.request().url();
    if (u.includes("gym-coach-beta.user.js")) return r.fulfill({ contentType: "application/javascript", body: script });
    if (/gym\.php/.test(u)) return r.fulfill({ contentType: "text/html", body: html });
    // Everything else, including the item-use POST, answers 204 — which is what
    // the script treats as "Torn accepted it".
    return r.fulfill({ status: 204, body: "" });
  });
  const cfg = Object.assign({
    energy: 60, energyMax: 150, fulltime: 0, drug: 0, booster: 0,
    xan: 85, cans: CANS, happy: 4300, happyMax: 5000, gym: 24,
    stats: { str: 150422278, def: 104614286, spe: 150464114, dex: 146009 },
    mem: { gcb_v1_mode: "xan", gcb_v1_focus: "str" }
  }, over || {});
  await page.goto("https://www.torn.com/gym.php?cfg=" + encodeURIComponent(JSON.stringify(cfg)),
                  { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2200);
  await page.evaluate(() => document.querySelector('#gcb-panel [data-tab="stock"]').click());
  await page.waitForTimeout(900);
  return { page, ctx };
}

// The heading total and the row are two different readings of the same fact and
// must never disagree, so both are pulled out every time.
const cansCard = page => page.evaluate(() => {
  const card = [...document.querySelectorAll("#gcb-panel .gc-card")]
    .find(c => /Energy drinks/i.test((c.querySelector("h3") || {}).textContent || ""));
  if (!card) return null;
  const head = (card.querySelector("h3").textContent.match(/×\s*([\d,]+)/) || [])[1];
  const rows = [...card.querySelectorAll(".row")].map(r => r.innerText.replace(/\s+/g, " ").trim());
  return { head: head ? Number(head.replace(/,/g, "")) : null, rows,
           useButtons: card.querySelectorAll('[data-use-id]').length };
});

let pass = 0, fail = 0;
const t = async (n, f) => { try { await f(); pass++; console.log("ok   " + n); }
                            catch (e) { fail++; console.log("FAIL " + n + " :: " + e.message); } };

await t("the tab opens showing what the API said", async () => {
  const { page, ctx } = await stockTab();
  const c = await cansCard(page);
  assert.strictEqual(c.head, CANS, JSON.stringify(c));
  assert.ok(/Goose Juice ×21/.test(c.rows.join(" | ")), c.rows.join(" | "));
  await ctx.close();
});

await t("using one drops the row and the heading immediately", async () => {
  const { page, ctx } = await stockTab();
  await page.evaluate(id => document.querySelector('[data-use-id="' + id + '"]').click(), GOOSE);
  await page.waitForTimeout(1200);
  const c = await cansCard(page);
  assert.strictEqual(c.head, CANS - 1, "heading did not move: " + JSON.stringify(c));
  assert.ok(/Goose Juice ×20/.test(c.rows.join(" | ")), "row did not move: " + c.rows.join(" | "));
  await ctx.close();
});

await t("and it STAYS down when Torn's cached count says otherwise", async () => {
  // This is the hard half. Torn caches the inventory for ~30s, so the refresh
  // fired right after a use reads the PRE-use number back — the stub returns 21
  // forever. Without the pending re-application the figure drops and springs
  // straight back up.
  const { page, ctx } = await stockTab();
  await page.evaluate(id => document.querySelector('[data-use-id="' + id + '"]').click(), GOOSE);
  await page.waitForTimeout(4000);
  const c = await cansCard(page);
  assert.strictEqual(c.head, CANS - 1, "sprang back to the cached count: " + JSON.stringify(c));
  await ctx.close();
});

await t("using three subtracts three, not one", async () => {
  // Three pending uses all vanished the moment the API acknowledged one, once.
  const { page, ctx } = await stockTab();
  for (let i = 0; i < 3; i++) {
    await page.evaluate(id => {
      const el = document.querySelector('[data-use-id="' + id + '"]');
      if (el) el.click();
    }, GOOSE);
    await page.waitForTimeout(900);
  }
  const c = await cansCard(page);
  assert.strictEqual(c.head, CANS - 3, "wrong count after three uses: " + JSON.stringify(c));
  await ctx.close();
});

await t("a drink that runs out stops offering a USE button", async () => {
  // A row at zero with a live button invites you to use an item you do not hold.
  //
  // A SECOND drink is held so the card still has rows to render. With only one
  // can, using it empties the card and the "None in your inventory" branch
  // removes the button no matter what the row filter does -- which is the shape
  // this test had first, and it proved nothing.
  const { page, ctx } = await stockTab({ cans: 1, rudolph: 5 });
  const before = await cansCard(page);
  assert.strictEqual(before.useButtons, 2, JSON.stringify(before));
  await page.evaluate(id => document.querySelector('[data-use-id="' + id + '"]').click(), GOOSE);
  await page.waitForTimeout(1200);
  const c = await cansCard(page);
  assert.strictEqual(c.useButtons, 1, "still offering a can that is gone: " + JSON.stringify(c));
  assert.ok(!/Goose Juice/.test(c.rows.join(" | ")), "empty row kept: " + c.rows.join(" | "));
  assert.ok(/Rudolph ×5/.test(c.rows.join(" | ")), "lost the drink still held: " + c.rows.join(" | "));
  await ctx.close();
});

await b.close();
console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
