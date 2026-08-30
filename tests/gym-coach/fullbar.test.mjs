// The full-bar nag: a banner that follows you across Torn when the bar has
// been sitting at the cap.
//
// Reported: "I've lost a lot of energy getting distracted by chat or reading a
// guide in the forums... not realizing I never trained." The coach already
// polls the bar on every Torn page, but it strips its own UI off the gym page,
// so there was nothing to notice.
//
// The clock has to survive navigation -- walking from the forums to the item
// market must not restart it, or it would never reach ten minutes.
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
// Pulled from the source, never restated here: a sandbox that DEFINES the
// constant shadows production and every mutation of it survives.
const consts = ["FULLBAR_NAG_MS", "FULLBAR_SNOOZE_MS", "REFILL_WORTH_PCT", "MCS_STOCK_ID", "MCS_ENERGY"]
  .map(n => {
    const m = new RegExp("var " + n + " = [^;]+;").exec(src);
    assert.ok(m, "constant " + n + " is not defined in the script");
    return m[0];
  }).join("\n");

const MIN = 60000;

// The banner reads the SAME clock the panel prints ("Bar has been full for
// 19m"), so the two can never disagree. streakSec is capStreak().sec.
function nag({ now = 10 * MIN, energy = 150, max = 150, streakSec = null, ackAt = 0, stacking = false }) {
  return new Function("var R;" + consts + `
    ${grab("fullBarNag")}
    R = fullBarNag(${now}, ${JSON.stringify(streakSec)}, ${ackAt}, ${stacking}, ${energy}, ${max});
  ` + "return R;")();
}

// prev state -> one poll at `now`, returns what got persisted
function track({ energy, max = 150, ackAt = 0 }) {
  return new Function("var R;" + consts + `
    var saved = {};
    function storeSet(k, v) { saved[k] = v; }
    var state = { energy: ${energy}, energyMax: ${max}, energyKnown: true, fullAckAt: ${ackAt} };
    ${grab("trackFullBar")}
    trackFullBar();
    R = { ackAt: state.fullAckAt, saved: saved };
  ` + "return R;")();
}

function refill({ used = false, energy = 10, max = 150 }) {
  return new Function("var R;" + consts + `
    function fmt(n) { return String(n); }
    var state = { energy: ${energy}, energyMax: ${max}, refillUsed: ${JSON.stringify(used)} };
    ${grab("refillStep")}
    R = refillStep();
  ` + "return R;")();
}

// Calls fullBarNag with a literal argument, bypassing the helper's default --
// `nag({ streakSec: undefined })` silently becomes null and can never reach
// the type guard, which is how a dead guard passed for a round of mutation.
function nagRaw(expr) {
  return new Function("var R;" + consts + `
    ${grab("fullBarNag")}
    R = fullBarNag(600000, ${expr}, 0, false, 150, 150);
  ` + "return R;")();
}

let pass = 0, fail = 0;
const t = (n, f) => { try { f(); pass++; console.log("ok   " + n); } catch (e) { fail++; console.log("FAIL " + n + " :: " + e.message); } };

// --- when the banner is up -------------------------------------------------

t("a bar below the cap is not nagged", () => {
  // capStreak() returns null below the cap, which is the only signal needed.
  assert.strictEqual(nag({ energy: 149, streakSec: null }), null);
});

t("nine minutes at the cap is not yet worth interrupting for", () => {
  assert.strictEqual(nag({ streakSec: 9 * 60 }), null);
});

t("ten minutes at the cap raises the banner", () => {
  const r = nag({ streakSec: 10 * 60 });
  assert.ok(r, "expected a banner at ten minutes");
  assert.strictEqual(r.minutes, 10);
});

t("the banner agrees with the figure the panel prints", () => {
  // The panel said "Bar has been full for 19m" while the banner showed
  // nothing, because the banner used to keep its OWN clock -- one that
  // restarted whenever the app was reopened. Same source now, so the two
  // cannot drift apart again.
  assert.strictEqual(nag({ streakSec: 19 * 60 }).minutes, 19);
});

