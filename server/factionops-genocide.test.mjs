// FactionOps 5.6.29: Genocide marks on the faction info tab. Torn's Genocide
// honor is "a single hit that earns your faction 1,000 or more respect"; each
// member row gets a mark for holders, another for members confirmed not to
// hold it, and nothing when nobody knows. The pure parts are lifted out of the
// script and run with made-up members, the marks are driven on a linkedom
// page, and the wiring is checked in the text: the setting, the once-a-day
// check of the member's own honors, and where it all starts.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseHTML } from 'linkedom';

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
function konst(name) {
  const m = SRC.match(new RegExp('const ' + name + ' = ([^;]+);'));
  assert.ok(m, name + ' not found');
  return 'const ' + name + ' = ' + m[1] + ';\n';
}
let lib = null;
function L() {
  if (lib) return lib;
  const names = ['genocideFromHonors', 'genocideCheckDue', 'isFactionInfoTab', 'genocideDate', 'genocideBadge',
    'findGenocideRows', 'placeGenocideBadge', 'markGenocideRows', 'clearGenocideBadges'];
  lib = new Function(
    ['GENOCIDE_HONOR_ID', 'GENOCIDE_CHECK_MS', 'GENOCIDE_RETRY_MS', 'GENOCIDE_ROW_LINKS'].map(konst).join('')
    + names.map(fn).join('\n') + '\nreturn { ' + names.join(', ') + ' };')();
  return lib;
}

// ── The member's own honors ────────────────────────────────────────────

test('genocideFromHonors reads honor 478, and refuses anything that is not a list of honors', () => {
  assert.deepEqual(L().genocideFromHonors({ honors: [{ id: 12, timestamp: 1 }, { id: 478, timestamp: 1690000000 }] }), { has: true });
  assert.deepEqual(L().genocideFromHonors({ honors: [{ id: 12, timestamp: 1 }] }), { has: false });
  assert.deepEqual(L().genocideFromHonors({ honors: [] }), { has: false });
  // A Torn error, an empty answer, PDA's plain-string reply: no answer at all,
  // so nothing is posted and the hourly retry tries again.
  for (const d of [{ error: { code: 2, error: 'Incorrect key' } }, {}, null, 'Unauthorized', { honors: 'x' }]) {
    assert.equal(L().genocideFromHonors(d), null);
  }
});

test('genocideCheckDue: a day after the last answer that got through, and never twice in an hour', () => {
  const H = 3600000, now = 100 * 24 * H;
  assert.equal(L().genocideCheckDue(now, 0, 0), true);
  assert.equal(L().genocideCheckDue(now, now - 23 * H, 0), false);
  assert.equal(L().genocideCheckDue(now, now - 25 * H, now - 30 * 60000), false);
  assert.equal(L().genocideCheckDue(now, now - 25 * H, now - 2 * H), true);
});

// ── Where the marks go ─────────────────────────────────────────────────

test("isFactionInfoTab: your own faction's info tab only", () => {
  const t = (pathname, search, hash) => L().isFactionInfoTab({ pathname, search, hash });
  assert.equal(t('/factions.php', '?step=your&type=1', '#/tab=info'), true);
  for (const h of ['', '#', '#/']) assert.equal(t('/factions.php', '?step=your', h), true);
  assert.equal(t('/factions.php', '?step=your&type=1', '#/war/rank'), false);
  assert.equal(t('/factions.php', '?step=your', '#/tab=armoury'), false);
  assert.equal(t('/factions.php', '?step=yourself', ''), false);
  assert.equal(t('/factions.php', '?step=profile&ID=1', ''), false);
  assert.equal(t('/profiles.php', '?XID=1000001', ''), false);
  assert.equal(L().isFactionInfoTab(null), false);
});

test('genocideBadge: who has it and how, who is confirmed not to, nothing for unknown', () => {
  const hit = L().genocideBadge({ has: true, via: 'hit', hit: 2500, start: 1700000000 });
  assert.equal(hit.cls, 'fo-geno fo-geno-yes');
  assert.equal(hit.text, 'G');
  assert.match(hit.title, /2,500th hit/);
  assert.match(hit.title, /2023-11-14/);
  // A member's own answer is yes or no and nothing more: no dates.
  const self = L().genocideBadge({ has: true, via: 'self' });
  assert.equal(self.title, 'Genocide: from their own honors');
  const no = L().genocideBadge({ has: false });
  assert.equal(no.cls, 'fo-geno fo-geno-no');
  assert.equal(no.title, 'No Genocide yet: from their own honors');
  assert.equal(L().genocideBadge(undefined), null);
});

