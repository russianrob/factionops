import test from "node:test";
import assert from "node:assert";
import { median, coeffVar, reliabilityTier, safetyFactor, recordSample } from "./restock-tracker.js";

test("median", () => {
  assert.strictEqual(median([5]), 5);
  assert.strictEqual(median([3, 1, 2]), 2);
  assert.strictEqual(median([4, 1, 3, 2]), 2.5);
  assert.strictEqual(median([]), 0);
});

test("coeffVar", () => {
  assert.strictEqual(coeffVar([10]), 0);
  assert.strictEqual(coeffVar([10, 10, 10]), 0);
  assert.ok(coeffVar([10, 20, 30]) > 0);
});

test("reliabilityTier", () => {
  assert.strictEqual(reliabilityTier(8, 0.2), "high");
  assert.strictEqual(reliabilityTier(8, 0.5), "med");
  assert.strictEqual(reliabilityTier(4, 0.5), "med");
  assert.strictEqual(reliabilityTier(2, 0.0), "low");
  assert.strictEqual(reliabilityTier(10, 0.9), "low");
});

import { percentile } from "./restock-tracker.js";

test("percentile", () => {
  assert.strictEqual(percentile([], 0.5), 0);
  assert.strictEqual(percentile([7], 0.9), 7);
  assert.strictEqual(percentile([1, 2, 3, 4, 5], 0), 1);
  assert.strictEqual(percentile([1, 2, 3, 4, 5], 1), 5);
  assert.strictEqual(percentile([1, 2, 3, 4, 5], 0.5), 3);
  assert.strictEqual(percentile([10, 1, 2, 3, 4, 5, 6, 7, 8, 9], 0.9), 9);
});

import { gaps, recordSample, computeEntry, buildModel } from "./restock-tracker.js";

test("recordSample records a restock only when qty increases (within freshness)", () => {
  let it = { qty: null, restocks: [], lastSeen: null };
  it = recordSample(it, 5, 100);
  assert.deepStrictEqual(it, { qty: 5, restocks: [], lastSeen: 100, samples: [[100, 5]] });
  it = recordSample(it, 3, 160);
  assert.deepStrictEqual(it.restocks, []);
  it = recordSample(it, 9, 220);
  assert.deepStrictEqual(it.restocks, [220]);
  it = recordSample(it, 9, 280);
  assert.deepStrictEqual(it.restocks, [220]);
});

test("recordSample ignores undefined/NaN quantity without poisoning state", () => {
  let it = { qty: 5, restocks: [], lastSeen: 100 };
  it = recordSample(it, undefined, 160);
  assert.strictEqual(it.qty, 5);          // unchanged, not undefined
  assert.deepStrictEqual(it.restocks, []);
  it = recordSample(it, 9, 220);          // a real restock is still caught next poll
  assert.deepStrictEqual(it.restocks, [220]);
});

test("recordSample skips a restock when the item was absent too long", () => {
  let it = { qty: 3, restocks: [], lastSeen: 100 };
  it = recordSample(it, 9, 400);          // 300s gap > ABSENT_MAX(180) -> unreliable
  assert.deepStrictEqual(it.restocks, []);
});

test("recordSample caps the restock history at 24", () => {
  let it = { qty: 0, restocks: [] };
  for (let i = 1; i <= 30; i++) it = recordSample({ qty: 0, restocks: it.restocks }, i, 100 + i);
  assert.strictEqual(it.restocks.length, 24);
});

test("recordSample appends [nowSec, curQty] to samples on every valid numeric sample", () => {
  let it = { qty: null, restocks: [], lastSeen: null, samples: [] };
  it = recordSample(it, 5, 100);
  it = recordSample(it, 4, 160);
  it = recordSample(it, 4, 220);
  assert.deepStrictEqual(it.samples, [[100, 5], [160, 4], [220, 4]]);
});

