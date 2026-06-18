import { readFileSync } from "node:fs";
import vm from "node:vm";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as push from "./push-notifications.js";
import * as stakeoutStore from "./stakeout-store.js";
import { decrypt } from "./key-encryption.js";

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

async function _fetchTorn(kind, id, key) {
  const section = kind === "faction" ? "faction" : "user";
  const selections = kind === "faction" ? "basic,chain,wars" : "profile";
  const url = `https://api.torn.com/v2/${section}/${id}?selections=${selections}&comment=wb-stakeout`;
  const res = await fetch(url, { headers: { Authorization: `ApiKey ${key}`, Accept: "application/json" } });
  const json = await res.json();
  if (!json || json.error) return null;
  return json;
}

export async function runPoll(opts = {}) {
  const fetchImpl = opts.fetchImpl || _fetchTorn;
  const sendImpl = opts.sendImpl || notifyStakeoutAlert;
  const nowFn = opts.nowFn || Date.now;
  const decryptKey = opts.decryptKey || decrypt;
  const st = stakeoutStore.getState();
  const ownerIds = Object.keys(st.owners || {});
  let polled = 0, fired = 0;
  if (ownerIds.length === 0) return { owners: 0, polled, fired };
  for (const ownerId of ownerIds) {
    const owner = st.owners[ownerId];
    let key;
    try { key = decryptKey(owner.key); } catch { key = null; }
    if (!key) continue;
    for (const [kind, map] of [["player", owner.players || {}], ["faction", owner.factions || {}]]) {
      for (const [id, target] of Object.entries(map)) {
        let json;
        try { json = await fetchImpl(kind, id, key); } catch { json = null; }
        if (!json) continue; // bad read -> do not touch info
        const snap = kind === "faction" ? engine.mapFactionResponse(json) : engine.mapPlayerResponse(json);
        const firedKeys = evaluateTarget(target, snap, kind, nowFn());
        polled++;
        if (firedKeys.length) { await sendImpl([ownerId], id, snap, firedKeys, kind); fired++; }
      }
    }
  }
  stakeoutStore.scheduleSave();
  return { owners: ownerIds.length, polled, fired };
}

let _pollTimer = null;
export function startWatcher() {
  if (_pollTimer) return;
  _pollTimer = setInterval(() => { runPoll().catch((e) => console.warn("[stakeout-watcher] poll error:", e.message)); }, POLL_INTERVAL_MS);
  console.log(`[stakeout-watcher] started (every ${POLL_INTERVAL_MS / 1000}s)`);
  runPoll().catch(() => {});
}
export function stopWatcher() {
  if (_pollTimer) { clearInterval(_pollTimer); _pollTimer = null; }
  stakeoutStore.flushSync();
}
