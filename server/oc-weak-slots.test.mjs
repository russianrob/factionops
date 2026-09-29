// Run the REAL ocWeakSlots() out of the shipped userscript against a DOM
// built to match Torn's actual markup. A syntax check passed on 3.2.76
// while every slot threw ReferenceError at runtime; this would not have.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseHTML } from 'linkedom';

const SRC = readFileSync('/opt/warboard/server/public/scripts/oc-spawn-assistance.user.js', 'utf8');
const i = SRC.indexOf('function ocWeakSlots()');
assert.ok(i > 0, 'ocWeakSlots not found in the shipped script');
let d = 0, end = -1;
for (let j = SRC.indexOf('{', i); j < SRC.length; j++) {
  if (SRC[j] === '{') d++;
  else if (SRC[j] === '}' && --d === 0) { end = j + 1; break; }
}
const FN_SRC = SRC.slice(i, end);
// The threshold is a module-level const beside the function; pull it from
// the same source rather than hardcoding 65 here, so the test tracks the
// script instead of asserting a number the script may have changed.
const THRESH = SRC.match(/const WEAK_PCT = (\d+);/);
assert.ok(THRESH, 'WEAK_PCT not found in the shipped script');
const PREAMBLE = `const WEAK_PCT = ${THRESH[1]};`;

// One crime card, shaped like Torn's: hashed class names, the name in an
// honour badge, WEIGHT in a tile below the header.
const slot = (role, pct, who, wt) => `
  <div class="wrapper___xXMjl notOpening___aaa">
    <button class="slotHeader___GUnnx">
      <span class="title___bbb">${role}</span>
      <div class="successChance___ccc">${pct}</div>
      <div class="badgeContainer___ddd"><div class="badge___eee">
        <div class="honorContainer___fff honor-text-wrap">
          <span class="honor-text">${who}</span></div></div></div>
      <a href="/profiles.php?XID=12345">${who}</a>
    </button>
    <div class="weightTile___ggg"><div>WEIGHT</div><div>${wt}%</div></div>
  </div>`;

function run(html, hash = '') {
  const { document, window } = parseHTML(`<html><body>${html}</body></html>`);
  const fn = new Function('document', 'location', 'console',
    `${PREAMBLE}\n${FN_SRC}; return ocWeakSlots();`);
  return fn(document, { hash }, { warn() {} });
}

test('finds the weak slots and skips the healthy ones', () => {
  const rows = run(slot('Saboteur #1', 63, 'Bingoboyo', 14.6) +
                   slot('Assassin', 71, 'Strong', 37.3));
  assert.equal(rows.length, 1);
  assert.equal(rows[0].pct, 63);
});

test('reports the PLAYER, not the role — the 3.2.76 regression', () => {
  const rows = run(slot('Saboteur #1', 63, 'Bingoboyo', 14.6));
  assert.equal(rows[0].name, 'Bingoboyo');
  assert.equal(rows[0].role, 'Saboteur #1');
});

test('carries the weight — the 3.2.76 crash', () => {
  const rows = run(slot('Saboteur #1', 63, 'Bingoboyo', 14.6));
  assert.equal(rows[0].weight, 14.6, 'weight must be read, not undefined');
});

test('an empty slot reporting 0 is not weak', () => {
  const rows = run(slot('Assassin', 0, '', 37.3));
  assert.deepEqual(rows, []);
});

test('heaviest first', () => {
  const rows = run(slot('Light', 61, 'A', 8.9) + slot('Heavy', 63, 'B', 37.3));
  assert.deepEqual(rows.map(r => r.name), ['B', 'A']);
});

test('picks up the crime id from the hash when the card carries no link', () => {
  const rows = run(slot('Saboteur #1', 63, 'Bingoboyo', 14.6), '#/tab=crimes&crimeId=2205045');
  assert.equal(rows[0].crimeId, '2205045');
});

test('one malformed slot costs one row, not the whole list', () => {
  const broken = '<button class="slotHeader___x"><div class="successChance___y">62</div></button>';
  const rows = run(broken + slot('Saboteur #1', 63, 'Bingoboyo', 14.6));
  assert.ok(rows.some(r => r.name === 'Bingoboyo'), 'the good slot must survive');
});
