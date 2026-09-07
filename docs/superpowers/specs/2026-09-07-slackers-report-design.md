# Slackers Report — Design

**Date:** 2026-09-07
**Status:** built and live at `/slackers` (2026-09-07)
**Owner:** RussianRob [137558], faction 42055 (Dead Fragment)

## Goal

A leadership-only page that ranks every eligible faction member by their
contribution over the last 90 days across four axes — war hits, chain hits,
Xanax, gym energy — so leadership can open an expectations conversation with a
member holding the actual numbers rather than an impression.

Members with fewer than 100 days in the faction are excluded by default: a
recent joiner has been present for fewer wars and comparing their totals to a
two-year veteran's measures tenure, not effort.

## Why most of this is already on disk

Three of the four metrics come out of `server/data/war-history/42055.json`,
which already stores a per-member row for every ranked war:

```json
{ "playerId":"2573457", "name":"Bloodrein", "level":53,
  "warHits":66, "totalAttacks":67,
  "breakdown":{"war_hit":62,"assist":4,"failed":1,"retal":0,"turtle":0,
               "non_war":0,"overseas_war":0},
  "xanaxTaken":3, "xanaxDeficit":0, "xanaxFlagged":false,
  "overdosedThisWar":0 }
```

- **War hits** — `warHits`.
- **Chain hits** — `breakdown.non_war`: attacks made during the war period that
  were not ranked-war hits, i.e. chain building. This is the same number the
  factionops payout section shows, and it is what the owner means by "chain
  hits". Classified in `war-payouts.js` at the `atk.ranked_war !== 1` branch.
- **Xanax** — `xanaxTaken`, war periods only, the same figure `/xanax` reports.

No new API traffic is needed for any of them.

### Hazard: war-history stores some wars twice

Each war can appear under two keys — once by its real war id (`warKey: "47710"`,
`realWarId: 47710`) and again as an archive snapshot
(`warKey: "archived_42055_38761_1787279169"`, `realWarId: null`). Both carry the
same `warStart`, the same `enemyFactionId` and identical member figures.

Over the trailing 90 days that is **19 entries for 13 real wars**. Summing
naively doubles six wars' worth of hits, chain hits and Xanax for every member
who fought them.

**Dedupe rule:** group by `(enemyFactionId, warStart)`; within a group keep the
entry with a non-null `realWarId`, falling back to the first by `capturedAt`.
The kept entry's `members` array is the record for that war.

## Data sources

| Column | Source | Call | Notes |
|---|---|---|---|
| War hits | `war-history` `listWars`/`getWar` | none | local, through the module's cache |
| Chain hits | `war-history` `breakdown.non_war` | none | local |
| Xanax | `war-history` `xanaxTaken` | none | war periods only |
| Gym energy | `/v2/faction/contributors?stat=gymenergy` | 1/day | cumulative; see below |
| Days in faction | `faction/<id>?selections=basic` (`fetchFactionBasic`) | 1/day + 1/h on demand | `days_in_faction`; the route caches the roster an hour |
| Wars present | derived: member appears in a kept war's `members` | none | fairness denominator |

Two API calls a day in total.

## Gym energy has no history, and never will

`/v2/faction/contributors?stat=gymenergy` returns one row per member —
`{id, username, value, in_faction}` — where `value` is **cumulative energy
spent** in the gym, not points gained (verified live 2026-09-01: a 340-energy
strength session returned `gymenergy 340` alongside `gymstrength 340`). Its
`timestamp` parameter is a cache-buster, not a query. There is no historical
form of this endpoint, so the 90 days already elapsed cannot be recovered.

The column therefore has three states, and always labels which one it is in:

1. **Lifetime average** — fewer than 7 days of snapshot history. Shows
   `value ÷ days_in_faction` as energy/day, labelled "avg since joining".
   Comparable across tenures, but blind to someone who trained hard a year ago
   and has coasted since.
2. **Partial window** — snapshots span 7 to 89 days. Shows
   `latest − oldest_in_window` as a true delta, labelled with the real span
   ("last 34 days"), plus its own energy/day.
3. **Full window** — snapshots span 90 days or more. Shows the true 90-day
   delta. This is the target state and arrives on its own.

Because the snapshot job starts writing on day one, the column upgrades itself
without further work.

**Rejoin resets.** Contributors values are per-membership: a member who leaves
and rejoins starts from zero, which would read as a collapse in training. A
delta smaller than zero between two snapshots means a reset, so that member's
window starts at the first snapshot after the reset and the label says
"since rejoining".

## The 90-day window

