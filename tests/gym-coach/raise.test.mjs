import fs from "fs";
import assert from "assert";
const { chromium } = await import("/root/.hermes/hermes-agent/node_modules/playwright-core/index.mjs");
const html = fs.readFileSync("harness/index.html","utf8");
const script = fs.readFileSync("harness/gym-coach-beta.user.js","utf8");
const b = await chromium.launch({ args:["--no-sandbox"] });
const page = await b.newPage({ viewport:{width:393,height:1400} });
await page.route("**/*", r => { const u=r.request().url();
  if (u.includes("gym-coach-beta.user.js")) return r.fulfill({contentType:"application/javascript",body:script});
  if (/gym\.php/.test(u)) return r.fulfill({contentType:"text/html",body:html});
  return r.fulfill({status:204,body:""}); });

async function load(step, order) {
  const cfg = { energy:45, energyMax:150, fulltime:3150, drug:0, booster:60000, xan:85,
    cans:21, happy:4300, happyMax:5000, gym:24,
    stats:{ str:150422278, def:104614286, spe:150464114, dex:146009 },
    mem: { gcb_v1_mode:"xan", gcb_v1_goals:{ str:1e9, def:1e9, spe:1e9 },
           gcb_v1_goalStep: step, gcb_v1_goalOrder: order || [], gcb_v1_histRange: 90 } };
  await page.goto("https://www.torn.com/gym.php?cfg="+encodeURIComponent(JSON.stringify(cfg)),
                  { waitUntil:"domcontentloaded" });
  await page.waitForTimeout(1200);
  await page.evaluate(() => document.querySelector('#gcb-panel [data-tab="plan"]').click());
  await page.waitForTimeout(250);
}
const readTraining = () => page.evaluate(() => {
  const rows = [...document.querySelectorAll("#gcb-panel .gc-card")];
  const goals = rows.find(c => c.querySelector("h3") && c.querySelector("h3").textContent === "Goals");
  const m = /Training now\s*(\w+)/.exec(goals.innerText);
  return { now: m && m[1], stored: JSON.parse(localStorage.getItem("gcb_v1_goalOrder") || "null"),
           raises: [...goals.querySelectorAll("[data-raise]")].map(x => x.dataset.raise) };
});

let pass=0,fail=0;
const t=async(n,f)=>{try{await f();pass++;console.log("ok   "+n);}catch(e){fail++;console.log("FAIL "+n+" :: "+e.message);}};

await t("the schedule starts with the stat that is furthest behind", async () => {
  await load(5e7);
  const r = await readTraining();
  assert.strictEqual(r.now, "Defense", "Defense is 45m behind, so it catches up first");
});

await t("the arrow is offered on every stat except the one already first", async () => {
  await load(5e7);
  const r = await readTraining();
  assert.ok(!r.raises.includes("def"), "no arrow on the stat already leading");
  assert.deepStrictEqual(r.raises.sort(), ["spe","str"]);
});

// The DOM rows are sorted by when each stat starts, so their order IS the
// running order. Reading "Training now" alone is not enough: under a rotation
// the first leg belongs to whichever stat is below the next milestone, which
// is a catch-up and not a priority decision.
const rowOrder = () => page.evaluate(() => {
  const c = [...document.querySelectorAll("#gcb-panel .gc-card")]
    .find(x => x.querySelector("h3") && x.querySelector("h3").textContent === "Goals");
  return [...c.querySelectorAll(".gcb-goal")]
    .filter(el => el.querySelector("input").value)          // stats with a goal
    .map(el => el.querySelector(".gcb-gname").textContent.replace(/[^A-Za-z]/g, ""));
});

await t("tapping the arrow moves that stat ahead of its neighbour", async () => {
  await load(5e7);
  const before = await rowOrder();
  // Defense leads on merit — it is 45m below the next milestone and catching up
  assert.strictEqual(before[0], "Defense");
  const second = before[1], third = before[2];
  await page.evaluate(k => document.querySelector('[data-raise="' + k + '"]').click(),
                      third === "Speed" ? "spe" : "str");
  await page.waitForTimeout(300);
  const after = await rowOrder();
  assert.strictEqual(after[1], third, third + " should have moved ahead of " + second);
  assert.strictEqual(after[2], second);
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("gcb_v1_goalOrder")));
  assert.ok(Array.isArray(stored) && stored.length === 3, "the order must be saved: " + JSON.stringify(stored));
});

