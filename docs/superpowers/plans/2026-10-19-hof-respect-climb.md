# Hall of Fame Respect Climb Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A public page at `/hof` that compares Dead Fragment's respect pace with the factions around it in Torn's faction Hall of Fame and projects the climb, fed by a job that saves Torn's daily faction snapshot.

**Architecture:** A pure maths module (`hof-climb.js`) turns saved daily snapshots into a digest. A daily job (`hof-snapshots.js`) saves Torn's snapshot for every UTC day through one request helper (`hof-torn.js`) and rebuilds the digest. `hof-api.js` merges the digest with one shared, background-refreshed copy of the live Hall of Fame rows around us, and a self-contained page renders it. Every module takes its fetch, clock, timers and data directory as parameters, so each is tested on its own.

**Tech Stack:** Node 20 ESM, Express 4 router, node-cron 4.2.1, `node --test`, `node:vm` for the page tests. Inline CSS and JS on the page. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-19-hof-respect-climb-design.md`

**Checked before writing:** every code block in this plan was run in a throwaway checkout of commit 69583c65. Each task's tests fail first for the reason given and then pass (59 tests in all, every earlier task still green). Breaking any of 15 key rules on purpose makes a test fail. The Task 14 check reproduces the spec's real-data anchors, and the page was looked at on a 390 px phone and a desktop, light and dark.

## Global Constraints

- Faction id from `OWNER_FACTION_ID`, default `42055`; key from `OWNER_API_KEY`. Decision 7: Dead Fragment only, no `?id=`.
- Every Torn call sends `Authorization: ApiKey <key>` (never the key in the URL), adds `comment=wb-hof`, and is recorded with `logCall(key, url, source, status)` from `key-usage-log.js`. Never log a key.
- Data lives in `join(process.env.DATA_DIR || join(__dirname, "data"), "hof")`, worked out at call time. Only the running server creates it; never create `server/data/hof/` by hand under another owner. Every write is a temporary file plus `renameSync`.
- Job: node-cron `'5 0 * * *'` with `{ timezone: "UTC", noOverlap: true }`; boot catch-up after 60 s; one 15-minute retry timer; 45-day candidate window; 1.1 s between calls; code 5 backs off 2 s × 1.8, up to 5 retries; key codes 1, 2, 10, 13, 16, 18 end the run without a retry.
- Windows 7, 30 and 90 days, offered only while `span ≤ w + max(2, ⌈w/10⌉)` (9, 33, 99). Horizons d = 7, 30, 91, 182, 365. Ties count in our favour.
- `/api/hof`: no key needed; `Cache-Control: public, max-age=60` (`no-store` on the 503 and the 500); a request never waits for Torn; at most one refresh attempt per 15 minutes.
- The page is `server/pages/hof.html`, never `server/public/hof.html`. No scripts from a CDN. Faction names are HTML-escaped.
- Tests: `node --test` from `/opt/warboard/server`. Every hof test file sets `process.env.DATA_DIR` to an `mkdtemp` directory before importing anything. Synthetic fixtures only: no real snapshot data in the repo.
- The spike snapshots and the one-off scripts stay in `/root/hof-spike/`, outside the repo. Never commit snapshot data.
- The repo is public: no key fragments and no security details in code, comments or commits.
- Deploy with `server/deploy.sh` (full suite, `pm2 reload warboard`, `/api/health`).

## Review Focus

Each line has a test in the task that owns the code.

1. Torn hasn't published today's file at 00:05 UTC, or a restart lands before it: retry every 15 minutes and never mark the day done (Task 9, "today's unpublished file arms the retry; a past day is asked again on a later UTC date").
2. pm2 kills the server between the raw write and the day write: the next run builds the day from the raw file without a call (Task 9, "a saved raw file stands in for the fetch; a broken one is fetched again", and "with no saved list, it keeps the raw file and builds the day once the check works").
3. The server misses some days: a window falls back to the nearest earlier day inside its limit or disappears, and "7 days" never silently means 31 (Task 2, the three window tests).
4. Torn is unreachable while someone has the page open: the last live copy with its own time, or midnight's standings labelled, and never an unhandled rejection (Task 11, "a failed refresh keeps the last answer..." and "no key means no refresh; errors become JSON, never a rejection").
5. A faction name containing HTML: escaped on the page (Task 13, "faction names from Torn are escaped").

## Files

| File | Responsibility |
|---|---|
| `server/hof-climb.js` | Pure maths: formats, positions, windows, paces, projection, days to pass, crowding note, digest |
| `server/hof-torn.js` | One Torn v2 request: header auth, `comment=wb-hof`, key-usage log, never throws |
| `server/hof-snapshots.js` | The daily job: candidates, fetch or reuse, hidden list, day files, digest build, scheduling |
| `server/hof-api.js` | `/api/hof`: digest plus the shared live window around us |
| `server/pages/hof.html` | The page |
| `server/routes.js` | Modified: `/hof`, `/api/hof`, the gate's public path |
| `server/server.js` | Modified: start and stop the job |
| `server/hof-*.test.mjs` | Five test files, one per module plus the route wiring |
| `/root/hof-spike/check.mjs`, `seed.mjs` | One-off scripts outside the repo |

---

### Task 1: Number formats and day helpers

**Files:**
- Create: `server/hof-climb.js`
- Create: `server/hof-climb.test.mjs`

**Interfaces:**
- Produces: `fmtNum(v: number) -> string`, `fmtPace(p: number|null) -> string`, `dayMs(day: "YYYY-MM-DD") -> number`, `utcDay(ms) -> "YYYY-MM-DD"`, `addDays(day, n) -> day`, `daysBetween(from, to) -> integer`, and the constants `DIGEST_VERSION = 1`, `WINDOWS = [7, 30, 90]`, `HORIZONS = [7, 30, 91, 182, 365]`.

- [ ] **Step 1: Write the failing test**

Create `server/hof-climb.test.mjs`:

```js
// The maths behind /hof (spec: docs/superpowers/specs/2026-10-19-hof-respect-climb-design.md).
// Synthetic factions only; the real-data anchors are checked outside the repo.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// No hof module may ever touch the live data directory from a test.
process.env.DATA_DIR = mkdtempSync(join(tmpdir(), "hof-climb-test-"));
const climb = await import("./hof-climb.js");

// ── number formats ──────────────────────────────────────────────────────
test("fmtNum picks its band from the rounded absolute value", () => {
  const cases = [
    [0, "0"], [188, "188"], [9876, "9,876"], [9999, "9,999"],
    [10000, "10.0k"], [74800, "74.8k"], [74850, "74.9k"], [99949, "99.9k"],
    [99950, "100k"], [99960, "100k"], [110914, "111k"], [999499, "999k"],
    [999500, "1.00M"], [1000000, "1.00M"], [1005000, "1.01M"], [3552938, "3.55M"],
    [9995000, "10.00M"],
    [-188, "-188"], [-9999, "-9,999"], [-10000, "-10.0k"], [-33882, "-33.9k"],
    [-99960, "-100k"], [-1000000, "-1.00M"],
  ];
  for (const [v, want] of cases) assert.equal(climb.fmtNum(v), want, String(v));
});

test("fmtPace rounds halves away from zero and never prints -0", () => {
  const cases = [
    [7752.032, "7,752/day"], [7752.5, "7,753/day"], [-7752.5, "-7,753/day"],
    [-1234.6, "-1,235/day"], [-0.3, "0/day"], [0, "0/day"], [NaN, "—"], [null, "—"],
  ];
  for (const [v, want] of cases) assert.equal(climb.fmtPace(v), want, String(v));
});
```

- [ ] **Step 2: Run it to make sure it fails**

```bash
cd /opt/warboard/server && node --test hof-climb.test.mjs
```

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `./hof-climb.js`.

- [ ] **Step 3: Write the minimal implementation**

Create `server/hof-climb.js`:

```js
// Hall of Fame respect climb: every number /hof shows.
//
// Pure: no I/O and no clock of its own. The daily job (hof-snapshots.js) hands
// it saved snapshots and gets the digest back, so the page has no arithmetic of
// its own to get wrong. The rules, and the reasons for them, are in
// docs/superpowers/specs/2026-10-19-hof-respect-climb-design.md.

export const DIGEST_VERSION = 1;
export const WINDOWS = [7, 30, 90];
export const HORIZONS = [7, 30, 91, 182, 365];
const DAY_MS = 86400000;

export const dayMs = (day) => Date.parse(day + "T00:00:00Z");
export const utcDay = (ms) => new Date(ms).toISOString().slice(0, 10);
export const addDays = (day, n) => utcDay(dayMs(day) + n * DAY_MS);
export const daysBetween = (from, to) => Math.round((dayMs(to) - dayMs(from)) / DAY_MS);

// ── number formats ────────────────────────────────────────────────────────
// Every band rounds a scaled whole number and builds the text from integers,
// so a binary fraction never decides which side of a boundary a value lands.
const sep = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");

export function fmtNum(v) {
  const a = Math.abs(v), s = v < 0 ? "-" : "";
  const whole = Math.round(a);
  if (whole === 0) return "0";
  if (whole < 10000) return s + sep(whole);
  const tenthsK = Math.round(a / 100);
  if (tenthsK < 1000) return s + Math.floor(tenthsK / 10) + "." + (tenthsK % 10) + "k";
  const k = Math.round(a / 1000);
  if (k < 1000) return s + k + "k";
  const hundredthsM = Math.round(a / 10000);
  return s + Math.floor(hundredthsM / 100) + "." + String(hundredthsM % 100).padStart(2, "0") + "M";
}

export function fmtPace(p) {
  if (!Number.isFinite(p)) return "—";
  // Halves away from zero, and a pace that rounds to nothing is "0", never "-0".
  const r = Math.sign(p) * Math.round(Math.abs(p));
  return (r < 0 ? "-" : "") + sep(Math.abs(r)) + "/day";
}
```

- [ ] **Step 4: Run the tests and make sure they pass**

```bash
cd /opt/warboard/server && node --test hof-climb.test.mjs
```

Expected: `# tests 2`, `# pass 2`, `# fail 0`.

- [ ] **Step 5: Commit**

```bash
cd /opt/warboard && git add server/hof-climb.js server/hof-climb.test.mjs && \
  git commit -m "HoF climb: number formats and day helpers" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Positions, pace windows and paces

**Files:**
- Modify: `server/hof-climb.js` (append)
- Modify: `server/hof-climb.test.mjs` (append)

**Interfaces:**
- Consumes: `addDays`, `daysBetween`, `WINDOWS` (Task 1).
- Produces: `positionOf(respect: {[id]: number}, hidden: number[], id) -> number|null`, `historyEntry(day, data: {respect, hidden}, us) -> {day, position, respect}`, `windowLimit(w) -> number`, `resolveWindows(days: string[], latest) -> {[w]: {base, span}}`, `pacesFor(byDay: {[day]: {respect, hidden}}, latest, win: {base, span}) -> {[id]: number}`.

- [ ] **Step 1: Write the failing tests**

Append to the end of `server/hof-climb.test.mjs`, after a blank line:

```js
// ── positions, windows, paces ───────────────────────────────────────────
test("position counts only strictly greater respect, so a tie is in our favour", () => {
  const respect = { 1: 500, 2: 300, 3: 300, 42055: 300, 4: 100 };
  assert.equal(climb.positionOf(respect, [], 42055), 2);
  assert.equal(climb.positionOf(respect, [], 2), 2);
});

test("position leaves out the day's hidden factions", () => {
  const respect = { 1: 500, 2: 400, 42055: 300 };
  assert.equal(climb.positionOf(respect, [2], 42055), 2);
  assert.equal(climb.positionOf(respect, [], 99), null);
});

const daysFrom = (first, last, skip = []) => {
  const out = [];
  for (let d = first; d <= last; d = climb.addDays(d, 1)) if (!skip.includes(d)) out.push(d);
  return out;
};

test("a window with every day saved spans exactly w days", () => {
  const days = daysFrom("2026-07-01", "2026-10-19");
  assert.deepEqual(climb.resolveWindows(days, "2026-10-19"), {
    7: { base: "2026-10-12", span: 7 },
    30: { base: "2026-09-19", span: 30 },
    90: { base: "2026-07-21", span: 90 },
  });
});

test("a missing base day falls back to the nearest earlier day inside the limit", () => {
  const days = daysFrom("2026-09-01", "2026-10-19", ["2026-10-12"]);
  assert.deepEqual(climb.resolveWindows(days, "2026-10-19")[7], { base: "2026-10-11", span: 8 });
});

test("a window whose base is past its limit is not offered", () => {
  // The spike's three days: 31 days back is fine for 30 (limit 33), not for 7 (limit 9).
  const w = climb.resolveWindows(["2026-09-18", "2026-10-18", "2026-10-19"], "2026-10-19");
  assert.deepEqual(w, { 30: { base: "2026-09-18", span: 31 } });
  assert.deepEqual([7, 30, 90].map(climb.windowLimit), [9, 33, 99]);
});

test("paces are exact differences: base day, else the first saved day, else none", () => {
  const byDay = {
    "2026-09-19": { respect: { 42055: 1000, 1: 900, 2: 5000, 4: 700 }, hidden: [4] },
    "2026-10-18": { respect: { 42055: 3800, 1: 950, 2: 5000, 3: 50000, 4: 1300 }, hidden: [] },
    "2026-10-19": { respect: { 42055: 4000, 1: 960, 2: 4700, 3: 50000, 4: 1600, 5: 5000, 6: 9000 }, hidden: [6] },
  };
  const p = climb.pacesFor(byDay, "2026-10-19", { base: "2026-09-19", span: 30 });
  assert.equal(p[42055], 100);
  assert.equal(p[1], 2);
  assert.equal(p[2], -10, "a pace can be negative");
  assert.equal(p[3], 0, "first seen on 10-18 at 50,000 and flat since: 0, not 50,000 / age");
  assert.equal(p[4], 30, "hidden at the base, visible now: still measured from the base");
  assert.ok(!(5 in p), "seen only at L: no pace");
  assert.ok(!(6 in p), "hidden at L: no pace");
});
```

- [ ] **Step 2: Run them to make sure they fail**

```bash
cd /opt/warboard/server && node --test hof-climb.test.mjs
```

Expected: 6 of 8 tests fail, first with `climb.positionOf is not a function`.

- [ ] **Step 3: Write the minimal implementation**

Append to the end of `server/hof-climb.js`, after a blank line:

```js
// ── positions, windows, paces ─────────────────────────────────────────────
// 1 + the factions with strictly more respect that the Hall of Fame shows,
// so a tie counts in the faction's favour.
export function positionOf(respect, hidden, id) {
  const key = String(id), mine = respect[key];
  if (!(mine > 0)) return null;
  const hide = new Set((hidden || []).map(String));
  let ahead = 0;
  for (const k in respect) if (respect[k] > mine && k !== key && !hide.has(k)) ahead++;
  return 1 + ahead;
}

export function historyEntry(day, data, us) {
  return { day, position: positionOf(data.respect, data.hidden, us), respect: data.respect[String(us)] ?? null };
}

// A window is offered only when a saved day sits close to L − w; further back,
// "7 days" would really be measuring a longer stretch.
export const windowLimit = (w) => w + Math.max(2, Math.ceil(w / 10));

export function resolveWindows(days, latest) {
  const out = {};
  for (const w of WINDOWS) {
    const target = addDays(latest, -w);
    let base = null;
    for (const d of days) if (d <= target) base = d;
    if (base === null) continue;
    const span = daysBetween(base, latest);
    if (span <= windowLimit(w)) out[w] = { base, span };
  }
  return out;
}

// byDay holds every saved day from the window's base to `latest`. A faction
// missing at the base is measured from the first saved day it appears on, so
// every pace is an exact difference between two snapshots. One seen only at
// `latest` gets no pace. Hidden factions get none either; a faction hidden at
// the base but visible now still uses its base respect.
export function pacesFor(byDay, latest, win) {
  const L = byDay[latest], B = byDay[win.base];
  const hide = new Set((L.hidden || []).map(String));
  const between = Object.keys(byDay).filter((d) => d > win.base && d < latest).sort();
  const out = {};
  for (const id in L.respect) {
    if (hide.has(id)) continue;
    const now = L.respect[id];
    if (B.respect[id] > 0) { out[id] = (now - B.respect[id]) / win.span; continue; }
    const first = between.find((d) => byDay[d].respect[id] > 0);
    if (first) out[id] = (now - byDay[first].respect[id]) / daysBetween(first, latest);
  }
  return out;
}
```

- [ ] **Step 4: Run the tests and make sure they pass**

```bash
cd /opt/warboard/server && node --test hof-climb.test.mjs
```

Expected: `# tests 8`, `# pass 8`, `# fail 0`.

- [ ] **Step 5: Commit**

```bash
cd /opt/warboard && git add server/hof-climb.js server/hof-climb.test.mjs && \
  git commit -m "HoF climb: positions, pace windows and paces" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Projection and days to pass

**Files:**
- Modify: `server/hof-climb.js` (append)
- Modify: `server/hof-climb.test.mjs` (append)

**Interfaces:**
- Consumes: `HORIZONS` (Task 1).
- Produces: `projectPositions(latestRespect, paces, us, days = 365) -> number[]|null` (index d − 1 is day d), `horizonsOf(projection) -> {7, 30, 91, 182, 365}`, `daysToPass({above, gap, pace, usPace}) -> number|null`.

- [ ] **Step 1: Write the failing tests**

Append to the end of `server/hof-climb.test.mjs`, after a blank line:

```js
// ── projection and pass days ────────────────────────────────────────────
test("projected positions count every faction at its own pace", () => {
  const respect = { 42055: 1000, 1: 1050, 2: 2000, 3: 900 };
  const paces = { 42055: 100, 1: 0, 2: 0, 3: 150 };
  const proj = climb.projectPositions(respect, paces, 42055);
  assert.equal(proj.length, 365);
  assert.equal(proj[0], 2, "d=1: passed 1, 3 not yet past us");
  assert.equal(proj[364], 2, "d=365: passed 1 and 2, overtaken by 3");
  assert.equal(climb.projectPositions(respect, { 1: 0 }, 42055), null, "no pace for us: no projection");
});

