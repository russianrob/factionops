import fs from "fs";
import assert from "assert";
const src = fs.readFileSync("gym-coach-beta.user.js", "utf8");
function grab(name) {
  const i = src.indexOf("function " + name + "(");
  let d = 0, j = src.indexOf("{", i);
  for (let k = j; k < src.length; k++) { if (src[k]==="{") d++; else if (src[k]==="}") { d--; if(!d) return src.slice(i,k+1); } }
}
const ledgerDelta = new Function("return " + grab("ledgerDelta"))();

let pass = 0, fail = 0;
const t = (n, f) => { try { f(); pass++; console.log("ok   " + n); } catch (e) { fail++; console.log("FAIL " + n + " :: " + e.message); } };
const HOUR = 3600e3, R = 180; // Torn: 5 energy per 15 min = 180s per point

t("two hours parked at 150/150 = the regen you missed", () => {
  const d = ledgerDelta(150, 0, 150, 2 * HOUR, 150, R);
  assert.strictEqual(Math.round(d.wasted), 40, "2h / 180s = 40e, got " + d.wasted);
  assert.strictEqual(d.used, 0);
});
t("a bar that is still filling wastes nothing", () => {
  const d = ledgerDelta(30, 0, 90, 3 * HOUR, 150, R);
  assert.strictEqual(d.wasted, 0);
  assert.strictEqual(d.used, 0);
});
t("only the time AFTER the bar filled counts as waste", () => {
  // starts at 130 -> needs 20*180s = 1h to fill, then 1h wasted = 20e
  const d = ledgerDelta(130, 0, 150, 2 * HOUR, 150, R);
  assert.strictEqual(Math.round(d.wasted), 20, "got " + d.wasted);
});
t("training is counted as spent, not wasted", () => {
  // 150 -> 30 over ten minutes. The bar is 120 lower, and 3 whole points of
  // regen landed in those ten minutes (the fourth had not), so 123 left it.
  // Floored for the same reason missed energy is: a third of a point has not
  // arrived. Counting the fraction is what booked 26e of spend against a bar
  // that only regenerated.
  const d = ledgerDelta(150, 0, 30, 10 * 60e3, 150, R);
  assert.strictEqual(d.used, 123, "got " + d.used);
  assert.strictEqual(d.wasted, 0, "bar was emptied, so nothing overflowed");
});
t("a session is not shrunk by the energy that refilled behind it", () => {
  // Trained the bar away three hours ago and the bar has climbed back to 50.
  // Measuring the drop alone says 100 spent; 150 actually left the bar, and the
  // other 50 is regen that arrived afterwards.
  const d = ledgerDelta(150, 0, 50, 3 * HOUR, 150, 30);
  assert.strictEqual(Math.round(d.used), 150, "lost the refill: " + d.used);
});
t("energy that arrived and left again still counts as spent", () => {
  // Ends 10 HIGHER than it started, so a raw drop says nothing was spent — but
  // 20 points of regen arrived and only 10 of them are still in the bar.
  const d = ledgerDelta(100, 0, 110, HOUR, 150, R);
  assert.strictEqual(Math.round(d.used), 10, "got " + d.used);
});
t("regen you never received is not counted as spent either", () => {
  // Two hours parked at the cap: nothing came in, nothing went out.
  const d = ledgerDelta(150, 0, 150, 2 * HOUR, 150, R);
  assert.strictEqual(d.used, 0);
});
t("banking above the cap is NOT counted as missed", () => {
  // 194/150 after a xanax. Regen is paused, but that is the price of banking,
  // not energy you let slip — and calling it waste made stockpiling look bad.
  const d = ledgerDelta(194, 0, 194, HOUR, 150, R);
  assert.strictEqual(d.wasted, 0, "counted banked energy as missed: " + d.wasted);
});
t("drinking ten cans past the cap books no waste at all", () => {
  // 40 -> 290 over a minute: the reported case
  const d = ledgerDelta(40, 0, 290, 60e3, 150, R);
  assert.strictEqual(d.wasted, 0, "got " + d.wasted);
  assert.strictEqual(d.used, 0, "gaining energy is not spending");
});
t("working down through banked energy books no waste either", () => {
  const d = ledgerDelta(290, 0, 160, 2 * HOUR, 150, R);
  assert.strictEqual(d.wasted, 0, "penalised you for using what you banked");
  assert.strictEqual(d.used, 130);
});
t("training banked energy down TO the cap is not waste either", () => {
  // 290 -> exactly 150 over two hours. The window ends at the cap, so a rule
  // that only looks at where it ended would book the whole two hours.
  const d = ledgerDelta(290, 0, 150, 2 * HOUR, 150, R);
  assert.strictEqual(d.wasted, 0, "counted " + d.wasted + "e while you were spending it");
  assert.strictEqual(d.used, 140);
});
t("but a bar sitting AT the cap still counts, which is the whole point", () => {
  const d = ledgerDelta(150, 0, 150, 2 * HOUR, 150, R);
  assert.strictEqual(Math.round(d.wasted), 40, "got " + d.wasted);
});
t("a can drunk below the cap is not negative spending", () => {
  // 40 -> 140 in a minute, still under the cap. The balance says -99.67 left
  // the bar, which unclamped would SUBTRACT a hundred from the day's total.
  const d = ledgerDelta(40, 0, 140, 60e3, 150, R);
  assert.strictEqual(d.used, 0, "got " + d.used);
  assert.strictEqual(d.wasted, 0);
});
t("a xanax mid-window is not counted as spending", () => {
  const d = ledgerDelta(40, 0, 290, 60e3, 150, R);
  assert.strictEqual(d.used, 0);
});
t("a full bar you came back to AFTER training still counts the hours it sat", () => {
  // The reported case: full at 09:00, trained at 11:35, panel reopened at 12:00.
  // The window ends BELOW the cap because the bar has started refilling, and a
  // rule that only books waste when the window ENDS at the cap threw away the
  // whole three hours. 30s a point here, matching a perked bar.
  const d = ledgerDelta(150, 0, 50, 3 * HOUR, 150, 30);
  // 3h elapsed, minus the 25 min the bar spent climbing back to 50 = 2h35m capped
  assert.strictEqual(Math.round(d.wasted), 310, "lost the capped hours: " + d.wasted);
});
t("the refill after training is time the bar was NOT wasting", () => {
  // Same three hours, but they trained much earlier and the bar is nearly full
  // again — so far less of the window was spent at the cap.
  const d = ledgerDelta(150, 0, 140, 3 * HOUR, 150, 30);
  assert.strictEqual(Math.round(d.wasted), 220, "got " + d.wasted);
});
t("training that empties the bar right at the end wastes nothing new", () => {
  // Ten minutes, spent to 30. The bar cannot have been idling at the cap for
  // long enough to matter, so this must stay zero.
  const d = ledgerDelta(150, 0, 30, 10 * 60e3, 150, R);
  assert.strictEqual(d.wasted, 0, "got " + d.wasted);
});
t("a short gap with a spend and no cap time books no waste", () => {
  const d = ledgerDelta(100, 0, 50, 60e3, 150, R);
  assert.strictEqual(d.wasted, 0, "got " + d.wasted);
  // 60s at 180s/point is a third of a point, which has not landed yet, so the
  // spend is the raw drop.
  assert.strictEqual(d.used, 50, "got " + d.used);
});
t("an eight-hour sleep at full bar is caught, not missed", () => {
  const d = ledgerDelta(150, 0, 150, 8 * HOUR, 150, R);
  assert.strictEqual(Math.round(d.wasted), 160);
});
t("absurd gaps are clamped so a clock change cannot invent thousands", () => {
  const d = ledgerDelta(150, 0, 150, 30 * 24 * HOUR, 150, R);
  assert.strictEqual(Math.round(d.wasted), Math.round(48 * HOUR / 1000 / R), "should clamp at 48h");
});
t("zero or negative elapsed yields nothing", () => {
  assert.deepStrictEqual(ledgerDelta(150, 5000, 150, 5000, 150, R), { used: 0, wasted: 0 });
  assert.deepStrictEqual(ledgerDelta(150, 9000, 150, 1000, 150, R), { used: 0, wasted: 0 });
});
t("an unknown regen rate yields nothing rather than nonsense", () => {
  assert.deepStrictEqual(ledgerDelta(150, 0, 150, HOUR, 150, 0), { used: 0, wasted: 0 });
});
t("the rate scales the answer — a faster bar wastes more", () => {
  const slow = ledgerDelta(150, 0, 150, HOUR, 150, 180).wasted;
  const fast = ledgerDelta(150, 0, 150, HOUR, 150, 90).wasted;
  assert.ok(fast > slow * 1.9, "half the seconds per point should roughly double the waste");
});

