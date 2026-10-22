# Hall of Fame Climb: Long Pace Windows Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/hof` offers 3-month, 6-month and 1-year paces. Until warboard's own snapshots reach that far back, they are estimated from Torn's public chain and ranked-war records, and marked as estimated.

**Architecture:**
- `hof-estimate.js` (new, pure) holds the estimate maths, and `bin/hof-estimate-build.mjs` (new) runs it once over a pull of Torn replies to write `data/hof/estimates.json`.
- `hof-climb.js` offers an estimated window when no exact one exists and keeps those paces apart from exact ones.
- `hof-snapshots.js` feeds the file into the nightly digest.
- `hof-api.js` flags estimated windows.
- `pages/hof.html` labels them.

**Tech Stack:** Node 20 ESM, `node:test`, no new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-22-hof-long-pace-windows-design.md` (commit 40e0ac6f)

## Global Constraints

- `WINDOWS = [7, 30, 90, 182, 365]`. Labels are 7 days, 30 days, 3 months, 6 months and 1 year. The switch order is 30, 7, 90, 182, 365.
- The 7-day and 30-day windows behave exactly as before.
- An estimated window has base = latest − w and span = w. It is offered only when no exact base exists, the estimate holds us on that day, and an exact window exists to lay under it.
- A faction with no estimate at the base gets no pace in an estimated window. It never falls back to its first saved day.
- The projection and crowding note for an estimated window use the estimated paces over the longest exact window's paces.
- `DIGEST_VERSION = 2` and `KEEP_DAYS = 402`.
- The estimates file is `server/data/hof/estimates.json`, `{ version: 1, builtAt, anchorDay, fittedTo, band, factions, days: { day: { id: respect } } }`. It is owned by warboard and never written into `days/`.
- `LOSS_PER_ENEMY_SCORE = 0.25`.
- The public repo carries no key endings. Code comments are `//` lines that say why.
- Commit trailer: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Phone width.** All five switch buttons should sit on one line at 360 px. This is checked by a screenshot, not a test.
2. **The day 3 months goes exact (2026-12-17).** From then on, 6 months and 1 year use 90-day paces underneath, and the note says "3-month pace". The page test covers the wording; the digest test covers the underlay.
3. **The real file's size.** About 1 MB is parsed on every run and every digest check. A run makes at most two parses.
4. **Factions in the band with incomplete records.** They get no pace. The table shows "—" and the projection uses the underlay. The API test covers a row with no pace.
5. **A gap in our own series.** It would silently drop the window for that day. The build refuses a series with a gap.

---

### Task 1: The estimate maths and the build script

**Files:**
- Create: `server/hof-estimate.js`
- Create: `server/bin/hof-estimate-build.mjs`
- Test: `server/hof-estimate.test.mjs`

**Interfaces:**
- Produces:
  - `overlap(start, end, t0, t1)` returns a number in [0, 1].
  - `publicGain({ id, chains, wars, rewards, t0, t1, openEnd })` returns a number.
  - `unseenRate({ r0, rU, gain, days })` returns a number.
  - `missingRecords({ chainPages, warList, rewards, fromS, fitS })` returns a string or null.
  - `estimateSeries({ id, chains, wars, rewards, anchorDay, anchorRespect, fitDay, fitRespect, from })` returns `{ u, days }` or null.
  - `estimatesFile({ series, builtAt, anchorDay, fitDay, band })` returns the file object.
  - `ESTIMATES_VERSION = 1`.
  - The CLI's `--replies --factions --own --from --fit --out` options.

- [ ] **Step 1: Write the failing tests** — create `server/hof-estimate.test.mjs`:

