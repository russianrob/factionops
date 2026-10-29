// The energy bar on the attack page in a browser: a slim bar right under your
// own header (Torn's green one) reading "Energy 875/150", filled to the max.
// It shows what FactionOps read from Torn's API when the page opened, then the
// energy Torn's sidebar saved in sessionStorage once that changes on the page.
// No reading is no bar, a profile page gets none, and a quiet page is left
// alone. Numbers, names and the key are made up.
import fs from "fs";
import assert from "assert";
const { chromium } = await import("/root/.hermes/hermes-agent/node_modules/playwright-core/index.mjs");
// FO_SRC points it at another copy (the mutants use it).
const script = fs.readFileSync(process.env.FO_SRC || new URL("../../server/public/scripts/factionops.user.js", import.meta.url), "utf8");
const b = await chromium.launch({ args: ["--no-sandbox"] });

// What a userscript manager would give the script, with GM storage and the
// server stubbed: every request is logged, the sign-in answers as a member of
// faction 1000003, and Torn's bars answer cfg.bars (875/150 unless a test
// says otherwise). With cfg.sidebar ({ amount, max }) the tab starts with
// that energy in Torn's saved sidebar data.
const preamble = (cfg) => `(() => {
  const cfg = ${JSON.stringify(cfg)};
  const store = { factionops_apikey: "testkey1234" };
  const answers = {
    "/api/auth": { token: "jwt-test", player: { playerId: 1000002, playerName: "Tester", factionId: 1000003 } },
    "selections=bars&key=K": cfg.bars || { energy: { current: 875, maximum: 150, ticktime: 100, fulltime: 600 } },
  };
  if (cfg.sidebar) sessionStorage.setItem("sidebarData1000002", JSON.stringify({ bars: { energy: cfg.sidebar } }));
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
    setTimeout(() => o.onload({ status: 200, responseText: JSON.stringify(answers[path]) }), 50);
  };
})();`;

