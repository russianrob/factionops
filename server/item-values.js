// Torn item market-value cache.
//
// Feeds the OC outcome-analysis path with an approximate cash equivalent
// for item-based OC payouts so "Top end $" isn't empty on scenarios like
// Best of the Lot / Pet Project that pay in items instead of cash.
//
// v4.9.98: refreshed on demand using the caller's API key rather than
// OWNER_API_KEY. Item prices are faction-agnostic (public market) so
// one shared cache across all factions is fine — whichever faction
// calls first while the cache is stale pays the ~1 Torn API call.
// Refresh cadence: no more than once per 6h regardless of how many
// callers request it.

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname as pathDirname, join as pathJoin } from "node:path";

const CACHE_FILE = pathJoin(process.env.DATA_DIR || './data', 'item-market-values.json');
const REFRESH_MS = 6 * 60 * 60 * 1000;

let _values = {};          // { [itemId]: marketValue }
let _byName = {};          // { [name.toLowerCase()]: marketValue }
let _fetchedAt = 0;
let _refreshInFlight = null;
let _lastNameBackfill = 0;

function _load() {
  try {
    if (!existsSync(CACHE_FILE)) return;
    const raw = readFileSync(CACHE_FILE, 'utf8');
    const obj = JSON.parse(raw);
    if (obj?.values && typeof obj.values === 'object') {
      _values = obj.values;
      _byName = (obj.byName && typeof obj.byName === 'object') ? obj.byName : {};
      _fetchedAt = Number(obj.fetchedAt) || 0;
      console.log(`[item-values] loaded ${Object.keys(_values).length} item prices from disk (fetchedAt ${new Date(_fetchedAt).toISOString()})`);
    }
  } catch (e) {
    console.warn('[item-values] load failed:', e.message);
  }
}
_load();

function _save() {
  try {
    const dir = pathDirname(CACHE_FILE);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(CACHE_FILE, JSON.stringify({ values: _values, byName: _byName, fetchedAt: _fetchedAt }, null, 0), 'utf8');
  } catch (e) {
    console.warn('[item-values] save failed:', e.message);
  }
}

async function _refreshWithKey(key) {
  if (!key || String(key).length < 10) return;
  if (_refreshInFlight) return _refreshInFlight;
  _refreshInFlight = (async () => {
    try {
      const url = `https://api.torn.com/v2/torn?selections=items&key=${encodeURIComponent(key)}&comment=wb-items`;
      const res = await fetch(url);
      if (!res.ok) {
        console.warn(`[item-values] HTTP ${res.status} on refresh`);
        return;
      }
      const data = await res.json();
      if (data?.error) {
        console.warn('[item-values] API error:', data.error.error || data.error);
        return;
      }
      const items = Array.isArray(data.items) ? data.items : Object.values(data.items || {});
      const out = {};
      const outByName = {};
      for (const it of items) {
        const mp = Number(
          it?.value?.market_price ?? it?.market_value ?? it?.marketValue ?? 0
        );
        if (!(Number.isFinite(mp) && mp > 0)) continue;
        const id = it?.id ?? it?.ID;
        if (id != null) out[String(id)] = mp;
        const nm = it?.name;
        if (nm) outByName[String(nm).toLowerCase()] = mp;
      }
      if (Object.keys(out).length > 0) {
        _values = out;
        _byName = outByName;
        _fetchedAt = Date.now();
        _save();
        console.log(`[item-values] refreshed ${Object.keys(_values).length} item prices (${Object.keys(_byName).length} by name) via key ****${String(key).slice(-4)}`);
      }
    } catch (e) {
      console.warn('[item-values] refresh failed:', e.message);
    } finally {
      _refreshInFlight = null;
    }
  })();
  return _refreshInFlight;
}

/**
 * Synchronous lookup — returns the cached market value for an item (0 if
 * unknown). Does NOT trigger a refresh; the caller should invoke
 * maybeRefreshItemValues(key) separately when they have an API key handy
 * and the cache is stale.
 */
export function getItemMarketValue(id) {
  if (id == null) return 0;
  return Number(_values[String(id)]) || 0;
}

/** Lookup market value by item NAME (case-insensitive). 0 if unknown. */
export function getItemPriceByName(name) {
  if (!name) return 0;
  return Number(_byName[String(name).toLowerCase()]) || 0;
}

/**
 * Opportunistic refresh. If the cache is older than 6h, triggers a
 * background refresh using the caller's Torn API key. Safe to call on
 * every OC-spawn request — the in-flight guard and timestamp check
 * ensure at most one refresh fires per 6h regardless of volume.
 */
export function maybeRefreshItemValues(apiKey) {
  const fresh = (Date.now() - _fetchedAt) < REFRESH_MS;
  const namesEmpty = Object.keys(_byName).length === 0;
  if (fresh && !namesEmpty) return;
  // One-time (guarded) backfill when the on-disk cache predates the name
  // map: refresh even if the id-price cache is still fresh, but no more than
  // once per 5 min so a key-less / erroring server can't spin on it.
  if (namesEmpty && (Date.now() - _lastNameBackfill) < 5 * 60 * 1000) return;
  if (namesEmpty) _lastNameBackfill = Date.now();
  _refreshWithKey(apiKey);
}

export function getItemValueFetchedAt() { return _fetchedAt; }
