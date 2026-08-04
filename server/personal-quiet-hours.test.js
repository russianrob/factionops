// Run: node server/personal-quiet-hours.test.js
import assert from "node:assert";
import { isQuietHour } from "./personal-quiet-hours.js";

let pass = 0;
function t(name, fn) { fn(); pass++; console.log("  ✓", name); }

// The watcher polls every 45s around the clock on the player's own key, which
// exhausts Torn's daily read cap before 04:00 and leaves attack + hospital
// alerts dead for the rest of the day. Overnight polling buys nothing anyway —
// the player is asleep — so a quiet window both saves the budget and stops 3am
// notifications.
//
// Zone is America/New_York rather than a fixed -05:00 offset: the player says
// "EST", but half the year they are on EDT, and a hardcoded offset would shift
// the window by an hour every spring and autumn.

const opts = { startHour: 22, endHour: 6, timeZone: "America/New_York" };

console.log("isQuietHour — the window itself");

t("22:00 ET is quiet (window opens)", () => {
  // 2026-01-15 22:00 EST = 03:00 UTC next day
  assert.strictEqual(isQuietHour(new Date("2026-01-16T03:00:00Z"), opts), true);
});

t("03:00 ET is quiet (middle of the night)", () => {
  assert.strictEqual(isQuietHour(new Date("2026-01-16T08:00:00Z"), opts), true);
});

t("05:59 ET is still quiet", () => {
  assert.strictEqual(isQuietHour(new Date("2026-01-16T10:59:00Z"), opts), true);
});

t("06:00 ET resumes polling", () => {
  assert.strictEqual(isQuietHour(new Date("2026-01-16T11:00:00Z"), opts), false);
});

t("21:59 ET is not yet quiet", () => {
  assert.strictEqual(isQuietHour(new Date("2026-01-16T02:59:00Z"), opts), false);
});

t("midday ET is not quiet", () => {
  assert.strictEqual(isQuietHour(new Date("2026-01-16T17:00:00Z"), opts), false);
});

console.log("isQuietHour — daylight saving");

// The reason for using a zone and not an offset. Both instants are 02:00 local
// in New York, but the UTC offset differs (EST -5 in January, EDT -4 in July).
t("02:00 EST in January is quiet", () => {
  assert.strictEqual(isQuietHour(new Date("2026-01-16T07:00:00Z"), opts), true);
});

t("02:00 EDT in July is also quiet", () => {
  assert.strictEqual(isQuietHour(new Date("2026-07-16T06:00:00Z"), opts), true);
});

// A fixed -05:00 offset would call this 09:00 and poll right through the
// window; in New York it is 10:00 EDT and polling is correct.
t("10:00 EDT in July is NOT quiet (offset naivety would get this wrong)", () => {
  assert.strictEqual(isQuietHour(new Date("2026-07-16T14:00:00Z"), opts), false);
});

console.log("isQuietHour — configuration");

t("a disabled window never silences anything", () => {
  const off = { ...opts, enabled: false };
  assert.strictEqual(isQuietHour(new Date("2026-01-16T08:00:00Z"), off), false);
});

t("a non-wrapping window works too (01:00-05:00)", () => {
  const day = { startHour: 1, endHour: 5, timeZone: "America/New_York" };
  assert.strictEqual(isQuietHour(new Date("2026-01-16T08:00:00Z"), day), true);   // 03:00 ET
  assert.strictEqual(isQuietHour(new Date("2026-01-16T17:00:00Z"), day), false);  // 12:00 ET
});

t("start === end means no quiet time, not all day", () => {
  const none = { startHour: 3, endHour: 3, timeZone: "America/New_York" };
  assert.strictEqual(isQuietHour(new Date("2026-01-16T08:00:00Z"), none), false);
});

console.log(`\n${pass} passed`);
