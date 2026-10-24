// The blood-bag collector against a fake Torn, a fake clock and a temporary
// folder. The fake serves news the way Torn does, checked live on 2026-10-24:
// newest first, 100 a page, `from` includes its own second and `to` leaves its
// own second out. Spec: docs/superpowers/specs/2026-10-24-faction-blood-bag-board-design.md
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// No blood-bags module may ever touch the live data folder from a test.
process.env.DATA_DIR = mkdtempSync(join(tmpdir(), "blood-bags-test-"));
const { createBloodBagCollector, GAP_MS, WAR_GAP_MS, HEAD_MAX_PAGES } = await import("./blood-bags.js");

const T0 = 1792800000;                      // now, in seconds: 2026-10-24 00:00 UTC
const DAY = 86400;
const CUTOFF = Math.floor(T0 / DAY) * DAY - 365 * DAY;
const who = (id, name) => `<a href = "http://www.torn.com/profiles.php?XID=${id}">${name}</a>`;
const FILL = (id) => `${who(id, "P" + id)} filled one of the faction's Empty Blood Bags to create a Blood Bag : O+`;
const USE = (id) => `${who(id, "P" + id)} used one of the faction's Blood Bag : A- items`;
const XANAX = (id) => `${who(id, "P" + id)} used one of the faction's Xanax items`;

let lastId = 5000000;
const entry = (timestamp, text) => ({ id: String(++lastId), timestamp, text });
// n action lines, one every `step` seconds going back from `newest`; every
// other one is a blood bag.
function actions(n, newest, step = 600) {
  return Array.from({ length: n }, (_, i) => entry(newest - i * step, i % 2 ? XANAX(i) : (i % 4 ? USE(i) : FILL(i))));
}

const reply = (body, status = 200) => ({ ok: status >= 200 && status < 300, status, text: async () => JSON.stringify(body) });
function fakeTorn({ action = [], deposit = [], wars = [] } = {}) {
  const t = { news: { armoryAction: action, armoryDeposit: deposit }, wars, calls: [], fail: null };
  t.fetchImpl = async (url, init) => {
    const u = new URL(url);
    const call = { url: u, auth: init && init.headers && init.headers.Authorization, at: t.clock ? t.clock.now : 0 };
    t.calls.push(call);
    const failed = t.fail && t.fail(u, t.calls.length);
    if (failed) return failed;
    if (u.pathname === "/v2/faction/news") {
      const q = u.searchParams;
      const from = q.has("from") ? Number(q.get("from")) : -Infinity;
      const to = q.has("to") ? Number(q.get("to")) : Infinity;
      const news = t.news[q.get("cat")]
        .filter((e) => e.timestamp >= from && e.timestamp < to)
        .sort((a, b) => b.timestamp - a.timestamp || Number(b.id) - Number(a.id))
        .slice(0, Number(q.get("limit")));
      return reply({ news, _metadata: { links: { prev: null, next: null } } });
    }
    if (u.pathname === "/v2/faction/42055/rankedwars") return reply({ rankedwars: t.wars });
    return reply({ error: { code: 0, error: "Unknown path" } });
  };
  return t;
}
const newsCalls = (t, cat) => t.calls.filter((c) => c.url.pathname === "/v2/faction/news" && (!cat || c.url.searchParams.get("cat") === cat));

function setup({ torn = fakeTorn(), key = "test-key-bb", dataDir } = {}) {
  const clock = { now: T0 * 1000, slept: [] };
  torn.clock = clock;
  const logs = [];
  const dir = dataDir || mkdtempSync(join(tmpdir(), "blood-bags-"));
  const make = () => createBloodBagCollector({
    dataDir: dir, fetchImpl: torn.fetchImpl, nowFn: () => clock.now,
    sleepFn: async (ms) => { clock.slept.push(ms); clock.now += ms; },
    keyFn: () => key, log: (m) => logs.push(m),
  });
  return { c: make(), make, torn, clock, logs, dir };
}

// ── the poll ────────────────────────────────────────────────────────────────
test("the first poll takes one page of each category and leaves the year below to the backfill", async () => {
  const torn = fakeTorn({
    action: actions(250, T0 - 60),
    deposit: [
      entry(T0 - 3600, `${who(7, "P7")} deposited 6x Blood Bag : O+`),
      entry(T0 - 7200, `${who(8, "P8")} deposited 40x Empty Blood Bag`),
      entry(T0 - 9000, `${who(9, "P9")} deposited 1 x Blood Bag : Irradiated`),
    ],
  });
  const { c, clock } = setup({ torn });
  assert.equal(await c.pollOnce(), true);

  const calls = newsCalls(torn);
  assert.equal(calls.length, 2);
  for (const call of calls) {
    const q = call.url.searchParams;
    assert.deepEqual([q.get("limit"), q.get("sort"), q.get("stripTags"), q.get("comment")], ["100", "DESC", "false", "wb-bloodbags"]);
    assert.equal(q.has("from") || q.has("to") || q.has("key"), false);
    assert.equal(call.auth, "ApiKey test-key-bb");
  }

  const snap = c.snapshot();
  assert.equal(snap.lines.length, 50 + 1, "the blood lines among the newest 100 actions, and one deposit");
  assert.equal(snap.lastPollAt, clock.now);
  const oldestOnPage = T0 - 60 - 99 * 600;
  assert.deepEqual(snap.cats.armoryAction, { headTs: T0 - 60, gaps: [{ from: CUTOFF, to: oldestOnPage + 1 }] });
  assert.deepEqual(snap.cats.armoryDeposit, { headTs: T0 - 3600, gaps: [] });
  assert.equal(snap.reachSec, oldestOnPage + 1);
  assert.equal(snap.backfillDone, false);
});

