// OC Spawn's Manager → Armoury in a browser: the whole script on a stand-in
// faction page, with GM storage, tornwar.com, the Torn API and the armoury
// page's own requests answered here. Checks that only ranked-war weapon copies
// are listed and the requests a Loan and a ↩ send. Names and ids are made up.
import fs from "fs";
import assert from "assert";
const { chromium } = await import("/root/.hermes/hermes-agent/node_modules/playwright-core/index.mjs");
// OC_SRC points it at another copy (the mutants use it).
const script = fs.readFileSync(process.env.OC_SRC || new URL("../../server/public/scripts/oc-spawn-assistance.user.js", import.meta.url), "utf8");
const b = await chromium.launch({ args: ["--no-sandbox"] });

const MEMBERS = { members: [{ id: 1000001, name: "Alpha" }, { id: 1000002, name: "Bravo" }, { id: 1000003, name: "Charlie" }] };
// The armoury page's weapon rows, one per copy, as Torn sends them:
// glowClass marks a ranked-war copy, "" a plain one.
const bonus = (name, text) => ({ class: "bonus-attachment-" + name.toLowerCase(), title: `<b>${name}</b><br/>${text}` });
const blank = { class: "bonus-attachment-blank-bonus-25" };
const plain = (armoryID, itemID, name, type) => ({ armoryID, itemID: String(itemID), name, type, glowClass: "", bonuses: [blank, blank], user: false });
const WEAPONS = [
  plain(501, 26, "AK-47", "Primary"),
  { armoryID: 502, itemID: "26", name: "AK-47", type: "Primary", glowClass: "glow-orange", bonuses: [bonus("Warlord", "22% increased respect upon final hit"), blank], user: false },
  { armoryID: 503, itemID: "3", name: "Glock 17", type: "Secondary", glowClass: "glow-red", bonuses: [bonus("Expose", "9% increased critical hit rate"), blank], user: { userID: 1000003, playername: "Charlie" } },
  { armoryID: 504, itemID: "399", name: "Zebra Blade", type: "Melee", glowClass: "glow-yellow", bonuses: [bonus("Disarm", "Disarm for 7 turns"), blank], user: { userID: 1000009, playername: "Gone" } },
];

// GM_* as a userscript manager gives them.
const preamble = (cfg) => `(() => {
  const store = { oc_spawn_api_key: "testkey1234", oc_last_tab: "manager" };
  window.unsafeWindow = window;
  window.GM_getValue = (k, d) => (k in store ? store[k] : d);
  window.GM_setValue = (k, v) => { store[k] = v; };
  window.GM_addStyle = (css) => { const s = document.createElement("style"); s.textContent = css; (document.head || document.documentElement).appendChild(s); return s; };
  window.GM_openInTab = () => {};
  window.__logs = [];
  window.GM_xmlhttpRequest = (o) => {
    const u = String(o.url);
    let body = null;
    if (u.startsWith("https://tornwar.com/api/debug/client-log")) { window.__logs.push(JSON.parse(o.data)); body = "{}"; }
    else if (u.startsWith("https://tornwar.com/api/oc/settings")) body = JSON.stringify({ isAdmin: true, factionId: 42 });
    else body = JSON.stringify({});
    setTimeout(() => o.onload && o.onload({ status: 200, responseText: body, response: body }), 20);
  };
})();`;

