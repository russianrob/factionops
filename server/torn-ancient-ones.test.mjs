// Torn Ancient Ones: where M'aol and his five praetorians are, in a small box on Torn pages.
// These tests load the real script into hand-built Torn pages, with the clock, the timers, GM
// storage, the answers from Torn and TornStats, the window and the console under their control.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseHTML } from 'linkedom';

// TAO_SRC lets a mutant copy be tested in place of the served file.
const SRC = process.env.TAO_SRC || '/opt/warboard/server/public/scripts/torn-ancient-ones.user.js';
const META = SRC.replace(/\.user\.js$/, '.meta.js');
const RUNNING = '[Torn Ancient Ones 1.0.0] running';
const KEY_STORE = 'torn-ancient-ones-key';
const READING_STORE = 'torn-ancient-ones-reading';
const BOX_STORE = 'torn-ancient-ones-box';
// Made-up keys. Torn's are 16 characters; these are shorter on purpose.
const KEY = 'TestKey0000wxyz';
const PDA_KEY = 'PdaKeyFromPDA12';
const TORNSTATS = 'https://www.tornstats.com/ajax/status/maol';
// 10:40 TCT on 26 October 2026, 40 minutes into the summoning window.
const T0 = Date.UTC(2026, 9, 26, 10, 40);
const SEC = 1000;
const MIN = 60 * SEC;
const IDS = [23, 100, 101, 102, 103, 104];
const COUNTRIES = ['Mexico', 'Cayman Islands', 'Canada', 'Hawaii', 'United Kingdom', 'Argentina',
  'Switzerland', 'Japan', 'China', 'UAE', 'South Africa'];

// The six as Torn's API gave them on 2026-10-26, NPC fields only. At 11:25 TCT M'aol was shielded
// in Torn City, with one praetorian beaten; at 12:15 TCT he was shielded in the Cayman Islands,
// with three beaten.
const READ_1125 = {
  23: {"id":23,"name":"M'aol","role":"NPC","status":{"description":"Awoken","details":null,"state":"Awoken","color":"green","until":null},"life":{"current":151200000,"maximum":151200000},"last_action":{"status":"Online","timestamp":1793008800,"relative":"1 hour ago"}},
  100: {"id":100,"name":"Dyno'salam","role":"NPC","status":{"description":"Awoken in Cayman Islands","details":null,"state":"Abroad","color":"blue","until":null},"life":{"current":57759744,"maximum":172500000},"last_action":{"status":"Online","timestamp":1793008800,"relative":"1 hour ago"}},
  101: {"id":101,"name":"Nol'dasaym","role":"NPC","status":{"description":"Dormant in Mexico","details":null,"state":"Abroad","color":"blue","until":null},"life":{"current":0,"maximum":129600000},"last_action":{"status":"Offline","timestamp":1793008800,"relative":"1 hour ago"}},
  102: {"id":102,"name":"Asmol'yand","role":"NPC","status":{"description":"Awoken in Canada","details":null,"state":"Abroad","color":"blue","until":null},"life":{"current":194583588,"maximum":217800000},"last_action":{"status":"Online","timestamp":1793008800,"relative":"1 hour ago"}},
  103: {"id":103,"name":"Sylo'nadam","role":"NPC","status":{"description":"Awoken in Hawaii","details":null,"state":"Abroad","color":"blue","until":null},"life":{"current":202949730,"maximum":202950000},"last_action":{"status":"Online","timestamp":1793008800,"relative":"1 hour ago"}},
  104: {"id":104,"name":"Ladso'myna","role":"NPC","status":{"description":"Awoken in United Kingdom","details":null,"state":"Abroad","color":"blue","until":null},"life":{"current":119606777,"maximum":222000000},"last_action":{"status":"Online","timestamp":1793008800,"relative":"1 hour ago"}},
};
const READ_1215 = {
  23: {"id":23,"name":"M'aol","role":"NPC","status":{"description":"Awoken in Cayman Islands","details":null,"state":"Abroad","color":"blue","until":null},"life":{"current":151200000,"maximum":151200000},"last_action":{"status":"Online","timestamp":1793008800,"relative":"2 hours ago"}},
  100: {"id":100,"name":"Dyno'salam","role":"NPC","status":{"description":"Dormant in Cayman Islands","details":null,"state":"Abroad","color":"blue","until":null},"life":{"current":0,"maximum":172500000},"last_action":{"status":"Offline","timestamp":1793008800,"relative":"2 hours ago"}},
  101: {"id":101,"name":"Nol'dasaym","role":"NPC","status":{"description":"Dormant in Mexico","details":null,"state":"Abroad","color":"blue","until":null},"life":{"current":0,"maximum":129600000},"last_action":{"status":"Offline","timestamp":1793008800,"relative":"2 hours ago"}},
  102: {"id":102,"name":"Asmol'yand","role":"NPC","status":{"description":"Awoken in Canada","details":null,"state":"Abroad","color":"blue","until":null},"life":{"current":120751439,"maximum":217800000},"last_action":{"status":"Online","timestamp":1793008800,"relative":"2 hours ago"}},
  103: {"id":103,"name":"Sylo'nadam","role":"NPC","status":{"description":"Awoken in Hawaii","details":null,"state":"Abroad","color":"blue","until":null},"life":{"current":199916612,"maximum":202950000},"last_action":{"status":"Online","timestamp":1793008800,"relative":"2 hours ago"}},
  104: {"id":104,"name":"Ladso'myna","role":"NPC","status":{"description":"Dormant in United Kingdom","details":null,"state":"Abroad","color":"blue","until":null},"life":{"current":0,"maximum":222000000},"last_action":{"status":"Offline","timestamp":1793008800,"relative":"2 hours ago"}},
};

