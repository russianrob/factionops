// Faction gym board -- the zero-server leaderboard.
//
// /faction/contributors hands ONE caller every member's cumulative gym
// numbers, so nobody else installs anything and no backend ever holds faction
// data. But the counter is cumulative and carries no history -- its
// `timestamp` parameter is a cache-buster, not a query -- so a WEEKLY figure
// is a delta against a baseline this device froze at the Monday boundary.
//
// The load-bearing claim is that the board is the SAME on every device: the
// values are the faction's, not the device's, so two clients that anchored at
// the same boundary must compute identical numbers without ever talking.
// Deliberately NOT UTC. Torn's week boundary is TCT = UTC, so anything here
// that reaches for a local getter has to be wrong somewhere -- and it can only
// be caught by running west of Greenwich. On a UTC box getMonth() and
// getUTCMonth() agree and the bug is invisible.
process.env.TZ = "America/New_York";
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
// production and lets every mutation of them survive.
const CONST = [
  /var DAY_MS = [^;]+;/, /var WEEK_EPOCH_DAY = [^;]+;/,
  /var BOARD_STATS = \[[^\]]*\];/, /var BOARD_WEEKS = [^;]+;/, /var BOARD_CARD_ROWS = [^;]+;/,
  /var BOARD_PARTIAL_MS = [^;]+;/, /var XAN_ENERGY = [^;]+;/, /var REFILL_ENERGY = [^;]+;/, /var CAN_ENERGY = [^;]+;/,
  /var BOARD_LABEL = \{[\s\S]*?\n  \};/,
].map(re => { const m = re.exec(src); assert.ok(m, "missing " + re); return m[0]; }).join("\n");

const env = (...fns) => "var R;" + CONST + fns.map(grab).join("\n");
const call = (fns, expr) => new Function(env(...fns) + "\nR = (" + expr + "); return R;")();

let pass = 0, fail = 0;
const t = (n, f) => { try { f(); pass++; console.log("ok   " + n); } catch (e) { fail++; console.log("FAIL " + n + " :: " + e.message); } };

const DAY = 86400000;
// 1970-01-05 was a Monday. Every boundary in these tests is derived from that
// fact rather than from a hand-computed epoch millisecond.
const MON = 4 * DAY;

// ---- the week boundary ----------------------------------------------------

t("the week turns over on Monday 00:00 TCT, not Sunday and not local midnight", () => {
  const wk = ms => call(["dayKey", "weekKey"], `weekKey(${ms})`);
  assert.strictEqual(wk(MON), wk(MON + 6 * DAY + 86399999), "Mon..Sun is one week");
  assert.strictEqual(wk(MON + 7 * DAY), wk(MON) + 1, "the next Monday is the next week");
  assert.strictEqual(wk(MON - 1), wk(MON) - 1, "the instant before Monday is last week");
});

t("a week index converts back to the Monday it started on", () => {
  const k = call(["dayKey", "weekKey"], `weekKey(${MON + 3 * DAY})`);
  assert.strictEqual(call(["weekStartMs"], `weekStartMs(${k})`), MON);
});

t("the boundary is UTC, so it does not move with the machine's timezone", () => {
  // Torn's day is TCT = UTC. Reading the boundary through local getters is the
  // bug this pins: on a UTC-4 box a local Monday starts four hours late.
  const at = call(["dayKey", "weekKey", "weekStartMs"], `weekStartMs(weekKey(${MON + 2 * DAY}))`);
  assert.strictEqual(new Date(at).getUTCDay(), 1, "Monday");
  assert.strictEqual(new Date(at).getUTCHours(), 0);
});

// ---- baselines and deltas -------------------------------------------------

