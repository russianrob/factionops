// Blood-bag lines from the faction's armoury news, for /bloodbags.
//
// Torn keeps years of armoury news but hands it out 100 lines at a time, newest
// first, so this keeps its own copy of just the blood-bag lines. An hourly poll
// picks up what is new. A one-off backfill walks a year back, a few pages with
// each hourly tick and none while a ranked war is live, so the war pollers keep
// the key's budget. Both write one store, and a line's own id
// decides what is a repeat. Spec: docs/superpowers/specs/2026-10-24-faction-blood-bag-board-design.md
//
// Every Torn call sends the key in the Authorization header, never in the URL,
// is tagged comment=wb-bloodbags in Torn's own log, and is recorded in
// warboard's key-usage log. The key is the owner's own: the one they signed in
// with, else OWNER_API_KEY. Never the faction key on file, which can be another
// member's, nor a pooled member key: Torn caps how many records one player may
// read a day, and the board spends only the owner's.
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as store from "./store.js";
import { logCall } from "./key-usage-log.js";
import { fetchFactionBasic } from "./torn-api.js";
import {
  TYPES, WINDOWS, parseLine, isUnreadBloodLine, liveWar, parseWindow, parseType, buildBoard,
} from "./blood-bags-model.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
export const FACTION = "42055";
// Fills, uses and hand-outs are armoryAction; deposits are armoryDeposit.
export const CATS = ["armoryAction", "armoryDeposit"];
const PAGE = 100;
// Every call this module makes waits its turn behind the one before, at least
// this far apart: 10 a minute for the poll and the backfill together.
export const GAP_MS = 6000;
// While a ranked war is live, backfill pages are at least this far apart: 2 a
// minute. The hourly tick takes no pages during a war, so this paces a run that
// is already going when one starts. The wait is the backfill's own, so the poll
// is not slowed.
export const WAR_GAP_MS = 30000;
// An hour of news fits in one page, even in a war. Thirty pages hold more than a
// day of war-time news, so after Torn's daily read cap has kept the poll out
// until it resets, the poll alone catches up. Anything past thirty pages goes
// to the backfill.
export const HEAD_MAX_PAGES = 30;
// The backfill pages each hourly tick takes, about 96 a day: the year fills in
// over days, on the owner's key, without using up their daily read cap.
export const TICK_PAGES = 4;
const BACKFILL_DAYS = 365;
const DAY = 86400;
export const POLL_MS = 60 * 60 * 1000;
// The backfill goes by a ranked-war list read this recently. The list is read
// with every hourly poll, so this leaves a late tick 5 minutes. With no such
// list it can't tell whether a war is on, so it goes at the war pace.
const WARS_FRESH_MS = POLL_MS + 5 * 60 * 1000;
// The backfill saves every this many pages; a restart repeats at most these.
const SAVE_EVERY = 10;

/** The owner's own key: the one they signed in with, else OWNER_API_KEY; null with neither. */
const ownerKey = () => store.getApiKeyForPlayer(OWNER_ID) || process.env.OWNER_API_KEY || null;

/**
 * Why the backfill waits, or null when it may go at full speed: a live ranked
 * war, or a war list too old to say (a missing warsAt counts as never read). The
 * hourly tick takes no pages while there is a reason, a run already going slows
 * to the war pace, and the route tells the page; all three ask here, so the log
 * and the page never disagree.
 */
function slowReason(wars, warsAt, nowMs) {
  if (!(nowMs - warsAt < WARS_FRESH_MS)) return "the ranked-war list has not been read in the last hour";
  const war = liveWar(wars, Math.floor(nowMs / 1000));
  return war ? `ranked war ${war.id} is live` : null;
}

// Worked out at call time, so a test that sets DATA_DIR first never touches the
// live folder. The store sits in its own folder, as chain-hits and gym-energy do.
export const defaultDataDir = () => join(process.env.DATA_DIR || join(__dirname, "data"), "blood-bags");

