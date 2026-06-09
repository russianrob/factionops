export function median(nums) {
  if (!nums.length) return 0;
  const a = nums.slice().sort((x, y) => x - y);
  const m = Math.floor(a.length / 2);
  return (a.length % 2) ? a[m] : (a[m - 1] + a[m]) / 2;
}

export function coeffVar(nums) {
  if (nums.length < 2) return 0;
  const mean = nums.reduce((s, x) => s + x, 0) / nums.length;
  if (mean === 0) return 0;
  const variance = nums.reduce((s, x) => s + (x - mean) * (x - mean), 0) / nums.length;
  return Math.sqrt(variance) / mean;
}

export function reliabilityTier(n, cv) {
  if (n >= 8 && cv < 0.3) return "high";
  if (n >= 4 && cv < 0.6) return "med";
  return "low";
}

export function gaps(restocks) {
  const g = [];
  for (let i = 1; i < restocks.length; i++) g.push(restocks[i] - restocks[i - 1]);
  return g;
}

const MIN_GAP = 180;          // ignore gaps < 3 min (glitch dips / same-second) — real restocks are minutes-to-hours apart
const ABSENT_MAX = 180;       // if an item went unseen > 3 min (3+ missed polls), the next increase is unreliable
const STALE_DROP = 6 * 3600;  // drop model entries whose last restock is > 6h old

export function recordSample(item, curQty, nowSec) {
  const prev = item || { qty: null, restocks: [], lastSeen: null };
  if (typeof curQty !== "number" || !isFinite(curQty)) {
    return { qty: prev.qty, restocks: (prev.restocks || []).slice(), lastSeen: prev.lastSeen };
  }
  let restocks = (prev.restocks || []).slice();
  const fresh = (prev.lastSeen == null) || (nowSec - prev.lastSeen) <= ABSENT_MAX;
  if (prev.qty != null && curQty > prev.qty && fresh) {
    restocks.push(nowSec);
    if (restocks.length > 24) restocks = restocks.slice(restocks.length - 24);
  }
  return { qty: curQty, restocks: restocks, lastSeen: nowSec };
}

export function computeEntry(restocks) {
  if (!restocks || restocks.length < 2) return null;
  const g = gaps(restocks).filter((x) => x >= MIN_GAP);
  if (g.length < 1) return null;
  return {
    interval: Math.round(median(g)),
    last: restocks[restocks.length - 1],
    n: g.length,
    rel: reliabilityTier(g.length, coeffVar(g))
  };
}

export function buildModel(state, nowSec) {
  const items = {};
  for (const c in state) {
    for (const id in state[c]) {
      const e = computeEntry(state[c][id].restocks || []);
      if (e && (nowSec - e.last) <= STALE_DROP) { if (!items[c]) items[c] = {}; items[c][id] = e; }
    }
  }
  return { updated: nowSec, items: items };
}

import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const STATE_FILE = join(__dirname, "data", "restock-state.json");
const TOKEN_FILE = join(__dirname, "data", ".ghtoken");
const PROMBOT_URL = "https://api.prombot.co.uk/api/travel";
const REPO = "russianrob/torn-foreign-restock";
const MODEL_PATH = "restock-model.json";
const GH_API = `https://api.github.com/repos/${REPO}/contents/${MODEL_PATH}`;

let _state = {};

function loadState() {
  try { if (existsSync(STATE_FILE)) _state = JSON.parse(readFileSync(STATE_FILE, "utf-8")) || {}; }
  catch (e) { _state = {}; }
}
function saveState() {
  try {
    mkdirSync(dirname(STATE_FILE), { recursive: true });
    const tmp = STATE_FILE + ".tmp";
    writeFileSync(tmp, JSON.stringify(_state));
    renameSync(tmp, STATE_FILE);
  } catch (e) { console.error("[restock] saveState failed:", e.message); }
}

let _polling = false;
let _publishing = false;
async function pollOnce() {
  if (_polling) return;
  _polling = true;
  try {
    const r = await fetch(PROMBOT_URL);
    if (!r.ok) { console.error("[restock] poll http", r.status); return; }
    const json = await r.json();
    const stocks = (json && json.stocks) || {};
    const now = Math.floor(Date.now() / 1000);
    for (const c in stocks) {
      if (!_state[c]) _state[c] = {};
      for (const it of (stocks[c].stocks || [])) {
        const id = String(it.id);
        _state[c][id] = recordSample(_state[c][id], it.quantity, now);
      }
    }
    saveState();
  } catch (e) { console.error("[restock] poll failed:", e.message); }
  finally { _polling = false; }
}

function ghToken() {
  try { return readFileSync(TOKEN_FILE, "utf-8").trim(); }
  catch (e) { return ""; }
}
function ghHeaders(token) {
  return {
    "Authorization": "Bearer " + token,
    "Accept": "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "warboard-restock-tracker"
  };
}
async function ghCurrentSha(token) {
  try {
    const r = await fetch(GH_API, { headers: ghHeaders(token) });
    if (!r.ok) return "";
    const j = await r.json();
    return (j && j.sha) || "";
  } catch (e) { return ""; }
}
function modelItemCount(model) {
  let n = 0;
  for (const c in (model.items || {})) n += Object.keys(model.items[c]).length;
  return n;
}
async function publishModel() {
  if (_publishing) return;
  _publishing = true;
  try {
    const token = ghToken();
    if (!token) { console.error("[restock] publish skipped: no token file"); return; }
    const now = Math.floor(Date.now() / 1000);
    const model = buildModel(_state, now);
    const body = {
      message: `update restock model (${new Date(now * 1000).toISOString().slice(0, 16)}Z)`,
      content: Buffer.from(JSON.stringify(model)).toString("base64")
    };
    const sha = await ghCurrentSha(token);
    if (sha) body.sha = sha;
    const r = await fetch(GH_API, { method: "PUT", headers: ghHeaders(token), body: JSON.stringify(body) });
    if (!r.ok) {
      const t = await r.text().catch(() => "");
      console.error("[restock] publish failed:", r.status, t.slice(0, 200));
    } else {
      console.log("[restock] published model:", modelItemCount(model), "items");
    }
  } catch (e) { console.error("[restock] publish error:", e.message); }
  finally { _publishing = false; }
}

export function startRestockTracker() {
  loadState();
  pollOnce().catch(() => {});
  setInterval(() => { pollOnce().catch(() => {}); }, 60_000);
  setTimeout(() => { publishModel().catch(() => {}); }, 10_000);
  setInterval(() => { publishModel().catch(() => {}); }, 600_000);
  console.log("[restock] tracker started (poll 60s, publish 10m)");
}
