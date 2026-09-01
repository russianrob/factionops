import fs from "fs";
import { execSync } from "child_process";
const FILE = fs.realpathSync("gym-coach-beta.user.js");
const original = fs.readFileSync(FILE, "utf8");
const build = () => execSync("./build-harness.sh");
const U = "board.test.mjs";
const mutants = [
  // ---- the week boundary ----
  ["the week starts on Sunday, so every board is a day out of step",
    "  var WEEK_EPOCH_DAY = 4;", "  var WEEK_EPOCH_DAY = 3;", [U]],
  ["the week is seven days long only by accident",
    "    return Math.floor((dayKey(ms) - WEEK_EPOCH_DAY) / 7);",
    "    return Math.floor((dayKey(ms) - WEEK_EPOCH_DAY) / 6);", [U]],
  ["weekStartMs does not invert weekKey",
    "    return (wk * 7 + WEEK_EPOCH_DAY) * DAY_MS;",
    "    return wk * 7 * DAY_MS;", [U]],

  // ---- anchoring ----
  ["a member is re-anchored on EVERY read, so every delta is zero forever",
    "      if (!(id in map)) map[id] = v;", "      map[id] = v;", [U]],
  ["an unseen member is never anchored, so their lifetime total ranks as one week",
    "      if (!(id in map)) map[id] = v;", "      if (false) map[id] = v;", [U]],
  ["a counter that reset is not re-anchored, so the board renders negatives",
    "      else if (v < map[id]) map[id] = v;", "", [U]],
  ["the delta measures against zero rather than the baseline",
    "      out[id] = { id: r.id, name: r.username, value: v, delta: v - (map[id] || 0) };",
    "      out[id] = { id: r.id, name: r.username, value: v, delta: v };", [U]],
  ["all five stats share one baseline",
    "    var map = base.stats[stat] || (base.stats[stat] = {});",
    "    var map = base.stats.all || (base.stats.all = {});", [U]],

  // ---- rollover ----
  ["last week's anchors carry into the new week",
    "    return { base: { week: wk, at: now, stats: {}, hist: hist }, hist: hist, rolled: true };",
    "    return { base: { week: wk, at: now, stats: board ? board.stats : {}, hist: hist }, hist: hist, rolled: true };", [U]],
  ["the week never rolls, so the board is frozen at whenever it first ran",
    "    if (board && board.week === wk) return { base: board, hist: hist, rolled: false };",
    "    if (board) return { base: board, hist: hist, rolled: false };", [U]],
  ["the hall of fame is unbounded",
    "      if (hist.length > BOARD_WEEKS) hist = hist.slice(hist.length - BOARD_WEEKS);", "", [U]],
  ["the hall of fame keeps the OLDEST weeks and drops the newest",
    "      if (hist.length > BOARD_WEEKS) hist = hist.slice(hist.length - BOARD_WEEKS);",
    "      if (hist.length > BOARD_WEEKS) hist = hist.slice(0, BOARD_WEEKS);", [U]],

  // ---- natural regen ----
  ["xanax is not subtracted, so a pill-stacker tops the natural board",
    "    var assisted = XAN_ENERGY * (Number(u.xantaken) || 0) +", "    var assisted = 0 * (Number(u.xantaken) || 0) +", [U]],
  ["refills are not subtracted", "                   refillE * (Number(u.refills) || 0) +", "                   0 * (Number(u.refills) || 0) +", [U]],
  ["cans are not subtracted", "                   canE * (Number(u.energydrinkused) || 0);", "                   0 * (Number(u.energydrinkused) || 0);", [U]],
  ["a xanax is worth the wrong energy", "  var XAN_ENERGY = 250;", "  var XAN_ENERGY = 150;", [U]],
  ["natural energy can go negative", "    return Math.max(0, (Number(dEnergy) || 0) - assisted);", "    return (Number(dEnergy) || 0) - assisted;", [U]],
  ["the owner's real bar is ignored in favour of the stranger estimate",
    "    var refillE = (own && own.energyMax) || REFILL_ENERGY;", "    var refillE = REFILL_ENERGY;", [U]],

  // ---- assembling ----
  ["the board is ranked by name instead of by energy",
    "    rows.sort(function (a, b) { return b.energy - a.energy || String(a.name).localeCompare(String(b.name)); });",
    "    rows.sort(function (a, b) { return String(a.name).localeCompare(String(b.name)); });", [U]],
  ["a stat with no entry comes out undefined rather than zero",
    "        return (m[id] && m[id].delta) || 0;", "        return m[id] && m[id].delta;", [U]],
  ["an unknown natural figure is reported as zero -- as though every point was bought",
    "        natural: use ? naturalEnergy(e.delta || 0, use, own && String(own.id) === String(e.id) ? own : null) : null,",
    "        natural: naturalEnergy(e.delta || 0, use || {}, null),", [U]],
  ["the draft aliases the baseline, so anchoring is not atomic after all",
    "      out.stats[k] = {};\n      for (q in src[k]) out.stats[k][q] = src[k][q];",
    "      out.stats[k] = src[k];", [U]],
  ["the draft copies no anchors at all, so every week restarts from zero",
    "    for (k in src) {", "    for (k in {}) {", [U]],
  ["the train count is inferred from the energy instead of read",
    '        trains: d("gymtrains"),', "        trains: Math.round((e.delta || 0) / 10),", [U]],
  ["trains are folded into the per-stat split, making a pie of five out of four",
    `    var parts = [["str", r.str], ["def", r.def], ["spe", r.spe], ["dex", r.dex]]`,
    `    var parts = [["str", r.str], ["def", r.def], ["spe", r.spe], ["dex", r.dex], ["trn", r.trains]]`, [U]],
  ["the card prints 0% natural where the table prints nothing at all",
    "      var np = boardNatPct(r);\n      var nat = np === null ? \"\" : \" (\" + np + \"% natural)\";",
    "      var nat = \" (\" + Math.round(((r.natural || 0) / Math.max(1, r.energy)) * 100) + \"% natural)\";", [U]],
  ["past weeks archive every member's full row again",
    "                            rows: (board.rows || []).slice(0, 3) }]);",
    "                            rows: (board.rows || []) }]);", [U]],
  ["the card drops the train count",
    '      var trains = r.trains > 0 ? " / " + fmt(r.trains) + " train" + (r.trains === 1 ? "" : "s") : "";',
    '      var trains = "";', [U]],
  ["battle stats are dropped from the row",
    '        str: d("gymstrength"), def: d("gymdefense"),', "        str: 0, def: 0,", [U]],
  ["the split is printed as a signed number again -- the 0.9.45 bug",
    '    return shown.map(function (p) { return p.k + " " + p.pct + "%"; }).join(" \\u00b7 ");',
    '    return parts.map(function (p) { return "+" + p[1] + " " + p[0]; }).join(" ");', [U]],
  ["a single-stat week claims a percentage split it does not have",
    '    if (shown.length <= 1) return "all " + parts[0][0];', "", [U]],
  ["the split is not ordered by how much went into each",
    "      .sort(function (a, b) { return b[1] - a[1]; });", "", [U]],
  ["shares are worked out against the wrong denominator",
    "      return { k: p[0], pct: Math.round((p[1] / total) * 100) };",
    "      return { k: p[0], pct: Math.round((p[1] / 1000) * 100) };", [U]],

  // ---- the card ----
  ["the card is unbounded, so a 100-member faction is a 100-line chat message",
    "    var shown = rows.slice(0, BOARD_CARD_ROWS);", "    var shown = rows.slice(0);", [U]],
  ["the chat card is fenced, which Torn renders as literal backticks",
    '    return head + "\\n" + lines.join("\\n") + (more > 0 ? "\\n+ " + more + " more" : "");',
    '    return "```\\n" + head + "\\n" + lines.join("\\n") + (more > 0 ? "\\n+ " + more + " more" : "") + "\\n```";', [U]],
  ["the Discord card loses its fence, so the columns collapse",
    '      return "```\\n" + head + "\\n" + lines.join("\\n") +\n             (more > 0 ? "\\n+ " + more + " more" : "") + "\\n```";',
    '      return head + "\\n" + lines.join("\\n") + (more > 0 ? "\\n+ " + more + " more" : "");', [U]],
  ["the card drops the faction and the week, so nobody can tell what it is",
    '    var head = "Gym week of " + boardWeekLabel(o.week) + " — " + (o.faction || "faction") +',
    '    var head = "Gym board" + "" +', [U]],
  ["the card drops the per-stat split and reports energy only",
    '      return r.rank + ". " + r.name + " — " + fmt(r.energy) + "e" + trains + nat + (split ? " — " + split : "");',
    '      return r.rank + ". " + r.name + " — " + fmt(r.energy) + "e" + trains + nat;', [U]],
  ["a mid-week baseline is passed off as a full week",
    "    return { at: at, start: start, partial: at - start > BOARD_PARTIAL_MS };",
    "    return { at: at, start: start, partial: false };", [U]],
  ["the slack window swallows most of the week, so a Thursday install claims Monday",
    "  var BOARD_PARTIAL_MS = 600000;", "  var BOARD_PARTIAL_MS = 600000000;", [U]],
  ["boardSince ignores the anchor and always reports the boundary",
    "    var at = Number(board.at) || start;", "    var at = start;", [U]],
  ["the partial-week caveat is dropped from the card",
    '      (o.since && o.since.partial ? " (counting from " + boardSinceLabel(o.since.at) + ")" : "");', '      "";', [U]],
  ["the since-label is read through local getters too",
    '    return DAYS[d.getUTCDay()] + " " + pad(d.getUTCHours()) + ":" + pad(d.getUTCMinutes()) + " TCT";',
    '    return DAYS[d.getDay()] + " " + pad(d.getHours()) + ":" + pad(d.getMinutes()) + " TCT";', [U]],
  ["the week label is read through local getters, so it is a day early west of Greenwich",
    "    return MON[d.getUTCMonth()] + \" \" + d.getUTCDate();",
    "    return MON[d.getMonth()] + \" \" + d.getDate();", [U]],
];
let killed = 0; const survived = [];
for (const [name, from, to, suites] of mutants) {
  if (!original.includes(from)) { console.log("SKIP (no match) " + name); survived.push(name + " [NO MATCH]"); continue; }
  fs.writeFileSync(FILE, original.replace(from, to));
  build();
  let anyRed = false;
  for (const s of suites) { try { execSync("node " + s, { stdio: "pipe" }); } catch { anyRed = true; } }
  if (anyRed) { killed++; console.log("killed    " + name); }
  else { survived.push(name); console.log("SURVIVED  " + name); }
}
fs.writeFileSync(FILE, original); build();
console.log("\n" + killed + " killed, " + survived.length + " survived");
if (survived.length) { console.log("\nvacuous coverage:"); survived.forEach(s => console.log("  - " + s)); }
process.exit(survived.length ? 1 : 0);
