// FactionOps' broadcast bar in a browser. On a Torn page that is not one of
// FactionOps' own, a broadcast this device holds is up, flashing for 10 s,
// then steady until a tap takes it down on every tab; signed in, the page asks
// the server for the latest when it loads and every 15 s after, one ask per
// 15 s across tabs, and rests 10 minutes after a refusal; the bar sits under Gym Coach's banner and the
// chain bar, with FactionOps' toasts under it. On the war page, the stream,
// the long-poll and the short poll each put it up at once. Ids, names and the
// key are made up.
import fs from "fs";
import assert from "assert";
const { chromium } = await import("/root/.hermes/hermes-agent/node_modules/playwright-core/index.mjs");
// FO_SRC points it at another copy (the mutants use it).
const script = fs.readFileSync(process.env.FO_SRC || new URL("../../server/public/scripts/factionops.user.js", import.meta.url), "utf8");
const version = (script.match(/@version\s+(\S+)/) || [])[1];
const b = await chromium.launch({ args: ["--no-sandbox"] });
const CHECK = "https://api.torn.com/faction/?selections=chain&";
const LATEST = "/api/broadcast/latest";

// A broadcast as the bar keeps it; the preamble adds `until`.
const REC = { key: "1700000000000:1000001", message: "Let chain die", senderName: "Tester", senderRole: "leader", ts: 1700000000000 };
// The page-load answer for a broadcast 2 s old.
const ANSWER = { status: 200, body: { broadcast: { message: "Hold hits", type: "warning", senderName: "Tester", senderId: "1000001", senderRole: "leader", ts: 1700000005000, age: 2000 } } };

// What a userscript manager (or Torn PDA) would give the script, with GM
// storage and the server stubbed. cfg.held puts REC (with cfg.rec over it) in
// storage, held for that many ms more; cfg.latest answers the asks for the
// latest, or window.__latest once a test sets it;
// the chain check gets a live chain. Every request is logged with the
// sign-in it carries.
const preamble = (cfg) => `(() => {
  const cfg = ${JSON.stringify(cfg)};
  const store = Object.assign({ factionops_apikey: "testkey1234" }, cfg.store || {});
  if (cfg.held !== undefined) store.factionops_bcast = JSON.stringify(Object.assign({}, ${JSON.stringify(REC)}, cfg.rec || {}, { until: Date.now() + cfg.held }));
  window.__store = store;
  window.__reqs = [];
  const reply = (url) => {
    if (url.startsWith(${JSON.stringify(CHECK)})) return { status: 200, body: { chain: { current: 1234, max: 2500, timeout: 42, modifier: 1, cooldown: 0 } } };
    if (url.endsWith(${JSON.stringify(LATEST)})) return window.__latest !== undefined ? window.__latest : (cfg.latest || null);
    return null;
  };
  const log = (url, headers, via) => window.__reqs.push({ url: String(url).replace(/key=[^&]*/, "key=K"), auth: (headers && headers.Authorization) || "", via });
  window.unsafeWindow = window;
  window.GM_getValue = (k, d) => (k in store ? store[k] : d);
  window.GM_setValue = (k, v) => { store[k] = v; };
  window.GM_addStyle = (css) => { const s = document.createElement("style"); s.textContent = css; document.head.appendChild(s); return s; };
  window.GM_setClipboard = () => {};
  window.GM_registerMenuCommand = () => {};
  window.GM_xmlhttpRequest = (o) => {
    log(o.url, o.headers, "gm");
    const r = reply(String(o.url));
    if (r) setTimeout(() => o.onload({ status: r.status, responseText: JSON.stringify(r.body) }), 50);
  };
  if (cfg.pda) {
    window.flutter_inappwebview = { callHandler: () => Promise.resolve() };
    window.PDA_httpGet = (url, headers) => {
      log(url, headers, "pda");
      const r = reply(String(url));
      return Promise.resolve(r ? JSON.stringify(r.body) : "{}");
    };
  }
})();`;

