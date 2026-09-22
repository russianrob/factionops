#!/usr/bin/env node
//
// Does the firepower ratio actually predict who wins a ranked war?
//
//   TORN_KEY=... FFS_KEY=... node win-model-backtest.mjs [days]
//
// The model's steepness was set from ONE observation — 2.55x firepower
// produced a 2.91x score in war 49287 — which is a guess wearing a number's
// clothes. This measures it against every recent war it can reach.
//
// THE BIAS, stated up front because it cannot be removed:
//
//   FFScouter reports stats as they are TODAY. The wars are in the past, and
//   factions grow. So every prediction here uses a roster stronger than the
//   one that actually fought.
//
//   What saves it is that the model reads a RATIO, and both sides drift
//   upward together, so the error is second-order rather than first. It is
//   still an error, and it grows with age — which is why the window defaults
//   to 120 days and why a wider one should be read more sceptically.
//
// Nothing is written outside the cache directory, and no war is replayed: the
// outcome comes from Torn's own record of who won.

import fs from "fs";
import path from "path";
import { baseFromStats, rosterStats, STEEPNESS } from "./win-model.js";

const TORN_KEY = process.env.TORN_KEY;
const FFS_KEY = process.env.FFS_KEY;
const DAYS = Number(process.argv[2]) || 120;
if (!TORN_KEY || !FFS_KEY) {
  console.error("usage: TORN_KEY=... FFS_KEY=... node win-model-backtest.mjs [days]");
  process.exit(1);
}

