// OC Spawn's Armoury sub-tab (3.2.87, ranked-war weapons only): the pure parts
// lifted out of the script and driven with a made-up armoury -- the copies it
// lists, their bonuses, the search, the request types it tries, and how it
// reads Torn's answer.
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
const names = ['mgr_rwBonusLabel', 'mgr_rwCopies', 'mgr_armouryMatches', 'mgr_armouryPostTypes', 'mgr_actionResult'];
const L = () => new Function(names.map(fn).join('\n') + '\nreturn { ' + names.join(', ') + ' };')();

// Rows as the armoury page (step=armouryTabContent) gives them: one per copy,
// glowClass "glow-red|orange|yellow" on a ranked-war copy and "" on a plain
// one, the bonuses as icons with a title, and the holder as user (false when free).
const bonus = (name, text) => ({ class: 'bonus-attachment-' + name.toLowerCase(), title: `<b>${name}</b><br/>${text}` });
const blank = { class: 'bonus-attachment-blank-bonus-25' };
const PAGE = [
  { armoryID: 11, itemID: '26', name: 'AK-47', type: 'Primary', glowClass: '', bonuses: [blank, blank], user: false },
  { armoryID: 12, itemID: '26', name: 'AK-47', type: 'Primary', glowClass: 'glow-orange', bonuses: [bonus('Warlord', '22% increased respect upon final hit'), blank], user: false },
  { armoryID: 13, itemID: '399', name: 'Zebra Blade', type: 'Melee', glowClass: 'glow-yellow', bonuses: [bonus('Disarm', 'Disarm for 7 turns'), blank], user: { userID: 1000002, playername: 'Bravo' } },
  { armoryID: 14, itemID: '26', name: 'AK-47', type: 'Primary', glowClass: 'glow-red', bonuses: [bonus('Warlord', '31% increased respect upon final hit'), bonus('Expose', '9% increased critical hit rate')], user: { id: '1000009', playername: 'Gone' } },
  { armoryID: 15, itemID: '3', name: 'Glock 17', type: 'Secondary', glowClass: 'glow-orange', bonuses: [blank], user: '' },
];

test('only ranked-war copies are listed, red then orange then yellow, then by name', () => {
  const rows = L().mgr_rwCopies(PAGE);
  assert.deepEqual(rows.map((r) => r.armoryID), [14, 12, 15, 13]);
  assert.deepEqual(rows.map((r) => r.rarity), ['red', 'orange', 'orange', 'yellow']);
});

test('each copy carries its own armoury id, type, bonuses and holder', () => {
  const rows = L().mgr_rwCopies(PAGE);
  assert.deepEqual(rows[0], { armoryID: 14, itemID: 26, name: 'AK-47', type: 'Primary', rarity: 'red',
    bonuses: ['Warlord 31%', 'Expose 9%'], holder: { id: '1000009', name: 'Gone' } });
  assert.equal(rows[1].holder, null);
  assert.deepEqual(rows[2].bonuses, []);
  assert.equal(rows[2].holder, null);
  assert.deepEqual(rows[3].holder, { id: '1000002', name: 'Bravo' });
});

test('a bonus reads as its name and number', () => {
  const { mgr_rwBonusLabel: b } = L();
  assert.equal(b('<b>Warlord</b><br/>31% increased respect upon final hit'), 'Warlord 31%');
  assert.equal(b('<b>Disarm</b><br/>Disarm for 7 turns'), 'Disarm 7');
  assert.equal(b('<b>Bleed</b>'), 'Bleed');
  assert.equal(b(undefined), '');
});

test('nothing, or rows with no rarity, list nothing', () => {
  const { mgr_rwCopies: c } = L();
  assert.deepEqual(c(null), []);
  assert.deepEqual(c([{ armoryID: 1, itemID: '1', name: 'X', type: 'Primary', user: false }]), []);
});

test('the search matches an item, its type, rarity, bonus, or who has it, in any case', () => {
  const lib = L();
  const rows = lib.mgr_rwCopies(PAGE);
  const hit = (q) => rows.filter((r) => lib.mgr_armouryMatches(r, q)).map((r) => r.armoryID);
  assert.deepEqual(hit('glock'), [15]);
  assert.deepEqual(hit('MELEE'), [13]);
  assert.deepEqual(hit('red'), [14]);
  assert.deepEqual(hit('warlord'), [14, 12]);
  assert.deepEqual(hit('bravo'), [13]);
  assert.deepEqual(hit(''), [14, 12, 15, 13]);
});

test("a loan or retrieve names the copy's own type first, then the older guess", () => {
  const { mgr_armouryPostTypes: t } = L();
  assert.deepEqual(t('weapons', 'Secondary'), ['Secondary', 'Primary']);
  assert.deepEqual(t('weapons', 'Primary'), ['Primary']);
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

test('3.2.87 in both places, and the meta file is the header', () => {
  const end = '// ==/UserScript==';
  assert.equal(META, SRC.slice(0, SRC.indexOf(end) + end.length) + '\n');
  assert.match(SRC, /^\/\/ @version\s+3\.2\.87$/m);
  assert.match(SRC, /const SCRIPT_VERSION = '3\.2\.87';/);
});
