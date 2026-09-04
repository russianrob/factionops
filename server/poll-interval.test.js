import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import fs from "node:fs";

// Throwaway DATA_DIR before importing the store, so these never touch ./data.
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "wb-poll-interval-"));
const { getPollInterval, setKeyPoolingOpt, storeApiKey } = await import("./store.js");

const FID = "42055";
function poolOf(n) {
  for (let i = 0; i < n; i++) {
    const pid = String(800000 + i);
    storeApiKey(pid, `k${i}`);
    setKeyPoolingOpt(pid, true, FID);
  }
}

// The per-enemy profile sweep was removed on 2026-09-04 and its config entry
// with it, so an "enemy-profile" lookup now falls through to the default.
//
// That fallback is what this covers. getPollInterval never returns undefined
// for an unknown purpose -- it lands on war-status's interval -- and a NaN
// here would go straight into setTimeout and spin a poller at zero delay.
test("an unknown purpose falls back to the war-status interval, never NaN", () => {
  poolOf(1);
  assert.equal(getPollInterval(FID, "enemy-profile"), 45_000);
  poolOf(36);
  assert.equal(getPollInterval(FID, "no-such-poller"), 45_000, "a big pool must not speed the fallback up");
  assert.equal(Number.isFinite(getPollInterval(FID, undefined)), true);
});

test("the other purposes keep their own floors", () => {
  // Regression guard: this change must not speed anything else up.
  poolOf(36);
  assert.equal(getPollInterval(FID, "chain"), 10_000);
  assert.equal(getPollInterval(FID, "war-status"), 45_000);
  assert.equal(getPollInterval(FID, "attacks-feed"), 15_000);
});

test("an unknown purpose still falls back to war-status", () => {
  poolOf(36);
  assert.equal(getPollInterval(FID, "nonsense"), getPollInterval(FID, "war-status"));
});
