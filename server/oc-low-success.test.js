import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lowSuccessCrimes, LOW_SUCCESS_THRESHOLD } from './oc-ready-notifier.js';

const slot = (pct, opts = {}) => ({
  position: opts.position || 'Muscle',
  checkpoint_pass_rate: pct,
  user: opts.empty ? null : { id: opts.id || 999, name: opts.name || 'Someone' },
});
const crime = (id, slots, name = 'Cash Me if You Can') => ({ id, name, status: 'Planning', slots });

test('flags a crime carrying a slot under the threshold', () => {
  const out = lowSuccessCrimes([crime(1, [slot(63, { name: 'Machiacelli' })])]);
  assert.equal(out.length, 1);
  assert.equal(out[0].crimeId, '1');
  assert.equal(out[0].weak[0].name, 'Machiacelli');
  assert.equal(out[0].weak[0].pct, 63);
});

test('an EMPTY slot is never weak, whatever its pass rate says', () => {
  // Torn reports checkpoint_pass_rate: 0 for unfilled slots. Read naively
  // that is "0% success" and every recruiting crime alerts forever. This
  // is the single most important case in the file.
  const out = lowSuccessCrimes([crime(1, [slot(0, { empty: true }), slot(80)])]);
  assert.deepEqual(out, []);
});

test('a crime that is ONLY empty slots is silent', () => {
  const out = lowSuccessCrimes([crime(1, [slot(0, { empty: true }), slot(0, { empty: true })])]);
  assert.deepEqual(out, []);
});

test('every weak member on a crime is listed, since it only fires once', () => {
  const out = lowSuccessCrimes([crime(1, [
    slot(61, { name: 'A', id: 1 }), slot(88, { name: 'B', id: 2 }), slot(64, { name: 'C', id: 3 }),
  ])]);
  assert.equal(out.length, 1);
  assert.deepEqual(out[0].weak.map(w => w.name), ['A', 'C']);
});

test('exactly at the threshold is not weak', () => {
  assert.deepEqual(lowSuccessCrimes([crime(1, [slot(LOW_SUCCESS_THRESHOLD)])]), []);
  assert.equal(lowSuccessCrimes([crime(1, [slot(LOW_SUCCESS_THRESHOLD - 1)])]).length, 1);
});

test('a crime already seen is skipped', () => {
  const crimes = [crime(1, [slot(50)]), crime(2, [slot(50)])];
  const out = lowSuccessCrimes(crimes, { seen: new Set(['1']) });
  assert.deepEqual(out.map(c => c.crimeId), ['2']);
});

test('the threshold is adjustable', () => {
  assert.deepEqual(lowSuccessCrimes([crime(1, [slot(70)])], { threshold: 65 }), []);
  assert.equal(lowSuccessCrimes([crime(1, [slot(70)])], { threshold: 75 }).length, 1);
});

test('a missing or non-numeric pass rate is not treated as zero', () => {
  // Absent data is unknown, not catastrophic. Alerting on it would cry
  // wolf every time Torn omits a field.
  const bad = [
    crime(1, [{ position: 'Muscle', user: { id: 5, name: 'X' } }]),
    crime(2, [{ position: 'Muscle', user: { id: 5, name: 'X' }, checkpoint_pass_rate: null }]),
    crime(3, [{ position: 'Muscle', user: { id: 5, name: 'X' }, checkpoint_pass_rate: 'n/a' }]),
  ];
  assert.deepEqual(lowSuccessCrimes(bad), []);
});

test('reads the older user_id shape as well as user.id', () => {
  const out = lowSuccessCrimes([crime(1, [
    { position: 'Robber', checkpoint_pass_rate: 40, user_id: 4242 },
  ])]);
  assert.equal(out.length, 1);
  assert.equal(out[0].weak[0].userId, '4242');
});

test('position numbering is stripped so Muscle #2 reads as Muscle', () => {
  const out = lowSuccessCrimes([crime(1, [
    { position: 'Muscle #2', checkpoint_pass_rate: 40, user: { id: 7, name: 'Y' } },
  ])]);
  assert.equal(out[0].weak[0].position, 'Muscle');
});

test('rubbish input yields nothing rather than throwing', () => {
  assert.deepEqual(lowSuccessCrimes(null), []);
  assert.deepEqual(lowSuccessCrimes([]), []);
  assert.deepEqual(lowSuccessCrimes([{ id: 1 }]), []);
  assert.deepEqual(lowSuccessCrimes([null, undefined]), []);
});

// ── naming the member ──────────────────────────────────────────────────
//
// /v2/faction/crimes gives slot.user as an id and progression only — no
// name. Live run printed "Enforcer 61%", which tells an admin a slot is
// weak but not who to talk to. Names come from the members list instead.

test('resolves a member name from the supplied roster', () => {
  const out = lowSuccessCrimes(
    [crime(1, [{ position: 'Enforcer', checkpoint_pass_rate: 61, user: { id: 2407280 } }])],
    { names: { 2407280: 'Machiacelli' } },
  );
  assert.equal(out[0].weak[0].name, 'Machiacelli');
});

test('a name already on the slot is not overwritten by the roster', () => {
  const out = lowSuccessCrimes(
    [crime(1, [slot(61, { id: 7, name: 'FromSlot' })])],
    { names: { 7: 'FromRoster' } },
  );
  assert.equal(out[0].weak[0].name, 'FromSlot');
});

test('an unknown member still reports, named by position', () => {
  // Never drop a weak slot just because the roster lookup missed.
  const out = lowSuccessCrimes(
    [crime(1, [{ position: 'Enforcer', checkpoint_pass_rate: 61, user: { id: 999 } }])],
    { names: {} },
  );
  assert.equal(out.length, 1);
  assert.equal(out[0].weak[0].name, '');
  assert.equal(out[0].weak[0].position, 'Enforcer');
});
