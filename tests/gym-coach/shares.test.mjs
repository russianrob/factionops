// Percentage builds: say what share of your total each stat should be, and let
// the coach hold you there as you grow.
//
// Asked for because a fixed goal says nothing about SHAPE: "Strength 1b" has
// to be retyped every time it lands, and says nothing about the other three.
// Shares are what people actually quote a build in, and they are already on
// screen -- torn-gym-stat-percentages draws exactly these numbers on gym.php.
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
const HIST = (/var HIST_KEYS = \[[^\]]*\];/.exec(src) || [])[0];
assert.ok(HIST, "HIST_KEYS missing");

// shareNextStat is built on shareState, so the sandbox carries both. Grabbed
// from source rather than restated -- a local copy would shadow production and
// let any mutation of the real one survive.
const call = (fn, ...args) => new Function("var R;" + HIST + `
  ${grab("shareState")}
  ${fn === "shareState" ? "" : grab(fn)}
  R = ${fn}(${args.map(a => JSON.stringify(a)).join(", ")});
` + "return R;")();

// rcexyz's real stats, so the fixtures mean something.
const ME = { str: 647295613, def: 101935420, spe: 259461019, dex: 706534966 };

let pass = 0, fail = 0;
const t = (n, f) => { try { f(); pass++; console.log("ok   " + n); } catch (e) { fail++; console.log("FAIL " + n + " :: " + e.message); } };

// --- normalising what you typed -------------------------------------------

t("percentages that already add to 100 are kept as they are", () => {
  assert.deepStrictEqual(call("normalizeShares", { dex: 40, str: 30, spe: 20, def: 10 }),
    { str: 30, def: 10, spe: 20, dex: 40 });
});

t("a plain ratio means the same thing as the percentages", () => {
  // 4:3:2:1 and 40/30/20/10 are the same build. Making someone do that
  // division by hand is the kind of arithmetic a script should absorb.
  assert.deepStrictEqual(call("normalizeShares", { dex: 4, str: 3, spe: 2, def: 1 }),
    call("normalizeShares", { dex: 40, str: 30, spe: 20, def: 10 }));
});

t("a share of zero survives normalising -- it means never train this", () => {
  // Plenty of published builds ignore Defense entirely. Zero has to mean
  // "never", not "train it to nothing".
  const r = call("normalizeShares", { dex: 50, str: 50, spe: 0, def: 0 });
  assert.strictEqual(r.spe, 0);
  assert.strictEqual(r.def, 0);
  assert.strictEqual(r.str + r.dex, 100);
});

t("nothing entered is null, not four zeroes", () => {
  assert.strictEqual(call("normalizeShares", { str: 0, def: 0, spe: 0, dex: 0 }), null);
  assert.strictEqual(call("normalizeShares", {}), null);
  assert.strictEqual(call("normalizeShares", null), null);
});

t("negatives and nonsense are treated as zero rather than poisoning the sum", () => {
  const r = call("normalizeShares", { dex: 50, str: 50, spe: -20, def: "abc" });
  assert.strictEqual(r.spe, 0);
  assert.strictEqual(r.def, 0);
  assert.strictEqual(Math.round(r.str + r.dex), 100);
});

// --- with a total goal: derive the four absolute targets -------------------

t("a total goal turns shares into the targets the existing planner reads", () => {
  const r = call("shareTargets", { str: 30, def: 10, spe: 20, dex: 40 }, 3e9);
  assert.deepStrictEqual(r, { str: 900000000, def: 300000000, spe: 600000000, dex: 1200000000 });
});

t("a zero share targets nothing, so the planner never schedules it", () => {
  const r = call("shareTargets", { str: 50, def: 0, spe: 0, dex: 50 }, 2e9);
  assert.strictEqual(r.def, 0);
  assert.strictEqual(r.spe, 0);
});

t("no total goal means no targets -- that is maintain mode, not a goal of zero", () => {
  assert.strictEqual(call("shareTargets", { str: 30, def: 10, spe: 20, dex: 40 }, 0), null);
});

// --- maintain mode: where am I against the build --------------------------

t("it reports each stat's real share against the one you want", () => {
  const rows = call("shareState", { str: 30, def: 10, spe: 20, dex: 40 }, ME);
  const by = {}; rows.forEach(r => { by[r.k] = r; });
  assert.strictEqual(by.dex.have.toFixed(2), "41.19");
  assert.strictEqual(by.str.have.toFixed(2), "37.74");
  assert.strictEqual(by.spe.have.toFixed(2), "15.13");
  assert.strictEqual(by.def.have.toFixed(2), "5.94");
});

t("the most under-share stat comes first", () => {
  const rows = call("shareState", { str: 30, def: 10, spe: 20, dex: 40 }, ME);
  assert.strictEqual(rows[0].k, "spe", "Speed is 4.87 points under, the biggest gap");
  assert.ok(rows[0].delta > 0);
});

