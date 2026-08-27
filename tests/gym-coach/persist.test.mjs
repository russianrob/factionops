import fs from "fs";
import assert from "assert";
const src = fs.readFileSync("gym-coach-beta.user.js", "utf8");
function grab(n){const i=src.indexOf("function "+n+"(");let d=0,j=src.indexOf("{",i);
  for(let k=j;k<src.length;k++){if(src[k]==="{")d++;else if(src[k]==="}"){d--;if(!d)return src.slice(i,k+1);}}}

// A runtime whose clock we control, so "one page visit" can be simulated.
function rt(startE) {
  return new Function("var RESULT;" + `
    var STACK_PEAK_OVER = 300;
    var writes = [], saved = {}, clock = 1000000;
    var pendingTrain = null;
    var GAIN_WAIT_MS = 50000;
    function refresh(){ return { then: function(){ return this; } }; }
    function finaliseTrain(){}
    function pushLog(){}
    function fmt(n){ return String(n); }
    var state = { energy: ${startE}, energyKnown: true, energyMax: 150,
                  energySecPerE: 180, ledger: [], stats: { str:0, def:0, spe:0, dex:0 }, lastSeen: null };
    var DAY_MS = 86400000, LEDGER_DAYS = 90;
    function dayKey(ms){ return Math.floor(ms / DAY_MS); }
    function storeSet(k, v){ writes.push(k); saved[k] = JSON.parse(JSON.stringify(v)); }
    var _now = Date.now; Date.now = function(){ return clock; };
    ${grab("energyRate")} ${grab("timeToFull")} ${grab("ledgerDelta")} ${grab("ledgerBucket")}
    var ledgerDirty = 0, ledgerFlushAt = 0;
    ${grab("dayLooksStacked")} ${grab("ledgerObserve")}
    RESULT = {
      tick: function (e, advanceMs) { clock += (advanceMs || 1000); state.energy = e; ledgerObserve(false); },
      writes: function () { return writes; },
      saved: function () { return saved; },
      spentInStore: function () { return (saved.ledger || []).reduce(function (a, b) { return a + b.used; }, 0); },
      spentInMemory: function () { return state.ledger.reduce(function (a, b) { return a + b.used; }, 0); }
    };` + "; return RESULT;")();
}

let pass=0,fail=0;
const t=(n,f)=>{try{f();pass++;console.log("ok   "+n);}catch(e){fail++;console.log("FAIL "+n+" :: "+e.message);}};

t("a single training session is written to storage immediately", () => {
  const r = rt(150);
  r.tick(150); r.tick(0);                      // full bar, then trained it away
  assert.strictEqual(r.spentInStore(), 150,
    "the session was still only in memory — a navigation would lose it");
});
t("several sessions across one visit all survive", () => {
  const r = rt(150);
  r.tick(150);
  r.tick(0);            // -150
  r.tick(250, 60000);   // xanax, no spend
  r.tick(0);            // -250
  r.tick(150, 60000);   // refill
  r.tick(0);            // -150
  assert.strictEqual(r.spentInStore(), 550, "got " + r.spentInStore());
  assert.strictEqual(r.spentInMemory(), r.spentInStore(), "memory and storage disagree");
});
t("waste alone does not force a write on every single tick", () => {
  const r = rt(150);
  r.tick(150);
  const before = r.writes().length;
  for (let i = 0; i < 10; i++) r.tick(150);    // ten seconds parked at cap
  assert.ok(r.writes().length - before <= 2, "wrote " + (r.writes().length - before) + " times in 10s");
});
t("but waste is still flushed on the clock, not left forever", () => {
  const r = rt(150);
  r.tick(150);
  for (let i = 0; i < 4; i++) r.tick(150, 10000);   // 40s parked at cap
  assert.ok((r.saved().ledger || []).length > 0, "waste never reached storage");
  assert.ok(r.saved().ledger[0].wasted > 0, "no waste recorded");
});
t("lastSeen is saved alongside, so the next page starts from the right place", () => {
  const r = rt(150);
  r.tick(150); r.tick(0);
  assert.ok(r.saved().lastSeen, "lastSeen never persisted");
  assert.strictEqual(r.saved().lastSeen.e, 0);
});
t("a second session within the flush window is still written through", () => {
  // The case a timer alone cannot cover: train, then train again a few seconds
  // later, then navigate. Without a write-through on spend the second is lost.
  const r = rt(150);
  r.tick(150);
  r.tick(0);                    // session one — flushes
  r.tick(250, 3000);            // xanax three seconds later
  r.tick(0, 3000);              // session two, well inside the 15s window
  assert.strictEqual(r.spentInStore(), 400,
    "storage has " + r.spentInStore() + " but memory has " + r.spentInMemory() +
    " — the second session would be lost on navigation");
});
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail?1:0);
