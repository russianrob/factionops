/**
 * Genocide marks: which members hold Torn's Genocide honor (478), "make a
 * single hit that earns your faction 1,000 or more respect".
 *
 * Two sources, merged per member:
 *
 *   faction hits  A chain's bonus hits pay fixed respect (the 1,000th 640,
 *                 the 2,500th 1,280, the 5,000th 2,560), so every bonus
 *                 worth 1,000+ in the faction's chain reports earned its
 *                 attacker the honor. Finished chains are read once, from
 *                 the chain list the daily faction-history tick fetches; the
 *                 running chain from Torn's id-less chain report, read only
 *                 when the live chain count passes a bonus mark worth 1,000+
 *                 (the count is checked every 30 minutes, at no cost).
 *   own answers   Torn shows a player's honors to their own key only, so a
 *                 member who earned it in another faction is known only from
 *                 their FactionOps, which reads its own honors once a day and
 *                 reports yes or no (POST /api/me/honors).
 *
 * FactionOps 5.6.29 marks the faction info tab from GET /api/genocide.
 *
 * Store, data/genocide-<factionId>.json:
 *   hits     { <playerId>: { hit, respect, chainId, start } }  earliest qualifying hit
 *   scanned  { <chainId>: 1 }                                   finished chains already read
 *   self     { <playerId>: { has, checkedAt } }                 each member's own answer; only has is served
 *
 * One object per faction lives in memory and every writer changes that same
 * object, so a scan waiting on Torn can never save over an answer that
 * arrived in the meantime.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { fetchChainReport } from "./faction-history.js";

const DATA_DIR = process.env.DATA_DIR || "./data";

export const GENOCIDE_RESPECT = 1000;   // the honor's threshold
export const GENOCIDE_MIN_CHAIN = 2500; // the first bonus that pays it; the 1,000th pays 640
// The bonus hits that pay it: the 2,500th pays 1,280, and each later bonus doubles that.
export const GENOCIDE_MARKS = [GENOCIDE_MIN_CHAIN, 5000, 10000, 25000, 50000, 100000];
export const FINISHED_GRACE_S = 3600;   // a chain is read as finished an hour after its end
// How often the live chain count is checked. Checking costs nothing; the
// running chain's report is read only when the count passes a new mark.
export const LIVE_SCAN_MS = 30 * 60 * 1000;
// After faction-history's boot tick (5 min), so a restart does not spend the
// owner's key before the pollers people are waiting on have settled.
export const LIVE_BOOT_DELAY_MS = 6 * 60 * 1000;

// ── The faction's own record ───────────────────────────────────────────

/** The bonus hits in one chain report that earned the honor. */
export function bonusHolders(report) {
  if (!report || !Array.isArray(report.bonuses)) return [];
  const out = [];
  for (const b of report.bonuses) {
    if (!b || !b.attacker_id || !(Number(b.respect) >= GENOCIDE_RESPECT)) continue;
    out.push({
      id: String(b.attacker_id),
      hit: Number(b.chain) || 0,
      respect: Number(b.respect),
      chainId: String(report.id),
      start: Number(report.start) || 0,
    });
  }
  return out;
}

// The earlier of two hits: the earlier chain, or the lower hit in one chain.
const earlier = (a, b) => a.start < b.start || (a.start === b.start && a.hit < b.hit);

/** Fold holders in, keeping each member's earliest hit. Returns how many changed. */
export function foldHits(store, holders) {
  store.hits ||= {};
  let changed = 0;
  for (const h of holders || []) {
    const have = store.hits[h.id];
    if (have && !earlier(h, have)) continue;
    store.hits[h.id] = { hit: h.hit, respect: h.respect, chainId: h.chainId, start: h.start };
    changed++;
  }
  return changed;
}

// ── A member's own answer ──────────────────────────────────────────────

/**
 * FactionOps' answer, { genocide: true | false | null }. A null withdraws it
 * (the member switched sharing off). Anything else is refused, and any other
 * field, a date included, is never kept: the member was promised yes or no.
 */
export function parseSelfReport(body) {
  if (!body || typeof body !== "object") return null;
  const v = body.genocide;
  if (v === null) return { has: null };
  return typeof v === "boolean" ? { has: v } : null;
}

