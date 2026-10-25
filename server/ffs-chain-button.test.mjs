// The chain button, the green FF on the right edge of Torn's pages. A click
// skips people who can't be attacked: FFScouter's hospital times rule out the
// ones it knows about, and Torn is asked about the pick. The target list is
// fetched again once it is an hour old, while someone is chaining. Runs the
// SHIPPED functions of both copies, stable and beta. FFS_DIR points it at
// another folder holding both copies.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const DIR = process.env.FFS_DIR || '/opt/warboard/server/public/scripts';
const COPIES = ['ffs-banner-estimates.user.js', 'ffs-banner-estimates-beta.user.js'].map((file) => ({
  tag: file.includes('beta') ? 'beta' : 'stable',
  SRC: readFileSync(join(DIR, file), 'utf8'),
}));

// The source of one named function, found by counting braces from its name.
function fnOf(SRC, name) {
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
function konstOf(SRC, name) {
  const m = SRC.match(new RegExp('const ' + name + ' = [^;]+;'));
  assert.ok(m, 'not found: const ' + name);
  return m[0] + '\n';
}

// Registers a test once for each copy; the body gets that copy's fn and konst.
function both(name, body) {
  for (const { tag, SRC } of COPIES) {
    test(tag + ': ' + name, () => body({ fn: (n) => fnOf(SRC, n), konst: (n) => konstOf(SRC, n) }));
  }
}

const NOW = Date.UTC(2026, 9, 25, 12, 0, 0);
const NOW_S = NOW / 1000;
// A clock stopped at NOW. Given a value, it is an ordinary Date.
class FakeDate extends Date {
  constructor(...a) {
    if (a.length) super(...a);
    else super(NOW);
  }
  static now() {
    return NOW;
  }
}
// A chain target as FFScouter's get-targets lists one; made-up ids and names.
const T = (id, extra = {}) => ({ player_id: id, name: 'Target ' + id, ...extra });

// ── the list's age ──

// get_cached_targets as the script has it, reading `saved` from storage.
function cachedWith(x, saved) {
  return new Function('rD_getValue', 'Date',
    x.konst('TARGET_KEY') + x.konst('FF_TARGET_STALENESS') + x.fn('get_cached_targets') + 'return get_cached_targets;')(
    () => saved, FakeDate);
}
const savedAgo = (minutes) => JSON.stringify({ targets: [T(1)], last_updated: new Date(NOW - minutes * 60000) });

both('a chain list saved minutes ago is used as it is', (x) => {
  assert.deepEqual(cachedWith(x, savedAgo(5))(false), [T(1)]);
});

both('a chain list an hour old is due to be fetched again', (x) => {
  // last_updated comes back from storage as a string. The old test added the
  // staleness to that string, and to it no list was ever old.
  assert.equal(cachedWith(x, savedAgo(61))(false), null);
  assert.equal(cachedWith(x, savedAgo(60 * 24 * 20))(false), null);
});

both('a list whose time cannot be read is due too, and any list still serves a click', (x) => {
  const unreadable = JSON.stringify({ targets: [T(1)], last_updated: 'not a time' });
  assert.equal(cachedWith(x, unreadable)(false), null);
  assert.deepEqual(cachedWith(x, unreadable)(true), [T(1)]);
  assert.deepEqual(cachedWith(x, savedAgo(61))(true), [T(1)]);
});

// ffs_chainRefreshOnLoad as the script has it. Returns how many times it
// handed the list to update_ff_targets, which fetches it if it is due. A
// saved list here is always an hour old: due to be fetched again, but there.
function refreshOnLoad(x, { list, clickedAgoMin }) {
  let handed = 0;
  const stored = clickedAgoMin === undefined ? {} : { 'ffscouterv2-chain-clicked-at': String(NOW - clickedAgoMin * 60000) };
  new Function('rD_getValue', 'get_cached_targets', 'update_ff_targets', 'Date',
    x.konst('CHAIN_CLICKED_KEY') + x.konst('FFS_CHAIN_ACTIVE_MS') + x.fn('ffs_chainRefreshOnLoad') + 'return ffs_chainRefreshOnLoad;')(
    (k, d) => (k in stored ? stored[k] : d), (staleok) => (list && staleok ? [T(1)] : null), () => { handed++; }, FakeDate)();
  return handed;
}

both('a page load fetches the list when there is none', (x) => {
  assert.equal(refreshOnLoad(x, { list: false }), 1);
});

both('a page load hands an old list on only within 10 minutes of a chain-button click', (x) => {
  assert.equal(refreshOnLoad(x, { list: true }), 0);
  assert.equal(refreshOnLoad(x, { list: true, clickedAgoMin: 11 }), 0);
  assert.equal(refreshOnLoad(x, { list: true, clickedAgoMin: 2 }), 1);
});

both('a new list starts the chain from its top', (x) => {
  let resets = 0;
  const saved = {};
  const update = new Function('key', 'get_cached_targets', 'ffSettingsGet', 'BASE_URL', 'rD_xmlhttpRequest',
    'rD_setValue', 'showToast', 'console', 'reset_next_target_index',
    x.konst('TARGET_KEY') + x.fn('update_ff_targets') + 'return update_ff_targets;')(
    'test-key', () => null, () => undefined, 'https://ffscouter.invalid',
    (req) => req.onload({ status: 200, responseText: JSON.stringify({ targets: [T(1), T(2)] }) }),
    (k, v) => { saved[k] = v; }, () => {}, { log() {}, error() {} }, () => { resets++; });
  update();
  assert.ok(saved['ffscouterv2-targets'], 'the new list was saved');
  assert.equal(resets, 1);
});

// ── picking a target ──

// ffs_chainPick as the script has it.
const pickWith = (x) =>
  new Function(x.konst('FFS_CHAIN_MAX_CHECKS') + x.fn('ffs_chainPick') + 'return ffs_chainPick;')();

// Stands in for asking Torn: answers by player id, "ok" unless told otherwise,
// and keeps the ids it was asked about.
function torn(answers = {}) {
  const asked = [];
  return { asked, check: async (id) => { asked.push(id); return answers[id] || 'ok'; } };
}

both('FFScouter hospital times skip people for free, and Torn is asked about the first one left', async (x) => {
  const t = torn();
  const r = await pickWith(x)([T(11, { hospital_until: NOW_S + 600 }), T(12), T(13)], 0, NOW, t.check);
  assert.equal(r.target.player_id, 12);
  assert.equal(r.next, 2);
  assert.deepEqual(t.asked, [12]);
});

both('a hospital time already past skips nobody', async (x) => {
  const r = await pickWith(x)([T(11, { hospital_until: NOW_S - 5 })], 0, NOW, torn().check);
  assert.equal(r.target.player_id, 11);
});

both('someone Torn says is out is passed over for the next', async (x) => {
  const t = torn({ 21: 'out' });
  const r = await pickWith(x)([T(21), T(22)], 0, NOW, t.check);
  assert.equal(r.target.player_id, 22);
  assert.deepEqual(t.asked, [21, 22]);
  // After the last on the list comes the top again.
  assert.equal(r.next, 0);
});

both('no answer from Torn means go, as the button did before it asked', async (x) => {
  const r = await pickWith(x)([T(31)], 0, NOW, torn({ 31: 'unknown' }).check);
  assert.equal(r.target.player_id, 31);
});

both('a click asks Torn about 3 people at most, and the next click starts at the 4th', async (x) => {
  const t = torn({ 41: 'out', 42: 'out', 43: 'out' });
  const r = await pickWith(x)([T(41), T(42), T(43), T(44), T(45)], 0, NOW, t.check);
  assert.equal(r.target, null);
  assert.deepEqual(t.asked, [41, 42, 43]);
  assert.equal(r.next, 3);
  assert.match(r.note, /^The next 3 on your chain list can't be attacked right now/);
});

both('with everyone in hospital by FFScouter, Torn is not asked, and the note says who is out first', async (x) => {
  const t = torn();
  const r = await pickWith(x)([T(51, { hospital_until: NOW_S + 900 }), T(52, { hospital_until: NOW_S + 125 })], 1, NOW, t.check);
  assert.equal(r.target, null);
  assert.deepEqual(t.asked, []);
  assert.equal(r.next, 1);
  assert.equal(r.note, 'Nobody on your chain list can be attacked right now. First out of hospital: Target 52 in 3 min.');
});

both('the walk starts at the saved place and wraps round; a place past the end starts at the top', async (x) => {
  const t = torn({ 63: 'out' });
  const r = await pickWith(x)([T(61), T(62), T(63)], 2, NOW, t.check);
  assert.equal(r.target.player_id, 61);
  assert.deepEqual(t.asked, [63, 61]);
  const past = await pickWith(x)([T(61), T(62), T(63)], 7, NOW, torn().check);
  assert.equal(past.target.player_id, 61);
});

// ── asking Torn ──

// ffs_chainStatus as the script has it, on a stand-in fetch. Gives the status
// function, the URLs it fetched, and the stand-down time it leaves.
function statusWith(x, { reply, standDownUntil = 0, hang = false } = {}) {
  const urls = [];
  const fetchStub = async (url) => {
    urls.push(url);
    if (hang) return new Promise(() => {});
    if (reply instanceof Error) throw reply;
    return { json: async () => reply };
  };
  // When the fetch hangs, the timeout fires at once instead of in 4 seconds.
  const timer = hang ? (f) => f() : setTimeout;
  const made = new Function('key', 'fetch', 'Date', 'setTimeout',
    'let _ffsRateLimitedUntil = ' + standDownUntil + ';\n' + x.konst('FFS_REFUSAL_CODES') +
    x.konst('FFS_RATE_LIMIT_BACKOFF_MS') + x.konst('FFS_CHAIN_CHECK_TIMEOUT_MS') + x.fn('ffs_isRateLimitError') +
    x.fn('ffs_chainStatus') + 'return { status: ffs_chainStatus, until: () => _ffsRateLimitedUntil };')(
    'test-key', fetchStub, FakeDate, timer);
  return { ...made, urls };
}

// Fails, rather than hangs, when a call never settles: a test left waiting
// for ever is cancelled, and every test after it with it.
async function within(ms, promise) {
  let timer;
  const guard = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error('still waiting after ' + ms + ' ms')), ms);
  });
  try {
    return await Promise.race([promise, guard]);
  } finally {
    clearTimeout(timer);
  }
}

