// /api/hof: the nightly digest plus live Hall of Fame rows around us.
//
// One live copy is shared by every viewer and refreshed at most every 15
// minutes, in the background: a request never waits for Torn. Normally a
// refresh is one call (the 100 positions around us). Design:
// docs/superpowers/specs/2026-10-19-hof-respect-climb-design.md.
import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { tornGet } from "./hof-torn.js";
import { dayMs, daysToPass } from "./hof-climb.js";
import { defaultDataDir } from "./hof-snapshots.js";

const FRESH_MS = 15 * 60 * 1000;
const round2 = (x) => (x == null ? null : Math.round(x * 100) / 100);

// No I/O and no timers here: everything happens on the first request.
export function createHofApi(opts = {}) {
  const dir = () => opts.dataDir || defaultDataDir();
  const nowFn = opts.nowFn || (() => Date.now());
  const fetchImpl = opts.fetchImpl || fetch;
  const key = () => (opts.key !== undefined ? opts.key : process.env.OWNER_API_KEY);
  const factionId = () => String(opts.factionId || process.env.OWNER_FACTION_ID || "42055");

  let digest = null, digestMtime = null;
  let live = null, inflight = null, lastAttemptAt = -Infinity;

  // Read again whenever the file changes, so the nightly rebuild shows up
  // without a restart. A digest that vanishes or won't parse keeps the last one.
  function loadDigest() {
    const file = join(dir(), "digest.json");
    let mtime;
    try { mtime = statSync(file).mtimeMs; } catch { return digest; }
    if (mtime !== digestMtime) {
      try {
        digest = JSON.parse(readFileSync(file, "utf8"));
        digestMtime = mtime;
      } catch (e) {
        console.error(`[hof] digest unreadable: ${e.message}`);
      }
    }
    return digest;
  }

  // Positions P − 50 to P + 49, in Hall of Fame order.
  async function windowAt(position) {
    const r = await tornGet("/torn/factionhof", { cat: "respect", limit: 100, offset: Math.max(0, position - 51) },
      { key: key(), fetchImpl, source: "hof-api" });
    if (!r.ok) return null;
    const list = JSON.parse(r.text).factionhof;
    if (!Array.isArray(list)) return null;
    return list.map((f) => ({ position: f.position, id: f.id, name: f.name, respect: f.values ? f.values.respect : null }))
      .sort((a, b) => a.position - b.position);
  }

  // One call normally. If our row is missing, ask Torn for our rank first;
  // if the window is short of 20 rows above or 5 below, fetch the window
  // around our new position. At most 3 calls.
  async function refresh(d) {
    const us = factionId();
    const find = (rows) => rows.findIndex((r) => String(r.id) === us);
    let rows = await windowAt((live && live.us.position) || (d.midnight && d.midnight.position) || 1);
    if (!rows) return false;
    let i = find(rows);
    if (i < 0) {
      const r = await tornGet(`/faction/${us}/hof`, {}, { key: key(), fetchImpl, source: "hof-api" });
      const rank = r.ok ? JSON.parse(r.text)?.hof?.respect?.rank : null;
      if (!rank) return false;
      rows = await windowAt(rank);
      if (!rows || (i = find(rows)) < 0) return false;
    } else if (i < Math.min(20, rows[i].position - 1) || rows.length - 1 - i < 5) {
      rows = await windowAt(rows[i].position);
      if (!rows || (i = find(rows)) < 0) return false;
    }
    live = { fetchedAt: nowFn(), us: rows[i], rows: rows.slice(Math.max(0, i - 20), i + 6) };
    return true;
  }

  // At most one attempt every 15 minutes, successful or not, shared by every
  // request that arrives meanwhile.
  function maybeRefresh(d) {
    const now = nowFn();
    if (live && now - live.fetchedAt < FRESH_MS) return;
    if (inflight || now - lastAttemptAt < FRESH_MS || !key()) return;
    lastAttemptAt = now;
    inflight = refresh(d)
      .then((ok) => { if (!ok) console.warn("[hof] live refresh failed; serving the last copy"); })
      .catch((e) => { console.error(`[hof] live refresh failed: ${e.message}`); })
      .finally(() => { inflight = null; });
  }

  function view(d) {
    const now = nowFn(), us = factionId();
    const windows = Object.keys(d.windows || {}).map(Number).sort((a, b) => a - b);
    const src = live
      ? { source: now - live.fetchedAt < FRESH_MS ? "live" : "stale", updatedAt: live.fetchedAt, rows: live.rows }
      : { source: "midnight", updatedAt: dayMs(d.day), rows: d.midnight ? d.midnight.rows : [] };
    const meIndex = src.rows.findIndex((r) => String(r.id) === us);
    const me = meIndex >= 0 ? src.rows[meIndex] : null;
    const paces = d.paces || {}, usPace = paces[us] || {};
    const pick = (p) => Object.fromEntries(windows.map((w) => [w, p && p[w] != null ? p[w] : null]));
    const rows = src.rows.map((r, i) => {
      const mine = i === meIndex, pace = paces[String(r.id)];
      const gap = me ? r.respect - me.respect : null;
      const days = Object.fromEntries(windows.map((w) => [w, mine || !me ? null
        : round2(daysToPass({ above: i < meIndex, gap, pace: pace && pace[w], usPace: usPace[w] }))]));
      return { position: r.position, id: r.id, name: r.name, respect: r.respect, gap, ...(mine ? { us: true } : {}),
        pace: pick(pace), days };
    });
    return {
      factionId: Number(us),
      source: src.source,
      refreshing: Boolean(inflight),
      updatedAt: src.updatedAt,
      day: d.day,
      windows,
      defaultWindow: windows.includes(30) ? 30 : (windows.length ? windows[windows.length - 1] : null),
      us: me ? { position: me.position, respect: me.respect, pace: pick(usPace) } : null,
      rows,
      history: (d.history || []).map((h) => ({ day: h.day, position: h.position })),
      projection: d.projection || {},
      notes: d.notes || {},
    };
  }

  // Never rejects: Express 4 ignores the promise a handler returns, so a
  // rejection here would be unhandled and would take the server down.
  async function handle(_req, res) {
    try {
      const d = loadDigest();
      if (!d) {
        res.set("Cache-Control", "no-store");
        return res.status(503).json({ error: "warming up" });
      }
      maybeRefresh(d);
      res.set("Cache-Control", "public, max-age=60");
      return res.json(view(d));
    } catch (e) {
      console.error(`[hof] /api/hof failed: ${e.message}`);
      try { res.set("Cache-Control", "no-store"); res.status(500).json({ error: "internal error" }); } catch {}
    }
  }

  // Resolves once no live refresh is running. The tests use it to wait for the
  // background refresh a request started.
  const settle = () => inflight || Promise.resolve();

  return { handle, settle };
}
