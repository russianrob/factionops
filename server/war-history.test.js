// Tests for xanax-accountability persistence in the durable war-history store.
// Run: node --test war-history.test.js
import { test } from 'node:test';
import assert from 'node:assert';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// war-history.js resolves its data dir from DATA_DIR at import time, so point
// it at a throwaway temp dir BEFORE importing (dynamic import for ordering).
process.env.DATA_DIR = mkdtempSync(join(tmpdir(), 'wh-xanax-test-'));
const { ingestWar, getWar, aggregateByMember, backfillXanaxForWar } = await import('./war-history.js');
// These tests are about FREEZING and PRESERVING the accountability numbers, not
// about the arithmetic that produces them — that is pinned in
// xanax-model.test.js. Asserting against the model means a deliberate change to
// it (as on 2026-08-14) cannot leave a stale literal here saying 50.
const xanaxModel = await import('./xanax-model.js');

function mkResult(members, over = {}) {
  return {
    warId: 90001, enemyFactionId: 555, enemyFactionName: 'Testers',
    members, ...over,
  };
}

test('ingestWar freezes per-member xanax accountability from war.xanaxStats', () => {
  const factionId = '999000001';
  const war = {
    warEndedAt: 1783000000000, warStart: 1782900000, realWarId: 90001,
    enemyFactionId: 555,
    xanaxStats: { taken: { '111': 6, '222': 0 } },
  };
  const result = mkResult([
    { playerId: '111', name: 'Winter', level: 50, attackCount: 8, totalAttacks: 10 },
    { playerId: '222', name: 'Clean', level: 40, attackCount: 40, totalAttacks: 45 },
  ]);
  const key = ingestWar(factionId, war, result);
  assert.ok(key, 'ingest returns a warKey');
  const stored = getWar(factionId, key);

  const winter = stored.members.find(m => m.playerId === '111');
  assert.strictEqual(winter.xanaxTaken, 6);
  assert.strictEqual(winter.xanaxDeficit, xanaxModel.deficit(6, 10));
  assert.ok(winter.xanaxDeficit > 0, 'a 6-vial 10-attack member is short');
  assert.strictEqual(winter.xanaxFlagged, true);

  const clean = stored.members.find(m => m.playerId === '222');
  assert.strictEqual(clean.xanaxTaken, 0);
  assert.strictEqual(clean.xanaxDeficit, 0);
  assert.strictEqual(clean.xanaxFlagged, false);
});

test('ingestWar with no xanaxStats (e.g. backfill) stores zeroed xanax fields', () => {
  const factionId = '999000002';
  const war = { warEndedAt: 1783000000000, realWarId: 90002, enemyFactionId: 556 };
  const result = mkResult(
    [{ playerId: '111', name: 'Winter', level: 50, attackCount: 30, totalAttacks: 33 }],
    { warId: 90002, enemyFactionId: 556 },
  );
  const key = ingestWar(factionId, war, result);
  const m = getWar(factionId, key).members[0];
  assert.strictEqual(m.xanaxTaken, 0);
  assert.strictEqual(m.xanaxDeficit, 0);
  assert.strictEqual(m.xanaxFlagged, false);
});

test('ingestWar retains war-level xanax for no-show takers absent from the member list', () => {
  const factionId = '999000004';
  const war = {
    warEndedAt: 1783000000000, realWarId: 90005, enemyFactionId: 559,
    xanaxStats: { taken: { '111': 8, '333': 5 }, names: { '111': 'Winter', '333': 'NoShow' }, lastPolledAt: 1783000 },
  };
  // member list has only 111; 333 took 5 xanax but made 0 attacks → no member row
  const result = mkResult(
    [{ playerId: '111', name: 'Winter', level: 50, attackCount: 8, totalAttacks: 10 }],
    { warId: 90005, enemyFactionId: 559 });
  const key = ingestWar(factionId, war, result);
  const stored = getWar(factionId, key);
  assert.strictEqual(stored.xanaxStats.taken['333'], 5, 'no-show taker retained at war level');
  assert.strictEqual(stored.xanaxStats.taken['111'], 8);
});