// A faction info page as linkedom builds it: two member rows (one name inside
// an honor bar, one with two links to the same profile and Torn's hashed
// column class), a row with no profile link, a member row with no position
// cell, and a profile link outside the member list.
function page() {
  return parseHTML(`<html><head></head><body>
    <div class="faction-description"><a href="/profiles.php?XID=1000003">Leader</a></div>
    <div class="members-list"><ul class="table-body">
      <li class="table-row"><div class="table-cell member"><div class="honor-text-wrap"><a href="/profiles.php?XID=1000001">A</a></div></div><div class="table-cell lvl">50</div><div class="table-cell position">Member</div></li>
      <li class="table-row"><div class="table-cell member"><a href="/profiles.php?XID=1000002"><img></a><a href="/profiles.php?XID=1000002">B</a></div><div class="table-cell lvl">40</div><div class="positionCol___x1y2z">Recruit</div></li>
      <li class="table-row"><div class="table-cell member">nobody</div></li>
      <li class="table-row"><div class="table-cell member"><a href="/profiles.php?XID=1000004">D</a></div><div class="table-cell lvl">30</div></li>
    </ul></div></body></html>`).document;
}

test('findGenocideRows: one entry per member row in the list, with its player id', () => {
  const d = page();
  assert.deepEqual(L().findGenocideRows(d).map((r) => r.id), ['1000001', '1000002', '1000004']);
});

// Measured on a device (Faction Revive Check 1.2.0): the name cell is
// overflow:hidden and clips whatever follows the honor bar, so a mark there
// is in the page and invisible. The position cell shows it.
test('the mark goes first in the position cell, never in the name cell, and a row without one gets none', () => {
  const d = page();
  const all = { 1000001: { has: true, via: 'self' }, 1000002: { has: false }, 1000004: { has: true, via: 'self' } };
  assert.equal(L().markGenocideRows(d, all), 2);
  const rows = d.querySelectorAll('li.table-row');
  assert.equal(rows[0].querySelector('.position').firstElementChild.className, 'fo-geno fo-geno-yes');
  assert.equal(rows[1].querySelector('.positionCol___x1y2z').firstElementChild.className, 'fo-geno fo-geno-no');
  assert.equal(d.querySelectorAll('.member .fo-geno').length, 0);
  assert.equal(rows[3].querySelector('.fo-geno'), null);
  assert.equal(L().markGenocideRows(d, all), 2);
  assert.equal(d.querySelectorAll('.fo-geno').length, 2);
});

test('markGenocideRows: one mark per member row, kept in step with the list, never inside the honor bar', () => {
  const d = page();
  const members = {
    1000001: { has: true, via: 'hit', hit: 2500, start: 1700000000 },
    1000002: { has: true, via: 'self' },
    1000003: { has: true, via: 'self' },
  };
  assert.equal(L().markGenocideRows(d, members), 2);
  assert.equal(L().markGenocideRows(d, members), 2);
  assert.equal(d.querySelectorAll('.fo-geno').length, 2);
  assert.equal(d.querySelectorAll('.honor-text-wrap .fo-geno').length, 0);
  assert.equal(d.querySelectorAll('.faction-description .fo-geno').length, 0);
  const rows = d.querySelectorAll('li.table-row');
  assert.ok(rows[0].querySelector('.position > .fo-geno'));
  assert.equal(rows[1].querySelector('.fo-geno').getAttribute('title'), 'Genocide: from their own honors');
  // A changed answer flips the mark in place.
  L().markGenocideRows(d, { ...members, 1000002: { has: false } });
  assert.equal(rows[1].querySelectorAll('.fo-geno').length, 1);
  assert.equal(rows[1].querySelector('.fo-geno').className, 'fo-geno fo-geno-no');
  // A member who drops off the list loses the mark.
  L().markGenocideRows(d, { 1000001: members[1000001] });
  assert.equal(rows[1].querySelector('.fo-geno'), null);
  L().clearGenocideBadges(d);
  assert.equal(d.querySelectorAll('.fo-geno').length, 0);
});

// ── The setting and the wiring ─────────────────────────────────────────

