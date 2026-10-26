// The results file holds the frozen weeks and the saved months together, so
// each write has to carry the other forward. A temp DATA_DIR keeps all of this
// away from the live files.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

process.env.DATA_DIR = mkdtempSync(join(tmpdir(), "gym-comp-test-"));
const gym = await import("./gym-comp.js");

const F = "42055";
const DIR = join(process.env.DATA_DIR, "gym-comp");
const T = (iso) => Date.parse(iso + "Z");
const reading = (iso, members) => ({ at: T(iso), members });
const results = () => JSON.parse(readFileSync(join(DIR, `${F}-results.json`), "utf8"));
const writeResults = (data) =>
  writeFileSync(join(DIR, `${F}-results.json`), JSON.stringify({ factionId: F, ...data }));

// October watched from before its 1st, then the first week of November.
// 1 November 2026 is a Sunday, so the month and the week turn over at the
// same midnight.
const READINGS = [
  reading("2026-09-30T23:59:29", { "1": { energy: 1000, name: "Ada" }, "2": { energy: 500, name: "Bo" } }),
  reading("2026-10-31T23:57:00", { "1": { energy: 9000, name: "Ada" }, "2": { energy: 2500, name: "Bo" } }),
  reading("2026-11-07T23:57:00", { "1": { energy: 9500, name: "Ada" }, "2": { energy: 4500, name: "Bo" } }),
  reading("2026-11-08T00:05:00", { "1": { energy: 9600, name: "Ada" }, "2": { energy: 4500, name: "Bo" } }),
];
mkdirSync(DIR, { recursive: true });
writeFileSync(join(DIR, `${F}.json`), JSON.stringify({ factionId: F, readings: READINGS }));

// A week frozen before months existed, in the shape freeze() wrote then.
const row = (id, name, energy) => ({ id, name, energy, split: null, partial: false });
const OLD_WEEK = {
  weekStart: T("2026-09-20T00:00:00"), weekEnd: T("2026-09-26T23:59:59.999"),
  winners: [row("1", "Ada", 700)], top: [row("1", "Ada", 700)],
  baselineAt: T("2026-09-19T23:58:00"), finalAt: T("2026-09-26T23:58:00"), lateStart: false,
};
const OCTOBER = {
  monthStart: T("2026-10-01T00:00:00"), monthEnd: T("2026-10-31T23:59:59.999"),
  top: [{ ...row("1", "Ada", 8000), joinedAt: null }, { ...row("2", "Bo", 2000), joinedAt: null }],
  baselineAt: T("2026-09-30T23:59:29"), finalAt: T("2026-10-31T23:57:00"),
};

// Every test that writes asks this first. A module still pointed at the live
// directory would see the live readings here instead of these four, and the
// test stops before freeze() can write anything.
const pointedAtTemp = () => assert.equal(gym.readReadings(F).length, READINGS.length,
  "gym-comp.js is not reading from DATA_DIR");

test("the store reads from DATA_DIR, never the live files", () => {
  pointedAtTemp();
});

test("saving a month keeps the weeks already frozen", () => {
  pointedAtTemp();
  writeResults({ weeks: [OLD_WEEK] });
  gym.freeze(F, T("2026-11-01T00:10:00"));
  const r = results();
  assert.deepEqual(r.weeks.find((w) => w.weekStart === OLD_WEEK.weekStart), OLD_WEEK);
  assert.deepEqual(r.months, [OCTOBER]);
});

test("freezing a week keeps the months already saved", () => {
  pointedAtTemp();
  writeResults({ weeks: [OLD_WEEK], months: [OCTOBER] });
  gym.freeze(F, T("2026-11-08T00:10:00"));
  const r = results();
  assert.ok(r.weeks.some((w) => w.weekStart === T("2026-11-01T00:00:00")), "the week of 1 November froze");
  assert.deepEqual(r.months, [OCTOBER], "and October is exactly as it was");
});

test("the page gets this month's top 25 and the saved months", () => {
  pointedAtTemp();
  writeResults({ weeks: [], months: [OCTOBER] });
  const b = gym.board(F, T("2026-11-08T00:10:00"));
  assert.equal(b.month.start, T("2026-11-01T00:00:00"));
  assert.equal(b.month.end, T("2026-11-30T23:59:59.999"));
  assert.deepEqual(b.month.top.map((x) => [x.name, x.energy]), [["Bo", 2000], ["Ada", 600]]);
  assert.deepEqual(b.months, [OCTOBER]);
});

test("the reading somebody first appears in is never thinned away", () => {
  // The monthly ladder measures a mid-month joiner from it. Thinned to the
  // hour's last reading, whatever they trained in their first hour would drop
  // off their score two days after they joined.
  const now = T("2026-10-20T12:00:00");
  const nine = T("2026-10-12T09:00:00");
  const readings = [
    { at: nine - 2 * 60000, members: { "1": { energy: 1 } } },
    { at: nine + 3 * 60000, members: { "1": { energy: 1 }, "9": { energy: 5 } } },
    { at: nine + 30 * 60000, members: { "1": { energy: 1 }, "9": { energy: 400 } } },
    { at: nine + 58 * 60000, members: { "1": { energy: 1 }, "9": { energy: 900 } } },
  ];
  const kept = gym.thin(readings, now).map((r) => r.at);
  assert.ok(kept.includes(nine + 3 * 60000), "the reading NewGuy first appears in must survive");
  assert.ok(!kept.includes(nine + 30 * 60000), "the rest of the hour still thins");
  assert.ok(kept.includes(nine + 58 * 60000), "and the hour's last reading stays");
});

test("a results file from before months existed reads as no months", () => {
  pointedAtTemp();
  writeResults({ weeks: [OLD_WEEK] });
  assert.deepEqual(gym.readMonths(F), []);
  assert.deepEqual(gym.readResults(F), [OLD_WEEK]);
});
