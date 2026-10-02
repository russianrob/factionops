// The travel chip's click-to-show-country, which did nothing on the
// ranked-war roster. Runs the SHIPPED functions.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const SRC = readFileSync('/opt/warboard/server/public/scripts/ffs-banner-estimates.user.js', 'utf8');
function fn(name) {
  const i = SRC.indexOf('function ' + name + '(');
  assert.ok(i >= 0, 'not found: ' + name);
  let d = 0;
  for (let j = SRC.indexOf('{', i); j < SRC.length; j++) {
    if (SRC[j] === '{') d++;
    else if (SRC[j] === '}' && --d === 0) return SRC.slice(i, j + 1);
  }
  throw new Error('unbalanced: ' + name);
}

const parse = new Function(fn('ffs_parseFlightDestination') + '; return ffs_parseFlightDestination;')();

test('FFScouter\'s own outbound wording', () => {
  assert.deepEqual(parse({ status_description: 'Traveling from Torn to Mexico' }),
    { country: 'Mexico', returning: false });
});

test('FFScouter\'s own inbound wording gives the country they are LEAVING', () => {
  // "to Torn" is not a destination worth showing; where they are coming from is.
  assert.deepEqual(parse({ status_description: 'Traveling from UAE to Torn' }),
    { country: 'UAE', returning: true });
});

test('Torn\'s own inbound wording parses — wb81\'s regex could not read it', () => {
  // "Returning to Torn from Mexico": the old /from (.+?) to (.+?)$/ needs a
  // " to " AFTER the "from", and here the "to" comes first, so it matched
  // nothing at all.
  assert.deepEqual(parse({ status_description: 'Returning to Torn from Mexico' }),
    { country: 'Mexico', returning: true });
});

test('a bare "Traveling to X" parses', () => {
  assert.deepEqual(parse({ status_description: 'Traveling to South Africa' }),
    { country: 'South Africa', returning: false });
  assert.deepEqual(parse({ status_description: 'Travelling to Japan' }),
    { country: 'Japan', returning: false });
});

test('"In X" parses, for a member already abroad', () => {
  assert.deepEqual(parse({ status_description: 'In Switzerland' }),
    { country: 'Switzerland', returning: false });
});

test('structured fields work if FFScouter drops the prose', () => {
  assert.deepEqual(parse({ destination: 'Canada' }), { country: 'Canada', returning: false });
  assert.deepEqual(parse({ to: 'Torn', from: 'Hawaii' }), { country: 'Hawaii', returning: true });
});

test('nothing usable returns null, never an empty country', () => {
  // "" is the caller's signal that the destination is still unknown, so the
  // parser must not manufacture one.
  for (const f of [null, {}, { status_description: '' }, { status_description: 'Traveling' },
                   { status_description: 'Okay' }, { destination: '' }]) {
    assert.equal(parse(f), null, JSON.stringify(f) + ' should not resolve');
  }
});

test('a destination of just "Torn" is not a country', () => {
  assert.equal(parse({ status_description: 'Traveling to Torn' }), null);
  assert.equal(parse({ destination: 'Torn' }), null);
});

// --- the rate-limit guard -------------------------------------------------

function guardApi({ countdowns = {}, abbr = {}, inflight = [], failures = [], noCountry = [] } = {}) {
  const src = fn('ffs_flightFetchNeeded');
  return new Function('_ffsMemberCountdowns', '_ffsMemberAbbr', '_ffsFlightFetchInflight',
    '_ffsFlightFetchFailures', '_ffsFlightNoCountryAt', 'FFS_NO_COUNTRY_RETRY_MS',
    src + '; return ffs_flightFetchNeeded;')(
    countdowns, abbr, new Set(inflight), new Map(failures), new Map(noCountry), 10 * 60000);
}

const NOW = 1_700_000_000_000;

test('a member with neither time nor country is fetched', () => {
  assert.equal(guardApi()('5', NOW), true);
});

test('a member with the TIME but no country is STILL fetched', () => {
  // This is the bug: the old guard was `if (countdowns[uid]) return`, so the
  // moment Torn's members endpoint supplied the landing time, the destination
  // was never asked for and the toggle had nothing to show.
  assert.equal(guardApi({ countdowns: { 5: 1700000123 } })('5', NOW), true);
});

test('a member with both is left alone', () => {
  assert.equal(guardApi({ countdowns: { 5: 1700000123 }, abbr: { 5: 'Mexico' } })('5', NOW), false);
});

test('an empty-string country counts as unknown', () => {
  assert.equal(guardApi({ countdowns: { 5: 1 }, abbr: { 5: '' } })('5', NOW), true);
});

test('an in-flight request is not duplicated', () => {
  assert.equal(guardApi({ inflight: ['5'] })('5', NOW), false);
});

test('a recent failure backs off for a minute', () => {
  assert.equal(guardApi({ failures: [['5', NOW - 30_000]] })('5', NOW), false);
  assert.equal(guardApi({ failures: [['5', NOW - 61_000]] })('5', NOW), true);
});

