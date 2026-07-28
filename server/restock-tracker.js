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

const WINDOW_SEC = 1800;
const SAMPLE_CAP = 40;
const MIN_SAMPLES_IN_WINDOW = 6;
const MIN_OBSERVED_SEC = 600;
const MIN_UNITS_OBSERVED = 3;
const SAFETY_BASE = 1.15;
// World Tiger Day (annual Torn event, Jul 28-29 TCT): foreign-stock demand
// spikes for two days — run sell-out predictions extra-conservative.
export function safetyFactor(nowSec) {
  const d = new Date(nowSec * 1000);
  return (d.getUTCMonth() === 6 && (d.getUTCDate() === 28 || d.getUTCDate() === 29)) ? 1.4 : SAFETY_BASE;
}

export function percentile(nums, p) {
  if (!nums || !nums.length) return 0;
  const a = nums.slice().sort((x, y) => x - y);
  const idx = Math.round(p * (a.length - 1));
  return a[Math.max(0, Math.min(a.length - 1, idx))];
}

export function recordSample(item, curQty, nowSec) {
  const prev = item || { qty: null, restocks: [], lastSeen: null, samples: [], maxQty: 0 };
  if (typeof curQty !== "number" || !isFinite(curQty)) {
    return { qty: prev.qty, restocks: (prev.restocks || []).slice(), lastSeen: prev.lastSeen, samples: (prev.samples || []).slice(), maxQty: prev.maxQty || 0 };
  }
  const maxQty = Math.max(prev.maxQty || 0, curQty);
  let restocks = (prev.restocks || []).slice();
  const fresh = (prev.lastSeen == null) || (nowSec - prev.lastSeen) <= ABSENT_MAX;
  // A rise only counts as a RESTOCK if it's a meaningful chunk of the item's
  // known stock size — tiny +1/+13 blips are player sell-backs on camped
  // items (rampant on event days) and were corrupting the gap data.
  const minJump = Math.max(3, Math.round(maxQty * 0.05));
  if (prev.qty != null && curQty - prev.qty >= minJump && fresh) {
    restocks.push(nowSec);
    if (restocks.length > 24) restocks = restocks.slice(restocks.length - 24);
  }
  let samples = (prev.samples || []).slice();
  samples.push([nowSec, curQty]);
  const minAge = nowSec - WINDOW_SEC - 120;
  samples = samples.filter((s) => s[0] >= minAge);
  if (samples.length > SAMPLE_CAP) samples = samples.slice(samples.length - SAMPLE_CAP);
  return { qty: curQty, restocks: restocks, lastSeen: nowSec, samples: samples, maxQty: maxQty };
}

export function computeSellRate(samples, nowSec) {
  if (!samples || samples.length < 2) return null;
  const lo = nowSec - WINDOW_SEC;
  const drops = [];
  const secs = [];
  let sumDropsRaw = 0;
  let largestRawDrop = 0;
  for (let i = 1; i < samples.length; i++) {
    const prev = samples[i - 1];
    const cur = samples[i];
    if (prev[0] < lo || cur[0] < lo || cur[0] > nowSec) continue;
    const dt = cur[0] - prev[0];
    if (dt > ABSENT_MAX) continue;
    if (cur[1] > prev[1]) continue;
    const drop = prev[1] - cur[1];
    drops.push(drop);
    secs.push(dt);
    sumDropsRaw += drop;
    if (drop > largestRawDrop) largestRawDrop = drop;
  }
  const usableIntervals = drops.length;
  if (usableIntervals < 1) return null;
  const observedSec = secs.reduce((s, x) => s + x, 0);
  if (observedSec <= 0) return null;
  const cap = Math.max(percentile(drops, 0.9), 5);
  let sumDrops = 0;
  for (const d of drops) sumDrops += Math.min(d, cap);
  let sellRate = sumDrops / (observedSec / 60);
  if (!isFinite(sellRate) || sellRate < 0) sellRate = 0;
  const maxDropShare = sumDropsRaw > 0 ? largestRawDrop / sumDropsRaw : 0;
  return { sellRate, sumDrops, sumDropsRaw, usableIntervals, observedSec, maxDropShare };
}

