// Calls that drop by themselves.
//
// Reported during a ranked war on 2026-10-25: members' calls "magically
// disappear", with nobody pressing Drop. Measured that day: about 5% of all
// calls were dropped with no fight by the caller and called again by the same
// member within two minutes, at the same rate on old and new builds.
//
// The member's own script was dropping them. It dropped my call whenever it
// saw my target go into hospital, whoever put them there, and target statuses
// flip: clients relay statuses through the server, they disagree, and the
// last report wins, so a target lying in hospital reads hospital -> okay ->
// hospital. Every flip back dropped the caller's call (four out of four seen
// live). The server stopped doing exactly this in May for the same complaint.
//
// The fight-end drop (5.6.6) had the same flaw in another form: opening a
// target's attack page counted as a fight, so going back without one dropped
// the call anyway. Now only Torn's own attack log can end a call that way.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const SRC = readFileSync(process.env.FO_SRC || '/opt/warboard/server/public/scripts/factionops.user.js', 'utf8');
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
const has = (name) => SRC.includes('function ' + name + '(');

const ME = '1000001';
const MATE = '1000002';
const T = '2000001';
const noop = () => {};

// --- statuses: nothing a status says may drop my call --------------------

const normalizeStatus = new Function(fn('normalizeStatus') + '; return normalizeStatus;')();

// The least time between two attack-log checks on one target, from the script.
const GAP = Number((SRC.match(/const FIGHT_CHECK_GAP_MS = (\d+);/) || [])[1]);

// A status merge as the script runs it. A status change may start an
// attack-log check: polls lists them, and advance(ms) moves the clock on and
// runs the timers that fall due.
function statusRig(seed, { calls } = {}) {
  const state = {
    statuses: JSON.parse(JSON.stringify(seed || {})),
    calls: calls || { [T]: { calledBy: { id: ME, name: 'me' }, timestamp: Date.now() - 60000 } },
    myPlayerId: ME,
  };
  const uncalls = [];
  const polls = [];
  const timers = [];
  const clock = { ms: Date.now() };
  const emitUncallTarget = (tid) => uncalls.push(String(tid));
  // The old hook, wired exactly as the script wires it, while it still exists.
  const hook = has('maybeAutoUncallOnHospital')
    ? new Function('state', 'emitUncallTarget', 'log', 'warn',
        fn('maybeAutoUncallOnHospital') + '; return maybeAutoUncallOnHospital;')(state, emitUncallTarget, noop, noop)
    : undefined;
  const checker = has('checkFightOnHospital')
    ? new Function('state', 'pollAttacks', 'setTimeout', 'Date', 'log', 'FIGHT_CHECK_GAP_MS', 'lastFightCheck',
        'emitUncallTarget', fn('checkFightOnHospital') + '; return checkFightOnHospital;')(
        state, (...args) => polls.push(args), (cb, ms) => { timers.push({ at: clock.ms + ms, cb }); },
        { now: () => clock.ms }, noop, GAP, {}, emitUncallTarget)
    : undefined;
  const merge = new Function(
    'state', 'isOwnFactionMember', 'rebaseStatusUntil', 'maybeAutoUncallOnHospital', 'checkFightOnHospital',
    'normalizeStatus', 'UNTIL_JUMP_SEC', '_nowSec', 'emitUncallTarget',
    fn('mergeStatusesMonotonic') + '; return mergeStatusesMonotonic;')(
    state, () => false, noop, hook, checker, normalizeStatus, 5,
    () => Math.floor(Date.now() / 1000), emitUncallTarget);
  return {
    state, merge, uncalls, polls, check: checker,
    advance(ms) {
      clock.ms += ms;
      for (const t of timers.filter((x) => x.at <= clock.ms)) {
        timers.splice(timers.indexOf(t), 1);
        t.cb();
      }
    },
  };
}

test('the first sighting of my called target in hospital keeps my call', () => {
  // Every page load starts with no statuses, so the first one seen for a
  // target I called ahead of their release used to count as "just went in".
  const r = statusRig({});
  r.merge({ [T]: { status: 'hospital', until: 900 } });
  assert.deepEqual(r.uncalls, [], 'my call was dropped by a status');
});

test('my called target going into hospital keeps my call', () => {
  // A teammate's hit, an enemy's, or a stale report: the script cannot tell
  // them apart, and none of them is my fight.
  const r = statusRig({ [T]: { status: 'ok' } });
  r.merge({ [T]: { status: 'hospital', until: 900 } });
  assert.deepEqual(r.uncalls, [], 'my call was dropped by a status');
});

