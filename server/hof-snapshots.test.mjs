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