t("a fill time we predicted beats one inferred from the rate", () => {
  // Closed the app at 70/150; the bar was due to fill 39 min ago and did. The
  // inferred fill from a stale 180s rate would be 80*180 = 4h, longer than the
  // whole window, so the waste would come out as nothing.
  const now = 40 * 60e3, fullAt = 1 * 60e3;   // filled one minute in
  const d = ledgerDelta(70, 0, 150, now, 150, 30, fullAt);
  assert.strictEqual(Math.round(d.wasted), Math.round((now - fullAt) / 1000 / 30),
    "should count from the moment it filled: " + d.wasted);
  assert.strictEqual(Math.round(d.wasted), 78);
});
t("without a prediction it still infers, so old state keeps working", () => {
  const d = ledgerDelta(70, 0, 150, 40 * 60e3, 150, 30);
  // 80 points at 30s = 2400s to fill, and the window is 2400s — it only just filled
  assert.strictEqual(Math.round(d.wasted), 0, "got " + d.wasted);
});
t("a prediction outside the window is ignored rather than trusted", () => {
  const late = ledgerDelta(70, 0, 150, 40 * 60e3, 150, 30, 99 * 60e3);   // after the window
  const early = ledgerDelta(70, 0, 150, 40 * 60e3, 150, 30, -5 * 60e3);  // before it
  assert.strictEqual(Math.round(late.wasted), 0);
  assert.strictEqual(Math.round(early.wasted), 0);
});
t("the prediction cannot invent waste on a bar that never filled", () => {
  const d = ledgerDelta(70, 0, 120, 40 * 60e3, 150, 30, 1 * 60e3);
  assert.strictEqual(d.wasted, 0, "bar ended below the cap: " + d.wasted);
});

