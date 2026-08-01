import test from "node:test";
import assert from "node:assert/strict";
import { applyNerveReading, buildResponse, hasPerkData, parseMaxNervePerks } from "./nerve-tracker.js";

// NNB rises in +5 steps as hidden Criminal Experience crosses thresholds. Torn
// exposes no CE figure, so the rise in nerve.maximum IS the signal — but perks
// also raise the maximum, and "+10 from two CE steps" is numerically identical
// to "+10 from a new perk". Subtracting the perk total (which Torn does list,
// as text) removes the ambiguity: any rise in the BASE is CE.

const NOW = 1_785_600_000;

// ── perk parsing ───────────────────────────────────────────────────────────
test("sums maximum-nerve perks across every group", () => {
  const perks = {
    faction_perks: ["+ 50% nerve gain from alcohol", "+ 30 maximum nerve"],
    job_perks: ["+ 50% nerve gain from alcohol", "+ 15 maximum nerve"],
    education_perks: ["+ Escape jail nerve cost reduction"],
  };
  assert.equal(parseMaxNervePerks(perks), 45, "30 faction + 15 job");
});

test("percentage nerve perks are NOT counted as maximum nerve", () => {
  // These sit directly beside the real ones; a loose /nerve/ match would add 50.
  assert.equal(parseMaxNervePerks({ faction_perks: ["+ 50% nerve gain from alcohol"] }), 0);
  assert.equal(parseMaxNervePerks({ education_perks: ["+ Escape jail nerve cost reduction"] }), 0);
});

test("perk parsing tolerates junk", () => {
  assert.equal(parseMaxNervePerks(null), 0);
  assert.equal(parseMaxNervePerks({}), 0);
  assert.equal(parseMaxNervePerks({ a: "not an array" }), 0);
  assert.equal(parseMaxNervePerks({ a: [null, 42, {}] }), 0);
});

// ── increase detection ─────────────────────────────────────────────────────
test("first ever reading records the base without claiming an increase", () => {
  const r = applyNerveReading({}, 85, NOW);
  assert.equal(r.increased, false, "no baseline to compare against");
  assert.equal(r.state.lastSeenBase, 85);
  assert.equal(r.state.lastNNBIncreaseAt, undefined, "must not invent a timestamp");
});

test("an unchanged base is a no-op and does not drift the clock", () => {
  const r = applyNerveReading({ lastSeenBase: 85, lastNNBIncreaseAt: 1000 }, 85, NOW);
  assert.equal(r.increased, false);
  assert.equal(r.state.lastNNBIncreaseAt, 1000);
});

test("a rise is not believed until a second poll confirms it", () => {
  const first = applyNerveReading({ lastSeenBase: 85, lastNNBIncreaseAt: 1000 }, 90, NOW);
  assert.equal(first.increased, false, "one sighting is not enough");
  assert.equal(first.state.lastSeenBase, 85, "baseline must not move on an unconfirmed rise");
  assert.equal(first.state.lastNNBIncreaseAt, 1000, "clock untouched");

  const second = applyNerveReading(first.state, 90, NOW + 120);
  assert.equal(second.increased, true, "same elevated base twice running is real");
  assert.equal(second.state.lastSeenBase, 90);
  assert.equal(second.state.lastNNBIncreaseAt, NOW, "credited to the FIRST sighting, not the confirmation");
  assert.equal(second.state.pendingBase, undefined, "pending state cleared");
});

test("a rise that reverts is discarded — permanence is the discriminator", () => {
  // Real CE steps never revert. A skewed max/perks read does. Torn's log shows
  // this account's max nerve swinging by 15-30 whenever the faction toggles its
  // nerve perk, so a one-poll skew would otherwise stamp a fake increase.
  const blip = applyNerveReading({ lastSeenBase: 85, lastNNBIncreaseAt: 1000 }, 130, NOW);
  assert.equal(blip.increased, false);

  const back = applyNerveReading(blip.state, 85, NOW + 120);
  assert.equal(back.increased, false, "reverted, so it was never an increase");
  assert.equal(back.state.lastSeenBase, 85);
  assert.equal(back.state.lastNNBIncreaseAt, 1000, "clock never moved");
  assert.equal(back.state.pendingBase, undefined);

  // ...and the real step that follows is still caught.
  const a = applyNerveReading(back.state, 90, NOW + 240);
  const b = applyNerveReading(a.state, 90, NOW + 360);
  assert.equal(b.increased, true, "a genuine step after a blip is not lost");
  assert.equal(b.state.lastNNBIncreaseAt, NOW + 240);
});

