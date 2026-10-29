// Your energy on the attack page in a browser: a small "⚡875" right after
// your name in your own header (Torn's green one), in the name's colour. It
// shows what FactionOps read from Torn's API when the page opened, then the
// energy Torn's sidebar saved in sessionStorage once that changes on the page.
// Nothing on the page moves when it appears, Torn's own row (your name grows
// to fill it) still has it 6 px from your name, a header with no room for all
// of it gets none, no reading is no number, a profile page or an attack log
// gets none, and a page with nothing new to show is left alone. Numbers,
// names, class hashes and the key are made up.
import fs from "fs";
import assert from "assert";
const { chromium } = await import("/root/.hermes/hermes-agent/node_modules/playwright-core/index.mjs");
// FO_SRC points it at another copy (the mutants use it).
const script = fs.readFileSync(process.env.FO_SRC || new URL("../../server/public/scripts/factionops.user.js", import.meta.url), "utf8");
const b = await chromium.launch({ args: ["--no-sandbox"] });

// What a userscript manager would give the script, with GM storage and the
// server stubbed: every request is logged, the sign-in answers as a member of
// faction 1000003, the client log takes what it is sent and answers 204 with
// no body, as the server does, and Torn's bars
// answer cfg.bars (875/150 unless a test says otherwise), cfg.barsDelay ms
// after they are asked for (50 unless a test says otherwise). With cfg.sidebar ({ amount, max }) the tab starts with
// that energy in Torn's saved sidebar data; with cfg.blockStorage the page's
// sessionStorage throws, as a browser blocking site data does. Every pass the
// script queues (hpQueue's setTimeout of hpPass) is counted in __passes.
const preamble = (cfg) => `(() => {
  const cfg = ${JSON.stringify(cfg)};
  const store = { factionops_apikey: "testkey1234" };
  const answers = {
    "/api/auth": { token: "jwt-test", player: { playerId: 1000002, playerName: "Tester", factionId: 1000003 } },
    "selections=bars&key=K": cfg.bars || { energy: { current: 875, maximum: 150, ticktime: 100, fulltime: 600 } },
    "/api/debug/client-log": "",
  };
  const statuses = { "/api/debug/client-log": 204 };
  if (cfg.sidebar) sessionStorage.setItem("sidebarData1000002", JSON.stringify({ bars: { energy: cfg.sidebar } }));
  if (cfg.blockStorage) Object.defineProperty(window, "sessionStorage", { configurable: true, get() { throw new DOMException("The operation is insecure.", "SecurityError"); } });
  window.__passes = 0;
  const setT = window.setTimeout;
  window.setTimeout = function (fn, ...rest) {
    if (typeof fn === "function" && fn.name === "hpPass") window.__passes++;
    return setT.call(window, fn, ...rest);
  };
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
    const wait = path.startsWith("selections=bars") && cfg.barsDelay ? cfg.barsDelay : 50;
    const status = statuses[path] || 200;
    setTimeout(() => o.onload({ status, responseText: status === 204 ? "" : JSON.stringify(answers[path]) }), wait);
  };
})();`;

// Torn's phone layout as its markup reads: both players' headers stacked, then
// your weapons. Each header is Torn's button holding a name row (the name,
// then the entries: hits and life) over a life bar. The row's CSS is not
// known: a flex row with the name at one end and the entries at the other
// unless cfg.rowCss says otherwise, and cfg.nameCss adds to the name's. The
// name is light and the row dark, so a number in the row's colour would show
// it.
const ROW_CSS = "display:flex;align-items:center;justify-content:space-between";
// Torn's own name row, as members' phones report it: a flex row whose name
// grows to fill it, so the name's box runs on to the entries.
const REAL_ROW = "display:flex;justify-content:flex-start";
const GROWS = ";flex:1 1 auto";
const row = (name, cfg = {}) => `<div class="topWrap___x" style="${cfg.rowCss || ROW_CSS};font-size:16px;color:rgb(20, 20, 20)">`
  + `<span class="userName___x user-name left" id="r-name-${name}" style="color:rgb(250, 250, 250);font-weight:700${cfg.nameCss || ""}">${name}</span>`
  + '<div class="textEntries___x" style="display:flex;gap:8px;justify-content:flex-end"><div class="entry___x"><span>0</span></div><div class="entry___x"><span>7,100 / 7,100</span></div></div></div>';
