import fs from "fs";
import assert from "assert";
const src = fs.readFileSync("gym-coach-beta.user.js", "utf8");
function grab(n){const i=src.indexOf("function "+n+"(");let d=0,j=src.indexOf("{",i);
  for(let k=j;k<src.length;k++){if(src[k]==="{")d++;else if(src[k]==="}"){d--;if(!d)return src.slice(i,k+1);}}}
function konst(n){const m=src.match(new RegExp("\\b"+n+"\\s*=\\s*([^;]+);"));
  if(!m) throw new Error("missing "+n); return "var "+n+" = "+m[1].trim()+";";}

const FNS = ["gymFor","dotsFor","trainsTo","trainsPerDay","goalLevels","orderedGoalKeys",
             // shareCap and shareState are grabbed from source, not stubbed: a
             // local copy would shadow production and let a mutation of the
             // real one survive. With no build set they take the flat-rung
             // path, which is what these schedules are about.
             "shareCap","shareState","shareTargets","shareNextStat",
             "goalSegments","goalPlan","scheduleDays","hasGoals","applyGoalFocus"];

// `gain` is per train; a linear one keeps the arithmetic checkable by hand.
function run(opts) {
  const {
    stats, goals, order = [], step = 0, gain = "1", energy = 300,
    gymEnergy = 10, extra = "",
  } = opts;
  return new Function("var RESULT;" + `
    var HIST_KEYS = ["str","def","spe","dex"];
    var GYMS = [{ Gym: "T", Energy: ${gymEnergy}, Str: 1, Def: 1, Spe: 1, Dex: 1 }];
    ${konst("GOAL_STEPS")} ${konst("GOAL_MAX_TRAINS")}
    var goalCache = { key: "", val: null };
    var state = {
      stats: ${JSON.stringify(stats)}, goals: ${JSON.stringify(goals)},
      goalOrder: ${JSON.stringify(order)}, goalStep: ${step},
      gymName: "T", happyMax: 5000, perks: {}, focus: "str"
    };
    function dailyEnergy(){ return { total: ${energy} }; }
    function gainOne(stat){ return ${gain}; }
    function calibration(){ return { ok: false, model: 1, usage: 1 }; }
    ${FNS.map(grab).join("\n    ")}
    ${extra}
    RESULT = { plan: goalPlan(), state: state };` + "; return RESULT;")();
}

let pass=0,fail=0;
const t=(n,f)=>{try{f();pass++;console.log("ok   "+n);}catch(e){fail++;console.log("FAIL "+n+" :: "+e.message);}};
const near=(a,b,tol=1e-6)=>assert.ok(Math.abs(a-b)<=tol, a+" !~ "+b);
const S = (str,def,spe) => ({ str, def, spe, dex: 0 });

t("with no increment it is one leg a stat, in shortest-first order", () => {
  const r = run({ stats: S(100,200,300), goals: { str: 1000, def: 1000, spe: 1000 }, step: 0 });
  assert.strictEqual(r.plan.segments.length, 3);
  assert.deepStrictEqual(r.plan.segments.map(s => s.k), ["spe","def","str"]);  // 700/800/900 to go
});

t("an increment interleaves the stats instead of running them end to end", () => {
  const r = run({ stats: S(0,0,0), goals: { str: 1000, def: 1000, spe: 1000 }, step: 500 });
  assert.deepStrictEqual(r.plan.segments.map(s => s.k + ":" + s.cap),
    ["str:500","def:500","spe:500","str:1000","def:1000","spe:1000"]);
});

t("a stat that is behind catches up on its own before the rotation settles", () => {
  // def is a whole level short, so it gets a leg to itself first
  const r = run({ stats: S(500,0,500), goals: { str: 1000, def: 1000, spe: 1000 }, step: 500 });
  assert.strictEqual(r.plan.segments[0].k, "def");
  assert.strictEqual(r.plan.segments[0].cap, 500);
});

t("rotation is free: interleaving does not change the total", () => {
  const goals = { str: 1000, def: 1000, spe: 1000 };
  const stats = S(0,0,0);
  const flat = run({ stats, goals, step: 0 }).plan;
  const rot  = run({ stats, goals, step: 100 }).plan;
  assert.strictEqual(rot.segments.length, 30);
  assert.strictEqual(flat.totalTrains, rot.totalTrains);   // trains, not rounded days
  near(flat.total, rot.total);
});

t("a leg never overshoots its own target waiting for the next multiple", () => {
  const r = run({ stats: S(0,0,0), goals: { str: 250, def: 1000 }, step: 500 });
  const strSegs = r.plan.segments.filter(s => s.k === "str");
  assert.strictEqual(strSegs.length, 1);
  assert.strictEqual(strSegs[0].cap, 250);
  assert.strictEqual(strSegs[0].to, 250);
});

