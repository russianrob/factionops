import { test } from "node:test";
import assert from "node:assert/strict";
import {
  firstNameUpper, shiftEndHour, closersForDay, assignAlternating, dayKeyForDate, fillChecklistXml,
  excludedForTask, resolveTaskTexts, parseSharedStrings, excelSerial,
} from "./pm-checklist.js";

// This week's schedule (as vision returns it), enough to exercise the rules.
const SCHED = [
  { name: "Okhtenberg, Ernest", job: "2ndAppy", days: { Thu: "6:00A-2:30P", Sun: "6:00A-2:30P" } },
  { name: "Benton, Sharahon T", job: "Clerk", days: { Tue: "4:00P-9:00P", Wed: "4:00P-9:00P", Thu: "4:00P-9:00P" } },
  { name: "Coleman, Latisha N", job: "Clerk", days: { Sun: "3:00P-9:00P", Mon: "3:00P-9:00P", Thu: "3:00P-9:00P", Fri: "3:00P-9:00P" } },
  { name: "De gerolamo, Rita", job: "Clerk", days: { Sun: "3:00P-10:00P", Mon: "3:00P-10:00P", Fri: "3:00P-10:00P" } },
  { name: "Gallucci, Carmela M", job: "Clerk", days: { Mon: "4:00P-8:00P" } },
  { name: "Owen-White, Tahj", job: "Clerk", days: { Wed: "2:00P-9:00P", Thu: "10:00A-5:00P", Sat: "2:00P-9:00P" } },
  { name: "Jackson, Shaun M", job: "Clerk", days: { Thu: "Vacation" } },
];

test("firstNameUpper pulls the first name from 'Last, First M'", () => {
  assert.equal(firstNameUpper("Coleman, Latisha N"), "LATISHA");
  assert.equal(firstNameUpper("De gerolamo, Rita"), "RITA");
  assert.equal(firstNameUpper("Owen-White, Tahj"), "TAHJ");
  assert.equal(firstNameUpper("nonsense"), null);
});

test("shiftEndHour parses the end time to 24h decimal", () => {
  assert.equal(shiftEndHour("3:00P-9:00P"), 21);
  assert.equal(shiftEndHour("3:00P - 10:00P"), 22);
  assert.equal(shiftEndHour("6:00A-2:30P"), 14.5);
  assert.equal(shiftEndHour("Vacation"), null);
  assert.equal(shiftEndHour(""), null);
});

test("Thursday closers = Sharahon + Latisha (owner-verified)", () => {
  assert.deepEqual(closersForDay(SCHED, "Thu"), ["SHARAHON", "LATISHA"]);
});

test("8pm AND later — the 10pm closer (Rita) counts, and so does an 8pm shift (Carmela)", () => {
  // Sunday: Latisha 3-9, Rita 3-10 → both. Ernest (2:30P) excluded.
  assert.deepEqual(closersForDay(SCHED, "Sun"), ["LATISHA", "RITA"]);
  // Monday: Latisha 3-9, Rita 3-10, Gallucci 4-8 → all end 8pm+ now.
  assert.deepEqual(closersForDay(SCHED, "Mon"), ["LATISHA", "RITA", "CARMELA"]);
});

test("shifts ending before 8pm and Vacation are excluded", () => {
  // Thursday: Tahj is 10A-5P (ends 5pm, excluded), Jackson Vacation (excluded).
  assert.ok(!closersForDay(SCHED, "Thu").includes("TAHJ"));
  assert.ok(!closersForDay(SCHED, "Thu").includes("SHAUN"));
});

test("assignAlternating splits task rows round-robin among closers", () => {
  const a = assignAlternating([4, 5, 6, 7, 8], ["SHARAHON", "LATISHA"]);
  assert.deepEqual(a, { 4: "SHARAHON", 5: "LATISHA", 6: "SHARAHON", 7: "LATISHA", 8: "SHARAHON" });
});