const header = (side, name, cfg) => `<div class="headerWrapper___x ${side}___x"><div class="header___x" role="button" tabindex="0">`
  + row(name, cfg) + '<div class="pbWrap___x" style="height:4px;background:#55f"></div></div></div>';
const page = (cfg) => `<!doctype html><html><head><meta charset="utf-8"><title>attack</title></head><body style="margin:0">
<div id="mainContainer"><div class="coreWrap___x"><div class="playersModelWrap___x">
${header("green", "Tester", cfg)}
${header("rose", "Enemyname", cfg)}
<div class="playerArea___x"><div class="weaponList___x"><div id="weapon_main" style="height:80px">Primary</div></div></div>
</div></div><div class="log___x"><span id="busy">0</span></div></div>
<script src="/fo-preamble.js"></script><script src="/factionops.user.js"></script></body></html>`;

// The page, with every console line the script writes in `logs`.
async function open(url, cfg = {}) {
  const ctx = await b.newContext({ viewport: { width: 393, height: 800 } });
  const p = await ctx.newPage();
  const logs = [];
  p.on("console", (m) => logs.push(m.text()));
  await p.route("**/*", (r) => {
    const u = r.request().url();
    if (u.endsWith("/fo-preamble.js")) return r.fulfill({ contentType: "application/javascript", body: preamble(cfg) });
    if (u.endsWith("/factionops.user.js")) return r.fulfill({ contentType: "application/javascript", body: script });
    if (u === url) return r.fulfill({ contentType: "text/html", body: page(cfg) });
    return r.fulfill({ status: 204, body: "" });
  });
  await p.goto(url, { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(2500);
  return { ctx, p, logs };
}
const ATTACK = "https://www.torn.com/page.php?sid=attack&user2ID=1000001";
const BOLT = "⚡";
const YOUR_ROW = '[class*="headerWrapper__"][class*="green__"] [class*="topWrap__"]';
const paintErrors = (logs) => logs.filter((l) => l.includes("attack energy paint failed"));

// The number as the page shows it, or null: its words; whether it is in your
// name's row after the name, or in their header; how many there are; the gap
// in px from your name's words to its own (words, not boxes: on Torn's own
// row the name's box runs on past its words); whether it sits in the name's
// line; and its look next to the row: its size, weight, and whether it has
// the name's colour.
const label = (p) => p.evaluate(() => {
  const e = document.getElementById("fo-atk-energy");
  if (!e) return null;
  const name = document.querySelector('[class*="headerWrapper__"][class*="green__"] .user-name');
  const n = name.getBoundingClientRect(), r = e.getBoundingClientRect();
  const words = document.createRange(), nameWords = document.createRange();
  words.selectNodeContents(e);
  nameWords.selectNodeContents(name);
  const cs = getComputedStyle(e), rowCs = getComputedStyle(name.parentElement);
  return {
    text: e.textContent,
    afterName: e.parentElement === name.parentElement && !!(name.compareDocumentPosition(e) & Node.DOCUMENT_POSITION_FOLLOWING),
    inTheirs: !!e.closest('[class*="rose__"]'),
    count: document.querySelectorAll("#fo-atk-energy").length,
    gap: Math.round(words.getBoundingClientRect().left - nameWords.getBoundingClientRect().right),
    inLine: Math.abs((r.top + r.bottom) / 2 - (n.top + n.bottom) / 2) <= 2,
    size: Math.round(parseFloat(cs.fontSize) / parseFloat(rowCs.fontSize) * 100) / 100,
    weight: cs.fontWeight,
    nameColour: cs.color === getComputedStyle(name).color,
  };
});
const SHOWN = { text: BOLT + "875", afterName: true, inTheirs: false, count: 1, gap: 6, inLine: true, size: 0.85, weight: "400", nameColour: true };
// Waits up to 4 s for the number to read `text`; true once it does.
const until = (p, text) => p.waitForFunction((want) => {
  const e = document.getElementById("fo-atk-energy");
  return !!e && e.textContent === want;
}, text, { timeout: 4000 }).then(() => true, () => false);
// Waits up to 4 s for anything of FactionOps' with the energy's id (the
// number, or an older copy's bar); true once there is.
const appears = (p) => p.waitForFunction(() => !!document.getElementById("fo-atk-energy"), null, { timeout: 4000 }).then(() => true, () => false);
// Waits up to 4 s for the number to be in your name's row after the name.
const backAfterName = (p) => p.waitForFunction(() => {
  const e = document.getElementById("fo-atk-energy");
  const name = document.querySelector('[class*="headerWrapper__"][class*="green__"] .user-name');
  return !!e && !!name && e.parentElement === name.parentElement && !!(name.compareDocumentPosition(e) & Node.DOCUMENT_POSITION_FOLLOWING);
}, null, { timeout: 4000 }).then(() => true, () => false);
// Where things sit now, to a hundredth of a pixel: their header, your first
// weapon, your name's words (what members see: its box may change with
// nothing on screen moving) and your entries in your row.
const layout = (p) => p.evaluate(() => {
  const box = (r) => [r.left, r.top, r.width, r.height].map((n) => Math.round(n * 100) / 100).join(",");
  const at = (sel) => box(document.querySelector(sel).getBoundingClientRect());
  const words = (sel) => { const g = document.createRange(); g.selectNodeContents(document.querySelector(sel)); return box(g.getBoundingClientRect()); };
  return {
    theirs: at('[class*="headerWrapper__"][class*="rose__"]'),
    weapon: at("#weapon_main"),
    name: words('[class*="headerWrapper__"][class*="green__"] .user-name'),
    entries: at('[class*="headerWrapper__"][class*="green__"] [class*="textEntries__"]'),
  };
});
// Watches the number for 5 s: every change to it or to its row's child list,
// whether it is still the same element at the end, and how many passes were
// queued. With `busy`, Torn's fight log changes every 300 ms meanwhile.
const watch = (p, busy) => p.evaluate((busy) => new Promise((done) => {
  const el = document.getElementById("fo-atk-energy");
  const seen = [];
  const note = (ms) => { for (const m of ms) seen.push(m.type + (m.attributeName ? ":" + m.attributeName : "")); };
  new MutationObserver(note).observe(el, { subtree: true, childList: true, attributes: true, characterData: true });
  new MutationObserver(note).observe(el.parentElement, { childList: true });
  const before = window.__passes;
  let n = 0;
  const tick = busy ? setInterval(() => { document.getElementById("busy").textContent = String(++n); }, 300) : null;
  setTimeout(() => {
    clearInterval(tick);
    done({ seen, same: document.getElementById("fo-atk-energy") === el, passes: window.__passes - before });
  }, 5000);
}), busy);

let pass = 0, fail = 0;
// FO_ONLY (a pattern) runs only the tests whose names match it.
const only = process.env.FO_ONLY ? new RegExp(process.env.FO_ONLY) : null;
const t = async (n, f) => { if (only && !only.test(n)) return; try { await f(); pass++; console.log("ok   " + n); } catch (e) { fail++; console.log("FAIL " + n + " :: " + e.message); } };

await t("the number sits right after your name, in your header only", async () => {
  const { ctx, p } = await open(ATTACK);
  const shown = await until(p, BOLT + "875");
  const got = await label(p);
  await ctx.close();
  assert.ok(shown, JSON.stringify(got));
  assert.deepStrictEqual(got, SHOWN);
});

await t("the number follows Torn's saved energy once it changes on the page", async () => {
  // The 900 saved at load is taken for an earlier page's copy: the number
  // keeps the API's 875 until Torn rewrites it.
  const { ctx, p } = await open(ATTACK, { sidebar: { amount: 900, max: 150 } });
  const opened = await until(p, BOLT + "875");
  await p.evaluate(() => sessionStorage.setItem("sidebarData1000002", JSON.stringify({ bars: { energy: { amount: 1050, max: 150 } } })));
  const followed = await until(p, BOLT + "1,050");
  const got = await label(p);
  await ctx.close();
  assert.ok(opened, "never read 875");
  assert.ok(followed, JSON.stringify(got));
  assert.deepStrictEqual(got, { ...SHOWN, text: BOLT + "1,050" });
});

await t("the number coming in moves nothing", async () => {
  // The bars answer 4 s in, once the page has settled, so the page is
  // measured once before the number and once after it.
  const { ctx, p } = await open(ATTACK, { barsDelay: 4000 });
  const before = await layout(p);
  const none = await p.evaluate(() => !document.getElementById("fo-atk-energy"));
  const shown = await appears(p);
  const after = await layout(p);
  await ctx.close();
  assert.ok(none, "the number was up before the reading came in");
  assert.ok(shown, "no number");
  assert.deepStrictEqual(after, before);
});

await t("Torn's own row, where your name grows to fill it, has the number 6 px from your name", async () => {
  const { ctx, p } = await open(ATTACK, { rowCss: REAL_ROW, nameCss: GROWS });
  // Without :has() no browser could hold the name back: that would fail this
  // test for a reason that is not the script's.
  const has = await p.evaluate(() => CSS.supports("selector(:has(~ a))"));
  const shown = await until(p, BOLT + "875");
  const got = await label(p);
  await ctx.close();
  assert.ok(has, "this browser has no :has()");
  assert.ok(shown, JSON.stringify(got));
  assert.deepStrictEqual(got, SHOWN);
});

await t("the number coming into Torn's own row moves nothing", async () => {
  const { ctx, p } = await open(ATTACK, { barsDelay: 4000, rowCss: REAL_ROW, nameCss: GROWS });
  const before = await layout(p);
  const none = await p.evaluate(() => !document.getElementById("fo-atk-energy"));
  const shown = await appears(p);
  const after = await layout(p);
  await ctx.close();
  assert.ok(none, "the number was up before the reading came in");
  assert.ok(shown, "no number");
  assert.deepStrictEqual(after, before);
});

// Your row made just `spare` px wider than your name, your entries and the
// row's own gap need, as a long name on a phone leaves it.
const squeeze = (p, spare) => p.evaluate(({ sel, spare }) => {
  const r = document.querySelector(sel);
  const w = (s) => r.querySelector(s).getBoundingClientRect().width;
  r.style.width = Math.ceil(w(".user-name") + w('[class*="textEntries__"]') + (parseFloat(getComputedStyle(r).columnGap) || 0) + spare) + "px";
}, { sel: YOUR_ROW, spare });
// Waits up to 4 s for the report of a row with no room; true once it is sent.
const reported = (p) => p.waitForFunction(() => window.__reqs.some((r) => r.url.endsWith("/api/debug/client-log") && String(r.data).includes('"fo-atk-energy"')), null, { timeout: 4000 }).then(() => true, () => false);
const reports = (p) => p.evaluate(() => window.__reqs.filter((r) => r.url.endsWith("/api/debug/client-log") && String(r.data).includes('"fo-atk-energy"')).map((r) => JSON.parse(r.data).data));
const noRoomLogs = (logs) => logs.filter((l) => l.includes("attack energy: no room"));

// 4 px of room, less than the gap after the name: a cut number could misread
// ("⚡8…" for 875), so there is none, nothing else gives way, and the report
// says it was cut.
await t("a crowded header shows no number rather than a cut one, and nothing moves", async () => {
  const { ctx, p } = await open(ATTACK, { barsDelay: 4000 });
  await squeeze(p, 4);
  const before = await layout(p);
  const none = await p.evaluate(() => !document.getElementById("fo-atk-energy"));
  const sent = await reported(p);
  const after = await layout(p);
  const gone = await p.evaluate(() => !document.getElementById("fo-atk-energy"));
  const sentNow = await reports(p);
  await ctx.close();
  assert.ok(none, "the number was up before the reading came in");
  assert.ok(sent, "no report");
  assert.ok(gone, "a cut number was left up");
  assert.deepStrictEqual(after, before);
  assert.strictEqual(sentNow[0].why, "cut");
});

await t("a row with its own gap still has the number 6 px from your name", async () => {
  const { ctx, p } = await open(ATTACK, { rowCss: ROW_CSS + ";column-gap:8px" });
  const shown = await until(p, BOLT + "875");
  const got = await label(p);
  await ctx.close();
  assert.ok(shown, JSON.stringify(got));
  assert.deepStrictEqual(got, SHOWN);
});

await t("a row with its own gap, short of room, shows no number, and nothing moves", async () => {
  // The gap would come twice with the number in and squeeze your HP; taken
  // back, the number is only cut, never in the way.
  const { ctx, p } = await open(ATTACK, { barsDelay: 4000, rowCss: ROW_CSS + ";column-gap:8px" });
  await squeeze(p, 4);
  const before = await layout(p);
  const sent = await reported(p);
  const after = await layout(p);
  const gone = await p.evaluate(() => !document.getElementById("fo-atk-energy"));
  const sentNow = await reports(p);
  await ctx.close();
  assert.ok(sent, "no report");
  assert.ok(gone, "a cut number was left up");
  assert.deepStrictEqual(after, before);
  assert.strictEqual(sentNow[0].why, "cut");
});

// A row the number cannot go in without moving something gets none: it is
// measured before and after the number goes in, before the page is drawn,
// and taken out again. That row keeps none (no pass tries again), and the
// row's CSS goes to the client log once per version.
await t("a row laid out as a grid gets no number, nothing moves, and it is reported once", async () => {
  const { ctx, p, logs } = await open(ATTACK, { barsDelay: 4000, rowCss: "display:grid;grid-template-columns:1fr auto;align-items:center" });
  const before = await layout(p);
  const sent = await reported(p);
  const after = await layout(p);
  const none = await p.evaluate(() => !document.getElementById("fo-atk-energy"));
  const idle = await p.evaluate(() => new Promise((done) => { const b = window.__passes; setTimeout(() => done(window.__passes - b), 5000); }));
  // Torn draws the row again: it is tried again, and again has no room, but
  // is not reported twice.
  await p.evaluate(({ sel, html }) => { document.querySelector(sel).outerHTML = html; }, { sel: YOUR_ROW, html: row("Tester", { rowCss: "display:grid;grid-template-columns:1fr auto;align-items:center" }) });
  for (const end = Date.now() + 4000; noRoomLogs(logs).length < 2 && Date.now() < end;) await p.waitForTimeout(100);
  const sentNow = await reports(p);
  await ctx.close();
  assert.ok(sent, "no report: " + JSON.stringify(noRoomLogs(logs)));
  assert.ok(none, "a number was left up");
  assert.deepStrictEqual(after, before);
  assert.strictEqual(idle, 0, "passes kept trying the row with no room");
  assert.strictEqual(noRoomLogs(logs).length, 2, JSON.stringify(logs.slice(-5)));
  assert.strictEqual(sentNow.length, 1);
  assert.strictEqual(sentNow[0].display, "grid");
  assert.strictEqual(sentNow[0].why, "moved");
  assert.match(sentNow[0].v, /^\d+\.\d+\.\d+$/);
});

await t("a row around a floated name gets no number, and nothing moves", async () => {
  // Torn's name carries a global "left" class: in a plain block row, a
  // number put between the floated name and the entries would push the
  // entries down a line.
  const { ctx, p } = await open(ATTACK, { barsDelay: 4000, rowCss: "display:block", nameCss: ";float:left" });
  const before = await layout(p);
  const sent = await reported(p);
  const after = await layout(p);
  const none = await p.evaluate(() => !document.getElementById("fo-atk-energy"));
  const sentNow = await reports(p);
  await ctx.close();
  assert.ok(sent, "no report");
  assert.ok(none, "a number was left up");
  assert.deepStrictEqual(after, before);
  assert.strictEqual(sentNow[0].display, "block");
  assert.strictEqual(sentNow[0].nameFloat, "left");
});

await t("a name centred in its row gets no number, and nothing moves", async () => {
  // Held back while the number follows it, a name centred in the room it
  // grew into would jump left: that row keeps none.
  const { ctx, p } = await open(ATTACK, { barsDelay: 4000, rowCss: REAL_ROW, nameCss: GROWS + ";text-align:center" });
  const before = await layout(p);
  const sent = await reported(p);
  const after = await layout(p);
  const none = await p.evaluate(() => !document.getElementById("fo-atk-energy"));
  const sentNow = await reports(p);
  await ctx.close();
  assert.ok(sent, "no report");
  assert.ok(none, "a number was left up");
  assert.deepStrictEqual(after, before);
  assert.strictEqual(sentNow[0].why, "moved");
});

await t("Torn redrawing your header puts the number back after your name", async () => {
  const { ctx, p } = await open(ATTACK);
  const shown = await until(p, BOLT + "875");
  // The whole row drawn again: the number goes with the old one.
  await p.evaluate(({ sel, html }) => { document.querySelector(sel).outerHTML = html; }, { sel: YOUR_ROW, html: row("Tester") });
  const redrawn = await backAfterName(p);
  // Then only the name drawn again, put back ahead of the entries as Torn
  // inserts it: that leaves the number in front of the new name.
  await p.evaluate((sel) => {
    const r = document.querySelector(sel);
    const old = r.querySelector(".user-name");
    const fresh = old.cloneNode(true);
    old.remove();
    r.insertBefore(fresh, r.querySelector('[class*="textEntries__"]'));
  }, YOUR_ROW);
  const renamed = await backAfterName(p);
  const got = await label(p);
  await ctx.close();
  assert.ok(shown, "no number before the redraw");
  assert.ok(redrawn, "not back after the row was redrawn");
  assert.ok(renamed, JSON.stringify(got));
  assert.deepStrictEqual(got, SHOWN);
});

await t("another script's tag after your name is left alone", async () => {
  const { ctx, p } = await open(ATTACK);
  const shown = await until(p, BOLT + "875");
  await p.evaluate(() => {
    const tag = document.createElement("span");
    tag.id = "other-tag";
    tag.textContent = "[x]";
    document.querySelector('[class*="headerWrapper__"][class*="green__"] .user-name').after(tag);
  });
  const quiet = await watch(p, false);
  const order = await p.evaluate(() => {
    const n = document.querySelector('[class*="headerWrapper__"][class*="green__"] .user-name');
    return [n.nextElementSibling.id, n.nextElementSibling.nextElementSibling.id];
  });
  await ctx.close();
  assert.ok(shown, "no number");
  assert.deepStrictEqual({ seen: quiet.seen, same: quiet.same }, { seen: [], same: true });
  assert.deepStrictEqual(order, ["other-tag", "fo-atk-energy"]);
});

await t("on Torn's own row, another script's tag after your name leaves the number 6 px past it", async () => {
  // Your name is held back while the number is anywhere after it, not only
  // right after it: the tag sits by your name's words, the number by the tag.
  const { ctx, p } = await open(ATTACK, { rowCss: REAL_ROW, nameCss: GROWS });
  const shown = await until(p, BOLT + "875");
  await p.evaluate(() => {
    const tag = document.createElement("span");
    tag.id = "other-tag";
    tag.textContent = "[x]";
    document.querySelector('[class*="headerWrapper__"][class*="green__"] .user-name').after(tag);
  });
  await p.waitForTimeout(2500);
  const gap = await p.evaluate(() => {
    const words = (el) => { const g = document.createRange(); g.selectNodeContents(el); return g.getBoundingClientRect(); };
    const name = document.querySelector('[class*="headerWrapper__"][class*="green__"] .user-name');
    const tag = document.getElementById("other-tag");
    return Math.round(words(document.getElementById("fo-atk-energy")).left - words(name).right - tag.getBoundingClientRect().width);
  });
  await ctx.close();
  assert.ok(shown, "no number");
  assert.strictEqual(gap, 6);
});

await t("no reading, no number, and nothing fails", async () => {
  const { ctx, p, logs } = await open(ATTACK, { bars: { error: { code: 2, error: "Incorrect key" } } });
  await p.waitForTimeout(4000);
  const got = await label(p);
  const assist = await p.evaluate(() => !!document.getElementById("wb-assist-btn"));
  await ctx.close();
  assert.strictEqual(got, null);
  assert.strictEqual(assist, true);
  assert.deepStrictEqual(paintErrors(logs), []);
});

await t("a profile page gets no number", async () => {
  const { ctx, p } = await open("https://www.torn.com/profiles.php?XID=1000001");
  await p.waitForTimeout(4000);
  const got = await label(p);
  await ctx.close();
  assert.strictEqual(got, null);
});

await t("an attack log gets no number", async () => {
  // Its URL starts like the attack page's (sid=attackLog), and the reading
  // is taken there all the same.
  const { ctx, p } = await open("https://www.torn.com/page.php?sid=attackLog&ID=93f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4");
  await p.waitForTimeout(4000);
  const got = await label(p);
  const read = await p.evaluate(() => window.__reqs.some((r) => r.url.endsWith("selections=bars&key=K")));
  await ctx.close();
  assert.strictEqual(read, true);
  assert.strictEqual(got, null);
});

await t("blocked storage leaves the reading from the page opening standing", async () => {
  const { ctx, p, logs } = await open(ATTACK, { blockStorage: true });
  const blocked = await p.evaluate(() => { try { void window.sessionStorage; return false; } catch (_) { return true; } });
  const shown = await until(p, BOLT + "875");
  const got = await label(p);
  await ctx.close();
  assert.ok(blocked, "the stand-in did not block storage");
  assert.ok(shown, JSON.stringify({ got, errors: paintErrors(logs).slice(0, 1) }));
  assert.deepStrictEqual(got, SHOWN);
  assert.deepStrictEqual(paintErrors(logs), []);
});

await t("a quiet page is not repainted, nor passed over", async () => {
  const { ctx, p } = await open(ATTACK);
  const shown = await until(p, BOLT + "875");
  const quiet = shown ? await watch(p, false) : null;
  await ctx.close();
  assert.ok(shown, "no number");
  assert.deepStrictEqual(quiet, { seen: [], same: true, passes: 0 });
});

await t("a busy page runs its passes and leaves the number alone", async () => {
  // Torn's fight log changes all through a fight. Every change runs a pass,
  // and a pass with nothing new to show writes nothing to the number.
  const { ctx, p, logs } = await open(ATTACK);
  const shown = await until(p, BOLT + "875");
  const busy = shown ? await watch(p, true) : null;
  await ctx.close();
  assert.ok(shown, "no number");
  assert.ok(busy.passes > 0, "the busy page queued no passes: " + JSON.stringify(busy));
  assert.deepStrictEqual({ seen: busy.seen, same: busy.same }, { seen: [], same: true });
  assert.deepStrictEqual(paintErrors(logs), []);
});

await b.close();
console.log(`${pass} passed, ${fail} failed`);
process.exitCode = fail ? 1 : 0;
