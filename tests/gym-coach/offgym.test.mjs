// Energy that leaves the bar somewhere other than the gym.
//
// This is a gym coach, so an attack is not "spent" -- it is energy that never
// reached the gym, which from here is the same kind of loss as a bar sitting
// full. Torn charges 25e an attack and grants no stats for it, and the script
// polls the bar on EVERY Torn page (cdTimer, once a second), so the page the
// drop happened on says where the energy went. No logs, no API.
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

// prevE -> nowE over `secs`, observed while on (or off) the gym page.
function observe({ prevE, nowE, secs = 60, onGym, max = 150, rate = 120 }) {
  return new Function("var RESULT;" + `
    var DAY_MS = 86400000, LEDGER_DAYS = 90, CAL_WINDOW = 14, STACK_PEAK_OVER = 300;
    var GAIN_WAIT_MS = 30000;
    ${/var ATTACK_ENERGY = \d+;/.exec(src)[0]}   // from the source, never a copy
    ${/var GAP_MS = \d+;/.exec(src)[0]}          // ditto: defining it here would
                                                  // shadow production and let any
                                                  // mutation of it survive
    var saved = {}, ledgerDirty = 0, pendingTrain = null;
    function dayKey(ms){ return Math.floor(ms / DAY_MS); }
    function storeSet(k, v){ saved[k] = v; }
    function energyRate(){ return ${rate}; }
    function onGymPage(){ return ${!!onGym}; }
    function refresh(){ return { then: function(){ return this; } }; }
    function finaliseTrain(){}
    function fmt(n){ return String(n); }
    var state = { energyMax: ${max}, energy: ${nowE}, energyKnown: true, ledger: [],
                  stats: { str:0, def:0, spe:0, dex:0 }, warStack: false,
                  // The gap path needs these; the gym log is assumed readable
                  // so these fixtures exercise reconstruction, not the decline.
                  logReadable: true, trainLog: { events: [] }, attackEvents: [],
                  lastSeen: { e: ${prevE}, t: Date.now() - ${secs} * 1000 } };
    ${grab("timeToFull")} ${grab("ledgerDelta")} ${grab("ledgerBucket")} ${grab("dayLooksStacked")}
    ${grab("simulateWaste")} ${grab("gapWaste")} ${grab("ledgerObserve")}
    ledgerObserve(true);
    var b = state.ledger[state.ledger.length - 1] || {};
    RESULT = { used: Math.round(b.used || 0), wasted: Math.round(b.wasted || 0),
               off: Math.round(b.off || 0), pending: !!pendingTrain };` + "; return RESULT;")();
}

let pass = 0, fail = 0;
const t = (n, f) => { try { f(); pass++; console.log("ok   " + n); } catch (e) { fail++; console.log("FAIL " + n + " :: " + e.message); } };

t("training on the gym page is spent, as before", () => {
  const r = observe({ prevE: 150, nowE: 0, secs: 60, onGym: true });
  assert.strictEqual(r.used, 150, "got " + JSON.stringify(r));
  assert.strictEqual(r.off, 0);
});

// Reported: "Spent attacking 6e" on a day with no attacks. A Torn attack costs
// exactly 25e, so 6 cannot be one -- it is API/DOM skew, which used to vanish
// among real training and only became visible once off-gym spend had its own
// line. Counting whole attacks discards the remainder as well as the noise.

t("a drop too small to be an attack is not one", () => {
  const r = observe({ prevE: 141, nowE: 135, secs: 60, onGym: false });
  assert.strictEqual(r.off, 0, "booked 6e of skew as attacking: " + JSON.stringify(r));
});

t("one attack is exactly one attack", () => {
  const r = observe({ prevE: 150, nowE: 125, secs: 60, onGym: false });
  assert.strictEqual(r.off, 25, JSON.stringify(r));
});

t("skew riding along with a real attack is trimmed off", () => {
  // 25 for the attack plus 6 of drift reads as one attack, not 31e.
  const r = observe({ prevE: 150, nowE: 119, secs: 60, onGym: false });
  assert.strictEqual(r.off, 25, JSON.stringify(r));
});

t("several attacks between polls all count", () => {
  const r = observe({ prevE: 150, nowE: 75, secs: 300, onGym: false });
  assert.strictEqual(r.off, 75, JSON.stringify(r));
});

