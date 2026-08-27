// "Spent today" from Torn's own gym logs instead of inferred from the bar.
//
// Torn writes a log line per training session with the exact energy, stamped to
// the second (a refill at 19:34:33 and the train at 19:34:37 came back as
// separate entries). That is the truth; the bar is only ever an inference, and
// it cannot see a session the script was not running for.
import fs from "fs";
import assert from "assert";
const src = fs.readFileSync("gym-coach-beta.user.js", "utf8");
function grab(n) {
  const i = src.indexOf("function " + n + "(");
  assert.ok(i !== -1, "function " + n + "() is not defined in the script");
  let d = 0;
  for (let k = src.indexOf("{", i); k < src.length; k++) {
    if (src[k] === "{") d++;
    else if (src[k] === "}") { d--; if (!d) return src.slice(i, k + 1); }
  }
}
const DAY = 86400000;

const byDay = responses => new Function("var RESULT;" + `
  var DAY_MS = ${DAY};
  ${grab("dayKey")} ${grab("trainLogByDay")}
  RESULT = trainLogByDay(${JSON.stringify(responses)});` + "; return RESULT;")();

// One log entry in Torn's shape, verbatim from the probe.
const entry = (ts, used, stat) => ({
  log: 5300, title: "Gym train " + (stat || "strength"), timestamp: ts, category: "Gym",
  data: { trains: 15, energy_used: used, happy_used: 77, gym: 24 },
  params: { color: "green" },
});
const resp = (...es) => ({ log: Object.fromEntries(es.map((e, i) => ["h" + i, e])) });

// 19:34:37 EDT on 2026-08-26 = the session in the screenshot.
const T = 1787787277;
const dayOf = ts => Math.floor((ts * 1000) / DAY);

let pass = 0, fail = 0;
const t = (n, f) => { try { f(); pass++; console.log("ok   " + n); } catch (e) { fail++; console.log("FAIL " + n + " :: " + e.message); } };

t("a session's energy lands on its own day", () => {
  const r = byDay([resp(entry(T, 150))]);
  assert.strictEqual(r[dayOf(T)], 150, JSON.stringify(r));
});

t("sessions in the same day add up", () => {
  const r = byDay([resp(entry(T, 150), entry(T - 3600, 280), entry(T - 7200, 300))]);
  assert.strictEqual(r[dayOf(T)], 730);
});

t("all four stat logs are merged", () => {
  // Torn splits training by stat: 5300/5301/5302/5303.
  const r = byDay([resp(entry(T, 150, "strength")), resp(entry(T, 100, "speed")),
                   resp(entry(T, 50, "defense")), resp(entry(T, 25, "dexterity"))]);
  assert.strictEqual(r[dayOf(T)], 325);
});

t("days are split on the UTC boundary, like the ledger", () => {
  // dayKey is floor(ms/86400000), so the split is UTC midnight -- 8pm EDT.
  // The 19:34 EDT session belongs to the PREVIOUS day, which is exactly the
  // boundary that made "Spent today" look wrong.
  const justBefore = T;                     // 23:34 UTC
  const justAfter = T + 26 * 60;            // 00:00 UTC next day
  const r = byDay([resp(entry(justBefore, 150), entry(justAfter, 40))]);
  assert.strictEqual(r[dayOf(justBefore)], 150);
  assert.strictEqual(r[dayOf(justAfter)], 40);
  assert.notStrictEqual(dayOf(justBefore), dayOf(justAfter), "fixture did not straddle midnight");
});

t("an entry with no energy figure is skipped, not counted as zero-cost", () => {
  const bad = entry(T, 150); delete bad.data.energy_used;
  // Both orders. With the bad entry FIRST the damage is invisible: Number(
  // undefined) is NaN, and the running total's own `|| 0` resets it, because
  // NaN is falsy. Last is where an ungated entry actually shows.
  assert.strictEqual(byDay([resp(bad, entry(T, 90))])[dayOf(T)], 90, "bad entry first");
  assert.strictEqual(byDay([resp(entry(T, 90), bad)])[dayOf(T)], 90, "bad entry last");
});

t("malformed entries cannot take the whole figure down", () => {
  const r = byDay([resp(entry(T, 120)), { log: null }, {}, null,
                   { log: { x: { timestamp: T } } }]);
  assert.strictEqual(r[dayOf(T)], 120);
});

t("nothing logged is an empty map, not a zero for today", () => {
  // The difference matters: an empty map means "no answer yet" and the caller
  // falls back to the bar, while a 0 would claim you trained nothing.
  const r = byDay([]);
  assert.deepStrictEqual(r, {});
});

// ---- the live figure -------------------------------------------------------
// The Now tab is live, so a number that only moved when an API call landed
// would feel broken right after you train. Log is the truth, bar is the
// immediacy: show the log total plus whatever the bar has seen leave since,
// and snap back to the log on the next fetch.
const today = () => Math.floor(Date.now() / DAY);
const trained = tl => new Function("var RESULT;" + `
  var DAY_MS = ${DAY};
  var state = { trainLog: ${JSON.stringify(tl)} };
  ${grab("dayKey")} ${grab("trainedToday")}
  RESULT = trainedToday();` + "; return RESULT;")();

t("with no log yet it says so, so the caller can fall back to the bar", () => {
  // null, not 0 -- claiming you trained nothing is a different statement from
  // having no answer yet.
  assert.strictEqual(trained(null), null);
});

t("it reports what Torn recorded for today", () => {
  const r = trained({ byDay: { [today()]: 1450 }, since: 0 });
  assert.strictEqual(r, 1450);
});

t("training since the last fetch shows immediately", () => {
  const r = trained({ byDay: { [today()]: 1450 }, since: 150 });
  assert.strictEqual(r, 1600, "the bar's 150e never reached the figure");
});

t("a day Torn recorded nothing for reads zero, not blank", () => {
  // Once a log HAS been fetched, the absence of an entry is a real answer.
  const r = trained({ byDay: { [today() - 3]: 900 }, since: 0 });
  assert.strictEqual(r, 0);
});

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
