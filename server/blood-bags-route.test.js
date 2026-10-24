// /api/bloodbags: who may read the board, what a request may ask for, and what
// it answers. A stub collector and roster, so no Torn and no data folder.
// Spec: docs/superpowers/specs/2026-10-24-faction-blood-bag-board-design.md
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import vm from "node:vm";

process.env.DATA_DIR = mkdtempSync(join(tmpdir(), "blood-bags-route-test-"));
const { createBloodBagsApi, NOT_A_MEMBER, rosterFromBasic } = await import("./blood-bags.js");
const { requireAuth } = await import("./auth.js");

const NOW = 1792800000;
const MIN_MS = 60 * 1000;
const MEMBERS = [{ playerId: "1", name: "Ann" }, { playerId: "2", name: "Bob" }, { playerId: "137558", name: "RussianRob" }];
const LINES = [
  { ts: NOW - 3600, kind: "fill", type: "O+", qty: 1, playerId: "1", toId: null },
  { ts: NOW - 1800, kind: "use", type: "A-", qty: 1, playerId: "2", toId: null },
];

function setup({ roster = MEMBERS, snapshot } = {}) {
  const clock = { now: NOW * 1000 };
  const state = { roster, fail: false, calls: 0 };
  const collector = {
    snapshot: snapshot || (() => ({
      lines: LINES, wars: [], lastPollAt: NOW * 1000 - 10 * MIN_MS,
      reachSec: NOW - 30 * 86400, backfillDone: false, cutoffSec: NOW - 365 * 86400,
    })),
  };
  const api = createBloodBagsApi({
    collector, nowFn: () => clock.now, log: () => {},
    rosterFn: async () => {
      state.calls++;
      if (state.fail) throw new Error("Torn is down");
      return state.roster;
    },
  });
  return { api, clock, state };
}
function stubRes() {
  return {
    statusCode: 200, headers: {}, body: undefined,
    set(k, v) { this.headers[k] = v; return this; },
    status(c) { this.statusCode = c; return this; },
    json(b) { this.body = b; return this; },
  };
}
async function get(api, user, query = {}) {
  const res = stubRes();
  await api.handle({ user, query }, res);
  return res;
}
// What POST /api/auth puts in the token; Torn's faction id arrives as a number.
const token = (playerId, factionId = 42055) => ({ playerId, playerName: "P" + playerId, factionId, factionPosition: "Member" });

test("a Dead Fragment member gets the board, never cached", async () => {
  const { api } = setup();
  const res = await get(api, token(1));
  assert.equal(res.statusCode, 200);
  assert.equal(res.headers["Cache-Control"], "no-store");
  assert.deepEqual(res.body.topGiven, [{ rank: 1, playerId: "1", name: "Ann", value: 1 }]);
  assert.deepEqual(res.body.wall, [{ rank: 1, playerId: "2", name: "Bob", value: -1 }]);
});

test("a member of another faction is refused", async () => {
  const { api, state } = setup();
  const res = await get(api, token(9, 12345));
  assert.equal(res.statusCode, 403);
  assert.deepEqual(res.body, { error: "This board is for Dead Fragment members." });
  assert.equal(NOT_A_MEMBER, "This board is for Dead Fragment members.");
  assert.equal(state.calls, 0, "refused before any roster call");
});

test("the owner gets the board whatever faction the token names", async () => {
  const { api } = setup();
  assert.equal((await get(api, token(137558, 999))).statusCode, 200);
  assert.equal((await get(api, token("137558", "999"))).statusCode, 200);
});

test("with no token requireAuth answers 401 before the board is reached", () => {
  const res = stubRes();
  let reached = false;
  requireAuth({ headers: {} }, res, () => { reached = true; });
  assert.equal(res.statusCode, 401);
  assert.deepEqual(res.body, { error: "Missing Authorization header" });
  assert.equal(reached, false);
});

