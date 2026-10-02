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

function CONST(name) {
  const i = SRC.indexOf('const ' + name + ' = [');
  assert.ok(i >= 0, 'not found: const ' + name);
  const end = SRC.indexOf('];', i);
  return SRC.slice(i, end + 2);
}

// Faction members tab, as the inspector reported it.
// Cell order and the hashed positionCol class are what the live inspector
// reported: member icons (153px) | lvl | ff | position (71px) | days | status.
const FACTION = `<div class="f-war-list members-list m-top10"><ul class="table-body">
  <li class="table-row"><div class="table-cell membersCol___a1"><a href="/profiles.php?XID=1">RobinHood20.4b</a></div><div class="table-cell positionCol___svL9F">Leader</div><span>Okay</span></li>
  <li class="table-row"><div class="table-cell membersCol___a1"><a href="/profiles.php?XID=2">Deathy55.2b</a></div><div class="table-cell positionCol___svL9F">Member</div><span>10:28:50</span></li>
  <li class="table-row"><div class="table-cell membersCol___a1"><a href="/profiles.php?XID=3">ZgiR1.12b</a></div><div class="table-cell positionCol___svL9F">Member</div><span>Okay</span></li>
</ul></div>`;
const ELIM = `<div class="teamPageWrapper___x">
  <a href="/profiles.php?XID=9">Someone</a></div>`;

