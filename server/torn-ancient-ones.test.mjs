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

// ---------------------------------------------------------------------------------------------
// The box
// ---------------------------------------------------------------------------------------------

const boxOf = (w) => w.document.getElementById('tao-box');
const summary = (w) => boxOf(w).querySelector('.tao-summary').textContent;
const footer = (w) => boxOf(w).querySelector('.tao-age').textContent;
const lineEl = (w, id) => boxOf(w).querySelector('.tao-line[data-id="' + id + '"]');
// A line's own parts (name, where, life, state, Attack), joined by two spaces.
function lineText(w, id) {
  const el = lineEl(w, id);
  return el ? [...el.children].filter((c) => !c.classList.contains('tao-note')).map((c) => c.textContent).join('  ') : null;
}
// Every line, in order, as text.
const lineTexts = (w) => [...boxOf(w).querySelectorAll('.tao-line')].map((el) => lineText(w, Number(el.getAttribute('data-id'))));
// The notes under a line.
const notes = (w, id) => [...lineEl(w, id).querySelectorAll('.tao-note')].map((n) => n.textContent);

// A new device holding what this one stored, with its clock ms later and Torn giving the same
// answers: as when the owner comes back to Torn after a while.
async function later(env, ms, tabOpts = {}) {
  const next = device({ store: { ...env.store }, torn: env.torn, tornstats: env.tornstats });
  next.now = env.now + ms;
  const w = next.tab(tabOpts).run();
  await next.advance(0);
  return { env: next, w };
}

