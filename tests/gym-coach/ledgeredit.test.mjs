// Clearing missed energy from chosen days.
//
// Needed because the ledger records {day, used, wasted} and nothing else -- it
// has never marked WHY a bar sat full, so war-stack days cannot be picked out
// after the fact. The days have to be chosen by hand, which makes this a
// destructive edit to real training history: it keeps the original figure so a
// mistaken clear can be put back.
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

const TODAY = 20000;   // dayKey is floor(ms/86400000); any stable integer works
function run(ledger, body) {
  return new Function("var RESULT;" + `
    var CAL_WINDOW = 14;
    var STORED = {};
    function storeSet(k, v) { STORED[k] = v; }
    function dayKey() { return ${TODAY}; }
    // goalPlan() and calibration() are cached, so an edit that does not bust
    // them leaves every ETA showing the figures it just changed.
    var RESETS = 0;
    function resetPlanCaches() { RESETS += 1; }
    var state = { ledger: ${JSON.stringify(ledger)} };
    ${grab("ledgerWasteDays")}
    ${grab("clearLedgerDay")}
    ${grab("restoreLedgerDay")}
    ${body}
    RESULT.ledger = state.ledger;
    RESULT.resets = RESETS;
    RESULT.stored = STORED.ledger;` + "; return RESULT;")();
}

const day = (d, used, wasted, extra) => Object.assign({ d: d, used: used, wasted: wasted }, extra || {});

let pass = 0, fail = 0;
const t = (n, f) => { try { f(); pass++; console.log("ok   " + n); } catch (e) { fail++; console.log("FAIL " + n + " :: " + e.message); } };

t("clearing a day zeroes its missed energy", () => {
  const r = run([day(TODAY - 3, 1200, 980)], `clearLedgerDay(${TODAY - 3}); RESULT = {};`);
  assert.strictEqual(r.ledger[0].wasted, 0);
});

t("the original figure is kept so the clear can be undone", () => {
  const r = run([day(TODAY - 3, 1200, 980)], `clearLedgerDay(${TODAY - 3}); RESULT = {};`);
  assert.strictEqual(r.ledger[0].w0, 980, "nothing was kept to restore from");
});

t("restoring puts back exactly what was there", () => {
  const r = run([day(TODAY - 3, 1200, 980)],
    `clearLedgerDay(${TODAY - 3}); restoreLedgerDay(${TODAY - 3}); RESULT = {};`);
  assert.strictEqual(r.ledger[0].wasted, 980);
  assert.ok(!("w0" in r.ledger[0]), "left a restore marker behind after restoring");
});

t("clearing twice does not destroy the original", () => {
  // The second clear reads wasted, which is now 0. Overwriting w0 with that
  // would quietly turn a reversible edit into a permanent one.
  const r = run([day(TODAY - 3, 1200, 980)],
    `clearLedgerDay(${TODAY - 3}); clearLedgerDay(${TODAY - 3}); restoreLedgerDay(${TODAY - 3}); RESULT = {};`);
  assert.strictEqual(r.ledger[0].wasted, 980, "the original was lost on the second clear");
});

t("spent energy is never touched", () => {
  // Only the waste is in question. Spend is what the model half of the
  // calibration is measured from, and it really did leave the bar.
  const r = run([day(TODAY - 3, 1200, 980)], `clearLedgerDay(${TODAY - 3}); RESULT = {};`);
  assert.strictEqual(r.ledger[0].used, 1200);
});

t("clearing a day that is not in the ledger changes nothing", () => {
  const r = run([day(TODAY - 3, 1200, 980)], `clearLedgerDay(${TODAY - 99}); RESULT = {};`);
  assert.strictEqual(r.ledger[0].wasted, 980);
});

t("the edit is persisted, not just held in memory", () => {
  const r = run([day(TODAY - 3, 1200, 980)], `clearLedgerDay(${TODAY - 3}); RESULT = {};`);
  assert.ok(r.stored, "nothing was written back to storage");
  assert.strictEqual(r.stored[0].wasted, 0);
});

t("an edit busts the cached plan, or the ETAs keep the old figures", () => {
  const r = run([day(TODAY - 3, 1200, 980)], `clearLedgerDay(${TODAY - 3}); RESULT = {};`);
  assert.strictEqual(r.resets, 1, "the plan cache was left holding the cleared day");
});

t("a no-op clear does not churn the cache", () => {
  const r = run([day(TODAY - 3, 1200, 980)], `clearLedgerDay(${TODAY - 99}); RESULT = {};`);
  assert.strictEqual(r.resets, 0);
});

t("only days inside the calibration window are offered", () => {
  // Older days no longer affect any ETA, so clearing them would be theatre.
  const r = run([day(TODAY - 40, 1200, 980), day(TODAY - 3, 1200, 980)],
    "RESULT = { rows: ledgerWasteDays() };");
  assert.strictEqual(r.rows.length, 1);
  assert.strictEqual(r.rows[0].d, TODAY - 3);
});

t("days with nothing missed are not offered", () => {
  const r = run([day(TODAY - 3, 1200, 0), day(TODAY - 4, 1200, 500)],
    "RESULT = { rows: ledgerWasteDays() };");
  assert.deepStrictEqual(r.rows.map(x => x.d), [TODAY - 4]);
});

t("an already-cleared day stays listed so it can be put back", () => {
  const r = run([day(TODAY - 3, 1200, 0, { w0: 980 })], "RESULT = { rows: ledgerWasteDays() };");
  assert.strictEqual(r.rows.length, 1);
  assert.strictEqual(r.rows[0].cleared, true);
  assert.strictEqual(r.rows[0].wasted, 980, "should offer the original figure to restore");
});

t("today is included -- a war does not wait for midnight", () => {
  const r = run([day(TODAY, 1200, 980)], "RESULT = { rows: ledgerWasteDays() };");
  assert.strictEqual(r.rows.length, 1);
});

t("the newest day is listed first", () => {
  const r = run([day(TODAY - 9, 1200, 980), day(TODAY - 2, 1200, 640), day(TODAY - 5, 1200, 310)],
    "RESULT = { rows: ledgerWasteDays() };");
  assert.deepStrictEqual(r.rows.map(x => x.d), [TODAY - 2, TODAY - 5, TODAY - 9]);
});

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