test("an unknown timeframe or blood type is a 400; a + that arrived as a space still reads", async () => {
  const { api } = setup();
  assert.deepEqual([(await get(api, token(1), { window: "1y" })).statusCode, (await get(api, token(1), { window: "1y" })).body],
    [400, { error: "Unknown timeframe." }]);
  assert.deepEqual((await get(api, token(1), { type: "C+" })).body, { error: "Unknown blood type." });
  const plus = await get(api, token(1), { window: "24h", type: "A " });
  assert.equal(plus.statusCode, 200);
  assert.deepEqual([plus.body.window, plus.body.type], ["24h", "A+"]);
});

test("a token that names Dead Fragment but whose holder has left is refused, after a fresh look at the roster", async () => {
  const { api, clock, state } = setup();
  assert.equal((await get(api, token(5))).statusCode, 403);
  assert.equal(state.calls, 1, "the roster was fetched just now, so no second look");
  clock.now += 6 * MIN_MS;
  assert.equal((await get(api, token(5))).statusCode, 403);
  assert.equal(state.calls, 2, "older than 5 minutes: looked at again before refusing");
});

test("a member who joined since the roster was fetched gets in", async () => {
  const { api, clock, state } = setup();
  await get(api, token(1));
  state.roster = [...MEMBERS, { playerId: "5", name: "Newbie" }];
  clock.now += 6 * MIN_MS;
  const res = await get(api, token(5));
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.overview.members, 4);
});

test("the roster is cached for an hour", async () => {
  const { api, clock, state } = setup();
  await get(api, token(1));
  clock.now += 30 * MIN_MS;
  await get(api, token(1));
  assert.equal(state.calls, 1);
  clock.now += 31 * MIN_MS;
  await get(api, token(1));
  assert.equal(state.calls, 2);
});

test("a failed roster refresh keeps the last list, marked stale, and waits 5 minutes to try again", async () => {
  const { api, clock, state } = setup();
  await get(api, token(1));
  state.fail = true;
  clock.now += 61 * MIN_MS;
  const res = await get(api, token(1));
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.rosterStale, true);
  clock.now += 2 * MIN_MS;
  await get(api, token(1));
  assert.equal(state.calls, 2);
});

test("with no roster at all the board says so", async () => {
  const { api, state } = setup();
  state.fail = true;
  const res = await get(api, token(1));
  assert.equal(res.statusCode, 502);
  assert.deepEqual(res.body, { error: "The member list is unavailable right now." });
});

test("the answer carries everything the page reads", async () => {
  const { api } = setup({ snapshot: () => ({
    lines: LINES, wars: [{ id: 51418, start: NOW - 86400, end: 0 }], lastPollAt: NOW * 1000 - 10 * MIN_MS,
    reachSec: NOW - 30 * 86400, backfillDone: false, cutoffSec: NOW - 365 * 86400,
  }) });
  const { body } = await get(api, token(2), { window: "all" });
  assert.deepEqual(Object.keys(body).sort(), [
    "backfillDone", "fromSec", "liveWar", "overview", "reachSec", "rosterStale", "toSec", "topGiven", "topNet",
    "type", "types", "updatedAt", "wall", "window", "windows", "you",
  ]);
  assert.deepEqual(body.windows, ["24h", "7d", "30d", "90d", "all"]);
  assert.deepEqual(body.types, ["all", "A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"]);
  assert.deepEqual(body.liveWar, { id: 51418, start: NOW - 86400 });
  assert.equal(body.fromSec, NOW - 30 * 86400, "all time starts where the history reaches");
  assert.equal(body.updatedAt, NOW * 1000 - 10 * MIN_MS);
  assert.deepEqual(body.overview, { given: 1, used: 1, usedInWars: 1, net: 1, members: 3 });
  // Bob's one use fell inside the live war: used, but not against his net. He ties
  // RussianRob on 0, and the tie goes by name.
  assert.deepEqual(body.you, { rank: 2, of: 3, given: 0, used: 1, usedInWars: 1, net: 0 });
});

test("before the first poll the board answers with no data rather than an error", async () => {
  const { api } = setup({ snapshot: () => ({ lines: [], wars: [], lastPollAt: null, reachSec: null, backfillDone: false, cutoffSec: NOW - 365 * 86400 }) });
  const res = await get(api, token(1), { window: "all" });
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.updatedAt, null);
  assert.equal(res.body.reachSec, null);
  assert.deepEqual(res.body.overview, { given: 0, used: 0, usedInWars: 0, net: 0, members: 3 });
});

