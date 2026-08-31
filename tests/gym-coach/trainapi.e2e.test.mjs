// Drives the real page: the log has to be fetched, parsed and reach the card.
// The unit tests call trainLogByDay/trainedToday directly and stay green even
// if nothing ever calls them.
import fs from "fs";
import assert from "assert";
const { chromium } = await import("/root/.hermes/hermes-agent/node_modules/playwright-core/index.mjs");
const html = fs.readFileSync("harness/index.html", "utf8");
const script = fs.readFileSync("harness/gym-coach-beta.user.js", "utf8");
const b = await chromium.launch({ args: ["--no-sandbox"] });

const nowSec = Math.floor(Date.now() / 1000);
// The ledger's day is a UTC day, so a fixture written as "an hour ago" walks
// into YESTERDAY whenever the suite runs just after UTC midnight -- and then
// asserts a total that is unreachable. Caught at 00:12 UTC, having failed
// consistently rather than flakily, which is what gave it away.
//
// Pin sessions inside today: `off` seconds ago, but never earlier than the
// start of the UTC day.
const dayStart = Math.floor(nowSec / 86400) * 86400;
const ago = off => Math.max(dayStart + 60, nowSec - off);

async function card({ trainLog, ledger, failLog }) {
  const ctx = await b.newContext({ viewport: { width: 393, height: 1400 } });
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
    ...(trainLog ? { trainLog } : {}),
    ...(failLog ? { trainLogFail: true } : {}),
    mem: { gcb_v1_mode: "xan", gcb_v1_focus: "str",
           ...(ledger ? { gcb_v1_ledger: JSON.stringify(ledger) } : {}) },
  };
  const asked = [];
  page.on("request", q => { const m = /[?&]log=(\d+)/.exec(q.url()); if (m) asked.push(m[1]); });
  await page.goto("https://www.torn.com/gym.php?cfg=" + encodeURIComponent(JSON.stringify(cfg)),
    { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2200);
  const out = await page.evaluate(() => {
    const p = document.getElementById("gcb-panel");
    const c = [...p.querySelectorAll(".gc-card")]
      .find(x => x.querySelector("h3") && /used vs missed/i.test(x.querySelector("h3").textContent));
    const txt = c ? c.innerText.replace(/\n+/g, " | ") : "";
    const m = txt.match(/Spent today \| ([\d,]+)e/);
    return { text: txt, spent: m ? Number(m[1].replace(/,/g, "")) : null };
  });
  await ctx.close();
  return Object.assign(out, { asked });
}

let pass = 0, fail = 0;
const t = async (n, f) => { try { await f(); pass++; console.log("ok   " + n); } catch (e) { fail++; console.log("FAIL " + n + " :: " + e.message); } };

await t("Spent today comes from Torn's log, not the bar", async () => {
  // Three sessions today. The bar in this fixture never moved, so a
  // bar-derived figure would read 0.
  const r = await card({ trainLog: [[ago(600), 150], [ago(1800), 280], [ago(3600), 300]] });
  assert.strictEqual(r.spent, 730, r.text);
});

await t("yesterday's sessions are not counted as today's", async () => {
  // The UTC boundary that made the reported figure look wrong in the first
  // place: a 7:35pm EDT session belongs to the previous day.
  const r = await card({ trainLog: [[ago(600), 150], [nowSec - 40 * 3600, 900]] });
  assert.strictEqual(r.spent, 150, r.text);
});

await t("a failed log call falls back to the bar and says so", async () => {
  // A failed round is no news, not zero training -- it must leave the ledger
  // figure standing, and label it so the number is not mistaken for Torn's.
  const today = Math.floor(Date.now() / 86400000);
  const r = await card({ failLog: true, ledger: [{ d: today, used: 421, wasted: 0 }] });
  assert.match(r.text, /from the bar/, r.text);
  assert.strictEqual(r.spent, 421, r.text);
});

await t("a log that records nothing today reads zero, not the bar's guess", async () => {
  const today = Math.floor(Date.now() / 86400000);
  const r = await card({ trainLog: [[nowSec - 40 * 3600, 900]],
                         ledger: [{ d: today, used: 421, wasted: 0 }] });
  assert.strictEqual(r.spent, 0, r.text);
  assert.ok(!/from the bar/.test(r.text), "still labelled as a bar reading: " + r.text);
});

await t("all four stat logs are requested, not just Strength", async () => {
  // Torn splits training across 5300-5303. Asking only for Strength would
  // silently drop every Speed, Defense and Dexterity session -- and the figure
  // would look plausible the whole time.
  const r = await card({ trainLog: [[ago(600), 150]] });
  assert.deepStrictEqual([...new Set(r.asked)].sort(), ["5300", "5301", "5302", "5303"],
    "requested: " + JSON.stringify(r.asked));
});

console.log("\n" + pass + " passed, " + fail + " failed");
await b.close();
process.exit(fail ? 1 : 0);