t("levels are the multiples plus every target, deduped and in order", () => {
  const levels = new Function(konst("GOAL_MAX_TRAINS") + "return " + grab("goalLevels"))();
  assert.deepStrictEqual(levels(500, { a: 1000, b: 1000 }), [500, 1000]);
  assert.deepStrictEqual(levels(500, { a: 250, b: 1000 }), [250, 500, 1000]);
  assert.deepStrictEqual(levels(0,   { a: 250, b: 1000 }), [250, 1000]);
  assert.deepStrictEqual(levels(300, { a: 900 }), [300, 600, 900]);
});

t("a hand-set order is obeyed, and beats shortest-first", () => {
  const goals = { str: 1000, def: 1000, spe: 1000 };
  const auto = run({ stats: S(100,200,300), goals, step: 0 });
  assert.strictEqual(auto.plan.segments[0].k, "spe");          // nearest goal
  const mine = run({ stats: S(100,200,300), goals, step: 0, order: ["str","def","spe"] });
  assert.deepStrictEqual(mine.plan.segments.map(s => s.k), ["str","def","spe"]);
});

t("a partial order places what it names and falls back for the rest", () => {
  const r = run({ stats: S(100,200,300), goals: { str: 1000, def: 1000, spe: 1000 },
                  step: 0, order: ["def"] });
  // def first because it was named; str and spe then in shortest-first order
  assert.deepStrictEqual(r.plan.segments.map(s => s.k), ["def","spe","str"]);
});

t("an order naming a finished or goal-less stat does not corrupt the schedule", () => {
  const r = run({ stats: S(2000,200,300), goals: { str: 1000, def: 1000, spe: 1000 },
                  step: 0, order: ["dex","str","def"] });
  assert.deepStrictEqual(r.plan.segments.map(s => s.k), ["def","spe"]);
  const strRow = r.plan.rows.filter(x => x.k === "str")[0];
  assert.strictEqual(strRow.done, true);
});

t("the coach trains the leg you are on, not the nearest finish line", () => {
  // spe finishes first overall, but with rotation str is the leg in progress
  const r = run({ stats: S(0,0,400), goals: { str: 1000, def: 1000, spe: 1000 },
                  step: 500, order: ["str","def","spe"],
                  extra: "applyGoalFocus();" });
  assert.strictEqual(r.plan.now.k, "str");
  assert.strictEqual(r.state.focus, "str");
});

t("rows report each stat's own total and when it actually finishes", () => {
  const r = run({ stats: S(0,0,0), goals: { str: 1000, def: 1000 }, step: 500, order: ["str","def"] });
  const str = r.plan.rows.filter(x => x.k === "str")[0];
  const def = r.plan.rows.filter(x => x.k === "def")[0];
  assert.strictEqual(str.trains, def.trains);
  assert.ok(def.doneIn >= str.doneIn, "def is second in the order, so it ends no earlier");
  near(r.plan.total, Math.max(str.doneIn, def.doneIn));
});

t("more energy a day shortens the schedule by division, exactly", () => {
  const r = run({ stats: S(0,0,0), goals: { str: 1000000 }, step: 0, energy: 300 });
  const sd = new Function(grab("trainsPerDay") + grab("gymFor") +
    "var GYMS=[{Gym:'T',Energy:10}]; var state={gymName:'T'};" +
    "return " + grab("scheduleDays"))();
  near(sd(r.plan.totalTrains, 300), r.plan.total);
  near(sd(r.plan.totalTrains, 600), r.plan.total / 2);
});

t("an unreachable target yields no segments rather than looping forever", () => {
  const r = run({ stats: S(0,0,0), goals: { str: 1000 }, gain: "0" });
  assert.strictEqual(r.plan.segments.length, 0);
  assert.strictEqual(r.plan.rows.filter(x => x.k === "str")[0].days, Infinity);
});

t("a stat's row totals every leg it has, not just the last one", () => {
  // str crosses ten 100-point levels; at 1 point a train that is 1000 trains.
  // Summing only the final leg would report 100 and a tenth of the real time.
  const r = run({ stats: S(0,0,0), goals: { str: 1000 }, step: 100 });
  const str = r.plan.rows.filter(x => x.k === "str")[0];
  assert.strictEqual(r.plan.segments.length, 10);
  assert.strictEqual(str.trains, 1000);
  assert.strictEqual(r.plan.totalTrains, 1000);
  near(str.days, r.plan.total);
  near(str.doneIn, r.plan.total);
});

t("interleaved legs still add up per stat", () => {
  const r = run({ stats: S(0,0,0), goals: { str: 600, def: 600 }, step: 200,
                  order: ["str","def"] });
  assert.strictEqual(r.plan.segments.length, 6);
  const str = r.plan.rows.filter(x => x.k === "str")[0];
  const def = r.plan.rows.filter(x => x.k === "def")[0];
  assert.strictEqual(str.trains, 600);
  assert.strictEqual(def.trains, 600);
  assert.strictEqual(r.plan.totalTrains, 1200);
  // str goes first in each round, so it finishes one leg ahead of def
  assert.ok(str.doneIn < def.doneIn);
  near(def.doneIn, r.plan.total);
});

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