test("assignAlternating with three closers cycles through all", () => {
  const a = assignAlternating([4, 5, 6, 7], ["A", "B", "C"]);
  assert.deepEqual(a, { 4: "A", 5: "B", 6: "C", 7: "A" });
});

test("assignAlternating with no closers assigns nothing", () => {
  assert.deepEqual(assignAlternating([4, 5, 6], []), {});
});

test("assignAlternating load-balances — free tasks steer to the lighter closers, not piled on the exclusion-sink", () => {
  // pre-slice + Boar's Head can ONLY go to LATISHA (Rita+Carmela excluded), which
  // pre-loads her with 2. The 3 free tasks must then go to Rita/Carmela to even
  // it out — NOT back onto LATISHA (that's the 8/2/2 bug we're fixing).
  const tasks = [
    { row: 5, text: "Fill up pre-slice & salad case" },     // Rita+Carmela excluded
    { row: 8, text: "Fill up the Boar’s Head pre-slice" },  // Rita+Carmela excluded
    { row: 6, text: "Make sure open meats have a lid" },     // free
    { row: 9, text: "Fill up supplies (wax paper)" },        // free
    { row: 7, text: "Fill up the back bar" },                // free
  ];
  const a = assignAlternating(tasks, ["LATISHA", "RITA", "CARMELA"]);
  assert.equal(a[5], "LATISHA");                 // only she can
  assert.equal(a[8], "LATISHA");                 // only she can
  const counts = {};
  for (const n of Object.values(a)) counts[n] = (counts[n] || 0) + 1;
  assert.equal(counts.LATISHA, 2, "LATISHA keeps only the 2 nobody else can take");
  assert.equal(counts.RITA, 2);
  assert.equal(counts.CARMELA, 1);
  for (const r of [6, 9, 7]) assert.ok(["RITA", "CARMELA"].includes(a[r]), `free task r${r} → lighter closer`);
});

test("assignAlternating assigns the can't-do tasks FIRST, then fills the doable ones with Rita/Carmela (even when a free task is listed first)", () => {
  // Owner's rule: give the tasks Rita/Carmela can't do to the other person, then
  // fill the doable tasks with them. So even though the free task (r6) is listed
  // FIRST, the two excluded tasks (only LATISHA can do them) are placed first,
  // leaving the free task to fill Rita/Carmela — not pile a third onto Latisha.
  const tasks = [
    { row: 6, text: "Make sure open meats have a lid" },     // free — listed FIRST
    { row: 5, text: "Fill up pre-slice & salad case" },      // Rita+Carmela excluded
    { row: 8, text: "Fill up the Boar’s Head pre-slice" },   // Rita+Carmela excluded
  ];
  const a = assignAlternating(tasks, ["LATISHA", "RITA", "CARMELA"]);
  assert.equal(a[5], "LATISHA");
  assert.equal(a[8], "LATISHA");
  assert.notEqual(a[6], "LATISHA", "the free task must fill Rita/Carmela, not pile on Latisha");
  assert.ok(["RITA", "CARMELA"].includes(a[6]));
});

test("excludedForTask flags the physical tasks for the right people", () => {
  assert.deepEqual([...excludedForTask("Block pack-out cases as per standards")], ["RITA", "CARMELA"]);
  assert.deepEqual([...excludedForTask("Fill up the Boar’s Head pre-slice")], ["RITA", "CARMELA"]);
  assert.deepEqual([...excludedForTask("Fill up pre-slice & salad case")], ["RITA", "CARMELA"]);
  assert.deepEqual([...excludedForTask("Put Cheese tables into our cooler")], ["CARMELA"]);
  assert.deepEqual([...excludedForTask("Complete 5:30pm cleaning log")], ["RITA", "CARMELA"]);
  assert.deepEqual([...excludedForTask("Clean the glass on the counter tops")], []);  // no exclusion
  // "cheese" in a non-table task must NOT trigger the cheese-table exclusion:
  assert.deepEqual([...excludedForTask("Make sure all open meats & cheese have a lid")], []);
});

