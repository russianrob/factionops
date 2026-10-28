// The Assist button in a browser: on an attack page it floats bottom right
// and asks the faction for help on that fight's target, once however fast
// the taps come; a profile page or an attack log gets none (the profile
// page's Retal button was removed in 5.6.2 and stays removed); and moving to
// another fight without a page load swaps in a button for the new target.
// Numbers, names and the key are made up.
import fs from "fs";
import assert from "assert";
const { chromium } = await import("/root/.hermes/hermes-agent/node_modules/playwright-core/index.mjs");
// FO_SRC points it at another copy (the mutants use it).
const script = fs.readFileSync(process.env.FO_SRC || new URL("../../server/public/scripts/factionops.user.js", import.meta.url), "utf8");
const b = await chromium.launch({ args: ["--no-sandbox"] });

// What a userscript manager would give the script, with GM storage stubbed
// and the server stubbed: every request is logged, the sign-in answers as a
// member of faction 1000003, and an assist request is accepted after 300 ms
// (or, with cfg.assistStatus, refused with that status).
const preamble = (cfg) => `(() => {
  const cfg = ${JSON.stringify(cfg)};
  const store = { factionops_apikey: "testkey1234" };
  const answers = {
    "/api/auth": { token: "jwt-test", player: { playerId: 1000002, playerName: "Tester", factionId: 1000003 } },
    "/api/assist-request": { ok: true },
  };
  window.__reqs = [];
  window.unsafeWindow = window;
  window.GM_getValue = (k, d) => (k in store ? store[k] : d);
  window.GM_setValue = (k, v) => { store[k] = v; };
  window.GM_addStyle = (css) => { const s = document.createElement("style"); s.textContent = css; document.head.appendChild(s); return s; };
  window.GM_setClipboard = () => {};
  window.GM_registerMenuCommand = () => {};
  window.GM_xmlhttpRequest = (o) => {
    const url = String(o.url).replace(/key=[^&]*/, "key=K");
    window.__reqs.push({ method: o.method || "GET", url, data: o.data || null });
    const path = Object.keys(answers).find((p) => url.endsWith(p));
    if (!path) return;
    const assist = path === "/api/assist-request";
    const status = assist && cfg.assistStatus ? cfg.assistStatus : 200;
    setTimeout(() => o.onload({ status, responseText: JSON.stringify(status === 200 ? answers[path] : { error: "refused" }) }), assist ? 300 : 50);
  };
})();`;

// The defender's name where the attack page shows it.
const page = () => `<!doctype html><html><head><meta charset="utf-8"><title>attack</title></head><body>
<div id="mainContainer"><div class="defender___x"><span class="userName___x">Enemyname</span></div></div>
<script src="/fo-preamble.js"></script><script src="/factionops.user.js"></script></body></html>`;

async function open(url, cfg = {}) {
  const ctx = await b.newContext({ viewport: { width: 393, height: 800 } });
  const p = await ctx.newPage();
  await p.route("**/*", (r) => {
    const u = r.request().url();
    if (u.endsWith("/fo-preamble.js")) return r.fulfill({ contentType: "application/javascript", body: preamble(cfg) });
    if (u.endsWith("/factionops.user.js")) return r.fulfill({ contentType: "application/javascript", body: script });
    if (u === url) return r.fulfill({ contentType: "text/html", body: page() });
    return r.fulfill({ status: 204, body: "" });
  });
  await p.goto(url, { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(2500);
  return { ctx, p };
}
const ATTACK = "https://www.torn.com/page.php?sid=attack&user2ID=1000001";
const btn = (p) => p.evaluate(() => {
  const e = document.getElementById("wb-assist-btn");
  if (!e) return null;
  const cs = getComputedStyle(e);
  return { text: e.textContent.trim(), disabled: e.disabled, position: cs.position, bottom: cs.bottom, right: cs.right };
});
const assists = (p) => p.evaluate(() => window.__reqs
  .filter((r) => r.url.endsWith("/api/assist-request"))
  .map((r) => ({ method: r.method, body: JSON.parse(r.data) })));

let pass = 0, fail = 0;
const t = async (n, f) => { try { await f(); pass++; console.log("ok   " + n); } catch (e) { fail++; console.log("FAIL " + n + " :: " + e.message); } };

await t("an attack page gets the Assist button, bottom right", async () => {
  const { ctx, p } = await open(ATTACK);
  const got = await btn(p);
  await ctx.close();
  assert.deepStrictEqual(got, { text: "Assist", disabled: false, position: "fixed", bottom: "72px", right: "14px" });
});

await t("a tap asks the faction for help on this target, then the button cools down", async () => {
  const { ctx, p } = await open(ATTACK);
  await p.click("#wb-assist-btn", { timeout: 3000 });
  await p.waitForTimeout(700);
  const sent = await assists(p), after = await btn(p);
  const toast = await p.evaluate(() => document.body.textContent.includes("Assist request sent!"));
  await ctx.close();
  assert.deepStrictEqual(sent, [{ method: "POST", body: { warId: "war_1000003", targetId: "1000001", targetName: "Enemyname", mode: "assist" } }]);
  assert.ok(after.disabled && /^⏳ (29|30)s$/.test(after.text), JSON.stringify(after));
  assert.ok(toast, "no toast");
});

await t("a second tap while the request is out sends nothing more", async () => {
  const { ctx, p } = await open(ATTACK);
  await p.click("#wb-assist-btn", { timeout: 3000 });
  await p.click("#wb-assist-btn", { timeout: 3000, force: true });
  await p.waitForTimeout(700);
  const sent = await assists(p);
  await ctx.close();
  assert.strictEqual(sent.length, 1);
});

await t("a request the server refuses says so and leaves the button ready", async () => {
  const { ctx, p } = await open(ATTACK, { assistStatus: 500 });
  await p.click("#wb-assist-btn", { timeout: 3000 });
  await p.waitForTimeout(700);
  const after = await btn(p);
  const toast = await p.evaluate(() => document.body.textContent.includes("Failed to send assist request"));
  await ctx.close();
  assert.deepStrictEqual([after.text, after.disabled], ["Assist", false]);
  assert.ok(toast, "no toast");
});

await t("an attack log gets no button", async () => {
  const { ctx, p } = await open("https://www.torn.com/page.php?sid=attackLog&ID=93f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4");
  await p.waitForTimeout(1500);
  const got = await btn(p), sent = await assists(p);
  await ctx.close();
  assert.strictEqual(got, null);
  assert.deepStrictEqual(sent, []);
});

await t("a profile page gets no button", async () => {
  const { ctx, p } = await open("https://www.torn.com/profiles.php?XID=1000001");
  await p.waitForTimeout(1500);
  const got = await btn(p);
  await ctx.close();
  assert.strictEqual(got, null);
});

await t("another fight without a page load gets a button for the new target", async () => {
  const { ctx, p } = await open(ATTACK);
  await p.evaluate(() => history.pushState({}, "", "/page.php?sid=attack&user2ID=1000004"));
  await p.waitForTimeout(2500);
  await p.click("#wb-assist-btn", { timeout: 3000 });
  await p.waitForTimeout(400);
  const sent = await assists(p);
  await ctx.close();
  assert.deepStrictEqual(sent.map((s) => s.body.targetId), ["1000004"]);
});

await b.close();
console.log(`${pass} passed, ${fail} failed`);
process.exitCode = fail ? 1 : 0;