const ROWS = (...pairs) => pairs.map(([id, name, value]) => ({ id, username: name, value, in_faction: true }));
// Anchoring is a SIDE EFFECT on the baseline, so the sandbox has to hand the
// mutated baseline back or every assertion about re-anchoring is vacuous.
const deltasFull = (base, stat, rows) => new Function(env("boardSnap", "boardDeltas") + `
  var B = ${JSON.stringify(base)};
  R = { out: boardDeltas(B, ${JSON.stringify(stat)}, ${JSON.stringify(rows)}), base: B };
  return R;`)();
const deltas = (base, stat, rows) => {
  const r = deltasFull(base, stat, rows);
  // copy the mutation back onto the caller's object, so tests can inspect it
  base.stats = r.base.stats;
  return r.out;
};

t("the first reading of a week is the baseline, so nobody starts the week ahead", () => {
  // Without this the board would rank members by their LIFETIME gym energy
  // and call it a week's work.
  const d = deltas({ week: 1, stats: {} }, "gymenergy",
    ROWS([1, "rcexyz", 5000000], [2, "someone", 90000000]));
  assert.strictEqual(d["1"].delta, 0);
  assert.strictEqual(d["2"].delta, 0);
});

t("later in the week the delta is what was trained since the baseline", () => {
  const base = { week: 1, stats: { gymenergy: { 1: 5000000, 2: 90000000 } } };
  const d = deltas(base, "gymenergy", ROWS([1, "rcexyz", 5048300], [2, "someone", 90001000]));
  assert.strictEqual(d["1"].delta, 48300);
  assert.strictEqual(d["2"].delta, 1000);
});

t("two devices holding the same baseline compute the same board", () => {
  // The whole zero-server claim in one assertion: the inputs are the
  // FACTION's numbers, so nothing device-local can enter the answer.
  const base = { week: 1, stats: { gymenergy: { 1: 5000000 } } };
  const live = ROWS([1, "rcexyz", 5048300]);
  const a = deltas(JSON.parse(JSON.stringify(base)), "gymenergy", live);
  const b = deltas(JSON.parse(JSON.stringify(base)), "gymenergy", live);
  assert.deepStrictEqual(a, b);
});

t("a member who joined mid-week is anchored on sight, not from their old faction's total", () => {
  const base = { week: 1, stats: { gymenergy: { 1: 5000000 } } };
  const d = deltas(base, "gymenergy", ROWS([1, "rcexyz", 5000100], [9, "newbie", 44000000]));
  assert.strictEqual(d["9"].delta, 0, "a fresh joiner does not win the week on arrival");
  assert.strictEqual(base.stats.gymenergy["9"], 44000000, "and is anchored for next time");
});

t("a counter that went DOWN re-anchors instead of rendering a negative week", () => {
  // `gymenergy` is titled a CHALLENGE contributor. If a challenge completes
  // and the counter resets -- or a member leaves and rejoins -- the live value
  // drops below the baseline. A negative leaderboard entry is never right.
  const base = { week: 1, stats: { gymenergy: { 1: 5000000 } } };
  const d = deltas(base, "gymenergy", ROWS([1, "rcexyz", 12000]));
  assert.strictEqual(d["1"].delta, 0);
  assert.strictEqual(base.stats.gymenergy["1"], 12000, "re-anchored, so next tick counts forward again");
});

t("each stat keeps its own baseline", () => {
  const base = { week: 1, stats: {} };
  deltas(base, "gymenergy", ROWS([1, "a", 100]));
  deltas(base, "gymstrength", ROWS([1, "a", 700]));
  assert.strictEqual(base.stats.gymenergy["1"], 100);
  assert.strictEqual(base.stats.gymstrength["1"], 700);
});

// ---- the week rolling over ------------------------------------------------

const roll = (board, now) => call(["dayKey", "weekKey", "weekStartMs", "boardRoll"],
  `boardRoll(${JSON.stringify(board)}, ${now})`);