// Both players where Torn's attack page shows them: a header for each, yours
// first in Torn's green, the defender's in its rose.
const page = () => `<!doctype html><html><head><meta charset="utf-8"><title>attack</title></head><body>
<div id="mainContainer"><div class="playersModelWrap___x">
<div class="player___x"><div class="headerWrapper___x green___x"><span class="userName___x user-name left" id="playername_Tester">Tester</span></div></div>
<div class="player___x"><div class="headerWrapper___x rose___x"><span class="userName___x user-name left" id="playername_Enemyname">Enemyname</span></div></div>
</div></div>
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
const FRESH_HEADER = '<div class="headerWrapper___x green___x"><span class="userName___x user-name left" id="playername_Tester">Tester</span></div>';

// The bar as the page shows it, or null: its words, its fill's width, whether
// it is the very next thing after your header (and after theirs), and how
// many bars the page has.
const bar = (p) => p.evaluate(() => {
  const e = document.getElementById("fo-atk-energy");
  if (!e) return null;
  const yours = document.querySelector('[class*="headerWrapper__"][class*="green__"]');
  const theirs = document.querySelector('[class*="headerWrapper__"][class*="rose__"]');
  return {
    text: e.querySelector(".fo-atk-energy-text").textContent,
    fill: e.querySelector(".fo-atk-energy-fill").style.width,
    underYours: yours.nextElementSibling === e,
    underTheirs: theirs.nextElementSibling === e,
    bars: document.querySelectorAll(".fo-atk-energy-text").length,
  };
});
// Waits up to 4 s for the bar to read `text`; true once it does.
const until = (p, text) => p.waitForFunction((want) => {
  const e = document.getElementById("fo-atk-energy");
  return !!e && e.textContent === want;
}, text, { timeout: 4000 }).then(() => true, () => false);

let pass = 0, fail = 0;
const t = async (n, f) => { try { await f(); pass++; console.log("ok   " + n); } catch (e) { fail++; console.log("FAIL " + n + " :: " + e.message); } };

await t("the bar sits right under your header with the energy the page opened with", async () => {
  const { ctx, p } = await open(ATTACK);
  await until(p, "Energy 875/150");
  const got = await bar(p);
  await ctx.close();
  assert.deepStrictEqual(got, { text: "Energy 875/150", fill: "100%", underYours: true, underTheirs: false, bars: 1 });
});

await t("a reading under the max fills part of the bar", async () => {
  const { ctx, p } = await open(ATTACK, { bars: { energy: { current: 75, maximum: 150, ticktime: 100, fulltime: 600 } } });
  await until(p, "Energy 75/150");
  const got = await bar(p);
  await ctx.close();
  assert.deepStrictEqual(got, { text: "Energy 75/150", fill: "50%", underYours: true, underTheirs: false, bars: 1 });
});

await t("the bar follows Torn's saved energy once it changes on the page", async () => {
  // The 900 saved at load is taken for an earlier page's copy: the bar keeps
  // the API's 875 until Torn rewrites it.
  const { ctx, p } = await open(ATTACK, { sidebar: { amount: 900, max: 150 } });
  const opened = await until(p, "Energy 875/150");
  await p.evaluate(() => sessionStorage.setItem("sidebarData1000002", JSON.stringify({ bars: { energy: { amount: 850, max: 150 } } })));
  const followed = await until(p, "Energy 850/150");
  const got = await bar(p);
  await ctx.close();
  assert.ok(opened, "never read 875/150");
  assert.ok(followed, JSON.stringify(got));
  assert.deepStrictEqual(got, { text: "Energy 850/150", fill: "100%", underYours: true, underTheirs: false, bars: 1 });
});

await t("Torn redrawing your header keeps the bar under it", async () => {
  const { ctx, p } = await open(ATTACK);
  const shown = await until(p, "Energy 875/150");
  await p.evaluate((html) => { document.querySelector(".player___x").innerHTML = html; }, FRESH_HEADER);
  const back = await p.waitForFunction(() => {
    const h = document.querySelector('[class*="headerWrapper__"][class*="green__"]');
    return !!h && !!h.nextElementSibling && h.nextElementSibling.id === "fo-atk-energy";
  }, null, { timeout: 4000 }).then(() => true, () => false);
  const got = await bar(p);
  await ctx.close();
  assert.ok(shown, "no bar before the redraw");
  assert.ok(back, JSON.stringify(got));
  assert.deepStrictEqual(got, { text: "Energy 875/150", fill: "100%", underYours: true, underTheirs: false, bars: 1 });
});

await t("no reading, no bar", async () => {
  const { ctx, p } = await open(ATTACK, { bars: { error: { code: 2, error: "Incorrect key" } } });
  await p.waitForTimeout(4000);
  const got = await bar(p);
  const assist = await p.evaluate(() => !!document.getElementById("wb-assist-btn"));
  await ctx.close();
  assert.strictEqual(got, null);
  assert.strictEqual(assist, true);
});

await t("a profile page gets no bar", async () => {
  const { ctx, p } = await open("https://www.torn.com/profiles.php?XID=1000001");
  await p.waitForTimeout(4000);
  const got = await bar(p);
  await ctx.close();
  assert.strictEqual(got, null);
});

await t("a quiet page is not repainted", async () => {
  const { ctx, p } = await open(ATTACK);
  const shown = await until(p, "Energy 875/150");
  const quiet = shown ? await p.evaluate(() => new Promise((done) => {
    const el = document.getElementById("fo-atk-energy");
    const seen = [];
    new MutationObserver((ms) => { for (const m of ms) seen.push(m.type + (m.attributeName ? ":" + m.attributeName : "")); })
      .observe(el, { subtree: true, childList: true, attributes: true, characterData: true });
    setTimeout(() => done({ seen, same: document.getElementById("fo-atk-energy") === el }), 5000);
  })) : null;
  await ctx.close();
  assert.ok(shown, "no bar");
  assert.deepStrictEqual(quiet, { seen: [], same: true });
});

await t("a part-full bar is a whole percent and a quiet page leaves it alone too", async () => {
  // 100/150 is 66.66...%: a width the browser may read back in another form
  // than it was written, which would make every 2 s look a repaint.
  const { ctx, p } = await open(ATTACK, { bars: { energy: { current: 100, maximum: 150, ticktime: 100, fulltime: 600 } } });
  const shown = await until(p, "Energy 100/150");
  const got = await bar(p);
  const quiet = shown ? await p.evaluate(() => new Promise((done) => {
    const el = document.getElementById("fo-atk-energy");
    const seen = [];
    new MutationObserver((ms) => { for (const m of ms) seen.push(m.type + (m.attributeName ? ":" + m.attributeName : "")); })
      .observe(el, { subtree: true, childList: true, attributes: true, characterData: true });
    setTimeout(() => done({ seen, same: document.getElementById("fo-atk-energy") === el }), 5000);
  })) : null;
  await ctx.close();
  assert.ok(shown, "no bar");
  assert.strictEqual(got.fill, "67%");
  assert.deepStrictEqual(quiet, { seen: [], same: true });
});

await b.close();
console.log(`${pass} passed, ${fail} failed`);
process.exitCode = fail ? 1 : 0;
