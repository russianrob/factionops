// Why "Spent today" crept upward on a page that was only being reloaded.
//
// Reported: 340 energy actually trained, "Spent today" reading 367 and ticking
// up by one without a train. The gym in question costs 10 energy per train, so
// 367 could not be a gym total at all -- no multiple of 10 ends in 7.
//
// Two defects, and the second is why it never corrected itself.
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
const CONST = [/var SINCE_GRACE_MS = [^;]+;/, /var TRAINLOG_TTL = [^;]+;/]
  .map(re => { const m = re.exec(src); assert.ok(m, "missing " + re); return m[0]; }).join("\n");
const call = (fns, expr) =>
  new Function("var R;" + CONST + "\n" + fns.map(grab).join("\n") + "\nR = (" + expr + "); return R;")();

let pass = 0, fail = 0;
const t = (n, f) => { try { f(); pass++; console.log("ok   " + n); } catch (e) { fail++; console.log("FAIL " + n + " :: " + e.message); } };

// ---- 1. a bar drop on gym.php is not automatically a train -----------------

const spend = (used, per) => call(["gymSpend"], `gymSpend(${used}, ${per})`);

t("a full train counts", () => {
  assert.strictEqual(spend(10, 10), 10);
  assert.strictEqual(spend(25, 25), 25);
  assert.strictEqual(spend(5, 5), 5);
});

t("several trains in one observation all count", () => {
  assert.strictEqual(spend(30, 10), 30);
});

t("a drop smaller than one train is skew, and is discarded", () => {
  // This is the reported bug. A one-energy disagreement between the API bar
  // and the DOM bar, on a page being reloaded all evening, was booked as one
  // energy trained -- every single time.
  assert.strictEqual(spend(1, 10), 0);
  assert.strictEqual(spend(9, 10), 0);
});

t("the remainder riding along with a real train is discarded too", () => {
  // Exactly how off-gym spend already treats a partial attack. 27 is two
  // trains and seven points of noise, not 27 energy of training.
  assert.strictEqual(spend(27, 10), 20);
});

t("an unknown gym cost falls back to counting the drop, rather than to zero", () => {
  // Better to over-count than to silently stop recording training entirely
  // for anyone whose gym the script has not identified.
  assert.strictEqual(spend(7, 0), 7);
  assert.strictEqual(spend(7, null), 7);
});

t("a negative or absent drop is nothing", () => {
  assert.strictEqual(spend(-5, 10), 0);
  assert.strictEqual(spend(0, 10), 0);
});

t("recording a train stamps WHEN, not just how much", () => {
  // A `since` written without a `sinceAt` can never expire, which is exactly
  // the bug. The two writes have to travel together.
  const out = call(["noteGymSpend"], `noteGymSpend({ since: 0 }, 10, 1234)`);
  assert.strictEqual(out.since, 10);
  assert.strictEqual(out.sinceAt, 1234, "an unstamped counter is carried forever");
});

t("recording adds to what is already there", () => {
  const out = call(["noteGymSpend"], `noteGymSpend({ since: 20, sinceAt: 1 }, 10, 99)`);
  assert.strictEqual(out.since, 30);
  assert.strictEqual(out.sinceAt, 99, "the clock restarts on each train");
});

t("recording nothing changes nothing", () => {
  const out = call(["noteGymSpend"], `noteGymSpend({ since: 20, sinceAt: 5 }, 0, 99)`);
  assert.strictEqual(out.since, 20);
  assert.strictEqual(out.sinceAt, 5);
});

// The per-train cost comes from the gym you are IN, and is zero when that is
// unknown -- gymFor()'s fallback is the most expensive gym in the game, and
// filtering a drop against 25 for somebody in a 5-energy gym would throw away
// four trains out of every five.
const GYMS_SRC = (() => {
  const m = /  var GYMS = \[[\s\S]*?\n  \];/.exec(src);
  assert.ok(m, "GYMS table not found");
  return m[0];
})();
const perTrain = (gymName) => new Function("var R;" + GYMS_SRC + `
  var state = { gymName: ${JSON.stringify(gymName)} };
  ${grab("perTrainEnergy")}
  R = perTrainEnergy();
  return R;`)();

t("a known gym reports what it really charges", () => {
  assert.strictEqual(perTrain("Premier Fitness"), 5);
  assert.strictEqual(perTrain("Knuckle Heads"), 10);
  assert.strictEqual(perTrain("Sports Science Lab"), 25);
});

t("an unknown gym reports zero, which means do not filter", () => {
  // NOT the table's last row. gymFor() falls back to the priciest gym in the
  // game, and using 25 as the filter width would discard up to 24 energy of
  // real training from anyone the script has not placed yet.
  assert.strictEqual(perTrain(""), 0);
  assert.strictEqual(perTrain("Some Gym That Does Not Exist"), 0);
  assert.strictEqual(perTrain(null), 0);
});

// ---- 2. the log is the authority, and the local counter has to yield -------

const NOW = 1e12;
const carried = (prev, fresh, at) =>
  call(["carriedSince"], `carriedSince(${JSON.stringify(prev)}, ${JSON.stringify(fresh)}, 1, ${at})`);

t("a train the log has not caught up with yet is still carried", () => {
  // The whole reason this exists: you trained four seconds ago and Torn's log
  // is two minutes stale. Dropping it would make the number dip and jump.
  const out = carried({ byDay: { 1: 300 }, since: 10, sinceAt: NOW - 5000 }, { 1: 300 }, NOW);
  assert.strictEqual(out, 10);
});

t("once the log has had time and still disagrees, the log wins", () => {
  // The defect. An excess that Torn's log never confirms is not a train the
  // log is behind on -- it is a local miscount, and carrying it forever is
  // what let one energy of skew survive every log round for a whole day.
  const out = carried({ byDay: { 1: 300 }, since: 27, sinceAt: NOW - 600000 }, { 1: 300 }, NOW);
  assert.strictEqual(out, 0);
});

t("and the grace window is comfortably longer than a log round", () => {
  // Shorter than the fetch interval and the figure would dip between rounds
  // on every device, which is a worse bug than the one being fixed.
  const grace = call([], "SINCE_GRACE_MS"), ttl = call([], "TRAINLOG_TTL");
  assert.ok(grace > ttl * 2, "grace " + grace + " must clear two log rounds of " + ttl);
});

t("a log that has caught up leaves nothing to carry", () => {
  assert.strictEqual(carried({ byDay: { 1: 300 }, since: 10, sinceAt: NOW - 5000 }, { 1: 310 }, NOW), 0);
});

t("a log AHEAD of the local count never produces a negative carry", () => {
  assert.strictEqual(carried({ byDay: { 1: 300 }, since: 0, sinceAt: NOW }, { 1: 340 }, NOW), 0);
});

t("no previous log means nothing to carry", () => {
  assert.strictEqual(carried(null, { 1: 300 }, NOW), 0);
});

t("an unstamped counter is still carried, so an upgrade does not lose a train", () => {
  // Devices upgrading mid-session have a `since` with no sinceAt on it.
  const out = carried({ byDay: { 1: 300 }, since: 10 }, { 1: 300 }, NOW);
  assert.strictEqual(out, 10);
});

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
