import fs from "fs";
import assert from "assert";
const src = fs.readFileSync("gym-coach-beta.user.js", "utf8");
// gymFor() reads the real gym table, and a train's cost is what decides whether
// an observed drop was training at all. Pulled from source, never restated: a
// sandbox that defines its own costs would shadow production and let every
// mutation of the real ones survive.
const GYMS_SRC = (() => {
  const m = /  var GYMS = \[[\s\S]*?\n  \];/.exec(src);
  if (!m) throw new Error("GYMS table not found in the script");
  return m[0];
})();
function grab(n){const i=src.indexOf("function "+n+"(");let d=0,j=src.indexOf("{",i);
  for(let k=j;k<src.length;k++){if(src[k]==="{")d++;else if(src[k]==="}"){d--;if(!d)return src.slice(i,k+1);}}}
function grabVar(n){const m=new RegExp("var "+n+" = (\\{[^}]*\\});").exec(src);return "var "+n+" = "+m[1]+";";}

// A runtime that ticks the ledger the way the script does, then resolves the
// pending entry — the whole path, not a reimplementation of it.
const session = steps => new Function("var RESULT;" + `
    var STACK_PEAK_OVER = 300;
  var logged = [], refreshes = 0, clock = 1000000;
  var DAY_MS = 86400000, LEDGER_DAYS = 90;
  var state = { energy: 0, energyKnown: true, energyMax: 150, energySecPerE: 180,
                  // ledgerObserve's gap path needs these. logReadable true so
                  // these fixtures exercise reconstruction; the Limited-key
                  // decline has its own suite in gapwaste.test.mjs.
                  logReadable: true, trainLog: { events: [] }, attackEvents: [],
                ledger: [], lastSeen: null, lastTrain: 0, open: false,
                gymName: "George's", stats: { str: 0, def: 0, spe: 0, dex: 0 } };
  var pendingTrain = null;
  var GAIN_WAIT_MS = 50000;
  function fmt(n){ return Math.round(n).toLocaleString("en-US"); }
  function pushLog(t){ logged.push(t); }
  function renderPanel(){}
  function storeSet(){}
  function dayKey(ms){ return Math.floor(ms / DAY_MS); }
  Date.now = function(){ return clock; };
  // Timers respect the virtual clock, or a 54-second backstop fires instantly
  // and every session finalises before the stats could possibly have moved.
  var timers = [], deferred = [];
  function refresh(){ refreshes++; return { then: function(f){ deferred.push(f); return this; } }; }
  function setTimeout(fn, ms){ timers.push({ fn: fn, at: clock + (ms || 0) }); return 0; }
  function runDeferred(){
    for (var n = 0; n < 30; n++) {
      var due = [];
      timers = timers.filter(function (t) { if (t.at <= clock) { due.push(t.fn); return false; } return true; });
      var q = deferred.concat(due);
      deferred = [];
      if (!q.length) break;
      q.forEach(function (f) { try { f(); } catch (e) {} });
    }
  }
  ${grabVar("STAT_KEY")}
  ${grab("inferTrainSkillFromDelta")} ${grab("energyRate")} ${grab("timeToFull")} ${grab("ledgerDelta")}
  ${/var GAP_MS = \d+;/.exec(src)[0]} ${grab("simulateWaste")} ${grab("gapWaste")}
    ${GYMS_SRC} ${grab("gymSpend")} ${grab("noteGymSpend")} ${grab("gymFor")} ${grab("perTrainEnergy")} function onGymPage(){ return true; } ${grab("dayLooksStacked")} ${grab("ledgerBucket")} ${grab("ledgerObserve")} ${grab("finaliseTrain")}
  var ledgerDirty = 0, ledgerFlushAt = 0;
  ${JSON.stringify(steps)}.forEach(function (st) {
    clock += (st.ms || 1000);
    state.energy = st.e;
    if (st.stats) state.stats = st.stats;
    ledgerObserve(false);
    if (st.settle) { finaliseTrain(); runDeferred(); }
    if (st.giveUp) { clock += 60000; runDeferred(); }
  });
  RESULT = { logged: logged, refreshes: refreshes };` + "; return RESULT;")();

const S = (str,def,spe,dex) => ({ str, def, spe, dex });
let pass=0,fail=0;
const t=(n,f)=>{try{f();pass++;console.log("ok   "+n);}catch(e){fail++;console.log("FAIL "+n+" :: "+e.message);}};