test('the box: bottom left, titled "Ancient Ones", in its own styles', async () => {
  const { w } = await started();
  const box = boxOf(w);
  assert.equal(box.parentNode, w.document.body);
  assert.equal(box.querySelector('.tao-title').textContent, 'Ancient Ones');
  const css = w.document.getElementById('tao-styles').textContent;
  assert.match(css, /#tao-box\{position:fixed;left:20px;bottom:20px;[^}]*max-width:320px;background:rgba\(11,15,25,0\.95\);color:#f0a04b;[^}]*font:12px Verdana/);
  assert.match(css, /\.tao-head\{[^}]*touch-action:none/);
});

test('the lines at 11:25 TCT: M\'aol first, then the praetorians nearest country first, each in its own words', async () => {
  const { w } = await started({ torn: READ_1125 });
  assert.deepEqual(lineTexts(w), [
    'M\'aol  Torn City  100%  shielded, 4 praetorians up',
    'Nol\'dasaym  Mexico  beaten',
    'Dyno\'salam  Cayman Islands  33%  Attack',
    'Asmol\'yand  Canada  89%  Attack',
    'Sylo\'nadam  Hawaii  99%  Attack',
    'Ladso\'myna  United Kingdom  53%  Attack',
  ]);
  assert.equal(summary(w), '4 of 5 praetorians up. M\'aol shielded.');
  assert.ok(lineEl(w, 101).classList.contains('tao-down'));
  assert.equal(lineEl(w, 100).classList.contains('tao-down'), false);
});

test('the lines at 12:15 TCT: M\'aol shielded in the Cayman Islands, three beaten', async () => {
  const { w } = await started({ torn: READ_1215 });
  assert.deepEqual(lineTexts(w), [
    'M\'aol  Cayman Islands  100%  shielded, 2 praetorians up',
    'Nol\'dasaym  Mexico  beaten',
    'Dyno\'salam  Cayman Islands  beaten',
    'Asmol\'yand  Canada  55%  Attack',
    'Sylo\'nadam  Hawaii  98%  Attack',
    'Ladso\'myna  United Kingdom  beaten',
  ]);
  assert.equal(summary(w), '2 of 5 praetorians up. M\'aol shielded.');
});

test('one praetorian left: "1 praetorian up"; one with no known country goes last; dormant says so', async () => {
  const { w } = await started({ torn: { ...allBeaten('Awoken'), 100: profile(100, 'Awoken in Atlantis', 1000), 102: profile(102, 'Dormant in Canada', 5000) } });
  assert.equal(lineText(w, 23), 'M\'aol  Torn City  100%  shielded, 1 praetorian up');
  assert.equal(summary(w), '1 of 5 praetorians up. M\'aol shielded.');
  assert.deepEqual([...boxOf(w).querySelectorAll('.tao-line')].map((el) => Number(el.getAttribute('data-id'))), [23, 101, 102, 103, 104, 100]);
  assert.equal(lineText(w, 102), 'Asmol\'yand  Canada  dormant');
  assert.equal(lineText(w, 100), 'Dyno\'salam  Awoken in Atlantis  1%  Attack');
});

test('a fall the script saw in time shows its time; one it didn\'t, none', async () => {
  const { env, w } = await started();
  env.torn[100] = beaten(100, 'Cayman Islands');
  await env.advance(MIN);
  assert.equal(lineText(w, 100), 'Dyno\'salam  Cayman Islands  beaten 10:41 TCT');
  assert.equal(lineText(w, 101), 'Nol\'dasaym  Mexico  beaten');
});

test('once all five are down, M\'aol can be hit: an Attack link, his country, and how he moves', async () => {
  const { env, w } = await started({ torn: allBeaten('Awoken in Mexico') });
  assert.equal(summary(w), 'M\'aol can be hit: in Mexico.');
  assert.equal(lineText(w, 23), 'M\'aol  Mexico  100%  Attack');
  assert.deepEqual(notes(w, 23), ['moves about every 15 min']);
  env.torn[23] = up(23, 'Cayman Islands', 140000000);
  await env.advance(MIN);
  assert.equal(summary(w), 'M\'aol can be hit: in Cayman Islands.');
  assert.equal(lineText(w, 23), 'M\'aol  Cayman Islands  92%  Attack');
  assert.deepEqual(notes(w, 23), ['moves about every 15 min, here since 10:41 TCT']);
});

test('M\'aol can be hit only when all five are down, whatever his own words say', async () => {
  const shielded = await started({ torn: { ...allBeaten('Awoken in Mexico'), 104: up(104, 'United Kingdom') } });
  assert.equal(lineText(shielded.w, 23), 'M\'aol  Mexico  100%  shielded, 1 praetorian up');
  assert.equal(lineEl(shielded.w, 23).querySelector('.tao-attack'), null);
  const open = await started({ torn: allBeaten('Awoken') });
  assert.equal(lineText(open.w, 23), 'M\'aol  Torn City  100%  Attack');
  assert.equal(summary(open.w), 'M\'aol can be hit: in Torn City.');
  const odd = await started({ torn: allBeaten('Awoken in Atlantis') });
  assert.equal(summary(odd.w), 'M\'aol can be hit: Awoken in Atlantis.');
});

test('the summary with no key, before any answer, and when Torn never answered', async () => {
  const none = device();
  const a = none.tab().run();
  await none.advance(0);
  assert.equal(summary(a), 'Needs an API key.');
  assert.equal(footer(a), '');
  const waiting = device();
  waiting.store[KEY_STORE] = KEY;
  waiting.hold = 'torn';
  const b = waiting.tab().run();
  await waiting.advance(0);
  assert.equal(summary(b), 'Reading Torn...');
  assert.equal(footer(b), 'Reading Torn...');
  const failing = device();
  failing.store[KEY_STORE] = KEY;
  failing.torn[23] = null;
  const c = failing.tab().run();
  await failing.advance(0);
  assert.equal(summary(c), 'Couldn\'t read Torn.');
  assert.equal(footer(c), 'Couldn\'t read Torn: no answer from Torn.');
});

test('all asleep: the next summoning, 48 h after a seen death of M\'aol', async () => {
  const { env, w } = await started({ torn: allBeaten('Awoken in Mexico') });
  env.torn[23] = beaten(23, 'Mexico');
  await env.advance(MIN);
  assert.equal(lineText(w, 23), 'M\'aol  Mexico  beaten 10:41 TCT');
  assert.equal(summary(w), 'All asleep. Next summoning possible from Oct 28 10:41 TCT (48 h after M\'aol\'s death).');
  const after = await later(env, 48 * 60 * MIN);
  assert.equal(summary(after.w), 'All asleep. Next summoning possible now (48 h after M\'aol\'s death).');
  const unseen = await started({ torn: { ...allBeaten(), 23: beaten(23, 'Mexico') } });
  assert.equal(summary(unseen.w), 'All asleep. Next summoning possible 48 h after M\'aol\'s death.');
});

test('all asleep, by the window\'s edges: 10:00 TCT on Oct 26 to 23:59:59 TCT on Oct 31', async () => {
  const asleep = { ...allBeaten(), 23: beaten(23, 'Mexico') };
  const at = async (ms) => {
    const env = device({ torn: asleep });
    env.now = ms;
    env.store[KEY_STORE] = KEY;
    const w = env.tab().run();
    await env.advance(0);
    return summary(w);
  };
  assert.equal(await at(Date.UTC(2026, 9, 26, 9, 59, 59)), 'All asleep. Summoning opens 10:00 TCT.');
  assert.equal(await at(Date.UTC(2026, 9, 25, 12, 0)), 'All asleep. Summoning opens Oct 26 10:00 TCT.');
  assert.equal(await at(Date.UTC(2026, 9, 26, 10, 0, 0)), 'All asleep. Next summoning possible 48 h after M\'aol\'s death.');
  assert.equal(await at(Date.UTC(2026, 9, 31, 23, 59, 59)), 'All asleep. Next summoning possible 48 h after M\'aol\'s death.');
  assert.equal(await at(Date.UTC(2026, 10, 1, 0, 0, 0)), 'All asleep. No more summonings this Halloween.');
  // A death less than 48 h before the window ends: no more this year.
  const late = device({ torn: allBeaten('Awoken in Mexico') });
  late.store[KEY_STORE] = KEY;
  late.now = Date.UTC(2026, 9, 30, 0, 0);
  const lw = late.tab().run();
  await late.advance(0);
  late.torn[23] = beaten(23, 'Mexico');
  await late.advance(MIN);
  assert.equal(summary(lw), 'All asleep. No more summonings this Halloween.');
});

test('links: a name goes to the profile, Attack to the fight, both in this tab; Attack only for one that can be hit now', async () => {
  const { w } = await started({ torn: READ_1125 });
  assert.equal(lineEl(w, 100).querySelector('.tao-name').getAttribute('href'), 'https://www.torn.com/profiles.php?XID=100');
  assert.equal(lineEl(w, 100).querySelector('.tao-attack').getAttribute('href'), 'https://www.torn.com/loader.php?sid=attack&user2ID=100');
  assert.equal(lineEl(w, 23).querySelector('.tao-name').getAttribute('href'), 'https://www.torn.com/profiles.php?XID=23');
  assert.equal(lineEl(w, 101).querySelector('.tao-attack'), null);
  assert.equal(lineEl(w, 23).querySelector('.tao-attack'), null);
  assert.deepEqual([...boxOf(w).querySelectorAll('.tao-attack')].map((a) => a.parentNode.getAttribute('data-id')), ['100', '102', '103', '104']);
  assert.ok([...boxOf(w).querySelectorAll('a')].every((a) => !a.hasAttribute('target')));
});

test('a change is highlighted, with the title bar, for 5 minutes: there at 4, gone at 6', async () => {
  const { env, w } = await started();
  const head = () => boxOf(w).querySelector('.tao-head');
  assert.equal(head().classList.contains('tao-new'), false, 'the first reading changes nothing');
  env.torn[100] = beaten(100, 'Cayman Islands');
  await env.advance(MIN);
  await env.advance(4 * MIN);
  assert.ok(lineEl(w, 100).classList.contains('tao-new'));
  assert.ok(head().classList.contains('tao-new'));
  assert.equal(lineEl(w, 102).classList.contains('tao-new'), false);
  await env.advance(2 * MIN);
  assert.equal(lineEl(w, 100).classList.contains('tao-new'), false);
  assert.equal(head().classList.contains('tao-new'), false);
});

test('M\'aol coming within reach is highlighted on his line too', async () => {
  const { env, w } = await started({ torn: { ...allBeaten('Awoken in Mexico'), 104: up(104, 'United Kingdom', 1000) } });
  env.torn[104] = beaten(104, 'United Kingdom');
  await env.advance(MIN);
  assert.ok(lineEl(w, 23).classList.contains('tao-new'));
  assert.ok(lineEl(w, 104).classList.contains('tao-new'));
});

test('Torn\'s words go in as text, never as HTML', async () => {
  const { w } = await started({ torn: { ...READ_1125, 102: profile(102, 'Sleeping <b>soundly</b>', 1000, { state: 'Okay' }) } });
  assert.equal(lineText(w, 102), 'Asmol\'yand  Sleeping <b>soundly</b>  1%');
  assert.equal(boxOf(w).querySelector('b'), null);
});

test('life left is a whole percent, rounded down, but at least 1% while any is left', async () => {
  const { w } = await started({ torn: { ...READ_1125, 100: up(100, 'Cayman Islands', 1), 102: up(102, 'Canada', 217799999) } });
  assert.equal(lineText(w, 100), 'Dyno\'salam  Cayman Islands  1%  Attack');
  assert.equal(lineText(w, 102), 'Asmol\'yand  Canada  99%  Attack');
});

test('the footer: how long ago Torn answered, or why it didn\'t, with the key cut out', async () => {
  const { env, w } = await started();
  assert.equal(footer(w), 'updated 0 s ago');
  await env.advance(40 * SEC);
  assert.equal(footer(w), 'updated 40 s ago');
  env.torn[23] = null;
  await env.advance(2 * MIN);
  assert.equal(footer(w), 'Couldn\'t read Torn: no answer from Torn. Last answer 2 min ago.');
  const hidden = await later(env, 3 * 60 * MIN, { visible: false });
  assert.equal(footer(hidden.w), 'Couldn\'t read Torn: no answer from Torn. Last answer 3 h ago.');
  const refused = device();
  refused.store[KEY_STORE] = KEY;
  refused.tornError = { code: 2, error: 'Incorrect key ' + KEY };
  const r = refused.tab().run();
  await refused.advance(0);
  assert.equal(footer(r), 'Torn won\'t take the key: Incorrect key **** (code 2). Save a new key.');
  assert.equal(boxOf(r).textContent.includes(KEY), false);
});

test('a hidden tab still draws, within 5 seconds, the sweep another tab made', async () => {
  const env = device();
  env.store[KEY_STORE] = KEY;
  env.tab().run();
  const quiet = env.tab({ visible: false }).run();
  await env.advance(0);
  env.torn[100] = beaten(100, 'Cayman Islands');
  await env.advance(MIN + 5 * SEC);
  assert.equal(lineText(quiet, 100), 'Dyno\'salam  Cayman Islands  beaten 10:41 TCT');
});

test('lines with nothing new in them are left as they are, not built again', async () => {
  const { env, w } = await started({ torn: READ_1215 });
  const before = lineEl(w, 102);
  await env.advance(30 * SEC);
  assert.equal(lineEl(w, 102), before);
});

// ---------------------------------------------------------------------------------------------
// M'aol's route
// ---------------------------------------------------------------------------------------------

// Where each praetorian awoke on 2026-10-26.
const PLACE = { 100: 'Cayman Islands', 101: 'Mexico', 102: 'Canada', 103: 'Hawaii', 104: 'United Kingdom' };
// All six standing: the praetorians where they awoke, M'aol shielded in Torn City.
const allUp = () => ({ 23: READ_1125[23], 100: up(100, PLACE[100]), 101: up(101, PLACE[101]), 102: up(102, PLACE[102]), 103: up(103, PLACE[103]), 104: up(104, PLACE[104]) });
// The praetorians falling in this order, one a minute.
async function fall(env, ids) {
  for (const id of ids) {
    env.torn[id] = beaten(id, PLACE[id]);
    await env.advance(MIN);
  }
}
// M'aol seen in each of these places in turn, one a minute.
async function go(env, places) {
  for (const place of places) {
    env.torn[23] = up(23, place);
    await env.advance(MIN);
  }
}
// M'aol's notes on how he moves: where he is since when, his next stop, and his route.
const maolNotes = (w) => notes(w, 23).filter((n) => /^(moves|next|route) /.test(n));

test('his route from his moves: once he has been seen in all five countries, in the order first seen', async () => {
  const { env, w } = await started({ torn: allBeaten('Awoken in Mexico') });
  await go(env, ['Cayman Islands', 'United Kingdom', 'Cayman Islands', 'Canada']);
  assert.deepEqual(maolNotes(w), ['moves about every 15 min, here since 10:44 TCT']);
  await go(env, ['Hawaii']);
  assert.deepEqual(maolNotes(w), [
    'moves about every 15 min, here since 10:45 TCT',
    'next Mexico about 11:00 TCT',
    'route Mexico > Cayman Islands > United Kingdom > Canada > Hawaii',
  ]);
  assert.deepEqual(env.reading().trail, ['Mexico', 'Cayman Islands', 'United Kingdom', 'Cayman Islands', 'Canada', 'Hawaii']);
});

test('his route from the falls: each timed by the script, at least 30 s apart', async () => {
  const { env, w } = await started({ torn: allUp() });
  await fall(env, [102, 100, 104, 101, 103]);
  assert.deepEqual(maolNotes(w), ['moves about every 15 min', 'route Canada > Cayman Islands > United Kingdom > Mexico > Hawaii'], 'no next stop from Torn City');
  await go(env, ['Canada']);
  assert.deepEqual(maolNotes(w), [
    'moves about every 15 min, here since 10:46 TCT',
    'next Cayman Islands about 11:01 TCT',
    'route Canada > Cayman Islands > United Kingdom > Mexico > Hawaii',
  ]);
});

test('no route from the falls when two came in one sweep, a country is missing, or two share one', async () => {
  const one = await started({ torn: allUp() });
  one.env.torn[102] = beaten(102, 'Canada');
  one.env.torn[100] = beaten(100, 'Cayman Islands');
  await one.env.advance(MIN);
  await fall(one.env, [104, 101, 103]);
  assert.deepEqual(maolNotes(one.w), ['moves about every 15 min']);

  const missing = await started({ torn: allUp() });
  await fall(missing.env, [102, 100, 104, 101]);
  missing.env.torn[103] = profile(103, 'Dormant', 0, { state: 'Abroad' });
  await missing.env.advance(MIN);
  assert.deepEqual(maolNotes(missing.w), ['moves about every 15 min']);

  const shared = await started({ torn: { ...allUp(), 103: up(103, 'Canada') } });
  await fall(shared.env, [102, 100, 104, 101]);
  shared.env.torn[103] = beaten(103, 'Canada');
  await shared.env.advance(MIN);
  assert.deepEqual(maolNotes(shared.w), ['moves about every 15 min']);
});

test('his moves beat the falls when they disagree', async () => {
  const { env, w } = await started({ torn: allUp() });
  await fall(env, [102, 100, 104, 101, 103]);
  await go(env, ['Mexico', 'Hawaii', 'Canada', 'Cayman Islands']);
  assert.deepEqual(maolNotes(w).slice(1), ['next United Kingdom about 11:04 TCT', 'route Canada > Cayman Islands > United Kingdom > Mexico > Hawaii']);
  await go(env, ['United Kingdom']);
  assert.deepEqual(maolNotes(w).slice(1), ['next Mexico about 11:05 TCT', 'route Mexico > Hawaii > Canada > Cayman Islands > United Kingdom']);
});

test('the next stop has no time when his arrival wasn\'t seen in time, and there is none from Torn City', async () => {
  const { env, w } = await started({ torn: allBeaten('Awoken in Mexico') });
  await go(env, ['Cayman Islands', 'United Kingdom', 'Canada', 'Hawaii']);
  // Out of view for 4 minutes, while he moves on to Mexico.
  w.hide();
  env.torn[23] = up(23, 'Mexico');
  await env.advance(4 * MIN);
  w.show();
  await env.advance(0);
  assert.deepEqual(maolNotes(w), ['moves about every 15 min', 'next Cayman Islands', 'route Mexico > Cayman Islands > United Kingdom > Canada > Hawaii']);
  env.torn[23] = up(23, 'Torn City');
  await env.advance(MIN);
  assert.deepEqual(maolNotes(w), ['moves about every 15 min, here since 10:49 TCT', 'route Mexico > Cayman Islands > United Kingdom > Canada > Hawaii']);
});

test('his moves while shielded don\'t count toward his route', async () => {
  const env = device({ torn: READ_1215 });
  env.now = Date.UTC(2026, 9, 26, 12, 15, 25);
  env.store[KEY_STORE] = KEY;
  const w = env.tab().run();
  await env.advance(0);
  await go(env, ['Mexico', 'United Kingdom']);
  assert.equal(lineText(w, 23), 'M\'aol  United Kingdom  100%  shielded, 2 praetorians up');
  assert.deepEqual(env.reading().trail, []);
  env.torn[102] = beaten(102, 'Canada');
  env.torn[103] = beaten(103, 'Hawaii');
  await env.advance(MIN);
  assert.deepEqual(env.reading().trail, ['United Kingdom']);
});

test('a new summoning empties his trail and TornStats\' times', async () => {
  const { env, w } = await started({ torn: allBeaten('Awoken in Mexico') });
  await go(env, ['Cayman Islands', 'United Kingdom', 'Canada', 'Hawaii']);
  env.tornstats = [{ torn_id: 23, name: 'M\'aol', status: 'Dormant in Hawaii', current_health: 0, max_health: 151200000, hosped_at: '2026-10-26T10:44:30.000000Z' }];
  env.torn[23] = beaten(23, 'Hawaii');
  await env.advance(MIN + 5 * SEC);
  assert.equal(env.reading().trail.length, 5);
  assert.deepEqual(Object.keys(env.reading().fell), ['23']);
  env.torn = allUp();
  await env.advance(MIN);
  assert.deepEqual(env.reading().trail, []);
  assert.deepEqual(env.reading().fell, {});
  assert.equal(lineText(w, 23), 'M\'aol  Torn City  100%  shielded, 5 praetorians up');
});

// ---------------------------------------------------------------------------------------------
// Asking TornStats
// ---------------------------------------------------------------------------------------------

// TornStats' feed of the six at 12:15 TCT on 2026-10-26: the fields the script reads, and a few
// more, as they came.
const TS_1215 = [
  {"torn_id":23,"name":"M'aol","status":"Awoken in Mexico","current_health":151200000,"max_health":151200000,"hosped_at":null,"updated_at":"2026-10-26T12:01:02.000000Z"},
  {"torn_id":100,"name":"Dyno'salam","status":"Dormant in Cayman Islands","current_health":0,"max_health":172500000,"hosped_at":"2026-10-26T11:52:37.000000Z","updated_at":"2026-10-26T11:53:01.000000Z"},
  {"torn_id":101,"name":"Nol'dasaym","status":"Dormant in Mexico","current_health":0,"max_health":129600000,"hosped_at":"2026-10-26T10:24:02.000000Z","updated_at":"2026-10-26T10:24:02.000000Z"},
  {"torn_id":102,"name":"Asmol'yand","status":"Awoken in Canada","current_health":122519445,"max_health":217800000,"hosped_at":null,"updated_at":"2026-10-26T12:15:01.000000Z"},
  {"torn_id":103,"name":"Sylo'nadam","status":"Awoken in Hawaii","current_health":199933784,"max_health":202950000,"hosped_at":null,"updated_at":"2026-10-26T12:15:01.000000Z"},
  {"torn_id":104,"name":"Ladso'myna","status":"Dormant in United Kingdom","current_health":0,"max_health":222000000,"hosped_at":"2026-10-26T11:52:37.000000Z","updated_at":"2026-10-26T11:53:02.000000Z"},
];
const AT_1215 = Date.UTC(2026, 9, 26, 12, 15, 25);
// One feed entry: a defeat time for one of the six.
const fellEntry = (id, iso) => ({ torn_id: id, name: READ_1125[id].name, status: 'Dormant', current_health: 0, max_health: 1, hosped_at: iso });

// A device at 12:15:25 TCT on 2026-10-26, with Torn's and TornStats' answers from then and the
// key saved, and one tab that has read Torn, and 5 s later TornStats.
async function at1215(opts = {}, tabOpts = {}) {
  const env = device({ torn: READ_1215, tornstats: TS_1215, ...opts });
  env.now = AT_1215;
  env.store[KEY_STORE] = KEY;
  const w = env.tab(tabOpts).run();
  await env.advance(5 * SEC);
  return { env, w };
}

test('a beaten one with no time of its own gets TornStats\' time', async () => {
  const { env, w } = await at1215();
  assert.equal(lineText(w, 101), 'Nol\'dasaym  Mexico  beaten 10:24 TCT');
  assert.equal(lineText(w, 100), 'Dyno\'salam  Cayman Islands  beaten 11:52 TCT');
  assert.equal(lineText(w, 104), 'Ladso\'myna  United Kingdom  beaten 11:52 TCT');
  assert.deepEqual(env.reading().fell, { 100: Date.parse('2026-10-26T11:52:37Z'), 101: Date.parse('2026-10-26T10:24:02Z'), 104: Date.parse('2026-10-26T11:52:37Z') });
});

test('TornStats\' times give the route from the falls, but two under 30 s apart give none', async () => {
  const at = Date.UTC(2026, 9, 26, 12, 30);
  const feed = (ukAt) => [fellEntry(101, '2026-10-26T10:24:02Z'), fellEntry(100, '2026-10-26T11:52:37Z'), fellEntry(104, ukAt), fellEntry(102, '2026-10-26T12:10:00Z'), fellEntry(103, '2026-10-26T12:20:00Z')];
  for (const [ukAt, route] of [['2026-10-26T11:52:37Z', null], ['2026-10-26T11:53:30Z', 'route Mexico > Cayman Islands > United Kingdom > Canada > Hawaii']]) {
    const env = device({ torn: allBeaten('Awoken in Mexico'), tornstats: feed(ukAt) });
    env.now = at;
    env.store[KEY_STORE] = KEY;
    const w = env.tab().run();
    await env.advance(5 * SEC);
    assert.deepEqual(maolNotes(w).filter((n) => n.startsWith('route ')), route ? [route] : [], ukAt);
  }
});

test('TornStats is asked only while its time for a beaten one is missing, even one the script timed, and at most every 5 minutes across tabs', async () => {
  const standing = await started({ torn: allUp() });
  await standing.env.advance(10 * MIN);
  assert.equal(standing.env.stats().length, 0, 'none beaten');

  const { env } = await at1215();
  assert.equal(env.stats().length, 1);
  await env.advance(15 * MIN);
  assert.equal(env.stats().length, 1, 'every time known');

  const two = device({ torn: allUp() });
  two.store[KEY_STORE] = KEY;
  two.tab().run();
  two.tab().run();
  await two.advance(0);
  two.torn[100] = beaten(100, 'Cayman Islands');
  await two.advance(MIN);
  assert.equal(two.stats().length, 1, 'the script timed the fall at 10:41, and TornStats is asked all the same');
  await two.advance(5 * MIN - SEC);
  assert.equal(two.stats().length, 1);
  await two.advance(SEC);
  assert.equal(two.stats().length, 2);
});

test('TornStats is not asked from a page out of view, except in Torn PDA', async () => {
  const first = await at1215({ tornstats: [] });
  assert.equal(first.env.stats().length, 1);
  const hidden = await later(first.env, 10 * MIN, { visible: false });
  await hidden.env.advance(10 * MIN);
  assert.equal(hidden.env.stats().length, 0);
  const pda = await later(first.env, 10 * MIN, { visible: false, pda: true });
  await pda.env.advance(5 * SEC);
  assert.equal(pda.env.stats().length, 1);
});

test('a TornStats ask stored ahead of the clock (the clock was set back) doesn\'t stop the asks', async () => {
  const env = device({ torn: READ_1215, tornstats: TS_1215 });
  env.now = AT_1215;
  env.store[KEY_STORE] = KEY;
  env.store[READING_STORE] = JSON.stringify({ fellAskedAt: AT_1215 + 3 * 60 * MIN });
  env.tab().run();
  await env.advance(5 * SEC);
  assert.equal(env.stats().length, 1);
});

test('the request to TornStats is a plain GET of its feed, with no key and no cookies', async () => {
  const { env } = await at1215();
  const r = env.stats()[0];
  assert.equal(r.url, TORNSTATS);
  assert.equal(r.method, 'GET');
  assert.equal(r.anonymous, true);
  assert.equal(r.headers, undefined);
});

test('a time from TornStats counts only when no more than 8 days old, not in the future, and not from before the script last saw it standing', async () => {
  const day = 24 * 60 * MIN;
  for (const [iso, shown] of [
    [new Date(T0 - 9 * day).toISOString(), 'beaten'],
    [new Date(T0 - 7 * day).toISOString(), 'beaten Oct 19 10:40 TCT'],
    [new Date(T0 + 2 * MIN).toISOString(), 'beaten'],
    [new Date(T0 + 30 * SEC).toISOString(), 'beaten 10:40 TCT'],
  ]) {
    const { env, w } = await started({ tornstats: [fellEntry(101, iso)] });
    await env.advance(5 * SEC);
    assert.equal(lineText(w, 101), 'Nol\'dasaym  Mexico  ' + shown, iso);
  }
  for (const [iso, shown] of [[new Date(T0 - 2 * MIN).toISOString(), 'beaten 10:41 TCT'], [new Date(T0 + 30 * SEC).toISOString(), 'beaten 10:40 TCT']]) {
    const { env, w } = await started({ tornstats: [fellEntry(100, iso)] });
    env.torn[100] = beaten(100, 'Cayman Islands');
    await env.advance(MIN + 5 * SEC);
    assert.equal(lineText(w, 100), 'Dyno\'salam  Cayman Islands  ' + shown, iso);
  }
});

test('an answer from TornStats that can\'t be read, or none, changes nothing, and the next try is 5 minutes later', async () => {
  for (const feed of ['<html>busy</html>', null, '{"a":1}', JSON.stringify([{ torn_id: 101, hosped_at: 'soon' }, { torn_id: 999, hosped_at: '2026-10-26T10:00:00Z' }])]) {
    const { env, w } = await started({ tornstats: feed });
    await env.advance(5 * SEC);
    assert.equal(env.stats().length, 1, String(feed));
    assert.equal(lineText(w, 101), 'Nol\'dasaym  Mexico  beaten', String(feed));
    assert.deepEqual(env.reading().fell, {}, String(feed));
    await env.advance(5 * MIN);
    assert.equal(env.stats().length, 2, String(feed));
  }
});

test('a TornStats request still out doesn\'t hold up a sweep, and a sweep still out doesn\'t hold up TornStats', async () => {
  const { env } = await started();
  env.hold = 'tornstats';
  await env.advance(3 * MIN);
  assert.equal(env.stats().length, 1);
  assert.equal(env.torns().length, 24);

  const other = await started();
  await other.env.advance(5 * SEC);
  assert.equal(other.env.stats().length, 1);
  other.env.hold = 'torn';
  await other.env.advance(5 * MIN);
  assert.equal(other.env.torns().length, 7, 'the sweep at 10:41 still waits on M\'aol');
  assert.equal(other.env.stats().length, 2);
});

test('with no GM_xmlhttpRequest, TornStats can\'t be read, and nothing else changes', async () => {
  const { env, w } = await started({ tornstats: [fellEntry(101, '2026-10-26T10:24:02Z')] }, { xhr: false });
  await env.advance(5 * SEC);
  assert.equal(env.stats().length, 1);
  assert.equal(env.stats()[0].via, 'fetch');
  assert.equal(lineText(w, 101), 'Nol\'dasaym  Mexico  beaten');
  assert.equal(env.torns().length, 6);
});

test('the next summoning counts from TornStats\' time for M\'aol\'s death', async () => {
  const { env, w } = await started({ torn: { ...allBeaten(), 23: beaten(23, 'Mexico') }, tornstats: [fellEntry(23, '2026-10-26T10:31:15.000000Z')] });
  await env.advance(5 * SEC);
  assert.equal(lineText(w, 23), 'M\'aol  Mexico  beaten 10:31 TCT');
  assert.equal(summary(w), 'All asleep. Next summoning possible from Oct 28 10:31 TCT (48 h after M\'aol\'s death).');
});

// ---------------------------------------------------------------------------------------------
// Where to fly
// ---------------------------------------------------------------------------------------------

// One praetorian read with each of these lives in turn, one a minute, from the first sweep at
// 10:40 TCT. The others stand where they awoke, losing nothing; M'aol is shielded.
async function bleeding(id, lives) {
  const { env, w } = await started({ torn: { ...allUp(), [id]: up(id, PLACE[id], lives[0]) } });
  for (const life of lives.slice(1)) {
    env.torn[id] = up(id, PLACE[id], life);
    await env.advance(MIN);
  }
  return { env, w };
}
const M = 1000000;

test('a standing praetorian\'s death estimate: its loss over 2 minutes or more, counted from its newest reading', async () => {
  const short = await bleeding(102, [100 * M, 99 * M]);
  assert.deepEqual(notes(short.w, 102), ['airstrip 27 min | BCT 12 min'], 'a minute of history is too little');
  const { env, w } = await bleeding(102, [100 * M, 99 * M, 98 * M]);
  assert.deepEqual(notes(w, 102), ['dies about 12:20 TCT | airstrip 27 min: 71 min to spare | BCT 12 min: 86 min to spare']);
  // No readings for 3 minutes: the estimate stays, and the minutes to spare go down.
  w.hide();
  await env.advance(3 * MIN);
  assert.deepEqual(notes(w, 102), ['dies about 12:20 TCT | airstrip 27 min: 68 min to spare | BCT 12 min: 83 min to spare']);
});

test('the rate counts only the last 10 minutes of its history', async () => {
  const lives = [100, 95, 90, 89, 88, 87, 86, 85, 84, 83, 82, 81, 80].map((v) => v * M);
  const { w } = await bleeding(102, lives);
  assert.deepEqual(notes(w, 102), ['dies about 12:12 TCT | airstrip 27 min: 53 min to spare | BCT 12 min: 68 min to spare']);
});

test('no estimate with no loss, or with life going up', async () => {
  const still = await bleeding(102, [100 * M, 100 * M, 100 * M]);
  assert.deepEqual(notes(still.w, 102), ['airstrip 27 min | BCT 12 min']);
  const healing = await bleeding(102, [98 * M, 99 * M, 100 * M]);
  assert.deepEqual(notes(healing.w, 102), ['airstrip 27 min | BCT 12 min']);
});

test('the flight minutes to each of the eleven countries: 70% of the standard time by airstrip, 30% by BCT', async () => {
  const minutes = { 'Mexico': [17, 7], 'Cayman Islands': [23, 10], 'Canada': [27, 12], 'Hawaii': [89, 38], 'United Kingdom': [106, 45], 'Argentina': [111, 47],
    'Switzerland': [116, 50], 'Japan': [149, 64], 'China': [160, 69], 'UAE': [180, 77], 'South Africa': [197, 85] };
  for (const [country, [airstrip, bct]] of Object.entries(minutes)) {
    const { w } = await started({ torn: { ...READ_1125, 100: up(100, country) } });
    assert.deepEqual(notes(w, 100), ['airstrip ' + airstrip + ' min | BCT ' + bct + ' min'], country);
  }
});

test('a flight that lands less than 2 minutes before the estimate is too late', async () => {
  const soon = await bleeding(101, [12 * M, 11 * M, 10 * M]);
  assert.deepEqual(notes(soon.w, 101), ['dies about 10:52 TCT | airstrip 17 min: too late | BCT 7 min: 3 min to spare']);
  const under = await bleeding(101, [2 * M + 8983333, M + 8983333, 8983333]);
  assert.match(notes(under.w, 101)[0], /\| BCT 7 min: too late$/);
  const edge = await bleeding(101, [11 * M, 10 * M, 9 * M]);
  assert.match(notes(edge.w, 101)[0], /\| BCT 7 min: 2 min to spare$/);
});

test('no note for one beaten, or standing where no flight goes', async () => {
  const { w } = await started({ torn: { ...READ_1125, 100: profile(100, 'Awoken in Atlantis', 1000) } });
  assert.deepEqual(notes(w, 100), []);
  assert.deepEqual(notes(w, 101), []);
});

// M'aol hittable with his route known from the falls (Mexico, Cayman Islands, United Kingdom,
// Canada, Hawaii, from 10:41 to 10:45 TCT), seen arriving in Mexico at 10:46 TCT. lives gives
// his life from 10:40 to 10:45, then at 10:46 and each minute after; he stays in Mexico.
async function maolInMexico(lives = [151200000, 151200000]) {
  const { env, w } = await started({ torn: { ...allUp(), 23: up(23, 'Torn City', lives[0]) } });
  await fall(env, [101, 100, 104, 102]);
  env.torn[103] = beaten(103, 'Hawaii');
  await env.advance(MIN);
  for (const life of lives.slice(1)) {
    env.torn[23] = up(23, 'Mexico', life);
    await env.advance(MIN);
  }
  return { env, w };
}
const flyNotes = (w) => notes(w, 23).filter((n) => /^(airstrip|BCT|dies) /.test(n) || /^(airstrip|BCT):/.test(n));

test('M\'aol: for each flight, the stop on his route where it catches him soonest', async () => {
  const { env, w } = await maolInMexico();
  assert.deepEqual(notes(w, 23), [
    'moves about every 15 min, here since 10:46 TCT',
    'next Cayman Islands about 11:01 TCT',
    'route Mexico > Cayman Islands > United Kingdom > Canada > Hawaii',
    'airstrip: fly to Cayman Islands, he\'s there 11:01-11:16 TCT',
    'BCT: fly to Mexico, he\'s there 10:46-11:01 TCT',
  ]);
  await env.advance(6 * MIN);
  assert.deepEqual(flyNotes(w), ['airstrip: fly to Canada, he\'s there 11:31-11:46 TCT', 'BCT: fly to Mexico, he\'s there 10:46-11:01 TCT']);
  await env.advance(MIN);
  assert.deepEqual(flyNotes(w), ['airstrip: fly to Canada, he\'s there 11:31-11:46 TCT', 'BCT: fly to Cayman Islands, he\'s there 11:01-11:16 TCT']);
});

test('M\'aol: his own death estimate, and too late for a flight that catches him less than 2 minutes before it', async () => {
  // 15M lost from 10:40 to 10:47, 5M left: dies at 10:49:20.
  const fast = await maolInMexico([20 * M, 12 * M, 5 * M]);
  assert.deepEqual(flyNotes(fast.w), ['dies about 10:49 TCT', 'airstrip: too late', 'BCT: too late']);
  // 7M lost from 10:40 to 10:47, 13M left: dies at 11:00. BCT lands in Mexico at 10:54.
  const slow = await maolInMexico([20 * M, 16 * M, 13 * M]);
  assert.deepEqual(flyNotes(slow.w), ['dies about 11:00 TCT', 'airstrip: too late', 'BCT: fly to Mexico, he\'s there 10:46-11:01 TCT']);
});

test('M\'aol: nothing on where to fly once he has stayed more than 17 minutes in one country', async () => {
  const { env, w } = await maolInMexico();
  await env.advance(17 * MIN);
  assert.equal(flyNotes(w).length, 2, 'seen there 17 minutes after he arrived');
  await env.advance(MIN);
  assert.deepEqual(flyNotes(w), []);
  assert.deepEqual(notes(w, 23).slice(0, 2), ['moves about every 15 min, here since 10:46 TCT', 'next Cayman Islands about 11:01 TCT']);
});

test('M\'aol: a stop that runs past midnight shows the date on its end', async () => {
  const env = device({ torn: allUp() });
  env.now = Date.UTC(2026, 9, 26, 23, 35);
  env.store[KEY_STORE] = KEY;
  const w = env.tab().run();
  await env.advance(0);
  await fall(env, [101, 100, 104, 102, 103]);
  await go(env, ['Mexico']);
  assert.deepEqual(flyNotes(w), ['airstrip: fly to Cayman Islands, he\'s there 23:56-Oct 27 00:11 TCT', 'BCT: fly to Mexico, he\'s there 23:41-23:56 TCT']);
});

test('M\'aol: nothing on where to fly without his route, or without a time for his arrival', async () => {
  const noRoute = await started({ torn: allBeaten('Awoken in Mexico') });
  await go(noRoute.env, ['Cayman Islands']);
  assert.deepEqual(flyNotes(noRoute.w), []);
  const { env, w } = await maolInMexico();
  w.hide();
  env.torn[23] = up(23, 'Cayman Islands');
  await env.advance(4 * MIN);
  w.show();
  await env.advance(0);
  assert.deepEqual(flyNotes(w), []);
});

test('while an estimate shows, the lines are built again only when what they say changes, not every 5 seconds', async () => {
  const { env, w } = await bleeding(102, [100 * M, 99 * M, 98 * M]);
  let el = lineEl(w, 102);
  let rebuilt = 0;
  for (let i = 1; i <= 120; i++) {
    if (i % 12 === 0) env.torn[102] = up(102, 'Canada', (98 - i / 12) * M);
    await env.advance(5 * SEC);
    if (lineEl(w, 102) !== el) {
      rebuilt += 1;
      el = lineEl(w, 102);
    }
  }
  assert.ok(rebuilt >= 10 && rebuilt <= 20, 'built again ' + rebuilt + ' times in 10 minutes');
});

// ---------------------------------------------------------------------------------------------
// The box's controls
// ---------------------------------------------------------------------------------------------

const part = (w, cls) => boxOf(w).querySelector('.' + cls);
// A press on an element of the page, as a pointer would make it.
function press(w, el, x, y, button = 0) {
  const e = new w.dom.Event('pointerdown', { bubbles: true });
  e.clientX = x;
  e.clientY = y;
  e.button = button;
  el.dispatchEvent(e);
}
// Types a key into the key row and saves it.
function saveKey(w, text) {
  part(w, 'tao-key').value = text;
  part(w, 'tao-save').click();
}
const stored = (env) => JSON.parse(env.store[BOX_STORE]);

test('fold: the box folds to its title bar and stays folded after a reload, and it still reads Torn', async () => {
  const { env, w } = await started();
  let bodyClicks = 0;
  w.document.body.addEventListener('click', () => { bodyClicks += 1; });
  assert.equal(part(w, 'tao-fold').textContent, '-');
  part(w, 'tao-fold').click();
  assert.ok(boxOf(w).classList.contains('tao-folded'));
  assert.equal(part(w, 'tao-fold').textContent, '+');
  assert.equal(part(w, 'tao-fold').getAttribute('title'), 'Open the box');
  assert.equal(stored(env).folded, true);
  assert.equal(bodyClicks, 0, 'the click goes no further than the box');
  assert.match(w.document.getElementById('tao-styles').textContent, /#tao-box\.tao-folded \.tao-body\{display:none\}/);
  await env.advance(2 * MIN);
  assert.equal(env.torns().length, 18);
  const reload = env.tab().run();
  assert.ok(boxOf(reload).classList.contains('tao-folded'));
  part(reload, 'tao-fold').click();
  assert.equal(boxOf(reload).classList.contains('tao-folded'), false);
  assert.equal(stored(env).folded, false);
});

test('close: the box goes until the page reloads, and the page asks Torn and TornStats nothing more', async () => {
  const { env, w } = await started();
  part(w, 'tao-close').click();
  assert.equal(boxOf(w), null);
  const torns = env.torns().length;
  await env.advance(10 * MIN);
  assert.equal(env.torns().length, torns);
  assert.equal(env.stats().length, 0);
  const reload = env.tab().run();
  await env.advance(0);
  assert.ok(boxOf(reload));
});

test('closing the box mid-sweep stops the sweep: no more calls go out', async () => {
  const { env, w } = await started();
  env.hold = 'torn';
  await env.advance(MIN);
  assert.equal(env.torns().length, 7);
  part(w, 'tao-close').click();
  env.hold = false;
  await env.release();
  await env.advance(MIN);
  assert.equal(env.torns().length, 7);
});

test('a drag by the title bar moves the box, saves its place, and leaves the page\'s own styles alone', async () => {
  const { env, w } = await started();
  press(w, part(w, 'tao-head'), 100, 700);
  w.fire('pointermove', { clientX: 150, clientY: 650 });
  assert.equal(boxOf(w).style.left, '70px');
  assert.equal(boxOf(w).style.top, '530px');
  w.fire('pointerup', {});
  assert.deepEqual(stored(env), { left: 70, top: 530, folded: false });
  assert.equal(w.document.body.getAttribute('style'), null);
  assert.equal(w.document.documentElement.getAttribute('style'), null);
  w.fire('pointermove', { clientX: 300, clientY: 300 });
  assert.equal(boxOf(w).style.left, '70px', 'the drag is over');
  const reload = env.tab().run();
  assert.equal(boxOf(reload).style.left, '70px');
  assert.equal(boxOf(reload).style.top, '530px');
});

test('a drag cut off part way still ends, and saves where it got to', async () => {
  for (const end of ['pointercancel', 'blur']) {
    const { env, w } = await started();
    press(w, part(w, 'tao-head'), 100, 700);
    w.fire('pointermove', { clientX: 90, clientY: 690 });
    w.fire(end, {});
    assert.deepEqual(stored(env), { left: 10, top: 570, folded: false }, end);
    w.fire('pointermove', { clientX: 300, clientY: 300 });
    assert.equal(boxOf(w).style.left, '10px', end);
  }
});

test('a press on a button in the title bar, or with another mouse button, is no drag, and a press that doesn\'t move saves nothing', async () => {
  const { env, w } = await started();
  press(w, part(w, 'tao-fold'), 100, 700);
  w.fire('pointermove', { clientX: 150, clientY: 650 });
  w.fire('pointerup', {});
  assert.equal(boxOf(w).style.left, '');
  press(w, part(w, 'tao-head'), 100, 700, 2);
  w.fire('pointermove', { clientX: 150, clientY: 650 });
  w.fire('pointerup', {});
  assert.equal(boxOf(w).style.left, '');
  press(w, part(w, 'tao-head'), 100, 700);
  w.fire('pointerup', {});
  assert.equal(BOX_STORE in env.store, false);
});

test('a saved place is pulled back inside the window on load and on resize, and left as saved', async () => {
  const env = device({ store: { [KEY_STORE]: KEY, [BOX_STORE]: JSON.stringify({ left: 1200, top: 700, folded: false }) } });
  const w = env.tab().run();
  assert.equal(boxOf(w).style.left, '980px');
  assert.equal(boxOf(w).style.top, '600px');
  w.win.innerWidth = 400;
  w.win.innerHeight = 700;
  w.fire('resize', {});
  assert.equal(boxOf(w).style.left, '100px');
  assert.equal(boxOf(w).style.top, '500px');
  assert.deepEqual(stored(env), { left: 1200, top: 700, folded: false });
  const strings = device({ store: { [BOX_STORE]: JSON.stringify({ left: '12', top: '34' }) } }).tab().run();
  assert.equal(boxOf(strings).style.left, '12px');
  const junk = device({ store: { [BOX_STORE]: JSON.stringify({ left: 'far', top: null }) } }).tab().run();
  assert.equal(boxOf(junk).style.left, '');
});

test('the key row: in place of the lines with no key, and opened by the Key button with one', async () => {
  const none = device();
  const a = none.tab().run();
  await none.advance(0);
  assert.equal(part(a, 'tao-keyrow').hidden, false);
  assert.equal(part(a, 'tao-lines').hidden, true);
  const input = part(a, 'tao-key');
  assert.equal(input.getAttribute('type'), 'text');
  assert.equal(input.getAttribute('autocomplete'), 'off');
  assert.equal(input.getAttribute('placeholder'), 'Your API key');
  assert.deepEqual([...boxOf(a).querySelectorAll('.tao-term')].map((t) => t.textContent), [
    'Data Storage: Only on this device: the six NPCs\' last reading, the box\'s place, your key.',
    'Data Sharing: None. The script also reads TornStats\' public feed of the six, and sends TornStats nothing of yours.',
    'Purpose of Use: Show where the Ancient Ones are and which can be attacked.',
    'Key Storage & Sharing: Stored on this device in the script\'s storage; sent only to Torn\'s API.',
    'Key Access Level: Public.',
  ]);
  const { w } = await started();
  assert.equal(part(w, 'tao-keyrow').hidden, true);
  part(w, 'tao-keybtn').click();
  assert.equal(part(w, 'tao-keyrow').hidden, false);
  assert.equal(part(w, 'tao-lines').hidden, false);
  part(w, 'tao-keybtn').click();
  assert.equal(part(w, 'tao-keyrow').hidden, true);
});

test('saving a key stores it, shows only its last 4, closes the row and reads Torn at once', async () => {
  const env = device();
  const w = env.tab().run();
  await env.advance(30 * SEC);
  assert.equal(env.torns().length, 0);
  saveKey(w, '  ' + KEY + ' ');
  await env.advance(0);
  assert.equal(env.store[KEY_STORE], KEY);
  assert.equal(part(w, 'tao-key').value, '');
  assert.equal(part(w, 'tao-key').getAttribute('placeholder'), '************wxyz');
  assert.equal(part(w, 'tao-keyrow').hidden, true);
  assert.equal(env.torns().length, 6);
  assert.equal(boxOf(w).textContent.includes(KEY), false);
});

test('a key saved within a minute of the last sweep is used at once', async () => {
  const { env, w } = await started();
  await env.advance(10 * SEC);
  part(w, 'tao-keybtn').click();
  saveKey(w, 'NewKey000000abc');
  await env.advance(0);
  assert.equal(env.torns().length, 12);
  assert.ok(env.torns().slice(6).every((r) => r.url.includes('&key=NewKey000000abc&')));
});

test('a key Torn won\'t take stops the sweeps until a new key is saved', async () => {
  const env = device();
  env.store[KEY_STORE] = KEY;
  env.tornError = { code: 2, error: 'Incorrect key' };
  const w = env.tab().run();
  await env.advance(3 * MIN);
  assert.equal(env.torns().length, 1);
  assert.equal(part(w, 'tao-keyrow').hidden, false, 'the row opens itself');
  env.tornError = null;
  saveKey(w, 'NewKey000000abc');
  await env.advance(0);
  assert.equal(env.torns().length, 7);
  assert.ok(env.torns().slice(1).every((r) => r.url.includes('&key=NewKey000000abc&')));
  assert.equal(footer(w), 'updated 0 s ago');
  assert.equal(part(w, 'tao-keyrow').hidden, true);
});

test('saving an empty field removes the saved key, and PDA\'s is used again', async () => {
  const { env, w } = await started({}, { pda: true });
  assert.ok(env.torns().every((r) => r.url.includes('&key=' + KEY + '&')));
  part(w, 'tao-keybtn').click();
  saveKey(w, '');
  await env.advance(0);
  assert.equal(env.store[KEY_STORE], '');
  assert.equal(env.torns().length, 12);
  assert.ok(env.torns().slice(6).every((r) => r.url.includes('&key=' + PDA_KEY + '&')));
  assert.equal(part(w, 'tao-key').getAttribute('placeholder'), '************DA12');
});

test('a key storage won\'t keep is not used, and the row says so', async () => {
  const env = device();
  const w = env.tab({ setValue: (store, k, v) => { if (k === KEY_STORE) throw new Error('full'); store[k] = v; } }).run();
  await env.advance(0);
  saveKey(w, KEY);
  await env.advance(MIN);
  assert.equal(part(w, 'tao-keymsg').textContent, 'Couldn\'t save the key on this device.');
  assert.equal(env.torns().length, 0);
  assert.equal(summary(w), 'Needs an API key.');
});