// A Torn page that is not one of FactionOps' own. With `chain`, Torn's sidebar
// chain bar with 0:42 left (the chain bar comes up); with `toasts`,
// FactionOps' two toast stacks; with `gcBanner`, Gym Coach's banner at that top.
const page = ({ chain = false, toasts = false, gcBanner = 0 }) => `<!doctype html><html><head><meta charset="utf-8"><title>gym</title></head><body>
${toasts ? '<div id="fo-call-toast-container" style="position:fixed;top:10px">call</div><div id="wb-toast-container" style="position:fixed;top:10px">toast</div>' : ""}
${gcBanner ? '<div id="gcb-fullbar-nag" style="position:fixed;top:' + gcBanner + 'px;left:50%;transform:translateX(-50%);height:36px;width:300px">E full</div>' : ""}
${chain ? '<div id="sidebarroot"><a id="barChain" class="bar___x chain___x"><div class="bar-stats___x"><p class="bar-name___x">Chain:</p><p class="bar-value___x">1,234/2,500</p></div><p class="bar-timeleft___x">00:42</p></a></div>' : ""}
<script src="/fo-preamble.js"></script><script src="/factionops.user.js"></script></body></html>`;

async function open(opts = {}) {
  const url = "https://www.torn.com/gym.php";
  const ctx = await b.newContext({ viewport: { width: 393, height: 800 } });
  const p = await ctx.newPage();
  await p.route("**/*", (r) => {
    const u = r.request().url();
    if (u.endsWith("/fo-preamble.js")) return r.fulfill({ contentType: "application/javascript", body: preamble(opts.cfg || {}) });
    if (u.endsWith("/factionops.user.js")) return r.fulfill({ contentType: "application/javascript", body: script });
    if (u === url) return r.fulfill({ contentType: "text/html", body: page(opts) });
    return r.fulfill({ status: 204, body: "" });
  });
  await p.goto(url, { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(opts.wait || 2600);
  return { ctx, p };
}
const bar = (p) => p.evaluate(() => {
  const e = document.getElementById("fo-bcast-bar");
  if (!e) return null;
  const cs = getComputedStyle(e), r = e.getBoundingClientRect();
  return { text: e.textContent, anim: cs.animationName, pe: cs.pointerEvents, top: Math.round(r.top), bottom: Math.round(r.bottom), imgs: e.querySelectorAll("img").length };
});
const asks = (p) => p.evaluate((x) => window.__reqs.filter((q) => q.url.endsWith(x)), LATEST);
const kept = (p) => p.evaluate(() => Object.assign({}, window.__store));
const bcastNodes = (p) => p.evaluate(() => [...document.querySelectorAll('[id^="fo-bcast"],[id^="fo-style-bcast"]')].map((e) => e.id));

let pass = 0, fail = 0;
// FO_ONLY, a pattern, runs just the tests it names (the mutants use it).
const only = process.env.FO_ONLY ? new RegExp(process.env.FO_ONLY) : null;
const t = async (n, f) => {
  if (only && !only.test(n)) return;
  try { await f(); pass++; console.log("ok   " + n); } catch (e) { fail++; console.log("FAIL " + n + " :: " + e.message); }
};
console.log("FactionOps " + version);

await t("a broadcast this device holds is up on any page, flashing, with who sent it, and a tap takes it down", async () => {
  const { ctx, p } = await open({ cfg: { held: 600000 } });
  const got = await bar(p);
  await p.click("#fo-bcast-bar");
  await p.waitForTimeout(300);
  const after = await bar(p), store = await kept(p);
  await ctx.close();
  assert.ok(got, "no bar");
  assert.strictEqual(got.text, "\u{1F4E3} Let chain die · Tester (leader)");
  assert.strictEqual(got.anim, "fo-bcast-flash");
  assert.strictEqual(got.pe, "auto");
  assert.strictEqual(after, null, "still up after a tap");
  assert.strictEqual(store.factionops_bcast_dismissed, REC.key);
});

await t("after 10 s it stops flashing and holds", async () => {
  const { ctx, p } = await open({ cfg: { held: 600000 } });
  await p.waitForTimeout(9500);
  const got = await bar(p);
  await ctx.close();
  assert.ok(got, "gone after 10 s");
  assert.strictEqual(got.anim, "none");
});

await t("a dismissed or expired broadcast shows nothing and adds nothing to the page", async () => {
  const one = await open({ cfg: { held: 600000, store: { factionops_bcast_dismissed: REC.key } } });
  const dismissed = await bcastNodes(one.p);
  await one.ctx.close();
  const two = await open({ cfg: { held: -1000 } });
  const expired = await bcastNodes(two.p);
  await two.ctx.close();
  assert.deepStrictEqual(dismissed, []);
  assert.deepStrictEqual(expired, []);
});

await t("signed in, the page asks once for the latest and puts it up; the next page within 15 s does not ask", async () => {
  const one = await open({ cfg: { store: { factionops_jwt: "jwt-test" }, latest: ANSWER } });
  const first = await asks(one.p), shown = await bar(one.p), store = await kept(one.p);
  await one.ctx.close();
  const two = await open({ cfg: { store, latest: ANSWER } });
  const second = await asks(two.p), still = await bar(two.p);
  await two.ctx.close();
  assert.deepStrictEqual(first.map((q) => q.auth), ["Bearer jwt-test"]);
  assert.ok(shown, "no bar");
  assert.strictEqual(shown.text, "\u{1F4E3} Hold hits · Tester (leader)");
  assert.deepStrictEqual(second, [], "asked again within 15 s");
  assert.ok(still, "the next page lost the bar");
});

await t("a page-load answer 9 minutes old holds only the minute left", async () => {
  const late = { status: 200, body: { broadcast: { ...ANSWER.body.broadcast, age: 540000 } } };
  const { ctx, p } = await open({ cfg: { store: { factionops_jwt: "jwt-test" }, latest: late } });
  const left = await p.evaluate(() => JSON.parse(window.__store.factionops_bcast).until - Date.now());
  await ctx.close();
  assert.ok(left > 55000 && left <= 60000, "left " + left);
});

await t("the same broadcast again after a tap stays down", async () => {
  const one = await open({ cfg: { store: { factionops_jwt: "jwt-test" }, latest: ANSWER } });
  await one.p.click("#fo-bcast-bar");
  const store = await kept(one.p);
  await one.ctx.close();
  delete store.factionops_bcast_next_check;
  const two = await open({ cfg: { store, latest: ANSWER } });
  const asked = await asks(two.p), got = await bar(two.p);
  await two.ctx.close();
  assert.strictEqual(asked.length, 1, "the second page did not ask");
  assert.strictEqual(got, null, "a tapped broadcast came back");
});

const EMPTY = { status: 200, body: { broadcast: null } };

await t("signed in, a broadcast sent while the page is open is up at the next check, 15 s on, with no reload", async () => {
  const { ctx, p } = await open({ cfg: { store: { factionops_jwt: "jwt-test" }, latest: EMPTY } });
  const before = await bar(p);
  await p.evaluate((a) => { window.__latest = a; }, ANSWER);
  await p.waitForTimeout(15000);
  const after = await bar(p), asked = await asks(p);
  await ctx.close();
  assert.strictEqual(before, null);
  assert.ok(after && after.text === "\u{1F4E3} Hold hits · Tester (leader)", JSON.stringify(after));
  assert.strictEqual(asked.length, 2, "asks: " + asked.length);
});

await t("a tapped broadcast stays down when the next check brings it again", async () => {
  const { ctx, p } = await open({ cfg: { store: { factionops_jwt: "jwt-test" }, latest: ANSWER } });
  await p.click("#fo-bcast-bar");
  await p.waitForTimeout(15000);
  const got = await bar(p), asked = await asks(p);
  await ctx.close();
  assert.strictEqual(asked.length, 2, "asks: " + asked.length);
  assert.strictEqual(got, null, "a tapped broadcast came back");
});

await t("a refused sign-in waits 10 minutes before asking again", async () => {
  const { ctx, p } = await open({ cfg: { store: { factionops_jwt: "jwt-old" }, latest: { status: 401, body: { error: "Invalid token" } } } });
  const wait = await p.evaluate(() => Number(window.__store.factionops_bcast_next_check) - Date.now());
  await ctx.close();
  assert.ok(wait > 590000 && wait <= 600000, "waits " + wait);
});

await t("without a sign-in it never asks", async () => {
  const { ctx, p } = await open({ cfg: { latest: ANSWER } });
  const asked = await asks(p), got = await bar(p);
  await ctx.close();
  assert.deepStrictEqual(asked, []);
  assert.strictEqual(got, null);
});

await t("on Torn PDA the ask goes by PDA's own GET, with the sign-in", async () => {
  const { ctx, p } = await open({ cfg: { pda: true, store: { factionops_jwt: "jwt-test" }, latest: ANSWER } });
  const asked = await asks(p), got = await bar(p);
  await ctx.close();
  assert.deepStrictEqual(asked.map((q) => [q.via, q.auth]), [["pda", "Bearer jwt-test"]]);
  assert.ok(got && got.text.startsWith("\u{1F4E3} Hold hits"), JSON.stringify(got));
});

await t("under the chain bar when both are up, and FactionOps' toasts under both", async () => {
  const { ctx, p } = await open({ chain: true, toasts: true, cfg: { held: 600000 } });
  const got = await bar(p);
  const at = await p.evaluate(() => ({
    chain: Math.round(document.getElementById("fo-chain-bar").getBoundingClientRect().bottom),
    call: document.getElementById("fo-call-toast-container").style.top,
    general: document.getElementById("wb-toast-container").style.top,
  }));
  await ctx.close();
  assert.ok(got, "no bar");
  assert.strictEqual(got.top, at.chain + 6);
  assert.strictEqual(at.call, got.bottom + 6 + "px");
  assert.strictEqual(at.general, got.bottom + 6 + "px");
});

await t("under Gym Coach's banner when that holds the top", async () => {
  const { ctx, p } = await open({ gcBanner: 10, cfg: { held: 600000 } });
  const got = await bar(p);
  await ctx.close();
  assert.ok(got, "no bar");
  assert.strictEqual(got.top, 52);
});

await t("a broadcast another tab takes shows here within a second", async () => {
  const { ctx, p } = await open({ cfg: {} });
  const before = await bar(p);
  await p.evaluate((rec) => window.GM_setValue("factionops_bcast", JSON.stringify(Object.assign({}, rec, { until: Date.now() + 600000 }))), REC);
  await p.waitForTimeout(1200);
  const after = await bar(p);
  await ctx.close();
  assert.strictEqual(before, null);
  assert.ok(after && after.text.startsWith("\u{1F4E3} Let chain die"), JSON.stringify(after));
});

await t("the message is text, never markup", async () => {
  const { ctx, p } = await open({ cfg: { held: 600000, rec: { message: '<img src=x onerror="window.__xss=1">Hold' } } });
  const got = await bar(p), xss = await p.evaluate(() => window.__xss);
  await ctx.close();
  assert.ok(got, "no bar");
  assert.strictEqual(got.imgs, 0);
  assert.ok(got.text.startsWith("\u{1F4E3} <img"), got.text);
  assert.strictEqual(xss, undefined);
});

// ---- On the war page -----------------------------------------------------

// A broadcast as /api/broadcast sends it, 1 s old, built in the page.
const SENT = `{ message: "Let chain die", type: "warning", senderName: "Tester", senderId: "1000001", senderRole: "leader", ts: Date.now() - 1000 }`;

// The war page's server, stubbed: the sign-in answers as a member of faction
// 1000003 in position cfg.pos (after cfg.authFails refusals, as Torn refuses a
// dead key); the roles answer cfg.roles, the picks answer (a 13th pick
// is refused, as the server does), and the send answers cfg.send after
// cfg.sendDelay ms; the first
// long-poll answers with the war and the second with cfg.lp's broadcasts,
// later ones hang; every short poll answers with cfg.poll's; with cfg.stream,
// the stream starts and carries one global_toast. POST bodies are kept, and
// so is every node's text (a toast fades in seconds).
const warPreamble = (cfg) => `(() => {
  const cfg = ${JSON.stringify(cfg)};
  const store = Object.assign({ factionops_apikey: "testkey1234", factionops_use_longpoll: cfg.longpoll !== false }, cfg.store || {});
  window.__store = store;
  const sent = ${SENT};
  let longPolls = 0, auths = 0;
  window.__reqs = [];
  window.__posts = [];
  window.__said = [];
  window.__picks = cfg.picks || ["Let chain die", "Good work all!"];
  new MutationObserver((ms) => { for (const m of ms) for (const n of m.addedNodes) if (n.textContent) window.__said.push(n.textContent); })
    .observe(document.documentElement, { childList: true, subtree: true });
  const reply = (url, method, data) => {
    if (url.endsWith("/api/auth")) {
      if (++auths <= (cfg.authFails || 0)) return { status: 401, body: { error: "Torn API error: Incorrect key (code 2)" } };
      return { status: 200, body: { token: "jwt-test", player: { playerId: 1000002, playerName: "Tester", factionId: 1000003, factionPosition: "pos" in cfg ? cfg.pos : "Member" } } };
    }
    if (url.includes("/api/broadcast/roles")) return { status: 200, body: { roles: cfg.roles || ["leader", "co-leader", "war leader", "banker"] } };
    if (url.includes("/api/broadcast/picks")) {
      if (method === "POST") {
        const q = JSON.parse(data || "{}");
        if (typeof q.add === "string" && window.__picks.length >= 12) return { status: 400, body: { error: "Up to 12 quick picks: remove one first." } };
        if (typeof q.add === "string") window.__picks = window.__picks.concat([q.add]);
        if (typeof q.remove === "string") window.__picks = window.__picks.filter((x) => x !== q.remove);
      }
      return { status: 200, body: { picks: window.__picks } };
    }
    if (url.endsWith("/api/broadcast")) return cfg.send || { status: 200, body: { success: true } };
    if (url.includes("/api/poll-long?")) {
      longPolls++;
      if (longPolls === 1) return { status: 200, body: { v: 1, full: true, changed: {} } };
      if (longPolls === 2 && cfg.lp) return { status: 200, body: { v: 1, full: false, changed: { broadcasts: Array(cfg.lp).fill(sent) } } };
      return null;
    }
    if (url.includes("/api/poll?")) return { status: 200, body: cfg.poll ? { broadcasts: Array(cfg.poll).fill(sent) } : {} };
    return null;
  };
  window.unsafeWindow = window;
  window.GM_getValue = (k, d) => (k in store ? store[k] : d);
  window.GM_setValue = (k, v) => { store[k] = v; };
  window.GM_deleteValue = (k) => { delete store[k]; };
  window.GM_addStyle = (css) => { const s = document.createElement("style"); s.textContent = css; document.head.appendChild(s); return s; };
  window.GM_setClipboard = () => {};
  window.GM_registerMenuCommand = () => {};
  window.GM_xmlhttpRequest = (o) => {
    const url = String(o.url), method = o.method || "GET";
    window.__reqs.push({ method, url, auth: (o.headers && o.headers.Authorization) || "" });
    if (method === "POST") window.__posts.push({ url, body: JSON.parse(o.data || "null") });
    if (url.includes("/api/stream?")) {
      if (cfg.stream) setTimeout(() => {
        if (o.onloadstart) o.onloadstart();
        o.onprogress({ responseText: "data: " + JSON.stringify(Object.assign({}, sent, { type: "global_toast", toastSeverity: "warning" })) + "\\n\\n" });
      }, 300);
      return { abort() {} };
    }
    const r = reply(url, method, o.data);
    const wait = url.endsWith("/api/broadcast") && cfg.sendDelay ? cfg.sendDelay : 50;
    if (r) setTimeout(() => o.onload({ status: r.status, responseText: JSON.stringify(r.body) }), wait);
    return { abort() {} };
  };
})();`;

// Torn's war page with three enemy rows.
const row = (id) => `<li class="enemy"><div class="member___x"><a href="/profiles.php?XID=${id}">Enemy${id}</a></div>`
  + `<div class="points___x">10</div><div class="status___x">Okay</div>`
  + `<div class="attack___x"><a class="t-blue" href="/loader.php?sid=attack&user2ID=${id}">Attack</a></div></li>`;
const warPage = () => `<!doctype html><html><head><meta charset="utf-8"><title>war</title></head><body>
<div id="mainContainer"><div class="faction-war"><div class="enemy-faction"><ul class="members-list">
${row(2000001)}${row(2000002)}${row(2000003)}
</ul></div></div></div>
<script src="/fo-preamble.js"></script><script src="/factionops.user.js"></script></body></html>`;

async function openWar(cfg = {}) {
  const url = "https://www.torn.com/factions.php?step=your#/war/rank";
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
  const p = await ctx.newPage();
  await p.route("**/*", (r) => {
    const u = r.request().url();
    if (u.endsWith("/fo-preamble.js")) return r.fulfill({ contentType: "application/javascript", body: warPreamble(cfg) });
    if (u.endsWith("/factionops.user.js")) return r.fulfill({ contentType: "application/javascript", body: script });
    if (u.startsWith("https://www.torn.com/factions.php")) return r.fulfill({ contentType: "text/html", body: warPage() });
    return r.fulfill({ status: 204, body: "" });
  });
  await p.goto(url, { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(cfg.wait || 4000);
  return { ctx, p };
}

const SHOWN = "\u{1F4E3} Let chain die · Tester (leader)";

// A sign-in FactionOps saved earlier, for a member of faction 1000003 in
// `position`: what it falls back to when Torn refuses the key.
const savedJwt = (position) => "h." + Buffer.from(JSON.stringify({ playerId: 1000002, playerName: "Tester",
  factionId: 1000003, factionName: "Testers", factionPosition: position })).toString("base64url") + ".s";
// A faction whose broadcast roles include a position of its own.
const ROLES = ["leader", "co-leader", "warden"];

await t("a long-poll reply's broadcasts put the bar up at once", async () => {
  const { ctx, p } = await openWar({ lp: 1 });
  const got = await bar(p);
  await ctx.close();
  assert.ok(got, "no bar");
  assert.strictEqual(got.text, SHOWN);
});

await t("the short poll's broadcasts do the same", async () => {
  const { ctx, p } = await openWar({ longpoll: false, poll: 1 });
  const got = await bar(p);
  await ctx.close();
  assert.ok(got, "no bar");
  assert.strictEqual(got.text, SHOWN);
});

await t("by the stream: a global_toast puts the bar up", async () => {
  const { ctx, p } = await openWar({ stream: true });
  const got = await bar(p);
  await ctx.close();
  assert.ok(got, "no bar");
  assert.strictEqual(got.text, SHOWN);
});

await t("the same broadcast twice is one bar, and a tap holds against a later poll", async () => {
  const { ctx, p } = await openWar({ longpoll: false, poll: 2 });
  const polls = () => p.evaluate(() => window.__reqs.filter((q) => q.url.includes("/api/poll?")).length);
  const bars = await p.evaluate(() => document.querySelectorAll("#fo-bcast-bar").length);
  await p.click("#fo-bcast-bar");
  const atTap = await polls();
  // The short poll runs every 5 s in a war and every 20 s without one.
  for (let waited = 0; waited < 25000 && (await polls()) === atTap; waited += 500) await p.waitForTimeout(500);
  await p.waitForTimeout(1500);
  const later = await polls(), after = await bar(p);
  await ctx.close();
  assert.strictEqual(bars, 1);
  assert.ok(later > atTap, "no poll after the tap");
  assert.strictEqual(after, null, "a later poll brought it back");
});

// ---- The war page's 📣 and its box ----------------------------------------

// The war page as a leader, once the 📣 is drawn.
async function openLeader(cfg = {}) {
  const w = await openWar(Object.assign({ pos: "Leader", wait: 1000 }, cfg));
  await w.p.waitForSelector("#fo-wp-bcast", { timeout: 15000 });
  return w;
}
// ...and the box open, its picks answered.
async function openBox(cfg) {
  const w = await openLeader(cfg);
  await w.p.click("#fo-wp-bcast");
  await w.p.waitForSelector("#fo-bc-box .fo-bc-add");
  await w.p.waitForTimeout(300);
  return w;
}
const picksRow = (p) => p.evaluate(() => [...document.querySelectorAll("#fo-bc-picks .fo-bc-pick-text")].map((e) => e.textContent));
const posted = (p, end) => p.evaluate((x) => window.__posts.filter((q) => q.url.endsWith(x)).map((q) => q.body), end);
const note = (p) => p.evaluate(() => document.getElementById("fo-bc-note").textContent);
const HOLD = { message: "Hold hits", type: "warning", warId: "war_1000003" };

await t("a leader gets 📣 Broadcast after ⚙, and a member gets none", async () => {
  const lead = await openLeader();
  // One more 5 s pass: drawn once, not once a pass.
  await lead.p.waitForTimeout(5500);
  const got = await lead.p.evaluate(() => {
    const b = document.getElementById("fo-wp-bcast");
    return { text: b.textContent, prev: b.previousElementSibling && b.previousElementSibling.id,
      title: b.hasAttribute("title"), n: document.querySelectorAll("#fo-wp-bcast").length };
  });
  await lead.ctx.close();
  const mem = await openWar({ pos: "Member", wait: 9000 });
  const none = await mem.p.evaluate(() => ({ bar: !!document.getElementById("fo-wp-filter"), btn: document.querySelectorAll("#fo-wp-bcast").length }));
  await mem.ctx.close();
  assert.deepStrictEqual(got, { text: "\u{1F4E3} Broadcast", prev: "fo-wp-settings", title: false, n: 1 });
  assert.deepStrictEqual(none, { bar: true, btn: 0 });
});

await t("a refused sign-in: the saved sign-in still brings the faction's roles, and a custom broadcast role gets 📣", async () => {
  const jwt = savedJwt("Warden");
  const { ctx, p } = await openWar({ authFails: 99, roles: ROLES, store: { factionops_jwt: jwt }, wait: 1000 });
  const shown = await p.waitForSelector("#fo-wp-bcast", { timeout: 15000 }).then(() => true, () => false);
  const asked = await p.evaluate(() => window.__reqs.filter((q) => q.url.includes("/api/broadcast/roles")).map((q) => q.auth));
  await ctx.close();
  assert.ok(shown, "no 📣 Broadcast");
  assert.ok(asked.length >= 1 && asked.every((a) => a === "Bearer " + jwt), JSON.stringify(asked));
});

await t("the box: the faction's quick picks and a +; a pick fills the message and counts it", async () => {
  const { ctx, p } = await openBox();
  const before = await p.evaluate(() => ({
    title: document.querySelector("#fo-bc-box .fo-bc-title").textContent,
    count: document.getElementById("fo-bc-count").textContent,
    add: [...document.querySelectorAll("#fo-bc-picks .fo-bc-add")].map((e) => e.textContent),
    max: document.getElementById("fo-bc-text").getAttribute("maxlength"),
  }));
  const picks = await picksRow(p);
  await p.click("#fo-bc-picks .fo-bc-pick-text >> nth=0");
  const after = await p.evaluate(() => ({
    value: document.getElementById("fo-bc-text").value,
    count: document.getElementById("fo-bc-count").textContent,
    on: [...document.querySelectorAll("#fo-bc-picks .fo-bc-pick.is-on")].map((e) => e.dataset.pick),
  }));
  await ctx.close();
  assert.deepStrictEqual(before, { title: "\u{1F4E3} Send to your faction", count: "0/150", add: ["+"], max: "150" });
  assert.deepStrictEqual(picks, ["Let chain die", "Good work all!"]);
  assert.deepStrictEqual(after, { value: "Let chain die", count: "13/150", on: ["Let chain die"] });
});

await t("+ saves what is typed and × removes a pick, and the list follows the server", async () => {
  const { ctx, p } = await openBox();
  // Another admin's pick, saved since the box opened.
  await p.evaluate(() => { window.__picks = window.__picks.concat(["Hit now"]); });
  await p.fill("#fo-bc-text", "  Push   now ");
  await p.click("#fo-bc-picks .fo-bc-add");
  await p.waitForTimeout(400);
  const added = await picksRow(p);
  await p.click('#fo-bc-picks .fo-bc-pick[data-pick="Good work all!"] .fo-bc-pick-x');
  await p.waitForTimeout(400);
  const removed = await picksRow(p), sent = await posted(p, "/api/broadcast/picks");
  await ctx.close();
  assert.deepStrictEqual(sent, [{ add: "Push now" }, { remove: "Good work all!" }]);
  assert.deepStrictEqual(added, ["Let chain die", "Good work all!", "Hit now", "Push now"]);
  assert.deepStrictEqual(removed, ["Let chain die", "Hit now", "Push now"]);
});

await t("+ with nothing typed, or a pick already there, says so and sends nothing", async () => {
  const { ctx, p } = await openBox();
  await p.fill("#fo-bc-text", "   ");
  await p.click("#fo-bc-picks .fo-bc-add");
  const empty = await note(p);
  await p.fill("#fo-bc-text", "let  CHAIN die");
  await p.click("#fo-bc-picks .fo-bc-add");
  const dup = await note(p);
  await p.waitForTimeout(300);
  const sent = await posted(p, "/api/broadcast/picks");
  await ctx.close();
  assert.strictEqual(empty, "Type a message, then + saves it.");
  assert.strictEqual(dup, "Already a quick pick.");
  assert.deepStrictEqual(sent, []);
});

await t("a 13th pick: the server's answer shows under the message, and the row stays", async () => {
  const twelve = Array.from({ length: 12 }, (_, i) => "Pick " + (i + 1));
  const { ctx, p } = await openBox({ picks: twelve });
  await p.fill("#fo-bc-text", "Push now");
  await p.click("#fo-bc-picks .fo-bc-add");
  await p.waitForTimeout(400);
  const said = await note(p), row = await picksRow(p);
  await ctx.close();
  assert.strictEqual(said, "Up to 12 quick picks: remove one first.");
  assert.deepStrictEqual(row, twelve);
});

await t("Send to all members posts the message to the faction's war, closes the box and says it went", async () => {
  const { ctx, p } = await openBox();
  await p.fill("#fo-bc-text", "Hold hits");
  await p.click("#fo-bc-send");
  await p.waitForTimeout(500);
  const sent = await posted(p, "/api/broadcast");
  const box = await p.evaluate(() => !!document.getElementById("fo-bc-box"));
  // Every node's text, whole: no half of an emoji.
  const said = await p.evaluate(() => window.__said.filter((s) => s.includes("Sent to your faction")).map((s) => s.isWellFormed()));
  await ctx.close();
  assert.deepStrictEqual(sent, [HOLD]);
  assert.strictEqual(box, false);
  assert.ok(said.length > 0, "no toast");
  assert.ok(said.every(Boolean), "a toast with half an emoji");
});

await t("Enter sends and Shift+Enter does not; while it goes it reads Sending… and a second Enter sends nothing", async () => {
  const { ctx, p } = await openBox({ sendDelay: 1500 });
  await p.fill("#fo-bc-text", "Hold hits");
  await p.focus("#fo-bc-text");
  await p.keyboard.press("Shift+Enter");
  await p.waitForTimeout(200);
  const afterShift = (await posted(p, "/api/broadcast")).length;
  await p.keyboard.press("Enter");
  await p.waitForTimeout(100);
  const going = await p.evaluate(() => { const s = document.getElementById("fo-bc-send"); return { text: s.textContent, disabled: s.disabled }; });
  await p.keyboard.press("Enter");
  await p.waitForTimeout(2000);
  const sent = await posted(p, "/api/broadcast");
  await ctx.close();
  assert.strictEqual(afterShift, 0);
  assert.deepStrictEqual(going, { text: "Sending…", disabled: true });
  assert.deepStrictEqual(sent, [HOLD]);
});

await t("a refused send keeps the box and the message, and says why", async () => {
  const { ctx, p } = await openBox({ send: { status: 403, body: { error: "Only leaders and bankers can broadcast to the faction." } } });
  await p.fill("#fo-bc-text", "Hold hits");
  await p.click("#fo-bc-send");
  await p.waitForTimeout(500);
  const got = await p.evaluate(() => {
    const s = document.getElementById("fo-bc-send");
    return { box: !!document.getElementById("fo-bc-box"), value: document.getElementById("fo-bc-text").value,
      note: document.getElementById("fo-bc-note").textContent, send: s.textContent, disabled: s.disabled };
  });
  await ctx.close();
  assert.deepStrictEqual(got, { box: true, value: "Hold hits", note: "Only leaders and bankers can broadcast to the faction.",
    send: "Send to all members", disabled: false });
});

await t("Cancel, a tap outside and Escape each close it", async () => {
  const { ctx, p } = await openBox();
  const up = () => p.evaluate(() => !!document.getElementById("fo-bc-box"));
  await p.click("#fo-bc-cancel");
  const cancel = await up();
  await p.click("#fo-wp-bcast");
  await p.waitForSelector("#fo-bc-box");
  // A tap on the card itself keeps it.
  await p.click("#fo-bc-box .fo-bc-title");
  const card = await up();
  await p.mouse.click(5, 5);
  const outside = await up();
  await p.click("#fo-wp-bcast");
  await p.waitForSelector("#fo-bc-box");
  await p.keyboard.press("Escape");
  const esc = await up();
  await ctx.close();
  assert.deepStrictEqual({ cancel, card, outside, esc }, { cancel: false, card: true, outside: false, esc: false });
});

console.log(`\n${pass} passed, ${fail} failed`);
await b.close();
process.exit(fail ? 1 : 0);