t("a stat that is over its share is reported over, not as a tiny goal", () => {
  const rows = call("shareState", { str: 30, def: 10, spe: 20, dex: 40 }, ME);
  const str = rows.filter(r => r.k === "str")[0];
  assert.ok(str.delta < 0, "Strength is 7.74 points OVER on this build");
});

// --- which stat to train next ---------------------------------------------

t("among stats that are under, the best gym bonus wins", () => {
  // Reported: Str 50 / Spe 30 / Dex 20 / Def 0 on the real account. Speed was
  // 14.9 under and Strength 12.1, so the old rule sent every session to Speed
  // at +10% while Strength sat at +13%. Both were under and both had to be
  // trained eventually, so taking the worse multiplier first is simply less
  // stat for the same energy -- and maintain mode has no deadline, so the
  // ORDER costs nothing while the multiplier costs plenty.
  const build = { str: 50, spe: 30, dex: 20, def: 0 };
  const perks = { str: 1.13, def: 1.10, spe: 1.10, dex: 1.13 };
  assert.strictEqual(call("shareNextStat", build, ME, perks), "str");
});

t("deficit breaks a tie between equal bonuses", () => {
  const build = { str: 50, spe: 30, dex: 20, def: 0 };
  assert.strictEqual(call("shareNextStat", build, ME, { str: 1.1, spe: 1.1, dex: 1.1, def: 1.1 }), "spe");
});

t("a better bonus on a stat that is already OVER does not win", () => {
  // Dexterity is 21 points over here and has the best multiplier. Training it
  // would take the build further from its shape, which is the one thing the
  // shape exists to prevent -- the bonus ranks candidates, it does not choose
  // them.
  const build = { str: 50, spe: 30, dex: 20, def: 0 };
  const k = call("shareNextStat", build, ME, { dex: 1.5, str: 1.13, spe: 1.10, def: 1.10 });
  assert.notStrictEqual(k, "dex");
  assert.strictEqual(k, "str");
});

t("a zero-share stat never wins, however good its bonus", () => {
  const build = { str: 50, spe: 30, dex: 20, def: 0 };
  assert.notStrictEqual(call("shareNextStat", build, ME, { def: 9, str: 1.13, spe: 1.1, dex: 1.13 }), "def");
});

t("when everything is at or over its share, the least-over stat is next", () => {
  // Nothing is under, so there are no candidates for the bonus to rank and
  // the closest to needing training wins.
  const on = { str: 500, def: 0, spe: 300, dex: 200 };
  const build = { str: 50, spe: 30, dex: 20, def: 0 };
  const k = call("shareNextStat", build, on, {});
  assert.ok(["str", "spe", "dex"].indexOf(k) !== -1, "got " + k);
});

t("a zero-share stat is never chosen, however far under it looks", () => {
  assert.strictEqual(call("shareNextStat", { str: 0, def: 0, spe: 50, dex: 50 }, ME, {}), "spe");
});

t("no shares set means no opinion", () => {
  assert.strictEqual(call("shareNextStat", null, ME, {}), "");
});

// --- the goal rotation, when a total goal is also set ---------------------
// With a total, the shares become four absolute targets and the EXISTING
// planner drives. Left alone it orders by gym bonus then shortest-first, which
// on this account schedules Dexterity early -- it is nearest its target -- even
// though Dexterity is 21 points OVER its share. The build only comes right at
// the very end, and until then the ratio gets worse.
function order(shares, stats, goals, perks) {
  return new Function("var R;" + HIST + `
    ${grab("shareState")}
        ${[/var STAT_BOOKS = \{[\s\S]*?\n  \};/, /var BOOK_PCT = [^;]+;/, /var BOOK_CAP = [^;]+;/, /var BOOK_DAYS = [^;]+;/].map(re => re.exec(src)[0]).join("\n")}
    var state = { books: {}, shares: ${JSON.stringify(shares)}, stats: ${JSON.stringify(stats)},
                  goals: ${JSON.stringify(goals)}, perks: ${JSON.stringify(perks)}, goalOrder: [] };
    function trainsTo(k, from, to) { return { trains: Math.max(0, to - from) }; }
    ${grab("orderedGoalKeys")}
    R = orderedGoalKeys(1);
  ` + "return R;")();
}
const BUILD = { str: 50, spe: 30, dex: 20, def: 0 };
const PERK = { str: 1.176, dex: 1.176, spe: 1.145, def: 1.145 };
// 50/30/20/0 of 5b
const TARGETS = { str: 2.5e9, spe: 1.5e9, dex: 1e9, def: 0 };

t("an over-share stat is not scheduled ahead of an under-share one", () => {
  // Reported: "why is it telling me to train dex if my ratio is over?"
  const o = order(BUILD, ME, TARGETS, PERK);
  assert.ok(o.indexOf("dex") > o.indexOf("str"), "Dexterity is scheduled before Strength: " + o);
  assert.ok(o.indexOf("dex") > o.indexOf("spe"), "Dexterity is scheduled before Speed: " + o);
});

