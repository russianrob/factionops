// Calibration on a day you trained more than one stat.
//
// The rule used to be: exactly one stat may move, or the day is discarded --
// "two stats moving means the day's energy was split in a ratio nothing
// recorded". Reported by a user sitting at 1/7 after a week of alternating
// defense and speed, which is a perfectly normal way to train.
//
// But something DID record the ratio. Torn's gym log is fetched once per stat,
// so the per-stat energy is already in the response; trainLogByDay was simply
// summing it and throwing the stat away.
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
const CONST = [/var MIXED_SLACK = [^;]+;/]
  .map(re => { const m = re.exec(src); assert.ok(m, "missing " + re); return m[0]; }).join("\n");
const call = (fns, pre, expr) =>
  new Function("var R;var DAY_MS = 86400000;" + CONST + (pre || "") + "\n" + fns.map(grab).join("\n") +
               "\nR = (" + expr + "); return R;")();

let pass = 0, fail = 0;
const t = (n, f) => { try { f(); pass++; console.log("ok   " + n); } catch (e) { fail++; console.log("FAIL " + n + " :: " + e.message); } };

// Torn's own row titles. One response per stat, in TRAINLOG_IDS order.
const row = (title, ts, used) => ({ timestamp: ts, title: title, data: { energy_used: used } });
const resp = (title, rows) => ({ log: rows.reduce((o, r, i) => (o["h" + title + i] = r, o), {}) });
const DAY = 86400000, D = 20000, TS = d => Math.floor((d * DAY) / 1000) + 3600;

// ---- which stat a log row is about ----------------------------------------

const statOf = (title, idx) =>
  call(["trainStatFromLogRow"], "", `trainStatFromLogRow(${JSON.stringify({ title })}, ${idx})`);

t("the stat is read from Torn's own words for that row", () => {
  assert.strictEqual(statOf("Gym train strength", 99), "str");
  assert.strictEqual(statOf("Gym train defense", 99), "def");
  assert.strictEqual(statOf("Gym train speed", 99), "spe");
  assert.strictEqual(statOf("Gym train dexterity", 99), "dex");
});

t("wording is matched case-insensitively and loosely", () => {
  assert.strictEqual(statOf("GYM TRAIN STRENGTH", 99), "str");
  assert.strictEqual(statOf("Gym Train Defence", 99), "def", "the British spelling has to work too");
});

t("a row Torn words differently yields null, NOT a guess", () => {
  // A wrong stat is worse than no stat: it would attribute a day's energy to
  // something that never moved and calibrate against fiction. Null means the
  // day falls back to the one-stat rule, which is exactly today's behaviour.
  assert.strictEqual(statOf("Something else entirely", 99), null);
  assert.strictEqual(statOf("", 99), null);
  assert.strictEqual(statOf(null, 99), null);
});

// ---- per-stat energy per day ----------------------------------------------

const byDayStat = (responses) =>
  call(["trainStatFromLogRow", "dayKey", "trainLogByDayStat"], "", `trainLogByDayStat(${JSON.stringify(responses)})`);

t("a single-stat day attributes all its energy to that stat", () => {
  const out = byDayStat([resp("s", [row("Gym train strength", TS(D), 400)])]);
  assert.deepStrictEqual(out[D], { str: 400 });
});

t("a mixed day splits the energy the way it actually happened", () => {
  // The whole point. 250 into defense and 150 into speed is a ratio nothing
  // had to guess -- Torn wrote it down.
  const out = byDayStat([
    resp("d", [row("Gym train defense", TS(D), 250)]),
    resp("p", [row("Gym train speed", TS(D), 150)])
  ]);
  assert.deepStrictEqual(out[D], { def: 250, spe: 150 });
});

t("several sessions on the same stat and day add up", () => {
  const out = byDayStat([resp("s", [row("Gym train strength", TS(D), 100), row("Gym train strength", TS(D) + 60, 300)])]);
  assert.deepStrictEqual(out[D], { str: 400 });
});

t("days are kept apart", () => {
  const out = byDayStat([resp("s", [row("Gym train strength", TS(D), 100), row("Gym train strength", TS(D - 1), 300)])]);
  assert.deepStrictEqual(out[D], { str: 100 });
  assert.deepStrictEqual(out[D - 1], { str: 300 });
});