// A profile in the shape Torn's v2 API gives: the name, the words, the life. state is Torn's
// status.state: by default "Abroad" when the words name a place, else the words' first word.
// max defaults to that one's real maximum life.
function profile(id, description, current, { state, max } = {}) {
  const real = READ_1125[id];
  return {
    id, name: real.name, role: 'NPC',
    status: { description, details: null, state: state || (/ in /.test(description) ? 'Abroad' : description.split(' ')[0]), color: 'blue', until: null },
    life: { current, maximum: max || real.life.maximum },
  };
}
const up = (id, place, current) => profile(id, place === 'Torn City' ? 'Awoken' : 'Awoken in ' + place, current === undefined ? READ_1125[id].life.maximum : current);
const beaten = (id, place) => profile(id, 'Dormant in ' + place, 0);
// The six with every praetorian beaten where it stood on 2026-10-26, and M'aol standing where given.
function allBeaten(maolWords = 'Awoken in Mexico', maolLife = 151200000) {
  return {
    23: profile(23, maolWords, maolLife),
    100: beaten(100, 'Cayman Islands'), 101: beaten(101, 'Mexico'), 102: beaten(102, 'Canada'),
    103: beaten(103, 'Hawaii'), 104: beaten(104, 'United Kingdom'),
  };
}

// Lets every answer that is due reach the script: answers come back as promise jobs, and
// setImmediate runs only once those are all done.
const flush = () => new Promise((resolve) => setImmediate(resolve));

// linkedom lays nothing out. Every element is 300 by 200; the box sits where its style puts it,
// or 20 px from the bottom left of its window when its style doesn't say.
const tabOf = new WeakMap();
parseHTML('<!doctype html><html></html>').HTMLElement.prototype.getBoundingClientRect = function () {
  const w = tabOf.get(this.ownerDocument);
  const width = 300;
  const height = 200;
  const left = this.style && this.style.left ? parseFloat(this.style.left) : 20;
  const top = this.style && this.style.top ? parseFloat(this.style.top) : (w ? w.win.innerHeight : 800) - 20 - height;
  return { x: left, y: top, left, top, width, height, right: left + width, bottom: top + height };
};

// One device: its clock, its timers, its GM storage, and the answers Torn and TornStats give,
// shared by every tab on it.
// - env.torn: the profile Torn gives for each id; { error: { code, error } } is Torn's error,
//   { raw } is that text as it is, and null is no answer. env.tornError, when set, is Torn's
//   error for every call.
// - env.tornstats: TornStats' feed: a list, a text, or null for no answer.
// - env.hold: true holds back every answer, 'torn' or 'tornstats' only theirs, until
//   env.release().
// - env.requests: every request, in order.
// - env.advance(ms): moves the clock on, running each timer when it is due, and every answer.
function device({ store = {}, torn = READ_1125, tornstats = [] } = {}) {
  const env = { now: T0, store, torn: { ...torn }, tornError: null, tornstats, hold: false, held: [], requests: [], timers: [], seq: 0 };
  env.advance = async (ms) => {
    const end = env.now + ms;
    await flush();
    for (;;) {
      const due = env.timers.filter((t) => t.at <= end).sort((a, b) => a.at - b.at || a.seq - b.seq)[0];
      if (!due) break;
      env.now = due.at;
      if (due.every) due.at += due.every;
      else env.timers.splice(env.timers.indexOf(due), 1);
      due.fn();
      await flush();
    }
    env.now = end;
    await flush();
  };
  env.release = async () => {
    const held = env.held;
    env.held = [];
    held.forEach((answer) => answer());
    await flush();
  };
  env.tab = (opts) => tab(env, opts);
  env.torns = () => env.requests.filter((r) => r.url.startsWith('https://api.torn.com/'));
  env.stats = () => env.requests.filter((r) => r.url.startsWith('https://www.tornstats.com/'));
  env.reading = () => JSON.parse(env.store[READING_STORE]);
  return env;
}

