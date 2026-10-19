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

// ── review fixes ────────────────────────────────────────────────────────
test("a key problem in the Hall of Fame check ends the run without a retry, even after today's code 30", async () => {
  const torn = fakeTorn({ days: { "2026-10-18": SNAP }, onHof: () => tornErr(2, "Incorrect key") });
  const s = await runOnce(setup(torn));
  assert.equal(s.keyError, true);
  assert.equal(s.retry, false, "today's code 30 had armed it; a key problem clears it");
  assert.deepEqual(s.saved, []);
});

test("a short file is kept aside, and accepted when Torn serves it again unchanged", async () => {
  const SHORT = csvOf(WORLD.slice(0, 300));
  const torn = fakeTorn({ days: { "2026-10-19": SNAP, "2026-10-18": SHORT } });
  const opts = setup(torn);
  const s1 = await runOnce(opts);
  assert.ok(!s1.saved.includes("2026-10-18"));
  assert.equal(gunzipSync(readFileSync(join(opts.dataDir, "raw", "2026-10-18.rejected.csv.gz"))).toString(), SHORT,
    "nothing Torn served is thrown away");

  clock.now += 15 * 60 * 1000;
  const s2 = await runOnce(opts);
  assert.ok(s2.saved.includes("2026-10-18"), "the same file twice is real, not cut off");
  assert.ok(!existsSync(join(opts.dataDir, "raw", "2026-10-18.rejected.csv.gz")));
});

test("a day that fails on its own doesn't hold back the older days", async () => {
  const torn = fakeTorn({ days: { "2026-10-19": SNAP, "2026-10-18": "id,name\n1,A\n", "2026-10-17": SNAP },
    onSnapshot: (day) => (day === "2026-10-16" ? reply("gone", 404) : null) });
  const opts = setup(torn);
  const s = await runOnce(opts);
  assert.deepEqual(s.saved, ["2026-10-19", "2026-10-17"]);
  assert.ok(existsSync(join(opts.dataDir, "raw", "2026-10-18.rejected.csv.gz")), "a file missing a column is kept aside");
  const attempts = JSON.parse(readFileSync(join(opts.dataDir, "attempts.json"), "utf8"));
  assert.equal(attempts["2026-10-18"], "2026-10-19", "asked again on a later UTC date, not every 15 minutes");
  assert.equal(attempts["2026-10-16"], "2026-10-19");
});

test("while the Hall of Fame check fails on a first run, it still saves every raw file", async () => {
  const torn = fakeTorn({ days: { "2026-10-19": SNAP, "2026-10-18": SNAP, "2026-09-18": SNAP }, onHof: () => reply("oops", 500) });
  const opts = setup(torn);
  const s = await runOnce(opts);
  assert.deepEqual(s.saved, []);
  for (const d of ["2026-10-19", "2026-10-18", "2026-09-18"]) {
    assert.ok(existsSync(join(opts.dataDir, "raw", `${d}.csv.gz`)), `${d} raw file kept`);
  }
  assert.equal(torn.hofCalls().length, 1, "the check isn't repeated for every day");
  assert.equal(s.retry, true);
});
