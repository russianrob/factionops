// The per-stat split, end to end.
//
// calmixed.test.mjs proves the arithmetic. This proves it is WIRED: that
// fetchTrainLog keeps the breakdown at all, and that it survives into the
// stored copy. The unit suite cannot see either -- both happen inside the
// fetch round.
//
// The fixture deliberately serves Torn's wording under the WRONG log ids:
// defense rows come back under 5300 and strength under 5301. Anything that
// secretly keyed the stat off request order would pass every tidy fixture and
// be wrong against the real API.
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

const DAY = 86400000;
const TODAY = Math.floor(Date.now() / DAY);
const noon = d => Math.floor((d * DAY) / 1000) + 43200;

async function load(rows) {
  errors.length = 0;
  const cfg = { energy: 100, energyMax: 150, gym: 24, playerId: 2598755, keyLevel: 4,
                stats: { str: 614000000, def: 12000000, spe: 9000000, dex: 8000000 },
                trainLogRows: rows, mem: { gcb_v1_verdictFold: 1 } };
  await page.goto("https://www.torn.com/gym.php", { waitUntil: "domcontentloaded" });
  await page.evaluate(() => localStorage.clear());
  await page.goto("https://www.torn.com/gym.php?cfg=" + encodeURIComponent(JSON.stringify(cfg)),
                  { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => {
    var raw = localStorage.getItem("gcb_v1_trainLog");
    if (!raw) return false;
    try { var t = JSON.parse(raw); return !!t.byDayStat && Object.keys(t.byDayStat).length > 0; }
    catch (e) { return false; }
  }, null, { timeout: 30000 });
}

// One throwaway load before the assertions start. The first navigation in a
// cold browser is markedly slower than the rest, and it was landing on the
// first test in the file rather than on anything real.
await page.goto("https://www.torn.com/gym.php", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1500);
const stored = () => page.evaluate(() => {
  const raw = localStorage.getItem("gcb_v1_trainLog");
  if (!raw) return null;
  try { return JSON.parse(raw); } catch (e) { return { unparseable: raw }; }
});

let pass = 0, fail = 0;
const t = async (n, f) => {
  try { await f(); assert.deepStrictEqual(errors, [], "page errors: " + errors.join(" | ")); pass++; console.log("ok   " + n); }
  catch (e) { fail++; console.log("FAIL " + n + " :: " + e.message); }
};

await t("a fetched log round keeps the per-stat split, not just the daily total", async () => {
  await load([[5300, "Gym train strength", noon(TODAY - 1), 400]]);
  const tl = await stored();
  assert.ok(tl, "no train log was stored at all");
  assert.ok(tl.byDayStat, "byDayStat is missing -- calibration has nothing to split a mixed day with");
  assert.deepStrictEqual(tl.byDayStat[TODAY - 1], { str: 400 }, "TODAY=" + TODAY + " got " + JSON.stringify(tl.byDayStat));
  assert.strictEqual(tl.byDay[TODAY - 1], 400, "the daily total must still be there too");
});

await t("a mixed day is split the way Torn worded it, not the order it was asked for", async () => {
  // Scrambled on purpose: defense under 5300, strength under 5301.
  await load([
    [5300, "Gym train defense", noon(TODAY - 1), 250],
    [5301, "Gym train strength", noon(TODAY - 1), 150]
  ]);
  const tl = await stored();
  assert.deepStrictEqual(tl.byDayStat[TODAY - 1], { def: 250, str: 150 },
    "the stat was taken from the log id rather than from Torn's wording");
  assert.strictEqual(tl.byDay[TODAY - 1], 400);
});

await t("all four stats come through", async () => {
  await load([
    [5300, "Gym train strength", noon(TODAY - 1), 10],
    [5301, "Gym train defense", noon(TODAY - 1), 20],
    [5302, "Gym train speed", noon(TODAY - 1), 30],
    [5303, "Gym train dexterity", noon(TODAY - 1), 40]
  ]);
  const tl = await stored();
  assert.deepStrictEqual(tl.byDayStat[TODAY - 1], { str: 10, def: 20, spe: 30, dex: 40 });
});

await t("days are kept apart in the stored split", async () => {
  await load([
    [5300, "Gym train strength", noon(TODAY - 1), 100],
    [5300, "Gym train strength", noon(TODAY - 2), 300]
  ]);
  const tl = await stored();
  assert.deepStrictEqual(tl.byDayStat[TODAY - 1], { str: 100 });
  assert.deepStrictEqual(tl.byDayStat[TODAY - 2], { str: 300 });
});

await b.close();
console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