- Window = `now − 90 days` to `now`, wars selected on `warStart`.
- **Wars present** = the number of kept wars in the window whose `members` array
  contains the player. A member only appears if they were in the faction at
  capture time, so this is a usable presence count without extra data.
- Per-war rates (`warHits ÷ warsPresent`) are the comparison basis; raw totals
  are shown alongside because a total is what a conversation actually quotes.
- A member eligible by tenure but present in zero wars gets a row with a
  distinct `no-wars` marker rather than a division by zero.

## Flag rule

Computed against the **eligible cohort** (after the tenure cutoff), never
against fixed numbers: a slow war month drags every absolute threshold out of
date, whereas the median moves with the faction's own tempo.

Compute the cohort median for each normalized metric. A member is **flagged**
when they fall below half the median on **two or more** of them.

**Chain hits are shown but never flag** (owner's call, 2026-09-07, after seeing
the first real numbers). They are the non-war attacks made during a war —
keeping the chain alive by hitting whoever is around — and as a measure of
effort they run backwards. In the 2026-09-03 war the four members at the top of
that column had **zero war hits between them** (49, 18, 15 and 9 non-war hits
and nothing aimed at the enemy), while the faction's best hitter sat at 0.4 a
war. Flagging people for being low on it punished the people doing the job. So
the flag rests on `FLAG_METRICS` — war hits, Xanax, energy — while `METRICS`
stays four wide for the columns and the median row. The column earns its place
as context: "0 war hits and 49 non-war hits" is the most useful sentence a
leader can put in front of somebody.

Related: factionops' payout popover has both a "Chain hits" row (`chain_hit`)
and a "Non-war hits" row (`non_war`). The first is **empty in every archived
war** — Torn returns those attacks with `ranked_war ≠ 1`, so they all land in
`non_war`. What this report calls chain hits is the popover's Non-war hits.

**Carrying the war is immunity.** A member above the cohort median on war
hits is never flagged, whatever the other three columns say. Run against the
real cohort, the rule without this put the faction's best hitter on the list —
54 hits a war against a median of 23, present for 12 of 13 wars — for not chain
hitting and not taking Xanax. War hits are the axis this report exists for and
the other three are how somebody gets there, so they cannot outvote it. Their
low columns are still recorded (the table shades them); they just do not flag.
Added 2026-09-07 after the first live run.

`no-wars` members are flagged unconditionally.

**Zero medians.** If half the faction never chain-hits, the cohort median for
that metric is 0, and "below half of zero" is unreachable — the metric would
silently stop contributing while still counting toward the "two or more". So a
metric whose cohort median is 0 is **dropped from the comparison entirely**, and
the rule reads: below half the median on two or more of the *surviving*
metrics, or on all of them when fewer than two survive. The reasons list names
which metrics were live, so a flag is always explainable.

The rule lives in one exported function in the pure model so it can be swapped
for owner-set thresholds without touching anything else.

## Architecture

Four pieces, following the shapes already in this repo:

### `server/slackers-model.js` — pure

No IO, no clock of its own. Exported functions:

- `dedupeWars(wars)` → the kept war per `(enemyFactionId, warStart)`.
- `warsInWindow(wars, nowMs, windowDays)` → filtered, sorted oldest-first.
- `presenceByPlayer(wars)` → `Map<playerId, warsPresent>`.
- `energyForMember(readings, playerId, daysInFaction, nowMs, windowDays)` →
  `{ mode: "unknown"|"lifetime"|"partial"|"full"|"rejoined", energy, perDay, spanDays }`.
- `median(values)`, `METRICS`, `FLAG_FRACTION`, `FLAG_MIN_METRICS`.
- `buildReport({ wars, roster, readings, nowMs, windowDays, minDays })` →
  `{ rows, medians, liveMetrics, warsCounted, cohortSize, formerMembers, wars, generatedAt }`.
  Flagging happens inside it, so a row arrives already carrying `flagged` and
  `reasons` — there is no second call that could be skipped.

Every number the page shows comes from here, so the page has no arithmetic of
its own to get wrong.

### `server/gym-energy-snapshot.js` — the one poller

Exports `start()`, launched from `server.js` the way `status-la-poller` and
`faction-key-health` are — `import('./gym-energy-snapshot.js').then(m => m.start())`
— which runs once at boot and then on a 24-hour `setInterval`, with a 20-hour
freshness guard so a reload storm cannot fill the file with readings taken
minutes apart. Uses the **owner's own faction key**
(`store.getFactionApiKey(factionId)`), never a rotated pool key: this report
reads how hard every member trains and how much Xanax they took, and gathering
that on a borrowed member key is not the owner's to do (their call,
2026-09-07). It fetches contributors and the basic roster, and appends one
record to
`server/data/gym-energy/<factionId>.json`:

