// War stack is the mode where the coach itself says "Leave energy alone. Don't
// train." Everything that reports a full bar as a LOSS contradicts that
// instruction, so this drives the real card rather than the maths underneath.
import fs from "fs";
import assert from "assert";
const { chromium } = await import("/root/.hermes/hermes-agent/node_modules/playwright-core/index.mjs");
const html = fs.readFileSync("harness/index.html", "utf8");
const script = fs.readFileSync("harness/gym-coach-beta.user.js", "utf8");
const b = await chromium.launch({ args: ["--no-sandbox"] });

// A bar that has been sitting full for six hours, with the ledger already
// holding a day's worth of cap time behind it.
async function card({ stack, energy = 150, drug = 4000, xan = 85, tab = null }) {
  const ctx = await b.newContext({ viewport: { width: 393, height: 1400 } });
  const page = await ctx.newPage();
  await page.route("**/*", r => {
    const u = r.request().url();
    if (u.includes("gym-coach-beta.user.js")) return r.fulfill({ contentType: "application/javascript", body: script });
    if (/gym\.php/.test(u)) return r.fulfill({ contentType: "text/html", body: html });
    return r.fulfill({ status: 204, body: "" });
  });
  const now = Date.now();
  const sixHours = now - 6 * 3600e3;
  const cfg = {
    energy, energyMax: 150, fulltime: 0, drug, booster: 60000,
    xan, cans: 21, happy: 4300, happyMax: 5000, gym: 24,
    stats: { str: 150422278, def: 104614286, spe: 150464114, dex: 146009 },
    mem: {
      gcb_v1_mode: "xan",
      gcb_v1_focus: "str",
      gcb_v1_warStack: stack ? "1" : "0",
      gcb_v1_lastSeen: JSON.stringify({ e: 150, t: sixHours, capSince: sixHours, fullAt: sixHours }),
    },
  };
  await page.goto("https://www.torn.com/gym.php?cfg=" + encodeURIComponent(JSON.stringify(cfg)),
    { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1200);
  if (tab) {
    await page.evaluate(t => document.querySelector('#gcb-panel [data-tab="' + t + '"]').click(), tab);
    await page.waitForTimeout(350);
  }
  const out = await page.evaluate(() => {
    const p = document.getElementById("gcb-panel");
    const c = [...p.querySelectorAll(".gc-card")]
      .find(x => x.querySelector("h3") && /used vs missed|full bar|energy/i.test(x.querySelector("h3").textContent));
    const all = (p.innerText || "").replace(/\n+/g, " | ");
    const m = all.match(/Missed today \| ([\d,]+)e/);
    return { card: c ? c.innerText.replace(/\n+/g, " | ") : "", all,
             missedToday: m ? Number(m[1].replace(/,/g, "")) : null };
  });
  await ctx.close();
  return out;
}

let pass = 0, fail = 0;
const t = async (n, f) => { try { await f(); pass++; console.log("ok   " + n); } catch (e) { fail++; console.log("FAIL " + n + " :: " + e.message); } };

await t("war stack off: a six-hour full bar is still reported as a loss", async () => {
  // The existing behaviour, and the right one when nobody told you to hold.
  const r = await card({ stack: false });
  assert.match(r.all, /did not get/, r.all.slice(0, 600));
});

await t("war stack on: holding a full bar is not called regen you did not get", async () => {
  // The contradiction: the coach says "Leave energy alone", then bills you for
  // obeying. Same class as 0.9.12's two-gyms-in-one-verdict.
  const r = await card({ stack: true });
  assert.ok(!/did not get/.test(r.all),
    "still billing a deliberate hold as a loss: " + r.all.slice(0, 600));
});

await t("war stack on: the hold is still reported, and says why it is not waste", async () => {
  // Going silent would be its own bug -- how long the stack has been held is
  // the most useful number on the screen during a war. Dropping the reason
  // would be almost as bad: an unexplained duration reads as a broken counter.
  const r = await card({ stack: true });
  assert.match(r.all, /full for/i, r.all.slice(0, 600));
  assert.match(r.all, /not counted as missed/i, r.all.slice(0, 600));
});

await t("war stack off: the six hours at cap land in the ledger", async () => {
  // Establishes that the fixture really does generate waste, so the assertion
  // below is measuring the fix rather than an empty ledger.
  const r = await card({ stack: false });
  assert.ok(r.missedToday > 100,
    "the fixture booked no waste at all, so the stack test proves nothing: " + r.missedToday);
});

await t("war stack on: nothing reaches the ledger either", async () => {
  // The card headline reads state.warStack directly, so it can look right while
  // the ledger quietly keeps booking -- and the ledger is what feeds
  // calibration().usage and every ETA built on it.
  const r = await card({ stack: true });
  assert.strictEqual(r.missedToday, 0,
    "booked " + r.missedToday + "e against a deliberate hold");
});

// ---- taking a Xanax IS how you stack ---------------------------------------
// The verdict used to read "Do not take a Xanax", which contradicts the whole
// mechanic: a stack is built BY taking them, each one banking 250e above the
// cap where regen is paused and nothing is lost.

await t("stacking with the cooldown clear tells you to take one", async () => {
  const r = await card({ stack: true, energy: 150, drug: 0, xan: 85 });
  assert.ok(!/Do not take a Xanax/i.test(r.all), "still telling you not to: " + r.all.slice(0, 500));
  assert.match(r.all, /Take a Xanax/i, r.all.slice(0, 600));
});

await t("the headline never argues with the step about the Xanax", async () => {
  // 0.9.12's lesson: a verdict that contradicts itself is worse than no
  // verdict. "War stack. Hold energy." sitting directly above a step reading
  // "Take a Xanax." is the same failure in a different card.
  const take = await card({ stack: true, energy: 150, drug: 0, xan: 85 });
  assert.match(take.all, /War stack\. Take a Xanax\./,
    "the step advises a Xanax but the headline says otherwise: " + take.all.slice(0, 500));

  const hold = await card({ stack: true, energy: 150, drug: 4000, xan: 85 });
  assert.match(hold.all, /War stack\. Hold energy\./,
    "the headline advises a Xanax the step will not: " + hold.all.slice(0, 500));
});

await t("it still says not to train while stacking", async () => {
  // Only the Xanax half was wrong. Training spends the stack you are building.
  const r = await card({ stack: true, energy: 150, drug: 0, xan: 85 });
  assert.match(r.all, /train/i, r.all.slice(0, 600));
});

await t("on drug cooldown it says hold, not take one", async () => {
  const r = await card({ stack: true, energy: 150, drug: 4000, xan: 85 });
  assert.ok(!/Take a Xanax/i.test(r.all), "advised a Xanax mid-cooldown: " + r.all.slice(0, 500));
  assert.match(r.all, /hold/i, r.all.slice(0, 600));
});

await t("with none in the inventory it does not advise one", async () => {
  const r = await card({ stack: true, energy: 150, drug: 0, xan: 0 });
  assert.ok(!/Take a Xanax/i.test(r.all), "advised a Xanax you do not have: " + r.all.slice(0, 500));
});

await t("near the ceiling it stops advising more", async () => {
  // The script models 1,000e as the stack ceiling (afterXan clamps to it), so a
  // Xanax at 800 would throw away most of its 250e.
  const r = await card({ stack: true, energy: 800, drug: 0, xan: 85 });
  assert.ok(!/Take a Xanax/i.test(r.all), "advised a Xanax that would overflow: " + r.all.slice(0, 500));
});

await t("the Stock tab reads USE while stacking, not BUY", async () => {
  const r = await card({ stack: true, energy: 150, drug: 0, xan: 85, tab: "stock" });
  // "Xanax x85 | <effects> | USE" -- anchored on the row, not on the word,
  // because the verdict above it now mentions Xanax too.
  assert.match(r.all, /Xanax \u00d7\d+ \| [^|]*\| USE/, r.all.slice(0, 1200));
});

console.log("\n" + pass + " passed, " + fail + " failed");
await b.close();
process.exit(fail ? 1 : 0);
