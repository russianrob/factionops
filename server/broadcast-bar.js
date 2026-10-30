// The admin broadcast bar's server side (FactionOps' 📣 on the war page).
//
// A broadcast still goes out the way /api/broadcast always sent it: Socket.IO,
// SSE, the poll queue and push. This module adds what the bar needs on top:
// the text cleaned and capped, the faction's quick picks, and each war's
// latest broadcast, kept so a Torn page that was not connected when it went
// out can ask for it when it loads.

// The bar holds one line of a phone's width or a little more, and the war
// page's box has always stopped at 150.
export const BROADCAST_MAX_LEN = 150;
export const BROADCAST_MAX_PICKS = 12;
// How long a broadcast stays up: 10 minutes from sending, or until tapped.
// This is longer than pending-broadcasts.js's 5-minute queue on purpose: the
// queue is what the polls hand out, and the page-load ask covers the rest of
// the 10 minutes. Neither should be "fixed" to match the other.
export const BROADCAST_HOLD_MS = 10 * 60 * 1000;
// What a faction's box offers until an admin saves a list of its own.
export const DEFAULT_BROADCAST_PICKS = Object.freeze(["Let chain die", "Good work all!", "Hold hits", "Hit now"]);

// The text as the bar shows it: trimmed, with every run of spaces and
// newlines as one space. Null when nothing is left or it runs over 150.
export function cleanBroadcastText(s) {
  const text = String(s ?? "").trim().replace(/\s+/g, " ");
  return text && text.length <= BROADCAST_MAX_LEN ? text : null;
}

// Whether a faction position is one of the faction's broadcast roles. Torn's
// wording is not ours to control, so case and padding do not matter. An
// empty position (a key whose scope returned no faction) holds none.
export function holdsBroadcastRole(position, roles) {
  const pos = String(position || "").trim().toLowerCase();
  return !!pos && (roles || []).some((r) => String(r).trim().toLowerCase() === pos);
}

// The faction's quick picks. A list the admins saved stands even when they
// emptied it; a faction that never saved one gets the defaults. Always a
// copy, so a caller can change it freely.
export function picksFromSettings(settings) {
  const saved = settings && settings.broadcastPicks;
  return Array.isArray(saved) ? saved.slice() : DEFAULT_BROADCAST_PICKS.slice();
}

// The + in the box: the cleaned text at the end of the list. One already
// there, in any case of letters, leaves the list as it was.
export function addPick(picks, text) {
  const pick = cleanBroadcastText(text);
  if (!pick) return { error: "A quick pick is 1 to 150 characters." };
  if (picks.some((p) => String(p).toLowerCase() === pick.toLowerCase())) return { picks: picks.slice() };
  if (picks.length >= BROADCAST_MAX_PICKS) return { error: "Up to 12 quick picks: remove one first." };
  return { picks: [...picks, pick] };
}

// The × on a pick.
export function removePick(picks, text) {
  const pick = cleanBroadcastText(text);
  return picks.filter((p) => p !== pick);
}

// Each war's latest broadcast, by war id. In memory only: a restart loses
// at most 10 minutes of it, and the bar it would feed is gone by then.
const latest = new Map();

export function rememberBroadcast(warId, payload) {
  latest.set(String(warId), payload);
}

// The war's latest broadcast with its age in ms, by this server's clock, so
// a device whose clock is off can still work out how long it has left.
// Null from 10 minutes on.
export function latestBroadcast(warId, now) {
  const b = latest.get(String(warId));
  if (!b) return null;
  const age = Math.max(0, now - b.ts);
  if (age >= BROADCAST_HOLD_MS) {
    latest.delete(String(warId));
    return null;
  }
  return { ...b, age };
}

// The page-load ask's answer for one member. A FactionOps sign-in outlives a
// member's time in the faction, so where the war's roster is known, a member
// who is not on it gets nothing. With no roster known yet (war-status-monitor
// fills it while a war is set), a member signed in to the faction gets it.
export function latestBroadcastFor(warId, war, playerId, now) {
  const roster = Array.isArray(war && war.ourMemberIds) ? war.ourMemberIds : [];
  if (roster.length && !roster.includes(String(playerId))) return null;
  return latestBroadcast(warId, now);
}