both('Torn saying Okay means ok, from one live call for the player basic profile', async (x) => {
  const s = statusWith(x, { reply: { profile: { id: 7, status: { state: 'Okay' } } } });
  assert.equal(await s.status(7), 'ok');
  assert.equal(s.urls.length, 1);
  assert.match(s.urls[0], /^https:\/\/api\.torn\.com\/v2\/user\/7\/basic\?/);
  assert.match(s.urls[0], /[?&]key=test-key(&|$)/);
  // A cache-buster, so a hospital stay that began seconds ago is seen.
  assert.match(s.urls[0], /[?&]timestamp=\d+/);
});

both('hospital, travel, abroad, jail and federal jail all mean out', async (x) => {
  for (const state of ['Hospital', 'Traveling', 'Abroad', 'Jail', 'Federal']) {
    assert.equal(await statusWith(x, { reply: { profile: { status: { state } } } }).status(7), 'out', state);
  }
});

both('an error, a failed fetch, a reply without a status or no reply in time all mean unknown', async (x) => {
  assert.equal(await statusWith(x, { reply: { error: { code: 2, error: 'Incorrect key' } } }).status(7), 'unknown');
  assert.equal(await statusWith(x, { reply: new Error('network down') }).status(7), 'unknown');
  assert.equal(await statusWith(x, { reply: {} }).status(7), 'unknown');
  assert.equal(await within(1000, statusWith(x, { hang: true }).status(7)), 'unknown');
});

