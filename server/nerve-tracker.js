// Natural Nerve Bar (NNB) tracking for the CE-per-Nerve userscript.
//
// Criminal Experience is a hidden stat: Torn exposes no CE figure and fires no
// event. It only shows the RESULT — your nerve maximum steps up by 5 as CE
// crosses a threshold. So an increase is detected by watching nerve.maximum.
//
// The complication is that perks also raise maximum nerve, and a perk jump is
// NOT CE progress. Watching the raw maximum cannot tell "+10 from two CE steps"
// apart from "+10 from a new perk" — the numbers are identical. But Torn lists
// perks as text ("+ 30 maximum nerve"), so the perk total can be SUBTRACTED
// and the remaining base watched instead. Any rise in the base is then
// unambiguously CE, and the userscript's manual "faction offset" becomes a
// fallback rather than a requirement.
//
// Pure helpers so the rules are testable without hitting Torn; routes.js does
// the fetching and persistence.

/**
 * Total "+ N maximum nerve" across every perk group (faction, job, property,
 * merit, education…). Deliberately requires the words "maximum nerve" so
 * "+ 50% nerve gain from alcohol" — which sits right beside it — is ignored.
 */
export function parseMaxNervePerks(perks) {
  let total = 0;
  for (const group of Object.values(perks || {})) {
    if (!Array.isArray(group)) continue;
    for (const line of group) {
      const m = String(line).match(/\+\s*(\d+)\s*maximum nerve/i);
      if (m) total += parseInt(m[1], 10);
    }
  }
  return total;
}

/**
 * Fold a fresh BASE nerve reading (max minus perks) into stored state.
 * Returns { state, increased }; `increased` is true only on a genuine CE step.
 */
export function applyNerveReading(prev, baseNerve, nowSec) {
  const state = { ...(prev || {}) };
  const base = Number(baseNerve);
  // Junk must never move the baseline, or the next real increase is measured
  // against a lie and the reported figure is silently wrong forever.
  if (typeof baseNerve !== "number" || !Number.isFinite(base) || base <= 0) {
    return { state, increased: false };
  }

  const last = Number(state.lastSeenBase);
  state.lastSeenBase = base;

  if (!Number.isFinite(last) || last <= 0) return { state, increased: false }; // first sight
  if (base <= last) return { state, increased: false };                        // never counts down

  state.lastNNBIncreaseAt = nowSec;
  return { state, increased: true };
}

/** Shape the payload the userscript expects from GET /api/nerve-tracker. */
export function buildResponse(state, nerveMax, perkNerve) {
  const s = state || {};
  const max = Number(nerveMax) || 0;
  // Prefer the perk total read from Torn; fall back to the manually-entered
  // offset only when perks couldn't be fetched.
  // Explicit null/undefined check: Number(null) is 0, which is finite, so a
  // plain isFinite test would silently treat 'perks unavailable' as 'no perks'
  // and overstate the base NNB by the whole perk total.
  const havePerks = perkNerve != null && Number.isFinite(Number(perkNerve));
  const offset = havePerks ? Number(perkNerve) : (Number(s.factionOffset) || 0);
  return {
    nerveMax: max,
    baseNNB: Math.max(0, max - offset),
    factionOffset: offset,
    lastNNBIncreaseAt: Number(s.lastNNBIncreaseAt) || null,
  };
}
