// Chain alerts outside a war.
//
// Reported: "for chain alerts please alert chain dying if chain is greater
// 100 outside the war because we lost chain because we stopped getting
// alerts". On 2026-10-26 a war ended and the faction chained on for seven
// hours, and the chain died with no alert: the chain monitor stopped at the
// war's end, it turned FactionOps' chain reports away after it, and the push
// sender dropped chain alerts outside a war. A restart would not have
// brought them back either: the boot revive skipped an ended war that a Live
// Activity token named.
//
// Now, outside a live war (after it, before kickoff) a chain of 100 or more
// gets the same CHAIN BREAKING / CHAIN DYING alerts and bonus warnings as in
// a war, and one quiet "Chain ended at N" notice when it ends. In a war
// nothing changes. The rule is chain-alert-rule.js. These tests run it, and
// the parts of chain-monitor.js, push-notifications.js and server.js that use
// it, lifted out of this checkout's copies and run against stubs, so nothing
// here reads live data or sends a push. Numbers and ids are made up.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as path from "node:path";
import * as rule from "./chain-alert-rule.js";
import { normalizeChainData, chainWithLiveTimeout } from "./chain-data.js";
import { bonusToAnnounce } from "./chain-bonus.js";

const read = (name) => readFileSync(new URL(`./${name}`, import.meta.url), "utf8");
const MONITOR = read("chain-monitor.js");
const PUSH = read("push-notifications.js");
const SERVER = read("server.js");

// From an opening bracket at `start`, the index of the one that closes it.
function closer(src, start) {
  const open = src[start];
  const close = open === "(" ? ")" : "}";
  let depth = 0;
  for (let i = start; i < src.length; i++) {
    if (src[i] === open) depth++;
    else if (src[i] === close && --depth === 0) return i;
  }
  throw new Error(`unbalanced ${open} at ${start}`);
}

// A function's text, found by name, without `export`; "" when the file has
// none, so a test of a function not written yet fails on its own call.
function lift(src, name) {
  const m = new RegExp(`^(?:export )?(?:async )?function ${name}\\(`, "m").exec(src);
  if (!m) return "";
  const body = src.indexOf("{", closer(src, m.index + m[0].length - 1));
  return src.slice(m.index, closer(src, body) + 1).replace(/^export /, "");
}

// The module-level lines the lifted functions read: number constants, the
// per-war Maps and the poll cursor, taken from the file itself.
function moduleLines(src) {
  return [
    ...[...src.matchAll(/^const ([A-Z][A-Z0-9_]*) = ([\d_.]+);/gm)].map((m) => `const ${m[1]} = ${m[2]};`),
    ...[...src.matchAll(/^const (\w+) = new Map\(\);/gm)].map((m) => `const ${m[1]} = new Map();`),
    ...[...src.matchAll(/^let (\w+) = (\d+);/gm)].map((m) => `let ${m[1]} = ${m[2]};`),
  ];
}