// Torn's or TornStats' answer to a request, as text, or null for no answer.
function answerText(env, url) {
  const torn = /^https:\/\/api\.torn\.com\/v2\/user\/(\d+)\/profile\?/.exec(url);
  if (torn) {
    if (env.tornError) return JSON.stringify({ error: env.tornError });
    const p = env.torn[torn[1]];
    if (p === null || p === undefined) return null;
    if (p.raw !== undefined) return p.raw;
    return JSON.stringify(p.error ? p : { profile: p });
  }
  if (url === TORNSTATS && env.tornstats !== null) return typeof env.tornstats === 'string' ? env.tornstats : JSON.stringify(env.tornstats);
  return null;
}

// Sends an answer now (as a promise job) or holds it, as env.hold says.
function answerLater(env, url, answer) {
  const which = url.startsWith('https://api.torn.com/') ? 'torn' : 'tornstats';
  if (env.hold === true || env.hold === which) env.held.push(answer);
  else Promise.resolve().then(answer);
}

// A Torn page (a tab) on the device, with the script ready to run. Options:
// - visible: whether the page is in view (default true); w.show() and w.hide() change it as
//   the browser does;
// - pda: Torn PDA's bridge on the window, and PDA's key in place of the placeholder (pdaKey,
//   '' for none); app: the warboard app's gmBridge handler, with PDA's bridge too, as the app
//   answers it;
// - gm: false takes every GM_* function away; xhr: false only GM_xmlhttpRequest (then the
//   script asks by fetch); getValue and setValue change how storage reads and writes go;
// - width and height: the window's size.
function tab(env, { visible = true, pda = false, pdaKey, app = false, gm = true, xhr = true, getValue, setValue, width = 1280, height = 800 } = {}) {
  const dom = parseHTML('<!doctype html><html><head></head><body><div id="mainContainer"><div class="content-wrapper">Torn</div></div></body></html>');
  const doc = dom.document;
  const w = { env, dom, document: doc, logs: [], visible, listeners: {} };
  tabOf.set(doc, w);
  Object.defineProperty(doc, 'visibilityState', { configurable: true, get: () => (w.visible ? 'visible' : 'hidden') });
  w.win = {
    innerWidth: width,
    innerHeight: height,
    addEventListener: (type, fn) => { (w.listeners[type] = w.listeners[type] || []).push(fn); },
    removeEventListener: (type, fn) => { w.listeners[type] = (w.listeners[type] || []).filter((f) => f !== fn); },
  };
  if (pda || app) w.win.flutter_inappwebview = { callHandler: () => Promise.resolve() };
  if (app) w.win.webkit = { messageHandlers: { gmBridge: { postMessage() {} } } };
  // An event on the window, as the browser would send it.
  w.fire = (type, e = {}) => (w.listeners[type] || []).slice().forEach((fn) => fn(e));
  w.show = () => { w.visible = true; doc.dispatchEvent(new dom.Event('visibilitychange')); };
  w.hide = () => { w.visible = false; doc.dispatchEvent(new dom.Event('visibilitychange')); };
  let src = readFileSync(SRC, 'utf8');
  const swapped = pdaKey === undefined ? (pda ? PDA_KEY : '') : pdaKey;
  if (swapped) src = src.split('###PDA-APIKEY###').join(swapped);
  const has = (k) => Object.prototype.hasOwnProperty.call(env.store, k);
  const getV = getValue ? (k, d) => getValue(env.store, k, d) : (k, d) => (has(k) ? env.store[k] : d);
  const setV = setValue ? (k, v) => setValue(env.store, k, v) : (k, v) => { env.store[k] = v; };
  const xhrFn = (o) => {
    env.requests.push({ url: o.url, method: o.method, anonymous: o.anonymous, headers: o.headers, via: 'xhr', tab: w });
    answerLater(env, o.url, () => {
      const text = answerText(env, o.url);
      if (text === null) o.onerror({ status: 0 });
      else o.onload({ status: 200, responseText: text });
    });
  };
  // fetch reaches Torn, but not TornStats, whose feed doesn't let torn.com pages read it.
  const fetchFn = (url, init) => {
    env.requests.push({ url, credentials: init && init.credentials, via: 'fetch', tab: w });
    return new Promise((resolve, reject) => answerLater(env, url, () => {
      const text = url.startsWith('https://api.torn.com/') ? answerText(env, url) : null;
      if (text === null) reject(new TypeError('Failed to fetch'));
      else resolve({ ok: true, status: 200, text: () => Promise.resolve(text) });
    }));
  };
  const add = (fn, ms, every) => {
    const t = { id: ++env.seq, seq: env.seq, at: env.now + Math.max(0, ms || 0), every: every ? Math.max(1, ms) : 0, fn, tab: w };
    env.timers.push(t);
    return t.id;
  };
  const clear = (id) => { env.timers = env.timers.filter((t) => t.id !== id); };
  class FakeDate extends Date {
    constructor(...a) { super(...(a.length ? a : [env.now])); }
    static now() { return env.now; }
  }
  const con = { log: (...a) => w.logs.push(a.join(' ')), warn: (...a) => w.logs.push(a.join(' ')), error: (...a) => w.logs.push(a.join(' ')) };
  w.run = () => {
    new Function('window', 'document', 'GM_getValue', 'GM_setValue', 'GM_xmlhttpRequest', 'fetch', 'setInterval', 'clearInterval', 'setTimeout', 'clearTimeout', 'Date', 'console', src)(
      w.win, doc, gm ? getV : undefined, gm ? setV : undefined, gm && xhr ? xhrFn : undefined, fetchFn,
      (fn, ms) => add(fn, ms, true), clear, (fn, ms) => add(fn, ms, false), clear, FakeDate, con);
    return w;
  };
  return w;
}