test('a clean response with no country is not re-asked on the next tick', () => {
  // The hot callers run on 1s and 1.5s timers, and a response that simply
  // carries no destination is a SUCCESS -- it records no failure and trips no
  // backoff. Without its own cooldown, "retry until the country is known" is
  // ~40 requests a minute per travelling member, forever, on a shared key.
  const g = guardApi({ countdowns: { 5: 1 }, noCountry: [['5', NOW - 1_000]] });
  assert.equal(g('5', NOW), false);
  for (let ms = 0; ms < 9 * 60_000; ms += 1_500) {
    assert.equal(g('5', NOW + ms), false, 'refetched ' + ms + 'ms into the cooldown');
  }
});

test('the no-country cooldown does expire', () => {
  assert.equal(guardApi({ countdowns: { 5: 1 }, noCountry: [['5', NOW - 11 * 60_000]] })('5', NOW), true);
});

test('the no-country cooldown does NOT block a member missing the time too', () => {
  // No landing time means the countdown itself is broken; that is worth
  // retrying at the normal cadence regardless of the destination.
  assert.equal(guardApi({ noCountry: [['5', NOW - 1_000]] })('5', NOW), true);
});

// --- the 30s poll must not wipe a country the flight fetch resolved -------

function recordApi(state = {}) {
  const s = {
    countdowns: {}, abbr: {}, returning: {}, hospUntil: {}, hospState: {},
    released: {}, noCountry: new Map(), failures: new Map(), fetched: [],
    ...state
  };
  const api = new Function(
    '_ffsMemberCountdowns', '_ffsMemberAbbr', '_ffsMemberReturning',
    '_ffsMemberHospitalUntil', '_ffsMemberHospitalState', '_ffsJustReleasedAt',
    '_ffsFlightNoCountryAt', '_ffsFlightFetchFailures', 'ffs_fetchFlightForMember',
    fn('ffs_recordMemberTravel') + '; return ffs_recordMemberTravel;')(
    s.countdowns, s.abbr, s.returning, s.hospUntil, s.hospState, s.released,
    s.noCountry, s.failures, (uid) => s.fetched.push(uid));
  return { api, s };
}

const FLYING_NO_DEST = {
  id: 7, status: { state: 'Traveling', description: 'Traveling', until: 1700000123 }
};

test('a bare "Traveling" does not erase a country already resolved', () => {
  // THE regression trap. The 30s members poll ran
  // `_ffsMemberAbbr[id] = loc.trim()` unconditionally, and on this page
  // loc is "" -- so every poll wiped the destination the flight fetch had
  // just resolved, and the toggle could never settle on a country.
  const { api, s } = recordApi({ abbr: { 7: 'Mexico' }, returning: { 7: false } });
  api(FLYING_NO_DEST);
  assert.equal(s.abbr[7], 'Mexico', 'the poll wiped the known destination');
});

test('a description that DOES name a country still wins', () => {
  const { api, s } = recordApi({ abbr: { 7: 'Mexico' } });
  api({ id: 7, status: { state: 'Traveling', description: 'Traveling to Japan', until: 1 } });
  assert.equal(s.abbr[7], 'Japan');
  assert.equal(s.returning[7], false);
});

test('returning is read from the description', () => {
  const { api, s } = recordApi();
  api({ id: 7, status: { state: 'Traveling', description: 'Returning to Torn from UAE', until: 1 } });
  assert.equal(s.abbr[7], 'UAE');
  assert.equal(s.returning[7], true);
});

test('a known landing time still triggers the destination lookup', () => {
  // The whole bug: until now, a present status.until meant the fetch that
  // carries the country was never kicked.
  const { api, s } = recordApi();
  api(FLYING_NO_DEST);
  assert.equal(s.countdowns[7], 1700000123, 'the time should still be recorded');
  assert.deepEqual(s.fetched, ['7'], 'the destination was never requested');
});

test('no lookup is kicked when the country is already known', () => {
  const { api, s } = recordApi({ abbr: { 7: 'Mexico' } });
  api(FLYING_NO_DEST);
  assert.deepEqual(s.fetched, [], 'asked for a destination it already had');
});

test('a member with no landing time is still fetched, as before', () => {
  const { api, s } = recordApi();
  api({ id: 7, status: { state: 'Traveling', description: 'Traveling', until: null } });
  assert.deepEqual(s.fetched, ['7']);
});

test('landing clears the caches so the next flight resolves fresh', () => {
  const { api, s } = recordApi({
    countdowns: { 7: 1 }, abbr: { 7: 'Mexico' }, returning: { 7: true },
    noCountry: new Map([['7', 123]]), failures: new Map([['7', 456]])
  });
  api({ id: 7, status: { state: 'Okay', description: 'Okay' } });
  assert.equal(s.countdowns[7], undefined);
  assert.equal(s.abbr[7], undefined);
  assert.equal(s.noCountry.has('7'), false, 'a new flight would inherit the cooldown');
  assert.equal(s.failures.has('7'), false, 'a new flight would inherit the backoff');
});
