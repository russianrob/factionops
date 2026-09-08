// Specialist gyms close behind you.
//
// Every one of the six is CONDITIONAL: access is granted by a stat ratio and
// withdrawn the moment the ratio stops holding. Balboas wants
// Def+Dex >= 1.25 x (Str+Spd); the four single-stat gyms want their stat at
// 1.25x the second-highest. Train the wrong thing for long enough and the door
// shuts — which is exactly what happened to the owner: the plan scheduled its
// way out of range, then told him to train Defense at a gym that had closed.
//
// So the planner needs a cap it did not have. These tests pin the arithmetic
// of that cap, because getting it wrong in the safe direction wastes weeks of
// training and getting it wrong in the other locks a gym nobody noticed losing.
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

// Pulled from source, never restated here: a test that declares its own copy
// of the ratio passes happily after somebody edits the real one.
const DATA = [/var SPECIALIST_RATIO = [^;]+;/, /var SPECIALIST_GYMS = \[[\s\S]*?\];/];
const consts = DATA.map((re) => {
  const m = src.match(re);
  assert.ok(m, "missing in source: " + re);
  return m[0];
}).join("\n");

const sandbox = new Function(
  consts + "\n" + grab("specialistGym") + "\n" + grab("specialistStatus") + "\n" + grab("lockCap") + "\n" +
  "return { SPECIALIST_RATIO, SPECIALIST_GYMS, specialistGym, specialistStatus, lockCap };"
)();
const { specialistStatus, lockCap, SPECIALIST_RATIO, SPECIALIST_GYMS } = sandbox;

let pass = 0, fail = 0;
const t = (n, f) => { try { f(); pass++; console.log("ok   " + n); } catch (e) { fail++; console.log("FAIL " + n + " :: " + e.message); } };

const stats = (str, spe, def, dex) => ({ str, spe, def, dex });

// ── the rules themselves ────────────────────────────────────────────────
t("the ratio is Torn's 1.25 and the six conditional gyms are all present", () => {
  assert.strictEqual(SPECIALIST_RATIO, 1.25);
  const names = SPECIALIST_GYMS.map((g) => g.name).sort();
  assert.deepStrictEqual(names, [
    "Balboas Gym", "Elites", "Frontline Fitness", "Gym 3000",
    "Mr. Isoyamas", "Total Rebound",
  ]);
});

t("Balboas is open when Def+Dex clears 1.25x Str+Spd, and shut when it does not", () => {
  assert.strictEqual(specialistStatus(stats(50, 50, 100, 100), "Balboas Gym").open, true);
  // 200 vs 1.25 * 180 = 225 — short.
  assert.strictEqual(specialistStatus(stats(90, 90, 100, 100), "Balboas Gym").open, false);
});

t("exactly on the line counts as open — the requirement is at least", () => {
  // Str+Spd 160, so Def+Dex must reach 200.
  assert.strictEqual(specialistStatus(stats(80, 80, 100, 100), "Balboas Gym").open, true);
});

t("a single-stat gym measures against the SECOND-highest stat, not the total", () => {
  // Str 200; the best of the rest is Def 100; 200 >= 125.
  assert.strictEqual(specialistStatus(stats(200, 90, 100, 80), "Gym 3000").open, true);
  // Def climbs to 170: 200 >= 212.5 fails.
  assert.strictEqual(specialistStatus(stats(200, 90, 170, 80), "Gym 3000").open, false);
});

t("status reports how much room is left, which is the number worth showing", () => {
  // Def+Dex 200 buys Str+Spd up to 160; they are at 100.
  const s = specialistStatus(stats(50, 50, 100, 100), "Balboas Gym");
  assert.strictEqual(s.headroom, 60);
  // And when shut, it says how far short the gating side is.
  const shut = specialistStatus(stats(90, 90, 100, 100), "Balboas Gym");
  assert.ok(shut.short > 0, "a closed gym should report the shortfall");
  assert.strictEqual(shut.short, 25);   // needs 225, has 200
});

// ── the cap the planner needs ───────────────────────────────────────────
t("training the gym's own stat is never capped", () => {
  assert.strictEqual(lockCap(stats(50, 50, 100, 100), "Balboas Gym", "def"), Infinity);
  assert.strictEqual(lockCap(stats(50, 50, 100, 100), "Balboas Gym", "dex"), Infinity);
  assert.strictEqual(lockCap(stats(200, 90, 100, 80), "Gym 3000", "str"), Infinity);
});

