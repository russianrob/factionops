// ==UserScript==
// @name         Torn Ancient Ones
// @namespace    RussianRob
// @version      1.0.0
// @description  Where Torn's Halloween Ancient Ones are (M'aol and his five praetorians), in a small box on Torn pages: country, life left, standing or beaten, an attack link, when M'aol can be hit and his route, and where to fly by airstrip or BCT. It needs a Public API key; Torn PDA gives its own.
// @author       RussianRob
// @downloadURL  https://tornwar.com/scripts/torn-ancient-ones.user.js
// @updateURL    https://tornwar.com/scripts/torn-ancient-ones.meta.js
// @license      All Rights Reserved
// @match        https://www.torn.com/*
// @run-at       document-idle
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_xmlhttpRequest
// @connect      api.torn.com
// @connect      www.tornstats.com
// ==/UserScript==

// =============================================================================
// TORN'S API TERMS
// =============================================================================
// Data Storage           Only on this device: the six NPCs' last reading, the box's place, your key.
// Data Sharing           None. The script also reads TornStats' public feed of the six, and sends
//                        TornStats nothing of yours.
// Purpose of Use         Show where the Ancient Ones are and which can be attacked.
// Key Storage & Sharing  Stored on this device in the script's storage; sent only to Torn's API.
// Key Access Level       Public.

// =============================================================================
// CHANGELOG
// =============================================================================
// v1.0.0  - First release. A small box on Torn pages shows where M'aol and his five
//           praetorians are, how much life each has left, which can be hit now, when
//           M'aol can be, and once he can, his route and next stop. For each one
//           standing, it estimates when it dies and whether a flight by airstrip or BCT
//           lands in time; for M'aol, where each flight catches him.

