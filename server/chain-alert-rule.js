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
 * A hit most often puts the chain's clock back to 5 minutes, so a chain that
 * reaches 100 just after a check most often still has 3 minutes or more left
 * at the next one: time for the war-pace checks to catch the 60 s and 30 s
 * marks.
 */
export const OUTSIDE_WAR_IDLE_MS = 120_000;

/**
 * How long the war-pace checks hold after the last reading of a running
 * chain of 100 or more. A chain's clock never runs past 5 minutes, so a
 * chain read that recently may still be alive though a later reading says
 * otherwise.
 */
export const BIG_CHAIN_HOLD_MS = 300_000;

/**
 * A cooldown can be the chain's end only if, by the clock of the reading
 * before it, the chain had this many seconds or fewer left: a chain ends
 * only when its clock runs out.
 */
export const CHAIN_END_MAX_LEFT_S = 30;

/**
 * ...and only if the reading before it is this recent, so a record left
 * from before a restart, read again hours later, never reports a chain as
 * just ended.
 */
export const CHAIN_END_MAX_AGE_MS = 180_000;

/**
 * ...and the notice waits this long for the count to hold in the cooldown.
 * Torn has reported a cooldown on chains that then ran on: on 2026-10-26 for
 * five minutes while the hits still counted, and on 2026-10-28 for 2 min 42 s
 * with the count held at 3,114 before the next hit came in. So the wait is
 * longer than five minutes. A chain that has ended keeps its count through
 * the whole cooldown, about 6 s a hit (over 9 minutes for a chain of 100),
 * so the wait, and the slow poll that may come after it
 * (OUTSIDE_WAR_IDLE_MS), are over before the cooldown is.
 */
export const CHAIN_END_CONFIRM_MS = 360_000;

/**
 * The longest cooldown taken as one: Torn's runs about 6 s a hit, under 7
 * days even for a chain of 100,000. A bigger number is a date sent in its
 * place, as a member's FactionOps did on 2026-10-26.
 */
export const MAX_COOLDOWN_S = 864_000;

/**
 * The longest a chain's clock runs: 5 minutes. A hit most often puts it back
 * there, but not always: on 2026-10-28 hits left it at 17-24 s.
 */
export const CHAIN_CLOCK_MAX_S = 300;

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

/** True for a cooldown Torn could have sent: over 0 and at most MAX_COOLDOWN_S. */
export function isCooldown(cooldown) {
  return cooldown > 0 && cooldown <= MAX_COOLDOWN_S;
}

/**
 * True for a reading of a running chain of 100 or more. A chain that has
 * ended keeps its count through its cooldown, for most of a day after a
 * long chain, and that gets no war-pace reads.
 */
export function isBigLiveChain(chain) {
  return (Number(chain?.current) || 0) >= OUTSIDE_WAR_MIN_CHAIN && !(Number(chain?.cooldown) > 0);
}

/**
 * Milliseconds until the next chain check outside a live war: `fastMs`, the
 * war's own pace, while a running chain reads 100 or more (isBigLiveChain)
 * or did within BIG_CHAIN_HOLD_MS (`sinceBigChainMs` ago); otherwise
 * OUTSIDE_WAR_IDLE_MS. Before kickoff the wait never runs past kickoff, so
 * the war's own pace starts on time.
 */
export function outsideWarDelay(war, nowMs, fastMs, sinceBigChainMs) {
  const big = isBigLiveChain(war?.chainData) || sinceBigChainMs < BIG_CHAIN_HOLD_MS;
  const delay = big ? fastMs : OUTSIDE_WAR_IDLE_MS;
  const startSec = Number(war?.warStart) || 0;
  const msToKickoff = startSec * 1000 - nowMs;
  if (war && !war.warEnded && startSec > 0 && msToKickoff > 0) {
    return Math.min(delay, Math.max(MIN_PRE_WAR_DELAY_MS, msToKickoff));
  }
  return delay;
}

/**
 * True when a reading may be the end of a chain of 100 or more. Torn ends a
 * chain when its clock runs out: the count stays, the timeout reads 0 and a
 * cooldown starts, and the count reads 0 only once the cooldown is over. So
 * the end is a reading of 100+ that starts a cooldown (`cooldown`, see
 * isCooldown), after a recent reading of 100+ with no cooldown and 30 s or
 * less left on its clock (`prevTimeoutS`, counted to now; Torn's last
 * reading before the cooldown can show 0). The monitor sends the notice
 * once the count has held for CHAIN_END_CONFIRM_MS.
 */
export function outsideWarChainEnded({ prevCurrent, prevTimeoutS, prevCooldown, prevAgeMs, current, cooldown }) {
  return prevCurrent >= OUTSIDE_WAR_MIN_CHAIN
    && current >= OUTSIDE_WAR_MIN_CHAIN
    && !(prevCooldown > 0)
    && isCooldown(cooldown)
    && prevTimeoutS <= CHAIN_END_MAX_LEFT_S
    && prevAgeMs <= CHAIN_END_MAX_AGE_MS;
}

/**
 * True for a reading under 100 while a chain of 100 or more still has time
 * on its clock (`prevTimeoutS`, counted to now): a bad reading. A chain's
 * count never drops while its clock runs, but members' FactionOps send 0s
 * like that, thousands of them (on 2026-10-26, one with nearly 5 minutes
 * left on the clock, and the next reading had the whole chain again).
 * Stored, a 0 makes the next reading look like a fresh chain's first hits:
 * the bonus warnings start over, and an end right after it is never noticed.
 * A clock over 5 minutes is no chain's, so a reading after one is taken.
 */
export function outsideWarBadDrop({ prevCurrent, prevTimeoutS, current }) {
  return prevCurrent >= OUTSIDE_WAR_MIN_CHAIN
    && prevTimeoutS > 0 && prevTimeoutS <= CHAIN_CLOCK_MAX_S
    && current < OUTSIDE_WAR_MIN_CHAIN;
}

/**
 * True for a member's chain report (`source` "client": FactionOps) with a
 * lower count than the newest one read in the last 5 minutes (`newest`,
 * { count, atMs }): a report from before the latest hits, so its low clock is
 * not the chain's, and it gets no CHAIN BREAKING or CHAIN DYING. On
 * 2026-07-10 a member's FactionOps sent counts up to 40 hits behind for over
 * an hour, with a clock of their own running down, while the chain climbed.
 * A chain's count never drops while it runs, nor through the cooldown after,
 * and its clock never holds more than 5 minutes; a newest count older than
 * that may be of a chain that has ended since, and a lower count may be a new
 * chain's. The server's own read of Torn (`source` "poll") is never stale.
 */
export function staleMemberReport({ source, current, newest, nowMs }) {
  return source !== "poll"
    && !!newest
    && nowMs - newest.atMs <= CHAIN_CLOCK_MAX_S * 1000
    && (Number(current) || 0) < newest.count;
}