test("the next poll asks only from the newest second it has, and stops there", async () => {
  const torn = fakeTorn({ action: actions(120, T0 - 3600), deposit: [] });
  const { c } = setup({ torn });
  await c.pollOnce();
  torn.news.armoryAction.push(entry(T0 - 10, FILL(1)), entry(T0 - 20, USE(2)), entry(T0 - 30, XANAX(3)));
  const before = c.snapshot().lines.length;
  torn.calls.length = 0;
  await c.pollOnce();
  const calls = newsCalls(torn, "armoryAction");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url.searchParams.get("from"), String(T0 - 3600));
  assert.equal(c.snapshot().lines.length, before + 2);
  assert.equal(c.snapshot().cats.armoryAction.headTs, T0 - 10);
});

test("a page edge inside one second loses nothing and repeats nothing", async () => {
  const torn = fakeTorn({ action: [entry(T0 - 9000, FILL(1))], deposit: [] });
  const { c } = setup({ torn });
  await c.pollOnce();
  // 98 newer lines, then 5 fills sharing one second: the first page ends on two of them.
  const S = T0 - 5000;
  const fresh = [...actions(98, T0 - 10, 30), ...Array.from({ length: 5 }, (_, i) => entry(S, FILL(100 + i)))];
  torn.news.armoryAction.push(...fresh);
  torn.calls.length = 0;
  await c.pollOnce();
  const calls = newsCalls(torn, "armoryAction");
  assert.equal(calls.length, 2);
  assert.equal(calls[1].url.searchParams.get("to"), String(S + 1), "the next page keeps the rest of that second");
  const ids = c.snapshot().lines.map((l) => l.playerId).filter((p) => Number(p) >= 100);
  assert.deepEqual(ids.sort(), ["100", "101", "102", "103", "104"]);
});

test("a full page inside one second steps past that second and says so", async () => {
  const torn = fakeTorn({ action: [entry(T0 - 9000, FILL(1))], deposit: [] });
  const { c, logs } = setup({ torn });
  await c.pollOnce();
  const S = T0 - 100;
  torn.news.armoryAction.push(...Array.from({ length: 150 }, (_, i) => entry(S, FILL(200 + i))));
  torn.calls.length = 0;
  assert.equal(await c.pollOnce(), true);
  assert.equal(newsCalls(torn, "armoryAction").length, 3);
  assert.equal(newsCalls(torn, "armoryAction")[2].url.searchParams.get("to"), String(S));
  assert.equal(c.snapshot().lines.length, 1 + 100);
  assert.ok(logs.some((m) => m.includes(`a full page at second ${S}`)), logs.join("\n"));
});

test("a long outage: the poll stops after ten pages and hands the rest to the backfill", async () => {
  const torn = fakeTorn({ action: [entry(T0 - 30 * DAY, FILL(1))], deposit: [] });
  const { c, logs } = setup({ torn });
  await c.pollOnce();
  torn.news.armoryAction.push(...actions(1500, T0 - 60, 60));
  torn.calls.length = 0;
  await c.pollOnce();
  assert.equal(newsCalls(torn, "armoryAction").length, HEAD_MAX_PAGES);
  const cat = c.snapshot().cats.armoryAction;
  assert.equal(cat.headTs, T0 - 60);
  // Each page after the first repeats the oldest second of the one before (that
  // is what keeps lines sharing a second), so ten pages reach the 991st new
  // line, and the gap starts just above it.
  assert.deepEqual(cat.gaps, [{ from: T0 - 30 * DAY, to: T0 - 60 - 990 * 60 + 1 }]);
  assert.ok(logs.some((m) => m.includes("stopped after 10 pages")));
});

test("Torn's error in a 200 reply keeps the data, is logged, and leaves the update time alone", async () => {
  const torn = fakeTorn({ action: actions(10, T0 - 60), deposit: [] });
  const { c, clock, logs } = setup({ torn });
  await c.pollOnce();
  const { lastPollAt, lines } = c.snapshot();
  torn.fail = () => reply({ error: { code: 5, error: "Too many requests" } });
  clock.now += 3600 * 1000;
  assert.equal(await c.pollOnce(), false);
  assert.equal(c.snapshot().lastPollAt, lastPollAt);
  assert.equal(c.snapshot().lines.length, lines.length);
  assert.ok(logs.some((m) => m.includes("Too many requests (code 5)")));
});

