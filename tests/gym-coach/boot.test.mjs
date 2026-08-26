import fs from "fs";
import assert from "assert";
const src = fs.readFileSync("gym-coach-beta.user.js", "utf8");
function grab(n){const i=src.indexOf("function "+n+"(");let d=0,j=src.indexOf("{",i);
  for(let k=j;k<src.length;k++){if(src[k]==="{")d++;else if(src[k]==="}"){d--;if(!d)return src.slice(i,k+1);}}}

// A boot sequence: stored state from last night, then readings arrive.
function makeRuntime(stored, opts) {
  const o = Object.assign({ rate: 180, max: 150 }, opts || {});
  const code = `
    var saved = {};
    var pendingTrain = null;
    var GAIN_WAIT_MS = 50000;
    function refresh(){ return { then: function(){ return this; } }; }
    function finaliseTrain(){}
    function pushLog(){}
    function fmt(n){ return String(n); }
    var state = { energyMax: ${o.max}, energySecPerE: ${o.rate}, energy: 0,
                  energyKnown: false, ledger: [], stats: { str:0, def:0, spe:0, dex:0 }, lastSeen: ${JSON.stringify(stored)} };
    var DAY_MS = 86400000;
    function dayKey(ms){ return Math.floor(ms / DAY_MS); }
    function storeSet(k, v){ saved[k] = v; }
    var LEDGER_DAYS = 90;
    ${grab("energyRate")} ${grab("timeToFull")} ${grab("ledgerDelta")} ${grab("ledgerBucket")}
    var ledgerDirty = 0;
    ${grab("ledgerObserve")} ${grab("capStreak")}
    RESULT = { state: state, observe: ledgerObserve, streak: capStreak,
               setEnergy: function (e) { state.energy = e; state.energyKnown = true; } };`;
  return new Function("var RESULT;" + code + "; return RESULT;")();
}

let pass=0,fail=0;
const t=(n,f)=>{try{f();pass++;console.log("ok   "+n);}catch(e){fail++;console.log("FAIL "+n+" :: "+e.message);}};
const HOUR=3600e3, now=Date.now();

t("the boot tick before any reading does not touch the ledger", () => {
  const r = makeRuntime({ e: 150, t: now - 8*HOUR, capSince: now - 8*HOUR });
  r.observe(false);                       // the tick that used to run at energy=0
  assert.strictEqual(r.state.ledger.length, 0, "booked a phantom entry");
  assert.strictEqual(r.state.lastSeen.t, now - 8*HOUR, "clobbered the stored reading");
  assert.strictEqual(r.state.lastSeen.capSince, now - 8*HOUR, "wiped the overnight streak");
});
t("waking to a full bar reports the hours, not a second", () => {
  const r = makeRuntime({ e: 150, t: now - 8*HOUR, capSince: now - 8*HOUR });
  r.observe(false);
  r.setEnergy(150);
  const s = r.streak();
  assert.ok(s && s.sec > 7.5*3600, "streak was " + (s && Math.round(s.sec/3600)) + "h");
  assert.strictEqual(Math.round(s.lost), 160, "8h at 180s/e = 160e, got " + s.lost);
});
t("the overnight waste lands in the ledger once energy is known", () => {
  const r = makeRuntime({ e: 150, t: now - 8*HOUR, capSince: now - 8*HOUR });
  r.observe(false);
  r.setEnergy(150);
  r.observe(true);
  const tot = r.state.ledger.reduce((a,b)=>({used:a.used+b.used, wasted:a.wasted+b.wasted}),{used:0,wasted:0});
  assert.strictEqual(Math.round(tot.wasted), 160, "got " + tot.wasted);
  assert.strictEqual(tot.used, 0, "nothing was spent overnight, got " + tot.used);
});
t("no phantom spend is recorded for the unread window", () => {
  const r = makeRuntime({ e: 150, t: now - 8*HOUR, capSince: now - 8*HOUR });
  r.observe(false); r.observe(false); r.observe(false);   // several blind ticks
  r.setEnergy(150); r.observe(true);
  const used = r.state.ledger.reduce((a,b)=>a+b.used,0);
  assert.strictEqual(used, 0, "phantom spend of " + used);
});
t("streak falls back to the last stored reading when capSince is absent", () => {
  const r = makeRuntime({ e: 150, t: now - 5*HOUR });        // upgrade: no capSince
  r.setEnergy(150);
  const s = r.streak();
  assert.ok(s.sec > 4.5*3600, "should infer ~5h, got " + Math.round(s.sec/3600) + "h");
});
t("a bar that is not full has no streak", () => {
  const r = makeRuntime({ e: 150, t: now - 5*HOUR, capSince: now - 5*HOUR });
  r.setEnergy(40);
  assert.strictEqual(r.streak(), null);
});
t("spending after waking is counted, and the streak clears", () => {
  const r = makeRuntime({ e: 150, t: now - 8*HOUR, capSince: now - 8*HOUR });
  r.observe(false); r.setEnergy(150); r.observe(true);
  r.setEnergy(30); r.observe(true);
  assert.strictEqual(r.streak(), null);
  const used = r.state.ledger.reduce((a,b)=>a+b.used,0);
  assert.strictEqual(used, 120);
});
t("the streak keeps growing across ticks instead of resetting each second", () => {
  const r = makeRuntime({ e: 150, t: now - 3*HOUR, capSince: now - 3*HOUR });
  r.setEnergy(150);
  r.observe(true); r.observe(true); r.observe(true);   // three ticks at a full bar
  const s = r.streak();
  assert.ok(s.sec > 2.5*3600, "streak collapsed to " + Math.round(s.sec) + "s — capSince is being rewritten");
  assert.ok(Math.round(s.lost) >= 55, "lost should track the streak, got " + s.lost);
});
t("no streak is claimed from a stale value before a reading lands", () => {
  const r = makeRuntime({ e: 150, t: now - HOUR, capSince: now - HOUR });
  r.state.energy = 150;              // a value is present but nothing has confirmed it
  assert.strictEqual(r.state.energyKnown, false);
  assert.strictEqual(r.streak(), null, "claimed a streak before any reading");
});
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail?1:0);
