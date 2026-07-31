# Personal Notifications — Design

**Goal:** Notify the owner about things that happen to *them* in Torn — every
event in their Torn events feed, plus a one-minute warning before they land
from a flight or leave hospital.

**Approved:** 2026-07-31.

## The split, and why

Two halves with different mechanisms, because the two problems are different:

| | Flight / hospital | Torn events |
|---|---|---|
| Nature | **Predictable** — the deadline is known in advance | **Unpredictable** — the outside world acting |
| Mechanism | Local `UNTimeIntervalNotificationTrigger` | Server poll + APNs push |
| Works app-closed | Yes — iOS holds the timer | Yes — server is awake |
| Cost | Zero | ~1.3 API calls/min on the user's OWN key |

An app-local design cannot cover events: warboard declares only the
`remote-notification` background mode and has no `BGTaskScheduler`, so once iOS
suspends it, it cannot poll. Background fetch would deliver "you were attacked"
15–60 minutes late, which is worse than useless during a war.

Conversely, push is the wrong tool for the timers: a local notification fires
with no signal and no valid push token, and costs nothing.

## Half 1 — flight + hospital (iOS, local)

Extend the existing `BarNotificationScheduler`, which already schedules
energy/nerve/cooldown alerts that fire with the app closed.

- `warboard.travel.landing` — fires at `travelSecondsLeft - 60`, only when
  `statusState == "Traveling"` and more than 60s remain.
- `warboard.hospital.out` — fires at `statusSecondsLeft - 60`, only when
  `statusState == "Hospital"` and more than 60s remain.

`DashboardSnapshot` already carries `travelSecondsLeft`, `statusState` and
`statusSecondsLeft`; no new fetch. Stable identifiers mean every poll and
foreground reschedules cleanly — so a hospital time extended by a revive or
ipecac silently corrects instead of firing early. Two new prefs
(`notifyFlight`, `notifyHospital`) with Settings toggles, defaulting ON.

## Half 2 — all Torn events (server, native push)

New `personal-watcher.js`:

- Polls `user/?selections=events` with the player's **own stored key** every 45s.
- Strips Torn's (malformed) HTML to plain text, drops the trailing `[view]`
  link artifact: `RedGang attacked you`.
- Dedupes on the event's opaque id.
- **No backfill blast:** on first run every event currently in the feed is
  marked seen; only genuinely new events alert.
- **Burst guard:** more than 5 new events in one poll collapses into a single
  summary notification. Nothing is lost, the lock screen is not carpet-bombed.
- One notification type, `torn_event`, toggleable on `/notifications`.
  Deliberately not pre-split into attacked/money/items (YAGNI) — the owner
  asked for all events with the event's own wording.

**Delivery is native-app only.** `sendToPlayer` normally fans out to web push,
FCM and APNs; this type skips the web-push channel so the alert arrives as a
warboard app banner with no duplicate browser notification.

## Failure behaviour

- No stored key for a player, or a revoked key → that player is skipped and
  logged; the watcher keeps running for everyone else.
- Torn API error → skip the cycle, keep the last seen-set, retry next tick.
  Never mark events seen on a failed fetch, or they would be silently dropped.
- Seen-ids persist to disk so a server restart does not re-alert or blast.

## Out of scope

Faction-wide opt-in (the polling model already supports it — each member uses
their own key — but it ships for the owner first), and per-category muting.
