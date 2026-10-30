// A broadcast's way to a FactionOps copy that polls (every Torn PDA): the
// queue in pending-broadcasts.js, and the long-poll in routes.js, which ends
// its hold when a broadcast waits. The long-poll helpers are lifted out of
// routes.js and run against the real queue; the route bodies are read. Ids and
// names are made up.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import * as pending from "./pending-broadcasts.js";
import { takeAssistFor, hasAssistFor } from "./assist-relay.js";

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

// The server's clock held at `t` while `f` runs.
function at(t, f) {
  const real = Date.now;
  Date.now = () => t;
  try { return f(); } finally { Date.now = real; }
}

const T = 1700000000000;
const SENT = (ts) => ({ message: "Hold hits", type: "warning", senderName: "Tester", senderId: "1000001", senderRole: "Leader", ts });

// ---- The queue -------------------------------------------------------------
// It is shared across this file, so every test has its own player ids.

test("a broadcast taken from the queue carries its age by the server's clock", () => {
  at(T, () => pending.queueForPlayer(1000401, SENT(T)));
  assert.deepEqual(at(T + 240000, () => pending.drainForPlayer(1000401)), [{ ...SENT(T), age: 240000 }]);
  // Queued after the send (the whole faction's copies wait for its member
  // list), it is still aged from the send.
  at(T + 3000, () => pending.queueForPlayer(1000407, SENT(T)));
  assert.equal(at(T + 4000, () => pending.drainForPlayer(1000407))[0].age, 4000);
  // One with no send time is aged from when it was queued, and none is younger than 0.
  at(T, () => pending.queueForPlayer(1000402, { message: "Hold hits" }));
  assert.deepEqual(at(T + 1000, () => pending.drainForPlayer(1000402)), [{ message: "Hold hits", age: 1000 }]);
  at(T, () => pending.queueForPlayer(1000403, SENT(T + 5000)));
  assert.equal(at(T, () => pending.drainForPlayer(1000403))[0].age, 0);
});

test("hasFor tells that a fresh broadcast waits without taking it; a drained or stale one does not count", () => {
  at(T, () => pending.queueForPlayer(1000404, SENT(T)));
  assert.equal(at(T + 1000, () => pending.hasFor(1000404)), true);
  assert.equal(at(T + 1000, () => pending.hasFor(1000404)), true, "asking took it");
  assert.equal(at(T + 1000, () => pending.drainForPlayer(1000404)).length, 1);
  assert.equal(at(T + 1000, () => pending.hasFor(1000404)), false);
  at(T, () => pending.queueForPlayer(1000405, SENT(T)));
  assert.equal(at(T + 5 * 60 * 1000 + 1, () => pending.hasFor(1000405)), false, "a stale one counted");
  assert.equal(pending.hasFor(1000406), false);
});

// ---- The long-poll ---------------------------------------------------------

// The long-poll helpers on the real queue, the rest stubbed as in
// assist-poll-routes.test.mjs: one fixed section, the held long-polls in a
// set, a finish that takes one out and keeps its reply, the chain left as it
// is, and box.war as the war.
function lift() {
  const logs = [], finished = [];
  const box = {
    takeAssistFor, hasAssistFor, JSON, String, Date,
    console: { log: (m) => logs.push(String(m)) },
    pendingBroadcasts: pending,
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
const waiter = (warId, playerId, since) => ({ warId, factionId: 1000003, playerId, playerName: "Member", since });

// A war whose long-poll version is settled: the first reply has gone out.
function settled(L, warId, playerId) {
  const war = {};
  L._lpServe(waiter(warId, playerId, 0), war);
  return war;
}

test("a caught-up long-poll is answered at once with a broadcast that waits, with its age, and then holds again", () => {
  const L = lift(), warId = "war_1000411", P = 1000411;
  const war = settled(L, warId, P), v = war._lpv;
  assert.equal(L._lpServe(waiter(warId, P, v), war), false, "held with nothing new");
  pending.queueForPlayer(P, SENT(Date.now() - 2000));
  assert.equal(L._lpServe(waiter(warId, P, v), war), true, "held with a broadcast waiting");
  const body = L.finished.at(-1).body;
  assert.deepEqual([body.v, body.full, Object.keys(body.changed)], [v, false, ["broadcasts"]]);
  assert.equal(body.changed.broadcasts[0].message, "Hold hits");
  const age = body.changed.broadcasts[0].age;
  assert.ok(age >= 2000 && age < 10000, "age " + age);
  assert.equal(L._lpServe(waiter(warId, P, v), war), false);
});

test("within the second, every long-poll the member holds gets the broadcast, so a page they left cannot take it from the one they are on", () => {
  const L = lift(), warId = "war_1000412", P = 1000412, OTHER = 1000413;
  const war = settled(L, warId, P), v = war._lpv;
  L.box.war = war;
  // Oldest first: the page they left (Torn PDA never closes its request), the
  // page they are on, and another member's.
  const left = waiter(warId, P, v), on = waiter(warId, P, v), other = waiter(warId, OTHER, v);
  for (const w of [left, on, other]) L.box._lpWaiters.add(w);
  const before = L.finished.length;
  L._lpTick();
  assert.equal(L.finished.length, before, "answered with nothing waiting");
  pending.queueForPlayer(P, SENT(Date.now()));
  L._lpTick();
  const got = (w) => L.finished.filter((f) => f.w === w).map((f) => (f.body.changed.broadcasts || []).map((b) => b.message));
  assert.deepEqual([got(left), got(on), got(other)], [[["Hold hits"]], [["Hold hits"]], []]);
  assert.deepEqual([...L.box._lpWaiters], [other], "only the other member's long-poll still holds");
  assert.deepEqual(L.logs, [], "a broadcast was logged as an assist");
});

test("a queue holding only stale broadcasts does not end the hold", () => {
  const L = lift(), warId = "war_1000414", P = 1000414;
  const war = settled(L, warId, P), v = war._lpv;
  at(Date.now() - 6 * 60 * 1000, () => pending.queueForPlayer(P, SENT(Date.now())));
  assert.equal(L._lpServe(waiter(warId, P, v), war), false);
});

test("/api/poll-long answers at once when a broadcast waits, after the assist check and before the hold", () => {
  const body = route('router.get("/api/poll-long"');
  const assist = body.indexOf("if (hasAssistFor(warId, playerId)) return res.json(");
  const early = body.indexOf("if (pendingBroadcasts.hasFor(playerId)) return res.json(_lpBuildDelta(war, sections, since, playerId, warId, playerName));");
  assert.ok(early > 0, "no early answer for a waiting broadcast");
  assert.ok(assist > 0 && assist < early, "not beside the assist check");
  assert.ok(early < body.indexOf("_lpWaiters.add(w)"), "the early answer comes after the hold");
});
