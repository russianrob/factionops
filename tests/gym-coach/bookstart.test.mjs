// When the book was actually started.
//
// Detection off the page says WHICH book and nothing about when, so 0.9.51
// dated a sighting from now -- a floor, and a bad one: reported as "31d left"
// by someone with about 28 HOURS left, because they were thirty days in when
// the coach first looked.
//
// Torn's log index names the row that knows: 2050, "Item use book". One call,
// and the answer never changes while you are reading, so it is asked once.
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
const CONST = [/var BOOK_USE_LOG = [^;]+;/, /var BOOK_DAYS = [^;]+;/,
  /var BOOK_LOG_TTL = [^;]+;/, /var BOOK_RETRY_MS = [^;]+;/, /var BOOK_MAX_TRIES = [^;]+;/]
  .map(re => { const m = re.exec(src); assert.ok(m, "missing " + re); return m[0]; }).join("\n");
const call = (fns, expr) =>
  new Function("var R;" + CONST + "\n" + fns.map(grab).join("\n") + "\nR = (" + expr + "); return R;")();

let pass = 0, fail = 0;
const t = (n, f) => { try { f(); pass++; console.log("ok   " + n); } catch (e) { fail++; console.log("FAIL " + n + " :: " + e.message); } };

// A Torn v1 log payload. Which field carries the item name is not documented,
// so these deliberately put it in different places.
const resp = (rows) => ({ log: rows.reduce((o, r, i) => (o["h" + i] = r, o), {}) });
const SEC = 1000, DAY = 86400;
const NOW = 1788000000;
const start = (responses, name) =>
  call(["bookStartFromLog"], `bookStartFromLog(${JSON.stringify(responses)}, ${JSON.stringify(name)})`);

t("the start comes from the log row that names the book", () => {
  const out = start([resp([
    { timestamp: NOW - 30 * DAY, title: "Item use book", data: { item: "Time Is In The Mind" } }
  ])], "Time Is In The Mind");
  assert.strictEqual(out, (NOW - 30 * DAY) * 1000);
});

t("the name is found wherever in the row Torn happens to put it", () => {
  // The field is undocumented and the probe never got to read one, so the whole
  // row is searched rather than one guessed key. A wrong key would return no
  // start at all and silently fall back to dating from now -- which is the bug
  // this exists to fix.
  const inParams = start([resp([
    { timestamp: NOW - 5 * DAY, title: "Item use book", data: {}, params: { item: "Brawn Over Brains" } }
  ])], "Brawn Over Brains");
  assert.strictEqual(inParams, (NOW - 5 * DAY) * 1000);
  const inTitle = start([resp([
    { timestamp: NOW - 5 * DAY, title: "Item use book: Brawn Over Brains", data: {} }
  ])], "Brawn Over Brains");
  assert.strictEqual(inTitle, (NOW - 5 * DAY) * 1000);
});

t("the MOST RECENT reading of that book wins", () => {
  // You can read the same book more than once over a career; the countdown is
  // for the one you are on.
  const out = start([resp([
    { timestamp: NOW - 400 * DAY, data: { item: "Time Is In The Mind" } },
    { timestamp: NOW - 30 * DAY, data: { item: "Time Is In The Mind" } },
    { timestamp: NOW - 200 * DAY, data: { item: "Time Is In The Mind" } }
  ])], "Time Is In The Mind");
  assert.strictEqual(out, (NOW - 30 * DAY) * 1000);
});

t("another book's rows are ignored", () => {
  const out = start([resp([
    { timestamp: NOW - 2 * DAY, data: { item: "Brawn Over Brains" } },
    { timestamp: NOW - 30 * DAY, data: { item: "Time Is In The Mind" } }
  ])], "Time Is In The Mind");
  assert.strictEqual(out, (NOW - 30 * DAY) * 1000);
});

t("the match is case-insensitive", () => {
  const out = start([resp([{ timestamp: NOW - DAY, data: { item: "TIME IS IN THE MIND" } }])],
                    "Time Is In The Mind");
  assert.strictEqual(out, (NOW - DAY) * 1000);
});

t("no matching row is zero, which means fall back to the sighting", () => {
  assert.strictEqual(start([resp([{ timestamp: NOW, data: { item: "Something Else" } }])], "Time Is In The Mind"), 0);
  assert.strictEqual(start([], "Time Is In The Mind"), 0);
  assert.strictEqual(start(null, "Time Is In The Mind"), 0);
});

t("no book name means nothing to look for", () => {
  assert.strictEqual(start([resp([{ timestamp: NOW, data: { item: "Time Is In The Mind" } }])], ""), 0);
});

t("a row with no timestamp cannot date anything", () => {
  const out = start([resp([
    { timestamp: 0, data: { item: "Time Is In The Mind" } },
    { timestamp: NOW - 3 * DAY, data: { item: "Time Is In The Mind" } }
  ])], "Time Is In The Mind");
  assert.strictEqual(out, (NOW - 3 * DAY) * 1000);
});

t("the log id asked for is Torn's own 'Item use book'", () => {
  // Pinned as a literal: every other test here would agree with itself whatever
  // this were set to, and a wrong id returns an empty log rather than an error.
  assert.strictEqual(call([], "BOOK_USE_LOG"), 2050);
});

// ---- how soon to try again when the lookup fails ---------------------------

const wait = (tries) => call(["bookStartWait"], `bookStartWait(${tries})`);

t("a failed lookup is retried soon, not in six hours", () => {
  // The bug this replaces: the clock was stamped BEFORE the request and
  // success is gated elsewhere, so the long TTL only ever applied to failures.
  // One rate-limited call locked the book lookup out for six hours.
  const soon = wait(0);
  assert.ok(soon <= 300000, "first retry should be within five minutes, got " + soon + "ms");
  assert.strictEqual(wait(1), soon);
});

t("but it gives up retrying rather than polling forever", () => {
  // A book with no log row at all -- started before Torn logged it, or never
  // logged -- fails every single time. Retrying that on a short timer for ever
  // is exactly the rate-limit pressure the TTL exists to prevent.
  const max = call([], "BOOK_MAX_TRIES");
  assert.ok(max >= 2 && max <= 6, "implausible retry count: " + max);
  assert.strictEqual(wait(max), call([], "BOOK_LOG_TTL"), "it should fall back to the long wait");
  assert.strictEqual(wait(max + 10), call([], "BOOK_LOG_TTL"));
});

t("the long wait really is long, and the short one really is short", () => {
  // Asserted as literals: every test above derives from these, so a short wait
  // of six hours would agree with itself and still be the bug.
  assert.ok(call([], "BOOK_LOG_TTL") >= 3600000, "the give-up wait should be an hour or more");
  assert.ok(call([], "BOOK_RETRY_MS") <= 300000, "the retry wait should be minutes, not hours");
});

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
