// FactionOps on the war page when the server turns down an outdated copy.
// Answered 403 at sign-in, a copy from 5.5.3 on takes its CALL buttons and
// filter bar off the war page, keeps them off when Torn repaints the list,
// and says why; then it carries on with the sign-in it saved, so it still
// polls the server and its chain bar still comes up. Signed in, the same page
// gets its buttons, which shows the page is one the script dresses.
// The runs that matter point FO_SRC at the old copies themselves
// (git show <commit>:server/public/scripts/factionops.user.js).
// Numbers, names and the key are made up.
import fs from "fs";
import assert from "assert";
const { chromium } = await import("/root/.hermes/hermes-agent/node_modules/playwright-core/index.mjs");
const script = fs.readFileSync(process.env.FO_SRC || new URL("../../server/public/scripts/factionops.user.js", import.meta.url), "utf8");
const version = (script.match(/@version\s+(\S+)/) || [])[1];
const hasChainBar = script.includes("fo-chain-bar");
const b = await chromium.launch({ args: ["--no-sandbox"] });

const MSG = "FactionOps 5.6.25 is outdated: update to v5.6.26 or newer to use it on the war page. Open Tampermonkey → Check for userscript updates.";
const CHECK = "https://api.torn.com/faction/?selections=chain&";
// The sign-in an earlier visit saved, as the server issues it: only the
// payload is read on the client.
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const SAVED = b64({ alg: "HS256", typ: "JWT" }) + "." + b64({ playerId: 1000002, playerName: "Tester", factionId: 1000003, exp: 9999999999 }) + ".sig";

// What a userscript manager would give the script, with GM storage and the
// server stubbed: every request is logged with the token it carries, every
// node the page adds is kept (a toast fades in seconds), the
// sign-in is answered with cfg.auth, the chain check with a live chain, and
// nothing else is answered (a long poll simply hangs).
const preamble = (cfg) => `(() => {
  const cfg = ${JSON.stringify(cfg)};
  const store = { factionops_apikey: "testkey1234", factionops_jwt: ${JSON.stringify(SAVED)} };
  window.__reqs = [];
  // Everything the page is told, kept: a toast fades after a few seconds.
  window.__said = [];
  new MutationObserver((ms) => { for (const m of ms) for (const n of m.addedNodes) if (n.textContent) window.__said.push(n.textContent); })
    .observe(document.documentElement, { childList: true, subtree: true });
  window.unsafeWindow = window;
  window.GM_getValue = (k, d) => (k in store ? store[k] : d);
  window.GM_setValue = (k, v) => { store[k] = v; };
  window.GM_deleteValue = (k) => { delete store[k]; };
  window.GM_addStyle = (css) => { const s = document.createElement("style"); s.textContent = css; document.head.appendChild(s); return s; };
  window.GM_setClipboard = () => {};
  window.GM_registerMenuCommand = () => {};
  window.GM_xmlhttpRequest = (o) => {
    const url = String(o.url).replace(/key=[^&]*/, "key=K");
    const auth = (o.headers && o.headers.Authorization) || "";
    window.__reqs.push({ method: o.method || "GET", url, auth });
    let reply = null;
    if (url.endsWith("/api/auth")) reply = cfg.auth;
    else if (url.startsWith(${JSON.stringify(CHECK)})) reply = { status: 200, body: { chain: { current: 1234, max: 2500, timeout: 42, modifier: 1, cooldown: 0 } } };
    if (reply) setTimeout(() => o.onload({ status: reply.status, responseText: JSON.stringify(reply.body) }), 50);
  };
})();`;

const OK = { status: 200, body: { token: "jwt-fresh", player: { playerId: 1000002, playerName: "Tester", factionId: 1000003 } } };
const OUTDATED = { status: 403, body: { error: MSG, outdated: true, updateUrl: "https://tornwar.com/scripts/factionops.user.js" } };

// An enemy row on Torn's war page, the way the script finds it.
const row = (id) => `<li class="enemy"><div class="member___x"><a href="/profiles.php?XID=${id}">Enemy${id}</a></div>`
  + `<div class="points___x">10</div><div class="status___x">Okay</div>`
  + `<div class="attack___x"><a class="t-blue" href="/loader.php?sid=attack&user2ID=${id}">Attack</a></div></li>`;