test('a hospital -> okay -> hospital flap keeps my call', () => {
  // The live case: two relays disagree about a target lying in hospital.
  const r = statusRig({ [T]: { status: 'hospital', until: 900 } });
  r.merge({ [T]: { status: 'ok' } });
  r.merge({ [T]: { status: 'hospital', until: 880 } });
  r.merge({ [T]: { status: 'okay' } });
  r.merge({ [T]: { status: 'hospital', until: 860 } });
  assert.deepEqual(r.uncalls, [], 'the flap dropped my call');
});

// --- a status change asks Torn's attack log; only the log can drop -------

test("my called target going into hospital asks Torn's attack log about them a moment later", () => {
  // The fast drop after my own win, seen by my attack tab or relayed to my
  // war tab, goes through the log, as the report on leaving a fight does.
  const r = statusRig({ [T]: { status: 'ok' } });
  r.merge({ [T]: { status: 'hospital', until: 900 } });
  r.advance(3000);
  assert.deepEqual(r.polls, [], 'asked before the log can have the fight');
  r.advance(1000);
  assert.deepEqual(r.polls, [[{ fightWith: T }]]);
  assert.deepEqual(r.uncalls, [], 'the status itself dropped my call');
});

test("a teammate's call, a deal call, or no call: a status change asks nothing", () => {
  for (const calls of [
    { [T]: { calledBy: { id: MATE, name: 'mate' }, timestamp: Date.now() - 60000 } },
    { [T]: { calledBy: { id: ME, name: 'me' }, timestamp: Date.now() - 60000, isDeal: true } },
    {},
  ]) {
    const r = statusRig({ [T]: { status: 'ok' } }, { calls });
    r.merge({ [T]: { status: 'hospital', until: 900 } });
    r.advance(60000);
    assert.deepEqual(r.polls, [], JSON.stringify(calls));
  }
});

test('a first sighting, a hospital that stays hospital, or a change to anything but hospital asks nothing', () => {
  // A page load's first sightings are covered by the report on leaving a fight.
  const first = statusRig({});
  first.merge({ [T]: { status: 'hospital', until: 900 } });
  const stays = statusRig({ [T]: { status: 'hospital', until: 900 } });
  stays.merge({ [T]: { status: 'hospital', until: 880 } });
  const jail = statusRig({ [T]: { status: 'ok' } });
  jail.merge({ [T]: { status: 'jail', until: 900 } });
  // Asked directly with no status before, as a new caller might, it still
  // asks nothing.
  const bare = statusRig({});
  if (bare.check) bare.check(T, null, 'hospital');
  for (const r of [first, stays, jail, bare]) {
    r.advance(60000);
    assert.deepEqual(r.polls, []);
  }
});

test('a flapping status asks at most once in a gap of at least 10 s on one target', () => {
  // Relays that disagree can flip a target in and out of hospital every few
  // seconds; each flip must not spend one of the caller's Torn calls.
  assert.ok(GAP >= 10000, 'gap ' + GAP);
  const r = statusRig({ [T]: { status: 'ok' } });
  const flap = () => { r.merge({ [T]: { status: 'ok' } }); r.merge({ [T]: { status: 'hospital', until: 900 } }); };
  flap();
  r.advance(GAP - 1);
  flap();
  r.advance(4000);
  assert.equal(r.polls.length, 1, 'a flip inside the gap asked again');
  flap();
  r.advance(4000);
  assert.equal(r.polls.length, 2, 'a flip past the gap asked nothing');
});

// --- the fight-end drop: a page visit is not a fight ----------------------

const shouldFlushAttack = new Function('PENDING_ATTACK_MAX_AGE_MS',
  fn('shouldFlushAttack') + '; return shouldFlushAttack;')(30 * 60 * 1000);

function flushRig({ mark, calls, apiKey = 'key', jwt = 'jwt' }) {
  const store = { fo_pending_attack: mark == null ? null : JSON.stringify(mark) };
  const state = { calls: calls || {}, jwtToken: jwt, myPlayerId: ME };
  const uncalls = [];
  const polls = [];
  const timers = [];
  const flush = new Function(
    'GM_getValue', 'GM_setValue', 'shouldFlushAttack', 'state', 'CONFIG',
    'emitUncallTarget', 'pollAttacks', 'setTimeout', 'log', 'warn', 'PENDING_ATTACK_KEY',
    fn('flushPendingAttack') + '; return flushPendingAttack;')(
    (k, d) => (k in store ? store[k] : d), (k, v) => { store[k] = v; }, shouldFlushAttack,
    state, { API_KEY: apiKey }, (t) => uncalls.push(String(t)),
    (...args) => polls.push(args), (cb, ms) => { timers.push({ cb, ms }); }, noop, noop,
    'fo_pending_attack');
  return {
    store, uncalls, polls, flush,
    runTimers() { for (const t of timers.splice(0)) t.cb(); },
  };
}

const MY_CALL = { [T]: { calledBy: { id: ME, name: 'me' }, timestamp: Date.now() - 60000 } };