async function open(cfg = {}) {
  const ctx = await b.newContext({ viewport: { width: cfg.width || 1200, height: 900 } });
  const p = await ctx.newPage();
  const posts = [];
  const pages = cfg.pages || [WEAPONS];
  await p.route("**/*", async (r) => {
    const req = r.request(), u = req.url();
    if (u.endsWith("/oc-preamble.js")) return r.fulfill({ contentType: "application/javascript", body: preamble(cfg) });
    if (u.endsWith("/oc.user.js")) return r.fulfill({ contentType: "application/javascript", body: script });
    if (u.startsWith("https://www.torn.com/factions.php?step=your")) return r.fulfill({ contentType: "text/html", body: `<!doctype html><html><head><meta charset="utf-8"></head><body><div class="content-wrapper"><div id="faction-crimes"></div></div><script src="/oc-preamble.js"></script><script src="/oc.user.js"></script></body></html>` });
    if (u.startsWith("https://api.torn.com/v2/faction/members")) return r.fulfill({ contentType: "application/json", body: JSON.stringify(MEMBERS) });
    if (u.startsWith("https://www.torn.com/factions.php?rfcv=") && req.method() === "POST") {
      const f = new URLSearchParams(req.postData() || "");
      posts.push(Object.fromEntries(f));
      if (f.get("step") === "armouryTabContent") {
        if (cfg.noAccess) return r.fulfill({ status: 403, body: "" });
        const rows = f.get("type") === "weapons" ? (pages[Number(f.get("start")) / 50] || []) : [];
        return r.fulfill({ contentType: "application/json", body: JSON.stringify({ items: rows, pagination: "" }) });
      }
      if (f.get("step") === "armouryActionItem") {
        // Torn refuses with HTTP 200 and success:false (the word "success" is in it).
        const ok = (cfg.accept || []).includes(f.get("type"));
        if (cfg.slow) await new Promise((res) => setTimeout(res, cfg.slow));
        const body = cfg.captcha ? '{"success":false,"message":"Please complete the Captcha to continue"}'
          : ok ? '{"success":true,"text":"Loaned"}' : '{"success":false,"text":"wrong type"}';
        return r.fulfill({ contentType: "application/json", body });
      }
    }
    return r.fulfill({ status: 404, body: "" });
  });
  await p.context().addCookies([{ name: "rfc_v", value: "rfctest", domain: "www.torn.com", path: "/" }]);
  await p.goto("https://www.torn.com/factions.php?step=your#/tab=crimes", { waitUntil: "domcontentloaded" });
  await p.waitForSelector("#oc-spawn-toggle", { timeout: 15000 });
  await p.evaluate(() => {
    const panel = document.getElementById("oc-spawn-panel");
    if (!panel || getComputedStyle(panel).display === "none") document.getElementById("oc-spawn-toggle").click();
  });
  // The Manager tab's admin gate opens only after a full OC analysis; that
  // gate is not what this checks, so the tab is shown directly.
  await p.waitForSelector("#oc-manager-tab", { state: "attached", timeout: 15000 });
  await p.evaluate(() => {
    document.getElementById("oc-tab-bar").style.display = "flex";
    document.getElementById("oc-manager-tab").style.display = "";
  });
  await p.click("#oc-manager-tab");
  await p.click('.mgr-sub-tab[data-mgr-tab="armoury"]');
  await p.waitForSelector(cfg.wait || "#mgr-arm-list .mgr-arm-row", { timeout: 15000 });
  return { ctx, p, posts };
}
const rows = (p) => p.$$eval("#mgr-arm-list .mgr-arm-row", (els) => els.map((e) => e.innerText.replace(/\s+/g, " ").trim()));
const actions = (posts) => posts.filter((x) => x.step === "armouryActionItem").map((x) => `${x.role} ${x.item} ${x.type} ${x.user}`);
// Rows are listed red, orange, yellow: 0 = Glock 17 (red, Charlie), 1 = AK-47 (orange, free), 2 = Zebra Blade (yellow, Gone).

let pass = 0, fail = 0;
const t = async (n, f) => { try { await f(); pass++; console.log("ok   " + n); } catch (e) { fail++; console.log("FAIL " + n + " :: " + e.message); } };

