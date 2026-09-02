// The paste board on the Now tab, and the FAA gate on the Board tab.
//
// The unit suite calls pasteLine/pasteParse/pasteCollect directly, so it stays
// green whether or not a button reaches them, whether the tab strip honours the
// gate, and whether what you paste survives the render tick that rebuilds the
// panel every second. This drives the real page.
import fs from "fs";
import assert from "assert";
const { chromium } = await import("/root/.hermes/hermes-agent/node_modules/playwright-core/index.mjs");
const html = fs.readFileSync("harness/index.html", "utf8");
const script = fs.readFileSync("harness/gym-coach-beta.user.js", "utf8");
const src = fs.readFileSync("gym-coach-beta.user.js", "utf8");
const b = await chromium.launch({ args: ["--no-sandbox"] });

// Constants off the source, never restated: WEEK_EPOCH_DAY is why a gym week
// starts on Monday rather than on the epoch's Thursday.
const num = n => Number((src.match(new RegExp("var\\s+" + n + "\\s*=\\s*([0-9]+)")) || [])[1]);
const DAY_MS = num("DAY_MS");
const WEEK_EPOCH_DAY = num("WEEK_EPOCH_DAY");
const WK = Math.floor((Math.floor(Date.now() / DAY_MS) - WEEK_EPOCH_DAY) / 7);
const D0 = WK * 7 + WEEK_EPOCH_DAY;

