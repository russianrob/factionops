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

// The per-enemy profile sweep was pinned to a flat 30s on 2026-08-11 because it
// was the monitor's heaviest API consumer. The pool has since grown to 36 keys
// (3,600 calls/min), so the budget objection is gone — but a SMALL pool must
// still be protected, which is what dividing by pool size gives.
test("enemy-profile speeds up as the pool grows, and floors at 2.5s", () => {
  poolOf(1);
  assert.equal(getPollInterval(FID, "enemy-profile"), 30_000, "one key: unchanged from before");
  poolOf(6);
  assert.equal(getPollInterval(FID, "enemy-profile"), 5_000, "six keys: 30s/6");
  poolOf(36);
  assert.equal(getPollInterval(FID, "enemy-profile"), 2_500, "a full pool floors at 2.5s");
});

test("the floor holds however large the pool gets", () => {
  poolOf(200);
  assert.equal(getPollInterval(FID, "enemy-profile"), 2_500,
    "never faster than 2.5s — Torn caches profiles and the extra calls buy nothing");
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
