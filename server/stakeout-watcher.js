import { readFileSync } from "node:fs";
import vm from "node:vm";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

export const POLL_INTERVAL_MS = 30_000;
export const COOLDOWN_MS = 30 * 60_000;

function loadEngine() {
  const src = readFileSync(join(__dirname, "public/scripts/torn-stakeout.user.js"), "utf8");
  const sandbox = { module: { exports: {} }, console };
  vm.runInNewContext(src, sandbox, { filename: "torn-stakeout.user.js" });
  const e = sandbox.module.exports;
  for (const k of ["evaluatePlayer", "evaluateFaction", "mapPlayerResponse", "mapFactionResponse"]) {
    if (typeof e[k] !== "function") throw new Error(`[stakeout-watcher] engine missing ${k} — script export guard broken`);
  }
  return e;
}

export const engine = loadEngine();

export function evaluateTarget(target, snap, kind, now, cooldownMs = COOLDOWN_MS) {
  if (!target.seeded) { target.info = snap; target.seeded = true; return []; }
  const old = target.info;
  const fired = kind === "faction"
    ? engine.evaluateFaction(old, snap, target.alerts)
    : engine.evaluatePlayer(old, snap, target.alerts, now);
  if (!target.lastFiredAt) target.lastFiredAt = {};
  const deliver = [];
  for (const k of fired) {
    const last = target.lastFiredAt[k];
    if (last === undefined || now - last >= cooldownMs) { target.lastFiredAt[k] = now; deliver.push(k); }
  }
  target.info = snap; // ALWAYS re-arm
  return deliver;
}
