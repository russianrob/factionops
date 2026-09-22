// A target sheet: who does a faction's damage, and how hard each of them is.
//
// Scout could say WHEN to declare and nothing about WHO you would be fighting.
// Two sources fix that, both readable for any faction:
//
//   Torn v2 /faction/rankedwarreport  → per-member score, attacks, level
//   FFScouter /get-stats              → estimated battle stats, fair fight,
//                                       stat distribution, spies (205 per call)
//
// The join needs judgement rather than a sort, because SCORE ALONE IS A BAD
// THREAT SIGNAL. Measured on The Rifle Medics vs Arcadia Rising: Joshi was
// their second-highest scorer on 4.38 MILLION estimated stats with a fair
// fight of 1.14, and Lykiri scored 690 on 1.07m. Neither was fighting anybody
// — they were farming something soft. Eddiz, on 2.83 BILLION and FF 4.34, is
// the one who would actually hurt you, and sat fourth on the scoreboard.
//
// So the sheet answers two questions separately: who hurts us, and who is
// scoring off targets we could deny them.

/** Middle value, ignoring anything that is not a finite number. */
export function median(values) {
  // null and "" must be dropped BEFORE Number(), because Number(null) is 0,
  // not NaN. Leaving them in lets every absent estimate vote as a zero and
  // drags the middle down — which then promotes half the roster to "heavy".
  const ns = (values || [])
    .filter((v) => v != null && v !== "")
    .map(Number)
    .filter((n) => Number.isFinite(n))
    .sort((a, b) => a - b);
  if (!ns.length) return null;
  const mid = ns.length >> 1;
  return ns.length % 2 ? ns[mid] : (ns[mid - 1] + ns[mid]) / 2;
}

/** The share of total score made by the top `n` scorers, or null if nobody scored. */
export function concentration(rows, n = 5) {
  const scores = (rows || []).map((r) => Number(r.score) || 0).sort((a, b) => b - a);
  const total = scores.reduce((a, b) => a + b, 0);
  if (!total) return null;
  return scores.slice(0, n).reduce((a, b) => a + b, 0) / total;
}

// How far from the roster's middle a member has to sit to be called heavy or
// light. Relative rather than absolute because factions differ by orders of
// magnitude, and an absolute cut would label every member of a strong faction
// a threat and every member of a weak one safe.
const HEAVY_MULTIPLE = 2;
const LIGHT_DIVISOR = 2;

/** Score high enough to be worth denying, as a fraction of the roster ranked by score. */
const PRODUCTIVE_TOP_FRACTION = 1 / 3;

/**
 * Join, band and sort a war roster.
 *
 * @param members     [{ id, name, level, score, attacks, bs, ff, distribution }]
 * @param currentIds  optional Set of ids still in the faction. Supplying it
 *                    drops anybody who has left — a sheet that sends a caller
 *                    at somebody who is no longer there is worse than a short
 *                    sheet.
 */
export function classifyRoster(members, { currentIds = null } = {}) {
  const all = Array.isArray(members) ? members : [];
  const present = currentIds ? all.filter((x) => currentIds.has(x.id)) : all;
  const departed = all.length - present.length;

  const medianBs = median(present.map((x) => x.bs));

  // The score above which a member counts as productive. Taken from the
  // present roster so a departed top scorer cannot raise the bar for everyone.
  const byScore = present.map((x) => Number(x.score) || 0).sort((a, b) => b - a);
  const cutIndex = Math.max(0, Math.ceil(byScore.length * PRODUCTIVE_TOP_FRACTION) - 1);
  const productiveFrom = byScore.length ? byScore[cutIndex] : Infinity;

  const rows = present.map((x) => {
    // Same trap: Number(null) === 0, so a member with no estimate would come
    // through as zero stats and band as "light" — reading as safe to hit.
    const bs = (x.bs != null && Number.isFinite(Number(x.bs))) ? Number(x.bs) : null;
    const attacks = Number(x.attacks) || 0;
    const score = Number(x.score) || 0;

    // Unknown is its own band, never "light". Absent data must not read as
    // "safe to hit" — that is the one misreading here with a cost attached.
    let band = "unknown";
    if (bs != null && medianBs) {
      if (bs >= medianBs * HEAVY_MULTIPLE) band = "heavy";
      else if (bs <= medianBs / LIGHT_DIVISOR) band = "light";
      else band = "mid";
    }

    return {
      id: x.id,
      name: x.name,
      level: x.level ?? null,
      score,
      attacks,
      // Productivity per hit. Guarded because a member with no attacks would
      // otherwise divide by zero and sort as Infinity.
      spa: attacks > 0 ? score / attacks : null,
      bs,
      bsHuman: x.bsHuman || null,
      ff: (x.ff != null && Number.isFinite(Number(x.ff))) ? Number(x.ff) : null,
      distribution: x.distribution || null,
      band,
      // Soft AND productive: they will keep scoring unless denied. Being weak
      // on its own is not interesting; being weak and near the top is.
      farming: band === "light" && score >= productiveFrom,
    };
  });

  // Hardest first, because the sheet's first question is who will hurt us.
  // Unknowns sort last rather than floating up on a null comparison.
  rows.sort((a, b) => {
    if (a.bs == null && b.bs == null) return b.score - a.score;
    if (a.bs == null) return 1;
    if (b.bs == null) return -1;
    return b.bs - a.bs;
  });

  return {
    rows,
    medianBs,
    departed,
    concentration: concentration(present, 5),
    counts: {
      heavy: rows.filter((r) => r.band === "heavy").length,
      light: rows.filter((r) => r.band === "light").length,
      unknown: rows.filter((r) => r.band === "unknown").length,
      farming: rows.filter((r) => r.farming).length,
    },
  };
}
