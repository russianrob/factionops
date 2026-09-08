// The referee: Torn's own count of cans you have drunk.
//
// The energy-step detector (0.9.83) sees a can the instant the bar moves, but
// only while the script is watching. Drink one with Torn closed, on another
// device, or during a page load, and the bar step happens where nobody is
// looking — the Stock tab then holds that can until the inventory API catches
// up, which is the whole complaint.
//
// personalstats.energydrinkused is a cumulative count of cans drunk. Its delta
// since the last inventory snapshot is how many cans left the bag, whoever was
// watching. It cannot say WHICH can, so it is a referee on the count and never
// on the attribution.
//
// It has to be the v1 selections=personalstats form: measured 2026-09-08, v1
// answered xantaken 718 live while v2's ?stat= form answered 716 "as of
// yesterday". A daily snapshot cannot referee anything.
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

const shortfall = new Function("return " + grab("canRefereeShortfall"))();

let pass = 0, fail = 0;
const t = (n, f) => { try { f(); pass++; console.log("ok   " + n); } catch (e) { fail++; console.log("FAIL " + n + " :: " + e.message); } };

t("nothing to do when the count agrees with what was detected", () => {
  // Two cans drunk, two already pending: the detector saw both.
  assert.strictEqual(shortfall(60, 58, 2), 0);
});

t("cans drunk while nobody was watching are recovered", () => {
  // Three drunk, one detected: two happened with the page closed.
  assert.strictEqual(shortfall(61, 58, 1), 2);
});

t("it never reports a negative correction", () => {
  // More pending than the counter admits. The counter can lag the bar, so this
  // is not proof of over-detection -- and the 30-minute expiry already handles
  // a use that never landed. Adding a NEGATIVE correction here would put a can
  // back that was really drunk.
  assert.strictEqual(shortfall(59, 58, 3), 0);
});

t("an unknown counter does nothing rather than guessing", () => {
  assert.strictEqual(shortfall(null, 58, 0), 0);
  assert.strictEqual(shortfall(60, null, 0), 0);
  assert.strictEqual(shortfall(undefined, undefined, 0), 0);
});

t("a counter that went backwards is ignored", () => {
  // Cumulative counters do not decrease; if one appears to, the reading is bad.
  assert.strictEqual(shortfall(50, 58, 0), 0);
});

t("the first reading after a snapshot corrects nothing", () => {
  assert.strictEqual(shortfall(58, 58, 0), 0);
});

t("it counts cans, not can types", () => {
  // Five drunk since the snapshot, none detected: five to record, whatever they
  // were. Attribution is the detector's job and stays a guess.
  assert.strictEqual(shortfall(63, 58, 0), 5);
});

// ── the wiring ──────────────────────────────────────────────────────────
t("the referee reads the LIVE counter, not the daily snapshot", () => {
  assert.ok(/selections=personalstats/.test(src) || /apiUrl\("personalstats"\)/.test(src),
    "must use v1 selections=personalstats; v2's ?stat= form answers yesterday's value");
  assert.ok(!/v2\/user\/personalstats\?stat=energydrinkused/.test(src),
    "v2 ?stat=energydrinkused is a daily snapshot and cannot referee");
});

t("the baseline moves forward with every inventory snapshot", () => {
  // Otherwise the same drinks are recovered again after every fetch.
  const i = src.indexOf("applyPendingUses();\n    // The snapshot now includes");
  assert.ok(i !== -1, "the baseline is not advanced where the snapshot is applied");
  assert.ok(/state\.canRefBase = state\.cansUsed/.test(src.slice(i, i + 500)),
    "the baseline must be set from the counter at snapshot time");
});

t("a recovered can is recorded through the SAME pending ledger", () => {
  // Not a second mechanism: the ledger already expires, re-applies from the raw
  // API baseline, and adjusts the cans list. A parallel path would drift.
  const ref = grab("applyCanReferee");
  assert.ok(/decrementItemLocal\(/.test(ref),
    "the referee must feed the existing ledger rather than edit counts directly");
});

t("the counter is actually fetched, not just fetchable", () => {
  // A fetch nothing calls is the same as no fetch. This has bitten the script
  // before -- a card built and never placed, a control the router never saw.
  assert.ok(/fetchCansUsed\(kind ===/.test(src),
    "fetchCansUsed is never called from the refresh cycle");
});

t("the referee cannot take a can you do not hold", () => {
  const ref = grab("applyCanReferee");
  assert.ok(/qty \|\| 0\) > 0/.test(ref), "it must only decrement cans actually held");
  assert.ok(/i < 20/.test(ref), "a runaway counter must not empty the whole bag");
});

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
