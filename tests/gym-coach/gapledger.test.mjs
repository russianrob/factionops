// The gap reconstruction as the LEDGER sees it.
//
// gapwaste.test.mjs proves the arithmetic; this proves ledgerObserve actually
// uses it. Without this, the whole gap branch could be deleted and every other
// suite would stay green.
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
const H = 3600000;

// One observation after a gap of `hours`, with the bar full at both ends.
function observe({ hours, trainEvents = [], atkEvents = [], logReadable = true,
                   warStack = false, max = 150, rate = 120 }) {
  const now = Date.now();
  return new Function("var RESULT;" + `
    var DAY_MS = 86400000, LEDGER_DAYS = 90, STACK_PEAK_OVER = 300, GAIN_WAIT_MS = 30000;
    ${/var ATTACK_ENERGY = \d+;/.exec(src)[0]}
    ${/var GAP_MS = \d+;/.exec(src)[0]}
    var saved = {}, ledgerDirty = 0, ledgerFlushAt = 0, pendingTrain = null;
    function dayKey(ms){ return Math.floor(ms / DAY_MS); }
    function storeSet(k, v){ saved[k] = v; }
    function energyRate(){ return ${rate}; }
    function onGymPage(){ return false; }
    function refresh(){ return { then: function(){ return this; } }; }
    function finaliseTrain(){}
    function fmt(n){ return String(n); }
    var state = {
      energyMax: ${max}, energy: ${max}, energyKnown: true, ledger: [],
      stats: { str:0, def:0, spe:0, dex:0 }, warStack: ${warStack},
      logReadable: ${logReadable},
      trainLog: { events: ${JSON.stringify(trainEvents.map(e => ({ t: now - e.agoH * H, delta: e.delta })))} },
      attackEvents: ${JSON.stringify(atkEvents.map(e => ({ t: now - e.agoH * H, delta: e.delta })))},
      lastSeen: { e: ${max}, t: ${now} - ${hours} * ${H}, capSince: ${now} - ${hours} * ${H}, fullAt: 0 }
    };
    ${grab("timeToFull")} ${grab("ledgerDelta")} ${grab("ledgerBucket")} ${grab("dayLooksStacked")}
    ${grab("simulateWaste")} ${grab("gapWaste")} ${grab("ledgerObserve")}
    ledgerObserve(true);
    var b = state.ledger[state.ledger.length - 1] || {};
    RESULT = { wasted: Math.round(b.wasted || 0), partial: !!b.partial };
  ` + "return RESULT;")();
}
let pass = 0, fail = 0;
const t = (n, f) => { try { f(); pass++; console.log("ok   " + n); } catch (e) { fail++; console.log("FAIL " + n + " :: " + e.message); } };

t("a gap with training in it books the reconstructed figure, not the guess", () => {
  // Six hours, bar full at both ends. The guess bills all six (180e). The
  // other device emptied the bar an hour in, so only that hour was at the cap.
  const r = observe({ hours: 6, trainEvents: [{ agoH: 5, delta: -150 }] });
  assert.strictEqual(r.wasted, 30, "got " + r.wasted + " -- 180 means the gap path was skipped");
  assert.strictEqual(r.partial, false);
});

t("a genuinely idle gap is still billed in full", () => {
  assert.strictEqual(observe({ hours: 6 }).wasted, 180);
});

t("attacks in the gap are accounted for too", () => {
  // Two hours at the cap is 60e. One 25e hit half an hour in buys back exactly
  // its own 25e of headroom, so 35e still bleeds. (agoH is measured back from
  // now, so 1.5 is half an hour INTO a two-hour window.)
  const r = observe({ hours: 2, atkEvents: [{ agoH: 1.5, delta: -25 }] });
  assert.strictEqual(r.wasted, 35);
});

t("a hit late in the gap cannot undo the bleed that already happened", () => {
  // Same hit, ninety minutes later: the bar had already been at the cap for
  // that whole time, so it cost 45e and the hit only stops the clock.
  const r = observe({ hours: 2, atkEvents: [{ agoH: 0.5, delta: -25 }] });
  assert.strictEqual(r.wasted, 45);
});

t("a Limited key books NOTHING for the gap, and flags the day partial", () => {
  const r = observe({ hours: 6, logReadable: false });
  assert.strictEqual(r.wasted, 0, "a key that cannot see training must not guess");
  assert.strictEqual(r.partial, true, "the day has to admit it is incomplete");
});

t("a reconstructed day is not flagged partial", () => {
  assert.strictEqual(observe({ hours: 6 }).partial, false);
});

t("a short gap is left to the ordinary per-second accounting", () => {
  // Under the threshold the script WAS watching, and that path is already
  // correct. Sending it through the reconstruction would be a regression.
  const r = observe({ hours: 0.01 });   // 36 seconds
  assert.strictEqual(r.wasted, 0, "36s at the cap is under a whole point");
  assert.strictEqual(r.partial, false);
});

t("a Limited key still tracks waste for time it DID watch", () => {
  // The decline is only about gaps. Watching the bar needs no log at all, so
  // a Limited key must keep its ordinary per-second accounting -- otherwise
  // the feature dies completely for most users rather than degrading.
  const r = observe({ hours: 0.03, logReadable: false });   // 108s, under the threshold
  assert.strictEqual(r.wasted, 1, "observed time was declined, not counted");
  assert.strictEqual(r.partial, false, "nothing was missing -- the script was watching");
});

t("a war stack across a gap is left alone on either key", () => {
  assert.strictEqual(observe({ hours: 6, warStack: true }).wasted, 0);
  const lim = observe({ hours: 6, warStack: true, logReadable: false });
  assert.strictEqual(lim.wasted, 0);
  assert.strictEqual(lim.partial, false, "a stack is answerable without the log, so nothing is missing");
});

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