test('coming back from an attack page without a fight keeps my call', () => {
  // Called a target in hospital, opened their attack page to wait, went back.
  const r = flushRig({ mark: { t: T, at: Date.now() - 5000 }, calls: MY_CALL });
  r.flush();
  r.runTimers();
  assert.deepEqual(r.uncalls, [], 'a page visit dropped my call');
});

test('the early report tells the attack poll which target to look for', () => {
  const r = flushRig({ mark: { t: T, at: Date.now() - 5000 }, calls: MY_CALL });
  r.flush();
  r.runTimers();
  assert.deepEqual(r.polls, [[{ fightWith: T }]]);
});

test('the mark is still cleared before the report goes out', () => {
  // A failed poll must not leave a mark that re-fires on every page load.
  const r = flushRig({ mark: { t: T, at: Date.now() - 5000 }, calls: MY_CALL });
  r.flush();
  assert.equal(r.store.fo_pending_attack, '');
});

test("opening the same target's attack page again asks about no fight with them: I am fighting them again", () => {
  // After a stalemate or an escape the member goes straight back in; asking
  // here would find the last fight and drop the call in the middle of this one.
  const r = flushRig({ mark: { t: T, at: Date.now() - 5000 }, calls: MY_CALL });
  r.flush({ retry: false, current: T });
  r.runTimers();
  assert.deepEqual(r.polls, [[{ fightWith: '' }]], 'the report still goes out, without the target');
});

test("opening another target's attack page still asks about the last one", () => {
  const r = flushRig({ mark: { t: T, at: Date.now() - 5000 }, calls: MY_CALL });
  r.flush({ retry: false, current: '2000002' });
  r.runTimers();
  assert.deepEqual(r.polls, [[{ fightWith: T }]]);
});

test('the attack page tells the report which target it is on, then marks the new fight', () => {
  // The old mark is reported and cleared first; the new one must survive.
  const body = fn('initAttackPage');
  const flush = body.indexOf('flushPendingAttack({ retry: false, current: targetId })');
  assert.ok(flush >= 0, 'the attack page does not pass its target');
  assert.ok(body.indexOf('markAttackPending(targetId)') > flush, 'the new mark is written before the old one is reported');
});

// --- the fight-end drop: Torn's attack log decides ------------------------

// The script's own allowance, not a copy of it: a test that injected its own
// number would pass whatever the script said.
const SLACK = Number((SRC.match(/const FIGHT_AFTER_CALL_SLACK_SEC = (\d+);/) || [])[1]);
const fightEndsCall = has('fightEndsCall')
  ? new Function('FIGHT_AFTER_CALL_SLACK_SEC', fn('fightEndsCall') + '; return fightEndsCall;')(SLACK)
  : undefined;

function pollRig({ calls, attacks, uncallThrows = false }) {
  const state = { calls, jwtToken: 'jwt', myPlayerId: ME };
  const uncalls = [];
  const posts = [];
  const poll = new Function(
    'CONFIG', 'state', 'httpRequest', 'postAction', 'emitUncallTarget', 'fightEndsCall',
    'log', 'warn',
    fn('pollAttacks') + '; return pollAttacks;')(
    { API_KEY: 'key' }, state,
    (o) => o.onload({ responseText: JSON.stringify({ attacks }) }),
    (path, body) => { posts.push({ path, body }); return Promise.resolve(); },
    (t) => { if (uncallThrows) throw new Error('socket closed'); uncalls.push(String(t)); },
    fightEndsCall, noop, noop);
  return { uncalls, posts, poll };
}

const PLACED = Date.now() - 10 * 60 * 1000;
const CALL = (extra) => ({ [T]: { calledBy: { id: ME, name: 'me' }, timestamp: PLACED, ...extra } });
// Torn's v1 attack log: a map of records, ids as numbers.
const FIGHT = (extra) => ({
  'a1': {
    attacker_id: Number(ME), defender_id: Number(T), result: 'Lost',
    timestamp_started: Math.floor(PLACED / 1000) + 120,
    timestamp_ended: Math.floor(PLACED / 1000) + 150, ...extra,
  },
});

test('my own fight with the target after I called drops my call, whatever the result', () => {
  for (const result of ['Lost', 'Stalemate', 'Interrupted', 'Hospitalized', 'Attacked']) {
    const r = pollRig({ calls: CALL(), attacks: FIGHT({ result }) });
    r.poll({ fightWith: T });
    assert.deepEqual(r.uncalls, [T], result);
  }
});

test('a call I placed a moment ago, before the server echoed it, counts too', () => {
  const r = pollRig({ calls: { [T]: { calledBy: { id: ME, name: 'me' }, calledAt: PLACED } }, attacks: FIGHT() });
  r.poll({ fightWith: T });
  assert.deepEqual(r.uncalls, [T]);
});