const missed = new Function("return " + (() => {
  const i = src.indexOf("function missed(");
  let d = 0, j = src.indexOf("{", i);
  for (let k = j; k < src.length; k++) { if (src[k]==="{") d++; else if (src[k]==="}") { d--; if(!d) return src.slice(i,k+1); } }
})())();

t("a part-point at the cap is not claimed as a whole one", () => {
  // 90s at cap is 0.5e — reported as 1e before, which looked like a mistake
  assert.strictEqual(missed(0.5), 0);
  assert.strictEqual(missed(0.99), 0);
  assert.strictEqual(missed(ledgerDelta(150, 0, 150, 90e3, 150, R).wasted), 0);
});
t("a whole point missed is still reported", () => {
  assert.strictEqual(missed(1.0), 1);
  assert.strictEqual(missed(1.9), 1);
  assert.strictEqual(missed(ledgerDelta(150, 0, 150, 3 * 60e3, 150, R).wasted), 1);
  assert.strictEqual(missed(ledgerDelta(150, 0, 150, 2 * HOUR, 150, R).wasted), 40);
});
t("missed never goes negative", () => {
  assert.strictEqual(missed(-5), 0);
  assert.strictEqual(missed(undefined), 0);
});
// ---- a bar that only regenerates has spent nothing -------------------------
// Reported: "Spent today 26e -- I didn't spend any energy training today."
// The bar reports WHOLE points while absorbed accrues smoothly, so between
// ticks nowE === prevE and `prevE + absorbed - nowE` books the fraction as
// spend. The tick never cancels it. Invisible on a training day (26e beside
// 1,500e), glaring on a day with no training -- and it inflates the `used`
// that calibration().usage is built from, making every ETA optimistic.

