// The probe has to survive the shapes it will actually meet, and has to FLAG
// the two impossibilities rather than print them as if they were fine.
import fs from "fs";
import assert from "assert";
const { chromium } = await import("/root/.hermes/hermes-agent/node_modules/playwright-core/index.mjs");
const script = fs.readFileSync("torn-gym-ledger-probe.user.js", "utf8");
const b = await chromium.launch({ args: ["--no-sandbox"] });
const DAY = 86400000, today = Math.floor(Date.now() / DAY);

async function run(mem, api = {}) {
  const ctx = await b.newContext(); const p = await ctx.newPage();
  await p.route("**/*", r => {
    const u = r.request().url();
    if (u.includes("api.torn.com")) {
      for (const [frag, body] of Object.entries(api)) {
        if (u.includes(frag)) return r.fulfill({ contentType: "application/json", body: JSON.stringify(body) });
      }
      return r.fulfill({ contentType: "application/json", body: JSON.stringify({ error: { code: 16, error: "Access level of this key is not high enough" } }) });
    }
    return r.fulfill({ contentType: "text/html", body: "<html><body></body></html>" });
  });
  await p.addInitScript(m => {
    window.GM_getValue = (k, d) => (k in m ? m[k] : d);
    window.GM_setClipboard = () => {};
  }, mem);
  await p.addInitScript({ content: script });
  await p.goto("https://www.torn.com/gym.php", { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(1500);
  const txt = await p.evaluate(() => (document.querySelector("pre") || {}).textContent || "");
  await ctx.close();
  return txt;
}
let pass = 0, fail = 0;
const t = async (n, f) => { try { await f(); pass++; console.log("ok   " + n); } catch (e) { fail++; console.log("FAIL " + n + " :: " + e.message); } };

await t("flags an off value that is not a whole number of attacks", async () => {
  const txt = await run({ gcb_v1_ledger: [{ d: today, used: 1000, wasted: 3462, off: 449 }] });
  assert.match(txt, /OFF NOT A WHOLE ATTACK \(17\.96 attacks\)/);
});

await t("flags a day whose waste exceeds what a day can regenerate", async () => {
  const txt = await run({ gcb_v1_ledger: [{ d: today, used: 1000, wasted: 3462, off: 449 }] });
  assert.match(txt, /WASTED EXCEEDS A DAY OF REGEN/);
});

await t("a legitimate day is not flagged", async () => {
  const txt = await run({ gcb_v1_ledger: [{ d: today, used: 1400, wasted: 300, off: 450 }] });
  assert.ok(!/OFF NOT A WHOLE ATTACK|EXCEEDS A DAY/.test(txt), txt.slice(0, 400));
});

await t("finds duplicate day buckets, which the Now tab would sum twice", async () => {
  const txt = await run({ gcb_v1_ledger: [
    { d: today, used: 100, wasted: 10, off: 25 }, { d: today - 1, used: 5, wasted: 1 },
    { d: today, used: 200, wasted: 20, off: 50 }] });
  assert.match(txt, /DUPLICATE DAYS :: \d+ +<-- these are counted twice/);
  assert.match(txt, /OUT OF ORDER/);
  assert.match(txt, /2 entry\(s\) at or after today: used 300 \| wasted 30 \| off 75/);
});

await t("reports a stale last-seen, which is what lets a 48h catch-up land in one day", async () => {
  const txt = await run({ gcb_v1_ledger: [{ d: today, used: 0, wasted: 0 }],
    gcb_v1_lastSeen: { e: 150, t: Date.now() - 30 * 3600000, capSince: Date.now() - 30 * 3600000, fullAt: 0 } });
  assert.match(txt, /that reading is 30\.0h old/);
});

await t("survives PDA handing everything back as strings", async () => {
  const txt = await run({ gcb_v1_ledger: JSON.stringify([{ d: today, used: 10, wasted: 2, off: 449 }]),
                          gcb_v1_warStack: "false" });
  assert.match(txt, /OFF NOT A WHOLE ATTACK/);
});

await t("says so plainly when there is no ledger at all", async () => {
  const txt = await run({});
  assert.match(txt, /LEDGER :: not an array/);
});

// --- what the key can actually reach ------------------------------------
const withKey = { gcb_v1_ledger: [{ d: today, used: 10, wasted: 2 }], gcb_v1_api_key: "abcdefghij123456" };

await t("reports which endpoints the key is refused on, with the code", async () => {
  const txt = await run(withKey, { "selections=log": { error: { code: 16, error: "Access level of this key is not high enough" } } });
  assert.match(txt, /gym log \(v1 selections=log\) :: DENIED -- code 16/);
});

await t("reports the ones it can reach, and what came back", async () => {
  const txt = await run(withKey, {
    "selections=log": { log: {} },
    "v2/user/attacks": { attacks: [] },
    "v2/user/bars": { bars: {} },
  });
  assert.match(txt, /gym log \(v1 selections=log\) :: OK -- returned \{log\}/);
  assert.match(txt, /attacks \(v2\) :: OK -- returned \{attacks\}/);
  assert.match(txt, /bars \(v2\) :: OK -- returned \{bars\}/);
});

await t("the key never reaches the report", async () => {
  const txt = await run({ ...withKey, gcb_v1_api_key: "SUPERSECRETKEY99" }, {});
  assert.ok(!txt.includes("SUPERSECRETKEY99"), "the report carries the key");
  assert.match(txt, /using saved key \.\.\.EY99 \(16 chars\)/);
});

await t("a PDA key placeholder is not mistaken for a key", async () => {
  const txt = await run({ ...withKey, gcb_v1_api_key: "###PDA-APIKEY###" }, {});
  assert.match(txt, /no saved Gym Coach key on this device/);
});

await t("no key at all skips the access check rather than erroring", async () => {
  const txt = await run({ gcb_v1_ledger: [{ d: today, used: 1, wasted: 1 }] }, {});
  assert.match(txt, /KEY ACCESS :: no saved Gym Coach key/);
});

console.log("\n" + pass + " passed, " + fail + " failed");
await b.close();
process.exit(fail ? 1 : 0);
