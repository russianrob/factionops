// Genocide marks (FactionOps 5.6.29): which members hold Torn's Genocide
// honor, "a single hit that earns your faction 1,000 or more respect".
//
// A chain's bonus hits pay fixed respect (the 1,000th 640, the 2,500th 1,280,
// the 5,000th 2,560), so the faction's own record of the honor is the bonus
// hits worth 1,000 or more in its chain reports. A member who earned it in
// another faction shows only in their own honors, which their FactionOps reads
// with their own key and reports as yes or no. These tests run genocide.js
// with made-up ids, chain ids and counts, a temporary data dir, and a stand-in
// for Torn.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import * as g from "./genocide.js";
import * as fh from "./faction-history.js";

const tmp = () => mkdtempSync(path.join(tmpdir(), "genocide-"));
const readStore = (dir, fid) => JSON.parse(readFileSync(path.join(dir, `genocide-${fid}.json`), "utf8"));
const empty = () => ({ hits: {}, scanned: {}, self: {} });

const REPORT = { id: 900001, start: 1700000000, bonuses: [
  { attacker_id: 1000001, defender_id: 2000001, chain: 1000, respect: 640 },
  { attacker_id: 1000002, defender_id: 2000002, chain: 2500, respect: 1280 },
  { attacker_id: 1000003, defender_id: 2000003, chain: 5000, respect: 2560 },
] };

// ── The faction's own record: bonus hits worth 1,000+ ──────────────────

test("bonusHolders keeps the bonus hits worth 1,000 respect or more", () => {
  assert.deepEqual(g.bonusHolders(REPORT), [
    { id: "1000002", hit: 2500, respect: 1280, chainId: "900001", start: 1700000000 },
    { id: "1000003", hit: 5000, respect: 2560, chainId: "900001", start: 1700000000 },
  ]);
  // A bonus with no attacker names nobody.
  assert.deepEqual(g.bonusHolders({ id: 900002, start: 1, bonuses: [{ chain: 2500, respect: 1280 }] }), []);
  assert.deepEqual(g.bonusHolders({ id: 900003 }), []);
  assert.deepEqual(g.bonusHolders(null), []);
});

test("foldHits keeps each member's earliest qualifying hit", () => {
  const s = empty();
  assert.equal(g.foldHits(s, g.bonusHolders(REPORT)), 2);
  // The same chain read again changes nothing.
  assert.equal(g.foldHits(s, g.bonusHolders(REPORT)), 0);
  // A later chain leaves the first hit in place...
  assert.equal(g.foldHits(s, [{ id: "1000002", hit: 2500, respect: 1280, chainId: "900009", start: 1710000000 }]), 0);
  assert.equal(s.hits["1000002"].chainId, "900001");
  // ...and an earlier one replaces it.
  assert.equal(g.foldHits(s, [{ id: "1000002", hit: 10000, respect: 5120, chainId: "900000", start: 1600000000 }]), 1);
  assert.deepEqual(s.hits["1000002"], { hit: 10000, respect: 5120, chainId: "900000", start: 1600000000 });
  // Two bonuses in one chain: the lower hit came first.
  g.foldHits(s, [
    { id: "1000004", hit: 5000, respect: 2560, chainId: "900005", start: 1720000000 },
    { id: "1000004", hit: 2500, respect: 1280, chainId: "900005", start: 1720000000 },
  ]);
  assert.equal(s.hits["1000004"].hit, 2500);
});

// ── A member's own answer ───────────────────────────────────────────────

test("parseSelfReport takes true, false or null, and nothing else; an award date is never kept", () => {
  assert.deepEqual(g.parseSelfReport({ genocide: true, awardedAt: 1690000000 }), { has: true });
  assert.deepEqual(g.parseSelfReport({ genocide: true }), { has: true });
  assert.deepEqual(g.parseSelfReport({ genocide: false, awardedAt: 1690000000 }), { has: false });
  assert.deepEqual(g.parseSelfReport({ genocide: null }), { has: null });
  for (const b of [{}, { genocide: "true" }, { genocide: 1 }, null, undefined, "x"]) {
    assert.equal(g.parseSelfReport(b), null);
  }
});

