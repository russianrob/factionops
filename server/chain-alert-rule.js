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

/** The longest a chain's clock runs: a hit puts it back to 5 minutes. */
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
 * Stored, a 0 makes the next reading look like a fresh chain's first hits,
 * and that holds back the chain's CHAIN BREAKING and CHAIN DYING for about
 * 3 minutes. A clock over 5 minutes is no chain's, so it holds nothing back.
 */
export function outsideWarBadDrop({ prevCurrent, prevTimeoutS, current }) {
  return prevCurrent >= OUTSIDE_WAR_MIN_CHAIN
    && prevTimeoutS > 0 && prevTimeoutS <= CHAIN_CLOCK_MAX_S
    && current < OUTSIDE_WAR_MIN_CHAIN;
}

// ── Page reports ────────────────────────────────────────────────────────
//
// FactionOps (5.6.28 and later) sends the chain as a member's focused Torn
// page shows it: its count, and when its clock runs out. On 2026-10-28
// Torn's API ran behind the game for about two hours, showing the chain over
// while it ran on, and the server sent no chain alert. The server still
// reads the API as before; a page report decides the low-clock alerts only
// while it is ahead of the API's reading (pageLeadsApi).

/** How long a page report stands: FactionOps sends one at least every 60 s. */
export const PAGE_REPORT_FRESH_MS = 75_000;

/**
 * At the same count, an API cooldown that ends less than this many seconds
 * after the page's clock, or less than PAGE_COOLDOWN_BEHIND_S before it, is
 * the cooldown the page counts down, not a chain's clock: a sidebar may count
 * a finished chain's cooldown down. FactionOps' chain bar takes the same
 * window (its CHAIN_BAR_COOLDOWN_AHEAD_S): the API's answer is up to about
 * 30 s behind, so its cooldown ends up to that much later, never earlier.
 */
export const PAGE_COOLDOWN_AHEAD_S = 45;
export const PAGE_COOLDOWN_BEHIND_S = 5;

/** At the same count with no cooldown, how much later the page's clock must end to lead. */
export const PAGE_LEADS_BY_MS = 15_000;

/** The most time a report's clock may show: a chain's clock, and the trip here. */
export const PAGE_REPORT_MAX_LEFT_S = CHAIN_CLOCK_MAX_S + 10;

/** The biggest count taken: Torn's top chain bonus is at 100,000. */
const PAGE_REPORT_MAX_COUNT = 100_000;

/**
 * A chain reading as instants: { current, endsAtMs, cooldownEndsAtMs }, 0
 * for none. Takes Torn's reading (`timeout` and `cooldown` in seconds, read
 * at `readAtMs`) or a stored one (its `chainEndsAt`, see chain-data.js, and
 * the cooldown it was read with at `readAtMs`).
 */
export function apiChainView(chain, readAtMs) {
  const c = chain || {};
  const timeout = Number(c.timeout) || 0;
  const cooldown = Number(c.cooldown) || 0;
  return {
    current: Number(c.current) || 0,
    endsAtMs: Number.isFinite(c.chainEndsAt) ? c.chainEndsAt : (timeout > 0 ? readAtMs + timeout * 1000 : 0),
    cooldownEndsAtMs: cooldown > 0 ? readAtMs + cooldown * 1000 : 0,
  };
}

/**
 * True while a page report (`page`: { count, endsAtMs, atMs }) is ahead of
 * the API's reading (`api`, in apiChainView's form), so the chain alerts
 * follow the page. Only a report at most PAGE_REPORT_FRESH_MS old leads. A
 * higher count leads (a chain cannot grow in its cooldown, so a higher count
 * is a running chain whatever the API says), and a lower one never does. At
 * the same count: while the API shows a cooldown, the page leads unless its
 * clock is that cooldown counting down (PAGE_COOLDOWN_AHEAD_S); with none,
 * when its clock ends PAGE_LEADS_BY_MS or more after the API's.
 */
export function pageLeadsApi(page, api, nowMs) {
  if (!page || !(nowMs - page.atMs <= PAGE_REPORT_FRESH_MS)) return false;
  const apiCount = Number(api?.current) || 0;
  if (page.count !== apiCount) return page.count > apiCount;
  const cooldownEndsAtMs = Number(api?.cooldownEndsAtMs) || 0;
  if (cooldownEndsAtMs > nowMs) {
    const ahead = (cooldownEndsAtMs - page.endsAtMs) / 1000;
    return !(ahead > -PAGE_COOLDOWN_BEHIND_S && ahead < PAGE_COOLDOWN_AHEAD_S);
  }
  return page.endsAtMs - (Number(api?.endsAtMs) || 0) >= PAGE_LEADS_BY_MS;
}

/**
 * A page report as FactionOps sends it, checked: { count, endsAtMs }, or
 * null. `count` is a whole count from 1 to 100,000. `endsAt` is Torn's own
 * end, in epoch seconds, with no device clock in it, and when it is sent it
 * stands alone; else `left` is the seconds the page's clock shows, counted
 * from `nowMs`. Only a running clock, of at most PAGE_REPORT_MAX_LEFT_S, is
 * a report.
 */
export function parsePageReport(body, nowMs) {
  if (!body || typeof body !== "object") return null;
  const count = Number(body.count);
  if (!Number.isInteger(count) || count < 1 || count > PAGE_REPORT_MAX_COUNT) return null;
  const endsAtMs = body.endsAt != null ? Number(body.endsAt) * 1000 : nowMs + Number(body.left) * 1000;
  if (!(endsAtMs > nowMs && endsAtMs <= nowMs + PAGE_REPORT_MAX_LEFT_S * 1000)) return null;
  return { count, endsAtMs };
}

/**
 * True when `playerId` is on the war's roster, `war.ourMemberIds`: Torn's
 * own list of the faction's members, which war-status-monitor.js refreshes
 * every 10 minutes while a war is set. Only those members' page reports are
 * taken. A FactionOps sign-in outlives a member's time in the faction, so a
 * member who has left still holds a token for it, and the chain their page
 * shows is their new faction's. With no roster, no one is on it.
 */
export function onWarRoster(war, playerId) {
  const roster = Array.isArray(war?.ourMemberIds) ? war.ourMemberIds : [];
  return playerId != null && roster.includes(String(playerId));
}