test("the horizons are entries 7, 30, 91, 182 and 365", () => {
  const proj = Array.from({ length: 365 }, (_, i) => 1000 - i);
  assert.deepEqual(climb.horizonsOf(proj), { 7: 994, 30: 971, 91: 910, 182: 819, 365: 636 });
});

test("days to pass for rows above and below us", () => {
  const above = (gap, pace, usPace) => climb.daysToPass({ above: true, gap, pace, usPace });
  const below = (gap, pace, usPace) => climb.daysToPass({ above: false, gap, pace, usPace });
  assert.equal(above(1000, 50, 150), 10);
  assert.equal(above(1000, 150, 150), null, "as fast as us: pulling away");
  assert.equal(above(1000, 200, 150), null);
  assert.equal(above(-5, 50, 150), 0, "level or already behind: today");
  assert.equal(below(-1000, 250, 150), 10);
  assert.equal(below(-1000, 100, 150), null);
  assert.equal(above(1000, NaN, 150), null);
  assert.equal(below(-1000, 250, undefined), null);
});
```

- [ ] **Step 2: Run them to make sure they fail**

```bash
cd /opt/warboard/server && node --test hof-climb.test.mjs
```

Expected: 3 of 11 tests fail, first with `climb.projectPositions is not a function`.

- [ ] **Step 3: Write the minimal implementation**

Append to the end of `server/hof-climb.js`, after a blank line:

```js
// ── projection and the table's pass days ──────────────────────────────────
// Our position for d = 1 … days, with every faction keeping its own pace.
export function projectPositions(latestRespect, paces, us, days = 365) {
  const me = String(us);
  if (!(me in paces)) return null;
  const ids = Object.keys(paces).filter((id) => id !== me);
  const start = ids.map((id) => latestRespect[id]), pace = ids.map((id) => paces[id]);
  const out = [];
  for (let d = 1; d <= days; d++) {
    const mine = latestRespect[me] + d * paces[me];
    let ahead = 0;
    for (let i = 0; i < ids.length; i++) if (start[i] + d * pace[i] > mine) ahead++;
    out.push(1 + ahead);
  }
  return out;
}

export const horizonsOf = (projection) =>
  Object.fromEntries(HORIZONS.map((d) => [d, projection ? projection[d - 1] : null]));

// Days until the gap closes, or null when it never does. `above` means the row
// sits above us in the table; gap is their respect minus ours.
export function daysToPass({ above, gap, pace, usPace }) {
  if (!Number.isFinite(pace) || !Number.isFinite(usPace)) return null;
  if (above) return usPace > pace ? Math.max(0, gap) / (usPace - pace) : null;
  return pace > usPace ? Math.max(0, -gap) / (pace - usPace) : null;
}
```

- [ ] **Step 4: Run the tests and make sure they pass**

```bash
cd /opt/warboard/server && node --test hof-climb.test.mjs
```

Expected: `# tests 11`, `# pass 11`, `# fail 0`.

- [ ] **Step 5: Commit**

```bash
cd /opt/warboard && git add server/hof-climb.js server/hof-climb.test.mjs && \
  git commit -m "HoF climb: projection and days to pass" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Crowding note

**Files:**
- Modify: `server/hof-climb.js` (append)
- Modify: `server/hof-climb.test.mjs` (append)

**Interfaces:**
- Consumes: `fmtNum` (Task 1).
- Produces: `crowdingNote({latestRespect, hidden, paces, us, basePosition, position, projected30}) -> string|null`.

- [ ] **Step 1: Write the failing tests**

Append to the end of `server/hof-climb.test.mjs`, after a blank line:

```js
// ── crowding note ───────────────────────────────────────────────────────
// Us at 1,000 gaining 100 a day. Six factions sit 100–600 above and stand
// still; one at 350 above is faster than us; one is far ahead.
const CROWD = {
  latestRespect: { 42055: 1000, a1: 1100, a2: 1200, a3: 1300, a4: 1400, a5: 1500, a6: 1600, c: 1350, d: 50000 },
  paces: { 42055: 100, a1: 0, a2: 0, a3: 0, a4: 0, a5: 0, a6: 0, c: 200, d: 0 },
  hidden: [], us: 42055,
};
const note = (over) => climb.crowdingNote({ ...CROWD, ...over });

test("a crowded month gets the approved sentence, counting every faction within X", () => {
  // We pass six (gaps up to 600), and seven factions sit within 600 because c does too.
  assert.equal(note({ basePosition: 11, position: 9, projected30: 3 }),
    "We climbed 2 places last month (#11 to #9). At this pace we climb 6 in the next month, " +
    "because 7 factions are within 600 respect above us.");
});