const page = () => `<!doctype html><html><head><meta charset="utf-8"><title>war</title></head><body>
<div id="sidebarroot"><a id="barChain" class="bar___x chain___x"><div class="bar-stats___x"><p class="bar-name___x">Chain:</p><p class="bar-value___x">1,234/2,500</p></div><p class="bar-timeleft___x">00:42</p></a></div>
<div id="mainContainer"><div class="faction-war"><div class="enemy-faction"><ul class="members-list">
${row(1000011)}${row(1000012)}${row(1000013)}
</ul></div></div></div>
<script src="/fo-preamble.js"></script><script src="/factionops.user.js"></script></body></html>`;

async function open(auth) {
  const url = "https://www.torn.com/factions.php?step=your#/war/rank";
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
  const p = await ctx.newPage();
  await p.route("**/*", (r) => {
    const u = r.request().url();
    if (u.endsWith("/fo-preamble.js")) return r.fulfill({ contentType: "application/javascript", body: preamble({ auth }) });
    if (u.endsWith("/factionops.user.js")) return r.fulfill({ contentType: "application/javascript", body: script });
    if (u.startsWith("https://www.torn.com/factions.php")) return r.fulfill({ contentType: "text/html", body: page() });
    return r.fulfill({ status: 204, body: "" });
  });
  await p.goto(url, { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(3000);
  return { ctx, p };
}
const furniture = (p) => p.evaluate(() => ({
  buttons: document.querySelectorAll(".fo-wp-call").length,
  filter: !!document.getElementById("fo-wp-filter"),
  tinted: document.querySelectorAll(".fo-called-row").length,
}));
// Torn repaints the list: one more row arrives.
const addRow = (p, html) => p.evaluate((h) => { document.querySelector("ul.members-list").insertAdjacentHTML("beforeend", h); }, html);
const said = (p, text) => p.evaluate((t) => window.__said.some((s) => s.includes(t)), text);

let pass = 0, fail = 0;
const t = async (n, f) => { try { await f(); pass++; console.log("ok   " + n); } catch (e) { fail++; console.log("FAIL " + n + " :: " + e.message); } };
console.log("FactionOps " + version);

await t("signed in, the war page gets a CALL button on each enemy and the filter bar", async () => {
  const { ctx, p } = await open(OK);
  const got = await furniture(p);
  await ctx.close();
  assert.deepStrictEqual(got, { buttons: 3, filter: true, tinted: 0 });
});

await t("signed in, a row Torn adds later gets its button too", async () => {
  const { ctx, p } = await open(OK);
  await addRow(p, row(1000014));
  await p.waitForTimeout(6000);
  const got = await furniture(p);
  await ctx.close();
  assert.strictEqual(got.buttons, 4);
});

await t("turned down as outdated, the war page has no buttons and no filter bar, and says why", async () => {
  const { ctx, p } = await open(OUTDATED);
  const got = await furniture(p), told = await said(p, MSG);
  await ctx.close();
  assert.deepStrictEqual(got, { buttons: 0, filter: false, tinted: 0 });
  assert.ok(told, "no toast with the server's message");
});

await t("turned down as outdated, a row Torn adds later gets no button either", async () => {
  const { ctx, p } = await open(OUTDATED);
  await addRow(p, row(1000014));
  await p.waitForTimeout(6000);
  const got = await furniture(p);
  await ctx.close();
  assert.deepStrictEqual(got, { buttons: 0, filter: false, tinted: 0 });
});

await t("turned down as outdated, it keeps asking the server for the war with the sign-in it saved", async () => {
  const { ctx, p } = await open(OUTDATED);
  const war = await p.evaluate((saved) => window.__reqs.filter((r) =>
    /\/api\/(poll|poll-long|stream)\?/.test(r.url) && (r.auth === "Bearer " + saved || r.url.includes("token=" + encodeURIComponent(saved)))
  ).map((r) => r.url.split("?")[0]), SAVED);
  await ctx.close();
  assert.ok(war.length > 0, "no war request with the saved sign-in");
});

await t("turned down as outdated, the chain bar still comes up for a dying chain", async () => {
  if (!hasChainBar) { console.log("     (no chain bar before 5.6.21)"); return; }
  const { ctx, p } = await open(OUTDATED);
  const bar = await p.evaluate(() => { const e = document.getElementById("fo-chain-bar"); return e ? e.textContent : null; });
  await ctx.close();
  assert.strictEqual(bar, "CHAIN DYING · 1,234 hits · 0:42 left");
});

await b.close();
console.log(`${pass} passed, ${fail} failed`);
process.exitCode = fail ? 1 : 0;
