# Hall of Fame Climb: 3-month, 6-month and 1-year paces — Design

**Date:** 2026-10-22
**Status:** approved by the owner's standing instruction (see Decisions)
**Builds on:** `docs/superpowers/specs/2026-10-19-hof-respect-climb-design.md`

## Goal

The owner, 2026-10-21, pointing at the "30 days | 7 days" pace switch on `/hof`:
"can you see if we can extend those 30 days to 3, 6, 12 months?" and "can you
use chain reports and war reports to go back a year?" Then, before going to
sleep: "use whatever you recommend, finish by morning".

Warboard's own snapshots start on 2026-09-18, and Torn keeps each day's file
for only about a month. So, until warboard has saved enough days, a pace over 3
months, 6 months or a year has to be estimated. The estimate rebuilds each
faction's respect back then from Torn's public chain and ranked-war records.

It is done when:

- the switch offers 30 days, 7 days, 3 months, 6 months and 1 year;
- every long-window pace that is estimated is marked as estimated wherever it
  shows (switch, header, table, footer);
- each window switches to exact snapshot differences on its own, with no
  further deploy, once warboard has saved a day far enough back: 3 months
  from 2026-12-17, 6 months from 2027-03-19, 1 year from 2027-09-18;
- the 7-day and 30-day windows behave exactly as before.

## Decisions

The owner was asleep, and had told me to use whatever I recommend. These are
my calls; every one is listed in the morning report.

