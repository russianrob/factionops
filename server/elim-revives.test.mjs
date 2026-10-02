// Runs the SHIPPED row-finding and badge code against both page shapes,
// built from markup read live off Torn via remote-inspect.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseHTML } from 'linkedom';

const SRC = readFileSync('/opt/warboard/server/public/scripts/torn-elim-revives.user.js', 'utf8');
function fn(name) {
  const i = SRC.indexOf('function ' + name + '(');
  assert.ok(i >= 0, 'not found: ' + name);
  let d = 0;
  for (let j = SRC.indexOf('{', i); j < SRC.length; j++) {
    if (SRC[j] === '{') d++;
    else if (SRC[j] === '}' && --d === 0) return SRC.slice(i, j + 1);
  }
}

// Faction members tab, as the inspector reported it.
const FACTION = `<div class="f-war-list members-list m-top10"><ul class="table-body">
  <li class="table-row"><a href="/profiles.php?XID=1">RobinHood20.4b</a><span>Okay</span></li>
  <li class="table-row"><a href="/profiles.php?XID=2">Deathy55.2b</a><span>10:28:50</span></li>
  <li class="table-row"><a href="/profiles.php?XID=3">ZgiR1.12b</a><span>Okay</span></li>
</ul></div>`;
const ELIM = `<div class="teamPageWrapper___x">
  <a href="/profiles.php?XID=9">Someone</a></div>`;

function mount(html, href) {
  const { document } = parseHTML(`<html><body>${html}</body></html>`);
  const src = [
    fn('pageMode'), fn('listRoot'), fn('isHospitalRow'), fn('badgeFor'),
    'globalThis.API={pageMode,listRoot,isHospitalRow,badgeFor};'
  ].join('\n');
  const f = new Function('document', 'location', src + '; return API;');
  return { document, api: f(document, { href }) };
}

test('the faction members list is found by its own markup', () => {
  const { api } = mount(FACTION, 'https://www.torn.com/factions.php?step=your#/tab=members');
  assert.equal(api.pageMode(), 'faction');
  const root = api.listRoot();
  assert.ok(root, 'members list not found');
  assert.equal(root.querySelectorAll('a[href*="profiles.php?XID="]').length, 3);
});

test('the elimination page still works, unchanged', () => {
  const { api } = mount(ELIM, 'https://www.torn.com/page.php?sid=elimination#/team/5');
  assert.equal(api.pageMode(), 'elim');
  assert.ok(api.listRoot(), 'team wrapper not found');
});

test('a hospitalised row is recognised by its countdown', () => {
  const { document, api } = mount(FACTION, 'https://www.torn.com/factions.php');
  const anchors = [...document.querySelectorAll('a[href*="profiles.php?XID="]')];
  assert.equal(api.isHospitalRow(anchors[1]), true, 'the 10:28:50 row is in hospital');
  assert.equal(api.isHospitalRow(anchors[0]), false, 'an Okay row is not');
});

test('the faction badge is a glyph, not a word that would wrap the column', () => {
  const { api } = mount(FACTION, 'https://www.torn.com/factions.php');
  const on = api.badgeFor(1);
  assert.ok(on.className.includes('er-compact'));
  assert.ok(on.textContent.length <= 2, 'badge text was ' + JSON.stringify(on.textContent));
  assert.match(on.title, /Revives ON/i);
});

test('the elimination badge keeps its words', () => {
  const { api } = mount(ELIM, 'https://www.torn.com/page.php?sid=elimination');
  assert.match(api.badgeFor(1).textContent, /REVIVES ON/);
  assert.ok(!api.badgeFor(1).className.includes('er-compact'));
});

test('checked-and-off is distinguishable from not-yet-checked', () => {
  // "No badge for off" would make an unchecked member look safe to leave.
  const { api } = mount(FACTION, 'https://www.torn.com/factions.php');
  const off = api.badgeFor(0), unk = api.badgeFor(undefined);
  assert.notEqual(off.textContent, unk.textContent);
  assert.notEqual(off.className, unk.className);
  assert.match(unk.title, /not checked/i);
});