// The settings row promises "only yes or no": no award date and no day of
// the member's last check reach the faction, though the store keeps the check
// time for itself.
test("genocideView: a faction hit beats a self 'no', a self 'yes' counts, only yes or no reaches the faction, a withdrawal forgets", () => {
  const s = empty();
  g.foldHits(s, g.bonusHolders(REPORT));
  g.foldSelf(s, "1000002", { has: false }, 1650000123); // an old "no", from before the hit
  g.foldSelf(s, "1000005", { has: true }, 1700000100);
  g.foldSelf(s, "1000006", { has: false }, 1700000200);
  assert.deepEqual(g.genocideView(s), {
    1000002: { has: true, via: "hit", hit: 2500, start: 1700000000 },
    1000003: { has: true, via: "hit", hit: 5000, start: 1700000000 },
    1000005: { has: true, via: "self" },
    1000006: { has: false },
  });
  assert.deepEqual(s.self["1000006"], { has: false, checkedAt: 1700000200 });
  g.foldSelf(s, "1000006", { has: null }, 1700000400);
  assert.equal("1000006" in g.genocideView(s), false);
});

// ── Which chains to read ───────────────────────────────────────────────

test("chainsToScan: 2,500+ hits, finished over an hour ago, not yet read, each id once", () => {
  const now = 1800000000;
  const chains = [
    { id: 900010, chain: 2510, end: now - 7200 },
    { id: 900010, chain: 2510, end: now - 7200 }, // a page-seam duplicate
    { id: 900011, chain: 2499, end: now - 7200 }, // short of the 2,500th hit
    { id: 900012, chain: 5020, end: now - 600 },  // ended ten minutes ago, or still running
    { id: 900013, chain: 2600, end: now - 9000 }, // already read
    { id: 900014, chain: 3000, end: 0 },
  ];
  const s = empty();
  s.scanned["900013"] = 1;
  assert.deepEqual(g.chainsToScan(chains, s, now), ["900010"]);
  assert.deepEqual(g.chainsToScan(null, s, now), []);
});

// ── The scans ──────────────────────────────────────────────────────────

test("scanFinishedChains reads the due chains, marks them read, keeps a failed one for next time, and saves", async () => {
  const dir = tmp(), now = 1800000000;
  const reports = {
    900020: { id: 900020, start: 1750000123, bonuses: [{ attacker_id: 1000011, chain: 2500, respect: 1280 }] },
    900022: { id: 900022, start: 1760000000, bonuses: [
      { attacker_id: 1000012, chain: 2500, respect: 1280 },
      { attacker_id: 1000013, chain: 5000, respect: 2560 },
    ] },
  };
  const asked = [];
  const fetchReport = async (id) => {
    asked.push(id);
    if (id === "900021") throw new Error("Torn API error: Incorrect ID (code 6)");
    return reports[id] || null;
  };
  const chains = [900020, 900021, 900022].map((id) => ({ id, chain: 2600, end: now - 7200 }));
  assert.deepEqual(await g.scanFinishedChains(fetchReport, "1000", chains, { nowS: now, dir }), { fetched: 2, found: 3 });
  assert.deepEqual(asked, ["900020", "900021", "900022"]);
  const file = readStore(dir, "1000");
  assert.deepEqual(Object.keys(file.scanned).sort(), ["900020", "900022"]);
  assert.deepEqual(Object.keys(file.hits).sort(), ["1000011", "1000012", "1000013"]);
  // Next time only the failed chain is asked again.
  asked.length = 0;
  await g.scanFinishedChains(fetchReport, "1000", chains, { nowS: now, dir });
  assert.deepEqual(asked, ["900021"]);
});

test("scanFinishedChains stops at its budget", async () => {
  const dir = tmp(), now = 1800000000;
  const asked = [];
  const chains = [900030, 900031, 900032].map((id) => ({ id, chain: 2600, end: now - 7200 }));
  const report = (id) => ({ id, start: 1, bonuses: [{ attacker_id: 1000014, chain: 2500, respect: 1280 }] });
  await g.scanFinishedChains(async (id) => { asked.push(id); return report(id); }, "1004", chains, { nowS: now, dir, budget: 2 });
  assert.equal(asked.length, 2);
});