const CACHE = new URL("./data/backtest-cache/", import.meta.url).pathname;
fs.mkdirSync(CACHE, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Cached fetch. Rosters and stats move slowly; a rerun should cost nothing. */
async function cached(key, ms, fn) {
  const f = path.join(CACHE, key.replace(/[^\w.-]/g, "_") + ".json");
  try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch {}
  await sleep(ms);
  const v = await fn();
  try { fs.writeFileSync(f, JSON.stringify(v)); } catch {}
  return v;
}

const torn = (p) => cached(`torn-${p}`, 700, async () => {
  const r = await fetch(`https://api.torn.com/v2/${p}${p.includes("?") ? "&" : "?"}key=${TORN_KEY}&comment=wb-backtest`);
  const j = await r.json();
  if (j.error) throw new Error(`${p}: ${j.error.error}`);
  return j;
});

// FFScouter's activity endpoints cap at 10/min; get-stats is not documented
// with a number, so it is paced the same way rather than discovered the hard
// way mid-run.
const ffsStats = (ids) => cached(`ffs-${ids[0]}-${ids.length}`, 7000, async () => {
  const r = await fetch(`https://ffscouter.com/api/v1/get-stats?key=${FFS_KEY}&targets=${ids.join(",")}`);
  const j = await r.json();
  if (!Array.isArray(j)) throw new Error(`get-stats: ${j && j.error}`);
  return j;
});

const now = Date.now() / 1000;
const recent = (w) => w.end && (now - w.end) < DAYS * 86400;

// ── 1. Collect wars ────────────────────────────────────────────
// Start from our own history, then one level outward through every faction we
// fought. One level is enough for a few dozen wars and keeps the call count
// bounded; going deeper would multiply cost for a sample the bias limits
// anyway.
console.log(`Collecting wars from the last ${DAYS} days…`);
const seed = (await torn("faction/42055/rankedwars")).rankedwars || [];
const seen = new Map();
const addWars = (ws) => { for (const w of ws || []) if (recent(w)) seen.set(w.id, w); };
addWars(seed);

const firstHop = new Set(seed.filter(recent).flatMap((w) => w.factions.map((f) => f.id)));
for (const fid of firstHop) {
  try { addWars((await torn(`faction/${fid}/rankedwars`)).rankedwars); }
  catch (e) { console.warn(`  skip faction ${fid}: ${e.message}`); }
}

const wars = [...seen.values()].filter((w) => Number(w.winner) > 0);
const factions = [...new Set(wars.flatMap((w) => w.factions.map((f) => f.id)))];
console.log(`  ${wars.length} decided wars across ${factions.length} factions\n`);

// ── 2. Firepower per faction ───────────────────────────────────
console.log(`Reading rosters and stats for ${factions.length} factions (paced ~7s each)…`);
const power = new Map();
for (const [i, fid] of factions.entries()) {
  try {
    const members = (await torn(`faction/${fid}/members`)).members || [];
    if (!members.length) continue;
    const est = await ffsStats(members.slice(0, 200).map((m) => m.id));
    const rs = rosterStats(est, members.length);
    if (rs.total) power.set(fid, rs);
    if ((i + 1) % 10 === 0) console.log(`  ${i + 1}/${factions.length}`);
  } catch (e) { console.warn(`  skip ${fid}: ${e.message}`); }
}
console.log(`  firepower known for ${power.size}/${factions.length}\n`);

// ── 3. Predict, then compare ───────────────────────────────────
// Each war is scored from ONE side, picked by faction id so the choice cannot
// correlate with the outcome. Scoring from the winner's side every time would
// make any model look perfect.
const rows = [];
for (const w of wars) {
  const [a, b] = w.factions;
  if (!power.has(a.id) || !power.has(b.id)) continue;
  const subject = a.id < b.id ? a : b;
  const other = subject === a ? b : a;
  const p = baseFromStats(power.get(subject.id).total, power.get(other.id).total);
  if (p == null) continue;
  rows.push({
    warId: w.id, end: w.end,
    subject: subject.id, other: other.id,
    predicted: p,
    won: Number(w.winner) === Number(subject.id),
    scoreShare: (subject.score || 0) / ((subject.score || 0) + (other.score || 0) || 1),
    ratio: power.get(subject.id).total / power.get(other.id).total,
  });
}
console.log(`Scored ${rows.length} wars.\n`);
if (!rows.length) process.exit(0);

// ── 4. Calibration ─────────────────────────────────────────────
// The question is not "how often is it right" — always predicting the stronger
// side would score well and tell us nothing about the numbers. It is whether
// the stated probability matches the observed rate.
console.log("Calibration — does a stated 70% win about 70% of the time?");
console.log("  bucket      n   predicted   actual   gap");
const buckets = [[0,20],[20,35],[35,50],[50,65],[65,80],[80,100]];
for (const [lo, hi] of buckets) {
  const inB = rows.filter((r) => r.predicted >= lo && r.predicted < hi);
  if (!inB.length) continue;
  const pred = inB.reduce((s, r) => s + r.predicted, 0) / inB.length;
  const act = inB.filter((r) => r.won).length / inB.length * 100;
  // Built as a string rather than passed as printf args: console.log only
  // substitutes %-tokens when the format string is the FIRST argument, and
  // .replace() on it meant every run printed its own format specifiers.
  console.log(`  ${String(lo).padStart(3)}-${String(hi).padEnd(3)}   ` +
    `${String(inB.length).padStart(3)}   ${pred.toFixed(1).padStart(6)}%   ` +
    `${act.toFixed(1).padStart(6)}%   ${(act - pred >= 0 ? "+" : "")}${(act - pred).toFixed(1)}`);
}

const brier = rows.reduce((s, r) => s + Math.pow(r.predicted / 100 - (r.won ? 1 : 0), 2), 0) / rows.length;
const acc = rows.filter((r) => (r.predicted >= 50) === r.won).length / rows.length;
// A coin flip every time scores 0.25. Anything above that is worse than useless.
console.log(`\n  Brier score: ${brier.toFixed(4)}  (0 perfect, 0.25 = always saying 50%)`);
console.log(`  Direction called right: ${(acc * 100).toFixed(1)}% of ${rows.length} wars`);

// ── 5. Is the steepness right? ─────────────────────────────────
// Refit on the same data, so this is the best case for the curve rather than
// an out-of-sample claim. It answers "is 1.5 near the optimum", not "how well
// will it do next time".
console.log(`\nSteepness (currently ${STEEPNESS}) — Brier at each value:`);
let best = { k: null, brier: Infinity };
for (let k = 0.25; k <= 4.01; k += 0.25) {
  const b = rows.reduce((s, r) => {
    const p = 1 / (1 + Math.pow(1 / r.ratio, k));
    return s + Math.pow(p - (r.won ? 1 : 0), 2);
  }, 0) / rows.length;
  if (b < best.brier) best = { k, brier: b };
  console.log(`  k=${k.toFixed(2)}  ${b.toFixed(4)}${Math.abs(k - STEEPNESS) < 1e-9 ? "   <- current" : ""}`);
}
console.log(`\n  Best on this sample: k=${best.k} (Brier ${best.brier.toFixed(4)})`);

fs.writeFileSync(path.join(CACHE, "rows.json"), JSON.stringify(rows, null, 1));
console.log(`\n  ${rows.length} scored wars written to data/backtest-cache/rows.json`);
console.log("  NOTE: stats are current, the wars are past — the ratio absorbs most");
console.log("  of that drift but not all of it, and the error grows with the window.");
