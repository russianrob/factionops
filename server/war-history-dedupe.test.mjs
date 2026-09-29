// A single war ending up as two records.
//
// _warKey() uses Torn's real war id when known and a synthetic
// archived_<fid>_<eid>_<sec> key when not, so the same war lands under two keys
// depending on what was known at capture time. Found 2026-09-16: 24 records for
// 18 wars, which inflated every total computed by summing rows — including a
// member's lifetime payout.
import { test } from "node:test";
import assert from "node:assert/strict";
import { dedupeWars } from "./war-history.js";

const war = (over) => ({
  enemyFactionId: 900, warEndedAt: 1781940688000,
  members: [{ playerId: "1" }, { playerId: "2" }], ...over,
});

test("the archived copy of a war already recorded is dropped", () => {
  const out = dedupeWars({
    "43936": war({ realWarId: "43936", warKey: "43936" }),
    "archived_42055_44092_1781940688": war({ realWarId: null, warKey: "archived_42055_44092_1781940688" }),
  });
  assert.deepEqual(Object.keys(out), ["43936"], "the real war id is the identity to keep");
});

test("an archived war with no twin is kept", () => {
  // Captured only after archiving — dropping it would lose the war entirely.
  const only = { "archived_42055_10856_1786690073": war({ realWarId: null }) };
  assert.equal(Object.keys(dedupeWars(only)).length, 1);
});

test("two different wars against the same faction both survive", () => {
  // Rematches are ordinary. Only the end time separates them.
  const out = dedupeWars({
    a: war({ realWarId: "1", warEndedAt: 1781940688000 }),
    b: war({ realWarId: "2", warEndedAt: 1783255244000 }),
  });
  assert.equal(Object.keys(out).length, 2);
});

test("a differing roster size is not treated as the same war", () => {
  const out = dedupeWars({
    "50": war({ realWarId: "50" }),
    "archived_x": war({ realWarId: null, members: [{ playerId: "1" }] }),
  });
  assert.equal(Object.keys(out).length, 2, "63 members and 1 member are not one war");
});

test("it is idempotent", () => {
  const once = dedupeWars({
    "43936": war({ realWarId: "43936" }),
    "archived_42055_44092_1781940688": war({ realWarId: null }),
  });
  assert.deepEqual(Object.keys(dedupeWars(once)), Object.keys(once));
});

test("nothing is dropped when no record carries a real id", () => {
  // Older captures predate realWarId; they must all survive.
  const out = dedupeWars({ a: war({ realWarId: null }), b: war({ realWarId: null, warEndedAt: 1 }) });
  assert.equal(Object.keys(out).length, 2);
});

// Against the real store, asserting the INVARIANT rather than a count.
// This used to read "24 raw collapses to 18". Both numbers were facts about
// one afternoon's data: the store holds 21 now, so the test failed while
// dedupe was working perfectly. A war being fought is not a regression.
test("the real store keeps one record per real war id, and loses nothing else", async () => {
  const fs = await import("node:fs");
  const raw = JSON.parse(fs.readFileSync("data/war-history/42055.json", "utf8"));
  const before = Object.values(raw.wars);
  const after = Object.values(dedupeWars(raw.wars));
  assert.ok(before.length > 0, "the real store is empty — nothing was exercised");

  // The whole point of dedupe: a real war id appears at most once.
  const ids = after.map((w) => w.realWarId).filter(Boolean);
  assert.equal(new Set(ids).size, ids.length, "a real war id survived more than once");

  // Every distinct real id that went in still comes out.
  const inIds = new Set(before.map((w) => w.realWarId).filter(Boolean));
  assert.deepEqual([...inIds].filter((id) => !ids.includes(id)), [], "a real war was dropped entirely");

  // Records predating realWarId are never collapsed into each other.
  const idless = (rows) => rows.filter((w) => !w.realWarId).length;
  assert.equal(idless(after), idless(before), "an id-less record was dropped");
});