test("recordSample trims samples older than nowSec - WINDOW_SEC - 120", () => {
  let it = { qty: 0, restocks: [], lastSeen: null, samples: [] };
  const now = 100000;
  it = recordSample(it, 9, now - 2000);  // age 2000 > 1800+120=1920 -> trimmed
  it = recordSample(it, 8, now - 1900);  // age 1900 < 1920 -> kept
  it = recordSample(it, 7, now);
  assert.deepStrictEqual(it.samples, [[now - 1900, 8], [now, 7]]);
});

test("recordSample caps samples length at SAMPLE_CAP (40)", () => {
  let it = { qty: 0, restocks: [], lastSeen: null, samples: [] };
  for (let i = 1; i <= 60; i++) it = recordSample(it, 100, 1000 + i);
  assert.strictEqual(it.samples.length, 40);
  assert.deepStrictEqual(it.samples[0], [1021, 100]);
  assert.deepStrictEqual(it.samples[39], [1060, 100]);
});

test("recordSample non-finite qty carries samples through untouched", () => {
  let it = { qty: 5, restocks: [], lastSeen: 100, samples: [[100, 5]] };
  it = recordSample(it, undefined, 160);
  assert.deepStrictEqual(it.samples, [[100, 5]]);
  assert.strictEqual(it.qty, 5);
});

test("recordSample tolerates missing samples on prior state", () => {
  let it = { qty: 5, restocks: [], lastSeen: 100 };
  it = recordSample(it, 4, 160);
  assert.deepStrictEqual(it.samples, [[160, 4]]);
});

import { computeSellRate, depletionReliability } from "./restock-tracker.js";

test("computeSellRate steady decline -> mean units/min", () => {
  const now = 10000;
  const s = [[now - 180, 100], [now - 120, 90], [now - 60, 80], [now, 70]];
  const r = computeSellRate(s, now);
  assert.strictEqual(r.usableIntervals, 3);
  assert.strictEqual(r.observedSec, 180);
  assert.strictEqual(r.sumDrops, 30);
  assert.strictEqual(r.sumDropsRaw, 30);
  assert.strictEqual(r.sellRate, 10);
  assert.ok(Math.abs(r.maxDropShare - 1 / 3) < 1e-9);
});

test("computeSellRate skips restock-up interval entirely", () => {
  const now = 10000;
  const s = [[now - 240, 50], [now - 180, 40], [now - 120, 100], [now - 60, 90], [now, 80]];
  const r = computeSellRate(s, now);
  assert.strictEqual(r.usableIntervals, 3);
  assert.strictEqual(r.observedSec, 180);
  assert.strictEqual(r.sumDropsRaw, 30);
  assert.strictEqual(r.sellRate, 10);
});

test("computeSellRate skips coverage-gap interval (dt > ABSENT_MAX)", () => {
  const now = 10000;
  const s = [[now - 600, 100], [now - 540, 90], [now - 240, 80], [now - 180, 70], [now - 120, 60]];
  const r = computeSellRate(s, now);
  assert.strictEqual(r.usableIntervals, 3);
  assert.strictEqual(r.observedSec, 180);
  assert.strictEqual(r.sumDropsRaw, 30);
  assert.strictEqual(r.sellRate, 10);
});

test("computeSellRate winsorizes a whale-buy and flags maxDropShare", () => {
  const now = 10000;
  const q = [200, 198, 196, 194, 192, 190, 188, 186, 184, 182, 132];
  const s = q.map((v, i) => [now - 600 + i * 60, v]);
  const r = computeSellRate(s, now);
  assert.strictEqual(r.usableIntervals, 10);
  assert.strictEqual(r.observedSec, 600);
  assert.strictEqual(r.sumDropsRaw, 68);
  assert.strictEqual(r.sumDrops, 23);
  assert.ok(Math.abs(r.sellRate - 2.3) < 1e-9);
  assert.ok(r.maxDropShare > 0.6);
});

