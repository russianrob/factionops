// OC Spawn's Armoury sub-tab (3.2.86): the pure parts lifted out of the script
// and driven with a made-up armoury -- the rows it lists, the search, which
// armoury copy a loan or a retrieve acts on, and the request types it tries.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// OC_SRC points the checks at another copy (the mutants use it).
const SRC = readFileSync(process.env.OC_SRC || new URL('./public/scripts/oc-spawn-assistance.user.js', import.meta.url), 'utf8');
const META = readFileSync(new URL('./public/scripts/oc-spawn-assistance.meta.js', import.meta.url), 'utf8');

// The text of `function name(...) {...}`, by brace count.
function fn(name) {
  const i = SRC.indexOf('function ' + name + '(');
  assert.ok(i > 0, name + ' not found');
  let d = 0;
  for (let j = SRC.indexOf('{', i); j < SRC.length; j++) {
    if (SRC[j] === '{') d++;
    else if (SRC[j] === '}' && --d === 0) return SRC.slice(i, j + 1);
  }
  throw new Error(name + ' never closes');
}
const names = ['mgr_armouryRows', 'mgr_armouryMatches', 'mgr_armouryPostTypes', 'mgr_armouryPageTypes', 'mgr_pickArmoryID', 'mgr_actionResult'];
const L = () => new Function(names.map(fn).join('\n') + '\nreturn { ' + names.join(', ') + ' };')();

// A made-up armoury, in the shape Torn's v1 faction API gives it: loaned_to is
// a number for one borrower and an "id,id" string for several.
const API = {
  weapons: [
    { ID: 2, name: 'Zebra Knife', type: 'Melee', quantity: 2, available: 2, loaned: 0, loaned_to: null },
    { ID: 1, name: 'AK-47', type: 'Primary', quantity: 3, available: 1, loaned: 2, loaned_to: '1000001,1000002' },
    { ID: 3, name: 'Glock 17', type: 'Secondary', quantity: 1, available: 0, loaned: 1, loaned_to: 1000003 },
  ],
  armor: [
    { ID: 9, name: 'Riot Helmet', type: 'Defensive', quantity: 4, available: 3, loaned: 1, loaned_to: 1000001 },
  ],
  utilities: [{ ID: 5, name: 'Lockpicks', type: 'Tool', quantity: 9, available: 9, loaned: 0, loaned_to: null }],
};
const MEMBERS = new Map([['1000001', 'Alpha'], ['1000002', 'Bravo'], ['1000003', 'Charlie']]);

test('it lists weapons by kind (primary, secondary, melee) and then armour, and nothing else', () => {
  const rows = L().mgr_armouryRows(API, MEMBERS);
  assert.deepEqual(rows.map((r) => r.name), ['AK-47', 'Glock 17', 'Zebra Knife', 'Riot Helmet']);
  assert.deepEqual(rows.map((r) => r.kind), ['weapons', 'weapons', 'weapons', 'armor']);
});

test('each row has its counts and its borrowers by name, whichever shape loaned_to comes in', () => {
  const rows = L().mgr_armouryRows(API, MEMBERS);
  assert.deepEqual(rows[0], { itemID: 1, name: 'AK-47', kind: 'weapons', type: 'Primary', quantity: 3, available: 1,
    loanedTo: [{ id: '1000001', name: 'Alpha' }, { id: '1000002', name: 'Bravo' }] });
  assert.deepEqual(rows[1].loanedTo, [{ id: '1000003', name: 'Charlie' }]);
  assert.deepEqual(rows[2].loanedTo, []);
});

test('a borrower who has left the faction still shows, by id', () => {
  const rows = L().mgr_armouryRows({ weapons: [{ ID: 1, name: 'AK-47', type: 'Primary', quantity: 1, available: 0, loaned: 1, loaned_to: 1000009 }] }, MEMBERS);
  assert.deepEqual(rows[0].loanedTo, [{ id: '1000009', name: '[1000009]' }]);
});

test('an empty or missing armoury lists nothing', () => {
  assert.deepEqual(L().mgr_armouryRows({}, MEMBERS), []);
  assert.deepEqual(L().mgr_armouryRows(null, MEMBERS), []);
});

test('the search matches an item, its type, or who has it, in any case', () => {
  const lib = L();
  const rows = lib.mgr_armouryRows(API, MEMBERS);
  const hit = (q) => rows.filter((r) => lib.mgr_armouryMatches(r, q)).map((r) => r.name);
  assert.deepEqual(hit('ak'), ['AK-47']);
  assert.deepEqual(hit('melee'), ['Zebra Knife']);
  assert.deepEqual(hit('ALPHA'), ['AK-47', 'Riot Helmet']);
  assert.deepEqual(hit(''), ['AK-47', 'Glock 17', 'Zebra Knife', 'Riot Helmet']);
});

test("a loan or retrieve names the item's own type first, then the older guess", () => {
  const { mgr_armouryPostTypes: t } = L();
  assert.deepEqual(t('weapons', 'Secondary'), ['Secondary', 'Primary']);
  assert.deepEqual(t('weapons', 'Primary'), ['Primary']);
  assert.deepEqual(t('armor', 'Defensive'), ['Defensive', 'Armor']);
  assert.deepEqual(t('armor', ''), ['Defensive', 'Armor']);
});

test("the armoury page is read under the weapons tab, and both spellings of armour", () => {
  const { mgr_armouryPageTypes: t } = L();
  assert.deepEqual(t('weapons'), ['weapons']);
  assert.deepEqual(t('armor'), ['armor', 'armour']);
});

test('a loan takes a free copy, and a retrieve the copy that member holds', () => {
  const { mgr_pickArmoryID: pick } = L();
  // The page's rows: borrowers come as user.userID or user.id; free is user false/''/0.
  const page = [
    { armoryID: 11, itemID: '1', user: { userID: 1000001 } },
    { armoryID: 12, itemID: '1', user: { id: '1000002' } },
    { armoryID: 13, itemID: '1', user: false },
    { armoryID: 14, itemID: '2', user: '' },
  ];
  assert.equal(pick(page, 1, null), 13);
  assert.equal(pick(page, 1, '1000002'), 12);
  assert.equal(pick(page, 1, 1000001), 11);
  assert.equal(pick(page, 2, null), 14);
  assert.equal(pick(page, 1, '1000003'), null);
  assert.equal(pick(page, 3, null), null);
});

test("Torn's answer to a loan or retrieve: success only when it says success is true", () => {
  const { mgr_actionResult: r } = L();
  assert.deepEqual(r('{"success":true,"text":"Loaned"}'), { ok: true, captcha: false, reason: '' });
  // A refusal still has the word "success" in it.
  assert.deepEqual(r('{"success":false,"text":"You cannot loan this item"}'), { ok: false, captcha: false, reason: 'You cannot loan this item' });
  assert.equal(r('{"success":false,"message":"Please complete the Captcha"}').captcha, true);
  assert.equal(r('{"error":"wrong type"}').ok, false);
  // A reply that is not JSON keeps the older text check.
  assert.equal(r('Item loaned: success').ok, true);
  assert.equal(r('Something went wrong').ok, false);
});

test('3.2.86 in both places, and the meta file is the header', () => {
  const end = '// ==/UserScript==';
  assert.equal(META, SRC.slice(0, SRC.indexOf(end) + end.length) + '\n');
  assert.match(SRC, /^\/\/ @version\s+3\.2\.86$/m);
  assert.match(SRC, /const SCRIPT_VERSION = '3\.2\.86';/);
});