test('the setting: stored as a string, on unless the member turns it off', () => {
  const m = SRC.match(/\n\s*SHARE_GENOCIDE: ([^\n]+),\n/);
  assert.ok(m, 'CONFIG.SHARE_GENOCIDE not found');
  const read = (stored) => new Function('GM_getValue', 'return ' + m[1])((k, dflt) => (stored === undefined ? dflt : stored));
  assert.equal(read(undefined), '1');
  assert.equal(read('1'), '1');
  assert.equal(read('0'), '0');
  assert.match(SRC, /SHARE_GENOCIDE: 'factionops_share_genocide',/);
  // The row says what is read, with whose key, and what is shared.
  const at = SRC.indexOf('id="wb-toggle-share-genocide"');
  assert.ok(at > 0, 'the settings row is missing');
  const row = SRC.slice(at - 400, at + 600);
  assert.match(row, /Share whether I have Genocide with my faction/);
  assert.match(row, /Once a day/);
  assert.match(row, /your own key/);
  assert.match(row, /only yes or no/);
  // Each device keeps its own switch, so the member is told to use each one.
  assert.match(row, /per device/);
});

// The switch's change handler, lifted out of the settings panel.
function shareSwitch() {
  const at = SRC.indexOf("shareGenoEl.addEventListener('change', ");
  assert.ok(at > 0, 'the switch handler is missing');
  const start = SRC.indexOf('(e) => {', at);
  let d = 0;
  for (let j = SRC.indexOf('{', start); j < SRC.length; j++) {
    if (SRC[j] === '{') d++;
    else if (SRC[j] === '}' && --d === 0) return SRC.slice(start, j + 1);
  }
  throw new Error('the switch handler never closes');
}

test('the switch: off owes a withdrawal and asks for it at once; on clears it and checks afresh', () => {
  const gm = new Map(), set = [], checks = [];
  const flip = new Function('setConfig', 'GM_setValue', 'selfCheckGenocide', 'return ' + shareSwitch())(
    (k, v) => { set.push([k, v]); }, (k, v) => { gm.set(k, v); }, (now) => { checks.push(now); });
  flip({ target: { checked: false } });
  assert.deepEqual(set, [['SHARE_GENOCIDE', '0']]);
  assert.equal(gm.get('factionops_genocide_withdraw'), '1');
  assert.equal(checks.length, 1);
  flip({ target: { checked: true } });
  assert.deepEqual(set[1], ['SHARE_GENOCIDE', '1']);
  assert.equal(gm.get('factionops_genocide_withdraw'), '0');
  assert.equal(gm.get('factionops_genocide_ok'), '0');
  assert.equal(gm.get('factionops_genocide_try'), '0');
  assert.equal(checks.length, 2);
});

// selfCheckGenocide with its neighbours stubbed: the stored values, the call
// to Torn and the post to the server are all held here.
function selfCheck({ share = '1', stored = {}, post = () => Promise.resolve({}) } = {}) {
  const gm = new Map(Object.entries(stored));
  const CONFIG = { SHARE_GENOCIDE: share, API_KEY: 'TESTKEY' };
  const reqs = [], posts = [];
  const check = new Function('CONFIG', 'state', 'GM_getValue', 'GM_setValue', 'httpRequest', 'postAction', 'safeParse',
    ['GENOCIDE_HONOR_ID', 'GENOCIDE_CHECK_MS', 'GENOCIDE_RETRY_MS'].map(konst).join('')
    + ['genocideFromHonors', 'genocideCheckDue', 'selfCheckGenocide'].map(fn).join('\n') + '\nreturn selfCheckGenocide;')(
    CONFIG, { jwtToken: 'jwt' },
    (k, dflt) => (gm.has(k) ? gm.get(k) : dflt), (k, v) => { gm.set(k, v); },
    (o) => { reqs.push(o); },
    (p, b) => { posts.push([p, b]); return post(p, b); },
    (t) => { try { return JSON.parse(t); } catch (_) { return null; } });
  return { check, CONFIG, gm, reqs, posts };
}
const settle = () => new Promise((r) => setImmediate(r));
const HONORS = JSON.stringify({ honors: [{ id: 478, timestamp: 1690000000 }] });

