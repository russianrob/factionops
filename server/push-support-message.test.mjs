// What the notifications card says, and where.
//
// Reported: "why does it say it doesn't have push when it does?" — the page
// was testing for WEB push (PushManager), which iOS withholds from every
// WKWebView, while the warboard app delivers its own notifications natively.
// The message was true about the browser, beside the point for the reader,
// and its advice ("add to Home Screen") is impossible inside an app.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseHTML } from 'linkedom';

const HTML = readFileSync('/opt/warboard/server/public/index.html', 'utf8');

// Lift the IIFE's BODY out of the page and run it against a stubbed
// environment. The body, not the whole IIFE — slicing to the function's
// closing brace drops the `)()` and leaves a syntax error.
function initSrc() {
  const i = HTML.indexOf('(function initPushNotifications() {');
  assert.ok(i >= 0, 'initPushNotifications not found');
  const start = HTML.indexOf('{', i);
  let d = 0;
  for (let j = start; j < HTML.length; j++) {
    if (HTML[j] === '{') d++;
    else if (HTML[j] === '}' && --d === 0) return HTML.slice(start + 1, j);
  }
  throw new Error('unbalanced');
}

const PANELS = `
<div id="notif-status"></div>
<div id="notif-unsupported" style="display:none"></div>
<div id="notif-in-app" style="display:none"></div>
<div id="notif-need-auth" style="display:none"></div>
<div id="notif-subscribed" style="display:none"></div>
<div id="notif-denied" style="display:none"></div>
<div id="notif-pwa-hint" style="display:none"></div>
<span id="notif-player-name"></span>
<input id="notif-api-key"><button id="notif-auth-btn"></button>
<p id="notif-auth-error"></p><button id="notif-unsubscribe-btn"></button>`;

function run({ push = true, sw = true, app = false, ios = true, standalone = false } = {}) {
  const { document, window } = parseHTML(`<html><body>${PANELS}</body></html>`);
  const win = {
    matchMedia: () => ({ matches: standalone }),
    navigator: { standalone: standalone },
    webkit: app ? { messageHandlers: { gmBridge: {} } } : undefined
  };
  if (push) win.PushManager = function () {};
  const nav = {
    userAgent: ios ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)' : 'Mozilla/5.0 (X11; Linux)',
    serviceWorker: sw ? { register: () => new Promise(() => {}) } : undefined
  };
  if (!sw) delete nav.serviceWorker;
  // `'serviceWorker' in navigator` must be false when unsupported.
  const navigatorObj = sw ? nav : Object.assign({}, { userAgent: nav.userAgent });

  new Function('document', 'window', 'navigator', 'localStorage', 'fetch', 'console',
    initSrc())(
    document, win, navigatorObj,
    { getItem: () => null, setItem: () => {}, removeItem: () => {} },
    () => new Promise(() => {}),
    { log() {}, error() {} });

  const vis = (id) => {
    const el = document.getElementById(id);
    return el && el.style.display !== 'none';
  };
  return { document, vis };
}

test('inside the warboard app it does NOT claim the browser is broken', () => {
  const r = run({ app: true, push: false, sw: false });
  assert.equal(r.vis('notif-unsupported'), false,
    'still telling the app its browser lacks push');
  assert.equal(r.vis('notif-in-app'), true, 'no in-app panel shown');
});

test('inside the app it does not give the impossible Home Screen advice', () => {
  // You cannot add a page to the Home Screen from inside an app.
  const r = run({ app: true, push: false, sw: false });
  assert.equal(r.vis('notif-pwa-hint'), false, 'told to add to Home Screen from inside an app');
});

test('iOS Safari without push still gets the real message and the hint', () => {
  // The old behaviour has to survive for the browser it was written for.
  const r = run({ app: false, push: false, sw: false, ios: true });
  assert.equal(r.vis('notif-unsupported'), true);
  assert.equal(r.vis('notif-pwa-hint'), true, 'the Home Screen hint is the useful part here');
  assert.equal(r.vis('notif-in-app'), false);
});

test('a desktop browser without push gets no iOS hint', () => {
  const r = run({ app: false, push: false, sw: false, ios: false });
  assert.equal(r.vis('notif-unsupported'), true);
  assert.equal(r.vis('notif-pwa-hint'), false);
});

test('a standalone iOS web app with push proceeds to the normal flow', () => {
  const r = run({ app: false, push: true, sw: true, ios: true, standalone: true });
  assert.equal(r.vis('notif-unsupported'), false);
  assert.equal(r.vis('notif-in-app'), false);
  assert.equal(r.vis('notif-pwa-hint'), false, 'already on the Home Screen');
});

test('the app wins even if a future iOS exposes PushManager in the web view', () => {
  // Subscribing there would be a SECOND pipeline beside the app's native one.
  // Saying so beats implying the app runs through this page.
  const r = run({ app: true, push: true, sw: true });
  assert.equal(r.vis('notif-in-app'), true);
  assert.equal(r.vis('notif-need-auth'), false, 'offered to enrol a device the app already covers');
});

test('the in-app panel says what is true, not what is missing', () => {
  const { document } = parseHTML(`<html><body>${HTML.slice(HTML.indexOf('<div id="notif-in-app"'), HTML.indexOf('<div id="notif-need-auth"'))}</body></html>`);
  const text = (document.getElementById('notif-in-app').textContent || '').replace(/\s+/g, ' ');
  assert.match(text, /handled by the warboard app/i);
  assert.ok(!/doesn't support/i.test(text), 'still framed as a missing capability');
  assert.ok(!/Add to Home Screen/i.test(text), 'still giving advice you cannot follow in an app');
  assert.match(text, /Safari/, 'should still point at where web push DOES work');
});

test('the app is detected by the same bridge factionops uses', () => {
  // If these two disagree about where they are running, one of them is wrong.
  assert.match(HTML, /window\.webkit\.messageHandlers\s*\n?\s*&&\s*window\.webkit\.messageHandlers\.gmBridge/);
  const fo = readFileSync('/opt/warboard/server/public/scripts/factionops.user.js', 'utf8');
  assert.match(fo, /window\.webkit\.messageHandlers\.gmBridge/);
});