t("among the under-share stats the better gym bonus still leads", () => {
  const o = order(BUILD, ME, TARGETS, PERK);
  assert.strictEqual(o[0], "str", "expected Strength first (+17.6%, 12.1 under), got " + o);
});

t("a finished goal is not in the rotation at all", () => {
  // Defense wants 0%, so its derived target is 0 and it is already past it.
  assert.strictEqual(order(BUILD, ME, TARGETS, PERK).indexOf("def"), -1);
});

t("without a build the old shortest-first ordering is untouched", () => {
  // No shares set: nothing about the existing plan should change.
  const o = order(null, ME, { str: 7e8, spe: 1e9, dex: 8e8, def: 0 },
                  { str: 1, spe: 1, dex: 1, def: 1 });
  assert.deepStrictEqual(o, ["str", "dex", "spe"], "got " + o);
});

// --- the increment ladder on a percentage build ---------------------------
// The ladder caps every stat at the same ABSOLUTE rung, which drives them
// toward equal values rather than toward a ratio: it trains whichever stat is
// numerically smallest, however far OVER its share that stat may be. On a
// 50/30/20 build that is simply the wrong shape to be climbing.
function segs(shares, stats, goals, step) {
  return new Function("var R;" + HIST + `
    ${grab("shareState")}
    var state = { books: {}, shares: ${JSON.stringify(shares)}, stats: ${JSON.stringify(stats)},
                  goals: ${JSON.stringify(goals)}, perks: {}, goalOrder: [],
                  goalStep: ${step} };
    function trainsTo(k, from, to) { return to > from ? { trains: Math.ceil((to - from) / 1e6), end: to } : null; }
    ${grab("orderedGoalKeys")} ${grab("goalLevels")} ${[/var STAT_BOOKS = \{[\s\S]*?\n  \};/, /var BOOK_PCT = [^;]+;/, /var BOOK_CAP = [^;]+;/, /var BOOK_DAYS = [^;]+;/].map(re => re.exec(src)[0]).join("\n")}
    ${grab("bookAward")} ${grab("bookPending")} ${grab("pendingBookAward")} ${grab("shareCap")} ${grab("goalSegments")}
    R = goalSegments(1).slice(0, 8).map(function (x) { return x.k; });
  ` + "return R;")();
}

t("an over-share stat is not scheduled while an under-share one is waiting", () => {
  // Dexterity is 21 points over. Under the flat ladder it gets trained as soon
  // as the rung passes 707m, long before the build is anywhere near shape.
  const o = segs(BUILD, ME, TARGETS, 50e6);
  assert.strictEqual(o.indexOf("dex"), -1,
    "Dexterity is scheduled in the first legs despite being over share: " + o);
});

t("the rungs are scaled by share, so the ratio holds all the way up", () => {
  // Each stat climbs to its OWN share of the rung, so they arrive together
  // rather than being levelled to the same number first.
  const o = segs(BUILD, ME, TARGETS, 50e6);
  assert.ok(o.indexOf("str") !== -1 && o.indexOf("spe") !== -1, "got " + o);
});

t("a stat still stops at its own target, even when goals are not proportional", () => {
  // Shares can be set alongside typed goals that do NOT match them -- maintain
  // mode leaves `goals` as whatever was typed. The rung is then scaled by a
  // share that has nothing to do with the target, so the target cap is the only
  // thing stopping a big-share stat being scheduled past its goal.
  const typed = { str: 3e8, spe: 2e9, dex: 2e9, def: 0 };
  const o = segs(BUILD, { str: 2.9e8, spe: 3e8, dex: 3e8, def: 1e8 }, typed, 50e6);
  const strLegs = o.filter(k => k === "str").length;
  assert.ok(strLegs <= 1, "Strength scheduled past its 300m goal: " + o);
});

t("a stat still stops at its own target", () => {
  // The rung is scaled by share, but the target is still the ceiling --
  // without that a 50%-share stat would be scheduled past its goal.
  const near = { str: 2.49e9, spe: 1.49e9, dex: 0.99e9, def: 1e8 };
  const o = segs(BUILD, near, TARGETS, 50e6);
  // Every leg that remains is a real one; nothing is scheduled for a stat that
  // has already reached its target.
  const done = segs(BUILD, { str: 2.5e9, spe: 1.5e9, dex: 1e9, def: 1e8 }, TARGETS, 50e6);
  assert.deepStrictEqual(done, [], "legs scheduled past the targets: " + done);
  assert.ok(o.length > 0 && o.length <= 8, "got " + o);
});

t("without a build the ladder is untouched", () => {
  // Flat rungs, lowest stat first -- the behaviour every typed goal relies on.
  const o = segs(null, { str: 6e8, spe: 2e8, dex: 7e8, def: 1e8 },
                 { str: 1e9, spe: 1e9, dex: 1e9, def: 0 }, 50e6);
  assert.strictEqual(o[0], "spe", "the lowest stat should still lead: " + o);
});

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