test('a check already on its way posts nothing once sharing is switched off', async () => {
  const on = selfCheck();
  on.check(100 * 86400000);
  assert.equal(on.reqs.length, 1);
  on.reqs[0].onload({ responseText: HONORS });
  await settle();
  assert.deepEqual(on.posts, [['/api/me/honors', { genocide: true }]]);
  const off = selfCheck();
  off.check(100 * 86400000);
  off.CONFIG.SHARE_GENOCIDE = '0';
  off.reqs[0].onload({ responseText: HONORS });
  await settle();
  assert.deepEqual(off.posts, []);
});

test('switched off: the answer is withdrawn, and asked again at sign-in until the server takes it', async () => {
  // Refused: still owed, and Torn is never asked while sharing is off.
  let t = selfCheck({ share: '0', stored: { factionops_genocide_withdraw: '1' }, post: () => Promise.reject(new Error('HTTP 502')) });
  t.check(Date.now());
  await settle();
  assert.deepEqual(t.posts, [['/api/me/honors', { genocide: null }]]);
  assert.equal(t.gm.get('factionops_genocide_withdraw'), '1');
  assert.equal(t.reqs.length, 0);
  // Taken: nothing owed, and nothing posted the next time.
  t = selfCheck({ share: '0', stored: { factionops_genocide_withdraw: '1' } });
  t.check(Date.now());
  await settle();
  assert.equal(t.gm.get('factionops_genocide_withdraw'), '0');
  t.check(Date.now());
  await settle();
  assert.equal(t.posts.length, 1);
  // Never shared, nothing to withdraw.
  t = selfCheck({ share: '0' });
  t.check(Date.now());
  await settle();
  assert.deepEqual(t.posts, []);
});

// Members never open the overlay: factions.php runs the page set-up and then
// calls-only mode, so that set-up is where the marks have to start.
test('the marks start from the page set-up every member runs, and from nowhere else', () => {
  const names = ['log', 'initAttackPage', 'flushPendingAttack', 'registerOverlayMenuCommand', 'maybeShowActivateButton',
    'startCallsOnlyMode', 'createSettingsGear', 'startGenocideMarks'];
  const run = (href) => {
    const calls = [];
    new Function('window', 'document', ...names, fn('detectPageAndInit') + '\ndetectPageAndInit();')(
      { location: { href } }, { querySelector: () => ({}) }, ...names.map((n) => () => { calls.push(n); }));
    return calls;
  };
  const info = run('https://www.torn.com/factions.php?step=your&type=1#/tab=info');
  assert.ok(info.includes('startGenocideMarks'), 'factions.php never starts the marks');
  assert.ok(info.includes('startCallsOnlyMode'));
  assert.ok(!run('https://www.torn.com/page.php?sid=attack&user2ID=1000001').includes('startGenocideMarks'));
  assert.ok(!run('https://www.torn.com/index.php').includes('startGenocideMarks'));
  // One call site: the overlay does not start them a second way.
  const page = fn('detectPageAndInit'), at = SRC.indexOf(page);
  const sites = [...SRC.matchAll(/startGenocideMarks\(\)/g)].map((m) => m.index)
    .filter((i) => SRC.slice(i - 9, i) !== 'function ');
  assert.equal(sites.length, 1);
  assert.ok(sites[0] > at && sites[0] < at + page.length, 'the one call is not in detectPageAndInit');
});

test('the wiring: the check runs on sign-in with the member\'s own key, the marks start on factions.php only', () => {
  assert.match(fn('authenticate'),
    /try \{ startAttacksPoll\(\); \} catch \(_\) \{\}\n\s*try \{ selfCheckGenocide\(Date\.now\(\)\); \} catch \(_\) \{\}/);
  assert.match(fn('startGenocideMarks'), /window\.location\.pathname !== '\/factions\.php'/);
  const check = fn('selfCheckGenocide');
  assert.match(check, /CONFIG\.SHARE_GENOCIDE !== '1'/);
  assert.match(check, /!CONFIG\.API_KEY/);
  assert.match(check, /'https:\/\/api\.torn\.com\/v2\/user\/honors\?key=' \+ encodeURIComponent\(CONFIG\.API_KEY\)/);
  assert.match(check, /genocideCheckDue\(/);
  assert.match(check, /postAction\('\/api\/me\/honors', \{ genocide: answer\.has \}\)/);
  assert.doesNotMatch(SRC, /awardedAt/);
  assert.match(fn('genocideTick'), /getAction\('\/api\/genocide'\)/);
});