t("a row whose stat cannot be read is left out rather than misfiled", () => {
  const out = byDayStat([resp("x", [row("Gym train strength", TS(D), 100), row("Mystery line", TS(D), 999)])]);
  assert.deepStrictEqual(out[D], { str: 100 });
});

t("a row with no energy figure is not a free session", () => {
  // A missing field, not a zero one: zero adds zero either way, so a fixture
  // built on it cannot tell whether the guard is there at all. An absent
  // energy_used is Number(undefined) = NaN, which poisons the whole day.
  const out = byDayStat([resp("s", [
    { timestamp: TS(D), title: "Gym train strength", data: {} },
    row("Gym train strength", TS(D), 50)
  ])]);
  assert.deepStrictEqual(out[D], { str: 50 });
});

t("a row with no timestamp is dropped rather than filed under 1970", () => {
  const out = byDayStat([resp("s", [
    { timestamp: 0, title: "Gym train strength", data: { energy_used: 400 } },
    row("Gym train strength", TS(D), 50)
  ])]);
  assert.deepStrictEqual(out, { [D]: { str: 50 } });
});

t("nothing in means an empty map, not a crash", () => {
  assert.deepStrictEqual(byDayStat([]), {});
  assert.deepStrictEqual(byDayStat(null), {});
});

// ---- is a mixed day safe to calibrate against? ----------------------------

const usable = (split, moved, used) =>
  call(["mixedDayEnergy"], "", `mixedDayEnergy(${JSON.stringify(split)}, ${JSON.stringify(moved)}, ${used})`);

t("a mixed day whose log covers every stat that moved is usable", () => {
  assert.deepStrictEqual(usable({ def: 250, spe: 150 }, ["def", "spe"], 400), { def: 250, spe: 150 });
});

t("a stat that moved with no logged energy makes the day unusable", () => {
  // The gain came from somewhere the log cannot see, so any split would be
  // invented. Skipping is what the old rule did, and it was right to.
  assert.strictEqual(usable({ def: 400 }, ["def", "spe"], 400), null);
});

t("a split ten times the day's energy is rejected, not merely a tiny one", () => {
  // Each half of this is a perfectly plausible amount of training on its own,
  // so nothing downstream would notice -- the only thing that catches it is
  // the totals not matching.
  assert.strictEqual(usable({ def: 500, spe: 500 }, ["def", "spe"], 100), null);
});

t("a log that disagrees with the day's recorded energy makes it unusable", () => {
  // If the two records of the same day do not add up, one of them is wrong and
  // guessing which is not a measurement.
  assert.strictEqual(usable({ def: 250, spe: 150 }, ["def", "spe"], 900), null);
});

t("a small disagreement is tolerated, because the bar and the log round differently", () => {
  assert.deepStrictEqual(usable({ def: 250, spe: 150 }, ["def", "spe"], 404), { def: 250, spe: 150 });
});

t("the slack is a handful of energy, not a licence", () => {
  // Asserted as a literal on purpose: every other test here derives its inputs
  // from this constant, so a slack of 10,000 would agree with itself while
  // waving through days whose two records do not describe the same day at all.
  const slack = call([], "", "MIXED_SLACK");
  assert.ok(slack > 0 && slack <= 50, "implausible slack: " + slack);
  assert.strictEqual(usable({ def: 250, spe: 150 }, ["def", "spe"], 400 + slack + 1), null,
    "just past the slack must be rejected");
  assert.deepStrictEqual(usable({ def: 250, spe: 150 }, ["def", "spe"], 400 + slack), { def: 250, spe: 150 },
    "exactly at the slack must be accepted");
});

t("energy logged against a stat that did NOT move makes the day unusable", () => {
  // Training a stat and gaining nothing measurable means the gain is below one
  // whole point, and the energy that bought it cannot be told apart from the
  // energy that bought the visible gains.
  assert.strictEqual(usable({ def: 250, spe: 150, str: 100 }, ["def", "spe"], 500), null);
});

t("no split for that day at all leaves the day to the old rule", () => {
  assert.strictEqual(usable(null, ["def", "spe"], 400), null);
  assert.strictEqual(usable({}, ["def", "spe"], 400), null);
});

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
