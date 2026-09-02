// The paste board: one line per member, built on the device, collected by hand.
//
// /faction/contributors is the only endpoint that reads another player's gym
// energy, and it needs faction API access -- a POSITION ability, so most
// members will never have it. The gym counters are not in personalstats at
// all, so there is no second endpoint to fall back on. What there IS, on every
// member's device, is this script's own ledger: it has measured their trains,
// by stat, by day, all along. So the collection is inverted -- everybody
// copies their own line, one person pastes the pile in.
import fs from "fs";
import assert from "assert";
const src = fs.readFileSync("gym-coach-beta.user.js", "utf8");
function grab(n){const i=src.indexOf("function "+n+"(");let d=0,j=src.indexOf("{",i);
  for(let k=j;k<src.length;k++){if(src[k]==="{")d++;else if(src[k]==="}"){d--;if(!d)return src.slice(i,k+1);}}}
function num(n){const m=src.match(new RegExp("var\\s+"+n+"\\s*=\\s*([0-9]+)"));return m?Number(m[1]):null;}
// Constants come out of the source, never restated here: a test that carries
// its own copy of a number agrees with itself after the source has moved on.
function decl(n){const m=src.match(new RegExp("(  var\\s+"+n+"\\s*=\\s*[^\\n]*)"));return m?m[1]:"";}

const DAY_MS = num("DAY_MS");
const WEEK_EPOCH_DAY = num("WEEK_EPOCH_DAY");

const run = (fns, body) => new Function("var R;" +
  [decl("DAY_MS"), decl("WEEK_EPOCH_DAY"), decl("LINE_TAG")].join("\n") + "\n" +
  fns.map(grab).join("\n") + "\n" + body + "\nreturn R;")();

let pass = 0, fail = 0;
const t = (n, f) => { try { f(); pass++; console.log("ok   " + n); }
                      catch (e) { fail++; console.log("FAIL " + n + " :: " + e.message); } };

// ---- who gets the tab -------------------------------------------------------
//
// Torn's OpenAPI spec makes both fields REQUIRED on /key/info: access.faction
// is the position ability, and selections.faction lists the faction selections
// the key may use, "contributors" among them. The board needs both, and both
// are guaranteed present -- so a missing answer means the request failed, not
// that the member lacks access.

const allowed = (kl, force) => run(["boardAllowed"],
  "R = boardAllowed(" + JSON.stringify(kl) + ", " + JSON.stringify(!!force) + ");");

t("both signals present and positive opens the tab", () => {
  assert.strictEqual(allowed({ faction: true, contributors: true }), true);
});

t("the position ability alone is not enough", () => {
  // A Limited key held by someone WITH faction API access still cannot ask for
  // contributors; the selection list is the other half of the answer.
  assert.strictEqual(allowed({ faction: true, contributors: false }), false);
});

t("the selection alone is not enough either", () => {
  assert.strictEqual(allowed({ faction: false, contributors: true }), false);
});

t("no answer yet keeps the tab hidden", () => {
  // Hidden rather than shown-then-yanked: /key/info is already fetched and
  // cached, so the wait is one request, and a tab that vanishes mid-tap is
  // worse than one that arrives a moment late.
  assert.strictEqual(allowed(null), false);
  assert.strictEqual(allowed({ faction: null, contributors: null }), false);
});

t("the settings override opens it whatever the key says", () => {
  // Torn's flag has never been read live by this script. If it is ever wrong,
  // the cost must be a setting, not the whole feature.
  assert.strictEqual(allowed({ faction: false, contributors: false }, true), true);
  assert.strictEqual(allowed(null, true), true);
});

// ---- what a week of your own training adds up to ---------------------------

const WK = 2385;
const D0 = WK * 7 + WEEK_EPOCH_DAY;          // Monday of that gym week
const totals = (ledger, byDayStat, wk) => run(["weekTotals"],
  "R = weekTotals(" + JSON.stringify(ledger) + ", " + JSON.stringify(byDayStat) +
  ", " + JSON.stringify(wk) + ");");

