import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lowSuccessCrimes, LOW_SUCCESS_THRESHOLD, ocCrimeUrl } from './oc-ready-notifier.js';

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

// ── slot weight ────────────────────────────────────────────────────────
//
// Torn renders a WEIGHT under each slot: that position's share of the
// crime's outcome, summing to 100% across the crime. It is NOT in the API
// — slots carry only position, position_info, item_requirement, user and
// checkpoint_pass_rate — but the server already fetches the same table
// from tornprobability.com via getRoleWeights(), matching Torn's rendering
// exactly (Dish It Out: assassin 37.3, muscle 25.2, saboteur1 14.6,
// saboteur2 8.9, engineer 13.9).
//
// Why it belongs in the alert: 63% on an 8.9% slot is noise; 63% on a
// 37.3% slot decides the crime.

const WEIGHTS = {
  dishitout: { assassin: 37.3380808914086, muscle: 25.243817634035594,
               saboteur1: 14.639223669899579, saboteur2: 8.911747057590532,
               engineer: 13.867130747065687 },
};
const wslot = (label, pct, id) => ({
  position: label.replace(/\s*#\d+$/, ''),
  position_info: { label },
  checkpoint_pass_rate: pct,
  user: { id },
});

test('attaches the slot weight when the table has it', () => {
  const out = lowSuccessCrimes(
    [{ id: 9, name: 'Dish It Out', slots: [wslot('Saboteur #1', 63, 1)] }],
    { weights: WEIGHTS },
  );
  assert.equal(Math.round(out[0].weak[0].weight * 10) / 10, 14.6);
});

test('numbered positions get their OWN weight, not a shared one', () => {
  // Saboteur #1 is 14.6% and Saboteur #2 is 8.9% on the same crime.
  // Keying on the bare role name would give both the same number and
  // quietly misreport which slot actually matters.
  const out = lowSuccessCrimes(
    [{ id: 9, name: 'Dish It Out', slots: [wslot('Saboteur #1', 60, 1), wslot('Saboteur #2', 61, 2)] }],
    { weights: WEIGHTS },
  );
  const byId = Object.fromEntries(out[0].weak.map(w => [w.userId, Math.round(w.weight * 10) / 10]));
  assert.equal(byId['1'], 14.6);
  assert.equal(byId['2'], 8.9);
});

test('the heaviest slot is listed first, not the lowest percentage', () => {
  // 63% carrying 37.3% of the crime outranks 60% carrying 8.9%.
  const out = lowSuccessCrimes(
    [{ id: 9, name: 'Dish It Out', slots: [wslot('Saboteur #2', 60, 1), wslot('Assassin', 63, 2)] }],
    { weights: WEIGHTS },
  );
  assert.deepEqual(out[0].weak.map(w => w.userId), ['2', '1']);
});

test('an unknown crime still reports, just without weights', () => {
  const out = lowSuccessCrimes(
    [{ id: 9, name: 'Some New Heist', slots: [wslot('Muscle', 60, 1)] }],
    { weights: WEIGHTS },
  );
  assert.equal(out.length, 1);
  assert.equal(out[0].weak[0].weight, null);
});

test('with no weight table at all, it falls back to weakest-first', () => {
  const out = lowSuccessCrimes(
    [{ id: 9, name: 'Dish It Out', slots: [wslot('Assassin', 63, 2), wslot('Saboteur #2', 60, 1)] }],
  );
  assert.deepEqual(out[0].weak.map(w => w.userId), ['1', '2']);
  assert.equal(out[0].weak[0].weight, null);
});

// ── tap-through ────────────────────────────────────────────────────────
//
// Two "Market Forces" alerts arrived at once, identical but for the
// member. Both linked to the crimes LIST, so neither told you which of
// the two to open. Torn's router expands a specific card from the hash,
// which oc-spawn-assistance has used since v3.1.36.

test('the link opens the exact crime, not the list', () => {
  const u = ocCrimeUrl('2205045');
  assert.match(u, /crimeId=2205045/);
  assert.match(u, /tab=crimes/);
  assert.ok(u.startsWith('https://www.torn.com/factions.php'), u);
});

test('two crimes give two different links', () => {
  assert.notEqual(ocCrimeUrl('2222624'), ocCrimeUrl('2222622'));
});

test('the crime id goes in the HASH, where Torn router reads it', () => {
  // ?crimeId= on the query string is ignored — the SPA never sees it.
  const u = ocCrimeUrl('2205045');
  assert.ok(u.indexOf('crimeId') > u.indexOf('#'), 'crimeId must be after the #: ' + u);
});

test('a missing id falls back to the list rather than a broken link', () => {
  const u = ocCrimeUrl(null);
  assert.match(u, /tab=crimes/);
  assert.ok(!/crimeId/.test(u), u);
});
