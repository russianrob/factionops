// Daily server-side regeneration of rwp-prices.json (the pre-built price file
// the Torn RW Pricer userscript uses on PDA, where it can't gunzip the CDN
// CSVs). To guarantee PDA prices match the desktop path exactly, this extracts
// the userscript's OWN item maps + percentile + parse functions and runs them
// on the same marches.cafe auction CSVs — single source of truth, no drift as
// items are added.

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCRIPT_FILE = join(__dirname, "public", "scripts", "torn-rw-pricer.user.js");
const OUT_FILE    = join(__dirname, "data", "rwp-prices.json");
const WEAPON_CDN  = "https://cdn.marches.cafe/items/weapon-auctions4.csv.gz";
const ARMOUR_CDN  = "https://cdn.marches.cafe/items/armour-auctions4.csv.gz";
const REFRESH_MS  = 24 * 60 * 60 * 1000;

let _running = false;

function extractFunction(src, name) {
  const start = src.indexOf("function " + name + "(");
  if (start < 0) throw new Error("rwp: function not found: " + name);
  const open = src.indexOf("{", start);
  let depth = 0;
  for (let j = open; j < src.length; j++) {
    const ch = src[j];
    if (ch === "{") depth++;
    else if (ch === "}") { depth--; if (depth === 0) return src.slice(start, j + 1); }
  }
  throw new Error("rwp: unbalanced braces in " + name);
}

function extractCompute(src) {
  const parts = [];
  for (const name of ["COMBO_MIN_SAMPLES","WEAPON_CLASS","BONUS_ID_MAP","ITEM_ID_MAP","ARMOUR_SET","ARMOUR_ID_MAP","ARMOUR_BONUS_MAP","RARITY_MAP"]) {
    const m = src.match(new RegExp("^[ \\t]*var[ \\t]+" + name + "[ \\t]*=.*$", "m"));
    if (!m) throw new Error("rwp: var not found: " + name);
    parts.push(m[0].trim());
  }
  for (const fn of ["percentile","parseCSVAndComputePrices","parseArmourCSVAndComputePrices"]) {
    parts.push(extractFunction(src, fn));
  }
  return parts.join("\n");
}

function buildComputeFns() {
  const code = extractCompute(readFileSync(SCRIPT_FILE, "utf8"));
  const sandbox = {};
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox, { timeout: 5000, filename: "rwp-compute.js" });
  const w = sandbox.parseCSVAndComputePrices, a = sandbox.parseArmourCSVAndComputePrices;
  if (typeof w !== "function" || typeof a !== "function") throw new Error("rwp: compute fns not exposed");
  return { w, a };
}

async function fetchBuf(url) {
  const r = await fetch(url, { headers: { "User-Agent": "warboard-rwp-refresh" } });
  if (!r.ok) throw new Error("HTTP " + r.status + " for " + url);
  return Buffer.from(await r.arrayBuffer());
}

export async function refreshRwpPrices(reason) {
  if (_running) return null;
  _running = true;
  try {
    const { w, a } = buildComputeFns();
    const [wGz, aGz] = await Promise.all([fetchBuf(WEAPON_CDN), fetchBuf(ARMOUR_CDN)]);
    const wData = w(gunzipSync(wGz).toString("utf8"));
    const aData = a(gunzipSync(aGz).toString("utf8"));
    const out = {
      weaponPrices:      wData.weaponPrices,
      bonusPrices:       wData.bonusPrices,
      classPrices:       wData.classPrices,
      armourPrices:      aData.armourPrices,
      armourBonusPrices: aData.armourBonusPrices,
      armourSetPrices:   aData.armourSetPrices,
      weaponComboPrices: wData.comboPrices,
      weaponPairComboPrices: wData.pairComboPrices,
      weaponLevelPrices: wData.levelPrices,
      armourComboPrices: aData.comboPrices,
      weaponMaxBonus:    wData.weaponMaxBonus,
      timestamp: Date.now(),
    };
    if (!out.weaponPrices || Object.keys(out.weaponPrices).length === 0) throw new Error("empty weaponPrices — refusing to overwrite");
    writeFileSync(OUT_FILE, JSON.stringify(out));
    console.log(`[rwp-refresh] wrote rwp-prices.json — ${Object.keys(out.weaponPrices).length} weapons, ${Object.keys(out.armourPrices).length} armour, ${Object.keys(out.weaponComboPrices).length} weapon-combos [${reason || "manual"}]`);
    return out;
  } catch (e) {
    console.warn("[rwp-refresh] failed:", e.message);
    return null;
  } finally {
    _running = false;
  }
}

function fileAgeMs() {
  try {
    const o = JSON.parse(readFileSync(OUT_FILE, "utf8"));
    if (o && o.timestamp) return Date.now() - o.timestamp;
  } catch (_) {}
  return Infinity;
}

export function startRwpRefresh() {
  const age = fileAgeMs();
  if (age > REFRESH_MS) {
    console.log(`[rwp-refresh] rwp-prices.json is ${age === Infinity ? "missing" : Math.round(age / 3600000) + "h old"} — refreshing on boot`);
    setTimeout(() => refreshRwpPrices("boot-stale"), 8000);
  }
  setInterval(() => refreshRwpPrices("daily"), REFRESH_MS);
}