test("gaining a perk does NOT count — the base is unchanged", () => {
  // Max jumps 130 -> 160 from a +30 perk, but base stays 85. This is the case
  // that raw-maximum watching could never get right.
  const r = applyNerveReading({ lastSeenBase: 85, lastNNBIncreaseAt: 1000 }, 85, NOW);
  assert.equal(r.increased, false);
  assert.equal(r.state.lastNNBIncreaseAt, 1000, "clock untouched by a perk change");
});

test("a multi-step rise after time offline counts once", () => {
  const a = applyNerveReading({ lastSeenBase: 85, lastNNBIncreaseAt: 1000 }, 100, NOW);
  const b = applyNerveReading(a.state, 100, NOW + 120);
  assert.equal(b.increased, true, "+15 is three CE steps missed while away");
  assert.equal(b.state.lastNNBIncreaseAt, NOW);
});

test("the base going down re-baselines but never counts as an increase", () => {
  const r = applyNerveReading({ lastSeenBase: 100, lastNNBIncreaseAt: 1000 }, 85, NOW);
  assert.equal(r.increased, false);
  assert.equal(r.state.lastSeenBase, 85);
  assert.equal(r.state.lastNNBIncreaseAt, 1000);
});

test("junk readings are ignored rather than corrupting the baseline", () => {
  for (const bad of [null, undefined, 0, -5, NaN, "85"]) {
    const r = applyNerveReading({ lastSeenBase: 85, lastNNBIncreaseAt: 1000 }, bad, NOW);
    assert.equal(r.increased, false, `bad reading ${String(bad)}`);
    assert.equal(r.state.lastSeenBase, 85, "baseline preserved");
    assert.equal(r.state.lastNNBIncreaseAt, 1000);
  }
});

// ── response shaping ───────────────────────────────────────────────────────
test("response subtracts the perk total to give the real base NNB", () => {
  const out = buildResponse({ lastNNBIncreaseAt: 1000 }, 130, 45);
  assert.equal(out.nerveMax, 130);
  assert.equal(out.baseNNB, 85, "130 max minus 45 of perks");
  assert.equal(out.factionOffset, 45);
  assert.equal(out.lastNNBIncreaseAt, 1000);
});

test("falls back to the manual offset when perks are unavailable", () => {
  const out = buildResponse({ factionOffset: 30 }, 130, null);
  assert.equal(out.baseNNB, 100);
  assert.equal(out.factionOffset, 30);
});

test("an offset larger than max cannot produce a negative base", () => {
  assert.ok(buildResponse({}, 130, 999).baseNNB >= 0);
});

// ── "no perks" vs "no perk data" ───────────────────────────────────────────
// parseMaxNervePerks returns 0 for both, so the distinction has to come from
// somewhere else. Without it a bars-only response reads as base == max, which
// looks like a jump the size of the entire perk total.
test("perk data is detected only when a real perk group is present", () => {
  assert.equal(hasPerkData({ faction_perks: ["+ 30 maximum nerve"] }), true);
  assert.equal(hasPerkData({ job_perks: [] }), true, "an empty group is still an answer: no perks");
  assert.equal(hasPerkData({ nerve: { maximum: 130 } }), false, "bars-only response");
  assert.equal(hasPerkData({}), false);
  assert.equal(hasPerkData(null), false);
  assert.equal(hasPerkData({ faction_perks: "not an array" }), false);
});

test("a bars-only response must not be mistaken for 'no perks'", () => {
  const barsOnly = { nerve: { maximum: 130 } };
  const perkNerve = hasPerkData(barsOnly) ? parseMaxNervePerks(barsOnly) : null;
  assert.equal(perkNerve, null, "caller passes null, not 0");

  const out = buildResponse({ factionOffset: 45, lastNNBIncreaseAt: 1000 }, 130, perkNerve);
  assert.equal(out.baseNNB, 85, "falls back to the stored offset instead of reporting 130");
});
