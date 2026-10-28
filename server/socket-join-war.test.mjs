// join_war on a real Socket.IO server (socket-test-harness.mjs, in a child
// process): it checks its message, takes the faction from the sign-in rather
// than from the message (as /api/poll does), turns another faction's war away
// before touching it, and calls onJoin once for a join it lets in.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { startHarness, connect } from "./socket-test-harness.mjs";

const ALPHA = { playerId: "1000001", playerName: "Alpha", factionId: "1000" };
const BRAVO = { playerId: "1000002", playerName: "Bravo", factionId: "2000" };
// The same faction as Alpha, its id a number as some sign-ins carry it.
const CHARLIE = { playerId: "1000003", playerName: "Charlie", factionId: 1000 };
const DELTA = { playerId: "1000004", playerName: "Delta" };

async function withHarness(fn) {
  const h = await startHarness();
  try {
    await fn(h);
  } finally {
    await h.stop();
  }
}
async function until(check, what, ms = 5000) {
  const end = Date.now() + ms;
  while (!check()) {
    if (Date.now() > end) throw new Error(`timed out waiting for ${what}`);
    await new Promise((r) => setTimeout(r, 10));
  }
}
const refusals = (c) => c.events.filter((e) => e[0] === "error").map((e) => e[1]?.message);
const states = (c) => c.events.filter((e) => e[0] === "war_state").map((e) => e[1]);
const onJoins = (h) => h.lines.filter((l) => l.startsWith("ONJOIN "));
const settle = () => new Promise((r) => setTimeout(r, 150));

test("a join with no war id, or one that is not a string, is refused", { timeout: 30000 }, () => withHarness(async (h) => {
  const c = await connect(h.port, ALPHA);
  c.emit("join_war", {});
  c.emit("join_war", { warId: { a: 1 } });
  c.emit("join_war", { warId: "war_1000", enemyFactionId: ["3000"] });
  await until(() => refusals(c).length >= 3, "three refusals");
  assert.deepEqual(refusals(c), ["warId is required", "warId must be a single value", "enemyFactionId must be a single value"]);
  await settle();
  assert.deepEqual(states(c), []);
  assert.deepEqual(onJoins(h), []);
  c.close();
}));

test("a sign-in with no faction is refused", { timeout: 30000 }, () => withHarness(async (h) => {
  const c = await connect(h.port, DELTA);
  c.emit("join_war", { warId: "war_1000", factionId: "1000" });
  await until(() => refusals(c).length || states(c).length, "an answer");
  assert.deepEqual(refusals(c), ["This token carries no faction"]);
  assert.deepEqual(states(c), []);
  c.close();
}));

test("another faction's war is refused and left as it was", { timeout: 30000 }, () => withHarness(async (h) => {
  const alpha = await connect(h.port, ALPHA);
  alpha.emit("join_war", { warId: "war_2000", factionId: "2000", enemyFactionId: "3000" });
  await until(() => refusals(alpha).length || states(alpha).length, "an answer");
  assert.deepEqual(refusals(alpha), ["You are not a member of this war's faction"]);
  assert.deepEqual(states(alpha), []);
  const bravo = await connect(h.port, BRAVO);
  bravo.emit("join_war", { warId: "war_2000", factionId: "2000" });
  const [, state] = await bravo.waitFor("war_state");
  assert.equal(state.enemyFactionId, null);
  alpha.close();
  bravo.close();
}));

test("the faction is the sign-in's, not the message's", { timeout: 30000 }, () => withHarness(async (h) => {
  const c = await connect(h.port, ALPHA);
  c.emit("join_war", { warId: "war_1000", factionId: "2000" });
  const [, state] = await c.waitFor("war_state");
  assert.equal(state.warId, "war_1000");
  assert.equal(state.factionId, "1000");
  c.close();
}));

test("a sign-in faction given as a number joins its own war", { timeout: 30000 }, () => withHarness(async (h) => {
  const alpha = await connect(h.port, ALPHA);
  alpha.emit("join_war", { warId: "war_1000", factionId: "1000" });
  await alpha.waitFor("war_state");
  const charlie = await connect(h.port, CHARLIE);
  charlie.emit("join_war", { warId: "war_1000", factionId: "1000" });
  await until(() => refusals(charlie).length || states(charlie).length, "an answer");
  assert.deepEqual(refusals(charlie), []);
  assert.equal(states(charlie)[0].warId, "war_1000");
  alpha.close();
  charlie.close();
}));

test("a join that is let in calls onJoin once", { timeout: 30000 }, () => withHarness(async (h) => {
  const c = await connect(h.port, ALPHA);
  c.emit("join_war", { warId: "war_1000", factionId: "1000" });
  await c.waitFor("war_state");
  await until(() => onJoins(h).length, "ONJOIN");
  await settle();
  assert.deepEqual(onJoins(h), ["ONJOIN war_1000"]);
  c.close();
}));

// server.js cannot be imported here (it would start the whole server), so this
// one reads its source: no join_war listener of its own, which would skip the
// checks above, and the status monitor started through onJoin.
const leavesJoinToTheHandlers = (src) => {
  assert.doesNotMatch(src, /socket\.on\(\s*["']join_war["']/);
  assert.match(src, /registerSocketHandlers\(io, socket, \{[\s\S]*?onJoin: \(warId\) => \{[\s\S]*?startWarStatusMonitor\(io, warId\)/);
};
test("server.js leaves join_war to the handlers and starts the monitor through onJoin", () => {
  leavesJoinToTheHandlers(readFileSync(new URL(process.env.SERVER_SRC || "./server.js", import.meta.url), "utf8"));
});