// Every chain of 2,500+ hits has a bonus worth 1,000+ (the 2,500th pays
// 1,280), so a report without one is not the report expected: a changed
// answer from Torn must not mark the chain read and lose its holders for good.
test("a chain of 2,500+ hits whose report shows no 1,000+ bonus stays unread, with a warning", async () => {
  const dir = tmp(), now = 1800000000;
  const chains = [900040, 900041].map((id) => ({ id, chain: 2600, end: now - 7200 }));
  const reports = { 900040: { id: 900040, start: 1750000123, bonuses: [] }, 900041: null };
  const warned = [], was = console.warn;
  console.warn = (m) => { warned.push(String(m)); };
  try {
    assert.equal((await g.scanFinishedChains(async (id) => reports[id], "1005", chains, { nowS: now, dir })).found, 0);
  } finally {
    console.warn = was;
  }
  assert.deepEqual(readStore(dir, "1005").scanned, {});
  for (const id of ["900040", "900041"]) {
    assert.equal(warned.filter((m) => m.startsWith("[genocide]") && m.includes(id)).length, 1, id);
  }
});

test("scanLiveChain folds the latest report, never marks it read, and says which bonus mark it shows", async () => {
  const dir = tmp();
  const asked = [];
  assert.deepEqual(await g.scanLiveChain(async (id) => { asked.push(id); return REPORT; }, "1001", { dir }), { found: 2, mark: 5000 });
  assert.deepEqual(asked, [null]);
  const file = readStore(dir, "1001");
  assert.deepEqual(file.scanned, {});
  assert.deepEqual(Object.keys(file.hits).sort(), ["1000002", "1000003"]);
  // Nothing new the second time.
  assert.deepEqual(await g.scanLiveChain(async () => REPORT, "1001", { dir }), { found: 0, mark: 5000 });
  // No report, no mark.
  assert.deepEqual(await g.scanLiveChain(async () => null, "1001", { dir }), { found: 0, mark: 0 });
});

// ── The running chain, read only at a new bonus mark ───────────────────

test("markReached: the highest bonus mark worth 1,000+ that a count has reached", () => {
  for (const [n, m] of [[0, 0], [2499, 0], [2500, 2500], [4999, 2500], [5000, 5000], [24999, 10000], [100000, 100000]]) {
    assert.equal(g.markReached(n), m, String(n));
  }
});

test("the live watch reads the running chain only when its count passes a new bonus mark", async () => {
  const dir = tmp();
  let reads = 0;
  const check = g.liveChainWatch(async (id) => { reads++; assert.equal(id, null); return REPORT; }, "1004", { dir });
  const found = [];
  // [the live count, the reads made so far]
  const steps = [[1200, 0], [2499, 0], [2500, 1], [2600, 1], [4999, 1], [5000, 2], [6000, 2],
    // The count drops under 2,500: a new chain, or a member's bad 0. The
    // real count back again costs one read, which covers both marks.
    [0, 2], [5100, 3], [5200, 3],
    [0, 3], [2600, 4]];
  for (const [count, after] of steps) {
    found.push(await check(count));
    assert.equal(reads, after, `after a count of ${count}`);
  }
  // The two holders are new once, on the first read.
  assert.equal(found[2], 2);
  assert.equal(found.reduce((a, b) => a + b, 0), 2);
  assert.deepEqual(Object.keys(readStore(dir, "1004").hits).sort(), ["1000002", "1000003"]);
});

test("a report that does not show the mark yet is read again at the next check, and so is a read that failed", async () => {
  const dir = tmp();
  // Torn's report a few hits behind the count: its last bonus is the 1,000th.
  const BEHIND = { id: 900001, start: 1700000000, bonuses: [
    { attacker_id: 1000001, defender_id: 2000001, chain: 1000, respect: 640 },
  ] };
  let answer = BEHIND, reads = 0;
  const check = g.liveChainWatch(async () => {
    reads++;
    if (answer instanceof Error) throw answer;
    return answer;
  }, "1005", { dir });
  await check(2510);
  assert.equal(reads, 1);
  await check(2520);
  assert.equal(reads, 2);
  answer = REPORT;
  assert.equal(await check(2530), 2);
  assert.equal(reads, 3);
  await check(2540);
  assert.equal(reads, 3);
  // A read that fails reaches the caller, and the next check reads again.
  answer = new Error("Torn API returned HTTP 502");
  await assert.rejects(check(5010), /HTTP 502/);
  assert.equal(reads, 4);
  answer = REPORT;
  await check(5020);
  assert.equal(reads, 5);
  await check(5030);
  assert.equal(reads, 5);
});

