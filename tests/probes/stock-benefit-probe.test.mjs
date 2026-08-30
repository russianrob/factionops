// The probe exists to answer one question, so it had better parse the real
// shapes. Stubs both endpoints from Torn's published schema.
import fs from "fs";
import assert from "assert";
const { chromium } = await import("/root/.hermes/hermes-agent/node_modules/playwright-core/index.mjs");
const script = fs.readFileSync("torn-stock-benefit-probe.user.js", "utf8");
const b = await chromium.launch({ args: ["--no-sandbox"] });

const CATALOG = { stocks: [
  { id: 1, name: "Torn City Stock Exchange", acronym: "TCSE",
    bonus: { passive: true, frequency: 0, requirement: 1000000, description: "Passive dividend" } },
  { id: 25, name: "Mc Smoogle Corp", acronym: "MCS",
    bonus: { passive: false, frequency: 7, requirement: 3000000, description: "One free 100 energy refill every 7 days" } },
  { id: 30, name: "Feathery Hotels Group", acronym: "FHG",
    bonus: { passive: false, frequency: 7, requirement: 2000000, description: "1x Feathery Hotel Coupon" } },
]};

async function run({ catalog = CATALOG, held, key = "abcdefghij123456", userErr = null }) {
  const ctx = await b.newContext();
  const p = await ctx.newPage();
  await p.route("**/*", r => {
    const u = r.request().url();
    if (/v2\/torn\/stocks/.test(u)) return r.fulfill({ contentType: "application/json", body: JSON.stringify(catalog) });
    if (/v2\/user\/stocks/.test(u)) return r.fulfill({ contentType: "application/json",
      body: JSON.stringify(userErr || { stocks: held }) });
    if (/torn\.com\/gym\.php/.test(u)) return r.fulfill({ contentType: "text/html", body: "<html><body></body></html>" });
    return r.fulfill({ status: 204, body: "" });
  });
  await p.addInitScript(k => {
    window.GM_getValue = (n, d) => (n === "gcb_v1_api_key" ? k : d);
    window.GM_setClipboard = () => {};
  }, key);
  // The userscript itself -- without this the page is just an empty document
  // and every assertion fails on a missing panel rather than on its contents.
  await p.addInitScript({ content: script });
  await p.goto("https://www.torn.com/gym.php", { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(1200);
  const txt = await p.evaluate(() => {
    const pre = document.querySelector("pre");
    return pre ? pre.textContent : null;
  });
  await ctx.close();
  return txt;
}

let pass = 0, fail = 0;
const t = async (n, f) => { try { await f(); pass++; console.log("ok   " + n); } catch (e) { fail++; console.log("FAIL " + n + " :: " + e.message); } };

await t("finds the energy stock by its description, not a hardcoded id", async () => {
  const txt = await run({ held: [{ id: 25, shares: 3000000, bonus: { available: true, increment: 1, progress: 7, frequency: 7 } }] });
  assert.match(txt, /ENERGY BENEFIT :: id 25 MCS/);
  assert.ok(!/ENERGY BENEFIT :: id 30/.test(txt), "the hotel coupon is not an energy benefit");
});

await t("says plainly when the claim is waiting", async () => {
  const txt = await run({ held: [{ id: 25, shares: 3000000, bonus: { available: true, increment: 1, progress: 7, frequency: 7 } }] });
  assert.match(txt, /VERDICT :: energy stock 25 \(MCS\) IS held, 3,000,000 shares, 1 increment\(s\), and this week's claim is WAITING NOW/);
});

await t("says plainly when it is not ready yet", async () => {
  const txt = await run({ held: [{ id: 25, shares: 3000000, bonus: { available: false, increment: 1, progress: 3, frequency: 7 } }] });
  assert.match(txt, /claim is not ready \(progress 3\/7\)/);
});

await t("reports a stock that is not held at all", async () => {
  const txt = await run({ held: [{ id: 30, shares: 2000000, bonus: { available: true, increment: 1, progress: 7, frequency: 7 } }] });
  assert.match(txt, /energy stock 25 \(MCS\) is NOT held/);
});

await t("falls back to listing every claimable benefit if the wording changed", async () => {
  const cat = JSON.parse(JSON.stringify(CATALOG));
  cat.stocks[1].bonus.description = "One free Big Smoogle Meal every 7 days";
  const txt = await run({ catalog: cat, held: [] });
  assert.match(txt, /NONE matched/);
  assert.match(txt, /CLAIMABLE :: id 25 MCS/, "the answer must still be on screen");
  assert.match(txt, /CLAIMABLE :: id 30 FHG/);
});

await t("a key without the access level says which level it needs", async () => {
  const txt = await run({ held: [], userErr: { error: { code: 16, error: "Access level of this key is not high enough" } } });
  assert.match(txt, /HOLDINGS :: FAILED/);
  assert.match(txt, /needs a LIMITED access key/);
});

await t("the key itself never reaches the report", async () => {
  const txt = await run({ held: [], key: "SUPERSECRETKEY99" });
  assert.ok(!txt.includes("SUPERSECRETKEY99"), "the report carries the key");
  assert.match(txt, /\.\.\.EY99 \(16 chars\)/);
});

console.log("\n" + pass + " passed, " + fail + " failed");
await b.close();
process.exit(fail ? 1 : 0);
