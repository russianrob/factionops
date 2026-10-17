import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as ocSpawn from './oc-spawn.js';

// The join-level rule, pinned. Three copies of this loop (two routes.js
// handlers, one in the userscript) walked DOWN from a member's highest
// level looking for the first level whose average cleared Min CPR — and
// when nothing cleared it, left the member at the highest level they had
// ever touched. Raising Min CPR therefore RAISED some members' join level.
const computeJoinable = (...a) => ocSpawn.computeJoinable(...a);

// Bond003 [4352390], 2026-10-17: seven level-3 completions averaging 61.7%,
// one level-4 at 57%, overall 61.1%. These rates reproduce those averages.
const BOND = {
  entries: [
    ...[60, 60, 60, 60, 65, 65, 62].map(rate => ({ diff: 3, rate })),
    { diff: 4, rate: 57 },
  ],
  highestLevel: 4,
  cpr: 61.1,
};

// [name, entries, highestLevel, cpr, mincpr, boost, expected]
const CASES = [
  ['Bond003 at Min CPR 60 is joinable at level 3 (level-4 attempt rejected)',
    BOND.entries, BOND.highestLevel, BOND.cpr, 60, 15, { effectiveTop: 3, joinable: 3 }],
  ['Bond003 at Min CPR 65 drops to level 2 — never up to 4',
    BOND.entries, BOND.highestLevel, BOND.cpr, 65, 15, { effectiveTop: 2, joinable: 2 }],
  ['nothing clears the bar and the lowest level with data is 1: floors at 1',
    [{ diff: 1, rate: 30 }, { diff: 2, rate: 35 }], 2, 32.5, 65, 15, { effectiveTop: 1, joinable: 1 }],
  ['a stable level below an unstable top is the join level',
    [{ diff: 4, rate: 50 }, { diff: 3, rate: 70 }, { diff: 3, rate: 72 }], 4, 64, 65, 15, { effectiveTop: 3, joinable: 3 }],
  // buildCprCache emits { entries: [], highestLevel: diff, cpr: 0 } for a
  // member sitting on a crime with no history. Their placement is the
  // evidence; there is no data to drop them below it.
  ['placement-only member (no completions) keeps the placement level',
    [], 4, 0, 65, 15, { effectiveTop: 4, joinable: 4 }],
  ['overall CPR at or above Min CPR + boost projects one level up',
    [{ diff: 5, rate: 85 }, { diff: 5, rate: 85 }, { diff: 5, rate: 85 }], 5, 85, 60, 15, { effectiveTop: 5, joinable: 6 }],
  ['the boost never projects past level 10',
    [{ diff: 10, rate: 90 }], 10, 90, 60, 15, { effectiveTop: 10, joinable: 10 }],
];

for (const [name, entries, top, cpr, mincpr, boost, expected] of CASES) {
  test(name, () => {
    assert.deepEqual(computeJoinable(entries, top, cpr, mincpr, boost), expected);
  });
}

// The userscript cannot @require, so it carries its own copy of the rule.
// Pull that copy out of the served source and hold it to the same table,
// so the server and the client cannot disagree about a member's join level.
function clientComputeJoinable() {
  const src = readFileSync(new URL('./public/scripts/oc-spawn-assistance.user.js', import.meta.url), 'utf8');
  const start = src.indexOf('function computeJoinable(');
  assert.notEqual(start, -1, 'the userscript carries computeJoinable');
  let i = src.indexOf('{', start), depth = 0;
  for (; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}' && --depth === 0) break;
  }
  return new Function(`${src.slice(start, i + 1)}; return computeJoinable;`)();
}

test('the userscript copy of the rule agrees with the server on every case', () => {
  const client = clientComputeJoinable();
  for (const [name, entries, top, cpr, mincpr, boost, expected] of CASES) {
    assert.deepEqual(client(entries, top, cpr, mincpr, boost), expected, name);
  }
});