test("a member's answer that lands while a scan waits on Torn survives the scan's save", async () => {
  const dir = tmp();
  let release;
  const gate = new Promise((r) => { release = r; });
  const scan = g.scanLiveChain(async () => { await gate; return REPORT; }, "1002", { dir });
  g.recordSelfReport("1002", "1000009", { has: false }, 1700000500, dir);
  release();
  await scan;
  const file = readStore(dir, "1002");
  assert.deepEqual(file.self["1000009"], { has: false, checkedAt: 1700000500 });
  assert.equal(Object.keys(file.hits).length, 2);
});

test("a store file that will not parse loads as empty, and the next save replaces it", () => {
  const dir = tmp();
  writeFileSync(path.join(dir, "genocide-1003.json"), "{");
  assert.deepEqual(g.genocideMembers("1003", dir), {});
  g.recordSelfReport("1003", "1000010", { has: true }, 1700000600, dir);
  assert.deepEqual(readStore(dir, "1003").self["1000010"], { has: true, checkedAt: 1700000600 });
});

// ── The Torn call ──────────────────────────────────────────────────────

test("fetchChainReport asks for one chain by id, or for the latest chain without one", async () => {
  const urls = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    urls.push(String(url));
    return { ok: true, json: async () => ({ chainreport: { id: 900001, bonuses: [] } }) };
  };
  try {
    assert.deepEqual(await fh.fetchChainReport("TESTKEY", 900001), { id: 900001, bonuses: [] });
    assert.deepEqual(await fh.fetchChainReport("TESTKEY", null), { id: 900001, bonuses: [] });
  } finally {
    globalThis.fetch = realFetch;
  }
  // The chain's id goes in the path, as chain-hits.js asks.
  assert.match(urls[0], /^https:\/\/api\.torn\.com\/v2\/faction\/900001\/chainreport\?key=TESTKEY&/);
  assert.match(urls[1], /^https:\/\/api\.torn\.com\/v2\/faction\/chainreport\?key=TESTKEY&/);
});

// ── The wiring (text checks: the tests never import server.js) ─────────

test("the routes: a member posts their own answer, and reads their faction's list", () => {
  const ROUTES = readFileSync(new URL("./routes.js", import.meta.url), "utf8");
  assert.match(ROUTES, /router\.post\("\/api\/me\/honors", requireAuth,/);
  assert.match(ROUTES, /router\.get\("\/api\/genocide", requireAuth,/);
  assert.match(ROUTES, /parseSelfReport\(req\.body \|\| \{\}\)/);
  const post = ROUTES.slice(ROUTES.indexOf('router.post("/api/me/honors"'));
  assert.match(post.slice(0, post.indexOf("\n});\n")), /res\.status\(400\)/);
});

test("the daily faction-history tick reads finished big chains from the chain list it already fetched", () => {
  const S = readFileSync(new URL("./faction-history-schedule.js", import.meta.url), "utf8");
  assert.match(S, /scanFinishedChains\(\(id\) => fh\.fetchChainReport\(key, id\), factionId, chains/);
  // The list is fetched once, before both steps.
  assert.equal(S.match(/fh\.fetchAllChains\(key\)/g).length, 1);
});

test("the server starts the live watch on the chain count it stores", () => {
  const SERVER = readFileSync(new URL("./server.js", import.meta.url), "utf8");
  assert.match(SERVER, /^import \{ startGenocideSchedule \} from "\.\/genocide\.js";$/m);
  assert.match(SERVER, /^startGenocideSchedule\(\{ chainCount: \(factionId\) => store\.getWar\(`war_\$\{factionId\}`\)\?\.chainData\?\.current \}\);$/m);
});