async function panel({ mem = {}, keyFaction, keyFactionSel, tab = "now" } = {}) {
  const ctx = await b.newContext({
    viewport: { width: 393, height: 1400 },
    permissions: ["clipboard-read", "clipboard-write"]
  });
  const page = await ctx.newPage();
  await page.route("**/*", r => {
    const u = r.request().url();
    if (u.includes("gym-coach-beta.user.js")) return r.fulfill({ contentType: "application/javascript", body: script });
    if (/gym\.php/.test(u)) return r.fulfill({ contentType: "text/html", body: html });
    return r.fulfill({ status: 204, body: "" });
  });
  const cfg = {
    energy: 150, energyMax: 150, fulltime: 0, drug: 0, booster: 0,
    xan: 85, cans: 21, happy: 4300, happyMax: 5000, gym: 24,
    stats: { str: 150422278, def: 104614286, spe: 150464114, dex: 146009 },
    ...(keyFaction === undefined ? {} : { keyFaction }),
    ...(keyFactionSel === undefined ? {} : { keyFactionSel }),
    mem: Object.assign({ gcb_v1_mode: "xan", gcb_v1_focus: "str", gcb_v1_tab: tab }, mem)
  };
  await page.goto("https://www.torn.com/gym.php?cfg=" + encodeURIComponent(JSON.stringify(cfg)),
                  { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2200);
  return { page, ctx };
}

const readPanel = page => page.evaluate(() => {
  const p = document.getElementById("gcb-panel");
  return {
    body: p.textContent || "",
    tabs: [...p.querySelectorAll(".tabs button")].map(x => x.textContent.trim()),
    rows: [...p.querySelectorAll(".gc-card")]
      .filter(c => c.querySelector("h3") && /Faction board by paste/.test(c.querySelector("h3").textContent))
      .flatMap(c => [...c.querySelectorAll(".gcb-brow:not(.head)")].map(r => r.innerText))
  };
});

// The panel renders collapsed, so Playwright's visibility-checked click/fill
// never fire on it. Every other browser suite here drives it through evaluate.
const click = (page, sel) => page.evaluate(s => document.querySelector(s).click(), sel);
const fillBox = (page, v) => page.evaluate(v => {
  const el = document.getElementById("gcbPaste");
  el.value = v;
  el.dispatchEvent(new Event("input", { bubbles: true }));
}, v);

let pass = 0, fail = 0;
const t = async (n, f) => { try { await f(); pass++; console.log("ok   " + n); }
                            catch (e) { fail++; console.log("FAIL " + n + " :: " + e.message); } };

// ---- the gate ---------------------------------------------------------------

await t("a key that can read contributors is offered the Board tab", async () => {
  const { page, ctx } = await panel({});
  const r = await readPanel(page);
  assert.ok(r.tabs.includes("Board"), "no Board tab: " + JSON.stringify(r.tabs));
  await ctx.close();
});

await t("without the position ability there is no Board tab at all", async () => {
  // Not an empty tab explaining itself -- no tab. The board reads faction
  // contributors and nothing else can stand in for it.
  const { page, ctx } = await panel({ keyFaction: false });
  const r = await readPanel(page);
  assert.ok(!r.tabs.includes("Board"), "Board tab offered anyway: " + JSON.stringify(r.tabs));
  await ctx.close();
});

await t("a key whose faction selections lack contributors gets no Board tab", async () => {
  const { page, ctx } = await panel({ keyFactionSel: ["basic", "members"] });
  const r = await readPanel(page);
  assert.ok(!r.tabs.includes("Board"), "Board tab offered anyway: " + JSON.stringify(r.tabs));
  await ctx.close();
});

await t("the settings override brings the tab back", async () => {
  const { page, ctx } = await panel({ keyFaction: false, mem: { gcb_v1_boardForce: "true" } });
  const r = await readPanel(page);
  assert.ok(r.tabs.includes("Board"), "override ignored: " + JSON.stringify(r.tabs));
  await ctx.close();
});

await t("sitting on the board when the gate closes lands you on Now", async () => {
  const { page, ctx } = await panel({ keyFaction: false, tab: "board" });
  const r = await readPanel(page);
  assert.ok(!/Faction board<\/h3>/.test(r.body), "still rendering the board tab");
  assert.ok(/Faction board by paste/.test(r.body), "did not land on Now: " + r.body.slice(0, 200));
  await ctx.close();
});

// ---- the card, for everyone -------------------------------------------------

await t("the paste card is on Now even with no faction access", async () => {
  const { page, ctx } = await panel({ keyFaction: false });
  const r = await readPanel(page);
  assert.match(r.body, /Faction board by paste/);
  await ctx.close();
});

await t("your own week is read off this device's ledger", async () => {
  const ledger = [{ d: D0, used: 3000, off: 50, wasted: 0 },
                  { d: D0 + 1, used: 1400, off: 0, wasted: 0 }];
  const byDayStat = {}; byDayStat[D0] = { str: 3000 }; byDayStat[D0 + 1] = { str: 1400 };
  const { page, ctx } = await panel({ mem: {
    gcb_v1_ledger: JSON.stringify(ledger),
    gcb_v1_trainLog: JSON.stringify({ byDay: {}, byDayStat: byDayStat })
  } });
  const r = await readPanel(page);
  assert.match(r.body, /4,400e into the gym/, r.body.slice(0, 300));
  assert.match(r.body, /50e attacking/);
  await ctx.close();
});

await t("COPY puts a line on the clipboard that the parser accepts", async () => {
  const ledger = [{ d: D0, used: 3000, off: 0, wasted: 0 }];
  const { page, ctx } = await panel({ mem: { gcb_v1_ledger: JSON.stringify(ledger) } });
  await click(page, '[data-act="pastecopy"]');
  await page.waitForTimeout(300);
  const text = await page.evaluate(() => navigator.clipboard.readText());
  assert.match(text, /^GCB1\|/, "not a line: " + text);
  assert.ok(!/\s/.test(text), "whitespace in the copied line: " + text);
  assert.ok(text.indexOf("|3000|") !== -1, "the week's energy is not in it: " + text);
  await ctx.close();
});

// ---- collecting other people's ---------------------------------------------

// Built with the page's own builder, so the fixture cannot drift from the
// format: a hand-written line with a stale checksum would be rejected and the
// test would be asserting the rejection path by accident. The functions are
// lifted out of the source rather than exported by it -- a test-only hook in
// shipped code is a worse trade than this.
function grab(n){const i=src.indexOf("function "+n+"(");let d=0,j=src.indexOf("{",i);
  for(let k=j;k<src.length;k++){if(src[k]==="{")d++;else if(src[k]==="}"){d--;if(!d)return src.slice(i,k+1);}}}
const TAG_DECL = (src.match(/  var LINE_TAG = [^\n]*/) || [""])[0];
const LINE_SRC = TAG_DECL + "\n" + grab("pasteCk") + "\n" + grab("pasteLine");
async function lineFor(page, o) {
  return page.evaluate(([code, arg]) =>
    new Function("var R;" + code + "\nR = pasteLine(arguments[0]);\nreturn R;")(arg), [LINE_SRC, o]);
}

await t("pasted lines become a ranked table", async () => {
  const { page, ctx } = await panel({});
  const a = await lineFor(page, { id: 111, name: "Alfie", week: WK, gymE: 4000, str: 4000,
                                  def: 0, spe: 0, dex: 0, atkE: 0, xan: 3, at: Math.round(Date.now() / 1000) });
  const c = await lineFor(page, { id: 222, name: "Bella", week: WK, gymE: 9000, str: 0,
                                  def: 9000, spe: 0, dex: 0, atkE: 25, xan: null, at: Math.round(Date.now() / 1000) });
  await fillBox(page, "chatter here\n" + a + "\nand more\n" + c);
  await click(page, '[data-act="pasteread"]');
  await page.waitForTimeout(400);
  const r = await readPanel(page);
  assert.strictEqual(r.rows.length, 2, "rows: " + JSON.stringify(r.rows));
  assert.match(r.rows[0], /Bella/, "not ranked by gym energy: " + JSON.stringify(r.rows));
  assert.match(r.rows[1], /Alfie/);
  await ctx.close();
});

await t("a line from another gym week is refused and said so", async () => {
  const { page, ctx } = await panel({});
  const old = await lineFor(page, { id: 111, name: "Alfie", week: WK - 1, gymE: 90000, str: 90000,
                                    def: 0, spe: 0, dex: 0, atkE: 0, xan: null, at: Math.round(Date.now() / 1000) });
  await fillBox(page, old);
  await click(page, '[data-act="pasteread"]');
  await page.waitForTimeout(400);
  const r = await readPanel(page);
  assert.strictEqual(r.rows.length, 0, "last week's line was counted: " + JSON.stringify(r.rows));
  assert.match(r.body, /another gym week/i, r.body.slice(0, 300));
  await ctx.close();
});

await t("what you paste survives the render tick before you press the button", async () => {
  // renderPanel() rebuilds the panel's markup on every poll. A textarea with
  // nothing behind it is empty again a second after the paste, and the button
  // then reads nothing.
  const { page, ctx } = await panel({});
  const a = await lineFor(page, { id: 111, name: "Alfie", week: WK, gymE: 4000, str: 4000,
                                  def: 0, spe: 0, dex: 0, atkE: 0, xan: null, at: Math.round(Date.now() / 1000) });
  await fillBox(page, a);
  // No forced render: the panel repaints on its own poll, which is exactly the
  // repaint that used to wipe the box.
  await page.waitForTimeout(2500);
  const kept = await page.evaluate(() => document.getElementById("gcbPaste").value);
  assert.strictEqual(kept, a, "the box was wiped by a re-render");
  await click(page, '[data-act="pasteread"]');
  await page.waitForTimeout(400);
  const r = await readPanel(page);
  assert.strictEqual(r.rows.length, 1, "rows: " + JSON.stringify(r.rows));
  await ctx.close();
});

await t("the collected board is still there on the next visit", async () => {
  const { page, ctx } = await panel({});
  const a = await lineFor(page, { id: 111, name: "Alfie", week: WK, gymE: 4000, str: 4000,
                                  def: 0, spe: 0, dex: 0, atkE: 0, xan: null, at: Math.round(Date.now() / 1000) });
  await fillBox(page, a);
  await click(page, '[data-act="pasteread"]');
  await page.waitForTimeout(400);
  const stored = await page.evaluate(() => localStorage.getItem("gcb_v1_pasted"));
  await ctx.close();
  assert.ok(stored && /Alfie/.test(stored), "nothing persisted: " + stored);
});

await b.close();
console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