t("crossing Monday starts a fresh baseline", () => {
  const b = roll({ week: call(["dayKey", "weekKey"], `weekKey(${MON})`), at: MON, stats: { gymenergy: { 1: 10 } } },
                  MON + 7 * DAY + 3600000);
  assert.strictEqual(b.base.week, call(["dayKey", "weekKey"], `weekKey(${MON + 7 * DAY})`));
  assert.deepStrictEqual(b.base.stats, {}, "last week's anchors do not measure this week");
});

t("and the week just ended is kept, so there is a hall of fame", () => {
  const prev = { week: 0, at: MON, stats: { gymenergy: { 1: 10 } } };
  const b = roll({ week: 0, at: MON, stats: prev.stats, hist: [] }, MON + 7 * DAY);
  assert.strictEqual(b.hist.length, 1);
  assert.strictEqual(b.hist[0].week, 0);
});

t("the hall of fame is bounded, so storage cannot grow without limit", () => {
  let board = { week: 0, at: MON, stats: { gymenergy: { 1: 1 } }, rows: [], hist: [] };
  for (let w = 1; w <= 20; w++) {
    const out = roll(board, MON + w * 7 * DAY);
    board = out.base; board.hist = out.hist;
    // A real week gets a baseline written into it before the next rollover;
    // an empty one is nothing to archive and must not consume a slot.
    board.stats = { gymenergy: { 1: w } };
    board.rows = [{ rank: 1, id: 1, name: "a", energy: w }];
  }
  const WEEKS = call([], "BOARD_WEEKS");
  assert.strictEqual(board.hist.length, WEEKS);
  assert.strictEqual(board.hist[board.hist.length - 1].week, 19, "newest kept");
});

t("staying inside the same week leaves the baseline alone", () => {
  const stats = { gymenergy: { 1: 10 } };
  const b = roll({ week: call(["dayKey", "weekKey"], `weekKey(${MON})`), at: MON, stats: stats }, MON + 3 * DAY);
  assert.deepStrictEqual(b.base.stats, stats);
  assert.strictEqual(b.rolled, false);
});

// ---- natural regen --------------------------------------------------------

const natural = (dE, use, own) => call(["naturalEnergy"],
  `naturalEnergy(${dE}, ${JSON.stringify(use)}, ${own === undefined ? "null" : JSON.stringify(own)})`);

t("the assist energies are Torn's real numbers", () => {
  // Asserted as literals ON PURPOSE. Every other test here derives its
  // expectation from these constants, so a wrong constant agrees with itself
  // and the whole natural column would be quietly wrong.
  assert.strictEqual(call([], "XAN_ENERGY"), 250, "a xanax is 250 energy");
  assert.strictEqual(call([], "REFILL_ENERGY"), 150, "a refill fills a donator's 150 bar");
  assert.strictEqual(call([], "CAN_ENERGY"), 25, "a can of Munster is 25 energy");
});

t("energy that came out of a pill, a can or a refill is not natural", () => {
  const XAN = call([], "XAN_ENERGY"), REF = call([], "REFILL_ENERGY"), CAN = call([], "CAN_ENERGY");
  assert.strictEqual(natural(10000, { xantaken: 4, refills: 2, energydrinkused: 6 }),
    10000 - 4 * XAN - 2 * REF - 6 * CAN);
});

t("a week of pure regen is 100% natural", () => {
  assert.strictEqual(natural(3360, { xantaken: 0, refills: 0, energydrinkused: 0 }), 3360);
});

t("more assists than energy trained floors at zero, never negative", () => {
  assert.strictEqual(natural(100, { xantaken: 40, refills: 0, energydrinkused: 0 }), 0);
});

t("your OWN row uses your real bar and can strength, not the estimate", () => {
  // The coach already knows the owner's energy maximum and which can they
  // drink. Using the stranger-estimate for the one member it has real numbers
  // for would be a worse answer than it can give.
  const REF = call([], "REFILL_ENERGY");
  const withReal = natural(10000, { refills: 2 }, { energyMax: 100, canEnergy: 30 });
  assert.strictEqual(withReal, 10000 - 2 * 100);
  assert.notStrictEqual(100, REF, "fixture must differ from the default or this asserts nothing");
});

