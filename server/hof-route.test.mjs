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