/** Keep one member's answer, or forget it on a withdrawal. */
export function foldSelf(store, playerId, report, nowS) {
  store.self ||= {};
  const id = String(playerId);
  if (report.has === null) { delete store.self[id]; return; }
  store.self[id] = { has: report.has, checkedAt: nowS };
}

/**
 * What FactionOps shows, per member. A faction hit wins over a member's own
 * "no": it is Torn's record, and the "no" may be older than the hit. A
 * member's own answer goes out as yes or no only; when they last checked
 * stays here.
 */
export function genocideView(store) {
  const out = {};
  for (const [id, s] of Object.entries(store.self || {})) {
    out[id] = s.has ? { has: true, via: "self" } : { has: false };
  }
  for (const [id, h] of Object.entries(store.hits || {})) {
    out[id] = { has: true, via: "hit", hit: h.hit, start: h.start };
  }
  return out;
}

// ── Which chains to read ───────────────────────────────────────────────

/**
 * Finished chains of 2,500+ hits not yet read, each id once (Torn's chain
 * list repeats a row at its page seams). A chain that ended under an hour
 * ago may still be running; the live scan covers it until then.
 */
export function chainsToScan(chains, store, nowS) {
  const seen = new Set();
  const out = [];
  for (const c of chains || []) {
    if (!c) continue;
    const id = String(c.id);
    if (seen.has(id)) continue;
    seen.add(id);
    if (!(c.chain >= GENOCIDE_MIN_CHAIN)) continue;
    if (!(c.end > 0 && c.end < nowS - FINISHED_GRACE_S)) continue;
    if (store.scanned && store.scanned[id]) continue;
    out.push(id);
  }
  return out;
}

// ── The store ──────────────────────────────────────────────────────────

const _stores = new Map();
const fileOf = (factionId, dir) => join(dir, `genocide-${factionId}.json`);

/** The faction's store: read from disk once, then the same object for every caller. */
export function genocideStore(factionId, dir = DATA_DIR) {
  const k = `${dir}|${factionId}`;
  let s = _stores.get(k);
  if (s) return s;
  s = { hits: {}, scanned: {}, self: {} };
  try {
    const f = fileOf(factionId, dir);
    if (existsSync(f)) {
      const d = JSON.parse(readFileSync(f, "utf-8"));
      s = { hits: d.hits || {}, scanned: d.scanned || {}, self: d.self || {} };
    }
  } catch (e) {
    // A file that will not parse starts the faction afresh; the next save
    // replaces it, and the daily tick reads the chains again.
    console.warn(`[genocide] could not read the store for ${factionId}: ${e.message}`);
  }
  _stores.set(k, s);
  return s;
}

export function saveGenocide(factionId, dir = DATA_DIR) {
  try {
    mkdirSync(dir, { recursive: true });
    writeFileSync(fileOf(factionId, dir), JSON.stringify(genocideStore(factionId, dir)));
  } catch (e) {
    console.error(`[genocide] could not save the store for ${factionId}: ${e.message}`);
  }
}

/** A member's own answer, kept and saved (POST /api/me/honors). */
export function recordSelfReport(factionId, playerId, report, nowS, dir = DATA_DIR) {
  foldSelf(genocideStore(factionId, dir), playerId, report, nowS);
  saveGenocide(factionId, dir);
}

/** The faction's marks (GET /api/genocide). */
export function genocideMembers(factionId, dir = DATA_DIR) {
  return genocideView(genocideStore(factionId, dir));
}

// ── The scans ──────────────────────────────────────────────────────────

/**
 * Read each finished chain of 2,500+ hits once, at most `budget` a run. A
 * failed read stays unread and is asked again next time, and so does a
 * report without a 1,000+ bonus: every such chain has one (the 2,500th pays
 * 1,280), so that is a changed answer from Torn, not a chain with no holder.
 */
