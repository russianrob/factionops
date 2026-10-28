// The assist toast in a FactionOps copy that polls: a poll reply carrying a
// `lastAssistRequest` under a minute old shows "<who> needs assist on
// <target>!" with an ATK link, by long-poll (the default without a stream),
// by the short poll, and in Torn PDA, which adds its own notification. One a
// minute old shows nothing.
// The server stopped sending the field in April 2026; these pin what the
// copies already in use do once it is back. FO_SRC points it at another copy
// (git show <commit>:server/public/scripts/factionops.user.js).
// Numbers, names and the key are made up.
import fs from "fs";
import assert from "assert";
const { chromium } = await import("/root/.hermes/hermes-agent/node_modules/playwright-core/index.mjs");
const script = fs.readFileSync(process.env.FO_SRC || new URL("../../server/public/scripts/factionops.user.js", import.meta.url), "utf8");
const version = (script.match(/@version\s+(\S+)/) || [])[1];
const b = await chromium.launch({ args: ["--no-sandbox"] });

const ATTACK = "https://www.torn.com/page.php?sid=attack&user2ID=2000001";

// What a userscript manager (or Torn PDA) would give the script, with GM
// storage and the server stubbed: the sign-in answers as a member of faction
// 1000003; the first long-poll answers with the war, the next with only the
// request (what a member already caught up is handed), and later ones hang;
// every short poll answers with it; every toast with an ATK link is kept, by
// element (a toast fades in seconds, and its container comes up around the
// first one, so the same toast is added twice), and so is every PDA
// notification.
const preamble = (cfg) => `(() => {
  const cfg = ${JSON.stringify(cfg)};
  const store = { factionops_apikey: "testkey1234", factionops_use_longpoll: cfg.longpoll !== false };
  // A request as /api/assist-request builds it, cfg.ago ms old.
  const ar = { type: "assist_request", mode: "assist", playerId: 1000001, playerName: "Asker",
    targetId: 2000001, targetName: "Target2000001", attackUrl: ${JSON.stringify(ATTACK)}, timestamp: Date.now() - cfg.ago };
  let longPolls = 0;
  window.__reqs = [];
  window.__toasts = new Set();
  window.__pda = [];
  new MutationObserver((ms) => {
    for (const m of ms) for (const n of m.addedNodes) {
      if (!n.querySelectorAll) continue;
      for (const a of [n, ...n.querySelectorAll("a")]) if (a.tagName === "A" && a.textContent.trim() === "ATK") window.__toasts.add(a.parentElement);
    }
  }).observe(document.documentElement, { childList: true, subtree: true });
  const reply = (url) => {
    if (url.endsWith("/api/auth")) return { token: "jwt-test", player: { playerId: 1000002, playerName: "Tester", factionId: 1000003 } };
    if (url.includes("/api/poll-long?")) {
      longPolls++;
      if (longPolls === 1) return { v: 1, full: true, changed: {} };
      if (longPolls === 2) return { v: 1, full: false, changed: { lastAssistRequest: ar } };
      return undefined;
    }
    if (url.includes("/api/poll?")) return { lastAssistRequest: ar };
    return undefined;
  };
  window.unsafeWindow = window;
  window.GM_getValue = (k, d) => (k in store ? store[k] : d);
  window.GM_setValue = (k, v) => { store[k] = v; };
  window.GM_addStyle = (css) => { const s = document.createElement("style"); s.textContent = css; document.head.appendChild(s); return s; };
  window.GM_setClipboard = () => {};
  window.GM_registerMenuCommand = () => {};
  window.GM_xmlhttpRequest = (o) => {
    window.__reqs.push(String(o.url));
    const body = reply(String(o.url));
    if (body !== undefined) setTimeout(() => o.onload({ status: 200, responseText: JSON.stringify(body) }), 50);
  };
  if (cfg.pda) {
    window.flutter_inappwebview = { callHandler: (name, arg) => { window.__pda.push({ name, arg }); return Promise.resolve(); } };
    const answer = (url) => new Promise((resolve) => {
      window.__reqs.push(String(url));
      const body = reply(String(url));
      if (body !== undefined) setTimeout(() => resolve({ status: 200, responseText: JSON.stringify(body) }), 50);
    });
    window.PDA_httpGet = (url) => answer(url);
    window.PDA_httpPost = (url) => answer(url);
  }
})();`;