test("with no key on file the poll makes no call and says so once", async () => {
  const { c, torn, logs } = setup({ key: null });
  assert.equal(await c.pollOnce(), false);
  assert.equal(await c.pollOnce(), false);
  assert.equal(torn.calls.length, 0);
  assert.equal(logs.filter((m) => m.includes("no faction key")).length, 1);
});

test("lines older than the year are not kept", async () => {
  const torn = fakeTorn({ action: [], deposit: [
    entry(T0 - 10 * DAY, `${who(7, "P7")} deposited 2x Blood Bag : O+`),
    entry(T0 - 400 * DAY, `${who(7, "P7")} deposited 9x Blood Bag : O+`),
  ] });
  const { c } = setup({ torn });
  await c.pollOnce();
  assert.deepEqual(c.snapshot().lines.map((l) => l.qty), [2]);
});

test("a blood line in a wording the reader has not met is logged once", async () => {
  const odd = `${who(5, "P5")} donated 2x Blood Bag : O+ to the hospital`;
  const torn = fakeTorn({ action: [entry(T0 - 60, odd), entry(T0 - 120, FILL(6))], deposit: [] });
  const { c, logs } = setup({ torn });
  await c.pollOnce();
  await c.pollOnce();
  assert.equal(logs.filter((m) => m.includes("donated 2x Blood Bag")).length, 1);
});

test("a restart reads back what was stored, and no temporary file is left behind", async () => {
  const torn = fakeTorn({ action: actions(150, T0 - 60), deposit: [] });
  const { c, make, dir } = setup({ torn });
  await c.pollOnce();
  const again = make().snapshot();
  assert.equal(again.lines.length, c.snapshot().lines.length);
  assert.deepEqual(again.cats, c.snapshot().cats);
  assert.deepEqual(readdirSync(dir), ["42055.json"]);
});

test("a store that will not read is set aside, not written over", async () => {
  const dir = mkdtempSync(join(tmpdir(), "blood-bags-"));
  writeFileSync(join(dir, "42055.json"), "{ not json");
  const { c, logs } = setup({ dataDir: dir });
  assert.equal(c.snapshot().lines.length, 0);
  const files = readdirSync(dir);
  assert.equal(files.length, 1);
  assert.match(files[0], /^42055\.json\.unreadable-\d+$/);
  assert.equal(readFileSync(join(dir, files[0]), "utf8"), "{ not json");
  assert.ok(logs.some((m) => m.includes("store unreadable")));
});

// ── the backfill, the war list and the schedule ─────────────────────────────
const HOUR_MS = 3600 * 1000;
const bloodIn = (torn, fromSec) => torn.news.armoryAction.concat(torn.news.armoryDeposit)
  .filter((e) => e.timestamp >= fromSec && /Blood Bag :/.test(e.text) && !/Irradiated/.test(e.text)).length;
// The backfill's own pages: they walk the year's gap, so they ask from its floor.
const backfillPages = (t) => newsCalls(t).filter((call) => call.url.searchParams.get("from") === String(CUTOFF));
// How long after the call before it each call came, in ms.
const between = (calls) => calls.slice(1).map((call, i) => call.at - calls[i].at);

test("the backfill fills the year below the first page, a call every 6 seconds, down to the year's floor", async () => {
  const torn = fakeTorn({
    action: actions(1000, T0 - 60, Math.round(0.4 * DAY)),
    deposit: [entry(T0 - 5 * DAY, `${who(7, "P7")} deposited 3x Blood Bag : B+`), entry(T0 - 380 * DAY, `${who(7, "P7")} deposited 9x Blood Bag : B+`)],
  });
  const { c } = setup({ torn });
  await c.pollOnce();
  await c.refreshWars();
  await c.runBackfill();

  const backfill = newsCalls(torn).slice(2);
  assert.ok(backfill.length >= 6);
  for (const call of backfill) assert.equal(call.url.searchParams.get("from"), String(CUTOFF));
  const times = torn.calls.map((call) => call.at);
  for (let i = 1; i < times.length; i++) assert.ok(times[i] - times[i - 1] >= GAP_MS, `call ${i} came ${times[i] - times[i - 1]} ms after the one before`);
  const snap = c.snapshot();
  assert.equal(snap.backfillDone, true);
  assert.equal(snap.reachSec, CUTOFF);
  assert.equal(snap.lines.length, bloodIn(torn, CUTOFF));
  assert.ok(snap.lines.every((l) => l.ts >= CUTOFF));
});

