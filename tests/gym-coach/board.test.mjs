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
  /var ATTACK_ENERGY = [^;]+;/, /var BOARD_GAP_MS = [^;]+;/, /var BOARD_SKEW_MS = [^;]+;/, /var BOARD_SPLIT_STATS = \[[^\]]*\];/,
  /var BOARD_PARTIAL_MS = [^;]+;/,
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

t("a draft does not alias the baseline it was copied from", () => {
  // The whole atomic-anchoring claim rests on this. A shallow copy shares the
  // per-stat maps, so boardSnap anchors into the LIVE baseline and a round that
  // dies half-way still half-moves it -- while a test that only inspects
  // storage sees nothing wrong, which is exactly what happened.
  const out = new Function("var R;" + env("boardDraft", "boardSnap", "boardDeltas") + `
    var base = { week: 1, at: 5, stats: { gymenergy: { 1: 100 }, gymtrains: { 1: 9 } } };
    var d = boardDraft(base);
    boardDeltas(d, "gymenergy", [{ id: 1, username: "a", value: 40 }]);   // forces a re-anchor
    boardDeltas(d, "gymspeed",  [{ id: 7, username: "b", value: 12 }]);   // a brand-new stat
    R = { base: base, draft: d };
    return R;`)();
  assert.strictEqual(out.base.stats.gymenergy["1"], 100, "the live baseline was re-anchored by a draft");
  assert.strictEqual(out.draft.stats.gymenergy["1"], 40, "the draft did not record the re-anchor");
  assert.strictEqual(out.base.stats.gymspeed, undefined, "a draft added a stat to the live baseline");
});

t("a draft carries the baseline STAMPS too, not just the anchors", () => {
  // Dropped, and committing a round would silently lose when each stat was
  // anchored -- which is the whole basis for spotting a skew.
  const d = call(["boardDraft"], `boardDraft({ week: 1, at: 5, stats: { gymenergy: { 1: 100 } }, statsAt: { gymenergy: 4242 } })`);
  assert.strictEqual(d.statsAt.gymenergy, 4242);
});

t("a draft carries the week's existing anchors, so the week keeps counting", () => {
  // The other half. A draft that starts empty is perfectly atomic and
  // perfectly useless: every member re-anchors at their current value and the
  // whole faction reads zero, for ever.
  const out = new Function("var R;" + env("boardDraft", "boardSnap", "boardDeltas") + `
    var base = { week: 1, at: 5, stats: { gymenergy: { 1: 100 } } };
    R = boardDeltas(boardDraft(base), "gymenergy", [{ id: 1, username: "a", value: 150 }]);
    return R;`)();
  assert.strictEqual(out["1"].delta, 50, "the draft lost the baseline it was copied from");
});

t("a draft of nothing is still a usable draft", () => {
  const d = call(["boardDraft"], "boardDraft(null)");
  assert.deepStrictEqual(d.stats, {});
  assert.strictEqual(d.week, null);
});

// ---- were the baselines even taken at the same moment? ---------------------
//
// Reported: 1,470 energy against 113 trains, at 10 energy a train. The energy
// is right and the trains are short, and there is no way to tell from the board
// whether that is Torn's two counters updating at different rates, a week spent
// across two gyms, or six baselines frozen at six different moments -- which is
// what the pre-0.9.51 anchoring did when a round died half-way.
//
// A stat's OWN delta is honest either way. Any RATIO between two of them is not,
// because they may be measuring windows of different lengths.

t("each stat records when its baseline was taken", () => {
  const out = new Function("var R;" + env("boardSnap") + `
    var base = { week: 1, stats: {} };
    boardSnap(base, "gymenergy", [{ id: 1, username: "a", value: 100 }], 1000);
    boardSnap(base, "gymtrains", [{ id: 1, username: "a", value: 10 }], 5000);
    R = base.statsAt;
    return R;`)();
  assert.strictEqual(out.gymenergy, 1000);
  assert.strictEqual(out.gymtrains, 5000);
});

