// The chain bar in a browser, on a Torn page that is not one of FactionOps'
// own: one chain check, then up and flashing while the sidebar's chain has
// the threshold or less left; down for a chain in its cooldown, without focus
// outside Torn PDA, under 10 hits or with chain alerts off; and nothing else
// of FactionOps runs there. Numbers and the key are made up.
import fs from "fs";
import assert from "assert";
const { chromium } = await import("/root/.hermes/hermes-agent/node_modules/playwright-core/index.mjs");
const script = fs.readFileSync(new URL("../../server/public/scripts/factionops.user.js", import.meta.url), "utf8");
const b = await chromium.launch({ args: ["--no-sandbox"] });
const CHECK = "https://api.torn.com/faction/?selections=chain&";

// What a userscript manager would give the script, with GM storage and the
// Torn API stubbed: every request is logged, and only the chain check is
// answered (cfg.chain, or a live chain) or failed (cfg.fail).
const preamble = (cfg) => `(() => {
  const cfg = ${JSON.stringify(cfg)};
  const store = Object.assign({ factionops_apikey: "testkey1234" }, cfg.store || {});
  const answer = (url) => url.startsWith(${JSON.stringify(CHECK)})
    ? JSON.stringify({ chain: cfg.chain || { current: 1234, max: 2500, timeout: 42, modifier: 1, cooldown: 0 } })
    : null;
  const log = (url) => window.__reqs.push(String(url).replace(/key=[^&]*/, "key=K"));
  window.__reqs = [];
  window.unsafeWindow = window;
  window.GM_getValue = (k, d) => (k in store ? store[k] : d);
  window.GM_setValue = (k, v) => { store[k] = v; };
  window.GM_addStyle = (css) => { const s = document.createElement("style"); s.textContent = css; document.head.appendChild(s); return s; };
  window.GM_setClipboard = () => {};
  window.GM_registerMenuCommand = () => {};
  window.GM_xmlhttpRequest = (o) => {
    log(o.url);
    setTimeout(() => {
      if (cfg.fail) return o.onerror && o.onerror({});
      const body = answer(o.url);
      if (body) o.onload({ status: 200, responseText: body });
    }, 100);
  };
  if (cfg.pda) {
    window.flutter_inappwebview = { callHandler: () => Promise.resolve() };
    window.PDA_httpGet = (url) => { log(url); return Promise.resolve(answer(url) || "{}"); };
  }
})();`;

// Torn's sidebar chain bar, the way the script looks it up.
const page = ({ time = "00:42", count = "1,234/2,500", gcBanner = 0 }) => `<!doctype html><html><head><meta charset="utf-8"><title>gym</title></head><body>
${gcBanner ? '<div id="gcb-fullbar-nag" style="position:fixed;top:' + gcBanner + 'px;left:50%;transform:translateX(-50%);height:36px;width:300px">E full</div>' : ""}
<div id="sidebarroot"><a id="barChain" class="bar___x chain___x"><div class="bar-stats___x"><p class="bar-name___x">Chain:</p><p class="bar-value___x">${count}</p></div><p class="bar-timeleft___x">${time}</p></a></div>
<script src="/fo-preamble.js"></script><script src="/factionops.user.js"></script></body></html>`;

