/// Overnight quiet window for the personal events/hospital watcher.
///
/// The watcher polls every 45s on the player's OWN key, which exhausts Torn's
/// daily read cap by ~04:00 and leaves attack and hospital alerts dead for the
/// rest of the day. Overnight polling buys nothing — the player is asleep — so
/// skipping it both preserves the budget for waking hours and stops 3am pushes.

/// Local hour in a named zone, DST included.
///
/// Deliberately a zone and not a fixed offset. The player says "EST", but they
/// are on EDT for half the year; a hardcoded -05:00 would slide the window by an
/// hour every spring and autumn — quietly, and in the direction that matters
/// least to notice and most to debug.
function hourIn(date, timeZone) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone, hour: "numeric", hour12: false,
  }).formatToParts(date);
  const h = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  // Intl can render midnight as 24 under hour12:false.
  return h === 24 ? 0 : h;
}

/// Whether polling should be skipped at this instant.
///
/// `startHour` is inclusive, `endHour` exclusive, so 22-6 means the last poll is
/// at 21:59 and polling resumes exactly at 06:00. Windows that wrap midnight are
/// the normal case here and are handled explicitly; equal bounds mean NO quiet
/// time rather than a full day, because "from 3 to 3" silencing everything
/// forever is never what someone meant.
export function isQuietHour(date, { startHour, endHour, timeZone, enabled = true } = {}) {
  if (!enabled) return false;
  if (startHour === endHour) return false;
  const h = hourIn(date, timeZone);
  return startHour < endHour
    ? (h >= startHour && h < endHour)      // same-day window
    : (h >= startHour || h < endHour);     // wraps midnight
}
