# Arson approval writes into the scenarios file — design

**Status:** approved 2026-08-04
**Goal:** approving a crime log updates `arsonists-ledger-scenarios.json` directly,
so the ledger reads one file instead of merging two.

## Why

Approval currently writes a parallel record to `arson-overrides.json`, and the
ledger merges two files at runtime:

```js
var SCENARIOS_URL       = ".../data/arsonists-ledger-scenarios.json";  // 248 records
var ARSON_OVERRIDES_URL = ".../data/arson-overrides.json";             // 10 approvals
```

The merge is the only thing this change removes. Distribution is unaffected —
both files are served publicly from the same directory and reach new and
existing users identically, because the overrides fetch is already
cache-busted (`arson-ledger-live.user.js:4393`, `?t=` + timestamp).

The two record shapes already match. Approval builds
`{ scenarioName, payout, actions }`; a scenarios record *is*
`{ scenarioName, payout, actions }`. So this is an upsert, not a translation.

**Regeneration was the one real risk and it does not exist.** The only reference
to the scenarios file anywhere in the repo is the ledger reading it; there is no
writer, no generator, and no cron entry under root or `warboard`. Its mtime is
2026-07-16 — nineteen days static. It is a hand-owned dataset.

## The upsert

`POST /api/arson/approve` (routes.js:10351), after the existing admin check:

1. Load `arsonists-ledger-scenarios.json` — a JSON **array** of 248 records.
2. Find the record whose `scenarioName` matches the approved scenario,
   **case-insensitively**. The ledger's own keys are mixed-case
   (`"A Black Mark"`) while overrides were lowercased, so an exact match would
   miss every existing entry.
3. If found: overwrite `payout` and `actions`, keeping the record's existing
   `scenarioName` casing — the ledger displays that name, so rewriting
   "A Black Mark" to "a black mark" because that is how the log arrived would be
   a visible regression.
4. If not found: append a new record. New scenarios are a normal case — the
   ledger discovers scenarios Torn adds.
5. Write the file, then remove the pending log entry exactly as today.

## No reversibility layer

An earlier draft kept replaced values in a capped `history` array on each
record, so a mistyped approval could be rolled back. Dropped on the user's call,
and they were right: a wrong approval is already corrected by submitting a new
log with the right numbers and approving it, which overwrites. `history` would
have been a second mechanism for something already possible — carried in a file
every client downloads on every page load.

`revertScenario` was specced and is not built.

## Migration of the existing 10

The 10 records in `arson-overrides.json` are live: every ledger user is applying
them right now. Merging without migrating would silently revert them —
`going viral` and `a black mark` would drop from 180000 back to their base
values with nothing on screen to say so.

A one-time script folds them in with the same upsert. Applied 2026-08-04:
248 -> 249 records, 9 updated and 1 appended, with a timestamped backup of the
scenarios file taken first.

Only 5 were real changes; the other 5 overrides already matched their base
record exactly, so those approvals had been no-ops:

    Point of No Return    90000 -> 140000
    A Black Mark         220000 -> 180000
    Spirit Level         330000 -> 320000
    Igniting Curiosity   260000 -> 210000
    + A Thong of Lice and Fire (new, 220000)

`arson-overrides.json` is left on disk, unmodified, as a fallback until the
merged numbers have been eyeballed. It stops being read once the ledger drops
`ARSON_OVERRIDES_URL`.

## Client change

`arson-ledger-live.user.js`: remove `ARSON_OVERRIDES_URL`, its fetch, its
`KEY_OVERRIDES_CACHE` localStorage cache, and the merge. Bump `@version` and the
in-file `SCRIPT_VERSION`, and add a CHANGELOG entry.

Users on the old script keep applying the frozen overrides file. Since those
values equal what was merged, they see identical numbers — they just stop
receiving *new* approvals until they update. That is an acceptable transition
and needs no dual-write.

## Structure

`server/arson-scenarios.js` — a pure module:

- `upsertScenario(list, { scenarioName, payout, actions })` → new list

Pure and list-in/list-out so it is testable with `node`, matching the existing
convention (`server/oc-engine-cache.test.js`). `routes.js` handles only file I/O
and the admin check.



## Tests

`server/arson-scenarios.test.js` — 8 tests:

1. Existing scenario updated in place, list length unchanged.
2. Actions replaced wholesale, not merged — an approval describes the full
   recipe, so merging would strand actions the new log deliberately dropped.
3. Case-insensitive match, so approving "a black mark" updates "A Black Mark"
   rather than appending a duplicate.
4. Existing `scenarioName` casing preserved on update — the ledger displays it.
5. Unknown scenario appended.
6. Appended scenario keeps its submitted casing.
7. Input list not mutated.
8. Non-array input yields a single-record list.

**Client-side TTL, found while wiring it up.** `SCENARIOS_TTL_MS` is 24 h. The
old overrides fetch was cache-busted and so approvals appeared instantly; folding
them into the scenarios file would have hidden a fresh approval for up to a day.
`scheduleScenarioRefresh(force)` now bypasses the TTL and cache-busts, and the
approve path is the only caller that forces. It also calls
`refreshVisibleTooltip()`, which the override path did and the scenarios path
did not — without it an approval would not update the panel already on screen.

## Out of scope

- Keying by scenario id. No id exists in any of the three data files, and Torn
  does not expose one; a synthetic id would add indirection without safety.
- Pushing approvals to the `russianrob/torn-arson-recipes` GitHub repo. That is
  a separate dataset read by a different tool.
