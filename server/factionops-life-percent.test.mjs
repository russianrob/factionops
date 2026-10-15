// The life-bar percentage on the attack page.
//
// Torn prints "1,698 / 7,383" and mid-fight that is arithmetic nobody has time
// for. The two things worth testing are not the division: they are that the
// pass is IDEMPOTENT (it appends its own output as a child, so a later pass
// must not read that back and stack "22% 22% 22%"), and that the rounding
// never lies at the two moments it matters -- a bar that is not quite full
// must not read 100%, and somebody still standing must not read 0%.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const SRC = readFileSync('/opt/warboard/server/public/scripts/factionops.user.js', 'utf8');

function grab(sig) {
  const i = SRC.indexOf(sig);
  assert.ok(i > 0, 'not found: ' + sig);
  let d = 0;
  for (let k = SRC.indexOf('{', i); k < SRC.length; k++) {
    if (SRC[k] === '{') d++;
    else if (SRC[k] === '}') { d--; if (!d) return SRC.slice(i, k + 1); }
  }
  throw new Error('unbalanced: ' + sig);
}

/** Just enough DOM for the real functions to run against. */
function rig() {
  const mkSpan = () => {
    const e = {
      tagName: 'SPAN', className: '', childNodes: [], children: [],
      style: { cssText: '', color: '' },
      classList: { contains: (c) => String(e.className).split(/\s+/).includes(c) },
      get textContent() {
        return e.childNodes.map((n) => (n.nodeType === 3 ? n.nodeValue : n.textContent)).join('');
      },
      set textContent(v) { e.childNodes = [{ nodeType: 3, nodeValue: v }]; },
      appendChild(c) { e.childNodes.push(c); e.children.push(c); c.parentElement = e; return c; },
      querySelector(sel) {
        const cls = sel.replace(':scope > .', '');
        return e.children.find((c) => c.classList && c.classList.contains(cls)) || null;
      },
    };
    return e;
  };
  let ALL = [];
  const document = {
    querySelectorAll: () => ALL,
    getElementById: () => null,
    querySelector: () => null,
    createElement: () => mkSpan(),
  };
  const fns = new Function('document', `
    ${grab('function hpOwnText(')}
    ${grab('function findLifeReadouts(')}
    ${grab('function hpColour(')}
    ${grab('function paintLifePercents(')}
    const HP_RE = /^([\\d,]+)\\s*\\/\\s*([\\d,]+)$/;
    const HP_CLASS = 'fo-hp-pct';
    return { hpOwnText, findLifeReadouts, hpColour, paintLifePercents };`)(document);

  const readout = (txt) => { const e = mkSpan(); e.childNodes = [{ nodeType: 3, nodeValue: txt }]; return e; };
  const shown = (e) => (e.children.length ? e.children[0].textContent : null);
  return { fns, readout, shown, put: (els) => { ALL = els; } };
}

test('a full bar reads 100%', () => {
  const r = rig(); const el = r.readout('7,383 / 7,383');
  r.put([el]); r.fns.paintLifePercents();
  assert.equal(r.shown(el), '100%');
});

test('IDEMPOTENT: repeated passes append once and do not stack', () => {
  // paintLifePercents appends a <span> INSIDE the readout. hpOwnText counts
  // text nodes only, so the readout keeps matching on later passes instead of
  // becoming "1,698 / 7,383 22%" and then failing to match at all.
  const r = rig(); const el = r.readout('1,698 / 7,383');
  r.put([el]);
  r.fns.paintLifePercents(); r.fns.paintLifePercents(); r.fns.paintLifePercents();
  assert.equal(el.children.length, 1, 'appended more than one tag');
  assert.equal(r.shown(el), '22%');          // 1698/7383 = 22.998%, floored
});

test('never says 100% while a single point is missing', () => {
  const r = rig(); const el = r.readout('7,382 / 7,383');
  r.put([el]); r.fns.paintLifePercents();
  assert.equal(r.shown(el), '99%');
});

test('never says 0% while they are still standing', () => {
  const r = rig(); const el = r.readout('1 / 7,383');
  r.put([el]); r.fns.paintLifePercents();
  assert.equal(r.shown(el), '1%');
});

test('0% only when actually down', () => {
  const r = rig(); const el = r.readout('0 / 7,383');
  r.put([el]); r.fns.paintLifePercents();
  assert.equal(r.shown(el), '0%');
});

test('both bars are handled independently', () => {
  const r = rig(); const mine = r.readout('7,383 / 7,383'), theirs = r.readout('2,000 / 8,000');
  r.put([mine, theirs]); r.fns.paintLifePercents();
  assert.equal(r.shown(mine), '100%');
  assert.equal(r.shown(theirs), '25%');
});

test('leaves anything that is not a life readout alone', () => {
  const r = rig();
  const els = ['Winguem', '0', '7,383', 'Level 42', ''].map(r.readout);
  r.put(els); r.fns.paintLifePercents();
  for (const e of els) assert.equal(e.children.length, 0, 'decorated ' + JSON.stringify(e.textContent));
});

test('a changed value updates in place rather than appending', () => {
  const r = rig(); const el = r.readout('7,383 / 7,383');
  r.put([el]); r.fns.paintLifePercents();
  // The fight lands a hit: Torn rewrites the text node, our span stays.
  el.childNodes[0].nodeValue = '3,000 / 7,383';
  r.fns.paintLifePercents();
  assert.equal(el.children.length, 1);
  assert.equal(r.shown(el), '40%');
});

test('colour bands: green healthy, amber wounded, red nearly down', () => {
  const { fns } = rig();
  assert.equal(fns.hpColour(100), '#6bd47f');
  assert.equal(fns.hpColour(51), '#6bd47f');
  assert.equal(fns.hpColour(50), '#f5d76e');
  assert.equal(fns.hpColour(21), '#f5d76e');
  assert.equal(fns.hpColour(20), '#ff6b6b');
  assert.equal(fns.hpColour(0), '#ff6b6b');
});