```json
{ "factionId":"42055",
  "readings":[ { "at":1788800000000,
                 "members":{ "137558":{ "energy":1234567, "days":842 } } } ] }
```

Retention: 400 days, matching the other history stores.

No pool-routing entry and no demote-on-code-16: with one fixed key there is
nothing to route around. A code 16 here means that key lacks faction API
access, which is a thing to fix on the key rather than steer past.

The file is written by the `warboard` user, never root — a root-owned data file
makes `writeFileSync` fail with EACCES and the failure is swallowed.

### Routes

- `GET /slackers` — the page. Ungated, because it holds no member data: the
  markup ships a sign-in and asks for the numbers separately.
- `GET /api/slackers?minDays=100&windowDays=90` — the JSON, behind `requireAuth`
  plus a role check. This is the gate that matters.

**Banker is excluded** from the admitted roles (owner's call, 2026-09-07) —
the money job is admin for vault and payout purposes, which is not the same as
reading who is slacking in wars. Excluded in the route rather than in
faction-settings, because that list is shared with broadcasts and every other
admin gate.

**Sign-in is a Torn API key and nothing else** (owner's call, 2026-09-07 —
the TOTP admin cookie was the first cut and was replaced). The page posts the
key to the existing `POST /api/auth`, which verifies it with Torn and returns a
JWT carrying `factionId` and `factionPosition`; the page keeps the token in
`localStorage` and never the key. The route then admits the owner (137558) or
anyone whose position is in `store.getAdminRoles("42055")` — currently leader,
co-leader, admin leader, war leader, banker — so leadership reads it without
borrowing the owner's login. A plain member's key returns 403, as does a
leader of any other faction.

Computed per request. Thirteen wars against roughly eighty members is
microseconds, and it means the page is never stale after a war ends.

### Tests

`server/slackers-model.test.js`, against the real war-history shape:

- two entries for one war collapse to one, and the surviving totals are not
  doubled
- a member present in 9 of 13 wars gets `warsPresent: 9`, not 13
- energy mode transitions at the 7-day and 90-day boundaries
- a negative delta between snapshots reads as a rejoin, not a collapse
- flag fires on two metrics below half-median, not on one
- `no-wars` member is flagged and never divides by zero

## The page

Admin-only, so it can be direct. Two halves.

**The conversation list** — a card per flagged member, sorted worst first, each
carrying the four numbers and one plain line to read out:

> **Someguy [123456]** · 148 days
> 9 of 13 wars · 4.1 hits/war · 12 chain hits · 0 xanax · 180 e/day
> *below half-median on war hits, xanax*

**The full table** — every eligible member, one row each, sortable by any
column, with each metric colour-banded against the cohort median so a weak
column is visible without reading the number. Columns: member, days in faction,
wars present, war hits (total · per war), chain hits, xanax, energy, flags.

**Live controls, not baked-in filters.** The payload carries every member
including those under the cutoff; the tenure threshold is a control in the page,
defaulting to 100. Sliding it to 60 or 150 mid-conversation re-filters and
re-medians in the browser with no round trip.

**Visual direction.** Its own identity, not a recolour of `/xanax`. A slate
ground with a single warm accent reserved for attention states — flags, below
median — so colour means something everywhere it appears. Tabular numerals
throughout, since every column is a number being compared down a row. One
display face for the header, system stack for the body. Full light and dark
support via tokens on `:root`, with the dark variant defined under both
`prefers-color-scheme` and an explicit `data-theme`, and an explicit background
on `body`. Sorting and filtering in plain inline JS; no dependencies, no CDN.

## Error handling

| Condition | Behaviour |
|---|---|
| No snapshots yet | Energy column runs in lifetime mode and says so |
| Contributors call fails | Last snapshot stands; page renders; banner names the staleness |
| Roster call fails | Serve the last known roster with a staleness banner |
| Member in wars, not in roster | Excluded (they left); a line reports how many |
| Member in roster, no wars in window | Row with `no-wars`, flagged |
| war-history unreadable | 500 with the reason, not a blank page |
| No token | The page shows its sign-in; the API returns 401 |
| Key outside leadership | The API returns 403 and the page says so |

## Out of scope

- **Total (non-war) Xanax.** Would need a per-member personalstats sweep and
  mostly measures stacking habits rather than war effort.
- **True chain reports.** `/v2/faction/{id}/chains` plus per-chain reports could
  count hits in chains outside war periods, but the owner's definition of chain
  hits is the in-war non-war hits already stored.
- **Any write action.** The page reports; it does not message, kick, or demote.
