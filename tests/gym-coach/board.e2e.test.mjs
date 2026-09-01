// The faction board, in a browser.
//
// board.test.mjs proves the arithmetic. This proves the WIRING: that the tab
// exists, that its buttons reach a handler (a data-* attribute missing from
// the click router's closest() list is dead code the unit suite cannot see),
// that the five stat requests actually go out and do NOT go out on the poll
// tick, and that a refused key produces an explanation instead of a spinner.
import fs from "fs";
import assert from "assert";
const { chromium } = await import("/root/.hermes/hermes-agent/node_modules/playwright-core/index.mjs");
const html = fs.readFileSync("harness/index.html", "utf8");
const script = fs.readFileSync("harness/gym-coach-beta.user.js", "utf8");
const b = await chromium.launch({ args: ["--no-sandbox"] });
const page = await b.newPage({ viewport: { width: 393, height: 1400 } });
// A script error anywhere kills the panel silently. Deleting a function the
// board calls used to pass every suite here; this is the assertion that class
// of mistake cannot survive.
const errors = [];
page.on("pageerror", e => errors.push(String(e.message)));
await page.route("**/*", r => {
  const u = r.request().url();
  if (u.includes("gym-coach-beta.user.js")) return r.fulfill({ contentType: "application/javascript", body: script });
  if (/gym\.php/.test(u)) return r.fulfill({ contentType: "text/html", body: html });
  return r.fulfill({ status: 204, body: "" });
});

const ME = 2598755;
// Three members, so rank order is a real claim and not a coin toss.
const CONTRIB = {
  // in_faction:false -- somebody who left. cat=current should already drop
  // them, but a board that quietly lists ex-members is worse than one that
  // asks twice.
  gymenergy:    [[ME, "rcexyz", 5000000], [77, "quiet", 90000000], [88, "grinder", 12000000], [99, "gone", 400000000, false]],
  gymstrength:  [[ME, "rcexyz", 600000000], [77, "quiet", 1000], [88, "grinder", 40000000]],
  gymdefense:   [[ME, "rcexyz", 10000], [77, "quiet", 500000], [88, "grinder", 1000]],
  gymspeed:     [[ME, "rcexyz", 1], [77, "quiet", 1], [88, "grinder", 1]],
  gymdexterity: [[ME, "rcexyz", 1], [77, "quiet", 1], [88, "grinder", 1]]
};
// Same members, moved on. grinder trained hardest; rcexyz trained less but
// bought none of it; quiet's whole week came out of xanax.
const LATER = {
  gymenergy:    [[ME, "rcexyz", 5003360], [77, "quiet", 90010000], [88, "grinder", 12050000], [99, "gone", 400900000, false]],
  gymstrength:  [[ME, "rcexyz", 601200000], [77, "quiet", 1000], [88, "grinder", 42000000]],
  gymdefense:   [[ME, "rcexyz", 10000], [77, "quiet", 540000], [88, "grinder", 1000]],
  gymspeed:     [[ME, "rcexyz", 1], [77, "quiet", 1], [88, "grinder", 1]],
  gymdexterity: [[ME, "rcexyz", 1], [77, "quiet", 1], [88, "grinder", 1]]
};
const PS = {
  // rcexyz bought nothing all week.
  [ME]: { then: { refills: 10, xantaken: 100, energydrinkused: 5 },
          now:  { refills: 10, xantaken: 100, energydrinkused: 5 } },
  // quiet's 10,000 energy is 40 xanax.
  77: { then: { refills: 0, xantaken: 0, energydrinkused: 0 },
        now:  { refills: 0, xantaken: 40, energydrinkused: 0 } },
  88: { then: { refills: 0, xantaken: 0, energydrinkused: 0 },
        now:  { refills: 7, xantaken: 100, energydrinkused: 20 } }
};

