# Hall of Fame Respect Climb — Design

**Date:** 2026-10-19
**Status:** built and live at `/hof` (2026-10-19)
**Owner:** RussianRob [137558], faction 42055 (Dead Fragment)

## Goal

A public page at `/hof` that compares Dead Fragment's respect gain with the
factions around it in Torn's faction Hall of Fame (respect) and shows how far
it could realistically climb. A member asked for it on 2026-10-18: "compare our
respect gained to other factions ... the factions above us ... predict where we
could climb realistically in the hall of fame".

It is read on phones as often as on desktop, and it only displays: no alerts,
no chat posts, no write actions.

It is done when:

- the page's live position matches Torn's Hall of Fame page;
- every pace comes from exact differences between Torn's daily snapshots;
- all viewers share one cached live refresh;
- the saved snapshot history keeps growing past the ~30 days Torn retains.

## Decisions

The owner's answers, 2026-10-19:

| # | Question | Answer |
|---|---|---|
| 1 | Who can open it | Anyone with the link, no sign-in. Hall of Fame respect is public. |
| 2 | Freshness | Live from Torn's Hall of Fame, refreshed at most every 15 minutes while someone views it, shared by every viewer. |
| 3 | Table | The 20 factions directly above us, us, and the 5 below. |
| 4 | Pace and horizons | 30-day pace by default, a 7-day switch, and a 90-day switch once 90 days are saved. Horizons at 1 week, 1 month, 3 months, 6 months and 1 year. A crowding note. No "normal month of wars" adjusted figure. |
| 5 | Chart | One chart of our Hall of Fame position: saved history, then the projected path to one year. |
| 6 | What the job keeps | Torn's whole daily file, gzipped, plus a compact id → respect file per day. |
| 7 | Which factions | Dead Fragment only; no `?id=` parameter. |
| 8 | Where the maths runs | Once a night, into a digest; a request only merges live Hall of Fame rows into it. |

## Data sources

**Torn's daily faction snapshot.**
`GET /v2/faction/snapshot?timestamp=<UTC midnight, unix seconds>` returns a CSV
(about 2.8 MB, about 19.7k rows, one per faction) with the columns `id, name,
tag, tag_image, banner_image, leader_id, co_leader_id, respect, days_old, rank,
members, members_max, member_list, recruiting, destroyed_timestamp`. `rank` is
the league tier, not the Hall of Fame position. `name` and `member_list` are
quoted when they contain spaces or commas. Torn publishes each day's file about
32 seconds after 00:00 UTC and never changes it afterwards (checked 2026-10-18
and 2026-10-19). It keeps at least 30 days and fewer than 45 (measured
2026-10-08). A day that doesn't exist, because it isn't published yet or was
already deleted, answers `{"error":{"code":30,"error":"File does not exist"}}`.

A difference between two snapshots is the exact net respect change, whatever
earned it: wars, chains, organised crimes, territory. Chains plus ranked-war
rewards, the other public source, caught only 70–93% of real gain, and
unevenly, so they are not used.

**Torn's Hall of Fame list.**
`GET /v2/torn/factionhof?cat=respect&limit=100&offset=N` returns
`{"factionhof":[…], "_metadata":{…}}` holding positions N+1 to N+100, each
`{id, name, members, position, rank, values:{respect, chain, chain_duration}}`.
It is live.

**Our own Hall of Fame entry.** `GET /v2/faction/<id>/hof` returns
`{"hof":{"respect":{"value", "rank"}, …}}`. It is used only when our row is
missing from the window the page fetched.

Every call sends the key in an `Authorization: ApiKey <key>` header, never in
the URL (checked on all three endpoints), and adds `comment=wb-hof` so the
calls are labelled in Torn's API log. The key is `OWNER_API_KEY`, which the
faction-history job already uses. The faction id is read the way that job reads
it, from `OWNER_FACTION_ID` with 42055 as the default; decision 7 still holds.

### Hazard: the snapshot lists factions the Hall of Fame hides

Faction 42113 (5.55M respect, 29 members, not destroyed) is in the snapshot but
not in the Hall of Fame. Sorting the CSV by respect therefore puts every
faction below #170 one place too low. Positions follow the Hall of Fame: a
faction on a day's hidden list is left out of that day's positions, and the
latest day's list is left out of the projections. How the job builds the list
is under *Hidden factions* below. Torn keeps no record of which factions were
hidden on past days.

Destroyed factions keep under 50 respect and sit around #11,390, so they need
no special handling.

### Respect can go down

Over the 31 days to 2026-10-19, 4,554 factions with members lost a little
respect (median 0.1%). Only 8 of them were in the top 1,000, and none within
100 places of us. A pace can therefore be negative, and every formula below
allows for that.

## Calculations — `server/hof-climb.js`