export function depletionReliability(usableIntervals, maxDropShare, coverage) {
  if (usableIntervals >= 12 && maxDropShare < 0.4 && coverage > 0.7) return "high";
  if (usableIntervals >= 6 && maxDropShare < 0.6) return "med";
  return "low";
}

export function computeEntry(restocks, samples, nowSec) {
  let entry = null;
  if (restocks && restocks.length >= 2) {
    let g = gaps(restocks).filter((x) => x >= MIN_GAP);
    if (g.length >= 1) {
      // De-fuse: a gap ~k× the median almost certainly hides k-1 restocks
      // that sold out between polls — divide it back to the underlying
      // interval so the tail of the distribution isn't observation noise.
      const m0 = median(g);
      if (m0 > 0) {
        g = g.map((x) => {
          const k = Math.round(x / m0);
          return (x > 1.75 * m0 && k >= 2) ? x / k : x;
        });
      }
      const qs = g.length >= 6
        ? Array.from({ length: 11 }, (_, i) => Math.round(percentile(g, i / 10)))
        : null;
      entry = {
        interval: Math.round(median(g)),
        // honest uncertainty: gaps swing wildly on event days — the script
        // shows a p25–p75 window instead of a point when rel isn't high
        intLo: Math.round(percentile(g, 0.25)),
        intHi: Math.round(percentile(g, 0.75)),
        last: restocks[restocks.length - 1],
        n: g.length,
        rel: reliabilityTier(g.length, coeffVar(g))
      };
      if (qs) entry.qs = qs; // hazard curve: script computes P(restock by t)
    }
  }

  const sr = computeSellRate(samples, nowSec);
  const sellReady = !!(sr && sr.usableIntervals >= MIN_SAMPLES_IN_WINDOW &&
    sr.observedSec >= MIN_OBSERVED_SEC && sr.sumDrops >= MIN_UNITS_OBSERVED);

  if (!entry && !sellReady) return null;
  if (!entry) entry = {};
  entry.sellReady = sellReady;
  if (sellReady) {
    const modelQty = samples[samples.length - 1][1];
    entry.sellRate = sr.sellRate;
    entry.srel = depletionReliability(sr.usableIntervals, sr.maxDropShare, sr.observedSec / WINDOW_SEC);
    entry.secToSellout = Math.round(modelQty / (sr.sellRate * safetyFactor(nowSec)));
    entry.modelQty = modelQty;
    entry.n2 = sr.usableIntervals;
    entry.obsSec = sr.observedSec;
    entry.maxDropShare = sr.maxDropShare;
    entry.sumDrops = sr.sumDrops;
  }
  return entry;
}

export function buildModel(state, nowSec) {
  const items = {};
  for (const c in state) {
    for (const id in state[c]) {
      const rec = state[c][id];
      const e = computeEntry(rec.restocks || [], rec.samples || [], nowSec);
      if (!e) continue;
      const restockFresh = e.last != null && (nowSec - e.last) <= STALE_DROP;
      if (!restockFresh && e.last != null) {
        delete e.interval; delete e.intLo; delete e.intHi; delete e.qs; delete e.last; delete e.n; delete e.rel;
      }
      if (restockFresh || e.sellReady) {
        if (!items[c]) items[c] = {};
        items[c][id] = e;
      }
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
      content: Buffer.from(JSON.stringify(model)).toString("base64"),
      // Commit as a bot identity (email NOT on the russianrob account) so these
      // automated 10-min data pushes don't count toward the human contribution graph.
      author: { name: "warboard restock bot", email: "restock-bot@warboard.local" },
      committer: { name: "warboard restock bot", email: "restock-bot@warboard.local" }
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