t("the banner counts the real elapsed time, not just the threshold", () => {
  assert.strictEqual(nag({ streakSec: 25 * 60 }).minutes, 25);
});

// --- when it must stay quiet ----------------------------------------------

t("war stacking is not nagged -- holding the bar IS the plan", () => {
  assert.strictEqual(nag({ streakSec: 60 * 60, stacking: true }), null);
});

t("above the cap is not nagged -- regen is paused, nothing is bleeding", () => {
  // A xanax puts you 250 over. Torn stops regen up there, so no energy is
  // being lost and there is nothing to interrupt anyone about.
  assert.strictEqual(nag({ streakSec: 60 * 60, energy: 400 }), null);
});

t("a bar the clock knows nothing about is not nagged", () => {
  assert.strictEqual(nag({ streakSec: null }), null);
  // Not the same case as null: a non-numeric streak multiplies to NaN, every
  // comparison against it is false, and the banner would sail past the
  // threshold to render "Bar full NaNm".
  assert.strictEqual(nagRaw("undefined"), null);
  assert.strictEqual(nagRaw("NaN"), null);
});

// --- acknowledging ---------------------------------------------------------

t("Got it buys two quiet minutes", () => {
  assert.strictEqual(nag({ now: 60 * MIN, streakSec: 50 * 60, ackAt: 59 * MIN }), null);
});

t("Got it is a snooze, not a silence -- it is back two minutes later", () => {
  const r = nag({ now: 60 * MIN, streakSec: 50 * 60, ackAt: 57 * MIN });
  assert.ok(r, "expected the banner back three minutes after acknowledging");
  assert.strictEqual(r.minutes, 50);
});

// --- the clock across page loads ------------------------------------------

t("a full bar leaves the acknowledgement alone", () => {
  const r = track({ energy: 150, ackAt: 25 * MIN });
  assert.strictEqual(r.ackAt, 25 * MIN);
});

t("training clears the acknowledgement", () => {
  // Energy leaving the bar is the only thing that genuinely ends the nag. A
  // stale Got it would otherwise silence the NEXT full bar for ten minutes.
  const r = track({ energy: 20, ackAt: 25 * MIN });
  assert.strictEqual(r.ackAt, 0);
  assert.strictEqual(r.saved.fullack, 0);
});

// --- the refill reminder ---------------------------------------------------

t("an unused refill on an empty bar is worth telling you about", () => {
  const r = refill({ used: false, energy: 10 });
  assert.ok(r, "expected a refill step");
  assert.match(r.text, /refill/i);
});

t("a refill is not suggested when it would mostly be wasted", () => {
  // The screenshot that started this: 125/150. A refill there buys 25e and
  // burns the day's refill.
  assert.strictEqual(refill({ used: false, energy: 125 }), null);
});

t("a refill already used today is not suggested", () => {
  assert.strictEqual(refill({ used: true, energy: 10 }), null);
});

t("an unreadable refill flag stays quiet rather than guessing", () => {
  // The key may not carry the access. Silence beats a reminder built on a
  // guess -- and it must not throw.
  assert.strictEqual(refill({ used: null, energy: 10 }), null);
});

// --- reading Torn's answer -------------------------------------------------
// The reminder is only as good as this parser: a field-name miss leaves
// refillUsed null forever and the whole feature silently never fires.
function parseRefill(payload) {
  return new Function("var R;" + `
    ${grab("readRefillUsed")}
    R = readRefillUsed(${JSON.stringify(payload)});
  ` + "return R;")();
}

t("v1's energy_refill_used is read", () => {
  assert.strictEqual(parseRefill({ refills: { energy_refill_used: false } }), false);
  assert.strictEqual(parseRefill({ refills: { energy_refill_used: true } }), true);
});

t("v2's renamed `energy` field is read too", () => {
  // v2's schema is energy/nerve/token/special_count against v1's
  // *_refill_used/special_refills_available -- same fields, same order, same
  // types, so `energy` carries the same already-used sense.
  assert.strictEqual(parseRefill({ refills: { energy: false, nerve: false, token: false, special_count: 0 } }), false);
  assert.strictEqual(parseRefill({ refills: { energy: true } }), true);
});