// The lifted text must load no real module. chain-monitor.js reaches
// routes.js, the push sender store.js, and server.js node:fs, node:path and
// the Live Activity store, all by dynamic import: each becomes a stub the
// test passes in, and any other import fails the test.
function stubImports(text) {
  const out = text
    .replace(/await import\("\.\/live-activity-tokens\.js"\)/g, "({})")
    .replace(/await import\("node:fs"\)/g, "__fs")
    .replace(/await import\("node:path"\)/g, "__path")
    .replace(/await import\('\.\/store\.js'\)/g, "__store")
    .replace(/import\("\.\/routes\.js"\)/g, "__routes()")
    .replace(/import\.meta\.url/g, "__moduleUrl");
  assert.doesNotMatch(out, /\bimport\s*\(|import\.meta/, "a dynamic import is left in the lifted text");
  return out;
}

// Run `body` with each of `deps` in scope under its own name.
const make = (deps, body) => new Function(...Object.keys(deps), body)(...Object.values(deps));

const nowS = () => Math.floor(Date.now() / 1000);
const liveWar = () => ({ factionId: "1000", warStart: nowS() - 3_600 });
const endedWar = () => ({ factionId: "1000", warStart: nowS() - 86_400, warEnded: true, warEndedAt: Date.now() - 3_600_000 });
const comingWar = (kickoffInS) => ({ factionId: "1000", warStart: nowS() + kickoffInS });
// The reading before the next one: `current` hits, `agoMs` ago, with `leftS`
// seconds then on the chain's clock.
function lastRead(war, current, leftS, agoMs) {
  const at = Date.now() - agoMs;
  war.chainData = normalizeChainData({ current, timeout: leftS, cooldown: 0 }, at);
  war.chainDataUpdatedAt = at;
  return war;
}
// A reading as Torn gives it. A chain that has ended keeps its count, with
// timeout 0 and a cooldown of about 6 s a hit, and reads 0 only once the
// cooldown is over.
const reading = (current, timeout, cooldown = 0) => ({ current, timeout, cooldown });

// ── The rule ────────────────────────────────────────────────────────────

const T = 2_000_000_000_000; // a fixed moment, in ms
const at = (startInS, extra = {}) => ({ factionId: "1000", warStart: T / 1000 + startInS, ...extra });

test("a war is live from kickoff until it ends, and a record with no start counts as started", () => {
  assert.equal(rule.isWarLive(at(-3_600), T), true);
  assert.equal(rule.isWarLive(at(0), T), true, "kickoff itself");
  assert.equal(rule.isWarLive(at(60), T), false);
  assert.equal(rule.isWarLive(at(-86_400, { warEnded: true }), T), false);
  assert.equal(rule.isWarLive({ factionId: "1000" }, T), true);
  assert.equal(rule.isWarLive(undefined, T), false);
});

test("chains are alerted from 10 hits in a live war, and from 100 after one or before kickoff", () => {
  assert.equal(rule.chainAlertFloor(at(-3_600), T), 10);
  assert.equal(rule.chainAlertFloor(at(-86_400, { warEnded: true }), T), 100);
  assert.equal(rule.chainAlertFloor(at(3_600), T), 100);
});

test("outside a war the chain is read every 2 minutes under 100, and at the war's pace from 100", () => {
  const after = (current) => at(-86_400, { warEnded: true, chainData: { current } });
  assert.equal(rule.outsideWarDelay(after(99), T, 15_000, Infinity), 120_000);
  assert.equal(rule.outsideWarDelay(after(100), T, 15_000, Infinity), 15_000);
  assert.equal(rule.outsideWarDelay(after(0), T, 15_000, 299_999), 15_000, "within 5 minutes of a reading of 100+");
  assert.equal(rule.outsideWarDelay(after(0), T, 15_000, 300_000), 120_000);
});

test("before kickoff the next read is never later than kickoff, nor sooner than 5 s", () => {
  assert.equal(rule.outsideWarDelay(at(30), T, 15_000, Infinity), 30_000);
  assert.equal(rule.outsideWarDelay(at(2), T, 15_000, Infinity), 5_000);
  assert.equal(rule.outsideWarDelay(at(3_600), T, 15_000, Infinity), 120_000);
  assert.equal(rule.outsideWarDelay(at(10, { chainData: { current: 1234 } }), T, 15_000, Infinity), 10_000);
});

test("a 100+ chain may have ended when its cooldown starts after a reading with 30 s or less left, at most 3 minutes old", () => {
  const ended = (o) => rule.outsideWarChainEnded({ prevCurrent: 1234, prevTimeoutS: 5, prevCooldown: 0, prevAgeMs: 15_000, current: 1234, cooldown: 7_404, ...o });
  assert.equal(ended({}), true);
  assert.equal(ended({ prevTimeoutS: 30, prevAgeMs: 180_000 }), true);
  assert.equal(ended({ prevTimeoutS: 0 }), true, "Torn's last reading before the cooldown can show the clock at 0");
  assert.equal(ended({ cooldown: 0 }), false, "no cooldown: a chain never ends with a reading of 0");
  assert.equal(ended({ cooldown: 1_793_052_168 }), false, "a cooldown sent as a date, not a duration");
  assert.equal(ended({ prevTimeoutS: 285 }), false, "minutes left on the clock");
  assert.equal(ended({ prevAgeMs: 180_001 }), false, "a record from before a restart");
  assert.equal(ended({ prevTimeoutS: undefined }), false, "no clock on the reading before");
  assert.equal(ended({ prevCooldown: 7_394, prevTimeoutS: 0 }), false, "the reading before was in its cooldown already");
  assert.equal(ended({ prevCurrent: 99 }), false);
  assert.equal(ended({ current: 99 }), false);
});

test("outside a war, a chain in its cooldown is read every 2 minutes, though it keeps its count", () => {
  const cooling = at(-86_400, { warEnded: true, chainData: { current: 1234, cooldown: 7_404 } });
  assert.equal(rule.outsideWarDelay(cooling, T, 15_000, Infinity), 120_000);
  assert.equal(rule.outsideWarDelay(cooling, T, 15_000, 60_000), 15_000, "within 5 minutes of the last reading of a running chain of 100+");
});

test("outside a war, a reading under 100 while a 100+ chain's clock still runs is a bad reading", () => {
  const bad = (o) => rule.outsideWarBadDrop({ prevCurrent: 1234, prevTimeoutS: 200, current: 0, ...o });
  assert.equal(bad({}), true);
  assert.equal(bad({ prevTimeoutS: 5 }), true, "in its last seconds too: a chain ends with its cooldown, never with a 0");
  assert.equal(bad({ current: 3 }), true);
  assert.equal(bad({ prevTimeoutS: 0 }), false, "its clock has run out");
  assert.equal(bad({ prevTimeoutS: undefined }), false, "no clock on the reading before");
  assert.equal(bad({ prevTimeoutS: 1_793_052_168 }), false, "a clock no chain has: Torn's never reads over 5 minutes");
  assert.equal(bad({ prevCurrent: 99 }), false);
  assert.equal(bad({ current: 100 }), false);
});

// ── The push sender ─────────────────────────────────────────────────────

const PUSH_FNS = ["hasWarStarted", "hasWarEnded", "chainFloorForWar", "notifyChainAlert", "notifyChainPanic", "notifyBonusImminent", "notifyChainEnded"];
const PLAYERS = [{ id: "1000001" }, { id: "1000002" }, { id: "1000003" }]; // 1000003 has no push channel

function buildPush(wars) {
  const sends = [];
  const deps = {
    __store: { getWar: (id) => wars[id] },
    sendToPlayers: async (ids, payload, type, options) => { sends.push({ ids, payload, type, options }); },
    hasAnyPushChannel: (id) => id !== "1000003",
    ...rule,
  };
  const fns = PUSH_FNS.filter((n) => lift(PUSH, n));
  const api = make(deps, [...fns.map((n) => stubImports(lift(PUSH, n))), `return { ${fns.join(", ")} };`].join("\n"));
  return { api, sends };
}

test("outside a war, CHAIN DYING and CHAIN BREAKING go out for a chain of 100 or more, to members with a push channel", async () => {
  const { api, sends } = buildPush({ w1: endedWar() });
  await api.notifyChainPanic(PLAYERS, "w1", 1234, 25);
  await api.notifyChainAlert(PLAYERS, "w1", 100, 50, 50);
  assert.deepEqual(sends.map((s) => s.payload.tag), ["chain-panic", "chain-alert"]);
  assert.deepEqual(sends[0].ids, ["1000001", "1000002"]);
  assert.equal(sends[0].payload.title, "🔴 CHAIN DYING! 25s!");
  assert.deepEqual([sends[0].type, sends[0].options], ["chain_alert", { urgency: "high", TTL: 15 }]);
});

test("outside a war, a chain under 100 gets no chain alert", async () => {
  const { api, sends } = buildPush({ w1: endedWar(), w2: comingWar(3_600) });
  for (const w of ["w1", "w2"]) {
    await api.notifyChainPanic(PLAYERS, w, 99, 25);
    await api.notifyChainAlert(PLAYERS, w, 99, 50, 50);
  }
  assert.equal(sends.length, 0);
});

test("before kickoff, a chain of 100 or more gets CHAIN DYING", async () => {
  const { api, sends } = buildPush({ w1: comingWar(3_600) });
  await api.notifyChainPanic(PLAYERS, "w1", 1234, 25);
  assert.deepEqual(sends.map((s) => s.payload.tag), ["chain-panic"]);
});

test("in a war, chain alerts go out from 10 hits, as before", async () => {
  const { api, sends } = buildPush({ w1: liveWar() });
  await api.notifyChainPanic(PLAYERS, "w1", 10, 25);
  await api.notifyChainPanic(PLAYERS, "w1", 9, 25);
  assert.equal(sends.length, 1);
  assert.match(sends[0].payload.body, /^Chain 10 /);
});

test("bonus warnings follow the same rule, after a war and before kickoff", async () => {
  const { api, sends } = buildPush({ w1: endedWar(), w2: comingWar(3_600) });
  for (const w of ["w1", "w2"]) {
    await api.notifyBonusImminent(PLAYERS, w, 246, 250);
    await api.notifyBonusImminent(PLAYERS, w, 46, 50);
  }
  assert.deepEqual(sends.map((s) => s.payload.body), ["Chain at 246/250 — bonus hit incoming!", "Chain at 246/250 — bonus hit incoming!"]);
});

test("a war with no record gets no chain alert", async () => {
  const { api, sends } = buildPush({});
  await api.notifyChainPanic(PLAYERS, "gone", 1234, 25);
  await api.notifyBonusImminent(PLAYERS, "gone", 246, 250);
  assert.equal(sends.length, 0);
});

test("the chain-ended notice is quiet, clears the pinned chain alerts, and says where the chain stopped", async () => {
  const { api, sends } = buildPush({ w1: endedWar() });
  await api.notifyChainEnded(PLAYERS, "w1", 1234);
  assert.deepEqual(sends, [{
    ids: ["1000001", "1000002"],
    payload: { title: "Chain ended at 1,234", body: "Chain alerts cleared.", tag: "chain-cleared", icon: "/icon-192.png", data: { type: "clear-chain-alerts", warId: "w1" } },
    type: "chain_alert",
    options: { urgency: "low", TTL: 60 },
  }]);
});

// ── The chain monitor ───────────────────────────────────────────────────

const MONITOR_FNS = ["warScoreCheckInterval", "pushAudience", "_processChain", "recordClientChainData", "startChainMonitor"];
const AUDIENCE = [{ id: "1000001" }, { id: "1000002" }];

// `chainReading` is what Torn's chain call returns to the loop.
function buildMonitor(wars, chainReading = reading(0, 0)) {
  const seen = { sends: [], la: [], chainReads: 0, scoreReads: 0, stops: 0, logs: [] };
  let settle;
  const settled = new Promise((r) => { settle = r; });
  const log = (...a) => { seen.logs.push(a.join(" ")); };
  const pushStub = (name) => (...args) => { seen.sends.push([name, ...args]); return Promise.resolve(); };
  const deps = {
    store: {
      getWar: (id) => wars[id],
      saveState() {},
      getPollingKey: () => "test-key",
      getPlayerIdsForFaction: () => AUDIENCE.map((p) => p.id),
      quarantinePoolKey() {},
      demotePoolKeySelection() {},
      getOrCreateWar() {},
    },
    push: Object.fromEntries(["notifyChainPanic", "notifyChainAlert", "notifyBonusImminent", "notifyChainEnded",
      "notifyClearChainAlerts", "notifyWarTargetReached"].map((n) => [n, pushStub(n)])),
    liveActivityTokens: { listForWar: () => [] },
    console: { log, warn: log, error: log },
    // The loop's next tick: recorded, never run.
    setTimeout: (fn, ms) => { settle({ waitMs: ms }); return 1; },
    nextChain: () => 15_000,
    stopChainMonitor: () => { seen.stops++; settle({ stopped: true }); },
    broadcastChainLiveActivity: (...args) => { seen.la.push(args); return Promise.resolve(); },
    fetchFactionChain: async () => { seen.chainReads++; return { ...chainReading }; },
    fetchRankedWar: async () => { seen.scoreReads++; return null; },
    __routes: async () => ({ broadcastSSE() {} }),
    normalizeChainData, chainWithLiveTimeout, bonusToAnnounce, ...rule,
  };
  const fns = MONITOR_FNS.filter((n) => lift(MONITOR, n));
  const maps = [...MONITOR.matchAll(/^const (\w+) = new Map\(\);/gm)].map((m) => m[1]);
  const api = make(deps, [...moduleLines(MONITOR), ...fns.map((n) => stubImports(lift(MONITOR, n))),
    `return { ${fns.join(", ")}, maps: { ${maps.join(", ")} } };`].join("\n"));
  // One tick of the poll loop: start the monitor, and wait for it to set its
  // next tick, or to stop.
  api.firstTick = async (warId = "w1") => {
    let timer;
    const hung = new Promise((r) => { timer = globalThis.setTimeout(() => r({ hung: true }), 2_000); });
    api.startChainMonitor(null, warId);
    const out = await Promise.race([settled, hung]);
    globalThis.clearTimeout(timer);
    return out;
  };
  return { api, seen };
}

// The chain-ended notice waits a minute for the count to hold. This moves
// the start of that wait back by `ms`, as if that long had gone by; it does
// nothing when no end is waiting.
function backdate(api, warId, ms) {
  const pending = api.maps.pendingChainEnd?.get(warId);
  if (pending) pending.since -= ms;
}

test("outside a war, a chain of 100 or more with 25 s left gets CHAIN DYING, and one under 100 gets nothing", async () => {
  const big = lastRead(endedWar(), 1234, 40, 15_000);
  const small = lastRead(endedWar(), 99, 40, 15_000);
  const { api, seen } = buildMonitor({ w1: big, w2: small });
  await api._processChain("w1", big, reading(1234, 25), null, "poll");
  await api._processChain("w2", small, reading(99, 25), null, "poll");
  assert.deepEqual(seen.sends.map((s) => s.slice(0, 1).concat(s.slice(2, 5))), [["notifyChainPanic", "w1", 1234, 25]]);
});

test("in a war, a chain of 10 with 25 s left gets CHAIN DYING, as before", async () => {
  const war = lastRead(liveWar(), 10, 40, 15_000);
  const { api, seen } = buildMonitor({ w1: war });
  await api._processChain("w1", war, reading(10, 25), null, "poll");
  assert.deepEqual(seen.sends.map((s) => s[0]), ["notifyChainPanic"]);
});

test("outside a war, a bonus warning goes out for a chain of 100 or more and not for a smaller one", async () => {
  const big = lastRead(endedWar(), 241, 280, 15_000);
  const small = lastRead(endedWar(), 44, 280, 15_000);
  const { api, seen } = buildMonitor({ w1: big, w2: small });
  await api._processChain("w1", big, reading(246, 290), null, "poll");
  await api._processChain("w2", small, reading(46, 290), null, "poll");
  assert.deepEqual(seen.sends.map((s) => s.slice(0, 1).concat(s.slice(2, 5))), [["notifyBonusImminent", "w1", 246, 250]]);
});

test("outside a war, a 100+ chain's end sends one quiet notice once its count has held a minute in its cooldown, naming the final count", async () => {
  const war = lastRead(endedWar(), 1234, 20, 15_000); // 5 s left on its clock now
  const { api, seen } = buildMonitor({ w1: war });
  await api._processChain("w1", war, reading(1235, 0, 7_410), null, "poll"); // one more hit, then its clock ran out
  await api._processChain("w1", war, reading(1235, 0, 7_400), null, "poll");
  assert.deepEqual(seen.sends, [], "not yet: the count has to hold for a minute");
  backdate(api, "w1", 61_000);
  await api._processChain("w1", war, reading(0, 0), null, "client"); // a bad 0 in the cooldown
  await api._processChain("w1", war, reading(1235, 0, 7_350), null, "poll");
  await api._processChain("w1", war, reading(1235, 0, 7_340), null, "poll");
  await api._processChain("w1", war, reading(0, 0), null, "poll"); // the cooldown is over
  assert.deepEqual(seen.sends, [["notifyChainEnded", AUDIENCE, "w1", 1235]]);
  assert.ok(seen.logs.includes("[chain] Chain ended outside a war at 1235 (poll)"), seen.logs.join("\n"));
});

test("outside a war, the end is noticed though Torn's last reading before the cooldown shows the clock at 0", async () => {
  const war = lastRead(endedWar(), 1234, 0, 10_000); // the count kept, no time left, no cooldown yet
  const { api, seen } = buildMonitor({ w1: war });
  await api._processChain("w1", war, reading(1234, 0, 7_404), null, "poll");
  backdate(api, "w1", 61_000);
  await api._processChain("w1", war, reading(1234, 0, 7_394), null, "poll");
  assert.deepEqual(seen.sends, [["notifyChainEnded", AUDIENCE, "w1", 1234]]);
});

test("a chain's end is noticed once, though a stale report of its running clock comes in after the notice", async () => {
  const war = lastRead(endedWar(), 1234, 20, 15_000);
  const { api, seen } = buildMonitor({ w1: war });
  await api._processChain("w1", war, reading(1234, 0, 7_404), null, "poll");
  backdate(api, "w1", 61_000);
  await api._processChain("w1", war, reading(1234, 0, 7_394), null, "poll"); // the notice
  await api._processChain("w1", war, reading(1234, 25), null, "client"); // a report from before the end
  await api._processChain("w1", war, reading(1234, 0, 7_384), null, "poll");
  backdate(api, "w1", 61_000);
  await api._processChain("w1", war, reading(1234, 0, 7_374), null, "poll");
  assert.equal(seen.sends.filter((s) => s[0] === "notifyChainEnded").length, 1);
});

test("a reading with time on the chain's clock calls off the notice", async () => {
  const war = lastRead(endedWar(), 1234, 20, 15_000);
  const { api, seen } = buildMonitor({ w1: war });
  await api._processChain("w1", war, reading(1234, 0, 7_404), null, "poll");
  backdate(api, "w1", 61_000);
  await api._processChain("w1", war, reading(1234, 25), null, "poll"); // its clock is back
  await api._processChain("w1", war, reading(1234, 0, 7_394), null, "poll");
  assert.deepEqual(seen.sends.filter((s) => s[0] === "notifyChainEnded"), []);
});

test("no notice when Torn reports a cooldown while the hits still count, as it did for five minutes on 2026-10-26", async () => {
  const war = lastRead(endedWar(), 1234, 20, 15_000); // 5 s left on its clock now
  const { api, seen } = buildMonitor({ w1: war });
  await api._processChain("w1", war, reading(1234, 0, 7_404), null, "poll"); // looks like the end
  await api._processChain("w1", war, reading(1237, 0, 7_422), null, "poll"); // but the hits still count
  backdate(api, "w1", 61_000);
  await api._processChain("w1", war, reading(1234, 0, 7_390), null, "client"); // a member's older report
  await api._processChain("w1", war, reading(1240, 0, 7_428), null, "poll");
  await api._processChain("w1", war, reading(1242, 5), null, "poll"); // its clock is back
  assert.deepEqual(seen.sends.filter((s) => s[0] === "notifyChainEnded"), []);
});

test("before kickoff, a 100+ chain's end sends the notice too", async () => {
  const war = lastRead(comingWar(3_600), 1234, 20, 15_000);
  const { api, seen } = buildMonitor({ w1: war });
  await api._processChain("w1", war, reading(1234, 0, 7_404), null, "client");
  backdate(api, "w1", 61_000);
  await api._processChain("w1", war, reading(1234, 0, 7_394), null, "client");
  assert.deepEqual(seen.sends.map((s) => s[0]), ["notifyChainEnded"]);
});

test("no notice for a bad reading of 0, for a record from before a restart, or in a war", async () => {
  const blip = lastRead(endedWar(), 1234, 20, 5_000); // 15 s left on its clock now
  const stale = lastRead(endedWar(), 1234, 20, 18 * 3_600_000);
  const inWar = lastRead(liveWar(), 1234, 20, 15_000);
  const { api, seen } = buildMonitor({ w1: blip, w2: stale, w3: inWar });
  await api._processChain("w1", blip, reading(0, 0), null, "client");
  await api._processChain("w1", blip, reading(1235, 290), null, "client");
  for (const [id, war] of [["w2", stale], ["w3", inWar]]) {
    await api._processChain(id, war, reading(1234, 0, 7_404), null, "poll");
    backdate(api, id, 61_000);
    await api._processChain(id, war, reading(1234, 0, 7_394), null, "poll");
  }
  assert.deepEqual(seen.sends, []);
});

test("outside a war, a bad reading of 0 is turned away, so the chain's CHAIN DYING still goes out", async () => {
  const war = lastRead(endedWar(), 1234, 100, 75_000); // 25 s left on its clock now
  const { api, seen } = buildMonitor({ w1: war });
  assert.equal(await api.recordClientChainData("w1", reading(0, 0)), false);
  assert.equal(war.chainData.current, 1234);
  await api._processChain("w1", war, reading(1234, 25), null, "client");
  assert.deepEqual(seen.sends.map((s) => s[0]), ["notifyChainPanic"]);
  assert.ok(seen.logs.includes("[chain/client] war=w1 ignored a reading of 0: the chain read 1234 with 25s left"), seen.logs.join("\n"));
});

test("in a war, a reading of 0 is taken as before", async () => {
  const war = lastRead(liveWar(), 1234, 100, 75_000);
  const { api } = buildMonitor({ w1: war });
  await api._processChain("w1", war, reading(0, 0), null, "client");
  assert.equal(war.chainData.current, 0);
});

test("the iOS Live Activity stays with the war: readings after a war update nothing, readings in one do", async () => {
  const after = lastRead(endedWar(), 1234, 200, 15_000);
  const during = lastRead(liveWar(), 1234, 200, 15_000);
  const { api, seen } = buildMonitor({ w1: after, w2: during });
  await api._processChain("w1", after, reading(1240, 290), null, "poll");
  await api._processChain("w2", during, reading(1240, 290), null, "poll");
  assert.deepEqual(seen.la.map((a) => a[0]), ["w2"]);
});

test("after a war, FactionOps' chain reports are taken in", async () => {
  const war = lastRead(endedWar(), 1234, 200, 15_000);
  const { api } = buildMonitor({ w1: war });
  assert.equal(await api.recordClientChainData("w1", { ...reading(1240, 290), serverTimestamp: nowS() }), true);
  assert.equal(war.chainData.current, 1240);
  assert.equal(await api.recordClientChainData("gone", reading(1240, 290)), false, "no war, no report");
});

test("the first tick after a war ends keeps watching, and clears the war's scores and its target alert", async () => {
  const war = { ...endedWar(), warScores: { myScore: 5678, enemyScore: 1234 } };
  const { api, seen } = buildMonitor({ w1: war });
  api.maps.warTargetNotified.set("w1", true);
  const tick = await api.firstTick();
  assert.equal(seen.stops, 0);
  assert.equal(typeof tick.waitMs, "number");
  assert.equal(war.warScores, undefined);
  assert.equal(api.maps.warTargetNotified.has("w1"), false, "the next war on this record gets its own target alert");
  assert.ok(seen.logs.includes("[chain] war w1 ended — watching the chain outside the war (alerts from 100 hits)"), seen.logs.join("\n"));
});

test("after a war, each tick reads the chain and never the war's score", async () => {
  const { api, seen } = buildMonitor({ w1: endedWar() });
  await api.firstTick();
  assert.deepEqual([seen.chainReads, seen.scoreReads], [1, 0]);
});

test("outside a war, a chain under 100 is read again in 2 minutes, and one of 100 or more at the war's pace", async () => {
  const quiet = buildMonitor({ w1: endedWar() }, reading(99, 200));
  const busy = buildMonitor({ w1: endedWar() }, reading(1234, 200));
  assert.deepEqual(await quiet.api.firstTick(), { waitMs: 120_000 });
  assert.deepEqual(await busy.api.firstTick(), { waitMs: 15_000 });
});

test("for 5 minutes after a reading of 100 or more, the war's pace holds though the chain reads less", async () => {
  const war = endedWar();
  const { api } = buildMonitor({ w1: war }, reading(0, 0));
  await api._processChain("w1", war, reading(1234, 200), null, "client");
  war.chainData.chainEndsAt = Date.now() - 1_000; // its clock has run out since, so a low reading stands
  war.chainDataUpdatedAt = Date.now() - 60_000; // no fresh client report, so the tick reads the chain itself
  assert.deepEqual(await api.firstTick(), { waitMs: 15_000 });
});

test("after a war, the monitor reads a chain in its cooldown every 2 minutes", async () => {
  const { api } = buildMonitor({ w1: endedWar() }, reading(1234, 0, 7_404));
  assert.deepEqual(await api.firstTick(), { waitMs: 120_000 });
});

test("before kickoff the chain is read too, and the next tick comes no later than kickoff", async () => {
  const { api, seen } = buildMonitor({ w1: comingWar(30) });
  const tick = await api.firstTick();
  assert.equal(seen.chainReads, 1);
  assert.ok(tick.waitMs <= 30_000 && tick.waitMs >= 28_000, `waited ${tick.waitMs} ms`);
});

test("in a war, the next tick is at the war's pace whatever the chain, as before", async () => {
  const quiet = buildMonitor({ w1: liveWar() }, reading(0, 0));
  const busy = buildMonitor({ w1: liveWar() }, reading(1234, 200));
  assert.deepEqual(await quiet.api.firstTick(), { waitMs: 15_000 });
  assert.deepEqual(await busy.api.firstTick(), { waitMs: 15_000 });
});

// ── A restart ───────────────────────────────────────────────────────────

// server.js resumes the chain watches at boot in one anonymous block. This
// lifts it out by the Set it starts with and runs it against stub files.
function bootResume(wars, tokenRows) {
  const mark = SERVER.indexOf("const seen = new Set();");
  const start = SERVER.lastIndexOf("(async () => {", mark);
  assert.ok(mark > 0 && start > 0, "the boot resume block is not where this test looks for it");
  const text = SERVER.slice(start, closer(SERVER, SERVER.indexOf("{", start)) + 1) + ")()";
  const started = [];
  const deps = {
    store: { getWar: (id) => wars[id], getAllWars: () => wars },
    startChainMonitor: (io, warId) => { started.push(warId); },
    console: { log() {}, warn() {} },
    __fs: { existsSync: () => true, readFileSync: () => JSON.stringify(tokenRows) },
    __path: path,
    __moduleUrl: "file:///srv/warboard/server/server.js",
  };
  return make(deps, `return ${stubImports(text)};`).then(() => started);
}

test("a restart resumes the watch on a war that has ended, even when a Live Activity token names it", async () => {
  const wars = { war_1000: endedWar() };
  assert.deepEqual(await bootResume(wars, [{ warId: "war_1000", playerId: "1000001", token: "t" }]), ["war_1000"]);
  assert.deepEqual(await bootResume(wars, []), ["war_1000"]);
});

test("a restart starts a live war's watch once, from its Live Activity tokens", async () => {
  const wars = { war_1000: liveWar() };
  assert.deepEqual(await bootResume(wars, [{ warId: "war_1000" }, { warId: "war_1000" }]), ["war_1000"]);
});