test("while a ranked war is live the backfill takes a page every 30 seconds, and goes back to every 6 once the war list shows it over", async () => {
  const torn = fakeTorn({ action: actions(1000, T0 - 60, Math.round(0.3 * DAY)), deposit: [], wars: [{ id: 51418, start: T0 - DAY, end: 0 }] });
  const { c, clock, logs } = setup({ torn });
  await c.pollOnce();
  await c.refreshWars();
  // At the third backfill page the war ends, and a read of the list says so.
  let reread = null;
  torn.fail = () => {
    if (!reread && backfillPages(torn).length === 3) {
      torn.wars[0].end = Math.floor(clock.now / 1000);
      reread = c.refreshWars();
    }
    return null;
  };
  await c.runBackfill();
  await reread;
  const pages = backfillPages(torn);
  const gaps = between(pages);
  assert.ok(pages.length >= 7, `${pages.length} backfill pages`);
  assert.ok(gaps.slice(0, 2).every((ms) => ms >= WAR_GAP_MS), `during the war: ${gaps}`);
  assert.ok(gaps.slice(-3).every((ms) => ms >= GAP_MS && ms < WAR_GAP_MS), `after it: ${gaps}`);
  const said = (text) => logs.filter((m) => m.includes(text)).length;
  assert.equal(said("backfill slowed to 2 calls a minute: ranked war 51418 is live"), 1, logs.join("\n"));
  assert.equal(said("backfill back to 10 calls a minute: no ranked war is live"), 1, logs.join("\n"));
  const snap = c.snapshot();
  assert.equal(snap.backfillDone, true);
  assert.equal(snap.lines.length, bloodIn(torn, CUTOFF));
});

test("a Torn error mid-backfill keeps its place and never marks the backfill done", async () => {
  const torn = fakeTorn({ action: actions(1000, T0 - 60, Math.round(0.3 * DAY)), deposit: [] });
  const { c, logs } = setup({ torn });
  await c.pollOnce();
  await c.refreshWars();
  // News calls 1 and 2 are the poll; backfill pages 3 to 5 succeed, then Torn refuses.
  torn.fail = (u) => (u.pathname === "/v2/faction/news" && newsCalls(torn).length > 5 ? reply({ error: { code: 5, error: "Too many requests" } }) : null);
  await c.runBackfill();
  const snap = c.snapshot();
  assert.equal(snap.backfillDone, false);
  const lastGood = newsCalls(torn)[4];
  const pageOldest = Math.min(...torn.news.armoryAction
    .filter((e) => e.timestamp >= CUTOFF && e.timestamp < Number(lastGood.url.searchParams.get("to")))
    .sort((a, b) => b.timestamp - a.timestamp).slice(0, 100).map((e) => e.timestamp));
  assert.deepEqual(snap.cats.armoryAction.gaps, [{ from: CUTOFF, to: pageOldest + 1 }]);
  assert.ok(logs.some((m) => m.includes("backfill failed: Torn API error: Too many requests (code 5)")));
});

test("after a restart the backfill carries on from its saved place, with no repeats and no gap", async () => {
  const torn = fakeTorn({ action: actions(1000, T0 - 60, Math.round(0.3 * DAY)), deposit: [] });
  const { c, make } = setup({ torn });
  await c.pollOnce();
  await c.refreshWars();
  torn.fail = (u) => (u.pathname === "/v2/faction/news" && newsCalls(torn).length > 5 ? reply({ error: { code: 5, error: "Too many requests" } }) : null);
  await c.runBackfill();
  const saved = c.snapshot().cats.armoryAction.gaps[0].to;

  torn.fail = null;
  torn.calls.length = 0;
  const after = make();
  await after.runBackfill();
  assert.equal(newsCalls(torn)[0].url.searchParams.get("to"), String(saved), "it starts where the last one stopped");
  const snap = after.snapshot();
  assert.equal(snap.backfillDone, true);
  assert.equal(snap.lines.length, bloodIn(torn, CUTOFF));
});

test("the poll and the backfill share one pace", async () => {
  const torn = fakeTorn({ action: actions(1000, T0 - 60, Math.round(0.3 * DAY)), deposit: [] });
  const { c } = setup({ torn });
  await c.pollOnce();
  await c.refreshWars();
  const running = c.runBackfill();
  await c.pollOnce();
  await running;
  const times = torn.calls.map((call) => call.at);
  for (let i = 1; i < times.length; i++) assert.ok(times[i] - times[i - 1] >= GAP_MS);
  assert.equal(c.snapshot().backfillDone, true);
});

test("the war list is read with every hourly poll, before and after the backfill is done", async () => {
  const torn = fakeTorn({ action: actions(300, T0 - 60, 3600), deposit: [], wars: [{ id: 7, start: T0 - DAY, end: 0 }] });
  const { c, clock } = setup({ torn });
  const warCalls = () => torn.calls.filter((call) => call.url.pathname.endsWith("/rankedwars")).length;
  await c.tick(); await c.runBackfill();
  assert.equal(warCalls(), 1);
  clock.now += HOUR_MS;
  await c.tick(); await c.runBackfill();
  assert.equal(warCalls(), 2, "read every hour: a list over 65 minutes old would slow the backfill");

  torn.wars[0].end = T0;
  clock.now += HOUR_MS;
  await c.tick(); await c.runBackfill();
  assert.equal(warCalls(), 3);
  assert.equal(c.snapshot().backfillDone, true);
  // A war that starts after the backfill is done is seen within the hour, so
  // use during it never counts against anyone for long.
  torn.wars.push({ id: 8, start: Math.floor(clock.now / 1000) + 600, end: 0 });
  clock.now += HOUR_MS;
  await c.tick();
  assert.equal(warCalls(), 4, "still hourly once the backfill is done");
  assert.deepEqual(c.snapshot().wars.map((w) => w.id), [7, 8]);
});

