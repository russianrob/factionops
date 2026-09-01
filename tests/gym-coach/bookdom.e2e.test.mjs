// Book detection, end to end.
//
// bookdom.test.mjs proves the parse. This proves the WIRING: that the strip is
// actually read during a paint, that a detected book reaches storage, and that
// the three-way answer is respected -- a page WITHOUT the strip must never
// clear a live countdown.
import fs from "fs";
import assert from "assert";
const { chromium } = await import("/root/.hermes/hermes-agent/node_modules/playwright-core/index.mjs");
const html = fs.readFileSync("harness/index.html", "utf8");
const script = fs.readFileSync("harness/gym-coach-beta.user.js", "utf8");
const b = await chromium.launch({ args: ["--no-sandbox"] });
const page = await b.newPage({ viewport: { width: 393, height: 1400 } });
const errors = [];
page.on("pageerror", e => errors.push(String(e.message)));
await page.route("**/*", r => {
  const u = r.request().url();
  if (u.includes("gym-coach-beta.user.js")) return r.fulfill({ contentType: "application/javascript", body: script });
  if (/gym\.php/.test(u)) return r.fulfill({ contentType: "text/html", body: html });
  return r.fulfill({ status: 204, body: "" });
});

// Torn's real markup, hashes and all. Prefix-matched by production, so the
// exact hashes here are deliberately arbitrary -- if the code ever pins one,
// this fixture stops matching and the test says so.
const STRIP = (labels) => `
  <div id="sidebar" class="sidebar___V9DPj mobile___wDUuc">
    <div class="sidebar-block___CVVYK mobile___xGs_c">
      <div class="content___bZYbx"><div class="user-information-mobile___I1ebJ">
        <div class="swiperWrapper____QQNn">
          <ul class="status-icons___ZZtop mobile___YGGsN big___IeUkB">
            ${labels.map((l, i) => `<li class="icon${60 + i}___xxYY"><a href="#" aria-label="${l}"></a></li>`).join("")}
          </ul>
        </div>
      </div></div>
    </div>
  </div>`;

const READING = "Reading Book: Time Is In The Mind — Increase speed by 5% up to 10m after 31 days";

async function load(opts) {
  errors.length = 0;
  const cfg = Object.assign({ energy: 100, energyMax: 150, gym: 24, playerId: 2598755,
    stats: { str: 614000000, def: 12000000, spe: 9000000, dex: 8000000 },
    mem: { gcb_v1_verdictFold: 1 } }, opts.cfg || {});
  await page.goto("https://www.torn.com/gym.php", { waitUntil: "domcontentloaded" });
  if (opts.clear !== false) await page.evaluate(() => localStorage.clear());
  if (opts.seed) await page.evaluate(s => { for (const k in s) localStorage.setItem(k, s[k]); }, opts.seed);
  await page.goto("https://www.torn.com/gym.php?cfg=" + encodeURIComponent(JSON.stringify(cfg)),
                  { waitUntil: "domcontentloaded" });
  if (opts.strip !== null) await page.evaluate(h => document.body.insertAdjacentHTML("beforeend", h), STRIP(opts.strip || []));
  // The panel reads the strip on paint, so make it paint.
  await page.waitForTimeout(1500);
  await page.evaluate(() => { const p = document.getElementById("gcb-pill"); if (p) p.click(); });
  await page.waitForTimeout(1200);
}
const books = () => page.evaluate(() => {
  try { return JSON.parse(localStorage.getItem("gcb_v1_books") || "null"); } catch (e) { return null; }
});
const auto = () => page.evaluate(() => {
  try { return JSON.parse(localStorage.getItem("gcb_v1_booksAuto") || "null"); } catch (e) { return null; }
});

let pass = 0, fail = 0;
const t = async (n, f) => {
  try { await f(); assert.deepStrictEqual(errors, [], "page errors: " + errors.join(" | ")); pass++; console.log("ok   " + n); }
  catch (e) { fail++; console.log("FAIL " + n + " :: " + e.message); }
};

await page.goto("https://www.torn.com/gym.php", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1200);

await t("a book on the strip is picked up without anyone tapping anything", async () => {
  await load({ strip: ["Drug cooldown: 2 hours", READING, "Donator: yes"] });
  const bk = await books();
  assert.ok(bk, "nothing was stored at all");
  assert.ok(bk.spe > 0, "Time Is In The Mind is the SPEED book: " + JSON.stringify(bk));
  assert.strictEqual(bk.str, 0);
  assert.deepStrictEqual((await auto()).spe, true, "it should be marked as this device's own guess");
});

