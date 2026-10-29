// FactionOps' energy on the attack page, the small number after your name: the
// pure parts lifted out of the script and driven with made-up readings. The
// reading is the bars FactionOps takes from Torn's API when the page opens, or
// Torn's own saved sidebar data once that changes while the page is open.
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
let lib = null;
function L() {
  if (lib) return lib;
  const names = ['sidebarEnergy', 'energyFollower', 'attackEnergyText'];
  lib = new Function(names.map(fn).join('\n') + '\nreturn { ' + names.join(', ') + ' };')();
  return lib;
}

// A sessionStorage with the given entries, in that order.
const store = (items) => ({ length: Object.keys(items).length, key: (i) => Object.keys(items)[i], getItem: (k) => items[k] });

test("Torn's saved energy is read from the first sidebarData<id> entry", () => {
  const side = { bars: { energy: { name: 'Energy', amount: 875, max: 150 } } };
  assert.deepEqual(L().sidebarEnergy(store({ sidebarDataundefined: '{}', sidebarData1000002: JSON.stringify(side) })), { current: 875, max: 150 });
  assert.equal(L().sidebarEnergy(store({})), null);
  assert.equal(L().sidebarEnergy(store({ sidebarData1000002: '{oops' })), null);
  assert.equal(L().sidebarEnergy(store({ sidebarData1000002: '{"bars":{}}' })), null);
  assert.equal(L().sidebarEnergy(store({ sidebarData1000002: '{"bars":{"energy":{"amount":"x","max":150}}}' })), null);
  assert.equal(L().sidebarEnergy(store({ sidebarData1000002: '{"bars":{"energy":{"amount":10,"max":0}}}' })), null);
  assert.equal(L().sidebarEnergy({ get length() { throw new Error('blocked'); } }), null);
  assert.equal(L().sidebarEnergy(null), null);   // the page's storage was blocked
});

test('the saved energy counts only once it changes on the page; until then the reading from the page opening stands', () => {
  const f = L().energyFollower();
  const api = { current: 875, max: 150 };
  assert.deepEqual(f.read(api, { current: 900, max: 150 }), api);   // an earlier page's copy
  assert.deepEqual(f.read(api, { current: 900, max: 150 }), api);
  assert.deepEqual(f.read(api, { current: 850, max: 150 }), { current: 850, max: 150 });   // Torn rewrote it: live
  assert.deepEqual(f.read({ current: 800, max: 150 }, { current: 850, max: 150 }), { current: 850, max: 150 });
  assert.deepEqual(f.read({ current: 800, max: 150 }, null), { current: 800, max: 150 });
});

test('no reading and no live sidebar is no number', () => {
  const f = L().energyFollower();
  assert.equal(f.read({ current: 0, max: 0 }, null), null);
  assert.equal(f.read({ current: 0, max: 0 }, { current: 900, max: 150 }), null);
  assert.deepEqual(f.read({ current: 0, max: 0 }, { current: 875, max: 150 }), { current: 875, max: 150 });
});

// U+26A1 alone, as the script writes it: with U+FE0F after it the strings
// differ though they look the same.
test('the number reads a lightning bolt and the energy with en-US commas, no max', () => {
  assert.equal(L().attackEnergyText({ current: 75, max: 150 }), '\u26A175');
  assert.equal(L().attackEnergyText({ current: 1050, max: 150 }), '\u26A11,050');
  assert.equal(L().attackEnergyText({ current: 0, max: 150 }), '\u26A10');
});
