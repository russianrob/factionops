// Promoting the beta to stable.
//
// The two builds kept separate GM namespaces on purpose — gc_v1 for the script
// people ran, gcb_v1 for the beta — so a bad beta could never corrupt the
// settings of the copy you relied on. Promoting the beta body under the stable
// identity turns that safety into data loss: the API key and the ledger sit in
// gc_v1, and the promoted code reads gcb_v1.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const DIR = '/opt/warboard/server/public/scripts/';
const STABLE = readFileSync(DIR + 'gym-coach.user.js', 'utf8');
const BETA = readFileSync(DIR + 'gym-coach-beta.user.js', 'utf8');
const head = (s) => s.slice(0, s.indexOf('==/UserScript=='));
const tag = (s, k) => (new RegExp('// @' + k + '\\s+(.+)').exec(head(s)) || [])[1]?.trim();

// --- identity -------------------------------------------------------------

test('it updates the existing install rather than registering a new script', () => {
  // Tampermonkey identity is (name, namespace). "Gym Coach Beta" would not
  // match what people already have.
  assert.equal(tag(STABLE, 'name'), 'Gym Coach');
  assert.equal(tag(STABLE, 'namespace'), 'RussianRob');
});

test('the version goes FORWARD from the build people are running', () => {
  // The trap: beta was 0.9.91 and stable 0.10.12. Segment-wise 9 < 10, so
  // copying the beta across verbatim would never be offered as an update —
  // the push would silently do nothing.
  const cmp = (a, b) => {
    const A = a.split('.').map(Number), B = b.split('.').map(Number);
    for (let i = 0; i < Math.max(A.length, B.length); i++) {
      if ((A[i] || 0) !== (B[i] || 0)) return (A[i] || 0) - (B[i] || 0);
    }
    return 0;
  };
  assert.ok(cmp(tag(STABLE, 'version'), '0.10.12') > 0,
    tag(STABLE, 'version') + ' is not newer than the shipped 0.10.12');
  assert.ok(cmp(tag(STABLE, 'version'), tag(BETA, 'version')) > 0,
    'must also outrank the beta it came from');
});

test('the in-file version matches the header', () => {
  assert.match(STABLE, new RegExp('GC_VERSION = "' + tag(STABLE, 'version') + '"'));
});

test('it points at the stable channel, and polls the meta file', () => {
  // Left on the beta URLs, every updated user would be pinned to the beta
  // channel for good. And the beta polled its own 638KB body on each check.
  assert.equal(tag(STABLE, 'downloadURL'), 'https://tornwar.com/scripts/gym-coach.user.js');
  assert.equal(tag(STABLE, 'updateURL'), 'https://tornwar.com/scripts/gym-coach.meta.js');
  assert.ok(!/gym-coach-beta/.test(head(STABLE)), 'a beta URL survived in the header');
});

test('it keeps the grants and connects the beta body actually uses', () => {
  for (const g of ['GM_setClipboard', 'GM_xmlhttpRequest', 'GM_setValue', 'GM_getValue']) {
    assert.match(head(STABLE), new RegExp('@grant\\s+' + g), 'missing grant ' + g);
  }
  assert.match(head(STABLE), /@connect\s+weav3r\.dev/, 'the board fetch host was dropped');
});

test('the description no longer calls itself a beta running alongside', () => {
  const d = tag(STABLE, 'description');
  assert.ok(!/beta lane/i.test(d), d);
  assert.ok(!/alongside/i.test(d), d);
});

// --- the migration --------------------------------------------------------

function rig({ stable = {}, beta = {} } = {}) {
  const i = STABLE.indexOf('var STABLE_MIGRATE_KEYS');
  const j = STABLE.indexOf('// Torn PDA hands stored values back as STRINGS', i);
  assert.ok(i > 0 && j > i, 'migration block not found');
  const logged = [];
  const api = new Function('storeGet', 'storeSet', 'stableGet', 'console',
    STABLE.slice(i, j) + '; return { migrateFromStableOnce, STABLE_MIGRATE_KEYS };')(
    (k, d) => (k in beta ? beta[k] : d),
    (k, v) => { beta[k] = v; },
    (k, d) => (k in stable ? stable[k] : d),
    { log: (m) => logged.push(m) });
  return { api, stable, beta, logged };
}

test('a user of the old build keeps their key and ledger', () => {
  const r = rig({ stable: { api_key: 'ABC123', log: ['a', 'b'], hist: { x: 1 }, mode: 'str' } });
  r.api.migrateFromStableOnce();
  assert.equal(r.beta.api_key, 'ABC123', 'they would have had to re-paste their key');
  assert.deepEqual(r.beta.log, ['a', 'b'], 'the ledger is device-only and unrecoverable');
  assert.deepEqual(r.beta.hist, { x: 1 });
  assert.equal(r.beta.mode, 'str');
});

test('a beta tester loses nothing — their newer data wins', () => {
  // Guarded per key, not once globally: somebody who ran both has data on
  // both sides, and the beta's is the newer.
  const r = rig({ stable: { api_key: 'OLD', log: ['old'] }, beta: { api_key: 'NEW', log: ['new'] } });
  r.api.migrateFromStableOnce();
  assert.equal(r.beta.api_key, 'NEW');
  assert.deepEqual(r.beta.log, ['new']);
});

test('it fills only the gaps, per key', () => {
  const r = rig({ stable: { api_key: 'OLD', mode: 'def' }, beta: { api_key: 'NEW' } });
  r.api.migrateFromStableOnce();
  assert.equal(r.beta.api_key, 'NEW', 'kept');
  assert.equal(r.beta.mode, 'def', 'filled');
});

test('it runs once, not on every page load', () => {
  const r = rig({ stable: { api_key: 'OLD' } });
  r.api.migrateFromStableOnce();
  r.beta.api_key = '';                       // user clears it deliberately
  r.api.migrateFromStableOnce();
  assert.equal(r.beta.api_key, '', 'a cleared key came back from the dead');
  assert.equal(r.beta.migratedFromStable, true);
});

test('empty strings do not count as data in either direction', () => {
  const r = rig({ stable: { api_key: '', mode: 'str' }, beta: { mode: '' } });
  r.api.migrateFromStableOnce();
  assert.ok(!r.beta.api_key, 'copied an empty key over');
  assert.equal(r.beta.mode, 'str', 'an empty value should not block the fill');
});

test('nothing to migrate is not an error', () => {
  const r = rig();
  assert.doesNotThrow(() => r.api.migrateFromStableOnce());
  assert.equal(r.logged.length, 0, 'announced a migration that did not happen');
});

test('it covers every key the old build persisted, except the dropped one', () => {
  const old = ['api_key', 'focus', 'focus2', 'hist', 'histRange', 'log', 'mode', 'user_tucked', 'warStack'];
  const r = rig();
  assert.deepEqual([...r.api.STABLE_MIGRATE_KEYS].sort(), [...old].sort());
  // adultNov has no counterpart in this build and is deliberately not carried.
  assert.ok(!r.api.STABLE_MIGRATE_KEYS.includes('adultNov'));
});

test('migration runs before the UI reads storage', () => {
  const m = STABLE.indexOf('migrateFromStableOnce();\n\n  startUi();');
  assert.ok(m > 0, 'not called immediately before startUi');
});
