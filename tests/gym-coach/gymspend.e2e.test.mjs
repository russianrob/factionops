// A bar drop on gym.php, end to end.
//
// sincedrift.test.mjs proves gymSpend's arithmetic. This proves it is WIRED:
// that a real drop still reaches "Spent today", and that the sub-train wobble
// which used to inflate it no longer does. The unit suite cannot see either --
// the decision happens inside ledgerObserve, against live bar readings.
import fs from "fs";
import assert from "assert";
const { chromium } = await import("/root/.hermes/hermes-agent/node_modules/playwright-core/index.mjs");
const html = fs.readFileSync("harness/index.html", "utf8");
const script = fs.readFileSync("harness/gym-coach-beta.user.js", "utf8");
const b = await chromium.launch({ args: ["--no-sandbox"] });
const page = await b.newPage({ viewport: { width: 393, height: 1400 } });
const errors = [];
page.on("pageerror", e => errors.push(String(e.message)));
await page.route("**/*", r => {
  const u = r.request().url();
  if (u.includes("gym-coach-beta.user.js")) return r.fulfill({ contentType: "application/javascript", body: script });
  if (/gym\.php/.test(u)) return r.fulfill({ contentType: "text/html", body: html });
  return r.fulfill({ status: 204, body: "" });
});

// gym 24 is George's, which charges 10 energy a train -- the gym in the report.
async function load(extra) {
  errors.length = 0;
  const cfg = Object.assign({
    energy: 150, energyMax: 150, fulltime: 0, gym: 24, playerId: 2598755,
    stats: { str: 614000000, def: 12000000, spe: 9000000, dex: 8000000 },
    mem: { gcb_v1_verdictFold: 1 }
  }, extra || {});
  await page.goto("https://www.torn.com/gym.php", { waitUntil: "domcontentloaded" });
  await page.evaluate(() => localStorage.clear());
  await page.goto("https://www.torn.com/gym.php?cfg=" + encodeURIComponent(JSON.stringify(cfg)),
                  { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1200);
}
async function settle() {
  await page.waitForTimeout(2000);
  await page.evaluate(() => document.querySelector('[data-act="refresh"]').click());
  await page.waitForTimeout(2500);
}
const cardText = () => page.evaluate(() => {
  const el = document.querySelector("#gcb-panel .gc-body");
  return el ? el.innerText.replace(/\s+/g, " ").trim().slice(0, 400) : "";
});
const spentToday = () => page.evaluate(() => {
  const rows = [...document.querySelectorAll("#gcb-panel .gc-card .row")];
  const r = rows.filter(x => /Spent today/i.test(x.textContent))[0];
  if (!r) return null;
  const m = /([\d,]+)e/.exec(r.querySelector("b") ? r.querySelector("b").textContent : "");
  return m ? Number(m[1].replace(/,/g, "")) : null;
});

let pass = 0, fail = 0;
const t = async (n, f) => {
  try { await f(); assert.deepStrictEqual(errors, [], "page errors: " + errors.join(" | ")); pass++; console.log("ok   " + n); }
  catch (e) { fail++; console.log("FAIL " + n + " :: " + e.message); }
};

await t("a real train reaches Spent today", async () => {
  // The guard must not be so tight that it stops recording training at all --
  // which is the failure mode a whole-units rule risks.
  await load({ energy: 150, energyAfter: 140, energyAfterMs: 1500 });
  await settle();
  assert.strictEqual(await spentToday(), 10, await cardText());
});

await t("three trains in one gap reach it too", async () => {
  await load({ energy: 150, energyAfter: 120, energyAfterMs: 1500 });
  await settle();
  assert.strictEqual(await spentToday(), 30, await cardText());
});

await t("a sub-train wobble does NOT -- this is the reported bug", async () => {
  // One point of disagreement between the API bar and the DOM bar, on a page
  // being reloaded all evening, was booked as one energy trained every time.
  // 367e against 340e actually trained, on a gym that charges 10 a train.
  await load({ energy: 150, energyAfter: 149, energyAfterMs: 1500 });
  await settle();
  assert.strictEqual(await spentToday(), 0, "a one-energy wobble was counted as training");
});

await t("and the noise riding along with a real train is dropped", async () => {
  await load({ energy: 150, energyAfter: 123, energyAfterMs: 1500 });
  await settle();
  assert.strictEqual(await spentToday(), 20, "27 is two trains and seven of noise, not 27 trained");
});

await b.close();
console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