function mount(html, href) {
  const { document } = parseHTML(`<html><body>${html}</body></html>`);
  const src = [
    CONST('GROUPS'),
    fn('pageMode'), fn('listRoot'), fn('isHospitalRow'), fn('badgeFor'),
    fn('placeFactionBadge'), fn('groupOf'), fn('buildGroups'), fn('renderList'),
    // buildGroups reads the module-level roster/results maps; the test owns them.
    'globalThis.API={pageMode,listRoot,isHospitalRow,badgeFor,placeFactionBadge,',
    '  groupOf,buildGroups,renderList,GROUPS,roster,results};'
  ].join('\n');
  const f = new Function('document', 'location', 'roster', 'results',
    src + '; return API;');
  const roster = new Map(), results = new Map();
  return { document, roster, results, api: f(document, { href }, roster, results) };
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

// --- 1.2.0: one roster call, three revive groups, position-cell badge ------

test('the badge lands in the position cell, where nothing clips it', () => {
  // The name cell is 153px with overflow:hidden around 163px of content, so
  // a badge appended there exists in the DOM and is invisible on screen.
  const { document, api } = mount(FACTION, 'https://www.torn.com/factions.php');
  const a = document.querySelector('a[href*="XID=1"]');
  api.placeFactionBadge(a, { revivable: 1, setting: 'Everyone' });
  assert.equal(a.closest('li').querySelectorAll('[data-er="1"]').length, 1);
  const badge = a.closest('li').querySelector('[data-er="1"]');
  assert.ok(/positionCol/.test(badge.parentElement.className),
    'badge went into ' + badge.parentElement.className);
});

test('re-badging a row replaces rather than stacks', () => {
  // scan() re-applies every 2s to survive React wiping the row.
  const { document, api } = mount(FACTION, 'https://www.torn.com/factions.php');
  const a = document.querySelector('a[href*="XID=1"]');
  for (let i = 0; i < 4; i++) api.placeFactionBadge(a, { revivable: 1, setting: 'Everyone' });
  assert.equal(a.closest('li').querySelectorAll('[data-er="1"]').length, 1);
});

test('Friends & faction is its own badge, not lumped in with Everyone', () => {
  // Treating it as plain "revives on" tells you to revive an enemy you
  // cannot actually revive.
  const { api } = mount(FACTION, 'https://www.torn.com/factions.php');
  const every = api.badgeFor(1, 'Everyone');
  const fac = api.badgeFor(1, 'Friends & faction');
  assert.notEqual(every.className, fac.className);
  assert.notEqual(every.textContent, fac.textContent);
  assert.match(fac.title, /Friends & faction/);
});

test('revive_setting beats the boolean when both are present', () => {
  const { api } = mount(FACTION, 'https://www.torn.com/factions.php');
  assert.ok(api.badgeFor(1, 'No one').className.includes('er-off'),
    'a No-one setting must not render as revivable');
});

test('groupOf reads the faction setting and the elimination boolean', () => {
  const { api } = mount(FACTION, 'https://www.torn.com/factions.php');
  assert.equal(api.groupOf({ setting: 'Everyone' }), 'everyone');
  assert.equal(api.groupOf({ setting: 'Friends & faction' }), 'faction');
  assert.equal(api.groupOf({ setting: 'No one' }), 'none');
  assert.equal(api.groupOf({ setting: 'Unknown', revivable: null }), null);
  assert.equal(api.groupOf({ revivable: 1 }), 'everyone');   // elimination page
  assert.equal(api.groupOf({ revivable: 0 }), 'none');
  assert.equal(api.groupOf(undefined), null);
});

test('buildGroups splits the roster and sorts each group by name', () => {
  const { api, roster, results } = mount(FACTION, 'https://www.torn.com/factions.php');
  roster.set('1', 'Zed'); roster.set('2', 'Alice'); roster.set('3', 'Bob'); roster.set('4', 'Carl');
  results.set('1', { revivable: 1, setting: 'Everyone' });
  results.set('2', { revivable: 1, setting: 'Everyone' });
  results.set('3', { revivable: 1, setting: 'Friends & faction' });
  results.set('4', { revivable: 0, setting: 'No one' });
  const g = api.buildGroups();
  assert.deepEqual(g.everyone.map((x) => x.name), ['Alice', 'Zed']);
  assert.deepEqual(g.faction.map((x) => x.name), ['Bob']);
  assert.deepEqual(g.none.map((x) => x.name), ['Carl']);
});

test('an unresolved member is in no group at all', () => {
  // Silently filing "not checked yet" under Not-revivable would read as a
  // finished answer.
  const { api, roster, results } = mount(FACTION, 'https://www.torn.com/factions.php');
  roster.set('1', 'Pending');
  results.set('1', { revivable: null, setting: 'Unknown' });
  const g = api.buildGroups();
  assert.equal(g.everyone.length + g.faction.length + g.none.length, 0);
});

test('Everyone is the only group selected by default', () => {
  const { api } = mount(FACTION, 'https://www.torn.com/factions.php');
  const on = api.GROUPS.filter((g) => g.on).map((g) => g.key);
  assert.deepEqual(on, ['everyone'],
    'Friends & faction defaults off -- on an enemy roster you cannot revive them');
});

test('one selected group pastes as a bare list, with no section header', () => {
  const { api } = mount(FACTION, 'https://www.torn.com/factions.php');
  const groups = { everyone: [{ name: 'Alice', uid: '2' }], faction: [], none: [] };
  const txt = api.renderList(groups, { everyone: true, faction: false, none: false });
  assert.equal(txt, 'Alice [2]');
});

test('two selected groups get labelled sections', () => {
  const { api } = mount(FACTION, 'https://www.torn.com/factions.php');
  const groups = {
    everyone: [{ name: 'Alice', uid: '2' }],
    faction: [{ name: 'Bob', uid: '3' }],
    none: []
  };
  const txt = api.renderList(groups, { everyone: true, faction: true, none: false });
  assert.match(txt, /^Everyone \(1\):\nAlice \[2\]/);
  assert.match(txt, /Friends & faction \(1\):\nBob \[3\]/);
  assert.ok(!/Not revivable/.test(txt), 'an unselected group must not appear');
  assert.ok(!/\n$/.test(txt), 'no trailing blank line to paste');
});

test('an empty selected group contributes no header', () => {
  const { api } = mount(FACTION, 'https://www.torn.com/factions.php');
  const groups = { everyone: [{ name: 'Alice', uid: '2' }], faction: [], none: [] };
  const txt = api.renderList(groups, { everyone: true, faction: true, none: true });
  assert.equal(txt, 'Alice [2]', 'with one non-empty group the list stays bare');
});

test('the cache round-trips revive_setting, not just the boolean', () => {
  // loadCache rebuilds each entry field by field, so a field it does not
  // name is dropped on the next page load -- and then every badge silently
  // falls back to the boolean and Friends & faction disappears as a group.
  const results = new Map();
  const store = {};
  const src = [fn('loadCache'), 'globalThis.API={loadCache};'].join('\n');
  const f = new Function('results', 'GM_getValue', 'CACHE_TTL_MS', src + '; return API;');
  const cached = JSON.stringify({
    7: { revivable: 1, setting: 'Friends & faction', name: 'Bob', at: Date.now() }
  });
  f(results, () => cached, 3 * 3600 * 1000).loadCache();
  assert.equal(results.get('7').setting, 'Friends & faction');
  assert.equal(store.unused, undefined);
});

// --- the roster call ------------------------------------------------------

// Shape recorded live from /v2/faction/members. v2 returns `members` as an
// array and does NOT html-escape names, unlike v1.
const V2 = {
  members: [
    { id: 11, name: 'Zed',   is_revivable: true,  revive_setting: 'Everyone' },
    { id: 12, name: "O'Hare", is_revivable: true, revive_setting: 'Friends & faction' },
    { id: 13, name: 'Carl',  is_revivable: false, revive_setting: 'No one' },
    { id: 14, name: 'Mystery', is_revivable: false, revive_setting: 'Unknown' }
  ]
};

function roster_api(payload, { key = 'abc' } = {}) {
  const results = new Map(), roster = new Map();
  const calls = [];
  const src = [
    'let factionFetching = false, factionFetchedAt = 0;',
    fn('fetchFactionRoster'),
    'globalThis.API={fetchFactionRoster};'
  ].join('\n');
  const f = new Function(
    'results', 'roster', 'FACTION_TTL_MS', 'resolveKey', 'setText', 'fetch',
    'saveCacheSoon', 'scan', 'updateStatus', 'encodeURIComponent',
    src + '; return API;');
  const api = f(results, roster, 300000, () => key, (t) => calls.push(t),
    (url) => { calls.push(url); return Promise.resolve({ json: () => Promise.resolve(payload) }); },
    () => {}, () => {}, () => {}, encodeURIComponent);
  return { api, results, roster, calls };
}

test('one call fills the whole roster with settings and names', async () => {
  const { api, results, roster, calls } = roster_api(V2);
  api.fetchFactionRoster(true);
  await new Promise((r) => setImmediate(r));
  assert.equal(calls.filter((c) => String(c).startsWith('https://')).length, 1,
    '87 members must cost ONE request, not 87');
  assert.match(String(calls[0]), /\/v2\/faction\/members/);
  assert.equal(roster.size, 4);
  assert.equal(results.get('12').setting, 'Friends & faction');
  assert.equal(results.get('12').name, "O'Hare");
  assert.equal(results.get('13').revivable, 0);
});

test('Unknown is left unresolved rather than counted as a No', async () => {
  const { api, results } = roster_api(V2);
  api.fetchFactionRoster(true);
  await new Promise((r) => setImmediate(r));
  assert.equal(results.get('14').revivable, null,
    'Unknown means we do not know -- not that revives are off');
});

test('the keyed-object form of members parses too', async () => {
  // v1-era and some v2 responses key members by id instead of listing them.
  const { api, results } = roster_api({
    members: { 21: { name: 'Keyed', revive_setting: 'Everyone' } }
  });
  api.fetchFactionRoster(true);
  await new Promise((r) => setImmediate(r));
  assert.equal(results.get('21').setting, 'Everyone');
});

test('a bad key tells the user instead of failing silently', async () => {
  const { api, calls } = roster_api({ error: { code: 2, error: 'Incorrect key' } });
  api.fetchFactionRoster(true);
  await new Promise((r) => setImmediate(r));
  assert.ok(calls.some((c) => /Invalid key/.test(String(c))), 'no message shown: ' + calls);
});

test('no key means no request at all', () => {
  const { api, calls } = roster_api(V2, { key: '' });
  api.fetchFactionRoster(true);
  assert.equal(calls.filter((c) => String(c).startsWith('https://')).length, 0);
  assert.ok(calls.some((c) => /API key/.test(String(c))));
});

test('a second call inside the TTL does not re-request', async () => {
  const { api, calls } = roster_api(V2);
  api.fetchFactionRoster(true);
  await new Promise((r) => setImmediate(r));
  api.fetchFactionRoster(false);
  await new Promise((r) => setImmediate(r));
  assert.equal(calls.filter((c) => String(c).startsWith('https://')).length, 1,
    'scan() runs every 2s -- without the TTL that is 30 calls a minute');
});