t("an attack away from the gym is not counted as spent", () => {
  // One attack: 25e, no stat gain, on loader.php.
  const r = observe({ prevE: 150, nowE: 125, secs: 60, onGym: false });
  assert.strictEqual(r.used, 0, "booked an attack as gym training: " + JSON.stringify(r));
});

t("it lands in its own column, not silently dropped", () => {
  // Losing it entirely would make the bar unaccountable -- 25e left and
  // nothing says where it went.
  const r = observe({ prevE: 150, nowE: 125, secs: 60, onGym: false });
  assert.strictEqual(r.off, 25, "got " + JSON.stringify(r));
});

t("an attack does not open a training session", () => {
  // finaliseTrain's skew guard is `spent < 25`, and a Torn attack costs
  // exactly 25 with no stat gain -- so it sailed past and was written into the
  // train log as a session. Never start one off the gym page.
  const r = observe({ prevE: 150, nowE: 125, secs: 60, onGym: false });
  assert.strictEqual(r.pending, false, "an attack opened a training session");
});

t("training on the gym page still opens one", () => {
  const r = observe({ prevE: 150, nowE: 0, secs: 60, onGym: true });
  assert.strictEqual(r.pending, true, "real training stopped being logged");
});

t("a chain of attacks accumulates", () => {
  const r = observe({ prevE: 150, nowE: 25, secs: 300, onGym: false });
  assert.strictEqual(r.off, 125, JSON.stringify(r));
  assert.strictEqual(r.used, 0);
});

t("regen off the gym page is still not a loss", () => {
  // A rising bar anywhere spends nothing. This is the 0.9.18 phantom, checked
  // on the off-gym path too.
  const r = observe({ prevE: 20, nowE: 40, secs: 40 * 60, onGym: false });
  assert.strictEqual(r.used, 0, "got " + JSON.stringify(r));
  assert.strictEqual(r.off, 0, "got " + JSON.stringify(r));
});

t("a full bar off the gym page still books cap waste", () => {
  // Waste is about the bar being full, which has nothing to do with what page
  // you are reading.
  const r = observe({ prevE: 150, nowE: 150, secs: 2 * 3600, onGym: false });
  assert.strictEqual(r.wasted, 60, "got " + JSON.stringify(r));
  assert.strictEqual(r.off, 0);
});

// ---- it has to reach the usage figure --------------------------------------
// Recording a column nothing reads is the same as not recording it.
function usage(days) {
  return new Function("var RESULT;" + `
    var CAL_WINDOW = 14, CAL_MIN_DAYS = 7, DAY_MS = 86400000;
    var CAL_MODEL_LO = 0.5, CAL_MODEL_HI = 1.5;
    var CAL_USAGE_LO = 0.3, CAL_USAGE_HI = 1.5;
    var HIST_KEYS = ["str","def","spe","dex"];
    function dayKey(ms){ return Math.floor(ms / DAY_MS); }
    function predictDay(){ return 1; }
    var today = dayKey(Date.now());
    var rows = ${JSON.stringify(days)};
    var ledger = [], hist = [];
    // One snapshot per day, strictly rising, so each day's delta is a single
    // stat moving -- which is what calibration counts as a measurable day.
    for (var i = 0; i <= rows.length; i++) {
      hist.push({ d: today - 1 - rows.length + i, v: [100 + i * 10, 0, 0, 0] });
    }
    rows.forEach(function (row, i) {
      ledger.push({ d: today - rows.length + i, used: row[0], wasted: row[1], off: row[2] });
    });
    var state = { ledger: ledger, hist: hist, gymName: "T", stats: {}, perks: {} };
    ${grab("calClamp")} ${grab("calibration")}
    var c = calibration();
    RESULT = { usage: c.usage, off: c.off, used: c.used, wasted: c.wasted };`
    + "; return RESULT;")();
}

t("attacking drags the usage figure down like a full bar does", () => {
  const clean  = usage(Array.from({ length: 10 }, () => [1000, 0, 0]));
  const warred = usage(Array.from({ length: 10 }, () => [1000, 0, 1000]));
  assert.ok(warred.usage < clean.usage,
    "attacking left usage untouched: " + warred.usage + " against " + clean.usage);
  assert.strictEqual(warred.off, 10000, "off-gym spend never reached calibration");
});

t("half your energy going to attacks reads as half your bar used", () => {
  const r = usage(Array.from({ length: 10 }, () => [1000, 0, 1000]));
  assert.ok(Math.abs(r.usage - 0.5) < 0.01, "got " + r.usage);
});

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