await t("only ranked-war weapon copies are listed, red first, with bonus and holder; no plain copies, no armour", async () => {
  const { ctx, p } = await open();
  const got = await rows(p);
  const text = await p.textContent("#mgr-sub-content");
  await ctx.close();
  assert.strictEqual(got.length, 3, JSON.stringify(got));
  assert.ok(got[0].includes("Glock 17") && got[0].includes("Expose 9%") && got[0].includes("Charlie"), got[0]);
  assert.ok(got[1].includes("AK-47") && got[1].includes("Warlord 22%") && got[1].includes("Loan"), got[1]);
  assert.ok(got[2].includes("Zebra Blade") && got[2].includes("Gone"), got[2]);
  assert.ok(!/armour/i.test(text.replace(/Armoury/g, "")), text);
});

await t("Loan without a member picked sends nothing and says so", async () => {
  const { ctx, p, posts } = await open();
  await p.click('.mgr-arm-loan[data-row="1"]');
  const label = await p.textContent('.mgr-arm-loan[data-row="1"]');
  await ctx.close();
  assert.strictEqual(label, "Pick a member");
  assert.deepStrictEqual(actions(posts), []);
});

await t("Loan lends that ranked-war copy (not the plain one) with its own type, and the row shows the member", async () => {
  const { ctx, p, posts } = await open({ accept: ["Primary"] });
  await p.selectOption("#mgr-arm-member", "1000001");
  await p.click('.mgr-arm-loan[data-row="1"]');
  await p.waitForFunction(() => document.querySelectorAll("#mgr-arm-list .mgr-arm-row")[1].innerText.includes("Alpha"));
  const got = await rows(p);
  await ctx.close();
  assert.deepStrictEqual(actions(posts), ["loan 502 Primary Alpha [1000001]"]);
  assert.ok(!got[1].includes("Loan"), got[1]);
});

await t("a type Torn refuses is retried once with the older guess, and the one it took is logged", async () => {
  const { ctx, p, posts } = await open({ accept: ["Primary"] });
  const back = '.mgr-arm-back[data-row="2"]';
  await p.click(back); await p.click(back);
  await p.waitForFunction(() => !document.querySelectorAll("#mgr-arm-list .mgr-arm-row")[2].innerText.includes("Gone"));
  const logs = await p.evaluate(() => window.__logs.filter((l) => l.tag === "oc-armoury"));
  await ctx.close();
  assert.deepStrictEqual(actions(posts), ["retrieve 504 Melee Gone [1000009]", "retrieve 504 Primary Gone [1000009]"]);
  assert.strictEqual(logs.length, 1);
  assert.strictEqual(logs[0].data.ok, "Primary");
});

await t("one tap on ↩ only asks; a second tap retrieves that holder's copy", async () => {
  const { ctx, p, posts } = await open({ accept: ["Secondary"] });
  const back = '.mgr-arm-back[data-row="0"]';
  await p.click(back);
  const asked = await p.textContent(back);
  const before = actions(posts).length;
  await p.click(back);
  await p.waitForFunction(() => document.querySelectorAll("#mgr-arm-list .mgr-arm-row")[0].innerText.includes("Loan"));
  await ctx.close();
  assert.ok(asked.includes("Charlie"), asked);
  assert.strictEqual(before, 0);
  assert.deepStrictEqual(actions(posts), ["retrieve 503 Secondary Charlie [1000003]"]);
});

await t("a loan Torn refuses on every type shows it and leaves the row alone", async () => {
  const { ctx, p, posts } = await open({ accept: [] });
  await p.selectOption("#mgr-arm-member", "1000001");
  await p.click('.mgr-arm-loan[data-row="1"]');
  await p.waitForFunction(() => /refused/i.test(document.querySelector('.mgr-arm-loan[data-row="1"]').textContent));
  const got = await rows(p);
  await ctx.close();
  assert.deepStrictEqual(actions(posts), ["loan 502 Primary Alpha [1000001]"]);
  assert.ok(got[1].includes("Loan") && !got[1].includes("Alpha"), got[1]);
});

await t("a captcha is shown and not retried with the other type", async () => {
  const { ctx, p, posts } = await open({ captcha: true });
  const back = '.mgr-arm-back[data-row="2"]';
  await p.click(back); await p.click(back);
  await p.waitForFunction(() => /captcha/i.test(document.querySelector('.mgr-arm-back[data-row="2"]').textContent));
  await ctx.close();
  assert.deepStrictEqual(actions(posts), ["retrieve 504 Melee Gone [1000009]"]);
});

