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

test('genocideFromHonors reads honor 478 and its date, and refuses anything that is not a list of honors', () => {
  assert.deepEqual(L().genocideFromHonors({ honors: [{ id: 12, timestamp: 1 }, { id: 478, timestamp: 1690000000 }] }),
    { has: true, at: 1690000000 });
  assert.deepEqual(L().genocideFromHonors({ honors: [{ id: 12, timestamp: 1 }] }), { has: false, at: null });
  assert.deepEqual(L().genocideFromHonors({ honors: [] }), { has: false, at: null });
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
  assert.match(L().genocideBadge({ has: true, via: 'self', at: 1690000000 }).title, /awarded 2023-07-22/);
  assert.match(L().genocideBadge({ has: true, via: 'self', at: null }).title, /^Genocide/);
  const no = L().genocideBadge({ has: false, checkedAt: 1700000000 });
  assert.equal(no.cls, 'fo-geno fo-geno-no');
  assert.match(no.title, /checked 2023-11-14/);
  // A missing date never throws.
  assert.equal(L().genocideBadge({ has: false }).cls, 'fo-geno fo-geno-no');
  assert.equal(L().genocideBadge(undefined), null);
});

// A faction info page as linkedom builds it: two member rows (one name inside
// an honor bar, one with two links to the same profile), a row with no
// profile link, and a profile link outside the member list.
function page() {
  return parseHTML(`<html><head></head><body>
    <div class="faction-description"><a href="/profiles.php?XID=1000003">Leader</a></div>
    <div class="members-list"><ul class="table-body">
      <li class="table-row"><div class="table-cell member"><div class="honor-text-wrap"><a href="/profiles.php?XID=1000001">A</a></div></div><div class="table-cell lvl">50</div></li>
      <li class="table-row"><div class="table-cell member"><a href="/profiles.php?XID=1000002"><img></a><a href="/profiles.php?XID=1000002">B</a></div><div class="table-cell lvl">40</div></li>
      <li class="table-row"><div class="table-cell member">nobody</div></li>
    </ul></div></body></html>`).document;
}

test('findGenocideRows: one entry per member row in the list, with its player id', () => {
  const d = page();
  assert.deepEqual(L().findGenocideRows(d).map((r) => r.id), ['1000001', '1000002']);
});

test('markGenocideRows: one mark per member row, kept in step with the list, never inside the honor bar', () => {
  const d = page();
  const members = {
    1000001: { has: true, via: 'hit', hit: 2500, start: 1700000000 },
    1000002: { has: true, via: 'self', at: 1690000000 },
    1000003: { has: true, via: 'self', at: 1690000000 },
  };
  assert.equal(L().markGenocideRows(d, members), 2);
  assert.equal(L().markGenocideRows(d, members), 2);
  assert.equal(d.querySelectorAll('.fo-geno').length, 2);
  assert.equal(d.querySelectorAll('.honor-text-wrap .fo-geno').length, 0);
  assert.equal(d.querySelectorAll('.faction-description .fo-geno').length, 0);
  const rows = d.querySelectorAll('li.table-row');
  assert.ok(rows[0].querySelector('.member > .fo-geno'));
  assert.equal(rows[1].querySelector('.fo-geno').getAttribute('title'), 'Genocide: awarded 2023-07-22');
  // A changed answer flips the mark in place.
  L().markGenocideRows(d, { ...members, 1000002: { has: false, checkedAt: 1700000000 } });
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
  // The switch: '1'/'0', a fresh check when on, the answer withdrawn when off.
  const h = SRC.slice(SRC.indexOf("getElementById('wb-toggle-share-genocide')"));
  const body = h.slice(0, h.indexOf('\n        }\n'));
  assert.match(body, /setConfig\('SHARE_GENOCIDE', e\.target\.checked \? '1' : '0'\)/);
  assert.match(body, /selfCheckGenocide\(Date\.now\(\)\)/);
  assert.match(body, /postAction\('\/api\/me\/honors', \{ genocide: null \}\)/);
});

test('the wiring: the check runs on sign-in with the member\'s own key, the marks start on factions.php only', () => {
  assert.match(fn('authenticate'),
    /try \{ startAttacksPoll\(\); \} catch \(_\) \{\}\n\s*try \{ selfCheckGenocide\(Date\.now\(\)\); \} catch \(_\) \{\}/);
  assert.match(SRC, /startEnergyPoll\(\);\n\s*startAttacksPoll\(\);\n\s*startGenocideMarks\(\);/);
  assert.match(fn('startGenocideMarks'), /window\.location\.pathname !== '\/factions\.php'/);
  const check = fn('selfCheckGenocide');
  assert.match(check, /CONFIG\.SHARE_GENOCIDE !== '1'/);
  assert.match(check, /!CONFIG\.API_KEY/);
  assert.match(check, /'https:\/\/api\.torn\.com\/v2\/user\/honors\?key=' \+ encodeURIComponent\(CONFIG\.API_KEY\)/);
  assert.match(check, /genocideCheckDue\(/);
  assert.match(check, /postAction\('\/api\/me\/honors', \{ genocide: answer\.has, awardedAt: answer\.at \}\)/);
  assert.match(fn('genocideTick'), /getAction\('\/api\/genocide'\)/);
});