test("Rita never gets blocking/pre-slice — it goes to the co-closer", () => {
  const tasks = [
    { row: 5, text: "Fill up pre-slice & salad case" },   // Rita excluded
    { row: 8, text: "Fill up the Boar’s Head pre-slice" }, // Rita excluded
    { row: 10, text: "Block pack-out cases" },             // Rita excluded
    { row: 6, text: "Make sure open meats have a lid" },   // no exclusion
  ];
  const a = assignAlternating(tasks, ["LATISHA", "RITA"]);
  assert.equal(a[5], "LATISHA");   // would be LATISHA anyway (i=0)
  assert.equal(a[8], "LATISHA");   // i=1 → RITA excluded → next eligible LATISHA
  assert.equal(a[10], "LATISHA");  // i=2 → LATISHA
  assert.equal(a[6], "RITA");      // i=3 → RITA (no exclusion) — Rita still gets non-physical tasks
});

test("Carmela excluded from cheese tables specifically", () => {
  const a = assignAlternating([{ row: 12, text: "Put Cheese tables into our cooler" }], ["CARMELA", "TAHJ"]);
  assert.equal(a[12], "TAHJ");   // CARMELA (i=0) excluded → TAHJ
});

test("parseSharedStrings + resolveTaskTexts pull each task row's column-A text", () => {
  const ss = '<sst><si><t>Header</t></si><si><t>Block pack-out cases</t></si></sst>';
  const sheet = '<row r="10"><c r="A10" s="11" t="s"><v>1</v></c></row>'
    + '<row r="11"><c r="A11" s="11" t="inlineStr"><is><t>Clean the glass</t></is></c></row>';
  const strings = parseSharedStrings(ss);
  assert.deepEqual(resolveTaskTexts(sheet, strings, [10, 11]),
    [{ row: 10, text: "Block pack-out cases" }, { row: 11, text: "Clean the glass" }]);
});

test("dayKeyForDate maps a Date to its weekday key", () => {
  assert.equal(dayKeyForDate(new Date("2026-08-06T12:00:00")), "Thu");
  assert.equal(dayKeyForDate(new Date("2026-08-02T12:00:00")), "Sun");
});

test("excelSerial gives the Excel date serial; fillChecklistXml stamps D1 as a fixed value", () => {
  assert.equal(excelSerial(new Date(2026, 7, 6)), 46240);
  assert.equal(excelSerial(new Date(2026, 7, 7)), 46241);
  const sheet = '<row r="1"><c r="D1" s="5" t="n"><f>TODAY()</f><v>46240</v></c></row>';
  const out = fillChecklistXml(sheet, {}, 46241);
  assert.match(out, /<c r="D1" s="5" t="n"><v>46241<\/v><\/c>/);
  assert.ok(!out.includes("TODAY()"), "self-updating formula removed");
});

test("fillChecklistXml writes names into E cells as inline strings, keeps style", () => {
  const sheet = '<sheetData>'
    + '<row r="4"><c r="A4" t="s"><v>8</v></c><c r="E4" s="14" t="s"><v>9</v></c></row>'
    + '<row r="5"><c r="A5" t="s"><v>10</v></c><c r="E5" s="14" t="s"><v>11</v></c></row>'
    + '</sheetData>';
  const out = fillChecklistXml(sheet, { 4: "SHARAHON", 5: "LATISHA" });
  assert.match(out, /<c r="E4" s="14" t="inlineStr"><is><t>SHARAHON<\/t><\/is><\/c>/);
  assert.match(out, /<c r="E5" s="14" t="inlineStr"><is><t>LATISHA<\/t><\/is><\/c>/);
  assert.ok(!out.includes('<v>9</v>'), "old shared-string ref replaced");
});