/**
 * The collector. Everything it touches comes in through opts, so a test can run
 * it against a fake Torn, a fake clock and a temporary folder:
 *   dataDir, fetchImpl, nowFn() -> ms, sleepFn(ms), keyFn() -> key or null, log(msg)
 * Nothing is read, written or scheduled until a method is called.
 *
 * The store, data/blood-bags/42055.json:
 *   lines       { [line id]: { ts, kind, type, qty, playerId, name, toId, toName } }
 *   cats        per category: headTs, the newest second the poll has reached, and
 *               gaps, the [from, to) ranges still to fetch (the backfill's work)
 *   cutoffSec   365 days before the UTC day the store was started
 *   wars        Torn's ranked-war list, as [{ id, start, end }], and warsAt,
 *               when it was last read successfully (ms)
 *   lastPollAt  when the last poll of both categories succeeded (ms)
 *   lastPollOk  whether the last poll succeeded (null before the first)
 *   unread      { [line id]: { ts, text } }: blood lines in a wording the reader
 *               does not know, kept so a later reader can count them
 */
export function createBloodBagCollector(opts = {}) {
  const dir = () => opts.dataDir || defaultDataDir();
  const fetchImpl = opts.fetchImpl || ((url, init) => fetch(url, init));
  const nowFn = opts.nowFn || (() => Date.now());
  const sleepFn = opts.sleepFn || ((ms) => new Promise((r) => setTimeout(r, ms)));
  const keyFn = opts.keyFn || ownerKey;
  const log = opts.log || ((msg) => console.log(msg));
  const setIntervalFn = opts.setIntervalFn || ((fn, ms) => setInterval(fn, ms));
  const clearIntervalFn = opts.clearIntervalFn || ((t) => clearInterval(t));
  const nowSec = () => Math.floor(nowFn() / 1000);
  const file = () => join(dir(), `${FACTION}.json`);

  let data = null;
  let lineList = null;
  let lastCallAt = -Infinity;
  let queue = Promise.resolve();
  // The backfill's own clock for the war pace, and what its last pace line said:
  // undefined until the first page, so every start says which pace it is at.
  let lastPageAt = -Infinity;
  let paceNote;
  let keyMissingLogged = false;
  let backfilling = null;
  let ticking = false;
  let timer = null;

  function fresh() {
    const today = Math.floor(nowSec() / DAY) * DAY;
    return {
      version: 1, factionId: FACTION, cutoffSec: today - BACKFILL_DAYS * DAY,
      lines: {}, cats: Object.fromEntries(CATS.map((c) => [c, { headTs: null, gaps: [] }])),
      wars: [], warsAt: 0, lastPollAt: null, lastPollOk: null, unread: {},
    };
  }

  function load() {
    if (data) return data;
    try {
      const raw = JSON.parse(readFileSync(file(), "utf8"));
      if (!raw || raw.version !== 1 || !raw.lines || !raw.cats) throw new Error("not a blood-bag store");
      data = raw;
      for (const c of CATS) data.cats[c] = data.cats[c] || { headTs: null, gaps: [] };
      // Fields added after the first stores were written.
      if (data.lastPollOk === undefined) data.lastPollOk = null;
      data.unread = data.unread || {};
      // A blood line an older reader could not read is counted once this one can.
      for (const [id, u] of Object.entries(data.unread)) {
        const rec = parseLine(u && u.text);
        if (!rec) continue;
        if (!data.lines[id]) data.lines[id] = { ts: Number(u.ts) || 0, ...rec };
        delete data.unread[id];
      }
    } catch (err) {
      if (err.code !== "ENOENT") {
        // Set aside rather than written over, so it can be looked at; the board
        // starts again from the news.
        log(`[blood-bags] store unreadable (${err.message}); starting afresh`);
        try { renameSync(file(), `${file()}.unreadable-${nowFn()}`); } catch (_) { /* already gone */ }
      }
      data = fresh();
    }
    return data;
  }

  // A temporary file and a rename, so a restart mid-write never leaves half a store.
  function save() {
    if (!data) return;
    mkdirSync(dir(), { recursive: true });
    const tmp = `${file()}.tmp-${process.pid}`;
    writeFileSync(tmp, JSON.stringify(data));
    renameSync(tmp, file());
  }

  function pace() {
    const turn = queue.then(async () => {
      const wait = lastCallAt + GAP_MS - nowFn();
      if (wait > 0) await sleepFn(wait);
      lastCallAt = nowFn();
    });
    queue = turn.catch(() => {});
    return turn;
  }

  // One Torn v2 call. Throws on any failure, with err.code set to Torn's error
  // code, or "no-key" when there is no usable key.
  async function tornGet(path, params) {
    const key = keyFn();
    if (!key) {
      const err = new Error("no owner key: no sign-in key on file and no OWNER_API_KEY");
      err.code = "no-key";
      throw err;
    }
    const url = `https://api.torn.com/v2${path}?${new URLSearchParams({ ...params, comment: "wb-bloodbags" })}`;
    await pace();
    let res, text;
    try {
      res = await fetchImpl(url, { headers: { Authorization: `ApiKey ${key}` }, signal: AbortSignal.timeout(30000) });
      text = await res.text();
    } catch (e) {
      logCall(key, url, "blood-bags", "network");
      throw new Error(`network: ${e.message}`);
    }
    let body = null;
    try { body = JSON.parse(text); } catch (_) { /* judged by the status below */ }
    // Torn reports errors in the body, usually with HTTP 200.
    if (body && body.error) {
      logCall(key, url, "blood-bags", body.error.code);
      const err = new Error(`Torn API error: ${body.error.error} (code ${body.error.code})`);
      err.code = body.error.code;
      throw err;
    }
    logCall(key, url, "blood-bags", res.status);
    if (!res.ok || !body) throw new Error(`HTTP ${res.status}`);
    keyMissingLogged = false;
    return body;
  }

  function fail(what, err) {
    if (err.code === "no-key") {
      if (!keyMissingLogged) log("[blood-bags] no owner key (no sign-in key on file and no OWNER_API_KEY); trying again next hour");
      keyMissingLogged = true;
      return;
    }
    log(`[blood-bags] ${what} failed: ${err.message}`);
  }

  // Keeps a news entry if it is a blood line not already stored and inside the year.
  function keep(e) {
    const id = String(e.id);
    const ts = Number(e.timestamp) || 0;
    if (data.lines[id] || ts < data.cutoffSec) return;
    const rec = parseLine(e.text);
    if (!rec) {
      if (isUnreadBloodLine(e.text) && !data.unread[id]) {
        data.unread[id] = { ts, text: String(e.text) };
        log(`[blood-bags] unread blood line ${id}: ${e.text}`);
      }
      return;
    }
    data.lines[id] = { ts, ...rec };
    lineList = null;
  }

  /**
   * Walks [from, to) newest first, at most maxPages pages, keeping blood lines.
   * Torn's `from` includes its own second and `to` leaves its own second out
   * (checked live on 2026-10-24); null leaves that end open. Returns
   * { done, to, newest }: done when it reached `from` or the end of the news,
   * otherwise `to` is where to carry on; newest is the first page's newest second.
   */
  async function walk(cat, from, to, maxPages) {
    let newest = null;
    for (let page = 0; page < maxPages; page++) {
      const params = { cat, limit: String(PAGE), sort: "DESC", stripTags: "false" };
      if (from != null) params.from = String(from);
      if (to != null) params.to = String(to);
      const body = await tornGet("/faction/news", params);
      // Read as empty, a reply without its list would end the walk, and the
      // backfill would drop the gap it was filling.
      if (!Array.isArray(body.news)) throw new Error("the news reply has no list");
      const news = body.news;
      for (const e of news) keep(e);
      const stamps = news.map((e) => Number(e.timestamp) || 0);
      if (page === 0 && stamps.length) newest = Math.max(...stamps);
      if (news.length < PAGE) return { done: true, to, newest };
      const oldest = Math.min(...stamps);
      if (from != null && oldest < from) return { done: true, to, newest };
      // oldest + 1 keeps the rest of the oldest second for the next page, and
      // lines already stored are dropped by id. If that is where this page
      // started, the whole page is one second: step past it.
      let next = oldest + 1;
      if (to != null && next >= to) {
        log(`[blood-bags] ${cat}: a full page at second ${oldest}; stepping past it, so lines beyond the page may be missing`);
        // Below this page's own `to` even if Torn sent lines at or past it, so the
        // walk always moves down.
        next = Math.min(oldest, to - 1);
      }
      to = next;
    }
    return { done: false, to, newest };
  }

  /**
   * The hourly poll: each category from its newest line down to the newest
   * second already stored. The first ever poll takes one page and leaves the
   * year below it to the backfill. Returns true when both categories succeeded.
   */
  async function pollOnce() {
    load();
    let ok = true;
    for (const cat of CATS) {
      const c = data.cats[cat];
      try {
        if (c.headTs == null) {
          const r = await walk(cat, null, null, 1);
          c.headTs = r.newest ?? nowSec();
          if (!r.done && r.to > data.cutoffSec) c.gaps.push({ from: data.cutoffSec, to: r.to });
        } else {
          const r = await walk(cat, c.headTs, null, HEAD_MAX_PAGES);
          if (!r.done) {
            log(`[blood-bags] ${cat}: the poll stopped after ${HEAD_MAX_PAGES} pages; the backfill takes the rest`);
            c.gaps.push({ from: c.headTs, to: r.to });
          }
          if (r.newest != null) c.headTs = Math.max(c.headTs, r.newest);
        }
      } catch (err) {
        ok = false;
        fail(`${cat} poll`, err);
      }
    }
    if (ok) data.lastPollAt = nowFn();
    data.lastPollOk = ok;
    save();
    return ok;
  }

  /**
   * What the route reads: { lines, wars, warsAt, lastPollAt, lastPollOk,
   * reachSec, backfillDone, cutoffSec, cats }. reachSec is how far back the
   * history is complete: the year's floor once the backfill is done, the top of
   * the newest gap until then, null before the first poll.
   */
  function snapshot() {
    load();
    if (!lineList) lineList = Object.values(data.lines);
    const reachOf = (c) => (c.headTs == null ? null : c.gaps.length ? Math.max(...c.gaps.map((g) => g.to)) : data.cutoffSec);
    const reaches = CATS.map((cat) => reachOf(data.cats[cat]));
    const started = reaches.every((r) => r != null);
    return {
      lines: lineList,
      wars: data.wars,
      warsAt: data.warsAt,
      lastPollAt: data.lastPollAt,
      lastPollOk: data.lastPollOk,
      reachSec: started ? Math.max(...reaches) : null,
      backfillDone: started && CATS.every((cat) => data.cats[cat].gaps.length === 0),
      cutoffSec: data.cutoffSec,
      cats: JSON.parse(JSON.stringify(data.cats)),
    };
  }

  /** Torn's public ranked-war list for the faction; one call reaches back two years. */
  async function refreshWars() {
    load();
    try {
      const body = await tornGet(`/faction/${FACTION}/rankedwars`, {});
      // Taken as no wars, a reply without its list would let the backfill run
      // through a live one at full speed.
      if (!Array.isArray(body.rankedwars)) throw new Error("the ranked-war reply has no list");
      data.wars = body.rankedwars.map((w) => ({ id: w.id, start: Number(w.start) || 0, end: Number(w.end) || 0 }));
      data.warsAt = nowFn();
      save();
      return true;
    } catch (err) {
      fail("war list", err);
      return false;
    }
  }

  const hasGaps = () => CATS.some((cat) => data.cats[cat].gaps.length > 0);

  // The newest gap first, so the history fills in from the present backwards.
  function nextGap() {
    let best = null;
    for (const cat of CATS) {
      for (const gap of data.cats[cat].gaps) if (!best || gap.to > best.gap.to) best = { cat, gap };
    }
    return best;
  }

  /**
   * Before each backfill page: while a ranked war is live, or the war list is
   * too old to say, wait until WAR_GAP_MS after the page before. The wait is
   * outside pace(), so the hourly poll's calls go out in between. A line is
   * logged at the first page after a start, and when the pace or its reason
   * changes, not for every page.
   */
  async function warPace() {
    const note = slowReason(data.wars, data.warsAt, nowFn());
    if (note !== paceNote) {
      log(note ? `[blood-bags] backfill ${paceNote ? "still at" : "slowed to"} 2 calls a minute: ${note}`
        : `[blood-bags] backfill ${paceNote === undefined ? "at" : "back to"} 10 calls a minute: no ranked war is live`);
      paceNote = note;
    }
    if (!note) return;
    const wait = lastPageAt + WAR_GAP_MS - nowFn();
    if (wait > 0) await sleepFn(wait);
  }

  async function backfill(maxPages) {
    load();
    let pages = 0;
    try {
      while (pages < maxPages) {
        const next = nextGap();
        if (!next) break;
        await warPace();
        const r = await walk(next.cat, next.gap.from, next.gap.to, 1);
        // Taken once the page is back, since pace() may have held the call: the
        // war pace counts from here, so pages never go less than WAR_GAP_MS apart.
        lastPageAt = nowFn();
        if (r.done) data.cats[next.cat].gaps.splice(data.cats[next.cat].gaps.indexOf(next.gap), 1);
        else next.gap.to = r.to;
        if (++pages % SAVE_EVERY === 0) save();
      }
      if (pages && !hasGaps()) log(`[blood-bags] backfill done: history reaches ${new Date(data.cutoffSec * 1000).toISOString().slice(0, 10)}`);
    } catch (err) {
      // Its place is kept; the next hourly tick starts it again from there.
      fail("backfill", err);
    } finally {
      // A save that throws here must not escape: under pm2 an unhandled
      // rejection ends the whole server.
      try { save(); } catch (err) { fail("backfill save", err); }
    }
  }

  /**
   * The backfill: fills the gaps, newest first, a page per call, at most
   * maxPages pages (by default all of them), GAP_MS apart, or WAR_GAP_MS while a
   * ranked war is live or the war list is out of date. It stops on any error,
   * and the next hourly tick carries on from where it stopped. A call while a
   * run is going joins that run. Returns the run, which never rejects.
   */
  function runBackfill(maxPages = Infinity) {
    if (!backfilling) {
      backfilling = backfill(maxPages)
        .catch((err) => log(`[blood-bags] backfill failed: ${err.message}`))
        .finally(() => { backfilling = null; });
    }
    return backfilling;
  }

  /**
   * Every hour: the ranked-war list, the poll, then up to TICK_PAGES pages of
   * the backfill. The war list is read every time, so a war's start and end
   * reach the board within the hour, as everything else does. No pages while a
   * ranked war is live, nor in an hour whose read of the list failed: the list
   * from the hour before still counts as fresh, but cannot say whether a war
   * has started since. Resolves once the hour's pages are done.
   */
  async function tick() {
    if (ticking) return;
    ticking = true;
    try {
      load();
      const listed = await refreshWars();
      await pollOnce();
      if (listed && hasGaps() && slowReason(data.wars, data.warsAt, nowFn()) === null) await runBackfill(TICK_PAGES);
    } finally {
      ticking = false;
    }
  }

  /** One tick now, then one an hour. Starting twice does nothing. */
  function start() {
    if (timer) return Promise.resolve();
    timer = setIntervalFn(() => { tick().catch((e) => log(`[blood-bags] tick failed: ${e.message}`)); }, POLL_MS);
    return tick().catch((e) => log(`[blood-bags] tick failed: ${e.message}`));
  }

  function stop() {
    if (timer) clearIntervalFn(timer);
    timer = null;
  }

  return { load, save, pollOnce, snapshot, refreshWars, runBackfill, tick, start, stop };
}

