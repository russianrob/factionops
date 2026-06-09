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

export function recordSample(item, curQty, nowSec) {
  let restocks = (item && item.restocks) ? item.restocks.slice() : [];
  if (item && item.qty != null && curQty > item.qty) {
    restocks.push(nowSec);
    if (restocks.length > 24) restocks = restocks.slice(restocks.length - 24);
  }
  return { qty: curQty, restocks: restocks };
}

export function computeEntry(restocks) {
  if (!restocks || restocks.length < 2) return null;
  const g = gaps(restocks);
  return {
    interval: Math.round(median(g)),
    last: restocks[restocks.length - 1],
    n: restocks.length,
    rel: reliabilityTier(restocks.length, coeffVar(g))
  };
}

export function buildModel(state, nowSec) {
  const items = {};
  for (const c in state) {
    for (const id in state[c]) {
      const e = computeEntry(state[c][id].restocks || []);
      if (e) { if (!items[c]) items[c] = {}; items[c][id] = e; }
    }
  }
  return { updated: nowSec, items: items };
}

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const STATE_FILE = join(__dirname, "data", "restock-state.json");
const PROMBOT_URL = "https://api.prombot.co.uk/api/travel";
const REPO = "russianrob/torn-foreign-restock";
const MODEL_PATH = "restock-model.json";

let _state = {};

function loadState() {
  try { if (existsSync(STATE_FILE)) _state = JSON.parse(readFileSync(STATE_FILE, "utf-8")) || {}; }
  catch (e) { _state = {}; }
}
function saveState() {
  try { mkdirSync(dirname(STATE_FILE), { recursive: true }); writeFileSync(STATE_FILE, JSON.stringify(_state)); }
  catch (e) { console.error("[restock] saveState failed:", e.message); }
}

async function pollOnce() {
  let json;
  try { const r = await fetch(PROMBOT_URL); json = await r.json(); }
  catch (e) { console.error("[restock] poll failed:", e.message); return; }
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
}

function ghCurrentSha() {
  return new Promise((resolve) => {
    execFile("gh", ["api", `/repos/${REPO}/contents/${MODEL_PATH}`, "--jq", ".sha"],
      (e, out) => resolve(e ? "" : String(out).trim()));
  });
}
async function publishModel() {
  const now = Math.floor(Date.now() / 1000);
  const model = buildModel(_state, now);
  const content = Buffer.from(JSON.stringify(model)).toString("base64");
  const sha = await ghCurrentSha();
  const args = ["api", "--method", "PUT", `/repos/${REPO}/contents/${MODEL_PATH}`,
    "-f", `message=update restock model (${new Date(now * 1000).toISOString().slice(0, 16)}Z)`,
    "-f", `content=${content}`];
  if (sha) args.push("-f", `sha=${sha}`);
  await new Promise((resolve) => {
    execFile("gh", args, (e) => { if (e) console.error("[restock] publish failed:", e.message); resolve(); });
  });
}

export function startRestockTracker() {
  loadState();
  pollOnce().catch(() => {});
  setInterval(() => { pollOnce().catch(() => {}); }, 60_000);
  setInterval(() => { publishModel().catch(() => {}); }, 600_000);
  console.log("[restock] tracker started (poll 60s, publish 10m)");
}
