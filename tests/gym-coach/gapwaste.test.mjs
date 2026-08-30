// What to do about time the script did not watch.
//
// Continuously-observed time is already right: the ledger ticks every second
// and sees every drop. The bug was only ever in the GAPS, where the old code
// assumed the bar sat at the cap throughout -- which on a second device is
// simply false, because the other one was training and attacking in there.
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
const GAP = (new RegExp("var GAP_MS = [^;]+;").exec(src) || [])[0];
assert.ok(GAP, "GAP_MS is not defined in the script");
const H = 3600000;

// gapWaste(prevE, prevT, now, max, secPerE, stacking) -> number | null
// null means "cannot reconstruct this gap", which must never be read as zero.
function gap({ prevE = 150, hours = 6, max = 150, secPerE = 120, stacking = false,
               logReadable = true, trainEvents = [], atkEvents = [] }) {
  const now = 100 * H;
  return new Function("var R;" + GAP + `
    var state = {
      logReadable: ${logReadable},
      trainLog: { events: ${JSON.stringify(trainEvents)} },
      attackEvents: ${JSON.stringify(atkEvents)}
    };
    ${grab("simulateWaste")}
    ${grab("gapWaste")}
    R = gapWaste(${prevE}, ${now - hours * H}, ${now}, ${max}, ${secPerE}, ${stacking});
  ` + "return R;")();
}
const at = (hoursAgo, delta) => ({ t: 100 * H - hoursAgo * H, delta });

let pass = 0, fail = 0;
const t = (n, f) => { try { f(); pass++; console.log("ok   " + n); } catch (e) { fail++; console.log("FAIL " + n + " :: " + e.message); } };

t("a gap with a training session in it counts only the real time at the cap", () => {
  // THE REPORTED CASE. Six-hour gap, bar full at the start. The old guess
  // billed all six hours (180e). The other device trained it empty an hour in.
  const r = gap({ hours: 6, trainEvents: [at(5, -150)] });
  assert.strictEqual(Math.round(r), 30);
});

t("a gap with attacks in it accounts for them too", () => {
  const r = gap({ hours: 2, atkEvents: [at(1.5, -25)] });
  assert.strictEqual(Math.round(r), 35);
});

t("a genuinely idle gap still counts in full", () => {
  // Nothing happened, the bar really did sit at the cap. Reconstructing must
  // not become an excuse to under-report a real bleed.
  assert.strictEqual(Math.round(gap({ hours: 6 })), 180);
});

t("a war stack is left alone", () => {
  assert.strictEqual(gap({ hours: 6, stacking: true }), 0);
});

t("a LIMITED key declines the gap rather than guessing it", () => {
  // Without the gym log the timeline is missing every training session, so a
  // simulation would report the bar sitting full through them -- confidently
  // wrong. null means "cannot say", and the caller books nothing.
  assert.strictEqual(gap({ hours: 6, logReadable: false }), null);
});

t("declining is not the same as zero", () => {
  // Zero would read as "you wasted nothing", which is a claim. null is not.
  assert.notStrictEqual(gap({ hours: 6, logReadable: false }), 0);
});

t("a stack held through the gap is still left alone on a Limited key", () => {
  // Suppression does not depend on the log, so this one IS answerable.
  assert.strictEqual(gap({ hours: 6, logReadable: false, stacking: true }), 0);
});

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
