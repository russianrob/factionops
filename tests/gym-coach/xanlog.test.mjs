// Your own xanax, counted from Torn's log rather than from a snapshot.
//
// The snapshot route does not work. Asked for 1 Jan 2026 it returns a snapshot
// from Feb 2024, and even where it returns an exact date the figure disagrees
// with the itemised log by 18% over two months. Log 2290 is a record of
// discrete events with unique ids, so it can be counted rather than trusted.
//
// It is also owner-only -- there is no /user/{id}/log -- so this can never be a
// faction ranking. It is your usage, and the card says so.
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
const CONST = [/var XAN_LOG = [^;]+;/, /var XAN_MAX_PAGES = [^;]+;/]
  .map(re => { const m = re.exec(src); assert.ok(m, "missing " + re); return m[0]; }).join("\n");
const call = (fns, expr) =>
  new Function("var R;" + CONST + "\n" + fns.map(grab).join("\n") + "\nR = (" + expr + "); return R;")();

let pass = 0, fail = 0;
const t = (n, f) => { try { f(); pass++; console.log("ok   " + n); } catch (e) { fail++; console.log("FAIL " + n + " :: " + e.message); } };

const S = (y, m, d) => Math.floor(Date.UTC(y, m - 1, d) / 1000);
const row = (id, ts) => ({ id: id, timestamp: ts, details: { id: 2290, title: "Item use xanax" } });
const tally = (pages) => call(["xanLogTally"], `xanLogTally(${JSON.stringify(pages)})`);

t("every logged use is one xanax", () => {
  const out = tally([[row("a", S(2026, 1, 5)), row("b", S(2026, 1, 6)), row("c", S(2026, 2, 1))]]);
  assert.strictEqual(out.total, 3);
});

t("the same entry seen on two pages is counted once", () => {
  // Pages overlap at the boundary when paging by timestamp, and a duplicate
  // would inflate the count silently.
  const out = tally([[row("a", S(2026, 1, 5)), row("b", S(2026, 1, 6))],
                     [row("b", S(2026, 1, 6)), row("c", S(2026, 1, 7))]]);
  assert.strictEqual(out.total, 3);
});

t("uses are bucketed by the month they happened in", () => {
  const out = tally([[row("a", S(2026, 1, 5)), row("b", S(2026, 1, 20)), row("c", S(2026, 3, 2))]]);
  assert.strictEqual(out.byMonth["2026-01"], 2);
  assert.strictEqual(out.byMonth["2026-03"], 1);
  assert.strictEqual(out.byMonth["2026-02"], undefined);
});

t("months are bucketed in TCT, not in the reader's timezone", () => {
  // 1 January 00:30 UTC is 31 December in New York. Bucketing locally would
  // move a use into the previous year.
  const out = tally([[row("a", Math.floor(Date.UTC(2026, 0, 1, 0, 30) / 1000))]]);
  assert.strictEqual(out.byMonth["2026-01"], 1);
  assert.strictEqual(out.byMonth["2025-12"], undefined);
});

t("a row with no timestamp cannot be placed and is not counted", () => {
  const out = tally([[{ id: "x", timestamp: 0 }, row("a", S(2026, 1, 5))]]);
  assert.strictEqual(out.total, 1);
});

t("a row with no id is still counted, using its own timestamp", () => {
  // Torn gives every row an id, but dropping a real use because a field moved
  // would under-report -- and under-reporting reads as "you took fewer".
  const out = tally([[{ timestamp: S(2026, 1, 5) }, { timestamp: S(2026, 1, 6) }]]);
  assert.strictEqual(out.total, 2);
});

t("nothing logged is zero, and zero is a real answer", () => {
  const out = tally([[]]);
  assert.strictEqual(out.total, 0);
  assert.deepStrictEqual(out.byMonth, {});
});

t("nothing at all is still a usable tally", () => {
  assert.strictEqual(tally([]).total, 0);
  assert.strictEqual(tally(null).total, 0);
});

// ---- paging ----------------------------------------------------------------

const next = (payload) => call(["xanLogNext"], `xanLogNext(${JSON.stringify(payload)})`);

t("the next page is the link Torn hands back", () => {
  assert.strictEqual(
    next({ _metadata: { links: { prev: "https://api.torn.com/v2/user/log?x=1" } } }),
    "https://api.torn.com/v2/user/log?x=1");
});

t("no link means the walk is over", () => {
  assert.strictEqual(next({ _metadata: { links: { prev: null, next: null } } }), null);
  assert.strictEqual(next({ _metadata: {} }), null);
  assert.strictEqual(next({}), null);
  assert.strictEqual(next(null), null);
});

t("the walk is bounded, so a paging bug cannot spend the rate limit", () => {
  // A year is about six pages. The cap is a backstop against a link that never
  // resolves to null, not a limit anyone should reach.
  const cap = call([], "XAN_MAX_PAGES");
  assert.ok(cap >= 12 && cap <= 40, "implausible page cap: " + cap);
});

t("the log id is Torn's own 'Item use xanax'", () => {
  // Pinned as a literal: a wrong id returns an empty log rather than an error,
  // so it would read as "you have taken none" instead of failing.
  assert.strictEqual(call([], "XAN_LOG"), 2290);
});


// ---- the faction half: only where Torn actually has January -----------------
//
// Snapshot coverage varies PER MEMBER. Asked for 1 Jan 2026, some accounts
// return a 1 Jan 2026 snapshot and some return one from 2021. The response
// always carries the date it actually used, so who can be answered is knowable
// rather than guessed -- which is what makes a partial board honest instead of
// quietly wrong.

