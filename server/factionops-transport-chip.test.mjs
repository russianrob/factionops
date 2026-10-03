// The transport chip: says which transport is carrying events, and forces a
// fresh SSE connect when tapped.
//
// Why it exists: the startup watchdog gives SSE three tries and then hands the
// session to polling permanently. That cap is deliberate — a host whose GM
// shim cannot stream would otherwise retry a doomed request forever on
// battery — but it also pins a host that CAN stream to polling after one
// unlucky first connect, until the page is reloaded by hand. The warboard log
// shows 769 sse:true reports in a day with the same app alternating
// sse:true / sse:false between page loads.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const SRC = readFileSync('/opt/warboard/server/public/scripts/factionops.user.js', 'utf8');
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

function rig({ canSSE = true, token = 'jwt', connected = false, failures = 3 } = {}) {
  const calls = { connect: 0, abort: 0, stopStale: 0, cleared: 0 };
  const env = {
    sseConnected: connected,
    sseStartFailures: failures,
    sseRetryTimer: 1,
    sseAbort: { abort: () => { calls.abort++; } },
  };
  const src = [
    'let sseConnected = env.sseConnected, sseStartFailures = env.sseStartFailures;',
    'let sseRetryTimer = env.sseRetryTimer, sseAbort = env.sseAbort;',
    fn('forceSSEReconnect'), fn('transportLabel'),
    'globalThis.API={forceSSEReconnect,transportLabel,',
    '  peek:()=>({sseConnected,sseStartFailures,sseRetryTimer,sseAbort})};'
  ].join('\n');
  const api = new Function('env', 'state', 'canUseSSEStream', 'connectSSEStream',
    'stopSSEStaleWatch', 'clearTimeout', 'calls',
    src + '; return API;')(
    env, { jwtToken: token }, () => canSSE,
    () => { calls.connect++; }, () => { calls.stopStale++; },
    () => { calls.cleared++; }, calls);
  return { api, calls };
}

test('a tap clears the three strikes that made it give up', () => {
  // The whole point: the cap is evidence we collected, and a user pressing a
  // button is newer evidence. Leaving sseStartFailures at the cap means the
  // retry path refuses to run and the tap does nothing.
  const r = rig({ failures: 3 });
  assert.equal(r.api.forceSSEReconnect(), 'connecting');
  assert.equal(r.api.peek().sseStartFailures, 0, 'still capped — the retry will not fire');
  assert.equal(r.calls.connect, 1);
});

test('it cancels a pending retry instead of racing it', () => {
  const r = rig();
  r.api.forceSSEReconnect();
  assert.equal(r.calls.cleared, 1, 'a queued retry would fire a second stream');
  assert.equal(r.api.peek().sseRetryTimer, null);
});

test('it tears down the old request and its liveness timer', () => {
  // A half-open request left running delivers into a stream nobody reads, and
  // the stale-watch interval accumulates one timer per attempt.
  const r = rig();
  r.api.forceSSEReconnect();
  assert.equal(r.calls.abort, 1);
  assert.equal(r.calls.stopStale, 1);
  assert.equal(r.api.peek().sseAbort, null);
});

test('it reports why it cannot, instead of pretending', () => {
  assert.equal(rig({ canSSE: false }).api.forceSSEReconnect(), 'unavailable');
  assert.equal(rig({ token: '' }).api.forceSSEReconnect(), 'no-auth');
});

test('it does not connect when it cannot', () => {
  const a = rig({ canSSE: false }); a.api.forceSSEReconnect();
  assert.equal(a.calls.connect, 0);
  const b = rig({ token: '' }); b.api.forceSSEReconnect();
  assert.equal(b.calls.connect, 0, 'opened a stream with no token');
});

test('the label distinguishes the two transports', () => {
  assert.match(rig({ connected: true }).api.transportLabel().text, /SSE/);
  assert.equal(rig({ connected: true }).api.transportLabel().cls, 'is-sse');
  assert.match(rig({ connected: false }).api.transportLabel().text, /poll/);
  assert.equal(rig({ connected: false }).api.transportLabel().cls, 'is-poll');
});

// --- wiring --------------------------------------------------------------

test('a tap on a LIVE stream does not tear it down', () => {
  // Somebody will press it to see what it does. Reconnecting a working stream
  // would drop events for the seconds it takes to re-establish.
  const h = SRC.slice(SRC.indexOf('function setupTransportChip'),
                      SRC.indexOf('A Call control in the Score column'));
  assert.ok(h.length > 200, 'handler not found');
  const guard = h.indexOf('if (sseConnected)');
  const force = h.indexOf('forceSSEReconnect()');
  assert.ok(guard >= 0 && guard < force, 'reconnects without checking it is already live');
  assert.match(h, /already live/);
});

test('the chip is bound once, not per repaint', () => {
  // The filter bar is rebuilt whenever Torn re-renders the list; a handler
  // bound to the button would go with it, and binding per repaint would stack
  // listeners until one tap fired dozens of reconnects.
  const h = SRC.slice(SRC.indexOf('function setupTransportChip'),
                      SRC.indexOf('A Call control in the Score column'));
  assert.match(h, /__foRtChipBound/);
  assert.match(h, /document\.addEventListener/);
});

test('the chip waits out the startup watchdog before reporting', () => {
  // The watchdog gives the stream 12s. Settling the label sooner would show
  // "poll" on a stream that was still coming up.
  const h = SRC.slice(SRC.indexOf('function setupTransportChip'),
                      SRC.indexOf('A Call control in the Score column'));
  const m = /r === 'connecting' \? (\d+)/.exec(h);
  assert.ok(m, 'no settle delay found');
  assert.ok(Number(m[1]) > 12000, 'settles at ' + m[1] + 'ms, before the 12s watchdog');
});

test('a repaint does not stomp the transient message', () => {
  const p = fn('paintTransportChip');
  assert.match(p, /dataset\.busy/, 'the 5s repaint would overwrite "connecting..."');
});

test('the chip is in the filter bar and has an accessible name', () => {
  const bar = SRC.slice(SRC.indexOf("bar.className = 'fo-wp-filter'"),
                        SRC.indexOf("list.parentElement.insertBefore(bar, list)"));
  assert.match(bar, /id="fo-wp-rt"/);
  assert.match(bar, /aria-label="Realtime transport/);
  assert.ok(!/\btitle=/.test(bar), 'a title attribute is back on the filter bar');
});

test('it is styled for both states', () => {
  assert.match(SRC, /\.fo-wp-rt\.is-sse\s*\{/);
  assert.match(SRC, /\.fo-wp-rt\.is-poll\s*\{/);
});