| # | Question | Decision | Why |
|---|---|---|---|
| 1 | Which long windows? | 90, 182 and 365 days, labelled 3 months, 6 months and 1 year | 90 already exists (it goes exact in December). "1 year" is shorter than "12 months" and fits five buttons on a phone. |
| 2 | Estimate all three, or only 6 months and 1 year? | All three | The 3-month estimate is the best measured of the three. Without it there's no 3-month pace until December. |
| 3 | Which factions get estimates? | The 168 factions whose respect on 2026-10-22 was within 1.25M below to 2.25M above ours (positions #162 to #329), plus us | At our fastest long pace (about 5.8k a day), a year adds about 2.1M. Factions further away can't meet us within a year at any plausible pace. The band covers the table for months to come. |
| 4 | Pace for factions outside the band, in an estimated window | No pace in the table. In the projection and the crowding note they keep the longest exact window's pace (30 days today, 90 days from December). | Leaving them out would drop every faction far above us from the count, which would put the 1-year horizon near #1. Their pace can't change whether they meet us. |
| 5 | Our own faction's estimate | The rebuild from our own faction's records, made on 2026-10-20 (chains, war payouts, OC, territory, attacks and losses) | It is far tighter than the method for rivals: about ±1k at 3 months and ±3k at a year. |
| 6 | Where the estimate lives | A separate file, `server/data/hof/estimates.json`. Never a synthetic day file in `days/`. | Exact data and estimates never mix, and deleting the file switches the estimates off. |
| 7 | Chart history | Unchanged: saved days only | The owner paused the question of a rebuilt history line on 2026-10-20. The same series could feed it later. |
| 8 | Memory for the exact 1-year window | `KEEP_DAYS` goes from 100 to 402 | Without it the 6-month and 1-year windows could never become exact. A day held in memory costs about 0.45 MB, so the nightly build peaks around 180 MB more by late 2027. |

## Data: a one-off pull

The estimate was built once, from a pull made on 2026-10-22. It is not part of
the daily job. For each faction in the band:

- every chain from 2025-10-08 to 2026-10-22 (`/v2/faction/{id}/chains`, 100
  per page, paged back by start time);
- the ranked-war list (`/v2/faction/{id}/rankedwars`, the latest 100; every
  list reaches back past 2025-10-08);
- the report of every ranked war that ended in that period
  (`/v2/faction/{warId}/rankedwarreport`). Each war's report is fetched once,
  even when both sides are in the band.

It used the owner key at about 40 calls a minute, comment `wb-hof-history`.
The pull script and its replies stay outside the repo. A faction whose chain
pages or reports are incomplete is left out of the estimates (no pace), never
given a partial number.

## The estimate for rivals

For a faction f and a day t before 2026-09-18 (A0, the first saved day),
taking respect at 00:00 UTC:

    est(t) = r(A0) − public(t, A0) − u × days(t, A0)

`public(t0, t1)` is the respect the public records show f gaining between t0
and t1:

- each chain's respect, times the fraction of the chain's time that falls
  inside [t0, t1);
- plus the respect reward of every ranked war that ended inside [t0, t1),
  from its report;
- minus 0.25 × the enemy's score in each ranked war, times the fraction of
  the war that falls inside [t0, t1). Our own records showed that losses in a
  war come to about a quarter of the enemy's score.

`u` is everything the public records miss (organised crimes, territory,
attacks outside chains), as a constant daily rate. It is fitted on the saved
days from A0 to 2026-10-22 (AU):

    u = ((r(AU) − r(A0)) − public(A0, AU)) / days(A0, AU)

At t = A0, est(A0) = r(A0) exactly, so the series joins the saved days with no
step.

### How good it is

This was measured on 2026-10-21 against TornStats, which keeps a weekly respect
series for many factions (used only to check the method, never as a source).
The sample was 11 factions between #240 and #258. The table gives how far each
estimated weekly pace was from the true one:

| Window | Median | Worst |
|---|---|---|
| 3 months | 3.6% | 11.9% |
| 6 months | 5.2% | 43.1% |
| 1 year | 8.1% | 34.2% |

That check estimated most war rewards from the score. The pull fetches every
report, and the check is run again on the built file before deploy. The page
gives these figures in plain words. Some factions' rhythm changed during the
year (a new chain habit, a pause between wars), and a constant `u` can't
follow that.

## The estimates file

`server/data/hof/estimates.json`, owned by warboard:

```json
{
  "version": 1,
  "builtAt": 1792700000000,
  "anchorDay": "2026-09-18",
  "fittedTo": "2026-10-22",
  "band": "respect within 1.25M below to 2.25M above ours on 2026-10-22",
  "factions": 169,
  "days": { "2025-10-08": { "42055": 1870000, "11131": 2950000 }, "...": {}, "2026-09-17": {} }
}
```

`days` holds every day from 2025-10-08 to 2026-09-17, each mapping faction id
to whole respect, the same shape as a day file's `respect`. The file is about
1 MB.

## Calculations — `server/hof-climb.js`

- `WINDOWS = [7, 30, 90, 182, 365]`.
- `resolveWindows(days, latest, estimateDays = [])`. The exact rule comes
  first and is unchanged. Otherwise, if `latest − w` is one of
  `estimateDays`, the window is `{ base: latest − w, span: w, estimated: true }`.
  `estimateDays` lists only the estimate's days that include us.
- `estimatedPacesFor(L, baseRespect, span)`: `(L.respect[id] − base[id]) /
  span` for each faction visible at L that has an estimate at the base. A
  faction with no estimate at the base gets **no pace**. It never falls back
  to its first saved day: that would show a month's exact gain as a year's
  pace.
- In `computeDigest`, an estimated window's projection and crowding note use
  the estimated paces laid over the longest exact window's paces. An
  estimated window needs both an exact window (for that underlay) and our own
  estimate; without either it isn't offered.
- `DIGEST_VERSION = 2`. Each window in `digest.windows` keeps `{ base, span }`
  and gains `estimated: true` when it is estimated. The digest records the
  estimate's `builtAt` as `estimatesBuiltAt`.

## The daily job — `server/hof-snapshots.js`

- `KEEP_DAYS = 402`, the 1-year window's limit (365 + 37).
- `buildIn` reads `estimates.json` from the hof data directory. If the file
  is missing, won't parse or has the wrong shape, the build carries on
  without it; the last two cases log one warning.
- `digestStale` is also true when the estimate's `builtAt` differs from the
  digest's `estimatesBuiltAt`. A new or deleted file then shows up at the next
  run (the boot catch-up 60 s after a restart, or 00:05 UTC).

## API — `server/hof-api.js`

`view()` adds `estimated`: `{ "7": false, "30": false, "90": true, ... }`, one
entry per offered window. Nothing else changes. A row with no estimate gets
`pace[w] = null` and `days[w] = null`, as any row without a pace does today.

## The page — `server/pages/hof.html`

- Switch order: 30 days, 7 days, 3 months, 6 months, 1 year. An estimated
  window's button ends in `*`.
- Header: "32.1k a week (1-year average, estimated*)". An exact window reads
  as today, e.g. "(30-day average)".
- Table: the pace heading reads "Pace /week*" when the window is estimated.
- A note under the footer shows only when the selected window is estimated:
  "* Estimated. Warboard's own daily copies of Torn's data start on 18 Sep
  2026, so until it has saved one from 3 months back (17 Dec), 6 months
  (19 Mar 2027) or a year (18 Sep 2027), that window's starting respect is
  rebuilt from Torn's public chain and ranked-war reports. Checked against an
  outside weekly record for 11 factions near us, a typical pace was within
  about 4% (3 months), 5% (6 months) and 8% (1 year), but a few were a third
  out. Only the 168 factions within reach of us are estimated; the rest keep
  their 30-day pace in the projection." The figures are the ones measured on
  the built file before deploy. "30-day" is the longest window that isn't
  estimated, which the page works out from `windows` and `estimated` (it
  becomes "3-month" in December).
- On narrow screens (≤ 420 px) the switch buttons use less padding, so all
  five fit on one line at 360 px.

## Building the file — `server/hof-estimate.js` and `server/bin/hof-estimate-build.mjs`

`hof-estimate.js` is pure: `overlap`, `publicGain`, `unseenRate` and
`estimateSeries`, with the inputs passed in. The CLI reads the pull's reply
directory, our own rebuilt series (a CSV) and the saved day files, then writes
`estimates.json` atomically. It prints, for each faction, `u`, its chain and
war counts, and why any faction was left out. It is run once, by hand.

## Tests

- `hof-estimate.test.mjs` (new), on synthetic factions:
  - overlap at the edges;
  - a chain that straddles t is prorated;
  - war rewards count only for wars that ended inside the range;
  - losses are prorated;
  - u closes the fitted range exactly;
  - est(A0) = r(A0);
  - incomplete input leaves the faction out.
- `hof-climb.test.mjs`:
  - an estimated base is used only when no exact one exists;
  - an estimated window switches to exact once a saved day sits at L − w;
  - a faction missing from the estimate gets no pace, even with saved days in
    the window;
  - a faction outside the band that sits above us is still counted ahead in
    the projection;
  - no estimated window without an exact one, or without us in the estimate;
  - computeDigest's shape includes `estimated`.
- `hof-snapshots.test.mjs`:
  - the digest is rebuilt when `estimates.json` appears, changes or goes;
  - a broken file is ignored with one warning;
  - `KEEP_DAYS` keeps a day 402 days back.
- `hof-route.test.mjs`: `estimated` in the API.
- `hof-page.test.mjs`:
  - the switch labels and `*`;
  - the header wording;
  - the table heading;
  - the note shows only for an estimated window.

The real data is checked outside the repo:

- est(A0) equals the 09-18 day file for every faction in the band;
- our own 1-year pace is about 4.6k a day (32k a week), against 46k a week
  over 30 days;
- the TornStats comparison is run again on the built file.

## Deploy and checks

1. Copy `estimates.json` into place and chown it to warboard.
2. Deploy with `server/deploy.sh` (tests, pm2 reload, health).
3. After the boot catch-up, `/api/hof` lists five windows, with `estimated`
   true for 90, 182 and 365.
4. Look at the page at phone and desktop widths, in light and dark.

**Revert:** to switch the estimates off, delete `server/data/hof/estimates.json`.
The next run (boot catch-up or 00:05 UTC) rebuilds the digest without them,
and the long windows disappear until exact data covers them. To undo the
code, `git revert` this change's commits and run deploy.sh.

## Out of scope

- A rebuilt history line on the chart.
- Refreshing the estimate. It is fixed once built; exact data replaces it
  window by window.
- Factions outside the band, and factions created after the pull.