t("the week is the seven ledger days from its Monday", () => {
  const led = [{ d: D0 - 1, used: 999, off: 999 },   // last week
               { d: D0, used: 300, off: 25 },
               { d: D0 + 6, used: 200, off: 50 },
               { d: D0 + 7, used: 999, off: 999 }];  // next week
  const r = totals(led, {}, WK);
  assert.strictEqual(r.gymE, 500);
  assert.strictEqual(r.atkE, 75);
});

t("the stat split comes from the log, day by day", () => {
  const led = [{ d: D0, used: 300, off: 0 }, { d: D0 + 1, used: 200, off: 0 }];
  const split = {};
  split[D0] = { str: 200, def: 100 };
  split[D0 + 1] = { str: 150, spe: 50 };
  const r = totals(led, split, WK);
  assert.strictEqual(r.str, 350);
  assert.strictEqual(r.def, 100);
  assert.strictEqual(r.spe, 50);
  assert.strictEqual(r.dex, 0);
});

t("days the log could not read leave the split short of the total", () => {
  // trainStatFromLogRow drops rows it cannot read rather than guessing, so the
  // split can legitimately be smaller than the energy. It must NOT be scaled up
  // to match -- that would invent a stat nobody trained.
  const led = [{ d: D0, used: 500, off: 0 }];
  const split = {};
  split[D0] = { str: 200 };
  const r = totals(led, split, WK);
  assert.strictEqual(r.gymE, 500);
  assert.strictEqual(r.str, 200);
});

t("an empty ledger is a week of zeroes, not a crash", () => {
  const r = totals(null, null, WK);
  assert.strictEqual(r.gymE, 0);
  assert.strictEqual(r.atkE, 0);
  assert.strictEqual(r.str, 0);
});

// ---- xanax, from your own log ----------------------------------------------

const xy = (log, now) => run(["xanYear"],
  "R = xanYear(" + JSON.stringify(log) + ", " + JSON.stringify(now) + ");");
const JUL_2026 = Date.UTC(2026, 6, 1);

t("the year total is this year's months and no others", () => {
  const log = { total: 99, byMonth: { "2025-12": 40, "2026-01": 10, "2026-07": 5 } };
  assert.strictEqual(xy(log, JUL_2026), 15);
});

t("no log at all is unknown, which is not the same as none", () => {
  // The xanax board shipped "no January figure" as "took none" once already.
  assert.strictEqual(xy(null, JUL_2026), null);
  assert.strictEqual(xy({ byMonth: null }, JUL_2026), null);
});

t("a log with no uses this year is a real zero", () => {
  assert.strictEqual(xy({ total: 3, byMonth: { "2025-04": 3 } }, JUL_2026), 0);
});

// ---- the line itself --------------------------------------------------------

const OWN = { id: 2598755, name: "rcexyz", week: WK, gymE: 12400, str: 6100,
              def: 1200, spe: 3100, dex: 2000, atkE: 300, xan: 41, at: 1756000000 };
const line = o => run(["pasteLine", "pasteCk"], "R = pasteLine(" + JSON.stringify(o) + ");");
const parse = s => run(["pasteParse", "pasteCk"], "R = pasteParse(" + JSON.stringify(s) + ");");

t("a line is one token with no spaces, so chat cannot break it up", () => {
  const s = line(OWN);
  assert.ok(!/\s/.test(s), "whitespace in the line: " + s);
  assert.ok(s.length < 120, "too long for a chat message: " + s.length);
});

t("a line round-trips every field", () => {
  const r = parse(line(OWN));
  assert.strictEqual(r.length, 1);
  Object.keys(OWN).forEach(k => assert.strictEqual(r[0][k], OWN[k], k + " did not survive"));
});

t("unknown xanax stays unknown across the round trip", () => {
  const r = parse(line(Object.assign({}, OWN, { xan: null })));
  assert.strictEqual(r[0].xan, null);
});

t("a line is found inside the chat noise around it", () => {
  const blob = "rcexyz [2598755]\n09:15 " + line(OWN) + "\nnice one mate\n";
  const r = parse(blob);
  assert.strictEqual(r.length, 1);
  assert.strictEqual(r[0].id, 2598755);
});

t("several lines pasted together all come back", () => {
  const a = line(OWN);
  const b = line(Object.assign({}, OWN, { id: 137558, name: "RussianRob", gymE: 9000 }));
  const r = parse("chat chat\n" + a + "\nsomeone said something\n" + b);
  assert.deepStrictEqual(r.map(x => x.id).sort(), [137558, 2598755]);
});

