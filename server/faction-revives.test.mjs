// Runs the SHIPPED row-finding and badge code against the faction members
// markup, read live off Torn via remote-inspect.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseHTML } from 'linkedom';

const SRC = readFileSync('/opt/warboard/server/public/scripts/torn-faction-revives.user.js', 'utf8');
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

function mount(html, href) {
  const { document } = parseHTML(`<html><body>${html}</body></html>`);
  const src = [
    CONST('GROUPS'),
    fn('listRoot'), fn('isHospitalRow'), fn('badgeFor'),
    fn('placeFactionBadge'), fn('groupOf'), fn('buildGroups'), fn('renderList'),
    fn('uidFromAnchor'), fn('hospitalUids'),
    // buildGroups reads the module-level roster/results maps; the test owns them.
    'globalThis.API={listRoot,isHospitalRow,badgeFor,placeFactionBadge,',
    '  groupOf,buildGroups,renderList,hospitalUids,uidFromAnchor,GROUPS,roster,results};'
  ].join('\n');
  const f = new Function('document', 'location', 'roster', 'results',
    src + '; return API;');
  const roster = new Map(), results = new Map();
  return { document, roster, results, api: f(document, { href }, roster, results) };
}



test('a hospitalised row is recognised by its countdown', () => {
  const { document, api } = mount(FACTION, 'https://www.torn.com/factions.php');
  const anchors = [...document.querySelectorAll('a[href*="profiles.php?XID="]')];
  assert.equal(api.isHospitalRow(anchors[1]), true, 'the 10:28:50 row is in hospital');
  assert.equal(api.isHospitalRow(anchors[0]), false, 'an Okay row is not');
});