```js
// The estimate behind /hof's long paces (spec:
// docs/superpowers/specs/2026-10-22-hof-long-pace-windows-design.md).
// Synthetic factions only; the real file is checked outside the repo.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

process.env.DATA_DIR = mkdtempSync(join(tmpdir(), "hof-estimate-test-"));
const est = await import("./hof-estimate.js");
const { dayMs } = await import("./hof-climb.js");

const DAY = 86400;
const at = (day, hours = 0) => dayMs(day) / 1000 + hours * 3600;
const A0 = "2026-09-18", AU = "2026-10-22";

test("overlap is the share of the time inside the range; a zero-length item counts whole if it starts inside", () => {
  assert.equal(est.overlap(0, 100, 0, 100), 1);
  assert.equal(est.overlap(0, 100, 50, 200), 0.5);
  assert.equal(est.overlap(0, 100, 100, 200), 0, "the range is half-open");
  assert.equal(est.overlap(0, 100, -50, 25), 0.25);
  assert.equal(est.overlap(10, 10, 0, 20), 1);
  assert.equal(est.overlap(20, 20, 0, 20), 0);
});

test("a chain that straddles the start of the range counts by the share of its time inside", () => {
  const chains = [{ id: 1, respect: 1000, start: at("2026-09-17", 18), end: at("2026-09-18", 6) }];
  const g = est.publicGain({ id: 7, chains, wars: [], rewards: {}, t0: at("2026-09-18"), t1: at("2026-10-01"), openEnd: at(AU) });
  assert.equal(g, 500);
});

test("a war's reward counts only if it ended inside the range; a quarter of the enemy's score comes off, by the share inside", () => {
  const wars = [{ id: 9, start: at("2026-09-20"), end: at("2026-09-22"),
    factions: [{ id: 7, score: 9000 }, { id: 8, score: 4000 }] }];
  const g = (t0, t1) => est.publicGain({ id: 7, chains: [], wars, rewards: { 9: 6000 }, t0: at(t0), t1: at(t1), openEnd: at(AU) });
  assert.equal(g("2026-09-18", "2026-10-01"), 6000 - 1000);
  assert.equal(g("2026-09-21", "2026-10-01"), 6000 - 500, "half the war, the whole reward");
  assert.equal(g("2026-09-18", "2026-09-21"), -500, "ended after the range: no reward yet");
});

test("a war still running counts its losses up to the end of the fitted days", () => {
  const wars = [{ id: 9, start: at("2026-10-20"), end: 0, factions: [{ id: 7, score: 100 }, { id: 8, score: 800 }] }];
  const g = est.publicGain({ id: 7, chains: [], wars, rewards: {}, t0: at("2026-10-21"), t1: at(AU), openEnd: at(AU) });
  assert.equal(g, -100, "half of 0.25 x 800");
});

// Faction 7: 100,000 on A0 and 103,400 on AU. Its records show a 1,000 chain
// inside the fitted days and a 500 chain on the day before A0, so everything
// the records miss comes to (3,400 - 1,000) / 34 a day.
const FACTION = {
  id: 7, wars: [], rewards: {}, anchorDay: A0, anchorRespect: 100000, fitDay: AU, fitRespect: 103400, from: "2026-09-15",
  chains: [
    { id: 1, respect: 1000, start: at("2026-10-01"), end: at("2026-10-01", 2) },
    { id: 2, respect: 500, start: at("2026-09-17", 3), end: at("2026-09-17", 4) },
  ],
};

test("the unseen rate closes the fitted days exactly", () => {
  assert.equal(est.unseenRate({ r0: 100000, rU: 103400, gain: 1000, days: 34 }), 2400 / 34);
  assert.equal(est.estimateSeries(FACTION).u, 2400 / 34);
});

test("each day back takes off that day's records and one day of the unseen rate", () => {
  const s = est.estimateSeries(FACTION);
  const u = 2400 / 34;
  assert.deepEqual(Object.keys(s.days), ["2026-09-15", "2026-09-16", "2026-09-17"], "from `from` to the day before A0");
  assert.equal(s.days["2026-09-17"], Math.round(100000 - 500 - u));
  assert.equal(s.days["2026-09-15"], Math.round(100000 - 500 - 3 * u));
});

test("a faction the records can't explain (a day at 0 or below) is left out", () => {
  assert.equal(est.estimateSeries({ ...FACTION, anchorRespect: 150, fitRespect: 3550 }), null);
});

test("records that stop short leave the faction out, and say why", () => {
  const chain = (id, start) => ({ id, respect: 1, start, end: start + 60 });
  const full = Array.from({ length: 100 }, (_, i) => chain(i, at("2026-01-01") + i));
  const from = at("2025-10-08"), fit = at(AU);
  const ok = { chainPages: [[chain(1, at("2026-01-01"))]], warList: [], rewards: {}, fromS: from, fitS: fit };
  assert.equal(est.missingRecords(ok), null);
  assert.equal(est.missingRecords({ ...ok, chainPages: [] }), "no chain pages");
  assert.equal(est.missingRecords({ ...ok, chainPages: [full] }), "chain pages stop short");
  assert.equal(est.missingRecords({ ...ok, chainPages: [full, full] }), null, "a page of chains already seen ends it");
  assert.equal(est.missingRecords({ ...ok, chainPages: [full, [chain(500, from + 5)]] }), null, "a short page ends it");
  assert.equal(est.missingRecords({ ...ok, chainPages: [[...full.slice(1), chain(0, from - 5)]] }), null, "a full page reaching back past from");
  const war = (id, end) => ({ id, start: end - DAY, end, factions: [] });
  const hundred = Array.from({ length: 100 }, (_, i) => war(i, at("2026-01-01") + i * DAY));
  assert.equal(est.missingRecords({ ...ok, warList: null }), "no war list");
  assert.equal(est.missingRecords({ ...ok, warList: hundred, rewards: Object.fromEntries(hundred.map((w) => [w.id, 1])) }),
    "war list stops short");
  assert.equal(est.missingRecords({ ...ok, warList: [war(5, at("2026-02-01")), war(6, at("2025-01-01"))] }),
    "1 war report(s) missing", "only wars that ended in the range need a report");
});

test("the file maps each day to every faction's respect, oldest day first", () => {
  const f = est.estimatesFile({ series: { 9: { "2026-09-17": 5, "2026-09-16": 4 }, 10: { "2026-09-17": 7 } },
    builtAt: 123, anchorDay: A0, fitDay: AU, band: "test band" });
  assert.deepEqual(f, { version: 1, builtAt: 123, anchorDay: A0, fittedTo: AU, band: "test band", factions: 2,
    days: { "2026-09-16": { 9: 4 }, "2026-09-17": { 9: 5, 10: 7 } } });
  assert.deepEqual(Object.keys(f.days), ["2026-09-16", "2026-09-17"]);
});

test("the build script writes the file from a folder of replies, and says what it left out", () => {
  const root = mkdtempSync(join(tmpdir(), "hof-estimate-build-"));
  const replies = join(root, "replies"), dataDir = join(root, "data");
  mkdirSync(replies);
  mkdirSync(join(dataDir, "hof", "days"), { recursive: true });
  const day = (d, respect) => writeFileSync(join(dataDir, "hof", "days", `${d}.json`), JSON.stringify({ day: d, respect, hidden: [] }));
  day(A0, { 42055: 50000, 7: 100000, 8: 90000 });
  day(AU, { 42055: 60000, 7: 103400, 8: 95000 });
  const put = (name, body) => writeFileSync(join(replies, `${name}.json`), JSON.stringify(body));
  put("chains-7-p1", { chains: FACTION.chains });
  put("rankedwars-7", { rankedwars: [] });
  put("chains-8-p1", { chains: [] });
  put("rankedwars-8", { rankedwars: [{ id: 31, start: at("2026-09-15", 6), end: at("2026-09-16"),
    factions: [{ id: 8, score: 10 }, { id: 9, score: 20 }] }] });
  const factions = join(root, "factions.json");
  writeFileSync(factions, JSON.stringify({ rule: "test band", factions: [{ id: "7" }, { id: "8" }, { id: "42055" }] }));
  const own = join(root, "own.csv");
  writeFileSync(own, "day,R_est,delta_est,era,exact,R_if_credit_not_counted\n" +
    "2026-09-15,49000,,store,0,49000\n2026-09-16,49500,,store,0,49500\n2026-09-17,49800,,store,0,49800\n");
  const out = join(root, "estimates.json");
  const run = (ownFile) => spawnSync(process.execPath, [new URL("./bin/hof-estimate-build.mjs", import.meta.url).pathname,
    "--replies", replies, "--factions", factions, "--own", ownFile, "--from", "2026-09-15", "--fit", AU, "--out", out],
  { env: { ...process.env, DATA_DIR: dataDir }, encoding: "utf8" });
  const r = run(own);
  assert.equal(r.status, 0, r.stderr);
  const f = JSON.parse(readFileSync(out, "utf8"));
  assert.equal(f.factions, 2, "us and 7");
  assert.equal(f.anchorDay, A0);
  assert.deepEqual(Object.keys(f.days), ["2026-09-15", "2026-09-16", "2026-09-17"]);
  assert.equal(f.days["2026-09-17"][42055], 49800, "our own series, as rebuilt");
  assert.equal(f.days["2026-09-17"][7], Math.round(100000 - 500 - 2400 / 34));
  assert.ok(!("8" in f.days["2026-09-17"]));
  assert.match(r.stdout, /8: left out: 1 war report\(s\) missing/);
  // A gap in our own series is refused: it would silently drop a window for a day.
  const gappy = join(root, "gappy.csv");
  writeFileSync(gappy, "day,R_est\n2026-09-15,49000\n2026-09-17,49800\n");
  const bad = run(gappy);
  assert.notEqual(bad.status, 0);
  assert.match(bad.stderr, /our own series has no 2026-09-16/);
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `cd /opt/warboard/server && node --test hof-estimate.test.mjs`
Expected: FAIL. The import throws `Cannot find module './hof-estimate.js'`, so the file reports 1 failure.

- [ ] **Step 3: Write `server/hof-estimate.js`**

```js
// The estimate behind /hof's 3-month, 6-month and 1-year paces. Warboard's own
// snapshots start on 2026-09-18, so until they reach that far back a
// faction's respect on a past day is rebuilt from Torn's public chain and
// ranked-war records. Pure: bin/hof-estimate-build.mjs loads the records and
// writes the file. Design, and how far off it can be:
// docs/superpowers/specs/2026-10-22-hof-long-pace-windows-design.md.
import { addDays, dayMs } from "./hof-climb.js";