t("training the opposing side is capped at the point the ratio breaks", () => {
  // Def+Dex 200 -> the pair may total 160; Spd already holds 50, so Str may
  // reach 110 and not a point more.
  assert.strictEqual(lockCap(stats(50, 50, 100, 100), "Balboas Gym", "str"), 110);
  assert.strictEqual(lockCap(stats(50, 50, 100, 100), "Balboas Gym", "spe"), 110);
});

t("a single-stat gym caps every other stat at the gating stat over 1.25", () => {
  // Str 200 -> nothing else may pass 160.
  assert.strictEqual(lockCap(stats(200, 90, 100, 80), "Gym 3000", "def"), 160);
  assert.strictEqual(lockCap(stats(200, 90, 100, 80), "Gym 3000", "spe"), 160);
});

t("a gym already lost caps at the current value rather than going negative", () => {
  // Balboas is already shut here; the cap must not invite more of the same.
  const cap = lockCap(stats(90, 90, 100, 100), "Balboas Gym", "str");
  assert.ok(cap <= 90, "cap should not exceed the stat's current value, got " + cap);
});

t("no lock means no cap", () => {
  assert.strictEqual(lockCap(stats(50, 50, 100, 100), "", "str"), Infinity);
  assert.strictEqual(lockCap(stats(50, 50, 100, 100), null, "str"), Infinity);
  // A gym with no ratio at all — George's, the Sports Science Lab — cannot lock.
  assert.strictEqual(lockCap(stats(50, 50, 100, 100), "George's", "str"), Infinity);
});

t("the cap is what stops the plan: Strength may grow 10, not 60", () => {
  // The bug in one line. Given these stats the old planner would happily
  // schedule Strength to any target; under the lock it stops at 110.
  const s = stats(100, 50, 100, 100);
  assert.strictEqual(specialistStatus(s, "Balboas Gym").open, true);
  assert.strictEqual(lockCap(s, "Balboas Gym", "str"), 110);
});

// ── the planner under a lock ────────────────────────────────────────────
// The unit tests above prove the arithmetic; this proves the thing that
// actually failed. A plan runtime, same shape as goals.test.mjs, with the
// lock set — the schedule must stop at the ceiling instead of walking
// through it.
const plan = (stats, goals, lock) => new Function("var RESULT;" + `
  var HIST_KEYS = ["str","def","spe","dex"];
  var GYMS = [{ Gym: "T", Energy: 10, Str: 1, Def: 1, Spe: 1, Dex: 1 }];
  var DAY_MS = 86400000;
  var GOAL_MAX_DAYS = 3650;
  var goalCache = { key: "", val: null };
  var GOAL_STEPS = [0, 5e7, 1e8, 2.5e8, 5e8];
  var GOAL_MAX_TRAINS = 4e6;
  var CAL_WINDOW = 14, CAL_MIN_DAYS = 7;
  var CAL_MODEL_LO = 0.5, CAL_MODEL_HI = 1.5;
  var CAL_USAGE_LO = 0.3, CAL_USAGE_HI = 1.5;
  ${[/var STAT_BOOKS = \{[\s\S]*?\n  \};/, /var BOOK_PCT = [^;]+;/, /var BOOK_CAP = [^;]+;/, /var BOOK_DAYS = [^;]+;/].map(re => re.exec(src)[0]).join("\n")}
  ${consts}
  var state = { books: {}, goalOrder: [], goalStep: 0,
                stats: ${JSON.stringify(stats)}, goals: ${JSON.stringify(goals)},
                gymName: "T", happyMax: 5000, perks: {},
                gymLock: ${JSON.stringify(lock || "")},
                hist: [], ledger: [], focus: "str" };
  function dailyEnergy(){ return { total: 100 }; }
  var STORED = {};
  function storeSet(k, v){ STORED[k] = v; }
  // Ten a train. A gain of 1 against Torn-sized goals needs more trains than
  // GOAL_MAX_TRAINS allows, and goalSegments then schedules NOTHING -- which
  // makes every assertion here pass for the wrong reason.
  function gainOne(){ return 10; }
  ${grab("dayKey")} ${grab("calClamp")} ${grab("predictDay")} ${grab("calibration")}
  ${grab("gymFor")} ${grab("dotsFor")} ${grab("trainsTo")} ${grab("trainsPerDay")}
  ${grab("goalLevels")} ${grab("orderedGoalKeys")} ${grab("bookAward")} ${grab("bookPending")}
  ${grab("pendingBookAward")} ${grab("shareCap")} ${grab("specialistGym")}
  ${grab("specialistStatus")} ${grab("lockCap")} ${grab("goalSegments")}
  ${grab("scheduleDays")} ${grab("goalPlan")}
  RESULT = goalPlan();` + "; return RESULT;")();

