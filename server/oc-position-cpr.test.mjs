import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as ocSpawn from './oc-spawn.js';

// ── Server: the cache carries each member's CPR per OC and role ──────────
// The Join pick and the dispatcher rank open slots by the member's CPR for
// THAT OC and role (keys like "Blast from the Past::Picklock"). The server
// never attached that map, so every slot scored zero and the pick fell
// through to "the fullest OC at their level" — which is how a member with
// no Cleared for Takeoff history got sent to Cleared for Takeoff.
const crime = (id, name, difficulty, slots) => ({ id, name, difficulty, status: 'Successful', slots });
const slot = (uid, position, rate) => ({ user_id: uid, position, checkpoint_pass_rate: rate });

test('buildCprCache attaches per-OC, per-role CPR keyed Crime::Role with sample count', () => {
  const crimes = [
    crime(1, 'Blast from the Past', 7, [slot(9, 'Picklock', 72), slot(8, 'Muscle', 80)]),
    crime(2, 'Blast from the Past', 7, [slot(9, 'Picklock', 76)]),
    crime(3, 'Window of Opportunity', 7, [slot(9, 'Muscle', 65)]),
  ];
  const bp = ocSpawn.buildCprCache(crimes, {}, { mincpr: 65, boost: 15 })[9].byPosition;
  assert.deepEqual(bp['Blast from the Past::Picklock'], { cpr: 74, n: 2, diff: 7 });
  assert.deepEqual(bp['Window of Opportunity::Muscle'], { cpr: 65, n: 1, diff: 7 });
  assert.equal(bp['Blast from the Past::Muscle'], undefined, 'another member\'s slot is not mine');
});

test('per-OC history keeps every level, not just the top two, and strips "#N" from roles', () => {
  // A level-2 run still says how this member does as a Thief on that OC,
  // even though the level-average logic ignores crimes far below their best.
  const crimes = [
    crime(1, 'Break the Bank', 8, [slot(9, 'Robber', 70)]),
    crime(2, 'Cash Me if You Can', 2, [slot(9, 'Thief #2', 90)]),
  ];
  const bp = ocSpawn.buildCprCache(crimes, {}, { mincpr: 65, boost: 15 })[9].byPosition;
  assert.deepEqual(bp['Cash Me if You Can::Thief'], { cpr: 90, n: 1, diff: 2 });
});

// ── Client: the Join pick scores slots by expected CPR for that OC+role ──
function extractFns(names) {
  const src = readFileSync(new URL('./public/scripts/oc-spawn-assistance.user.js', import.meta.url), 'utf8');
  const parts = names.map(name => {
    const start = src.indexOf(`function ${name}(`);
    assert.notEqual(start, -1, `the userscript carries ${name}`);
    let i = src.indexOf('{', start), depth = 0;
    for (; i < src.length; i++) {
      if (src[i] === '{') depth++;
      else if (src[i] === '}' && --depth === 0) break;
    }
    return src.slice(start, i + 1);
  });
  return new Function(`${parts.join('\n')}; return { ${names.join(', ')} };`)();
}
const client = () => extractFns(['expectedCprFor', 'pickSlotForMember']);

// Shadow_drake [3793484] on 2026-10-18: overall 71%, joinable 7, no CFTO
// history, Assassin 75% on Dish It Out, Muscle 65% on Window of Opportunity.
const DRAKE = {
  cpr: 71, joinable: 7,
  byPosition: {
    'Dish It Out::Assassin': { cpr: 75, n: 3, diff: 6 },
    'Window of Opportunity::Muscle': { cpr: 65, n: 2, diff: 7 },
    'Bidding War::Bomber': { cpr: 71.1, n: 11, diff: 6 },
  },
  cprEntries: [{ diff: 7, rate: 65 }, { diff: 7, rate: 65 }, { diff: 6, rate: 71 }, { diff: 6, rate: 75 }],
};
const open = (crimeName, difficulty, role, order, extra = {}) => ({ crimeName, difficulty, role, order, ...extra });

test('expected CPR precedence: own OC+role, then same role elsewhere, then level average, then overall', () => {
  const { expectedCprFor } = client();
  assert.deepEqual(expectedCprFor(DRAKE, 'Dish It Out', 'Assassin', 6), { cpr: 75, basis: 'oc-role', n: 3 });
  assert.deepEqual(expectedCprFor(DRAKE, 'Cleared for Takeoff', 'Assassin', 7), { cpr: 70, basis: 'role', n: 3, adj: 5 }); // Dish It Out is level 6: −5
  assert.deepEqual(expectedCprFor(DRAKE, 'Blast from the Past', 'Picklock', 7), { cpr: 65, basis: 'level', n: 2 });
  assert.deepEqual(expectedCprFor(DRAKE, 'Break the Bank', 'Robber', 8), { cpr: 71, basis: 'overall', n: 0 });
});

