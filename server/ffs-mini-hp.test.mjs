// FFS Banner Estimates Beta: the HP line in Torn's mini profile. The card shows
// no life of its own, so FFS asks Torn's API for the player's profile, at most
// once a minute per player, and writes "HP 1,234 / 5,678 (21%)" under its FF
// line. Runs the SHIPPED functions of the beta, lifted out by name. The script
// is read from this checkout's public/scripts, or from FFS_DIR when that names
// another folder.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseHTML } from 'linkedom';

const DIR = process.env.FFS_DIR || fileURLToPath(new URL('./public/scripts/', import.meta.url));
const SRC = readFileSync(join(DIR, 'ffs-banner-estimates-beta.user.js'), 'utf8');
const META = readFileSync(join(DIR, 'ffs-banner-estimates-beta.meta.js'), 'utf8');

// The source of one named function, found by counting braces from its name.
function fn(name) {
  const at = SRC.indexOf('function ' + name + '(');
  assert.ok(at >= 0, 'not found: ' + name);
  // Keep "async" when the function has it, or its awaits would not parse.
  const from = SRC.slice(at - 6, at) === 'async ' ? at - 6 : at;
  let depth = 0;
  for (let j = SRC.indexOf('{', at); j < SRC.length; j++) {
    if (SRC[j] === '{') depth++;
    else if (SRC[j] === '}' && --depth === 0) return SRC.slice(from, j + 1) + '\n';
  }
  throw new Error('unbalanced: ' + name);
}

// One `const NAME = ...;` as the script has it.
function konst(name) {
  const m = SRC.match(new RegExp('const ' + name + ' = [^;]+;'));
  assert.ok(m, 'not found: const ' + name);
  return m[0] + '\n';
}

const NOW = Date.UTC(2026, 9, 27, 12, 0, 0);
// Life as Torn's v2 profile gives it, and a whole answer around it; made-up numbers.
const LIFE = { current: 1234, maximum: 5678 };
const answerWith = (life) => ({ profile: { id: 1000001, name: 'Target', life } });

// ── the line ──

// ffs_hpLine as the beta has it, lifted at each call so a missing one fails its own test.
const hpLine = (life) => new Function(fn('ffs_hpLine') + 'return ffs_hpLine;')()(life);

test('the HP line reads as the attack page does, with the percentage after', () => {
  assert.equal(hpLine({ current: 1234, maximum: 5678 }), 'HP 1,234 / 5,678 (21%)');
  assert.equal(hpLine({ current: 7500, maximum: 7500 }), 'HP 7,500 / 7,500 (100%)');
  assert.equal(hpLine({ current: 123456789, maximum: 123456789 }), 'HP 123,456,789 / 123,456,789 (100%)');
});

test('the percentage is floored, as on the attack page: 100% only when full, 0% only when down', () => {
  assert.equal(hpLine({ current: 7499, maximum: 7500 }), 'HP 7,499 / 7,500 (99%)');
  assert.equal(hpLine({ current: 1, maximum: 7500 }), 'HP 1 / 7,500 (1%)');
  assert.equal(hpLine({ current: 0, maximum: 7500 }), 'HP 0 / 7,500 (0%)');
});

test('life that Torn did not give as numbers makes no line', () => {
  for (const life of [undefined, null, {}, { current: 1234 }, { maximum: 5678 },
    { current: '1234', maximum: 5678 }, { current: 1234, maximum: 0 }, { current: -1, maximum: 5678 },
    { current: NaN, maximum: 5678 }, { current: 1234, maximum: Infinity }]) {
    assert.equal(hpLine(life), null, String(JSON.stringify(life)));
  }
});

// ── asking Torn ──

// A request Torn never answers.
const SILENT = Symbol('silent');

