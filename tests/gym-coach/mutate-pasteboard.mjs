// Mutation gate for the FAA gate and the paste board (0.9.71).
//
// Each entry breaks one rule the way a careless edit really could. If the suite
// still passes, the test meant to cover that line is vacuous -- a green suite
// against broken code is worse than no suite, because it reads as proof.
import fs from "fs";
import { execSync } from "child_process";

const FILE = "gym-coach-beta.user.js";
const original = fs.readFileSync(FILE, "utf8");
// The source is restored from this snapshot at the end, so do NOT edit
// gym-coach-beta.user.js while this is running -- the restore silently
// reverts whatever you changed (it ate a version bump once).
const build = () => execSync("./build-harness.sh");

// [name, from, to, suite]. The unit suite covers the rules; the browser suite
// is the only thing that can say whether any of them are WIRED to a button.
const mutants = [
  // ---- the gate ----
  ["the settings override stops working",
    "    if (force) return true;\n", "",
    "boardline.test.mjs"],
  ["either signal on its own opens the tab",
    "return keyLevel.faction === true && keyLevel.contributors === true;",
    "return keyLevel.faction === true || keyLevel.contributors === true;",
    "boardline.test.mjs"],
  ["no answer yet is treated as a yes",
    "    if (!keyLevel) return false;", "    if (!keyLevel) return true;",
    "boardline.test.mjs"],
  ["the faction selection list is assumed to carry contributors",
    'contributors: Array.isArray(sel) ? sel.indexOf("contributors") !== -1 : null };',
    "contributors: true };",
    "pasteboard.e2e.test.mjs"],

  // ---- your own week ----
  ["the week runs one day long, so Monday is counted twice",
    "if (!e || typeof e.d !== \"number\" || e.d < d0 || e.d > d0 + 6) return;",
    "if (!e || typeof e.d !== \"number\" || e.d < d0 || e.d > d0 + 7) return;",
    "boardline.test.mjs"],
  ["last week's training is counted into this week",
    "e.d < d0 || e.d > d0 + 6", "e.d > d0 + 6",
    "boardline.test.mjs"],
  ["each day overwrites the split instead of adding to it",
    "out[keys[j]] += Math.max(0, Number(day[keys[j]]) || 0);",
    "out[keys[j]] = Math.max(0, Number(day[keys[j]]) || 0);",
    "boardline.test.mjs"],
  ["attacking energy is folded into the gym figure",
    "out.atkE += Math.max(0, Number(e.off) || 0);",
    "out.gymE += Math.max(0, Number(e.off) || 0);",
    "boardline.test.mjs"],

  // ---- xanax ----
  ["no log at all is reported as none taken",
    'if (!by || typeof by !== "object") return null;',
    'if (!by || typeof by !== "object") return 0;',
    "boardline.test.mjs"],
  ["every year is counted, not this one",
    'if (String(k).slice(0, 4) === y) n += Number(by[k]) || 0;',
    "n += Number(by[k]) || 0;",
    "boardline.test.mjs"],

  // ---- the line ----
  ["the check digits are never verified",
    "      if (pasteCk(f.join(\"|\")) !== ck) return;\n", "",
    "boardline.test.mjs"],
  ["the checksum ignores where a digit sits",
    "n = (n * 31 + s.charCodeAt(i)) % 9973;", "n = (n + s.charCodeAt(i)) % 9973;",
    "boardline.test.mjs"],
  ["a line from any version is read",
    "if (tok.slice(0, LINE_TAG.length + 1) !== LINE_TAG + \"|\") return;", "",
    "boardline.test.mjs"],
  // No mutant for the field-count guard. The check digits are computed over the
  // whole payload, so any token that is short or long fails to verify before
  // the count is even consulted -- loosening it changes no outcome, and a test
  // contorted to kill it would be testing the mutant rather than the rule.
  ["a known xanax count is written out as unknown",
    'o.atkE, (o.xan == null ? "-" : o.xan), o.at]',
    'o.atkE, "-", o.at]',
    "boardline.test.mjs"],

  // ---- collecting ----
  ["an older line overwrites a newer one",
    "if (!by[k] || (Number(r.at) || 0) > (Number(by[k].at) || 0)) by[k] = r;",
    "if (!by[k] || (Number(r.at) || 0) < (Number(by[k].at) || 0)) by[k] = r;",
    "boardline.test.mjs"],
  ["the board is ranked smallest week first",
    "return (Number(b.gymE) || 0) - (Number(a.gymE) || 0);",
    "return (Number(a.gymE) || 0) - (Number(b.gymE) || 0);",
    "boardline.test.mjs"],
  ["lines from another gym week are mixed in",
    "      if (r.week !== wk) { other += 1; return; }\n", "",
    "boardline.test.mjs"],

  // ---- wiring ----
  ["the tab strip ignores the gate",
    '.filter(function (id) { return id !== "board" || boardTabOn(); })', "",
    "pasteboard.e2e.test.mjs"],
  // No mutant for the coerce-off-the-board guard. state.tab is not persisted,
  // so the only way to be on the board when the answer turns negative is a
  // mid-session revocation of faction API access, which the harness cannot
  // drive. The guard stays as defence; pretending a test covers it would be
  // the vacuous coverage this gate exists to find.
  ["the paste card never reaches the Now tab",
    "      pasteCardHtml();", '      "";',
    "pasteboard.e2e.test.mjs"],
  ["what you paste is wiped by the next render",
    "    if (box) box.value = draftPaste;", "",
    "pasteboard.e2e.test.mjs"],
  ["the collected board is never saved",
    '      storeSet("pasted", state.pasted);\n', "",
    "pasteboard.e2e.test.mjs"],
  ["COPY copies something that is not a line",
    "      copyText(pasteLine(mineNow));", '      copyText("");',
    "pasteboard.e2e.test.mjs"],
];

let killed = 0;
const survived = [];
for (const [name, from, to, suite] of mutants) {
  if (!original.includes(from)) { console.log("SKIP (no match) " + name); continue; }
  fs.writeFileSync(FILE, original.replace(from, to));
  if (suite.endsWith(".e2e.test.mjs")) build();
  let passed = true;
  try { execSync("node " + suite, { stdio: "pipe", timeout: 900000 }); } catch { passed = false; }
  if (passed) { survived.push(name); console.log("SURVIVED  " + name); }
  else { killed++; console.log("killed    " + name); }
}
fs.writeFileSync(FILE, original);
build();

console.log("\n" + killed + " killed, " + survived.length + " survived");
if (survived.length) { console.log("\nvacuous coverage:"); survived.forEach(s => console.log("  - " + s)); }
process.exit(survived.length ? 1 : 0);
