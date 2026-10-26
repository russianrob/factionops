// The monthly top 25: the calendar month in TCT, scored the same way as the
// week — energy trained between two of our own readings — but with the 25 best
// kept instead of one winner, and members who joined mid-month ranked from
// their first reading rather than left at zero.
import { test } from "node:test";
import assert from "node:assert/strict";
import { monthWindow, monthStandings, monthTop, monthBoard, finaliseMonths, MONTH_TOP }
  from "./gym-comp-model.js";

const T = (iso) => Date.parse(iso + "Z");
const reading = (iso, members) => ({ at: T(iso), members });
const iso = (ms) => new Date(ms).toISOString();

test("the month runs from the 1st 00:00 to the last day 23:59 TCT", () => {
  for (const t of ["2026-10-01T00:00:00", "2026-10-15T12:00:00", "2026-10-31T23:59:59"]) {
    const m = monthWindow(T(t));
    assert.equal(iso(m.start), "2026-10-01T00:00:00.000Z", t);
    assert.equal(iso(m.end), "2026-10-31T23:59:59.999Z", t);
  }
});

test("months have their own lengths, and December runs into January", () => {
  assert.equal(iso(monthWindow(T("2026-11-20T00:00:00")).end), "2026-11-30T23:59:59.999Z");
  assert.equal(iso(monthWindow(T("2027-02-10T00:00:00")).end), "2027-02-28T23:59:59.999Z");
  const dec = monthWindow(T("2026-12-31T23:00:00"));
  assert.equal(iso(dec.end + 1), "2027-01-01T00:00:00.000Z");
});

test("somebody who joined mid-month is ranked from their first reading that month", () => {
  // The weekly board scores a joiner zero; a month is long enough that doing so
  // would leave a real member off the ladder for weeks.
  const readings = [
    reading("2026-09-30T23:55:00", { "1": { energy: 1000, name: "Ada" } }),
    reading("2026-10-12T09:00:00", { "1": { energy: 2000, name: "Ada" }, "9": { energy: 4_000_000, name: "NewGuy" } }),
    reading("2026-10-20T00:00:00", { "1": { energy: 3000, name: "Ada" }, "9": { energy: 4_005_000, name: "NewGuy" } }),
  ];
  const rows = monthStandings(readings[0], readings[2], readings, T("2026-10-01T00:00:00"));
  const ng = rows.find((r) => r.name === "NewGuy");
  assert.equal(ng.energy, 5000, "from their first reading, never their lifetime total");
  assert.equal(iso(ng.joinedAt), "2026-10-12T09:00:00.000Z");
  assert.equal(rows[0].name, "NewGuy", "and ranked like anyone else");
  const ada = rows.find((r) => r.name === "Ada");
  assert.equal(ada.energy, 2000);
  assert.equal(ada.joinedAt, null, "a member at the start line has no join date");
});

test("a joiner's first reading is looked for inside the month only", () => {
  // They were here once before and left: a reading from last month is last
  // month's, and the one after the current reading is the future. Out of order
  // on purpose, since nothing guarantees the file is sorted.
  const readings = [
    reading("2026-10-20T00:00:00", { "9": { energy: 900, name: "NewGuy" } }),
    reading("2026-09-25T00:00:00", { "9": { energy: 50, name: "NewGuy" } }),
    reading("2026-09-30T23:55:00", {}),
    reading("2026-10-05T00:00:00", { "9": { energy: 100, name: "NewGuy" } }),
    reading("2026-10-25T00:00:00", { "9": { energy: 5000, name: "NewGuy" } }),
  ];
  const rows = monthStandings(readings[2], readings[0], readings, T("2026-10-01T00:00:00"));
  assert.equal(rows[0].energy, 800);
  assert.equal(iso(rows[0].joinedAt), "2026-10-05T00:00:00.000Z");
});

test("a joiner's split is measured from their first reading too", () => {
  const readings = [
    reading("2026-09-30T23:55:00", {}),
    reading("2026-10-12T09:00:00", { "9": { energy: 1000, name: "NewGuy", str: 1000, def: 0, spe: 0, dex: 0 } }),
    reading("2026-10-20T00:00:00", { "9": { energy: 1600, name: "NewGuy", str: 1000, def: 0, spe: 600, dex: 0 } }),
  ];
  const rows = monthStandings(readings[0], readings[2], readings, T("2026-10-01T00:00:00"));
  assert.equal(rows[0].split, "all spe");
});

