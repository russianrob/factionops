import fs from "fs";
import assert from "assert";
const src = fs.readFileSync("gym-coach-beta.user.js", "utf8");
function grab(n){const i=src.indexOf("function "+n+"(");let d=0,j=src.indexOf("{",i);
  for(let k=j;k<src.length;k++){if(src[k]==="{")d++;else if(src[k]==="}"){d--;if(!d)return src.slice(i,k+1);}}}
function consts(names){return names.map(n=>{
  // several are declared as pairs on one line (var A = 0.5, B = 1.5;), so anchor
  // on the name and its "=" rather than on the start of a line
  const m=src.match(new RegExp("\\b"+n+"\\s*=\\s*([^,;]+)"));
  if(!m) throw new Error("missing const "+n);
  return "var "+n+" = "+m[1].trim()+";";}).join("\n");}

const TODAY = 20000;                 // an arbitrary UTC day index
const NOW = TODAY * 86400000 + 1000; // a moment inside it

// Gain is a flat 1000 per train so predicted output is trivially checkable:
// energy/10 trains a day * 1000 = energy * 100.
const run = (hist, ledger, opts = {}) => new Function("var RESULT;" + `
  var DAY_MS = 86400000;
  var GYMS = [{ Gym: "T", Energy: 10, Str: 1, Def: 1, Spe: 1, Dex: 1 }];
  var HIST_KEYS = ["str","def","spe","dex"];
  var GOAL_MAX_DAYS = 3650;
  var goalCache = { key: "", val: null };
  var GOAL_STEPS = [0, 5e7, 1e8, 2.5e8, 5e8];
  var GOAL_MAX_TRAINS = 4e6;
  ${consts(["CAL_WINDOW","CAL_MIN_DAYS","CAL_MODEL_LO","CAL_MODEL_HI","CAL_USAGE_LO","CAL_USAGE_HI"])}
  var state = { goalOrder: [], goalStep: 0,
    hist: ${JSON.stringify(hist)}, ledger: ${JSON.stringify(ledger)},
    gymName: "T", happyMax: 5000, perks: {}, focus: "str",
    stats: ${JSON.stringify(opts.stats || { str: 1000, def: 0, spe: 0, dex: 0 })},
    goals: ${JSON.stringify(opts.goals || {})}
  };
  function Date_now(){ return ${NOW}; }
  var Date = { now: Date_now };
  function dailyEnergy(){ return { total: ${opts.plan === undefined ? 100 : opts.plan} }; }
  function gainOne(){ return 1000; }
  ${grab("dayKey")} ${grab("calClamp")} ${grab("predictDay")} ${grab("calibration")}
  ${grab("gymFor")} ${grab("dotsFor")} ${grab("trainsTo")} ${grab("trainsPerDay")} ${grab("goalLevels")} ${grab("orderedGoalKeys")} ${grab("shareCap")} ${grab("goalSegments")} ${grab("scheduleDays")} ${grab("goalPlan")}
  RESULT = { cal: calibration(), plan: goalPlan() };` + "; return RESULT;")();

// A clean run of single-stat days: str climbs by `gain` each day on `energy`.
function series(days, gain, energy, opts = {}) {
  const hist = [], ledger = [];
  const waste = opts.waste === undefined ? 0 : opts.waste;
  let str = opts.start === undefined ? 1000000 : opts.start;
  // one reading BEFORE the window so the first in-window day has a predecessor
  hist.push({ d: TODAY - days - 1, v: [str, 0, 0, 0] });
  for (let i = days; i >= 1; i--) {
    str += gain;
    hist.push({ d: TODAY - i, v: [str, 0, 0, 0] });
    ledger.push({ d: TODAY - i, used: energy, wasted: waste });
  }
  return { hist, ledger, str };
}

// Both ETA tests hold the starting stat fixed. An earlier version let it vary
// with the history, so the ETA moved for that reason and the assertion passed
// even with the whole correction deleted.
const STATS = { str: 1000000, def: 0, spe: 0, dex: 0 };

let pass=0,fail=0;
const t=(n,f)=>{try{f();pass++;console.log("ok   "+n);}catch(e){fail++;console.log("FAIL "+n+" :: "+e.message);}};
const near=(a,b,tol=1e-6)=>assert.ok(Math.abs(a-b)<=tol, a+" !~ "+b);

