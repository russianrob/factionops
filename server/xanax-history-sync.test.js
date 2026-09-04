// syncXanaxFromWar: the mirror that keeps a frozen report honest after a war.
import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os"; import path from "node:path"; import fs from "node:fs";
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "wb-xsync-"));
const wh = await import("./war-history.js");

const FID = "42055", EID = "40692", ENDED = 1788507905000;
const KEY = `archived_${FID}_${EID}_${Math.floor(ENDED / 1000)}`;
const liveWar = (taken) => ({
  factionId: FID, enemyFactionId: EID, warEndedAt: ENDED,
  xanaxStats: { taken, names: { "4143060": "Shefin" }, lastPolledAt: 1788544507 },
});

test("does nothing when the war was never archived", () => {
  assert.equal(wh.syncXanaxFromWar(liveWar({ "4143060": 1 })), null);
});

test("does nothing without stats, or without a war", () => {
  assert.equal(wh.syncXanaxFromWar(null), null);
  assert.equal(wh.syncXanaxFromWar({ factionId: FID }), null);
  assert.equal(wh.syncXanaxFromWar({ factionId: FID, xanaxStats: {} }), null);
});

test("a late deposit reaches the frozen report", () => {
  wh.ingestWar(FID, { factionId: FID, enemyFactionId: EID, warEndedAt: ENDED },
    { factionId: FID, enemyFactionId: EID, warId: KEY,
      members: [{ playerId: "4143060", name: "Shefin", totalAttacks: 10 }] });

  // Freeze it the way a real war does: at the take-only figure the tracker
  // had when the snapshot was taken, before anybody handed vials back.
  wh.backfillXanaxForWar(FID, KEY, { "4143060": 4 }, { "4143060": "Shefin" }, {});
  const before = wh.getWar(FID, KEY);
  assert.equal(before.members[0].xanaxTaken, 4, "frozen at the take-only figure");

  // the tracker later nets the return: 4 taken - 3 returned
  const res = wh.syncXanaxFromWar(liveWar({ "4143060": 1 }));
  assert.ok(res, "sync should report a patch");

  const after = wh.getWar(FID, KEY);
  assert.equal(after.members[0].xanaxTaken, 1, "member row must follow the live figure");
  assert.equal(after.xanaxStats.taken["4143060"], 1);
  assert.equal(after.xanaxStats.names["4143060"], "Shefin");
});

test("a member who returned everything drops to zero, not negative", () => {
  wh.syncXanaxFromWar(liveWar({ "4143060": 0 }));
  assert.equal(wh.getWar(FID, KEY).members[0].xanaxTaken, 0);
});
