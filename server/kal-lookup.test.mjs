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
