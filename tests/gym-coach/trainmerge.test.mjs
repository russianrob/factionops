// Not losing a session to a log round that has not caught up yet.
//
// Reported: trained 400e at 09:51 PM, and "Spent today" read 0e forty-five
// minutes later while the local Train Log card showed the session plainly.
//
// `since` is the live figure covering the gap between detecting a session on
// the gym page and Torn's log admitting it exists. Every successful fetch used
// to clear it outright, on the assumption that the fetch it just did includes
// the session. When Torn's log lags by even one round that assumption is
// false, and the session is gone -- permanently, if later rounds then fail,
// which is exactly what "Too many requests" in the header was telling us.
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
const DAY = 86400000, today = Math.floor(Date.now() / DAY);
// carriedSince(prev, freshByDay, dayK) -> the part the log has not caught up with
const carried = (prev, fresh) => new Function("var R;" + `
  ${grab("carriedSince")}
  R = carriedSince(${JSON.stringify(prev)}, ${JSON.stringify(fresh)}, ${today});
` + "return R;")();

let pass = 0, fail = 0;
const t = (n, f) => { try { f(); pass++; console.log("ok   " + n); } catch (e) { fail++; console.log("FAIL " + n + " :: " + e.message); } };

t("a log that has caught up clears the live figure", () => {
  // The normal case: the session is in the log now, so holding it separately
  // would double-count it.
  assert.strictEqual(carried({ byDay: { [today]: 0 }, since: 400 }, { [today]: 400 }), 0);
});

t("a log that has NOT caught up keeps the session", () => {
  // THE REPORTED BUG. The fetch succeeded but Torn had not written the entry,
  // and 400e was thrown away.
  assert.strictEqual(carried({ byDay: { [today]: 0 }, since: 400 }, { [today]: 0 }), 400);
});

t("a partially caught-up log keeps only the remainder", () => {
  // Two sessions detected, one written. Keeping both would double-count the
  // one that landed; keeping neither loses the one that did not.
  assert.strictEqual(carried({ byDay: { [today]: 0 }, since: 700 }, { [today]: 400 }), 300);
});

t("a log ahead of what we saw is trusted, not fought", () => {
  // Trained on another device: the log knows more than this one does, and the
  // live figure has nothing left to add.
  assert.strictEqual(carried({ byDay: { [today]: 0 }, since: 0 }, { [today]: 900 }), 0);
});

t("previously banked training is not counted as still pending", () => {
  // byDay already held 400 from an earlier round; that is not owed again.
  assert.strictEqual(carried({ byDay: { [today]: 400 }, since: 0 }, { [today]: 400 }), 0);
  // And the banked part must still COUNT toward what we knew. Trained 400
  // (logged) plus 100 more (not yet logged): comparing only the pending part
  // against the log's 400 looks like a surplus and drops the 100 on the floor.
  assert.strictEqual(carried({ byDay: { [today]: 400 }, since: 100 }, { [today]: 400 }), 100);
});

t("the very first round has nothing to carry", () => {
  assert.strictEqual(carried(null, { [today]: 400 }), 0);
  assert.strictEqual(carried(undefined, {}), 0);
});

t("yesterday's totals never leak into today's pending figure", () => {
  const r = carried({ byDay: { [today - 1]: 5000, [today]: 0 }, since: 400 }, { [today - 1]: 5000, [today]: 0 });
  assert.strictEqual(r, 400);
});

// --- the wiring ------------------------------------------------------------
// carriedSince is only worth anything if fetchTrainLog actually uses it. Driven
// directly rather than through a browser: a bar drop is not confirmed as a
// session until GAIN_WAIT_MS has passed, which is 30 seconds and far too slow
// to drive from a page test.
function afterFetch(prevSince, freshRows) {
  return new Function("var R;" + `
    var TRAINLOG_IDS = [5300];
    ${/var TRAINLOG_TTL = \d+;/.exec(src)[0]}
    var saved = {};
    function storeSet(k, v) { saved[k] = v; }
    function dayKey(ms) { return Math.floor(ms / 86400000); }
    function resolveKey() { return "k"; }
    function apiUrl() { return "u"; }
    function resetPlanCaches() {}
    function httpGet() { return Promise.resolve(${JSON.stringify(freshRows)}); }
    var state = { trainLog: { byDay: {}, since: ${prevSince}, at: 0 }, trainLogInFlight: false };
    ${grab("trainLogByDay")} ${grab("trainLogEvents")} ${grab("carriedSince")} ${grab("fetchTrainLog")}
    R = fetchTrainLog(true).then(function () {
      return { since: state.trainLog.since, byDay: state.trainLog.byDay[dayKey(Date.now())] || 0 };
    });
  ` + "return R;")();
}

const rows = e => ({ log: e ? { a: { timestamp: Math.floor(Date.now() / 1000), data: { energy_used: e } } } : {} });

await (async () => {
  const stale = await afterFetch(400, rows(0));
  t("fetchTrainLog keeps a session the log has not caught up with", () => {
    assert.strictEqual(stale.since, 400, "the pending session was cleared by an empty round");
  });
  const caught = await afterFetch(400, rows(400));
  t("fetchTrainLog clears it once the log catches up", () => {
    assert.strictEqual(caught.since, 0, "kept as pending after the log already had it");
    assert.strictEqual(caught.byDay, 400);
  });
})();

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
