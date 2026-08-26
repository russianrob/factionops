// Drives the real page. The unit tests call unlockScan/unlockEstimate directly,
// so every one of them stays green even if nothing ever calls them or the
// answer never reaches a card — which is exactly how a feature ships dead.
import fs from "fs";
import assert from "assert";
const { chromium } = await import("/root/.hermes/hermes-agent/node_modules/playwright-core/index.mjs");
const html = fs.readFileSync("harness/index.html", "utf8");
const script = fs.readFileSync("harness/gym-coach-beta.user.js", "utf8");
const b = await chromium.launch({ args: ["--no-sandbox"] });

async function panel({ owned = 24, pct, gym = 18, jobPerks = null, seedUnlock = null }) {
  const ctx = await b.newContext({ viewport: { width: 393, height: 1400 } });
  const page = await ctx.newPage();
  await page.route("**/*", r => {
    const u = r.request().url();
    if (u.includes("gym-coach-beta.user.js")) return r.fulfill({ contentType: "application/javascript", body: script });
    if (/gym\.php/.test(u)) return r.fulfill({ contentType: "text/html", body: html });
    return r.fulfill({ status: 204, body: "" });
  });
  const cfg = {
    energy: 150, energyMax: 150, fulltime: 0, drug: 4000, booster: 60000,
    xan: 85, cans: 21, happy: 4300, happyMax: 5000, gym, owned,
    ...(pct === undefined ? {} : { pct }),
    ...(jobPerks ? { jobPerks } : {}),
    stats: { str: 150422278, def: 104614286, spe: 150464114, dex: 146009 },
    mem: Object.assign({ gcb_v1_mode: "xan", gcb_v1_focus: "str" },
      seedUnlock ? { gcb_v1_unlock: JSON.stringify(seedUnlock) } : {}),
  };
  await page.goto("https://www.torn.com/gym.php?cfg=" + encodeURIComponent(JSON.stringify(cfg)),
    { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2200);              // the gym scan polls at 700ms
  await page.evaluate(() => document.querySelector('#gcb-panel [data-tab="trend"]').click());
  await page.waitForTimeout(400);
  const out = await page.evaluate(() => {
    const p = document.getElementById("gcb-panel");
    const card = [...p.querySelectorAll(".gc-card")]
      .find(c => c.querySelector("h3") && /unlock/i.test(c.querySelector("h3").textContent));
    return {
      card: card ? card.innerText.replace(/\n+/g, " | ") : "",
      stored: JSON.parse(localStorage.getItem("gcb_v1_unlock") || "null"),
    };
  });
  await ctx.close();
  return out;
}

let pass = 0, fail = 0;
const t = async (n, f) => { try { await f(); pass++; console.log("ok   " + n); } catch (e) { fail++; console.log("FAIL " + n + " :: " + e.message); } };

// The energy still to train, off the "X-Ye still to train" line — NOT the first
// number on the card, which is the segment total and is identical at every
// percentage.
const remaining = card => {
  const m = card.match(/([\d,]+)[-\u2013]([\d,]+)e still to train/);
  return m ? Number(m[2].replace(/,/g, "")) : null;
};

await t("the page scan reaches a card and names the gym being unlocked", async () => {
  // 18 owned, so gym 19 is next: Force Training. Its segment is the value on
  // GUN SHOP's wiki row (36,610) — each row is the climb OUT of that gym, so
  // the 46,640 on Force Training's own row is the segment after this one.
  const r = await panel({ owned: 18, pct: 0, gym: 18 });
  assert.ok(r.card, "no unlock card was rendered");
  assert.match(r.card, /Force Training/);
});

await t("it reports the energy still to train", async () => {
  const r = await panel({ owned: 18, pct: 0, gym: 18 });
  assert.strictEqual(remaining(r.card), 36610, r.card);
});

await t("part way through, it counts down rather than up", async () => {
  const full = await panel({ owned: 18, pct: 0, gym: 18 });
  const half = await panel({ owned: 18, pct: 50, gym: 18 });
  assert.strictEqual(remaining(full.card), 36610, full.card);
  assert.ok(remaining(half.card) < remaining(full.card) * 0.55,
    "half way read " + remaining(half.card) + " against " + remaining(full.card));
});

await t("the reading is persisted, so the answer survives leaving gym.php", async () => {
  const r = await panel({ owned: 18, pct: 37, gym: 18 });
  assert.ok(r.stored && r.stored.gymId === 19, "stored: " + JSON.stringify(r.stored));
  assert.strictEqual(r.stored.pct, 37);
});

await t("the Music Store perk shows through to the figure", async () => {
  const plain = await panel({ owned: 18, pct: 0, gym: 18 });
  const perked = await panel({ owned: 18, pct: 0, gym: 18, jobPerks: ["30% gym experience"] });
  assert.strictEqual(remaining(perked.card), 28162, perked.card);   // 36,610 / 1.3
  assert.ok(!/36,610/.test(perked.card), "still quoting the unperked figure");
  assert.strictEqual(remaining(plain.card), 36610);
});

await t("a reading left over from a gym you have since bought is dropped", async () => {
  // The stored percentage belongs to a segment that is over. Torn paints no bar
  // for it any more, so nothing overwrites the reading -- it has to be judged
  // stale against the owned set, or the card counts down to a gym you own.
  const r = await panel({ owned: 19, gym: 19, seedUnlock: { gymId: 19, pct: 37, t: Date.now() } });
  assert.ok(!/Force Training/.test(r.card),
    "counted down to a gym already owned: " + r.card);
});

await t("with every standard gym unlocked it says so instead of going quiet", async () => {
  // Torn stops painting a percentage once George's is yours and no further gym
  // exp is earned. An empty card would read as "the script is broken"; the
  // reason the number is missing is itself the answer.
  const r = await panel({ owned: 24, gym: 24 });
  assert.ok(r.card, "no card at all -- indistinguishable from a failed scan");
  assert.match(r.card, /stat ratios/i, r.card);
  assert.ok(!/still to train/.test(r.card), "quoted a countdown with nothing left: " + r.card);
});

console.log("\n" + pass + " passed, " + fail + " failed");
await b.close();
process.exit(fail ? 1 : 0);
