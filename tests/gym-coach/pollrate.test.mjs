// How hard the coach hits a key that is capped at 100 calls a minute.
//
// The probe tripped that cap earlier today: five extra requests on top of the
// coach's own polling and Torn started answering "code 5: Too many requests"
// to everything. The bar itself is read from the page DOM every second, so the
// API poll was never what made it feel live -- it carries cooldowns, perks and
// stats, none of which move in eight seconds.
import fs from "fs";
import assert from "assert";
const src = fs.readFileSync("gym-coach-beta.user.js", "utf8");
const num = n => {
  const m = new RegExp("var " + n + " = (\\d+)").exec(src);
  assert.ok(m, n + " is not defined in the script");
  return Number(m[1]);
};
let pass = 0, fail = 0;
const t = (n, f) => { try { f(); pass++; console.log("ok   " + n); } catch (e) { fail++; console.log("FAIL " + n + " :: " + e.message); } };

t("the gym-page poll is a minute, not eight seconds", () => {
  assert.strictEqual(num("POLL_GYM_MS"), 60000);
});

t("no page polls faster than the gym page", () => {
  // Off-gym used to be slower at 20s. Leaving it there would have made every
  // other Torn page poll three times as hard as the gym itself.
  assert.ok(num("POLL_OFF_MS") >= num("POLL_GYM_MS"),
    "off-gym (" + num("POLL_OFF_MS") + "ms) is faster than gym (" + num("POLL_GYM_MS") + "ms)");
});

t("the whole poll budget leaves real headroom under Torn's 100/min", () => {
  // Worst case: the gym page, everything refreshing at once.
  const perMin = ms => 60000 / ms;
  const main = perMin(num("POLL_GYM_MS"));            // bars/cooldowns/etc, 1 call
  const inv = perMin(num("INV_TTL")) * 7;             // inventory walks 7 categories
  const log = perMin(num("TRAINLOG_TTL")) * 4;        // four stat logs
  const refills = perMin(num("REFILL_TTL"));
  const stocks = perMin(num("STOCKS_TTL"));
  const attacks = perMin(num("ATTACKS_TTL"));
  const keyinfo = perMin(num("KEYLEVEL_TTL"));
  const total = main + inv + log + refills + stocks + attacks + keyinfo;
  console.log("     steady-state worst case: " + total.toFixed(1) + " calls/min of 100");
  assert.ok(total < 30, "budget is " + total.toFixed(1) + "/min, too close to the cap");
});

t("the train log is not asked more often than the main poll", () => {
  // Four endpoints a round, so this is the single biggest repeat cost after
  // the inventory walk. The live `since` figure carries a session until the
  // log catches up, so there is nothing to gain by asking faster -- and asking
  // faster is what left no headroom when a session needed a round to land.
  assert.ok(num("TRAINLOG_TTL") >= 2 * num("POLL_GYM_MS"),
    "TRAINLOG_TTL is " + num("TRAINLOG_TTL") + "ms against a " + num("POLL_GYM_MS") + "ms poll");
});

t("the one-second timer stays one second -- it costs no API at all", () => {
  // It reads the bar from the DOM and ticks cooldowns down locally. Slowing it
  // would make the panel laggy for no saving whatsoever.
  // Found by walking to the timer's own closing interval rather than by a
  // fixed-length regex, which silently stopped matching as the body grew.
  const i = src.indexOf("cdTimer = setInterval(");
  assert.ok(i !== -1, "the per-second timer is gone");
  const m = /\}, (\d+)\);/.exec(src.slice(i));
  assert.ok(m, "could not find the interval on the per-second timer");
  assert.strictEqual(Number(m[1]), 1000);
});

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
