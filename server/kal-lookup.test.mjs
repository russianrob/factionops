// Finding one player's loadout in the faction packs already on disk.
//
// The mini-profile opens on hover, so this path must NEVER call KAL: their
// terms ask for appropriate caching and a call per hover is the opposite of
// that. It reads only what a pre-war scout already fetched, and says nothing
// when there is no pack — which is the normal case for anybody outside the
// current opponent.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const DIR = mkdtempSync(join(tmpdir(), 'kal-'));
mkdirSync(join(DIR, 'kal-cache'), { recursive: true });
process.env.DATA_DIR = DIR;

const pack = (factionId, name, members, fetchedAt = Date.now()) =>
  writeFileSync(join(DIR, 'kal-cache', `faction-${factionId}.json`),
    JSON.stringify({ factionName: name, members, fetchedAt }));

pack(8205, "Howler's Haven", [
  { user_id: 111, name: 'Loaded', loadout: { observed_at: 1700000000, equipment: [
      { name: 'Rheinmetall MG 3', type: 'Primary', slot_name: 'primary', rarity: 'orange',
        bonuses: [{ title: 'Deadeye', value: 30, rarity: 'red' }] },
      { name: 'Riot Helmet', type: 'Armor', slot_name: 'head', rarity: 'yellow', bonuses: [] },
  ] } },
  { user_id: 222, name: 'Unseen', loadout: null },
]);
pack(999, 'Other Lot', [{ user_id: 333, name: 'Elsewhere', loadout: { equipment: [
  { name: 'Pocket Rocket', type: 'Primary', slot_name: 'primary', rarity: 'red', bonuses: [] } ] } }]);

const kal = await import('./kal-loadouts.js');

test('a player in a cached pack is found, with their faction named', () => {
  const hit = kal.cachedLoadoutFor(111);
  assert.equal(hit.factionId, '8205');
  assert.equal(hit.factionName, "Howler's Haven");
  assert.equal(hit.summary.primary.name, 'Rheinmetall MG 3');
  assert.equal(hit.summary.notable[0].rarity, 'red');
});

test('packs other than the opponent are searched too', () => {
  assert.equal(kal.cachedLoadoutFor(333).factionId, '999');
});

test('a member with no sighting is a miss, not an empty shell', () => {
  assert.equal(kal.cachedLoadoutFor(222), null);
});

test('an unknown player is simply a miss', () => {
  assert.equal(kal.cachedLoadoutFor(42424242), null);
});

test('ids compare as strings, so a numeric id still matches', () => {
  assert.ok(kal.cachedLoadoutFor('111'));
});

test('the pack age comes back, so stale data can be labelled', () => {
  const hit = kal.cachedLoadoutFor(111);
  assert.ok(typeof hit.packAgeMs === 'number' && hit.packAgeMs >= 0);
});

// ── every bonus, not just the loud ones ───────────────────────────────
// 208 of the 238 bonuses in one real faction pack are YELLOW. Filtering to
// red+orange hid almost all of them, which made "no bonus shown" and "no
// bonus" look identical on a card. `notable` stays red+orange for the
// pre-war report, which lists ten players at once; `bonuses` carries the
// lot for a card showing one.
test('summarise keeps every bonus, and still flags the loud ones apart', async () => {
  const kal2 = await import('./kal-loadouts.js');
  const s = kal2.summarise({ equipment: [
    { name: 'Blowgun', type: 'Primary', slot_name: 'primary',
      bonuses: [{ title: 'Poison', value: 91, rarity: 'red' }] },
    { name: 'Combat Helmet', type: 'Armor', slot_name: 'head',
      bonuses: [{ title: 'Impenetrable', value: 8, rarity: 'yellow' }] },
  ] });
  assert.deepEqual(s.notable.map((b) => b.rarity), ['red']);
  assert.deepEqual(s.bonuses.map((b) => [b.rarity, b.title, b.on]),
    [['red', 'Poison', 'Blowgun'], ['yellow', 'Impenetrable', 'Combat Helmet']]);
});

test('a bonus knows which item it is on, so a card can name it', async () => {
  const kal2 = await import('./kal-loadouts.js');
  const s = kal2.summarise({ equipment: [
    { name: 'Taser', type: 'Secondary', slot_name: 'secondary',
      bonuses: [{ title: 'Shock', value: 100, rarity: 'orange' }] },
  ] });
  assert.equal(s.bonuses[0].on, 'Taser');
});

test('no bonuses at all is an empty list, not a missing field', async () => {
  const kal2 = await import('./kal-loadouts.js');
  const s = kal2.summarise({ equipment: [
    { name: 'Jackhammer', type: 'Primary', slot_name: 'primary', bonuses: [] },
  ] });
  assert.deepEqual(s.bonuses, []);
});