t("the stamp is the FIRST anchoring, not the latest read", () => {
  // Otherwise it would say every stat was anchored a moment ago, on every read,
  // and could never reveal a skew.
  const out = new Function("var R;" + env("boardSnap") + `
    var base = { week: 1, stats: {} };
    boardSnap(base, "gymenergy", [{ id: 1, username: "a", value: 100 }], 1000);
    boardSnap(base, "gymenergy", [{ id: 1, username: "a", value: 150 }], 9000);
    R = base.statsAt.gymenergy;
    return R;`)();
  assert.strictEqual(out, 1000);
});

const skew = (statsAt) => call(["boardSkew"], `boardSkew(${JSON.stringify({ statsAt })})`);

t("baselines taken together have no skew", () => {
  assert.strictEqual(skew({ gymenergy: 1000, gymtrains: 1300, gymstrength: 2000 }), 1000);
});

t("baselines taken hours apart report the spread", () => {
  assert.strictEqual(skew({ gymenergy: 1000, gymtrains: 3601000 }), 3600000);
});

t("a board with one stat, or none, has nothing to compare", () => {
  assert.strictEqual(skew({ gymenergy: 1000 }), 0);
  assert.strictEqual(skew({}), 0);
  assert.strictEqual(skew(undefined), 0);
});

t("a missing stamp does not read as 1970 and invent an enormous skew", () => {
  // Boards anchored before this existed have no stamps at all. Treating an
  // absent one as zero would report a 56-year spread and cry wolf on every
  // board in existence.
  //
  // The zero comes SECOND on purpose: with it first, a version that fails to
  // skip it still returns 0 by accident of the `!lo` short-circuit, and the
  // test proves nothing.
  assert.strictEqual(skew({ gymtrains: 5000, gymenergy: 0 }), 0);
  assert.strictEqual(skew({ gymenergy: 0, gymtrains: 5000 }), 0);
});