// ffs_miniHp as the beta has it, with the key the script keeps, its refusal
// stand-down, a clock the test moves, and Torn played by `answer(url)`: a body,
// an Error for a request that fails, or SILENT for one that is never answered.
function torn({ key = 'k+1', answer = () => answerWith(LIFE) } = {}) {
  const t = { now: NOW, calls: [], timers: [], cleared: 0 };
  const fetchStub = (url) => {
    t.calls.push(url);
    const a = answer(url);
    if (a === SILENT) return new Promise(() => {});
    if (a instanceof Error) return Promise.reject(a);
    return Promise.resolve({ json: () => Promise.resolve(a) });
  };
  const setTimeoutStub = (f, ms) => t.timers.push({ f, ms });
  const clearStub = () => { t.cleared += 1; };
  const api = new Function('fetch', 'Date', 'setTimeout', 'clearTimeout', 'keyIn',
    'let key = keyIn;\nlet _ffsRateLimitedUntil = 0;\n'
    + konst('FFS_RATE_LIMIT_BACKOFF_MS') + konst('FFS_REFUSAL_CODES')
    + konst('FFS_MINI_HP_TTL_MS') + konst('FFS_MINI_HP_TIMEOUT_MS') + konst('_ffsMiniHp')
    + konst('FFS_MINI_HP_MAX_PER_MIN') + konst('_ffsMiniHpCalls')
    + fn('ffs_isRateLimitError') + fn('ffs_hpLine') + fn('ffs_fetchLife') + fn('ffs_miniHp')
    + 'return { ffs_miniHp, limited: () => _ffsRateLimitedUntil, refuseUntil: (ms) => { _ffsRateLimitedUntil = ms; } };',
  )(fetchStub, { now: () => t.now }, setTimeoutStub, clearStub, key);
  return Object.assign(t, api);
}

test('a card asks Torn once, for the profile, on the script key, with a cache-buster', async () => {
  const t = torn();
  assert.deepEqual(await t.ffs_miniHp(1000001), LIFE);
  assert.deepEqual(t.calls, [`https://api.torn.com/v2/user/1000001/profile?striptags=true&timestamp=${NOW}&key=k%2B1`]);
});

test('the same player again within a minute is free; a minute on, Torn is asked again', async () => {
  const t = torn();
  await t.ffs_miniHp(1000001);
  t.now = NOW + 59_999;
  assert.deepEqual(await t.ffs_miniHp(1000001), LIFE);
  assert.equal(t.calls.length, 1);
  t.now = NOW + 60_000;
  assert.deepEqual(await t.ffs_miniHp(1000001), LIFE);
  assert.equal(t.calls.length, 2);
});

test('two cards for one player while Torn is being asked share the one call', async () => {
  const t = torn();
  const [a, b] = await Promise.all([t.ffs_miniHp(1000001), t.ffs_miniHp(1000001)]);
  assert.deepEqual(a, LIFE);
  assert.deepEqual(b, LIFE);
  assert.equal(t.calls.length, 1);
  await t.ffs_miniHp(1000002);
  assert.equal(t.calls.length, 2, 'another player has a call of their own');
});

test('at most 20 calls to Torn in any minute, however many players are opened', async () => {
  const t = torn();
  t.now = NOW + 30_000;
  for (let id = 1000001; id <= 1000025; id++) await t.ffs_miniHp(id);
  assert.equal(t.calls.length, 20);
  t.now = NOW + 60_000;
  assert.equal(await t.ffs_miniHp(1000026), null, 'half a minute on, still over the limit: no line');
  assert.deepEqual(await t.ffs_miniHp(1000001), LIFE, 'a kept answer is still shown');
  assert.equal(t.calls.length, 20);
  t.now = NOW + 90_000;
  assert.deepEqual(await t.ffs_miniHp(1000026), LIFE);
  assert.equal(t.calls.length, 21);
});

test('with no key set, nothing is asked and there is no line', async () => {
  for (const key of ['', null]) {
    const t = torn({ key });
    assert.equal(await t.ffs_miniHp(1000001), null);
    assert.equal(t.calls.length, 0);
  }
});

test('while Torn is refusing the key, nothing is asked', async () => {
  const t = torn();
  t.refuseUntil(NOW + 1);
  assert.equal(await t.ffs_miniHp(1000001), null);
  assert.equal(t.calls.length, 0);
});