test("the ladder keeps the 25 best who trained, and nobody who did not", () => {
  assert.equal(MONTH_TOP, 25);
  const rows = Array.from({ length: 30 }, (_, i) => ({ id: String(i), name: "M" + i, energy: 3000 - i * 100, joinedAt: null }));
  rows.push({ id: "z", name: "Idle", energy: 0, joinedAt: null });
  const top = monthTop(rows);
  assert.equal(top.length, 25);
  assert.equal(top[24].name, "M24");
  assert.equal(monthTop(rows.slice(0, 3).concat({ id: "z", name: "Idle", energy: 0 })).length, 3);
});

test("a tie at #25 is broken by name, and the ladder stays at 25", () => {
  // No 26th row: the order standings() already uses decides who is shown.
  const base = { at: T("2026-09-30T23:55:00"), members: {} };
  const now = { at: T("2026-10-20T00:00:00"), members: {} };
  for (let i = 0; i < 24; i++) {
    base.members[String(i)] = { energy: 0, name: "M" + i };
    now.members[String(i)] = { energy: 10000 - i * 100, name: "M" + i };
  }
  base.members.z = { energy: 0, name: "Zed" };
  now.members.z = { energy: 500, name: "Zed" };
  base.members.a = { energy: 0, name: "Abe" };
  now.members.a = { energy: 500, name: "Abe" };
  const top = monthTop(monthStandings(base, now, [base, now], T("2026-10-01T00:00:00")));
  assert.equal(top.length, 25);
  assert.equal(top[24].name, "Abe");
});

test("the month in progress is measured from the last reading before the 1st", () => {
  const readings = [
    reading("2026-09-30T23:59:29", { "1": { energy: 1000, name: "Ada" }, "2": { energy: 500, name: "Bo" } }),
    reading("2026-10-01T00:04:00", { "1": { energy: 1050, name: "Ada" }, "2": { energy: 500, name: "Bo" } }),
    reading("2026-10-26T12:00:00", { "1": { energy: 9000, name: "Ada" }, "2": { energy: 2500, name: "Bo" } }),
  ];
  const b = monthBoard(readings, T("2026-10-26T12:30:00"));
  assert.equal(iso(b.start), "2026-10-01T00:00:00.000Z");
  assert.equal(iso(b.end), "2026-10-31T23:59:59.999Z");
  assert.equal(iso(b.baselineAt), "2026-09-30T23:59:29.000Z");
  assert.equal(b.lateStart, false);
  assert.equal(iso(b.currentAt), "2026-10-26T12:00:00.000Z");
  assert.deepEqual(b.top.map((r) => [r.name, r.energy]), [["Ada", 8000], ["Bo", 2000]]);
});

test("a month with no reading before the 1st says it started late", () => {
  const readings = [
    reading("2026-10-03T10:00:00", { "1": { energy: 1000, name: "Ada" } }),
    reading("2026-10-26T12:00:00", { "1": { energy: 4000, name: "Ada" } }),
  ];
  const b = monthBoard(readings, T("2026-10-26T12:30:00"));
  assert.equal(b.lateStart, true);
  assert.equal(iso(b.baselineAt), "2026-10-03T10:00:00.000Z");
  assert.equal(b.top[0].energy, 3000);
});

test("no readings at all is an empty ladder, not a crash", () => {
  const b = monthBoard([], T("2026-10-26T12:30:00"));
  assert.deepEqual(b.top, []);
  assert.equal(b.baselineAt, 0);
  assert.equal(b.currentAt, 0);
});

