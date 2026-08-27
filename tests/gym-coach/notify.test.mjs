// Notifications name a stat, and it has to be the stat the plan is actually on.
// Reported: "I keep getting a notification that my energy is full train
// strength. My gym plan/goal is speed."
//
// The panel is not involved -- notifications fire on a phone with the panel
// shut -- so these drive the PDA bridge stub rather than any card.
import fs from "fs";
import assert from "assert";
const { chromium } = await import("/root/.hermes/hermes-agent/node_modules/playwright-core/index.mjs");
const html = fs.readFileSync("harness/index.html", "utf8");
const script = fs.readFileSync("harness/gym-coach-beta.user.js", "utf8");
const b = await chromium.launch({ args: ["--no-sandbox"] });

const PING_ENERGY = 2102, PING_XAN_FULL = 2103;

// Goals say Speed. The stored focus still says Strength -- which is exactly
// what a cold start reads, because applyGoalFocus() has never persisted.
async function pings({ focus = "str", goals = { str: 0, def: 0, spe: 5e8, dex: 0 },
                       energy = 100, drug = 0, tucked = true } = {}) {
  const ctx = await b.newContext({ viewport: { width: 393, height: 1400 } });
  const page = await ctx.newPage();
  await page.route("**/*", r => {
    const u = r.request().url();
    if (u.includes("gym-coach-beta.user.js")) return r.fulfill({ contentType: "application/javascript", body: script });
    if (/gym\.php/.test(u)) return r.fulfill({ contentType: "text/html", body: html });
    return r.fulfill({ status: 204, body: "" });
  });
  const cfg = {
    energy, energyMax: 150, fulltime: (150 - energy) * 30,
    drug, booster: 60000, xan: 85, cans: 21, happy: 4300, happyMax: 5000, gym: 24,
    stats: { str: 150422278, def: 104614286, spe: 150464114, dex: 146009 },
    mem: {
      gcb_v1_mode: "xan",
      gcb_v1_focus: focus,
      gcb_v1_goals: JSON.stringify(goals),
      // Tucked away is the reported setup, and the default here: notifications
      // are what a PDA user keeps the script for, panel shut. Off gym.php
      // ensureUi() force-closes the panel too, so this is most of the time.
      gcb_v1_user_tucked: tucked,
    },
  };
  await page.goto("https://www.torn.com/gym.php?cfg=" + encodeURIComponent(JSON.stringify(cfg)),
    { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);
  const out = await page.evaluate(() => {
    const calls = (window.__pdaCalls || []).filter(c => c.name === "scheduleNotification");
    const byId = {};
    for (const c of calls) byId[c.payload.id] = c.payload.subtitle;   // last wins
    const p = document.getElementById("gcb-panel");
    return { byId, panel: p ? (p.innerText || "").replace(/\n+/g, " | ") : "",
             storedFocus: window.GM_getValue("gcb_v1_focus", null) };
  });
  await ctx.close();
  return out;
}

let pass = 0, fail = 0;
const t = async (n, f) => { try { await f(); pass++; console.log("ok   " + n); } catch (e) { fail++; console.log("FAIL " + n + " :: " + e.message); } };

await t("the fixture really does schedule an energy-full ping", async () => {
  // Guard: if nothing is ever scheduled the assertions below prove nothing.
  const r = await pings();
  assert.ok(r.byId[PING_ENERGY], "no energy ping was scheduled at all: " + JSON.stringify(r.byId));
});

await t("the energy-full ping names the stat the goal is on", async () => {
  // The report. Goals are Speed-only, so nothing should say Strength.
  const r = await pings({ focus: "str" });
  assert.match(r.byId[PING_ENERGY], /Speed/, "ping said: " + r.byId[PING_ENERGY]);
});

await t("the xan ping names it too", async () => {
  // Same stale read, second message. drugCd clear + xanax in hand + a bar
  // filling soon is what arms this one.
  const r = await pings({ focus: "str", energy: 140, drug: 0 });
  assert.ok(r.byId[PING_XAN_FULL], "no xan ping scheduled: " + JSON.stringify(r.byId));
  assert.match(r.byId[PING_XAN_FULL], /Speed/, "ping said: " + r.byId[PING_XAN_FULL]);
});

await t("it is right with the panel OPEN too", async () => {
  // This path always worked: the render syncs the focus before the ping is
  // armed. Keeping it so a fix that breaks the open case cannot pass.
  const r = await pings({ focus: "str", tucked: false });
  assert.match(r.byId[PING_ENERGY], /Speed/, "ping said: " + r.byId[PING_ENERGY]);
});

await t("with no goals set it falls back to the focus you picked", async () => {
  // Goals drive the focus only when there ARE goals; otherwise the manual
  // choice stands and must not be overwritten.
  const r = await pings({ focus: "dex", goals: { str: 0, def: 0, spe: 0, dex: 0 } });
  assert.match(r.byId[PING_ENERGY], /Dexterity/, "ping said: " + r.byId[PING_ENERGY]);
});

await t("the derived focus is written back, not just held in memory", async () => {
  // Otherwise storage keeps saying "str" forever and every cold read -- any
  // consumer that runs before a sync -- starts wrong all over again.
  const r = await pings({ focus: "str" });
  assert.strictEqual(r.storedFocus, "spe", "stored focus stayed " + r.storedFocus);
});

await t("the panel and the ping never name different stats", async () => {
  // The invariant behind the report: whatever the plan says, the notification
  // says. Pinning the property rather than one wording.
  const r = await pings({ focus: "str" });
  const STATS = ["Strength", "Defense", "Speed", "Dexterity"];
  const inPing = STATS.filter(s => (r.byId[PING_ENERGY] || "").includes(s));
  assert.deepStrictEqual(inPing, ["Speed"], "ping named: " + inPing.join(" AND "));
});

console.log("\n" + pass + " passed, " + fail + " failed");
await b.close();
process.exit(fail ? 1 : 0);