async function open(opts = {}) {
  const url = "https://www.torn.com/gym.php";
  const ctx = await b.newContext({ viewport: { width: 393, height: 800 } });
  const p = await ctx.newPage();
  const seen = [];
  await p.route("**/*", (r) => {
    const u = r.request().url();
    if (u.endsWith("/fo-preamble.js")) return r.fulfill({ contentType: "application/javascript", body: preamble(opts.cfg || {}) });
    if (u.endsWith("/factionops.user.js")) return r.fulfill({ contentType: "application/javascript", body: script });
    if (u === url) return r.fulfill({ contentType: "text/html", body: page(opts) });
    if (!u.endsWith("/favicon.ico")) seen.push(u);
    return r.fulfill({ status: 204, body: "" });
  });
  await p.goto(url, { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(2600);
  return { ctx, p, seen };
}
const bar = (p) => p.evaluate(() => {
  const e = document.getElementById("fo-chain-bar");
  if (!e) return null;
  const cs = getComputedStyle(e);
  return { text: e.textContent, anim: cs.animationName, pe: cs.pointerEvents, top: parseInt(e.style.top, 10) };
});
const setClock = (p, s) => p.evaluate((s) => { document.querySelector('[class*="bar-timeleft"]').textContent = s; }, s);
const noFocus = (p) => p.evaluate(() => { document.hasFocus = () => false; });
const checks = (p) => p.evaluate((c) => window.__reqs.filter((u) => u.startsWith(c)).length, CHECK);
const reqs = (p) => p.evaluate(() => window.__reqs.slice());
const foNodes = (p) => p.evaluate(() => [...document.querySelectorAll('[id^="fo-"],[id^="wb-"],[class^="fo-"],[class^="wb-"]')].map((e) => e.id || e.className));

let pass = 0, fail = 0;
const t = async (n, f) => { try { await f(); pass++; console.log("ok   " + n); } catch (e) { fail++; console.log("FAIL " + n + " :: " + e.message); } };

await t("off FactionOps' pages: one chain check, then the bar is up and flashing, and nothing else runs", async () => {
  const { ctx, p, seen } = await open();
  const got = await bar(p), r = await reqs(p), nodes = await foNodes(p);
  await ctx.close();
  assert.ok(got, "no bar");
  assert.strictEqual(got.text, "CHAIN DYING \u00B7 1,234 hits \u00B7 0:42 left");
  assert.strictEqual(got.anim, "fo-chain-bar-flash");
  assert.strictEqual(got.pe, "none");
  assert.deepStrictEqual(r, [CHECK + "key=K"]);
  assert.deepStrictEqual(nodes, ["fo-style-chain-bar", "fo-chain-bar"]);
  assert.deepStrictEqual(seen, []);
});

await t("it follows the sidebar: down at 4:59, up again at 0:30, with no second check", async () => {
  const { ctx, p } = await open();
  await setClock(p, "04:59");
  await p.waitForTimeout(1500);
  const after = await bar(p);
  await setClock(p, "00:30");
  await p.waitForTimeout(1500);
  const again = await bar(p), n = await checks(p);
  await ctx.close();
  assert.strictEqual(after, null, "still up at 4:59");
  assert.ok(again && again.text.endsWith("0:30 left"), JSON.stringify(again));
  assert.strictEqual(n, 1);
});

await t("a chain in its cooldown keeps it down, with no more checks", async () => {
  const { ctx, p } = await open({ cfg: { chain: { current: 1234, max: 2500, timeout: 0, modifier: 1, cooldown: 7404 } } });
  await p.waitForTimeout(2500);
  const got = await bar(p), n = await checks(p);
  await ctx.close();
  assert.strictEqual(got, null);
  assert.strictEqual(n, 1);
});

await t("a check that fails lets it up anyway", async () => {
  const { ctx, p } = await open({ cfg: { fail: true } });
  const got = await bar(p);
  await ctx.close();
  assert.ok(got && got.text.endsWith("0:42 left"), JSON.stringify(got));
});

await t("outside Torn PDA it is down while the page does not have focus", async () => {
  const { ctx, p } = await open();
  await noFocus(p);
  await p.waitForTimeout(1500);
  const got = await bar(p);
  await ctx.close();
  assert.strictEqual(got, null);
});

await t("in Torn PDA it stays up without focus, checked through PDA's own request", async () => {
  const { ctx, p } = await open({ cfg: { pda: true } });
  await noFocus(p);
  await p.waitForTimeout(1500);
  const got = await bar(p), n = await checks(p);
  await ctx.close();
  assert.ok(got, "PDA lost the bar");
  assert.strictEqual(n, 1);
});

await t("under 10 hits, or chain alerts off (PDA's string too), keeps it down", async () => {
  for (const opts of [{ count: "9/10" }, { cfg: { store: { factionops_chain_alert: false } } }, { cfg: { store: { factionops_chain_alert: "false" } } }]) {
    const { ctx, p } = await open(opts);
    const got = await bar(p);
    await ctx.close();
    assert.strictEqual(got, null, JSON.stringify(opts));
  }
});

await t("the chain-alert threshold sets when it comes up", async () => {
  const { ctx, p } = await open({ time: "01:15", cfg: { store: { factionops_chain_alert_threshold: 90 } } });
  const got = await bar(p);
  await ctx.close();
  assert.ok(got && got.text.endsWith("1:15 left"), JSON.stringify(got));
});

await t("below Gym Coach's full-bar banner while that holds the top spot, and at the top when it sits lower", async () => {
  const one = await open({ gcBanner: 10 });
  const high = await bar(one.p);
  await one.ctx.close();
  const two = await open({ gcBanner: 96 });
  const low = await bar(two.p);
  await two.ctx.close();
  assert.ok(high && low, "no bar");
  assert.strictEqual(high.top, 52);
  assert.strictEqual(low.top, 10);
});

await b.close();
console.log(`${pass} passed, ${fail} failed`);
process.exitCode = fail ? 1 : 0;
