// Turning the two API feeds into a spend timeline the simulator can walk.
//
// trainLogByDay() already reads the same log but totals it per day and throws
// the timestamps away, which is exactly the information a gap needs: not "how
// much was trained today" but "when did the bar get emptied".
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
const consts = (new RegExp("var ATTACK_ENERGY = [^;]+;").exec(src) || [])[0];
assert.ok(consts, "ATTACK_ENERGY missing");

const S = 1000;
const logRow = (ts, used) => ({ timestamp: ts, data: { energy_used: used } });
function trainEvents(responses) {
  return new Function("var R;" + `
    ${grab("trainLogEvents")}
    R = trainLogEvents(${JSON.stringify(responses)});
  ` + "return R;")();
}
function attackEvents(payload) {
  return new Function("var R;" + consts + `
    ${grab("attackEvents")}
    R = attackEvents(${JSON.stringify(payload)}, null);
  ` + "return R;")();
}
let pass = 0, fail = 0;
const t = (n, f) => { try { f(); pass++; console.log("ok   " + n); } catch (e) { fail++; console.log("FAIL " + n + " :: " + e.message); } };

t("a training session becomes a negative event at its own timestamp", () => {
  const r = trainEvents([{ log: { a: logRow(1000, 150) } }]);
  assert.deepStrictEqual(r, [{ t: 1000 * S, delta: -150 }]);
});

t("sessions from all four stat logs land on one timeline", () => {
  const r = trainEvents([
    { log: { a: logRow(300, 50) } },
    { log: { b: logRow(100, 20) } },
    { log: { c: logRow(200, 30) } },
  ]);
  assert.deepStrictEqual(r.map(e => e.t / S), [100, 200, 300], "not in time order");
  assert.strictEqual(r.reduce((s, e) => s + e.delta, 0), -100);
});

t("a line with no energy figure is dropped, not counted as free", () => {
  // Same rule trainLogByDay already applies: a row we cannot read is not a
  // zero-energy session, it is a row we do not understand.
  const r = trainEvents([{ log: { a: logRow(100, 0), b: { timestamp: 200 }, c: logRow(300, 10) } }]);
  assert.deepStrictEqual(r, [{ t: 300 * S, delta: -10 }]);
});

t("a failed log round contributes nothing rather than throwing", () => {
  assert.deepStrictEqual(trainEvents([{ error: { code: 5 } }, null]), []);
  assert.deepStrictEqual(trainEvents(null), []);
});

t("each attack is 25e at the moment it happened", () => {
  const r = attackEvents({ attacks: [
    { id: 1, started: 100, ended: 104, attacker: { id: 7 }, defender: { id: 9 } },
    { id: 2, started: 300, ended: 305, attacker: { id: 7 }, defender: { id: 9 } },
  ]});
  assert.deepStrictEqual(r, [{ t: 100 * S, delta: -25 }, { t: 300 * S, delta: -25 }]);
});

t("attack events are deduped the same way the count is", () => {
  const r = attackEvents({ attacks: [
    { id: 5, started: 100, attacker: { id: 7 } },
    { id: 5, started: 100, attacker: { id: 7 } },
  ]});
  assert.strictEqual(r.length, 1);
});

t("an unreadable attacks payload is an empty timeline, not a throw", () => {
  assert.deepStrictEqual(attackEvents({ error: { code: 16 } }), []);
  assert.deepStrictEqual(attackEvents(null), []);
});

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