both('a refusal stands the Torn calls down for a minute, and while stood down nothing is asked', async (x) => {
  const s = statusWith(x, { reply: { error: { code: 5, error: 'Too many requests' } } });
  assert.equal(await s.status(7), 'unknown');
  assert.equal(s.until(), NOW + 60000);
  const idle = statusWith(x, { reply: { profile: { status: { state: 'Okay' } } }, standDownUntil: NOW + 1000 });
  assert.equal(await idle.status(7), 'unknown');
  assert.equal(idle.urls.length, 0);
});

// ── the click ──

// create_chain_button as the script has it, on stand-in page objects. Torn's
// answers come by player id. `events` records, in order, each tab opened,
// each question to Torn, each note shown, the waiting tab closing, and a fetch
// of the list begun.
function clickRig(x, { tabType = 'newtab', linkType = 'attack', pda = false, list = [T(71), T(72)], answers = {}, blocked = false, index = 0, handler } = {}) {
  const events = [];
  const stored = { 'ffscouterv2-target-index': String(index) };
  let button = null;
  const waiting = {
    opener: 'the page',
    document: { title: '' },
    location: { href: '' },
    closed: false,
    close() {
      this.closed = true;
      events.push(['close']);
    },
  };
  const win = {
    location: { href: 'https://www.torn.com/index.php' },
    open(url, name, features) {
      events.push(['open', url, name, features || '']);
      return url === '' && !blocked ? waiting : null;
    },
  };
  const deps = {
    document: {
      createElement: () => ({ style: {}, on: {}, addEventListener(type, f) { this.on[type] = f; } }),
      body: { appendChild(el) { button = el; } },
    },
    window: win,
    ffSettingsGetToggle: () => true,
    ffSettingsGet: (k) => ({ 'chain-link-type': linkType, 'chain-tab-type': tabType })[k],
    ffdebug: () => {},
    get_cached_targets: () => list,
    // The old click's own pick, so a run before the change fails on what the
    // click does rather than on a missing name.
    get_random_chain_target: () => (list ? list[0] : null),
    ffs_chainStatus: async (id) => {
      events.push(['ask', id]);
      return answers[id] || 'ok';
    },
    rD_getValue: (k, d) => (k in stored ? stored[k] : d),
    rD_setValue: (k, v) => { stored[k] = String(v); },
    update_ff_targets: () => events.push(['update']),
    showToast: (message) => events.push(['toast', message]),
    TOAST_LOG: 'log',
    // The script's PDA test is apikey[0] != "#".
    apikey: pda ? 'a-pda-key' : '#',
    // What the userscript host calls itself; the warboard apps give their names.
    GM_info: handler ? { scriptHandler: handler } : undefined,
    Date: FakeDate,
  };
  const names = Object.keys(deps);
  new Function(...names,
    x.konst('TARGET_INDEX_KEY') + x.konst('CHAIN_CLICKED_KEY') + x.konst('FFS_CHAIN_MAX_CHECKS') +
    x.fn('ffs_chainPick') + x.fn('create_chain_button') + 'return create_chain_button;')(...names.map((k) => deps[k]))();
  return { events, stored, waiting, win, button: () => button, click: () => button.on.click() };
}
const attackPage = (id) => 'https://www.torn.com/page.php?sid=attack&user2ID=' + id;

