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
const consts = ["FULLBAR_NAG_MS", "FULLBAR_SNOOZE_MS", "REFILL_WORTH_PCT"]
  .map(n => {
    const m = new RegExp("var " + n + " = [^;]+;").exec(src);
    assert.ok(m, "constant " + n + " is not defined in the script");
    return m[0];
  }).join("\n");

const MIN = 60000;

function nag({ now = 10 * MIN, energy = 150, max = 150, fullSince = 0, ackAt = 0, stacking = false }) {
  return new Function("var R;" + consts + `
    ${grab("fullBarNag")}
    R = fullBarNag(${now}, ${energy}, ${max}, ${fullSince}, ${ackAt}, ${stacking});
  ` + "return R;")();
}

// prev state -> one poll at `now`, returns what got persisted
function track({ now, energy, max = 150, fullSince = 0, ackAt = 0 }) {
  return new Function("var R;" + consts + `
    var saved = {};
    function storeSet(k, v) { saved[k] = v; }
    var state = { energy: ${energy}, energyMax: ${max}, energyKnown: true,
                  fullSince: ${fullSince}, fullAckAt: ${ackAt} };
    ${grab("trackFullBar")}
    trackFullBar(${now});
    R = { fullSince: state.fullSince, ackAt: state.fullAckAt, saved: saved };
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

let pass = 0, fail = 0;
const t = (n, f) => { try { f(); pass++; console.log("ok   " + n); } catch (e) { fail++; console.log("FAIL " + n + " :: " + e.message); } };

// --- when the banner is up -------------------------------------------------

t("a bar below the cap is not nagged", () => {
  assert.strictEqual(nag({ energy: 149, fullSince: 1 }), null);
});

t("nine minutes at the cap is not yet worth interrupting for", () => {
  assert.strictEqual(nag({ now: 20 * MIN, fullSince: 20 * MIN - 9 * MIN }), null);
});

t("ten minutes at the cap raises the banner", () => {
  const r = nag({ now: 20 * MIN, fullSince: 10 * MIN });
  assert.ok(r, "expected a banner at ten minutes");
  assert.strictEqual(r.minutes, 10);
});

t("the banner counts the real elapsed time, not just the threshold", () => {
  assert.strictEqual(nag({ now: 45 * MIN, fullSince: 20 * MIN }).minutes, 25);
});

// --- when it must stay quiet ----------------------------------------------

t("war stacking is not nagged -- holding the bar IS the plan", () => {
  assert.strictEqual(nag({ now: 60 * MIN, fullSince: 0 + 1, stacking: true }), null);
});

t("above the cap is not nagged -- regen is paused, nothing is bleeding", () => {
  // A xanax puts you 250 over. Torn stops regen up there, so no energy is
  // being lost and there is nothing to interrupt anyone about.
  assert.strictEqual(nag({ now: 60 * MIN, energy: 400, fullSince: 1 }), null);
});

t("a bar never seen full is not nagged", () => {
  assert.strictEqual(nag({ now: 60 * MIN, fullSince: 0 }), null);
});

// --- acknowledging ---------------------------------------------------------

t("Got it buys ten quiet minutes", () => {
  assert.strictEqual(nag({ now: 60 * MIN, fullSince: 10 * MIN, ackAt: 58 * MIN }), null);
});

t("Got it is a snooze, not a silence -- it returns after ten", () => {
  const r = nag({ now: 60 * MIN, fullSince: 10 * MIN, ackAt: 49 * MIN });
  assert.ok(r, "expected the banner back eleven minutes after acknowledging");
  assert.strictEqual(r.minutes, 50);
});

// --- the clock across page loads ------------------------------------------

t("first sight at the cap starts the clock and persists it", () => {
  const r = track({ now: 5 * MIN, energy: 150 });
  assert.strictEqual(r.fullSince, 5 * MIN);
  assert.strictEqual(r.saved.fullsince, 5 * MIN, "must persist or navigation restarts it");
});

t("a later poll while still full does NOT restart the clock", () => {
  // The whole feature dies here if this regresses: every page load would reset
  // the timer and it would never reach ten minutes.
  const r = track({ now: 30 * MIN, energy: 150, fullSince: 5 * MIN });
  assert.strictEqual(r.fullSince, 5 * MIN);
});

t("training clears the clock AND the acknowledgement", () => {
  // Energy leaving the bar is the only thing that genuinely ends the nag.
  const r = track({ now: 30 * MIN, energy: 20, fullSince: 5 * MIN, ackAt: 25 * MIN });
  assert.strictEqual(r.fullSince, 0);
  assert.strictEqual(r.ackAt, 0, "a stale ack would suppress the next full bar");
  assert.strictEqual(r.saved.fullsince, 0);
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

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
