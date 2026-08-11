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
