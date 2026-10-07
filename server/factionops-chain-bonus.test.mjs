// Chain bonus alerts on the live (poll-only) path.
//
// Reported: never seen a bonus toast. The alert existed, but with a hardcoded
// 3-hit window while BONUS_APPROACH = 5 sat unused beside a comment explaining
// why it must be 5. Measured across 425 stored chains, the count steps 0.7
// hits per 30s poll at the median and 4-5 on the fastest — so on exactly the
// chains where somebody is pushing for a bonus, the window was cleared without
// ever being observed inside it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const SRC = readFileSync('/opt/warboard/server/public/scripts/factionops.user.js', 'utf8');

// The alert block, lifted out and driven by a fake poll sequence.
function rig({ chainAlert = true, focus = true } = {}) {
  const i = SRC.indexOf('if (chain.current !== oldCurrent) {');
  const j = SRC.indexOf('// Forward to warboard so the server', i);
  assert.ok(i > 0 && j > i, 'alert block not found');
  const block = SRC.slice(i, j).replace(/\}\s*$/, '');

  const MILESTONES = [10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000, 25000, 50000, 100000];
  const toasts = [], pushes = []; let beeps = 0;
  let lastBonusShown = null, lastBonusLanded = null;

  // Latches are threaded through an object so each poll sees the previous
  // call's state, which is the whole point of the dedupe being tested.
  const fn = new Function('L', 'chain', 'oldCurrent', 'CONFIG', 'IS_PDA', 'document',
    'BONUS_MILESTONES', 'BONUS_APPROACH', 'nextBonusMilestone', 'showToast',
    'playChainAlert', 'firePdaNotification',
    'let lastBonusShown = L.shown, lastBonusLanded = L.landed;\n'
    + block + '}\nL.shown = lastBonusShown; L.landed = lastBonusLanded;');

  const latch = { shown: null, landed: null };
  function poll(from, to, cooldown = 0) {
    fn(latch, { current: to, cooldown }, from,
      { CHAIN_ALERT: chainAlert }, false,
      { hasFocus: () => focus, hidden: !focus },
      MILESTONES, 5,
      (c) => MILESTONES.find((m) => m >= c) ?? null,
      (m, t) => toasts.push({ m, t }), () => { beeps++; },
      (k, title, body) => pushes.push({ k, title, body }));
  }
  return { poll, toasts, pushes, beeps: () => beeps, latch };
}

test('a bonus landing between two polls is announced', () => {
  // THE reported symptom. 243 -> 252 at the fastest measured pace clears the
  // whole window; before this it said nothing at all.
  const r = rig();
  r.poll(243, 252);
  assert.equal(r.toasts.length, 1, 'silent on a jumped milestone');
  assert.match(r.toasts[0].m, /BONUS HIT — chain 250/);
  assert.equal(r.toasts[0].t, 'success');
});

test('the approach warning uses BONUS_APPROACH, not 3', () => {
  // At 4 out, a 3-hit window says nothing — and 4-5 per poll is the fastest
  // measured step.
  const r = rig();
  r.poll(243, 246);
  assert.equal(r.toasts.length, 1, 'nothing at 4 hits out');
  assert.match(r.toasts[0].m, /BONUS HIT in 4! Target: 250/);
});

test('it warns once per milestone, not once per hit in the window', () => {
  // Five hits out, unlatched, is five toasts for one bonus.
  const r = rig();
  r.poll(243, 245); r.poll(245, 246); r.poll(246, 247); r.poll(247, 248);
  assert.equal(r.toasts.length, 1, 'fired ' + r.toasts.length + ' times for one bonus');
});

test('landing is reported even after its approach warning', () => {
  const r = rig();
  r.poll(243, 247);                       // approach
  assert.equal(r.toasts.length, 1);
  r.poll(247, 251);                       // landed
  assert.equal(r.toasts.length, 2, 'the landing went unsaid');
  assert.match(r.toasts[1].m, /chain 250/);
});

test('the next milestone still warns after one lands', () => {
  const r = rig();
  r.poll(248, 251);                       // 250 landed
  r.poll(251, 496);                       // far jump: 500 is now 4 out
  const last = r.toasts[r.toasts.length - 1];
  assert.match(last.m, /Target: 500/, 'went quiet for the rest of the chain');
});

test('a milestone is announced once, not on every later poll', () => {
  const r = rig();
  r.poll(248, 252);
  const n = r.toasts.length;
  r.poll(252, 253);
  assert.equal(r.toasts.length, n, 're-announced a bonus already reported');
});

test('nothing fires below chain 10', () => {
  // The chain has not really started.
  const r = rig();
  r.poll(0, 8);
  r.poll(8, 9);
  assert.equal(r.toasts.length, 0);
});

test('a shrinking count resets both latches', () => {
  // A late snapshot can make a chain look smaller than it is.
  const r = rig();
  r.poll(243, 252);
  assert.equal(r.toasts.length, 1);
  r.poll(252, 240);                       // stale snapshot
  r.poll(240, 251);                       // real again
  assert.equal(r.toasts.length, 2, 'stayed silent after a stale snapshot');
});

test('the approach warning is suppressed while the chain is cooling down', () => {
  const r = rig();
  r.poll(243, 246, 120);
  assert.equal(r.toasts.length, 0);
});

test('the chain-alert setting switches it all off', () => {
  const r = rig({ chainAlert: false });
  r.poll(243, 246); r.poll(246, 252);
  assert.equal(r.toasts.length, 0);
});

test('an unfocused page stays silent', () => {
  // Deliberate: Torn prohibits alerts driven off an unfocused page.
  const r = rig({ focus: false });
  r.poll(243, 246); r.poll(246, 252);
  assert.equal(r.toasts.length, 0, 'alerted from an unfocused tab');
});

test('both kinds also push and beep', () => {
  const r = rig();
  r.poll(243, 246);
  r.poll(246, 252);
  assert.equal(r.pushes.length, 2);
  assert.equal(r.beeps(), 2);
  assert.match(r.pushes[0].title, /Imminent/);
  assert.ok(!/Imminent/.test(r.pushes[1].title), 'the landing push reads as a warning');
});

test('the hardcoded 3 is gone from the source', () => {
  const i = SRC.indexOf('if (chain.current !== oldCurrent) {');
  const block = SRC.slice(i, SRC.indexOf('// Forward to warboard so the server', i));
  assert.ok(!/hitsToBonus <= 3/.test(block), 'still comparing against a literal 3');
  assert.match(block, /hitsToBonus <= BONUS_APPROACH/);
});
