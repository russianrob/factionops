// Reading a key's own request log to find what is exhausting it.
//
// Torn's /key/log returns up to 250 recent requests with a `comment` on each,
// and every script here stamps one -- so the log names the caller. The useful
// number is not the average: Torn's limit is 100 calls in any rolling minute,
// so a script that idles and then bursts will rate-limit you while looking
// quiet on average.
import fs from "fs";
import assert from "assert";
const src = fs.readFileSync("torn-gym-ledger-probe.user.js", "utf8");
function grab(n) {
  const i = src.indexOf("function " + n + "(");
  assert.ok(i !== -1, "function " + n + "() is not defined in the script");
  let d = 0;
  for (let k = src.indexOf("{", i); k < src.length; k++) {
    if (src[k] === "{") d++;
    else if (src[k] === "}") { d--; if (!d) return src.slice(i, k + 1); }
  }
}
const call = (rows) => new Function("var R;" + `
  ${grab("summariseKeyLog")}
  R = summariseKeyLog(${JSON.stringify(rows)});
` + "return R;")();
const T0 = 1800000000;
const row = (t, comment, sel) => ({ timestamp: t, comment, selections: sel || "bars", type: "user", ip: "1.2.3.4" });

let pass = 0, fail = 0;
const t = (n, f) => { try { f(); pass++; console.log("ok   " + n); } catch (e) { fail++; console.log("FAIL " + n + " :: " + e.message); } };

t("calls are grouped by the comment each script stamps", () => {
  const r = call([row(T0, "gym-coach"), row(T0 + 1, "gym-coach"), row(T0 + 2, "factionops")]);
  const by = {}; r.byComment.forEach(c => { by[c.comment] = c.calls; });
  assert.deepStrictEqual(by, { "gym-coach": 2, factionops: 1 });
});

t("the busiest ROLLING minute is what matters, not the average", () => {
  // 120 calls in one minute then nothing for an hour averages 2/min and would
  // look fine, while having rate-limited you solidly for that minute.
  const rows = [];
  for (let i = 0; i < 120; i++) rows.push(row(T0 + i / 2, "burst"));
  rows.push(row(T0 + 3600, "quiet"));
  const r = call(rows);
  assert.strictEqual(r.peakPerMin, 120, "peak was " + r.peakPerMin);
  assert.ok(r.avgPerMin < 5, "average should look innocent, got " + r.avgPerMin);
});

t("it says WHO was in the busiest minute", () => {
  const rows = [];
  for (let i = 0; i < 80; i++) rows.push(row(T0 + i / 2, "gym-coach"));
  for (let i = 0; i < 20; i++) rows.push(row(T0 + i / 2, "factionops"));
  const r = call(rows);
  assert.strictEqual(r.peakPerMin, 100);
  const top = r.peakByComment[0];
  assert.strictEqual(top.comment, "gym-coach");
  assert.strictEqual(top.calls, 80);
});

t("hitting the cap is called out, not left to be eyeballed", () => {
  const rows = [];
  for (let i = 0; i < 100; i++) rows.push(row(T0 + i / 2, "gym-coach"));
  assert.strictEqual(call(rows).overCap, true);
  const under = [];
  for (let i = 0; i < 40; i++) under.push(row(T0 + i / 2, "gym-coach"));
  assert.strictEqual(call(under).overCap, false);
});

t("an unstamped call is reported as unstamped, not dropped", () => {
  // A call with no comment is still a call against the cap, and not knowing
  // whose it is makes it MORE worth surfacing, not less.
  const r = call([row(T0, null), row(T0 + 1, "")]);
  assert.strictEqual(r.byComment[0].comment, "(no comment)");
  assert.strictEqual(r.byComment[0].calls, 2);
});

t("the selections behind a comment are kept, so the caller is identifiable", () => {
  const r = call([row(T0, "gym-coach", "bars"), row(T0 + 1, "gym-coach", "log")]);
  assert.match(r.byComment[0].selections, /bars/);
  assert.match(r.byComment[0].selections, /log/);
});

t("an empty log is an answer, not a crash", () => {
  const r = call([]);
  assert.strictEqual(r.byComment.length, 0);
  assert.strictEqual(r.peakPerMin, 0);
  assert.strictEqual(r.overCap, false);
});

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
