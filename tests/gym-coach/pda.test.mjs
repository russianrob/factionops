// The Settings tab used to claim "Host: Torn PDA" on every platform -- the row
// was a hardcoded string with no check behind it, alongside instructions to
// leave the PDA key placeholder in and a note that pings use PDA
// notifications. All three are wrong in a desktop browser, and the last one is
// why a desktop user never sees a notification however long they wait.
import fs from "fs";
import assert from "assert";
const { chromium } = await import("/root/.hermes/hermes-agent/node_modules/playwright-core/index.mjs");
const html = fs.readFileSync("harness/index.html", "utf8");
const script = fs.readFileSync("harness/gym-coach-beta.user.js", "utf8");
const b = await chromium.launch({ args: ["--no-sandbox"] });

async function settings({ pda, host }) {
  const ctx = await b.newContext({ viewport: { width: 393, height: 1600 } });
  const page = await ctx.newPage();
  await page.route("**/*", r => {
    const u = r.request().url();
    if (u.includes("gym-coach-beta.user.js")) return r.fulfill({ contentType: "application/javascript", body: script });
    if (/gym\.php/.test(u)) return r.fulfill({ contentType: "text/html", body: html });
    return r.fulfill({ status: 204, body: "" });
  });
  const cfg = { energy: 100, energyMax: 150, fulltime: 1500, drug: 4000, booster: 60000,
    xan: 85, cans: 21, happy: 4300, happyMax: 5000, gym: 24,
    stats: { str: 150422278, def: 104614286, spe: 150464114, dex: 146009 },
    ...(pda ? {} : { noPda: true }),
    ...(host ? { host } : {}),
    mem: { gcb_v1_mode: "xan", gcb_v1_focus: "str" } };
  await page.goto("https://www.torn.com/gym.php?cfg=" + encodeURIComponent(JSON.stringify(cfg)),
    { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1600);
  await page.evaluate(() => document.querySelector('#gcb-panel [data-tab="set"]').click());
  await page.waitForTimeout(400);
  const out = await page.evaluate(() => {
    const c = [...document.querySelectorAll("#gcb-panel .gc-card")]
      .find(x => x.querySelector("h3") && /^API$/i.test(x.querySelector("h3").textContent.trim()));
    return c ? c.innerText.replace(/\n+/g, " | ") : "";
  });
  await ctx.close();
  return out;
}

let pass = 0, fail = 0;
const t = async (n, f) => { try { await f(); pass++; console.log("ok   " + n); } catch (e) { fail++; console.log("FAIL " + n + " :: " + e.message); } };

await t("a desktop browser is not reported as Torn PDA", async () => {
  const r = await settings({ pda: false });
  assert.ok(!/Host \| Torn PDA/.test(r), "claimed to be running under PDA: " + r);
});

await t("it does not tell a desktop user to leave a PDA placeholder alone", async () => {
  const r = await settings({ pda: false });
  assert.ok(!/PDA API-key placeholder/.test(r), "gave PDA key instructions on desktop: " + r);
});

await t("it says plainly that pings need PDA rather than promising them", async () => {
  // The honest answer to "I never get notifications so I can't test it".
  const r = await settings({ pda: false });
  assert.ok(!/Pings use Torn PDA notifications and open the gym/.test(r),
    "promised notifications a browser cannot deliver: " + r);
  assert.match(r, /Torn PDA/, "should still explain that pings need the app: " + r);
});

await t("under Torn PDA the PDA wording is kept", async () => {
  const r = await settings({ pda: true });
  assert.match(r, /Host \| Torn PDA/, r);
});

await t("warboard is named as itself, not as PDA or a plain browser", async () => {
  // It answers PDA's notification protocol under its own name, so it is
  // neither -- and calling it PDA is what broke FactionOps.
  const r = await settings({ pda: false, host: "warboard" });
  assert.match(r, /Host \| warboard/i, r);
});

await t("warboard is told pings DO work, unlike a plain browser", async () => {
  const wb = await settings({ pda: false, host: "warboard" });
  assert.ok(!/none will arrive/.test(wb), "told warboard its pings go nowhere: " + wb);
  const browser = await settings({ pda: false });
  assert.match(browser, /none will arrive/, browser);
});

console.log("\n" + pass + " passed, " + fail + " failed");
await b.close();
process.exit(fail ? 1 : 0);
