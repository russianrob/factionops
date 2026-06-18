import { readFileSync } from "node:fs";
import vm from "node:vm";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as push from "./push-notifications.js";

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

const TRIGGER_TEXT = {
  online: "is online", okay: "is out of hospital", hospital: "is hospitalized",
  landing: "has landed", revivable: "is revivable", life: "life dropped below your threshold",
  offline: "has gone offline", chainReaches: "chain alert", memberCountDrops: "lost members",
  rankedWarStarts: "started a ranked war", inRaid: "is in a raid", inTerritoryWar: "is in a territory war",
};
function humanTrigger(k) { return TRIGGER_TEXT[k] || k; }

export function buildStakeoutPayload(targetId, snap, firedKeys, kind) {
  const id = String(targetId);
  const name = (snap && snap.name) || (kind === "faction" ? `Faction ${id}` : `Player ${id}`);
  const url = kind === "faction"
    ? `https://www.torn.com/factions.php?step=profile&ID=${id}`
    : `https://www.torn.com/profiles.php?XID=${id}`;
  return {
    title: "Stakeout",
    body: `${name} ${humanTrigger(firedKeys[0])}`,
    tag: `stakeout-${id}`,
    threadId: "stakeout",
    icon: "/icon-192.png",
    data: { type: "stakeout_alert", targetId: id, trigger: firedKeys[0], url },
  };
}

export async function notifyStakeoutAlert(subscriberIds, targetId, snap, firedKeys, kind) {
  if (!subscriberIds?.length || !firedKeys?.length) return;
  try {
    await push.sendToPlayers(subscriberIds.map(String), buildStakeoutPayload(targetId, snap, firedKeys, kind), "stakeout_alert");
  } catch (e) {
    console.warn("[stakeout-watcher] push failed:", e.message);
  }
}