test("start runs one tick at once and then every hour; stop ends it", async () => {
  const torn = fakeTorn({ action: actions(10, T0 - 60), deposit: [] });
  const timers = [];
  const clock = { now: T0 * 1000 };
  torn.clock = clock;
  const c = createBloodBagCollector({
    dataDir: mkdtempSync(join(tmpdir(), "blood-bags-")), fetchImpl: torn.fetchImpl, nowFn: () => clock.now,
    sleepFn: async (ms) => { clock.now += ms; }, keyFn: () => "k", log: () => {},
    setIntervalFn: (fn, ms) => { const t = { fn, ms, cleared: false }; timers.push(t); return t; },
    clearIntervalFn: (t) => { t.cleared = true; },
  });
  await c.start();
  await c.start();
  assert.equal(timers.length, 1, "a second start does nothing");
  assert.equal(timers[0].ms, HOUR_MS);
  assert.equal(newsCalls(torn).length, 2);
  c.stop();
  assert.equal(timers[0].cleared, true);
});

// ── review fixes ────────────────────────────────────────────────────────────
test("a save that fails during the backfill is logged, and the run still settles, so the server stays up", async () => {
  const torn = fakeTorn({ action: actions(1000, T0 - 60, Math.round(0.3 * DAY)), deposit: [] });
  const clock = { now: T0 * 1000 };
  torn.clock = clock;
  const logs = [];
  const opts = {
    dataDir: mkdtempSync(join(tmpdir(), "blood-bags-")), fetchImpl: torn.fetchImpl, nowFn: () => clock.now,
    sleepFn: async (ms) => { clock.now += ms; }, keyFn: () => "k", log: (m) => logs.push(m),
  };
  const c = createBloodBagCollector(opts);
  await c.pollOnce();
  await c.refreshWars();
  // From here every save fails: the folder's path now runs through a file.
  const file = join(mkdtempSync(join(tmpdir(), "blood-bags-")), "a-file");
  writeFileSync(file, "");
  opts.dataDir = join(file, "store");
  await assert.doesNotReject(c.runBackfill());
  assert.ok(logs.some((m) => m.includes("backfill save failed")), logs.join("\n"));
});

test("while the ranked-war list cannot be read, the backfill goes on at the war pace", async () => {
  const torn = fakeTorn({ action: actions(1000, T0 - 60, Math.round(0.3 * DAY)), deposit: [], wars: [{ id: 51418, start: T0 - DAY, end: 0 }] });
  torn.fail = (u) => (u.pathname.endsWith("/rankedwars") ? reply({ error: { code: 5, error: "Too many requests" } }) : null);
  const { c, logs } = setup({ torn });
  await c.pollOnce();
  assert.equal(await c.refreshWars(), false);
  await c.runBackfill();
  const pages = backfillPages(torn);
  assert.ok(pages.length >= 7, `${pages.length} backfill pages: it goes on rather than waiting`);
  assert.ok(between(pages).every((ms) => ms >= WAR_GAP_MS), `a list it could not read counts as a war: ${between(pages)}`);
  const said = logs.filter((m) => m.includes("backfill slowed to 2 calls a minute: the ranked-war list has not been read in the last hour"));
  assert.equal(said.length, 1, logs.join("\n"));
  assert.equal(c.snapshot().backfillDone, true);
});

test("a ranked-war reply without its list is a failed read, not a list of no wars", async () => {
  const torn = fakeTorn({ action: actions(300, T0 - 60, 3600), deposit: [], wars: [{ id: 51418, start: T0 - DAY, end: 0 }] });
  torn.fail = (u) => (u.pathname.endsWith("/rankedwars") ? reply({ rankedwars: null }) : null);
  const { c, logs } = setup({ torn });
  assert.equal(await c.refreshWars(), false);
  assert.ok(logs.some((m) => m.includes("war list failed")), logs.join("\n"));
  await c.tick(); await c.runBackfill();
  const pages = backfillPages(torn);
  assert.ok(pages.length >= 3, `${pages.length} backfill pages`);
  assert.ok(between(pages).every((ms) => ms >= WAR_GAP_MS), `taken as no wars, the list would let it run at full speed: ${between(pages)}`);
});

