// What a refused faction sees.
//
// startCallsOnlyMode draws the row furniture BEFORE authenticating, by design.
// So a faction the server refuses gets a drawn overlay a moment before the
// refusal lands — and it used to stay there: CALL buttons that look live,
// coordinate nothing, and never say why.
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

// A war list mid-flight: buttons drawn, one row taken, one row hidden by the
// filter — exactly the state auth lands into.
const DRAWN = `
<div id="fo-wp-filter"><button id="fo-wp-rt">poll</button></div>
<ul>
  <li class="enemy fo-called-row fo-called-mine">
    <div class="points___a fo-call-host"><div class="fo-wp-call">DROP</div></div>
  </li>
  <li class="enemy">
    <div class="points___a fo-call-host"><div class="fo-wp-call">CALL</div></div>
  </li>
  <li class="enemy" style="display:none">
    <div class="points___a fo-call-host"><div class="fo-wp-call">CALL</div></div>
  </li>
</ul>`;

function rig(html = DRAWN) {
  const { document } = parseHTML(`<html><body>${html}</body></html>`);
  const api = new Function('document', fn('teardownWarPageUi')
    + '; globalThis.API={teardownWarPageUi}; return API;')(document);
  return { document, api };
}

test('the refusal removes every call button', () => {
  const { document, api } = rig();
  assert.equal(document.querySelectorAll('.fo-wp-call').length, 3, 'fixture is wrong');
  api.teardownWarPageUi();
  assert.equal(document.querySelectorAll('.fo-wp-call').length, 0,
    'a dead CALL button survived the refusal');
});

test('it removes the filter bar and its transport chip', () => {
  const { document, api } = rig();
  api.teardownWarPageUi();
  assert.equal(document.getElementById('fo-wp-filter'), null);
  assert.equal(document.getElementById('fo-wp-rt'), null, 'the chip went with the bar');
});

test('it clears the row tint, including the mine variant', () => {
  const { document, api } = rig();
  api.teardownWarPageUi();
  assert.equal(document.querySelectorAll('.fo-called-row').length, 0);
  assert.equal(document.querySelectorAll('.fo-called-mine').length, 0);
  assert.equal(document.querySelectorAll('.fo-call-host').length, 0);
});

test('it un-hides rows the filter had hidden', () => {
  // Walking away while leaving rows hidden silently shortens the enemy list,
  // which is the worst way to fail — the page looks like Torn is missing
  // people rather than like our script bowed out.
  const { document, api } = rig();
  assert.equal([...document.querySelectorAll('li.enemy')].filter((r) => r.style.display === 'none').length, 1);
  api.teardownWarPageUi();
  assert.equal([...document.querySelectorAll('li.enemy')].filter((r) => r.style.display === 'none').length, 0,
    'a row stayed hidden after the overlay left');
});

test('teardown is idempotent and safe on a bare page', () => {
  // It runs from markCalledRows, which fires every 2s on an observer.
  const { api } = rig('<div>nothing here</div>');
  assert.doesNotThrow(() => { api.teardownWarPageUi(); api.teardownWarPageUi(); });
});

// --- the wiring ----------------------------------------------------------

test('markCalledRows refuses to draw once auth was rejected', () => {
  // Checked FIRST, before the li.enemy guard — otherwise the 2s observer and
  // the 5s pass redraw whatever the refusal just removed.
  const body = fn('markCalledRows');
  const guard = body.indexOf('_authRejected');
  assert.ok(guard >= 0, 'no rejection guard in markCalledRows');
  assert.ok(guard < body.indexOf("document.querySelector('li.enemy')"),
    'the guard runs after the page check — a redraw can beat it');
  assert.match(body.slice(guard, guard + 120), /teardownWarPageUi\(\);\s*return;/);
});

test('a 403 sets the flag, tears down, and tells the user', () => {
  const i = SRC.indexOf('if (res.status === 403)');
  assert.ok(i >= 0, 'no 403 branch in the auth handler');
  // Bounded at this branch's own `return reject`. A wider slice runs into the
  // 426 branch below, which has its own showToast — so deleting the 403 one
  // would still match.
  const wide = SRC.slice(i, i + 1200);
  const end = wide.indexOf('return reject');
  assert.ok(end > 0, 'the 403 branch never rejects');
  const branch = wide.slice(0, end);
  assert.match(branch, /_authRejected = true/);
  assert.match(branch, /teardownWarPageUi\(\)/);
  assert.match(branch, /showToast/, 'refused silently — no reason given');
  // (ordering is implicit now: everything asserted above sits before the reject)
});

test('the 403 branch runs before the 426 one', () => {
  // Both are non-2xx; whichever is tested first wins. They must not overlap.
  assert.ok(SRC.indexOf('if (res.status === 403)') < SRC.indexOf('if (res.status === 426)'));
});

test('the refusal message comes from the server, not a guess', () => {
  const i = SRC.indexOf('if (res.status === 403)');
  assert.match(SRC.slice(i, i + 400), /body && body\.error/,
    'should surface the server reason, with a fallback');
});
