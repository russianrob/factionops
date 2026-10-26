// ==UserScript==
// @name         Torn Ancient Ones
// @namespace    RussianRob
// @version      1.0.1
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
// v1.0.1  - The Attack link opens Torn's attack page again (page.php), now that
//           Torn has retired its old address (loader.php).
// v1.0.0  - First release. A small box on Torn pages shows where M'aol and his five
//           praetorians are, how much life each has left, which can be hit now, when
//           M'aol can be, and once he can, his route and next stop. For each one
//           standing, it estimates when it dies and whether a flight by airstrip or BCT
//           lands in time; for M'aol, where each flight catches him.

(function () {
  'use strict';

  const VERSION = '1.0.1';

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
  // country in Torn's words, and the box lists the praetorians standing in this order, and
  // falls it can't tell apart by time.
  const COUNTRIES = ['Mexico', 'Cayman Islands', 'Canada', 'Hawaii', 'United Kingdom', 'Argentina',
    'Switzerland', 'Japan', 'China', 'UAE', 'South Africa'];
  const TORN_CITY = 'Torn City';
  const PROFILE_URL = 'https://www.torn.com/profiles.php?XID=';
  // Torn's attack page, as Torn's own Attack buttons link to it. Torn has retired its old
  // address (loader.php?sid=attack), which now answers only with an error.
  const ATTACK_URL = 'https://www.torn.com/page.php?sid=attack&user2ID=';

  // ===== TIMES =====

  // At most one sweep of the six a minute, across all tabs.
  const SWEEP_EVERY_MS = 60 * 1000;
  // How often each tab checks whether a sweep is due, and redraws the box.
  const TICK_MS = 5000;
  // After Torn says too many requests, IP blocked or API off, the next sweep waits this long.
  const BACK_OFF_MS = 5 * 60 * 1000;
  // A change gets a time only when the reading before it was at most this much older.
  const TIMED_GAP_MS = 3 * 60 * 1000;
  // A change stays highlighted this long after the script saw it.
  const HIGHLIGHT_MS = 5 * 60 * 1000;
  // A new summoning is possible this long after M'aol's death, by Torn's patch notes (#408).
  const RESUMMON_MS = 48 * 60 * 60 * 1000;
  // M'aol stays this long in each country of his route.
  const STOP_MS = 15 * 60 * 1000;
  // Two falls this close together can't be put in order: the script saw them in the same sweep,
  // or TornStats in the same check.
  const FALL_GAP_MS = 30 * 1000;
  // The most countries M'aol's trail keeps.
  const TRAIL_MAX = 20;
  // Two readings of M'aol this far apart may hide a whole stop of his (15 minutes).
  const TRAIL_GAP_MS = 10 * 60 * 1000;
  // TornStats is asked at most this often, across all tabs, while its time for a beaten one is
  // missing.
  const FELL_EVERY_MS = 5 * 60 * 1000;
  // A defeat time older than this is from an earlier summoning: an Ancient One left standing
  // goes dormant within a week.
  const FELL_MAX_AGE_MS = 8 * 24 * 60 * 60 * 1000;
  // Each one's life is kept from each reading over this long, for the rate it is losing life.
  const HIST_MS = 15 * 60 * 1000;
  const HIST_MAX = 20;
  // The rate is taken over this long, and needs at least this much of it.
  const RATE_WINDOW_MS = 10 * 60 * 1000;
  const RATE_MIN_MS = 2 * 60 * 1000;
  // A flight that lands less than this before the death estimate is too late.
  const SPARE_MIN_MS = 2 * 60 * 1000;

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

  // A stored object, from a string of JSON (PDA hands back strings) or as it is. null when
  // nothing is stored or it won't parse.
  function readJson(name) {
    let v = gmGet(name);
    try {
      if (typeof v === 'string') v = v ? JSON.parse(v) : null;
    } catch (e) {
      v = null;
    }
    return v && typeof v === 'object' ? v : null;
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
  // - npcs: what was read of each Ancient One, by id (see readNpc);
  // - trail: the countries M'aol was seen in while he could be hit, in order;
  // - fell: TornStats' defeat times (ms), by id;
  // - fellAskedAt: when TornStats was last asked (ms), in any tab.
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
      trail: Array.isArray(v.trail) ? v.trail.filter((c) => COUNTRIES.indexOf(c) >= 0).slice(-TRAIL_MAX) : [],
      fell: readFell(v.fell),
      fellAskedAt: Number(v.fellAskedAt) || 0,
    };
  }

  // TornStats' defeat times as stored: a time (ms) by id, for the six only.
  function readFell(o) {
    const fell = {};
    if (o && typeof o === 'object') {
      IDS.forEach((id) => {
        if (Number(o[id]) > 0) fell[id] = Number(o[id]);
      });
    }
    return fell;
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
  // - changedAt: when the script last saw it change (ms, 0 for never), for the highlight;
  // - upAt: when it was last read standing (ms, 0 for never);
  // - hist: its life at each reading while standing, over the last 15 minutes, as [ms, life].
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
      upAt: Number(n.upAt) || 0,
      hist: Array.isArray(n.hist)
        ? n.hist.filter((h) => Array.isArray(h) && Number(h[0]) > 0 && Number.isFinite(Number(h[1]))).map((h) => [Number(h[0]), Number(h[1])]).slice(-HIST_MAX)
        : [],
    };
  }

  // This tab's own copy of the reading, kept only while storage won't save it (PDA keeps GM
  // values in localStorage, which can be full). It wins unless storage holds a newer sweep.
  let tabCopy = null;

  function readReading() {
    const shared = parseReading(gmGet(READING_STORE));
    // A sweep stored ahead of the clock (the clock was set back) is not a newer one.
    const newer = tabCopy && shared.at > tabCopy.at && shared.at <= Date.now();
    return tabCopy && !newer ? parseReading(JSON.stringify(tabCopy)) : shared;
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
    npc.upAt = npc.state === 'up' ? nowMs : (before ? before.upAt : 0);
    // Its life over the last 15 minutes, kept only while it stands.
    const kept = before && before.state === 'up' && npc.state === 'up'
      ? before.hist.filter((h) => h[0] <= nowMs && nowMs - h[0] <= HIST_MS)
      : [];
    npc.hist = npc.state === 'up' ? kept.concat([[nowMs, npc.cur]]).slice(-HIST_MAX) : [];
    r.npcs[id] = npc;
    // M'aol coming within reach is a change of his own, though his own words may not change.
    if (!wasHittable && hittable(r.npcs) && npc.changedAt === nowMs) r.npcs[MAOL].changedAt = nowMs;
    noteTrail(r, id, before, npc, nowMs);
  }

  // M'aol's trail: a new summoning empties it (and TornStats' defeat times, which were for the
  // summoning before), and while he can be hit, each new country he is seen in is added to it.
  // A gap in his readings that could hide one of his stops (a page out of view, a phone asleep)
  // starts it again: the order he was seen in across the gap is not his route.
  function noteTrail(r, id, before, npc, nowMs) {
    if (id === MAOL && down(before) && !down(npc)) {
      r.trail = [];
      r.fell = {};
    }
    if (id === MAOL && before && !(nowMs >= before.readAt && nowMs - before.readAt < TRAIL_GAP_MS)) r.trail = [];
    if (!hittable(r.npcs)) return;
    const place = r.npcs[MAOL].place;
    if (COUNTRIES.indexOf(place) >= 0 && r.trail[r.trail.length - 1] !== place) {
      r.trail.push(place);
      r.trail = r.trail.slice(-TRAIL_MAX);
    }
  }

  // ===== M'AOL'S ROUTE =====

  // TornStats' time for this one's defeat (ms), or 0: none, it isn't beaten, or the time is from
  // more than a minute before the script last saw it standing (an earlier summoning).
  function theirFall(r, id) {
    const n = r.npcs[id];
    const at = r.fell[id] || 0;
    return n && n.state === 'beaten' && at >= n.upAt - 60000 ? at : 0;
  }

  // When this one was defeated (ms), or 0 when not known: TornStats' time, else the script's own,
  // when it saw the fall with a time.
  function fellAt(r, id) {
    const n = r.npcs[id];
    if (!n || n.state !== 'beaten') return 0;
    return theirFall(r, id) || n.since;
  }

  // The praetorians' countries, one each, or null when one is missing or two share a country.
  function praetorianCountries(npcs) {
    const places = PRAETORIANS.map((id) => (npcs[id] ? npcs[id].place : ''));
    if (places.some((p) => COUNTRIES.indexOf(p) < 0)) return null;
    return places.filter((p, i) => places.indexOf(p) === i).length === places.length ? places : null;
  }

  // M'aol's route: his praetorians' countries in the order he visits them, or null when the
  // script doesn't know it. From his moves once his trail holds all five countries, because
  // that is what he did; until then, from the order the praetorians fell, when each has a
  // defeat time and no two came in the same sweep.
  function route(r) {
    const countries = praetorianCountries(r.npcs);
    if (!countries) return null;
    const moves = [];
    r.trail.forEach((c) => {
      if (countries.indexOf(c) >= 0 && moves.indexOf(c) < 0) moves.push(c);
    });
    if (moves.length === countries.length) return moves;
    const falls = PRAETORIANS.map((id) => ({ place: r.npcs[id].place, at: fellAt(r, id) }));
    if (falls.some((f) => !f.at)) return null;
    falls.sort((a, b) => a.at - b.at);
    for (let i = 1; i < falls.length; i++) {
      if (falls[i].at - falls[i - 1].at < FALL_GAP_MS) return null;
    }
    return falls.map((f) => f.place);
  }

  // Where M'aol goes next: the country after his current one on his route, from the last back
  // to the first, and when (15 minutes after he was seen arriving; 0 when his arrival had no
  // time). null with no route, or when he is somewhere not on it.
  function nextStop(r, way) {
    const m = r.npcs[MAOL];
    const i = way && m ? way.indexOf(m.place) : -1;
    if (i < 0) return null;
    return { place: way[(i + 1) % way.length], at: m.since ? m.since + STOP_MS : 0 };
  }

  // ===== WHERE TO FLY =====

  // Standard flight minutes from Torn City to each of COUNTRIES, in the same order, from
  // TornTools' travel table (as of 21 Oct 2026).
  const FLIGHT_MIN = [24, 33, 39, 127, 151, 158, 166, 213, 229, 257, 282];
  // The two ways of flying the box checks, and the share of the standard time each takes.
  const FLIGHTS = [['airstrip', 0.7], ['BCT', 0.3]];
  // M'aol seen in one country longer than this means his 15 minutes don't hold right now, so the
  // box doesn't say where to fly for him.
  const OVERSTAY_MS = STOP_MS + 2 * 60 * 1000;

  // A flight's minutes from Torn City: the standard time times its share, rounded to the minute.
  // 0 for a place with no flight.
  function flightMin(place, share) {
    const i = COUNTRIES.indexOf(place);
    return i < 0 ? 0 : Math.round(FLIGHT_MIN[i] * share);
  }

  // When this one should die (ms), from how fast its life dropped: the life lost from its oldest
  // reading in the 10 minutes before its newest, which must be at least 2 minutes back, gives the
  // rate. The estimate counts from the newest reading. 0 when it isn't losing life, or there is
  // too little history.
  function deathAt(n) {
    const h = n && n.state === 'up' ? n.hist : [];
    if (h.length < 2) return 0;
    const last = h[h.length - 1];
    const first = h.find((x) => last[0] - x[0] <= RATE_WINDOW_MS);
    if (last[0] - first[0] < RATE_MIN_MS || first[1] <= last[1]) return 0;
    const rate = (first[1] - last[1]) / (last[0] - first[0]);
    return last[0] + Math.round(last[1] / rate);
  }

  // A flight landing at landMs against a death estimate: the whole minutes to spare, or too late
  // when it lands less than 2 minutes before.
  function spare(dies, landMs) {
    const ms = dies - landMs;
    return ms < SPARE_MIN_MS ? 'too late' : Math.floor(ms / 60000) + ' min to spare';
  }

  // The note under a standing praetorian: when it should die, then each flight's minutes and
  // whether it lands in time. With no estimate, only the minutes. '' when its country has no
  // flight.
  function flyNote(n, nowMs) {
    if (!flightMin(n.place, 1)) return '';
    const dies = deathAt(n);
    const parts = dies ? ['dies about ' + clock(dies, nowMs)] : [];
    FLIGHTS.forEach((f) => {
      const min = flightMin(n.place, f[1]);
      parts.push(f[0] + ' ' + min + ' min' + (dies ? ': ' + spare(dies, nowMs + min * 60000) : ''));
    });
    return parts.join(' | ');
  }

  // Where each flight catches M'aol soonest, once his route is known and his arrival here had a
  // time: his stops are 15 minutes each, in route order from his arrival here, round and round.
  // For each country on the route, a flight catches him on his first stop there that he leaves
  // at least 2 minutes after it lands. The soonest catch wins, and it is too late when he should
  // die less than 2 minutes after it. No notes when he has stayed longer than his 15 minutes.
  function maolFly(r, way, nowMs) {
    const m = r.npcs[MAOL];
    const here = way && m ? way.indexOf(m.place) : -1;
    if (here < 0 || !m.since || m.readAt - m.since > OVERSTAY_MS) return [];
    const dies = deathAt(m);
    return FLIGHTS.map((f) => {
      let best = null;
      way.forEach((place, i) => {
        const land = nowMs + flightMin(place, f[1]) * 60000;
        let k = (i - here + way.length) % way.length;
        while (m.since + (k + 1) * STOP_MS - SPARE_MIN_MS < land) k += way.length;
        const from = m.since + k * STOP_MS;
        const at = Math.max(land, from);
        if (!best || at < best.at) best = { place: place, at: at, from: from };
      });
      if (dies && dies - best.at < SPARE_MIN_MS) return f[0] + ': too late';
      return f[0] + ': fly to ' + best.place + ', he\'s there ' + hhmm(best.from) + '-' + clock(best.from + STOP_MS, nowMs);
    });
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
      drawSafe();
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
          drawSafe();
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

  // ===== ASKING TORNSTATS =====

  // TornStats' public feed of the six, which its own M'aol page reads. Only the time it saw each
  // one defeated is used; Torn's API stays the source for everything else.
  const TORNSTATS_URL = 'https://www.tornstats.com/ajax/status/maol';
  // True while this tab is asking TornStats.
  let asking = false;

  // True when TornStats should be asked: one of the six is beaten and TornStats' time for it isn't
  // known yet, the page is visible (PDA can't tell, so there always), and no tab asked in the
  // last 5 minutes. The script's own times are a sweep apart at best, and Torn's cache can put
  // two close falls in the wrong order, so TornStats' times are asked for even then.
  function fallsDue(r, nowMs) {
    if (closed || asking) return false;
    if (!IS_PDA && document.visibilityState === 'hidden') return false;
    if (!IDS.some((id) => r.npcs[id] && r.npcs[id].state === 'beaten' && !theirFall(r, id))) return false;
    return !(r.fellAskedAt <= nowMs && nowMs - r.fellAskedAt < FELL_EVERY_MS);
  }

  // Reads TornStats' feed and keeps each defeat time that is no more than 8 days old and not in
  // the future. The time of the ask is stored first, so another tab sees it and waits. An answer
  // the script can't read, or none, changes nothing.
  function askFalls(nowMs) {
    asking = true;
    const start = readReading();
    start.fellAskedAt = nowMs;
    writeReading(start);
    get(TORNSTATS_URL).then((text) => {
      try {
        const list = JSON.parse(text);
        const r = readReading();
        const now = Date.now();
        (Array.isArray(list) ? list : []).forEach((item) => {
          const id = Number(item && item.torn_id);
          const at = Date.parse(item && item.hosped_at);
          if (IDS.indexOf(id) >= 0 && at > 0 && at <= now + 60000 && now - at <= FELL_MAX_AGE_MS) r.fell[id] = at;
        });
        writeReading(r);
      } catch (e) {
        // Nothing to keep.
      }
      asking = false;
      drawSafe();
    }, () => {
      asking = false;
    });
  }

  // Each tab's check, every 5 seconds and when the page comes back into view: a sweep if one is
  // due, then the box redrawn from the stored reading, so a sweep by another tab shows too.
  function tick() {
    try {
      const nowMs = Date.now();
      if (sweepDue(nowMs)) sweep(apiKey(), nowMs);
      if (fallsDue(readReading(), nowMs)) askFalls(nowMs);
      draw();
    } catch (e) {
      // A surprise stops this one check. It never breaks the page.
    }
  }

  function drawSafe() {
    try {
      draw();
    } catch (e) {
      // As in tick: a surprise never breaks the page.
    }
  }

  // ===== THE BOX =====

  // The box's colour: orange, where the Loot Rangers box is blue, so the two can't be mixed up.
  const ACCENT = '#f0a04b';
  const BOX_ID = 'tao-box';
  const STYLE_ID = 'tao-styles';
  // The box starts at the bottom left (the Loot Rangers box starts at the bottom right). The
  // title bar takes touch-action: none, so a finger on it drags the box, not the page.
  const STYLE = [
    '#tao-box{position:fixed;left:20px;bottom:20px;z-index:999998;max-width:320px;background:rgba(11,15,25,0.95);color:' + ACCENT + ';border:1px solid ' + ACCENT + ';border-radius:6px;box-shadow:0 0 6px rgba(0,0,0,0.6);font:12px Verdana,Arial,sans-serif;text-align:left}',
    '#tao-box .tao-head{display:flex;align-items:center;gap:4px;padding:4px 6px;cursor:move;touch-action:none;border-bottom:1px solid ' + ACCENT + '}',
    '#tao-box.tao-folded .tao-head{border-bottom:0}',
    '#tao-box .tao-titles{flex:1;min-width:0}',
    '#tao-box .tao-title{font-weight:bold}',
    '#tao-box .tao-summary{font-size:10px}',
    '#tao-box .tao-btn{padding:0 5px;font-size:10px;line-height:16px;background:transparent;color:' + ACCENT + ';border:1px solid ' + ACCENT + ';border-radius:3px;cursor:pointer}',
    '#tao-box .tao-body{padding:4px 6px;line-height:1.4;cursor:default}',
    '#tao-box.tao-folded .tao-body{display:none}',
    '#tao-box .tao-line{padding:1px 3px;border-radius:3px}',
    '#tao-box .tao-line > span, #tao-box .tao-line > a{margin-right:6px}',
    '#tao-box .tao-down{opacity:0.55}',
    '#tao-box .tao-new{background:rgba(240,160,75,0.25)}',
    '#tao-box .tao-note{font-size:10px;padding-left:8px}',
    '#tao-box a{color:' + ACCENT + ';text-decoration:underline}',
    '#tao-box .tao-foot{display:flex;justify-content:space-between;align-items:center;gap:6px;margin-top:3px;font-size:10px}',
    '#tao-box .tao-keyrow{margin-top:4px;font-size:10px}',
    '#tao-box .tao-keyrow input{width:150px;margin:3px 4px 0 0;font-size:11px}',
    '#tao-box [hidden]{display:none}',
  ].join('\n');
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  let box = null;
  // What the lines were last drawn from. They are rebuilt only when it changes: a line rebuilt
  // under a finger would lose the tap.
  let drawn = '';

  // An element with its text and class; either may be left out.
  function make(tag, text, className) {
    const el = document.createElement(tag);
    if (text) el.textContent = text;
    if (className) el.className = className;
    return el;
  }

  // Sets an element's text only when it differs.
  function setText(el, text) {
    if (el && el.textContent !== text) el.textContent = text;
  }

  // The box: a title bar with the summary under the title, then the lines and the footer.
  function makeBox() {
    if (!document.getElementById(STYLE_ID)) {
      const style = make('style');
      style.id = STYLE_ID;
      style.textContent = STYLE;
      (document.head || document.documentElement).appendChild(style);
    }
    box = make('div');
    box.id = BOX_ID;
    const head = make('div', '', 'tao-head');
    const titles = make('div', '', 'tao-titles');
    titles.appendChild(make('div', 'Ancient Ones', 'tao-title'));
    titles.appendChild(make('div', '', 'tao-summary'));
    head.appendChild(titles);
    const body = make('div', '', 'tao-body');
    body.appendChild(make('div', '', 'tao-lines'));
    const foot = make('div', '', 'tao-foot');
    foot.appendChild(make('span', '', 'tao-age'));
    body.appendChild(foot);
    box.appendChild(head);
    box.appendChild(body);
    document.body.appendChild(box);
  }

  // Draws the box from the stored reading: the summary, the lines and the footer.
  function draw() {
    if (!box) return;
    const nowMs = Date.now();
    const r = readReading();
    const key = apiKey();
    setText(box.querySelector('.tao-summary'), summary(r, key, nowMs));
    setText(box.querySelector('.tao-age'), footer(r, key, nowMs));
    const lines = order(r).map((id) => line(id, r, nowMs));
    const plan = JSON.stringify(lines);
    if (plan !== drawn) {
      drawn = plan;
      const holder = box.querySelector('.tao-lines');
      holder.textContent = '';
      lines.forEach((l) => holder.appendChild(lineElement(l)));
    }
    box.querySelector('.tao-head').classList.toggle('tao-new', lines.some((l) => l.fresh));
    // The key row shows with no key, with a key Torn refused, or when the Key button opened it.
    // With no key, it takes the lines' place.
    const row = box.querySelector('.tao-keyrow');
    const showRow = !key || r.stop || keyOpen;
    if (row.hidden === showRow) row.hidden = !showRow;
    const holder = box.querySelector('.tao-lines');
    if (holder.hidden !== !key) holder.hidden = !key;
    // The field's grey hint: the key in use with all but its last 4 hidden, never more.
    const hint = key ? '************' + key.slice(-4) : 'Your API key';
    const input = box.querySelector('.tao-key');
    if (input.getAttribute('placeholder') !== hint) input.setAttribute('placeholder', hint);
  }

  // The ids to draw, in order: M'aol first, then the praetorians that are down in the order they
  // fell, then those standing. One down with no defeat time comes before those with one: most
  // likely it fell before the script was watching. Otherwise, and between falls at the same
  // time, the nearest country comes first, and one with no known country goes last. One not
  // read yet has no line.
  function order(r) {
    const npcs = r.npcs;
    const rank = (id) => {
      const i = COUNTRIES.indexOf(npcs[id].place);
      return i < 0 ? COUNTRIES.length : i;
    };
    // 0: down with no defeat time; 1: down with one, earliest first; 2: standing.
    const group = (id) => (down(npcs[id]) ? (fellAt(r, id) ? 1 : 0) : 2);
    const byTime = (a, b) => (group(a) === 1 ? fellAt(r, a) - fellAt(r, b) : 0);
    const praetorians = PRAETORIANS.filter((id) => npcs[id])
      .sort((a, b) => group(a) - group(b) || byTime(a, b) || rank(a) - rank(b) || a - b);
    return (npcs[MAOL] ? [MAOL] : []).concat(praetorians);
  }

  // One line, as plain data: who, where, life left, its state in words, whether it can be hit
  // now (then it gets an Attack link), notes under it, and whether it is dimmed or highlighted.
  function line(id, r, nowMs) {
    const n = r.npcs[id];
    const asleep = down(n);
    const canHit = id === MAOL ? hittable(r.npcs) : n.state === 'up';
    let state = '';
    const notes = [];
    if (asleep) {
      const at = n.state === 'beaten' ? fellAt(r, id) : n.since;
      state = n.state + (at ? ' ' + clock(at, nowMs) : '');
    } else if (id === MAOL && canHit) {
      notes.push('moves about every 15 min' + (n.since ? ', here since ' + clock(n.since, nowMs) : ''));
      const way = route(r);
      const stop = nextStop(r, way);
      if (stop) notes.push('next ' + stop.place + (stop.at ? ' about ' + clock(stop.at, nowMs) : ''));
      if (way) notes.push('route ' + way.join(' > '));
      const dies = deathAt(n);
      if (dies) notes.push('dies about ' + clock(dies, nowMs));
      maolFly(r, way, nowMs).forEach((note) => notes.push(note));
    } else if (id === MAOL) {
      const up = PRAETORIANS.filter((p) => !down(r.npcs[p])).length;
      state = 'shielded, ' + up + ' praetorian' + (up === 1 ? '' : 's') + ' up';
    } else if (n.state === 'up') {
      const note = flyNote(n, nowMs);
      if (note) notes.push(note);
    }
    return {
      id: id,
      name: n.name || String(id),
      where: n.state !== 'unknown' && n.place ? n.place : n.words,
      life: !asleep && n.max > 0 ? percent(n) + '%' : '',
      state: state,
      attack: canHit,
      notes: notes,
      down: asleep,
      fresh: n.changedAt > 0 && nowMs >= n.changedAt && nowMs - n.changedAt < HIGHLIGHT_MS,
    };
  }

  // Life left as a whole percent, rounded down, but at least 1 while any is left.
  function percent(n) {
    if (n.cur <= 0) return 0;
    return Math.min(100, Math.max(1, Math.floor((100 * n.cur) / n.max)));
  }

  // A line's elements. All text goes in as text, Torn's words included, never as HTML. Links
  // open in the same tab: the warboard app's web view handles new tabs badly.
  function lineElement(l) {
    const el = make('div', '', 'tao-line' + (l.down ? ' tao-down' : '') + (l.fresh ? ' tao-new' : ''));
    el.setAttribute('data-id', String(l.id));
    const name = make('a', l.name, 'tao-name');
    name.setAttribute('href', PROFILE_URL + l.id);
    el.appendChild(name);
    if (l.where) el.appendChild(make('span', l.where, 'tao-where'));
    if (l.life) el.appendChild(make('span', l.life, 'tao-life'));
    if (l.state) el.appendChild(make('span', l.state, 'tao-state'));
    if (l.attack) {
      const attack = make('a', 'Attack', 'tao-attack');
      attack.setAttribute('href', ATTACK_URL + l.id);
      el.appendChild(attack);
    }
    l.notes.forEach((note) => el.appendChild(make('div', note, 'tao-note')));
    return el;
  }

  // The line under the title.
  function summary(r, key, nowMs) {
    if (!key) return 'Needs an API key.';
    const npcs = r.npcs;
    if (!IDS.some((id) => npcs[id])) return r.error ? 'Couldn\'t read Torn.' : 'Reading Torn...';
    const asleep = PRAETORIANS.filter((id) => down(npcs[id])).length;
    if (asleep < PRAETORIANS.length) return (PRAETORIANS.length - asleep) + ' of 5 praetorians up. M\'aol shielded.';
    const m = npcs[MAOL];
    if (!m) return 'All 5 praetorians down.';
    if (!down(m)) {
      if (m.state !== 'unknown' && m.place) return 'M\'aol can be hit: in ' + m.place + '.';
      return 'M\'aol can be hit: ' + (m.words || 'where is unknown') + '.';
    }
    return 'All asleep. ' + nextSummoning(r, nowMs);
  }

  // When a new summoning is possible: 48 hours after M'aol's death (TornStats' time, or the
  // script's own), inside the window patch #408 gives, from 10:00 TCT on Oct 26 to 23:59:59 TCT
  // on Oct 31 of this year.
  function nextSummoning(r, nowMs) {
    const year = new Date(nowMs).getUTCFullYear();
    const opens = Date.UTC(year, 9, 26, 10, 0, 0);
    const ends = Date.UTC(year, 9, 31, 23, 59, 59);
    if (nowMs < opens) return 'Summoning opens ' + clock(opens, nowMs) + '.';
    if (nowMs > ends) return 'No more summonings this Halloween.';
    const died = fellAt(r, MAOL);
    if (died) {
      const from = died + RESUMMON_MS;
      if (from > ends) return 'No more summonings this Halloween.';
      if (from <= nowMs) return 'Next summoning possible now (48 h after M\'aol\'s death).';
      return 'Next summoning possible from ' + clock(from, nowMs) + ' (48 h after M\'aol\'s death).';
    }
    return 'Next summoning possible 48 h after M\'aol\'s death.';
  }

  // The footer: how long ago Torn last answered, or why the last call failed and, while Torn has
  // said to wait, when the next try is.
  function footer(r, key, nowMs) {
    if (!key) return '';
    if (r.stop) return 'Torn won\'t take the key: ' + r.error + '. Save a new key.';
    // A wait further off than Torn asks for is from a clock set back: the sweeps don't keep to
    // it (sweepDue), so it gets no time.
    const waiting = r.wait > nowMs && r.wait - nowMs <= BACK_OFF_MS;
    const retry = waiting ? ' Trying again at ' + clock(r.wait, nowMs) + '.' : '';
    if (r.error) return 'Couldn\'t read Torn: ' + r.error + '.' + retry + (r.okAt ? ' Last answer ' + ago(nowMs - r.okAt) + ' ago.' : '');
    if (r.okAt) return 'updated ' + ago(nowMs - r.okAt) + ' ago';
    return 'Reading Torn...';
  }

  // How long, in words: seconds under a minute, then minutes, then hours.
  function ago(ms) {
    const s = Math.max(0, Math.round(ms / 1000));
    if (s < 60) return s + ' s';
    const min = Math.floor(s / 60);
    return min < 60 ? min + ' min' : Math.floor(min / 60) + ' h';
  }

  // A time in TCT, Torn's clock (UTC), as HH:MM TCT, with the date when it isn't today.
  function clock(ms, nowMs) {
    const d = new Date(ms);
    const now = new Date(nowMs);
    const time = hhmm(ms) + ' TCT';
    const today = d.getUTCFullYear() === now.getUTCFullYear() && d.getUTCMonth() === now.getUTCMonth() && d.getUTCDate() === now.getUTCDate();
    return today ? time : MONTHS[d.getUTCMonth()] + ' ' + d.getUTCDate() + ' ' + time;
  }

  // A time in TCT as HH:MM, with nothing after it.
  function hhmm(ms) {
    const d = new Date(ms);
    const pad = (v) => (v < 10 ? '0' : '') + v;
    return pad(d.getUTCHours()) + ':' + pad(d.getUTCMinutes());
  }

  // ===== THE BOX'S CONTROLS =====

  // True while the Key button has the key row open.
  let keyOpen = false;
  // A drag under way: where the pointer and the box started, and whether the box moved.
  let drag = null;
  // Torn's API terms, as the script's header has them, shown in the key row.
  const TERMS = [
    ['Data Storage', 'Only on this device: the six NPCs\' last reading, the box\'s place, your key.'],
    ['Data Sharing', 'None. The script also reads TornStats\' public feed of the six, and sends TornStats nothing of yours.'],
    ['Purpose of Use', 'Show where the Ancient Ones are and which can be attacked.'],
    ['Key Storage & Sharing', 'Stored on this device in the script\'s storage; sent only to Torn\'s API.'],
    ['Key Access Level', 'Public.'],
  ];

  // The fold and close buttons, the key row, the Key button, the drag, and the box put at its
  // saved place.
  function controls() {
    const head = box.querySelector('.tao-head');
    head.appendChild(button('-', toggleFold, 'tao-fold'));
    head.appendChild(button('x', closeBox, 'tao-close'));
    const foot = box.querySelector('.tao-foot');
    foot.parentNode.insertBefore(keyRow(), foot);
    foot.appendChild(button('Key', toggleKey, 'tao-keybtn'));
    showFold(readPrefs().folded);
    placeBox();
    head.addEventListener('pointerdown', startDrag);
    window.addEventListener('pointermove', moveDrag);
    window.addEventListener('pointerup', endDrag);
    window.addEventListener('pointercancel', endDrag);
    window.addEventListener('blur', endDrag);
    window.addEventListener('resize', placeBox);
  }

  // A button of the box's. A click on it goes no further, and a surprise never breaks the page.
  function button(text, onClick, className) {
    const b = make('button', text, 'tao-btn ' + className);
    b.setAttribute('type', 'button');
    b.addEventListener('click', (e) => {
      if (e && e.stopPropagation) e.stopPropagation();
      try {
        onClick();
      } catch (err) {
        // Nothing more to do.
      }
    });
    return b;
  }

  // The box's place and fold, as stored: left and top (px; null for the default place, bottom
  // left), and whether it is folded.
  function readPrefs() {
    const p = readJson(BOX_STORE) || {};
    const num = (v) => (typeof v === 'number' || (typeof v === 'string' && v.trim() !== '')) && Number.isFinite(Number(v)) ? Number(v) : null;
    return { left: num(p.left), top: num(p.top), folded: p.folded === true };
  }

  function savePrefs(p) {
    gmSet(BOX_STORE, JSON.stringify(p));
  }

  // Folds the box to its title bar, or opens it again, and remembers which.
  function toggleFold() {
    const p = readPrefs();
    p.folded = !box.classList.contains('tao-folded');
    showFold(p.folded);
    savePrefs(p);
  }

  function showFold(folded) {
    box.classList.toggle('tao-folded', folded);
    const b = box.querySelector('.tao-fold');
    setText(b, folded ? '+' : '-');
    b.setAttribute('title', folded ? 'Open the box' : 'Fold the box');
  }

  // Closes the box until the page reloads. This page makes no more calls.
  function closeBox() {
    closed = true;
    clearInterval(timer);
    if (box) box.remove();
    box = null;
  }

  // Puts the box here, pulled back inside the window so none of it is off screen.
  function put(left, top) {
    const rect = box.getBoundingClientRect();
    const width = window.innerWidth || 0;
    const height = window.innerHeight || 0;
    box.style.left = Math.round(Math.max(0, Math.min(left, width - rect.width))) + 'px';
    box.style.top = Math.round(Math.max(0, Math.min(top, height - rect.height))) + 'px';
    box.style.right = 'auto';
    box.style.bottom = 'auto';
  }

  // Puts the box at its saved place, if it has one; else it stays at the default, bottom left.
  // Run on load and when the window resizes, so a place saved on a wide screen can't leave the
  // box off a phone's.
  function placeBox() {
    if (!box) return;
    const p = readPrefs();
    if (p.left !== null && p.top !== null) put(p.left, p.top);
  }

  // A drag by the title bar. It never touches the page's own styles, so a drag cut off part
  // way can't leave the page unable to scroll.
  function startDrag(e) {
    if (!box || drag) return;
    if (e.target && e.target.closest && e.target.closest('button')) return;
    if (typeof e.button === 'number' && e.button !== 0) return;
    const rect = box.getBoundingClientRect();
    drag = { x: e.clientX, y: e.clientY, left: rect.left, top: rect.top, moved: false };
    if (e.preventDefault) e.preventDefault();
  }

  function moveDrag(e) {
    if (!drag || !box) return;
    drag.moved = true;
    put(drag.left + e.clientX - drag.x, drag.top + e.clientY - drag.y);
  }

  // Ends a drag, however it ends: the pointer let go, the browser took the touch over, or the
  // window lost focus. Only a drag that moved the box saves its place.
  function endDrag() {
    if (!drag) return;
    const moved = drag.moved;
    drag = null;
    if (!moved || !box) return;
    const p = readPrefs();
    p.left = parseFloat(box.style.left) || 0;
    p.top = parseFloat(box.style.top) || 0;
    savePrefs(p);
  }

  // The key row: what the key is for, Torn's API terms, the field and Save. A plain text field,
  // not a password field, which sets off password managers.
  function keyRow() {
    const row = make('div', '', 'tao-keyrow');
    row.hidden = true;
    row.appendChild(make('div', 'With your API key, the script reads these six NPCs\' profiles from Torn\'s API, once a minute at most. A Public key is enough.', 'tao-keyfor'));
    TERMS.forEach((t) => row.appendChild(make('div', t[0] + ': ' + t[1], 'tao-term')));
    const input = make('input', '', 'tao-key');
    input.setAttribute('type', 'text');
    input.setAttribute('autocomplete', 'off');
    input.setAttribute('spellcheck', 'false');
    input.setAttribute('aria-label', 'API key');
    row.appendChild(input);
    row.appendChild(button('Save', saveKey, 'tao-save'));
    row.appendChild(make('div', '', 'tao-keymsg'));
    return row;
  }

  // Opens or closes the key row.
  function toggleKey() {
    keyOpen = !keyOpen;
    drawSafe();
  }

  // Saves the key in the field. '' removes the saved key, and PDA's is used again, if there is
  // one. A new key starts afresh: the last error, wait and stop go, and a sweep is due at once.
  function saveKey() {
    const input = box.querySelector('.tao-key');
    const value = String(input.value || '').trim();
    if (!saveChecked(KEY_STORE, value)) {
      setText(box.querySelector('.tao-keymsg'), 'Couldn\'t save the key on this device.');
      return;
    }
    input.value = '';
    setText(box.querySelector('.tao-keymsg'), '');
    keyOpen = false;
    const r = readReading();
    r.at = 0;
    r.error = '';
    r.wait = 0;
    r.stop = false;
    writeReading(r);
    tick();
  }

  // ===== START =====

  makeBox();
  controls();
  tick();
  const timer = setInterval(tick, TICK_MS);
  // A page that comes back into view reads at once if a sweep is due. PDA misreports this.
  document.addEventListener('visibilitychange', () => {
    if (!IS_PDA && document.visibilityState !== 'hidden') tick();
  });
  console.log('[Torn Ancient Ones ' + VERSION + '] running');
})();