Pure: no I/O and no clock of its own. Every number the page shows comes from
here.

**Days.** A day is a UTC date, `YYYY-MM-DD`; its snapshot is the one taken at
that date's 00:00 UTC. L is the latest saved day.

**Day data.** Each saved day has `respect` (id → respect for every faction
with respect above 0, hidden or not) and `hidden` (the ids the Hall of Fame
left out, as detected when the day was saved).

**Position.** On day D, faction f's position is 1 + the number of factions
g ≠ f that are not in D's `hidden` and have respect_D(g) > respect_D(f).
Strictly greater, so a tie counts in f's favour. There are no ties near us
today.

**Windows.** w ∈ {7, 30, 90}. The base day B_w is the latest saved day on or
before L − w days, and span_w = L − B_w in days. Window w is available only
when B_w exists and span_w ≤ w + max(2, ⌈w/10⌉), that is within 9, 33 or 99
days. With every day saved, span_w is exactly w. A missing exact day falls back
to the nearest earlier saved day inside that limit, and the pace divides by the
real span. A window whose base day is further back would be measuring a longer
period under a shorter name, so the page doesn't offer it.

**Pace.** For each faction f with respect at L that is not hidden at L:

- if f has respect at B_w: pace_w(f) = (respect_L(f) − respect_B(f)) / span_w;
- otherwise, with F the earliest saved day after B_w and before L on which f
  has respect: pace_w(f) = (respect_L(f) − respect_F(f)) / (L − F in days);
- otherwise, because f first appears at L: no pace. It is left out of the
  projections, and its table row shows "—".

Every pace is therefore an exact difference between two saved snapshots. New
factions start with about 5,000 respect, so dividing a young faction's respect
by its age would overstate it: one sitting flat at 50,000 would get 8,333 a
day, faster than us.

Paces read each day's full `respect` map; `hidden` only removes factions from
positions, so a faction hidden at B but visible at L still gets a true pace.

**Projection.** For window w and d = 1 … 365, a faction's projected respect is
P_f(d) = respect_L(f) + d × pace_w(f), for every faction with a pace. Our
projected position at d is 1 + the number of factions f ≠ us with
P_f(d) > P_us(d). Every faction keeps its own pace. Projections start from L's
snapshot, not from live respect.

**Horizons.** 1 week is d = 7, 1 month d = 30, 3 months d = 91, 6 months
d = 182, 1 year d = 365.

**Days to pass.** For the table, with window w's paces and the table's respect
(live, or midnight in the fallback), gap = their respect − ours:

