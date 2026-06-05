// Item-market lowest-listing cache.
//
// The bulk items catalog (/torn?selections=items -> market_price) reports $0 for
// items that aren't "catalog-priced" — notably OC reward artifacts like the
// Priceless Painting (catalog market_price=0, but actively listed at ~$80M).
// Their real value lives in the live item-market order book
// (/v2/market/{id}/itemmarket). This module fetches the LOWEST current listing
// for a tracked set of item ids and caches it, so OC reward valuation can price
// them instead of showing $0.
//
// Tracked set is built on demand (the OC valuation path calls trackItem for any
// reward item the catalog prices at 0) and seeded at boot from OC history.

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname as pathDirname, join as pathJoin } from "node:path";

const CACHE_FILE = pathJoin(process.env.DATA_DIR || "./data", "item-market-listings.json");
const PER_ITEM_TTL = 15 * 60 * 1000; // don't re-fetch a given item more than every 15 min
const INTER_FETCH_MS = 400;          // polite gap between per-item fetches

let _listings = {};   // { [id]: { name, price, at } }
let _tracked = new Set();
let _refreshInFlight = false;

function _load() {
  try {
    if (existsSync(CACHE_FILE)) {
      const obj = JSON.parse(readFileSync(CACHE_FILE, "utf8"));
      if (obj && obj.listings && typeof obj.listings === "object") {
        _listings = obj.listings;
        for (const id of Object.keys(_listings)) _tracked.add(String(id));
      }
    }
  } catch (e) { console.warn("[item-market] load failed:", e.message); }
  console.log(`[item-market] loaded ${Object.keys(_listings).length} listing price(s)`);
}
_load();

function _save() {
  try {
    const dir = pathDirname(CACHE_FILE);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(CACHE_FILE, JSON.stringify({ listings: _listings }, null, 0), "utf8");
  } catch (e) { console.warn("[item-market] save failed:", e.message); }
}

/** Lowest current market listing for an item id (0 if unknown/unfetched). */
export function getLowestListing(id) {
  const e = _listings[String(id)];
  return e ? Number(e.price) || 0 : 0;
}

/** Track an item id for periodic lowest-listing refresh. */
export function trackItem(id) {
  if (id != null && String(id).length) _tracked.add(String(id));
}

/** Seed tracking from OC reward history: track any reward item the catalog
 *  prices at $0 (those need a live item-market lookup). catalogPriceFn(id)->price. */
export function seedFromOcHistory(catalogPriceFn) {
  try {
    const file = pathJoin(process.env.DATA_DIR || "./data", "oc-history", "42055.json");
    if (!existsSync(file)) return;
    const hist = JSON.parse(readFileSync(file, "utf8"));
    let n = 0;
    for (const h of (Array.isArray(hist) ? hist : [])) {
      for (const it of (h?.rewards?.items || [])) {
        if (it?.id != null && (!catalogPriceFn || !catalogPriceFn(it.id))) { trackItem(it.id); n++; }
      }
    }
    if (n) console.log(`[item-market] seeded ${n} OC reward item ref(s) from history`);
  } catch (_) { /* no history yet — on-demand tracking will populate */ }
}

/** name(lowercased) -> lowest-listing price (for client name-matching). */
export function getListingsByName() {
  const out = {};
  for (const e of Object.values(_listings)) {
    if (e && e.name && e.price > 0) out[String(e.name).toLowerCase()] = e.price;
  }
  return out;
}
/** id -> lowest-listing price. */
export function getListingsById() {
  const out = {};
  for (const [id, e] of Object.entries(_listings)) if (e && e.price > 0) out[id] = e.price;
  return out;
}

async function _fetchOne(id, apiKey) {
  const url = `https://api.torn.com/v2/market/${id}/itemmarket?key=${encodeURIComponent(apiKey)}&comment=wb-itemmkt`;
  const res = await fetch(url);
  if (!res.ok) return;
  const data = await res.json();
  if (data.error) return;
  const im = data.itemmarket || {};
  const name = im.item?.name || _listings[String(id)]?.name || null;
  const listings = Array.isArray(im.listings) ? im.listings : [];
  let lowest = 0;
  for (const l of listings) {
    const p = Number(l?.price) || 0;
    if (p > 0 && (lowest === 0 || p < lowest)) lowest = p;
  }
  if (lowest > 0) _listings[String(id)] = { name, price: lowest, at: Date.now() };
}

/** Refresh lowest listings for tracked items whose cache is stale. One in-flight
 *  pass at a time; per-item TTL throttle; polite inter-fetch delay. */
export async function refreshTracked(apiKey) {
  if (!apiKey || _refreshInFlight) return;
  _refreshInFlight = true;
  try {
    const now = Date.now();
    let n = 0;
    for (const id of _tracked) {
      const e = _listings[String(id)];
      if (e && now - (e.at || 0) < PER_ITEM_TTL) continue;
      try { await _fetchOne(id, apiKey); n++; } catch (_) {}
      await new Promise((r) => setTimeout(r, INTER_FETCH_MS));
    }
    if (n > 0) { _save(); console.log(`[item-market] refreshed ${n} item listing(s) (${_tracked.size} tracked)`); }
  } finally { _refreshInFlight = false; }
}
