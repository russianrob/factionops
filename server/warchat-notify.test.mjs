// The audience and throttle rules for war-chat push, run out of the SHIPPED
// routes.js rather than reimplemented.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const SRC = readFileSync('/opt/warboard/server/routes.js', 'utf8');
const i = SRC.indexOf('function notifyWarChat(');
assert.ok(i > 0, 'notifyWarChat not found — update this anchor');
let d = 0, end = -1;
for (let j = SRC.indexOf('{', i); j < SRC.length; j++) {
  if (SRC[j] === '{') d++;
  else if (SRC[j] === '}' && --d === 0) { end = j + 1; break; }
}
const FLOOR = Number(SRC.match(/WAR_CHAT_PUSH_FLOOR_MS = ([\d_]+)/)[1].replace(/_/g, ''));

function harness() {
  const sent = [];
  const fn = new Function('push', 'console', '_warChatPushAt', 'WAR_CHAT_PUSH_FLOOR_MS',
    SRC.slice(i, end) + '; return notifyWarChat;');
  const push = { sendToPlayers: (ids, payload, type) => { sent.push({ ids, payload, type }); return Promise.resolve(); } };
  return { call: fn(push, console, new Map(), FLOOR), sent };
}

const war = { ourMemberIds: ['137558', '2862329', '426385'] };
const msg = (over = {}) => ({ id: 'm1', playerId: '137558', playerName: 'RussianRob', text: 'wall up', ...over });

test('everyone in the faction is told except the sender', () => {
  const h = harness();
  h.call('war_42055', war, msg());
  assert.equal(h.sent.length, 1);
  assert.deepEqual(h.sent[0].ids, ['2862329', '426385']);
  assert.ok(!h.sent[0].ids.includes('137558'), 'the sender was notified of their own message');
});

test('it is sent under the war_chat type, so it can be switched off', () => {
  // An unregistered type defaults to ON and cannot be disabled, which is
  // how oc_low_success shipped. The type must be passed.
  const h = harness();
  h.call('war_42055', war, msg());
  assert.equal(h.sent[0].type, 'war_chat');
});

test('banners collapse per war rather than stacking', () => {
  const h = harness();
  h.call('war_42055', war, msg());
  assert.equal(h.sent[0].payload.tag, 'war-chat-war_42055');
});

test('a burst does not become a push firehose', () => {
  const h = harness();
  for (let n = 0; n < 5; n++) h.call('war_42055', war, msg({ id: 'm' + n }));
  assert.equal(h.sent.length, 1, 'the floor did not hold');
});

test('two different wars do not throttle each other', () => {
  const h = harness();
  h.call('war_1', war, msg());
  h.call('war_2', war, msg());
  assert.equal(h.sent.length, 2);
});

test('a war with no cached roster pushes nothing', () => {
  const h = harness();
  h.call('war_x', { ourMemberIds: null }, msg());
  h.call('war_y', {}, msg());
  assert.equal(h.sent.length, 0);
});

test('a faction of one sends no push to itself', () => {
  const h = harness();
  h.call('war_solo', { ourMemberIds: ['137558'] }, msg());
  assert.equal(h.sent.length, 0);
});

test('long messages are truncated, not sent whole', () => {
  const h = harness();
  h.call('war_42055', war, msg({ text: 'x'.repeat(400) }));
  assert.ok(h.sent[0].payload.body.length <= 120, 'body was ' + h.sent[0].payload.body.length);
  assert.match(h.sent[0].payload.body, /…$/);
});

test('a push failure never breaks the message', () => {
  const sent = [];
  const fn = new Function('push', 'console', '_warChatPushAt', 'WAR_CHAT_PUSH_FLOOR_MS',
    SRC.slice(i, end) + '; return notifyWarChat;');
  const push = { sendToPlayers: () => { throw new Error('push is down'); } };
  const call = fn(push, { warn() {} }, new Map(), FLOOR);
  assert.doesNotThrow(() => call('war_42055', war, msg()));
});