export const ESTIMATES_VERSION = 1;
// Our own faction's records show war losses coming to about a quarter of the
// enemy's score.
export const LOSS_PER_ENEMY_SCORE = 0.25;
const DAY_S = 86400;
const PAGE = 100;

// The share of [start, end] inside [t0, t1). Something with no length counts
// whole if it starts inside.
export function overlap(start, end, t0, t1) {
  if (!(end > start)) return start >= t0 && start < t1 ? 1 : 0;
  return Math.max(0, Math.min(end, t1) - Math.max(start, t0)) / (end - start);
}

// What the public records show faction `id` gaining in [t0, t1), in seconds:
// each chain's respect by the share of its time inside, the reward of each
// ranked war that ended inside, less a quarter of the enemy's score in each
// war by the share of the war inside. A war still running counts to openEnd.
export function publicGain({ id, chains, wars, rewards, t0, t1, openEnd }) {
  let gain = 0;
  for (const c of chains) gain += c.respect * overlap(c.start, c.end, t0, t1);
  for (const w of wars) {
    const enemy = w.factions.find((f) => String(f.id) !== String(id));
    if (enemy) gain -= LOSS_PER_ENEMY_SCORE * enemy.score * overlap(w.start, w.end || openEnd, t0, t1);
    if (w.end && w.end >= t0 && w.end < t1) gain += rewards[w.id];
  }
  return gain;
}

// Everything the records miss (organised crimes, territory, attacks outside
// chains) as one daily rate: the saved days' exact gain less what the
// records show over the same days.
export function unseenRate({ r0, rU, gain, days }) {
  return (rU - r0 - gain) / days;
}

// Why a faction's records can't be trusted for the whole range, or null when
// they can. Chain pages run newest first, so the last must be short of a full
// page, reach back to fromS, or repeat only chains already seen. The war list
// must reach back too, and every war that ended between fromS and fitS needs
// its report.
export function missingRecords({ chainPages, warList, rewards, fromS, fitS }) {
  if (!chainPages.length) return "no chain pages";
  const last = chainPages[chainPages.length - 1];
  const seen = new Set(chainPages.slice(0, -1).flat().map((c) => c.id));
  if (!(last.length < PAGE || last.some((c) => c.start <= fromS) || last.every((c) => seen.has(c.id)))) {
    return "chain pages stop short";
  }
  if (!warList) return "no war list";
  if (warList.length >= PAGE && !warList.some((w) => w.end && w.end < fromS)) return "war list stops short";
  const missing = warList.filter((w) => w.end && w.end >= fromS && w.end < fitS && !(w.id in rewards)).length;
  return missing ? `${missing} war report(s) missing` : null;
}

// est(t) = r(A0) − public(t, A0) − u × days(t, A0) for every day from `from`
// to the day before anchorDay (A0), in whole respect. u is fitted on A0 to
// fitDay, so the series meets the saved days with no step. Null when a day
// comes out at 0 or below: the records can't explain this faction.
export function estimateSeries({ id, chains, wars, rewards, anchorDay, anchorRespect, fitDay, fitRespect, from }) {
  const A0 = dayMs(anchorDay) / 1000, AU = dayMs(fitDay) / 1000;
  const gain = (t0, t1) => publicGain({ id, chains, wars, rewards, t0, t1, openEnd: AU });
  const u = unseenRate({ r0: anchorRespect, rU: fitRespect, gain: gain(A0, AU), days: (AU - A0) / DAY_S });
  const days = {};
  for (let d = from; d < anchorDay; d = addDays(d, 1)) {
    const t = dayMs(d) / 1000;
    const r = Math.round(anchorRespect - gain(t, A0) - u * (A0 - t) / DAY_S);
    if (!(r > 0)) return null;
    days[d] = r;
  }
  return { u, days };
}