both('new tab: the tab opens with the click, before Torn is asked, then goes to the attack page', async (x) => {
  const r = clickRig(x);
  await r.click();
  assert.deepEqual(r.events, [['open', '', '_blank', ''], ['ask', 71]]);
  assert.equal(r.waiting.location.href, attackPage(71));
  assert.equal(r.waiting.opener, null);
  assert.equal(r.stored['ffscouterv2-target-index'], '1');
  assert.equal(r.stored['ffscouterv2-chain-clicked-at'], String(NOW));
});

both('same tab: Torn is asked, then the page itself goes to the target, and no tab opens', async (x) => {
  const r = clickRig(x, { tabType: 'sametab', linkType: 'profile' });
  await r.click();
  assert.deepEqual(r.events, [['ask', 71]]);
  assert.equal(r.win.location.href, 'https://www.torn.com/profiles.php?XID=71');
});

both('when the 3 asked about are all out, the waiting tab closes, the note shows and the next click starts after them', async (x) => {
  const r = clickRig(x, { list: [T(71), T(72), T(73), T(74)], answers: { 71: 'out', 72: 'out', 73: 'out' } });
  await r.click();
  assert.equal(r.waiting.closed, true);
  assert.equal(r.events.at(-1)[0], 'toast');
  assert.match(r.events.at(-1)[1], /^The next 3 on your chain list can't be attacked right now/);
  assert.equal(r.stored['ffscouterv2-target-index'], '3');
});

both('on Torn PDA the tab opens once the target is known', async (x) => {
  const r = clickRig(x, { pda: true });
  await r.click();
  assert.deepEqual(r.events, [['ask', 71], ['open', attackPage(71), '_blank', 'noopener,noreferrer']]);
});

both('a browser that blocks the waiting tab gets the target opened the old way once it is known', async (x) => {
  const r = clickRig(x, { blocked: true });
  await r.click();
  assert.deepEqual(r.events, [['open', '', '_blank', ''], ['ask', 71], ['open', attackPage(71), '_blank', 'noopener,noreferrer']]);
});

both('a second click while the first is still asking Torn does nothing, and the button is dimmed meanwhile', async (x) => {
  const r = clickRig(x);
  const first = r.click();
  assert.equal(r.button().style.opacity, '0.5');
  await r.click();
  await first;
  assert.equal(r.events.filter((e) => e[0] === 'ask').length, 1);
  assert.equal(r.events.filter((e) => e[0] === 'open').length, 1);
  assert.equal(r.button().style.opacity, '');
});

both('with no list yet, a click starts a fetch and opens nothing', async (x) => {
  const r = clickRig(x, { list: null });
  await r.click();
  assert.deepEqual(r.events, [['update']]);
});

both('a click starts where the last one left off and passes over people FFScouter has in hospital', async (x) => {
  // 72 is in hospital for 10 more minutes; 73's stay ended 10 minutes ago.
  const list = [T(71), T(72, { hospital_until: NOW_S + 600 }), T(73, { hospital_until: NOW_S - 600 })];
  const r = clickRig(x, { list, index: 1 });
  await r.click();
  assert.deepEqual(r.events, [['open', '', '_blank', ''], ['ask', 73]]);
  assert.equal(r.waiting.location.href, attackPage(73));
  assert.equal(r.stored['ffscouterv2-target-index'], '0');
});

both('in the warboard apps, a new-tab click goes to the target in place, with no blank tab', async (x) => {
  // Each app has one view and loads a new tab's address in it, so a blank tab
  // would load an empty page over Torn's.
  for (const handler of ['WarboardIOS', 'WarboardNative']) {
    const r = clickRig(x, { handler });
    await r.click();
    assert.deepEqual(r.events, [['ask', 71]], handler);
    assert.equal(r.win.location.href, attackPage(71), handler);
  }
});