test("computeSellRate idle window -> rate 0, maxDropShare 0", () => {
  const now = 10000;
  const s = [[now - 120, 50], [now - 60, 50], [now, 50]];
  const r = computeSellRate(s, now);
  assert.strictEqual(r.usableIntervals, 2);
  assert.strictEqual(r.observedSec, 120);
  assert.strictEqual(r.sumDrops, 0);
  assert.strictEqual(r.sellRate, 0);
  assert.strictEqual(r.maxDropShare, 0);
});

test("computeSellRate returns null with fewer than 2 samples", () => {
  const now = 10000;
  assert.strictEqual(computeSellRate([], now), null);
  assert.strictEqual(computeSellRate([[now, 5]], now), null);
});

test("computeSellRate returns null when all intervals are skipped", () => {
  const now = 10000;
  const s = [[now - 400, 10], [now, 5]];
  assert.strictEqual(computeSellRate(s, now), null);
});

test("computeSellRate ignores samples outside the trailing window", () => {
  const now = 10000;
  const s = [[now - 5000, 100], [now - 60, 90], [now, 80]];
  const r = computeSellRate(s, now);
  assert.strictEqual(r.usableIntervals, 1);
  assert.strictEqual(r.observedSec, 60);
  assert.strictEqual(r.sumDropsRaw, 10);
});

test("depletionReliability tiers", () => {
  assert.strictEqual(depletionReliability(12, 0.3, 0.8), "high");
  assert.strictEqual(depletionReliability(12, 0.5, 0.8), "med");
  assert.strictEqual(depletionReliability(12, 0.3, 0.6), "med");
  assert.strictEqual(depletionReliability(6, 0.5, 0.9), "med");
  assert.strictEqual(depletionReliability(5, 0.3, 0.9), "low");
  assert.strictEqual(depletionReliability(6, 0.7, 0.9), "low");
});

test("computeEntry: needs >=1 valid gap; filters sub-180s gaps; n = gap count", () => {
  assert.strictEqual(computeEntry([1000]), null);
  assert.strictEqual(computeEntry([1000, 1050]), null);            // only a 50s gap -> filtered -> null
  const e = computeEntry([1000, 2500, 4000]);                      // gaps 1500,1500
  assert.strictEqual(e.interval, 1500);
  assert.strictEqual(e.last, 4000);
  assert.strictEqual(e.n, 2);
  assert.strictEqual(e.rel, "low");
});

test("computeEntry restock-only entry has sellReady=false and no sell fields", () => {
  const e = computeEntry([1000, 2500, 4000], [], 4000);
  assert.strictEqual(e.interval, 1500);
  assert.strictEqual(e.n, 2);
  assert.strictEqual(e.sellReady, false);
  assert.strictEqual(e.sellRate, undefined);
});

test("computeEntry sell-ready entry attaches the full depletion field set", () => {
  const now = 10000;
  const q = [100, 99, 98, 97, 96, 95, 94, 93, 92, 91, 90, 89];
  const s = q.map((v, i) => [now - 660 + i * 60, v]);
  const e = computeEntry([], s, now);
  assert.strictEqual(e.sellReady, true);
  assert.strictEqual(e.sellRate, 1);
  assert.strictEqual(e.srel, "med");
  assert.strictEqual(e.modelQty, 89);
  assert.strictEqual(e.n2, 11);
  assert.strictEqual(e.obsSec, 660);
  assert.strictEqual(e.sumDrops, 11);
  assert.strictEqual(e.secToSellout, 77);
  assert.strictEqual(e.interval, undefined);
});

test("computeEntry gates off a sell rate with too few units sold", () => {
  const now = 10000;
  const q = [100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 99];
  const s = q.map((v, i) => [now - 660 + i * 60, v]);
  const e = computeEntry([], s, now);
  assert.strictEqual(e, null);
});

test("computeEntry gates off a sell rate with too short observation", () => {
  const now = 10000;
  const q = [100, 95, 90, 85, 80, 75];
  const s = q.map((v, i) => [now - 300 + i * 60, v]);  // 5 intervals, 300s observed
  const e = computeEntry([], s, now);
  assert.strictEqual(e, null);
});