// The file the daily job reads: each estimated day maps faction id to
// respect, the shape of a day file's `respect`, oldest day first.
export function estimatesFile({ series, builtAt, anchorDay, fitDay, band }) {
  const days = {};
  for (const id of Object.keys(series)) for (const [d, r] of Object.entries(series[id])) (days[d] ||= {})[id] = r;
  return {
    version: ESTIMATES_VERSION, builtAt, anchorDay, fittedTo: fitDay, band, factions: Object.keys(series).length,
    days: Object.fromEntries(Object.keys(days).sort().map((d) => [d, days[d]])),
  };
}
```

- [ ] **Step 4: Write `server/bin/hof-estimate-build.mjs`**

```js
// Builds the estimate behind /hof's long paces, once, from a pull of Torn's
// public chain and ranked-war records. Design:
// docs/superpowers/specs/2026-10-22-hof-long-pace-windows-design.md.
//
//   node bin/hof-estimate-build.mjs --replies DIR --factions FILE --own CSV \
//     --from YYYY-MM-DD --fit YYYY-MM-DD --out FILE
//
// DIR holds Torn v2 replies named chains-<id>-p<n>.json, rankedwars-<id>.json
// and report-<warId>.json. FILE lists the factions ({ rule, factions: [{ id }] }).
// CSV is our own faction's series, rebuilt from its own records (day,R_est,...).
// The anchor is the oldest saved day file, and the fit runs to --fit. It
// reads the saved day files and writes only --out.
import { existsSync, readFileSync, readdirSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { addDays, dayMs } from "../hof-climb.js";
import { estimateSeries, estimatesFile, missingRecords } from "../hof-estimate.js";

const US = String(process.env.OWNER_FACTION_ID || "42055");
const args = Object.fromEntries(process.argv.slice(2).reduce((out, a, i, all) =>
  (a.startsWith("--") ? [...out, [a.slice(2), all[i + 1]]] : out), []));
for (const k of ["replies", "factions", "own", "from", "fit", "out"]) {
  if (!args[k]) { console.error(`missing --${k}`); process.exit(1); }
}
// The same folder the daily job uses (hof-snapshots.js), without importing it.
const hofDir = join(process.env.DATA_DIR || join(dirname(fileURLToPath(import.meta.url)), "..", "data"), "hof");
const readJson = (file) => JSON.parse(readFileSync(file, "utf8"));
const reply = (name) => (existsSync(join(args.replies, `${name}.json`)) ? readJson(join(args.replies, `${name}.json`)) : null);

const days = readdirSync(join(hofDir, "days")).filter((n) => /^\d{4}-\d{2}-\d{2}\.json$/.test(n)).map((n) => n.slice(0, 10)).sort();
const anchorDay = days[0];
const anchor = readJson(join(hofDir, "days", `${anchorDay}.json`)).respect;
const fit = readJson(join(hofDir, "days", `${args.fit}.json`)).respect;
const fromS = dayMs(args.from) / 1000, fitS = dayMs(args.fit) / 1000;

const list = readJson(args.factions);
const series = {};
for (const { id } of list.factions) {
  if (String(id) === US) continue;
  const chainPages = [];
  for (let p = 1, page; (page = reply(`chains-${id}-p${p}`)); p++) chainPages.push(page.chains || []);
  const wars = reply(`rankedwars-${id}`);
  const warList = wars ? wars.rankedwars || [] : null;
  const rewards = {};
  for (const w of warList || []) {
    const side = ((reply(`report-${w.id}`) || {}).rankedwarreport?.factions || []).find((f) => String(f.id) === String(id));
    if (side) rewards[w.id] = side.rewards.respect;
  }
  const why = missingRecords({ chainPages, warList, rewards, fromS, fitS });
  if (why) { console.log(`${id}: left out: ${why}`); continue; }
  if (!(anchor[id] > 0) || !(fit[id] > 0)) { console.log(`${id}: left out: not in the saved days`); continue; }
  const s = estimateSeries({ id, chains: chainPages.flat(), wars: warList, rewards, anchorDay, anchorRespect: anchor[id],
    fitDay: args.fit, fitRespect: fit[id], from: args.from });
  if (!s) { console.log(`${id}: left out: the records can't explain it (a day at 0 or below)`); continue; }
  series[id] = s.days;
  console.log(`${id}: u ${Math.round(s.u)}/day, ${chainPages.flat().length} chains, ${warList.length} wars, ` +
    `${anchorDay} back to ${args.from}: ${s.days[args.from]}`);
}

// Our own faction comes from its own records, which are far tighter. A gap
// would drop a window for that day without a word, so it is refused.
const own = {};
for (const line of readFileSync(args.own, "utf8").trim().split("\n").slice(1)) {
  const [d, r] = line.split(",");
  own[d] = Number(r);
}
series[US] = {};
for (let d = args.from; d < anchorDay; d = addDays(d, 1)) {
  if (!(own[d] > 0)) { console.error(`our own series has no ${d}`); process.exit(1); }
  series[US][d] = Math.round(own[d]);
}

const file = estimatesFile({ series, builtAt: Date.now(), anchorDay, fitDay: args.fit, band: list.rule });
const tmp = `${args.out}.tmp-${process.pid}`;
writeFileSync(tmp, JSON.stringify(file));
renameSync(tmp, args.out);
console.log(`wrote ${args.out}: ${file.factions} factions, ${Object.keys(file.days).length} days`);
```

- [ ] **Step 5: Run the tests to see them pass**

Run: `cd /opt/warboard/server && node --test hof-estimate.test.mjs`
Expected: `# tests 10`, `# pass 10`, `# fail 0`.

- [ ] **Step 6: Commit**

```bash
cd /opt/warboard && git add server/hof-estimate.js server/hof-estimate.test.mjs server/bin/hof-estimate-build.mjs && git commit -m "hof: estimate past respect from chain and war records, for the long paces

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Estimated windows in the digest

**Files:**
- Modify: `server/hof-climb.js`. Change `DIGEST_VERSION`, `WINDOWS` and `resolveWindows`, add `estimatedPacesFor`, and change `computeDigest`.
- Test: `server/hof-climb.test.mjs` (append)

**Interfaces:**
- Consumes: the estimates file shape from Task 1 (`days: { day: { id: respect } }`, `builtAt`).
- Produces:
  - `resolveWindows(days, latest, estimateDays = [])`;
  - `estimatedPacesFor(L, base, span)`;
  - `computeDigest({ ..., estimates = null })`. Its windows carry `estimated: true`, and the digest gains `estimatesBuiltAt`.
  - `DIGEST_VERSION = 2`.

- [ ] **Step 1: Write the failing tests** — append to `server/hof-climb.test.mjs`:

```js
// ── long windows, estimated until the saved days reach back ─────────────
test("the long windows' limits are 99, 201 and 402 days", () => {
  assert.deepEqual(climb.WINDOWS, [7, 30, 90, 182, 365]);
  assert.deepEqual([90, 182, 365].map(climb.windowLimit), [99, 201, 402]);
});

test("a long window is estimated, w days back, only while no saved day is close enough", () => {
  const saved = daysFrom("2026-09-18", "2026-10-22");
  const estimate = daysFrom("2025-10-08", "2026-09-17");
  assert.deepEqual(climb.resolveWindows(saved, "2026-10-22", estimate), {
    7: { base: "2026-10-15", span: 7 },
    30: { base: "2026-09-22", span: 30 },
    90: { base: "2026-07-24", span: 90, estimated: true },
    182: { base: "2026-04-23", span: 182, estimated: true },
    365: { base: "2025-10-22", span: 365, estimated: true },
  });
  // On 2026-12-17 a saved day sits exactly 90 days back, and 3 months turns exact.
  const later = daysFrom("2026-09-18", "2026-12-17");
  assert.deepEqual(climb.resolveWindows(later, "2026-12-16", estimate)[90], { base: "2026-09-17", span: 90, estimated: true });
  assert.deepEqual(climb.resolveWindows(later, "2026-12-17", estimate)[90], { base: "2026-09-18", span: 90 });
  assert.equal(climb.resolveWindows(saved, "2026-10-22")[90], undefined, "no estimate, no long window");
});

test("in an estimated window a faction the estimate doesn't hold gets no pace, even with saved days in the window", () => {
  const L = { respect: { 42055: 4000, 1: 3000, 2: 9000, 3: 500 }, hidden: [3] };
  const p = climb.estimatedPacesFor(L, { 42055: 400, 2: 1800, 3: 100 }, 360);
  assert.deepEqual(p, { 42055: 10, 2: 20 }, "1 isn't in the estimate; 3 is hidden");
});

// Us at 4,000; faction 1 far above and outside the estimate; 2 just above us
// and in it. Exact days hold the last 30; the estimate holds a year back.
function longWorld({ withUs = true } = {}) {
  const byDay = {};
  for (const d of daysFrom("2026-09-18", "2026-10-22")) {
    const n = climb.daysBetween("2026-09-18", d);
    byDay[d] = { respect: { 42055: 3000 + n * 30, 1: 1000000, 2: 4100 + n }, hidden: [] };
  }
  const days = {};
  for (const d of daysFrom("2025-10-08", "2026-09-17")) days[d] = withUs ? { 42055: 350, 2: 3769 } : { 2: 3769 };
  const history = Object.keys(byDay).map((d) => climb.historyEntry(d, byDay[d], 42055));
  return { byDay, history, names: {}, factionId: 42055, builtAt: 1, estimates: { version: 1, builtAt: 77, days } };
}

test("an estimated window shows only estimated paces, and projects with the 30-day paces underneath", () => {
  const dg = climb.computeDigest(longWorld());
  assert.deepEqual(dg.windows[365], { base: "2025-10-22", span: 365, estimated: true });
  assert.equal(dg.estimatesBuiltAt, 77);
  assert.equal(dg.paces[42055][365], Math.round((4020 - 350) / 365 * 100) / 100);
  assert.equal(dg.paces[2][365], 1);
  assert.equal(dg.paces[1][365], undefined, "1 isn't estimated, so the table shows no 1-year pace for it");
  assert.equal(dg.paces[1][30], 0);
  // 1 sits 996k above us and stands still at its 30-day pace: still ahead in a year.
  assert.equal(dg.projection[365][364], 2, "1 counted ahead; 2 passed");
});

test("no estimated window without an exact one under it, or without us in the estimate", () => {
  assert.equal(climb.computeDigest(longWorld({ withUs: false })).windows[365], undefined);
  const w = longWorld();
  for (const d of Object.keys(w.byDay)) if (d !== "2026-10-22") delete w.byDay[d];
  w.history = [climb.historyEntry("2026-10-22", w.byDay["2026-10-22"], 42055)];
  assert.deepEqual(climb.computeDigest(w).windows, {});
});

test("without an estimate the digest says so, and the short windows are as before", () => {
  const w = longWorld();
  const dg = climb.computeDigest({ ...w, estimates: null });
  assert.equal(dg.estimatesBuiltAt, null);
  assert.deepEqual(Object.keys(dg.windows), ["7", "30"]);
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `cd /opt/warboard/server && node --test hof-climb.test.mjs`
Expected: 6 new failures, and the existing tests still pass. The failures:
- `WINDOWS` is `[7, 30, 90]`;
- `resolveWindows` ignores the estimate, so there is no 90;
- `estimatedPacesFor is not a function`;
- `estimatesBuiltAt` is undefined, three times.

- [ ] **Step 3: Implement in `server/hof-climb.js`**

(a) Replace the two constants:

```js
export const DIGEST_VERSION = 2;
export const WINDOWS = [7, 30, 90, 182, 365];
```

(b) Replace `resolveWindows` and the comment above it:

```js
// A window is offered only when a saved day sits close to L − w; further back,
// "7 days" would really be measuring a longer stretch. A long window with no
// such day is estimated instead when the estimate holds L − w itself, so its
// base is exactly w days back (estimateDays: the days it holds us on).
export function resolveWindows(days, latest, estimateDays = []) {
  const out = {}, estimated = new Set(estimateDays);
  for (const w of WINDOWS) {
    const target = addDays(latest, -w);
    let base = null;
    for (const d of days) if (d <= target) base = d;
    if (base !== null && daysBetween(base, latest) <= windowLimit(w)) out[w] = { base, span: daysBetween(base, latest) };
    else if (estimated.has(target)) out[w] = { base: target, span: w, estimated: true };
  }
  return out;
}
```

(c) Add directly under `pacesFor`:

```js
// An estimated window's paces, from the estimate at the base to L. A faction
// the estimate doesn't hold gets none: falling back to its first saved day,
// as pacesFor does, would show a month's gain as a year's pace.
export function estimatedPacesFor(L, base, span) {
  const hide = new Set((L.hidden || []).map(String)), out = {};
  for (const id in L.respect) if (!hide.has(id) && base[id] > 0) out[id] = (L.respect[id] - base[id]) / span;
  return out;
}
```

(d) Replace the comment above `computeDigest` and the function itself:

```js
// byDay: the recent saved days (at least the last 402, which covers the 1-year
// window's limit); history: one historyEntry per saved day, oldest first;
// names: id -> name at the latest day; estimates: the estimates file
// (hof-estimate.js), or null.
export function computeDigest({ byDay, history, names, factionId, builtAt, estimates = null }) {
  const days = Object.keys(byDay).sort();
  const latest = days[days.length - 1], L = byDay[latest], us = String(factionId);
  const estimateDays = estimates ? Object.keys(estimates.days).filter((d) => estimates.days[d][us] > 0) : [];
  const windows = resolveWindows(days, latest, estimateDays);
  const positionAt = Object.fromEntries(history.map((h) => [h.day, h.position]));
  const raw = {};
  for (const w of Object.keys(windows)) if (!windows[w].estimated) raw[w] = pacesFor(byDay, latest, windows[w]);
  // An estimated window holds only the factions near us, so its projection
  // and note lay its paces over the longest exact window's, and every other
  // faction still counts. With no exact window there is nothing to lay it on.
  const exact = Object.keys(raw).map(Number);
  const under = exact.length ? Math.max(...exact) : null;
  for (const w of Object.keys(windows)) {
    if (!windows[w].estimated) continue;
    if (under === null) delete windows[w];
    else raw[w] = estimatedPacesFor(L, estimates.days[windows[w].base], windows[w].span);
  }
  const paces = {}, projection = {}, notes = {};
  for (const w of Object.keys(windows)) {
    const p = raw[w], all = windows[w].estimated ? { ...raw[under], ...p } : p;
    for (const id in p) (paces[id] ||= {})[w] = Math.round(p[id] * 100) / 100;
    projection[w] = projectPositions(L.respect, all, us);
    notes[w] = windows[30] && projection[w]
      ? crowdingNote({
          latestRespect: L.respect, hidden: L.hidden, paces: all, us,
          basePosition: positionAt[windows[30].base] ?? null,
          position: positionAt[latest] ?? null,
          projected30: projection[w][29],
        })
      : null;
  }
  return {
    version: DIGEST_VERSION, factionId: Number(factionId), day: latest, builtAt,
    windows, paces, history, projection, notes, midnight: midnightTable(L, names, us),
    estimatesBuiltAt: estimates ? estimates.builtAt : null,
  };
}
```

- [ ] **Step 4: Run the tests to see them pass**

Run: `cd /opt/warboard/server && node --test hof-climb.test.mjs`
Expected: `# fail 0`, with 6 more tests than before.

- [ ] **Step 5: Commit**

```bash
cd /opt/warboard && git add server/hof-climb.js server/hof-climb.test.mjs && git commit -m "hof: 3-month, 6-month and 1-year windows, estimated until the saved days reach back

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: The daily job reads the estimate

**Files:**
- Modify: `server/hof-snapshots.js`. Change `KEEP_DAYS`, add `readEstimates`, and change `digestStale` and `buildIn`.
- Test: `server/hof-snapshots.test.mjs` (append)

**Interfaces:**
- Consumes: `computeDigest({ ..., estimates })` and `digest.estimatesBuiltAt` from Task 2, and the file shape from Task 1.
- Produces: `estimates.json` in the hof data dir is read on every digest build.

- [ ] **Step 1: Write the failing tests** — append to `server/hof-snapshots.test.mjs`:

```js
// ── the long windows' estimate ──────────────────────────────────────────
const { addDays } = await import("./hof-climb.js");
// Saved days up to 2026-10-19 with us gaining 30 a day, and an estimate file.
function longSetup(first = "2026-09-05") {
  const opts = setup(fakeTorn());
  mkdirSync(join(opts.dataDir, "days"), { recursive: true });
  for (let d = first, n = 0; d <= "2026-10-19"; d = addDays(d, 1), n++) {
    writeFileSync(join(opts.dataDir, "days", `${d}.json`),
      JSON.stringify({ day: d, respect: { [US]: 3000 + n * 30, 1001: 9000 }, hidden: [] }));
  }
  return opts;
}
const estimateFile = (builtAt, ours = 500) => {
  const days = {};
  for (let d = "2025-10-08"; d < "2026-09-05"; d = addDays(d, 1)) days[d] = { [US]: ours, 1001: 8000 };
  return JSON.stringify({ version: 1, builtAt, anchorDay: "2026-09-05", fittedTo: "2026-10-19", band: "test", factions: 2, days });
};
const digestOf = (opts) => JSON.parse(readFileSync(join(opts.dataDir, "digest.json"), "utf8"));

test("the digest takes the estimate in, and is rebuilt when estimates.json appears, changes or goes", async () => {
  const opts = longSetup();
  const file = join(opts.dataDir, "estimates.json");
  await runOnce(opts);
  assert.deepEqual(Object.keys(digestOf(opts).windows), ["7", "30"]);
  writeFileSync(file, estimateFile(111));
  await runOnce(opts);
  assert.deepEqual(digestOf(opts).windows[365], { base: "2025-10-19", span: 365, estimated: true });
  assert.equal(digestOf(opts).estimatesBuiltAt, 111);
  writeFileSync(file, estimateFile(222, 600));
  await runOnce(opts);
  assert.equal(digestOf(opts).estimatesBuiltAt, 222);
  assert.equal(digestOf(opts).paces[US][365], Math.round((4320 - 600) / 365 * 100) / 100);
  unlinkSync(file);
  await runOnce(opts);
  assert.equal(digestOf(opts).estimatesBuiltAt, null);
  assert.deepEqual(Object.keys(digestOf(opts).windows), ["7", "30"]);
});

test("a broken estimates.json is left out with a warning and never forces a rebuild", async () => {
  const opts = longSetup();
  await runOnce(opts);
  const built = digestOf(opts).builtAt;
  writeFileSync(join(opts.dataDir, "estimates.json"), "{not json");
  const warned = [], warn = console.warn;
  console.warn = (m) => warned.push(String(m));
  try { clock.now += 1000; await runOnce(opts); } finally { console.warn = warn; }
  assert.equal(digestOf(opts).builtAt, built, "not rebuilt");
  assert.ok(warned.some((m) => /estimates\.json/.test(m)));
});

test("a saved day 402 days back still counts, for the 1-year window", async () => {
  const opts = longSetup("2026-09-18");
  writeFileSync(join(opts.dataDir, "days", "2025-09-12.json"),
    JSON.stringify({ day: "2025-09-12", respect: { [US]: 100, 1001: 9000 }, hidden: [] }));
  await runOnce(opts);
  assert.deepEqual(digestOf(opts).windows[365], { base: "2025-09-12", span: 402 });
});
```

Also add `unlinkSync` to this file's `node:fs` import.

- [ ] **Step 2: Run them to see them fail**

Run: `cd /opt/warboard/server && node --test hof-snapshots.test.mjs`
Expected: 3 failures; the existing tests still pass.
- The first fails because the estimate is never read, so `windows[365]` is undefined.
- The second fails because no warning is logged.
- The third fails because `KEEP_DAYS` is 100, so `windows[365]` is undefined.

- [ ] **Step 3: Implement in `server/hof-snapshots.js`**

(a) Change the `KEEP_DAYS` line:

```js
const KEEP_DAYS = 402;               // the 1-year window's limit (365 + 37)
```

(b) Add under `const attemptsPath = ...`:

```js
const estimatesPath = (ctx) => join(ctx.dir, "estimates.json");
```

(c) Add directly above `function digestStale(ctx)`:

```js
// The long windows' estimate (hof-estimate.js), or null. A file that won't
// parse or has the wrong shape is left out with a warning: a bad file can
// only take the estimated windows away.
function readEstimates(ctx) {
  if (!existsSync(estimatesPath(ctx))) return null;
  const e = readJson(estimatesPath(ctx));
  if (e && e.version === 1 && Number.isFinite(e.builtAt) && e.days && typeof e.days === "object") return e;
  console.warn("[hof] estimates.json is unreadable or the wrong shape; the long windows use saved days only");
  return null;
}
```

(d) Replace `digestStale` with:

```js
// Stale on a new day, a new digest version, or an estimate that appeared,
// changed or went since the digest was built.
function digestStale(ctx) {
  const days = savedDaysIn(ctx);
  if (!days.length) return false;
  const d = readJson(digestPath(ctx)), e = readEstimates(ctx);
  return !d || d.version !== DIGEST_VERSION || d.day < days[days.length - 1] ||
    (d.estimatesBuiltAt ?? null) !== (e ? e.builtAt : null);
}
```

(e) In `buildIn`, pass the estimate to `computeDigest`:

```js
  const digest = computeDigest({
    byDay, history, names: facts ? facts.names : {}, factionId: ctx.factionId, builtAt: ctx.nowFn(),
    estimates: readEstimates(ctx),
  });
```

- [ ] **Step 4: Run the tests to see them pass**

Run: `cd /opt/warboard/server && node --test hof-snapshots.test.mjs hof-climb.test.mjs`
Expected: `# fail 0`.

- [ ] **Step 5: Commit**

```bash
cd /opt/warboard && git add server/hof-snapshots.js server/hof-snapshots.test.mjs && git commit -m "hof: the nightly digest reads the long windows' estimate, and keeps 402 days

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: The API flags estimated windows

**Files:**
- Modify: `server/hof-api.js` (`view`)
- Test: `server/hof-route.test.mjs` (append)

**Interfaces:**
- Consumes: `digest.windows[w].estimated` (Task 2).
- Produces: `estimated: { [w]: boolean }` in `/api/hof`.

- [ ] **Step 1: Write the failing test** — append to `server/hof-route.test.mjs`:

```js
test("estimated windows are flagged, and a row the estimate doesn't hold has no pace or days", async () => {
  const root = mkdtempSync(join(tmpdir(), "hof-api-"));
  const d = writeDigest(root);
  d.windows[365] = { base: "2025-10-19", span: 365, estimated: true };
  for (const id of Object.keys(d.paces)) d.paces[id][365] = 40;
  delete d.paces[hofList(250)[248].id][365];   // #249 has no estimate
  d.projection[365] = Array(365).fill(240);
  d.notes[365] = null;
  writeFileSync(join(root, "hof", "digest.json"), JSON.stringify(d));
  const api = createHofApi({ dataDir: join(root, "hof"), fetchImpl: fakeHof(250).fetchImpl, nowFn: () => T0, key: KEY, factionId: US });
  const { body } = await get(api);
  assert.deepEqual(body.windows, [7, 30, 365]);
  assert.deepEqual(body.estimated, { 7: false, 30: false, 365: true });
  const above = body.rows[19];
  assert.equal(above.position, 249);
  assert.deepEqual([above.pace[365], above.days[365]], [null, null]);
  assert.equal(body.rows[18].pace[365], 40);
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `cd /opt/warboard/server && node --test hof-route.test.mjs`
Expected: 1 failure, `body.estimated` undefined.

- [ ] **Step 3: Implement** — in `server/hof-api.js` `view()`, add under `windows,` in the returned object:

```js
      // Which windows' paces are estimated (hof-estimate.js) rather than exact.
      estimated: Object.fromEntries(windows.map((w) => [w, Boolean(d.windows[w] && d.windows[w].estimated)])),
```

- [ ] **Step 4: Run it to see it pass**

Run: `cd /opt/warboard/server && node --test hof-route.test.mjs`
Expected: `# fail 0`.

- [ ] **Step 5: Commit**

```bash
cd /opt/warboard && git add server/hof-api.js server/hof-route.test.mjs && git commit -m "hof: the API says which windows are estimated

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: The page labels the long windows

**Files:**
- Modify: `server/pages/hof.html`:
  - constants: `SWITCH_ORDER`, plus new `WINDOW_LABELS` and `AVERAGE_LABELS`;
  - new functions `isEstimated` and `estNoteHtml`;
  - changed `headerHtml`, `switchHtml`, `tableHtml` and `render`;
  - a new `<p id="estnote">`;
  - CSS for narrow screens.
- Test: `server/hof-page.test.mjs`. Add `"isEstimated"` and `"estNoteHtml"` to `NAMES`, and append tests.

**Interfaces:**
- Consumes: `data.estimated` (Task 4).

- [ ] **Step 1: Write the failing tests**

In `server/hof-page.test.mjs`, add `"isEstimated", "estNoteHtml"` to the end of the `NAMES` array. Then append:

```js
// ── long windows ────────────────────────────────────────────────────────
const LONG = {
  ...DATA, windows: [7, 30, 90, 182, 365], estimated: { 7: false, 30: false, 90: true, 182: true, 365: true },
  us: { ...DATA.us, pace: { 7: 110, 30: 100, 90: 90, 182: 80, 365: 4583.2 } },
};

test("the switch reads 30 days, 7 days, 3 months, 6 months, 1 year, and stars the estimated ones", () => {
  const html = page().switchHtml(LONG, 30);
  assert.deepEqual([...html.matchAll(/>([^<]+)<\/button>/g)].map((m) => m[1]),
    ["30 days", "7 days", "3 months*", "6 months*", "1 year*"]);
  assert.match(page().switchHtml({ ...LONG, estimated: { ...LONG.estimated, 90: false } }, 90), /class="on" aria-pressed="true">3 months</);
});

test("the header names the window and says when it is estimated", () => {
  const P = page();
  assert.match(P.headerHtml(LONG, 365, UPDATED + 60000), /32\.1k a week \(1-year average, estimated\*\)/);
  assert.match(P.headerHtml({ ...LONG, estimated: { ...LONG.estimated, 90: false } }, 90, UPDATED + 60000), /630 a week \(3-month average\)/);
  assert.match(P.headerHtml(LONG, 30, UPDATED + 60000), /700 a week \(30-day average\)/);
});

test("the pace heading is starred in an estimated window", () => {
  assert.match(page().tableHtml(LONG, 182), /<th>Pace \/week\*<\/th>/);
  assert.match(page().tableHtml(LONG, 30), /<th>Pace \/week<\/th>/);
});

test("the estimate note shows only in an estimated window, and names the pace the rest keep", () => {
  const P = page();
  assert.equal(P.estNoteHtml(LONG, 30), "");
  assert.match(P.estNoteHtml(LONG, 365), /^\* Estimated\. /);
  assert.match(P.estNoteHtml(LONG, 365), /keep their 30-day pace/);
  assert.match(P.estNoteHtml({ ...LONG, estimated: { ...LONG.estimated, 90: false } }, 365), /keep their 3-month pace/);
  assert.equal(P.estNoteHtml(DATA, 30), "", "an answer from before the long windows");
});

test("render fills the estimate note", () => {
  const els = {};
  const P = page({ document: { getElementById: (id) => (els[id] ||= { innerHTML: "" }) } });
  P.STATE.data = LONG;
  P.STATE.w = 182;
  P.render();
  assert.match(els.estnote.innerHTML, /^\* Estimated\. /);
  P.STATE.w = 7;
  P.render();
  assert.equal(els.estnote.innerHTML, "");
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `cd /opt/warboard/server && node --test hof-page.test.mjs`
Expected: FAIL with `not in hof.html: isEstimated` in every test that calls `page()`.

- [ ] **Step 3: Implement in `server/pages/hof.html`**

(a) Replace `var SWITCH_ORDER = [30, 7, 90];` with:

```js
var SWITCH_ORDER = [30, 7, 90, 182, 365];
var WINDOW_LABELS = { 7: '7 days', 30: '30 days', 90: '3 months', 182: '6 months', 365: '1 year' };
var AVERAGE_LABELS = { 7: '7-day', 30: '30-day', 90: '3-month', 182: '6-month', 365: '1-year' };
```

(b) Add directly above `function headerHtml`:

```js
// The long windows are estimated until warboard's saved days reach back that
// far; the API says which.
function isEstimated(data, w) {
  return Boolean(data.estimated && data.estimated[w]);
}

// Shown under the footer only while the selected window is estimated. The
// factions outside the estimate keep the longest exact window's pace in the
// projection, which the note names.
function estNoteHtml(data, w) {
  if (!isEstimated(data, w)) return '';
  var under = data.windows.filter(function (x) { return !isEstimated(data, x); });
  var label = under.length ? AVERAGE_LABELS[Math.max.apply(null, under)] : '30-day';
  return '* Estimated. Warboard\'s own copies of Torn\'s daily data start on 18 Sep 2026, so until it has one from ' +
    '3 months back (17 Dec), 6 months back (19 Mar 2027) or a year back (18 Sep 2027), that window starts from each ' +
    'faction\'s respect rebuilt from Torn\'s public chain and ranked-war reports. Checked against an outside weekly ' +
    'record for 11 factions near us, a typical pace was within about 4% (3 months), 5% (6 months) and 8% (1 year), ' +
    'though a few were a third out. Only the 168 factions within reach of us are estimated; in the projection the ' +
    'rest keep their ' + label + ' pace.';
}
```

(c) In `headerHtml`, replace

```js
    esc(fmtWeek(data.us.pace ? data.us.pace[w] : null)) + ' a week (' + w + '-day average)</div></div>' +
```

with

```js
    esc(fmtWeek(data.us.pace ? data.us.pace[w] : null)) + ' a week (' + AVERAGE_LABELS[w] + ' average' +
    (isEstimated(data, w) ? ', estimated*' : '') + ')</div></div>' +
```

(d) In `switchHtml`, replace `'>' + x + ' days</button>';` with

```js
      '>' + WINDOW_LABELS[x] + (isEstimated(data, x) ? '*' : '') + '</button>';
```

(e) In `tableHtml`, replace `'<th>Pace /week</th>'` with `'<th>Pace /week' + (isEstimated(data, w) ? '*' : '') + '</th>'`.

(f) In `render`, add under the `note` line:

```js
  document.getElementById('estnote').innerHTML = estNoteHtml(d, w);
```

(g) Under the "How this works" `<p class="foot">…</p>`, add:

```html
  <p id="estnote" class="foot"></p>
```

(h) In the CSS, under `.seg button.on{…}`, add:

```css
.foot:empty{display:none}
/* Five windows on a 360 px phone: tighter buttons keep them on one line. */
@media (max-width:420px){.seg button{padding:7px 8px;font-size:12.5px}}
```

- [ ] **Step 4: Run the tests to see them pass**

Run: `cd /opt/warboard/server && node --test hof-page.test.mjs`
Expected: `# fail 0`.

- [ ] **Step 5: Commit**

```bash
cd /opt/warboard && git add server/pages/hof.html server/hof-page.test.mjs && git commit -m "hof: 3 months, 6 months and 1 year on the page, starred while estimated

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Build the real file, check it, ship

**Files:**
- No code changes. The output goes to `server/data/hof/estimates.json`, which is not tracked.

- [ ] **Step 1: Check the pull is complete**

Run:
```bash
cd /root/hof-history-pull && tail -3 pull.log; grep -c "stopping at 30 pages" pull.log; ls dl/*.error.json 2>/dev/null | wc -l
```
Expected: the "reports done" and "done" lines, 0 pages stopped, and 0 error files. On any error file, run `node pull.mjs all` again; cached replies cost no calls.

- [ ] **Step 2: Build into staging**

Run:
```bash
cd /opt/warboard/server && node bin/hof-estimate-build.mjs --replies /root/hof-history-pull/dl --factions /root/hof-history-pull/factions.json --own /root/hof-history-pull/inputs/own-respect-daily.csv --from 2025-10-08 --fit 2026-10-22 --out /root/hof-history-pull/estimates.json | tee /root/hof-history-pull/build.log | tail -5
```
Expected: about 169 factions and 345 days. Every "left out" line is listed in the report.

- [ ] **Step 3: Check the real data (outside the repo)**

`/root/hof-history-pull/check-built.py` checks three things:
- (a) for every faction, est(09-17) is within one plausible day of r(09-18);
- (b) our own 1-year pace is about 4.6k a day;
- (c) the TornStats comparison, with the earlier figures replaced by this file's.

Expected: (a) no faction has a 09-17 → 09-18 step larger than its biggest real day in the saved days; (b) holds; (c) the median errors are no worse than 3.6% / 5.2% / 8.1%. Put the new figures in the page note and the spec.

- [ ] **Step 4: Install and deploy**

Run:
```bash
cp /root/hof-history-pull/estimates.json /opt/warboard/server/data/hof/estimates.json && chown warboard:warboard /opt/warboard/server/data/hof/estimates.json && chmod 644 /opt/warboard/server/data/hof/estimates.json && cd /opt/warboard/server && ./deploy.sh
```
Expected: the tests pass, the reload succeeds and `deploy ok` is printed.

- [ ] **Step 5: Verify live** (after the boot catch-up, about 70 s)

Run:
```bash
curl -s 127.0.0.1:3000/api/hof | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['windows'], d['estimated'], {w: round(d['us']['pace'][str(w)]*7) for w in d['windows']})"; pm2 logs warboard --lines 200 --nostream | grep "\[hof\]" | tail -3
```
Expected: `[7, 30, 90, 182, 365]`, with `estimated` true for 90, 182 and 365. Our weekly paces should be about 46k (30 days) and 32k (1 year). Then screenshot `/hof` at 360 px and desktop, in light and dark.

- [ ] **Step 6: Push**

```bash
cd /opt/warboard && git push origin main 2>&1 | sed -E 's#//[^@]*@#//***@#g'
```
