// The maths behind /hof (spec: docs/superpowers/specs/2026-10-19-hof-respect-climb-design.md).
// Synthetic factions only; the real-data anchors are checked outside the repo.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// No hof module may ever touch the live data directory from a test.
process.env.DATA_DIR = mkdtempSync(join(tmpdir(), "hof-climb-test-"));
const climb = await import("./hof-climb.js");

// ── number formats ──────────────────────────────────────────────────────
test("fmtNum picks its band from the rounded absolute value", () => {
  const cases = [
    [0, "0"], [188, "188"], [9876, "9,876"], [9999, "9,999"],
    [10000, "10.0k"], [74800, "74.8k"], [74850, "74.9k"], [99949, "99.9k"],
    [99950, "100k"], [99960, "100k"], [110914, "111k"], [999499, "999k"],
    [999500, "1.00M"], [1000000, "1.00M"], [1005000, "1.01M"], [3552938, "3.55M"],
    [9995000, "10.00M"],
    [-188, "-188"], [-9999, "-9,999"], [-10000, "-10.0k"], [-33882, "-33.9k"],
    [-99960, "-100k"], [-1000000, "-1.00M"],
  ];
  for (const [v, want] of cases) assert.equal(climb.fmtNum(v), want, String(v));
});

test("fmtPace rounds halves away from zero and never prints -0", () => {
  const cases = [
    [7752.032, "7,752/day"], [7752.5, "7,753/day"], [-7752.5, "-7,753/day"],
    [-1234.6, "-1,235/day"], [-0.3, "0/day"], [0, "0/day"], [NaN, "—"], [null, "—"],
  ];
  for (const [v, want] of cases) assert.equal(climb.fmtPace(v), want, String(v));
});