const CONST2 = [/var XAN_SNAP_SLACK_MS = [^;]+;/]
  .map(re => { const m = re.exec(src); assert.ok(m, "missing " + re); return m[0]; }).join("\n");
const usable = (snapSec, wantMs) => new Function("var R;" + CONST2 + "\n" + grab("xanSnapUsable") +
  `\nR = xanSnapUsable(${snapSec}, ${wantMs}); return R;`)();

const JAN = Date.UTC(2026, 0, 1);

t("a snapshot taken on the day asked for is usable", () => {
  assert.strictEqual(usable(Math.floor(JAN / 1000), JAN), true);
});

t("a snapshot from years earlier is not", () => {
  // 2021 against a 2026 question. Counting from it would report five years of
  // xanax as this year's.
  assert.strictEqual(usable(Math.floor(Date.UTC(2021, 7, 27) / 1000), JAN), false);
});

t("a snapshot two weeks early is not usable either", () => {
  // 18 December is not January, and the fortnight between them is real xanax
  // that would be counted into the wrong year.
  assert.strictEqual(usable(Math.floor(Date.UTC(2025, 11, 18) / 1000), JAN), false);
});

t("a snapshot a day out is tolerated, because a daily job is not a clock", () => {
  assert.strictEqual(usable(Math.floor((JAN + 86400000) / 1000), JAN), true);
  assert.strictEqual(usable(Math.floor((JAN - 86400000) / 1000), JAN), true);
});

t("a missing snapshot date is not usable", () => {
  // No date means no way to know what window was measured, which is exactly
  // the state that produced a two-year-old figure labelled as this year.
  assert.strictEqual(usable(0, JAN), false);
  assert.strictEqual(usable(null, JAN), false);
});

t("the slack is days, not months", () => {
  // Asserted as a literal: every test above derives from it, so a slack of a
  // year would agree with itself and wave through the exact bug being fixed.
  const slack = new Function("var R;" + CONST2 + "R = XAN_SNAP_SLACK_MS; return R;")();
  assert.ok(slack > 0 && slack <= 3 * 86400000, "implausible slack: " + slack + "ms");
});


// ---- assembling the partial faction board ----------------------------------

const JANMS = Date.UTC(2026, 0, 1);
const facCall = (rows, own, ownTotal) => new Function("var R;" + CONST2 + "\n" +
  grab("xanSnapUsable") + "\n" + grab("xanFacBuild") +
  `\nR = xanFacBuild(${JSON.stringify(rows)}, ${JANMS}, ${JSON.stringify(own)}, ${JSON.stringify(ownTotal)}); return R;`)();
const SNAP_OK = Math.floor(JANMS / 1000);
const SNAP_OLD = Math.floor(Date.UTC(2021, 7, 27) / 1000);

t("members Torn has January for are counted and ranked", () => {
  const out = facCall({
    1: { id: 1, name: "a", now: 900, then: 400, snapAt: SNAP_OK },
    2: { id: 2, name: "b", now: 1200, then: 1000, snapAt: SNAP_OK }
  }, null, null);
  assert.strictEqual(out[0].name, "a");
  assert.strictEqual(out[0].taken, 500);
  assert.strictEqual(out[1].taken, 200);
});

t("a member with no January snapshot is marked, never shown as zero", () => {
  // Shown as zero they would rank alongside somebody genuinely clean, and the
  // board would be making a claim about them that Torn never made.
  const out = facCall({
    1: { id: 1, name: "a", now: 900, then: 400, snapAt: SNAP_OK },
    2: { id: 2, name: "b", now: 5000, then: 1, snapAt: SNAP_OLD }
  }, null, null);
  const b = out.filter(r => r.name === "b")[0];
  assert.strictEqual(b.taken, null);
  assert.strictEqual(b.usable, false);
  assert.strictEqual(b.rank, null, "an unanswerable member should not hold a rank");
});

t("unanswerable members sort below everyone who can be counted", () => {
  const out = facCall({
    1: { id: 1, name: "unknown", now: 9999, then: 1, snapAt: SNAP_OLD },
    2: { id: 2, name: "known", now: 300, then: 100, snapAt: SNAP_OK }
  }, null, null);
  assert.strictEqual(out[0].name, "known");
  assert.strictEqual(out[0].rank, 1);
});

t("your own row comes from the log, not from a snapshot", () => {
  // The log is exact and needs no snapshot to exist -- which matters because
  // the account this was built on has no January snapshot at all.
  const out = facCall({
    7: { id: 7, name: "me", now: 1141, then: 628, snapAt: SNAP_OLD }
  }, 7, 599);
  assert.strictEqual(out[0].taken, 599, "should use the log count, not 1141-628");
  assert.strictEqual(out[0].source, "log");
  assert.strictEqual(out[0].usable, true, "an unusable snapshot must not disqualify your own row");
});

t("without a log count your own row falls back to the snapshot rule", () => {
  const out = facCall({ 7: { id: 7, name: "me", now: 900, then: 400, snapAt: SNAP_OK } }, 7, null);
  assert.strictEqual(out[0].taken, 500);
  assert.strictEqual(out[0].source, "snapshot");
});

t("a member not yet read is marked rather than counted", () => {
  const out = facCall({ 1: { id: 1, name: "a", now: null, then: null, snapAt: 0 } }, null, null);
  assert.strictEqual(out[0].usable, false);
});

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);