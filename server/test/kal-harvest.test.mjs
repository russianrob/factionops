import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, existsSync, writeFileSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Point the store at a scratch dir BEFORE importing — the module resolves
// DATA_DIR once at load.
const dir = mkdtempSync(join(tmpdir(), "kal-harvest-"));
process.env.DATA_DIR = dir;
const kh = await import("../kal-harvest.js");

after(() => { try { rmSync(dir, { recursive: true, force: true }); } catch {} });

// The shape KAL puts in the page, as summarise() expects it.
const loadout = (observedAt, weapon = "Jackhammer") => ({
  observed_at: observedAt,
  equipment: [
    { name: weapon, type: "primary", slot_name: "primary", rarity: "yellow",
      bonuses: [{ title: "Specialist", value: 21, rarity: "orange" }] },
    { name: "Dune Vest", type: "armor", slot_name: "body", rarity: "yellow", bonuses: [] },
  ],
});

test("a real loadout is summarised and stored", () => {
  kh._reset();
  const row = kh.record("111", loadout(1700000000), { name: "Someone", factionId: 7227, by: 137558 });
  assert.ok(row, "should store");
  assert.equal(row.name, "Someone");
  assert.equal(row.factionId, "7227");
  assert.equal(row.by, 137558);
  assert.equal(row.summary.primary.name, "Jackhammer");
  assert.equal(row.summary.armour.length, 1);
  assert.equal(row.summary.bonuses[0].title, "Specialist");
  // the bonus must know which item it sits on — the mini-profile renders by it
  assert.equal(row.summary.bonuses[0].on, "Jackhammer");
});

test("it reads back, and survives a reload from disk", () => {
  kh._reset();
  kh.record("222", loadout(1700000000), {});
  assert.ok(kh.harvestedFor("222"), "in memory");
  kh._reset();                       // forget the cache, force a disk read
  assert.ok(kh.harvestedFor("222"), "and from disk");
  assert.ok(existsSync(join(dir, "kal-harvest.json")));
});

test("a card with nothing ever observed stores nothing", () => {
  kh._reset();
  // KAL renders a card for players it has never seen equipped. That is the
  // ordinary case, not an error.
  assert.equal(kh.record("333", { observed_at: 1, equipment: [] }, {}), null);
  assert.equal(kh.record("333", {}, {}), null);
  assert.equal(kh.record("333", null, {}), null);
  assert.equal(kh.harvestedFor("333"), null);
});

test("a junk player id is refused", () => {
  kh._reset();
  assert.equal(kh.record("0", loadout(1), {}), null);
  assert.equal(kh.record("", loadout(1), {}), null);
  assert.equal(kh.record("not-an-id", loadout(1), {}), null);
});

test("an oversized equipment list is refused", () => {
  kh._reset();
  const huge = { observed_at: 1, equipment: Array.from({ length: 41 }, (_, i) => ({ name: "x" + i, type: "primary", bonuses: [] })) };
  assert.equal(kh.record("444", huge, {}), null);
});

test("a STALER sighting never overwrites a fresher one", () => {
  kh._reset();
  kh.record("555", loadout(1700001000, "Rheinmetall"), {});
  // another member walks past the same profile and KAL serves them an older
  // cached answer — that must not clobber what we already have
  const after = kh.record("555", loadout(1700000000, "Pocket Knife"), {});
  assert.equal(after.summary.primary.name, "Rheinmetall", "older observation must lose");
  assert.equal(kh.harvestedFor("555").summary.primary.name, "Rheinmetall");
});

test("a FRESHER sighting does replace", () => {
  kh._reset();
  kh.record("666", loadout(1700000000, "Pocket Knife"), {});
  kh.record("666", loadout(1700002000, "Rheinmetall"), {});
  assert.equal(kh.harvestedFor("666").summary.primary.name, "Rheinmetall");
});

test("rows expire rather than being served forever", () => {
  kh._reset();
  kh.record("777", loadout(1700000000), {});
  const future = Date.now() + kh.MAX_AGE_MS + 1000;
  assert.equal(kh.harvestedFor("777", future), null, "past MAX_AGE_MS reads as absent");
  assert.ok(kh.harvestedFor("777"), "but is fine now");
});

test("stats separate live rows from expired ones", () => {
  // Fresh store: earlier tests left rows on disk and _reset() re-reads them.
  try { unlinkSync(join(dir, "kal-harvest.json")); } catch {}
  kh._reset();
  kh.record("888", loadout(1700000000), {});
  kh.record("999", loadout(1700000000), {});
  const now = kh.stats();
  assert.equal(now.players, 2);
  assert.equal(now.live, 2);
  const later = kh.stats(Date.now() + kh.MAX_AGE_MS + 1000);
  assert.equal(later.players, 2, "still on disk");
  assert.equal(later.live, 0, "but none of them count");
});

test("an unreadable store does not throw, it starts empty", () => {
  writeFileSync(join(dir, "kal-harvest.json"), "{not json");
  kh._reset();
  assert.doesNotThrow(() => kh.harvestedFor("111"));
  assert.equal(kh.harvestedFor("111"), null);
});
