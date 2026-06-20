import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import fs from "node:fs";

// Redirect persistence to a throwaway dir BEFORE importing the store, so the
// stateful pool mutators exercised here never touch real ./data files. The
// store reads DATA_DIR once at module-load, so the dynamic import must follow.
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "wb-pool-demote-"));
const store = await import("./store.js");
const {
  poolOptServesSelection,
  demotePoolKeySelection,
  clearPoolKeyDeniedSelections,
  getPooledKeysForFaction,
  setKeyPoolingOpt,
  storeApiKey,
} = store;

test("poolOptServesSelection: null required selection always qualifies", () => {
  assert.equal(poolOptServesSelection({ accessLevel: 1 }, null), true);
});

test("poolOptServesSelection: full access (>=4) serves any selection", () => {
  assert.equal(poolOptServesSelection({ accessLevel: 4, factionSelections: [] }, "chain"), true);
});

test("poolOptServesSelection: explicit selection grant qualifies", () => {
  assert.equal(poolOptServesSelection({ accessLevel: 3, factionSelections: ["chain", "members"] }, "chain"), true);
});

test("poolOptServesSelection: unrecorded (unknown) key slips through", () => {
  assert.equal(poolOptServesSelection({}, "chain"), true);
});

test("poolOptServesSelection: limited key without the selection is skipped", () => {
  assert.equal(poolOptServesSelection({ accessLevel: 3, factionSelections: ["basic"] }, "chain"), false);
});

test("poolOptServesSelection: deniedSelections overrides every allow path", () => {
  assert.equal(poolOptServesSelection({ accessLevel: 4, deniedSelections: ["chain"] }, "chain"), false);
  assert.equal(poolOptServesSelection({ accessLevel: 3, factionSelections: ["chain"], deniedSelections: ["chain"] }, "chain"), false);
  assert.equal(poolOptServesSelection({ deniedSelections: ["chain"] }, "chain"), false);
  // ...but only for the denied selection — others still resolve normally.
  assert.equal(poolOptServesSelection({ accessLevel: 4, deniedSelections: ["chain"] }, "members"), true);
});

test("demote routes a key away from the denied selection but keeps it for others", () => {
  const PID = "990001", FID = "77777", KEY = "test-key-abc";
  storeApiKey(PID, KEY);
  setKeyPoolingOpt(PID, true, FID, { accessLevel: 4, factionSelections: ["chain"] });

  assert.ok(getPooledKeysForFaction(FID, "chain").some((k) => k.playerId === PID), "baseline: serves chain");

  assert.equal(demotePoolKeySelection(KEY, FID, "chain"), true);
  assert.equal(getPooledKeysForFaction(FID, "chain").some((k) => k.playerId === PID), false, "routed away from chain");
  assert.ok(getPooledKeysForFaction(FID, "members").some((k) => k.playerId === PID), "still serves members (non-destructive)");
  assert.ok(getPooledKeysForFaction(FID, null).some((k) => k.playerId === PID), "still in the unrouted pool");
});

test("demote survives a key-verify re-record of a key that still claims the selection", () => {
  const PID = "990002", FID = "77777", KEY = "test-key-def";
  storeApiKey(PID, KEY);
  setKeyPoolingOpt(PID, true, FID, { accessLevel: 4, factionSelections: ["chain"] });
  demotePoolKeySelection(KEY, FID, "chain");
  // The 6-hourly key-verify sweep re-records fresh key/info that STILL lists
  // chain (the lying-key case that pure routing can't catch) — the denylist
  // must persist through it.
  setKeyPoolingOpt(PID, true, FID, { accessLevel: 4, factionSelections: ["chain"] });
  assert.equal(getPooledKeysForFaction(FID, "chain").some((k) => k.playerId === PID), false);
});

test("clearPoolKeyDeniedSelections rehabilitates on a deliberate re-opt-in", () => {
  const PID = "990003", FID = "77777", KEY = "test-key-ghi";
  storeApiKey(PID, KEY);
  setKeyPoolingOpt(PID, true, FID, { accessLevel: 4, factionSelections: ["chain"] });
  demotePoolKeySelection(KEY, FID, "chain");
  assert.equal(getPooledKeysForFaction(FID, "chain").some((k) => k.playerId === PID), false);

  assert.equal(clearPoolKeyDeniedSelections(PID), true);
  assert.ok(getPooledKeysForFaction(FID, "chain").some((k) => k.playerId === PID), "back in the chain pool");
});
