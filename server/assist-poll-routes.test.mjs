// An assist request's way to a FactionOps copy that polls, in routes.js. The
// route remembers it and wakes the long-polls; /api/poll and /api/poll-long
// hand each member their next one; a long-poll that is holding answers at once
// when one is waiting; each handout is logged. The long-poll helpers are
// lifted out of routes.js and run against the real assist-relay.js; the route
// bodies are read. Ids and names are made up.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { recordAssist, takeAssistFor, hasAssistFor } from "./assist-relay.js";

const SRC = fs.readFileSync(new URL("./routes.js", import.meta.url), "utf8");

function fn(name) {
  const i = SRC.indexOf("function " + name + "(");
  assert.ok(i >= 0, "not in routes.js: " + name);
  const o = SRC.indexOf("{", i);
  let d = 0;
  for (let j = o; j < SRC.length; j++) {
    if (SRC[j] === "{") d++;
    else if (SRC[j] === "}" && --d === 0) return SRC.slice(i, j + 1);
  }
  throw new Error("unbalanced braces in " + name);
}
// A route's source, up to the next route.
function route(start) {
  const i = SRC.indexOf(start);
  assert.ok(i >= 0, "no route: " + start);
  return SRC.slice(i, SRC.indexOf("\nrouter.", i + start.length));
}

// The long-poll helpers, with what they lean on stubbed: one fixed section,
// the held long-polls in a set, a finish that takes one out and keeps its
// reply, no queued shouts, the chain left as it is, and box.war as the war.
function lift() {
  const logs = [], finished = [];
  const box = {
    takeAssistFor, hasAssistFor, JSON, String, Date,
    console: { log: (m) => logs.push(String(m)) },
    pendingBroadcasts: { drainForPlayer: () => [] },
    chainWithLiveTimeout: (c) => c,
    _lpWarSections: () => ({ calls: { 2000009: { calledBy: { id: 1000004 } } } }),
    _lpWaiters: new Set(),
    _lpTicker: null,
    clearInterval: () => {},
    store: { getWar: () => box.war },
  };
  box._lpFinish = (w, body) => { box._lpWaiters.delete(w); finished.push({ w, body }); };
  vm.createContext(box);
  vm.runInContext([fn("assistForPoll"), fn("_lpRefresh"), fn("_lpBuildDelta"), fn("_lpServe"), fn("wakeLongPoll"), fn("_lpTick"),
    "globalThis.api = { _lpServe, _lpBuildDelta, wakeLongPoll, _lpTick };"].join("\n"), box);
  return { ...box.api, logs, finished, box };
}
const ASKER = 1000001, MEMBER = 1000002;
const request = (targetId) => ({
  type: "assist_request", mode: "assist", playerId: ASKER, playerName: "Asker", targetId,
  targetName: "Target" + targetId, attackUrl: "https://www.torn.com/page.php?sid=attack&user2ID=" + targetId,
  timestamp: Date.now(),
});
const waiter = (warId, playerId, since, playerName = "Member") => ({ warId, factionId: 1000003, playerId, playerName, since });

// A war whose long-poll version is settled: the first reply has gone out.
function settled(L, warId) {
  const war = {};
  L._lpServe(waiter(warId, MEMBER, 0), war);
  return war;
}

test("a caught-up long-poll is answered at once with an assist request that is waiting", () => {
  const L = lift(), warId = "war_1000201";
  const war = settled(L, warId), v = war._lpv;
  assert.equal(L._lpServe(waiter(warId, MEMBER, v), war), false, "held with nothing new");
  recordAssist(warId, request(2000001), ASKER);
  assert.equal(L._lpServe(waiter(warId, MEMBER, v), war), true);
  const body = L.finished.at(-1).body;
  assert.deepEqual([body.v, body.full, Object.keys(body.changed)], [v, false, ["lastAssistRequest"]]);
  assert.equal(body.changed.lastAssistRequest.targetId, 2000001);
});

test("after that the member's long-poll holds again", () => {
  const L = lift(), warId = "war_1000202";
  const war = settled(L, warId), v = war._lpv;
  recordAssist(warId, request(2000001), ASKER);
  L._lpServe(waiter(warId, MEMBER, v), war);
  assert.equal(L._lpServe(waiter(warId, MEMBER, v), war), false);
});

test("the member who asked is held as usual", () => {
  const L = lift(), warId = "war_1000203";
  const war = settled(L, warId), v = war._lpv;
  recordAssist(warId, request(2000001), ASKER);
  assert.equal(L._lpServe(waiter(warId, ASKER, v, "Asker"), war), false);
});

test("a full reply carries the request beside the war's sections", () => {
  const L = lift(), warId = "war_1000204";
  recordAssist(warId, request(2000001), ASKER);
  L._lpServe(waiter(warId, MEMBER, 0), {});
  const body = L.finished.at(-1).body;
  assert.equal(body.full, true);
  assert.ok(body.changed.calls, "the sections went missing");
  assert.equal(body.changed.lastAssistRequest.targetId, 2000001);
});

