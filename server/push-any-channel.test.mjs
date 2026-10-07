// Who is in the audience for a war notification.
//
// Reported: "do notifications work too i didnt see any last war" — and
// then "but i enabled them in warboard settings". Both were true. The
// preferences were saved, the FCM/APNs token was registered, Apple was
// accepting sends, and the player still got none of the 18 bonus alerts.
//
// The audience filter was the cause. Every war sender narrowed its
// recipient list with `isSubscribed(id)`, which answers "does this player
// have a WEB PUSH subscription?" — so a player whose only transport is the
// warboard app was dropped from the list BEFORE sendToPlayer ran, and the
// FCM fan-out inside sendToPlayer (added for exactly this case) never got
// the chance to fire. Historically the player had a web-push subscription,
// which is why 221 bonus pushes landed and then abruptly zero did.
//
// The fix keeps `isSubscribed` web-only — four status routes use it to
// decide whether to show "Enable on this device", and an app-only player
// must still see that button — and adds a separate any-channel predicate
// for the fan-out filters.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const SRC = readFileSync('/opt/warboard/server/push-notifications.js', 'utf8');

// Lift a named function's source out of the module and run it against
// injected stores, so the test exercises the shipped text without
// importing the module (which reads the live data files at import).
function extract(name) {
  const i = SRC.indexOf(`export function ${name}(`);
  assert.ok(i >= 0, `${name} not found in push-notifications.js`);
  const start = SRC.indexOf('{', i);
  let d = 0;
  for (let j = start; j < SRC.length; j++) {
    if (SRC[j] === '{') d++;
    else if (SRC[j] === '}') {
      d--;
      if (d === 0) return SRC.slice(i, j + 1).replace(/^export\s+/, '');
    }
  }
  throw new Error(`unbalanced braces in ${name}`);
}

// Build a callable from the extracted source with its module-scope
// dependencies injected as parameters.
function build(name, { subscriptions = {}, fcmListForPlayer = () => [] } = {}) {
  const src = extract(name);
  // eslint-disable-next-line no-new-func
  const make = new Function(
    'subscriptions', 'fcmListForPlayer',
    `${src}\nreturn ${name};`,
  );
  return make(subscriptions, fcmListForPlayer);
}

const WEB_ONLY = { 1066552: [{ endpoint: 'https://example.test/a' }] };
const FCM_ONLY = (id) => (String(id) === '137558'
  ? [{ playerId: '137558', token: 't1', platform: 'ios' }]
  : []);

test('hasAnyPushChannel: a web-push subscriber is in the audience', () => {
  const f = build('hasAnyPushChannel', { subscriptions: WEB_ONLY });
  assert.equal(f('1066552'), true);
});

test('hasAnyPushChannel: an APP-ONLY player is in the audience', () => {
  // The regression. No web-push subscription, one registered device token.
  const f = build('hasAnyPushChannel', { fcmListForPlayer: FCM_ONLY });
  assert.equal(f('137558'), true);
});

test('hasAnyPushChannel: a player with neither transport is excluded', () => {
  const f = build('hasAnyPushChannel', { fcmListForPlayer: FCM_ONLY });
  assert.equal(f('999999'), false);
});

test('hasAnyPushChannel: a failing token store excludes rather than throws', () => {
  // fcm-subscriptions is lazy-imported with failure tolerance elsewhere;
  // a broken token store must not take down every notification send.
  const f = build('hasAnyPushChannel', {
    fcmListForPlayer: () => { throw new Error('store unavailable'); },
  });
  assert.equal(f('137558'), false);
});

test('isSubscribed stays WEB-ONLY so app-only players still see "Enable"', () => {
  // Broadening this would make /api/*/push/status report subscribed:true
  // for an app-only player, hiding the button that web-subscribes them.
  const f = build('isSubscribed', { fcmListForPlayer: FCM_ONLY });
  assert.equal(f('137558'), false);
});

test('no war sender narrows its audience with the web-only predicate', () => {
  // The bug class, not just the one instance: any sender that filters on
  // isSubscribed silently drops every app-only player.
  const offenders = SRC.split('\n')
    .map((line, i) => [i + 1, line])
    .filter(([, line]) => /filter\(.*isSubscribed\(/.test(line));
  assert.deepEqual(offenders, [], 'these senders still filter on web-push only');
});

test('the fan-out filters use the any-channel predicate', () => {
  const sites = SRC.match(/hasAnyPushChannel\(id\)/g) || [];
  assert.ok(sites.length >= 9, `expected >=9 filter sites, found ${sites.length}`);
});

// ── The bug class, guarded across the whole server ────────────────────────
//
// isSubscribed has a plural sibling, getSubscribedPlayerIds, which is the
// same web-only question asked of every player at once. Deriving a watch
// list or a send audience from it reintroduces exactly this bug one module
// over — which is how personal-monitor.js came to poll only web-push
// subscribers. Status routes may ask the web-only question; audiences may
// not.
test('no module builds a notification audience from the web-only roster', () => {
  const dir = '/opt/warboard/server';
  const offenders = readdirSync(dir)
    .filter((f) => f.endsWith('.js') && f !== 'push-notifications.js')
    .filter((f) => !f.includes('.test.'))
    .filter((f) => /getSubscribedPlayerIds/.test(readFileSync(join(dir, f), 'utf8')));
  assert.deepEqual(offenders, [],
    'these modules select players by web-push subscription alone');
});