t("a missing consumable count is treated as zero, not as NaN", () => {
  assert.strictEqual(natural(5000, {}), 5000);
  assert.strictEqual(natural(5000, { xantaken: null, refills: undefined }), 5000);
});

t("the week label is the TCT date, not the reader's local one", () => {
  // Monday 00:00 UTC is Sunday 19:00 in New York. A local getter labels this
  // week with YESTERDAY's date, and the card then disagrees with the board it
  // came from.
  const label = call(["boardWeekLabel"], `boardWeekLabel(${MON})`);
  assert.strictEqual(new Date(MON).getUTCDate(), 5, "fixture sanity: epoch day 4 is the 5th");
  assert.ok(label.endsWith(" 5"), "labelled with the local date instead of TCT: " + label);
});

// ---- assembling the board -------------------------------------------------

const build = (args) => call(["naturalEnergy", "boardBuild"], `boardBuild(${args})`);

t("the board ranks on energy trained and carries the per-stat split beside it", () => {
  // gymstrength and friends are ENERGY SPENT on that stat, not points gained,
  // so they sum to gymenergy. Fixtures are consistent with that or they teach
  // the wrong model to whoever reads them next.
  const rows = build(JSON.stringify({
    gymenergy: { 1: { id: 1, name: "rcexyz", delta: 48300 }, 2: { id: 2, name: "quiet", delta: 900 } },
    gymtrains: { 1: { id: 1, name: "rcexyz", delta: 1932 }, 2: { id: 2, name: "quiet", delta: 90 } },
    gymstrength: { 1: { id: 1, name: "rcexyz", delta: 48300 } },
    gymdefense: { 2: { id: 2, name: "quiet", delta: 900 } }
  }) + ", null, null");
  assert.strictEqual(rows.length, 2);
  assert.strictEqual(rows[0].trains, 1932, "trains is its own counter, not derived from energy");
  assert.strictEqual(rows[1].trains, 90);
  assert.strictEqual(rows[0].name, "rcexyz");
  assert.strictEqual(rows[0].energy, 48300);
  assert.strictEqual(rows[0].str, 48300);
  assert.strictEqual(rows[0].def, 0, "a stat with no entry is zero, not undefined");
  assert.strictEqual(rows[1].def, 900);
});

// ---- what somebody trained ------------------------------------------------

const split = (r) => call(["boardSplit"], `boardSplit(${JSON.stringify(r)})`);

t("a week spent entirely on one stat says so, without a meaningless percentage", () => {
  assert.strictEqual(split({ str: 340, def: 0, spe: 0, dex: 0 }), "all str");
});

t("a mixed week is broken down as shares of the energy", () => {
  assert.strictEqual(split({ str: 600, def: 400, spe: 0, dex: 0 }), "str 60% \u00b7 def 40%");
});

t("the split is ordered by how much went into each, not by stat name", () => {
  assert.strictEqual(split({ str: 100, def: 900, spe: 0, dex: 0 }), "def 90% \u00b7 str 10%");
});

t("the split is NEVER read as points gained", () => {
  // The bug this replaces: 340 energy rendered as "+340 str", which reads as
  // 340 strength points. Nothing here may print a bare signed number.
  const s = split({ str: 600, def: 400, spe: 0, dex: 0 });
  assert.ok(!/\+/.test(s), "a leading + reads as a stat gain: " + s);
  assert.ok(!/\b600\b|\b400\b/.test(s), "raw energy printed as though it were a gain: " + s);
});

t("a stat that rounds to nothing is left off rather than shown as 0%", () => {
  assert.strictEqual(split({ str: 10000, def: 1, spe: 0, dex: 0 }), "all str");
});

t("a member who trained nothing has no split at all", () => {
  assert.strictEqual(split({ str: 0, def: 0, spe: 0, dex: 0 }), "");
});

