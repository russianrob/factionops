// OC Spawn's Manager → Armoury in a browser: the whole script on a stand-in
// faction page, with GM storage, tornwar.com, the Torn API and the armoury
// page's own requests answered here. Checks what the tab lists and the
// requests a Loan and a ↩ send. Numbers, names and ids are made up.
import fs from "fs";
import assert from "assert";
const { chromium } = await import("/root/.hermes/hermes-agent/node_modules/playwright-core/index.mjs");
// OC_SRC points it at another copy (the mutants use it).
const script = fs.readFileSync(process.env.OC_SRC || new URL("../../server/public/scripts/oc-spawn-assistance.user.js", import.meta.url), "utf8");
const b = await chromium.launch({ args: ["--no-sandbox"] });

const ARMOURY = {
  weapons: [
    { ID: 1, name: "AK-47", type: "Primary", quantity: 2, available: 1, loaned: 1, loaned_to: 1000002 },
    { ID: 3, name: "Glock 17", type: "Secondary", quantity: 1, available: 0, loaned: 1, loaned_to: 1000003 },
  ],
  armor: [{ ID: 9, name: "Riot Helmet", type: "Defensive", quantity: 1, available: 1, loaned: 0, loaned_to: null }],
};
const MEMBERS = { members: [{ id: 1000001, name: "Alpha" }, { id: 1000002, name: "Bravo" }, { id: 1000003, name: "Charlie" }] };
// The armoury page's rows, by tab.
const PAGE = {
  weapons: [
    { armoryID: 501, itemID: "1", user: { userID: 1000002 } },
    { armoryID: 502, itemID: "1", user: false },
    { armoryID: 503, itemID: "3", user: { id: 1000003 } },
  ],
  armour: [{ armoryID: 601, itemID: "9", user: false }],
};

// GM_* as a userscript manager gives them. GM_xmlhttpRequest answers from
// window.__answer (set by the page route below via a sync XHR-free table).
const preamble = (cfg) => `(() => {
  const store = { oc_spawn_api_key: "testkey1234", oc_last_tab: "manager" };
  const answers = ${JSON.stringify({ armoury: ARMOURY })};
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
    else if (u.includes("api.torn.com/faction/?selections=weapons,armor")) body = JSON.stringify(answers.armoury);
    else body = JSON.stringify({});
    setTimeout(() => o.onload && o.onload({ status: 200, responseText: body, response: body }), 20);
  };
})();`;

async function open(cfg = {}) {
  const ctx = await b.newContext({ viewport: { width: cfg.width || 1200, height: 900 } });
  const p = await ctx.newPage();
  const posts = [];
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
        const rows = f.get("start") === "0" ? (PAGE[f.get("type")] || []) : [];
        return r.fulfill({ contentType: "application/json", body: JSON.stringify({ items: rows }) });
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
  await p.waitForSelector("#mgr-arm-list .mgr-arm-row", { timeout: 15000 });
  return { ctx, p, posts };
}
const rows = (p) => p.$$eval("#mgr-arm-list .mgr-arm-row", (els) => els.map((e) => e.innerText.replace(/\s+/g, " ").trim()));
const actions = (posts) => posts.filter((x) => x.step === "armouryActionItem").map((x) => `${x.role} ${x.item} ${x.type} ${x.user}`);

let pass = 0, fail = 0;
const t = async (n, f) => { try { await f(); pass++; console.log("ok   " + n); } catch (e) { fail++; console.log("FAIL " + n + " :: " + e.message); } };

await t("it lists weapons then armour, with counts and who holds what", async () => {
  const { ctx, p } = await open();
  const got = await rows(p);
  const heads = await p.$$eval(".mgr-arm-heading", (els) => els.map((e) => e.textContent));
  await ctx.close();
  assert.deepStrictEqual(heads, ["Weapons", "Armour"]);
  assert.strictEqual(got.length, 3);
  assert.ok(got[0].startsWith("AK-47 Primary 1 free of 2") && got[0].includes("Bravo"), got[0]);
  assert.ok(got[1].startsWith("Glock 17 Secondary 0 free of 1") && got[1].includes("Charlie"), got[1]);
  assert.ok(got[2].startsWith("Riot Helmet Defensive 1 free of 1"), got[2]);
});

await t("Loan without a member picked sends nothing and says so", async () => {
  const { ctx, p, posts } = await open();
  await p.click('.mgr-arm-loan[data-row="0"]');
  const label = await p.textContent('.mgr-arm-loan[data-row="0"]');
  await ctx.close();
  assert.strictEqual(label, "Pick a member");
  assert.deepStrictEqual(actions(posts), []);
});

await t("Loan lends a free copy to the picked member, with the weapon's own type, and the row updates", async () => {
  const { ctx, p, posts } = await open({ accept: ["Primary"] });
  await p.selectOption("#mgr-arm-member", "1000001");
  await p.click('.mgr-arm-loan[data-row="0"]');
  await p.waitForFunction(() => document.querySelector("#mgr-arm-list .mgr-arm-row").innerText.includes("0 free of 2"));
  const got = await rows(p);
  await ctx.close();
  assert.deepStrictEqual(actions(posts), ["loan 502 Primary Alpha [1000001]"]);
  assert.ok(got[0].includes("Alpha") && got[0].includes("Bravo"), got[0]);
});