test('a refusal stands every Torn call here down for a minute; other errors do not', async () => {
  for (const code of [5, 8, 9]) {
    const t = torn({ answer: () => ({ error: { code, error: 'refused' } }) });
    assert.equal(await t.ffs_miniHp(1000001), null);
    assert.equal(t.limited(), NOW + 60_000, 'code ' + code);
  }
  for (const code of [2, 6, 16]) {
    const t = torn({ answer: () => ({ error: { code, error: 'not this' } }) });
    assert.equal(await t.ffs_miniHp(1000001), null);
    assert.equal(t.limited(), 0, 'code ' + code);
  }
});

test('a failed or unreadable answer is not kept: the next card asks again', async () => {
  const answers = [new Error('offline'), answerWith(null), answerWith({ current: 'x', maximum: 5678 }),
    { profile: null }, answerWith(LIFE)];
  const t = torn({ answer: () => answers.shift() });
  for (let i = 0; i < 4; i++) assert.equal(await t.ffs_miniHp(1000001), null, 'answer ' + i);
  assert.deepEqual(await t.ffs_miniHp(1000001), LIFE);
  assert.equal(t.calls.length, 5);
});

test('no answer within 4 seconds makes no line, and the next card asks again', async () => {
  const t = torn({ answer: () => SILENT });
  const pending = t.ffs_miniHp(1000001);
  assert.equal(t.timers.length, 1);
  assert.equal(t.timers[0].ms, 4000);
  t.timers[0].f();
  assert.equal(await pending, null);
  assert.equal(t.cleared, 1);
  t.ffs_miniHp(1000001);
  assert.equal(t.calls.length, 2);
});

// ── the card ──

// A mini profile as Torn draws one, for a made-up player, with FFS's lines (as
// HTML) in its description after Torn's own status.
function card(id, lines = '') {
  const { document } = parseHTML('<!doctype html><html><body>'
    + '<div class="profile-mini-_userProfileWrapper_abc12"><div class="profile-container">'
    + `<a class="user-name" href="https://www.torn.com/profiles.php?XID=${id}">Target</a>`
    + '<div class="description"><div class="desc-wrap"><span class="main-desc">Okay</span></div>'
    + lines + '</div></div></div></body></html>');
  const mini = document.querySelector('[class^="profile-mini-_userProfileWrapper_"]');
  return { document, mini, description: mini.querySelector('.description') };
}
const FF = '<span class="ff-scouter-mini-ff">FF 2.50 (Moderate)</span>';

// The beta's drawing of the line, with `miniHp` standing in for the call to Torn.
function painter(document, miniHp = async () => LIFE) {
  return new Function('document', 'ffs_miniHp',
    fn('ffs_hpLine') + fn('ffs_placeMiniLine') + fn('ffs_paintMiniHp') + fn('get_player_id_in_element')
    + fn('ffs_showMiniHp') + 'return { ffs_placeMiniLine, ffs_paintMiniHp, ffs_showMiniHp };',
  )(document, miniHp);
}
// What the description holds, in order: each child's class and text.
const shown = (description) => [...description.children].map((el) => el.className + ': ' + el.textContent);

test('the HP line sits right under the FF line, above anything after it', () => {
  const c = card(1000001, FF + '<div class="other">from another script</div>');
  painter(c.document).ffs_paintMiniHp(c.mini, LIFE);
  assert.deepEqual(shown(c.description), [
    'desc-wrap: Okay',
    'ff-scouter-mini-ff: FF 2.50 (Moderate)',
    'ffs-mini-hp: HP 1,234 / 5,678 (21%)',
    'other: from another script',
  ]);
});

test('an FF line drawn after the HP line still goes above it, each time FFS redraws it', () => {
  const c = card(1000001);
  const p = painter(c.document);
  p.ffs_paintMiniHp(c.mini, LIFE);
  for (const text of ['FF 2.50 (Moderate)', 'FF 2.75 (Moderate)']) {
    // As FFS redraws its FF line: the old one out, the new one placed.
    for (const old of c.description.querySelectorAll('.ff-scouter-mini-ff')) old.remove();
    const ff = c.document.createElement('span');
    ff.className = 'ff-scouter-mini-ff';
    ff.textContent = text;
    p.ffs_placeMiniLine(c.description, ff);
    assert.deepEqual(shown(c.description), [
      'desc-wrap: Okay', 'ff-scouter-mini-ff: ' + text, 'ffs-mini-hp: HP 1,234 / 5,678 (21%)',
    ]);
  }
});

