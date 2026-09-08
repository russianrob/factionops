// A can drunk anywhere but the coach's own button.
//
// decrementItemLocal + pendingUse + applyPendingUses already exist and are
// right: they hold a use against Torn's ~30s inventory cache and re-apply it to
// every fetch until the API catches up. But the ONLY thing that ever called
// decrementItemLocal was the coach's own Use button. Drink a can on item.php,
// from the sidebar, on PDA, or through any other script, and nothing recorded
// it — the Stock tab kept showing a can that was already gone, and the advice
// kept offering it.
//
// The energy bar is the tell. syncEnergyFromDom reads it out of Torn's own page
// every second, so it is not on the API's cache at all, and a can is a discrete
// step of a size this script already knows.
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

// CAN_TYPES and the perk/event maths come from source: a local copy would let a
// change to the real energy values pass these tests untouched.
const CONST = [/var CAN_TYPES = \[[\s\S]*?\n  \];/].map((re) => {
  const m = src.match(re);
  assert.ok(m, "missing in source: " + re);
  return m[0];
}).join("\n");

// `state` is rebuilt per case so a detection in one cannot leak into the next.
const run = (state, prev, now) => new Function("var RESULT;" + `
  ${CONST}
  var state = ${JSON.stringify(state)};
  function caffeineOn() { return !!state.caffeine; }
  ${grab("canType")}
  ${grab("canEnergy")}
  ${grab("canFromEnergyStep")}
  RESULT = canFromEnergyStep(${prev}, ${now});
` + "; return RESULT;")();

const base = (drinks, extra) => Object.assign({
  drinkList: drinks, canMult: 1, caffeine: false, energyMax: 150,
}, extra || {});

const MUNSTER = { id: 530, name: "Can of Munster", qty: 4, e: 20 };
const REDCOW = { id: 532, name: "Can of Red Cow", qty: 2, e: 25 };
const TAURINE = { id: 533, name: "Can of Taurine Elite", qty: 7, e: 30 };
const SANTA = { id: 553, name: "Can of Santa Shooters", qty: 1, e: 20 };

let pass = 0, fail = 0;
const t = (n, f) => { try { f(); pass++; console.log("ok   " + n); } catch (e) { fail++; console.log("FAIL " + n + " :: " + e.message); } };

t("a step matching a can you hold is that can", () => {
  const hit = run(base([MUNSTER, TAURINE]), 40, 70);   // +30
  assert.ok(hit, "a 30-point step with Taurine held should be detected");
  assert.strictEqual(hit.id, 533);
});

t("a step matching nothing you hold is not a can", () => {
  // +25 with only Munster and Taurine in the bag: Red Cow is not yours to drink.
  assert.strictEqual(run(base([MUNSTER, TAURINE]), 40, 65), null);
});

t("natural regen is not a can", () => {
  assert.strictEqual(run(base([MUNSTER]), 40, 41), null);
  assert.strictEqual(run(base([MUNSTER]), 40, 45), null);
});

t("xanax and a full refill are not cans", () => {
  assert.strictEqual(run(base([MUNSTER, TAURINE]), 40, 290), null);   // +250 xanax
  assert.strictEqual(run(base([MUNSTER, TAURINE]), 40, 190), null);   // +150 FHC
  assert.strictEqual(run(base([MUNSTER, TAURINE]), 0, 150), null);    // refill to full
});

t("energy going down is never a can", () => {
  assert.strictEqual(run(base([MUNSTER]), 90, 40), null);
  assert.strictEqual(run(base([MUNSTER]), 40, 40), null);
});

t("a can you hold none of cannot be the one you drank", () => {
  const none = Object.assign({}, MUNSTER, { qty: 0 });
  assert.strictEqual(run(base([none]), 40, 60), null);
});

t("the caffeine event doubles the step, and the detector follows", () => {
  // Caffeine Consumption: a 20-point Munster lands as 40.
  assert.strictEqual(run(base([MUNSTER], { caffeine: true }), 40, 60), null);
  const hit = run(base([MUNSTER], { caffeine: true }), 40, 80);
  assert.ok(hit && hit.id === 530, "a doubled Munster is +40, not +20");
});

t("the can perk scales the step too", () => {
  // canMult 1.3 turns a 30-point Taurine into 39.
  const hit = run(base([TAURINE], { canMult: 1.3 }), 40, 79);
  assert.ok(hit && hit.id === 533);
  assert.strictEqual(run(base([TAURINE], { canMult: 1.3 }), 40, 70), null);
});

t("between two cans of the same size, the one you hold more of is assumed", () => {
  // Munster and Santa Shooters are both 20. The total is right either way; the
  // attribution is a guess, and the likelier bag is the better guess.
  const hit = run(base([SANTA, MUNSTER]), 40, 60);
  assert.ok(hit, "a 20-point step should still be detected");
  assert.strictEqual(hit.id, 530, "four Munsters against one Santa: assume the Munster");
});

t("the detector reports the can, it does not mutate anything", () => {
  const st = base([MUNSTER]);
  const before = JSON.stringify(st);
  run(st, 40, 60);
  assert.strictEqual(JSON.stringify(st), before, "detection must have no side effects");
});

// ── the wiring ──────────────────────────────────────────────────────────
// The detector is useless unless something calls it, and the ledger it feeds
// already existed with exactly one trigger. These pin the connection.
t("syncEnergyFromDom feeds the detector into the existing pending ledger", () => {
  const fn = grab("syncEnergyFromDom");
  assert.ok(/canFromEnergyStep\(/.test(fn), "the bar reader never consults the detector");
  assert.ok(/decrementItemLocal\(/.test(fn), "a detected can is never recorded as a pending use");
});

t("it compares against the PREVIOUS reading, before the new one is stored", () => {
  const fn = grab("syncEnergyFromDom");
  const call = fn.indexOf("canFromEnergyStep(");
  const assign = fn.indexOf("state.energy = d.cur");
  assert.ok(call !== -1 && assign !== -1);
  assert.ok(call < assign, "the step must be measured before state.energy is overwritten");
});

t("a first-ever reading is not treated as a drink", () => {
  const fn = grab("syncEnergyFromDom");
  assert.ok(/state\.energyKnown && typeof state\.energy === "number"/.test(fn),
    "without this guard, the first sync of the session decrements a can");
});

t("the existing ledger still expires and still reapplies from the raw baseline", () => {
  // Not my code, but the detector's correctness depends on both: an adjustment
  // that never expired would lie forever, and one applied to the adjusted value
  // would double-count two cans in a row.
  const ap = grab("applyPendingUses");
  assert.ok(/1800000/.test(ap), "the 30-minute expiry is gone");
  assert.ok(/state\.rawQty\[k\]/.test(ap), "no longer recomputing from the API baseline");
});

t("the coach's own Use button is not counted twice", () => {
  // useItemId already decrements; the bar jump that follows is the SAME can.
  const use = grab("useItemId");
  assert.ok(/state\.selfUseAt = Date\.now\(\)/.test(use),
    "using an item through the coach leaves no receipt for the detector");
  const sync = grab("syncEnergyFromDom");
  assert.ok(/state\.selfUseAt/.test(sync) && /SELF_USE_MS/.test(sync),
    "the detector does not check for the coach's own recent use");
  const m = src.match(/var SELF_USE_MS = ([0-9]+);/);
  assert.ok(m, "SELF_USE_MS is not defined in source");
  assert.ok(Number(m[1]) >= 5000 && Number(m[1]) <= 30000,
    "the window should be seconds, not minutes: " + m[1]);
});

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