test("a news reply without its list is a failed call, so the backfill keeps its gap", async () => {
  const torn = fakeTorn({ action: actions(1000, T0 - 60, Math.round(0.3 * DAY)), deposit: [] });
  const { c, logs } = setup({ torn });
  await c.pollOnce();
  await c.refreshWars();
  const before = c.snapshot().cats.armoryAction.gaps;
  torn.fail = (u) => (u.pathname === "/v2/faction/news" ? reply({ news: null }) : null);
  await c.runBackfill();
  assert.deepEqual(c.snapshot().cats.armoryAction.gaps, before);
  assert.equal(c.snapshot().backfillDone, false);
  assert.ok(logs.some((m) => m.includes("backfill failed")), logs.join("\n"));
});

test("a page that comes back at or past its own `to` still moves the walk down", async () => {
  const torn = fakeTorn({ action: actions(1000, T0 - 60, Math.round(0.3 * DAY)), deposit: [] });
  const { c } = setup({ torn });
  await c.pollOnce();
  await c.refreshWars();
  let served = false;
  torn.fail = (u) => {
    if (served || u.pathname !== "/v2/faction/news" || !u.searchParams.has("to")) return null;
    served = true;
    const to = Number(u.searchParams.get("to"));
    return reply({ news: Array.from({ length: 100 }, () => entry(to, FILL(300))) });
  };
  torn.calls.length = 0;
  await c.runBackfill();
  const tos = newsCalls(torn).map((call) => Number(call.url.searchParams.get("to")));
  assert.ok(tos[1] < tos[0], `after a page asked with to=${tos[0]}, the next asked with to=${tos[1]}`);
  assert.equal(c.snapshot().backfillDone, true);
});

test("the store remembers whether the last poll succeeded", async () => {
  const torn = fakeTorn({ action: actions(10, T0 - 60), deposit: [] });
  const { c } = setup({ torn });
  await c.pollOnce();
  assert.equal(c.snapshot().lastPollOk, true);
  torn.fail = () => reply({ error: { code: 5, error: "Too many requests" } });
  await c.pollOnce();
  assert.equal(c.snapshot().lastPollOk, false);
});

test("a blood line the reader cannot read yet is kept as written, and counted once a later reader can", async () => {
  const odd = `${who(5, "P5")} donated 2x Blood Bag : O+ to the hospital`;
  const torn = fakeTorn({ action: [entry(T0 - 60, odd)], deposit: [] });
  const { c, make, dir } = setup({ torn });
  await c.pollOnce();
  const stored = JSON.parse(readFileSync(join(dir, "42055.json"), "utf8"));
  assert.deepEqual(Object.values(stored.unread), [{ ts: T0 - 60, text: odd }]);
  // As a store written by an older reader would hold it: a line today's reader knows.
  stored.unread["777"] = { ts: T0 - 120, text: FILL(8) };
  writeFileSync(join(dir, "42055.json"), JSON.stringify(stored));
  const lines = make().snapshot().lines;
  assert.deepEqual(lines.filter((l) => l.playerId === "8").map((l) => [l.kind, l.ts]), [["fill", T0 - 120]]);
  assert.ok(!lines.some((l) => l.playerId === "5"), "a line no reader knows stays out of the sums");
});

test("a store written before lastPollOk and unread existed loads as it is, and polls on", async () => {
  const dir = mkdtempSync(join(tmpdir(), "blood-bags-"));
  const rec = { ts: T0 - 7200, kind: "fill", playerId: "4", name: "P4", type: "O+", qty: 1, toId: null, toName: null };
  writeFileSync(join(dir, "42055.json"), JSON.stringify({
    version: 1, factionId: "42055", cutoffSec: CUTOFF, lines: { "4000001": rec },
    cats: { armoryAction: { headTs: T0 - 7200, gaps: [{ from: CUTOFF, to: T0 - 9000 }] }, armoryDeposit: { headTs: T0 - 7200, gaps: [] } },
    wars: [], warsAt: 0, lastPollAt: (T0 - 3600) * 1000,
  }));
  const torn = fakeTorn({ action: [entry(T0 - 60, FILL(6))], deposit: [] });
  const { c, logs } = setup({ torn, dataDir: dir });
  assert.equal(c.snapshot().lines.length, 1);
  assert.equal(await c.pollOnce(), true);
  assert.equal(c.snapshot().lines.length, 2);
  assert.ok(!logs.some((m) => m.includes("store unreadable")), logs.join("\n"));
  assert.deepEqual(readdirSync(dir), ["42055.json"]);
});

// ── the war pace ────────────────────────────────────────────────────────────
// A clock that moves only when the test moves it, so a slow backfill and a poll
// can run side by side without one's waits counting as the other's.
function manualClock(ms) {
  const clock = { now: ms, timers: [] };
  clock.sleep = (wait) => new Promise((resolve) => clock.timers.push({ at: clock.now + wait, resolve }));
  // Wakes the earliest sleeper, again and again, until the work is done.
  clock.until = async (work) => {
    let done = false;
    work.then(() => { done = true; }, () => { done = true; });
    for (let turn = 0; ; turn++) {
      await new Promise((r) => setImmediate(r));
      if (done) return work;
      assert.ok(turn < 10000 && clock.timers.length > 0, "the work is waiting on something other than the clock");
      clock.timers.sort((a, b) => a.at - b.at);
      const next = clock.timers.shift();
      clock.now = Math.max(clock.now, next.at);
      next.resolve();
    }
  };
  return clock;
}

