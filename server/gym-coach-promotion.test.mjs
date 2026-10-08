// The Gym Coach lanes.
//
// History, because the direction has reversed once and these tests only make
// sense against the current intent: the beta was promoted into `gym-coach`,
// then the beta was UNRETIRED (people were still running it), and finally the
// regular lane was retired INTO the beta. So today `gym-coach.user.js` is a
// migration pointer — it serves the beta body so an installed Gym Coach
// updates once and thereafter tracks `gym-coach-beta` directly.
//
// Deleting the path instead would stand every install still: Tampermonkey can
// only replace what it can still fetch, and a 404 is not an update.
//
// The namespaces still matter. gc_v1 was the old stable's, gcb_v1 the beta's,
// and the body reads gcb_v1 — so migrateFromStableOnce, tested at the bottom,
// is what stops a promoted user finding an empty ledger and no API key.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const DIR = '/opt/warboard/server/public/scripts/';
const STABLE = readFileSync(DIR + 'gym-coach.user.js', 'utf8');
const BETA = readFileSync(DIR + 'gym-coach-beta.user.js', 'utf8');
const head = (s) => s.slice(0, s.indexOf('==/UserScript=='));
const tag = (s, k) => (new RegExp('// @' + k + '\\s+(.+)').exec(head(s)) || [])[1]?.trim();

// --- identity -------------------------------------------------------------

test('the gym-coach path serves the beta, so installs migrate in place', () => {
  // The retirement mechanism: whoever still has "Gym Coach" installed polls
  // this path, is handed the beta body, and becomes a Gym Coach Beta install.
  assert.equal(tag(STABLE, 'name'), 'Gym Coach Beta');
  assert.equal(tag(STABLE, 'namespace'), 'RussianRob');
  assert.equal(tag(STABLE, 'name'), tag(BETA, 'name'), 'the two paths must agree');
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
  // Must outrank BOTH shipped builds or the update is never offered: the old
  // stable 0.11.1 on this path, and the 0.10.0 retirement stub on the beta
  // path. Segment-wise numeric, so 0.12.0 > 0.10.0 despite the shorter digit.
  assert.ok(cmp(tag(STABLE, 'version'), '0.11.1') > 0,
    tag(STABLE, 'version') + ' is not newer than the shipped stable 0.11.1');
  assert.ok(cmp(tag(BETA, 'version'), '0.10.0') > 0,
    tag(BETA, 'version') + ' would leave stub users stranded on 0.10.0');
  assert.equal(tag(STABLE, 'version'), tag(BETA, 'version'),
    'both paths serve one build, so they must carry one version');
});

test('the in-file version matches the header', () => {
  assert.match(STABLE, new RegExp('GC_VERSION = "' + tag(STABLE, 'version') + '"'));
});

test('both paths hand the reader on to the beta channel', () => {
  // 0.9.91 shipped @updateURL pointing at its own 638KB body, so every
  // install downloaded the whole script on each check. The rollback keeps the
  // meta file, which is the one header change made on top of that body.
  // This is what makes the migration one hop rather than permanent: the body
  // served at the gym-coach path points its own updates at the beta, so after
  // one update the old path stops being consulted at all.
  for (const [label, src] of [['stable path', STABLE], ['beta path', BETA]]) {
    assert.equal(tag(src, 'downloadURL'),
      'https://tornwar.com/scripts/gym-coach-beta.user.js', label);
    // @updateURL must be the META file — pointing it at the body makes every
    // install poll 640KB on each check.
    assert.equal(tag(src, 'updateURL'),
      'https://tornwar.com/scripts/gym-coach-beta.meta.js', label);
  }
});

test('it keeps the grants and connects the beta body actually uses', () => {
  for (const g of ['GM_setClipboard', 'GM_xmlhttpRequest', 'GM_setValue', 'GM_getValue']) {
    assert.match(head(STABLE), new RegExp('@grant\\s+' + g), 'missing grant ' + g);
  }
  assert.match(head(STABLE), /@connect\s+weav3r\.dev/, 'the board fetch host was dropped');
});

test('the retirement stub is gone from the beta path', () => {
  // 0.10.0 served a do-nothing stub asking testers to uninstall. Unretiring
  // means the body is the real script again, not a politer stub.
  assert.ok(BETA.length > 100_000, 'the beta path is serving something far too small to be the script');
  assert.ok(!/please uninstall|retired/i.test(head(BETA)), 'stub wording survives in the header');
  assert.match(BETA, /var NS = "gcb_v1"/, 'the beta must still read its own storage');
});

// --- the migration, REMOVED 2026-10-08 ---------------------------------
//
// migrateFromStableOnce arrived in 0.11.0 to carry an API key and ledger from
// the old gc_v1 namespace into gcb_v1, and its tests lived here. The owner
// rolled the script back to the 0.9.91 body, which predates it, so the code
// is gone and tests asserting it would be asserting a fiction.
//
// What that costs, for whoever reads this next: the migration already ran for
// everyone who updated during 2026-10-08, and their data sits in gcb_v1
// permanently. Anyone still on the old 0.10.12 build arrives without it — an
// empty ledger and no API key, with their data intact but unread under gc_v1.
// Re-adding the block is a ~40 line additive change and touches nothing the
// rollback was about; git has it at 99a7e494.
