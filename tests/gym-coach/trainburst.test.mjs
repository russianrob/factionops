// Not emptying the key's minute every time you press TRAIN.
//
// Measured on a live account: 103 user/ calls in 183s, with 88 in one rolling
// minute and 77 of those the `log` endpoint at 0-1ms spacing. Torn's cap is
// 100 a minute, so a single session of training was enough to eat it.
//
// Two faults. The gym-page click handler calls refresh("train") twice per
// click, and "train" was passed as FORCE -- bypassing the TTL and firing all
// four log endpoints each time. And a failed round never stamped a time, so
// once the key was limited every later call re-fired immediately: the rate
// limit fed itself.
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
// Drives fetchTrainLog repeatedly and counts how many HTTP calls result.
function calls({ n, force, fail, concurrent = false, code = 5, logReadable = null }) {
  return new Function("var R;" + `
    var TRAINLOG_IDS = [5300, 5301, 5302, 5303];
    ${/var TRAINLOG_TTL = \d+;/.exec(src)[0]}
    var hits = 0, saved = {};
    function storeSet() {}
    function dayKey(ms) { return Math.floor(ms / 86400000); }
    function resolveKey() { return "k"; }
    function apiUrl() { return "u"; }
    function resetPlanCaches() {}
    function httpGet() { hits++; if (${JSON.stringify(!!0)}) {} return ${fail ? "Promise.reject(Object.assign(new Error('nope'), { code: " + code + " }))" : "Promise.resolve({ log: {} })"}; }
    var CONCURRENT = ${JSON.stringify(concurrent)};
    var state = { trainLog: null, trainLogInFlight: false, logReadable: ${JSON.stringify(logReadable)} };
    ${grab("trainLogByDay")} ${grab("trainLogEvents")} ${grab("carriedSince")} ${grab("fetchTrainLog")}
    var all = [];
    if (CONCURRENT) {
      // Fired together, the way a burst of clicks and a poll actually collide.
      for (var i = 0; i < ${n}; i++) all.push(fetchTrainLog(${force}));
      R = Promise.all(all).then(function () { return hits; }, function () { return hits; });
    } else {
      var chain = Promise.resolve();
      for (var j = 0; j < ${n}; j++) {
        chain = chain.then(function () { return fetchTrainLog(${force}); });
      }
      R = chain.then(function () { return hits; }, function () { return hits; });
    }
  ` + "return R;")();
}

let pass = 0, fail = 0;
const t = (n, f) => { try { f(); pass++; console.log("ok   " + n); } catch (e) { fail++; console.log("FAIL " + n + " :: " + e.message); } };

await (async () => {
  const unforced = await calls({ n: 10, force: false, fail: false });
  t("ten unforced rounds inside the TTL cost ONE round of calls", () => {
    assert.strictEqual(unforced, 4, "got " + unforced + " calls; the TTL is not holding");
  });

  const failing = await calls({ n: 10, force: false, fail: true });
  t("a failing round backs off instead of re-firing every time", () => {
    // THE FEEDBACK LOOP. Without stamping the attempt, each of the ten calls
    // starts a fresh round: forty calls, on a key that is already limited.
    assert.strictEqual(failing, 4, "got " + failing + " calls -- a rate limit is feeding itself");
  });

  const overlap = await calls({ n: 10, force: true, fail: false, concurrent: true });
  t("rounds fired at once collapse into one, rather than ten in flight", () => {
    // A burst of clicks and a poll landing together is exactly how 77 calls
    // arrived at 0-1ms spacing. Ten concurrent forced calls must still be one
    // round of four.
    assert.strictEqual(overlap, 4, "got " + overlap + " calls -- rounds are overlapping");
  });

  const forced = await calls({ n: 10, force: true, fail: false });
  t("an explicit force still refetches, because boot and manual mean it", () => {
    assert.strictEqual(forced, 40, "force should bypass the TTL, got " + forced);
  });
})();

t("training is no longer one of the things that forces a refetch", () => {
  // The click handler fires refresh("train") twice per press. Forcing on that
  // is eight log calls per click, and `since` already keeps the figure live
  // without asking Torn at all.
  // The CALL SITE, not the declaration: fetchTrainLog(force) is the signature.
  const m = /fetchTrainLog\((kind[^)]*)\)/.exec(src);
  assert.ok(m, "fetchTrainLog is not called with a `kind` any more");
  assert.ok(!/train/.test(m[1]), 'refresh still forces the log on "train": ' + m[1]);
  assert.match(m[1], /boot/, "boot should still force it: " + m[1]);
});

await (async () => {
  // A Limited key cannot read the gym log at all: selection `log` is Full-only.
  // Asking anyway is four refusals a round, and a REFUSED call still counts
  // against the 100-a-minute cap -- so the script was spending budget to be
  // told "no" on a loop. Measured at 2/min doing nothing else.
  const refused = await calls({ n: 6, force: true, fail: true, code: 16 });
  t("a key that cannot read the log is asked once, not forever", () => {
    assert.strictEqual(refused, 4, "got " + refused + " calls -- still asking after a refusal");
  });

  const limited = await calls({ n: 6, force: true, fail: true, code: 5 });
  t("a RATE LIMIT is not treated as a refusal -- that one is temporary", () => {
    // The contrast with the case above, and the whole point of distinguishing
    // them. Six FORCED rounds after a code 5 all still fire (6 x 4 = 24),
    // because the key can read the log and was merely busy. The refusal case
    // stops dead at 4. Writing a feature off over a transient error is how it
    // quietly dies for someone whose key is fine -- which is the mistake this
    // probe made three times before it was pinned.
    assert.strictEqual(limited, 24, "got " + limited + " -- a rate limit disabled the log");
  });

  const known = await calls({ n: 3, force: true, fail: false, logReadable: false });
  t("a key already known to be refused is not asked again at all", () => {
    assert.strictEqual(known, 0, "asked " + known + " times for something the key cannot have");
  });
})();

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
