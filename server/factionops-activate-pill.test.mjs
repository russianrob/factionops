// The "Activate FactionOps" pill, restored in 5.4.9 for the owner only.
//
// It was dropped in 5.4.3 because the war page carries what it opened. It is
// back because the overlay's only other door is GM_registerMenuCommand, which
// Torn's PDA does not have — so on a phone there was no way in at all.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseHTML } from 'linkedom';

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
function constOf(name) {
  const m = new RegExp('const ' + name + ' = (\\[[^\\]]*\\]);').exec(SRC);
  assert.ok(m, 'not found: const ' + name);
  return m[1];
}

function harness({ playerId = '', dev = '0', gmThrows = false } = {}) {
  const { document } = parseHTML('<html><body></body></html>');
  const state = { myPlayerId: playerId };
  const timers = [];
  const code = [
    'const ACTIVATE_PILL_UIDS = ' + constOf('ACTIVATE_PILL_UIDS') + ';',
    fn('activatePillAllowed'), fn('showActivateButton'), fn('maybeShowActivateButton'),
    'globalThis.API={activatePillAllowed,showActivateButton,maybeShowActivateButton};'
  ].join('\n');
  const api = new Function('document', 'state', 'GM_getValue', 'setTimeout', 'initWarOverlay',
    code + '; return API;')(
    document, state,
    (k, d) => { if (gmThrows) throw new Error('no GM here'); return k === 'factionops_dev' ? dev : d; },
    (f) => { timers.push(f); return timers.length; },
    () => { state.overlayOpened = true; });
  return { document, state, api, timers, run: () => { while (timers.length) timers.shift()(); } };
}

const OWNER = '137558';

test('the owner gets the pill', () => {
  const h = harness({ playerId: OWNER });
  h.api.maybeShowActivateButton();
  assert.ok(h.document.getElementById('fo-activate-btn'), 'no pill for the owner');
});

test('nobody else does', () => {
  // 126 people were on the previous build. The pill must cost them nothing.
  for (const id of ['3055230', '2407280', '3541994', '1']) {
    const h = harness({ playerId: id });
    h.api.maybeShowActivateButton();
    h.run();
    assert.equal(h.document.getElementById('fo-activate-btn'), null, 'pill shown to ' + id);
  }
});

test('the dev flag opens it without a rebuild', () => {
  const h = harness({ playerId: '999', dev: '1' });
  h.api.maybeShowActivateButton();
  assert.ok(h.document.getElementById('fo-activate-btn'));
});

test('the dev flag is off unless it is exactly "1"', () => {
  for (const v of ['0', '', 'false', 'true', 'yes']) {
    const h = harness({ playerId: '999', dev: v });
    h.api.maybeShowActivateButton();
    h.run();
    assert.equal(h.document.getElementById('fo-activate-btn'), null, 'dev=' + JSON.stringify(v) + ' let it through');
  }
});

test('a GM storage that throws does not kill the gate', () => {
  // PDA and some sandboxes. An unguarded GM_getValue would take the whole
  // init down with it, which is how the menu-command bug worked.
  const h = harness({ playerId: OWNER, gmThrows: true });
  assert.doesNotThrow(() => h.api.maybeShowActivateButton());
  assert.ok(h.document.getElementById('fo-activate-btn'), 'owner still gets it');
});

test('it waits for auth instead of deciding on an empty id', () => {
  // authenticate() is async and detectPageAndInit() can run first. Deciding
  // once on '' would mean the pill never appears for the one person meant to
  // see it.
  const h = harness({ playerId: '' });
  h.api.maybeShowActivateButton();
  assert.equal(h.document.getElementById('fo-activate-btn'), null, 'too early to show anything');
  assert.equal(h.timers.length, 1, 'it gave up instead of waiting');
  h.state.myPlayerId = OWNER;          // auth lands
  h.run();
  assert.ok(h.document.getElementById('fo-activate-btn'), 'it never came back after auth');
});

test('a known non-owner stops the poll immediately', () => {
  // Otherwise every other player runs a 250ms timer for ten seconds.
  const h = harness({ playerId: '3055230' });
  h.api.maybeShowActivateButton();
  assert.equal(h.timers.length, 0, 'it kept polling for someone it will never show');
});

test('the wait is bounded', () => {
  // A player who never authenticates must not poll forever.
  const h = harness({ playerId: '' });
  h.api.maybeShowActivateButton();
  let spins = 0;
  while (h.timers.length && spins < 500) { h.timers.shift()(); spins++; }
  assert.ok(spins < 100, 'polled ' + spins + ' times');
  assert.equal(h.timers.length, 0, 'still polling');
});

test('it never doubles up', () => {
  // detectPageAndInit runs again on SPA navigation, and deactivate re-offers.
  const h = harness({ playerId: OWNER });
  h.api.maybeShowActivateButton();
  h.api.maybeShowActivateButton();
  h.api.maybeShowActivateButton();
  assert.equal(h.document.querySelectorAll('#fo-activate-btn').length, 1);
  // And directly, which is how the 5.4.2 code called it and how anything
  // added later would reach for it -- the outer gate is not the only guard.
  h.api.showActivateButton();
  h.api.showActivateButton();
  assert.equal(h.document.querySelectorAll('#fo-activate-btn').length, 1,
    'showActivateButton stacked a second pill on top of the first');
});

test('clicking it opens the overlay and takes the pill away', () => {
  const h = harness({ playerId: OWNER });
  h.api.maybeShowActivateButton();
  h.document.getElementById('fo-activate-btn').click();
  assert.equal(h.state.overlayOpened, true, 'the overlay never opened');
  assert.equal(h.document.getElementById('fo-activate-btn'), null, 'the pill stayed up');
});

test('the pill is wired on faction/war pages and removed on attack pages', () => {
  const init = SRC.slice(SRC.indexOf('function detectPageAndInit'), SRC.indexOf('function initAttackPage'));
  assert.match(init, /maybeShowActivateButton\(\)/, 'never offered on the war page');
  const attack = SRC.slice(SRC.indexOf('function initAttackPage'));
  assert.match(attack.slice(0, 900), /fo-activate-btn/, 'not cleaned up on attack pages');
});

test('closing the overlay re-offers it', () => {
  const deact = SRC.slice(SRC.indexOf('function deactivateWarOverlay'));
  assert.match(deact.slice(0, 2000), /maybeShowActivateButton\(\)/,
    'closing the overlay is a one-way door again');
});

test('the CSS came back with it', () => {
  assert.match(SRC, /#fo-activate-btn \{/, 'the pill would render unstyled');
  assert.match(SRC, /#fo-activate-btn:hover/);
});
