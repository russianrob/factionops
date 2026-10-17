// The build split (DEF/STR/DEX/SPD %) on the scout report.
//
// FFScouter premium returns a target's stat distribution. Two things decide
// whether it should reach the report: whether FFScouter has one at all (it
// had 6 of 85 on a live roster), and whether the target is big enough for the
// answer to change what you do. The age matters as much as the numbers —
// measured ages ran 23 to 346 days, and a year-old split gets acted on just
// as readily as a fresh one.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const SRC = readFileSync('/opt/warboard/server/routes.js', 'utf8');

function grab(sig) {
  const i = SRC.indexOf(sig);
  assert.ok(i > 0, 'not found: ' + sig);
  let d = 0;
  for (let k = SRC.indexOf('{', i); k < SRC.length; k++) {
    if (SRC[k] === '{') d++;
    else if (SRC[k] === '}') { d--; if (!d) return SRC.slice(i, k + 1); }
  }
  throw new Error('unbalanced: ' + sig);
}
function grabConst(name) {
  const m = new RegExp('^\\s*const ' + name + ' = .*?;\\s*$', 'm').exec(SRC);
  assert.ok(m, 'const not found: ' + name);
  return m[0].trim();
}

const buildSplitFor = new Function(`
  ${grabConst('BUILD_MIN_STATS')}
  ${grab('function buildSplitFor(')}
  return buildSplitFor;`)();

// A real record, as measured from the live API for BalaGun (261765).
const REAL = {
  total: 5802439064,
  source: 'ffs',
  build: { pct: { defense: 37, strength: 29 },
           human: 'DEF (37%) STR (29%)',
           at: 1768867200 },
};

test('a 2b+ target with a split gets it, with an age', () => {
  const r = buildSplitFor(REAL);
  assert.ok(r, 'no split returned');
  assert.deepEqual(r.pct, { defense: 37, strength: 29 });
  assert.equal(r.human, 'DEF (37%) STR (29%)');
  assert.equal(r.updatedAt, 1768867200);
  assert.ok(r.ageDays > 200, 'January 2026 data should read as hundreds of days old, got ' + r.ageDays);
});

test('BELOW the threshold it is withheld even when present', () => {
  // FFScouter almost never has a split for a small account, but when it does
  // the answer does not change how you fight them.
  const small = { ...REAL, total: 1.99e9 };
  assert.equal(buildSplitFor(small), null);
});

test('exactly at the threshold it shows', () => {
  assert.ok(buildSplitFor({ ...REAL, total: 2e9 }));
});

test('no split means nothing is invented', () => {
  assert.equal(buildSplitFor({ total: 9e9, source: 'ffs', build: null }), null);
  assert.equal(buildSplitFor({ total: 9e9, source: 'ffs' }), null);
  assert.equal(buildSplitFor(null), null);
  assert.equal(buildSplitFor(undefined), null);
});

test('a split with no percentages is not a split', () => {
  assert.equal(buildSplitFor({ total: 9e9, build: { pct: null, at: 1 } }), null);
});

test('a missing timestamp yields a null age, not a fake one', () => {
  // Better to show no age than to imply the data is from 1970.
  const r = buildSplitFor({ ...REAL, build: { ...REAL.build, at: 0 } });
  assert.ok(r);
  assert.equal(r.ageDays, null);
  assert.equal(r.updatedAt, 0);
});

test('a non-numeric total is not treated as above the threshold', () => {
  assert.equal(buildSplitFor({ ...REAL, total: null }), null);
  assert.equal(buildSplitFor({ ...REAL, total: 'lots' }), null);
});

test('the ingest keeps the split and drops an empty one', () => {
  // Mirrors the mapping at the FFScouter fetch: distribution -> estimates[pid].build
  const map = (e) => {
    const dist = e.distribution;
    const pct = dist && dist.stats_percentage;
    return (pct && Object.keys(pct).length)
      ? { pct, human: dist.distribution_human || null, at: Number(dist.last_updated) || 0 }
      : null;
  };
  assert.equal(map({ distribution: null }), null);                      // the 79 without
  assert.equal(map({ distribution: { stats_percentage: {} } }), null);  // present but empty
  assert.deepEqual(
    map({ distribution: { stats_percentage: { dexterity: 54, defense: 37 },
                          distribution_human: 'DEX (54%) DEF (37%)', last_updated: 1768867200 } }),
    { pct: { dexterity: 54, defense: 37 }, human: 'DEX (54%) DEF (37%)', at: 1768867200 });
});