await t("a saved order is obeyed on load rather than reverting to shortest-first", async () => {
  await load(5e7, ["str","spe","def"]);
  const a = await rowOrder();
  await load(5e7, ["spe","str","def"]);
  const b = await rowOrder();
  // Defense still leads both times (it is catching up), but the two behind it swap
  assert.strictEqual(a[0], "Defense");
  assert.strictEqual(b[0], "Defense");
  assert.strictEqual(a[1], "Strength");
  assert.strictEqual(b[1], "Speed");
});

await t("turning rotation off returns to one stat at a time", async () => {
  await load(0);
  const r = await readTraining();
  const txt = await page.evaluate(() => {
    const c = [...document.querySelectorAll("#gcb-panel .gc-card")]
      .find(x => x.querySelector("h3") && x.querySelector("h3").textContent === "Goals");
    return c.innerText;
  });
  assert.ok(/One stat at a time/.test(txt), "copy should describe the contiguous plan");
  assert.ok(!/legs in all/.test(txt));
});

// The projection legend prints where each stat lands at the end of the range.
const legendEnds = async () => {
  await page.evaluate(() => document.querySelector('#gcb-panel [data-tab="trend"]').click());
  await page.waitForTimeout(400);
  return page.evaluate(() => {
    const c = [...document.querySelectorAll("#gcb-panel .gc-card")]
      .find(x => x.querySelector("h3") && /Progression/i.test(x.querySelector("h3").textContent));
    const out = {};
    const txt = c.innerText.replace(/\n/g, " ");
    ["STR","DEF","SPE"].forEach(k => {
      const m = new RegExp(k + "\\s+([\\d.]+)([mbk])").exec(txt);
      if (m) out[k] = parseFloat(m[1]) * (m[2] === "b" ? 1e9 : m[2] === "m" ? 1e6 : 1e3);
    });
    return out;
  });
};

await t("with rotation off the chart draws one stat racing and the rest flat", async () => {
  await load(0);
  const e = await legendEnds();
  const moved = ["STR","DEF","SPE"].filter(k => e[k] > 2e8);
  assert.strictEqual(moved.length, 1, "only the stat being trained should climb: " + JSON.stringify(e));
});

await t("with rotation on the chart draws all three climbing together", async () => {
  await load(5e7);
  const e = await legendEnds();
  ["STR","DEF","SPE"].forEach(k =>
    assert.ok(e[k] > 3e8, k + " should have climbed, got " + JSON.stringify(e)));
  // and stay within reach of each other, which is the entire point
  const lo = Math.min(e.STR, e.DEF, e.SPE), hi = Math.max(e.STR, e.DEF, e.SPE);
  assert.ok(hi - lo < 1e8, "they should stay level, got " + JSON.stringify(e));
});

await t("the arrow moves one place, not straight to the front", async () => {
  // With rotation off the running order IS the priority order, so a one-place
  // move and a jump-to-front are distinguishable. Under a rotation they often
  // are not, because a catch-up leg leads regardless.
  await load(0);
  const before = await rowOrder();
  const last = before[2];
  await page.evaluate(k => document.querySelector('[data-raise="' + k + '"]').click(),
    last === "Speed" ? "spe" : last === "Strength" ? "str" : "def");
  await page.waitForTimeout(300);
  const after = await rowOrder();
  assert.strictEqual(after[0], before[0], "the leader should be untouched by a one-place move");
  assert.strictEqual(after[1], last);
  assert.strictEqual(after[2], before[1]);
});

await t("changing the increment redraws the plan without needing a reload", async () => {
  await load(5e7);
  const read = () => page.evaluate(() => {
    const c = [...document.querySelectorAll("#gcb-panel .gc-card")]
      .find(x => x.querySelector("h3") && x.querySelector("h3").textContent === "Goals");
    return c.innerText;
  });
  assert.ok(/legs in all/.test(await read()), "should start rotating");
  await page.evaluate(() => document.querySelector('[data-goalstep="0"]').click());
  await page.waitForTimeout(300);
  const off = await read();
  assert.ok(/One stat at a time/.test(off), "turning it off should redraw: " + off.slice(0,120));
  assert.ok(!/legs in all/.test(off));
  await page.evaluate(() => document.querySelector('[data-goalstep="500000000"]').click());
  await page.waitForTimeout(300);
  const big = await read();
  assert.ok(/next 500m/.test(big), "500m should redraw again: " + big.slice(0,160));
});

console.log("\n" + pass + " passed, " + fail + " failed");
await b.close();
process.exit(fail ? 1 : 0);
