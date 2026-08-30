// The card has to actually READ the log. The unit tests pass whether or not
// anything ever calls the parser.
import fs from "fs";
import assert from "assert";
const { chromium } = await import("/root/.hermes/hermes-agent/node_modules/playwright-core/index.mjs");
const html = fs.readFileSync("harness/index.html", "utf8");
const script = fs.readFileSync("harness/gym-coach-beta.user.js", "utf8");
const b = await chromium.launch({ args: ["--no-sandbox"] });
const DAY = 86400000, today = Math.floor(Date.now() / DAY);

async function card({ attacks = 0, attacksErr = false, ledgerOff = 0, attacksOld = 0 }) {
  const ctx = await b.newContext({ viewport: { width: 393, height: 1400 } });
  const p = await ctx.newPage();
  await p.route("**/*", r => {
    const u = r.request().url();
    if (u.includes("gym-coach-beta.user.js")) return r.fulfill({ contentType: "application/javascript", body: script });
    if (/gym\.php/.test(u)) return r.fulfill({ contentType: "text/html", body: html });
    return r.fulfill({ status: 204, body: "" });
  });
  const cfg = { energy: 100, energyMax: 150, fulltime: 1500, drug: 4000, booster: 60000,
    xan: 85, cans: 21, happy: 4300, happyMax: 5000, gym: 24, noPda: true,
    attacks, attacksErr, attacksOld,
    stats: { str: 614000000, def: 12000000, spe: 9000000, dex: 8000000 },
    mem: { gcb_v1_mode: "xan", gcb_v1_focus: "str",
           gcb_v1_ledger: JSON.stringify([{ d: today, used: 300, wasted: 0, off: ledgerOff }]) } };
  await p.goto("https://www.torn.com/gym.php?cfg=" + encodeURIComponent(JSON.stringify(cfg)), { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(2600);
  const txt = await p.evaluate(() => {
    const c = [...document.querySelectorAll(".gc-card")]
      .find(x => x.querySelector("h3") && /used vs missed/i.test(x.querySelector("h3").textContent));
    return c ? c.innerText.replace(/\n+/g, " | ") : "";
  });
  await ctx.close();
  return txt;
}

let pass = 0, fail = 0;
const t = async (n, f) => { try { await f(); pass++; console.log("ok   " + n); } catch (e) { fail++; console.log("FAIL " + n + " :: " + e.message); } };

await t("the figure comes from the attack log, and says how many hits", async () => {
  const txt = await card({ attacks: 18, ledgerOff: 449 });
  assert.match(txt, /Spent attacking \| 450e \| · 18 hits/, txt);
  assert.ok(!/from the bar/.test(txt), "still labelled a bar reading: " + txt);
});

await t("the log beats the bar even when the bar disagrees", async () => {
  // 449e is the impossible figure that started this: not a whole number of
  // attacks, and inflated by a second device's catch-up.
  const txt = await card({ attacks: 4, ledgerOff: 449 });
  assert.match(txt, /Spent attacking \| 100e/, txt);
});

await t("no attacks today shows no line at all, rather than the bar's guess", async () => {
  const txt = await card({ attacks: 0, ledgerOff: 449 });
  assert.ok(!/Spent attacking/.test(txt), "showed a figure for a day with no attacks: " + txt);
});

await t("yesterday's hits stay in yesterday even if the API hands them over", async () => {
  // The window is requested with `from`, but it is enforced again where the
  // counting happens. Only enforcing it in the request would mean any change
  // to that parameter silently swallowed the previous day.
  const txt = await card({ attacks: 3, attacksOld: 9 });
  assert.match(txt, /Spent attacking \| 75e \| · 3 hits/, txt);
});

await t("a key that cannot read the log falls back and says so", async () => {
  const txt = await card({ attacksErr: true, ledgerOff: 450 });
  assert.match(txt, /Spent attacking \| 450e \| · from the bar/, txt);
});

console.log("\n" + pass + " passed, " + fail + " failed");
await b.close();
process.exit(fail ? 1 : 0);