t("a 400e session is logged even though no click was seen", () => {
  const r = session([
    { e: 400, stats: S(1000,0,0,0) },            // banked, ready
    { e: 0 },                                     // trained the lot
    { e: 0, stats: S(1004000,0,0,0), settle: 1 }, // stats catch up on the poll
  ]);
  assert.strictEqual(r.logged.length, 1, "logged " + r.logged.length + " entries");
  assert.ok(/400e spent/.test(r.logged[0]), r.logged[0]);
  assert.ok(/Strength/.test(r.logged[0]), r.logged[0]);
});
t("a small drop with no stat gain is skew, not a session", () => {
  // 7e lower on a stale reading, nothing trained
  const r = session([
    { e: 155, stats: S(1000,0,0,0) },
    { e: 148 },
    { e: 148, stats: S(1000,0,0,0), settle: 1 },
    { e: 148, giveUp: 1 },
  ]);
  assert.deepStrictEqual(r.logged, [], "invented a session: " + r.logged[0]);
});
t("a large drop is a session even if the stats never catch up", () => {
  // 700e cannot be API skew, and discarding it would lose real training
  const r = session([
    { e: 700, stats: S(1000,0,0,0) },
    { e: 0 },
    { e: 0, settle: 1 },
    { e: 0, giveUp: 1 },
  ]);
  assert.strictEqual(r.logged.length, 1, "lost a 700e session");
  assert.ok(/700e spent/.test(r.logged[0]), r.logged[0]);
});
t("gaining energy is never a session", () => {
  const r = session([
    { e: 20, stats: S(1000,0,0,0) },
    { e: 270 },                                   // xanax
    { e: 270, stats: S(1000,0,0,0), settle: 1 },
  ]);
  assert.deepStrictEqual(r.logged, []);
});
t("two sessions in a row are both logged", () => {
  const r = session([
    { e: 150, stats: S(1000,0,0,0) },
    { e: 0 },
    { e: 0, stats: S(1500,0,0,0), settle: 1 },
    { e: 250, ms: 60000 },
    { e: 0 },
    { e: 0, stats: S(2300,0,0,0), settle: 1 },
  ]);
  assert.strictEqual(r.logged.length, 2, "got " + r.logged.length + ": " + r.logged.join(" | "));
  assert.ok(/150e spent/.test(r.logged[0]));
  assert.ok(/250e spent/.test(r.logged[1]));
});
t("it names the stat that actually moved", () => {
  const r = session([
    { e: 150, stats: S(1000,2000,3000,4000) },
    { e: 0 },
    { e: 0, stats: S(1000,2000,3000,9000), settle: 1 },
  ]);
  assert.ok(/Dexterity/.test(r.logged[0]), r.logged[0]);
});
t("a drop under 5 is treated as noise", () => {
  const r = session([
    { e: 150, stats: S(1000,0,0,0) },
    { e: 147 },
    { e: 147, stats: S(1400,0,0,0), settle: 1 },
  ]);
  assert.deepStrictEqual(r.logged, []);
});
t("one session does not queue two entries", () => {
  const r = session([
    { e: 150, stats: S(1000,0,0,0) },
    { e: 0 },
    { e: 0 },                                     // another tick, still spent
    { e: 0, stats: S(1500,0,0,0), settle: 1 },
    { e: 0, settle: 1 },
  ]);
  assert.strictEqual(r.logged.length, 1, "duplicated: " + r.logged.join(" | "));
});
t("a session spread over several ticks reports the WHOLE spend", () => {
  // energy falls in stages as the page catches up. Without a guard, each stage
  // overwrites the pending entry and only the last stage gets reported.
  const r = session([
    { e: 150, stats: S(1000,0,0,0) },
    { e: 100 },
    { e: 40 },
    { e: 0 },
    { e: 0, stats: S(2500,0,0,0), settle: 1 },
  ]);
  assert.strictEqual(r.logged.length, 1, "got " + r.logged.length);
  assert.ok(/150e spent/.test(r.logged[0]),
    "reported only the last stage instead of the session: " + r.logged[0]);
});
t("the gain is measured from BEFORE the session, not after", () => {
  // energy and stats both land on the same tick — if the earlier stats were not
  // kept, the comparison is against the new value and the gain reads as zero
  const r = session([
    { e: 400, stats: S(1000,0,0,0) },
    { e: 0, stats: S(1004000,0,0,0) },
    { e: 0, settle: 1 },
  ]);
  assert.strictEqual(r.logged.length, 1, "the session was dropped entirely");
  assert.ok(/\+1,003,000/.test(r.logged[0]), r.logged[0]);
});
t("the gain is not written until the stats actually move", () => {
  // energy drops now; Torn keeps serving the old stats for ~30s
  const r = session([
    { e: 700, stats: S(614884840,0,0,0) },
    { e: 0 },
    { e: 0, settle: 1 },                                  // stats still stale
    { e: 0, stats: S(615584840,0,0,0), settle: 1 },       // now they catch up
  ]);
  assert.strictEqual(r.logged.length, 1, "got " + r.logged.length + ": " + r.logged.join(" | "));
  assert.ok(/700e spent/.test(r.logged[0]), r.logged[0]);
  assert.ok(/\+700,000/.test(r.logged[0]), "gain missing: " + r.logged[0]);
});
t("a session is still recorded if the stats never move", () => {
  const r = session([
    { e: 700, stats: S(614884840,0,0,0) },
    { e: 0 },
    { e: 0, settle: 1 },
    { e: 0, giveUp: 1 },
  ]);
  assert.strictEqual(r.logged.length, 1, "the session was lost waiting for a gain");
  assert.ok(/700e spent/.test(r.logged[0]) && !/\+/.test(r.logged[0]), r.logged[0]);
});
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail?1:0);
