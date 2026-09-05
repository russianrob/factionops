// Next week's schedule arrives mid-week. It must not blank the days people are
// still working, and it must never put next week's crew on today.
import test from "node:test";
import assert from "node:assert/strict";
import { scheduleFor } from "./pm-checklist.js";

const WEEK = (start, sat, sun) => ({
  weekStart: start,
  isoByDay: { Sun: sun, Sat: sat },
  byDay: { Sun: ["SUN_CREW"], Sat: [`SAT_${start}`] },
});
const THIS_WEEK = WEEK("2026-08-30", "2026-09-05", "2026-08-30");
const NEXT_WEEK = WEEK("2026-09-06", "2026-09-12", "2026-09-06");

test("the current schedule is used when it covers the date", () => {
  const s = scheduleFor("Sat", "2026-09-12", [NEXT_WEEK, THIS_WEEK]);
  assert.equal(s.weekStart, "2026-09-06");
});

test("the displaced week still covers its own remaining days", () => {
  // The exact case: next week uploaded on Saturday the 5th. Today belongs to
  // the week that was just replaced, and it must still be found.
  const s = scheduleFor("Sat", "2026-09-05", [NEXT_WEEK, THIS_WEEK]);
  assert.equal(s.weekStart, "2026-08-30");
  assert.deepEqual(s.byDay.Sat, ["SAT_2026-08-30"]);
});

test("next week's crew never lands on today", () => {
  const s = scheduleFor("Sat", "2026-09-05", [NEXT_WEEK, null]);
  assert.equal(s, null, "no cover means a BLANK sheet, never the wrong names");
});

test("a date in neither week yields nothing", () => {
  assert.equal(scheduleFor("Sat", "2026-10-31", [NEXT_WEEK, THIS_WEEK]), null);
});

test("a malformed schedule is skipped, not thrown on", () => {
  assert.equal(scheduleFor("Sat", "2026-09-05", [{}, null]), null);
  assert.equal(scheduleFor("Sat", "2026-09-05", [{ byDay: {} }]), null);   // no isoByDay
  assert.equal(scheduleFor("Sat", "2026-09-05", []), null);
  assert.equal(scheduleFor("Sat", "2026-09-05", undefined), null);
});

test("a malformed CURRENT does not hide a good previous", () => {
  const s = scheduleFor("Sat", "2026-09-05", [{ garbage: true }, THIS_WEEK]);
  assert.equal(s.weekStart, "2026-08-30");
});