test('a fight from before the call keeps it', () => {
  // Hit them, then called them for when they come out: that call is new.
  const r = pollRig({ calls: CALL(), attacks: FIGHT({ timestamp_started: Math.floor(PLACED / 1000) - 120 }) });
  r.poll({ fightWith: T });
  assert.deepEqual(r.uncalls, []);
});

test('a fight that started a few seconds before the call, and ended before it, keeps the call', () => {
  // Hit them, then claimed them from the war page two or three seconds later:
  // that call is for their release, not for the fight just finished.
  const placedSec = Math.floor(PLACED / 1000);
  const r = pollRig({ calls: CALL(), attacks: FIGHT({ timestamp_started: placedSec - 3, timestamp_ended: placedSec - 2 }) });
  r.poll({ fightWith: T });
  assert.deepEqual(r.uncalls, []);
});

test('a fight that started in the same second as the call drops it', () => {
  // Torn's times are whole seconds; the call's time has milliseconds.
  const placed = Math.floor(PLACED / 1000) * 1000 + 700;
  const sec = Math.floor(placed / 1000);
  const r = pollRig({ calls: { [T]: { calledBy: { id: ME, name: 'me' }, timestamp: placed } },
    attacks: FIGHT({ timestamp_started: sec, timestamp_ended: sec + 30 }) });
  r.poll({ fightWith: T });
  assert.deepEqual(r.uncalls, [T]);
});

test('somebody else fighting my target keeps my call', () => {
  const r = pollRig({ calls: CALL(), attacks: FIGHT({ attacker_id: Number(MATE) }) });
  r.poll({ fightWith: T });
  assert.deepEqual(r.uncalls, []);
});

test('my fight with a different target keeps my call on this one', () => {
  const r = pollRig({ calls: CALL(), attacks: FIGHT({ defender_id: 2000002 }) });
  r.poll({ fightWith: T });
  assert.deepEqual(r.uncalls, []);
});

test('a deal call is never dropped by a fight', () => {
  // Deals hold a target across attack windows for their full two hours.
  const r = pollRig({ calls: CALL({ isDeal: true }), attacks: FIGHT() });
  r.poll({ fightWith: T });
  assert.deepEqual(r.uncalls, []);
});

test("a teammate's call is never mine to drop", () => {
  const r = pollRig({ calls: { [T]: { calledBy: { id: MATE, name: 'mate' }, timestamp: PLACED } }, attacks: FIGHT() });
  r.poll({ fightWith: T });
  assert.deepEqual(r.uncalls, []);
});

test('a call with no time on it is kept rather than guessed at', () => {
  const r = pollRig({ calls: { [T]: { calledBy: { id: ME, name: 'me' } } }, attacks: FIGHT() });
  r.poll({ fightWith: T });
  assert.deepEqual(r.uncalls, []);
});

test('the ten-minute poll never drops a call', () => {
  // Only the report after leaving an attack page knows which fight to look for.
  const r = pollRig({ calls: CALL(), attacks: FIGHT() });
  r.poll();
  assert.deepEqual(r.uncalls, []);
});

test('a drop that fails still lets the attack report go to the server', () => {
  const r = pollRig({ calls: CALL(), attacks: FIGHT(), uncallThrows: true });
  r.poll({ fightWith: T });
  assert.equal(r.posts.length, 1);
});

test('the attack report still goes to the server', () => {
  // The server's own rule (caller's win) keeps working from the same report.
  const r = pollRig({ calls: CALL(), attacks: FIGHT() });
  r.poll({ fightWith: T });
  assert.equal(r.posts.length, 1);
  assert.equal(r.posts[0].path, '/api/me/attacks');
});

// --- the release ----------------------------------------------------------

test('no new @grant, so Tampermonkey does not hold the update', () => {
  // 5.4.3 added one, and every copy older than that stopped updating.
  const grants = [...SRC.matchAll(/^\/\/ @grant\s+(\S+)/gm)].map((m) => m[1]);
  assert.deepEqual(grants, ['GM_xmlhttpRequest', 'GM_setValue', 'GM_getValue', 'GM_addStyle',
    'GM_setClipboard', 'GM_registerMenuCommand', 'unsafeWindow']);
});

test('@version, SCRIPT_VERSION and the meta file agree', () => {
  const v = SRC.match(/^\/\/ @version\s+(\S+)/m)[1];
  assert.equal(SRC.match(/const SCRIPT_VERSION = '([^']+)'/)[1], v);
  const meta = readFileSync(process.env.FO_META || '/opt/warboard/server/public/scripts/factionops.meta.js', 'utf8');
  const header = SRC.slice(0, SRC.indexOf('// ==/UserScript==') + '// ==/UserScript=='.length);
  assert.equal(meta.trim(), header.trim());
});
