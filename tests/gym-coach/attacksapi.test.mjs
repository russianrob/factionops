// Energy spent attacking, from Torn's attack log instead of the bar.
//
// Reported: a faction member runs the coach on PC and PDA at once and both
// showed impossible figures. Each device only ever saw its OWN bar readings,
// so whenever one had been closed a while it assumed the bar had sat at the
// cap the whole time and booked the catch-up -- including hours the other
// device was actively training and attacking. Two devices, two ledgers, both
// wrong, and no way for either to know the other existed.
//
// The attack log has none of that problem: both devices ask Torn the same
// question and get the same answer.
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
const consts = ["ATTACK_ENERGY"].map(n => {
  const m = new RegExp("var " + n + " = [^;]+;").exec(src);
  assert.ok(m, n + " is not defined in the script"); return m[0];
}).join("\n");

const DAY = 86400000;
const todayKey = Math.floor(Date.now() / DAY);
const secToday = h => Math.floor((todayKey * DAY) / 1000) + h * 3600;

// readAttacksToday(payload, meId, dayStartSec) -> { n, energy } | null
function parse(payload, me = 137558) {
  return new Function("var R;" + consts + `
    ${grab("readAttacksToday")}
    R = readAttacksToday(${JSON.stringify(payload)}, ${me == null ? "null" : JSON.stringify(String(me))}, ${secToday(0)});
  ` + "return R;")();
}
const row = (id, ts, extra = {}) => Object.assign(
  { id: id, started: ts, ended: ts + 4, attacker: { id: 137558 }, defender: { id: 999 } }, extra);

let pass = 0, fail = 0;
const t = (n, f) => { try { f(); pass++; console.log("ok   " + n); } catch (e) { fail++; console.log("FAIL " + n + " :: " + e.message); } };

t("counts today's outgoing attacks at 25e each", () => {
  const r = parse({ attacks: [row(1, secToday(2)), row(2, secToday(5)), row(3, secToday(9))] });
  assert.deepStrictEqual(r, { n: 3, energy: 75 });
});

t("an empty day is zero, not unknown", () => {
  // Zero attacks is a real answer and must not fall back to the bar.
  assert.deepStrictEqual(parse({ attacks: [] }), { n: 0, energy: 0 });
});

t("yesterday's attacks are not today's", () => {
  const r = parse({ attacks: [row(1, secToday(3)), row(2, secToday(0) - 7200)] });
  assert.deepStrictEqual(r, { n: 1, energy: 25 });
});

t("incoming attacks are not energy YOU spent", () => {
  // The endpoint returns both directions unless filtered. Someone attacking
  // you costs you no energy, and counting it would invent spend.
  const r = parse({ attacks: [
    row(1, secToday(2)),
    row(2, secToday(3), { attacker: { id: 999 }, defender: { id: 137558 } }),
  ]});
  assert.deepStrictEqual(r, { n: 1, energy: 25 });
});

t("a stealthed attack has no attacker id but is still yours", () => {
  // Torn hides the attacker on a stealth attack. Dropping those would
  // under-count exactly the hits a war-time player makes most of.
  const r = parse({ attacks: [row(1, secToday(2), { attacker: null })] });
  assert.deepStrictEqual(r, { n: 1, energy: 25 });
});

t("the same attack seen twice is counted once", () => {
  // Pagination overlaps at the boundary; ids are what make it safe.
  const r = parse({ attacks: [row(7, secToday(2)), row(7, secToday(2)), row(8, secToday(3))] });
  assert.deepStrictEqual(r, { n: 2, energy: 50 });
});

t("with no id known, it trusts the outgoing filter rather than dropping everything", () => {
  // The request asks for filters=outgoing, so every row IS yours. If the id
  // has not landed yet, counting nothing would report 0e on a day full of
  // attacks -- a wrong answer dressed as a real one.
  const r = parse({ attacks: [row(1, secToday(2), { attacker: null }), row(2, secToday(3))] }, null);
  assert.deepStrictEqual(r, { n: 2, energy: 50 });
});

t("an error payload is unknown, NOT zero", () => {
  // Zero would silently replace a real figure with a wrong one. Unknown lets
  // the card fall back and say where its number came from.
  assert.strictEqual(parse({ error: { code: 16, error: "Access level" } }), null);
  assert.strictEqual(parse({}), null);
});

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
