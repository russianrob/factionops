// The admin broadcast bar's server side: broadcast-bar.js driven directly, and
// the four routes lifted out of routes.js and run against it with the rest of
// the server stubbed (no push, no Torn call, no file written). A broadcast is
// cleaned and capped at 150 characters, carries the sender's position, and is
// remembered for 10 minutes so a page can ask for it when it loads. The quick
// picks are the faction's own list, for broadcasters only. Ids and names are
// made up.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import * as bb from "./broadcast-bar.js";

const SRC = fs.readFileSync(new URL("./routes.js", import.meta.url), "utf8");

// `function name(...) {...}` out of routes.js, by paren and brace count.
function fn(name) {
  const i = SRC.indexOf("function " + name + "(");
  assert.ok(i >= 0, "not in routes.js: " + name);
  let k = SRC.indexOf("(", i), depth = 0;
  for (; k < SRC.length; k++) {
    if (SRC[k] === "(") depth++;
    else if (SRC[k] === ")" && --depth === 0) break;
  }
  let d = 0;
  for (let j = SRC.indexOf("{", k); j < SRC.length; j++) {
    if (SRC[j] === "{") d++;
    else if (SRC[j] === "}" && --d === 0) return SRC.slice(i, j + 1);
  }
  throw new Error("unbalanced braces in " + name);
}
// The routes from `first` through `last`, up to the route after it.
function routes(first, last) {
  const i = SRC.indexOf(first);
  assert.ok(i >= 0, "no route: " + first);
  const j = SRC.indexOf(last, i);
  assert.ok(j >= 0, "no route: " + last);
  return SRC.slice(i, SRC.indexOf("\nrouter.", j + last.length));
}

const DEFAULTS = ["Let chain die", "Good work all!", "Hold hits", "Hit now"];
const ROLES = ["leader", "co-leader", "war leader", "banker"];
const LEADER = { playerId: 1000001, playerName: "Tester", factionId: 1000003, factionPosition: "Leader" };
const MEMBER = { playerId: 1000002, playerName: "Member", factionId: 1000003, factionPosition: "Member" };

// What leaves through res.json, as the client gets it. Objects made inside the
// vm context have that context's prototypes, which strict deep-equal refuses.
const wire = (v) => JSON.parse(JSON.stringify(v));

// The broadcast routes with what they lean on stubbed. `over.war` is what
// store.getWar answers and `over.settings` the faction's settings; `sent`
// keeps everything that would have left the server.
function lift(over = {}) {
  const handlers = {};
  const sent = { sse: [], io: [], queued: [], pushed: [], saved: [] };
  const box = {
    ...bb,
    console: { log() {}, error() {} },
    router: {
      get: (path, ...h) => { handlers["GET " + path] = h.at(-1); },
      post: (path, ...h) => { handlers["POST " + path] = h.at(-1); },
    },
    requireAuth: () => {},
    store: {
      getWar: () => over.war,
      getFactionSettings: () => over.settings || {},
      getOnlinePlayersForWar: () => [],
      getFactionApiKey: () => null,
      getApiKeyForFaction: () => null,
    },
    getAllowedBroadcastRoles: () => ROLES,
    updateFactionSettings: (factionId, settings) => { sent.saved.push(wire([factionId, settings])); },
    io: { to: () => ({ emit: (event, payload) => { sent.io.push(payload); } }) },
    broadcastSSE: (warId, payload) => { sent.sse.push(payload); },
    pendingBroadcasts: { queueForPlayer: (id, payload) => { sent.queued.push(payload); }, queueForPlayers() {} },
    push: { notifyBroadcast: (...args) => { sent.pushed.push(args); } },
    fetchFactionMembers: () => Promise.resolve({}),
  };
  vm.createContext(box);
  vm.runInContext(fn("mayBroadcast") + "\n"
    + routes('router.post("/api/broadcast",', 'router.post("/api/broadcast/picks",'), box);
  const call = (key, user, body = {}) => {
    const res = { code: 200, body: undefined };
    res.status = (c) => { res.code = c; return res; };
    res.json = (b) => { res.body = wire(b); return res; };
    assert.ok(handlers[key], "no handler: " + key);
    handlers[key]({ user, body }, res);
    return res;
  };
  return { call, sent };
}

