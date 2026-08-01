import test from "node:test";
import assert from "node:assert/strict";
import { applyNerveReading, buildResponse, parseMaxNervePerks } from "./nerve-tracker.js";

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

test("a rise in the base is a CE step and stamps the moment", () => {
  const r = applyNerveReading({ lastSeenBase: 85, lastNNBIncreaseAt: 1000 }, 90, NOW);
  assert.equal(r.increased, true);
  assert.equal(r.state.lastSeenBase, 90);
  assert.equal(r.state.lastNNBIncreaseAt, NOW);
});

test("gaining a perk does NOT count — the base is unchanged", () => {
  // Max jumps 130 -> 160 from a +30 perk, but base stays 85. This is the case
  // that raw-maximum watching could never get right.
  const r = applyNerveReading({ lastSeenBase: 85, lastNNBIncreaseAt: 1000 }, 85, NOW);
  assert.equal(r.increased, false);
  assert.equal(r.state.lastNNBIncreaseAt, 1000, "clock untouched by a perk change");
});

test("a multi-step rise after time offline counts once", () => {
  const r = applyNerveReading({ lastSeenBase: 85, lastNNBIncreaseAt: 1000 }, 100, NOW);
  assert.equal(r.increased, true, "+15 is three CE steps missed while away");
  assert.equal(r.state.lastNNBIncreaseAt, NOW);
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
