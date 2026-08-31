import fs from "fs";
import assert from "assert";
const src = fs.readFileSync("gym-coach-beta.user.js", "utf8");
function grab(n){const i=src.indexOf("function "+n+"(");let d=0,j=src.indexOf("{",i);
  for(let k=j;k<src.length;k++){if(src[k]==="{")d++;else if(src[k]==="}"){d--;if(!d)return src.slice(i,k+1);}}}

// 1000 a day into whichever stat is being trained, so the arithmetic is checkable.
const project = (focus, goals, days) => new Function("var RESULT;" + `
  var HIST_KEYS = ["str","def","spe","dex"];
  var GYMS = [{ Gym: "T", Energy: 10, Str: 1, Def: 1, Spe: 1, Dex: 1 }];
  var DAY_MS = 86400000;
  var GOAL_MAX_DAYS = 3650;
  var CAL_WINDOW = 14, CAL_MIN_DAYS = 7;
  var CAL_MODEL_LO = 0.5, CAL_MODEL_HI = 1.5;
  var CAL_USAGE_LO = 0.3, CAL_USAGE_HI = 1.5;
  var histProjCache = {}, goalCache = { key: "", val: null };
  var GOAL_STEPS = [0, 5e7, 1e8, 2.5e8, 5e8];
  var GOAL_MAX_TRAINS = 4e6;
  var state = { goalOrder: [], goalStep: 0, focus: ${JSON.stringify(focus)}, gymName: "T", happyMax: 5000, perks: {}, hist: [], ledger: [],
                goals: ${JSON.stringify(goals)},
                stats: { str: 10000, def: 20000, spe: 30000, dex: 40000 } };
  function dailyEnergy(){ return { total: 100 }; }
  function gainOne(){ return 100; }                  // 10 trains x 100 = 1000/day
  function projectDays(d){ return d * 1000; }
  ${grab("dayKey")} ${grab("calClamp")} ${grab("predictDay")} ${grab("calibration")}
  ${grab("gymFor")} ${grab("dotsFor")} ${grab("trainsTo")} ${grab("trainsPerDay")} ${grab("goalLevels")} ${grab("orderedGoalKeys")} ${grab("shareCap")} ${grab("goalSegments")} ${grab("scheduleDays")} ${grab("goalPlan")} ${grab("hasGoals")} ${grab("histProjection")}
  RESULT = histProjection(${days});` + "; return RESULT;")();

let pass=0,fail=0;
const t=(n,f)=>{try{f();pass++;console.log("ok   "+n);}catch(e){fail++;console.log("FAIL "+n+" :: "+e.message);}};
const grew = (p,k) => p[k][p[k].length-1].v - p[k][0].v;
const at = (p,k,i) => p[k][i].v;

t("with no goals, only the stat you picked grows", () => {
  const p = project("def", {}, 30);
  assert.strictEqual(grew(p,"def"), 30000);
  ["str","spe","dex"].forEach(k => assert.strictEqual(grew(p,k), 0, k + " grew while untrained"));
});
t("switching focus redraws instead of serving a cached chart", () => {
  const out = new Function("var RESULT;" + `
    var HIST_KEYS = ["str","def","spe","dex"];
    var state = { focus: "def", gymName: "T", goals: {},
                  stats: { str: 1000, def: 2000, spe: 3000, dex: 4000 } };
    var histProjCache = {};
    function dailyEnergy(){ return { total: 100 }; }
    function projectDays(d){ return d * 1000; }
    function hasGoals(){ return false; }
    ${grab("histProjection")}
    var first = histProjection(30);
    state.focus = "str";
    var second = histProjection(30);
    RESULT = { defFirst: first.def[8].v - first.def[0].v,
               strSecond: second.str[8].v - second.str[0].v,
               defSecond: second.def[8].v - second.def[0].v };` + "; return RESULT;")();
  assert.strictEqual(out.defFirst, 30000);
  assert.strictEqual(out.strSecond, 30000, "did not start climbing after the switch");
  assert.strictEqual(out.defSecond, 0, "kept climbing — a stale cached chart");
});
t("with goals, the chart IS the schedule: one stat at a time", () => {
  // def needs 10 days (20000 -> 30000), str needs 40 (10000 -> 50000)
  const p = project("str", { def: 30000, str: 50000 }, 80);
  // sample points are every 10 days
  assert.strictEqual(at(p,"def",1), 30000, "def should have finished by day 10");
  assert.strictEqual(at(p,"str",1), 10000, "str must not start until def is done");
  assert.ok(at(p,"str",2) > 10000, "str should be climbing by day 20");
});
t("a line stops at its target rather than sailing past it", () => {
  // 20000 -> 25500 at 1000/day is 5.5 days, and days round up to 6 — so the
  // window alone would carry it to 26000. The clamp is what stops it.
  const p = project("str", { def: 25500 }, 80);
  p.def.forEach(pt => assert.ok(pt.v <= 25500, "overshot the goal: " + pt.v));
  assert.strictEqual(at(p,"def",p.def.length-1), 25500, "should sit exactly at the target");
});
t("stats with no goal stay flat even when others are scheduled", () => {
  const p = project("str", { def: 30000 }, 80);
  assert.strictEqual(grew(p,"spe"), 0);
  assert.strictEqual(grew(p,"dex"), 0);
});
t("a goal already met never occupies a slot", () => {
  const p = project("str", { def: 5000, str: 50000 }, 40);
  assert.ok(at(p,"str",1) > 10000, "str should start immediately, not queue behind a met goal");
});
t("the chart redraws when a goal changes", () => {
  const a = project("str", { def: 30000 }, 40);
  const b = project("str", { def: 25000 }, 40);
  assert.notStrictEqual(at(a,"def",a.def.length-1), at(b,"def",b.def.length-1));
});
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail?1:0);
