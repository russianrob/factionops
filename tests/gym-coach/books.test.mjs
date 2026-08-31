// Pending stat books in the projections.
//
// Four books each award +5% of a stat, capped at 10,000,000, after 31 days of
// reading. They are NOT perks -- nothing appears in book_perks and no
// multiplier changes -- so the coach could not see them at all, and forecast
// months ahead while ignoring a known, dated gain sitting in the post.
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
// Pulled from source, never restated: a sandbox that defines these shadows
// production and lets any mutation of them survive.
const BOOKS = [
  /var STAT_BOOKS = \{[\s\S]*?\n  \};/,
  /var BOOK_PCT = [^;]+;/, /var BOOK_CAP = [^;]+;/, /var BOOK_DAYS = [^;]+;/,
].map(re => { const m = re.exec(src); assert.ok(m, "missing " + re); return m[0]; }).join("\n");
const DAY = 86400000, NOW = 1e12;
const call = (fn, ...a) => new Function("var R;" + BOOKS + `
  ${grab("bookAward")}
  ${fn === "bookAward" ? "" : grab(fn)}
  R = ${fn}(${a.map(x => JSON.stringify(x)).join(", ")});
` + "return R;")();
// rcexyz's real stats
const ME = { str: 654161444, def: 101935420, spe: 259461019, dex: 706534966 };

let pass = 0, fail = 0;
const t = (n, f) => { try { f(); pass++; console.log("ok   " + n); } catch (e) { fail++; console.log("FAIL " + n + " :: " + e.message); } };

t("all four stats have a book, and it is the right one", () => {
  const names = new Function("var R;" + BOOKS + "R = STAT_BOOKS; return R;")();
  assert.strictEqual(names.str.name, "Brawn Over Brains");
  assert.strictEqual(names.def.name, "Keeping Your Face Handsome");
  assert.strictEqual(names.spe.name, "Time Is In The Mind");
  assert.strictEqual(names.dex.name, "A Job For Your Hands");
});

t("the award is 5% of the stat", () => {
  assert.strictEqual(call("bookAward", "def", ME), Math.round(101935420 * 0.05));
});

t("and it is capped at ten million", () => {
  // Every one of these stats except Defense is already past the cap, so the
  // cap is the number that actually applies, not the percentage.
  assert.strictEqual(call("bookAward", "spe", ME), 10000000);
  assert.strictEqual(call("bookAward", "str", ME), 10000000);
  assert.strictEqual(call("bookAward", "dex", ME), 10000000);
});

t("a stat you do not have earns nothing", () => {
  assert.strictEqual(call("bookAward", "str", { str: 0 }), 0);
  assert.strictEqual(call("bookAward", "nope", ME), 0);
});

// --- when it lands ---------------------------------------------------------

t("a book started today finishes in 31 days", () => {
  const p = call("bookPending", "str", NOW, NOW);
  assert.strictEqual(p.daysLeft, 31);
  assert.strictEqual(p.finishesAt, NOW + 31 * DAY);
});

t("the countdown runs down", () => {
  assert.strictEqual(call("bookPending", "str", NOW - 20 * DAY, NOW).daysLeft, 11);
  assert.strictEqual(call("bookPending", "str", NOW - 30.5 * DAY, NOW).daysLeft, 1);
});

t("a finished book is NOT pending, because the stat already has it", () => {
  // The award lands in battlestats the moment it completes, so still counting
  // it as pending would add it twice -- once in the stat and once in the plan.
  assert.strictEqual(call("bookPending", "str", NOW - 31 * DAY, NOW), null);
  assert.strictEqual(call("bookPending", "str", NOW - 90 * DAY, NOW), null);
});

t("no book means nothing pending", () => {
  assert.strictEqual(call("bookPending", "str", 0, NOW), null);
  assert.strictEqual(call("bookPending", "str", null, NOW), null);
});

// --- the projection actually using it -------------------------------------
// The point of the feature. Without this the whole seeding line could be
// deleted and every other suite would stay green, because none of them tick a
// book.
function trainsFor(books) {
  return new Function("var R;" + BOOKS + `
    var HIST_KEYS = ["str","def","spe","dex"];
    var state = { books: ${JSON.stringify(books)}, stats: ${JSON.stringify(ME)},
                  goals: { str: 800000000, def: 0, spe: 0, dex: 0 },
                  perks: {}, goalOrder: [], goalStep: 0, shares: null };
    function trainsTo(k, from, to) { return to > from ? { trains: Math.ceil((to - from) / 1e6), end: to } : null; }
    ${grab("bookAward")} ${grab("bookPending")} ${grab("pendingBookAward")}
    ${grab("orderedGoalKeys")} ${grab("goalLevels")} ${grab("shareCap")} ${grab("goalSegments")}
    R = goalSegments(1).reduce(function (n, x) { return n + x.trains; }, 0);
  ` + "return R;")();
}

t("a book being read shortens the plan by its award", () => {
  const without = trainsFor({ str: 0 });
  const withBook = trainsFor({ str: Date.now() });
  // 654m -> 800m is 146m of training; the book covers 10m of it.
  assert.strictEqual(without - withBook, 10, "expected 10 fewer trains, got " + (without - withBook));
});

t("a book already finished does NOT shorten it again", () => {
  // Its award is in the stat by now. Counting it here as well would take it
  // twice and quietly flatter every date on the Plan tab.
  const finished = trainsFor({ str: Date.now() - 40 * DAY });
  assert.strictEqual(finished, trainsFor({ str: 0 }));
});

t("a book for a stat with no goal changes nothing", () => {
  assert.strictEqual(trainsFor({ dex: Date.now() }), trainsFor({}));
});

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