const row = (p, k) => p.rows.filter((r) => r.k === k)[0];

t("without a lock the plan schedules Strength all the way to its goal", () => {
  const p = plan({ str: 1000, spe: 500, def: 1000, dex: 1000 }, { str: 3000 }, "");
  const seg = p.segments.filter((s) => s.k === "str");
  assert.ok(seg.length, "Strength should be scheduled at all");
  assert.strictEqual(seg[seg.length - 1].to, 3000);
});

t("under a Balboas lock the same goal stops dead at the ceiling", () => {
  // Def+Dex 2000 allows Str+Spd 1600; Spd holds 500, so Strength stops at
  // 1100 even though the goal says 3000.
  const p = plan({ str: 1000, spe: 500, def: 1000, dex: 1000 }, { str: 3000 }, "Balboas Gym");
  const seg = p.segments.filter((s) => s.k === "str");
  const reached = seg.length ? seg[seg.length - 1].to : 1000;
  assert.ok(seg.length, "Strength must still be scheduled up TO the ceiling, not dropped");
  assert.strictEqual(reached, 1100);
});

t("the plan says the goal is held rather than pretending it is coming", () => {
  const p = plan({ str: 1000, spe: 500, def: 1000, dex: 1000 }, { str: 3000 }, "Balboas Gym");
  const r = row(p, "str");
  assert.ok(r, "there should still be a Strength row");
  assert.strictEqual(r.heldByLock, true);
  assert.strictEqual(r.lockCap, 1100);
});

t("training the gym's own stat is untouched by the lock", () => {
  const p = plan({ str: 1000, spe: 500, def: 1000, dex: 1000 }, { def: 4000 }, "Balboas Gym");
  const seg = p.segments.filter((s) => s.k === "def");
  assert.ok(seg.length, "Defense should still be scheduled");
  assert.strictEqual(seg[seg.length - 1].to, 4000);
  assert.strictEqual(row(p, "def").heldByLock, false);
});

t("a goal already past the ceiling is held, not silently dropped", () => {
  // Balboas is shut here and Strength is the reason; the row has to say so.
  const p = plan({ str: 3000, spe: 500, def: 1000, dex: 1000 }, { str: 4000 }, "Balboas Gym");
  const r = row(p, "str");
  assert.strictEqual(r.heldByLock, true);
});

t("the lock is in the plan cache key, or a stale plan outlives it", () => {
  // Same stats and goals, different lock: the cached plan must not be reused.
  const free = plan({ str: 1000, spe: 500, def: 1000, dex: 1000 }, { str: 3000 }, "");
  const held = plan({ str: 1000, spe: 500, def: 1000, dex: 1000 }, { str: 3000 }, "Balboas Gym");
  assert.notStrictEqual(row(free, "str").heldByLock, row(held, "str").heldByLock);
  assert.ok(/gymLock/.test(src.slice(src.indexOf("var key = ["), src.indexOf("var key = [") + 900)),
    "state.gymLock must appear in goalPlan's cache key");
});

// ── the plumbing that makes it reachable ────────────────────────────────
// Three ways this feature could exist and still do nothing, each of which has
// happened in this script before: a control the click router does not know
// about, a setting that is never loaded back, and a card nobody renders.
t("the lock is restored on load, and a junk value cannot brick every goal", () => {
  const boot = src.slice(src.indexOf('storeGet("goalStep"'), src.indexOf('storeGet("goalStep"') + 700);
  assert.ok(/storeGet\("gymLock"/.test(boot), "gymLock is never read back at boot");
  assert.ok(/specialistGym\(lockSaved\)/.test(boot),
    "a stored lock must be validated against the six, or an unknown name holds every goal forever");
});

t("the select is rendered and its change handler exists", () => {
  assert.ok(/function gymLockHtml\(/.test(src), "no card builder");
  assert.ok(/gymLockHtml\(\) \+/.test(src), "the card is built but never placed in the Plan tab");
  assert.ok(/dataset\.gymlock !== undefined/.test(src), "onGoalChange does not handle the select");
  // The panel listens for change on itself, so a <select> needs no whitelist
  // entry — but it does need the data attribute the handler keys on.
  assert.ok(/data-gymlock/.test(src), "the select carries no data-gymlock attribute");
});

t("changing the lock drops the cached plan", () => {
  const h = src.slice(src.indexOf("dataset.gymlock !== undefined"), src.indexOf("dataset.gymlock !== undefined") + 400);
  assert.ok(/resetPlanCaches\(\)/.test(h), "a stale plan would survive the switch");
});

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