await t("while one action is in flight, typing in the search cannot let a second through", async () => {
  const { ctx, p, posts } = await open({ accept: ["Primary"], slow: 1500 });
  await p.selectOption("#mgr-arm-member", "1000001");
  await p.click('.mgr-arm-loan[data-row="1"]');
  await p.fill("#mgr-arm-search", "a");
  await p.fill("#mgr-arm-search", "");
  await p.click('.mgr-arm-back[data-row="0"]', { force: true });
  await p.click('.mgr-arm-back[data-row="0"]', { force: true });
  await p.waitForTimeout(2500);
  await ctx.close();
  assert.deepStrictEqual(actions(posts), ["loan 502 Primary Alpha [1000001]"]);
});

await t("without access to the armoury page it says so", async () => {
  const { ctx, p } = await open({ noAccess: true, wait: ".oc-error" });
  const text = await p.textContent(".oc-error");
  await ctx.close();
  assert.ok(/access/i.test(text), text);
});

await t("ranked-war copies past the first page of 50 are found", async () => {
  const filler = Array.from({ length: 50 }, (_, i) => plain(600 + i, 26, "AK-47", "Primary"));
  const { ctx, p } = await open({ pages: [filler, WEAPONS.slice(1, 2)] });
  const got = await rows(p);
  await ctx.close();
  assert.strictEqual(got.length, 1);
  assert.ok(got[0].includes("Warlord 22%"), got[0]);
});

await t("if the rows carry no rarity at all it says so and logs the field names", async () => {
  const bare = WEAPONS.map(({ glowClass, ...r }) => r);
  const { ctx, p } = await open({ pages: [bare], wait: "#mgr-arm-list .mgr-ok" });
  const text = await p.textContent("#mgr-arm-list");
  const logs = await p.evaluate(() => window.__logs.filter((l) => l.tag === "oc-armoury"));
  await ctx.close();
  assert.ok(/rarity/i.test(text), text);
  assert.strictEqual(logs.length, 1);
  assert.ok(logs[0].data.keys.includes("armoryID") && !logs[0].data.keys.includes("glowClass"), JSON.stringify(logs[0]));
});

await t("on a phone the sub-tabs fit, the controls are dark like the panel, and ↩ is big enough to tap", async () => {
  const { ctx, p } = await open({ width: 375 });
  const got = await p.evaluate(() => {
    const bar = document.querySelector(".mgr-sub-tab-bar");
    const back = document.querySelector(".mgr-arm-back").getBoundingClientRect();
    const list = document.getElementById("mgr-arm-list");
    return { over: bar.scrollWidth - bar.clientWidth, listOver: list.scrollWidth - list.clientWidth, input: getComputedStyle(document.getElementById("mgr-arm-member")).backgroundColor, w: back.width, h: back.height };
  });
  await ctx.close();
  assert.ok(got.over <= 0 && got.listOver <= 0, JSON.stringify(got));
  assert.notStrictEqual(got.input, "rgb(255, 255, 255)");
  assert.ok(got.w >= 28 && got.h >= 28, JSON.stringify(got));
});

await t("the search narrows the list by item, bonus or holder", async () => {
  const { ctx, p } = await open();
  const after = async (q) => { await p.fill("#mgr-arm-search", q); return (await rows(p)).map((r) => r.split(" ")[0]); };
  const a = await after("warlord"), c = await after("charlie"), z = await after("zzz");
  const none = await p.textContent("#mgr-arm-list");
  await ctx.close();
  assert.deepStrictEqual(a, ["AK-47"]);
  assert.deepStrictEqual(c, ["Glock"]);
  assert.deepStrictEqual(z, []);
  assert.ok(none.includes("Nothing matches"), none);
});

await b.close();
console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