test('the badge is a glyph, not a word that would wrap the column', () => {
  // The position cell is 71px. A word per row would widen it, and in a
  // float-column layout widening one column drops the other.
  const { api } = mount(FACTION, 'https://www.torn.com/factions.php');
  const on = api.badgeFor(1);
  assert.ok(on.textContent.length <= 2, 'badge text was ' + JSON.stringify(on.textContent));
  assert.match(on.title, /Revives ON/i);
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
  const g = api.buildGroups(new Set());
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
  const g = api.buildGroups(new Set());
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
  const f = new Function('results', 'GM_getValue', 'CACHE_TTL_MS', 'CACHE_STORE',
    src + '; return API;');
  const cached = JSON.stringify({
    7: { revivable: 1, setting: 'Friends & faction', name: 'Bob', at: Date.now() }
  });
  f(results, () => cached, 3 * 3600 * 1000, 'faction_revive_cache').loadCache();
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

function roster_api(payload, { key = 'abc', reject = false } = {}) {
  const results = new Map(), roster = new Map();
  const calls = [];
  const src = [
    'let factionFetching = false, nextTryAt = 0;',
    fn('fetchFactionRoster'),
    'globalThis.API={fetchFactionRoster};'
  ].join('\n');
  const f = new Function(
    'results', 'roster', 'FACTION_TTL_MS', 'FAIL_RETRY_MS', 'resolveKey',
    'setText', 'fetch', 'saveCacheSoon', 'scan', 'updateStatus', 'encodeURIComponent',
    'Date',
    src + '; return API;');
  const clock = { t: 1_000_000, now: () => clock.t, tick: (ms) => { clock.t += ms; } };
  const api = f(results, roster, 300000, 60000, () => key, (t) => calls.push(t),
    (url) => { calls.push(url); return reject ? Promise.reject(new Error('net'))
                                             : Promise.resolve({ json: () => Promise.resolve(payload) }); },
    () => {}, () => {}, () => {}, encodeURIComponent, clock);
  return { api, results, roster, calls, clock };
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

// --- the whole chain ------------------------------------------------------

test('scan() badges every faction row from cached results', () => {
  // The unit tests cover each piece; this one covers the wiring, which is
  // where "87 badges exist and none are visible" actually lived.
  const { document } = parseHTML(`<html><body>${FACTION}</body></html>`);
  const results = new Map(), roster = new Map();
  results.set('1', { revivable: 1, setting: 'Everyone', name: 'RobinHood' });
  results.set('2', { revivable: 1, setting: 'Friends & faction', name: 'Deathy' });
  results.set('3', { revivable: 0, setting: 'No one', name: 'ZgiR' });

  const order = [];   // scan order is DOM order now; the list does the sorting
  const src = [
    fn('listRoot'), fn('isHospitalRow'),
    fn('badgeFor'), fn('placeFactionBadge'), fn('uidFromAnchor'),
    fn('applyToAnchor'), fn('scan'),
    'globalThis.API={scan};'
  ].join('\n');
  const f = new Function('document', 'location', 'results', 'roster',
    'fetchFactionRoster', 'updateStatus', 'order',
    instrument(src, 'placeFactionBadge(a, results.get(uid), uid);',
                'order.push(uid); placeFactionBadge(a, results.get(uid), uid);') +
    '; return API;');
  f(document, { href: 'https://www.torn.com/factions.php#/tab=members', hash: '#/tab=members' },
    results, roster, () => {}, () => {}, order).scan();

  const badges = [...document.querySelectorAll('[data-er="1"]')];
  assert.equal(badges.length, 3, 'one badge per row');
  for (const b of badges) {
    assert.ok(/positionCol/.test(b.parentElement.className),
      'badge rendered into ' + b.parentElement.className + ' -- that cell clips');
  }
  assert.deepEqual(order, ['1', '2', '3'], 'every row gets visited');

  const tone = (uid) => document.querySelector(`a[href*="XID=${uid}"]`)
    .closest('li').querySelector('[data-er="1"]').className;
  assert.ok(tone('1').includes('er-on'));
  assert.ok(tone('2').includes('er-fac'), 'Friends & faction got ' + tone('2'));
  assert.ok(tone('3').includes('er-off'));
});

test('scan() is idempotent -- 2s re-runs do not stack badges', () => {
  const { document } = parseHTML(`<html><body>${FACTION}</body></html>`);
  const results = new Map([['1', { revivable: 1, setting: 'Everyone' }]]);
  const src = [
    fn('listRoot'), fn('isHospitalRow'),
    fn('badgeFor'), fn('placeFactionBadge'), fn('uidFromAnchor'),
    fn('applyToAnchor'), fn('scan'), 'globalThis.API={scan};'
  ].join('\n');
  const api = new Function('document', 'location', 'results', 'roster',
    'fetchFactionRoster', 'updateStatus', src + '; return API;')(
    document, { href: 'https://www.torn.com/factions.php', hash: '' },
    results, new Map(), () => {}, () => {});
  api.scan(); api.scan(); api.scan();
  assert.equal(document.querySelectorAll('[data-er="1"]').length, 3);
});

test('hospitalised members sort to the top of their group, and are marked', () => {
  // A revivable member who is not in hospital does not need reviving, so
  // the ones who are belong at the top of the message.
  const { api, roster, results } = mount(FACTION, 'https://www.torn.com/factions.php');
  roster.set('1', 'Alice'); roster.set('2', 'Deathy'); roster.set('3', 'Zed');
  for (const u of ['1', '2', '3']) results.set(u, { revivable: 1, setting: 'Everyone' });
  const g = api.buildGroups(new Set(['3']));
  assert.deepEqual(g.everyone.map((x) => x.name), ['Zed', 'Alice', 'Deathy'],
    'the hospitalised one jumps the alphabet');
  const txt = api.renderList(g, { everyone: true, faction: false, none: false });
  assert.match(txt.split('\n')[0], /^\* Zed \[3\]$/, 'first line was ' + txt.split('\n')[0]);
  assert.ok(!/^\* Alice/m.test(txt), 'an Okay member must not be marked');
});

test('hospitalUids reads the countdown off the live rows', () => {
  // "Deathy10:28:50" -- the row text concatenates, so a \\b-anchored
  // countdown regex matches nothing at all.
  const { api } = mount(FACTION, 'https://www.torn.com/factions.php');
  assert.deepEqual([...api.hospitalUids()], ['2']);
});

// --- backoff --------------------------------------------------------------
//
// scan() fires every 2s. The old per-member queue had an explicit 60s pause
// for throttles and network failures; deleting the queue deleted that, and a
// failure path that does not stamp a retry time means 30 requests a minute
// against a key factionops and gym coach also use -- worst exactly when Torn
// is already throttling us.

const hits = (calls) => calls.filter((c) => String(c).startsWith('https://')).length;

test('an API error does not re-request on the very next scan', async () => {
  const { api, calls } = roster_api({ error: { code: 5, error: 'Too many requests' } });
  api.fetchFactionRoster(true);
  await new Promise((r) => setImmediate(r));
  for (let i = 0; i < 5; i++) { api.fetchFactionRoster(false); await new Promise((r) => setImmediate(r)); }
  assert.equal(hits(calls), 1, 'code 5 must back off, not hammer');
});

test('a non-JSON body (block page) backs off too', async () => {
  const { api, calls } = roster_api(null);
  api.fetchFactionRoster(true);
  await new Promise((r) => setImmediate(r));
  for (let i = 0; i < 5; i++) { api.fetchFactionRoster(false); await new Promise((r) => setImmediate(r)); }
  assert.equal(hits(calls), 1, 'an HTML block page means throttled, so stop');
});

test('a rejected fetch backs off and does not wedge the fetching flag', async () => {
  const { api, calls } = roster_api(V2, { reject: true });
  api.fetchFactionRoster(true);
  await new Promise((r) => setImmediate(r));
  for (let i = 0; i < 5; i++) { api.fetchFactionRoster(false); await new Promise((r) => setImmediate(r)); }
  assert.equal(hits(calls), 1, 'network failure must back off');
  // ...but a forced retry (the key button) must still work.
  api.fetchFactionRoster(true);
  await new Promise((r) => setImmediate(r));
  assert.equal(hits(calls), 2, 'the key button has to be able to retry');
});

test('the backoff is shorter than the success TTL', () => {
  // A failure should be retried sooner than a good answer is refreshed,
  // otherwise one blip costs five minutes of blank badges.
  const src = readFileSync('/opt/warboard/server/public/scripts/torn-faction-revives.user.js', 'utf8');
  const fail = /const FAIL_RETRY_MS\s*=\s*([\d *]+)/.exec(src);
  const ttl = /const FACTION_TTL_MS\s*=\s*([\d *]+)/.exec(src);
  assert.ok(fail && ttl, 'both intervals must be named constants');
  const val = (m) => m[1].split('*').reduce((a, b) => a * Number(b.trim()), 1);
  assert.ok(val(fail) < val(ttl), fail[1] + ' should be under ' + ttl[1]);
  assert.ok(val(fail) >= 30000, 'and at least 30s, or it is not a backoff');
});

test('a success holds for the full TTL, not just the failure backoff', async () => {
  // Without the success stamp the gate stays at the 60s backoff, so a
  // perfectly good roster gets re-fetched every minute instead of every
  // five -- five times the traffic on a shared key, invisibly.
  const { api, calls, clock } = roster_api(V2);
  api.fetchFactionRoster(true);
  await new Promise((r) => setImmediate(r));
  assert.equal(hits(calls), 1);

  clock.tick(90_000);                       // past the 60s backoff...
  api.fetchFactionRoster(false);
  await new Promise((r) => setImmediate(r));
  assert.equal(hits(calls), 1, '...but well inside the 5-minute TTL');

  clock.tick(5 * 60_000);
  api.fetchFactionRoster(false);
  await new Promise((r) => setImmediate(r));
  assert.equal(hits(calls), 2, 'past the TTL it refreshes');
});

test('a failure is retried after the backoff, not held for the full TTL', async () => {
  const { api, calls, clock } = roster_api({ error: { code: 5 } });
  api.fetchFactionRoster(true);
  await new Promise((r) => setImmediate(r));
  clock.tick(30_000);
  api.fetchFactionRoster(false);
  await new Promise((r) => setImmediate(r));
  assert.equal(hits(calls), 1, '30s is still inside the backoff');
  clock.tick(45_000);
  api.fetchFactionRoster(false);
  await new Promise((r) => setImmediate(r));
  assert.equal(hits(calls), 2, 'past 60s it tries again');
});

// --- compose hand-off -----------------------------------------------------
//
// Torn's compose page, as the screenshot shows it: a "Name" recipient box, a
// "Subject" box, then the body. The chat textarea is REAL and was confirmed
// live on index.php -- class textarea___JRbO5, placeholder "Type your message
// here..." -- and it is present on every Torn page including this one.
const COMPOSE = `
<div id="chatRoot"><div><textarea class="textarea___JRbO5" placeholder="Type your message here..."></textarea></div></div>
<div class="sendMessage">
  <h4>Send a Message</h4>
  <div class="input-row"><input type="text" name="player" placeholder="Name"></div>
  <div class="input-row"><input type="text" name="title" placeholder="Subject"></div>
  <div class="input-row">
    <div id="mce_0" contenteditable="true" class="editor-content mce-content-body editorContent___fi"></div>
    <textarea class="sourceArea___lGrOt hidden___xSXji"></textarea>
  </div>
</div>`;

// A hypothetical plain-textarea Torn, for the fallback path only.
const COMPOSE_PLAIN = COMPOSE
  .replace('<div id="mce_0" contenteditable="true" class="editor-content mce-content-body editorContent___fi"></div>', '')
  .replace('class="sourceArea___lGrOt hidden___xSXji"', 'name="message"');

// A source rewrite that matches nothing records nothing, which then reads as
// a production failure. Fail on the rewrite instead.
function instrument(src, from, to) {
  assert.ok(src.includes(from), 'instrumentation anchor is stale: ' + from);
  return src.replace(from, to);
}

function composeApi(html) {
  const { document, window } = parseHTML(`<html><body>${html}</body></html>`);
  // linkedom gives offsetParent/offsetWidth no values, so stand them in: the
  // production code uses them only to skip hidden and rank by area.
  for (const el of document.querySelectorAll('textarea, input, [contenteditable]')) {
    Object.defineProperty(el, 'offsetParent', { get: () => el.parentElement });
    Object.defineProperty(el, 'offsetWidth', { get: () => (el.closest('#chatRoot') ? 300 : 280) });
    Object.defineProperty(el, 'offsetHeight', { get: () => (el.closest('#chatRoot') ? 90 : 160) });
  }
  const store = {};
  const src = [
    'const COMPOSE_MAX_AGE = 3*60*1000;',
    fn('findComposeFields'), fn('setNativeValue'), fn('setRichValue'), fn('escapeHtml'),
    fn('toast'), fn('fillCompose'), fn('stashCompose'), fn('takeCompose'),
    'globalThis.API={findComposeFields,setNativeValue,setRichValue,fillCompose,stashCompose,takeCompose};'
  ].join('\n');
  const api = new Function('document', 'window', 'Event', 'GM_getValue', 'GM_setValue',
    'COMPOSE_STORE', 'setTimeout', src + '; return API;')(
    document, window, window.Event,
    (k, d) => (k in store ? store[k] : d), (k, v) => { store[k] = v; },
    'faction_revive_compose', () => {});
  return { document, api, store };
}

test('the body is the TinyMCE editor, NOT its hidden source buffer', () => {
  // This is the 2.1.0 bug exactly: the write landed in
  // textarea.sourceArea___lGrOt.hidden___xSXji, the subject filled, and the
  // visible body stayed blank. Confirmed live on the device.
  const { api } = composeApi(COMPOSE);
  const f = api.findComposeFields();
  assert.ok(f.body, 'no body found');
  assert.equal(f.rich, true, 'the editor is contenteditable, not a textarea');
  assert.equal(f.body.id, 'mce_0');
  assert.ok(!/sourceArea/.test(f.body.className || ''), 'picked the hidden buffer');
  assert.equal(f.subject.placeholder, 'Subject');
});

test('the body is never the faction chat box', () => {
  // textarea[placeholder*="message"] matches the chat box on every Torn page.
  const { api } = composeApi(COMPOSE);
  assert.ok(!api.findComposeFields().body.closest('#chatRoot'));
});

test('with no Subject anchor it still avoids chat and the source buffer', () => {
  const html = COMPOSE.replace('placeholder="Subject"', 'placeholder="Betreff"');
  const { api } = composeApi(html);
  const f = api.findComposeFields();
  assert.equal(f.body.id, 'mce_0', 'the editor is found without the subject anchor');
});

test('a plain-textarea compose page still works', () => {
  const { api, document } = composeApi(COMPOSE_PLAIN);
  const f = api.findComposeFields();
  assert.equal(f.rich, false);
  assert.equal(f.body.getAttribute('name'), 'message');
  api.fillCompose({ text: 'Alice [2]', n: 1 });
  assert.equal(document.querySelector('textarea[name="message"]').value, 'Alice [2]');
});

test('filling writes the list into the editor and a count into the subject', () => {
  const { api, document } = composeApi(COMPOSE);
  const ok = api.fillCompose({ text: 'Alice [2]\nBob [3]', n: 2 });
  assert.equal(ok, true);
  const ed = document.getElementById('mce_0');
  assert.equal(ed.innerHTML, 'Alice [2]<br>Bob [3]', 'newlines must become <br> in a contenteditable');
  assert.equal(ed.textContent, 'Alice [2]Bob [3]');
  assert.match(document.querySelector('input[name="title"]').value, /Revivable \(2\)/);
});

test('the editor write is announced, so TinyMCE syncs its model', () => {
  const { api, document } = composeApi(COMPOSE);
  const ed = document.getElementById('mce_0');
  const seen = [];
  ed.addEventListener('input', () => seen.push('input'));
  ed.addEventListener('change', () => seen.push('change'));
  api.setRichValue(ed, 'x');
  assert.deepEqual(seen, ['input', 'change'], 'TinyMCE never heard about it');
});

test('a name with angle brackets cannot inject markup into the editor', () => {
  const { api, document } = composeApi(COMPOSE);
  api.fillCompose({ text: '<img src=x onerror=1> [9]', n: 1 });
  const ed = document.getElementById('mce_0');
  assert.equal(ed.querySelectorAll('img').length, 0, 'raw HTML reached the editor');
  assert.match(ed.innerHTML, /&lt;img/);
});

test('a subject the user already typed is left alone', () => {
  const { api, document } = composeApi(COMPOSE);
  document.querySelector('input[name="title"]').value = 'Mine';
  api.fillCompose({ text: 'x', n: 1 });
  assert.equal(document.querySelector('input[name="title"]').value, 'Mine');
});

test('the recipient is never touched', () => {
  // A Torn mail takes one name and the list is many people; guessing one
  // would mail the wrong person.
  const { api, document } = composeApi(COMPOSE);
  api.fillCompose({ text: 'x', n: 1 });
  assert.equal(document.querySelector('input[name="player"]').value, '');
});

test('filling reports failure instead of pretending, when there is no form', () => {
  const { api } = composeApi('<div id="chatRoot"><textarea></textarea></div>');
  assert.equal(api.fillCompose({ text: 'x', n: 1 }), false,
    'the only textarea is the chat box, so there is nothing to fill');
});

test('the hand-off is one shot', () => {
  // A stash that survives its own use would paste itself into the next mail.
  const { api } = composeApi(COMPOSE);
  api.stashCompose('Alice [2]', 1);
  assert.equal(api.takeCompose().text, 'Alice [2]');
  assert.equal(api.takeCompose(), null, 'second read must be empty');
});

test('a stale hand-off is discarded, not pasted', () => {
  const { api, store } = composeApi(COMPOSE);
  store['faction_revive_compose'] =
    JSON.stringify({ text: 'old', n: 1, at: Date.now() - 10 * 60 * 1000 });
  assert.equal(api.takeCompose(), null, '10 minutes later is not this compose');
});

test('garbage in storage does not throw', () => {
  const { api, store } = composeApi(COMPOSE);
  store['faction_revive_compose'] = 'not json';
  assert.equal(api.takeCompose(), null);
  store['faction_revive_compose'] = JSON.stringify({ text: 'x' });   // no stamp
  assert.equal(api.takeCompose(), null);
});

test('setNativeValue bypasses React\'s value tracker, as React requires', () => {
  // React shadows `value` with an INSTANCE property wired to its own tracker.
  // A plain `el.value = x` hits that shadow, so React believes nothing
  // changed and throws the text away on the next render. The only way in is
  // the prototype setter. Model that shadow here, or the test cannot tell the
  // two apart -- a plain assignment passes a naive DOM shim perfectly.
  const { api, document } = composeApi(COMPOSE_PLAIN);
  const ta = document.querySelector('textarea[name="message"]');
  const proto = Object.getOwnPropertyDescriptor(
    Object.getPrototypeOf(ta).constructor.prototype, 'value');
  let swallowed = 0;
  Object.defineProperty(ta, 'value', {
    configurable: true,
    get: () => proto.get.call(ta),
    set: () => { swallowed++; }          // React's shadow: ignores the write
  });

  const seen = [];
  ta.addEventListener('input', () => seen.push('input'));
  ta.addEventListener('change', () => seen.push('change'));
  api.setNativeValue(ta, 'hello');

  assert.equal(swallowed, 0, 'went through React\'s shadow -- the text is lost');
  assert.equal(proto.get.call(ta), 'hello');
  assert.deepEqual(seen, ['input', 'change'], 'React never heard about it');
});

test('messages.php is routed to the compose fill, not the roster scan', () => {
  const src = readFileSync('/opt/warboard/server/public/scripts/torn-faction-revives.user.js', 'utf8');
  assert.match(src, /@match\s+https:\/\/www\.torn\.com\/messages\.php\*/);
  const boot = src.slice(src.indexOf('// ---- boot'));
  assert.match(boot, /messages\\\.php/, 'boot must branch on the page');
  assert.ok(boot.indexOf('runComposeFill') < boot.indexOf('setInterval(scan'),
    'the mail page must not start the 2s roster scan');
});

test('if TinyMCE fails to init, the real textarea wins over its source buffer', () => {
  // The editor div is absent but its hidden sourceArea is still in the DOM.
  // Writing that buffer is the 2.1.0 bug in another costume: the text lands
  // somewhere invisible and the mail goes out empty.
  const html = `
    <div id="chatRoot"><textarea class="textarea___JRbO5" placeholder="Type your message here..."></textarea></div>
    <div class="sendMessage">
      <input type="text" name="title" placeholder="Subject">
      <textarea class="sourceArea___lGrOt hidden___xSXji"></textarea>
      <textarea name="message"></textarea>
    </div>`;
  const { api, document } = composeApi(html);
  const f = api.findComposeFields();
  assert.equal(f.rich, false);
  assert.ok(!/sourceArea/.test(f.body.className || ''), 'picked the hidden buffer');
  assert.equal(f.body.getAttribute('name'), 'message');
  api.fillCompose({ text: 'Alice [2]', n: 1 });
  assert.equal(document.querySelector('textarea[name="message"]').value, 'Alice [2]');
  assert.equal(document.querySelector('textarea[class*="sourceArea"]').value, '',
    'the source buffer must be left alone');
});

// --- the tappable nudge ---------------------------------------------------

test('a revives-ON badge is a real link to that member\'s compose page', () => {
  // A real href (not a synthetic click) is what works in the PDA webview and
  // what keeps this a user-clicked navigation.
  const { api } = mount(FACTION, 'https://www.torn.com/factions.php');
  const b = api.badgeFor(1, 'Everyone', '3606647');
  assert.equal(b.tagName, 'A');
  assert.equal(b.getAttribute('href'),
    'https://www.torn.com/messages.php#/p=compose&XID=3606647');
  assert.equal(b.getAttribute('target'), '_blank');
  assert.equal(b.getAttribute('data-er-ask'), '3606647');
  assert.match(b.title, /tap to ask them to turn revives off/);
});

test('Friends & faction is askable too', () => {
  const { api } = mount(FACTION, 'https://www.torn.com/factions.php');
  assert.equal(api.badgeFor(1, 'Friends & faction', '7').tagName, 'A');
});

test('a revives-OFF badge is NOT a link', () => {
  // Asking someone whose revives are already off to turn them off is noise.
  const { api } = mount(FACTION, 'https://www.torn.com/factions.php');
  for (const [rev, set] of [[0, 'No one'], [null, 'Unknown'], [undefined, null]]) {
    const b = api.badgeFor(rev, set, '9');
    assert.equal(b.tagName, 'SPAN', 'tone ' + set + ' should not be tappable');
    assert.equal(b.getAttribute('data-er-ask'), null);
  }
});

test('without a uid the badge stays a span', () => {
  const { api } = mount(FACTION, 'https://www.torn.com/factions.php');
  assert.equal(api.badgeFor(1, 'Everyone', undefined).tagName, 'SPAN');
});

test('an unchanged badge is left in place, not replaced every 2s', () => {
  // scan() re-runs every 2s; swapping the element out from under a tap in
  // flight is how a link stops working on a phone.
  const { document, api } = mount(FACTION, 'https://www.torn.com/factions.php');
  const a = document.querySelector('a[href*="XID=1"]');
  api.placeFactionBadge(a, { revivable: 1, setting: 'Everyone' }, '1');
  const first = a.closest('li').querySelector('[data-er="1"]');
  api.placeFactionBadge(a, { revivable: 1, setting: 'Everyone' }, '1');
  api.placeFactionBadge(a, { revivable: 1, setting: 'Everyone' }, '1');
  assert.equal(a.closest('li').querySelector('[data-er="1"]'), first,
    'the badge element was swapped for an identical one');
});

test('a badge whose setting changed IS replaced', () => {
  const { document, api } = mount(FACTION, 'https://www.torn.com/factions.php');
  const a = document.querySelector('a[href*="XID=1"]');
  api.placeFactionBadge(a, { revivable: 1, setting: 'Everyone' }, '1');
  api.placeFactionBadge(a, { revivable: 0, setting: 'No one' }, '1');
  const b = a.closest('li').querySelectorAll('[data-er="1"]');
  assert.equal(b.length, 1);
  assert.equal(b[0].tagName, 'SPAN', 'it should have stopped being a link');
  assert.ok(b[0].className.includes('er-off'));
});

test('the nudge stashes the fixed subject and body', () => {
  const { api } = composeApi(COMPOSE);
  api.stashCompose('please turn your revives off :)', 0, 'Revives off');
  const got = api.takeCompose();
  assert.equal(got.subject, 'Revives off');
  assert.equal(got.text, 'please turn your revives off :)');
});

test('a stashed subject beats the revivable-count default', () => {
  const { api, document } = composeApi(COMPOSE);
  api.fillCompose({ text: 'please turn your revives off :)', n: 0, subject: 'Revives off' });
  assert.equal(document.querySelector('input[name="title"]').value, 'Revives off');
  assert.equal(document.getElementById('mce_0').textContent,
    'please turn your revives off :)');
});

test('the list hand-off still gets its counted subject', () => {
  const { api, document } = composeApi(COMPOSE);
  api.fillCompose({ text: 'Alice [2]', n: 1 });
  assert.match(document.querySelector('input[name="title"]').value, /Revivable \(1\)/);
});

test('the nudge text is what was asked for, verbatim', () => {
  const src = readFileSync('/opt/warboard/server/public/scripts/torn-faction-revives.user.js', 'utf8');
  assert.match(src, /NUDGE_SUBJECT\s*=\s*'Revives off'/);
  assert.match(src, /NUDGE_BODY\s*=\s*'please turn your revives off :\)'/);
});

// --- runComposeFill: the retry must not slander a fill that worked --------

function fillRunner(html, { fillOnFirstTry = true } = {}) {
  const { document, window } = parseHTML(`<html><body>${html}</body></html>`);
  for (const el of document.querySelectorAll('textarea, input, [contenteditable]')) {
    Object.defineProperty(el, 'offsetParent', { get: () => el.parentElement });
    Object.defineProperty(el, 'offsetWidth', { get: () => 280 });
    Object.defineProperty(el, 'offsetHeight', { get: () => 160 });
  }
  const store = { faction_revive_compose: JSON.stringify(
    { text: 'please turn your revives off :)', n: 0, subject: 'Revives off', at: Date.now() }) };
  const timers = [];
  const observers = [];
  class FakeObserver {
    constructor(cb) { this.cb = cb; observers.push(this); this.live = false; }
    observe() { this.live = true; }
    disconnect() { this.live = false; }
  }
  const toasts = [];
  const src = [
    'const COMPOSE_MAX_AGE = 3*60*1000, COMPOSE_WAIT_MS = 15000;',
    fn('findComposeFields'), fn('escapeHtml'), fn('setRichValue'), fn('setNativeValue'),
    fn('fillCompose'), fn('takeCompose'), fn('runComposeFill'),
    'globalThis.API={runComposeFill};'
  ].join('\n');
  const api = new Function('document', 'window', 'Event', 'GM_getValue', 'GM_setValue',
    'COMPOSE_STORE', 'setTimeout', 'MutationObserver', 'toast',
    src + '; return API;')(
    document, window, window.Event,
    (k, d) => (k in store ? store[k] : d), (k, v) => { store[k] = v; },
    'faction_revive_compose',
    (fn2, ms) => { timers.push({ fn: fn2, ms }); return timers.length; },
    FakeObserver,
    (msg, bad) => toasts.push({ msg, bad }));
  return { document, api, timers, observers, toasts };
}

const FORM_HTML = COMPOSE;
const EMPTY_HTML = '<div id="chatRoot"><textarea></textarea></div>';

test('a fill that succeeded on the first try never schedules a complaint', () => {
  const { api, timers, toasts, document } = fillRunner(FORM_HTML);
  api.runComposeFill();
  assert.equal(document.getElementById('mce_0').textContent, 'please turn your revives off :)');
  timers.forEach((t) => t.fn());
  assert.deepEqual(toasts, [], 'it filled the mail and then complained: ' + JSON.stringify(toasts));
});

test('a fill that succeeded on RETRY never complains either', () => {
  // This is the bug in the screenshot. The old guard asked the DOM whether a
  // toast was on screen; the success toast had already expired by the 15s
  // timeout, so a perfectly filled mail announced a failure.
  const { api, observers, timers, toasts, document } = fillRunner(EMPTY_HTML);
  api.runComposeFill();
  assert.equal(observers.length, 1, 'it should have started watching for the form');

  // the form renders late
  document.body.innerHTML += FORM_HTML;
  for (const el of document.querySelectorAll('textarea, input, [contenteditable]')) {
    Object.defineProperty(el, 'offsetParent', { get: () => el.parentElement });
    Object.defineProperty(el, 'offsetWidth', { get: () => 280 });
    Object.defineProperty(el, 'offsetHeight', { get: () => 160 });
  }
  observers[0].cb();
  assert.equal(document.getElementById('mce_0').textContent, 'please turn your revives off :)');
  assert.equal(observers[0].live, false, 'the observer should have stopped');

  timers.forEach((t) => t.fn());          // the 15s timeout still fires
  assert.deepEqual(toasts, [], 'complained about a fill that worked: ' + JSON.stringify(toasts));
});

test('a fill that never finds the form DOES say so', () => {
  const { api, timers, toasts } = fillRunner(EMPTY_HTML);
  api.runComposeFill();
  timers.forEach((t) => t.fn());
  assert.equal(toasts.length, 1);
  assert.equal(toasts[0].bad, true);
  assert.match(toasts[0].msg, /clipboard/);
});

test('with nothing stashed it does nothing at all', () => {
  const { api, timers, observers, toasts, document } = fillRunner(FORM_HTML);
  api.runComposeFill();        // drains the stash
  const before = document.getElementById('mce_0').innerHTML;
  api.runComposeFill();        // second arrival: stash is empty
  timers.forEach((t) => t.fn());
  assert.equal(observers.length, 0 + observers.length, 'no extra watchers');
  assert.deepEqual(toasts, []);
  assert.equal(document.getElementById('mce_0').innerHTML, before);
});

// --- where the status bar lives -------------------------------------------
//
// Page structure measured on-device 2026-10-02:
//   DIV.title-black.m-top10.titleToggle___S_IVi.faction-title  "Faction Description"
//   DIV.faction-info-wrap.restyle
//     DIV.wsr-inline            (another script's stat-report bar)
//     DIV.ffs-hide-bar          (another script's filter bar)
//     DIV.f-war-list.members-list
const INFO_PAGE = `
<div class="title-black m-top10 titleToggle___S_IVi faction-title">Faction Description</div>
<div class="faction-desc">   </div>
<div class="faction-info-wrap restyle">
  <div class="wsr-inline">Enemy Stat Report</div>
  <div class="ffs-hide-bar">Hide online</div>
  ${FACTION}
</div>`;

function statusApi(html) {
  const { document } = parseHTML(`<html><body>${html}</body></html>`);
  const src = [
    fn('listRoot'), fn('statusHome'), fn('ensureStatus'),
    'globalThis.API={statusHome,ensureStatus};'
  ].join('\n');
  const api = new Function('document', 'location', 'promptForKey', 'fetchFactionRoster',
    'openCopyPanel', src + '; return API;')(
    document, { href: 'https://www.torn.com/factions.php#/tab=info' },
    () => '', () => {}, () => {});
  return { document, api };
}

test('the bar docks directly under the Faction Description heading', () => {
  const { document, api } = statusApi(INFO_PAGE);
  api.ensureStatus();
  const bar = document.getElementById('er-status');
  assert.ok(bar, 'no status bar');
  const title = document.querySelector('.faction-title');
  assert.equal(title.nextElementSibling, bar, 'it is not under the heading');
  assert.ok(!bar.classList.contains('er-float'), 'it should not be floating');
  assert.equal(bar.parentElement.tagName, 'BODY');   // same level as the heading
});

test('the heading is matched on its unhashed token, not the build hash', () => {
  // titleToggle___S_IVi changes every Torn build.
  const src = readFileSync('/opt/warboard/server/public/scripts/torn-faction-revives.user.js', 'utf8');
  const home = src.slice(src.indexOf('function statusHome'), src.indexOf('function ensureStatus'));
  assert.ok(!/titleToggle___[A-Za-z0-9]/.test(home), 'a build hash was hardcoded');
  assert.match(home, /\.faction-title/);
});

test('with no heading it falls back INTO the info wrap', () => {
  const html = INFO_PAGE.replace('faction-title', 'faction-title-renamed');
  const { document, api } = statusApi(html);
  api.ensureStatus();
  const wrap = document.querySelector('.faction-info-wrap');
  assert.equal(wrap.firstElementChild.id, 'er-status');
});

test('with neither, it sits just above the member list', () => {
  const html = INFO_PAGE
    .replace('faction-title', 'x1').replace('faction-info-wrap', 'x2');
  const { document, api } = statusApi(html);
  api.ensureStatus();
  const list = document.querySelector('.members-list');
  assert.equal(list.previousElementSibling.id, 'er-status');
});

test('with no anchor at all it still shows, as a floating pill', () => {
  // Better a pill over the page than no status and no key button.
  const { document, api } = statusApi('<div>nothing familiar here</div>');
  api.ensureStatus();
  const bar = document.getElementById('er-status');
  assert.ok(bar, 'the bar vanished when the page was unfamiliar');
  assert.ok(bar.classList.contains('er-float'));
  assert.equal(bar.parentElement.tagName, 'BODY');
});

test('an already-placed bar is not re-inserted on every scan', () => {
  // scan() calls updateStatus() every 2s. Re-inserting a correctly placed
  // element kills any tap in flight, which reads as "the button does nothing".
  const { document, api } = statusApi(INFO_PAGE);
  const first = api.ensureStatus();
  let inserts = 0;
  const title = document.querySelector('.faction-title');
  const real = title.insertAdjacentElement.bind(title);
  title.insertAdjacentElement = (pos, el) => { inserts++; return real(pos, el); };
  api.ensureStatus(); api.ensureStatus(); api.ensureStatus();
  assert.equal(inserts, 0, 're-inserted ' + inserts + ' times for no reason');
  assert.equal(document.getElementById('er-status'), first);
});

test('a bar React tore out is put back', () => {
  const { document, api } = statusApi(INFO_PAGE);
  api.ensureStatus();
  document.getElementById('er-status').remove();
  api.ensureStatus();
  assert.equal(document.querySelector('.faction-title').nextElementSibling.id, 'er-status');
  assert.equal(document.querySelectorAll('#er-status').length, 1, 'duplicated');
});

test('the bar cannot widen its column', () => {
  // These float columns drop the next one if a child prefers more width than
  // the column has -- flex-wrap does not help, since a float uses the
  // PREFERRED width. width:0 + min-width:100% contributes nothing.
  const src = readFileSync('/opt/warboard/server/public/scripts/torn-faction-revives.user.js', 'utf8');
  const rule = /#er-status\{([^}]*)\}/.exec(src);
  assert.ok(rule, 'no #er-status rule');
  assert.match(rule[1], /width:0/);
  assert.match(rule[1], /min-width:100%/);
  assert.match(rule[1], /box-sizing:border-box/);
});