test("computeEntry combines restock and sell-ready data on one entry", () => {
  const now = 10000;
  const q = [100, 99, 98, 97, 96, 95, 94, 93, 92, 91, 90, 89];
  const s = q.map((v, i) => [now - 660 + i * 60, v]);
  const e = computeEntry([now - 3000, now - 1500], s, now);
  assert.strictEqual(e.interval, 1500);
  assert.strictEqual(e.sellReady, true);
  assert.strictEqual(e.sellRate, 1);
});

test("buildModel keeps only items with a valid interval and a recent last", () => {
  const now = 10000;
  const state = {
    mex: {
      "1": { qty: 0, restocks: [now - 3000, now - 1500] },         // gap 1500 ok, last recent
      "2": { qty: 0, restocks: [now - 1500] },                     // 1 restock -> null
      "3": { qty: 0, restocks: [100, 1600] }                       // last way older than 6h? last=1600, now-1600 > 21600? no
    }
  };
  const model = buildModel(state, now);
  assert.strictEqual(model.updated, now);
  assert.ok(model.items.mex["1"]);
  assert.strictEqual(model.items.mex["2"], undefined);
});

test("buildModel publishes a sell-only item that has no restock history", () => {
  const now = 10000;
  const q = [100, 99, 98, 97, 96, 95, 94, 93, 92, 91, 90, 89];
  const samples = q.map((v, i) => [now - 660 + i * 60, v]);
  const state = { mex: { "7": { qty: 89, restocks: [], samples: samples } } };
  const model = buildModel(state, now);
  assert.ok(model.items.mex["7"]);
  assert.strictEqual(model.items.mex["7"].sellReady, true);
  assert.strictEqual(model.items.mex["7"].interval, undefined);
});

test("buildModel drops a stale restock-only item but keeps a fresh sell rate", () => {
  const now = 100000;
  const q = [100, 99, 98, 97, 96, 95, 94, 93, 92, 91, 90, 89];
  const samples = q.map((v, i) => [now - 660 + i * 60, v]);
  const state = { mex: { "9": { qty: 89, restocks: [now - 90000, now - 88000], samples: samples } } };
  const model = buildModel(state, now);
  assert.ok(model.items.mex["9"]);
  assert.strictEqual(model.items.mex["9"].sellReady, true);
});

test("safetyFactor: Tiger Day (Jul 28-29 TCT) runs 1.4, normal days 1.15", () => {
  const jul28 = Date.UTC(2026, 6, 28, 12) / 1000;
  const jul29 = Date.UTC(2026, 6, 29, 3) / 1000;
  const jul30 = Date.UTC(2026, 6, 30, 12) / 1000;
  const feb1 = Date.UTC(2026, 1, 1, 12) / 1000;
  assert.equal(safetyFactor(jul28), 1.4);
  assert.equal(safetyFactor(jul29), 1.4);
  assert.equal(safetyFactor(jul30), 1.15);
  assert.equal(safetyFactor(feb1), 1.15);
});

test("sell-back blips don't count as restocks; real restocks do", () => {
  let item = recordSample(null, 2500, 1000);       // first sight, big stock
  item = recordSample(item, 0, 1060);              // sold out
  item = recordSample(item, 1, 1120);              // +1 sell-back — not a restock
  assert.equal(item.restocks.length, 0);
  item = recordSample(item, 0, 1180);
  item = recordSample(item, 91, 1240);             // +91 on a 2500-cap item — still a blip
  assert.equal(item.restocks.length, 0);
  item = recordSample(item, 0, 1300);
  item = recordSample(item, 2400, 1360);           // the real restock
  assert.equal(item.restocks.length, 1);
});

test("small-cap items still register their small restocks", () => {
  let item = recordSample(null, 20, 1000);         // cap ~20
  item = recordSample(item, 0, 1060);
  item = recordSample(item, 18, 1120);             // real restock for this item
  assert.equal(item.restocks.length, 1);
});