// The one the server runs; routes.js reads it through createBloodBagsApi.
export const bloodBagCollector = createBloodBagCollector();

/** server.js starts the hourly poll, and with it the backfill's pages, with this. */
export function start() {
  return bloodBagCollector.start();
}

// ── /api/bloodbags ──────────────────────────────────────────────────────────
export const OWNER_ID = "137558";
export const NOT_A_MEMBER = "This board is for Dead Fragment members.";
// The roster moves slowly, so it is kept for an hour, as /slackers does.
const ROSTER_TTL_MS = 60 * 60 * 1000;
// A viewer missing from the roster gets it fetched again before being turned
// away, but never more often than this; so does a failed refresh.
const ROSTER_RECHECK_MS = 5 * 60 * 1000;
// A roster fetch that hangs would hold every board request waiting on it.
const ROSTER_TIMEOUT_MS = 20 * 1000;

// The promise, or a rejection once ms have passed; the timer is cleared either way.
function withTimeout(promise, ms) {
  let timer;
  const limit = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`no answer within ${ms / 1000} s`)), ms);
  });
  return Promise.race([promise, limit]).finally(() => clearTimeout(timer));
}

/**
 * Today's members, as [{ playerId, name }], from what fetchFactionBasic returns:
 * Torn's v1 faction basic, whose `members` is a map keyed by player id (the
 * /slackers roster reads it the same way).
 */
