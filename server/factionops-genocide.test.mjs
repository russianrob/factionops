// FactionOps 5.6.29: Genocide marks on the faction info tab. Torn's Genocide
// honor is "a single hit that earns your faction 1,000 or more respect"; each
// member row gets a mark for holders, another for members confirmed not to
// hold it, and nothing when nobody knows. The pure parts are lifted out of the
// script and run with made-up members, the marks are driven on a linkedom
// page, and the wiring is checked in the text: the setting, the check of the
// member's own honors (once, then monthly until it is a yes), and where it
// all starts.
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

test('genocideCheckDue: a yes taken for this faction is never asked again, a no a month on, anything else now, never twice in an hour', () => {
  const H = 3600000, D = 24 * H, now = 400 * D;
  const due = (lastOk, lastTry, saved) => L().genocideCheckDue(now, lastOk, lastTry, saved, '1001');
  assert.equal(due(0, 0, ''), true);
  assert.equal(due(now - 2 * D, 0, ''), true);              // updated from 5.6.29: no answer saved
  assert.equal(due(now - 365 * D, 0, '1:1001'), false);
  assert.equal(due(now - 29 * D, 0, '0:1001'), false);
  assert.equal(due(now - 31 * D, 0, '0:1001'), true);
  assert.equal(due(now - 2 * D, 0, '1:1002'), true);        // taken for another faction
  assert.equal(due(0, now - 30 * 60000, ''), false);
  assert.equal(due(now - 31 * D, now - 30 * 60000, '0:1001'), false);
});

