// The chain bar in a browser, on a Torn page that is not one of FactionOps'
// own: one chain check, then up and flashing while the sidebar's chain has
// the threshold or less left; down for a chain in its cooldown, without focus
// outside Torn PDA, under 10 hits or with chain alerts off; and nothing else
// of FactionOps runs there. FactionOps' toasts, on the pages that have them,
// go under it while it is up. On Torn's phone layout, whose chain bar has no
// clock, the time comes from the chain the sidebar saves in the tab. Numbers
// and the key are made up.
import fs from "fs";
import assert from "assert";
const { chromium } = await import("/root/.hermes/hermes-agent/node_modules/playwright-core/index.mjs");
// FO_SRC points it at another copy (the mutants use it).
const script = fs.readFileSync(process.env.FO_SRC || new URL("../../server/public/scripts/factionops.user.js", import.meta.url), "utf8");
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
  // The chain Torn's sidebar saves in the tab, as the phone layout has it.
  if (cfg.saved) {
    sessionStorage.setItem("sidebarDataundefined", "{}");
    sessionStorage.setItem("sidebarData1000001", JSON.stringify({ bars: { chain: { name: "Chain", amount: cfg.saved.amount, max: 2500,
      timestampToUpdate: Math.floor(Date.now() / 1000) + cfg.saved.endIn, timeToUpdate: 300, coolDown: 0, endCoolDownTimestamp: 0 } } }));
  }
  if (cfg.pda) {
    window.flutter_inappwebview = { callHandler: () => Promise.resolve() };
    window.PDA_httpGet = (url) => { log(url); return Promise.resolve(answer(url) || "{}"); };
  }
})();`;

// Torn's sidebar chain bar, the way the script looks it up, and with `toasts`
// FactionOps' two toast stacks where its own pages have them. With `phone`,
// Torn's phone layout instead: a chain bar with the count and no clock; with
// phone "both", the two bars on one page.
const page = ({ time = "00:42", count = "1,234/2,500", gcBanner = 0, toasts = false, phone = false }) => `<!doctype html><html><head><meta charset="utf-8"><title>gym</title></head><body>
${toasts ? '<div id="fo-call-toast-container" style="position:fixed;top:10px">call</div><div id="wb-toast-container" style="position:fixed;top:10px">toast</div>' : ""}
${gcBanner ? '<div id="gcb-fullbar-nag" style="position:fixed;top:' + gcBanner + 'px;left:50%;transform:translateX(-50%);height:36px;width:300px">E full</div>' : ""}
${phone ? '<div id="sidebar" class="sidebar___x mobile___x"><a href="factions.php?step=your#/war/chain" class="chainBar___x barMobile___x"><div class="barStats___x"><p class="wai">Chain:</p><p class="barValue___x">1,234 / 2,500</p></div></a></div>' : ""}
${phone === true ? "" : '<div id="sidebarroot"><a id="barChain" class="bar___x chain___x"><div class="bar-stats___x"><p class="bar-name___x">Chain:</p><p class="bar-value___x">' + count + '</p></div><p class="bar-timeleft___x">' + time + '</p></a></div>'}
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
// The bar's bottom edge (null: no bar) and where the two toast stacks sit.
const toastTops = (p) => p.evaluate(() => {
  const e = document.getElementById("fo-chain-bar");
  return {
    bar: e ? Math.round(e.getBoundingClientRect().bottom) : null,
    call: document.getElementById("fo-call-toast-container").style.top,
    general: document.getElementById("wb-toast-container").style.top,
  };
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
  // The sidebar's 0:42 is the cooldown's own clock; the API, a little behind, says 55 s.
  const { ctx, p } = await open({ cfg: { chain: { current: 1234, max: 2500, timeout: 0, modifier: 1, cooldown: 55 } } });
  await p.waitForTimeout(2500);
  const got = await bar(p), n = await checks(p);
  await ctx.close();
  assert.strictEqual(got, null);
  assert.strictEqual(n, 1);
});

await t("a cooldown that disagrees with the sidebar's clock does not hold it down", async () => {
  // Torn has reported a cooldown for a chain that ran on: 300 s against 0:42.
  const { ctx, p } = await open({ cfg: { chain: { current: 1234, max: 2500, timeout: 0, modifier: 1, cooldown: 300 } } });
  const got = await bar(p), n = await checks(p);
  await ctx.close();
  assert.ok(got && got.text.endsWith("0:42 left"), JSON.stringify(got));
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

await t("FactionOps' toasts sit 6 px under the bar while it is up, and back at 10 px once it goes", async () => {
  const { ctx, p } = await open({ toasts: true });
  const up = await toastTops(p);
  await setClock(p, "04:59");
  await p.waitForTimeout(1500);
  const down = await toastTops(p);
  await ctx.close();
  assert.ok(up.bar > 40, JSON.stringify(up));
  assert.deepStrictEqual(up, { bar: up.bar, call: up.bar + 6 + "px", general: up.bar + 6 + "px" });
  assert.deepStrictEqual(down, { bar: null, call: "10px", general: "10px" });
});

await t("under Gym Coach's banner the bar sits lower, and the toasts go under it there", async () => {
  const { ctx, p } = await open({ toasts: true, gcBanner: 10 });
  const got = await toastTops(p), pos = await bar(p);
  await ctx.close();
  assert.ok(pos, "no bar");
  assert.strictEqual(pos.top, 52);
  assert.ok(got.bar > 80, JSON.stringify(got));
  assert.deepStrictEqual(got, { bar: got.bar, call: got.bar + 6 + "px", general: got.bar + 6 + "px" });
});

const PHONE = { phone: true };

await t("on Torn's phone layout, with no clock on the page, the sidebar's saved chain gives the time: one check, then up", async () => {
  const { ctx, p } = await open({ ...PHONE, cfg: { saved: { amount: 1234, endIn: 45 } } });
  const got = await bar(p), n = await checks(p);
  await ctx.close();
  assert.ok(got && /^CHAIN DYING \u00B7 1,234 hits \u00B7 0:4[0-4] left$/.test(got.text), JSON.stringify(got));
  assert.strictEqual(n, 1);
});

await t("on the phone layout, saved data behind the bar's count is not used", async () => {
  const { ctx, p } = await open({ ...PHONE, cfg: { saved: { amount: 1233, endIn: 45 } } });
  const got = await bar(p), n = await checks(p);
  await ctx.close();
  assert.strictEqual(got, null);
  assert.strictEqual(n, 0);
});

await t("on the phone layout, a chain in its cooldown keeps it down after its one check", async () => {
  const { ctx, p } = await open({ ...PHONE, cfg: { saved: { amount: 1234, endIn: 45 }, chain: { current: 1234, max: 2500, timeout: 0, modifier: 1, cooldown: 55 } } });
  await p.waitForTimeout(2500);
  const got = await bar(p), n = await checks(p);
  await ctx.close();
  assert.strictEqual(got, null);
  assert.strictEqual(n, 1);
});

await t("where the page has the sidebar's clock, that comes before the saved chain", async () => {
  const { ctx, p } = await open({ phone: "both", time: "04:59", cfg: { saved: { amount: 1234, endIn: 45 } } });
  const got = await bar(p), n = await checks(p);
  await ctx.close();
  assert.strictEqual(got, null);
  assert.strictEqual(n, 0);
});

await b.close();
console.log(`${pass} passed, ${fail} failed`);
process.exitCode = fail ? 1 : 0;
