// FactionOps' broadcast bar: the pure parts lifted out of the script and driven
// with made-up broadcasts, and the every-page part checked for what would
// break it before the script's logging exists. The bar itself, in a browser,
// is tests/factionops/broadcast.e2e.test.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// FO_SRC points the checks at another copy (the mutants use it).
const SRC = readFileSync(process.env.FO_SRC || new URL('./public/scripts/factionops.user.js', import.meta.url), 'utf8');

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
function konst(name) {
  const m = SRC.match(new RegExp('const ' + name + ' = ([^;]+);'));
  assert.ok(m, name + ' not found');
  return 'const ' + name + ' = ' + m[1] + ';\n';
}
let lib = null;
function L() {
  if (lib) return lib;
  const names = ['bcastRecord', 'bcastNewer', 'bcastText', 'bcastShows', 'bcastTop'];
  lib = new Function(konst('BCAST_HOLD_MS') + names.map(fn).join('\n') + '\nreturn { ' + names.join(', ') + ' };')();
  return lib;
}

const B = { message: 'Hold hits', senderName: 'Tester', senderRole: 'Leader', senderId: '1000001', ts: 1700000000000 };

test("a record's key, and a deadline from the hold that is left", () => {
  assert.deepEqual(L().bcastRecord({ ...B, age: 540000 }, 5000), {
    key: '1700000000000:1000001', message: 'Hold hits', senderName: 'Tester', senderRole: 'Leader',
    ts: 1700000000000, until: 65000,
  });
  // The stream and the polls hand a broadcast over as it is sent: no age.
  assert.equal(L().bcastRecord(B, 5000).until, 605000);
  assert.equal(L().bcastRecord({ ...B, age: -5 }, 5000).until, 605000);
  assert.equal(L().bcastRecord({ ...B, age: 900000 }, 5000).until, 5000);
  assert.equal(L().bcastRecord({ ...B, age: 'soon' }, 5000).until, 605000);
  assert.equal(L().bcastRecord({ ...B, message: '' }, 5000), null);
  assert.equal(L().bcastRecord({ ...B, message: undefined }, 5000), null);
  assert.equal(L().bcastRecord({ ...B, ts: 'x' }, 5000), null);
  assert.equal(L().bcastRecord(null, 5000), null);
});

test('only a different, newer broadcast replaces the one held', () => {
  const held = L().bcastRecord(B, 5000);
  assert.equal(L().bcastNewer(null, held), true);
  // The same one again, from the stream, a poll or the next page's ask.
  assert.equal(L().bcastNewer(held, L().bcastRecord(B, 9000)), false);
  assert.equal(L().bcastNewer(held, L().bcastRecord({ ...B, ts: B.ts - 1000, message: 'Older' }, 9000)), false);
  assert.equal(L().bcastNewer(held, L().bcastRecord({ ...B, ts: B.ts + 1000, message: 'Newer' }, 9000)), true);
  // Two admins in the same millisecond.
  assert.equal(L().bcastNewer(held, L().bcastRecord({ ...B, senderId: '1000002' }, 9000)), false);
});

test('the text: the message, who sent it and their position', () => {
  const rec = (over) => L().bcastRecord({ ...B, message: 'Let chain die', ...over }, 0);
  assert.equal(L().bcastText(rec({})), '\u{1F4E3} Let chain die · Tester (Leader)');
  assert.equal(L().bcastText(rec({ senderRole: '' })), '\u{1F4E3} Let chain die · Tester');
  assert.equal(L().bcastText(rec({ senderName: '', senderRole: '' })), '\u{1F4E3} Let chain die');
  assert.equal(L().bcastText(rec({ senderName: undefined })), '\u{1F4E3} Let chain die');
});

test('a dismissed or expired broadcast does not show', () => {
  const rec = L().bcastRecord(B, 5000);
  assert.equal(L().bcastShows(rec, '', 5000), true);
  assert.equal(L().bcastShows(rec, 'another', rec.until - 1), true);
  assert.equal(L().bcastShows(rec, rec.key, 5000), false);
  assert.equal(L().bcastShows(rec, '', rec.until), false);
  assert.equal(L().bcastShows(null, '', 5000), false);
});

test("its top: under Gym Coach's banner at the top, under the chain bar, else 10 px", () => {
  assert.equal(L().bcastTop({ top: 10, bottom: 46 }, null), 52);
  assert.equal(L().bcastTop(null, { top: 10, bottom: 44 }), 50);
  assert.equal(L().bcastTop({ top: 10, bottom: 46 }, { top: 52, bottom: 86 }), 92);
  // Gym Coach's banner further down the page, as when the chain bar came first.
  assert.equal(L().bcastTop({ top: 300, bottom: 336 }, null), 10);
  assert.equal(L().bcastTop({ top: -40, bottom: 0 }, null), 10);
  assert.equal(L().bcastTop(null, null), 10);
});

// The every-page part runs before LOG_PREFIX is declared, off FactionOps'
// pages forever: a log() there throws on whichever path reaches it.
test("no log() or warn() in the bar's every-page functions", () => {
  for (const name of ['bcastRecord', 'bcastNewer', 'bcastText', 'bcastShows', 'bcastTop', 'readBcast',
    'takeBroadcast', 'renderBroadcastBar', 'broadcastBarTick', 'checkBroadcastOnLoad', 'startBroadcastBar']) {
    assert.doesNotMatch(fn(name), /\b(log|warn)\(/, name);
  }
});

// The war page's 📣 replaces the overlay's Shout box, every piece of it.
test("the overlay's Shout box is gone", () => {
  for (const name of ['fo-input-broadcast', 'fo-btn-send-broadcast', 'setupShoutDelegation', 'sendShoutAction',
    'fo-broadcast-entry-bar']) {
    assert.equal(SRC.includes(name), false, name);
  }
});

test("the box's text is trimmed and every run of spaces is one", () => {
  const bcastClean = new Function(fn('bcastClean') + '\nreturn bcastClean;')();
  assert.equal(bcastClean('  Hold   hits \n now '), 'Hold hits now');
  assert.equal(bcastClean('Let chain die'), 'Let chain die');
  assert.equal(bcastClean(' \n\t '), '');
  assert.equal(bcastClean(null), '');
  assert.equal(bcastClean(undefined), '');
  assert.equal(bcastClean(42), '42');
});