test('genocideResendDue: an answer saved for this faction goes to the server again a day after it last went, nothing else does', () => {
  const H = 3600000, D = 24 * H, now = 400 * D;
  const due = new Function(konst('GENOCIDE_RESEND_MS') + fn('genocideResendDue') + '\nreturn genocideResendDue;')();
  const at = (lastSent, saved) => due(now, lastSent, saved, '1001');
  assert.equal(at(now - 25 * H, '1:1001'), true);
  assert.equal(at(now - 25 * H, '0:1001'), true);
  assert.equal(at(now - 23 * H, '1:1001'), false);
  assert.equal(at(0, '1:1001'), true);            // never timed: goes now
  assert.equal(at(0, ''), false);                 // nothing saved
  assert.equal(at(0, '1:1002'), false);           // saved for another faction
  assert.equal(due(now, 0, '1:', ''), false);     // no faction
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

// A faction info page as linkedom builds it, shaped like the real one read on
// a device (hashes and text made up): the name link inside the honor bar in
// the member cell, Faction Revive Check's badge already in the position cell,
// a row with two links to the same profile and only the hashed position
// class, a row with no profile link, a member row with no position cell, and
// a profile link outside the member list.
function page() {
  return parseHTML(`<html><head></head><body>
    <div class="faction-description"><a href="/profiles.php?XID=1000003">Leader</a></div>
    <div class="f-war-list members-list m-top10"><ul class="table-body">
      <li class="table-row"><div class="table-cell member icons membersCol___a1b2c"><div class="userInfoBox___d3e4f"><div class="honorWrap___g5h6i"><a class="linkWrap___j7k8l" href="/profiles.php?XID=1000001">A</a></div></div></div><div class="table-cell lvl lvlCol___m9n0p">50</div><div class="table-cell position positionCol___x1y2z"><span class="er-badge er-off">.</span><span class="ellipsis">Member</span></div></li>
      <li class="table-row"><div class="table-cell member icons membersCol___a1b2c"><a href="/profiles.php?XID=1000002"><img></a><a href="/profiles.php?XID=1000002">B</a></div><div class="table-cell lvl lvlCol___m9n0p">40</div><div class="positionCol___x1y2z"><span class="ellipsis">Recruit</span></div></li>
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
  const cell0 = rows[0].querySelector('.position'), kids0 = Array.from(cell0.children);
  assert.equal(kids0[0].className, 'fo-geno fo-geno-yes');
  // Ahead of the position text, beside Faction Revive Check's badge.
  assert.ok(kids0.indexOf(cell0.querySelector('.ellipsis')) > 0);
  assert.equal(cell0.querySelectorAll('.er-badge').length, 1);
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
  assert.equal(d.querySelectorAll('[class*="honorWrap"] .fo-geno').length, 0);
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
  assert.match(row, /once, then monthly until you have it/);
  assert.doesNotMatch(row, /Once a day/);
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
  assert.equal(gm.get('factionops_genocide_has'), '');
  assert.equal(gm.get('factionops_genocide_sent'), '0');
  assert.equal(checks.length, 2);
});

// selfCheckGenocide with its neighbours stubbed: the stored values, the call
// to Torn and the post to the server are all held here.
function selfCheck({ share = '1', stored = {}, post = () => Promise.resolve({}) } = {}) {
  const gm = new Map(Object.entries(stored));
  const CONFIG = { SHARE_GENOCIDE: share, API_KEY: 'TESTKEY' };
  const reqs = [], posts = [];
  const check = new Function('CONFIG', 'state', 'GM_getValue', 'GM_setValue', 'httpRequest', 'postAction', 'safeParse',
    ['GENOCIDE_HONOR_ID', 'GENOCIDE_CHECK_MS', 'GENOCIDE_RETRY_MS', 'GENOCIDE_RESEND_MS'].map(konst).join('')
    + ['genocideFromHonors', 'genocideCheckDue', 'genocideResendDue', 'selfCheckGenocide'].map(fn).join('\n') + '\nreturn selfCheckGenocide;')(
    CONFIG, { jwtToken: 'jwt', myFactionId: '1001' },
    (k, dflt) => (gm.has(k) ? gm.get(k) : dflt), (k, v) => { gm.set(k, v); },
    (o) => { reqs.push(o); },
    (p, b) => { posts.push([p, b]); return post(p, b); },
    (t) => { try { return JSON.parse(t); } catch (_) { return null; } });
  return { check, CONFIG, gm, reqs, posts };
}
const settle = () => new Promise((r) => setImmediate(r));
const HONORS = JSON.stringify({ honors: [{ id: 478, timestamp: 1690000000 }] });

test('a yes the server took is never asked of Torn again; a no is, a month on; a failed post saves nothing', async () => {
  // The last answer's time is stamped with the real clock, so these run on it.
  const H = 3600000, D = 24 * H, T = Date.now();
  // A yes: saved with the faction it went to, and Torn is never asked again.
  const yes = selfCheck();
  yes.check(T);
  yes.reqs[0].onload({ responseText: HONORS });
  await settle();
  assert.equal(yes.gm.get('factionops_genocide_has'), '1:1001');
  yes.check(T + 2 * H);
  yes.check(T + 400 * D);
  assert.equal(yes.reqs.length, 1);
  // A no: asked again a month on, and not before.
  const no = selfCheck();
  no.check(T);
  no.reqs[0].onload({ responseText: JSON.stringify({ honors: [{ id: 12, timestamp: 1 }] }) });
  await settle();
  assert.equal(no.gm.get('factionops_genocide_has'), '0:1001');
  no.check(T + 2 * D);
  assert.equal(no.reqs.length, 1);
  no.check(T + 31 * D);
  assert.equal(no.reqs.length, 2);
  // A post the server refused saves nothing, and the hourly retry asks again.
  const refused = selfCheck({ post: () => Promise.reject(new Error('HTTP 502')) });
  refused.check(T);
  refused.reqs[0].onload({ responseText: HONORS });
  await settle();
  assert.equal(refused.gm.has('factionops_genocide_has'), false);
  assert.equal(refused.gm.has('factionops_genocide_ok'), false);
  refused.check(T + 2 * H);
  assert.equal(refused.reqs.length, 2);
  // A device updated from 5.6.29: an answer went through two hours ago, but
  // none is saved, so it is asked once more and saved this time.
  const old = selfCheck({ stored: { factionops_genocide_ok: String(T - 2 * H), factionops_genocide_try: String(T - 2 * H) } });
  old.check(T);
  assert.equal(old.reqs.length, 1);
});

test('the saved answer goes to the server again once a day without asking Torn, so one the server lost comes back', async () => {
  const H = 3600000, D = 24 * H, T = Date.now();
  // A yes taken two days ago. Another device switched off and withdrew it,
  // or the server lost it: this device still shares, so it sends it again.
  const saved = (has) => ({ factionops_genocide_has: has, factionops_genocide_ok: String(T - 2 * D), factionops_genocide_try: String(T - 2 * D) });
  const yes = selfCheck({ stored: saved('1:1001') });
  yes.check(T);
  await settle();
  assert.deepEqual(yes.posts, [['/api/me/honors', { genocide: true }]]);
  // Once a day, not at every sign-in, and Torn is never asked.
  yes.check(T + 2 * H);
  await settle();
  assert.equal(yes.posts.length, 1);
  yes.check(T + 25 * H);
  await settle();
  assert.equal(yes.posts.length, 2);
  assert.equal(yes.reqs.length, 0);
  // A no goes again the same way until its month is up.
  const no = selfCheck({ stored: saved('0:1001') });
  no.check(T);
  await settle();
  assert.deepEqual(no.posts, [['/api/me/honors', { genocide: false }]]);
  assert.equal(no.reqs.length, 0);
  // One the server refused goes again at the next sign-in.
  const refused = selfCheck({ stored: saved('1:1001'), post: () => Promise.reject(new Error('HTTP 502')) });
  refused.check(T);
  await settle();
  refused.check(T + 60000);
  await settle();
  assert.equal(refused.posts.length, 2);
  // An answer read from Torn just now is not sent twice.
  const fresh = selfCheck();
  fresh.check(T);
  fresh.reqs[0].onload({ responseText: HONORS });
  await settle();
  fresh.check(T + 2 * H);
  await settle();
  assert.equal(fresh.posts.length, 1);
  // With sharing off nothing goes but a withdrawal.
  const off = selfCheck({ share: '0', stored: saved('1:1001') });
  off.check(T);
  await settle();
  assert.deepEqual(off.posts, []);
});

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