// A device with the key saved, and one tab on it that has run the script and read Torn once.
async function started(opts = {}, tabOpts = {}) {
  const env = device(opts);
  env.store[KEY_STORE] = KEY;
  const w = env.tab(tabOpts).run();
  await env.advance(0);
  return { env, w };
}

// What the script stored of each of the six: [state, place, whole % of life left] by id.
function seen(env) {
  const r = env.reading();
  const out = {};
  for (const id of IDS) {
    const n = r.npcs[id];
    out[id] = n ? [n.state, n.place, n.max ? Math.floor((100 * n.cur) / n.max) : null] : null;
  }
  return out;
}

// The id each Torn request asked for, in order.
const askedIds = (env) => env.torns().map((r) => Number(/\/user\/(\d+)\//.exec(r.url)[1]));

// ---------------------------------------------------------------------------------------------
// The source
// ---------------------------------------------------------------------------------------------

test('the header is the spec\'s, and the meta file is the header and a newline', () => {
  const src = readFileSync(SRC, 'utf8');
  const end = '// ==/UserScript==';
  const header = src.slice(0, src.indexOf(end) + end.length) + '\n';
  assert.equal(readFileSync(META, 'utf8'), header);
  const tags = header.split('\n').filter((l) => l.startsWith('// @')).map((l) => l.slice(4).replace(/\s+/, ' '));
  assert.deepEqual(tags, [
    'name Torn Ancient Ones',
    'namespace RussianRob',
    'version 1.0.0',
    'description Where Torn\'s Halloween Ancient Ones are (M\'aol and his five praetorians), in a small box on Torn pages: country, life left, standing or beaten, an attack link, when M\'aol can be hit and his route, and where to fly by airstrip or BCT. It needs a Public API key; Torn PDA gives its own.',
    'author RussianRob',
    'downloadURL https://tornwar.com/scripts/torn-ancient-ones.user.js',
    'updateURL https://tornwar.com/scripts/torn-ancient-ones.meta.js',
    'license All Rights Reserved',
    'match https://www.torn.com/*',
    'run-at document-idle',
    'grant GM_getValue',
    'grant GM_setValue',
    'grant GM_xmlhttpRequest',
    'connect api.torn.com',
    'connect www.tornstats.com',
  ]);
  assert.match(src, /\n\/\/ TORN'S API TERMS\n/);
  assert.match(src, /\n\/\/ Data Sharing {11}None\. The script also reads TornStats' public feed of the six, and sends\n/);
  assert.match(src, /\n\/\/ Key Access Level {7}Public\.\n/);
  assert.match(src, /\n  const VERSION = '1\.0\.0';\n/);
  assert.match(src, /\n\/\/ CHANGELOG\n/);
  assert.match(src, /\n\/\/ v1\.0\.0  - First release\./);
});

test('the source is plain ASCII, guards every GM_* call, holds PDA\'s placeholder once, and has no password field, new tab or HTML put in', () => {
  const src = readFileSync(SRC, 'utf8');
  assert.equal(/[^\x00-\x7f]/.test(src), false, 'plain ASCII');
  const lines = src.split('\n');
  lines.forEach((line, i) => {
    if (line.trim().startsWith('//')) return;
    for (const m of line.matchAll(/\b(GM_\w+)\(/g)) {
      const guard = 'typeof ' + m[1];
      assert.ok(line.includes(guard) || (lines[i - 1] || '').includes(guard) || (lines[i - 2] || '').includes(guard), 'line ' + (i + 1) + ' guards ' + m[1]);
    }
  });
  assert.equal(src.split('###PDA-APIKEY###').length - 1, 1);
  assert.equal(/['"]password['"]/i.test(src), false);
  assert.equal(/_blank|window\.open/.test(src), false);
  assert.equal(/innerHTML|outerHTML|insertAdjacentHTML|document\.write/.test(src), false);
});

test('it says once in the console that it is running, and a second copy on the same page does nothing', async () => {
  const { env, w } = await started();
  assert.equal(w.document.documentElement.getAttribute('data-torn-ancient-ones'), '1.0.0');
  w.run();
  await env.advance(0);
  assert.deepEqual(w.logs, [RUNNING]);
  assert.deepEqual(askedIds(env), IDS);
});

// ---------------------------------------------------------------------------------------------
// Reading Torn's answer
// ---------------------------------------------------------------------------------------------

test('the six as Torn gave them at 11:25 TCT read as they were: M\'aol shielded in Torn City, one praetorian beaten', async () => {
  const { env } = await started({ torn: READ_1125 });
  assert.deepEqual(seen(env), {
    23: ['up', 'Torn City', 100],
    100: ['up', 'Cayman Islands', 33],
    101: ['beaten', 'Mexico', 0],
    102: ['up', 'Canada', 89],
    103: ['up', 'Hawaii', 99],
    104: ['up', 'United Kingdom', 53],
  });
  const r = env.reading();
  assert.equal(r.npcs[23].name, 'M\'aol');
  assert.equal(r.npcs[100].words, 'Awoken in Cayman Islands');
  assert.equal(r.npcs[100].cur, 57759744);
  assert.equal(r.npcs[100].max, 172500000);
});

test('the six as Torn gave them at 12:15 TCT read as they were: M\'aol shielded in the Cayman Islands, three beaten', async () => {
  const { env } = await started({ torn: READ_1215 });
  assert.deepEqual(seen(env), {
    23: ['up', 'Cayman Islands', 100],
    100: ['beaten', 'Cayman Islands', 0],
    101: ['beaten', 'Mexico', 0],
    102: ['up', 'Canada', 55],
    103: ['up', 'Hawaii', 98],
    104: ['beaten', 'United Kingdom', 0],
  });
});

test('life at 0 is beaten whatever the words say, and Dormant with life left is dormant', async () => {
  const { env } = await started({ torn: { ...READ_1125, 100: profile(100, 'Awoken in Cayman Islands', 0), 102: profile(102, 'Dormant in Canada', 108900000) } });
  assert.deepEqual(seen(env)[100], ['beaten', 'Cayman Islands', 0]);
  assert.deepEqual(seen(env)[102], ['dormant', 'Canada', 50]);
});

test('each of Torn\'s eleven countries abroad is read, in any letter case', async () => {
  for (const country of COUNTRIES.concat(['united kingdom', 'CAYMAN ISLANDS'])) {
    const { env } = await started({ torn: { ...READ_1125, 100: up(100, country) } });
    assert.equal(seen(env)[100][1], COUNTRIES.find((c) => c.toLowerCase() === country.toLowerCase()), country);
  }
});

test('a country Torn doesn\'t fly to, or words the script doesn\'t know, come through as Torn\'s words', async () => {
  const { env } = await started({ torn: { ...READ_1125, 100: profile(100, 'Awoken in Atlantis', 1000), 102: profile(102, 'Sleeping <b>soundly</b>', 1000, { state: 'Okay' }) } });
  const r = env.reading();
  assert.deepEqual([r.npcs[100].state, r.npcs[100].place, r.npcs[100].words], ['up', '', 'Awoken in Atlantis']);
  assert.deepEqual([r.npcs[102].state, r.npcs[102].words], ['unknown', 'Sleeping <b>soundly</b>']);
});

test('with no country in the words, Torn City unless Torn\'s state says abroad or flying', async () => {
  const { env } = await started({ torn: { ...READ_1125, 100: profile(100, 'Awoken', 1000, { state: 'Abroad' }), 102: profile(102, 'Awoken', 1000, { state: 'Traveling' }), 103: profile(103, 'Awoken', 1000, { state: 'Okay' }) } });
  assert.deepEqual([seen(env)[23][1], seen(env)[100][1], seen(env)[102][1], seen(env)[103][1]], ['Torn City', '', '', 'Torn City']);
});

test('the words decide before Torn\'s state does, and the state decides when the words don\'t say', async () => {
  const { env } = await started({ torn: { ...READ_1125, 100: profile(100, 'Something', 1000, { state: 'Dormant' }), 102: profile(102, 'Awoken in Canada', 1000, { state: 'Dormant' }) } });
  assert.equal(seen(env)[100][0], 'dormant');
  assert.equal(seen(env)[102][0], 'up');
});

// ---------------------------------------------------------------------------------------------
// Times
// ---------------------------------------------------------------------------------------------

test('a change gets the time of the reading that showed it only when the reading before was at most 3 minutes older', async () => {
  const { env, w } = await started();
  let r = env.reading();
  assert.equal(r.npcs[100].since, 0, 'nothing changed at the first reading');
  assert.equal(r.npcs[100].changedAt, 0);
  env.torn[100] = beaten(100, 'Cayman Islands');
  await env.advance(MIN);
  r = env.reading();
  assert.equal(r.npcs[100].state, 'beaten');
  assert.equal(r.npcs[100].since, T0 + MIN);
  assert.equal(r.npcs[100].changedAt, T0 + MIN);
  // The page out of view for 5 minutes: the next change can't be timed.
  w.hide();
  await env.advance(5 * MIN);
  env.torn[102] = beaten(102, 'Canada');
  w.show();
  await env.advance(0);
  r = env.reading();
  assert.equal(r.npcs[102].state, 'beaten');
  assert.equal(r.npcs[102].since, 0);
  assert.equal(r.npcs[102].changedAt, T0 + 6 * MIN);
  assert.equal(r.npcs[100].since, T0 + MIN, 'an earlier change keeps its time');
});

test('a move while standing is a change; the same place again is not', async () => {
  const { env } = await started({ torn: READ_1215 });
  env.torn[23] = up(23, 'Mexico');
  await env.advance(MIN);
  assert.equal(env.reading().npcs[23].since, T0 + MIN);
  await env.advance(MIN);
  assert.equal(env.reading().npcs[23].since, T0 + MIN);
});

// ---------------------------------------------------------------------------------------------
// Asking Torn
// ---------------------------------------------------------------------------------------------

test('a sweep asks Torn\'s v2 profile of each of the six, M\'aol first, with the key and a comment, sending no cookies', async () => {
  const { env } = await started();
  assert.deepEqual(env.torns().map((r) => r.url), IDS.map((id) => 'https://api.torn.com/v2/user/' + id + '/profile?striptags=true&key=' + KEY + '&comment=ancient-ones'));
  assert.ok(env.torns().every((r) => r.method === 'GET' && r.anonymous === true && r.via === 'xhr'));
});

test('with no GM_xmlhttpRequest, it asks Torn by fetch, sending no cookies', async () => {
  const { env } = await started({}, { xhr: false });
  assert.deepEqual(askedIds(env), IDS);
  assert.ok(env.torns().every((r) => r.via === 'fetch' && r.credentials === 'omit'));
  assert.deepEqual(seen(env)[101], ['beaten', 'Mexico', 0]);
});

test('two tabs on one device make one sweep a minute between them', async () => {
  const env = device();
  env.store[KEY_STORE] = KEY;
  env.tab().run();
  env.tab().run();
  await env.advance(0);
  assert.equal(env.torns().length, 6);
  await env.advance(59 * SEC);
  assert.equal(env.torns().length, 6);
  await env.advance(SEC);
  assert.equal(env.torns().length, 12);
  await env.advance(3 * MIN);
  assert.equal(env.torns().length, 30);
});

test('a page out of view doesn\'t sweep, but Torn PDA does, and the warboard app counts as not PDA', async () => {
  const hidden = device();
  hidden.store[KEY_STORE] = KEY;
  hidden.tab({ visible: false }).run();
  await hidden.advance(3 * MIN);
  assert.equal(hidden.torns().length, 0);

  const pda = device();
  pda.tab({ visible: false, pda: true }).run();
  await pda.advance(2 * MIN + SEC);
  assert.equal(pda.torns().length, 18);

  const app = device();
  app.store[KEY_STORE] = KEY;
  app.tab({ visible: false, app: true }).run();
  await app.advance(3 * MIN);
  assert.equal(app.torns().length, 0);
});

test('a page that comes back into view sweeps at once when a sweep is due, and not before', async () => {
  const { env, w } = await started();
  w.hide();
  await env.advance(30 * SEC);
  w.show();
  await env.advance(0);
  assert.equal(env.torns().length, 6, 'not due yet');
  w.hide();
  await env.advance(91 * SEC);
  assert.equal(env.torns().length, 6);
  w.show();
  await env.advance(0);
  assert.equal(env.torns().length, 12);
  assert.equal(env.reading().at, T0 + 121 * SEC);
});

test('the six are asked one after another, never two at once', async () => {
  const env = device();
  env.store[KEY_STORE] = KEY;
  env.hold = 'torn';
  env.tab().run();
  await env.advance(0);
  for (let n = 1; n <= 6; n++) {
    assert.equal(env.torns().length, n);
    await env.release();
  }
  assert.equal(env.torns().length, 6);
  assert.ok(env.reading().okAt > 0);
});

test('Torn\'s error stops the sweep, keeps the last good reading, and the next sweep comes a minute later', async () => {
  const { env } = await started();
  env.torn[101] = { error: { code: 17, error: 'Backend error occurred, please try again' } };
  env.torn[100] = up(100, 'Cayman Islands', 1000);
  await env.advance(MIN);
  assert.deepEqual(askedIds(env), IDS.concat([23, 100, 101]));
  const r = env.reading();
  assert.equal(r.error, 'Backend error occurred, please try again (code 17)');
  assert.equal(r.okAt, T0);
  assert.equal(r.npcs[100].cur, 1000, 'what came before the error is kept');
  assert.deepEqual(seen(env)[104], ['up', 'United Kingdom', 53]);
  await env.advance(MIN);
  assert.equal(env.torns().length, 12);
});

test('no answer from Torn is said in words, and the next sweep comes a minute later', async () => {
  const { env } = await started();
  env.torn[23] = null;
  await env.advance(MIN);
  assert.equal(env.reading().error, 'no answer from Torn');
  assert.equal(env.torns().length, 7);
  await env.advance(MIN);
  assert.equal(env.torns().length, 8);
});

test('an answer that isn\'t JSON, or JSON with no profile in it, is said in words', async () => {
  for (const [raw, words] of [['<html>Cloudflare</html>', 'no answer from Torn'], [JSON.stringify({ something: 1 }), 'unexpected answer from Torn']]) {
    const { env } = await started({ torn: { ...READ_1125, 23: { raw } } });
    assert.equal(env.reading().error, words);
    assert.equal(env.torns().length, 1);
  }
});

test('a key Torn won\'t take (codes 2, 10, 13, 18) stops the sweeps; codes 5, 8 and 9 wait 5 minutes', async () => {
  for (const code of [2, 10, 13, 18]) {
    const env = device();
    env.store[KEY_STORE] = KEY;
    env.tornError = { code, error: 'Key error' };
    env.tab().run();
    await env.advance(10 * MIN);
    assert.equal(env.torns().length, 1, 'code ' + code);
    assert.equal(env.reading().stop, true);
    assert.equal(env.reading().error, 'Key error (code ' + code + ')');
  }
  for (const code of [5, 8, 9]) {
    const env = device();
    env.store[KEY_STORE] = KEY;
    env.tornError = { code, error: 'Wait' };
    env.tab().run();
    await env.advance(5 * MIN - SEC);
    assert.equal(env.torns().length, 1, 'code ' + code);
    env.tornError = null;
    await env.advance(SEC);
    assert.equal(env.torns().length, 7, 'code ' + code);
  }
});

test('a sweep time or a wait stored ahead of the clock (the clock was set back) doesn\'t stop the sweeps', async () => {
  // A sweep stored as started 3 hours from now: the device's clock was set back since.
  const ahead = device();
  ahead.store[KEY_STORE] = KEY;
  ahead.store[READING_STORE] = JSON.stringify({ at: T0 + 3 * 60 * MIN });
  ahead.tab().run();
  await ahead.advance(0);
  assert.equal(ahead.torns().length, 6);
  // A wait further off than Torn ever asks for (5 minutes) is from a clock set back too.
  const waiting = device();
  waiting.store[KEY_STORE] = KEY;
  waiting.store[READING_STORE] = JSON.stringify({ wait: T0 + 60 * MIN });
  waiting.tab().run();
  await waiting.advance(0);
  assert.equal(waiting.torns().length, 6);
});

test('the key never reaches the console or the stored reading, even when Torn\'s message holds it', async () => {
  const env = device();
  env.store[KEY_STORE] = KEY;
  env.tornError = { code: 16, error: 'Key ' + KEY + ' has too low an access level' };
  const w = env.tab().run();
  await env.advance(0);
  assert.equal(env.reading().error, 'Key **** has too low an access level (code 16)');
  assert.equal(env.store[READING_STORE].includes(KEY), false);
  assert.equal(w.logs.join('\n').includes(KEY), false);
});

// ---------------------------------------------------------------------------------------------
// The API key
// ---------------------------------------------------------------------------------------------

test('PDA\'s key is used when PDA swaps it in, a key saved on the device beats it, and with neither there are no calls', async () => {
  const pda = device();
  pda.tab({ pda: true }).run();
  await pda.advance(0);
  assert.ok(pda.torns().every((r) => r.url.includes('&key=' + PDA_KEY + '&')));
  assert.equal(pda.torns().length, 6);

  const both = device();
  both.store[KEY_STORE] = '  ' + KEY + ' ';
  both.tab({ pda: true }).run();
  await both.advance(0);
  assert.ok(both.torns().every((r) => r.url.includes('&key=' + KEY + '&')));

  for (const opts of [{}, { app: true }, { pda: true, pdaKey: '' }]) {
    const none = device();
    none.tab(opts).run();
    await none.advance(3 * MIN);
    assert.equal(none.torns().length, 0, JSON.stringify(opts));
  }
});

// ---------------------------------------------------------------------------------------------
// Stored
// ---------------------------------------------------------------------------------------------

test('the reading is stored as a string of JSON, and one handed back already parsed reads the same', async () => {
  const { env } = await started();
  assert.equal(typeof env.store[READING_STORE], 'string');
  const parsed = device({ store: { ...env.store } });
  parsed.now = T0 + 30 * SEC;
  parsed.tab({ getValue: (store, k, d) => (k in store ? (k === READING_STORE ? JSON.parse(store[k]) : store[k]) : d) }).run();
  await parsed.advance(0);
  assert.equal(parsed.torns().length, 0, 'the sweep 30 s ago still counts');
});

test('a stored reading that won\'t parse, or holds nonsense, is no reading at all', async () => {
  for (const bad of ['{not json', '"a string"', '42', JSON.stringify({ at: 'soon', npcs: { 23: 'x', 100: { state: 'flying', cur: 'lots' } }, trail: 'Mexico' })]) {
    const env = device({ store: { [KEY_STORE]: KEY, [READING_STORE]: bad } });
    env.tab().run();
    await env.advance(0);
    assert.equal(env.torns().length, 6, bad);
    assert.deepEqual(seen(env)[101], ['beaten', 'Mexico', 0], bad);
  }
});

test('a storage that won\'t save: the tab keeps its own copy, and still sweeps once a minute', async () => {
  const env = device({ store: { [KEY_STORE]: KEY } });
  env.tab({ setValue: () => { throw new Error('QuotaExceededError'); } }).run();
  await env.advance(3 * MIN);
  assert.equal(env.torns().length, 24);
  assert.equal(READING_STORE in env.store, false);
});

test('a storage that drops writes without a word is caught the same way', async () => {
  const env = device({ store: { [KEY_STORE]: KEY } });
  env.tab({ setValue: () => {} }).run();
  await env.advance(2 * MIN);
  assert.equal(env.torns().length, 18);
});

test('a storage that throws on reads is no key and no reading, and with PDA\'s key it still sweeps', async () => {
  const env = device({ store: { [KEY_STORE]: KEY } });
  env.tab({ getValue: () => { throw new Error('no'); } }).run();
  await env.advance(MIN);
  assert.equal(env.torns().length, 0);
  const pda = device();
  pda.tab({ pda: true, getValue: () => { throw new Error('no'); } }).run();
  await pda.advance(MIN + SEC);
  assert.equal(pda.torns().length, 12);
});

test('with no GM functions at all, the script still runs on PDA\'s key and breaks nothing', async () => {
  const env = device();
  const w = env.tab({ pda: true, gm: false }).run();
  await env.advance(MIN);
  assert.deepEqual(w.logs, [RUNNING]);
  assert.equal(env.requests.filter((r) => r.via === 'fetch' && r.url.startsWith('https://api.torn.com/')).length, 12);
});