- A faction above us in the table: if pace_us > pace_f, days =
  max(0, gap) / (pace_us − pace_f). The page shows the UTC date of
  `updatedAt` + days ("27 Oct", with the year when it isn't the current one),
  or "over a year" when days > 365. Otherwise the row says "pulling away".
- A faction below us: if pace_f > pace_us, days = max(0, −gap) /
  (pace_f − pace_us). When days ≤ 365 the page shows "catches us in N days"
  with N = ⌈days⌉ ("catches us today" when N is 0, "in 1 day" when N is 1);
  beyond a year, and when the faction is slower, it shows nothing.
- A row with no pace, or with a pace that isn't a finite number, gets null and
  shows "—". So does every row if our own pace is missing.

**Crowding note.** For each available window w, from midnight positions:

- last = position(B_30) − position(L): the places we climbed over the last
  month, negative if we fell. B_30 is the 30-day base day; without an
  available 30-day window there is no note.
- next = position(L) − our projected position at d = 30 for window w.
- **Faster** note, when next > 0, next ≥ 2 × last and next ≥ last + 3. X is the
  largest gap at L among the factions ahead of us at L that are not ahead of
  us at d = 30 (P_f(30) ≤ P_us(30), the tie rule). M is the number of factions
  ahead of us at L whose gap is at most X. The text, in the wording the owner
  approved: "We climbed {last} places last month (#{a} to #{b}). At this pace
  we climb {next} in the next month, because {M} factions are within {X}
  respect above us."
- **Slower** note, when last > 0, next ≤ last / 2 and next ≤ last − 3, unless
  our projected position at d = 30 is #1. G is the smallest gap at L among the
  factions ahead of us at L that are still ahead of us at d = 30. The text: "We
  climbed {last} places last month (#{a} to #{b}). At this pace we climb only
  {next} in the next month. The nearest faction above us that we don't reach
  this month is {G} respect ahead." When next is 0 the middle sentence reads
  "At this pace we hold #{b} for the next month."; when next < 0, "At this pace
  we fall {−next} places in the next month."
- Otherwise there is no note. The 3-place margin keeps a difference of one or
  two places from producing one.
- A faster note can follow a month in which we didn't climb. Its first
  sentence then reads "We held #{b} last month." for last = 0, and "We fell
  {−last} places last month (#{a} to #{b})." for last < 0.
- Singular forms: "1 place", "fell 1 place", "fall 1 place", and "1 faction is
  within".

**Number formats,** shared by the note and the page. The inputs are whole
numbers. The unit comes from the absolute value after rounding half up, and a
negative value gets a "-" in front:

- under 10,000: exact, with separators ("9,876", "-188");
- under 100,000: thousands with one fixed decimal ("10.0k", "74.8k", "-33.9k");
- under 1,000,000: whole thousands ("111k");
- otherwise: millions with two fixed decimals ("1.00M", "3.55M").

A value that rounds up into the next band uses that band, so 99,960 is "100k"
and 999,500 is "1.00M". Paces are rounded to the nearest whole number, halves
away from zero, and shown with separators ("7,752/day"); a pace that rounds to
0 prints "0/day".

**Real-data anchors.** The finished functions must give these from saved
copies of the three snapshots fetched during the feasibility spike (2026-09-18,
2026-10-18 and 2026-10-19, kept outside the repo), with 42113 hidden on each
day:

- positions #255 on 2026-09-18, #250 on 2026-10-18 and #250 on 2026-10-19;
- a 30-day pace of 7,752 a day: B_30 is 2026-09-18 and the span is 31 days,
  because 2026-09-19 isn't in the set, and 31 is inside the 33-day limit;
- no 7-day window (its base would be 2026-09-18, 31 days back, past the 9-day
  limit) and no 90-day window;
- projected positions #246, #238, #218, #209 and #181 at the five horizons;
- no faction below us catching us within a year (the fastest, Tower of
  Mischief, would take about 13,000 days);
- a pace of 0 for faction 57856, which sits at 50,000 on both 2026-10-18 and
  2026-10-19 (its first saved day is 2026-10-18);
- the 30-day note, word for word: "We climbed 5 places last month (#255 to
  #250). At this pace we climb 12 in the next month, because 12 factions are
  within 111k respect above us."

## Architecture

Four modules, a page and three small edits, following the shapes already in
this repo: the fetch, the clock, the timers and the data directory are
injected.

### `server/hof-torn.js` — Torn requests

`tornGet(path, params, { key, fetchImpl = fetch, source, timeoutMs = 30000 })`:

- builds `https://api.torn.com/v2<path>?<params>&comment=wb-hof`;
- sends `Authorization: ApiKey <key>`;
- records the call with `logCall(key, url, source, status)` from
  `key-usage-log.js` (the URL carries no key);
- returns `{ ok: true, status, text }`, or `{ ok: false, code, message }`.
  `code` is Torn's error code when the body is a Torn error object, `"http_<status>"`
  for another non-200 answer, `"timeout"` when `timeoutMs` passes, and
  `"network"` when fetch throws.

It never throws, and it neither retries nor paces: the callers do. The
snapshot call passes `timeoutMs: 120000`.

### `server/hof-snapshots.js` — the daily job

Exports `startHofSnapshots()` and `stopHofSnapshots()`, plus `runOnce()`,
`parseSnapshotCsv()`, `snapshotFacts()`, `savedDays()`, `missingDays()`,
`detectHidden()`, `buildDigest()` and `defaultDataDir()` for tests and for
`hof-api.js`. Each takes `{ dataDir, fetchImpl, nowFn, key, factionId, sleep, cron,
timers }`, defaulting to `join(process.env.DATA_DIR || join(__dirname, "data"),
"hof")` worked out at call time, global `fetch`, `() => Date.now()`,
`process.env.OWNER_API_KEY`, `OWNER_FACTION_ID` or 42055, a real sleep,
node-cron, and the global `setTimeout`/`clearTimeout`. Nothing touches the disk
at import.

**Scheduling.** `startHofSnapshots()` is called from `server.js` next to
`startFactionHistorySchedule()`.

- With `HOF_SCHEDULE=0`, or with no `OWNER_API_KEY`, it logs one line and
  schedules nothing, as the faction-history job does. `HOF_SCHEDULE=0` stops
  only the job; `/api/hof` keeps refreshing live rows while it has a key.
- node-cron runs it at `'5 0 * * *'` with `{ timezone: "UTC", noOverlap: true }`,
  which is 00:05 UTC. The server's local time isn't UTC, so the timezone must
  be explicit.
- A boot catch-up runs 60 seconds after start, ahead of the faction-history
  job's boot tick at 5 minutes on the same key. A long first backfill can
  overlap that tick, which is harmless: both pace their calls, and code 5 backs
  off.
- One 15-minute retry timer is armed when today's file isn't published yet or
  a run ends on a transient error.
- One run at a time: the cron run, the boot catch-up and the retry share a
  guard inside the module, because `noOverlap` only stops cron overlapping
  itself. A run that finds another in progress arms the 15-minute retry rather
  than being dropped.
- Every scheduled run is `runOnce(…).catch(log)`. Node 20 exits on an unhandled
  rejection and nothing in the server catches one, so a stray rejection would
  take every warboard feature down.

`stopHofSnapshots()` stops the cron task and clears the boot and retry timers.
`shutdown()` in `server.js` calls it inside `try {} catch {}`, like its
neighbours there. Data safety rests on the atomic writes, not on shutdown.

A run with nothing to fetch makes no calls, so the server's frequent pm2
restarts cost nothing. It still rebuilds the digest, without calls, if the
digest is missing, older than the newest day file, or from a different
`version`.

**Which days a run wants.** The candidates are the 45 UTC days from today back
to today − 44. A candidate is skipped when its day file exists (the day is
done), or when it isn't today and `attempts.json` shows it answered code 30
earlier on the same UTC date, so a past day is asked about at most once a day,
not on every restart. Older days are never requested. Candidates run newest
first.

**Each day.**

1. If `raw/<day>.csv.gz` exists, it is read instead of fetched, with no call.
   That covers a crash between the two writes and a run that saved raw files
   but couldn't write day files. A raw file that fails to unzip or parse is
   deleted and fetched again.
2. Otherwise the snapshot is fetched. At least 1.1 seconds pass between the
   job's calls, Hall of Fame pages included. Code 5 (too many requests) waits
   2 seconds, then 1.8 times longer each time, for up to 5 retries; the same
   backoff applies to every call the job makes.
   - Code 30 for today arms the 15-minute retry, and the run continues with
     older days.
   - Code 30 for a past day records the day in `attempts.json`, and the run
     continues.
   - A key problem (codes 1, 2, 10, 13, 16, 18), from the snapshot or the
     Hall of Fame check, is logged once, ends the run and cancels any retry
     the run had armed. Every later run, boot catch-ups included, tries again.
   - A general failure (network errors, timeouts, code 5 after its retries,
     codes 8, 9, 14, 15, 17, 24, and HTTP 5xx) means Torn or the link is down:
     the run ends and arms the 15-minute retry.
   - Any other failure belongs to that one file: today's arms the retry, a
     past day's is recorded in `attempts.json`, and the older days carry on.
3. A fetched file must have `id`, `name` and `respect` in its header row
   (columns are found by name, so added or reordered columns don't matter) and
   at least 90% as many factions with respect as the newest saved day, which
   catches a cut-off download. A file that fails is set aside as
   `raw/<day>.rejected.csv.gz`, never discarded, and the older days carry on.
   A short file arms the retry and is accepted when the next fetch returns it
   unchanged: Torn never changes a published file, so it is real, not cut off.
   A file missing a column is asked about again only on a later UTC date (a
   format change won't fix itself the same day).
4. A fetched file is saved gzipped to `raw/<day>.csv.gz`, exactly as Torn
   served it.
5. The run makes sure it has a hidden list (below).
6. `days/<day>.json` is written. This write marks the day done.

After the loop, if any day file was written, the digest is rebuilt. A failed
write ends the run and arms the retry; the day isn't marked done.

**Parsing.** `parseSnapshotCsv(text)` returns rows keyed by header name. It
handles quoted fields containing commas (`member_list`), doubled quotes and
CRLF line ends. A row with the wrong number of fields is skipped and counted in
the run's log line. The day file keeps factions with respect above 0, about
11.4k of the 19.7k rows.

**Hidden factions.** Once per run, right after the run's first (newest)
snapshot is in hand:

- page through the Hall of Fame (`limit=100`, offsets 0, 100, 200 …) until it
  covers position P + 200, where P is our position in it. At #250 that is 5
  calls. Stop after 20 pages.
- hidden = the ids among that snapshot's top P + 100 by respect that are absent
  from those pages.

The margins of 100 and 200 places absorb factions that move between midnight
and the check, and the list covers the 100 places below us as well as
everything above, so it serves the rows below us in the table and the
projections. Every day file written in the run gets this list, so a day
fetched during the first backfill or a later catch-up takes the list that was
current when it was fetched, and a past position can be one place off if the
list has changed since. A hidden faction more than 100 places below us goes
undetected. It can't affect our current position, only a distant projection,
and today no faction below us catches us within a year anyway.

If the Hall of Fame check fails, the run uses the `hidden` list from the newest
saved day file. If there is no saved day file yet, the run keeps fetching and
saving raw files for the older days (Torn's copies expire), writes no day files
and arms the 15-minute retry. The next run builds the day files from the raw
files without fetching them again.

**Digest.** `buildDigest()` reads every day file and L's raw file (for the
names in the fallback table), computes everything through `hof-climb.js`, and
writes `digest.json`. It reads only `*.json` in `days/` and `*.csv.gz` in
`raw/`, so a temporary file left behind by a SIGKILL is ignored. A day file
that fails to parse is rebuilt from its raw file when that parses; otherwise
the day is left out of history and paces, and logged.

**Writes.** Every file is written under a temporary name in its own directory
and then renamed, as `restock-tracker.js` `saveState()` does. pm2 often stops
warboard with SIGKILL, and nothing may ever read half a file. The server
process creates `server/data/hof/` itself on its first run; don't create it
beforehand under another owner, or every write fails with EACCES. `deploy.sh`
runs the suite under the deploying user, not the server's, so every hof test
file sets `process.env.DATA_DIR` to an `mkdtemp` directory before its imports.
A test that forgets to pass `dataDir` then still never touches the live
directory.

**Logging.** Each run logs one `[hof]` summary line: days saved, days still
waiting, the hidden list, and the digest's day and position. Errors log Torn's
code and message, never the key.

**Cost.** The job makes about 6 calls a day: one snapshot and about five Hall
of Fame pages. The first run makes up to 45 snapshot calls, of which Torn
serves 30 or more, and takes a few minutes. For about two weeks after that,
each day Torn no longer had is asked about once a day, up to 14 calls, until it
leaves the 45-day window. If Torn stops publishing, the 15-minute retry costs 4
calls an hour until it is back. The page adds at most one live refresh every
15 minutes while someone has it open and visible: normally 1 call, up to 3
after a big move.

### Files

```
server/data/hof/
  raw/2026-10-19.csv.gz     Torn's file as served, gzipped (about 1.3 MB a day)
  raw/<day>.rejected.csv.gz a fetched file that failed a check, kept aside
  days/2026-10-19.json      the compact day file (about 150 KB a day)
  attempts.json             past days that answered code 30, and when
  digest.json               the nightly summary (about 1 MB)
```

`days/<day>.json`:

```json
{ "day": "2026-10-19",
  "respect": { "42055": 3552938, "8397": 3553126 },
  "hidden": [42113] }
```

`attempts.json` maps a past day to the UTC date on which it last answered code
30. Entries older than the 45-day window are dropped the next time it is
written:

```json
{ "2026-09-04": "2026-10-19" }
```

`digest.json`, with the three spike snapshots' values (maps and arrays cut
short):

```json
{ "version": 1,
  "factionId": 42055,
  "day": "2026-10-19",
  "builtAt": 1792368330000,
  "windows": { "30": { "base": "2026-09-18", "span": 31 } },
  "paces": { "42055": { "30": 7752.03 }, "8397": { "30": 304.5 } },
  "history": [ { "day": "2026-09-18", "position": 255, "respect": 3312625 },
               { "day": "2026-10-18", "position": 250, "respect": 3552204 },
               { "day": "2026-10-19", "position": 250, "respect": 3552938 } ],
  "projection": { "30": [248, 248, 248] },
  "notes": { "30": "We climbed 5 places last month (#255 to #250). At this pace we climb 12 in the next month, because 12 factions are within 111k respect above us." },
  "midnight": { "position": 250, "respect": 3552938,
                "rows": [ { "position": 249, "id": 8397, "name": "ilimitada",
                            "respect": 3553126 } ] } }
```

- `windows` lists only the available windows.
- `paces` covers every faction with a pace, about 11.4k of them, which is why
  the digest is about 1 MB. `/api/hof` sends only the rows on screen.
- `history` has one entry per saved day, oldest first; `respect` is ours.
- `projection[w]` holds 365 entries, our projected position for d = 1 … 365.
  The horizons are entries 7, 30, 91, 182 and 365 (index d − 1).
- `notes[w]` is the crowding note's text, or null.
- `midnight.rows` is the fallback table at L: 20 above us, us and 5 below,
  with names from L's snapshot.

Nothing prunes `server/data/hof/`, which grows by about 0.5 GB a year. It is
git-ignored (`server/.gitignore` ignores `data/`), and no route serves it.

### `server/hof-api.js` — live merge and cache

`createHofApi({ dataDir, fetchImpl, nowFn, key, factionId })` returns
`{ handle(req, res), settle() }`, with the same defaults as the job; `settle()`
resolves once no refresh is running, which the tests use. `routes.js` creates
one instance. Creating it does no I/O and starts no timers.

`handle()` never rejects: any error becomes a JSON 500 and a log line. Express
4 ignores the promise a handler returns, so a rejection would be unhandled and
would bring the server down.

**Digest.** Read from `digest.json` and read again whenever the file's mtime
changes, so the nightly rebuild shows up without a restart.

**Live standings.** One shared copy, `{ fetchedAt, us, rows }`.

- The window is `factionhof?cat=respect&offset=max(0, P − 51)&limit=100`,
  positions P − 50 to P + 49, where P is our position in the last live copy, or
  `digest.midnight.position` before there is one. That is one call.
- If our row isn't in it: `GET /v2/faction/<id>/hof` for our rank, then the
  window around that rank. If our row is there but the window holds fewer than
  min(20, our position − 1) rows above us or fewer than 5 below, which takes a
  climb of more than 30 places or a fall of more than 44: the window around our
  new position. At most 3 calls, normally 1.
- The table takes the 20 rows above us, our row and the 5 below.

**Freshness.** A request never waits for Torn. It answers at once from the
newest copy it has: the live copy, or the digest's midnight standings when
there is none. If that live copy is 15 minutes old or more, or there is none,
the request also starts a refresh, unless one is already in flight or the last
attempt, successful or not, began less than 15 minutes ago. Concurrent requests
share the one in-flight refresh.

While a refresh is in flight the answer carries `"refreshing": true`, and the
page fetches once more five seconds later. That second request reads the
shared copy and costs no Torn call. So the page costs at most one refresh every
15 minutes however many people view it, and a viewer who arrives after a quiet
spell sees fresh standings within seconds.

**Failure.** A refresh that fails leaves the older live copy in place, served
with its own time. With no live copy at all, the answer uses
`digest.midnight` and says so.

**Response.** `GET /api/hof` needs no key and answers with
`Cache-Control: public, max-age=60`. Values from the spike snapshots, with
midnight respect standing in for live (arrays cut short):

```json
{ "factionId": 42055,
  "source": "live",
  "refreshing": false,
  "updatedAt": 1792400000000,
  "day": "2026-10-19",
  "windows": [30],
  "defaultWindow": 30,
  "us": { "position": 250, "respect": 3552938, "pace": { "30": 7752.03 } },
  "rows": [
    { "position": 248, "id": 11131, "name": "Infernum Perdition",
      "respect": 3553829, "gap": 891, "pace": { "30": 4867.4 },
      "days": { "30": 0.31 } },
    { "position": 250, "id": 42055, "name": "Dead Fragment", "respect": 3552938,
      "gap": 0, "us": true, "pace": { "30": 7752.03 }, "days": { "30": null } },
    { "position": 251, "id": 42168, "name": "AssKickers United",
      "respect": 3519056, "gap": -33882, "pace": { "30": 904.8 },
      "days": { "30": null } } ],
  "history": [ { "day": "2026-09-18", "position": 255 } ],
  "projection": { "30": [248, 248, 248] },
  "notes": { "30": "We climbed 5 places last month (#255 to #250). At this pace we climb 12 in the next month, because 12 factions are within 111k respect above us." } }
```

- `source` is `"live"` for a copy under 15 minutes old, `"stale"` for an older
  live copy, and `"midnight"` for the digest's standings.
- `updatedAt` is when Torn's standings were read; for `"midnight"`, L's 00:00
  UTC.
- `days[w]` comes from *Days to pass*: for a row above us, the days until we
  pass it; for a row below, the days until it catches us; otherwise null.
- `defaultWindow` is 30 when available, else the longest available window.
- With no digest yet, the answer is `503 {"error":"warming up"}`, sent with
  `Cache-Control: no-store`.

### Routes and wiring

- `routes.js`: `GET /hof` serves `pages/hof.html` with
  `Content-Type: text/html; charset=utf-8` and `Cache-Control: no-store`,
  exactly like the `/gym` route. `GET /api/hof` calls `hofApi.handle`.
- `routes.js` `gateMiddleware`: add `/hof` to its public paths,
  `req.path === "/hof" || req.path.startsWith("/hof/")` as the `/war` rule is
  written. `/api/hof` needs no change.
- `server.js`: start the job next to `startFactionHistorySchedule()` and call
  `stopHofSnapshots()` in `shutdown()`.
- The page goes in `server/pages/`, never `server/public/`. `express.static`
  serves `public/` with `extensions: ["html"]` before the router, so a
  `public/hof.html` would answer `/hof` in place of the route.

### Tests

Written before the code they test, in `server/` beside the modules, with
synthetic fixtures only (a few made-up factions, no real snapshot data), the
fetch, clock, timers and data directory injected, and `process.env.DATA_DIR`
pointed at an `mkdtemp` directory before any import:

- `server/hof-climb.test.mjs`: pace over an exact base day, and over a missing
  one inside and beyond the window limit; a faction first seen after the base
  day measured from its first saved day; a faction seen only at L with no pace;
  a faction flat across two days at pace 0; a negative pace; positions with a
  tie and with a hidden faction; a faction hidden on the base day but visible
  at L keeping a true pace; projection counting at d = 1 and d = 365; the
  horizon indices; days to pass for faster, slower and equal paces, above and
  below, including "today", "1 day", the year cap for rows below, no pace, and
  a non-finite pace; the crowding note's faster case (with M), slower case and
  silent cases, its wording after a flat or falling month, its singular forms,
  no slower note when we would reach #1, and no note without a 30-day window;
  the number formats at each boundary, negative values included.
- `server/hof-torn.test.mjs`: header auth, `comment=wb-hof`, `logCall`, each
  error code, and that it never throws.
- `server/hof-snapshots.test.mjs`: CSV parsing (quoted commas, doubled quotes,
  CRLF, a short row skipped, columns found by name); the 45-day candidate list,
  newest first; one ask per UTC date for a past code-30 day; today's code 30
  arming the 15-minute retry; the code-5 backoff timings; a key error ending
  the run without a retry; the raw file written before the day file; a raw file
  reused without a fetch, and a broken one deleted and fetched again; the
  row-count check; hidden detection paging to P + 200 and the set difference
  over the top P + 100; the fallback to the newest saved list, and the deferral
  when there is none; a failed write ending the run with a retry; the digest's contents, its rebuild on a version change,
  and an unparseable day file rebuilt from its raw file; the cron line and
  options (cron injected); the 60-second boot delay; a busy guard arming the
  retry; `stopHofSnapshots()` clearing everything; and a throwing fetch never
  producing an unhandled rejection.
- `server/hof-route.test.mjs`: `hof-api.js` answering at once from a fresh,
  stale or missing copy; `refreshing` set while a refresh runs; one refresh
  shared by concurrent requests; no new attempt within 15 minutes of the last;
  the stale and midnight fallbacks; the window offset and the re-window cases
  with their call counts; the response shape and headers; the 503; the digest
  read again on an mtime change; a throwing fetch still producing a JSON
  answer. Plus checks on `routes.js`, read the way `war-admin-gate.test.mjs`
  reads it: `/hof` and `/api/hof` are registered, and `gateMiddleware`, run in
  a `vm` box with an empty `process.env` and stubbed cookie and redirect
  helpers, lets `/hof` through and redirects a gated path.
- `server/hof-page.test.mjs`: the page's named functions, run in `vm` the way
  `gym-hof.test.mjs` runs `/gym`'s, with `document`, `fetch` and the timers
  stubbed: the table (20 above, us highlighted, 5 below, and each pass label);
  faction names HTML-escaped; the chart's inverted Y axis and dashed
  projection; the horizons and note following the switch without a new
  request; one more fetch five seconds after a `refreshing` answer; the refresh
  timer running only while the page is visible, except inside Torn PDA; and the
  "updated" wording.

## The page

`server/pages/hof.html` is one self-contained file with inline CSS and JS and
no scripts or libraries from a CDN. It has the `/slackers` look: that page's
Google Fonts stylesheet and `<meta name="color-scheme" content="light dark">`,
its colour tokens on `:root` with light and dark variants (under both
`prefers-color-scheme` and `data-theme`), an explicit `body` background,
tabular numerals, and 16 px side margins on phones. Its script is a set of
plain named top-level functions, so the page test can run them. Faction names
come from Torn and are HTML-escaped wherever they are rendered.

Top to bottom:

1. **Header.** Our live position, respect and pace for the selected window,
   with "updated just now", "updated N min ago" or "updated N h ago". When
   `source` is `"midnight"` it says "Torn's live standings are unavailable, so
   this shows last midnight's.", or "Loading Torn's live standings…" while a
   refresh is in flight (every restart's first view). When the digest's day is
   more than a day old, a line says which day the paces come from.
2. **Pace switch.** 30 days (the default), 7 days, and 90 days, each shown only
   while its window is available. Switching redraws everything below in the
   browser without a new request.
3. **Horizons.** Five chips, for 1 week, 1 month, 3 months, 6 months and 1
   year, each with the projected position.
4. **Crowding note**, when the selected window has one.
5. **Chart.** Our position over time, best at the top. The saved history is a
   solid line, the projection a dashed line out to one year, the five horizons
   are labelled dots, and a thin line marks the latest snapshot. It is drawn at
   its column's real pixel width with 13 px text, so the labels stay readable on
   a phone; a fixed 660-wide viewBox like `graph()` in `server/pages/prewar.html`
   shrinks them to about 7 px there. Month labels sit at each UTC month start
   (`Date.UTC(y, m, 1)`), adapted from the UTC year lines in
   `faction-history.html`'s `lineChart()`. Colours come from the tokens.
6. **Table.** The 20 factions above us, our row highlighted, and the 5 below.
   Columns: position and faction together ("#249 ilimitada", linked to
   `https://www.torn.com/factions.php?step=profile&ID=<id>`), gap, pace per day,
   and pass, labelled as under *Days to pass*. On a narrow phone the table
   scrolls sideways inside its box with that first column fixed, as on
   `/slackers`.
7. **How this works.** Pace is the change between Torn's daily snapshots over
   the window, divided by the days. Projections assume every faction keeps its
   pace and start from last midnight's standings; the table uses live respect.
   Most of our respect arrives with each war, so a pass date a few days out can
   land a few days either way. Positions follow Torn's Hall of Fame, which
   leaves out a few factions that appear in Torn's data.

A visible tab refreshes every 15 minutes, and at once when it becomes visible
with data older than that, so a tab left open in the background spends no
calls. Between loads it redraws once a minute, so "updated N min ago" stays
true. Inside Torn PDA (`window.flutter_inappwebview` is defined),
`document.hidden` can read true while the page is on screen, so there the
refresh runs regardless of visibility. After an answer with `"refreshing":
true`, the page fetches once more five seconds later. A failed refresh keeps
the current data and adds "Couldn't reach warboard; showing data from N min
ago."; with no data yet it says "Couldn't reach warboard. It will try again in
a minute." A 503 shows "Collecting Torn's daily snapshots. Check back in a few
minutes."

## Error handling

| Condition | Behaviour |
|---|---|
| Today's snapshot not published yet (code 30) | Retry every 15 minutes until it appears |
| A past day inside the 45 days answers code 30 | Recorded in `attempts.json`; asked again only on a later UTC date |
| A day older than 45 days | Never requested |
| Too many requests (code 5) | Wait 2 s, then 1.8 times longer, up to 5 retries; then the run ends and retries in 15 minutes |
| Key problem (codes 1, 2, 10, 13, 16, 18), from the snapshot or the Hall of Fame check | Logged once per run; the run ends and any retry it armed is cancelled; each later run, boot catch-ups included, tries again |
| No `OWNER_API_KEY`, or `HOF_SCHEDULE=0` | The job isn't scheduled; the page serves the existing digest, or a 503 without one |
| A general failure: network, timeout, code 5 after its retries, codes 8, 9, 14, 15, 17, 24, HTTP 5xx | The run ends; retry in 15 minutes |
| Any other failure of one day's file | Today's arms the retry; a past day's is asked again on a later UTC date; the older days carry on |
| Snapshot without a needed column, or with under 90% of the newest saved day's factions | Set aside as `raw/<day>.rejected.csv.gz`; the older days carry on. A short file retries in 15 minutes and is accepted when it comes back unchanged; a missing column is asked again on a later UTC date |
| Crash between the raw file and the day file | The next run builds the day file from the raw file, without fetching the snapshot again |
| Raw file that won't unzip or parse | Deleted and fetched again |
| Hall of Fame check fails | The newest saved hidden list is used; with none, the backfill keeps saving raw files, day files wait, and a retry in 15 minutes |
| A write fails (EACCES, ENOSPC) | Logged; the day isn't marked done; retry in 15 minutes |
| A day file can't be parsed | Rebuilt from its raw file; if that fails too, left out of history and paces, and logged |
| Live refresh fails | The last live copy with its own time; with none, last midnight's standings, labelled; next attempt after 15 minutes |
| Any error inside `/api/hof` | A JSON 500 and a log line, never an unhandled rejection |
| No digest yet | `/api/hof` answers 503 `{"error":"warming up"}`; the page says it is collecting snapshots |
| A live row missing from the digest | Pace and pass show "—" |

## Deploy and checks

1. Before deploying, a one-off check, kept outside the repo, runs the finished
   code over the saved copies of the three spike snapshots in a temporary
   directory. It must reproduce the anchors under *Calculations*. Living
   outside `server/`, it is never picked up by `deploy.sh`'s test run.
2. Deploy with `server/deploy.sh`: the full test suite, `pm2 reload warboard`,
   then `/api/health`.
3. Watch the first boot catch-up in the `[hof]` log lines: 30 or more days
   saved, the hidden list found, the digest built. Then compare `/hof` with
   Torn's Hall of Fame page: our position, and the positions and respect of the
   rows around us.

## Out of scope

- **Other factions.** The saved files cover every faction, so `?id=` is a small
  change later. The live refresh would then spend the owner's key on other
  people's lookups.
- **Shading our war weeks on the chart.** Only our 25 most recent wars have
  dates on disk.
- **A "normal month of wars" adjusted pace.** Dropped by the owner: it rested on
  a guess about how many wars we would fight.
- **Alerts, chat posts and push notifications.**
- **Respect per member and rival roster changes.** The raw files keep what
  these would need.
- **Pruning or backing up `server/data/hof/`.**
