// When the server sends chain alerts, in a war and outside one.
//
// In a live war every chain of 10 or more gets the CHAIN BREAKING (60 s
// left) and CHAIN DYING (30 s left) alerts and the bonus warnings. Outside
// a live war (after it ends, before kickoff) only a chain of 100 or more
// does. Factions keep a chain going after a war, and on 2026-10-26 one that
// ran on for seven hours after its war died with no alert, because the
// alerts had stopped with the war. FactionOps' own on-page alert still
// covers smaller chains for anyone with FactionOps open on a Torn page.
//
// Pure, with no imports: chain-monitor.js and push-notifications.js both
// read it, and the tests import it directly.

/** The smallest chain alerted while a war is live. */
export const WAR_MIN_CHAIN = 10;

/** The smallest chain alerted outside a live war. */
export const OUTSIDE_WAR_MIN_CHAIN = 100;

/**
 * How often the chain is checked outside a war while it reads under 100.
 * Every hit puts the chain's clock back to 5 minutes, so a chain that
 * reaches 100 just after a check still has 3 minutes or more left at the
 * next one: time for the war-pace checks to catch the 60 s and 30 s marks.
 */
export const OUTSIDE_WAR_IDLE_MS = 120_000;

/**
 * How long the war-pace checks hold after the last reading of 100 or more.
 * A chain's clock never runs past 5 minutes, so a chain read at 100+ that
 * recently may still be alive though a later reading says less (see
 * CHAIN_END_MAX_LEFT_S for one that did).
 */
export const BIG_CHAIN_HOLD_MS = 300_000;

/**
 * A drop counts as the chain ending only if, by the clock of the reading
 * before it, the chain had this many seconds or fewer left. A chain ends
 * only when its clock runs out, so a drop with more time left is a bad
 * reading: at the end of a war on 2026-10-26 a member's FactionOps
 * reported one 0 with nearly 5 minutes left on the chain's clock, and the
 * next reading had the whole chain again.
 */
export const CHAIN_END_MAX_LEFT_S = 30;

/**
 * ...and only if the reading before it is this recent, so a record left
 * from before a restart, read again hours later, never reports a chain as
 * just ended.
 */
export const CHAIN_END_MAX_AGE_MS = 180_000;

/** The shortest wait before kickoff, as the pre-war cadence had it. */
const MIN_PRE_WAR_DELAY_MS = 5_000;

/**
 * True while the war on this record has started and not ended. A record
 * with no start time counts as started, as push-notifications.js'
 * hasWarStarted has it: never miss a live chain for want of a date.
 */
export function isWarLive(war, nowMs) {
  if (!war || war.warEnded === true) return false;
  const startSec = Number(war.warStart) || 0;
  return !startSec || nowMs / 1000 >= startSec;
}

/** The smallest chain worth an alert on this record at this moment. */
export function chainAlertFloor(war, nowMs) {
  return isWarLive(war, nowMs) ? WAR_MIN_CHAIN : OUTSIDE_WAR_MIN_CHAIN;
}

/**
 * Milliseconds until the next chain check outside a live war: `fastMs`, the
 * war's own pace, while the chain reads 100 or more or did within
 * BIG_CHAIN_HOLD_MS (`sinceBigChainMs` ago); otherwise OUTSIDE_WAR_IDLE_MS.
 * Before kickoff the wait never runs past kickoff, so the war's own pace
 * starts on time.
 */
export function outsideWarDelay(war, nowMs, fastMs, sinceBigChainMs) {
  const current = Number(war?.chainData?.current) || 0;
  const big = current >= OUTSIDE_WAR_MIN_CHAIN || sinceBigChainMs < BIG_CHAIN_HOLD_MS;
  const delay = big ? fastMs : OUTSIDE_WAR_IDLE_MS;
  const startSec = Number(war?.warStart) || 0;
  const msToKickoff = startSec * 1000 - nowMs;
  if (war && !war.warEnded && startSec > 0 && msToKickoff > 0) {
    return Math.min(delay, Math.max(MIN_PRE_WAR_DELAY_MS, msToKickoff));
  }
  return delay;
}

/**
 * True when a reading shows that a chain of 100 or more has just ended: the
 * reading before it was 100+ and recent, and by its clock the chain had 30 s
 * or less left (`prevTimeoutS`, counted to now), and this reading is under
 * 100 (0, or a new chain's first hits).
 */
export function outsideWarChainEnded({ prevCurrent, prevTimeoutS, prevAgeMs, current }) {
  return prevCurrent >= OUTSIDE_WAR_MIN_CHAIN
    && current < OUTSIDE_WAR_MIN_CHAIN
    && prevTimeoutS <= CHAIN_END_MAX_LEFT_S
    && prevAgeMs <= CHAIN_END_MAX_AGE_MS;
}
