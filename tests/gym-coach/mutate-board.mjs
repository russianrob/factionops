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
    "    return { base: { week: wk, at: now, stats: {}, statsAt: {}, hist: hist }, hist: hist, rolled: true };",
    "    return { base: { week: wk, at: now, stats: board ? board.stats : {}, statsAt: {}, hist: hist }, hist: hist, rolled: true };", [U]],
  ["the week never rolls, so the board is frozen at whenever it first ran",
    "    if (board && board.week === wk) return { base: board, hist: hist, rolled: false };",
    "    if (board) return { base: board, hist: hist, rolled: false };", [U]],
  ["the hall of fame is unbounded",
    "      if (hist.length > BOARD_WEEKS) hist = hist.slice(hist.length - BOARD_WEEKS);", "", [U]],
  ["the hall of fame keeps the OLDEST weeks and drops the newest",
    "      if (hist.length > BOARD_WEEKS) hist = hist.slice(hist.length - BOARD_WEEKS);",
    "      if (hist.length > BOARD_WEEKS) hist = hist.slice(0, BOARD_WEEKS);", [U]],

  // ---- natural regen ----
  // ---- assembling ----
  ["attack energy is counted as gym energy, hiding the difference",
    "        attacks: atkN,", "        attacks: atkN, energy: e.delta + boardAttackEnergy(d(\"attackswon\"), d(\"attackslost\")),", [U]],
  ["only won attacks are counted, flattering whoever picks easy targets",
    "    var n = Math.max(0, Number(won) || 0) + Math.max(0, Number(lost) || 0);",
    "    var n = Math.max(0, Number(won) || 0);", [U]],
  ["an attack is priced wrong",
    "  var ATTACK_ENERGY = 25;", "  var ATTACK_ENERGY = 10;", [U]],
  ["the year board ranks on the lifetime counter instead of the year",
    "    out.sort(function (a, b) { return b.taken - a.taken || String(a.name).localeCompare(String(b.name)); });",
    "    out.sort(function (a, b) { return b.total - a.total; });", [U]],
  ["a member with no year-ago baseline is counted as having taken none",
    "      if (!r || r.then == null) continue;", "      if (!r) continue;", [U]],
  ["the year window rolls back twelve months instead of starting on 1 January",
    "    return Date.UTC(new Date(Number(now) || Date.now()).getUTCFullYear(), 0, 1);",
    "    var d = new Date(Number(now) || Date.now()); d.setUTCFullYear(d.getUTCFullYear() - 1); return d.getTime();", [U]],
  ["the year starts at LOCAL midnight, so it is hours out from Torn's",
    "    return Date.UTC(new Date(Number(now) || Date.now()).getUTCFullYear(), 0, 1);",
    "    return new Date(new Date(Number(now) || Date.now()).getFullYear(), 0, 1).getTime();", [U]],
  ["a counter that went backwards produces a negative year total",
    "        taken: Math.max(0, (Number(r.now) || 0) - (Number(r.then) || 0)),",
    "        taken: (Number(r.now) || 0) - (Number(r.then) || 0),", [U]],
  ["the board is ranked by name instead of by energy",
    "    rows.sort(function (a, b) { return b.energy - a.energy || String(a.name).localeCompare(String(b.name)); });",
    "    rows.sort(function (a, b) { return String(a.name).localeCompare(String(b.name)); });", [U]],
  ["a stat with no entry comes out undefined rather than zero",
    "        return (m[id] && m[id].delta) || 0;", "        return m[id] && m[id].delta;", [U]],
  ["the draft aliases the baseline, so anchoring is not atomic after all",
    "      out.stats[k] = {};\n      for (q in src[k]) out.stats[k][q] = src[k][q];",
    "      out.stats[k] = src[k];", [U]],
  ["the draft copies no anchors at all, so every week restarts from zero",
    "    for (k in src) {", "    for (k in {}) {", [U]],
  ["a stat's baseline is never stamped, so a skew can never be seen",
    "    if (!base.statsAt[stat]) base.statsAt[stat] = Number(now) || Date.now();", "", [U]],
  ["the stamp is rewritten on every read, so it always looks freshly anchored",
    "    if (!base.statsAt[stat]) base.statsAt[stat] = Number(now) || Date.now();",
    "    base.statsAt[stat] = Number(now) || Date.now();", [U]],
  ["a missing stamp is read as 1970, crying wolf on every older board",
    "      if (!v) continue;", "", [U]],
  // NOT listed: dropping the `n >= 2` guard from boardSkew. With one stat lo
  // and hi are the same reading, so hi - lo is zero either way -- provably
  // equivalent. The guard stays because it says what the function means.
  ["the skew threshold is tighter than a single round of requests",
    "  var BOARD_SKEW_MS = 60000;", "  var BOARD_SKEW_MS = 1000;", [U]],
  ["the draft drops the stamps, so committing a round loses them",
    "    for (var a in srcAt) out.statsAt[a] = srcAt[a];", "", [U]],
  ["past weeks archive every member's full row again",
    "                            rows: (board.rows || []).slice(0, 3) }]);",
    "                            rows: (board.rows || []) }]);", [U]],
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
