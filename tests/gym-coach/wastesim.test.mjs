// Rebuilding time-at-cap from a spend timeline instead of guessing it.
//
// Today's model asks "how long since I last looked, and was the bar full at
// both ends?" and bills the gap. On one device that is a fair guess. Across
// two it is badly wrong: the PC assumes six quiet hours meant six hours at the
// cap, when the PDA emptied the bar twice in the middle of them.
//
// Given WHEN each spend happened, none of that has to be guessed. Both devices
// read the same timeline and reach the same answer.
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
const H = 3600000, MIN = 60000;
// 120s a point, 150 cap: a full bar is 5 hours of regen.
function sim({ startE, hours, events = [], max = 150, secPerE = 120 }) {
  return new Function("var R;" + `
    ${grab("simulateWaste")}
    R = simulateWaste(${startE}, 0, ${hours * H}, ${max}, ${secPerE}, ${JSON.stringify(events)});
  ` + "return R;")();
}
let pass = 0, fail = 0;
const t = (n, f) => { try { f(); pass++; console.log("ok   " + n); } catch (e) { fail++; console.log("FAIL " + n + " :: " + e.message); } };

t("a bar left full bleeds the whole window", () => {
  // 2h at the cap at 120s a point.
  assert.strictEqual(Math.round(sim({ startE: 150, hours: 2 }).wasted), 60);
});

t("a bar still climbing bleeds nothing", () => {
  // Empty bar needs 5h to fill; 4h in it is still climbing.
  assert.strictEqual(Math.round(sim({ startE: 0, hours: 4 }).wasted), 0);
});

t("it starts billing only once the bar actually fills", () => {
  // Fills at 5h, so 7h means 2h at the cap = 60e.
  assert.strictEqual(Math.round(sim({ startE: 0, hours: 7 }).wasted), 60);
});

t("a spend part-way through resets the clock, as it really would", () => {
  // THE REPORTED CASE. Full bar, 6h gap. Guessing bills all six hours (180e).
  // In reality the other device trained it to empty at the 1h mark, so only
  // that first hour was at the cap and the bar spent the rest refilling.
  const r = sim({ startE: 150, hours: 6, events: [{ t: 1 * H, delta: -150 }] });
  assert.strictEqual(Math.round(r.wasted), 30, "expected one hour of waste, got " + r.wasted);
});

t("several spends across a long gap each hold the bar off the cap", () => {
  const r = sim({ startE: 150, hours: 12, events: [
    { t: 1 * H, delta: -150 },   // empty at 1h, refills by 6h
    { t: 7 * H, delta: -150 },   // empty again at 7h (1h wasted), refills by 12h
  ]});
  assert.strictEqual(Math.round(r.wasted), 60);
});

t("attacks are too small to keep a full bar off the cap for long", () => {
  // Two hours at the cap is 60e. A single 25e hit buys back exactly its own
  // 25e of headroom (50 minutes of regen) and no more, so 35e still bleeds.
  const r = sim({ startE: 150, hours: 2, events: [{ t: 0.5 * H, delta: -25 }] });
  assert.strictEqual(Math.round(r.wasted), 35);
});

t("a stacked bar bleeds nothing, because regen is paused above the cap", () => {
  assert.strictEqual(sim({ startE: 900, hours: 10 }).wasted, 0);
});

t("a xanax mid-gap stops the bleed from that moment", () => {
  const r = sim({ startE: 150, hours: 6, events: [{ t: 1 * H, delta: 250 }] });
  assert.strictEqual(Math.round(r.wasted), 30, "only the first hour was at the cap");
});

t("spending down from a stack lands back at the cap, then bleeds", () => {
  // 400 -> spend 250 at 1h leaves exactly the cap, which then bleeds 1h.
  const r = sim({ startE: 400, hours: 2, events: [{ t: 1 * H, delta: -250 }] });
  assert.strictEqual(Math.round(r.wasted), 30);
});

t("the bar cannot go below empty", () => {
  // Spending 500 from a bar holding 50 leaves 0, not -450 -- otherwise the
  // refill would start from a debt and waste would be under-reported forever.
  const r = sim({ startE: 50, hours: 6, events: [{ t: 1, delta: -500 }] });
  assert.strictEqual(Math.round(r.wasted), 30, "should refill from 0 in 5h then bleed 1h");
});

t("an event landing exactly on the start is already in the starting reading", () => {
  // startE IS the bar at startT, so a spend stamped at that instant has either
  // already happened or is about to be seen next window. Applying it here
  // would subtract it twice.
  const withIt = sim({ startE: 150, hours: 6, events: [{ t: 0, delta: -150 }] });
  const without = sim({ startE: 150, hours: 6 });
  assert.strictEqual(withIt.wasted, without.wasted);
});

t("events outside the window are ignored", () => {
  const r = sim({ startE: 150, hours: 2, events: [
    { t: -5 * H, delta: -150 }, { t: 99 * H, delta: -150 }] });
  assert.strictEqual(Math.round(r.wasted), 60);
});

t("events arriving out of order are still applied in time order", () => {
  const r = sim({ startE: 150, hours: 12, events: [
    { t: 7 * H, delta: -150 }, { t: 1 * H, delta: -150 }] });
  assert.strictEqual(Math.round(r.wasted), 60);
});

t("nonsense in gives null, not a number", () => {
  assert.strictEqual(sim({ startE: 150, hours: 0 }), null);
  assert.strictEqual(sim({ startE: 150, hours: 2, secPerE: 0 }), null);
  assert.strictEqual(sim({ startE: 150, hours: 2, max: 0 }), null);
});

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