test('re-ingest without fresh xanax preserves previously stored/backfilled xanax', () => {
  const factionId = '999000007';
  const withX = { warEndedAt: 1783000000000, realWarId: 90007, enemyFactionId: 561, xanaxStats: { taken: { '111': 6 }, names: { '111': 'Winter' } } };
  const result = mkResult([{ playerId: '111', name: 'Winter', level: 50, attackCount: 8, totalAttacks: 10 }], { warId: 90007, enemyFactionId: 561 });
  const key = ingestWar(factionId, withX, result);
  assert.strictEqual(getWar(factionId, key).members[0].xanaxTaken, 6);

  // _sweepWarHistory-style fresh recompute: same war, but `war` has NO xanaxStats
  ingestWar(factionId, { warEndedAt: 1783000000000, realWarId: 90007, enemyFactionId: 561 }, result);
  const m = getWar(factionId, key).members[0];
  assert.strictEqual(m.xanaxTaken, 6, 'per-member xanax preserved across re-ingest');
  assert.strictEqual(m.xanaxDeficit, xanaxModel.deficit(6, 10),
    'the deficit is recomputed from the preserved xanax, not zeroed');
  assert.strictEqual(getWar(factionId, key).xanaxStats.taken['111'], 6, 'war-level map preserved');
});

test('backfillXanaxForWar patches an already-stored war with re-fetched xanax', () => {
  const factionId = '999000006';
  // historical war ingested with no xanax tracking
  const key = ingestWar(factionId,
    { warEndedAt: 1783000000000, realWarId: 90006, enemyFactionId: 560 },
    mkResult([
      { playerId: '111', name: 'Winter', level: 50, attackCount: 8, totalAttacks: 10 },
      { playerId: '222', name: 'Clean', level: 40, attackCount: 40, totalAttacks: 45 },
    ], { warId: 90006, enemyFactionId: 560 }));
  assert.strictEqual(getWar(factionId, key).members.find(m => m.playerId === '111').xanaxTaken, 0);

  const r = backfillXanaxForWar(factionId, key,
    { '111': 6, '333': 3 }, { '111': 'Winter', '333': 'NoShow' },
    { lastPolledAt: 1783000, from: 1782900, to: 1783100 });
  assert.strictEqual(r.patched, 2);

  const stored = getWar(factionId, key);
  const winter = stored.members.find(m => m.playerId === '111');
  assert.strictEqual(winter.xanaxTaken, 6);
  assert.strictEqual(winter.xanaxDeficit, xanaxModel.deficit(6, 10),
    'backfill recomputes the deficit from the re-fetched xanax');
  assert.strictEqual(winter.xanaxFlagged, true);
  assert.strictEqual(stored.members.find(m => m.playerId === '222').xanaxTaken, 0);
  assert.strictEqual(stored.xanaxStats.taken['333'], 3);   // no-show retained at war level
  assert.strictEqual(backfillXanaxForWar(factionId, 'nope', {}, {}, {}), null);
});

test('aggregateByMember rolls up xanaxTaken and counts flagged wars', () => {
  const factionId = '999000003';
  // War A: took 6, only 10 attacks -> flagged
  ingestWar(factionId,
    { warEndedAt: 1783000000000, realWarId: 90003, enemyFactionId: 557, xanaxStats: { taken: { '111': 6 } } },
    mkResult([{ playerId: '111', name: 'Winter', level: 50, attackCount: 8, totalAttacks: 10 }], { warId: 90003, enemyFactionId: 557 }));
  // War B: took 4, 60 attacks -> NOT flagged (deficit 0)
  ingestWar(factionId,
    { warEndedAt: 1783100000000, realWarId: 90004, enemyFactionId: 558, xanaxStats: { taken: { '111': 4 } } },
    mkResult([{ playerId: '111', name: 'Winter', level: 50, attackCount: 55, totalAttacks: 60 }], { warId: 90004, enemyFactionId: 558 }));

  const agg = aggregateByMember(factionId).find(m => m.playerId === '111');
  assert.strictEqual(agg.wars, 2);
  assert.strictEqual(agg.xanaxTaken, 10);        // 6 + 4
  assert.strictEqual(agg.xanaxWarsFlagged, 1);   // only war A
});