test('with no FF line, the HP line goes at the end of the description', () => {
  const c = card(1000001);
  painter(c.document).ffs_paintMiniHp(c.mini, LIFE);
  assert.deepEqual(shown(c.description), ['desc-wrap: Okay', 'ffs-mini-hp: HP 1,234 / 5,678 (21%)']);
});

test('drawing again replaces the HP line instead of adding a second', () => {
  const c = card(1000001, FF);
  const p = painter(c.document);
  p.ffs_paintMiniHp(c.mini, LIFE);
  p.ffs_paintMiniHp(c.mini, { current: 5678, maximum: 5678 });
  assert.deepEqual(shown(c.description), [
    'desc-wrap: Okay', 'ff-scouter-mini-ff: FF 2.50 (Moderate)', 'ffs-mini-hp: HP 5,678 / 5,678 (100%)',
  ]);
});

test('a card that has closed, or now shows someone else, gets no line', async () => {
  const closed = card(1000001, FF);
  closed.mini.remove();
  await painter(closed.document).ffs_showMiniHp(closed.mini, 1000001);
  assert.equal(closed.mini.querySelectorAll('.ffs-mini-hp').length, 0);

  const other = card(1000002, FF);
  await painter(other.document).ffs_showMiniHp(other.mini, 1000001);
  assert.equal(other.mini.querySelectorAll('.ffs-mini-hp').length, 0);

  const open = card(1000001, FF);
  await painter(open.document).ffs_showMiniHp(open.mini, 1000001);
  assert.equal(open.mini.querySelectorAll('.ffs-mini-hp').length, 1);
});

test('no description, life with no line, or no player id: nothing is drawn or asked', async () => {
  const c = card(1000001, FF);
  const p = painter(c.document);
  p.ffs_paintMiniHp(c.mini, { current: 'x', maximum: 5678 });
  assert.equal(c.mini.querySelectorAll('.ffs-mini-hp').length, 0);
  c.description.remove();
  p.ffs_paintMiniHp(c.mini, LIFE);
  assert.equal(c.mini.querySelectorAll('.ffs-mini-hp').length, 0);
  let asked = 0;
  await painter(c.document, async () => { asked += 1; return LIFE; }).ffs_showMiniHp(c.mini, null);
  assert.equal(asked, 0);
});

// ── wiring and version ──

test('FFS asks for the HP when it first sees a mini profile, without holding up the FF line', () => {
  const at = SRC.indexOf('const check_mutation = async function');
  const body = SRC.slice(at, SRC.indexOf('const ff_gauge_observer', at));
  assert.match(body, /const player_id = get_player_id_in_element\(mini\);\n(\s*\/\/[^\n]*\n)*\s*ffs_showMiniHp\(mini, player_id\)\.catch\(\(\) => \{\}\);\n\s*apply_to_mini_profile\(mini\);/);
});

test('the FF line is placed with the HP line in mind', () => {
  const body = fn('apply_to_mini_profile');
  assert.match(body, /ffs_placeMiniLine\(description\[0\], desc\[0\]\)/);
  assert.doesNotMatch(body, /\.append\(desc\)/);
});

test('the beta is 2.73.914 in its header, its SCRIPT_VERSION and its meta file, and its CHANGELOG starts there', () => {
  assert.match(SRC, /^\/\/ @version {6}2\.73\.914$/m);
  assert.match(SRC, /const SCRIPT_VERSION = '2\.73\.914';/);
  const end = SRC.indexOf('// ==/UserScript==') + '// ==/UserScript=='.length;
  assert.equal(META, SRC.slice(0, end) + '\n');
  const log = SRC.slice(SRC.indexOf('CHANGELOG'));
  assert.match(log, /\n\/\/ 2\.73\.914 — [^\n]+\n(\/\/ {14}[^\n]+\n)*\/\/ 2\.73\.913 — /);
});