await t("armour is found under either spelling, tries Defensive, then Armor, and logs which Torn took", async () => {
  const { ctx, p, posts } = await open({ accept: ["Armor"] });
  await p.selectOption("#mgr-arm-member", "1000002");
  await p.click('.mgr-arm-loan[data-row="2"]');
  await p.waitForFunction(() => document.querySelectorAll("#mgr-arm-list .mgr-arm-row")[2].innerText.includes("0 free of 1"));
  const logs = await p.evaluate(() => window.__logs.filter((l) => l.tag === "oc-armoury").map((l) => l.data));
  await ctx.close();
  assert.deepStrictEqual(actions(posts), ["loan 601 Defensive Bravo [1000002]", "loan 601 Armor Bravo [1000002]"]);
  assert.strictEqual(logs.length, 1);
  assert.strictEqual(logs[0].ok, "Armor");
});

await t("one tap on ↩ only asks; a second tap retrieves that borrower's copy", async () => {
  const { ctx, p, posts } = await open({ accept: ["Secondary"] });
  const back = '.mgr-arm-back[data-row="1"][data-userid="1000003"]';
  await p.click(back);
  const asked = await p.textContent(back);
  const before = actions(posts).length;
  await p.click(back);
  await p.waitForFunction(() => document.querySelectorAll("#mgr-arm-list .mgr-arm-row")[1].innerText.includes("1 free of 1"));
  await ctx.close();
  assert.ok(asked.includes("Charlie"), asked);
  assert.strictEqual(before, 0);
  assert.deepStrictEqual(actions(posts), ["retrieve 503 Secondary Charlie [1000003]"]);
});

await t("a loan Torn refuses on every type shows it and leaves the row alone", async () => {
  const { ctx, p, posts } = await open({ accept: [] });
  await p.selectOption("#mgr-arm-member", "1000001");
  await p.click('.mgr-arm-loan[data-row="0"]');
  await p.waitForFunction(() => document.querySelector('.mgr-arm-loan[data-row="0"]').textContent === "Loan refused");
  const got = await rows(p);
  await ctx.close();
  assert.deepStrictEqual(actions(posts), ["loan 502 Primary Alpha [1000001]"]);
  assert.ok(got[0].startsWith("AK-47 Primary 1 free of 2"), got[0]);
});

await t("a captcha is shown and not retried with the other type", async () => {
  const { ctx, p, posts } = await open({ captcha: true });
  await p.selectOption("#mgr-arm-member", "1000002");
  await p.click('.mgr-arm-loan[data-row="2"]');
  await p.waitForFunction(() => /captcha/i.test(document.querySelector('.mgr-arm-loan[data-row="2"]').textContent));
  const got = await rows(p);
  await ctx.close();
  assert.deepStrictEqual(actions(posts), ["loan 601 Defensive Bravo [1000002]"]);
  assert.ok(got[2].includes("1 free of 1"), got[2]);
});

await t("while one loan is in flight, typing in the search cannot let a second through", async () => {
  const { ctx, p, posts } = await open({ accept: ["Primary"], slow: 1500 });
  await p.selectOption("#mgr-arm-member", "1000001");
  await p.click('.mgr-arm-loan[data-row="0"]');
  await p.fill("#mgr-arm-search", "a");
  await p.fill("#mgr-arm-search", "");
  await p.click('.mgr-arm-loan[data-row="0"]', { force: true });
  await p.waitForTimeout(2500);
  await ctx.close();
  assert.deepStrictEqual(actions(posts), ["loan 502 Primary Alpha [1000001]"]);
});

await t("without access to the armoury page it says so, not 'no free copy'", async () => {
  const { ctx, p } = await open({ noAccess: true });
  await p.selectOption("#mgr-arm-member", "1000001");
  await p.click('.mgr-arm-loan[data-row="0"]');
  await p.waitForFunction(() => document.querySelector('.mgr-arm-loan[data-row="0"]').textContent !== "…");
  const label = await p.textContent('.mgr-arm-loan[data-row="0"]');
  await ctx.close();
  assert.ok(/access/i.test(label), label);
});

await t("on a phone the sub-tabs fit, the controls are dark like the panel, and ↩ is big enough to tap", async () => {
  const { ctx, p } = await open({ width: 375 });
  const got = await p.evaluate(() => {
    const bar = document.querySelector(".mgr-sub-tab-bar");
    const back = document.querySelector(".mgr-arm-back").getBoundingClientRect();
    return { over: bar.scrollWidth - bar.clientWidth, input: getComputedStyle(document.getElementById("mgr-arm-member")).backgroundColor, w: back.width, h: back.height };
  });
  await ctx.close();
  assert.ok(got.over <= 0, "tab bar overflows by " + got.over);
  assert.notStrictEqual(got.input, "rgb(255, 255, 255)");
  assert.ok(got.w >= 28 && got.h >= 28, JSON.stringify(got));
});

await t("the search narrows the list", async () => {
  const { ctx, p } = await open();
  await p.fill("#mgr-arm-search", "charlie");
  const got = await rows(p);
  await ctx.close();
  assert.strictEqual(got.length, 1);
  assert.ok(got[0].startsWith("Glock 17"), got[0]);
});

await b.close();
console.log(`${pass} passed, ${fail} failed`);
process.exitCode = fail ? 1 : 0;