t("an error payload reads unknown, never 'still available'", () => {
  assert.strictEqual(parseRefill({ error: { code: 2, error: "Incorrect key" } }), null);
  assert.strictEqual(parseRefill({}), null);
  assert.strictEqual(parseRefill({ refills: {} }), null);
});

// --- Mc Smoogle: the weekly 100 energy ------------------------------------
// Probed live on 2026-08-30: MCS is stock id 29, "100 energy", 350,000 shares
// an increment. Crucially TWO stocks match /energy/i -- MUN (24) pays
// "1x Six-Pack of Energy Drink", which is an ITEM, not energy. Anything that
// picks the stock by description has to tell those apart.
function parseMcs(payload) {
  return new Function("var R;" + consts + `
    ${grab("readMcsBonus")}
    R = readMcsBonus(${JSON.stringify(payload)});
  ` + "return R;")();
}
function mcs(bonus) {
  return new Function("var R;" + consts + `
    function fmt(n) { return String(n); }
    var state = { mcs: ${JSON.stringify(bonus)} };
    ${grab("mcsStep")}
    R = mcsStep();
  ` + "return R;")();
}

t("the real holdings payload is read", () => {
  // Exactly what the probe returned.
  const r = parseMcs({ stocks: [
    { id: 14, shares: 1000000, bonus: { available: true, increment: 1, progress: 7, frequency: 7 } },
    { id: 29, shares: 350000, bonus: { available: true, increment: 1, progress: 7, frequency: 7 } },
  ]});
  assert.deepStrictEqual(r, { available: true, increment: 1 });
});

t("another stock being ready is not Mc Smoogle being ready", () => {
  // IIL was also available:true on the probed account. Keying on anything but
  // the stock id would have claimed MCS was ready whenever IIL was.
  const r = parseMcs({ stocks: [
    { id: 14, shares: 1000000, bonus: { available: true, increment: 1, progress: 7, frequency: 7 } },
  ]});
  assert.strictEqual(r, null);
});

t("a holding that is not yet ready reads as not ready", () => {
  const r = parseMcs({ stocks: [
    { id: 29, shares: 350000, bonus: { available: false, increment: 1, progress: 3, frequency: 7 } },
  ]});
  assert.deepStrictEqual(r, { available: false, increment: 1 });
});

t("an error payload reads unknown, not ready", () => {
  assert.strictEqual(parseMcs({ error: { code: 16, error: "Access level" } }), null);
  assert.strictEqual(parseMcs({}), null);
});

t("a holding with no readable available flag reads unknown, not ready", () => {
  // Distinct from "held but not ready": if Torn ever stops sending the flag,
  // the answer must be null rather than an object whose `available` is
  // undefined, which any later reader would have to remember to re-check.
  assert.strictEqual(parseMcs({ stocks: [
    { id: 29, shares: 350000, bonus: { increment: 1, progress: 7, frequency: 7 } },
  ]}), null);
  assert.strictEqual(parseMcs({ stocks: [
    { id: 29, shares: 350000, bonus: { available: "yes", increment: 1 } },
  ]}), null);
  assert.strictEqual(parseMcs({ stocks: [{ id: 29, shares: 350000 }] }), null);
});

t("a waiting claim is offered, sized by increments held", () => {
  const r = mcs({ available: true, increment: 1 });
  assert.ok(r, "expected a step");
  assert.match(r.text, /100e/);
  assert.match(r.text, /Mc Smoogle/i);
  // two increments is two hundred energy, not one
  assert.match(mcs({ available: true, increment: 2 }).text, /200e/);
});

t("nothing is said when the claim is not ready", () => {
  assert.strictEqual(mcs({ available: false, increment: 1 }), null);
});

t("nothing is said when it could not be read", () => {
  assert.strictEqual(mcs(null), null);
});

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