t("a model that predicts exactly what happened scores 1.0", () => {
  // 100e/day -> 10 trains -> 10000 predicted; make actual match
  const s = series(14, 10000, 100);
  const r = run(s.hist, s.ledger);
  assert.ok(r.cal.ok, r.cal.reason);
  near(r.cal.model, 1);
  near(r.cal.usage, 1);
});

t("an optimistic model is scaled down by what actually happened", () => {
  const s = series(14, 9000, 100);        // predicted 10000, got 9000
  const r = run(s.hist, s.ledger);
  assert.ok(r.cal.ok);
  near(r.cal.model, 0.9);
});

t("energy you let evaporate lands in the usage factor, not the model", () => {
  // 50e reached the gym, 50e evaporated at a full bar -> usage 0.5
  const s = series(14, 5000, 50, { waste: 50 });
  const r = run(s.hist, s.ledger, { plan: 100 });
  assert.ok(r.cal.ok);
  near(r.cal.model, 1);                   // the maths was never wrong
  near(r.cal.usage, 0.5);                 // the spending was
});

t("usage measures energy you HAD, not the size of your plan", () => {
  // Same behaviour, two very different plans. Measuring against the plan would
  // make the bigger plan look like slacking, and would cancel out the benefit
  // of adding a source in the first place.
  const s = series(14, 10000, 100, { waste: 10 });
  const small = run(s.hist, s.ledger, { plan: 100 });
  const big   = run(s.hist, s.ledger, { plan: 400 });
  near(small.cal.usage, big.cal.usage);
  near(small.cal.usage, 100 / 110);
});

t("a bigger plan produces a nearer goal, not an identical one", () => {
  const goals = { str: 2000000 };
  const s = series(14, 10000, 100, { waste: 10 });
  const small = run(s.hist, s.ledger, { plan: 100, goals, stats: STATS });
  const big   = run(s.hist, s.ledger, { plan: 400, goals, stats: STATS });
  assert.ok(big.plan.rows[0].days < small.plan.rows[0].days,
    "quadrupling the daily energy must shorten the ETA");
});

t("missed energy makes the goal ETA longer, which is the whole point", () => {
  const goals = { str: 2000000 };
  const full = series(14, 10000, 100);                 // nothing evaporates
  const half = series(14, 5000, 50, { waste: 50 });     // half the bar evaporates
  const a = run(full.hist, full.ledger, { plan: 100, goals, stats: STATS });
  const b = run(half.hist, half.ledger, { plan: 100, goals, stats: STATS });
  near(a.cal.usage, 1); near(b.cal.usage, 0.5);
  near(a.cal.model, 1); near(b.cal.model, 1);   // only the SPENDING differs
  const da = a.plan.rows[0].days, db = b.plan.rows[0].days;
  assert.ok(db > da, "half-spender ETA " + db + " should exceed full-spender " + da);
});

t("an optimistic gain model also stretches the ETA, separately from spending", () => {
  const goals = { str: 2000000 };
  const good = series(14, 10000, 100);   // model 1.0
  const poor = series(14, 8000, 100);    // model 0.8, same energy spent
  const a = run(good.hist, good.ledger, { plan: 100, goals, stats: STATS });
  const b = run(poor.hist, poor.ledger, { plan: 100, goals, stats: STATS });
  near(a.cal.usage, 1); near(b.cal.usage, 1);   // only the MODEL differs
  near(b.cal.model, 0.8);
  assert.ok(b.plan.rows[0].days > a.plan.rows[0].days,
    "a model measured 20% optimistic must push the ETA out");
});

t("a partly-measured history stays out of the way instead of guessing", () => {
  const s = series(4, 10000, 100);        // only 4 usable days, floor is 7
  const r = run(s.hist, s.ledger);
  assert.strictEqual(r.cal.ok, false);
  near(r.cal.model, 1);
  near(r.cal.usage, 1);
  assert.match(r.cal.reason, /4 of 7/);
});

t("days where two stats moved are skipped: the energy split is unrecorded", () => {
  const s = series(14, 10000, 100);
  // day TODAY-3 also gains def -> that day is unusable
  const i = s.hist.findIndex(h => h.d === TODAY - 3);
  for (let j = i; j < s.hist.length; j++) s.hist[j].v[1] += 500;
  const r = run(s.hist, s.ledger);
  assert.strictEqual(r.cal.days, 13);
  assert.strictEqual(r.cal.looked, 14);
});