t("trains come from gymtrains and are never inferred from the energy", () => {
  // Energy per train varies by gym -- 5e in a starter gym, 25e in a specialist
  // one -- so a train count divided out of energy would be fiction. It is its
  // own counter and it has to be read as one.
  const rows = build(JSON.stringify({
    gymenergy: { 1: { id: 1, name: "a", delta: 10000 } },
    gymtrains: { 1: { id: 1, name: "a", delta: 400 } }
  }) + ", null, null");
  assert.strictEqual(rows[0].trains, 400);
});

t("a member with energy but no train count reads as zero, not undefined", () => {
  const rows = build(JSON.stringify({
    gymenergy: { 1: { id: 1, name: "a", delta: 10000 } }
  }) + ", null, null");
  assert.strictEqual(rows[0].trains, 0);
});

t("trains never enter the per-stat split", () => {
  // gymtrains is a count of sessions; the split is shares of ENERGY. Folding
  // one into the other would put a fifth slice in a pie of four.
  assert.strictEqual(split({ str: 600, def: 400, spe: 0, dex: 0, trains: 999 }), "str 60% \u00b7 def 40%");
});

t("a member who trained nothing all week is still listed, at the bottom", () => {
  const rows = build(JSON.stringify({
    gymenergy: { 1: { id: 1, name: "a", delta: 0 }, 2: { id: 2, name: "b", delta: 5 } }
  }) + ", null, null");
  assert.strictEqual(rows.length, 2);
  assert.strictEqual(rows[1].name, "a");
});

t("natural energy lands on the row when the consumable counts are known", () => {
  const rows = build(JSON.stringify({
    gymenergy: { 1: { id: 1, name: "a", delta: 10000 } }
  }) + ", " + JSON.stringify({ 1: { xantaken: 4, refills: 0, energydrinkused: 0 } }) + ", null");
  assert.strictEqual(rows[0].natural, 10000 - 4 * call([], "XAN_ENERGY"));
});

t("and is null -- not zero -- when they are not", () => {
  // null means "not worked out yet"; 0 would mean "every point of it was
  // bought", which is a completely different claim about a person.
  const rows = build(JSON.stringify({ gymenergy: { 1: { id: 1, name: "a", delta: 10000 } } }) + ", null, null");
  assert.strictEqual(rows[0].natural, null);
});

// ---- how much of the week the board actually covers ------------------------

const SINCE = ["dayKey", "weekKey", "weekStartMs", "boardSince"];
const since = (at) => call(SINCE, `boardSince({week: weekKey(${MON}), at: ${at}})`);

t("a baseline frozen at the boundary really does cover the week", () => {
  assert.strictEqual(since(MON + 60000).partial, false);
});

t("a baseline anchored mid-week is flagged, not passed off as a full week", () => {
  // Everyone who installs this on a Thursday is in exactly this state, so the
  // header claiming "since Monday 00:00 TCT" would be false for all of them.
  assert.strictEqual(since(MON + 3 * DAY).partial, true);
  assert.strictEqual(since(MON + 3 * DAY).at, MON + 3 * DAY);
});

t("a board that has never been read has no window to report", () => {
  assert.strictEqual(call(SINCE, "boardSince(null)"), null);
  assert.strictEqual(call(SINCE, "boardSince({week: null, at: 0})"), null);
});

// ---- the shareable card ---------------------------------------------------

const CARD = [
  { rank: 1, id: 1, name: "rcexyz", energy: 48300, trains: 1932, natural: 41000, str: 36225, def: 12075, spe: 0, dex: 0 },
  { rank: 2, id: 2, name: "quiet", energy: 900, trains: 90, natural: null, str: 0, def: 900, spe: 0, dex: 0 }
];
const card = (fmt) => call(["fmt", "ROUND", "boardSplit", "boardWeekLabel", "boardSinceLabel", "boardCardText"],
  `boardCardText(${JSON.stringify(CARD)}, ${JSON.stringify({ faction: "Dead Fragment", week: MON, fmt: fmt })})`);

