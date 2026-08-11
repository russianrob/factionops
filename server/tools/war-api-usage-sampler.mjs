/**
 * War API-usage sampler (persistent, box-cron driven).
 *
 * Purpose: prove the poller-cadence reductions once war_42055 goes ACTIVE.
 * The reductions only manifest under war-time load, and the target war kicks
 * off 2026-08-13, well past any single Claude session — so this runs from the
 * box crontab (survives session death), samples the in-process key-usage buffer
 * every ~11 min, and appends a timestamped rate-by-purpose snapshot. When the
 * war is live it captures the real numbers; a served summary compares them to
 * what the OLD cadences would have produced.
 *
 * Reads: localhost key-usage endpoint + wars.json.
 * Writes: data/war-api-usage/war_42055.jsonl  (raw samples)
 *         public/war-api-usage.txt             (served summary — tornwar.com/war-api-usage.txt)
 */
import { readFileSync, writeFileSync, appendFileSync, mkdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const SERVER = join(HERE, "..");
const WARS_FILE = join(SERVER, "data", "wars.json");
const OUT_DIR = join(SERVER, "data", "war-api-usage");
const JSONL = join(OUT_DIR, "war_42055.jsonl");
const SUMMARY = join(SERVER, "public", "war-api-usage.txt");
const WAR_ID = "war_42055";
const POOL_KEYS = 28; // faction 42055 pooled keys (verify with key-usage-local perKey if it changes)

// Old vs new cadences (ms) for the pollers changed 2026-08-11. Reduction for a
// fixed-concurrency poller is new/old on the interval.
const CADENCE = {
  "enemy-profile": { oldMs: 2000,  newMs: 30000,  note: "also dropped the online-only filter" },
  "war-status":    { oldMs: 30000, newMs: 30000,  note: "enemy roster unchanged; our-faction sub-fetch 30s→10min" },
};

function loadWar() {
  try { return JSON.parse(readFileSync(WARS_FILE, "utf-8"))[WAR_ID] || null; }
  catch { return null; }
}

async function keyUsage() {
  const res = await fetch("http://localhost:3000/api/debug/key-usage-local?window=15");
  if (!res.ok) throw new Error(`key-usage HTTP ${res.status}`);
  const j = await res.json();
  const byPurpose = {};
  for (const [src, n] of Object.entries(j.bySource || {})) {
    const p = src.replace(/pid=.*/, "").replace(/[:]$/, "").replace(/^pool:/, "");
    byPurpose[p] = (byPurpose[p] || 0) + n;
  }
  const perMin = {};
  for (const [p, n] of Object.entries(byPurpose)) perMin[p] = +(n / 15).toFixed(2);
  return { totalPerMin: +((j.callsPerMin) || 0).toFixed(2), perMin };
}

function nowIso(t) { return new Date(t).toISOString(); }

async function main() {
  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });
  const war = loadWar();
  const t = Date.now();
  const startMs = war && war.warStart ? Number(war.warStart) * 1000 : null;
  const active = !!(war && startMs && startMs <= t && !war.warEnded);
  const enemyCount = war && war.enemyStatuses ? Object.keys(war.enemyStatuses).length : 0;

  let usage = { totalPerMin: null, perMin: {} };
  try { usage = await keyUsage(); } catch (e) { usage.error = e.message; }

  const sample = {
    ts: t, iso: nowIso(t), phase: active ? "war" : (startMs && startMs > t ? "prewar" : "unknown"),
    enemyCount, poolKeys: POOL_KEYS, ...usage,
  };
  appendFileSync(JSONL, JSON.stringify(sample) + "\n");

  // Rebuild the served summary from all samples.
  const samples = readFileSync(JSONL, "utf-8").trim().split("\n").filter(Boolean).map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
  const warS = samples.filter(s => s.phase === "war");
  const preS = samples.filter(s => s.phase === "prewar");
  const avg = (arr, key) => arr.length ? +(arr.reduce((a, s) => a + (s.perMin?.[key] || 0), 0) / arr.length).toFixed(2) : 0;
  const avgTotal = (arr) => arr.length ? +(arr.reduce((a, s) => a + (s.totalPerMin || 0), 0) / arr.length).toFixed(2) : 0;

  const L = [];
  L.push("WARBOARD — WAR API-USAGE REPORT (faction 42055)");
  L.push("=".repeat(52));
  L.push(`Generated: ${nowIso(t)}`);
  L.push(`Pool: ${POOL_KEYS} keys  ->  ceiling ${POOL_KEYS * 100}/min (Torn 100/min/key)`);
  L.push(`Target war ${WAR_ID}: start ${startMs ? nowIso(startMs) : "?"} — ${active ? "ACTIVE NOW" : (startMs && startMs > t ? "upcoming" : "unknown")}`);
  L.push(`Samples: ${samples.length} total (${preS.length} pre-war, ${warS.length} war-time)`);
  L.push("");
  if (preS.length) {
    L.push(`PRE-WAR baseline (avg): ${avgTotal(preS)}/min total`);
    L.push(`  enemy-profile ${avg(preS, "enemy-profile")}/min | war-status ${avg(preS, "war-status")}/min | chain ${avg(preS, "chain")}/min`);
    L.push("");
  }
  if (warS.length) {
    L.push(`WAR-TIME measured (avg over ${warS.length} samples): ${avgTotal(warS)}/min total`);
    for (const p of ["enemy-profile", "war-status", "chain", "attacks-feed"]) {
      L.push(`  ${p.padEnd(15)} ${String(avg(warS, p)).padStart(7)}/min`);
    }
    L.push("");
    L.push("REDUCTION vs the old cadences (new config measured; old = interval-scaled projection):");
    for (const [p, c] of Object.entries(CADENCE)) {
      const meas = avg(warS, p);
      const ratio = c.oldMs > 0 ? c.newMs / c.oldMs : 1;
      const oldProj = ratio > 1 ? +(meas * ratio).toFixed(1) : meas;
      if (ratio > 1) L.push(`  ${p}: ${meas}/min now  ->  ~${oldProj}/min under old ${c.oldMs / 1000}s cadence  (~${Math.round(ratio)}x fewer)  [${c.note}]`);
      else L.push(`  ${p}: ${meas}/min (${c.note})`);
    }
    L.push(`  our-faction roster: 30s -> 10min = ~20x fewer (rides war-status key; not separately tagged)`);
    L.push(`  war-score check:    30s -> 5min  = ~10x fewer`);
  } else {
    L.push("WAR-TIME: no active-war samples yet — capture begins automatically when the war goes live.");
  }
  L.push("");
  L.push("Raw samples: data/war-api-usage/war_42055.jsonl");
  writeFileSync(SUMMARY, L.join("\n") + "\n");
  console.log(`[war-api-usage] ${sample.phase} sample: total=${usage.totalPerMin}/min, enemy-profile=${usage.perMin["enemy-profile"] ?? "-"}/min, war-time samples=${warS.length}`);
}

main().catch(e => { console.error("[war-api-usage] failed:", e.message); process.exit(1); });
