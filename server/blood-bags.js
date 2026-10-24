// Blood-bag lines from the faction's armoury news, for /bloodbags.
//
// Torn keeps years of armoury news but hands it out 100 lines at a time, newest
// first, so this keeps its own copy of just the blood-bag lines. An hourly poll
// picks up what is new. A one-off backfill walks a year back, at no more than
// 10 calls a minute and never while a ranked war is live, so the war pollers
// keep the key's budget. Both write one store, and a line's own id decides what
// is a repeat. Spec: docs/superpowers/specs/2026-10-24-faction-blood-bag-board-design.md
//
// Every Torn call sends the key in the Authorization header, never in the URL,
// is tagged comment=wb-bloodbags in Torn's own log, and is recorded in
// warboard's key-usage log. The key is the owner's faction key, never a pooled
// member key, as /slackers does.
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as store from "./store.js";
import { logCall } from "./key-usage-log.js";
import { parseLine, isUnreadBloodLine, liveWar } from "./blood-bags-model.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
export const FACTION = "42055";
// Fills, uses and hand-outs are armoryAction; deposits are armoryDeposit.
export const CATS = ["armoryAction", "armoryDeposit"];
const PAGE = 100;
// Every call this module makes waits its turn behind the one before, at least
// this far apart: 10 a minute for the poll and the backfill together.
export const GAP_MS = 6000;
// An hour of news fits in one page. Ten pages is about three days of it, so the
// cap only bites after a long outage, and what it leaves goes to the backfill.
export const HEAD_MAX_PAGES = 10;
const BACKFILL_DAYS = 365;
const DAY = 86400;
export const POLL_MS = 60 * 60 * 1000;
// The war list is wanted daily, and hourly while the backfill has work, so the
// backfill sees a war start and end.
const WARS_DAILY_MS = 24 * 60 * 60 * 1000;
// The backfill saves every this many pages; a restart repeats at most these.
const SAVE_EVERY = 10;

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
 *   wars        Torn's ranked-war list, as [{ id, start, end }], and warsAt
 *   lastPollAt  when the last poll of both categories succeeded (ms)
 */
export function createBloodBagCollector(opts = {}) {
  const dir = () => opts.dataDir || defaultDataDir();
  const fetchImpl = opts.fetchImpl || ((url, init) => fetch(url, init));
  const nowFn = opts.nowFn || (() => Date.now());
  const sleepFn = opts.sleepFn || ((ms) => new Promise((r) => setTimeout(r, ms)));
  const keyFn = opts.keyFn || (() => store.getFactionApiKey(FACTION));
  const log = opts.log || ((msg) => console.log(msg));
  const setIntervalFn = opts.setIntervalFn || ((fn, ms) => setInterval(fn, ms));
  const clearIntervalFn = opts.clearIntervalFn || ((t) => clearInterval(t));
  const nowSec = () => Math.floor(nowFn() / 1000);
  const file = () => join(dir(), `${FACTION}.json`);

  let data = null;
  let lineList = null;
  let lastCallAt = -Infinity;
  let queue = Promise.resolve();
  let keyMissingLogged = false;
  const unreadLogged = new Set();
  let backfilling = null;
  let ticking = false;
  let timer = null;

  function fresh() {
    const today = Math.floor(nowSec() / DAY) * DAY;
    return {
      version: 1, factionId: FACTION, cutoffSec: today - BACKFILL_DAYS * DAY,
      lines: {}, cats: Object.fromEntries(CATS.map((c) => [c, { headTs: null, gaps: [] }])),
      wars: [], warsAt: 0, lastPollAt: null,
    };
  }

  function load() {
    if (data) return data;
    try {
      const raw = JSON.parse(readFileSync(file(), "utf8"));
      if (!raw || raw.version !== 1 || !raw.lines || !raw.cats) throw new Error("not a blood-bag store");
      data = raw;
      for (const c of CATS) data.cats[c] = data.cats[c] || { headTs: null, gaps: [] };
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
      const err = new Error("no faction key on file, or it is quarantined");
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
      if (!keyMissingLogged) log(`[blood-bags] no faction key for ${FACTION}; trying again next hour`);
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
      if (isUnreadBloodLine(e.text) && !unreadLogged.has(id)) {
        unreadLogged.add(id);
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
      const news = Array.isArray(body.news) ? body.news : [];
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
        next = oldest;
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
    save();
    return ok;
  }

  /**
   * What the route reads: { lines, wars, lastPollAt, reachSec, backfillDone,
   * cutoffSec, cats }. reachSec is how far back the history is complete: the
   * year's floor once the backfill is done, the top of the newest gap until
   * then, null before the first poll.
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
      lastPollAt: data.lastPollAt,
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
      const list = Array.isArray(body.rankedwars) ? body.rankedwars : [];
      data.wars = list.map((w) => ({ id: w.id, start: Number(w.start) || 0, end: Number(w.end) || 0 }));
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

  async function backfill() {
    load();
    let pages = 0;
    try {
      for (;;) {
        const next = nextGap();
        if (!next) break;
        const war = liveWar(data.wars, nowSec());
        if (war) {
          log(`[blood-bags] backfill waiting: ranked war ${war.id} is live`);
          break;
        }
        const r = await walk(next.cat, next.gap.from, next.gap.to, 1);
        if (r.done) data.cats[next.cat].gaps.splice(data.cats[next.cat].gaps.indexOf(next.gap), 1);
        else next.gap.to = r.to;
        if (++pages % SAVE_EVERY === 0) save();
      }
      if (pages && !hasGaps()) log(`[blood-bags] backfill done: history reaches ${new Date(data.cutoffSec * 1000).toISOString().slice(0, 10)}`);
    } catch (err) {
      // Its place is kept; the next hourly tick starts it again from there.
      fail("backfill", err);
    } finally {
      save();
    }
  }

  /**
   * The backfill: fills every gap, newest first, a page per call, GAP_MS apart.
   * It stops while a ranked war is live, and on any error, and the next hourly
   * tick starts it again from where it stopped. Returns the run in progress.
   */
  function runBackfill() {
    if (!backfilling) backfilling = backfill().finally(() => { backfilling = null; });
    return backfilling;
  }

  /** Every hour: the war list when it is due, the poll, then the backfill if there is work. */
  async function tick() {
    if (ticking) return;
    ticking = true;
    try {
      load();
      const every = hasGaps() ? POLL_MS : WARS_DAILY_MS;
      if (nowFn() - data.warsAt >= every - 60 * 1000) await refreshWars();
      await pollOnce();
      if (hasGaps()) runBackfill();
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

/** server.js starts the hourly poll and the backfill with this. */
export function start() {
  return bloodBagCollector.start();
}