await t("a strip with no book leaves nothing set", async () => {
  await load({ strip: ["Drug cooldown: 2 hours", "Donator: yes"] });
  const bk = await books();
  assert.ok(!bk || !bk.spe, "a book was invented from a strip that had none: " + JSON.stringify(bk));
});

await t("a page with NO strip never clears a live countdown", async () => {
  // The distinction the whole design turns on. Plenty of Torn pages have no
  // sidebar, and treating that as "no book" would clear the countdown on every
  // one of them.
  await load({
    strip: null,
    seed: { gcb_v1_books: JSON.stringify({ str: 0, def: 0, spe: Date.now() - 86400000, dex: 0 }),
            gcb_v1_booksAuto: JSON.stringify({ spe: true }) }
  });
  const bk = await books();
  assert.ok(bk.spe > 0, "a page without the strip cleared the stored book");
});

await t("but a strip that IS there and has no book clears what this device guessed", async () => {
  await load({
    strip: ["Donator: yes"],
    seed: { gcb_v1_books: JSON.stringify({ str: 0, def: 0, spe: Date.now() - 86400000, dex: 0 }),
            gcb_v1_booksAuto: JSON.stringify({ spe: true }) }
  });
  assert.strictEqual((await books()).spe, 0, "the finished book was left counting down");
});

await t("and never clears a date you set by hand", async () => {
  // No booksAuto entry: this is a tapped date, and the detector does not own it.
  await load({
    strip: ["Donator: yes"],
    seed: { gcb_v1_books: JSON.stringify({ str: 0, def: 0, spe: Date.now() - 86400000, dex: 0 }) }
  });
  assert.ok((await books()).spe > 0, "a hand-set date was thrown away by the detector");
});

await t("a date already on record is not overwritten by detection", async () => {
  // Detection can only ever say "today". A date already stored is either one
  // you tapped in or an earlier sighting, and both are better floors than now.
  const WAS = Date.now() - 10 * 86400000;
  await load({
    strip: [READING],
    seed: { gcb_v1_books: JSON.stringify({ str: 0, def: 0, spe: WAS, dex: 0 }),
            gcb_v1_booksAuto: JSON.stringify({ spe: true }) }
  });
  const bk = await books();
  assert.strictEqual(bk.spe, WAS, "detection moved the start date forward, shortening the countdown");
});

await t("a hand-set date survives even when the detector is tracking that stat", async () => {
  // booksAuto carries the key with a FALSY value -- the state after you tap a
  // stat the detector had previously set. The clearing loop walks that object,
  // so the guard has to be on the value, not on the key being absent.
  const WAS = Date.now() - 86400000;
  await load({
    strip: ["Donator: yes"],
    seed: { gcb_v1_books: JSON.stringify({ str: 0, def: 0, spe: WAS, dex: 0 }),
            gcb_v1_booksAuto: JSON.stringify({ spe: false }) }
  });
  assert.strictEqual((await books()).spe, WAS, "a date the detector does not own was cleared anyway");
});

await t("tapping on a page without the strip takes the date back from the detector", async () => {
  // Otherwise the next strip without the book would clear what you just set.
  //
  // Deliberately on a page with NO strip. Where the strip DOES show the book,
  // the page wins and the detector re-claims it immediately -- which is right:
  // Torn saying you are reading it beats a tap saying you are not.
  await load({
    strip: null,
    seed: { gcb_v1_books: JSON.stringify({ str: 0, def: 0, spe: Date.now() - 86400000, dex: 0 }),
            gcb_v1_booksAuto: JSON.stringify({ spe: true }) }
  });
  assert.strictEqual((await auto()).spe, true, "setup: it should start as the detector's");
  await page.evaluate(() => document.querySelector('[data-tab="plan"]').click());
  await page.waitForTimeout(500);
  await page.evaluate(() => {
    const b = document.querySelector('[data-book="spe"]');
    if (!b) throw new Error("no book button on the Plan tab");
    b.click();
  });
  await page.waitForTimeout(600);
  assert.strictEqual((await auto()).spe, false, "the detector still owns a date you just set by hand");
});

await t("a non-stat book on the strip does not credit a stat", async () => {
  await load({ strip: ["Reading Book: Get Hard Or Go Home — Increase gym gains by 20%"] });
  const bk = await books();
  assert.ok(!bk || (!bk.str && !bk.def && !bk.spe && !bk.dex),
    "a gym-gains book was booked as a stat award: " + JSON.stringify(bk));
});

await b.close();
console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