test("during a war the backfill's slower pace never holds up the hourly poll", async () => {
  const torn = fakeTorn({ action: actions(1000, T0 - 60, Math.round(0.3 * DAY)), deposit: [], wars: [{ id: 51418, start: T0 - DAY, end: 0 }] });
  const clock = manualClock(T0 * 1000);
  torn.clock = clock;
  const c = createBloodBagCollector({
    dataDir: mkdtempSync(join(tmpdir(), "blood-bags-")), fetchImpl: torn.fetchImpl, nowFn: () => clock.now,
    sleepFn: clock.sleep, keyFn: () => "k", log: () => {},
  });
  await clock.until(Promise.all([c.pollOnce(), c.refreshWars()]));
  const mark = torn.calls.length;
  await clock.until(Promise.all([c.runBackfill(), c.pollOnce()]));

  const pages = backfillPages(torn);
  assert.ok(pages.length >= 6, `${pages.length} backfill pages`);
  assert.ok(between(pages).every((ms) => ms >= WAR_GAP_MS), `backfill pages: ${between(pages)}`);
  assert.ok(between(torn.calls).every((ms) => ms >= GAP_MS), `every call still waits its turn: ${between(torn.calls)}`);
  const pollCalls = torn.calls.slice(mark).filter((call) => call.url.pathname === "/v2/faction/news" && call.url.searchParams.get("from") !== String(CUTOFF));
  assert.equal(pollCalls.length, 2, "one page of each category");
  assert.ok(pollCalls[1].at - pollCalls[0].at < WAR_GAP_MS, `the poll's calls came ${pollCalls[1].at - pollCalls[0].at} ms apart`);
  assert.ok(pages.at(-1).at > pollCalls[1].at, "the backfill went on after the poll was done");
});

test("an hourly tick that lands while the backfill waits out its 30 seconds goes out at once, 6 s apart", async () => {
  const torn = fakeTorn({ action: actions(1000, T0 - 60, Math.round(0.3 * DAY)), deposit: [], wars: [{ id: 51418, start: T0 - DAY, end: 0 }] });
  const clock = manualClock(T0 * 1000);
  torn.clock = clock;
  const c = createBloodBagCollector({
    dataDir: mkdtempSync(join(tmpdir(), "blood-bags-")), fetchImpl: torn.fetchImpl, nowFn: () => clock.now,
    sleepFn: clock.sleep, keyFn: () => "k", log: () => {},
  });
  await clock.until(Promise.all([c.pollOnce(), c.refreshWars()]));
  let reached;
  const third = new Promise((r) => { reached = r; });
  torn.fail = () => { if (backfillPages(torn).length === 3) reached(); return null; };
  const run = c.runBackfill();
  await clock.until(third);
  torn.fail = null;
  // The backfill is now waiting out its 30 s; the hourly tick comes 10 s in.
  const page3 = backfillPages(torn)[2].at;
  assert.equal(clock.timers.length, 1, "only the backfill's wait is pending");
  clock.now = page3 + 10000;
  const asked = clock.now;
  const mark = torn.calls.length;
  await clock.until(c.tick());
  const isPage = (call) => call.url.pathname === "/v2/faction/news" && call.url.searchParams.get("from") === String(CUTOFF);
  const tickCalls = torn.calls.slice(mark).filter((call) => !isPage(call));
  assert.equal(tickCalls.length, 3, "the war list and one page of each category");
  assert.ok(tickCalls[0].at - asked <= GAP_MS, `the tick's first call came ${tickCalls[0].at - asked} ms after it was asked`);
  for (let i = 1; i < 3; i++) assert.ok(tickCalls[i].at - tickCalls[i - 1].at <= 2 * GAP_MS, `tick call ${i}: ${tickCalls[i].at - tickCalls[i - 1].at} ms`);
  await clock.until(run);
  const pages = backfillPages(torn);
  assert.ok(between(pages).every((ms) => ms >= WAR_GAP_MS), `backfill pages: ${between(pages)}`);
  assert.ok(between(torn.calls).every((ms) => ms >= GAP_MS), `every call still waits its turn: ${between(torn.calls)}`);
  assert.equal(c.snapshot().backfillDone, true);
});

