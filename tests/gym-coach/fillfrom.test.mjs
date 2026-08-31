// Dating a full bar the script never watched fill.
//
// Reported twice: bar at 150/150 on opening the app, no banner. The coach had
// no armed fill-prediction -- the app was closed before the bar began its last
// climb -- so it had no idea how long the bar had been sitting and said
// nothing, which was the right call when the ledger was all it had.
//
// It is not all it has any more. The train log and the attack log both carry
// timestamps, so the last time energy LEFT the bar is known, and the bar
// cannot have filled before it refilled from there.
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
const H = 3600000, now = 1e12;
// fillFromLastSpend(events, max, secPerE, now) -> ms timestamp, or 0
const fill = (events, max = 150, rate = 120) => new Function("var R;" + `
  ${grab("fillFromLastSpend")}
  R = fillFromLastSpend(${JSON.stringify(events)}, ${max}, ${rate}, ${now});
` + "return R;")();

let pass = 0, fail = 0;
const t = (n, f) => { try { f(); pass++; console.log("ok   " + n); } catch (e) { fail++; console.log("FAIL " + n + " :: " + e.message); } };

t("a bar is dated from the last time energy left it", () => {
  // Trained 8h ago on a 150 bar at 120s a point: five hours to refill, so it
  // has been sitting full for three.
  const at = fill([{ t: now - 8 * H, delta: -400 }]);
  assert.strictEqual(Math.round((now - at) / H), 3);
});

t("the estimate assumes the spend emptied the bar, so it UNDER-reports", () => {
  // The same reading ledgerDelta already takes. Spending less than the whole
  // bar means it filled sooner and the real streak is longer -- erring that
  // way keeps this a floor rather than an invention.
  const at = fill([{ t: now - 8 * H, delta: -25 }]);
  assert.strictEqual(Math.round((now - at) / H), 3, "a small spend should be dated the same conservative way");
});

t("the LAST spend is the one that counts, not the first", () => {
  const at = fill([{ t: now - 30 * H, delta: -400 }, { t: now - 8 * H, delta: -150 }]);
  assert.strictEqual(Math.round((now - at) / H), 3);
});

t("a bar that cannot have refilled yet is not claimed as full", () => {
  // Trained an hour ago: five hours of refilling still to go, so there is no
  // full-bar streak to report and saying otherwise would be a fiction.
  assert.strictEqual(fill([{ t: now - 1 * H, delta: -150 }]), 0);
});

t("gains are not spends -- a xanax does not date the bar", () => {
  assert.strictEqual(fill([{ t: now - 8 * H, delta: 250 }]), 0);
});

t("no timeline means no estimate, which is the old behaviour", () => {
  assert.strictEqual(fill([]), 0);
  assert.strictEqual(fill(null), 0);
});

t("nonsense inputs do not produce a timestamp", () => {
  assert.strictEqual(fill([{ t: now - 8 * H, delta: -150 }], 0, 120), 0);
  assert.strictEqual(fill([{ t: now - 8 * H, delta: -150 }], 150, 0), 0);
});

// --- capStreak actually using it ------------------------------------------
const streak = (lastSeen, events, logReadable = true) => new Function("var R;" + `
  var state = { energy: 150, energyMax: 150, energyKnown: true,
                logReadable: ${JSON.stringify(logReadable)},
                lastSeen: ${JSON.stringify(lastSeen)},
                trainLog: { events: ${JSON.stringify(events)} }, attackEvents: [] };
  function energyRate() { return 120; }
  ${grab("fillFromLastSpend")} ${grab("capStreak")}
  var s = capStreak();
  R = s ? Math.round(s.sec / 3600) : null;
` + "return R;")();
const N = Date.now();

t("a bar the script never watched fill is now dated, not ignored", () => {
  // The reported case: app closed on a low bar, opened to a full one.
  const before = streak({ e: 40, t: N - 8 * H, capSince: 0, fullAt: 0 }, []);
  assert.strictEqual(before, null, "precondition: with no timeline it stays silent");
  const after = streak({ e: 40, t: N - 8 * H, capSince: 0, fullAt: 0 },
                       [{ t: N - 8 * H, delta: -400 }]);
  assert.strictEqual(after, 3, "the 8h-old session should date the bar to 3h full");
});

t("the estimate reaches back PAST what was observed", () => {
  // capSince is only "when we first looked", not when it filled. An estimate
  // that predates it is the better answer, which is how the armed prediction
  // has always been treated too.
  const r = streak({ e: 150, t: N - 1 * H, capSince: N - 1 * H, fullAt: 0 },
                   [{ t: N - 8 * H, delta: -400 }]);
  assert.strictEqual(r, 3, "the observation was not extended by the estimate");
});

t("but it never SHORTENS a streak already known", () => {
  // A recent spend cannot un-fill a bar we watched fill long ago.
  const r = streak({ e: 150, t: N - 9 * H, capSince: N - 9 * H, fullAt: 0 },
                   [{ t: N - 6 * H, delta: -400 }]);
  assert.strictEqual(r, 9, "a later estimate overrode a longer observed streak");
});

t("an INCOMPLETE timeline is not used to date the bar", () => {
  // 0.9.40 shipped this wrong and it put a false number on screen. The floor
  // argument -- the estimate can only date the fill LATER than reality --
  // holds only if every spend is visible. On a Limited key the gym log is
  // refused, so training is invisible and only attacks remain: an attack nine
  // hours ago dates the bar to four hours full when the user emptied it by
  // training one hour ago. Reported as "Bar full 240m", which was fiction.
  const withLog = streak({ e: 40, t: N - 9 * H, capSince: 0, fullAt: 0 },
                         [{ t: N - 9 * H, delta: -400 }], true);
  assert.strictEqual(withLog, 4, "a complete timeline should still date it");
  const withoutLog = streak({ e: 40, t: N - 9 * H, capSince: 0, fullAt: 0 },
                            [{ t: N - 9 * H, delta: -400 }], false);
  assert.strictEqual(withoutLog, null,
    "dated the bar from a timeline that cannot see training: got " + withoutLog);
});

t("an unknown log state is not treated as a complete timeline either", () => {
  // null means the log has not answered yet. Guessing before it does is how a
  // wrong number reaches the screen in the first second of a page load.
  assert.strictEqual(streak({ e: 40, t: N - 9 * H, capSince: 0, fullAt: 0 },
                            [{ t: N - 9 * H, delta: -400 }], null), null);
});

t("an OBSERVED streak still works without the log", () => {
  // The estimate is what needs a complete timeline. Watching the bar yourself
  // does not, so a Limited key keeps everything it had before 0.9.40.
  assert.strictEqual(streak({ e: 150, t: N - 6 * H, capSince: N - 6 * H, fullAt: 0 }, [], false), 6);
});

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
