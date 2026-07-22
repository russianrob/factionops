// ═══════════════════════════════════════════════════════════════════════════
//  SERVER-SIDE FLYER-DELAY COMPLETION POLLER
// ═══════════════════════════════════════════════════════════════════════════
//
// Problem this solves
// -------------------
// A "flyer delay" = a crew member who flew abroad while their OC was ready to
// execute, holding up the whole crew. Clients observe this and POST it to
// /api/oc/flyer-delay, where it sits as a PENDING entry keyed by
// (factionId → crimeId::memberId). The delay only becomes permanent when the
// crime completes and collectOcHistory() bakes the pending observation into
// the faction's OC history file.
//
// The catch: collectOcHistory() runs ONLY when a client fetches OC data (the
// /api/oc/spawn-key handler). If the OC completes while nobody has the oc-spawn
// panel open, the completion is never collected and the delay is lost — it
// falls into the gap between "in-flight" (pending, expires) and "baked to
// history" (never happens). Real-world case: a member flew, delayed an OC for
// ~4 hours, then came home; the OC completed minutes later while no client was
// watching, so the delay showed up nowhere on the delays leaderboard.
//
// This poller removes the dependency on a client being present at the right
// moment: on a timer it fetches OC data server-side for any faction that has
// pending flyer-delay observations, which detects the completion and bakes the
// delay via the same collectOcHistory() path clients use. When no faction has
// pending delays it does nothing, so it costs zero API calls in the common case.
//
// Everything it touches is dependency-injected (see createFlyerDelayPoller)
// so it unit-tests with fakes — no live Torn API, no disk, no timers.

/**
 * Returns the faction IDs that currently have at least one pending flyer-delay
 * observation and therefore warrant a server-side OC poll. Factions whose
 * sub-map is empty (transient state after all their entries baked/pruned) are
 * skipped so we never poll a faction with nothing pending.
 *
 * @param {Map<string, Map>} flyerDelays  the live _flyerDelays store
 * @returns {string[]} faction IDs (as strings) needing a poll
 */
export function flyerDelayFactionsNeedingPoll(flyerDelays) {
  const out = [];
  for (const [fid, m] of flyerDelays) {
    if (m && m.size > 0) out.push(String(fid));
  }
  return out;
}

/**
 * Builds the poller. All collaborators are injected so the poller carries no
 * hidden coupling to routes.js internals and stays testable.
 *
 * @param {object} deps
 * @param {Map<string, Map>} deps.flyerDelays          the live _flyerDelays store
 * @param {(fid:string)=>string|null} deps.getKey      resolves a Torn API key for a faction (faction key → pool key)
 * @param {(fid:string, key:string)=>Promise<object>} deps.getOcSpawnData   fetches OC data + refreshes the completed-crimes cache
 * @param {(fid:string)=>Array} deps.getCachedCompletedCrimes               reads the just-refreshed completed-crimes cache
 * @param {(fid:string, data:object)=>void} deps.collectOcHistory           bakes completed crimes (and pending delays) into history
 * @param {(fid:string)=>void} [deps.pruneFlyerDelays] drops orphaned pending entries (cancelled OCs) past their TTL
 * @param {(msg:string)=>void} [deps.log]              progress/error logger
 * @returns {{ tick: ()=>Promise<void> }}
 */
export function createFlyerDelayPoller(deps) {
  const {
    flyerDelays,
    getKey,
    getOcSpawnData,
    getCachedCompletedCrimes,
    collectOcHistory,
    pruneFlyerDelays,
    log = () => {},
  } = deps;

  let running = false; // guard against overlapping ticks if a fetch runs long

  async function tick() {
    if (running) return;
    running = true;
    try {
      const fids = flyerDelayFactionsNeedingPoll(flyerDelays);
      for (const fid of fids) {
        try {
          // Drop orphaned pending entries (OCs that were cancelled and will
          // never complete) so we stop polling dead factions. Real completions
          // are handled below by the bake, not by this prune.
          if (typeof pruneFlyerDelays === "function") pruneFlyerDelays(fid);
          const m = flyerDelays.get(fid) || flyerDelays.get(String(fid));
          if (!m || m.size === 0) continue; // everything pruned away — nothing to poll for

          const key = getKey(fid);
          if (!key) { log(`[flyer-poll] no API key for faction ${fid} — skipping`); continue; }

          // getOcSpawnData refreshes the completed-crimes cache (it force-
          // invalidates when an available OC just disappeared, i.e. completed).
          const data = await getOcSpawnData(fid, key);
          const completed = getCachedCompletedCrimes(fid) || [];
          if (completed.length) {
            // Same bake path clients use; collectOcHistory dedupes by crimeId
            // (shared _seenCrimeIds) so this never double-logs.
            collectOcHistory(fid, { crimes: completed, members: (data && data.members) || {} });
          }
        } catch (e) {
          log(`[flyer-poll] faction ${fid} error: ${e && e.message}`);
        }
      }
    } finally {
      running = false;
    }
  }

  return { tick };
}
