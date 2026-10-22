// Every menu entry a served script registers names its script, as "<name>: <what it does>".
// The warboard app's menu lists every installed script's entries together, so an entry like
// "Set API key" on its own doesn't say whose it is (the owner's rule, 2026-10-22).
//
// Read from the source: each GM_registerMenuCommand, or a wrapper named *registerMenuCommand,
// called with a string. A label built at run time from a variable isn't checked here.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const DIR = new URL('./public/scripts/', import.meta.url);

// Entries that already say whose they are inside the label rather than in front of it. The
// rule is that the name is there, so these stay as they are.
const NAMED_INSIDE = new Set(['Open FactionOps war overlay', 'Blood Bag Settings']);

// A label names its script when it starts "<name>: " and every word of that name is in the
// script's @name, so "RW Pricer: Set API key" fits "Torn RW Pricer".
function namesItsScript(label, scriptName) {
  const m = /^([^:]+): \S/.exec(label);
  if (!m) return false;
  const have = scriptName.toLowerCase();
  return m[1].trim().toLowerCase().split(/\s+/).every((word) => have.includes(word));
}

test('the rule itself: a name from @name, then a colon', () => {
  assert.equal(namesItsScript('RW Pricer: Set API key', 'Torn RW Pricer'), true);
  assert.equal(namesItsScript('Display Crime Chain: Set / update API key', 'TORN: Display Crime Chain'), true);
  assert.equal(namesItsScript('Set API key', 'Torn Xanax Reminder'), false, 'no name');
  assert.equal(namesItsScript('Gym Coach: Set API key', 'Torn Xanax Reminder'), false, 'another script\'s name');
  assert.equal(namesItsScript('Xanax Reminder:', 'Torn Xanax Reminder'), false, 'a name and nothing else');
});

for (const file of readdirSync(DIR).filter((f) => f.endsWith('.user.js')).sort()) {
  const src = readFileSync(new URL(file, DIR), 'utf8');
  const scriptName = ((src.match(/^\/\/ @name\s+(.+)$/m) || [])[1] || '').trim();
  const labels = [...src.matchAll(/registerMenuCommand\(\s*(['"`])((?:\\.|(?!\1).)*)\1/g)]
    .map((m) => m[2])
    .filter((label) => !label.includes('${'));
  if (!labels.length) continue;
  test(`${file}: every menu entry starts with the script's name`, () => {
    const unnamed = labels.filter((label) => !namesItsScript(label, scriptName) && !NAMED_INSIDE.has(label));
    assert.deepEqual(unnamed, [], '@name ' + scriptName);
  });
}
