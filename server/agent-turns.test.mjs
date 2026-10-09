// Turns that outlive the connection that started them.
//
// The agent aborted on socket close, so backgrounding the iOS app — which
// iOS suspends after ~30s — destroyed the turn mid-flight. A turn is now a
// server-side object with a replayable event log; a disconnect is just
// nobody listening for a while.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as turns from './agent-turns.js';

test('a turn starts running and hands back an id', () => {
  turns._reset();
  const id = turns.start({ sessionId: 's1' });
  assert.ok(id);
  assert.equal(turns.get(id).status, 'running');
});

test('events are kept, so a listener that arrives late sees everything', () => {
  turns._reset();
  const id = turns.start({});
  turns.append(id, { t: 'text', v: 'a' });
  turns.append(id, { t: 'text', v: 'b' });
  assert.deepEqual(turns.since(id, 0).events.map((e) => e.v), ['a', 'b']);
});

test('a cursor replays only what the listener has not seen', () => {
  turns._reset();
  const id = turns.start({});
  ['a', 'b', 'c'].forEach((v) => turns.append(id, { t: 'text', v }));
  assert.deepEqual(turns.since(id, 2).events.map((e) => e.v), ['c']);
  assert.equal(turns.since(id, 2).next, 3);
});

test('finishing records the status and the session it advanced', () => {
  turns._reset();
  const id = turns.start({});
  turns.finish(id, { sessionId: 's9' });
  const t = turns.get(id);
  assert.equal(t.status, 'done');
  assert.equal(t.sessionId, 's9');
});

test('a disconnect does NOT end a turn — only an explicit cancel does', () => {
  turns._reset();
  const id = turns.start({});
  turns.detach(id);                       // the socket went away
  assert.equal(turns.get(id).status, 'running');
  assert.equal(turns.cancel(id), true);
  assert.equal(turns.get(id).status, 'cancelled');
});

test('cancel fires the abort signal the runner is watching', () => {
  turns._reset();
  const id = turns.start({});
  let aborted = false;
  turns.get(id).signal.addEventListener('abort', () => { aborted = true; });
  turns.cancel(id);
  assert.equal(aborted, true);
});

test('cancelling an unknown or finished turn is a no-op, not a throw', () => {
  turns._reset();
  assert.equal(turns.cancel('nope'), false);
  const id = turns.start({});
  turns.finish(id, {});
  assert.equal(turns.cancel(id), false);
});

test('a finished turn is collected after its grace period, a running one never is', () => {
  turns._reset();
  const done = turns.start({});
  turns.finish(done, {});
  const live = turns.start({});
  // No cap on how long a turn may RUN — the owner asked for none. This only
  // reclaims the event log of turns that already ended.
  turns._sweep(Date.now() + turns.KEEP_FINISHED_MS + 1000);
  assert.equal(turns.get(done), null);
  assert.ok(turns.get(live), 'a running turn is never swept, however long it runs');
});

test('the newest turn for a session can be found again after a relaunch', () => {
  turns._reset();
  turns.start({ sessionId: 's1' });
  const second = turns.start({ sessionId: 's1' });
  assert.equal(turns.latestForSession('s1'), second);
  assert.equal(turns.latestForSession('other'), null);
});
