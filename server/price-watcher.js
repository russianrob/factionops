// Price-spike watcher.
//
// Alerts (push to a specific player's devices) when a tracked item's market
// price crosses ABOVE a configured threshold. Evaluated on every item-value
// refresh (the 5-min cache refresh calls checkWatchers via a hook).
//
// Edge-detected so it fires ONCE on the below->above crossing, stays silent
// while above, and re-arms when the price drops back below. A per-watcher
// cooldown guards against a price wobbling on the line.
//
// Config + state live together in data/price-watchers.json (small, personal):
//   { watchers: { <key>: { itemName, threshold, recipientPlayerId, cooldownMs,
//                          enabled, lastState, lastAlertAt } } }

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname as pathDirname, join as pathJoin } from "node:path";
import { getItemPriceByName } from "./item-values.js";
import { sendToPlayer } from "./push-notifications.js";

const FILE = pathJoin(process.env.DATA_DIR || "./data", "price-watchers.json");

const DEFAULT_STATE = {
  watchers: {
    passport: {
      itemName: "passport",
      threshold: 900000,
      recipientPlayerId: "137558",
      cooldownMs: 30 * 60 * 1000,
      enabled: true,
      lastState: "below",
      lastAlertAt: 0,
    },
  },
};

let _state = null;
let _saveTimer = null;

export function load() {
  try {
    if (existsSync(FILE)) _state = JSON.parse(readFileSync(FILE, "utf8"));
  } catch (e) {
    console.warn("[price-watcher] load failed:", e.message);
  }
  if (!_state || typeof _state !== "object" || !_state.watchers) {
    _state = JSON.parse(JSON.stringify(DEFAULT_STATE));
    _save();
  }
  console.log(`[price-watcher] loaded ${Object.keys(_state.watchers).length} watcher(s)`);
}

function _save() {
  try {
    const dir = pathDirname(FILE);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(FILE, JSON.stringify(_state, null, 2), "utf8");
  } catch (e) {
    console.warn("[price-watcher] save failed:", e.message);
  }
}
function _scheduleSave() {
  if (_saveTimer) return;
  _saveTimer = setTimeout(() => { _saveTimer = null; _save(); }, 1000);
}

function _fire(w, price) {
  // Fire-and-forget; never let a push failure break the refresh hook.
  Promise.resolve(
    sendToPlayer(String(w.recipientPlayerId), {
      title: "📈 Passport price alert",
      body: `Passport hit $${Number(price).toLocaleString()} — above your $${Number(w.threshold).toLocaleString()} alert.`,
      tag: `price-${w.itemName}`,
      icon: "/icon-192.png",
      data: { type: "price-alert", item: w.itemName, price, threshold: w.threshold },
    })
  ).catch((e) => console.warn("[price-watcher] send failed:", e.message));
  console.log(`[price-watcher] ALERT ${w.itemName} $${price} >= $${w.threshold} -> player ${w.recipientPlayerId}`);
}

/** Evaluate all watchers against the current cached prices. Safe to call on
 *  every refresh — cheap, idempotent, edge-detected. */
export function checkWatchers() {
  if (!_state || !_state.watchers) return;
  const now = Date.now();
  let changed = false;
  for (const w of Object.values(_state.watchers)) {
    if (!w || w.enabled === false) continue;
    const price = getItemPriceByName(w.itemName);
    if (!(price > 0)) continue; // failed/missing read — skip (no false alarm)
    const isAbove = price >= Number(w.threshold);
    const wasAbove = w.lastState === "above";
    if (isAbove && !wasAbove && now - (w.lastAlertAt || 0) >= (w.cooldownMs || 0)) {
      _fire(w, price);
      w.lastAlertAt = now;
      changed = true;
    }
    const newState = isAbove ? "above" : "below";
    if (w.lastState !== newState) { w.lastState = newState; changed = true; }
  }
  if (changed) _scheduleSave();
}