test("an error inside becomes a 500 in JSON, never a rejection", async () => {
  const { api } = setup({ snapshot: () => { throw new Error("boom"); } });
  const res = await get(api, token(1));
  assert.equal(res.statusCode, 500);
  assert.deepEqual(res.body, { error: "internal error" });
});

test("the roster is read from Torn's faction basic, whose members are keyed by player id", () => {
  // The shape fetchFactionBasic returns (Torn v1), which the /slackers roster reads too.
  const basic = { ID: 42055, name: "Dead Fragment", members: {
    "1": { name: "Ann", level: 50, days_in_faction: 10, position: "Member" },
    "137558": { name: "RussianRob", level: 80, days_in_faction: 900, position: "Leader" },
    "7": { level: 1 },
  } };
  assert.deepEqual(rosterFromBasic(basic), [
    { playerId: "1", name: "Ann" }, { playerId: "7", name: "7" }, { playerId: "137558", name: "RussianRob" },
  ]);
  assert.deepEqual(rosterFromBasic({ ID: 42055 }), []);
  assert.deepEqual(rosterFromBasic(null), []);
});

// ── wiring in routes.js and server.js ───────────────────────────────────────
const ROUTES = readFileSync(new URL("./routes.js", import.meta.url), "utf8");
const SERVER = readFileSync(new URL("./server.js", import.meta.url), "utf8");
function routesFn(name) {
  const i = ROUTES.indexOf("function " + name + "(");
  assert.ok(i >= 0, "not in routes.js: " + name);
  let k = ROUTES.indexOf("(", i), depth = 0;
  for (; k < ROUTES.length; k++) {
    if (ROUTES[k] === "(") depth++;
    else if (ROUTES[k] === ")" && --depth === 0) break;
  }
  const o = ROUTES.indexOf("{", k);
  let d = 0;
  for (let j = o; j < ROUTES.length; j++) {
    if (ROUTES[j] === "{") d++;
    else if (ROUTES[j] === "}" && --d === 0) return ROUTES.slice(i, j + 1);
  }
  throw new Error("unbalanced braces in " + name);
}
// The site gate as it runs with the gate switched on and no gate cookie.
function gateFor(path) {
  const box = { process: { env: {} }, parseCookie: () => null, verifyToken: () => { throw new Error("no token"); } };
  vm.createContext(box);
  vm.runInContext(routesFn("gateMiddleware") + "\nglobalThis.gate = gateMiddleware;", box);
  const seen = { next: false, redirect: null };
  box.gate({ path, headers: {} }, { redirect: (to) => { seen.redirect = to; } }, () => { seen.next = true; });
  return seen;
}

test("routes.js serves /api/bloodbags behind requireAuth, and /bloodbags uncached from blood-bags-page.js", () => {
  assert.match(ROUTES, /^import \{ createBloodBagsApi \} from "\.\/blood-bags\.js";$/m);
  assert.match(ROUTES, /^import \{ renderBloodBagsPage \} from "\.\/blood-bags-page\.js";$/m);
  assert.match(ROUTES, /router\.get\("\/api\/bloodbags", requireAuth, \(req, res\) => bloodBagsApi\.handle\(req, res\)\);/);
  assert.match(ROUTES, /router\.get\("\/bloodbags",[\s\S]{0,200}"Cache-Control", "no-store"[\s\S]{0,80}renderBloodBagsPage\(\)/);
});

test("the site gate lets /bloodbags through, as it does /hof, and still gates other pages", () => {
  assert.deepEqual(gateFor("/bloodbags"), { next: true, redirect: null });
  assert.deepEqual(gateFor("/api/bloodbags"), { next: true, redirect: null });
  assert.deepEqual(gateFor("/slackers"), { next: false, redirect: "/gate.html" });
});

test("server.js starts the collector", () => {
  assert.match(SERVER, /import\('\.\/blood-bags\.js'\)\.then\(m => m\.start\(\)\)/);
});
