// The scoring rules, pinned. Everything here is a fact about the competition as
// announced: Sunday 00:00 TCT to Saturday 23:59 TCT, scored on energy trained.
import { test } from "node:test";
import assert from "node:assert/strict";
import { weekWindow, latestUpTo, baselineFor, standings, winnersOf, finaliseWeeks, splitLabel, WEEK_MS }
  from "./gym-comp-model.js";

const T = (iso) => Date.parse(iso + "Z");
const reading = (iso, members) => ({ at: T(iso), members });

test("the week runs Sunday 00:00 to Saturday 23:59 TCT", () => {
  // 13 Sep 2026 is a Sunday. Mid-week, at the very start, and at the very end
  // must all resolve to the same window.
  for (const t of ["2026-09-13T00:00:00", "2026-09-16T12:00:00", "2026-09-19T23:59:59"]) {
    const w = weekWindow(T(t));
    assert.equal(new Date(w.start).toISOString(), "2026-09-13T00:00:00.000Z", t);
    assert.equal(new Date(w.end).toISOString(), "2026-09-19T23:59:59.999Z", t);
  }
});

test("one second later is the next week, not the same one", () => {
  const a = weekWindow(T("2026-09-19T23:59:59"));
  const b = weekWindow(T("2026-09-20T00:00:00"));
  assert.equal(b.start - a.start, WEEK_MS);
  assert.equal(new Date(b.start).toISOString(), "2026-09-20T00:00:00.000Z");
});

test("the window survives a month boundary", () => {
  // 30 Sep 2026 is a Wednesday; its week starts back in September and ends in October.
  const w = weekWindow(T("2026-09-30T12:00:00"));
  assert.equal(new Date(w.start).toISOString(), "2026-09-27T00:00:00.000Z");
  assert.equal(new Date(w.end).toISOString(), "2026-10-03T23:59:59.999Z");
});

test("the start line is the last reading BEFORE the window opens", () => {
  // A reading taken after Sunday midnight already contains energy spent inside
  // the week; using it would subtract part of what somebody trained.
  const readings = [
    reading("2026-09-12T23:40:00", {}),
    reading("2026-09-13T00:20:00", {}),
  ];
  const base = latestUpTo(readings, T("2026-09-13T00:00:00"));
  assert.equal(new Date(base.at).toISOString(), "2026-09-12T23:40:00.000Z");
});

test("energy trained is the difference, ranked best first", () => {
  const base = reading("2026-09-13T00:00:00", {
    "1": { energy: 1000, name: "Ada" }, "2": { energy: 5000, name: "Bo" },
  });
  const now = reading("2026-09-16T00:00:00", {
    "1": { energy: 9000, name: "Ada" }, "2": { energy: 5500, name: "Bo" },
  });
  const rows = standings(base, now);
  assert.equal(rows[0].name, "Ada");
  assert.equal(rows[0].energy, 8000);
  assert.equal(rows[1].energy, 500);
});

test("somebody who joined mid-week is not ranked on a lifetime total", () => {
  // The bug this prevents: a new member's cumulative energy is not what they
  // trained this week, and they would otherwise top the board on day one.
  const base = reading("2026-09-13T00:00:00", { "1": { energy: 1000, name: "Ada" } });
  const now = reading("2026-09-16T00:00:00", {
    "1": { energy: 2000, name: "Ada" },
    "9": { energy: 4_000_000, name: "NewGuy" },
  });
  const rows = standings(base, now);
  assert.equal(rows[0].name, "Ada", "the new member must not be first");
  const ng = rows.find((r) => r.name === "NewGuy");
  assert.equal(ng.energy, 0);
  assert.equal(ng.partial, true, "and must be flagged rather than silently zeroed");
  assert.deepEqual(winnersOf(rows).map((w) => w.name), ["Ada"]);
});

test("a counter that appears to fall scores zero, never negative", () => {
  const base = reading("2026-09-13T00:00:00", { "1": { energy: 9000, name: "Ada" } });
  const now = reading("2026-09-16T00:00:00", { "1": { energy: 8000, name: "Ada" } });
  assert.equal(standings(base, now)[0].energy, 0);
});