test("a finished month is saved once, with its top 25, and not again", () => {
  const readings = [
    reading("2026-09-30T23:59:29", { "1": { energy: 1000, name: "Ada" }, "2": { energy: 0, name: "Bo" } }),
    reading("2026-10-31T23:57:00", { "1": { energy: 9000, name: "Ada" }, "2": { energy: 300, name: "Bo" } }),
    reading("2026-11-01T00:02:00", { "1": { energy: 9100, name: "Ada" }, "2": { energy: 300, name: "Bo" } }),
  ];
  const now = T("2026-11-01T00:02:30");
  const first = finaliseMonths(readings, [], now);
  assert.equal(first.length, 1);
  assert.equal(iso(first[0].monthStart), "2026-10-01T00:00:00.000Z");
  assert.equal(iso(first[0].monthEnd), "2026-10-31T23:59:59.999Z");
  assert.deepEqual(first[0].top.map((r) => [r.name, r.energy]), [["Ada", 8000], ["Bo", 300]],
    "the finish line is the last reading before midnight — November's 100 is November's");
  assert.equal(iso(first[0].baselineAt), "2026-09-30T23:59:29.000Z");
  assert.equal(iso(first[0].finalAt), "2026-10-31T23:57:00.000Z");
  assert.deepEqual(finaliseMonths(readings, first, now), []);
});

test("the month in progress is never saved early", () => {
  const readings = [
    reading("2026-09-30T23:59:29", { "1": { energy: 1000, name: "Ada" } }),
    reading("2026-10-31T23:57:00", { "1": { energy: 9000, name: "Ada" } }),
  ];
  assert.deepEqual(finaliseMonths(readings, [], T("2026-10-31T23:59:59")), []);
});

test("a month we did not watch from its first minute is never saved", () => {
  // September: the first reading was the 13th. Half a month published as a
  // month's ladder would be wrong for everyone on it.
  const readings = [
    reading("2026-09-13T00:34:00", { "1": { energy: 1000, name: "Ada" } }),
    reading("2026-09-30T23:59:29", { "1": { energy: 5000, name: "Ada" } }),
    reading("2026-10-31T23:57:00", { "1": { energy: 9000, name: "Ada" } }),
  ];
  const out = finaliseMonths(readings, [], T("2026-11-02T00:00:00"));
  assert.deepEqual(out.map((m) => iso(m.monthStart)), ["2026-10-01T00:00:00.000Z"]);
});

test("a month nobody trained in is not saved", () => {
  const readings = [
    reading("2026-09-30T23:59:29", { "1": { energy: 1000, name: "Ada" } }),
    reading("2026-10-31T23:57:00", { "1": { energy: 1000, name: "Ada" } }),
  ];
  assert.deepEqual(finaliseMonths(readings, [], T("2026-11-02T00:00:00")), []);
});

test("a reading at exactly 00:00 on the 1st ends one month and starts the next", () => {
  // Both months use the last reading at or before midnight, so energy trained
  // before it counts once, in the old month, and nothing falls between them.
  const readings = [
    reading("2026-09-30T23:55:00", { "1": { energy: 1000, name: "Ada" } }),
    reading("2026-10-31T23:55:00", { "1": { energy: 5000, name: "Ada" } }),
    reading("2026-11-01T00:00:00", { "1": { energy: 5600, name: "Ada" } }),
    reading("2026-11-02T00:00:00", { "1": { energy: 7000, name: "Ada" } }),
  ];
  const [oct] = finaliseMonths(readings, [], T("2026-11-02T00:30:00"));
  const nov = monthBoard(readings, T("2026-11-02T00:30:00"));
  assert.equal(oct.top[0].energy, 4600, "the midnight reading is October's finish");
  assert.equal(iso(nov.baselineAt), "2026-11-01T00:00:00.000Z", "and November's start line");
  assert.equal(nov.top[0].energy, 1400);
  assert.equal(oct.top[0].energy + nov.top[0].energy, 7000 - 1000, "every unit of energy counted exactly once");
});

test("a counter below its start line scores zero and stays off the ladder", () => {
  // A bad reading must not put anyone on the board with a negative score, and a
  // clamped zero is "did not train", which the ladder leaves out.
  const readings = [
    reading("2026-09-30T23:55:00", { "1": { energy: 9000, name: "Ada" }, "2": { energy: 100, name: "Bo" } }),
    reading("2026-10-20T00:00:00", { "1": { energy: 8000, name: "Ada" }, "2": { energy: 400, name: "Bo" } }),
  ];
  const b = monthBoard(readings, T("2026-10-20T01:00:00"));
  assert.deepEqual(b.top.map((r) => [r.name, r.energy]), [["Bo", 300]]);
});
