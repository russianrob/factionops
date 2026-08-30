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

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
