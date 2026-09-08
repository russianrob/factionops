// Per-member chain hits, from Torn's own chain reports.
//
// A chain hit is any attack a member landed inside a faction chain — the war
// targets and everyone else alike. That is not derivable from the war records:
// they only cover the 13 war windows, and the chains a faction runs between
// wars are invisible there. It also is not derivable from the attacks feed
// without pulling every attack in 90 days.
//
// `/v2/faction/{id}/chains` lists the chains in a window (Torn records chains
// of 10+), and `/v2/faction/{chainId}/chainreport` gives one row per attacker:
//   { id, respect: {...}, attacks: { total, war, assists, retaliations, ... } }
// `attacks.total` is the number this module keeps.
//
// A finished chain never changes, so each report is fetched once and cached
// forever, and only chains with no cached report are ever requested — so the
// window can be a year without costing a year of calls every six hours.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as store from "./store.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIR = path.join(__dirname, "data", "chain-hits");
const RETAIN_DAYS = 400;
// A year of chains, because the owner asked for a year of faction data and the
// store already keeps 400 days. Only chains without a cached report are ever
// fetched, so widening this costs one backfill and nothing afterwards.
const WINDOW_DAYS = 365;
const REFRESH_MS = 6 * 60 * 60 * 1000;
// Torn allows 100 calls a minute across everything this server does, so the
// backfill walks rather than sprints.
const GAP_MS = 350;
const FACTION = "42055";

function fileFor(factionId) {
  return path.join(DIR, `${factionId}.json`);
}

function load(factionId) {
  try {
    const raw = JSON.parse(fs.readFileSync(fileFor(factionId), "utf8"));
    return raw && raw.chains ? raw : { factionId: String(factionId), chains: {} };
  } catch (_) {
    return { factionId: String(factionId), chains: {} };
  }
}

function save(factionId, data) {
  if (!fs.existsSync(DIR)) fs.mkdirSync(DIR, { recursive: true });
  const cutSec = Math.floor((Date.now() - RETAIN_DAYS * 86400000) / 1000);
  const chains = {};
  for (const [id, c] of Object.entries(data.chains)) {
    if (Number(c.start) >= cutSec) chains[id] = c;
  }
  fs.writeFileSync(fileFor(factionId), JSON.stringify({ ...data, chains, updatedAt: Date.now() }));
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function torn(url) {
  const res = await fetch(url + "&comment=wb-api");
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  if (data.error) {
    const err = new Error(`Torn API error: ${data.error.error} (code ${data.error.code})`);
    err.code = data.error.code;
    throw err;
  }
  return data;
}

/**
 * Chains that started inside the window, newest first. The `next` link stops
 * after one page, so this pages by moving the `to` cursor to just before the
 * oldest chain it has seen — the same shape the enemy-chain-activity fetch uses.
 */
export async function fetchChains(factionId, apiKey, fromSec, toSec) {
  const out = [];
  let to = toSec;
  for (let page = 0; page < 10; page++) {
    const d = await torn(`https://api.torn.com/v2/faction/${encodeURIComponent(factionId)}/chains`
      + `?from=${fromSec}&to=${to}&sort=DESC&limit=100&key=${encodeURIComponent(apiKey)}`);
    const chains = d.chains || [];
    if (!chains.length) break;
    out.push(...chains);
    const oldest = Math.min(...chains.map((c) => Number(c.start) || 0));
    if (chains.length < 100 || oldest <= fromSec) break;
    to = oldest - 1;
    await sleep(GAP_MS);
  }
  return out;
}

/** One chain's per-attacker totals: { start, end, chain, byPlayer: { id: hits } }. */
export async function fetchChainReport(chainId, apiKey) {
  const d = await torn(`https://api.torn.com/v2/faction/${encodeURIComponent(chainId)}/chainreport`
    + `?key=${encodeURIComponent(apiKey)}`);
  const rep = d.chainreport || {};
  const byPlayer = {};
  for (const a of rep.attackers || []) {
    const hits = Number(a?.attacks?.total) || 0;
    if (hits > 0) byPlayer[String(a.id)] = hits;
  }
  return {
    start: Number(rep.start) || 0,
    end: Number(rep.end) || 0,
    chain: Number(rep.details?.chain) || 0,
    war: Number(rep.details?.war) || 0,
    byPlayer,
  };
}

/**
 * Fetch every chain in the window whose report is not already cached. Returns
 * what it did rather than throwing, so a partial sweep still leaves the cache
 * better than it found it.
 */
export async function refresh(factionId = FACTION, { windowDays = WINDOW_DAYS, limit = 200 } = {}) {
  const apiKey = store.getFactionApiKey(factionId);
  if (!apiKey) return { ok: false, reason: "no-faction-key" };

  const nowSec = Math.floor(Date.now() / 1000);
  const fromSec = nowSec - windowDays * 86400;
  const data = load(factionId);

  let chains;
  try {
    chains = await fetchChains(factionId, apiKey, fromSec, nowSec);
  } catch (err) {
    console.error(`[chain-hits] chain list failed: ${err.message}`);
    return { ok: false, reason: err.message };
  }

  const missing = chains.filter((c) => !data.chains[String(c.id)]).slice(0, limit);
  let fetched = 0;
  for (const c of missing) {
    try {
      await sleep(GAP_MS);
      const rep = await fetchChainReport(c.id, apiKey);
      data.chains[String(c.id)] = {
        start: rep.start || Number(c.start) || 0,
        end: rep.end || Number(c.end) || 0,
        chain: rep.chain || Number(c.chain) || 0,
        war: rep.war || 0,
        byPlayer: rep.byPlayer,
      };
      fetched++;
      // Save as we go. A year's backfill is three hundred requests at a third
      // of a second each — nearly two minutes during which a restart used to
      // throw away every one of them, because the write was at the end.
      if (fetched % 25 === 0) save(factionId, data);
    } catch (err) {
      // One unreadable chain should not abandon the other 78.
      console.error(`[chain-hits] report ${c.id} failed: ${err.message}`);
    }
  }
  if (fetched) save(factionId, data);
  return { ok: true, chainsSeen: chains.length, fetched, cached: Object.keys(data.chains).length };
}

/** Everything cached, as an array — the pure aggregator's input. */
export function readChains(factionId = FACTION) {
  return Object.values(load(factionId).chains);
}

/**
 * Pure: total hits and chains joined per player, over the chains that STARTED
 * inside the window. Kept separate from the fetching so the arithmetic can be
 * tested without a network.
 */
export function sumHits(chains, fromMs, toMs) {
  const out = {};
  for (const c of chains || []) {
    const startMs = (Number(c.start) || 0) * 1000;
    if (startMs < fromMs || startMs > toMs) continue;
    for (const [id, hits] of Object.entries(c.byPlayer || {})) {
      const n = Number(hits) || 0;
      if (n <= 0) continue;
      const row = out[id] || (out[id] = { hits: 0, chains: 0 });
      row.hits += n;
      row.chains += 1;
    }
  }
  return out;
}

/** Convenience for callers: read the cache and aggregate over a window. */
export function hitsInWindow(factionId, nowMs, windowDays) {
  return sumHits(readChains(factionId), nowMs - windowDays * 86400000, nowMs);
}

export function start() {
  refresh().catch(() => {});
  setInterval(() => { refresh().catch(() => {}); }, REFRESH_MS);
}