t("polling a rising bar does not invent spend", () => {
  const secPerE = 120, max = 150, startE = 12;
  let prevE = startE, prevT = 0, used = 0;
  for (let sec = 5; sec <= 75 * 60; sec += 5) {
    const nowE = Math.min(max, Math.floor(startE + sec / secPerE));  // whole points
    const d = ledgerDelta(prevE, prevT * 1000, nowE, sec * 1000, max, secPerE);
    used += d.used;
    prevE = nowE; prevT = sec;
  }
  assert.ok(used < 1, "booked " + used.toFixed(1) + "e of spend against pure regen");
});

t("the poll interval does not change what a quiet bar reports", () => {
  // 19e at 60s polls against 37e at 1s was the tell: a real figure would not
  // depend on how often the panel happened to look.
  const run = pollSec => {
    const secPerE = 120, max = 150, startE = 12;
    let prevE = startE, prevT = 0, used = 0;
    for (let sec = pollSec; sec <= 75 * 60; sec += pollSec) {
      const nowE = Math.min(max, Math.floor(startE + sec / secPerE));
      used += ledgerDelta(prevE, prevT * 1000, nowE, sec * 1000, max, secPerE).used;
      prevE = nowE; prevT = sec;
    }
    return used;
  };
  assert.ok(Math.abs(run(1) - run(60)) < 1,
    "1s polls read " + run(1).toFixed(1) + "e, 60s polls " + run(60).toFixed(1) + "e");
});

t("a real spend is still counted in full", () => {
  // 150e trained away, seen ten minutes later with five points regenerated.
  const d = ledgerDelta(150, 0, 5, 10 * 60e3, 150, 120);
  assert.strictEqual(Math.round(d.used), 150, "got " + d.used);
});

t("regen that landed behind a spend is still recovered", () => {
  // The case the balance maths exists for: train the bar away, come back an
  // hour later. The raw drop alone would lose the hour of regen.
  const d = ledgerDelta(150, 0, 30, 60 * 60e3, 150, 120);
  assert.ok(d.used > 140, "lost the regen behind the spend: " + d.used);
});

// ---- war stack -------------------------------------------------------------
// While war stack is on the coach itself says "Leave energy alone. Don't
// train." Booking every second of obeying as waste drags calibration().usage
// toward its 0.3 floor, and goalPlan() multiplies every ETA by that -- so one
// war left the whole plan pessimistic for the fourteen days AFTER it ended.

t("war stack: a bar held at cap is stored energy, not waste", () => {
  const d = ledgerDelta(150, 0, 150, 2 * HOUR, 150, R, 0, true);
  assert.strictEqual(d.wasted, 0, "booked " + d.wasted + "e against a deliberate hold");
});

t("war stack still records what you actually spend", () => {
  // Holding does not mean idle -- the stack gets dumped into attacks, and that
  // energy really did leave the bar.
  const d = ledgerDelta(150, 0, 30, 10 * 60e3, 150, R, 0, true);
  assert.ok(d.used > 120, "spend was swallowed along with the waste: " + d.used);
});

t("war stack changes what the cap time is CALLED, not the physics", () => {
  // The trap: `used` is derived by subtracting the un-landed regen from the
  // window. Zeroing the waste outright hands that regen back as spend, so a
  // bar held at cap and then dumped reads as 180e trained when 150e left it.
  const on  = ledgerDelta(150, 0, 30, 3 * HOUR, 150, R, 0, true);
  const off = ledgerDelta(150, 0, 30, 3 * HOUR, 150, R, 0, false);
  assert.strictEqual(Math.round(on.used), Math.round(off.used),
    "spend moved when the label changed: " + on.used + " against " + off.used);
  assert.strictEqual(Math.round(on.used), 150, "got " + on.used);
});

t("turning war stack off restores ordinary waste accounting", () => {
  const off = ledgerDelta(150, 0, 150, 2 * HOUR, 150, R, 0, false);
  assert.strictEqual(Math.round(off.wasted), 40, "got " + off.wasted);
});

t("the flag defaults to off, so nothing changes for existing callers", () => {
  const d = ledgerDelta(150, 0, 150, 2 * HOUR, 150, R);
  assert.strictEqual(Math.round(d.wasted), 40, "got " + d.wasted);
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
