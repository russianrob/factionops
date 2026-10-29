// The war banner on the attack page in a browser. The bonus banner comes up a
// few hits before a chain bonus and goes when the bonus is taken, both in the
// middle of fights, so on the attack page it must not move the page: a page
// that jumps moves the buttons under a finger, and on a phone a tap meant for
// a weapon lands on a player header, which flips Torn's view to the rival's
// loadout. The chain reaches the script the way another FactionOps tab sends
// it (the factionops_sync channel). Numbers, names and the key are made up.
import fs from "fs";
import assert from "assert";
const { chromium } = await import("/root/.hermes/hermes-agent/node_modules/playwright-core/index.mjs");
// FO_SRC points it at another copy (the mutants use it).
const script = fs.readFileSync(process.env.FO_SRC || new URL("../../server/public/scripts/factionops.user.js", import.meta.url), "utf8");
const b = await chromium.launch({ args: ["--no-sandbox"] });

// What a userscript manager would give the script, with GM storage and the
// server stubbed: the sign-in answers as a member of faction 1000003.
const preamble = () => `(() => {
  const store = { factionops_apikey: "testkey1234" };
  const answers = {
    "/api/auth": { token: "jwt-test", player: { playerId: 1000002, playerName: "Tester", factionId: 1000003 } },
  };
  window.unsafeWindow = window;
  window.GM_getValue = (k, d) => (k in store ? store[k] : d);
  window.GM_setValue = (k, v) => { store[k] = v; };
  window.GM_addStyle = (css) => { const s = document.createElement("style"); s.textContent = css; document.head.appendChild(s); return s; };
  window.GM_setClipboard = () => {};
  window.GM_registerMenuCommand = () => {};
  window.GM_xmlhttpRequest = (o) => {
    const url = String(o.url).replace(/key=[^&]*/, "key=K");
    const path = Object.keys(answers).find((p) => url.endsWith(p));
    if (!path) return;
    setTimeout(() => o.onload({ status: 200, responseText: JSON.stringify(answers[path]) }), 50);
  };
})();`;

// Torn's attack page as a phone shows it: both headers, then your weapons.
const page = () => `<!doctype html><html><head><meta charset="utf-8"><title>attack</title></head><body>
<div id="mainContainer"><div class="playersModelWrap___x">
<div class="headerWrapper___x green___x"><span class="userName___x user-name left" id="playername_Tester">Tester</span></div>
<div class="headerWrapper___x rose___x"><span class="userName___x user-name left" id="playername_Enemyname">Enemyname</span></div>
<div class="playerArea___x"><div id="weapon_main" style="height:80px">Primary</div><div id="weapon_second" style="height:80px">Secondary</div></div>
</div></div>
<script src="/fo-preamble.js"></script><script src="/factionops.user.js"></script></body></html>`;

async function open(url) {
  const ctx = await b.newContext({ viewport: { width: 393, height: 800 } });
  const p = await ctx.newPage();
  await p.route("**/*", (r) => {
    const u = r.request().url();
    if (u.endsWith("/fo-preamble.js")) return r.fulfill({ contentType: "application/javascript", body: preamble() });
    if (u.endsWith("/factionops.user.js")) return r.fulfill({ contentType: "application/javascript", body: script });
    if (u === url) return r.fulfill({ contentType: "text/html", body: page() });
    return r.fulfill({ status: 204, body: "" });
  });
  await p.goto(url, { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(2500);
  return { ctx, p };
}
const ATTACK = "https://www.torn.com/page.php?sid=attack&user2ID=1000001";

// The chain as another FactionOps tab would pass it on.
const chainAt = (p, current) => p.evaluate((current) => {
  new BroadcastChannel("factionops_sync").postMessage({ type: "state_update", chain: { current, cooldown: 0 } });
}, current);
// Where your first weapon is on the screen, and the banner's headline if one is up.
const look = (p) => p.evaluate(() => ({
  weaponTop: Math.round(document.getElementById("weapon_main").getBoundingClientRect().top),
  banner: (document.getElementById("fo-banner") || { firstChild: null }).firstChild?.textContent || null,
}));

let pass = 0, fail = 0;
const t = async (n, f) => { try { await f(); pass++; console.log("ok   " + n); } catch (e) { fail++; console.log("FAIL " + n + " :: " + e.message); } };

await t("the bonus banner coming up and going on the attack page moves nothing under your finger", async () => {
  const { ctx, p } = await open(ATTACK);
  const before = await look(p);
  await chainAt(p, 96);   // the first count is a baseline, not an event
  await chainAt(p, 97);   // three to the bonus at 100
  await p.waitForFunction(() => !!document.getElementById("fo-banner"), null, { timeout: 3000 }).catch(() => {});
  const up = await look(p);
  await chainAt(p, 100);  // the bonus is taken
  await p.waitForFunction(() => !document.getElementById("fo-banner"), null, { timeout: 3000 }).catch(() => {});
  const gone = await look(p);
  await ctx.close();
  assert.strictEqual(up.banner, "💥 BONUS HIT IN 3 — CHAIN 100");
  assert.strictEqual(gone.banner, null);
  assert.deepStrictEqual([up.weaponTop, gone.weaponTop], [before.weaponTop, before.weaponTop]);
});

await b.close();
console.log(`${pass} passed, ${fail} failed`);
process.exitCode = fail ? 1 : 0;
