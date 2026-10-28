// The socket guard. Socket.IO runs each message's listener on a later tick,
// outside any try/catch, so one listener that threw or rejected took the whole
// server down. First guardSocket with an EventEmitter standing in for a
// connection, then a real Socket.IO server (socket-test-harness.mjs) with the
// real handlers and one empty message of each kind.
import { test } from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { readFileSync } from "node:fs";
import { guardSocket } from "./socket-guard.js";
import { startHarness, connect } from "./socket-test-harness.mjs";

const connection = () => Object.assign(new EventEmitter(), { user: { playerName: "Alpha", playerId: "1000001" } });
const ALPHA = { playerId: "1000001", playerName: "Alpha", factionId: "1000" };

test("a listener that throws is logged and the throw stops there", () => {
  const log = [];
  const s = guardSocket(connection(), { log: (m) => log.push(m) });
  s.on("call_target", () => { throw new Error("boom"); });
  assert.doesNotThrow(() => s.emit("call_target"));
  assert.deepEqual(log, ["[ws] call_target from Alpha (1000001) failed: boom"]);
});

test("an async listener that rejects is logged, not left unhandled", async () => {
  const log = [];
  const unhandled = [];
  const spy = (reason) => unhandled.push(reason);
  process.on("unhandledRejection", spy);
  try {
    const s = guardSocket(connection(), { log: (m) => log.push(m) });
    s.on("refresh_statuses", async () => { throw new Error("late"); });
    s.emit("refresh_statuses");
    await new Promise((r) => setTimeout(r, 20));
    assert.deepEqual(log, ["[ws] refresh_statuses from Alpha (1000001) failed: late"]);
    assert.deepEqual(unhandled, []);
  } finally {
    process.off("unhandledRejection", spy);
  }
});

test("a working listener gets its arguments, the ack and the socket as this", () => {
  const s = guardSocket(connection(), { log: () => assert.fail("nothing failed") });
  let seen;
  let acked = null;
  s.on("join_war", function (payload, ack) { seen = { self: this, payload }; ack("ok"); });
  s.emit("join_war", { warId: "war_1000" }, (reply) => { acked = reply; });
  assert.equal(seen.self, s);
  assert.deepEqual(seen.payload, { warId: "war_1000" });
  assert.equal(acked, "ok");
});

test("after 5 failures on one connection, one more line, then nothing", () => {
  const log = [];
  const s = guardSocket(connection(), { log: (m) => log.push(m) });
  s.on("update_status", () => { throw new Error("bad"); });
  for (let i = 0; i < 7; i++) s.emit("update_status");
  assert.equal(log.length, 6);
  assert.equal(log[4], "[ws] update_status from Alpha (1000001) failed: bad");
  assert.equal(log[5], "[ws] Alpha (1000001): more failed messages, no more logged for this connection");
});

test("one connection going quiet leaves another's failures logged", () => {
  const log = [];
  const noisy = guardSocket(connection(), { log: (m) => log.push(m) });
  const other = guardSocket(Object.assign(new EventEmitter(), { user: { playerName: "Bravo", playerId: "1000002" } }), { log: (m) => log.push(m) });
  noisy.on("update_status", () => { throw new Error("bad"); });
  other.on("call_target", () => { throw new Error("odd"); });
  for (let i = 0; i < 9; i++) noisy.emit("update_status");
  other.emit("call_target");
  assert.equal(log.at(-1), "[ws] call_target from Bravo (1000002) failed: odd");
});

test("on still returns the socket", () => {
  const s = guardSocket(connection(), { log: () => {} });
  assert.equal(s.on("call_target", () => {}), s);
});

test("one empty message of each kind leaves the server up and answering", { timeout: 30000 }, async () => {
  const h = await startHarness();
  try {
    const c = await connect(h.port, ALPHA);
    for (const frame of ['42["join_war"]', '42["join_war",null]', '42["call_target"]', '42["uncall_target",null]', '42["update_status"]', '42["refresh_statuses"]']) c.send(frame);
    c.emit("join_war", { warId: "war_1000", factionId: "1000" });
    const down = h.exit.then((code) => {
      throw new Error(`the server exited (${code}): ${h.stderr().split("\n").find((l) => /Error/.test(l)) || ""}`);
    });
    down.catch(() => {});
    const [, state] = await Promise.race([c.waitFor("war_state"), down]);
    assert.equal(state.warId, "war_1000");
    // A rejection nobody handles ends the process just after the reply goes
    // out, so look again a moment later.
    await new Promise((r) => setTimeout(r, 300));
    assert.equal(h.exited(), null, h.stderr());
    c.close();
  } finally {
    await h.stop();
  }
});

// The guard only protects the live server if server.js puts it on each
// connection before any listener: read from its source, since importing
// server.js would start the whole server. SERVER_SRC points it at another copy.
test("server.js guards each socket before adding any listener", () => {
  const src = readFileSync(new URL(process.env.SERVER_SRC || "./server.js", import.meta.url), "utf8");
  const start = src.indexOf('io.on("connection", (socket) => {');
  assert.ok(start > 0, "no connection handler");
  const guard = src.indexOf("guardSocket(socket);", start);
  assert.ok(guard > start, "no guardSocket in the connection handler");
  assert.ok(guard < src.indexOf("socket.on(", start), "a listener is added before guardSocket");
  assert.ok(guard < src.indexOf("registerSocketHandlers(", start), "the handlers are added before guardSocket");
});
