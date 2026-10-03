// "Hide abroad" and a member in a foreign hospital.
//
// Reported with Hide abroad ticked and YaAvrageYank still listed, in a
// Canadian hospital. Measured against the live faction at the time: 30 of 79
// members were away-from-Torn (11 abroad, 10 traveling, 9 in a FOREIGN
// hospital) and the bar said "hiding 22 of 79" — the nine foreign-hospital
// members, to within one in-flight transition.
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

const away = new Function(fn('isAwayFromTorn') + '; return isAwayFromTorn;')();
const parse = new Function(fn('parseInterceptedMemberStatus') + '; return parseInterceptedMemberStatus;')();

// Status objects exactly as Torn returned them for faction 8205.
const LIVE = {
  foreignHosp: { state: 'Hospital', description: 'In a Canadian hospital for 1 mins ',
                 details: 'Attacked by LFCxAaronn', until: 1791020243 },
  tornHosp:    { state: 'Hospital', description: 'In hospital for 6 mins ', details: null, until: 1791020000 },
  abroad:      { state: 'Abroad', description: 'In Canada', details: null, until: null },
  traveling:   { state: 'Traveling', description: 'Traveling from Torn to South Africa', details: null, until: null },
  okay:        { state: 'Okay', description: 'Okay', details: null, until: null },
};

test('a foreign hospital counts as away from Torn', () => {
  assert.equal(away('hospital', LIVE.foreignHosp.description), true);
});

test('every foreign hospital Torn names, not just Canada', () => {
  // All nine seen on that roster, verbatim.
  for (const d of ['In a Canadian hospital for 4 mins ',
                   'In an Emirati hospital for 14 mins ',
                   'In a Mexican hospital for 2 hrs 24 mins ',
                   'In a Swiss hospital for 1 hrs 55 mins ',
                   'In a Hawaiian hospital for 1 hrs 59 mins',
                   'In a Caymanian hospital for 1 hrs 41 mins ']) {
    assert.equal(away('hospital', d), true, d);
  }
});

test('a Torn hospital does NOT count — those are hittable', () => {
  // The whole point of the filter is "nobody you can hit from Torn".
  for (const d of ['In hospital for 6 mins ', 'In hospital for 14 secs', 'In hospital']) {
    assert.equal(away('hospital', d), false, d);
  }
});

test('abroad and traveling count without needing a description', () => {
  assert.equal(away('abroad', ''), true);
  assert.equal(away('traveling', ''), true);
  assert.equal(away('travelling', ''), true);
});

test('okay never counts', () => {
  assert.equal(away('okay', 'Okay'), false);
  assert.equal(away('jail', 'In jail for 1 hr'), false);
});

// --- the plumbing, which is where it actually broke -----------------------

test('a hospital member carries its description through the parser', () => {
  // THE BUG: description was assigned only inside the traveling/abroad
  // branch, so a hospital member arrived with '' and isAwayFromTorn had an
  // empty string to test. Both halves worked; nothing connected them.
  const r = parse({ name: 'YaAvrageYank', level: 92, status: LIVE.foreignHosp });
  assert.equal(r.status, 'hospital');
  assert.equal(r.description, 'In a Canadian hospital for 1 mins ',
    'the description never reached the filter');
  assert.equal(away(r.status, r.description), true, 'still not hidden');
});

test('travel keeps the description it already had', () => {
  const r = parse({ name: 'Brai', status: LIVE.traveling });
  assert.equal(r.description, 'Traveling from Torn to South Africa');
  assert.equal(away(r.status, r.description), true);
});

test('a Torn-hospital member is parsed and still shown', () => {
  const r = parse({ name: 'Someone', status: LIVE.tornHosp });
  assert.equal(r.description, 'In hospital for 6 mins ');
  assert.equal(away(r.status, r.description), false);
});

test('the parser survives a member with no status at all', () => {
  assert.equal(parse({ name: 'X' }).description, '');
  assert.equal(parse(null), null);
});

test('the whole roster filters to the right count', () => {
  // 11 abroad + 10 traveling + 9 foreign-hospital = 30 of 79.
  const roster = []
    .concat(Array.from({ length: 11 }, () => LIVE.abroad))
    .concat(Array.from({ length: 10 }, () => LIVE.traveling))
    .concat(Array.from({ length: 9 }, () => LIVE.foreignHosp))
    .concat(Array.from({ length: 42 }, () => LIVE.tornHosp))
    .concat(Array.from({ length: 7 }, () => LIVE.okay));
  assert.equal(roster.length, 79);
  const hidden = roster
    .map((st) => parse({ status: st }))
    .filter((r) => away(r.status, r.description)).length;
  assert.equal(hidden, 30, 'was hiding 22 — the nine foreign-hospital rows stayed');
});

// --- the websocket path read a different field entirely -------------------

test('the WS handler uses description, never details', () => {
  // description is WHERE they are; details is WHY ("Attacked by X"), which
  // can never contain a country, so the foreign-hospital test could not pass.
  const ws = SRC.slice(SRC.indexOf('if (actions.updateStatus)'),
                       SRC.indexOf('// v5.1.10 (B): updateIcons'));
  assert.ok(ws.length > 200, 'updateStatus handler not found');
  assert.ok(!/entry\.description\s*=\s*String\(st\.details\)/.test(ws),
    'still assigning details as the description');
  assert.match(ws, /st\.description\s*\|\|\s*text/);
});

// --- the tooltips --------------------------------------------------------

test('the war-page filter bar carries no title attributes', () => {
  // Something on the page renders title as a tap-through callout, and on a
  // phone it covers the filter row you are trying to use.
  const bar = SRC.slice(SRC.indexOf("bar.className = 'fo-wp-filter'"),
                        SRC.indexOf("list.parentElement.insertBefore(bar, list)"));
  assert.ok(bar.length > 200, 'filter bar markup not found');
  assert.ok(!/\btitle=/.test(bar), 'a title attribute is still on the filter bar');
});

test('the controls keep an accessible name', () => {
  // Dropping title must not leave the icon buttons unlabelled.
  const bar = SRC.slice(SRC.indexOf("bar.className = 'fo-wp-filter'"),
                        SRC.indexOf("list.parentElement.insertBefore(bar, list)"));
  assert.match(bar, /id="fo-wp-clear"[^>]*aria-label="Clear"/);
  assert.match(bar, /aria-label="FactionOps settings"/);
});