test("after a restart once the war is over, the backfill says it is at 10 calls a minute, and goes at that pace", async () => {
  const torn = fakeTorn({ action: actions(1000, T0 - 60, Math.round(0.3 * DAY)), deposit: [], wars: [{ id: 51418, start: T0 - DAY, end: 0 }] });
  const { c, make, clock, logs } = setup({ torn });
  await c.pollOnce();
  await c.refreshWars();
  // Two slow pages, then Torn refuses and the run stops.
  torn.fail = (u) => (u.pathname === "/v2/faction/news" && newsCalls(torn).length > 4 ? reply({ error: { code: 5, error: "Too many requests" } }) : null);
  await c.runBackfill();
  torn.fail = null;
  // The war ends, and the restart's first tick reads the list that says so.
  torn.wars[0].end = Math.floor(clock.now / 1000);
  torn.calls.length = 0;
  const after = make();
  await after.refreshWars();
  const before = logs.length;
  await after.runBackfill();
  const said = (text) => logs.slice(before).filter((m) => m.includes(text)).length;
  assert.equal(said("backfill at 10 calls a minute: no ranked war is live"), 1, logs.slice(before).join("\n"));
  assert.equal(said("2 calls a minute"), 0, logs.slice(before).join("\n"));
  const pages = backfillPages(torn);
  assert.ok(between(pages).every((ms) => ms >= GAP_MS && ms < WAR_GAP_MS), `${pages.length} backfill pages: ${between(pages)}`);
  assert.equal(after.snapshot().backfillDone, true);
});

test("a war list that goes out of date mid-run, then is read again, keeps the war pace and logs each new reason once", async () => {
  const torn = fakeTorn({ action: actions(1000, T0 - 60, Math.round(0.3 * DAY)), deposit: [], wars: [{ id: 51418, start: T0 - DAY, end: 0 }] });
  const { c, clock, logs } = setup({ torn });
  await c.pollOnce();
  await c.refreshWars();
  // At the third page the hourly read is late, so the list goes out of date; at
  // the sixth it is read again.
  let jumped = false;
  let reread = null;
  torn.fail = () => {
    const n = backfillPages(torn).length;
    if (!jumped && n === 3) { jumped = true; clock.now += 66 * 60 * 1000; }
    if (!reread && n === 6) reread = c.refreshWars();
    return null;
  };
  await c.runBackfill();
  await reread;
  const said = (text) => logs.filter((m) => m.includes(text)).length;
  assert.equal(said("backfill slowed to 2 calls a minute: ranked war 51418 is live"), 1, logs.join("\n"));
  assert.equal(said("backfill still at 2 calls a minute: the ranked-war list has not been read in the last hour"), 1, logs.join("\n"));
  assert.equal(said("backfill still at 2 calls a minute: ranked war 51418 is live"), 1, logs.join("\n"));
  assert.equal(said("10 calls a minute"), 0, logs.join("\n"));
  const pages = backfillPages(torn);
  assert.ok(between(pages).every((ms) => ms >= WAR_GAP_MS), `${pages.length} backfill pages: ${between(pages)}`);
  assert.equal(c.snapshot().backfillDone, true);
});

test("a war that starts while the backfill runs at full speed slows it from the next page", async () => {
  const torn = fakeTorn({ action: actions(1000, T0 - 60, Math.round(0.3 * DAY)), deposit: [], wars: [{ id: 9, start: T0 + 45, end: 0 }] });
  const { c, logs } = setup({ torn });
  await c.pollOnce();
  await c.refreshWars();
  await c.runBackfill();
  const pages = backfillPages(torn);
  const gaps = between(pages);
  assert.ok(pages.length >= 7, `${pages.length} backfill pages`);
  assert.ok(gaps.slice(0, 3).every((ms) => ms < WAR_GAP_MS), `before the war: ${gaps}`);
  assert.ok(gaps.slice(-3).every((ms) => ms >= WAR_GAP_MS), `once it starts: ${gaps}`);
  const said = (text) => logs.filter((m) => m.includes(text)).length;
  assert.equal(said("backfill at 10 calls a minute: no ranked war is live"), 1, logs.join("\n"));
  assert.equal(said("backfill slowed to 2 calls a minute: ranked war 9 is live"), 1, logs.join("\n"));
});

test("after a restart during a war the first page goes at once, then one every 30 seconds", async () => {
  const torn = fakeTorn({ action: actions(1000, T0 - 60, Math.round(0.3 * DAY)), deposit: [], wars: [{ id: 51418, start: T0 - DAY, end: 0 }] });
  const { c, make, clock, logs } = setup({ torn });
  await c.pollOnce();
  await c.refreshWars();
  // Two slow pages, then Torn refuses and the run stops.
  torn.fail = (u) => (u.pathname === "/v2/faction/news" && newsCalls(torn).length > 4 ? reply({ error: { code: 5, error: "Too many requests" } }) : null);
  await c.runBackfill();
  torn.fail = null;
  torn.calls.length = 0;
  const restartAt = clock.now;
  const before = logs.length;
  const after = make();
  await after.runBackfill();
  const pages = backfillPages(torn);
  assert.equal(pages[0].at, restartAt, "the first page goes at once");
  assert.ok(between(pages).every((ms) => ms >= WAR_GAP_MS), `${pages.length} backfill pages: ${between(pages)}`);
  const said = (text) => logs.slice(before).filter((m) => m.includes(text)).length;
  assert.equal(said("backfill slowed to 2 calls a minute: ranked war 51418 is live"), 1, "the restart says its pace again");
  assert.equal(after.snapshot().backfillDone, true);
});
