# Torn Ancient Ones 1.0.3: the route so far, and the quarter hours

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** While M'aol is shielded, the box shows his route so far from the praetorians' falls. His next stop and where to fly count from the quarter hours he moves on, so they show even when the box didn't see him arrive.

**Architecture:** Client-only change to `server/public/scripts/torn-ancient-ones.user.js`. A helper builds the runs of falls (shared with `routes()`), and `routeSoFar(r)` turns them into a note under the shielded M'aol. `nextMark(ms)` gives the next :00/:15/:30/:45. `nextStop()` and `maolFly()` count from the quarter hour in which the box first saw him where he is (`stopFrom(m)`), instead of 15 minutes from when it first saw him arrive.

**Tech Stack:** a plain userscript; node:test + linkedom tests in `server/torn-ancient-ones.test.mjs`.

**Spec:** the owner's chat approval, 2026-10-30 16:07 EDT ("do recommended"):
- Q1: show his route building up as the minions fall ("route so far: Mexico > ...").
- Q2: "next" uses the clock marks (:00, :15, :30, :45) instead of 15 minutes after the box first spotted him.
- Q3: build and release 1.0.3 right away.

The owner's words: "will go next at :15 minute intervals".

## Global Constraints

- Note text, exactly:
  - `route so far <A> > <B> > ...`, with countries whose falls were under 30 s apart joined by `/` (their order isn't known);
  - `moves at :00 :15 :30 :45`, plus `, here since HH:MM TCT` when his arrival was seen in time;
  - `next <country>[ or <country>] about HH:MM TCT`.
- Never say where he appears first when the shield drops: nothing known says so.
- No new calls to Torn or TornStats. Plain ASCII source; text only via textContent.
- Bump `@version`, `VERSION` and a `v1.0.3` CHANGELOG entry together. `meta.js` = the header plus a newline. `@description` unchanged.
- Every test run in a worktree sets `TAO_SRC` to the worktree's script (the test reads main's file by absolute path otherwise).

## Review Focus

1. A reading gone stale across a quarter hour (a hidden tab draws but doesn't sweep): "next" shows the quarter hour he should have moved at, never a later one.
2. A fall with no time (before the box watched, no TornStats time yet): no "route so far" at all, never a guessed order.
3. Falls under 30 s apart: joined by `/`, never shown as an order.
4. Torn's API lags a move by up to a sweep: for up to a minute after a quarter hour the box may still show him in the country he left. His next stop and where to fly must still count from when the box first saw him there (amended after the final review, which found them a stop off).
5. A stop that starts after midnight: the end shows the date (the start's own formatting is unchanged).

---

### Task 1: The route so far, and the quarter hours (Q1, Q2)

**Files:**
- Modify: `server/public/scripts/torn-ancient-ones.user.js` (`routes()`, new `fallRuns()`, `routeSoFar()`, `nextMark()`, `seenHere()`, `stopFrom()`; `nextStop()`, `maolFly()`, `line()`)
- Test: `server/torn-ancient-ones.test.mjs`

**Interfaces:**
- Produces: `nextMark(ms: number): number` (the next multiple of `STOP_MS` after `ms`); `routeSoFar(r): string` ('' when none fell, any fall has no time, or a fallen one's country is unknown).
- `seenHere(m)` = `m.since || m.changedAt`. `stopFrom(m)` = `seenHere(m)` when that is at most 17 minutes before `m.readAt`, else `m.readAt`. `nextStop(r, ways)` returns `at = nextMark(stopFrom(m))`. `maolFly(r, way, nowMs)` counts stops from `nextMark(stopFrom(m)) - STOP_MS`, and shows nothing when `seenHere(m)` is set and more than 17 minutes back. (Amended after the final review: the plan first counted from `m.readAt`, which a cached reading just after a quarter hour puts a stop behind.)

- [ ] **Step 1: Write the failing tests.**
  - Wording: every `moves about every 15 min` becomes `moves at :00 :15 :30 :45`.
  - Next-stop and flight times: recomputed for the quarter hours. For example, Mexico seen at 10:46 is the 10:45-11:00 stop, so the next one is about 11:00, and BCT catches him there 10:45-11:00.
  - New: "while he is shielded, his route so far" (falls one a minute: `route so far Canada`, then `Canada > Cayman Islands > United Kingdom`, ...).
  - New: "route so far joins falls under 30 s apart with a slash, and shows nothing while a fall has no time" (`Cayman Islands/Canada`: inside a run the order is the praetorians' id order).
  - New: "a reading gone stale across a quarter hour shows the quarter hour he should have moved at" (`maolInMexico()`, hidden 15 min to 11:01: `next Cayman Islands about 11:00 TCT`).
  - New: "where to fly shows even when his arrival wasn't seen in time".
  - Retitle the two tests whose titles say the next stop or where to fly needs his arrival time.
- [ ] **Step 2: Run them.** `TAO_SRC=$PWD/server/public/scripts/torn-ancient-ones.user.js node --test server/torn-ancient-ones.test.mjs`. Expected: only the changed and new tests FAIL, on wording, times or missing notes.
- [ ] **Step 3: Implement** as in Interfaces.
- [ ] **Step 4: Run them.** Same command. Expected: all pass.
- [ ] **Step 5: Mutants.** Each of these must turn a test red, run with `TAO_SRC` on a temp copy:
  - `nextMark` from `nowMs` in place of `m.readAt`;
  - `+ STOP_MS` dropped;
  - the slash join as `' > '`;
  - the no-time guard removed;
  - the shielded note never pushed;
  - `!m.since` put back in `maolFly`.
- [ ] **Step 6: Commit** script and tests: "Torn Ancient Ones: his route so far while shielded, and his next stop on the quarter hour".

### Task 2: Version 1.0.3

**Files:** the script's header, `VERSION` and CHANGELOG; `server/public/scripts/torn-ancient-ones.meta.js`; the header test and `RUNNING` in `server/torn-ancient-ones.test.mjs`.

- [ ] **Step 1:** Change the header test to expect `version 1.0.3`, `VERSION = '1.0.3'`, a `v1.0.3` CHANGELOG line, and `RUNNING` 1.0.3. Run it: FAIL.
- [ ] **Step 2:** Bump, regenerate `meta.js` from the header, then run the whole file: all pass.
- [ ] **Step 3: Commit:** "Torn Ancient Ones 1.0.3".