export async function scanFinishedChains(fetchReport, factionId, chains,
  { nowS = Math.floor(Date.now() / 1000), dir = DATA_DIR, budget = 60 } = {}) {
  const store = genocideStore(factionId, dir);
  let fetched = 0, found = 0;
  for (const id of chainsToScan(chains, store, nowS).slice(0, budget)) {
    let report;
    try {
      report = await fetchReport(id);
    } catch (e) {
      console.warn(`[genocide] chain report ${id}: ${e.message}`);
      continue;
    }
    if (report) fetched++;
    const holders = bonusHolders(report);
    if (!holders.length) {
      console.warn(`[genocide] chain report ${id}: no bonus of ${GENOCIDE_RESPECT}+ respect, read again next run`);
      continue;
    }
    found += foldHits(store, holders);
    store.scanned[id] = 1;
  }
  saveGenocide(factionId, dir);
  return { fetched, found };
}

/** The highest bonus mark worth 1,000+ that a chain count has reached; 0 below the first. */
export function markReached(count) {
  let mark = 0;
  for (const m of GENOCIDE_MARKS) if (count >= m) mark = m;
  return mark;
}

/**
 * The latest chain's report, running or just finished: its holders, and the
 * highest bonus mark it shows. Never marked read, so the daily tick still
 * reads the chain once it is over and picks up a bonus made after the last
 * live read.
 */
export async function scanLiveChain(fetchReport, factionId, { dir = DATA_DIR } = {}) {
  const report = await fetchReport(null);
  const found = foldHits(genocideStore(factionId, dir), bonusHolders(report));
  if (found) saveGenocide(factionId, dir);
  const hits = report && Array.isArray(report.bonuses)
    ? report.bonuses.map((b) => Number(b && b.chain) || 0) : [];
  return { found, mark: markReached(Math.max(0, ...hits)) };
}

/**
 * The running chain, read only when its count passes a bonus mark worth
 * 1,000+ that no report has shown yet: a quiet day costs no call, a big
 * chain one a mark. The count is the one the chain monitor stores, which
 * carries no chain id, so a count under the first mark (a new chain, none,
 * or a member's bad 0) starts the marks afresh, and the real count back
 * again costs one read. A report that does not show the mark yet (Torn's
 * report can trail the count) is read again at the next check, and so is
 * a read that failed.
 *
 * Returns check(count), which resolves to the new holders found, 0 when it
 * did not read.
 */
export function liveChainWatch(fetchReport, factionId, { dir = DATA_DIR } = {}) {
  let shown = 0;   // the highest mark a report has shown for this chain
  return async function check(count) {
    const n = Number(count) || 0;
    if (n < GENOCIDE_MIN_CHAIN) { shown = 0; return 0; }
    const due = markReached(n);
    if (due <= shown) return 0;
    const { found, mark } = await scanLiveChain(fetchReport, factionId, { dir });
    shown = Math.min(due, mark);
    if (shown < due) {
      console.log(`[genocide] live chain at ${n}: the report does not show the ${due}th bonus yet, read again next check`);
    }
    return found;
  };
}

let _liveTimer = null;

/**
 * The running chain's bonus hits, on the owner's key: the live chain count
 * checked every 30 minutes, and the chain's report read only when the count
 * passes a new bonus mark. chainCount(factionId) is the count the chain
 * monitor stores; server.js passes it in, so this module never loads the
 * war store.
 */
export function startGenocideSchedule({ chainCount } = {}) {
  const key = process.env.OWNER_API_KEY;
  if (!key) {
    console.log("[genocide] no OWNER_API_KEY — not scanning");
    return;
  }
  if (typeof chainCount !== "function") {
    console.log("[genocide] no chain count — not watching the live chain");
    return;
  }
  if (_liveTimer) return;
  const factionId = String(process.env.OWNER_FACTION_ID || "42055");
  const check = liveChainWatch((id) => fetchChainReport(key, id), factionId);
  const run = async () => {
    try {
      const found = await check(chainCount(factionId));
      if (found) console.log(`[genocide] live chain: ${found} new holder${found === 1 ? "" : "s"}`);
    } catch (e) {
      console.warn(`[genocide] live chain: ${e.message}`);
    }
  };
  _liveTimer = setTimeout(() => {
    run();
    _liveTimer = setInterval(run, LIVE_SCAN_MS);
  }, LIVE_BOOT_DELAY_MS);
  console.log("[genocide] live chain checked every 30 min, its report read at each bonus mark of 2,500+");
}
