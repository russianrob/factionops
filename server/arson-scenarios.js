/// Folding an approved arson crime log into the ledger's scenarios list.
///
/// Approval used to write a parallel record to arson-overrides.json, which the
/// ledger merged over arsonists-ledger-scenarios.json at runtime. The two record
/// shapes are identical — {scenarioName, payout, actions} either way — so the
/// merge bought nothing except a second file to keep in step.
///
/// No history / revert by design: a wrong approval is corrected by submitting a
/// new log with the right numbers and approving that, which overwrites. Storing
/// previous values would be a second mechanism for something already possible,
/// carried in a file every client downloads on every page load.

/// Insert or replace a scenario, returning a NEW list.
///
/// Matching is case-insensitive because the two datasets disagree: ledger
/// records are mixed-case ("A Black Mark") while override keys were lowercased.
/// An exact match would miss every existing record and silently append
/// duplicates alongside the originals, leaving the ledger to pick whichever it
/// saw first.
export function upsertScenario(list, { scenarioName, payout, actions }) {
  const out = Array.isArray(list) ? list.slice() : [];
  const wanted = String(scenarioName || "").trim().toLowerCase();
  const idx = out.findIndex(
    (s) => String(s && s.scenarioName || "").trim().toLowerCase() === wanted
  );

  const next = {
    payout: Number(payout) || 0,
    // Replaced wholesale, not merged: an approval describes the full recipe, so
    // merging would strand actions the new log deliberately dropped.
    actions: (actions && typeof actions === "object") ? actions : {},
  };

  if (idx === -1) {
    out.push({ scenarioName, ...next });
    return out;
  }

  // Copy the record rather than editing in place — callers pass the loaded file
  // and must be able to compare before/after.
  // Keeps the EXISTING casing: the ledger displays this name, and rewriting
  // "A Black Mark" to "a black mark" because that is how the log arrived would
  // be a visible regression.
  out[idx] = { ...out[idx], ...next };
  return out;
}
