// Pure helpers for the personal Torn-events watcher. Kept free of I/O so the
// selection and formatting rules are unit-testable; personal-watcher.js does
// the polling, persistence and pushing.

// Cap the remembered id set so a long-running process doesn't grow forever.
// Torn's feed returns far fewer than this per poll, so recent ids always
// survive the trim.
const SEEN_CAP = 1000;

// More than this many new events in a single cycle collapses to one summary.
// A war can produce a burst; the owner asked for every event, not for their
// lock screen to be unusable.
const BURST_CAP = 5;

/**
 * Torn's events feed returns HTML whose href attributes are malformed but
 * whose anchor text is clean, so tag-stripping yields a readable sentence:
 *   '<a href=...>RedGang</a> attacked you [<a href=...>view</a>]'
 *   -> 'RedGang attacked you'
 */
export function stripEventHtml(html) {
  if (html == null) return "";
  return String(html)
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    // Torn appends a "[view]" link to most events; it is meaningless once the
    // markup is gone. Anchored to the END so a legitimate mid-sentence "view"
    // is untouched.
    .replace(/\s*\[\s*view\s*\]\s*$/i, "")
    .trim();
}

/**
 * Split the feed into events worth alerting on, plus the updated seen-set.
 *
 * `firstRun` marks the whole current feed as seen without alerting — enabling
 * the feature must not replay the backlog. Returns events oldest-first so a
 * burst is delivered in the order it actually happened.
 */
export function pickNewEvents(events, seenIds, firstRun) {
  const seen = new Set(seenIds || []);
  const entries = Object.entries(events || {});
  const sorted = entries
    .map(([id, e]) => ({ id, timestamp: Number(e?.timestamp) || 0, event: e?.event }))
    .sort((a, b) => a.timestamp - b.timestamp);

  const fresh = firstRun ? [] : sorted.filter((e) => !seen.has(e.id));
  for (const e of sorted) seen.add(e.id);

  // Trim oldest-added first. Set preserves insertion order, and the current
  // feed was just re-added above, so recent ids are at the end and survive.
  if (seen.size > SEEN_CAP) {
    const keep = [...seen].slice(-SEEN_CAP);
    return { fresh, seen: new Set(keep) };
  }
  return { fresh, seen };
}

/**
 * Shape events into notification payloads. Below the burst cap each event gets
 * its own banner carrying the event's own wording; above it, one summary.
 */
export function buildNotifications(fresh) {
  if (!fresh || !fresh.length) return [];
  if (fresh.length > BURST_CAP) {
    const latest = stripEventHtml(fresh[fresh.length - 1].event);
    return [{
      title: `Torn: ${fresh.length} new events`,
      body: latest ? `Latest: ${latest}` : "Open Torn to catch up.",
      tag: "torn-event-burst",
    }];
  }
  return fresh.map((e) => ({
    title: "Torn",
    body: stripEventHtml(e.event) || "New event",
    tag: `torn-event-${e.id}`,
  }));
}
