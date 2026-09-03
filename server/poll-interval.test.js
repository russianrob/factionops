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

// The per-enemy profile sweep is pinned FLAT: min == max, so a bigger key pool
// cannot speed it back up.
//
// It was unpinned to 2.5s on 2026-08-28 on the arithmetic that 480 calls/min
// against a 3,600/min pool ceiling was 13% headroom, and re-pinned hours later
// when the owner hit Torn's rate limit. Torn limits per KEY per minute, several
// other pollers draw on the same keys, and quarantined keys shrink the
// rotation — so the per-faction average badly understated the real load.
//
// This test exists to make an unpinning deliberate rather than incidental.
test("enemy-profile stays flat however large the pool grows", () => {
  poolOf(1);
  assert.equal(getPollInterval(FID, "enemy-profile"), 2_500);
  poolOf(36);
  assert.equal(getPollInterval(FID, "enemy-profile"), 2_500, "a big pool must NOT speed it up");
  poolOf(200);
  assert.equal(getPollInterval(FID, "enemy-profile"), 2_500);
});

test("the other purposes keep their own floors", () => {
  // Regression guard: this change must not speed anything else up.
  poolOf(36);
  assert.equal(getPollInterval(FID, "chain"), 10_000);
  assert.equal(getPollInterval(FID, "war-status"), 15_000);
  assert.equal(getPollInterval(FID, "attacks-feed"), 15_000);
});

test("an unknown purpose still falls back to war-status", () => {
  poolOf(36);
  assert.equal(getPollInterval(FID, "nonsense"), getPollInterval(FID, "war-status"));
});
