import fs from "fs";
import assert from "assert";
const { chromium } = await import("/root/.hermes/hermes-agent/node_modules/playwright-core/index.mjs");
const html = fs.readFileSync("harness/index.html", "utf8");
const script = fs.readFileSync("harness/gym-coach-beta.user.js", "utf8");
const b = await chromium.launch({ args: ["--no-sandbox"] });
const page = await b.newPage({ viewport: { width: 393, height: 900 } });
await page.route("**/*", r => { const u = r.request().url();
  if (u.includes("gym-coach-beta.user.js")) return r.fulfill({ contentType: "application/javascript", body: script });
  if (/gym\.php/.test(u)) return r.fulfill({ contentType: "text/html", body: html });
  return r.fulfill({ status: 204, body: "" }); });

// The Xanax order in the Xan + gym playstyle: train what is in the bar, THEN take
// the Xanax, straight away. Holding a bar for the Xanax puts it at risk if the
// Xanax overdoses and delays the next cooldown, and the extra happiness on a few
// energy is not worth either. Reported by testers 2026-10-18 against a verdict
// that said "Wait 10m for a full bar, then take a xan". War stack is the one mode
// where taking a Xanax on a held bar is the point, so it must not change.
async function at(energy, extra = {}) {
  const max = extra.max || 150;
  const cfg = Object.assign({ energy, energyMax: max, fulltime: Math.max(0, (max - energy) * 30),
                drug: 0, booster: 60000, xan: 85, cans: 21, happy: 4300,
                mem: Object.assign({ gcb_v1_mode: "xan", gcb_v1_verdictFold: 0 }, extra.mem || {}) }, extra.cfg || {});
  await page.goto("https://www.torn.com/gym.php?cfg=" + encodeURIComponent(JSON.stringify(cfg)), { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(400);
  return page.evaluate(() => {
    const pn = document.getElementById("gcb-panel");
    return { panel: (pn && pn.textContent) || "",
             pings: (window.__pdaCalls || []).filter(c => c.name === "scheduleNotification").map(c => c.payload.subtitle) };
  });
}
const OLD_HABIT = [/full bar,? then (take a )?xan/i, /Waiting lets you train/i, /Do not take a Xanax/i,
                   /Don.t train this bar away/i, /Wait the extra/i, /Prefer a full bar/i,
                   /Be at a full bar when xan/i, /wait for (a )?full bar if/i, /Waiting picks up the rest/i];
function noOldHabit(text, where) {
  for (const rx of OLD_HABIT) assert.ok(!rx.test(text), where + " still says " + rx + ": " + (text.match(rx) || [""])[0]);
}
function trainThenXan(text, where) {
  const t = text.search(/Train (your )?\d+e/i), x = text.search(/then take a Xanax/i);
  assert.ok(t !== -1, where + ": no 'Train Ne' instruction in: " + text.slice(0, 300));
  assert.ok(x !== -1 && x > t, where + ": the Xanax must come after training in: " + text.slice(0, 300));
}

let pass = 0, fail = 0;
const t = async (n, f) => { try { await f(); pass++; console.log("ok   " + n); } catch (e) { fail++; console.log("FAIL " + n + " :: " + e.message); } };

await t("xan ready at 145/150: train the 145 first, then take the Xanax", async () => {
  const r = await at(145);
  trainThenXan(r.panel, "145/150"); noOldHabit(r.panel, "145/150");
  assert.ok(/Train (your )?145e/i.test(r.panel), "should name the 145e in the bar");
  assert.ok(!/Take a Xanax now, then train/i.test(r.panel), "still puts the Xanax first");
});
await t("xan ready at a full bar: train the 150 first, not the Xanax first", async () => {
  const r = await at(150);
  trainThenXan(r.panel, "150/150"); noOldHabit(r.panel, "150/150");
  assert.ok(!/Take a Xanax now, then train/i.test(r.panel), "still puts the Xanax first at a full bar");
});
await t("xan ready with less than one train in the bar: take it now", async () => {
  const r = await at(0);
  assert.ok(/Take a Xanax now/i.test(r.panel), "should say take it now: " + r.panel.slice(0, 300));
  noOldHabit(r.panel, "0/150");
});
await t("cooldown ends before the bar fills: train first, then the Xanax, never wait for full", async () => {
  const r = await at(100, { cfg: { drug: 600 } });
  noOldHabit(r.panel, "cooldown 10m, 100/150");
  assert.ok(/then take a Xanax/i.test(r.panel), "the cooldown step should end with taking the Xanax: " + r.panel.slice(0, 400));
});
await t("bar fills before the cooldown ends: the Xanax step trains first", async () => {
  const r = await at(100, { cfg: { drug: 3000 } });
  noOldHabit(r.panel, "cooldown 50m, 100/150");
});
await t("on cooldown with a full bar: no goal of being full when the cooldown ends", async () => {
  const r = await at(150, { cfg: { drug: 3000 } });
  noOldHabit(r.panel, "cooldown 50m, 150/150");
});
await t("no Xanax in inventory: the follow-up step no longer says wait for a full bar", async () => {
  const r = await at(100, { cfg: { xan: 0 } });
  noOldHabit(r.panel, "no xans");
});
await t("the cooldown-ending ping says train first, and the bar-full Xanax ping is gone", async () => {
  const r = await at(100, { cfg: { drug: 600 } });
  const xan = r.pings.filter(s => /Xan is up/i.test(s));
  assert.ok(xan.length >= 1, "a ping for the cooldown ending should be scheduled; got " + JSON.stringify(r.pings));
  for (const s of xan) assert.ok(/Train your energy, then take it/i.test(s), "ping says: " + s);
  for (const s of r.pings) {
    assert.ok(!/Wait for a full bar/i.test(s), "ping still says wait: " + s);
    assert.ok(!/Take a xan, then train/i.test(s), "bar-full Xanax ping survives: " + s);
  }
});
await t("xan ready while the bar fills soon: no bar-full Xanax ping", async () => {
  const r = await at(140);
  for (const s of r.pings) assert.ok(!/Take a xan/i.test(s), "bar-full Xanax ping survives: " + s);
});
await t("war stack is unchanged: taking a Xanax on a held bar is the point there", async () => {
  const r = await at(500, { mem: { gcb_v1_warStack: true } });
  assert.ok(/War stack\. Take a Xanax\./.test(r.panel), "war stack verdict changed: " + r.panel.slice(0, 300));
});
await t("Happy jump keeps its old Xanax pings: stacking on a held bar is how a jump is built", async () => {
  const r = await at(100, { cfg: { drug: 600 }, mem: { gcb_v1_mode: "jump" } });
  assert.ok(r.pings.some(s => s === "Xan is up. Wait for a full bar, then take it."), "jump cooldown ping changed: " + JSON.stringify(r.pings));
  assert.ok(r.pings.some(s => /^Bar full\. Take a xan, then train /.test(s)), "jump bar-full ping changed: " + JSON.stringify(r.pings));
});
// Standing in Cha Cha's (10e a train) while owning Balboas (25e a train, better
// Dexterity). The steps send you to Balboas, so "less than one train" has to be
// measured in Balboas trains, or 15e reads as trainable in a gym where it is not.
const BALBOAS = { cfg: { gym: 20 }, mem: { gcb_v1_focus: "dex", gcb_v1_gymsOwned: JSON.stringify([19, 24]) } };
await t("one train is measured at the gym the steps name: 15e is under one Balboas train", async () => {
  const r = await at(15, BALBOAS);
  assert.ok(/Balboas/.test(r.panel), "fixture guard: the verdict should send you to Balboas: " + r.panel.slice(0, 400));
  assert.ok(/Take a Xanax now/i.test(r.panel), "15e is less than one 25e train, take it now: " + r.panel.slice(0, 400));
  assert.ok(!/Train (your )?15e/i.test(r.panel), "told to train 15e in a 25e gym");
});
await t("and 30e is one Balboas train, so it trains first", async () => {
  const r = await at(30, BALBOAS);
  assert.ok(/Train (your )?30e into Dexterity, then take a Xanax/i.test(r.panel), "should train the 30e first: " + r.panel.slice(0, 400));
});
await t("with no Xanax in inventory the cooldown ping does not say take it", async () => {
  const r = await at(100, { cfg: { drug: 600, xan: 0 } });
  const xan = r.pings.filter(s => /Xan is up/i.test(s));
  assert.ok(xan.length >= 1, "a cooldown ping should still be scheduled: " + JSON.stringify(r.pings));
  for (const s of xan) assert.ok(!/take it/i.test(s), "ping tells a player with no Xanax to take it: " + s);
});
await t("the booster note does not claim a 24h cap", async () => {
  const r = await at(145);
  assert.ok(/Booster has room/.test(r.panel), "booster note missing: " + r.panel.slice(0, 500));
  assert.ok(!/under 24h/.test(r.panel), "still claims a 24h cap");
});
await b.close();
console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
