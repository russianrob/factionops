// How a faction behaves during a war, rather than at rest.
//
// /prewar originally ranked declare times off a faction's BASELINE activity
// curve. Checked against war 49287 that turned out to be a poor guide: both
// factions ran far above their baselines once fighting started, the predicted
// best hour (07:00, +10pp at baseline) was +4pp in the war, and the actual
// best hour (09:00, +18pp) was nowhere in the baseline's top five.
//
// And the premise was weaker still: Dead Fragment was out-covered in 26 of
// the war's 34 hours and won 23,048 to 7,923. `active_ratio` counts presence,
// not damage. So nothing here predicts a winner — it describes a SHAPE. How
// hard does this faction start, and do they hold it? That is the question a
// 13-hour blowout record cannot answer on its own.

/**
 * Peak, mean and fade across a war's hourly buckets.
 *
 * `fade` is the last third's mean minus the first third's: negative means
 * they spiked and faded, positive means they built. Null when the war is too
 * short to divide — inventing a trend from two points is how a scouting page
 * starts lying.
 *
 * Empty input yields nulls rather than zeroes. Zero reads as "they were
 * dead"; null reads as "we have no data", which is the honest answer when
 * FFScouter holds nothing for that window.
 */
export function warWindowStats(buckets) {
  const rs = (buckets || [])
    .map((b) => Number(b && b.active_ratio))
    .filter((n) => Number.isFinite(n));

  // An entirely empty window is not a faction that sat out a ranked war for
  // thirteen straight hours — it is the tracker having nothing. FFScouter does
  // not refuse windows from before it began collecting; it returns them fully
  // bucketed with every ratio at zero, which reads as "dead" unless it is
  // called out. War 36602 (Feb 2026) came back 13 buckets all zero while the
  // April war returned real numbers.
  const anyData = rs.some((n) => n > 0);
  if (!rs.length || !anyData) {
    return {
      hours: rs.length, peak: null, mean: null,
      firstThird: null, lastThird: null, fade: null,
      untracked: rs.length > 0,
    };
  }

  const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
  const peak = Math.max(...rs);

  // Three buckets is the minimum that splits into thirds with one each.
  if (rs.length < 3) {
    return { hours: rs.length, peak, mean: mean(rs), firstThird: null, lastThird: null, fade: null, untracked: false };
  }

  const cut = Math.floor(rs.length / 3);
  const first = mean(rs.slice(0, cut));
  const last = mean(rs.slice(rs.length - cut));

  return {
    hours: rs.length,
    peak,
    mean: mean(rs),
    firstThird: first,
    lastThird: last,
    fade: last - first,
    untracked: false,
  };
}

/**
 * Points per hour.
 *
 * A 23,503 blowout over 27 hours and a 7,923 loss over 34 are not comparable
 * as totals; per hour they are.
 */
export function scoreRate(score, hours) {
  const h = Number(hours);
  if (!Number.isFinite(h) || h <= 0) return null;
  return (Number(score) || 0) / h;
}

/**
 * One ranked war, read from the scouted faction's side.
 *
 * The opponent's score travels with it deliberately. Four wins against
 * factions that scored 7, 362, 874 and 6,799 is not the same as four wins,
 * and without the opponent's number a record flatters everybody.
 */
export function summariseWar(war, factionId, buckets) {
  const fid = Number(factionId);
  const sides = Array.isArray(war.factions) ? war.factions : [];
  const me = sides.find((f) => Number(f.id) === fid) || {};
  const them = sides.find((f) => Number(f.id) !== fid) || {};

  const start = Number(war.start) || 0;
  const end = Number(war.end) || 0;
  // A war still running has no duration yet, and anything divided by it would
  // be nonsense rather than merely wrong.
  const ongoing = !end;
  const hours = ongoing || !start ? null : (end - start) / 3600;

  const score = Number(me.score) || 0;
  const opponentScore = Number(them.score) || 0;

  return {
    warId: war.id,
    start, end, ongoing, hours,
    opponentId: them.id ?? null,
    opponentName: them.name || "",
    score,
    opponentScore,
    margin: score - opponentScore,
    target: Number(war.target) || 0,
    won: Number(war.winner) === fid,
    scoreRate: scoreRate(score, hours),
    activity: warWindowStats(buckets),
  };
}
