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
const { createBloodBagCollector, GAP_MS, HEAD_MAX_PAGES } = await import("./blood-bags.js");

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
