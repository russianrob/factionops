import fs from "fs";
import assert from "assert";
const { chromium } = await import("/root/.hermes/hermes-agent/node_modules/playwright-core/index.mjs");
const html = fs.readFileSync("harness/index.html","utf8");
const script = fs.readFileSync("harness/gym-coach-beta.user.js","utf8");
const b = await chromium.launch({ args:["--no-sandbox"] });
const page = await b.newPage({ viewport:{width:393,height:900} });
await page.route("**/*", r => { const u=r.request().url();
  if (u.includes("gym-coach-beta.user.js")) return r.fulfill({contentType:"application/javascript",body:script});
  if (/gym\.php/.test(u)) return r.fulfill({contentType:"text/html",body:html});
  return r.fulfill({status:204,body:""}); });

// A real page load per reading. Energy regenerates at roughly 30s a point here,
// so "fulltime" is the seconds left to the cap.
async function at(energy, max = 150) {
  const cfg = { energy, energyMax: max, fulltime: Math.max(0, (max - energy) * 30),
                drug: 3840, booster: 60000, xan: 85, cans: 21, happy: 4300,
                mem: { gcb_v1_mode: "xan" } };
  await page.goto("https://www.torn.com/gym.php?cfg=" + encodeURIComponent(JSON.stringify(cfg)),
                  { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(350);
  return page.evaluate(() => {
    const pn = document.getElementById("gcb-panel");
    const note = pn.querySelector(".gcb-note");
    const fill = pn.querySelector(".gcb-fill");
    return { note: (note && note.textContent) || "",
             full: !!(fill && /\bfull\b/.test(fill.className)),
             panel: pn.textContent || "",
             pings: (window.__pdaCalls || []).slice() };
  });
}

let pass=0,fail=0;
const t=async(n,f)=>{try{await f();pass++;console.log("ok   "+n);}catch(e){fail++;console.log("FAIL "+n+" :: "+e.message);}};

await t("a bar one point short of the cap is not reported as capped", async () => {
  const r = await at(149);
  assert.ok(!/capped/.test(r.note), "said capped at 149/150: " + r.note);
  assert.ok(!/regen paused/.test(r.note), "claimed regen was paused at 149/150");
  assert.ok(/full in/.test(r.note), "should say how long until full, got: " + r.note);
});

await t("and it is not drawn as a full bar either", async () => {
  assert.strictEqual((await at(149)).full, false);
  assert.strictEqual((await at(148)).full, false);
  assert.strictEqual((await at(147)).full, false);
});

await t("at the cap it IS capped, and regen really has stopped", async () => {
  const r = await at(150);
  assert.ok(/capped/.test(r.note), "should say capped at 150/150: " + r.note);
  assert.ok(/regen paused/.test(r.note));
  assert.strictEqual(r.full, true);
  // and the advice must flip too — exactly at the cap there is nothing to wait
  // for, so "wait for full energy" would be advice to do nothing forever
  assert.ok(/Don.t sit on a full bar/.test(r.panel), "should tell you to spend it");
  assert.ok(!/Wait .* for full energy/.test(r.panel));
});

await t("above the cap it says how far over, not merely capped", async () => {
  const r = await at(155);
  assert.ok(/5 over the 150 cap/.test(r.note), r.note);
  assert.ok(/regen paused/.test(r.note));
});

await t("one point short is worth waiting for: it is a whole extra train", async () => {
  // 149e at 10e a train is 14 trains. 150e is 15. Telling you to spend now
  // throws that train away, so the advice must not be "train now".
  const r = await at(149);
  assert.ok(!/Don.t sit on a full bar/.test(r.panel),
    "advised training away a bar that was about to gain a train");
  assert.ok(/Wait .* for full energy/.test(r.panel), "should advise the short wait");
});

await t("the cap is read from YOUR maximum, not a hardcoded 150", async () => {
  const r = await at(999, 1000);       // one short of a xanax-inflated cap
  assert.ok(!/capped/.test(r.note), r.note);
  assert.ok(!r.full, "999/1000 is not a full bar");
  // the advice has to honour the real maximum as well, or a big bar is called
  // full the moment it passes 150
  assert.ok(!/Don.t sit on a full bar/.test(r.panel), "called 999/1000 a full bar");
  const c = await at(1000, 1000);
  assert.ok(/capped/.test(c.note), "1000/1000 must be capped");
  assert.ok(/Don.t sit on a full bar/.test(c.panel));
});

await t("a bar short of the cap still schedules the energy-full ping", async () => {
  // PING_ENERGY is 2102. With two points of slack this ping was never armed
  // for the last two points, so sitting at 149 woke you for nothing.
  const r = await at(149);
  const sched = r.pings.filter(c => c.name === "scheduleNotification" && c.payload.id === 2102);
  assert.strictEqual(sched.length, 1, "expected one energy ping, got " + JSON.stringify(r.pings.map(x=>x.name+":"+(x.payload||{}).id)));
  assert.match(sched[0].payload.subtitle, /Energy full/);
});

await t("at the cap there is nothing left to wait for, so the ping is cancelled", async () => {
  const r = await at(150);
  const sched = r.pings.filter(c => c.name === "scheduleNotification" && c.payload.id === 2102);
  const canc = r.pings.filter(c => c.name === "cancelNotification" && c.payload.id === 2102);
  assert.strictEqual(sched.length, 0, "should not schedule an energy ping at the cap");
  assert.ok(canc.length >= 1, "should cancel it");
});

console.log("\n" + pass + " passed, " + fail + " failed");
await b.close();
process.exit(fail ? 1 : 0);