// Torn's war page with one enemy row.
const page = () => `<!doctype html><html><head><meta charset="utf-8"><title>war</title></head><body>
<div id="mainContainer"><div class="faction-war"><div class="enemy-faction"><ul class="members-list">
<li class="enemy"><div class="member___x"><a href="/profiles.php?XID=2000002">Enemy2000002</a></div><div class="points___x">10</div><div class="status___x">Okay</div><div class="attack___x"><a class="t-blue" href="/loader.php?sid=attack&user2ID=2000002">Attack</a></div></li>
</ul></div></div></div>
<script src="/fo-preamble.js"></script><script src="/factionops.user.js"></script></body></html>`;

async function open(cfg = {}) {
  const url = "https://www.torn.com/factions.php?step=your#/war/rank";
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
  const p = await ctx.newPage();
  await p.route("**/*", (r) => {
    const u = r.request().url();
    if (u.endsWith("/fo-preamble.js")) return r.fulfill({ contentType: "application/javascript", body: preamble({ ago: 2000, ...cfg }) });
    if (u.endsWith("/factionops.user.js")) return r.fulfill({ contentType: "application/javascript", body: script });
    if (u.startsWith("https://www.torn.com/factions.php")) return r.fulfill({ contentType: "text/html", body: page() });
    return r.fulfill({ status: 204, body: "" });
  });
  await p.goto(url, { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(cfg.wait || 4000);
  return { ctx, p };
}
// Each toast the page showed: its words and where its ATK link goes.
const toasts = (p) => p.evaluate(() => [...window.__toasts].map((e) => ({
  text: e.textContent.replace(/\s+/g, " ").trim().replace(/ ?ATK$/, ""),
  atk: e.querySelector("a").href,
})));
const SHOWN = [{ text: "⚔️ Asker needs assist on Target2000001!", atk: ATTACK }];
const asked = (p, part) => p.evaluate((x) => window.__reqs.filter((u) => u.includes(x)).length, part);

let pass = 0, fail = 0;
const t = async (n, f) => { try { await f(); pass++; console.log("ok   " + n); } catch (e) { fail++; console.log("FAIL " + n + " :: " + e.message); } };
console.log("FactionOps " + version);

await t("by long-poll: the request shows as a toast with an ATK link to the target", async () => {
  const { ctx, p } = await open();
  const shown = await toasts(p), lp = await asked(p, "/api/poll-long?");
  await ctx.close();
  assert.ok(lp > 0, "never long-polled");
  assert.deepStrictEqual(shown, SHOWN);
});

await t("by the short poll: the same toast", async () => {
  const { ctx, p } = await open({ longpoll: false });
  const shown = await toasts(p), polls = await asked(p, "/api/poll?");
  await ctx.close();
  assert.ok(polls > 0, "never polled");
  assert.deepStrictEqual(shown, SHOWN);
});

await t("in Torn PDA: the toast and PDA's own notification", async () => {
  const { ctx, p } = await open({ pda: true });
  const shown = await toasts(p);
  const notes = await p.evaluate(() => window.__pda.filter((c) => c.name === "scheduleNotification").map((c) => c.arg && c.arg.title));
  await ctx.close();
  assert.deepStrictEqual(shown, SHOWN);
  assert.ok(notes.some((s) => /Assist Needed/.test(String(s))), JSON.stringify(notes));
});

await t("a request a minute old shows nothing", async () => {
  const { ctx, p } = await open({ ago: 61000 });
  const shown = await toasts(p), polls = await asked(p, "/api/poll");
  await ctx.close();
  assert.ok(polls > 0, "never polled");
  assert.deepStrictEqual(shown, []);
});

await b.close();
console.log(`${pass} passed, ${fail} failed`);
process.exitCode = fail ? 1 : 0;