test('a "#2" slot label resolves to the base role', () => {
  const { expectedCprFor } = client();
  assert.equal(expectedCprFor(DRAKE, 'Dish It Out', 'Assassin #2', 6).cpr, 75);
});

test('the pick prefers the slot the member is known to clear, not the fullest OC', () => {
  const { pickSlotForMember } = client();
  const m = { ...DRAKE, byPosition: { ...DRAKE.byPosition,
    'Cleared for Takeoff::Pickpocket': { cpr: 58, n: 2, diff: 7 },
    'Blast from the Past::Picklock': { cpr: 74, n: 4, diff: 7 } } };
  const slots = [open('Cleared for Takeoff', 7, 'Pickpocket', 0), open('Blast from the Past', 7, 'Picklock', 1)];
  const r = pickSlotForMember(m, slots, 65);
  assert.equal(r.crimeName, 'Blast from the Past');
  assert.equal(r.role, 'Picklock');
  assert.equal(r.cpr, 74);
  assert.equal(r.basis, 'oc-role');
  assert.equal(r.lowCpr, false);
});

test('Shadow_drake: CFTO Assassin wins on discounted same-role evidence (70) over a Picklock slot judged by level average (65)', () => {
  const { pickSlotForMember } = client();
  const slots = [open('Blast from the Past', 7, 'Picklock', 0), open('Cleared for Takeoff', 7, 'Assassin', 1)];
  const r = pickSlotForMember(DRAKE, slots, 65);
  assert.equal(r.crimeName, 'Cleared for Takeoff');
  assert.equal(r.role, 'Assassin');
  assert.deepEqual([r.cpr, r.basis, r.lowCpr], [70, 'role', false]);
});

test('when nothing open clears the bar, the best of them is offered and flagged', () => {
  const { pickSlotForMember } = client();
  const slots = [open('Window of Opportunity', 7, 'Engineer', 0), open('Window of Opportunity', 7, 'Muscle', 1)];
  const r = pickSlotForMember(DRAKE, slots, 70);
  assert.equal(r.lowCpr, true);
  assert.equal(r.role, 'Muscle');   // both 65: their own Muscle record outranks a level-average guess
});

test('ties on expected CPR go to the fuller OC (lower order)', () => {
  const { pickSlotForMember } = client();
  const slots = [open('Window of Opportunity', 7, 'Looter', 0), open('Blast from the Past', 7, 'Hacker', 1)];
  // Neither role is known; both fall to the level-7 average of 65.
  const r = pickSlotForMember(DRAKE, slots, 65);
  assert.equal(r.crimeName, 'Window of Opportunity');
  assert.equal(r.basis, 'level');
});

// The map rides on every spawn response and nginx does not gzip JSON, so
// ex-members' maps (history holds 208 players against a 96-member roster for
// 42055) are dead weight: current members keep theirs, everyone else's is
// emptied. Their level data stays — the forecaster still needs it.
test('trimByPositionToRoster empties the map for players no longer in the faction', () => {
  const cache = {
    1: { cpr: 70, entries: [{ diff: 5, rate: 70 }], byPosition: { 'Honey Trap::Enforcer': { cpr: 70, n: 1, diff: 5 } } },
    2: { cpr: 60, entries: [{ diff: 5, rate: 60 }], byPosition: { 'Honey Trap::Muscle': { cpr: 60, n: 1, diff: 5 } } },
  };
  ocSpawn.trimByPositionToRoster(cache, [{ id: '1', name: 'Stays' }]);
  assert.deepEqual(cache[1].byPosition, { 'Honey Trap::Enforcer': { cpr: 70, n: 1, diff: 5 } });
  assert.deepEqual(cache[2].byPosition, {});
  assert.deepEqual(cache[2].entries, [{ diff: 5, rate: 60 }], 'level data untouched');
});

// Same-role evidence is level-bounded: a run more than two levels BELOW the
// target says nothing about it (an 89% Imitator on a level-3 crime is not an
// 89% Imitator on a level-7 one). Runs at or above the target still count —
// a harder crime is at least as good a witness.
test('same-role evidence from more than two levels below the target is ignored', () => {
  const { expectedCprFor } = client();
  const m = { ...DRAKE, byPosition: { ...DRAKE.byPosition,
    'Gaslight the Way::Imitator': { cpr: 89, n: 1, diff: 3 },
    'Snow Blind::Imitator': { cpr: 85, n: 1, diff: 4 } } };
  assert.deepEqual(expectedCprFor(m, 'Cleared for Takeoff', 'Imitator', 7), { cpr: 65, basis: 'level', n: 2 });
});

