export const ENEMY_PROFILE_RAMP_SEC = 30 * 60;        // full speed within 30 min of kickoff
export const ENEMY_PROFILE_PREWAR_MS = 5 * 60 * 1000; // throttled cadence before that

/**
 * Throttle the per-enemy profile sweep before a war starts.
 *
 * The sweep's unique value — fine-grained "attacking" state and sub-30s
 * per-enemy freshness — only matters once fighting is imminent. During the
 * pre-war lull the 15s war-status basic poll already keeps the enemy
 * roster / online / hospital fresh, so the ~325-call/min profile sweep is
 * pure waste days before kickoff. When a war is more than
 * ENEMY_PROFILE_RAMP_SEC from its start, stretch the interval to
 * ENEMY_PROFILE_PREWAR_MS; within the ramp window (or once started), run at
 * the normal fast cadence. nextEnemyProfile re-evaluates every tick, so the
 * sweep ramps to full speed automatically as kickoff approaches.
 */
export function enemyProfilePrewarDelay(warStart, baseDelay, nowSec) {
  if (!warStart) return baseDelay; // unknown start → treat as active
  const startsInSec = Number(warStart) - nowSec;
  if (startsInSec <= ENEMY_PROFILE_RAMP_SEC) return baseDelay; // active or imminent
  return Math.max(baseDelay, ENEMY_PROFILE_PREWAR_MS);         // upcoming → throttle
}

// Torn states where the member physically cannot be mid-attack — no point
// spending a profile poll on them. (offline/idle activity is handled
// separately by the `activity` check.)
const CANT_ATTACK = new Set(["hospital", "traveling", "jail", "federal"]);

/**
 * Whether an enemy is worth polling for live "attacking" detection: they
 * must be online (at the keyboard) AND free to act (not hospital / in
 * transit / jail / federal). Offline & idle members can't be mid-attack —
 * the moment they act they flip to online and the 15s war-status poll
 * re-includes them, so the sweep can safely skip them. `s` is a
 * war.enemyStatuses entry { activity, status, ... }.
 */
export function couldBeAttacking(s) {
  if (!s || s.activity !== "online") return false;
  return !CANT_ATTACK.has(String(s.status || "okay"));
}
