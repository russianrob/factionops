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

test("parseSelfReport takes true, false or null, and nothing else", () => {
  assert.deepEqual(g.parseSelfReport({ genocide: true, awardedAt: 1690000000 }), { has: true, at: 1690000000 });
  assert.deepEqual(g.parseSelfReport({ genocide: true }), { has: true, at: null });
  assert.deepEqual(g.parseSelfReport({ genocide: true, awardedAt: "x" }), { has: true, at: null });
  assert.deepEqual(g.parseSelfReport({ genocide: true, awardedAt: -5 }), { has: true, at: null });
  assert.deepEqual(g.parseSelfReport({ genocide: false, awardedAt: 1690000000 }), { has: false, at: null });
  assert.deepEqual(g.parseSelfReport({ genocide: null }), { has: null, at: null });
  for (const b of [{}, { genocide: "true" }, { genocide: 1 }, null, undefined, "x"]) {
    assert.equal(g.parseSelfReport(b), null);
  }
});

test("genocideView: a faction hit beats a self 'no', a self 'yes' counts, a 'no' keeps its date, a withdrawal forgets", () => {
  const s = empty();
  g.foldHits(s, g.bonusHolders(REPORT));
  g.foldSelf(s, "1000002", { has: false, at: null }, 1650000000); // an old "no", from before the hit
  g.foldSelf(s, "1000005", { has: true, at: 1690000000 }, 1700000100);
  g.foldSelf(s, "1000006", { has: false, at: null }, 1700000200);
  g.foldSelf(s, "1000007", { has: true, at: null }, 1700000300);
  assert.deepEqual(g.genocideView(s), {
    1000002: { has: true, via: "hit", hit: 2500, start: 1700000000 },
    1000003: { has: true, via: "hit", hit: 5000, start: 1700000000 },
    1000005: { has: true, via: "self", at: 1690000000 },
    1000006: { has: false, checkedAt: 1700000200 },
    1000007: { has: true, via: "self", at: null },
  });
  g.foldSelf(s, "1000006", { has: null, at: null }, 1700000400);
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
    900020: { id: 900020, start: 1750000000, bonuses: [{ attacker_id: 1000011, chain: 2500, respect: 1280 }] },
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
  await g.scanFinishedChains(async (id) => { asked.push(id); return null; }, "1004", chains, { nowS: now, dir, budget: 2 });
  assert.equal(asked.length, 2);
});

test("scanLiveChain folds the latest report and never marks it read", async () => {
  const dir = tmp();
  const asked = [];
  assert.equal(await g.scanLiveChain(async (id) => { asked.push(id); return REPORT; }, "1001", { dir }), 2);
  assert.deepEqual(asked, [null]);
  const file = readStore(dir, "1001");
  assert.deepEqual(file.scanned, {});
  assert.deepEqual(Object.keys(file.hits).sort(), ["1000002", "1000003"]);
  // Nothing new the second time.
  assert.equal(await g.scanLiveChain(async () => REPORT, "1001", { dir }), 0);
});

test("a member's answer that lands while a scan waits on Torn survives the scan's save", async () => {
  const dir = tmp();
  let release;
  const gate = new Promise((r) => { release = r; });
  const scan = g.scanLiveChain(async () => { await gate; return REPORT; }, "1002", { dir });
  g.recordSelfReport("1002", "1000009", { has: false, at: null }, 1700000500, dir);
  release();
  await scan;
  const file = readStore(dir, "1002");
  assert.deepEqual(file.self["1000009"], { has: false, at: null, checkedAt: 1700000500 });
  assert.equal(Object.keys(file.hits).length, 2);
});

test("a store file that will not parse loads as empty, and the next save replaces it", () => {
  const dir = tmp();
  writeFileSync(path.join(dir, "genocide-1003.json"), "{");
  assert.deepEqual(g.genocideMembers("1003", dir), {});
  g.recordSelfReport("1003", "1000010", { has: true, at: null }, 1700000600, dir);
  assert.deepEqual(readStore(dir, "1003").self["1000010"], { has: true, at: null, checkedAt: 1700000600 });
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
  assert.match(urls[0], /^https:\/\/api\.torn\.com\/v2\/faction\/chainreport\?id=900001&key=TESTKEY&/);
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

test("the server starts the live scan", () => {
  const SERVER = readFileSync(new URL("./server.js", import.meta.url), "utf8");
  assert.match(SERVER, /^import \{ startGenocideSchedule \} from "\.\/genocide\.js";$/m);
  assert.match(SERVER, /^startGenocideSchedule\(\);$/m);
});