t("the card names the faction and the week it covers", () => {
  const s = card("chat");
  assert.ok(s.includes("Dead Fragment"), s);
  assert.ok(/Aug|Jan|1970|Mon/.test(s), "the week has to be stated or the card is undatable: " + s);
});

t("the card lists members in rank order with their energy", () => {
  const s = card("chat");
  assert.ok(s.indexOf("rcexyz") < s.indexOf("quiet"), "rank order");
  assert.ok(s.includes("48,300"), "thousands separators: " + s);
});

t("the card carries the train count as well as the energy", () => {
  const s = card("chat");
  assert.ok(/1,932/.test(s), "the train count is missing from the card: " + s);
  assert.ok(/train/i.test(s), "the train count needs a label or it is just a number: " + s);
});

t("the Discord card carries it too", () => {
  assert.ok(/1,932/.test(card("discord")), card("discord"));
});

t("the card carries the battle stats trained, not only the energy total", () => {
  const s = card("chat");
  assert.ok(/str 75%/.test(s), "the per-stat split is missing from the card: " + s);
  assert.ok(/all def/.test(s), "a single-stat week should read as 'all def': " + s);
});

t("a natural figure nobody worked out is left off that row rather than shown as zero", () => {
  const s = card("chat");
  const quietLine = s.split("\n").filter(l => l.includes("quiet"))[0];
  assert.ok(quietLine, "quiet is missing entirely");
  assert.ok(!/0%/.test(quietLine), "an unknown natural share was rendered as 0%: " + quietLine);
});

t("the Discord card is fenced so the columns survive the paste", () => {
  const s = card("discord");
  assert.ok(s.startsWith("```"), "no opening fence: " + s.slice(0, 40));
  assert.ok(s.trimEnd().endsWith("```"), "no closing fence");
});

t("the chat card is NOT fenced -- Torn chat renders backticks literally", () => {
  assert.ok(!card("chat").includes("```"));
});

t("a card that anchored mid-week says so on its face", () => {
  // Otherwise it lands in faction chat as a full week's standings when it is
  // three days of them.
  const s = call(["fmt", "ROUND", "boardSplit", "boardWeekLabel", "boardSinceLabel", "boardCardText"],
    `boardCardText(${JSON.stringify(CARD)}, ${JSON.stringify({ faction: "F", week: MON, fmt: "chat", since: { at: MON + 3 * DAY, start: MON, partial: true } })})`);
  assert.match(s, /counting from/, s.split("\n")[0]);
  assert.match(s.split("\n")[0], /Thu/, "the anchor day should be stated: " + s.split("\n")[0]);
});

t("and a card that really did start on Monday says nothing extra", () => {
  const s = call(["fmt", "ROUND", "boardSplit", "boardWeekLabel", "boardSinceLabel", "boardCardText"],
    `boardCardText(${JSON.stringify(CARD)}, ${JSON.stringify({ faction: "F", week: MON, fmt: "chat", since: { at: MON, start: MON, partial: false } })})`);
  assert.ok(!/counting from/.test(s), s.split("\n")[0]);
});

t("the card never runs away with a 100-member faction", () => {
  const many = [];
  for (let i = 1; i <= 100; i++) many.push({ rank: i, id: i, name: "m" + i, energy: 1000 - i, trains: 40, natural: null, str: 1000 - i, def: 0, spe: 0, dex: 0 });
  const s = call(["fmt", "ROUND", "boardSplit", "boardWeekLabel", "boardSinceLabel", "boardCardText"],
    `boardCardText(${JSON.stringify(many)}, ${JSON.stringify({ faction: "F", week: MON, fmt: "chat" })})`);
  assert.ok(s.split("\n").length <= 20, "a chat message cannot be 100 lines: " + s.split("\n").length);
  assert.ok(s.includes("m1"), "the top of the board must survive the trim");
});

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
