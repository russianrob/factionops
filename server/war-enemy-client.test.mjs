// A member's FactionOps can no longer change a war's enemy.
//
// Every Tuesday, from the matchup to kickoff, war_<faction> flipped between
// the next war's enemy and the last one's about once a minute. Warboard's own
// Torn checks set the new enemy, and each FactionOps connect (the stream, the
// two polls, join_war) passed the enemy that member's script still
// remembered into getOrCreateWar, which reset the record on any difference.
// Each reset wiped the chain, the calls and the war's start, so the next
// chain reading looked like a fresh chain and low timers were held back.
//
// Now only warboard's own checks change an enemy. A connect may create a
// record, or fill in an enemy the record lacks, but never change one. These
// tests lift getOrCreateWar out of this checkout's store.js and run it
// against stubs, and read the callers' files as text, so nothing here reads
// or writes live data. Ids and numbers are made up.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (name) => readFileSync(new URL(`./${name}`, import.meta.url), "utf8");
const STORE = read("store.js");

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

// A module-level `const NAME = ...;` line, or "" when the file has none.
function constLine(src, name) {
  const m = new RegExp(`^const ${name} = [^\\n]*;`, "m").exec(src);
  return m ? m[0] : "";
}

// getOrCreateWar with its collaborators stubbed: `wars` is the store's Map,
// and the clock is `now`.
function makeStore({ wars = new Map(), now = () => 1_800_000_000_000 } = {}) {
  const logs = [];
  const saves = { n: 0 };
  const body = [
    constLine(STORE, "IGNORED_CLIENT_ENEMY_LOG_MS"),
    constLine(STORE, "ignoredClientEnemyLoggedAt"),
    lift(STORE, "pickArchiveKey"),
    lift(STORE, "getOrCreateWar"),
    "return getOrCreateWar;",
  ].join("\n");
  const getOrCreateWar = new Function("wars", "saveState", "clearPayoutLootOverride", "console", "Date", body)(
    wars,
    () => { saves.n++; },
    () => {},
    { log: (s) => logs.push(String(s)) },
    { now },
  );
  return { getOrCreateWar, wars, logs, saves };
}

const ENEMY = "2000"; // the record's enemy: the next war's
const LAST = "3000"; // the enemy a stale FactionOps still remembers

function warRecord(extra = {}) {
  return {
    warId: "war_1000",
    factionId: "1000",
    enemyFactionId: ENEMY,
    enemyFactionName: "Next",
    calls: { 1000001: { calledBy: "1000002" } },
    priorities: { 1000001: 1 },
    enemyStatuses: { 1000001: { status: "Okay" } },
    chainData: { current: 1234, max: 2500, timeout: 200, cooldown: 0 },
    warStart: 1_800_000_000,
    ...extra,
  };
}

test("a FactionOps connect cannot change a war's enemy", () => {
  const s = makeStore({ wars: new Map([["war_1000", warRecord()]]) });
  const war = s.getOrCreateWar("war_1000", "1000", LAST, { fromClient: true });
  assert.equal(war, s.wars.get("war_1000"));
  assert.equal(war.enemyFactionId, ENEMY);
  assert.equal(war.enemyFactionName, "Next");
  assert.equal(war.chainData.current, 1234);
  assert.equal(war.warStart, 1_800_000_000);
  assert.deepEqual(Object.keys(war.calls), ["1000001"]);
  assert.deepEqual(Object.keys(war.enemyStatuses), ["1000001"]);
  assert.equal(s.saves.n, 0);
});

test("warboard's own checks still change it, as before", () => {
  const s = makeStore({ wars: new Map([["war_1000", warRecord()]]) });
  const war = s.getOrCreateWar("war_1000", "1000", LAST);
  assert.equal(war.enemyFactionId, LAST);
  assert.equal(war.chainData.current, 0);
  assert.equal(war.warStart, undefined);
  assert.deepEqual(war.calls, {});
  assert.match(s.logs.join("\n"), /New enemy detected \(3000\)/);
});

test("the same enemy as a number is no change", () => {
  const s = makeStore({ wars: new Map([["war_1000", warRecord()]]) });
  s.getOrCreateWar("war_1000", "1000", 2000);
  s.getOrCreateWar("war_1000", "1000", 2000, { fromClient: true });
  const war = s.wars.get("war_1000");
  assert.equal(war.chainData.current, 1234);
  assert.equal(war.warStart, 1_800_000_000);
  assert.deepEqual(s.logs, []);
});

test("a connect fills in a missing enemy and touches nothing else", () => {
  const s = makeStore({ wars: new Map([["war_1000", warRecord({ enemyFactionId: null, enemyFactionName: null })]]) });
  const war = s.getOrCreateWar("war_1000", "1000", LAST, { fromClient: true });
  assert.equal(war.enemyFactionId, LAST);
  assert.equal(war.chainData.current, 1234);
  assert.equal(war.warStart, 1_800_000_000);
  assert.deepEqual(Object.keys(war.calls), ["1000001"]);
  assert.equal(s.saves.n, 1);
});

test("a connect still creates a war that does not exist", () => {
  const s = makeStore();
  const war = s.getOrCreateWar("war_1000", "1000", LAST, { fromClient: true });
  assert.equal(s.wars.get("war_1000"), war);
  assert.equal(war.factionId, "1000");
  assert.equal(war.enemyFactionId, LAST);
  assert.equal(war.chainData.current, 0);
});

test("an ignored enemy is logged once per war and enemy every 10 minutes", () => {
  let t = 1_800_000_000_000;
  const s = makeStore({ wars: new Map([["war_1000", warRecord()]]), now: () => t });
  s.getOrCreateWar("war_1000", "1000", LAST, { fromClient: true });
  t += 60_000;
  s.getOrCreateWar("war_1000", "1000", LAST, { fromClient: true });
  assert.equal(s.logs.length, 1);
  assert.match(s.logs[0], /war_1000 kept enemy 2000; a FactionOps connect sent 3000/);
  t += 540_000;
  s.getOrCreateWar("war_1000", "1000", LAST, { fromClient: true });
  assert.equal(s.logs.length, 2);
});

// Each `store.getOrCreateWar(...)` call in a file, by its arguments.
const callsIn = (file) => [...read(file).matchAll(/store\.getOrCreateWar\(([^\n]*)\);/g)].map((m) => m[1]);

test("every FactionOps connect passes fromClient, and warboard's own checks do not", () => {
  const CLIENT = "{ fromClient: true }";
  const routes = callsIn("routes.js");
  assert.equal(routes.length, 3);
  for (const c of routes) assert.ok(c.endsWith(CLIENT), c);
  const sock = callsIn("socket-handlers.js");
  assert.equal(sock.length, 1);
  assert.ok(sock[0].endsWith(CLIENT), sock[0]);
  for (const f of ["server.js", "chain-monitor.js", "war-scanner.js"]) {
    const cs = callsIn(f);
    assert.equal(cs.length, 1, f);
    assert.ok(!cs[0].includes("fromClient"), f);
  }
});

test("the routes set a war's enemy only from Torn's answer", () => {
  const sets = [...read("routes.js").matchAll(/war\.enemyFactionId = ([^;\n]+);/g)].map((m) => m[1]);
  assert.deepEqual(sets, ["rw.enemyFactionId"]);
});