t("the threshold is wide enough for a normal round but not for a broken one", () => {
  // Six requests spaced 700ms apart is about four seconds end to end, so the
  // threshold has to clear that comfortably while still catching a half-anchored
  // week.
  const gap = call([], "BOARD_GAP_MS"), thr = call([], "BOARD_SKEW_MS");
  assert.ok(thr > gap * 6, "threshold " + thr + " must clear a whole round of " + (gap * 6));
  assert.ok(thr <= 300000, "and still catch a genuinely skewed board");
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

t("an archived week keeps the podium, not the whole roster", () => {
  // "Past weeks" renders ONE name per week. Archiving every member's full row
  // for a hundred-member faction is ~800 stored objects to show eight names --
  // into a localStorage that storeSet writes inside a swallowed try/catch, so
  // hitting quota loses the save with no error. This origin shares its quota
  // with Torn's own chat.
  const many = [];
  for (let i = 1; i <= 60; i++) many.push({ rank: i, id: i, name: "m" + i, energy: 100 - i });
  const out = roll({ week: 0, at: MON, stats: { gymenergy: { 1: 1 } }, rows: many, hist: [] },
                   MON + 7 * DAY);
  assert.ok(out.hist[0].rows.length <= 3, "archived " + out.hist[0].rows.length + " rows to render one name");
  assert.strictEqual(out.hist[0].rows[0].name, "m1", "and it has to be the TOP of the board");
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

t("the week label is the TCT date, not the reader's local one", () => {
  // Monday 00:00 UTC is Sunday 19:00 in New York. A local getter labels this
  // week with YESTERDAY's date, and the card then disagrees with the board it
  // came from.
  const label = call(["boardWeekLabel"], `boardWeekLabel(${MON})`);
  assert.strictEqual(new Date(MON).getUTCDate(), 5, "fixture sanity: epoch day 4 is the 5th");
  assert.ok(label.endsWith(" 5"), "labelled with the local date instead of TCT: " + label);
});

// ---- assembling the board -------------------------------------------------

const build = (args) => call(["boardAttackEnergy", "boardBuild"], `boardBuild(${args})`);

t("the board ranks on energy trained and carries the per-stat split beside it", () => {
  // gymstrength and friends are ENERGY SPENT on that stat, not points gained,
  // so they sum to gymenergy. Fixtures are consistent with that or they teach
  // the wrong model to whoever reads them next.
  const rows = build(JSON.stringify({
    gymenergy: { 1: { id: 1, name: "rcexyz", delta: 48300 }, 2: { id: 2, name: "quiet", delta: 900 } },
    gymstrength: { 1: { id: 1, name: "rcexyz", delta: 48300 } },
    gymdefense: { 2: { id: 2, name: "quiet", delta: 900 } }
  }) + ", null, null");
  assert.strictEqual(rows.length, 2);
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




t("a member who trained nothing all week is still listed, at the bottom", () => {
  const rows = build(JSON.stringify({
    gymenergy: { 1: { id: 1, name: "a", delta: 0 }, 2: { id: 2, name: "b", delta: 5 } }
  }) + ", null, null");
  assert.strictEqual(rows.length, 2);
  assert.strictEqual(rows[1].name, "a");
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

// ---- the four stat counters must sum to the energy counter -----------------
//
// gymstrength and its three siblings are ENERGY spent on that stat, so they add
// up to gymenergy by construction. That makes it checkable from data the board
// already has -- and it needs no knowledge of anyone's gym, which is the one
// thing the API will never give: FactionContributor is {id, username, value,
// in_faction} and there is no /user/{id}/gym path at all.
//
// Reported: 1,470 energy against 113 trains at 10 energy a train. If the five
// energy counters agree with each other, the baselines were taken together and
// the fault is gymtrains alone.

const sumCheck = (byStat, id) => call(["boardStatSum"], `boardStatSum(${JSON.stringify(byStat)}, ${JSON.stringify(id)})`);
const d = (v) => ({ 7: { id: 7, name: "x", delta: v } });

t("counters that add up are reported as agreeing", () => {
  const out = sumCheck({ gymenergy: d(1470), gymstrength: d(1470), gymdefense: d(0),
                         gymspeed: d(0), gymdexterity: d(0) }, 7);
  assert.strictEqual(out.energy, 1470);
  assert.strictEqual(out.sum, 1470);
  assert.strictEqual(out.ok, true);
});

t("a split across stats still has to add up", () => {
  const out = sumCheck({ gymenergy: d(1000), gymstrength: d(600), gymdefense: d(400),
                         gymspeed: d(0), gymdexterity: d(0) }, 7);
  assert.strictEqual(out.sum, 1000);
  assert.strictEqual(out.ok, true);
});

t("counters that do NOT add up are reported as disagreeing", () => {
  // This is the signature of baselines taken at different moments: the energy
  // counter covers a longer window than the stat counters, or the reverse.
  const out = sumCheck({ gymenergy: d(1470), gymstrength: d(1130), gymdefense: d(0),
                         gymspeed: d(0), gymdexterity: d(0) }, 7);
  assert.strictEqual(out.sum, 1130);
  assert.strictEqual(out.energy, 1470);
  assert.strictEqual(out.ok, false);
});

t("the check is exact, not approximate", () => {
  // These are whole energy counters. A tolerance would wave through exactly the
  // small skew that is hardest to spot by eye.
  assert.strictEqual(sumCheck({ gymenergy: d(1000), gymstrength: d(999), gymdefense: d(0),
                                gymspeed: d(0), gymdexterity: d(0) }, 7).ok, false);
});

t("a member with no energy row cannot be checked", () => {
  assert.strictEqual(sumCheck({ gymstrength: d(10) }, 7), null);
  assert.strictEqual(sumCheck({}, 7), null);
  assert.strictEqual(sumCheck(null, 7), null);
});

t("a stat that has not been fetched yet means no verdict, not a false alarm", () => {
  // Mid-round, three of the four may have landed. Reporting a mismatch then
  // would cry wolf on every board while it is still loading.
  assert.strictEqual(sumCheck({ gymenergy: d(1000), gymstrength: d(1000) }, 7), null);
});

t("a member absent from a stat counts as zero for that stat, not as missing", () => {
  // Somebody who never touched dexterity simply has no row in that map. That is
  // a real zero, and treating it as "not fetched" would suppress every check.
  const out = sumCheck({ gymenergy: d(600), gymstrength: d(600),
                         gymdefense: {}, gymspeed: {}, gymdexterity: {} }, 7);
  assert.strictEqual(out.ok, true);
});

// ---- energy that went into attacking rather than the gym -------------------
//
// Torn has no attack-energy counter. FactionStatEnum carries attack COUNTS --
// attackswon, attackslost and the rest -- so the energy is derived at 25 an
// attack, which is what one costs. Derived, and labelled as derived: the count
// is shown beside it so it can be checked rather than trusted.

const atk = (won, lost) => call(["boardAttackEnergy"], `boardAttackEnergy(${won}, ${lost})`);

t("attack energy is the attacks made, at what an attack costs", () => {
  const AE = call([], "ATTACK_ENERGY");
  assert.strictEqual(atk(10, 4), { n: 14, energy: 14 * AE }.energy);
  assert.strictEqual(AE, 25, "a Torn attack costs 25 energy");
});

t("wins and losses are both attacks you paid for", () => {
  // Losing one still spent the energy. Counting only wins would flatter
  // whoever picks the easiest targets.
  assert.ok(atk(10, 10) > atk(10, 0));
});

t("no attacks is no energy, not a missing figure", () => {
  assert.strictEqual(atk(0, 0), 0);
  assert.strictEqual(atk(null, undefined), 0);
});

t("a negative count cannot credit energy back", () => {
  assert.strictEqual(atk(-5, 0), 0);
});

// ---- the board carries both, separately ------------------------------------

t("gym energy and attack energy are kept apart", () => {
  // The whole point: one number is what reached the gym, the other is what
  // never did. Summing them would hide exactly the thing being asked.
  const rows = call(["boardAttackEnergy", "boardBuild"], `boardBuild(${JSON.stringify({
    gymenergy: { 1: { id: 1, name: "a", delta: 1000 } },
    attackswon: { 1: { id: 1, name: "a", delta: 8 } },
    attackslost: { 1: { id: 1, name: "a", delta: 2 } }
  })}, null, null)`);
  assert.strictEqual(rows[0].energy, 1000);
  assert.strictEqual(rows[0].attacks, 10);
  assert.strictEqual(rows[0].attackEnergy, 250);
});

t("a member who only attacked still appears, with no gym energy", () => {
  const rows = call(["boardAttackEnergy", "boardBuild"], `boardBuild(${JSON.stringify({
    gymenergy: { 1: { id: 1, name: "a", delta: 0 } },
    attackswon: { 1: { id: 1, name: "a", delta: 40 } },
    attackslost: {}
  })}, null, null)`);
  assert.strictEqual(rows[0].energy, 0);
  assert.strictEqual(rows[0].attackEnergy, 1000);
});

t("the board still ranks on gym energy, not on the two combined", () => {
  // It is a gym board. Somebody who spent the week attacking should not top it.
  const rows = call(["boardAttackEnergy", "boardBuild"], `boardBuild(${JSON.stringify({
    gymenergy: { 1: { id: 1, name: "trainer", delta: 500 }, 2: { id: 2, name: "fighter", delta: 100 } },
    attackswon: { 2: { id: 2, name: "fighter", delta: 200 } },
    attackslost: {}
  })}, null, null)`);
  assert.strictEqual(rows[0].name, "trainer");
});

// ---- a year of xanax -------------------------------------------------------
//
// xantaken is in personalstats, which is PUBLIC for another player and answers
// historically with a timestamp -- so a year's total is an exact subtraction,
// not an estimate. Same two calls the regen column makes, a year apart instead
// of a week.

const yearAgo = (now) => call(["yearStartMs"], `yearStartMs(${now})`);

t("the window starts on 1 January of the current year", () => {
  // The calendar year, not a rolling twelve months: "who has taken the most
  // this year" is a question with a fixed start date that everybody shares.
  assert.strictEqual(yearAgo(Date.UTC(2026, 8, 2, 12, 0, 0)), Date.UTC(2026, 0, 1));
  assert.strictEqual(yearAgo(Date.UTC(2026, 0, 1, 0, 0, 1)), Date.UTC(2026, 0, 1));
});

t("it is midnight TCT on the 1st, not local midnight", () => {
  // Torn's day is TCT = UTC. A local getter would start the year hours out and
  // the board would disagree with Torn's own counters at the boundary.
  const d = new Date(yearAgo(Date.UTC(2026, 5, 15)));
  assert.strictEqual(d.getUTCMonth(), 0);
  assert.strictEqual(d.getUTCDate(), 1);
  assert.strictEqual(d.getUTCHours(), 0);
  assert.strictEqual(d.getUTCMinutes(), 0);
});

t("a new calendar year moves the window, so the board resets on 1 January", () => {
  assert.notStrictEqual(yearAgo(Date.UTC(2027, 0, 1)), yearAgo(Date.UTC(2026, 11, 31)));
  assert.strictEqual(yearAgo(Date.UTC(2027, 0, 1)), Date.UTC(2027, 0, 1));
});

const xan = (rows) => call(["xanBuild"], `xanBuild(${JSON.stringify(rows)})`);

t("members are ranked by how many they have taken in the window", () => {
  const out = xan({ 1: { id: 1, name: "a", now: 900, then: 400 },
                    2: { id: 2, name: "b", now: 1200, then: 1000 } });
  assert.strictEqual(out[0].name, "a");
  assert.strictEqual(out[0].taken, 500);
  assert.strictEqual(out[1].taken, 200);
});

t("a lifetime total is not a year's total", () => {
  // The whole point of the subtraction: b has taken more xanax ever and fewer
  // this year, and ranking on the raw counter would have it top the board.
  const out = xan({ 1: { id: 1, name: "a", now: 900, then: 400 },
                    2: { id: 2, name: "b", now: 5000, then: 4900 } });
  assert.strictEqual(out[0].name, "a");
});

t("a counter that went backwards is zero, not a negative", () => {
  const out = xan({ 1: { id: 1, name: "a", now: 100, then: 400 } });
  assert.strictEqual(out[0].taken, 0);
});

t("somebody with no baseline yet is left out rather than counted as zero", () => {
  // Absent means "not fetched", which is a different claim from "took none".
  const out = xan({ 1: { id: 1, name: "a", now: 900, then: null },
                    2: { id: 2, name: "b", now: 300, then: 100 } });
  assert.strictEqual(out.length, 1);
  assert.strictEqual(out[0].name, "b");
});

t("a member who took none in the year is still listed", () => {
  // Zero is a real answer here and worth seeing -- it is the opposite end of
  // the same question.
  const out = xan({ 1: { id: 1, name: "a", now: 400, then: 400 } });
  assert.strictEqual(out.length, 1);
  assert.strictEqual(out[0].taken, 0);
});

// ---- the shareable card ---------------------------------------------------

const CARD = [
  { rank: 1, id: 1, name: "rcexyz", energy: 48300, natural: 41000, str: 36225, def: 12075, spe: 0, dex: 0 },
  { rank: 2, id: 2, name: "quiet", energy: 900, natural: null, str: 0, def: 900, spe: 0, dex: 0 }
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



t("the card carries the battle stats trained, not only the energy total", () => {
  const s = card("chat");
  assert.ok(/str 75%/.test(s), "the per-stat split is missing from the card: " + s);
  assert.ok(/all def/.test(s), "a single-stat week should read as 'all def': " + s);
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
  for (let i = 1; i <= 100; i++) many.push({ rank: i, id: i, name: "m" + i, energy: 1000 - i, natural: null, str: 1000 - i, def: 0, spe: 0, dex: 0 });
  const s = call(["fmt", "ROUND", "boardSplit", "boardWeekLabel", "boardSinceLabel", "boardCardText"],
    `boardCardText(${JSON.stringify(many)}, ${JSON.stringify({ faction: "F", week: MON, fmt: "chat" })})`);
  assert.ok(s.split("\n").length <= 20, "a chat message cannot be 100 lines: " + s.split("\n").length);
  assert.ok(s.includes("m1"), "the top of the board must survive the trim");
});

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
