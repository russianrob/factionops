// Reading an FFScouter flight record.
//
// Lifted out of the fetch loop in routes.js so the batch endpoint could be
// adopted safely. The two endpoints return different amounts of the same
// thing:
//
//   /player-flights?target=      → { current, recent_flights }
//   /player-flights/batch?targets= → { flights: [{ player_id, current }] }
//
// Batch carries no `recent_flights`, and `recent_flights` is the only thing
// that separates "landed abroad" from "back home" when `current` is null. So
// batch answers everyone in transit — the time-critical case, and the common
// one during a war — and only the stationary remainder needs a second call.

/** FFScouter writes "Traveling from {origin} to {destination}". */
const ROUTE = /from\s+(.+?)\s+to\s+(.+?)\s*$/i;
const isTorn = (s) => /^torn$/i.test(String(s || "").trim());

function route(description) {
  const m = String(description || "").match(ROUTE);
  if (!m) return null;
  return { origin: m[1].trim(), dest: m[2].trim() };
}

/**
 * Whether this player still needs the single-target endpoint.
 *
 * True only when they are not in transit, because that is the one case whose
 * answer lives in `recent_flights`.
 */
export function needsRecentFlights(current) {
  return !current;
}

/**
 * One flight record → what factionops and the OC delay tracker actually use.
 *
 * @param current   the `current` object, or null when not in transit
 * @param recents   `recent_flights`, newest first; may be empty for a batch
 *                  response, which is why the null-current path degrades to
 *                  "home" rather than guessing
 */
export function parseFlight(current, recents) {
  const history = Array.isArray(recents) ? recents : [];

  if (current) {
    const r = route(current.status_description);
    // A description we cannot parse yields no destination rather than a
    // throw: FFScouter's wording is not a contract, and a poller that dies on
    // it takes every other target down with it.
    const returning = r ? isTorn(r.dest) : false;
    const destination = r ? (returning ? r.origin : r.dest) : "";

    // Landing is a range, and which end to trust depends on the travel book.
    // With one confirmed, take that bound; with neither, split the difference
    // — arriving before the target lands wastes the trip, so the midpoint is
    // the least bad guess.
    const earliest = Number(current.earliest_arrival_time) || 0;
    const latest = Number(current.latest_arrival_time) || 0;
    let landingAt;
    if (current.book_likely_being_used === true && earliest > 0) landingAt = earliest;
    else if (current.book_likely_being_used === false && latest > 0) landingAt = latest;
    else if (earliest > 0 && latest > 0) landingAt = Math.floor((earliest + latest) / 2);
    else landingAt = latest || earliest || 0;

    // OC delay asks when they left TORN. On the way home that is the previous
    // flight's takeoff, not this one's.
    const outboundTakeoff = returning
      ? (Number(history[0]?.takeoff_time) || Number(current.takeoff_time) || 0)
      : (Number(current.takeoff_time) || 0);

    return {
      takeoffTime: outboundTakeoff * 1000,
      landingAt,
      destination,
      returning,
      method: current.travel_method || "",
    };
  }

  // Not in transit. Either they landed abroad and have not started back, or
  // they are home. The last flight's direction is the only evidence.
  const last = history[0] || {};
  const r = route(last.status_description);
  const wentOut = r && isTorn(r.origin) && !isTorn(r.dest);
  if (wentOut) {
    return {
      takeoffTime: (Number(last.takeoff_time) || 0) * 1000,
      landingAt: 0,              // already there; nothing to count down to
      destination: r.dest,
      returning: false,
      method: last.travel_method || "",
    };
  }
  // No history reaches here too, and is deliberately treated as home: putting
  // a country on a war row with no evidence for it is the worse error.
  return { takeoffTime: 0, landingAt: 0, destination: "", returning: false, method: "" };
}