test("a broadcast's text is trimmed, every run of spaces is one, and it holds 1 to 150 characters", () => {
  assert.equal(bb.cleanBroadcastText("  Let  chain\n die "), "Let chain die");
  for (const bad of ["", "   ", null, undefined, "x".repeat(151)]) assert.equal(bb.cleanBroadcastText(bad), null, JSON.stringify(bad));
  assert.equal(bb.cleanBroadcastText("x".repeat(150)), "x".repeat(150));
});

test("a broadcast role matches in any case of letters, and no position holds none", () => {
  assert.equal(bb.holdsBroadcastRole("War Leader", ["war leader"]), true);
  assert.equal(bb.holdsBroadcastRole(" leader ", ["Leader"]), true);
  assert.equal(bb.holdsBroadcastRole("Member", ["leader"]), false);
  assert.equal(bb.holdsBroadcastRole("", [""]), false);
  assert.equal(bb.holdsBroadcastRole(undefined, ROLES), false);
});

test("a faction with no picks saved gets the four defaults, and a list emptied by × stays empty", () => {
  const picks = bb.picksFromSettings({});
  assert.deepEqual(picks, DEFAULTS);
  picks.push("Mine");
  assert.deepEqual(bb.picksFromSettings({}), DEFAULTS, "the defaults were handed out, not a copy");
  assert.deepEqual(bb.picksFromSettings({ broadcastPicks: [] }), []);
  assert.deepEqual(bb.picksFromSettings(undefined), DEFAULTS);
});

test("+ adds the cleaned text at the end, once, up to 12", () => {
  const before = ["A"];
  assert.deepEqual(bb.addPick(before, " B "), { picks: ["A", "B"] });
  assert.deepEqual(before, ["A"], "the list it was given changed");
  assert.deepEqual(bb.addPick(["Hold"], "hold"), { picks: ["Hold"] });
  assert.deepEqual(bb.addPick(["A"], ""), { error: "A quick pick is 1 to 150 characters." });
  const twelve = Array.from({ length: 12 }, (_, i) => "Pick " + i);
  assert.deepEqual(bb.addPick(twelve, "One more"), { error: "Up to 12 quick picks: remove one first." });
  assert.equal(bb.addPick(twelve.slice(1), "One more").picks.length, 12);
});

test("× removes that pick and leaves the rest in order", () => {
  assert.deepEqual(bb.removePick(["A", "B", "C"], "B"), ["A", "C"]);
  assert.deepEqual(bb.removePick(["A"], "Z"), ["A"]);
  assert.deepEqual(bb.removePick(["Hold hits", "A"], " Hold  hits "), ["A"]);
});

test("each war keeps its latest broadcast for 10 minutes, with its age", () => {
  const T = 1700000000000;
  bb.rememberBroadcast("war_1000301", { message: "A", ts: T });
  assert.deepEqual(bb.latestBroadcast("war_1000301", T + 1000), { message: "A", ts: T, age: 1000 });
  assert.equal(bb.latestBroadcast("war_1000301", T - 5).age, 0, "a clock stepped back gave a negative age");
  assert.ok(bb.latestBroadcast("war_1000301", T + 599999));
  assert.equal(bb.latestBroadcast("war_1000301", T + 600000), null);
  assert.equal(bb.latestBroadcast("war_1000302", T), null);
  bb.rememberBroadcast("war_1000305", { message: "A", ts: T });
  bb.rememberBroadcast("war_1000305", { message: "B", ts: T + 5 });
  assert.equal(bb.latestBroadcast("war_1000305", T + 10).message, "B");
});

test("a member on the roster gets the latest; one off it gets null; with no roster, any member does", () => {
  const T = 1700000000000;
  bb.rememberBroadcast("war_1000304", { message: "C", ts: T });
  assert.equal(bb.latestBroadcastFor("war_1000304", { ourMemberIds: ["1000002"] }, 1000002, T + 1).message, "C");
  assert.equal(bb.latestBroadcastFor("war_1000304", { ourMemberIds: ["1000002"] }, 1000009, T + 1), null);
  assert.equal(bb.latestBroadcastFor("war_1000304", { ourMemberIds: [] }, 1000009, T + 1).message, "C");
  assert.equal(bb.latestBroadcastFor("war_1000304", undefined, 1000009, T + 1).message, "C");
});