export function rosterFromBasic(basic) {
  return Object.entries((basic && basic.members) || {}).map(([id, m]) => ({ playerId: String(id), name: String((m && m.name) || id) }));
}

/**
 * The route's handler, as { handle(req, res) }. requireAuth has already checked
 * the token and put its claims on req.user. opts, for tests: collector (has
 * snapshot()), rosterFn() -> [{ playerId, name }], nowFn() -> ms, log(msg),
 * rosterTimeoutMs.
 */
export function createBloodBagsApi(opts = {}) {
  const collector = opts.collector || bloodBagCollector;
  const nowFn = opts.nowFn || (() => Date.now());
  const log = opts.log || ((msg) => console.error(msg));
  const rosterTimeoutMs = opts.rosterTimeoutMs || ROSTER_TIMEOUT_MS;
  // The owner's own key, the same call /slackers makes for its roster.
  const rosterFn = opts.rosterFn || (async () => {
    const key = ownerKey();
    if (!key) throw new Error("no owner key: no sign-in key on file and no OWNER_API_KEY");
    return rosterFromBasic(await fetchFactionBasic(FACTION, key));
  });

  let roster = { at: 0, members: [], stale: false };
  let failedAt = -Infinity;
  let inflight = null;

  // Today's members, fetched again once older than maxAgeMs. A failed fetch
  // keeps the last list, marked stale, rather than blanking the board.
  function getRoster(maxAgeMs) {
    const now = nowFn();
    if (now - roster.at < maxAgeMs || now - failedAt < ROSTER_RECHECK_MS) return Promise.resolve(roster);
    if (!inflight) {
      inflight = (async () => {
        try {
          roster = { at: nowFn(), members: await withTimeout(rosterFn(), rosterTimeoutMs), stale: false };
        } catch (err) {
          failedAt = nowFn();
          roster = { ...roster, stale: roster.members.length > 0 };
          log(`[blood-bags] roster refresh failed: ${err.message}`);
        }
        return roster;
      })().finally(() => { inflight = null; });
    }
    return inflight;
  }

  async function handle(req, res) {
    res.set("Cache-Control", "no-store");
    try {
      const viewerId = String((req.user && req.user.playerId) ?? "");
      const isOwner = viewerId === OWNER_ID;
      if (!isOwner && String((req.user && req.user.factionId) ?? "") !== FACTION) {
        return res.status(403).json({ error: NOT_A_MEMBER });
      }
      const query = req.query || {};
      const window = parseWindow(query.window);
      if (!window) return res.status(400).json({ error: "Unknown timeframe." });
      const type = parseType(query.type);
      if (!type) return res.status(400).json({ error: "Unknown blood type." });

      // A token lasts 90 days and outlives membership, so the faction it names is
      // checked against today's roster too. Someone who joined since the roster
      // was fetched gets a fresh look before being turned away.
      let r = await getRoster(ROSTER_TTL_MS);
      const listed = () => r.members.some((m) => String(m.playerId) === viewerId);
      if (!isOwner && r.members.length && !listed()) {
        r = await getRoster(ROSTER_RECHECK_MS);
        if (!listed()) return res.status(403).json({ error: NOT_A_MEMBER });
      }
      if (!r.members.length) return res.status(502).json({ error: "The member list is unavailable right now." });

      const snap = collector.snapshot();
      const nowMs = nowFn();
      const nowSec = Math.floor(nowMs / 1000);
      const board = buildBoard({
        lines: snap.lines, roster: r.members, wars: snap.wars, nowSec, window, type, viewerId,
        reachSec: snap.reachSec ?? nowSec,
      });
      return res.json({
        ...board,
        updatedAt: snap.lastPollAt,
        reachSec: snap.reachSec,
        backfillDone: snap.backfillDone,
        // Whether the rest is filling in at the war pace, so the page can say "slowly".
        backfillSlow: !snap.backfillDone && slowReason(snap.wars, snap.warsAt, nowMs) !== null,
        liveWar: liveWar(snap.wars, nowSec),
        windows: Object.keys(WINDOWS),
        types: ["all", ...TYPES],
        rosterStale: r.stale,
        lastPollFailed: snap.lastPollOk === false,
      });
    } catch (err) {
      log(`[blood-bags] /api/bloodbags failed: ${err.message}`);
      return res.status(500).json({ error: "internal error" });
    }
  }

  return { handle };
}
