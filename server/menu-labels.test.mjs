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

// Entries that already say whose they are inside the label rather than in front of it, by
// file. The rule is that the name is there, so these stay as they are.
const NAMED_INSIDE = {
  'factionops.user.js': ['Open FactionOps war overlay'],
  'factionops-private.user.js': ['Open FactionOps war overlay'],
  'torn-refill-blood-bag-reminder.user.js': ['Blood Bag Settings'],
};

// The words of a name, letters and digits only, so "Item-Info" is two words.
const words = (text) => text.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);

// A label names its script when it starts "<name>: " and <name> is whole words from the
// script's @name, more of them than "Torn", which fits every script. A beta's entries say
// beta, since a beta can sit beside its stable script in one menu. So "RW Pricer: Set API
// key" fits "Torn RW Pricer".
function namesItsScript(label, scriptName) {
  const m = /^([^:]+): \S/.exec(label);
  if (!m) return false;
  const have = new Set(words(scriptName));
  const said = words(m[1]);
  if (!said.length || !said.every((word) => have.has(word))) return false;
  if (!said.some((word) => word !== 'torn')) return false;
  return !have.has('beta') || said.includes('beta');
}

// The labels a script's source passes as a string to GM_registerMenuCommand, or to a wrapper
// named *registerMenuCommand. A template string counts up to its first ${...}; a label held
// in a variable, or a template that starts with ${...}, can't be read here.
function labelsIn(src) {
  return [...src.matchAll(/registerMenuCommand\s*\(\s*(['"`])((?:\\.|(?!\1).)*)\1/g)]
    .map((m) => (m[1] === '`' ? m[2].split('${')[0] : m[2]))
    .filter(Boolean);
}

test('the rule itself: a name from @name, then a colon', () => {
  assert.equal(namesItsScript('RW Pricer: Set API key', 'Torn RW Pricer'), true);
  assert.equal(namesItsScript('Display Crime Chain: Set / update API key', 'TORN: Display Crime Chain'), true);
  assert.equal(namesItsScript('Set API key', 'Torn Xanax Reminder'), false, 'no name');
  assert.equal(namesItsScript('Gym Coach: Set API key', 'Torn Xanax Reminder'), false, 'another script\'s name');
  assert.equal(namesItsScript('Xanax Reminder:', 'Torn Xanax Reminder'), false, 'a name and nothing else');
  assert.equal(namesItsScript('RWP item-info diag: Run', 'RWP Item-Info Diag'), true, 'a hyphen splits words');
  assert.equal(namesItsScript('Torn: Set API key', 'Torn Xanax Reminder'), false, '"Torn" alone fits every script');
  assert.equal(namesItsScript('TORN: Set / update API key', 'TORN: Display Crime Chain'), false, '"TORN" alone too');
  assert.equal(namesItsScript('OC: Set key', 'Torn Foreign Stock'), false, 'whole words: "oc" is not "stock"');
  assert.equal(namesItsScript('FFS Banner Estimates: Enter Limited API Key', 'FFS Banner Estimates Beta'), false,
    'a beta sits beside its stable script in one menu, so its entries say beta');
  assert.equal(namesItsScript('FFS Banner Estimates Beta: Enter Limited API Key', 'FFS Banner Estimates Beta'), true);
});

test('labels are read with a space before the bracket, and a template up to its first ${', () => {
  const src = "GM_registerMenuCommand ('A: one', f);\n"
    + 'rD_registerMenuCommand("B: two", f);\n'
    + 'GM.registerMenuCommand(`C: three ${n}`, f);\n'
    + 'GM_registerMenuCommand(`${name}`, f);\n'
    + 'GM_registerMenuCommand(name, f);';
  assert.deepEqual(labelsIn(src), ['A: one', 'B: two', 'C: three ']);
});

for (const file of readdirSync(DIR).filter((f) => f.endsWith('.user.js')).sort()) {
  const src = readFileSync(new URL(file, DIR), 'utf8');
  const scriptName = ((src.match(/^\/\/ @name\s+(.+)$/m) || [])[1] || '').trim();
  const labels = labelsIn(src);
  if (!labels.length) continue;
  test(`${file}: every menu entry starts with the script's name`, () => {
    const allowed = NAMED_INSIDE[file] || [];
    const unnamed = labels.filter((label) => !namesItsScript(label, scriptName) && !allowed.includes(label));
    assert.deepEqual(unnamed, [], '@name ' + scriptName);
  });
}