test("every long-poll a member has held gets the request, so a page they left cannot take it from the one they are on", () => {
  const L = lift(), warId = "war_1000206";
  const war = settled(L, warId), v = war._lpv;
  L.box.war = war;
  // Oldest first: the page they left (Torn PDA never closes its request) and
  // the page they are on.
  const left = waiter(warId, MEMBER, v), on = waiter(warId, MEMBER, v);
  L.box._lpWaiters.add(left);
  L.box._lpWaiters.add(on);
  recordAssist(warId, request(2000001), ASKER);
  L.wakeLongPoll(warId);
  const got = (w) => L.finished.filter((f) => f.w === w).map((f) => (f.body.changed.lastAssistRequest || {}).targetId);
  assert.deepEqual([got(left), got(on)], [[2000001], [2000001]]);
  assert.equal(L.box._lpWaiters.size, 0, "a long-poll was left holding");
  assert.deepEqual(L.logs, ["[assist] Member (1000002) got Asker's request on 2000001 by poll-long",
    "[assist] Member (1000002) got it on 1 more held long-poll"]);
});

test("a member's other held long-poll is not handed their next request in place of this one", () => {
  const L = lift(), warId = "war_1000207";
  const war = settled(L, warId), v = war._lpv;
  L.box.war = war;
  const left = waiter(warId, MEMBER, v), on = waiter(warId, MEMBER, v);
  L.box._lpWaiters.add(left);
  L.box._lpWaiters.add(on);
  recordAssist(warId, request(2000001), ASKER);
  recordAssist(warId, request(2000002), ASKER);
  L.wakeLongPoll(warId);
  const got = (w) => L.finished.filter((f) => f.w === w).map((f) => (f.body.changed.lastAssistRequest || {}).targetId);
  assert.deepEqual([got(left), got(on)], [[2000001], [2000001]]);
  // The second request is still the member's to have, on their next poll.
  assert.equal(takeAssistFor(warId, MEMBER).targetId, 2000002);
});

test("the once-a-second check hands requests out the same way", () => {
  const L = lift(), warId = "war_1000208";
  const war = settled(L, warId), v = war._lpv;
  L.box.war = war;
  const left = waiter(warId, MEMBER, v), on = waiter(warId, MEMBER, v);
  left.at = on.at = Date.now();
  L.box._lpWaiters.add(left);
  L.box._lpWaiters.add(on);
  recordAssist(warId, request(2000001), ASKER);
  recordAssist(warId, request(2000002), ASKER);
  L._lpTick();
  const got = (w) => L.finished.filter((f) => f.w === w).map((f) => (f.body.changed.lastAssistRequest || {}).targetId);
  assert.deepEqual([got(left), got(on)], [[2000001], [2000001]]);
  assert.equal(takeAssistFor(warId, MEMBER).targetId, 2000002);
});

test("each handout is logged: who got whose request, on whom, by which poll", () => {
  const L = lift(), warId = "war_1000205";
  const war = settled(L, warId);
  recordAssist(warId, request(2000001), ASKER);
  L._lpServe(waiter(warId, MEMBER, war._lpv), war);
  assert.deepEqual(L.logs, ["[assist] Member (1000002) got Asker's request on 2000001 by poll-long"]);
});

test("the assist route remembers an assist for the war's pollers and wakes its long-polls", () => {
  const body = route('router.post("/api/assist-request"');
  assert.match(body, /if \(kind === "assist"\) \{\s*recordAssist\(broadcastWarId, payload, playerId\);\s*wakeLongPoll\(broadcastWarId\);\s*\}/);
  assert.ok(body.indexOf("recordAssist(") > body.indexOf("const payload = {"), "remembered before the payload exists");
});

test("/api/poll's reply hands the member their next assist request", () => {
  assert.match(route('router.get("/api/poll",'), /lastAssistRequest: assistForPoll\(warId, playerId, playerName, "poll"\),/);
});

test("/api/poll-long answers at once when an assist request is waiting, and its replies carry it", () => {
  const body = route('router.get("/api/poll-long"');
  assert.match(body, /const \{ playerId, playerName, factionId \} = req\.user;/);
  assert.match(body, /return res\.json\(_lpBuildDelta\(war, sections, effSince, playerId, warId, playerName\)\);/);
  const early = body.indexOf("if (hasAssistFor(warId, playerId)) return res.json(_lpBuildDelta(war, sections, since, playerId, warId, playerName));");
  assert.ok(early > 0, "no early answer for a waiting request");
  assert.ok(early < body.indexOf("_lpWaiters.add(w)"), "the early answer comes after the hold");
  assert.match(body, /const w = \{ res, req, warId, factionId, playerId, playerName, since, at: Date\.now\(\) \};/);
});

test("routes.js takes the relay's three functions from assist-relay.js", () => {
  assert.match(SRC, /^import \{ recordAssist, takeAssistFor, hasAssistFor \} from "\.\/assist-relay\.js";$/m);
});