test("the faster note after a flat or falling month, with singular forms", () => {
  const one = { latestRespect: { 42055: 1000, a1: 1100, d: 50000 }, paces: { 42055: 100, a1: 0, d: 0 } };
  assert.equal(note({ ...one, basePosition: 7, position: 9, projected30: 8 }),
    "We fell 2 places last month (#7 to #9). At this pace we climb 1 in the next month, " +
    "because 1 faction is within 100 respect above us.");
  assert.match(note({ basePosition: 9, position: 9, projected30: 6 }), /^We held #9 last month\. /);
  assert.match(note({ basePosition: 8, position: 9, projected30: 7 }), /^We fell 1 place last month \(#8 to #9\)\. /);
});

test("a sparse month gets the slower note and the nearest faction we don't reach", () => {
  // c (350 ahead, faster) and d stay ahead at d = 30; c is the nearer one.
  assert.equal(note({ basePosition: 19, position: 9, projected30: 7 }),
    "We climbed 10 places last month (#19 to #9). At this pace we climb only 2 in the next month. " +
    "The nearest faction above us that we don't reach this month is 350 respect ahead.");
  assert.match(note({ basePosition: 19, position: 9, projected30: 9 }), / At this pace we hold #9 for the next month\. /);
  assert.match(note({ basePosition: 19, position: 9, projected30: 10 }), / At this pace we fall 1 place in the next month\. /);
});

test("no note inside the 3-place margin, at #1, or without a 30-day base", () => {
  assert.equal(note({ basePosition: 10, position: 9, projected30: 7 }), null, "1 then 2: noise");
  assert.equal(note({ basePosition: 19, position: 9, projected30: 1 }), null, "we would reach #1");
  assert.equal(note({ basePosition: null, position: 9, projected30: 3 }), null);
});
```

- [ ] **Step 2: Run them to make sure they fail**

```bash
cd /opt/warboard/server && node --test hof-climb.test.mjs
```

Expected: 4 of 15 tests fail, first with `climb.crowdingNote is not a function`.

- [ ] **Step 3: Write the minimal implementation**

Append to the end of `server/hof-climb.js`, after a blank line:

```js
// ── crowding note ─────────────────────────────────────────────────────────
const places = (n) => (n === 1 ? "1 place" : n + " places");

// Explains a coming month that moves much faster or slower than the last one.
// Positions are midnight positions; projected30 is our projected position at
// d = 30 for the window whose paces are passed in.
export function crowdingNote({ latestRespect, hidden, paces, us, basePosition, position, projected30 }) {
  if (basePosition == null || position == null || projected30 == null) return null;
  const me = String(us), last = basePosition - position, next = position - projected30;
  const hide = new Set((hidden || []).map(String));
  const mine = latestRespect[me], mine30 = mine + 30 * paces[me];
  const ahead = Object.keys(latestRespect).filter((id) => id !== me && !hide.has(id) && latestRespect[id] > mine);
  const at30 = (id) => (id in paces ? latestRespect[id] + 30 * paces[id] : null);
  const head = last > 0 ? `We climbed ${places(last)} last month (#${basePosition} to #${position}).`
    : last === 0 ? `We held #${position} last month.`
    : `We fell ${places(-last)} last month (#${basePosition} to #${position}).`;

  if (next > 0 && next >= 2 * last && next >= last + 3) {
    const passed = ahead.filter((id) => at30(id) !== null && at30(id) <= mine30);
    if (!passed.length) return null;
    const X = Math.max(...passed.map((id) => latestRespect[id] - mine));
    const M = ahead.filter((id) => latestRespect[id] - mine <= X).length;
    return `${head} At this pace we climb ${next} in the next month, because ${M} ` +
      `${M === 1 ? "faction is" : "factions are"} within ${fmtNum(X)} respect above us.`;
  }
  if (last > 0 && next <= last / 2 && next <= last - 3 && projected30 !== 1) {
    const mid = next > 0 ? `At this pace we climb only ${next} in the next month.`
      : next === 0 ? `At this pace we hold #${position} for the next month.`
      : `At this pace we fall ${places(-next)} in the next month.`;
    const still = ahead.filter((id) => at30(id) !== null && at30(id) > mine30).map((id) => latestRespect[id] - mine);
    const tail = still.length
      ? ` The nearest faction above us that we don't reach this month is ${fmtNum(Math.min(...still))} respect ahead.`
      : "";
    return `${head} ${mid}${tail}`;
  }
  return null;
}
```

- [ ] **Step 4: Run the tests and make sure they pass**

```bash
cd /opt/warboard/server && node --test hof-climb.test.mjs
```

Expected: `# tests 15`, `# pass 15`, `# fail 0`.

- [ ] **Step 5: Commit**

```bash
cd /opt/warboard && git add server/hof-climb.js server/hof-climb.test.mjs && \
  git commit -m "HoF climb: crowding note" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: The digest

**Files:**
- Modify: `server/hof-climb.js` (append)
- Modify: `server/hof-climb.test.mjs` (append)

**Interfaces:**
- Consumes: everything from Tasks 1–4.
- Produces: `midnightTable(data, names, us) -> {position, respect, rows: [{position, id, name, respect}]}|null`, `computeDigest({byDay, history, names, factionId, builtAt}) -> {version, factionId, day, builtAt, windows, paces: {[id]: {[w]: number}}, history, projection: {[w]: number[365]}, notes: {[w]: string|null}, midnight}`.

- [ ] **Step 1: Write the failing tests**

Append to the end of `server/hof-climb.test.mjs`, after a blank line:

```js
// ── the digest ──────────────────────────────────────────────────────────
test("the midnight table is 20 above, us and 5 below, in Hall of Fame order", () => {
  const respect = { 42055: 1000 };
  for (let i = 1; i <= 30; i++) respect[i] = 1000 + i * 10;  // 30 above
  for (let i = 31; i <= 40; i++) respect[i] = 1000 - (i - 30) * 10;  // 10 below
  respect[99] = 5000;  // hidden
  const t = climb.midnightTable({ respect, hidden: [99] }, { 20: "<Top> & co" }, 42055);
  assert.equal(t.position, 31);
  assert.equal(t.rows.length, 26);
  assert.deepEqual([t.rows[0].position, t.rows[20].id, t.rows[25].position], [11, 42055, 36]);
  assert.equal(t.rows[0].name, "<Top> & co", "names are data; the page escapes them");
  assert.equal(t.rows[1].name, "#19", "a missing name falls back to the id");
});

test("computeDigest puts every piece in the shape the API reads", () => {
  const byDay = {
    "2026-09-18": { respect: { 42055: 1000, 1: 2000, 2: 1500 }, hidden: [] },
    "2026-10-18": { respect: { 42055: 3900, 1: 2000, 2: 1500, 3: 5000 }, hidden: [] },
    "2026-10-19": { respect: { 42055: 4100, 1: 2000, 2: 1500, 3: 5000 }, hidden: [] },
  };
  const history = Object.keys(byDay).map((d) => climb.historyEntry(d, byDay[d], 42055));
  const dg = climb.computeDigest({ byDay, history, names: { 1: "One" }, factionId: 42055, builtAt: 123 });
  assert.equal(dg.version, climb.DIGEST_VERSION);
  assert.equal(dg.day, "2026-10-19");
  assert.deepEqual(dg.windows, { 30: { base: "2026-09-18", span: 31 } });
  assert.equal(dg.paces[42055][30], 100);
  assert.equal(dg.paces[3][30], 0, "3 first appears on 10-18");
  assert.deepEqual(dg.history.map((h) => h.position), [3, 2, 2]);
  assert.equal(dg.projection[30].length, 365);
  assert.equal(dg.notes[30], null, "climbing 1 then 0: no note");
  assert.equal(dg.midnight.position, 2);
  assert.equal(dg.midnight.rows[0].id, 3);
});
```

- [ ] **Step 2: Run them to make sure they fail**

```bash
cd /opt/warboard/server && node --test hof-climb.test.mjs
```

Expected: 2 of 17 tests fail, first with `climb.midnightTable is not a function`.

- [ ] **Step 3: Write the minimal implementation**

Append to the end of `server/hof-climb.js`, after a blank line:

```js
// ── the digest ────────────────────────────────────────────────────────────
// The fallback table at L: 20 above us, us and 5 below, in Hall of Fame order.
export function midnightTable(data, names, us) {
  const me = String(us), hide = new Set((data.hidden || []).map(String));
  const list = Object.keys(data.respect).filter((id) => !hide.has(id))
    .map((id) => ({ id, respect: data.respect[id] }))
    .sort((a, b) => b.respect - a.respect || Number(a.id) - Number(b.id));
  let position = 0;
  list.forEach((r, i) => {
    if (i === 0 || r.respect !== list[i - 1].respect) position = i + 1;
    r.position = position;
  });
  const i = list.findIndex((r) => r.id === me);
  if (i < 0) return null;
  const rows = list.slice(Math.max(0, i - 20), i + 6).map((r) => ({
    position: r.position, id: Number(r.id), name: (names && names[r.id]) || `#${r.id}`, respect: r.respect,
  }));
  return { position: list[i].position, respect: list[i].respect, rows };
}

// byDay: the recent saved days (at least the last 100, which covers the 90-day
// window's limit); history: one historyEntry per saved day, oldest first;
// names: id -> name at the latest day.
export function computeDigest({ byDay, history, names, factionId, builtAt }) {
  const days = Object.keys(byDay).sort();
  const latest = days[days.length - 1], L = byDay[latest], us = String(factionId);
  const windows = resolveWindows(days, latest);
  const positionAt = Object.fromEntries(history.map((h) => [h.day, h.position]));
  const paces = {}, projection = {}, notes = {};
  for (const w of Object.keys(windows)) {
    const p = pacesFor(byDay, latest, windows[w]);
    for (const id in p) (paces[id] ||= {})[w] = Math.round(p[id] * 100) / 100;
    projection[w] = projectPositions(L.respect, p, us);
    notes[w] = windows[30] && projection[w]
      ? crowdingNote({
          latestRespect: L.respect, hidden: L.hidden, paces: p, us,
          basePosition: positionAt[windows[30].base] ?? null,
          position: positionAt[latest] ?? null,
          projected30: projection[w][29],
        })
      : null;
  }
  return {
    version: DIGEST_VERSION, factionId: Number(factionId), day: latest, builtAt,
    windows, paces, history, projection, notes, midnight: midnightTable(L, names, us),
  };
}
```

- [ ] **Step 4: Run the tests and make sure they pass**

```bash
cd /opt/warboard/server && node --test hof-climb.test.mjs
```

Expected: `# tests 17`, `# pass 17`, `# fail 0`.

- [ ] **Step 5: Commit**

```bash
cd /opt/warboard && git add server/hof-climb.js server/hof-climb.test.mjs && \
  git commit -m "HoF climb: the digest" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Torn request helper

**Files:**
- Create: `server/hof-torn.js`
- Create: `server/hof-torn.test.mjs`

**Interfaces:**
- Consumes: `logCall` from `server/key-usage-log.js` (existing).
- Produces: `tornGet(path, params, {key, fetchImpl = fetch, source = "hof", timeoutMs = 30000}) -> Promise<{ok: true, status, text} | {ok: false, code, message}>`. `code` is Torn's error code, `"http_<status>"`, `"timeout"` or `"network"`. It never throws.

- [ ] **Step 1: Write the failing tests**

Create `server/hof-torn.test.mjs`:

```js
// The one Torn request helper behind /hof.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

process.env.DATA_DIR = mkdtempSync(join(tmpdir(), "hof-torn-test-"));
const { tornGet } = await import("./hof-torn.js");
const { getRecent } = await import("./key-usage-log.js");

const KEY = "test-key-hof";
const reply = (body, status = 200) => ({ status, ok: status >= 200 && status < 300, text: async () => body });
function fake(respond) {
  const calls = [];
  const fetchImpl = async (url, init) => { calls.push({ url, init }); return respond(url, init); };
  return { fetchImpl, calls };
}

test("the key goes in the Authorization header, never the URL, and the call is labelled", async () => {
  const f = fake(() => reply('{"factionhof":[]}'));
  const r = await tornGet("/torn/factionhof", { cat: "respect", limit: 100, offset: 200 }, { key: KEY, fetchImpl: f.fetchImpl });
  assert.equal(r.ok, true);
  assert.equal(r.text, '{"factionhof":[]}');
  const { url, init } = f.calls[0];
  assert.equal(init.headers.Authorization, "ApiKey " + KEY);
  assert.ok(!url.includes(KEY), "key leaked into the URL");
  const u = new URL(url);
  assert.equal(u.origin + u.pathname, "https://api.torn.com/v2/torn/factionhof");
  assert.equal(u.searchParams.get("comment"), "wb-hof");
  assert.equal(u.searchParams.get("offset"), "200");
});

test("every call lands in the key-usage log under its source", async () => {
  const f = fake(() => reply("id,name,respect\n"));
  await tornGet("/faction/snapshot", { timestamp: 1792368000 }, { key: KEY, fetchImpl: f.fetchImpl, source: "hof-usage-test" });
  const mine = getRecent(10, KEY.slice(-4)).entries.filter((e) => e.source === "hof-usage-test");
  assert.equal(mine.length, 1);
  assert.equal(mine[0].endpoint, "/v2/faction/snapshot");
  assert.equal(mine[0].status, 200);
});

test("a Torn error object comes back as its code, even with HTTP 200", async () => {
  const f = fake(() => reply('{"error":{"code":30,"error":"File does not exist"}}'));
  assert.deepEqual(await tornGet("/faction/snapshot", {}, { key: KEY, fetchImpl: f.fetchImpl }),
    { ok: false, code: 30, message: "File does not exist" });
});

test("other failures come back as http_<status>, timeout or network", async () => {
  const bad = fake(() => reply("<html>Bad gateway</html>", 502));
  assert.equal((await tornGet("/torn/factionhof", {}, { key: KEY, fetchImpl: bad.fetchImpl })).code, "http_502");

  // A request that never answers. The pending timer stands in for the open
  // socket that keeps a real fetch's event loop alive.
  const slow = fake((_url, init) => new Promise((_resolve, reject) => {
    const socket = setTimeout(() => {}, 5000);
    init.signal.addEventListener("abort", () => { clearTimeout(socket); reject(init.signal.reason); });
  }));
  assert.equal((await tornGet("/torn/factionhof", {}, { key: KEY, fetchImpl: slow.fetchImpl, timeoutMs: 20 })).code, "timeout");

  const down = fake(() => { throw new TypeError("fetch failed"); });
  assert.equal((await tornGet("/torn/factionhof", {}, { key: KEY, fetchImpl: down.fetchImpl })).code, "network");
});

test("it never throws, even when reading the body does", async () => {
  const f = fake(() => ({ status: 200, ok: true, text: async () => { throw new Error("socket hang up"); } }));
  const r = await tornGet("/torn/factionhof", {}, { key: KEY, fetchImpl: f.fetchImpl });
  assert.equal(r.ok, false);
  assert.equal(r.code, "network");
});
```

- [ ] **Step 2: Run them to make sure they fail**

```bash
cd /opt/warboard/server && node --test hof-torn.test.mjs
```

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `./hof-torn.js`.

- [ ] **Step 3: Write the minimal implementation**

Create `server/hof-torn.js`:

```js
// One Torn API v2 request for /hof and its daily job.
//
// The key travels in the Authorization header, never in the URL, so it can't
// end up in a logged URL. Every call is tagged comment=wb-hof in Torn's own API
// log and recorded in warboard's key-usage log. It never throws: every failure
// comes back as { ok: false, code, message }, and callers do their own retries.
import { logCall } from "./key-usage-log.js";

export async function tornGet(path, params = {}, { key, fetchImpl = fetch, source = "hof", timeoutMs = 30000 } = {}) {
  const url = `https://api.torn.com/v2${path}?${new URLSearchParams({ ...params, comment: "wb-hof" })}`;
  try {
    const res = await fetchImpl(url, {
      headers: { Authorization: `ApiKey ${key}` },
      signal: AbortSignal.timeout(timeoutMs),
    });
    const text = await res.text();
    const err = tornError(text);
    logCall(key, url, source, err ? err.code : res.status);
    if (err) return { ok: false, code: err.code, message: err.message };
    if (!res.ok) return { ok: false, code: `http_${res.status}`, message: text.slice(0, 200) };
    return { ok: true, status: res.status, text };
  } catch (e) {
    const code = e && (e.name === "TimeoutError" || e.name === "AbortError") ? "timeout" : "network";
    logCall(key, url, source, code);
    return { ok: false, code, message: String((e && e.message) || e) };
  }
}

// Torn reports errors as {"error":{"code":N,"error":"..."}}, usually with HTTP 200.
function tornError(text) {
  if (!text || text.trimStart()[0] !== "{") return null;
  try {
    const j = JSON.parse(text);
    return j && j.error && typeof j.error === "object" ? { code: j.error.code, message: String(j.error.error || "") } : null;
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Run the tests and make sure they pass**

```bash
cd /opt/warboard/server && node --test hof-torn.test.mjs
```

Expected: `# tests 5`, `# pass 5`, `# fail 0`.

- [ ] **Step 5: Commit**

```bash
cd /opt/warboard && git add server/hof-torn.js server/hof-torn.test.mjs && \
  git commit -m "HoF climb: Torn request helper" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Snapshot parsing

**Files:**
- Create: `server/hof-snapshots.js`
- Create: `server/hof-snapshots.test.mjs`

**Interfaces:**
- Consumes: `tornGet` (Task 6); `DIGEST_VERSION`, `addDays`, `computeDigest`, `dayMs`, `historyEntry`, `utcDay` (Tasks 1–5). The import block below already carries everything later tasks in this file use.
- Produces: `defaultDataDir() -> string`, `parseSnapshotCsv(text) -> {columns: {[name]: index}, rows: string[][], skipped}`, `snapshotFacts(parsed) -> {respect: {[id]: number}, names: {[id]: string}, count, skipped}`. Every job function takes `opts = {dataDir, fetchImpl, nowFn, key, factionId, sleep, cron, timers}`; `context(opts)` fills the defaults.

The test file's header also holds the fixtures Tasks 8–10 use: a 600-faction world with us at #250, faction 77 hidden at #171 and 88 hidden near #402, a fake Torn, and a fake clock.

- [ ] **Step 1: Write the failing tests**

Create `server/hof-snapshots.test.mjs`:

```js
// The daily job behind /hof: what it fetches, what it saves, when it runs.
// A fake Torn and a fake clock; every test gets its own temporary data dir.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gunzipSync, gzipSync } from "node:zlib";

process.env.DATA_DIR = mkdtempSync(join(tmpdir(), "hof-snapshots-test-"));
const {
  parseSnapshotCsv, snapshotFacts, missingDays, runOnce, startHofSnapshots, stopHofSnapshots,
} = await import("./hof-snapshots.js");
const { DIGEST_VERSION } = await import("./hof-climb.js");

const US = 42055, KEY = "test-key-hof";
const HEADER = "id,name,tag,tag_image,banner_image,leader_id,co_leader_id,respect,days_old,rank,members,members_max,member_list,recruiting,destroyed_timestamp";
const csvOf = (factions) => HEADER + "\n" + factions.map((f) =>
  [f.id, `"${f.name}"`, "T", "t.png", "b.png", 1, 2, f.respect, 900, "Gold III", 20, 100, '"1,2,3"', 0, ""].join(",")
).join("\n") + "\n";

// 600 factions 2,000,000 down in steps of 1,000, us at #250. Faction 77 sits at
// #171 in the snapshot and 88 near #402, and the Hall of Fame shows neither.
const WORLD = Array.from({ length: 600 }, (_, i) => ({ id: 1000 + i, name: "F" + i, respect: 2000000 - i * 1000 }))
  .concat([{ id: US, name: "Dead Fragment", respect: 1751500 }, { id: 77, name: "Hidden", respect: 1830500 },
    { id: 88, name: "Hidden too", respect: 1600500 }]);
const SNAP = csvOf(WORLD);
const HOF = WORLD.filter((f) => f.id !== 77 && f.id !== 88).sort((a, b) => b.respect - a.respect);

const reply = (body, status = 200) => ({ status, ok: status >= 200 && status < 300, text: async () => body });
const tornErr = (code, error) => reply(JSON.stringify({ error: { code, error } }));
const dayOf = (ts) => new Date(Number(ts) * 1000).toISOString().slice(0, 10);

const clock = { now: 0, sleeps: [] };
function fakeTorn({ days = {}, onSnapshot = null, onHof = null } = {}) {
  const calls = [];
  const fetchImpl = async (url) => {
    const u = new URL(url);
    calls.push({ path: u.pathname, params: Object.fromEntries(u.searchParams), at: clock.now });
    if (u.pathname === "/v2/faction/snapshot") {
      const day = dayOf(u.searchParams.get("timestamp"));
      return (onSnapshot && onSnapshot(day)) || (day in days ? reply(days[day]) : tornErr(30, "File does not exist"));
    }
    if (u.pathname === "/v2/torn/factionhof") {
      const custom = onHof && onHof(u);
      if (custom) return custom;
      const off = Number(u.searchParams.get("offset")), lim = Number(u.searchParams.get("limit"));
      return reply(JSON.stringify({ factionhof: HOF.slice(off, off + lim).map((f, i) => ({
        id: f.id, name: f.name, members: 20, position: off + i + 1, rank: "Gold III",
        values: { chain: null, chain_duration: null, respect: f.respect } })) }));
    }
    return reply("{}", 404);
  };
  const of = (path) => () => calls.filter((c) => c.path === path);
  return { fetchImpl, calls, snapshotCalls: of("/v2/faction/snapshot"), hofCalls: of("/v2/torn/factionhof") };
}

const T0 = Date.UTC(2026, 9, 19, 0, 5);  // 2026-10-19 00:05 UTC
function setup(torn, at = T0) {
  clock.now = at;
  clock.sleeps = [];
  return {
    dataDir: mkdtempSync(join(tmpdir(), "hof-snap-")), fetchImpl: torn.fetchImpl, key: KEY, factionId: US,
    nowFn: () => clock.now, sleep: async (ms) => { clock.sleeps.push(ms); clock.now += ms; },
  };
}
const readDay = (opts, day) => JSON.parse(readFileSync(join(opts.dataDir, "days", `${day}.json`), "utf8"));

// ── parsing ─────────────────────────────────────────────────────────────
test("the CSV parser handles quoted commas, doubled quotes and CRLF, and skips short rows", () => {
  const text = 'respect,id,name,member_list\r\n100,1,"A, B",""\r\n5,2,"Say ""hi""","1,2"\r\n7,3\r\n0,4,Zero,\r\n';
  const parsed = parseSnapshotCsv(text);
  assert.deepEqual(parsed.columns, { respect: 0, id: 1, name: 2, member_list: 3 });
  assert.equal(parsed.skipped, 1);
  const facts = snapshotFacts(parsed);
  assert.deepEqual(facts.respect, { 1: 100, 2: 5 }, "respect above 0 only");
  assert.deepEqual(facts.names, { 1: "A, B", 2: 'Say "hi"', 4: "Zero" });
  assert.equal(facts.count, 2);
});

test("a snapshot without a needed column is refused", () => {
  assert.throws(() => snapshotFacts(parseSnapshotCsv("id,name\n1,A\n")), /no respect column/);
});
```

- [ ] **Step 2: Run them to make sure they fail**

```bash
cd /opt/warboard/server && node --test hof-snapshots.test.mjs
```

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `./hof-snapshots.js`.

- [ ] **Step 3: Write the minimal implementation**

Create `server/hof-snapshots.js`:

```js
// The daily job behind /hof: saves Torn's faction snapshot for every UTC day
// and rebuilds the digest the page reads.
//
// Torn keeps each day's file for only about a month, so a day this job misses
// is gone for good. It runs at 00:05 UTC, catches up 60 s after every start,
// and retries a day Torn hasn't published yet every 15 minutes. A restart with
// nothing missing makes no calls. Design:
// docs/superpowers/specs/2026-10-19-hof-respect-climb-design.md.
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync, gzipSync } from "node:zlib";
import nodeCron from "node-cron";
import { tornGet } from "./hof-torn.js";
import { DIGEST_VERSION, addDays, computeDigest, dayMs, historyEntry, utcDay } from "./hof-climb.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const WINDOW_DAYS = 45;              // today and the 44 days before it
const KEEP_DAYS = 100;               // the 90-day window's limit is 99
const RETRY_MS = 15 * 60 * 1000;
const BOOT_DELAY_MS = 60 * 1000;
const CALL_GAP_MS = 1100;
const KEY_CODES = new Set([1, 2, 10, 13, 16, 18]);
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

// Worked out at call time, so a test that sets DATA_DIR first never touches
// the live directory.
export const defaultDataDir = () => join(process.env.DATA_DIR || join(__dirname, "data"), "hof");

function context(opts = {}) {
  return {
    dir: opts.dataDir || defaultDataDir(),
    fetchImpl: opts.fetchImpl || fetch,
    nowFn: opts.nowFn || (() => Date.now()),
    key: opts.key !== undefined ? opts.key : process.env.OWNER_API_KEY,
    factionId: String(opts.factionId || process.env.OWNER_FACTION_ID || "42055"),
    sleep: opts.sleep || ((ms) => new Promise((resolve) => setTimeout(resolve, ms))),
    lastCallAt: -Infinity,
  };
}

const rawPath = (ctx, day) => join(ctx.dir, "raw", `${day}.csv.gz`);
const dayPath = (ctx, day) => join(ctx.dir, "days", `${day}.json`);
const digestPath = (ctx) => join(ctx.dir, "digest.json");
const attemptsPath = (ctx) => join(ctx.dir, "attempts.json");

// A temporary name, then a rename: pm2 often stops warboard with SIGKILL, and
// nothing may ever read half a file.
function writeAtomic(file, data) {
  mkdirSync(dirname(file), { recursive: true });
  const tmp = `${file}.tmp-${process.pid}`;
  writeFileSync(tmp, data);
  renameSync(tmp, file);
}

function readJson(file) {
  try { return JSON.parse(readFileSync(file, "utf8")); } catch { return null; }
}

// ── parsing ─────────────────────────────────────────────────────────────
// Torn's CSV: a header row, then one row per faction. Fields may be quoted,
// quotes inside them are doubled, and member_list holds commas.
export function parseSnapshotCsv(text) {
  const rows = [];
  let row = [], field = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else quoted = false; }
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (c !== "\r") field += c;
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  const header = rows.shift() || [];
  const columns = Object.fromEntries(header.map((h, i) => [h.trim(), i]));
  const good = rows.filter((r) => r.length === header.length);
  return { columns, rows: good, skipped: rows.length - good.length };
}

// The day's id → respect for every faction with any, and id → name for all.
export function snapshotFacts(parsed) {
  const { columns: c, rows } = parsed;
  for (const col of ["id", "name", "respect"]) {
    if (!(col in c)) throw new Error(`snapshot has no ${col} column`);
  }
  const respect = {}, names = {};
  for (const r of rows) {
    const id = r[c.id].trim(), v = Number(r[c.respect]);
    if (!/^\d+$/.test(id)) continue;
    names[id] = r[c.name];
    if (v > 0) respect[id] = v;
  }
  return { respect, names, count: Object.keys(respect).length, skipped: parsed.skipped };
}
```

- [ ] **Step 4: Run the tests and make sure they pass**

```bash
cd /opt/warboard/server && node --test hof-snapshots.test.mjs
```

Expected: `# tests 2`, `# pass 2`, `# fail 0`.

- [ ] **Step 5: Commit**

```bash
cd /opt/warboard && git add server/hof-snapshots.js server/hof-snapshots.test.mjs && \
  git commit -m "HoF climb: snapshot parsing" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Which days the job wants

**Files:**
- Modify: `server/hof-snapshots.js` (append)
- Modify: `server/hof-snapshots.test.mjs` (append)

**Interfaces:**
- Consumes: `context`, `readJson`, `writeAtomic`, `attemptsPath` (Task 7).
- Produces: `savedDays(opts) -> string[]` (ascending), `missingDays(opts) -> string[]` (newest first); internal `savedDaysIn(ctx)`, `missingIn(ctx)`, `readAttempts(ctx)`, `recordAttempt(ctx, day, today)`.

- [ ] **Step 1: Write the failing tests**

Append to the end of `server/hof-snapshots.test.mjs`, after a blank line:

```js
// ── which days ──────────────────────────────────────────────────────────
test("a run wants the 45 days newest first, minus saved days and past days asked today", () => {
  const opts = setup(fakeTorn());
  const all = missingDays(opts);
  assert.equal(all.length, 45);
  assert.deepEqual([all[0], all[44]], ["2026-10-19", "2026-09-05"]);

  mkdirSync(join(opts.dataDir, "days"), { recursive: true });
  writeFileSync(join(opts.dataDir, "days", "2026-10-18.json"), "{}");
  writeFileSync(join(opts.dataDir, "attempts.json"), JSON.stringify({
    "2026-10-19": "2026-10-19", "2026-10-17": "2026-10-19", "2026-10-16": "2026-10-18" }));
  const some = missingDays(opts);
  assert.ok(!some.includes("2026-10-18"), "saved");
  assert.ok(!some.includes("2026-10-17"), "already answered code 30 today");
  assert.ok(some.includes("2026-10-19"), "today is never skipped");
  assert.ok(some.includes("2026-10-16"), "answered yesterday: due again");
});
```

- [ ] **Step 2: Run them to make sure they fail**

```bash
cd /opt/warboard/server && node --test hof-snapshots.test.mjs
```

Expected: 1 of 3 tests fails with `missingDays is not a function`.

- [ ] **Step 3: Write the minimal implementation**

Append to the end of `server/hof-snapshots.js`, after a blank line:

```js
// ── which days a run wants ──────────────────────────────────────────────
function savedDaysIn(ctx) {
  let names;
  try { names = readdirSync(join(ctx.dir, "days")); } catch { return []; }
  return names.filter((n) => n.endsWith(".json") && DAY_RE.test(n.slice(0, -5))).map((n) => n.slice(0, -5)).sort();
}
export const savedDays = (opts) => savedDaysIn(context(opts));

const readAttempts = (ctx) => readJson(attemptsPath(ctx)) || {};

// A past day that answered code 30 is asked again only on a later UTC date.
function recordAttempt(ctx, day, today) {
  const attempts = readAttempts(ctx), oldest = addDays(today, -(WINDOW_DAYS - 1));
  attempts[day] = today;
  for (const d of Object.keys(attempts)) if (d < oldest) delete attempts[d];
  writeAtomic(attemptsPath(ctx), JSON.stringify(attempts));
}

// Newest first: the 45-day window minus saved days, minus past days that
// already answered code 30 today. Older days are never requested.
function missingIn(ctx) {
  const today = utcDay(ctx.nowFn()), have = new Set(savedDaysIn(ctx)), asked = readAttempts(ctx);
  const out = [];
  for (let i = 0; i < WINDOW_DAYS; i++) {
    const day = addDays(today, -i);
    if (have.has(day)) continue;
    if (i > 0 && asked[day] === today) continue;
    out.push(day);
  }
  return out;
}
export const missingDays = (opts) => missingIn(context(opts));
```

- [ ] **Step 4: Run the tests and make sure they pass**

```bash
cd /opt/warboard/server && node --test hof-snapshots.test.mjs
```

Expected: `# tests 3`, `# pass 3`, `# fail 0`.

- [ ] **Step 5: Commit**

```bash
cd /opt/warboard && git add server/hof-snapshots.js server/hof-snapshots.test.mjs && \
  git commit -m "HoF climb: which days the job wants" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: The daily run and the digest build

**Files:**
- Modify: `server/hof-snapshots.js` (append)
- Modify: `server/hof-snapshots.test.mjs` (append)

**Interfaces:**
- Consumes: Tasks 6–8.
- Produces: `detectHidden(opts, respect) -> Promise<{ok: true, position, hidden: number[]} | {ok: false, code}>`, `runOnce(opts) -> Promise<{saved: string[], waiting: string[], hidden: number[]|null, retry: boolean, keyError: boolean, error: string|null, digest: {day, position}|null}>` (never rejects for a Torn or disk failure), `buildDigest(opts) -> digest|null`.

- [ ] **Step 1: Write the failing tests**

Append to the end of `server/hof-snapshots.test.mjs`, after a blank line:

```js
// ── a run ───────────────────────────────────────────────────────────────
test("the first run saves what Torn has, finds the hidden list once, and records the rest", async () => {
  const torn = fakeTorn({ days: { "2026-10-19": SNAP, "2026-10-18": SNAP, "2026-09-18": SNAP } });
  const opts = setup(torn);
  const s = await runOnce(opts);

  assert.deepEqual(s.saved, ["2026-10-19", "2026-10-18", "2026-09-18"]);
  assert.equal(torn.snapshotCalls().length, 45);
  assert.equal(torn.hofCalls().length, 5, "we're #250, so it pages to position 450");
  assert.deepEqual(s.hidden, [77], "88 sits below P + 100, so it isn't looked for");
  assert.deepEqual(readDay(opts, "2026-09-18").hidden, [77], "backfilled days take the same list");
  assert.equal(readDay(opts, "2026-10-18").respect[US], 1751500);
  assert.equal(gunzipSync(readFileSync(join(opts.dataDir, "raw", "2026-10-19.csv.gz"))).toString(), SNAP,
    "Torn's file is kept exactly as served");

  const attempts = JSON.parse(readFileSync(join(opts.dataDir, "attempts.json"), "utf8"));
  assert.equal(Object.keys(attempts).length, 42);
  assert.ok(Object.values(attempts).every((d) => d === "2026-10-19"));

  const digest = JSON.parse(readFileSync(join(opts.dataDir, "digest.json"), "utf8"));
  assert.equal(digest.day, "2026-10-19");
  assert.equal(digest.midnight.position, 250, "the hidden faction isn't counted ahead of us");
  assert.equal(s.retry, false);

  const at = torn.calls.map((c) => c.at);
  for (let i = 1; i < at.length; i++) assert.ok(at[i] - at[i - 1] >= 1100, "calls are 1.1 s apart");

  const again = await runOnce(opts);
  assert.deepEqual(again.saved, []);
  assert.equal(torn.calls.length, 50, "a second run the same day makes no calls");
});

test("today's unpublished file arms the retry; a past day is asked again on a later UTC date", async () => {
  const torn = fakeTorn({ days: { "2026-10-18": SNAP } });
  const opts = setup(torn);
  const s = await runOnce(opts);
  assert.deepEqual(s.saved, ["2026-10-18"]);
  assert.ok(s.waiting.includes("2026-10-19"));
  assert.equal(s.retry, true);
  assert.ok(!("2026-10-19" in JSON.parse(readFileSync(join(opts.dataDir, "attempts.json"), "utf8"))));

  clock.now += 15 * 60 * 1000;
  let before = torn.snapshotCalls().length;
  await runOnce(opts);
  assert.equal(torn.snapshotCalls().length - before, 1, "15 minutes later only today is asked");

  clock.now = Date.UTC(2026, 9, 20, 0, 5);
  before = torn.snapshotCalls().length;
  await runOnce(opts);
  const asked = torn.snapshotCalls().slice(before).map((c) => dayOf(c.params.timestamp));
  assert.ok(asked.includes("2026-10-17"), "due again on the next UTC date");
});

test("code 5 backs off 2 s, then 1.8 times longer, for up to 5 retries", async () => {
  let busy = 3;
  const torn = fakeTorn({ days: { "2026-10-19": SNAP },
    onSnapshot: (day) => (day === "2026-10-19" && busy-- > 0 ? tornErr(5, "Too many requests") : null) });
  const opts = setup(torn);
  const s = await runOnce(opts);
  assert.equal(s.saved[0], "2026-10-19");
  assert.deepEqual(clock.sleeps.filter((ms) => ms >= 2000).slice(0, 3), [2000, 3600, 6480]);

  const stuck = fakeTorn({ onSnapshot: () => tornErr(5, "Too many requests") });
  const s2 = await runOnce(setup(stuck));
  assert.equal(stuck.snapshotCalls().length, 6, "the first call and 5 retries");
  assert.equal(s2.retry, true);
  assert.match(s2.error, /^snapshot 2026-10-19: 5/);
});

test("a key problem ends the run without arming the retry", async () => {
  const torn = fakeTorn({ onSnapshot: () => tornErr(2, "Incorrect key") });
  const s = await runOnce(setup(torn));
  assert.equal(torn.snapshotCalls().length, 1);
  assert.equal(s.keyError, true);
  assert.equal(s.retry, false);
});

test("a saved raw file stands in for the fetch; a broken one is fetched again", async () => {
  const torn = fakeTorn({ days: { "2026-10-19": SNAP } });
  const opts = setup(torn);
  mkdirSync(join(opts.dataDir, "raw"), { recursive: true });
  writeFileSync(join(opts.dataDir, "raw", "2026-10-18.csv.gz"), gzipSync(SNAP));
  writeFileSync(join(opts.dataDir, "raw", "2026-10-17.csv.gz"), "not gzip");
  const s = await runOnce(opts);
  const asked = torn.snapshotCalls().map((c) => dayOf(c.params.timestamp));
  assert.ok(!asked.includes("2026-10-18"), "the saved copy was used");
  assert.ok(s.saved.includes("2026-10-18"));
  assert.ok(asked.includes("2026-10-17"), "the broken copy was fetched again");
  assert.ok(!existsSync(join(opts.dataDir, "raw", "2026-10-17.csv.gz")));
});

test("a cut-off download is not saved", async () => {
  const torn = fakeTorn({ days: { "2026-10-19": SNAP, "2026-10-18": csvOf(WORLD.slice(0, 300)) } });
  const opts = setup(torn);
  const s = await runOnce(opts);
  assert.deepEqual(s.saved, ["2026-10-19"]);
  assert.match(s.error, /only 300 factions with respect against 603/);
  assert.equal(s.retry, true);
  assert.ok(!existsSync(join(opts.dataDir, "raw", "2026-10-18.csv.gz")));
});

test("a failed write ends the run with a retry and leaves the day unsaved", async () => {
  const torn = fakeTorn({ days: { "2026-10-19": SNAP } });
  const opts = setup(torn);
  writeFileSync(join(opts.dataDir, "days"), "not a directory");  // every day-file write now fails
  const s = await runOnce(opts);
  assert.deepEqual(s.saved, []);
  assert.equal(s.retry, true);
  assert.match(s.error, /^2026-10-19: /);
  assert.ok(existsSync(join(opts.dataDir, "raw", "2026-10-19.csv.gz")), "the raw file waits for the next run");
});

test("a failed Hall of Fame check reuses the newest saved list", async () => {
  const torn = fakeTorn({ days: { "2026-10-19": SNAP }, onHof: () => reply("oops", 500) });
  const opts = setup(torn);
  mkdirSync(join(opts.dataDir, "days"), { recursive: true });
  writeFileSync(join(opts.dataDir, "days", "2026-10-18.json"),
    JSON.stringify({ day: "2026-10-18", respect: { [US]: 5 }, hidden: [77, 88] }));
  await runOnce(opts);
  assert.deepEqual(readDay(opts, "2026-10-19").hidden, [77, 88]);
});

test("with no saved list, it keeps the raw file and builds the day once the check works", async () => {
  const hof = { down: true };
  const torn = fakeTorn({ days: { "2026-10-19": SNAP }, onHof: () => (hof.down ? reply("oops", 500) : null) });
  const opts = setup(torn);
  const s1 = await runOnce(opts);
  assert.deepEqual(s1.saved, []);
  assert.equal(s1.retry, true);
  assert.ok(existsSync(join(opts.dataDir, "raw", "2026-10-19.csv.gz")));
  assert.ok(!existsSync(join(opts.dataDir, "days", "2026-10-19.json")));

  hof.down = false;
  clock.now += 15 * 60 * 1000;
  const s2 = await runOnce(opts);
  assert.ok(s2.saved.includes("2026-10-19"));
  const fetches = torn.snapshotCalls().filter((c) => dayOf(c.params.timestamp) === "2026-10-19");
  assert.equal(fetches.length, 1, "built from the raw file, not fetched again");
});

test("the digest is rebuilt on a version change, and an unreadable day file from its raw file", async () => {
  const torn = fakeTorn({ days: { "2026-10-19": SNAP, "2026-10-18": SNAP } });
  const opts = setup(torn);
  await runOnce(opts);
  writeFileSync(join(opts.dataDir, "digest.json"), JSON.stringify({ version: 0, day: "2026-10-19" }));
  writeFileSync(join(opts.dataDir, "days", "2026-10-18.json"), "{not json");
  const calls = torn.calls.length;
  await runOnce(opts);
  assert.equal(torn.calls.length, calls, "nothing was missing, so no calls");
  assert.equal(JSON.parse(readFileSync(join(opts.dataDir, "digest.json"), "utf8")).version, DIGEST_VERSION);
  assert.deepEqual(readDay(opts, "2026-10-18").hidden, [77], "rebuilt with the newest saved list");
});

test("a throwing fetch never becomes an unhandled rejection", async () => {
  const s = await runOnce(setup({ fetchImpl: () => { throw new Error("boom"); } }));
  assert.equal(s.retry, true);
  assert.match(s.error, /network/);
});
```

- [ ] **Step 2: Run them to make sure they fail**

```bash
cd /opt/warboard/server && node --test hof-snapshots.test.mjs
```

Expected: 11 of 14 tests fail, first with `runOnce is not a function`.

- [ ] **Step 3: Write the minimal implementation**

Append to the end of `server/hof-snapshots.js`, after a blank line:

```js
// ── Torn calls ──────────────────────────────────────────────────────────
// At least 1.1 s after the run's previous call. Code 5 (too many requests)
// waits 2 s, then 1.8 times longer each time, for up to 5 retries.
async function call(ctx, path, params, timeoutMs) {
  for (let retry = 0; ; retry++) {
    const wait = ctx.lastCallAt + CALL_GAP_MS - ctx.nowFn();
    if (wait > 0) await ctx.sleep(wait);
    ctx.lastCallAt = ctx.nowFn();
    const r = await tornGet(path, params, { key: ctx.key, fetchImpl: ctx.fetchImpl, source: "hof-snapshots", timeoutMs });
    if (r.ok || r.code !== 5 || retry === 5) return r;
    await ctx.sleep(Math.round(2000 * 1.8 ** retry));
  }
}

// The snapshot's factions that the Hall of Fame leaves out. Pages the Hall of
// Fame until it covers 200 places below us (5 calls at #250), then compares it
// with the snapshot's top P + 100 by respect.
async function hiddenFor(ctx, respect) {
  const shown = new Set();
  let us = null;
  for (let page = 0; page < 20; page++) {
    const r = await call(ctx, "/torn/factionhof", { cat: "respect", limit: 100, offset: page * 100 }, 30000);
    if (!r.ok) return { ok: false, code: r.code };
    let list;
    try { list = JSON.parse(r.text).factionhof; } catch { list = null; }
    if (!Array.isArray(list)) return { ok: false, code: "bad_reply" };
    for (const row of list) {
      shown.add(String(row.id));
      if (String(row.id) === ctx.factionId) us = row.position;
    }
    if (list.length < 100) break;
    if (us !== null && (page + 1) * 100 >= us + 200) break;
  }
  if (us === null) return { ok: false, code: "not_listed" };
  const top = Object.keys(respect)
    .sort((a, b) => respect[b] - respect[a] || Number(a) - Number(b))
    .slice(0, us + 100);
  return { ok: true, position: us, hidden: top.filter((id) => !shown.has(id)).map(Number) };
}
export const detectHidden = (opts, respect) => hiddenFor(context(opts), respect);

// ── one run ─────────────────────────────────────────────────────────────
// A saved raw file stands in for a fetch. In a run, a copy that won't unzip or
// parse is deleted so it is fetched again; the digest build never deletes one.
function readRaw(ctx, day, deleteBroken) {
  const file = rawPath(ctx, day);
  if (!existsSync(file)) return null;
  try {
    return snapshotFacts(parseSnapshotCsv(gunzipSync(readFileSync(file)).toString("utf8")));
  } catch {
    if (deleteBroken) { try { unlinkSync(file); } catch {} }
    return null;
  }
}

function newestDayIn(ctx) {
  const days = savedDaysIn(ctx);
  for (let i = days.length - 1; i >= 0; i--) {
    const j = readJson(dayPath(ctx, days[i]));
    if (j && j.respect) return j;
  }
  return null;
}

// Fetch (or reuse) every wanted day, newest first, then rebuild the digest.
// Resolves to a summary and never rejects for a Torn or disk failure.
export async function runOnce(opts = {}) {
  const ctx = context(opts);
  const today = utcDay(ctx.nowFn());
  const out = { saved: [], waiting: [], hidden: null, retry: false, keyError: false, error: null, digest: null };
  const newest = newestDayIn(ctx);
  let baseline = newest ? Object.keys(newest.respect).length : null;
  let hidden = null;

  for (const day of missingIn(ctx)) {
    try {
      let facts = readRaw(ctx, day, true);
      if (!facts) {
        const r = await call(ctx, "/faction/snapshot", { timestamp: dayMs(day) / 1000 }, 120000);
        if (!r.ok) {
          if (r.code === 30) {
            out.waiting.push(day);
            if (day === today) out.retry = true;
            else recordAttempt(ctx, day, today);
            continue;
          }
          if (KEY_CODES.has(r.code)) { out.keyError = true; out.error = `key problem (code ${r.code})`; break; }
          out.error = `snapshot ${day}: ${r.code} ${r.message || ""}`.trim();
          out.retry = true;
          break;
        }
        facts = snapshotFacts(parseSnapshotCsv(r.text));
        if (baseline !== null && facts.count < 0.9 * baseline) {
          throw new Error(`only ${facts.count} factions with respect against ${baseline} on the newest saved day`);
        }
        writeAtomic(rawPath(ctx, day), gzipSync(r.text));
      }
      if (hidden === null) {
        const h = await hiddenFor(ctx, facts.respect);
        const previous = h.ok ? null : newestDayIn(ctx);
        if (h.ok) hidden = h.hidden;
        else if (previous) hidden = previous.hidden || [];
        else {
          // No list at all yet: keep the raw files, write no day files, and let
          // the next run build them without fetching again.
          out.error = `hall of fame check: ${h.code}`;
          out.retry = true;
          break;
        }
        out.hidden = hidden;
      }
      writeAtomic(dayPath(ctx, day), JSON.stringify({ day, respect: facts.respect, hidden }));
      out.saved.push(day);
      if (baseline === null) baseline = facts.count;
    } catch (e) {
      out.error = `${day}: ${e.message}`;
      out.retry = true;
      break;
    }
  }

  try {
    if (out.saved.length || digestStale(ctx)) {
      const d = buildIn(ctx);
      if (d) out.digest = { day: d.day, position: d.midnight ? d.midnight.position : null };
    }
  } catch (e) {
    out.error = out.error || `digest: ${e.message}`;
    out.retry = true;
  }
  return out;
}

// ── the digest ──────────────────────────────────────────────────────────
function digestStale(ctx) {
  const days = savedDaysIn(ctx);
  if (!days.length) return false;
  const d = readJson(digestPath(ctx));
  return !d || d.version !== DIGEST_VERSION || d.day < days[days.length - 1];
}

// A day file that won't parse is rebuilt from its raw file; with no usable raw
// file the day is left out.
function readDayFile(ctx, day, fallbackHidden) {
  const j = readJson(dayPath(ctx, day));
  if (j && j.respect) return j;
  const facts = readRaw(ctx, day, false);
  if (!facts) {
    console.warn(`[hof] ${day}: day file unreadable and no usable raw file; left out`);
    return null;
  }
  const rebuilt = { day, respect: facts.respect, hidden: fallbackHidden() };
  writeAtomic(dayPath(ctx, day), JSON.stringify(rebuilt));
  console.warn(`[hof] ${day}: day file was unreadable; rebuilt from the raw file`);
  return rebuilt;
}

function buildIn(ctx) {
  const days = savedDaysIn(ctx);
  if (!days.length) return null;
  let newestHidden = null;
  const fallbackHidden = () => {
    if (newestHidden === null) newestHidden = (newestDayIn(ctx) || {}).hidden || [];
    return newestHidden;
  };
  const keepFrom = addDays(days[days.length - 1], -KEEP_DAYS);
  const byDay = {}, history = [];
  for (const day of days) {
    const data = readDayFile(ctx, day, fallbackHidden);
    if (!data) continue;
    const h = historyEntry(day, data, ctx.factionId);
    if (h.position !== null) history.push(h);
    if (day >= keepFrom) byDay[day] = data;
  }
  const latest = Object.keys(byDay).sort().pop();
  if (!latest) return null;
  const facts = readRaw(ctx, latest, false);
  const digest = computeDigest({
    byDay, history, names: facts ? facts.names : {}, factionId: ctx.factionId, builtAt: ctx.nowFn(),
  });
  writeAtomic(digestPath(ctx), JSON.stringify(digest));
  return digest;
}
export const buildDigest = (opts) => buildIn(context(opts));
```

- [ ] **Step 4: Run the tests and make sure they pass**

```bash
cd /opt/warboard/server && node --test hof-snapshots.test.mjs
```

Expected: `# tests 14`, `# pass 14`, `# fail 0`.

- [ ] **Step 5: Commit**

```bash
cd /opt/warboard && git add server/hof-snapshots.js server/hof-snapshots.test.mjs && \
  git commit -m "HoF climb: the daily run and the digest build" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Scheduling

**Files:**
- Modify: `server/hof-snapshots.js` (append)
- Modify: `server/hof-snapshots.test.mjs` (append)

**Interfaces:**
- Consumes: `runOnce` (Task 9), `nodeCron` (imported in Task 7).
- Produces: `startHofSnapshots(opts) -> boolean` (false when `HOF_SCHEDULE=0` or there is no key), `stopHofSnapshots() -> void`.

- [ ] **Step 1: Write the failing tests**

Append to the end of `server/hof-snapshots.test.mjs`, after a blank line:

```js
// ── scheduling ──────────────────────────────────────────────────────────
function fakeCron() {
  const scheduled = [];
  return { scheduled, schedule(expr, fn, options) {
    const task = { expr, fn, options, stopped: false, stop() { this.stopped = true; } };
    scheduled.push(task);
    return task;
  } };
}
function fakeTimers() {
  const set = [];
  return { set, setTimeout(fn, ms) { const h = { fn, ms, cleared: false }; set.push(h); return h; },
    clearTimeout(h) { if (h) h.cleared = true; } };
}

test("the job runs at 00:05 UTC and 60 s after start, never twice at once, and stops cleanly", async () => {
  const cron = fakeCron(), timers = fakeTimers();
  const opts = { ...setup(fakeTorn({ days: { "2026-10-19": SNAP } })), cron, timers };
  assert.equal(startHofSnapshots(opts), true);
  try {
    const [task] = cron.scheduled;
    assert.equal(task.expr, "5 0 * * *");
    assert.deepEqual(task.options, { timezone: "UTC", noOverlap: true });
    const boot = timers.set[0];
    assert.equal(boot.ms, 60000);
    const running = boot.fn();
    await task.fn();
    assert.equal(timers.set[timers.set.length - 1].ms, 15 * 60 * 1000, "busy: the daily run arms the retry");
    await running;
    assert.ok(existsSync(join(opts.dataDir, "days", "2026-10-19.json")));
  } finally {
    stopHofSnapshots();
  }
  assert.equal(cron.scheduled[0].stopped, true);
  assert.ok(timers.set.every((h) => h.cleared), "boot and retry timers cleared");
});

test("no OWNER_API_KEY, or HOF_SCHEDULE=0, schedules nothing", () => {
  const cron = fakeCron(), timers = fakeTimers();
  assert.equal(startHofSnapshots({ key: "", cron, timers }), false);
  process.env.HOF_SCHEDULE = "0";
  try {
    assert.equal(startHofSnapshots({ key: KEY, cron, timers }), false);
  } finally {
    delete process.env.HOF_SCHEDULE;
  }
  assert.equal(cron.scheduled.length + timers.set.length, 0);
});
```

- [ ] **Step 2: Run them to make sure they fail**

```bash
cd /opt/warboard/server && node --test hof-snapshots.test.mjs
```

Expected: 2 of 16 tests fail, first with `startHofSnapshots is not a function`.

- [ ] **Step 3: Write the minimal implementation**

Append to the end of `server/hof-snapshots.js`, after a blank line:

```js
// ── scheduling ──────────────────────────────────────────────────────────
let job = null;

function logRun(reason, s) {
  const parts = [`saved ${s.saved.length}`];
  if (s.saved.length) parts[0] += ` (${s.saved[s.saved.length - 1]} … ${s.saved[0]})`;
  if (s.waiting.length) parts.push(`waiting ${s.waiting.length}`);
  if (s.hidden) parts.push(`hidden [${s.hidden.join(",")}]`);
  if (s.digest) parts.push(`digest ${s.digest.day} #${s.digest.position}`);
  if (s.error) parts.push(`stopped: ${s.error}`);
  console.log(`[hof] ${reason}: ${parts.join(" | ")}`);
}

function armRetry(j) {
  if (job !== j || j.retryTimer) return;
  j.retryTimer = j.timers.setTimeout(() => { j.retryTimer = null; trigger(j, "retry"); }, RETRY_MS);
}

// One run at a time. noOverlap only stops cron overlapping itself, so the boot
// catch-up and the retry share this guard; a run that finds the job busy arms
// the retry rather than being dropped. Every run ends in .catch: Node exits on
// an unhandled rejection, and that would take every warboard feature down.
function trigger(j, reason) {
  if (job !== j) return Promise.resolve();
  if (j.running) { armRetry(j); return Promise.resolve(); }
  j.running = true;
  return runOnce(j.opts)
    .then((s) => { logRun(reason, s); if (s.retry) armRetry(j); })
    .catch((e) => { console.error(`[hof] ${reason} run failed: ${e.message}`); armRetry(j); })
    .finally(() => { j.running = false; });
}

export function startHofSnapshots(opts = {}) {
  if (process.env.HOF_SCHEDULE === "0") {
    console.log("[hof] disabled by HOF_SCHEDULE=0");
    return false;
  }
  const key = opts.key !== undefined ? opts.key : process.env.OWNER_API_KEY;
  if (!key) {
    console.log("[hof] no OWNER_API_KEY — not scheduling");
    return false;
  }
  if (job) return true;
  const cron = opts.cron || nodeCron;
  const timers = opts.timers || { setTimeout, clearTimeout };
  const j = { opts: { ...opts, key }, timers, running: false, retryTimer: null, task: null, bootTimer: null };
  job = j;
  // The server's local time isn't UTC, so the timezone must be explicit.
  j.task = cron.schedule("5 0 * * *", () => trigger(j, "daily"), { timezone: "UTC", noOverlap: true });
  j.bootTimer = timers.setTimeout(() => trigger(j, "boot"), BOOT_DELAY_MS);
  console.log("[hof] scheduled: 00:05 UTC daily, catch-up in 60 s");
  return true;
}

export function stopHofSnapshots() {
  const j = job;
  if (!j) return;
  job = null;
  try { if (j.task) j.task.stop(); } catch {}
  j.timers.clearTimeout(j.bootTimer);
  if (j.retryTimer) j.timers.clearTimeout(j.retryTimer);
}
```

- [ ] **Step 4: Run the tests and make sure they pass**

```bash
cd /opt/warboard/server && node --test hof-snapshots.test.mjs
```

Expected: `# tests 16`, `# pass 16`, `# fail 0`.

- [ ] **Step 5: Commit**

```bash
cd /opt/warboard && git add server/hof-snapshots.js server/hof-snapshots.test.mjs && \
  git commit -m "HoF climb: scheduling" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: /api/hof: the live merge and its cache

**Files:**
- Create: `server/hof-api.js`
- Create: `server/hof-route.test.mjs`

**Interfaces:**
- Consumes: `tornGet` (Task 6), `dayMs`, `daysToPass` (Tasks 1, 3), `defaultDataDir` (Task 7), and the digest shape from Task 5.
- Produces: `createHofApi({dataDir, fetchImpl, nowFn, key, factionId}) -> {handle(req, res), settle() -> Promise}`. `handle` never rejects. The response shape is the spec's *Response* block.

- [ ] **Step 1: Write the failing tests**

Create `server/hof-route.test.mjs`:

```js
// /api/hof and /hof: the shared live refresh, its fallbacks, and the wiring in
// routes.js. A fake Hall of Fame and a fake clock.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import vm from "node:vm";

process.env.DATA_DIR = mkdtempSync(join(tmpdir(), "hof-route-test-"));
const { createHofApi } = await import("./hof-api.js");

const US = 42055, KEY = "test-key-hof", MIN = 60 * 1000;
const T0 = Date.UTC(2026, 9, 19, 12, 0);
const reply = (body, status = 200) => ({ status, ok: status >= 200 && status < 300, text: async () => body });

// 600 factions in Hall of Fame order, 2,000,000 down in steps of 1,000, with us
// at `position`.
const hofList = (position) => Array.from({ length: 600 }, (_, i) => ({
  position: i + 1, id: i + 1 === position ? US : 1000 + i, name: i + 1 === position ? "Dead Fragment" : "F" + i,
  respect: 2000000 - i * 1000,
}));

function fakeHof(position = 250) {
  const state = { position, fail: false, calls: [] };
  state.fetchImpl = async (url) => {
    const u = new URL(url);
    state.calls.push(u);
    if (state.fail) return reply("oops", 500);
    if (u.pathname === "/v2/torn/factionhof") {
      const off = Number(u.searchParams.get("offset")), lim = Number(u.searchParams.get("limit"));
      return reply(JSON.stringify({ factionhof: hofList(state.position).slice(off, off + lim).map((f) => ({
        id: f.id, name: f.name, members: 20, position: f.position, rank: "Gold III",
        values: { chain: null, chain_duration: null, respect: f.respect } })) }));
    }
    if (u.pathname === `/v2/faction/${US}/hof`) {
      return reply(JSON.stringify({ hof: { respect: { value: 1, rank: state.position } } }));
    }
    return reply("{}", 404);
  };
  return state;
}

// A digest with us at #250 at midnight: every faction gains 50 a day, us 100,
// and the one directly below us 150.
function writeDigest(dataDir, over = {}) {
  const list = hofList(250);
  const paces = Object.fromEntries(list.map((f) => [f.id, { 7: 50, 30: 50 }]));
  paces[US] = { 7: 110, 30: 100 };
  paces[list[250].id] = { 7: 150, 30: 150 };
  const digest = {
    version: 1, factionId: US, day: "2026-10-19", builtAt: T0,
    windows: { 7: { base: "2026-10-12", span: 7 }, 30: { base: "2026-09-19", span: 30 } },
    paces,
    history: [{ day: "2026-09-19", position: 255, respect: 1700000 }, { day: "2026-10-19", position: 250, respect: 1751000 }],
    projection: { 7: Array(365).fill(248), 30: Array(365).fill(249) },
    notes: { 7: null, 30: "We climbed 5 places last month (#255 to #250)." },
    midnight: { position: 250, respect: list[249].respect, rows: list.slice(229, 255) },
    ...over,
  };
  mkdirSync(join(dataDir, "hof"), { recursive: true });
  writeFileSync(join(dataDir, "hof", "digest.json"), JSON.stringify(digest));
  return digest;
}

function setup({ position = 250, digest = true, key = KEY } = {}) {
  const root = mkdtempSync(join(tmpdir(), "hof-api-"));
  if (digest) writeDigest(root);
  const torn = fakeHof(position);
  const clock = { now: T0 };
  const api = createHofApi({ dataDir: join(root, "hof"), fetchImpl: torn.fetchImpl, nowFn: () => clock.now, key, factionId: US });
  return { root, torn, clock, api };
}

function stubRes() {
  return {
    statusCode: 200, headers: {}, body: undefined,
    set(k, v) { this.headers[k] = v; return this; },
    status(c) { this.statusCode = c; return this; },
    json(b) { this.body = b; return this; },
  };
}
async function get(api) {
  const res = stubRes();
  await api.handle({}, res);
  return res;
}

test("with no digest yet it answers 503 'warming up', uncached", async () => {
  const { api } = setup({ digest: false });
  const res = await get(api);
  assert.equal(res.statusCode, 503);
  assert.deepEqual(res.body, { error: "warming up" });
  assert.equal(res.headers["Cache-Control"], "no-store");
});

test("the first request answers at once from midnight and starts one shared refresh", async () => {
  const { api, torn } = setup();
  const first = await get(api);
  assert.equal(first.body.source, "midnight");
  assert.equal(first.body.refreshing, true);
  assert.equal(first.body.updatedAt, Date.UTC(2026, 9, 19));
  assert.equal(first.headers["Cache-Control"], "public, max-age=60");
  await get(api);
  await api.settle();
  assert.equal(torn.calls.length, 1, "concurrent requests share one refresh");
  const u = torn.calls[0];
  assert.equal(u.pathname, "/v2/torn/factionhof");
  assert.deepEqual([u.searchParams.get("offset"), u.searchParams.get("limit")], ["199", "100"]);

  const next = await get(api);
  assert.equal(next.body.source, "live");
  assert.equal(next.body.refreshing, false);
  assert.equal(next.body.updatedAt, T0);
  assert.equal(torn.calls.length, 1);
});

test("a copy under 15 minutes old is served without a call; an older one at once, then refreshed", async () => {
  const { api, torn, clock } = setup();
  await get(api); await api.settle();
  clock.now += 14 * MIN;
  assert.equal((await get(api)).body.source, "live");
  assert.equal(torn.calls.length, 1);

  clock.now += 2 * MIN;
  const stale = await get(api);
  assert.equal(stale.body.source, "stale");
  assert.equal(stale.body.refreshing, true);
  assert.equal(stale.body.updatedAt, T0, "served with its own time");
  await api.settle();
  assert.equal(torn.calls.length, 2);
  assert.equal((await get(api)).body.updatedAt, T0 + 16 * MIN);
});

test("a failed refresh keeps the last answer and isn't retried for 15 minutes", async () => {
  const { api, torn, clock } = setup();
  torn.fail = true;
  await get(api); await api.settle();
  assert.equal((await get(api)).body.source, "midnight");
  clock.now += 10 * MIN;
  await get(api); await api.settle();
  assert.equal(torn.calls.length, 1, "no new attempt within 15 minutes of the last");

  torn.fail = false;
  clock.now += 6 * MIN;
  await get(api); await api.settle();
  assert.equal((await get(api)).body.source, "live");

  torn.fail = true;
  clock.now += 20 * MIN;
  await get(api); await api.settle();
  const res = await get(api);
  assert.equal(res.body.source, "stale");
  assert.equal(res.body.updatedAt, T0 + 16 * MIN, "the older live copy, with its own time");
});

test("after a big move it asks Torn for our rank, then fetches the window around it", async () => {
  const { api, torn } = setup({ position: 150 });
  await get(api); await api.settle();
  assert.deepEqual(torn.calls.map((u) => u.pathname),
    ["/v2/torn/factionhof", `/v2/faction/${US}/hof`, "/v2/torn/factionhof"]);
  assert.equal(torn.calls[2].searchParams.get("offset"), "99");
  const res = await get(api);
  assert.equal(res.body.us.position, 150);
});

test("a window short of 20 rows above us is fetched again around our new position", async () => {
  const { api, torn } = setup({ position: 215 });
  await get(api); await api.settle();
  assert.equal(torn.calls.length, 2);
  assert.equal(torn.calls[1].searchParams.get("offset"), "164");
  const rows = (await get(api)).body.rows;
  assert.equal(rows.filter((r, i) => i < rows.findIndex((x) => x.us)).length, 20);
});

test("the answer carries 20 rows above, us and 5 below, with gaps, paces and days", async () => {
  const { api } = setup();
  await get(api); await api.settle();
  const { body } = await get(api);
  assert.deepEqual(body.windows, [7, 30]);
  assert.equal(body.defaultWindow, 30);
  assert.equal(body.rows.length, 26);
  const me = body.rows.findIndex((r) => r.us);
  assert.equal(me, 20);
  assert.deepEqual(body.us, { position: 250, respect: 1751000, pace: { 7: 110, 30: 100 } });
  const above = body.rows[19];
  assert.deepEqual([above.position, above.gap, above.pace[30], above.days[30]], [249, 1000, 50, 20]);
  assert.equal(body.rows[21].days[30], 1000 / 50, "the faster faction below catches us in 20 days");
  assert.equal(body.rows[22].days[30], null, "a slower one below never does");
  assert.deepEqual(body.history, [{ day: "2026-09-19", position: 255 }, { day: "2026-10-19", position: 250 }]);
  assert.equal(body.projection[30].length, 365);
  assert.equal(body.notes[30], "We climbed 5 places last month (#255 to #250).");
});

test("a rebuilt digest is picked up without a restart", async () => {
  const { api, root } = setup();
  assert.equal((await get(api)).body.day, "2026-10-19");
  writeDigest(root, { day: "2026-10-20" });
  const later = new Date(Date.now() + 60000);
  utimesSync(join(root, "hof", "digest.json"), later, later);
  assert.equal((await get(api)).body.day, "2026-10-20");
});

test("no key means no refresh; errors become JSON, never a rejection", async () => {
  const noKey = setup({ key: "" });
  await get(noKey.api); await noKey.api.settle();
  assert.equal(noKey.torn.calls.length, 0);

  const root = mkdtempSync(join(tmpdir(), "hof-api-"));
  writeDigest(root);
  const throwing = createHofApi({ dataDir: join(root, "hof"), key: KEY, factionId: US, nowFn: () => T0,
    fetchImpl: () => { throw new Error("boom"); } });
  await get(throwing); await throwing.settle();
  assert.equal((await get(throwing)).body.source, "midnight");

  const broken = createHofApi({ dataDir: join(root, "hof"), key: KEY, nowFn: () => { throw new Error("clock"); } });
  const res = await get(broken);
  assert.equal(res.statusCode, 500);
  assert.deepEqual(res.body, { error: "internal error" });
});
```

- [ ] **Step 2: Run them to make sure they fail**

```bash
cd /opt/warboard/server && node --test hof-route.test.mjs
```

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `./hof-api.js`.

- [ ] **Step 3: Write the minimal implementation**

Create `server/hof-api.js`:

```js
// /api/hof: the nightly digest plus live Hall of Fame rows around us.
//
// One live copy is shared by every viewer and refreshed at most every 15
// minutes, in the background: a request never waits for Torn. Normally a
// refresh is one call (the 100 positions around us). Design:
// docs/superpowers/specs/2026-10-19-hof-respect-climb-design.md.
import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { tornGet } from "./hof-torn.js";
import { dayMs, daysToPass } from "./hof-climb.js";
import { defaultDataDir } from "./hof-snapshots.js";

const FRESH_MS = 15 * 60 * 1000;
const round2 = (x) => (x == null ? null : Math.round(x * 100) / 100);

// No I/O and no timers here: everything happens on the first request.
export function createHofApi(opts = {}) {
  const dir = () => opts.dataDir || defaultDataDir();
  const nowFn = opts.nowFn || (() => Date.now());
  const fetchImpl = opts.fetchImpl || fetch;
  const key = () => (opts.key !== undefined ? opts.key : process.env.OWNER_API_KEY);
  const factionId = () => String(opts.factionId || process.env.OWNER_FACTION_ID || "42055");

  let digest = null, digestMtime = null;
  let live = null, inflight = null, lastAttemptAt = -Infinity;

  // Read again whenever the file changes, so the nightly rebuild shows up
  // without a restart. A digest that vanishes or won't parse keeps the last one.
  function loadDigest() {
    const file = join(dir(), "digest.json");
    let mtime;
    try { mtime = statSync(file).mtimeMs; } catch { return digest; }
    if (mtime !== digestMtime) {
      try {
        digest = JSON.parse(readFileSync(file, "utf8"));
        digestMtime = mtime;
      } catch (e) {
        console.error(`[hof] digest unreadable: ${e.message}`);
      }
    }
    return digest;
  }

  // Positions P − 50 to P + 49, in Hall of Fame order.
  async function windowAt(position) {
    const r = await tornGet("/torn/factionhof", { cat: "respect", limit: 100, offset: Math.max(0, position - 51) },
      { key: key(), fetchImpl, source: "hof-api" });
    if (!r.ok) return null;
    const list = JSON.parse(r.text).factionhof;
    if (!Array.isArray(list)) return null;
    return list.map((f) => ({ position: f.position, id: f.id, name: f.name, respect: f.values ? f.values.respect : null }))
      .sort((a, b) => a.position - b.position);
  }

  // One call normally. If our row is missing, ask Torn for our rank first;
  // if the window is short of 20 rows above or 5 below, fetch the window
  // around our new position. At most 3 calls.
  async function refresh(d) {
    const us = factionId();
    const find = (rows) => rows.findIndex((r) => String(r.id) === us);
    let rows = await windowAt((live && live.us.position) || (d.midnight && d.midnight.position) || 1);
    if (!rows) return false;
    let i = find(rows);
    if (i < 0) {
      const r = await tornGet(`/faction/${us}/hof`, {}, { key: key(), fetchImpl, source: "hof-api" });
      const rank = r.ok ? JSON.parse(r.text)?.hof?.respect?.rank : null;
      if (!rank) return false;
      rows = await windowAt(rank);
      if (!rows || (i = find(rows)) < 0) return false;
    } else if (i < Math.min(20, rows[i].position - 1) || rows.length - 1 - i < 5) {
      rows = await windowAt(rows[i].position);
      if (!rows || (i = find(rows)) < 0) return false;
    }
    live = { fetchedAt: nowFn(), us: rows[i], rows: rows.slice(Math.max(0, i - 20), i + 6) };
    return true;
  }

  // At most one attempt every 15 minutes, successful or not, shared by every
  // request that arrives meanwhile.
  function maybeRefresh(d) {
    const now = nowFn();
    if (live && now - live.fetchedAt < FRESH_MS) return;
    if (inflight || now - lastAttemptAt < FRESH_MS || !key()) return;
    lastAttemptAt = now;
    inflight = refresh(d)
      .then((ok) => { if (!ok) console.warn("[hof] live refresh failed; serving the last copy"); })
      .catch((e) => { console.error(`[hof] live refresh failed: ${e.message}`); })
      .finally(() => { inflight = null; });
  }

  function view(d) {
    const now = nowFn(), us = factionId();
    const windows = Object.keys(d.windows || {}).map(Number).sort((a, b) => a - b);
    const src = live
      ? { source: now - live.fetchedAt < FRESH_MS ? "live" : "stale", updatedAt: live.fetchedAt, rows: live.rows }
      : { source: "midnight", updatedAt: dayMs(d.day), rows: d.midnight ? d.midnight.rows : [] };
    const meIndex = src.rows.findIndex((r) => String(r.id) === us);
    const me = meIndex >= 0 ? src.rows[meIndex] : null;
    const paces = d.paces || {}, usPace = paces[us] || {};
    const pick = (p) => Object.fromEntries(windows.map((w) => [w, p && p[w] != null ? p[w] : null]));
    const rows = src.rows.map((r, i) => {
      const mine = i === meIndex, pace = paces[String(r.id)];
      const gap = me ? r.respect - me.respect : null;
      const days = Object.fromEntries(windows.map((w) => [w, mine || !me ? null
        : round2(daysToPass({ above: i < meIndex, gap, pace: pace && pace[w], usPace: usPace[w] }))]));
      return { position: r.position, id: r.id, name: r.name, respect: r.respect, gap, ...(mine ? { us: true } : {}),
        pace: pick(pace), days };
    });
    return {
      factionId: Number(us),
      source: src.source,
      refreshing: Boolean(inflight),
      updatedAt: src.updatedAt,
      day: d.day,
      windows,
      defaultWindow: windows.includes(30) ? 30 : (windows.length ? windows[windows.length - 1] : null),
      us: me ? { position: me.position, respect: me.respect, pace: pick(usPace) } : null,
      rows,
      history: (d.history || []).map((h) => ({ day: h.day, position: h.position })),
      projection: d.projection || {},
      notes: d.notes || {},
    };
  }

  // Never rejects: Express 4 ignores the promise a handler returns, so a
  // rejection here would be unhandled and would take the server down.
  async function handle(_req, res) {
    try {
      const d = loadDigest();
      if (!d) {
        res.set("Cache-Control", "no-store");
        return res.status(503).json({ error: "warming up" });
      }
      maybeRefresh(d);
      res.set("Cache-Control", "public, max-age=60");
      return res.json(view(d));
    } catch (e) {
      console.error(`[hof] /api/hof failed: ${e.message}`);
      try { res.set("Cache-Control", "no-store"); res.status(500).json({ error: "internal error" }); } catch {}
    }
  }

  // Resolves once no live refresh is running. The tests use it to wait for the
  // background refresh a request started.
  const settle = () => inflight || Promise.resolve();

  return { handle, settle };
}
```

- [ ] **Step 4: Run the tests and make sure they pass**

```bash
cd /opt/warboard/server && node --test hof-route.test.mjs
```

Expected: `# tests 9`, `# pass 9`, `# fail 0`.

- [ ] **Step 5: Commit**

```bash
cd /opt/warboard && git add server/hof-api.js server/hof-route.test.mjs && \
  git commit -m "HoF climb: /api/hof live merge and cache" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12: Routes, the gate entry, and starting the job

**Files:**
- Modify: `server/routes.js:113` (import), `server/routes.js:1390` (gate), `server/routes.js:13607-13613` (routes)
- Modify: `server/server.js:43` (import), `server/server.js:695` (start), `server/server.js:1002` (shutdown)
- Modify: `server/hof-route.test.mjs` (append)

**Interfaces:**
- Consumes: `createHofApi` (Task 11), `startHofSnapshots` and `stopHofSnapshots` (Task 10).
- Produces: `GET /hof` (the page from Task 13) and `GET /api/hof`, both public.

- [ ] **Step 1: Write the failing tests**

Append to the end of `server/hof-route.test.mjs`, after a blank line:

```js
// ── wiring in routes.js ──────────────────────────────────────────────────
const SRC = readFileSync(new URL("./routes.js", import.meta.url), "utf8");
function fn(name) {
  const i = SRC.indexOf("function " + name + "(");
  assert.ok(i >= 0, "not in routes.js: " + name);
  let k = SRC.indexOf("(", i), depth = 0;
  for (; k < SRC.length; k++) {
    if (SRC[k] === "(") depth++;
    else if (SRC[k] === ")" && --depth === 0) break;
  }
  const o = SRC.indexOf("{", k);
  let d = 0;
  for (let j = o; j < SRC.length; j++) {
    if (SRC[j] === "{") d++;
    else if (SRC[j] === "}" && --d === 0) return SRC.slice(i, j + 1);
  }
  throw new Error("unbalanced braces in " + name);
}
function gateFor(path) {
  const box = { process: { env: {} }, parseCookie: () => null, verifyToken: () => { throw new Error("no token"); } };
  vm.createContext(box);
  vm.runInContext(fn("gateMiddleware") + "\nglobalThis.gate = gateMiddleware;", box);
  const seen = { next: false, redirect: null };
  box.gate({ path, headers: {} }, { redirect: (to) => { seen.redirect = to; } }, () => { seen.next = true; });
  return seen;
}

test("routes.js serves /hof from pages/ and /api/hof from hof-api.js", () => {
  assert.match(SRC, /router\.get\("\/api\/hof", \(req, res\) => hofApi\.handle\(req, res\)\);/);
  assert.match(SRC, /router\.get\("\/hof",[\s\S]{0,200}"Cache-Control", "no-store"[\s\S]{0,120}\.\/pages\/hof\.html/);
});

test("the site gate lets /hof through and still gates other pages", () => {
  assert.deepEqual(gateFor("/hof"), { next: true, redirect: null });
  assert.deepEqual(gateFor("/api/hof"), { next: true, redirect: null });
  assert.deepEqual(gateFor("/slackers"), { next: false, redirect: "/gate.html" });
});
```

- [ ] **Step 2: Run them to make sure they fail**

```bash
cd /opt/warboard/server && node --test hof-route.test.mjs
```

Expected: 2 of 11 tests fail: "routes.js serves /hof from pages/ and /api/hof from hof-api.js" (no match) and "the site gate lets /hof through and still gates other pages" (`/hof` is redirected to `/gate.html`).

- [ ] **Step 3: Wire it up**

In `server/routes.js`, after line 113 (`import * as slackers from "./slackers-model.js";`) add:

```js
import { createHofApi } from "./hof-api.js";
```

In `gateMiddleware`, after line 1390 (`req.path === "/payouts" || req.path.startsWith("/payouts/") ||`) add:

```js
    // The Hall of Fame climb page is public by design: Hall of Fame respect is
    // public, and the page holds nothing else.
    req.path === "/hof" || req.path.startsWith("/hof/") ||
```

After the `/slackers` route (lines 13607-13611) and before `export default router;` add:

```js
// Hall of Fame respect climb (docs/superpowers/specs/2026-10-19-hof-respect-climb-design.md).
// Public: Hall of Fame respect is public, and the page holds nothing else.
const hofApi = createHofApi();
router.get("/api/hof", (req, res) => hofApi.handle(req, res));
router.get("/hof", (_req, res) => {
  res.set("Content-Type", "text/html; charset=utf-8");
  res.set("Cache-Control", "no-store");
  return res.sendFile(new URL("./pages/hof.html", import.meta.url).pathname);
});
```

In `server/server.js`, after line 43 (`import { startFactionHistorySchedule } from "./faction-history-schedule.js";`) add:

```js
import { startHofSnapshots, stopHofSnapshots } from "./hof-snapshots.js";
```

After line 695 (`startFactionHistorySchedule();`) add:

```js
// Hall of Fame climb: saves Torn's daily faction snapshot (00:05 UTC + boot catch-up).
startHofSnapshots();
```

In `shutdown()`, after line 1002 (`  try { stopStakeoutWatcher(); } catch (_) {}`) add:

```js
  try { stopHofSnapshots(); } catch (_) {}
```

- [ ] **Step 4: Run the tests and the full suite**

```bash
cd /opt/warboard/server && node --check routes.js && node --check server.js && node --test hof-route.test.mjs && node --test 2>&1 | grep -E '^# (tests|pass|fail)'
```

Expected: `hof-route.test.mjs` passes 11 of 11, and the full suite reports `# fail 0`.

- [ ] **Step 5: Commit**

```bash
cd /opt/warboard && git add server/routes.js server/server.js server/hof-route.test.mjs && \
  git commit -m "HoF climb: /hof and /api/hof routes, gate entry, job start and stop" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 13: The /hof page

**Files:**
- Create: `server/pages/hof.html`
- Create: `server/hof-page.test.mjs`

**Interfaces:**
- Consumes: the `/api/hof` response (Task 11); `fmtNum` and `fmtPace` from `hof-climb.js` for the parity test.
- Produces: plain top-level functions `esc`, `sep`, `fmtNum`, `fmtPace`, `fmtDate`, `updatedLabel`, `passLabel(row, above, usPace, w, updatedAt)`, `headerHtml(data, w, nowMs)`, `switchHtml(data, w)`, `horizonsHtml(data, w)`, `noteHtml(data, w)`, `niceStep`, `chartSvg(data, w, width)`, `tableHtml(data, w)`, `followUpDelay(data)`, `refreshDue(loadedAt, nowMs, visible, isPda)`, `setStatus`, `render`, `load(isFollowUp)`, `boot`, and single-line `var` constants, so the test can run them in `vm`.

- [ ] **Step 1: Write the failing tests**

Create `server/hof-page.test.mjs`:

```js
// The /hof page: its named functions run in vm, the way gym-hof.test.mjs runs
// /gym's, with document, fetch and the timers stubbed.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import vm from "node:vm";

process.env.DATA_DIR = mkdtempSync(join(tmpdir(), "hof-page-test-"));
const climb = await import("./hof-climb.js");

const PAGE = readFileSync(new URL("./pages/hof.html", import.meta.url), "utf8");
function fn(name) {
  const i = PAGE.indexOf("function " + name + "(");
  assert.ok(i >= 0, "not in hof.html: " + name);
  let k = PAGE.indexOf("(", i), depth = 0;
  for (; k < PAGE.length; k++) {
    if (PAGE[k] === "(") depth++;
    else if (PAGE[k] === ")" && --depth === 0) break;
  }
  const o = PAGE.indexOf("{", k);
  let d = 0;
  for (let j = o; j < PAGE.length; j++) {
    if (PAGE[j] === "{") d++;
    else if (PAGE[j] === "}" && --d === 0) return PAGE.slice(i, j + 1);
  }
  throw new Error("unbalanced braces in " + name);
}
const NAMES = ["esc", "sep", "fmtNum", "fmtPace", "fmtDate", "updatedLabel", "passLabel", "headerHtml",
  "switchHtml", "horizonsHtml", "noteHtml", "niceStep", "chartSvg", "tableHtml", "followUpDelay",
  "refreshDue", "setStatus", "render", "load"];
const CONSTS = PAGE.match(/^var [A-Z_]+ = .*;$/gm);
function page(globals = {}) {
  const box = { ...globals };
  vm.createContext(box);
  vm.runInContext([...CONSTS, ...NAMES.map(fn), `globalThis.P = { ${NAMES.join(", ")}, STATE };`].join("\n"), box);
  return box.P;
}

const UPDATED = Date.UTC(2026, 9, 19, 12, 0);
const row = (position, over = {}) => ({ position, id: 2000 + position, name: "F" + position, respect: 3552938 + (250 - position) * 1000,
  gap: (250 - position) * 1000, pace: { 7: 50, 30: 40 }, days: { 7: 30, 30: 25 }, ...over });
const ROWS = [];
for (let p = 230; p < 250; p++) ROWS.push(row(p));
ROWS.push({ position: 250, id: 42055, name: "Dead Fragment", respect: 3552938, gap: 0, us: true,
  pace: { 7: 110, 30: 100 }, days: { 7: null, 30: null } });
for (let p = 251; p <= 255; p++) ROWS.push(row(p, { gap: (250 - p) * 1000, days: { 7: null, 30: null } }));
Object.assign(ROWS[19].days, { 30: 0.3 });                         // #249: passed later today
Object.assign(ROWS[18], { pace: { 7: 120, 30: 120 }, days: { 7: null, 30: null } });  // #248: faster than us
Object.assign(ROWS[0].days, { 30: 400 });                          // #230: more than a year
Object.assign(ROWS[15].days, { 30: 100 });                         // #245: next year
Object.assign(ROWS[17], { name: "<b>Evil</b> & co" });             // #247
Object.assign(ROWS[16], { pace: { 7: null, 30: null } });          // #246: no pace
Object.assign(ROWS[21], { pace: { 7: 160, 30: 160 }, days: { 7: 0, 30: 0 } });     // #251: today
Object.assign(ROWS[22], { pace: { 7: 160, 30: 160 }, days: { 7: 0.5, 30: 0.5 } }); // #252: 1 day
Object.assign(ROWS[23], { pace: { 7: 160, 30: 160 }, days: { 7: 20.2, 30: 20.2 } }); // #253: 21 days
Object.assign(ROWS[24], { pace: { 7: 101, 30: 101 }, days: { 7: 400, 30: 400 } });   // #254: over a year
const DATA = {
  factionId: 42055, source: "live", refreshing: false, updatedAt: UPDATED, day: "2026-10-19",
  windows: [7, 30], defaultWindow: 30,
  us: { position: 250, respect: 3552938, pace: { 7: 110, 30: 100 } },
  rows: ROWS,
  history: [{ day: "2026-09-18", position: 255 }, { day: "2026-10-18", position: 250 }, { day: "2026-10-19", position: 250 }],
  projection: {
    7: Array.from({ length: 365 }, (_, i) => 249 - Math.floor(i / 10)),
    30: Array.from({ length: 365 }, (_, i) => 248 - Math.floor(i / 6)),
  },
  notes: { 7: null, 30: "We climbed 5 places last month (#255 to #250)." },
};

test("the page formats numbers exactly as hof-climb.js does", () => {
  const P = page();
  for (const v of [0, 188, 9999, 10000, 74850, 99950, 110914, 999500, 3552938, -33882, -1000000]) {
    assert.equal(P.fmtNum(v), climb.fmtNum(v), String(v));
  }
  for (const v of [7752.032, -7752.5, -0.3, null, NaN]) assert.equal(P.fmtPace(v), climb.fmtPace(v), String(v));
});

test("the table lists 20 above, us highlighted, and 5 below, linked to Torn", () => {
  const html = page().tableHtml(DATA, 30);
  assert.equal(html.split("<tr").length - 1, 27, "a header row and 26 rows");
  assert.equal(html.split('<tr class="us">').length - 1, 1);
  assert.match(html, /href="https:\/\/www\.torn\.com\/factions\.php\?step=profile&amp;ID=2249"[^>]*>#249 F249</);
});

test("faction names from Torn are escaped", () => {
  const html = page().tableHtml(DATA, 30);
  assert.ok(html.includes("#247 &lt;b&gt;Evil&lt;/b&gt; &amp; co"));
  assert.ok(!html.includes("<b>Evil</b>"));
});

test("the pass column says when we pass, or why we don't", () => {
  const P = page();
  const label = (i) => P.passLabel(ROWS[i], i < 20, 100, 30, UPDATED);
  assert.equal(label(19), "19 Oct");
  assert.equal(label(18), "pulling away");
  assert.equal(label(0), "over a year");
  assert.equal(label(15), "27 Jan 2027", "the year shows when it isn't this year");
  assert.equal(label(16), "—", "no pace");
  assert.equal(label(20), "", "our own row");
  assert.equal(label(21), "catches us today");
  assert.equal(label(22), "catches us in 1 day");
  assert.equal(label(23), "catches us in 21 days");
  assert.equal(label(24), "", "beyond a year, a row below shows nothing");
  assert.equal(label(25), "", "a slower row below shows nothing");
});

test("the chart draws history solid and the projection dashed, best at the top", () => {
  const svg = page().chartSvg(DATA, 30);
  const pts = (cls) => svg.match(new RegExp(`class="${cls}" points="([^"]+)"`))[1].split(" ").map((p) => p.split(",").map(Number));
  const hist = pts("hist");
  assert.equal(hist.length, 3);
  assert.ok(hist[0][1] > hist[2][1], "#255 sits lower than #250");
  assert.equal(pts("proj").length, 366, "from today out to a year");
  assert.match(PAGE, /\.chart \.proj\{[^}]*stroke-dasharray/);
  assert.equal(svg.split('class="dot"').length - 1, 5);
  for (const h of [7, 30, 91, 182, 365]) assert.ok(svg.includes(">#" + DATA.projection[30][h - 1] + "<"), "label at d=" + h);
  assert.match(page().chartSvg(DATA, 30, 360), /viewBox="0 0 360 240"/, "drawn at the container's width");
});

test("the switch redraws from the data already loaded, with no new request", () => {
  const els = {};
  let fetches = 0;
  const P = page({ document: { getElementById: (id) => (els[id] ||= { innerHTML: "" }) }, fetch: () => { fetches++; } });
  P.STATE.data = DATA;
  P.STATE.w = 7;
  P.render();
  assert.match(els.horizons.innerHTML, /1 week<\/span><span class="v">#249</);
  assert.match(els.switch.innerHTML, /data-w="7" class="on"/);
  assert.equal(els.note.innerHTML, "");
  P.STATE.w = 30;
  P.render();
  assert.match(els.horizons.innerHTML, /1 week<\/span><span class="v">#247</);
  assert.equal(els.note.innerHTML, "We climbed 5 places last month (#255 to #250).");
  assert.equal(fetches, 0);
});

test("the switch offers only available windows, 30 days first", () => {
  const html = page().switchHtml({ ...DATA, windows: [7, 30, 90] }, 30);
  assert.deepEqual([...html.matchAll(/data-w="(\d+)"/g)].map((m) => m[1]), ["30", "7", "90"]);
  assert.deepEqual([...page().switchHtml(DATA, 30).matchAll(/data-w="(\d+)"/g)].map((m) => m[1]), ["30", "7"]);
});

test("a 'refreshing' answer gets exactly one more fetch, five seconds later", async () => {
  const els = {}, timers = [];
  let fetches = 0;
  const P = page({
    document: { getElementById: (id) => (els[id] ||= { innerHTML: "", textContent: "", className: "" }) },
    fetch: async () => { fetches++; return { status: 200, ok: true, json: async () => ({ ...DATA, refreshing: true }) }; },
    setTimeout: (cb, ms) => { timers.push({ cb, ms }); },
  });
  await P.load(false);
  assert.deepEqual(timers.map((t) => t.ms), [5000]);
  timers[0].cb();
  await new Promise((resolve) => setImmediate(resolve));  // let the follow-up's answer arrive
  assert.equal(fetches, 2);
  assert.equal(timers.length, 1, "the follow-up doesn't schedule another");
});

test("the refresh runs every 15 minutes while visible, and in Torn PDA even when 'hidden'", () => {
  const P = page(), MIN = 60000, t = UPDATED;
  assert.equal(P.refreshDue(t, t + 15 * MIN, true, false), true);
  assert.equal(P.refreshDue(t, t + 14 * MIN, true, false), false);
  assert.equal(P.refreshDue(t, t + 30 * MIN, false, false), false, "a background tab spends nothing");
  assert.equal(P.refreshDue(t, t + 30 * MIN, false, true), true, "PDA can report hidden while on screen");
  assert.equal(P.followUpDelay({ refreshing: false }), null);
});

test("the header says how fresh the standings are", () => {
  const P = page();
  assert.equal(P.updatedLabel(UPDATED, UPDATED + 30000), "updated just now");
  assert.equal(P.updatedLabel(UPDATED, UPDATED + 5 * 60000), "updated 5 min ago");
  assert.equal(P.updatedLabel(UPDATED, UPDATED + 3 * 3600000), "updated 3 h ago");
  assert.match(P.headerHtml(DATA, 30, UPDATED + 60000), /#250<\/div>.*Dead Fragment.*3,552,938 respect · 100\/day over 30 days/);
  assert.match(P.headerHtml({ ...DATA, source: "midnight" }, 30, UPDATED), /Torn&#39;s live standings are unavailable/);
  assert.match(P.headerHtml(DATA, 30, Date.UTC(2026, 9, 21, 12)), /Paces come from the 2026-10-19 snapshot\./);
});
```

- [ ] **Step 2: Run them to make sure they fail**

```bash
cd /opt/warboard/server && node --test hof-page.test.mjs
```

Expected: FAIL with `ENOENT` for `pages/hof.html`.

- [ ] **Step 3: Write the minimal implementation**

Create `server/pages/hof.html`:

```html
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<meta name="color-scheme" content="light dark">
<title>Hall of Fame climb</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,800&display=swap">
<style>
/* The /slackers tokens. Light is the base set; both dark paths redefine only
   the tokens, so no colour is ever defined solely inside a media query. */
:root{
  --bg:#eef1f5; --panel:#ffffff; --sunk:#f6f8fa;
  --ink:#151a21; --muted:#5d6875; --faint:#8a95a3;
  --line:#e0e5ec; --line2:#eef1f5;
  --cool:#2f5d8a;
  --warn:#c8790a; --warn-ink:#7a4805; --warn-wash:rgba(200,121,10,.10); --warn-wash2:rgba(200,121,10,.20);
  --good:#186a6a;
  --rail:#c8790a;
  --shadow:0 1px 2px rgba(20,30,45,.05),0 8px 24px rgba(20,30,45,.07);
}
@media (prefers-color-scheme:dark){
  :root:not([data-theme="light"]){
    --bg:#10141a; --panel:#171d25; --sunk:#131920;
    --ink:#e6ebf2; --muted:#94a1b1; --faint:#6a7683;
    --line:#242c36; --line2:#1c232c;
    --cool:#6aa6dd;
    --warn:#f0a93a; --warn-ink:#f7c983; --warn-wash:rgba(240,169,58,.11); --warn-wash2:rgba(240,169,58,.22);
    --good:#4fb3a5;
    --rail:#f0a93a;
    --shadow:0 1px 2px rgba(0,0,0,.35),0 10px 30px rgba(0,0,0,.4);
  }
}
:root[data-theme="dark"]{
  --bg:#10141a; --panel:#171d25; --sunk:#131920;
  --ink:#e6ebf2; --muted:#94a1b1; --faint:#6a7683;
  --line:#242c36; --line2:#1c232c;
  --cool:#6aa6dd;
  --warn:#f0a93a; --warn-ink:#f7c983; --warn-wash:rgba(240,169,58,.11); --warn-wash2:rgba(240,169,58,.22);
  --good:#4fb3a5;
  --rail:#f0a93a;
  --shadow:0 1px 2px rgba(0,0,0,.35),0 10px 30px rgba(0,0,0,.4);
}

*{box-sizing:border-box}
html,body{margin:0}
body{
  background:var(--bg); color:var(--ink); min-height:100vh;
  font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
  font-variant-numeric:tabular-nums; line-height:1.45;
  -webkit-font-smoothing:antialiased;
  padding:clamp(16px,3.5vw,40px);
}
.inner{max-width:880px;margin:0 auto}
.eyebrow{font-size:11.5px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:var(--muted);margin:0 0 8px}
h1{
  font-family:"Bricolage Grotesque",ui-sans-serif,system-ui,sans-serif;
  font-weight:800; font-size:clamp(30px,6vw,46px); line-height:1;
  letter-spacing:-.03em; margin:0 0 18px;
}
.banner{
  display:none; margin:0 0 16px; padding:11px 14px;
  border:1px solid var(--warn); border-radius:10px; background:var(--warn-wash);
  color:var(--warn-ink); font-size:13px;
}
.banner.on{display:block}
.head{display:flex;align-items:baseline;flex-wrap:wrap;gap:6px 14px;margin:0 0 4px}
.big{font-family:"Bricolage Grotesque",ui-sans-serif,system-ui,sans-serif;font-weight:800;
  font-size:clamp(40px,9vw,60px);line-height:1;letter-spacing:-.03em}
.facts{font-size:15px}
.when{font-size:12.5px;color:var(--muted);margin:0 0 16px}
button{
  font:inherit;font-size:13px;background:var(--sunk);color:var(--ink);
  border:1px solid var(--line);border-radius:8px;padding:7px 12px;cursor:pointer;
}
:focus-visible{outline:2px solid var(--cool);outline-offset:2px}
.seg{display:inline-flex;gap:0;margin:0 0 14px;border:1px solid var(--line);border-radius:9px;overflow:hidden}
.seg:empty{display:none}
.seg button{border:0;border-radius:0}
.seg button + button{border-left:1px solid var(--line)}
.seg button.on{background:var(--cool);color:var(--bg);font-weight:600}
.hz{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px;margin:0 0 14px}
.hz div{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:9px 10px}
.hz .k{display:block;font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--faint)}
.hz .v{font-size:20px;font-weight:700}
@media (max-width:520px){.hz{grid-template-columns:repeat(3,minmax(0,1fr))}}
.note{margin:0 0 16px;padding:11px 14px;background:var(--panel);border:1px solid var(--line);
  border-left:3px solid var(--rail);border-radius:10px;font-size:14px}
.note:empty{display:none}
.panel{background:var(--panel);border:1px solid var(--line);border-radius:12px;box-shadow:var(--shadow);
  overflow:hidden;margin:0 0 16px}
.panel:empty{display:none}
.chart{padding:8px 6px 2px}
.chart svg{display:block;width:100%;height:auto}
.chart .grid{stroke:var(--line);stroke-width:1}
.chart text{fill:var(--faint);font-size:13px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace}
.chart .hist{fill:none;stroke:var(--cool);stroke-width:3;stroke-linejoin:round}
.chart .proj{fill:none;stroke:var(--cool);stroke-width:2.5;stroke-dasharray:7 6;opacity:.85}
.chart .now{stroke:var(--faint);stroke-dasharray:2 4}
.chart .dot{fill:var(--warn)}
.chart .dotlabel{fill:var(--ink);font-weight:700}
.scroll{overflow-x:auto}
table{border-collapse:separate;border-spacing:0;width:100%;min-width:440px;font-size:13.5px}
thead th{
  position:sticky;top:0;z-index:3;background:var(--panel);
  border-bottom:2px solid var(--line);padding:10px;
  font-size:11px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:var(--faint);
  text-align:right;white-space:nowrap;
}
thead th:first-child{text-align:left;position:sticky;left:0;z-index:4}
tbody td{padding:8px 10px;text-align:right;border-bottom:1px solid var(--line2);white-space:nowrap}
tbody td.nm{
  text-align:left;position:sticky;left:0;background:var(--panel);z-index:2;
  font-weight:600;max-width:220px;overflow:hidden;text-overflow:ellipsis;
}
@media (max-width:520px){tbody td.nm{max-width:150px}}
tbody td.nm a{color:inherit;text-decoration:none}
tbody td.nm a:hover{color:var(--cool)}
/* Our row: an opaque wash, so the fixed first column never shows text behind it. */
tbody tr.us td{background:linear-gradient(var(--warn-wash),var(--warn-wash)),var(--panel);font-weight:700}
tbody tr.us td.nm{box-shadow:inset 3px 0 0 var(--rail)}
.foot{color:var(--muted);font-size:12.5px;margin:16px 2px 0;max-width:78ch}
</style>
</head>
<body>
<div class="inner">
  <p class="eyebrow">Faction Hall of Fame · respect</p>
  <h1>How far can we climb?</h1>
  <div id="status" class="banner" role="status"></div>
  <div id="head"></div>
  <div id="switch" class="seg" role="group" aria-label="Pace window"></div>
  <div id="horizons" class="hz"></div>
  <p id="note" class="note"></p>
  <div id="chart" class="panel chart"></div>
  <div class="panel"><div class="scroll" id="table"></div></div>
  <p class="foot"><b>How this works.</b> Pace is the change between Torn's daily snapshots over
    the window, divided by the days. Projections assume every faction keeps its pace and start
    from last midnight's standings; the table uses live respect. Most of our respect arrives with
    each war, so a pass date a few days out can land a few days either way. Positions follow
    Torn's Hall of Fame, which leaves out a few factions that appear in Torn's data.</p>
</div>
<script>
// Every function here is a plain top-level declaration so hof-page.test.mjs
// can run it; render, load and boot are the only ones that touch the DOM.
var DAY_MS = 86400000;
var HORIZONS = [7, 30, 91, 182, 365];
var HORIZON_LABELS = { 7: '1 week', 30: '1 month', 91: '3 months', 182: '6 months', 365: '1 year' };
var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
var SWITCH_ORDER = [30, 7, 90];
var STATE = { data: null, w: null, loadedAt: 0 };
var IS_PDA = typeof window !== 'undefined' && typeof window.flutter_inappwebview !== 'undefined';

// Faction names come from Torn, so they are escaped wherever they're shown.
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

function sep(n) {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

// The same bands as fmtNum in hof-climb.js; hof-page.test.mjs keeps them equal.
function fmtNum(v) {
  var a = Math.abs(v), s = v < 0 ? '-' : '';
  var whole = Math.round(a);
  if (whole === 0) return '0';
  if (whole < 10000) return s + sep(whole);
  var tenthsK = Math.round(a / 100);
  if (tenthsK < 1000) return s + Math.floor(tenthsK / 10) + '.' + (tenthsK % 10) + 'k';
  var k = Math.round(a / 1000);
  if (k < 1000) return s + k + 'k';
  var hundredthsM = Math.round(a / 10000);
  return s + Math.floor(hundredthsM / 100) + '.' + String(hundredthsM % 100).padStart(2, '0') + 'M';
}

function fmtPace(p) {
  if (p == null || !isFinite(p)) return '—';
  var r = Math.sign(p) * Math.round(Math.abs(p));
  return (r < 0 ? '-' : '') + sep(Math.abs(r)) + '/day';
}

// Torn time is UTC. The year shows only when it isn't the current one.
function fmtDate(ms, nowMs) {
  var d = new Date(ms), y = d.getUTCFullYear();
  return d.getUTCDate() + ' ' + MONTHS[d.getUTCMonth()] + (y !== new Date(nowMs).getUTCFullYear() ? ' ' + y : '');
}

function updatedLabel(updatedAt, nowMs) {
  var mins = Math.floor((nowMs - updatedAt) / 60000);
  if (mins < 1) return 'updated just now';
  if (mins < 60) return 'updated ' + mins + ' min ago';
  return 'updated ' + Math.floor(mins / 60) + ' h ago';
}

// The pass column. days comes from the API: until we pass a row above, or
// until a row below catches us.
function passLabel(row, above, usPace, w, updatedAt) {
  if (row.us) return '';
  var pace = row.pace ? row.pace[w] : null;
  if (pace == null || usPace == null || !isFinite(pace) || !isFinite(usPace)) return '—';
  var days = row.days ? row.days[w] : null;
  if (above) {
    if (days == null) return 'pulling away';
    if (days > 365) return 'over a year';
    return fmtDate(updatedAt + days * DAY_MS, updatedAt);
  }
  if (days == null || days > 365) return '';
  var n = Math.ceil(days);
  return n === 0 ? 'catches us today' : 'catches us in ' + n + (n === 1 ? ' day' : ' days');
}

function headerHtml(data, w, nowMs) {
  if (!data.us) return '<p class="when">We are not in these standings.</p>';
  var name = '';
  data.rows.forEach(function (r) { if (r.us) name = r.name; });
  var when = data.source === 'midnight'
    ? "Torn's live standings are unavailable, so this shows last midnight's."
    : updatedLabel(data.updatedAt, nowMs);
  var age = Math.floor((nowMs - Date.parse(data.day + 'T00:00:00Z')) / DAY_MS);
  var old = age > 1 ? ' Paces come from the ' + data.day + ' snapshot.' : '';
  return '<div class="head"><div class="big">#' + data.us.position + '</div>' +
    '<div class="facts"><b>' + esc(name) + '</b> · ' + sep(data.us.respect) + ' respect · ' +
    esc(fmtPace(data.us.pace ? data.us.pace[w] : null)) + ' over ' + w + ' days</div></div>' +
    '<p class="when">' + esc(when + old) + '</p>';
}

function switchHtml(data, w) {
  return SWITCH_ORDER.filter(function (x) { return data.windows.indexOf(x) >= 0; }).map(function (x) {
    return '<button type="button" data-w="' + x + '"' + (x === w ? ' class="on" aria-pressed="true"' : ' aria-pressed="false"') +
      '>' + x + ' days</button>';
  }).join('');
}

function horizonsHtml(data, w) {
  var proj = data.projection && data.projection[w];
  if (!proj) return '';
  return HORIZONS.map(function (d) {
    return '<div><span class="k">' + HORIZON_LABELS[d] + '</span><span class="v">#' + proj[d - 1] + '</span></div>';
  }).join('');
}

function noteHtml(data, w) {
  return data.notes && data.notes[w] ? esc(data.notes[w]) : '';
}

function niceStep(raw) {
  var steps = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 5000];
  for (var i = 0; i < steps.length; i++) if (steps[i] >= raw) return steps[i];
  return 10000;
}

// Our position over time, best at the top: the saved history solid, the
// projection dashed out to a year, the horizons as labelled dots. Drawn at
// the container's real pixel width, so its 13 px text stays 13 px on a phone.
function chartSvg(data, w, width) {
  var hist = (data.history || []).filter(function (h) { return h.position; });
  if (!hist.length) return '';
  var proj = data.projection && data.projection[w];
  var W = Math.max(300, Math.round(width || 660)), H = 240, L = 52, R = 16, T = 18, B = 30, iw = W - L - R, ih = H - T - B;
  var t0 = Date.parse(hist[0].day + 'T00:00:00Z'), tL = Date.parse(data.day + 'T00:00:00Z');
  var t1 = proj ? tL + 365 * DAY_MS : Math.max(tL, t0 + DAY_MS);
  var all = hist.map(function (h) { return h.position; }).concat(proj || []);
  var best = Math.min.apply(null, all), worst = Math.max.apply(null, all);
  var step = niceStep(Math.max(1, (worst - best) / 4));
  var top = Math.max(1, Math.floor(best / step) * step);
  var bottom = Math.max(top + step, Math.ceil(worst / step) * step);
  function x(t) { return (L + (t - t0) / (t1 - t0) * iw).toFixed(1); }
  function y(p) { return (T + (p - top) / (bottom - top) * ih).toFixed(1); }

  var g = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Our Hall of Fame position: saved history, then the projection">';
  for (var p = top; p <= bottom; p += step) {
    g += '<line class="grid" x1="' + L + '" x2="' + (W - R) + '" y1="' + y(p) + '" y2="' + y(p) + '"/>' +
      '<text x="' + (L - 8) + '" y="' + (Number(y(p)) + 4) + '" text-anchor="end">#' + p + '</text>';
  }
  // Month labels at each UTC month start; January shows the year instead.
  var months = [], d0 = new Date(t0);
  for (var m = Date.UTC(d0.getUTCFullYear(), d0.getUTCMonth() + 1, 1); m <= t1;
       m = Date.UTC(new Date(m).getUTCFullYear(), new Date(m).getUTCMonth() + 1, 1)) months.push(m);
  var every = Math.max(1, Math.ceil(months.length / Math.max(1, Math.floor(iw / 56))));
  months.forEach(function (ms, i) {
    if (i % every) return;
    var dm = new Date(ms);
    var label = dm.getUTCMonth() === 0 ? String(dm.getUTCFullYear()) : MONTHS[dm.getUTCMonth()];
    g += '<text x="' + x(ms) + '" y="' + (H - 8) + '" text-anchor="middle">' + label + '</text>';
  });
  g += '<line class="now" x1="' + x(tL) + '" x2="' + x(tL) + '" y1="' + T + '" y2="' + (H - B) + '"/>';
  g += '<polyline class="hist" points="' + hist.map(function (h) {
    return x(Date.parse(h.day + 'T00:00:00Z')) + ',' + y(h.position);
  }).join(' ') + '"/>';
  if (proj) {
    var pts = [x(tL) + ',' + y(hist[hist.length - 1].position)];
    for (var d = 1; d <= 365; d++) pts.push(x(tL + d * DAY_MS) + ',' + y(proj[d - 1]));
    g += '<polyline class="proj" points="' + pts.join(' ') + '"/>';
    // 1 week and 1 month sit close together, so the lower dot's label goes
    // below and the higher one's above; any label that would clip at the top
    // goes below too.
    var below = proj[6] >= proj[29] ? 7 : 30;
    HORIZONS.forEach(function (hd) {
      var cx = x(tL + hd * DAY_MS), cy = Number(y(proj[hd - 1]));
      var ly = hd === below || cy - 9 < T + 10 ? cy + 20 : cy - 9;
      g += '<circle class="dot" cx="' + cx + '" cy="' + cy + '" r="4.5"/>' +
        '<text class="dotlabel" x="' + cx + '" y="' + ly + '" text-anchor="middle">#' + proj[hd - 1] + '</text>';
    });
  }
  return g + '</svg>';
}

function tableHtml(data, w) {
  var me = -1;
  data.rows.forEach(function (r, i) { if (r.us) me = i; });
  var usPace = data.us && data.us.pace ? data.us.pace[w] : null;
  var body = data.rows.map(function (r, i) {
    var link = 'https://www.torn.com/factions.php?step=profile&ID=' + encodeURIComponent(r.id);
    return '<tr' + (r.us ? ' class="us"' : '') + '>' +
      '<td class="nm"><a href="' + esc(link) + '" target="_blank" rel="noopener">#' + r.position + ' ' + esc(r.name) + '</a></td>' +
      '<td>' + (r.us ? '' : esc(fmtNum(r.gap))) + '</td>' +
      '<td>' + esc(fmtPace(r.pace ? r.pace[w] : null).replace('/day', '')) + '</td>' +
      '<td>' + esc(passLabel(r, me >= 0 && i < me, usPace, w, data.updatedAt)) + '</td></tr>';
  }).join('');
  return '<table><thead><tr><th>Faction</th><th>Gap</th><th>Pace /day</th><th>Pass</th></tr></thead><tbody>' + body + '</tbody></table>';
}

// While the server is refreshing, ask once more a few seconds later; that
// second request reads the shared copy and costs no Torn call.
function followUpDelay(data) {
  return data && data.refreshing ? 5000 : null;
}

// Every 15 minutes while the tab is visible. Torn PDA's WebView can report
// hidden while the page is on screen, so there it refreshes regardless.
function refreshDue(loadedAt, nowMs, visible, isPda) {
  return (visible || isPda) && nowMs - loadedAt >= 15 * 60000;
}

function setStatus(text) {
  var el = document.getElementById('status');
  el.textContent = text || '';
  el.className = text ? 'banner on' : 'banner';
}

function render() {
  var d = STATE.data;
  if (!d) return;
  if (d.windows.indexOf(STATE.w) < 0) STATE.w = d.defaultWindow;
  var w = STATE.w, now = Date.now();
  document.getElementById('head').innerHTML = headerHtml(d, w, now);
  document.getElementById('switch').innerHTML = switchHtml(d, w);
  document.getElementById('horizons').innerHTML = horizonsHtml(d, w);
  document.getElementById('note').innerHTML = noteHtml(d, w);
  // The panel is hidden while empty, so measure the column it sits in.
  var chart = document.getElementById('chart');
  var width = (chart.parentNode && chart.parentNode.clientWidth) || 672;
  chart.innerHTML = chartSvg(d, w, width - 14);
  document.getElementById('table').innerHTML = tableHtml(d, w);
}

function load(isFollowUp) {
  return fetch('/api/hof', { cache: 'no-store' }).then(function (r) {
    if (r.status === 503) {
      setStatus("Collecting Torn's daily snapshots. Check back in a few minutes.");
      return null;
    }
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.json();
  }).then(function (d) {
    if (!d) return;
    STATE.data = d;
    STATE.loadedAt = Date.now();
    setStatus('');
    render();
    var delay = followUpDelay(d);
    if (delay && !isFollowUp) setTimeout(function () { load(true); }, delay);
  }).catch(function () {
    if (!STATE.data) return setStatus("Couldn't reach warboard. It will try again in a minute.");
    var mins = Math.max(1, Math.round((Date.now() - STATE.data.updatedAt) / 60000));
    setStatus("Couldn't reach warboard; showing data from " + mins + ' min ago.');
  });
}

function boot() {
  document.getElementById('switch').addEventListener('click', function (e) {
    var b = e.target.closest ? e.target.closest('button[data-w]') : null;
    if (!b) return;
    STATE.w = Number(b.getAttribute('data-w'));
    render();
  });
  function tick() {
    if (refreshDue(STATE.loadedAt, Date.now(), !document.hidden, IS_PDA)) load(false);
  }
  var resized = null;
  window.addEventListener('resize', function () { clearTimeout(resized); resized = setTimeout(render, 150); });
  document.addEventListener('visibilitychange', tick);
  setInterval(tick, 60000);
  load(false);
}

boot();
</script>
</body>
</html>
```

- [ ] **Step 4: Run the tests and make sure they pass**

```bash
cd /opt/warboard/server && node --test hof-page.test.mjs
```

Expected: `# tests 10`, `# pass 10`, `# fail 0`.

The chart is drawn at its column's pixel width, so its 13 px text stays 13 px on a phone. The panel is hidden while empty, which is why `render()` measures the parent. The table scrolls sideways on a phone with the first column fixed.

- [ ] **Step 5: Commit**

```bash
cd /opt/warboard && git add server/pages/hof.html server/hof-page.test.mjs && \
  git commit -m "HoF climb: the /hof page" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 14: The real-data check

**Files:**
- Create: `/root/hof-spike/check.mjs` (outside the repo; next to the three saved snapshots `2026-09-18.csv`, `2026-10-18.csv`, `2026-10-19.csv`)

**Interfaces:**
- Consumes: `runOnce`, `parseSnapshotCsv`, `snapshotFacts` (Tasks 7–9), `fmtPace`, `horizonsOf` (Tasks 1, 3).

The spec's anchors, checked end to end: the real job runs against a fake Torn that serves the three saved snapshots, in a temporary data directory. It lives outside `server/`, so `deploy.sh`'s test run never picks it up.

- [ ] **Step 1: Write the check**

Create `/root/hof-spike/check.mjs` (it may already exist from the plan's own verification; if so, make sure it matches):

```js
// One-off: the spec's real-data anchors from the snapshots saved during the
// Hall of Fame feasibility spike. It runs the real job end to end against a
// fake Torn serving those files, in a temporary data directory. Not part of the
// repo, and never picked up by deploy.sh's test run.
//   node /root/hof-spike/check.mjs [server dir, default /opt/warboard/server]
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const SERVER = process.argv[2] || "/opt/warboard/server";
const SPIKE = new URL(".", import.meta.url).pathname;
process.env.DATA_DIR = mkdtempSync(join(tmpdir(), "hof-check-"));
const { runOnce, parseSnapshotCsv, snapshotFacts } = await import(join(SERVER, "hof-snapshots.js"));
const climb = await import(join(SERVER, "hof-climb.js"));

const DAYS = ["2026-09-18", "2026-10-18", "2026-10-19"];
const csv = Object.fromEntries(DAYS.map((d) => [d, readFileSync(join(SPIKE, `${d}.csv`), "utf8")]));

// The Hall of Fame as the job would have seen it on 2026-10-19: the snapshot
// by respect, without the hidden 42113.
const facts = snapshotFacts(parseSnapshotCsv(csv["2026-10-19"]));
const hof = Object.entries(facts.respect).filter(([id]) => id !== "42113")
  .sort((a, b) => b[1] - a[1] || Number(a[0]) - Number(b[0]));
const reply = (body) => ({ status: 200, ok: true, text: async () => body });
const fetchImpl = async (url) => {
  const u = new URL(url);
  if (u.pathname === "/v2/faction/snapshot") {
    const day = new Date(Number(u.searchParams.get("timestamp")) * 1000).toISOString().slice(0, 10);
    return reply(day in csv ? csv[day] : JSON.stringify({ error: { code: 30, error: "File does not exist" } }));
  }
  const off = Number(u.searchParams.get("offset")), lim = Number(u.searchParams.get("limit"));
  return reply(JSON.stringify({ factionhof: hof.slice(off, off + lim).map(([id, respect], i) => ({
    id: Number(id), name: facts.names[id], position: off + i + 1, values: { respect } })) }));
};

let now = Date.UTC(2026, 9, 19, 0, 5);
const s = await runOnce({ fetchImpl, key: "check", factionId: 42055, nowFn: () => now, sleep: async (ms) => { now += ms; } });
const dir = join(process.env.DATA_DIR, "hof");
const d = JSON.parse(readFileSync(join(dir, "digest.json"), "utf8"));
const L = JSON.parse(readFileSync(join(dir, "days", "2026-10-19.json"), "utf8"));

assert.deepEqual(s.saved, ["2026-10-19", "2026-10-18", "2026-09-18"]);
assert.deepEqual(s.hidden, [42113]);
assert.deepEqual(d.history.map((h) => [h.day, h.position]), [["2026-09-18", 255], ["2026-10-18", 250], ["2026-10-19", 250]]);
assert.deepEqual(d.windows, { 30: { base: "2026-09-18", span: 31 } }, "no 7-day or 90-day window from these three days");
assert.equal(climb.fmtPace(d.paces[42055][30]), "7,752/day");
assert.deepEqual(Object.values(climb.horizonsOf(d.projection[30])), [246, 238, 218, 209, 181]);
assert.equal(d.paces[57856][30], 0, "flat at 50,000 since its first saved day");
const usR = L.respect[42055], usP = d.paces[42055][30];
const catchers = Object.keys(d.paces).filter((id) => id !== "42055" && L.respect[id] < usR
  && d.paces[id][30] > usP && (usR - L.respect[id]) / (d.paces[id][30] - usP) <= 365);
assert.deepEqual(catchers, [], "no faction below us catches us within a year");
assert.equal(d.notes[30], "We climbed 5 places last month (#255 to #250). At this pace we climb 12 in the next month, " +
  "because 12 factions are within 111k respect above us.");
assert.equal(d.midnight.position, 250);
console.log(`all anchors hold: #${d.midnight.position}, ${climb.fmtPace(usP)}, horizons ` +
  `${Object.values(climb.horizonsOf(d.projection[30])).map((p) => "#" + p).join(" ")}`);
```

- [ ] **Step 2: Run it**

```bash
node /root/hof-spike/check.mjs /opt/warboard/server
```

Expected: `all anchors hold: #250, 7,752/day, horizons #246 #238 #218 #209 #181`. Any assertion error means a definition drifted from the spec; fix the code, not the check.

---

### Task 15: Deploy, first run, and the two spike days

**Files:**
- Create: `/root/hof-spike/seed.mjs` (outside the repo)
- Modify: `docs/superpowers/specs/2026-10-19-hof-respect-climb-design.md` (status line)

- [ ] **Step 1: Deploy**

```bash
cd /opt/warboard/server && ./deploy.sh
```

Expected: the suite passes, then `deploy ok`. Confirm the reload took with `pm2 describe warboard | grep -E 'status|uptime'`: an uptime of seconds, not hours.

- [ ] **Step 2: Watch the first catch-up**

About a minute after the reload, the boot catch-up starts. The first run makes up to 45 snapshot calls and 5 Hall of Fame calls, about 1.1 s apart.

```bash
pm2 logs warboard --lines 300 --nostream | grep '\[hof\]'
```

Expected: `[hof] scheduled: 00:05 UTC daily, catch-up in 60 s`, then a `[hof] boot: saved N (...)` line with N of 30 or more, `hidden [42113]`, and `digest <today> #<position>`. Then check the folder:

```bash
stat -c '%U %n' /opt/warboard/server/data/hof /opt/warboard/server/data/hof/days && ls /opt/warboard/server/data/hof/days | wc -l
```

Expected: both owned by `warboard`, and the same number of day files as the log line said.

- [ ] **Step 3: Compare with Torn**

```bash
curl -s http://127.0.0.1:3000/api/hof | head -c 600; echo
```

Expected: `"source":"live"` once the first refresh has run (the first answer may be `"midnight"` with `"refreshing":true`). Open `https://tornwar.com/hof` on a phone and on a desktop, with Torn's own Hall of Fame (respect) beside it. Our position, and the positions and respect of the rows around us, must match Torn's.

- [ ] **Step 4: Add the two spike days (owner's OK, 2026-10-19)**

Create `/root/hof-spike/seed.mjs`:

```js
// One-off (owner's OK, 2026-10-19): add the spike's 2026-09-18 and 2026-10-18
// snapshots to the live history, in case Torn has already deleted them.
// Stages the raw and day files in a temporary folder and prints its path; the
// shell step installs them as the server's user. Days already saved are skipped.
//   node /root/hof-spike/seed.mjs [hof data dir] [server dir]
import { existsSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gzipSync } from "node:zlib";

const LIVE = process.argv[2] || "/opt/warboard/server/data/hof";
const SERVER = process.argv[3] || "/opt/warboard/server";
const SPIKE = new URL(".", import.meta.url).pathname;
const { parseSnapshotCsv, snapshotFacts } = await import(join(SERVER, "hof-snapshots.js"));

// The newest saved day's hidden list, which every backfilled day uses too.
const saved = readdirSync(join(LIVE, "days")).filter((n) => /^\d{4}-\d{2}-\d{2}\.json$/.test(n)).sort();
const hidden = JSON.parse(readFileSync(join(LIVE, "days", saved[saved.length - 1]), "utf8")).hidden || [];

const out = mkdtempSync(join(tmpdir(), "hof-seed-"));
for (const day of ["2026-09-18", "2026-10-18"]) {
  if (existsSync(join(LIVE, "days", `${day}.json`))) { console.log(`${day}: already saved`); continue; }
  const text = readFileSync(join(SPIKE, `${day}.csv`), "utf8");
  const facts = snapshotFacts(parseSnapshotCsv(text));
  writeFileSync(join(out, `${day}.csv.gz`), gzipSync(text));
  writeFileSync(join(out, `${day}.json`), JSON.stringify({ day, respect: facts.respect, hidden }));
  console.log(`${day}: staged (${facts.count} factions, hidden [${hidden.join(",")}])`);
}
console.log(out);
```

Stage the files, then install them as the server's user. A temporary name and a rename keep the job from ever reading half a file:

```bash
OUT=$(node /root/hof-spike/seed.mjs | tee /dev/stderr | tail -1)
H=/opt/warboard/server/data/hof
for f in "$OUT"/*.csv.gz; do [ -e "$f" ] || continue
  install -o warboard -g warboard -m 0644 "$f" "$H/raw/$(basename "$f").tmp" && mv "$H/raw/$(basename "$f").tmp" "$H/raw/$(basename "$f")"
done
for f in "$OUT"/*.json; do [ -e "$f" ] || continue
  install -o warboard -g warboard -m 0644 "$f" "$H/days/$(basename "$f").tmp" && mv "$H/days/$(basename "$f").tmp" "$H/days/$(basename "$f")"
done
rm -rf "$OUT"; ls -l "$H/days" | head -3
```

Expected: each day prints `staged` or `already saved` (Torn may still have served it in Step 2). The next nightly run rebuilds the digest with these days in the history; the next morning, check that `/api/hof` lists `2026-09-18` in `history`.

- [ ] **Step 5: Mark the spec built, and push**

In the spec, change the status line to:

```markdown
**Status:** built and live at `/hof` (<deploy date>)
```

```bash
cd /opt/warboard && git add docs/superpowers/specs/2026-10-19-hof-respect-climb-design.md && \
  git commit -m "HoF climb: live at /hof" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

```bash
cd /opt/warboard && git push origin main 2>&1 | sed -E 's#//[^/@]*@#//***@#g'
```