test("a tie has every tied member as a winner", () => {
  const base = reading("2026-09-13T00:00:00", { "1": { energy: 0, name: "Ada" }, "2": { energy: 0, name: "Bo" } });
  const now = reading("2026-09-16T00:00:00", { "1": { energy: 500, name: "Ada" }, "2": { energy: 500, name: "Bo" } });
  assert.deepEqual(winnersOf(standings(base, now)).map((w) => w.name), ["Ada", "Bo"]);
});

test("nobody training means no winner, rather than a winner on zero", () => {
  const base = reading("2026-09-13T00:00:00", { "1": { energy: 500, name: "Ada" } });
  const now = reading("2026-09-16T00:00:00", { "1": { energy: 500, name: "Ada" } });
  assert.deepEqual(winnersOf(standings(base, now)), []);
});

test("a finished week is frozen once, and not again", () => {
  const readings = [
    reading("2026-09-13T00:00:00", { "1": { energy: 0, name: "Ada" } }),
    reading("2026-09-19T23:50:00", { "1": { energy: 7000, name: "Ada" } }),
  ];
  const now = T("2026-09-21T10:00:00");            // the Monday after
  const first = finaliseWeeks(readings, [], now);
  assert.equal(first.length, 1);
  assert.equal(first[0].winners[0].name, "Ada");
  assert.equal(first[0].winners[0].energy, 7000);
  assert.equal(new Date(first[0].weekStart).toISOString(), "2026-09-13T00:00:00.000Z");
  // Running again must not duplicate it.
  assert.deepEqual(finaliseWeeks(readings, first, now), []);
});

test("the week in progress is never frozen early", () => {
  const readings = [
    reading("2026-09-13T00:00:00", { "1": { energy: 0, name: "Ada" } }),
    reading("2026-09-16T00:00:00", { "1": { energy: 7000, name: "Ada" } }),
  ];
  assert.deepEqual(finaliseWeeks(readings, [], T("2026-09-16T01:00:00")), []);
});

test("a week with no coverage gets no winner rather than an invented one", () => {
  // One reading, at the very start: nothing happened between two readings, so
  // there is nothing to report for that week.
  const readings = [reading("2026-09-13T00:00:00", { "1": { energy: 100, name: "Ada" } })];
  assert.deepEqual(finaliseWeeks(readings, [], T("2026-09-21T00:00:00")), []);
});

test("a week whose first reading lands after midnight is still scored", () => {
  // Week 1 of the real competition: the poller's first reading was 01:55 on
  // Sunday. Without this, every member has no baseline, every member is flagged
  // "joined mid-week", and the board shows nobody at all.
  const readings = [
    reading("2026-09-13T01:55:00", { "1": { energy: 1000, name: "Ada" } }),
    reading("2026-09-14T01:55:00", { "1": { energy: 4000, name: "Ada" } }),
  ];
  const b = baselineFor(readings, T("2026-09-13T00:00:00"));
  assert.equal(new Date(b.reading.at).toISOString(), "2026-09-13T01:55:00.000Z");
  assert.equal(b.late, true, "and it must admit the start line is not midnight");
  const rows = standings(b.reading, readings[1]);
  assert.equal(rows[0].energy, 3000);
  assert.equal(rows[0].partial, false, "nobody should read as joined-mid-week");
});

test("a proper baseline is preferred and not flagged late", () => {
  const readings = [
    reading("2026-09-12T23:50:00", { "1": { energy: 1000, name: "Ada" } }),
    reading("2026-09-13T01:55:00", { "1": { energy: 1200, name: "Ada" } }),
  ];
  const b = baselineFor(readings, T("2026-09-13T00:00:00"));
  assert.equal(new Date(b.reading.at).toISOString(), "2026-09-12T23:50:00.000Z");
  assert.equal(b.late, false);
});

test("a late-started week is frozen with a winner and marked late", () => {
  const readings = [
    reading("2026-09-13T01:55:00", { "1": { energy: 1000, name: "Ada" } }),
    reading("2026-09-19T23:50:00", { "1": { energy: 9000, name: "Ada" } }),
  ];
  const out = finaliseWeeks(readings, [], T("2026-09-21T00:00:00"));
  assert.equal(out.length, 1);
  assert.equal(out[0].winners[0].energy, 8000);
  assert.equal(out[0].lateStart, true);
});

