// The regen rate, read rather than inferred.
//
// Every missed-energy figure is a multiplication by seconds-per-energy, so the
// rate is load-bearing. The script derived it as fulltime / (max - current),
// which has two holes: a FULL bar reports fulltime 0 and can supply no rate at
// all — the cold-start-on-a-full-bar case that fell back to Torn's 180s base
// and read 13e where the honest answer was 19e — and the quotient of two
// integers drifts a little even when it does work.
//
// Torn's own bars payload carries the rate outright, and carries it on a full
// bar too:
//
//   energy: { current:100, maximum:150, increment:5, interval:600,
//             ticktime:583, fulltime:5983 }
//
// interval / increment = 120s a point, exactly. Measured live 2026-09-08.
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

const rate = new Function("return " + grab("secPerEnergyFrom"))();

let pass = 0, fail = 0;
const t = (n, f) => { try { f(); pass++; console.log("ok   " + n); } catch (e) { fail++; console.log("FAIL " + n + " :: " + e.message); } };

t("a donator's bar reads exactly 120 seconds a point", () => {
  // The live payload, verbatim.
  assert.strictEqual(rate({ current: 100, maximum: 150, increment: 5, interval: 600, fulltime: 5983 }), 120);
});

t("a non-donator's bar reads exactly 180", () => {
  assert.strictEqual(rate({ current: 50, maximum: 100, increment: 5, interval: 900, fulltime: 9000 }), 180);
});

t("a FULL bar still gives the rate — the whole point", () => {
  // fulltime is 0 here, so the old derivation had nothing to work with and the
  // script fell back to 180 regardless of what the bar actually does.
  assert.strictEqual(rate({ current: 150, maximum: 150, increment: 5, interval: 600, fulltime: 0 }), 120);
});

t("increment and interval beat the fulltime quotient when both are present", () => {
  // fulltime/gap would say 119.66 here; the tick fields say 120 and are right.
  const r = rate({ current: 100, maximum: 150, increment: 5, interval: 600, fulltime: 5983 });
  assert.strictEqual(r, 120, "the exact rate must win over the rounded one");
});

t("without the tick fields it falls back to the fulltime derivation", () => {
  // 50 points to go in 6000s is 120 a point.
  assert.strictEqual(rate({ current: 100, maximum: 150, fulltime: 6000 }), 120);
});

t("a full bar with no tick fields supplies nothing rather than a wrong number", () => {
  assert.strictEqual(rate({ current: 150, maximum: 150, fulltime: 0 }), 0);
});

t("junk supplies nothing", () => {
  assert.strictEqual(rate(null), 0);
  assert.strictEqual(rate({}), 0);
  assert.strictEqual(rate({ increment: 0, interval: 600 }), 0);
  assert.strictEqual(rate({ increment: 5, interval: 0 }), 0);
});

t("the reader is wired in, and the old derivation is still the fallback", () => {
  // The CALL site, not the definition: searching from the first occurrence just
  // finds the function's own body.
  const def = src.indexOf("function secPerEnergyFrom(");
  const call = src.indexOf("secPerEnergyFrom(e)", def + 10);
  assert.ok(call !== -1, "nothing calls the reader on a bars payload");
  const near = src.slice(call, call + 700);
  assert.ok(/state\.energySecPerE = exact/.test(near), "the exact rate is never stored");
  assert.ok(/storeSet\("energySecPerE", exact\)/.test(near),
    "the rate must still be persisted for a cold start that opens on a full bar");
  assert.ok(/!\(exact > 0\) && eGap > 0/.test(near),
    "the fulltime derivation must remain as the fallback, and only as the fallback");
});

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
