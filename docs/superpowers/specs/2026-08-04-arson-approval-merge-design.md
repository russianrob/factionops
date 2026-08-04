# Arson approval writes into the scenarios file — design

**Status:** approved 2026-08-04
**Goal:** approving a crime log updates `arsonists-ledger-scenarios.json` directly,
with the replaced values kept so a bad approval stays a one-line fix.

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
3. If found: push the current `{ payout, actions, replacedAt }` onto that
   record's `history`, then overwrite `payout` and `actions`.
4. If not found: append a new record. New scenarios are a normal case — the
   ledger discovers scenarios Torn adds.
5. Write the file, then remove the pending log entry exactly as today.

`history` is capped at the 10 most recent entries. Unbounded growth in a file
fetched by every client on every page load is a cost with no reader.

## Reversibility

The property being preserved is that a mistyped approval is cheap to undo.
Today that is deleting one key from the overrides file; afterwards it is copying
`history[0]` back over `payout` and `actions`.

`history` lives on the record rather than in a sidecar, so it cannot drift from
the value it describes — a separate file would reintroduce exactly the two-file
coupling this change removes.

The ledger ignores unknown fields, so `history` needs no client change and old
installed copies keep working.

## Migration of the existing 10

The 10 records in `arson-overrides.json` are live: every ledger user is applying
them right now. Merging without migrating would silently revert them —
`going viral` and `a black mark` would drop from 180000 back to their base
values with nothing on screen to say so.

A one-time script folds them in using the same upsert, which **does** write
`history`. An earlier draft of this spec said it should not, on the grounds that
there was "no prior approved value to preserve". That was backwards: the base
record's payout is precisely the value a revert should restore. Skipping it
would migrate the 10 in as unrevertable — losing, for exactly the records most
likely to need it, the property this whole change exists to keep.

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

- `upsertScenario(list, { scenarioName, payout, actions }, now)` → new list
- `revertScenario(list, scenarioName)` → new list, restoring `history[0]`

Pure and list-in/list-out so it is testable with `node`, matching the existing
convention (`server/oc-engine-cache.test.js`). `routes.js` handles only file I/O
and the admin check.

`revertScenario` ships with the change rather than later: reversibility that
exists only as a documented manual edit is not reversibility, and the test for
it is what proves `history` is actually usable.

## Tests

`server/arson-scenarios.test.js`:

1. **Existing scenario is updated in place** — count stays 248, payout changes.
2. **Case-insensitive match** — approving `"a black mark"` updates
   `"A Black Mark"` rather than appending a duplicate.
3. **Previous value goes to history** — `history[0].payout` is the old payout.
4. **Unknown scenario is appended** — count becomes 249.
5. **History is capped at 10** — an 11th approval drops the oldest.
6. **Revert restores the previous value** — payout and actions both come back.
7. **Revert pops the history entry** so a second revert steps back further.
8. **Revert on a record with no history is a no-op**, not a crash.
9. **Input list is not mutated** — callers get a new list.

## Out of scope

- Keying by scenario id. No id exists in any of the three data files, and Torn
  does not expose one; a synthetic id would add indirection without safety.
- Pushing approvals to the `russianrob/torn-arson-recipes` GitHub repo. That is
  a separate dataset read by a different tool.