t("a truncated line is dropped, not read as smaller numbers", () => {
  // Chat cuts long messages. A line that lost its tail would otherwise parse as
  // a member who trained a tenth of what they did.
  const s = line(OWN);
  const cut = s.slice(0, s.length - 4);
  assert.deepStrictEqual(parse(cut), []);
});

t("a digit edited by hand fails the check", () => {
  const s = line(OWN);
  const tampered = s.replace("12400", "99400");
  assert.deepStrictEqual(parse(tampered), []);
});

t("a line from another version is ignored rather than misread", () => {
  assert.deepStrictEqual(parse(line(OWN).replace(/^GCB1/, "GCB2")), []);
});

t("nothing recognisable is an empty list, not an error", () => {
  assert.deepStrictEqual(parse("just some chat\nno lines here"), []);
  assert.deepStrictEqual(parse(""), []);
});

// ---- collecting them --------------------------------------------------------

const merge = list => run(["pasteMerge"], "R = pasteMerge(" + JSON.stringify(list) + ");");

t("the newest line per member wins", () => {
  const old = Object.assign({}, OWN, { gymE: 100, at: 1000 });
  const now = Object.assign({}, OWN, { gymE: 500, at: 2000 });
  const r = merge([now, old]);
  assert.strictEqual(r.length, 1);
  assert.strictEqual(r[0].gymE, 500);
});

t("an older line never overwrites a newer one, whatever the paste order", () => {
  const old = Object.assign({}, OWN, { gymE: 100, at: 1000 });
  const now = Object.assign({}, OWN, { gymE: 500, at: 2000 });
  assert.strictEqual(merge([old, now])[0].gymE, 500);
});

t("different members are all kept", () => {
  const a = OWN;
  const b = Object.assign({}, OWN, { id: 137558 });
  assert.strictEqual(merge([a, b]).length, 2);
});

t("the biggest week of training comes first", () => {
  const a = Object.assign({}, OWN, { id: 1, gymE: 100 });
  const b = Object.assign({}, OWN, { id: 2, gymE: 900 });
  assert.deepStrictEqual(merge([a, b]).map(r => r.id), [2, 1]);
});


// ---- reading a pasted pile -------------------------------------------------

const collect = (have, text, wk) => run(["pasteCollect", "pasteParse", "pasteMerge", "pasteCk"],
  "R = pasteCollect(" + JSON.stringify(have) + ", " + JSON.stringify(text) + ", " +
  JSON.stringify(wk) + ");");

t("lines for this week are kept and counted", () => {
  const a = line(OWN);
  const b = line(Object.assign({}, OWN, { id: 137558, name: "RussianRob" }));
  const r = collect([], a + "\n" + b, WK);
  assert.strictEqual(r.rows.length, 2);
  assert.strictEqual(r.added, 2);
});

t("a line from another gym week is set aside, not mixed in", () => {
  // Two weeks in one table is a leaderboard nobody can read: last week's heavy
  // trainer beats this week's, and the header says one week.
  const r = collect([], line(Object.assign({}, OWN, { week: WK - 1 })), WK);
  assert.strictEqual(r.rows.length, 0);
  assert.strictEqual(r.otherWeek, 1);
});

t("junk in the paste is reported rather than silently swallowed", () => {
  const broken = line(OWN).slice(0, -3);
  const r = collect([], "chatter\n" + broken, WK);
  assert.strictEqual(r.rows.length, 0);
  assert.strictEqual(r.added, 0);
});

t("pasting again updates a member instead of listing them twice", () => {
  const first = pasteParseOne(line(Object.assign({}, OWN, { gymE: 100, at: 1000 })));
  const r = collect([first], line(Object.assign({}, OWN, { gymE: 800, at: 2000 })), WK);
  assert.strictEqual(r.rows.length, 1);
  assert.strictEqual(r.rows[0].gymE, 800);
});

t("what was already collected survives a paste that adds nobody", () => {
  const first = pasteParseOne(line(OWN));
  const r = collect([first], "just chat, no lines", WK);
  assert.strictEqual(r.rows.length, 1);
});

function pasteParseOne(s) { return parse(s)[0]; }

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);