test("a single lonely reading still crowns nobody", () => {
  // One reading in the week means nothing was measured BETWEEN two points.
  const readings = [reading("2026-09-13T01:55:00", { "1": { energy: 1000, name: "Ada" } })];
  assert.deepEqual(finaliseWeeks(readings, [], T("2026-09-21T00:00:00")), []);
});

test("a single stat reads as 'all <stat>'", () => {
  assert.equal(splitLabel({ str: 0, def: 0, spe: 0, dex: 580 }), "all dex");
  assert.equal(splitLabel({ str: 300, def: 0, spe: 0, dex: 0 }), "all str");
});

test("a mixed week reads as percentages, biggest first", () => {
  assert.equal(splitLabel({ str: 0, def: 150, spe: 0, dex: 50 }), "def 75% · dex 25%");
});

test("nothing trained has no split at all", () => {
  assert.equal(splitLabel({ str: 0, def: 0, spe: 0, dex: 0 }), null);
  assert.equal(splitLabel(null), null);
});

test("the split is measured, never inferred from a total", () => {
  // Readings taken before per-stat collection existed carry no stats. A split
  // guessed from the total would be a fabrication wearing a measurement's face.
  const base = reading("2026-09-13T00:00:00", { "1": { energy: 1000, name: "Ada" } });
  const now = reading("2026-09-13T06:00:00", { "1": { energy: 1600, name: "Ada" } });
  const r = standings(base, now)[0];
  assert.equal(r.energy, 600);
  assert.equal(r.split, null);
});

test("with both readings carrying stats, the split comes out", () => {
  const base = reading("2026-09-13T00:00:00",
    { "1": { energy: 1000, name: "Ada", str: 500, def: 500, spe: 0, dex: 0 } });
  const now = reading("2026-09-13T06:00:00",
    { "1": { energy: 1600, name: "Ada", str: 500, def: 1100, spe: 0, dex: 0 } });
  const r = standings(base, now)[0];
  assert.equal(r.energy, 600);
  assert.equal(r.split, "all def");
});

// ── thinning ─────────────────────────────────────────────────────────────
// Lives here rather than in the model file because it is a storage rule, but it
// is the rule that decides whether a week's start line still exists in a month.
import { thin } from "./gym-comp.js";

test("recent readings are kept in full", () => {
  const now = T("2026-09-13T12:00:00");
  const readings = [];
  for (let i = 0; i < 24; i++) readings.push({ at: now - i * 5 * 60000, members: {} });
  assert.equal(thin(readings, now).length, 24, "two hours of five-minute readings, all within the full window");
});

test("older readings thin to one an hour", () => {
  const now = T("2026-09-13T12:00:00");
  const readings = [];
  // Ten days back, every five minutes, for one hour of that day.
  const old = now - 10 * 86400000;
  for (let i = 0; i < 12; i++) readings.push({ at: old + i * 5 * 60000, members: {} });
  const kept = thin(readings, now);
  assert.equal(kept.length, 1, "an hour of old readings collapses to one");
});

test("thinning keeps the LAST reading of an hour, not the first", () => {
  // The one nearest a week boundary is the one a score is measured from.
  const now = T("2026-09-30T12:00:00");
  const old = T("2026-09-13T00:00:00");
  const readings = [
    { at: old + 5 * 60000, members: {}, tag: "early" },
    { at: old + 55 * 60000, members: {}, tag: "late" },
  ];
  const kept = thin(readings, now);
  assert.equal(kept.length, 1);
  assert.equal(kept[0].tag, "late");
});

test("an imported baseline is never thinned away", () => {
  // It cannot be re-fetched from Torn at any price.
  const now = T("2026-10-20T12:00:00");
  const old = T("2026-09-13T00:34:00");
  const readings = [
    { at: old, members: {}, imported: true },
    { at: old + 5 * 60000, members: {} },
    { at: old + 8 * 60000, members: {} },
  ];
  const kept = thin(readings, now);
  assert.ok(kept.some((r) => r.imported), "the imported baseline must survive");
});

test("anything past the retention age is dropped", () => {
  const now = T("2026-12-31T00:00:00");
  assert.equal(thin([{ at: T("2026-09-13T00:00:00"), members: {} }], now).length, 0);
});
