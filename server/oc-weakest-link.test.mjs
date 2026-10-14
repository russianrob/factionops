import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LOW_SUCCESS_THRESHOLD } from './oc-ready-notifier.js';

// The gate as routes.js applies it, lifted so the rule is pinned somewhere.
// slotRisks[0] is the RELATIVELY weakest slot. On a strong crime that is
// still someone good, and naming them reads as a problem that is not there.
function nameWeakest(raw) {
  if (!raw) return null;
  const pct = raw.successProb != null
    ? Math.round(raw.successProb * 100)
    : Math.round(raw.cpr || 0);
  return (raw.isNewMember || pct < LOW_SUCCESS_THRESHOLD) ? raw : null;
}
const slot = (o) => Object.assign({ name: 'X', position: 'Imitator', weight: 40 }, o);

test('the reported case: 79% is not a weak link', () => {
  // Deathy, Imitator, 79% on Clinical Precision at 20% failure risk.
  assert.equal(nameWeakest(slot({ name: 'Deathy', successProb: 0.79 })), null);
});

test('under the line still reports', () => {
  assert.ok(nameWeakest(slot({ successProb: 0.64 })));
  assert.ok(nameWeakest(slot({ successProb: 0.30 })));
});

test('the boundary is exclusive, and it is the ROUNDED number that counts', () => {
  assert.equal(nameWeakest(slot({ successProb: 0.65 })), null, '65 is not under 65');
  // 64.9 displays as 65%, so it must not be called weak -- otherwise the card
  // names someone whose own number does not look like a problem.
  assert.equal(nameWeakest(slot({ successProb: 0.649 })), null);
  assert.ok(nameWeakest(slot({ successProb: 0.644 })), '64.4 displays as 64 -> weak');
});

test('a new member is always named, however the numbers look', () => {
  // No history is UNKNOWN risk, not low risk. Worth seeing.
  assert.ok(nameWeakest(slot({ isNewMember: true, successProb: 0.95 })));
  assert.ok(nameWeakest(slot({ isNewMember: true })));
});

test('falls back to cpr when successProb is absent, as the UI does', () => {
  assert.equal(nameWeakest(slot({ cpr: 80 })), null);
  assert.ok(nameWeakest(slot({ cpr: 50 })));
});

test('successProb wins over cpr when both are present', () => {
  // The UI shows successPct in preference to cpr, so the gate must agree or
  // a slot could be hidden on one number and displayed with the other.
  assert.equal(nameWeakest(slot({ successProb: 0.80, cpr: 10 })), null);
  assert.ok(nameWeakest(slot({ successProb: 0.40, cpr: 99 })));
});

test('no slots at all', () => { assert.equal(nameWeakest(null), null); });

test('the threshold is the same 65 the low-success alerts use', () => {
  assert.equal(LOW_SUCCESS_THRESHOLD, 65);
});