test('same-role evidence within two levels counts, and so do harder crimes', () => {
  const { expectedCprFor } = client();
  const m = { ...DRAKE, byPosition: { ...DRAKE.byPosition,
    'Honey Trap::Muscle': { cpr: 76, n: 1, diff: 5 },            // 7-2 = 5: counts
    'Plucking the Lotus Petal::Muscle': { cpr: 84, n: 1, diff: 4 }, // too far below: ignored
    'Market Forces::Muscle': { cpr: 88.5, n: 2, diff: 3 },        // too far below: ignored
    'Break the Bank::Muscle': { cpr: 70, n: 1, diff: 8 } } };      // harder: counts
  // Honey Trap is two levels below the target so it counts as 66; the level-7 and level-8 runs are not discounted.
  // (65×2 + 66 + 70) / 4 = 66.5, average discount (0+0+10+0)/4 = 2.5
  assert.deepEqual(expectedCprFor(m, 'Blast from the Past', 'Muscle', 7), { cpr: 66.5, basis: 'role', n: 4, adj: 2.5 });
});

// ── The discount: borrowed same-role evidence loses 5 points per level below the target ──
// Measured on 42055's history: the same player in the same role drops a median
// 5.7 CPR one level up and 10.3 two levels up (400 and 174 pairs). Backtest:
// the plain borrowed number missed the first run at the higher level by 8.1
// points; discounted, by 5.2.
test('borrowed evidence from an easier crime is discounted 5 per level and says so', () => {
  const { expectedCprFor } = client();
  const m = { ...DRAKE, byPosition: { 'Snow Blind::Imitator': { cpr: 85, n: 1, diff: 4 } } };
  assert.deepEqual(expectedCprFor(m, 'Sneaky Git Grab', 'Imitator', 6), { cpr: 75, basis: 'role', n: 1, adj: 10 });
});

test('evidence from the same level or a harder crime is not discounted', () => {
  const { expectedCprFor } = client();
  const m = { ...DRAKE, byPosition: { 'Break the Bank::Muscle': { cpr: 70, n: 1, diff: 8 } } };
  assert.deepEqual(expectedCprFor(m, 'Blast from the Past', 'Muscle', 7), { cpr: 70, basis: 'role', n: 1, adj: 0 });
});

// ── The own-record rule: a real record on that crime and role beats a guess within 5 points ──
// Backtest: a member's own record predicted their next run on that crime+role
// to within 2.9 points (2,474 cases); borrowed evidence, even discounted, is
// off by 5.2. A guess that beats a record by less than its own error is noise.
const DRAKE_L6 = { ...DRAKE, joinable: 6, byPosition: { ...DRAKE.byPosition,
  'Bidding War::Bomber': { cpr: 71.1, n: 11, diff: 6 },
  'Snow Blind::Imitator': { cpr: 85, n: 1, diff: 4 },
  'Counter Offer::Robber': { cpr: 78, n: 1, diff: 5 },
  'Leave No Trace::Techie': { cpr: 70, n: 1, diff: 6 } },
  cprEntries: [{ diff: 6, rate: 71.7 }, { diff: 7, rate: 65 }] };

test('Shadow_drake at level 6: the eleven-run Bomber record beats a one-run Imitator guess that is 3.9 higher', () => {
  const { pickSlotForMember } = client();
  const slots = [open('Bidding War', 6, 'Driver', 0), open('Bidding War', 6, 'Bomber', 0),
                 open('Leave No Trace', 6, 'Techie', 1), open('Sneaky Git Grab', 6, 'Imitator', 2), open('Bidding War', 6, 'Robber', 4)];
  const r = pickSlotForMember(DRAKE_L6, slots, 70);
  assert.equal(r.crimeName, 'Bidding War');
  assert.equal(r.role, 'Bomber');
  assert.deepEqual([r.cpr, r.basis, r.n, r.lowCpr], [71.1, 'oc-role', 11, false]);
  assert.equal(r.preferredOver, 75, 'records which guess it displaced');
});

test('a guess that beats the record by more than 5 points wins', () => {
  const { pickSlotForMember } = client();
  const m = { ...DRAKE_L6, byPosition: { ...DRAKE_L6.byPosition, 'Snow Blind::Imitator': { cpr: 92, n: 2, diff: 4 } } }; // → 82 at level 6
  const slots = [open('Bidding War', 6, 'Bomber', 0), open('Sneaky Git Grab', 6, 'Imitator', 1)];
  const r = pickSlotForMember(m, slots, 70);
  assert.equal(r.role, 'Imitator');
  assert.equal(r.preferredOver, undefined);
});

test('a record that fails the bar is not preferred over a guess that clears it', () => {
  const { pickSlotForMember } = client();
  const m = { ...DRAKE_L6, byPosition: { ...DRAKE_L6.byPosition, 'Bidding War::Bomber': { cpr: 68, n: 11, diff: 6 } } };
  const slots = [open('Bidding War', 6, 'Bomber', 0), open('Sneaky Git Grab', 6, 'Imitator', 1)]; // Imitator 75 clears 70, Bomber 68 does not
  const r = pickSlotForMember(m, slots, 70);
  assert.equal(r.role, 'Imitator');
});
