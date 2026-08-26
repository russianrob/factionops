import fs from "fs";
import assert from "assert";
const src = fs.readFileSync("gym-coach-beta.user.js", "utf8");
function grab(n){const i=src.indexOf("function "+n+"(");let d=0,j=src.indexOf("{",i);
  for(let k=j;k<src.length;k++){if(src[k]==="{")d++;else if(src[k]==="}"){d--;if(!d)return src.slice(i,k+1);}}}

const parseGoal = new Function("return " + grab("parseGoal"))();
const fmtDays = new Function("return " + grab("fmtDays"))();

// A plan runtime with a simple linear gain so the arithmetic is checkable.
const plan = (stats, goals, perDayGain) => new Function("var RESULT;" + `
  var HIST_KEYS = ["str","def","spe","dex"];
  var GYMS = [{ Gym: "T", Energy: 10, Str: 1, Def: 1, Spe: 1, Dex: 1 }];
  var DAY_MS = 86400000;
  var GOAL_MAX_DAYS = 3650;
  var goalCache = { key: "", val: null };
  var GOAL_STEPS = [0, 5e7, 1e8, 2.5e8, 5e8];
  var GOAL_MAX_TRAINS = 4e6;
  var CAL_WINDOW = 14, CAL_MIN_DAYS = 7;
  var CAL_MODEL_LO = 0.5, CAL_MODEL_HI = 1.5;
  var CAL_USAGE_LO = 0.3, CAL_USAGE_HI = 1.5;
  var state = { goalOrder: [], goalStep: 0, stats: ${JSON.stringify(stats)}, goals: ${JSON.stringify(goals)},
                gymName: "T", happyMax: 5000, perks: {}, hist: [], ledger: [], focus: "str" };
  function dailyEnergy(){ return { total: 100 }; }
  function gainOne(){ return ${perDayGain} / 10; }   // 10 trains a day -> ${perDayGain}/day
  ${grab("dayKey")} ${grab("calClamp")} ${grab("predictDay")} ${grab("calibration")}
  ${grab("gymFor")} ${grab("dotsFor")} ${grab("trainsTo")} ${grab("trainsPerDay")} ${grab("goalLevels")} ${grab("orderedGoalKeys")} ${grab("goalSegments")} ${grab("scheduleDays")} ${grab("goalPlan")} ${grab("hasGoals")} ${grab("applyGoalFocus")}
  var p = goalPlan();
  applyGoalFocus();
  RESULT = { plan: p, focus: state.focus, has: hasGoals() };` + "; return RESULT;")();

let pass=0,fail=0;
const t=(n,f)=>{try{f();pass++;console.log("ok   "+n);}catch(e){fail++;console.log("FAIL "+n+" :: "+e.message);}};
const S = (str,def,spe,dex)=>({str,def,spe,dex});

t("shorthand is accepted, because nobody types nine digits", () => {
  assert.strictEqual(parseGoal("150m"), 150000000);
  assert.strictEqual(parseGoal("1.2b"), 1200000000);
  assert.strictEqual(parseGoal("500k"), 500000);
  assert.strictEqual(parseGoal("150,000,000"), 150000000);
  assert.strictEqual(parseGoal("150000000"), 150000000);
  assert.strictEqual(parseGoal(" 2.5M "), 2500000);
});
t("an empty field means no goal, and junk is rejected rather than guessed", () => {
  assert.strictEqual(parseGoal(""), 0);
  assert.strictEqual(parseGoal(null), 0);
  assert.ok(Number.isNaN(parseGoal("soon")));
  assert.ok(Number.isNaN(parseGoal("150x")));
  assert.ok(Number.isNaN(parseGoal("-5m")));
});
t("days to a goal are computed from the real gain rate", () => {
  const r = plan(S(1000,0,0,0), { str: 2000 }, 100);   // need 1000 at 100/day
  assert.strictEqual(r.plan.rows[0].days, 10);
});
t("goals run one at a time, shortest first", () => {
  const r = plan(S(1000,1000,0,0), { str: 5000, def: 2000 }, 100);
  assert.deepStrictEqual(r.plan.rows.map(x=>x.k), ["def","str"], "def is 10 days, str is 40");
  assert.strictEqual(r.plan.rows[0].startsIn, 0);
  assert.strictEqual(r.plan.rows[1].startsIn, 10, "str waits for def to finish");
  assert.strictEqual(r.plan.rows[1].doneIn, 50);
  assert.strictEqual(r.plan.total, 50);
});
t("the coach trains whatever is first in the plan", () => {
  const r = plan(S(1000,1000,0,0), { str: 5000, def: 2000 }, 100);
  assert.strictEqual(r.focus, "def", "should be training the shortest goal");
});
t("a goal already met is marked done and skipped", () => {
  const r = plan(S(9000,1000,0,0), { str: 5000, def: 2000 }, 100);
  const str = r.plan.rows.filter(x=>x.k==="str")[0];
  assert.strictEqual(str.done, true);
  assert.strictEqual(str.days, 0);
  assert.strictEqual(r.focus, "def", "should move on to the unmet goal");
  assert.deepStrictEqual(r.plan.rows.map(x=>x.k), ["def","str"],
    "a goal already met should sit at the bottom of the list, not the top");
});
t("all goals met leaves nothing to train", () => {
  const r = plan(S(9000,9000,0,0), { str: 5000, def: 2000 }, 100);
  assert.strictEqual(r.plan.next, null);
  assert.strictEqual(r.plan.total, 0);
});
t("stats with no goal are left out entirely", () => {
  const r = plan(S(1000,1000,1000,1000), { str: 2000 }, 100);
  assert.deepStrictEqual(r.plan.rows.map(x=>x.k), ["str"]);
});
t("an unreachable goal says so instead of hanging", () => {
  const r = plan(S(1000,0,0,0), { str: 1e12 }, 100);
  assert.strictEqual(r.plan.rows[0].days, Infinity);
});
t("no goals at all means the manual pick still rules", () => {
  const r = plan(S(1000,1000,0,0), {}, 100);
  assert.strictEqual(r.has, false);
  assert.strictEqual(r.focus, "str", "focus should be left alone");
});
t("durations read in human units", () => {
  assert.strictEqual(fmtDays(1), "1 day");
  assert.strictEqual(fmtDays(47), "47 days");
  assert.strictEqual(fmtDays(0), "done");
  assert.ok(/months/.test(fmtDays(120)));
  assert.ok(/years/.test(fmtDays(900)));
  assert.strictEqual(fmtDays(Infinity), "not at this rate");
});
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail?1:0);
