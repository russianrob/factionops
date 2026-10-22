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

// A folder of replies, the saved days and our own series, as the pull and the
// daily job leave them; run(ownFile) builds the file from them into `out`.
function buildFixture() {
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
  return { root, put, own, out, run };
}

test("the build script writes the file from a folder of replies, and says what it left out", () => {
  const { root, own, out, run } = buildFixture();
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

test("a chain repeated where two pages meet counts once", () => {
  // The pull asks for each page up to the oldest start on the page before,
  // and Torn includes that chain again at the top of the next page.
  const { put, own, out, run } = buildFixture();
  put("chains-7-p2", { chains: [FACTION.chains[1]] });
  const r = run(own);
  assert.equal(r.status, 0, r.stderr);
  const f = JSON.parse(readFileSync(out, "utf8"));
  assert.equal(f.days["2026-09-17"][7], Math.round(100000 - 500 - 2400 / 34));
  assert.match(r.stdout, /^7: u \d+\/day, 2 chains,/m);
});