test("a leader's broadcast goes out cleaned, with their position, and is remembered for the page-load ask", () => {
  const { call, sent } = lift();
  const res = call("POST /api/broadcast", LEADER, { message: " Let  chain die ", type: "warning", warId: "war_1000303" });
  assert.deepEqual([res.code, res.body], [200, { success: true }]);
  assert.equal(sent.sse.length, 1);
  assert.equal(sent.sse[0].message, "Let chain die");
  assert.equal(sent.sse[0].senderRole, "Leader");
  assert.equal(sent.sse[0].type, "global_toast");
  assert.equal(sent.io[0].message, "Let chain die");
  const kept = bb.latestBroadcast("war_1000303", Date.now());
  assert.equal(kept.message, "Let chain die");
  assert.equal(kept.senderName, "Tester");
  assert.equal(kept.senderId, "1000001");
});

test("a broadcast over 150 characters is refused, and nothing goes out", () => {
  const { call, sent } = lift();
  const res = call("POST /api/broadcast", LEADER, { message: "x".repeat(151), type: "warning", warId: "war_1000306" });
  assert.deepEqual([res.code, res.body], [400, { error: "A broadcast is 1 to 150 characters." }]);
  assert.deepEqual([sent.sse.length, sent.io.length, sent.pushed.length], [0, 0, 0]);
  assert.equal(bb.latestBroadcast("war_1000306", Date.now()), null);
});

test("a member who is not a broadcaster is refused", () => {
  const { call, sent } = lift();
  const res = call("POST /api/broadcast", MEMBER, { message: "Hold hits", type: "warning", warId: "war_1000307" });
  assert.deepEqual([res.code, res.body], [403, { error: "Only leaders and bankers can broadcast to the faction." }]);
  assert.equal(sent.sse.length, 0);
  assert.equal(bb.latestBroadcast("war_1000307", Date.now()), null);
});

test("the page-load ask answers from the member's own faction's war", () => {
  bb.rememberBroadcast("war_1000003", { message: "Hold hits", senderName: "Tester", senderId: "1000001", ts: Date.now() - 2000 });
  const { call } = lift({ war: { ourMemberIds: ["1000002"] } });
  const on = call("GET /api/broadcast/latest", { playerId: 1000002, factionId: 1000003 });
  assert.equal(on.code, 200);
  assert.equal(on.body.broadcast.message, "Hold hits");
  assert.ok(on.body.broadcast.age >= 2000 && on.body.broadcast.age < 10000, "age " + on.body.broadcast.age);
  const off = call("GET /api/broadcast/latest", { playerId: 1000009, factionId: 1000003 });
  assert.deepEqual([off.code, off.body], [200, { broadcast: null }]);
  const other = call("GET /api/broadcast/latest", { playerId: 1000002, factionId: 1000008 });
  assert.deepEqual(other.body, { broadcast: null }, "another faction's war answered");
});

test("the quick picks: the defaults for a broadcaster, and none for anyone else", () => {
  const { call } = lift();
  assert.deepEqual(call("GET /api/broadcast/picks", LEADER).body, { picks: DEFAULTS });
  const no = call("GET /api/broadcast/picks", MEMBER);
  assert.deepEqual([no.code, no.body], [403, { error: "Only broadcasters can use the quick picks." }]);
});

test("+ and × save the faction's list, and a body with neither is refused", () => {
  const add = lift();
  const added = add.call("POST /api/broadcast/picks", LEADER, { add: "Push now" });
  assert.deepEqual(added.body, { picks: [...DEFAULTS, "Push now"] });
  assert.deepEqual(add.sent.saved, [[1000003, { broadcastPicks: [...DEFAULTS, "Push now"] }]]);

  const rm = lift({ settings: { broadcastPicks: ["Hit now"] } });
  assert.deepEqual(rm.call("POST /api/broadcast/picks", LEADER, { remove: "Hit now" }).body, { picks: [] });
  assert.deepEqual(rm.sent.saved, [[1000003, { broadcastPicks: [] }]]);

  const bad = lift();
  const neither = bad.call("POST /api/broadcast/picks", LEADER, {});
  assert.deepEqual([neither.code, neither.body], [400, { error: "add or remove is required." }]);
  const empty = bad.call("POST /api/broadcast/picks", LEADER, { add: "" });
  assert.deepEqual([empty.code, empty.body], [400, { error: "A quick pick is 1 to 150 characters." }]);
  const member = bad.call("POST /api/broadcast/picks", MEMBER, { add: "Push now" });
  assert.deepEqual([member.code, member.body], [403, { error: "Only broadcasters can use the quick picks." }]);
  assert.deepEqual(bad.sent.saved, [], "a refused change was saved");
});
