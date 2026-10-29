// OC Spawn's Manager → Armoury in a browser: the whole script on a stand-in
// faction page, with GM storage, tornwar.com, the Torn API and the armoury
// page's own requests answered here. Checks that only ranked-war weapon copies
// are listed, the requests a Loan and a ↩ send, and when each holder was last
// on. Names and ids are made up.
import fs from "fs";
import assert from "assert";
const { chromium } = await import("/root/.hermes/hermes-agent/node_modules/playwright-core/index.mjs");
// OC_SRC points it at another copy (the mutants use it).
const script = fs.readFileSync(process.env.OC_SRC || new URL("../../server/public/scripts/oc-spawn-assistance.user.js", import.meta.url), "utf8");
const b = await chromium.launch({ args: ["--no-sandbox"] });

// Members as /v2/faction/members gives them; last_action is ago seconds before
// the moment Torn answers.
const member = (id, name, status, ago) => ({
  id, name, level: 50, position: "Member", days_in_faction: 100,
  status: { description: "Okay", details: "", state: "Okay", color: "green", until: null },
  last_action: { status, timestamp: Math.floor(Date.now() / 1000) - ago, relative: "" },
});
const MEMBERS = () => ({ members: [member(1000001, "Alpha", "Online", 20), member(1000002, "Bravo", "Idle", 12 * 60), member(1000003, "Charlie", "Offline", 3 * 3600 + 120)] });
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
// The armoury page's armour rows: Bravo holds a full set (602 head, 604 body,
// 605 legs, 606 hands, 601 feet), Charlie a helmet (609). Listed head to feet,
// free ones first: 0 = 603, 1 = 602, 2 = 609, 3 = 604, 4 = 605, 5 = 607,
// 6 = 606, 7 = 608, 8 = 601.
const piece = (armoryID, name, user = false) => ({ armoryID, itemID: String(9000 + armoryID), name, type: "Defensive", glowClass: "", bonuses: [], user });
const BRAVO = { userID: 1000002, playername: "Bravo" };
const ARMOUR = [piece(601, "Combat Boots", BRAVO), piece(602, "Combat Helmet", BRAVO), piece(603, "Combat Helmet"),
  piece(604, "Combat Vest", BRAVO), piece(605, "Combat Pants", BRAVO), piece(606, "Combat Gloves", BRAVO),
  piece(607, "Combat Gloves"), piece(608, "Combat Boots"), piece(609, "Combat Helmet", { userID: 1000003, playername: "Charlie" })];

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
  // cfg.rescan, when given, answers every read of the armoury after the first.
  let reads = 0;
  // Each member-list request gets the next answer in cfg.membersSeq (the last
  // one again after that), and is counted. An answer { httpStatus } is sent as
  // that HTTP status with no body.
  const membersSeq = cfg.membersSeq || [MEMBERS];
  const calls = { members: 0 };
  await p.route("**/*", async (r) => {
    const req = r.request(), u = req.url();
    if (u.endsWith("/oc-preamble.js")) return r.fulfill({ contentType: "application/javascript", body: preamble(cfg) });
    if (u.endsWith("/oc.user.js")) return r.fulfill({ contentType: "application/javascript", body: script });
    if (u.startsWith("https://www.torn.com/factions.php?step=your")) return r.fulfill({ contentType: "text/html", body: `<!doctype html><html><head><meta charset="utf-8"></head><body><div class="content-wrapper"><div id="faction-crimes"></div></div><script src="/oc-preamble.js"></script><script src="/oc.user.js"></script></body></html>` });
    if (u.startsWith("https://api.torn.com/v2/faction/members")) {
      const answer = membersSeq[Math.min(calls.members++, membersSeq.length - 1)]();
      if (answer.httpStatus) return r.fulfill({ status: answer.httpStatus, body: "" });
      return r.fulfill({ contentType: "application/json", body: JSON.stringify(answer) });
    }
    if (u.startsWith("https://www.torn.com/factions.php?rfcv=") && req.method() === "POST") {
      const f = new URLSearchParams(req.postData() || "");
      posts.push(Object.fromEntries(f));
      if (f.get("step") === "armouryTabContent") {
        if (cfg.noAccess) return r.fulfill({ status: 403, body: "" });
        if (f.get("type") === "weapons" && f.get("start") === "0") reads++;
        const src = reads > 1 && cfg.rescan ? cfg.rescan : pages;
        // Weapons as cfg.pages; armour on the spelling cfg.armourCat names
        // ("armour" unless set) as cfg.armourPages; the other spelling
        // answers nothing, or the weapons tab's rows with cfg.wrongTab.
        const at = Number(f.get("start")) / 50, type = f.get("type");
        const rows = type === "weapons" ? (src[at] || [])
          : type === (cfg.armourCat || "armour") ? ((cfg.armourPages || [ARMOUR])[at] || [])
          : cfg.wrongTab && (type === "armour" || type === "armor") ? (at === 0 ? WEAPONS : [])
          : [];
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
  // The analysis the script starts on load ends by switching to the tab this
  // viewer may see (Profile here), which would hide the Manager tab under a
  // test still using it, so the Manager tab is opened once it has finished.
  await p.waitForFunction(() => /Last updated/.test(document.getElementById("oc-spawn-status")?.textContent || ""), null, { timeout: 15000 });
  await p.evaluate(() => {
    document.getElementById("oc-tab-bar").style.display = "flex";
    document.getElementById("oc-manager-tab").style.display = "";
  });
  await p.click("#oc-manager-tab");
  await p.click('.mgr-sub-tab[data-mgr-tab="armoury"]');
  await p.waitForSelector(cfg.wait || "#mgr-arm-list .mgr-arm-row", { timeout: 15000 });
  return { ctx, p, posts, calls };
}
const rows = (p) => p.$$eval("#mgr-arm-list .mgr-arm-row", (els) => els.map((e) => e.innerText.replace(/\s+/g, " ").trim()));
const actions = (posts) => posts.filter((x) => x.step === "armouryActionItem").map((x) => `${x.role} ${x.item} ${x.type} ${x.user}`);
// Rows are listed red, orange, yellow: 0 = Glock 17 (red, Charlie), 1 = AK-47 (orange, free), 2 = Zebra Blade (yellow, Gone).
// The colour of each row's last-on time (null on a free copy).
const seen = (p) => p.$$eval("#mgr-arm-list .mgr-arm-row", (els) => els.map((e) => {
  const s = e.querySelector(".mgr-arm-seen");
  return s ? getComputedStyle(s).color : null;
}));
// A colour by its look, not its exact value: grey has its channels close
// together (and is darker than the chip's own near-white text), red and green
// stand well above the other two, orange is red and green over blue.
const rgb = (c) => (String(c).match(/\d+/g) || []).map(Number);
const grey = (c) => { const [r, g, b] = rgb(c); return Math.max(r, g, b) - Math.min(r, g, b) < 40 && r > 100 && r < 200; };
const orange = (c) => { const [r, g, b] = rgb(c); return r > 200 && g > 120 && g < r && b < 100; };
// Torn's answer to a request it refuses: HTTP 200, an error and no members.
const REFUSED = () => ({ error: { code: 5, error: "Too many requests" } });
// Opens another sub-tab and then the Armoury again, to the list or its error.
const reopen = async (p) => {
  await p.click('.mgr-sub-tab[data-mgr-tab="delays"]');
  await p.click('.mgr-sub-tab[data-mgr-tab="armoury"]');
  await p.waitForSelector("#mgr-arm-list .mgr-arm-row, .oc-error", { timeout: 15000 });
};
const aMinuteOn = (p) => p.evaluate(() => { const real = Date.now; Date.now = () => real() + 61000; });
const red = (c) => { const [r, g, b] = rgb(c); return r > g + 80 && r > b + 80; };
const green = (c) => { const [r, g, b] = rgb(c); return g > r + 60 && g > b + 40; };

let pass = 0, fail = 0;
const t = async (n, f) => { try { await f(); pass++; console.log("ok   " + n); } catch (e) { fail++; console.log("FAIL " + n + " :: " + e.message); } };

await t("only ranked-war weapon copies are listed, red first, with bonus and holder; no plain copies, no armour", async () => {
  const { ctx, p } = await open();
  const got = await rows(p);
  await ctx.close();
  assert.strictEqual(got.length, 3, JSON.stringify(got));
  assert.ok(got[0].includes("Glock 17") && got[0].includes("Expose 9%") && got[0].includes("Charlie"), got[0]);
  assert.ok(got[1].includes("AK-47") && got[1].includes("Warlord 22%") && got[1].includes("Loan"), got[1]);
  assert.ok(got[2].includes("Zebra Blade") && got[2].includes("Gone"), got[2]);
  assert.ok(!got.some((r) => /Combat/.test(r)), JSON.stringify(got));
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

// Two free ranked-war copies of one weapon: row 0 = 502, row 1 = 505.
const TWO_FREE = [WEAPONS[1], { ...WEAPONS[1], armoryID: 505 }];
// The name "Loan to" shows.
const picked = (p) => p.$eval("#mgr-arm-member", (s) => s.options[s.selectedIndex].text);
const holderIs = (p, row, name) => p.waitForFunction(([row, name]) => document.querySelectorAll("#mgr-arm-list .mgr-arm-row")[row].innerText.includes(name), [row, name], { timeout: 5000 });

await t("after a loan the picker is back on Loan to…, so the next copy needs a new pick", async () => {
  const { ctx, p, posts } = await open({ pages: [TWO_FREE], accept: ["Primary"] });
  await p.selectOption("#mgr-arm-member", "1000001");
  await p.click('.mgr-arm-loan[data-row="0"]');
  await holderIs(p, 0, "Alpha");
  const after = await picked(p);
  await p.click('.mgr-arm-loan[data-row="1"]');
  const label = await p.textContent('.mgr-arm-loan[data-row="1"]');
  await ctx.close();
  assert.strictEqual(after, "Loan to…");
  assert.strictEqual(label, "Pick a member");
  assert.deepStrictEqual(actions(posts), ["loan 502 Primary Alpha [1000001]"]);
});

await t("a loan Torn refuses keeps the pick, so it can be tried again", async () => {
  const { ctx, p, posts } = await open({ pages: [TWO_FREE], accept: [] });
  const refused = (row) => p.waitForFunction((row) => /refused/i.test(document.querySelector(`.mgr-arm-loan[data-row="${row}"]`).textContent), row, { timeout: 5000 });
  await p.selectOption("#mgr-arm-member", "1000001");
  await p.click('.mgr-arm-loan[data-row="0"]');
  await refused(0);
  const after = await picked(p);
  await p.click('.mgr-arm-loan[data-row="1"]');
  await refused(1).catch(() => {});
  await ctx.close();
  assert.strictEqual(after, "Alpha");
  assert.deepStrictEqual(actions(posts), ["loan 502 Primary Alpha [1000001]", "loan 505 Primary Alpha [1000001]"]);
});

await t("a member picked while a loan is on its way stays picked for the next one", async () => {
  const { ctx, p, posts } = await open({ pages: [TWO_FREE], accept: ["Primary"], slow: 800 });
  await p.selectOption("#mgr-arm-member", "1000001");
  await p.click('.mgr-arm-loan[data-row="0"]');
  await p.selectOption("#mgr-arm-member", "1000002");
  // The loan is still on its way when Bravo is picked.
  const during = await p.evaluate(() => document.querySelector('.mgr-arm-loan[data-row="0"]')?.textContent ?? null);
  await holderIs(p, 0, "Alpha");
  const after = await picked(p);
  await p.click('.mgr-arm-loan[data-row="1"]');
  await holderIs(p, 1, "Bravo").catch(() => {});
  await ctx.close();
  assert.strictEqual(during, "…");
  assert.strictEqual(after, "Bravo");
  assert.deepStrictEqual(actions(posts), ["loan 502 Primary Alpha [1000001]", "loan 505 Primary Bravo [1000002]"]);
});

// Every line of "Loan to", its "Loan to…" first.
const offeredNames = (p) => p.$$eval("#mgr-arm-member option", (os) => os.map((o) => o.textContent));

await t("a member who already holds a ranked-war copy is not offered in Loan to", async () => {
  const { ctx, p } = await open();
  const names = await offeredNames(p);
  await ctx.close();
  assert.deepStrictEqual(names, ["Loan to…", "Alpha", "Bravo"]);
});

await t("whoever is lent a copy drops out of Loan to, and is offered again once it is taken back", async () => {
  const { ctx, p } = await open({ accept: ["Primary"] });
  await p.selectOption("#mgr-arm-member", "1000001");
  await p.click('.mgr-arm-loan[data-row="1"]');
  await holderIs(p, 1, "Alpha");
  const lent = await offeredNames(p);
  const back = '.mgr-arm-back[data-row="1"]';
  await p.click(back); await p.click(back);
  await p.waitForFunction(() => document.querySelectorAll("#mgr-arm-list .mgr-arm-row")[1].innerText.includes("Loan"), null, { timeout: 5000 });
  const returned = await offeredNames(p);
  await ctx.close();
  assert.deepStrictEqual(lent, ["Loan to…", "Bravo"]);
  assert.deepStrictEqual(returned, ["Loan to…", "Alpha", "Bravo"]);
});

// Waits for the loan on its way to land: the list is up and none of its
// buttons is held back any more.
const landed = (p) => p.waitForFunction(() => document.querySelector("#mgr-arm-list .mgr-arm-row") && !document.querySelector("#mgr-arm-list button:disabled"), null, { timeout: 5000 });

await t("a tab read again while a loan is on its way shows the copy lent and leaves that member out of Loan to", async () => {
  const { ctx, p, posts } = await open({ pages: [TWO_FREE], accept: ["Primary"], slow: 1500 });
  await p.selectOption("#mgr-arm-member", "1000001");
  await p.click('.mgr-arm-loan[data-row="0"]');
  await reopen(p);
  await landed(p);
  const got = await rows(p), names = await offeredNames(p), after = await picked(p);
  await p.click('.mgr-arm-loan[data-row="1"]');
  const label = await p.textContent('.mgr-arm-loan[data-row="1"]');
  await ctx.close();
  assert.ok(got[0].includes("Alpha"), got[0]);
  assert.deepStrictEqual(names, ["Loan to…", "Bravo", "Charlie"]);
  assert.strictEqual(after, "Loan to…");
  assert.strictEqual(label, "Pick a member");
  assert.deepStrictEqual(actions(posts), ["loan 502 Primary Alpha [1000001]"]);
});

await t("a read of the tab that comes back without the copy on its way still clears the pick", async () => {
  const { ctx, p, posts } = await open({ pages: [TWO_FREE], rescan: [[TWO_FREE[1]]], accept: ["Primary"], slow: 1500 });
  await p.selectOption("#mgr-arm-member", "1000001");
  await p.click('.mgr-arm-loan[data-row="0"]');
  await reopen(p);
  await landed(p);
  const after = await picked(p);
  await p.click('.mgr-arm-loan[data-row="0"]');
  const label = await p.textContent('.mgr-arm-loan[data-row="0"]');
  await ctx.close();
  assert.strictEqual(after, "Loan to…");
  assert.strictEqual(label, "Pick a member");
  assert.deepStrictEqual(actions(posts), ["loan 502 Primary Alpha [1000001]"]);
});

await t("a pick whose member holds a copy by the time the tab is read again is dropped, so Loan asks for a new one", async () => {
  const lentElsewhere = { ...TWO_FREE[0], user: { userID: 1000001, playername: "Alpha" } };
  const { ctx, p, posts } = await open({ pages: [TWO_FREE], rescan: [[lentElsewhere, TWO_FREE[1]]], accept: ["Primary"] });
  await p.selectOption("#mgr-arm-member", "1000001");
  await reopen(p);
  await holderIs(p, 0, "Alpha");
  const names = await offeredNames(p);
  await p.click('.mgr-arm-loan[data-row="1"]');
  const label = await p.textContent('.mgr-arm-loan[data-row="1"]');
  await ctx.close();
  assert.deepStrictEqual(names, ["Loan to…", "Bravo", "Charlie"]);
  assert.strictEqual(label, "Pick a member");
  assert.deepStrictEqual(actions(posts), []);
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

await t("each holder shows when they were last on, coloured by Torn's online, idle or offline; one who left says so in red", async () => {
  const { ctx, p } = await open();
  const got = await rows(p), col = await seen(p);
  await ctx.close();
  assert.ok(got[0].includes("Charlie · 3h ago"), got[0]);
  assert.ok(got[2].includes("Gone · left faction"), got[2]);
  assert.ok(grey(col[0]), col[0]);
  assert.strictEqual(col[1], null);
  assert.ok(red(col[2]), col[2]);
});

await t("a copy just lent shows when its new holder was last on", async () => {
  const { ctx, p } = await open({ accept: ["Primary"] });
  await p.selectOption("#mgr-arm-member", "1000001");
  await p.click('.mgr-arm-loan[data-row="1"]');
  await p.waitForFunction(() => document.querySelectorAll("#mgr-arm-list .mgr-arm-row")[1].innerText.includes("Alpha"));
  const got = await rows(p), col = await seen(p);
  await ctx.close();
  assert.ok(got[1].includes("Alpha · now"), got[1]);
  assert.ok(green(col[1]), col[1]);
});

await t("opening the tab again asks Torn for the member list only once it is a minute old", async () => {
  const later = () => ({ members: [member(1000001, "Alpha", "Online", 20), member(1000002, "Bravo", "Idle", 12 * 60), member(1000003, "Charlie", "Offline", 2 * 86400)] });
  const { ctx, p, calls } = await open({ membersSeq: [MEMBERS, later] });
  const reopen = async () => {
    await p.click('.mgr-sub-tab[data-mgr-tab="delays"]');
    await p.click('.mgr-sub-tab[data-mgr-tab="armoury"]');
    await p.waitForSelector("#mgr-arm-list .mgr-arm-row", { timeout: 15000 });
  };
  const first = calls.members;
  await reopen();
  const soon = calls.members;
  await p.evaluate(() => { const real = Date.now; Date.now = () => real() + 61000; });
  await reopen();
  const got = await rows(p);
  await ctx.close();
  assert.strictEqual(first, 1);
  assert.strictEqual(soon, 1, "asked again within the minute");
  assert.strictEqual(calls.members, 2);
  assert.ok(got[0].includes("Charlie · 2d ago"), got[0]);
});

await t("a holder who has left since the list was last read says so once it is read again", async () => {
  const later = () => ({ members: [member(1000001, "Alpha", "Online", 20), member(1000002, "Bravo", "Idle", 12 * 60)] });
  const { ctx, p } = await open({ membersSeq: [MEMBERS, later] });
  await p.evaluate(() => { const real = Date.now; Date.now = () => real() + 61000; });
  await p.click('.mgr-sub-tab[data-mgr-tab="delays"]');
  await p.click('.mgr-sub-tab[data-mgr-tab="armoury"]');
  await p.waitForSelector("#mgr-arm-list .mgr-arm-row", { timeout: 15000 });
  const got = await rows(p);
  await ctx.close();
  assert.ok(got[0].includes("Charlie · left faction"), got[0]);
});

await t("a holder Torn has as idle shows the time in orange", async () => {
  const held = [{ ...WEAPONS[2], user: { userID: 1000002, playername: "Bravo" } }];
  const { ctx, p } = await open({ pages: [held] });
  const got = await rows(p), col = await seen(p);
  await ctx.close();
  assert.ok(got[0].includes("Bravo · 12m ago"), got[0]);
  assert.ok(orange(col[0]), col[0]);
});

await t("when Torn refuses the list a minute on, the times it had stay", async () => {
  const { ctx, p } = await open({ membersSeq: [MEMBERS, REFUSED] });
  await aMinuteOn(p);
  await reopen(p);
  const got = await rows(p);
  await ctx.close();
  assert.ok(got.length && got[0].includes("Charlie · 3h ago"), JSON.stringify(got));
});

await t("when Torn refuses the first list, no holder is said to have left", async () => {
  const { ctx, p } = await open({ membersSeq: [REFUSED] });
  const got = await rows(p);
  await ctx.close();
  assert.ok(got[0].includes("Charlie"), got[0]);
  assert.ok(!got.some((r) => r.includes("left faction")), JSON.stringify(got));
});

await t("when the list cannot be read a minute on, the tab still opens with the times it had", async () => {
  const { ctx, p } = await open({ membersSeq: [MEMBERS, () => ({ httpStatus: 500 })] });
  await aMinuteOn(p);
  await reopen(p);
  const got = await rows(p);
  await ctx.close();
  assert.ok(got.length && got[0].includes("Charlie · 3h ago"), JSON.stringify(got));
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

// ── The Armour view ────────────────────────────────────────────────────
// Opens the Weapons or Armour view and waits for its list or its message.
const view = async (p, name) => {
  await p.click(`.mgr-arm-view[data-view="${name}"]`, { timeout: 3000 });
  await p.waitForFunction((name) => document.querySelector(`.mgr-arm-view[data-view="${name}"]`).classList.contains("mgr-arm-view-on")
    && document.querySelector("#mgr-arm-list .mgr-arm-row, #mgr-arm-list .mgr-ok, #mgr-arm-list .oc-error"), name, { timeout: 5000 });
};
// The categories the armoury page was read for, in order (first pages only).
const readTypes = (posts) => posts.filter((x) => x.step === "armouryTabContent" && x.start === "0").map((x) => x.type);
const armouryLogs = (p) => p.evaluate(() => window.__logs.filter((l) => l.tag === "oc-armoury").map((l) => l.data));
const pickValue = (p) => p.$eval("#mgr-arm-member", (s) => s.value);
// Each row's piece, body part and holder ("" when free).
const pieces = (p) => p.$$eval("#mgr-arm-list .mgr-arm-row", (els) => els.map((e) =>
  [e.querySelector(".mgr-arm-name").textContent, e.querySelector(".mgr-arm-type").textContent, e.querySelector(".mgr-arm-who")?.textContent || ""]));

await t("the Armour switch lists every piece head to feet, free ones first, under its own count line", async () => {
  const { ctx, p, posts } = await open();
  await view(p, "armour");
  const got = await pieces(p);
  const heading = await p.textContent("#mgr-arm-list .mgr-arm-heading");
  const logs = await armouryLogs(p);
  await ctx.close();
  assert.deepStrictEqual(got, [["Combat Helmet", "Head", ""], ["Combat Helmet", "Head", "Bravo"], ["Combat Helmet", "Head", "Charlie"],
    ["Combat Vest", "Body", "Bravo"], ["Combat Pants", "Legs", "Bravo"], ["Combat Gloves", "Hands", ""], ["Combat Gloves", "Hands", "Bravo"],
    ["Combat Boots", "Feet", ""], ["Combat Boots", "Feet", "Bravo"]]);
  assert.strictEqual(heading, "Armour · 9 · 3 free");
  assert.deepStrictEqual(readTypes(posts), ["weapons", "armour"]);
  const armour = logs.filter((l) => l.kind === "armour");
  assert.strictEqual(armour.length, 1, JSON.stringify(logs));
  assert.strictEqual(armour[0].cat, "armour");
});

await t("armour is asked as armour first, then armor, and the one Torn answered is logged", async () => {
  let { ctx, p, posts } = await open({ armourCat: "armor" });
  await view(p, "armour");
  const got = await rows(p), types = readTypes(posts), logs = await armouryLogs(p);
  await ctx.close();
  assert.strictEqual(got.length, 9);
  assert.deepStrictEqual(types, ["weapons", "armour", "armor"]);
  assert.deepStrictEqual(logs.filter((l) => l.kind === "armour").map((l) => l.cat), ["armor"]);
  ({ ctx, p } = await open({ armourPages: [[]] }));
  await view(p, "armour");
  const none = await p.textContent("#mgr-arm-list"), nolog = await armouryLogs(p);
  await ctx.close();
  assert.ok(none.includes("No armour in the armoury."), none);
  assert.deepStrictEqual(nolog.filter((l) => l.kind === "armour").map((l) => l.cat), [null]);
});

await t("an answer of another tab's rows is not armour", async () => {
  const { ctx, p } = await open({ armourCat: "armor", wrongTab: true });
  await view(p, "armour");
  const got = await rows(p);
  await ctx.close();
  assert.strictEqual(got.length, 9, JSON.stringify(got));
  assert.ok(!got.some((r) => /AK-47|Glock|Zebra/.test(r)), JSON.stringify(got));
});

await t("Loan in Armour lends that piece as Defensive, and the pick stays for the next piece", async () => {
  const { ctx, p, posts } = await open({ accept: ["Defensive"] });
  await view(p, "armour");
  await p.selectOption("#mgr-arm-member", "1000001");
  await p.click('.mgr-arm-loan[data-row="0"]');
  await holderIs(p, 0, "Alpha");
  const after = await pickValue(p);
  await p.click('.mgr-arm-loan[data-row="5"]');
  await holderIs(p, 5, "Alpha");
  const still = await pickValue(p);
  await ctx.close();
  assert.deepStrictEqual(actions(posts), ["loan 603 Defensive Alpha [1000001]", "loan 607 Defensive Alpha [1000001]"]);
  assert.strictEqual(after, "1000001");
  assert.strictEqual(still, "1000001");
});

await t("a second piece for a body part the member holds is refused by name, and nothing is sent", async () => {
  const { ctx, p, posts } = await open({ accept: ["Defensive"] });
  await view(p, "armour");
  await p.selectOption("#mgr-arm-member", "1000003");
  await p.click('.mgr-arm-loan[data-row="0"]');
  const label = await p.textContent('.mgr-arm-loan[data-row="0"]');
  await ctx.close();
  assert.strictEqual(label, "Has Combat Helmet");
  assert.deepStrictEqual(actions(posts), []);
});

await t("Armour's Loan to leaves out a full set's holder; Weapons' Loan to does not count armour", async () => {
  const { ctx, p } = await open();
  await view(p, "armour");
  const armour = await offeredNames(p);
  await view(p, "weapons");
  const weapons = await offeredNames(p);
  await ctx.close();
  assert.deepStrictEqual(armour, ["Loan to…", "Alpha", "Charlie"]);
  assert.deepStrictEqual(weapons, ["Loan to…", "Alpha", "Bravo"]);
});

await t("a full set goes out on one pick, then that member leaves Loan to", async () => {
  const SET = [piece(611, "Riot Helmet"), piece(612, "Riot Body"), piece(613, "Riot Pants"), piece(614, "Riot Gloves"), piece(615, "Riot Boots")];
  const { ctx, p, posts } = await open({ armourPages: [SET], accept: ["Defensive"] });
  await view(p, "armour");
  await p.selectOption("#mgr-arm-member", "1000001");
  const kept = [];
  for (let row = 0; row < 5; row++) {
    await p.click(`.mgr-arm-loan[data-row="${row}"]`);
    await holderIs(p, row, "Alpha");
    kept.push(await pickValue(p));
  }
  const names = await offeredNames(p);
  await ctx.close();
  assert.strictEqual(actions(posts).length, 5);
  assert.deepStrictEqual(kept, ["1000001", "1000001", "1000001", "1000001", ""]);
  assert.deepStrictEqual(names, ["Loan to…", "Bravo", "Charlie"]);
});

await t("a weapons loan landing after a switch to Armour stays in Weapons", async () => {
  const { ctx, p, posts } = await open({ accept: ["Primary", "Defensive"], slow: 1500 });
  await p.selectOption("#mgr-arm-member", "1000001");
  await p.click('.mgr-arm-loan[data-row="1"]');
  await view(p, "armour");
  // The same member picked in Armour while the weapon is on its way.
  await p.selectOption("#mgr-arm-member", "1000001");
  await landed(p);
  const armourRows = await rows(p);
  // The weapon's loan cleared only Weapons' pick: Armour's still lends.
  await p.click('.mgr-arm-loan[data-row="0"]');
  await holderIs(p, 0, "Alpha");
  await view(p, "weapons");
  const weaponRows = await rows(p), weaponPick = await pickValue(p);
  await ctx.close();
  assert.deepStrictEqual(actions(posts), ["loan 502 Primary Alpha [1000001]", "loan 603 Defensive Alpha [1000001]"]);
  assert.ok(!armourRows.some((r) => r.includes("Alpha")), JSON.stringify(armourRows));
  assert.ok(weaponRows[1].includes("Alpha"), weaponRows[1]);
  assert.strictEqual(weaponPick, "");
});

await t("an armour loan landing after a switch to Weapons leaves Weapons' pick alone", async () => {
  const { ctx, p, posts } = await open({ accept: ["Defensive", "Primary"], slow: 1500 });
  await view(p, "armour");
  await p.selectOption("#mgr-arm-member", "1000001");
  await p.click('.mgr-arm-loan[data-row="0"]');
  await view(p, "weapons");
  // The same member picked in Weapons while the piece is on its way.
  await p.selectOption("#mgr-arm-member", "1000001");
  await landed(p);
  // Only a weapon's loan clears Weapons' pick, so this one still lends.
  await p.click('.mgr-arm-loan[data-row="1"]');
  await holderIs(p, 1, "Alpha");
  await ctx.close();
  assert.deepStrictEqual(actions(posts), ["loan 603 Defensive Alpha [1000001]", "loan 502 Primary Alpha [1000001]"]);
});

await t("switching back to Weapons keeps its list, pick and search", async () => {
  const { ctx, p } = await open();
  await p.fill("#mgr-arm-search", "warlord");
  await p.selectOption("#mgr-arm-member", "1000002");
  await view(p, "armour");
  const armourSearch = await p.$eval("#mgr-arm-search", (i) => [i.value, i.placeholder]);
  await view(p, "weapons");
  const back = await p.$eval("#mgr-arm-search", (i) => i.value);
  const got = await rows(p), pick = await pickValue(p);
  await ctx.close();
  assert.deepStrictEqual(armourSearch, ["", "Search piece, part or member"]);
  assert.strictEqual(back, "warlord");
  assert.strictEqual(got.length, 1, JSON.stringify(got));
  assert.ok(got[0].includes("AK-47"), got[0]);
  assert.strictEqual(pick, "1000002");
});

await t("the search in Armour finds a piece, a body part or a holder", async () => {
  const { ctx, p } = await open();
  await view(p, "armour");
  const count = async (q) => { await p.fill("#mgr-arm-search", q); return (await rows(p)).length; };
  const got = [await count("gloves"), await count("feet"), await count("charlie")];
  await ctx.close();
  assert.deepStrictEqual(got, [2, 2, 1]);
});

await t("↩ in Armour takes that piece back as Defensive", async () => {
  const { ctx, p, posts } = await open({ accept: ["Defensive"] });
  await view(p, "armour");
  const back = '.mgr-arm-back[data-row="1"]';
  await p.click(back); await p.click(back);
  await p.waitForFunction(() => document.querySelectorAll("#mgr-arm-list .mgr-arm-row")[1].innerText.includes("Loan"), null, { timeout: 5000 });
  await ctx.close();
  assert.deepStrictEqual(actions(posts), ["retrieve 602 Defensive Bravo [1000002]"]);
});

await b.close();
console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