const BASE = {
  energy: 45, energyMax: 150, fulltime: 3150, xan: 85, cans: 21, gym: 24, playerId: ME,
  stats: { str: 150422278, def: 104614286, spe: 150464114, dex: 146009 },
  mem: { gcb_v1_mode: "xan", gcb_v1_verdictFold: 1 }
};
async function load(extra) {
  errors.length = 0;
  const cfg = Object.assign({}, BASE, extra || {});
  cfg.mem = Object.assign({}, BASE.mem, (extra && extra.mem) || {});
  await page.goto("https://www.torn.com/gym.php?cfg=" + encodeURIComponent(JSON.stringify(cfg)),
                  { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1100);
}
const openBoard = async () => {
  await page.evaluate(() => document.querySelector('[data-tab="board"]').click());
  await page.waitForTimeout(4200); // five sequential requests behind a 700ms gap
};
const boardText = () => page.evaluate(() => {
  const el = document.querySelector("#gcb-panel .gc-body");
  return el ? el.innerText.replace(/\s+/g, " ").trim() : "";
});
const rows = () => page.evaluate(() =>
  [...document.querySelectorAll("#gcb-panel .gcb-brow:not(.head):not(.foot):not(.btns)")].map(r => ({
    rank: r.querySelector(".gcb-brank")?.textContent,
    name: r.querySelector(".gcb-bname")?.textContent,
    energy: r.querySelector(".gcb-benergy")?.textContent,
    nat: r.querySelector(".gcb-bnat")?.textContent,
    gain: r.querySelector(".gcb-bgain")?.textContent,
    me: r.classList.contains("me")
  })));
const countUrls = (re) => page.evaluate(r => window.__urls.filter(u => new RegExp(r).test(u)).length, re.source);

let pass = 0, fail = 0;
const t = async (n, f) => {
  try { await f(); assert.deepStrictEqual(errors, [], "page errors: " + errors.join(" | ")); pass++; console.log("ok   " + n); }
  catch (e) { fail++; console.log("FAIL " + n + " :: " + e.message); }
};

await t("the board is a tab, and opening it reads the faction", async () => {
  await load({ contributors: CONTRIB });
  assert.ok(await page.$('[data-tab="board"]'), "no Board tab");
  await openBoard();
  // innerText, so the card heading arrives already uppercased by CSS.
  assert.match(await boardText(), /Faction board/i);
});

await t("nothing is requested until the Board tab specifically is opened", async () => {
  // Five requests on every poll tick is how the 88-out-of-100 burst happened.
  await load({ contributors: CONTRIB });
  await page.waitForTimeout(1500);
  assert.strictEqual(await countUrls(/faction\/contributors/), 0, "the board polled without being asked");
  // And not merely "on the first tab click either" -- walking Now/Plan/Stock
  // must cost nothing. Without this the fetch could be unconditional in the
  // tab handler and every assertion above still passes.
  for (const tab of ["plan", "stock", "trend", "now"]) {
    await page.evaluate(id => document.querySelector('[data-tab="' + id + '"]').click(), tab);
    await page.waitForTimeout(250);
  }
  assert.strictEqual(await countUrls(/faction\/contributors/), 0,
    "browsing the other tabs cost five faction requests each");
});

await t("one request per stat, and no more", async () => {
  await load({ contributors: CONTRIB });
  await openBoard();
  assert.strictEqual(await countUrls(/faction\/contributors/), 5, "expected exactly five, one per stat");
});

await t("re-opening the tab inside the TTL does not ask again", async () => {
  await load({ contributors: CONTRIB });
  await openBoard();
  const first = await countUrls(/faction\/contributors/);
  await page.evaluate(() => document.querySelector('[data-tab="now"]').click());
  await page.waitForTimeout(200);
  await openBoard();
  assert.strictEqual(await countUrls(/faction\/contributors/), first, "re-opening re-fetched inside the TTL");
});

await t("the first read of a week is a baseline, so nobody is ranked on a lifetime total", async () => {
  await load({ contributors: CONTRIB });
  await openBoard();
  const r = await rows();
  assert.strictEqual(r.length, 3, JSON.stringify(r));
  r.forEach(x => assert.strictEqual(x.energy, "0e", "a first read must be all zeroes: " + JSON.stringify(r)));
});

await t("once the faction moves, the board ranks on the week's energy", async () => {
  // Second load reuses the SAME stored baseline, which is the whole mechanism.
  await load({ contributors: CONTRIB });
  await openBoard();
  await load({ contributors: LATER });
  await openBoard();
  const r = await rows();
  assert.strictEqual(r[0].name, "grinder", "ranked wrong: " + JSON.stringify(r));
  assert.strictEqual(r[0].energy, "50,000e");
  assert.strictEqual(r[1].name, "quiet");
  assert.strictEqual(r[1].energy, "10,000e");
  assert.strictEqual(r[2].name, "rcexyz");
  assert.strictEqual(r[2].energy, "3,360e");
});

await t("battle stats gained ride along with the energy", async () => {
  await load({ contributors: CONTRIB });
  await openBoard();
  await load({ contributors: LATER });
  await openBoard();
  const r = await rows();
  assert.match(r.find(x => x.name === "grinder").gain, /2m str/);
  assert.match(r.find(x => x.name === "rcexyz").gain, /1\.2m str/);
  assert.match(r.find(x => x.name === "quiet").gain, /40k def/);
});

await t("your own row is marked, so you can find yourself on it", async () => {
  await load({ contributors: CONTRIB });
  await openBoard();
  await load({ contributors: LATER });
  await openBoard();
  assert.strictEqual((await rows()).filter(x => x.me).length, 1);
  assert.strictEqual((await rows()).find(x => x.me).name, "rcexyz");
});

await t("the natural column is worked out only when asked for", async () => {
  await load({ contributors: CONTRIB, ps: PS });
  await openBoard();
  await load({ contributors: LATER, ps: PS });
  await openBoard();
  assert.strictEqual(await countUrls(/personalstats/), 0, "personalstats went out unasked");
  (await rows()).forEach(x => assert.strictEqual(x.nat, "—", "an unasked natural column must be blank, not 0%"));
});

await t("asking for it ranks who trained on regen rather than on pills", async () => {
  await load({ contributors: CONTRIB, ps: PS });
  await openBoard();
  await load({ contributors: LATER, ps: PS });
  await openBoard();
  await page.evaluate(() => document.querySelector('[data-board="natural"]').click());
  await page.waitForTimeout(9000);
  const r = await rows();
  // quiet's entire 10,000 came from 40 xanax at 250 each.
  assert.strictEqual(r.find(x => x.name === "quiet").nat, "0%", JSON.stringify(r));
  // rcexyz bought nothing: a full week of pure regen.
  assert.strictEqual(r.find(x => x.name === "rcexyz").nat, "100%", JSON.stringify(r));
  // grinder trained most but bought 7 refills, 100 xanax and 20 cans.
  const g = parseInt(r.find(x => x.name === "grinder").nat, 10);
  assert.ok(g > 0 && g < 60, "grinder's natural share should be partial, got " + g + "%");
});

await t("the week-start half is fetched once and then remembered", async () => {
  await load({ contributors: CONTRIB, ps: PS });
  await openBoard();
  await load({ contributors: LATER, ps: PS });
  await openBoard();
  await page.evaluate(() => document.querySelector('[data-board="natural"]').click());
  await page.waitForTimeout(9000);
  const withBaseline = await countUrls(/personalstats.*timestamp/);
  await page.evaluate(() => document.querySelector('[data-board="natural"]').click());
  await page.waitForTimeout(6000);
  assert.strictEqual(await countUrls(/personalstats.*timestamp/), withBaseline,
    "a past week's answer never changes, so it must not be re-fetched");
});

await t("a refused request does not turn into a retry loop", async () => {
  // The failure path has to stamp the clock too. When only success stamps it,
  // every re-open retries immediately and the refusal feeds itself -- which is
  // exactly the shape of the burst that put this account at 88/100.
  await load({ boardDenied: true, factionDenied: true });
  await openBoard();
  const first = await countUrls(/faction\/contributors/);
  assert.ok(first >= 1, "setup: the denied call should have gone out once");
  for (let i = 0; i < 3; i++) {
    await page.evaluate(() => document.querySelector('[data-tab="now"]').click());
    await page.waitForTimeout(150);
    await page.evaluate(() => document.querySelector('[data-tab="board"]').click());
    await page.waitForTimeout(600);
  }
  assert.strictEqual(await countUrls(/faction\/contributors/), first,
    "a refused board re-requested on every re-open");
});

await t("the copy buttons reach a handler and put the card on the clipboard", async () => {
  // The click router matches on an explicit attribute list. A data-board
  // button that is not on it is dead code, and looks identical until pressed.
  await load({ contributors: CONTRIB });
  await openBoard();
  await load({ contributors: LATER });
  await openBoard();
  await page.evaluate(() => {
    window.__copied = [];
    window.GM_setClipboard = t => window.__copied.push(t);
  });
  await page.evaluate(() => document.querySelector('[data-board="copy-chat"]').click());
  await page.waitForTimeout(200);
  const [chat] = await page.evaluate(() => window.__copied);
  assert.ok(chat, "nothing was copied -- is data-board on the click router's closest() list?");
  assert.match(chat, /Dead Fragment/);
  assert.match(chat, /grinder/);
  assert.match(chat, /50,000e/);
  assert.ok(!chat.includes("```"), "the chat card must not be fenced");
});

await t("the Discord button copies the fenced version", async () => {
  await load({ contributors: CONTRIB });
  await openBoard();
  await page.evaluate(() => { window.__copied = []; window.GM_setClipboard = t => window.__copied.push(t); });
  await page.evaluate(() => document.querySelector('[data-board="copy-discord"]').click());
  await page.waitForTimeout(200);
  const [d] = await page.evaluate(() => window.__copied);
  assert.ok(d && d.startsWith("```"), "not fenced: " + String(d).slice(0, 40));
});

await t("a key without faction access is told what is wrong, not left spinning", async () => {
  await load({ boardDenied: true, factionDenied: true });
  await openBoard();
  const txt = await boardText();
  assert.match(txt, /faction API access/, txt);
  assert.match(txt, /Incorrect ID-entity/, "Torn's own words should be shown: " + txt);
  assert.ok(await page.$('[data-board="refresh"]'), "no way to retry");
});

await t("a new week clears last week's numbers rather than relabelling them", async () => {
  await load({ contributors: CONTRIB });
  await openBoard();
  await load({ contributors: LATER });
  await openBoard();
  assert.strictEqual((await rows())[0].energy, "50,000e", "setup: the week should be populated");
  // Wind the stored baseline back a week WITHOUT touching the readings. The
  // board must roll, not carry the old deltas across under a new heading.
  await page.evaluate(() => {
    const raw = JSON.parse(localStorage.getItem("gcb_v1_board"));
    raw.week = raw.week - 1;
    localStorage.setItem("gcb_v1_board", JSON.stringify(raw));
  });
  await load({ contributors: LATER });
  await openBoard();
  const r = await rows();
  r.forEach(x => assert.strictEqual(x.energy, "0e",
    "last week's deltas survived the rollover: " + JSON.stringify(r)));
});

await t("somebody who left the faction is not on the board", async () => {
  await load({ contributors: CONTRIB });
  await openBoard();
  await load({ contributors: LATER });
  await openBoard();
  const r = await rows();
  assert.ok(!r.some(x => x.name === "gone"), "an ex-member is on the board: " + JSON.stringify(r));
  assert.strictEqual(r.length, 3);
});

await t("a faction that has trained nothing renders as a board, not as an error", async () => {
  await load({ contributors: { gymenergy: [[ME, "rcexyz", 5000000]] } });
  await openBoard();
  const r = await rows();
  assert.strictEqual(r.length, 1);
  assert.strictEqual(r[0].gain, "—", "no gains should read as a dash, not as undefined");
});

await b.close();
console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