t("a gap in the history is skipped rather than charged to one day", () => {
  const s = series(14, 10000, 100);
  s.hist = s.hist.filter(h => h.d !== TODAY - 5);  // drops days -5 and -4
  const r = run(s.hist, s.ledger);
  assert.strictEqual(r.cal.days, 12);
});

t("today is excluded, because a partial day is not a measurement", () => {
  const s = series(14, 10000, 100);
  // today looks wildly productive so far; if it counted, both numbers move
  s.hist.push({ d: TODAY, v: [s.str + 100000, 0, 0, 0] });
  s.ledger.push({ d: TODAY, used: 100, wasted: 0 });
  const r = run(s.hist, s.ledger);
  assert.strictEqual(r.cal.days, 14);                // not 15
  near(r.cal.model, 1);                              // and today does not skew it
});

t("a wild ratio is clamped, because that is a data fault not a training result", () => {
  const hot  = series(14, 100000, 100);   // 10x the prediction
  const cold = series(14, 100, 100);      // 1/100th
  near(run(hot.hist, hot.ledger).cal.model, 1.5);
  near(run(cold.hist, cold.ledger).cal.model, 0.5);
});

t("days the script never ran are unmeasured, not zero-spend days", () => {
  const s = series(14, 10000, 100, { waste: 10 });
  s.ledger = s.ledger.filter(e => e.d !== TODAY - 6);  // no bucket that day
  const r = run(s.hist, s.ledger, { plan: 100 });
  assert.strictEqual(r.cal.uDays, 13);
  near(r.cal.usage, 100 / 110);                        // unchanged by the gap
});

t("a day you banked a full bar and trained none of it counts against you", () => {
  const s = series(14, 10000, 100);
  const e = s.ledger.find(x => x.d === TODAY - 6);
  e.used = 0; e.wasted = 100;                          // bar sat full all day
  const r = run(s.hist, s.ledger, { plan: 100 });
  near(r.cal.usage, 1300 / 1400);
});

t("calClamp refuses nonsense rather than propagating it", () => {
  const c = new Function("return " + grab("calClamp"))();
  assert.strictEqual(c(NaN, 0.5, 1.5), 1);
  assert.strictEqual(c(Infinity, 0.5, 1.5), 1);   // not finite = not a measurement
  assert.strictEqual(c(0, 0.5, 1.5), 1);
  assert.strictEqual(c(-3, 0.5, 1.5), 1);
  assert.strictEqual(c(0.8, 0.5, 1.5), 0.8);
});

t("predictDay starts from the stat you HAD, not the one you have now", () => {
  const p = new Function("var GYMS=[{Gym:'T',Energy:10,Str:1,Def:1,Spe:1,Dex:1}];" +
    "var state={happyMax:5000,perks:{}};" +
    "function gainOne(stat){ return 1e9 / stat; }" +   // gains shrink as stat grows
    "return " + grab("predictDay"))();
  const low  = p(1e6, 100, "str", "T");
  const high = p(1e8, 100, "str", "T");
  assert.ok(low > high, "a smaller starting stat must predict a bigger gain");
});

t("predictDay buys whole trains only: 105e at 10e each is ten, not eleven", () => {
  const p = new Function("var GYMS=[{Gym:'T',Energy:10,Str:1,Def:1,Spe:1,Dex:1}];" +
    "var state={happyMax:5000,perks:{}};" +
    "function gainOne(){ return 1000; }" +
    "return " + grab("predictDay"))();
  assert.strictEqual(p(1e6, 105, "str", "T"), 10000);
  assert.strictEqual(p(1e6,   9, "str", "T"), 0);
});

t("the daily-spend figure comes from the days actually recorded", () => {
  const s = series(14, 10000, 100);
  s.ledger = s.ledger.filter(e => e.d !== TODAY - 6 && e.d !== TODAY - 7);
  const r = run(s.hist, s.ledger, { plan: 100 });
  assert.strictEqual(r.cal.uDays, 12);
  near(r.cal.used / r.cal.uDays, 100);
  assert.strictEqual(r.cal.wasted, 0);
});

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