(function () {
  'use strict';

  const VERSION = '1.0.0';

  // Loaded twice on one page (two copies installed, or PDA injecting it again), it runs once.
  // The mark goes on the page itself, which every copy can see; each copy may have its own window.
  const root = document.documentElement;
  if (root.hasAttribute('data-torn-ancient-ones')) return;
  root.setAttribute('data-torn-ancient-ones', VERSION);

  // ===== WHO AND WHERE =====

  // M'aol and his five praetorians, by their NPC ids. Every sweep reads M'aol first.
  const MAOL = 23;
  const PRAETORIANS = [100, 101, 102, 103, 104];
  const IDS = [MAOL].concat(PRAETORIANS);
  // Torn's countries abroad, nearest first, as Torn's flights go. Only these names count as a
  // country in Torn's words, and the box lists the praetorians in this order.
  const COUNTRIES = ['Mexico', 'Cayman Islands', 'Canada', 'Hawaii', 'United Kingdom', 'Argentina',
    'Switzerland', 'Japan', 'China', 'UAE', 'South Africa'];
  const TORN_CITY = 'Torn City';

  // ===== TIMES =====

  // At most one sweep of the six a minute, across all tabs.
  const SWEEP_EVERY_MS = 60 * 1000;
  // How often each tab checks whether a sweep is due.
  const TICK_MS = 5000;
  // After Torn says too many requests, IP blocked or API off, the next sweep waits this long.
  const BACK_OFF_MS = 5 * 60 * 1000;
  // A change gets a time only when the reading before it was at most this much older.
  const TIMED_GAP_MS = 3 * 60 * 1000;

  // Torn's error codes for a key it won't take: wrong key (2), key owner in federal jail (10),
  // key off for the owner's inactivity (13), key paused (18). Torn blocks an IP that keeps
  // sending a bad key, so these stop the sweeps until a key is saved.
  const KEY_CODES = [2, 10, 13, 18];
  // Torn's error codes that mean wait: too many requests (5), IP blocked (8), API off (9).
  const WAIT_CODES = [5, 8, 9];

  // ===== STORAGE =====

  // GM storage: the key from the box, the last sweep (shared by every tab), and the box's place.
  const KEY_STORE = 'torn-ancient-ones-key';
  const READING_STORE = 'torn-ancient-ones-reading';
  const BOX_STORE = 'torn-ancient-ones-box';

  // PDA puts your API key in place of this placeholder when it loads the script. The file must
  // hold the placeholder once only: PDA finds it by its text, and a second copy breaks the swap.
  const PDA_KEY = '###PDA-APIKEY###';
  // Still the placeholder (it has the #s) means PDA didn't swap it, or this isn't PDA.
  const HAS_PDA_KEY = PDA_KEY.indexOf('##') === -1 && PDA_KEY.length > 8;
  // The warboard app answers PDA's bridge too, so it is told apart by its own gmBridge handler.
  const IS_WARBOARD = !!(window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.gmBridge);
  // Torn PDA. Its web view misreports whether the page is visible, so there the box always reads.
  const IS_PDA = typeof window.flutter_inappwebview !== 'undefined' && !IS_WARBOARD;

  // Every GM_* call is guarded, because hosts differ in what they give a script. Values are
  // stored as strings, because PDA hands stored values back as strings.
  function gmGet(name) {
    try {
      return typeof GM_getValue === 'function' ? GM_getValue(name, '') : '';
    } catch (e) {
      return '';
    }
  }

  // True when the value was saved. A full localStorage, where PDA keeps GM values, throws.
  function gmSet(name, value) {
    try {
      if (typeof GM_setValue === 'function') {
        GM_setValue(name, value);
        return true;
      }
    } catch (e) {
      // Not saved: the caller decides what to do without it.
    }
    return false;
  }

  // True when storage kept the value: saved, then read back the same. Some hosts drop a write
  // without throwing.
  function saveChecked(name, value) {
    return gmSet(name, value) && gmGet(name) === value;
  }

  // The key for Torn's API: one saved in the box beats the one PDA gives. '' means none.
  function apiKey() {
    const saved = gmGet(KEY_STORE);
    if (typeof saved === 'string' && saved.trim()) return saved.trim();
    return HAS_PDA_KEY ? PDA_KEY : '';
  }

  // ===== THE READING =====

  // The last sweep, shared by every tab:
  // - at: when a sweep last started (ms), in any tab;
  // - okAt: when a sweep last read all six (ms, 0 for never);
  // - error: why the last call failed, in words ('' if it didn't);
  // - wait: no sweep before this time (ms, 0 for none), after Torn said to wait;
  // - stop: Torn won't take the key, so no sweeps until a key is saved;
  // - npcs: what was read of each Ancient One, by id (see readNpc).
  const STATES = ['up', 'beaten', 'dormant', 'unknown'];

  function parseReading(v) {
    try {
      if (typeof v === 'string') v = v ? JSON.parse(v) : null;
    } catch (e) {
      v = null;
    }
    if (!v || typeof v !== 'object') v = {};
    const from = v.npcs && typeof v.npcs === 'object' ? v.npcs : {};
    const npcs = {};
    IDS.forEach((id) => {
      if (from[id] && typeof from[id] === 'object') npcs[id] = readNpc(from[id]);
    });
    return {
      at: Number(v.at) || 0,
      okAt: Number(v.okAt) || 0,
      error: typeof v.error === 'string' ? v.error : '',
      wait: Number(v.wait) || 0,
      stop: v.stop === true,
      npcs: npcs,
    };
  }

  // One Ancient One as stored:
  // - name: Torn's name for it;
  // - state: 'up' (standing), 'beaten' (0 life), 'dormant' (asleep with life left: its week
  //   ran out) or 'unknown' (Torn's words say neither);
  // - place: a country, Torn City, or '' when Torn's words don't say;
  // - words: Torn's description as it came, for a line the script can't read otherwise;
  // - cur and max: its life;
  // - readAt: when this was read (ms);
  // - since: when its state (or, while it stands, its place) last changed, if the reading
  //   before was close enough to pin that down (ms, 0 for not known);
  // - changedAt: when the script last saw it change (ms, 0 for never), for the highlight.
  function readNpc(n) {
    return {
      name: typeof n.name === 'string' ? n.name : '',
      state: STATES.indexOf(n.state) >= 0 ? n.state : 'unknown',
      place: typeof n.place === 'string' ? n.place : '',
      words: typeof n.words === 'string' ? n.words : '',
      cur: Number(n.cur) || 0,
      max: Number(n.max) || 0,
      readAt: Number(n.readAt) || 0,
      since: Number(n.since) || 0,
      changedAt: Number(n.changedAt) || 0,
    };
  }

  // This tab's own copy of the reading, kept only while storage won't save it (PDA keeps GM
  // values in localStorage, which can be full). It wins unless storage holds a newer sweep.
  let tabCopy = null;

  function readReading() {
    const shared = parseReading(gmGet(READING_STORE));
    return tabCopy && tabCopy.at >= shared.at ? parseReading(JSON.stringify(tabCopy)) : shared;
  }

  function writeReading(r) {
    const text = JSON.stringify(r);
    tabCopy = saveChecked(READING_STORE, text) ? null : parseReading(text);
  }

  // ===== READING TORN'S ANSWER =====

  // What Torn's v2 profile says of one Ancient One, as readNpc stores it (without the times).
  function readProfile(p) {
    const status = p && p.status && typeof p.status === 'object' ? p.status : {};
    const words = String(status.description == null ? '' : status.description).trim();
    const state = String(status.state == null ? '' : status.state);
    const life = p && p.life && typeof p.life === 'object' ? p.life : null;
    const cur = life ? Number(life.current) : NaN;
    const max = life ? Number(life.maximum) : NaN;
    // Standing or asleep: the first word of Torn's words decides, else Torn's state.
    const first = (/^[a-z]+/i.exec(words) || [''])[0].toLowerCase();
    let asleep = null;
    if (first === 'awoken' || first === 'dormant') asleep = first === 'dormant';
    else if (/^(?:awoken|dormant)$/i.test(state)) asleep = /^dormant$/i.test(state);
    // Life at 0 is beaten, whatever the words say.
    if (Number.isFinite(cur) && cur <= 0) asleep = true;
    let kind = 'unknown';
    if (asleep === false) kind = 'up';
    else if (asleep === true) kind = Number.isFinite(cur) && cur > 0 ? 'dormant' : 'beaten';
    return {
      name: String((p && p.name) || ''),
      state: kind,
      place: placeOf(words, state),
      words: words,
      cur: Number.isFinite(cur) ? cur : 0,
      max: Number.isFinite(max) ? max : 0,
    };
  }

  // Where Torn's words put it: the words after "in" when they name one of Torn's countries
  // abroad (or Torn itself); with no "in", Torn City unless Torn's state says it is abroad or
  // flying. '' when the words don't say.
  function placeOf(words, state) {
    const m = /\bin\s+(.+?)\s*$/i.exec(words);
    if (m) {
      if (/^torn(?: city)?$/i.test(m[1])) return TORN_CITY;
      const name = m[1].toLowerCase();
      return COUNTRIES.find((c) => c.toLowerCase() === name) || '';
    }
    return /^(?:abroad|traveling)$/i.test(state) ? '' : TORN_CITY;
  }

  // Beaten, or dormant: asleep either way.
  function down(n) {
    return !!n && (n.state === 'beaten' || n.state === 'dormant');
  }

  // M'aol can be hit when he isn't asleep and all five praetorians are. This is worked out from
  // the praetorians, not from M'aol's own words.
  function hittable(npcs) {
    return !!npcs[MAOL] && !down(npcs[MAOL]) && PRAETORIANS.every((id) => down(npcs[id]));
  }

  // Puts what Torn said of one Ancient One into the reading, with what changed since it was
  // last read: a new state (summoned, beaten, gone dormant), or a new place while it stands
  // (M'aol moving). The change's time is kept only when the reading before was at most 3
  // minutes older; after a longer gap (a phone asleep, say) it happened at some time unknown.
  function applyProfile(r, id, seen, nowMs) {
    const before = r.npcs[id];
    const wasHittable = hittable(r.npcs);
    const npc = Object.assign({}, seen, { readAt: nowMs, since: 0, changedAt: 0 });
    if (before) {
      const changed = before.state !== npc.state || (npc.state === 'up' && before.place !== npc.place);
      if (changed) {
        const timed = nowMs >= before.readAt && nowMs - before.readAt <= TIMED_GAP_MS;
        npc.since = timed ? nowMs : 0;
        npc.changedAt = nowMs;
      } else {
        npc.since = before.since;
        npc.changedAt = before.changedAt;
      }
    }
    r.npcs[id] = npc;
    // M'aol coming within reach is a change of his own, though his own words may not change.
    if (!wasHittable && hittable(r.npcs) && npc.changedAt === nowMs) r.npcs[MAOL].changedAt = nowMs;
  }

  // ===== ASKING TORN =====

  // True while this tab's sweep is under way.
  let sweeping = false;
  // True once the box is closed: this page makes no more calls.
  let closed = false;

  // True when this tab should start a sweep now: there is a key Torn hasn't refused, the page
  // is visible (PDA can't tell, so there always), Torn hasn't said to wait, and the last sweep
  // in any tab started a minute ago or more.
  function sweepDue(nowMs) {
    if (closed || sweeping || !apiKey()) return false;
    if (!IS_PDA && document.visibilityState === 'hidden') return false;
    const r = readReading();
    if (r.stop) return false;
    // A wait, or a last sweep, further ahead than it could be means the clock moved back.
    if (r.wait > nowMs && r.wait - nowMs <= BACK_OFF_MS) return false;
    return !(r.at <= nowMs && nowMs - r.at < SWEEP_EVERY_MS);
  }

  // Reads the six one after another, and stores each answer as it comes, so that every tab
  // draws it. One at a time, not all at once: PDA merges identical requests in flight, and the
  // first error stops the sweep before more calls go out.
  function sweep(key, nowMs) {
    sweeping = true;
    const start = readReading();
    start.at = nowMs;
    writeReading(start);
    let i = 0;
    const end = () => {
      sweeping = false;
    };
    const next = () => {
      // A closed box, or a key saved over or cleared since the sweep began, ends it.
      if (closed || apiKey() !== key) return end();
      if (i >= IDS.length) {
        const done = readReading();
        done.okAt = Date.now();
        done.error = '';
        writeReading(done);
        return end();
      }
      const id = IDS[i++];
      askTorn(key, id).then((profile) => {
        try {
          if (closed || apiKey() !== key) return end();
          const r = readReading();
          applyProfile(r, id, readProfile(profile), Date.now());
          writeReading(r);
          next();
        } catch (e) {
          end();
        }
      }, (err) => {
        try {
          if (apiKey() === key) {
            const r = readReading();
            r.error = err.message;
            if (KEY_CODES.indexOf(err.code) >= 0) r.stop = true;
            if (WAIT_CODES.indexOf(err.code) >= 0) r.wait = Date.now() + BACK_OFF_MS;
            writeReading(r);
          }
        } catch (e) {
          // Nothing more to do: the next sweep tries again.
        }
        end();
      });
    };
    next();
  }

  // GET one Ancient One's profile. Resolves with Torn's profile, or rejects with { code,
  // message }: Torn's error code and words (with the key cut out), or code 0 and a fixed message
  // when Torn gave no answer the script can read. The key is in the request and nowhere else.
  function askTorn(key, id) {
    const url = 'https://api.torn.com/v2/user/' + id + '/profile?striptags=true&key=' + encodeURIComponent(key) + '&comment=ancient-ones';
    return new Promise((resolve, reject) => {
      const answered = (text) => {
        let data;
        try {
          data = JSON.parse(text);
        } catch (e) {
          reject({ code: 0, message: 'no answer from Torn' });
          return;
        }
        if (data && data.error) {
          const code = Number(data.error.code) || 0;
          reject({ code: code, message: hideKey(String(data.error.error || 'error'), key) + ' (code ' + code + ')' });
        } else if (data && data.profile && typeof data.profile === 'object') {
          resolve(data.profile);
        } else {
          reject({ code: 0, message: 'unexpected answer from Torn' });
        }
      };
      get(url).then(answered, () => reject({ code: 0, message: 'no answer from Torn' }));
    });
  }

  // GET a page's text, sending no cookies. GM_xmlhttpRequest where the host has it: it isn't held
  // to the page's rules on what the page may fetch. fetch where it doesn't. Rejects with no answer.
  function get(url) {
    return new Promise((resolve, reject) => {
      if (typeof GM_xmlhttpRequest === 'function') {
        try {
          GM_xmlhttpRequest({
            method: 'GET',
            url: url,
            anonymous: true,
            timeout: 20000,
            onload: (res) => resolve(res && res.responseText != null ? String(res.responseText) : ''),
            onerror: reject,
            ontimeout: reject,
            onabort: reject,
          });
          return;
        } catch (e) {
          // Fall through to fetch.
        }
      }
      try {
        fetch(url, { credentials: 'omit' }).then((res) => res.text()).then(resolve, reject);
      } catch (e) {
        reject(e);
      }
    });
  }

  // Torn's messages don't hold the key, but the box must never show it, so make sure.
  function hideKey(text, key) {
    return key ? text.split(key).join('****') : text;
  }

  // Each tab's check, every 5 seconds and when the page comes back into view: a sweep if one is
  // due.
  function tick() {
    try {
      const nowMs = Date.now();
      if (sweepDue(nowMs)) sweep(apiKey(), nowMs);
    } catch (e) {
      // A surprise stops this one check. It never breaks the page.
    }
  }

  // ===== START =====

  tick();
  setInterval(tick, TICK_MS);
  // A page that comes back into view reads at once if a sweep is due. PDA misreports this.
  document.addEventListener('visibilitychange', () => {
    if (!IS_PDA && document.visibilityState !== 'hidden') tick();
  });
  console.log('[Torn Ancient Ones ' + VERSION + '] running');
})();
