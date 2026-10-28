// OC Spawn's Armoury sub-tab (ranked-war weapons only): the pure parts lifted
// out of the script and driven with a made-up armoury -- the copies it lists,
// their bonuses, the search, the request types it tries, how it reads Torn's
// answer, and when each holder was last on.
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

// When a holder was last on, from the member list the tab loads
// (/v2/faction/members gives each member last_action { status, timestamp,
// relative }): how long ago, coloured by Torn's own online, idle or offline.
// A holder who is not in that list has left the faction. Times are worked by
// hand from NOW, in seconds.
const seen = () => new Function(fn('mgr_holderSeen') + '\nreturn mgr_holderSeen;')();
const NOW = 1793200000;
const la = (status, ago) => ({ status, timestamp: NOW - ago, relative: '' });

test('how long ago a holder was last on: now, then minutes, hours, days', () => {
  const s = seen();
  const members = new Map([
    ['1000001', la('Online', 20)],
    ['1000002', la('Idle', 12 * 60)],
    ['1000003', la('Offline', 3 * 3600 + 120)],
    ['1000004', la('Offline', 2 * 86400 + 5)],
  ]);
  assert.deepEqual(s('1000001', members, NOW), { text: 'now', cls: 'on' });
  assert.deepEqual(s('1000002', members, NOW), { text: '12m ago', cls: 'idle' });
  assert.deepEqual(s('1000003', members, NOW), { text: '3h ago', cls: 'off' });
  assert.deepEqual(s('1000004', members, NOW), { text: '2d ago', cls: 'off' });
});

test('a full minute, hour or day is where the next unit starts', () => {
  const s = seen();
  const at = (ago) => s('1000001', new Map([['1000001', la('Offline', ago)]]), NOW).text;
  assert.deepEqual([at(59), at(60), at(3599), at(3600), at(86399), at(86400)],
    ['now', '1m ago', '59m ago', '1h ago', '23h ago', '1d ago']);
});

test("the colour follows Torn's online, idle or offline, not the time", () => {
  const s = seen();
  const cls = (status) => s('1000001', new Map([['1000001', la(status, 7200)]]), NOW).cls;
  assert.deepEqual([cls('Online'), cls('Idle'), cls('Offline'), cls('')], ['on', 'idle', 'off', 'off']);
});

test('a holder who is not in the member list has left the faction', () => {
  assert.deepEqual(seen()('1000009', new Map([['1000001', la('Online', 5)]]), NOW), { text: 'left faction', cls: 'left' });
});

test("a holder's id as a number or a string is the same member", () => {
  assert.equal(seen()(1000003, new Map([['1000003', la('Offline', 600)]]), NOW).text, '10m ago');
});

test('nothing shows without a member list, with an empty one, or without a time for that member', () => {
  const s = seen();
  assert.equal(s('1000001', null, NOW), null);
  // An empty list is no list: Torn's error answer carries no members.
  assert.equal(s('1000001', new Map(), NOW), null);
  assert.equal(s('1000001', new Map([['1000001', null]]), NOW), null);
  assert.equal(s('1000001', new Map([['1000001', { status: 'Offline' }]]), NOW), null);
});

test('a time a little ahead of this clock reads as now', () => {
  assert.equal(seen()('1000001', new Map([['1000001', la('Online', -30)]]), NOW).text, 'now');
});

test('3.2.88 in both places, and the meta file is the header', () => {
  const end = '// ==/UserScript==';
  assert.equal(META, SRC.slice(0, SRC.indexOf(end) + end.length) + '\n');
  assert.match(SRC, /^\/\/ @version\s+3\.2\.88$/m);
  assert.match(SRC, /const SCRIPT_VERSION = '3\.2\.88';/);
});
