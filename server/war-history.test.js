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
const { ingestWar, getWar, aggregateByMember } = await import('./war-history.js');

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
  assert.strictEqual(winter.xanaxDeficit, 50); // 6*10 - 10
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

test('aggregateByMember rolls up xanaxTaken and counts flagged wars', () => {
  const factionId = '999000003';
  // War A: took 6, only 10 attacks -> flagged (deficit 50)
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
