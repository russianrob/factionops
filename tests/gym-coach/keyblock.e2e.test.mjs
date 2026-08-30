// The Full-key requirement, as the box actually behaves.
//
// Owner's decision: Gym Coach requires a Full key. The unit tests prove the
// verdict; this proves the box refuses to STORE a refused key, which is the
// part that matters and the part unit tests cannot see.
import fs from "fs";
import assert from "assert";
const { chromium } = await import("/root/.hermes/hermes-agent/node_modules/playwright-core/index.mjs");
const html = fs.readFileSync("harness/index.html", "utf8");
const script = fs.readFileSync("harness/gym-coach-beta.user.js", "utf8");
const b = await chromium.launch({ args: ["--no-sandbox"] });

async function save({ keyLevel = 4, keyErr = 0, key = "abcdefghij123456" }) {
  const ctx = await b.newContext({ viewport: { width: 393, height: 1200 } });
  const p = await ctx.newPage();
  await p.route("**/*", r => {
    const u = r.request().url();
    if (u.includes("gym-coach-beta.user.js")) return r.fulfill({ contentType: "application/javascript", body: script });
    if (/gym\.php/.test(u)) return r.fulfill({ contentType: "text/html", body: html });
    return r.fulfill({ status: 204, body: "" });
  });
  const cfg = { energy: 100, energyMax: 150, fulltime: 1500, drug: 0, booster: 0,
    xan: 85, cans: 21, happy: 4300, happyMax: 5000, gym: 24, noPda: true, keyLevel, keyErr,
    stats: { str: 614000000, def: 12000000, spe: 9000000, dex: 8000000 },
    // no stored key: the save path is what is under test
    mem: { gcb_v1_mode: "xan", gcb_v1_focus: "str", gcb_v1_api_key: "" } };
  await p.goto("https://www.torn.com/gym.php?cfg=" + encodeURIComponent(JSON.stringify(cfg)), { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(1800);
  // The key box lives in Settings, which is not the default tab.
  await p.evaluate(() => {
    const pill = document.getElementById("gcb-pill");
    if (pill) pill.click();
  });
  await p.waitForTimeout(500);
  await p.evaluate(() => {
    const cog = document.querySelector('[data-tab="set"]');
    if (cog) cog.click();
  });
  await p.waitForTimeout(700);
  const out = await p.evaluate(async k => {
    // Drive the same entry point the Save button uses.
    window.__gcbSaved = null;
    const orig = window.GM_setValue;
    window.GM_setValue = (n, v) => { if (n === "gcb_v1_api_key") window.__gcbSaved = v; return orig(n, v); };
    const el = document.getElementById("gcKey");
    if (!el) return { err: "no key box" };
    el.value = k;
    el.dispatchEvent(new Event("change", { bubbles: true }));
    const btn = [...document.querySelectorAll("[data-act=savekey]")][0];
    if (btn) btn.click();
    return {};
  }, key);
  if (out.err) { await ctx.close(); throw new Error(out.err); }
  await p.waitForTimeout(1500);
  const r = await p.evaluate(() => ({
    saved: window.__gcbSaved,
    toast: (document.querySelector(".gc-toast") || {}).innerText || "",
  }));
  await ctx.close();
  return r;
}

let pass = 0, fail = 0;
const t = async (n, f) => { try { await f(); pass++; console.log("ok   " + n); } catch (e) { fail++; console.log("FAIL " + n + " :: " + e.message); } };

await t("a Full key is stored", async () => {
  const r = await save({ keyLevel: 4 });
  assert.strictEqual(r.saved, "abcdefghij123456");
  assert.match(r.toast, /Full access confirmed/i);
});

await t("a Limited key is NOT stored, and the box says why", async () => {
  const r = await save({ keyLevel: 3 });
  assert.strictEqual(r.saved, null, "a refused key was written to storage anyway");
  assert.match(r.toast, /not saved/i);
  assert.match(r.toast, /Full key/i);
});

await t("an invalid key is not stored either", async () => {
  const r = await save({ keyErr: 2 });
  assert.strictEqual(r.saved, null);
  assert.match(r.toast, /does not recognise/i);
});

await t("a rate-limited check still SAVES, rather than locking you out", async () => {
  // The one case where refusing would be the wrong answer: the key may be
  // perfectly good and the API merely busy.
  const r = await save({ keyErr: 5 });
  assert.strictEqual(r.saved, "abcdefghij123456", "a busy API blocked a good key");
  assert.match(r.toast, /Could not verify/i);
});

console.log("\n" + pass + " passed, " + fail + " failed");
await b.close();
process.exit(fail ? 1 : 0);
